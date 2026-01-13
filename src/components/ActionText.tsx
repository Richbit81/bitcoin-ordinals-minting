import React, { useEffect } from 'react';

interface ActionTextProps {
  id: string;
  text: string;
  type: 'attack' | 'shield' | 'heal' | 'card' | 'effect';
  position: { x: number; y: number };
  onComplete: (id: string) => void;
}

export const ActionText: React.FC<ActionTextProps> = ({
  text,
  type,
  position,
  onComplete,
  id,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete(id);
    }, 2000);
    return () => clearTimeout(timer);
  }, [id, onComplete]);

  const getColor = () => {
    switch (type) {
      case 'attack':
        return 'text-red-400';
      case 'shield':
        return 'text-cyan-400';
      case 'heal':
        return 'text-green-400';
      case 'card':
        return 'text-yellow-400';
      case 'effect':
        return 'text-purple-400';
      default:
        return 'text-white';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'attack':
        return '⚔️';
      case 'shield':
        return '🛡️';
      case 'heal':
        return '💚';
      case 'card':
        return '🎴';
      case 'effect':
        return '✨';
      default:
        return '';
    }
  };

  return (
    <div
      className={`absolute pointer-events-none z-50 ${getColor()} font-bold text-2xl md:text-3xl drop-shadow-lg animate-bounce`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        animation: 'damageFloat 2s ease-out forwards',
      }}
    >
      {getIcon()} {text}
    </div>
  );
};
