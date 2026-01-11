import { useState, useEffect, useCallback } from 'react';
import { WalletType, WalletAccount, WalletState } from '../types/wallet';
import {
  isUnisatInstalled,
  isXverseInstalled,
  connectUnisat,
  connectXverse,
  getUnisatAccounts,
  getXverseAccounts,
} from '../utils/wallet';

export const useWallet = () => {
  const [walletState, setWalletState] = useState<WalletState>({
    walletType: null,
    accounts: [],
    connected: false,
    network: 'mainnet',
  });

  const checkWalletConnection = useCallback(async () => {
    // Prüfe nur UniSat beim automatischen Laden
    // Xverse wird übersprungen, da getXverseAccounts() Popups öffnen könnte
    try {
      const unisatAccounts = await getUnisatAccounts();
      if (unisatAccounts.length > 0) {
        setWalletState({
          walletType: 'unisat',
          accounts: unisatAccounts,
          connected: true,
          network: 'mainnet',
        });
        return;
      }
    } catch (err) {
      // Ignoriere Fehler beim automatischen Laden
    }

    // Xverse Accounts werden nur beim aktiven Verbindungsversuch geprüft
    // Nicht beim automatischen Laden, um Popups zu vermeiden
  }, []);

  useEffect(() => {
    checkWalletConnection();

    // Listener für Wallet-Änderungen (UniSat)
    if (isUnisatInstalled()) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          setWalletState(prev => ({
            ...prev,
            accounts: accounts.map(addr => ({ address: addr })),
            connected: true,
            walletType: 'unisat',
          }));
        } else {
          setWalletState({
            walletType: null,
            accounts: [],
            connected: false,
            network: 'mainnet',
          });
        }
      };

      const handleNetworkChanged = () => {
        checkWalletConnection();
      };

      window.unisat?.on('accountsChanged', handleAccountsChanged);
      window.unisat?.on('networkChanged', handleNetworkChanged);

      return () => {
        window.unisat?.removeListener('accountsChanged', handleAccountsChanged);
        window.unisat?.removeListener('networkChanged', handleNetworkChanged);
      };
    }
  }, [checkWalletConnection]);

  const connect = useCallback(async (walletType: WalletType) => {
    try {
      let accounts: WalletAccount[] = [];

      if (walletType === 'unisat') {
        accounts = await connectUnisat();
      } else if (walletType === 'xverse') {
        accounts = await connectXverse();
      } else {
        throw new Error('Ungültiger Wallet-Typ');
      }

      const newState = {
        walletType,
        accounts,
        connected: true,
        network: 'mainnet',
      };
      
      console.log('Setting wallet state to connected:', newState);
      setWalletState(newState);

      return accounts;
    } catch (error: any) {
      throw error;
    }
  }, []);

  const disconnect = useCallback(() => {
    setWalletState({
      walletType: null,
      accounts: [],
      connected: false,
      network: 'mainnet',
    });
  }, []);

  const connectManually = useCallback((account: WalletAccount) => {
    setWalletState({
      walletType: 'unisat', // Default zu unisat für manuelle Verbindung
      accounts: [account],
      connected: true,
      network: 'mainnet',
    });
    return [account];
  }, []);

  return {
    walletState,
    connect,
    connectManually,
    disconnect,
    checkWalletConnection,
    isUnisatInstalled: isUnisatInstalled(),
    isXverseInstalled: isXverseInstalled(),
  };
};

