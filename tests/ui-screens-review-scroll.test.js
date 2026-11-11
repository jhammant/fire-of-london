import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTutorial, TUTORIAL_STEPS } from '../src/ui/tutorial.js';
import { buildPage, createFakeDocument, FakeEvent } from './helpers/screens-fakes.js';

test('scrolling the current tutorial target away keeps the coach and Skip tutorial on screen', (t) => {
  // Arrange: at 680px the page can have a full-width scrolling bottom sheet.
  // Give the coach a real size; zero-sized fake rectangles hide placement errors.
  const viewport = { width: 680, height: 740 };
  const doc = createFakeDocument(viewport);
  const page = buildPage(doc);
  const target = page.actions.querySelector('[data-action="douse"]');
  target.setRect({ left: 16, top: 400, width: 648, height: 80 });
  const tutorial = createTutorial({ doc, root: page.tutorialRoot });
  t.after(() => tutorial.skip());
  tutorial.start();
  const bubble = page.tutorialRoot.querySelector('.coach');
  const bubbleSize = { width: 336, height: 260 };
  bubble.setRect({ left: 8, top: 8, ...bubbleSize });
  for (const step of TUTORIAL_STEPS) {
    if (step.waitFor?.type === 'douse') break;
    if (step.waitFor) tutorial.notify(step.waitFor.event, { type: step.waitFor.type });
    else page.tutorialRoot.querySelector('.coach-next').click();
  }
  assert.ok(target.classList.contains('tutorial-target'));

  // Act: the user scrolls the panel, moving its current target above the viewport.
  target.setRect({ left: 16, top: -350, width: 648, height: 80 });
  doc.fire(new FakeEvent('scroll'));

  // Assert: a fallback to the top or any on-screen side placement is acceptable.
  // The top placement is defined as 0.5rem in screens.css (8px at the default size).
  const top = bubble.getAttribute('data-placement') === 'top' ? 8 : Number.parseFloat(bubble.style.top);
  assert.ok(top >= 0 && top + bubbleSize.height <= viewport.height,
    `The coach must remain visible after scrolling; its vertical range is ${top}..${top + bubbleSize.height}`);
});
