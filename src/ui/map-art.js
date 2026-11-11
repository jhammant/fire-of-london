// Woodcut-style drawing primitives for the map. Only map-view.js imports this file.
// Every function draws in the context's current units (CSS pixels) and never reads
// properties back from the context, so a recording fake works in tests.

/** The shared serif font stack (no web fonts). */
export const SERIF = `'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, 'Times New Roman', serif`;

/** Map palette. Fire, firebreak, water and guard colours follow the colour-blind-safe set. */
export const COLOURS = Object.freeze({
  parchment: '#f3e7c9',
  parchmentDark: '#e4d3a8',
  ink: '#2b1d0e',
  inkSoft: '#5a4632',
  accent: '#8b2e16',
  fire1: '#f0e442',
  fire2: '#e69f00',
  fire3: '#d55e00',
  burnt: '#2e2a26',
  ash: '#a39c92',
  firebreak: '#0072b2',
  water: '#56b4e9',
  guard: '#009e73',
  river: '#93a9b4',
  riverDeep: '#5f7a89',
  timber: '#ecdcb6',
  roof: '#b98457',
  wood: '#a87443',
  stone: '#d3c9b6',
  stoneDark: '#a99d88',
  grass: '#d9d6a2',
  grassDark: '#7f8a45',
  wall: '#c2b49a',
  canvasCloth: '#faf3e1',
  smoke: '#9a958f',
  night: 'rgba(18, 24, 60, 0.16)'
});

const TAU = Math.PI * 2;
const FIRE_COLOURS = [COLOURS.fire1, COLOURS.fire2, COLOURS.fire3];

/** Returns a stable pseudo-random number in [0, 1) for a grid position and a salt. */
export function hash2(x, y, salt = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(salt | 0, 1442695041) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Returns an ink line width that suits a tile of size s. */
export function inkWidth(s) {
  return Math.max(0.6, s / 24);
}

function strokeLine(ctx, x0, y0, x1, y1) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function inkSetup(ctx, s, colour = COLOURS.ink) {
  ctx.lineWidth = inkWidth(s);
  ctx.strokeStyle = colour;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

// Parallel diagonal hatching inside a rectangle, or inside a traced path when given.
function hatch(ctx, x, y, w, h, { gap, dir = 1, width, colour = COLOURS.ink, trace = null }) {
  const step = Math.max(1, gap);
  ctx.save();
  ctx.beginPath();
  if (trace) trace();
  else ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.lineWidth = width;
  ctx.strokeStyle = colour;
  ctx.beginPath();
  for (let k = -h; k < w + h; k += step) {
    if (dir > 0) {
      ctx.moveTo(x + k, y + h);
      ctx.lineTo(x + k + h, y);
    } else {
      ctx.moveTo(x + k, y);
      ctx.lineTo(x + k + h, y + h);
    }
  }
  ctx.stroke();
  ctx.restore();
}

function grain(ctx, px, py, s, tx, ty) {
  const dot = Math.max(0.6, s / 22);
  ctx.save();
  ctx.fillStyle = COLOURS.inkSoft;
  ctx.globalAlpha = 0.13;
  for (let k = 0; k < 4; k += 1) {
    const gx = px + hash2(tx, ty, k * 2 + 1) * (s - dot);
    const gy = py + hash2(tx, ty, k * 2 + 2) * (s - dot);
    ctx.fillRect(gx, gy, dot, dot);
  }
  ctx.restore();
}

const GROUND = {
  house: COLOURS.parchment,
  warehouse: COLOURS.parchmentDark,
  stone: COLOURS.parchment,
  open: COLOURS.grass,
  river: COLOURS.river,
  wall: COLOURS.parchmentDark
};

/** Paints the ground of one tile with a stable paper grain. */
export function drawGround(ctx, type, px, py, s, tx, ty) {
  ctx.fillStyle = GROUND[type] || COLOURS.parchment;
  ctx.fillRect(px, py, s, s);
  if (type !== 'river') grain(ctx, px, py, s, tx, ty);
}

function gable(ctx, x, baseY, w, bodyH, roofH, s) {
  const top = baseY - bodyH;
  ctx.fillStyle = COLOURS.timber;
  ctx.fillRect(x, top, w, bodyH);
  ctx.strokeRect(x, top, w, bodyH);
  if (s >= 20) strokeLine(ctx, x + w / 2, top + bodyH * 0.25, x + w / 2, baseY);
  const left = x - w * 0.08;
  const right = x + w * 1.08;
  const apexX = x + w / 2;
  const apexY = top - roofH;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(apexX, apexY);
  ctx.lineTo(right, top);
  ctx.closePath();
  ctx.fillStyle = COLOURS.roof;
  ctx.fill();
  ctx.stroke();
  hatch(ctx, apexX, apexY, right - apexX, roofH, {
    gap: Math.max(1.4, s / 9),
    width: inkWidth(s) * 0.6,
    trace: () => {
      ctx.moveTo(apexX, apexY);
      ctx.lineTo(right, top);
      ctx.lineTo(apexX, top);
      ctx.closePath();
    }
  });
}

function drawHouses(ctx, px, py, s, tx, ty) {
  const n = s < 18 ? 2 : 3;
  const slot = (s * 0.86) / n;
  const w = slot * 0.88;
  const rowBase = [py + s * 0.56, py + s * 0.93];
  for (let row = 0; row < 2; row += 1) {
    const count = row === 0 ? n - 1 : n;
    const shift = row === 0 ? slot / 2 : 0;
    for (let i = 0; i < count; i += 1) {
      const jitter = (hash2(tx, ty, row * 5 + i) - 0.5) * s * 0.06;
      const bodyH = s * (0.15 + 0.07 * hash2(tx, ty, 11 + i + row * 3));
      gable(ctx, px + s * 0.07 + shift + i * slot + jitter, rowBase[row], w, bodyH, s * 0.2, s);
    }
  }
}

function barrel(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 1.25, 0, 0, TAU);
  ctx.fillStyle = COLOURS.wood;
  ctx.fill();
  ctx.stroke();
  strokeLine(ctx, cx - r * 0.92, cy - r * 0.5, cx + r * 0.92, cy - r * 0.5);
  strokeLine(ctx, cx - r * 0.92, cy + r * 0.5, cx + r * 0.92, cy + r * 0.5);
}

function drawWarehouse(ctx, px, py, s, tx, ty) {
  const quayY = py + s * 0.8;
  ctx.fillStyle = COLOURS.stoneDark;
  ctx.fillRect(px, quayY, s, s * 0.2);
  strokeLine(ctx, px, quayY, px + s, quayY);
  for (let k = 1; k < 4; k += 1) strokeLine(ctx, px + (k * s) / 4, quayY, px + (k * s) / 4, py + s);
  const c = s * 0.3;
  const cx = px + s * (0.08 + 0.06 * hash2(tx, ty, 1));
  ctx.fillStyle = COLOURS.timber;
  for (let k = 0; k < (s >= 14 ? 2 : 1); k += 1) {
    const cy = quayY - c * (k + 1);
    const ox = cx + k * c * 0.15;
    ctx.fillRect(ox, cy, c, c);
    ctx.strokeRect(ox, cy, c, c);
    strokeLine(ctx, ox, cy, ox + c, cy + c);
    strokeLine(ctx, ox + c, cy, ox, cy + c);
  }
  const r = s * 0.11;
  barrel(ctx, px + s * 0.58, quayY - r * 1.3, r);
  barrel(ctx, px + s * 0.83, quayY - r * 1.3, r);
  if (s >= 14) barrel(ctx, px + s * 0.705, quayY - r * 3.8, r);
}

function merlons(ctx, x, y, w, h, count, fill) {
  const step = w / (count * 2 - 1);
  ctx.fillStyle = fill;
  for (let k = 0; k < count; k += 1) {
    const mx = x + k * 2 * step;
    ctx.fillRect(mx, y - h, step, h);
    ctx.strokeRect(mx, y - h, step, h);
  }
}

function archWindow(ctx, cx, bottom, height, width, fill = COLOURS.inkSoft) {
  const r = width / 2;
  ctx.beginPath();
  ctx.moveTo(cx - r, bottom);
  ctx.lineTo(cx - r, bottom - height + r);
  ctx.arc(cx, bottom - height + r, r, Math.PI, 0);
  ctx.lineTo(cx + r, bottom);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawChurch(ctx, px, py, s) {
  const base = py + s * 0.88;
  const nx = px + s * 0.36;
  const nw = s * 0.52;
  const nh = s * 0.26;
  ctx.fillStyle = COLOURS.stone;
  ctx.fillRect(nx, base - nh, nw, nh);
  ctx.strokeRect(nx, base - nh, nw, nh);
  ctx.beginPath();
  ctx.moveTo(nx, base - nh);
  ctx.lineTo(nx + s * 0.07, base - nh - s * 0.13);
  ctx.lineTo(nx + nw - s * 0.07, base - nh - s * 0.13);
  ctx.lineTo(nx + nw, base - nh);
  ctx.closePath();
  ctx.fillStyle = COLOURS.stoneDark;
  ctx.fill();
  ctx.stroke();
  hatch(ctx, nx, base - nh * 0.45, nw, nh * 0.45, { gap: Math.max(1.4, s / 10), width: inkWidth(s) * 0.6 });
  const tx0 = px + s * 0.13;
  const tw = s * 0.23;
  const th = s * 0.6;
  ctx.fillStyle = COLOURS.stone;
  ctx.fillRect(tx0, base - th, tw, th);
  ctx.strokeRect(tx0, base - th, tw, th);
  merlons(ctx, tx0, base - th, tw, s * 0.06, 3, COLOURS.stone);
  if (s >= 16) archWindow(ctx, tx0 + tw / 2, base - th * 0.45, th * 0.25, tw * 0.36);
}

function drawGrass(ctx, px, py, s, tx, ty) {
  ctx.strokeStyle = COLOURS.grassDark;
  for (let k = 0; k < 4; k += 1) {
    const gx = px + s * (0.15 + 0.7 * hash2(tx, ty, k + 20));
    const gy = py + s * (0.3 + 0.6 * hash2(tx, ty, k + 30));
    const h = s * 0.14;
    ctx.beginPath();
    ctx.moveTo(gx - h * 0.6, gy - h);
    ctx.lineTo(gx, gy);
    ctx.lineTo(gx, gy - h * 1.2);
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + h * 0.6, gy - h);
    ctx.stroke();
  }
}

function wave(ctx, x, y, len, amp) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + len * 0.25, y - amp, x + len * 0.5, y);
  ctx.quadraticCurveTo(x + len * 0.75, y + amp, x + len, y);
  ctx.stroke();
}

function drawWater(ctx, px, py, s, tx, ty) {
  ctx.strokeStyle = COLOURS.riverDeep;
  for (let r = 0; r < 2; r += 1) {
    const wy = py + s * (0.3 + 0.42 * r) + (hash2(tx, ty, r + 40) - 0.5) * s * 0.1;
    const wx = px + s * (0.08 + 0.4 * hash2(tx, ty, r + 50));
    wave(ctx, wx, wy, s * 0.45, s * 0.07);
  }
}

function drawWallTile(ctx, px, py, s) {
  const top = py + s * 0.12;
  ctx.fillStyle = COLOURS.wall;
  ctx.fillRect(px, top, s, s - s * 0.12);
  merlons(ctx, px + s * 0.04, top, s * 0.92, s * 0.1, 3, COLOURS.wall);
  strokeLine(ctx, px, top, px + s, top);
  ctx.save();
  ctx.lineWidth = inkWidth(s) * 0.6;
  for (let k = 1; k < 3; k += 1) {
    const cy = top + ((s - s * 0.12) * k) / 3;
    strokeLine(ctx, px, cy, px + s, cy);
  }
  const rowH = (s - s * 0.12) / 3;
  for (let row = 0; row < 3; row += 1) {
    const offset = row % 2 === 0 ? 0.33 : 0.66;
    const jx = px + s * offset;
    strokeLine(ctx, jx, top + rowH * row, jx, top + rowH * (row + 1));
  }
  ctx.restore();
}

const TILE_GLYPHS = {
  house: drawHouses,
  warehouse: drawWarehouse,
  stone: drawChurch,
  open: drawGrass,
  river: drawWater,
  wall: drawWallTile
};

/** Draws the woodcut glyph for a tile type: houses, warehouses, church, grass, water or wall. */
export function drawTileGlyph(ctx, type, px, py, s, tx, ty) {
  const glyph = TILE_GLYPHS[type];
  if (!glyph) return;
  ctx.save();
  inkSetup(ctx, s);
  glyph(ctx, px, py, s, tx, ty);
  ctx.restore();
}

/** Draws a small boat with a sail on a river tile. */
export function drawBoat(ctx, px, py, s, tx, ty) {
  const cx = px + s * (0.3 + 0.4 * hash2(tx, ty, 91));
  const cy = py + s * 0.62;
  const len = s * 0.5;
  ctx.save();
  inkSetup(ctx, s);
  ctx.beginPath();
  ctx.moveTo(cx - len / 2, cy);
  ctx.lineTo(cx + len / 2, cy);
  ctx.quadraticCurveTo(cx + len * 0.3, cy + s * 0.16, cx - len * 0.3, cy + s * 0.14);
  ctx.closePath();
  ctx.fillStyle = COLOURS.wood;
  ctx.fill();
  ctx.stroke();
  strokeLine(ctx, cx, cy, cx, cy - s * 0.4);
  ctx.beginPath();
  ctx.moveTo(cx + inkWidth(s), cy - s * 0.38);
  ctx.lineTo(cx + s * 0.22, cy - s * 0.08);
  ctx.lineTo(cx + inkWidth(s), cy - s * 0.08);
  ctx.closePath();
  ctx.fillStyle = COLOURS.canvasCloth;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// Old St Paul's in 1666: a long nave and a square central tower. Lightning destroyed
// the spire in 1561 and it was never rebuilt, so no spire is drawn.
function drawCathedral(ctx, r, s) {
  const baseY = r.y + r.h * 0.86;
  const naveH = Math.min(r.h * 0.32, s * 0.7);
  const roofH = naveH * 0.5;
  const nx = r.x + r.w * 0.05;
  const nw = r.w * 0.9;
  ctx.fillStyle = COLOURS.stone;
  ctx.fillRect(nx, baseY - naveH, nw, naveH);
  ctx.strokeRect(nx, baseY - naveH, nw, naveH);
  ctx.beginPath();
  ctx.moveTo(nx, baseY - naveH);
  ctx.lineTo(nx + roofH, baseY - naveH - roofH);
  ctx.lineTo(nx + nw - roofH, baseY - naveH - roofH);
  ctx.lineTo(nx + nw, baseY - naveH);
  ctx.closePath();
  ctx.fillStyle = COLOURS.stoneDark;
  ctx.fill();
  ctx.stroke();
  const count = Math.max(3, Math.floor(nw / (s * 0.34)));
  for (let k = 0; k < count; k += 1) {
    archWindow(ctx, nx + ((k + 0.5) * nw) / count, baseY - naveH * 0.18, naveH * 0.55, (nw / count) * 0.3);
  }
  hatch(ctx, nx, baseY - naveH * 0.25, nw, naveH * 0.25, { gap: Math.max(1.5, s / 9), width: inkWidth(s) * 0.6 });
  const cx = r.x + r.w * 0.45;
  const tw = Math.min(r.w * 0.17, s * 0.9);
  const tTop = Math.max(r.y + s * 0.08, baseY - naveH - roofH - Math.min(r.h * 0.5, s * 1.1) * 0.6);
  const tBottom = baseY - naveH;
  ctx.fillStyle = COLOURS.stone;
  ctx.fillRect(cx - tw / 2, tTop, tw, tBottom - tTop);
  ctx.strokeRect(cx - tw / 2, tTop, tw, tBottom - tTop);
  hatch(ctx, cx, tTop, tw / 2, tBottom - tTop, { gap: Math.max(1.5, s / 9), width: inkWidth(s) * 0.6 });
  merlons(ctx, cx - tw / 2, tTop, tw, s * 0.06, 4, COLOURS.stone);
  for (const side of [-1, 1]) {
    const pxn = cx + (side * tw) / 2;
    strokeLine(ctx, pxn, tTop, pxn, tTop - s * 0.14);
  }
  archWindow(ctx, cx, tTop + (tBottom - tTop) * 0.7, (tBottom - tTop) * 0.45, tw * 0.3);
  const doorH = naveH * 0.5;
  archWindow(ctx, nx + nw * 0.04 + doorH * 0.3, baseY, doorH, doorH * 0.5, COLOURS.ink);
}

// The White Tower: a square keep with a turret on each of its four corners, in a walled bailey.
function drawFortress(ctx, r, s) {
  const inset = Math.min(r.w, r.h) * 0.06;
  ctx.fillStyle = COLOURS.parchmentDark;
  ctx.fillRect(r.x + inset, r.y + inset, r.w - inset * 2, r.h - inset * 2);
  ctx.save();
  ctx.lineWidth = inkWidth(s) * 2.2;
  ctx.strokeRect(r.x + inset, r.y + inset, r.w - inset * 2, r.h - inset * 2);
  ctx.restore();
  const k = Math.min(r.w, r.h) * 0.5;
  const d = k * 0.22;
  const kx = r.x + (r.w - k - d) / 2;
  const ky = r.y + (r.h - k) / 2 + d * 0.6;
  const corners = [[kx + d, ky], [kx + k + d, ky], [kx, ky + d], [kx + k, ky + d]];
  const turret = (tx, ty, size) => {
    ctx.fillStyle = COLOURS.stone;
    ctx.fillRect(tx - size / 2, ty - size * 1.1, size, size * 1.1);
    ctx.strokeRect(tx - size / 2, ty - size * 1.1, size, size * 1.1);
    ctx.beginPath();
    ctx.arc(tx, ty - size * 1.1, size / 2, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = COLOURS.stoneDark;
    ctx.fill();
    ctx.stroke();
  };
  const tSize = Math.max(2, k * 0.2);
  turret(corners[0][0], corners[0][1], tSize * 0.85);
  turret(corners[1][0], corners[1][1], tSize * 0.85);
  ctx.beginPath();
  ctx.moveTo(kx, ky + d);
  ctx.lineTo(kx + d, ky);
  ctx.lineTo(kx + k + d, ky);
  ctx.lineTo(kx + k, ky + d);
  ctx.closePath();
  ctx.fillStyle = COLOURS.stoneDark;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLOURS.stone;
  ctx.fillRect(kx, ky + d, k, k * 0.8);
  ctx.strokeRect(kx, ky + d, k, k * 0.8);
  hatch(ctx, kx + k * 0.62, ky + d, k * 0.38, k * 0.8, { gap: Math.max(1.5, s / 9), width: inkWidth(s) * 0.6 });
  for (let i = 0; i < 3; i += 1) {
    archWindow(ctx, kx + (k * (i + 1)) / 4, ky + d + k * 0.5, k * 0.24, k * 0.08);
  }
  turret(corners[2][0], corners[2][1], tSize);
  turret(corners[3][0], corners[3][1], tSize);
}

// Old London Bridge: stone arches on boat-shaped piers, with houses along the roadway.
function drawBridge(ctx, r, s) {
  const vertical = r.h >= r.w;
  const along = vertical ? r.h : r.w;
  const across = vertical ? r.w : r.h;
  const deck = Math.min(across * 0.7, s * 0.72);
  const start = (across - deck) / 2;
  const piers = Math.max(2, Math.round(along / (s * 0.45)));
  const toXY = (a, c) => (vertical ? [r.x + c, r.y + a] : [r.x + a, r.y + c]);
  ctx.fillStyle = COLOURS.stoneDark;
  for (let k = 0; k < piers; k += 1) {
    const a = ((k + 0.5) * along) / piers;
    const len = (along / piers) * 0.32;
    for (const [edge, out] of [[start, -1], [start + deck, 1]]) {
      const p0 = toXY(a - len, edge);
      const p1 = toXY(a, edge + out * s * 0.16);
      const p2 = toXY(a + len, edge);
      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]);
      ctx.lineTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  const [dx, dy] = toXY(0, start);
  const dw = vertical ? deck : along;
  const dh = vertical ? along : deck;
  ctx.fillStyle = COLOURS.stone;
  ctx.fillRect(dx, dy, dw, dh);
  ctx.strokeRect(dx, dy, dw, dh);
  const houses = Math.max(2, Math.floor(along / (s * 0.42)));
  const gap = Math.floor(houses / 2);
  for (let k = 0; k < houses; k += 1) {
    if (k === gap && houses > 3) continue;
    const a = (k * along) / houses;
    const size = along / houses;
    if (vertical) gable(ctx, dx + deck * 0.14, r.y + a + size * 0.92, deck * 0.72, size * 0.4, size * 0.3, s);
    else gable(ctx, r.x + a + size * 0.1, dy + deck * 0.92, size * 0.8, deck * 0.4, deck * 0.3, s);
  }
}

// The Royal Exchange: a building round an open courtyard, with a tall bell tower.
function drawExchange(ctx, r, s) {
  const x0 = r.x + r.w * 0.08;
  const y0 = r.y + r.h * 0.3;
  const w0 = r.w * 0.84;
  const h0 = r.h * 0.62;
  ctx.fillStyle = COLOURS.stone;
  ctx.fillRect(x0, y0, w0, h0);
  ctx.strokeRect(x0, y0, w0, h0);
  const cw = w0 * 0.5;
  const ch = h0 * 0.46;
  ctx.fillStyle = COLOURS.parchment;
  ctx.fillRect(x0 + (w0 - cw) / 2, y0 + (h0 - ch) / 2, cw, ch);
  ctx.strokeRect(x0 + (w0 - cw) / 2, y0 + (h0 - ch) / 2, cw, ch);
  hatch(ctx, x0, y0 + h0 * 0.78, w0, h0 * 0.22, { gap: Math.max(1.5, s / 9), width: inkWidth(s) * 0.6 });
  const tw = Math.max(s * 0.2, w0 * 0.14);
  const tx = x0 + w0 * 0.5 - tw / 2;
  const capTop = r.y + r.h * 0.03;
  const bodyTop = capTop + tw * 0.9;
  const bodyBottom = y0 + (h0 - ch) / 2;
  ctx.fillStyle = COLOURS.stone;
  ctx.fillRect(tx, bodyTop, tw, bodyBottom - bodyTop);
  ctx.strokeRect(tx, bodyTop, tw, bodyBottom - bodyTop);
  ctx.beginPath();
  ctx.moveTo(tx - tw * 0.1, bodyTop);
  ctx.lineTo(tx + tw / 2, capTop);
  ctx.lineTo(tx + tw * 1.1, bodyTop);
  ctx.closePath();
  ctx.fillStyle = COLOURS.stoneDark;
  ctx.fill();
  ctx.stroke();
  archWindow(ctx, tx + tw / 2, bodyTop + tw * 0.9, tw * 0.6, tw * 0.44);
  ctx.beginPath();
  ctx.arc(tx + tw / 2, bodyTop + tw * 0.55, tw * 0.14, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = COLOURS.fire2;
  ctx.fill();
  ctx.stroke();
}

// Guildhall: a long hall with a row of tall windows and a porch.
function drawHall(ctx, r, s) {
  const x0 = r.x + r.w * 0.06;
  const w0 = r.w * 0.88;
  const base = r.y + r.h * 0.9;
  const bodyH = Math.min(r.h * 0.45, s * 0.8);
  const roofH = bodyH * 0.5;
  ctx.fillStyle = COLOURS.stone;
  ctx.fillRect(x0, base - bodyH, w0, bodyH);
  ctx.strokeRect(x0, base - bodyH, w0, bodyH);
  ctx.beginPath();
  ctx.moveTo(x0, base - bodyH);
  ctx.lineTo(x0 + roofH * 0.6, base - bodyH - roofH);
  ctx.lineTo(x0 + w0 - roofH * 0.6, base - bodyH - roofH);
  ctx.lineTo(x0 + w0, base - bodyH);
  ctx.closePath();
  ctx.fillStyle = COLOURS.stoneDark;
  ctx.fill();
  ctx.stroke();
  hatch(ctx, x0, base - bodyH - roofH, w0, roofH, {
    gap: Math.max(1.5, s / 8),
    width: inkWidth(s) * 0.6,
    trace: () => ctx.rect(x0 + w0 / 2, base - bodyH - roofH, w0 / 2, roofH)
  });
  const count = Math.max(3, Math.floor(w0 / (s * 0.28)));
  for (let k = 0; k < count; k += 1) {
    archWindow(ctx, x0 + ((k + 0.5) * w0) / count, base - bodyH * 0.18, bodyH * 0.62, (w0 / count) * 0.32);
  }
  const pw = w0 * 0.18;
  const px = x0 + (w0 - pw) / 2;
  ctx.fillStyle = COLOURS.stone;
  ctx.fillRect(px, base - bodyH * 0.72, pw, bodyH * 0.72);
  ctx.strokeRect(px, base - bodyH * 0.72, pw, bodyH * 0.72);
  archWindow(ctx, px + pw / 2, base, bodyH * 0.5, pw * 0.5, COLOURS.ink);
  for (const ex of [x0, x0 + w0]) strokeLine(ctx, ex, base - bodyH, ex, base - bodyH - roofH * 1.2);
}

// Baynard's Castle: a crenellated riverside palace with towers, its feet in the Thames.
function drawCastle(ctx, r, s) {
  const waterY = r.y + r.h * 0.8;
  ctx.fillStyle = COLOURS.river;
  ctx.fillRect(r.x, waterY, r.w, r.y + r.h - waterY);
  ctx.save();
  ctx.strokeStyle = COLOURS.riverDeep;
  wave(ctx, r.x + r.w * 0.1, waterY + (r.y + r.h - waterY) * 0.55, r.w * 0.35, s * 0.05);
  wave(ctx, r.x + r.w * 0.55, waterY + (r.y + r.h - waterY) * 0.55, r.w * 0.35, s * 0.05);
  ctx.restore();
  const x0 = r.x + r.w * 0.08;
  const w0 = r.w * 0.84;
  const bodyTop = r.y + r.h * 0.42;
  ctx.fillStyle = COLOURS.stone;
  ctx.fillRect(x0, bodyTop, w0, waterY - bodyTop);
  ctx.strokeRect(x0, bodyTop, w0, waterY - bodyTop);
  merlons(ctx, x0, bodyTop, w0, s * 0.07, Math.max(3, Math.round(w0 / (s * 0.2))), COLOURS.stone);
  hatch(ctx, x0, bodyTop + (waterY - bodyTop) * 0.6, w0, (waterY - bodyTop) * 0.4, {
    gap: Math.max(1.5, s / 9),
    width: inkWidth(s) * 0.6
  });
  const towers = Math.max(2, Math.min(4, Math.round(r.w / s) + 1));
  const tw = Math.min(s * 0.3, w0 / (towers * 1.6));
  const tTop = r.y + r.h * 0.14;
  for (let k = 0; k < towers; k += 1) {
    const cx = x0 + (w0 * k) / (towers - 1);
    ctx.fillStyle = COLOURS.stone;
    ctx.fillRect(cx - tw / 2, tTop, tw, waterY - tTop);
    ctx.strokeRect(cx - tw / 2, tTop, tw, waterY - tTop);
    merlons(ctx, cx - tw / 2, tTop, tw, s * 0.06, 2, COLOURS.stone);
    archWindow(ctx, cx, tTop + (waterY - tTop) * 0.4, (waterY - tTop) * 0.2, tw * 0.3);
  }
}

// A city gate: a gatehouse with an arch through the wall.
function drawGate(ctx, r, s) {
  const inset = r.w * 0.1;
  const top = r.y + r.h * 0.16;
  ctx.fillStyle = COLOURS.stone;
  ctx.fillRect(r.x + inset, top, r.w - inset * 2, r.y + r.h - top);
  ctx.strokeRect(r.x + inset, top, r.w - inset * 2, r.y + r.h - top);
  merlons(ctx, r.x + inset, top, r.w - inset * 2, s * 0.1, 3, COLOURS.stone);
  archWindow(ctx, r.x + r.w / 2, r.y + r.h, r.h * 0.5, r.w * 0.38, COLOURS.ink);
}

const LANDMARK_GLYPHS = {
  cathedral: drawCathedral,
  fortress: drawFortress,
  bridge: drawBridge,
  exchange: drawExchange,
  hall: drawHall,
  castle: drawCastle,
  gate: drawGate
};

/** Reports whether a landmark kind has its own glyph that replaces the tile glyphs beneath it. */
export function hasLandmarkGlyph(kind) {
  return Object.prototype.hasOwnProperty.call(LANDMARK_GLYPHS, kind);
}

/** Draws a landmark glyph by kind across the rectangle r = { x, y, w, h }. */
export function drawLandmark(ctx, kind, r, s) {
  const glyph = LANDMARK_GLYPHS[kind];
  if (!glyph) return;
  ctx.save();
  inkSetup(ctx, s);
  glyph(ctx, r, s);
  ctx.restore();
}

/** Draws the small hanging bakery sign used at Pudding Lane. */
export function drawBakerySign(ctx, px, py, s) {
  ctx.save();
  inkSetup(ctx, s);
  ctx.lineWidth = inkWidth(s) * 1.3;
  strokeLine(ctx, px + s * 0.1, py + s * 0.08, px + s * 0.1, py + s * 0.3);
  strokeLine(ctx, px + s * 0.1, py + s * 0.12, px + s * 0.66, py + s * 0.12);
  ctx.lineWidth = inkWidth(s);
  strokeLine(ctx, px + s * 0.28, py + s * 0.12, px + s * 0.28, py + s * 0.2);
  strokeLine(ctx, px + s * 0.6, py + s * 0.12, px + s * 0.6, py + s * 0.2);
  const bx = px + s * 0.22;
  const by = py + s * 0.2;
  const bw = s * 0.44;
  const bh = s * 0.24;
  ctx.fillStyle = COLOURS.parchment;
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = COLOURS.accent;
  ctx.lineWidth = inkWidth(s) * 1.4;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.beginPath();
  ctx.ellipse(bx + bw / 2, by + bh / 2, bw * 0.3, bh * 0.28, 0, 0, TAU);
  ctx.fillStyle = COLOURS.roof;
  ctx.fill();
  ctx.strokeStyle = COLOURS.ink;
  ctx.lineWidth = inkWidth(s) * 0.8;
  ctx.stroke();
  for (const f of [-0.12, 0.04]) {
    strokeLine(ctx, bx + bw * (0.5 + f), by + bh * 0.32, bx + bw * (0.58 + f), by + bh * 0.68);
  }
  ctx.restore();
}

/** Draws dotted ink lines along district borders; segments are [x0, y0, x1, y1]. */
export function drawDistrictEdges(ctx, segments, s) {
  if (!segments.length) return;
  ctx.save();
  ctx.strokeStyle = COLOURS.inkSoft;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(0.6, s / 28);
  ctx.setLineDash([Math.max(1, s / 10), Math.max(1.5, s / 8)]);
  ctx.beginPath();
  for (const [x0, y0, x1, y1] of segments) {
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
  }
  ctx.stroke();
  ctx.restore();
}

/** Draws a burnt tile: near-black ground with crossed ash hatching. */
export function drawBurnt(ctx, px, py, s) {
  ctx.save();
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = COLOURS.burnt;
  ctx.fillRect(px, py, s, s);
  ctx.globalAlpha = 1;
  const style = { gap: Math.max(2.5, s / 4), width: inkWidth(s) * 0.8, colour: COLOURS.ash };
  hatch(ctx, px, py, s, s, { ...style, dir: 1 });
  hatch(ctx, px, py, s, s, { ...style, dir: -1 });
  ctx.restore();
}

/** Draws a cleared firebreak: bare ground, diagonal blue hatching and a dashed outline. */
export function drawFirebreak(ctx, px, py, s, tx = 0, ty = 0) {
  ctx.save();
  ctx.fillStyle = COLOURS.parchmentDark;
  ctx.fillRect(px, py, s, s);
  ctx.fillStyle = COLOURS.inkSoft;
  const rubble = Math.max(1, s / 12);
  for (let k = 0; k < 3; k += 1) {
    ctx.fillRect(px + hash2(tx, ty, k + 80) * (s - rubble), py + hash2(tx, ty, k + 85) * (s - rubble), rubble, rubble * 0.7);
  }
  hatch(ctx, px, py, s, s, { gap: Math.max(2.5, s / 5), width: inkWidth(s) * 1.1, colour: COLOURS.firebreak, dir: 1 });
  const inset = inkWidth(s) * 1.2;
  ctx.strokeStyle = COLOURS.firebreak;
  ctx.lineWidth = inkWidth(s) * 1.3;
  ctx.setLineDash([Math.max(1.5, s / 6), Math.max(1, s / 10)]);
  ctx.strokeRect(px + inset, py + inset, s - inset * 2, s - inset * 2);
  ctx.setLineDash([]);
  ctx.restore();
}

function flameTongue(ctx, cx, baseY, w, h, sway) {
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, baseY);
  ctx.quadraticCurveTo(cx - w * 0.62, baseY - h * 0.55, cx + sway, baseY - h);
  ctx.quadraticCurveTo(cx + w * 0.62, baseY - h * 0.5, cx + w / 2, baseY);
  ctx.closePath();
}

/** Draws fire level 1-3 as one, two or three inked flame tongues in that level's colour. */
export function drawFire(ctx, level, px, py, s, phase = 0, tx = 0, ty = 0) {
  const lvl = Math.min(3, Math.max(0, Math.round(level)));
  if (lvl < 1) return;
  const colour = FIRE_COLOURS[lvl - 1];
  ctx.save();
  ctx.globalAlpha = 0.16 + 0.1 * lvl;
  ctx.fillStyle = colour;
  ctx.fillRect(px, py, s, s);
  ctx.globalAlpha = 1;
  inkSetup(ctx, s);
  const w = s * (lvl === 1 ? 0.36 : 0.29);
  for (let i = 0; i < lvl; i += 1) {
    const cx = px + (s * (i + 1)) / (lvl + 1);
    const wobble = Math.sin((phase + hash2(tx, ty, i + 3)) * TAU + i * 2.1);
    const h = s * (0.42 + 0.12 * lvl) * (0.92 + 0.08 * wobble);
    flameTongue(ctx, cx, py + s * 0.9, w, h, s * 0.06 * wobble);
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.stroke();
    if (lvl > 1) {
      flameTongue(ctx, cx, py + s * 0.9, w * 0.45, h * 0.5, s * 0.03 * wobble);
      ctx.fillStyle = COLOURS.fire1;
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Draws grey smoke puffs drifting downwind (dx, dy) above a burning tile. */
export function drawSmoke(ctx, level, px, py, s, dx, dy, phase = 0, tx = 0, ty = 0) {
  const n = Math.min(3, Math.max(0, Math.round(level)));
  if (n < 1) return;
  const len = Math.hypot(dx, dy);
  const ux = len > 0 ? dx / len : 0;
  const uy = len > 0 ? dy / len : -1;
  ctx.save();
  ctx.fillStyle = COLOURS.smoke;
  ctx.strokeStyle = COLOURS.inkSoft;
  ctx.lineWidth = Math.max(0.6, s / 32);
  for (let i = 0; i < n; i += 1) {
    const t = (phase + i / n + hash2(tx, ty, 7)) % 1;
    const dist = s * (0.25 + 0.6 * t);
    const side = (hash2(tx, ty, 8 + i) - 0.5) * s * 0.3;
    const cx = px + s / 2 + ux * dist - uy * side;
    const cy = py + s * 0.3 + uy * dist + ux * side - s * 0.15 * t;
    ctx.globalAlpha = 0.6 * (1 - t * 0.55);
    ctx.beginPath();
    ctx.arc(cx, cy, s * (0.11 + 0.12 * t), 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** Draws small water-blue droplets on a wet tile. */
export function drawWet(ctx, px, py, s) {
  const r = Math.max(1.2, s * 0.065);
  ctx.save();
  inkSetup(ctx, s);
  ctx.lineWidth = Math.max(0.5, s / 32);
  ctx.fillStyle = COLOURS.water;
  for (const [fx, fy] of [[0.7, 0.26], [0.86, 0.4], [0.62, 0.46]]) {
    const cx = px + fx * s;
    const cy = py + fy * s;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 2.2);
    ctx.lineTo(cx + r, cy);
    ctx.arc(cx, cy, r, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** Draws a guard-green pennant with the number of men posted on the tile. */
export function drawGuard(ctx, px, py, s, men) {
  const poleX = px + s * 0.18;
  const top = py + s * 0.08;
  ctx.save();
  inkSetup(ctx, s);
  ctx.lineWidth = inkWidth(s) * 1.2;
  strokeLine(ctx, poleX, top, poleX, py + s * 0.66);
  ctx.beginPath();
  ctx.moveTo(poleX, top);
  ctx.lineTo(poleX + s * 0.36, top + s * 0.09);
  ctx.lineTo(poleX, top + s * 0.18);
  ctx.closePath();
  ctx.fillStyle = COLOURS.guard;
  ctx.fill();
  ctx.lineWidth = inkWidth(s);
  ctx.stroke();
  if (men > 0) {
    const fs = Math.max(7, Math.round(s * 0.3));
    const cx = poleX + s * 0.2;
    const cy = top + s * 0.38;
    ctx.beginPath();
    ctx.arc(cx, cy, fs * 0.62, 0, TAU);
    ctx.fillStyle = COLOURS.parchment;
    ctx.fill();
    ctx.strokeStyle = COLOURS.guard;
    ctx.lineWidth = Math.max(1, s / 16);
    ctx.stroke();
    ctx.font = `bold ${fs}px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLOURS.ink;
    ctx.fillText(String(men), cx, cy + fs * 0.04);
  }
  ctx.restore();
}

/** Draws a small pair of hollow footprints marking a tile whose district has been evacuated. */
export function drawFootprint(ctx, px, py, s) {
  const r = Math.max(1.1, s * 0.06);
  ctx.save();
  ctx.fillStyle = COLOURS.parchment;
  ctx.strokeStyle = COLOURS.ink;
  ctx.lineWidth = Math.max(0.6, s / 34);
  for (const [fx, fy] of [[0.74, 0.78], [0.88, 0.66]]) {
    ctx.save();
    ctx.translate(px + s * fx, py + s * fy);
    ctx.rotate(0.35);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.7, r * 0.75, r * 1.25, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, r * 1.45, r * 0.55, r * 0.6, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/** Draws a refugee tent whose base sits at (cx, baseY). */
export function drawTent(ctx, cx, baseY, size) {
  ctx.save();
  inkSetup(ctx, size * 2);
  ctx.beginPath();
  ctx.moveTo(cx - size / 2, baseY);
  ctx.lineTo(cx, baseY - size * 0.8);
  ctx.lineTo(cx + size / 2, baseY);
  ctx.closePath();
  ctx.fillStyle = COLOURS.canvasCloth;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, baseY - size * 0.8);
  ctx.lineTo(cx - size * 0.12, baseY);
  ctx.lineTo(cx + size * 0.12, baseY);
  ctx.closePath();
  ctx.fillStyle = COLOURS.inkSoft;
  ctx.fill();
  strokeLine(ctx, cx, baseY - size * 0.8, cx, baseY - size);
  ctx.restore();
}

/** Draws the selected-tile marker: a thick ink and parchment double outline with corner ticks. */
export function drawSelection(ctx, px, py, s) {
  const outer = Math.max(2.5, s / 8);
  ctx.save();
  ctx.lineJoin = 'miter';
  ctx.lineWidth = outer;
  ctx.strokeStyle = COLOURS.ink;
  ctx.strokeRect(px + outer / 2, py + outer / 2, s - outer, s - outer);
  ctx.lineWidth = Math.max(1, outer / 2.5);
  ctx.strokeStyle = COLOURS.parchment;
  ctx.strokeRect(px + outer * 1.25, py + outer * 1.25, s - outer * 2.5, s - outer * 2.5);
  const t = Math.max(3, s * 0.3);
  const g = outer * 0.8;
  ctx.lineWidth = Math.max(1.5, outer * 0.7);
  ctx.strokeStyle = COLOURS.ink;
  ctx.beginPath();
  for (const [cx, cy, sx, sy] of [[px, py, 1, 1], [px + s, py, -1, 1], [px, py + s, 1, -1], [px + s, py + s, -1, -1]]) {
    ctx.moveTo(cx - sx * g, cy + sy * t);
    ctx.lineTo(cx - sx * g, cy - sy * g);
    ctx.lineTo(cx + sx * t, cy - sy * g);
  }
  ctx.stroke();
  ctx.restore();
}

/** Draws the weather-vane cartouche: a north mark, an arrow the way the wind pushes the fire and 0-3 strength streaks. */
export function drawWindVane(ctx, wind, cx, cy, r) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fillStyle = COLOURS.parchment;
  ctx.fill();
  ctx.strokeStyle = COLOURS.ink;
  ctx.lineWidth = Math.max(1, r / 9);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.84, 0, TAU);
  ctx.lineWidth = Math.max(0.5, r / 22);
  ctx.stroke();
  strokeLine(ctx, cx, cy - r, cx, cy - r * 0.72);
  const fs = Math.max(7, Math.round(r * 0.55));
  ctx.font = `bold ${fs}px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = COLOURS.ink;
  ctx.fillText('N', cx, cy - r - 0.5);
  const dx = Number(wind && wind.dx) || 0;
  const dy = Number(wind && wind.dy) || 0;
  const strength = Math.min(3, Math.max(0, Math.round(Number(wind && wind.strength) || 0)));
  if ((dx === 0 && dy === 0) || strength === 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.22, 0, TAU);
    ctx.lineWidth = Math.max(1, r / 10);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const tip = [cx + ux * r * 0.66, cy + uy * r * 0.66];
  const tail = [cx - ux * r * 0.62, cy - uy * r * 0.62];
  ctx.lineWidth = Math.max(1.2, r / 7);
  strokeLine(ctx, tail[0], tail[1], tip[0], tip[1]);
  const head = r * 0.36;
  ctx.beginPath();
  ctx.moveTo(tip[0] + ux * head * 0.2, tip[1] + uy * head * 0.2);
  ctx.lineTo(tip[0] - ux * head - uy * head * 0.55, tip[1] - uy * head + ux * head * 0.55);
  ctx.lineTo(tip[0] - ux * head + uy * head * 0.55, tip[1] - uy * head - ux * head * 0.55);
  ctx.closePath();
  ctx.fillStyle = COLOURS.accent;
  ctx.fill();
  ctx.lineWidth = Math.max(0.8, r / 12);
  ctx.stroke();
  ctx.lineWidth = Math.max(1, r / 9);
  for (let k = 0; k < strength; k += 1) {
    const bx = tail[0] + ux * r * 0.2 * k;
    const by = tail[1] + uy * r * 0.2 * k;
    strokeLine(ctx, bx, by, bx - ux * r * 0.16 - uy * r * 0.32, by - uy * r * 0.16 + ux * r * 0.32);
  }
  ctx.restore();
}

function textWidth(ctx, text, fs) {
  const metrics = typeof ctx.measureText === 'function' ? ctx.measureText(text) : null;
  return metrics && metrics.width > 0 ? metrics.width : text.length * fs * 0.5;
}

/** Draws a scroll cartouche with a title when it fits in maxWidth; returns whether it was drawn. */
export function drawTitle(ctx, text, cx, cy, fs, maxWidth) {
  ctx.save();
  ctx.font = `italic ${fs}px ${SERIF}`;
  const w = textWidth(ctx, text, fs) + fs * 1.8;
  const h = fs * 1.6;
  if (w > maxWidth) {
    ctx.restore();
    return false;
  }
  ctx.fillStyle = COLOURS.parchment;
  ctx.strokeStyle = COLOURS.ink;
  ctx.lineWidth = Math.max(1, fs / 10);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx + (side * w) / 2, cy, h * 0.32, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
  ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
  ctx.lineWidth = Math.max(0.5, fs / 24);
  ctx.strokeRect(cx - w / 2 + 2, cy - h / 2 + 2, w - 4, h - 4);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLOURS.ink;
  ctx.fillText(text, cx, cy);
  ctx.restore();
  return true;
}

/** Draws a small serif landmark label with a parchment halo. */
export function drawLabel(ctx, text, cx, cy, fs) {
  ctx.save();
  ctx.font = `italic ${fs}px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, fs / 3.2);
  ctx.strokeStyle = COLOURS.parchment;
  ctx.strokeText(text, cx, cy);
  ctx.fillStyle = COLOURS.ink;
  ctx.fillText(text, cx, cy);
  ctx.restore();
}

/** Draws a double ink rule round the map, like the border of a printed map. */
export function drawMapFrame(ctx, x, y, w, h) {
  ctx.save();
  ctx.strokeStyle = COLOURS.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
  ctx.lineWidth = 0.75;
  ctx.strokeRect(x - 5.5, y - 5.5, w + 11, h + 11);
  ctx.restore();
}

/** Fills the whole map with the night tint. */
export function drawNight(ctx, w, h) {
  ctx.save();
  ctx.fillStyle = COLOURS.night;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Draws one flying spark of an ember arc. */
export function drawSpark(ctx, x, y, r, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = COLOURS.fire1;
  ctx.fill();
  ctx.strokeStyle = COLOURS.fire3;
  ctx.lineWidth = Math.max(0.6, r / 2.5);
  ctx.stroke();
  ctx.restore();
}

/** Draws the bright ring that flashes when a tile catches fire. */
export function drawFlash(ctx, cx, cy, radius, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, TAU);
  ctx.fillStyle = COLOURS.fire1;
  ctx.fill();
  ctx.strokeStyle = COLOURS.fire3;
  ctx.lineWidth = Math.max(1, radius / 6);
  ctx.stroke();
  ctx.restore();
}

/** Darkens a tile towards the burnt colour while it burns out. */
export function drawDarken(ctx, px, py, s, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = COLOURS.burnt;
  ctx.fillRect(px, py, s, s);
  ctx.restore();
}
