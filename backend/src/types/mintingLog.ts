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
  orderId?: string;
  originalOrderId?: string;
  inscriptionId?: string;
  originalInscriptionId?: string | null;
  originalPendingInscriptionId?: string | null;
  resolvedAt?: string;
  pendingResolvedMap?: Record<string, string>;
}

export interface MintingResolutionAuditEntry {
  pendingInscriptionId: string;
  finalInscriptionId: string;
  walletAddress?: string;
  orderId?: string;
  sourceLogId?: string;
  resolvedAt: string;
}

export interface MintingLogState {
  logs: MintingLogEntry[];
  pendingToFinalMap: Record<string, string>;
  resolutionAudit: MintingResolutionAuditEntry[];
}








