import React from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useNavigate } from 'react-router-dom';

const ALLOWED_WALLETS = [
  'bc1p8mex3g66tsrqlura04ts6xgxlfwhf23adrxpc5g6c0zmqdgqtq3syq0elu',
  'bc1p9j4g6r27yqhmp4c403vn33mz7uug439sthqngkkrylu7d7uq7d6qvz39jj',
];

export const PalindromSoundBoxPage: React.FC = () => {
  const { walletState } = useWallet();
  const navigate = useNavigate();

  const isAllowed = walletState.connected && walletState.accounts?.some(acc =>
    ALLOWED_WALLETS.includes(acc.address)
  );

  if (!isAllowed) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🦋</div>
          <h1 className="text-2xl font-bold text-white mb-4">Access Restricted</h1>
          <p className="text-gray-400 mb-8">
            {walletState.connected 
              ? 'Your wallet is not authorized to access the Palindrom Sound Box.'
              : 'Please connect an authorized wallet to access the Palindrom Sound Box.'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 w-full h-full bg-black" style={{ zIndex: 50 }}>
      <iframe
        src="/palindrom/index.html"
        title="Palindrom Sound Box"
        className="w-full h-full border-0"
        allow="autoplay"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      />
    </div>
  );
};
