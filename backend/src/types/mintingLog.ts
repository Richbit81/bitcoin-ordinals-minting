// Backend Types für Minting Logs
export interface MintingLogEntry {
  id: string;
  walletAddress: string;
  packId: string;
  packName: string;
  cards: Array<{
    id: string;
    name: string;
    rarity: string;
    inscriptionId: string;
  }>;
  inscriptionIds: string[];
  txids: string[];
  timestamp: number;
  paymentTxid?: string;
}








