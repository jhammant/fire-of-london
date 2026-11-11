import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createScreens, formatNumber, buildDebriefModel, gradeQuiz, chronicleSummary,
} from '../src/ui/screens.js';
import { TUTORIAL_STEPS, createTutorial, placeCoach } from '../src/ui/tutorial.js';
import {
  createFakeDocument, pressKey, buttonByText, buildPage, makeScore,
  SAMPLE_CARDS, SAMPLE_DIFFICULTIES, SAMPLE_QUESTIONS, SAMPLE_LANDMARK_NAMES,
} from './helpers/screens-fakes.js';

const BANNED_SPELLINGS = [
  'color', 'colors', 'center', 'centered', 'neighbor', 'neighbors', 'gray', 'honor', 'favorite',
  'armor', 'harbor', 'defense', 'organize', 'realize', 'recognize', 'theater',
];
const PAGE_IDS = [
  'app', 'map-wrap', 'map', 'panel', 'btn-sheet', 'date-time', 'wind-info', 'resources', 'tile-info',
  'actions', 'btn-end-turn', 'btn-chronicle', 'btn-menu', 'btn-help', 'btn-zoom', 'log', 'legend',
  'modal-root', 'tutorial-root', 'live',
];
const ACTION_IDS = ['douse', 'hooks', 'gunpowder', 'evacuate', 'guard', 'appeal'];
const RATING_IDS = ['worse-than-1666', 'like-1666', 'better-than-1666', 'saviour'];

function bannedWordsIn(text) {
  const words = String(text).toLowerCase().match(/[a-z]+/g) ?? [];
  return words.filter((word) => BANNED_SPELLINGS.includes(word));
}

function sentences(text) {
  return text.split(/(?<=[.!?])\s+/).filter(Boolean);
}

function setup(options = {}) {
  const doc = createFakeDocument(options);
  const page = buildPage(doc);
  const screens = createScreens({ doc, root: page.modalRoot, reducedMotion: true });
  return { doc, page, screens };
}

function openDialog(root) {
  const dialogs = root.querySelectorAll('[role="dialog"]');
  assert.equal(dialogs.length, 1, 'exactly one dialog shows');
  return dialogs[0];
}

test('screens and tutorial modules import in Node with no DOM', () => {
  // Arrange and Act: the modules were imported at the top of this file.
  // Assert
  assert.equal(typeof globalThis.document, 'undefined');
  assert.equal(typeof globalThis.window, 'undefined');
  assert.equal(typeof createScreens, 'function');
  assert.equal(typeof createTutorial, 'function');
  assert.ok(Array.isArray(TUTORIAL_STEPS));
});

test('TUTORIAL_STEPS have 8 to 11 steps with unique ids, titles and short sentences', () => {
  // Arrange
  const ids = TUTORIAL_STEPS.map((step) => step.id);

  // Act
  const longSentences = TUTORIAL_STEPS.flatMap((step) => sentences(step.text))
    .filter((sentence) => sentence.split(/\s+/).length > 20);

  // Assert
  assert.ok(TUTORIAL_STEPS.length >= 8 && TUTORIAL_STEPS.length <= 11);
  assert.equal(new Set(ids).size, ids.length);
  for (const step of TUTORIAL_STEPS) {
    assert.match(step.id, /^[a-z]+(-[a-z]+)*$/);
    assert.ok(step.title.trim().length > 0, `${step.id} has a title`);
    assert.ok(step.text.trim().length > 0, `${step.id} has text`);
  }
  assert.deepEqual(longSentences, []);
});

test('TUTORIAL_STEPS targets use only page ids and data-action selectors', () => {
  // Arrange
  const allowed = new Set([...PAGE_IDS.map((id) => `#${id}`), ...ACTION_IDS.map((id) => `[data-action='${id}']`)]);

  // Act
  const badParts = TUTORIAL_STEPS.filter((step) => step.target !== null)
    .flatMap((step) => step.target.split(/\s+/))
    .filter((part) => !allowed.has(part));

  // Assert
  assert.deepEqual(badParts, []);
  assert.equal(TUTORIAL_STEPS[0].target, null, 'the welcome step has no target');
});

test('TUTORIAL_STEPS waits are well formed and cover selecting, dousing and ending the turn', () => {
  // Arrange
  const waits = TUTORIAL_STEPS.filter((step) => step.waitFor).map((step) => step.waitFor);

  // Act
  const shapesOk = waits.every((wait) => ['tile-selected', 'action-done', 'turn-ended'].includes(wait.event)
    && (wait.type === undefined || ACTION_IDS.includes(wait.type))
    && Object.keys(wait).every((key) => key === 'event' || key === 'type'));

  // Assert
  assert.ok(shapesOk);
  assert.ok(TUTORIAL_STEPS.some((s) => s.target === '#map' && s.waitFor?.event === 'tile-selected'));
  assert.ok(TUTORIAL_STEPS.some((s) => s.waitFor?.event === 'action-done' && s.waitFor.type === 'douse'));
  assert.ok(TUTORIAL_STEPS.some((s) => s.target === '#btn-end-turn' && s.waitFor?.event === 'turn-ended'));
  assert.equal(TUTORIAL_STEPS[TUTORIAL_STEPS.length - 1].waitFor, null);
  assert.equal(TUTORIAL_STEPS[TUTORIAL_STEPS.length - 1].target, '#btn-chronicle');
});

test('formatNumber uses British thousands separators', () => {
  // Arrange, Act and Assert
  assert.equal(formatNumber(13200), '13,200');
  assert.equal(formatNumber(87), '87');
  assert.equal(formatNumber(1234567), '1,234,567');
  assert.equal(formatNumber(0), '0');
  assert.equal(formatNumber(-4500), '-4,500');
});

test('buildDebriefModel gives the expected rows for every rating and both outcomes', () => {
  for (const ratingId of RATING_IDS) {
    for (const outcome of ['extinguished', 'thursday']) {
      // Arrange
      const score = makeScore(ratingId);

      // Act
      const model = buildDebriefModel({
        score, outcome, timeLabel: 'Tuesday 4 September, 7pm', landmarkNames: SAMPLE_LANDMARK_NAMES,
      });

      // Assert
      assert.equal(model.ratingLabel, score.rating.label);
      assert.equal(model.ratingText, score.rating.text);
      assert.ok(model.heading.length > 0);
      assert.match(model.outcomeText, /Tuesday 4 September, 7pm/);
      assert.deepEqual(model.rows.map((row) => row.label), [
        'Houses lost',
        'Houses pulled down for firebreaks',
        "St Paul's Cathedral",
        'Great landmarks saved',
        'People safe',
        'Parish churches lost',
        'Deaths',
      ]);
      assert.deepEqual(model.rows[0], { label: 'Houses lost', you: '9,876', history: '13,200' });
      assert.equal(model.rows[1].you, '1,234');
      assert.deepEqual([model.rows[2].you, model.rows[2].history], ['Lost', 'Lost']);
      assert.equal(model.rows[3].you, '2 of 7');
      assert.equal(model.rows[4].you, '72,500 of 80,000');
      assert.equal(model.rows[5].history, '87');
      assert.match(model.rows[6].history, /Only 6 recorded/);
      assert.match(model.rows[6].history, /unknown/);
    }
  }
});

test('buildDebriefModel tells the two outcomes apart and names landmarks', () => {
  // Arrange
  const score = makeScore('saviour', { stPaulsSaved: true, landmarksSaved: ['st-pauls', 'tower'], landmarksLost: ['mystery'] });
  const args = { score, timeLabel: 'Monday 3 September, 1pm', landmarkNames: SAMPLE_LANDMARK_NAMES };

  // Act
  const out = buildDebriefModel({ ...args, outcome: 'extinguished' });
  const late = buildDebriefModel({ ...args, outcome: 'thursday' });

  // Assert
  assert.match(out.outcomeText, /^You put the fire out by Monday 3 September, 1pm\./);
  assert.notEqual(out.heading, late.heading);
  assert.notEqual(out.outcomeText, late.outcomeText);
  assert.equal(out.rows[2].you, 'Saved');
  assert.deepEqual(out.savedNames, ["St Paul's Cathedral", 'Tower of London']);
  assert.deepEqual(out.lostNames, ['mystery'], 'unknown ids fall back to the id');
});

test('gradeQuiz counts right answers and treats missing answers as wrong', () => {
  // Arrange, Act and Assert
  assert.deepEqual(gradeQuiz(SAMPLE_QUESTIONS, [0, 1, 2]), { correct: 3, total: 3 });
  assert.deepEqual(gradeQuiz(SAMPLE_QUESTIONS, [0, 2, 2]), { correct: 2, total: 3 });
  assert.deepEqual(gradeQuiz(SAMPLE_QUESTIONS, [null]), { correct: 0, total: 3 });
  assert.deepEqual(gradeQuiz([], []), { correct: 0, total: 0 });
});

test('chronicleSummary says how many cards are found', () => {
  // Arrange, Act and Assert
  assert.equal(chronicleSummary(5, 28), 'You have found 5 of 28 history cards.');
});

test('player-facing text uses British spellings', async () => {
  // Arrange
  const modelTexts = RATING_IDS.flatMap((ratingId) => ['extinguished', 'thursday'].map((outcome) => {
    const model = buildDebriefModel({ score: makeScore(ratingId), outcome, timeLabel: 'Thursday 6 September, 1am', landmarkNames: SAMPLE_LANDMARK_NAMES });
    return [model.heading, model.outcomeText, ...model.rows.flatMap((row) => [row.label, row.you, row.history])].join(' ');
  }));
  const stepTexts = TUTORIAL_STEPS.map((step) => `${step.title} ${step.text}`);
  // Player-facing literals read like text: they hold a space or start with a capital letter.
  // That leaves out DOM API values such as scrollIntoView's block option, class names and event names.
  const sourceStrings = await Promise.all(['../src/ui/screens.js', '../src/ui/tutorial.js'].map(async (path) => {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    const literals = (source.match(/'[^'\n]*'|`[^`\n]*`|"[^"\n]*"/g) ?? []).map((literal) => literal.slice(1, -1));
    return literals.filter((text) => /\s/.test(text) || /^[A-Z]/.test(text)).join(' ');
  }));

  // Act
  const banned = [...modelTexts, ...stepTexts, ...sourceStrings].flatMap(bannedWordsIn);

  // Assert
  assert.deepEqual(banned, []);
});

test('showCards opens an accessible dialog and resolves after Next and Close', async () => {
  // Arrange
  const { doc, page, screens } = setup();

  // Act
  const done = screens.showCards(SAMPLE_CARDS);
  const first = openDialog(page.modalRoot);
  const titleId = first.getAttribute('aria-labelledby');

  // Assert: the first card
  assert.equal(first.getAttribute('role'), 'dialog');
  assert.equal(first.getAttribute('aria-modal'), 'true');
  assert.equal(doc.getElementById(titleId).textContent, 'The bakery in Pudding Lane');
  assert.ok(first.querySelector('.dialog-kicker').textContent.includes('Sunday 2 September 1666'));
  assert.equal(first.querySelector('.card-count').textContent, 'Card 1 of 2');
  assert.ok(first.contains(doc.activeElement), 'focus moves inside the dialog');
  assert.ok(screens.isOpen());

  // Act: next card, then close
  buttonByText(first, 'Next').click();
  const second = openDialog(page.modalRoot);
  assert.equal(second.querySelector('.card-count').textContent, 'Card 2 of 2');
  assert.ok(second.querySelector('.learn-toggle') === null, 'no Learn more without learnMore');
  buttonByText(second, 'Close').click();

  // Assert
  assert.equal(await done, undefined);
  assert.equal(page.modalRoot.children.length, 0);
  assert.equal(screens.isOpen(), false);
});

test('Learn more toggles aria-expanded and reveals the extra text', () => {
  // Arrange
  const { page, screens } = setup();
  screens.showCards([SAMPLE_CARDS[0]]);
  const dialog = openDialog(page.modalRoot);
  const toggle = dialog.querySelector('.learn-toggle');
  const panel = dialog.querySelector(`#${toggle.getAttribute('aria-controls')}`);

  // Act
  const before = [toggle.getAttribute('aria-expanded'), panel.hasAttribute('hidden')];
  toggle.click();

  // Assert
  assert.deepEqual(before, ['false', true]);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(panel.hasAttribute('hidden'), false);
  assert.equal(panel.textContent, SAMPLE_CARDS[0].learnMore);
});

test('Escape closes a card dialog and focus returns to the opener', async () => {
  // Arrange
  const { doc, page, screens } = setup();
  const opener = doc.getElementById('btn-chronicle');
  opener.focus();
  const done = screens.showCards(SAMPLE_CARDS);

  // Act
  const event = pressKey(doc, 'Escape');
  await done;

  // Assert
  assert.equal(event.propagationStopped, true, 'the shell does not see the key');
  assert.equal(page.modalRoot.children.length, 0);
  assert.ok(doc.activeElement === opener, 'focus returns to the opener');
});

test('Tab and Shift+Tab stay trapped inside the dialog', () => {
  // Arrange
  const { doc, page, screens } = setup();
  screens.showCards([SAMPLE_CARDS[0]]);
  const dialog = openDialog(page.modalRoot);
  const toggle = dialog.querySelector('.learn-toggle');
  const close = buttonByText(dialog, 'Close');

  // Act and Assert: forward from the last control wraps to the first
  close.focus();
  const forward = pressKey(doc, 'Tab');
  assert.equal(forward.defaultPrevented, true);
  assert.ok(doc.activeElement === toggle, 'Tab wraps to the first control');

  // Act and Assert: backward from the first control wraps to the last
  const backward = pressKey(doc, 'Tab', { shiftKey: true });
  assert.equal(backward.defaultPrevented, true);
  assert.ok(doc.activeElement === close, 'Shift+Tab wraps to the last control');

  // Act and Assert: focus that escapes the dialog is pulled back in
  doc.getElementById('map').focus();
  assert.ok(dialog.contains(doc.activeElement));
});

test('showStartMenu resolves with the chosen difficulty and tutorial flag', async () => {
  // Arrange
  const { doc, page, screens } = setup();
  const done = screens.showStartMenu({ difficulties: SAMPLE_DIFFICULTIES, canContinue: false, firstTime: true });
  const dialog = openDialog(page.modalRoot);
  const box = dialog.querySelector('input[type="checkbox"]');
  const hard = dialog.querySelector('input[value="hard"]');

  // Act
  const initial = [dialog.querySelector('input[value="normal"]').checked, box.checked, doc.activeElement.getAttribute('value')];
  hard.click();
  box.click();
  buttonByText(dialog, 'Start a new game').click();

  // Assert
  assert.deepEqual(initial, [true, true, 'normal']);
  assert.ok(buttonByText(dialog, 'Continue your game') === null, 'no Continue without a saved game');
  assert.equal(dialog.querySelectorAll('.choice-desc').length, 3);
  assert.deepEqual(await done, { choice: 'new', difficulty: 'hard', tutorial: false });
});

test('showStartMenu leaves the tutorial unticked for returning players', async () => {
  // Arrange
  const { page, screens } = setup();
  const done = screens.showStartMenu({ difficulties: SAMPLE_DIFFICULTIES, canContinue: false, firstTime: false });
  const dialog = openDialog(page.modalRoot);

  // Act
  buttonByText(dialog, 'Start a new game').click();

  // Assert
  assert.deepEqual(await done, { choice: 'new', difficulty: 'normal', tutorial: false });
});

test('showStartMenu resolves with continue when chosen', async () => {
  // Arrange
  const { doc, page, screens } = setup();
  const done = screens.showStartMenu({ difficulties: SAMPLE_DIFFICULTIES, canContinue: true, firstTime: false });
  const dialog = openDialog(page.modalRoot);
  const continueButton = buttonByText(dialog, 'Continue your game');

  // Act
  const focusedFirst = doc.activeElement === continueButton;
  continueButton.click();

  // Assert
  assert.ok(focusedFirst, 'focus starts on Continue');
  assert.deepEqual(await done, { choice: 'continue' });
});

test('Escape on the start menu only closes it when there is a game to continue', async () => {
  // Arrange
  const { doc, page, screens } = setup();
  screens.showStartMenu({ difficulties: SAMPLE_DIFFICULTIES, canContinue: false, firstTime: true });

  // Act
  pressKey(doc, 'Escape');

  // Assert
  assert.ok(screens.isOpen(), 'the start menu stays open with no game to continue');
  screens.closeAll();
  const done = screens.showStartMenu({ difficulties: SAMPLE_DIFFICULTIES, canContinue: true, firstTime: false });
  pressKey(doc, 'Escape');
  assert.deepEqual(await done, { choice: 'continue' });
  assert.equal(page.modalRoot.children.length, 0);
});

test('dialogs queue so only one shows at a time', async () => {
  // Arrange
  const { page, screens } = setup();
  const first = screens.showMessage({ title: 'First', text: 'One.' });
  const second = screens.showMessage({ title: 'Second', text: 'Two.' });

  // Act
  const shownFirst = openDialog(page.modalRoot).querySelector('.dialog-title').textContent;
  buttonByText(openDialog(page.modalRoot), 'OK').click();
  await first;
  const shownSecond = openDialog(page.modalRoot).querySelector('.dialog-title').textContent;
  buttonByText(openDialog(page.modalRoot), 'OK').click();
  await second;

  // Assert
  assert.deepEqual([shownFirst, shownSecond], ['First', 'Second']);
  assert.equal(page.modalRoot.children.length, 0);
});

test('closeAll resolves the open dialog and every queued one', async () => {
  // Arrange
  const { page, screens } = setup();
  const debrief = screens.showDebrief({
    score: makeScore('like-1666'), outcome: 'thursday', timeLabel: 'Thursday 6 September, 1am',
    landmarkNames: SAMPLE_LANDMARK_NAMES, whatHappened: [], endCards: [], canQuiz: false,
  });
  const quiz = screens.showQuiz(SAMPLE_QUESTIONS);

  // Act
  screens.closeAll();

  // Assert
  assert.equal(await debrief, 'close');
  assert.deepEqual(await quiz, { correct: 0, total: 3 });
  assert.equal(screens.isOpen(), false);
  assert.equal(page.modalRoot.children.length, 0);
});

test('showQuiz names the right answer and resolves with the score', async () => {
  // Arrange
  const { doc, page, screens } = setup();
  const done = screens.showQuiz(SAMPLE_QUESTIONS);
  const picks = [0, 0, 2];

  // Act
  const feedbacks = [];
  for (const pick of picks) {
    const dialog = openDialog(page.modalRoot);
    assert.equal(dialog.querySelector('legend').textContent.length > 0, true);
    assert.ok(dialog.contains(doc.activeElement));
    dialog.querySelectorAll('input[type="radio"]')[pick].click();
    buttonByText(dialog, 'Check answer').click();
    const feedback = dialog.querySelector('.quiz-feedback');
    assert.equal(feedback.getAttribute('aria-live'), 'polite');
    feedbacks.push(feedback.textContent);
    dialog.querySelector('.quiz-next').click();
  }
  const result = openDialog(page.modalRoot);
  const heading = result.querySelector('.dialog-title').textContent;
  buttonByText(result, 'Close').click();

  // Assert
  assert.equal(heading, 'You got 2 out of 3');
  assert.match(feedbacks[0], /Pudding Lane/);
  assert.match(feedbacks[1], /^Not quite\. The right answer is East\./);
  assert.match(feedbacks[2], /The Monument/);
  assert.deepEqual(await done, { correct: 2, total: 3 });
});

test('showQuiz asks for an answer before checking', () => {
  // Arrange
  const { page, screens } = setup();
  screens.showQuiz(SAMPLE_QUESTIONS);
  const dialog = openDialog(page.modalRoot);

  // Act
  buttonByText(dialog, 'Check answer').click();

  // Assert
  assert.equal(dialog.querySelector('.quiz-feedback').textContent, 'Choose an answer first.');
  assert.ok(dialog.querySelector('.quiz-next') === null, 'no Next before an answer is checked');
});

test('showDebrief shows the table and resolves with the button chosen', async () => {
  // Arrange
  const { page, screens } = setup();
  const args = {
    score: makeScore('better-than-1666'),
    outcome: 'extinguished',
    timeLabel: 'Monday 3 September, 7pm',
    landmarkNames: SAMPLE_LANDMARK_NAMES,
    whatHappened: ['First paragraph.', 'Second paragraph.', 'Third paragraph.'],
    endCards: [{ id: 'monument', title: 'The Monument', text: 'A tall column marks the spot.' }],
  };

  // Act
  const quizChoice = screens.showDebrief({ ...args, canQuiz: true });
  const dialog = openDialog(page.modalRoot);
  const snapshot = {
    title: dialog.querySelector('.dialog-title').textContent,
    caption: dialog.querySelector('caption')?.textContent,
    rows: dialog.querySelectorAll('tbody tr').length,
    paragraphs: dialog.querySelectorAll('.debrief-history').length,
    endCards: dialog.querySelectorAll('.end-card').length,
    saved: dialog.querySelectorAll('.landmark-list--saved li').map((li) => li.textContent),
  };
  buttonByText(dialog, 'Take the quiz').click();
  const newChoice = screens.showDebrief({ ...args, canQuiz: false });
  const noQuiz = buttonByText(openDialog(page.modalRoot), 'Take the quiz');
  buttonByText(openDialog(page.modalRoot), 'Play again').click();
  const closeChoice = screens.showDebrief({ ...args, canQuiz: false });
  buttonByText(openDialog(page.modalRoot), 'Close').click();

  // Assert
  assert.deepEqual(snapshot, {
    title: 'Better than 1666',
    caption: 'How you did, compared with 1666',
    rows: 7,
    paragraphs: 3,
    endCards: 1,
    saved: ['Tower of London', 'London Bridge'],
  });
  assert.ok(noQuiz === null, 'no quiz button when canQuiz is false');
  assert.equal(await quizChoice, 'quiz');
  assert.equal(await newChoice, 'new');
  assert.equal(await closeChoice, 'close');
});

test('showChronicle lists the cards found and the sources', async () => {
  // Arrange
  const { doc, page, screens } = setup();
  const sources = [{ title: 'The Diary of Samuel Pepys', author: 'Samuel Pepys', year: 1666, note: 'A daily diary.' }];

  // Act
  const done = screens.showChronicle({ cards: SAMPLE_CARDS, total: 28, sources });
  const dialog = openDialog(page.modalRoot);
  const summary = dialog.querySelector('.chronicle-summary').textContent;
  const titles = dialog.querySelectorAll('.chronicle-card .card-title').map((node) => node.textContent);
  const source = dialog.querySelector('.source').textContent;
  const focusInside = dialog.contains(doc.activeElement);
  pressKey(doc, 'Escape');

  // Assert
  assert.equal(summary, 'You have found 2 of 28 history cards.');
  assert.deepEqual(titles, SAMPLE_CARDS.map((card) => card.title));
  assert.match(source, /The Diary of Samuel Pepys/);
  assert.match(source, /Samuel Pepys, 1666/);
  assert.ok(focusInside);
  assert.equal(await done, undefined);
});

test('empty card and quiz lists resolve at once without a dialog', async () => {
  // Arrange
  const { page, screens } = setup();

  // Act
  const cards = await screens.showCards([]);
  const quiz = await screens.showQuiz([]);

  // Assert
  assert.equal(cards, undefined);
  assert.deepEqual(quiz, { correct: 0, total: 0 });
  assert.equal(page.modalRoot.children.length, 0);
});

test('dialogs decorate with inline SVG and no images', () => {
  // Arrange
  const { page, screens } = setup();

  // Act
  screens.showMessage({ title: 'Hello', text: 'A message.' });
  const dialog = openDialog(page.modalRoot);

  // Assert
  const svg = dialog.querySelector('svg');
  assert.equal(svg.namespaceURI, 'http://www.w3.org/2000/svg');
  assert.equal(svg.getAttribute('aria-hidden'), 'true');
  assert.equal(dialog.querySelectorAll('img').length, 0);
});

test('the tutorial advances on Next and waits for the matching event', () => {
  // Arrange
  const { doc, page } = setup();
  const finished = [];
  const tutorial = createTutorial({ doc, root: page.tutorialRoot, onFinish: (info) => finished.push(info) });
  const title = () => page.tutorialRoot.querySelector('.coach-title').textContent;
  const nextButton = () => page.tutorialRoot.querySelector('.coach-next');

  // Act and Assert: the welcome step
  tutorial.start();
  assert.ok(tutorial.isActive());
  assert.equal(title(), TUTORIAL_STEPS[0].title);
  assert.ok(doc.activeElement === nextButton(), 'focus starts on Next');
  const bubble = page.tutorialRoot.querySelector('.coach');
  assert.equal(bubble.getAttribute('aria-modal'), 'false');
  assert.equal(doc.getElementById(bubble.getAttribute('aria-labelledby')).textContent, TUTORIAL_STEPS[0].title);
  tutorial.notify('tile-selected', { x: 1, y: 1, tile: {} });
  assert.equal(title(), TUTORIAL_STEPS[0].title, 'events are ignored on a Next step');

  // Act and Assert: Next moves to the select step, which hides Next and highlights the map
  nextButton().click();
  assert.equal(title(), TUTORIAL_STEPS[1].title);
  assert.ok(nextButton().hasAttribute('hidden'));
  assert.ok(page.map.classList.contains('tutorial-target'));
  assert.ok(doc.activeElement === page.map, 'keyboard users land on the map');
  assert.match(page.tutorialRoot.querySelector('.coach-announcer').textContent, /Step 2 of/i);
  tutorial.notify('turn-ended', {});
  assert.equal(title(), TUTORIAL_STEPS[1].title, 'a different event is ignored');
  tutorial.notify('tile-selected', { x: 20, y: 14, tile: { fire: 2 } });
  assert.equal(title(), TUTORIAL_STEPS[2].title);
  assert.equal(page.map.classList.contains('tutorial-target'), false, 'the old highlight is removed');
  assert.ok(page.tileInfo.classList.contains('tutorial-target'));
  assert.deepEqual(finished, []);
});

test('the tutorial douse step needs a douse action and the end-turn step needs a turn end', () => {
  // Arrange
  const { doc, page } = setup();
  const finished = [];
  const tutorial = createTutorial({ doc, root: page.tutorialRoot, onFinish: (info) => finished.push(info) });
  const current = () => page.tutorialRoot.querySelector('.coach-title').textContent;
  const douseIndex = TUTORIAL_STEPS.findIndex((s) => s.waitFor?.type === 'douse');
  const douseButton = page.actions.querySelector("[data-action='douse']");
  tutorial.start();

  // Act: walk forward to the douse step
  while (current() !== TUTORIAL_STEPS[douseIndex].title) {
    const step = TUTORIAL_STEPS.find((s) => s.title === current());
    if (step.waitFor) tutorial.notify(step.waitFor.event, { type: step.waitFor.type });
    else page.tutorialRoot.querySelector('.coach-next').click();
  }

  // Assert
  assert.ok(douseButton.classList.contains('tutorial-target'));
  tutorial.notify('action-done', { type: 'hooks' });
  assert.equal(current(), TUTORIAL_STEPS[douseIndex].title, 'the wrong action is ignored');
  tutorial.notify('action-done', { type: 'douse' });
  assert.equal(current(), TUTORIAL_STEPS[douseIndex + 1].title);

  // Act: walk to the end and press the last button
  while (tutorial.isActive()) {
    const step = TUTORIAL_STEPS.find((s) => s.title === current());
    if (step.waitFor) tutorial.notify(step.waitFor.event, { type: step.waitFor.type });
    else page.tutorialRoot.querySelector('.coach-next').click();
  }

  // Assert
  assert.deepEqual(finished, [{ skipped: false }]);
  assert.equal(page.tutorialRoot.children.length, 0);
  assert.equal(doc.querySelectorAll('.tutorial-target').length, 0);
});

test('skip() ends the tutorial and calls onFinish with skipped true', () => {
  // Arrange
  const { doc, page } = setup();
  const finished = [];
  const tutorial = createTutorial({ doc, root: page.tutorialRoot, onFinish: (info) => finished.push(info) });
  tutorial.start();
  page.tutorialRoot.querySelector('.coach-next').click();

  // Act
  tutorial.skip();
  tutorial.skip();
  tutorial.notify('tile-selected', {});

  // Assert
  assert.deepEqual(finished, [{ skipped: true }]);
  assert.equal(tutorial.isActive(), false);
  assert.equal(page.tutorialRoot.children.length, 0);
  assert.equal(page.map.classList.contains('tutorial-target'), false);
  assert.equal(doc.defaultView.listenerCount('resize'), 0, 'the resize listener is removed');
});

test('the Skip tutorial button finishes with skipped true', () => {
  // Arrange
  const { doc, page } = setup();
  const finished = [];
  const tutorial = createTutorial({ doc, root: page.tutorialRoot, onFinish: (info) => finished.push(info) });
  tutorial.start();

  // Act
  buttonByText(page.tutorialRoot, 'Skip tutorial').click();

  // Assert
  assert.deepEqual(finished, [{ skipped: true }]);
  assert.ok(doc.activeElement === page.map, 'focus goes to the map when the bubble closes');
});

test('the coach bubble sits beside its target and at the top on narrow screens', () => {
  // Arrange
  const wide = setup({ width: 1280, height: 800 });
  const narrow = setup({ width: 360, height: 740 });
  const wideTutorial = createTutorial({ doc: wide.doc, root: wide.page.tutorialRoot });
  const narrowTutorial = createTutorial({ doc: narrow.doc, root: narrow.page.tutorialRoot });

  // Act: step 3 points at the tile panel on the right-hand side
  for (const [tutorial, page] of [[wideTutorial, wide.page], [narrowTutorial, narrow.page]]) {
    tutorial.start();
    page.tutorialRoot.querySelector('.coach-next').click();
    tutorial.notify('tile-selected', { x: 1, y: 1 });
  }
  const wideBubble = wide.page.tutorialRoot.querySelector('.coach');
  const narrowBubble = narrow.page.tutorialRoot.querySelector('.coach');

  // Assert
  assert.equal(wideBubble.getAttribute('data-placement'), 'left');
  assert.equal(wideBubble.style.left, '888px');
  assert.equal(narrowBubble.getAttribute('data-placement'), 'top');
  assert.equal(narrowBubble.style.left, '');
});

test('placeCoach prefers the right, then the left, and gives up when nothing fits', () => {
  // Arrange
  const viewport = { width: 1000, height: 700 };
  const bubble = { width: 300, height: 150 };
  const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });

  // Act
  const right = placeCoach(rect(100, 100, 50, 40), bubble, viewport);
  const left = placeCoach(rect(800, 650, 150, 40), bubble, viewport);
  const below = placeCoach(rect(0, 0, 1000, 200), bubble, viewport);
  const none = placeCoach(rect(0, 0, 1000, 700), bubble, viewport);

  // Assert
  assert.deepEqual(right, { side: 'right', left: 162, top: 100 });
  assert.deepEqual(left, { side: 'left', left: 488, top: 542 });
  assert.deepEqual(below, { side: 'below', left: 8, top: 212 });
  assert.equal(none, null);
});
