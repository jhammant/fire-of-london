import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, tileAt, getLandmark, getScore, canAct } from '../src/engine/index.js';

test('a live landmark is not lost merely because half its tiles have caught fire', () => {
  // Arrange: section 3 counts burning landmark tiles as lost only at game end.
  const state = newGame();
  const cathedral = getLandmark('st-pauls');
  for (const [x, y] of cathedral.tiles.slice(0, 2)) tileAt(state, x, y).fire = 1;
  const [x, y] = cathedral.tiles[0];

  // Act
  const score = getScore(state);

  // Assert: the cathedral can still be protected and saved.
  assert.equal(state.over, false);
  assert.ok(cathedral.tiles.every(([tx, ty]) => !tileAt(state, tx, ty).burnt));
  assert.equal(canAct(state, { type: 'guard', x, y }).ok, true);
  assert.equal(score.stPaulsSaved, true);
  assert.ok(score.landmarksSaved.includes(cathedral.id));
  assert.ok(!score.landmarksLost.includes(cathedral.id));
});

test('burning landmark tiles count as lost at game end', () => {
  // Arrange
  const state = newGame();
  const cathedral = getLandmark('st-pauls');
  for (const [x, y] of cathedral.tiles.slice(0, 2)) tileAt(state, x, y).fire = 1;
  state.turn = 16;
  state.over = true;
  state.outcome = 'thursday';

  // Act
  const score = getScore(state);

  // Assert
  assert.equal(score.stPaulsSaved, false);
  assert.ok(score.landmarksLost.includes(cathedral.id));
});
