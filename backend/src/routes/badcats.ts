import express from 'express';
import {
  addLog, getLogs, getRecentLogs, getLogsByAddress,
  getMintCount, getMintedIndices,
  getHashlist, addToHashlist, syncHashlistFromLogs,
  getWhitelistAddresses, getWhitelistEntries, getWhitelistMintAllowance, addWhitelistAddress, setWhitelistAddressCount, removeWhitelistAddress,
  getFreeMintUsed, recordFreeMintUsed,
} from '../services/badcats';

const router = express.Router();

// ── POST /api/badcats/log ──
router.post('/log', async (req, res) => {
  try {
    await addLog(req.body);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[BadCats] Log error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/badcats/logs ──
router.get('/logs', async (_req, res) => {
  try {
    res.json({ logs: await getLogs() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/badcats/recent ──
router.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    res.json({ mints: await getRecentLogs(limit) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/badcats/count ──
router.get('/count', async (_req, res) => {
  try {
    res.json({ totalMints: await getMintCount() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/badcats/minted-indices ──
router.get('/minted-indices', async (_req, res) => {
  try {
    res.json({ mintedIndices: await getMintedIndices() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/badcats/address-mints?address=... ──
router.get('/address-mints', async (req, res) => {
  try {
    const address = req.query.address as string;
    if (!address) return res.status(400).json({ error: 'address required' });
    const freeMints = await getFreeMintUsed(address);
    const logs = await getLogsByAddress(address);
    res.json({ freeMints, totalMints: logs.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/badcats/free-mint-used ──
router.post('/free-mint-used', async (req, res) => {
  try {
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: 'address required' });
    const count = await recordFreeMintUsed(address);
    res.json({ success: true, freeMints: count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/badcats/hashlist ──
router.get('/hashlist', async (_req, res) => {
  try {
    res.json({ hashlist: await getHashlist() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/badcats/hashlist ──
router.post('/hashlist', async (req, res) => {
  try {
    const { inscriptionIds } = req.body;
    if (!Array.isArray(inscriptionIds)) return res.status(400).json({ error: 'inscriptionIds array required' });
    await addToHashlist(inscriptionIds);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/badcats/hashlist/sync ──
router.post('/hashlist/sync', async (_req, res) => {
  try {
    const added = await syncHashlistFromLogs();
    res.json({ success: true, added });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/badcats/whitelist-addresses ──
router.get('/whitelist-addresses', async (_req, res) => {
  try {
    const [addresses, entries] = await Promise.all([
      getWhitelistAddresses(),
      getWhitelistEntries(),
    ]);
    res.json({ addresses, entries });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/badcats/whitelist-addresses ──
router.post('/whitelist-addresses', async (req, res) => {
  try {
    const { address, count } = req.body;
    if (!address) return res.status(400).json({ error: 'address required' });
    const newCount = await addWhitelistAddress(address, count);
    res.json({ success: true, count: newCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/badcats/whitelist-addresses ──
router.put('/whitelist-addresses', async (req, res) => {
  try {
    const { address, count } = req.body;
    if (!address) return res.status(400).json({ error: 'address required' });
    const parsedCount = Number(count);
    if (!Number.isFinite(parsedCount) || parsedCount < 1) {
      return res.status(400).json({ error: 'count must be >= 1' });
    }
    const updatedCount = await setWhitelistAddressCount(address, parsedCount);
    res.json({ success: true, count: updatedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/badcats/whitelist-addresses ──
router.delete('/whitelist-addresses', async (req, res) => {
  try {
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: 'address required' });
    const removed = await removeWhitelistAddress(address);
    if (!removed) return res.status(404).json({ error: 'Address not found' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/badcats/whitelist-allowance?address=... ──
router.get('/whitelist-allowance', async (req, res) => {
  try {
    const address = req.query.address as string;
    if (!address) return res.status(400).json({ error: 'address required' });
    const allowance = await getWhitelistMintAllowance(address);
    res.json({ allowance });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
