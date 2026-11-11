import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CARDS,
  getCard,
  cardsForTrigger,
  cardsForTriggers,
  buildQuiz,
  WHAT_HAPPENED,
  SOURCES,
} from '../src/data/history.js';

const TRIGGERS = [
  'start', 'first-spread', 'warehouses', 'sunday-morning', 'sunday-afternoon',
  'first-douse', 'first-hooks', 'first-gunpowder', 'first-evacuate', 'first-guard',
  'authority', 'bridge', 'tower', 'monday', 'tuesday', 'tuesday-night',
  'wind-drops', 'wednesday', 'end',
];

const REQUIRED_CARDS = {
  'farriners-bakery': 'start',
  'timber-houses': 'start',
  'london-1666': 'start',
  'easterly-gale': 'first-spread',
  'thames-street': 'warehouses',
  bludworth: 'sunday-morning',
  'pepys-diary': 'sunday-afternoon',
  'buckets-and-squirts': 'first-douse',
  firehooks: 'first-hooks',
  'gunpowder-firebreaks': 'first-gunpowder',
  'fleeing-the-fire': 'first-evacuate',
  'fire-posts': 'first-guard',
  'king-and-duke': 'authority',
  'london-bridge': 'bridge',
  'tower-of-london': 'tower',
  'royal-exchange': 'monday',
  'rumours-and-blame': 'monday',
  'pepys-parmesan': 'tuesday',
  'cheapside-and-guildhall': 'tuesday',
  'st-pauls': 'tuesday-night',
  'wind-drops': 'wind-drops',
  moorfields: 'wednesday',
  'fire-ends': 'end',
  'how-many-died': 'end',
  monument: 'end',
  'rebuilding-act': 'end',
  'fire-insurance': 'end',
  'fire-brigades': 'end',
  'plague-myth': 'end',
};

const BANNED_SPELLINGS = [
  'color', 'colors', 'center', 'centered', 'neighbor', 'neighbors', 'gray', 'honor',
  'favorite', 'armor', 'harbor', 'defense', 'organize', 'realize', 'recognize', 'theater',
];

const REQUIRED_SOURCES = [
  ['The Diary of Samuel Pepys', 'Samuel Pepys', 1666],
  ['The Diary of John Evelyn', 'John Evelyn', 1666],
  ['The London Gazette, issue 85', 'London Gazette', 1666],
  ['God\'s Terrible Voice in the City', 'Thomas Vincent', 1667],
  ['Rebuilding of London Act 1666', 'Parliament of England', 1667],
  ['By Permission of Heaven: The Story of the Great Fire of London', 'Adrian Tinniswood', 2003],
  ['The Dreadful Judgement', 'Neil Hanson', 2001],
  ['The Great Fire of London', 'Stephen Porter', 1996],
];

const quizCards = CARDS.filter((card) => card.quiz);
const quizIds = quizCards.map((card) => card.id);

function sentences(text) {
  return text.trim().split(/(?<=[.!?]['"]?)\s+/).filter(Boolean);
}

function wordCount(sentence) {
  return sentence.split(/\s+/).filter(Boolean).length;
}

function collectStrings(value, path, out) {
  if (typeof value === 'string') {
    out.push({ path, value });
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => collectStrings(item, `${path}[${index}]`, out));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => collectStrings(item, `${path}.${key}`, out));
  }
  return out;
}

const ALL_STRINGS = [
  ...collectStrings(CARDS, 'CARDS', []),
  ...collectStrings(WHAT_HAPPENED, 'WHAT_HAPPENED', []),
  ...collectStrings(SOURCES, 'SOURCES', []),
];

test('CARDS has between 24 and 30 cards with unique kebab-case ids', () => {
  // Arrange
  const ids = CARDS.map((card) => card.id);

  // Act
  const unique = new Set(ids);

  // Assert
  assert.ok(CARDS.length >= 24 && CARDS.length <= 30, `found ${CARDS.length} cards`);
  assert.equal(unique.size, ids.length);
  for (const id of ids) {
    assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `bad id ${id}`);
  }
});

test('every required card exists with its trigger', () => {
  for (const [id, trigger] of Object.entries(REQUIRED_CARDS)) {
    // Act
    const card = getCard(id);

    // Assert
    assert.ok(card, `missing card ${id}`);
    assert.equal(card.trigger, trigger, `wrong trigger on ${id}`);
  }
});

test('every card trigger is known and every trigger has a card', () => {
  // Arrange
  const used = new Set(CARDS.map((card) => card.trigger));

  // Assert
  for (const card of CARDS) {
    assert.ok(TRIGGERS.includes(card.trigger), `unknown trigger ${card.trigger} on ${card.id}`);
  }
  for (const trigger of TRIGGERS) {
    assert.ok(used.has(trigger), `no card for trigger ${trigger}`);
  }
});

test('every card has the right fields and types', () => {
  const allowed = ['id', 'title', 'text', 'trigger', 'when', 'learnMore', 'quiz'];
  for (const card of CARDS) {
    assert.deepEqual(Object.keys(card).filter((key) => !allowed.includes(key)), [], `extra keys on ${card.id}`);
    for (const key of ['id', 'title', 'text', 'trigger']) {
      assert.equal(typeof card[key], 'string', `${card.id}.${key}`);
    }
    for (const key of ['when', 'learnMore']) {
      if (key in card) {
        assert.equal(typeof card[key], 'string', `${card.id}.${key}`);
      }
    }
  }
});

test('no string anywhere is empty or whitespace only', () => {
  // Assert
  assert.ok(ALL_STRINGS.length > 100);
  for (const { path, value } of ALL_STRINGS) {
    assert.notEqual(value.trim(), '', `empty string at ${path}`);
  }
});

test('titles have at most 6 words', () => {
  for (const card of CARDS) {
    assert.ok(wordCount(card.title) <= 6, `long title on ${card.id}`);
  }
});

test('card text has 2 or 3 sentences of at most 20 words', () => {
  for (const card of CARDS) {
    // Act
    const parts = sentences(card.text);

    // Assert
    assert.ok(parts.length >= 2 && parts.length <= 3, `${card.id} has ${parts.length} sentences`);
    for (const sentence of parts) {
      assert.ok(wordCount(sentence) <= 20, `${card.id}: too long: ${sentence}`);
    }
  }
});

test('learnMore has 2 to 5 sentences of at most 30 words, and most cards have one', () => {
  // Arrange
  const withMore = CARDS.filter((card) => card.learnMore);

  // Assert
  assert.ok(withMore.length > CARDS.length / 2);
  for (const card of withMore) {
    const parts = sentences(card.learnMore);
    assert.ok(parts.length >= 2 && parts.length <= 5, `${card.id} learnMore has ${parts.length} sentences`);
    for (const sentence of parts) {
      assert.ok(wordCount(sentence) <= 30, `${card.id}: too long: ${sentence}`);
    }
  }
});

test('when lines name a day in September 1666', () => {
  for (const card of CARDS.filter((item) => item.when)) {
    assert.match(card.when, /^(Sunday|Monday|Tuesday|Wednesday|Thursday) [2-6] September 1666$/, card.id);
  }
});

test('at least 15 cards have a well-formed quiz', () => {
  // Assert
  assert.ok(quizCards.length >= 15, `only ${quizCards.length} quizzes`);
  for (const card of quizCards) {
    const { question, options, answer } = card.quiz;
    assert.equal(typeof question, 'string');
    assert.ok(Array.isArray(options) && options.length >= 3 && options.length <= 4, card.id);
    assert.equal(new Set(options).size, options.length, `duplicate options on ${card.id}`);
    for (const option of options) {
      assert.equal(typeof option, 'string');
      assert.notEqual(option.trim(), '');
    }
    assert.ok(Number.isInteger(answer) && answer >= 0 && answer < options.length, `bad answer on ${card.id}`);
  }
});

test('key facts appear on the right cards', () => {
  // Arrange
  const facts = [
    ['farriners-bakery', ['Pudding Lane']],
    ['st-pauls', ['Tuesday', '4 September']],
    ['monument', ['Wren', 'Hooke']],
    ['rebuilding-act', ['1667', 'brick']],
    ['fire-ends', ['Thursday', '6 September']],
    ['pepys-parmesan', ['cheese']],
    ['how-many-died', ['six']],
    ['wind-drops', ['Tuesday']],
  ];

  for (const [id, needles] of facts) {
    // Act
    const card = getCard(id);
    const words = `${card.title} ${card.text} ${card.learnMore ?? ''}`;

    // Assert
    for (const needle of needles) {
      assert.ok(words.includes(needle), `${id} should mention ${needle}`);
    }
  }
});

test('WHAT_HAPPENED has 3 to 5 short paragraphs with the key numbers', () => {
  // Arrange
  const all = WHAT_HAPPENED.join(' ');

  // Assert
  assert.ok(WHAT_HAPPENED.length >= 3 && WHAT_HAPPENED.length <= 5);
  assert.ok(all.includes('13,200'));
  assert.ok(all.includes('87'));
  assert.ok(all.includes('St Paul\'s'));
  for (const paragraph of WHAT_HAPPENED) {
    for (const sentence of sentences(paragraph)) {
      assert.ok(wordCount(sentence) <= 20, `too long: ${sentence}`);
    }
  }
});

test('SOURCES include every required title, author and year with a note', () => {
  for (const [title, author, year] of REQUIRED_SOURCES) {
    // Act
    const source = SOURCES.find((item) => item.title === title);

    // Assert
    assert.ok(source, `missing source ${title}`);
    assert.equal(source.author, author);
    assert.equal(source.year, year);
    assert.equal(typeof source.note, 'string');
  }
});

test('no banned spellings and no URLs in any string', () => {
  // Arrange
  const banned = new RegExp(`\\b(${BANNED_SPELLINGS.join('|')})\\b`, 'i');

  // Assert
  for (const { path, value } of ALL_STRINGS) {
    assert.doesNotMatch(value, banned, `banned spelling at ${path}`);
    assert.doesNotMatch(value, /https?:|www\.|\bwww\b|\/\//i, `URL at ${path}`);
  }
});

test('the source file has no imports, randomness, dates or DOM', () => {
  // Arrange
  const source = readFileSync(new URL('../src/data/history.js', import.meta.url), 'utf8');

  // Assert
  assert.doesNotMatch(source, /^\s*import\b/m);
  assert.doesNotMatch(source, /\bimport\s*\(/);
  assert.doesNotMatch(source, /Math\.random/);
  assert.doesNotMatch(source, /\bDate\b/);
  assert.doesNotMatch(source, /\bdocument\b/);
  assert.doesNotMatch(source, /\bwindow\b/);
  assert.doesNotMatch(source, /\blocalStorage\b/);
  assert.doesNotMatch(source, /export\s+default/);
});

test('getCard finds cards by id and returns undefined for unknown ids', () => {
  // Act
  const found = getCard('st-pauls');
  const missing = getCard('no-such-card');

  // Assert
  assert.equal(found.id, 'st-pauls');
  assert.equal(missing, undefined);
});

test('cardsForTrigger returns cards in CARDS order', () => {
  // Act
  const endCards = cardsForTrigger('end');
  const none = cardsForTrigger('no-such-trigger');

  // Assert
  assert.deepEqual(
    endCards.map((card) => card.id),
    CARDS.filter((card) => card.trigger === 'end').map((card) => card.id),
  );
  assert.ok(endCards.length >= 6);
  assert.deepEqual(none, []);
});

test('cardsForTriggers is unique, in trigger order then CARDS order, ignoring unknown triggers', () => {
  // Arrange
  const triggers = ['tuesday-night', 'bogus', 'start', 'start', 'monday'];

  // Act
  const ids = cardsForTriggers(triggers).map((card) => card.id);

  // Assert
  assert.deepEqual(ids, [
    ...cardsForTrigger('tuesday-night').map((card) => card.id),
    ...cardsForTrigger('start').map((card) => card.id),
    ...cardsForTrigger('monday').map((card) => card.id),
  ]);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(cardsForTriggers([]), []);
});

test('cardsForTriggers over every trigger returns every card once', () => {
  // Act
  const cards = cardsForTriggers(TRIGGERS);

  // Assert
  assert.equal(cards.length, CARDS.length);
});

test('buildQuiz is deterministic for the same arguments', () => {
  // Act
  const first = buildQuiz(quizIds, 42, 5);
  const second = buildQuiz(quizIds, 42, 5);

  // Assert
  assert.deepEqual(first, second);
  assert.equal(first.length, 5);
});

test('buildQuiz varies with the seed', () => {
  // Act
  const results = new Set([1, 2, 3, 4, 5].map((seed) => JSON.stringify(buildQuiz(quizIds, seed, 4))));

  // Assert
  assert.ok(results.size > 1);
});

test('buildQuiz gives at most count questions, 3 by default', () => {
  // Act
  const defaultCount = buildQuiz(quizIds, 7);
  const one = buildQuiz(quizIds, 7, 1);
  const many = buildQuiz(quizIds.slice(0, 2), 7, 10);
  const zero = buildQuiz(quizIds, 7, 0);

  // Assert
  assert.equal(defaultCount.length, 3);
  assert.equal(one.length, 1);
  assert.equal(many.length, 2);
  assert.deepEqual(zero, []);
});

test('buildQuiz uses only listed cards with a quiz, without duplicates', () => {
  // Arrange
  const noQuizIds = CARDS.filter((card) => !card.quiz).map((card) => card.id);
  const ids = [quizIds[0], quizIds[0], quizIds[1], 'no-such-card', ...noQuizIds];

  // Act
  const questions = buildQuiz(ids, 3, 10);

  // Assert
  assert.deepEqual(questions.map((q) => q.cardId).sort(), [quizIds[0], quizIds[1]].sort());
});

test('buildQuiz questions keep the right answer after shuffling options', () => {
  for (const seed of [0, 1, 99, 123456789]) {
    // Act
    const questions = buildQuiz(quizIds, seed, quizIds.length);

    // Assert
    assert.equal(questions.length, quizIds.length);
    for (const q of questions) {
      const original = getCard(q.cardId).quiz;
      assert.deepEqual(Object.keys(q).sort(), ['answer', 'cardId', 'options', 'question']);
      assert.equal(q.question, original.question);
      assert.deepEqual([...q.options].sort(), [...original.options].sort());
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length);
      assert.equal(q.options[q.answer], original.options[original.answer]);
    }
  }
});

test('buildQuiz returns an empty array for empty or unknown input', () => {
  // Act and Assert
  assert.deepEqual(buildQuiz([], 1), []);
  assert.deepEqual(buildQuiz(['no-such-card'], 1), []);
});

test('buildQuiz does not change the cards', () => {
  // Arrange
  const before = JSON.stringify(CARDS);

  // Act
  buildQuiz(quizIds, 5, quizIds.length);

  // Assert
  assert.equal(JSON.stringify(CARDS), before);
});
