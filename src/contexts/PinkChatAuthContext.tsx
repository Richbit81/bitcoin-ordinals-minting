import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { checkPinkPuppetOwnership, pinkChatApi } from '../services/pinkChatService';
import { PinkChatSession, PinkChatUser } from '../types/pinkChat';

const STORAGE_KEY = 'pinkchat_session';
const LEGACY_SESSION_KEYS = ['pinkchat_session_v1', 'pinkchat_session_v2', 'pinkchat_session_v3', 'pinkchat_session_v4'];

type PinkChatAuthContextType = {
  user: PinkChatUser | null;
  token: string | null;
  loading: boolean;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  walletLogin: (walletAddress: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  verifyWallet: (walletAddress: string, signature?: string) => Promise<void>;
  revalidateWallet: () => Promise<void>;
  updateProfile: (data: { displayName?: string; avatarInscriptionId?: string }) => Promise<void>;
};

const PinkChatAuthContext = createContext<PinkChatAuthContextType | undefined>(undefined);

const saveSession = (session: PinkChatSession | null) => {
  if (!session) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

const loadSession = (): PinkChatSession | null => {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      for (const key of LEGACY_SESSION_KEYS) {
        const legacy = localStorage.getItem(key);
        if (legacy) {
          raw = legacy;
          localStorage.setItem(STORAGE_KEY, legacy);
          localStorage.removeItem(key);
          console.log(`[PinkChat] Migrated session from ${key}`);
          break;
        }
      }
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.user) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const PinkChatAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<PinkChatUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const existing = loadSession();
    if (existing) {
      setUser(existing.user);
      setToken(existing.token);
    }
    setLoading(false);
  }, []);

  const commitSession = useCallback((session: PinkChatSession | null) => {
    setUser(session?.user || null);
    setToken(session?.token || null);
    saveSession(session);
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const session = await pinkChatApi.register(email, password, displayName);
    commitSession(session);
  }, [commitSession]);

  const login = useCallback(async (email: string, password: string) => {
    const session = await pinkChatApi.login(email, password);
    commitSession(session);
  }, [commitSession]);

  const walletLogin = useCallback(async (walletAddress: string, displayName: string) => {
    const session = await pinkChatApi.walletLogin(walletAddress, displayName);
    commitSession(session);
  }, [commitSession]);

  const logout = useCallback(async () => {
    if (token) await pinkChatApi.logout(token);
    commitSession(null);
  }, [token, commitSession]);

  const refreshMe = useCallback(async () => {
    if (!token) return;
    const nextUser = await pinkChatApi.me(token);
    commitSession({ token, user: nextUser });
  }, [token, commitSession]);

  const verifyWallet = useCallback(async (walletAddress: string, signature?: string) => {
    if (!token) throw new Error('Please log in first.');
    const start = await pinkChatApi.walletLinkStart(token, walletAddress);
    const resolvedSignature = signature?.trim() || `wallet-proof:${start.nonce}:${walletAddress}`;
    const nextUser = await pinkChatApi.walletLinkVerify(token, walletAddress, resolvedSignature);
    try {
      const { count } = await checkPinkPuppetOwnership(walletAddress);
      if (count > (nextUser.puppetCount || 0)) {
        nextUser.puppetCount = count;
        if (count > 0) { nextUser.level2Active = true; nextUser.level = 'level2'; }
      }
    } catch { /* server count is used as fallback */ }
    commitSession({ token, user: nextUser });
  }, [token, commitSession]);

  const revalidateWallet = useCallback(async () => {
    if (!token) throw new Error('Not logged in.');
    const nextUser = await pinkChatApi.walletRevalidate(token);
    if (nextUser.walletAddress) {
      try {
        const { count } = await checkPinkPuppetOwnership(nextUser.walletAddress);
        if (count > (nextUser.puppetCount || 0)) {
          nextUser.puppetCount = count;
          if (count > 0) { nextUser.level2Active = true; nextUser.level = 'level2'; }
        }
      } catch { /* server count is used as fallback */ }
    }
    commitSession({ token, user: nextUser });
  }, [token, commitSession]);

  const updateProfile = useCallback(async (data: { displayName?: string; avatarInscriptionId?: string }) => {
    if (!token) throw new Error('Not logged in.');
    const nextUser = await pinkChatApi.updateMe(token, data);
    commitSession({ token, user: nextUser });
  }, [token, commitSession]);

  const value = useMemo(() => ({
    user,
    token,
    loading,
    register,
    login,
    walletLogin,
    logout,
    refreshMe,
    verifyWallet,
    revalidateWallet,
    updateProfile,
  }), [user, token, loading, register, login, walletLogin, logout, refreshMe, verifyWallet, revalidateWallet, updateProfile]);

  return <PinkChatAuthContext.Provider value={value}>{children}</PinkChatAuthContext.Provider>;
};

export const usePinkChatAuth = () => {
  const ctx = useContext(PinkChatAuthContext);
  if (!ctx) throw new Error('usePinkChatAuth must be used within PinkChatAuthProvider');
  return ctx;
};

