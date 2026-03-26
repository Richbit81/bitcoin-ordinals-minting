export type ChatLevel = 'public' | 'level1' | 'level2';
export type ChatRole = 'member' | 'admin';
export type RoomVisibility = 'public' | 'level1' | 'level2' | 'admin';

export interface ChatUser {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  level: ChatLevel;
  role: ChatRole;
  walletAddress?: string;
  level2Active?: boolean;
  lastVerifiedAt?: string | null;
  createdAt: string;
}

export interface ChatSession {
  token: string;
  userId: string;
  createdAt: string;
}

export interface WalletChallenge {
  userId: string;
  walletAddress: string;
  nonce: string;
  createdAt: string;
}

export interface ChatRoom {
  id: string;
  slug: string;
  name: string;
  visibility: RoomVisibility;
  description?: string;
  archived?: boolean;
  createdAt: string;
  createdBy: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  content: string;
  createdAt: string;
}

export interface ChatAuditLog {
  id: string;
  type: 'level_downgrade' | 'level_upgrade' | 'admin_action' | 'wallet_revalidate';
  userId?: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface PinkChatState {
  users: ChatUser[];
  sessions: ChatSession[];
  walletChallenges: WalletChallenge[];
  rooms: ChatRoom[];
  messages: ChatMessage[];
  audit: ChatAuditLog[];
}

