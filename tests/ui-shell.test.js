import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  createFakeEngine,
  createFakeHistory,
  createFakeMapView,
  createFakeScreens,
  createFakeTutorial,
  createFakeWindow,
  createMemoryBacking,
  createMemoryStorage,
  createShellDom,
  createThrowingBacking,
  settle
} from './helpers/shell-fakes.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(`${ROOT}${path}`, 'utf8');

const BANNED_SPELLINGS = [
  'color', 'colors', 'center', 'centered', 'neighbor', 'neighbors', 'gray', 'honor', 'favorite', 'armor',
  'harbor', 'defense', 'organize', 'realize', 'recognize', 'theater'
];
const SHELL_IDS = [
  'app', 'map-wrap', 'map', 'panel', 'btn-sheet', 'date-time', 'wind-info', 'resources', 'tile-info', 'actions',
  'btn-end-turn', 'btn-chronicle', 'btn-menu', 'btn-help', 'btn-zoom', 'log', 'legend', 'modal-root',
  'tutorial-root', 'live'
];

function bannedIn(text) {
  return BANNED_SPELLINGS.filter((word) => new RegExp(`\\b${word}\\b`, 'i').test(text));
}

const format = await import('../src/ui/format.js');
const storageModule = await import('../src/ui/storage.js');
const { createController } = await import('../src/ui/controller.js');
const { createPanel } = await import('../src/ui/panel.js');
const appModule = await import('../src/ui/app.js');

function makeController(overrides = {}) {
  const engine = createFakeEngine();
  const history = createFakeHistory();
  const storage = createMemoryStorage();
  const controller = createController({ engine, history, storage, ...overrides });
  return { engine, history, storage, controller };
}

function makeApp({ startMenu = [{ choice: 'new', difficulty: 'easy', tutorial: false }], debrief, backing, search } = {}) {
  const doc = createShellDom();
  const win = createFakeWindow({ backing, search });
  const engine = createFakeEngine();
  const history = createFakeHistory();
  const mapView = createFakeMapView();
  const screens = createFakeScreens({ startMenu, debrief });
  const tutorial = createFakeTutorial();
  const app = appModule.createApp({
    doc, win, engine, history, mapView: mapView.module, screens: screens.module, tutorial: tutorial.module
  });
  return { doc, win, engine, history, mapView, screens, tutorial, app };
}

function savedState(win) {
  const text = win.localStorage.getItem(storageModule.SAVE_KEY);
  return text === null ? null : JSON.parse(text);
}

describe('modules import with no DOM', () => {
  test('app, controller, panel, format and storage load in Node', () => {
    // Arrange / Act: the imports above already ran.
    // Assert
    assert.equal(typeof globalThis.document, 'undefined');
    assert.equal(typeof appModule.createApp, 'function');
    assert.equal(typeof createController, 'function');
    assert.equal(typeof createPanel, 'function');
    assert.equal(typeof format.describeTile, 'function');
    assert.equal(typeof storageModule.createStorage, 'function');
  });

  test('main.js imports the units exactly as the contract says and only boots with a document', () => {
    // Arrange
    const main = read('src/main.js');
    // Act
    const imports = main.match(/^import .+;$/gm);
    // Assert
    assert.deepEqual(imports, [
      "import * as engine from './engine/index.js';",
      "import * as history from './data/history.js';",
      "import * as mapView from './ui/map-view.js';",
      "import * as screens from './ui/screens.js';",
      "import * as tutorial from './ui/tutorial.js';",
      "import { createApp } from './ui/app.js';"
    ]);
    assert.match(main, /typeof document !== 'undefined'/);
    assert.match(main, /createApp\(\{ doc: document, win: window, engine, history, mapView, screens, tutorial \}\)\.start\(\)/);
  });

  test('shell modules import nothing from other units', () => {
    // Arrange
    const files = ['app.js', 'controller.js', 'panel.js', 'format.js', 'storage.js'];
    for (const file of files) {
      // Act
      const specifiers = [...read(`src/ui/${file}`).matchAll(/from '([^']+)'/g)].map((m) => m[1]);
      // Assert
      for (const spec of specifiers) assert.match(spec, /^\.\/(controller|panel|format|storage)\.js$/, `${file} imports ${spec}`);
    }
  });
});

describe('format', () => {
  test('numbers get thousands commas', () => {
    assert.equal(format.formatNumber(13200), '13,200');
    assert.equal(format.formatNumber(1234567), '1,234,567');
    assert.equal(format.formatNumber(999), '999');
    assert.equal(format.formatNumber(0), '0');
  });

  test('cost text leaves out zero parts and gets singular and plural right', () => {
    assert.equal(format.costText({ ap: 2, men: 4, powder: 0, goodwill: 1 }), '2 actions, 4 men, 1 goodwill');
    assert.equal(format.costText({ ap: 1, men: 2, powder: 0, goodwill: 0 }), '1 action, 2 men');
    assert.equal(format.costText({ ap: 2, men: 2, powder: 1, goodwill: 2 }), '2 actions, 2 men, 1 gunpowder barrel, 2 goodwill');
    assert.equal(format.costText({ ap: 1, men: 1, powder: 3, goodwill: 0 }), '1 action, 1 man, 3 gunpowder barrels');
    assert.equal(format.costText({ ap: 0, men: 0, powder: 0, goodwill: 0 }), 'Free');
  });

  test('fire words cover every state of a tile', () => {
    const tile = (extra) => ({ type: 'house', fire: 0, burnt: false, cleared: false, ...extra });
    assert.equal(format.fireWord(tile({})), 'Not burning');
    assert.equal(format.fireWord(tile({ fire: 1 })), 'Catching fire');
    assert.equal(format.fireWord(tile({ fire: 2 })), 'Burning');
    assert.equal(format.fireWord(tile({ fire: 3 })), 'Blazing');
    assert.equal(format.fireWord(tile({ burnt: true })), 'Burnt out');
    assert.equal(format.fireWord(tile({ cleared: true })), 'Firebreak');
  });

  test('tile type names', () => {
    assert.equal(format.tileTypeName('house'), 'Timber houses');
    assert.equal(format.tileTypeName('warehouse'), 'Warehouses of oil, tallow and pitch');
    assert.equal(format.tileTypeName('stone'), 'Stone church or hall');
    assert.equal(format.tileTypeName('open'), 'Open ground');
    assert.equal(format.tileTypeName('river'), 'River');
    assert.equal(format.tileTypeName('wall'), 'City wall');
  });

  test('wind text adds an arrow pointing where the fire is pushed', () => {
    assert.equal(format.windText({ from: 'E', strength: 3, dx: -1, dy: 0, label: 'Strong easterly gale' }), 'Strong easterly gale ←');
    assert.equal(format.windText({ from: 'NE', strength: 2, dx: -1, dy: 1, label: 'Strong north-easterly' }), 'Strong north-easterly ↙');
    assert.equal(format.windText({ from: 'E', strength: 0, dx: -1, dy: 0, label: 'Calm' }), 'Calm');
    assert.equal(format.windSentence({ from: 'E', strength: 3, dx: -1, dy: 0, label: 'Gale' }), 'Gale. It pushes the fire west.');
  });

  test('describeTile names the place, its fire and its people', () => {
    // Arrange
    const tile = { type: 'house', fire: 2, burnt: false, cleared: false, wet: true, guard: 3, district: 'cheap', landmark: 'cheapside', houses: 1200, people: 3400 };
    // Act
    const info = format.describeTile(tile, { x: 4, y: 2, landmarkName: 'Cheapside', districtName: 'Cheap' });
    // Assert
    assert.equal(info.heading, 'Cheapside');
    assert.equal(info.status, 'Burning');
    assert.deepEqual(info.rows.map((row) => row.label), ['Kind', 'Fire', 'District', 'Houses', 'People', 'Water', 'Men on guard', 'Square']);
    assert.equal(info.rows.find((row) => row.label === 'Houses').value, '1,200');
    assert.equal(info.summary, 'Cheapside, column 5, row 3. Burning. 3,400 people here.');
  });

  test('describeTile says when a tile can never burn or everyone has left', () => {
    const river = format.describeTile({ type: 'river', fire: 0, burnt: false, cleared: false, wet: false, guard: 0, district: null, landmark: null, houses: 0, people: 0 }, { x: 0, y: 0 });
    assert.equal(river.status, 'Never burns');
    assert.equal(river.rows.some((row) => row.label === 'People'), false);
    const empty = format.describeTile({ type: 'house', fire: 0, burnt: false, cleared: false, wet: false, guard: 0, district: 'cheap', landmark: null, houses: 10, people: 0 }, { x: 1, y: 1, evacuated: true });
    assert.equal(empty.rows.find((row) => row.label === 'People').value, 'Everyone has gone to Moorfields');
  });

  test('outputs contain no banned spellings', () => {
    // Arrange
    const tiles = [0, 1, 2, 3].map((fire) => ({ type: 'warehouse', fire, burnt: false, cleared: false, wet: true, guard: 2, district: 'd', landmark: 'l', houses: 5, people: 9 }));
    const texts = [
      ...tiles.map((tile) => JSON.stringify(format.describeTile(tile, { x: 1, y: 2, landmarkName: 'L', districtName: 'D' }))),
      ...['house', 'warehouse', 'stone', 'open', 'river', 'wall'].map(format.tileTypeName),
      format.costText({ ap: 2, men: 4, powder: 1, goodwill: 1 }),
      format.windSentence({ strength: 3, dx: -1, dy: 1, label: 'Gale' }),
      format.turnSummary('Sunday 2 September, 7am', 3),
      ...['douse', 'hooks', 'gunpowder', 'evacuate', 'guard', 'appeal'].map((id) => format.actionDoneText(id, id, 'Cheap'))
    ];
    // Act
    const found = texts.flatMap(bannedIn);
    // Assert
    assert.deepEqual(found, []);
  });

  test('player-facing strings in shell files and index.html contain no banned spellings', () => {
    // Arrange
    const jsStrings = ['app.js', 'controller.js', 'panel.js', 'format.js', 'storage.js']
      .flatMap((file) => read(`src/ui/${file}`).match(/'[^'\n]*'|`[^`\n]*`/g) || []);
    const htmlText = read('index.html').replace(/<[^>]+>/g, ' ');
    const htmlAttrs = [...read('index.html').matchAll(/(?:aria-label|content|title)="([^"]*)"/g)].map((m) => m[1]);
    // Act
    const found = [...jsStrings, htmlText, ...htmlAttrs].flatMap(bannedIn);
    // Assert
    assert.deepEqual(found, []);
  });
});

describe('storage', () => {
  test('saves, loads and clears a game and prefs', () => {
    // Arrange
    const backing = createMemoryBacking();
    const store = storageModule.createStorage(backing);
    // Act
    const saved = store.saveGame('{"a":1}');
    const prefsSaved = store.savePrefs({ tutorialSeen: true });
    // Assert
    assert.equal(saved, true);
    assert.equal(prefsSaved, true);
    assert.equal(store.loadSave(), '{"a":1}');
    assert.equal(backing.data.get('fire-of-london.save.v1'), '{"a":1}');
    assert.equal(backing.data.get('fire-of-london.prefs.v1'), '{"tutorialSeen":true}');
    assert.deepEqual(store.loadPrefs(), { tutorialSeen: true });
    assert.equal(store.clearSave(), true);
    assert.equal(store.loadSave(), null);
  });

  test('works when the backing is missing', () => {
    const store = storageModule.createStorage(undefined);
    assert.equal(store.loadSave(), null);
    assert.equal(store.saveGame('x'), false);
    assert.equal(store.clearSave(), false);
    assert.equal(store.loadPrefs(), null);
    assert.equal(store.savePrefs({ tutorialSeen: true }), false);
  });

  test('never throws when the backing throws', () => {
    const store = storageModule.createStorage(createThrowingBacking());
    assert.doesNotThrow(() => {
      assert.equal(store.loadSave(), null);
      assert.equal(store.saveGame('x'), false);
      assert.equal(store.clearSave(), false);
      assert.equal(store.loadPrefs(), null);
      assert.equal(store.savePrefs({ tutorialSeen: true }), false);
    });
  });

  test('bad prefs JSON is ignored', () => {
    const store = storageModule.createStorage(createMemoryBacking({ 'fire-of-london.prefs.v1': '{not json' }));
    assert.equal(store.loadPrefs(), null);
    const arrayPrefs = storageModule.createStorage(createMemoryBacking({ 'fire-of-london.prefs.v1': '[1,2]' }));
    assert.equal(arrayPrefs.loadPrefs(), null);
  });

  test('browserStorage survives a window whose localStorage getter throws', () => {
    const win = {};
    Object.defineProperty(win, 'localStorage', { get() { throw new Error('SecurityError'); } });
    assert.equal(storageModule.browserStorage(win), undefined);
    assert.equal(storageModule.browserStorage(undefined), undefined);
  });
});

describe('controller', () => {
  test('newGame saves and returns the start cards', () => {
    // Arrange
    const { controller, storage, history } = makeController();
    // Act
    const cards = controller.newGame({ difficulty: 'hard', seed: 42 });
    // Assert
    assert.deepEqual(cards.map((card) => card.id), history.cardsForTrigger('start').map((card) => card.id));
    const saved = JSON.parse(storage.save);
    assert.equal(saved.seed, 42);
    assert.equal(saved.difficulty, 'hard');
    assert.equal(controller.hasGame(), true);
    assert.equal(controller.log().length, 1);
  });

  test('select then act updates the state and returns the cards of trigger events', () => {
    // Arrange
    const { controller, storage } = makeController();
    controller.newGame({ seed: 1 });
    const before = controller.getState();
    // Act
    const info = controller.select(3, 1);
    const result = controller.act('douse');
    // Assert
    assert.equal(info.heading, 'Pudding Lane');
    assert.equal(result.ok, true);
    assert.deepEqual(result.cards.map((card) => card.id), ['shell-douse']);
    assert.ok(result.events.some((event) => event.type === 'trigger' && event.id === 'first-douse'));
    assert.notEqual(controller.getState(), before);
    assert.equal(controller.getState().tiles[1 * 5 + 3].fire, 1);
    assert.equal(controller.getState().resources.ap, 2);
    assert.equal(JSON.parse(storage.save).resources.ap, 2);
    assert.match(result.live, /Buckets and squirts soak Pudding Lane\./);
  });

  test('a refused action returns the reason and changes nothing', () => {
    // Arrange
    const { controller, storage } = makeController();
    controller.newGame({ seed: 1 });
    const before = controller.getState();
    const savedBefore = storage.save;
    controller.select(0, 3);
    // Act
    const result = controller.act('douse');
    const noTile = makeController();
    noTile.controller.newGame({ seed: 1 });
    const noTileResult = noTile.controller.act('hooks');
    // Assert
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'There is nothing here to soak.');
    assert.deepEqual(result.events, []);
    assert.deepEqual(result.cards, []);
    assert.equal(controller.getState(), before);
    assert.equal(storage.save, savedBefore);
    assert.equal(noTileResult.reason, 'Choose a tile on the map first.');
  });

  test('endTurn returns events and cards, and a trigger with no cards does not crash', () => {
    // Arrange
    const { controller } = makeController();
    controller.newGame({ seed: 1 });
    const prev = controller.getState();
    // Act
    const result = controller.endTurn();
    // Assert
    assert.equal(result.prev, prev);
    assert.equal(result.next, controller.getState());
    assert.equal(result.next.turn, 1);
    assert.ok(result.events.some((event) => event.type === 'ignite'));
    assert.ok(result.events.some((event) => event.type === 'trigger' && event.id === 'sunday-morning'));
    assert.deepEqual(result.cards.map((card) => card.id), ['shell-spread']);
    assert.equal(result.newFires, 1);
    assert.equal(result.live, 'Sunday 2 September, 7am. 1 new place caught fire.');
  });

  test('engine message and landmark-lost events reach the log', () => {
    // Arrange
    const { controller } = makeController();
    controller.newGame({ seed: 1 });
    // Act
    for (let i = 0; i < 4; i += 1) controller.endTurn();
    // Assert
    const log = controller.log().join(' ');
    assert.match(log, /The Lord Mayor is not worried yet\./);
    assert.match(log, /St Paul's Cathedral has been lost to the fire\./);
  });

  test('end cards go to the debrief model and not the card list, and game over clears the save', () => {
    // Arrange
    const { controller, storage, history } = makeController();
    controller.newGame({ seed: 7 });
    let result;
    // Act
    for (let i = 0; i < 4; i += 1) result = controller.endTurn();
    const debrief = controller.debrief();
    // Assert
    assert.equal(result.over, true);
    assert.ok(result.events.some((event) => event.type === 'trigger' && event.id === 'end'));
    assert.equal(result.cards.some((card) => card.trigger === 'end'), false);
    assert.deepEqual(debrief.endCards.map((card) => card.id), ['shell-end']);
    assert.equal(debrief.outcome, 'thursday');
    assert.equal(debrief.timeLabel, 'Monday 3 September, 1am');
    assert.equal(debrief.whatHappened, history.WHAT_HAPPENED);
    assert.equal(debrief.landmarkNames['st-pauls'], "St Paul's Cathedral");
    assert.equal(typeof debrief.score.housesLost, 'number');
    assert.equal(debrief.canQuiz, true);
    assert.equal(storage.save, null);
    assert.equal(controller.hasGame(), false);
    assert.equal(controller.hasSave(), false);
  });

  test('continueGame restores a save', () => {
    // Arrange
    const first = makeController();
    first.controller.newGame({ seed: 9 });
    first.controller.endTurn();
    const second = makeController();
    second.storage.save = first.storage.save;
    // Act
    const has = second.controller.hasSave();
    const ok = second.controller.continueGame();
    // Assert
    assert.equal(has, true);
    assert.equal(ok, true);
    assert.deepEqual(second.controller.getState(), first.controller.getState());
  });

  test('continueGame ignores and clears a corrupt or wrong-version save', () => {
    for (const bad of ['{not json', '{"version":99,"tiles":[]}', '"just a string"']) {
      // Arrange
      const { controller, storage } = makeController();
      storage.save = bad;
      // Act
      const has = controller.hasSave();
      storage.save = bad;
      const ok = controller.continueGame();
      // Assert
      assert.equal(has, false, bad);
      assert.equal(ok, false, bad);
      assert.equal(storage.save, null, bad);
      assert.equal(controller.getState(), null, bad);
    }
  });

  test('quizQuestions calls buildQuiz with the seen card ids and the seed', () => {
    // Arrange
    const { controller, history } = makeController();
    controller.newGame({ seed: 31 });
    controller.endTurn();
    controller.select(3, 1);
    controller.act('douse');
    // Act
    const questions = controller.quizQuestions();
    // Assert
    const call = history.calls.buildQuiz.at(-1);
    assert.deepEqual(call.cardIds, ['shell-start-bakery', 'shell-start-london', 'shell-spread', 'shell-douse']);
    assert.equal(call.seed, 31);
    assert.equal(questions.length, 3);
  });

  test('action buttons carry id, label, key, cost text and the reason when not allowed', () => {
    // Arrange
    const { controller } = makeController();
    controller.newGame({ seed: 1 });
    // Act
    const buttons = controller.actionButtons();
    // Assert
    assert.deepEqual(buttons.map((b) => b.id), ['douse', 'hooks', 'gunpowder', 'evacuate', 'guard', 'appeal']);
    const hooks = buttons.find((b) => b.id === 'hooks');
    assert.equal(hooks.key, '2');
    assert.equal(hooks.costText, '2 actions, 4 men, 1 goodwill');
    assert.equal(hooks.enabled, false);
    assert.equal(hooks.reason, 'Choose a tile on the map first.');
    assert.equal(buttons.find((b) => b.id === 'gunpowder').reason, "You need the King's permission to use gunpowder.");
    assert.equal(buttons.find((b) => b.id === 'appeal').enabled, true);
  });

  test('appeal needs no tile and its authority card is returned', () => {
    // Arrange
    const { controller } = makeController();
    controller.newGame({ seed: 1 });
    // Act
    const result = controller.act('appeal');
    // Assert
    assert.equal(result.ok, true);
    assert.deepEqual(result.cards.map((card) => card.id), ['shell-authority']);
    assert.equal(controller.getState().authority, true);
    assert.match(controller.log().join(' '), /The King agrees/);
  });

  test('header gives time, wind text and labelled resources', () => {
    // Arrange
    const { controller } = makeController();
    controller.newGame({ seed: 1 });
    // Act
    const header = controller.header();
    // Assert
    assert.equal(header.timeLabel, 'Sunday 2 September, 1am');
    assert.equal(header.windText, 'Strong easterly gale ←');
    assert.equal(header.turnsLeftText, '4 turns left until Thursday');
    assert.deepEqual(header.resources.map((r) => r.label), ['Actions left', 'Men', 'Gunpowder barrels', 'Goodwill', "King's permission"]);
    assert.equal(header.resources[0].text, '3 of 3');
  });

  test('uses state.cols and state.rows, not a fixed 28 by 18 map', () => {
    // Arrange
    const { controller } = makeController();
    controller.newGame({ seed: 1 });
    controller.select(4, 3);
    // Act
    const outside = controller.select(20, 10);
    // Assert
    assert.deepEqual(controller.getSelected(), { x: 4, y: 3 });
    assert.equal(outside.heading, 'River');
  });

  test('chronicle lists the cards of fired triggers with the total and sources', () => {
    // Arrange
    const { controller, history } = makeController();
    controller.newGame({ seed: 1 });
    // Act
    const model = controller.chronicle();
    // Assert
    assert.deepEqual(model.cards.map((card) => card.id), ['shell-start-bakery', 'shell-start-london']);
    assert.equal(model.total, history.CARDS.length);
    assert.equal(model.sources, history.SOURCES);
  });
});

describe('panel', () => {
  function makePanel() {
    const doc = createShellDom();
    const mapView = createFakeMapView();
    const pressed = [];
    const panel = createPanel({ doc, mapView: mapView.module, dpr: 2, onAction: (id) => pressed.push(id) });
    const { controller } = makeController();
    controller.newGame({ seed: 1 });
    return { doc, mapView, panel, controller, pressed };
  }

  test('renders one button per action with data-action, label, key and cost', () => {
    // Arrange
    const { doc, panel, controller, pressed } = makePanel();
    // Act
    panel.renderActions(controller.actionButtons());
    // Assert
    const buttons = doc.getElementById('actions').descendants().filter((n) => n.tagName === 'BUTTON');
    assert.deepEqual(buttons.map((b) => b.getAttribute('data-action')), ['douse', 'hooks', 'gunpowder', 'evacuate', 'guard', 'appeal']);
    assert.match(buttons[1].textContent, /2Firehooks2 actions, 4 men, 1 goodwill/);
    buttons[5].click();
    assert.deepEqual(pressed, ['appeal']);
  });

  test('a disallowed action stays focusable with aria-disabled, a visible reason and aria-describedby', () => {
    // Arrange
    const { doc, panel, controller } = makePanel();
    // Act
    panel.renderActions(controller.actionButtons());
    // Assert
    const hooks = doc.getElementById('actions').descendants().find((n) => n.getAttribute('data-action') === 'hooks');
    assert.equal(hooks.getAttribute('aria-disabled'), 'true');
    assert.equal(hooks.hasAttribute('disabled'), false);
    const note = doc.getElementById(hooks.getAttribute('aria-describedby'));
    assert.equal(note.textContent, 'Choose a tile on the map first.');
    const appeal = doc.getElementById('actions').descendants().find((n) => n.getAttribute('data-action') === 'appeal');
    assert.equal(appeal.getAttribute('aria-disabled'), null);
  });

  test('re-rendering keeps the same buttons so focus is not lost', () => {
    // Arrange
    const { doc, panel, controller } = makePanel();
    panel.renderActions(controller.actionButtons());
    const first = doc.getElementById('actions').descendants().find((n) => n.getAttribute('data-action') === 'douse');
    // Act
    controller.select(3, 1);
    panel.renderActions(controller.actionButtons());
    // Assert
    const again = doc.getElementById('actions').descendants().find((n) => n.getAttribute('data-action') === 'douse');
    assert.equal(again, first);
    assert.equal(again.getAttribute('aria-disabled'), null);
  });

  test('header, resources, tile info and log are filled in', () => {
    // Arrange
    const { doc, panel, controller } = makePanel();
    controller.select(3, 1);
    // Act
    panel.renderHeader(controller.header());
    panel.renderTile(controller.tileInfo());
    panel.renderLog(['one', 'two', 'three']);
    // Assert
    assert.match(doc.getElementById('date-time').textContent, /^Sunday 2 September, 1am/);
    assert.match(doc.getElementById('wind-info').textContent, /←Strong easterly gale/);
    assert.match(doc.getElementById('wind-info').textContent, /It pushes the fire west\./);
    const resources = doc.getElementById('resources').textContent;
    for (const label of ['Actions left', 'Men', 'Gunpowder barrels', 'Goodwill']) assert.ok(resources.includes(label), label);
    assert.match(doc.getElementById('tile-info').textContent, /Pudding Lane/);
    assert.deepEqual(doc.getElementById('log').children.map((li) => li.textContent), ['three', 'two', 'one']);
  });

  test('legend uses LEGEND labels and drawLegendSwatch on small canvases', () => {
    // Arrange
    const { doc, panel, mapView } = makePanel();
    // Act
    panel.renderLegend();
    panel.renderLegend();
    // Assert
    const legend = doc.getElementById('legend');
    assert.equal(legend.children.length, 1);
    assert.match(legend.textContent, /Timber houses.*Catching fire.*Burnt out/);
    assert.deepEqual(mapView.swatches.slice(0, 3), [{ id: 'house', size: 20 }, { id: 'fire-1', size: 20 }, { id: 'burnt', size: 20 }]);
    const canvas = legend.descendants().find((n) => n.tagName === 'CANVAS');
    assert.equal(canvas.width, 40);
    assert.equal(canvas.getAttribute('aria-hidden'), 'true');
  });

  test('announce repeats the same message in a way screen readers notice', () => {
    // Arrange
    const { doc, panel } = makePanel();
    // Act
    panel.announce('Hello');
    const first = doc.getElementById('live').textContent;
    panel.announce('Hello');
    // Assert
    assert.equal(first, 'Hello');
    assert.notEqual(doc.getElementById('live').textContent, first);
  });
});

describe('app', () => {
  test('parseSeed reads ?seed=123 and rejects junk', () => {
    assert.equal(appModule.parseSeed('?seed=123'), 123);
    assert.equal(appModule.parseSeed('?a=1&seed=7'), 7);
    assert.equal(appModule.parseSeed('?seed=abc'), null);
    assert.equal(appModule.parseSeed('?seed=-4'), null);
    assert.equal(appModule.parseSeed('?seed=99999999999'), null);
    assert.equal(appModule.parseSeed(''), null);
  });

  test('isFormField spots inputs, selects, textareas and editable areas', () => {
    assert.equal(appModule.isFormField({ tagName: 'INPUT' }), true);
    assert.equal(appModule.isFormField({ tagName: 'select' }), true);
    assert.equal(appModule.isFormField({ tagName: 'DIV', isContentEditable: true }), true);
    assert.equal(appModule.isFormField({ tagName: 'BUTTON' }), false);
    assert.equal(appModule.isFormField(null), false);
  });

  test('start builds the view, screens and tutorial, draws a preview and shows the start menu', async () => {
    // Arrange
    const { doc, app, mapView, screens, engine } = makeApp({ startMenu: [] });
    // Act
    app.start();
    await settle();
    // Assert
    assert.equal(mapView.options.canvas, doc.getElementById('map'));
    assert.equal(mapView.options.cols, engine.COLS);
    assert.equal(mapView.options.rows, engine.ROWS);
    assert.equal(mapView.options.landmarks, engine.LANDMARKS);
    assert.equal(mapView.options.reducedMotion, false);
    assert.equal(screens.root, doc.getElementById('modal-root'));
    assert.equal(mapView.calls[0][0], 'render');
    assert.deepEqual(screens.named('showStartMenu'), [{ difficulties: engine.DIFFICULTIES, canContinue: false, firstTime: true }]);
    assert.equal(doc.getElementById('legend').children.length, 1);
  });

  test('a new game from the menu fills the panel, saves, and shows the start cards', async () => {
    // Arrange
    const { doc, win, app, screens, history } = makeApp({ search: '?seed=55' });
    // Act
    app.start();
    await settle();
    // Assert
    const saved = savedState(win);
    assert.equal(saved.seed, 55);
    assert.equal(saved.difficulty, 'easy');
    assert.deepEqual(screens.named('showCards'), [history.cardsForTrigger('start')]);
    assert.equal(doc.getElementById('actions').descendants().filter((n) => n.tagName === 'BUTTON').length, 6);
    assert.match(doc.getElementById('date-time').textContent, /Sunday 2 September, 1am/);
    assert.equal(doc.activeElement, doc.getElementById('map'));
    assert.deepEqual(JSON.parse(win.localStorage.getItem('fire-of-london.prefs.v1')), { tutorialSeen: true });
  });

  test('selecting a tile updates the panel, the live region and the tutorial; key 1 douses it', async () => {
    // Arrange
    const { doc, win, app, mapView, tutorial, screens } = makeApp();
    app.start();
    await settle();
    // Act
    mapView.options.onSelect(3, 1);
    const event = doc.keydown('1', doc.getElementById('map'));
    await settle();
    // Assert
    assert.match(doc.getElementById('tile-info').textContent, /Pudding Lane/);
    assert.equal(tutorial.notes[0][0], 'tile-selected');
    assert.deepEqual({ x: tutorial.notes[0][1].x, y: tutorial.notes[0][1].y }, { x: 3, y: 1 });
    assert.equal(event.defaultPrevented, true);
    assert.deepEqual(tutorial.notes[1], ['action-done', { type: 'douse' }]);
    assert.equal(savedState(win).tiles[1 * 5 + 3].fire, 1);
    assert.deepEqual(screens.named('showCards').at(-1).map((card) => card.id), ['shell-douse']);
    assert.match(doc.getElementById('live').textContent, /Buckets and squirts/);
  });

  test('action keys are ignored while a dialog is open or focus is in a form field', async () => {
    // Arrange
    const { doc, win, app, mapView, screens } = makeApp();
    app.start();
    await settle();
    mapView.options.onSelect(3, 1);
    const before = win.localStorage.getItem(storageModule.SAVE_KEY);
    // Act
    screens.open = true;
    doc.keydown('1');
    screens.open = false;
    doc.keydown('1', { tagName: 'INPUT' });
    doc.keydown('1', doc.body, { ctrlKey: true });
    await settle();
    // Assert
    assert.equal(win.localStorage.getItem(storageModule.SAVE_KEY), before);
  });

  test('pressing a disallowed action announces the reason and changes nothing', async () => {
    // Arrange
    const { doc, win, app } = makeApp();
    app.start();
    await settle();
    const before = win.localStorage.getItem(storageModule.SAVE_KEY);
    // Act
    doc.getElementById('actions').descendants().find((n) => n.getAttribute('data-action') === 'hooks').click();
    await settle();
    // Assert
    assert.equal(doc.getElementById('live').textContent, 'Choose a tile on the map first.');
    assert.equal(win.localStorage.getItem(storageModule.SAVE_KEY), before);
  });

  test('End Turn animates, re-renders, announces and shows the new cards', async () => {
    // Arrange
    const { doc, app, mapView, screens, tutorial } = makeApp();
    app.start();
    await settle();
    // Act
    doc.getElementById('btn-end-turn').click();
    await settle();
    // Assert
    const animate = mapView.calls.find(([name]) => name === 'animate');
    assert.equal(animate[1].turn, 0);
    assert.equal(animate[2].turn, 1);
    assert.ok(animate[3].some((event) => event.type === 'ignite'));
    assert.match(doc.getElementById('date-time').textContent, /Sunday 2 September, 7am/);
    assert.equal(doc.getElementById('live').textContent, 'Sunday 2 September, 7am. 1 new place caught fire.');
    assert.deepEqual(screens.named('showCards').at(-1).map((card) => card.id), ['shell-spread']);
    assert.deepEqual(tutorial.notes.at(-1), ['turn-ended', {}]);
    assert.equal(doc.getElementById('btn-end-turn').getAttribute('aria-disabled'), null);
  });

  test('cards wait while the tutorial runs and appear when it finishes', async () => {
    // Arrange
    const { app, screens, tutorial, win } = makeApp({ startMenu: [{ choice: 'new', difficulty: 'normal', tutorial: true }] });
    // Act
    app.start();
    await settle();
    const shownDuring = screens.named('showCards').length;
    tutorial.finish(false);
    await settle();
    // Assert
    assert.equal(tutorial.starts, 1);
    assert.equal(shownDuring, 0);
    assert.equal(screens.named('showCards').length, 1);
    assert.deepEqual(JSON.parse(win.localStorage.getItem('fire-of-london.prefs.v1')), { tutorialSeen: true });
  });

  test('game over shows the debrief, then the quiz if chosen, then the start menu, and clears the save', async () => {
    // Arrange
    const { doc, win, app, screens } = makeApp({
      startMenu: [{ choice: 'new', difficulty: 'normal', tutorial: false }],
      debrief: 'quiz'
    });
    app.start();
    await settle();
    // Act
    for (let i = 0; i < 4; i += 1) {
      doc.getElementById('btn-end-turn').click();
      await settle();
    }
    // Assert
    const names = screens.calls.map(([name]) => name);
    const debriefAt = names.indexOf('showDebrief');
    assert.ok(debriefAt > 0);
    assert.equal(names[debriefAt + 1], 'showQuiz');
    assert.equal(names[debriefAt + 2], 'showStartMenu');
    const debrief = screens.named('showDebrief')[0];
    assert.deepEqual(debrief.endCards.map((card) => card.id), ['shell-end']);
    assert.equal(screens.named('showCards').flat().some((card) => card.trigger === 'end'), false);
    assert.equal(screens.named('showQuiz')[0].length, 3);
    assert.equal(screens.named('showStartMenu').at(-1).canContinue, false);
    assert.equal(win.localStorage.getItem(storageModule.SAVE_KEY), null);
  });

  test('continue from the start menu restores the saved game', async () => {
    // Arrange
    const engine = createFakeEngine();
    const state = engine.endTurn(engine.newGame({ seed: 3 })).state;
    const backing = createMemoryBacking({ [storageModule.SAVE_KEY]: engine.serialize(state), [storageModule.PREFS_KEY]: '{"tutorialSeen":true}' });
    const { doc, app, screens } = makeApp({ backing, startMenu: [{ choice: 'continue' }] });
    // Act
    app.start();
    await settle();
    // Assert
    assert.deepEqual(screens.named('showStartMenu')[0], { difficulties: engine.DIFFICULTIES, canContinue: true, firstTime: false });
    assert.match(doc.getElementById('date-time').textContent, /Sunday 2 September, 7am/);
    assert.deepEqual(screens.named('showCards'), []);
  });

  test('a corrupt save is not offered and the game still starts', async () => {
    // Arrange
    const backing = createMemoryBacking({ [storageModule.SAVE_KEY]: '{oops' });
    const { app, screens } = makeApp({ backing });
    // Act
    app.start();
    await settle();
    // Assert
    assert.equal(screens.named('showStartMenu')[0].canContinue, false);
    assert.equal(JSON.parse(backing.data.get(storageModule.SAVE_KEY)).turn, 0);
  });

  test('the game runs with storage that throws', async () => {
    // Arrange
    const { doc, app, win } = makeApp({ backing: createThrowingBacking() });
    // Act
    app.start();
    await settle();
    doc.getElementById('btn-end-turn').click();
    await settle();
    // Assert
    assert.deepEqual(win.errors, []);
    assert.match(doc.getElementById('date-time').textContent, /7am/);
  });

  test('Zoom, bottom sheet, Chronicle, Help and Menu buttons work', async () => {
    // Arrange
    const { doc, app, mapView, screens, tutorial, win } = makeApp({
      startMenu: [{ choice: 'new', difficulty: 'easy', tutorial: false }, { choice: 'continue' }]
    });
    app.start();
    await settle();
    // Act
    doc.getElementById('btn-zoom').click();
    doc.getElementById('btn-sheet').click();
    doc.getElementById('btn-chronicle').click();
    doc.getElementById('btn-help').click();
    doc.getElementById('btn-menu').click();
    win.fire('resize');
    await settle();
    // Assert
    assert.equal(mapView.view.getZoom(), 2);
    assert.equal(doc.getElementById('btn-zoom').getAttribute('aria-pressed'), 'true');
    assert.equal(doc.getElementById('btn-sheet').getAttribute('aria-expanded'), 'false');
    assert.equal(doc.getElementById('panel').classList.contains('is-collapsed'), true);
    assert.equal(screens.named('showChronicle')[0].cards.length, 2);
    assert.equal(tutorial.starts, 1);
    assert.equal(screens.named('showStartMenu')[1].canContinue, true);
    assert.ok(mapView.calls.filter(([name]) => name === 'resize').length >= 2);
    assert.equal(screens.named('showStartMenu').length, 2);
  });
});

describe('static files', () => {
  const html = read('index.html');
  const css = read('src/ui/styles.css');

  test('index.html has lang en-GB, the viewport meta, the data: icon, both stylesheets and the module script', () => {
    assert.match(html, /<html lang="en-GB">/);
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1[^"]*">/);
    assert.match(html, /<link rel="icon" href="data:,">/);
    assert.match(html, /<link rel="stylesheet" href="src\/ui\/styles\.css">/);
    assert.match(html, /<link rel="stylesheet" href="src\/ui\/screens\.css">/);
    assert.match(html, /<script type="module" src="src\/main\.js"><\/script>/);
    assert.match(html, /<title>Fire Of London<\/title>/);
  });

  test('index.html has every 6a id exactly once', () => {
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    for (const id of SHELL_IDS) assert.equal(ids.filter((found) => found === id).length, 1, id);
    assert.equal(new Set(ids).size, ids.length, 'ids are unique');
  });

  test('index.html has the canvas set-up, live region and empty roots', () => {
    assert.match(html, /<canvas id="map"[^>]*tabindex="0"[^>]*aria-label="[^"]+"/);
    assert.match(html, /<div id="actions" class="actions"><\/div>/);
    assert.match(html, /<div id="modal-root"><\/div>\s*<div id="tutorial-root"><\/div>\s*<div id="live"[^>]*aria-live="polite"[^>]*><\/div>\s*<\/body>/);
    assert.match(html, /id="live" class="visually-hidden"/);
    assert.match(html, /id="btn-end-turn" class="btn btn-primary/);
    assert.match(html, /<noscript>/);
  });

  test('index.html has no network URLs and no absolute paths', () => {
    assert.equal(/https?:/i.test(html), false);
    assert.equal(/(?:src|href)="\/\/?/.test(html), false);
  });

  test('styles.css defines every 6b variable and the shared classes', () => {
    const vars = {
      '--parchment': '#f3e7c9', '--parchment-dark': '#e4d3a8', '--ink': '#2b1d0e', '--ink-soft': '#5a4632',
      '--accent': '#8b2e16', '--fire-1': '#f0e442', '--fire-2': '#e69f00', '--fire-3': '#d55e00',
      '--firebreak': '#0072b2', '--water': '#56b4e9', '--guard': '#009e73', '--focus': '#0072b2',
      '--radius': '6px', '--shadow': '0 2px 8px rgba(43, 29, 14, 0.35)'
    };
    for (const [name, value] of Object.entries(vars)) assert.ok(css.includes(`${name}: ${value};`), name);
    assert.ok(css.includes("--serif: 'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, 'Times New Roman', serif;"));
    for (const cls of ['.btn {', '.btn-primary {', '.visually-hidden {']) assert.ok(css.includes(cls), cls);
  });

  test('styles.css has focus rings, reduced motion and phone rules, and leaves the dialog roots alone', () => {
    assert.match(css, /:focus-visible\s*\{\s*outline: 3px solid var\(--focus\);/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(css, /@media \(max-width: 700px\)/);
    assert.match(css, /min-height: 44px/);
    assert.equal(/modal-root|tutorial-root|tutorial-target/.test(css), false);
    assert.equal(/https?:|url\(/i.test(css), false);
  });
});
