export interface BadCatsLogEntry {
  id: string;
  walletAddress: string;
  itemIndex: number;
  inscriptionId: string;
  paymentTxid?: string;
  isFree: boolean;
  timestamp: number;
}

export interface BadCatsData {
  logs: BadCatsLogEntry[];
  hashlist: string[];
  whitelistAddresses: string[];
  freeMintUsed: Record<string, number>;
}
