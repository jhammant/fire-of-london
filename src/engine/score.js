// The score: houses, people and landmarks saved, compared with what really happened in 1666.

import { LANDMARKS } from '../data/map.js';
import { isLandmarkGone } from './board.js';

const HISTORY = { housesLost: 13200, churchesLost: 87, stPaulsLost: true, deathsRecorded: 6 };

const RATINGS = [
  {
    id: 'saviour',
    label: 'Saviour of London',
    below: 4000,
    text: 'You saved most of the City. Londoners will tell stories about you for years.'
  },
  {
    id: 'better-than-1666',
    label: 'Better than 1666',
    below: 11880,
    text: 'You saved far more homes than people did in 1666. Well done!'
  },
  {
    id: 'like-1666',
    label: 'Much like 1666',
    below: 14520,
    text: 'The fire took about as many homes as it did in 1666. History nearly repeated itself.'
  },
  {
    id: 'worse-than-1666',
    label: 'Worse than 1666',
    below: Infinity,
    text: 'Even more homes were lost than in 1666. The fire was too strong this time.'
  }
];

const ratingFor = (housesLost) => {
  const { id, label, text } = RATINGS.find((rating) => housesLost < rating.below);
  return { id, label, text };
};

/** Scores a state at any moment; houses on burning tiles count as lost, landmark tiles only once the game ends. */
export function getScore(state) {
  let housesLost = 0;
  let housesPulledDown = 0;
  let peopleAtHome = 0;
  for (const tile of state.tiles) {
    if (tile.cleared) housesPulledDown += tile.houses;
    if (tile.burnt || tile.cleared || tile.fire > 0) housesLost += tile.houses;
    else peopleAtHome += tile.people;
  }
  const landmarksSaved = [];
  const landmarksLost = [];
  // Burning landmark tiles can still be saved during play; they only count as burnt once the game is over.
  for (const landmark of LANDMARKS.filter((l) => l.scored)) {
    const lost = state.lostLandmarks.includes(landmark.id) || isLandmarkGone(state, landmark, state.over);
    (lost ? landmarksLost : landmarksSaved).push(landmark.id);
  }
  return {
    housesTotal: state.housesTotal,
    housesLost,
    housesSaved: state.housesTotal - housesLost,
    housesPulledDown,
    peopleTotal: state.peopleTotal,
    peopleSafe: state.peopleSafe + peopleAtHome,
    landmarksSaved,
    landmarksLost,
    stPaulsSaved: !landmarksLost.includes('st-pauls'),
    beatHistory: housesLost < HISTORY.housesLost,
    history: { ...HISTORY },
    rating: ratingFor(housesLost)
  };
}
