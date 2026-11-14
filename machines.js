"use strict";

// ═══════════════════════════════════════════════════════════════════
// machines.js - the mine's moving machinery: runaway carts, shaft
// lifts, tunnel borers, rolling barrels, the cart the miner rides,
// and water pumps. Each tick function is called on a timer by game.js.
// ═══════════════════════════════════════════════════════════════════

(function() {
  var s = Game.state;

  function gameOver(won, cause) { Game.loop.gameOver(won, cause); }
  function startPlayerVisualMove(x, y, now, duration) { Game.loop.startPlayerVisualMove(x, y, now, duration); }

  function tickBouncingCarts() {
    if (!s.bouncingCarts || !s.bouncingCarts.length) return;
    var speed = 0.15;
    for (var i = 0; i < s.bouncingCarts.length; i++) {
      var bc = s.bouncingCarts[i];
      var nextX = bc.floatX + bc.dx * speed;
      var checkX = bc.dx > 0 ? Math.ceil(nextX) : Math.floor(nextX);
      if (checkX < 0 || checkX >= s.cols) {
        bc.dx = -bc.dx;
      } else {
        var tile = s.grid[bc.y][checkX];
        if (tile === T.WALL || tile === T.ROCK || tile === T.BOULDER || tile === T.EARTH || tile === T.EARTH_RICH || tile === T.DOOR) {
          bc.dx = -bc.dx;
        } else {
          bc.floatX = nextX;
        }
      }
      if (bc.y === s.playerY && Math.abs(bc.floatX - s.playerX) < 0.65) {
        gameOver(false, "cart_bounce"); return;
      }
      for (var ei = 0; ei < s.enemies.length; ei++) {
        var en = s.enemies[ei];
        if (en.alive && en.y === bc.y && Math.abs(bc.floatX - en.x) < 0.65) {
          Game.enemies.checkBoulderCrush(en.x, en.y);
          break;
        }
      }
    }
  }

  // ─── Tunnel boring machine: 3×2, patrols horizontally, grinds through
  // everything except walls/doors/pads, spares collectibles, minces the rest ───

  // Kill zone = true sprite overlap with the player's tile, direction-aware:
  // generous behind the machine (following its wake is the intended tactic),
  // tight at the cutter face (which visually protrudes).
  function tbmHitsTile(m, tx, ty) {
    if (ty < m.y || ty > m.y + 1) return false;
    var REAR = 0.6, FRONT = 0.12;   // required overlap before it kills
    var lo = m.dir > 0 ? m.floatX - 1 + REAR : m.floatX - 1 + FRONT;
    var hi = m.dir > 0 ? m.floatX + 3 - FRONT : m.floatX + 3 - REAR;
    return tx > lo && tx < hi;
  }

  function tickTBMs() {
    if (!s.tbms || !s.tbms.length) return;
    var speed = 0.03;
    for (var i = 0; i < s.tbms.length; i++) {
      var m = s.tbms[i];
      var nextX = m.floatX + m.dir * speed;
      var frontCol = m.dir > 0 ? Math.floor(nextX + 3 - 0.001) : Math.floor(nextX + 0.001);
      if (frontCol <= 0 || frontCol >= s.cols - 1) { m.dir = -m.dir; m.lastCol = -1; continue; }
      if (frontCol !== m.lastCol) {
        var blocked = false;
        for (var r = m.y; r <= m.y + 1; r++) {
          var t = s.grid[r][frontCol];
          if (t === T.WALL || t === T.DOOR || t === T.LOGIC_DOOR || t === T.EXIT || t === T.PAD || t === T.REFUGE || t === T.REFUGE_POST) { blocked = true; break; }
        }
        if (blocked) { m.dir = -m.dir; m.lastCol = -1; continue; }
        var drilled = false;
        for (var r2 = m.y; r2 <= m.y + 1; r2++) {
          var t2 = s.grid[r2][frontCol];
          if (t2 === T.ELEMENT || t2 === T.HIDDEN_ELEM || t2 === T.POWERUP || t2 === T.KEY || t2 === T.PLAYER || t2 === T.EMPTY) continue;
          s.grid[r2][frontCol] = T.EMPTY;
          drilled = true;
        }
        m.lastCol = frontCol;
        if (drilled) {
          Game.enemies.triggerTremor(frontCol, m.y);
          if (typeof SFX.boulderPush === "function") SFX.boulderPush();
        }
      }
      m.floatX = nextX;
      for (var ei = 0; ei < s.enemies.length; ei++) {
        var en = s.enemies[ei];
        if (en.alive && en.y >= m.y && en.y <= m.y + 1 && en.x > m.floatX - 0.7 && en.x < m.floatX + 2.7) {
          en.alive = false;
          s.enemiesKilled++;
          s.score += 50;
          s.crushEffects.push({ x: en.x, y: en.y, type: en.type, startTime: Date.now(), particles: [] });
          Game.ui.addLog("🚧", "The tunnel borer minced a " + en.type + "! +50", "crush-log");
          Game.ui.updateHUD();
        }
      }
      if (tbmHitsTile(m, s.playerX, s.playerY)) {
        gameOver(false, "tbm");
        return;
      }
    }
  }

  // ─── Riding roll: glide the player+cart to the launch target ───
  function tickRidingRoll() {
    var r = s.ridingRoll;
    if (!r || !s.riding) return;
    r.acc = (r.acc || 0) + 0.18;
    while (r.acc >= 1 && s.ridingRoll) {
      r.acc -= 1;
      var step = s.playerX + r.dir;
      if (step <= 0 || step >= s.cols - 1) { s.ridingRoll = null; break; }
      // crush anything alive on the rails
      for (var ei = 0; ei < s.enemies.length; ei++) {
        var en = s.enemies[ei];
        if (en.alive && en.x === step && en.y === s.playerY) {
          en.alive = false; s.enemiesKilled++; s.score += 100;
          s.crushEffects.push({ x: en.x, y: en.y, type: en.type, startTime: Date.now(), particles: [] });
          Game.ui.addLog("🛒", "Rolled right over a " + en.type + "! +100", "crush-log");
        }
      }
      var t = s.grid[s.playerY][step];
      if (t !== T.EMPTY && t !== T.WEB && t !== T.WATER && t !== T.LAVA) { s.ridingRoll = null; break; }
      s.grid[s.playerY][s.playerX] = s.riding.under;
      s.riding.under = (t === T.WEB) ? T.EMPTY : t;
      startPlayerVisualMove(step, s.playerY, performance.now(), 280);   // one cart tile per ~280 ms
      s.playerX = step;
      s.grid[s.playerY][s.playerX] = T.PLAYER;
      Game.camera.update();
      if (s.playerX === r.endX) { s.ridingRoll = null; break; }
    }
    if (!s.ridingRoll) Game.ui.updateHUD();
  }

  function tickShaftLifts() {
    if (!s.shaftLifts || !s.shaftLifts.length) return;
    var speed = 0.15;
    for (var i = 0; i < s.shaftLifts.length; i++) {
      var lift = s.shaftLifts[i];
      var nextY = lift.floatY + lift.dy * speed;
      var checkY = lift.dy > 0 ? Math.ceil(nextY) : Math.floor(nextY);
      if (checkY < 0 || checkY >= s.rows) {
        lift.dy = -lift.dy;
      } else {
        var tile = s.grid[checkY][lift.x];
        if (tile === T.WALL || tile === T.ROCK || tile === T.BOULDER || tile === T.EARTH || tile === T.EARTH_RICH || tile === T.DOOR) {
          lift.dy = -lift.dy;
        } else {
          lift.floatY = nextY;
        }
      }
      if (lift.x === s.playerX && Math.abs(lift.floatY - s.playerY) < 0.65) {
        gameOver(false, "shaft_lift"); return;
      }
      for (var ei = 0; ei < s.enemies.length; ei++) {
        var en = s.enemies[ei];
        if (en.alive && en.x === lift.x && Math.abs(lift.floatY - en.y) < 0.65) {
          Game.enemies.checkBoulderCrush(en.x, en.y);
          break;
        }
      }
    }
  }

  function tickRollingBarrels() {
    if (!s.rollingBarrels || !s.rollingBarrels.length) return;
    for (var i = s.rollingBarrels.length - 1; i >= 0; i--) {
      var rb = s.rollingBarrels[i];
      if (rb.falling) {
        // Falling - move down one tile
        var belowY = rb.y + 1;
        if (belowY >= s.rows - 1) {
          // Hit bottom wall - explode
          s.rollingBarrels.splice(i, 1);
          Game.physics.detonateToxicBarrel(rb.x, rb.y);
          continue;
        }
        var belowT = s.grid[belowY][rb.x];
        var belowEnemy = s.enemies.find(function(e) { return e.alive && e.x === rb.x && e.y === belowY; });
        if (belowT === T.EMPTY || belowT === T.WATER || belowT === T.LAVA) {
          rb.y = belowY; SFX.boulderFall();
        } else if (belowEnemy) {
          Game.enemies.checkBoulderCrush(rb.x, belowY);
          s.rollingBarrels.splice(i, 1);
          Game.physics.detonateToxicBarrel(rb.x, rb.y);
          continue;
        } else if (belowT === T.PLAYER) {
          s.rollingBarrels.splice(i, 1);
          Game.physics.detonateToxicBarrel(rb.x, rb.y);
          gameOver(false, "toxic"); return;
        } else {
          // Hit solid ground - explode
          s.rollingBarrels.splice(i, 1);
          Game.physics.detonateToxicBarrel(rb.x, rb.y);
          continue;
        }
      } else {
        // Rolling horizontally
        var nextX = rb.x + rb.dx;
        if (nextX <= 0 || nextX >= s.cols - 1) {
          // Hit wall boundary - explode
          s.rollingBarrels.splice(i, 1);
          Game.physics.detonateToxicBarrel(rb.x, rb.y);
          continue;
        }
        var nextT = s.grid[rb.y][nextX];
        var nextEnemy = s.enemies.find(function(e) { return e.alive && e.x === nextX && e.y === rb.y; });
        if (nextEnemy) {
          // Hit enemy - crush and explode
          Game.enemies.checkBoulderCrush(nextX, rb.y);
          s.rollingBarrels.splice(i, 1);
          Game.physics.detonateToxicBarrel(rb.x, rb.y);
          continue;
        }
        if (nextT === T.PLAYER) {
          s.rollingBarrels.splice(i, 1);
          Game.physics.detonateToxicBarrel(rb.x, rb.y);
          gameOver(false, "toxic"); return;
        }
        if (nextT !== T.EMPTY && nextT !== T.WATER && nextT !== T.LAVA) {
          // Hit solid tile - explode at current position
          s.rollingBarrels.splice(i, 1);
          Game.physics.detonateToxicBarrel(rb.x, rb.y);
          continue;
        }
        // Move forward
        rb.x = nextX;
        // Check if floor exists (gravity)
        var floorY = rb.y + 1;
        if (floorY < s.rows && (s.grid[floorY][rb.x] === T.EMPTY || s.grid[floorY][rb.x] === T.WATER || s.grid[floorY][rb.x] === T.LAVA)) {
          rb.falling = true; // Will begin falling on next tick
        }
      }
    }
    Game.render.frame();
  }

  // ─── Water pumps: drain the connected flood, farthest tiles first ───
  function tickPumps() {
    if (!s.pumps || !s.pumps.length) return;
    var changed = false;
    for (var i = 0; i < s.pumps.length; i++) {
      var p = s.pumps[i];
      if (p.done) continue;
      // BFS the connected water region from the pump
      var seen = {}, queue = [[p.x, p.y, 0]], region = [];
      seen[p.x + "," + p.y] = true;
      while (queue.length) {
        var cur = queue.shift();
        var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (var d = 0; d < 4; d++) {
          var nx = cur[0] + dirs[d][0], ny = cur[1] + dirs[d][1];
          var k = nx + "," + ny;
          if (nx < 0 || nx >= s.cols || ny < 0 || ny >= s.rows || seen[k]) continue;
          var t = s.grid[ny][nx];
          if (t !== T.WATER && t !== T.WATER_SRC) continue;
          seen[k] = true;
          region.push({ x: nx, y: ny, d: cur[2] + 1, src: t === T.WATER_SRC });
          queue.push([nx, ny, cur[2] + 1]);
        }
      }
      if (!region.length) {
        p.done = true;
        Game.ui.addLog("🚰", "Pump finished - the gallery is dry.", "powerup-log");
        continue;
      }
      // cap springs first, then drain the two farthest water tiles
      var srcs = region.filter(function(r) { return r.src; });
      srcs.forEach(function(r) { s.grid[r.y][r.x] = T.ROCK; changed = true; });
      // A flood that is being pumped stops advancing: the cells still filling up
      // beside it are emptied too. Left alone they would fill after the last water
      // tile has gone and flood the gallery again behind a finished pump.
      region.forEach(function(r) {
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function(n) {
          var half = (r.y + n[1]) + "," + (r.x + n[0]);
          if (s.waterLevel[half]) { delete s.waterLevel[half]; changed = true; }
        });
      });
      var waters = region.filter(function(r) { return !r.src; }).sort(function(a, b) { return b.d - a.d; });
      for (var w = 0; w < Math.min(2, waters.length); w++) {
        s.grid[waters[w].y][waters[w].x] = T.EMPTY;
        delete s.waterLevel[waters[w].y + "," + waters[w].x];
        changed = true;
      }
      p.worked++;
    }
    if (changed) Game.render.frame();
  }

  // ─── Pushed minecarts: roll to the end of their run, flattening creatures ───
  var CART_TILES_PER_SECOND = 24, MACHINE_TICK_MS = 50;

  function tickRollingCarts() {
    var carts = s.rollingCarts;
    if (!carts || !carts.length) return;
    var now = Date.now(), stride = CART_TILES_PER_SECOND * MACHINE_TICK_MS / 1000;
    for (var i = carts.length - 1; i >= 0; i--) {
      var c = carts[i];
      var from = Math.floor(c.x);
      c.x += c.dx * stride;
      var arrived = c.dx > 0 ? c.x >= c.endX : c.x <= c.endX;
      if (arrived) c.x = c.endX;
      c.tickedAt = now;

      // every cell the cart has entered since the last tick
      var to = Math.floor(c.x);
      for (var tx = from + c.dx; c.dx > 0 ? tx <= to : tx >= to; tx += c.dx) Game.enemies.checkBoulderCrush(tx, c.y);

      if (arrived) {
        carts.splice(i, 1);
        // it comes to rest as an ordinary cart again (unless something has filled the cell)
        if (s.grid[c.y] && s.grid[c.y][c.endX] === T.EMPTY) s.grid[c.y][c.endX] = T.CART;
      }
    }
  }

  // Where to draw a rolling cart: its last ticked position carried forward by
  // the time since that tick (never by more than one tick, so a paused game
  // shows it standing still), and never past the end of its run.
  function rollingCartX(c, now) {
    var since = Math.max(0, Math.min((now - (c.tickedAt || now)), MACHINE_TICK_MS));
    var x = c.x + c.dx * CART_TILES_PER_SECOND * since / 1000;
    return c.dx > 0 ? Math.min(x, c.endX) : Math.max(x, c.endX);
  }

  Game.machines = {
    tickRollingCarts: tickRollingCarts,
    rollingCartX: rollingCartX,
    tickBouncingCarts: tickBouncingCarts,
    tickShaftLifts: tickShaftLifts,
    tickTBMs: tickTBMs,
    tbmHitsTile: tbmHitsTile,
    tickRidingRoll: tickRidingRoll,
    tickRollingBarrels: tickRollingBarrels,
    tickPumps: tickPumps
  };
})();
