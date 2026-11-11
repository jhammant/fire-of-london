// The historical wind: an easterly gale until Tuesday evening, then it drops.

const PUSH = {
  N: [0, 1],
  NE: [-1, 1],
  E: [-1, 0],
  SE: [-1, -1],
  S: [0, -1],
  SW: [1, -1],
  W: [1, 0],
  NW: [1, 1]
};

const DIRECTION_WORDS = {
  N: 'northerly',
  NE: 'north-easterly',
  E: 'easterly',
  SE: 'south-easterly',
  S: 'southerly',
  SW: 'south-westerly',
  W: 'westerly',
  NW: 'north-westerly'
};

const labelOf = (from, strength) => {
  const word = DIRECTION_WORDS[from];
  if (strength >= 3) return `Strong ${word} gale`;
  if (strength === 2) return `Strong ${word} wind`;
  if (strength === 1) return `Light ${word} breeze`;
  return 'Calm, hardly any wind';
};

const makeWind = (from, strength) => {
  const [dx, dy] = PUSH[from];
  return { from, strength, dx, dy, label: labelOf(from, strength) };
};

// Strength of the wind on a turn, following the 1666 schedule.
const windStrengthForTurn = (turn) => {
  if (turn <= 10) return 3;
  if (turn === 11) return 2;
  if (turn <= 13) return 1;
  return 0;
};

/** Wind for a turn; rng wobbles the gale between east and north-east. */
export function windForTurn(turn, rng) {
  const strength = windStrengthForTurn(turn);
  if (turn === 0 || strength === 0) return makeWind('E', strength);
  return makeWind(rng.next() < 0.3 ? 'NE' : 'E', strength);
}
