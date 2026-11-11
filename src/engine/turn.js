// Starting a game and ending a turn.

import { COLS, ROWS, START } from '../data/map.js';
import {
  LAST_TURN,
  DIFFICULTY_SETTINGS,
  DATE_TRIGGERS,
  MAX_GOODWILL,
  MAX_POWDER
} from './config.js';
import { normaliseSeed, createRng } from './rng.js';
import { windForTurn } from './wind.js';
import {
  buildTiles,
  cloneState,
  fireTrigger,
  anyBurning,
  updateLostLandmarks,
  postedMen
} from './board.js';
import { spreadFire, growFire } from './fire.js';

const settingsFor = (difficulty) => {
  const settings = DIFFICULTY_SETTINGS[difficulty];
  if (!settings) throw new Error(`Unknown difficulty "${String(difficulty)}". Use easy, normal or hard.`);
  return settings;
};

/** Starts a new game: the bakery in Pudding Lane is burning. */
export function newGame({ seed = 1, difficulty = 'normal' } = {}) {
  const settings = settingsFor(difficulty);
  const cleanSeed = normaliseSeed(seed);
  const tiles = buildTiles();
  tiles[START.y * COLS + START.x].fire = 2;
  return {
    version: 1,
    seed: cleanSeed,
    rngState: cleanSeed,
    difficulty,
    turn: 0,
    cols: COLS,
    rows: ROWS,
    tiles,
    wind: windForTurn(0),
    resources: { ap: settings.ap, men: settings.men, powder: 0, goodwill: settings.goodwill },
    limits: { ap: settings.ap, men: settings.men, goodwill: MAX_GOODWILL },
    authority: false,
    appeals: 0,
    appealedThisTurn: false,
    evacuated: [],
    peopleSafe: 0,
    peopleTotal: tiles.reduce((sum, tile) => sum + tile.people, 0),
    housesTotal: tiles.reduce((sum, tile) => sum + tile.houses, 0),
    triggers: ['start'],
    over: false,
    outcome: null,
    lostLandmarks: []
  };
}

const refreshResources = (state, events) => {
  const settings = DIFFICULTY_SETTINGS[state.difficulty];
  const { resources, limits } = state;
  resources.ap = limits.ap;
  resources.men = Math.max(0, limits.men - postedMen(state));
  resources.goodwill = Math.min(limits.goodwill, resources.goodwill + 1);
  state.appealedThisTurn = false;
  if (state.authority && state.turn % settings.powderEvery === 0 && resources.powder < MAX_POWDER) {
    resources.powder += 1;
    events.push({ type: 'message', text: 'A cart of gunpowder arrives from the Tower.' });
  }
};

const changeWind = (state, rng, events) => {
  const before = state.wind.strength;
  state.wind = windForTurn(state.turn, rng);
  if (state.wind.strength < before) events.push({ type: 'message', text: `The wind is dropping: ${state.wind.label.toLowerCase()}.` });
};

const finishGame = (state, outcome, events) => {
  updateLostLandmarks(state, events, true);
  state.over = true;
  state.outcome = outcome;
  fireTrigger(state, 'end', events);
  const text = outcome === 'extinguished'
    ? 'The last flames are out. London can start to rebuild.'
    : 'It is Thursday morning. The great fire is finally dying down.';
  events.push({ type: 'message', text });
  events.push({ type: 'game-over', outcome });
};

/** Ends the turn: fire spreads and grows, time moves on 6 hours and the game may end. */
export function endTurn(state) {
  if (state.over) return { state, events: [] };
  const next = cloneState(state);
  const rng = createRng(next.rngState);
  const events = [];
  spreadFire(next, rng, events);
  growFire(next, rng, events);
  for (const tile of next.tiles) tile.wet = false;
  next.turn += 1;
  changeWind(next, rng, events);
  refreshResources(next, events);
  next.rngState = rng.state();
  if (!anyBurning(next)) {
    finishGame(next, 'extinguished', events);
  } else {
    for (const { turn, id } of DATE_TRIGGERS) {
      if (next.turn === turn) fireTrigger(next, id, events);
    }
    if (next.wind.strength <= 1) fireTrigger(next, 'wind-drops', events);
    if (next.turn >= LAST_TURN) finishGame(next, 'thursday', events);
  }
  return { state: next, events };
}
