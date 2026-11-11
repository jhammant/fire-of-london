import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createMapView,
  computeLayout,
  pointToTile,
  LEGEND,
  drawLegendSwatch,
  COLOURS
} from '../src/ui/map-view.js';
import {
  FIXTURE_COLS,
  FIXTURE_ROWS,
  FIXTURE_LANDMARKS,
  createFakeCanvas,
  createFakeFrames,
  createRecordingContext,
  countDrawing,
  countCalls,
  textsDrawn,
  tileCentre,
  makeState,
  withTile
} from './helpers/map-view-fakes.js';

const BANNED_SPELLINGS = [
  'color', 'colors', 'center', 'centered', 'neighbor', 'neighbors', 'gray', 'honor', 'favorite',
  'armor', 'harbor', 'defense', 'organize', 'realize', 'recognize', 'theater'
];
const BANNED_RE = new RegExp(`\\b(${BANNED_SPELLINGS.join('|')})\\b`, 'i');
const LEGEND_IDS = [
  'house', 'warehouse', 'stone', 'open', 'river', 'wall', 'fire-1', 'fire-2', 'fire-3',
  'burnt', 'firebreak', 'wet', 'guard', 'evacuated'
];

function makeView(options = {}) {
  const { canvasOptions, ...rest } = options;
  const canvas = createFakeCanvas(canvasOptions);
  const selections = [];
  const view = createMapView({
    canvas,
    cols: FIXTURE_COLS,
    rows: FIXTURE_ROWS,
    landmarks: FIXTURE_LANDMARKS,
    onSelect: (x, y) => selections.push({ x, y }),
    ...rest
  });
  return { canvas, view, selections };
}

function tap(canvas, x, y, jitter = 0) {
  const point = tileCentre(canvas, x, y);
  canvas.dispatch('pointerdown', { pointerId: 1, pointerType: 'mouse', button: 0, ...point });
  canvas.dispatch('pointerup', {
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    clientX: point.clientX + jitter,
    clientY: point.clientY - jitter
  });
}

function tapAt(canvas, localX, localY) {
  const rect = canvas.getBoundingClientRect();
  const point = { pointerId: 2, pointerType: 'touch', clientX: rect.left + localX, clientY: rect.top + localY };
  canvas.dispatch('pointerdown', point);
  canvas.dispatch('pointerup', point);
}

function drag(canvas, fromLocal, dx, dy) {
  const rect = canvas.getBoundingClientRect();
  const start = { clientX: rect.left + fromLocal[0], clientY: rect.top + fromLocal[1] };
  const end = { clientX: start.clientX + dx, clientY: start.clientY + dy };
  canvas.dispatch('pointerdown', { pointerId: 3, pointerType: 'touch', ...start });
  canvas.dispatch('pointermove', { pointerId: 3, pointerType: 'touch', ...end });
  canvas.dispatch('pointerup', { pointerId: 3, pointerType: 'touch', ...end });
}

function key(canvas, name) {
  return canvas.dispatch('keydown', { key: name });
}

function luminance(hex) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function settle(promise, ms = 200) {
  return Promise.race([
    promise.then((value) => ({ value })),
    new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), ms))
  ]);
}

test('map-view and map-art import in Node with no DOM and only named exports', async () => {
  // Arrange
  const sources = ['map-view.js', 'map-art.js'].map((name) => readFileSync(new URL(`../src/ui/${name}`, import.meta.url), 'utf8'));

  // Act
  const view = await import('../src/ui/map-view.js');
  const art = await import('../src/ui/map-art.js');

  // Assert
  assert.equal(typeof document, 'undefined');
  assert.equal(typeof window, 'undefined');
  for (const name of ['createMapView', 'computeLayout', 'pointToTile', 'drawLegendSwatch']) {
    assert.equal(typeof view[name], 'function', name);
  }
  assert.ok(Array.isArray(view.LEGEND));
  assert.equal(typeof view.COLOURS, 'object');
  assert.equal(typeof art.drawFire, 'function');
  assert.equal(view.default, undefined);
  assert.equal(art.default, undefined);
  for (const source of sources) {
    assert.doesNotMatch(source, /Math\.random|innerHTML|https?:/);
    const specifiers = [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]);
    for (const specifier of specifiers) assert.match(specifier, /^\.\/[a-z-]+\.js$/);
  }
  assert.doesNotMatch(sources[0], /from\s+'\.\.\//, 'map-view must not import engine or data modules');
});

test('computeLayout fits a 28 by 18 grid of square tiles, centred, on phones and desktops', () => {
  for (const [w, h] of [[360, 240], [375, 260], [1280, 800]]) {
    // Act
    const layout = computeLayout(w, h, 28, 18);
    const zoomed = computeLayout(w, h, 28, 18, 2);

    // Assert
    assert.ok(Number.isInteger(layout.tileSize) && layout.tileSize >= 1, `${w}x${h}`);
    assert.equal(layout.width, layout.tileSize * 28);
    assert.equal(layout.height, layout.tileSize * 18);
    assert.ok(layout.width <= w && layout.height <= h, `${w}x${h} fits`);
    assert.ok((layout.tileSize + 1) * 28 > w || (layout.tileSize + 1) * 18 > h, `${w}x${h} uses the space`);
    assert.ok(Math.abs(layout.offsetX * 2 + layout.width - w) <= 1, `${w}x${h} centred across`);
    assert.ok(Math.abs(layout.offsetY * 2 + layout.height - h) <= 1, `${w}x${h} centred down`);
    assert.equal(zoomed.tileSize, layout.tileSize * 2);
  }
});

test('pointToTile maps every tile centre back to its tile and returns null outside the grid', () => {
  for (const [w, h, zoom] of [[360, 240, 1], [1280, 800, 1], [375, 260, 2]]) {
    // Arrange
    const layout = computeLayout(w, h, 28, 18, zoom);

    // Act and assert
    for (let y = 0; y < 18; y += 1) {
      for (let x = 0; x < 28; x += 1) {
        const px = layout.offsetX + (x + 0.5) * layout.tileSize;
        const py = layout.offsetY + (y + 0.5) * layout.tileSize;
        assert.deepEqual(pointToTile(px, py, layout, 28, 18), { x, y });
      }
    }
    assert.equal(pointToTile(layout.offsetX - 1, layout.offsetY + 1, layout, 28, 18), null);
    assert.equal(pointToTile(layout.offsetX + 1, layout.offsetY - 1, layout, 28, 18), null);
    assert.equal(pointToTile(layout.offsetX + layout.width, layout.offsetY + 1, layout, 28, 18), null);
    assert.equal(pointToTile(layout.offsetX + 1, layout.offsetY + layout.height, layout, 28, 18), null);
    assert.equal(pointToTile(Number.NaN, 5, layout, 28, 18), null);
  }
});

test('LEGEND lists exactly the contract ids with plain British labels', () => {
  // Act
  const ids = LEGEND.map((entry) => entry.id);

  // Assert
  assert.deepEqual(ids, LEGEND_IDS);
  for (const entry of LEGEND) {
    assert.equal(typeof entry.label, 'string');
    assert.ok(entry.label.trim().length > 0, entry.id);
    assert.doesNotMatch(entry.label, BANNED_RE, entry.id);
  }
});

test('COLOURS holds the contract values and the three fire colours differ clearly in brightness', () => {
  // Arrange
  const expected = {
    parchment: '#f3e7c9',
    ink: '#2b1d0e',
    fire1: '#f0e442',
    fire2: '#e69f00',
    fire3: '#d55e00',
    burnt: '#2e2a26',
    firebreak: '#0072b2',
    water: '#56b4e9',
    guard: '#009e73'
  };

  // Act
  const fireLuminance = [COLOURS.fire1, COLOURS.fire2, COLOURS.fire3].map(luminance);

  // Assert
  for (const [name, value] of Object.entries(expected)) assert.equal(COLOURS[name], value, name);
  assert.ok(fireLuminance[0] > fireLuminance[1] && fireLuminance[1] > fireLuminance[2]);
  assert.ok(contrast(COLOURS.fire1, COLOURS.fire2) >= 1.5);
  assert.ok(contrast(COLOURS.fire2, COLOURS.fire3) >= 1.5);
});

test('createMapView renders a full contract-shaped state with drawing calls, labels and balanced save and restore', () => {
  // Arrange
  const { canvas, view } = makeView();
  const state = makeState();

  // Act
  view.render(state, { selected: { x: 5, y: 7 } });

  // Assert
  const calls = canvas.ctx.calls;
  assert.equal(canvas.width, 1120);
  assert.equal(canvas.height, 720);
  assert.ok(countDrawing(calls) > 50);
  assert.equal(countCalls(calls, 'save'), countCalls(calls, 'restore'));
  assert.equal(canvas.created.length, 1, 'one offscreen base layer');
  const baseCalls = canvas.created[0].ctx.calls;
  assert.ok(countDrawing(baseCalls) > 500);
  assert.equal(countCalls(baseCalls, 'save'), countCalls(baseCalls, 'restore'));
  assert.ok(calls.some((call) => call.name === 'drawImage' && call.args[0] === canvas.created[0]));
  const texts = textsDrawn(calls);
  assert.ok(texts.includes('St Paul\'s Cathedral'), 'scored landmarks are labelled at 20px tiles');
  assert.ok(texts.includes('The City of London, 1666'));
  assert.ok(texts.includes('N'));
  assert.equal(texts.filter((text) => text === '3').length, 1, 'one number for the men guarding St Paul\'s');
  for (const text of texts) assert.doesNotMatch(text, BANNED_RE);
  assert.equal(canvas.getAttribute('aria-label'), 'Map of the City of London. Selected: column 6, row 8.');
  assert.deepEqual(view.getSelected(), { x: 5, y: 7 });
});

test('night turns get a dark tint and day turns do not', () => {
  // Arrange
  const { canvas, view } = makeView();
  const tinted = () => canvas.ctx.calls.filter((call) => call.name === 'set:fillStyle' && call.args[0] === COLOURS.night).length;

  // Act
  view.render({ ...makeState(), turn: 2 });
  const dayTints = tinted();
  view.render({ ...makeState(), turn: 3 });

  // Assert
  assert.equal(dayTints, 0);
  assert.ok(tinted() > 0);
});

test('small tiles skip landmark labels and the view still draws', () => {
  // Arrange
  const { canvas, view } = makeView({ canvasOptions: { width: 360, height: 240, dpr: 3 } });

  // Act
  view.render(makeState());

  // Assert
  assert.equal(canvas.width, 1080);
  assert.ok(countDrawing(canvas.ctx.calls) > 0);
  assert.ok(!textsDrawn(canvas.ctx.calls).includes('St Paul\'s Cathedral'));
});

test('the base layer is cached and rebuilt only when tile types, burnt or cleared change', () => {
  // Arrange
  const { canvas, view } = makeView();
  const state = makeState();
  view.render(state);
  const baseCalls = () => canvas.created[0].ctx.calls.length;
  const first = baseCalls();

  // Act
  view.render(withTile(state, 10, 10, { fire: 2, wet: true, guard: 3 }));
  const afterOverlayChange = baseCalls();
  view.render(withTile(state, 10, 10, { burnt: true }));
  const afterBurn = baseCalls();
  view.render(withTile(state, 11, 10, { cleared: true }));
  const afterClear = baseCalls();

  // Assert
  assert.equal(afterOverlayChange, first);
  assert.ok(afterBurn > afterOverlayChange);
  assert.ok(afterClear > afterBurn);
  assert.equal(canvas.created.length, 1);
});

test('without an owner document the view draws the base layer straight onto the canvas', () => {
  // Arrange
  const { canvas, view } = makeView({ canvasOptions: { withDocument: false } });

  // Act
  view.render(makeState());

  // Assert
  assert.equal(countCalls(canvas.ctx.calls, 'drawImage'), 0);
  assert.ok(countDrawing(canvas.ctx.calls) > 500);
});

test('resize re-measures the CSS size and devicePixelRatio', () => {
  // Arrange
  const { canvas, view } = makeView();
  view.render(makeState());

  // Act
  canvas.setSize(840, 540);
  canvas.view.devicePixelRatio = 1;
  view.resize();

  // Assert
  assert.equal(canvas.width, 840);
  assert.equal(canvas.height, 540);
  tap(canvas, 0, 0);
  assert.deepEqual(view.getSelected(), { x: 0, y: 0 });
});

test('animate resolves promptly with the next state when reducedMotion is true', async () => {
  // Arrange
  const frames = createFakeFrames();
  const { canvas, view } = makeView({ reducedMotion: true, canvasOptions: { frames } });
  const prev = makeState();
  const next = withTile(prev, 20, 14, { fire: 1 });
  view.render(prev);

  // Act
  const result = await settle(view.animate(prev, next, [{ type: 'ignite', x: 20, y: 14, from: { x: 21, y: 14 }, ember: false }]));

  // Assert
  assert.equal(result.value, next);
  assert.equal(frames.pending(), 0, 'no flicker loop with reduced motion');
  assert.ok(countDrawing(canvas.ctx.calls) > 0);
});

test('animate resolves at once when requestAnimationFrame is missing', async () => {
  // Arrange
  const { view } = makeView();
  const prev = makeState();
  const next = withTile(prev, 20, 14, { fire: 1 });

  // Act
  const result = await settle(view.animate(prev, next, [{ type: 'ignite', x: 20, y: 14, from: null, ember: false }]));

  // Assert
  assert.equal(result.value, next);
});

test('animate plays sparks and flashes over about a second, then resolves with next drawn', async () => {
  // Arrange
  const frames = createFakeFrames();
  const { canvas, view } = makeView({ canvasOptions: { frames } });
  const prev = makeState();
  let next = withTile(prev, 20, 14, { fire: 1 });
  next = withTile(next, 18, 12, { fire: 1 });
  next = withTile(next, 22, 14, { fire: 0, burnt: true });
  const events = [
    { type: 'ignite', x: 20, y: 14, from: { x: 21, y: 14 }, ember: false },
    { type: 'ignite', x: 18, y: 12, from: null, ember: true },
    { type: 'burnout', x: 22, y: 14 }
  ];
  view.render(prev);
  let resolved = null;

  // Act
  const promise = view.animate(prev, next, events).then((value) => {
    resolved = value;
    return value;
  });
  const before = countCalls(canvas.ctx.calls, 'arc');
  for (let time = 0; time <= 800; time += 100) frames.step(time);
  await Promise.resolve();
  const midway = resolved;
  frames.step(1000);
  const result = await settle(promise);

  // Assert
  assert.equal(midway, null, 'still animating after 0.8 seconds');
  assert.ok(countCalls(canvas.ctx.calls, 'arc') > before, 'sparks and flashes drawn');
  assert.equal(result.value, next);
  assert.equal(resolved, next);
});

test('a burning map runs a gentle flicker loop at about 12 frames a second', () => {
  // Arrange
  const frames = createFakeFrames();
  const { canvas, view } = makeView({ canvasOptions: { frames } });
  view.render(makeState());
  const painted = () => countCalls(canvas.ctx.calls, 'drawImage');
  const start = painted();

  // Act
  frames.step(1000);
  const afterFirst = painted();
  frames.step(1030);
  const afterQuick = painted();
  frames.step(1100);
  const afterSlow = painted();
  const calm = makeState();
  for (const tile of calm.tiles) tile.fire = 0;
  view.render(calm);

  // Assert
  assert.equal(afterFirst, start + 1);
  assert.equal(afterQuick, afterFirst, 'frames closer than 80ms are skipped');
  assert.equal(afterSlow, afterQuick + 1);
  assert.equal(frames.pending(), 0, 'the loop stops when nothing is burning');
});

test('a tap selects the tile under the pointer and calls onSelect', () => {
  // Arrange
  const { canvas, view, selections } = makeView();
  view.render(makeState());

  // Act
  tap(canvas, 5, 7, 3);
  tap(canvas, 27, 17);

  // Assert
  assert.deepEqual(selections, [{ x: 5, y: 7 }, { x: 27, y: 17 }]);
  assert.deepEqual(view.getSelected(), { x: 27, y: 17 });
  assert.equal(canvas.getAttribute('aria-label'), 'Map of the City of London. Selected: column 28, row 18.');
});

test('a drag beyond the threshold does not select, even when it ends back near the start', () => {
  // Arrange
  const { canvas, view, selections } = makeView();
  view.render(makeState());
  const start = tileCentre(canvas, 4, 4);

  // Act
  drag(canvas, [90, 90], 30, 0);
  canvas.dispatch('pointerdown', { pointerId: 4, pointerType: 'touch', ...start });
  canvas.dispatch('pointermove', { pointerId: 4, pointerType: 'touch', clientX: start.clientX + 12, clientY: start.clientY });
  canvas.dispatch('pointerup', { pointerId: 4, pointerType: 'touch', ...start });

  // Assert
  assert.deepEqual(selections, []);
  assert.equal(view.getSelected(), null);
});

test('arrow keys move the selection one tile, clamp at the edges and Enter re-selects', () => {
  // Arrange
  const { canvas, view, selections } = makeView();
  view.render(makeState());
  view.setSelected(0, 0);

  // Act
  const left = key(canvas, 'ArrowLeft');
  const up = key(canvas, 'ArrowUp');
  key(canvas, 'ArrowRight');
  key(canvas, 'ArrowDown');
  const afterMoves = view.getSelected();
  view.setSelected(27, 17);
  key(canvas, 'ArrowRight');
  key(canvas, 'ArrowDown');
  const atCorner = view.getSelected();
  const enter = key(canvas, 'Enter');

  // Assert
  assert.ok(left.defaultPrevented && up.defaultPrevented);
  assert.deepEqual(afterMoves, { x: 1, y: 1 });
  assert.deepEqual(atCorner, { x: 27, y: 17 });
  assert.ok(enter.defaultPrevented);
  assert.deepEqual(selections, [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 27, y: 17 }]);
  assert.equal(canvas.getAttribute('aria-label'), 'Map of the City of London. Selected: column 28, row 18.');
});

test('with nothing selected the first arrow key picks a burning tile and number keys are left alone', () => {
  // Arrange
  const { canvas, view, selections } = makeView();
  view.render(makeState());
  const before = canvas.getAttribute('aria-label');

  // Act
  const digit = key(canvas, '1');
  key(canvas, 'ArrowDown');

  // Assert
  assert.equal(before, 'Map of the City of London. Use the arrow keys to choose a place.');
  assert.equal(digit.defaultPrevented, false);
  assert.deepEqual(selections, [{ x: 20, y: 13 }]);
});

test('zoom 2 centres on the selection, drags pan within the map, and arrow keys keep the selection in view', () => {
  // Arrange
  const { canvas, view } = makeView();
  view.render(makeState());
  view.setSelected(14, 9);

  // Act and assert
  view.setZoom(2);
  assert.equal(view.getZoom(), 2);
  assert.equal(canvas.style.touchAction, 'none');
  tapAt(canvas, 280, 180);
  assert.deepEqual(view.getSelected(), { x: 14, y: 9 }, 'the selection sits in the middle');

  drag(canvas, [280, 180], -80, 0);
  tapAt(canvas, 280, 180);
  assert.deepEqual(view.getSelected(), { x: 16, y: 9 }, 'dragging left pans the map two tiles');

  drag(canvas, [280, 180], 5000, 5000);
  tapAt(canvas, 10, 10);
  assert.deepEqual(view.getSelected(), { x: 0, y: 0 }, 'panning stops at the north-west corner');

  view.setSelected(20, 10);
  view.setZoom(2);
  for (let i = 0; i < 10; i += 1) key(canvas, 'ArrowRight');
  assert.deepEqual(view.getSelected(), { x: 27, y: 10 });
  tapAt(canvas, 540, 180);
  assert.deepEqual(view.getSelected(), { x: 27, y: 10 }, 'the view followed the selection east');

  view.setZoom(1);
  assert.equal(view.getZoom(), 1);
  tap(canvas, 3, 3);
  assert.deepEqual(view.getSelected(), { x: 3, y: 3 });
});

test('a drag does not pan at zoom 1', () => {
  // Arrange
  const { canvas, view } = makeView();
  view.render(makeState());

  // Act
  drag(canvas, [100, 100], -200, 0);
  tap(canvas, 2, 2);

  // Assert
  assert.deepEqual(view.getSelected(), { x: 2, y: 2 });
});

test('setSelected(null) clears the selection and render keeps it unless told otherwise', () => {
  // Arrange
  const { canvas, view } = makeView();
  const state = makeState();
  view.render(state, { selected: { x: 4, y: 4 } });

  // Act
  view.render(state);
  const kept = view.getSelected();
  view.setSelected(null);
  const cleared = view.getSelected();
  view.render(state, { selected: { x: 99, y: 2 } });

  // Assert
  assert.deepEqual(kept, { x: 4, y: 4 });
  assert.equal(cleared, null);
  assert.equal(view.getSelected(), null, 'out-of-range selections are ignored');
  assert.equal(canvas.getAttribute('aria-label'), 'Map of the City of London. Use the arrow keys to choose a place.');
});

test('drawLegendSwatch draws every LEGEND id without throwing', () => {
  for (const { id } of LEGEND) {
    // Arrange
    const ctx = createRecordingContext();

    // Act
    drawLegendSwatch(ctx, id, 24);

    // Assert
    assert.ok(countDrawing(ctx.calls) > 0, id);
    assert.equal(countCalls(ctx.calls, 'save'), countCalls(ctx.calls, 'restore'), id);
  }
});

test('destroy removes the listeners, stops the flicker loop and settles a running animation', async () => {
  // Arrange
  const frames = createFakeFrames();
  const { canvas, view, selections } = makeView({ canvasOptions: { frames } });
  const prev = makeState();
  const next = withTile(prev, 20, 14, { fire: 1 });
  view.render(prev);
  const listening = canvas.listenerCount();
  const pending = view.animate(prev, next, [{ type: 'ignite', x: 20, y: 14, from: null, ember: false }]);

  // Act
  view.destroy();
  tap(canvas, 5, 5);
  key(canvas, 'ArrowDown');
  const result = await settle(pending);

  // Assert
  assert.ok(listening >= 5);
  assert.equal(canvas.listenerCount(), 0);
  assert.deepEqual(selections, []);
  assert.equal(frames.pending(), 0);
  assert.equal(result.value, next);
});
