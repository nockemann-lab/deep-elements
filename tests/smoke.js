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

    // ── The six lessons. `lessonStart` starts one with its timers stopped and the reading
    //    hold over; `route("R6 U1")` walks it step by step (a wading step takes two tries). ──
    function lessonStart(i) { s.mode = "tutorial"; window.startLevel(i); Game.loop.clearIntervals(); s.hintHoldUntil = 0; }
    function route(legs) {
      legs.split(" ").forEach(function(leg) {
        var d = { R: [1, 0], L: [-1, 0], U: [0, -1], D: [0, 1] }[leg[0]], n = +leg.slice(1);
        for (var i = 0; i < n; i++) {
          var want = (s.playerX + d[0]) + "," + (s.playerY + d[1]);
          for (var tries = 0; tries < 3 && pos() !== want && s.running; tries++) Game.loop.movePlayer(d[0], d[1]);
          if (pos() !== want) throw new Error("stuck at " + pos() + " on leg " + leg + " of " + legs);
        }
      });
    }
    function tiles(tile) { var n = 0; for (var y = 0; y < s.rows; y++) for (var x = 0; x < s.cols; x++) if (s.grid[y][x] === tile) n++; return n; }
    function got(key) { return s.collected.indexOf(key) !== -1; }
    function cardText() { return document.getElementById("overlay-card").textContent; }
    function pauseText() { Game.loop.togglePause(); var t = document.querySelector("#pause-overlay .pause-card").textContent; Game.loop.togglePause(); return t; }
    // elements found in a lesson are forgotten again: later tests expect an empty notebook
    function forgetNotebook() { var ask = window.confirm; window.confirm = function() { return true; }; try { Game.ui.resetNotebook(); Game.ui.closeNotebook(); } finally { window.confirm = ask; } }

    test("lessons: nothing flows before the miner acts, and every part sets a task", function() {
      var P = Game.physics, moved = [], untasked = [], graded = [], i;
      function fluids() { return [tiles(T.WATER), tiles(T.LAVA), tiles(T.GAS), Object.keys(s.waterLevel).length, Object.keys(s.lavaLevel).length, Object.keys(s.gasLevel).length, solids()].join("/"); }
      // where every boulder, barrel and block of ice is: none may fall, roll or be blown up unprompted
      function solids() { var p = []; for (var y = 0; y < s.rows; y++) for (var x = 0; x < s.cols; x++) { var t = s.grid[y][x]; if (t === T.BOULDER || t === T.HAZARD || t === T.ICE) p.push(t + "@" + x + "," + y); } return p.join(" "); }
      for (i = 0; i < Game.tutorials.getCount(); i++) {
        lessonStart(i);
        var before = fluids();
        for (var k = 0; k < 300; k++) { P.tickWater(); P.tickLava(); P.tickGas(); P.applyGravity(); }
        if (fluids() !== before) moved.push(s.levelName + " " + before + " > " + fluids());
        s.tutorialHints.slice(0, -1).forEach(function(h) { if (!h.task) untasked.push(s.levelName + ": " + h.title); });
        if (s.difficulty !== 0) graded.push(s.levelName + " " + s.difficulty);
      }
      check("no lesson floods, burns, gasses or drops a boulder or barrel while the miner stands still", moved.length === 0, moved.join("; "));
      check("every hint but a lesson's last sets a task", untasked.length === 0, untasked.join("; "));
      check("lessons run at the base difficulty, where the creatures sense as far as the hints say", graded.length === 0, graded.join("; "));
      lessonStart(0);
      var task = document.querySelector("#tutorial-hint .th-task");
      check("the task stands on its own line under the hint", !!task && /^▶ Dig your way east/.test(task.textContent), task && task.textContent);
    });

    test("lessons: a part can be tried again", function() {
      var banner = document.getElementById("tutorial-hint");
      lessonStart(1);                         // lesson 2 opens with a hint that saves
      check("a saving hint takes a checkpoint as it appears", !!s.checkpoint && s.checkpointHint === 0 && s.checkpoint.playerX === 1, s.checkpointHint);
      route("R4");                            // the boulder goes one tile east
      var pushed = at(6, 2) === T.BOULDER;
      check("the pause card offers the part again", /RETRY THIS PART/.test(pauseText()), pauseText());
      Game.ui.showGameOverUI(false, "boulder");
      check("so does the death card, in place of the refuge", /TRY THIS PART AGAIN/.test(cardText()) && !/RESPAWN AT REFUGE/.test(cardText()), cardText());
      Game.ui.hideHint();
      window.respawnAtRefuge(); Game.loop.clearIntervals();
      check("trying again puts the miner and the boulder back and shows the hint again",
        pushed && pos() === "1,2" && at(5, 2) === T.BOULDER && at(6, 2) === T.EMPTY && s.running && banner.classList.contains("visible") && /HEAVY THINGS/.test(banner.textContent),
        pushed + " " + pos() + " " + at(5, 2) + " " + banner.textContent.slice(0, 30));

      // the second saving hint is reached with points in hand and a stick burning
      s.score = 250; s.inventory[PU.DYNAMITE] = 1;
      Game.loop.usePowerup(PU.DYNAMITE);
      stepOnto(10, 1);
      check("a stick still burning goes back into the pack of the saved part", s.checkpointHint === 1 && s.placedDynamite.length === 1 && s.checkpoint.inventory[PU.DYNAMITE] === 1, s.checkpointHint + " " + s.placedDynamite.length);
      s.score = 400;
      window.respawnAtRefuge(); Game.loop.clearIntervals();
      check("a lesson's own checkpoint costs no points", pos() === "10,1" && s.score === 250 && s.inventory[PU.DYNAMITE] === 1 && s.placedDynamite.length === 0, pos() + " " + s.score + " " + s.inventory[PU.DYNAMITE]);

      lessonStart(5);                         // lesson 6 saves only in its refuges
      route("R9");
      check("a hint without the flag saves nothing", !s.checkpoint && /no checkpoint|RESUME/.test(pauseText()) && !/RETRY|REFUGE/.test(pauseText()), pauseText());
      s.score = 300;
      route("D1");
      check("a refuge in a lesson is an ordinary checkpoint", s.inRefuge && !!s.checkpoint && s.checkpointHint === -1, s.checkpointHint);
      route("U1 R3");
      check("the pause card offers the way back to it, at its price", /BACK TO THE REFUGE \(−100\)/.test(pauseText()), pauseText());
      Game.ui.showGameOverUI(false, "gas");
      check("the death card offers the refuge, not a free retry", /RESPAWN AT REFUGE/.test(cardText()) && !/TRY THIS PART AGAIN/.test(cardText()), cardText());
      window.respawnAtRefuge(); Game.loop.clearIntervals();
      check("the respawn costs 100 points", pos() === "11,6" && s.score === 200, pos() + " " + s.score);
      Game.map.start(0); Game.loop.clearIntervals();
      check("a mission's pause card is unchanged", !/RETRY|REFUGE/.test(pauseText()), pauseText());
    });

    test("a barred exit says why, but not on every press", function() {
      lessonStart(0);
      var log = document.getElementById("collection-log");
      function barred() { return (log.innerHTML.match(/stays barred/g) || []).length; }
      var n0 = barred();
      stepOnto(10, 8);
      check("the exit stays shut while elements are missing, and the log says how many",
        s.running && pos() === "10,7" && barred() === n0 + 1 && /<strong>5 elements<\/strong> still in the mine/.test(log.innerHTML), pos() + " " + (barred() - n0));
      Game.loop.movePlayer(0, 1);
      check("a second press straight away adds no second line", barred() === n0 + 1, barred() - n0);
      s.exitBarredAt = Date.now() - 3000;
      Game.loop.movePlayer(0, 1);
      check("a later one does", barred() === n0 + 2 && s.running, barred() - n0);
    });

    test("lesson 3: the creatures wait, and the pushed boulder deals with the bat", function() {
      lessonStart(2);
      function who(type) { return s.enemies.filter(function(e) { return e.type === type; })[0]; }
      var bat = who("bat"), spider = who("spider"), snake = who("snake"), crab = who("crab");
      check("all four creatures lie in wait at the start", [bat, spider, snake, crab].every(function(e) { return e && e.state === AI_IDLE; }));
      route("R15");
      check("the boulder goes down the tunnel ahead of the miner", pos() === "16,2" && at(17, 2) === T.BOULDER && bat.alive && bat.x === 18 && bat.y === 2, pos() + " bat " + bat.x + "," + bat.y);
      Game.loop.movePlayer(1, 0);
      check("pushed into the bat, it flattens it", !bat.alive && s.enemiesKilled === 1 && s.running, bat.alive + " " + pos());
      if (pos() !== "17,2") route("R1");
      route("R2 U1");
      check("the copper in the roof is taken", got("Cu") && pos() === "19,1", pos() + " " + s.collected.join(","));
      route("R3 D1");
      check("the snake's part begins with a checkpoint", s.tutorialHints[2].fired && s.checkpointHint === 2 && snake.state === AI_IDLE, s.checkpointHint + " " + snake.state);
      forgetNotebook();
    });

    test("lesson 1: the aluminium first, and the boulders keep off the miner", function() {
      lessonStart(0);
      var P = Game.physics;
      // a step at a walking pace: the boulders get two falls per move
      function walk(legs) { legs.split(" ").forEach(function(leg) { for (var n = 0; n < +leg.slice(1) && s.running; n++) { route(leg[0] + "1"); P.applyGravity(); P.applyGravity(); } }); }
      walk("D2 R2 D2 R1 D4");
      check("the shaft below the start leads to the aluminium, under undisturbed boulders", got("Al") && s.running && s.tutorialHints[1].fired && s.tutorialHints[2].fired, pos() + " " + s.collected.join(","));
      walk("U4 R2 U3 R1 R1 D2 R4 D1 R4 U3 L2");
      check("indium, then gold round the rock, with the boulders falling behind the miner", got("In") && got("Au") && s.running && s.tutorialHints[3].fired, pos() + " " + s.collected.join(","));
      walk("R2 D2 L6 D3");
      check("the hatch hint waits in the exit chamber", s.tutorialHints[4].fired && pos() === "10,7", pos());
      walk("R2 D1 R5 D4 L4 R4 U4 L5 L1 D1 L1 D2 L8 D2 R2 L2 U2 R8 U2");
      check("neodymium and lithium bring the count to five", s.collected.length === 5 && s.tutorialHints[5].fired && s.running, s.collected.join(","));
      walk("U1");
      check("the hatch opens on all five", !s.running && pos() === "10,8", pos());
      forgetNotebook();
    });

    test("lesson 4: ice needs the stick, the spring drowns the bat, the pump dries the way on", function() {
      var P = Game.physics, M = Game.machines, q;
      lessonStart(3);
      var bat = s.enemies[0];
      route("R1 U1 D1 R1");
      check("the silicon and the stick are taken; ice bars the tunnel", got("Si") && s.inventory[PU.DYNAMITE] === 1 && at(7, 2) === T.ICE, s.inventory[PU.DYNAMITE] + " " + at(7, 2));
      route("R3");
      Game.loop.usePowerup(PU.DYNAMITE);
      route("L2");
      for (q = 0; q < 5 && s.placedDynamite.length; q++) P.tickDynamite();
      check("one stick laid beside the ice breaks it, two tiles away is safe", at(7, 2) === T.EMPTY && s.running && pos() === "4,2", at(7, 2) + " " + pos());
      route("R7");
      check("the pump and a spare stick are picked up, and the spring is still shimmering earth", s.inventory[PU.PUMP] === 1 && s.inventory[PU.DYNAMITE] === 1 && at(11, 3) === T.WATER_SRC && tiles(T.WATER) === 7 && bat.state === AI_IDLE, s.inventory.join("") + " " + tiles(T.WATER));
      route("D2 U2");
      for (q = 0; q < 600 && bat.alive; q++) P.tickWater();
      check("dug open, the spring floods the passage and drowns the bat", !bat.alive && at(15, 5) === T.WATER && s.running && pos() === "11,2", bat.alive + " " + at(15, 5) + " after " + q);
      for (q = 0; q < 300; q++) P.tickWater();
      route("D3 R5 D2");
      Game.loop.movePlayer(1, 0);
      check("a boulder that stands in water will not be pushed", pos() === "16,7" && at(17, 7) === T.BOULDER && s.playerOnWater, pos() + " " + at(17, 7));
      Game.loop.usePowerup(PU.PUMP);
      for (q = 0; q < 80 && !(s.pumps[0] && s.pumps[0].done); q++) M.tickPumps();
      check("the pump, used by the wading miner, seals the spring and drains the whole flood", s.pumps.length === 1 && s.pumps[0].done && tiles(T.WATER) === 0 && tiles(T.WATER_SRC) === 0 && !s.playerOnWater,
        s.pumps.length + " pumps, " + tiles(T.WATER) + " water, " + tiles(T.WATER_SRC) + " springs, wading " + s.playerOnWater);
      route("R1 D1");
      check("on the dry floor the boulder moves off the copper", got("Cu") && pos() === "17,8", pos() + " " + s.collected.join(","));

      // The west part: the barrel on its ledge waits until the miner digs past it, then drops
      // down the shaft and blows the ice box open; the key it held opens the door to the exit.
      s.grid[s.playerY][s.playerX] = T.EMPTY; s.playerX = 8; s.playerY = 14; s.grid[14][8] = T.PLAYER;
      route("U1");
      check("the key hint takes a checkpoint at the foot of the west part", s.tutorialHints[4].fired && s.checkpointHint === 4, s.checkpointHint);
      route("U5 L3 U2");
      for (q = 0; q < 10; q++) P.applyGravity();
      check("with earth dug beside it but the miner still there, the barrel stays on its ledge", at(4, 6) === T.HAZARD && at(5, 9) === T.ICE, at(4, 6) + " " + at(5, 9));
      route("U1");
      for (q = 0; q < 20; q++) P.applyGravity();
      check("once the miner climbs on, it drops and blasts the ice box open, out of the miner's reach", at(4, 6) === T.EMPTY && at(5, 9) === T.EMPTY && s.running && pos() === "5,5", at(4, 6) + " " + at(5, 9) + " " + pos());
      route("L2 R2 D5 R1");
      check("the tellurium and the freed key are taken", got("Te") && s.keysCollected === 1, s.collected.join(",") + " keys " + s.keysCollected);
      route("L1 U1 L2 D3 L1 D2 R1 D2");
      check("the last hint waits at the foot of the gap", s.tutorialHints[5].fired && pos() === "3,16", pos());
      route("R9 R4 R1");
      check("the tin is on the way, and the key opens the door before the exit", got("Sn") && pos() === "17,16" && s.keysCollected === 0, pos() + " keys " + s.keysCollected);

      // The pump is used on a flood that is still spreading: it must stay dry afterwards.
      // (The two walls are taken out by hand here; the part above has dealt with them.
      // The flood has not yet reached the pool round the boulder, whose 7 tiles stay.)
      lessonStart(3);
      s.grid[2][7] = T.EMPTY;
      route("R10 D2 U2");
      for (q = 0; q < 200 && at(13, 5) !== T.WATER; q++) P.tickWater();
      var filling = Object.keys(s.waterLevel).length;
      route("D2");
      Game.loop.usePowerup(PU.PUMP);
      for (q = 0; q < 60; q++) { P.tickWater(); if (q % 3 !== 2) M.tickPumps(); }
      for (q = 0; q < 300; q++) { P.tickWater(); P.applyGravity(); }
      check("a flood pumped while it is still spreading does not come back", pos() === "11,4" && filling > 0 && s.pumps.length === 1 && s.pumps[0].done && tiles(T.WATER) === 7 && at(13, 5) === T.EMPTY && at(11, 3) === T.EMPTY && tiles(T.WATER_SRC) === 0 && Object.keys(s.waterLevel).length === 0,
        pos() + " " + filling + " filling, " + tiles(T.WATER) + " water, " + Object.keys(s.waterLevel).length + " still filling");
      forgetNotebook();
    });

    test("the pump works for a miner who stands in the only water there is", function() {
      scene([[5, 6, T.WATER]]);
      stepOnto(5, 6);
      s.inventory[PU.PUMP] = 1;
      Game.loop.usePowerup(PU.PUMP);
      check("the pump starts although no water lies beside the miner", pos() === "5,6" && s.pumps.length === 1 && s.inventory[PU.PUMP] === 0, pos() + " " + s.pumps.length);
      for (var q = 0; q < 80 && !(s.pumps[0] && s.pumps[0].done); q++) Game.machines.tickPumps();
      check("the miner's own tile is drained with the rest", s.playerOnWater === false && tiles(T.WATER) === 0, s.playerOnWater + " " + tiles(T.WATER));
      Game.loop.movePlayer(-1, 0);
      check("no water is left behind when they walk on", pos() === "4,6" && at(5, 6) === T.EMPTY, pos() + " " + at(5, 6));
    });

    test("lesson 5: the cart flattens the snake and carries the miner over the lava", function() {
      var M = Game.machines, q;
      lessonStart(4);
      var snake = s.enemies[0];
      Game.loop.movePlayer(-1, 0);
      for (q = 0; q < 400; q++) M.tickRollingCarts();
      check("pushed from the start, the cart rolls west into the dead end and the snake lives", at(1, 2) === T.CART && snake.alive && snake.state === AI_IDLE, at(1, 2) + " " + snake.alive);
      window.respawnAtRefuge(); Game.loop.clearIntervals(); s.hintHoldUntil = 0;
      snake = s.enemies[0];                   // the checkpoint brings its own creatures back
      check("trying the part again brings the cart back", at(3, 2) === T.CART && pos() === "4,2" && snake.alive, at(3, 2) + " " + pos());
      route("D1 L3 U1 R1");
      Game.loop.movePlayer(1, 0);
      for (q = 0; q < 400 && snake.alive; q++) M.tickRollingCarts();
      check("pushed from behind, it rolls east and flattens the snake", !snake.alive && s.running, snake.alive + " " + pos());
      for (q = 0; q < 400; q++) M.tickRollingCarts();
      route("R" + (14 - s.playerX) + " D2 R1");
      check("the helium is taken on the way to the lava", got("He") && pos() === "15,4" && at(15, 5) === T.CART && tiles(T.LAVA) === 5, pos() + " " + tiles(T.LAVA));
      Game.loop.movePlayer(0, 1);
      check("stepping down onto the cart boards it", !!s.riding && pos() === "15,5", pos());
      Game.loop.movePlayer(1, 0);
      for (q = 0; q < 400 && s.ridingRoll; q++) M.tickRidingRoll();
      check("it carries the miner over the lava unharmed", s.running && !!s.riding && s.riding.under === T.LAVA && pos() === "20,5", pos() + " running " + s.running);
      Game.loop.movePlayer(0, -1);
      check("and they hop out at the far end", !s.riding && pos() === "20,4" && at(20, 5) === T.CART, pos());
      forgetNotebook();
    });

    test("lesson 6: refuges, the mask, firedamp and the borer", function() {
      var P = Game.physics, M = Game.machines, q;
      function borer() { return s.tbms[0]; }
      function runBorer(until, limit) { for (var i = 0; i < (limit || 4000) && !until(); i++) M.tickTBMs(); return until(); }
      function toTheHall() {
        lessonStart(5);
        route("R9 D1 U1 R8");
        Game.loop.usePowerup(PU.MASK);
        route("U2 L18 U2 R22 D4 D2 L1 R1 D4 L10");
      }
      function burn() { for (var i = 0; i < 5 && s.placedDynamite.length && s.running; i++) P.tickDynamite(); }

      lessonStart(5);
      check("the lesson is dark and asks for four elements", /Tutorial 6/.test(s.levelName) && s.totalElements === 4 && s.baseSight === 5, s.levelName + " / " + s.totalElements + " / " + s.baseSight);
      var gas0 = tiles(T.GAS);
      route("R1");
      Game.loop.usePowerup(PU.LAMP);
      check("the lamp is picked up and burns for 12 s", s.inventory[PU.LAMP] === 0 && s.activeEffects.lamp === 12, s.activeEffects.lamp);
      route("R8 D1");
      check("stepping into the first refuge saves a checkpoint", pos() === "11,6" && s.inRefuge && !!s.checkpoint && s.checkpointHint === -1);
      route("U1 R5");
      check("the mask is picked up", s.inventory[PU.MASK] === 1 && s.tutorialHints[1].fired, s.inventory[PU.MASK]);
      route("R3");
      Game.loop.usePowerup(PU.MASK);
      check("the mask gives 20 s", s.activeEffects.mask === 20, s.activeEffects.mask);
      route("U2");
      check("the miner walks in the gas", pos() === "19,3" && s.playerOnGas === true, pos() + " " + s.playerOnGas);
      route("L18 U2 R22 D2");
      for (q = 0; q < 300; q++) P.tickGas();
      check("the helium lies at the end of the gas galleries, and the gas stays in them", got("He") && pos() === "23,3" && !s.playerOnGas && tiles(T.GAS) === gas0 && gas0 === 51, pos() + " " + tiles(T.GAS));
      route("D4 L1");
      check("the second refuge replaces the first", s.inRefuge && s.checkpoint.playerX === 22 && s.checkpoint.playerY === 7 && s.checkpoint.collected.length === 1, s.checkpoint.playerX + "," + s.checkpoint.playerY);
      route("R1 D4 L10");
      check("the stick is fetched from under the gas", s.inventory[PU.DYNAMITE] === 1 && pos() === "13,11" && !s.playerOnGas && at(13, 10) === T.GAS && s.running, pos());
      route("R7");
      Game.loop.usePowerup(PU.DYNAMITE);
      route("R2");
      burn();
      frame();
      check("lit from the hall's mouth, the firedamp burns away with its vent", s.running && pos() === "22,11" && tiles(T.GAS) === 43 && tiles(T.GAS_SRC) === 0 && at(12, 10) === T.EMPTY, s.running + " " + tiles(T.GAS) + " gas, " + tiles(T.GAS_SRC) + " vents");
      for (q = 0; q < 5; q++) P.tickDynamite();
      check("the stick goes off once", s.running && s.placedDynamite.length === 0, s.placedDynamite.length);
      route("L9 U1 L2 D2");
      check("the way on is open, and the gadolinium is taken", got("Gd") && pos() === "11,12" && s.inventory[PU.LAMP] === 1, pos() + " " + s.collected.join(","));
      runBorer(function() { return false; }, 2400);
      check("the borer stays between its walls, and the shaft above it is safe", borer().floatX >= 4.95 && borer().floatX <= 15.05 && s.running && at(5, 14) === T.ELEMENT, borer().floatX);
      check("the borer passes the shaft heading east", runBorer(function() { return borer().dir > 0 && borer().floatX > 12.2 && borer().floatX < 13; }));
      route("D1 L6 D1");
      check("the titanium is taken from the borer's tunnel", got("Ti") && s.running, s.collected.join(","));
      route("R6 U2");
      check("it passes again heading west", runBorer(function() { return borer().dir < 0 && borer().floatX < 7.8; }) && s.running);
      route("D1 R6 D3 L3");
      check("the iron completes the set", s.collected.length === 4 && s.running, s.collected.join(","));
      route("L4");
      check("the exit ends the lesson with a win", !s.running && !s.deathAnim && !document.getElementById("notebook-overlay").classList.contains("hidden"));
      Game.ui.closeNotebook();

      // lit from inside the hall, the fire reaches the miner; the refuge gives the stick back
      toTheHall();
      route("R2");
      Game.loop.usePowerup(PU.DYNAMITE);
      route("R3");
      burn();
      check("lit from under the gas, the firedamp is fatal", !s.running && s.deathAnim && s.deathAnim.cause === "gasblast", s.running + " " + (s.deathAnim && s.deathAnim.cause));
      s.deathAnim = null; window.respawnAtRefuge(); Game.loop.clearIntervals(); s.hintHoldUntil = 0;
      check("the respawn is at the second refuge, with the helium kept and the stick and the gas back",
        s.running && pos() === "22,7" && got("He") && at(13, 11) === T.POWERUP && s.inventory[PU.DYNAMITE] === 0 && tiles(T.GAS) === 51 && tiles(T.GAS_SRC) === 1,
        pos() + " " + s.collected.join(",") + " " + tiles(T.GAS));

      // a stick laid too far from the gas is wasted; one laid a single step away kills
      route("R1 D4 L10 R9");
      Game.loop.usePowerup(PU.DYNAMITE);
      route("L3");
      burn();
      check("a stick laid three tiles from the gas lights nothing", s.running && tiles(T.GAS) === 51 && s.inventory[PU.DYNAMITE] === 0 && /BACK TO THE REFUGE/.test(pauseText()), tiles(T.GAS));
      window.respawnAtRefuge(); Game.loop.clearIntervals(); s.hintHoldUntil = 0;
      route("R1 D4 L10 R7");
      Game.loop.usePowerup(PU.DYNAMITE);
      route("R2");
      burn();
      route("L9 U1 L2 D2");
      runBorer(function() { return borer().dir > 0 && borer().floatX > 9.5 && borer().floatX < 10.5; });
      Game.loop.movePlayer(0, 1);
      check("stepping into the borer is fatal", !s.running && s.deathAnim && s.deathAnim.cause === "tbm", s.running);
      s.deathAnim = null; window.respawnAtRefuge();
      check("the respawn is again at the second refuge", s.running && pos() === "22,7" && s.collected.length === 1, pos() + " " + s.collected.length);
      Game.loop.clearIntervals();
      forgetNotebook();
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
      check("eleven missions are labelled hard", hard.length === 11, hard.join(","));
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

    test("basalt waits until the miner has seen it", function() {
      scene([[10, 3, T.BASALT]]);
      for (var y = 0; y < s.rows; y++) for (var x = 0; x < s.cols; x++) s.explored[y][x] = false;
      for (var t = 0; t < 30; t++) Game.physics.tickBasalt();
      check("unseen basalt stands for 30 s", at(10, 3) === T.BASALT);
      s.explored[3][10] = true;
      for (t = 0; t < 7; t++) Game.physics.tickBasalt();
      check("seen basalt still stands after 7 s", at(10, 3) === T.BASALT);
      for (t = 0; t < 5; t++) Game.physics.tickBasalt();
      check("and is gone 12 s after it was first seen", at(10, 3) === T.EMPTY, at(10, 3));
    });

    test("a spider nest stops breeding at three live spiders", function() {
      scene([[8, 4, T.SPIDER_NEST]]);
      var real = Math.random; Math.random = function() { return 0; };
      try { for (var t = 0; t < 20; t++) Game.enemies.tickSpiderNests(); } finally { Math.random = real; }
      var mine = s.enemies.filter(function(e) { return e.alive && e.nest === "4,8"; });
      check("three spiders and no more", SPIDER_NEST_MAX === 3 && mine.length === 3 && s.enemies.length === 3, s.enemies.length);
      mine[0].alive = false;
      Math.random = function() { return 0; };
      try { Game.enemies.tickSpiderNests(); } finally { Math.random = real; }
      check("one dies, the nest replaces it", s.enemies.filter(function(e) { return e.alive && e.nest === "4,8"; }).length === 3);
    });

    test("every mission's exit lies behind its quiz door", function() {
      var open = [], noQuiz = [];
      for (var i = 0; i < Game.levels.getCount(); i++) {
        s.mode = "custom"; window.startLevel(i);
        if (!s.triviaQuestion) noQuiz.push(i + 1);
        // flood from the start through everything but walls, rock and the quiz door
        var seen = {}, queue = [[s.playerX, s.playerY]], blocked = [T.WALL, T.ROCK, T.REFUGE_POST, T.LOGIC_DOOR];
        seen[s.playerY + "," + s.playerX] = true;
        while (queue.length) {
          var q = queue.pop();
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function(d) {
            var x = q[0] + d[0], y = q[1] + d[1], k = y + "," + x;
            if (seen[k] || !s.grid[y] || s.grid[y][x] === undefined || blocked.indexOf(s.grid[y][x]) >= 0) return;
            seen[k] = true; queue.push([x, y]);
          });
        }
        // Gotthard's borers cut through rock, so the flood cannot judge it
        if (seen[s.exitY + "," + s.exitX] && s.levelName !== "Gotthard Base Tunnel") open.push(i + 1);
      }
      check("every mission asks a question", noQuiz.length === 0, noQuiz.join(","));
      check("no exit can be reached round the quiz door", open.length === 0, open.join(","));
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
            joystick(done);
          }, 120);
        });
      });
    } catch (e) { check("timed input tests", false, e); done(); }
    }
    // The touch joystick: a thumb pushed some way towards the rim
    function joystick(done) {
      try {
        var joy = document.getElementById("joystick");
        joy.style.display = "block";   // shown only on touch screens; the test page is a desktop one
        function thumb(type, fx, fy) {
          var r = joy.getBoundingClientRect(), rad = r.width / 2;
          joy.dispatchEvent(new PointerEvent(type, { pointerId: 9, pointerType: "touch", bubbles: true, cancelable: true,
            clientX: r.left + rad + fx * rad, clientY: r.top + rad + fy * rad }));
        }
        var x0 = s.playerX, y0 = s.playerY;
        thumb("pointerdown", 0.7, 0);
        // a thumb rests longer than a key is struck: still one step (the test page's
        // timers run late under load, so this stays well inside the 400 ms pause)
        setTimeout(function() {
          thumb("pointerup", 0.7, 0);
          check("a push of the joystick is exactly one step", s.playerX === x0 + 1 && s.playerY === y0, (s.playerX - x0) + "," + (s.playerY - y0));
          var x1 = s.playerX;
          thumb("pointerdown", 0.12, 0.1);
          setTimeout(function() {
            thumb("pointerup", 0.12, 0.1);
            check("a touch near the joystick's middle takes no step", s.playerX === x1);
            thumb("pointerdown", 0.8, 0);
            // a wavering thumb near the diagonal keeps its way
            setTimeout(function() { thumb("pointermove", 0.6, 0.5); }, 200);
            setTimeout(function() {
              thumb("pointerup", 0.6, 0.5);
              var walked = s.playerX - x1;
              check("kept pushed, the joystick walks on at a gentle pace", walked >= 4 && walked <= 10 && s.playerY === y0, walked + " steps, y " + (s.playerY - y0));
              check("the joystick outline is gone once the thumb lifts", s.touchAim === null);
              var x2 = s.playerX;
              setTimeout(function() {
                check("and the miner stops when the thumb lifts", s.playerX === x2, s.playerX - x2);
                var cv = s.canvas, r = cv.getBoundingClientRect(), x3 = s.playerX;
                cv.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 11, pointerType: "touch", bubbles: true, cancelable: true, clientX: r.left + r.width - 20, clientY: r.top + r.height / 2 }));
                setTimeout(function() {
                  cv.dispatchEvent(new PointerEvent("pointerup", { pointerId: 11, pointerType: "touch", bubbles: true, clientX: r.left + r.width - 20, clientY: r.top + r.height / 2 }));
                  check("a finger on the mine itself never moves the miner", s.playerX === x3);
                  joy.style.display = "";
                  done();
                }, 500);
              }, 300);
            }, 1200);
          }, 300);
        }, 180);
      } catch (e) { check("joystick tests", false, e); done(); }
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
