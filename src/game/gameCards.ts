/**
 * Game Cards Database
 * Alle 46 Karten mit strukturierten Effect-Definitionen für die Game Engine
 * KEIN Text-Parsing - alle Effekte sind maschinenlesbar definiert
 */

export type EffectTrigger = 
  | 'onPlay' 
  | 'onAttack' 
  | 'onDeath' 
  | 'onDamage' 
  | 'onTurnStart' 
  | 'onTurnEnd'
  | 'static'
  | 'onAnimalDeath'
  | 'onDraw';

export type EffectAction = 
  | 'deal_damage'
  | 'draw_card'
  | 'destroy_target'
  | 'modify_attack'
  | 'modify_hp'
  | 'prevent_attack'
  | 'attach_status'
  | 'remove_status'
  | 'gain_life'
  | 'lose_life'
  | 'swap_control'
  | 'copy_effect'
  | 'prevent_draw'
  | 'double_damage'
  | 'force_attack'
  | 'status_immunity'
  | 'target_immunity'
  | 'damage_modifier'
  | 'look_hand'
  | 'discard_hand'
  | 'cancel_action'
  | 'trigger_ability'
  | 'freeze_animal'
  | 'play_additional_animal'
  | 'return_status'
  | 'destroy_self';

export interface EffectDefinition {
  trigger: EffectTrigger;
  action: EffectAction;
  target?: 'self' | 'any' | 'enemy_animal' | 'friendly_animal' | 'all_animals' | 'opponent' | 'player' | 'random_animal' | 'random_enemy_animal' | 'friendly_animals_except_self' | 'opponent_hand' | 'discard_pile';
  value?: number;
  filter?: {
    statusTag?: 'negative' | 'positive' | 'neutral';
    statusName?: string;
    cardType?: 'action' | 'animal' | 'status';
    atkMax?: number;
    atkMin?: number;
  };
  condition?: string;
  duration?: 'until_end_of_turn' | 'permanent';
}

export interface GameCard {
  id: string;
  name: string;
  type: 'animal' | 'action' | 'status';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mystic-legendary';
  atk?: number; // Nur für Animals
  hp?: number; // Nur für Animals
  inscriptionId: string;
  effectText: string; // Für Anzeige
  effects: EffectDefinition[];
  tags?: string[]; // Für Status-Karten: negative, positive, neutral
  maxCopies?: number; // Max. Kopien im Deck
}

// Status-Kategorien (Engine-Level Definition)
export const STATUS_CATEGORIES = {
  negative: ['BLEEDING', 'STUCK', 'TINT', 'TARGET', 'PARANOIA'],
  positive: ['SHIELD', 'RAGE'],
  neutral: ['SWARM'],
};

// ANIMAL CARDS (26)
export const GAME_ANIMAL_CARDS: GameCard[] = [
  // COMMON
  {
    id: 'card-1',
    name: 'Grasshopper',
    type: 'animal',
    rarity: 'common',
    atk: 1,
    hp: 1,
    inscriptionId: '62de7de2fba34ce0b5718e94970c19f5965b131316b9615c3c2c61421cb51e76i0',
    effectText: 'When this animal attacks, draw 1 card.',
    effects: [
      {
        trigger: 'onAttack',
        action: 'draw_card',
        value: 1,
        target: 'self',
      },
    ],
  },
  {
    id: 'card-2',
    name: 'Ant',
    type: 'animal',
    rarity: 'common',
    atk: 1,
    hp: 2,
    inscriptionId: '446045d1613fb57610840eb1c6ba1491d5b0ea9624f7bda585e5f52e256f91e1i0',
    effectText: 'If you control another Ant, this animal gets +1 ATK.',
    effects: [
      {
        trigger: 'static',
        action: 'modify_attack',
        value: 1,
        target: 'self',
        condition: 'has_another_ant',
      },
    ],
  },
  {
    id: 'card-3',
    name: 'Bee',
    type: 'animal',
    rarity: 'common',
    atk: 2,
    hp: 1,
    inscriptionId: '3aef296ead63f20a39c06ca04fc696dd98c532d6b595088fc58176cb46d1beaai0',
    effectText: 'When this animal dies, deal 1 damage to any target.',
    effects: [
      {
        trigger: 'onDeath',
        action: 'deal_damage',
        value: 1,
        target: 'any',
      },
    ],
  },
  {
    id: 'card-4',
    name: 'Chicken',
    type: 'animal',
    rarity: 'common',
    atk: 1,
    hp: 3,
    inscriptionId: 'c907865db233272d06a262c19da7379d4d36f1088dd825375b29a73686a3a184i0',
    effectText: 'This animal cannot attack.',
    effects: [
      {
        trigger: 'static',
        action: 'prevent_attack',
        target: 'self',
      },
    ],
  },
  {
    id: 'card-5',
    name: 'Worm',
    type: 'animal',
    rarity: 'common',
    atk: 0,
    hp: 2,
    inscriptionId: '7d91a2bb93f5ddfba2b16a6f0f463412e0faf12c46ca59cb2d76ec3b0bd3cf49i0',
    effectText: 'When this animal dies, draw 1 card.',
    effects: [
      {
        trigger: 'onDeath',
        action: 'draw_card',
        value: 1,
        target: 'self',
      },
    ],
  },
  {
    id: 'card-6',
    name: 'Spider',
    type: 'animal',
    rarity: 'common',
    atk: 1,
    hp: 2,
    inscriptionId: '8564dd1ffef7bb5e2501819e562d4f98d123959899a3348a8def8dc4e3c7409di0',
    effectText: 'When this animal is played, attach STUCK to an enemy animal.',
    effects: [
      {
        trigger: 'onPlay',
        action: 'attach_status',
        target: 'enemy_animal',
        filter: { statusName: 'STUCK' },
      },
    ],
  },
  {
    id: 'card-7',
    name: 'Butterfly',
    type: 'animal',
    rarity: 'common',
    atk: 0,
    hp: 1,
    inscriptionId: '433c855aa38cc7b142dacaff65cfe9d58f2a79c40c87ddff56c3a283972a6a52i0',
    effectText: 'When played, draw 2 cards. Destroy this animal at end of turn.',
    effects: [
      {
        trigger: 'onPlay',
        action: 'draw_card',
        value: 2,
        target: 'self',
      },
      {
        trigger: 'onTurnEnd',
        action: 'destroy_self',
        target: 'self',
      },
    ],
  },
  // UNCOMMON
  {
    id: 'card-8',
    name: 'Worm',
    type: 'animal',
    rarity: 'uncommon',
    atk: 1,
    hp: 3,
    inscriptionId: 'f56c0801566cb9e46e1465f1d760f8976ba0bad328e39e84fa2e2209a4d6c540i0',
    effectText: 'When this animal dies, draw 2 cards.',
    effects: [
      {
        trigger: 'onDeath',
        action: 'draw_card',
        value: 2,
        target: 'self',
      },
    ],
  },
  {
    id: 'card-9',
    name: 'Bird',
    type: 'animal',
    rarity: 'uncommon',
    atk: 2,
    hp: 2,
    inscriptionId: 'd021efd186eb10c45fbdf043bf974e211772fce336d8287f02f85b6a06b2d8d9i0',
    effectText: 'This animal is unaffected by STUCK.',
    effects: [
      {
        trigger: 'static',
        action: 'status_immunity',
        filter: { statusName: 'STUCK' },
      },
    ],
  },
  {
    id: 'card-10',
    name: 'Bird',
    type: 'animal',
    rarity: 'uncommon',
    atk: 3,
    hp: 1,
    inscriptionId: '9ffd078c797dfdcbb6f72482f5499c124dd67c47044ccda1a1c42bf89926f2f0i0',
    effectText: 'When this animal attacks, deal 1 damage to itself.',
    effects: [
      {
        trigger: 'onAttack',
        action: 'deal_damage',
        value: 1,
        target: 'self',
      },
    ],
  },
  {
    id: 'card-11',
    name: 'Cow',
    type: 'animal',
    rarity: 'uncommon',
    atk: 2,
    hp: 4,
    inscriptionId: '7f2a4963ed0c4e341db74d82dcc8c8fc0cdf4c84d7c1558f13b33b9ca6ef7251i0',
    effectText: 'Other animals you control cannot attack.',
    effects: [
      {
        trigger: 'static',
        action: 'prevent_attack',
        target: 'friendly_animals_except_self',
      },
    ],
  },
  {
    id: 'card-12',
    name: 'Cow',
    type: 'animal',
    rarity: 'uncommon',
    atk: 1,
    hp: 5,
    inscriptionId: '171f1741831bb019ee18e2a92dae9c711abf07e153641a4c1ceaa5892133032ci0',
    effectText: 'At the start of your turn, gain 1 life.',
    effects: [
      {
        trigger: 'onTurnStart',
        action: 'gain_life',
        value: 1,
        target: 'self',
      },
    ],
  },
  {
    id: 'card-13',
    name: 'Pig',
    type: 'animal',
    rarity: 'uncommon',
    atk: 2,
    hp: 3,
    inscriptionId: 'pig-inscription-id-placeholder', // TODO: Add real inscription ID when available
    effectText: 'When this animal is damaged, draw 1 card.',
    effects: [
      {
        trigger: 'onDamage',
        action: 'draw_card',
        value: 1,
        target: 'self',
      },
    ],
  },
  // RARE
  {
    id: 'card-14',
    name: 'Tiger',
    type: 'animal',
    rarity: 'rare',
    atk: 4,
    hp: 3,
    inscriptionId: '195209f7e21b768fd7ca18a905ddac9ec4986412f4f8aa716290fbb743db6feai0',
    effectText: 'When this animal attacks, destroy a random enemy animal.',
    effects: [
      {
        trigger: 'onAttack',
        action: 'destroy_target',
        target: 'random_enemy_animal',
      },
    ],
  },
  {
    id: 'card-15',
    name: 'Rabbit',
    type: 'animal',
    rarity: 'rare',
    atk: 1,
    hp: 2,
    inscriptionId: 'a0b9f4f33913f512ba4de73b1e4982cf5be76874062287fcd05efdd76a220a7fi0',
    effectText: 'When played, play an additional animal this turn.',
    effects: [
      {
        trigger: 'onPlay',
        action: 'play_additional_animal',
        target: 'self',
      },
    ],
  },
  {
    id: 'card-17',
    name: 'Duck',
    type: 'animal',
    rarity: 'rare',
    atk: 2,
    hp: 3,
    inscriptionId: 'a831e75a67d49d6e98594991cde68da3bf5f328ff49cc94a4a6bc05887ff8523i0',
    effectText: 'When this animal attacks, return a random Status card to its owner\'s discard.',
    effects: [
      {
        trigger: 'onAttack',
        action: 'return_status',
        target: 'random_animal',
      },
    ],
  },
  {
    id: 'card-18',
    name: 'Crow',
    type: 'animal',
    rarity: 'rare',
    atk: 2,
    hp: 2,
    inscriptionId: 'd67b09d7ac06aa9c217f95c69bf5c76f7f1634cad92fff5829546a22a279072ci0',
    effectText: 'When played, look at opponent\'s hand. Choose one card to discard.',
    effects: [
      {
        trigger: 'onPlay',
        action: 'look_hand',
        target: 'opponent_hand',
      },
    ],
  },
  {
    id: 'card-19',
    name: 'Cat',
    type: 'animal',
    rarity: 'rare',
    atk: 3,
    hp: 2,
    inscriptionId: 'e07446928e95b81b406592bf95007fb44948c252947304a7b31d34f84e96188ei0',
    effectText: 'This animal can attack twice each Attack Phase.',
    effects: [
      {
        trigger: 'static',
        action: 'modify_attack',
        value: 0, // Special: allows double attack
        target: 'self',
        condition: 'can_attack_twice',
      },
    ],
  },
  {
    id: 'card-20',
    name: 'Gecko',
    type: 'animal',
    rarity: 'rare',
    atk: 2,
    hp: 2,
    inscriptionId: '9ad47ae89b8155ea8e4b02f53d4ced920d6dd4aeeaa744b99c44d33265827c44i0',
    effectText: 'This animal ignores all negative Status effects.',
    effects: [
      {
        trigger: 'static',
        action: 'status_immunity',
        filter: { statusTag: 'negative' },
      },
    ],
  },
  // EPIC
  {
    id: 'card-21',
    name: 'Zebra',
    type: 'animal',
    rarity: 'epic',
    atk: 3,
    hp: 4,
    inscriptionId: '3099b73fd35e81a8bf53a02af99f436d88b73b54945aaa97dfde155a08e174bdi0',
    effectText: 'Whenever another animal dies, this animal gets +1 ATK.',
    effects: [
      {
        trigger: 'onAnimalDeath',
        action: 'modify_attack',
        value: 1,
        target: 'self',
      },
    ],
  },
  {
    id: 'card-22',
    name: 'Sheep',
    type: 'animal',
    rarity: 'epic',
    atk: 1,
    hp: 4,
    inscriptionId: '4d2d4a2b258b18b95bfc55dc3c31cbcd4b204a4f001c9861793b993487af4560i0',
    effectText: 'Damage dealt to your other animals is reduced by 1.',
    effects: [
      {
        trigger: 'static',
        action: 'damage_modifier',
        value: -1,
        target: 'friendly_animals_except_self',
      },
    ],
  },
  {
    id: 'card-23',
    name: 'Turtle',
    type: 'animal',
    rarity: 'epic',
    atk: 1,
    hp: 6,
    inscriptionId: '3135eb862f9c56bf1884c05dd80bb28107ba9af82bed83fd39a1ff28e303a8a7i0',
    effectText: 'This animal takes 1 less damage from all sources.',
    effects: [
      {
        trigger: 'static',
        action: 'damage_modifier',
        value: -1,
        target: 'self',
      },
    ],
  },
  {
    id: 'card-24',
    name: 'Penguin',
    type: 'animal',
    rarity: 'epic',
    atk: 2,
    hp: 3,
    inscriptionId: '2cd0572f35441d5b443ad9c78ec62f84f9b6c77528903c86b8b23b9213f0e7c4i0',
    effectText: 'When this animal attacks, freeze an enemy animal (it cannot attack next turn).',
    effects: [
      {
        trigger: 'onAttack',
        action: 'freeze_animal',
        target: 'enemy_animal',
      },
    ],
  },
  {
    id: 'card-25',
    name: 'Koala',
    type: 'animal',
    rarity: 'epic',
    atk: 2,
    hp: 5,
    inscriptionId: '4f6cce4ab7433ef48222e0a974c3a546f102cf38a455368757f5d5e00bfc1dddi0',
    effectText: 'This animal cannot be targeted by Action cards.',
    effects: [
      {
        trigger: 'static',
        action: 'target_immunity',
        filter: { cardType: 'action' },
      },
    ],
  },
  // LEGENDARY
  {
    id: 'card-26',
    name: 'Fox',
    type: 'animal',
    rarity: 'legendary',
    atk: 3,
    hp: 3,
    inscriptionId: 'e1a16dd9dea8b6ade622d24214c21ec29029127d40aa8ad44aa07c39f4620866i0',
    effectText: 'When played, copy the effect of any Action card in a discard pile.',
    effects: [
      {
        trigger: 'onPlay',
        action: 'copy_effect',
        target: 'discard_pile',
      },
    ],
  },
  {
    id: 'card-27',
    name: 'Octopus',
    type: 'animal',
    rarity: 'legendary',
    atk: 4,
    hp: 4,
    inscriptionId: 'd52730b2f4b8c0095ad82853e3e27d72adaa65796dbb666d929d7ca36f570ad2i0',
    effectText: 'At the start of your turn, choose one enemy animal. It does not attack this turn.',
    effects: [
      {
        trigger: 'onTurnStart',
        action: 'prevent_attack',
        target: 'enemy_animal',
      },
    ],
  },
  // MYSTIC LEGENDARY
  {
    id: 'card-28',
    name: 'Ape',
    type: 'animal',
    rarity: 'mystic-legendary',
    atk: 5,
    hp: 5,
    inscriptionId: '3898219212c8a1c66564e60734ab01872315c3900ef782b466caf4ae58c2afdbi0',
    effectText: 'When this animal dies, both players lose 5 life.',
    effects: [
      {
        trigger: 'onDeath',
        action: 'lose_life',
        value: 5,
        target: 'player', // Both players
      },
    ],
  },
];

// ACTION CARDS (12)
export const GAME_ACTION_CARDS: GameCard[] = [
  {
    id: 'action-1',
    name: 'SLAP',
    type: 'action',
    rarity: 'common',
    inscriptionId: 'ef41bd80183a3d557cfba127b55bee1330ceb6d05e8b4746921b23b55ce133c9i0',
    effectText: 'Deal 2 damage to any target.',
    effects: [
      {
        trigger: 'onPlay',
        action: 'deal_damage',
        value: 2,
        target: 'any',
      },
    ],
  },
  {
    id: 'action-2',
    name: 'WRONG MOVE',
    type: 'action',
    rarity: 'common',
    inscriptionId: 'd7e6610d2dcaed7bf6fb0923e5a8dbe0776dbe07a966b19d9bbbab4eaf298d50i0',
    effectText: 'Destroy an animal with ATK 2 or less.',
    effects: [
      {
        trigger: 'onPlay',
        action: 'destroy_target',
        target: 'any',
        filter: { atkMax: 2 },
      },
    ],
  },
  {
    id: 'action-3',
    name: 'PANIC',
    type: 'action',
    rarity: 'uncommon',
    inscriptionId: '7d6ffeb90550adb8994e52eb6ca56ec42d19b20401a22af9ed959684b9c83ec4i0',
    effectText: 'Both players discard their hands, then draw 3 cards.',
    effects: [
      {
        trigger: 'onPlay',
        action: 'discard_hand',
        target: 'player', // Both players
      },
      {
        trigger: 'onPlay',
        action: 'draw_card',
        value: 3,
        target: 'player', // Both players
      },
    ],
  },
  {
    id: 'action-4',
    name: 'NOPE',
    type: 'action',
    rarity: 'uncommon',
    inscriptionId: 'd1abdfb5c6318bdc45948cd88b03ae8057cf20bf955a6ed7fe7e011a6f895df9i0',
    effectText: 'Cancel an Action card.',
    effects: [
      {
        trigger: 'onPlay',
        action: 'cancel_action',
        target: 'any',
      },
    ],
  },
  {
    id: 'action-5',
    name: 'OVERDOSE',
    type: 'action',
    rarity: 'rare',
    inscriptionId: '37b9fb329a6cf26de3e701da20c0217de97bcd839f18bceac3f43fea563f6b71i0',
    effectText: 'Target animal gets +3 ATK until end of turn. Destroy it at the end of the turn.',
    effects: [
      {
        trigger: 'onPlay',
        action: 'modify_attack',
        value: 3,
        target: 'any',
        duration: 'until_end_of_turn',
      },
      {
        trigger: 'onTurnEnd',
        action: 'destroy_target',
        target: 'self', // Target animal
      },
    ],
  },
  {
    id: 'action-6',
    name: 'SWITCH',
    type: 'action',
    rarity: 'rare',
    inscriptionId: 'fe1490d29120f1277596650462f33341a06a165bc037bb13e93af050935e4d75i0',
    effectText: 'Swap control of two animals in play.',
    effects: [
      {
        trigger: 'onPlay',
        action: 'swap_control',
        target: 'any', // Two animals
      },
    ],
  },
  {
    id: 'action-7',
    name: 'COLLAPSE',
    type: 'action',
    rarity: 'rare',
    inscriptionId: '9c1637a13a9f9c18bc232daefebab50033d14550afc51ea80dce4a6ae8b9d03ai0',
    effectText: 'Deal 1 damage to all animals.',
    effects: [
      {
        trigger: 'onPlay',
        action: 'deal_damage',
        value: 1,
        target: 'all_animals',
      },
    ],
  },
  {
    id: 'action-8',
    name: 'INSTINCT',
    type: 'action',
    rarity: 'epic',
    inscriptionId: '39367bda5c67a2a628261c2b0a3432c23929e864c7c12c5264b77d53341ecce0i0',
    effectText: 'Trigger one animal\'s ability again.',
    effects: [
      {
        trigger: 'onPlay',
        action: 'trigger_ability',
        target: 'any',
      },
    ],
  },
  {
    id: 'action-9',
    name: 'STARE',
    type: 'action',
    rarity: 'epic',
    inscriptionId: 'bb48c48089f36680ac736fbb675dc29b9965a2e41a1ecd60dc70b70f9729df51i0',
    effectText: 'Look at your opponent\'s hand. Choose one card – they discard it.',
    effects: [
      {
        trigger: 'onPlay',
        action: 'look_hand',
        target: 'opponent_hand',
      },
    ],
  },
  {
    id: 'action-10',
    name: 'PUSH',
    type: 'action',
    rarity: 'epic',
    inscriptionId: '8da26d78071401ea4e69f16751612ae879543b438064a05ea89b17d0e7a92d99i0',
    effectText: 'Target animal attacks immediately.',
    effects: [
      {
        trigger: 'onPlay',
        action: 'force_attack',
        target: 'any',
      },
    ],
  },
  {
    id: 'action-11',
    name: 'ACCIDENT',
    type: 'action',
    rarity: 'legendary',
    inscriptionId: '5687d374883dddcc97913fd286e180351443f9fd8f98af0f9e0f6bf199f5cde5i0',
    effectText: 'Destroy a random animal.',
    effects: [
      {
        trigger: 'onPlay',
        action: 'destroy_target',
        target: 'random_animal',
      },
    ],
  },
  {
    id: 'action-12',
    name: 'LAST WORDS',
    type: 'action',
    rarity: 'legendary',
    inscriptionId: 'e6ac9fab61f8e30fb58c5d9224681ad2c1a9f064eb523c4a264a562648a486f9i0',
    effectText: 'When an animal dies this turn, draw 2 cards.',
    effects: [
      {
        trigger: 'onAnimalDeath',
        action: 'draw_card',
        value: 2,
        target: 'self',
        duration: 'until_end_of_turn',
      },
    ],
  },
];

// STATUS CARDS (8)
export const GAME_STATUS_CARDS: GameCard[] = [
  {
    id: 'status-1',
    name: 'BLEEDING',
    type: 'status',
    rarity: 'common',
    inscriptionId: '70b7048c1567f00c77aa05aa95db48d6838c4592a7d5c6d37e127667f9275050i0',
    effectText: 'Attached animal loses 1 HP at the start of each turn.',
    tags: ['negative'],
    effects: [
      {
        trigger: 'onTurnStart',
        action: 'deal_damage',
        value: 1,
        target: 'self', // Attached animal
      },
    ],
  },
  {
    id: 'status-2',
    name: 'STUCK',
    type: 'status',
    rarity: 'common',
    inscriptionId: 'f11b5ddc8a0a25a7cec94bc15c3fa32311808fe2cb87c2cea763f0d50c8b8e83i0',
    effectText: 'Attached animal cannot attack.',
    tags: ['negative'],
    effects: [
      {
        trigger: 'static',
        action: 'prevent_attack',
        target: 'self', // Attached animal
      },
    ],
  },
  {
    id: 'status-3',
    name: 'TINT',
    type: 'status',
    rarity: 'uncommon',
    inscriptionId: '1656be81e09e210983360e549155c9115ff9411019ca24692ea77f4991a2afa5i0',
    effectText: '−1 ATK. When this animal dies, draw 1 card.',
    tags: ['negative'],
    effects: [
      {
        trigger: 'static',
        action: 'modify_attack',
        value: -1,
        target: 'self',
      },
      {
        trigger: 'onDeath',
        action: 'draw_card',
        value: 1,
        target: 'self',
      },
    ],
  },
  {
    id: 'status-4',
    name: 'TARGET',
    type: 'status',
    rarity: 'uncommon',
    inscriptionId: '27442fdd682add2aa8d10846e506ed29891b76cb09e4923d640bf83f392241a0i0',
    effectText: 'Damage dealt to this animal is doubled.',
    tags: ['negative'],
    effects: [
      {
        trigger: 'static',
        action: 'double_damage',
        target: 'self',
      },
    ],
  },
  {
    id: 'status-5',
    name: 'SWARM',
    type: 'status',
    rarity: 'rare',
    inscriptionId: 'cf331de8d1d45a3759c80d6ca20409ac80bf4602c855396a101d1eb08cb36fc5i0',
    effectText: 'Whenever an animal dies, both players take 1 damage.',
    tags: ['neutral'],
    effects: [
      {
        trigger: 'onAnimalDeath',
        action: 'deal_damage',
        value: 1,
        target: 'player', // Both players
      },
    ],
  },
  {
    id: 'status-6',
    name: 'SHIELD',
    type: 'status',
    rarity: 'epic',
    inscriptionId: 'd226c067ad6f7e083a7612d8b357051b824bdd63ca7bee7080611634abd28a1ai0',
    effectText: 'Prevent the next damage dealt to attached animal, then discard SHIELD.',
    tags: ['positive'],
    effects: [
      {
        trigger: 'static',
        action: 'prevent_attack', // Special: prevents next damage
        target: 'self',
        condition: 'prevent_next_damage_then_discard',
      },
    ],
  },
  {
    id: 'status-7',
    name: 'RAGE',
    type: 'status',
    rarity: 'epic',
    inscriptionId: '0c7d863936f3c02134c472de45c7f5a2a0bce437a9914f2bd3a177c5c7a7efd4i0',
    effectText: '+2 ATK. This animal must attack if able.',
    tags: ['positive'],
    effects: [
      {
        trigger: 'static',
        action: 'modify_attack',
        value: 2,
        target: 'self',
      },
      {
        trigger: 'static',
        action: 'force_attack',
        target: 'self',
      },
    ],
  },
  {
    id: 'status-8',
    name: 'PARANOIA',
    type: 'status',
    rarity: 'legendary',
    inscriptionId: 'c68924eb89713ae2b169f3cf65c94c7f01d67130eb59987f861a5ace93733c11i0',
    effectText: 'The controller of this card cannot draw cards.',
    tags: ['negative'],
    effects: [
      {
        trigger: 'static',
        action: 'prevent_draw',
        target: 'player', // Controller
      },
    ],
  },
];

// Alle Karten zusammen
export const ALL_GAME_CARDS: GameCard[] = [
  ...GAME_ANIMAL_CARDS,
  ...GAME_ACTION_CARDS,
  ...GAME_STATUS_CARDS,
];

// Helper: Finde Karte nach ID
export const getGameCardById = (id: string): GameCard | undefined => {
  return ALL_GAME_CARDS.find(card => card.id === id);
};

// Helper: Finde Karte nach Name
export const getGameCardByName = (name: string): GameCard | undefined => {
  return ALL_GAME_CARDS.find(card => card.name === name);
};

