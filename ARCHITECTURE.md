# Deep Elements - how the code is organised

The game is plain JavaScript loaded by `index.html` with ordinary `<script>` tags. There
is no build step and no framework, so it runs from a folder as well as from a web server.
Everything hangs off one global object, `Game`; a handful of constants (`T`, `PU`,
`ALL_ELEMENTS`, `SCENARIOS`…) are plain globals defined in `config.js` and `data.js`.

## Layers

Files are loaded roughly in this order, and each layer only relies on the ones above it
at load time. Calls between modules at run time go through `Game.<module>`. (Two files sit
lower in `index.html` than their layer suggests: `machines.js` and `shared-level.js` are
loaded after `input.js`, just before `game.js`. Nothing calls them until a level runs.)

| Layer | Files | What it holds |
|---|---|---|
| Constants and content | `config.js`, `data.js` | Tile ids, creature definitions, tuning constants, ways to die; the element encyclopedia, device recipes, glossary |
| Bundled data | `levels-inline.js`, `docs-inline.js` | **Generated.** Every level and the three documents, so the game works from `file://` |
| Level loading | `level-sets.js` | `Game.levels`, `Game.bonusLevels`, `Game.tutorials`, `Game.elementRun` - one loader, four sets |
| Sound | `sound.js` | `SFX`: effects synthesised with Web Audio, the music loops, volume and mute |
| State | `state.js` | `Game.state`: the single mutable record of a run (grid, miner, creatures, score…) |
| Simulation | `camera.js`, `enemies.js`, `physics.js`, `machines.js`, `level-gen.js` | Viewport sizing; creature AI; gravity, blasts and fluids; carts, lifts and borers; building a level into the state |
| Interface | `ui.js`, `mission-map.js`, `shared-level.js` | HUD, overlays, notebook, document viewer; the world map; pasted level codes |
| Drawing | `render-core.js`, `render-tiles.js`, `render-creatures.js`, `render-player.js`, `render.js` | See below |
| Control | `input.js`, `game.js` | Keyboard and touch; movement rules, collecting, level flow, win and death |

## The state object

`Game.state` (aliased `s` in every file) is deliberately one flat object: any module may
read it, and the modules listed under *Simulation* and *Control* write to it. Two rules
keep that manageable:

- **A level is loaded by `level-gen.js`** (`loadCustom` for a level file, `generateRandom`
  for Endless Depths). Anything a level needs to reset belongs there.
- **A run is snapshotted by `CHECKPOINT_FIELDS`** in `game.js`. A new piece of run state
  that should survive a refuge respawn must be added to that list. The same snapshot
  serves the lessons: a hint marked `"save": true` takes one as it appears
  (`saveLessonCheckpoint`), `s.checkpointHint` records which hint it was (−1 for a
  refuge), and `respawnAtRefuge()` restores either kind - free for a lesson's own
  checkpoint, at `RESPAWN_COST` for a refuge. The death card and, in a lesson, the pause
  and restart cards offer it.

## Movement rules

`movePlayer(dx, dy)` in `game.js` is the heart of the rules. It builds a *step*
(`{ dx, dy, nx, ny, target }`, where `target` is the tile being entered) and passes it
through, in this order:

1. things that stop a step outright: a moving machine, an impassable tile, lava, a tunnel
   borer, and the every-other-attempt rule for wading;
2. a **shove rule** for the tile, if it has one (`SHOVE_RULES`: boulders, barrels, webs, lava veins,
   springs);
3. a creature in the cell, which is fatal;
4. an **enter rule** for the tile, if it has one (`ENTER_RULES`: doors, keys, carts,
   answer pads, elements, tools, the exit);
5. the step itself: the miner moves, the cell left behind is restored, sounds and dirt.

A rule is a small function that does what its tile does and returns `STOP` if the miner
should not go on to enter the cell. To give a tile a new behaviour, write a rule and add
it to one of the two tables. `tests/smoke.js` has one small scene per rule.

## Time

Rules run on timers, not on the frame loop. `startIntervals()` in `game.js` is the one
place they are created, through `every(ms, fn)`, and `clearIntervals()` stops them all.
Drawing runs on `requestAnimationFrame` in `render.js`, which also polls held keys
(`Game.loop.tickInput`) so movement stays in step with the picture.

`every()` is also where the mine stands still. No timer fires while the game is paused,
nor, in a lesson, while a hint or a new element's card is being read (`mineWaits()`:
something to read has appeared, its reading time is not yet up, and the miner has stood
still for `HINT_IDLE_MS`). `holdForReading()` starts such a wait and `noteAction()`, called
by every step and every tool, ends it; the constants are the `HINT_*` values in
`config.js`. Because the test is made in `every()`, a new timed rule is held with all the
others without knowing about it. Missions, runs and shared levels are never held.

Drawing never changes the game: the render files only read `Game.state`. The one kind of
thing they do write is visual bookkeeping: particle positions, finished effects, the
smoothed position a creature is drawn at, and the fog memory of which cells have been
seen. Anything that affects play is moved by a timer.

## Drawing

`render.js` draws a frame. `render()` itself is a short list of steps:

1. `beginFrame()` reads the level, places the camera on the miner and works out how far
   they can see. The results are the *frame state* variables at the top of the file.
2. `drawCells()` walks the visible cells and calls one **painter** per kind of tile
   (`paintElement`, `paintPowerup`, `paintGas`…). Cells beyond sight that have been seen
   before are drawn simplified by `drawTileSimple()`. Nothing is dimmed cell by cell: the
   lamplight falling off is one round gradient laid over the frame by `drawFog()`
   (`FOG_FALL`, `FOG_START`, `FOG_EDGE`), centred on the miner as drawn.
3. One function per layer follows, in drawing order: `drawSlidingTiles`,
   `drawPlacedDynamite`, `drawCreatures`, `drawMiner`, the machines, `drawQuizQuestion`,
   `drawFog`, the effects, and finally `drawMinimap`.

To change how a tile looks, edit its painter; to add a tile, add a painter and a line in
the `switch` in `drawCells()` (and in `drawTileSimple()` for its remembered look).
The sprites the painters call are in the other `render-*.js` files.

They share one object, `Game.gfx` (defined in `render-core.js`). `render.js` calls
`gfx.begin(context, tileSize, frame)` at the start of each frame; every render file
registers a `gfx.bind()` callback that copies those into local `ctx` / `TILE` variables,
which is why sprite code can use them directly. Sizes are written for a 32-pixel tile
and scaled with `S(n)`. Functions one file offers to the others are listed at the bottom
of that file as `gfx.name = name`.

Earth, walls, rock, ice and basalt are painted once per tile size into offscreen canvases
(`ensureTerrain`) and then copied, so their detail costs nothing per frame.
`shadeTileEdges()` then adds the depth cues per cell: shading where open cave meets
ground, a lit lip and dark underside on ground facing open space, and rounded outer
corners on natural ground (`ROUND_TILE`: earth, rock, ice - not masonry or doors).

Text drawn on tiles (element symbols, pad letters, a creature's "!") is white or coloured
pixel type with a dark outline, never a blurred shadow - see `drawSymbol()`.

`Game.render.icon(canvas, kind, fill)` draws a single sprite into another canvas - as an
icon, or with `fill` as a whole tile on the cave floor. The menu, the field guide, the
tool slots under the mine (`toolIcon()` in `ui.js`) and the level editor use it so their
pictures always match the game.

## Banners over the mine

On a touch screen the hint banner and the fact toast lie over the canvas. `placeOverMine()`
in `ui.js` moves one to the bottom edge of the mine when it would cover the miner, and
back when it no longer does; `updateHUD()` calls it on every step. On a desktop both sit
below the canvas and the function leaves them alone.

"Effects: Reduced" (`s.reducedFx`) removes the screen shake, the explosion, crush and
death flashes, the collect flash and the looping CSS animations (`body.reduced-fx`). A new
effect that flashes or shakes should check it. Without a saved choice the game follows
the system's "reduce motion" setting.

## Content

- **Elements, recipes, roles, glossary:** `data.js`. The level editor and the validator
  read the same tables, so a recipe is changed in one place.
- **Levels:** JSON files in `Levels/`, `BonusLevels/`, `Tutorials/`, `ElementRun/`, each
  folder with a `manifest.json`. Format: `Tutorials/_SPEC.md`.
- **Mines on the map:** the `MINES` list in `mission-map.js`, in the same order as the
  level manifests (`Levels/` first, then `BonusLevels/`).
- **Documents:** `SOURCES.md`, `TEACHERS_GUIDE.md`, `CREDITS.md`, shown in the game by the
  small Markdown renderer in `ui.js`.

After editing levels or documents, regenerate the bundles:

```sh
node generate-levels-inline.js
node generate-docs-inline.js
```

## Tests

`tests/run.sh` loads the real game in headless Chrome with `tests/smoke.js` appended and
prints one line per check. The tests drive the game through its public entry points
(`Game.map.start`, `Game.loop.*`, key and pointer events) and cover: every level starting
and drawing, collecting, the quiz, restart and inventory rules, checkpoints, shared-level
sanitising, the win and death screens, the document viewer, tap/hold/touch movement, one
scene per movement rule, and a level that draws every tile, creature and machine. Lessons
3 to 6 are also walked through part by part on their real maps, the right way and some
wrong ways (`lessonStart`, `route`), with the timed rules ticked by hand; a lesson whose
map is changed needs its routes there changed with it.

Run them after any change. They do not judge how the game looks or feels.

## Type checking

The scripts stay plain JavaScript, but `jsconfig.json` asks TypeScript to check them:
in VS Code as you type, or with `tests/typecheck.sh`. `types.d.ts` holds the few
declarations the checker needs and is never loaded by the game.

- **State.** The shape of `Game.state` is taken from the object in `state.js`. A new
  field must be added there with its starting value, or every use of it is an error.
- **Tile and tool names.** `T` and `PU` are frozen, so `T.EARHT` is an error.
- **Within a file,** calls to its own functions are checked for argument count, and
  page elements for the properties used on them (hence the occasional
  `/** @type {HTMLButtonElement} */` cast).
- **Not checked:** calls between modules (`Game.ui.x()`, `Game.loop.x()`, `gfx.x()`), the
  shape of enemies, levels and other records, and null values (strict mode is off).

## Buttons

Buttons and links carry `data-action="name"` (and optionally `data-arg`); one click
listener in `input.js` looks the name up in its `ACTIONS` table. To add a button, add
an entry there - the markup holds no script.

## Known debts

- `style.css` is one file, and 25 selectors are still styled in more than one place
  because merging them could change which rule wins. The contents list at the top of
  the file says where; when editing one of those, change its last occurrence.
- The level editor draws tiles, creatures and tools with the game's sprites, but keeps
  its own drawings for what only it shows: the element symbol on a gem, the answer on
  a pad, and the borer and refuge footprints.
- The level editor is checked by hand and by its own validator, not by `tests/`.
- The type checker does not follow calls between modules, because each module is
  attached to `Game` at run time; describing them in `types.d.ts` would close that gap.
