import React, { useState } from 'react';
import { WalletAccount } from '../types/wallet';

interface WalletConnectFallbackProps {
  onConnect: (account: WalletAccount) => void;
}

/**
 * Fallback: Enter wallet address manually (for testing on localhost)
 * This component can be used when browser extensions don't work
 */
export const WalletConnectFallback: React.FC<WalletConnectFallbackProps> = ({ onConnect }) => {
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleConnect = () => {
    if (!address.trim()) {
      setError('Please enter a wallet address');
      return;
    }

    if (!address.startsWith('bc1')) {
      setError('Please use a valid Bitcoin address (bc1...)');
      return;
    }

    if (!address.startsWith('bc1p')) {
      setError('⚠️ Please use a Taproot address (bc1p...) for Ordinals');
      return;
    }

    setError(null);
    onConnect({ address: address.trim() });
  };

  return (
    <div className="bg-black border-2 border-red-600 rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold text-white mb-2 border-b-2 border-red-600 pb-2">
        🔧 Connect Wallet Manually
      </h3>
      <p className="text-sm text-gray-300 mb-4">
        If browser extensions don't work on localhost, you can enter your wallet address manually here.
      </p>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-white mb-2 uppercase tracking-wide">
            Bitcoin Taproot Address (bc1p...)
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setError(null);
            }}
            placeholder="bc1p..."
            className="w-full px-4 py-2 bg-gray-900 border-2 border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-red-600 focus:border-red-600"
          />
        </div>

        {error && (
          <div className="p-3 bg-gray-900 border-2 border-red-600 text-red-600 rounded text-sm font-semibold">
            {error}
          </div>
        )}

        <button
          onClick={handleConnect}
          className="w-full px-6 py-3 bg-white text-black border-2 border-red-600 rounded-lg font-bold hover:bg-red-600 hover:text-white transition"
        >
          Connect
        </button>

        <div className="p-3 bg-gray-900 border-2 border-red-600 rounded-lg text-xs text-gray-300">
          <strong className="text-white">Note:</strong> This is only intended for testing on localhost. 
          In production, browser extensions should be used, which work on HTTPS domains.
        </div>
      </div>
    </div>
  );
};

