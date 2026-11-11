import { readdirSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';

const REF_TAGS = ['script', 'link', 'img', 'a', 'iframe', 'source'];
const REF_ATTRS = ['src', 'href'];

// Elements whose content the HTML parser reads as text, so tags written inside them are not elements.
const RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes']);

const START_TAG = /<([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/y;
const ATTR_PATTERN = /([^\s=/"'>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

// Words after which a '/' starts a regular expression literal rather than a division.
const REGEX_AFTER_WORDS = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
// Punctuators that end an operand, so a '/' after them is a division. ++ and -- count as postfix,
// because a regex cannot follow a prefix ++ or --. After ')' a regex is possible (if (x) /re/.test(s))
// but rare; it is read as a division.
const DIVISION_AFTER_PUNCTUATORS = new Set([')', ']', '++', '--']);

const LINE_TERMINATORS = new Set(['\n', '\r', '\u2028', '\u2029']);
const WORD = /(?:[\p{ID_Continue}$\u200c\u200d]|\\u(?:\{[\da-fA-F]+\}|[\da-fA-F]{4}))+/uy;
const PUNCTUATOR = /\.\.\.|\?\.(?!\d)|\+\+|--|[\s\S]/uy;
const ESCAPE = /\\(?:u\{([\da-fA-F]+)\}|u([\da-fA-F]{4})|x([\da-fA-F]{2})|(\r\n|[\n\r\u2028\u2029])|([\s\S]))/g;
const SIMPLE_ESCAPES = { b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v', 0: '\0' };

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

/** Returns the index of the first line terminator at or after start, or the source length. */
function lineEnd(source, start) {
  let i = start;
  while (i < source.length && !LINE_TERMINATORS.has(source[i])) {
    i += 1;
  }
  return i;
}

/** Replaces the escape sequences in string or template text with the characters they stand for. */
function cook(text) {
  return text.replace(ESCAPE, (whole, braced, unicode, hex, lineBreak, other) => {
    const code = parseInt(braced ?? unicode ?? hex, 16);
    if (!Number.isNaN(code)) {
      return code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    if (lineBreak !== undefined) {
      return '';
    }
    return SIMPLE_ESCAPES[other] ?? other;
  });
}

/** Reports whether a '/' after the given significant token starts a regular expression literal. */
function regexAllowedAfter(token) {
  if (token === null) {
    return true;
  }
  switch (token.type) {
    case 'word':
      return REGEX_AFTER_WORDS.has(token.value);
    case 'punct':
      return !DIVISION_AFTER_PUNCTUATORS.has(token.value);
    case 'template-head':
    case 'template-middle':
      return true;
    default:
      return false;
  }
}

/** Returns the index just past a regex literal (and its flags) starting at start, or -1 when none closes on the line. */
function regexEnd(source, start) {
  let inClass = false;
  for (let i = start + 1; i < source.length; i += 1) {
    const ch = source[i];
    if (LINE_TERMINATORS.has(ch)) {
      return -1;
    }
    if (ch === '\\') {
      i += 1;
      if (LINE_TERMINATORS.has(source[i])) {
        return -1;
      }
    } else if (ch === '[') {
      inClass = true;
    } else if (ch === ']') {
      inClass = false;
    } else if (ch === '/' && !inClass) {
      WORD.lastIndex = i + 1;
      return WORD.exec(source) ? WORD.lastIndex : i + 1;
    }
  }
  return -1;
}

/** Reads a quoted string starting at start; an unclosed string stops before its line break. */
function stringText(source, start) {
  const quote = source[start];
  for (let i = start + 1; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '\\') {
      i += source[i + 1] === '\r' && source[i + 2] === '\n' ? 2 : 1;
    } else if (ch === quote) {
      return { textEnd: i, end: i + 1 };
    } else if (ch === '\n' || ch === '\r') {
      return { textEnd: i, end: i };
    }
  }
  return { textEnd: source.length, end: source.length };
}

/** Reads template text from start up to a closing backtick or a ${, whichever comes first. */
function templateText(source, start) {
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '\\') {
      i += 1;
    } else if (ch === '`') {
      return { textEnd: i, end: i + 1, substitution: false };
    } else if (ch === '$' && source[i + 1] === '{') {
      return { textEnd: i, end: i + 2, substitution: true };
    }
  }
  return { textEnd: source.length, end: source.length, substitution: false };
}

/**
 * Splits JavaScript source into tokens of { type, value, start, end }. The types are 'comment',
 * 'hashbang', 'string', 'template' (no substitutions), 'template-head', 'template-middle',
 * 'template-tail', 'regex', 'word' and 'punct'. String and template tokens carry their cooked
 * text in value; the others carry their source text.
 */
function tokenize(source) {
  const tokens = [];
  // One entry per open brace: 'code' for {, 'template' for the ${ of a template literal.
  const braces = [];
  let previous = null;
  let i = 0;
  const push = (type, start, end, value = source.slice(start, end)) => {
    const token = { type, value, start, end };
    tokens.push(token);
    if (type !== 'comment' && type !== 'hashbang') {
      previous = token;
    }
    i = end;
  };
  const pushTemplate = (start, textStart, opening) => {
    const { textEnd, end, substitution } = templateText(source, textStart);
    const type = opening
      ? (substitution ? 'template-head' : 'template')
      : (substitution ? 'template-middle' : 'template-tail');
    if (substitution) {
      braces.push('template');
    }
    push(type, start, end, cook(source.slice(textStart, textEnd)));
  };

  if (source.startsWith('#!')) {
    push('hashbang', 0, lineEnd(source, 0));
  }
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    const comment = ch === '/' && (next === '/' || next === '*');
    const regexStop = ch === '/' && !comment && regexAllowedAfter(previous) ? regexEnd(source, i) : -1;
    if (/\s/u.test(ch)) {
      i += 1;
    } else if (ch === '/' && next === '/') {
      push('comment', i, lineEnd(source, i));
    } else if (ch === '/' && next === '*') {
      const close = source.indexOf('*/', i + 2);
      push('comment', i, close === -1 ? source.length : close + 2);
    } else if (regexStop !== -1) {
      push('regex', i, regexStop);
    } else if (ch === '\'' || ch === '"') {
      const { textEnd, end } = stringText(source, i);
      push('string', i, end, cook(source.slice(i + 1, textEnd)));
    } else if (ch === '`') {
      pushTemplate(i, i + 1, true);
    } else if (ch === '}' && braces.at(-1) === 'template') {
      braces.pop();
      pushTemplate(i, i + 1, false);
    } else {
      WORD.lastIndex = i;
      if (WORD.exec(source)) {
        push('word', i, WORD.lastIndex);
        continue;
      }
      if (ch === '{') {
        braces.push('code');
      } else if (ch === '}') {
        braces.pop();
      }
      PUNCTUATOR.lastIndex = i;
      PUNCTUATOR.exec(source);
      push('punct', i, PUNCTUATOR.lastIndex);
    }
  }
  return tokens;
}

/** Removes // and block comments while keeping strings, template literals and regex literals intact. */
export function stripComments(source) {
  let out = '';
  let copied = 0;
  for (const token of tokenize(source)) {
    if (token.type === 'comment') {
      out += source.slice(copied, token.start);
      if (token.value.startsWith('/*')) {
        const lineBreaks = token.value.match(/\r\n|[\n\r\u2028\u2029]/g);
        out += lineBreaks ? lineBreaks.join('') : ' ';
      }
      copied = token.end;
    }
  }
  return out + source.slice(copied);
}

function isWord(token, value) {
  return token?.type === 'word' && token.value === value;
}

function isPunct(token, value) {
  return token?.type === 'punct' && token.value === value;
}

/** Returns the string after a 'from' at index, or null when there is none. */
function fromSpecifier(tokens, index) {
  return isWord(tokens[index], 'from') && tokens[index + 1]?.type === 'string' ? tokens[index + 1].value : null;
}

/** Returns the index of the '}' closing the import or export name list opened at index, or -1. */
function closingBrace(tokens, index) {
  for (let i = index + 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (isPunct(token, '}')) {
      return i;
    }
    if (!(token.type === 'word' || token.type === 'string' || isPunct(token, ','))) {
      return -1;
    }
  }
  return -1;
}

/** Returns the literal specifier of import(...) when its first argument is a whole string, or null. */
function dynamicSpecifier(tokens, open) {
  if (!isPunct(tokens[open], '(')) {
    return null;
  }
  const argument = tokens[open + 1];
  const after = tokens[open + 2];
  const literal = argument?.type === 'string' || argument?.type === 'template';
  return literal && (isPunct(after, ')') || isPunct(after, ',')) ? argument.value : null;
}

/** Returns the specifier of the import starting at the 'import' token at index, or null when it is not one. */
function importSpecifier(tokens, index) {
  const next = tokens[index + 1];
  if (isPunct(next, '(')) {
    return dynamicSpecifier(tokens, index + 1);
  }
  if (isPunct(next, '.')) {
    // import.meta is not an import; the phase forms import.source('x') and import.defer('x') are.
    const phase = tokens[index + 2];
    return isWord(phase, 'source') || isWord(phase, 'defer') ? dynamicSpecifier(tokens, index + 3) : null;
  }
  if (next?.type === 'string') {
    return next.value;
  }
  // An import clause: bindings, '*', 'as', commas and at most one { } list, then from '...'.
  for (let i = index + 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    const specifier = fromSpecifier(tokens, i);
    if (specifier !== null) {
      return specifier;
    }
    if (isPunct(token, '{')) {
      const close = closingBrace(tokens, i);
      return close === -1 ? null : fromSpecifier(tokens, close + 1);
    }
    if (!(token.type === 'word' || isPunct(token, '*') || isPunct(token, ','))) {
      return null;
    }
  }
  return null;
}

/** Returns the specifier of export * from or export { } from at the 'export' token at index, or null. */
function exportSpecifier(tokens, index) {
  let next = index + 1;
  if (isPunct(tokens[next], '*')) {
    next += 1;
    if (isWord(tokens[next], 'as')) {
      next += 2;
    }
  } else if (isPunct(tokens[next], '{')) {
    const close = closingBrace(tokens, next);
    if (close === -1) {
      return null;
    }
    next = close + 1;
  } else {
    return null;
  }
  return fromSpecifier(tokens, next);
}

/** Returns the specifiers of static, side-effect, export-from and literal dynamic imports, in order. */
export function extractImports(source) {
  const tokens = tokenize(source).filter((token) => token.type !== 'comment' && token.type !== 'hashbang');
  const specifiers = [];
  tokens.forEach((token, index) => {
    const previous = tokens[index - 1];
    if (token.type !== 'word' || isPunct(previous, '.') || isPunct(previous, '?.')) {
      return;
    }
    let specifier = null;
    if (token.value === 'import') {
      specifier = importSpecifier(tokens, index);
    } else if (token.value === 'export') {
      specifier = exportSpecifier(tokens, index);
    }
    if (specifier !== null) {
      specifiers.push(specifier);
    }
  });
  return specifiers;
}

/** Returns the index where the raw text content of tag, starting at from, ends. */
function rawTextEnd(html, tag, from) {
  const endTag = new RegExp(`</${tag}[\\t\\n\\f\\r />]`, 'gi');
  endTag.lastIndex = from;
  const found = endTag.exec(html);
  return found ? found.index : html.length;
}

/** Parses the attribute text of a start tag into { name, value } entries in source order. */
function parseAttributes(text) {
  return [...text.matchAll(ATTR_PATTERN)].map((attr) => ({
    name: attr[1].toLowerCase(),
    value: attr[2] ?? attr[3] ?? attr[4] ?? ''
  }));
}

/**
 * Returns every start tag in the HTML as { tag, attrs }, in order; attrs keeps source order.
 * HTML comments are skipped, and so is the text inside raw text elements such as script and textarea.
 */
export function extractHtmlTags(html) {
  const tags = [];
  let i = html.indexOf('<');
  while (i !== -1) {
    if (html.startsWith('<!--', i)) {
      const close = html.indexOf('-->', i + 4);
      i = close === -1 ? -1 : html.indexOf('<', close + 3);
      continue;
    }
    START_TAG.lastIndex = i;
    const match = START_TAG.exec(html);
    if (!match) {
      i = html.indexOf('<', i + 1);
      continue;
    }
    const tag = match[1].toLowerCase();
    tags.push({ tag, attrs: parseAttributes(match[2]) });
    const resume = RAW_TEXT_TAGS.has(tag) ? rawTextEnd(html, tag, START_TAG.lastIndex) : START_TAG.lastIndex;
    i = html.indexOf('<', resume);
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
