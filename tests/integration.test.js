import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as engine from '../src/engine/index.js';
import * as history from '../src/data/history.js';
import { TUTORIAL_STEPS } from '../src/ui/tutorial.js';
import { extractHtmlTags } from './helpers/scan-imports.js';

const INDEX_HTML = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');

const ENGINE_EXPORTS = {
  COLS: 'number',
  ROWS: 'number',
  LAST_TURN: 'number',
  TILE_TYPES: 'array',
  FLAMMABLE_TYPES: 'array',
  DIFFICULTIES: 'array',
  ACTIONS: 'array',
  TRIGGERS: 'array',
  LANDMARKS: 'array',
  DISTRICTS: 'array',
  START: 'object',
  newGame: 'function',
  tileAt: 'function',
  getLandmark: 'function',
  getDistrict: 'function',
  canAct: 'function',
  applyAction: 'function',
  endTurn: 'function',
  getTimeInfo: 'function',
  getScore: 'function',
  serialize: 'function',
  deserialize: 'function'
};

const HISTORY_EXPORTS = {
  CARDS: 'array',
  getCard: 'function',
  cardsForTrigger: 'function',
  cardsForTriggers: 'function',
  buildQuiz: 'function',
  WHAT_HAPPENED: 'array',
  SOURCES: 'array'
};

const ACTIONS = [
  { id: 'douse', label: 'Buckets and squirts', key: '1', cost: { ap: 1, men: 2, powder: 0, goodwill: 0 }, target: 'tile', needsAuthority: false },
  { id: 'hooks', label: 'Firehooks', key: '2', cost: { ap: 2, men: 4, powder: 0, goodwill: 1 }, target: 'tile', needsAuthority: false },
  { id: 'gunpowder', label: 'Gunpowder', key: '3', cost: { ap: 2, men: 2, powder: 1, goodwill: 2 }, target: 'tile', needsAuthority: true },
  { id: 'evacuate', label: 'Evacuate district', key: '4', cost: { ap: 1, men: 2, powder: 0, goodwill: 0 }, target: 'tile', needsAuthority: false },
  { id: 'guard', label: 'Post men', key: '5', cost: { ap: 1, men: 3, powder: 0, goodwill: 0 }, target: 'tile', needsAuthority: false },
  { id: 'appeal', label: 'Send word to the King', key: '6', cost: { ap: 1, men: 0, powder: 0, goodwill: 0 }, target: 'none', needsAuthority: false }
];

const TRIGGERS = [
  'start', 'first-spread', 'warehouses', 'sunday-morning', 'sunday-afternoon', 'first-douse', 'first-hooks',
  'first-gunpowder', 'first-evacuate', 'first-guard', 'authority', 'bridge', 'tower', 'monday', 'tuesday',
  'tuesday-night', 'wind-drops', 'wednesday', 'end'
];

const DATE_TRIGGERS = { 'sunday-morning': 1, 'sunday-afternoon': 2, monday: 5, tuesday: 9, 'tuesday-night': 11, wednesday: 13 };
const ACTION_TRIGGERS = ['first-douse', 'first-hooks', 'first-gunpowder', 'first-evacuate', 'first-guard', 'authority'];

const LANDMARKS = [
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
].map(([id, name, kind, scored, type]) => ({ id, name, kind, scored, type }));

const RATINGS = {
  'worse-than-1666': 'Worse than 1666',
  'like-1666': 'Much like 1666',
  'better-than-1666': 'Better than 1666',
  saviour: 'Saviour of London'
};

const PAGE_IDS = [
  'app', 'map-wrap', 'map', 'panel', 'btn-sheet', 'date-time', 'wind-info', 'resources', 'tile-info', 'actions',
  'btn-end-turn', 'btn-chronicle', 'btn-menu', 'btn-help', 'btn-zoom', 'log', 'legend', 'modal-root', 'tutorial-root', 'live'
];

const WAIT_EVENTS = ['tile-selected', 'action-done', 'turn-ended'];

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const BANNED_SPELLINGS = [
  'color', 'colors', 'center', 'centered', 'neighbor', 'neighbors', 'gray', 'honor', 'favorite',
  'armor', 'harbor', 'defense', 'organize', 'realize', 'recognize', 'theater'
];

const SHORT_GAME_PLAN = ['appeal', 'douse', 'evacuate', 'hooks', 'gunpowder', 'guard'];

/** Describes a value's type, treating arrays and null separately. */
function kindOf(value) {
  if (Array.isArray(value)) {
    return 'array';
  }
  return value === null ? 'null' : typeof value;
}

/** Returns a deep copy of plain JSON data. */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/** Returns the tile at x, y straight from the state's tile array. */
function tileOf(state, x, y) {
  return state.tiles[y * state.cols + x];
}

/** Returns the ids of trigger events, in order. */
function triggerIds(events) {
  return events.filter((event) => event.type === 'trigger').map((event) => event.id);
}

/** Plays a game where the player only ever ends the turn, recording every state and event. */
function playDoNothingGame(seed = 1, difficulty = 'normal') {
  let state = engine.newGame({ seed, difficulty });
  const states = [state];
  const events = [];
  for (let i = 0; i < engine.LAST_TURN + 4 && !state.over; i += 1) {
    const result = engine.endTurn(state);
    events.push(...result.events);
    state = result.state;
    states.push(state);
  }
  return { state, states, events };
}

/** Returns the first tile action of a type that canAct allows, scanning rows from the north-west. */
function findTarget(state, type) {
  for (let y = 0; y < state.rows; y += 1) {
    for (let x = 0; x < state.cols; x += 1) {
      if (engine.canAct(state, { type, x, y }).ok) {
        return { type, x, y };
      }
    }
  }
  return null;
}

/** Plays a few turns that try each action once (appealing until authority), recording what happened. */
function playShortGame() {
  let state = engine.newGame({ seed: 1, difficulty: 'normal' });
  const events = [];
  const steps = [];
  const done = new Set();
  const lastReasons = {};
  let appealsBeforeAuthority = 0;
  for (let turn = 0; turn < 8 && !state.over && done.size < SHORT_GAME_PLAN.length; turn += 1) {
    for (const type of SHORT_GAME_PLAN) {
      if (done.has(type)) {
        continue;
      }
      const action = type === 'appeal' ? { type } : findTarget(state, type);
      const check = action ? engine.canAct(state, action) : { ok: false, reason: 'no target found' };
      if (!check.ok) {
        lastReasons[type] = check.reason;
        continue;
      }
      const before = clone(state);
      const result = engine.applyAction(state, action);
      steps.push({ action, before, input: state, result });
      if (result.ok) {
        events.push(...result.events);
        state = result.state;
        if (type === 'appeal') {
          appealsBeforeAuthority += 1;
          if (state.authority) {
            done.add(type);
          }
        } else {
          done.add(type);
        }
      }
    }
    if (done.size < SHORT_GAME_PLAN.length) {
      const before = clone(state);
      const result = engine.endTurn(state);
      steps.push({ action: { type: 'end-turn' }, before, input: state, result });
      events.push(...result.events);
      state = result.state;
    }
  }
  return { state, events, steps, done, lastReasons, appealsBeforeAuthority };
}

/** Returns the ids of every card the player would have seen: the start cards plus each trigger event's cards. */
function seenCardIds(events) {
  const ids = history.cardsForTrigger('start').map((card) => card.id);
  for (const id of triggerIds(events)) {
    ids.push(...history.cardsForTrigger(id).map((card) => card.id));
  }
  return [...new Set(ids)];
}

/** Checks a list of quiz questions against the cards they came from and returns the problems found. */
function quizProblems(questions, cardIds) {
  return questions.flatMap((question, i) => {
    const problems = [];
    if (!cardIds.includes(question.cardId)) {
      problems.push(`question ${i} comes from card '${question.cardId}', which was not seen`);
    }
    if (typeof question.question !== 'string' || question.question.trim() === '') {
      problems.push(`question ${i} has no question text`);
    }
    if (!Array.isArray(question.options) || question.options.length < 3 || question.options.length > 4
      || question.options.some((option) => typeof option !== 'string' || option.trim() === '')) {
      problems.push(`question ${i} needs 3 or 4 option strings`);
    }
    if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer >= (question.options?.length ?? 0)) {
      problems.push(`question ${i} has an answer index out of range: ${question.answer}`);
    }
    return problems;
  });
}

/** Finds the British-spelling problems in a list of { where, text } entries. */
function spellingProblems(entries) {
  const pattern = new RegExp(`\\b(${BANNED_SPELLINGS.join('|')})\\b`, 'gi');
  return entries.flatMap(({ where, text }) => [...String(text).matchAll(pattern)].map((match) => `${where}: '${match[0]}'`));
}

/** Returns a map of id attribute to how often it appears in the page. */
function pageIdCounts() {
  const counts = new Map();
  for (const tag of extractHtmlTags(INDEX_HTML)) {
    for (const attr of tag.attrs.filter((a) => a.name === 'id')) {
      counts.set(attr.value, (counts.get(attr.value) ?? 0) + 1);
    }
  }
  return counts;
}

/** Returns the parsed start tag that carries the given id. */
function pageTag(id) {
  return extractHtmlTags(INDEX_HTML).find((tag) => tag.attrs.some((attr) => attr.name === 'id' && attr.value === id));
}

/** Returns the value of an attribute on a parsed tag, or undefined. */
function attrOf(tag, name) {
  return tag?.attrs.find((attr) => attr.name === name)?.value;
}

const doNothing = playDoNothingGame();
const shortGame = playShortGame();

describe('engine contract (section 3)', () => {
  it('exports every section 3 name with the right type', () => {
    // Arrange
    const expected = ENGINE_EXPORTS;

    // Act
    const actual = Object.fromEntries(Object.keys(expected).map((name) => [name, kindOf(engine[name])]));

    // Assert
    assert.deepEqual(actual, expected);
  });

  it('has the fixed grid, turn and tile type constants', () => {
    // Arrange
    const expected = {
      COLS: 28,
      ROWS: 18,
      LAST_TURN: 16,
      TILE_TYPES: ['house', 'warehouse', 'stone', 'open', 'river', 'wall'],
      FLAMMABLE_TYPES: ['house', 'warehouse', 'stone']
    };

    // Act
    const actual = {
      COLS: engine.COLS,
      ROWS: engine.ROWS,
      LAST_TURN: engine.LAST_TURN,
      TILE_TYPES: [...engine.TILE_TYPES],
      FLAMMABLE_TYPES: [...engine.FLAMMABLE_TYPES]
    };

    // Assert
    assert.deepEqual(actual, expected);
  });

  it('has the three difficulties with ids, labels and a description', () => {
    // Arrange
    const expected = [{ id: 'easy', label: 'Easy' }, { id: 'normal', label: 'Normal' }, { id: 'hard', label: 'Hard' }];

    // Act
    const actual = engine.DIFFICULTIES.map(({ id, label }) => ({ id, label }));
    const undescribed = engine.DIFFICULTIES.filter((d) => typeof d.description !== 'string' || d.description.trim() === '');

    // Assert
    assert.deepEqual(actual, expected);
    assert.deepEqual(undescribed, [], 'every difficulty needs a description');
  });

  it('has ACTIONS with exactly the section 3 ids, labels, keys, costs, targets and authority flags', () => {
    // Arrange
    const expected = ACTIONS;

    // Act
    const actual = engine.ACTIONS.map(({ id, label, key, cost, target, needsAuthority }) => ({
      id, label, key, cost: { ...cost }, target, needsAuthority
    }));
    const undescribed = engine.ACTIONS.filter((a) => typeof a.description !== 'string' || a.description.trim() === '');

    // Assert
    assert.deepEqual(actual, expected);
    assert.deepEqual(undescribed.map((a) => a.id), [], 'every action needs a description');
  });

  it('has TRIGGERS equal to section 4, in order', () => {
    // Arrange
    const expected = TRIGGERS;

    // Act
    const actual = [...engine.TRIGGERS];

    // Assert
    assert.deepEqual(actual, expected);
  });

  it('has LANDMARKS with the section 3 ids, names, kinds and scored flags, in order', () => {
    // Arrange
    const expected = LANDMARKS.map(({ id, name, kind, scored }) => ({ id, name, kind, scored }));

    // Act
    const actual = engine.LANDMARKS.map(({ id, name, kind, scored }) => ({ id, name, kind, scored }));
    const broken = engine.LANDMARKS.filter((l) => typeof l.blurb !== 'string' || l.blurb.trim() === ''
      || !Array.isArray(l.tiles) || l.tiles.length === 0);

    // Assert
    assert.deepEqual(actual, expected);
    assert.deepEqual(broken.map((l) => l.id), [], 'every landmark needs a blurb and at least one tile');
  });

  it('has 6 to 12 named districts with unique ids', () => {
    // Arrange
    const districts = engine.DISTRICTS;

    // Act
    const ids = districts.map((d) => d.id);
    const unnamed = districts.filter((d) => typeof d.id !== 'string' || typeof d.name !== 'string' || d.name.trim() === '');

    // Assert
    assert.ok(districts.length >= 6 && districts.length <= 12, `expected 6 to 12 districts, found ${districts.length}`);
    assert.equal(new Set(ids).size, ids.length, 'district ids must be unique');
    assert.deepEqual(unnamed, []);
  });

  it('looks up landmarks and districts by id', () => {
    // Arrange
    const district = engine.DISTRICTS[0];

    // Act
    const stPauls = engine.getLandmark('st-pauls');
    const found = engine.getDistrict(district.id);

    // Assert
    assert.equal(stPauls?.name, 'St Paul\'s Cathedral');
    assert.equal(engine.getLandmark('no-such-place'), undefined);
    assert.equal(found?.id, district.id);
    assert.equal(engine.getDistrict('no-such-ward'), undefined);
  });

  it('describes turns with getTimeInfo as in section 3', () => {
    // Arrange
    const turns = [0, 6, 16];

    // Act
    const [first, monday, thursday] = turns.map((turn) => engine.getTimeInfo(turn));

    // Assert
    assert.deepEqual({ ...first }, {
      turn: 0, dayName: 'Sunday', date: 2, month: 'September', year: 1666, hour: 1, hourLabel: '1am', label: 'Sunday 2 September, 1am'
    });
    assert.equal(monday.label, 'Monday 3 September, 1pm');
    assert.equal(thursday.label, 'Thursday 6 September, 1am');
  });
});

describe('a new game', () => {
  const state = engine.newGame({ seed: 1, difficulty: 'normal' });

  it('starts with the contract state fields', () => {
    // Arrange
    const expected = { version: 1, seed: 1, difficulty: 'normal', turn: 0, cols: 28, rows: 18, over: false, outcome: null, triggers: ['start'] };

    // Act
    const actual = Object.fromEntries(Object.keys(expected).map((key) => [key, state[key]]));

    // Assert
    assert.deepEqual(actual, expected);
    assert.equal(state.tiles.length, 28 * 18);
    assert.deepEqual(JSON.parse(JSON.stringify(state)), state, 'state must be plain JSON data');
  });

  it('starts the fire at Farriner\'s bakery in Pudding Lane', () => {
    // Arrange
    const { x, y } = engine.START;

    // Act
    const tile = engine.tileAt(state, x, y);

    // Assert
    assert.equal(tile.type, 'house');
    assert.equal(tile.landmark, 'pudding-lane');
    assert.equal(tile.fire, 2);
    assert.equal(engine.tileAt(state, -1, 0), null);
    assert.equal(engine.tileAt(state, 28, 0), null);
    assert.equal(engine.tileAt(state, 0, 18), null);
  });

  it('gives every tile the contract fields, districts and landmarks', () => {
    // Arrange
    const districtIds = new Set(engine.DISTRICTS.map((d) => d.id));
    const owner = new Map();
    const duplicates = [];
    for (const landmark of engine.LANDMARKS) {
      for (const [x, y] of landmark.tiles) {
        const key = `${x},${y}`;
        if (owner.has(key)) {
          duplicates.push(key);
        }
        owner.set(key, landmark.id);
      }
    }

    // Act
    const problems = [];
    for (let y = 0; y < 18; y += 1) {
      for (let x = 0; x < 28; x += 1) {
        const tile = tileOf(state, x, y);
        const where = `tile (${x}, ${y})`;
        if (!engine.TILE_TYPES.includes(tile.type)) {
          problems.push(`${where} has type ${tile.type}`);
        }
        for (const [field, type] of [['fire', 'number'], ['burnt', 'boolean'], ['cleared', 'boolean'], ['wet', 'boolean'], ['guard', 'number'], ['houses', 'number'], ['people', 'number']]) {
          if (typeof tile[field] !== type) {
            problems.push(`${where} field ${field} should be a ${type}`);
          }
        }
        const flammable = engine.FLAMMABLE_TYPES.includes(tile.type);
        if (flammable && !districtIds.has(tile.district)) {
          problems.push(`${where} is flammable but has district ${tile.district}`);
        }
        if (!flammable && tile.district !== null) {
          problems.push(`${where} is not flammable but has district ${tile.district}`);
        }
        if (tile.landmark !== (owner.get(`${x},${y}`) ?? null)) {
          problems.push(`${where} has landmark ${tile.landmark}, expected ${owner.get(`${x},${y}`) ?? null}`);
        }
      }
    }

    // Assert
    assert.deepEqual(duplicates, [], 'a tile belongs to at most one landmark');
    assert.deepEqual(problems, []);
  });

  it('builds each landmark from the section 3 tile type', () => {
    // Arrange
    const expectedType = Object.fromEntries(LANDMARKS.map((l) => [l.id, l.type]));

    // Act
    const wrong = engine.LANDMARKS.flatMap((landmark) => landmark.tiles
      .filter(([x, y]) => engine.tileAt(state, x, y)?.type !== expectedType[landmark.id])
      .map(([x, y]) => `${landmark.id} (${x}, ${y}) is ${engine.tileAt(state, x, y)?.type}, expected ${expectedType[landmark.id]}`));

    // Assert
    assert.deepEqual(wrong, []);
  });

  it('has about as many houses as London lost in 1666', () => {
    // Arrange
    const score = engine.getScore(state);

    // Act
    const total = state.housesTotal;

    // Assert
    assert.ok(total >= 15000 && total <= 17000, `housesTotal should be 15,000 to 17,000, found ${total}`);
    assert.equal(score.housesTotal, total);
  });

  it('starts with an easterly or north-easterly gale', () => {
    // Arrange
    const { wind } = state;

    // Act
    const shape = { from: ['E', 'NE'].includes(wind.from), strength: wind.strength, label: typeof wind.label };

    // Assert
    assert.deepEqual(shape, { from: true, strength: 3, label: 'string' });
  });

  it('refuses gunpowder before authority without changing the state', () => {
    // Arrange
    const action = { type: 'gunpowder', x: engine.START.x, y: engine.START.y };

    // Act
    const check = engine.canAct(state, action);
    const result = engine.applyAction(state, action);

    // Assert
    assert.equal(check.ok, false);
    assert.ok(typeof check.reason === 'string' && check.reason.trim() !== '', 'a refusal needs a reason');
    assert.equal(result.ok, false);
    assert.equal(result.state, state, 'a refused action returns the same state object');
    assert.deepEqual(result.events, []);
  });

  it('asks for a tile when a tile action has none', () => {
    // Arrange
    const action = { type: 'douse' };

    // Act
    const check = engine.canAct(state, action);

    // Assert
    assert.equal(check.ok, false);
    assert.ok(typeof check.reason === 'string' && check.reason.trim() !== '');
  });
});

describe('history contract (section 5)', () => {
  it('exports every section 5 name with the right type', () => {
    // Arrange
    const expected = HISTORY_EXPORTS;

    // Act
    const actual = Object.fromEntries(Object.keys(expected).map((name) => [name, kindOf(history[name])]));

    // Assert
    assert.deepEqual(actual, expected);
  });

  it('has at least one card for every trigger', () => {
    // Arrange
    const triggers = engine.TRIGGERS;

    // Act
    const missing = triggers.filter((id) => history.cardsForTrigger(id).length === 0);

    // Assert
    assert.deepEqual(missing, [], 'these triggers have no history card');
  });

  it('only uses engine trigger ids on its cards', () => {
    // Arrange
    const triggers = new Set(engine.TRIGGERS);

    // Act
    const strays = history.CARDS.filter((card) => !triggers.has(card.trigger)).map((card) => `${card.id}: ${card.trigger}`);

    // Assert
    assert.deepEqual(strays, []);
  });

  it('builds the Chronicle from state.triggers in trigger order', () => {
    // Arrange
    const triggers = ['start', 'first-spread', 'end'];

    // Act
    const cards = history.cardsForTriggers(triggers);

    // Assert
    const order = cards.map((card) => triggers.indexOf(card.trigger));
    assert.deepEqual(order, [...order].sort((a, b) => a - b));
    assert.equal(new Set(cards.map((card) => card.id)).size, cards.length, 'Chronicle cards must be unique');
  });
});

describe('a whole do-nothing game (normal, seed 1)', () => {
  const { state, states, events } = doNothing;

  it('ends with an outcome by Thursday', () => {
    // Arrange
    const outcomes = ['extinguished', 'thursday'];

    // Act
    const gameOver = events.filter((event) => event.type === 'game-over');

    // Assert
    assert.equal(state.over, true, 'the game should be over after at most LAST_TURN turns');
    assert.ok(outcomes.includes(state.outcome), `unexpected outcome ${state.outcome}`);
    assert.ok(state.turn <= engine.LAST_TURN);
    if (state.outcome === 'thursday') {
      assert.equal(state.turn, engine.LAST_TURN);
    }
    assert.deepEqual(gameOver.map((event) => event.outcome), [state.outcome], 'exactly one game-over event');
  });

  it('records each trigger once, in TRIGGERS ids, matching the trigger events', () => {
    // Arrange
    const ids = triggerIds(events);

    // Act
    const unknown = state.triggers.filter((id) => !engine.TRIGGERS.includes(id));

    // Assert
    assert.equal(state.triggers[0], 'start');
    assert.equal(state.triggers.at(-1), 'end');
    assert.deepEqual(unknown, []);
    assert.equal(new Set(state.triggers).size, state.triggers.length, 'each trigger fires at most once');
    assert.deepEqual(ids, state.triggers.slice(1), 'every trigger after start is announced by one event');
  });

  it('fires the date triggers it passes and no action triggers', () => {
    // Arrange
    const fired = new Set(state.triggers);

    // Act
    const missedDates = Object.entries(DATE_TRIGGERS).filter(([id, turn]) => turn < state.turn && !fired.has(id)).map(([id]) => id);
    const futureDates = Object.entries(DATE_TRIGGERS).filter(([id, turn]) => turn > state.turn && fired.has(id)).map(([id]) => id);
    const actionTriggers = ACTION_TRIGGERS.filter((id) => fired.has(id));

    // Assert
    assert.deepEqual(missedDates, [], 'date triggers for turns already passed must have fired');
    assert.deepEqual(futureDates, [], 'date triggers for turns never reached must not fire');
    assert.deepEqual(actionTriggers, [], 'the player took no actions');
    if (state.outcome === 'thursday') {
      assert.ok(fired.has('wind-drops'), 'the wind drops by Wednesday');
    }
  });

  it('follows the historical wind schedule', () => {
    // Arrange
    const winds = states.map((s) => ({ turn: s.turn, wind: s.wind }));

    // Act
    const problems = winds.flatMap(({ turn, wind }) => {
      const found = [];
      if (!COMPASS.includes(wind.from) || ![-1, 0, 1].includes(wind.dx) || ![-1, 0, 1].includes(wind.dy) || typeof wind.label !== 'string') {
        found.push(`turn ${turn}: bad wind shape ${JSON.stringify(wind)}`);
      }
      if (wind.strength > 0) {
        const dx = wind.from.includes('W') ? 1 : wind.from.includes('E') ? -1 : 0;
        const dy = wind.from.includes('N') ? 1 : wind.from.includes('S') ? -1 : 0;
        if (wind.dx !== dx || wind.dy !== dy) {
          found.push(`turn ${turn}: wind from ${wind.from} should push dx ${dx}, dy ${dy}`);
        }
      }
      if (turn <= 10 && !(wind.strength === 3 && ['E', 'NE'].includes(wind.from))) {
        found.push(`turn ${turn}: expected an E or NE gale, found ${wind.from} ${wind.strength}`);
      }
      if (turn === 11 && wind.strength !== 2) {
        found.push(`turn 11: expected strength 2, found ${wind.strength}`);
      }
      if (turn >= 12 && wind.strength > 1) {
        found.push(`turn ${turn}: expected strength 1 or less, found ${wind.strength}`);
      }
      return found;
    });

    // Assert
    assert.deepEqual(problems, []);
  });

  it('has a history card for every trigger event', () => {
    // Arrange
    const ids = triggerIds(events);

    // Act
    const missing = ids.filter((id) => history.cardsForTrigger(id).length === 0);

    // Assert
    assert.deepEqual(missing, []);
  });

  it('builds a 3-question quiz from the cards seen', () => {
    // Arrange
    const cardIds = seenCardIds(events);

    // Act
    const questions = history.buildQuiz(cardIds, state.seed);
    const again = history.buildQuiz(cardIds, state.seed);

    // Assert
    assert.equal(questions.length, 3);
    assert.deepEqual(quizProblems(questions, cardIds), []);
    assert.deepEqual(again, questions, 'buildQuiz must be deterministic');
  });

  it('is deterministic for the same seed', () => {
    // Arrange
    const replay = playDoNothingGame();

    // Act
    const same = { state: replay.state, events: replay.events };

    // Assert
    assert.deepEqual(same, { state, events });
  });

  it('round-trips the finished state through serialize and deserialize', () => {
    // Arrange
    const text = engine.serialize(state);

    // Act
    const restored = engine.deserialize(text);

    // Assert
    assert.equal(typeof text, 'string');
    assert.deepEqual(restored, state);
  });

  it('rejects bad saves with an Error', () => {
    // Arrange
    const data = JSON.parse(engine.serialize(state));
    const badSaves = ['{', 'null', '{}'];
    if (Object.hasOwn(data, 'version')) {
      badSaves.push(JSON.stringify({ ...data, version: 999 }));
    }

    // Act
    const accepted = badSaves.filter((text) => {
      try {
        engine.deserialize(text);
        return true;
      } catch (error) {
        return !(error instanceof Error) || error.message.trim() === '';
      }
    });

    // Assert
    assert.deepEqual(accepted, [], 'deserialize should throw an Error with a message for each bad save');
  });

  it('refuses to play on once the game is over', () => {
    // Arrange
    const appeal = { type: 'appeal' };

    // Act
    const turn = engine.endTurn(state);
    const action = engine.applyAction(state, appeal);

    // Assert
    assert.equal(turn.state, state);
    assert.deepEqual(turn.events, []);
    assert.equal(action.ok, false);
    assert.equal(action.state, state);
    assert.deepEqual(action.events, []);
  });

  it('scores the game in the getScore shape', () => {
    // Arrange
    const scored = engine.LANDMARKS.filter((l) => l.scored).map((l) => l.id).sort();

    // Act
    const score = engine.getScore(state);

    // Assert
    assert.equal(score.housesSaved, score.housesTotal - score.housesLost);
    assert.ok(score.housesPulledDown >= 0 && score.housesPulledDown <= score.housesLost);
    assert.ok(score.peopleSafe >= 0 && score.peopleSafe <= score.peopleTotal);
    assert.deepEqual([...score.landmarksSaved, ...score.landmarksLost].sort(), scored, 'every scored landmark is saved or lost once');
    assert.equal(score.stPaulsSaved, score.landmarksSaved.includes('st-pauls'));
    assert.deepEqual({ ...score.history }, { housesLost: 13200, churchesLost: 87, stPaulsLost: true, deathsRecorded: 6 });
    assert.equal(score.beatHistory, score.housesLost < 13200);
    assert.equal(RATINGS[score.rating.id], score.rating.label, `unknown rating ${score.rating.id}`);
    assert.ok(typeof score.rating.text === 'string' && score.rating.text.trim() !== '');
  });
});

describe('a short game with a few actions (normal, seed 1)', () => {
  const { state, events, steps, done, lastReasons, appealsBeforeAuthority } = shortGame;

  it('manages every kind of action within a few turns', () => {
    // Arrange
    const planned = SHORT_GAME_PLAN;

    // Act
    const missing = planned.filter((type) => !done.has(type));

    // Assert
    assert.deepEqual(missing, [], `these actions never became possible: ${JSON.stringify(lastReasons)}`);
  });

  it('never changes the state it is given', () => {
    // Arrange
    const calls = steps;

    // Act
    const mutated = calls.filter((step) => JSON.stringify(step.input) !== JSON.stringify(step.before)).map((step) => step.action.type);

    // Assert
    assert.deepEqual(mutated, [], 'applyAction and endTurn must not mutate their arguments');
  });

  it('wins authority after 2 appeals on normal', () => {
    // Arrange
    const fired = new Set(state.triggers);

    // Act
    const authority = state.authority;

    // Assert
    assert.equal(authority, true);
    assert.equal(appealsBeforeAuthority, 2);
    assert.ok(fired.has('authority'));
  });

  it('fires each first-action trigger from the action that earned it', () => {
    // Arrange
    const firsts = new Map();
    for (const step of steps) {
      if (step.result.ok && step.action.type !== 'end-turn' && step.action.type !== 'appeal' && !firsts.has(step.action.type)) {
        firsts.set(step.action.type, step.result.events);
      }
    }

    // Act
    const missing = [...firsts.entries()]
      .filter(([type, stepEvents]) => !triggerIds(stepEvents).includes(`first-${type}`))
      .map(([type]) => type);

    // Assert
    assert.deepEqual(missing, []);
  });

  it('charges exactly the listed cost for each action', () => {
    // Arrange
    const costs = Object.fromEntries(ACTIONS.map((a) => [a.id, a.cost]));
    const applied = steps.filter((step) => step.result.ok && step.action.type !== 'end-turn');

    // Act
    const wrong = applied.flatMap(({ action, before, result }) => {
      const cost = costs[action.type];
      const keys = action.type === 'appeal' ? ['ap'] : ['ap', 'men', 'powder', 'goodwill'];
      return keys
        .filter((key) => before.resources[key] - result.state.resources[key] !== cost[key])
        .map((key) => `${action.type} changed ${key} by ${before.resources[key] - result.state.resources[key]}, expected ${cost[key]}`);
    });

    // Assert
    assert.deepEqual(wrong, []);
  });

  it('applies the visible effect of each action to its tile', () => {
    // Arrange
    const firstOk = (type) => steps.find((step) => step.action.type === type && step.result.ok);

    // Act
    const douse = firstOk('douse');
    const hooks = firstOk('hooks');
    const gunpowder = firstOk('gunpowder');
    const evacuate = firstOk('evacuate');
    const guard = firstOk('guard');

    // Assert
    assert.equal(tileOf(douse.result.state, douse.action.x, douse.action.y).wet, true, 'douse makes the tile wet');
    assert.equal(tileOf(hooks.result.state, hooks.action.x, hooks.action.y).cleared, true, 'hooks clear the tile');
    assert.equal(tileOf(gunpowder.result.state, gunpowder.action.x, gunpowder.action.y).cleared, true, 'gunpowder clears the tile');
    const district = tileOf(evacuate.before, evacuate.action.x, evacuate.action.y).district;
    assert.ok(evacuate.result.state.evacuated.includes(district), 'the district is marked evacuated');
    assert.ok(evacuate.result.state.peopleSafe > evacuate.before.peopleSafe, 'evacuated people are safe');
    assert.ok(tileOf(guard.result.state, guard.action.x, guard.action.y).guard > 0, 'men are posted on the landmark');
  });

  it('has a history card for every trigger event', () => {
    // Arrange
    const ids = triggerIds(events);

    // Act
    const missing = ids.filter((id) => history.cardsForTrigger(id).length === 0);

    // Assert
    assert.ok(ids.length > 0, 'the short game should fire some triggers');
    assert.deepEqual(missing, []);
  });

  it('builds a 3-question quiz from the cards seen', () => {
    // Arrange
    const cardIds = seenCardIds(events);

    // Act
    const questions = history.buildQuiz(cardIds, state.seed);

    // Assert
    assert.equal(questions.length, 3);
    assert.deepEqual(quizProblems(questions, cardIds), []);
  });

  it('round-trips the state mid-game', () => {
    // Arrange
    const text = engine.serialize(state);

    // Act
    const restored = engine.deserialize(text);

    // Assert
    assert.deepEqual(restored, state);
  });
});

describe('tutorial and page (sections 6a and 6f)', () => {
  const counts = pageIdCounts();
  const actionIds = engine.ACTIONS.map((a) => a.id);

  it('index.html has exactly one element for every 6a id', () => {
    // Arrange
    const ids = PAGE_IDS;

    // Act
    const wrong = ids.filter((id) => counts.get(id) !== 1).map((id) => `#${id} appears ${counts.get(id) ?? 0} times`);

    // Assert
    assert.deepEqual(wrong, []);
  });

  it('index.html sets up the page as 6a describes', () => {
    // Arrange
    const tags = extractHtmlTags(INDEX_HTML);

    // Act
    const html = tags.find((tag) => tag.tag === 'html');
    const viewport = tags.find((tag) => tag.tag === 'meta' && attrOf(tag, 'name') === 'viewport');
    const icon = tags.find((tag) => tag.tag === 'link' && (attrOf(tag, 'rel') ?? '').split(/\s+/).includes('icon'));
    const map = pageTag('map');
    const live = pageTag('live');

    // Assert
    assert.equal(attrOf(html, 'lang'), 'en-GB');
    assert.ok(viewport, 'a viewport meta tag is needed');
    assert.equal(attrOf(icon, 'href'), 'data:,');
    assert.equal(map?.tag, 'canvas');
    assert.equal(attrOf(map, 'tabindex'), '0');
    assert.ok((attrOf(map, 'aria-label') ?? '').trim() !== '', 'the map canvas needs an aria-label');
    assert.equal(attrOf(live, 'aria-live'), 'polite');
  });

  it('index.html leaves modal-root and tutorial-root empty', () => {
    // Arrange
    const roots = ['modal-root', 'tutorial-root'];

    // Act
    const notEmpty = roots.filter((id) => !new RegExp(`<([a-zA-Z][\\w-]*)\\b[^>]*\\bid=(["'])${id}\\2[^>]*>\\s*</\\1>`).test(INDEX_HTML));

    // Assert
    assert.deepEqual(notEmpty, []);
  });

  it('tutorial steps have unique ids and valid waitFor values', () => {
    // Arrange
    const steps = TUTORIAL_STEPS;

    // Act
    const ids = steps.map((step) => step.id);
    // waitFor is null or { event, type }; type is optional (left out), but when present it must be an action id.
    const isValidWait = (wait) => wait === null || (
      typeof wait === 'object'
      && WAIT_EVENTS.includes(wait.event)
      && (wait.type === undefined || actionIds.includes(wait.type))
    );
    const badWaits = steps.filter((step) => !isValidWait(step.waitFor))
      .map((step) => `${step.id}: ${String(JSON.stringify(step.waitFor))}`);

    // Assert
    assert.equal(new Set(ids).size, ids.length, 'tutorial step ids must be unique');
    assert.deepEqual(badWaits, [], 'waitFor must be null or { event, type } with a 6f event and, when type is given, an action id');
  });

  it('tutorial targets use only 6a ids in index.html and [data-action] action ids', () => {
    // Arrange
    const targets = TUTORIAL_STEPS.filter((step) => step.target !== null).map((step) => ({ id: step.id, target: step.target }));

    // Act
    // [data-action=...] with the value double-quoted, single-quoted or bare; CSS allows whitespace inside the brackets.
    const dataAction = /\[\s*data-action\s*=\s*(?:"([^"]*)"|'([^']*)'|([\w-]+))\s*\]/g;
    const problems = targets.flatMap(({ id, target }) => {
      if (typeof target !== 'string') {
        return [`${id}: target must be null or a CSS selector string`];
      }
      const found = [];
      const idsOnly = target.replace(dataAction, (_match, double, single, bare) => {
        const action = double ?? single ?? bare;
        if (!actionIds.includes(action)) {
          found.push(`${id}: data-action '${action}' is not an action id`);
        }
        return ' ';
      });
      for (const [, pageId] of idsOnly.matchAll(/#([A-Za-z][\w-]*)/g)) {
        if (!PAGE_IDS.includes(pageId) || counts.get(pageId) !== 1) {
          found.push(`${id}: #${pageId} is not a 6a id in index.html`);
        }
      }
      const rest = idsOnly
        .replace(/#[A-Za-z][\w-]*/g, '')
        .replace(/[\s,>+~]/g, '');
      if (rest !== '') {
        found.push(`${id}: '${target}' uses '${rest}', but targets may only use 6a ids and [data-action]`);
      }
      return found;
    });

    // Assert
    assert.deepEqual(problems, []);
  });
});

describe('player-facing text across units', () => {
  it('uses British spellings', () => {
    // Arrange
    const score = engine.getScore(doNothing.state);
    const entries = [
      ...engine.ACTIONS.flatMap((a) => [{ where: `action ${a.id}`, text: a.label }, { where: `action ${a.id}`, text: a.description }]),
      ...engine.DIFFICULTIES.flatMap((d) => [{ where: `difficulty ${d.id}`, text: d.label }, { where: `difficulty ${d.id}`, text: d.description }]),
      ...engine.LANDMARKS.flatMap((l) => [{ where: `landmark ${l.id}`, text: l.name }, { where: `landmark ${l.id}`, text: l.blurb }]),
      ...engine.DISTRICTS.map((d) => ({ where: `district ${d.id}`, text: d.name })),
      ...doNothing.states.map((s) => ({ where: `wind at turn ${s.turn}`, text: s.wind.label })),
      ...Object.values(shortGame.lastReasons).map((reason) => ({ where: 'canAct reason', text: reason })),
      { where: 'rating', text: `${score.rating.label} ${score.rating.text}` },
      ...doNothing.events.filter((e) => e.type === 'message').map((e) => ({ where: 'message event', text: e.text })),
      ...history.CARDS.flatMap((card) => [
        { where: `card ${card.id}`, text: [card.title, card.text, card.when, card.learnMore].filter(Boolean).join(' ') },
        ...(card.quiz ? [{ where: `card ${card.id} quiz`, text: [card.quiz.question, ...card.quiz.options].join(' ') }] : [])
      ]),
      ...history.WHAT_HAPPENED.map((text, i) => ({ where: `WHAT_HAPPENED ${i}`, text })),
      ...history.SOURCES.map((source) => ({ where: `source ${source.title}`, text: source.note ?? '' })),
      ...TUTORIAL_STEPS.map((step) => ({ where: `tutorial ${step.id}`, text: `${step.title} ${step.text}` }))
    ];

    // Act
    const problems = spellingProblems(entries);

    // Assert
    assert.deepEqual(problems, []);
  });
});
