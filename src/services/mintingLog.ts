import { Card } from '../types/wallet';

export interface MintingLogEntry {
  id: string;
  walletAddress: string;
  packId: string;
  packName: string;
  cards: Card[];
  inscriptionIds: string[];
  txids: string[];
  timestamp: number;
  paymentTxid?: string;
}

const INSCRIPTION_API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';
const LOG_STORAGE_KEY = 'minting_logs';

/**
 * Speichert einen Minting-Log-Eintrag
 */
export const logMinting = async (entry: Omit<MintingLogEntry, 'id' | 'timestamp'>): Promise<void> => {
  const logEntry: MintingLogEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
  };

  // 1. Versuche Backend
  try {
    await fetch(`${INSCRIPTION_API_URL}/api/minting/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logEntry),
    });
  } catch (error) {
    console.warn('Backend-Logging fehlgeschlagen, verwende LocalStorage:', error);
  }

  // 2. LocalStorage als Fallback/Backup
  try {
    const existingLogs = getLocalLogs();
    const updatedLogs = [logEntry, ...existingLogs];
    
    // Speichere nur die letzten 1000 Einträge
    const logsToSave = updatedLogs.slice(0, 1000);
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logsToSave));
  } catch (error) {
    console.error('LocalStorage-Logging fehlgeschlagen:', error);
  }
};

/**
 * Lädt Logs aus LocalStorage
 */
export const getLocalLogs = (): MintingLogEntry[] => {
  try {
    const stored = localStorage.getItem(LOG_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

/**
 * Lädt Logs für eine Wallet-Adresse
 */
export const getWalletLogs = async (walletAddress: string): Promise<MintingLogEntry[]> => {
  // 1. Versuche Backend
  try {
    const response = await fetch(`${INSCRIPTION_API_URL}/api/minting/logs/${walletAddress}`);
    if (response.ok) {
      const data = await response.json();
      return data.logs || [];
    }
  } catch (error) {
    console.warn('Backend-Abfrage fehlgeschlagen, verwende LocalStorage:', error);
  }

  // 2. LocalStorage als Fallback
  const allLogs = getLocalLogs();
  return allLogs.filter(log => log.walletAddress.toLowerCase() === walletAddress.toLowerCase());
};

/**
 * Exportiert alle Logs als JSON
 */
export const exportLogs = (): void => {
  const logs = getLocalLogs();
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `minting-logs-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

