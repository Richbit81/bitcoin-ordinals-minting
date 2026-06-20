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
            'Bitte gib deine Taproot-Adresse (bc1p…) im Feld oberhalb des Mint-Buttons ein. ' +
            'Dorthin wird deine Inscription gesendet.',
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
              'Sicherheitscheck: Die Taproot-Empfangsadresse ist nicht eindeutig deiner aktuell ' +
              'verbundenen Wallet zugeordnet.\n\n' +
              'Bitte gib die Taproot-Adresse (bc1p…) DEINER verbundenen Wallet im Feld oberhalb ' +
              'des Mint-Buttons (neu) ein, bevor du mintest.',
          };
        }
      }

      return { address: receiveAddress };
    },
    [],
  );

  return { taprootOverride, handleTaprootChange, resolveReceiveAddress } as const;
}
