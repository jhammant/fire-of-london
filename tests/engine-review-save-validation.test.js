import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, serialize, deserialize } from '../src/engine/index.js';

const malformedFields = [
  ['difficulty must be an id string, not an array', (state) => { state.difficulty = ['normal']; }],
  ['wind strength must be in 0..3', (state) => { state.wind.strength = 4; }],
  ['wind direction must be a compass point', (state) => { state.wind.from = 'sideways'; }],
  ['wind dx must be -1, 0 or 1', (state) => { state.wind.dx = -2; }],
  ['wind dy must be -1, 0 or 1', (state) => { state.wind.dy = 2; }]
];

for (const [description, corrupt] of malformedFields) {
  test(`deserialize rejects a bad state shape: ${description}`, () => {
    // Arrange: these fields have fixed types and value sets in section 3.
    const state = newGame();
    corrupt(state);

    // Act
    const saved = serialize(state);

    // Assert
    assert.throws(() => deserialize(saved), Error);
  });
}

test('valid game states still round-trip through save validation', () => {
  // Arrange
  const state = newGame();

  // Act
  const loaded = deserialize(serialize(state));

  // Assert
  assert.deepEqual(loaded, state);
});
