"use strict";

// ═══════════════════════════════════════════════════════════════════
// enemies.js - Enemy AI, pathfinding, line-of-sight, movement
// ═══════════════════════════════════════════════════════════════════

(function() {
  var s = Game.state;

  // Reusable BFS visited buffer - avoids GC pressure each tick
  var _bfsVis = null;
  var _bfsVisVersion = 0;
  var _bfsVisStamp = [];

  // Which tiles a creature of this kind can move into: open ground for all;
  // water for everything that does not fly; webs for spiders and fliers;
  // earth for the crab, which eats its way through.
  function canEnter(tile, info) {
    if (tile === T.EMPTY || tile === T.PLAYER || tile === T.EXIT || tile === T.POWERUP) return true;
    if (tile === T.WATER) return !info.canFly;
    if (tile === T.WEB) return !!(info.isSpider || info.canFly);
    if (tile === T.EARTH || tile === T.EARTH_RICH) return !!info.eatsEarth;
    return false;
  }

  Game.enemies = {

    create: function(type, x, y) {
      return {
        type:type, x:x, y:y, floatX:x, floatY:y,
        dir: Math.random() < 0.5 ? 1 : -1,
        axis: Math.random() < 0.5 ? "h" : "v",
        moveCounter: 0, alive: true,
        animOffset: Math.random() * Math.PI * 2,
        state: AI_PATROL, alertTimer: 0, chaseTimer: 0,
        lastSeenX: -1, lastSeenY: -1, aggroGlow: 0
      };
    },

    hasLineOfSight: function(x0, y0, x1, y1, canFly) {
      var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
      var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      var err = dx - dy, cx = x0, cy = y0;
      while (true) {
        if (cx === x1 && cy === y1) return true;
        var t = s.grid[cy] && s.grid[cy][cx];
        if (cx !== x0 || cy !== y0) {
          if (t === T.EARTH || t === T.EARTH_RICH || t === T.ROCK || t === T.WALL || t === T.BOULDER || t === T.HAZARD) return false;
        }
        var e2 = 2 * err;
        if (e2 > -dy) { err -= dy; cx += sx; }
        if (e2 < dx) { err += dx; cy += sy; }
        if (cx < 0 || cx >= s.cols || cy < 0 || cy >= s.rows) return false;
      }
    },

    bfsNextStep: function(fx, fy, tx, ty, info) {
      if (fx === tx && fy === ty) return null;

      if (!_bfsVis || _bfsVis.length !== s.rows || _bfsVis[0].length !== s.cols) {
        _bfsVis = [];
        _bfsVisStamp = [];
        for (var y = 0; y < s.rows; y++) {
          _bfsVis[y] = new Uint8Array(s.cols);
          _bfsVisStamp[y] = new Uint32Array(s.cols);
        }
        _bfsVisVersion = 0;
      }
      _bfsVisVersion++;
      var ver = _bfsVisVersion;

      var q = [{ x:fx, y:fy, fdx:0, fdy:0, first:true }];
      _bfsVisStamp[fy][fx] = ver;

      var dirs = [{ dx:0, dy:-1 }, { dx:0, dy:1 }, { dx:-1, dy:0 }, { dx:1, dy:0 }];
      while (q.length > 0) {
        var cur = q.shift();
        for (var d = 0; d < 4; d++) {
          var nx = cur.x + dirs[d].dx, ny = cur.y + dirs[d].dy;
          if (nx <= 0 || nx >= s.cols - 1 || ny <= 0 || ny >= s.rows - 1) continue;
          if (_bfsVisStamp[ny][nx] === ver) continue;
          if (!canEnter(s.grid[ny][nx], info)) continue;
          _bfsVisStamp[ny][nx] = ver;
          var fdx = cur.first ? dirs[d].dx : cur.fdx;
          var fdy = cur.first ? dirs[d].dy : cur.fdy;
          if (nx === tx && ny === ty) return { dx:fdx, dy:fdy };
          q.push({ x:nx, y:ny, fdx:fdx, fdy:fdy, first:false });
        }
      }
      return null;
    },

    // radius: how far the tremor carries; TREMOR_RADIUS when left out
    triggerTremor: function(tx, ty, radius) {
      var reach = radius || TREMOR_RADIUS;
      for (var i = 0; i < s.enemies.length; i++) {
        var e = s.enemies[i];
        if (e.alive && ENEMY_TYPES[e.type].isSpider) {
          var dist = Math.abs(e.x - tx) + Math.abs(e.y - ty);
          if (dist <= reach) {
            e.lastSeenX = tx; e.lastSeenY = ty;
            if (e.state !== AI_CHASE) SFX.enemyAlert();
            e.state = AI_CHASE;
            e.chaseTimer = 15;
            e.aggroGlow = 1;
          }
        }
      }
    },

    moveAll: function() {
      if (!s.running || s.paused) return;

      // Check grace period: if player was in danger last tick and is still overlapping an enemy, kill
      if (s.enemyDanger) {
        var de = s.enemyDanger;
        var stillOverlap = s.enemies.some(function(e) {
          return e.alive && e.x === s.playerX && e.y === s.playerY;
        });
        if (stillOverlap) { Game.loop.gameOver(false, de.type); return; }
        s.enemyDanger = null;
      }

      var lvlB = Math.min(s.difficulty * 0.5, 3);
      var self = Game.enemies;

      for (var i = 0; i < s.enemies.length; i++) {
        var e = s.enemies[i];
        if (!e.alive) continue;
        var info = ENEMY_TYPES[e.type];
        var dist = Math.abs(e.x - s.playerX) + Math.abs(e.y - s.playerY);
        var detR = info.detectRadius + lvlB, losR = info.losRange + lvlB, canSee = false;

        if (dist <= detR) canSee = true;
        if (!canSee && dist <= losR) canSee = self.hasLineOfSight(e.x, e.y, s.playerX, s.playerY, info.canFly);

        if (canSee) {
          e.lastSeenX = s.playerX; e.lastSeenY = s.playerY;
          if (e.state === AI_PATROL || e.state === AI_IDLE) { e.state = AI_ALERT; e.alertTimer = 2; SFX.enemyAlert(); }
          else if (e.state === AI_ALERT) { e.alertTimer--; if (e.alertTimer <= 0) e.state = AI_CHASE; }
          else e.state = AI_CHASE;
          e.chaseTimer = info.chaseMemory + Math.floor(lvlB * 2);
        } else {
          if (e.state === AI_CHASE || e.state === AI_ALERT) {
            e.chaseTimer--;
            if (e.chaseTimer <= 0) { e.state = AI_SEARCH; e.chaseTimer = 8; }
            else if (e.state !== AI_ALERT) e.state = AI_CHASE;
          } else if (e.state === AI_SEARCH) {
            e.chaseTimer--;
            if (e.chaseTimer <= 0) e.state = AI_PATROL;
          }
        }

        if (e.state === AI_CHASE) e.aggroGlow = Math.min(e.aggroGlow + 0.25, 1);
        else if (e.state === AI_ALERT) e.aggroGlow = Math.min(e.aggroGlow + 0.15, 0.6);
        else e.aggroGlow = Math.max(e.aggroGlow - 0.1, 0);

        // a creature lying in wait ("wait" in the level file) stays where it was put
        // until it first notices the miner or, for a spider, feels a tremor
        if (e.state === AI_IDLE) continue;

        e.moveCounter++;
        var spd = (e.state === AI_CHASE) ? info.chaseSpeed : info.patrolSpeed;
        if (e.state === AI_ALERT || e.moveCounter < spd) continue;
        e.moveCounter = 0;

        var chosen = null;
        if (e.state === AI_CHASE) {
          var ttx = canSee ? s.playerX : e.lastSeenX, tty = canSee ? s.playerY : e.lastSeenY;
          if (ttx >= 0) chosen = self.bfsNextStep(e.x, e.y, ttx, tty, info);
          if (!chosen) chosen = self.patrolMove(e, info);
        } else if (e.state === AI_SEARCH) {
          if (e.lastSeenX >= 0) chosen = self.bfsNextStep(e.x, e.y, e.lastSeenX, e.lastSeenY, info);
          if (!chosen || (e.x === e.lastSeenX && e.y === e.lastSeenY)) {
            e.state = AI_PATROL; chosen = self.patrolMove(e, info);
          }
        } else {
          chosen = self.patrolMove(e, info);
        }

        if (!chosen) continue;
        var nx = e.x + chosen.dx, ny = e.y + chosen.dy;
        if (nx === s.playerX && ny === s.playerY) {
          // Grace period: warn the player instead of instant death
          s.enemyDanger = { type: e.type, time: Date.now() };
          SFX.enemyAlert();
          e.x = nx; e.y = ny;
          Game.render.frame();
          continue;
        }
        if (!s.enemies.some(function(o) { return o !== e && o.alive && o.x === nx && o.y === ny; })) {
          var t = s.grid[ny][nx];
          if (info.eatsEarth && (t === T.EARTH || t === T.EARTH_RICH)) { s.grid[ny][nx] = T.EMPTY; SFX.dig(); }
          if (info.isSpider && Math.random() < 0.15 && t === T.EMPTY) { s.grid[ny][nx] = T.WEB; }
          e.x = nx; e.y = ny;
        }
      }
    },

    patrolMove: function(e, info) {
      var dirs = [{ dx:1, dy:0 }, { dx:-1, dy:0 }, { dx:0, dy:1 }, { dx:0, dy:-1 }], valid = [];
      for (var d = 0; d < dirs.length; d++) {
        var nx = e.x + dirs[d].dx, ny = e.y + dirs[d].dy;
        if (nx <= 0 || nx >= s.cols - 1 || ny <= 0 || ny >= s.rows - 1) continue;
        if (canEnter(s.grid[ny][nx], info)) valid.push(dirs[d]);
      }
      if (!valid.length) return null;
      var pref = valid.find(function(m) {
        return (e.axis === "h" && m.dx === e.dir && m.dy === 0) || (e.axis === "v" && m.dy === e.dir && m.dx === 0);
      });
      if (pref && Math.random() < 0.6) return pref;
      var c = valid[Math.floor(Math.random() * valid.length)];
      if (c.dx !== 0) { e.axis = "h"; e.dir = c.dx; } else { e.axis = "v"; e.dir = c.dy; }
      return c;
    },

    checkBoulderCrush: function(bx, by) {
      for (var i = 0; i < s.enemies.length; i++) {
        var e = s.enemies[i];
        if (!e.alive || e.x !== bx || e.y !== by) continue;
        e.alive = false; s.enemiesKilled++; s.score += 100 * s.comboMultiplier;
        SFX.crushEnemy(e.type);
        var colors = e.type === "bat" ? ["#c8c8d8","#9090a8","#e0e0f0","#6a6a80"] :
                     e.type === "spider" ? ["#b0a0c8","#8070a0","#d0c0e8","#604880"] :
                     e.type === "snake" ? ["#88cc88","#609060","#aaeeaa","#407040"] :
                     e.type === "crab" ? ["#e8a070","#c07840","#ffc090","#905020"] :
                     ["#d0d0d8","#a0a0b0","#e8e8f0","#808090"];
        var parts = [];
        for (var pi = 0; pi < 16; pi++) {
          var a = Math.random() * Math.PI * 2;
          parts.push({ angle:a, speed:1.5+Math.random()*3, size:1+Math.random()*2.5, color:colors[pi%colors.length], rot:Math.random()*6.28, rotSpd:(Math.random()-0.5)*10 });
        }
        s.crushEffects.push({ x:bx, y:by, type:e.type, startTime:Date.now(), particles:parts });
        s.screenShake = 5; s.screenShakeTime = Date.now();
        Game.ui.addLog(e.type === "bat" ? "\ud83e\udd87" : e.type === "spider" ? "\ud83d\udd77" : e.type === "crab" ? "\ud83e\udd80" : "\ud83d\udc0d", ENEMY_TYPES[e.type].name + " crushed! +" + 100 * s.comboMultiplier, "crush-log");
        Game.ui.updateHUD();
      }
    },

    tickSpiderNests: function() {
      if (!s.running || s.paused) return;
      var dirs = [{dx:0,dy:-1},{dx:0,dy:1},{dx:-1,dy:0},{dx:1,dy:0}];
      for (var y = 1; y < s.rows - 1; y++) {
        for (var x = 1; x < s.cols - 1; x++) {
          if (s.grid[y][x] !== T.SPIDER_NEST) continue;
          var nest = y + "," + x;
          if (s.enemies.filter(function(e) { return e.alive && e.nest === nest; }).length >= SPIDER_NEST_MAX) continue;
          if (Math.random() > 0.33) continue;
          // Shuffle dirs
          var sd = dirs.slice();
          for (var i = sd.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = sd[i]; sd[i] = sd[j]; sd[j] = tmp; }
          for (var d = 0; d < sd.length; d++) {
            var nx = x + sd[d].dx, ny = y + sd[d].dy;
            if (nx <= 0 || nx >= s.cols - 1 || ny <= 0 || ny >= s.rows - 1) continue;
            var t = s.grid[ny][nx];
            if (t !== T.EMPTY && t !== T.WEB) continue;
            if (s.enemies.some(function(e) { return e.alive && e.x === nx && e.y === ny; })) continue;
            if (nx === s.playerX && ny === s.playerY) continue;
            var hatchling = Game.enemies.create("spider", nx, ny);
            hatchling.nest = nest;
            s.enemies.push(hatchling);
            Game.ui.addLog("\ud83d\udd77\ufe0f", "A spider crawled out of a nest!", "crush-log");
            break;
          }
        }
      }
    }
  };
})();
