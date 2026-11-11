import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as engine from '../src/engine/index.js';
import { playGame, strategyTurn, doNothing } from './helpers/engine-strategy.js';

const BANNED_SPELLINGS = ['color', 'colors', 'center', 'centered', 'neighbor', 'neighbors', 'gray', 'honor', 'favorite',
  'armor', 'harbor', 'defense', 'organize', 'realize', 'recognize', 'theater'];

const EXPECTED_TRIGGERS = ['start', 'first-spread', 'warehouses', 'sunday-morning', 'sunday-afternoon', 'first-douse',
  'first-hooks', 'first-gunpowder', 'first-evacuate', 'first-guard', 'authority', 'bridge', 'tower', 'monday',
  'tuesday', 'tuesday-night', 'wind-drops', 'wednesday', 'end'];

const DIFFICULTY_IDS = ['easy', 'normal', 'hard'];
const SEEDS = [1, 2, 3, 4, 5];

const edit = (state, change) => {
  const copy = JSON.parse(JSON.stringify(state));
  change(copy);
  return copy;
};

const pointOf = (state, index) => ({ x: index % state.cols, y: Math.floor(index / state.cols) });

// Every whole game used by the checks below, played once.
const GAMES = [];
for (const difficulty of DIFFICULTY_IDS) {
  for (const seed of SEEDS) {
    GAMES.push({ difficulty, seed, plan: 'nothing', ...playGame({ seed, difficulty, plan: doNothing }) });
    GAMES.push({ difficulty, seed, plan: 'strategy', ...playGame({ seed, difficulty, plan: strategyTurn }) });
  }
}

const SCRIPT = [
  [{ type: 'douse', x: 19, y: 14 }, { type: 'appeal' }, { type: 'evacuate', x: 19, y: 12 }],
  [{ type: 'hooks', x: 16, y: 13 }, { type: 'douse', x: 18, y: 14 }],
  [{ type: 'appeal' }, { type: 'guard', x: 16, y: 8 }],
  [{ type: 'gunpowder', x: 14, y: 12 }, { type: 'gunpowder', x: 14, y: 15 }],
  [{ type: 'douse', x: 17, y: 13 }, { type: 'hooks', x: 14, y: 10 }]
];

const replay = (seed, difficulty) => {
  let state = engine.newGame({ seed, difficulty });
  const events = [];
  for (const turn of SCRIPT) {
    for (const action of turn) {
      const result = engine.applyAction(state, action);
      events.push(...result.events);
      state = result.state;
    }
    const result = engine.endTurn(state);
    events.push(...result.events);
    state = result.state;
  }
  return { state, events };
};

const sentencesOk = (text) => text.split(/[.!?]/).every((sentence) => sentence.trim().split(/\s+/).length <= 20);

const bannedIn = (text) => BANNED_SPELLINGS.filter((word) => new RegExp(`\\b${word}\\b`, 'i').test(text));

const stateWithHousesLost = (target) => edit(engine.newGame(), (s) => {
  let lost = 0;
  for (const tile of s.tiles) {
    if (lost >= target) break;
    if (tile.houses > 0) {
      tile.burnt = true;
      lost += tile.houses;
    }
  }
});

const refusalReasons = () => {
  const base = engine.newGame();
  const ready = edit(base, (s) => {
    s.authority = true;
    s.resources.powder = 2;
  });
  const cases = [
    [edit(base, (s) => { s.over = true; }), { type: 'douse', x: 19, y: 14 }],
    [base, { type: 'unknown' }],
    [base, { type: 'gunpowder', x: 10, y: 4 }],
    [ready, { type: 'appeal' }],
    [engine.applyAction(base, { type: 'appeal' }).state, { type: 'appeal' }],
    [edit(base, (s) => { s.resources.ap = 0; }), { type: 'douse', x: 10, y: 4 }],
    [edit(base, (s) => { s.resources.men = 0; }), { type: 'douse', x: 10, y: 4 }],
    [edit(ready, (s) => { s.resources.powder = 0; }), { type: 'gunpowder', x: 10, y: 4 }],
    [edit(base, (s) => { s.resources.goodwill = 0; }), { type: 'hooks', x: 10, y: 4 }],
    [base, { type: 'douse' }],
    [base, { type: 'douse', x: 40, y: 4 }],
    [base, { type: 'douse', x: 0, y: 4 }],
    [edit(base, (s) => { engine.tileAt(s, 10, 4).burnt = true; }), { type: 'douse', x: 10, y: 4 }],
    [edit(base, (s) => { engine.tileAt(s, 10, 4).cleared = true; }), { type: 'douse', x: 10, y: 4 }],
    [edit(base, (s) => { engine.tileAt(s, 10, 4).wet = true; }), { type: 'douse', x: 10, y: 4 }],
    [base, { type: 'hooks', x: 9, y: 4 }],
    [base, { type: 'hooks', x: 19, y: 14 }],
    [ready, { type: 'gunpowder', x: 9, y: 4 }],
    [base, { type: 'evacuate', x: 12, y: 0 }],
    [edit(base, (s) => { s.evacuated.push('cripplegate'); }), { type: 'evacuate', x: 10, y: 4 }],
    [edit(base, (s) => { s.tiles.forEach((t) => { if (t.district === 'cripplegate') t.people = 0; }); }), { type: 'evacuate', x: 10, y: 4 }],
    [base, { type: 'guard', x: 10, y: 4 }],
    [edit(base, (s) => { s.lostLandmarks.push('st-pauls'); }), { type: 'guard', x: 5, y: 9 }],
    [engine.applyAction(base, { type: 'guard', x: 5, y: 9 }).state, { type: 'guard', x: 5, y: 9 }]
  ];
  return cases.map(([state, action]) => engine.canAct(state, action).reason);
};

test('the same seed and actions give deep-equal states and events', () => {
  // Act
  const first = replay(7, 'normal');
  const second = replay(7, 'normal');
  const strategyA = playGame({ seed: 3, difficulty: 'hard', plan: strategyTurn });
  const strategyB = playGame({ seed: 3, difficulty: 'hard', plan: strategyTurn });

  // Assert
  assert.deepEqual(first, second);
  assert.deepEqual(strategyA.state, strategyB.state);
  assert.deepEqual(strategyA.events, strategyB.events);
});

test('different seeds usually give different fires', () => {
  // Arrange
  const patterns = new Set();

  // Act
  for (let seed = 1; seed <= 10; seed += 1) {
    let state = engine.newGame({ seed });
    for (let turn = 0; turn < 4; turn += 1) state = engine.endTurn(state).state;
    patterns.add(state.tiles.map((t) => `${t.fire}${t.burnt ? 1 : 0}`).join(''));
  }

  // Assert
  assert.ok(patterns.size >= 8, `${patterns.size} different fires from 10 seeds`);
});

test('newGame sets up a fresh state', () => {
  // Act
  const state = engine.newGame();
  const hard = engine.newGame({ seed: 42, difficulty: 'hard' });

  // Assert
  assert.equal(state.version, 1);
  assert.equal(state.seed, 1);
  assert.equal(state.difficulty, 'normal');
  assert.equal(state.turn, 0);
  assert.equal(state.cols, engine.COLS);
  assert.equal(state.rows, engine.ROWS);
  assert.equal(state.tiles.length, engine.COLS * engine.ROWS);
  assert.equal(engine.tileAt(state, engine.START.x, engine.START.y).fire, 2);
  assert.deepEqual(state.triggers, ['start']);
  assert.equal(state.over, false);
  assert.equal(state.outcome, null);
  assert.equal(state.authority, false);
  assert.equal(state.resources.powder, 0);
  assert.deepEqual(state.wind, { from: 'E', strength: 3, dx: -1, dy: 0, label: 'Strong easterly gale' });
  assert.equal(hard.seed, 42);
  assert.equal(hard.difficulty, 'hard');
  assert.throws(() => engine.newGame({ difficulty: 'impossible' }), /difficulty/);
});

test('tileAt returns tiles by x and y and null out of bounds', () => {
  // Arrange
  const state = engine.newGame();

  // Assert
  assert.equal(engine.tileAt(state, 3, 5), state.tiles[5 * engine.COLS + 3]);
  assert.equal(engine.tileAt(state, -1, 0), null);
  assert.equal(engine.tileAt(state, 0, -1), null);
  assert.equal(engine.tileAt(state, engine.COLS, 0), null);
  assert.equal(engine.tileAt(state, 0, engine.ROWS), null);
  assert.equal(engine.getLandmark('tower').name, 'Tower of London');
  assert.equal(engine.getLandmark('nowhere'), undefined);
  assert.equal(engine.getDistrict(engine.DISTRICTS[0].id), engine.DISTRICTS[0]);
  assert.equal(engine.getDistrict('nowhere'), undefined);
});

test('state survives a JSON round trip at every turn', () => {
  for (const game of GAMES.slice(0, 4)) {
    for (const state of game.states) {
      assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
    }
  }
});

test('engine functions never change their inputs', () => {
  // Arrange
  const options = { seed: 9, difficulty: 'hard' };
  const optionsCopy = structuredClone(options);
  let state = engine.newGame(options);
  const actions = [
    { type: 'appeal' },
    { type: 'douse', x: 15, y: 12 },
    { type: 'guard', x: 5, y: 9 },
    { type: 'evacuate', x: 17, y: 13 },
    { type: 'gunpowder', x: 14, y: 13 },
    { type: 'hooks', x: 13, y: 9 }
  ];

  // Act and assert
  assert.deepEqual(options, optionsCopy);
  assert.equal(state.difficulty, 'hard');
  for (let turn = 0; turn < 5 && !state.over; turn += 1) {
    for (const action of actions) {
      const before = structuredClone(state);
      const actionCopy = structuredClone(action);
      engine.canAct(state, action);
      engine.getScore(state);
      engine.serialize(state);
      engine.tileAt(state, action.x, action.y);
      const result = engine.applyAction(state, action);
      assert.deepEqual(state, before);
      assert.deepEqual(action, actionCopy);
      state = result.state;
    }
    const before = structuredClone(state);
    const result = engine.endTurn(state);
    assert.deepEqual(state, before);
    assert.notEqual(result.state, state);
    state = result.state;
  }
  assert.ok(state.turn >= 3, `reached turn ${state.turn}`);
});

test('getTimeInfo matches the contract examples', () => {
  // Act
  const start = engine.getTimeInfo(0);

  // Assert
  assert.deepEqual(start, {
    turn: 0,
    dayName: 'Sunday',
    date: 2,
    month: 'September',
    year: 1666,
    hour: 1,
    hourLabel: '1am',
    label: 'Sunday 2 September, 1am'
  });
  assert.equal(engine.getTimeInfo(6).label, 'Monday 3 September, 1pm');
  assert.equal(engine.getTimeInfo(16).label, 'Thursday 6 September, 1am');
  assert.deepEqual([0, 1, 2, 3].map((t) => engine.getTimeInfo(t).hourLabel), ['1am', '7am', '1pm', '7pm']);
  assert.deepEqual([0, 4, 8, 12, 16].map((t) => engine.getTimeInfo(t).dayName),
    ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']);
  assert.equal(engine.LAST_TURN, 16);
});

test('the wind follows the 1666 schedule and wind-drops fires when it falls', () => {
  // Arrange
  const push = { E: [-1, 0], NE: [-1, 1] };

  for (const game of GAMES) {
    for (const [index, state] of game.states.entries()) {
      const { wind, turn } = state;

      // Assert
      assert.ok(['E', 'NE'].includes(wind.from), `turn ${turn} wind from ${wind.from}`);
      assert.deepEqual([wind.dx, wind.dy], push[wind.from]);
      assert.equal(typeof wind.label, 'string');
      if (turn <= 10) assert.equal(wind.strength, 3);
      else if (turn === 11) assert.equal(wind.strength, 2);
      else assert.ok(wind.strength <= 1);
      const firstCalm = wind.strength <= 1 && game.states[index - 1].wind.strength > 1;
      if (firstCalm && !state.over) {
        assert.ok(state.triggers.includes('wind-drops'));
        assert.ok(!game.states[index - 1].triggers.includes('wind-drops'));
      }
    }
  }
  assert.ok(GAMES.some((game) => game.state.triggers.includes('wind-drops')));
});

test('fire never enters river, wall, open or cleared tiles', () => {
  for (const game of GAMES) {
    for (const state of game.states) {
      // Act
      const bad = state.tiles.filter((tile) => (tile.fire > 0 || tile.burnt)
        && (!engine.FLAMMABLE_TYPES.includes(tile.type) || tile.cleared));

      // Assert
      assert.deepEqual(bad, [], `${game.plan} ${game.difficulty} seed ${game.seed} turn ${state.turn}`);
    }
    for (const event of game.events.filter((e) => e.type === 'ignite')) {
      assert.ok(engine.FLAMMABLE_TYPES.includes(engine.tileAt(game.state, event.x, event.y).type));
    }
  }
});

test('a line of cleared tiles in the fire\'s path never burns', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    // Arrange
    const start = edit(engine.newGame({ seed, difficulty: 'hard' }), (s) => {
      for (let y = 3; y <= 15; y += 1) {
        const tile = engine.tileAt(s, 15, y);
        if (engine.FLAMMABLE_TYPES.includes(tile.type)) tile.cleared = true;
      }
    });

    // Act
    const game = playGame({ start });

    // Assert
    for (const state of game.states) {
      for (let y = 3; y <= 15; y += 1) {
        const tile = engine.tileAt(state, 15, y);
        assert.ok(tile.fire === 0 && !tile.burnt, `seed ${seed} tile 15,${y} turn ${state.turn}`);
      }
    }
    assert.ok(!game.events.some((e) => e.type === 'ignite' && e.x === 15));
  }
});

test('the easterly gale pushes the fire further west than east', () => {
  // Arrange
  const centre = { x: 14, y: 9 };
  let west = 0;
  let east = 0;

  for (let seed = 1; seed <= 30; seed += 1) {
    let state = edit(engine.newGame({ seed }), (s) => {
      s.tiles.forEach((tile) => {
        Object.assign(tile, { type: 'house', fire: 0, burnt: false, district: 'cheap', landmark: null, houses: 60, people: 300 });
      });
      engine.tileAt(s, centre.x, centre.y).fire = 2;
    });

    // Act
    for (let turn = 0; turn < 4; turn += 1) state = engine.endTurn(state).state;
    const xs = state.tiles.map((tile, i) => (tile.fire > 0 || tile.burnt ? pointOf(state, i).x : null)).filter((x) => x !== null);
    west += centre.x - Math.min(...xs);
    east += Math.max(...xs) - centre.x;
  }

  // Assert
  assert.ok(west / 30 > east / 30, `west ${west / 30} east ${east / 30}`);
});

test('the game ends as extinguished when no fire is left, then refuses to go on', () => {
  // Arrange
  const lonely = edit(engine.newGame(), (s) => {
    s.tiles.forEach((tile, i) => {
      const { x, y } = pointOf(s, i);
      if (x !== engine.START.x || y !== engine.START.y) {
        Object.assign(tile, { type: 'open', district: null, landmark: null, houses: 0, people: 0 });
      }
    });
  });

  // Act
  const first = engine.endTurn(lonely);
  const second = engine.endTurn(first.state);
  const after = engine.endTurn(second.state);
  const refused = engine.applyAction(second.state, { type: 'appeal' });

  // Assert
  assert.equal(first.state.over, false);
  assert.equal(second.state.over, true);
  assert.equal(second.state.outcome, 'extinguished');
  assert.ok(second.events.some((e) => e.type === 'burnout'));
  assert.deepEqual(second.events.at(-1), { type: 'game-over', outcome: 'extinguished' });
  assert.ok(second.events.some((e) => e.type === 'trigger' && e.id === 'end'));
  assert.equal(second.state.triggers.at(-1), 'end');
  assert.equal(after.state, second.state);
  assert.deepEqual(after.events, []);
  assert.equal(refused.ok, false);
  assert.equal(refused.state, second.state);
  assert.deepEqual(refused.events, []);
});

test('the game ends on Thursday when turn reaches LAST_TURN', () => {
  // Arrange
  const late = edit(engine.newGame(), (s) => {
    s.turn = engine.LAST_TURN - 1;
  });

  // Act
  const result = engine.endTurn(late);

  // Assert
  assert.equal(result.state.turn, engine.LAST_TURN);
  assert.equal(result.state.over, true);
  assert.equal(result.state.outcome, 'thursday');
  assert.deepEqual(result.events.at(-1), { type: 'game-over', outcome: 'thursday' });
  assert.deepEqual(engine.endTurn(result.state).events, []);
  assert.ok(GAMES.every((game) => game.state.over && game.state.turn <= engine.LAST_TURN));
  assert.ok(GAMES.some((game) => game.state.outcome === 'thursday'));
});

test('TRIGGERS is the contract list and each fires at most once, in state order', () => {
  // Assert
  assert.deepEqual(engine.TRIGGERS, EXPECTED_TRIGGERS);
  for (const game of GAMES) {
    const fired = game.events.filter((e) => e.type === 'trigger').map((e) => e.id);
    assert.ok(fired.every((id) => engine.TRIGGERS.includes(id)));
    assert.equal(new Set(fired).size, fired.length, `${game.plan} ${game.difficulty} ${game.seed} fires each once`);
    assert.deepEqual(game.state.triggers, ['start', ...fired]);
    assert.equal(fired.at(-1), 'end');
  }
});

test('a do-nothing normal game fires the story triggers', () => {
  // Arrange
  const expected = ['start', 'first-spread', 'warehouses', 'sunday-morning', 'sunday-afternoon', 'monday', 'tuesday',
    'tuesday-night', 'wind-drops', 'wednesday', 'end'];

  for (const game of GAMES.filter((g) => g.plan === 'nothing' && g.difficulty === 'normal')) {
    // Assert
    for (const id of expected) assert.ok(game.state.triggers.includes(id), `seed ${game.seed} fires ${id}`);
  }
});

test('serialize and deserialize round-trip a game at several points', () => {
  for (const game of GAMES.slice(0, 6)) {
    for (const state of [game.states[0], game.states[3], game.state]) {
      // Act
      const loaded = engine.deserialize(engine.serialize(state));

      // Assert
      assert.deepEqual(loaded, state);
    }
  }
});

test('deserialize throws clear errors on bad saves', () => {
  // Arrange
  const state = engine.newGame();
  const without = (field) => JSON.stringify(edit(state, (s) => { delete s[field]; }));

  // Assert
  assert.throws(() => engine.deserialize('{not json'), /JSON/);
  assert.throws(() => engine.deserialize('[]'), /object/);
  assert.throws(() => engine.deserialize('null'), /object/);
  assert.throws(() => engine.deserialize(JSON.stringify({ ...state, version: 2 })), /version/);
  assert.throws(() => engine.deserialize(without('version')), /version/);
  for (const field of ['tiles', 'turn', 'wind', 'resources', 'triggers', 'difficulty', 'rngState', 'evacuated']) {
    assert.throws(() => engine.deserialize(without(field)), new RegExp(field));
  }
  assert.throws(() => engine.deserialize(JSON.stringify(edit(state, (s) => { s.tiles.pop(); }))), /tiles/);
  assert.throws(() => engine.deserialize(JSON.stringify(edit(state, (s) => { delete s.tiles[7].fire; }))), /tile 7/);
  assert.throws(() => engine.deserialize(JSON.stringify(edit(state, (s) => { s.tiles[3].type = 'lava'; }))), /type/);
});

test('engine and map code stay pure', () => {
  // Arrange
  const files = readdirSync(new URL('../src/engine/', import.meta.url))
    .filter((name) => name.endsWith('.js'))
    .map((name) => new URL(`../src/engine/${name}`, import.meta.url));
  files.push(new URL('../src/data/map.js', import.meta.url));
  const forbidden = [/Math\.random/, /\bDate\b/, /\bdocument\b/, /\bwindow\b/, /\blocalStorage\b/, /\bsetTimeout\b/,
    /\brequestAnimationFrame\b/, /\bperformance\b/];

  for (const file of files) {
    // Act
    const source = readFileSync(file, 'utf8');

    // Assert
    for (const pattern of forbidden) assert.doesNotMatch(source, pattern, `${file.pathname} uses ${pattern}`);
    assert.doesNotMatch(source, /export default/);
    assert.doesNotMatch(source, /from '(?!\.{1,2}\/)[^']*'/, 'relative imports only');
    assert.doesNotMatch(source, /from '[^']*(?<!\.js)'/, 'imports end in .js');
  }
  assert.ok(files.length >= 8);
});

test('player-facing engine text uses British spelling and short sentences', () => {
  // Arrange
  const texts = [
    ...engine.ACTIONS.flatMap((a) => [a.label, a.description]),
    ...engine.DIFFICULTIES.flatMap((d) => [d.label, d.description]),
    ...engine.LANDMARKS.flatMap((l) => [l.name, l.blurb]),
    ...engine.DISTRICTS.map((d) => d.name),
    ...new Set(GAMES.flatMap((g) => g.states.map((s) => s.wind.label))),
    ...new Set(GAMES.flatMap((g) => g.events.filter((e) => e.type === 'message').map((e) => e.text))),
    ...replay(2, 'easy').events.filter((e) => e.type === 'message').map((e) => e.text),
    ...[0, 8000, 12500, 15500].flatMap((lost) => {
      const { rating } = engine.getScore(stateWithHousesLost(lost));
      return [rating.label, rating.text];
    }),
    ...refusalReasons()
  ];

  // Act
  const banned = texts.filter((text) => bannedIn(text).length > 0);
  const long = texts.filter((text) => !sentencesOk(text));

  // Assert
  assert.ok(texts.length > 80, `${texts.length} texts checked`);
  assert.ok(texts.every((text) => typeof text === 'string' && text.length > 0));
  assert.deepEqual(banned, []);
  assert.deepEqual(long, []);
});

test('canAct gives a different short reason for each kind of refusal', () => {
  // Act
  const reasons = refusalReasons();

  // Assert
  assert.ok(reasons.every((reason) => reason.length > 0));
  assert.ok(new Set(reasons).size >= 20, `${new Set(reasons).size} different reasons`);
});

test('all four ratings can be reached', () => {
  // Act
  const ids = [0, 8000, 12500, 15500].map((lost) => engine.getScore(stateWithHousesLost(lost)).rating.id);

  // Assert
  assert.deepEqual(ids, ['saviour', 'better-than-1666', 'like-1666', 'worse-than-1666']);
});
