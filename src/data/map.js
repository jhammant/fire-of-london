// Map data for the City of London in 1666, roughly to scale.
// x runs 0 (west) to 27 (east), y runs 0 (north) to 17 (south).

export const COLS = 28;
export const ROWS = 18;

/** Legend character for each tile type. */
export const LEGEND_CHARS = {
  h: 'house',
  W: 'warehouse',
  S: 'stone',
  '.': 'open',
  '~': 'river',
  '#': 'wall'
};

// One string per row, one character per tile (see LEGEND_CHARS).
export const GRID = [
  '~.hhh.hhh........hh.hh......',
  '~.hhhhhhh........hhhhh..hh..',
  '~#######################hh..',
  '~#hhhShhhhhhhhhShhhhhhh#hh..',
  '~#hhhhhhhShhhhhhhh.hhhh#hh..',
  '~#hShhhh.hhhhShhhhhhhhh#hh..',
  '~#hhhhhShhhhSShhhhhhShh#hh..',
  '~#hhShhhhhhhhhhShhhhh.h#hh..',
  '~#hhhhhhhhhhhhhhSShhShh#hh..',
  '~#hhhSShhhShhhShhhhhhhh#hh..',
  '~#hhhSShhhhhShhhhhhhhhh#hh..',
  '~#hhhhhhShhh.hhhShhhhhh#hh..',
  '~#hhhShhhhhhhShhhhhhhhh#hh..',
  '~#hhhhhhhhShhhhhhhhhhhh#....',
  '~#SShhhShhhhhhShhhhhhhhhSSS.',
  '~#SSWWWWWWWWWWWWWWWWWWWWSSS.',
  '~~~~~~~~~~~~~~~~~~h~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~h~~~~~~~~~'
];

/** Letter code used in DISTRICT_GRID for each district id. */
export const DISTRICT_CODES = {
  F: 'farringdon',
  P: 'cripplegate',
  G: 'bishopsgate',
  X: 'portsoken',
  H: 'cheap',
  O: 'cornhill',
  C: 'castle-baynard',
  Q: 'queenhithe',
  D: 'dowgate',
  R: 'bridge',
  B: 'billingsgate',
  T: 'tower'
};

// District of every cell. Only flammable tiles keep their district; the rest get null.
export const DISTRICT_GRID = [
  'PPPPPPPPPPPPPPPPGGGGGGGGXXXX',
  'PPPPPPPPPPPPPPPPGGGGGGGGXXXX',
  'FFFFFFFFFPPPPPPPPPPGGGGGXXXX',
  'FFFFFFFFFPPPPPPPPPPGGGGGXXXX',
  'FFFFFFFFFPPPPPPPPPPGGGGGXXXX',
  'FFFFFFFFFPPPPPPPPPPGGGGGXXXX',
  'FFFFFFFFFHHHHHHOOOOGGGGGXXXX',
  'FFFFFFFFFHHHHHHOOOOGGGGGXXXX',
  'FFFFFFFFFHHHHHHOOOOGGGGGXXXX',
  'FFFFFFFFFHHHHHHOOOOGGGGGXXXX',
  'FFFFFFFFFHHHHHHOOOOGGGGGXXXX',
  'CCCCCCQQQQQDDDDRRRRBBTTTXXXX',
  'CCCCCCQQQQQDDDDRRRRBBTTTXXXX',
  'CCCCCCQQQQQDDDDRRRRBBTTTTTTT',
  'CCCCCCQQQQQDDDDRRRRBBTTTTTTT',
  'CCCCCCQQQQQDDDDRRRRBBTTTTTTT',
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRR',
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRR'
];

/** Districts: real wards and areas of the City, west to east. */
export const DISTRICTS = [
  { id: 'farringdon', name: 'Farringdon' },
  { id: 'castle-baynard', name: 'Castle Baynard' },
  { id: 'queenhithe', name: 'Queenhithe' },
  { id: 'cripplegate', name: 'Cripplegate' },
  { id: 'cheap', name: 'Cheap' },
  { id: 'dowgate', name: 'Dowgate' },
  { id: 'cornhill', name: 'Cornhill' },
  { id: 'bridge', name: 'Bridge' },
  { id: 'billingsgate', name: 'Billingsgate' },
  { id: 'bishopsgate', name: 'Bishopsgate' },
  { id: 'tower', name: 'Tower' },
  { id: 'portsoken', name: 'Portsoken' }
];

const rect = (x0, y0, x1, y1) => {
  const tiles = [];
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) tiles.push([x, y]);
  }
  return tiles;
};

const WEST_WALL = rect(1, 2, 1, 15).filter(([, y]) => y !== 6 && y !== 10);
const NORTH_WALL = rect(2, 2, 23, 2).filter(([x]) => ![6, 10, 13, 19].includes(x));
const EAST_WALL = rect(23, 3, 23, 13).filter(([, y]) => y !== 6);

/** Famous places on the map. scored landmarks count towards the final score. */
export const LANDMARKS = [
  {
    id: 'pudding-lane',
    name: 'Pudding Lane',
    kind: 'bakery',
    tiles: [[19, 13], [19, 14]],
    scored: false,
    blurb: 'Thomas Farriner the King\'s baker had his bakery here, and this is where the fire began.'
  },
  {
    id: 'london-bridge',
    name: 'London Bridge',
    kind: 'bridge',
    tiles: [[18, 16], [18, 17]],
    scored: true,
    blurb: 'The only bridge over the Thames in London, with houses and shops built along it.'
  },
  {
    id: 'thames-street',
    name: 'Thames Street',
    kind: 'street',
    tiles: rect(4, 15, 23, 15),
    scored: false,
    blurb: 'A street of riverside stores packed with oil, tallow, pitch and coal.'
  },
  {
    id: 'royal-exchange',
    name: 'Royal Exchange',
    kind: 'exchange',
    tiles: [[16, 8], [17, 8]],
    scored: true,
    blurb: 'A grand stone building where merchants met to buy and sell from all over the world.'
  },
  {
    id: 'guildhall',
    name: 'Guildhall',
    kind: 'hall',
    tiles: [[12, 6], [13, 6]],
    scored: true,
    blurb: 'The great hall where the Lord Mayor and the City leaders met.'
  },
  {
    id: 'cheapside',
    name: 'Cheapside',
    kind: 'street',
    tiles: rect(7, 8, 13, 8),
    scored: true,
    blurb: 'The busiest shopping street in London, full of goldsmiths and market stalls.'
  },
  {
    id: 'st-pauls',
    name: 'St Paul\'s Cathedral',
    kind: 'cathedral',
    tiles: rect(5, 9, 6, 10),
    scored: true,
    blurb: 'The huge old cathedral on the hill, the biggest building in the City.'
  },
  {
    id: 'baynards-castle',
    name: 'Baynard\'s Castle',
    kind: 'castle',
    tiles: rect(2, 14, 3, 15),
    scored: true,
    blurb: 'A royal palace of stone standing right on the bank of the Thames.'
  },
  {
    id: 'tower',
    name: 'Tower of London',
    kind: 'fortress',
    tiles: rect(24, 14, 26, 15),
    scored: true,
    blurb: 'The old royal fortress by the river, where a great store of gunpowder was kept.'
  },
  {
    id: 'moorfields',
    name: 'Moorfields',
    kind: 'field',
    tiles: rect(11, 0, 15, 1),
    scored: false,
    blurb: 'Open fields outside the north wall where people could camp in safety.'
  },
  {
    id: 'fleet-river',
    name: 'Fleet river',
    kind: 'river',
    tiles: rect(0, 0, 0, 15),
    scored: false,
    blurb: 'A small, smelly river running down the west side of the City into the Thames.'
  },
  {
    id: 'city-wall',
    name: 'City wall',
    kind: 'wall',
    tiles: [...WEST_WALL, ...NORTH_WALL, ...EAST_WALL],
    scored: false,
    blurb: 'The old Roman and medieval wall that still ran around the City.'
  },
  {
    id: 'ludgate',
    name: 'Ludgate',
    kind: 'gate',
    tiles: [[1, 10]],
    scored: false,
    blurb: 'The west gate on the road down from St Paul\'s to Fleet Street.'
  },
  {
    id: 'newgate',
    name: 'Newgate',
    kind: 'gate',
    tiles: [[1, 6]],
    scored: false,
    blurb: 'A west gate that was also a prison.'
  },
  {
    id: 'aldersgate',
    name: 'Aldersgate',
    kind: 'gate',
    tiles: [[6, 2]],
    scored: false,
    blurb: 'A north gate on the road out towards Islington.'
  },
  {
    id: 'cripplegate',
    name: 'Cripplegate',
    kind: 'gate',
    tiles: [[10, 2]],
    scored: false,
    blurb: 'A north gate leading out to the suburb of the same name.'
  },
  {
    id: 'moorgate',
    name: 'Moorgate',
    kind: 'gate',
    tiles: [[13, 2]],
    scored: false,
    blurb: 'A small north gate opening onto Moorfields.'
  },
  {
    id: 'bishopsgate',
    name: 'Bishopsgate',
    kind: 'gate',
    tiles: [[19, 2]],
    scored: false,
    blurb: 'A north gate on the great road to Cambridge and the north.'
  },
  {
    id: 'aldgate',
    name: 'Aldgate',
    kind: 'gate',
    tiles: [[23, 6]],
    scored: false,
    blurb: 'The east gate on the road out to Essex.'
  }
];

/** Thomas Farriner's bakery in Pudding Lane, where the fire started. */
export const START = { x: 19, y: 14 };

/** Houses and people on each tile type before overrides. */
export const TILE_CONTENTS = {
  house: { houses: 66, people: 330 },
  warehouse: { houses: 20, people: 60 },
  stone: { houses: 0, people: 0 },
  open: { houses: 0, people: 0 },
  river: { houses: 0, people: 0 },
  wall: { houses: 0, people: 0 }
};

/** Areas where house tiles hold fewer homes: the suburbs outside the wall and the bridge. */
export const CONTENT_OVERRIDES = [
  { x0: 0, y0: 0, x1: 27, y1: 1, houses: 24, people: 120 },
  { x0: 24, y0: 2, x1: 27, y1: 12, houses: 24, people: 120 },
  { x0: 18, y0: 16, x1: 18, y1: 17, houses: 20, people: 100 }
];
