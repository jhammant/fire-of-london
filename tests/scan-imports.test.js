import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  extractHtmlRefs,
  extractHtmlTags,
  extractImports,
  isExternalRef,
  isIgnorableRef,
  listFiles,
  resolveRef,
  stripComments
} from './helpers/scan-imports.js';

describe('listFiles', () => {
  it('lists matching files recursively and sorted, skipping node_modules and dot-directories', () => {
    // Arrange
    const root = mkdtempSync(join(tmpdir(), 'fol-scan-'));
    try {
      mkdirSync(join(root, 'b', 'deep'), { recursive: true });
      mkdirSync(join(root, 'a'));
      mkdirSync(join(root, 'node_modules', 'pkg'), { recursive: true });
      mkdirSync(join(root, '.hidden'));
      writeFileSync(join(root, 'z.js'), '');
      writeFileSync(join(root, 'b', 'deep', 'c.js'), '');
      writeFileSync(join(root, 'a', 'b.css'), '');
      writeFileSync(join(root, 'a', 'a.js'), '');
      writeFileSync(join(root, 'a', 'notes.txt'), '');
      writeFileSync(join(root, 'node_modules', 'pkg', 'index.js'), '');
      writeFileSync(join(root, '.hidden', 'secret.js'), '');

      // Act
      const jsAndCss = listFiles(root, ['.js', '.css']);
      const jsOnly = listFiles(root, ['.js']);

      // Assert
      assert.deepEqual(jsAndCss, [
        join(root, 'a', 'a.js'),
        join(root, 'a', 'b.css'),
        join(root, 'b', 'deep', 'c.js'),
        join(root, 'z.js')
      ]);
      assert.deepEqual(jsOnly, [
        join(root, 'a', 'a.js'),
        join(root, 'b', 'deep', 'c.js'),
        join(root, 'z.js')
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('lists every file when no extensions are given', () => {
    // Arrange
    const root = mkdtempSync(join(tmpdir(), 'fol-scan-'));
    try {
      writeFileSync(join(root, 'one.txt'), '');
      writeFileSync(join(root, 'two.js'), '');

      // Act
      const files = listFiles(root);

      // Assert
      assert.deepEqual(files, [join(root, 'one.txt'), join(root, 'two.js')]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns an empty list for an empty directory', () => {
    // Arrange
    const root = mkdtempSync(join(tmpdir(), 'fol-scan-'));
    try {
      // Act
      const files = listFiles(root, ['.js']);

      // Assert
      assert.deepEqual(files, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('stripComments', () => {
  it('removes line comments and keeps the newline', () => {
    // Arrange
    const source = 'const a = 1; // a note\nconst b = 2;';

    // Act
    const result = stripComments(source);

    // Assert
    assert.equal(result, 'const a = 1; \nconst b = 2;');
  });

  it('replaces a one-line block comment with a space', () => {
    // Arrange
    const source = 'a/* gone */b';

    // Act
    const result = stripComments(source);

    // Assert
    assert.equal(result, 'a b');
  });

  it('keeps the line breaks of a multi-line block comment', () => {
    // Arrange
    const source = 'x;\n/**\n * Doc.\n */\ny;';

    // Act
    const result = stripComments(source);

    // Assert
    assert.equal(result, 'x;\n\n\n\ny;');
  });

  it('keeps // and /* inside single-quoted, double-quoted and template strings', () => {
    // Arrange
    const source = [
      "const a = 'http://example.org/*x*/';",
      'const b = "// not a comment";',
      'const c = `/* still text */ // here`;'
    ].join('\n');

    // Act
    const result = stripComments(source);

    // Assert
    assert.equal(result, source);
  });

  it('respects escaped quotes inside strings', () => {
    // Arrange
    const source = "const a = 'it\\'s // fine'; // drop\nconst b = \"say \\\"/*hi*/\\\"\";";

    // Act
    const result = stripComments(source);

    // Assert
    assert.equal(result, "const a = 'it\\'s // fine'; \nconst b = \"say \\\"/*hi*/\\\"\";");
  });

  it('handles template literals with nested expressions, strings and templates', () => {
    // Arrange
    const source = 'const t = `a ${ { k: "//x" }.k + `in ${ 1 /* c */ }` } // b`; // gone';

    // Act
    const result = stripComments(source);

    // Assert
    assert.equal(result, 'const t = `a ${ { k: "//x" }.k + `in ${ 1   }` } // b`; ');
  });

  it('keeps regular expression literals that contain slashes and quotes', () => {
    // Arrange
    const source = "const re = /https?:\\/\\/[^'\"]*/g; // drop\nconst half = total / 2; // drop";

    // Act
    const result = stripComments(source);

    // Assert
    assert.equal(result, "const re = /https?:\\/\\/[^'\"]*/g; \nconst half = total / 2; ");
  });

  it('removes a comment at the very end without a newline', () => {
    // Arrange
    const source = 'x(); // last';

    // Act
    const result = stripComments(source);

    // Assert
    assert.equal(result, 'x(); ');
  });

  it('reads / after a postfix ++ or -- as division, so the comment after it is removed', () => {
    // Arrange
    const source = "a = count++ / 2; // import './one.js';\nb = left-- / 2 /* import './two.js' */;";

    // Act
    const result = stripComments(source);

    // Assert
    assert.equal(result, 'a = count++ / 2; \nb = left-- / 2  ;');
  });

  it('keeps regex literals after keywords and inside template substitutions', () => {
    // Arrange
    const source = 'return /\\/\\/x/.test(s); // c\nconst t = `${/\\/\\//.source}`; // d';

    // Act
    const result = stripComments(source);

    // Assert
    assert.equal(result, 'return /\\/\\/x/.test(s); \nconst t = `${/\\/\\//.source}`; ');
  });

  it('keeps a hashbang line', () => {
    // Arrange
    const source = '#!/usr/bin/env node\n// note\nrun();';

    // Act
    const result = stripComments(source);

    // Assert
    assert.equal(result, '#!/usr/bin/env node\n\nrun();');
  });
});

describe('extractImports', () => {
  it('finds default, named, namespace and side-effect imports in order', () => {
    // Arrange
    const source = [
      "import a from './a.js';",
      "import { b, c as d } from '../lib/b.js';",
      'import * as e from "./e.js";',
      "import f, { g } from './f.js';",
      "import './side-effect.js';",
      'import "./side-effect-double.js";'
    ].join('\n');

    // Act
    const specifiers = extractImports(source);

    // Assert
    assert.deepEqual(specifiers, [
      './a.js',
      '../lib/b.js',
      './e.js',
      './f.js',
      './side-effect.js',
      './side-effect-double.js'
    ]);
  });

  it('finds multi-line imports', () => {
    // Arrange
    const source = "import {\n  one,\n  two,\n  three\n} from './many.js';\nimport\n  four\nfrom\n  './four.js';";

    // Act
    const specifiers = extractImports(source);

    // Assert
    assert.deepEqual(specifiers, ['./many.js', './four.js']);
  });

  it('finds export-from forms', () => {
    // Arrange
    const source = [
      "export { a, b as c } from './a.js';",
      "export * from './b.js';",
      "export * as ns from './c.js';",
      'export const from = 1;',
      "export { local };"
    ].join('\n');

    // Act
    const specifiers = extractImports(source);

    // Assert
    assert.deepEqual(specifiers, ['./a.js', './b.js', './c.js']);
  });

  it('finds dynamic imports with string literals only', () => {
    // Arrange
    const source = [
      "const m = await import('./dynamic.js');",
      'const n = import("./double.js");',
      'const o = import(`./template.js`);',
      'const p = import(`./${name}.js`);',
      'const q = import(variable);',
      'const r = loader.import(\'./method.js\');'
    ].join('\n');

    // Act
    const specifiers = extractImports(source);

    // Assert
    assert.deepEqual(specifiers, ['./dynamic.js', './double.js', './template.js']);
  });

  it('ignores imports in comments but keeps the real ones around them', () => {
    // Arrange
    const source = [
      "// import x from 'https://cdn.example.com/x.js';",
      "/* import y from 'y';",
      "   export * from 'z'; */",
      "import real from './real.js'; // import fake from 'fake'",
      "/** @see import('./doc.js') */"
    ].join('\n');

    // Act
    const specifiers = extractImports(source);

    // Assert
    assert.deepEqual(specifiers, ['./real.js']);
  });

  it('ignores import.meta and words that merely contain import', () => {
    // Arrange
    const source = "const url = import.meta.url;\nconst important = 'yes';\nreimport('x');";

    // Act
    const specifiers = extractImports(source);

    // Assert
    assert.deepEqual(specifiers, []);
  });

  it('keeps imports whose specifier contains //', () => {
    // Arrange
    const source = "import x from 'https://example.org/x.js';";

    // Act
    const specifiers = extractImports(source);

    // Assert
    assert.deepEqual(specifiers, ['https://example.org/x.js']);
  });

  it('handles minified imports without spaces', () => {
    // Arrange
    const source = "import{a}from'./a.js';import*as b from\"./b.js\";export*from'./c.js';";

    // Act
    const specifiers = extractImports(source);

    // Assert
    assert.deepEqual(specifiers, ['./a.js', './b.js', './c.js']);
  });

  it('finds dynamic imports with a trailing comma or an options argument, but not computed ones', () => {
    // Arrange
    const source = [
      "const a = import('./trailing.js',);",
      "const b = import('./options.js', { with: { type: 'json' } });",
      "const c = import('./base' + suffix);",
      "const d = import.source('./phase.js');"
    ].join('\n');

    // Act
    const specifiers = extractImports(source);

    // Assert
    assert.deepEqual(specifiers, ['./trailing.js', './options.js', './phase.js']);
  });

  it('finds imports with Unicode bindings and quoted export names', () => {
    // Arrange
    const source = [
      "import { café } from './unicode.js';",
      "import { 'a-b' as ab } from './quoted-import.js';",
      "export { thing as 'a-b' } from './quoted-export.js';",
      "export * as 'name space' from './quoted-star.js';"
    ].join('\n');

    // Act
    const specifiers = extractImports(source);

    // Assert
    assert.deepEqual(specifiers, ['./unicode.js', './quoted-import.js', './quoted-export.js', './quoted-star.js']);
  });

  it('ignores import text inside strings and templates but finds imports in template substitutions', () => {
    // Arrange
    const source = [
      `const help = "Use import('./example.js') here";`,
      "const sample = `export { thing } from './sample.js';`;",
      "const quoted = 'import \"./quoted.js\"';",
      "const loaded = `Module: ${import('./interpolated.js')}`;",
      "import './real.js';"
    ].join('\n');

    // Act
    const specifiers = extractImports(source);

    // Assert
    assert.deepEqual(specifiers, ['./interpolated.js', './real.js']);
  });

  it('does not read a local export list as export-from when an import follows', () => {
    // Arrange
    const source = "export { a, b }\nimport c from './c.js'\nexport { d }";

    // Act
    const specifiers = extractImports(source);

    // Assert
    assert.deepEqual(specifiers, ['./c.js']);
  });

  it('ignores imports in a comment that follows a division', () => {
    // Arrange
    const source = "const ratio = count++ / 2; // import './comment-only.js';\nimport './real.js';";

    // Act
    const specifiers = extractImports(source);

    // Assert
    assert.deepEqual(specifiers, ['./real.js']);
  });

  it('ignores import methods reached by optional chaining and object keys named import', () => {
    // Arrange
    const source = "loader?.import('./method.js');\nconst table = { import: './key.js' };";

    // Act
    const specifiers = extractImports(source);

    // Assert
    assert.deepEqual(specifiers, []);
  });

  it('returns an empty list when there are no imports', () => {
    // Arrange
    const source = 'export function add(a, b) {\n  return a + b;\n}\n';

    // Act
    const specifiers = extractImports(source);

    // Assert
    assert.deepEqual(specifiers, []);
  });
});

describe('extractHtmlTags', () => {
  it('returns tags with lower-cased names and attributes in source order', () => {
    // Arrange
    const html = '<CANVAS id="map" tabindex=0 hidden aria-label=\'The map\'></CANVAS>';

    // Act
    const tags = extractHtmlTags(html);

    // Assert
    assert.deepEqual(tags, [{
      tag: 'canvas',
      attrs: [
        { name: 'id', value: 'map' },
        { name: 'tabindex', value: '0' },
        { name: 'hidden', value: '' },
        { name: 'aria-label', value: 'The map' }
      ]
    }]);
  });

  it('skips HTML comments and closing tags', () => {
    // Arrange
    const html = '<!-- <div id="old"></div> --><div id="new"></div>';

    // Act
    const tags = extractHtmlTags(html);

    // Assert
    assert.deepEqual(tags, [{ tag: 'div', attrs: [{ name: 'id', value: 'new' }] }]);
  });

  it('copes with > inside quoted attribute values', () => {
    // Arrange
    const html = '<p title="a > b" id="x">text</p>';

    // Act
    const tags = extractHtmlTags(html);

    // Assert
    assert.deepEqual(tags, [{ tag: 'p', attrs: [{ name: 'title', value: 'a > b' }, { name: 'id', value: 'x' }] }]);
  });
});

describe('extractHtmlRefs', () => {
  it('finds src and href on the referencing tags in document order', () => {
    // Arrange
    const html = [
      '<!DOCTYPE html>',
      '<html><head>',
      '<link rel="stylesheet" href="src/ui/styles.css">',
      "<link href='src/ui/screens.css' rel='stylesheet'>",
      '<script type="module" src="src/main.js"></script>',
      '</head><body>',
      '<img alt="logo" src="img/logo.png" />',
      '<a href="#panel">Skip</a>',
      '<iframe src="frame.html"></iframe>',
      '<video><source src="clip.webm" type="video/webm"></video>',
      '<div data-src="ignored.js"></div>',
      '</body></html>'
    ].join('\n');

    // Act
    const refs = extractHtmlRefs(html);

    // Assert
    assert.deepEqual(refs, [
      { tag: 'link', attr: 'href', value: 'src/ui/styles.css' },
      { tag: 'link', attr: 'href', value: 'src/ui/screens.css' },
      { tag: 'script', attr: 'src', value: 'src/main.js' },
      { tag: 'img', attr: 'src', value: 'img/logo.png' },
      { tag: 'a', attr: 'href', value: '#panel' },
      { tag: 'iframe', attr: 'src', value: 'frame.html' },
      { tag: 'source', attr: 'src', value: 'clip.webm' }
    ]);
  });

  it('accepts any attribute order, either quote style and upper-case markup', () => {
    // Arrange
    const html = [
      '<SCRIPT SRC=\'a.js\' TYPE="module"></SCRIPT>',
      '<script defer\n  type="module"\n  src="b.js"></script>',
      '<link\n  href="c.css"\n  rel="stylesheet"\n/>'
    ].join('\n');

    // Act
    const refs = extractHtmlRefs(html);

    // Assert
    assert.deepEqual(refs, [
      { tag: 'script', attr: 'src', value: 'a.js' },
      { tag: 'script', attr: 'src', value: 'b.js' },
      { tag: 'link', attr: 'href', value: 'c.css' }
    ]);
  });

  it('ignores tags that only look similar and refs inside comments', () => {
    // Arrange
    const html = '<abbr href="no.js"></abbr><area href="no2.js"><!-- <script src="old.js"></script> -->';

    // Act
    const refs = extractHtmlRefs(html);

    // Assert
    assert.deepEqual(refs, []);
  });

  it('ignores markup written as text inside script, style, textarea and title', () => {
    // Arrange
    const html = [
      '<title>Use <a href="title.html"> here</title>',
      '<style>p::after { content: "<img src=\'style.png\'>"; }</style>',
      '<script>const example = \'<img src="script.png">\';</SCRIPT >',
      '<textarea><a href="textarea.html">Example markup</a></textarea>',
      '<script type="module" src="src/main.js"></script>',
      '<img src="real.png">'
    ].join('\n');

    // Act
    const refs = extractHtmlRefs(html);

    // Assert
    assert.deepEqual(refs, [
      { tag: 'script', attr: 'src', value: 'src/main.js' },
      { tag: 'img', attr: 'src', value: 'real.png' }
    ]);
  });
});

describe('isExternalRef', () => {
  it('is true for URL schemes, protocol-relative and root-absolute refs', () => {
    // Arrange
    const refs = [
      'http://example.org/a.js',
      'https://example.org/a.css',
      'HTTPS://EXAMPLE.ORG',
      'mailto:someone@example.org',
      '//cdn.example.org/lib.js',
      '/src/main.js'
    ];

    // Act
    const results = refs.map(isExternalRef);

    // Assert
    assert.deepEqual(results, refs.map(() => true));
  });

  it('is false for relative paths, data URLs and fragments', () => {
    // Arrange
    const refs = ['src/main.js', './src/main.js', '../x.css', 'styles.css?v=2', 'data:,', '#panel'];

    // Act
    const results = refs.map(isExternalRef);

    // Assert
    assert.deepEqual(results, refs.map(() => false));
  });
});

describe('isIgnorableRef', () => {
  it('is true for data URLs and fragments', () => {
    // Arrange
    const refs = ['data:,', 'DATA:image/png;base64,AAAA', '#app', '#'];

    // Act
    const results = refs.map(isIgnorableRef);

    // Assert
    assert.deepEqual(results, refs.map(() => true));
  });

  it('is false for files and external URLs', () => {
    // Arrange
    const refs = ['src/main.js', './a.css', 'https://example.org/#x', '/root.js', 'page.html#part'];

    // Act
    const results = refs.map(isIgnorableRef);

    // Assert
    assert.deepEqual(results, refs.map(() => false));
  });
});

describe('resolveRef', () => {
  it('resolves relative to the directory of the referring file', () => {
    // Arrange
    const fromFile = resolve('/repo/src/ui/app.js');

    // Act
    const sibling = resolveRef(fromFile, './panel.js');
    const parent = resolveRef(fromFile, '../engine/index.js');
    const bare = resolveRef(resolve('/repo/index.html'), 'src/main.js');

    // Assert
    assert.equal(sibling, resolve('/repo/src/ui/panel.js'));
    assert.equal(parent, resolve('/repo/src/engine/index.js'));
    assert.equal(bare, resolve('/repo/src/main.js'));
  });

  it('strips the query string and the hash', () => {
    // Arrange
    const fromFile = resolve('/repo/index.html');

    // Act
    const withQuery = resolveRef(fromFile, 'src/ui/styles.css?v=3');
    const withHash = resolveRef(fromFile, 'src/ui/screens.css#top');
    const withBoth = resolveRef(fromFile, './src/main.js?x=1#y');

    // Assert
    assert.equal(withQuery, resolve('/repo/src/ui/styles.css'));
    assert.equal(withHash, resolve('/repo/src/ui/screens.css'));
    assert.equal(withBoth, resolve('/repo/src/main.js'));
  });

  it('decodes percent-escapes in file names', () => {
    // Arrange
    const fromFile = resolve('/repo/index.html');

    // Act
    const result = resolveRef(fromFile, 'my%20file.js');

    // Assert
    assert.equal(result, resolve('/repo/my file.js'));
  });
});
