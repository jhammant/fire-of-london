import { readdirSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';

const REF_TAGS = ['script', 'link', 'img', 'a', 'iframe', 'source'];
const REF_ATTRS = ['src', 'href'];

// Characters after which a '/' starts a regular expression literal rather than a division.
const REGEX_AFTER_CHARS = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
const REGEX_AFTER_WORDS = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);

const IMPORT_PATTERN = new RegExp([
  // import('x') with a plain string or template literal
  /(?<![\w$.])import\s*\(\s*(['"`])([^'"`\n]*)\1\s*\)/.source,
  // import x from 'x', import { a } from 'x', import * as x from 'x', import 'x'
  /(?<![\w$.])import\b\s*(?:[\w$*{},\s]*?\bfrom\s*)?(['"])([^'"\n]*)\3/.source,
  // export { a } from 'x', export * from 'x', export * as x from 'x'
  /(?<![\w$.])export\b\s*[\w$*{},\s]*?\bfrom\s*(['"])([^'"\n]*)\5/.source
].join('|'), 'g');

const TAG_PATTERN = /<([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
const ATTR_PATTERN = /([^\s=/"'>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

/** Lists files under dir recursively, sorted, skipping node_modules and dot-directories. */
export function listFiles(dir, extensions = []) {
  const wanted = [].concat(extensions).filter(Boolean);
  const found = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
          walk(full);
        }
      } else if (entry.isFile() && (wanted.length === 0 || wanted.includes(extname(entry.name)))) {
        found.push(full);
      }
    }
  };
  walk(dir);
  return found.sort();
}

/** Returns the last significant word or character of already-scanned code, for regex detection. */
function previousToken(code) {
  let end = code.length;
  while (end > 0 && /\s/.test(code[end - 1])) {
    end -= 1;
  }
  let start = end;
  while (start > 0 && /[\w$]/.test(code[start - 1])) {
    start -= 1;
  }
  return start < end ? code.slice(start, end) : code.slice(Math.max(0, end - 1), end);
}

/** Reports whether a '/' after the given code starts a regular expression literal. */
function startsRegex(code) {
  const token = previousToken(code);
  if (/^[\w$]+$/.test(token)) {
    return REGEX_AFTER_WORDS.has(token);
  }
  return REGEX_AFTER_CHARS.has(token);
}

/** Returns the index just past a regex literal starting at start, or -1 when none closes on the line. */
function skipRegex(source, start) {
  let inClass = false;
  for (let i = start + 1; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '\n') {
      return -1;
    }
    if (ch === '\\') {
      i += 1;
    } else if (ch === '[') {
      inClass = true;
    } else if (ch === ']') {
      inClass = false;
    } else if (ch === '/' && !inClass) {
      return i + 1;
    }
  }
  return -1;
}

/** Removes // and block comments while keeping strings, template literals and regex literals intact. */
export function stripComments(source) {
  let out = '';
  let i = 0;
  // Each entry is the brace depth of a ${ } expression inside a template literal.
  const templateDepths = [];
  let mode = 'code';
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (mode === 'code') {
      if (ch === '/' && next === '/') {
        const end = source.indexOf('\n', i);
        i = end === -1 ? source.length : end;
      } else if (ch === '/' && next === '*') {
        const end = source.indexOf('*/', i + 2);
        const body = source.slice(i, end === -1 ? source.length : end + 2);
        const newlines = body.replace(/[^\n]/g, '');
        out += newlines || ' ';
        i = end === -1 ? source.length : end + 2;
      } else if (ch === '/' && startsRegex(out)) {
        const end = skipRegex(source, i);
        const stop = end === -1 ? i + 1 : end;
        out += source.slice(i, stop);
        i = stop;
      } else if (ch === '\'' || ch === '"') {
        mode = ch;
        out += ch;
        i += 1;
      } else if (ch === '`') {
        mode = 'template';
        out += ch;
        i += 1;
      } else {
        if (templateDepths.length > 0) {
          const top = templateDepths.length - 1;
          if (ch === '{') {
            templateDepths[top] += 1;
          } else if (ch === '}') {
            if (templateDepths[top] === 0) {
              templateDepths.pop();
              mode = 'template';
            } else {
              templateDepths[top] -= 1;
            }
          }
        }
        out += ch;
        i += 1;
      }
    } else if (mode === 'template') {
      if (ch === '\\') {
        out += source.slice(i, i + 2);
        i += 2;
      } else if (ch === '`') {
        mode = 'code';
        out += ch;
        i += 1;
      } else if (ch === '$' && next === '{') {
        templateDepths.push(0);
        mode = 'code';
        out += '${';
        i += 2;
      } else {
        out += ch;
        i += 1;
      }
    } else if (ch === '\\') {
      out += source.slice(i, i + 2);
      i += 2;
    } else {
      if (ch === mode || ch === '\n') {
        mode = 'code';
      }
      out += ch;
      i += 1;
    }
  }
  return out;
}

/** Returns the specifiers of static, side-effect, export-from and literal dynamic imports, in order. */
export function extractImports(source) {
  const code = stripComments(source);
  const specifiers = [];
  for (const match of code.matchAll(IMPORT_PATTERN)) {
    if (match[2] !== undefined) {
      if (!(match[1] === '`' && match[2].includes('${'))) {
        specifiers.push(match[2]);
      }
    } else {
      specifiers.push(match[4] ?? match[6]);
    }
  }
  return specifiers;
}

/** Returns every start tag in the HTML as { tag, attrs }, skipping HTML comments; attrs keeps source order. */
export function extractHtmlTags(html) {
  const text = html.replace(/<!--[\s\S]*?-->/g, '');
  const tags = [];
  for (const match of text.matchAll(TAG_PATTERN)) {
    const attrs = [];
    for (const attr of match[2].matchAll(ATTR_PATTERN)) {
      attrs.push({ name: attr[1].toLowerCase(), value: attr[2] ?? attr[3] ?? attr[4] ?? '' });
    }
    tags.push({ tag: match[1].toLowerCase(), attrs });
  }
  return tags;
}

/** Returns { tag, attr, value } for each src or href on script, link, img, a, iframe and source tags. */
export function extractHtmlRefs(html) {
  const refs = [];
  for (const { tag, attrs } of extractHtmlTags(html)) {
    if (!REF_TAGS.includes(tag)) {
      continue;
    }
    for (const { name, value } of attrs) {
      if (REF_ATTRS.includes(name)) {
        refs.push({ tag, attr: name, value });
      }
    }
  }
  return refs;
}

/** Reports whether ref points outside the site: a URL scheme, a protocol-relative // or a root-absolute /path. */
export function isExternalRef(ref) {
  const value = String(ref).trim();
  if (/^data:/i.test(value)) {
    return false;
  }
  return /^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('/') || value.startsWith('\\');
}

/** Reports whether ref needs no file on disk: a data: URL or a #fragment. */
export function isIgnorableRef(ref) {
  const value = String(ref).trim();
  return /^data:/i.test(value) || value.startsWith('#');
}

/** Resolves ref against the directory of fromFile, with any query and hash removed. */
export function resolveRef(fromFile, ref) {
  const bare = String(ref).split(/[?#]/)[0];
  let decoded = bare;
  try {
    decoded = decodeURIComponent(bare);
  } catch {
    decoded = bare;
  }
  return resolve(dirname(fromFile), decoded);
}
