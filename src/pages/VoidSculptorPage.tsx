import React from 'react';
import { useNavigate } from 'react-router-dom';

export const VoidSculptorPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 bg-black/90 border-b border-gray-800 flex-shrink-0">
        <button
          onClick={() => navigate('/')}
          className="text-gray-400 hover:text-white flex items-center gap-2 transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </button>
        <span className="text-amber-400 font-bold text-sm tracking-wide">VOID SCULPTOR</span>
        <div className="w-20" />
      </div>
      <iframe
        src="/tools/void-sculptor.html"
        title="Void Sculptor"
        className="flex-1 w-full border-0"
        allow="clipboard-write"
      />
    </div>
  );
};
