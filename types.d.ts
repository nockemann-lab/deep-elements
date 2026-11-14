// Type declarations for the type checker (the editor's, and tests/typecheck.sh).
// Nothing here is loaded by the game: it only describes what the scripts share.

/** The game's single state object. Its shape is taken from state.js. */
type GameState = { [Field in keyof typeof GAME_STATE]: (typeof GAME_STATE)[Field] };

/**
 * The global namespace each script hangs its module on (Game.ui, Game.loop,
 * Game.gfx ...). Only the state is described in detail; the modules are
 * untyped, so a misspelt call across modules is not caught.
 */
interface GameNamespace {
  state: GameState;
  [module: string]: any;
}

declare var Game: GameNamespace;

// Functions the scripts publish for the menu buttons and the tests
interface Window {
  Game: GameNamespace;
  startLevel: Function; beginGame: Function; startElementRun: Function; stashAndContinue: Function; pushLuckAndContinue: Function;
  respawnAtRefuge: Function; showMissionMap: Function;
  showSharedLevelDialog: Function; hideSharedLevelDialog: Function; playSharedLevel: Function;
  showMenuTab: Function; clearScores: Function; showMenuScreen: Function;
  openNotebook: Function; closeNotebook: Function; openDoc: Function; closeDoc: Function;
  toggleReducedFx: Function; resetPTProgress: Function; toggleMute: Function; cycleVolume: Function;
  /** The documents bundled by generate-docs-inline.js */
  __DOCS__?: Record<string, string>;
  /** Safari's older name for AudioContext */
  webkitAudioContext?: typeof AudioContext;
}
