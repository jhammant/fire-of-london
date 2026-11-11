// The one public engine module. Everything here is pure and deterministic.

export { COLS, ROWS, LANDMARKS, DISTRICTS, START } from '../data/map.js';
export { LAST_TURN, TILE_TYPES, FLAMMABLE_TYPES, DIFFICULTIES, ACTIONS, TRIGGERS } from './config.js';
export { tileAt, getLandmark, getDistrict } from './board.js';
export { canAct, applyAction } from './actions.js';
export { newGame, endTurn } from './turn.js';
export { getTimeInfo } from './time.js';
export { getScore } from './score.js';
export { serialize, deserialize } from './save.js';
