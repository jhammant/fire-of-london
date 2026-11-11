import { test } from 'node:test';
import assert from 'node:assert/strict';
import { START, newGame, tileAt, endTurn } from '../src/engine/index.js';

const lastFlameAtTurn = (turn) => {
  const state = newGame();
  for (const tile of state.tiles) {
    Object.assign(tile, {
      type: 'open', fire: 0, burnt: false, cleared: false, wet: false,
      guard: 0, district: null, landmark: null, houses: 0, people: 0
    });
  }
  Object.assign(tileAt(state, START.x, START.y), {
    type: 'house', fire: 3, district: 'billingsgate', landmark: 'pudding-lane',
    houses: 66, people: 330
  });
  state.housesTotal = 66;
  state.peopleTotal = 330;
  state.turn = turn;
  const strength = turn <= 10 ? 3 : turn === 11 ? 2 : 1;
  state.wind = { from: 'E', strength, dx: -1, dy: 0, label: 'Easterly wind' };
  return state;
};

for (const [turn, trigger] of [
  [0, 'sunday-morning'], [1, 'sunday-afternoon'], [4, 'monday'],
  [8, 'tuesday'], [10, 'tuesday-night'], [11, 'wind-drops'], [12, 'wednesday']
]) {
  test(`${trigger} fires when its turn is reached as the final flame burns out`, () => {
    // Arrange
    const state = lastFlameAtTurn(turn);

    // Act
    const result = endTurn(state);
    const triggers = result.events.filter(({ type }) => type === 'trigger').map(({ id }) => id);

    // Assert: section 4 ties these triggers to the reached turn/wind, not remaining fire.
    assert.equal(result.state.turn, turn + 1);
    assert.equal(result.state.outcome, 'extinguished');
    assert.equal(triggers.filter((id) => id === trigger).length, 1);
    assert.ok(result.state.triggers.includes(trigger));
    assert.ok(triggers.indexOf(trigger) < triggers.indexOf('end'));
    assert.deepEqual(result.events.at(-1), { type: 'game-over', outcome: 'extinguished' });
    assert.deepEqual(endTurn(result.state).events, []);
  });
}
