import express from 'express';
import {
  addFreeStuffLog,
  getFreeStuffLogs,
  getRecentFreeStuffLogs,
  getFreeStuffMintCount,
  getFreeStuffStorageInfo,
} from '../services/freeStuff';

const router = express.Router();

// ── POST /api/free-stuff/log ──
router.post('/log', async (req, res) => {
  try {
    const { walletAddress, inscriptionId } = req.body || {};
    if (!walletAddress || !inscriptionId) {
      return res.status(400).json({ error: 'walletAddress and inscriptionId required' });
    }
    await addFreeStuffLog(req.body);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[FreeStuff] Log error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/free-stuff/logs ──
router.get('/logs', async (_req, res) => {
  try {
    res.json({ logs: await getFreeStuffLogs() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/free-stuff/recent ──
// Frontend (FreeStuffPage) erwartet { recent: [...] }
router.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    res.json({ recent: await getRecentFreeStuffLogs(limit) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/free-stuff/count ──
router.get('/count', async (_req, res) => {
  try {
    res.json({ totalMints: await getFreeStuffMintCount() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/free-stuff/storage-info ──
router.get('/storage-info', async (_req, res) => {
  try {
    res.json(getFreeStuffStorageInfo());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
