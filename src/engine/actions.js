// Player actions: checking whether they are allowed and applying them.

import { ACTIONS, DIFFICULTY_SETTINGS, MAX_POWDER } from './config.js';
import {
  tileAt,
  getLandmark,
  isFlammable,
  cloneState,
  fireTrigger,
  updateLostLandmarks,
  formatCount
} from './board.js';

const ACTION_BY_ID = new Map(ACTIONS.map((action) => [action.id, action]));
const PULLABLE = ['house', 'warehouse'];
const ORTHOGONAL = [[0, 0], [0, -1], [-1, 0], [1, 0], [0, 1]];

const ok = { ok: true, reason: '' };
const no = (reason) => ({ ok: false, reason });

const hasPoint = (action) => action.x !== undefined && action.x !== null && action.y !== undefined && action.y !== null;

const checkResources = (state, cost) => {
  const { resources } = state;
  if (resources.ap < cost.ap) return no('You have no actions left this turn. Press End Turn.');
  if (resources.men < cost.men) return no('You need more men.');
  if (resources.powder < cost.powder) return no('You have no gunpowder left.');
  if (resources.goodwill < cost.goodwill) return no('People are too upset to lose more homes. Wait for their goodwill to return.');
  return ok;
};

const checkBurnable = (tile) => {
  if (tile.burnt) return no('That tile has already burnt down.');
  if (tile.cleared) return no('That tile is already a firebreak.');
  return ok;
};

const checkDouse = (state, tile) => {
  if (!isFlammable(tile.type)) return no('There is nothing there that can burn.');
  return checkBurnable(tile);
};

const checkHooks = (state, tile) => {
  if (!PULLABLE.includes(tile.type)) return no('Firehooks only work on houses and warehouses.');
  const burnable = checkBurnable(tile);
  if (!burnable.ok) return burnable;
  if (tile.fire > 0) return no('That tile is already on fire. Pull down houses before the fire reaches them.');
  return ok;
};

const checkGunpowder = (state, tile) => {
  if (!PULLABLE.includes(tile.type)) return no('Gunpowder can only be used on houses and warehouses.');
  return checkBurnable(tile);
};

const checkEvacuate = (state, tile) => {
  if (!tile.district) return no('Nobody lives there. Choose a tile with houses.');
  if (state.evacuated.includes(tile.district)) return no('That district has already been evacuated.');
  const people = state.tiles.reduce((sum, t) => sum + (t.district === tile.district ? t.people : 0), 0);
  if (people === 0) return no('Everyone has already left that district.');
  return ok;
};

const checkGuard = (state, tile) => {
  const landmark = tile.landmark ? getLandmark(tile.landmark) : undefined;
  if (!landmark || !landmark.scored) return no('Choose a tile of a famous building or street to guard.');
  if (state.lostLandmarks.includes(landmark.id)) return no('That place is already lost.');
  if (tile.guard > 0) return no('Men are already posted there.');
  return ok;
};

const TARGET_CHECKS = {
  douse: checkDouse,
  hooks: checkHooks,
  gunpowder: checkGunpowder,
  evacuate: checkEvacuate,
  guard: checkGuard
};

/** Checks whether an action ({ type, x, y }) is allowed now; reason explains a refusal. */
export function canAct(state, action) {
  const definition = action ? ACTION_BY_ID.get(action.type) : undefined;
  if (state.over) return no('The game is over. Start a new game to play again.');
  if (!definition) return no('That is not something you can do.');
  if (definition.needsAuthority && !state.authority) return no('You need the King\'s permission to use gunpowder.');
  if (definition.id === 'appeal') {
    if (state.authority) return no('The King has already given you permission.');
    if (state.appealedThisTurn) return no('You have already sent word this turn. Wait for the next turn.');
  }
  const resources = checkResources(state, definition.cost);
  if (!resources.ok) return resources;
  if (definition.target === 'none') return ok;
  if (!hasPoint(action)) return no('Choose a tile on the map first.');
  const tile = tileAt(state, action.x, action.y);
  if (!tile) return no('That tile is not on the map.');
  return TARGET_CHECKS[definition.id](state, tile);
}

const moveToSafety = (state, tile) => {
  state.peopleSafe += tile.people;
  tile.people = 0;
};

const clearTile = (state, x, y, events) => {
  const tile = tileAt(state, x, y);
  if (tile.fire > 0) {
    tile.fire = 0;
    events.push({ type: 'extinguish', x, y });
  }
  moveToSafety(state, tile);
  tile.cleared = true;
  tile.wet = false;
  events.push({ type: 'cleared', x, y });
};

const doDouse = (state, { x, y }, events) => {
  const tile = tileAt(state, x, y);
  tile.wet = true;
  if (tile.fire === 0) {
    events.push({ type: 'message', text: 'The houses are soaked with water. They will be harder to set alight.' });
    return;
  }
  tile.fire -= 1;
  if (tile.fire === 0) {
    events.push({ type: 'extinguish', x, y });
    events.push({ type: 'message', text: 'Splash! The fire there is out.' });
  } else {
    events.push({ type: 'message', text: 'The buckets knock the fire down a little.' });
  }
};

const doHooks = (state, { x, y }, events) => {
  clearTile(state, x, y, events);
  events.push({ type: 'message', text: 'The families get out, then men pull the houses down with hooks and ropes.' });
};

const doGunpowder = (state, { x, y }, events) => {
  for (const [dx, dy] of ORTHOGONAL) {
    const tile = tileAt(state, x + dx, y + dy);
    if (!tile || !PULLABLE.includes(tile.type) || tile.burnt || tile.cleared) continue;
    clearTile(state, x + dx, y + dy, events);
  }
  events.push({ type: 'message', text: 'Boom! The houses are blown down to make a wide firebreak.' });
};

const doEvacuate = (state, { x, y }, events) => {
  const { district } = tileAt(state, x, y);
  const before = state.peopleSafe;
  state.tiles.forEach((tile) => {
    if (tile.district === district) moveToSafety(state, tile);
  });
  state.evacuated.push(district);
  const moved = formatCount(state.peopleSafe - before);
  events.push({ type: 'message', text: `${moved} people pack their carts and walk to Moorfields.` });
};

const doGuard = (state, { x, y }, events) => {
  const landmark = getLandmark(tileAt(state, x, y).landmark);
  const men = ACTION_BY_ID.get('guard').cost.men;
  for (const [lx, ly] of landmark.tiles) tileAt(state, lx, ly).guard = men;
  events.push({ type: 'message', text: `Men stand ready with buckets to protect ${landmark.name}.` });
};

const doAppeal = (state, action, events) => {
  const settings = DIFFICULTY_SETTINGS[state.difficulty];
  state.appeals += 1;
  state.appealedThisTurn = true;
  if (state.appeals < settings.appealsNeeded) {
    events.push({ type: 'message', text: 'A rider gallops off to the King at Whitehall. No answer yet. Try again next turn.' });
    return;
  }
  state.authority = true;
  state.resources.powder = Math.min(MAX_POWDER, state.resources.powder + settings.powderOnAuthority);
  events.push({ type: 'message', text: 'The King says yes! Carts of gunpowder are on their way.' });
  fireTrigger(state, 'authority', events);
};

const EFFECTS = {
  douse: doDouse,
  hooks: doHooks,
  gunpowder: doGunpowder,
  evacuate: doEvacuate,
  guard: doGuard,
  appeal: doAppeal
};

/** Applies an action, returning the new state and its events, or the same state when refused. */
export function applyAction(state, action) {
  const check = canAct(state, action);
  if (!check.ok) return { ok: false, reason: check.reason, state, events: [] };
  const definition = ACTION_BY_ID.get(action.type);
  const next = cloneState(state);
  const events = [];
  for (const key of ['ap', 'men', 'powder', 'goodwill']) next.resources[key] -= definition.cost[key];
  EFFECTS[definition.id](next, action, events);
  updateLostLandmarks(next, events, false);
  if (definition.id !== 'appeal') fireTrigger(next, `first-${definition.id}`, events);
  return { ok: true, reason: '', state: next, events };
}
