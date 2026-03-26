import {
  PinkChatMessage,
  PinkChatRoom,
  PinkChatSession,
  PinkChatWalletLinkStartResponse,
} from '../types/pinkChat';
import { getApiUrl } from '../utils/apiUrl';
import { PINK_PUPPETS_HASHLIST } from '../data/pinkPuppetsHashlist';
import { getMarketplaceWalletInscriptionsViaUnisat } from './marketplaceService';

const API_URL = String(getApiUrl()).replace(/\/+$/, '');

const MOCK_KEY = 'pinkchat_mock_state_v1';
const API_STATUS_KEY = 'pinkchat_api_status_v1';

type MockState = {
  users: Array<{
    id: string;
    email: string;
    password: string;
    displayName: string;
    level: 'public' | 'level1' | 'level2';
    role: 'member' | 'admin';
    walletAddress?: string;
    level2Active?: boolean;
    lastVerifiedAt?: string | null;
  }>;
  sessions: Array<{ token: string; userId: string }>;
  rooms: PinkChatRoom[];
  messages: PinkChatMessage[];
};

const nowIso = () => new Date().toISOString();
const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const defaultState = (): MockState => ({
  users: [],
  sessions: [],
  rooms: [
    { id: 'room-public-main', slug: 'public-main', name: 'Public Main', visibility: 'public', createdAt: nowIso() },
    { id: 'room-level1-main', slug: 'level1-main', name: 'Level 1 Lounge', visibility: 'level1', createdAt: nowIso() },
    { id: 'room-level2-main', slug: 'level2-main', name: 'Level 2 Holders', visibility: 'level2', createdAt: nowIso() },
  ],
  messages: [],
});

const readMock = (): MockState => {
  try {
    const raw = localStorage.getItem(MOCK_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed?.users) ? parsed.users : [],
      sessions: Array.isArray(parsed?.sessions) ? parsed.sessions : [],
      rooms: Array.isArray(parsed?.rooms) ? parsed.rooms : defaultState().rooms,
      messages: Array.isArray(parsed?.messages) ? parsed.messages : [],
    };
  } catch {
    return defaultState();
  }
};

const writeMock = (state: MockState) => localStorage.setItem(MOCK_KEY, JSON.stringify(state));

type ApiStatus = 'unknown' | 'online' | 'missing';

const getApiStatus = (): ApiStatus => {
  const raw = localStorage.getItem(API_STATUS_KEY);
  if (raw === 'online' || raw === 'missing') return raw;
  return 'unknown';
};

const setApiStatus = (status: ApiStatus) => {
  localStorage.setItem(API_STATUS_KEY, status);
};

const pinkPuppetIdSet = new Set(PINK_PUPPETS_HASHLIST.map((x) => String(x.inscriptionId || '').trim()));
const ownershipCache = new Map<string, { value: boolean; ts: number }>();
const OWNERSHIP_CACHE_MS = 2 * 60 * 1000;

const resolveMockUserByToken = (state: MockState, token: string) => {
  const session = state.sessions.find((s) => s.token === token);
  if (!session) return null;
  return state.users.find((u) => u.id === session.userId) || null;
};

const checkPinkPuppetOwnership = async (walletAddress: string): Promise<boolean> => {
  const normalized = String(walletAddress || '').trim();
  if (!normalized) return false;
  const cached = ownershipCache.get(normalized);
  if (cached && Date.now() - cached.ts < OWNERSHIP_CACHE_MS) return cached.value;
  try {
    const rows = await getMarketplaceWalletInscriptionsViaUnisat(normalized);
    const owns = rows.some((row) => pinkPuppetIdSet.has(String(row?.inscription_id || '').trim()));
    ownershipCache.set(normalized, { value: owns, ts: Date.now() });
    return owns;
  } catch {
    const fallback = normalized.toLowerCase().startsWith('bc1p');
    ownershipCache.set(normalized, { value: fallback, ts: Date.now() });
    return fallback;
  }
};

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (getApiStatus() === 'missing') throw new Error('pinkchat-api-missing');
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    if (res.status === 404 && path.startsWith('/api/pinkchat')) {
      setApiStatus('missing');
    }
    const text = await res.text();
    throw new Error(text || `API error ${res.status}`);
  }
  if (path.startsWith('/api/pinkchat')) setApiStatus('online');
  return res.json();
}

export const pinkChatApi = {
  async register(email: string, password: string, displayName: string): Promise<PinkChatSession> {
    try {
      return await apiRequest<PinkChatSession>('/api/pinkchat/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, displayName }),
      });
    } catch {
      const state = readMock();
      const normalizedEmail = email.trim().toLowerCase();
      if (state.users.some((u) => u.email.toLowerCase() === normalizedEmail)) throw new Error('E-Mail bereits registriert.');
      const token = uid('tok');
      const user = {
        id: uid('usr'),
        email: normalizedEmail,
        password,
        displayName: displayName.trim() || normalizedEmail.split('@')[0],
        level: 'level1' as const,
        role: state.users.length === 0 ? 'admin' as const : 'member' as const,
        level2Active: false,
        lastVerifiedAt: null,
      };
      state.users.unshift(user);
      state.sessions.unshift({ token, userId: user.id });
      writeMock(state);
      return { token, user };
    }
  },

  async login(email: string, password: string): Promise<PinkChatSession> {
    try {
      return await apiRequest<PinkChatSession>('/api/pinkchat/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    } catch {
      const state = readMock();
      const user = state.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password);
      if (!user) throw new Error('Ungültige Login-Daten.');
      const token = uid('tok');
      state.sessions.unshift({ token, userId: user.id });
      writeMock(state);
      return { token, user };
    }
  },

  async me(token: string): Promise<PinkChatSession['user']> {
    try {
      return await apiRequest<PinkChatSession['user']>('/api/pinkchat/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      const state = readMock();
      const user = resolveMockUserByToken(state, token);
      if (!user) throw new Error('Session ungültig.');
      return user;
    }
  },

  async logout(token: string): Promise<void> {
    try {
      await apiRequest('/api/pinkchat/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      const state = readMock();
      state.sessions = state.sessions.filter((s) => s.token !== token);
      writeMock(state);
    }
  },

  async walletLinkStart(token: string, walletAddress: string): Promise<PinkChatWalletLinkStartResponse> {
    try {
      return await apiRequest('/api/pinkchat/wallet/link/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ walletAddress }),
      });
    } catch {
      return { nonce: uid('nonce'), message: `Link Pink Puppets wallet ${walletAddress}` };
    }
  },

  async walletLinkVerify(token: string, walletAddress: string, signature: string): Promise<PinkChatSession['user']> {
    try {
      return await apiRequest('/api/pinkchat/wallet/link/verify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ walletAddress, signature }),
      });
    } catch {
      const state = readMock();
      const ownsPuppet = await checkPinkPuppetOwnership(walletAddress);
      const user = resolveMockUserByToken(state, token);
      if (!user) throw new Error('Bitte zuerst einloggen.');
      user.walletAddress = walletAddress;
      user.level2Active = ownsPuppet;
      user.level = ownsPuppet ? 'level2' : 'level1';
      user.lastVerifiedAt = nowIso();
      writeMock(state);
      return user;
    }
  },

  async walletRevalidate(token: string): Promise<PinkChatSession['user']> {
    try {
      return await apiRequest<PinkChatSession['user']>('/api/pinkchat/wallet/revalidate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      const state = readMock();
      const user = resolveMockUserByToken(state, token);
      if (!user) throw new Error('Nicht eingeloggt.');
      const ownsPuppet = user.walletAddress ? await checkPinkPuppetOwnership(user.walletAddress) : false;
      user.level2Active = ownsPuppet;
      user.level = ownsPuppet ? 'level2' : 'level1';
      user.lastVerifiedAt = nowIso();
      writeMock(state);
      return user;
    }
  },

  async getRooms(token?: string): Promise<PinkChatRoom[]> {
    try {
      return await apiRequest<PinkChatRoom[]>('/api/pinkchat/chat/rooms', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      return readMock().rooms.filter((r) => !r.archived);
    }
  },

  async createRoom(token: string, payload: Pick<PinkChatRoom, 'name' | 'slug' | 'visibility' | 'description'>): Promise<PinkChatRoom> {
    try {
      return await apiRequest<PinkChatRoom>('/api/pinkchat/admin/chat/rooms', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
    } catch {
      const state = readMock();
      const room: PinkChatRoom = { id: uid('room'), ...payload, archived: false, createdAt: nowIso() };
      state.rooms.push(room);
      writeMock(state);
      return room;
    }
  },

  async getMessages(roomId: string, token?: string): Promise<PinkChatMessage[]> {
    try {
      return await apiRequest<PinkChatMessage[]>(`/api/pinkchat/chat/rooms/${encodeURIComponent(roomId)}/messages`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      return readMock().messages.filter((m) => m.roomId === roomId).slice(-200);
    }
  },

  async postMessage(roomId: string, content: string, token: string, displayName: string, userId: string): Promise<PinkChatMessage> {
    try {
      return await apiRequest<PinkChatMessage>(`/api/pinkchat/chat/rooms/${encodeURIComponent(roomId)}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content }),
      });
    } catch {
      const state = readMock();
      const message: PinkChatMessage = { id: uid('msg'), roomId, content: content.trim(), createdAt: nowIso(), displayName, userId };
      state.messages.push(message);
      writeMock(state);
      return message;
    }
  },
};

