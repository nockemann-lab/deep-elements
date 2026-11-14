"use strict";

// ═══════════════════════════════════════════════════════════════════
// game.js - Main game loop: movement, powerups, level flow, death
// ═══════════════════════════════════════════════════════════════════

(function() {
  var s = Game.state;

  // Every repeating timer of a running level, kept together so that stopping
  // a level can never leave one behind.
  var timers = [];

  function clearIntervals() {
    for (var i = 0; i < timers.length; i++) clearInterval(timers[i]);
    timers = [];
  }

  // Run fn every ms while the level is running, not paused, and not waiting for
  // a hint to be read
  function every(ms, fn) {
    timers.push(setInterval(function() {
      if (!s.running || s.paused) return;
      var waits = mineWaits(Date.now());
      if (waits !== s.mineWaiting) { s.mineWaiting = waits; Game.ui.setHintWaiting(waits); }
      if (!waits) fn();
    }, ms));
  }

  // ─── Lessons: the mine waits while a hint is read (see HINT_* in config.js) ───
  function mineWaits(now) {
    return s.mode === "tutorial" && now < s.hintHoldUntil && now - s.lastActionAt >= HINT_IDLE_MS;
  }

  // Something to read has appeared: a hint, or the card of a newly found element
  function holdForReading(ms) {
    if (s.mode !== "tutorial") return;
    s.hintHoldFrom = Date.now();
    s.hintHoldUntil = Math.max(s.hintHoldUntil, s.hintHoldFrom + ms);
  }

  // Every step and every tool: the miner is not reading. A tool always ends the wait
  // (nobody lights a fuse to read by); a step ends it once the mine has waited.
  function noteAction(usedTool) {
    var now = Date.now();
    if (usedTool || (s.mineWaiting && now - s.hintHoldFrom >= HINT_MIN_HOLD_MS)) s.hintHoldUntil = 0;
    s.lastActionAt = now;
  }

  function syncPlayerVisualPosition(x, y) {
    s.playerVisualFromX = x;
    s.playerVisualFromY = y;
    s.playerVisualToX = x;
    s.playerVisualToY = y;
    s.playerMoveAnimStart = 0;
  }

  function getPlayerVisualPosition(now) {
    var fromX = s.playerVisualFromX;
    var fromY = s.playerVisualFromY;
    var toX = s.playerVisualToX;
    var toY = s.playerVisualToY;
    if (fromX === undefined || fromY === undefined || toX === undefined || toY === undefined) {
      return { x: s.playerX, y: s.playerY };
    }

    var duration = s.playerMoveAnimDuration || 0;
    var start = s.playerMoveAnimStart || 0;
    if (!start || duration <= 0) return { x: toX, y: toY };

    var elapsed = (now || performance.now()) - start;
    if (elapsed >= duration) return { x: toX, y: toY };

    // Constant speed across the whole step: with a key held, each step ends
    // exactly as the next begins, so the miner walks instead of lurching
    var t = elapsed / duration;
    return {
      x: fromX + (toX - fromX) * t,
      y: fromY + (toY - fromY) * t
    };
  }

  function startPlayerVisualMove(toX, toY, now, duration) {
    var pos = getPlayerVisualPosition(now);
    s.playerMoveAnimDuration = duration || s.moveRepeatMs;
    s.playerVisualFromX = pos.x;
    s.playerVisualFromY = pos.y;
    s.playerVisualToX = toX;
    s.playerVisualToY = toY;
    s.playerMoveAnimStart = now || performance.now();
  }

  function resetHeldMovementState() {
    var keys = s.keys;
    for (var key in keys) keys[key] = false;
    s.lastMoveKey = "";
    s.activeMoveKey = "";
    s.moveCooldownUntil = 0;
    s.moveStreak = 0;
    s.tapQueued = "";
    s.lavaRecoil = null;
  }

  function getHeldMoveKey() {
    if (s.lastMoveKey && s.keys[s.lastMoveKey]) return s.lastMoveKey;
    if (s.keys.ArrowUp) return "ArrowUp";
    if (s.keys.ArrowDown) return "ArrowDown";
    if (s.keys.ArrowLeft) return "ArrowLeft";
    if (s.keys.ArrowRight) return "ArrowRight";
    return "";
  }

  function keyToMove(moveKey) {
    switch (moveKey) {
      case "ArrowUp": return { dx: 0, dy: -1 };
      case "ArrowDown": return { dx: 0, dy: 1 };
      case "ArrowLeft": return { dx: -1, dy: 0 };
      case "ArrowRight": return { dx: 1, dy: 0 };
      default: return null;
    }
  }

  // Held-key movement.
  //  - The first step is taken at once; the second only after a slightly longer
  //    pause (moveFirstRepeatMs), like keyboard auto-repeat. A tap therefore
  //    always means exactly one tile, even if the key is held a moment too long.
  //  - After that, steps repeat at the running pace.
  //  - Changing direction mid-run takes effect at the next tile boundary; it
  //    never cuts the current step short.
  //  - A press and release that both fall between two frames still counts.
  function tickInput(frameTime) {
    if (!s.running || s.paused || s.deathAnim) {
      s.activeMoveKey = "";
      s.moveCooldownUntil = 0;
      s.moveStreak = 0;
      s.tapQueued = "";
      return;
    }

    var now = frameTime || performance.now();
    var moveKey = getHeldMoveKey();
    if (!moveKey) {
      var tap = s.tapQueued;
      s.tapQueued = "";
      s.activeMoveKey = "";
      s.moveStreak = 0;
      // once the key is up, the longer first-step pause no longer applies:
      // quick repeated taps may follow each other at the running pace
      s.moveCooldownUntil = Math.min(s.moveCooldownUntil, (s.lastStepAt || 0) + s.moveRepeatMs);
      if (tap && now >= s.moveCooldownUntil) {
        var tapMove = keyToMove(tap);
        if (tapMove) { movePlayer(tapMove.dx, tapMove.dy); s.lastStepAt = now; s.moveCooldownUntil = now + s.moveRepeatMs; }
      }
      return;
    }
    s.tapQueued = "";

    s.activeMoveKey = moveKey;
    if (now < s.moveCooldownUntil) return;

    var move = keyToMove(moveKey);
    if (!move) return;

    movePlayer(move.dx, move.dy);
    s.lastStepAt = now;
    s.moveStreak = (s.moveStreak || 0) + 1;
    s.moveCooldownUntil = now + (s.moveStreak === 1 ? s.moveFirstRepeatMs : s.moveRepeatMs);
  }

  function usePowerup(slot) {
    if (!s.running || s.paused || s.inventory[slot] <= 0) return;
    noteAction(true);
    s.inventory[slot]--;
    if (slot === PU.DYNAMITE) {
      s.placedDynamite.push({ x: s.playerX, y: s.playerY, fuse: 5 });
      SFX.placeDynamite();
      Game.ui.addLog("🧨", "Dynamite placed! Get clear: every step and every second burns the fuse.", "powerup-log");
      Game.ui.updateHUD(); Game.render.frame(); return;
    } else if (slot === PU.LAMP) {
      SFX.usePowerup(); s.activeEffects.lamp = 12; s.score += 10;
      Game.ui.addLog("🔦", "Lamp ON - expanded vision!", "powerup-log");
    } else if (slot === PU.GEIGER) {
      SFX.usePowerup(); s.activeEffects.geiger = 15; s.score += 10;
      Game.ui.addLog("📲", "Geiger ON - hidden elements revealed!", "powerup-log");
    } else if (slot === PU.MASK) {
      SFX.usePowerup(); s.activeEffects.mask = 20; s.score += 10;
      Game.ui.addLog("🤿", "Gas mask sealed - 20 s of clean air!", "powerup-log");
    } else if (slot === PU.PUMP) {
      // needs water on or next to the player
      var wDirs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]], nearWater = false;
      for (var wd = 0; wd < wDirs.length; wd++) {
        var wx = s.playerX + wDirs[wd][0], wy = s.playerY + wDirs[wd][1];
        if (wx >= 0 && wx < s.cols && wy >= 0 && wy < s.rows &&
            (s.grid[wy][wx] === T.WATER || s.grid[wy][wx] === T.WATER_SRC)) { nearWater = true; break; }
      }
      if (!nearWater) {
        s.inventory[slot]++; // refund
        Game.ui.addLog("🚰", "No water here - stand beside the flood to place the pump.", "");
        Game.ui.updateHUD(); return;
      }
      s.pumps.push({ x: s.playerX, y: s.playerY, done: false, worked: 0 });
      SFX.usePowerup(); s.score += 10;
      Game.ui.addLog("🚰", "Pump running! Draining the flood - mine pumps like this one sparked the invention of the steam engine.", "powerup-log");
    }
    Game.ui.updateHUD(); Game.render.frame();
  }

  // ─── Refuge checkpoints: full run snapshot, restored on respawn ───
  // Everything that defines the state of a run. Saved by deep copy when the
  // miner steps into a refuge and copied back on respawn. A new piece of
  // level state that should survive a respawn belongs in this list.
  var CHECKPOINT_FIELDS = [
    "grid", "seenTile", "explored", "playerX", "playerY", "playerOnWater", "playerOnGas", "inRefuge",
    "score", "levelTime", "moves", "keysCollected", "inventory", "activeEffects",
    "collected", "totalElements", "components", "comboCount", "comboMultiplier", "lastComponentCompleted",
    "elementMap", "hiddenElementMap", "powerupMap", "bonusFound", "runBonusCollected",
    "triviaMap", "triviaAnswer", "gates", "familiesDone", "maxLevelTime",
    "enemies", "enemiesKilled", "bouncingCarts", "shaftLifts", "tbms", "pumps",
    "rollingBarrels", "rollingCarts", "rollingBarrelFalling", "fallingBoulders", "hazardFalling",
    "waterLevel", "lavaLevel", "gasLevel", "basaltLife"
  ];
  var RESPAWN_COST = 100;

  function deepCopy(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }

  function saveCheckpoint() {
    var snapshot = {};
    CHECKPOINT_FIELDS.forEach(function(field) { snapshot[field] = deepCopy(s[field]); });
    s.checkpoint = snapshot;
  }

  window.respawnAtRefuge = function() {
    var c = s.checkpoint;
    if (!c) return;
    clearIntervals();
    CHECKPOINT_FIELDS.forEach(function(field) { if (c[field] !== undefined) s[field] = deepCopy(c[field]); });
    s.score = Math.max(0, s.score - RESPAWN_COST);

    // transient state starts clean
    s.tileSlide = {}; s.tileBounce = {};
    s.placedDynamite = [];
    s.riding = null; s.ridingRoll = null;
    s.gasExposure = 0;
    s.readFreeze = 0;
    s.deathAnim = null;
    s.crushEffects = []; s.explosionEffects = []; s.digParticles = [];
    document.getElementById("game-overlay").classList.remove("visible");
    resetHeldMovementState();
    syncPlayerVisualPosition(s.playerX, s.playerY);
    s.running = true;
    s.paused = false;
    startIntervals();
    SFX.levelStart();
    Game.ui.addLog("⛑️", "Back at the refuge - the mountain forgets nothing, but you get another try. (−" + RESPAWN_COST + ")", "powerup-log");
    if (s.mode === "elementrun") Game.ui.renderRunPT();
    Game.ui.updateHUD();
    Game.render.frame();
  };

  function addCollectEffect(elem, pts, x, y, bonus) {
    if (!s.collectEffects) s.collectEffects = [];
    s.collectEffects.push({ x: x, y: y, color: elem.color, symbol: elem.symbol, pts: pts, bonus: !!bonus, start: Date.now() });
  }

  // ─── Element families (Element Runs): the last member of a family puts
  // its bonus back on the clock. The clock's length grows with it, so the
  // time used at the end is still the time actually played. ───
  function hasElement(key) {
    return s.collected.indexOf(key) >= 0 || !!(s.runBonusCollected && s.runBonusCollected[key]);
  }

  function checkFamilies(key) {
    if (!s.families || !s.families.length) return;
    for (var i = 0; i < s.families.length; i++) {
      var f = s.families[i];
      if (s.familiesDone[f.name] || f.keys.indexOf(key) < 0) continue;
      var have = 0;
      for (var k = 0; k < f.keys.length; k++) if (hasElement(f.keys[k])) have++;
      if (have < f.keys.length) {
        Game.ui.addLog("🧩", plainText(f.name) + " " + have + "/" + f.keys.length, "");
        continue;
      }
      s.familiesDone[f.name] = 1;
      s.levelTime += f.bonus; s.maxLevelTime += f.bonus;
      s.score += FAMILY_SCORE;
      SFX.combo(2);
      Game.ui.addLog("🏅", plainText(f.name).toUpperCase() + " COMPLETE! +" + f.bonus + " s &middot; +" + FAMILY_SCORE, "combo-log");
      Game.ui.showHint({ icon: "🏅", title: plainText(f.name).toUpperCase() + " COMPLETE - +" + f.bonus + " SECONDS", silent: true,
        text: "All <strong>" + f.keys.length + "</strong> collected. " + f.bonus + " seconds are back on the clock." });
    }
  }

  function collectElement(key, x, y) {
    var elem = s.elements[key]; if (!elem) return;
    s.collected.push(key);
    var firstFind = Game.ui.noteElement(elem.symbol);
    if (firstFind) { s.readFreeze = READ_FREEZE_SECONDS; holdForReading(READ_FREEZE_SECONDS * 1000); s.newFinds = (s.newFinds || 0) + 1; }
    var isLastElement = s.collected.length === s.totalElements;
    if (isLastElement) { SFX.exitOpen(); } else { SFX.collectElement(elem.z); }
    var comp = s.components[elem.component]; if (comp) comp.have = Math.min(comp.have + 1, comp.need);
    var compIdx = s.compOrder.indexOf(elem.component);
    var compDone = comp && comp.have >= comp.need;
    var baseScore = 50;
    if (compDone) {
      if (s.lastComponentCompleted === -1 || compIdx === s.lastComponentCompleted + 1) {
        s.comboCount++; s.comboMultiplier = 1 + s.comboCount * 0.5;
        SFX.combo(s.comboMultiplier);
        Game.ui.addLog("⚡", "COMBO x" + s.comboMultiplier.toFixed(1) + "! Component order bonus!", "combo-log");
      } else { s.comboCount = 0; s.comboMultiplier = 1; }
      s.lastComponentCompleted = compIdx;
    }
    var pts = Math.floor(baseScore * s.comboMultiplier); s.score += pts;
    addCollectEffect(elem, pts, x !== undefined ? x : s.playerX, y !== undefined ? y : s.playerY, false);
    var log = document.getElementById("collection-log"); if (s.collected.length === 1) log.innerHTML = "";
    Game.ui.addLog('<span style="color:' + elem.color + '">' + elem.symbol + '</span>', elem.name + " +" + pts + (firstFind ? " &middot; \ud83d\udcd6 new - " + (s.mode === "tutorial" ? "the mine waits while you read" : "clock held " + READ_FREEZE_SECONDS + " s") : ""), "");

    // Periodic Table tracking (Endless Depths)
    if (s.mode === "random") {
      var isNew = !s.ptDiscovered[elem.symbol];
      if (isNew) {
        s.ptDiscovered[elem.symbol] = 1;
        if (s.pushingLuck) {
          s.unstashedDiscoveries.push(elem.symbol);
        } else {
          Game.ui.savePTProgress();
        }
        Game.ui.addLog("\ud83e\uddea", "NEW DISCOVERY: " + elem.name + "!", "combo-log");
      }
      Game.ui.updatePTSlot(elem.symbol, isNew);
    }

    checkFamilies(key);
    if (s.mode === "elementrun") Game.ui.renderRunPT();

    if (isLastElement) {
      Game.ui.addLog("\ud83d\udeaa", "EXIT OPEN! All elements collected - find the exit!", "combo-log");
    }

    Game.ui.updateHUD(); Game.ui.showFact(elem);
  }

  function collectBonusElement(key, x, y) {
    var elem = s.bonusElements[key]; if (!elem) return;
    if (Game.ui.noteElement(elem.symbol)) { s.readFreeze = READ_FREEZE_SECONDS; holdForReading(READ_FREEZE_SECONDS * 1000); s.newFinds = (s.newFinds || 0) + 1; }
    s.bonusFound = (s.bonusFound || 0) + 1;
    SFX.collectBonus();
    var pts = Math.floor(150 * s.comboMultiplier); s.score += pts;
    addCollectEffect(elem, pts, x !== undefined ? x : s.playerX, y !== undefined ? y : s.playerY, true);
    Game.ui.addLog('<span style="color:' + elem.color + '">' + elem.symbol + '</span>', "⭐ BONUS: " + elem.name + " +" + pts, "combo-log");

    // Periodic Table tracking (Endless Depths)
    if (s.mode === "random") {
      var isNew = !s.ptDiscovered[elem.symbol];
      if (isNew) {
        s.ptDiscovered[elem.symbol] = 1;
        if (s.pushingLuck) {
          s.unstashedDiscoveries.push(elem.symbol);
        } else {
          Game.ui.savePTProgress();
        }
        Game.ui.addLog("\ud83e\uddea", "NEW DISCOVERY: " + elem.name + "!", "combo-log");
      }
      Game.ui.updatePTSlot(elem.symbol, isNew);
    }

    if (s.mode === "elementrun") {
      s.runBonusCollected = s.runBonusCollected || {};
      s.runBonusCollected[key] = 1;
      checkFamilies(key);
      Game.ui.renderRunPT();
    }

    Game.ui.updateHUD(); Game.ui.showFact(elem);
  }

  // What a tile becomes when the player steps off it
  function vacatedTile(x, y) {
    if (s.triviaMap && s.triviaMap[y + "," + x]) return T.PAD;
    if (s.hiddenElementMap && s.hiddenElementMap[y + "," + x]) return T.HIDDEN_ELEM;
    if (s.refugeCells && s.refugeCells[y + "," + x]) return T.REFUGE;
    if (s.playerOnWater) return T.WATER;
    if (s.playerOnGas) return T.GAS;
    return T.EMPTY;
  }

  // ═══════════════════════════════════════════════════════════════
  // Movement: what happens when the miner tries to step into a cell
  // ═══════════════════════════════════════════════════════════════
  //
  // movePlayer() works on a "step": { dx, dy, nx, ny, target } where target is
  // the tile in the cell being entered. Each kind of tile that reacts has a
  // rule - a function that takes the step, does what the tile does, and either
  //   • returns STOP        the miner does not move (blocked, died, or the rule
  //                         has already finished the move itself), or
  //   • returns nothing     the miner goes on to step into the cell; the rule
  //                         may first change step.target to what is left there.
  var STOP = {};

  function tileSet(tiles) { var set = {}; tiles.forEach(function(t) { set[t] = true; }); return set; }

  // Nothing gets the miner through these
  var IMPASSABLE = tileSet([T.WALL, T.ROCK, T.ICE, T.SPIDER_NEST, T.BASALT, T.REFUGE_POST, T.GAS_SRC]);
  // Entering these plays the pick swing and throws up dirt
  var DUG = tileSet([T.EARTH, T.EARTH_RICH, T.HIDDEN_ELEM, T.WATER_SRC, T.LAVA_SRC, T.ELEMENT, T.POWERUP, T.KEY]);
  // Breaking ground sends a full tremor to spiders. Picking up an element, a tool or a
  // key that lies in the open sends a much smaller one (PICKUP_TREMOR_RADIUS); a bonus
  // element is dug out of earth, so it counts as ground.
  var BREAKS_GROUND = tileSet([T.EARTH, T.EARTH_RICH, T.HIDDEN_ELEM, T.WATER_SRC, T.LAVA_SRC]);
  // A cart, pushed or ridden, rolls on through these
  var CART_ROLLS_THROUGH = tileSet([T.EMPTY, T.WEB, T.WATER, T.LAVA]);

  function creatureAt(x, y) {
    return s.enemies.find(function(e) { return e.alive && e.x === x && e.y === y; });
  }

  function bump() { if (typeof SFX.wallBump === "function") SFX.wallBump(); }

  // ─── Rules for things the miner shoves or cuts through ───

  // Boulders and toxic barrels slide one cell sideways if there is room.
  // (A boulder may also be shoved over a toxic barrel.)
  function pushHeavy(step, tile) {
    if (step.dy !== 0) return STOP;
    var bx = step.nx + step.dx, ny = step.ny;
    if (bx <= 0 || bx >= s.cols - 1) return STOP;
    var beyond = s.grid[ny][bx], creature = creatureAt(bx, ny);
    var room = beyond === T.EMPTY || (tile === T.BOULDER && beyond === T.HAZARD) || creature;
    if (!room) return STOP;
    if (creature) Game.enemies.checkBoulderCrush(bx, ny);
    s.grid[ny][bx] = tile; s.grid[ny][step.nx] = T.EMPTY;
    SFX.boulderPush();
    Game.physics.slideTo(bx, ny, step.dx, 0);
  }

  function pushRollingBarrel(step) {
    if (step.dy !== 0) return STOP;
    s.grid[step.ny][step.nx] = T.EMPTY; SFX.boulderPush();
    s.rollingBarrels = s.rollingBarrels || [];
    s.rollingBarrels.push({ x: step.nx, y: step.ny, dx: step.dx, floatX: step.nx, floatY: step.ny, falling: false, rot: 0 });
    step.target = T.EMPTY;
  }

  // Cutting a web takes the time of a step, but the miner stays put
  function slashWeb(step) {
    s.grid[step.ny][step.nx] = T.EMPTY;
    if (typeof SFX.step === "function") SFX.step();
    Game.ui.addLog("🕸️", "Slashed through a sticky web!", "");
    s.moves++; s.playerDigTime = Date.now(); s.playerIsDigging = true;
    Game.physics.tickDynamite(); Game.camera.update(); Game.ui.updateHUD(); Game.render.frame();
    return STOP;
  }

  function releaseWater(step) {
    s.grid[step.ny][step.nx] = T.WATER; SFX.waterRelease();
    Game.ui.addLog("💧", "Water released! It will spread...", "");
    step.target = T.WATER;
  }

  // Breaking into a lava vein lets the lava out and the miner recoils: the cell is
  // lava from now on, and stepping into it is death. The press that opened the vein
  // is never also that step - see the lava check in movePlayer.
  function releaseLava(step) {
    s.grid[step.ny][step.nx] = T.LAVA; SFX.lavaRelease();
    Game.ui.addLog("🌋", "You broke into a <strong>lava vein</strong>! Do not step into it - the lava will spread slowly.", "crush-log");
    s.lavaRecoil = { x: step.nx, y: step.ny, press: s.pressSeq };
    s.moves++; s.playerDigTime = Date.now(); s.playerIsDigging = true;
    Game.enemies.triggerTremor(step.nx, step.ny);
    throwDirt(T.EARTH, step.nx, step.ny, step.dx, step.dy);
    Game.physics.tickDynamite(); Game.camera.update(); Game.ui.updateHUD(); Game.render.frame();
    return STOP;
  }

  // ─── Rules for doors, keys, carts, pads, pickups and the exit ───

  function openDoor(step) {
    if (s.keysCollected <= 0) {
      bump(); Game.ui.addLog("🔒", "You need a key to open this door!", "crush-log");
      return STOP;
    }
    s.keysCollected--; SFX.usePowerup(); Game.ui.addLog("🔓", "Door unlocked!", "powerup-log");
    s.score += 10;
    step.target = T.EMPTY;
  }

  function refuseLogicDoor() {
    bump(); Game.ui.addLog("🔒", "This door is sealed by a logic puzzle.", "crush-log");
    return STOP;
  }

  function takeKey(step) {
    s.keysCollected++; SFX.collectPowerup(); Game.ui.addLog("🔑", "Key collected!", "powerup-log");
    step.target = T.EMPTY;
  }

  // How far a cart starting beside (x, y) rolls in direction dx. Webs in the
  // way are torn when clearWebs is set.
  function cartRunEnd(x, y, dx, minX, maxX, clearWebs) {
    while (true) {
      var next = x + dx;
      if (next < minX || next > maxX) break;
      var t = s.grid[y][next];
      if (!CART_ROLLS_THROUGH[t]) break;
      x = next;
      if (clearWebs && t === T.WEB) s.grid[y][next] = T.EMPTY;
    }
    return x;
  }

  // Step down onto a cart to board it; walk into it sideways to shove it
  function meetCart(step) {
    var nx = step.nx, ny = step.ny;
    if (step.dy === 1 && step.dx === 0) {
      s.grid[s.playerY][s.playerX] = vacatedTile(s.playerX, s.playerY);
      s.playerOnWater = false; s.playerOnGas = false;
      s.playerX = nx; s.playerY = ny;
      s.grid[ny][nx] = T.PLAYER;
      s.riding = { under: T.EMPTY };
      syncPlayerVisualPosition(nx, ny);
      SFX.collectPowerup();
      Game.ui.addLog("🛒", "All aboard! ←/→ to roll, ↑ to hop out. The cart flattens anything on the line.", "powerup-log");
      Game.camera.update(); Game.ui.updateHUD(); Game.render.frame();
      return STOP;
    }
    if (step.dy !== 0) { bump(); return STOP; }
    var endX = cartRunEnd(nx, ny, step.dx, 0, s.cols - 1, true);
    if (endX === nx) { bump(); return STOP; }
    if (typeof SFX.boulderFall === "function") SFX.boulderFall();
    Game.ui.addLog("🛒", "Pushed the minecart!", "powerup-log");
    s.rollingCarts = s.rollingCarts || [];
    s.rollingCarts.push({ x: nx, y: ny, endX: endX, dx: step.dx, crushed: 0 });
    s.grid[ny][nx] = T.EMPTY;
    step.target = T.EMPTY;
  }

  // Answer pad: the right element opens the logic doors; a wrong one costs
  // clock time (never the level) and explains itself
  // Level text that ends up in the banner or the log is plain text, not HTML
  function plainText(v) {
    return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function answerPad(step) {
    var cell = step.ny + "," + step.nx;
    var guess = s.triviaMap[cell];
    var gate = (s.padGate && s.padGate[cell] !== undefined) ? s.gates[s.padGate[cell]] : null;
    var answer = gate ? (gate.open ? "" : gate.answer) : s.triviaAnswer;
    var question = gate ? gate.question : s.triviaQuestion;
    bump();
    var name = plainText(ALL_ELEMENTS[guess] ? ALL_ELEMENTS[guess].name : guess);
    if (guess === answer && guess !== "") {
      SFX.levelWin();
      Game.ui.showHint({ icon: "✅", title: "CORRECT - " + String(name).toUpperCase() + "! The logic doors opened.", text: Game.ui.elementBlurb(guess), silent: true });
      if (gate) {
        // a gate opens its own doors and no others
        gate.doors.forEach(function(d) { if (s.grid[d.y][d.x] === T.LOGIC_DOOR) s.grid[d.y][d.x] = T.EMPTY; });
        gate.open = true;
      } else {
        for (var r = 0; r < s.rows; r++) for (var c = 0; c < s.cols; c++) {
          if (s.grid[r][c] === T.LOGIC_DOOR && s.gateDoorCells[r + "," + c] === undefined) s.grid[r][c] = T.EMPTY;
        }
        s.triviaAnswer = "";
      }
    } else if (guess !== "" && answer !== "") {
      s.levelTime = Math.max(1, s.levelTime - QUIZ_PENALTY_SECONDS);
      s.screenShake = 3; s.screenShakeTime = Date.now();
      Game.ui.addLog("❌", "Not " + name + " - −" + QUIZ_PENALTY_SECONDS + " s", "crush-log");
      Game.ui.showHint({ icon: "❌", title: "NOT " + String(name).toUpperCase() + " - −" + QUIZ_PENALTY_SECONDS + " SECONDS",
        text: Game.ui.elementBlurb(guess) + " <em>" + plainText(question) + "</em>", silent: true });
    }
  }

  function takeElement(step) {
    var cell = step.ny + "," + step.nx, key = s.elementMap[cell];
    if (key) { collectElement(key, step.nx, step.ny); delete s.elementMap[cell]; }
  }

  // Hidden bonus elements can only be dug out while the Geiger counter runs
  function takeHiddenElement(step) {
    var cell = step.ny + "," + step.nx, key = s.hiddenElementMap[cell];
    if (!key) return;
    if (s.activeEffects.geiger > 0) {
      collectBonusElement(key, step.nx, step.ny);
      delete s.hiddenElementMap[cell];
    } else {
      SFX.glint();
      Game.ui.addLog("❓", "Something glinted in the earth... it's still buried here - come back with a Geiger Counter!", "");
    }
  }

  function takeTool(step) {
    var cell = step.ny + "," + step.nx, type = s.powerupMap[cell];
    if (type === undefined || !PU_INFO[type]) return;
    s.inventory[type]++; delete s.powerupMap[cell];
    SFX.collectPowerup(); Game.ui.addLog(PU_INFO[type].icon, PU_INFO[type].name + " collected!", "powerup-log");
    s.score += 15;
  }

  // The exit ends the level once everything is collected; until then it is barred
  function tryExit(step) {
    if (s.collected.length >= s.totalElements) {
      s.grid[s.playerY][s.playerX] = s.playerOnWater ? T.WATER : T.EMPTY;
      s.playerX = step.nx; s.playerY = step.ny;
      syncPlayerVisualPosition(step.nx, step.ny);
      gameOver(true);
    }
    return STOP;
  }

  // Shoving and cutting happen before the miner can touch a creature in the cell…
  var SHOVE_RULES = {};
  SHOVE_RULES[T.BOULDER] = function(step) { return pushHeavy(step, T.BOULDER); };
  SHOVE_RULES[T.HAZARD] = function(step) { return pushHeavy(step, T.HAZARD); };
  SHOVE_RULES[T.ROLL_BARREL] = pushRollingBarrel;
  SHOVE_RULES[T.WEB] = slashWeb;
  SHOVE_RULES[T.WATER_SRC] = releaseWater;
  SHOVE_RULES[T.LAVA_SRC] = releaseLava;

  // …everything else after.
  var ENTER_RULES = {};
  ENTER_RULES[T.DOOR] = openDoor;
  ENTER_RULES[T.LOGIC_DOOR] = refuseLogicDoor;
  ENTER_RULES[T.KEY] = takeKey;
  ENTER_RULES[T.CART] = meetCart;
  ENTER_RULES[T.PAD] = answerPad;
  ENTER_RULES[T.ELEMENT] = takeElement;
  ENTER_RULES[T.HIDDEN_ELEM] = takeHiddenElement;
  ENTER_RULES[T.POWERUP] = takeTool;
  ENTER_RULES[T.EXIT] = tryExit;

  // ─── Riding a minecart: ←/→ launch a roll, ↑ hops out ───
  function moveWhileRiding(dx, dy) {
    if (s.ridingRoll) return;                         // mid-roll: hold on
    if (dy === -1 && dx === 0) {
      var above = s.playerY > 0 ? s.grid[s.playerY - 1][s.playerX] : T.WALL;
      if (above === T.EARTH || above === T.EARTH_RICH) {
        // dig headroom first; the next press hops out
        s.grid[s.playerY - 1][s.playerX] = T.EMPTY;
        SFX.dig(); Game.enemies.triggerTremor(s.playerX, s.playerY - 1);
        Game.render.frame();
      } else if (above === T.EMPTY || above === T.WEB) {
        s.grid[s.playerY - 1][s.playerX] = T.EMPTY;
        s.grid[s.playerY][s.playerX] = T.CART;        // leave the cart behind
        s.playerY--;
        s.grid[s.playerY][s.playerX] = T.PLAYER;
        s.riding = null;
        syncPlayerVisualPosition(s.playerX, s.playerY);
        Game.ui.addLog("🛒", "Hopped off the cart.", "");
        Game.camera.update(); Game.ui.updateHUD(); Game.render.frame();
      } else {
        SFX.wallBump();
      }
      return;
    }
    if (dx !== 0 && dy === 0) {
      var endX = cartRunEnd(s.playerX, s.playerY, dx, 1, s.cols - 2, false);
      if (endX !== s.playerX) {
        s.ridingRoll = { dir: dx, endX: endX, floatX: s.playerX };
        if (typeof SFX.boulderFall === "function") SFX.boulderFall();
      } else {
        SFX.wallBump();
      }
    }
    // no stepping down while aboard
  }

  // Would stepping into (nx, ny) put the miner under a moving machine?
  function machineAt(nx, ny) {
    var i;
    for (i = 0; i < (s.bouncingCarts || []).length; i++) {
      if (ny === s.bouncingCarts[i].y && Math.abs(nx - s.bouncingCarts[i].floatX) < 0.8) return "cart_bounce";
    }
    for (i = 0; i < (s.shaftLifts || []).length; i++) {
      if (nx === s.shaftLifts[i].x && Math.abs(ny - s.shaftLifts[i].floatY) < 0.8) return "shaft_lift";
    }
    return null;
  }

  function tunnelBorerAt(nx, ny) {
    for (var i = 0; i < (s.tbms || []).length; i++) {
      if (Game.machines.tbmHitsTile(s.tbms[i], nx, ny)) return true;
    }
    return false;
  }

  // Dirt thrown back from the pick, away from the direction of the dig
  function throwDirt(tile, nx, ny, dx, dy) {
    var rich = tile === T.EARTH_RICH || tile === T.HIDDEN_ELEM;
    var colors = rich ? ["#c49040", "#d4a050", "#a07030", "#8b6b3e", "#e0b060"]
                      : ["#8b6b3e", "#6b5030", "#a07848", "#5a4028", "#9c8050"];
    var count = rich ? 10 : 7;
    for (var i = 0; i < count; i++) {
      var spread = (Math.random() - 0.5) * 2.2;
      var speed = 0.6 + Math.random() * 1.4;
      s.digParticles.push({
        x: nx - dx * 0.5 + (Math.random() - 0.5) * 0.3,
        y: ny - dy * 0.5 + (Math.random() - 0.5) * 0.3,
        vx: -dx * speed + spread * (dy !== 0 ? 1 : 0.3),
        vy: -dy * speed + spread * (dx !== 0 ? 1 : 0.3) - 0.3,
        size: 1 + Math.random() * 2,
        color: colors[i % colors.length],
        life: 1,
        decay: 0.02 + Math.random() * 0.015,
        gravity: 0.04 + Math.random() * 0.02
      });
    }
  }

  function movePlayer(dx, dy) {
    if (!s.running || s.paused || s.deathAnim) return;
    noteAction(false);
    if (s.riding) { moveWhileRiding(dx, dy); return; }

    if (dx > 0) s.playerFacing = "east";
    else if (dx < 0) s.playerFacing = "west";
    else if (dy < 0) s.playerFacing = "north";
    else if (dy > 0) s.playerFacing = "south";

    // moving away cancels a creature's pending bite
    if (s.enemyDanger) s.enemyDanger = null;

    var nx = s.playerX + dx, ny = s.playerY + dy;

    var machine = machineAt(nx, ny);
    if (machine) { gameOver(false, machine); return; }

    if (nx < 0 || nx >= s.cols || ny < 0 || ny >= s.rows) return;
    var entered = s.grid[ny][nx];
    if (IMPASSABLE[entered]) { SFX.wallBump(); return; }
    if (entered === T.LAVA) {
      // a key still held from breaking the vein open waits; a new press walks in
      var recoil = s.lavaRecoil;
      if (recoil && recoil.x === nx && recoil.y === ny && recoil.press === s.pressSeq && getHeldMoveKey()) return;
      gameOver(false, "lava"); return;
    }
    s.lavaRecoil = null;
    if (tunnelBorerAt(nx, ny)) { gameOver(false, "tbm"); return; }

    // wading: only every second attempt is a step
    var wading = s.grid[s.playerY][s.playerX] === T.PLAYER && s.playerOnWater;
    if (wading) {
      s.waterSlowToggle = !s.waterSlowToggle;
      if (!s.waterSlowToggle) { Game.ui.updateHUD(); Game.render.frame(); return; }
    }

    var step = { dx: dx, dy: dy, nx: nx, ny: ny, target: entered };

    var shove = SHOVE_RULES[step.target];
    if (shove && shove(step) === STOP) return;

    var creature = creatureAt(nx, ny);
    if (creature) { gameOver(false, creature.type); return; }

    var enter = ENTER_RULES[step.target];
    if (enter && enter(step) === STOP) return;

    // ─── Take the step ───
    var target = step.target;
    s.grid[s.playerY][s.playerX] = vacatedTile(s.playerX, s.playerY);
    s.playerOnWater = (target === T.WATER);
    s.playerOnGas = (target === T.GAS);
    if (dx !== 0) s.playerDir = dx;

    // wading takes two input ticks per step
    startPlayerVisualMove(nx, ny, performance.now(), wading ? s.moveRepeatMs * 2 : s.moveRepeatMs);
    s.playerX = nx; s.playerY = ny;
    s.grid[ny][nx] = T.PLAYER;
    s.moves++;
    s.playerDigTime = Date.now();
    s.playerIsDigging = !!DUG[entered];

    // a refuge floor saves the run each time it is entered
    if (target === T.REFUGE) {
      var firstEntry = !s.inRefuge;
      s.inRefuge = true;
      saveCheckpoint();
      if (firstEntry) {
        SFX.collectPowerup();
        Game.ui.addLog("⛑️", "Refuge chamber - <strong>checkpoint saved</strong>. If the mine claims you, you return here (−" + RESPAWN_COST + ").", "powerup-log");
      }
    } else {
      s.inRefuge = false;
    }

    if (s.playerOnWater) SFX.splash();
    else if (DUG[entered]) {
      SFX.dig(); Game.enemies.triggerTremor(nx, ny, BREAKS_GROUND[entered] ? TREMOR_RADIUS : PICKUP_TREMOR_RADIUS);
      throwDirt(target, nx, ny, dx, dy);
    }
    else SFX.step();

    Game.physics.tickDynamite();
    checkTutorialHints();
    checkQuizProximity();
    Game.camera.update(); Game.ui.updateHUD(); Game.render.frame();
  }

  // ═══════════════════════════════════════════════════════════════
  // Death animation engine
  // ═══════════════════════════════════════════════════════════════

  function gameOver(won, cause) {
    if (!s.running || s.deathAnim) return;
    s.running = false;
    resetHeldMovementState();
    SFX.stopLevelMusic();

    if (!won) {
      SFX.death();

      var causeInfo = DEATH_CAUSES[cause] || DEATH_CAUSES.boulder;
      var pColor = causeInfo.color;

      var playerVisual = getPlayerVisualPosition(performance.now());
      var px = (playerVisual.x - (s.camSmoothX !== undefined ? s.camSmoothX : s.camX)) * s.tile + s.tile / 2;
      var py = (playerVisual.y - (s.camSmoothY !== undefined ? s.camSmoothY : s.camY)) * s.tile + s.tile / 2;
      var isBoulder = (cause === "boulder");
      var numParticles = isBoulder ? 80 : 45;

      var particles = [];
      for (var i = 0; i < numParticles; i++) {
        var angle = Math.random() * Math.PI * 2;
        var speed = Math.random() * 12 + 2;
        var vyBias = -6;
        var color = Math.random() > 0.25 ? pColor : "#ffffff";
        if (isBoulder) {
          angle = Math.PI + (Math.random() - 0.5) * Math.PI * 1.5;
          speed = Math.random() * 18 + 4;
          vyBias = -2;
          color = Math.random() > 0.4 ? "#7a7a8a" : (Math.random() > 0.5 ? "#5a5a6a" : "#4a4a5a");
        }
        particles.push({
          x: isBoulder ? (Math.random() - 0.5) * s.tile : 0,
          y: isBoulder ? s.tile / 2 : 0,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed + vyBias,
          size: Math.random() * S(isBoulder ? 8 : 6) + S(2),
          color: color, life: 1.0,
          decay: Math.random() * 0.02 + (isBoulder ? 0.03 : 0.015)
        });
      }

      var label = causeInfo.label;

      var snapshot = document.createElement('canvas');
      snapshot.width = s.canvas.width; snapshot.height = s.canvas.height;
      snapshot.getContext('2d').drawImage(s.canvas, 0, 0);

      // Pre-generate falling boulders for boulder death
      var fallingBoulders = null;
      if (isBoulder) {
        fallingBoulders = [];
        for (var bi = 0; bi < 5; bi++) {
          fallingBoulders.push({
            offsetX: (bi - 2) * S(30) + (Math.random() - 0.5) * S(15),
            delay: bi === 2 ? 0 : 80 + Math.random() * 200,
            scale: bi === 2 ? 2.5 : 1.2 + Math.random() * 1.0,
            rot: (Math.random() - 0.5) * 0.4
          });
        }
      }

      s.deathAnim = {
        start: Date.now(), won: won, cause: cause,
        snapshot: snapshot, particles: particles,
        px: px, py: py, label: label,
        fallingBoulders: fallingBoulders
      };

      requestAnimationFrame(renderDeathAnimLoop);
    } else {
      // Win: commit PT discoveries to localStorage (only if not pushing luck)
      if (s.mode === "random" && !s.pushingLuck) Game.ui.savePTProgress();
      s.runActive = false;
      Game.ui.showGameOverUI(won, cause);
    }
  }

  function renderDeathAnimLoop() {
    var da = s.deathAnim;
    if (!da) return;

    var elapsed = Date.now() - da.start;
    var duration = 1800;
    // paced by the clock, like the rest of the drawing (see render.js)
    var daNow = performance.now();
    var daStep = da.lastAt ? Math.max(0, Math.min((daNow - da.lastAt) / (1000 / 60), 3)) : 1;
    da.lastAt = daNow;

    if (elapsed >= duration) {
      s.deathAnim = null;
      s.runActive = false;
      // Revert PT discoveries on death - only successful runs keep elements
      if (s.mode === "random" && s.ptSnapshot) {
        if (s.pushingLuck && s.ptStashedSnapshot) {
          s.ptDiscovered = s.ptStashedSnapshot;
        } else {
          s.ptDiscovered = s.ptSnapshot;
        }
        Game.ui.savePTProgress();
        s.ptSnapshot = null;
        Game.ui.renderPeriodicTable();
      }
      // Show death UI before resetting luck state (so lost discoveries message works)
      Game.ui.showGameOverUI(da.won, da.cause);
      s.pushingLuck = false;
      s.luckStreak = 0;
      s.unstashedDiscoveries = [];
      s.ptStashedSnapshot = null;
      return;
    }

    var ctx = s.ctx, TILE = s.tile, canvas = s.canvas;
    var isBoulder = (da.cause === "boulder");

    ctx.drawImage(da.snapshot, 0, 0);

    if (elapsed > 800) {
      var fadeAlpha = Math.min((elapsed - 800) / 800, 1.0);
      ctx.fillStyle = "rgba(6, 8, 16, " + fadeAlpha * 0.85 + ")";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (isBoulder) {
      var dropTime = 250;
      // Draw each falling boulder
      var allLanded = true;
      for (var bi = 0; bi < da.fallingBoulders.length; bi++) {
        var fb = da.fallingBoulders[bi];
        var bElapsed = elapsed - fb.delay;
        if (bElapsed < 0) { allLanded = false; continue; }
        var bx = da.px + fb.offsetX;
        var currentY = da.py;
        if (bElapsed < dropTime) {
          allLanded = false;
          var t = bElapsed / dropTime;
          currentY = da.py - (1 - Math.pow(t, 2)) * S(600);
        }
        // Screen shake from impacts
        var shakeX = 0, shakeY = 0;
        if (bElapsed >= dropTime && bElapsed < dropTime + 400) {
          var intensity = (1 - ((bElapsed - dropTime) / 400)) * fb.scale * 0.4;
          shakeX = (Math.random() - 0.5) * S(20) * intensity;
          shakeY = (Math.random() - 0.5) * S(20) * intensity;
        }
        ctx.save();
        ctx.translate(bx + shakeX, currentY + shakeY);
        ctx.scale(fb.scale, fb.scale);
        ctx.rotate(fb.rot);
        // Draw refined boulder matching the in-game sprite
        var r = TILE / 2 - S(2);
        ctx.fillStyle = "#6e6e80";
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.75, -r * 0.7);
        ctx.lineTo(r, -r * 0.1);
        ctx.lineTo(r * 0.85, r * 0.55);
        ctx.lineTo(r * 0.4, r * 0.95);
        ctx.lineTo(-r * 0.35, r);
        ctx.lineTo(-r * 0.9, r * 0.5);
        ctx.lineTo(-r, -r * 0.2);
        ctx.lineTo(-r * 0.65, -r * 0.8);
        ctx.closePath(); ctx.fill();
        // Top highlight
        ctx.fillStyle = "rgba(180,180,200,0.35)";
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.75, -r * 0.7);
        ctx.lineTo(r * 0.3, -r * 0.1);
        ctx.lineTo(-r * 0.2, -r * 0.15);
        ctx.lineTo(-r * 0.65, -r * 0.8);
        ctx.closePath(); ctx.fill();
        // Bottom shadow
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath();
        ctx.moveTo(r * 0.85, r * 0.55);
        ctx.lineTo(r * 0.4, r * 0.95);
        ctx.lineTo(-r * 0.35, r);
        ctx.lineTo(-r * 0.9, r * 0.5);
        ctx.lineTo(-r * 0.3, r * 0.1);
        ctx.lineTo(r * 0.5, r * 0.1);
        ctx.closePath(); ctx.fill();
        // Crack lines
        ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = S(0.8); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.3); ctx.lineTo(r * 0.1, r * 0.15); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r * 0.2, -r * 0.4); ctx.lineTo(r * 0.5, r * 0.2); ctx.stroke();
        // Specular highlight
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.4, S(2.5), 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      // Global screen shake from combined impacts
      if (!allLanded) {
        var gShakeI = 0.3;
        ctx.save();
        ctx.translate((Math.random() - 0.5) * S(6) * gShakeI, (Math.random() - 0.5) * S(6) * gShakeI);
        ctx.restore();
      }
    } else if (elapsed <= 800) {
      var shakeX2 = (Math.random() - 0.5) * S(8);
      var shakeY2 = (Math.random() - 0.5) * S(8);
      var rotation = (elapsed / 800) * Math.PI * 4;
      var scale = Math.min(elapsed / 150, 1) * 1.5;
      ctx.save(); ctx.translate(da.px + shakeX2, da.py + shakeY2); ctx.scale(scale, scale); ctx.rotate(rotation);
      // Skull: domed cranium, hollow sockets with an ember glow, nose and teeth
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      function skullPath() {
        ctx.beginPath();
        ctx.arc(0, -S(3), S(11), Math.PI, 0);
        ctx.lineTo(S(11), S(1));
        ctx.quadraticCurveTo(S(10.6), S(6.2), S(6.6), S(6.8));
        ctx.lineTo(S(6.0), S(11.4)); ctx.lineTo(-S(6.0), S(11.4)); ctx.lineTo(-S(6.6), S(6.8));
        ctx.quadraticCurveTo(-S(10.6), S(6.2), -S(11), S(1));
        ctx.closePath();
      }
      ctx.strokeStyle = "#17161c"; ctx.lineWidth = S(2.2); skullPath(); ctx.stroke();
      var bone = ctx.createLinearGradient(-S(8), -S(14), S(8), S(11));
      bone.addColorStop(0, "#fbf8ee"); bone.addColorStop(0.6, "#e2ddcd"); bone.addColorStop(1, "#b3ad9c");
      ctx.fillStyle = bone; skullPath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath(); ctx.ellipse(-S(4.2), -S(9.2), S(3.6), S(1.7), -0.45, 0, Math.PI * 2); ctx.fill();
      for (var sk = -1; sk <= 1; sk += 2) {
        ctx.fillStyle = "#15141a";
        ctx.beginPath(); ctx.ellipse(sk * S(4.5), -S(1.4), S(3.5), S(4.0), sk * 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,90,50,0.9)";
        ctx.beginPath(); ctx.arc(sk * S(4.3), -S(0.9), S(1.1), 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = "#15141a";
      ctx.beginPath(); ctx.moveTo(0, S(2.2)); ctx.lineTo(S(1.9), S(5.6)); ctx.lineTo(-S(1.9), S(5.6)); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#17161c"; ctx.lineWidth = S(0.9);
      ctx.beginPath(); ctx.moveTo(-S(6.2), S(7.6)); ctx.lineTo(S(6.2), S(7.6));
      for (var tk = -2; tk <= 2; tk++) { ctx.moveTo(tk * S(2.2), S(7.6)); ctx.lineTo(tk * S(2.2), S(11.2)); }
      ctx.moveTo(S(3.2), -S(13.2)); ctx.lineTo(S(4.6), -S(10.2)); ctx.lineTo(S(3.4), -S(8.2));
      ctx.stroke();
      ctx.restore();
    }

    var particleStart = isBoulder ? 250 : 800;
    if (elapsed > particleStart) {
      ctx.save(); ctx.translate(da.px, da.py);
      for (var i = 0; i < da.particles.length; i++) {
        var p = da.particles[i];
        if (p.life > 0) {
          p.x += p.vx * daStep; p.y += p.vy * daStep; p.vy += 0.8 * daStep; p.life -= p.decay * daStep;
          if (p.life > 0) {
            ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, p.life);
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
      ctx.restore();
    }

    var flashStart = isBoulder ? 250 : 0;
    // "Effects: Reduced" leaves out the full-screen flash.
    if (!s.reducedFx && elapsed >= flashStart && elapsed < flashStart + 150) {
      var flashAlpha = 1 - ((elapsed - flashStart) / 150);
      ctx.fillStyle = "rgba(255, 255, 255, " + (flashAlpha * (isBoulder ? 0.7 : 1.0)) + ")";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (elapsed > 1000) {
      var labelProgress = (elapsed - 1000) / 800;
      var labelScale = 1 + (labelProgress * 0.3);
      ctx.save(); ctx.translate(canvas.width / 2, canvas.height / 2); ctx.scale(labelScale, labelScale);
      ctx.fillStyle = "#e85454"; ctx.font = 'bold ' + S(20) + 'px "Press Start 2P",monospace';
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.shadowColor = "#000"; ctx.shadowBlur = S(10); ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 3;
      ctx.globalAlpha = Math.min(labelProgress * 2, 1.0);
      ctx.fillText(da.label, 0, 0);
      ctx.restore();
    }

    requestAnimationFrame(renderDeathAnimLoop);
  }

  // ═══════════════════════════════════════════════════════════════
  // Level start & game begin
  // ═══════════════════════════════════════════════════════════════

  function getMissionLevel(num) {
    if (!Game.levels) return null;
    var base = Game.levels.getCount();
    // Indices past the base manifest are the ten further missions in BonusLevels/
    if (num >= base && Game.bonusLevels) return Game.bonusLevels.get(num - base);
    return Game.levels.get(num);
  }

  // Enemy speed/senses for this level - decoupled from the mission's map position
  function resolveDifficulty(num, levelData) {
    if (s.mode === "random") return num;
    if (levelData && typeof levelData.difficulty === "number" && levelData.difficulty >= 0) {
      return Math.min(Math.floor(levelData.difficulty), DIFFICULTY_MAX);
    }
    if (s.mode === "tutorial") return num;
    if (s.mode === "custom" && Game.map) {
      var label = Game.map.difficultyLabel(num);
      if (DIFFICULTY_BY_LABEL[label] !== undefined) return DIFFICULTY_BY_LABEL[label];
    }
    return 0;
  }

  function getTutorialLevel(num) {
    return Game.tutorials ? Game.tutorials.get(num) : null;
  }

  function getElementRunLevel(num) {
    // One level per run; the level number is the run's place in the manifest
    return Game.elementRun ? Game.elementRun.get(num) : null;
  }

  // ─── Tutorial hints: fire the first unfired hint zone the player is inside ───
  function checkTutorialHints() {
    if (!s.tutorialHints || !s.tutorialHints.length) return;
    for (var i = 0; i < s.tutorialHints.length; i++) {
      var h = s.tutorialHints[i];
      if (h.fired) continue;
      if (Math.abs(s.playerX - h.x) <= h.r && Math.abs(s.playerY - h.y) <= h.r) {
        h.fired = true;
        Game.ui.showHint(h);
        holdForReading(Game.ui.hintReadMs(h));
        return;
      }
    }
  }

  // ─── Quiz: read the question out in the banner whenever the miner walks up
  // to the answer pads (the graffiti on the wall stays as well) ───
  function checkQuizProximity() {
    if (!s.triviaMap) { s.quizNear = false; return; }
    // which unanswered question, if any, has a pad within three tiles:
    // "main" for the level's single quiz, "g<n>" for a gate
    /** @type {false|string} */
    var near = false;
    var question = "";
    for (var k in s.triviaMap) {
      var p = k.split(","), py = +p[0], px = +p[1];
      if (Math.abs(px - s.playerX) > 3 || Math.abs(py - s.playerY) > 3) continue;
      var gi = s.padGate ? s.padGate[k] : undefined;
      if (gi !== undefined) {
        if (s.gates[gi].open || !s.gates[gi].question) continue;
        near = "g" + gi; question = s.gates[gi].question;
      } else {
        if (!s.triviaQuestion || !s.triviaAnswer) continue;
        near = "main"; question = s.triviaQuestion;
      }
      break;
    }
    // standing on a pad means an answer was just given: leave that verdict on screen
    var onPad = !!s.triviaMap[s.playerY + "," + s.playerX];
    if (near && near !== s.quizNear && !onPad) {
      Game.ui.showHint({ icon: "❓", title: "THE DOOR ASKS", silent: true,
        text: "<strong>" + plainText(question) + "</strong> Step on the pad with the right element. A wrong pad costs " + QUIZ_PENALTY_SECONDS + " seconds." });
    }
    s.quizNear = near;
  }

  function showMissionLoadError(err) {
    console.error("Failed to load mission levels.", err);

    var status = document.getElementById("menu-status");
    var missionBtn = /** @type {HTMLButtonElement} */ (document.getElementById("mission-mode-btn"));
    if (status) {
      status.textContent = "Mission files failed to load. If you use local files, run Rebuild Mission Bundle.command after editing levels.";
      status.style.color = "var(--red)";
    }
    if (missionBtn) missionBtn.disabled = true;

    Game.ui.showMenu();
  }

  var runSeq = 0;   // tells two games started in the same millisecond apart
  function startLevel(num) {
    Game.ui.closeNotebook();
    clearIntervals();
    resetHeldMovementState();
    s.deathAnim = null;
    s.placedDynamite = [];
    document.getElementById("game-overlay").classList.remove("visible");
    document.getElementById("menu-overlay").classList.add("hidden");
    var factToast = document.getElementById("fact-toast"); if (factToast) factToast.classList.remove("visible");
    var pauseOv = document.getElementById("pause-overlay");
    if (pauseOv) pauseOv.classList.add("hidden");
    SFX.stopMenuMusic();
    document.getElementById("collection-log").innerHTML = '<div class="log-entry log-empty">Dig through earth to find minerals...</div>';
    document.getElementById("ep-empty").style.display = "";
    document.getElementById("ep-content").style.display = "none";
    document.getElementById("elem-panel").classList.remove("has-elem", "flash");

    // Endless: abandoning a run mid-level (restart key) forfeits its
    // discoveries and luck streak exactly as a death would
    if (s.mode === "random" && s.runActive && s.ptSnapshot) {
      s.ptDiscovered = (s.pushingLuck && s.ptStashedSnapshot) ? s.ptStashedSnapshot : s.ptSnapshot;
      Game.ui.savePTProgress();
      s.pushingLuck = false;
      s.luckStreak = 0;
      s.unstashedDiscoveries = [];
      s.ptStashedSnapshot = null;
    }

    // Items only carry forward between Endless depths. Every other level starts
    // empty-handed, and retrying a depth restores what you arrived with.
    if (s.mode !== "random" || num === 0) s.inventory = [0, 0, 0, 0, 0];
    else if (num === s.level && s.levelStartInventory) s.inventory = s.levelStartInventory.slice();
    while (s.inventory.length < PU_INFO.length) s.inventory.push(0);
    s.levelStartInventory = s.inventory.slice();

    // The score runs on through an Endless game: it carries from depth to
    // depth, and retrying a depth goes back to the score you arrived with.
    // Everywhere else a level starts at nothing.
    if (s.mode !== "random" || num === 0) { s.score = 0; s.endlessRunId = Date.now() * 1000 + (runSeq++ % 1000); }
    else if (num === s.level) s.score = s.levelStartScore || 0;
    s.levelStartScore = s.score;

    s.level = num;
    s.paused = false;
    s.restartArmed = false;
    s.keysCollected = 0;

    s.tutorialHints = [];
    s.hintHoldFrom = 0; s.hintHoldUntil = 0; s.lastActionAt = 0; s.mineWaiting = false;
    s.quizNear = false;
    s.readFreeze = 0;
    s.collectEffects = [];
    s.runBonusCollected = {};
    s.tbms = [];
    s.checkpoint = null;
    s.riding = null;
    s.ridingRoll = null;
    s.gasExposure = 0;
    s.gasLevel = {};
    s.pumps = [];
    s.refugeCells = {};
    Game.ui.hideHint();

    var missionLevel = s.mode === "custom" ? getMissionLevel(num)
                     : s.mode === "tutorial" ? getTutorialLevel(num)
                     : s.mode === "elementrun" ? getElementRunLevel(num)
                     : s.mode === "shared" ? Game.sharedLevel.current() : null;
    if (missionLevel) {
      Game.levelGen.loadCustom(missionLevel);
      if (s.mode === "elementrun") Game.ui.renderRunPT();
    } else {
      if (s.mode === "custom" || s.mode === "tutorial" || s.mode === "elementrun" || s.mode === "shared") { s.mode = "random"; }
      Game.levelGen.generateRandom(num);
    }

    s.difficulty = resolveDifficulty(num, missionLevel);
    s.newFinds = 0; s.bonusFound = 0;
    s.bonusTotal = Object.keys(s.hiddenElementMap || {}).length;

    s.running = true;
    s.runActive = true;
    syncPlayerVisualPosition(s.playerX, s.playerY);
    // Snapshot PT state before this run (for rollback on death)
    if (s.mode === "random") {
      if (s.pushingLuck && s.ptStashedSnapshot) {
        s.ptSnapshot = JSON.parse(JSON.stringify(s.ptStashedSnapshot));
      } else {
        s.ptSnapshot = JSON.parse(JSON.stringify(s.ptDiscovered));
      }
    }
    SFX.levelStart();
    if (s.mode === "random") SFX.playLevelMusic(SFX.levelTracksEndless);
    else if (s.mode === "custom" || s.mode === "tutorial" || s.mode === "elementrun" || s.mode === "shared") SFX.playLevelMusic(SFX.levelTracksMission);
    Game.ui.updateHUD();
    // Open with where you are: the real mine behind a mission, or how the
    // endless mine decides what turns up. A level's own first hint may follow.
    if (s.mode === "custom" && Game.map && Game.map.mineInfo) {
      var mine = Game.map.mineInfo(num);
      if (mine) Game.ui.showHint({ icon: mine.flag, title: mine.mine.toUpperCase() + ", " + mine.country.toUpperCase(), text: mine.fact, silent: true });
    } else if (s.mode === "random" && num === 0) {
      Game.ui.showHint({ icon: "\u26cf\ufe0f", title: "ENDLESS DEPTHS", silent: true,
        text: "This mine follows nature: elements that are common in Earth\u2019s crust, such as silicon and iron, turn up often. Gold and platinum are as scarce down here as they really are." });
    }
    checkTutorialHints();

    s.playerDigTime = Date.now();
    if (s.renderReq) cancelAnimationFrame(s.renderReq);

    Game.render.frame();

    startIntervals();
  }

  function startIntervals() {
    clearIntervals();
    var M = Game.machines, P = Game.physics;

    // creatures think faster on harder levels
    every(Math.max(350 - s.difficulty * 25, 180), Game.enemies.moveAll);

    // the level clock (held while a newly found element is being read)
    every(1000, function() {
      if (s.readFreeze > 0) s.readFreeze--; else s.levelTime--;
      P.tickDynamite();
      tickGasExposure();
      if (!s.running) return;
      if (s.levelTime <= 0) { s.levelTime = 0; gameOver(false, "time"); }
      else if (s.levelTime <= 5) SFX.timerUrgent();
      else if (s.levelTime <= 15) SFX.timerTick();
      Game.ui.updateHUD();
    });

    // timed power-ups run down
    every(1000, function() {
      if (s.activeEffects.lamp > 0) s.activeEffects.lamp--;
      if (s.activeEffects.geiger > 0) s.activeEffects.geiger--;
      if (s.activeEffects.mask > 0) s.activeEffects.mask--;
      Game.ui.updateHUD();
    });

    every(400, P.tickWater);
    every(800, P.tickLava);
    every(600, P.tickGas);
    every(600, M.tickPumps);
    every(5000, Game.enemies.tickSpiderNests);
    every(2000, P.tickBasalt);
    every(GRAVITY_TICK_MS, function() { P.applyGravity(); Game.render.frame(); });
    every(100, M.tickRollingBarrels);

    // machines move in small steps; any of them can end the level
    every(50, function() {
      var steps = [M.tickBouncingCarts, M.tickShaftLifts, M.tickTBMs, M.tickRidingRoll, M.tickRollingCarts];
      for (var i = 0; i < steps.length; i++) { steps[i](); if (!s.running) return; }
      Game.render.frame();
    });
  }

  // ─── Gas suffocation (1 s cadence from the timer interval) ───
  function tickGasExposure() {
    var inGas = s.playerOnGas === true;
    if (inGas && !(s.activeEffects.mask > 0)) {
      s.gasExposure = Math.min(1, (s.gasExposure || 0) + 0.4);
      if (s.gasExposure >= 1) { gameOver(false, "gas"); return; }
      if (s.gasExposure >= 0.4) SFX.timerTick();
    } else {
      s.gasExposure = Math.max(0, (s.gasExposure || 0) - 0.5);
    }
  }

  // Buttons stop the click reaching the overlay, which would resume the game
  var PAUSE_HTML = '&#9208;&#65039; PAUSED' +
    '<div class="pause-btns">' +
    '<button class="overlay-btn primary" data-action="togglePause">&#9654; RESUME</button>' +
    '<button class="overlay-btn secondary" data-action="requestRestart">&#8635; RESTART</button>' +
    '<button class="overlay-btn secondary" data-action="quitToMenu">MENU</button>' +
    '</div><span class="pause-keys">Press <kbd>P</kbd>, or click anywhere else, to resume</span>';
  var RESTART_HTML = '&#8635; RESTART LEVEL?<span>Everything collected in this level will be lost.</span>' +
    '<div class="pause-btns">' +
    '<button class="overlay-btn primary" data-action="requestRestart">YES, RESTART</button>' +
    '<button class="overlay-btn secondary" data-action="togglePause">KEEP MINING</button>' +
    '</div><span class="pause-keys">Or press <kbd>R</kbd> again to restart, <kbd>P</kbd> to keep mining</span>';

  function setPauseCard(html) {
    var card = document.querySelector("#pause-overlay .pause-card");
    if (card) card.innerHTML = html;
  }

  function togglePause() {
    if (!s.running || s.deathAnim) return;
    s.paused = !s.paused;
    s.restartArmed = false;
    setPauseCard(PAUSE_HTML);
    resetHeldMovementState();
    var ov = document.getElementById("pause-overlay");
    if (ov) ov.classList.toggle("hidden", !s.paused);
    SFX.holdMusic(s.paused);
  }

  // Restart key: a level in progress pauses and asks first; a second press
  // confirms. Once the run is over (death / win screen) it restarts at once.
  function requestRestart() {
    if (!s.running || s.deathAnim || s.restartArmed) { startLevel(s.level); return; }
    if (!s.paused) togglePause();
    s.restartArmed = true;
    setPauseCard(RESTART_HTML);
  }

  // Leave the level from the pause menu
  function quitToMenu() {
    s.running = false; s.paused = false; s.restartArmed = false; s.deathAnim = null;
    clearIntervals();
    resetHeldMovementState();
    SFX.stopLevelMusic();
    var ov = document.getElementById("pause-overlay"); if (ov) ov.classList.add("hidden");
    if (s.mode === "custom" && Game.map) Game.map.show(); else Game.ui.showMenu();
  }

  // mode "elementrun" opens the list of runs; startElementRun(i) starts one
  function beginGame(mode, levelIndex) {
    var selectedMode = mode || "random";
    var firstLevel = levelIndex || 0;

    function startSelectedMode() {
      s.mode = selectedMode;
      s.runActive = false;
      if (selectedMode === "random") {
        // Every new Endless game starts with a fresh periodic table -
        // push-your-luck stashing still protects discoveries within the game
        s.ptDiscovered = {};
        Game.ui.savePTProgress();
      } else {
        Game.ui.loadPTProgress();
      }
      s.pushingLuck = false;
      s.luckStreak = 0;
      s.unstashedDiscoveries = [];
      s.ptStashedSnapshot = null;
      document.getElementById("menu-overlay").classList.add("hidden");
      startLevel(firstLevel);
    }

    if (selectedMode === "custom" && Game.levels) {
      // Missions are free-choice: open the world mine map instead of level 1
      Game.levels.whenReady().then(function() {
        if (Game.map) { Game.map.show(); } else { startSelectedMode(); }
      }).catch(showMissionLoadError);
      return;
    }

    if (selectedMode === "tutorial" && Game.tutorials) {
      Game.tutorials.whenReady().then(startSelectedMode).catch(showMissionLoadError);
      return;
    }

    if (selectedMode === "elementrun" && Game.elementRun) {
      Game.elementRun.whenReady().then(function() {
        if (levelIndex === undefined && Game.elementRun.getCount() > 1) { Game.ui.showRunChooser(); return; }
        Game.ui.hideRunChooser();
        startSelectedMode();
      }).catch(showMissionLoadError);
      return;
    }

    startSelectedMode();
  }

  function stashAndContinue(num) {
    Game.ui.savePTProgress();
    s.pushingLuck = false;
    s.luckStreak = 0;
    s.unstashedDiscoveries = [];
    s.ptStashedSnapshot = null;
    startLevel(num);
  }

  function pushLuckAndContinue(num) {
    if (!s.ptStashedSnapshot) {
      // First push - stash point is the pre-level state (this level's discoveries are now at risk)
      s.ptStashedSnapshot = JSON.parse(JSON.stringify(s.ptSnapshot));
      // Revert localStorage to the safe stash point
      var current = s.ptDiscovered;
      s.ptDiscovered = s.ptStashedSnapshot;
      Game.ui.savePTProgress();
      s.ptDiscovered = current;
      // Track this level's discoveries as at-risk
      for (var sym in current) {
        if (!s.ptStashedSnapshot[sym]) s.unstashedDiscoveries.push(sym);
      }
    }
    s.pushingLuck = true;
    s.luckStreak++;
    startLevel(num);
  }

  // ─── Public API ───
  Game.loop = {
    clearIntervals: clearIntervals,
    movePlayer: movePlayer,
    mineWaits: mineWaits,
    getPlayerVisualPosition: getPlayerVisualPosition,
    tickInput: tickInput,
    usePowerup: usePowerup,
    collectElement: collectElement,
    collectBonusElement: collectBonusElement,
    startLevel: startLevel,
    gameOver: gameOver,
    beginGame: beginGame,
    startPlayerVisualMove: startPlayerVisualMove,
    togglePause: togglePause,
    requestRestart: requestRestart,
    quitToMenu: quitToMenu
  };

  window.startLevel = startLevel;
  window.beginGame = beginGame;
  window.startElementRun = function(i) { beginGame("elementrun", i); };
  window.stashAndContinue = stashAndContinue;
  window.pushLuckAndContinue = pushLuckAndContinue;

  // ─── Init: name input + show menu ───
  (function() {
    var mc = document.querySelector(".menu-card");
    var modeBtns = document.getElementById("mode-buttons");
    var nameDiv = document.createElement("div");
    nameDiv.className = "name-row";
    nameDiv.innerHTML = '<label for="player-name">MINER\u2019S NAME</label>' +
      '<input class="name-input" id="player-name" type="text" value="' + s.playerName + '" maxlength="10" placeholder="YOUR NAME">';

    if (mc && modeBtns) mc.insertBefore(nameDiv, modeBtns);

    var nameInput = /** @type {HTMLInputElement} */ (document.getElementById("player-name"));
    if (nameInput) {
      nameInput.addEventListener("input", function() {
        s.playerName = nameInput.value.replace(/[^a-zA-Z0-9 _-]/g, "").toUpperCase() || "MINER";
      });
      nameInput.addEventListener("keydown", function(e) {
        if (e.key === "Enter") { e.preventDefault(); beginGame('custom'); }
      });
    }

    var menuStatus = document.getElementById("menu-status");
    var missionBtn = /** @type {HTMLButtonElement} */ (document.getElementById("mission-mode-btn"));
    if (menuStatus) {
      menuStatus.textContent = "Loading mission files...";
      menuStatus.style.color = "#778";
    }

    Game.levels.loadAllLevels().then(function() {
      if (missionBtn) missionBtn.disabled = false;
      if (menuStatus) menuStatus.textContent = "";
      Game.ui.showMenu();
    }).catch(showMissionLoadError);

    var tutorialBtn = /** @type {HTMLButtonElement} */ (document.getElementById("tutorial-mode-btn"));
    Game.tutorials.loadAllLevels().then(function() {
      if (tutorialBtn) tutorialBtn.disabled = false;
    }).catch(function(err) {
      console.error("Failed to load tutorial levels.", err);
      if (tutorialBtn) { tutorialBtn.disabled = true; tutorialBtn.title = "Tutorial levels failed to load"; }
    });

    var elementRunBtn = /** @type {HTMLButtonElement} */ (document.getElementById("elementrun-mode-btn"));
    Game.elementRun.loadAllLevels().then(function() {
      if (elementRunBtn) elementRunBtn.disabled = false;
    }).catch(function(err) {
      console.error("Failed to load element run level.", err);
      if (elementRunBtn) { elementRunBtn.disabled = true; elementRunBtn.title = "Element run level failed to load"; }
    });

    // The ten further missions in BonusLevels/
    Game.bonusLevels.loadAllLevels();
  })();
})();
