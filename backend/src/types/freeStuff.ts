export interface FreeStuffLogEntry {
  id?: string;
  walletAddress: string;
  itemName: string;
  inscriptionId: string;
  originalInscriptionId?: string;
  txid?: string;
  priceInSats?: number;
  timestamp: string | number;
}

export interface FreeStuffData {
  logs: FreeStuffLogEntry[];
}
