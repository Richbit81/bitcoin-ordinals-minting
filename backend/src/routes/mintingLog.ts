import express from 'express';
import { saveMintingLog, getWalletLogs } from '../services/mintingLog';

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

export default router;








