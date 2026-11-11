# Fire Of London

A turn-based strategy game you play in a web browser. It is one o'clock in the
morning on Sunday 2 September 1666. A fire has started in Thomas Farriner's
bakery in Pudding Lane, and a strong east wind is blowing. Can you save London?

You lead the fight against the Great Fire. Douse flames, pull down houses to
make firebreaks, ask the King for gunpowder and help people flee to safety.
Along the way, history cards tell you what really happened in 1666.

The game has no build step and no dependencies. It is plain HTML, CSS and
JavaScript modules, served as static files.

## How to play

### Your goal

Stop the fire from burning down the City of London. In 1666 the real fire
destroyed about 13,200 houses, 87 churches and old St Paul's Cathedral. Try to
lose fewer houses than that. Keep people safe and protect famous landmarks too.

### Turns and time

- Each turn is six hours long.
- The game starts at 1am on Sunday 2 September 1666.
- Turns go 1am, 7am, 1pm and 7pm, day after day.
- The game ends at 1am on Thursday 6 September. It ends sooner if you put out
  every flame.
- Press **End turn** when you have finished. Six hours pass and the fire
  spreads.

### The map

The map shows the City of London as a grid of squares.

- **Houses** are packed tightly together and made of timber. They burn well.
- **Warehouses** on Thames Street are full of oil, tallow and pitch. They burn
  fastest of all.
- **Stone** churches and halls catch fire slowly and burn slowly.
- **Open ground**, the **river** and the **city wall** never burn.

The River Thames runs along the bottom. The Fleet river runs down the west
side. Moorfields is open ground outside the north wall.

### Wind and embers

The wind pushes the fire. It spreads fastest in the direction the wind is
blowing. In a strong wind, burning embers can jump over a gap and start a new
fire further on. Embers never land on the river, the wall, open ground or a
firebreak.

At first a gale blows from the east. On Tuesday night the wind starts to drop,
just as it did in 1666. The panel always shows where the wind is coming from
and how strong it is.

### Actions

Choose a square on the map, then choose an action. Each action costs
**action points** (AP) and **men**. Some also cost **gunpowder** or
**goodwill**. Your action points and men come back at the start of every turn.

| Key | Action | Cost | What it does |
| --- | --- | --- | --- |
| 1 | Buckets and squirts | 1 AP, 2 men | Throw water on a square. A burning square burns one level less, and may go out. The square stays wet while the fire spreads at the end of the turn, so it is much harder to set alight. You can douse each square once a turn. |
| 2 | Firehooks | 2 AP, 4 men, 1 goodwill | Pull down the houses on a square that is not on fire. The people there move to safety first. The empty square becomes a firebreak. |
| 3 | Gunpowder | 2 AP, 2 men, 1 gunpowder, 2 goodwill | Blow up a square and the house and warehouse squares next to it (north, south, east and west). Any fire on them goes out and the people move to safety first. You need the King's permission. |
| 4 | Evacuate district | 1 AP, 2 men | Everyone in the chosen square's district walks to Moorfields, where they are safe. |
| 5 | Post men | 1 AP, 3 men | Post men at a landmark, such as St Paul's Cathedral. Its squares are much harder to set alight and burn more slowly. The men stay there until the landmark is lost or the game ends. |
| 6 | Send word to the King | 1 AP | Ask the King for permission to use gunpowder. You do not need to choose a square. |

If you cannot use an action, its button tells you why. For example, you may
need more men, or you may need to choose a square first.

### Firebreaks

A firebreak is a gap with nothing left to burn. Fire cannot burn across it.
But be careful: in a strong wind, embers can jump over a narrow firebreak.
Wide firebreaks, a little way ahead of the fire, work best.

### The King's permission

At the start you are not allowed to use gunpowder. Use **Send word to the
King** to ask. You can send word once each turn.

- On Easy, the King agrees after 1 message.
- On Normal, he agrees after 2 messages.
- On Hard, he agrees after 3 messages.

When he agrees, barrels of gunpowder arrive, and more may come later.

### Goodwill

Londoners do not like seeing their homes pulled down. Firehooks cost 1
goodwill and gunpowder costs 2. Goodwill goes from 0 to 10. It comes back by 1
point every turn, up to 10. If you run out, you must wait before you can pull
down more houses.

### Keeping people safe

Use **Evacuate district** to send everyone in a district to Moorfields, the
open fields north of the city wall. People also move to safety when you pull
down or blow up their homes. People whose homes never burn are safe too.

### Scoring

When the game ends you see your score:

- how many houses were lost, and how many you saved;
- how many houses you pulled down to make firebreaks;
- how many people are safe;
- which landmarks you saved and which were lost. A landmark is lost when half
  or more of its squares are burnt or pulled down.

The houses you lost are compared with the 13,200 lost in 1666. You get one of
four ratings, from worst to best:

1. **Worse than 1666**
2. **Much like 1666**
3. **Better than 1666**
4. **Saviour of London**

### History cards, the Chronicle and the quiz

As the fire spreads, history cards pop up. Each one tells you what really
happened at that moment in 1666. Some have a **Learn more** part for curious
readers.

Every card you find is kept in the **Chronicle**. Press the Chronicle button
to read them again, along with the books and diaries the facts come from.

When the game ends, you can read what really happened in 1666. Then you can
try a short quiz about the cards you have seen.

### The tutorial

The first time you play, a short tutorial shows you what to do, step by step.
Press **Help** at any time to see it again. You can skip it whenever you like.

### Difficulty

Choose a level when you start a new game:

- **Easy**: more men and a fire that spreads a little slower. The King agrees
  after 1 message.
- **Normal**: a fair fight, much as London faced it. The King agrees after 2
  messages.
- **Hard**: fewer men and a fire that spreads fast. The King agrees after 3
  messages.

The start menu tells you more about each level.

### Saving and Continue

The game saves itself in your browser after every move. Next time you visit,
choose **Continue** on the start menu to carry on. When a game ends, its save
is removed. If your browser does not allow saving, the game still works, but
it cannot remember your game.

## Controls

You can play with a mouse, a touch screen or a keyboard.

| Do this | Mouse | Touch | Keyboard |
| --- | --- | --- | --- |
| Choose a square | Click it | Tap it | Focus the map, then use the arrow keys |
| Use an action | Click its button | Tap its button | Press 1 to 6, or Tab to the button and press Enter or Space |
| End the turn | Click **End turn** | Tap **End turn** | Tab to **End turn** and press Enter or Space |
| Look around when zoomed in | Drag the map | Drag the map | Move your chosen square with the arrow keys |
| Close a window | Click its button | Tap its button | Press Escape |

- **Tab** moves between the controls. The control you are on always has a
  clear outline around it.
- **Zoom** makes the map twice as big and centres it on your chosen square.
  Drag to look around. Press **Zoom** again to see the whole city.
- **Chronicle** shows the history cards you have found. **Menu** opens the
  start menu. **Help** replays the tutorial.
- On a phone, the panel sits at the bottom of the screen as a sheet. Tap the
  **Panel** button to show or hide it.
- The page works on screens from 360 pixels wide up to large desktops.

## How to run

You need a simple web server, because the game is made of JavaScript modules.

```bash
npm start
```

Then open <http://localhost:8080> in your browser. `npm start` runs
`python3 -m http.server 8080`, so you need Python 3.

Any static file server works, as long as it serves the repository root. The
page must be served over http. Opening `index.html` straight from your disk
will not work, because browsers block ES modules on `file://` pages.

There is no build step and there are no dependencies to install.

### GitHub Pages

To publish the game, turn on GitHub Pages for the repository and choose
**Deploy from a branch**, with the main branch and the root folder. Every path
in the game is relative, so it works from a sub-path such as
`https://YOUR-NAME.github.io/fire-of-london/`. The empty `.nojekyll` file tells
GitHub Pages to serve the files exactly as they are.

## Running the tests

You need Node 22 or newer. Nothing needs installing.

```bash
npm test
```

This runs every test with Node's built-in test runner (`node --test`). To run
one file on its own:

```bash
node --test tests/engine.test.js
```

The tests cover:

- **Engine**: the rules, every action, fire spread, the wind schedule,
  triggers, scoring, saving and loading, and game balance.
- **Map and history data**: landmarks, districts, history cards, quiz
  questions and sources.
- **User interface**: the shell, map view, dialogs and tutorial, tested in
  Node with fake DOM objects.
- **Paths**: every link and import is relative and points to a real file, and
  nothing loads from the network.
- **Smoke test**: every interface module loads in Node with no browser.
- **Integration**: whole games played through the engine, checking that every
  event has a history card, the quiz works and saves round-trip.
- **README**: this file keeps its sections and its British spelling.

## Project layout

```text
index.html            the page
src/main.js           the composition root: joins the engine, data and interface
src/engine/           pure game logic (index.js is the public engine module)
src/data/map.js       the map, landmarks and districts
src/data/history.js   history cards, quiz questions, the debrief and sources
src/ui/               drawing, dialogs, the tutorial and input
tests/                Node tests (tests/helpers/ holds fakes and helpers)
.nojekyll             tells GitHub Pages to serve files as they are
```

The engine and data never touch the browser. The interface modules never import
the engine or data directly: `src/main.js` passes them in, so every part can
be tested in Node.

## Historical sources

The history cards are based on these sources:

- *The Diary of Samuel Pepys*, Samuel Pepys (1666). A navy official who
  watched the fire, told the King about it and buried his Parmesan cheese to
  keep it safe.
- *The Diary of John Evelyn*, John Evelyn (1666). Another eyewitness diary,
  describing the city in flames.
- *The London Gazette, issue 85*, London Gazette (1666). The official
  newspaper's report of the fire.
- *God's Terrible Voice in the City*, Thomas Vincent (1667). A preacher's
  account of the plague and the fire.
- *Rebuilding of London Act 1666*, Parliament of England (1667). The law that
  said new houses must be built of brick and stone. It was passed in February
  1667, but its name uses the old calendar, where the new year began in March.
- *By Permission of Heaven: The Story of the Great Fire of London*, Adrian
  Tinniswood (2003).
- *The Dreadful Judgement*, Neil Hanson (2001).
- *The Great Fire of London*, Stephen Porter (1996).

### What historians are unsure about

- **How it started.** The fire began in Thomas Farriner's bakery in Pudding
  Lane, but nobody knows exactly how. Farriner said he had put his oven out.
- **The real death toll.** Only six deaths were recorded. Some historians
  think the true number was much higher, but nobody knows for sure.
- **This is a game.** The map is a simple grid, not a true street plan. The
  numbers of houses and people, the timings and the way the fire spreads are
  all simplified so that the game is fair and fun to play.

## Accessibility

- Everything can be played with a keyboard alone, and focus is always clearly
  outlined.
- The map uses colours chosen to stay distinct for people with colour
  blindness. Colour is never the only clue: fire levels show one, two or three
  flame tongues, and burnt squares and firebreaks have hatching.
- Buttons you cannot use yet stay reachable and explain why.
- Important news is announced to screen readers.
- Windows such as history cards keep focus inside them, close with Escape and
  return focus to where you were.
- Animations turn off when your device asks for reduced motion.
- The game has no sound, and the text is written to be read by children aged
  about nine and up.

## Licence

Fire Of London is released under the MIT Licence.
