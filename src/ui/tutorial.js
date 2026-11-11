// First-turn tutorial for Fire Of London: a non-modal coach bubble that points at parts of the page.
// No DOM is touched until createTutorial is called.

const NARROW_WIDTH = 640;
const GAP = 12;
const MARGIN = 8;
const TARGET_CLASS = 'tutorial-target';

const WAIT_HINTS = Object.freeze({
  'tile-selected': 'Choose a square on the map to carry on.',
  'action-done': 'Use that action to carry on.',
  'turn-ended': 'Press End Turn to carry on.',
});

function step(id, title, text, target = null, waitFor = null) {
  return Object.freeze({ id, title, text, target, waitFor: waitFor && Object.freeze(waitFor) });
}

/** The steps of the first-turn tutorial, in order. */
export const TUTORIAL_STEPS = Object.freeze([
  step(
    'welcome',
    'London is burning',
    "It is 1am on Sunday 2 September 1666. Thomas Farriner's bakery in Pudding Lane is on fire. Can you save London?",
  ),
  step(
    'select-fire',
    'Find the fire',
    'The bakery is in Pudding Lane, near the river in the east. Click or tap the burning square to choose it. On a keyboard, use the arrow keys on the map.',
    '#map',
    { event: 'tile-selected' },
  ),
  step(
    'tile-info',
    'Your chosen square',
    'This box tells you about the square you chose. It shows the houses, the people and how fiercely it burns.',
    '#tile-info',
  ),
  step(
    'resources',
    'Men and supplies',
    'Every action costs something from here. Your actions and men come back each turn. Goodwill falls when you pull houses down.',
    '#resources',
  ),
  step(
    'wind',
    'Watch the wind',
    'A strong wind is blowing from the east. It pushes the fire west, into the heart of the City. Make your stand to the west of the flames.',
    '#wind-info',
  ),
  step(
    'douse',
    'Buckets and squirts',
    'Press Buckets and squirts, or key 1. Your men throw water on the square you chose. This cools the flames and soaks the timber.',
    "#actions [data-action='douse']",
    { event: 'action-done', type: 'douse' },
  ),
  step(
    'hooks',
    'Firehooks',
    'Firehooks pull houses down to make a firebreak. A firebreak is a gap that the fire finds hard to cross. Try one just west of the flames.',
    "[data-action='hooks']",
  ),
  step(
    'appeal',
    'Ask the King',
    'Gunpowder can blow a wide firebreak, but only the King can allow it. Press Send word to the King. You may need to ask more than once.',
    "[data-action='appeal']",
  ),
  step(
    'people',
    'People and great buildings',
    "Evacuate a district to lead its people to safety at Moorfields. Post men to guard a great building, such as St Paul's Cathedral.",
    '#actions',
  ),
  step(
    'end-turn',
    'End the turn',
    'When you have used your actions, press End Turn. Six hours pass and the wind spreads the fire.',
    '#btn-end-turn',
    { event: 'turn-ended' },
  ),
  step(
    'finish',
    'Over to you',
    'History cards will pop up as the days go by. The Chronicle button keeps every card you find. Good luck!',
    '#btn-chronicle',
  ),
]);

function clamp(value, low, high) {
  return Math.min(Math.max(value, low), Math.max(low, high));
}

/** True when the target rect overlaps the viewport at all. */
function inViewport(rect, viewport) {
  return rect.right > 0 && rect.bottom > 0 && rect.left < viewport.width && rect.top < viewport.height;
}

/** Picks a spot for the coach bubble beside the target rect, or null when it only fits at the top. */
export function placeCoach(target, bubble, viewport) {
  const clampX = (x) => clamp(x, MARGIN, viewport.width - bubble.width - MARGIN);
  const clampY = (y) => clamp(y, MARGIN, viewport.height - bubble.height - MARGIN);
  // A spot only fits when the whole bubble stays inside the margins on both axes,
  // so a target scrolled past one edge can never push the bubble off the other.
  const onScreen = ({ left, top }) => left >= MARGIN
    && left + bubble.width <= viewport.width - MARGIN
    && top >= MARGIN
    && top + bubble.height <= viewport.height - MARGIN;
  const spots = [
    { side: 'right', left: target.right + GAP, top: clampY(target.top) },
    { side: 'left', left: target.left - GAP - bubble.width, top: clampY(target.top) },
    { side: 'below', left: clampX(target.left), top: target.bottom + GAP },
    { side: 'above', left: clampX(target.left), top: target.top - GAP - bubble.height },
  ];
  const spot = spots.find(onScreen);
  return spot ? { side: spot.side, left: spot.left, top: spot.top } : null;
}

function make(doc, tag, attrs = {}, children = []) {
  const node = doc.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (name === 'text') node.textContent = value;
    else node.setAttribute(name, value);
  }
  for (const child of children) node.append(child);
  return node;
}

function setShown(node, shown) {
  if (shown) node.removeAttribute('hidden');
  else node.setAttribute('hidden', '');
}

/** Creates the first-turn tutorial in root (the #tutorial-root element); onFinish({ skipped }) runs when it ends. */
export function createTutorial({ doc, root, onFinish } = {}) {
  const host = root ?? doc.body;
  let index = -1;
  let parts = null;
  let target = null;

  function setTarget(next) {
    if (target) target.classList.remove(TARGET_CLASS);
    target = next;
    if (target) target.classList.add(TARGET_CLASS);
  }

  function reposition() {
    if (!parts) return;
    const view = doc.defaultView;
    const viewport = { width: view?.innerWidth ?? 0, height: view?.innerHeight ?? 0 };
    const rect = target ? target.getBoundingClientRect() : null;
    // A target scrolled wholly out of view counts as missing: the bubble goes to the top.
    const visible = Boolean(rect && rect.width > 0 && rect.height > 0 && inViewport(rect, viewport));
    const spot = visible && viewport.width >= NARROW_WIDTH
      ? placeCoach(rect, parts.bubble.getBoundingClientRect(), viewport)
      : null;
    parts.bubble.setAttribute('data-placement', spot ? spot.side : 'top');
    parts.bubble.style.left = spot ? `${Math.round(spot.left)}px` : '';
    parts.bubble.style.top = spot ? `${Math.round(spot.top)}px` : '';
  }

  function build() {
    const bubble = make(doc, 'div', {
      class: 'coach',
      role: 'dialog',
      'aria-modal': 'false',
      'aria-labelledby': 'coach-title',
      'aria-describedby': 'coach-text',
      tabindex: '-1',
      'data-placement': 'top',
    });
    const count = make(doc, 'p', { class: 'coach-count' });
    const title = make(doc, 'h2', { id: 'coach-title', class: 'coach-title' });
    const text = make(doc, 'p', { id: 'coach-text', class: 'coach-text' });
    const hint = make(doc, 'p', { class: 'coach-hint' });
    const skip = make(doc, 'button', { type: 'button', class: 'btn coach-skip', text: 'Skip tutorial' });
    const next = make(doc, 'button', { type: 'button', class: 'btn btn-primary coach-next', text: 'Next' });
    skip.addEventListener('click', () => finish(true));
    next.addEventListener('click', () => advance());
    bubble.append(count, title, text, hint, make(doc, 'div', { class: 'coach-actions' }, [skip, next]));
    const announcer = make(doc, 'p', { class: 'visually-hidden coach-announcer', 'aria-live': 'polite' });
    host.append(bubble, announcer);
    return { bubble, count, title, text, hint, next, announcer };
  }

  function focusStep(current) {
    if (!current.waitFor) parts.next.focus();
    else if (target && target.tabIndex >= 0) target.focus();
    else parts.bubble.focus();
  }

  function render() {
    const current = TUTORIAL_STEPS[index];
    const hadFocus = parts.bubble.contains(doc.activeElement);
    const last = index === TUTORIAL_STEPS.length - 1;
    setTarget(current.target ? doc.querySelector(current.target) : null);
    parts.count.textContent = `Step ${index + 1} of ${TUTORIAL_STEPS.length}`;
    parts.title.textContent = current.title;
    parts.text.textContent = current.text;
    parts.hint.textContent = current.waitFor ? WAIT_HINTS[current.waitFor.event] : '';
    setShown(parts.hint, Boolean(current.waitFor));
    setShown(parts.next, !current.waitFor);
    parts.next.textContent = last ? 'Start playing' : 'Next';
    parts.announcer.textContent = `Tutorial step ${index + 1} of ${TUTORIAL_STEPS.length}. ${current.title}. ${current.text}`;
    target?.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    reposition();
    if (hadFocus) focusStep(current);
  }

  function finish(skipped) {
    if (index < 0) return;
    const hadFocus = parts.bubble.contains(doc.activeElement);
    setTarget(null);
    doc.defaultView?.removeEventListener('resize', reposition);
    doc.removeEventListener('scroll', reposition, true);
    parts.bubble.remove();
    parts.announcer.remove();
    parts = null;
    index = -1;
    if (hadFocus) doc.querySelector('#map')?.focus();
    if (typeof onFinish === 'function') onFinish({ skipped });
  }

  function advance() {
    if (index >= TUTORIAL_STEPS.length - 1) {
      finish(false);
      return;
    }
    index += 1;
    render();
  }

  return {
    start() {
      if (index >= 0) return;
      parts = build();
      doc.defaultView?.addEventListener('resize', reposition);
      doc.addEventListener('scroll', reposition, true);
      index = 0;
      render();
      parts.next.focus();
    },
    notify(eventName, payload = {}) {
      if (index < 0) return;
      const wait = TUTORIAL_STEPS[index].waitFor;
      if (!wait || wait.event !== eventName) return;
      if (wait.type && payload?.type !== wait.type) return;
      advance();
    },
    skip() {
      finish(true);
    },
    isActive: () => index >= 0,
  };
}
