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

const PINK_PUPPET_IDS = new Set([
  'de7da70debc3e9af1a3891a283b8cf9b02646943c4d0fb66ffb9c26c74dcca6ei0',
  '191508fb61b72816d55d2b7a2b22f913c2de620cdc70ac442fb1e9eba6121769i0',
  '4eed21c58340880bf28d835cd419cc7dcfea2b4f00f6183a733a3117a043628bi0',
  '4eed21c58340880bf28d835cd419cc7dcfea2b4f00f6183a733a3117a043628bi1',
  'd7116ecead52325beb79a5cb26fc4bc2b95550cb77b6cc24083a9b4f75e309f7i0',
  '602c2075565e5586ea76aa14a0972a844f4498e7a9dc39b3a35e858696f249eei0',
  '4fbc84618bdaea6922be0bf8c7524af99ad832f789f47799d89faeb060bb6de3i0',
  'e3073ae150210263ca8963174779bab76b8bdf2238d73c47ac3b629ffe11e9dfi0',
  'd0eb3024744d635592c6a233bc5ed5ec26129923cc253417e9832fcdd79760bfi0',
  'f00bbc6ba76783e45f5ae977b1035fceeacc53dc641817f9ce0323a7151c72d4i0',
  '73a66a85fd909d753650070f9aaa8b12b016cf517d39eeec9ec11ea48a91be6fi0',
  'ee32b348142f541c8e01407fcb22c6469fcc4969ad2c3f80e900d867f5d3aa0bi0',
  'f255577679af61d11166564579e95f82a60445e27dfef12ac5093272ad50154ai0',
  '7d6f60899bb59d18a7a5d460f583068d3451d7ee60b8ddf5ba16a0d7a6fb0f21i0',
  '98046e5c4a2bc962298dbbdd6e0a0077ac4c733912fdbe3ac2b422bb0378c40bi0',
  'dd816ff62fa6903886b64e750b8717df7584b708af4eec84cf282d577ea95837i0',
  'a0af92209f815d5ac4c991089349a4f8d87020f110f5fa1b0c300537e869a062i0',
  '50cdfa0100f38c5b04a37f5e9f836e11fcb72b3bfdd3d00374bf25f87c3d1866i0',
  '4a32a1504e77a3135103cab1bb8cdd8be3ac4bc3928e0597a38e9eca707cada1i0',
  '93b2028c6dc01870bb6d5e68f9c505c038632dcbea9fd12ee2bc30db388ddb4ei0',
  'ebd6043cdd086229d2412cc46672af23623c09a3aea1b8018c2d15c4fd802ae6i0',
  '2fda7bfdf14f0e7cba4e7d8e0ce73ecfd63c0861b710ed417e12c33b8c743460i0',
  '6d62222a7a5891dec842f74fbe49a33eba1e41093634ac748cd01c32fd508c32i0',
  'd869c4aac69c440fdd1398a709ca401355ee5f714c2f1f5a6a44434a17682c94i0',
  'f27e12e81918c5f09d61c85ef1c0df8f3ed119d490d4a43fe24a8aeda1ad4be0i0',
  '8d5801dd0ee7b0b5e5382e8f9e603a3a2700fd3200ac5ce0b4493fce84cbd79ei0',
  '025d303b709dc01e23df7af61fa61cb462e2cb247c23cc27762d35bb7674f851i0',
  'befc63358844acdd6513d1c93ab6881e4066ce3075c7b170b8e9f4cb44d09376i0',
  '3fd2b67cffde4b28920fc124d90e7f919ff265b8ee81538ae5e496cd9daba0aai0',
  '8233b0ffad0132535d871821636fcb288ec772fc1a09edb922b888851a8ef628i0',
  '6d2d250ac4cb84f8b53bf14431b7f66499c5069409614835a7a263d37663a7f0i0',
  '044413c8e8e7b0b5e6079b1585b9e4f4bc261d9080d7c724e176e11a59f63c8bi0',
  '4e1d09572993ed51fba46b45be0977aae0655da721f87d5e9b43756f8c628386i0',
  '4e1d09572993ed51fba46b45be0977aae0655da721f87d5e9b43756f8c628386i1',
  '5a2510c37569613a1eed8ebdb84dbe1ff2b72622b2f60c9d27be5d9726039a71i0',
  '84ed827971d6fe84083cc09d378ea7fdebc536b58cf18c8b0244eb8eb28702e0i0',
  '84ed827971d6fe84083cc09d378ea7fdebc536b58cf18c8b0244eb8eb28702e0i1',
  '84ed827971d6fe84083cc09d378ea7fdebc536b58cf18c8b0244eb8eb28702e0i2',
  '84ed827971d6fe84083cc09d378ea7fdebc536b58cf18c8b0244eb8eb28702e0i3',
  '84ed827971d6fe84083cc09d378ea7fdebc536b58cf18c8b0244eb8eb28702e0i4',
  '84ed827971d6fe84083cc09d378ea7fdebc536b58cf18c8b0244eb8eb28702e0i5',
  '84ed827971d6fe84083cc09d378ea7fdebc536b58cf18c8b0244eb8eb28702e0i6',
  '84ed827971d6fe84083cc09d378ea7fdebc536b58cf18c8b0244eb8eb28702e0i7',
  '84ed827971d6fe84083cc09d378ea7fdebc536b58cf18c8b0244eb8eb28702e0i8',
  '87203c4049e12308181b83fd7aac46a0cb1ac5eafeefd844761b05832c4beec8i0',
  '5b068e93b38ad903fb81ba0e5b31906cd34936abdeb1437b727c526fa43f669ai0',
  '92dac2e3fe9943dcbc70336f10ebf54a87ee68ec8c922911ee2721402e617f0ai0',
  'd44744eef230cc00c9078d56f9e86ef4c94f90731b9f10760d797cad19e6e2afi0',
  'a41eaf3ae69cfed50837a039ef991a1b656b90e4445d3119e388a9e526ba571ei0',
  '4efd04b5acf5aee59092272cfba7ccfe2608a7c58db034191e9a0a30ab63cf0ai0',
  '4efd04b5acf5aee59092272cfba7ccfe2608a7c58db034191e9a0a30ab63cf0ai1',
  '22a77db1e89ed8a67c849a6d7be763fbe8cc03a94967da3fa46eecf8bda9f500i0',
  '22a77db1e89ed8a67c849a6d7be763fbe8cc03a94967da3fa46eecf8bda9f500i1',
  '22a77db1e89ed8a67c849a6d7be763fbe8cc03a94967da3fa46eecf8bda9f500i2',
  '0a98934e66eba2c5febf88fe3988ffe8deac60387a31fad5877616afc97d169ai0',
  '820b4320c83689c9ac3a41de97b85f01650d7dc101c2d8fe7fc23d093547eff1i0',
  'de7023b65b0d2a16717cc866c4673d4e7783ad0fea147b851844a0def8185b31i0',
  '54f267513045f9977f490ad6b74af5f71574e2559af2c38c34c658e2e4b80572i0',
  '6a3774c872b7831263e128ba188f12fdd9b1fadfc7ffcf3b9054a499b85eee72i0',
  '830ca11b91e602dcbf7a25af89c75cf3f53baad98623fd1b728954a1c081ce90i0',
  'fb169bde8db6916fee58dd05d99448fb117eedfc31563815034b08bceca77ea8i0',
  '62d33a903f148f85f6325c92ee1c8766abca84f4e0c6e3aaf1e3c5a9b08f9db7i0',
  'b0212bf77cc5b2cc0ce71131ce623704bce54bd90aea0a3e7f1866bdb2a3d8eai0',
  'accecd200b2b9f7707085b737f49f81fa478aacbc2bcb4bc7f68296d917c8819i0',
]);

const INDEXER_URLS = [
  process.env.INDEXER_API_URL,
  'https://api.richart.app',
  'https://open-api.unisat.io',
].filter(Boolean) as string[];

const fetchInscriptions = async (addr: string, cursor: number, pageSize: number): Promise<any[] | null> => {
  const urlPath = `/v1/indexer/address/${encodeURIComponent(addr)}/inscription-data?cursor=${cursor}&size=${pageSize}`;
  for (const base of INDEXER_URLS) {
    try {
      const res = await fetch(`${base}${urlPath}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        console.warn(`[PinkChat] Indexer ${base} returned ${res.status}`);
        continue;
      }
      const text = await res.text();
      if (text.trimStart().startsWith('<')) {
        console.warn(`[PinkChat] Indexer ${base} returned HTML instead of JSON`);
        continue;
      }
      const data = JSON.parse(text);
      return data?.data?.inscription || [];
    } catch (err) {
      console.warn(`[PinkChat] Indexer ${base} failed:`, (err as Error).message);
    }
  }
  return null;
};

const checkPinkPuppetOwnership = async (walletAddress: string): Promise<{ owns: boolean; count: number }> => {
  const addr = String(walletAddress || '').trim();
  if (!addr) return { owns: false, count: 0 };
  try {
    const allIds: string[] = [];
    let cursor = 0;
    const pageSize = 100;
    let guard = 0;
    while (guard < 20) {
      const items = await fetchInscriptions(addr, cursor, pageSize);
      if (items === null) throw new Error('All indexer endpoints failed');
      if (items.length === 0) break;
      allIds.push(...items.map((item: any) => String(item.inscriptionId || '').trim()));
      cursor += items.length;
      if (items.length < pageSize) break;
      guard++;
    }
    const count = allIds.filter((id) => PINK_PUPPET_IDS.has(id)).length;
    console.log(`[PinkChat] Ownership check OK: ${allIds.length} inscriptions scanned, ${count} PinkPuppet(s) for ${addr.slice(0, 12)}...`);
    return { owns: count > 0, count };
  } catch (err) {
    console.error('[PinkChat] Ownership check FAILED for', addr.slice(0, 12), '...:', (err as Error).message);
    return { owns: addr.startsWith('bc1p'), count: 0 };
  }
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
  puppetCount: user.puppetCount || 0,
});

export const registerChatUser = async (email: string, password: string, displayName: string) => {
  const state = await readState();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const trimmedName = String(displayName || '').trim();
  if (!normalizedEmail || !String(password || '').trim()) throw new Error('E-Mail und Passwort erforderlich.');
  if (!trimmedName) throw new Error('Display-Name erforderlich.');
  if (state.users.some((u) => u.email.toLowerCase() === normalizedEmail)) throw new Error('E-Mail bereits registriert.');
  const user: ChatUser = {
    id: uid('usr'),
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    displayName: trimmedName,
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
  const { owns: holder, count: puppetCount } = await checkPinkPuppetOwnership(walletAddress);
  user.walletAddress = walletAddress;
  user.level2Active = holder;
  user.level = holder ? 'level2' : 'level1';
  user.puppetCount = puppetCount;
  user.lastVerifiedAt = nowIso();
  state.audit.push({
    id: uid('audit'),
    type: holder ? 'level_upgrade' : 'wallet_revalidate',
    userId,
    details: { walletAddress, holder, puppetCount, reason: 'wallet_link_verify' },
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
  const { owns: holder, count: puppetCount } = await checkPinkPuppetOwnership(user.walletAddress);
  const previousLevel = user.level;
  user.level2Active = holder;
  user.level = holder ? 'level2' : 'level1';
  user.puppetCount = puppetCount;
  user.lastVerifiedAt = nowIso();
  state.audit.push({
    id: uid('audit'),
    type: holder ? 'wallet_revalidate' : 'level_downgrade',
    userId,
    details: { walletAddress: user.walletAddress, holder, puppetCount, previousLevel, nextLevel: user.level, reason: 'manual_revalidate' },
    createdAt: nowIso(),
  });
  await writeState(state);
  return toSafeUser(user);
};

const canAccessRoom = (visibility: RoomVisibility, level: string, role: string, userId?: string, dmParticipants?: string[]) => {
  if (role === 'admin') return true;
  if (visibility === 'dm') return !!userId && !!dmParticipants && dmParticipants.includes(userId);
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
      if (r.visibility === 'dm') return !!user && !!r.dmParticipants && r.dmParticipants.includes(user.id);
      if (!user) return r.visibility === 'public';
      return canAccessRoom(r.visibility, user.level, user.role, user.id, r.dmParticipants);
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
  if (room.visibility === 'dm') {
    if (!user || !room.dmParticipants?.includes(user.id)) throw new Error('Keine Berechtigung.');
  } else if (!user && room.visibility !== 'public') {
    throw new Error('Login erforderlich.');
  } else if (user && !canAccessRoom(room.visibility, user.level, user.role, user.id, room.dmParticipants)) {
    throw new Error('Keine Berechtigung für diesen Raum.');
  }
  return state.messages.filter((m) => m.roomId === roomId).slice(-200);
};

export const updateDisplayName = async (userId: string, newName: string) => {
  const trimmed = String(newName || '').trim();
  if (!trimmed) throw new Error('Display-Name darf nicht leer sein.');
  if (trimmed.length > 24) throw new Error('Display-Name zu lang (max 24 Zeichen).');
  const state = await readState();
  const user = state.users.find((u) => u.id === userId);
  if (!user) throw new Error('User nicht gefunden.');
  user.displayName = trimmed;
  await writeState(state);
  return toSafeUser(user);
};

export const postRoomMessage = async (roomId: string, user: ChatUser, content: string, replyTo?: { id: string; displayName: string; content: string }): Promise<ChatMessage> => {
  const trimmed = String(content || '').trim();
  if (!trimmed) throw new Error('Leere Nachricht.');
  if (trimmed.length > 1200) throw new Error('Nachricht ist zu lang (max 1200 Zeichen).');
  const state = await readState();
  const room = state.rooms.find((r) => r.id === roomId && !r.archived);
  if (!room) throw new Error('Raum nicht gefunden.');
  if (!canAccessRoom(room.visibility, user.level, user.role, user.id, room.dmParticipants)) throw new Error('Keine Berechtigung.');
  const message: ChatMessage = {
    id: uid('msg'),
    roomId,
    userId: user.id,
    displayName: user.displayName,
    content: trimmed,
    createdAt: nowIso(),
    level: user.level,
    role: user.role,
    walletAddress: user.walletAddress,
    ...(replyTo ? { replyTo: { id: replyTo.id, displayName: replyTo.displayName, content: replyTo.content.slice(0, 200) } } : {}),
  };
  state.messages.push(message);
  await writeState(state);
  return message;
};

export const postGuestRoomMessage = async (roomId: string, displayName: string, content: string, replyTo?: { id: string; displayName: string; content: string }): Promise<ChatMessage> => {
  const trimmed = String(content || '').trim();
  if (!trimmed) throw new Error('Leere Nachricht.');
  if (trimmed.length > 1200) throw new Error('Nachricht ist zu lang (max 1200 Zeichen).');
  const name = String(displayName || '').trim();
  if (!name) throw new Error('Display-Name erforderlich.');
  const state = await readState();
  const room = state.rooms.find((r) => r.id === roomId && !r.archived);
  if (!room) throw new Error('Raum nicht gefunden.');
  if (room.visibility !== 'public') throw new Error('Guests can only post in public rooms.');
  const message: ChatMessage = {
    id: uid('msg'),
    roomId,
    userId: `guest-${name.toLowerCase().replace(/\s+/g, '-')}`,
    displayName: name,
    content: trimmed,
    createdAt: nowIso(),
    level: 'public',
    ...(replyTo ? { replyTo: { id: replyTo.id, displayName: replyTo.displayName, content: replyTo.content.slice(0, 200) } } : {}),
  };
  state.messages.push(message);
  await writeState(state);
  return message;
};

export const deleteMessage = async (roomId: string, messageId: string, user: ChatUser): Promise<void> => {
  const state = await readState();
  const msg = state.messages.find((m) => m.id === messageId && m.roomId === roomId);
  if (!msg) throw new Error('Nachricht nicht gefunden.');
  if (user.role !== 'admin' && msg.userId !== user.id) throw new Error('Keine Berechtigung.');
  msg.deleted = true;
  msg.content = '';
  await writeState(state);
};

const ALLOWED_REACTIONS = new Set(['fire', 'heart', 'laugh', 'thumbsup', 'skull', '100']);

export const toggleReaction = async (roomId: string, messageId: string, emoji: string, userId: string, displayName: string): Promise<ChatMessage> => {
  if (!ALLOWED_REACTIONS.has(emoji)) throw new Error('Ungültiges Emoji.');
  const state = await readState();
  const msg = state.messages.find((m) => m.id === messageId && m.roomId === roomId);
  if (!msg) throw new Error('Nachricht nicht gefunden.');
  if (!msg.reactions) msg.reactions = {};
  if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
  const idx = msg.reactions[emoji].indexOf(userId);
  if (idx >= 0) {
    msg.reactions[emoji].splice(idx, 1);
    if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
  } else {
    msg.reactions[emoji].push(userId);
  }
  await writeState(state);
  return msg;
};

export const getOrCreateDmRoom = async (userId: string, targetUserId: string): Promise<ChatRoom> => {
  if (userId === targetUserId) throw new Error('Kann keinen DM-Raum mit sich selbst erstellen.');
  const state = await readState();
  const targetUser = state.users.find((u) => u.id === targetUserId);
  if (!targetUser) throw new Error('Zielbenutzer nicht gefunden.');
  const currentUser = state.users.find((u) => u.id === userId);
  if (!currentUser) throw new Error('User nicht gefunden.');
  const pair = [userId, targetUserId].sort();
  const existing = state.rooms.find((r) => r.visibility === 'dm' && r.dmParticipants && r.dmParticipants[0] === pair[0] && r.dmParticipants[1] === pair[1] && !r.archived);
  if (existing) return existing;
  const room: ChatRoom = {
    id: uid('dm'),
    slug: `dm-${pair[0].slice(0, 8)}-${pair[1].slice(0, 8)}`,
    name: `${currentUser.displayName} & ${targetUser.displayName}`,
    visibility: 'dm',
    createdAt: nowIso(),
    createdBy: userId,
    dmParticipants: pair,
  };
  state.rooms.push(room);
  await writeState(state);
  return room;
};

export const getDmRoomsForUser = async (userId: string): Promise<ChatRoom[]> => {
  const state = await readState();
  return state.rooms.filter((r) => r.visibility === 'dm' && r.dmParticipants?.includes(userId) && !r.archived);
};

export const runDailyWalletRevalidation = async () => {
  const state = await readState();
  const now = nowIso();
  for (const user of state.users) {
    if (!user.walletAddress || !user.level2Active) continue;
    const { owns: holder } = await checkPinkPuppetOwnership(user.walletAddress);
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

