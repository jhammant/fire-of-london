// Fakes for the map-view tests: a recording 2D context, a fake canvas with events,
// fake animation frames and a hand-built state in the shape of the shared contract.

export const FIXTURE_COLS = 28;
export const FIXTURE_ROWS = 18;

const DRAW_CALLS = new Set([
  'fillRect', 'strokeRect', 'fill', 'stroke', 'drawImage', 'fillText', 'strokeText', 'arc', 'ellipse', 'lineTo'
]);

/** Returns a 2D context fake that accepts any method call or property set and records them. */
export function createRecordingContext(canvas = null) {
  const calls = [];
  const props = {};
  return new Proxy({}, {
    get(_target, key) {
      if (key === 'calls') return calls;
      if (key === 'props') return props;
      if (key === 'canvas') return canvas;
      if (key === 'then' || typeof key === 'symbol') return undefined;
      if (Object.prototype.hasOwnProperty.call(props, key)) return props[key];
      if (key === 'measureText') {
        return (text) => {
          calls.push({ name: 'measureText', args: [text] });
          return { width: String(text).length * 6 };
        };
      }
      return (...args) => {
        calls.push({ name: key, args });
        return undefined;
      };
    },
    set(_target, key, value) {
      props[key] = value;
      calls.push({ name: `set:${String(key)}`, args: [value] });
      return true;
    }
  });
}

/** Counts the recorded calls that put ink on the canvas. */
export function countDrawing(calls) {
  return calls.filter((call) => DRAW_CALLS.has(call.name)).length;
}

/** Counts recorded calls with a given name. */
export function countCalls(calls, name) {
  return calls.filter((call) => call.name === name).length;
}

/** Returns the text of every fillText call. */
export function textsDrawn(calls) {
  return calls.filter((call) => call.name === 'fillText').map((call) => String(call.args[0]));
}

/** Returns fake animation frames that only run when step(time) is called. */
export function createFakeFrames() {
  let nextId = 1;
  const queue = new Map();
  const cancelled = [];
  return {
    request: (callback) => {
      const id = nextId;
      nextId += 1;
      queue.set(id, callback);
      return id;
    },
    cancel: (id) => {
      cancelled.push(id);
      queue.delete(id);
    },
    pending: () => queue.size,
    cancelled,
    step(time) {
      const batch = [...queue.values()];
      queue.clear();
      for (const callback of batch) callback(time);
      return batch.length;
    }
  };
}

/** Returns a fake canvas with a bounding box, listeners that can be dispatched, attributes and a recording context. */
export function createFakeCanvas({ width = 560, height = 360, left = 10, top = 20, dpr = 2, frames = null, withDocument = true } = {}) {
  const listeners = new Map();
  const attributes = new Map();
  const created = [];
  const box = { width, height, left, top };
  const view = { devicePixelRatio: dpr };
  if (frames) {
    view.requestAnimationFrame = frames.request;
    view.cancelAnimationFrame = frames.cancel;
  }
  const canvas = {
    width: 300,
    height: 150,
    style: {},
    created,
    view,
    getBoundingClientRect: () => ({
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
      right: box.left + box.width,
      bottom: box.top + box.height,
      x: box.left,
      y: box.top
    }),
    setSize(w, h) {
      box.width = w;
      box.height = h;
    },
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      if (listeners.has(type)) listeners.get(type).delete(handler);
    },
    dispatch(type, init = {}) {
      const event = {
        type,
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
        ...init
      };
      for (const handler of [...(listeners.get(type) || [])]) handler(event);
      return event;
    },
    listenerCount() {
      let total = 0;
      for (const set of listeners.values()) total += set.size;
      return total;
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    getContext(kind) {
      return kind === '2d' ? canvas.ctx : null;
    },
    setPointerCapture() {},
    releasePointerCapture() {}
  };
  canvas.ctx = createRecordingContext(canvas);
  if (withDocument) {
    canvas.ownerDocument = {
      defaultView: view,
      createElement() {
        const layer = createFakeCanvas({ withDocument: false });
        created.push(layer);
        return layer;
      }
    };
  }
  return canvas;
}

/** Returns client coordinates for the centre of tile (x, y) on a fake canvas laid out with offsets 0 and tileSize ts. */
export function tileCentre(canvas, x, y, ts = 20) {
  const rect = canvas.getBoundingClientRect();
  return { clientX: rect.left + x * ts + ts / 2, clientY: rect.top + y * ts + ts / 2 };
}

function range(from, to) {
  const out = [];
  for (let i = from; i <= to; i += 1) out.push(i);
  return out;
}

const GATES = [
  ['ludgate', 'Ludgate', 3],
  ['newgate', 'Newgate', 6],
  ['aldersgate', 'Aldersgate', 9],
  ['cripplegate', 'Cripplegate', 12],
  ['moorgate', 'Moorgate', 15],
  ['bishopsgate', 'Bishopsgate', 19],
  ['aldgate', 'Aldgate', 24]
];
const GATE_XS = new Set(GATES.map((gate) => gate[2]));

function landmark(id, name, kind, tiles, scored) {
  return { id, name, kind, tiles, scored, blurb: `${name} on the test map.` };
}

/** Landmarks of every kind, in the contract's shape and order, on a made-up test layout. */
export const FIXTURE_LANDMARKS = [
  landmark('pudding-lane', 'Pudding Lane', 'bakery', [[21, 14], [21, 13]], false),
  landmark('london-bridge', 'London Bridge', 'bridge', [[20, 16], [20, 17]], true),
  landmark('thames-street', 'Thames Street', 'street', range(8, 17).map((x) => [x, 15]), false),
  landmark('royal-exchange', 'Royal Exchange', 'exchange', [[18, 7], [19, 7], [18, 8], [19, 8]], true),
  landmark('guildhall', 'Guildhall', 'hall', [[12, 5], [13, 5]], true),
  landmark('cheapside', 'Cheapside', 'street', range(7, 11).map((x) => [x, 7]), true),
  landmark('st-pauls', 'St Paul\'s Cathedral', 'cathedral', [[3, 8], [4, 8], [5, 8], [3, 9], [4, 9], [5, 9]], true),
  landmark('baynards-castle', 'Baynard\'s Castle', 'castle', [[2, 15], [3, 15]], true),
  landmark('tower', 'Tower of London', 'fortress', [[25, 14], [26, 14], [25, 15], [26, 15]], true),
  landmark('moorfields', 'Moorfields', 'field', range(8, 16).flatMap((x) => [[x, 0], [x, 1]]), false),
  landmark('fleet-river', 'Fleet river', 'river', range(0, 15).map((y) => [0, y]), false),
  landmark('city-wall', 'City wall', 'wall', range(1, 27).filter((x) => !GATE_XS.has(x)).map((x) => [x, 2]), false),
  ...GATES.map(([id, name, x]) => landmark(id, name, 'gate', [[x, 2]], false))
];

const KIND_TYPES = {
  bakery: 'house',
  bridge: 'house',
  exchange: 'stone',
  hall: 'stone',
  cathedral: 'stone',
  castle: 'stone',
  fortress: 'stone',
  field: 'open',
  river: 'river',
  wall: 'wall',
  gate: 'wall'
};

function baseType(x, y) {
  if (y >= 16) return 'river';
  if (x === 0) return 'river';
  if (y <= 1) return 'open';
  if (y === 2) return 'wall';
  if ((x === 10 && y === 11) || (x === 16 && y === 10)) return 'stone';
  return 'house';
}

function districtFor(x) {
  if (x < 9) return 'farringdon';
  if (x < 18) return 'cheap';
  return 'billingsgate';
}

const HOUSES = { house: 30, warehouse: 4, stone: 1, open: 0, river: 0, wall: 0 };

/** Returns a fresh 28 by 18 state with every tile type, fire 0-3, burnt, cleared, wet, guard and an evacuated district. */
export function makeState() {
  const owner = new Map();
  for (const lm of FIXTURE_LANDMARKS) for (const [x, y] of lm.tiles) owner.set(y * FIXTURE_COLS + x, lm);
  const tiles = [];
  for (let y = 0; y < FIXTURE_ROWS; y += 1) {
    for (let x = 0; x < FIXTURE_COLS; x += 1) {
      const lm = owner.get(y * FIXTURE_COLS + x) || null;
      let type = lm && KIND_TYPES[lm.kind] ? KIND_TYPES[lm.kind] : baseType(x, y);
      if (lm && lm.id === 'thames-street') type = 'warehouse';
      const flammable = type === 'house' || type === 'warehouse' || type === 'stone';
      const houses = HOUSES[type];
      tiles.push({
        type,
        fire: 0,
        burnt: false,
        cleared: false,
        wet: false,
        guard: 0,
        district: flammable ? districtFor(x) : null,
        landmark: lm ? lm.id : null,
        houses,
        people: houses * 5
      });
    }
  }
  const at = (x, y) => tiles[y * FIXTURE_COLS + x];
  at(21, 14).fire = 2;
  at(22, 14).fire = 3;
  at(20, 13).fire = 1;
  at(16, 15).fire = 3;
  at(23, 14).burnt = true;
  at(23, 13).burnt = true;
  at(19, 13).cleared = true;
  at(18, 13).wet = true;
  for (const [x, y] of FIXTURE_LANDMARKS[6].tiles) at(x, y).guard = 3;
  for (const tile of tiles) if (tile.district === 'billingsgate') tile.people = 0;
  const housesTotal = tiles.reduce((sum, tile) => sum + tile.houses, 0);
  return {
    version: 1,
    seed: 1,
    rngState: 12345,
    difficulty: 'normal',
    turn: 3,
    cols: FIXTURE_COLS,
    rows: FIXTURE_ROWS,
    tiles,
    wind: { from: 'E', strength: 3, dx: -1, dy: 0, label: 'Strong easterly gale' },
    resources: { ap: 4, men: 20, powder: 0, goodwill: 10 },
    limits: { ap: 4, men: 20, goodwill: 10 },
    authority: false,
    appeals: 0,
    appealedThisTurn: false,
    evacuated: ['billingsgate'],
    peopleSafe: 6000,
    peopleTotal: housesTotal * 5,
    housesTotal,
    triggers: ['start'],
    over: false,
    outcome: null
  };
}

/** Returns a copy of state with tile (x, y) changed by patch. */
export function withTile(state, x, y, patch) {
  const tiles = state.tiles.map((tile, i) => (i === y * FIXTURE_COLS + x ? { ...tile, ...patch } : tile));
  return { ...state, tiles };
}
