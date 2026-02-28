export interface BadCatsLogEntry {
  id: string;
  walletAddress: string;
  itemIndex: number;
  inscriptionId: string;
  paymentTxid?: string;
  isFree: boolean;
  timestamp: number;
}

export interface BadCatsWhitelistEntry {
  address: string;
  count: number;
}

export interface BadCatsData {
  logs: BadCatsLogEntry[];
  hashlist: string[];
  whitelistAddresses: BadCatsWhitelistEntry[];
  freeMintUsed: Record<string, number>;
}
