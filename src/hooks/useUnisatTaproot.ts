import { useState, useCallback, useEffect } from 'react';
import { getOrdinalAddress, getPaymentAddress } from '../utils/wallet';
import { getBoundTaproot, bindTaproot } from '../utils/taprootStore';

type WalletStateLike = {
  connected?: boolean;
  walletType?: string | null;
  accounts?: Array<{ address: string; purpose?: 'ordinals' | 'payment' }>;
};

/**
 * Shared hook for UniSat/OKX taproot address handling across all mint pages.
 *
 * Wenn UniSat/OKX über SegWit verbunden ist, liefert die Wallet KEINE
 * Taproot-Adresse — der Nutzer muss seine bc1p-Adresse manuell eingeben, damit
 * die Inscription am richtigen Ort landet.
 *
 * KRITISCH: Die Taproot-Adresse wird an die konkret verbundene Wallet gebunden
 * (über deren Payment-Adresse), niemals global wiederverwendet. So kann eine
 * andere Wallet niemals die Taproot-Adresse einer vorherigen Wallet erben.
 * Vor jedem Mint prüft ein hartes Gate, dass die Empfangsadresse eindeutig zur
 * aktuell verbundenen Wallet gehört.
 *
 * `walletState` sollte übergeben werden, damit die Bindung pro Wallet greift.
 */
export function useUnisatTaproot(walletState?: WalletStateLike) {
  const paymentAddress = getPaymentAddress(walletState?.accounts || []);

  const [taprootOverride, setTaprootOverride] = useState<string>(
    () => getBoundTaproot(paymentAddress),
  );

  // Beim Wallet-Wechsel das Eingabefeld neu aus der Bindung dieser Wallet laden —
  // niemals eine fremde Adresse stehen lassen.
  useEffect(() => {
    setTaprootOverride(getBoundTaproot(paymentAddress));
  }, [paymentAddress]);

  const handleTaprootChange = useCallback(
    (value: string) => {
      const v = value.trim();
      setTaprootOverride(v);
      if (v.startsWith('bc1p') && paymentAddress) {
        bindTaproot(paymentAddress, v);
      }
    },
    [paymentAddress],
  );

  const resolveReceiveAddress = useCallback(
    async (ws: {
      connected: boolean;
      walletType?: string | null;
      accounts: Array<{ address: string; purpose?: 'ordinals' | 'payment' }>;
    }): Promise<{ address: string; error?: string }> => {
      const accounts = ws.accounts || [];
      const payment = getPaymentAddress(accounts);
      const isUnisatLike = ws.walletType === 'unisat' || ws.walletType === 'okx';

      let receiveAddress = getOrdinalAddress(accounts);

      // SegWit-Verbindung: Taproot aus der Bindung DIESER Wallet holen.
      if (isUnisatLike && !receiveAddress.startsWith('bc1p')) {
        const bound = getBoundTaproot(payment);
        if (bound) {
          receiveAddress = bound;
        }
      }

      if (!receiveAddress) {
        return { address: '', error: 'No wallet address found.' };
      }

      if (!receiveAddress.startsWith('bc1p')) {
        return {
          address: receiveAddress,
          error:
            'Please enter your Taproot address (bc1p…) in the field above the mint button. ' +
            'Your inscription will be sent there.',
        };
      }

      // Bestehender Schutz: UniSat darf nicht im Taproot-Modus zahlen
      // (würde Inscriptions auf der Taproot-UTXO zerstören).
      if (ws.walletType === 'unisat') {
        try {
          const accs = await (window as any).unisat!.getAccounts();
          const activeAddr: string = accs?.[0] || '';
          if (activeAddr.startsWith('bc1p')) {
            return {
              address: receiveAddress,
              error:
                'UniSat is connected with Taproot — paying from here would destroy your inscriptions!\n\n' +
                'Please switch to Native SegWit in UniSat:\n' +
                'UniSat → Settings → Address Type → Native SegWit\n' +
                'Then reconnect via "Connect Wallet".',
            };
          }
        } catch {
          /* continue */
        }
      }

      // HARTES SICHERHEITS-GATE (nur UniSat/OKX):
      // Die Taproot-Empfangsadresse MUSS eindeutig zur aktuell verbundenen Wallet
      // gehören — entweder als ausdrücklich gebundene Adresse dieser Payment-Adresse
      // oder (Taproot-Modus) als die verbundene Adresse selbst. Sonst Abbruch.
      if (isUnisatLike) {
        const bound = getBoundTaproot(payment);
        const belongsToWallet = receiveAddress === bound || receiveAddress === payment;
        if (!belongsToWallet) {
          return {
            address: receiveAddress,
            error:
              'Security check: The Taproot receive address is not clearly assigned to your currently ' +
              'connected wallet.\n\n' +
              'Please (re-)enter the Taproot address (bc1p…) of YOUR connected wallet in the field above ' +
              'the mint button before minting.',
          };
        }
      }

      return { address: receiveAddress };
    },
    [],
  );

  return { taprootOverride, handleTaprootChange, resolveReceiveAddress } as const;
}
