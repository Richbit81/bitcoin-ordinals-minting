import { Card, Rarity } from '../types/wallet';

/**
 * Konvertiert SVG von schwarz zu weiß
 */
const svgToWhite = (svgString: string): string => {
  return svgString
    .replace(/stroke="black"/g, 'stroke="white"')
    .replace(/fill="black"/g, 'fill="white"')
    .replace(/stroke='black'/g, "stroke='white'")
    .replace(/fill='black'/g, "fill='white'");
};

export const ACTION_CARDS: Card[] = [
  {
    id: 'action-1',
    name: 'SLAP',
    rarity: 'common',
    inscriptionId: 'ef41bd80183a3d557cfba127b55bee1330ceb6d05e8b4746921b23b55ce133c9i0',
    cardType: 'action',
    effect: 'Deal 2 damage to any target.',
    svgIcon: svgToWhite(`<svg viewBox="0 0 24 24">
      <line x1="6" y1="18" x2="18" y2="6" stroke="white" stroke-width="2"/>
      <line x1="18" y1="6" x2="21" y2="6" stroke="white" stroke-width="2"/>
      <line x1="18" y1="6" x2="18" y2="3" stroke="white" stroke-width="2"/>
    </svg>`),
  },
  {
    id: 'action-2',
    name: 'WRONG MOVE',
    rarity: 'common',
    inscriptionId: 'd7e6610d2dcaed7bf6fb0923e5a8dbe0776dbe07a966b19d9bbbab4eaf298d50i0',
    cardType: 'action',
    effect: 'Destroy an animal with ATK 2 or less.',
    svgIcon: svgToWhite(`<svg viewBox="0 0 24 24">
      <polyline points="4,8 12,8 12,14 20,14" fill="none" stroke="white" stroke-width="2"/>
      <line x1="11" y1="13" x2="13" y2="15" stroke="white" stroke-width="2"/>
    </svg>`),
  },
  {
    id: 'action-3',
    name: 'PANIC',
    rarity: 'uncommon',
    inscriptionId: '7d6ffeb90550adb8994e52eb6ca56ec42d19b20401a22af9ed959684b9c83ec4i0',
    cardType: 'action',
    effect: 'Both players discard their hands, then draw 3 cards.',
    svgIcon: svgToWhite(`<svg viewBox="0 0 24 24">
      <path d="M12 3 L17 8 L12 13 L7 8 Z" fill="none" stroke="white" stroke-width="2"/>
      <line x1="3" y1="12" x2="7" y2="12" stroke="white" stroke-width="2"/>
      <line x1="17" y1="12" x2="21" y2="12" stroke="white" stroke-width="2"/>
    </svg>`),
  },
  {
    id: 'action-4',
    name: 'NOPE',
    rarity: 'uncommon',
    inscriptionId: 'd1abdfb5c6318bdc45948cd88b03ae8057cf20bf955a6ed7fe7e011a6f895df9i0',
    cardType: 'action',
    effect: 'Cancel an action card.',
    svgIcon: svgToWhite(`<svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" fill="none" stroke="white" stroke-width="2"/>
      <line x1="6" y1="18" x2="18" y2="6" stroke="white" stroke-width="2"/>
    </svg>`),
  },
  {
    id: 'action-5',
    name: 'OVERDOSE',
    rarity: 'rare',
    inscriptionId: '37b9fb329a6cf26de3e701da20c0217de97bcd839f18bceac3f43fea563f6b71i0',
    cardType: 'action',
    effect: 'Target animal gets +3 ATK until end of turn. Destroy it at the end of the turn.',
    svgIcon: svgToWhite(`<svg viewBox="0 0 24 24">
      <line x1="12" y1="20" x2="12" y2="4" stroke="white" stroke-width="2"/>
      <line x1="8" y1="8" x2="12" y2="4" stroke="white" stroke-width="2"/>
      <line x1="16" y1="8" x2="12" y2="4" stroke="white" stroke-width="2"/>
      <line x1="9" y1="18" x2="15" y2="12" stroke="white" stroke-width="2"/>
    </svg>`),
  },
  {
    id: 'action-6',
    name: 'SWITCH',
    rarity: 'rare',
    inscriptionId: 'fe1490d29120f1277596650462f33341a06a165bc037bb13e93af050935e4d75i0',
    cardType: 'action',
    effect: 'Swap control of two animals in play.',
    svgIcon: svgToWhite(`<svg viewBox="0 0 24 24">
      <polyline points="5,8 19,8 15,4" fill="none" stroke="white" stroke-width="2"/>
      <polyline points="19,16 5,16 9,20" fill="none" stroke="white" stroke-width="2"/>
    </svg>`),
  },
  {
    id: 'action-7',
    name: 'COLLAPSE',
    rarity: 'rare',
    inscriptionId: '9c1637a13a9f9c18bc232daefebab50033d14550afc51ea80dce4a6ae8b9d03ai0',
    cardType: 'action',
    effect: 'Deal 1 damage to all animals.',
    svgIcon: svgToWhite(`<svg viewBox="0 0 24 24">
      <line x1="4" y1="10" x2="20" y2="10" stroke="white" stroke-width="2"/>
      <polyline points="10,10 14,14 18,14" fill="none" stroke="white" stroke-width="2"/>
    </svg>`),
  },
  {
    id: 'action-8',
    name: 'INSTINCT',
    rarity: 'epic',
    inscriptionId: '39367bda5c67a2a628261c2b0a3432c23929e864c7c12c5264b77d53341ecce0i0',
    cardType: 'action',
    effect: 'Trigger one animal\'s ability again.',
    svgIcon: svgToWhite(`<svg viewBox="0 0 24 24">
      <ellipse cx="12" cy="12" rx="8" ry="5" fill="none" stroke="white" stroke-width="2"/>
      <circle cx="12" cy="12" r="2" fill="white"/>
    </svg>`),
  },
  {
    id: 'action-9',
    name: 'STARE',
    rarity: 'epic',
    inscriptionId: 'bb48c48089f36680ac736fbb675dc29b9965a2e41a1ecd60dc70b70f9729df51i0',
    cardType: 'action',
    effect: 'Look at your opponent\'s hand. Choose one card – they discard it.',
    svgIcon: svgToWhite(`<svg viewBox="0 0 24 24">
      <ellipse cx="10" cy="12" rx="5" ry="4" fill="none" stroke="white" stroke-width="2"/>
      <line x1="15" y1="12" x2="21" y2="12" stroke="white" stroke-width="2"/>
    </svg>`),
  },
  {
    id: 'action-10',
    name: 'PUSH',
    rarity: 'epic',
    inscriptionId: '8da26d78071401ea4e69f16751612ae879543b438064a05ea89b17d0e7a92d99i0',
    cardType: 'action',
    effect: 'Target animal attacks immediately.',
    svgIcon: svgToWhite(`<svg viewBox="0 0 24 24">
      <line x1="4" y1="12" x2="18" y2="12" stroke="white" stroke-width="3"/>
      <polyline points="14,8 18,12 14,16" fill="none" stroke="white" stroke-width="3"/>
    </svg>`),
  },
  {
    id: 'action-11',
    name: 'ACCIDENT',
    rarity: 'legendary',
    inscriptionId: '5687d374883dddcc97913fd286e180351443f9fd8f98af0f9e0f6bf199f5cde5i0',
    cardType: 'action',
    effect: 'Destroy a random animal.',
    svgIcon: svgToWhite(`<svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="2" fill="white"/>
      <circle cx="6" cy="8" r="1.5" fill="white"/>
      <circle cx="18" cy="7" r="1.5" fill="white"/>
      <circle cx="7" cy="18" r="1.5" fill="white"/>
    </svg>`),
  },
  {
    id: 'action-12',
    name: 'LAST WORDS',
    rarity: 'legendary',
    inscriptionId: 'e6ac9fab61f8e30fb58c5d9224681ad2c1a9f064eb523c4a264a562648a486f9i0',
    cardType: 'action',
    effect: 'When an animal dies this turn, draw 2 cards.',
    svgIcon: svgToWhite(`<svg viewBox="0 0 24 24">
      <line x1="12" y1="6" x2="12" y2="18" stroke="white" stroke-width="2"/>
      <line x1="8" y1="12" x2="16" y2="12" stroke="white" stroke-width="2"/>
      <line x1="16" y1="8" x2="21" y2="6" stroke="white" stroke-width="2"/>
    </svg>`),
  },
];

export const STATUS_CARDS: Card[] = [
  {
    id: 'status-1',
    name: 'BLEEDING',
    rarity: 'common',
    inscriptionId: '70b7048c1567f00c77aa05aa95db48d6838c4592a7d5c6d37e127667f9275050i0',
    cardType: 'status',
    effect: 'Attached animal loses 1 HP at the start of each turn.',
    svgIcon: svgToWhite(`<svg viewBox="0 0 24 24">
      <path d="M12 4 C9 9,9 13,12 16 C15 13,15 9,12 4 Z" fill="white"/>
    </svg>`),
  },
  {
    id: 'status-2',
    name: 'STUCK',
    rarity: 'common',
    inscriptionId: 'f11b5ddc8a0a25a7cec94bc15c3fa32311808fe2cb87c2cea763f0d50c8b8e83i0',
    cardType: 'status',
    effect: 'Attached animal cannot attack.',
    svgIcon: svgToWhite(`<svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="7" fill="none" stroke="white" stroke-width="2"/>
      <line x1="7" y1="7" x2="17" y2="17" stroke="white" stroke-width="2"/>
      <line x1="17" y1="7" x2="7" y2="17" stroke="white" stroke-width="2"/>
    </svg>`),
  },
  {
    id: 'status-3',
    name: 'TINT',
    rarity: 'uncommon',
    inscriptionId: '1656be81e09e210983360e549155c9115ff9411019ca24692ea77f4991a2afa5i0',
    cardType: 'status',
    effect: '−1 ATK. When this animal dies, draw 1 card.',
    svgIcon: svgToWhite(`<svg viewBox="0 0 24 24">
      <path d="M12 4 C6 6,6 14,12 16 C18 14,18 6,12 4 Z" fill="white"/>
    </svg>`),
  },
  {
    id: 'status-4',
    name: 'TARGET',
    rarity: 'uncommon',
    inscriptionId: '27442fdd682add2aa8d10846e506ed29891b76cb09e4923d640bf83f392241a0i0',
    cardType: 'status',
    effect: 'Damage dealt to this animal is doubled.',
    svgIcon: svgToWhite(`<svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" fill="none" stroke="white" stroke-width="2"/>
      <circle cx="12" cy="12" r="4" fill="none" stroke="white" stroke-width="2"/>
    </svg>`),
  },
  {
    id: 'status-5',
    name: 'SWARM',
    rarity: 'rare',
    inscriptionId: 'cf331de8d1d45a3759c80d6ca20409ac80bf4602c855396a101d1eb08cb36fc5i0',
    cardType: 'status',
    effect: 'Whenever an animal dies, both players take 1 damage.',
    svgIcon: svgToWhite(`<svg viewBox="0 0 24 24">
      <circle cx="8" cy="10" r="1.5" fill="white"/>
      <circle cx="12" cy="12" r="1.5" fill="white"/>
      <circle cx="16" cy="10" r="1.5" fill="white"/>
      <circle cx="10" cy="16" r="1.5" fill="white"/>
      <circle cx="14" cy="16" r="1.5" fill="white"/>
    </svg>`),
  },
  {
    id: 'status-6',
    name: 'SHIELD',
    rarity: 'epic',
    inscriptionId: 'd226c067ad6f7e083a7612d8b357051b824bdd63ca7bee7080611634abd28a1ai0',
    cardType: 'status',
    effect: 'Prevent the next damage dealt to attached animal.',
    svgIcon: svgToWhite(`<svg viewBox="0 0 24 24">
      <path d="M6 5 L18 5 L16 18 L12 21 L8 18 Z" fill="none" stroke="white" stroke-width="2"/>
    </svg>`),
  },
  {
    id: 'status-7',
    name: 'RAGE',
    rarity: 'epic',
    inscriptionId: '0c7d863936f3c02134c472de45c7f5a2a0bce437a9914f2bd3a177c5c7a7efd4i0',
    cardType: 'status',
    effect: '+2 ATK. This animal must attack if able.',
    svgIcon: svgToWhite(`<svg viewBox="0 0 24 24">
      <polyline points="4,14 8,8 12,14 16,8 20,14" fill="none" stroke="white" stroke-width="2"/>
    </svg>`),
  },
  {
    id: 'status-8',
    name: 'PARANOIA',
    rarity: 'legendary',
    inscriptionId: 'c68924eb89713ae2b169f3cf65c94c7f01d67130eb59987f861a5ace93733c11i0',
    cardType: 'status',
    effect: 'The controller of this card cannot draw cards.',
    svgIcon: svgToWhite(`<svg viewBox="0 0 24 24">
      <circle cx="8" cy="12" r="2" fill="white"/>
      <circle cx="16" cy="12" r="2" fill="white"/>
      <circle cx="12" cy="6" r="2" fill="white"/>
    </svg>`),
  },
];

// Alle Action/Status-Karten zusammen
export const ALL_ACTION_STATUS_CARDS: Card[] = [
  ...ACTION_CARDS,
  ...STATUS_CARDS,
];

