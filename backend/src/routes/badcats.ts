import express from 'express';
import {
  addLog, getLogs, getRecentLogs, getLogsByAddress,
  getMintCount, getMintedIndices,
  getHashlist, addToHashlist, syncHashlistFromLogs,
  getWhitelistAddresses, getWhitelistEntries, getWhitelistMintAllowance, addWhitelistAddress, setWhitelistAddressCount, removeWhitelistAddress, replaceWhitelistEntries,
  getFreeMintUsed, recordFreeMintUsed,
  getBadCatsStorageInfo,
} from '../services/badcats';

const router = express.Router();
const ORDINAL_INSCRIPTION_ID_RE = /^[0-9a-f]{64}i\d+$/i;

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
    const rawIds = Array.isArray(req.body?.inscriptionIds)
      ? req.body.inscriptionIds
      : (typeof req.body?.inscriptionId === 'string' ? [req.body.inscriptionId] : []);
    const inscriptionIds = rawIds
      .map((id: unknown) => String(id || '').trim())
      .filter(Boolean);
    if (inscriptionIds.length === 0) return res.status(400).json({ error: 'inscriptionIds array or inscriptionId required' });
    const validInscriptionIds = inscriptionIds.filter(id => ORDINAL_INSCRIPTION_ID_RE.test(id));
    const ignored = inscriptionIds.length - validInscriptionIds.length;
    if (validInscriptionIds.length > 0) {
      await addToHashlist(validInscriptionIds);
    }
    res.json({ success: true, added: validInscriptionIds.length, ignored });
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

// ── GET /api/badcats/whitelist-addresses/download ──
router.get('/whitelist-addresses/download', async (_req, res) => {
  try {
    const [addresses, entries] = await Promise.all([
      getWhitelistAddresses(),
      getWhitelistEntries(),
    ]);
    const count = entries.reduce((sum, entry) => sum + Math.max(1, Number(entry.count || 1)), 0);
    res.json({
      addresses,
      entries,
      exportedAt: new Date().toISOString(),
      count,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/badcats/whitelist-addresses ──
router.post('/whitelist-addresses', async (req, res) => {
  try {
    const { address, count, setExact } = req.body;
    if (!address) return res.status(400).json({ error: 'address required' });
    const parsedCount = Number(count);
    if (!Number.isFinite(parsedCount) || parsedCount < 1) {
      return res.status(400).json({ error: 'count must be >= 1' });
    }
    const newCount = setExact
      ? await setWhitelistAddressCount(address, parsedCount)
      : await addWhitelistAddress(address, parsedCount);
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

// ── POST /api/badcats/whitelist-addresses/import ──
router.post('/whitelist-addresses/import', async (req, res) => {
  try {
    const incoming = Array.isArray(req.body?.addresses) ? req.body.addresses : null;
    if (!incoming) return res.status(400).json({ error: 'addresses array required' });

    const normalizedIncoming = incoming
      .map((raw: unknown) => String(raw || '').trim())
      .filter(Boolean);

    if (normalizedIncoming.length === 0) {
      return res.status(400).json({ error: 'no valid addresses provided' });
    }

    const existing = await getWhitelistEntries();
    const merged = new Map<string, { address: string; count: number }>();
    for (const entry of existing) {
      const address = String(entry.address || '').trim();
      if (!address) continue;
      merged.set(address.toLowerCase(), {
        address,
        count: Math.max(1, Math.floor(Number(entry.count || 1))),
      });
    }

    let added = 0;
    let skipped = 0;
    for (const address of normalizedIncoming) {
      const key = address.toLowerCase();
      if (merged.has(key)) {
        skipped += 1;
        continue;
      }
      merged.set(key, { address, count: 1 });
      added += 1;
    }

    await replaceWhitelistEntries([...merged.values()]);
    res.json({ success: true, added, skipped, total: merged.size });
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

// ── GET /api/badcats/storage-info ──
router.get('/storage-info', async (_req, res) => {
  try {
    res.json(getBadCatsStorageInfo());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
