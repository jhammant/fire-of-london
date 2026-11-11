// How fire spreads, grows and burns out during endTurn.

import { COLS, ROWS, LANDMARKS } from '../data/map.js';
import { DIFFICULTY_SETTINGS } from './config.js';
import { isFlammable, tileAt, fireTrigger, updateLostLandmarks } from './board.js';

// Tuning for the fire model.
const FIRE_TUNING = {
  subSteps: 3,
  igniteBase: { house: 0.13, warehouse: 0.16, stone: 0.02 },
  levelFactor: [0, 0.6, 1, 1.35],
  windK: 0.42,
  strengthFactor: [0.08, 0.25, 0.7, 1],
  diagonal: 0.7,
  maxChance: 0.95,
  wetTarget: 0.15,
  guardTarget: 0.2,
  wetSource: 0.7,
  emberChance: [0, 0, 0.03, 0.06],
  emberLand: { house: 0.8, warehouse: 1, stone: 0.3 },
  growth: { house: 1, warehouse: 2, stone: 0 },
  stoneGrowChance: 0.5,
  guardGrowChance: 0.5,
  wetGrowChance: 0.5
};

const NEIGHBOURS = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1]
];

const TOWER_TILES = LANDMARKS.find((landmark) => landmark.id === 'tower').tiles;

const nearTower = (x, y) => TOWER_TILES.some(([tx, ty]) => Math.max(Math.abs(tx - x), Math.abs(ty - y)) <= 3);

const canIgnite = (tile) => isFlammable(tile.type) && !tile.burnt && !tile.cleared && tile.fire === 0;

const windFactor = (wind, dx, dy) => {
  if (wind.strength === 0) return 1;
  const cos = (dx * wind.dx + dy * wind.dy) / (Math.hypot(dx, dy) * Math.hypot(wind.dx, wind.dy));
  return Math.exp(FIRE_TUNING.windK * wind.strength * cos);
};

const targetFactor = (tile) => (tile.wet ? FIRE_TUNING.wetTarget : 1) * (tile.guard > 0 ? FIRE_TUNING.guardTarget : 1);

// Chance that a burning source sets a neighbour one step (dx, dy) away alight in one sub-step.
const spreadChance = (state, source, target, dx, dy) => {
  const t = FIRE_TUNING;
  const spread = DIFFICULTY_SETTINGS[state.difficulty].spread;
  const chance = t.igniteBase[target.type]
    * t.levelFactor[source.fire]
    * (dx !== 0 && dy !== 0 ? t.diagonal : 1)
    * windFactor(state.wind, dx, dy)
    * t.strengthFactor[state.wind.strength]
    * (source.wet ? t.wetSource : 1)
    * targetFactor(target)
    * spread;
  return Math.min(t.maxChance, chance);
};

const ignite = (state, x, y, from, ember, events) => {
  const tile = tileAt(state, x, y);
  tile.fire = 1;
  events.push({ type: 'ignite', x, y, from, ember });
  fireTrigger(state, 'first-spread', events);
  if (tile.type === 'warehouse') fireTrigger(state, 'warehouses', events);
  if (tile.landmark === 'london-bridge') fireTrigger(state, 'bridge', events);
  if (nearTower(x, y)) fireTrigger(state, 'tower', events);
};

const throwEmber = (state, rng, x, y, events) => {
  const { wind } = state;
  const spread = DIFFICULTY_SETTINGS[state.difficulty].spread;
  if (rng.next() >= FIRE_TUNING.emberChance[wind.strength] * spread) return;
  const distance = rng.next() < 0.5 ? 2 : 3;
  const tx = x + wind.dx * distance;
  const ty = y + wind.dy * distance;
  const target = tileAt(state, tx, ty);
  if (!target || !canIgnite(target)) return;
  if (rng.next() >= FIRE_TUNING.emberLand[target.type] * targetFactor(target)) return;
  ignite(state, tx, ty, { x, y }, true, events);
};

const spreadOnce = (state, rng, events) => {
  const sources = [];
  state.tiles.forEach((tile, index) => {
    if (tile.fire > 0) sources.push(index);
  });
  for (const index of sources) {
    const x = index % COLS;
    const y = Math.floor(index / COLS);
    const source = state.tiles[index];
    for (const [dx, dy] of NEIGHBOURS) {
      const target = tileAt(state, x + dx, y + dy);
      if (!target || !canIgnite(target)) continue;
      if (rng.next() < spreadChance(state, source, target, dx, dy)) {
        ignite(state, x + dx, y + dy, { x, y }, false, events);
      }
    }
    if (source.fire === 3 && state.wind.strength >= 2) throwEmber(state, rng, x, y, events);
  }
};

/** Runs the spread sub-steps of one turn, mutating the working state and appending events. */
export function spreadFire(state, rng, events) {
  for (let step = 0; step < FIRE_TUNING.subSteps; step += 1) spreadOnce(state, rng, events);
}

const growthFor = (tile, rng) => {
  const growth = tile.type === 'stone'
    ? Number(rng.next() < FIRE_TUNING.stoneGrowChance)
    : FIRE_TUNING.growth[tile.type];
  const keep = (tile.wet ? FIRE_TUNING.wetGrowChance : 1) * (tile.guard > 0 ? FIRE_TUNING.guardGrowChance : 1);
  if (growth > 0 && keep < 1 && rng.next() >= keep) return 0;
  return growth;
};

/** Grows every fire by its type's rate and burns out tiles that pass level 3. */
export function growFire(state, rng, events) {
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const tile = tileAt(state, x, y);
      if (tile.fire === 0) continue;
      const level = tile.fire + growthFor(tile, rng);
      if (level <= 3) {
        tile.fire = level;
      } else {
        tile.fire = 0;
        tile.burnt = true;
        tile.people = 0;
        events.push({ type: 'burnout', x, y });
      }
    }
  }
  updateLostLandmarks(state, events, false);
}
