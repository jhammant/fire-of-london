// Pure text helpers for the panel and the live region. No DOM, no engine imports.

const FLAMMABLE = ['house', 'warehouse', 'stone'];

const TYPE_NAMES = {
  house: 'Timber houses',
  warehouse: 'Warehouses of oil, tallow and pitch',
  stone: 'Stone church or hall',
  open: 'Open ground',
  river: 'River',
  wall: 'City wall'
};

const FIRE_LEVEL_WORDS = ['Not burning', 'Catching fire', 'Burning', 'Blazing'];

const PUSH = {
  '0,-1': { arrow: '↑', word: 'north' },
  '1,-1': { arrow: '↗', word: 'north-east' },
  '1,0': { arrow: '→', word: 'east' },
  '1,1': { arrow: '↘', word: 'south-east' },
  '0,1': { arrow: '↓', word: 'south' },
  '-1,1': { arrow: '↙', word: 'south-west' },
  '-1,0': { arrow: '←', word: 'west' },
  '-1,-1': { arrow: '↖', word: 'north-west' }
};

const ACTION_DONE = {
  douse: (place) => `Buckets and squirts soak ${place}.`,
  hooks: (place) => `Firehooks pull down the houses at ${place}.`,
  gunpowder: (place) => `Gunpowder blows a gap at ${place}.`,
  evacuate: (place) => `The people of ${place} walk to safety at Moorfields.`,
  guard: (place) => `Men stand guard at ${place}.`,
  appeal: () => 'A rider takes word to the King.'
};

/** Returns '1 thing' or '2 things' with the number written with commas. */
export function plural(count, singular, pluralWord) {
  return `${formatNumber(count)} ${count === 1 ? singular : pluralWord}`;
}

/** Writes a whole number with thousands commas, for example 13200 -> '13,200'. */
export function formatNumber(value) {
  const n = Math.round(Number(value) || 0);
  const sign = n < 0 ? '-' : '';
  return sign + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Returns the player-facing name of a tile type. */
export function tileTypeName(type) {
  return TYPE_NAMES[type] || 'Unknown ground';
}

/** Returns one of 'Not burning', 'Catching fire', 'Burning', 'Blazing', 'Burnt out' or 'Firebreak'. */
export function fireWord(tile) {
  if (tile.cleared) return 'Firebreak';
  if (tile.burnt) return 'Burnt out';
  return FIRE_LEVEL_WORDS[tile.fire] || FIRE_LEVEL_WORDS[0];
}

/** Turns an action cost into text such as '2 actions, 4 men, 1 goodwill'; zero parts are left out. */
export function costText(cost = {}) {
  const parts = [];
  if (cost.ap) parts.push(plural(cost.ap, 'action', 'actions'));
  if (cost.men) parts.push(plural(cost.men, 'man', 'men'));
  if (cost.powder) parts.push(plural(cost.powder, 'gunpowder barrel', 'gunpowder barrels'));
  if (cost.goodwill) parts.push(`${formatNumber(cost.goodwill)} goodwill`);
  return parts.length ? parts.join(', ') : 'Free';
}

/** Returns the arrow and compass word for where the wind pushes the fire, or null when calm. */
export function windPush(wind) {
  if (!wind || !wind.strength) return null;
  return PUSH[`${wind.dx},${wind.dy}`] || null;
}

/** Returns the wind label plus an arrow showing where the fire is pushed, for example 'Strong easterly gale ←'. */
export function windText(wind) {
  if (!wind) return '';
  const push = windPush(wind);
  return push ? `${wind.label} ${push.arrow}` : wind.label;
}

/** Returns a short sentence about the wind for screen readers. */
export function windSentence(wind) {
  if (!wind) return '';
  const push = windPush(wind);
  if (!push) return `${wind.label}. The air is still.`;
  return `${wind.label}. It pushes the fire ${push.word}.`;
}

/** Names a place on the map: the landmark, else the district, else the square. */
export function placeName({ x, y, landmarkName = null, districtName = null }) {
  return landmarkName || districtName || squareName(x, y);
}

/** Returns 'column 3, row 5' for the zero-based square x 2, y 4. */
export function squareName(x, y) {
  return `column ${x + 1}, row ${y + 1}`;
}

/** Returns the log line for a successful action. */
export function actionDoneText(actionId, label, place) {
  const make = ACTION_DONE[actionId];
  return make ? make(place) : `${label}: done at ${place}.`;
}

/** Returns the end-of-turn announcement, for example 'Sunday 2 September, 7am. 3 new places caught fire.' */
export function turnSummary(timeLabel, newFires) {
  if (newFires === 0) return `${timeLabel}. No new places caught fire.`;
  const places = newFires === 1 ? 'new place' : 'new places';
  return `${timeLabel}. ${formatNumber(newFires)} ${places} caught fire.`;
}

/** Describes a tile for the panel and the live region: { heading, status, rows, summary }. */
export function describeTile(tile, info = {}) {
  const { x = 0, y = 0, landmarkName = null, districtName = null, evacuated = false } = info;
  const typeName = tileTypeName(tile.type);
  const flammable = FLAMMABLE.includes(tile.type);
  const status = flammable ? fireWord(tile) : 'Never burns';
  const heading = landmarkName || typeName;
  const rows = [];
  if (landmarkName) rows.push({ label: 'Kind', value: typeName });
  rows.push({ label: 'Fire', value: status });
  if (districtName) rows.push({ label: 'District', value: districtName });
  if (flammable) {
    rows.push({ label: 'Houses', value: formatNumber(tile.houses) });
    rows.push({ label: 'People', value: peopleText(tile.people, evacuated) });
  }
  if (tile.wet) rows.push({ label: 'Water', value: 'Soaked, so hard to set alight' });
  if (tile.guard > 0) rows.push({ label: 'Men on guard', value: formatNumber(tile.guard) });
  rows.push({ label: 'Square', value: capitalise(squareName(x, y)) });
  let summary = `${heading}, ${squareName(x, y)}. ${status}.`;
  if (flammable) summary += ` ${plural(tile.people, 'person', 'people')} here.`;
  return { heading, status, rows, summary };
}

function peopleText(people, evacuated) {
  if (people > 0) return formatNumber(people);
  return evacuated ? 'Everyone has gone to Moorfields' : 'Nobody here now';
}

function capitalise(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
