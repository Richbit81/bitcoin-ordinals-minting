import React, { useEffect } from 'react';

const PIXEL_FONT = "'Press Start 2P', monospace";

export const DroidzArenaPage: React.FC = () => {
  useEffect(() => {
    const id = 'droidz-arena-pixel-font';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        boxSizing: 'border-box',
      }}
    >
      <h1
        style={{
          margin: 0,
          color: '#fff',
          fontFamily: PIXEL_FONT,
          fontSize: 'clamp(14px, 3.2vw, 28px)',
          lineHeight: 1.6,
          textAlign: 'center',
          letterSpacing: '0.04em',
          imageRendering: 'pixelated',
        }}
      >
        DROIDZ Arena, coming soon
      </h1>
    </div>
  );
};
