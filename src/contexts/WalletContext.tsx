import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { WalletType, WalletAccount, WalletState } from '../types/wallet';
import {
  isUnisatInstalled,
  isXverseInstalled,
  connectUnisat,
  connectXverse,
  getUnisatAccounts,
  getXverseAccounts,
} from '../utils/wallet';

interface WalletContextType {
  walletState: WalletState;
  connect: (walletType: WalletType) => Promise<WalletAccount[]>;
  connectManually: (account: WalletAccount) => WalletAccount[];
  disconnect: () => void;
  checkWalletConnection: () => Promise<void>;
  isUnisatInstalled: boolean;
  isXverseInstalled: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [walletState, setWalletState] = useState<WalletState>({
    walletType: null,
    accounts: [],
    connected: false,
    network: 'mainnet',
  });

  const checkWalletConnection = useCallback(async () => {
    // Prüfe nur UniSat beim automatischen Laden
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
      
      console.log('WalletContext: Setting wallet state to connected:', newState);
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
      walletType: 'unisat',
      accounts: [account],
      connected: true,
      network: 'mainnet',
    });
    return [account];
  }, []);

  return (
    <WalletContext.Provider
      value={{
        walletState,
        connect,
        connectManually,
        disconnect,
        checkWalletConnection,
        isUnisatInstalled: isUnisatInstalled(),
        isXverseInstalled: isXverseInstalled(),
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};








