import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS, START, newGame, tileAt, canAct, applyAction, endTurn } from '../src/engine/index.js';

test('a second paid douse can extinguish a wet burning tile in the same turn', () => {
  // Arrange: section 3 permits any flammable tile that is not burnt or cleared.
  const start = newGame();
  const action = { type: 'douse', ...START };
  const cost = ACTIONS.find(({ id }) => id === 'douse').cost;
  const first = applyAction(start, action);
  assert.equal(first.ok, true);
  assert.equal(tileAt(first.state, START.x, START.y).fire, 1);
  assert.equal(tileAt(first.state, START.x, START.y).wet, true);

  // Act
  const allowed = canAct(first.state, action);
  const second = applyAction(first.state, action);

  // Assert: wetness is protection, not an additional targeting restriction.
  assert.deepEqual(allowed, { ok: true, reason: '' });
  assert.equal(second.ok, true);
  assert.equal(second.state.turn, start.turn);
  assert.equal(tileAt(second.state, START.x, START.y).fire, 0);
  assert.equal(tileAt(second.state, START.x, START.y).wet, true);
  for (const key of ['ap', 'men', 'powder', 'goodwill']) {
    assert.equal(second.state.resources[key], start.resources[key] - 2 * cost[key]);
  }
  assert.ok(second.events.some(({ type }) => type === 'extinguish'));
  assert.equal(second.events.filter(({ type, id }) => type === 'trigger' && id === 'first-douse').length, 0);
  assert.equal(endTurn(second.state).state.outcome, 'extinguished');
});
