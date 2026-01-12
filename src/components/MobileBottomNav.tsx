import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';

export const MobileBottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { walletState } = useWallet();

  const navItems = [
    {
      id: 'home',
      label: 'Home',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
      path: '/',
    },
    {
      id: 'black-wild',
      label: 'Mint',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      ),
      path: '/black-wild',
    },
    {
      id: 'point-shop',
      label: 'Shop',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
      path: '/point-shop',
    },
    {
      id: 'tech-games',
      label: 'Games',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      path: '/tech-games',
    },
    ...(walletState.connected ? [{
      id: 'trade',
      label: 'Trade',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
      path: '/trade',
    }] : []),
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Bottom Navigation - nur auf Mobile sichtbar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-md border-t-2 border-red-600/50 z-50 md:hidden">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 touch-manipulation active:scale-95 ${
                isActive(item.path)
                  ? 'text-red-600 scale-110'
                  : 'text-gray-400 hover:text-white'
              }`}
              aria-label={item.label}
            >
              {item.icon}
              <span className="text-[10px] mt-1 font-semibold">{item.label}</span>
              {isActive(item.path) && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </nav>
      
      {/* Spacer für Bottom Nav - nur auf Mobile */}
      <div className="h-16 md:hidden" />
    </>
  );
};
