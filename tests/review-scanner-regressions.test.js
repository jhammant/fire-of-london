import { it } from 'node:test';
import assert from 'node:assert/strict';
import { extractHtmlRefs, extractImports, stripComments } from './helpers/scan-imports.js';

it('literal-text is not an import dependency', () => {
  const source = [
    `const help = "Use import('./example.js') here";`,
    "const sample = `export { thing } from './sample.js';`;",
    "import './real.js';",
    "const interpolated = `Module: ${import('./interpolated.js')}`;"
  ].join('\n');

  const actual = extractImports(source);

  assert.deepEqual(actual, ['./real.js', './interpolated.js'],
    'String contents are not dependencies; executable template expressions are.');
});

it('valid-import-syntax is not silently omitted', () => {
  const source = [
    "const trailing = import('./trailing.js',);",
    "const options = import('./options.js', {});",
    "import { café } from './unicode.js';",
    "export { thing as 'a-b' } from './quoted-name.js';"
  ].join('\n');

  const actual = extractImports(source);

  assert.deepEqual(actual, ['./trailing.js', './options.js', './unicode.js', './quoted-name.js'],
    'All four statements contain literal module specifiers that the path checks must inspect.');
});

it('division-comments are stripped after postfix increment', () => {
  const source = [
    'let count = 4;',
    "const ratio = count++ / 2; // import './comment-only.js';",
    "import './real.js';"
  ].join('\n');

  const stripped = stripComments(source);

  assert.equal(stripped, "let count = 4;\nconst ratio = count++ / 2; \nimport './real.js';",
    'The division operator must not consume the start of the line comment as a regex literal.');
  assert.deepEqual(extractImports(source), ['./real.js']);
});

it('html-raw-text does not create imaginary referencing elements', () => {
  const html = [
    '<script>const example = \'<img src="not-an-image.png">\';</script>',
    '<textarea><a href="not-a-page.html">Example markup</a></textarea>',
    '<script type="module" src="src/main.js"></script>'
  ].join('\n');

  const refs = extractHtmlRefs(html);

  assert.deepEqual(refs, [{ tag: 'script', attr: 'src', value: 'src/main.js' }],
    'HTML raw text and textarea content are not child elements and must not become file references.');
});
