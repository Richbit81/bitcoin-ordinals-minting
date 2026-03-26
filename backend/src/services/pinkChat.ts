import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import {
  ChatMessage,
  ChatRoom,
  ChatUser,
  PinkChatState,
  RoomVisibility,
} from '../types/pinkChat';

const CHAT_FILE_PATH = process.env.PINK_CHAT_DATA_PATH
  ? path.resolve(process.env.PINK_CHAT_DATA_PATH)
  : path.join(process.cwd(), 'data', 'pink-chat.json');

const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const nowIso = () => new Date().toISOString();

const hashPassword = (password: string) => crypto.createHash('sha256').update(`pinkchat:${password}`).digest('hex');
const hashSignature = (value: string) => crypto.createHash('sha256').update(String(value || '')).digest('hex');

const isLikelyPinkPuppetHolder = (walletAddress: string) => {
  // NOTE: Placeholder ownership rule. Replace with real chain lookup integration.
  return String(walletAddress || '').trim().toLowerCase().startsWith('bc1p');
};

const ensureDir = async () => {
  const dataDir = path.dirname(CHAT_FILE_PATH);
  try { await fs.access(dataDir); } catch { await fs.mkdir(dataDir, { recursive: true }); }
};

const defaultRooms = (): ChatRoom[] => [
  { id: 'room-public-main', slug: 'public-main', name: 'Public Main', visibility: 'public', createdAt: nowIso(), createdBy: 'system' },
  { id: 'room-level1-main', slug: 'level1-main', name: 'Level 1 Lounge', visibility: 'level1', createdAt: nowIso(), createdBy: 'system' },
  { id: 'room-level2-main', slug: 'level2-main', name: 'Level 2 Holders', visibility: 'level2', createdAt: nowIso(), createdBy: 'system' },
];

const readState = async (): Promise<PinkChatState> => {
  await ensureDir();
  try {
    const raw = await fs.readFile(CHAT_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed?.users) ? parsed.users : [],
      sessions: Array.isArray(parsed?.sessions) ? parsed.sessions : [],
      walletChallenges: Array.isArray(parsed?.walletChallenges) ? parsed.walletChallenges : [],
      rooms: Array.isArray(parsed?.rooms) && parsed.rooms.length > 0 ? parsed.rooms : defaultRooms(),
      messages: Array.isArray(parsed?.messages) ? parsed.messages : [],
      audit: Array.isArray(parsed?.audit) ? parsed.audit : [],
    };
  } catch {
    return { users: [], sessions: [], walletChallenges: [], rooms: defaultRooms(), messages: [], audit: [] };
  }
};

const writeState = async (state: PinkChatState) => {
  await ensureDir();
  const compact = {
    ...state,
    messages: state.messages.slice(-10000),
    sessions: state.sessions.slice(-5000),
    audit: state.audit.slice(-10000),
    walletChallenges: state.walletChallenges.slice(-5000),
  };
  await fs.writeFile(CHAT_FILE_PATH, JSON.stringify(compact, null, 2));
};

export const toSafeUser = (user: ChatUser) => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  level: user.level,
  role: user.role,
  walletAddress: user.walletAddress,
  level2Active: !!user.level2Active,
  lastVerifiedAt: user.lastVerifiedAt || null,
  createdAt: user.createdAt,
});

export const registerChatUser = async (email: string, password: string, displayName: string) => {
  const state = await readState();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || !String(password || '').trim()) throw new Error('E-Mail und Passwort erforderlich.');
  if (state.users.some((u) => u.email.toLowerCase() === normalizedEmail)) throw new Error('E-Mail bereits registriert.');
  const user: ChatUser = {
    id: uid('usr'),
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    displayName: String(displayName || normalizedEmail.split('@')[0] || 'PuppetUser').trim(),
    level: 'level1',
    role: state.users.length === 0 ? 'admin' : 'member',
    level2Active: false,
    lastVerifiedAt: null,
    createdAt: nowIso(),
  };
  const token = uid('pst');
  state.users.unshift(user);
  state.sessions.unshift({ token, userId: user.id, createdAt: nowIso() });
  await writeState(state);
  return { token, user: toSafeUser(user) };
};

export const loginChatUser = async (email: string, password: string) => {
  const state = await readState();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = state.users.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (!user || user.passwordHash !== hashPassword(password)) throw new Error('Ungültige Login-Daten.');
  const token = uid('pst');
  state.sessions.unshift({ token, userId: user.id, createdAt: nowIso() });
  await writeState(state);
  return { token, user: toSafeUser(user) };
};

export const getUserByToken = async (token: string) => {
  const state = await readState();
  const session = state.sessions.find((s) => s.token === token);
  if (!session) return null;
  const user = state.users.find((u) => u.id === session.userId);
  return user || null;
};

export const invalidateToken = async (token: string) => {
  const state = await readState();
  state.sessions = state.sessions.filter((s) => s.token !== token);
  await writeState(state);
};

export const startWalletLink = async (userId: string, walletAddress: string) => {
  const state = await readState();
  const nonce = uid('nonce');
  state.walletChallenges.push({ userId, walletAddress, nonce, createdAt: nowIso() });
  await writeState(state);
  return { nonce, message: `Pink Puppets wallet link nonce: ${nonce} for ${walletAddress}` };
};

export const verifyWalletLink = async (userId: string, walletAddress: string, signature: string) => {
  const state = await readState();
  const challenge = [...state.walletChallenges].reverse().find((c) => c.userId === userId && c.walletAddress === walletAddress);
  if (!challenge) throw new Error('Keine aktive Wallet-Challenge gefunden.');
  if (!String(signature || '').trim()) throw new Error('Signatur erforderlich.');
  // Placeholder signature check: at least deterministic hashing path.
  const signatureHash = hashSignature(signature);
  if (!signatureHash) throw new Error('Signatur ungültig.');

  const user = state.users.find((u) => u.id === userId);
  if (!user) throw new Error('User nicht gefunden.');
  const holder = isLikelyPinkPuppetHolder(walletAddress);
  user.walletAddress = walletAddress;
  user.level2Active = holder;
  user.level = holder ? 'level2' : 'level1';
  user.lastVerifiedAt = nowIso();
  state.audit.push({
    id: uid('audit'),
    type: holder ? 'level_upgrade' : 'wallet_revalidate',
    userId,
    details: { walletAddress, holder, reason: 'wallet_link_verify' },
    createdAt: nowIso(),
  });
  await writeState(state);
  return toSafeUser(user);
};

export const revalidateWalletForUser = async (userId: string) => {
  const state = await readState();
  const user = state.users.find((u) => u.id === userId);
  if (!user) throw new Error('User nicht gefunden.');
  if (!user.walletAddress) return toSafeUser(user);
  const holder = isLikelyPinkPuppetHolder(user.walletAddress);
  const previousLevel = user.level;
  user.level2Active = holder;
  user.level = holder ? 'level2' : 'level1';
  user.lastVerifiedAt = nowIso();
  state.audit.push({
    id: uid('audit'),
    type: holder ? 'wallet_revalidate' : 'level_downgrade',
    userId,
    details: { walletAddress: user.walletAddress, holder, previousLevel, nextLevel: user.level, reason: 'manual_revalidate' },
    createdAt: nowIso(),
  });
  await writeState(state);
  return toSafeUser(user);
};

const canAccessRoom = (visibility: RoomVisibility, level: string, role: string) => {
  if (role === 'admin') return true;
  if (visibility === 'public') return true;
  if (visibility === 'level1') return level === 'level1' || level === 'level2';
  if (visibility === 'level2') return level === 'level2';
  return false;
};

export const getRoomsForUser = async (user?: ChatUser | null) => {
  const state = await readState();
  return state.rooms
    .filter((r) => !r.archived)
    .filter((r) => {
      if (!user) return r.visibility === 'public';
      return canAccessRoom(r.visibility, user.level, user.role);
    });
};

export const createRoom = async (user: ChatUser, payload: { name: string; slug: string; description?: string; visibility: RoomVisibility }) => {
  if (user.role !== 'admin') throw new Error('Nur Admins dürfen Räume erstellen.');
  const state = await readState();
  const slug = String(payload.slug || '').trim().toLowerCase();
  if (!slug) throw new Error('Slug erforderlich.');
  if (state.rooms.some((r) => r.slug === slug && !r.archived)) throw new Error('Slug bereits vergeben.');
  const room: ChatRoom = {
    id: uid('room'),
    slug,
    name: String(payload.name || '').trim() || slug,
    description: String(payload.description || '').trim(),
    visibility: payload.visibility,
    archived: false,
    createdBy: user.id,
    createdAt: nowIso(),
  };
  state.rooms.push(room);
  state.audit.push({
    id: uid('audit'),
    type: 'admin_action',
    userId: user.id,
    details: { action: 'create_room', roomId: room.id, visibility: room.visibility },
    createdAt: nowIso(),
  });
  await writeState(state);
  return room;
};

export const getRoomMessages = async (roomId: string, user?: ChatUser | null): Promise<ChatMessage[]> => {
  const state = await readState();
  const room = state.rooms.find((r) => r.id === roomId && !r.archived);
  if (!room) throw new Error('Raum nicht gefunden.');
  if (!user && room.visibility !== 'public') throw new Error('Login erforderlich.');
  if (user && !canAccessRoom(room.visibility, user.level, user.role)) throw new Error('Keine Berechtigung für diesen Raum.');
  return state.messages.filter((m) => m.roomId === roomId).slice(-200);
};

export const postRoomMessage = async (roomId: string, user: ChatUser, content: string): Promise<ChatMessage> => {
  const trimmed = String(content || '').trim();
  if (!trimmed) throw new Error('Leere Nachricht.');
  if (trimmed.length > 1200) throw new Error('Nachricht ist zu lang (max 1200 Zeichen).');
  const state = await readState();
  const room = state.rooms.find((r) => r.id === roomId && !r.archived);
  if (!room) throw new Error('Raum nicht gefunden.');
  if (!canAccessRoom(room.visibility, user.level, user.role)) throw new Error('Keine Berechtigung.');
  const message: ChatMessage = {
    id: uid('msg'),
    roomId,
    userId: user.id,
    displayName: user.displayName,
    content: trimmed,
    createdAt: nowIso(),
  };
  state.messages.push(message);
  await writeState(state);
  return message;
};

export const runDailyWalletRevalidation = async () => {
  const state = await readState();
  const now = nowIso();
  for (const user of state.users) {
    if (!user.walletAddress || !user.level2Active) continue;
    const holder = isLikelyPinkPuppetHolder(user.walletAddress);
    if (!holder) {
      user.level2Active = false;
      user.level = 'level1';
      state.audit.push({
        id: uid('audit'),
        type: 'level_downgrade',
        userId: user.id,
        details: { reason: 'daily_revalidation', walletAddress: user.walletAddress },
        createdAt: now,
      });
    }
    user.lastVerifiedAt = now;
  }
  await writeState(state);
};

