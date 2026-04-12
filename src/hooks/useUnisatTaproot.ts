import { useState, useCallback } from 'react';
import { getOrdinalAddress } from '../utils/wallet';

/**
 * Shared hook for UniSat taproot address handling across all mint pages.
 *
 * When UniSat is connected via Native SegWit the user must enter their
 * taproot (bc1p) address manually so inscriptions land in the right place.
 * The address is persisted in localStorage for reuse across pages.
 */
export function useUnisatTaproot() {
  const [taprootOverride, setTaprootOverride] = useState<string>(
    () => localStorage.getItem('unisat_taproot_address') || '',
  );

  const handleTaprootChange = useCallback((value: string) => {
    const v = value.trim();
    setTaprootOverride(v);
    if (v.startsWith('bc1p')) {
      localStorage.setItem('unisat_taproot_address', v);
    }
  }, []);

  const resolveReceiveAddress = useCallback(
    async (walletState: {
      connected: boolean;
      walletType?: string | null;
      accounts: Array<{ address: string; purpose?: 'ordinals' | 'payment' }>;
    }): Promise<{ address: string; error?: string }> => {
      let receiveAddress = getOrdinalAddress(walletState.accounts);

      if (walletState.walletType === 'unisat' && !receiveAddress.startsWith('bc1p')) {
        const saved = taprootOverride || localStorage.getItem('unisat_taproot_address') || '';
        if (saved.startsWith('bc1p')) {
          receiveAddress = saved;
        }
      }

      if (!receiveAddress) {
        return { address: '', error: 'No wallet address found.' };
      }

      if (!receiveAddress.startsWith('bc1p')) {
        return {
          address: receiveAddress,
          error:
            'Bitte gib deine Taproot-Adresse (bc1p…) im Feld oberhalb des Mint-Buttons ein. ' +
            'Dort wird deine Inscription hingesendet.',
        };
      }

      if (walletState.walletType === 'unisat') {
        try {
          const accs = await (window as any).unisat!.getAccounts();
          const activeAddr: string = accs?.[0] || '';
          if (activeAddr.startsWith('bc1p')) {
            return {
              address: receiveAddress,
              error:
                'UniSat ist mit Taproot verbunden — Zahlung von hier würde deine Inscriptions zerstören!\n\n' +
                'Bitte wechsle in UniSat zu Native SegWit:\n' +
                'UniSat → Settings → Address Type → Native SegWit\n' +
                'Dann verbinde erneut über "Connect Wallet".',
            };
          }
        } catch {
          /* continue */
        }
      }

      return { address: receiveAddress };
    },
    [taprootOverride],
  );

  return { taprootOverride, handleTaprootChange, resolveReceiveAddress } as const;
}
