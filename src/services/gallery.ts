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
 * Lädt alle Karten eines Wallets
 * Nutzt Registry als Basis und prüft dann, welche auf der Blockchain existieren
 */
export const fetchWalletCards = async (walletAddress: string): Promise<WalletCard[]> => {
  const API_URL = import.meta.env.VITE_INSCRIPTION_API_URL || 'http://localhost:3003';
  
  // Schritt 1: Hole Inskriptionen direkt von der Blockchain (hybrid mode)
  // Das findet die tatsächlich erstellten Inskriptionen, nicht die alten pending Einträge
  let delegates: DelegateCard[] = [];
  let blockchainFetchSuccessful = false;
  
  try {
    const apiUrl = `${API_URL}/api/delegates/${walletAddress}?hybrid=true`;
    console.log(`[Gallery] 🔍 Fetching inscriptions from blockchain for ${walletAddress}...`);
    console.log(`[Gallery] 📡 API URL: ${apiUrl}`);
    const hybridResponse = await fetch(apiUrl);
    console.log(`[Gallery] 📥 Response status: ${hybridResponse.status} ${hybridResponse.statusText}`);
    if (hybridResponse.ok) {
      const hybridData = await hybridResponse.json();
      console.log(`[Gallery] 📋 Response data:`, {
        delegatesCount: hybridData.delegates?.length || 0,
        source: hybridData.source,
        count: hybridData.count
      });
      delegates = hybridData.delegates || [];
      blockchainFetchSuccessful = true; // Erfolgreiche Abfrage, auch wenn 0 Ergebnisse
      console.log(`[Gallery] ✅ Fetched ${delegates.length} inscriptions from blockchain`);
      if (delegates.length > 0) {
        console.log(`[Gallery] First inscription:`, {
          id: delegates[0].delegateInscriptionId,
          name: delegates[0].name,
          originalId: delegates[0].originalInscriptionId,
          rarity: delegates[0].rarity
        });
      } else {
        console.log(`[Gallery] ℹ️ No inscriptions found on blockchain for this wallet`);
      }
    } else {
      const errorText = await hybridResponse.text().catch(() => 'Unknown error');
      console.warn(`[Gallery] ⚠️ Blockchain fetch failed: ${hybridResponse.status}`, errorText);
    }
  } catch (hybridErr: any) {
    console.error('[Gallery] ❌ Could not fetch from blockchain:', hybridErr);
    console.error('[Gallery] ❌ Error details:', hybridErr.message, hybridErr.stack);
    // Nur bei Fehlern (nicht bei 0 Ergebnissen) auf Registry zurückgreifen
  }
  
  // Schritt 2: Fallback auf Registry NUR wenn Blockchain-Abfrage fehlgeschlagen ist
  // Wenn Blockchain erfolgreich war aber 0 Ergebnisse hat, zeige 0 (keine alten pending Einträge)
  if (delegates.length === 0 && !blockchainFetchSuccessful) {
    try {
      console.log(`[Gallery] ⚠️ Blockchain fetch failed, trying registry as fallback...`);
      delegates = await getDelegatesByWallet(walletAddress, false);
      console.log(`[Gallery] ✅ Fetched ${delegates.length} delegates from registry (fallback)`);
    } catch (err) {
      console.error('[Gallery] ❌ Could not fetch delegates from registry:', err);
    }
  } else if (delegates.length === 0 && blockchainFetchSuccessful) {
    console.log(`[Gallery] ✅ Blockchain query successful but no inscriptions found. Showing 0 cards (not using old registry entries).`);
  }
  
  // Erstelle Map für schnellen Zugriff: delegateInscriptionId -> DelegateCard
  const delegateMap = new Map<string, DelegateCard>();
  delegates.forEach(delegate => {
    delegateMap.set(delegate.delegateInscriptionId, delegate);
  });
  
  // Hole Logs (für zusätzliche Metadaten)
  const logs = await getWalletLogs(walletAddress);
  const logCardMap = new Map<string, MintingLogEntry['cards'][0]>();
  logs.forEach(log => {
    log.cards.forEach(card => {
      logCardMap.set(card.inscriptionId, card);
    });
  });
  
  console.log(`[Gallery] 📊 Processing ${delegates.length} delegates...`);
  
  // Konvertiere Inskriptionen zu WalletCard-Format
  // Zeige ALLE Delegates an (auch pending), damit der Benutzer sieht, dass etwas passiert
  const cards: WalletCard[] = delegates
    .filter(delegate => {
      // Filtere nur mock IDs raus - zeige pending UND finale IDs
      const isValid = !delegate.delegateInscriptionId.startsWith('mock-');
      if (!isValid) {
        console.log(`[Gallery] ⏳ Skipping mock inscription: ${delegate.delegateInscriptionId} (${delegate.name})`);
      }
      return isValid;
    })
    .map(delegate => {
      const logCard = logCardMap.get(delegate.delegateInscriptionId);
      const walletCard = {
        name: delegate.name,
        rarity: delegate.rarity as Rarity,
        inscriptionId: delegate.delegateInscriptionId, // Delegate-Inskription-ID (finale ID)
        originalInscriptionId: delegate.originalInscriptionId, // Original für Bild-Abruf (echte Inskription-ID)
        mintedAt: new Date(delegate.timestamp).getTime(),
        packName: logCard?.packName || 'Unknown',
        cardType: delegate.cardType,
        effect: delegate.effect,
        svgIcon: delegate.svgIcon,
      };
      console.log(`[Gallery] ✅ Created WalletCard:`, {
        name: walletCard.name,
        delegateId: walletCard.inscriptionId,
        originalId: walletCard.originalInscriptionId,
      });
      return walletCard;
    });
  
  const pendingCount = cards.filter(c => c.inscriptionId.startsWith('pending-')).length;
  const finalCount = cards.filter(c => !c.inscriptionId.startsWith('pending-')).length;
  console.log(`[Gallery] ✅ Total cards to display: ${cards.length} (${finalCount} final, ${pendingCount} pending)`);
  
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
};

