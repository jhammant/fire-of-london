import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../src/engine/index.js';
import { playGame, strategyTurn, doNothing } from './helpers/engine-strategy.js';

const SEEDS = [1, 2, 3, 4, 5];
const DIFFICULTY_IDS = ['easy', 'normal', 'hard'];
const RATING_LABELS = {
  'worse-than-1666': 'Worse than 1666',
  'like-1666': 'Much like 1666',
  'better-than-1666': 'Better than 1666',
  saviour: 'Saviour of London'
};

const results = {};
for (const difficulty of DIFFICULTY_IDS) {
  results[difficulty] = SEEDS.map((seed) => ({
    seed,
    nothing: playGame({ seed, difficulty, plan: doNothing }),
    strategy: playGame({ seed, difficulty, plan: strategyTurn })
  }));
}

const lost = (game) => engine.getScore(game.state).housesLost;
const average = (values) => values.reduce((sum, v) => sum + v, 0) / values.length;

test('doing nothing loses more than half the houses on every difficulty', () => {
  for (const difficulty of DIFFICULTY_IDS) {
    for (const { seed, nothing } of results[difficulty]) {
      // Act
      const score = engine.getScore(nothing.state);

      // Assert
      assert.ok(score.housesLost > score.housesTotal / 2, `${difficulty} seed ${seed} lost ${score.housesLost}`);
    }
  }
});

test('doing nothing on normal loses roughly 70 to 90 percent of houses', () => {
  // Act
  const share = average(results.normal.map(({ nothing }) => lost(nothing) / nothing.state.housesTotal));

  // Assert
  assert.ok(share >= 0.7 && share <= 0.9, `normal do-nothing share ${share}`);
});

test('the strategy on easy saves clearly more than doing nothing and beats 1666 by far', () => {
  for (const { seed, nothing, strategy } of results.easy) {
    // Act
    const withStrategy = lost(strategy);
    const withoutStrategy = lost(nothing);

    // Assert
    assert.ok(withStrategy < withoutStrategy - 1500, `easy seed ${seed}: ${withStrategy} vs ${withoutStrategy}`);
    assert.ok(withStrategy < 9900, `easy seed ${seed} lost ${withStrategy}`);
  }
});

test('the same strategy loses more houses on hard than on easy on average', () => {
  // Act
  const easy = average(results.easy.map(({ strategy }) => lost(strategy)));
  const hard = average(results.hard.map(({ strategy }) => lost(strategy)));

  // Assert
  assert.ok(hard > easy, `hard ${hard} easy ${easy}`);
});

test('a strategy game scores better than doing nothing', () => {
  // Arrange
  const { nothing, strategy } = results.normal[0];

  // Act
  const lazy = engine.getScore(nothing.state);
  const busy = engine.getScore(strategy.state);

  // Assert
  assert.ok(busy.housesLost < lazy.housesLost);
  assert.ok(busy.peopleSafe > lazy.peopleSafe);
  assert.ok(busy.landmarksSaved.length >= lazy.landmarksSaved.length);
});

test('getScore invariants hold at every turn of every game', () => {
  // Arrange
  const scored = engine.LANDMARKS.filter((l) => l.scored).map((l) => l.id).sort();

  for (const difficulty of DIFFICULTY_IDS) {
    for (const game of results[difficulty].flatMap(({ nothing, strategy }) => [nothing, strategy])) {
      for (const state of game.states) {
        // Act
        const score = engine.getScore(state);

        // Assert
        assert.equal(score.housesSaved + score.housesLost, score.housesTotal);
        assert.equal(score.housesTotal, state.housesTotal);
        assert.ok(score.housesPulledDown >= 0 && score.housesPulledDown <= score.housesLost);
        assert.deepEqual([...score.landmarksSaved, ...score.landmarksLost].sort(), scored);
        assert.equal(score.peopleTotal, state.peopleTotal);
        assert.ok(score.peopleSafe >= 0 && score.peopleSafe <= score.peopleTotal);
        assert.equal(score.rating.label, RATING_LABELS[score.rating.id]);
        assert.equal(typeof score.rating.text, 'string');
        assert.deepEqual(score.history, { housesLost: 13200, churchesLost: 87, stPaulsLost: true, deathsRecorded: 6 });
        assert.equal(score.beatHistory, score.housesLost < 13200);
        assert.equal(score.stPaulsSaved, score.landmarksSaved.includes('st-pauls'));
      }
    }
  }
});

test('landmarks the engine reported lost stay lost in the final score', () => {
  for (const difficulty of DIFFICULTY_IDS) {
    for (const { strategy, nothing } of results[difficulty]) {
      for (const game of [strategy, nothing]) {
        // Act
        const reported = game.events.filter((e) => e.type === 'landmark-lost').map((e) => e.id);
        const score = engine.getScore(game.state);

        // Assert
        assert.equal(new Set(reported).size, reported.length);
        assert.deepEqual([...reported].sort(), [...score.landmarksLost].sort());
      }
    }
  }
});
