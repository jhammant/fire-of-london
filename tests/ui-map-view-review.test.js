import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMapView, COLOURS } from '../src/ui/map-view.js';
import {
  FIXTURE_COLS,
  FIXTURE_ROWS,
  FIXTURE_LANDMARKS,
  createFakeCanvas,
  createFakeFrames,
  makeState,
  withTile
} from './helpers/map-view-fakes.js';

function quietState() {
  const state = makeState();
  return {
    ...state,
    turn: 2,
    evacuated: [],
    peopleSafe: 0,
    tiles: state.tiles.map((tile) => ({
      ...tile,
      fire: 0,
      burnt: false,
      cleared: false,
      wet: false,
      guard: 0
    }))
  };
}

function makeView(t, canvasOptions = {}, options = {}) {
  const canvas = createFakeCanvas(canvasOptions);
  const view = createMapView({
    canvas,
    cols: FIXTURE_COLS,
    rows: FIXTURE_ROWS,
    landmarks: FIXTURE_LANDMARKS,
    ...options
  });
  t.after(() => view.destroy());
  return { canvas, view };
}

// Replay the recording context's save/restore and style changes so assertions
// distinguish yellow/red sparks from smoke, flames and the compass circle.
function strokes(calls) {
  let style = { globalAlpha: 1 };
  const stack = [];
  let path = [];
  const records = [];
  for (const call of calls) {
    if (call.name === 'save') stack.push({ ...style });
    else if (call.name === 'restore') style = stack.pop() || {};
    else if (call.name.startsWith('set:')) style[call.name.slice(4)] = call.args[0];
    else if (call.name === 'beginPath') path = [];
    else if (call.name === 'stroke') records.push({ ...style, path: [...path] });
    else if (['arc', 'ellipse', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo'].includes(call.name)) path.push(call);
  }
  return records;
}

test('review-ember-source: a null source uses the nearest burning tile across a gap', async (t) => {
  // Arrange: a valid ember ignition two tiles downwind of the only fire.
  const frames = createFakeFrames();
  const { canvas, view } = makeView(t, { frames });
  const prev = withTile(quietState(), 22, 14, { fire: 3 });
  const next = withTile(prev, 20, 14, { fire: 1 });
  view.render(prev);

  // Act: the first ember begins at 10% of the single-ignition animation.
  const pending = view.animate(prev, next, [
    { type: 'ignite', x: 20, y: 14, from: null, ember: true }
  ]);
  frames.step(0);
  canvas.ctx.calls.length = 0;
  frames.step(90);
  const sparkArcs = strokes(canvas.ctx.calls)
    .filter((stroke) => stroke.strokeStyle === COLOURS.fire3 && stroke.fillStyle === COLOURS.fire1)
    .flatMap((stroke) => stroke.path.filter((call) => call.name === 'arc'));
  view.destroy();
  await pending;

  // Assert: no ember may originate from the unburning house at (21, 14).
  assert.ok(sparkArcs.length > 0, 'an ember arc must be drawn');
  const expected = [(22 + 0.5) * 20, (14 + 0.5) * 20];
  assert.deepEqual(sparkArcs[0].args.slice(0, 2), expected,
    'the ember must start at the burning tile, not an invented upwind source');
});

test('review-evacuated-fire: evacuated districts retain their footprint on burning and burnt tiles', (t) => {
  // Arrange: evacuation status is independent of whether the houses survive.
  const { canvas, view } = makeView(t, {}, { reducedMotion: true });
  const initial = quietState();
  const target = { x: 22, y: 14 };
  const index = target.y * FIXTURE_COLS + target.x;
  const scene = {
    ...initial,
    evacuated: ['review-ward'],
    tiles: initial.tiles.map((tile, i) => i === index
      ? { ...tile, district: 'review-ward', people: 0 }
      : tile)
  };
  const footprintCount = (state) => {
    canvas.ctx.calls.length = 0;
    view.render(state);
    // Tile and landmark glyphs are on the offscreen base; only footprints use
    // ellipse on the visible context for this otherwise status-free scene.
    return canvas.ctx.calls.filter((call) => call.name === 'ellipse').length;
  };

  // Act.
  const before = footprintCount(scene);
  const burning = footprintCount(withTile(scene, target.x, target.y, { fire: 2 }));
  const burnt = footprintCount(withTile(scene, target.x, target.y, { burnt: true }));

  // Assert.
  assert.ok(before > 0, 'the evacuated tile has a hollow footprint');
  assert.ok(burning > 0, 'fire must not hide the evacuated-district mark');
  assert.ok(burnt > 0, 'burnout must not hide the evacuated-district mark');
});

test('review-device-pixel-ratio: resize honours the measured ratio above three', (t) => {
  // Arrange.
  const { canvas, view } = makeView(t, { width: 360, height: 240, dpr: 2 });
  view.render(quietState());

  // Act: a high-density display (or browser zoom) changes the pixel ratio.
  canvas.view.devicePixelRatio = 4;
  view.resize();

  // Assert: the backing store has one pixel for each measured device pixel.
  assert.equal(canvas.width, 360 * 4, 'canvas width must use the measured devicePixelRatio');
  assert.equal(canvas.height, 240 * 4, 'canvas height must use the measured devicePixelRatio');
  assert.ok(canvas.ctx.calls.some((call) => call.name === 'setTransform'
    && call.args[0] === 4 && call.args[3] === 4), 'drawing coordinates stay in CSS pixels');
});
