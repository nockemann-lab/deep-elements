"use strict";

// ═══════════════════════════════════════════════════════════════════
// physics.js - Boulder gravity, dynamite, water flow
// ═══════════════════════════════════════════════════════════════════

(function() {
  var s = Game.state;

  Game.physics = {

    boulderKey: function(x, y) { return x + "," + y; },

    // Visual slide for tile moves (boulders/barrels): render.js draws the
    // tile offset from where it came from, easing into place over ~1 tick
    // accel: the tile starts from rest (first tile of a fall) and eases in
    slideTo: function(nx, ny, dx, dy, accel) {
      if (!s.tileSlide) s.tileSlide = {};
      s.tileSlide[nx + "," + ny] = { dx: dx, dy: dy, start: Date.now(), dur: GRAVITY_TICK_MS, accel: !!accel };
    },

    // A boulder that was falling last tick has come to rest: a short visual
    // bounce and a puff of dust (purely cosmetic - the grid is already settled)
    landBoulder: function(x, y) {
      if (!s.tileBounce) s.tileBounce = {};
      s.tileBounce[x + "," + y] = { start: Date.now() };
      var colors = ["#8a8a9a", "#6e6e80", "#a8a090", "#5a5a6a"];
      for (var i = 0; i < 8; i++) {
        var side = i % 2 ? 1 : -1;
        s.digParticles.push({
          x: x + side * (0.15 + Math.random() * 0.3), y: y + 0.42,
          vx: side * (0.5 + Math.random() * 1.3), vy: -(0.2 + Math.random() * 0.9),
          size: 1 + Math.random() * 1.8, color: colors[i % colors.length],
          life: 1, decay: 0.035 + Math.random() * 0.02, gravity: 0.03
        });
      }
    },

    applyGravity: function() {
      var self = Game.physics;
      var newFalling = {};
      // --- Toxic barrel gravity ---
      for (var y = s.rows - 2; y >= 1; y--) for (var x = 1; x < s.cols - 1; x++) {
        if (s.grid[y][x] !== T.HAZARD) continue;
        var hBelow = s.grid[y + 1][x];
        var hEnemy = s.enemies.find(function(e) { return e.alive && e.x === x && e.y === y + 1; });
        if (hEnemy && hEnemy.type === "crab") { hBelow = T.ROCK; hEnemy = null; }
        if (hEnemy) {
          // Barrel falls onto enemy - explode the barrel and crush the enemy
          Game.enemies.checkBoulderCrush(x, y + 1);
          s.grid[y][x] = T.EMPTY;
          delete s.hazardFalling[self.boulderKey(x, y)];
          Game.physics.detonateToxicBarrel(x, y);
        }
        else if (hBelow === T.EMPTY || hBelow === T.WATER || hBelow === T.LAVA) {
          // Barrel is falling - move it down
          s.grid[y][x] = T.EMPTY; s.grid[y + 1][x] = T.HAZARD; SFX.boulderFall();
          self.slideTo(x, y + 1, 0, 1, !s.hazardFalling[self.boulderKey(x, y)]);
          newFalling[self.boulderKey(x, y + 1)] = true;
          delete s.hazardFalling[self.boulderKey(x, y)];
          s.hazardFalling[self.boulderKey(x, y + 1)] = true;
        }
        else if ((hBelow === T.BOULDER || hBelow === T.ROCK || hBelow === T.WALL || hBelow === T.HAZARD || hBelow === T.EARTH || hBelow === T.EARTH_RICH || hBelow === T.ROLL_BARREL || hBelow === T.ICE || hBelow === T.SPIDER_NEST || hBelow === T.BASALT) && s.hazardFalling[self.boulderKey(x, y)]) {
          // Barrel landed on something solid after falling - toxic explosion!
          s.grid[y][x] = T.EMPTY;
          delete s.hazardFalling[self.boulderKey(x, y)];
          Game.physics.detonateToxicBarrel(x, y);
        }
        else if (hBelow === T.PLAYER && s.hazardFalling[self.boulderKey(x, y)]) {
          // Barrel lands on player
          s.grid[y][x] = T.EMPTY;
          delete s.hazardFalling[self.boulderKey(x, y)];
          Game.physics.detonateToxicBarrel(x, y);
          Game.loop.gameOver(false, "toxic"); return;
        }
        else if (hBelow === T.BOULDER || hBelow === T.ROCK || hBelow === T.WALL || hBelow === T.HAZARD || hBelow === T.ROLL_BARREL || hBelow === T.ICE || hBelow === T.SPIDER_NEST || hBelow === T.BASALT) {
          // Roll sideways like boulders (only if NOT already falling - prevents instant explosion on level start)
          var hsd = Math.random() < 0.5 ? [-1, 1] : [1, -1];
          for (var hsi = 0; hsi < hsd.length; hsi++) {
            var hdd = hsd[hsi];
            if (x + hdd > 0 && x + hdd < s.cols - 1 && s.grid[y][x + hdd] === T.EMPTY && s.grid[y + 1][x + hdd] === T.EMPTY) {
              if (!s.enemies.some(function(e2) { return e2.alive && e2.x === x + hdd && e2.y === y; })) {
                s.grid[y][x] = T.EMPTY; s.grid[y][x + hdd] = T.HAZARD;
                self.slideTo(x + hdd, y, hdd, 0);
                newFalling[self.boulderKey(x + hdd, y)] = true;
                s.hazardFalling[self.boulderKey(x + hdd, y)] = true;
              } break;
            }
          }
        }
      }
      // --- Boulder gravity ---
      for (var y = s.rows - 2; y >= 1; y--) for (var x = 1; x < s.cols - 1; x++) {
        if (s.grid[y][x] !== T.BOULDER) continue;
        var below = s.grid[y + 1][x];
        var eB = s.enemies.find(function(e) { return e.alive && e.x === x && e.y === y + 1; });

        if (eB && eB.type === "crab") { below = T.ROCK; eB = null; }

        var bcBelow = s.bouncingCarts ? s.bouncingCarts.findIndex(function(bc) {
          return bc.y === y + 1 && Math.abs(bc.floatX - x) < 0.85;
        }) : -1;
        var slBelow = s.shaftLifts ? s.shaftLifts.findIndex(function(sl) {
          return sl.x === x && Math.abs(sl.floatY - (y + 1)) < 0.85;
        }) : -1;

        if (below === T.EMPTY || below === T.WATER || below === T.LAVA || eB) {
          if (eB) Game.enemies.checkBoulderCrush(x, y + 1);
          if (bcBelow >= 0 && s.fallingBoulders[self.boulderKey(x, y)]) {
            s.bouncingCarts.splice(bcBelow, 1);
            SFX.crushEnemy("cart");
            s.crushEffects.push({ x:x, y:y + 1, type:"cart_bounce", startTime:Date.now(), particles:[] });
            Game.ui.addLog("\ud83d\udca5", "Boulder crushed the rogue minecart!", "crush-log");
            s.score += 25; Game.ui.updateHUD();
          }
          if (slBelow >= 0 && s.fallingBoulders[self.boulderKey(x, y)]) {
            s.shaftLifts.splice(slBelow, 1);
            SFX.crushEnemy("cart");
            s.crushEffects.push({ x:x, y:y + 1, type:"shaft_lift", startTime:Date.now(), particles:[] });
            Game.ui.addLog("\ud83d\udca5", "Boulder smashed the mining shaft lift!", "crush-log");
            s.score += 25; Game.ui.updateHUD();
          }
          s.grid[y][x] = T.EMPTY; s.grid[y + 1][x] = T.BOULDER; SFX.boulderFall();
          self.slideTo(x, y + 1, 0, 1, !s.fallingBoulders[self.boulderKey(x, y)]);
          newFalling[self.boulderKey(x, y + 1)] = true;
          // Boulder landing on placed dynamite triggers detonation
          for (var di = s.placedDynamite.length - 1; di >= 0; di--) {
            var dyn = s.placedDynamite[di];
            if (dyn.x === x && dyn.y === y + 1) {
              s.placedDynamite.splice(di, 1);
              Game.physics.detonateDynamite(x, y + 1);
              break;
            }
          }
        }
        else if (below === T.POWERUP && s.powerupMap[(y + 1) + "," + x] === PU.DYNAMITE && s.fallingBoulders[self.boulderKey(x, y)]) {
          // Boulder falls onto dynamite power-up: consume it and explode
          delete s.powerupMap[(y + 1) + "," + x];
          s.grid[y][x] = T.EMPTY; s.grid[y + 1][x] = T.BOULDER; SFX.boulderFall();
          self.slideTo(x, y + 1, 0, 1);
          newFalling[self.boulderKey(x, y + 1)] = true;
          Game.physics.detonateDynamite(x, y + 1);
        }
        else if (below === T.PLAYER && s.fallingBoulders[self.boulderKey(x, y)]) {
          s.grid[y][x] = T.EMPTY; s.grid[y + 1][x] = T.BOULDER; SFX.boulderFall();
          Game.loop.gameOver(false, "boulder"); return;
        }
        else if (below === T.HAZARD && s.fallingBoulders[self.boulderKey(x, y)]) {
          // Boulder falls onto toxic barrel - detonate it
          s.grid[y + 1][x] = T.EMPTY;
          Game.physics.detonateToxicBarrel(x, y + 1);
        }
        else if (below === T.ROLL_BARREL && s.fallingBoulders[self.boulderKey(x, y)]) {
          // Boulder falls onto rolling barrel - detonate it
          s.grid[y + 1][x] = T.EMPTY;
          Game.physics.detonateToxicBarrel(x, y + 1);
        }
        else if ((below === T.EARTH || below === T.EARTH_RICH) && s.fallingBoulders[self.boulderKey(x, y)]) {
          SFX.boulderImpact();
        }
        else if (below === T.BOULDER || below === T.ROCK || below === T.WALL || below === T.HAZARD || below === T.ROLL_BARREL || below === T.ICE || below === T.SPIDER_NEST || below === T.BASALT) {
          if (s.fallingBoulders[self.boulderKey(x, y)]) SFX.boulderImpact();
          var sd = Math.random() < 0.5 ? [-1, 1] : [1, -1];
          for (var si = 0; si < sd.length; si++) {
            var dd = sd[si];
            if (x + dd > 0 && x + dd < s.cols - 1 && s.grid[y][x + dd] === T.EMPTY && s.grid[y + 1][x + dd] === T.EMPTY) {
              if (!s.enemies.some(function(e2) { return e2.alive && e2.x === x + dd && e2.y === y; })) {
                s.grid[y][x] = T.EMPTY; s.grid[y][x + dd] = T.BOULDER;
                self.slideTo(x + dd, y, dd, 0);
                newFalling[self.boulderKey(x + dd, y)] = true;
              } break;
            }
          }
        }
      }
      // Boulders that were moving last tick and have now settled
      for (var fk in s.fallingBoulders) {
        if (newFalling[fk]) continue;
        var fp = fk.split(","), fx = +fp[0], fy = +fp[1];
        if (s.grid[fy] && s.grid[fy][fx] === T.BOULDER) self.landBoulder(fx, fy);
      }
      s.fallingBoulders = newFalling;
      // --- Rolling barrel gravity ---
      for (var y = s.rows - 2; y >= 1; y--) for (var x = 1; x < s.cols - 1; x++) {
        if (s.grid[y][x] !== T.ROLL_BARREL) continue;
        var rbBelow = s.grid[y + 1][x];
        if (rbBelow === T.EMPTY || rbBelow === T.WATER || rbBelow === T.LAVA) {
          s.grid[y][x] = T.EMPTY; s.grid[y + 1][x] = T.ROLL_BARREL; SFX.boulderFall();
          s.rollingBarrelFalling[self.boulderKey(x, y + 1)] = true;
          delete s.rollingBarrelFalling[self.boulderKey(x, y)];
        }
        else if (s.rollingBarrelFalling[self.boulderKey(x, y)]) {
          // Landed on something solid after falling - explode
          s.grid[y][x] = T.EMPTY;
          delete s.rollingBarrelFalling[self.boulderKey(x, y)];
          Game.physics.detonateToxicBarrel(x, y);
        }
      }
    },

    detonateToxicBarrel: function(dx, dy) {
      var gasHit = null;
      for (var gy2 = -2; gy2 <= 2; gy2++) for (var gx2 = -2; gx2 <= 2; gx2++) {
        var ggx = dx + gx2, ggy = dy + gy2;
        if (ggx > 0 && ggx < s.cols - 1 && ggy > 0 && ggy < s.rows - 1) {
          var ggt = s.grid[ggy][ggx];
          if (ggt === T.GAS || ggt === T.GAS_SRC) { gasHit = { x: ggx, y: ggy }; }
        }
      }

      SFX.explode();
      Game.enemies.triggerTremor(dx, dy);
      var particles = [];
      for (var pi = 0; pi < 20; pi++) {
        var angle = Math.random() * Math.PI * 2;
        var speed = 0.6 + Math.random() * 2.0;
        var type = pi < 7 ? "droplet" : pi < 14 ? "mist" : "shard";
        particles.push({
          angle: angle, speed: speed, type: type,
          size: type === "shard" ? 2 + Math.random() * 3 : 1.5 + Math.random() * 2.5,
          rot: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 5,
          drag: 0.90 + Math.random() * 0.06,
          color: type === "droplet" ? (Math.random() > 0.5 ? "#40e060" : "#30c050") :
                 type === "mist" ? (Math.random() > 0.5 ? "#80ff80" : "#60e860") :
                 (Math.random() > 0.5 ? "#a09020" : "#807018")
        });
      }
      s.explosionEffects.push({ x:dx, y:dy, startTime:Date.now(), particles:particles, toxic:true });
      s.screenShake = 5;
      s.screenShakeTime = Date.now();

      // 3×3 blast radius (smaller than dynamite's 5×5)
      for (var ey = -1; ey <= 1; ey++) for (var ex = -1; ex <= 1; ex++) {
        var bx = dx + ex, by = dy + ey;
        if (bx <= 0 || bx >= s.cols - 1 || by <= 0 || by >= s.rows - 1) continue;
        var t = s.grid[by][bx];
        if (t === T.EARTH || t === T.EARTH_RICH || t === T.FUSE || t === T.ICE) s.grid[by][bx] = T.EMPTY;
        if (t === T.ROLL_BARREL) s.grid[by][bx] = T.EMPTY;
        if (t === T.HIDDEN_ELEM) Game.physics.blastHiddenElement(bx, by);
        if (t === T.WATER_SRC) { s.grid[by][bx] = T.WATER; }
        if (t === T.LAVA_SRC) { s.grid[by][bx] = T.LAVA; }
        Game.enemies.checkBoulderCrush(bx, by);
        if (bx === s.playerX && by === s.playerY && ex === 0 && ey === 0) { Game.loop.gameOver(false, "toxic"); return; }
      }
      s.score += 15; Game.ui.addLog("\u2622\ufe0f", "Toxic barrel exploded! +15", "crush-log");
      if (gasHit) { Game.physics.igniteGas(gasHit.x, gasHit.y); if (!s.running) return; }
      Game.physics.applyGravity(); Game.ui.updateHUD(); Game.render.frame();
    },

    // A blast reaching a hidden bonus element: with the Geiger running it is
    // collected; otherwise it stays buried rather than being silently lost
    blastHiddenElement: function(bx, by) {
      var k = by + "," + bx, hk = s.hiddenElementMap[k];
      if (!hk) { s.grid[by][bx] = T.EMPTY; return; }
      if (s.activeEffects.geiger > 0) {
        delete s.hiddenElementMap[k];
        s.grid[by][bx] = T.EMPTY;
        Game.loop.collectBonusElement(hk, bx, by);
      } else {
        Game.ui.addLog("❓", "Something glinted in the rubble... it survived the blast - come back with a Geiger Counter!", "");
      }
    },

    tickDynamite: function() {
      for (var i = s.placedDynamite.length - 1; i >= 0; i--) {
        s.placedDynamite[i].fuse--;
        if (s.placedDynamite[i].fuse <= 0) {
          // taken off the list first: a stick must never go off twice
          var stick = s.placedDynamite.splice(i, 1)[0];
          Game.physics.detonateDynamite(stick.x, stick.y);
        }
      }
    },

    detonateDynamite: function(dx, dy) {
      var gasHit = null;
      for (var gy2 = -2; gy2 <= 2; gy2++) for (var gx2 = -2; gx2 <= 2; gx2++) {
        var ggx = dx + gx2, ggy = dy + gy2;
        if (ggx > 0 && ggx < s.cols - 1 && ggy > 0 && ggy < s.rows - 1) {
          var ggt = s.grid[ggy][ggx];
          if (ggt === T.GAS || ggt === T.GAS_SRC) { gasHit = { x: ggx, y: ggy }; }
        }
      }

      SFX.explode();
      Game.enemies.triggerTremor(dx, dy);
      var particles = [];
      for (var pi = 0; pi < 24; pi++) {
        var angle = Math.random() * Math.PI * 2;
        var speed = 0.8 + Math.random() * 2.5;
        var type = pi < 8 ? "ember" : pi < 16 ? "spark" : "shard";
        particles.push({
          angle: angle, speed: speed, type: type,
          size: type === "shard" ? 2 + Math.random() * 3 : 1 + Math.random() * 2,
          rot: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 8,
          drag: 0.92 + Math.random() * 0.05,
          color: type === "ember" ? (Math.random() > 0.5 ? "#ff6600" : "#ff3300") :
                 type === "spark" ? (Math.random() > 0.5 ? "#ffdd00" : "#ffaa00") :
                 (Math.random() > 0.5 ? "#8a7060" : "#6a5040")
        });
      }
      s.explosionEffects.push({ x:dx, y:dy, startTime:Date.now(), particles:particles });
      s.screenShake = 8;
      s.screenShakeTime = Date.now();

      var hitWaterSrc = false;
      for (var ey = -2; ey <= 2; ey++) for (var ex = -2; ex <= 2; ex++) {
        var bx = dx + ex, by = dy + ey;
        if (bx <= 0 || bx >= s.cols - 1 || by <= 0 || by >= s.rows - 1) continue;
        var inner = Math.abs(ex) <= 1 && Math.abs(ey) <= 1;
        var t = s.grid[by][bx];
        if (inner) {
          if (t === T.EARTH || t === T.EARTH_RICH || t === T.BOULDER || t === T.FUSE || t === T.HAZARD || t === T.ROLL_BARREL || t === T.ICE || t === T.LAVA || t === T.SPIDER_NEST || t === T.BASALT || t === T.GAS_SRC) s.grid[by][bx] = T.EMPTY;
          if (t === T.BASALT) delete s.basaltLife[by + "," + bx];
          if (t === T.SPIDER_NEST) Game.ui.addLog("\ud83d\udd78\ufe0f", "Spider nest destroyed!", "powerup-log");
          if (t === T.HIDDEN_ELEM) Game.physics.blastHiddenElement(bx, by);
          if (t === T.POWERUP) { var pk = s.powerupMap[by + "," + bx]; if (pk !== undefined && PU_INFO[pk]) { s.inventory[pk]++; delete s.powerupMap[by + "," + bx]; s.grid[by][bx] = T.EMPTY; } }
          if (t === T.WATER_SRC) { s.grid[by][bx] = T.WATER; hitWaterSrc = true; }
          if (t === T.LAVA_SRC) { s.grid[by][bx] = T.LAVA; }
        } else {
          if (t === T.EARTH || t === T.EARTH_RICH || t === T.FUSE) s.grid[by][bx] = T.EMPTY;
          if (t === T.LAVA) s.grid[by][bx] = T.EMPTY;
          if (t === T.WATER_SRC) { s.grid[by][bx] = T.WATER; hitWaterSrc = true; }
          if (t === T.LAVA_SRC) { s.grid[by][bx] = T.LAVA; }
        }
        Game.enemies.checkBoulderCrush(bx, by);
        // Clear partial lava fills in blast radius
        var llk = by + "," + bx;
        if (s.lavaLevel[llk]) delete s.lavaLevel[llk];
        // Player is only killed in the inner 3×3 zone (enemies remain affected by the full 5×5)
        if (inner && bx === s.playerX && by === s.playerY) { Game.loop.gameOver(false, "dynamite"); return; }
      }
      // Explosion near water source: accelerate flooding
      if (hitWaterSrc) {
        var wl = s.waterLevel;
        for (var wy = -3; wy <= 3; wy++) for (var wx = -3; wx <= 3; wx++) {
          var sx = dx + wx, sy = dy + wy;
          if (sx <= 0 || sx >= s.cols - 1 || sy <= 0 || sy >= s.rows - 1) continue;
          var st = s.grid[sy][sx];
          var sk = sy + "," + sx;
          if (wl[sk]) { wl[sk].rate = Math.min(wl[sk].rate * 3, 0.5); }
          else if (st === T.EMPTY) { wl[sk] = { level: 0.3, rate: 0.25 }; }
        }
        Game.ui.addLog("\ud83c\udf0a", "Explosion ruptured a water source! Flooding accelerated!", "crush-log");
      }
      for (var i = 0; i < s.enemies.length; i++) {
        if (s.enemies[i].alive) {
          var dist = Math.abs(s.enemies[i].x - dx) + Math.abs(s.enemies[i].y - dy);
          if (dist < 10) {
            s.enemies[i].lastSeenX = dx; s.enemies[i].lastSeenY = dy;
            if (s.enemies[i].state === AI_PATROL) s.enemies[i].state = AI_SEARCH;
            s.enemies[i].chaseTimer = 6;
          }
        }
      }
      s.score += 25; Game.ui.addLog("\ud83d\udca5", "BOOM! Dynamite detonated! +25", "powerup-log");
      if (gasHit) { Game.physics.igniteGas(gasHit.x, gasHit.y); if (!s.running) return; }
      Game.physics.applyGravity(); Game.ui.updateHUD(); Game.render.frame();
    },

    // ─── Gas: spreads UP first, then sideways (the inverse of water) ───
    tickGas: function() {
      if (!s.running || s.paused) return;
      var gl = s.gasLevel;
      var FILL_UP = 0.20, FILL_SIDE = 0.08;
      var changed = false;

      var keys = Object.keys(gl);
      for (var ki = 0; ki < keys.length; ki++) {
        var k = keys[ki];
        var p = k.split(","), gy = +p[0], gx = +p[1];
        var gt = s.grid[gy][gx];
        if (gt !== T.EMPTY) { delete gl[k]; continue; }
        gl[k].level += gl[k].rate;
        if (gl[k].level >= 1.0) {
          s.grid[gy][gx] = T.GAS;
          for (var i = 0; i < s.enemies.length; i++) {
            var en = s.enemies[i];
            if (en.alive && en.x === gx && en.y === gy && en.type === "bat") {
              en.alive = false; s.enemiesKilled++; s.score += 50; SFX.crushEnemy("bat");
              s.crushEffects.push({ x: gx, y: gy, type: "bat", startTime: Date.now(), particles: [] });
              Game.ui.addLog("🦇", "The bat dropped in the gas - miners once carried canaries for exactly this. +50", "crush-log");
              Game.ui.updateHUD();
            }
          }
          if (gx === s.playerX && gy === s.playerY) {
            s.playerOnGas = true;
            Game.ui.addLog("☁️", "Gas closing in around you!", "crush-log");
          }
          delete gl[k]; changed = true;
        }
      }

      for (var y = 1; y < s.rows - 1; y++) {
        for (var x = 1; x < s.cols - 1; x++) {
          if (s.grid[y][x] !== T.GAS && s.grid[y][x] !== T.GAS_SRC) continue;
          var dirs = [{ dx: 0, dy: -1, r: FILL_UP }, { dx: -1, dy: 0, r: FILL_SIDE }, { dx: 1, dy: 0, r: FILL_SIDE }];
          for (var d = 0; d < dirs.length; d++) {
            var nx = x + dirs[d].dx, ny = y + dirs[d].dy;
            if (nx <= 0 || nx >= s.cols - 1 || ny <= 0 || ny >= s.rows - 1) continue;
            var nk = ny + "," + nx;
            if (gl[nk]) continue;
            if (s.grid[ny][nx] === T.EMPTY) { gl[nk] = { level: dirs[d].r, rate: dirs[d].r }; changed = true; }
          }
        }
      }

      if (changed) Game.render.frame();
    },

    // ─── Firedamp ignition: an explosion touching gas burns the whole cloud ───
    igniteGas: function(sx, sy) {
      var seen = {}, queue = [], cloud = [];
      function push(x, y, d) {
        var k = y + "," + x;
        if (seen[k]) return;
        var t = s.grid[y] && s.grid[y][x];
        if (t !== T.GAS && t !== T.GAS_SRC) return;
        seen[k] = true;
        cloud.push({ x: x, y: y, d: d });
        queue.push([x, y, d]);
      }
      // seed from a 3×3 patch - the recorded cell may have been a pipe the blast cleared
      for (var sy2 = -1; sy2 <= 1; sy2++) for (var sx2 = -1; sx2 <= 1; sx2++) {
        if (sx + sx2 > 0 && sx + sx2 < s.cols - 1 && sy + sy2 > 0 && sy + sy2 < s.rows - 1) push(sx + sx2, sy + sy2, Math.abs(sx2) + Math.abs(sy2));
      }
      while (queue.length) {
        var c = queue.shift();
        push(c[0] + 1, c[1], c[2] + 1); push(c[0] - 1, c[1], c[2] + 1);
        push(c[0], c[1] + 1, c[2] + 1); push(c[0], c[1] - 1, c[2] + 1);
      }
      if (!cloud.length) return false;

      s.screenShake = Math.max(s.screenShake || 0, 7);
      cloud.forEach(function(cell) {
        s.grid[cell.y][cell.x] = T.EMPTY;
        delete s.gasLevel[cell.y + "," + cell.x];
        s.explosionEffects.push({ x: cell.x, y: cell.y, startTime: Date.now() + cell.d * 45, particles: [], toxic: true });
        for (var i = 0; i < s.enemies.length; i++) {
          var en = s.enemies[i];
          if (en.alive && Math.abs(en.x - cell.x) <= 1 && Math.abs(en.y - cell.y) <= 1) {
            en.alive = false; s.enemiesKilled++; s.score += 50;
            s.crushEffects.push({ x: en.x, y: en.y, type: en.type, startTime: Date.now(), particles: [] });
          }
        }
      });
      Game.ui.addLog("🔥", "FIREDAMP! The blast ignited the gas cloud!", "crush-log");
      var playerHit = cloud.some(function(cell) {
        return Math.abs(cell.x - s.playerX) <= 1 && Math.abs(cell.y - s.playerY) <= 1;
      });
      if (playerHit) { Game.loop.gameOver(false, "gasblast"); return true; }
      Game.ui.updateHUD();
      return true;
    },

    tickWater: function() {
      if (!s.running || s.paused) return;
      var wl = s.waterLevel;
      var FILL_DOWN = 0.22, FILL_SIDE = 0.10;
      var changed = false;

      // 1. Advance existing partial fills
      var keys = Object.keys(wl);
      for (var ki = 0; ki < keys.length; ki++) {
        var k = keys[ki];
        var p = k.split(","), wy = +p[0], wx = +p[1];
        var gt = s.grid[wy][wx];
        // Clean up if tile is no longer fillable
        if (gt !== T.EMPTY) { delete wl[k]; continue; }
        wl[k].level += wl[k].rate;
        if (wl[k].level >= 1.0) {
          if (gt === T.EMPTY) {
            s.grid[wy][wx] = T.WATER;
            for (var i = 0; i < s.enemies.length; i++) {
              var en = s.enemies[i];
              if (en.alive && en.x === wx && en.y === wy && en.type === "bat") {
                en.alive = false; s.enemiesKilled++; s.score += 50; SFX.crushEnemy("bat");
                s.crushEffects.push({ x:wx, y:wy, type:"bat", startTime:Date.now(), particles:[] });
                Game.ui.addLog("\ud83e\udd87", "Bat drowned! +50", "crush-log"); Game.ui.updateHUD();
              }
            }
            if (wx === s.playerX && wy === s.playerY) {
              s.playerOnWater = true;
              Game.ui.addLog("\ud83d\udca7", "Water rising around you!", "");
            }
          }
          delete wl[k]; changed = true;
        }
      }

      // 2. Spread from full water tiles to empty neighbors
      for (var y = s.rows - 2; y >= 1; y--) {
        for (var x = 1; x < s.cols - 1; x++) {
          if (s.grid[y][x] !== T.WATER && s.grid[y][x] !== T.WATER_SRC) continue;
          // down first (gravity), then sides
          var dirs = [{dx:0, dy:1, r:FILL_DOWN}, {dx:-1, dy:0, r:FILL_SIDE}, {dx:1, dy:0, r:FILL_SIDE}];
          for (var d = 0; d < dirs.length; d++) {
            var nx = x + dirs[d].dx, ny = y + dirs[d].dy;
            if (nx <= 0 || nx >= s.cols - 1 || ny <= 0 || ny >= s.rows - 1) continue;
            var nk = ny + "," + nx;
            if (wl[nk]) continue;
            var t = s.grid[ny][nx];
            if (t === T.EMPTY) {
              wl[nk] = { level: dirs[d].r, rate: dirs[d].r };
              changed = true;
            }
          }
        }
      }

      if (changed) SFX.waterDrip();
      if (changed || keys.length > 0) Game.render.frame();
    },

    tickLava: function() {
      if (!s.running || s.paused) return;
      var ll = s.lavaLevel;
      var FILL_DOWN = 0.11, FILL_SIDE = 0.05;
      var changed = false;

      // 1. Advance existing partial fills
      var keys = Object.keys(ll);
      for (var ki = 0; ki < keys.length; ki++) {
        var k = keys[ki];
        var p = k.split(","), ly = +p[0], lx = +p[1];
        var gt = s.grid[ly][lx];
        if (gt !== T.EMPTY) { delete ll[k]; continue; }
        ll[k].level += ll[k].rate;
        if (ll[k].level >= 1.0) {
          if (gt === T.EMPTY) {
            s.grid[ly][lx] = T.LAVA;
            // Kill any enemy on this tile
            for (var i = 0; i < s.enemies.length; i++) {
              var en = s.enemies[i];
              if (en.alive && en.x === lx && en.y === ly) {
                en.alive = false; s.enemiesKilled++; s.score += 50; SFX.crushEnemy(en.type);
                s.crushEffects.push({ x:lx, y:ly, type:en.type, startTime:Date.now(), particles:[] });
                Game.ui.addLog("\ud83c\udf0b", ENEMY_TYPES[en.type].name + " burned in lava! +50", "crush-log"); Game.ui.updateHUD();
              }
            }
            // Kill player
            if (lx === s.playerX && ly === s.playerY) {
              Game.loop.gameOver(false, "lava"); return;
            }
          }
          delete ll[k]; changed = true;
        }
      }

      // 2. Spread from full lava tiles to empty neighbors
      for (var y = s.rows - 2; y >= 1; y--) {
        for (var x = 1; x < s.cols - 1; x++) {
          if (s.grid[y][x] !== T.LAVA && s.grid[y][x] !== T.LAVA_SRC) continue;
          var dirs = [{dx:0, dy:1, r:FILL_DOWN}, {dx:-1, dy:0, r:FILL_SIDE}, {dx:1, dy:0, r:FILL_SIDE}];
          for (var d = 0; d < dirs.length; d++) {
            var nx = x + dirs[d].dx, ny = y + dirs[d].dy;
            if (nx <= 0 || nx >= s.cols - 1 || ny <= 0 || ny >= s.rows - 1) continue;
            var nk = ny + "," + nx;
            if (ll[nk]) continue;
            var t = s.grid[ny][nx];
            if (t === T.EMPTY) {
              ll[nk] = { level: dirs[d].r, rate: dirs[d].r };
              changed = true;
            }
          }
        }
      }

      if (changed) SFX.lavaDrip();
      if (changed || keys.length > 0) Game.render.frame();
    },

    tickBasalt: function() {
      if (!s.running || s.paused) return;
      var changed = false;
      for (var y = 1; y < s.rows - 1; y++) {
        for (var x = 1; x < s.cols - 1; x++) {
          if (s.grid[y][x] !== T.BASALT) continue;
          var key = y + "," + x;
          if (s.basaltLife[key] === undefined) s.basaltLife[key] = 100;
          // ticked every second: gone after 8-12 s, cracking visibly as it goes
          s.basaltLife[key] -= 9 + Math.floor(Math.random() * 5);
          if (s.basaltLife[key] <= 0) {
            s.grid[y][x] = T.EMPTY;
            delete s.basaltLife[key];
            SFX.basaltCrumble();
            changed = true;
          }
        }
      }
      if (changed) Game.render.frame();
    }
  };
})();
