"use strict";

// ═══════════════════════════════════════════════════════════════════
// tests/smoke.js - end-to-end smoke tests, run inside the real game page.
//
// tests/run.sh loads index.html with this script appended, in headless
// Chrome, and reads the lines written to <pre id="TEST-RESULTS">.
// The tests drive the game through its public entry points only
// (Game.map, Game.loop, Game.ui, key events), so they keep working when
// the internals are reorganised.
// ═══════════════════════════════════════════════════════════════════

(function() {
  var results = [], errors = [];
  window.addEventListener("error", function(e) { errors.push((e.message || "error") + " @" + (e.filename || "").split("/").pop() + ":" + e.lineno); });

  var s;
  function check(name, cond, detail) { results.push({ name: name, pass: !!cond, detail: cond ? undefined : (detail === undefined ? "" : String(detail)) }); }
  function test(name, fn) { try { fn(); } catch (e) { check(name, false, "threw: " + (e && e.stack ? e.stack.split("\n").slice(0, 2).join(" | ") : e)); } }
  function key(type, k) { document.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true })); }
  function frame() { Game.render.frame(); }

  // Put the miner next to a cell and step onto it
  function stepOnto(x, y) {
    var from = null;
    [[0, -1], [-1, 0], [1, 0], [0, 1]].some(function(d) {
      var fx = x + d[0], fy = y + d[1], t = s.grid[fy] && s.grid[fy][fx];
      if (t === T.EMPTY || t === T.EARTH || t === T.EARTH_RICH) { from = { x: fx, y: fy, dx: -d[0], dy: -d[1] }; return true; }
      return false;
    });
    if (!from) throw new Error("no free cell beside " + x + "," + y);
    s.grid[s.playerY][s.playerX] = T.EMPTY;
    s.playerX = from.x; s.playerY = from.y; s.grid[from.y][from.x] = T.PLAYER;
    Game.loop.movePlayer(from.dx, from.dy);
  }
  function cellOf(k) { var p = k.split(","); return { x: +p[1], y: +p[0] }; }
  function collectAll() {
    Object.keys(s.elementMap).forEach(function(k) { var c = cellOf(k); Game.loop.collectElement(s.elementMap[k], c.x, c.y); s.grid[c.y][c.x] = T.EMPTY; delete s.elementMap[k]; });
  }
  // The Element Runs, by their place in ElementRun/manifest.json
  var DEEP_RUN = 1;
  function startRun(i) { s.mode = "elementrun"; window.startLevel(i); Game.loop.clearIntervals(); }
  function gatePads(gi) {
    var right = null, wrong = null;
    for (var k in s.triviaMap) {
      if (s.padGate[k] !== gi) continue;
      if (s.triviaMap[k] === s.gates[gi].answer) right = cellOf(k); else if (!wrong) wrong = cellOf(k);
    }
    return { right: right, wrong: wrong };
  }
  function sharedLevel(extra) {
    var W = 14, H = 8, g = [];
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) g.push(x === 0 || y === 0 || x === W - 1 || y === H - 1 ? 7 : 0);
    var lvl = { cols: W, rows: H, grid: g, scenario: 15, player: { x: 2, y: 3 }, exit: { x: 12, y: 6 }, timer: 300 };
    for (var k in extra) lvl[k] = extra[k];
    document.getElementById("share-input").value = JSON.stringify(lvl);
    window.playSharedLevel();
  }

  function syncTests() {
    s = Game.state;
    SFX.muted = true;
    try { localStorage.clear(); } catch (e) {}

    test("sound: mute and volume are remembered, and a pause holds the music", function() {
      SFX.muted = false;
      window.toggleMute();
      check("muting is saved", SFX.muted && localStorage.getItem(SFX.MUTE_KEY) === "1");
      check("the menu button says the sound is off", /OFF/.test(document.getElementById("menu-mute-btn").textContent));
      SFX.muted = false; SFX.loadSettings();
      check("a reload comes back muted", SFX.muted === true);
      window.cycleVolume();
      check("the volume steps down", SFX.volume === 0.75, SFX.volume);
      check("the volume is saved", localStorage.getItem(SFX.VOLUME_KEY) === "0.75");
      check("the button shows it", /75%/.test(document.getElementById("volume-btn").textContent));
      SFX.volume = 1; SFX.loadSettings();
      check("a reload restores the volume", SFX.volume === 0.75, SFX.volume);
      Game.map.start(0); Game.loop.clearIntervals();
      check("the level music follows the volume", SFX.levelAudio && Math.abs(SFX.levelAudio.volume - SFX.LEVEL_MUSIC * 0.75) < 1e-6);
      check("a level started muted still counts its music as on", SFX.levelMusicPlaying === true);
      Game.loop.togglePause();
      check("pausing holds the music", s.paused && SFX.musicHeld === true && SFX.levelAudio.paused);
      Game.loop.togglePause();
      check("resuming lets it go", !s.paused && SFX.musicHeld === false);
      window.cycleVolume(); window.cycleVolume(); window.cycleVolume();
      check("the volume comes round to full", SFX.volume === 1, SFX.volume);
      try { localStorage.removeItem(SFX.MUTE_KEY); localStorage.removeItem(SFX.VOLUME_KEY); } catch (e) {}
      SFX.muted = true;
    });

    test("animation keeps time on a fast screen", function() {
      Game.map.start(0); Game.loop.clearIntervals();
      var t0 = performance.now() + 5000;
      Game.render.frame(t0);
      var a0 = s.animFrame; Game.render.frame(t0 + 1000 / 60);
      check("a 60 Hz frame advances the animation by one step", Math.abs(s.animFrame - a0 - 1) < 1e-6, s.animFrame - a0);
      a0 = s.animFrame; Game.render.frame(t0 + 1000 / 60 + 1000 / 120);
      check("a 120 Hz frame advances it by half a step", Math.abs(s.animFrame - a0 - 0.5) < 1e-6, s.animFrame - a0);
      a0 = s.animFrame; Game.render.frame(t0 + 10000);
      check("a long gap is capped", Math.abs(s.animFrame - a0 - 3) < 1e-6, s.animFrame - a0);
    });

    test("the notebook starts empty", function() {
      Game.ui.openNotebook();
      check("no pages are filled when the game opens", document.querySelectorAll("#notebook-overlay .found").length === 0);
      Game.ui.closeNotebook();
    });

    test("every mission starts and draws", function() {
      var n = Game.map.total(), bad = [];
      for (var i = 0; i < n; i++) {
        Game.map.start(i); frame();
        if (!s.running || !s.totalElements || s.grid.length !== s.rows) bad.push(i + 1);
      }
      check("31 missions available", n === 31, n);
      check("every mission starts and draws", bad.length === 0, "failed: " + bad.join(","));
    });

    test("tutorials, element run and endless start", function() {
      var bad = [];
      for (var i = 0; i < Game.tutorials.getCount(); i++) { s.mode = "tutorial"; window.startLevel(i); frame(); if (!s.running) bad.push("T" + (i + 1)); }
      var runSizes = [20, 94, 94];
      for (var r = 0; r < Game.elementRun.getCount(); r++) {
        s.mode = "elementrun"; window.startLevel(r); frame();
        if (!s.running || s.totalElements !== runSizes[r]) bad.push("element run " + (r + 1) + " (" + s.totalElements + ")");
      }
      if (Game.elementRun.getCount() !== 3) bad.push(Game.elementRun.getCount() + " element runs");
      window.beginGame("random");
      for (var d = 0; d < 9; d++) { window.startLevel(d); frame(); if (!s.running || s.totalElements !== 9) bad.push("depth " + (d + 1)); s.runActive = false; }
      check("tutorials, element run and endless start", bad.length === 0, bad.join(", "));
    });

    test("an upright tablet gets the phone arrangement with a large mine", function() {
      var realMM = window.matchMedia, w = Object.getOwnPropertyDescriptor(window, "innerWidth"), h = Object.getOwnPropertyDescriptor(window, "innerHeight");
      function screen(width, height, touch) {
        Object.defineProperty(window, "innerWidth", { configurable: true, get: function() { return width; } });
        Object.defineProperty(window, "innerHeight", { configurable: true, get: function() { return height; } });
        window.matchMedia = function() { return { matches: touch }; };
        return Game.camera.layout();
      }
      try {
        s.mode = "tutorial"; window.startLevel(0); Game.loop.clearIntervals();
        var L = screen(768, 1024, true); Game.camera.resize();
        check("iPad upright: controls under the mine, tiles of 40 px or more", L.mobile && L.tablet && !L.landscape && s.tile >= 40 && s.canvas.width <= 768, s.tile + " px, canvas " + s.canvas.width);
        L = screen(1024, 768, true);
        check("iPad on its side keeps the side panel", !L.mobile && !L.tablet && L.touch);
        L = screen(768, 1024, false);
        check("a narrow desktop window is not taken for a tablet", !L.tablet && !L.mobile);
        L = screen(390, 844, true); Game.camera.resize();
        check("a phone keeps its own tile size", L.mobile && !L.tablet && s.tile <= 44, s.tile);
      } finally {
        window.matchMedia = realMM;
        if (w) Object.defineProperty(window, "innerWidth", w); else delete window.innerWidth;
        if (h) Object.defineProperty(window, "innerHeight", h); else delete window.innerHeight;
        Game.camera.resize();
      }
    });

    test("tutorials: water, lava and gas wait for the miner", function() {
      var P = Game.physics, q, i;
      function count(tile) { var n = 0; for (var y = 0; y < s.rows; y++) for (var x = 0; x < s.cols; x++) if (s.grid[y][x] === tile) n++; return n; }
      function fluids() { return [count(T.WATER), count(T.LAVA), count(T.GAS), Object.keys(s.waterLevel).length, Object.keys(s.lavaLevel).length].join("/"); }
      function settle(n) { for (var k = 0; k < n; k++) { P.tickWater(); P.tickLava(); P.tickGas(); P.applyGravity(); } }
      function walk(dx, dy, n) { for (var k = 0; k < n; k++) { var want = (s.playerX + dx) + "," + (s.playerY + dy); for (var t = 0; t < 3 && pos() !== want; t++) Game.loop.movePlayer(dx, dy); if (pos() !== want) throw new Error("stuck at " + pos()); } }
      var moved = [];
      for (i = 0; i < Game.tutorials.getCount(); i++) {
        s.mode = "tutorial"; window.startLevel(i); Game.loop.clearIntervals();
        // tutorial 4 shows one tile of lava in the pit under its vein; nothing else may move
        var water = count(T.WATER), gas = count(T.GAS), pit = i === 3 ? 1 : 0;
        settle(300); var early = fluids(); settle(300);
        if (count(T.WATER) !== water || count(T.GAS) !== gas || count(T.LAVA) !== pit || fluids() !== early) moved.push(s.levelName + " " + early + " > " + fluids());
      }
      check("no lesson floods, burns or gasses itself while the miner stands still", moved.length === 0, moved.join("; "));

      // Tutorial 4: the spring floods the basin when it is dug, and the lava chamber stays passable.
      s.mode = "tutorial"; window.startLevel(3); Game.loop.clearIntervals();
      walk(1, 0, 9);
      check("tutorial 4: the basin is dry until the spring is dug", pos() === "11,2" && at(11, 3) === T.WATER_SRC && count(T.WATER) === 9, pos() + " " + count(T.WATER));
      walk(0, 1, 2); walk(1, 0, 2); walk(0, -1, 1); settle(300);     // on to the dry shelf, out of the water's way
      check("tutorial 4: digging down through the spring floods the basin", pos() === "13,3" && at(11, 6) === T.WATER && at(16, 6) === T.WATER && at(16, 4) === T.WATER && count(T.WATER) === 27, count(T.WATER) + " water");
      for (q = 0; q < 400; q++) P.tickLava();
      var rowOpen = [15, 16, 17, 18, 19, 20].every(function(x) { return at(x, 14) === T.EMPTY; });
      check("tutorial 4: the lava fills only the pit under its vein, and the way across above it stays open",
        at(19, 15) === T.LAVA_SRC && at(19, 16) === T.LAVA && count(T.LAVA) === 1 && rowOpen, count(T.LAVA) + " lava, row open " + rowOpen);
      s.grid[s.playerY][s.playerX] = T.WATER; s.grid[15][19] = T.PLAYER; s.playerX = 19; s.playerY = 15; s.playerOnWater = false;
      Game.loop.movePlayer(0, 1);
      check("tutorial 4: a step into the lava pit is fatal", !!s.deathAnim && s.deathAnim.cause === "lava", JSON.stringify(s.deathAnim && s.deathAnim.cause));

      // The pump is used on a flood that is still spreading: it must stay dry afterwards.
      s.mode = "tutorial"; window.startLevel(3); Game.loop.clearIntervals();
      walk(1, 0, 9); walk(0, 1, 3); walk(1, 0, 3); walk(0, -1, 1); walk(-1, 0, 1);
      for (q = 0; q < 200 && at(12, 4) !== T.WATER; q++) P.tickWater();
      var filling = Object.keys(s.waterLevel).length;
      Game.loop.usePowerup(PU.PUMP);
      for (q = 0; q < 60; q++) { P.tickWater(); if (q % 3 !== 2) Game.machines.tickPumps(); }
      settle(300);
      check("tutorial 4: a flood pumped while it is still spreading does not come back", pos() === "13,4" && filling > 0 && s.pumps.length === 1 && s.pumps[0].done && count(T.WATER) === 9 && count(T.WATER_SRC) === 0 && Object.keys(s.waterLevel).length === 0,
        pos() + " " + filling + " filling, " + count(T.WATER) + " water, " + Object.keys(s.waterLevel).length + " still filling");
    });

    test("tutorial 6: refuge, mask, pump and borer can be played through", function() {
      var LESSON = 5, P = Game.physics, M = Game.machines, q;
      function begin() { s.mode = "tutorial"; window.startLevel(LESSON); Game.loop.clearIntervals(); }
      function count(tile) { var n = 0; for (var y = 0; y < s.rows; y++) for (var x = 0; x < s.cols; x++) if (s.grid[y][x] === tile) n++; return n; }
      function borer() { return s.tbms[0]; }
      function runBorer(until, limit) { for (var i = 0; i < (limit || 4000) && !until(); i++) M.tickTBMs(); return until(); }
      // the borer is well clear of column x (wider than its real kill zone)
      function clearOf(x) { var m = borer(); return x < m.floatX - 1 || x > m.floatX + 3.2; }
      // a route such as "R6 U1": each step is tried until the miner has moved (wading takes two tries).
      // In the lane the miner first lets the borer move off the next tile, and the borer runs on between steps.
      function go(route, inLane) {
        route.split(" ").forEach(function(leg) {
          var d = { R: [1, 0], L: [-1, 0], U: [0, -1], D: [0, 1] }[leg[0]], n = +leg.slice(1);
          for (var i = 0; i < n; i++) {
            var nx = s.playerX + d[0], ny = s.playerY + d[1], want = nx + "," + ny;
            if (inLane && !runBorer(function() { return clearOf(nx); }, 1500)) throw new Error("the borer never left " + want);
            for (var tries = 0; tries < 3 && pos() !== want && s.running; tries++) Game.loop.movePlayer(d[0], d[1]);
            if (pos() !== want) throw new Error("stuck at " + pos() + " on leg " + leg + " of " + route);
            if (inLane) { M.tickTBMs(); M.tickTBMs(); M.tickTBMs(); }
          }
        });
      }

      begin();
      check("the lesson is tutorial 6 and asks for four elements", Game.tutorials.getCount() === 6 && /Tutorial 6/.test(s.levelName) && s.totalElements === 4, s.levelName + " / " + s.totalElements);
      var gas0 = count(T.GAS), water0 = count(T.WATER);
      for (q = 0; q < 300; q++) { P.tickGas(); P.tickWater(); P.applyGravity(); }
      check("nothing leaks while the miner reads the first hint", count(T.GAS) === gas0 && count(T.WATER) === water0 && gas0 > 0 && water0 > 0, gas0 + ">" + count(T.GAS) + " " + water0 + ">" + count(T.WATER));

      go("R5");
      check("walking into the first refuge saves a checkpoint", pos() === "7,5" && s.inRefuge && !!s.checkpoint);
      go("R5");
      check("both gas masks are picked up", s.inventory[PU.MASK] === 2, s.inventory[PU.MASK]);
      go("R1 U1");
      for (q = 0; q < 300; q++) P.tickGas();
      check("the gas stays in its chamber once the plug is dug", count(T.GAS) === gas0 && at(13, 5) !== T.GAS, count(T.GAS));
      Game.loop.usePowerup(PU.MASK);
      check("the mask gives 20 s", s.activeEffects.mask === 20, s.activeEffects.mask);
      go("U1 R6 U2");
      check("the helium is reached through the gas", s.collected.indexOf("He") !== -1, s.collected.join(","));
      go("D2 L6 D2 R8 D3 L1");
      check("the pump is picked up", s.inventory[PU.PUMP] === 1, s.inventory[PU.PUMP]);
      go("L2");
      Game.loop.usePowerup(PU.PUMP);
      check("the pump starts beside the water", s.pumps.length === 1 && s.inventory[PU.PUMP] === 0);
      for (q = 0; q < 20; q++) M.tickPumps();
      check("the pump drains the siphon and caps its spring", count(T.WATER) === 0 && count(T.WATER_SRC) === 0 && at(13, 11) === T.ROCK, count(T.WATER) + " water, " + count(T.WATER_SRC) + " springs");
      go("D3 L2 U1 D1 L2 U3");
      check("the gadolinium is collected on the dry floor", s.collected.indexOf("Gd") !== -1, s.collected.join(","));
      go("L3");
      check("the second refuge replaces the checkpoint", s.inRefuge && s.checkpoint.playerX === 11 && s.checkpoint.collected.length === 2, s.checkpoint.playerX + "/" + s.checkpoint.collected.length);
      go("L2 D4");

      runBorer(function() { return false; }, 2400);
      var open = true;
      for (var lx = 5; lx <= 17; lx++) for (var ly = 13; ly <= 14; ly++) { var lt = at(lx, ly); if (lt !== T.EMPTY && lt !== T.ELEMENT) open = false; }
      check("the borer clears its lane and spares the titanium", open && at(6, 14) === T.ELEMENT);
      check("the borer stays between its walls", borer().floatX >= 4.95 && borer().floatX <= 15.05, borer().floatX);
      check("the shaft above the lane is safe", s.running && pos() === "9,12");
      check("the borer passes the shaft heading east", runBorer(function() { return borer().dir > 0 && borer().floatX > 10.2 && borer().floatX < 11; }));
      go("D2 L3", true);
      check("the titanium is taken from the borer's tunnel", s.collected.indexOf("Ti") !== -1 && s.running, s.collected.join(","));
      go("R6 D1", true);
      go("D1 R6");
      check("the iron completes the set", s.collected.length === 4 && s.running, s.collected.join(","));
      go("R4");
      check("the exit ends the lesson with a win", !s.running && !s.deathAnim && !document.getElementById("notebook-overlay").classList.contains("hidden"));
      Game.ui.closeNotebook();

      // a miner who swims instead of pumping still gets through, and one the borer catches is offered the second refuge
      begin();
      go("R5 R5 R1 U1"); Game.loop.usePowerup(PU.MASK); go("U1 R6 U2 D2 L6 D2 R8 D3 L1 L2 D3 L2 U1 D1 L2 U3 L3 L2 D4");
      check("the siphon can be swum without the pump", pos() === "9,12" && s.collected.length === 2 && count(T.WATER) > 0, pos() + " " + s.collected.join(","));
      runBorer(function() { return borer().dir < 0 && borer().floatX > 8 && borer().floatX < 9; });
      Game.loop.movePlayer(0, 1);
      check("stepping into the borer is fatal", !s.running && s.deathAnim && s.deathAnim.cause === "tbm", s.running);
      s.deathAnim = null; window.respawnAtRefuge();
      check("the respawn is at the second refuge with the elements kept", s.running && s.playerX === 11 && s.playerY === 8 && s.collected.length === 2, pos() + " " + s.collected.length);
      Game.loop.clearIntervals();
      // the later tests expect elements that have not been found yet
      var ask = window.confirm; window.confirm = function() { return true; };
      try { Game.ui.resetNotebook(); Game.ui.closeNotebook(); } finally { window.confirm = ask; }
    });

    test("element run: halogen barrels wait for the miner", function() {
      startRun(DEEP_RUN);
      function barrels() { var n = 0; for (var x = 1; x < s.cols - 1; x++) if (s.grid[3][x] === T.HAZARD) n++; return n; }
      for (var i = 0; i < 6; i++) Game.physics.applyGravity();
      check("no barrel falls into its chute by itself", barrels() === 5, barrels());
      s.grid[s.playerY][s.playerX] = T.EMPTY; s.playerX = 47; s.playerY = 3; s.grid[3][47] = T.PLAYER;
      Game.loop.movePlayer(1, 0);
      for (i = 0; i < 8; i++) Game.physics.applyGravity();
      check("a shoved barrel drops down the chute and cracks the ice vault", barrels() === 4 && s.grid[5][51] !== T.ICE, barrels() + " / " + s.grid[5][51]);
    });

    test("element runs: families and gates are well formed", function() {
      var ids = {}, bad = [];
      for (var r = 0; r < Game.elementRun.getCount(); r++) {
        startRun(r);
        var info = Game.ui.runInfo(r), keys = Object.keys(s.elementMap).map(function(k) { return s.elementMap[k]; }), seen = {};
        if (ids[info.id]) bad.push("run id " + info.id + " used twice"); ids[info.id] = 1;
        if (!s.families.length || !s.gates.length) bad.push(info.id + ": no families or no gates");
        s.families.forEach(function(f) {
          if (!(f.bonus > 0)) bad.push(info.id + ": " + f.name + " has no bonus");
          f.keys.forEach(function(k) { if (seen[k] || keys.indexOf(k) < 0) bad.push(info.id + ": " + k + " in " + f.name); seen[k] = 1; });
        });
        keys.forEach(function(k) { if (!seen[k]) bad.push(info.id + ": " + k + " is in no family"); });
        s.gates.forEach(function(g, gi) {
          var p = gatePads(gi);
          if (!p.right || !p.wrong) bad.push(info.id + ": gate " + (gi + 1) + " lacks a right or a wrong pad");
          if (!g.doors.length) bad.push(info.id + ": gate " + (gi + 1) + " has no door");
          if (!g.question) bad.push(info.id + ": gate " + (gi + 1) + " has no question");
        });
      }
      check("every run has its own id, and families and gates that fit its elements", bad.length === 0, bad.slice(0, 6).join("; "));
    });

    test("element runs: nothing moves before the miner does", function() {
      var bad = [];
      for (var r = 0; r < Game.elementRun.getCount(); r++) {
        startRun(r);
        var before = s.grid.map(function(row) { return row.slice(); }), i;
        for (i = 0; i < 40; i++) Game.physics.applyGravity();
        for (i = 0; i < 6; i++) { Game.physics.tickWater(); Game.physics.tickGas(); Game.physics.tickLava(); }
        var moved = 0;
        for (var y = 0; y < s.rows; y++) for (var x = 0; x < s.cols; x++) {
          var was = before[y][x];
          if ((was === T.BOULDER || was === T.HAZARD || was === T.ELEMENT || was === T.ICE || was === T.EARTH) && s.grid[y][x] !== was) moved++;
        }
        if (moved || !s.running) bad.push("run " + (r + 1) + ": " + moved + " cells changed, running " + s.running);
      }
      check("every run is at rest when it starts", bad.length === 0, bad.join("; "));
    });

    test("element runs: a gate, a wrong answer, a family", function() {
      startRun(0);
      var p = gatePads(0), t0 = s.levelTime;
      stepOnto(p.wrong.x, p.wrong.y);
      check("a wrong gate pad costs time and opens nothing", t0 - s.levelTime === QUIZ_PENALTY_SECONDS && !s.gates[0].open, t0 - s.levelTime);
      stepOnto(p.right.x, p.right.y);
      var own = s.gates[0].doors.every(function(d) { return s.grid[d.y][d.x] === T.EMPTY; });
      var others = s.gates.slice(1).every(function(g) { return !g.open && g.doors.every(function(d) { return s.grid[d.y][d.x] === T.LOGIC_DOOR; }); });
      check("the right pad opens that gate's doors and no others", s.gates[0].open && own && others, own + "/" + others);
      var f = s.families[0], t1 = s.levelTime, sc = s.score;
      f.keys.forEach(function(key) {
        var cell = Object.keys(s.elementMap).filter(function(k) { return s.elementMap[k] === key; })[0], c = cellOf(cell);
        Game.loop.collectElement(key, c.x, c.y); s.grid[c.y][c.x] = T.EMPTY; delete s.elementMap[cell];
      });
      check("a finished family puts its bonus on the clock", s.levelTime === t1 + f.bonus && s.familiesDone[f.name] === 1, s.levelTime - t1);
      check("a finished family scores", s.score - sc >= FAMILY_SCORE, s.score - sc);
    });

    test("element runs: a respawn takes gates and families back to the refuge", function() {
      startRun(DEEP_RUN);
      var entered = Object.keys(s.refugeCells).some(function(k) { var c = cellOf(k); try { stepOnto(c.x, c.y); return true; } catch (e) { return false; } });
      check("the miner can walk into a refuge of the run", entered && !!s.checkpoint);
      var t0 = s.levelTime, p = gatePads(0), door = s.gates[0].doors[0], f = s.families[0];
      stepOnto(p.right.x, p.right.y);
      f.keys.forEach(function(key) {
        var cell = Object.keys(s.elementMap).filter(function(k) { return s.elementMap[k] === key; })[0], c = cellOf(cell);
        Game.loop.collectElement(key, c.x, c.y); s.grid[c.y][c.x] = T.EMPTY; delete s.elementMap[cell];
      });
      check("gate open and family done before the respawn", s.gates[0].open && s.familiesDone[f.name] === 1 && s.levelTime === t0 + f.bonus);
      window.respawnAtRefuge(); Game.loop.clearIntervals();
      check("after the respawn the gate is shut, the family open and the clock as it was",
        !s.gates[0].open && s.grid[door.y][door.x] === T.LOGIC_DOOR && !s.familiesDone[f.name] && s.levelTime === t0 && s.collected.length === 0,
        s.gates[0].open + "/" + s.grid[door.y][door.x] + "/" + s.levelTime);
    });

    test("element runs: the list and the records", function() {
      Game.ui.saveRunBest(0, { name: "T", score: 4321, timeUsed: 75, bonus: 0, date: 1 });
      check("a record is kept under its run's id", Game.ui.runBest(0).score === 4321 && !Game.ui.runBest(1) && !Game.ui.runBest(2) &&
        localStorage.getItem("deepElements_runBest_" + Game.ui.runInfo(0).id) !== null);
      Game.ui.showRunChooser();
      var cards = document.querySelectorAll("#run-list .run-choice");
      check("the list offers every run, with its best result", cards.length === 3 && /4321/.test(cards[0].textContent) && /Not finished/.test(cards[1].textContent),
        cards.length + " / " + (cards[0] && cards[0].textContent));
      Game.ui.hideRunChooser();
      localStorage.removeItem("deepElements_runBest_" + Game.ui.runInfo(0).id);
    });

    test("every kind of tile, creature and machine draws", function() {
      // one of each, fully lit, so every drawing function runs at least once
      var kinds = [T.EARTH, T.EARTH_RICH, T.ROCK, T.BOULDER, T.HAZARD, T.WATER, T.WATER_SRC, T.KEY, T.DOOR, T.LOGIC_DOOR, T.WEB, T.CART,
        T.ROLL_BARREL, T.ICE, T.LAVA, T.LAVA_SRC, T.SPIDER_NEST, T.BASALT, T.GAS, T.GAS_SRC];
      var W = 26, H = 9, g = [];
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) g.push(x === 0 || y === 0 || x === W - 1 || y === H - 1 ? 7 : 0);
      kinds.forEach(function(t, i) { g[2 * W + 2 + i] = t; });
      g[5 * W + 20] = T.REFUGE; g[4 * W + 3] = T.CART_BOUNCE; g[4 * W + 6] = T.SHAFT_LIFT; g[6 * W + 10] = T.TBM;
      document.getElementById("share-input").value = JSON.stringify({ cols: W, rows: H, grid: g, scenario: 15, timer: 300,
        player: { x: 1, y: 1 }, exit: { x: 24, y: 1 }, elements: [{ key: "Cu", x: 3, y: 1 }], hiddenElems: [{ key: "Ag", x: 5, y: 1 }],
        pads: [{ key: "Cu", x: 22, y: 3 }], triviaQuestion: "Which metal?", triviaAnswer: "Cu", triviaPos: { x: 18, y: 4 },
        powerups: [0, 1, 2, 3, 4].map(function(t, i) { return { type: t, x: 7 + i, y: 1 }; }),
        enemies: ["bat", "spider", "crab", "snake"].map(function(t, i) { return { type: t, x: 2 + i * 2, y: 7 }; }) });
      window.playSharedLevel();
      Game.loop.clearIntervals();
      s.previewMode = true; s.activeEffects.geiger = 9; s.activeEffects.lamp = 9; s.gasExposure = 0.5;
      s.placedDynamite.push({ x: 14, y: 1, fuse: 3 }); s.pumps.push({ x: 16, y: 1, done: false, worked: 0 });
      s.rollingBarrels.push({ x: 4, y: 4, dx: 1, floatX: 4, floatY: 4, rot: 0 });
      Game.physics.detonateDynamite(18, 6); Game.physics.detonateToxicBarrel(22, 6);
      Game.loop.collectElement("Cu", 3, 1); Game.enemies.checkBoulderCrush(2, 7);
      s.enemies.forEach(function(e) { e.state = AI_CHASE; });
      var drew = true;
      try { for (var f = 0; f < 3; f++) frame(); s.previewMode = false; frame(); } catch (e) { drew = e; }
      check("every kind of tile, creature and machine draws", drew === true && s.tbms.length === 1 && s.bouncingCarts.length === 1, drew && drew.stack ? drew.stack.split("\n").slice(0, 2).join(" | ") : drew);
      s.previewMode = false;
    });

    // ── Movement rules: one small scene per rule. The miner starts at (4,3) in an
    //    open 14×8 room; `cells` places tiles as [x, y, tile]. ──
    function scene(cells, extra) {
      var W = 14, H = 8, g = [];
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) g.push(x === 0 || y === 0 || x === W - 1 || y === H - 1 ? 7 : 0);
      (cells || []).forEach(function(c) { g[c[1] * W + c[0]] = c[2]; });
      var lvl = { cols: W, rows: H, grid: g, scenario: 15, player: { x: 4, y: 3 }, exit: { x: 12, y: 6 }, timer: 300 };
      for (var k in (extra || {})) lvl[k] = extra[k];
      document.getElementById("share-input").value = JSON.stringify(lvl);
      window.playSharedLevel();
      Game.loop.clearIntervals();
    }
    function at(x, y) { return s.grid[y][x]; }
    function pos() { return s.playerX + "," + s.playerY; }
    function right() { Game.loop.movePlayer(1, 0); }

    test("move: digging and solid tiles", function() {
      scene([[5, 3, T.EARTH]]); right();
      check("digging earth moves the miner and clears the cell behind", pos() === "5,3" && at(4, 3) === T.EMPTY && s.moves === 1 && s.digParticles.length > 0 && s.playerIsDigging === true);
      [T.WALL, T.ROCK, T.ICE, T.BASALT, T.SPIDER_NEST, T.GAS_SRC, T.LOGIC_DOOR].forEach(function(t) {
        scene([[5, 3, t]]); right();
        check("tile " + t + " blocks the miner", pos() === "4,3" && at(5, 3) === t && s.moves === 0, pos());
      });
      scene([]); Game.loop.movePlayer(0, -1);
      check("open ground is walked, facing follows", pos() === "4,2" && s.playerFacing === "north" && s.playerIsDigging === false);
    });

    test("move: boulders and barrels", function() {
      scene([[5, 3, T.BOULDER]]); right();
      check("a boulder is pushed sideways", pos() === "5,3" && at(6, 3) === T.BOULDER);
      scene([[5, 3, T.BOULDER], [6, 3, T.ROCK]]); right();
      check("a blocked boulder does not move", pos() === "4,3" && at(5, 3) === T.BOULDER);
      scene([[4, 2, T.BOULDER]]); Game.loop.movePlayer(0, -1);
      check("a boulder cannot be pushed upward", pos() === "4,3" && at(4, 2) === T.BOULDER);
      scene([[5, 3, T.BOULDER]], { enemies: [{ type: "bat", x: 6, y: 3 }] }); right();
      check("a pushed boulder crushes a creature", s.enemiesKilled === 1 && at(6, 3) === T.BOULDER && pos() === "5,3");
      scene([[5, 3, T.HAZARD]]); right();
      check("a toxic barrel is pushed sideways", pos() === "5,3" && at(6, 3) === T.HAZARD);
      scene([[5, 3, T.HAZARD], [6, 3, T.EARTH]]); right();
      check("a blocked toxic barrel does not move", pos() === "4,3");
      scene([[5, 3, T.ROLL_BARREL]]); right();
      check("a rolling barrel is set rolling", pos() === "5,3" && s.rollingBarrels.length === 1 && s.rollingBarrels[0].dx === 1);
      scene([[4, 2, T.ROLL_BARREL]]); Game.loop.movePlayer(0, -1);
      check("a rolling barrel cannot be pushed upward", pos() === "4,3" && s.rollingBarrels.length === 0);
    });

    test("move: webs, water, gas and lava", function() {
      scene([[5, 3, T.WEB]]); right();
      check("slashing a web takes the step's time but not the step", pos() === "4,3" && at(5, 3) === T.EMPTY && s.moves === 1);
      scene([[5, 3, T.WATER_SRC], [6, 3, T.WATER], [7, 3, T.WATER]]); right();
      check("digging a spring releases water and the miner wades in", pos() === "5,3" && s.playerOnWater === true);
      right(); var afterFirst = pos(); right(); var afterSecond = pos(); right(); var afterThird = pos();
      check("wading moves on every second attempt", afterFirst === "6,3" && afterSecond === "6,3" && afterThird === "7,3", afterFirst + " " + afterSecond + " " + afterThird);
      scene([[5, 3, T.WATER]]); right(); Game.loop.movePlayer(-1, 0);
      check("water is left behind as water", at(5, 3) === T.WATER && pos() === "4,3" && s.playerOnWater === false);
      scene([[5, 3, T.GAS]]); right();
      check("stepping into gas is tracked", pos() === "5,3" && s.playerOnGas === true);
      Game.loop.movePlayer(-1, 0);
      check("gas is left behind as gas", at(5, 3) === T.GAS && s.playerOnGas === false);
      scene([[5, 3, T.LAVA]]); right();
      check("lava is fatal", !s.running && s.deathAnim && s.deathAnim.cause === "lava");
      scene([[5, 3, T.LAVA_SRC]]); right();
      check("digging a lava vein lets the lava out and the miner stays back", at(5, 3) === T.LAVA && pos() === "4,3" && s.running && !s.deathAnim && s.moves === 1, at(5, 3) + " " + pos());
      right();
      check("a second step into the broken vein is fatal", !s.running && s.deathAnim && s.deathAnim.cause === "lava");
      // a key held down from the dig is not that second step; letting go and pressing again is
      scene([[5, 3, T.LAVA_SRC]]);
      var t0 = performance.now();
      key("keydown", "ArrowRight"); Game.loop.tickInput(t0);
      for (var hi = 1; hi <= 12; hi++) Game.loop.tickInput(t0 + hi * 150);
      check("a key held from the dig does not walk the miner into the lava", at(5, 3) === T.LAVA && pos() === "4,3" && s.running && !s.deathAnim, at(5, 3) + " " + pos() + " " + s.running);
      key("keyup", "ArrowRight"); Game.loop.tickInput(t0 + 2000);
      key("keydown", "ArrowRight"); Game.loop.tickInput(t0 + 2200);
      check("pressing again walks in", !s.running && s.deathAnim && s.deathAnim.cause === "lava");
      key("keyup", "ArrowRight");
    });

    test("move: creatures and machines", function() {
      scene([], { enemies: [{ type: "snake", x: 5, y: 3 }] }); right();
      check("walking into a creature is fatal", !s.running && s.deathAnim.cause === "snake");
      scene([]); s.bouncingCarts.push({ y: 3, floatX: 5.3, dx: 1 }); right();
      check("walking into a runaway cart is fatal", !s.running && s.deathAnim.cause === "cart_bounce");
      scene([]); s.shaftLifts.push({ x: 5, floatY: 3.2, dy: 1 }); right();
      check("walking into a shaft lift is fatal", !s.running && s.deathAnim.cause === "shaft_lift");
      scene([]); s.tbms.push({ y: 3, floatX: 5, dir: -1, lastCol: -1 }); right();
      check("walking into a tunnel borer is fatal", !s.running && s.deathAnim.cause === "tbm");
    });

    test("move: keys, doors, tools and the exit", function() {
      scene([[5, 3, T.DOOR]]); right();
      check("a locked door needs a key", pos() === "4,3" && at(5, 3) === T.DOOR);
      scene([[5, 3, T.KEY], [6, 3, T.DOOR]]); right();
      check("a key is picked up", pos() === "5,3" && s.keysCollected === 1);
      right();
      check("a key opens a door and is used up", pos() === "6,3" && s.keysCollected === 0);
      scene([], { powerups: [{ type: 2, x: 5, y: 3 }] }); right();
      check("a tool is picked up", s.inventory[2] === 1 && pos() === "5,3" && !s.powerupMap["3,5"]);
      scene([], { hiddenElems: [{ key: "Ag", x: 5, y: 3 }] }); right(); right();
      check("a hidden element stays buried without the Geiger", at(5, 3) === T.HIDDEN_ELEM && s.hiddenElementMap["3,5"] === "Ag" && pos() === "6,3");
      scene([], { hiddenElems: [{ key: "Ag", x: 5, y: 3 }] }); s.activeEffects.geiger = 5; var sc0 = s.score; right();
      check("a hidden element is collected with the Geiger", !s.hiddenElementMap["3,5"] && s.score > sc0);
      scene([], { exit: { x: 5, y: 3 }, elements: [{ key: "Cu", x: 9, y: 6 }] }); right();
      check("the exit is barred until everything is collected", pos() === "4,3" && s.running);
      scene([], { exit: { x: 5, y: 3 } }); right();
      check("the open exit ends the level", !s.running && !document.getElementById("notebook-overlay").classList.contains("hidden"));
      Game.ui.closeNotebook();
      scene([], { pads: [{ key: "Cu", x: 5, y: 3 }, { key: "Au", x: 5, y: 5 }], triviaQuestion: "?", triviaAnswer: "Au" }); right(); right();
      check("an answer pad is restored after the miner steps off", at(5, 3) === T.PAD && pos() === "6,3");
    });

    test("move: minecarts", function() {
      scene([[5, 3, T.CART]]); right();
      check("a minecart is shoved rolling", pos() === "5,3" && s.rollingCarts.length === 1 && s.rollingCarts[0].endX === 12);
      for (var f = 0; f < 5; f++) frame();
      check("drawing alone does not move a rolling cart", s.rollingCarts.length === 1 && s.rollingCarts[0].x === 5);
      scene([[5, 3, T.CART]], { enemies: [{ type: "bat", x: 9, y: 3 }] }); right();
      for (var k = 0; k < 20 && s.rollingCarts.length; k++) Game.machines.tickRollingCarts();
      check("a rolling cart flattens creatures and comes to rest at the end of its run", s.rollingCarts.length === 0 && at(12, 3) === T.CART && s.enemiesKilled === 1 && k < 12, k);
      scene([[5, 3, T.CART], [6, 3, T.ROCK]]); right();
      check("a blocked minecart does not move", pos() === "4,3" && at(5, 3) === T.CART);
      scene([[4, 4, T.CART]]); Game.loop.movePlayer(0, 1);
      check("stepping down onto a cart boards it", pos() === "4,4" && !!s.riding);
      Game.loop.movePlayer(0, 1);
      check("no stepping down while aboard", pos() === "4,4");
      Game.loop.movePlayer(1, 0);
      check("left/right launches the ride", !!s.ridingRoll && s.ridingRoll.endX === 12);
      s.ridingRoll = null; Game.loop.movePlayer(0, -1);
      check("up hops out and leaves the cart", pos() === "4,3" && !s.riding && at(4, 4) === T.CART);
      scene([[4, 4, T.CART], [4, 2, T.EARTH]]); Game.loop.movePlayer(0, 1); s.grid[3][4] = T.EARTH; Game.loop.movePlayer(0, -1);
      check("hopping out digs headroom first", pos() === "4,4" && at(4, 3) === T.EMPTY && !!s.riding);
    });

    test("sprites draw into other canvases", function() {
      var kinds = ["miner", "bat", "spider", "crab", "snake", "boulder", "earth", "rich", "rock", "wall", "ice", "basalt", "water", "lava", "watersrc", "lavasrc",
        "barrel", "rollbarrel", "cart", "roguecart", "lift", "key", "door", "logicdoor", "exit", "exitclosed", "gem", "web", "nest", "gas", "gaspipe",
        "refuge", "refugepost", "pad", "empty", "tool0", "tool1", "tool2", "tool3", "tool4"];
      var bad = [];
      kinds.forEach(function(kind) {
        [false, true].forEach(function(fill) {
          var cv = document.createElement("canvas"); cv.width = cv.height = 32;
          var err = Game.render.icon(cv, kind, fill);
          if (err) bad.push(kind + (fill ? " (tile)" : "") + ": " + err.message);
        });
      });
      check("every sprite kind draws as an icon and as a full tile", bad.length === 0, bad.join(" ; "));
    });

    test("collecting an element", function() {
      Game.map.start(4);
      var k = Object.keys(s.elementMap)[0], c = cellOf(k), sym = s.elementMap[k], t0 = s.levelTime;
      stepOnto(c.x, c.y);
      check("element is collected by walking onto it", s.collected.indexOf(sym) >= 0);
      check("first find holds the clock", s.readFreeze === READ_FREEZE_SECONDS, s.readFreeze);
      check("fact card shows role, glossary-ready body", /In this/.test(document.getElementById("ep-body").textContent));
      Game.ui.openNotebook();
      check("notebook records the find", !!document.querySelector("#nb-" + sym + ".found"));
      check("notebook is not saved between visits", localStorage.getItem("deepElements_notebook") === null);
      Game.ui.closeNotebook();
      check("clock untouched by collecting", s.levelTime === t0);
    });

    test("quiz", function() {
      Game.map.start(2);
      var right = null, wrong = null;
      for (var k in s.triviaMap) { if (s.triviaMap[k] === s.triviaAnswer) right = cellOf(k); else if (!wrong) wrong = cellOf(k); }
      var t0 = s.levelTime; stepOnto(wrong.x, wrong.y);
      check("wrong pad costs time, not the level", s.running && t0 - s.levelTime === QUIZ_PENALTY_SECONDS, t0 - s.levelTime);
      stepOnto(right.x, right.y);
      var doors = 0; s.grid.forEach(function(r) { r.forEach(function(t) { if (t === T.LOGIC_DOOR) doors++; }); });
      check("right pad opens the logic doors", doors === 0 && s.triviaAnswer === "");
    });

    test("inventory and restart", function() {
      Game.map.start(3); s.inventory[0] = 2;
      Game.loop.requestRestart();
      check("restart asks first", s.paused && s.restartArmed && s.inventory[0] === 2);
      Game.loop.requestRestart();
      check("confirmed restart resets the inventory", !s.paused && s.inventory[0] === 0);
      s.inventory[1] = 3; Game.map.start(5);
      check("inventory does not carry between missions", s.inventory[1] === 0);
    });

    test("quiz pads are dealt afresh", function() {
      var seats = {}, complete = 0, keys0 = null;
      for (var n = 0; n < 30; n++) {
        Game.map.start(2);
        var ks = Object.keys(s.triviaMap), dealt = ks.map(function(k) { return s.triviaMap[k]; }).sort().join(",");
        if (keys0 === null) keys0 = dealt;
        var onPads = ks.filter(function(k) { return s.triviaMap[k] === s.triviaAnswer; });
        if (ks.length === 4 && dealt === keys0 && onPads.length === 1) { complete++; seats[onPads[0]] = true; }
      }
      check("every load deals the same four answers, the right one among them", complete === 30, complete + " of 30");
      check("the right answer changes pad between loads", Object.keys(seats).length > 1, Object.keys(seats).join(" "));
      check("a wrong pad costs half a minute", QUIZ_PENALTY_SECONDS === 30, QUIZ_PENALTY_SECONDS);
    });

    test("supply-risk levels", function() {
      var critical = Object.keys(ALL_ELEMENTS).filter(function(k) { return /CRITICAL$/.test(ALL_ELEMENTS[k].riskLabel); });
      var own = critical.filter(function(k) { return Game.ui.riskExplain(ALL_ELEMENTS[k]) === RISK_EXPLAIN.critical; });
      check("critical supply risk has its own explanation", critical.length === 10 && own.length === 10 && !!RISK_EXPLAIN.critical && RISK_EXPLAIN.critical !== RISK_EXPLAIN.high, critical.length + "/" + own.length);
      check("the other levels keep theirs", Game.ui.riskExplain(ALL_ELEMENTS.Cu) === RISK_EXPLAIN[ALL_ELEMENTS.Cu.risk]);
    });

    test("mission order", function() {
      var names = [];
      [0, 7, 17, 20].forEach(function(i) { Game.map.start(i); names.push(s.levelName + " @ " + Game.map.mineInfo(i).mine); });
      check("each mission keeps its mine", names.join("; ") === "Circuit Board @ Chuquicamata; Smartphone @ Bisie Mine; Fibre Optics @ Red Dog Mine; Gotthard Base Tunnel @ Gotthard Base Tunnel", names.join("; "));
      var rank = { easy: 0, medium: 1, hard: 2 }, falls = [];
      for (var i = 1; i < 20; i++) if (rank[Game.map.difficultyLabel(i)] < rank[Game.map.difficultyLabel(i - 1)]) falls.push(i + 1);
      check("missions 1 to 20 never step down a difficulty label", falls.length === 0, "steps down at mission " + falls.join(","));
      Game.map.start(17); var hard = s.difficulty; Game.map.start(0); var easy = s.difficulty; Game.map.start(7); var pinned = s.difficulty;
      check("difficulty follows the map label", hard === 7 && easy === 1, hard + "/" + easy);
      check("a level's own difficulty overrides the label", Game.map.difficultyLabel(7) === "medium" && pinned === 1, pinned);
    });

    test("saved stars follow their mines", function() {
      var PK = "deepElements_missionProgress", OK = "deepElements_missionOrder";
      localStorage.removeItem(OK);
      localStorage.setItem(PK, JSON.stringify({ "0": { stars: 2, score: 111 }, "1": { stars: 1, score: 222 }, "14": { stars: 3, score: 333 }, "25": { stars: 1, score: 444 } }));
      var count = Game.map.completedCount(), p = JSON.parse(localStorage.getItem(PK));
      check("progress saved under the old order moves to the new numbers", count === 4 && p["7"] && p["7"].score === 111 && p["17"] && p["17"].score === 222 && p["8"] && p["8"].score === 333 && p["25"] && p["25"].score === 444 && !p["0"] && !p["1"] && !p["14"], JSON.stringify(p));
      Game.map.completedCount();
      check("the move happens once", localStorage.getItem(PK) === JSON.stringify(p) && localStorage.getItem(OK) === "2");
      localStorage.removeItem(PK);
    });

    test("refuge checkpoint", function() {
      Game.map.start(20);
      var rc = cellOf(Object.keys(s.refugeCells)[0]), ck = Object.keys(s.components)[0];
      s.grid[s.playerY][s.playerX] = T.EMPTY; s.playerX = rc.x - 1; s.playerY = rc.y; s.grid[rc.y][rc.x - 1] = T.PLAYER;
      Game.loop.movePlayer(1, 0);
      check("entering a refuge saves a checkpoint", !!s.checkpoint);
      s.components[ck].have = s.components[ck].need; s.rollingBarrels.push({ x: 3, y: 3, dx: 1 });
      window.respawnAtRefuge();
      check("respawn restores components and barrels", s.components[ck].have === 0 && s.rollingBarrels.length === 0 && s.running);
      s.playerOnGas = true; s.inRefuge = false;   // as the miner is left after dying in gas
      window.respawnAtRefuge();
      check("respawn leaves the gas behind", s.playerOnGas === false && s.inRefuge === true, s.playerOnGas + "/" + s.inRefuge);
    });

    test("hard missions have a refuge the miner can reach", function() {
      var hard = [];
      for (var i = 0; Game.map.difficultyLabel(i); i++) if (Game.map.difficultyLabel(i) === "hard") hard.push(i);
      check("thirteen missions are labelled hard", hard.length === 13, hard.join(","));
      var none = [], cut = [], unsaved = [];
      hard.forEach(function(i) {
        s.mode = "custom"; window.startLevel(i);
        var cells = Object.keys(s.refugeCells), name = (i + 1) + " " + s.levelName;
        if (cells.length < 5) { none.push(name); return; }
        // everything the miner can walk or dig to without moving a boulder or blasting ice;
        // basalt crumbles and key doors open, so both count as a way through
        var open = {}, queue = [[s.playerX, s.playerY]], seen = {}, solid = [T.WALL, T.ROCK, T.REFUGE_POST, T.BOULDER, T.HAZARD, T.ICE, T.LAVA, T.LAVA_SRC, T.WATER_SRC, T.GAS_SRC, T.LOGIC_DOOR, T.SPIDER_NEST];
        seen[s.playerY + "," + s.playerX] = true;
        while (queue.length) {
          var q = queue.pop();
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function(d) {
            var x = q[0] + d[0], y = q[1] + d[1], k = y + "," + x;
            if (seen[k] || !s.grid[y] || s.grid[y][x] === undefined || solid.indexOf(s.grid[y][x]) >= 0) return;
            seen[k] = true; open[k] = true; queue.push([x, y]);
          });
        }
        if (!cells.every(function(k) { return open[k]; })) cut.push(name);
        var entered = cells.some(function(k) { var c = cellOf(k); try { stepOnto(c.x, c.y); return s.playerX === c.x && s.playerY === c.y; } catch (e) { return false; } });
        if (!entered || !s.checkpoint || !s.inRefuge) unsaved.push(name);
      });
      check("every hard mission has a refuge", none.length === 0, none.join("; "));
      check("every refuge floor can be walked to from the start", cut.length === 0, cut.join("; "));
      check("stepping in saves a checkpoint", unsaved.length === 0, unsaved.join("; "));
    });

    test("hidden elements survive blasts", function() {
      Game.map.start(2);
      var k = Object.keys(s.hiddenElementMap).filter(function(kk) { var c = cellOf(kk); return Math.abs(c.x - s.playerX) + Math.abs(c.y - s.playerY) > 4; })[0], c = cellOf(k), sym = s.hiddenElementMap[k];
      Game.physics.detonateDynamite(c.x, c.y);
      check("hidden element survives a blast without the Geiger", s.grid[c.y][c.x] === T.HIDDEN_ELEM && s.hiddenElementMap[k] === sym);
      s.activeEffects.geiger = 5; Game.physics.detonateDynamite(c.x, c.y);
      check("blast with the Geiger collects it", !s.hiddenElementMap[k]);
    });

    test("shared levels are sanitised", function() {
      sharedLevel({ enemies: [{ type: "dragon", x: 3, y: 3 }, { type: "bat", x: 5, y: 5 }, { type: "bat", x: 2.5, y: 2 }], elements: [{ key: "Cu", x: 5, y: 2 }, { key: "Xx", x: 6, y: 2 }], timer: -5 });
      check("unknown enemies, elements and bad timers are dropped", s.mode === "shared" && s.enemies.length === 1 && s.totalElements === 1 && s.levelTime > 0, s.enemies.length + "/" + s.totalElements + "/" + s.levelTime);
      Game.enemies.moveAll(); Game.enemies.moveAll();
      document.getElementById("share-input").value = "{not json";
      window.playSharedLevel();
      check("invalid code is refused with a message", document.getElementById("share-error").textContent.length > 0);
      window.hideSharedLevelDialog();
    });

    test("pasted level text stays text", function() {
      var shareError = document.getElementById("share-error");
      sharedLevel({ elements: [{ key: "Cu", x: 9, y: 2 }], triviaAnswer: "Cu", triviaTrap: "Fe",
        triviaQuestion: "Which? <b id=\"smoke-injected\">x</b>",
        pads: [{ x: 3, y: 3, key: "Fe" }, { x: 4, y: 3, key: "<b id=\"smoke-pad\">x</b>" }] });
      Game.loop.movePlayer(1, 0);   // the wrong pad: its banner quotes the question
      check("markup in a pasted quiz question is shown as text", !document.getElementById("smoke-injected") && document.getElementById("tutorial-hint").innerHTML.indexOf("&lt;b id=") !== -1);
      check("an answer pad that names no element is dropped", Object.keys(s.triviaMap).length === 1, Object.keys(s.triviaMap).length);
      Game.ui.hideHint();

      var cells = []; for (var i = 0; i < 116; i++) cells.push(0);   // 14.5 x 8
      shareError.textContent = "";
      sharedLevel({ cols: 14.5, grid: cells });
      check("a fractional level size is refused", shareError.textContent.length > 0);
      shareError.textContent = "";
      sharedLevel({ scenario: 1.5 });
      check("a fractional scenario falls back to Free Play", s.running && s.scenario.name === "Free Play" && shareError.textContent === "", s.scenario && s.scenario.name);

      var W = 14, H = 8, g = [];
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) g.push(x === 0 || y === 0 || x === W - 1 || y === H - 1 ? T.WALL : T.EMPTY);
      g[(H - 1) * W + 4] = T.TBM;
      sharedLevel({ grid: g });
      Game.machines.tickTBMs();
      check("a tunnel machine on the last row is left out", s.running && s.tbms.length === 0, s.tbms.length);
      window.hideSharedLevelDialog();
    });

    test("Endless Depths", function() {
      Game.map.start(0);
      var missionHasQuiz = !!s.triviaQuestion && Object.keys(s.triviaMap).length > 0;
      window.beginGame("random");
      check("a mission's quiz does not follow into Endless Depths", missionHasQuiz && s.triviaQuestion === "" && s.triviaAnswer === "" && Object.keys(s.triviaMap).length === 0 && !s.triviaPos);
      var short = 0;
      for (var n = 0; n < 25; n++) { Game.loop.startLevel(40); if (Object.keys(s.elementMap).length !== 9 || s.totalElements !== 9) short++; }
      check("a very deep mine still holds all nine elements", short === 0, short + " of 25 short at depth 41");
      var crowd = function(lv) { Game.loop.startLevel(lv); return s.enemies.length; };
      var d13 = crowd(12), d20 = crowd(19), d28 = crowd(27), d60 = crowd(59);
      check("the deep mines go on filling with creatures", d13 === 21 && d20 > d13 && d28 > d20 && d28 === 32 && d60 === d28, [d13, d20, d28, d60].join("/"));
    });

    test("no developer shortcut", function() {
      Game.map.start(0);
      key("keydown", "n"); key("keyup", "n");
      check("the N key does not skip a mission", s.mode === "custom" && s.level === 0, s.level);
    });

    test("winning opens the notebook", function() {
      Game.map.start(4); collectAll(); s.levelTime = 150; Game.loop.gameOver(true);
      var nb = document.getElementById("notebook-overlay");
      check("win screen is the open notebook with a result note", !nb.classList.contains("hidden") && nb.classList.contains("win-mode") && !!document.querySelector(".nb-postit h3"));
      check("this level's finds are starred", document.querySelectorAll(".nb-cell.fresh").length === 9);
      check("mission progress is recorded", Game.map.completedCount() === 1);
      var next = Game.map.nextUnfinished(4); Game.map.start(next);
      check("a next-step button closes the notebook and starts play", nb.classList.contains("hidden") && s.running);
      window.beginGame("random"); collectAll(); s.levelTime = 40; Game.loop.gameOver(true);
      window.pushLuckAndContinue(1);
      check("endless continues to the next depth", s.running && s.level === 1 && s.pushingLuck);
    });

    test("endless: the score runs on, and the deepest depth is kept", function() {
      try { localStorage.removeItem("deepElements_highscores"); localStorage.removeItem("deepElements_bestDepth"); } catch (e) {}
      window.beginGame("random"); Game.loop.clearIntervals();
      check("a new game starts at nothing", s.score === 0 && s.level === 0);
      collectAll(); s.levelTime = 40; Game.loop.gameOver(true);
      var first = s.score;
      check("clearing depth 1 is the deepest so far", Game.ui.bestDepth() === 1, Game.ui.bestDepth());
      window.stashAndContinue(1); Game.loop.clearIntervals();
      check("the score carries to depth 2", s.level === 1 && s.score === first && first > 0, s.score);
      s.score += 500;
      window.startLevel(1); Game.loop.clearIntervals();
      check("retrying a depth goes back to the score it began with", s.score === first, s.score);
      collectAll(); s.levelTime = 40; Game.loop.gameOver(true);
      var rows = Game.ui.getScores().filter(function(o) { return /^Depth /.test(o.where); });
      check("one game is one row on the board, at its best", rows.length === 1 && rows[0].score === s.score && rows[0].depth === 2, JSON.stringify(rows));
      check("the deepest depth is 2", Game.ui.bestDepth() === 2);
      Game.ui.showMenu(); Game.ui.updateMenuProgress();
      check("the menu shows it", /depth 2/.test(document.getElementById("mc-prog-endless").textContent), document.getElementById("mc-prog-endless").textContent);
      window.beginGame("random"); Game.loop.clearIntervals();
      check("the next game starts at nothing again", s.score === 0);
      collectAll(); s.levelTime = 40; Game.loop.gameOver(true);
      check("a shallower game leaves the record alone, and gets its own row", Game.ui.bestDepth() === 2 &&
        Game.ui.getScores().filter(function(o) { return /^Depth /.test(o.where); }).length === 2, JSON.stringify(Game.ui.getScores()));
      Game.map.start(0); Game.loop.clearIntervals();
      check("a mission starts at nothing", s.score === 0);
    });

    test("losing shows the death card", function() {
      Game.map.start(4); s.score = 50;
      Game.ui.showGameOverUI(false, "gas");
      var card = document.getElementById("overlay-card");
      check("death card names the cause and offers a retry", /GASSED/.test(card.textContent) && /TRY AGAIN/.test(card.textContent));
      window.startLevel(s.level);
    });

    test("documents render", function() {
      Game.ui.openDoc("guide");
      var d = document.getElementById("doc-body");
      check("teacher's guide renders headings, a table and lists", d.querySelectorAll("h2").length > 8 && d.querySelectorAll("tr").length > 10 && d.querySelectorAll("li").length > 20 && !/\*\*/.test(d.textContent));
      Game.ui.openDoc("sources");
      check("sources render with links", d.querySelectorAll("a").length > 5);
      Game.ui.closeDoc();
      d.innerHTML = Game.ui.renderMarkdown("Intro\n\n<!-- a note -->\n\n<!-- survey https://example.org/s https://example.org/embed -->");
      check("comments are hidden and the survey waits for a click", !/note/.test(d.textContent) && !d.querySelector("iframe") && !!d.querySelector('[data-action="loadSurvey"]'));
      d.querySelector('[data-action="loadSurvey"]').click();
      var f = d.querySelector("iframe");
      check("clicking shows the survey in the page", !!f && f.src === "https://example.org/embed");
      d.innerHTML = "";
    });

    test("buttons are wired through data-action", function() {
      Game.ui.showMenu();
      document.querySelector('[data-action="showMenuTab"][data-arg="guide"]').click();
      check("a menu tab button switches tab", document.getElementById("menu-guide").classList.contains("active"));
      document.querySelector('[data-action="openNotebook"]').click();
      check("the notebook button opens the notebook", !document.getElementById("notebook-overlay").classList.contains("hidden"));
      document.querySelector('[data-action="closeNotebook"]').click();
      check("its close button closes it", document.getElementById("notebook-overlay").classList.contains("hidden"));
      Game.map.start(4); Game.loop.togglePause();
      document.querySelector('.pause-btns [data-action="requestRestart"]').click();
      check("a button inside the pause overlay does only its own action", s.paused && s.restartArmed);
      document.querySelector('.pause-btns [data-action="togglePause"]').click();
      check("resume button resumes", !s.paused);
      var missing = [];
      Array.prototype.forEach.call(document.querySelectorAll("[data-action]"), function(el) { missing.push(el.getAttribute("data-action")); });
      check("no inline onclick attributes remain", document.querySelectorAll("[onclick]").length === 0, document.querySelectorAll("[onclick]").length);
    });

    test("lessons: the mine waits while a hint is read", function() {
      function lesson(i) { s.mode = "tutorial"; window.startLevel(i); Game.loop.clearIntervals(); }
      function quiet() { s.tutorialHints.forEach(function(h) { h.fired = true; }); }
      lesson(0);
      var now = Date.now(), first = s.tutorialHints[0], banner = document.getElementById("tutorial-hint");
      check("the welcome hint holds the mine for as long as its text takes to read",
        Game.loop.mineWaits(now) && s.hintHoldUntil - s.hintHoldFrom === Game.ui.hintReadMs(first) && Game.ui.hintReadMs(first) > HINT_READ_BASE_MS,
        (s.hintHoldUntil - s.hintHoldFrom) + " / " + Game.ui.hintReadMs(first));
      check("a longer hint is held longer", Game.ui.hintReadMs({ text: "one <strong>two</strong> three four" }) === HINT_READ_BASE_MS + 4 * HINT_READ_MS_PER_WORD);
      quiet();
      Game.loop.movePlayer(-1, 0);
      check("a miner who walks on is not held up", !Game.loop.mineWaits(Date.now()) && s.hintHoldUntil > 0);
      check("the mine waits again once they stand still", Game.loop.mineWaits(s.lastActionAt + HINT_IDLE_MS));
      s.mineWaiting = true; Game.ui.setHintWaiting(true);
      check("the banner and the clock say that the mine is waiting", banner.classList.contains("waiting") && document.getElementById("mh-clock").textContent === "⏸");
      s.hintHoldFrom = Date.now();
      Game.loop.movePlayer(-1, 0);
      check("a step straight after the hint appeared does not end the wait", s.hintHoldUntil > 0);
      s.hintHoldFrom = Date.now() - HINT_MIN_HOLD_MS;
      Game.loop.movePlayer(-1, 0);
      check("the first step after a wait ends it", s.hintHoldUntil === 0 && !Game.loop.mineWaits(Date.now() + HINT_IDLE_MS));
      s.mineWaiting = false; Game.ui.setHintWaiting(false);
      check("the cue goes when the mine moves again", !banner.classList.contains("waiting") && document.getElementById("mh-clock").textContent !== "⏸");

      lesson(0); quiet();
      s.inventory[PU.LAMP] = 1; s.hintHoldFrom = Date.now();
      Game.loop.usePowerup(PU.LAMP);
      check("using a tool always ends the wait", s.hintHoldUntil === 0);

      var realConfirm = window.confirm;
      window.confirm = function() { return true; };
      try { Game.ui.resetNotebook(); } finally { window.confirm = realConfirm; }
      Game.ui.closeNotebook();
      lesson(0); quiet(); s.hintHoldUntil = 0;
      var k = Object.keys(s.elementMap)[0], c = cellOf(k);
      Game.loop.collectElement(s.elementMap[k], c.x, c.y);
      check("the card of a newly found element holds the mine too", s.readFreeze === READ_FREEZE_SECONDS && s.hintHoldUntil - s.hintHoldFrom === READ_FREEZE_SECONDS * 1000, s.readFreeze + " / " + (s.hintHoldUntil - s.hintHoldFrom));

      scene([], { hints: [{ x: 4, y: 3, r: 1, title: "A HINT", text: "Some words to read." }] });
      check("a shared level shows its hint but is never held", banner.classList.contains("visible") && s.hintHoldUntil === 0 && !Game.loop.mineWaits(Date.now()));
      Game.ui.hideHint();
    });

    test("creatures that lie in wait", function() {
      // the third creature has no flag; it is penned in a corner so that it cannot wander up to the miner
      scene([[1, 4, T.ROCK], [2, 5, T.ROCK], [2, 6, T.ROCK]], { enemies: [{ type: "snake", x: 11, y: 6, wait: true }, { type: "spider", x: 12, y: 1, wait: true }, { type: "snake", x: 1, y: 6 }] });
      var snake = s.enemies[0], spider = s.enemies[1], rover = s.enemies[2];
      var roamed = false;
      for (var i = 0; i < 30; i++) { Game.enemies.moveAll(); if (rover.x !== 1 || rover.y !== 6) roamed = true; }
      check("a waiting creature stays where the level put it", snake.x === 11 && snake.y === 6 && snake.state === AI_IDLE && spider.x === 12 && spider.y === 1 && spider.state === AI_IDLE,
        snake.x + "," + snake.y + " " + snake.state + " / " + spider.x + "," + spider.y + " " + spider.state);
      check("a creature without the flag roams as before", roamed, rover.x + "," + rover.y);
      rover.alive = false;
      Game.enemies.triggerTremor(4, 3);
      Game.enemies.moveAll(); Game.enemies.moveAll();
      check("a waiting spider comes when it feels a tremor", spider.state === AI_CHASE && (spider.x !== 12 || spider.y !== 1), spider.state + " " + spider.x + "," + spider.y);
      check("the tremor does not wake the snake", snake.state === AI_IDLE);
      spider.alive = false;
      stepOnto(9, 6);
      Game.enemies.moveAll();
      check("a waiting snake wakes when the miner comes close", snake.state !== AI_IDLE, snake.state);
    });

    test("spiders feel digging from afar, a pick-up only close by", function() {
      // distances to the spider at (12,1), in steps: the keys 6 and 5, the lamp 5, the copper 4, the earth 15
      scene([[7, 2, T.KEY], [8, 2, T.KEY], [1, 5, T.EARTH]], { enemies: [{ type: "spider", x: 12, y: 1, wait: true }], elements: [{ x: 9, y: 2, key: "Cu" }], powerups: [{ x: 10, y: 4, type: PU.LAMP }] });
      var spider = s.enemies[0];
      function felt() { var woke = spider.state === AI_CHASE; spider.state = AI_IDLE; return woke; }
      check("the two tremor distances", TREMOR_RADIUS === 15 && PICKUP_TREMOR_RADIUS === 5);
      stepOnto(7, 2);
      check("a key picked up six tiles away is not felt", s.keysCollected === 1 && !felt(), s.keysCollected);
      stepOnto(8, 2);
      check("a key picked up five tiles away is", s.keysCollected === 2 && felt(), s.keysCollected);
      stepOnto(10, 4);
      check("so is a tool", s.inventory[PU.LAMP] === 1 && felt(), s.inventory[PU.LAMP]);
      stepOnto(9, 2);
      check("and an element", s.collected.indexOf("Cu") >= 0 && felt(), s.collected.join(","));
      stepOnto(2, 5);
      check("a footstep is never felt", pos() === "2,5" && !felt(), pos());
      Game.loop.movePlayer(-1, 0);
      check("earth dug fifteen tiles away is felt", pos() === "1,5" && felt(), pos());
    });

    test("tutorial 3: the bat is shut out, and the spider sleeps until the plug is dug", function() {
      s.mode = "tutorial"; window.startLevel(2); Game.loop.clearIntervals();
      function who(type) { return s.enemies.filter(function(e) { return e.type === type; })[0]; }
      function walk(dx, dy, n) { for (var i = 0; i < n; i++) { Game.loop.movePlayer(dx, dy); Game.physics.applyGravity(); Game.enemies.moveAll(); } }
      var bat = who("bat"), spider = who("spider"), snake = who("snake"), crab = who("crab");
      check("all four creatures lie in wait at the start", [bat, spider, snake, crab].every(function(e) { return e && e.state === AI_IDLE; }));
      walk(1, 0, 9);
      check("the bat sleeps while the miner walks the gallery", pos() === "11,2" && bat.state === AI_IDLE && bat.x === 14 && bat.y === 6, pos() + " bat " + bat.state + " at " + bat.x + "," + bat.y);
      walk(1, 0, 1);
      check("it wakes as the miner reaches the earth under the boulder", pos() === "12,2" && bat.state !== AI_IDLE, pos() + " " + bat.state);
      check("the boulder rests on the earth", at(13, 1) === T.BOULDER && at(13, 2) === T.EARTH);
      walk(1, 0, 2);
      check("the boulder falls in behind the miner", pos() === "14,2" && at(13, 2) === T.BOULDER && s.running, pos() + " " + at(13, 2));
      walk(1, 0, 2);
      check("the copper is taken", pos() === "16,2" && s.collected.indexOf("Cu") >= 0, pos() + " " + s.collected.join(","));
      for (var i = 0; i < 60; i++) Game.enemies.moveAll();
      check("the bat cannot reach the miner past the boulder", s.running && !s.deathAnim && bat.alive && (bat.x < 13 || bat.y === 6), "bat at " + bat.x + "," + bat.y);
      check("picking up the copper does not wake the spider", spider.state === AI_IDLE && spider.x === 4 && spider.y === 9, spider.state);
      walk(0, 1, 6); walk(-1, 0, 6);          // each of the two webs takes a step to cut
      check("nor does walking through its webs", pos() === "12,8" && spider.state === AI_IDLE, pos() + " " + spider.state);
      walk(0, 1, 4);
      check("digging the plug brings it", pos() === "12,12" && spider.state === AI_CHASE, pos() + " " + spider.state);
      check("the snake still waits", snake.state === AI_IDLE && s.running && !s.deathAnim, snake.state);
    });

    test("menu", function() {
      Game.ui.showMenu(); window.showMenuTab("guide");
      check("menu shows with all five entry cards", document.querySelectorAll("#menu-overlay .mode-card").length === 5 && !document.getElementById("menu-overlay").classList.contains("hidden"));
      window.showMenuTab("scores"); window.showMenuTab("howto");
    });
  }

  // Timed tests: real key events over real frames
  function asyncTests(done) {
    function hold(ms, cb) {
      var x0 = s.playerX; key("keydown", "ArrowRight");
      setTimeout(function() { key("keyup", "ArrowRight"); setTimeout(function() { cb(s.playerX - x0); }, 260); }, ms);
    }
    // A lesson with its timers running: the clock stands still while the welcome hint is read
    function waitingMine(next) {
      try {
        s.mode = "tutorial"; window.startLevel(0);
        s.tutorialHints.forEach(function(h) { h.fired = true; });
        var t0 = s.levelTime;
        setTimeout(function() {
          check("in a lesson the clock stands still while the welcome hint is read",
            s.levelTime === t0 && s.mineWaiting && document.getElementById("tutorial-hint").classList.contains("waiting"), s.levelTime + " of " + t0 + ", waiting " + s.mineWaiting);
          s.hintHoldFrom = Date.now() - HINT_MIN_HOLD_MS;
          Game.loop.movePlayer(-1, 0);
          setTimeout(function() {
            check("and runs again after the miner's first step", s.levelTime < t0 && !s.mineWaiting && !document.getElementById("tutorial-hint").classList.contains("waiting"), s.levelTime + " of " + t0 + ", waiting " + s.mineWaiting);
            Game.loop.clearIntervals();
            next();
          }, 2300);
        }, 1700);
      } catch (e) { check("waiting mine test", false, e); next(); }
    }
    waitingMine(runList);
    function runList() {
    try {
      window.beginGame("elementrun");
      setTimeout(function() {
        var ov = document.getElementById("run-overlay");
        check("the Element Runs card opens the list of runs", !ov.classList.contains("hidden") && document.querySelectorAll("#run-list .run-choice").length === 3);
        document.querySelectorAll("#run-list .run-choice")[2].click();
        setTimeout(function() {
          check("choosing a run starts it", ov.classList.contains("hidden") && s.running && s.mode === "elementrun" && s.level === 2 && s.totalElements === 94, s.mode + "/" + s.level);
          timedInput();
        }, 60);
      }, 60);
    } catch (e) { check("run list tests", false, e); timedInput(); }
    }
    function timedInput() {
    try {
      // Under Chrome's virtual time the timestamp handed to an animation frame runs on the real clock,
      // hundreds of milliseconds away from performance.now(), which the timers here follow. The game
      // times its steps by both, so give the frames the same clock as everything else.
      var realFrame = window.requestAnimationFrame;
      window.requestAnimationFrame = function(cb) { return realFrame.call(window, function() { cb(performance.now()); }); };
      var W = 40, H = 8, g = [];
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) g.push(x === 0 || y === 0 || x === W - 1 || y === H - 1 ? 7 : 0);
      document.getElementById("share-input").value = JSON.stringify({ cols: W, rows: H, grid: g, scenario: 15, player: { x: 2, y: 3 }, exit: { x: 38, y: 6 }, timer: 999 });
      window.playSharedLevel();
      // well inside the 150 ms first-step pause, so timer jitter cannot add a second step
      hold(60, function(a) {
        check("a tap is exactly one step", a === 1, a);
        hold(600, function(b) {
          check("a held key keeps walking", b >= 5 && b <= 7, b);
          frame(); var c1 = s.camSmoothX;
          setTimeout(function() {
            frame();
            check("the camera is still once the miner stops", s.camSmoothX === c1);
            var btn = document.querySelector('.dpad-btn[data-key="ArrowLeft"]'), x0 = s.playerX;
            btn.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 3, pointerType: "touch", bubbles: true, cancelable: true }));
            setTimeout(function() {
              btn.dispatchEvent(new PointerEvent("pointerup", { pointerId: 3, pointerType: "touch", bubbles: true }));
              check("holding the D-pad keeps walking", x0 - s.playerX >= 3, x0 - s.playerX);
              done();
            }, 450);
          }, 120);
        });
      });
    } catch (e) { check("timed input tests", false, e); done(); }
    }
  }

  window.addEventListener("load", function() {
    setTimeout(function() {
      try { syncTests(); } catch (e) { check("test run", false, e); }
      asyncTests(function() {
        check("no uncaught script errors", errors.length === 0, errors.join(" ; "));
        var out = document.createElement("pre");
        out.id = "TEST-RESULTS";
        // one line per check: "ok    name" or "FAIL  name  - detail"
        out.textContent = "\n" + results.map(function(r) { return (r.pass ? "ok    " : "FAIL  ") + r.name + (r.pass || !r.detail ? "" : "  -- " + r.detail); }).join("\n") + "\n";
        document.body.appendChild(out);
      });
    }, 500);
  });
})();
