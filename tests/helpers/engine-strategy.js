// Scripted players for the engine balance tests. They only use the public engine API.

import * as engine from '../../src/engine/index.js';

const ST_PAULS = engine.getLandmark('st-pauls').tiles;

const burningTiles = (state) => {
  const list = [];
  state.tiles.forEach((tile, index) => {
    if (tile.fire > 0) list.push({ x: index % state.cols, y: Math.floor(index / state.cols), tile });
  });
  return list;
};

const distance = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Applies an action when it is allowed and records its events; returns the next state. */
export function tryAction(state, action, events) {
  const result = engine.applyAction(state, action);
  if (!result.ok) return state;
  events.push(...result.events);
  return result.state;
}

/** A player who never acts. */
export function doNothing(state) {
  return state;
}

const guardStPauls = (state, burning, events) => {
  const [x, y] = ST_PAULS[0];
  const near = burning.some((b) => ST_PAULS.some(([sx, sy]) => distance(b, { x: sx, y: sy }) <= 5));
  return near ? tryAction(state, { type: 'guard', x, y }, events) : state;
};

const evacuateNearest = (state, burning, events) => {
  let best = null;
  state.tiles.forEach((tile, index) => {
    if (!tile.district || tile.people === 0 || state.evacuated.includes(tile.district)) return;
    const point = { x: index % state.cols, y: Math.floor(index / state.cols) };
    const d = Math.min(...burning.map((b) => distance(b, point)));
    if (!best || d < best.d) best = { d, ...point };
  });
  return best && best.d <= 2 ? tryAction(state, { type: 'evacuate', x: best.x, y: best.y }, events) : state;
};

const douseWesternFront = (state, burning, events) => {
  const front = [...burning].sort((a, b) => a.x - b.x || a.tile.fire - b.tile.fire || a.y - b.y)[0];
  return front ? tryAction(state, { type: 'douse', x: front.x, y: front.y }, events) : state;
};

const needsClearing = (tile) => tile && (tile.type === 'house' || tile.type === 'warehouse')
  && !tile.cleared && !tile.burnt && tile.fire === 0;

const cutFirebreak = (state, burning, memory, events) => {
  const minX = Math.min(...burning.map((b) => b.x));
  if (memory.breakX === undefined || minX <= memory.breakX) memory.breakX = Math.max(2, minX - 2);
  const bx = memory.breakX;
  const minY = Math.max(0, Math.min(...burning.map((b) => b.y)) - 2);
  const maxY = Math.min(state.rows - 1, Math.max(...burning.map((b) => b.y)) + 1);
  const rows = [];
  for (let y = minY; y <= maxY; y += 1) {
    if (needsClearing(engine.tileAt(state, bx, y))) rows.push(y);
  }
  const fireGap = (y) => Math.min(...burning.map((b) => Math.abs(b.y - y) + Math.max(0, b.x - bx)));
  rows.sort((a, b) => fireGap(a) - fireGap(b) || a - b);
  let next = state;
  for (const y of rows) {
    if (!needsClearing(engine.tileAt(next, bx, y))) continue;
    const blast = engine.canAct(next, { type: 'gunpowder', x: bx, y: y + 1 }).ok ? { x: bx, y: y + 1 } : { x: bx, y };
    const before = next;
    next = tryAction(next, { type: 'gunpowder', ...blast }, events);
    if (next === before) next = tryAction(next, { type: 'hooks', x: bx, y }, events);
    if (next === before) break;
  }
  return next;
};

/** The scripted strategy for one turn: appeal, guard, evacuate, douse, then cut a firebreak. */
export function strategyTurn(state, memory, events) {
  let next = tryAction(state, { type: 'appeal' }, events);
  const burning = burningTiles(next);
  if (burning.length === 0) return next;
  next = guardStPauls(next, burning, events);
  next = evacuateNearest(next, burning, events);
  next = douseWesternFront(next, burning, events);
  return cutFirebreak(next, burningTiles(next), memory, events);
}

/** Plays a whole game with a turn planner; returns the final state, every event and the state after each turn. */
export function playGame({ seed = 1, difficulty = 'normal', plan = doNothing, start } = {}) {
  let state = start || engine.newGame({ seed, difficulty });
  const events = [];
  const states = [state];
  const memory = {};
  while (!state.over) {
    state = plan(state, memory, events);
    const result = engine.endTurn(state);
    events.push(...result.events);
    state = result.state;
    states.push(state);
  }
  return { state, events, states };
}
