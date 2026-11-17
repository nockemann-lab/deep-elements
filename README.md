# Deep Elements

A browser mining puzzle game about the periodic table and the supply chains behind
everyday technology. Dig, dodge cave creatures and falling boulders, and collect the real
elements inside a smartphone, a wind turbine or an MRI scanner - each one comes with a
sourced fact about what it does and where it really comes from.

> The facts are real. The mining is a game.

## Play

There is no build step. Either:

- open `index.html` directly in a browser, or
- serve the folder and open it over HTTP:

  ```sh
  python3 -m http.server 8765
  # then visit http://localhost:8765
  ```

Controls: arrow keys or WASD to move and dig, `1`–`5` to use a tool, `P` to pause, `R` to
restart. On a touch screen, use the on-screen D-pad or drag a finger across the mine (keep
holding to keep walking), and tap a tool to use it.

## Modes

| Mode | What it is |
|---|---|
| Tutorial | Six guided lessons: every block, tool, machine and creature is met as a small task that has to be solved to get on |
| Critical Missions | 31 hand-built missions at real mines on a zoomable world map |
| Endless Depths | Procedural mines with a push-your-luck periodic-table collection |
| Element Runs | Three timed caverns built on the periodic table: a sprint over the first twenty elements, and two routes through all 94 elements found in nature |
| Shared levels | Paste a level made in the level editor (its **Copy JSON** button) into *Play a shared level* |

Everything collected is kept in the **Field notebook** on the main menu. It starts empty
each time the game is opened, so it always matches what has been found in that sitting.

## Project layout

- `index.html`, `style.css` - page shell and styling
- `config.js`, `data.js` - constants; element encyclopedia, device recipes, glossary
- `state.js`, `level-sets.js`, `level-gen.js` - game state, level loading, building a level
- `game.js`, `input.js`, `physics.js`, `enemies.js`, `machines.js` - rules, controls, gravity and fluids, creatures, machinery
- `render*.js` - drawing; `ui.js`, `mission-map.js`, `shared-level.js`, `sound.js` - interface and audio
- `Levels/`, `BonusLevels/`, `Tutorials/`, `ElementRun/` - level files (JSON) with a `manifest.json` each
- `levels-inline.js`, `docs-inline.js` - **generated** bundles, so the game also runs from `file://`
- `Level Editor.html` - level editor with solvability validation and a live preview
- `tests/` - smoke tests

`ARCHITECTURE.md` explains how the pieces fit together.

## Tests

```sh
tests/run.sh
```

Runs the game in headless Chrome and checks that every level starts and that the main
rules still hold. Set `CHROME=/path/to/chrome` if Chrome is not found.

```sh
tests/typecheck.sh
```

Type-checks the scripts (needs Node). It reports misspelt state fields and tile names,
wrong argument counts and misuse of page elements. Nothing is built, and VS Code shows
the same warnings as you type.

## Editing levels

Levels are plain JSON; the format is documented in `Tutorials/_SPEC.md`.

In the level editor, **Load JSON** opens a level file and **Save JSON** writes it back to
the same file under the same name (in Chrome or Edge directly; other browsers download
it under that name). A new level is saved under a name you choose. Each folder's
`manifest.json` lists which files the game loads, in order: a renamed or added level must
be listed there too. Lessons' hint banners are placed and edited with the editor's **Hint** tool.

After changing any level file, regenerate the bundle, or the game will keep loading the
old version:

```sh
node generate-levels-inline.js
```

The sources, teacher's guide and credits open inside the game. After editing any of
those three Markdown files, regenerate their bundle the same way:

```sh
node generate-docs-inline.js
```

Validate a level's structure and solvability with:

```sh
node Tutorials/_validate.js Levels/01_Circuit_Board.json
```

## Documentation

- `TEACHERS_GUIDE.md` - learning objectives, a lesson plan and a game-versus-reality table
- `ANSWER_KEY.md` - every quiz question with its answer, written from the level files by `generate-answer-key.js`
- `SOURCES.md` - references for the facts, mines and device recipes
- `CREDITS.md` - asset provenance and licences
- `LICENSE`, `LICENSE-CONTENT.md` - the licences in full

Found a factual error? It is treated as a bug - please open an issue.

## Licence

- **Code:** MIT - see `LICENSE`.
- **Educational content** (levels, element facts, quiz questions, the teacher's guide and
  sources): CC BY-NC-SA 4.0 - see `LICENSE-CONTENT.md`. Use it, adapt it and translate it
  for teaching and any other non-commercial purpose; give credit and share what you make
  under the same licence. Commercial use needs the author's permission.
- **Music** is used under a licence personal to the author and is not relicensed; the
  AI-generated images, the NASA world map and the fonts have their own terms. Details are
  in `LICENSE-CONTENT.md` and `CREDITS.md`.

## How to cite

> Nockemann, P. (2026). *Deep Elements* (Version 1.0.0) [Computer software].
> https://github.com/nockemann-lab/deep-elements

Author: Peter Nockemann, Queen's University Belfast
([ORCID 0000-0001-9864-9702](https://orcid.org/0000-0001-9864-9702)) - p.nockemann@qub.ac.uk

GitHub's "Cite this repository" button gives the same reference in APA and BibTeX form; it
is generated from `CITATION.cff`.

