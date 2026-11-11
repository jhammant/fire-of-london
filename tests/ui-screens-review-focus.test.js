import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScreens } from '../src/ui/screens.js';
import { buildPage, createFakeDocument, SAMPLE_CARDS } from './helpers/screens-fakes.js';

test('a history card initially focuses its first control, including Learn more', async (t) => {
  // Arrange: the first card has a Learn more button before its Close button.
  const doc = createFakeDocument();
  const page = buildPage(doc);
  const screens = createScreens({ doc, root: page.modalRoot, reducedMotion: true });
  t.after(() => screens.closeAll());

  // Act.
  const done = screens.showCards([SAMPLE_CARDS[0]]);
  const dialog = page.modalRoot.querySelector('[role="dialog"]');
  const firstControl = dialog.querySelector('button');

  // Assert: section 6e in the unit brief explicitly requires the first control.
  assert.equal(firstControl.textContent, 'Learn more');
  assert.ok(doc.activeElement === firstControl,
    `Expected focus on the first control (Learn more), got ${doc.activeElement.textContent}`);
  screens.closeAll();
  await done;
});
