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
      if (mode === 'register') await register(email, password, displayName);
      else await login(email, password);
      setPassword('');
    } catch (err: any) {
      setError(err?.message || 'Login failed.');
    } finally {
      setBusy(false);
    }
  };

  const linkWallet = async () => {
    const address = getOrdinalAddress(walletState.accounts);
    if (!address) {
      setError('Please connect your wallet first (Ordinals address required).');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await verifyWallet(address);
    } catch (err: any) {
      setError(err?.message || 'Wallet verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const truncateAddr = (addr: string) => {
    if (addr.length <= 20) return addr;
    return `${addr.slice(0, 10)}...${addr.slice(-8)}`;
  };

  return (
    <div className="rounded-2xl border border-pink-300/70 bg-black/45 p-3 min-w-0">
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
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name *" required className="w-full rounded border border-pink-300/40 bg-black/30 px-2 py-1.5 text-xs text-pink-100" />
            )}
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded border border-pink-300/40 bg-black/30 px-2 py-1.5 text-xs text-pink-100" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full rounded border border-pink-300/40 bg-black/30 px-2 py-1.5 text-xs text-pink-100" />
            <button type="submit" disabled={busy || !email || !password || (mode === 'register' && !displayName.trim())} className="w-full rounded border border-black bg-[#ff4fcf] px-3 py-1.5 text-xs font-bold text-black disabled:opacity-50">
              {mode === 'register' ? 'Create Account (Level 1)' : 'Login (Level 1)'}
            </button>
          </form>
        </>
      ) : (
        <div className="mt-2 space-y-1.5 text-xs text-pink-100 min-w-0">
          <p className="truncate"><span className="font-semibold">User:</span> {user.displayName}</p>
          <p><span className="font-semibold">Level:</span> {String(user.level || 'level1').toUpperCase()}{user.role === 'admin' ? ' · Admin' : ''}</p>
          {user.walletAddress && (
            <p className="truncate" title={user.walletAddress}><span className="font-semibold">Wallet:</span> {truncateAddr(user.walletAddress)}</p>
          )}
          {user.puppetCount !== undefined && user.puppetCount !== 0 && (
            <p><span className="font-semibold">PinkPuppets:</span> {user.puppetCount === -1 ? 'Lookup failed' : `Found ${user.puppetCount}`}</p>
          )}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button onClick={linkWallet} disabled={busy} className="rounded border border-pink-300/50 bg-black/30 px-2 py-1 text-[11px] hover:bg-pink-500/10 disabled:opacity-50">
              Wallet / Level 2 verify
            </button>
            <button onClick={() => void revalidateWallet()} disabled={busy} className="rounded border border-pink-300/50 bg-black/30 px-2 py-1 text-[11px] hover:bg-pink-500/10 disabled:opacity-50">
              Level 2 refresh
            </button>
          </div>
          <button onClick={() => void logout()} className="rounded border border-red-300/50 bg-red-900/20 px-2 py-1 text-[11px] hover:bg-red-900/40">
            Logout
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-[11px] text-red-300">{error}</p>}
    </div>
  );
};

