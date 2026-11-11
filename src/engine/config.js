// Fixed game rules shared by every engine module.

export const LAST_TURN = 16;

export const TILE_TYPES = ['house', 'warehouse', 'stone', 'open', 'river', 'wall'];
export const FLAMMABLE_TYPES = ['house', 'warehouse', 'stone'];

export const DIFFICULTIES = [
  { id: 'easy', label: 'Easy', description: 'More men, gunpowder soon and a fire that spreads a little slower.' },
  { id: 'normal', label: 'Normal', description: 'A fair fight against the fire, much as London faced it.' },
  { id: 'hard', label: 'Hard', description: 'Few men, a slow King and a fire that spreads fast.' }
];

/** Private per-difficulty budgets and fire speed. */
export const DIFFICULTY_SETTINGS = {
  easy: { ap: 6, men: 16, goodwill: 10, appealsNeeded: 1, powderOnAuthority: 4, powderEvery: 1, spread: 0.9 },
  normal: { ap: 5, men: 12, goodwill: 8, appealsNeeded: 2, powderOnAuthority: 3, powderEvery: 2, spread: 1 },
  hard: { ap: 4, men: 10, goodwill: 6, appealsNeeded: 3, powderOnAuthority: 2, powderEvery: 3, spread: 1.15 }
};

export const MAX_GOODWILL = 10;
export const MAX_POWDER = 8;

export const ACTIONS = [
  {
    id: 'douse',
    label: 'Buckets and squirts',
    key: '1',
    cost: { ap: 1, men: 2, powder: 0, goodwill: 0 },
    target: 'tile',
    needsAuthority: false,
    description: 'Throw water on a tile to knock the fire down and soak the houses.'
  },
  {
    id: 'hooks',
    label: 'Firehooks',
    key: '2',
    cost: { ap: 2, men: 4, powder: 0, goodwill: 1 },
    target: 'tile',
    needsAuthority: false,
    description: 'Pull down houses that are not yet burning to make a gap the fire cannot cross.'
  },
  {
    id: 'gunpowder',
    label: 'Gunpowder',
    key: '3',
    cost: { ap: 2, men: 2, powder: 1, goodwill: 2 },
    target: 'tile',
    needsAuthority: true,
    description: 'Blow up a block of houses to make a wide firebreak fast.'
  },
  {
    id: 'evacuate',
    label: 'Evacuate district',
    key: '4',
    cost: { ap: 1, men: 2, powder: 0, goodwill: 0 },
    target: 'tile',
    needsAuthority: false,
    description: 'Lead everyone in a district out to the safety of Moorfields.'
  },
  {
    id: 'guard',
    label: 'Post men',
    key: '5',
    cost: { ap: 1, men: 3, powder: 0, goodwill: 0 },
    target: 'tile',
    needsAuthority: false,
    description: 'Leave men to guard a famous building so it is much harder to burn.'
  },
  {
    id: 'appeal',
    label: 'Send word to the King',
    key: '6',
    cost: { ap: 1, men: 0, powder: 0, goodwill: 0 },
    target: 'none',
    needsAuthority: false,
    description: 'Ask King Charles II for permission to blow up houses with gunpowder.'
  }
];

export const TRIGGERS = [
  'start',
  'first-spread',
  'warehouses',
  'sunday-morning',
  'sunday-afternoon',
  'first-douse',
  'first-hooks',
  'first-gunpowder',
  'first-evacuate',
  'first-guard',
  'authority',
  'bridge',
  'tower',
  'monday',
  'tuesday',
  'tuesday-night',
  'wind-drops',
  'wednesday',
  'end'
];

/** Triggers that fire when the turn counter reaches a given turn. */
export const DATE_TRIGGERS = [
  { turn: 1, id: 'sunday-morning' },
  { turn: 2, id: 'sunday-afternoon' },
  { turn: 5, id: 'monday' },
  { turn: 9, id: 'tuesday' },
  { turn: 11, id: 'tuesday-night' },
  { turn: 13, id: 'wednesday' }
];
