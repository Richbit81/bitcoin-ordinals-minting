import React from 'react';
import { useWallet } from '../contexts/WalletContext';

/**
 * Proactive warning shown on mint pages when UniSat is connected in TAPROOT mode.
 *
 * Paying from a Taproot-connected UniSat can destroy the user's inscriptions
 * (they sit on the Taproot UTXO). The user must switch UniSat to Native SegWit
 * (the payment address) before minting. The inscription itself is still sent to
 * their Taproot address. This banner makes that requirement visible immediately
 * after connecting — the hard safety gate in useUnisatTaproot still blocks the
 * mint as a final backstop.
 */
export const UnisatTaprootModeWarning: React.FC<{ className?: string }> = ({ className }) => {
  const { walletState } = useWallet();
  const addr = walletState.accounts?.[0]?.address || '';
  const isTaprootConnected =
    walletState.connected && walletState.walletType === 'unisat' && addr.startsWith('bc1p');

  if (!isTaprootConnected) return null;

  return (
    <div className={`mb-4 p-3 rounded-lg bg-red-900/30 border border-red-600/50 ${className || ''}`}>
      <p className="text-xs text-red-300 font-bold mb-1">⚠ UniSat is connected in Taproot mode</p>
      <p className="text-[11px] text-red-200/80 leading-relaxed">
        To mint you must switch UniSat to your payment address (Native SegWit), otherwise your
        inscriptions could be destroyed:
        <br />
        <span className="text-red-100 font-semibold">UniSat → Settings → Address Type → Native SegWit</span>,
        then reconnect via &ldquo;Connect Wallet&rdquo;. Your inscription will still be sent to your Taproot address.
      </p>
    </div>
  );
};
