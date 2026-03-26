import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { pinkChatApi } from '../services/pinkChatService';
import { PinkChatSession, PinkChatUser } from '../types/pinkChat';

const STORAGE_KEY = 'pinkchat_session_v1';

type PinkChatAuthContextType = {
  user: PinkChatUser | null;
  token: string | null;
  loading: boolean;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  verifyWallet: (walletAddress: string, signature?: string) => Promise<void>;
  revalidateWallet: () => Promise<void>;
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
    const raw = localStorage.getItem(STORAGE_KEY);
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
    if (!token) throw new Error('Bitte zuerst einloggen.');
    const start = await pinkChatApi.walletLinkStart(token, walletAddress);
    const resolvedSignature = signature?.trim() || `wallet-proof:${start.nonce}:${walletAddress}`;
    const nextUser = await pinkChatApi.walletLinkVerify(token, walletAddress, resolvedSignature);
    commitSession({ token, user: nextUser });
  }, [token, commitSession]);

  const revalidateWallet = useCallback(async () => {
    if (!token) throw new Error('Nicht eingeloggt.');
    const nextUser = await pinkChatApi.walletRevalidate(token);
    commitSession({ token, user: nextUser });
  }, [token, commitSession]);

  const value = useMemo(() => ({
    user,
    token,
    loading,
    register,
    login,
    logout,
    refreshMe,
    verifyWallet,
    revalidateWallet,
  }), [user, token, loading, register, login, logout, refreshMe, verifyWallet, revalidateWallet]);

  return <PinkChatAuthContext.Provider value={value}>{children}</PinkChatAuthContext.Provider>;
};

export const usePinkChatAuth = () => {
  const ctx = useContext(PinkChatAuthContext);
  if (!ctx) throw new Error('usePinkChatAuth must be used within PinkChatAuthProvider');
  return ctx;
};

