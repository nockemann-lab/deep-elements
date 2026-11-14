"use strict";

// ═══════════════════════════════════════════════════════════════════
// config.js - Game namespace, constants, tile types, enemy definitions
// ═══════════════════════════════════════════════════════════════════

window.Game = /** @type {GameNamespace} */ ({});

// ─── Tile Types ───
// (frozen: the numbers are stored in level files, and a misspelt name is then
// reported by the type checker instead of quietly reading as undefined)
var T = Object.freeze({
  EMPTY:0, EARTH:1, ROCK:2, BOULDER:3, PLAYER:4, EXIT:5, ELEMENT:6, WALL:7, HAZARD:8,
  EARTH_RICH:9, POWERUP:10, HIDDEN_ELEM:11, WATER:12, FUSE:13, WATER_SRC:14, KEY:15, DOOR:16,
  PAD:17, LOGIC_DOOR:18, WEB:19, CART:20, CART_BOUNCE:21, ROLL_BARREL:22, ICE:23, LAVA:24, LAVA_SRC:25, SPIDER_NEST:26, BASALT:27, SHAFT_LIFT:28, TBM:29,
  REFUGE:30, GAS:31, GAS_SRC:32, REFUGE_POST:33
});

// ─── Power-up Types ───
var PU = Object.freeze({ DYNAMITE:0, LAMP:1, GEIGER:2, MASK:3, PUMP:4 });

var PU_INFO = [
  { id:0, name:"Dynamite", icon:"\ud83e\udde8", desc:"Place it and run: every step and every second burns the fuse, five in all. The noise draws creatures", color:"#e85454" },
  { id:1, name:"Helmet Lamp", icon:"\ud83d\udd26", desc:"See twice as far for 12 seconds", color:"#e8b84b" },
  { id:2, name:"Geiger Counter", icon:"\ud83d\udcf2", desc:"Shows hidden bonus elements for 15 seconds", color:"#4ae8d4" },
  { id:3, name:"Gas Mask", icon:"\ud83e\udd3f", desc:"Breathe safely in gas for 20 seconds", color:"#7ae87a" },
  { id:4, name:"Water Pump", icon:"\ud83d\udeb0", desc:"Stand beside a flood: drains it and caps its springs", color:"#4a9ee8" }
];

// ─── AI States ───
var AI_IDLE = 0, AI_PATROL = 1, AI_ALERT = 2, AI_CHASE = 3, AI_SEARCH = 4;
// How far away (in steps, not through the air) a spider feels a tremor: breaking ground,
// a blast or the borer, and the much smaller one of picking something up off the floor
var TREMOR_RADIUS = 15, PICKUP_TREMOR_RADIUS = 5;

// ─── Enemy Type Definitions ───
var ENEMY_TYPES = {
  bat:{ name:"Cave Bat", canFly:true, eatsEarth:false, detectRadius:5, losRange:10, chaseMemory:8, patrolSpeed:3, chaseSpeed:1,
    deathMsg:'A <strong style="color:var(--purple)">cave bat</strong> got you! These creatures thrive in dark tunnels - just like real bats that roost in abandoned mine tunnels.' },
  snake:{ name:"Mine Snake", canFly:false, eatsEarth:false, detectRadius:3, losRange:3, chaseMemory:2, patrolSpeed:4, chaseSpeed:1,
    deathMsg:'A <strong style="color:var(--green)">mine snake</strong> bit you! Venomous snakes are a real hazard in open-pit mines.' },
  crab:{ name:"Crystal Crab", canFly:false, eatsEarth:true, detectRadius:3, losRange:6, chaseMemory:5, patrolSpeed:10, chaseSpeed:6,
    deathMsg:'A <strong style="color:var(--cyan)">crystal crab</strong> snipped you! They are very slow, but a falling boulder just bounces off the armoured shell.' },
  spider:{ name:"Cave Spider", canFly:false, eatsEarth:false, isSpider:true, detectRadius:0, losRange:0, chaseMemory:15, patrolSpeed:4, chaseSpeed:2,
    deathMsg:'A <strong style="color:var(--red)">cave spider</strong> bit you! These blind predators hunt entirely by sensing vibrations in the ground.' }
};

// ─── Ways to die ───
// icon + label head the death card; label is also the banner over the death
// animation, whose particles take the colour; text is the card's explanation.
var DEATH_CAUSES = {
  lava: { icon: '\ud83c\udf0b', label: 'MOLTEN LAVA!', color: "#ffffff",
    text: 'You walked into <strong style="color:#ff4400">molten lava</strong>! Even miners know to keep clear of volcanic hazards.' },
  toxic: { icon: '\u2620\ufe0f', label: 'TOXIC BARREL!', color: "#4ae87a",
    text: 'A <strong style="color:var(--green)">toxic barrel</strong> exploded on you! Keep your distance from hazardous waste.' },
  bat: { icon: '\ud83e\udd87', label: 'BAT ATTACK!', color: "#9a6ee8",
    text: ENEMY_TYPES.bat.deathMsg },
  snake: { icon: '\ud83d\udc0d', label: 'SNAKE BITE!', color: "#4ae87a",
    text: ENEMY_TYPES.snake.deathMsg },
  spider: { icon: '\ud83d\udd77\ufe0f', label: 'SPIDER BITE!', color: "#e85454",
    text: ENEMY_TYPES.spider.deathMsg },
  crab: { icon: '\ud83e\udd80', label: 'CRAB PINCH!', color: "#4ae8d4",
    text: ENEMY_TYPES.crab.deathMsg },
  time: { icon: "\u23f1\ufe0f", label: "TIME'S UP!", color: "#e8b84b",
    text: 'The mine shaft is collapsing! Plan a faster route next time.' },
  dynamite: { icon: '\ud83e\udde8', label: 'OWN DYNAMITE!', color: "#e8944b",
    text: 'You were caught in your own dynamite blast! Always give yourself enough room to escape.' },
  cart_bounce: { icon: '\ud83d\udca5', label: 'ROGUE CART!', color: "#8a3a3a",
    text: 'You were run over by a rogue minecart! Look both ways before crossing the tracks.' },
  shaft_lift: { icon: '\ud83d\ude97', label: 'SHAFT LIFT!', color: "#708090",
    text: 'A mining shaft lift crushed you on its vertical run! Stay clear of moving lift cages.' },
  tbm: { icon: '\ud83d\udea7', label: 'TUNNEL BORER!', color: "#ffffff",
    text: 'You were caught by the <strong style="color:var(--gold)">tunnel boring machine</strong>! Real TBMs are building-sized monsters that grind through solid rock - follow <em>behind</em> the cutter head, never stand in front of it.' },
  gas: { icon: '\u2601\ufe0f', label: 'GASSED!', color: "#ffffff",
    text: 'You breathed too much <strong style="color:var(--green)">mine gas</strong>! Suffocating and invisible pockets of gas were the miner\'s quiet killer - that\'s why they carried canaries. Grab a gas mask, or keep to clean air.' },
  gasblast: { icon: '\ud83d\udd25', label: 'FIREDAMP!', color: "#ffffff",
    text: 'The explosion ignited the <strong style="color:var(--green)">gas cloud</strong>! Firedamp blasts were the deadliest accidents in coal-mining history - never bring a flame (or dynamite) near gas.' },
  boulder: { icon: '\ud83d\udca5', label: 'MINE COLLAPSE!', color: "#7a7a8a",
    text: 'A <strong>boulder</strong> fell on you! Mining is dangerous work.' }
};

// ─── Level Sizes ───
var LEVEL_SIZES = [
  { cols:20, rows:15, name:"Standard" }, { cols:25, rows:15, name:"Wide" },
  { cols:20, rows:20, name:"Deep" }, { cols:30, rows:20, name:"Large" }, { cols:35, rows:25, name:"Massive" }
];

// Endless Depths: the depth at which a generated mine reaches its full
// density of tunnels, boulders, barrels and water (see generateRandom).
var ENDLESS_DENSITY_DEPTH = 20;

// Endless Depths: how many creatures a generated mine may hold. Each kind
// grows quickly to its first cap (21 creatures in all, from depth 6). Below
// ENDLESS_RAMP_FROM the cap itself rises by one every `every` depths until
// `deep`. The first extra bat arrives at depth 14, just as the clock reaches
// its 50 s floor, and the last creatures at depth 28 (32 in all) - a little
// under one more creature per depth, so the mines keep getting more crowded
// after the clock and the sight radius have stopped shrinking.
var ENDLESS_RAMP_FROM = 9;   // 0-based depth index: the tenth mine
var ENDLESS_CREATURES = {
  bat:    { cap: 8, every: 4, deep: 12 },
  snake:  { cap: 6, every: 6, deep: 9 },
  crab:   { cap: 4, every: 9, deep: 6 },
  spider: { cap: 3, every: 9, deep: 5 },
  nest:   { cap: 3, every: 9, deep: 5 }
};

// ─── Vision Constants ───
// BASE_SIGHT is the default sight radius; levels may override via their
// "sight" field (hard missions use 5). The lamp doubles the active radius.
var BASE_SIGHT = 8.4;

// Gravity tick: ms per one-tile fall of boulders/barrels. Must stay above the
// player's moveRepeatMs (90) so a fleeing player can outrun a falling rock.
var GRAVITY_TICK_MS = 115;

// ─── Difficulty ───
// Enemy tick speed and detection range scale with s.difficulty (0 = gentlest,
// 7 = fastest). Endless uses the depth, tutorials their lesson number; other
// levels use their "difficulty" field, else the world map's easy/medium/hard
// label (see resolveDifficulty in game.js).
var DIFFICULTY_MAX = 7;
var DIFFICULTY_BY_LABEL = { easy: 1, medium: 4, hard: 7 };

// ─── Reading time ───
// Collecting an element for the first time in a sitting (it is new to the field
// notebook, which starts empty each time the game is opened) holds the level clock for this many seconds so the fact card can
// be read for free. Only the clock stops - the mine keeps moving.
var READ_FREEZE_SECONDS = 8;

// In a lesson the whole mine waits while a hint is read: after a hint appears,
// nothing moves for as long as the miner stands still, up to the time the text
// takes to read (HINT_READ_BASE_MS plus HINT_READ_MS_PER_WORD for each word).
// The card of a newly found element holds it the same way, for READ_FREEZE_SECONDS.
// A miner who keeps walking notices nothing: the mine only stops once they have
// stood still for HINT_IDLE_MS. The first step after such a wait ends it, unless
// it comes within HINT_MIN_HOLD_MS of the hint (a key still held down, a step
// taken before the banner was noticed); using a tool always ends it. Missions,
// runs and shared levels are never held.
var HINT_READ_BASE_MS = 2000, HINT_READ_MS_PER_WORD = 350;
var HINT_IDLE_MS = 400, HINT_MIN_HOLD_MS = 2500;
// A hint banner stays at least this long, and longer when its text needs it
var HINT_SHOW_MS = 14000, HINT_SHOW_AFTER_READ_MS = 5000;

// ─── Quiz ───
// Stepping on a wrong answer pad costs this many seconds of the level clock.
// 30 s is about a seventh of a mission clock: one wrong guess usually costs a
// star, and guessing through every pad costs the level's margin.
var QUIZ_PENALTY_SECONDS = 30;
// Score for completing a whole element family in an Element Run (the time
// it gives back is set per family in the level file)
var FAMILY_SCORE = 250;

// ─── Viewport Constants ───
var VP_COLS = 20, VP_ROWS = 15;

// ─── Star Thresholds: share of the level's timer still left at the exit ───
// 3 stars / 2 stars; finishing at all earns 1. Proportional, so every level
// is judged against its own timer regardless of mode or map position.
var STAR_TIME_FRACTIONS = [0.35, 0.15];

// ─── Shared Utility: tile-relative scaling ───
function S(v) { return Math.round(v * Game.state.tile / 32); }

// ─── Shared Utility: hex color to "r,g,b" string ───
function hexRgb(h) {
  if (h.length === 4) h = "#" + h[1]+h[1] + h[2]+h[2] + h[3]+h[3];
  return parseInt(h.slice(1,3),16) + "," + parseInt(h.slice(3,5),16) + "," + parseInt(h.slice(5,7),16);
}
