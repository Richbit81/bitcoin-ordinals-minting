import React from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { getOrdinalAddress } from '../../utils/wallet';
import { usePinkChatAuth } from '../../contexts/PinkChatAuthContext';

export const AuthGateCard: React.FC = () => {
  const { walletState } = useWallet();
  const { user, login, register, logout, verifyWallet, revalidateWallet } = usePinkChatAuth();
  const [mode, setMode] = React.useState<'login' | 'register'>('login');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      if (mode === 'register') await register(email, password, displayName || email.split('@')[0] || 'PuppetUser');
      else await login(email, password);
      setPassword('');
    } catch (err: any) {
      setError(err?.message || 'Login fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  const linkWallet = async () => {
    const address = getOrdinalAddress(walletState.accounts);
    if (!address) {
      setError('Bitte zuerst Wallet verbinden (Ordinals-Adresse erforderlich).');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await verifyWallet(address);
    } catch (err: any) {
      setError(err?.message || 'Wallet-Verknüpfung fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-pink-300/70 bg-black/45 p-3">
      <h3 className="text-sm font-bold text-pink-100">Level Access</h3>
      {!user ? (
        <>
          <div className="mt-2 flex gap-2 text-xs">
            <button onClick={() => setMode('login')} className={`rounded px-2 py-1 ${mode === 'login' ? 'bg-pink-500/20 text-pink-100' : 'bg-black/20 text-pink-200/80'}`}>Login</button>
            <button onClick={() => setMode('register')} className={`rounded px-2 py-1 ${mode === 'register' ? 'bg-pink-500/20 text-pink-100' : 'bg-black/20 text-pink-200/80'}`}>Register</button>
          </div>
          <form
            className="mt-2 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {mode === 'register' && (
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" className="w-full rounded border border-pink-300/40 bg-black/30 px-2 py-1.5 text-xs text-pink-100" />
            )}
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-Mail" className="w-full rounded border border-pink-300/40 bg-black/30 px-2 py-1.5 text-xs text-pink-100" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Passwort" className="w-full rounded border border-pink-300/40 bg-black/30 px-2 py-1.5 text-xs text-pink-100" />
            <button type="submit" disabled={busy || !email || !password} className="w-full rounded border border-black bg-[#ff4fcf] px-3 py-1.5 text-xs font-bold text-black disabled:opacity-50">
              {mode === 'register' ? 'Account erstellen (Level 1)' : 'Einloggen (Level 1)'}
            </button>
          </form>
        </>
      ) : (
        <div className="mt-2 space-y-2 text-xs text-pink-100">
          <p><span className="font-semibold">User:</span> {user.displayName} ({user.email})</p>
          <p><span className="font-semibold">Level:</span> {String(user.level || 'level1').toUpperCase()}</p>
          {user.walletAddress && <p><span className="font-semibold">Wallet:</span> {user.walletAddress}</p>}
          <div className="flex flex-wrap gap-2">
            <button onClick={linkWallet} disabled={busy} className="rounded border border-pink-300/50 bg-black/30 px-2 py-1 hover:bg-pink-500/10">
              Wallet verknüpfen / Level 2 prüfen
            </button>
            <button onClick={() => void revalidateWallet()} disabled={busy} className="rounded border border-pink-300/50 bg-black/30 px-2 py-1 hover:bg-pink-500/10">
              Level 2 erneuern
            </button>
            <button onClick={() => void logout()} className="rounded border border-red-300/50 bg-red-900/20 px-2 py-1 hover:bg-red-900/40">
              Logout
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-[11px] text-red-300">{error}</p>}
    </div>
  );
};

