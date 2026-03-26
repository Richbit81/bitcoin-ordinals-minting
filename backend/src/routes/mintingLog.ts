import express from 'express';
import {
  saveMintingLog,
  getWalletLogs,
  getAllLogs,
  getPendingToFinalMap,
  getResolutionAudit,
  getOpenPendingIds,
} from '../services/mintingLog';

const router = express.Router();

/**
 * POST /api/minting/log
 * Speichert einen Minting-Log-Eintrag
 */
router.post('/log', async (req, res) => {
  try {
    const logEntry = req.body;
    await saveMintingLog(logEntry);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Fehler beim Speichern des Minting-Logs:', error);
    res.status(500).json({ error: error.message || 'Fehler beim Speichern des Logs' });
  }
});

/**
 * GET /api/minting/logs/:address
 * Lädt Logs für eine Wallet-Adresse
 */
router.get('/logs/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const logs = await getWalletLogs(address);
    res.json({ logs });
  } catch (error: any) {
    console.error('Fehler beim Laden der Minting-Logs:', error);
    res.status(500).json({ error: error.message || 'Fehler beim Laden der Logs' });
  }
});

/**
 * GET /api/minting/pending/open?address=...
 * Listet offene pending-IDs (ohne finale Zuordnung) auf
 */
router.get('/pending/open', async (req, res) => {
  try {
    const address = String(req.query.address || '').trim();
    const pendingIds = await getOpenPendingIds(address || undefined);
    res.json({ pendingIds, count: pendingIds.length, walletAddress: address || null });
  } catch (error: any) {
    console.error('Fehler beim Laden offener pending IDs:', error);
    res.status(500).json({ error: error.message || 'Fehler beim Laden offener pending IDs' });
  }
});

/**
 * GET /api/minting/resolved-ids
 * Liefert persistente pending->final Zuordnungen + Audit
 */
router.get('/resolved-ids', async (_req, res) => {
  try {
    const [pendingToFinalMap, resolutionAudit] = await Promise.all([
      getPendingToFinalMap(),
      getResolutionAudit(),
    ]);
    res.json({
      pendingToFinalMap,
      resolutionAudit,
      totalMappings: Object.keys(pendingToFinalMap).length,
      totalAuditRows: resolutionAudit.length,
    });
  } catch (error: any) {
    console.error('Fehler beim Laden resolved IDs:', error);
    res.status(500).json({ error: error.message || 'Fehler beim Laden resolved IDs' });
  }
});

/**
 * GET /api/minting/resolved-ids/export
 * Download als resolved-ids.json
 */
router.get('/resolved-ids/export', async (_req, res) => {
  try {
    const [pendingToFinalMap, resolutionAudit] = await Promise.all([
      getPendingToFinalMap(),
      getResolutionAudit(),
    ]);
    const payload = {
      exportedAt: new Date().toISOString(),
      pendingToFinalMap,
      resolutionAudit,
    };
    const filename = `resolved-ids-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(payload);
  } catch (error: any) {
    console.error('Fehler beim Export resolved IDs:', error);
    res.status(500).json({ error: error.message || 'Fehler beim Export resolved IDs' });
  }
});

/**
 * GET /api/minting/export
 * Exportiert ALLE Logs als JSON-Download (Backup vor Deploy!)
 */
router.get('/export', async (req, res) => {
  try {
    const logs = await getAllLogs();
    const filename = `minting-logs-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(logs);
  } catch (error: any) {
    console.error('Fehler beim Export der Minting-Logs:', error);
    res.status(500).json({ error: error.message || 'Fehler beim Export' });
  }
});

export default router;








