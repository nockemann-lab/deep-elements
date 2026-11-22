"use strict";

// ═══════════════════════════════════════════════════════════════════
// state.js - Centralised mutable game state (replaces all globals)
// ═══════════════════════════════════════════════════════════════════

// Every field the game keeps is listed here with its starting value: this
// object is also what the type checker takes as the shape of the state, so a
// field that is not listed here is reported as a mistake (see types.d.ts).
var GAME_STATE = {
  // Grid
  grid: [],
  cols: 20,
  rows: 15,
  tile: 32,

  // Canvas (set below after DOM is available)
  canvas: null,
  ctx: null,

  // Player
  playerX: 1,
  playerY: 1,
  playerDir: 1,
  playerFacing: "south",
  playerOnWater: false,
  playerDigTime: 0,
  playerIsDigging: false,
  playerVisualFromX: 1,
  playerVisualFromY: 1,
  playerVisualToX: 1,
  playerVisualToY: 1,
  playerMoveAnimStart: 0,
  playerMoveAnimDuration: 90,

  // Held movement input
  keys: { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false },
  lastMoveKey: "",
  activeMoveKey: "",
  moveCooldownUntil: 0,
  moveRepeatMs: 90,
  // pause between the first and second step of a held key (a tap = one tile)
  moveFirstRepeatMs: 130,
  // a touch (the mine or the D-pad) waits longer before it repeats: see tickInput
  touchFirstRepeatMs: 320,
  touchHeld: false,
  // the cell the next touch step enters, outlined on the mine while a finger is down
  /** @type {{x:number,y:number}|null} */
  touchAim: null,
  moveStreak: 0,
  tapQueued: "",
  // counts fresh presses of a direction (not auto-repeat), and where a lava vein was just broken open
  pressSeq: 0,
  /** @type {{x:number,y:number,press:number}|null} */
  lavaRecoil: null,

  // Game flow
  running: false,
  paused: false,
  mode: "random",
  level: 0,
  difficulty: 0,
  levelName: "",

  // Level objects
  exitX: 0,
  exitY: 0,
  elementMap: {},
  hiddenElementMap: {},
  powerupMap: {},
  collected: [],
  totalElements: 0,
  moves: 0,

  // Current scenario (set per level)
  scenario: null,
  elements: {},
  elementKeys: [],
  compOrder: [],
  components: {},
  bonusElements: {},
  bonusKeys: [],

  // Entities
  enemies: [],
  enemiesKilled: 0,

  // Visual effects
  crushEffects: [],
  explosionEffects: [],
  digParticles: [],

  // Screen shake
  screenShake: 0,
  screenShakeTime: 0,

  // Fog of war
  explored: [],
  seenTile: [],

  // Mechanics
  placedDynamite: [],
  waterSlowToggle: false,
  waterLevel: {},
  lavaLevel: {},
  basaltLife: {},
  fallingBoulders: {},
  hazardFalling: {},
  bouncingCarts: [],
  shaftLifts: [],
  rollingCarts: [],
  rollingBarrels: [],
  rollingBarrelFalling: {},

  // Score & combo
  score: 0,
  comboCount: 0,
  comboMultiplier: 1,
  lastComponentCompleted: -1,
  keysCollected: 0,

  // Timer
  levelTime: 0,
  maxLevelTime: 90,

  // Power-ups
  inventory: [0,0,0,0,0],
  activeEffects: { lamp: 0, geiger: 0, mask: 0 },

  // Rendering
  animFrame: 0,
  camX: 0,
  camY: 0,
  renderReq: null,

  // Death animation
  deathAnim: null,

  // Trivia (custom levels)
  triviaMap: {},
  triviaQuestion: "",
  triviaAnswer: "",
  triviaTrap: "",
  triviaPos: null,
  gates: [],          // further quiz gates: { question, answer, pos, doors, open }
  padGate: {},        // "y,x" of a pad -> index of the gate it belongs to
  gateDoorCells: {},  // "y,x" of a logic door -> index of the gate that opens it
  families: [],       // element families of a run: { name, keys, bonus, color }
  familiesDone: {},   // family name -> 1 once complete
  runInfo: null,      // the "run" block of an Element Run level

  enemyDanger: null,
  ptSnapshot: null,

  // Player identity
  playerName: "MINER",

  // Periodic table meta-progression (Endless Depths)
  ptDiscovered: {},

  // Push-your-luck (Endless Depths)
  pushingLuck: false,
  luckStreak: 0,
  unstashedDiscoveries: [],
  ptStashedSnapshot: null,
  runActive: false,
  runBonusCollected: {},

  // Sight and camera easing
  baseSight: BASE_SIGHT,
  camSmoothX: 0,
  camSmoothY: 0,
  reducedFx: false,
  previewMode: false,          // set by the level editor's preview

  // Per-level bookkeeping
  bonusFound: 0,
  bonusTotal: 0,
  newFinds: 0,
  readFreeze: 0,               // seconds the clock is still held for reading
  quizNear: /** @type {false|string} */ (false),
  restartArmed: false,
  exitBarredAt: 0,             // when the barred exit last said why (ms)
  lastStepAt: 0,
  levelStartInventory: [0,0,0,0,0],
  levelStartScore: 0,          // Endless: the score a depth was entered with
  endlessRunId: 0,             // Endless: one leaderboard row per game
  tutorialHints: [],
  hintHoldFrom: 0,             // lessons: when the last hint appeared (ms)
  hintHoldUntil: 0,            // lessons: the mine may wait for its reading until then (ms)
  lastActionAt: 0,             // the miner's last step or tool (ms)
  mineWaiting: false,          // lessons: the mine is standing still for a hint right now

  // Refuges and gas
  checkpoint: null,
  checkpointHint: -1,          // lessons: the hint whose appearing saved the checkpoint (−1: a refuge did)
  inRefuge: false,
  refugeCells: {},
  gasLevel: {},
  gasExposure: 0,
  playerOnGas: false,

  // Machines and moving tiles
  pumps: [],
  tbms: [],
  riding: null,
  ridingRoll: null,
  tileBounce: {},
  tileSlide: {},
  collectEffects: []
};

Game.state = GAME_STATE;

// Grab canvas - scripts load at end of <body> so DOM is ready
Game.state.canvas = document.getElementById("game");
Game.state.ctx = Game.state.canvas ? Game.state.canvas.getContext("2d") : null;
