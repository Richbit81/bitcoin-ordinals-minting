import React from 'react';

export const PalindromSoundBoxPage: React.FC = () => {
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
