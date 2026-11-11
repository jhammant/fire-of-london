// The map as tiles, plus lookups shared by the other engine modules.

import {
  COLS,
  ROWS,
  GRID,
  LEGEND_CHARS,
  DISTRICT_GRID,
  DISTRICT_CODES,
  LANDMARKS,
  DISTRICTS,
  TILE_CONTENTS,
  CONTENT_OVERRIDES
} from '../data/map.js';
import { FLAMMABLE_TYPES } from './config.js';

const LANDMARK_BY_ID = new Map(LANDMARKS.map((landmark) => [landmark.id, landmark]));
const DISTRICT_BY_ID = new Map(DISTRICTS.map((district) => [district.id, district]));

const landmarkAt = (x, y) => {
  const found = LANDMARKS.find((landmark) => landmark.tiles.some(([lx, ly]) => lx === x && ly === y));
  return found ? found.id : null;
};

const contentsAt = (type, x, y) => {
  const override = type === 'house'
    ? CONTENT_OVERRIDES.find((o) => x >= o.x0 && x <= o.x1 && y >= o.y0 && y <= o.y1)
    : undefined;
  return override || TILE_CONTENTS[type];
};

/** True when tiles of this type can catch fire. */
export function isFlammable(type) {
  return FLAMMABLE_TYPES.includes(type);
}

/** Builds the starting tiles from the map data, in index order y * COLS + x. */
export function buildTiles() {
  const tiles = [];
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const type = LEGEND_CHARS[GRID[y][x]];
      const { houses, people } = contentsAt(type, x, y);
      tiles.push({
        type,
        fire: 0,
        burnt: false,
        cleared: false,
        wet: false,
        guard: 0,
        district: isFlammable(type) ? DISTRICT_CODES[DISTRICT_GRID[y][x]] : null,
        landmark: landmarkAt(x, y),
        houses,
        people
      });
    }
  }
  return tiles;
}

/** Returns the tile at (x, y), or null when out of bounds. */
export function tileAt(state, x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= COLS || y >= ROWS) return null;
  return state.tiles[y * COLS + x];
}

/** Returns the landmark with this id, or undefined. */
export function getLandmark(id) {
  return LANDMARK_BY_ID.get(id);
}

/** Returns the district with this id, or undefined. */
export function getDistrict(id) {
  return DISTRICT_BY_ID.get(id);
}

/** Copies a state deeply enough that the copy can be changed freely. */
export function cloneState(state) {
  return {
    ...state,
    tiles: state.tiles.map((tile) => ({ ...tile })),
    wind: { ...state.wind },
    resources: { ...state.resources },
    limits: { ...state.limits },
    evacuated: [...state.evacuated],
    triggers: [...state.triggers],
    lostLandmarks: [...state.lostLandmarks]
  };
}

/** Appends a trigger and its event the first time it fires; later calls do nothing. */
export function fireTrigger(state, id, events) {
  if (state.triggers.includes(id)) return;
  state.triggers.push(id);
  events.push({ type: 'trigger', id });
}

/** True while any tile is alight. */
export function anyBurning(state) {
  return state.tiles.some((tile) => tile.fire > 0);
}

const goneTileCount = (state, landmark, countBurning) => landmark.tiles.filter(([x, y]) => {
  const tile = tileAt(state, x, y);
  return tile.burnt || tile.cleared || (countBurning && tile.fire > 0);
}).length;

/** True when a scored landmark has lost at least half its tiles. */
export function isLandmarkGone(state, landmark, countBurning) {
  return goneTileCount(state, landmark, countBurning) * 2 >= landmark.tiles.length;
}

/** Marks newly lost scored landmarks, sends their men home and emits landmark-lost events. */
export function updateLostLandmarks(state, events, countBurning) {
  for (const landmark of LANDMARKS) {
    if (!landmark.scored || state.lostLandmarks.includes(landmark.id)) continue;
    if (!isLandmarkGone(state, landmark, countBurning)) continue;
    state.lostLandmarks.push(landmark.id);
    for (const [x, y] of landmark.tiles) tileAt(state, x, y).guard = 0;
    events.push({ type: 'landmark-lost', id: landmark.id });
    events.push({ type: 'message', text: `${landmark.name} is lost. It cannot be saved now.` });
  }
}

/** Number of men posted as guards across all landmarks. */
export function postedMen(state) {
  return LANDMARKS
    .filter((landmark) => landmark.scored)
    .reduce((sum, landmark) => {
      const [x, y] = landmark.tiles[0];
      return sum + tileAt(state, x, y).guard;
    }, 0);
}

/** Writes a whole number with thousands commas, for example 12,345. */
export function formatCount(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
