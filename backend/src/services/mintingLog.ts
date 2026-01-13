// Minting Log Service - Backend
// Speichert Minting-Logs in einer Datei oder Datenbank

import fs from 'fs/promises';
import path from 'path';
import { MintingLogEntry } from '../../types/mintingLog';

const LOG_FILE_PATH = path.join(process.cwd(), 'data', 'minting-logs.json');

// Stelle sicher, dass das data-Verzeichnis existiert
const ensureDataDirectory = async () => {
  const dataDir = path.dirname(LOG_FILE_PATH);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
};

/**
 * Speichert einen Minting-Log-Eintrag
 */
export const saveMintingLog = async (entry: MintingLogEntry): Promise<void> => {
  await ensureDataDirectory();

  let logs: MintingLogEntry[] = [];

  try {
    const fileContent = await fs.readFile(LOG_FILE_PATH, 'utf-8');
    logs = JSON.parse(fileContent);
  } catch {
    // Datei existiert noch nicht oder ist leer
    logs = [];
  }

  logs.push(entry);

  // Speichere nur die letzten 10000 Einträge
  const logsToSave = logs.slice(-10000);

  await fs.writeFile(LOG_FILE_PATH, JSON.stringify(logsToSave, null, 2));
};

/**
 * Lädt Logs für eine Wallet-Adresse
 */
export const getWalletLogs = async (walletAddress: string): Promise<MintingLogEntry[]> => {
  await ensureDataDirectory();

  try {
    const fileContent = await fs.readFile(LOG_FILE_PATH, 'utf-8');
    const logs: MintingLogEntry[] = JSON.parse(fileContent);

    return logs.filter(
      log => log.walletAddress.toLowerCase() === walletAddress.toLowerCase()
    );
  } catch {
    return [];
  }
};

/**
 * Lädt alle Logs (Admin-Funktion)
 */
export const getAllLogs = async (): Promise<MintingLogEntry[]> => {
  await ensureDataDirectory();

  try {
    const fileContent = await fs.readFile(LOG_FILE_PATH, 'utf-8');
    return JSON.parse(fileContent);
  } catch {
    return [];
  }
};








