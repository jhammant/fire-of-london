// Fakes for tests/ui-shell.test.js: a tiny engine and history with the contract shapes, fake UI modules,
// storage backings and a minimal DOM. Nothing here touches the real units.

const ACTIONS = [
  { id: 'douse', label: 'Buckets and squirts', key: '1', cost: { ap: 1, men: 2, powder: 0, goodwill: 0 }, target: 'tile', needsAuthority: false, description: 'Throw water on a square.' },
  { id: 'hooks', label: 'Firehooks', key: '2', cost: { ap: 2, men: 4, powder: 0, goodwill: 1 }, target: 'tile', needsAuthority: false, description: 'Pull houses down to make a gap.' },
  { id: 'gunpowder', label: 'Gunpowder', key: '3', cost: { ap: 2, men: 2, powder: 1, goodwill: 2 }, target: 'tile', needsAuthority: true, description: 'Blow up houses to make a wide gap.' },
  { id: 'evacuate', label: 'Evacuate district', key: '4', cost: { ap: 1, men: 2, powder: 0, goodwill: 0 }, target: 'tile', needsAuthority: false, description: 'Lead people to Moorfields.' },
  { id: 'guard', label: 'Post men', key: '5', cost: { ap: 1, men: 3, powder: 0, goodwill: 0 }, target: 'tile', needsAuthority: false, description: 'Guard a great building.' },
  { id: 'appeal', label: 'Send word to the King', key: '6', cost: { ap: 1, men: 0, powder: 0, goodwill: 0 }, target: 'none', needsAuthority: false, description: 'Ask the King for help.' }
];

const MAP = ['hhhhO', 'hwshO', 'hhhhW', 'RRRRR'];
const TYPE_OF = { h: 'house', w: 'warehouse', s: 'stone', O: 'open', W: 'wall', R: 'river' };
const FLAMMABLE = ['house', 'warehouse', 'stone'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const HOURS = [1, 7, 13, 19];

const clone = (value) => JSON.parse(JSON.stringify(value));

/** Builds a fake engine module with the section 3 API on a 5 by 4 map that ends after 4 turns. */
export function createFakeEngine() {
  const COLS = 5;
  const ROWS = 4;
  const LAST_TURN = 4;
  const LANDMARKS = [
    { id: 'pudding-lane', name: 'Pudding Lane', kind: 'bakery', tiles: [[3, 1]], scored: false, blurb: 'Where it began.' },
    { id: 'st-pauls', name: "St Paul's Cathedral", kind: 'cathedral', tiles: [[2, 1]], scored: true, blurb: 'A great church.' }
  ];
  const DISTRICTS = [
    { id: 'cheap', name: 'Cheap' },
    { id: 'bridge', name: 'Bridge' }
  ];
  const START = { x: 3, y: 1 };

  const landmarkAt = (x, y) => {
    const found = LANDMARKS.find((l) => l.tiles.some(([lx, ly]) => lx === x && ly === y));
    return found ? found.id : null;
  };
  const index = (state, x, y) => y * state.cols + x;
  const isBurning = (tile) => tile.fire > 0 && !tile.burnt;

  function tileAt(state, x, y) {
    if (x < 0 || y < 0 || x >= state.cols || y >= state.rows) return null;
    return state.tiles[index(state, x, y)];
  }

  function fire(state, events, id) {
    if (state.triggers.includes(id)) return;
    state.triggers.push(id);
    events.push({ type: 'trigger', id });
  }

  function newGame({ seed = 1, difficulty = 'normal' } = {}) {
    const tiles = [];
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const type = TYPE_OF[MAP[y][x]];
        const flammable = FLAMMABLE.includes(type);
        const houses = type === 'house' ? 100 : type === 'warehouse' ? 20 : type === 'stone' ? 5 : 0;
        tiles.push({
          type, fire: 0, burnt: false, cleared: false, wet: false, guard: 0,
          district: flammable ? (x < 2 ? 'cheap' : 'bridge') : null,
          landmark: landmarkAt(x, y), houses, people: houses * 3
        });
      }
    }
    tiles[START.y * COLS + START.x].fire = 2;
    return {
      version: 1, seed, rngState: seed, difficulty, turn: 0, cols: COLS, rows: ROWS, tiles,
      wind: { from: 'E', strength: 3, dx: -1, dy: 0, label: 'Strong easterly gale' },
      resources: { ap: 3, men: 10, powder: 0, goodwill: 10 },
      limits: { ap: 3, men: 10, goodwill: 10 },
      authority: false, appeals: 0, appealedThisTurn: false, evacuated: [],
      peopleSafe: 0, peopleTotal: tiles.reduce((sum, t) => sum + t.people, 0),
      housesTotal: tiles.reduce((sum, t) => sum + t.houses, 0),
      triggers: ['start'], over: false, outcome: null
    };
  }

  function canAct(state, action) {
    const def = ACTIONS.find((a) => a.id === action.type);
    if (state.over) return { ok: false, reason: 'The fire is over.' };
    if (!def) return { ok: false, reason: 'You cannot do that.' };
    if (def.needsAuthority && !state.authority) return { ok: false, reason: "You need the King's permission to use gunpowder." };
    if (state.resources.ap < def.cost.ap) return { ok: false, reason: 'You have no actions left this turn.' };
    if (state.resources.men < def.cost.men) return { ok: false, reason: 'You need more men.' };
    if (state.resources.powder < def.cost.powder) return { ok: false, reason: 'You have no gunpowder.' };
    if (def.id === 'appeal') {
      if (state.authority) return { ok: false, reason: 'The King has already agreed.' };
      if (state.appealedThisTurn) return { ok: false, reason: 'You have already sent word this turn.' };
      return { ok: true, reason: '' };
    }
    const tile = action.x === undefined ? null : tileAt(state, action.x, action.y);
    if (!tile) return { ok: false, reason: 'Choose a tile on the map first.' };
    const usable = FLAMMABLE.includes(tile.type) && !tile.burnt && !tile.cleared;
    if (def.id === 'douse' && !usable) return { ok: false, reason: 'There is nothing here to soak.' };
    if (def.id === 'hooks' && (!usable || tile.type === 'stone' || tile.fire > 0)) return { ok: false, reason: 'Firehooks need standing timber houses.' };
    if (def.id === 'gunpowder' && (!usable || tile.type === 'stone')) return { ok: false, reason: 'Gunpowder needs houses to blow up.' };
    if (def.id === 'evacuate' && (!tile.district || state.evacuated.includes(tile.district))) return { ok: false, reason: 'Nobody here needs to leave.' };
    if (def.id === 'guard' && (!tile.landmark || tile.guard > 0)) return { ok: false, reason: 'Choose a great building to guard.' };
    return { ok: true, reason: '' };
  }

  function applyAction(state, action) {
    const check = canAct(state, action);
    if (!check.ok) return { ok: false, reason: check.reason, state, events: [] };
    const def = ACTIONS.find((a) => a.id === action.type);
    const next = clone(state);
    const events = [];
    for (const part of ['ap', 'men', 'powder', 'goodwill']) next.resources[part] -= def.cost[part];
    const tile = action.x === undefined ? null : tileAt(next, action.x, action.y);
    if (def.id === 'douse') {
      tile.wet = true;
      if (tile.fire > 0) {
        tile.fire -= 1;
        if (tile.fire === 0) events.push({ type: 'extinguish', x: action.x, y: action.y });
      }
    } else if (def.id === 'hooks' || def.id === 'gunpowder') {
      next.peopleSafe += tile.people;
      Object.assign(tile, { cleared: true, fire: 0, people: 0 });
      events.push({ type: 'cleared', x: action.x, y: action.y });
    } else if (def.id === 'evacuate') {
      for (const t of next.tiles) {
        if (t.district === tile.district) {
          next.peopleSafe += t.people;
          t.people = 0;
        }
      }
      next.evacuated.push(tile.district);
    } else if (def.id === 'guard') {
      tile.guard = def.cost.men;
    } else if (def.id === 'appeal') {
      next.appeals += 1;
      next.appealedThisTurn = true;
    }
    if (def.id !== 'appeal') fire(next, events, `first-${def.id}`);
    if (def.id === 'appeal' && next.appeals >= 1) {
      next.authority = true;
      next.resources.powder += 2;
      fire(next, events, 'authority');
    }
    return { ok: true, reason: '', state: next, events };
  }

  function endTurn(state) {
    if (state.over) return { state, events: [] };
    const next = clone(state);
    const events = [];
    const burningBefore = [];
    next.tiles.forEach((tile, i) => {
      if (isBurning(tile)) burningBefore.push(i);
    });
    for (const i of burningBefore) {
      const x = i % next.cols;
      const y = Math.floor(i / next.cols);
      if (next.tiles[i].fire < 2) continue;
      const target = tileAt(next, x + next.wind.dx, y + next.wind.dy);
      if (target && FLAMMABLE.includes(target.type) && target.fire === 0 && !target.burnt && !target.cleared && !target.wet) {
        target.fire = 1;
        events.push({ type: 'ignite', x: x + next.wind.dx, y: y + next.wind.dy, from: { x, y }, ember: false });
        fire(next, events, 'first-spread');
        if (target.type === 'warehouse') fire(next, events, 'warehouses');
      }
    }
    for (const i of burningBefore) {
      const tile = next.tiles[i];
      if (tile.fire === 3) {
        Object.assign(tile, { fire: 0, burnt: true, people: 0 });
        events.push({ type: 'burnout', x: i % next.cols, y: Math.floor(i / next.cols) });
        if (tile.landmark === 'st-pauls') events.push({ type: 'landmark-lost', id: 'st-pauls' });
      } else {
        tile.fire += 1;
      }
    }
    for (const tile of next.tiles) tile.wet = false;
    next.turn += 1;
    next.appealedThisTurn = false;
    next.resources.ap = next.limits.ap;
    next.resources.men = next.limits.men;
    next.resources.goodwill = Math.min(next.limits.goodwill, next.resources.goodwill + 1);
    if (next.turn === 1) fire(next, events, 'sunday-morning');
    if (next.turn === 2) events.push({ type: 'message', text: 'The Lord Mayor is not worried yet.' });
    const burning = next.tiles.some(isBurning);
    if (!burning || next.turn >= LAST_TURN) {
      next.over = true;
      next.outcome = burning ? 'thursday' : 'extinguished';
      fire(next, events, 'end');
      events.push({ type: 'game-over', outcome: next.outcome });
    }
    return { state: next, events };
  }

  function getTimeInfo(turn) {
    const day = Math.floor(turn / 4);
    const hour = HOURS[turn % 4];
    const hourLabel = hour > 12 ? `${hour - 12}pm` : `${hour}am`;
    const date = 2 + day;
    return {
      turn, dayName: DAYS[day], date, month: 'September', year: 1666, hour, hourLabel,
      label: `${DAYS[day]} ${date} September, ${hourLabel}`
    };
  }

  function getScore(state) {
    const lostTiles = state.tiles.filter((t) => t.burnt || t.cleared || isBurning(t));
    const housesLost = lostTiles.reduce((sum, t) => sum + t.houses, 0);
    const stPaulsLost = state.tiles.some((t) => t.landmark === 'st-pauls' && (t.burnt || t.cleared || isBurning(t)));
    return {
      housesTotal: state.housesTotal, housesLost, housesSaved: state.housesTotal - housesLost,
      housesPulledDown: lostTiles.filter((t) => t.cleared).reduce((sum, t) => sum + t.houses, 0),
      peopleTotal: state.peopleTotal, peopleSafe: state.peopleSafe,
      landmarksSaved: stPaulsLost ? [] : ['st-pauls'], landmarksLost: stPaulsLost ? ['st-pauls'] : [],
      stPaulsSaved: !stPaulsLost, beatHistory: housesLost < 13200,
      history: { housesLost: 13200, churchesLost: 87, stPaulsLost: true, deathsRecorded: 6 },
      rating: { id: 'saviour', label: 'Saviour of London', text: 'You saved the City.' }
    };
  }

  function serialize(state) {
    return JSON.stringify(state);
  }

  function deserialize(text) {
    const state = JSON.parse(text);
    if (!state || state.version !== 1) throw new Error('This save is from a different version.');
    if (!Array.isArray(state.tiles)) throw new Error('This save is damaged.');
    return state;
  }

  return {
    COLS, ROWS, LAST_TURN, ACTIONS, LANDMARKS, DISTRICTS, START,
    TILE_TYPES: ['house', 'warehouse', 'stone', 'open', 'river', 'wall'],
    FLAMMABLE_TYPES: FLAMMABLE,
    DIFFICULTIES: [
      { id: 'easy', label: 'Easy', description: 'A gentle start.' },
      { id: 'normal', label: 'Normal', description: 'As it was.' },
      { id: 'hard', label: 'Hard', description: 'A real test.' }
    ],
    TRIGGERS: ['start', 'first-spread', 'warehouses', 'sunday-morning', 'first-douse', 'authority', 'end'],
    newGame, tileAt, canAct, applyAction, endTurn, getTimeInfo, getScore, serialize, deserialize,
    getLandmark: (id) => LANDMARKS.find((l) => l.id === id),
    getDistrict: (id) => DISTRICTS.find((d) => d.id === id)
  };
}

/** Builds a fake history module with the section 5 shape; calls.buildQuiz records every buildQuiz call. */
export function createFakeHistory() {
  const quiz = (question) => ({ question, options: ['Yes', 'No', 'Maybe'], answer: 0 });
  const CARDS = [
    { id: 'shell-start-bakery', title: 'A bakery fire', text: 'It began in a bakery.', trigger: 'start', when: 'Sunday 2 September 1666', quiz: quiz('Where did it start?') },
    { id: 'shell-start-london', title: 'London in 1666', text: 'The houses were made of wood.', trigger: 'start' },
    { id: 'shell-spread', title: 'The gale', text: 'A strong wind blew.', trigger: 'first-spread', quiz: quiz('Was it windy?') },
    { id: 'shell-douse', title: 'Buckets', text: 'Leather buckets.', trigger: 'first-douse', quiz: quiz('Were buckets leather?') },
    { id: 'shell-authority', title: 'The King', text: 'The King took charge.', trigger: 'authority' },
    { id: 'shell-end', title: 'The end', text: 'The fire ended.', trigger: 'end', quiz: quiz('Did it end?') }
  ];
  const calls = { buildQuiz: [] };
  const cardsForTrigger = (triggerId) => CARDS.filter((card) => card.trigger === triggerId);
  return {
    calls,
    CARDS,
    getCard: (id) => CARDS.find((card) => card.id === id),
    cardsForTrigger,
    cardsForTriggers: (ids) => ids.flatMap(cardsForTrigger).filter((card, i, all) => all.indexOf(card) === i),
    buildQuiz(cardIds, seed, count = 3) {
      calls.buildQuiz.push({ cardIds, seed, count });
      return cardIds
        .map((id) => CARDS.find((card) => card.id === id))
        .filter((card) => card && card.quiz)
        .slice(0, count)
        .map((card) => ({ cardId: card.id, ...card.quiz }));
    },
    WHAT_HAPPENED: ['The fire burned for four days.', 'Most of the City was lost.', 'London was rebuilt.'],
    SOURCES: [{ title: 'The Diary of Samuel Pepys', author: 'Samuel Pepys', year: 1666, note: 'An eyewitness.' }]
  };
}

/** Builds a fake map-view module; .view is the last created view and .calls records what the app asked for. */
export function createFakeMapView() {
  const calls = [];
  const fake = { calls, view: null, options: null, swatches: [] };
  fake.module = {
    LEGEND: [
      { id: 'house', label: 'Timber houses' },
      { id: 'fire-1', label: 'Catching fire' },
      { id: 'burnt', label: 'Burnt out' }
    ],
    COLOURS: { parchment: '#f3e7c9', ink: '#2b1d0e' },
    drawLegendSwatch(ctx, id, size) {
      fake.swatches.push({ id, size });
    },
    createMapView(options) {
      fake.options = options;
      let selected = null;
      let zoom = 1;
      fake.view = {
        render: (state, opts) => calls.push(['render', state, opts]),
        animate: (prev, next, events) => {
          calls.push(['animate', prev, next, events]);
          return Promise.resolve(next);
        },
        setSelected: (x, y) => {
          selected = x === null || x === undefined ? null : { x, y };
          calls.push(['setSelected', x, y]);
        },
        getSelected: () => selected,
        setZoom: (level) => {
          zoom = level;
          calls.push(['setZoom', level]);
        },
        getZoom: () => zoom,
        resize: () => calls.push(['resize']),
        destroy: () => calls.push(['destroy'])
      };
      return fake.view;
    }
  };
  return fake;
}

/** Builds fake screens; script lists the answers for showStartMenu (in order), showDebrief and showQuiz. */
export function createFakeScreens(script = {}) {
  const menuAnswers = [...(script.startMenu || [])];
  const fake = { calls: [], open: false, root: null };
  const record = (name, arg, answer) => {
    fake.calls.push([name, arg]);
    return Promise.resolve(answer);
  };
  fake.module = {
    createScreens({ root }) {
      fake.root = root;
      return {
        showStartMenu(options) {
          fake.calls.push(['showStartMenu', options]);
          return menuAnswers.length ? Promise.resolve(menuAnswers.shift()) : new Promise(() => {});
        },
        showCards: (cards) => record('showCards', cards),
        showChronicle: (model) => record('showChronicle', model),
        showDebrief: (model) => record('showDebrief', model, script.debrief || 'close'),
        showQuiz: (questions) => record('showQuiz', questions, { correct: 1, total: questions.length }),
        showMessage: (model) => record('showMessage', model),
        isOpen: () => fake.open,
        closeAll: () => fake.calls.push(['closeAll'])
      };
    }
  };
  fake.named = (name) => fake.calls.filter(([n]) => n === name).map(([, arg]) => arg);
  return fake;
}

/** Builds a fake tutorial module whose coach records notify calls; finish() ends it like the real Skip. */
export function createFakeTutorial() {
  const fake = { notes: [], active: false, onFinish: null, starts: 0 };
  fake.finish = (skipped = false) => {
    fake.active = false;
    fake.onFinish({ skipped });
  };
  fake.module = {
    TUTORIAL_STEPS: [],
    createTutorial({ onFinish }) {
      fake.onFinish = onFinish;
      return {
        start() {
          fake.starts += 1;
          fake.active = true;
        },
        notify: (eventName, payload) => fake.notes.push([eventName, payload]),
        skip: () => fake.finish(true),
        isActive: () => fake.active
      };
    }
  };
  return fake;
}

/** Returns an in-memory localStorage stand-in. */
export function createMemoryBacking(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key)
  };
}

/** Returns a localStorage stand-in whose every call throws, like a blocked browser store. */
export function createThrowingBacking() {
  const fail = () => {
    throw new Error('Storage is blocked.');
  };
  return { getItem: fail, setItem: fail, removeItem: fail };
}

/** Returns a storage object (the createStorage shape) over an in-memory map. */
export function createMemoryStorage() {
  const fake = { save: null, prefs: null, clears: 0 };
  fake.loadSave = () => fake.save;
  fake.saveGame = (text) => {
    fake.save = text;
    return true;
  };
  fake.clearSave = () => {
    fake.save = null;
    fake.clears += 1;
    return true;
  };
  fake.loadPrefs = () => fake.prefs;
  fake.savePrefs = (prefs) => {
    fake.prefs = { tutorialSeen: Boolean(prefs.tutorialSeen) };
    return true;
  };
  return fake;
}

// ---------- A minimal DOM: just what the shell uses ----------

function fakeContext() {
  const target = { calls: [] };
  return new Proxy(target, {
    get(obj, prop) {
      if (prop in obj) return obj[prop];
      return (...args) => obj.calls.push([prop, ...args]);
    },
    set(obj, prop, value) {
      obj[prop] = value;
      return true;
    }
  });
}

class FakeElement {
  constructor(doc, tagName) {
    this.ownerDocument = doc;
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this.style = {};
    this.ownText = '';
    this.width = 0;
    this.height = 0;
    this.classList = {
      contains: (name) => this.classNames().includes(name),
      add: (name) => this.setClasses([...new Set([...this.classNames(), name])]),
      remove: (name) => this.setClasses(this.classNames().filter((n) => n !== name)),
      toggle: (name, force) => {
        const on = force === undefined ? !this.classList.contains(name) : Boolean(force);
        if (on) this.classList.add(name);
        else this.classList.remove(name);
        return on;
      }
    };
  }

  classNames() {
    return (this.getAttribute('class') || '').split(/\s+/).filter(Boolean);
  }

  setClasses(names) {
    this.setAttribute('class', names.join(' '));
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  get id() {
    return this.getAttribute('id') || '';
  }

  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const at = this.children.indexOf(child);
    if (at === -1) throw new Error('Not a child of this element.');
    this.children.splice(at, 1);
    child.parentNode = null;
    return child;
  }

  get firstChild() {
    return this.children[0] || null;
  }

  get textContent() {
    return this.ownText + this.children.map((child) => child.textContent).join('');
  }

  set textContent(value) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    this.ownText = String(value);
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  removeEventListener(type, listener) {
    const list = this.listeners.get(type) || [];
    this.listeners.set(type, list.filter((l) => l !== listener));
  }

  dispatch(type, props = {}) {
    const event = {
      type,
      target: this,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...props
    };
    for (const listener of this.listeners.get(type) || []) listener(event);
    return event;
  }

  click() {
    return this.dispatch('click');
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  getContext() {
    if (!this.context) this.context = fakeContext();
    return this.context;
  }

  /** Every descendant, depth first. */
  descendants() {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }
}

/** Builds a fake document holding every 6a id, laid out like index.html. */
export function createShellDom() {
  const doc = {
    activeElement: null,
    readyState: 'complete',
    listeners: new Map(),
    createElement: (tag) => new FakeElement(doc, tag),
    getElementById: (id) => doc.body.descendants().find((node) => node.id === id) || null,
    addEventListener(type, listener) {
      if (!doc.listeners.has(type)) doc.listeners.set(type, []);
      doc.listeners.get(type).push(listener);
    },
    removeEventListener() {},
    keydown(key, target = doc.activeElement || doc.body, extra = {}) {
      const event = {
        type: 'keydown',
        key,
        target,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
        ...extra
      };
      for (const listener of doc.listeners.get('keydown') || []) listener(event);
      return event;
    }
  };
  doc.body = new FakeElement(doc, 'body');
  const add = (parent, tag, id, attrs = {}) => {
    const node = doc.createElement(tag);
    if (id) node.setAttribute('id', id);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
    parent.appendChild(node);
    return node;
  };
  const app = add(doc.body, 'div', 'app', { class: 'app' });
  const wrap = add(add(app, 'main'), 'div', 'map-wrap');
  add(wrap, 'canvas', 'map', { tabindex: '0', 'aria-label': 'Map' });
  const panel = add(app, 'aside', 'panel', { class: 'panel' });
  add(panel, 'button', 'btn-sheet', { 'aria-expanded': 'true' });
  const body = add(panel, 'div', 'panel-body');
  add(body, 'p', 'date-time');
  add(body, 'p', 'wind-info');
  add(body, 'dl', 'resources');
  add(body, 'div', 'tile-info');
  add(body, 'div', 'actions');
  for (const id of ['btn-end-turn', 'btn-chronicle', 'btn-menu', 'btn-help']) add(body, 'button', id);
  add(body, 'button', 'btn-zoom', { 'aria-pressed': 'false' });
  add(body, 'ol', 'log');
  add(body, 'details', 'legend');
  add(doc.body, 'div', 'modal-root');
  add(doc.body, 'div', 'tutorial-root');
  add(doc.body, 'div', 'live', { 'aria-live': 'polite' });
  return doc;
}

/** Builds a fake window with storage, matchMedia, location and a console that collects errors. */
export function createFakeWindow({ backing = createMemoryBacking(), search = '', reducedMotion = false } = {}) {
  const errors = [];
  const listeners = new Map();
  return {
    errors,
    localStorage: backing,
    devicePixelRatio: 2,
    location: { search },
    matchMedia: (query) => ({ matches: reducedMotion && query.includes('reduce'), media: query }),
    addEventListener(type, listener) {
      listeners.set(type, [...(listeners.get(type) || []), listener]);
    },
    fire(type) {
      for (const listener of listeners.get(type) || []) listener({ type });
    },
    console: { error: (error) => errors.push(error) }
  };
}

/** Lets pending promise callbacks run. */
export async function settle(rounds = 10) {
  for (let i = 0; i < rounds; i += 1) await new Promise((resolve) => setImmediate(resolve));
}
