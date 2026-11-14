"use strict";

// ═══════════════════════════════════════════════════════════════════
// Tutorials/_validate.js - schema + solvability checker for tutorial
// level JSONs. Usage: node Tutorials/_validate.js Tutorials/T01_x.json
// Exit code 0 = OK (warnings allowed), 1 = hard errors.
// ═══════════════════════════════════════════════════════════════════

var fs = require("fs");

var T = {
  EMPTY:0, EARTH:1, ROCK:2, BOULDER:3, PLAYER:4, EXIT:5, ELEMENT:6, WALL:7, HAZARD:8,
  EARTH_RICH:9, POWERUP:10, HIDDEN_ELEM:11, WATER:12, FUSE:13, WATER_SRC:14, KEY:15, DOOR:16,
  PAD:17, LOGIC_DOOR:18, WEB:19, CART:20, CART_BOUNCE:21, ROLL_BARREL:22, ICE:23, LAVA:24,
  LAVA_SRC:25, SPIDER_NEST:26, BASALT:27, SHAFT_LIFT:28, TBM:29, REFUGE:30, GAS:31, GAS_SRC:32
};

// scenario index -> { req: [9 required element keys], bonus: [5 bonus keys] }
var SCENARIOS = {
  0:  { req:["In","Sn","Ta","Ga","Li","Co","Nd","Au","Al"], bonus:["Pt","W","Ge","Y","Ag"] },
  1:  { req:["Cu","Au","Sn","Ag","Si","Ni","Pd","Br","Fe"], bonus:["Ta","Ga","In","Pt","Ge"] },
  2:  { req:["Nd","Dy","Pr","Cu","Co","Fe","Mn","Al","Ni"], bonus:["Y","Li","Si","Ti","W"] },
  3:  { req:["Si","Ga","In","Ag","Cu","Cd","Te","Sn","Al"], bonus:["Ge","Ni","Fe","P","Nd"] },
  4:  { req:["Nd","Dy","Cu","Fe","Mn","Mo","Cr","Ni","Zn"], bonus:["Pr","Co","Al","Si","Sn"] },
  5:  { req:["Nb","Ti","He","Gd","Cu","Fe","Sn","Al","Cr"], bonus:["Nd","Ag","Au","Ni","Si"] },
  6:  { req:["Ge","Ga","Ti","Al","Au","Si","Pt","Ir","Ta"], bonus:["Cu","Ag","Nd","In","W"] },
  7:  { req:["Li","Co","Ni","C","Cu","Al","Fe","Mn","P"], bonus:["Ga","Si","Sn","Ti","Ag"] },
  8:  { req:["Si","Ge","Er","Zr","F","Al","Sn","Fe","Cu"], bonus:["In","Ga","Au","Ag","Nd"] },
  9:  { req:["Nb","Al","Si","Au","He","Ti","Ta","Cu","In"], bonus:["Ge","Ga","Sn","Ag","Er"] },
  10: { req:["Ni","Co","Cr","Ti","Al","Mo","W","Nb","Ta"], bonus:["Re","Hf","Ir","Pt","Y"] },
  11: { req:["Ti","Zr","Nb","Ta","Co","Cr","Pt","Au","Fe"], bonus:["Mo","Pd","Si","Al","Cu"] },
  12: { req:["Pt","Pd","Ni","Fe","C","Ti","Au","Cr","Zr"], bonus:["Mo","Co","Cu","Al","Si"] },
  13: { req:["Ga","In","Ge","Si","Al","Cu","Zn","Cd","Eu"], bonus:["Au","Ag","Nd","Dy","Sn"] },
  14: { req:["Si","Al","Ge","Ti","Mo","Cr","Nb","Zr","Ni"], bonus:["Au","Be","Ir","Pt","W"] }
};

var ENEMY_KINDS = { bat:1, snake:1, crab:1, spider:1 };

var file = process.argv[2];
if (!file) { console.error("Usage: node Tutorials/_validate.js <level.json>"); process.exit(1); }

var errors = [], warnings = [];
function err(m) { errors.push(m); }
function warn(m) { warnings.push(m); }

var lvl;
try { lvl = JSON.parse(fs.readFileSync(file, "utf8")); }
catch (e) { console.error("PARSE ERROR: " + e.message); process.exit(1); }

var cols = lvl.cols, rows = lvl.rows, grid = lvl.grid;
if (typeof cols !== "number" || typeof rows !== "number") err("cols/rows must be numbers");
if (!Array.isArray(grid)) err("grid must be an array");
if (errors.length) { report(); }

if (grid.length !== cols * rows) err("grid length " + grid.length + " != cols*rows " + (cols * rows));

function at(x, y) { return grid[y * cols + x]; }
function inBounds(x, y) { return x >= 0 && x < cols && y >= 0 && y < rows; }
function interior(x, y) { return x > 0 && x < cols - 1 && y > 0 && y < rows - 1; }

// ── tile sanity ──
for (var i = 0; i < grid.length; i++) {
  var t = grid[i];
  if (typeof t !== "number" || t < 0 || t > 32 || t !== Math.floor(t)) {
    err("grid[" + i + "] invalid tile id: " + t);
  }
  if (t === T.PLAYER || t === T.EXIT || t === T.ELEMENT || t === T.POWERUP || t === T.HIDDEN_ELEM || t === T.PAD) {
    err("grid[" + i + "] (x=" + (i % cols) + ",y=" + Math.floor(i / cols) + ") uses raw tile " + t + " - place via player/exit/elements/powerups/hiddenElems/pads lists instead");
  }
}

// ── border must be solid WALL ──
for (var x = 0; x < cols; x++) {
  if (at(x, 0) !== T.WALL) err("border not WALL at (" + x + ",0)");
  if (at(x, rows - 1) !== T.WALL) err("border not WALL at (" + x + "," + (rows - 1) + ")");
}
for (var y = 0; y < rows; y++) {
  if (at(0, y) !== T.WALL) err("border not WALL at (0," + y + ")");
  if (at(cols - 1, y) !== T.WALL) err("border not WALL at (" + (cols - 1) + "," + y + ")");
}

// ── scenario / element keys ──
var scen = SCENARIOS[lvl.scenario !== undefined ? lvl.scenario : 0];
if (!scen && lvl.scenario !== 15) err("unknown scenario index: " + lvl.scenario);
var elements = lvl.elements || [];
var hiddenElems = lvl.hiddenElems || [];
if (!elements.length) err("level has no required elements - exit would open immediately");
// scenario 15 (Free Play) supports arbitrary element counts/keys from ALL_ELEMENTS
if (scen && elements.length > 9) err("more than 9 required elements");
elements.forEach(function(e, idx) {
  if (scen && scen.req.indexOf(e.key) < 0) err("elements[" + idx + "] key '" + e.key + "' not in scenario required set [" + scen.req + "]");
});
hiddenElems.forEach(function(e, idx) {
  if (scen && scen.bonus.indexOf(e.key) < 0) err("hiddenElems[" + idx + "] key '" + e.key + "' not in scenario bonus set [" + scen.bonus + "]");
});

// ── entity coordinate checks + overlap ──
var seen = {};
function checkEntity(name, e, idx) {
  if (!e || typeof e.x !== "number" || typeof e.y !== "number") { err(name + "[" + idx + "] missing numeric x/y"); return; }
  if (!inBounds(e.x, e.y)) { err(name + "[" + idx + "] out of bounds (" + e.x + "," + e.y + ")"); return; }
  if (!interior(e.x, e.y)) err(name + "[" + idx + "] on border (" + e.x + "," + e.y + ") - would punch a hole in the wall");
  var k = e.x + "," + e.y;
  if (seen[k]) err(name + "[" + idx + "] overlaps " + seen[k] + " at (" + e.x + "," + e.y + ")");
  seen[k] = name + "[" + idx + "]";
  var gt = at(e.x, e.y);
  if (gt === T.WALL || gt === T.ROCK) warn(name + "[" + idx + "] overwrites solid tile " + gt + " at (" + e.x + "," + e.y + ")");
}
if (!lvl.player) err("missing player start"); else checkEntity("player", lvl.player, 0);
if (!lvl.exit) err("missing exit"); else checkEntity("exit", lvl.exit, 0);
elements.forEach(function(e, i2) { checkEntity("elements", e, i2); });
hiddenElems.forEach(function(e, i2) { checkEntity("hiddenElems", e, i2); });
(lvl.powerups || []).forEach(function(p, i2) {
  checkEntity("powerups", p, i2);
  if ([0, 1, 2, 3, 4].indexOf(p.type) < 0) err("powerups[" + i2 + "] invalid type " + p.type);
});
(lvl.pads || []).forEach(function(p, i2) {
  checkEntity("pads", p, i2);
  if (!p.key) err("pads[" + i2 + "] missing key");
});

// ── quiz gates: several questions in one level, each with its own pads and doors ──
var gates = Array.isArray(lvl.gates) ? lvl.gates : [];
var gateOfDoor = {};
gates.forEach(function(g, gi) {
  var name = "gates[" + gi + "]";
  var gp = g.pads || [];
  if (!gp.length) err(name + " has no pads");
  gp.forEach(function(p, i2) {
    checkEntity(name + ".pads", p, i2);
    if (!p.key) err(name + ".pads[" + i2 + "] missing key");
  });
  if (!g.answer) err(name + " has no answer");
  else if (!gp.some(function(p) { return p.key === g.answer; })) err(name + ": no pad carries the answer '" + g.answer + "'");
  if (!g.question) warn(name + " has no question - the player won't know what to answer");
  if (!g.pos) warn(name + " has no pos - its question won't be written on the wall");
  else if (!inBounds(g.pos.x, g.pos.y)) err(name + ".pos out of bounds");
  if (!(g.doors || []).length) warn(name + " opens no door");
  (g.doors || []).forEach(function(d, i2) {
    if (!inBounds(d.x, d.y)) { err(name + ".doors[" + i2 + "] out of bounds"); return; }
    if (at(d.x, d.y) !== T.LOGIC_DOOR) err(name + ".doors[" + i2 + "] (" + d.x + "," + d.y + ") is not a LOGIC_DOOR tile in the grid");
    var k = d.x + "," + d.y;
    if (gateOfDoor[k] !== undefined) err(name + ".doors[" + i2 + "] is already claimed by gates[" + gateOfDoor[k] + "]");
    gateOfDoor[k] = gi;
  });
});

// ── enemies ──
(lvl.enemies || []).forEach(function(en, i2) {
  if (!ENEMY_KINDS[en.type]) err("enemies[" + i2 + "] unknown type '" + en.type + "'");
  if (!inBounds(en.x, en.y) || !interior(en.x, en.y)) { err("enemies[" + i2 + "] out of bounds/border"); return; }
  var gt = at(en.x, en.y);
  if (gt !== T.EMPTY && gt !== T.WEB) warn("enemies[" + i2 + "] (" + en.type + ") starts on non-empty tile " + gt + " at (" + en.x + "," + en.y + ")");
  if (lvl.player) {
    var d = Math.abs(en.x - lvl.player.x) + Math.abs(en.y - lvl.player.y);
    if (d < 8) warn("enemies[" + i2 + "] (" + en.type + ") only " + d + " tiles from player start - unfair for a tutorial");
  }
});

// ── trivia / logic doors ──
// logic doors that no gate claims belong to the level's single quiz
var hasLogicDoor = grid.some(function(tile, idx) { return tile === T.LOGIC_DOOR && gateOfDoor[(idx % cols) + "," + Math.floor(idx / cols)] === undefined; });
var pads = lvl.pads || [];
if (hasLogicDoor) {
  if (!pads.length) err("grid has LOGIC_DOOR but no pads");
  if (!lvl.triviaAnswer) err("grid has LOGIC_DOOR but no triviaAnswer");
  if (lvl.triviaAnswer && !pads.some(function(p) { return p.key === lvl.triviaAnswer; })) err("no pad carries the triviaAnswer key '" + lvl.triviaAnswer + "'");
  if (!lvl.triviaQuestion) warn("LOGIC_DOOR without triviaQuestion - player won't know what to answer");
  if (!lvl.triviaPos) warn("triviaQuestion has no triviaPos - question text won't render");
}
if (lvl.triviaTrap && !pads.some(function(p) { return p.key === lvl.triviaTrap; })) warn("triviaTrap '" + lvl.triviaTrap + "' matches no pad");

// ── hints ──
var hints = lvl.hints || [];
if (!hints.length) warn("no hints - tutorial levels should teach!");
hints.forEach(function(h, i2) {
  if (typeof h.x !== "number" || typeof h.y !== "number") err("hints[" + i2 + "] missing numeric x/y");
  else if (!inBounds(h.x, h.y)) err("hints[" + i2 + "] out of bounds");
  if (!h.text) err("hints[" + i2 + "] missing text");
  if (!h.title) warn("hints[" + i2 + "] missing title");
  if (h.r !== undefined && (h.r < 0 || h.r > 8)) warn("hints[" + i2 + "] radius " + h.r + " unusual");
});
if (lvl.player && !hints.some(function(h) {
  var r = h.r !== undefined ? h.r : 1;
  return Math.abs(h.x - lvl.player.x) <= r && Math.abs(h.y - lvl.player.y) <= r;
})) warn("no hint fires at the player spawn - consider a welcome hint");

// ── springs and lava veins that flow before anyone digs ──
// The engine floods any EMPTY cell below or beside a WATER_SRC or LAVA_SRC, dug or not, and the
// flood runs on downwards and sideways. A small lava pit is a fair thing to show; lava that fills
// a chamber, or reaches the start or the exit, can close the level before the miner gets there.
var LAVA_PIT_MAX = 6;
function openAt(x, y) {
  var k = x + "," + y;
  return interior(x, y) && at(x, y) === T.EMPTY && (!seen[k] || seen[k].indexOf("player") === 0);
}
function floodFrom(sx, sy) {
  var cells = [], done = {}, queue = [[sx, sy]];
  while (queue.length) {
    var c = queue.shift();
    [[0, 1], [-1, 0], [1, 0]].forEach(function(d) {
      var x = c[0] + d[0], y = c[1] + d[1], k = x + "," + y;
      if (done[k] || !openAt(x, y)) return;
      done[k] = true; cells.push({ x: x, y: y }); queue.push([x, y]);
    });
  }
  return cells;
}
for (var sy = 1; sy < rows - 1; sy++) for (var sx = 1; sx < cols - 1; sx++) {
  var st = at(sx, sy);
  if (st !== T.WATER_SRC && st !== T.LAVA_SRC) continue;
  var flood = floodFrom(sx, sy);
  if (!flood.length) continue;
  if (st === T.WATER_SRC) { warn("spring at (" + sx + "," + sy + ") has an open cell below or beside it - it floods " + flood.length + " cells from the start"); continue; }
  var onStart = lvl.player && flood.some(function(c) { return c.x === lvl.player.x && c.y === lvl.player.y; });
  if (onStart || flood.length > LAVA_PIT_MAX) err("lava vein at (" + sx + "," + sy + ") floods " + flood.length + " open cells from the start" + (onStart ? ", the miner's among them" : ""));
  else warn("lava vein at (" + sx + "," + sy + ") fills a pit of " + flood.length + " cell(s) from the start - keep the way to the exit clear of it");
}

// ── timer ──
if (!lvl.timer) warn("no timer set - default formula applies");
else if (lvl.timer < 120) warn("timer " + lvl.timer + "s is tight for a tutorial");

// ── reachability (BFS with door fixpoint) ──
// Build effective grid: entity lists overwrite; carts(21)/lifts(28) become EMPTY at load.
var eff = [];
var tbmMarkers = [];
for (var gy = 0; gy < rows; gy++) {
  eff[gy] = [];
  for (var gx = 0; gx < cols; gx++) {
    var tt = at(gx, gy);
    if (tt === T.TBM) { tbmMarkers.push({ x: gx, y: gy }); tt = T.EMPTY; }
    if (tt === T.CART_BOUNCE || tt === T.SHAFT_LIFT) tt = T.EMPTY;
    eff[gy][gx] = tt;
  }
}
// TBM starting footprints (3x2 from marker) are force-cleared at load
tbmMarkers.forEach(function(m) {
  for (var fy = m.y; fy <= Math.min(m.y + 1, rows - 1); fy++)
    for (var fx = m.x; fx <= Math.min(m.x + 2, cols - 1); fx++)
      if (eff[fy][fx] !== T.WALL) eff[fy][fx] = T.EMPTY;
  if (lvl.player && Math.abs(m.x - lvl.player.x) + Math.abs(m.y - lvl.player.y) < 7) {
    warn("TBM at (" + m.x + "," + m.y + ") starts close to the player spawn");
  }
  if (m.y + 1 >= rows - 1 || m.x + 2 >= cols - 1) err("TBM at (" + m.x + "," + m.y + ") footprint reaches the border");
});

// Refuge chambers: expand 3×3 (marker top-left): corner posts solid, floor safe+walkable
var refugeMarkers = [];
for (var rgy = 0; rgy < rows; rgy++) for (var rgx = 0; rgx < cols; rgx++)
  if (eff[rgy][rgx] === T.REFUGE) refugeMarkers.push({ x: rgx, y: rgy });
refugeMarkers.forEach(function(m) {
  if (m.y + 2 >= rows - 1 + 1 || m.x + 2 >= cols - 1 + 1) warn("Refuge at (" + m.x + "," + m.y + ") footprint touches the border");
  for (var fy = m.y; fy <= Math.min(m.y + 2, rows - 1); fy++)
    for (var fx = m.x; fx <= Math.min(m.x + 2, cols - 1); fx++) {
      if (eff[fy][fx] === T.WALL) continue;
      var isPost = (fy === m.y || fy === m.y + 2) && (fx === m.x || fx === m.x + 2);
      eff[fy][fx] = isPost ? T.WALL : T.REFUGE;
    }
});
elements.forEach(function(e) { eff[e.y][e.x] = T.ELEMENT; });
hiddenElems.forEach(function(e) { eff[e.y][e.x] = T.HIDDEN_ELEM; });
(lvl.powerups || []).forEach(function(p) { eff[p.y][p.x] = T.POWERUP; });
pads.forEach(function(p) { eff[p.y][p.x] = T.PAD; });
gates.forEach(function(g) { (g.pads || []).forEach(function(p) { if (inBounds(p.x, p.y)) eff[p.y][p.x] = T.PAD; }); });
if (lvl.exit) eff[lvl.exit.y][lvl.exit.x] = T.EXIT;

// TBM lanes: every column a boring machine can eventually drill (it grinds anything
// except WALL/DOOR/LOGIC_DOOR/EXIT/PAD) becomes open tunnel over time - treat those
// cells as passable in SOFT mode.
var tbmLane = [];
for (var ly = 0; ly < rows; ly++) tbmLane[ly] = [];
tbmMarkers.forEach(function(m) {
  [1, -1].forEach(function(dir) {
    var cx = dir > 0 ? m.x + 3 : m.x - 1;
    while (cx > 0 && cx < cols - 1) {
      var stop = false;
      for (var r = m.y; r <= m.y + 1; r++) {
        var t = eff[r][cx];
        if (t === T.WALL || t === T.DOOR || t === T.LOGIC_DOOR || t === T.EXIT || t === T.PAD || t === T.REFUGE || t === T.REFUGE_POST) { stop = true; break; }
      }
      if (stop) break;
      tbmLane[m.y][cx] = true;
      tbmLane[m.y + 1][cx] = true;
      cx += dir;
    }
    // the starting footprint itself is open lane
    for (var fx = m.x; fx <= m.x + 2; fx++) { tbmLane[m.y][fx] = true; tbmLane[m.y + 1][fx] = true; }
  });
});

// PAD tiles always block movement (you bump them); stepping-on is via bump, so treat
// pads as REACHABLE if any passable tile is 4-adjacent to them.
function bfs(passFn) {
  var vis = [], q = [[lvl.player.x, lvl.player.y]];
  for (var vy = 0; vy < rows; vy++) { vis[vy] = []; }
  vis[lvl.player.y][lvl.player.x] = true;
  while (q.length) {
    var cur = q.shift(), cx = cur[0], cy = cur[1];
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function(d) {
      var nx2 = cx + d[0], ny2 = cy + d[1];
      if (!inBounds(nx2, ny2) || vis[ny2][nx2]) return;
      if (!passFn(eff[ny2][nx2], nx2, ny2)) return;
      vis[ny2][nx2] = true;
      q.push([nx2, ny2]);
    });
  }
  return vis;
}

function runSolver(soft) {
  // soft=true: dynamite-clearable / pushable obstacles count as passable
  var doorsOpen = false, logicOpen = false, changed = true, vis = null;
  var gateOpen = gates.map(function() { return false; });
  function padTouched(p) {
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function(d) {
      var ax = p.x + d[0], ay = p.y + d[1];
      return inBounds(ax, ay) && vis[ay][ax];
    });
  }
  while (changed) {
    changed = false;
    vis = bfs(function(tt2, lx2, ly2) {
      if (soft && tbmLane[ly2] && tbmLane[ly2][lx2]) return true;
      switch (tt2) {
        case T.EMPTY: case T.EARTH: case T.EARTH_RICH: case T.WATER: case T.WATER_SRC:
        case T.FUSE: case T.WEB: case T.KEY: case T.ELEMENT: case T.HIDDEN_ELEM:
        case T.POWERUP: case T.EXIT: case T.REFUGE:
          return true;
        case T.GAS:
          return soft; // crossable briefly / with a mask
        case T.DOOR: return doorsOpen;
        case T.LOGIC_DOOR:
          var gi2 = gateOfDoor[lx2 + "," + ly2];
          return gi2 === undefined ? logicOpen : gateOpen[gi2];
        case T.BOULDER: case T.HAZARD: case T.ICE: case T.BASALT: case T.SPIDER_NEST:
        case T.CART: case T.ROLL_BARREL:
          return soft;
        default: return false; // WALL, ROCK, LAVA, LAVA_SRC, PAD, PLAYER
      }
    });
    if (!doorsOpen) {
      for (var ky = 0; ky < rows && !doorsOpen; ky++) {
        for (var kx = 0; kx < cols && !doorsOpen; kx++) {
          if (eff[ky][kx] === T.KEY && vis[ky][kx]) { doorsOpen = true; changed = true; }
        }
      }
    }
    gates.forEach(function(g, gi) {
      if (gateOpen[gi]) return;
      if ((g.pads || []).some(function(p) { return p.key === g.answer && padTouched(p); })) { gateOpen[gi] = true; changed = true; }
    });
    if (!logicOpen && lvl.triviaAnswer) {
      pads.forEach(function(p) {
        if (p.key !== lvl.triviaAnswer || logicOpen) return;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function(d) {
          var ax = p.x + d[0], ay = p.y + d[1];
          if (inBounds(ax, ay) && vis[ay][ax]) { logicOpen = true; changed = true; }
        });
      });
    }
  }
  return vis;
}

if (lvl.player && lvl.exit && !errors.length) {
  var visSoft = runSolver(true);
  var visStrict = runSolver(false);

  function checkTarget(label, tx, ty) {
    if (!visSoft[ty][tx]) err(label + " at (" + tx + "," + ty + ") UNREACHABLE even if all boulders/ice/barrels/nests/basalt were cleared");
    else if (!visStrict[ty][tx]) warn(label + " at (" + tx + "," + ty + ") only reachable by clearing an obstacle (boulder push / dynamite / basalt crumble) - verify the player has the means");
  }
  checkTarget("exit", lvl.exit.x, lvl.exit.y);
  elements.forEach(function(e, i3) { checkTarget("elements[" + i3 + "] (" + e.key + ")", e.x, e.y); });
  hiddenElems.forEach(function(e, i3) { checkTarget("hiddenElems[" + i3 + "] (" + e.key + ")", e.x, e.y); });
  (lvl.powerups || []).forEach(function(p, i3) { checkTarget("powerups[" + i3 + "]", p.x, p.y); });
  gates.forEach(function(g, gi) {
    var ok = (g.pads || []).some(function(p) {
      return p.key === g.answer && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function(d) {
        var ax = p.x + d[0], ay = p.y + d[1];
        return inBounds(ax, ay) && visSoft[ay][ax];
      });
    });
    if (!ok) err("gates[" + gi + "]: the pad with the answer cannot be reached");
  });

  // element families: every member must be in the level
  var have = {};
  elements.concat(hiddenElems).forEach(function(e) { have[e.key] = true; });
  (lvl.families || []).forEach(function(f, fi) {
    if (!f.name) err("families[" + fi + "] has no name");
    if (!(f.keys || []).length) err("families[" + fi + "] has no elements");
    (f.keys || []).forEach(function(k) { if (!have[k]) err("families[" + fi + "] (" + f.name + ") lists '" + k + "', which is not in the level"); });
  });

  // keys vs doors count
  var doorCount = 0, keyCount = 0;
  for (var dy2 = 0; dy2 < rows; dy2++) {
    for (var dx2 = 0; dx2 < cols; dx2++) {
      if (eff[dy2][dx2] === T.DOOR) doorCount++;
      if (eff[dy2][dx2] === T.KEY) keyCount++;
    }
  }
  if (doorCount > keyCount) warn(doorCount + " doors but only " + keyCount + " keys");
}

report();

function report() {
  console.log("── " + file + " ──");
  warnings.forEach(function(w) { console.log("  WARN: " + w); });
  errors.forEach(function(e) { console.log("  ERROR: " + e); });
  if (!errors.length) { console.log("  OK (" + warnings.length + " warnings)"); process.exit(0); }
  console.log("  FAILED: " + errors.length + " errors");
  process.exit(1);
}
