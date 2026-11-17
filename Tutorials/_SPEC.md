# Deep Elements - Tutorial Level Authoring Spec

Tutorial levels are JSON files in `Tutorials/`, with the same schema as the mission files
in `Levels/`. What makes a level a tutorial is its `hints` field, which any level may
carry. Tutorials are loaded by `level-sets.js` and played in manifest order from the
**Tutorial** card on the main menu.

## JSON schema

```json
{
  "cols": 20, "rows": 15,
  "scenario": 0,
  "levelName": "Mining Basics",
  "timer": 240,
  "sight": 7,
  "grid": [ /* cols*rows tile ids, row-major: grid[y*cols+x] */ ],
  "player": {"x":1,"y":1},
  "exit": {"x":18,"y":13},
  "elements": [{"x":5,"y":3,"key":"Cu"}],
  "hiddenElems": [{"x":8,"y":9,"key":"Pt"}],
  "powerups": [{"x":4,"y":6,"type":0}],
  "enemies": [{"x":15,"y":10,"type":"bat"}],
  "pads": [{"x":3,"y":12,"key":"Au"}],
  "triviaQuestion": "…?", "triviaAnswer": "Au", "triviaPos": {"x":3,"y":10},
  "hints": [{"x":1,"y":1,"r":1,"icon":"⛏️","title":"WELCOME","text":"Use the <strong>arrow keys</strong> to move.",
             "task":"Dig east to the indium.","save":true}]
}
```

## Tile ids (grid values)

| id | tile | behavior |
|---|---|---|
| 0 | EMPTY | open tunnel |
| 1 | EARTH | diggable - walking into it digs it |
| 2 | ROCK | indestructible wall (dynamite does NOT clear it) |
| 3 | BOULDER | falls when unsupported, rolls off edges, kills when it lands on you, pushable horizontally, crushes enemies (a falling boulder bounces off a crab; one shoved into a crab crushes it) |
| 7 | WALL | indestructible border/structure |
| 8 | HAZARD (toxic barrel) | falls, explodes 3×3 on impact, pushable |
| 9 | EARTH_RICH | like EARTH, golden particles (cosmetic flavor) |
| 12 | WATER | swimmable at half speed; snakes swim, bats drown |
| 14 | WATER_SRC | looks like earth; digging it releases WATER which floods downward/sideways. It also floods any EMPTY cell below or beside it without being dug |
| 15 | KEY | walk over to collect |
| 16 | DOOR | consumes one key to open, else blocks |
| 18 | LOGIC_DOOR | opens ONLY when correct trivia pad is stepped on (a wrong pad costs 30 s, and the game deals the pad answers onto the pad positions afresh on every load; `triviaTrap` is no longer used) |
| 19 | WEB | slashing through costs one move; spiders leave them |
| 20 | CART | push horizontally → rolls until obstacle, crushes enemies/player in path |
| 21 | CART_BOUNCE | becomes a bouncing minecart entity patrolling horizontally - DEADLY on touch |
| 22 | ROLL_BARREL | push → rolls, falls, EXPLODES on impact |
| 23 | ICE | solid block; only explosions clear it (dynamite or a detonating barrel) |
| 24 | LAVA | instant death; spreads slowly |
| 25 | LAVA_SRC | looks like earth; digging it turns it to LAVA and the miner stays where they are - the next step into it is death. It also fills any EMPTY cell below or beside it without being dug |
| 26 | SPIDER_NEST | solid; every 5 s it has a one-in-three chance of putting a spider on an adjacent empty tile; dynamite destroys it |
| 27 | BASALT | solid; cracks and crumbles away on its own 8–12 s into the level; dynamite clears it. Use it as a timed release (a pile of boulders, a pocket of gas), not as a wall to wait at |
| 28 | SHAFT_LIFT | becomes a vertically bouncing lift entity - DEADLY on touch |
| 29 | TBM | tunnel borer marker (TOP-LEFT of 3×2): patrols horizontally, grinds all but walls/doors/pads/refuges, spares collectibles, deadly cutter |
| 30 | REFUGE | refuge chamber marker (TOP-LEFT of 3×3): corner posts + safe floor; entering saves a respawn checkpoint (−100 on respawn); blocks enemies/machines/floods |
| 31 | GAS | greenish gas cloud: suffocates within 3 s without a mask; enemies avoid it; bats die in it; IGNITES explosively if a blast touches the cloud |
| 32 | GAS_SRC | ruptured pipe (solid): continuously leaks gas (spreads UP then sideways); dynamite destroys it (seals the leak) |

NEVER put ids 4, 5, 6, 10, 11, 17 in the grid - the loader places those from the
`player`/`exit`/`elements`/`powerups`/`hiddenElems`/`pads` lists (leave those cells 0 or 1).
Tiles 13 (FUSE) is vestigial - do not use.

## Powerup types
0 = 🧨 Dynamite (press 1; a fuse of 5, burned by every move and by every second; clears EARTH/BOULDER/ICE/HAZARD/BASALT/NEST in 3×3 - NOT rock/wall, attracts spiders)
1 = 🔦 Helmet Lamp (press 2, doubles vision 12 s)
2 = 📲 Geiger Counter (press 3, reveals hiddenElems for 15 s - required to collect them)
3 = 🤿 Gas Mask (press 4, breathe safely in gas for 20 s)
4 = 🚰 Water Pump (press 5, place beside water: drains the connected flood over time and caps its springs)

## Enemies
- `bat` - flies, hunts by sight (10-tile line of sight; earth blocks sight), and senses the miner through earth within 5 tiles, further at higher `difficulty`. Crushable.
- `snake` - ambush hunter: ignores you until you come within 3 tiles (up to 6 at the highest `difficulty`), then strikes fast. Swims through water. Crushable.
- `crab` - digs through earth toward you, very slow, short sight. Falling boulders bounce off its shell - use dynamite, shove a boulder into it, or outrun it.
- `spider` - blind; senses digging/explosion tremors within 15 tiles; leaves webs. Crushable.
  Breaking ground is felt at the full 15 tiles: earth, a spring, a lava vein, a bonus
  element dug out of earth. Picking up an element, a tool or a key is felt only within 5
  (`TREMOR_RADIUS`, `PICKUP_TREMOR_RADIUS` in `config.js`), so keep pick-ups further than
  that from a spider that is meant to stay asleep. Walking, cutting a web and pushing a
  boulder make no tremor. Distances are counted in steps (across plus down), through rock.

Place enemies on EMPTY (0) tiles, ≥8 tiles walking distance from the player start.

A creature patrols from the first second, so by the time the miner arrives it may be
anywhere it can reach. To have one lie in wait, add `"wait": true`:
`{"x":14,"y":6,"type":"bat","wait":true}`. It then stays exactly where the level puts it
until it first notices the miner (or, for a spider, feels a tremor), and from then on it
behaves like any other. The lessons use this for every creature, so that each is met
where its hint says it is. The level editor cannot set the flag but keeps it on export.

## Element keys must match the scenario
scenario 0 Smartphone: req In,Sn,Ta,Ga,Li,Co,Nd,Au,Al / bonus Pt,W,Ge,Y,Ag
scenario 1 Circuit Board: req Cu,Au,Sn,Ag,Si,Ni,Pd,Br,Fe / bonus Ta,Ga,In,Pt,Ge
scenario 3 Solar Panel: req Si,Ga,In,Ag,Cu,Cd,Te,Sn,Al / bonus Ge,Ni,Fe,P,Nd
scenario 7 Battery Pack: req Li,Co,Ni,C,Cu,Al,Fe,Mn,P / bonus Ga,Si,Sn,Ti,Ag
scenario 9 Quantum Computer: req Nb,Al,Si,Au,He,Nd,Ta,Cu,In / bonus Ge,Ga,Ti,Ag,Er
(see `_validate.js` for all)

## Hints
`hints: [{x, y, r, icon, title, text, task, save}]` - when the player is within Chebyshev
distance `r` (default 1) of `(x,y)`, a banner shows `icon title` and `text` (HTML allowed:
`<strong>` = gold, `<em>` = cyan). `task` (optional) is shown on a line of its own under
the text, marked ▶: the one thing the player is to do next. `save` (optional, lessons
only) is described below. On a desktop the banner sits below the mine; on a touch
screen it lies over the mine and moves out of the miner's way. Each hint fires once, at
most one per step; it stays at least 14 s (longer when the text needs it: its reading
time plus 5 s) and is copied into the event log. Order the array by intended encounter
order (earlier entries win ties).

**In a lesson the mine waits while a hint is read.** After a hint appears, nothing moves -
creatures, machines, floods, fuses, the clock - for as long as the miner stands still, up
to the hint's reading time (2 s plus 0.35 s per word; `HINT_READ_*` in `config.js`). The
banner then shows "⏸ The mine waits while you read - move to go on" and the clock shows ⏸.
A miner who keeps walking is never held; the first step after a wait ends it, and so does
using a tool. The card of a newly found element holds the mine the same way for 8 s.
This happens only in Tutorial mode: a mission, run or shared level with hints is not held.

**A hint with `"save": true` is a checkpoint.** In Tutorial mode the whole mine is
snapshotted as such a hint appears. From then on the death card offers "↩️ TRY THIS PART
AGAIN" and the pause card "↩️ RETRY THIS PART": the mine, the miner, the pack and the
score go back to that moment, the hint is shown again, and nothing is charged. A stick
that is still burning when the hint appears goes back into the saved pack. A refuge
chamber in a lesson is an ordinary checkpoint (respawning costs 100 points) and replaces
the hint's; the pause card then offers "⛑️ BACK TO THE REFUGE (−100)", so a miner who has
wasted a tool can go back without dying first. Outside Tutorial mode `save` does nothing.
Put `save` on a hint only where the miner is safe at the moment it fires: a retry starts
there, with the mine as it was.

The level editor places and edits hints: choose the **Hint** tool, click a cell to add one,
click its number to select it, drag to move it, right-click to delete it. Its validator
warns about a hint the miner can never reach, one that fires right under a boulder, a
lesson with no hint at the start, and a lesson hint without a task.

- ALWAYS include a welcome hint that fires at the player spawn.
- Place hints a couple of tiles BEFORE the thing they explain, so the player reads first,
  encounters second. Danger hints must fire outside lethal range of the danger.
- ONE rule per hint, in `text`, and one instruction in `task`. The lessons' hints run from
  about 30 to about 100 words with the task; the reading time grows with the length.
  5–8 hints per level.
- Fire the hint with `r: 0` on a cell the route must cross (a one-tile doorway) when the
  part it opens must not be entered unread.
- A hint that asks the player to wait for something timed (a machine passing, basalt
  crumbling) is itself held while it is read: the thing only moves on once the reading
  time is up or the miner has taken a step.

## Element Run fields (`ElementRun/` levels)

A run is one level with three optional fields of its own. The validator checks them
wherever they appear.

```json
"run": {"id":"first20", "tag":"SPRINT · 20 ELEMENTS", "color":"#7ad0ff",
        "blurb":"…", "winLine":"…", "winSub":"…"},
"families": [{"name":"Row 1", "keys":["H","He"], "bonus":60, "color":"#7ad0ff"}],
"gates": [{"question":"…?", "answer":"He", "pos":{"x":9,"y":3},
           "pads":[{"x":8,"y":4,"key":"He"},{"x":10,"y":4,"key":"H"}],
           "doors":[{"x":14,"y":4}]}]
```

- `run` describes the card in the list of runs. `id` names the saved record
  (`deepElements_runBest_<id>`), so do not change it once a run is published.
- `families`: collecting every element in `keys` adds `bonus` seconds to the clock, once.
  Set `timer` low and let the families carry the run; the sum of `timer` and all bonuses
  is the most time a player can ever have.
- `gates`: several quiz doors in one level. Each gate's pads open only that gate's `doors`.
  A door cell must already be a LOGIC_DOOR (18) in the grid - a gate claims doors, it never
  makes one. Pad cells are set by the loader and the answers are dealt onto them afresh at
  every load. Logic doors that no gate claims still belong to the level's single quiz
  (`pads`, `triviaQuestion`, …).
- The level editor keeps all three fields on export but cannot edit them, and its own
  validator does not know about gates: check a run with `node Tutorials/_validate.js`.

## How a lesson is built
The six lessons are chains of small parts, and each part is a gate: the way on is closed
until the player has used the one thing the part teaches. The rules they were built to:

- **Nothing is scenery.** Every block, tool, creature and machine on the map either bars
  the way or is what opens it. A tile the player can walk past without doing anything is
  taken out.
- **The right way is the only way.** The wrong move is either blocked (a boulder in water
  will not be pushed, the exit stays barred) or fatal (a step into lava, a stick lit under
  firedamp), and the hint says which. The validator proves only that a route exists; that
  there is no route *round* a gate has to be checked by playing the wrong ways.
- **The tool lies at the gate**, one of it, and the part begins with a `save` hint (or a
  refuge), so that a wasted tool costs a retry of that part and not the lesson.
- **Each hint states a rule and sets a task.** Only true statements: a number in a hint
  (a fuse of five steps, a snake's three tiles) must be the engine's number. That is why
  the lessons carry `"difficulty": 0`: the creatures' senses grow with difficulty.
- **Nothing moves before the player acts.** Springs and veins are sealed, gas is boxed in,
  creatures wait (`"wait": true`). `tests/smoke.js` checks this for every lesson.
- Three engine rules that shape a gate: water and lava never flow into the cell the
  miner stands in; a boulder or cart pushed along a tunnel flattens a creature in its way;
  a blast lights every gas cell within two tiles of the stick, and then the whole cloud
  joined to it burns, with its vent.

## Design rules
- Win = collect ALL `elements` then step on exit. Use 3–5 elements so lessons stay short.
- Border (row 0, last row, col 0, last col) must be entirely WALL (7).
- Generous `timer` (240–360 s). No unfair deaths: every hazard must be survivable on a
  first encounter after reading its hint - also by a player who walks slowly, and by one
  who does not stop to read.
- `sight` (fog-of-war radius, tiles): omit for the default 8.4. Hard missions and lesson 6 use 5;
  valid range 3–14. The helmet lamp doubles whatever is set.
- `difficulty` (enemy speed and detection range): 0 = gentlest … 7 = fastest. Omit to
  use the default - a tutorial file without it ramps by lesson number, missions follow the
  world map's easy/medium/hard label (1 / 4 / 7), shared levels get 0. All six lessons
  set 0.
- A mission must be completable even if the player wastes some resources (e.g. give a
  spare dynamite). A lesson gives exactly what a part needs and relies on its checkpoints
  instead (see above).
- Grid is row-major with y down. Boulders fall in +y.
- A boulder with EARTH under it stays put until the earth is dug.
- Gas never spreads downwards, and earth holds it back: a pocket entered from below stays
  where it is, one entered from the side leaks into the corridor.
- A spring or lava vein with an EMPTY cell below or beside it flows from the first second,
  whatever the hints say about digging. Seal it in earth or rock, or give the lava a small
  walled pit to fill; the validator warns about an open spring or a lava pit and fails a
  level whose lava floods more than six cells.
- The pump follows the flood through WATER tiles only. An element or powerup lying in a
  flooded gallery cuts the flood in two; put it in a nook beside the water instead.
- A tunnel borer clears its lane within the first minute. Give the miner a safe cell
  beside the lane to wait in, and a way out that is not at the very end of the lane
  (the borer turns there, so the gap behind it is shortest).
- The validator's route-finder knows two things beyond walking and digging: lava on an
  unbroken run of tunnel with a cart in it can be crossed (the cart is ridden over it),
  and a gas vent can be removed (a blast burns it away with its cloud). It does not know
  whether the player has the stick or can reach the cart; play the level.

## Workflow
1. Sketch the layout in ASCII, one char per tile; convert to the flat grid with a small
   throwaway Node script (write it to /tmp, not this repo).
2. Write `Tutorials/<yourfile>.json`.
3. Run `node Tutorials/_validate.js Tutorials/<yourfile>.json` - fix ALL errors; justify
   any remaining warnings.
4. Walk the solution path start→finish in the game; verify every element is collectable
   and every hint fires along the natural route. For a lesson, also play each part the
   wrong way and check that it ends as its hint says, and that the retry puts it back.
