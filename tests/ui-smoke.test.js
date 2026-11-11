import { before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { listFiles } from './helpers/scan-imports.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const UI_DIR = join(ROOT, 'src', 'ui');
const MAIN = join(ROOT, 'src', 'main.js');

const DOM_GLOBALS = ['document', 'window', 'requestAnimationFrame', 'matchMedia', 'HTMLElement', 'HTMLCanvasElement'];

const LEGEND_IDS = [
  'house', 'warehouse', 'stone', 'open', 'river', 'wall', 'fire-1', 'fire-2', 'fire-3',
  'burnt', 'firebreak', 'wet', 'guard', 'evacuated'
];

const COLOURS = {
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

/** Returns the repo-relative path of a file with forward slashes. */
function rel(file) {
  return relative(ROOT, file).split(sep).join('/');
}

/** Imports a module by file path and returns { module } or { error }. */
async function load(file) {
  try {
    return { module: await import(pathToFileURL(file).href) };
  } catch (error) {
    return { error };
  }
}

/** Lists which browser globals are currently defined. */
function definedDomGlobals() {
  return DOM_GLOBALS.filter((name) => typeof globalThis[name] !== 'undefined');
}

describe('UI modules load in Node without a DOM', () => {
  const loaded = new Map();
  let globalsBefore = [];

  before(async () => {
    globalsBefore = definedDomGlobals();
    for (const file of [...listFiles(UI_DIR, ['.js']), MAIN]) {
      loaded.set(rel(file), await load(file));
    }
  });

  it('runs with no DOM globals', () => {
    // Arrange
    const found = globalsBefore;

    // Act
    const hasDocument = typeof document !== 'undefined';

    // Assert
    assert.equal(hasDocument, false, 'this smoke test must run without a document');
    assert.deepEqual(found, [], 'no browser globals should exist in Node');
  });

  it('imports every .js file under src/ui/ and src/main.js', () => {
    // Arrange
    const expected = ['src/main.js', 'src/ui/app.js', 'src/ui/map-view.js', 'src/ui/screens.js', 'src/ui/tutorial.js'];

    // Act
    const failures = [...loaded.entries()]
      .filter(([, result]) => result.error)
      .map(([file, result]) => `${file}: ${result.error?.stack ?? result.error}`);

    // Assert
    expected.forEach((file) => assert.ok(loaded.has(file), `${file} is missing`));
    assert.deepEqual(failures, [], 'browser-only work must happen inside functions, never at module top level');
  });

  it('leaves the global scope without a DOM after importing src/main.js', () => {
    // Arrange
    const result = loaded.get('src/main.js');

    // Act
    const globalsAfter = definedDomGlobals();

    // Assert
    assert.ok(result && !result.error, `src/main.js should import cleanly: ${result?.error?.message}`);
    assert.deepEqual(globalsAfter, [], 'importing modules must not create browser globals');
    assert.equal(typeof document, 'undefined');
  });

  it('app.js exports createApp', () => {
    // Arrange
    const app = loaded.get('src/ui/app.js')?.module ?? {};

    // Act
    const type = typeof app.createApp;

    // Assert
    assert.equal(type, 'function');
  });

  it('map-view.js exports the 6d API', () => {
    // Arrange
    const mapView = loaded.get('src/ui/map-view.js')?.module ?? {};

    // Act
    const types = {
      createMapView: typeof mapView.createMapView,
      computeLayout: typeof mapView.computeLayout,
      pointToTile: typeof mapView.pointToTile,
      drawLegendSwatch: typeof mapView.drawLegendSwatch,
      LEGEND: Array.isArray(mapView.LEGEND) ? 'array' : typeof mapView.LEGEND,
      COLOURS: mapView.COLOURS !== null && typeof mapView.COLOURS === 'object' ? 'object' : typeof mapView.COLOURS
    };

    // Assert
    assert.deepEqual(types, {
      createMapView: 'function',
      computeLayout: 'function',
      pointToTile: 'function',
      drawLegendSwatch: 'function',
      LEGEND: 'array',
      COLOURS: 'object'
    });
  });

  it('map-view.js LEGEND has exactly the 6d ids, each with a label', () => {
    // Arrange
    const { LEGEND = [] } = loaded.get('src/ui/map-view.js')?.module ?? {};

    // Act
    const ids = LEGEND.map((entry) => entry.id);
    const unlabelled = LEGEND.filter((entry) => typeof entry.label !== 'string' || entry.label.trim() === '');

    // Assert
    assert.deepEqual([...ids].sort(), [...LEGEND_IDS].sort());
    assert.equal(new Set(ids).size, ids.length, 'LEGEND ids must be unique');
    assert.deepEqual(unlabelled, [], 'every LEGEND entry needs a label');
  });

  it('map-view.js COLOURS has the 6d values', () => {
    // Arrange
    const { COLOURS: colours = {} } = loaded.get('src/ui/map-view.js')?.module ?? {};

    // Act
    const actual = Object.fromEntries(Object.keys(COLOURS).map((key) => [key, String(colours[key]).toLowerCase()]));

    // Assert
    assert.deepEqual(actual, COLOURS);
  });

  it('map-view.js computeLayout centres square tiles and pointToTile finds them', () => {
    // Arrange
    const { computeLayout, pointToTile } = loaded.get('src/ui/map-view.js')?.module ?? {};
    const cols = 28;
    const rows = 18;

    // Act
    const layout = computeLayout(900, 600, cols, rows);
    const hit = pointToTile(layout.offsetX + 3.5 * layout.tileSize, layout.offsetY + 4.5 * layout.tileSize, layout, cols, rows);
    const miss = pointToTile(layout.offsetX - layout.tileSize, layout.offsetY - layout.tileSize, layout, cols, rows);

    // Assert
    assert.ok(layout.tileSize > 0, 'tileSize must be positive');
    assert.ok(layout.tileSize * cols <= 900 + 1 && layout.tileSize * rows <= 600 + 1, 'the grid must fit at zoom 1');
    assert.ok(Math.abs(2 * layout.offsetX + layout.tileSize * cols - 900) <= 2, 'the grid must be centred across');
    assert.ok(Math.abs(2 * layout.offsetY + layout.tileSize * rows - 600) <= 2, 'the grid must be centred down');
    assert.deepEqual(hit, { x: 3, y: 4 });
    assert.equal(miss, null);
  });

  it('screens.js exports createScreens', () => {
    // Arrange
    const screens = loaded.get('src/ui/screens.js')?.module ?? {};

    // Act
    const type = typeof screens.createScreens;

    // Assert
    assert.equal(type, 'function');
  });

  it('tutorial.js exports createTutorial and TUTORIAL_STEPS', () => {
    // Arrange
    const tutorial = loaded.get('src/ui/tutorial.js')?.module ?? {};

    // Act
    const steps = tutorial.TUTORIAL_STEPS;
    const badSteps = Array.isArray(steps)
      ? steps.filter((step) => typeof step.id !== 'string' || typeof step.title !== 'string' || typeof step.text !== 'string'
        || !(step.target === null || typeof step.target === 'string')
        || !(step.waitFor === null || (typeof step.waitFor === 'object' && typeof step.waitFor.event === 'string')))
      : [];

    // Assert
    assert.equal(typeof tutorial.createTutorial, 'function');
    assert.ok(Array.isArray(steps) && steps.length > 0, 'TUTORIAL_STEPS must be a non-empty array');
    assert.deepEqual(badSteps.map((step) => step.id), [], 'each step is { id, title, text, target (null or string), waitFor (null or { event, type }) }');
  });

  it('no ui module has a default export', () => {
    // Arrange
    const modules = [...loaded.entries()].filter(([, result]) => result.module);

    // Act
    const withDefault = modules.filter(([, result]) => Object.hasOwn(result.module, 'default')).map(([file]) => file);

    // Assert
    assert.deepEqual(withDefault, [], 'use named exports only');
  });
});
