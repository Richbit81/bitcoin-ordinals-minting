export type PinkChatLevel = 'public' | 'level1' | 'level2';

export type PinkChatRole = 'member' | 'admin';

export interface PinkChatUser {
  id: string;
  email: string;
  displayName: string;
  level: PinkChatLevel;
  role: PinkChatRole;
  walletAddress?: string;
  level2Active?: boolean;
  lastVerifiedAt?: string | null;
  createdAt?: string;
  puppetCount?: number;
}

export interface PinkChatSession {
  token: string;
  user: PinkChatUser;
}

export interface PinkChatRoom {
  id: string;
  slug: string;
  name: string;
  visibility: 'open' | 'public' | 'level1' | 'level2' | 'admin';
  description?: string;
  archived?: boolean;
  createdAt?: string;
  createdBy?: string;
}

export interface PinkChatMessage {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  content: string;
  createdAt: string;
}

export interface PinkChatWalletLinkStartResponse {
  nonce: string;
  message: string;
}

