// Dialog screens for Fire Of London: start menu, history cards, Chronicle, debrief, quiz and messages.
// Everything arrives as arguments; no DOM is touched until createScreens is called.

const SVG_NS = 'http://www.w3.org/2000/svg';
const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]';
const HISTORY_1666 = Object.freeze({ housesLost: 13200, churchesLost: 87, stPaulsLost: true, deathsRecorded: 6 });

const FLAME_OUTER = 'M12 1C13 6 19 10 19 18C19 25 15.5 30 12 30C8.5 30 5 25 5 18C5 13 8 10 9 6C10 9 10 11 11 12C12 9 12.5 5 12 1Z';
const FLAME_INNER = 'M12 14C13 17 16 19 15.5 23C15.2 26 13.8 28 12 28C10.2 28 8.7 26 8.6 23.5C8.5 21 10.5 19.5 11 17C11.6 18.5 12 19.5 12 21C12.8 19 12.6 16 12 14Z';
const FLAME_HATCH = 'M7.5 17.5L9 15M7 21.5L8.8 19M16.5 17.5L15 15M17 21.5L15.2 19';

let idCounter = 0;

function uid(prefix) {
  idCounter += 1;
  return `fol-${prefix}-${idCounter}`;
}

/** Formats a whole number with British thousands separators, for example 13200 -> '13,200'. */
export function formatNumber(n) {
  const value = Math.round(Number(n) || 0);
  const digits = String(Math.abs(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return value < 0 ? `-${digits}` : digits;
}

/** Counts right answers, where answers[i] is the option index chosen for questions[i]. */
export function gradeQuiz(questions, answers) {
  const list = Array.isArray(questions) ? questions : [];
  const chosen = Array.isArray(answers) ? answers : [];
  const correct = list.filter((question, i) => chosen[i] === question.answer).length;
  return { correct, total: list.length };
}

/** One line telling the player how many history cards they have found. */
export function chronicleSummary(found, total) {
  return `You have found ${formatNumber(found)} of ${formatNumber(total)} history cards.`;
}

/** Turns an engine score into the text and table rows of the end-of-game debrief. */
export function buildDebriefModel({ score, outcome, timeLabel, landmarkNames = {} }) {
  const history = { ...HISTORY_1666, ...score.history };
  const saved = score.landmarksSaved ?? [];
  const lost = score.landmarksLost ?? [];
  const nameOf = (id) => landmarkNames[id] ?? id;
  const extinguished = outcome === 'extinguished';
  return {
    heading: extinguished ? 'The fire is out' : 'Thursday has come',
    ratingLabel: score.rating?.label ?? '',
    ratingText: score.rating?.text ?? '',
    outcomeText: extinguished
      ? `You put the fire out by ${timeLabel}. In 1666 it burned until Thursday 6 September.`
      : `Time is up: it is ${timeLabel}. By then in 1666, the wind had dropped and the fire was nearly out.`,
    rows: [
      { label: 'Houses lost', you: formatNumber(score.housesLost), history: formatNumber(history.housesLost) },
      {
        label: 'Houses pulled down for firebreaks',
        you: formatNumber(score.housesPulledDown),
        history: 'Many, but no one knows how many',
      },
      {
        label: "St Paul's Cathedral",
        you: score.stPaulsSaved ? 'Saved' : 'Lost',
        history: history.stPaulsLost ? 'Lost' : 'Saved',
      },
      {
        label: 'Great landmarks saved',
        you: `${saved.length} of ${saved.length + lost.length}`,
        history: 'Most burned, but the Tower was saved',
      },
      {
        label: 'People safe',
        you: `${formatNumber(score.peopleSafe)} of ${formatNumber(score.peopleTotal)}`,
        history: 'Most got away, but about 70,000 lost their homes',
      },
      { label: 'Parish churches lost', you: 'Not counted in this game', history: formatNumber(history.churchesLost) },
      {
        label: 'Deaths',
        you: 'Not counted in this game',
        history: `Only ${formatNumber(history.deathsRecorded)} recorded; the real number is unknown`,
      },
    ],
    savedNames: saved.map(nameOf),
    lostNames: lost.map(nameOf),
  };
}

function quizVerdict({ correct, total }) {
  if (correct === total) return 'Every answer right. You really know your history!';
  if (correct * 2 >= total) return 'Well done. You know a lot about the Great Fire.';
  return 'Good try! The Chronicle can help you learn more.';
}

function make(doc, tag, attrs = {}, children = []) {
  const node = doc.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (name === 'text') node.textContent = String(value);
    else node.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children) if (child) node.append(child);
  return node;
}

function makeSvg(doc, tag, attrs) {
  const node = doc.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
}

function woodcutFlame(doc) {
  const icon = makeSvg(doc, 'svg', {
    class: 'woodcut-flame', viewBox: '0 0 24 32', width: '18', height: '24', 'aria-hidden': 'true', focusable: 'false',
  });
  icon.append(
    makeSvg(doc, 'path', { class: 'flame-outer', fill: '#d55e00', stroke: '#2b1d0e', d: FLAME_OUTER }),
    makeSvg(doc, 'path', { class: 'flame-inner', fill: '#f0e442', stroke: '#2b1d0e', d: FLAME_INNER }),
    makeSvg(doc, 'path', { class: 'flame-hatch', fill: 'none', stroke: '#2b1d0e', d: FLAME_HATCH }),
  );
  return icon;
}

function makeButton(doc, text, className, onClick) {
  const node = make(doc, 'button', { type: 'button', class: className, text });
  node.addEventListener('click', onClick);
  return node;
}

function learnMoreToggle(doc, text) {
  const panelId = uid('learn');
  const panel = make(doc, 'p', { id: panelId, class: 'learn-more', hidden: true, text });
  const toggle = makeButton(doc, 'Learn more', 'learn-toggle', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    if (open) panel.removeAttribute('hidden');
    else panel.setAttribute('hidden', '');
  });
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', panelId);
  return [toggle, panel];
}

function buildDialog(doc, { kind, title, kicker, scrollBody = false, reducedMotion }) {
  const titleId = uid('title');
  const dialog = make(doc, 'div', {
    class: `dialog dialog--${kind}${reducedMotion ? '' : ' is-animated'}`,
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': titleId,
    tabindex: '-1',
  });
  const header = make(doc, 'div', { class: 'dialog-header' }, [
    kicker ? make(doc, 'p', { class: 'dialog-kicker', text: kicker }) : null,
    make(doc, 'h2', { id: titleId, class: 'dialog-title', text: title }),
  ]);
  const rule = make(doc, 'div', { class: 'ink-rule', 'aria-hidden': 'true' }, [woodcutFlame(doc)]);
  const bodyAttrs = scrollBody
    ? { class: 'dialog-body', role: 'region', 'aria-labelledby': titleId, tabindex: '0' }
    : { class: 'dialog-body' };
  const body = make(doc, 'div', bodyAttrs);
  const footer = make(doc, 'div', { class: 'dialog-footer' });
  dialog.append(header, rule, body, footer);
  return { dialog, body, footer };
}

function isHidden(node, stop) {
  for (let at = node; at && at !== stop; at = at.parentNode) {
    if (at.getAttribute('hidden') !== null) return true;
  }
  return false;
}

function tabStops(container) {
  const nodes = [...container.querySelectorAll(FOCUSABLE)].filter(
    (node) => !node.disabled && node.getAttribute('tabindex') !== '-1' && !isHidden(node, container),
  );
  const groups = new Map();
  for (const node of nodes) {
    if (node.getAttribute('type') !== 'radio') continue;
    const name = node.getAttribute('name');
    const group = groups.get(name) ?? { first: node, checked: null };
    if (node.checked && !group.checked) group.checked = node;
    groups.set(name, group);
  }
  return nodes.filter((node) => {
    if (node.getAttribute('type') !== 'radio') return true;
    const group = groups.get(node.getAttribute('name'));
    return node === (group.checked ?? group.first);
  });
}

function sourceItem(doc, source) {
  return make(doc, 'li', { class: 'source' }, [
    make(doc, 'cite', { class: 'source-title', text: source.title }),
    make(doc, 'span', { class: 'source-meta', text: `${source.author}, ${source.year}` }),
    source.note ? make(doc, 'span', { class: 'source-note', text: source.note }) : null,
  ]);
}

function debriefTable(doc, rows) {
  const head = make(doc, 'thead', {}, [
    make(doc, 'tr', {}, [
      make(doc, 'th', { scope: 'col', text: 'What' }),
      make(doc, 'th', { scope: 'col', text: 'You' }),
      make(doc, 'th', { scope: 'col', text: '1666' }),
    ]),
  ]);
  const body = make(doc, 'tbody', {}, rows.map((row) => make(doc, 'tr', {}, [
    make(doc, 'th', { scope: 'row', text: row.label }),
    make(doc, 'td', { text: row.you }),
    make(doc, 'td', { text: row.history }),
  ])));
  return make(doc, 'table', { class: 'debrief-table' }, [
    make(doc, 'caption', { text: 'How you did, compared with 1666' }),
    head,
    body,
  ]);
}

function nameList(doc, heading, names, kind) {
  return make(doc, 'div', { class: `landmark-list landmark-list--${kind}` }, [
    make(doc, 'h3', { text: heading }),
    names.length
      ? make(doc, 'ul', {}, names.map((name) => make(doc, 'li', { text: name })))
      : make(doc, 'p', { class: 'landmark-none', text: 'None' }),
  ]);
}

/** Creates the dialog manager that draws every modal screen inside root (the #modal-root element). */
export function createScreens({ doc, root, reducedMotion = false } = {}) {
  const host = root ?? doc.body;
  const queue = [];
  let current = null;

  function focusFirst(dialog) {
    (tabStops(dialog)[0] ?? dialog).focus();
  }

  function onFocusIn(event) {
    if (current?.dialog && !current.dialog.contains(event.target)) focusFirst(current.dialog);
  }

  function trapTab(dialog, event) {
    const stops = tabStops(dialog);
    if (stops.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const active = doc.activeElement;
    const first = stops[0];
    const last = stops[stops.length - 1];
    const outside = active === dialog || !dialog.contains(active);
    if (event.shiftKey && (active === first || outside)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || outside)) {
      event.preventDefault();
      first.focus();
    }
  }

  function onKeydown(entry, event) {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      if (entry.job.escape) finish(entry, entry.dismiss());
    } else if (event.key === 'Tab' && entry.dialog) {
      trapTab(entry.dialog, event);
    }
  }

  function restoreFocus(node) {
    if (node && node !== doc.body && node.isConnected !== false && typeof node.focus === 'function') node.focus();
  }

  function finish(entry, value) {
    if (current !== entry) return;
    current = null;
    entry.backdrop.remove();
    restoreFocus(entry.opener);
    entry.job.resolve(value);
    openNext();
  }

  function openNext() {
    const job = queue.shift();
    if (!job) {
      doc.removeEventListener('focusin', onFocusIn);
      return;
    }
    const backdrop = make(doc, 'div', { class: `dialog-backdrop${reducedMotion ? '' : ' is-animated'}` });
    const entry = { job, backdrop, opener: doc.activeElement, dialog: null, dismiss: job.dismiss };
    backdrop.addEventListener('keydown', (event) => onKeydown(entry, event));
    current = entry;
    host.append(backdrop);
    doc.addEventListener('focusin', onFocusIn);
    job.mount({
      show(dialog, focusTarget) {
        entry.dialog = dialog;
        backdrop.replaceChildren(dialog);
        (focusTarget ?? tabStops(dialog)[0] ?? dialog).focus();
      },
      finish: (value) => finish(entry, value),
      setDismiss(fn) {
        entry.dismiss = fn;
      },
    });
  }

  function enqueue(job) {
    return new Promise((resolve) => {
      queue.push({ ...job, resolve });
      if (!current) openNext();
    });
  }

  function showStartMenu({ difficulties = [], canContinue = false, firstTime = false } = {}) {
    const fallback = (difficulties.find((d) => d.id === 'normal') ?? difficulties[0])?.id ?? null;
    const fresh = (difficulty, tutorial) => ({ choice: 'new', difficulty, tutorial });
    return enqueue({
      escape: Boolean(canContinue),
      dismiss: () => (canContinue ? { choice: 'continue' } : fresh(fallback, Boolean(firstTime))),
      mount(ctx) {
        const { dialog, body, footer } = buildDialog(doc, {
          kind: 'start', title: 'Fire Of London', kicker: 'London, September 1666', reducedMotion,
        });
        body.append(make(doc, 'p', {
          class: 'start-intro',
          text: 'A small fire in a Pudding Lane bakery is about to become the Great Fire. Can you save London?',
        }));
        let continueButton = null;
        if (canContinue) {
          continueButton = makeButton(doc, 'Continue your game', 'btn btn-primary start-continue', () => {
            ctx.finish({ choice: 'continue' });
          });
          body.append(
            make(doc, 'div', { class: 'start-continue-row' }, [continueButton]),
            make(doc, 'p', { class: 'start-or', text: 'Or start a new game:' }),
          );
        }
        const groupName = uid('difficulty');
        const radios = difficulties.map((difficulty) => {
          const inputId = uid('difficulty-option');
          const descId = uid('difficulty-desc');
          const input = make(doc, 'input', {
            type: 'radio', id: inputId, name: groupName, value: difficulty.id, 'aria-describedby': descId,
          });
          input.checked = difficulty.id === fallback;
          const row = make(doc, 'div', { class: 'choice' }, [
            input,
            make(doc, 'label', { for: inputId, text: difficulty.label }),
            make(doc, 'p', { id: descId, class: 'choice-desc', text: difficulty.description }),
          ]);
          return { id: difficulty.id, input, row };
        });
        const tutorialId = uid('tutorial');
        const tutorialBox = make(doc, 'input', { type: 'checkbox', id: tutorialId, class: 'start-tutorial' });
        tutorialBox.checked = Boolean(firstTime);
        body.append(
          make(doc, 'fieldset', { class: 'choice-group' }, [
            make(doc, 'legend', { text: 'How hard should it be?' }),
            ...radios.map((radio) => radio.row),
          ]),
          make(doc, 'div', { class: 'check' }, [
            tutorialBox,
            make(doc, 'label', { for: tutorialId, text: 'Show me how to play' }),
          ]),
        );
        const read = () => fresh(radios.find((radio) => radio.input.checked)?.id ?? fallback, Boolean(tutorialBox.checked));
        const startButton = makeButton(doc, 'Start a new game', `btn${canContinue ? '' : ' btn-primary'} start-new`, () => {
          ctx.finish(read());
        });
        footer.append(startButton);
        ctx.setDismiss(() => (canContinue ? { choice: 'continue' } : read()));
        ctx.show(dialog, continueButton ?? radios.find((radio) => radio.input.checked)?.input ?? startButton);
      },
    });
  }

  function showCards(cards) {
    const list = (Array.isArray(cards) ? cards : []).filter(Boolean);
    if (list.length === 0) return Promise.resolve();
    return enqueue({
      escape: true,
      dismiss: () => undefined,
      mount(ctx) {
        const render = (index) => {
          const card = list[index];
          const last = index === list.length - 1;
          const { dialog, body, footer } = buildDialog(doc, {
            kind: 'card', title: card.title, kicker: card.when || 'History card', reducedMotion,
          });
          const textId = uid('card-text');
          dialog.setAttribute('aria-describedby', textId);
          body.append(make(doc, 'p', { id: textId, class: 'card-text', text: card.text }));
          if (card.learnMore) body.append(...learnMoreToggle(doc, card.learnMore));
          if (list.length > 1) {
            footer.append(make(doc, 'p', { class: 'card-count', text: `Card ${index + 1} of ${list.length}` }));
          }
          const primaryClass = `btn btn-primary ${last ? 'dialog-close' : 'dialog-next'}`;
          const primary = makeButton(doc, last ? 'Close' : 'Next', primaryClass, () => {
            if (last) ctx.finish();
            else render(index + 1);
          });
          footer.append(primary);
          // No explicit target: focus goes to the first control (Learn more when the card has it).
          ctx.show(dialog);
        };
        render(0);
      },
    });
  }

  function showChronicle({ cards = [], total = 0, sources = [] } = {}) {
    return enqueue({
      escape: true,
      dismiss: () => undefined,
      mount(ctx) {
        const { dialog, body, footer } = buildDialog(doc, {
          kind: 'chronicle', title: 'Chronicle', kicker: 'Your history cards', scrollBody: true, reducedMotion,
        });
        body.append(make(doc, 'p', { class: 'chronicle-summary', text: chronicleSummary(cards.length, total) }));
        if (cards.length === 0) {
          body.append(make(doc, 'p', { class: 'chronicle-empty', text: 'No cards yet. New cards appear as the story unfolds.' }));
        } else {
          const items = cards.map((card) => make(doc, 'li', { class: 'chronicle-card' }, [
            card.when ? make(doc, 'p', { class: 'card-when', text: card.when }) : null,
            make(doc, 'h3', { class: 'card-title', text: card.title }),
            make(doc, 'p', { class: 'card-text', text: card.text }),
            ...(card.learnMore ? learnMoreToggle(doc, card.learnMore) : []),
          ]));
          body.append(make(doc, 'ol', { class: 'chronicle-list' }, items));
        }
        if (sources.length > 0) {
          body.append(
            make(doc, 'h3', { class: 'sources-title', text: 'Where the facts come from' }),
            make(doc, 'ul', { class: 'sources' }, sources.map((source) => sourceItem(doc, source))),
          );
        }
        footer.append(makeButton(doc, 'Close', 'btn btn-primary dialog-close', () => ctx.finish()));
        ctx.show(dialog, body);
      },
    });
  }

  function showDebrief({
    score, outcome, timeLabel, landmarkNames = {}, whatHappened = [], endCards = [], canQuiz = false,
  } = {}) {
    return enqueue({
      escape: true,
      dismiss: () => 'close',
      mount(ctx) {
        const model = buildDebriefModel({ score, outcome, timeLabel, landmarkNames });
        const { dialog, body, footer } = buildDialog(doc, {
          kind: 'debrief', title: model.ratingLabel || model.heading, kicker: model.heading, scrollBody: true, reducedMotion,
        });
        body.append(
          make(doc, 'p', { class: 'debrief-rating', text: model.ratingText }),
          make(doc, 'p', { class: 'debrief-outcome', text: model.outcomeText }),
          debriefTable(doc, model.rows),
          make(doc, 'div', { class: 'landmark-lists' }, [
            nameList(doc, 'Landmarks saved', model.savedNames, 'saved'),
            nameList(doc, 'Landmarks lost', model.lostNames, 'lost'),
          ]),
        );
        if (whatHappened.length > 0) {
          body.append(
            make(doc, 'h3', { text: 'What really happened' }),
            ...whatHappened.map((text) => make(doc, 'p', { class: 'debrief-history', text })),
          );
        }
        if (endCards.length > 0) {
          body.append(
            make(doc, 'h3', { text: 'What happened next' }),
            ...endCards.map((card) => make(doc, 'div', { class: 'end-card' }, [
              make(doc, 'h4', { text: card.title }),
              make(doc, 'p', { text: card.text }),
            ])),
          );
        }
        if (canQuiz) footer.append(makeButton(doc, 'Take the quiz', 'btn btn-primary debrief-quiz', () => ctx.finish('quiz')));
        footer.append(
          makeButton(doc, 'Play again', `btn${canQuiz ? '' : ' btn-primary'} debrief-new`, () => ctx.finish('new')),
          makeButton(doc, 'Close', 'btn debrief-close', () => ctx.finish('close')),
        );
        ctx.show(dialog, body);
      },
    });
  }

  function showQuiz(questions) {
    const list = (Array.isArray(questions) ? questions : []).filter(Boolean);
    if (list.length === 0) return Promise.resolve({ correct: 0, total: 0 });
    return enqueue({
      escape: true,
      dismiss: () => ({ correct: 0, total: list.length }),
      mount(ctx) {
        const answers = list.map(() => null);
        ctx.setDismiss(() => gradeQuiz(list, answers));

        const showResult = () => {
          const result = gradeQuiz(list, answers);
          const { dialog, body, footer } = buildDialog(doc, {
            kind: 'quiz', title: `You got ${result.correct} out of ${result.total}`, kicker: 'Quiz', reducedMotion,
          });
          body.append(make(doc, 'p', { class: 'quiz-verdict', text: quizVerdict(result) }));
          const close = makeButton(doc, 'Close', 'btn btn-primary dialog-close', () => ctx.finish(result));
          footer.append(close);
          ctx.show(dialog, close);
        };

        const showQuestion = (index) => {
          const question = list[index];
          const last = index === list.length - 1;
          const { dialog, body, footer } = buildDialog(doc, {
            kind: 'quiz', title: `Question ${index + 1} of ${list.length}`, kicker: 'Quiz', reducedMotion,
          });
          const name = uid('quiz');
          const options = question.options.map((option, optionIndex) => {
            const inputId = uid('quiz-option');
            const input = make(doc, 'input', { type: 'radio', id: inputId, name, value: String(optionIndex) });
            const mark = make(doc, 'span', { class: 'choice-mark' });
            const row = make(doc, 'div', { class: 'choice' }, [input, make(doc, 'label', { for: inputId, text: option }), mark]);
            return { input, row, mark };
          });
          const feedback = make(doc, 'p', { class: 'quiz-feedback', 'aria-live': 'polite' });
          body.append(
            make(doc, 'fieldset', { class: 'choice-group' }, [
              make(doc, 'legend', { class: 'quiz-question', text: question.question }),
              ...options.map((option) => option.row),
            ]),
            feedback,
          );
          const check = makeButton(doc, 'Check answer', 'btn btn-primary quiz-check', () => {
            const chosen = options.findIndex((option) => option.input.checked);
            if (chosen < 0) {
              feedback.textContent = 'Choose an answer first.';
              return;
            }
            answers[index] = chosen;
            options.forEach((option, i) => {
              option.input.disabled = true;
              if (i === question.answer) {
                option.row.classList.add('is-right');
                option.mark.textContent = 'Right answer';
              } else if (i === chosen) {
                option.row.classList.add('is-wrong');
                option.mark.textContent = 'Your answer';
              }
            });
            const right = question.options[question.answer];
            feedback.textContent = chosen === question.answer
              ? `Well done! The answer is ${right}.`
              : `Not quite. The right answer is ${right}.`;
            const next = makeButton(doc, last ? 'See my score' : 'Next', 'btn btn-primary quiz-next', () => {
              if (last) showResult();
              else showQuestion(index + 1);
            });
            footer.replaceChildren(next);
            next.focus();
          });
          footer.append(check);
          ctx.show(dialog, options[0]?.input ?? check);
        };

        showQuestion(0);
      },
    });
  }

  function showMessage({ title = '', text = '' } = {}) {
    return enqueue({
      escape: true,
      dismiss: () => undefined,
      mount(ctx) {
        const { dialog, body, footer } = buildDialog(doc, { kind: 'message', title, reducedMotion });
        const textId = uid('message-text');
        dialog.setAttribute('aria-describedby', textId);
        body.append(make(doc, 'p', { id: textId, class: 'message-text', text }));
        const ok = makeButton(doc, 'OK', 'btn btn-primary dialog-close', () => ctx.finish());
        footer.append(ok);
        ctx.show(dialog, ok);
      },
    });
  }

  function closeAll() {
    const waiting = queue.splice(0);
    if (current) finish(current, current.dismiss());
    for (const job of waiting) job.resolve(job.dismiss());
  }

  return {
    showStartMenu,
    showCards,
    showChronicle,
    showDebrief,
    showQuiz,
    showMessage,
    isOpen: () => current !== null,
    closeAll,
  };
}
