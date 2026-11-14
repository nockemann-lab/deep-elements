"use strict";

// ═══════════════════════════════════════════════════════════════════
// render-creatures.js - the four creatures: bat, spider, snake and crab
// ═══════════════════════════════════════════════════════════════════

(function() {
  var s = Game.state, gfx = Game.gfx;

  // Drawing context for the current frame (see Game.gfx.begin in render-core.js)
  var ctx, TILE, animFrame;
  gfx.bind(function() { ctx = gfx.ctx; TILE = gfx.tile; animFrame = gfx.animFrame; });

  // from the files loaded before this one
  var drawSparkle = gfx.drawSparkle;

  // The "!" over a creature that has just noticed the miner: outlined so it
  // reads against any background, with a small hop
  function drawAlertMark(x, y, size) {
    var hop = Math.abs(Math.sin(Date.now() * 0.011)) * S(1.4);
    ctx.font = 'bold ' + S(size) + 'px "Press Start 2P",monospace';
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.lineJoin = "round"; ctx.lineWidth = Math.max(2, S(2.4)); ctx.strokeStyle = "rgba(26,4,6,0.88)";
    ctx.strokeText("!", x, y - hop);
    ctx.fillStyle = "#ff5148"; ctx.fillText("!", x, y - hop);
  }

  // True for about an eighth of a second every few seconds, at a moment that
  // differs from creature to creature
  function blinking(e, now, every) {
    return (now + e.animOffset * 1377) % every < 130;
  }

  // ─── Sprite: Bat ───
  function drawBat(px, py, e) {
    var now = Date.now(), t = now * 0.001 + e.animOffset;
    var chase = e.state === AI_CHASE, alert = e.state >= AI_ALERT;
    var cx = px + TILE / 2, cy = py + TILE / 2 + S(1) + Math.sin(t * (chase ? 9 : 5)) * S(1.4);
    var flap = Math.sin(t * (chase ? 22 : 13));
    var OUT = "#150b1c", FUR = "#4a3160", FUR_L = "#7a5a92", WING = "#6a4680", WING_D = "#3c2550";

    ctx.save();
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    if (e.aggroGlow > 0) { ctx.shadowBlur = S(7) * e.aggroGlow; ctx.shadowColor = "rgba(255,50,50,0.4)"; }

    // Wings: leathery membrane stretched over three finger bones, scalloped trailing edge
    for (var side = -1; side <= 1; side += 2) {
      var shX = cx + side * S(2.6), shY = cy - S(1.5);
      var wrX = cx + side * S(8.5), wrY = cy - S(6.5) - flap * S(3.6);
      var tipX = cx + side * S(15.2), tipY = cy - S(2.5) - flap * S(7.2);
      var f1X = cx + side * S(11.6), f1Y = cy + S(2.6) - flap * S(4.0);
      var f2X = cx + side * S(7.4), f2Y = cy + S(4.4) - flap * S(1.8);
      var rootX = cx + side * S(2.8), rootY = cy + S(3.6);
      ctx.beginPath();
      ctx.moveTo(shX, shY);
      ctx.quadraticCurveTo(cx + side * S(5), wrY - S(1.2), wrX, wrY);
      ctx.quadraticCurveTo(cx + side * S(12.5), wrY - S(0.6) - flap * S(1.2), tipX, tipY);
      ctx.quadraticCurveTo(cx + side * S(12.6), (tipY + f1Y) / 2 - S(2.2), f1X, f1Y);
      ctx.quadraticCurveTo(cx + side * S(9.2), (f1Y + f2Y) / 2 - S(2.6), f2X, f2Y);
      ctx.quadraticCurveTo(cx + side * S(5), (f2Y + rootY) / 2 - S(2.2), rootX, rootY);
      ctx.closePath();
      ctx.fillStyle = flap > 0 ? WING : WING_D;
      ctx.strokeStyle = OUT; ctx.lineWidth = S(1.5);
      ctx.stroke(); ctx.fill();
      // finger bones fanning from the wrist
      ctx.strokeStyle = "#2a1838"; ctx.lineWidth = S(0.8);
      ctx.beginPath(); ctx.moveTo(shX, shY); ctx.quadraticCurveTo(cx + side * S(5), wrY - S(0.8), wrX, wrY); ctx.lineTo(tipX, tipY);
      ctx.moveTo(wrX, wrY); ctx.lineTo(f1X, f1Y); ctx.moveTo(wrX, wrY); ctx.lineTo(f2X, f2Y); ctx.stroke();
      ctx.strokeStyle = "rgba(190,150,215,0.35)"; ctx.lineWidth = S(0.6);
      ctx.beginPath(); ctx.moveTo(shX + side * S(0.6), shY - S(0.5)); ctx.quadraticCurveTo(cx + side * S(5), wrY - S(1.6), wrX, wrY - S(0.6)); ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Ears
    for (var es = -1; es <= 1; es += 2) {
      ctx.fillStyle = FUR; ctx.strokeStyle = OUT; ctx.lineWidth = S(1.2);
      ctx.beginPath(); ctx.moveTo(cx + es * S(0.8), cy - S(5.6)); ctx.lineTo(cx + es * S(4.6), cy - S(11.2)); ctx.lineTo(cx + es * S(4.2), cy - S(4.2)); ctx.closePath(); ctx.stroke(); ctx.fill();
      ctx.fillStyle = "#c98aa0";
      ctx.beginPath(); ctx.moveTo(cx + es * S(1.9), cy - S(5.8)); ctx.lineTo(cx + es * S(4.0), cy - S(9.4)); ctx.lineTo(cx + es * S(3.7), cy - S(5.2)); ctx.closePath(); ctx.fill();
    }
    // Body and head
    ctx.strokeStyle = OUT; ctx.lineWidth = S(1.4);
    ctx.fillStyle = FUR;
    ctx.beginPath(); ctx.ellipse(cx, cy + S(1.6), S(3.9), S(4.8), 0, 0, Math.PI * 2); ctx.stroke(); ctx.fill();
    ctx.fillStyle = FUR_L;
    ctx.beginPath(); ctx.ellipse(cx, cy + S(2.6), S(2.3), S(3.0), 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = FUR;
    ctx.beginPath(); ctx.arc(cx, cy - S(3.4), S(4.1), 0, Math.PI * 2); ctx.stroke(); ctx.fill();
    ctx.fillStyle = "rgba(190,150,215,0.25)";
    ctx.beginPath(); ctx.ellipse(cx - S(1.2), cy - S(5.2), S(2.2), S(1.2), -0.4, 0, Math.PI * 2); ctx.fill();
    // little feet
    ctx.strokeStyle = OUT; ctx.lineWidth = S(0.9);
    ctx.beginPath(); ctx.moveTo(cx - S(1.4), cy + S(6.2)); ctx.lineTo(cx - S(1.8), cy + S(7.8)); ctx.moveTo(cx + S(1.4), cy + S(6.2)); ctx.lineTo(cx + S(1.8), cy + S(7.8)); ctx.stroke();
    // Eyes: amber when calm, red when it has seen you
    var eyeCol = alert ? "#ff3b30" : "#ffc233";
    var batBlink = !alert && blinking(e, now, 3900);
    for (var ey = -1; ey <= 1; ey += 2) {
      if (batBlink) {   // eyes shut: a dark lash line in the fur
        ctx.strokeStyle = "#1c1026"; ctx.lineWidth = Math.max(1, S(0.8));
        ctx.beginPath(); ctx.moveTo(cx + ey * S(0.5), cy - S(3.5)); ctx.quadraticCurveTo(cx + ey * S(1.8), cy - S(2.9), cx + ey * S(3.1), cy - S(3.7)); ctx.stroke();
        continue;
      }
      ctx.fillStyle = alert ? "rgba(255,60,48,0.35)" : "rgba(255,194,51,0.25)";
      ctx.beginPath(); ctx.arc(cx + ey * S(1.8), cy - S(3.8), S(2.3), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = eyeCol;
      ctx.beginPath(); ctx.ellipse(cx + ey * S(1.8), cy - S(3.8), S(1.45), S(1.25), ey * (alert ? -0.5 : -0.15), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#120a16";
      ctx.beginPath(); ctx.ellipse(cx + ey * S(1.8), cy - S(3.7), S(0.45), S(0.95), 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillRect(cx + ey * S(1.8) - S(0.9), cy - S(4.7), S(0.6), S(0.6));
    }
    // Snout, mouth and fangs
    ctx.fillStyle = "#2a1838";
    ctx.beginPath(); ctx.ellipse(cx, cy - S(1.9), S(1.0), S(0.7), 0, 0, Math.PI * 2); ctx.fill();
    if (chase) {
      ctx.fillStyle = "#7a1f2e";
      ctx.beginPath(); ctx.ellipse(cx, cy - S(0.3), S(1.8), S(1.3), 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#f4f0e6";
    ctx.beginPath(); ctx.moveTo(cx - S(1.5), cy - S(1.1)); ctx.lineTo(cx - S(1.0), cy + S(chase ? 1.4 : 0.6)); ctx.lineTo(cx - S(0.5), cy - S(1.1)); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + S(1.5), cy - S(1.1)); ctx.lineTo(cx + S(1.0), cy + S(chase ? 1.4 : 0.6)); ctx.lineTo(cx + S(0.5), cy - S(1.1)); ctx.closePath(); ctx.fill();
    if (e.state === AI_ALERT) drawAlertMark(cx, cy - S(13), 10);
    ctx.restore();
  }

  // ─── Sprite: Spider ───
  function drawSpider(px, py, e) {
    var now = Date.now(), t = now * 0.001 + e.animOffset;
    var chase = e.state === AI_CHASE, alert = e.state >= AI_ALERT;
    var cx = px + TILE / 2, cy = py + TILE / 2 + S(2);
    var moving = Math.abs(e.x - e.floatX) + Math.abs(e.y - e.floatY) > 0.04;
    var dt = Math.min(now - (e.legLast || now), 100) / 1000; e.legLast = now;
    e.legPhase = (e.legPhase || e.animOffset) + dt * (moving ? (chase ? 20 : 13) : 1.6);
    var spd = e.legPhase;
    if (e.renderX !== undefined) { if (px > e.renderX + 0.01) e.fDir = 1; else if (px < e.renderX - 0.01) e.fDir = -1; }
    if (e.fDir === undefined) e.fDir = 1; e.renderX = px; var fDir = e.fDir;
    var OUT = "#0a0510", RIM = "#8f6fc0";

    ctx.save();
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (e.aggroGlow > 0) { ctx.shadowBlur = S(7) * e.aggroGlow; ctx.shadowColor = "rgba(255,50,50,0.4)"; }
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath(); ctx.ellipse(cx, cy + S(9), S(13), S(2.2), 0, 0, Math.PI * 2); ctx.fill();

    // Eight arched legs: two pairs reach forward, two back, knees held high.
    // Both sets sit behind the body, the far-side one darker and offset.
    var headX = cx + fDir * S(3.6), abdX = cx - fDir * S(3.4);
    var footOff = [14.2, 10.0, -9.8, -14.0], kneeOff = [9.6, 6.4, -6.2, -9.4], kneeUp = [4.4, 7.6, 7.8, 4.6];
    function drawLegs(near) {
      for (var pass = 0; pass < 2; pass++) {
        for (var l = 0; l < 4; l++) {
          var ph = spd + l * 1.7 + (near ? 0 : Math.PI);
          var lift = Math.max(0, Math.sin(ph)) * S(2.4);
          var stride = Math.cos(ph) * S(1.6);
          var dx = near ? 0 : S(1.3), dy = near ? 0 : -S(1.5);
          var rootX = cx + fDir * S(1.6 - l * 1.0) + dx, rootY = cy - S(0.4) + dy;
          var kneeX = cx + fDir * S(kneeOff[l]) + stride * 0.4 + dx, kneeY = cy - S(kneeUp[l]) - lift + dy;
          var footX = cx + fDir * S(footOff[l]) + stride + dx, footY = cy + S(8.6) - lift * 0.8 + dy;
          if (pass === 0) {
            ctx.strokeStyle = OUT; ctx.lineWidth = S(2.7);
            ctx.beginPath(); ctx.moveTo(rootX, rootY); ctx.lineTo(kneeX, kneeY); ctx.lineTo(footX, footY); ctx.stroke();
          } else {
            ctx.strokeStyle = near ? "#5b4180" : "#3b2853"; ctx.lineWidth = S(1.6);
            ctx.beginPath(); ctx.moveTo(rootX, rootY); ctx.lineTo(kneeX, kneeY); ctx.stroke();
            ctx.strokeStyle = near ? RIM : "#59427c"; ctx.lineWidth = S(1.2);
            ctx.beginPath(); ctx.moveTo(kneeX, kneeY); ctx.lineTo(footX, footY); ctx.stroke();
            if (near) { ctx.fillStyle = "#b79be0"; ctx.beginPath(); ctx.arc(kneeX, kneeY, S(0.9), 0, Math.PI * 2); ctx.fill(); }
          }
        }
      }
    }
    drawLegs(false);
    drawLegs(true);
    ctx.shadowBlur = 0;

    // Abdomen with the red hourglass
    cy -= S(1.6);
    var abdGrad = ctx.createRadialGradient(abdX - S(1.6), cy - S(2.4), S(0.8), abdX, cy, S(7));
    abdGrad.addColorStop(0, "#6d4f96"); abdGrad.addColorStop(0.55, "#33224c"); abdGrad.addColorStop(1, "#150c20");
    ctx.fillStyle = abdGrad; ctx.strokeStyle = OUT; ctx.lineWidth = S(1.4);
    var swell = moving ? 0 : Math.sin(t * 2.4) * TILE * 0.011;
    ctx.beginPath(); ctx.ellipse(abdX, cy, S(6.4) + swell, S(5.6) + swell, 0, 0, Math.PI * 2); ctx.stroke(); ctx.fill();
    ctx.strokeStyle = "rgba(143,111,192,0.55)"; ctx.lineWidth = S(0.7);
    ctx.beginPath(); ctx.ellipse(abdX, cy, S(5.9), S(5.1), 0, Math.PI * 1.05, Math.PI * 1.85); ctx.stroke();
    ctx.fillStyle = "#ff4d4d";
    ctx.beginPath(); ctx.moveTo(abdX - S(2.2), cy - S(3.2)); ctx.lineTo(abdX + S(2.2), cy - S(3.2)); ctx.lineTo(abdX, cy - S(0.3)); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(abdX - S(2.2), cy + S(3.0)); ctx.lineTo(abdX + S(2.2), cy + S(3.0)); ctx.lineTo(abdX, cy + S(0.3)); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.beginPath(); ctx.ellipse(abdX - S(1.8), cy - S(2.6), S(2.4), S(1.3), -0.5, 0, Math.PI * 2); ctx.fill();

    // Head with fangs and a cluster of eyes
    var headGrad = ctx.createRadialGradient(headX - S(0.8), cy - S(1.6), S(0.6), headX, cy, S(4.6));
    headGrad.addColorStop(0, "#5f4486"); headGrad.addColorStop(1, "#1a1028");
    ctx.fillStyle = headGrad; ctx.strokeStyle = OUT; ctx.lineWidth = S(1.3);
    ctx.beginPath(); ctx.ellipse(headX, cy, S(4.2), S(3.8), 0, 0, Math.PI * 2); ctx.stroke(); ctx.fill();
    var bite = chase ? Math.abs(Math.sin(t * 9)) * S(1.0) : 0;
    ctx.fillStyle = "#e8dfd0"; ctx.strokeStyle = OUT; ctx.lineWidth = S(0.6);
    for (var fs = -1; fs <= 1; fs += 2) {
      ctx.beginPath();
      ctx.moveTo(headX + fDir * S(2.6), cy + S(1.6) + fs * S(0.9));
      ctx.lineTo(headX + fDir * S(4.2), cy + S(4.6) + fs * (S(0.6) + bite));
      ctx.lineTo(headX + fDir * S(1.4), cy + S(2.4) + fs * S(0.9));
      ctx.closePath(); ctx.stroke(); ctx.fill();
    }
    var eyeCol = alert ? "#ff3b30" : "#c22a2a";
    var eCX = headX + fDir * S(1.5), eCY = cy - S(0.9);
    ctx.fillStyle = alert ? "rgba(255,60,48,0.45)" : "rgba(200,40,40,0.25)";
    ctx.beginPath(); ctx.arc(eCX, eCY, S(3.0), 0, Math.PI * 2); ctx.fill();
    var eyes = [[0.6, -0.5, 1.35], [-1.6, -0.9, 1.15], [1.7, 0.9, 0.8], [-0.6, 1.2, 0.8], [-2.7, 0.5, 0.7]];
    for (var ei = 0; ei < eyes.length; ei++) {
      var ex = eCX + fDir * S(eyes[ei][0]), eyy = eCY + S(eyes[ei][1]);
      ctx.fillStyle = eyeCol;
      ctx.beginPath(); ctx.arc(ex, eyy, S(eyes[ei][2]), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillRect(ex - S(0.5), eyy - S(0.6), S(0.45), S(0.45));
    }
    if (e.state === AI_ALERT) drawAlertMark(cx, cy - S(13), 10);
    ctx.restore();
  }

  // ─── Sprite: Snake ───
  function drawSnake(px, py, e) {
    var now = Date.now();
    var t = now * 0.003 + e.animOffset;
    var chase = e.state === AI_CHASE;
    var cx = px + TILE / 2, baseY = py + TILE - S(5.5);
    if (e.renderX !== undefined) { if (px > e.renderX + 0.01) e.fDir = 1; else if (px < e.renderX - 0.01) e.fDir = -1; }
    if (e.fDir === undefined) e.fDir = 1; e.renderX = px; var fDir = e.fDir;

    // A patrolling snake moves in short bursts; hold the slither pose across
    // the pauses so it only coils up once it has really come to rest
    var moving = Math.abs(e.x - e.floatX) + Math.abs(e.y - e.floatY) > 0.04;
    if (moving) e.slitherUntil = now + 1500;
    var slither = !chase && e.slitherUntil > now;
    var dt = Math.min(now - (e.snakeLast || now), 100) / 1000; e.snakeLast = now;
    e.wavePhase = (e.wavePhase || e.animOffset) + dt * (chase ? 11 : moving ? 9 : 2.2);
    var wave = e.wavePhase;

    var OUTLINE = "#10241a", MAIN = "#3f9d58", LIGHT = "#7fd68c", DARKBAND = "#1f4d36", BELLY = "#d9d198", HEADTOP = "#2f8448";

    // shared viper-profile head; angle in the mirrored frame (+x = forward)
    function drawHead(hx, hy, ang, k) {
      ctx.save();
      ctx.translate(hx, hy);
      ctx.scale(fDir, 1);
      ctx.rotate(ang);
      ctx.scale(k, k);
      var HL = S(6.6), HH = S(4.2), jawDrop = chase ? S(2.4) : 0;
      function headPath() {
        ctx.beginPath();
        ctx.moveTo(-S(2.6), -S(0.3));
        ctx.quadraticCurveTo(-S(2.6), -HH * 0.88, S(1.0), -HH * 0.92);
        ctx.quadraticCurveTo(HL * 0.6, -HH * 0.9, HL * 0.98, -S(1.0));
        ctx.quadraticCurveTo(HL * 1.1, S(0.35), HL * 0.86, S(0.95));
        ctx.quadraticCurveTo(HL * 0.4, HH * 0.52, -S(0.8), HH * 0.5);
        ctx.quadraticCurveTo(-S(2.6), HH * 0.48, -S(2.6), -S(0.3));
        ctx.closePath();
      }
      if (chase) {
        // gaping mouth behind the skull: red interior, then the dropped lower jaw
        var jx = -S(0.4), jy = HH * 0.3, ja = 0.5, JL = HL * 0.82;
        var jtx = jx + Math.cos(ja) * JL, jty = jy + Math.sin(ja) * JL;
        ctx.fillStyle = OUTLINE; ctx.strokeStyle = OUTLINE; ctx.lineWidth = S(1.7); ctx.lineJoin = "round";
        ctx.beginPath(); ctx.moveTo(jx, jy - S(1)); ctx.lineTo(HL * 0.9, S(0.4)); ctx.lineTo(jtx, jty); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#8e2f3c";
        ctx.beginPath(); ctx.moveTo(jx, jy - S(1)); ctx.lineTo(HL * 0.9, S(0.4)); ctx.lineTo(jtx, jty); ctx.closePath(); ctx.fill();
        ctx.lineCap = "round";
        ctx.strokeStyle = OUTLINE; ctx.lineWidth = S(3.0);
        ctx.beginPath(); ctx.moveTo(jx, jy + S(0.5)); ctx.lineTo(jtx, jty); ctx.stroke();
        ctx.strokeStyle = BELLY; ctx.lineWidth = S(1.5);
        ctx.beginPath(); ctx.moveTo(jx, jy + S(0.5)); ctx.lineTo(jtx, jty); ctx.stroke();
      }
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = S(1.7); ctx.lineJoin = "round";
      headPath(); ctx.stroke();
      var hg = ctx.createLinearGradient(0, -HH, 0, HH * 0.55);
      hg.addColorStop(0, HEADTOP); hg.addColorStop(0.6, MAIN); hg.addColorStop(1, LIGHT);
      ctx.fillStyle = hg;
      headPath(); ctx.fill();
      if (chase) {
        // fangs
        ctx.fillStyle = "#f6f1e0";
        ctx.beginPath(); ctx.moveTo(HL * 0.66, S(0.7)); ctx.lineTo(HL * 0.84, S(0.6)); ctx.lineTo(HL * 0.72, S(2.9)); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(HL * 0.42, S(1.1)); ctx.lineTo(HL * 0.54, S(1.0)); ctx.lineTo(HL * 0.46, S(2.4)); ctx.closePath(); ctx.fill();
      } else {
        ctx.strokeStyle = OUTLINE; ctx.lineWidth = S(0.5); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(HL * 0.18, S(0.85)); ctx.quadraticCurveTo(HL * 0.6, S(1.0), HL * 0.98, S(0.3)); ctx.stroke();
      }
      // brow ridge (lower and angrier when hunting)
      ctx.strokeStyle = DARKBAND; ctx.lineWidth = S(1.0); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(HL * 0.08, -HH * (chase ? 0.78 : 0.7)); ctx.lineTo(HL * 0.56, -HH * (chase ? 0.5 : 0.62)); ctx.stroke();
      // eye: amber with a slit pupil and a glint
      ctx.fillStyle = OUTLINE;
      ctx.beginPath(); ctx.arc(HL * 0.36, -HH * 0.3, S(1.75), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = chase ? "#ffd23a" : "#f0e2a0";
      ctx.beginPath(); ctx.arc(HL * 0.36, -HH * 0.3, S(1.3), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#101010";
      ctx.beginPath(); ctx.ellipse(HL * 0.39, -HH * 0.3, S(0.42), S(1.1), 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath(); ctx.arc(HL * 0.3, -HH * 0.42, S(0.35), 0, Math.PI * 2); ctx.fill();
      // nostril
      ctx.fillStyle = OUTLINE;
      ctx.beginPath(); ctx.arc(HL * 0.88, -S(0.5), S(0.3), 0, Math.PI * 2); ctx.fill();
      // forked tongue
      var flick = Math.sin(t * (chase ? 5.5 : 1.6));
      if (flick > (chase ? 0.15 : 0.62)) {
        var ext = S(3.8) * Math.min(1, (flick - (chase ? 0.15 : 0.62)) / 0.3);
        ctx.strokeStyle = "#e04a4a"; ctx.lineWidth = S(0.75); ctx.lineCap = "round";
        var tx0 = HL * 1.0, ty0 = S(0.3) + jawDrop * 0.5;
        ctx.beginPath(); ctx.moveTo(tx0, ty0); ctx.lineTo(tx0 + ext * 0.7, ty0 + S(0.15)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(tx0 + ext * 0.7, ty0 + S(0.15)); ctx.lineTo(tx0 + ext, ty0 - S(0.7)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(tx0 + ext * 0.7, ty0 + S(0.15)); ctx.lineTo(tx0 + ext, ty0 + S(0.85)); ctx.stroke();
      }
      ctx.restore();
    }

    // Tapered body along a spine (tail → head): outline, flesh, saddle bands
    // on the back, pale belly and a top highlight for volume
    function drawBody(spine, radii) {
      var n = spine.length - 1, i;
      function pass(color, grow, scale, off) {
        ctx.strokeStyle = color; ctx.lineCap = "round"; ctx.lineJoin = "round";
        for (i = 0; i < n; i++) {
          var a = spine[i], b = spine[i + 1];
          var tx = b.x - a.x, ty = b.y - a.y, tl = Math.sqrt(tx * tx + ty * ty) || 1;
          // belly side: to the right of travel in the mirrored frame
          var nx = -ty / tl * fDir, ny = tx / tl * fDir;
          var r = (radii[i] + radii[i + 1]) / 2;
          ctx.lineWidth = Math.max(S(0.5), r * 2 * scale + grow);
          ctx.beginPath();
          ctx.moveTo(a.x + nx * radii[i] * off, a.y + ny * radii[i] * off);
          ctx.lineTo(b.x + nx * radii[i + 1] * off, b.y + ny * radii[i + 1] * off);
          ctx.stroke();
        }
      }
      pass(OUTLINE, S(1.7), 1, 0);
      pass(MAIN, 0, 1, 0);
      // saddle bands, evenly spaced along the body length
      var acc = 0, next = S(2.2);
      for (i = 1; i < n - 1; i++) {
        var sdx = spine[i].x - spine[i - 1].x, sdy = spine[i].y - spine[i - 1].y;
        acc += Math.sqrt(sdx * sdx + sdy * sdy);
        if (acc < next || radii[i] < S(1.4)) continue;
        next = acc + S(4.6);
        var ang = Math.atan2(spine[i + 1].y - spine[i - 1].y, spine[i + 1].x - spine[i - 1].x);
        ctx.save(); ctx.translate(spine[i].x, spine[i].y); ctx.rotate(ang);
        ctx.fillStyle = DARKBAND;
        ctx.beginPath(); ctx.ellipse(0, -fDir * radii[i] * 0.3, S(1.45), radii[i] * 0.7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      pass(BELLY, 0, 0.19, 0.74);
      pass("rgba(170,240,170,0.5)", 0, 0.16, -0.55);
    }

    function taper(p) {
      // radius profile: whip tail, full mid-body, slimmer neck
      var r = p < 0.34 ? 0.7 + (p / 0.34) * 2.5 : p < 0.72 ? 3.2 : 3.2 - (p - 0.72) / 0.28 * 0.8;
      return S(r);
    }

    ctx.save();

    if (chase) {
      // ── Strike pose: body braced on the ground, neck reared in an S, mouth open ──
      var N = 26, spine = [], radii = [];
      var tailX = cx - fDir * S(13);
      var sway = Math.sin(t * 3.2) * S(0.9);
      for (var i = 0; i <= N; i++) {
        var p = i / N, sx, sy;
        if (p < 0.58) {
          sx = tailX + fDir * (p / 0.58) * S(17);
          sy = baseY + Math.sin(wave - p * 9) * S(1.5) * (0.35 + p);
        } else {
          var q = (p - 0.58) / 0.42, ease = q * q * (3 - 2 * q);
          sx = tailX + fDir * (S(17) + q * S(6.5) - Math.sin(q * Math.PI) * S(3.4)) + sway * q;
          sy = baseY + Math.sin(wave - 0.58 * 9) * S(1.5) * (1 - q) - ease * S(12.5);
        }
        spine.push({ x: sx, y: sy }); radii.push(taper(p));
      }
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath(); ctx.ellipse(cx - fDir * S(2), baseY + S(3.4), S(12), S(1.8), 0, 0, Math.PI * 2); ctx.fill();
      drawBody(spine, radii);
      var hp = spine[N];
      drawHead(hp.x - fDir * S(1.2), hp.y - S(0.4), 0.22 + Math.sin(t * 3.2) * 0.06, 1.25);
      drawAlertMark(hp.x + fDir * S(2), hp.y - S(9), 9);
    } else if (slither) {
      // ── Slither: a travelling wave from head to tail, head carried just off the ground ──
      var N2 = 26, spine2 = [], radii2 = [];
      var tailX2 = cx - fDir * S(14);
      for (var j = 0; j <= N2; j++) {
        var p2 = j / N2;
        var env = 0.45 + 0.75 * Math.sin(Math.min(p2 * 1.25, 1) * Math.PI) * (1 - p2 * 0.35);
        var lift = p2 > 0.72 ? Math.pow((p2 - 0.72) / 0.28, 1.6) * S(4.2) : 0;
        spine2.push({
          x: tailX2 + fDir * p2 * S(24.5),
          y: baseY + S(0.6) + Math.sin(wave - p2 * 8.4) * S(2.3) * env * (p2 > 0.72 ? 1 - (p2 - 0.72) / 0.28 : 1) - lift
        });
        radii2.push(taper(p2));
      }
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath(); ctx.ellipse(cx, baseY + S(3.6), S(13), S(1.6), 0, 0, Math.PI * 2); ctx.fill();
      drawBody(spine2, radii2);
      var hp2 = spine2[N2];
      drawHead(hp2.x - fDir * S(1.0), hp2.y - S(0.3), 0.05, 1.12);
    } else {
      // ── Resting pose: a stacked rope-coil with the head lying on the top loop ──
      var breathe = 1 + Math.sin(t * 1.1) * 0.035;
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath(); ctx.ellipse(cx, baseY + S(3.6), S(12.5), S(2.2), 0, 0, Math.PI * 2); ctx.fill();
      // tail tip poking out at the back
      var tbx = cx - fDir * S(9.6), tby = baseY + S(1.9);
      for (var tp = 0; tp < 2; tp++) {
        ctx.strokeStyle = tp ? MAIN : OUTLINE; ctx.lineWidth = tp ? S(1.5) : S(3.0); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(tbx, tby); ctx.quadraticCurveTo(tbx - fDir * S(3.2), tby - S(0.3), tbx - fDir * S(4.6), tby - S(1.6)); ctx.stroke();
      }
      var loops = [
        { x: cx,                 y: baseY - S(0.3), rx: S(9.6), ry: S(3.4) },
        { x: cx - fDir * S(0.5), y: baseY - S(3.9), rx: S(7.4), ry: S(2.8) },
        { x: cx - fDir * S(0.9), y: baseY - S(7.1), rx: S(4.9), ry: S(2.1) }
      ];
      for (var li = 0; li < loops.length; li++) {
        var L = loops[li], ry = L.ry * breathe;
        ctx.strokeStyle = OUTLINE; ctx.lineWidth = S(6.3);
        ctx.beginPath(); ctx.ellipse(L.x, L.y, L.rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = MAIN; ctx.lineWidth = S(4.7);
        ctx.beginPath(); ctx.ellipse(L.x, L.y, L.rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = DARKBAND; ctx.lineWidth = S(4.7); ctx.lineCap = "butt";
        var nb = 7 - li * 2;
        for (var ba = 0; ba < nb; ba++) {
          var a0 = 0.3 + li * 0.5 + ba * (Math.PI * 2 / nb);
          ctx.beginPath(); ctx.ellipse(L.x, L.y, L.rx, ry, 0, a0, a0 + 0.2 + li * 0.05); ctx.stroke();
        }
        // pale belly along the lower front edge, highlight along the top
        ctx.strokeStyle = BELLY; ctx.lineWidth = S(0.9); ctx.lineCap = "round";
        ctx.beginPath(); ctx.ellipse(L.x, L.y + S(1.75), L.rx + S(0.3), ry, 0, 0.45, Math.PI - 0.45); ctx.stroke();
        ctx.strokeStyle = "rgba(170,240,170,0.5)"; ctx.lineWidth = S(0.8);
        ctx.beginPath(); ctx.ellipse(L.x, L.y - S(1.3), L.rx, ry, 0, 0.5, Math.PI - 0.5); ctx.stroke();
      }
      // neck from the top loop to a resting head
      var nx0 = cx + fDir * S(1.5), ny0 = baseY - S(8.6);
      var hx = cx + fDir * S(7.2), hy = baseY - S(7.0) + Math.sin(t * 1.1) * S(0.35);
      for (var np = 0; np < 2; np++) {
        ctx.strokeStyle = np ? MAIN : OUTLINE; ctx.lineWidth = np ? S(4.2) : S(5.8); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(nx0, ny0); ctx.quadraticCurveTo(cx + fDir * S(4.6), baseY - S(9.6), hx, hy); ctx.stroke();
      }
      drawHead(hx, hy, 0.14, 1.08);
    }

    ctx.restore();
  }

  function drawCrab(px, py, e) {
    var now = Date.now(), t = now * 0.001 + e.animOffset;
    var chase = e.state === AI_CHASE, alert = e.state >= AI_ALERT;
    var moving = Math.abs(e.x - e.floatX) + Math.abs(e.y - e.floatY) > 0.04;
    var dt = Math.min(now - (e.legLast || now), 100) / 1000; e.legLast = now;
    e.legPhase = (e.legPhase || e.animOffset) + dt * (moving ? 11 : 1.2);
    var spd = e.legPhase;
    var cx = px + TILE / 2, cy = py + TILE / 2 + S(4.5) + Math.abs(Math.sin(spd)) * S(moving ? 0.8 : 0.25);
    // the eyes follow the miner
    var look = Math.max(-1, Math.min(1, (s.playerX - e.floatX) * 0.6));
    var OUT = "#3a0f0a", SHELL = "#e2573a", SHELL_L = "#ff8a5c", SHELL_D = "#a8321c";

    ctx.save();
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (e.aggroGlow > 0) { ctx.shadowBlur = S(7) * e.aggroGlow; ctx.shadowColor = "rgba(255,50,50,0.4)"; }
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.beginPath(); ctx.ellipse(cx, py + TILE - S(1.6), S(12), S(2.2), 0, 0, Math.PI * 2); ctx.fill();

    // Walking legs, three a side
    for (var pass = 0; pass < 2; pass++) {
      for (var side = -1; side <= 1; side += 2) {
        for (var l = 0; l < 3; l++) {
          var ph = spd + l * 2.1 + (side > 0 ? Math.PI : 0);
          var lift = Math.max(0, Math.sin(ph)) * S(2.0);
          var x1 = cx + side * S(6.5 - l * 0.6), y1 = cy + S(1.6);
          var x2 = cx + side * S(10.8 + l * 0.9), y2 = cy + S(0.2) - lift + l * S(0.5);
          var x3 = cx + side * S(11.8 + l * 1.3), y3 = py + TILE - S(2.0) - lift * 0.6;
          ctx.strokeStyle = pass ? (l === 1 ? SHELL_L : SHELL) : OUT; ctx.lineWidth = pass ? S(1.7) : S(3.1);
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.stroke();
        }
      }
    }
    ctx.shadowBlur = 0;

    // Crystal spikes growing from the back of the shell
    var spikes = [[-5.6, -5.2, -8.2, -12.6, 2.6], [5.8, -5.0, 8.6, -11.4, 2.4], [0, -6.0, 0.6, -16.2, 3.3]];
    for (var si = 0; si < spikes.length; si++) {
      var bx = cx + S(spikes[si][0]), by = cy + S(spikes[si][1]), tx = cx + S(spikes[si][2]), ty = cy + S(spikes[si][3]), hw = S(spikes[si][4]);
      ctx.strokeStyle = "#0d4a44"; ctx.lineWidth = S(1.3);
      ctx.fillStyle = "#4ae8d4";
      ctx.beginPath(); ctx.moveTo(bx - hw, by); ctx.lineTo(tx, ty); ctx.lineTo(bx + hw, by); ctx.closePath(); ctx.stroke(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath(); ctx.moveTo(bx - hw, by); ctx.lineTo(tx, ty); ctx.lineTo(bx - hw * 0.15, by); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(0,60,70,0.35)";
      ctx.beginPath(); ctx.moveTo(bx + hw, by); ctx.lineTo(tx, ty); ctx.lineTo(bx + hw * 0.3, by); ctx.closePath(); ctx.fill();
    }
    var glint = ((now + e.animOffset * 900) % 2800) / 2800;
    if (glint < 0.2) drawSparkle(cx + S(0.2), cy - S(14.6), S(3.4) * Math.sin(glint / 0.2 * Math.PI), "rgba(255,255,255,0.95)");

    // Claws: raised either side, snapping when it hunts
    var snap = chase ? (Math.sin(t * 10) * 0.5 + 0.5) : (Math.sin(t * 2.2) * 0.5 + 0.5) * 0.35;
    for (var cs = -1; cs <= 1; cs += 2) {
      var ax = cx + cs * S(8.2), ay = cy - S(0.4), kx = cx + cs * S(12.6), ky = cy - S(4.8);
      ctx.strokeStyle = OUT; ctx.lineWidth = S(4.0);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(kx, ky); ctx.stroke();
      ctx.strokeStyle = SHELL; ctx.lineWidth = S(2.5);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(kx, ky); ctx.stroke();
      ctx.save();
      ctx.translate(kx, ky - S(1.6)); ctx.scale(cs, 1); ctx.rotate(-0.55);
      ctx.strokeStyle = OUT; ctx.lineWidth = S(1.3);
      // fixed lower finger
      ctx.fillStyle = SHELL;
      ctx.beginPath(); ctx.moveTo(-S(2.6), S(1.6)); ctx.quadraticCurveTo(S(1.4), S(4.2), S(5.6), S(0.4)); ctx.lineTo(S(0.6), S(0.2)); ctx.closePath(); ctx.stroke(); ctx.fill();
      // hinged upper finger
      ctx.save(); ctx.rotate(-0.15 - snap * 0.75);
      ctx.fillStyle = SHELL_L;
      ctx.beginPath(); ctx.moveTo(-S(3.0), S(0.6)); ctx.quadraticCurveTo(-S(1.4), -S(4.8), S(6.0), -S(1.2)); ctx.quadraticCurveTo(S(2.2), S(0.2), S(0.2), S(1.2)); ctx.closePath(); ctx.stroke(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.beginPath(); ctx.ellipse(-S(0.2), -S(1.9), S(1.9), S(0.8), 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.restore();
    }

    // Domed shell
    var shellGrad = ctx.createRadialGradient(cx - S(2.6), cy - S(3.2), S(1), cx, cy, S(10.5));
    shellGrad.addColorStop(0, SHELL_L); shellGrad.addColorStop(0.55, SHELL); shellGrad.addColorStop(1, SHELL_D);
    ctx.fillStyle = shellGrad; ctx.strokeStyle = OUT; ctx.lineWidth = S(1.5);
    ctx.beginPath();
    ctx.moveTo(cx - S(9.4), cy + S(1.6));
    ctx.bezierCurveTo(cx - S(9.8), cy - S(7.4), cx + S(9.8), cy - S(7.4), cx + S(9.4), cy + S(1.6));
    ctx.quadraticCurveTo(cx, cy + S(5.4), cx - S(9.4), cy + S(1.6));
    ctx.closePath(); ctx.stroke(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath(); ctx.ellipse(cx - S(3.0), cy - S(3.2), S(3.6), S(1.5), -0.35, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(120,20,10,0.45)";
    ctx.beginPath(); ctx.arc(cx + S(4.6), cy - S(1.4), S(0.9), 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + S(6.2), cy + S(0.6), S(0.6), 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx - S(6.2), cy + S(0.2), S(0.7), 0, Math.PI * 2); ctx.fill();
    // mouth
    ctx.strokeStyle = OUT; ctx.lineWidth = S(0.9);
    ctx.beginPath(); ctx.moveTo(cx - S(1.8), cy + S(2.6)); ctx.quadraticCurveTo(cx, cy + S(chase ? 1.6 : 3.4), cx + S(1.8), cy + S(2.6)); ctx.stroke();

    // Eyes on stalks
    for (var es = -1; es <= 1; es += 2) {
      var sx0 = cx + es * S(2.8), sy0 = cy - S(3.6), ex = cx + es * S(3.4) + look * S(0.6), ey = cy - S(8.0) + Math.sin(t * 2 + es) * S(0.3);
      ctx.strokeStyle = OUT; ctx.lineWidth = S(2.6);
      ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = SHELL; ctx.lineWidth = S(1.4);
      ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = OUT;
      ctx.beginPath(); ctx.arc(ex, ey, S(2.9), 0, Math.PI * 2); ctx.fill();
      if (!alert && blinking(e, now, 4700)) {   // lids down: shell-coloured, with the lash line
        ctx.fillStyle = SHELL;
        ctx.beginPath(); ctx.arc(ex, ey, S(2.2), 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1, S(0.8));
        ctx.beginPath(); ctx.moveTo(ex - S(1.8), ey + S(0.5)); ctx.quadraticCurveTo(ex, ey + S(1.3), ex + S(1.8), ey + S(0.5)); ctx.stroke();
        continue;
      }
      ctx.fillStyle = alert ? "#ffd9d4" : "#f6f6ee";
      ctx.beginPath(); ctx.arc(ex, ey, S(2.2), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = alert ? "#e0271c" : "#16141a";
      ctx.beginPath(); ctx.arc(ex + look * S(0.8), ey + S(0.3), S(1.15), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillRect(ex - S(1.1), ey - S(1.3), S(0.6), S(0.6));
      if (alert) {   // angry brow
        ctx.strokeStyle = OUT; ctx.lineWidth = S(1.1);
        ctx.beginPath(); ctx.moveTo(ex - es * S(2.6), ey - S(3.2)); ctx.lineTo(ex + es * S(1.6), ey - S(1.6)); ctx.stroke();
      }
    }
    if (e.state === AI_ALERT) drawAlertMark(cx, cy - S(20), 12);
    ctx.restore();
  }

  // ─── Shared with the other render files ───
  gfx.drawBat = drawBat; gfx.drawSpider = drawSpider; gfx.drawSnake = drawSnake; gfx.drawCrab = drawCrab;
})();
