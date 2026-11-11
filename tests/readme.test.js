import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const README = readFileSync(fileURLToPath(new URL('../README.md', import.meta.url)), 'utf8');

const HEADINGS = [
  '## How to play',
  '## Controls',
  '## How to run',
  '## Running the tests',
  '## Project layout',
  '## Historical sources',
  '## Accessibility',
  '## Licence'
];

const ACTIONS = [
  { key: '1', label: 'Buckets and squirts', cost: { ap: 1, men: 2, powder: 0, goodwill: 0 } },
  { key: '2', label: 'Firehooks', cost: { ap: 2, men: 4, powder: 0, goodwill: 1 } },
  { key: '3', label: 'Gunpowder', cost: { ap: 2, men: 2, powder: 1, goodwill: 2 } },
  { key: '4', label: 'Evacuate district', cost: { ap: 1, men: 2, powder: 0, goodwill: 0 } },
  { key: '5', label: 'Post men', cost: { ap: 1, men: 3, powder: 0, goodwill: 0 } },
  { key: '6', label: 'Send word to the King', cost: { ap: 1, men: 0, powder: 0, goodwill: 0 } }
];

const SOURCES = [
  { title: 'The Diary of Samuel Pepys', author: 'Samuel Pepys', year: 1666 },
  { title: 'The Diary of John Evelyn', author: 'John Evelyn', year: 1666 },
  { title: 'The London Gazette, issue 85', author: 'London Gazette', year: 1666 },
  { title: 'God\'s Terrible Voice in the City', author: 'Thomas Vincent', year: 1667 },
  { title: 'Rebuilding of London Act 1666', author: 'Parliament of England', year: 1667 },
  { title: 'By Permission of Heaven: The Story of the Great Fire of London', author: 'Adrian Tinniswood', year: 2003 },
  { title: 'The Dreadful Judgement', author: 'Neil Hanson', year: 2001 },
  { title: 'The Great Fire of London', author: 'Stephen Porter', year: 1996 }
];

const RATING_LABELS = ['Worse than 1666', 'Much like 1666', 'Better than 1666', 'Saviour of London'];

const BANNED_SPELLINGS = [
  'color', 'colors', 'center', 'centered', 'neighbor', 'neighbors', 'gray', 'honor', 'favorite',
  'armor', 'harbor', 'defense', 'organize', 'realize', 'recognize', 'theater'
];

/** Collapses runs of whitespace so phrases can be matched across wrapped lines. */
function flatten(text) {
  return text.replace(/\s+/g, ' ');
}

/** Removes fenced code blocks, inline code spans and autolinks from Markdown. */
function proseOnly(markdown) {
  return markdown
    .replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, '')
    .replace(/`[^`\n]*`/g, '')
    .replace(/<[a-z]+:[^>\s]*>/gi, '');
}

/** Describes a section 3 cost the way the README table writes it, for example '2 AP, 4 men, 1 goodwill'. */
function costText(cost) {
  const parts = [`${cost.ap} AP`];
  if (cost.men > 0) {
    parts.push(`${cost.men} men`);
  }
  if (cost.powder > 0) {
    parts.push(`${cost.powder} gunpowder`);
  }
  if (cost.goodwill > 0) {
    parts.push(`${cost.goodwill} goodwill`);
  }
  return parts.join(', ');
}

/** Escapes text for use inside a regular expression. */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('README structure', () => {
  it('starts with a level-one title', () => {
    // Arrange
    const firstLine = README.split('\n')[0];

    // Act
    const isTitle = /^# \S/.test(firstLine);

    // Assert
    assert.ok(isTitle, `README.md should start with a '# ' title, found: ${firstLine}`);
  });

  it('has every required section heading, in order', () => {
    // Arrange
    const lines = README.split('\n').map((line) => line.trimEnd());

    // Act
    const positions = HEADINGS.map((heading) => lines.indexOf(heading));

    // Assert
    HEADINGS.forEach((heading, i) => {
      assert.ok(positions[i] >= 0, `README.md is missing the heading '${heading}'`);
    });
    const sorted = [...positions].sort((a, b) => a - b);
    assert.deepEqual(positions, sorted, 'README.md headings should appear in the contract order');
  });
});

describe('README content', () => {
  it('explains how to start the game and run the tests', () => {
    // Arrange
    const required = ['npm start', 'npm test', 'http://localhost:8080', 'GitHub Pages', 'Node 22', 'file://'];

    // Act
    const missing = required.filter((phrase) => !README.includes(phrase));

    // Assert
    assert.deepEqual(missing, [], `README.md should mention: ${missing.join(', ')}`);
  });

  it('lists every action with its key, exact label and cost in the actions table', () => {
    // Arrange
    const lines = README.split('\n');

    // Act
    const missing = ACTIONS.filter(({ key, label, cost }) => {
      const row = new RegExp(`^\\|\\s*${key}\\s*\\|\\s*${escapeRegExp(label)}\\s*\\|\\s*${escapeRegExp(costText(cost))}\\s*\\|`);
      return !lines.some((line) => row.test(line));
    });

    // Assert
    assert.deepEqual(missing.map((action) => action.label), [], 'each action needs a table row: | key | label | cost |');
  });

  it('names every historical source with its author and year', () => {
    // Arrange
    const text = flatten(README);

    // Act
    const missing = SOURCES.filter(({ title, author, year }) => !text.includes(`*${title}*, ${author} (${year})`));

    // Assert
    assert.deepEqual(missing.map((source) => source.title), [], 'each source should read: *Title*, Author (year)');
  });

  it('names all four ratings', () => {
    // Arrange
    const text = flatten(README);

    // Act
    const missing = RATING_LABELS.filter((label) => !text.includes(label));

    // Assert
    assert.deepEqual(missing, []);
  });

  it('notes what historians are unsure about', () => {
    // Arrange
    const text = flatten(README).toLowerCase();

    // Act
    const topics = {
      cause: text.includes('nobody knows exactly how'),
      deaths: text.includes('six deaths were recorded'),
      simplified: text.includes('simplified')
    };

    // Assert
    assert.deepEqual(topics, { cause: true, deaths: true, simplified: true });
  });

  it('declares the MIT licence', () => {
    // Arrange
    const licence = README.slice(README.indexOf('## Licence'));

    // Act
    const mentionsMit = licence.includes('MIT');

    // Assert
    assert.ok(mentionsMit, 'the Licence section should name the MIT Licence');
  });
});

describe('README spelling', () => {
  it('uses British spellings outside code', () => {
    // Arrange
    const prose = proseOnly(README);
    const pattern = new RegExp(`\\b(${BANNED_SPELLINGS.join('|')})\\b`, 'gi');

    // Act
    const found = [...prose.matchAll(pattern)].map((match) => match[0]);

    // Assert
    assert.deepEqual(found, [], `README.md uses American spellings: ${found.join(', ')}`);
  });

  it('only ignores banned words that sit inside code', () => {
    // Arrange
    const sample = 'A colour.\n\n```css\ncolor: red;\n```\n\nUse `color` here.\nBut gray is wrong.';

    // Act
    const prose = proseOnly(sample);

    // Assert
    assert.ok(!/\bcolor\b/.test(prose), 'code should be removed');
    assert.ok(/\bgray\b/.test(prose), 'prose should be kept');
  });
});
