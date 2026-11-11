// Saving a game to text and loading it back with checks.

import { COLS, ROWS } from '../data/map.js';
import { TILE_TYPES, DIFFICULTY_SETTINGS } from './config.js';
import { WIND_PUSH } from './wind.js';

const SAVE_VERSION = 1;

const isInt = (value) => Number.isInteger(value);
const isIntIn = (value, min, max) => isInt(value) && value >= min && value <= max;
const isBool = (value) => typeof value === 'boolean';
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isStringArray = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string');

// The wind must blow from a compass point, at strength 0-3, pushing the fire the way that point implies.
const isWind = (value) => {
  if (!isObject(value) || typeof value.from !== 'string' || !Object.hasOwn(WIND_PUSH, value.from)) return false;
  const [dx, dy] = WIND_PUSH[value.from];
  return isIntIn(value.strength, 0, 3) && value.dx === dx && value.dy === dy && typeof value.label === 'string';
};

const STATE_CHECKS = {
  seed: isInt,
  rngState: isInt,
  difficulty: (value) => typeof value === 'string' && Object.hasOwn(DIFFICULTY_SETTINGS, value),
  turn: (value) => isInt(value) && value >= 0,
  cols: (value) => value === COLS,
  rows: (value) => value === ROWS,
  tiles: (value) => Array.isArray(value) && value.length === COLS * ROWS,
  wind: isWind,
  resources: (value) => isObject(value) && ['ap', 'men', 'powder', 'goodwill'].every((key) => isInt(value[key])),
  limits: (value) => isObject(value) && ['ap', 'men', 'goodwill'].every((key) => isInt(value[key])),
  authority: isBool,
  appeals: isInt,
  appealedThisTurn: isBool,
  evacuated: isStringArray,
  peopleSafe: isInt,
  peopleTotal: isInt,
  housesTotal: isInt,
  triggers: isStringArray,
  over: isBool,
  outcome: (value) => value === null || value === 'extinguished' || value === 'thursday',
  lostLandmarks: isStringArray
};

const TILE_CHECKS = {
  type: (value) => TILE_TYPES.includes(value),
  fire: (value) => isInt(value) && value >= 0 && value <= 3,
  burnt: isBool,
  cleared: isBool,
  wet: isBool,
  guard: isInt,
  district: (value) => value === null || typeof value === 'string',
  landmark: (value) => value === null || typeof value === 'string',
  houses: isInt,
  people: isInt
};

/** Turns a game state into text for saving. */
export function serialize(state) {
  return JSON.stringify(state);
}

/** Reads a saved game; throws an Error explaining what is wrong with bad text. */
export function deserialize(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error(`Saved game is not valid JSON: ${error.message}`);
  }
  if (!isObject(data)) throw new Error('Saved game must be a JSON object.');
  if (data.version !== SAVE_VERSION) {
    throw new Error(`Saved game has version ${String(data.version)}, but this game reads version ${SAVE_VERSION}.`);
  }
  for (const [field, check] of Object.entries(STATE_CHECKS)) {
    if (!check(data[field])) throw new Error(`Saved game has a missing or bad "${field}" field.`);
  }
  data.tiles.forEach((tile, index) => {
    if (!isObject(tile)) throw new Error(`Saved game tile ${index} is not an object.`);
    for (const [field, check] of Object.entries(TILE_CHECKS)) {
      if (!check(tile[field])) throw new Error(`Saved game tile ${index} has a missing or bad "${field}" field.`);
    }
  });
  return data;
}
