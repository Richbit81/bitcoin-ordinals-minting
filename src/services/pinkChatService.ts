import {
  PinkChatMessage,
  PinkChatRoom,
  PinkChatSession,
  PinkChatWalletLinkStartResponse,
} from '../types/pinkChat';
import { getApiUrl } from '../utils/apiUrl';
import { PINK_PUPPETS_HASHLIST } from '../data/pinkPuppetsHashlist';

const API_URL = String(getApiUrl()).replace(/\/+$/, '');

const MOCK_KEY = 'pinkchat_data';
const MOCK_BACKUP_KEY = 'pinkchat_data_backup';
const LEGACY_KEYS = ['pinkchat_mock_state_v1', 'pinkchat_mock_state_v2', 'pinkchat_mock_state_v3', 'pinkchat_mock_state_v4'];

const ADMIN_WALLETS = new Set([
  'bc1p9j4g6r27yqhmp4c403vn33mz7uug439sthqngkkrylu7d7uq7d6qvz39jj',
]);

type MockState = {
  _version: number;
  _lastWritten: string;
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
    puppetCount?: number;
  }>;
  sessions: Array<{ token: string; userId: string; createdAt: string }>;
  rooms: PinkChatRoom[];
  messages: PinkChatMessage[];
};

const nowIso = () => new Date().toISOString();
const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const DEFAULT_ROOMS: PinkChatRoom[] = [
  { id: 'room-public', slug: 'public', name: 'Public', visibility: 'open', description: 'Open chat – no login required', createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'room-lobby', slug: 'lobby', name: 'Lobby', visibility: 'level1', description: 'Chat for registered users – Level 1+', createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'room-news', slug: 'news', name: 'News', visibility: 'level1', description: 'News and updates – Level 1+', createdAt: '2025-01-01T00:00:00.000Z' },
  { id: 'room-cloud', slug: 'cloud', name: 'Cloud', visibility: 'level2', description: 'Exclusive room for PinkPuppet holders', createdAt: '2025-01-01T00:00:00.000Z' },
];

const defaultState = (): MockState => ({
  _version: 1,
  _lastWritten: nowIso(),
  users: [],
  sessions: [],
  rooms: [...DEFAULT_ROOMS],
  messages: [],
});

const parseState = (raw: string | null): MockState | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.users) && !Array.isArray(parsed.rooms)) return null;
    return {
      _version: parsed._version || 1,
      _lastWritten: parsed._lastWritten || nowIso(),
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions.map((s: any) => ({ ...s, createdAt: s.createdAt || nowIso() })) : [],
      rooms: Array.isArray(parsed.rooms) ? parsed.rooms : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    };
  } catch {
    return null;
  }
};

const mergeDefaultRooms = (state: MockState): MockState => {
  const existingIds = new Set(state.rooms.map((r) => r.id));
  for (const dr of DEFAULT_ROOMS) {
    if (!existingIds.has(dr.id)) state.rooms.push({ ...dr });
  }
  return state;
};

const pickBestState = (...candidates: (MockState | null)[]): MockState => {
  let best: MockState | null = null;
  for (const c of candidates) {
    if (!c) continue;
    if (!best) { best = c; continue; }
    const cScore = c.users.length + c.messages.length + c.sessions.length;
    const bScore = best.users.length + best.messages.length + best.sessions.length;
    if (cScore > bScore) best = c;
  }
  return best || defaultState();
};

const readMock = (): MockState => {
  const primary = parseState(localStorage.getItem(MOCK_KEY));
  const backup = parseState(localStorage.getItem(MOCK_BACKUP_KEY));

  let legacy: MockState | null = null;
  for (const key of LEGACY_KEYS) {
    const parsed = parseState(localStorage.getItem(key));
    if (parsed) {
      legacy = pickBestState(legacy, parsed);
      localStorage.removeItem(key);
    }
  }

  const state = mergeDefaultRooms(pickBestState(primary, backup, legacy));

  if (!primary && (backup || legacy)) {
    console.log('[PinkChat] Recovered data from backup/legacy storage');
    writeMock(state);
  }

  return state;
};

const writeMock = (state: MockState) => {
  state._lastWritten = nowIso();
  state._version = 1;
  const json = JSON.stringify(state);
  try {
    localStorage.setItem(MOCK_KEY, json);
    localStorage.setItem(MOCK_BACKUP_KEY, json);
  } catch (err) {
    console.error('[PinkChat] CRITICAL: Failed to write data to localStorage', err);
  }
};

type ApiStatus = 'unknown' | 'online' | 'missing';

let _apiStatus: ApiStatus = 'unknown';
let _apiCheckPromise: Promise<void> | null = null;

const getApiStatus = (): ApiStatus => _apiStatus;

const setApiStatus = (status: ApiStatus) => {
  if (_apiStatus !== status) {
    console.log(`[PinkChat] API status: ${_apiStatus} → ${status}`);
    _apiStatus = status;
  }
};

const probeApi = async () => {
  if (_apiStatus !== 'unknown') return;
  try {
    const res = await fetch(`${API_URL}/api/pinkchat/chat/rooms`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    setApiStatus(res.ok || res.status === 401 ? 'online' : 'missing');
  } catch {
    setApiStatus('missing');
  }
};

const ensureApiChecked = async () => {
  if (_apiStatus !== 'unknown') return;
  if (!_apiCheckPromise) _apiCheckPromise = probeApi();
  await _apiCheckPromise;
};

const pinkPuppetIdSet = new Set(PINK_PUPPETS_HASHLIST.map((x) => String(x.inscriptionId || '').trim()));
const ownershipCache = new Map<string, { value: { owns: boolean; count: number }; ts: number }>();
const ownedPuppetIdsCache = new Map<string, { ids: string[]; ts: number }>();
const OWNERSHIP_CACHE_MS = 2 * 60 * 1000;

const resolveMockUserByToken = (state: MockState, token: string) => {
  const session = state.sessions.find((s) => s.token === token);
  if (!session) return null;
  return state.users.find((u) => u.id === session.userId) || null;
};

export const checkPinkPuppetOwnership = async (walletAddress: string): Promise<{ owns: boolean; count: number }> => {
  const normalized = String(walletAddress || '').trim();
  if (!normalized) return { owns: false, count: 0 };
  const cached = ownershipCache.get(normalized);
  if (cached && Date.now() - cached.ts < OWNERSHIP_CACHE_MS) return cached.value;
  try {
    const allIds: string[] = [];
    let cursor = 0;
    const pageSize = 100;
    let guard = 0;
    while (guard < 20) {
      const res = await fetch(
        `${API_URL}/v1/indexer/address/${encodeURIComponent(normalized)}/inscription-data?cursor=${cursor}&size=${pageSize}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      const items: any[] = data?.data?.inscription || [];
      if (items.length === 0) break;
      allIds.push(...items.map((item: any) => String(item.inscriptionId || '').trim()));
      cursor += items.length;
      if (items.length < pageSize) break;
      guard++;
    }
    const count = allIds.filter((id) => pinkPuppetIdSet.has(id)).length;
    const result = { owns: count > 0, count };
    ownershipCache.set(normalized, { value: result, ts: Date.now() });
    console.log(`[PinkChat] Checked ${allIds.length} inscriptions, found ${count} PinkPuppet(s)`);
    return result;
  } catch (err) {
    console.warn('[PinkChat] Ownership check failed:', err);
    const result = { owns: false, count: 0 };
    ownershipCache.set(normalized, { value: result, ts: Date.now() });
    return result;
  }
};

export const getOwnedPinkPuppetIds = async (walletAddress: string): Promise<string[]> => {
  const normalized = String(walletAddress || '').trim();
  if (!normalized) return [];
  const cached = ownedPuppetIdsCache.get(normalized);
  if (cached && Date.now() - cached.ts < OWNERSHIP_CACHE_MS) return cached.ids;
  try {
    const allIds: string[] = [];
    let cursor = 0;
    const pageSize = 100;
    let guard = 0;
    while (guard < 20) {
      const res = await fetch(
        `${API_URL}/v1/indexer/address/${encodeURIComponent(normalized)}/inscription-data?cursor=${cursor}&size=${pageSize}`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      const items: any[] = data?.data?.inscription || [];
      if (items.length === 0) break;
      allIds.push(...items.map((item: any) => String(item.inscriptionId || '').trim()));
      cursor += items.length;
      if (items.length < pageSize) break;
      guard++;
    }
    const owned = allIds.filter((id) => pinkPuppetIdSet.has(id));
    ownedPuppetIdsCache.set(normalized, { ids: owned, ts: Date.now() });
    return owned;
  } catch {
    return [];
  }
};

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  await ensureApiChecked();
  if (getApiStatus() === 'missing') throw new Error('pinkchat-api-missing');
  const { headers: initHeaders, ...restInit } = init || {};
  const res = await fetch(`${API_URL}${path}`, {
    ...restInit,
    headers: { 'Content-Type': 'application/json', ...(initHeaders || {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401) throw new Error('pinkchat-auth-invalid');
    let msg = `API error ${res.status}`;
    try { const j = JSON.parse(text); if (j.error) msg = j.error; } catch { if (text) msg = text; }
    throw new Error(msg);
  }
  setApiStatus('online');
  return res.json();
}

const isMockFallback = (err: unknown) => err instanceof Error && err.message === 'pinkchat-api-missing';

export const pinkChatApi = {
  async register(email: string, password: string, displayName: string): Promise<PinkChatSession> {
    try {
      return await apiRequest<PinkChatSession>('/api/pinkchat/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, displayName }),
      });
    } catch (err) {
      if (!isMockFallback(err)) throw err;
      const state = readMock();
      const normalizedEmail = email.trim().toLowerCase();
      if (state.users.some((u) => u.email.toLowerCase() === normalizedEmail)) throw new Error('Email already registered.');
      const token = uid('tok');
      const user = {
        id: uid('usr'),
        email: normalizedEmail,
        password,
        displayName: displayName.trim() || normalizedEmail.split('@')[0],
        level: 'level1' as const,
        role: 'member' as const,
        level2Active: false,
        lastVerifiedAt: null,
      };
      state.users.unshift(user);
      state.sessions.unshift({ token, userId: user.id, createdAt: nowIso() });
      writeMock(state);
      console.log(`[PinkChat] REGISTER (mock) user="${user.displayName}" id=${user.id} total_users=${state.users.length}`);
      return { token, user };
    }
  },

  async walletLogin(walletAddress: string, displayName: string): Promise<PinkChatSession> {
    try {
      return await apiRequest<PinkChatSession>('/api/pinkchat/auth/wallet-login', {
        method: 'POST',
        body: JSON.stringify({ walletAddress, displayName }),
      });
    } catch (err) {
      if (!isMockFallback(err)) throw err;
      const state = readMock();
      const existing = state.users.find((u) => u.walletAddress === walletAddress);
      if (existing) {
        const token = uid('tok');
        state.sessions.unshift({ token, userId: existing.id, createdAt: nowIso() });
        writeMock(state);
        console.log(`[PinkChat] WALLET_LOGIN (mock) existing user="${existing.displayName}" wallet=${walletAddress}`);
        return { token, user: existing };
      }
      const { owns, count } = await checkPinkPuppetOwnership(walletAddress);
      const isAdmin = ADMIN_WALLETS.has(walletAddress);
      const token = uid('tok');
      const user = {
        id: uid('usr'),
        email: `wallet:${walletAddress}`,
        password: '',
        displayName: displayName.trim(),
        level: (owns || isAdmin) ? 'level2' as const : 'level1' as const,
        role: isAdmin ? 'admin' as const : 'member' as const,
        walletAddress,
        level2Active: owns || isAdmin,
        lastVerifiedAt: nowIso(),
        puppetCount: count,
      };
      state.users.unshift(user);
      state.sessions.unshift({ token, userId: user.id, createdAt: nowIso() });
      writeMock(state);
      console.log(`[PinkChat] WALLET_LOGIN (mock) new user="${user.displayName}" wallet=${walletAddress} puppets=${count} level=${user.level}`);
      return { token, user };
    }
  },

  async login(email: string, password: string): Promise<PinkChatSession> {
    try {
      return await apiRequest<PinkChatSession>('/api/pinkchat/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    } catch (err) {
      if (!isMockFallback(err)) throw err;
      const state = readMock();
      const user = state.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password);
      if (!user) throw new Error('Invalid login credentials.');
      const token = uid('tok');
      state.sessions.unshift({ token, userId: user.id, createdAt: nowIso() });
      writeMock(state);
      console.log(`[PinkChat] LOGIN (mock) user="${user.displayName}" id=${user.id}`);
      return { token, user };
    }
  },

  async me(token: string): Promise<PinkChatSession['user']> {
    try {
      return await apiRequest<PinkChatSession['user']>('/api/pinkchat/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      if (!isMockFallback(err)) throw new Error('Session expired – please log in again.');
      const state = readMock();
      const user = resolveMockUserByToken(state, token);
      if (!user) throw new Error('Invalid session.');
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
      const session = state.sessions.find((s) => s.token === token);
      const userId = session?.userId;
      state.sessions = state.sessions.filter((s) => s.token !== token);
      writeMock(state);
      console.log(`[PinkChat] LOGOUT userId=${userId || 'unknown'} remaining_sessions=${state.sessions.length}`);
    }
  },

  async walletLinkStart(token: string, walletAddress: string): Promise<PinkChatWalletLinkStartResponse> {
    try {
      return await apiRequest('/api/pinkchat/wallet/link/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ walletAddress }),
      });
    } catch (err) {
      if (!isMockFallback(err)) throw err;
      console.log(`[PinkChat] WALLET_LINK_START (mock) wallet=${walletAddress}`);
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
    } catch (err) {
      if (!isMockFallback(err)) throw err;
      const state = readMock();
      const { owns: ownsPuppet, count: puppetCount } = await checkPinkPuppetOwnership(walletAddress);
      const isAdmin = ADMIN_WALLETS.has(walletAddress);
      const user = resolveMockUserByToken(state, token);
      if (!user) throw new Error('Please log in first.');
      user.walletAddress = walletAddress;
      user.level2Active = ownsPuppet || isAdmin;
      user.level = (ownsPuppet || isAdmin) ? 'level2' : 'level1';
      if (isAdmin) user.role = 'admin';
      user.lastVerifiedAt = nowIso();
      (user as any).puppetCount = puppetCount;
      writeMock(state);
      console.log(`[PinkChat] WALLET_VERIFY (mock) user="${user.displayName}" wallet=${walletAddress} puppets=${puppetCount} isAdmin=${isAdmin} level=${user.level}`);
      return user;
    }
  },

  async walletRevalidate(token: string): Promise<PinkChatSession['user']> {
    try {
      return await apiRequest<PinkChatSession['user']>('/api/pinkchat/wallet/revalidate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      if (!isMockFallback(err)) throw err;
      const state = readMock();
      const user = resolveMockUserByToken(state, token);
      if (!user) throw new Error('Not logged in.');
      const { owns: ownsPuppet, count: puppetCount } = user.walletAddress ? await checkPinkPuppetOwnership(user.walletAddress) : { owns: false, count: 0 };
      const isAdmin = user.walletAddress ? ADMIN_WALLETS.has(user.walletAddress) : false;
      user.level2Active = ownsPuppet || isAdmin;
      user.level = (ownsPuppet || isAdmin) ? 'level2' : 'level1';
      if (isAdmin) user.role = 'admin';
      user.lastVerifiedAt = nowIso();
      (user as any).puppetCount = puppetCount;
      writeMock(state);
      console.log(`[PinkChat] WALLET_REVALIDATE (mock) user="${user.displayName}" wallet=${user.walletAddress} puppets=${puppetCount} level=${user.level}`);
      return user;
    }
  },

  async getRooms(token?: string): Promise<PinkChatRoom[]> {
    try {
      return await apiRequest<PinkChatRoom[]>('/api/pinkchat/chat/rooms', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch (err) {
      if (!isMockFallback(err)) {
        console.warn('[PinkChat] getRooms API error, falling back to mock:', err);
      }
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
    } catch (err) {
      if (!isMockFallback(err)) throw err;
      const state = readMock();
      const room: PinkChatRoom = { id: uid('room'), ...payload, archived: false, createdAt: nowIso() };
      state.rooms.push(room);
      writeMock(state);
      console.log(`[PinkChat] CREATE_ROOM (mock) name="${room.name}" visibility=${room.visibility} total_rooms=${state.rooms.length}`);
      return room;
    }
  },

  async getMessages(roomId: string, token?: string): Promise<PinkChatMessage[]> {
    try {
      return await apiRequest<PinkChatMessage[]>(`/api/pinkchat/chat/rooms/${encodeURIComponent(roomId)}/messages`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch (err) {
      if (!isMockFallback(err)) {
        console.warn('[PinkChat] getMessages API error, falling back to mock:', err);
      }
      return readMock().messages.filter((m) => m.roomId === roomId).slice(-200);
    }
  },

  async postMessage(roomId: string, content: string, token: string | null, displayName: string, userId: string, replyTo?: { id: string; displayName: string; content: string }): Promise<PinkChatMessage> {
    try {
      await ensureApiChecked();
      if (getApiStatus() === 'missing') throw new Error('pinkchat-api-missing');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const body = token
        ? JSON.stringify({ content, ...(replyTo ? { replyTo } : {}) })
        : JSON.stringify({ content, displayName, ...(replyTo ? { replyTo } : {}) });
      return await apiRequest<PinkChatMessage>(`/api/pinkchat/chat/rooms/${encodeURIComponent(roomId)}/messages`, {
        method: 'POST',
        headers,
        body,
      });
    } catch (err) {
      if (!isMockFallback(err)) throw err;
      const state = readMock();
      const message: PinkChatMessage = { id: uid('msg'), roomId, content: content.trim(), createdAt: nowIso(), displayName, userId, ...(replyTo ? { replyTo } : {}) };
      state.messages.push(message);
      writeMock(state);
      console.log(`[PinkChat] POST_MESSAGE (mock) room=${roomId} user="${displayName}" userId=${userId} total_msgs=${state.messages.length}`);
      return message;
    }
  },

  async updateMe(token: string, data: { displayName?: string; avatarInscriptionId?: string }): Promise<PinkChatSession['user']> {
    try {
      return await apiRequest<PinkChatSession['user']>('/api/pinkchat/auth/me/update', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
    } catch (err) {
      if (!isMockFallback(err)) throw err;
      const state = readMock();
      const user = resolveMockUserByToken(state, token);
      if (!user) throw new Error('Not logged in.');
      if (data.displayName) user.displayName = data.displayName.trim();
      if (data.avatarInscriptionId !== undefined) user.avatarInscriptionId = data.avatarInscriptionId;
      writeMock(state);
      return user;
    }
  },

  async deleteMessage(roomId: string, messageId: string, token: string): Promise<void> {
    try {
      await apiRequest<{ success: boolean }>(`/api/pinkchat/chat/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(messageId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      if (!isMockFallback(err)) throw err;
      const state = readMock();
      const msg = state.messages.find((m) => m.id === messageId);
      if (msg) { (msg as any).deleted = true; msg.content = ''; }
      writeMock(state);
    }
  },

  async toggleReaction(roomId: string, messageId: string, emoji: string, token: string | null, displayName?: string): Promise<PinkChatMessage> {
    try {
      await ensureApiChecked();
      if (getApiStatus() === 'missing') throw new Error('pinkchat-api-missing');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      return await apiRequest<PinkChatMessage>(`/api/pinkchat/chat/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(messageId)}/reactions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ emoji, ...(token ? {} : { displayName }) }),
      });
    } catch (err) {
      if (!isMockFallback(err)) throw err;
      const state = readMock();
      const msg = state.messages.find((m) => m.id === messageId);
      if (!msg) throw new Error('Message not found');
      if (!(msg as any).reactions) (msg as any).reactions = {};
      const reactions = (msg as any).reactions as Record<string, string[]>;
      if (!reactions[emoji]) reactions[emoji] = [];
      const userId = token ? (resolveMockUserByToken(state, token)?.id || 'unknown') : `guest-${(displayName || '').toLowerCase().replace(/\s+/g, '-')}`;
      const idx = reactions[emoji].indexOf(userId);
      if (idx >= 0) { reactions[emoji].splice(idx, 1); if (reactions[emoji].length === 0) delete reactions[emoji]; }
      else { reactions[emoji].push(userId); }
      writeMock(state);
      return msg;
    }
  },

  async getDmRooms(token: string): Promise<PinkChatRoom[]> {
    try {
      return await apiRequest<PinkChatRoom[]>('/api/pinkchat/chat/dm', {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      if (!isMockFallback(err)) throw err;
      return [];
    }
  },

  async getOrCreateDm(targetUserId: string, token: string): Promise<PinkChatRoom> {
    return await apiRequest<PinkChatRoom>(`/api/pinkchat/chat/dm/${encodeURIComponent(targetUserId)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};

