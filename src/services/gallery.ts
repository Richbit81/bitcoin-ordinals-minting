import { Card, Rarity } from '../types/wallet';
import { getWalletLogs, MintingLogEntry } from './mintingLog';
import { getDelegatesByWallet, DelegateCard } from './delegateService';

export interface WalletCard {
  name: string;
  rarity: Rarity;
  inscriptionId: string;
  mintedAt: number;
  packName: string;
  cardType?: 'animal' | 'action' | 'status';
  effect?: string;
  svgIcon?: string;
  originalInscriptionId?: string; // Original-Inskription-ID für Bild-Abruf
}

/**
 * 💎 Lädt alle Karten eines Wallets mit 3-Tier System + Auto-Sync
 * EBENE 1: PostgreSQL DB (instant, bombensicher)
 * EBENE 2: Blockchain-Scan (langsam, findet ALLES) + Auto-Sync zu DB
 * EBENE 3: Registry Cache (letzter Fallback)
 */
export const fetchWalletCards = async (walletAddress: string): Promise<WalletCard[]> => {
  const API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';
  
  let delegates: DelegateCard[] = [];
  let source = 'unknown';
  
  // ✨ EBENE 1: PostgreSQL DB (Primary - INSTANT!)
  try {
    const dbUrl = `${API_URL}/api/delegates/${walletAddress}`;
    console.log(`[Gallery] 💣 Trying DB first (instant) for ${walletAddress}...`);
    
    const dbResponse = await fetch(dbUrl);
    if (dbResponse.ok) {
      const dbData = await dbResponse.json();
      delegates = dbData.delegates || [];
      source = dbData.source || 'database';
      
      console.log(`[Gallery] ✅ DB response: ${delegates.length} cards, source: ${source}`);
      
      // Wenn DB Karten hat → FERTIG (instant)
      if (delegates.length > 0) {
        console.log(`[Gallery] 🎉 DB hit! Returning ${delegates.length} cards instantly`);
        return processCardsToWalletCards(delegates);
      }
      
      console.log(`[Gallery] ℹ️ DB empty, falling back to blockchain scan...`);
    }
  } catch (dbErr: any) {
    console.warn(`[Gallery] ⚠️ DB fetch failed:`, dbErr.message);
  }
  
  // ✨ EBENE 2: Blockchain-Scan (wenn DB leer) + AUTO-SYNC
  try {
    const blockchainUrl = `${API_URL}/api/delegates/${walletAddress}?hybrid=true`;
    console.log(`[Gallery] 🔍 Fetching from blockchain (may take 5-10 min)...`);
    console.log(`[Gallery] 📡 API URL: ${blockchainUrl}`);
    
    const blockchainResponse = await fetch(blockchainUrl);
    console.log(`[Gallery] 📥 Blockchain response: ${blockchainResponse.status}`);
    
    if (blockchainResponse.ok) {
      const blockchainData = await blockchainResponse.json();
      delegates = blockchainData.delegates || [];
      source = blockchainData.source || 'blockchain-hybrid';
      
      console.log(`[Gallery] ✅ Blockchain: ${delegates.length} cards found`);
      console.log(`[Gallery] 🔄 Auto-sync: Cards werden automatisch in DB gespeichert für nächste Abfrage!`);
      
      if (delegates.length > 0) {
        return processCardsToWalletCards(delegates);
      }
    } else {
      const errorText = await blockchainResponse.text().catch(() => 'Unknown error');
      console.warn(`[Gallery] ⚠️ Blockchain fetch failed: ${blockchainResponse.status}`, errorText);
    }
  } catch (blockchainErr: any) {
    console.error('[Gallery] ❌ Blockchain fetch error:', blockchainErr);
  }
  
  // ✨ EBENE 3: Registry Cache (letzter Fallback)
  try {
    console.log(`[Gallery] ⚠️ Trying registry as last fallback...`);
    delegates = await getDelegatesByWallet(walletAddress, false);
    console.log(`[Gallery] ✅ Registry: ${delegates.length} cards found (cache)`);
  } catch (registryErr) {
    console.error('[Gallery] ❌ Registry fetch failed:', registryErr);
  }
  
  // Wenn keine Delegates gefunden → leeres Array
  if (delegates.length === 0) {
    console.log(`[Gallery] ℹ️ No cards found for wallet ${walletAddress}`);
    return [];
  }
  
  return processCardsToWalletCards(delegates, walletAddress);
};

/**
 * 💎 Helper: Verarbeite Delegates zu WalletCard-Format
 */
async function processCardsToWalletCards(delegates: DelegateCard[], walletAddress?: string): Promise<WalletCard[]> {
  console.log(`[Gallery] 📊 Processing ${delegates.length} delegates to WalletCard format...`);
  
  // Hole Logs (für zusätzliche Metadaten) - optional
  let logCardMap = new Map<string, any>();
  if (walletAddress) {
    try {
      const logs = await getWalletLogs(walletAddress);
      logs.forEach(log => {
        log.cards.forEach(card => {
          logCardMap.set(card.inscriptionId, card);
        });
      });
    } catch (logErr) {
      console.warn(`[Gallery] ⚠️ Could not load logs:`, logErr);
    }
  }
  
  // Konvertiere Delegates zu WalletCard-Format
  const cards: WalletCard[] = delegates
    .filter(delegate => {
      // Filtere nur mock IDs raus - zeige pending UND finale IDs
      const isValid = !delegate.delegateInscriptionId.startsWith('mock-');
      if (!isValid) {
        console.log(`[Gallery] ⏳ Skipping mock inscription: ${delegate.delegateInscriptionId}`);
      }
      return isValid;
    })
    .map(delegate => {
      const logCard = logCardMap.get(delegate.delegateInscriptionId);
      const walletCard: WalletCard = {
        name: delegate.name,
        rarity: delegate.rarity as Rarity,
        inscriptionId: delegate.delegateInscriptionId,
        originalInscriptionId: delegate.originalInscriptionId,
        mintedAt: new Date(delegate.timestamp).getTime(),
        packName: logCard?.packName || 'Unknown',
        cardType: delegate.cardType,
        effect: delegate.effect,
        svgIcon: delegate.svgIcon,
      };
      return walletCard;
    });
  
  const pendingCount = cards.filter(c => c.inscriptionId.startsWith('pending-')).length;
  const finalCount = cards.filter(c => !c.inscriptionId.startsWith('pending-')).length;
  console.log(`[Gallery] ✅ Processed: ${cards.length} cards (${finalCount} confirmed, ${pendingCount} pending)`);
  
  // Sortiere nach Rarität (seltenste zuerst) und dann nach Datum
  const rarityOrder: Record<Rarity, number> = {
    'mystic-legendary': 0,
    'legendary': 1,
    'epic': 2,
    'rare': 3,
    'uncommon': 4,
    'common': 5,
  };
  
  return cards.sort((a, b) => {
    const rarityDiff = rarityOrder[a.rarity] - rarityOrder[b.rarity];
    if (rarityDiff !== 0) return rarityDiff;
    return b.mintedAt - a.mintedAt;
  });
}

