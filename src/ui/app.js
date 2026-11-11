// The game flow in the browser. Every other unit is injected, so this module imports in Node with no DOM.

import { createController } from './controller.js';
import { createPanel } from './panel.js';
import { browserStorage, createStorage } from './storage.js';

const MAX_SEED = 0xffffffff;
const FORM_TAGS = ['INPUT', 'SELECT', 'TEXTAREA'];

/** Reads a repeatable seed from a query string such as '?seed=123'; returns null when it is missing or invalid. */
export function parseSeed(search) {
  if (typeof search !== 'string' || search === '') return null;
  const value = new URLSearchParams(search).get('seed');
  if (value === null || !/^\d{1,10}$/.test(value)) return null;
  const seed = Number(value);
  return seed <= MAX_SEED ? seed : null;
}

/** True when keys typed at this element belong to a form field rather than the game. */
export function isFormField(target) {
  if (!target) return false;
  if (target.isContentEditable) return true;
  return FORM_TAGS.includes(String(target.tagName || '').toUpperCase());
}

/** Creates the app; start() builds the map, dialogs and tutorial, then shows the start menu. */
export function createApp({ doc, win, engine, history, mapView, screens, tutorial }) {
  const storage = createStorage(browserStorage(win));
  const controller = createController({ engine, history, storage });
  const byId = (id) => doc.getElementById(id);
  const pendingCards = [];
  let cardChain = Promise.resolve();
  let busy = false;
  let panel = null;
  let view = null;
  let dialogs = null;
  let coach = null;

  function reportError(error) {
    if (win && win.console) win.console.error(error);
  }

  function guard(promise) {
    return Promise.resolve(promise).catch(reportError);
  }

  function reducedMotion() {
    try {
      return Boolean(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch {
      return false;
    }
  }

  function newSeed() {
    const fromUrl = parseSeed(win.location ? win.location.search : '');
    return fromUrl === null ? Math.floor(Math.random() * (MAX_SEED - 1)) + 1 : fromUrl;
  }

  function renderAll() {
    const state = controller.getState();
    if (state) view.render(state, { selected: controller.getSelected() });
    panel.renderHeader(controller.header());
    panel.renderTile(controller.tileInfo());
    panel.renderActions(controller.actionButtons());
    panel.renderLog(controller.log());
    panel.setEndTurn({ enabled: controller.hasGame(), busy });
  }

  function focusMap() {
    const canvas = byId('map');
    if (canvas && typeof canvas.focus === 'function') canvas.focus();
  }

  // Cards wait while the tutorial runs; otherwise they are shown one batch at a time.
  function flushCards() {
    cardChain = cardChain
      .then(async () => {
        while (pendingCards.length && !coach.isActive()) {
          await dialogs.showCards(pendingCards.splice(0));
        }
      })
      .catch(reportError);
    return cardChain;
  }

  function showCards(cards) {
    pendingCards.push(...cards);
    return flushCards();
  }

  function handleTutorialFinish() {
    storage.savePrefs({ tutorialSeen: true });
    guard(flushCards());
  }

  async function beginNewGame({ difficulty, tutorial: wantsTutorial }) {
    pendingCards.length = 0;
    if (coach.isActive()) coach.skip();
    const cards = controller.newGame({ difficulty: difficulty || 'normal', seed: newSeed() });
    view.setSelected(null);
    renderAll();
    panel.announce(controller.live());
    focusMap();
    if (wantsTutorial) startTutorial();
    else storage.savePrefs({ tutorialSeen: true });
    await showCards(cards);
  }

  async function openMenu() {
    const prefs = storage.loadPrefs();
    const inGame = controller.hasGame();
    const canContinue = inGame || controller.hasSave();
    const firstTime = !(prefs && prefs.tutorialSeen);
    const result = await dialogs.showStartMenu({ difficulties: engine.DIFFICULTIES, canContinue, firstTime });
    if (result && result.choice === 'new') return beginNewGame(result);
    if (inGame) return undefined;
    if (canContinue && controller.continueGame()) {
      view.setSelected(null);
      renderAll();
      panel.announce(controller.live());
      focusMap();
      return undefined;
    }
    return beginNewGame({ difficulty: 'normal', tutorial: firstTime });
  }

  async function finishGame() {
    if (coach.isActive()) coach.skip();
    await flushCards();
    const choice = await dialogs.showDebrief(controller.debrief());
    if (choice === 'quiz') {
      const result = await dialogs.showQuiz(controller.quizQuestions());
      if (result && typeof result.total === 'number') {
        panel.announce(`You got ${result.correct} out of ${result.total} right.`);
      }
    }
    await openMenu();
  }

  function handleSelect(x, y) {
    if (!controller.getState()) return;
    const info = controller.select(x, y);
    panel.renderTile(info);
    panel.renderActions(controller.actionButtons());
    panel.announce(controller.live());
    if (info) coach.notify('tile-selected', { x, y, tile: info.tile });
  }

  async function doAction(id) {
    if (busy || !controller.hasGame() || dialogs.isOpen()) return;
    const result = controller.act(id);
    panel.announce(result.live || result.reason);
    if (!result.ok) return;
    renderAll();
    coach.notify('action-done', { type: id });
    await showCards(result.cards);
    if (result.over) await finishGame();
  }

  async function doEndTurn() {
    if (busy || !controller.hasGame() || dialogs.isOpen()) return;
    busy = true;
    panel.setEndTurn({ enabled: true, busy: true });
    let result;
    try {
      result = controller.endTurn();
      await guard(view.animate(result.prev, result.next, result.events));
    } finally {
      busy = false;
    }
    renderAll();
    panel.announce(result.live);
    coach.notify('turn-ended', {});
    await showCards(result.cards);
    if (result.over) await finishGame();
  }

  function onKeyDown(event) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if (dialogs.isOpen() || isFormField(event.target)) return;
    const def = engine.ACTIONS.find((action) => action.key === event.key);
    if (!def) return;
    event.preventDefault();
    guard(doAction(def.id));
  }

  function toggleZoom() {
    const next = view.getZoom() === 2 ? 1 : 2;
    view.setZoom(next);
    byId('btn-zoom').setAttribute('aria-pressed', next === 2 ? 'true' : 'false');
  }

  // The bottom sheet only collapses on phones (styles.css); on desktop these flags have no effect.
  function setSheet(open) {
    const button = byId('btn-sheet');
    if ((button.getAttribute('aria-expanded') !== 'false') === open) return;
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
    byId('panel').classList.toggle('is-collapsed', !open);
    byId('app').classList.toggle('sheet-collapsed', !open);
    view.resize();
  }

  function toggleSheet() {
    setSheet(byId('btn-sheet').getAttribute('aria-expanded') === 'false');
  }

  // The tutorial points at panel elements, so the sheet must be open while it runs.
  function startTutorial() {
    setSheet(true);
    coach.start();
  }

  function onClick(id, handler) {
    byId(id).addEventListener('click', handler);
  }

  function wireControls() {
    onClick('btn-end-turn', () => guard(doEndTurn()));
    onClick('btn-chronicle', () => {
      if (!dialogs.isOpen()) guard(dialogs.showChronicle(controller.chronicle()));
    });
    onClick('btn-menu', () => {
      if (!busy && !dialogs.isOpen()) guard(openMenu());
    });
    onClick('btn-help', () => {
      if (controller.hasGame() && !coach.isActive()) startTutorial();
    });
    onClick('btn-zoom', toggleZoom);
    onClick('btn-sheet', toggleSheet);
    doc.addEventListener('keydown', onKeyDown);
    const wrap = byId('map-wrap');
    if (typeof win.ResizeObserver === 'function') {
      new win.ResizeObserver(() => view.resize()).observe(wrap);
    } else if (typeof win.addEventListener === 'function') {
      win.addEventListener('resize', () => view.resize());
    }
  }

  return {
    /** Builds the map view, dialogs and tutorial, draws a preview and runs the start menu. */
    start() {
      const motion = reducedMotion();
      panel = createPanel({ doc, mapView, dpr: win.devicePixelRatio || 1, onAction: (id) => guard(doAction(id)) });
      view = mapView.createMapView({
        canvas: byId('map'),
        cols: engine.COLS,
        rows: engine.ROWS,
        landmarks: engine.LANDMARKS,
        onSelect: handleSelect,
        reducedMotion: motion
      });
      dialogs = screens.createScreens({ doc, root: byId('modal-root'), reducedMotion: motion });
      coach = tutorial.createTutorial({ doc, root: byId('tutorial-root'), onFinish: handleTutorialFinish });
      wireControls();
      panel.renderLegend();
      view.render(controller.previewState(), { selected: null });
      renderAll();
      return guard(openMenu());
    }
  };
}
