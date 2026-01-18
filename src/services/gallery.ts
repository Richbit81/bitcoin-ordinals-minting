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
  
  // 🎯 BLACK & WILD Project - Alle Original-IDs aus Backend-Config
  // Diese Liste wird vom Backend via API geholt (für jetzt hardcoded, später dynamisch)
  const BLACK_WILD_PROJECT_ID = 'black-and-wild';
  
  // ALLE Black & Wild Original-IDs (vollständige Liste)
  const BLACK_WILD_ORIGINALS = [
    // TIER CARDS
    '5e6f59c6e871f5ccf7ccc09e3e8ae73ac2e63c78a64e66a3ca9a5c8f7e5d35b6i0', // Bär
    'e6805a3c68fd1abb1904dfb8193b2a01ef2ccbd96d6b8be2c4b9aba4332c413di0', // Wolf
    '44740a1f30efb247ef41de3355133e12d6f58ab4dc8a3146648e2249fa9c6a39i0', // Fuchs
    '5be3dfb109321291c0469ab1253be7b5c9d023e694945dbbd71a1dfe7518a4bfi0', // Eule
    '446045d1613fb57610840eb1c6ba1491d5b0ea9624f7bda585e5f52e256f91e1i0', // Ant
    '3aef296ead63f20a39c06ca04fc696dd98c532d6b595088fc58176cb46d1beaai0', // Bee
    '8564dd1ffef7bb5e2501819e562d4f98d123959899a3348a8def8dc4e3c7409di0', // Spider
    '433c855aa38cc7b142dacaff65cfe9d58f2a79c40c87ddff56c3a283972a6a52i0', // Butterfly
    'f56c0801566cb9e46e1465f1d760f8976ba0bad328e39e84fa2e2209a4d6c540i0', // Worm
    'c907865db233272d06a262c19da7379d4d36f1088dd825375b29a73686a3a184i0', // Chicken
    'd021efd186eb10c45fbdf043bf974e211772fce336d8287f02f85b6a06b2d8d9i0', // Bird
    '7f2a4963ed0c4e341db74d82dcc8c8fc0cdf4c84d7c1558f13b33b9ca6ef7251i0', // Cow
    '195209f7e21b768fd7ca18a905ddac9ec4986412f4f8aa716290fbb743db6feai0', // Tiger
    'a0b9f4f33913f512ba4de73b1e4982cf5be76874062287fcd05efdd76a220a7fi0', // Rabbit
    'd67b09d7ac06aa9c217f95c69bf5c76f7f1634cad92fff5829546a22a279072ci0', // Crow
    'a831e75a67d49d6e98594991cde68da3bf5f328ff49cc94a4a6bc05887ff8523i0', // Duck
    '3099b73fd35e81a8bf53a02af99f436d88b73b54945aaa97dfde155a08e174bdi0', // Zebra
    '4d2d4a2b258b18b95bfc55dc3c31cbcd4b204a4f001c9861793b993487af4560i0', // Sheep
    '3135eb862f9c56bf1884c05dd80bb28107ba9af82bed83fd39a1ff28e303a8a7i0', // Turtle
    '2cd0572f35441d5b443ad9c78ec62f84f9b6c77528903c86b8b23b9213f0e7c4i0', // Penguin
    'd52730b2f4b8c0095ad82853e3e27d72adaa65796dbb666d929d7ca36f570ad2i0', // Octopus
    '3898219212c8a1c66564e60734ab01872315c3900ef782b466caf4ae58c2afdbi0', // Ape
    // ACTION CARDS
    'ef41bd80183a3d557cfba127b55bee1330ceb6d05e8b4746921b23b55ce133c9i0', // SLAP
    'd7e6610d2dcaed7bf6fb0923e5a8dbe0776dbe07a966b19d9bbbab4eaf298d50i0', // WRONG MOVE
    '7d6ffeb90550adb8994e52eb6ca56ec42d19b20401a22af9ed959684b9c83ec4i0', // PANIC
    'd1abdfb5c6318bdc45948cd88b03ae8057cf20bf955a6ed7fe7e011a6f895df9i0', // NOPE
    '37b9fb329a6cf26de3e701da20c0217de97bcd839f18bceac3f43fea563f6b71i0', // OVERDOSE
    'fe1490d29120f1277596650462f33341a06a165bc037bb13e93af050935e4d75i0', // SWITCH
    '9c1637a13a9f9c18bc232daefebab50033d14550afc51ea80dce4a6ae8b9d03ai0', // COLLAPSE
    '39367bda5c67a2a628261c2b0a3432c23929e864c7c12c5264b77d53341ecce0i0', // INSTINCT
    'bb48c48089f36680ac736fbb675dc29b9965a2e41a1ecd60dc70b70f9729df51i0', // STARE
    '8da26d78071401ea4e69f16751612ae879543b438064a05ea89b17d0e7a92d99i0', // PUSH
    '5687d374883dddcc97913fd286e180351443f9fd8f98af0f9e0f6bf199f5cde5i0', // ACCIDENT
    'e6ac9fab61f8e30fb58c5d9224681ad2c1a9f064eb523c4a264a562648a486f9i0', // LAST WORDS
    // STATUS CARDS
    '70b7048c1567f00c77aa05aa95db48d6838c4592a7d5c6d37e127667f9275050i0', // BLEEDING
    'f11b5ddc8a0a25a7cec94bc15c3fa32311808fe2cb87c2cea763f0d50c8b8e83i0', // STUCK
    '1656be81e09e210983360e549155c9115ff9411019ca24692ea77f4991a2afa5i0', // TINT
    '27442fdd682add2aa8d10846e506ed29891b76cb09e4923d640bf83f392241a0i0', // TARGET
    'cf331de8d1d45a3759c80d6ca20409ac80bf4602c855396a101d1eb08cb36fc5i0', // SWARM
    'd226c067ad6f7e083a7612d8b357051b824bdd63ca7bee7080611634abd28a1ai0', // SHIELD
    '0c7d863936f3c02134c472de45c7f5a2a0bce437a9914f2bd3a177c5c7a7efd4i0', // RAGE
    'c68924eb89713ae2b169f3cf65c94c7f01d67130eb59987f861a5ace93733c11i0', // PARANOIA
  ];
  
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
  
  // Konvertiere Delegates zu WalletCard-Format + Filter auf Black & Wild Projekt
  const cards: WalletCard[] = delegates
    .filter(delegate => {
      // Filtere mock IDs raus
      const isValid = !delegate.delegateInscriptionId.startsWith('mock-');
      if (!isValid) {
        console.log(`[Gallery] ⏳ Skipping mock inscription: ${delegate.delegateInscriptionId}`);
        return false;
      }
      
      // 🎯 PROJEKT-BASIERTER FILTER: Nur Black & Wild Karten (via originalInscriptionId)
      const isBlackWild = delegate.originalInscriptionId && 
        BLACK_WILD_ORIGINALS.includes(delegate.originalInscriptionId);
      
      if (!isBlackWild) {
        console.log(`[Gallery] 🚫 Not a Black & Wild card: ${delegate.name} (${delegate.originalInscriptionId || 'no original ID'})`);
      }
      
      return isBlackWild;
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

