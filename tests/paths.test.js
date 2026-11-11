import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractHtmlRefs,
  extractHtmlTags,
  extractImports,
  isExternalRef,
  isIgnorableRef,
  listFiles,
  resolveRef
} from './helpers/scan-imports.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const INDEX = join(ROOT, 'index.html');

// Section 2 ownership of the src/ui/ files; a ui file may only import ui files of its own unit.
const UI_OWNERS = {
  'map-view.js': 'map-view',
  'map-art.js': 'map-view',
  'app.js': 'ui-shell',
  'controller.js': 'ui-shell',
  'panel.js': 'ui-shell',
  'format.js': 'ui-shell',
  'storage.js': 'ui-shell',
  'screens.js': 'ui-screens',
  'tutorial.js': 'ui-screens'
};

/** Returns the repo-relative path of a file with forward slashes, for messages and prefix checks. */
function rel(file) {
  return relative(ROOT, file).split(sep).join('/');
}

/** Reports whether a path is a regular file. */
function isFile(file) {
  return existsSync(file) && statSync(file).isFile();
}

/** Returns the value of the named attribute on a parsed tag, or undefined. */
function attrValue(tag, name) {
  return tag.attrs.find((attr) => attr.name === name)?.value;
}

/** Lists every { file, specifier, target } import edge from .js files under src/. */
function importEdges() {
  return listFiles(SRC, ['.js']).flatMap((file) => extractImports(readFileSync(file, 'utf8'))
    .map((specifier) => ({ file, specifier, target: resolveRef(file, specifier) })));
}

describe('index.html references', () => {
  it('exists at the repo root', () => {
    // Arrange
    const path = INDEX;

    // Act
    const found = isFile(path);

    // Assert
    assert.ok(found, 'index.html must sit at the repository root');
  });

  it('loads src/main.js as a module script and both stylesheets', () => {
    // Arrange
    const tags = extractHtmlTags(readFileSync(INDEX, 'utf8'));

    // Act
    const moduleScripts = tags
      .filter((tag) => tag.tag === 'script' && attrValue(tag, 'type') === 'module')
      .map((tag) => rel(resolveRef(INDEX, attrValue(tag, 'src') ?? '')));
    const stylesheets = tags
      .filter((tag) => tag.tag === 'link' && (attrValue(tag, 'rel') ?? '').toLowerCase().split(/\s+/).includes('stylesheet'))
      .map((tag) => rel(resolveRef(INDEX, attrValue(tag, 'href') ?? '')));

    // Assert
    assert.ok(moduleScripts.includes('src/main.js'), `expected <script type="module" src="src/main.js">, found: ${moduleScripts.join(', ') || 'none'}`);
    assert.ok(stylesheets.includes('src/ui/styles.css'), `expected a stylesheet link to src/ui/styles.css, found: ${stylesheets.join(', ') || 'none'}`);
    assert.ok(stylesheets.includes('src/ui/screens.css'), `expected a stylesheet link to src/ui/screens.css, found: ${stylesheets.join(', ') || 'none'}`);
  });

  it('uses only relative script and stylesheet refs that point at real files', () => {
    // Arrange
    const tags = extractHtmlTags(readFileSync(INDEX, 'utf8'));
    const refs = tags.flatMap((tag) => {
      if (tag.tag === 'script' && attrValue(tag, 'src') !== undefined) {
        return [attrValue(tag, 'src')];
      }
      const rels = (attrValue(tag, 'rel') ?? '').toLowerCase().split(/\s+/);
      return tag.tag === 'link' && rels.includes('stylesheet') ? [attrValue(tag, 'href') ?? ''] : [];
    });

    // Act
    const external = refs.filter((ref) => isExternalRef(ref) || isIgnorableRef(ref));
    const missing = refs.filter((ref) => !isExternalRef(ref) && !isIgnorableRef(ref) && !isFile(resolveRef(INDEX, ref)));

    // Assert
    assert.ok(refs.length >= 3, 'index.html should load at least one script and two stylesheets');
    assert.deepEqual(external, [], `scripts and stylesheets must use relative paths, found: ${external.join(', ')}`);
    assert.deepEqual(missing, [], `these refs in index.html point at missing files: ${missing.join(', ')}`);
  });

  it('has no absolute or network refs and no broken relative links', () => {
    // Arrange
    const refs = extractHtmlRefs(readFileSync(INDEX, 'utf8')).filter((ref) => !isIgnorableRef(ref.value));

    // Act
    const absolute = refs.filter((ref) => /^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(ref.value) || /^https?:/i.test(ref.value) || ref.value.startsWith('/'));
    const broken = refs.filter((ref) => !isExternalRef(ref.value) && !existsSync(resolveRef(INDEX, ref.value)));

    // Assert
    assert.deepEqual(absolute.map((ref) => ref.value), [], 'index.html must not use network URLs or root-absolute paths');
    assert.deepEqual(broken.map((ref) => ref.value), [], 'index.html links to files that do not exist');
  });
});

describe('src/ imports', () => {
  it('finds JavaScript files to check', () => {
    // Arrange
    const required = ['src/main.js', 'src/engine/index.js', 'src/data/map.js', 'src/data/history.js', 'src/ui/app.js', 'src/ui/map-view.js', 'src/ui/screens.js', 'src/ui/tutorial.js'];

    // Act
    const files = new Set(listFiles(SRC, ['.js']).map(rel));
    const missing = required.filter((file) => !files.has(file));

    // Assert
    assert.deepEqual(missing, [], `contract files are missing: ${missing.join(', ')}`);
  });

  it('uses only relative specifiers ending in .js', () => {
    // Arrange
    const edges = importEdges();

    // Act
    const bad = edges
      .filter(({ specifier }) => !/^\.\.?\//.test(specifier) || !specifier.endsWith('.js'))
      .map(({ file, specifier }) => `${rel(file)} imports '${specifier}'`);

    // Assert
    assert.deepEqual(bad, [], 'imports must be relative (./ or ../) and end in .js');
  });

  it('only imports files that exist inside the repo', () => {
    // Arrange
    const edges = importEdges().filter(({ specifier }) => /^\.\.?\//.test(specifier));

    // Act
    const outside = edges
      .filter(({ target }) => rel(target).startsWith('..'))
      .map(({ file, specifier }) => `${rel(file)} imports '${specifier}'`);
    const missing = edges
      .filter(({ target }) => !rel(target).startsWith('..') && !isFile(target))
      .map(({ file, specifier }) => `${rel(file)} imports '${specifier}'`);

    // Assert
    assert.deepEqual(outside, [], 'imports must stay inside the repository');
    assert.deepEqual(missing, [], 'imports point at files that do not exist');
  });

  it('keeps src/ui/ away from src/engine/, src/data/ and other units\' ui files', () => {
    // Arrange
    const edges = importEdges().filter(({ file }) => rel(file).startsWith('src/ui/'));

    // Act
    const layerBreaks = edges
      .filter(({ target }) => /^src\/(engine|data)\//.test(rel(target)) || rel(target) === 'src/main.js')
      .map(({ file, specifier }) => `${rel(file)} imports '${specifier}'`);
    const crossUnit = edges
      .filter(({ file, target }) => {
        const from = UI_OWNERS[rel(file).slice('src/ui/'.length)];
        const to = rel(target).startsWith('src/ui/') ? UI_OWNERS[rel(target).slice('src/ui/'.length)] : undefined;
        return from !== undefined && to !== undefined && from !== to;
      })
      .map(({ file, specifier }) => `${rel(file)} imports '${specifier}'`);

    // Assert
    assert.deepEqual(layerBreaks, [], 'src/ui/ must get the engine and data from src/main.js via createApp, not by importing them');
    assert.deepEqual(crossUnit, [], 'src/ui/ files must not import another unit\'s ui files');
  });

  it('keeps src/engine/ and src/data/ free of ui and main imports', () => {
    // Arrange
    const edges = importEdges().filter(({ file }) => /^src\/(engine|data)\//.test(rel(file)));

    // Act
    const bad = edges
      .filter(({ target }) => !/^src\/(engine|data)\//.test(rel(target)))
      .map(({ file, specifier }) => `${rel(file)} imports '${specifier}'`);

    // Assert
    assert.deepEqual(bad, [], 'engine and data code may only import engine and data modules');
  });
});

describe('no network URLs', () => {
  it('has no http:// or https:// in src/ or index.html except w3.org XML namespaces', () => {
    // Arrange
    const files = [INDEX, ...listFiles(SRC)];

    // Act
    const offenders = files.flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return [...text.matchAll(/https?:\/\/[^\s'"`)<>]*/gi)]
        .filter((match) => !text.startsWith('http://www.w3.org/', match.index))
        .map((match) => `${rel(file)}: ${match[0]}`);
    });

    // Assert
    assert.deepEqual(offenders, [], 'the game must not load anything from the network');
  });

  it('has no CSS url() or @import pointing anywhere but data: URLs or real relative files', () => {
    // Arrange
    const sheets = listFiles(SRC, ['.css']);

    // Act
    const bad = sheets.flatMap((file) => {
      const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      const refs = [
        ...[...css.matchAll(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi)].map((match) => match[2]),
        ...[...css.matchAll(/@import\s+(['"])([^'"]+)\1/gi)].map((match) => match[2])
      ];
      return refs
        .filter((ref) => !isIgnorableRef(ref) && (isExternalRef(ref) || !isFile(resolveRef(file, ref))))
        .map((ref) => `${rel(file)}: ${ref}`);
    });

    // Assert
    assert.deepEqual(bad, [], 'stylesheets may only use data: URLs or relative files that exist');
  });
});

describe('GitHub Pages', () => {
  it('has an empty .nojekyll file at the repo root', () => {
    // Arrange
    const path = join(ROOT, '.nojekyll');

    // Act
    const found = isFile(path);

    // Assert
    assert.ok(found, '.nojekyll must exist so GitHub Pages serves files as they are');
    assert.equal(readFileSync(path, 'utf8'), '', '.nojekyll should be empty');
  });
});
