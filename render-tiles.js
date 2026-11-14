"use strict";

// ═══════════════════════════════════════════════════════════════════
// render-tiles.js - sprites for things that sit in a cell: liquids, doors, key, exit,
// barrels, boulders, minecarts and the shaft lift
// ═══════════════════════════════════════════════════════════════════

(function() {
  var s = Game.state, gfx = Game.gfx;

  // Drawing context for the current frame (see Game.gfx.begin in render-core.js)
  var ctx, TILE, animFrame;
  gfx.bind(function() { ctx = gfx.ctx; TILE = gfx.tile; animFrame = gfx.animFrame; });

  // from the files loaded before this one
  var cellRand = gfx.cellRand,
      drawBackdrop = gfx.drawBackdrop,
      drawCaveBg = gfx.drawCaveBg,
      drawSparkle = gfx.drawSparkle;

  // ─── Water and lava ───
  // A cell with open air above gets a rolling surface (the wave runs in world
  // coordinates, so it is continuous from tile to tile); deeper cells are
  // solid liquid with drifting light, bubbles or crust.
  function drawLiquid(px, py, x, y, lava) {
    var now = Date.now() * 0.001;
    var self = lava ? T.LAVA : T.WATER;
    var above = s.grid[y - 1] ? s.grid[y - 1][x] : T.WALL;
    var surface = above !== self && !(!lava && above === T.PLAYER && s.playerOnWater);
    var top = surface ? py + S(3.2) : py, i, lx;
    function waveY(l) {
      var wx = x * 32 + l / TILE * 32;
      return lava ? Math.sin(now * 1.3 + wx * 0.16) * S(0.9) + Math.sin(now * 0.8 - wx * 0.31) * S(0.5)
                  : Math.sin(now * 2.6 + wx * 0.22) * S(1.1) + Math.sin(now * 1.7 - wx * 0.37) * S(0.6);
    }
    function tracePath(off, close) {
      ctx.beginPath();
      if (surface) {
        ctx.moveTo(px, top + off + waveY(0));
        for (lx = TILE / 6; lx <= TILE + 0.5; lx += TILE / 6) ctx.lineTo(px + lx, top + off + waveY(lx));
      } else { ctx.moveTo(px, py); ctx.lineTo(px + TILE + 1, py); }
      if (close) { ctx.lineTo(px + TILE + 1, py + TILE + 1); ctx.lineTo(px, py + TILE + 1); ctx.closePath(); }
    }

    drawCaveBg(px, py);
    var grad = ctx.createLinearGradient(0, py, 0, py + TILE);
    if (lava) {
      if (surface) { grad.addColorStop(0, "#ffb02e"); grad.addColorStop(0.35, "#f0560c"); grad.addColorStop(1, "#a31a00"); }
      else { grad.addColorStop(0, "#c93606"); grad.addColorStop(1, "#8f1400"); }
    } else {
      if (surface) { grad.addColorStop(0, "rgba(72,158,240,0.84)"); grad.addColorStop(1, "rgba(28,84,178,0.9)"); }
      else { grad.addColorStop(0, "rgba(26,78,168,0.9)"); grad.addColorStop(1, "rgba(15,50,124,0.93)"); }
    }
    ctx.fillStyle = grad; tracePath(0, true); ctx.fill();

    if (lava) {
      // cooling crust plates drifting on the melt
      for (i = 0; i < 2; i++) {
        var cxr = cellRand(x, y, i), cyr = cellRand(x, y, i + 4);
        ctx.fillStyle = "rgba(58,8,0,0.4)";
        ctx.beginPath();
        ctx.ellipse(px + (0.2 + cxr * 0.6 + Math.sin(now * 0.4 + cxr * 9) * 0.07) * TILE, py + (0.35 + cyr * 0.5) * TILE,
          S(3.6 + cxr * 2.6), S(1.5 + cyr * 1.1), (cxr - 0.5) * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      // a bright vein of hotter melt winding through
      ctx.strokeStyle = "rgba(255,214,90,0.5)"; ctx.lineWidth = S(1.0); ctx.lineCap = "round";
      ctx.beginPath();
      for (lx = 0; lx <= TILE + 0.5; lx += TILE / 5) {
        var vy = py + TILE * 0.62 + Math.sin(now * 0.9 + (x * 32 + lx / TILE * 32) * 0.12 + y * 1.7) * S(3.0);
        if (lx === 0) ctx.moveTo(px + lx, vy); else ctx.lineTo(px + lx, vy);
      }
      ctx.stroke();
      if (surface) {
        // heat glow spilling upward, a white-hot skin, a swelling bubble and a rising ember
        for (i = 0; i < 3; i++) { ctx.fillStyle = "rgba(255,120,20," + [0.2, 0.11, 0.05][i] + ")"; ctx.fillRect(px, top - (i + 1) * S(2.6), TILE + 1, S(2.6)); }
        ctx.strokeStyle = "#fff1a8"; ctx.lineWidth = S(1.4); tracePath(0, false); ctx.stroke();
        var bp = (now * 0.45 + cellRand(x, y, 9)) % 1, bxp = px + (0.2 + cellRand(x, y, 10) * 0.6) * TILE;
        if (bp < 0.7) {
          var br = S(0.6 + bp / 0.7 * 2.2);
          ctx.fillStyle = "#ffd257"; ctx.strokeStyle = "rgba(120,20,0,0.7)"; ctx.lineWidth = S(0.6);
          ctx.beginPath(); ctx.arc(bxp, top + S(1.2), br, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        } else if (bp < 0.82) {
          ctx.strokeStyle = "rgba(255,230,140," + (1 - (bp - 0.7) / 0.12) + ")"; ctx.lineWidth = S(0.8);
          ctx.beginPath(); ctx.arc(bxp, top + S(0.6), S(2.8 + (bp - 0.7) * 22), Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
        }
        var ep = (now * 0.55 + cellRand(x, y, 12)) % 1;
        ctx.fillStyle = "rgba(255,200,80," + (1 - ep) + ")";
        ctx.fillRect(px + (0.15 + cellRand(x, y, 13) * 0.7) * TILE + Math.sin(now * 4 + x) * S(1), top - ep * S(13), S(1.1), S(1.1));
      }
    } else {
      // shafts of light wavering down through the water
      ctx.strokeStyle = "rgba(150,210,255,0.11)"; ctx.lineWidth = S(2.2); ctx.lineCap = "round";
      for (i = 0; i < 2; i++) {
        var sxr = ((cellRand(x, 0, i) * 32 + now * 2.2) % 32) / 32 * TILE;
        ctx.beginPath(); ctx.moveTo(px + sxr, top + S(1));
        ctx.quadraticCurveTo(px + sxr + Math.sin(now * 1.2 + i + y) * S(2.5), py + TILE * 0.55, px + sxr - S(2), py + TILE);
        ctx.stroke();
      }
      // rising bubbles
      for (i = 0; i < 2; i++) {
        if (cellRand(x, y, i + 20) > 0.55) continue;
        var up = (now * (0.28 + cellRand(x, y, i + 22) * 0.2) + cellRand(x, y, i + 24)) % 1;
        var bbx = px + (0.15 + cellRand(x, y, i + 26) * 0.7) * TILE + Math.sin(now * 3 + i * 2 + x) * S(1.0);
        var bby = py + TILE - up * (TILE - S(surface ? 5 : 0));
        ctx.strokeStyle = "rgba(205,236,255," + (0.6 * (1 - up * 0.6)) + ")"; ctx.lineWidth = S(0.6);
        ctx.beginPath(); ctx.arc(bbx, bby, S(0.9 + cellRand(x, y, i + 28) * 0.8), 0, Math.PI * 2); ctx.stroke();
      }
      if (surface) {
        ctx.strokeStyle = "rgba(170,220,255,0.26)"; ctx.lineWidth = S(1.0); tracePath(S(2.4), false); ctx.stroke();
        ctx.strokeStyle = "rgba(225,244,255,0.9)"; ctx.lineWidth = S(1.3); tracePath(0, false); ctx.stroke();
      }
    }
  }

  // ─── Locked door: oak planks, iron bands, brass lock ───
  function drawDoor(px, py) {
    var i, w = (TILE - S(4)) / 4;
    ctx.fillStyle = "#17161c"; ctx.fillRect(px, py, TILE + 1, TILE + 1);
    var woods = ["#6f4527", "#5f3a20", "#74492a", "#5b371e"];
    for (i = 0; i < 4; i++) {
      var plx = px + S(2) + i * w;
      ctx.fillStyle = woods[i]; ctx.fillRect(plx, py + S(2), w, TILE - S(4));
      ctx.fillStyle = "rgba(0,0,0,0.32)"; ctx.fillRect(plx + w - S(0.7), py + S(2), S(0.7), TILE - S(4));
      ctx.fillStyle = "rgba(255,220,170,0.10)"; ctx.fillRect(plx, py + S(2), S(0.7), TILE - S(4));
      ctx.fillStyle = "rgba(40,20,5,0.35)";
      ctx.fillRect(plx + w * 0.35, py + S(5 + i * 2), S(0.6), S(6)); ctx.fillRect(plx + w * 0.62, py + S(17 - i * 2), S(0.6), S(7));
    }
    for (i = 0; i < 2; i++) {
      var by = py + (i ? TILE - S(9.6) : S(5.6));
      ctx.fillStyle = "#33363f"; ctx.fillRect(px + S(1.2), by, TILE - S(2.4), S(3.6));
      ctx.fillStyle = "#6f7584"; ctx.fillRect(px + S(1.2), by, TILE - S(2.4), S(0.9));
      ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(px + S(1.2), by + S(3.6), TILE - S(2.4), S(0.9));
      ctx.fillStyle = "#b4bac8";
      for (var r = 0; r < 4; r++) { ctx.beginPath(); ctx.arc(px + S(4.4) + r * (TILE - S(8.8)) / 3, by + S(1.9), S(0.75), 0, Math.PI * 2); ctx.fill(); }
    }
    // brass lock plate with keyhole
    var cx = px + TILE / 2, cy = py + TILE / 2 + S(0.4);
    ctx.fillStyle = "#4b3206"; ctx.fillRect(cx - S(4.8), cy - S(5.6), S(9.6), S(11.2));
    var brass = ctx.createLinearGradient(cx - S(4), 0, cx + S(4), 0);
    brass.addColorStop(0, "#f2cf63"); brass.addColorStop(0.5, "#d9a938"); brass.addColorStop(1, "#a97a1c");
    ctx.fillStyle = brass; ctx.fillRect(cx - S(4), cy - S(4.8), S(8), S(9.6));
    ctx.fillStyle = "#1a1206";
    ctx.beginPath(); ctx.arc(cx, cy - S(1.2), S(1.7), 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - S(1.0), cy - S(0.6)); ctx.lineTo(cx + S(1.0), cy - S(0.6)); ctx.lineTo(cx + S(1.5), cy + S(3.2)); ctx.lineTo(cx - S(1.5), cy + S(3.2)); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.fillRect(cx - S(3.4), cy - S(4.2), S(1.2), S(1.2));
    var gl = ((Date.now() + px * 7) % 3200) / 3200;
    if (gl < 0.14) drawSparkle(cx + S(2.6), cy - S(3.4), S(3.0) * Math.sin(gl / 0.14 * Math.PI), "rgba(255,255,255,0.9)");
  }

  // ─── Logic door: sealed slab that only the right answer opens ───
  function drawLogicDoor(px, py) {
    var now = Date.now() * 0.001, cx = px + TILE / 2, cy = py + TILE / 2;
    var pulse = Math.sin(now * 2.4 + px * 0.01) * 0.5 + 0.5;
    ctx.fillStyle = "#11141c"; ctx.fillRect(px, py, TILE + 1, TILE + 1);
    var slab = ctx.createLinearGradient(px, py, px + TILE, py + TILE);
    slab.addColorStop(0, "#353c4e"); slab.addColorStop(0.5, "#262b39"); slab.addColorStop(1, "#191d28");
    ctx.fillStyle = slab; ctx.fillRect(px + S(1.6), py + S(1.6), TILE - S(3.2), TILE - S(3.2));
    ctx.fillStyle = "rgba(200,220,255,0.16)"; ctx.fillRect(px + S(1.6), py + S(1.6), TILE - S(3.2), S(1.1));
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(px + S(1.6), py + TILE - S(2.9), TILE - S(3.2), S(1.3));
    // centre seam and corner bolts
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(cx - S(0.5), py + S(2), S(1), TILE - S(4));
    ctx.fillStyle = "#7b8498";
    [[4.2, 4.2], [27.8, 4.2], [4.2, 27.8], [27.8, 27.8]].forEach(function(b) { ctx.beginPath(); ctx.arc(px + S(b[0]), py + S(b[1]), S(1.1), 0, Math.PI * 2); ctx.fill(); });
    // glowing question ring
    var a = 0.55 + pulse * 0.45;
    ctx.fillStyle = "rgba(74,232,212," + (0.10 + pulse * 0.12) + ")";
    ctx.beginPath(); ctx.arc(cx, cy, S(10.5), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0d1118";
    ctx.beginPath(); ctx.arc(cx, cy, S(8.2), 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(74,232,212," + a + ")"; ctx.lineWidth = S(1.5);
    ctx.beginPath(); ctx.arc(cx, cy, S(8.2), 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = S(1.0); ctx.setLineDash([S(2.4), S(2.4)]); ctx.lineDashOffset = -now * S(5);
    ctx.beginPath(); ctx.arc(cx, cy, S(6.0), 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(190,255,245," + a + ")"; ctx.font = 'bold ' + S(9) + 'px "Press Start 2P",monospace';
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("?", cx + S(0.6), cy + S(0.8)); ctx.textBaseline = "alphabetic";
  }

  // ─── Key ───
  function drawKey(px, py, x, y) {
    var now = Date.now() * 0.001, cx = px + TILE / 2, cy = py + TILE / 2 + Math.sin(now * 2.6 + x) * S(1.0);
    var pulse = Math.sin(now * 3 + y) * 0.5 + 0.5;
    var glow = ctx.createRadialGradient(cx, cy, S(1), cx, cy, S(15));
    glow.addColorStop(0, "rgba(255,215,60," + (0.34 + pulse * 0.18) + ")"); glow.addColorStop(1, "rgba(255,215,60,0)");
    ctx.fillStyle = glow; ctx.fillRect(px, py, TILE, TILE);
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(-0.6);
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    for (var pass = 0; pass < 2; pass++) {
      var grow = pass ? 0 : S(1.5);
      ctx.strokeStyle = pass ? "#f0c030" : "#4a3000";
      ctx.fillStyle = pass ? "#f0c030" : "#4a3000";
      // bow (ring)
      ctx.lineWidth = S(2.6) + grow;
      ctx.beginPath(); ctx.arc(-S(6.2), 0, S(3.6), 0, Math.PI * 2); ctx.stroke();
      // shaft and bit
      ctx.fillRect(-S(2.8) - grow / 2, -S(1.2) - grow / 2, S(13) + grow, S(2.4) + grow);
      ctx.fillRect(S(5.2) - grow / 2, 0 - grow / 2, S(1.9) + grow, S(4.8) + grow);
      ctx.fillRect(S(8.3) - grow / 2, 0 - grow / 2, S(1.9) + grow, S(3.6) + grow);
    }
    ctx.strokeStyle = "rgba(255,248,200,0.85)"; ctx.lineWidth = S(0.8);
    ctx.beginPath(); ctx.arc(-S(6.2), 0, S(3.6), Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
    ctx.fillStyle = "rgba(255,248,200,0.7)"; ctx.fillRect(-S(2.4), -S(1.0), S(11.5), S(0.7));
    ctx.restore();
    var gl = ((Date.now() + x * 400) % 2400) / 2400;
    if (gl < 0.18) drawSparkle(cx - S(6), cy + S(1.6), S(3.4) * Math.sin(gl / 0.18 * Math.PI), "rgba(255,255,255,0.95)");
  }

  // ─── Exit: a timbered shaft mouth, barred until every element is found ───
  function drawExit(px, py, open) {
    var now = Date.now() * 0.001, cx = px + TILE / 2, i;
    var inL = px + S(5.2), inR = px + TILE - S(5.2), inT = py + S(6.4), inB = py + TILE;
    if (open) {
      var pulse = Math.sin(now * 3) * 0.5 + 0.5;
      var halo = ctx.createRadialGradient(cx, py + TILE * 0.55, S(4), cx, py + TILE * 0.55, TILE * 1.05);
      halo.addColorStop(0, "rgba(255,214,110," + (0.34 + pulse * 0.16) + ")"); halo.addColorStop(1, "rgba(255,214,110,0)");
      ctx.fillStyle = halo; ctx.fillRect(px - TILE * 0.55, py - TILE * 0.5, TILE * 2.1, TILE * 2.1);
      var light = ctx.createLinearGradient(0, inT, 0, inB);
      light.addColorStop(0, "#fffbe0"); light.addColorStop(0.5, "#ffd96b"); light.addColorStop(1, "#e8a02c");
      ctx.fillStyle = light; ctx.fillRect(inL, inT, inR - inL, inB - inT);
      // chevrons climbing toward daylight
      ctx.strokeStyle = "rgba(120,70,0,0.8)"; ctx.lineWidth = S(1.8); ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (i = 0; i < 3; i++) {
        var cp = ((now * 0.9 + i / 3) % 1), chy = inB - S(3) - cp * (inB - inT - S(6));
        ctx.globalAlpha = Math.sin(cp * Math.PI);
        ctx.beginPath(); ctx.moveTo(cx - S(4.6), chy + S(2.6)); ctx.lineTo(cx, chy - S(1.6)); ctx.lineTo(cx + S(4.6), chy + S(2.6)); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = "#0a0b10"; ctx.fillRect(inL, inT, inR - inL, inB - inT);
      // iron bars and a padlocked crossbar
      for (i = 0; i < 4; i++) {
        var bx = inL + S(1.6) + i * ((inR - inL - S(3.2)) / 3);
        ctx.fillStyle = "#252830"; ctx.fillRect(bx - S(1.3), inT, S(2.6), inB - inT);
        ctx.fillStyle = "#5c6372"; ctx.fillRect(bx - S(0.9), inT, S(1.8), inB - inT);
        ctx.fillStyle = "#8b93a4"; ctx.fillRect(bx - S(0.9), inT, S(0.6), inB - inT);
      }
      ctx.fillStyle = "#252830"; ctx.fillRect(inL, py + S(17.2), inR - inL, S(3.6));
      ctx.fillStyle = "#5c6372"; ctx.fillRect(inL, py + S(17.7), inR - inL, S(2.6));
      ctx.strokeStyle = "#8b93a4"; ctx.lineWidth = S(1.3);
      ctx.beginPath(); ctx.arc(cx, py + S(16.4), S(2.5), Math.PI, 0); ctx.stroke();
      ctx.fillStyle = "#4b3206"; ctx.fillRect(cx - S(3.9), py + S(15.9), S(7.8), S(6.6));
      ctx.fillStyle = "#d9a938"; ctx.fillRect(cx - S(3.2), py + S(16.6), S(6.4), S(5.2));
      ctx.fillStyle = "#1a1206"; ctx.fillRect(cx - S(0.6), py + S(18.0), S(1.2), S(2.4));
    }
    // timber frame: two posts and a lintel
    function beam(x0, y0, w, h, vertical) {
      ctx.fillStyle = "#2a1a0c"; ctx.fillRect(x0 - S(0.8), y0 - S(0.8), w + S(1.6), h + S(1.6));
      var g = vertical ? ctx.createLinearGradient(x0, 0, x0 + w, 0) : ctx.createLinearGradient(0, y0, 0, y0 + h);
      g.addColorStop(0, "#9a6a3c"); g.addColorStop(0.5, "#7a5230"); g.addColorStop(1, "#553620");
      ctx.fillStyle = g; ctx.fillRect(x0, y0, w, h);
      ctx.fillStyle = "rgba(40,20,5,0.35)";
      if (vertical) { ctx.fillRect(x0 + w * 0.35, y0 + h * 0.15, S(0.6), h * 0.3); ctx.fillRect(x0 + w * 0.62, y0 + h * 0.55, S(0.6), h * 0.3); }
      else { ctx.fillRect(x0 + w * 0.12, y0 + h * 0.4, w * 0.2, S(0.6)); ctx.fillRect(x0 + w * 0.66, y0 + h * 0.62, w * 0.2, S(0.6)); }
    }
    beam(px + S(1.6), py + S(5.2), S(3.8), TILE - S(5.2), true);
    beam(px + TILE - S(5.4), py + S(5.2), S(3.8), TILE - S(5.2), true);
    beam(px + S(0.6), py + S(1.4), TILE - S(1.2), S(5.0), false);
    // lamp on the lintel: red while barred, green once open
    var blink = open ? 1 : (Math.sin(now * 3) * 0.3 + 0.6);
    ctx.fillStyle = open ? "rgba(90,255,140,0.35)" : "rgba(255,70,60," + blink * 0.35 + ")";
    ctx.beginPath(); ctx.arc(cx, py + S(3.9), S(3.4), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1a1206"; ctx.beginPath(); ctx.arc(cx, py + S(3.9), S(2.0), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = open ? "#5aff8c" : "rgba(255,70,60," + (0.5 + blink * 0.5) + ")";
    ctx.beginPath(); ctx.arc(cx, py + S(3.9), S(1.4), 0, Math.PI * 2); ctx.fill();
    if (open) {
      for (i = 0; i < 3; i++) {
        var sp = ((now * 0.6 + i * 0.37) % 1);
        drawSparkle(inL + (0.15 + ((i * 0.37) % 1) * 0.7) * (inR - inL), inB - sp * (inB - inT), S(2.0) * Math.sin(sp * Math.PI), "rgba(255,255,255,0.9)");
      }
    }
  }

  // ─── Sprite: Toxic Waste ───
  function drawToxicWaste(px, py, gx, gy) {
    var cx = px + TILE / 2, cy = py + TILE / 2;
    var t = animFrame * 0.04;
    var seed = (gx * 7 + gy * 13) % 17;

    // Dark cavern background
    drawCaveBg(px, py);

    // Small toxic puddle at the base
    var pudY = py + TILE - S(5);
    var pudH = S(5);
    var pudGrad = ctx.createLinearGradient(px, pudY, px, py + TILE);
    pudGrad.addColorStop(0, "rgba(50,200,60,0.3)");
    pudGrad.addColorStop(1, "rgba(30,160,40,0.6)");
    ctx.fillStyle = pudGrad;
    ctx.beginPath();
    ctx.ellipse(cx, py + TILE - S(2), TILE / 2 - S(1), S(3), 0, 0, Math.PI * 2);
    ctx.fill();

    // Puddle shimmer
    var shimA = Math.sin(t * 1.2 + gx * 2.1) * 0.1 + 0.15;
    ctx.fillStyle = "rgba(120,255,120," + shimA.toFixed(2) + ")";
    var shimX = Math.sin(t + gx * 1.5) * S(2) + S(5);
    ctx.fillRect(px + shimX, py + TILE - S(3.5), S(6), S(0.8));

    // ─── Yellow barrel - centred and prominent ───
    var bW = S(14), bH = S(16);
    var bX = cx - bW / 2, bY = cy - bH / 2 - S(1);

    // Barrel body - yellow with shading
    var bGrad = ctx.createLinearGradient(bX, bY, bX + bW, bY);
    bGrad.addColorStop(0, "#b89a10");
    bGrad.addColorStop(0.15, "#e8c820");
    bGrad.addColorStop(0.5, "#f0d838");
    bGrad.addColorStop(0.85, "#e0c020");
    bGrad.addColorStop(1, "#a08808");
    ctx.fillStyle = bGrad;
    // Rounded barrel shape
    ctx.beginPath();
    ctx.moveTo(bX + S(1), bY);
    ctx.lineTo(bX + bW - S(1), bY);
    ctx.quadraticCurveTo(bX + bW + S(0.5), bY + bH / 2, bX + bW - S(1), bY + bH);
    ctx.lineTo(bX + S(1), bY + bH);
    ctx.quadraticCurveTo(bX - S(0.5), bY + bH / 2, bX + S(1), bY);
    ctx.closePath(); ctx.fill();

    // Barrel top rim (ellipse)
    ctx.fillStyle = "#c8a818";
    ctx.beginPath(); ctx.ellipse(cx, bY, bW / 2 - S(0.5), S(2.5), 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#d8b828";
    ctx.beginPath(); ctx.ellipse(cx, bY, bW / 2 - S(1.5), S(1.5), 0, 0, Math.PI * 2); ctx.fill();

    // Metal bands - dark horizontal stripes
    ctx.fillStyle = "#8a7208";
    ctx.fillRect(bX + S(0.3), bY + S(2.5), bW - S(0.6), S(1));
    ctx.fillRect(bX + S(0.3), bY + bH - S(3.5), bW - S(0.6), S(1));

    // ─── Hazard / toxic symbol ───
    var symCx = cx, symCy = bY + bH / 2 + S(1);
    // Black circle background for the symbol
    ctx.fillStyle = "#111";
    ctx.beginPath(); ctx.arc(symCx, symCy, S(4.5), 0, Math.PI * 2); ctx.fill();

    // Three-fan radioactive trefoil
    ctx.fillStyle = "#f0d838";
    for (var fi = 0; fi < 3; fi++) {
      var angle = fi * (Math.PI * 2 / 3) - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(symCx, symCy);
      ctx.arc(symCx, symCy, S(4), angle - 0.45, angle + 0.45);
      ctx.closePath(); ctx.fill();
    }
    // Centre dot
    ctx.fillStyle = "#111";
    ctx.beginPath(); ctx.arc(symCx, symCy, S(1.2), 0, Math.PI * 2); ctx.fill();

    // Barrel highlight - left edge specular
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(bX + S(1), bY + S(3), S(1), bH - S(6));

    // Drip of green waste leaking from barrel
    var dripLen = S(2) + Math.sin(t * 1.5 + seed) * S(1);
    ctx.fillStyle = "rgba(60,220,60,0.7)";
    ctx.fillRect(cx + S(2), bY + bH - S(0.5), S(1.5), dripLen);
    ctx.beginPath(); ctx.arc(cx + S(2.7), bY + bH - S(0.5) + dripLen, S(0.8), 0, Math.PI * 2); ctx.fill();

    // Green glow around the tile - pulsing ambient toxic light
    var glowA = Math.sin(t * 1.5 + seed) * 0.06 + 0.08;
    ctx.fillStyle = "rgba(60,230,60," + glowA.toFixed(2) + ")";
    ctx.fillRect(px, py, TILE, S(0.8));
    ctx.fillRect(px, py, S(0.8), TILE);
    ctx.fillRect(px + TILE - S(0.8), py, S(0.8), TILE);
    ctx.fillRect(px, py + TILE - S(0.8), TILE, S(0.8));
  }

  // ─── Sprite: Rolling Barrel (circular end-on view, rotates when rolling) ───
  function drawRollingBarrel(px, py, gx, gy, rotation) {
    var cx = px + TILE / 2, cy = py + TILE / 2;
    var t = animFrame * 0.04;
    var seed = ((gx || 0) * 7 + (gy || 0) * 13) % 17;
    var rot = rotation || 0;

    // Dark cavern background
    drawCaveBg(px, py);

    // Small toxic puddle at the base
    var pudGrad = ctx.createLinearGradient(px, py + TILE - S(5), px, py + TILE);
    pudGrad.addColorStop(0, "rgba(50,200,60,0.2)");
    pudGrad.addColorStop(1, "rgba(30,160,40,0.45)");
    ctx.fillStyle = pudGrad;
    ctx.beginPath(); ctx.ellipse(cx, py + TILE - S(2), TILE / 2 - S(2), S(2), 0, 0, Math.PI * 2); ctx.fill();

    // ─── Circular barrel (end-on view) ───
    var r = (TILE / 2 - S(3)) * 0.8;
    var barrelCy = cy + S(1);

    // Outer rim - dark ring
    ctx.fillStyle = "#6a5810";
    ctx.beginPath(); ctx.arc(cx, barrelCy, r + S(1.5), 0, Math.PI * 2); ctx.fill();

    // Barrel face - yellow radial gradient
    var bGrad = ctx.createRadialGradient(cx - r * 0.25, barrelCy - r * 0.25, r * 0.1, cx, barrelCy, r);
    bGrad.addColorStop(0, "#f8e848");
    bGrad.addColorStop(0.6, "#e0c020");
    bGrad.addColorStop(1, "#a08808");
    ctx.fillStyle = bGrad;
    ctx.beginPath(); ctx.arc(cx, barrelCy, r, 0, Math.PI * 2); ctx.fill();

    // Metal band ring
    ctx.strokeStyle = "#8a7208"; ctx.lineWidth = S(1.2);
    ctx.beginPath(); ctx.arc(cx, barrelCy, r - S(2), 0, Math.PI * 2); ctx.stroke();

    // ─── Rotating hazard trefoil ───
    ctx.save();
    ctx.translate(cx, barrelCy);
    ctx.rotate(rot);
    // Black circle background
    ctx.fillStyle = "#111";
    ctx.beginPath(); ctx.arc(0, 0, S(5), 0, Math.PI * 2); ctx.fill();
    // Three-fan radioactive trefoil
    ctx.fillStyle = "#f0d838";
    for (var fi = 0; fi < 3; fi++) {
      var angle = fi * (Math.PI * 2 / 3) - Math.PI / 2;
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.arc(0, 0, S(4.2), angle - 0.42, angle + 0.42);
      ctx.closePath(); ctx.fill();
    }
    // Centre dot
    ctx.fillStyle = "#111";
    ctx.beginPath(); ctx.arc(0, 0, S(1.3), 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Specular highlight - top-left
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath(); ctx.arc(cx - r * 0.3, barrelCy - r * 0.35, r * 0.3, 0, Math.PI * 2); ctx.fill();

    // Green glow border - pulsing
    var glowA = Math.sin(t * 1.5 + seed) * 0.05 + 0.07;
    ctx.fillStyle = "rgba(60,230,60," + glowA.toFixed(2) + ")";
    ctx.fillRect(px, py, TILE, S(0.8));
    ctx.fillRect(px, py, S(0.8), TILE);
    ctx.fillRect(px + TILE - S(0.8), py, S(0.8), TILE);
    ctx.fillRect(px, py + TILE - S(0.8), TILE, S(0.8));
  }

  // ─── Sprite: Boulder ───
  function drawBoulder(px, py) {
    drawBackdrop(px, py, gfx.cellX, gfx.cellY);
    drawBoulderBody(px, py, 0);
  }

  // Boulder without its background cell - rot (radians) spins it about its
  // centre while it rolls
  function drawBoulderBody(px, py, rot) {
    var cx = px + TILE / 2, cy = py + TILE / 2, r = TILE / 2 - S(2);
    if (rot) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.translate(-cx, -cy); }
    // Main body - irregular polygon for organic shape
    var bodyGrad = ctx.createLinearGradient(cx - r * 0.6, cy - r, cx + r * 0.6, cy + r);
    bodyGrad.addColorStop(0, "#85859a"); bodyGrad.addColorStop(0.55, "#6a6a7d"); bodyGrad.addColorStop(1, "#4c4c5e");
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = "#23232e"; ctx.lineWidth = S(1.1); ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.75, cy - r * 0.7);
    ctx.lineTo(cx + r, cy - r * 0.1);
    ctx.lineTo(cx + r * 0.85, cy + r * 0.55);
    ctx.lineTo(cx + r * 0.4, cy + r * 0.95);
    ctx.lineTo(cx - r * 0.35, cy + r);
    ctx.lineTo(cx - r * 0.9, cy + r * 0.5);
    ctx.lineTo(cx - r, cy - r * 0.2);
    ctx.lineTo(cx - r * 0.65, cy - r * 0.8);
    ctx.closePath(); ctx.stroke(); ctx.fill();
    // Top highlight - lighter upper-left region
    ctx.fillStyle = "rgba(180,180,200,0.35)";
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.75, cy - r * 0.7);
    ctx.lineTo(cx + r * 0.3, cy - r * 0.1);
    ctx.lineTo(cx - r * 0.2, cy - r * 0.15);
    ctx.lineTo(cx - r * 0.65, cy - r * 0.8);
    ctx.closePath(); ctx.fill();
    // Bottom shadow - darker lower-right
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.85, cy + r * 0.55);
    ctx.lineTo(cx + r * 0.4, cy + r * 0.95);
    ctx.lineTo(cx - r * 0.35, cy + r);
    ctx.lineTo(cx - r * 0.9, cy + r * 0.5);
    ctx.lineTo(cx - r * 0.3, cy + r * 0.1);
    ctx.lineTo(cx + r * 0.5, cy + r * 0.1);
    ctx.closePath(); ctx.fill();
    // Crack lines
    ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = S(0.8); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx - r * 0.5, cy - r * 0.3); ctx.lineTo(cx + r * 0.1, cy + r * 0.15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + r * 0.2, cy - r * 0.4); ctx.lineTo(cx + r * 0.5, cy + r * 0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - r * 0.2, cy + r * 0.2); ctx.lineTo(cx + r * 0.15, cy + r * 0.6); ctx.stroke();
    // Specular highlights - small bright spots
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath(); ctx.arc(cx - r * 0.25, cy - r * 0.4, S(2.5), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath(); ctx.arc(cx + r * 0.35, cy - r * 0.25, S(1.5), 0, Math.PI * 2); ctx.fill();
    // Rim edge highlight
    ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = S(0.6);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.65, cy - r * 0.8);
    ctx.lineTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.75, cy - r * 0.7);
    ctx.stroke();
    if (rot) ctx.restore();
  }

  // ─── Minecart: oak tub on iron wheels. rogue = the red runaway kind ───
  // spin turns the wheels (radians); ore heaps the tub with nuggets
  function drawMinecart(px, py, o) {
    o = o || {};
    var now = Date.now() * 0.001, i;
    var wood = o.rogue ? "#8f2f2a" : "#7a5230", woodL = o.rogue ? "#b8463c" : "#9a6a3c", woodD = o.rogue ? "#5c1a17" : "#553620";
    var topY = py + S(11.5), botY = py + TILE - S(8.2), wy = py + TILE - S(5.4);
    // rail
    ctx.fillStyle = "#2a2d36"; ctx.fillRect(px, py + TILE - S(2.2), TILE + 1, S(1.6));
    ctx.fillStyle = "#6a7080"; ctx.fillRect(px, py + TILE - S(2.2), TILE + 1, S(0.6));
    // ore heap behind the rim
    if (o.ore && !o.rogue) {
      var nug = [[9, 12.4, 4.6, "#d4884a"], [16, 12.4, 6.6, "#e8b84b"], [22.6, 12.4, 5.0, "#f0d078"], [12.6, 12.4, 3.6, "#c8cdd8"]];
      for (i = 0; i < nug.length; i++) {
        var nx = px + S(nug[i][0]), ny = py + S(nug[i][1]), nh = S(nug[i][2]);
        ctx.fillStyle = "#3a2608";
        ctx.beginPath(); ctx.moveTo(nx - nh * 0.8 - S(0.6), ny); ctx.lineTo(nx - nh * 0.2, ny - nh - S(0.7)); ctx.lineTo(nx + nh * 0.9 + S(0.6), ny); ctx.closePath(); ctx.fill();
        ctx.fillStyle = nug[i][3];
        ctx.beginPath(); ctx.moveTo(nx - nh * 0.8, ny); ctx.lineTo(nx - nh * 0.2, ny - nh); ctx.lineTo(nx + nh * 0.9, ny); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath(); ctx.moveTo(nx - nh * 0.8, ny); ctx.lineTo(nx - nh * 0.2, ny - nh); ctx.lineTo(nx - nh * 0.05, ny); ctx.closePath(); ctx.fill();
      }
      var gl = ((Date.now() + px * 5) % 2600) / 2600;
      if (gl < 0.16) drawSparkle(px + S(17.4), py + S(6.6), S(3.2) * Math.sin(gl / 0.16 * Math.PI), "rgba(255,255,255,0.95)");
    }
    drawMinecartFront(px, py, o);
    if (o.rogue) {
      // sparks thrown off the rails
      for (i = 0; i < 3; i++) {
        var sp = (now * 3.2 + i * 0.37 + px * 0.01) % 1;
        ctx.fillStyle = "rgba(255," + Math.round(200 - sp * 90) + ",70," + (1 - sp) + ")";
        ctx.fillRect(px + S(i % 2 ? 6 : 24) - (o.dir || 1) * sp * S(7), py + TILE - S(2.6) - Math.sin(sp * Math.PI) * S(3.4), S(1.2), S(1.2));
      }
    }
  }

  // Tub and wheels only - drawn over the rider's legs when the miner is aboard
  function drawMinecartFront(px, py, o) {
    o = o || {};
    var now = Date.now() * 0.001, i;
    var wood = o.rogue ? "#8f2f2a" : "#7a5230", woodL = o.rogue ? "#b8463c" : "#9a6a3c", woodD = o.rogue ? "#5c1a17" : "#553620";
    var topY = py + S(11.5), botY = py + TILE - S(8.2), wy = py + TILE - S(5.4), spin = o.spin || 0;
    // tub: tapered, planked, iron-banded
    ctx.fillStyle = "#1c1108";
    ctx.beginPath(); ctx.moveTo(px + S(0.8), topY - S(0.8)); ctx.lineTo(px + TILE - S(0.8), topY - S(0.8)); ctx.lineTo(px + TILE - S(4.2), botY + S(0.8)); ctx.lineTo(px + S(4.2), botY + S(0.8)); ctx.closePath(); ctx.fill();
    var tg = ctx.createLinearGradient(0, topY, 0, botY);
    tg.addColorStop(0, woodL); tg.addColorStop(0.5, wood); tg.addColorStop(1, woodD);
    ctx.fillStyle = tg;
    ctx.beginPath(); ctx.moveTo(px + S(1.6), topY); ctx.lineTo(px + TILE - S(1.6), topY); ctx.lineTo(px + TILE - S(4.8), botY); ctx.lineTo(px + S(4.8), botY); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(px + S(2.6), topY + (botY - topY) * 0.36, TILE - S(5.2), S(0.7));
    ctx.fillRect(px + S(3.6), topY + (botY - topY) * 0.7, TILE - S(7.2), S(0.7));
    for (i = 0; i < 2; i++) {
      var bx = px + (i ? TILE - S(10.4) : S(8.0));
      ctx.fillStyle = "#2c2f38"; ctx.fillRect(bx, topY, S(2.4), botY - topY);
      ctx.fillStyle = "#757b8a"; ctx.fillRect(bx, topY, S(0.7), botY - topY);
      ctx.fillStyle = "#b4bac8";
      ctx.beginPath(); ctx.arc(bx + S(1.2), topY + S(4.2), S(0.6), 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(bx + S(1.2), botY - S(2.2), S(0.6), 0, Math.PI * 2); ctx.fill();
    }
    // rim
    ctx.fillStyle = "#1a1c22"; ctx.fillRect(px + S(0.4), topY - S(1.6), TILE - S(0.8), S(3.4));
    if (o.rogue) {
      ctx.save(); ctx.beginPath(); ctx.rect(px + S(1), topY - S(1.0), TILE - S(2), S(2.2)); ctx.clip();
      for (i = -1; i < 9; i++) {
        ctx.fillStyle = i % 2 ? "#1a1c22" : "#e8b84b";
        ctx.beginPath(); ctx.moveTo(px + i * S(4), topY + S(1.2)); ctx.lineTo(px + i * S(4) + S(4), topY - S(1.0)); ctx.lineTo(px + i * S(4) + S(8), topY - S(1.0)); ctx.lineTo(px + i * S(4) + S(4), topY + S(1.2)); ctx.fill();
      }
      ctx.restore();
      // a furnace-red slot glaring out of the tub
      var glare = Math.sin(now * 7) * 0.3 + 0.7;
      ctx.fillStyle = "rgba(255,60,40," + glare * 0.35 + ")"; ctx.fillRect(px + S(8.4), topY + S(3.2), TILE - S(16.8), S(6.2));
      ctx.fillStyle = "#1a0605"; ctx.fillRect(px + S(10.6), topY + S(4.4), TILE - S(21.2), S(3.6));
      ctx.fillStyle = "rgba(255," + Math.round(90 + glare * 80) + ",50," + glare + ")"; ctx.fillRect(px + S(11.4), topY + S(5.1), TILE - S(22.8), S(2.2));
    } else {
      ctx.fillStyle = "#4a4e5a"; ctx.fillRect(px + S(1), topY - S(1.0), TILE - S(2), S(2.2));
      ctx.fillStyle = "#8b92a2"; ctx.fillRect(px + S(1), topY - S(1.0), TILE - S(2), S(0.7));
    }
    // spoked wheels
    for (i = 0; i < 2; i++) {
      var wx = px + (i ? TILE - S(8.4) : S(8.4));
      ctx.fillStyle = "#101116"; ctx.beginPath(); ctx.arc(wx, wy, S(4.1), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#4a4e5a"; ctx.beginPath(); ctx.arc(wx, wy, S(3.2), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#23252d"; ctx.beginPath(); ctx.arc(wx, wy, S(2.3), 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#8b92a2"; ctx.lineWidth = S(0.8);
      for (var sp2 = 0; sp2 < 3; sp2++) {
        var a = spin + sp2 * Math.PI / 3;
        ctx.beginPath(); ctx.moveTo(wx - Math.cos(a) * S(2.8), wy - Math.sin(a) * S(2.8)); ctx.lineTo(wx + Math.cos(a) * S(2.8), wy + Math.sin(a) * S(2.8)); ctx.stroke();
      }
      ctx.fillStyle = "#c2c8d4"; ctx.beginPath(); ctx.arc(wx, wy, S(0.9), 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawCartBody(cpx, cpy, opts) {
    drawCaveBg(cpx, cpy);
    drawMinecart(cpx, cpy, opts || { ore: true });
  }

  // ─── Shaft lift: a caged platform riding its cable ───
  function drawShaftLift(lpx, lpy) {
    var now = Date.now() * 0.001, cx = lpx + TILE / 2, i;
    // guide rails and hoist cable
    ctx.fillStyle = "#2a2e3a"; ctx.fillRect(lpx + S(2.2), lpy - S(4), S(1.4), TILE + S(8)); ctx.fillRect(lpx + TILE - S(3.6), lpy - S(4), S(1.4), TILE + S(8));
    ctx.fillStyle = "#15171d"; ctx.fillRect(cx - S(1.1), lpy - TILE * 0.7, S(2.2), TILE * 0.7 + S(4));
    ctx.fillStyle = "#8b92a2"; ctx.fillRect(cx - S(0.5), lpy - TILE * 0.7, S(0.7), TILE * 0.7 + S(4));
    // cage
    var cl = lpx + S(4.4), cr = lpx + TILE - S(4.4), ct = lpy + S(4.2), cb = lpy + TILE - S(3.6);
    ctx.fillStyle = "rgba(10,12,18,0.72)"; ctx.fillRect(cl, ct, cr - cl, cb - ct);
    ctx.strokeStyle = "rgba(170,180,200,0.5)"; ctx.lineWidth = S(0.7);
    for (i = 1; i < 5; i++) { var mx = cl + (cr - cl) * i / 5; ctx.beginPath(); ctx.moveTo(mx, ct); ctx.lineTo(mx, cb); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cl, ct); ctx.lineTo(cr, cb); ctx.moveTo(cr, ct); ctx.lineTo(cl, cb); ctx.stroke();
    ctx.strokeStyle = "#15171d"; ctx.lineWidth = S(2.8); ctx.strokeRect(cl, ct, cr - cl, cb - ct);
    ctx.strokeStyle = "#8b93a6"; ctx.lineWidth = S(1.5); ctx.strokeRect(cl, ct, cr - cl, cb - ct);
    // hazard-striped roof and floor beams
    for (var b = 0; b < 2; b++) {
      var by = b ? cb - S(1.2) : ct - S(2.4);
      ctx.fillStyle = "#15171d"; ctx.fillRect(lpx + S(2.6), by - S(0.6), TILE - S(5.2), S(4.6));
      ctx.save(); ctx.beginPath(); ctx.rect(lpx + S(3.2), by, TILE - S(6.4), S(3.4)); ctx.clip();
      for (i = -1; i < 9; i++) {
        ctx.fillStyle = i % 2 ? "#1a1c22" : "#e8b84b";
        ctx.beginPath(); ctx.moveTo(lpx + i * S(4.4), by + S(3.4)); ctx.lineTo(lpx + i * S(4.4) + S(4.4), by); ctx.lineTo(lpx + i * S(4.4) + S(8.8), by); ctx.lineTo(lpx + i * S(4.4) + S(4.4), by + S(3.4)); ctx.fill();
      }
      ctx.restore();
    }
    // cable shackle and warning lamp
    ctx.fillStyle = "#4a4e5a"; ctx.fillRect(cx - S(2.4), ct - S(4.4), S(4.8), S(2.4));
    var blink = Math.sin(now * 6) > 0 ? 1 : 0.25;
    ctx.fillStyle = "rgba(255,70,50," + blink * 0.35 + ")"; ctx.beginPath(); ctx.arc(cl + S(2.4), ct + S(3.4), S(3.0), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,90,60," + blink + ")"; ctx.beginPath(); ctx.arc(cl + S(2.4), ct + S(3.4), S(1.2), 0, Math.PI * 2); ctx.fill();
  }

  // ─── Tools lying in the mine ───
  // pulse (0.4–1) makes lights and dials breathe; x and y vary the phase per cell

  // Rounded rectangle path (ctx.roundRect is missing in older Safari)
  function roundedRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  // A stick of dynamite. lit = true is the stick the miner has set down:
  // the fuse burns with a brighter, spitting spark.
  function drawDynamite(px, py, x, y, pp, pu, lit) {
    var dcx = px + TILE / 2, dcy = py + TILE / 2;
    ctx.save(); ctx.translate(dcx, dcy); ctx.rotate(-0.3);
    var bx = -S(4), by = -S(10), bw = S(8), bh = S(16), o = Math.max(1, S(0.9));
    // Fuse: dark cord with a lighter twist
    ctx.lineCap = "round";
    ctx.strokeStyle = "#2c211a"; ctx.lineWidth = S(2.6);
    ctx.beginPath(); ctx.moveTo(0, -S(9)); ctx.quadraticCurveTo(S(4), -S(13), S(2), -S(15)); ctx.stroke();
    ctx.strokeStyle = "#a58a72"; ctx.lineWidth = S(1.3);
    ctx.beginPath(); ctx.moveTo(0, -S(9)); ctx.quadraticCurveTo(S(4), -S(13), S(2), -S(15)); ctx.stroke();
    // Stick: dark outline, then a round body lit from the left
    ctx.fillStyle = "#4a0f0f"; roundedRect(bx - o, by - o, bw + o * 2, bh + o * 2, S(2)); ctx.fill();
    var body = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    body.addColorStop(0, "#e2524a"); body.addColorStop(0.4, "#cc3333"); body.addColorStop(1, "#8e1b1b");
    ctx.fillStyle = body; roundedRect(bx, by, bw, bh, S(1.4)); ctx.fill();
    // Crimped end caps
    ctx.fillStyle = "rgba(70,8,8,0.5)"; ctx.fillRect(bx, by, bw, S(2)); ctx.fillRect(bx, by + bh - S(2), bw, S(2));
    // Sheen down the lit side
    ctx.fillStyle = "rgba(255,255,255,0.26)"; ctx.fillRect(-S(2.4), -S(7.5), Math.max(1, S(1.3)), S(11));
    // Paper label band
    var band = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    band.addColorStop(0, "#f6d478"); band.addColorStop(0.45, "#e8b84b"); band.addColorStop(1, "#b98a2a");
    ctx.fillStyle = band; ctx.fillRect(bx, -S(2), bw, S(3.4));
    ctx.fillStyle = "#b02a2a"; ctx.fillRect(-S(3), -S(0.8), S(6), Math.max(1, S(1)));
    // Fuse spark: a warm bloom with a flickering star at its heart
    var flick = Math.sin(animFrame * 0.25) * 0.4 + 0.6, sx = S(2), sy = -S(15);
    var bloomR = S(lit ? 6.5 : 4);
    var bloom = ctx.createRadialGradient(sx, sy, 0, sx, sy, bloomR);
    bloom.addColorStop(0, "rgba(255,226,120," + (0.75 * flick).toFixed(3) + ")");
    bloom.addColorStop(0.45, "rgba(255,150,50," + (0.32 * flick).toFixed(3) + ")");
    bloom.addColorStop(1, "rgba(255,120,30,0)");
    ctx.fillStyle = bloom; ctx.beginPath(); ctx.arc(sx, sy, bloomR, 0, Math.PI * 2); ctx.fill();
    drawSparkle(sx, sy, S(lit ? 4.4 : 3) * (0.65 + 0.35 * flick), "rgba(255,250,220," + (0.6 + 0.4 * flick).toFixed(3) + ")");
    if (lit) {
      // sparks spitting from the burning fuse
      var now = Date.now();
      for (var k = 0; k < 4; k++) {
        var ph = ((now + k * 190 + (x * 53 + y * 31) * 17) % 520) / 520;
        var ang = -1.9 + k * 0.85 + Math.sin(k * 7.3 + Math.floor((now + k * 190) / 520)) * 0.5;
        var dist = S(2) + ph * S(7);
        ctx.fillStyle = "rgba(255," + Math.round(235 - ph * 90) + ",120," + (1 - ph).toFixed(3) + ")";
        var ps = Math.max(1, S(1.2) * (1 - ph * 0.5));
        ctx.fillRect(sx + Math.cos(ang) * dist - ps / 2, sy + Math.sin(ang) * dist + ph * ph * S(3) - ps / 2, ps, ps);
      }
    }
    ctx.restore();
  }

  function drawHelmetLamp(px, py, x, y, pp, pu) {
    // Helmet lamp / flashlight sprite
    var lcx = px + TILE / 2, lcy = py + TILE / 2;
    ctx.save(); ctx.translate(lcx, lcy); ctx.rotate(0.5);
    var o = Math.max(1, S(0.9));
    // Beam: a soft cone fading away from the lens
    var beamPulse = Math.sin(animFrame * 0.15) * 0.15 + 0.4;
    var beam = ctx.createLinearGradient(0, -S(10), 0, -S(18));
    beam.addColorStop(0, "rgba(255,244,160," + (beamPulse + 0.2).toFixed(3) + ")");
    beam.addColorStop(1, "rgba(255,240,140,0)");
    ctx.fillStyle = beam;
    ctx.beginPath(); ctx.moveTo(-S(3), -S(10)); ctx.lineTo(S(3), -S(10));
    ctx.lineTo(S(8), -S(18)); ctx.lineTo(-S(8), -S(18)); ctx.closePath(); ctx.fill();
    // Outline behind the whole torch
    ctx.fillStyle = "#1d1f26";
    roundedRect(-S(3) - o, -S(6) - o, S(6) + o * 2, S(12) + o * 2, S(1.6)); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-S(3) - o, -S(5)); ctx.lineTo(-S(5) - o, -S(11) - o); ctx.lineTo(S(5) + o, -S(11) - o); ctx.lineTo(S(3) + o, -S(5)); ctx.closePath(); ctx.fill();
    // Barrel: knurled steel, lit from the left
    var barrel = ctx.createLinearGradient(-S(3), 0, S(3), 0);
    barrel.addColorStop(0, "#8a8d96"); barrel.addColorStop(0.4, "#6a6c74"); barrel.addColorStop(1, "#45474e");
    ctx.fillStyle = barrel; roundedRect(-S(3), -S(6), S(6), S(12), S(1.2)); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.24)";
    for (var gi = 0; gi < 3; gi++) ctx.fillRect(-S(3), S(-2 + gi * 2.5), S(6), Math.max(1, S(0.8)));
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(-S(3), S(4), S(6), S(2));
    ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.fillRect(-S(1.8), -S(5), Math.max(1, S(1)), S(9));
    // Flared brass head
    var head = ctx.createLinearGradient(-S(5), 0, S(5), 0);
    head.addColorStop(0, "#f0c458"); head.addColorStop(0.45, "#d4a030"); head.addColorStop(1, "#96701c");
    ctx.fillStyle = head;
    ctx.beginPath(); ctx.moveTo(-S(3), -S(5.4)); ctx.lineTo(-S(5), -S(11)); ctx.lineTo(S(5), -S(11)); ctx.lineTo(S(3), -S(5.4)); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(90,60,10,0.45)"; ctx.fillRect(-S(3.4), -S(6.6), S(6.8), Math.max(1, S(1.2)));
    // Lens, glowing
    ctx.fillStyle = "#fffbe0";
    ctx.beginPath(); ctx.ellipse(0, -S(11), S(4.6), S(1.5), 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,236,150," + (0.35 + beamPulse * 0.5).toFixed(3) + ")";
    ctx.beginPath(); ctx.ellipse(0, -S(11.4), S(6), S(2.6), 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawGeigerCounter(px, py, x, y, pp, pu) {
    // Geiger counter sprite
    var gcx = px + TILE / 2, gcy = py + TILE / 2;
    ctx.save(); ctx.translate(gcx, gcy);
    var o = Math.max(1, S(0.9));
    // Probe on its stalk, behind the case
    ctx.lineCap = "round";
    ctx.strokeStyle = "#141c1c"; ctx.lineWidth = S(2.6);
    ctx.beginPath(); ctx.moveTo(S(3), -S(8)); ctx.lineTo(S(5), -S(13)); ctx.stroke();
    ctx.strokeStyle = "#7d8f8f"; ctx.lineWidth = S(1.3);
    ctx.beginPath(); ctx.moveTo(S(3), -S(8)); ctx.lineTo(S(5), -S(13)); ctx.stroke();
    var tipPulse = Math.sin(animFrame * 0.2) * 0.4 + 0.6;
    var tip = ctx.createRadialGradient(S(5), -S(13), 0, S(5), -S(13), S(4.5));
    tip.addColorStop(0, "rgba(74,232,212," + (0.7 * tipPulse).toFixed(3) + ")"); tip.addColorStop(1, "rgba(74,232,212,0)");
    ctx.fillStyle = tip; ctx.beginPath(); ctx.arc(S(5), -S(13), S(4.5), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#12201f"; ctx.beginPath(); ctx.arc(S(5), -S(13), S(2.2), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(110,245,226," + (0.55 + 0.45 * tipPulse).toFixed(3) + ")";
    ctx.beginPath(); ctx.arc(S(5), -S(13), S(1.5), 0, Math.PI * 2); ctx.fill();
    // Case: outlined, lit from above
    ctx.fillStyle = "#0e1616"; roundedRect(-S(6) - o, -S(8) - o, S(12) + o * 2, S(14) + o * 2, S(2.2)); ctx.fill();
    var gcase = ctx.createLinearGradient(0, -S(8), 0, S(6));
    gcase.addColorStop(0, "#3d5252"); gcase.addColorStop(0.5, "#2a3a3a"); gcase.addColorStop(1, "#1c2929");
    ctx.fillStyle = gcase; roundedRect(-S(6), -S(8), S(12), S(14), S(1.6)); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.14)"; ctx.fillRect(-S(5), -S(7.6), S(10), Math.max(1, S(0.9)));
    // Screen with pulsing bars
    ctx.fillStyle = "#061211"; ctx.fillRect(-S(4.5), -S(6), S(9), S(7));
    var geigerPulse = animFrame * 0.08;
    ctx.fillStyle = "#4ae8d4";
    for (var bi = 0; bi < 5; bi++) {
      var bh = (Math.sin(geigerPulse + bi * 1.2) * 0.5 + 0.5) * S(5);
      ctx.fillRect(-S(3.5) + bi * S(1.6), -S(6) + S(7) - bh, S(1.2), bh);
    }
    ctx.fillStyle = "rgba(74,232,212,0.10)"; ctx.fillRect(-S(4.5), -S(6), S(9), S(7));
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.beginPath(); ctx.moveTo(-S(4.5), -S(6)); ctx.lineTo(-S(0.5), -S(6)); ctx.lineTo(-S(4.5), -S(1.5)); ctx.closePath(); ctx.fill();
    // Dial and button
    ctx.fillStyle = "#15201f"; ctx.beginPath(); ctx.arc(-S(2.4), S(3.4), S(1.8), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#57807d"; ctx.beginPath(); ctx.arc(-S(2.4), S(3.2), S(1.3), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#3a1a1a"; ctx.beginPath(); ctx.arc(S(2.6), S(3.4), S(1.5), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(240,96,84," + (0.5 + 0.5 * tipPulse).toFixed(3) + ")"; ctx.beginPath(); ctx.arc(S(2.6), S(3.2), S(1), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawGasMask(px, py, x, y, pp, pu) {
    // Gas mask sprite - PROFILE view (facing left): one lens, snout
    // filter canister at the front, straps trailing back
    var mcx = px + TILE / 2, mcy = py + TILE / 2 - S(0.5);
    ctx.save(); ctx.translate(mcx, mcy);
    // Leather straps running back to the right, joined by a head band
    ctx.strokeStyle = "#8a7a55"; ctx.lineWidth = S(2.2); ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(S(2), -S(6)); ctx.quadraticCurveTo(S(8), -S(6.5), S(10.5), -S(4));
    ctx.moveTo(S(3), -S(0.5)); ctx.lineTo(S(11), -S(0.5));
    ctx.moveTo(S(2.5), S(4.5)); ctx.quadraticCurveTo(S(8), S(5.5), S(10.5), S(3.5));
    ctx.stroke();
    ctx.strokeStyle = "#6b5f42"; ctx.lineWidth = S(2.4);
    ctx.beginPath();
    ctx.moveTo(S(10.5), -S(5)); ctx.quadraticCurveTo(S(12), -S(0.5), S(10.5), S(4.5));
    ctx.stroke();
    // Buckle on the middle strap
    ctx.fillStyle = "#b8a86a"; ctx.fillRect(S(6.5), -S(1.6), S(2), S(2.2));
    // Rubber facepiece in profile: crown, brow, snout, chin, jawline
    ctx.fillStyle = "#616d54";
    ctx.beginPath();
    ctx.moveTo(S(3), -S(9));
    ctx.quadraticCurveTo(-S(4), -S(8.5), -S(6.5), -S(4));
    ctx.quadraticCurveTo(-S(7.5), -S(2), -S(7), S(0.5));
    ctx.lineTo(-S(6), S(3));
    ctx.quadraticCurveTo(-S(5), S(6.5), -S(1.5), S(7.5));
    ctx.quadraticCurveTo(S(2), S(8.5), S(4), S(6));
    ctx.quadraticCurveTo(S(5.5), S(2), S(5), -S(3));
    ctx.quadraticCurveTo(S(4.8), -S(8), S(3), -S(9));
    ctx.fill();
    ctx.strokeStyle = "#3f4636"; ctx.lineWidth = S(1.2); ctx.stroke();
    // Rubber sheen along the crown
    ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = S(1.4);
    ctx.beginPath();
    ctx.moveTo(S(2.5), -S(7.5)); ctx.quadraticCurveTo(-S(2.5), -S(7), -S(5), -S(3.5));
    ctx.stroke();
    // Single side lens: dull metal rim, dark glass, flat window streaks
    ctx.fillStyle = "#767e72";
    ctx.beginPath(); ctx.arc(-S(1.5), -S(2.5), S(3.6), 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#3f4636"; ctx.lineWidth = S(0.9); ctx.stroke();
    ctx.fillStyle = "#16222b";
    ctx.beginPath(); ctx.arc(-S(1.5), -S(2.5), S(2.6), 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(-S(1.5), -S(2.5), S(2.6), 0, Math.PI * 2); ctx.clip();
    ctx.strokeStyle = "rgba(150,220,240,0.55)"; ctx.lineWidth = S(0.8);
    ctx.beginPath();
    ctx.moveTo(-S(4.5), -S(1.5)); ctx.lineTo(-S(0.5), -S(5.5));
    ctx.moveTo(-S(3.8), -S(0.2)); ctx.lineTo(S(0.5), -S(4.5));
    ctx.stroke();
    ctx.restore();
    // Threaded connector from the mouth to the filter
    ctx.strokeStyle = "#3f4636"; ctx.lineWidth = S(2.8); ctx.lineCap = "butt";
    ctx.beginPath(); ctx.moveTo(-S(5.5), S(3)); ctx.lineTo(-S(7.5), S(4.5)); ctx.stroke();
    // Snout filter canister sticking forward-down from the mouth
    ctx.save(); ctx.translate(-S(9), S(5.5)); ctx.rotate(0.4);
    ctx.fillStyle = "#83885a";
    ctx.fillRect(-S(4), -S(2.6), S(7), S(5.2));
    ctx.strokeStyle = "#565b39"; ctx.lineWidth = S(1);
    ctx.strokeRect(-S(4), -S(2.6), S(7), S(5.2));
    // Ribs across the drum
    ctx.strokeStyle = "#6d724c"; ctx.lineWidth = S(0.8);
    ctx.beginPath();
    ctx.moveTo(-S(2.5), -S(2.6)); ctx.lineTo(-S(2.5), S(2.6));
    ctx.moveTo(-S(1), -S(2.6)); ctx.lineTo(-S(1), S(2.6));
    ctx.moveTo(S(0.5), -S(2.6)); ctx.lineTo(S(0.5), S(2.6));
    ctx.stroke();
    // Dark intake cap on the front face
    ctx.fillStyle = "#3f432c";
    ctx.fillRect(-S(4.8), -S(2), S(1.4), S(4));
    ctx.restore();
    ctx.restore();
  }

  // Water pump: the tool lying in the mine and the machine the miner sets
  // down are the same drawing. state "run" = pumping hard (water gushing from
  // the outlet), "off" = finished and still; left out = the idle tool.
  function drawWaterPump(px, py, x, y, pp, pu, state) {
    var run = state === "run", off = state === "off";
    var wpx = px + TILE / 2, wpy = py + TILE / 2;
    ctx.save(); ctx.translate(wpx, wpy);
    // Outlet pipe: riser + elbow to the right
    ctx.fillStyle = "#7c8ba2";
    ctx.fillRect(S(2), -S(11), S(4), S(9));
    ctx.fillRect(S(2), -S(11), S(9), S(4));
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(S(2.8), -S(10.2), S(1.2), S(8));
    ctx.fillRect(S(2.8), -S(10.2), S(7.5), S(1));
    ctx.fillStyle = "#525e70"; ctx.fillRect(S(9.5), -S(11.8), S(1.8), S(5.4));
    if (run) {
      // Water gushing from the outlet in a broken stream
      ctx.fillStyle = "rgba(120,195,255,0.75)";
      ctx.fillRect(S(11.4), -S(10.6), S(2.6), S(3));
      for (var wd = 0; wd < 4; wd++) {
        var wf = (animFrame * 0.09 + wd * 0.25) % 1;
        ctx.fillStyle = "rgba(150,212,255," + (0.95 - wf * 0.7).toFixed(2) + ")";
        ctx.beginPath(); ctx.ellipse(S(12.7) + Math.sin(wd * 2.1) * S(0.6), -S(8) + wf * wf * S(15), S(1.3), S(1.3 + wf * 1.2), 0, 0, Math.PI * 2); ctx.fill();
      }
    } else if (!off) {
      // Droplet falling from the outlet
      var wDrip = (animFrame * 0.045 + (x * 7 + y * 3) * 0.13) % 1;
      ctx.fillStyle = "rgba(140,205,255," + (0.9 - wDrip * 0.6).toFixed(2) + ")";
      ctx.beginPath(); ctx.arc(S(12.6), -S(8.5) + wDrip * S(12), S(1.3), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(140,205,255,0.55)";
      ctx.fillRect(S(11.6), -S(9.3), S(2), S(1.8));
    }
    // Main body
    var wpGrad = ctx.createLinearGradient(0, -S(3), 0, S(8));
    wpGrad.addColorStop(0, "#66738a"); wpGrad.addColorStop(1, "#414a5c");
    ctx.fillStyle = wpGrad; ctx.fillRect(-S(9), -S(3), S(17), S(11));
    ctx.strokeStyle = "#20242e"; ctx.lineWidth = S(1); ctx.strokeRect(-S(9), -S(3), S(17), S(11));
    // Sight glass with sloshing water
    ctx.fillStyle = "#0c1420"; ctx.fillRect(-S(7), -S(1), S(7.5), S(7.5));
    var wSlosh = off ? S(2.6) : Math.sin(animFrame * (run ? 0.32 : 0.1) + x * 2) * S(run ? 1.3 : 0.8);
    ctx.fillStyle = "#5ab4ff"; ctx.fillRect(-S(7), S(2.2) + wSlosh, S(7.5), S(4.3) - wSlosh);
    ctx.fillStyle = "rgba(190,230,255,0.7)"; ctx.fillRect(-S(7), S(2.2) + wSlosh, S(7.5), S(1));
    ctx.strokeStyle = "#9aa6b8"; ctx.lineWidth = S(1);
    ctx.strokeRect(-S(7), -S(1), S(7.5), S(7.5));
    // Pressure gauge with twitching needle
    ctx.fillStyle = "#e8ecf2";
    ctx.beginPath(); ctx.arc(S(4), S(1.5), S(2.7), 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#20242e"; ctx.lineWidth = S(0.8); ctx.stroke();
    var wNeedle = off ? -2.9 : run ? -0.9 + Math.sin(animFrame * 0.6 + x) * 0.25 : -2.2 + Math.sin(animFrame * 0.15 + x) * 0.5;
    ctx.strokeStyle = "#c33"; ctx.lineWidth = S(0.9);
    ctx.beginPath(); ctx.moveTo(S(4), S(1.5));
    ctx.lineTo(S(4) + Math.cos(wNeedle) * S(2), S(1.5) + Math.sin(wNeedle) * S(2)); ctx.stroke();
    // Base skids
    ctx.fillStyle = "#1a1e28"; ctx.fillRect(-S(10), S(8), S(19), S(2.2));
    ctx.restore();
  }

  var TOOL_SPRITES = [drawDynamite, drawHelmetLamp, drawGeigerCounter, drawGasMask, drawWaterPump];   // indexed by PU.*

  // The tool of the given type on a soft glow of its colour; an unknown type falls back to its icon
  function drawTool(type, px, py, x, y) {
    var pu = PU_INFO[type]; if (!pu) return;
    var pp = Math.sin(animFrame * .12 + x * 2 + y) * .3 + .7;
    var glow = ctx.createRadialGradient(px + TILE / 2, py + TILE / 2, S(2), px + TILE / 2, py + TILE / 2, S(16));
    glow.addColorStop(0, "rgba(" + hexRgb(pu.color) + "," + pp * .34 + ")");
    glow.addColorStop(1, "rgba(" + hexRgb(pu.color) + ",0)");
    ctx.fillStyle = glow; ctx.fillRect(px, py, TILE, TILE);
    if (TOOL_SPRITES[type]) TOOL_SPRITES[type](px, py, x, y, pp, pu);
    else {
      ctx.fillStyle = "rgba(" + hexRgb(pu.color) + ",0.8)"; ctx.beginPath(); ctx.arc(px + TILE / 2, py + TILE / 2, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.beginPath(); ctx.arc(px + TILE / 2 - 2, py + TILE / 2 - 2, 6, 0, Math.PI * 2); ctx.fill();
      ctx.font = S(14) + "px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(pu.icon, px + TILE / 2, py + TILE / 2 + 1); ctx.textBaseline = "alphabetic";
    }
  }

  // ─── Shared with the other render files ───
  gfx.drawLiquid = drawLiquid; gfx.drawDoor = drawDoor; gfx.drawLogicDoor = drawLogicDoor;
  gfx.drawKey = drawKey; gfx.drawExit = drawExit; gfx.drawToxicWaste = drawToxicWaste;
  gfx.drawRollingBarrel = drawRollingBarrel; gfx.drawBoulder = drawBoulder;
  gfx.drawBoulderBody = drawBoulderBody; gfx.drawMinecart = drawMinecart;
  gfx.drawMinecartFront = drawMinecartFront; gfx.drawCartBody = drawCartBody;
  gfx.drawShaftLift = drawShaftLift;
  gfx.drawTool = drawTool; gfx.drawDynamite = drawDynamite; gfx.drawWaterPump = drawWaterPump;
})();
