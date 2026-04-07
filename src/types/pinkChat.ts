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
  visibility: 'open' | 'public' | 'level1' | 'level2' | 'admin' | 'dm';
  description?: string;
  archived?: boolean;
  createdAt?: string;
  createdBy?: string;
  dmParticipants?: string[];
}

export interface PinkChatMessageReplyTo {
  id: string;
  displayName: string;
  content: string;
}

export interface PinkChatMessage {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  content: string;
  createdAt: string;
  level?: PinkChatLevel;
  role?: PinkChatRole;
  walletAddress?: string;
  replyTo?: PinkChatMessageReplyTo;
  reactions?: Record<string, string[]>;
  deleted?: boolean;
}

export interface PinkChatWalletLinkStartResponse {
  nonce: string;
  message: string;
}

