import express from 'express';
import {
  createRoom,
  getRoomMessages,
  getRoomsForUser,
  getUserByToken,
  invalidateToken,
  loginChatUser,
  postRoomMessage,
  registerChatUser,
  revalidateWalletForUser,
  runDailyWalletRevalidation,
  startWalletLink,
  toSafeUser,
  verifyWalletLink,
} from '../services/pinkChat';
import { checkRateLimit } from '../services/pinkChatRateLimit';

const router = express.Router();

const sanitizeText = (value: unknown) => String(value || '').replace(/\u0000/g, '').trim();

const getBearerToken = (req: express.Request): string => {
  const auth = String(req.headers.authorization || '').trim();
  if (!auth.toLowerCase().startsWith('bearer ')) return '';
  return auth.slice(7).trim();
};

const authRequired = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: 'Auth required' });
    const user = await getUserByToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid session' });
    (req as any).chatUser = user;
    (req as any).chatToken = token;
    next();
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Auth middleware failed' });
  }
};

router.post('/auth/register', async (req, res) => {
  try {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(`register:${ip}`, 12, 15 * 60 * 1000)) return res.status(429).json({ error: 'Too many register attempts' });
    const email = sanitizeText(req.body?.email).toLowerCase();
    const password = String(req.body?.password || '');
    const displayName = sanitizeText(req.body?.displayName);
    const session = await registerChatUser(email, password, displayName);
    res.json(session);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Register failed' });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(`login:${ip}`, 20, 15 * 60 * 1000)) return res.status(429).json({ error: 'Too many login attempts' });
    const email = sanitizeText(req.body?.email).toLowerCase();
    const password = String(req.body?.password || '');
    const session = await loginChatUser(email, password);
    res.json(session);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Login failed' });
  }
});

router.get('/auth/me', authRequired, async (req, res) => {
  res.json(toSafeUser((req as any).chatUser));
});

router.post('/auth/logout', authRequired, async (req, res) => {
  await invalidateToken((req as any).chatToken);
  res.json({ success: true });
});

router.post('/wallet/link/start', authRequired, async (req, res) => {
  try {
    const user = (req as any).chatUser;
    const walletAddress = sanitizeText(req.body?.walletAddress);
    if (!walletAddress) return res.status(400).json({ error: 'walletAddress required' });
    const data = await startWalletLink(user.id, walletAddress);
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Wallet link start failed' });
  }
});

router.post('/wallet/link/verify', authRequired, async (req, res) => {
  try {
    const user = (req as any).chatUser;
    const walletAddress = sanitizeText(req.body?.walletAddress);
    const signature = String(req.body?.signature || '').trim();
    const updated = await verifyWalletLink(user.id, walletAddress, signature);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Wallet link verify failed' });
  }
});

router.post('/wallet/revalidate', authRequired, async (req, res) => {
  try {
    const user = (req as any).chatUser;
    const updated = await revalidateWalletForUser(user.id);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Revalidate failed' });
  }
});

router.post('/wallet/revalidate/daily', async (_req, res) => {
  try {
    await runDailyWalletRevalidation();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Daily revalidation failed' });
  }
});

router.get('/chat/rooms', async (req, res) => {
  try {
    const token = getBearerToken(req);
    const user = token ? await getUserByToken(token) : null;
    const rooms = await getRoomsForUser(user);
    res.json(rooms);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Rooms failed' });
  }
});

router.get('/chat/rooms/:roomId/messages', async (req, res) => {
  try {
    const token = getBearerToken(req);
    const user = token ? await getUserByToken(token) : null;
    const messages = await getRoomMessages(String(req.params.roomId), user);
    res.json(messages);
  } catch (err: any) {
    res.status(403).json({ error: err?.message || 'Messages failed' });
  }
});

router.post('/chat/rooms/:roomId/messages', authRequired, async (req, res) => {
  try {
    const user = (req as any).chatUser;
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(`msg:${user.id}:${ip}`, 20, 60 * 1000)) return res.status(429).json({ error: 'Too many messages' });
    const content = sanitizeText(req.body?.content);
    const message = await postRoomMessage(String(req.params.roomId), user, content);
    res.json(message);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Post message failed' });
  }
});

router.post('/admin/chat/rooms', authRequired, async (req, res) => {
  try {
    const user = (req as any).chatUser;
    const room = await createRoom(user, {
      name: sanitizeText(req.body?.name),
      slug: sanitizeText(req.body?.slug).toLowerCase(),
      description: sanitizeText(req.body?.description),
      visibility: String(req.body?.visibility || 'level1') as any,
    });
    res.json(room);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Create room failed' });
  }
});

export default router;

