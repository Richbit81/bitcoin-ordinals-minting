// Minting Log Service - Backend
// Speichert Minting-Logs in einer Datei oder Datenbank

import fs from 'fs/promises';
import path from 'path';
import { MintingLogEntry } from '../../types/mintingLog';

// MINTING_LOG_PATH env variable setzen für persistenten Speicher (z.B. /var/data/minting-logs.json)
// Ohne env variable: Standard-Pfad im Projekt-Ordner (wird bei Deploy gelöscht!)
const LOG_FILE_PATH = process.env.MINTING_LOG_PATH
  ? path.resolve(process.env.MINTING_LOG_PATH)
  : path.join(process.cwd(), 'data', 'minting-logs.json');

console.log(`[MintingLog] Log-Pfad: ${LOG_FILE_PATH} ${process.env.MINTING_LOG_PATH ? '(persistent via env)' : '(Standard - NICHT persistent!)'}`);


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








