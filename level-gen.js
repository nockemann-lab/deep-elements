"use strict";

// ═══════════════════════════════════════════════════════════════════
// level-gen.js - Scenario loading, procedural & custom level generation
// ═══════════════════════════════════════════════════════════════════

(function() {
  var s = Game.state;

  Game.levelGen = {

    loadScenario: function(levelNum) {
      var sc = SCENARIOS[levelNum % SCENARIOS.length];
      s.scenario = sc;
      s.elements = {}; s.elementKeys = sc.elements.slice();
      for (var i = 0; i < sc.elements.length; i++) {
        var key = sc.elements[i], el = ALL_ELEMENTS[key];
        s.elements[key] = { symbol:el.symbol, name:el.name, z:el.z, color:el.color, body:el.body, fun:el.fun, risk:el.risk, riskLabel:el.riskLabel, component:sc.elemComp[key] };
      }
      s.compOrder = sc.compOrder.slice();
      s.components = {};
      for (var k in sc.comps) s.components[k] = { need:sc.comps[k].need, have:0 };
      s.bonusElements = {}; s.bonusKeys = sc.bonus.slice();
      for (var j = 0; j < sc.bonus.length; j++) {
        var bk = sc.bonus[j]; if (ALL_ELEMENTS[bk]) s.bonusElements[bk] = ALL_ELEMENTS[bk];
      }
      var tracker = document.getElementById("comp-tracker");
      var title = document.getElementById("comp-tracker-title");
      if (title) title.innerHTML = sc.icon + " " + sc.name.toUpperCase();
      if (tracker) {
        tracker.className = "phone-tracker";
        tracker.innerHTML = "";
        var oldProg = document.getElementById("pt-progress-text");
        if (oldProg) oldProg.remove();
        var oldReset = document.getElementById("pt-reset-btn");
        if (oldReset) oldReset.remove();
        for (var ci = 0; ci < sc.compOrder.length; ci++) {
          var ck = sc.compOrder[ci], cd = sc.comps[ck];
          tracker.innerHTML += '<div class="component-slot" id="slot-' + ck + '"><span class="icon">' + cd.icon + '</span><div class="info"><span class="cname">' + cd.label + '</span><span class="cprog" id="prog-' + ck + '">0/' + cd.need + '</span></div></div>';
        }
      }
    },

    // ─── Endless Depths: abundance-weighted element selection ───
    loadEndless: function() {
      // Build weighted pool from collectible elements (exclude synthetics)
      var pool = [], sym;
      var undiscoveredMult = s.pushingLuck ? Math.min(1.5 + s.luckStreak * 1.0, 5.5) : 1.5;
      for (sym in ELEMENT_ABUNDANCE) {
        if (SYNTHETIC_ELEMENTS[sym]) continue;
        var weight = ELEMENT_ABUNDANCE[sym];
        // Bias toward undiscovered elements - stronger when pushing luck
        if (!s.ptDiscovered[sym]) weight = Math.ceil(weight * undiscoveredMult);
        pool.push({ sym: sym, weight: weight });
      }

      function weightedPick(arr) {
        var total = 0, i;
        for (i = 0; i < arr.length; i++) total += arr[i].weight;
        var r = Math.random() * total;
        for (i = 0; i < arr.length; i++) { r -= arr[i].weight; if (r <= 0) return i; }
        return arr.length - 1;
      }

      // Pick 9 required elements
      var picks = [], remaining = pool.slice();
      for (var i = 0; i < 9 && remaining.length > 0; i++) {
        var idx = weightedPick(remaining);
        picks.push(remaining[idx].sym);
        remaining.splice(idx, 1);
      }

      // Pick 3-5 bonus elements from what's left
      var bonusCount = 3 + Math.floor(Math.random() * 3);
      var bonusPicks = [];
      for (var j = 0; j < bonusCount && remaining.length > 0; j++) {
        var bidx = weightedPick(remaining);
        bonusPicks.push(remaining[bidx].sym);
        remaining.splice(bidx, 1);
      }

      // Set up scenario-like state (no component tracking)
      s.scenario = { name: "Endless Depths", icon: "\u26cf\ufe0f", desc: "Explore the endless mines!", winMsg: "Another depth conquered! Your periodic table grows\u2026", elements: picks, bonus: bonusPicks };
      s.elements = {}; s.elementKeys = picks.slice();
      for (var ei = 0; ei < picks.length; ei++) {
        var key = picks[ei], el = ALL_ELEMENTS[key];
        s.elements[key] = { symbol: el.symbol, name: el.name, z: el.z, color: el.color, body: el.body, fun: el.fun, risk: el.risk, riskLabel: el.riskLabel };
      }
      s.compOrder = []; s.components = {};
      s.bonusElements = {}; s.bonusKeys = bonusPicks.slice();
      for (var bi = 0; bi < bonusPicks.length; bi++) {
        var bk = bonusPicks[bi]; if (ALL_ELEMENTS[bk]) s.bonusElements[bk] = ALL_ELEMENTS[bk];
      }

      // Build periodic table UI
      Game.ui.renderPeriodicTable();
    },

    generateRandom: function(lv) {
      var sizeIdx = Math.min(Math.floor(lv / 2), LEVEL_SIZES.length - 1);
      var sz = LEVEL_SIZES[sizeIdx];
      s.cols = sz.cols; s.rows = sz.rows;
      Game.camera.resize(true);

      if (s.mode === "random") Game.levelGen.loadEndless(lv);
      else Game.levelGen.loadScenario(lv);
      s.levelName = "";
      s.grid = []; s.elementMap = {}; s.hiddenElementMap = {}; s.powerupMap = {}; s.collected = []; s.moves = 0;
      s.enemies = []; s.crushEffects = []; s.explosionEffects = []; s.enemiesKilled = 0;
      s.explored = []; s.seenTile = [];
      s.bouncingCarts = []; s.shaftLifts = []; s.rollingCarts = [];
      // a generated mine has no quiz door: drop what the last mission left behind
      s.triviaMap = {}; s.triviaQuestion = ""; s.triviaAnswer = ""; s.triviaTrap = ""; s.triviaPos = null;
      s.gates = []; s.padGate = {}; s.gateDoorCells = {}; s.families = []; s.familiesDone = {}; s.runInfo = null;
      for (var y = 0; y < s.rows; y++) { s.explored[y] = []; s.seenTile[y] = []; for (var x = 0; x < s.cols; x++) { s.explored[y][x] = false; s.seenTile[y][x] = T.EARTH; } }
      s.comboCount = 0; s.comboMultiplier = 1; s.lastComponentCompleted = -1;
      s.activeEffects = { lamp:0, geiger:0, mask:0 }; s.playerOnWater = false; s.playerOnGas = false; s.gasLevel = {}; s.pumps = []; s.gasExposure = 0; s.inRefuge = false; s.waterSlowToggle = false; s.waterLevel = {}; s.lavaLevel = {}; s.basaltLife = {}; s.fallingBoulders = {}; s.hazardFalling = {}; s.rollingBarrelFalling = {}; s.tileSlide = {}; s.rollingBarrels = [];
      for (var k in s.components) s.components[k].have = 0;
      for (var y = 0; y < s.rows; y++) { s.grid[y] = []; for (var x = 0; x < s.cols; x++) s.grid[y][x] = (x === 0 || x === s.cols - 1 || y === 0 || y === s.rows - 1) ? T.WALL : T.EARTH; }

      var R = function(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; };
      var area = s.cols * s.rows, areaScale = area / 300;
      // Past this depth the mine stops getting denser. Tunnels, boulders and
      // barrels all grow with depth, and uncapped they leave no earth to hold
      // the nine elements. Sight and the clock already bottom out before it.
      var dv = Math.min(lv, ENDLESS_DENSITY_DEPTH);

      // Rich earth
      for (var i = 0; i < Math.floor((15 + dv * 5) * areaScale); i++) { var rx = R(1, s.cols - 2), ry = R(1, s.rows - 2); if (s.grid[ry][rx] === T.EARTH) s.grid[ry][rx] = T.EARTH_RICH; }
      // Tunnels
      for (var i = 0; i < Math.floor((4 + dv * 2) * areaScale); i++) { var tx = R(3, s.cols - 4), ty = R(3, s.rows - 4), d = R(0, 1), ln = R(3, Math.floor(8 * Math.sqrt(areaScale))); for (var j = 0; j < ln; j++) { if (tx > 0 && tx < s.cols - 1 && ty > 0 && ty < s.rows - 1) s.grid[ty][tx] = T.EMPTY; if (d === 0) tx++; else ty++; } }
      // Chambers
      for (var i = 0; i < Math.floor((1 + dv) * areaScale); i++) { var cx = R(5, s.cols - 6), cy = R(4, s.rows - 5), w = R(2, 3), h = R(2, 3); for (var dy = 0; dy < h; dy++) for (var dx = 0; dx < w; dx++) { var nx = cx + dx, ny = cy + dy; if (nx > 0 && nx < s.cols - 1 && ny > 0 && ny < s.rows - 1) s.grid[ny][nx] = T.EMPTY; } }
      // Boulders
      for (var i = 0; i < Math.floor((18 + dv * 6) * areaScale); i++) { var bx = R(2, s.cols - 3), by = R(2, s.rows - 3); if (s.grid[by][bx] === T.EARTH || s.grid[by][bx] === T.EARTH_RICH) s.grid[by][bx] = T.BOULDER; }
      // Rocks
      for (var i = 0; i < Math.floor((6 + dv * 3) * areaScale); i++) { var rx2 = R(2, s.cols - 3), ry2 = R(2, s.rows - 3); if (s.grid[ry2][rx2] === T.EARTH || s.grid[ry2][rx2] === T.EARTH_RICH) s.grid[ry2][rx2] = T.ROCK; }
      // Toxic barrels
      if (lv > 0) { for (var i = 0; i < Math.floor((2 + dv) * areaScale); i++) { var hx = R(2, s.cols - 3), hy = R(2, s.rows - 3); if (s.grid[hy][hx] === T.EARTH || s.grid[hy][hx] === T.EARTH_RICH) s.grid[hy][hx] = T.HAZARD; } }
      // Rolling toxic barrels
      if (lv > 1) { for (var i = 0; i < Math.floor((1 + Math.floor(dv / 2)) * areaScale); i++) { var rbx = R(2, s.cols - 3), rby = R(2, s.rows - 3); if (s.grid[rby][rbx] === T.EARTH || s.grid[rby][rbx] === T.EARTH_RICH) s.grid[rby][rbx] = T.ROLL_BARREL; } }
      // Water sources
      var waterCount = R(2, Math.floor((3 + dv) * areaScale));
      for (var i = 0; i < waterCount; i++) { var wx = R(3, s.cols - 4), wy = R(3, s.rows - 4); if (s.grid[wy][wx] === T.EARTH || s.grid[wy][wx] === T.EARTH_RICH) s.grid[wy][wx] = T.WATER_SRC; }

      // Elements
      var elems = s.elementKeys.slice();
      for (var i = elems.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = elems[i]; elems[i] = elems[j]; elems[j] = t; }
      // Every element has to land or the depth cannot be finished: try earth at
      // random first, then any earth left, then a boulder or rock, then open floor.
      var seatFor = function() {
        for (var att = 0; att < 200; att++) { var ex = R(2, s.cols - 3), ey = R(2, s.rows - 3); if (s.grid[ey][ex] === T.EARTH || s.grid[ey][ex] === T.EARTH_RICH) return { x: ex, y: ey }; }
        var tiers = [
          function(t) { return t === T.EARTH || t === T.EARTH_RICH; },
          function(t) { return t === T.BOULDER || t === T.ROCK; },
          function(t) { return t === T.EMPTY; }
        ];
        for (var ti = 0; ti < tiers.length; ti++) {
          var open = [];
          for (var sy = 2; sy <= s.rows - 3; sy++) for (var sx = 2; sx <= s.cols - 3; sx++) if (tiers[ti](s.grid[sy][sx])) open.push({ x: sx, y: sy });
          if (open.length) return open[R(0, open.length - 1)];
        }
        return null;
      };
      for (var ei = 0; ei < elems.length; ei++) { var seat = seatFor(); if (seat) { s.grid[seat.y][seat.x] = T.ELEMENT; s.elementMap[seat.y + "," + seat.x] = elems[ei]; } }
      // the exit opens on the number of elements that are really in the mine
      s.totalElements = Object.keys(s.elementMap).length;

      // Power-ups
      var puCount = R(2, Math.min(Math.floor((3 + lv) * Math.sqrt(areaScale)), 7));
      for (var i = 0; i < puCount; i++) { var placed2 = false, att2 = 0; while (!placed2 && att2 < 200) { var px = R(2, s.cols - 3), py = R(2, s.rows - 3); if (s.grid[py][px] === T.EARTH || s.grid[py][px] === T.EARTH_RICH) { s.grid[py][px] = T.POWERUP; var puType = R(0, 2); s.powerupMap[py + "," + px] = puType; placed2 = true; } att2++; } }

      // Bonus elements
      var bonusCount = R(2, Math.min(Math.floor((3 + lv) * Math.sqrt(areaScale)), 6));
      var bonusPool = s.bonusKeys.slice();
      for (var i = bonusPool.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = bonusPool[i]; bonusPool[i] = bonusPool[j]; bonusPool[j] = t; }
      for (var i = 0; i < bonusCount && i < bonusPool.length; i++) { var placed3 = false, att3 = 0; while (!placed3 && att3 < 200) { var hx = R(2, s.cols - 3), hy = R(2, s.rows - 3); if (s.grid[hy][hx] === T.EARTH || s.grid[hy][hx] === T.EARTH_RICH) { s.grid[hy][hx] = T.HIDDEN_ELEM; s.hiddenElementMap[hy + "," + hx] = bonusPool[i]; placed3 = true; } att3++; } }

      // Player start
      s.playerX = 1; s.playerY = 1; s.grid[s.playerY][s.playerX] = T.PLAYER;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { var nx2 = s.playerX + dx, ny2 = s.playerY + dy; if (nx2 > 0 && nx2 < s.cols - 1 && ny2 > 0 && ny2 < s.rows - 1 && s.grid[ny2][nx2] !== T.PLAYER) { var tt = s.grid[ny2][nx2]; if (tt !== T.EARTH && tt !== T.EARTH_RICH && tt !== T.ELEMENT && tt !== T.POWERUP) s.grid[ny2][nx2] = T.EMPTY; } }

      // Exit
      s.exitX = s.cols - 2; s.exitY = s.rows - 2; s.grid[s.exitY][s.exitX] = T.EXIT;
      for (var dy = -1; dy <= 0; dy++) for (var dx = -1; dx <= 0; dx++) { var nx3 = s.exitX + dx, ny3 = s.exitY + dy; if (nx3 > 0 && nx3 < s.cols - 1 && ny3 > 0 && ny3 < s.rows - 1 && s.grid[ny3][nx3] !== T.EXIT) { if (s.grid[ny3][nx3] === T.BOULDER || s.grid[ny3][nx3] === T.ROCK) s.grid[ny3][nx3] = T.EARTH; } }

      // Enemies
      // the cap on each kind rises slowly below ENDLESS_RAMP_FROM (see config.js)
      var capOf = function(kind) {
        var c = ENDLESS_CREATURES[kind];
        return Math.min(c.cap + Math.max(0, Math.floor((lv - ENDLESS_RAMP_FROM) / c.every)), c.deep);
      };
      var batC = Math.min(Math.floor((2 + lv) * Math.sqrt(areaScale)), capOf("bat"));
      var snkC = lv >= 1 ? Math.min(Math.floor((1 + lv) * Math.sqrt(areaScale)), capOf("snake")) : 0;
      var crabC = lv >= 2 ? Math.min(Math.floor(lv * Math.sqrt(areaScale)), capOf("crab")) : 0;
      var minSpawnDist = Math.max(6, Math.floor(Math.min(s.cols, s.rows) * 0.3));
      function placeE(type) { var a = 0; while (a < 300) { var px2 = R(3, s.cols - 4), py2 = R(3, s.rows - 4); if (s.grid[py2][px2] === T.EMPTY && Math.abs(px2 - s.playerX) + Math.abs(py2 - s.playerY) > minSpawnDist && !s.enemies.some(function(ee) { return ee.x === px2 && ee.y === py2; })) { s.enemies.push(Game.enemies.create(type, px2, py2)); return; } a++; } }
      for (var i = 0; i < batC; i++) placeE("bat");
      for (var i = 0; i < snkC; i++) placeE("snake");
      for (var i = 0; i < crabC; i++) placeE("crab");
      var spiderC = lv >= 3 ? Math.min(Math.floor((lv - 1) * Math.sqrt(areaScale)), capOf("spider")) : 0;
      for (var i = 0; i < spiderC; i++) placeE("spider");

      // Spider nests
      var nestC = lv >= 4 ? Math.min(Math.floor((lv - 2) * 0.5 * Math.sqrt(areaScale)), capOf("nest")) : 0;
      for (var i = 0; i < nestC; i++) {
        var a = 0;
        while (a < 300) {
          var nx = R(3, s.cols - 4), ny = R(3, s.rows - 4);
          if (s.grid[ny][nx] === T.EARTH && Math.abs(nx - s.playerX) + Math.abs(ny - s.playerY) > minSpawnDist) {
            s.grid[ny][nx] = T.SPIDER_NEST; break;
          }
          a++;
        }
      }

      // Crumbling basalt
      var basaltC = lv >= 3 ? Math.min(Math.floor((3 + lv * 2) * areaScale), 12) : 0;
      for (var i = 0; i < basaltC; i++) {
        var rx3 = R(2, s.cols - 3), ry3 = R(2, s.rows - 3);
        if (s.grid[ry3][rx3] === T.EARTH || s.grid[ry3][rx3] === T.EARTH_RICH)
          s.grid[ry3][rx3] = T.BASALT;
      }

      // Endless: the deep gets darker - sight narrows every 5 depths
      s.baseSight = Math.max(5, BASE_SIGHT - Math.floor(lv / 5));

      // Timer
      s.maxLevelTime = Math.max(Math.floor((90 - lv * 5) * Math.sqrt(areaScale)), 50);
      s.levelTime = s.maxLevelTime;
      s.camX = 0; s.camY = 0; s.camSmoothX = 0; s.camSmoothY = 0;
      Game.camera.update();
    },

    loadCustom: function(levelData) {
      s.grid = []; s.elementMap = {}; s.hiddenElementMap = {}; s.powerupMap = {}; s.collected = [];
      s.moves = 0; s.enemies = []; s.crushEffects = []; s.explosionEffects = []; s.enemiesKilled = 0;
      s.explored = []; s.seenTile = []; s.placedDynamite = [];
      s.comboCount = 0; s.comboMultiplier = 1; s.lastComponentCompleted = -1;
      s.activeEffects = { lamp:0, geiger:0, mask:0 };
      s.playerOnGas = false; s.gasLevel = {}; s.pumps = []; s.gasExposure = 0; s.inRefuge = false;
      s.playerOnWater = false; s.waterSlowToggle = false; s.waterLevel = {}; s.lavaLevel = {}; s.basaltLife = {}; s.fallingBoulders = {}; s.hazardFalling = {}; s.rollingBarrelFalling = {}; s.tileSlide = {}; s.rollingBarrels = [];

      Game.levelGen.loadScenario(levelData.scenario !== undefined ? levelData.scenario : 0);

      // Free Play (scenario with no predefined elements): build element registry from level data
      if (s.elementKeys.length === 0) {
        var freeElems = (levelData.elements || []).concat(levelData.hiddenElems || []);
        freeElems.forEach(function(e) {
          if (ALL_ELEMENTS[e.key] && !s.elements[e.key]) {
            var el = ALL_ELEMENTS[e.key];
            s.elements[e.key] = { symbol:el.symbol, name:el.name, z:el.z, color:el.color, body:el.body, fun:el.fun, risk:el.risk, riskLabel:el.riskLabel };
          }
        });
        // Hidden elems must also live in the bonus registry - collectBonusElement and the
        // geiger-reveal renderer both look them up in s.bonusElements
        (levelData.hiddenElems || []).forEach(function(e) {
          if (ALL_ELEMENTS[e.key] && !s.bonusElements[e.key]) {
            var bel = ALL_ELEMENTS[e.key];
            s.bonusElements[e.key] = { symbol:bel.symbol, name:bel.name, z:bel.z, color:bel.color, body:bel.body, fun:bel.fun, risk:bel.risk, riskLabel:bel.riskLabel };
            if (s.bonusKeys) s.bonusKeys.push(e.key);
          }
        });
      }

      s.cols = levelData.cols || 20;
      s.rows = levelData.rows || 15;

      Game.camera.resize(true);

      s.bouncingCarts = []; s.shaftLifts = []; s.rollingCarts = []; s.tbms = [];
      var flatGrid = levelData.grid || [];
      for (var y = 0; y < s.rows; y++) {
        s.grid[y] = []; s.explored[y] = []; s.seenTile[y] = [];
        for (var x = 0; x < s.cols; x++) {
          var t = flatGrid[y * s.cols + x];
          if (t === T.CART_BOUNCE) { s.bouncingCarts.push({ y:y, floatX:x, dx:1 }); t = T.EMPTY; }
          if (t === T.SHAFT_LIFT) { s.shaftLifts.push({ x:x, floatY:y, dy:1 }); t = T.EMPTY; }
          // a tunnel borer is two tiles tall: a marker on the last row has no room
          if (t === T.TBM) { if (y + 1 < s.rows) s.tbms.push({ y:y, floatX:x, dir:1, lastCol:-1 }); t = T.EMPTY; }
          s.grid[y][x] = t !== undefined ? t : T.EARTH;
          s.explored[y][x] = false; s.seenTile[y][x] = T.EARTH;
        }
      }
      // Clear each tunnel borer's full 3x2 starting footprint (marker = top-left)
      s.tbms.forEach(function(m) {
        for (var ty = m.y; ty <= Math.min(m.y + 1, s.rows - 1); ty++)
          for (var tx = Math.floor(m.floatX); tx <= Math.min(Math.floor(m.floatX) + 2, s.cols - 1); tx++)
            if (s.grid[ty][tx] !== T.WALL) s.grid[ty][tx] = T.EMPTY;
      });

      // Refuge chambers: marker (30) = top-left of a 3×3 shelter - corner posts,
      // safe floor everywhere else. Collect markers first (floor reuses tile 30).
      s.refugeCells = {};
      var refugeMarkers = [];
      for (var ry = 0; ry < s.rows; ry++)
        for (var rx = 0; rx < s.cols; rx++)
          if (s.grid[ry][rx] === T.REFUGE) refugeMarkers.push({ x: rx, y: ry });
      refugeMarkers.forEach(function(rm) {
        for (var fy = rm.y; fy <= Math.min(rm.y + 2, s.rows - 1); fy++) {
          for (var fx = rm.x; fx <= Math.min(rm.x + 2, s.cols - 1); fx++) {
            if (s.grid[fy][fx] === T.WALL) continue;
            var isPost = (fy === rm.y || fy === rm.y + 2) && (fx === rm.x || fx === rm.x + 2);
            s.grid[fy][fx] = isPost ? T.REFUGE_POST : T.REFUGE;
            if (!isPost) s.refugeCells[fy + "," + fx] = true;
          }
        }
      });

      if (levelData.player) { s.playerX = levelData.player.x; s.playerY = levelData.player.y; s.grid[s.playerY][s.playerX] = T.PLAYER; }
      else { s.playerX = 1; s.playerY = 1; s.grid[1][1] = T.PLAYER; }

      if (levelData.exit) { s.exitX = levelData.exit.x; s.exitY = levelData.exit.y; s.grid[s.exitY][s.exitX] = T.EXIT; }
      else { s.exitX = s.cols - 2; s.exitY = s.rows - 2; s.grid[s.rows - 2][s.cols - 2] = T.EXIT; }

      var elems = levelData.elements || [];
      s.totalElements = elems.length;
      elems.forEach(function(e) { s.elementMap[e.y + "," + e.x] = e.key; s.grid[e.y][e.x] = T.ELEMENT; });

      var hidElems = levelData.hiddenElems || [];
      hidElems.forEach(function(e) {
        s.hiddenElementMap[e.y + "," + e.x] = e.key; s.grid[e.y][e.x] = T.HIDDEN_ELEM;
        // a level may hide an element outside its device's bonus set (uranium at Cigar Lake)
        if (s.bonusElements && !s.bonusElements[e.key] && ALL_ELEMENTS[e.key]) s.bonusElements[e.key] = ALL_ELEMENTS[e.key];
      });

      var powerups = levelData.powerups || [];
      powerups.forEach(function(p) { s.powerupMap[p.y + "," + p.x] = p.type; s.grid[p.y][p.x] = T.POWERUP; });

      s.triviaMap = {};
      s.triviaQuestion = levelData.triviaQuestion || "";
      s.triviaAnswer = levelData.triviaAnswer || "";
      s.triviaTrap = levelData.triviaTrap || "";
      s.triviaPos = levelData.triviaPos || null;

      // The answers are dealt onto the pads afresh on every load, so the right
      // pad cannot be learned by its place - only by knowing the element
      var pads = levelData.pads || [];
      var padKeys = pads.map(function(p) { return p.key; });
      for (var pi = padKeys.length - 1; pi > 0; pi--) { var pj = Math.floor(Math.random() * (pi + 1)); var pk = padKeys[pi]; padKeys[pi] = padKeys[pj]; padKeys[pj] = pk; }
      pads.forEach(function(p, i) { s.triviaMap[p.y + "," + p.x] = padKeys[i]; s.grid[p.y][p.x] = T.PAD; });

      // Quiz gates: further questions, each with its own pads and its own logic
      // doors. The single quiz above stays as it is and opens every logic door
      // that no gate claims.
      s.gates = []; s.padGate = {}; s.gateDoorCells = {};
      (levelData.gates || []).forEach(function(g) {
        var gi = s.gates.length;
        var gPads = g.pads || [], gKeys = gPads.map(function(p) { return p.key; });
        for (var a = gKeys.length - 1; a > 0; a--) { var b = Math.floor(Math.random() * (a + 1)); var tmp = gKeys[a]; gKeys[a] = gKeys[b]; gKeys[b] = tmp; }
        gPads.forEach(function(p, i) {
          var cell = p.y + "," + p.x;
          s.triviaMap[cell] = gKeys[i]; s.padGate[cell] = gi; s.grid[p.y][p.x] = T.PAD;
        });
        // a gate claims logic doors that are in the grid; it never makes one
        var doors = (g.doors || []).filter(function(d) { return s.grid[d.y] && s.grid[d.y][d.x] === T.LOGIC_DOOR; })
          .map(function(d) { return { x: d.x, y: d.y }; });
        doors.forEach(function(d) { s.gateDoorCells[d.y + "," + d.x] = gi; });
        s.gates.push({ question: g.question || "", answer: g.answer || "", pos: g.pos || null, doors: doors, open: false });
      });

      // Element families: collecting a whole family is a goal of its own and
      // puts time back on the clock
      s.families = (levelData.families || []).map(function(f) {
        return { name: f.name || "", keys: (f.keys || []).slice(), bonus: f.bonus || 0, color: f.color || "" };
      });
      s.familiesDone = {};
      s.runInfo = levelData.run || null;

      var enems = levelData.enemies || [];
      enems.forEach(function(en) {
        var e = Game.enemies.create(en.type, en.x, en.y);
        if (en.wait) e.state = AI_IDLE;
        s.enemies.push(e);
      });

      // Tutorial hints - banner messages that fire when the player nears (x,y)
      s.tutorialHints = (levelData.hints || []).map(function(h) {
        return { x:h.x, y:h.y, r:(h.r !== undefined ? h.r : 1), icon:h.icon || "💡", title:h.title || "", text:h.text || "", task:h.task || "", save:!!h.save, fired:false };
      });

      s.levelName = levelData.levelName || "";
      s.baseSight = (typeof levelData.sight === "number" && levelData.sight >= 3 && levelData.sight <= 14)
        ? levelData.sight : BASE_SIGHT;
      var _area = (levelData.cols || 20) * (levelData.rows || 15);
      s.maxLevelTime = levelData.timer || Math.max(Math.round(120 * Math.sqrt(_area / 300)), 60);
      s.levelTime = s.maxLevelTime;
      s.camX = 0; s.camY = 0; s.camSmoothX = 0; s.camSmoothY = 0;
      Game.camera.update();
    }
  };
})();
