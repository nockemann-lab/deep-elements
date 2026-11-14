"use strict";

// ═══════════════════════════════════════════════════════════════════
// render-player.js - the miner: sprite frames, walk/dig animation, headlamp, wading,
// and a drawn fallback used until the sprite images have loaded
// ═══════════════════════════════════════════════════════════════════

(function() {
  var s = Game.state, gfx = Game.gfx;

  // Drawing context for the current frame (see Game.gfx.begin in render-core.js)
  var ctx, TILE, animFrame;
  gfx.bind(function() { ctx = gfx.ctx; TILE = gfx.tile; animFrame = gfx.animFrame; });

  // from the files loaded before this one
  var drawSparkle = gfx.drawSparkle;

  function padFrameIndex(index) {
    return ("00" + index).slice(-3);
  }

  function buildAnimFramePaths(folder, direction, count) {
    var paths = [];
    for (var index = 0; index < count; index++) {
      paths.push("Sprite Miner/animations/" + folder + "/" + direction + "/frame_" + padFrameIndex(index) + ".png");
    }
    return paths;
  }

  function buildRotationPath(direction) {
    return "Sprite Miner/rotations/" + direction + ".png";
  }

  var playerSpriteSources = {
    idle: {
      south: buildAnimFramePaths("Breathing_Idle-4c00ee67", "south", 4),
      north: [buildRotationPath("north")],
      east: [buildRotationPath("east")],
      west: [buildRotationPath("west")]
    },
    walk: {
      south: buildAnimFramePaths("Walking-fc92c2b2", "south", 6),
      north: buildAnimFramePaths("Walking-fc92c2b2", "north", 6),
      east: buildAnimFramePaths("Walking-fc92c2b2", "east", 6),
      west: buildAnimFramePaths("Walking-fc92c2b2", "west", 6)
    },
    slay: {
      south: buildAnimFramePaths("Swing_the_pick_axe_to_the_right-be5f1c2c", "south", 4),
      north: buildAnimFramePaths("Swing_the_pick_axe_to_the_right-be5f1c2c", "north", 4),
      east: buildAnimFramePaths("Swing_the_pick_axe_to_the_right-be5f1c2c", "east", 4),
      west: buildAnimFramePaths("Swing_the_pick_axe_to_the_right-be5f1c2c", "west", 4)
    }
  };

  function loadPlayerFrame(path) {
    var img = new Image();
    var frame = { image: img, ready: false, failed: false, bounds: null };
    // The whole frame is always used for sizing. Measuring the drawn pixels
    // only works when the page is served over http(s) - from file:// the
    // browser refuses - so it made the miner twice as large once hosted.
    img.onload = function() { frame.ready = true; };
    img.onerror = function() {
      frame.failed = true;
    };
    img.src = path;
    return frame;
  }

  function loadPlayerFrameSet(paths) {
    return paths.map(loadPlayerFrame);
  }

  function loadPlayerSpriteBank(sourceBank) {
    var bank = {};
    Object.keys(sourceBank).forEach(function(kind) {
      bank[kind] = {};
      Object.keys(sourceBank[kind]).forEach(function(direction) {
        bank[kind][direction] = loadPlayerFrameSet(sourceBank[kind][direction]);
      });
    });
    return bank;
  }

  var playerSprites = loadPlayerSpriteBank(playerSpriteSources);

  function getPlayerFacing() {
    return s.playerFacing || (s.playerDir < 0 ? "west" : "east");
  }

  function getPlayerSpriteSequence(kind, facing) {
    var byKind = playerSprites[kind] || playerSprites.idle;
    return byKind[facing] || byKind.south || playerSprites.idle.south;
  }

  // Animation clocks: the walk cycle only advances while the miner is actually
  // travelling (so legs never run on the spot), and a pick swing always starts
  // at its first frame and plays through once.
  var SWING_FRAME_MS = 95, WALK_FRAME_MS = 62;
  var walkClock = 0, walkLast = 0, swingStart = 0;

  function getPlayerSpriteAnimation(now) {
    var facing = getPlayerFacing();
    var perfNow = performance.now();
    var dt = Math.min(now - (walkLast || now), 100); walkLast = now;

    var moving = s.running && !s.riding && s.playerMoveAnimStart > 0 &&
      (perfNow - s.playerMoveAnimStart) < (s.playerMoveAnimDuration || 90) + 45;
    if (moving) walkClock += dt; else walkClock = 0;

    var digAge = now - (s.playerDigTime || 0);
    var slay = getPlayerSpriteSequence("slay", facing);
    var swingLen = slay.length * SWING_FRAME_MS;
    if (s.playerIsDigging === true && digAge < swingLen && now - swingStart >= swingLen) swingStart = s.playerDigTime;
    if (now - swingStart < swingLen) {
      return { frames: slay, index: Math.min(slay.length - 1, Math.floor((now - swingStart) / SWING_FRAME_MS)) };
    }
    if (moving) {
      var walk = getPlayerSpriteSequence("walk", facing);
      // start mid-stride so the first frame already shows a leg forward
      return { frames: walk, index: (Math.floor(walkClock / WALK_FRAME_MS) + 1) % walk.length };
    }
    var idle = getPlayerSpriteSequence("idle", facing);
    return { frames: idle, index: Math.floor(now / 220) % idle.length, breathe: idle.length === 1 };
  }

  // Helmet lamp: a warm pool of light around the miner and a beam thrown the
  // way they face. Always faintly on; the Helmet Lamp power-up turns it up.
  function drawHeadlamp(px, py, now) {
    var facing = getPlayerFacing(), bright = s.activeEffects && s.activeEffects.lamp > 0;
    var dirX = facing === "east" ? 1 : facing === "west" ? -1 : 0;
    var dirY = facing === "south" ? 1 : facing === "north" ? -1 : 0;
    // lamp position on the helmet for each facing
    var lx = px + TILE * (0.5 + dirX * 0.2), ly = py - TILE * 0.02 + (dirY < 0 ? -TILE * 0.08 : 0);
    var flicker = 0.92 + Math.sin(now * 0.013) * 0.05 + Math.sin(now * 0.031) * 0.03;
    var pool = ctx.createRadialGradient(lx, py + TILE * 0.35, TILE * 0.1, lx, py + TILE * 0.35, TILE * (bright ? 1.9 : 1.25));
    pool.addColorStop(0, "rgba(255,226,160," + (bright ? 0.2 : 0.1) * flicker + ")");
    pool.addColorStop(1, "rgba(255,226,160,0)");
    ctx.fillStyle = pool;
    ctx.fillRect(px - TILE * 1.6, py - TILE * 1.6, TILE * 4.2, TILE * 4.2);
    // beam
    var len = TILE * (bright ? 3.6 : 2.3), spread = bright ? 0.42 : 0.34;
    var ang = Math.atan2(dirY, dirX);
    var ex = lx + Math.cos(ang) * len, ey = ly + Math.sin(ang) * len;
    var beam = ctx.createLinearGradient(lx, ly, ex, ey);
    beam.addColorStop(0, "rgba(255,238,180," + (bright ? 0.3 : 0.15) * flicker + ")");
    beam.addColorStop(1, "rgba(255,238,180,0)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + Math.cos(ang - spread) * len, ly + Math.sin(ang - spread) * len);
    ctx.quadraticCurveTo(lx + Math.cos(ang) * len * 1.12, ly + Math.sin(ang) * len * 1.12, lx + Math.cos(ang + spread) * len, ly + Math.sin(ang + spread) * len);
    ctx.closePath(); ctx.fill();
  }

  // Lamp lens glow, drawn over the sprite (not when facing away)
  function drawHeadlampGlint(px, py, now) {
    var facing = getPlayerFacing();
    if (facing === "north") return;
    var bright = s.activeEffects && s.activeEffects.lamp > 0;
    var dirX = facing === "east" ? 1 : facing === "west" ? -1 : 0;
    var lx = px + TILE * (0.5 + dirX * 0.2), ly = py - TILE * 0.01;
    var g = ctx.createRadialGradient(lx, ly, 0, lx, ly, S(bright ? 7 : 4.2));
    g.addColorStop(0, "rgba(255,252,225," + (bright ? 0.95 : 0.7) + ")");
    g.addColorStop(0.35, "rgba(255,230,150," + (bright ? 0.5 : 0.28) + ")");
    g.addColorStop(1, "rgba(255,230,150,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, S(bright ? 7 : 4.2), 0, Math.PI * 2); ctx.fill();
    if (bright) drawSparkle(lx, ly, S(4.4) * (0.8 + Math.sin(now * 0.02) * 0.2), "rgba(255,255,255,0.85)");
  }

  // Wading: water covers the miner from the chest down, with ripples spreading
  function drawWading(px, py, now) {
    var t = now * 0.001, line = py + TILE * 0.42, lx;
    function wy(l) { return Math.sin(t * 3.2 + l * 0.2) * S(0.9); }
    // fades out to either side so it blends into the surrounding water
    var veil = ctx.createLinearGradient(px - S(4), 0, px + TILE + S(4), 0);
    veil.addColorStop(0, "rgba(40,108,206,0)"); veil.addColorStop(0.28, "rgba(40,108,206,0.68)");
    veil.addColorStop(0.72, "rgba(40,108,206,0.68)"); veil.addColorStop(1, "rgba(40,108,206,0)");
    ctx.fillStyle = veil;
    ctx.beginPath(); ctx.moveTo(px - S(4), line + wy(-4));
    for (lx = 0; lx <= TILE + S(8); lx += TILE / 5) ctx.lineTo(px - S(4) + lx, line + wy(lx));
    ctx.lineTo(px + TILE + S(4), py + TILE + S(1)); ctx.lineTo(px - S(4), py + TILE + S(1)); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(225,244,255,0.9)"; ctx.lineWidth = S(1.2); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(px + S(5), line + wy(8));
    for (lx = S(5); lx <= TILE - S(5); lx += TILE / 6) ctx.lineTo(px + lx, line + wy(lx / TILE * 32));
    ctx.stroke();
    // ripples widening from the body
    for (var r = 0; r < 2; r++) {
      var rp = (t * 0.9 + r * 0.5) % 1;
      ctx.strokeStyle = "rgba(210,238,255," + (0.55 * (1 - rp)) + ")"; ctx.lineWidth = S(0.9);
      ctx.beginPath(); ctx.ellipse(px + TILE / 2, line + S(1), S(7 + rp * 11), S(1.6 + rp * 2.2), 0, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawPlayerSprite(px, py, now) {
    var animation = getPlayerSpriteAnimation(now);
    var frames = animation.frames;
    if (!frames || !frames.length) return false;

    var frame = frames[animation.index % frames.length];
    if (!frame || !frame.ready || !frame.image.naturalWidth || !frame.image.naturalHeight) return false;

    var bounds = frame.bounds || {
      left: 0,
      top: 0,
      width: frame.image.naturalWidth,
      height: frame.image.naturalHeight
    };
    var targetHeight = TILE * 3.015;
    var scale = targetHeight / bounds.height;
    var maxWidth = TILE * 2.415;
    if (bounds.width * scale > maxWidth) scale = maxWidth / bounds.width;

    var drawW = Math.max(1, Math.round(bounds.width * scale));
    var drawH = Math.max(1, Math.round(bounds.height * scale));
    var drawX = px + Math.round((TILE - drawW) / 2);
    var drawY = py + TILE - drawH + Math.round(TILE * 0.59);

    drawHeadlamp(px, py, now);

    // soft contact shadow so the miner stands on the floor instead of floating
    if (!s.riding && !s.playerOnWater) {
      // two tones: a wide faint penumbra and a darker core under the boots
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath(); ctx.ellipse(px + TILE / 2, py + TILE - S(1.2), S(10), S(2.8), 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.24)";
      ctx.beginPath(); ctx.ellipse(px + TILE / 2, py + TILE - S(1.2), S(7), S(1.9), 0, 0, Math.PI * 2); ctx.fill();
    }
    // single-frame idle poses get a gentle breathing motion, anchored at the feet
    if (animation.breathe) {
      var grow = Math.round(drawH * 0.012 * (0.5 + 0.5 * Math.sin(now / 520)));
      drawY -= grow; drawH += grow;
    }

    // the frames are scaled by a non-whole factor, so ask for the best resampling
    var wasQuality = ctx.imageSmoothingQuality;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(frame.image, bounds.left, bounds.top, bounds.width, bounds.height, drawX, drawY, drawW, drawH);
    ctx.imageSmoothingQuality = wasQuality;
    drawHeadlampGlint(px, py, now);
    if (s.playerOnWater && !s.riding) drawWading(px, py, now);
    return true;
  }

  // ─── Sprite: Player ───
  function drawPlayer(px, py) {
    var now = Date.now();
    if (drawPlayerSprite(px, py, now)) return;

    var d = s.playerDir || 1;
    var cx = px + TILE / 2, cy = py + TILE / 2;
    var animDuration = 250;
    var timeSinceMove = now - (s.playerDigTime || 0);
    var isMoving = timeSinceMove < animDuration;
    var isIdle = timeSinceMove > 1000;
    var isDigging = s.playerIsDigging !== false;
    var activeEffects = s.activeEffects;

    ctx.save();
    if (isIdle) {
      // ── Legs (with shading) ──
      var legGradL = ctx.createLinearGradient(cx - S(5), 0, cx - S(1), 0);
      legGradL.addColorStop(0, "#253d80"); legGradL.addColorStop(1, "#3a5cb8");
      ctx.fillStyle = legGradL;
      ctx.fillRect(cx - S(4), cy + S(6), S(3), S(8));
      var legGradR = ctx.createLinearGradient(cx + S(1), 0, cx + S(4), 0);
      legGradR.addColorStop(0, "#3a5cb8"); legGradR.addColorStop(1, "#253d80");
      ctx.fillStyle = legGradR;
      ctx.fillRect(cx + S(1), cy + S(6), S(3), S(8));
      // ── Boots ──
      ctx.fillStyle = "#3a2010";
      ctx.fillRect(cx - S(5), cy + S(13), S(5), S(2.5));
      ctx.fillRect(cx + S(0), cy + S(13), S(5), S(2.5));
      ctx.fillStyle = "#2a1508";
      ctx.fillRect(cx - S(5), cy + S(14.5), S(5), S(1));
      ctx.fillRect(cx + S(0), cy + S(14.5), S(5), S(1));
      // ── Torso (gradient shading) ──
      var torsoY = cy - S(7);
      var torsoGrad = ctx.createLinearGradient(cx - S(6), 0, cx + S(6), 0);
      torsoGrad.addColorStop(0, "#d08838"); torsoGrad.addColorStop(0.4, "#c47a30"); torsoGrad.addColorStop(1, "#a06020");
      ctx.fillStyle = torsoGrad;
      ctx.fillRect(cx - S(6), torsoY, S(12), S(13));
      // Collar / neckline
      ctx.fillStyle = "#a86828";
      ctx.beginPath(); ctx.moveTo(cx - S(4), torsoY); ctx.quadraticCurveTo(cx, torsoY + S(2.5), cx + S(4), torsoY); ctx.lineTo(cx + S(4), torsoY - S(0.5)); ctx.lineTo(cx - S(4), torsoY - S(0.5)); ctx.closePath(); ctx.fill();
      // Suspender straps
      ctx.strokeStyle = "#8a5520"; ctx.lineWidth = S(1.5);
      ctx.beginPath(); ctx.moveTo(cx - S(4), torsoY); ctx.lineTo(cx - S(3), torsoY + S(11)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + S(4), torsoY); ctx.lineTo(cx + S(3), torsoY + S(11)); ctx.stroke();
      // Belt
      ctx.fillStyle = "#5a3010";
      ctx.fillRect(cx - S(6), torsoY + S(11), S(12), S(2));
      ctx.fillStyle = "#d4a840";
      ctx.fillRect(cx - S(1.5), torsoY + S(11), S(3), S(2));
      // ── Head ──
      var headY = torsoY - S(7);
      // Skin with gradient
      var skinGrad = ctx.createRadialGradient(cx - S(1), headY + S(1), S(1), cx, headY + S(2), S(6));
      skinGrad.addColorStop(0, "#f8d4a8"); skinGrad.addColorStop(1, "#d4a070");
      ctx.fillStyle = skinGrad;
      ctx.beginPath(); ctx.arc(cx, headY + S(2), S(6), 0, Math.PI * 2); ctx.fill();
      // Nose
      ctx.fillStyle = "#e0a878";
      ctx.beginPath(); ctx.arc(cx, headY + S(3), S(1.2), 0, Math.PI * 2); ctx.fill();
      // Eyes
      ctx.fillStyle = "#222";
      ctx.fillRect(cx - S(3), headY + S(1), S(2), S(2));
      ctx.fillRect(cx + S(1), headY + S(1), S(2), S(2));
      ctx.fillStyle = "#fff";
      ctx.fillRect(cx - S(3), headY + S(0.5), S(1), S(1));
      ctx.fillRect(cx + S(2), headY + S(0.5), S(1), S(1));
      // Mouth area shadow
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.beginPath(); ctx.arc(cx, headY + S(5.5), S(3.5), 0, Math.PI); ctx.fill();
      // ── Helmet ──
      var lampOn = activeEffects && activeEffects.lamp > 0;
      var helmetGrad = ctx.createRadialGradient(cx - S(2), headY - S(3), S(2), cx, headY - S(1), S(8));
      helmetGrad.addColorStop(0, lampOn ? "#ffe866" : "#e8c030");
      helmetGrad.addColorStop(1, lampOn ? "#cc9e00" : "#996d00");
      ctx.fillStyle = helmetGrad;
      ctx.beginPath(); ctx.arc(cx, headY - S(1), S(7.5), Math.PI, Math.PI * 2); ctx.fill();
      // Brim
      ctx.fillStyle = lampOn ? "#ddaa10" : "#8a6010";
      ctx.fillRect(cx - S(8.5), headY - S(1), S(17), S(2.5));
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(cx - S(7), headY - S(0.5), S(14), S(0.8));
      // Brim shadow on face
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(cx - S(6), headY + S(0.5), S(12), S(1.5));
      // Lamp housing
      ctx.fillStyle = "#444"; ctx.fillRect(cx - S(2.5), headY - S(5), S(5), S(4));
      ctx.fillStyle = "#555"; ctx.fillRect(cx - S(2), headY - S(4.5), S(4), S(3));
      if (lampOn) {
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx, headY - S(3), S(1.8), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,200,0.3)"; ctx.beginPath(); ctx.arc(cx, headY - S(3), S(3), 0, Math.PI * 2); ctx.fill();
      }
      // ── Arms (with sleeves + hands) ──
      ctx.fillStyle = "#d4883a";
      ctx.fillRect(cx - S(8), torsoY + S(1), S(2.5), S(7));
      ctx.fillRect(cx + S(5.5), torsoY + S(1), S(2.5), S(7));
      // Sleeve cuffs
      ctx.fillStyle = "#b87028";
      ctx.fillRect(cx - S(8), torsoY + S(7), S(2.5), S(1.5));
      ctx.fillRect(cx + S(5.5), torsoY + S(7), S(2.5), S(1.5));
      // Hands
      ctx.fillStyle = "#f0c090";
      ctx.fillRect(cx - S(8.5), torsoY + S(8.5), S(3), S(2.5));
      ctx.fillRect(cx + S(5.5), torsoY + S(8.5), S(3), S(2.5));
      // ── Pickaxe ──
      ctx.fillStyle = "#704020"; ctx.fillRect(cx + S(6.5), torsoY - S(4), S(2.5), S(18));
      // Shaft highlight
      ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(cx + S(6.5), torsoY - S(4), S(1), S(18));
      var pickGrad = ctx.createLinearGradient(cx - S(2), torsoY - S(4), cx + S(14), torsoY - S(4));
      pickGrad.addColorStop(0, "#666"); pickGrad.addColorStop(0.3, "#ddd"); pickGrad.addColorStop(0.5, "#fff"); pickGrad.addColorStop(0.7, "#ccc"); pickGrad.addColorStop(1, "#444");
      ctx.fillStyle = pickGrad;
      ctx.beginPath(); ctx.moveTo(cx - S(2), torsoY - S(2));
      ctx.quadraticCurveTo(cx + S(6), torsoY - S(7), cx + S(14), torsoY - S(2));
      ctx.lineTo(cx + S(12), torsoY + S(1));
      ctx.quadraticCurveTo(cx + S(6), torsoY - S(3), cx + S(0), torsoY + S(1));
      ctx.closePath(); ctx.fill();
      // Pick edge highlight
      ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = S(0.5);
      ctx.beginPath(); ctx.moveTo(cx - S(2), torsoY - S(2)); ctx.quadraticCurveTo(cx + S(6), torsoY - S(7), cx + S(14), torsoY - S(2)); ctx.stroke();
      if (lampOn) {
        var g = ctx.createRadialGradient(cx, headY - S(2), 0, cx, headY - S(2), S(14));
        g.addColorStop(0, "rgba(255,255,180,0.5)"); g.addColorStop(1, "rgba(255,255,180,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, headY - S(2), S(14), 0, Math.PI * 2); ctx.fill();
      }
    } else {
      var animProgress = isMoving ? (timeSinceMove / animDuration) : 0;
      var swingCurve = isMoving ? Math.sin(animProgress * Math.PI) : 0;
      var legSwing = swingCurve * S(5);
      var bodyBob = swingCurve * S(2);
      // ── Back leg (darker) ──
      ctx.fillStyle = "#1c3060";
      ctx.fillRect(cx - (d * S(2)) - S(2), cy + S(6) - bodyBob, S(4), S(8) + legSwing);
      ctx.fillStyle = "#3a2010";
      ctx.fillRect(cx - (d * S(2)) - S(2.5), cy + S(12.5) - bodyBob + legSwing, S(5), S(2.5));
      ctx.fillStyle = "#2a1508";
      ctx.fillRect(cx - (d * S(2)) - S(2.5), cy + S(14) - bodyBob + legSwing, S(5), S(1));
      // ── Torso ──
      var torsoY = cy - S(7) - bodyBob;
      var torsoGrad = ctx.createLinearGradient(cx - S(6), 0, cx + S(6), 0);
      torsoGrad.addColorStop(0, "#d08838"); torsoGrad.addColorStop(0.4, "#c47a30"); torsoGrad.addColorStop(1, "#a06020");
      ctx.fillStyle = torsoGrad;
      ctx.fillRect(cx - S(6), torsoY, S(12), S(13));
      // Collar
      ctx.fillStyle = "#a86828";
      ctx.beginPath(); ctx.moveTo(cx - S(4), torsoY); ctx.quadraticCurveTo(cx, torsoY + S(2.5), cx + S(4), torsoY); ctx.lineTo(cx + S(4), torsoY - S(0.5)); ctx.lineTo(cx - S(4), torsoY - S(0.5)); ctx.closePath(); ctx.fill();
      // Suspender straps
      ctx.strokeStyle = "#8a5520"; ctx.lineWidth = S(1.5);
      ctx.beginPath(); ctx.moveTo(cx - S(4), torsoY); ctx.lineTo(cx - S(3), torsoY + S(11)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + S(4), torsoY); ctx.lineTo(cx + S(3), torsoY + S(11)); ctx.stroke();
      // Belt
      ctx.fillStyle = "#5a3010";
      ctx.fillRect(cx - S(6), torsoY + S(11), S(12), S(2));
      ctx.fillStyle = "#d4a840";
      ctx.fillRect(cx - S(1.5), torsoY + S(11), S(3), S(2));
      // ── Front leg (brighter) ──
      var flegGrad = ctx.createLinearGradient(cx + (d * S(2)) - S(2), 0, cx + (d * S(2)) + S(2), 0);
      flegGrad.addColorStop(0, "#3a5cb8"); flegGrad.addColorStop(1, "#253d80");
      ctx.fillStyle = flegGrad;
      ctx.fillRect(cx + (d * S(2)) - S(2), cy + S(6) - bodyBob, S(4), S(8) - legSwing);
      ctx.fillStyle = "#3a2010";
      ctx.fillRect(cx + (d * S(2)) - S(2.5), cy + S(12.5) - bodyBob - legSwing, S(5), S(2.5));
      ctx.fillStyle = "#2a1508";
      ctx.fillRect(cx + (d * S(2)) - S(2.5), cy + S(14) - bodyBob - legSwing, S(5), S(1));
      // ── Head ──
      var headY = torsoY - S(7);
      var skinGrad = ctx.createRadialGradient(cx + d * S(-1), headY + S(1), S(1), cx, headY + S(2), S(6));
      skinGrad.addColorStop(0, "#f8d4a8"); skinGrad.addColorStop(1, "#d4a070");
      ctx.fillStyle = skinGrad;
      ctx.beginPath(); ctx.arc(cx, headY + S(2), S(6), 0, Math.PI * 2); ctx.fill();
      // Nose
      ctx.fillStyle = "#e0a878";
      ctx.beginPath(); ctx.arc(cx + (d * S(1.5)), headY + S(3), S(1.2), 0, Math.PI * 2); ctx.fill();
      // Eye
      ctx.fillStyle = "#222"; ctx.fillRect(cx + (d * S(3)), headY + S(1), S(2), S(2));
      ctx.fillStyle = "#fff"; ctx.fillRect(cx + (d * S(3)), headY + S(0.5), S(1), S(1));
      // Chin shadow
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.beginPath(); ctx.arc(cx, headY + S(5.5), S(3.5), 0, Math.PI); ctx.fill();
      // ── Helmet ──
      var lampOn = activeEffects && activeEffects.lamp > 0;
      var helmetGrad = ctx.createRadialGradient(cx - S(2), headY - S(3), S(2), cx, headY - S(1), S(8));
      helmetGrad.addColorStop(0, lampOn ? "#ffe866" : "#e8c030");
      helmetGrad.addColorStop(1, lampOn ? "#cc9e00" : "#996d00");
      ctx.fillStyle = helmetGrad;
      ctx.beginPath(); ctx.arc(cx, headY - S(1), S(7.5), Math.PI, Math.PI * 2); ctx.fill();
      // Brim
      ctx.fillStyle = lampOn ? "#ddaa10" : "#8a6010";
      ctx.fillRect(cx - S(8.5), headY - S(1), S(17), S(2.5));
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(cx - S(7), headY - S(0.5), S(14), S(0.8));
      // Brim shadow on face
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(cx - S(6), headY + S(0.5), S(12), S(1.5));
      // Lamp housing
      ctx.fillStyle = "#444"; ctx.fillRect(cx - S(2.5), headY - S(5), S(5), S(4));
      ctx.fillStyle = "#555"; ctx.fillRect(cx - S(2), headY - S(4.5), S(4), S(3));
      if (lampOn) {
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(cx, headY - S(3), S(1.8), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,200,0.3)"; ctx.beginPath(); ctx.arc(cx, headY - S(3), S(3), 0, Math.PI * 2); ctx.fill();
      }
      // ── Pickaxe + swing arm ──
      var swingAngle = isDigging ? (swingCurve * 2.5) : (swingCurve * 0.4);
      ctx.save(); ctx.translate(cx + (d * S(2)), torsoY + S(7)); ctx.rotate(d * (swingAngle - 1.0));
      ctx.fillStyle = "#704020"; ctx.fillRect(-S(1.5), -S(12), S(3), S(18));
      ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(-S(1.5), -S(12), S(1), S(18));
      var pickGrad = ctx.createLinearGradient(-S(10), -S(12), S(10), -S(12));
      pickGrad.addColorStop(0, "#666"); pickGrad.addColorStop(0.3, "#ddd"); pickGrad.addColorStop(0.5, "#fff"); pickGrad.addColorStop(0.7, "#ccc"); pickGrad.addColorStop(1, "#444");
      ctx.fillStyle = pickGrad;
      ctx.beginPath(); ctx.moveTo(-S(12), -S(10)); ctx.quadraticCurveTo(0, -S(15), S(12), -S(10));
      ctx.lineTo(S(10), -S(8)); ctx.quadraticCurveTo(0, -S(12), -S(10), -S(8)); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = S(0.5);
      ctx.beginPath(); ctx.moveTo(-S(12), -S(10)); ctx.quadraticCurveTo(0, -S(15), S(12), -S(10)); ctx.stroke();
      ctx.restore();
      // Swing arm + sleeve cuff + hand
      ctx.save(); ctx.translate(cx + (d * S(2)), torsoY + S(2)); ctx.rotate(d * (swingAngle - 1.0));
      ctx.fillStyle = "#d4883a";
      ctx.fillRect(-S(2), 0, S(4), S(5));
      ctx.fillStyle = "#b87028";
      ctx.fillRect(-S(2), S(5), S(4), S(1.5));
      ctx.fillStyle = "#f0c090"; ctx.fillRect(-S(2.5), S(6.5), S(5), S(2.5)); ctx.restore();
      if (lampOn) {
        var lx = cx + (d * S(6)), ly = headY - S(2);
        var g = ctx.createRadialGradient(lx, ly, 0, lx, ly, S(12));
        g.addColorStop(0, "rgba(255,255,180,0.5)"); g.addColorStop(1, "rgba(255,255,180,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, S(12), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  // ─── Shared with the other render files ───
  gfx.padFrameIndex = padFrameIndex; gfx.buildAnimFramePaths = buildAnimFramePaths;
  gfx.buildRotationPath = buildRotationPath; gfx.loadPlayerFrame = loadPlayerFrame;
  gfx.loadPlayerFrameSet = loadPlayerFrameSet; gfx.loadPlayerSpriteBank = loadPlayerSpriteBank;
  gfx.getPlayerFacing = getPlayerFacing; gfx.getPlayerSpriteSequence = getPlayerSpriteSequence;
  gfx.getPlayerSpriteAnimation = getPlayerSpriteAnimation; gfx.drawHeadlamp = drawHeadlamp;
  gfx.drawHeadlampGlint = drawHeadlampGlint; gfx.drawWading = drawWading;
  gfx.drawPlayerSprite = drawPlayerSprite; gfx.drawPlayer = drawPlayer; gfx.playerSprites = playerSprites;
})();
