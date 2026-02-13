import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { isAdminAddress } from '../config/admin';

export const AudioSplitterPage: React.FC = () => {
  const navigate = useNavigate();
  const { walletState } = useWallet();

  const connectedAddress = walletState.accounts?.find((a: any) => a.purpose === 'ordinals')?.address
    || walletState.accounts?.[0]?.address;
  const isAdmin = walletState.connected && isAdminAddress(connectedAddress);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold mb-4">Admin Access Required</p>
          <p className="text-gray-400 mb-6">Connect your admin wallet to use this tool.</p>
          <button onClick={() => navigate('/')} className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-gray-800">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 className="text-xl font-bold">Audio Splitter Tool</h1>
      </div>

      {/* Iframe */}
      <iframe
        src="/tools/audio_splitter_tool.html"
        className="flex-1 w-full border-0"
        title="Audio Splitter Tool"
        sandbox="allow-scripts allow-same-origin allow-downloads allow-forms"
      />
    </div>
  );
};

export default AudioSplitterPage;
