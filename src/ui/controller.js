// Game flow without the DOM: holds the state and selection, and turns them into plain view models.

import {
  actionDoneText,
  costText,
  describeTile,
  formatNumber,
  placeName,
  turnSummary,
  windPush,
  windSentence,
  windText
} from './format.js';

const LOG_LIMIT = 30;
const NO_TILE = 'Choose a tile on the map first.';

/** Creates the controller around the injected engine, history and storage modules. */
export function createController({ engine, history, storage }) {
  let state = null;
  let selected = null;
  let log = [];
  let live = '';

  function cardsFor(triggerId) {
    const cards = history.cardsForTrigger(triggerId);
    return Array.isArray(cards) ? cards : [];
  }

  function landmarkName(id) {
    const landmark = id ? engine.getLandmark(id) : undefined;
    return landmark ? landmark.name : null;
  }

  function districtName(id) {
    const district = id ? engine.getDistrict(id) : undefined;
    return district ? district.name : null;
  }

  function addLog(text) {
    if (!text) return;
    log = [...log, text].slice(-LOG_LIMIT);
  }

  function persist() {
    if (!state) return;
    if (state.over) storage.clearSave();
    else storage.saveGame(engine.serialize(state));
  }

  function readSave() {
    const text = storage.loadSave();
    if (text === null) return null;
    try {
      const saved = engine.deserialize(text);
      if (!saved || saved.over) throw new Error('Finished or empty save.');
      return saved;
    } catch {
      storage.clearSave();
      return null;
    }
  }

  function findAction(type) {
    return engine.ACTIONS.find((def) => def.id === type) || null;
  }

  function actionFor(def) {
    if (def.target !== 'tile' || !selected) return { type: def.id };
    return { type: def.id, x: selected.x, y: selected.y };
  }

  function tileInfo() {
    if (!state || !selected) return null;
    const tile = engine.tileAt(state, selected.x, selected.y);
    if (!tile) return null;
    const info = describeTile(tile, {
      x: selected.x,
      y: selected.y,
      landmarkName: landmarkName(tile.landmark),
      districtName: districtName(tile.district),
      evacuated: Boolean(tile.district && state.evacuated.includes(tile.district))
    });
    return { ...info, x: selected.x, y: selected.y, tile };
  }

  function quizQuestions() {
    if (!state) return [];
    const questions = history.buildQuiz(quizIds(), state.seed);
    return Array.isArray(questions) ? questions : [];
  }

  function check(def) {
    const result = engine.canAct(state, actionFor(def));
    if (!result.ok) return { ok: false, reason: result.reason || 'You cannot do that now.' };
    if (def.target === 'tile' && !selected) return { ok: false, reason: NO_TILE };
    return { ok: true, reason: '' };
  }

  function selectedPlace() {
    if (!selected) return '';
    const tile = engine.tileAt(state, selected.x, selected.y);
    return placeName({
      x: selected.x,
      y: selected.y,
      landmarkName: tile ? landmarkName(tile.landmark) : null,
      districtName: tile ? districtName(tile.district) : null
    });
  }

  function selectedDistrictName() {
    const tile = selected ? engine.tileAt(state, selected.x, selected.y) : null;
    return (tile && districtName(tile.district)) || selectedPlace();
  }

  function selectedLandmarkName() {
    const tile = selected ? engine.tileAt(state, selected.x, selected.y) : null;
    return (tile && landmarkName(tile.landmark)) || selectedPlace();
  }

  function placeForAction(def) {
    if (def.id === 'evacuate') return selectedDistrictName();
    if (def.id === 'guard') return selectedLandmarkName();
    return selectedPlace();
  }

  // Reads the events of one engine call: logs what matters and collects the cards to show.
  function digest(events) {
    const cards = [];
    for (const event of events) {
      if (event.type === 'trigger' && event.id !== 'end') cards.push(...cardsFor(event.id));
      if (event.type === 'message') addLog(event.text);
      if (event.type === 'landmark-lost') addLog(`${landmarkName(event.id) || 'A landmark'} has been lost to the fire.`);
      if (event.type === 'trigger' && event.id === 'authority') addLog('The King agrees. You may now use gunpowder.');
      if (event.type === 'game-over') addLog(gameOverText(event.outcome));
    }
    return cards;
  }

  function gameOverText(outcome) {
    return outcome === 'extinguished' ? 'The fire is out!' : 'It is Thursday morning. The fire is over.';
  }

  function lostText(events) {
    const names = events
      .filter((event) => event.type === 'landmark-lost')
      .map((event) => landmarkName(event.id) || 'A landmark');
    return names.map((name) => ` ${name} has been lost.`).join('');
  }

  function quizIds() {
    if (!state) return [];
    const cards = history.cardsForTriggers(state.triggers);
    return Array.isArray(cards) ? cards.map((card) => card.id) : [];
  }

  return {
    /** True when a readable, unfinished save exists (an unreadable one is cleared). */
    hasSave: () => readSave() !== null,

    /** True when a game is loaded and not finished. */
    hasGame: () => Boolean(state && !state.over),

    /** True when the loaded game has finished. */
    isOver: () => Boolean(state && state.over),

    /** Returns the current engine state (or null). */
    getState: () => state,

    /** Returns the selected tile { x, y } or null. */
    getSelected: () => selected,

    /** Returns the state to draw behind the start menu: the save if readable, else a fresh game. */
    previewState: () => state || readSave() || engine.newGame({ seed: 1 }),

    /** Starts a new game, saves it and returns the 'start' cards. */
    newGame({ difficulty = 'normal', seed = 1 } = {}) {
      state = engine.newGame({ seed, difficulty });
      selected = null;
      log = [];
      addLog(`${engine.getTimeInfo(state.turn).label}: fire breaks out in a bakery on Pudding Lane.`);
      live = 'A new game has begun. Fire has broken out on Pudding Lane.';
      persist();
      return cardsFor('start');
    },

    /** Loads the saved game; returns false (and clears it) when the save is missing or unreadable. */
    continueGame() {
      const saved = readSave();
      if (!saved) return false;
      state = saved;
      selected = null;
      log = ['Welcome back. Your game is just as you left it.'];
      live = `Game loaded. ${engine.getTimeInfo(state.turn).label}.`;
      return true;
    },

    /** Selects the tile at x, y (null clears) and returns its tile info. */
    select(x, y) {
      if (!state || x === null || x === undefined) {
        selected = null;
        live = 'No square chosen.';
        return null;
      }
      if (x < 0 || y < 0 || x >= state.cols || y >= state.rows) return tileInfo();
      selected = { x, y };
      const info = tileInfo();
      live = info ? info.summary : '';
      return info;
    },

    /** Uses an action on the selected tile: { ok, reason, events, cards, over, live }. */
    act(type) {
      const def = findAction(type);
      if (!state || !def) return { ok: false, reason: 'You cannot do that now.', events: [], cards: [], over: false, live: '' };
      const allowed = check(def);
      if (!allowed.ok) {
        live = allowed.reason;
        return { ok: false, reason: allowed.reason, events: [], cards: [], over: state.over, live };
      }
      const place = placeForAction(def);
      const result = engine.applyAction(state, actionFor(def));
      if (!result.ok) {
        live = result.reason;
        return { ok: false, reason: result.reason, events: [], cards: [], over: state.over, live };
      }
      state = result.state;
      const done = actionDoneText(def.id, def.label, place);
      addLog(done);
      const cards = digest(result.events);
      persist();
      live = `${done}${lostText(result.events)}`;
      return { ok: true, reason: '', events: result.events, cards, over: state.over, live };
    },

    /** Ends the turn: { prev, next, events, cards, over, newFires, live }. */
    endTurn() {
      if (!state) return { prev: null, next: null, events: [], cards: [], over: false, newFires: 0, live: '' };
      const prev = state;
      const result = engine.endTurn(state);
      state = result.state;
      const newFires = result.events.filter((event) => event.type === 'ignite').length;
      const summary = turnSummary(engine.getTimeInfo(state.turn).label, newFires);
      if (state !== prev) addLog(summary);
      const cards = digest(result.events);
      persist();
      live = `${summary}${lostText(result.events)}`;
      return { prev, next: state, events: result.events, cards, over: state.over, newFires, live };
    },

    /** Returns one button model per engine action: { id, label, key, costText, description, enabled, reason }. */
    actionButtons() {
      return engine.ACTIONS.map((def) => {
        const allowed = state ? check(def) : { ok: false, reason: 'Start a game first.' };
        return {
          id: def.id,
          label: def.label,
          key: def.key,
          costText: costText(def.cost),
          description: def.description,
          enabled: allowed.ok,
          reason: allowed.reason
        };
      });
    },

    /** Describes the selected tile ({ heading, status, rows, summary, x, y, tile }) or returns null. */
    tileInfo,

    /** Returns the header model: time, wind and resources. */
    header() {
      if (!state) return null;
      const time = engine.getTimeInfo(state.turn);
      const push = windPush(state.wind);
      const { resources, limits } = state;
      const turnsLeft = Math.max(0, engine.LAST_TURN - state.turn);
      return {
        timeLabel: time.label,
        turnsLeftText: turnsLeft === 1 ? '1 turn left until Thursday' : `${turnsLeft} turns left until Thursday`,
        windText: windText(state.wind),
        windLabel: state.wind.label,
        windArrow: push ? push.arrow : '',
        windSentence: windSentence(state.wind),
        resources: [
          { id: 'ap', label: 'Actions left', text: `${formatNumber(resources.ap)} of ${formatNumber(limits.ap)}` },
          { id: 'men', label: 'Men', text: `${formatNumber(resources.men)} of ${formatNumber(limits.men)}` },
          { id: 'powder', label: 'Gunpowder barrels', text: formatNumber(resources.powder) },
          { id: 'goodwill', label: 'Goodwill', text: `${formatNumber(resources.goodwill)} of ${formatNumber(limits.goodwill)}` },
          { id: 'authority', label: "King's permission", text: state.authority ? 'Given' : 'Not yet' }
        ]
      };
    },

    /** Returns the recent log lines, newest last. */
    log: () => log.slice(),

    /** Returns the latest message for the live region. */
    live: () => live,

    /** Returns the showChronicle argument: the cards found so far, the total and the sources. */
    chronicle() {
      const cards = state ? history.cardsForTriggers(state.triggers) : [];
      return { cards: Array.isArray(cards) ? cards : [], total: history.CARDS.length, sources: history.SOURCES };
    },

    /** Returns the showDebrief argument for the finished (or current) game. */
    debrief() {
      const landmarkNames = {};
      for (const landmark of engine.LANDMARKS) landmarkNames[landmark.id] = landmark.name;
      return {
        score: engine.getScore(state),
        outcome: state.outcome,
        timeLabel: engine.getTimeInfo(state.turn).label,
        landmarkNames,
        whatHappened: history.WHAT_HAPPENED,
        endCards: cardsFor('end'),
        canQuiz: quizQuestions().length > 0
      };
    },

    /** Builds the quiz from the cards seen this game and the game seed. */
    quizQuestions
  };
}
