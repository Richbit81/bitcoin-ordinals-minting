import { useCallback, useState } from 'react';

/**
 * Shared, browser-persisted practice wallet for the Ordinals learning app.
 *
 * Step 2 (WalletLabPage) creates it; Step 3 (InscribeLabPage) reuses it so a
 * learner doesn't have to recreate the wallet every time they want to practice
 * inscribing. Everything here is a simulation — no real keys, seed or funds.
 */

export const DEMO_INSCRIPTION_IMG = '/images/practice-inscription.png';

export type PracticeInscription = { txid: string; title: string; img: string };

export interface PracticeWallet {
  seed: string[];
  ordAddr: string;
  payAddr: string;
  balance: number;
  inscriptions: PracticeInscription[];
  createdAt: number;
}

const KEY = 'roe_practice_wallet_v1';

export const SEED_WORDS = [
  'apple', 'ocean', 'river', 'stone', 'tiger', 'cloud', 'ember', 'maple', 'north', 'quartz',
  'lemon', 'pixel', 'raven', 'solar', 'amber', 'cabin', 'delta', 'frost', 'grape', 'harbor',
  'ivory', 'jazz', 'koala', 'lunar', 'mango', 'nebula', 'orbit', 'panda', 'quiet', 'ripple',
  'satoshi', 'topaz', 'umbra', 'vivid', 'whale', 'xenon', 'yeti', 'zebra', 'bloom', 'cedar',
  'ridge', 'spark', 'timber', 'violet', 'willow', 'cosmos', 'dawn', 'flint',
];
const BECH = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

export function rand(n: number) { return Math.floor(Math.random() * n); }
export function randomSeed(count = 12): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(SEED_WORDS[rand(SEED_WORDS.length)]);
  return out;
}
export function fakeBech(prefix: string, len: number): string {
  let s = prefix;
  for (let i = 0; i < len; i++) s += BECH[rand(32)];
  return s;
}
export function fakeTxid(): string {
  const hx = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 64; i++) s += hx[rand(16)];
  return s;
}

export function loadPracticeWallet(): PracticeWallet | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const w = JSON.parse(raw);
    if (!w || !Array.isArray(w.seed) || typeof w.ordAddr !== 'string') return null;
    return { inscriptions: [], balance: 0, ...w } as PracticeWallet;
  } catch {
    return null;
  }
}

function persist(w: PracticeWallet | null) {
  try {
    if (w) localStorage.setItem(KEY, JSON.stringify(w));
    else localStorage.removeItem(KEY);
  } catch { /* ignore quota / private mode */ }
}

export function usePracticeWallet() {
  const [wallet, setWalletState] = useState<PracticeWallet | null>(() => loadPracticeWallet());

  const setWallet = useCallback((w: PracticeWallet | null) => { persist(w); setWalletState(w); }, []);

  const createWallet = useCallback(() => {
    const w: PracticeWallet = {
      seed: randomSeed(12),
      ordAddr: fakeBech('bc1p', 39),
      payAddr: fakeBech('bc1q', 34),
      balance: 0,
      inscriptions: [],
      createdAt: Date.now(),
    };
    persist(w);
    setWalletState(w);
    return w;
  }, []);

  const patchWallet = useCallback((fn: (w: PracticeWallet) => PracticeWallet) => {
    setWalletState((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      persist(next);
      return next;
    });
  }, []);

  const resetWallet = useCallback(() => { persist(null); setWalletState(null); }, []);

  return { wallet, setWallet, createWallet, patchWallet, resetWallet };
}
