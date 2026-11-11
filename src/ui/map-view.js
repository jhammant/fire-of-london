// The canvas map of the City of London: drawing, the spread animation, and pointer and
// keyboard input. Everything comes from the state and options passed in; this module
// never imports the engine or the data. Browser work happens only inside functions.
import {
  COLOURS,
  hash2,
  hasLandmarkGlyph,
  drawGround,
  drawTileGlyph,
  drawBoat,
  drawLandmark,
  drawBakerySign,
  drawDistrictEdges,
  drawBurnt,
  drawFirebreak,
  drawFire,
  drawSmoke,
  drawWet,
  drawGuard,
  drawFootprint,
  drawTent,
  drawSelection,
  drawWindVane,
  drawTitle,
  drawLabel,
  drawMapFrame,
  drawNight,
  drawSpark,
  drawFlash,
  drawDarken
} from './map-art.js';

export { COLOURS };

/** Map key entries, in the order the legend shows them. */
export const LEGEND = Object.freeze([
  { id: 'house', label: 'Timber houses' },
  { id: 'warehouse', label: 'Warehouses of oil and tar' },
  { id: 'stone', label: 'Stone church or hall' },
  { id: 'open', label: 'Open ground' },
  { id: 'river', label: 'River' },
  { id: 'wall', label: 'City wall' },
  { id: 'fire-1', label: 'Catching fire' },
  { id: 'fire-2', label: 'Burning' },
  { id: 'fire-3', label: 'Blazing' },
  { id: 'burnt', label: 'Burnt' },
  { id: 'firebreak', label: 'Firebreak' },
  { id: 'wet', label: 'Wet' },
  { id: 'guard', label: 'Men on guard' },
  { id: 'evacuated', label: 'Evacuated' }
].map((entry) => Object.freeze(entry)));

const TAP_THRESHOLD = 8;
const FLICKER_MS = 80;
const FLICKER_CYCLE_MS = 1400;
const MAX_SPARKS = 60;
const MAX_BASE_PIXELS = 8e6;
// The largest canvas every browser will draw into (iOS Safari refuses more than 4096 x 4096
// pixels of area). Only a backing store above this is scaled down; below it the measured
// devicePixelRatio is used as is.
const MAX_BACKING_PIXELS = 4096 * 4096;
const LABEL_MIN_TILE = 18;
const TITLE = 'The City of London, 1666';
const ARIA_PREFIX = 'Map of the City of London.';
const ARIA_EMPTY = `${ARIA_PREFIX} Use the arrow keys to choose a place.`;
const TYPE_CODES = { house: 'h', warehouse: 'w', stone: 's', open: 'o', river: 'r', wall: 'l' };
const KEY_STEPS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

/** Fits a cols by rows grid of square tiles, centred, inside a CSS box; zoom 2 doubles the tile size. */
export function computeLayout(cssWidth, cssHeight, cols, rows, zoom = 1) {
  const w = Math.max(0, Number(cssWidth) || 0);
  const h = Math.max(0, Number(cssHeight) || 0);
  const z = Math.max(1, Math.round(Number(zoom) || 1));
  const tileSize = Math.max(1, Math.floor(Math.min(w / cols, h / rows))) * z;
  const width = tileSize * cols;
  const height = tileSize * rows;
  return { tileSize, offsetX: Math.floor((w - width) / 2), offsetY: Math.floor((h - height) / 2), width, height };
}

/** Returns the { x, y } tile under a CSS point for a layout, or null outside the grid. */
export function pointToTile(px, py, layout, cols, rows) {
  if (!layout || !(layout.tileSize > 0)) return null;
  const fx = (px - layout.offsetX) / layout.tileSize;
  const fy = (py - layout.offsetY) / layout.tileSize;
  if (!(fx >= 0 && fy >= 0)) return null;
  const x = Math.floor(fx);
  const y = Math.floor(fy);
  if (x >= cols || y >= rows) return null;
  return { x, y };
}

/** Draws the glyph for a LEGEND id in a size by size square at the context's origin, as on the map. */
export function drawLegendSwatch(ctx, id, size) {
  const s = size;
  ctx.save();
  if (Object.prototype.hasOwnProperty.call(TYPE_CODES, id)) {
    drawGround(ctx, id, 0, 0, s, 0, 0);
    drawTileGlyph(ctx, id, 0, 0, s, 0, 0);
  } else if (id === 'firebreak') {
    drawGround(ctx, 'house', 0, 0, s, 0, 0);
    drawFirebreak(ctx, 0, 0, s, 0, 0);
  } else {
    drawGround(ctx, 'house', 0, 0, s, 0, 0);
    drawTileGlyph(ctx, 'house', 0, 0, s, 0, 0);
    if (id === 'fire-1' || id === 'fire-2' || id === 'fire-3') drawFire(ctx, Number(id.slice(5)), 0, 0, s);
    else if (id === 'burnt') drawBurnt(ctx, 0, 0, s);
    else if (id === 'wet') drawWet(ctx, 0, 0, s);
    else if (id === 'guard') drawGuard(ctx, 0, 0, s, 3);
    else if (id === 'evacuated') drawFootprint(ctx, 0, 0, s);
  }
  ctx.restore();
}

function indexLandmarks(landmarks, cols, rows) {
  const byTile = new Array(cols * rows).fill(null);
  const byId = new Map();
  const boxes = [];
  for (const landmark of Array.isArray(landmarks) ? landmarks : []) {
    if (!landmark || !Array.isArray(landmark.tiles)) continue;
    byId.set(landmark.id, landmark);
    const cells = landmark.tiles.filter((cell) => Array.isArray(cell)
      && Number.isInteger(cell[0]) && Number.isInteger(cell[1])
      && cell[0] >= 0 && cell[1] >= 0 && cell[0] < cols && cell[1] < rows);
    if (!cells.length) continue;
    for (const [x, y] of cells) byTile[y * cols + x] = landmark;
    const xs = cells.map((cell) => cell[0]);
    const ys = cells.map((cell) => cell[1]);
    boxes.push({
      landmark,
      cells,
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys)
    });
  }
  return { byTile, byId, boxes };
}

function isNight(turn) {
  const quarter = (((Number(turn) || 0) % 4) + 4) % 4;
  return quarter === 0 || quarter === 3;
}

function hasFire(scene) {
  return Boolean(scene && Array.isArray(scene.tiles) && scene.tiles.some((tile) => tile && tile.fire > 0));
}

/** Creates the map view on a canvas; see the shared contract (6d) for the view's methods. */
export function createMapView({ canvas, cols = 28, rows = 18, landmarks = [], onSelect, reducedMotion = false }) {
  const ctx = canvas.getContext('2d');
  const doc = canvas.ownerDocument || null;
  const win = (doc && doc.defaultView) || globalThis;
  const index = indexLandmarks(landmarks, cols, rows);
  const fieldCells = index.boxes.filter((box) => box.landmark.kind === 'field').flatMap((box) => box.cells);
  const listeners = [];
  let cssW = 0;
  let cssH = 0;
  let dpr = 1;
  let zoom = 1;
  let layout = computeLayout(0, 0, cols, rows, 1);
  let selected = null;
  let state = null;
  let stateHasFire = false;
  let offscreen;
  let base = { sig: '', scene: null, tileSize: 0, dpr: 0 };
  let phase = 0;
  let flickerId = null;
  let lastFlicker = -Infinity;
  let anim = null;
  let pointer = null;
  let destroyed = false;

  function landmarkOf(tile, i) {
    return index.byTile[i] || (tile && tile.landmark ? index.byId.get(tile.landmark) || null : null);
  }

  function requestFrame(callback) {
    return win.requestAnimationFrame(callback);
  }

  function canAnimate() {
    return !reducedMotion && typeof win.requestAnimationFrame === 'function';
  }

  function cancelFrame(id) {
    if (typeof win.cancelAnimationFrame === 'function') win.cancelAnimationFrame(id);
  }

  function timerHost() {
    return typeof win.setTimeout === 'function' ? win : globalThis;
  }

  // ----- layout and selection -----

  function clampOffset(offset, gridSize, viewSize) {
    if (gridSize <= viewSize) return Math.floor((viewSize - gridSize) / 2);
    return Math.round(clamp(offset, viewSize - gridSize, 0));
  }

  function panTo(offsetX, offsetY) {
    layout = {
      ...layout,
      offsetX: clampOffset(offsetX, layout.width, cssW),
      offsetY: clampOffset(offsetY, layout.height, cssH)
    };
  }

  function centreOn(tile) {
    const ts = layout.tileSize;
    const target = tile || { x: (cols - 1) / 2, y: (rows - 1) / 2 };
    panTo(cssW / 2 - (target.x + 0.5) * ts, cssH / 2 - (target.y + 0.5) * ts);
  }

  function relayout() {
    layout = computeLayout(cssW, cssH, cols, rows, zoom);
    if (zoom === 2) centreOn(selected);
  }

  function keepInView(tile) {
    if (zoom !== 2) return;
    const ts = layout.tileSize;
    let { offsetX, offsetY } = layout;
    const left = offsetX + tile.x * ts;
    const top = offsetY + tile.y * ts;
    if (left < 0) offsetX -= left;
    else if (left + ts > cssW) offsetX -= left + ts - cssW;
    if (top < 0) offsetY -= top;
    else if (top + ts > cssH) offsetY -= top + ts - cssH;
    panTo(offsetX, offsetY);
  }

  function normaliseTile(x, y) {
    const point = x && typeof x === 'object' ? x : { x, y };
    if (!Number.isInteger(point.x) || !Number.isInteger(point.y)) return null;
    if (point.x < 0 || point.y < 0 || point.x >= cols || point.y >= rows) return null;
    return { x: point.x, y: point.y };
  }

  function updateAria() {
    const label = selected
      ? `${ARIA_PREFIX} Selected: column ${selected.x + 1}, row ${selected.y + 1}.`
      : ARIA_EMPTY;
    canvas.setAttribute('aria-label', label);
  }

  function applySelection(tile) {
    selected = tile;
    if (tile) keepInView(tile);
    updateAria();
  }

  function choose(tile) {
    applySelection(tile);
    paint();
    if (typeof onSelect === 'function') onSelect(tile.x, tile.y);
  }

  function startingTile() {
    if (state && Array.isArray(state.tiles)) {
      const i = state.tiles.findIndex((tile) => tile && tile.fire > 0);
      if (i >= 0) return { x: i % cols, y: Math.floor(i / cols) };
    }
    return { x: Math.floor(cols / 2), y: Math.floor(rows / 2) };
  }

  // ----- drawing -----

  function baseSignature(scene, ts) {
    let sig = `${ts}|${dpr}|`;
    for (const tile of scene.tiles) {
      sig += tile ? (TYPE_CODES[tile.type] || '?') + (tile.burnt ? 'b' : tile.cleared ? 'c' : '-') : '__';
    }
    return sig;
  }

  function districtEdges(tiles, ts) {
    const segments = [];
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const here = tiles[y * cols + x];
        if (!here || !here.district) continue;
        const east = x + 1 < cols ? tiles[y * cols + x + 1] : null;
        const south = y + 1 < rows ? tiles[(y + 1) * cols + x] : null;
        if (east && east.district && east.district !== here.district) {
          segments.push([(x + 1) * ts, y * ts, (x + 1) * ts, (y + 1) * ts]);
        }
        if (south && south.district && south.district !== here.district) {
          segments.push([x * ts, (y + 1) * ts, (x + 1) * ts, (y + 1) * ts]);
        }
      }
    }
    return segments;
  }

  function drawLandmarkBox(target, box, ts) {
    const { kind } = box.landmark;
    if (kind === 'bakery') {
      drawBakerySign(target, box.cells[0][0] * ts, box.cells[0][1] * ts, ts);
    } else if (kind === 'gate') {
      for (const [x, y] of box.cells) drawLandmark(target, kind, { x: x * ts, y: y * ts, w: ts, h: ts }, ts);
    } else if (hasLandmarkGlyph(kind)) {
      const rect = {
        x: box.minX * ts,
        y: box.minY * ts,
        w: (box.maxX - box.minX + 1) * ts,
        h: (box.maxY - box.minY + 1) * ts
      };
      drawLandmark(target, kind, rect, ts);
    }
  }

  // The static layer: ground, tile and landmark glyphs, district borders, burnt and cleared tiles.
  function drawBaseLayer(target, scene, ts) {
    const tiles = scene.tiles;
    target.fillStyle = COLOURS.parchment;
    target.fillRect(0, 0, cols * ts, rows * ts);
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const i = y * cols + x;
        const tile = tiles[i];
        if (!tile) continue;
        const landmark = landmarkOf(tile, i);
        const kind = landmark ? landmark.kind : null;
        const px = x * ts;
        const py = y * ts;
        if (kind === 'bridge') {
          drawGround(target, 'river', px, py, ts, x, y);
          drawTileGlyph(target, 'river', px, py, ts, x, y);
          continue;
        }
        drawGround(target, tile.type, px, py, ts, x, y);
        if (!tile.cleared && !hasLandmarkGlyph(kind)) drawTileGlyph(target, tile.type, px, py, ts, x, y);
        if (tile.type === 'river' && !landmark && y >= rows - 2 && x >= 4 && hash2(x, y, 99) < 0.16) {
          drawBoat(target, px, py, ts, x, y);
        }
      }
    }
    drawDistrictEdges(target, districtEdges(tiles, ts), ts);
    for (const box of index.boxes) drawLandmarkBox(target, box, ts);
    tiles.forEach((tile, i) => {
      if (!tile) return;
      const px = (i % cols) * ts;
      const py = Math.floor(i / cols) * ts;
      if (tile.burnt) drawBurnt(target, px, py, ts);
      else if (tile.cleared) drawFirebreak(target, px, py, ts, i % cols, Math.floor(i / cols));
    });
  }

  function makeOffscreen() {
    if (!doc || typeof doc.createElement !== 'function') return null;
    const layer = doc.createElement('canvas');
    const layerCtx = layer && typeof layer.getContext === 'function' ? layer.getContext('2d') : null;
    return layerCtx ? { canvas: layer, ctx: layerCtx } : null;
  }

  function paintBase(scene) {
    const ts = layout.tileSize;
    const gridW = cols * ts;
    const gridH = rows * ts;
    if (offscreen === undefined) offscreen = makeOffscreen();
    if (!offscreen) {
      ctx.save();
      ctx.translate(layout.offsetX, layout.offsetY);
      drawBaseLayer(ctx, scene, ts);
      ctx.restore();
      return;
    }
    const fresh = base.scene === scene && base.tileSize === ts && base.dpr === dpr;
    if (!fresh) {
      const sig = baseSignature(scene, ts);
      if (sig !== base.sig) {
        const scale = Math.min(dpr, Math.sqrt(MAX_BASE_PIXELS / Math.max(1, gridW * gridH)));
        offscreen.canvas.width = Math.max(1, Math.ceil(gridW * scale));
        offscreen.canvas.height = Math.max(1, Math.ceil(gridH * scale));
        offscreen.ctx.setTransform(scale, 0, 0, scale, 0, 0);
        offscreen.ctx.clearRect(0, 0, gridW, gridH);
        drawBaseLayer(offscreen.ctx, scene, ts);
      }
      base = { sig, scene, tileSize: ts, dpr };
    }
    ctx.drawImage(offscreen.canvas, layout.offsetX, layout.offsetY, gridW, gridH);
  }

  function visibleRange(ts) {
    return {
      x0: clamp(Math.floor(-layout.offsetX / ts) - 1, 0, cols - 1),
      x1: clamp(Math.ceil((cssW - layout.offsetX) / ts), 0, cols - 1),
      y0: clamp(Math.floor(-layout.offsetY / ts) - 1, 0, rows - 1),
      y1: clamp(Math.ceil((cssH - layout.offsetY) / ts), 0, rows - 1)
    };
  }

  function forEachVisible(tiles, range, visit) {
    for (let y = range.y0; y <= range.y1; y += 1) {
      for (let x = range.x0; x <= range.x1; x += 1) {
        const tile = tiles[y * cols + x];
        if (tile) visit(tile, x, y);
      }
    }
  }

  function paintTents(scene, ts) {
    const safe = Number(scene.peopleSafe) || 0;
    if (safe <= 0 || !fieldCells.length) return;
    const capacity = fieldCells.length * 3;
    const total = Number(scene.peopleTotal) || 0;
    const share = total > 0 ? safe / total : safe / 40000;
    const count = clamp(Math.ceil(share * capacity), 1, capacity);
    for (let k = 0; k < count; k += 1) {
      const [x, y] = fieldCells[k % fieldCells.length];
      const slot = Math.floor(k / fieldCells.length);
      const cx = x * ts + ts * (0.2 + 0.3 * slot) + (hash2(x, y, 60 + slot) - 0.5) * ts * 0.1;
      const baseY = y * ts + ts * (0.5 + 0.38 * hash2(x, y, 70 + slot));
      drawTent(ctx, cx, baseY, ts * 0.34);
    }
  }

  // One number per guarded landmark (on its first guarded tile), so pennants stay readable.
  function guardBadges(tiles) {
    const badges = new Map();
    for (const box of index.boxes) {
      let first = -1;
      let men = 0;
      for (const [x, y] of box.cells) {
        const i = y * cols + x;
        const tile = tiles[i];
        if (!tile || !(tile.guard > 0) || tile.burnt) continue;
        if (first < 0) first = i;
        men = Math.max(men, tile.guard);
      }
      if (first >= 0) badges.set(first, men);
    }
    return badges;
  }

  function paintStatus(scene, ts, range) {
    const tiles = scene.tiles;
    const wind = scene.wind || {};
    const evacuated = new Set(Array.isArray(scene.evacuated) ? scene.evacuated : []);
    const badges = guardBadges(tiles);
    forEachVisible(tiles, range, (tile, x, y) => {
      if (tile.fire > 0) drawFire(ctx, tile.fire, x * ts, y * ts, ts, phase, x, y);
    });
    forEachVisible(tiles, range, (tile, x, y) => {
      if (tile.fire > 0) drawSmoke(ctx, tile.fire, x * ts, y * ts, ts, Number(wind.dx) || 0, Number(wind.dy) || 0, phase, x, y);
    });
    forEachVisible(tiles, range, (tile, x, y) => {
      const px = x * ts;
      const py = y * ts;
      if (tile.wet && !tile.burnt) drawWet(ctx, px, py, ts);
      if (tile.guard > 0 && !tile.burnt) {
        const i = y * cols + x;
        drawGuard(ctx, px, py, ts, index.byTile[i] ? badges.get(i) || 0 : tile.guard);
      }
      // Evacuation belongs to the district, so the mark stays on burning and burnt tiles too;
      // it is drawn after flames and smoke, and its parchment fill reads on burnt ground.
      if (tile.district && evacuated.has(tile.district)) drawFootprint(ctx, px, py, ts);
    });
  }

  function paintLabels(ts) {
    if (ts < LABEL_MIN_TILE) return;
    const fs = Math.max(10, Math.round(ts * 0.42));
    for (const box of index.boxes) {
      if (!box.landmark.scored || !box.landmark.name) continue;
      const cx = ((box.minX + box.maxX + 1) * ts) / 2;
      const cy = (box.maxY + 1) * ts - fs * 0.6;
      drawLabel(ctx, String(box.landmark.name), cx, cy, fs);
    }
  }

  // The longest run of open Thames columns in the two bottom rows, east of the wind vane.
  function titleRun(scene) {
    let best = { start: 0, length: 0 };
    let start = -1;
    for (let x = 3; x <= cols; x += 1) {
      const open = x < cols && [rows - 2, rows - 1].every((y) => {
        const i = y * cols + x;
        const tile = scene.tiles[i];
        return tile && tile.type === 'river' && !hasLandmarkGlyph(landmarkOf(tile, i)?.kind);
      });
      if (open && start < 0) start = x;
      if (!open && start >= 0) {
        if (x - start > best.length) best = { start, length: x - start };
        start = -1;
      }
    }
    return best;
  }

  function paintCartouches(scene, ts) {
    const bandMid = (rows - 1) * ts;
    drawWindVane(ctx, scene.wind, 2 * ts, bandMid, Math.max(8, ts * 0.66));
    const run = titleRun(scene);
    if (run.length < 4) return;
    const fs = Math.max(9, Math.round(ts * 0.6));
    drawTitle(ctx, TITLE, (run.start + run.length / 2) * ts, bandMid, fs, run.length * ts - ts * 0.6);
  }

  function sparkPoint(spark, u, ts) {
    const x0 = (spark.from.x + 0.5) * ts;
    const y0 = (spark.from.y + 0.5) * ts;
    const x2 = (spark.to.x + 0.5) * ts;
    const y2 = (spark.to.y + 0.5) * ts;
    const cx = (x0 + x2) / 2 + spark.sway * ts * 0.3;
    const cy = (y0 + y2) / 2 - spark.lift * ts - Math.hypot(x2 - x0, y2 - y0) * 0.25;
    const v = 1 - u;
    return [v * v * x0 + 2 * v * u * cx + u * u * x2, v * v * y0 + 2 * v * u * cy + u * u * y2];
  }

  function paintAnimation(plan, t, ts) {
    for (const flash of plan.flashes) {
      if (t < flash.at) continue;
      drawFire(ctx, Math.max(1, flash.fire), flash.x * ts, flash.y * ts, ts, phase, flash.x, flash.y);
      const k = (t - flash.at) / 0.18;
      if (k < 1) drawFlash(ctx, (flash.x + 0.5) * ts, (flash.y + 0.5) * ts, ts * (0.3 + 0.5 * k), 0.85 * (1 - k));
    }
    const dark = clamp((t - 0.35) / 0.55, 0, 1);
    if (dark > 0) for (const tile of plan.burnouts) drawDarken(ctx, tile.x * ts, tile.y * ts, ts, 0.85 * dark);
    const r = Math.max(1.6, ts * 0.12);
    for (const spark of plan.sparks) {
      if (t < spark.start || t > spark.end) continue;
      const u = (t - spark.start) / (spark.end - spark.start);
      for (const [lag, size, alpha] of [[0.16, 0.45, 0.4], [0.08, 0.7, 0.7], [0, 1, 1]]) {
        if (u - lag < 0) continue;
        const [x, y] = sparkPoint(spark, u - lag, ts);
        drawSpark(ctx, x, y, r * size, alpha);
      }
    }
  }

  function paint(t = 0) {
    if (!ctx || destroyed) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = COLOURS.parchmentDark;
    ctx.fillRect(0, 0, cssW, cssH);
    const ts = layout.tileSize;
    const gridW = cols * ts;
    const gridH = rows * ts;
    drawMapFrame(ctx, layout.offsetX, layout.offsetY, gridW, gridH);
    const scene = anim ? anim.prev : state;
    if (!scene || !Array.isArray(scene.tiles)) return;
    paintBase(scene);
    ctx.save();
    ctx.translate(layout.offsetX, layout.offsetY);
    ctx.beginPath();
    ctx.rect(0, 0, gridW, gridH);
    ctx.clip();
    paintTents(scene, ts);
    if (isNight(scene.turn)) drawNight(ctx, gridW, gridH);
    paintStatus(scene, ts, visibleRange(ts));
    paintLabels(ts);
    paintCartouches(scene, ts);
    if (anim) paintAnimation(anim.plan, t, ts);
    if (selected) drawSelection(ctx, selected.x * ts, selected.y * ts, ts);
    ctx.restore();
  }

  // ----- flicker loop -----

  function stopFlicker() {
    if (flickerId !== null) cancelFrame(flickerId);
    flickerId = null;
  }

  function startFlicker() {
    if (destroyed || anim || flickerId !== null || !stateHasFire || !canAnimate()) return;
    const step = (now) => {
      flickerId = null;
      if (destroyed || anim || !stateHasFire) return;
      const time = Number(now) || 0;
      if (time - lastFlicker >= FLICKER_MS) {
        lastFlicker = time;
        phase = (time % FLICKER_CYCLE_MS) / FLICKER_CYCLE_MS;
        paint();
      }
      flickerId = requestFrame(step);
    };
    flickerId = requestFrame(step);
  }

  // ----- spread animation -----

  function inBounds(x, y) {
    return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < cols && y < rows;
  }

  // Embers fly from event.from, else from the nearest tile already burning before the
  // turn; ties go to the most upwind tile. With no fire anywhere there is no arc.
  function sparkSource(prev, event, wind) {
    if (event.from && inBounds(event.from.x, event.from.y)) return { x: event.from.x, y: event.from.y };
    const tiles = prev && Array.isArray(prev.tiles) ? prev.tiles : [];
    const wx = Number(wind && wind.dx) || 0;
    const wy = Number(wind && wind.dy) || 0;
    let best = null;
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const tile = tiles[y * cols + x];
        if (!tile || !(tile.fire > 0) || (x === event.x && y === event.y)) continue;
        const dx = event.x - x;
        const dy = event.y - y;
        const distance = dx * dx + dy * dy;
        const downwind = dx * wx + dy * wy;
        if (!best || distance < best.distance || (distance === best.distance && downwind > best.downwind)) {
          best = { x, y, distance, downwind };
        }
      }
    }
    return best ? { x: best.x, y: best.y } : null;
  }

  function planAnimation(prev, next, events) {
    const list = Array.isArray(events) ? events : [];
    const ignites = list.filter((event) => event && event.type === 'ignite' && inBounds(event.x, event.y));
    const burnouts = list
      .filter((event) => event && event.type === 'burnout' && inBounds(event.x, event.y))
      .map((event) => ({ x: event.x, y: event.y }));
    const sparks = [];
    const flashes = [];
    const n = ignites.length;
    ignites.forEach((event, i) => {
      const delay = n > 1 ? (i / (n - 1)) * 0.45 : 0.1;
      const tile = next.tiles[event.y * cols + event.x];
      flashes.push({ x: event.x, y: event.y, at: delay + 0.3, fire: tile ? tile.fire : 1 });
      const from = sparkSource(prev, event, next.wind);
      if (!from) return;
      const count = event.ember ? 3 : 1;
      for (let k = 0; k < count && sparks.length < MAX_SPARKS; k += 1) {
        sparks.push({
          from,
          to: { x: event.x, y: event.y },
          start: delay + k * 0.04,
          end: delay + 0.3 + k * 0.04,
          lift: event.ember ? 1.2 : 0.4,
          sway: k - (count - 1) / 2
        });
      }
    });
    return { duration: n > 24 ? 1100 : 900, sparks, flashes, burnouts };
  }

  function finishAnimation() {
    const running = anim;
    if (!running) return;
    anim = null;
    if (running.frameId !== null) cancelFrame(running.frameId);
    if (running.timer !== null) timerHost().clearTimeout(running.timer);
    state = running.next;
    stateHasFire = hasFire(state);
    if (!destroyed) {
      paint();
      startFlicker();
    }
    running.resolve(running.next);
  }

  function render(nextState, options = {}) {
    finishAnimation();
    state = nextState || null;
    stateHasFire = hasFire(state);
    if (options && Object.prototype.hasOwnProperty.call(options, 'selected')) {
      applySelection(options.selected ? normaliseTile(options.selected) : null);
    }
    paint();
    if (stateHasFire) startFlicker();
    else stopFlicker();
  }

  function animate(prevState, nextState, events) {
    finishAnimation();
    if (destroyed || !canAnimate() || !prevState || !nextState || !Array.isArray(nextState.tiles)) {
      if (!destroyed) render(nextState);
      return Promise.resolve(nextState);
    }
    const plan = planAnimation(prevState, nextState, events);
    if (!plan.flashes.length && !plan.burnouts.length) {
      render(nextState);
      return Promise.resolve(nextState);
    }
    stopFlicker();
    return new Promise((resolve) => {
      const running = { prev: prevState, next: nextState, plan, start: null, resolve, frameId: null, timer: null };
      anim = running;
      const step = (now) => {
        if (anim !== running) return;
        const time = Number(now) || 0;
        if (running.start === null) running.start = time;
        const t = (time - running.start) / plan.duration;
        if (t >= 1) {
          finishAnimation();
          return;
        }
        phase = (time % FLICKER_CYCLE_MS) / FLICKER_CYCLE_MS;
        paint(t);
        running.frameId = requestFrame(step);
      };
      running.frameId = requestFrame(step);
      running.timer = timerHost().setTimeout(() => {
        if (anim === running) finishAnimation();
      }, plan.duration + 600);
    });
  }

  // ----- input -----

  function onPointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== undefined && event.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    pointer = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      offsetX: layout.offsetX,
      offsetY: layout.offsetY,
      dragging: false
    };
    if (typeof canvas.setPointerCapture === 'function' && event.pointerId !== undefined) {
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Capture is a nicety; dragging still works without it.
      }
    }
  }

  function onPointerMove(event) {
    if (!pointer || event.pointerId !== pointer.id) return;
    const dx = event.clientX - pointer.startX;
    const dy = event.clientY - pointer.startY;
    if (!pointer.dragging && Math.hypot(dx, dy) > TAP_THRESHOLD) pointer.dragging = true;
    if (pointer.dragging && zoom === 2) {
      panTo(pointer.offsetX + dx, pointer.offsetY + dy);
      if (typeof event.preventDefault === 'function') event.preventDefault();
      paint();
    }
  }

  function onPointerUp(event) {
    if (!pointer || event.pointerId !== pointer.id) return;
    const press = pointer;
    pointer = null;
    if (typeof canvas.releasePointerCapture === 'function' && event.pointerId !== undefined) {
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // Already released.
      }
    }
    const moved = Math.hypot(event.clientX - press.startX, event.clientY - press.startY);
    if (press.dragging || moved > TAP_THRESHOLD) return;
    const tile = pointToTile(event.clientX - press.left, event.clientY - press.top, layout, cols, rows);
    if (tile) choose(tile);
  }

  function onPointerCancel() {
    pointer = null;
  }

  function onKeyDown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const step = KEY_STEPS[event.key];
    if (step) {
      event.preventDefault();
      const from = selected || startingTile();
      const move = selected ? step : [0, 0];
      const tile = { x: clamp(from.x + move[0], 0, cols - 1), y: clamp(from.y + move[1], 0, rows - 1) };
      if (!selected || tile.x !== selected.x || tile.y !== selected.y) choose(tile);
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') && selected) {
      event.preventDefault();
      if (typeof onSelect === 'function') onSelect(selected.x, selected.y);
    }
  }

  function listen(type, handler) {
    canvas.addEventListener(type, handler);
    listeners.push([type, handler]);
  }

  // ----- public view -----

  function resize() {
    const rect = typeof canvas.getBoundingClientRect === 'function' ? canvas.getBoundingClientRect() : null;
    cssW = Math.max(0, Number(rect && rect.width) || 0);
    cssH = Math.max(0, Number(rect && rect.height) || 0);
    const measured = Number(win.devicePixelRatio);
    dpr = Number.isFinite(measured) && measured > 0 ? measured : 1;
    const cssArea = cssW * cssH;
    if (cssArea * dpr * dpr > MAX_BACKING_PIXELS) dpr = Math.sqrt(MAX_BACKING_PIXELS / cssArea);
    const backingW = Math.max(1, Math.round(cssW * dpr));
    const backingH = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== backingW) canvas.width = backingW;
    if (canvas.height !== backingH) canvas.height = backingH;
    relayout();
    paint();
  }

  function setSelected(x, y) {
    applySelection(x === null || x === undefined ? null : normaliseTile(x, y));
    paint();
  }

  function getSelected() {
    return selected ? { x: selected.x, y: selected.y } : null;
  }

  function setZoom(level) {
    zoom = level === 2 ? 2 : 1;
    if (canvas.style) canvas.style.touchAction = zoom === 2 ? 'none' : 'manipulation';
    relayout();
    paint();
  }

  function getZoom() {
    return zoom;
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    stopFlicker();
    finishAnimation();
    for (const [type, handler] of listeners) canvas.removeEventListener(type, handler);
    listeners.length = 0;
    pointer = null;
  }

  listen('pointerdown', onPointerDown);
  listen('pointermove', onPointerMove);
  listen('pointerup', onPointerUp);
  listen('pointercancel', onPointerCancel);
  listen('keydown', onKeyDown);
  if (canvas.style) canvas.style.touchAction = 'manipulation';
  updateAria();
  resize();

  return { render, animate, setSelected, getSelected, setZoom, getZoom, resize, destroy };
}
