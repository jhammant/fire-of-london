import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLS,
  ROWS,
  GRID,
  LEGEND_CHARS,
  DISTRICT_GRID,
  DISTRICT_CODES,
  LANDMARKS,
  DISTRICTS,
  START
} from '../src/data/map.js';
import * as engine from '../src/engine/index.js';

const EXPECTED_LANDMARKS = [
  ['pudding-lane', 'Pudding Lane', 'bakery', false, 'house'],
  ['london-bridge', 'London Bridge', 'bridge', true, 'house'],
  ['thames-street', 'Thames Street', 'street', false, 'warehouse'],
  ['royal-exchange', 'Royal Exchange', 'exchange', true, 'stone'],
  ['guildhall', 'Guildhall', 'hall', true, 'stone'],
  ['cheapside', 'Cheapside', 'street', true, 'house'],
  ['st-pauls', 'St Paul\'s Cathedral', 'cathedral', true, 'stone'],
  ['baynards-castle', 'Baynard\'s Castle', 'castle', true, 'stone'],
  ['tower', 'Tower of London', 'fortress', true, 'stone'],
  ['moorfields', 'Moorfields', 'field', false, 'open'],
  ['fleet-river', 'Fleet river', 'river', false, 'river'],
  ['city-wall', 'City wall', 'wall', false, 'wall'],
  ['ludgate', 'Ludgate', 'gate', false, 'wall'],
  ['newgate', 'Newgate', 'gate', false, 'wall'],
  ['aldersgate', 'Aldersgate', 'gate', false, 'wall'],
  ['cripplegate', 'Cripplegate', 'gate', false, 'wall'],
  ['moorgate', 'Moorgate', 'gate', false, 'wall'],
  ['bishopsgate', 'Bishopsgate', 'gate', false, 'wall'],
  ['aldgate', 'Aldgate', 'gate', false, 'wall']
];

const typeAt = (x, y) => LEGEND_CHARS[GRID[y][x]];
const landmark = (id) => LANDMARKS.find((l) => l.id === id);

test('the grid is 18 rows of 28 known characters', () => {
  // Arrange
  const known = Object.keys(LEGEND_CHARS);

  // Act
  const badRows = GRID.filter((row) => row.length !== COLS);
  const unknown = GRID.join('').split('').filter((ch) => !known.includes(ch));

  // Assert
  assert.equal(COLS, 28);
  assert.equal(ROWS, 18);
  assert.equal(GRID.length, ROWS);
  assert.deepEqual(badRows, []);
  assert.deepEqual(unknown, []);
  assert.deepEqual([...new Set(Object.values(LEGEND_CHARS))].sort(), [...engine.TILE_TYPES].sort());
});

test('the district grid has the same shape and only known codes', () => {
  // Arrange
  const known = Object.keys(DISTRICT_CODES);

  // Act
  const badRows = DISTRICT_GRID.filter((row) => row.length !== COLS);
  const unknown = DISTRICT_GRID.join('').split('').filter((ch) => !known.includes(ch));

  // Assert
  assert.equal(DISTRICT_GRID.length, ROWS);
  assert.deepEqual(badRows, []);
  assert.deepEqual(unknown, []);
});

test('landmark ids, names, kinds and scored flags match the contract in order', () => {
  // Arrange
  const expected = EXPECTED_LANDMARKS.map(([id, name, kind, scored]) => ({ id, name, kind, scored }));

  // Act
  const actual = LANDMARKS.map(({ id, name, kind, scored }) => ({ id, name, kind, scored }));

  // Assert
  assert.deepEqual(actual, expected);
  assert.equal(engine.LANDMARKS, LANDMARKS);
});

test('every landmark has in-bounds tiles of its required type and a blurb', () => {
  for (const [id, , , , type] of EXPECTED_LANDMARKS) {
    // Arrange
    const { tiles, blurb } = landmark(id);

    // Act
    const wrong = tiles.filter(([x, y]) => x < 0 || y < 0 || x >= COLS || y >= ROWS || typeAt(x, y) !== type);

    // Assert
    assert.ok(tiles.length > 0, `${id} has tiles`);
    assert.deepEqual(wrong, [], `${id} tiles are in bounds and ${type}`);
    assert.equal(typeof blurb, 'string');
    assert.ok(blurb.length > 10 && blurb.length < 140, `${id} has a short blurb`);
  }
});

test('a tile belongs to at most one landmark and each gate is a single tile', () => {
  // Arrange
  const seen = new Map();

  // Act
  const duplicates = [];
  for (const { id, tiles } of LANDMARKS) {
    for (const [x, y] of tiles) {
      const key = `${x},${y}`;
      if (seen.has(key)) duplicates.push(`${key} in ${seen.get(key)} and ${id}`);
      seen.set(key, id);
    }
  }

  // Assert
  assert.deepEqual(duplicates, []);
  for (const gate of LANDMARKS.filter((l) => l.kind === 'gate')) assert.equal(gate.tiles.length, 1, gate.id);
});

test('gates are in the right places: two west, four north from west to east, Aldgate east', () => {
  // Arrange
  const at = (id) => landmark(id).tiles[0];

  // Act
  const north = ['aldersgate', 'cripplegate', 'moorgate', 'bishopsgate'].map(at);

  // Assert
  assert.ok(at('ludgate')[0] <= 2 && at('newgate')[0] <= 2, 'Ludgate and Newgate are on the west side');
  assert.ok(at('ludgate')[1] > at('newgate')[1], 'Ludgate is south of Newgate');
  assert.ok(north.every(([, y]) => y <= 3), 'north gates are on the north wall');
  assert.ok(north.every(([x], i) => i === 0 || x > north[i - 1][0]), 'north gates run west to east');
  assert.ok(at('aldgate')[0] >= 20, 'Aldgate is in the east');
});

test('START is a house tile of Pudding Lane in the east, near the river', () => {
  // Arrange
  const { x, y } = START;

  // Act
  const inPuddingLane = landmark('pudding-lane').tiles.some(([lx, ly]) => lx === x && ly === y);

  // Assert
  assert.ok(x >= 0 && x < COLS && y >= 0 && y < ROWS);
  assert.equal(typeAt(x, y), 'house');
  assert.ok(inPuddingLane);
  assert.ok(x >= 14);
  assert.ok(16 - y <= 4);
  assert.deepEqual(engine.START, START);
});

test('St Paul\'s is in the west third, the Tower east of x 21 and Moorfields in rows 0-1', () => {
  // Assert
  assert.ok(landmark('st-pauls').tiles.every(([x]) => x < COLS / 3));
  assert.ok(landmark('tower').tiles.every(([x]) => x > 21));
  assert.ok(landmark('moorfields').tiles.every(([, y]) => y <= 1));
});

test('rows 16-17 are river except the London Bridge tiles', () => {
  // Arrange
  const bridge = landmark('london-bridge').tiles.map(([x, y]) => `${x},${y}`);

  // Act
  const wrong = [];
  for (const y of [16, 17]) {
    for (let x = 0; x < COLS; x += 1) {
      const expected = bridge.includes(`${x},${y}`) ? 'house' : 'river';
      if (typeAt(x, y) !== expected) wrong.push(`${x},${y}`);
    }
  }

  // Assert
  assert.deepEqual(wrong, []);
  assert.ok(bridge.length > 0);
});

test('column 0 is mostly the Fleet river', () => {
  // Act
  let river = 0;
  for (let y = 0; y < ROWS; y += 1) if (typeAt(0, y) === 'river') river += 1;

  // Assert
  assert.ok(river >= ROWS * 0.8);
});

test('every flammable tile has a district and every other tile has none', () => {
  // Arrange
  const state = engine.newGame();
  const ids = DISTRICTS.map((d) => d.id);

  // Act
  const wrong = state.tiles.filter((tile) => (engine.FLAMMABLE_TYPES.includes(tile.type)
    ? !ids.includes(tile.district)
    : tile.district !== null));

  // Assert
  assert.deepEqual(wrong, []);
});

test('districts have unique ids and names, between 6 and 12 of them, and each is used', () => {
  // Arrange
  const state = engine.newGame();
  const ids = DISTRICTS.map((d) => d.id);

  // Act
  const used = new Set(state.tiles.map((tile) => tile.district).filter(Boolean));

  // Assert
  assert.ok(DISTRICTS.length >= 6 && DISTRICTS.length <= 12);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(DISTRICTS.map((d) => d.name)).size, ids.length);
  assert.deepEqual([...used].sort(), [...ids].sort());
  assert.deepEqual([...new Set(Object.values(DISTRICT_CODES))].sort(), [...ids].sort());
});

test('houses total between 15,000 and 17,000 and people about 80,000', () => {
  // Act
  const state = engine.newGame();

  // Assert
  assert.ok(state.housesTotal >= 15000 && state.housesTotal <= 17000, String(state.housesTotal));
  assert.ok(state.peopleTotal >= 70000 && state.peopleTotal <= 90000, String(state.peopleTotal));
  assert.ok(state.tiles.every((tile) => tile.houses >= 0 && tile.people >= 0));
  assert.ok(state.tiles.filter((t) => !engine.FLAMMABLE_TYPES.includes(t.type)).every((t) => t.houses === 0));
});

test('the inside of the walls is mostly timber houses with about one church in twelve', () => {
  // Arrange
  let houses = 0;
  let stone = 0;
  let total = 0;

  // Act
  for (let y = 3; y <= 13; y += 1) {
    for (let x = 2; x <= 22; x += 1) {
      total += 1;
      if (typeAt(x, y) === 'house') houses += 1;
      if (typeAt(x, y) === 'stone') stone += 1;
    }
  }

  // Assert
  assert.ok(houses / total > 0.8);
  assert.ok(stone / total > 0.05 && stone / total < 0.15);
});
