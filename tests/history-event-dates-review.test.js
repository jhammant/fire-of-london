import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCard } from '../src/data/history.js';

// The unit brief requires a date line for cards about a particular day.
// Both cards describe the gunpowder demolitions on Tuesday 4 September 1666.
for (const id of ['gunpowder-firebreaks', 'tower-of-london']) {
  test(`${id} supplies the date line for its Tuesday event`, () => {
    // Arrange
    const expectedDate = 'Tuesday 4 September 1666';

    // Act
    const card = getCard(id);

    // Assert
    assert.ok(card, `missing required card ${id}`);
    assert.equal(card.when, expectedDate, `${id} needs a historical date line`);
  });
}
