// A small fake DOM and fixtures for tests/ui-screens.test.js. Supports just what screens.js and tutorial.js use.

const HTML_NS = 'http://www.w3.org/1999/xhtml';
const TABBABLE_TAGS = new Set(['a', 'button', 'input', 'select', 'textarea']);
const ZERO_RECT = Object.freeze({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });

/** A minimal DOM event with bubbling and cancelling. */
export class FakeEvent {
  constructor(type, init = {}) {
    Object.assign(this, init);
    this.type = type;
    this.bubbles = init.bubbles !== false;
    this.defaultPrevented = false;
    this.propagationStopped = false;
    this.target = null;
    this.currentTarget = null;
  }

  preventDefault() {
    this.defaultPrevented = true;
  }

  stopPropagation() {
    this.propagationStopped = true;
  }
}

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, fn) {
    const list = this.listeners.get(type) ?? [];
    if (!list.includes(fn)) list.push(fn);
    this.listeners.set(type, list);
  }

  removeEventListener(type, fn) {
    const list = this.listeners.get(type) ?? [];
    this.listeners.set(type, list.filter((item) => item !== fn));
  }

  listenerCount(type) {
    return (this.listeners.get(type) ?? []).length;
  }

  fire(event) {
    event.currentTarget = this;
    for (const fn of [...(this.listeners.get(event.type) ?? [])]) fn.call(this, event);
  }
}

function parseCompound(text) {
  const out = { tag: null, id: null, classes: [], attrs: [] };
  const pattern = /([a-zA-Z][\w-]*|\*)|#([\w-]+)|\.([\w-]+)|\[\s*([\w-]+)\s*(?:=\s*(?:'([^']*)'|"([^"]*)"|([^\]\s]+)))?\s*\]/y;
  let pos = 0;
  while (pos < text.length) {
    pattern.lastIndex = pos;
    const m = pattern.exec(text);
    if (!m) throw new Error(`Fake DOM cannot parse selector: ${text}`);
    if (m[1]) out.tag = m[1] === '*' ? null : m[1].toLowerCase();
    else if (m[2]) out.id = m[2];
    else if (m[3]) out.classes.push(m[3]);
    else out.attrs.push({ name: m[4], value: m[5] ?? m[6] ?? m[7] });
    pos = pattern.lastIndex;
  }
  return out;
}

function parseSelector(selector) {
  return selector.split(',').map((part) => part.trim().split(/\s+/).map(parseCompound));
}

function matchesCompound(node, compound) {
  if (!node || node.nodeType !== 1) return false;
  if (compound.tag && node.localName !== compound.tag) return false;
  if (compound.id && node.getAttribute('id') !== compound.id) return false;
  if (compound.classes.some((name) => !node.classList.contains(name))) return false;
  return compound.attrs.every(({ name, value }) => {
    const actual = node.getAttribute(name);
    return actual !== null && (value === undefined || actual === value);
  });
}

function matchesChain(node, chain) {
  if (!matchesCompound(node, chain[chain.length - 1])) return false;
  let at = node.parentNode;
  for (let i = chain.length - 2; i >= 0; i -= 1) {
    while (at && !matchesCompound(at, chain[i])) at = at.parentNode;
    if (!at) return false;
    at = at.parentNode;
  }
  return true;
}

function descendants(node, out = []) {
  for (const child of node.childNodes) {
    if (child.nodeType !== 1) continue;
    out.push(child);
    descendants(child, out);
  }
  return out;
}

class FakeText {
  constructor(doc, data) {
    this.ownerDocument = doc;
    this.nodeType = 3;
    this.data = String(data);
    this.parentNode = null;
  }

  get textContent() {
    return this.data;
  }

  set textContent(value) {
    this.data = String(value);
  }
}

class FakeClassList {
  constructor(element) {
    this.element = element;
  }

  items() {
    return (this.element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
  }

  contains(name) {
    return this.items().includes(name);
  }

  add(...names) {
    const items = this.items();
    for (const name of names) if (!items.includes(name)) items.push(name);
    this.element.setAttribute('class', items.join(' '));
  }

  remove(...names) {
    this.element.setAttribute('class', this.items().filter((item) => !names.includes(item)).join(' '));
  }

  toggle(name, force) {
    const on = force ?? !this.contains(name);
    if (on) this.add(name);
    else this.remove(name);
    return on;
  }
}

/** A fake element with attributes, children, events, focus and simple selectors. */
export class FakeElement extends FakeEventTarget {
  constructor(doc, tagName, namespaceURI = HTML_NS) {
    super();
    this.ownerDocument = doc;
    this.nodeType = 1;
    this.namespaceURI = namespaceURI;
    this.localName = namespaceURI === HTML_NS ? tagName.toLowerCase() : tagName;
    this.tagName = namespaceURI === HTML_NS ? tagName.toUpperCase() : tagName;
    this.childNodes = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.classList = new FakeClassList(this);
    this.style = {};
    this.value = '';
    this.disabled = false;
    this.rect = null;
    this.checkedState = false;
  }

  get children() {
    return this.childNodes.filter((node) => node.nodeType === 1);
  }

  get id() {
    return this.getAttribute('id') ?? '';
  }

  set id(value) {
    this.setAttribute('id', value);
  }

  get textContent() {
    return this.childNodes.map((node) => node.textContent).join('');
  }

  set textContent(value) {
    for (const node of this.childNodes) node.parentNode = null;
    const text = String(value ?? '');
    this.childNodes = text ? [new FakeText(this.ownerDocument, text)] : [];
  }

  get checked() {
    return this.checkedState;
  }

  set checked(value) {
    this.checkedState = Boolean(value);
    if (!this.checkedState || this.getAttribute('type') !== 'radio') return;
    let top = this;
    while (top.parentNode) top = top.parentNode;
    const name = this.getAttribute('name');
    for (const other of descendants(top)) {
      if (other !== this && other.getAttribute('type') === 'radio' && other.getAttribute('name') === name) {
        other.checkedState = false;
      }
    }
  }

  get tabIndex() {
    const raw = this.getAttribute('tabindex');
    if (raw !== null) return Number(raw);
    return TABBABLE_TAGS.has(this.localName) ? 0 : -1;
  }

  get isConnected() {
    let at = this;
    while (at.parentNode) at = at.parentNode;
    return at === this.ownerDocument.documentElement;
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

  appendChild(node) {
    if (node.parentNode) node.parentNode.removeChild(node);
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }

  append(...nodes) {
    for (const node of nodes) {
      this.appendChild(typeof node === 'string' ? new FakeText(this.ownerDocument, node) : node);
    }
  }

  removeChild(node) {
    const index = this.childNodes.indexOf(node);
    if (index < 0) throw new Error('Fake DOM: node is not a child');
    this.childNodes.splice(index, 1);
    node.parentNode = null;
    return node;
  }

  replaceChildren(...nodes) {
    for (const node of [...this.childNodes]) this.removeChild(node);
    this.append(...nodes);
  }

  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }

  contains(node) {
    for (let at = node; at; at = at.parentNode) if (at === this) return true;
    return false;
  }

  matches(selector) {
    return parseSelector(selector).some((chain) => matchesChain(this, chain));
  }

  closest(selector) {
    for (let at = this; at && at.nodeType === 1; at = at.parentNode) if (at.matches(selector)) return at;
    return null;
  }

  querySelectorAll(selector) {
    const chains = parseSelector(selector);
    return descendants(this).filter((node) => chains.some((chain) => matchesChain(node, chain)));
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  dispatchEvent(event) {
    event.target = event.target ?? this;
    const path = [];
    for (let at = this; at; at = at.parentNode) path.push(at);
    if (path[path.length - 1] === this.ownerDocument.documentElement) {
      path.push(this.ownerDocument, this.ownerDocument.defaultView);
    }
    for (const node of path) {
      node.fire(event);
      if (!event.bubbles || event.propagationStopped) break;
    }
    return !event.defaultPrevented;
  }

  focus() {
    if (!this.disabled) this.ownerDocument.moveFocus(this);
  }

  blur() {
    if (this.ownerDocument.activeElement === this) this.ownerDocument.moveFocus(null);
  }

  click() {
    if (this.disabled) return;
    const type = this.getAttribute('type');
    if (this.localName === 'input' && type === 'checkbox') this.checked = !this.checked;
    if (this.localName === 'input' && type === 'radio') this.checked = true;
    this.dispatchEvent(new FakeEvent('click'));
    if (this.localName === 'input') this.dispatchEvent(new FakeEvent('change'));
  }

  getBoundingClientRect() {
    return this.rect ?? ZERO_RECT;
  }

  setRect({ left, top, width, height }) {
    this.rect = { x: left, y: top, left, top, width, height, right: left + width, bottom: top + height };
  }
}

class FakeWindow extends FakeEventTarget {
  constructor(width, height) {
    super();
    this.innerWidth = width;
    this.innerHeight = height;
  }
}

class FakeDocument extends FakeEventTarget {
  constructor(width, height) {
    super();
    this.documentElement = new FakeElement(this, 'html');
    this.body = new FakeElement(this, 'body');
    this.documentElement.appendChild(this.body);
    this.defaultView = new FakeWindow(width, height);
    this.focused = null;
  }

  get activeElement() {
    return this.focused && this.focused.isConnected ? this.focused : this.body;
  }

  createElement(tagName) {
    return new FakeElement(this, tagName);
  }

  createElementNS(namespaceURI, tagName) {
    return new FakeElement(this, tagName, namespaceURI);
  }

  createTextNode(text) {
    return new FakeText(this, text);
  }

  querySelector(selector) {
    return this.documentElement.querySelector(selector);
  }

  querySelectorAll(selector) {
    return this.documentElement.querySelectorAll(selector);
  }

  getElementById(id) {
    return this.querySelector(`#${id}`);
  }

  moveFocus(node) {
    if (this.activeElement === node) return;
    this.focused = node;
    if (node) {
      node.dispatchEvent(new FakeEvent('focus', { bubbles: false }));
      node.dispatchEvent(new FakeEvent('focusin'));
    }
  }
}

/** Creates a fake document with a body and a window of the given size. */
export function createFakeDocument({ width = 1280, height = 800 } = {}) {
  return new FakeDocument(width, height);
}

/** Dispatches a keydown on the focused element (or a given target). */
export function pressKey(doc, key, { shiftKey = false, target = doc.activeElement } = {}) {
  const event = new FakeEvent('keydown', { key, shiftKey });
  target.dispatchEvent(event);
  return event;
}

/** Finds the first button inside root whose text is exactly text. */
export function buttonByText(root, text) {
  return root.querySelectorAll('button').find((button) => button.textContent === text) ?? null;
}

/** Builds the parts of the page that the tutorial points at, plus the two roots. */
export function buildPage(doc) {
  const add = (tag, id, parent = doc.body) => {
    const node = doc.createElement(tag);
    if (id) node.setAttribute('id', id);
    parent.append(node);
    return node;
  };
  const map = add('canvas', 'map');
  map.setAttribute('tabindex', '0');
  map.setRect({ left: 0, top: 0, width: 880, height: 800 });
  const panel = add('div', 'panel');
  const tileInfo = add('div', 'tile-info', panel);
  tileInfo.setRect({ left: 900, top: 20, width: 380, height: 120 });
  add('div', 'resources', panel);
  add('div', 'wind-info', panel);
  const actions = add('div', 'actions', panel);
  for (const id of ['douse', 'hooks', 'gunpowder', 'evacuate', 'guard', 'appeal']) {
    const button = add('button', null, actions);
    button.setAttribute('data-action', id);
  }
  add('button', 'btn-end-turn', panel);
  add('button', 'btn-chronicle', panel);
  const modalRoot = add('div', 'modal-root');
  const tutorialRoot = add('div', 'tutorial-root');
  return { map, panel, tileInfo, actions, modalRoot, tutorialRoot };
}

/** The engine's difficulty list, as the shell passes it in. */
export const SAMPLE_DIFFICULTIES = Object.freeze([
  { id: 'easy', label: 'Easy', description: 'A gentler wind and more men.' },
  { id: 'normal', label: 'Normal', description: 'Much as it was in 1666.' },
  { id: 'hard', label: 'Hard', description: 'A fierce gale and few helpers.' },
]);

/** History cards shaped like src/data/history.js CARDS entries. */
export const SAMPLE_CARDS = Object.freeze([
  {
    id: 'bakery',
    title: 'The bakery in Pudding Lane',
    text: "Thomas Farriner baked bread for the King's navy. Just after midnight, his bakery caught fire.",
    trigger: 'start',
    when: 'Sunday 2 September 1666',
    learnMore: 'Farriner always said he had put his oven out before bed.',
  },
  {
    id: 'east-wind',
    title: 'The east wind',
    text: 'A strong wind blew from the east. It carried sparks from roof to roof.',
    trigger: 'first-spread',
  },
]);

/** Quiz questions shaped like history buildQuiz output. */
export const SAMPLE_QUESTIONS = Object.freeze([
  { cardId: 'bakery', question: 'Where did the fire start?', options: ['Pudding Lane', 'Fish Street', 'Cheapside'], answer: 0 },
  { cardId: 'east-wind', question: 'Which way did the wind blow from?', options: ['North', 'East', 'South'], answer: 1 },
  { cardId: 'monument', question: 'What was built to remember the fire?', options: ['A bridge', 'A palace', 'The Monument'], answer: 2 },
]);

/** An engine getScore result with a chosen rating; overrides replace any field. */
export function makeScore(ratingId = 'better-than-1666', overrides = {}) {
  const labels = {
    'worse-than-1666': 'Worse than 1666',
    'like-1666': 'Much like 1666',
    'better-than-1666': 'Better than 1666',
    saviour: 'Saviour of London',
  };
  return {
    housesTotal: 16000,
    housesLost: 9876,
    housesSaved: 6124,
    housesPulledDown: 1234,
    peopleTotal: 80000,
    peopleSafe: 72500,
    landmarksSaved: ['tower', 'london-bridge'],
    landmarksLost: ['st-pauls', 'royal-exchange', 'guildhall', 'cheapside', 'baynards-castle'],
    stPaulsSaved: false,
    beatHistory: true,
    history: { housesLost: 13200, churchesLost: 87, stPaulsLost: true, deathsRecorded: 6 },
    rating: { id: ratingId, label: labels[ratingId], text: 'You did your best for London.' },
    ...overrides,
  };
}

/** Landmark id to name, as the shell builds it from engine LANDMARKS. */
export const SAMPLE_LANDMARK_NAMES = Object.freeze({
  'london-bridge': 'London Bridge',
  'royal-exchange': 'Royal Exchange',
  guildhall: 'Guildhall',
  cheapside: 'Cheapside',
  'st-pauls': "St Paul's Cathedral",
  'baynards-castle': "Baynard's Castle",
  tower: 'Tower of London',
});
