import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../src/engine/index.js';

const EXPECTED_ACTIONS = [
  { id: 'douse', label: 'Buckets and squirts', key: '1', cost: { ap: 1, men: 2, powder: 0, goodwill: 0 }, target: 'tile', needsAuthority: false },
  { id: 'hooks', label: 'Firehooks', key: '2', cost: { ap: 2, men: 4, powder: 0, goodwill: 1 }, target: 'tile', needsAuthority: false },
  { id: 'gunpowder', label: 'Gunpowder', key: '3', cost: { ap: 2, men: 2, powder: 1, goodwill: 2 }, target: 'tile', needsAuthority: true },
  { id: 'evacuate', label: 'Evacuate district', key: '4', cost: { ap: 1, men: 2, powder: 0, goodwill: 0 }, target: 'tile', needsAuthority: false },
  { id: 'guard', label: 'Post men', key: '5', cost: { ap: 1, men: 3, powder: 0, goodwill: 0 }, target: 'tile', needsAuthority: false },
  { id: 'appeal', label: 'Send word to the King', key: '6', cost: { ap: 1, men: 0, powder: 0, goodwill: 0 }, target: 'none', needsAuthority: false }
];

// Places on the normal map used by these tests.
const HOUSE = { x: 10, y: 4 };
const STONE_CHURCH = { x: 9, y: 4 };
const RIVER = { x: 0, y: 5 };
const THAMES = { x: 5, y: 16 };
const WALL = { x: 1, y: 5 };
const OPEN = { x: 12, y: 0 };
const ST_PAULS = { x: 5, y: 9 };
const PUDDING_LANE_NORTH = { x: 19, y: 13 };
const BLAST = { x: 9, y: 11 };

const costOf = (id) => engine.ACTIONS.find((a) => a.id === id).cost;
const fresh = (difficulty = 'normal') => engine.newGame({ seed: 1, difficulty });
const edit = (state, change) => {
  const copy = JSON.parse(JSON.stringify(state));
  change(copy);
  return copy;
};
const tile = (state, { x, y }) => engine.tileAt(state, x, y);
const withAuthority = (state) => edit(state, (s) => {
  s.authority = true;
  s.resources.powder = 3;
});
const triggerEvents = (events, id) => events.filter((e) => e.type === 'trigger' && e.id === id);

const assertCostPaid = (before, after, id, keys = ['ap', 'men', 'powder', 'goodwill']) => {
  const cost = costOf(id);
  for (const key of keys) {
    assert.equal(after.resources[key], before.resources[key] - cost[key], `${id} pays ${key}`);
  }
};

const assertRefused = (state, action, label) => {
  const result = engine.applyAction(state, action);
  const check = engine.canAct(state, action);
  assert.equal(result.ok, false, `${label} is refused`);
  assert.equal(typeof result.reason, 'string');
  assert.ok(result.reason.length > 0, `${label} gives a reason`);
  assert.equal(result.state, state, `${label} returns the same state`);
  assert.deepEqual(result.events, [], `${label} has no events`);
  assert.deepEqual(check, { ok: false, reason: result.reason }, `${label} canAct agrees`);
};

test('ACTIONS ids, labels, keys, costs, targets and needsAuthority equal the contract', () => {
  // Act
  const actual = engine.ACTIONS.map(({ id, label, key, cost, target, needsAuthority }) => ({ id, label, key, cost, target, needsAuthority }));

  // Assert
  assert.deepEqual(actual, EXPECTED_ACTIONS);
  for (const action of engine.ACTIONS) {
    assert.equal(typeof action.description, 'string');
    assert.ok(action.description.length > 10 && action.description.length < 120);
  }
});

test('canAct says ok with an empty reason when an action is allowed', () => {
  // Act
  const check = engine.canAct(fresh(), { type: 'douse', ...engine.START });

  // Assert
  assert.deepEqual(check, { ok: true, reason: '' });
});

test('douse knocks a burning tile down one level, soaks it and fires first-douse once', () => {
  // Arrange
  const state = fresh();

  // Act
  const first = engine.applyAction(state, { type: 'douse', ...engine.START });
  const second = engine.applyAction(first.state, { type: 'douse', ...HOUSE });

  // Assert
  assert.equal(first.ok, true);
  assertCostPaid(state, first.state, 'douse');
  assert.equal(tile(first.state, engine.START).fire, 1);
  assert.equal(tile(first.state, engine.START).wet, true);
  assert.equal(triggerEvents(first.events, 'first-douse').length, 1);
  assert.equal(second.ok, true);
  assert.equal(tile(second.state, HOUSE).wet, true);
  assert.equal(tile(second.state, HOUSE).fire, 0);
  assert.equal(triggerEvents(second.events, 'first-douse').length, 0);
  assert.equal(second.state.triggers.filter((id) => id === 'first-douse').length, 1);
});

test('douse puts out a tile at fire level 1 with an extinguish event', () => {
  // Arrange
  const state = edit(fresh(), (s) => {
    tile(s, engine.START).fire = 1;
  });

  // Act
  const result = engine.applyAction(state, { type: 'douse', ...engine.START });

  // Assert
  assert.equal(tile(result.state, engine.START).fire, 0);
  assert.deepEqual(result.events[0], { type: 'extinguish', ...engine.START });
});

test('douse may target a tile that is still soaked, and the soaking lasts until the end of the next turn', () => {
  // Arrange
  const state = fresh();
  const soaked = engine.applyAction(state, { type: 'douse', ...engine.START }).state;

  // Act
  const again = engine.applyAction(soaked, { type: 'douse', ...engine.START });
  const nextTurn = engine.endTurn(soaked).state;

  // Assert
  assert.equal(tile(soaked, engine.START).wet, true);
  assert.equal(again.ok, true);
  assert.equal(tile(again.state, engine.START).fire, 0);
  assert.equal(tile(again.state, engine.START).wet, true);
  assert.equal(again.state.resources.ap, state.resources.ap - 2);
  assert.equal(tile(nextTurn, engine.START).wet, false);
});

test('hooks pull down a house: cleared, people safe, first-hooks fired once', () => {
  // Arrange
  const state = fresh();
  const people = tile(state, HOUSE).people;

  // Act
  const result = engine.applyAction(state, { type: 'hooks', ...HOUSE });
  const again = engine.applyAction(result.state, { type: 'hooks', x: HOUSE.x + 1, y: HOUSE.y });

  // Assert
  assert.equal(result.ok, true);
  assertCostPaid(state, result.state, 'hooks');
  assert.equal(tile(result.state, HOUSE).cleared, true);
  assert.equal(tile(result.state, HOUSE).people, 0);
  assert.equal(tile(result.state, HOUSE).houses, tile(state, HOUSE).houses);
  assert.equal(result.state.peopleSafe, state.peopleSafe + people);
  assert.ok(result.events.some((e) => e.type === 'cleared' && e.x === HOUSE.x && e.y === HOUSE.y));
  assert.equal(triggerEvents(result.events, 'first-hooks').length, 1);
  assert.equal(again.ok, true);
  assert.equal(triggerEvents(again.events, 'first-hooks').length, 0);
});

test('gunpowder clears the tile and its house or warehouse neighbours, puts out fire and fires first-gunpowder', () => {
  // Arrange
  const state = edit(withAuthority(fresh()), (s) => {
    tile(s, BLAST).fire = 2;
  });
  const plus = [BLAST, { x: 10, y: 11 }, { x: 9, y: 10 }, { x: 9, y: 12 }];
  const stone = { x: 8, y: 11 };
  const people = plus.reduce((sum, p) => sum + tile(state, p).people, 0);

  // Act
  const result = engine.applyAction(state, { type: 'gunpowder', ...BLAST });

  // Assert
  assert.equal(result.ok, true);
  assertCostPaid(state, result.state, 'gunpowder');
  for (const p of plus) {
    assert.equal(tile(result.state, p).cleared, true, `${p.x},${p.y} cleared`);
    assert.equal(tile(result.state, p).fire, 0);
    assert.equal(tile(result.state, p).people, 0);
  }
  assert.equal(tile(state, stone).type, 'stone');
  assert.equal(tile(result.state, stone).cleared, false);
  assert.equal(result.state.peopleSafe, state.peopleSafe + people);
  assert.ok(result.events.some((e) => e.type === 'extinguish' && e.x === BLAST.x && e.y === BLAST.y));
  assert.equal(result.events.filter((e) => e.type === 'cleared').length, 4);
  assert.equal(triggerEvents(result.events, 'first-gunpowder').length, 1);
});

test('gunpowder is refused before authority even with powder, and allowed after', () => {
  // Arrange
  const before = edit(fresh(), (s) => {
    s.resources.powder = 3;
  });
  const after = edit(before, (s) => {
    s.authority = true;
  });

  // Act
  const check = engine.canAct(before, { type: 'gunpowder', ...HOUSE });

  // Assert
  assertRefused(before, { type: 'gunpowder', ...HOUSE }, 'gunpowder without authority');
  assert.match(check.reason, /King/);
  assert.equal(engine.applyAction(after, { type: 'gunpowder', ...HOUSE }).ok, true);
});

test('evacuate moves a whole district to safety and fires first-evacuate', () => {
  // Arrange
  const state = fresh();
  const district = tile(state, HOUSE).district;
  const people = state.tiles.filter((t) => t.district === district).reduce((sum, t) => sum + t.people, 0);

  // Act
  const result = engine.applyAction(state, { type: 'evacuate', ...HOUSE });

  // Assert
  assert.equal(result.ok, true);
  assertCostPaid(state, result.state, 'evacuate');
  assert.ok(people > 0);
  assert.equal(result.state.peopleSafe, state.peopleSafe + people);
  assert.ok(result.state.tiles.filter((t) => t.district === district).every((t) => t.people === 0));
  assert.deepEqual(result.state.evacuated, [district]);
  assert.equal(triggerEvents(result.events, 'first-evacuate').length, 1);
});

test('guard posts men on every tile of a scored landmark and keeps them out of next turn', () => {
  // Arrange
  const state = fresh();
  const tiles = engine.getLandmark('st-pauls').tiles;

  // Act
  const result = engine.applyAction(state, { type: 'guard', ...ST_PAULS });
  const nextTurn = engine.endTurn(result.state).state;

  // Assert
  assert.equal(result.ok, true);
  assertCostPaid(state, result.state, 'guard');
  assert.ok(tiles.every(([x, y]) => engine.tileAt(result.state, x, y).guard > 0));
  assert.equal(triggerEvents(result.events, 'first-guard').length, 1);
  assert.equal(nextTurn.resources.men, nextTurn.limits.men - costOf('guard').men);
  assert.ok(tiles.every(([x, y]) => engine.tileAt(nextTurn, x, y).guard > 0));
});

test('appeal wins authority after 1, 2 and 3 appeals on easy, normal and hard', () => {
  for (const [difficulty, needed] of [['easy', 1], ['normal', 2], ['hard', 3]]) {
    // Arrange
    let state = fresh(difficulty);
    let authorityEvents = 0;

    // Act
    for (let i = 1; i <= needed; i += 1) {
      const result = engine.applyAction(state, { type: 'appeal' });
      assert.equal(result.ok, true, `${difficulty} appeal ${i}`);
      assertCostPaid(state, result.state, 'appeal', ['ap', 'men', 'goodwill']);
      authorityEvents += triggerEvents(result.events, 'authority').length;
      assert.equal(result.state.authority, i === needed, `${difficulty} authority after ${i}`);
      state = i === needed ? result.state : engine.endTurn(result.state).state;
    }

    // Assert
    assert.equal(authorityEvents, 1);
    assert.equal(state.appeals, needed);
    assert.ok(state.resources.powder > 0, `${difficulty} gunpowder arrives`);
    assert.equal(state.triggers.filter((id) => id === 'authority').length, 1);
    assertRefused(state, { type: 'appeal' }, `${difficulty} appeal after authority`);
  }
});

test('appeal is refused twice in one turn', () => {
  // Arrange
  const state = engine.applyAction(fresh('hard'), { type: 'appeal' }).state;

  // Assert
  assert.equal(state.appealedThisTurn, true);
  assertRefused(state, { type: 'appeal' }, 'second appeal');
  assert.equal(engine.endTurn(state).state.appealedThisTurn, false);
});

test('actions are refused when ap, men, powder or goodwill are short', () => {
  // Arrange
  const base = withAuthority(fresh());
  const noAp = edit(base, (s) => {
    s.resources.ap = 0;
  });
  const noMen = edit(base, (s) => {
    s.resources.men = 1;
  });
  const noPowder = edit(base, (s) => {
    s.resources.powder = 0;
  });
  const noGoodwill = edit(base, (s) => {
    s.resources.goodwill = 0;
  });
  const lowGoodwill = edit(base, (s) => {
    s.resources.goodwill = 1;
  });

  // Assert
  for (const id of ['douse', 'hooks', 'gunpowder', 'evacuate', 'guard']) {
    const target = id === 'guard' ? ST_PAULS : HOUSE;
    assertRefused(noAp, { type: id, ...target }, `${id} without ap`);
    assertRefused(noMen, { type: id, ...target }, `${id} without men`);
  }
  assertRefused(edit(fresh(), (s) => {
    s.resources.ap = 0;
  }), { type: 'appeal' }, 'appeal without ap');
  assertRefused(noPowder, { type: 'gunpowder', ...HOUSE }, 'gunpowder without powder');
  assertRefused(noGoodwill, { type: 'hooks', ...HOUSE }, 'hooks without goodwill');
  assertRefused(lowGoodwill, { type: 'gunpowder', ...HOUSE }, 'gunpowder with too little goodwill');
  assert.equal(engine.canAct(noMen, { type: 'appeal' }).ok, false, 'appeal is refused after authority');
});

test('tile actions are refused on invalid targets', () => {
  // Arrange
  const base = withAuthority(fresh());
  const burnt = edit(base, (s) => {
    tile(s, HOUSE).burnt = true;
  });
  const cleared = engine.applyAction(base, { type: 'hooks', ...HOUSE }).state;
  const evacuated = engine.applyAction(base, { type: 'evacuate', ...HOUSE }).state;

  // Assert
  for (const id of ['douse', 'hooks', 'gunpowder', 'evacuate', 'guard']) {
    assertRefused(base, { type: id }, `${id} with no tile`);
    assertRefused(base, { type: id, x: 3 }, `${id} without y`);
    assertRefused(base, { type: id, y: 3 }, `${id} without x`);
    assertRefused(base, { type: id, x: -1, y: 3 }, `${id} off the west edge`);
    assertRefused(base, { type: id, x: 28, y: 3 }, `${id} off the east edge`);
    assertRefused(base, { type: id, x: 3, y: 18 }, `${id} off the south edge`);
    for (const place of [RIVER, THAMES, WALL, OPEN]) {
      assertRefused(base, { type: id, ...place }, `${id} on ${tile(base, place).type}`);
    }
  }
  for (const id of ['douse', 'hooks', 'gunpowder']) {
    assertRefused(burnt, { type: id, ...HOUSE }, `${id} on a burnt tile`);
    assertRefused(cleared, { type: id, ...HOUSE }, `${id} on a cleared tile`);
  }
  assertRefused(base, { type: 'hooks', ...engine.START }, 'hooks on a burning tile');
  assertRefused(base, { type: 'hooks', ...STONE_CHURCH }, 'hooks on stone');
  assertRefused(base, { type: 'gunpowder', ...STONE_CHURCH }, 'gunpowder on stone');
  assertRefused(base, { type: 'guard', ...HOUSE }, 'guard outside any landmark');
  assertRefused(base, { type: 'guard', ...PUDDING_LANE_NORTH }, 'guard on an unscored landmark');
  assertRefused(evacuated, { type: 'evacuate', ...HOUSE }, 'evacuate an evacuated district');
  assertRefused(base, { type: 'set-fire', ...HOUSE }, 'an unknown action');
});

test('guard is refused twice and on a lost landmark', () => {
  // Arrange
  const guarded = engine.applyAction(fresh(), { type: 'guard', ...ST_PAULS }).state;
  const lost = edit(fresh(), (s) => {
    s.lostLandmarks.push('st-pauls');
  });

  // Assert
  assertRefused(guarded, { type: 'guard', ...ST_PAULS }, 'guard twice');
  assertRefused(lost, { type: 'guard', ...ST_PAULS }, 'guard a lost landmark');
});

test('a landmark that is lost sends its guards home', () => {
  // Arrange
  const guarded = engine.applyAction(fresh(), { type: 'guard', ...ST_PAULS }).state;
  const burning = edit(guarded, (s) => {
    for (const [x, y] of engine.getLandmark('st-pauls').tiles) {
      engine.tileAt(s, x, y).fire = 3;
    }
  });

  // Act
  const result = engine.endTurn(burning);
  const lostEvents = result.events.filter((e) => e.type === 'landmark-lost' && e.id === 'st-pauls');

  // Assert
  assert.equal(lostEvents.length, 1);
  assert.ok(engine.getLandmark('st-pauls').tiles.every(([x, y]) => engine.tileAt(result.state, x, y).guard === 0));
  assert.equal(result.state.resources.men, result.state.limits.men);
});

test('every action is refused once the game is over', () => {
  // Arrange
  const over = edit(withAuthority(fresh()), (s) => {
    s.over = true;
    s.outcome = 'thursday';
  });

  // Assert
  for (const id of ['douse', 'hooks', 'gunpowder', 'evacuate', 'guard']) {
    assertRefused(over, { type: id, ...(id === 'guard' ? ST_PAULS : HOUSE) }, `${id} after the end`);
  }
  assertRefused(edit(over, (s) => {
    s.authority = false;
  }), { type: 'appeal' }, 'appeal after the end');
});
