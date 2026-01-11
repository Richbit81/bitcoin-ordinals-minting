import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { WalletProvider } from './contexts/WalletContext.tsx'

// ⚠️ VERSION 2.0 - KEINE ZAHLUNGEN!
console.log('🚨🚨🚨 MAIN.TSX GELADEN - VERSION 2.0 - KEINE ZAHLUNGEN! 🚨🚨🚨');
console.log('[main.tsx] ✅ Diese Version verwendet NUR Ord - KEINE Zahlungen!');
console.log('[main.tsx] ⚠️ Wenn Sie "Pack payment" sehen, ist der Cache NICHT geleert!');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WalletProvider>
      <App />
    </WalletProvider>
  </React.StrictMode>,
)

