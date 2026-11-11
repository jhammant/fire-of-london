// History content for Fire Of London: cards, debrief text, sources and small pure helpers.

const SUNDAY = 'Sunday 2 September 1666';
const MONDAY = 'Monday 3 September 1666';
const TUESDAY = 'Tuesday 4 September 1666';
const WEDNESDAY = 'Wednesday 5 September 1666';
const THURSDAY = 'Thursday 6 September 1666';

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/** History cards, unlocked by engine triggers and collected in the Chronicle. */
export const CARDS = deepFreeze([
  {
    id: 'farriners-bakery',
    title: 'Fire at Farriner\'s Bakery',
    text: 'Soon after midnight, a fire started in Thomas Farriner\'s bakery in Pudding Lane. Farriner baked bread and hard biscuits for the navy. His family escaped by climbing out upstairs into a neighbour\'s house.',
    trigger: 'start',
    when: SUNDAY,
    learnMore: 'His name is also spelt Farynor in old records. Farriner insisted that he had raked out his oven before bed, so it should have been safe. Nobody knows for sure how the fire began, and historians are not sure it will ever be known.',
    quiz: {
      question: 'In which street did the Great Fire start?',
      options: ['Cheapside', 'Pudding Lane', 'Fleet Street', 'Thames Street'],
      answer: 1,
    },
  },
  {
    id: 'timber-houses',
    title: 'Timber Houses and Jetties',
    text: 'Most London houses were made of wood, often coated in sticky black pitch to keep out the rain. Upper floors jutted out over the lanes, so houses on opposite sides almost touched. The long, hot summer had left everything dry.',
    trigger: 'start',
    learnMore: 'These jutting upper floors were called jetties. They gave people more room upstairs, but they made the narrow lanes dark and let flames leap easily from house to house. The summer of 1666 had been long, hot and dry, so the wooden buildings were ready to burn.',
    quiz: {
      question: 'What were the jutting upper floors of old houses called?',
      options: ['Gables', 'Balconies', 'Jetties', 'Turrets'],
      answer: 2,
    },
  },
  {
    id: 'london-1666',
    title: 'London in 1666',
    text: 'In 1666 London was one of the biggest cities in Europe. The old City sat inside a wall first built by the Romans. King Charles II had been back on the throne for only six years.',
    trigger: 'start',
    learnMore: 'Historians think several hundred thousand people lived in and around London, though nobody counted them exactly. The year before, a terrible plague had swept through the city. England was also at war with the Dutch, and France had joined the Dutch side in 1666.',
    quiz: {
      question: 'Who was King of England in 1666?',
      options: ['Henry VIII', 'James I', 'William III', 'Charles II'],
      answer: 3,
    },
  },
  {
    id: 'easterly-gale',
    title: 'The Easterly Gale',
    text: 'A strong wind was blowing from the east. It pushed the flames west, deeper into the City, house after house. Sparks and burning scraps flew ahead and started new fires.',
    trigger: 'first-spread',
    when: SUNDAY,
    learnMore: 'Samuel Pepys wrote that, with your face in the wind, you were almost burned by a shower of firedrops. These flying embers could jump over gaps and start fires far ahead. The wind blew hard from the east for days and only dropped on Tuesday night.',
    quiz: {
      question: 'Which way did the strong wind push the fire?',
      options: ['West', 'East', 'North', 'South'],
      answer: 0,
    },
  },
  {
    id: 'thames-street',
    title: 'The Thames Street Warehouses',
    text: 'Thames Street ran along the river, lined with warehouses. They were packed with oil, tallow, pitch, tar, hemp, coal and spirits. When the fire reached them, it roared out of control.',
    trigger: 'warehouses',
    when: SUNDAY,
    learnMore: 'Tallow is animal fat, used to make candles and soap. Hemp was made into rope for ships, and pitch and tar kept boats waterproof. With so much fuel in one place, the fire grew far too hot for buckets to stop.',
    quiz: {
      question: 'What is tallow?',
      options: ['A kind of rope', 'Animal fat used for candles', 'A sort of boat', 'Black paint for houses'],
      answer: 1,
    },
  },
  {
    id: 'bludworth',
    title: 'The Lord Mayor Waits',
    text: 'The Lord Mayor, Sir Thomas Bludworth, was woken in the night and came to look. He thought the fire was small and claimed a woman could put it out. He would not pull houses down without the owners\' permission, and went back to bed.',
    trigger: 'sunday-morning',
    when: SUNDAY,
    learnMore: 'Pulling down houses was the usual way to stop a big fire, but owners expected to be paid for their losses. Bludworth worried about the cost and waited. Later on Sunday, Pepys found him worn out, crying, \'Lord, what can I do?\'',
    quiz: {
      question: 'Who was the Lord Mayor of London when the fire began?',
      options: ['Samuel Pepys', 'Christopher Wren', 'Sir Thomas Bludworth', 'Thomas Farriner'],
      answer: 2,
    },
  },
  {
    id: 'pepys-diary',
    title: 'Pepys Warns the King',
    text: 'Samuel Pepys worked for the Navy Board and kept a famous diary. His maid Jane woke him at about 3am, but he went back to sleep. Later he took a boat to Whitehall and told King Charles II about the fire.',
    trigger: 'sunday-afternoon',
    when: SUNDAY,
    learnMore: 'In the morning Pepys climbed up high at the Tower of London and saw how big the fire had grown. At Whitehall the King ordered him to tell the Lord Mayor to pull down houses. Pepys wrote his diary in a kind of shorthand, which helped to keep it private.',
    quiz: {
      question: 'Who woke Samuel Pepys to tell him about the fire?',
      options: ['The King', 'The Lord Mayor', 'His neighbour', 'His maid Jane'],
      answer: 3,
    },
  },
  {
    id: 'buckets-and-squirts',
    title: 'Leather Buckets and Squirts',
    text: 'Each parish kept leather buckets, often stored in the church. People passed them hand to hand from the river or from wells. Squirts were like giant syringes that shot a jet of water at the flames.',
    trigger: 'first-douse',
    learnMore: 'A squirt needed several people to hold and work it, and it held only a little water. Some parishes had a simple fire engine on wheels, but narrow, crowded lanes made them hard to use. Against a fire this big, buckets and squirts could only slow the flames.',
    quiz: {
      question: 'What were fire squirts like?',
      options: ['Giant syringes', 'Large sponges', 'Long canvas hoses', 'Copper kettles'],
      answer: 0,
    },
  },
  {
    id: 'firehooks',
    title: 'Firehooks',
    text: 'Firehooks were long poles with iron hooks on the end. Teams of men hooked them onto a house and pulled until it fell down. A gap with nothing to burn could stop the fire spreading.',
    trigger: 'first-hooks',
    learnMore: 'Like buckets, firehooks were kept by parishes, often inside churches. Pulling down a timber house was hard, slow work, and the gale often blew sparks over the gap before it was finished. Owners also hated losing their homes, which made people slow to start.',
    quiz: {
      question: 'What was on the end of a firehook?',
      options: ['A bucket', 'An iron hook', 'A sponge', 'A bell'],
      answer: 1,
    },
  },
  {
    id: 'gunpowder-firebreaks',
    title: 'Gunpowder Firebreaks',
    text: 'From Tuesday, men used gunpowder to blow up whole rows of houses. This made wide gaps much faster than firehooks could. The gaps, called firebreaks, left the flames with nothing to burn.',
    trigger: 'first-gunpowder',
    when: TUESDAY,
    learnMore: 'Many people were frightened of the blasts at first, and owners did not want their houses destroyed. Pepys suggested bringing in workmen from the navy\'s dockyards to help. The firebreaks worked best once the wind dropped on Tuesday night.',
    quiz: {
      question: 'Why did firefighters blow up houses with gunpowder?',
      options: ['To scare away thieves', 'To send a loud warning', 'To make gaps the fire could not cross', 'To dig wells for water'],
      answer: 2,
    },
  },
  {
    id: 'fleeing-the-fire',
    title: 'Fleeing with Carts and Boats',
    text: 'Families piled their things onto carts or carried them on their backs. The Thames filled with boats carrying people and their goods to safety. Most people fled to the fields outside the City walls.',
    trigger: 'first-evacuate',
    learnMore: 'Cart owners charged many times the usual price, and the roads out of the City were jammed. Pepys sent his money and best things away by cart before dawn on Monday, riding in the cart in his nightgown. He also saw pigeons that would not leave their homes, flying round until their wings were singed.',
    quiz: {
      question: 'How did Pepys send away his money and best things?',
      options: ['On horseback', 'In a sedan chair', 'On a ship to France', 'By cart'],
      answer: 3,
    },
  },
  {
    id: 'fire-posts',
    title: 'The Fire Posts',
    text: 'The Duke of York set up fire posts around the edge of the fire. Each post had soldiers, constables and gentlemen from the royal court. They organised the firefighters and kept order in the streets.',
    trigger: 'first-guard',
    when: MONDAY,
    learnMore: 'The posts gave the firefighting a plan at last, with someone in charge at each place. The Duke and his men also rescued foreigners from angry crowds who blamed them for the fire.',
  },
  {
    id: 'king-and-duke',
    title: 'The King Takes Charge',
    text: 'On Monday, King Charles II put his brother James, Duke of York, in charge of fighting the fire. The King and the Duke rode out among the firefighters. It is said they even passed buckets themselves.',
    trigger: 'authority',
    when: MONDAY,
    learnMore: 'The Lord Mayor had lost control, so the King stepped in. Royal power meant houses could be pulled down or blown up without waiting for owners to agree. James later became King James II.',
    quiz: {
      question: 'Who did King Charles II put in charge of fighting the fire?',
      options: ['His brother James, Duke of York', 'Samuel Pepys', 'The Lord Mayor', 'Christopher Wren'],
      answer: 0,
    },
  },
  {
    id: 'london-bridge',
    title: 'London Bridge',
    text: 'In 1666 London Bridge was lined with houses and shops. The fire burned the houses at its north end. A gap left by an earlier fire in 1633 stopped it crossing to Southwark.',
    trigger: 'bridge',
    when: SUNDAY,
    learnMore: 'London Bridge was the only bridge across the Thames in London at the time. Waterwheels under its north end pumped river water into the City, but they burned early on, so water ran short. Without the old gap, the fire might have spread south of the river too.',
    quiz: {
      question: 'What stopped the fire crossing London Bridge to Southwark?',
      options: ['A stone gate', 'A gap left by an earlier fire', 'Heavy rain', 'Soldiers with buckets'],
      answer: 1,
    },
  },
  {
    id: 'tower-of-london',
    title: 'Saving the Tower',
    text: 'The Tower of London held a huge store of gunpowder. If the fire reached it, the blast could have been terrible. Houses nearby were blown up to make a gap, and the Tower survived.',
    trigger: 'tower',
    when: TUESDAY,
    learnMore: 'Pepys wrote that the blowing up of houses next to the Tower began on Tuesday. The blasts frightened people more than anything at first. But they worked: the fire stopped short of the Tower, and its gunpowder stayed safe.',
    quiz: {
      question: 'What was stored in the Tower of London that made the fire so dangerous there?',
      options: ['Gold coins', 'Hay', 'Gunpowder', 'Books'],
      answer: 2,
    },
  },
  {
    id: 'royal-exchange',
    title: 'The Royal Exchange Burns',
    text: 'The Royal Exchange was a grand building where merchants met to buy and sell. It burned on Monday afternoon. Its statues of kings and queens fell into the flames.',
    trigger: 'monday',
    when: MONDAY,
    learnMore: 'Sir Thomas Gresham, a rich merchant, founded the Exchange in the time of Queen Elizabeth I. Afterwards, Pepys noticed that only one figure was left standing: that of Gresham himself. A new Exchange was built after the fire.',
    quiz: {
      question: 'What was the Royal Exchange?',
      options: ['A royal palace', 'A prison', 'A big church', 'A place where merchants met to trade'],
      answer: 3,
    },
  },
  {
    id: 'rumours-and-blame',
    title: 'Rumours and Blame',
    text: 'England was at war with the French and the Dutch. On Monday, rumours spread that foreigners or Catholics had started the fire on purpose. Angry mobs attacked innocent people in the streets.',
    trigger: 'monday',
    when: MONDAY,
    learnMore: 'A French watchmaker, Robert Hubert, falsely confessed to starting the fire, and he was hanged in October 1666. In fact he only reached London after the fire began. A committee of Parliament decided the fire came from the hand of God, a great wind and a very dry season.',
    quiz: {
      question: 'What did a committee of Parliament blame for the fire?',
      options: ['The hand of God, a great wind and a very dry season', 'A French plot', 'A careless candle maker', 'Dutch spies'],
      answer: 0,
    },
  },
  {
    id: 'pepys-parmesan',
    title: 'Pepys Buries His Cheese',
    text: 'On Tuesday, Pepys and Sir William Penn dug a pit in the garden. They buried their wine to keep it safe from the fire. Pepys also put his Parmesan cheese in the hole!',
    trigger: 'tuesday',
    when: TUESDAY,
    learnMore: 'Pepys spelt it \'Parmazan\' in his diary. Earlier that day, he had put office papers he could not move into a pit dug by another neighbour, Sir William Batten. Burying things was a way to save what nobody could carry.',
    quiz: {
      question: 'What did Pepys bury in his garden with his wine?',
      options: ['His diary', 'His Parmesan cheese', 'His gold watch', 'His wig'],
      answer: 1,
    },
  },
  {
    id: 'cheapside-and-guildhall',
    title: 'Cheapside and the Guildhall',
    text: 'Cheapside was the City\'s grandest shopping street, home to the goldsmiths. It burned on Tuesday. That night the Guildhall, where the City was run, caught fire too.',
    trigger: 'tuesday',
    when: TUESDAY,
    learnMore: 'The name Cheapside comes from an old word for a market. The Guildhall\'s thick stone walls survived, but its roof and much inside it burned. The writer Thomas Vincent said it glowed like a palace of gold.',
    quiz: {
      question: 'Which shopkeepers were famous for working in Cheapside?',
      options: ['Fishmongers', 'Bakers', 'Goldsmiths', 'Booksellers'],
      answer: 2,
    },
  },
  {
    id: 'st-pauls',
    title: 'St Paul\'s Cathedral Burns',
    text: 'On the evening of Tuesday 4 September, the fire reached St Paul\'s Cathedral. It was covered in wooden scaffolding for repairs, which caught light. Its lead roof melted and ran down the streets like a river.',
    trigger: 'tuesday-night',
    when: TUESDAY,
    learnMore: 'Booksellers had stored their books in the crypt, hoping the thick stone walls would keep them safe. The books burned too. John Evelyn wrote that the cathedral\'s stones flew like grenades in the heat.',
    quiz: {
      question: 'What melted and ran down the streets when St Paul\'s burned?',
      options: ['Its wooden doors', 'Its golden bells', 'Its iron gates', 'Its lead roof'],
      answer: 3,
    },
  },
  {
    id: 'wind-drops',
    title: 'The Wind Drops',
    text: 'On Tuesday night the strong east wind finally began to drop. Without it, the flames could no longer leap across the firebreaks. For the first time, the firefighters began to win.',
    trigger: 'wind-drops',
    when: TUESDAY,
    learnMore: 'The wind had blown hard for more than two days, driving the fire west. Once it eased, the gaps made with gunpowder and firehooks held at last. By Wednesday most of the fire was under control, though flames still flared up here and there.',
    quiz: {
      question: 'What finally helped the firefighters to win?',
      options: ['The wind dropped', 'It rained hard', 'The river flooded', 'Snow fell'],
      answer: 0,
    },
  },
  {
    id: 'moorfields',
    title: 'Camping at Moorfields',
    text: 'Thousands of people who had lost their homes camped in Moorfields, just north of the City wall. They slept in tents and rough huts with whatever they had saved. Others went to fields even further north.',
    trigger: 'wednesday',
    when: WEDNESDAY,
    learnMore: 'Pepys walked there on Wednesday and found it full of people guarding their goods. He wrote that the hot coals in the streets nearly burned his feet on the way. Near the end of the fire, the King rode to Moorfields and told the crowd it was not a foreign plot.',
    quiz: {
      question: 'Where did many people who had lost their homes camp?',
      options: ['On London Bridge', 'Moorfields', 'Inside St Paul\'s', 'In the Tower'],
      answer: 1,
    },
  },
  {
    id: 'fire-ends',
    title: 'The Fire Ends',
    text: 'By Thursday 6 September, the Great Fire was out. A late flare-up at the Temple, near the western edge of the City, had to be stopped first. Under the ruins, cellars kept smouldering for months.',
    trigger: 'end',
    when: THURSDAY,
    learnMore: 'The fire had burned for about four days. It destroyed most of the City inside the old walls and spread beyond them in the west, past the Fleet river.',
    quiz: {
      question: 'On what day was the Great Fire finally out?',
      options: ['Sunday 2 September', 'Monday 3 September', 'Thursday 6 September', 'Saturday 8 September'],
      answer: 2,
    },
  },
  {
    id: 'how-many-died',
    title: 'How Many People Died?',
    text: 'Only six deaths were recorded at the time. Historians are not sure of the true number, which may have been higher. The deaths of poor people may not all have been written down.',
    trigger: 'end',
    learnMore: 'The writer Neil Hanson argues that many more died than were recorded. Other historians think the number stayed fairly low, because the fire usually moved slowly enough for people to get away. The truth will probably never be known.',
    quiz: {
      question: 'How many deaths were recorded at the time of the fire?',
      options: ['Sixty', 'Six hundred', 'Six thousand', 'Six'],
      answer: 3,
    },
  },
  {
    id: 'monument',
    title: 'The Monument',
    text: 'The Monument was built to remember the fire. Christopher Wren and Robert Hooke designed it, and it was built between 1671 and 1677. It is 202 feet (61 metres) tall and stands 202 feet from where the fire began.',
    trigger: 'end',
    learnMore: 'Visitors can still climb its 311 steps to a viewing platform near the top. A golden urn of flames sits on the very top. Hooke also hoped to use the hollow column for science experiments. In 1681 words blaming Catholics for the fire were carved on it, and they were removed in 1830.',
    quiz: {
      question: 'How many steps does the Monument have?',
      options: ['311', '202', '61', '1666'],
      answer: 0,
    },
  },
  {
    id: 'rebuilding-act',
    title: 'Rebuilding in Brick and Stone',
    text: 'The Rebuilding Act was passed in February 1667. New houses had to be built of brick or stone, not wood. Some streets were made wider, and a Fire Court settled arguments about who should pay.',
    trigger: 'end',
    learnMore: 'Its official name says 1666, because in those days the new year began on 25 March. The Act set a few standard types of house, depending on the size of the street. Christopher Wren drew a grand new plan with wide, straight streets, but it was never used. He did rebuild 51 churches and the new St Paul\'s Cathedral, finished in 1711.',
    quiz: {
      question: 'What did the Rebuilding Act say new houses must be made of?',
      options: ['Wood', 'Brick or stone', 'Mud and straw', 'Iron'],
      answer: 1,
    },
  },
  {
    id: 'fire-insurance',
    title: 'The First Fire Insurance',
    text: 'After the fire, Nicholas Barbon set up one of the first fire insurance offices, the Fire Office, in 1680. People paid a fee, and if their building burned, they got money to rebuild. Insured buildings carried a metal badge called a fire mark.',
    trigger: 'end',
    learnMore: 'Barbon was also a builder who put up many new houses after the fire. Insurance companies kept their own teams of firemen to protect the buildings they insured. It is often said these firemen ignored buildings without a fire mark, but historians doubt this was common.',
    quiz: {
      question: 'What was a fire mark?',
      options: ['A burn left by the fire', 'A map of the fire', 'A metal badge on an insured building', 'A medal for firemen'],
      answer: 2,
    },
  },
  {
    id: 'fire-brigades',
    title: 'Fire Brigades for Everyone',
    text: 'For a long time, firemen in London worked for insurance companies. In 1833 several of these teams joined to form the London Fire Engine Establishment. Then in 1866 London got the Metropolitan Fire Brigade, paid for by the public.',
    trigger: 'end',
    learnMore: 'The 1833 brigade was led by James Braidwood, a Scottish fire chief who trained his men carefully. The Metropolitan Fire Brigade later grew into today\'s London Fire Brigade.',
    quiz: {
      question: 'In which year did London get the Metropolitan Fire Brigade?',
      options: ['1666', '1833', '1711', '1866'],
      answer: 3,
    },
  },
  {
    id: 'plague-myth',
    title: 'Did the Fire End the Plague?',
    text: 'Many people say the Great Fire ended the plague of 1665. Historians doubt it. The plague was already fading, and the poor suburbs where it was worst did not burn.',
    trigger: 'end',
    learnMore: 'The Great Plague of 1665 was the last big outbreak of plague in London. It was worst in crowded areas outside the walls, such as Southwark and Whitechapel, which the fire never reached. Plague also disappeared from much of western Europe in the following years, and historians still argue about why.',
  },
]);

/** Short paragraphs for the end-of-game 'what really happened' debrief. */
export const WHAT_HAPPENED = deepFreeze([
  'The Great Fire began soon after midnight on Sunday 2 September 1666, in a bakery in Pudding Lane. A strong east wind and a long, dry summer helped it spread. The Lord Mayor waited, and by morning it was out of control.',
  'For three days the wind drove the flames west across the City. People fled with carts and boats to the fields outside the walls. The King put his brother James in charge, and men pulled down and blew up houses to make firebreaks.',
  'On Tuesday night St Paul\'s Cathedral burned, and at last the wind dropped. The firebreaks began to hold. By Thursday 6 September the fire was out.',
  'About 13,200 houses, 87 parish churches, St Paul\'s, the Royal Exchange and the Guildhall were lost. Perhaps 70,000 people lost their homes. Only six deaths were recorded, but historians think the true number is unknown and may have been higher.',
  'London was rebuilt in brick and stone, with some wider streets. Christopher Wren built 51 new churches and a new St Paul\'s. Fire insurance began soon after, and much later London got public fire brigades.',
]);

/** Books and records that tell us about the fire. */
export const SOURCES = deepFreeze([
  {
    title: 'The Diary of Samuel Pepys',
    author: 'Samuel Pepys',
    year: 1666,
    note: 'A day-by-day eyewitness account, written in shorthand, of how Londoners fought the fire and fled from it.',
  },
  {
    title: 'The Diary of John Evelyn',
    author: 'John Evelyn',
    year: 1666,
    note: 'Another eyewitness diary, with vivid scenes of St Paul\'s burning and of people camped in the fields.',
  },
  {
    title: 'The London Gazette, issue 85',
    author: 'London Gazette',
    year: 1666,
    note: 'The official newspaper\'s report of the fire, printed soon after it ended.',
  },
  {
    title: 'God\'s Terrible Voice in the City',
    author: 'Thomas Vincent',
    year: 1667,
    note: 'A preacher\'s dramatic account, which saw both the plague and the fire as warnings from God.',
  },
  {
    title: 'Rebuilding of London Act 1666',
    author: 'Parliament of England',
    year: 1667,
    note: 'The law that set out how the City must be rebuilt, in brick and stone.',
  },
  {
    title: 'By Permission of Heaven: The Story of the Great Fire of London',
    author: 'Adrian Tinniswood',
    year: 2003,
    note: 'A modern history of the fire, its causes and the years of rebuilding that followed.',
  },
  {
    title: 'The Dreadful Judgement',
    author: 'Neil Hanson',
    year: 2001,
    note: 'A modern history which argues that far more people died than were recorded.',
  },
  {
    title: 'The Great Fire of London',
    author: 'Stephen Porter',
    year: 1996,
    note: 'A short modern history by an expert on London, covering the fire and the rebuilding.',
  },
]);

/** Returns the card with this id, or undefined. */
export function getCard(id) {
  return CARDS.find((card) => card.id === id);
}

/** Returns the cards for one trigger id, in CARDS order. */
export function cardsForTrigger(triggerId) {
  return CARDS.filter((card) => card.trigger === triggerId);
}

/** Returns unique cards for these trigger ids, in trigger order and then CARDS order. */
export function cardsForTriggers(triggerIds) {
  const seen = new Set();
  const result = [];
  for (const triggerId of Array.isArray(triggerIds) ? triggerIds : []) {
    for (const card of cardsForTrigger(triggerId)) {
      if (!seen.has(card.id)) {
        seen.add(card.id);
        result.push(card);
      }
    }
  }
  return result;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Builds up to count quiz questions from the listed cards that have a quiz; deterministic for the same arguments. */
export function buildQuiz(cardIds, seed, count = 3) {
  const pool = [];
  for (const id of Array.isArray(cardIds) ? cardIds : []) {
    const card = getCard(id);
    if (card && card.quiz && !pool.includes(card)) {
      pool.push(card);
    }
  }
  const random = mulberry32(Number(seed) || 0);
  const limit = Math.max(0, Math.floor(Number(count) || 0));
  return shuffle(pool, random).slice(0, limit).map((card) => {
    const order = shuffle(card.quiz.options.map((_, index) => index), random);
    return {
      cardId: card.id,
      question: card.quiz.question,
      options: order.map((index) => card.quiz.options[index]),
      answer: order.indexOf(card.quiz.answer),
    };
  });
}
