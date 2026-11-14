"use strict";

// ═══════════════════════════════════════════════════════════════════
// render-core.js - shared drawing state and helpers: the cave background, pre-rendered
// terrain tiles, sparkles, and the rules for what counts as buried or open
// ═══════════════════════════════════════════════════════════════════

(function() {
  var s = Game.state;

  // Game.gfx is what the render-*.js files share. render.js calls begin() at
  // the start of every frame (and when drawing a menu icon into another
  // canvas); each file registers a bind() callback that copies the context
  // into its own local variables, so sprite code can simply use ctx and TILE.
  /** @type {Record<string, any>} */
  var gfx = Game.gfx = {
    ctx: null, tile: 32, animFrame: 0,
    parallax: false,          // draw the cave picture behind open cells (off for remembered, fogged cells)
    bgX: 0, bgY: 0,           // parallax offset of that picture, in pixels
    cellX: 0, cellY: 0,       // grid cell currently being drawn (picks terrain variants)
    _binders: [],
    bind: function(fn) { gfx._binders.push(fn); },
    begin: function(context, tile, frame) {
      gfx.ctx = context; gfx.tile = tile; gfx.animFrame = frame;
      for (var i = 0; i < gfx._binders.length; i++) gfx._binders[i]();
    }
  };

  var ctx, TILE, animFrame;
  gfx.bind(function() { ctx = gfx.ctx; TILE = gfx.tile; animFrame = gfx.animFrame; });

  // ─── Parallax background ───
  var bgImg = new Image();
  bgImg.src = "Background1.webp";
  var bgReady = false;
  bgImg.onload = function() { bgReady = true; };

  function drawCaveBg(px, py) {
    if (gfx.parallax && bgReady) {
      var bw = bgImg.width, bh = bgImg.height;
      var ox = gfx.bgX;
      var oy = gfx.bgY;
      var sx = (((px + ox) % bw) + bw) % bw;
      var sy = (((py + oy) % bh) + bh) % bh;
      var dw = Math.min(TILE, bw - sx);
      var dh = Math.min(TILE, bh - sy);
      ctx.drawImage(bgImg, sx, sy, dw, dh, px, py, dw, dh);
      if (dw < TILE) ctx.drawImage(bgImg, 0, sy, TILE - dw, dh, px + dw, py, TILE - dw, dh);
      if (dh < TILE) ctx.drawImage(bgImg, sx, 0, dw, TILE - dh, px, py + dh, dw, TILE - dh);
      if (dw < TILE && dh < TILE) ctx.drawImage(bgImg, 0, 0, TILE - dw, TILE - dh, px + dw, py + dh, TILE - dw, TILE - dh);
    } else {
      ctx.fillStyle = "#0e0e16"; ctx.fillRect(px, py, TILE, TILE);
    }
  }


  // ─── Sprite: Earth ───
  // ─── Pre-rendered terrain (earth, walls, rock) ───
  // Each kind is painted once per tile size into a few offscreen variants and
  // then blitted, so the detail costs nothing per frame. Variants are picked
  // by grid position, which keeps the texture fixed to the world while the
  // camera scrolls. Canvases are 1px oversize so neighbours overlap and no
  // hairline seams show at sub-pixel camera offsets.
  var terrain = { size: 0, earth: [], rich: [], wall: [], rock: [], ice: [], basalt: [] };

  function terrainRng(seed) {
    return function() {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function paintEarth(g, u, R, rich) {
    var W = 32 * u + 1;
    g.fillStyle = rich ? "#4f3116" : "#60401f";
    g.fillRect(0, 0, W, W);
    // soft mottling: darker damp patches and lighter dry ones
    for (var i = 0; i < 11; i++) {
      g.fillStyle = i % 3 === 0 ? "rgba(255,205,140,0.07)" : "rgba(20,10,0,0.11)";
      g.beginPath(); g.ellipse(R() * 32 * u, R() * 32 * u, (4 + R() * 6) * u, (3 + R() * 4) * u, R() * 3, 0, Math.PI * 2); g.fill();
    }
    // short sediment streaks
    g.lineCap = "round";
    for (var k = 0; k < 5; k++) {
      var sx = R() * 26 * u, sy = (2 + R() * 28) * u, sl = (3 + R() * 6) * u;
      g.strokeStyle = k % 2 ? "rgba(30,15,4,0.22)" : "rgba(200,150,95,0.10)"; g.lineWidth = Math.max(1, 0.8 * u);
      g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx + sl / 2, sy + (R() - 0.5) * 2 * u, sx + sl, sy + (R() - 0.5) * 1.5 * u); g.stroke();
    }
    // grain
    for (var n = 0; n < 54; n++) {
      g.fillStyle = n % 3 === 0 ? "rgba(205,155,100,0.14)" : "rgba(35,18,6,0.28)";
      var gs = Math.max(1, (0.6 + R() * 0.7) * u);
      g.fillRect(R() * 32 * u, R() * 32 * u, gs, gs);
    }
    // embedded pebbles
    var pebbles = Math.floor(R() * 2.5);
    for (var pi = 0; pi < pebbles; pi++) {
      var bx = (4 + R() * 24) * u, by = (4 + R() * 24) * u, rx = (1.4 + R() * 1.8) * u, ry = rx * (0.6 + R() * 0.25), rot = R() * 3;
      g.fillStyle = "rgba(20,10,2,0.45)";
      g.beginPath(); g.ellipse(bx + 0.4 * u, by + 0.6 * u, rx * 1.1, ry * 1.1, rot, 0, Math.PI * 2); g.fill();
      g.fillStyle = rich ? "#6c5843" : "#7c6a55";
      g.beginPath(); g.ellipse(bx, by, rx, ry, rot, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(255,245,225,0.16)";
      g.beginPath(); g.ellipse(bx - rx * 0.25, by - ry * 0.3, rx * 0.45, ry * 0.35, rot, 0, Math.PI * 2); g.fill();
    }
    if (rich) {
      // ore flecks: the tell-tale glitter of mineral-rich ground
      var flecks = 4 + Math.floor(R() * 3);
      for (var fi = 0; fi < flecks; fi++) {
        var fx = (3 + R() * 26) * u, fy = (3 + R() * 26) * u, fr = (1.0 + R() * 0.9) * u;
        g.fillStyle = "rgba(232,184,75,0.16)";
        g.beginPath(); g.arc(fx, fy, fr * 2.4, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#e3b24a";
        g.beginPath(); g.moveTo(fx, fy - fr); g.lineTo(fx + fr * 0.8, fy); g.lineTo(fx, fy + fr); g.lineTo(fx - fr * 0.8, fy); g.closePath(); g.fill();
        g.fillStyle = "rgba(255,250,220,0.8)";
        g.fillRect(fx - 0.3 * u, fy - fr * 0.6, Math.max(1, 0.5 * u), Math.max(1, 0.5 * u));
      }
    }
  }

  function paintWall(g, u, R) {
    var W = 32 * u + 1;
    g.fillStyle = "#10101c"; g.fillRect(0, 0, W, W);   // mortar
    var gap = 0.8 * u;
    // two staggered courses; the half-bricks on the second course continue
    // into the neighbouring tile, so they stay unvaried to remain seamless
    var bricks = /** @type {[number, number, number, number, boolean][]} */ ([
      [0, 0, 16, 16, true], [16, 0, 16, 16, true],
      [-8, 16, 16, 16, false], [8, 16, 16, 16, true], [24, 16, 16, 16, false]
    ]);
    for (var i = 0; i < bricks.length; i++) {
      var b = bricks[i], x0 = b[0] * u + gap, y0 = b[1] * u + gap, w = b[2] * u - gap * 2, h = b[3] * u - gap * 2;
      var j = b[4] ? Math.round((R() - 0.5) * 14) : 0;
      g.fillStyle = "rgb(" + (40 + j) + "," + (40 + j) + "," + (70 + j) + ")";
      g.fillRect(x0, y0, w, h);
      if (b[4]) {
        // worn patches and pitting
        for (var k = 0; k < 3; k++) {
          g.fillStyle = k % 2 ? "rgba(255,255,255,0.035)" : "rgba(0,0,10,0.10)";
          g.beginPath(); g.ellipse(x0 + R() * w, y0 + R() * h, (2 + R() * 3) * u, (1.5 + R() * 2) * u, R() * 3, 0, Math.PI * 2); g.fill();
        }
        g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
        for (var n = 0; n < 9; n++) {
          g.fillStyle = n % 2 ? "rgba(170,175,220,0.14)" : "rgba(5,5,15,0.30)";
          var ps = Math.max(1, 0.7 * u);
          g.fillRect(x0 + R() * w, y0 + R() * h, ps, ps);
        }
        if (R() < 0.4) {
          // hairline crack
          var cx0 = x0 + (0.2 + R() * 0.6) * w;
          g.strokeStyle = "rgba(5,5,15,0.5)"; g.lineWidth = Math.max(1, 0.6 * u);
          g.beginPath(); g.moveTo(cx0, y0); g.lineTo(cx0 + (R() - 0.5) * 3 * u, y0 + h * 0.45); g.lineTo(cx0 + (R() - 0.5) * 5 * u, y0 + h); g.stroke();
        }
        g.restore();
      }
      // bevel: light from the upper left
      g.fillStyle = "rgba(190,195,255,0.13)"; g.fillRect(x0, y0, w, Math.max(1, 1.0 * u));
      g.fillStyle = "rgba(190,195,255,0.07)"; g.fillRect(x0, y0, Math.max(1, 0.9 * u), h);
      g.fillStyle = "rgba(0,0,8,0.30)"; g.fillRect(x0, y0 + h - Math.max(1, 1.3 * u), w, Math.max(1, 1.3 * u));
      g.fillStyle = "rgba(0,0,8,0.18)"; g.fillRect(x0 + w - Math.max(1, 1.0 * u), y0, Math.max(1, 1.0 * u), h);
    }
  }

  function paintRock(g, u, R) {
    var W = 32 * u + 1;
    // the joint between blocks is a shade darker than the stone, not a black
    // line, so a rock face reads as one mass rather than a grid
    g.fillStyle = "#3b3b4a"; g.fillRect(0, 0, W, W);
    var m = 0.7 * u, w = 32 * u - m * 2;
    var grad = g.createLinearGradient(0, 0, 32 * u, 32 * u);
    grad.addColorStop(0, "#74748a"); grad.addColorStop(0.5, "#5e5e72"); grad.addColorStop(1, "#484859");
    g.fillStyle = grad; g.fillRect(m, m, w, w);
    g.save(); g.beginPath(); g.rect(m, m, w, w); g.clip();
    // mineral blotches and speckle, like coarse granite
    for (var i = 0; i < 7; i++) {
      g.fillStyle = i % 2 ? "rgba(255,255,255,0.05)" : "rgba(0,0,10,0.12)";
      g.beginPath(); g.ellipse(R() * 32 * u, R() * 32 * u, (3 + R() * 5) * u, (2 + R() * 3) * u, R() * 3, 0, Math.PI * 2); g.fill();
    }
    for (var n = 0; n < 46; n++) {
      g.fillStyle = n % 3 === 0 ? "rgba(225,225,245,0.30)" : n % 3 === 1 ? "rgba(15,15,25,0.38)" : "rgba(150,120,110,0.25)";
      var ps = Math.max(1, (0.6 + R() * 0.6) * u);
      g.fillRect(R() * 32 * u, R() * 32 * u, ps, ps);
    }
    // at most one hairline fracture per block, so a wall of rock stays calm
    var style = Math.floor(R() * 4);   // 0,1: one diagonal fracture · 2: chipped corner · 3: unmarked
    function fracture(x0, y0, x1, y1) {
      var pts = [[x0, y0]];
      for (var k = 1; k < 4; k++) pts.push([x0 + (x1 - x0) * k / 4 + (R() - 0.5) * 2.2, y0 + (y1 - y0) * k / 4 + (R() - 0.5) * 2.2]);
      pts.push([x1, y1]);
      for (var pass = 0; pass < 2; pass++) {
        g.strokeStyle = pass ? "rgba(12,12,20,0.48)" : "rgba(235,235,255,0.11)";
        g.lineWidth = Math.max(1, (pass ? 0.8 : 0.7) * u); g.lineJoin = "round"; g.lineCap = "round";
        g.beginPath();
        for (var q = 0; q < pts.length; q++) {
          var qx = pts[q][0] * u + (pass ? 0 : 0.8 * u), qy = pts[q][1] * u + (pass ? 0 : 0.8 * u);
          if (q === 0) g.moveTo(qx, qy); else g.lineTo(qx, qy);
        }
        g.stroke();
      }
    }
    if (style === 0) fracture(7 + R() * 3, 6 + R() * 3, 22 + R() * 4, 25 + R() * 2);
    else if (style === 1) fracture(25 - R() * 3, 6 + R() * 3, 9 + R() * 4, 24 + R() * 3);
    else if (style === 2) fracture(20 + R() * 3, 3, 29, 12 + R() * 3);
    g.restore();
    // chiselled bevel
    g.fillStyle = "rgba(225,225,255,0.14)"; g.fillRect(m, m, w, Math.max(1, 1.5 * u));
    g.fillStyle = "rgba(225,225,255,0.08)"; g.fillRect(m, m, Math.max(1, 1.5 * u), w);
    g.fillStyle = "rgba(0,0,10,0.24)"; g.fillRect(m, m + w - Math.max(1, 1.8 * u), w, Math.max(1, 1.8 * u));
    g.fillStyle = "rgba(0,0,10,0.16)"; g.fillRect(m + w - Math.max(1, 1.6 * u), m, Math.max(1, 1.6 * u), w);
  }

  function paintIce(g, u, R) {
    var W = 32 * u + 1, i;
    var grad = g.createLinearGradient(0, 0, 32 * u, 32 * u);
    grad.addColorStop(0, "#c8eefc"); grad.addColorStop(0.5, "#8fd0f0"); grad.addColorStop(1, "#5aa4d6");
    g.fillStyle = grad; g.fillRect(0, 0, W, W);
    // internal facets catching the light at different angles
    for (i = 0; i < 6; i++) {
      var ax = R() * 32 * u, ay = R() * 32 * u;
      g.fillStyle = i % 2 ? "rgba(255,255,255,0.20)" : "rgba(30,90,150,0.16)";
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + (4 + R() * 12) * u, ay + (R() - 0.5) * 10 * u); g.lineTo(ax + (R() - 0.3) * 10 * u, ay + (5 + R() * 11) * u); g.closePath(); g.fill();
    }
    // trapped frost bubbles
    for (i = 0; i < 16; i++) {
      g.fillStyle = "rgba(255,255,255," + (0.25 + R() * 0.4) + ")";
      g.beginPath(); g.arc(R() * 32 * u, R() * 32 * u, (0.3 + R() * 0.6) * u, 0, Math.PI * 2); g.fill();
    }
    // fracture lines
    g.lineCap = "round"; g.lineJoin = "round";
    for (i = 0; i < 2; i++) {
      var fx = (4 + R() * 24) * u, fy = (2 + R() * 8) * u;
      g.strokeStyle = "rgba(255,255,255,0.7)"; g.lineWidth = Math.max(1, 0.7 * u);
      g.beginPath(); g.moveTo(fx, fy);
      for (var k = 0; k < 3; k++) { fx += (R() - 0.5) * 12 * u; fy += (4 + R() * 6) * u; g.lineTo(fx, fy); }
      g.stroke();
    }
    // glossy highlight and a frozen bevel
    g.fillStyle = "rgba(255,255,255,0.42)";
    g.beginPath(); g.moveTo(3 * u, 4 * u); g.lineTo(12 * u, 3 * u); g.lineTo(5 * u, 11 * u); g.closePath(); g.fill();
    g.fillStyle = "rgba(255,255,255,0.55)"; g.fillRect(0, 0, W, Math.max(1, 1.3 * u)); g.fillRect(0, 0, Math.max(1, 1.1 * u), W);
    g.fillStyle = "rgba(20,70,130,0.42)"; g.fillRect(0, 32 * u - 1.5 * u, W, 1.5 * u + 1); g.fillRect(32 * u - 1.3 * u, 0, 1.3 * u + 1, W);
  }

  function paintBasalt(g, u, R) {
    var W = 32 * u + 1, x0 = 0, i;
    g.fillStyle = "#16171d"; g.fillRect(0, 0, W, W);
    // columnar jointing: the tall many-sided pillars basalt cools into
    var widths = [7 + R() * 2, 8 + R() * 2, 7 + R() * 2];
    widths.push(32 - widths[0] - widths[1] - widths[2]);
    for (i = 0; i < 4; i++) {
      var w = widths[i] * u, cap = (3 + R() * 4) * u;
      var cg = g.createLinearGradient(x0, 0, x0 + w, 0);
      cg.addColorStop(0, "#565868"); cg.addColorStop(0.35, "#454755"); cg.addColorStop(1, "#2b2c36");
      g.fillStyle = cg; g.fillRect(x0 + 0.6 * u, 0, w - 1.2 * u, W);
      // faceted top of the column
      g.fillStyle = "#6b6e80";
      g.beginPath(); g.moveTo(x0 + 0.6 * u, cap); g.lineTo(x0 + w * 0.5, cap - 2.2 * u); g.lineTo(x0 + w - 0.6 * u, cap); g.lineTo(x0 + w - 0.6 * u, 0); g.lineTo(x0 + 0.6 * u, 0); g.closePath(); g.fill();
      g.fillStyle = "rgba(0,0,0,0.3)"; g.fillRect(x0 + 0.6 * u, cap, w - 1.2 * u, Math.max(1, 0.8 * u));
      // cross joints
      g.fillStyle = "rgba(10,10,16,0.5)";
      g.fillRect(x0 + 0.6 * u, (13 + R() * 6) * u, w - 1.2 * u, Math.max(1, 0.7 * u));
      if (R() < 0.6) g.fillRect(x0 + 0.6 * u, (23 + R() * 5) * u, w - 1.2 * u, Math.max(1, 0.7 * u));
      for (var n = 0; n < 6; n++) {
        g.fillStyle = n % 2 ? "rgba(200,205,230,0.16)" : "rgba(0,0,0,0.3)";
        var ps = Math.max(1, 0.7 * u); g.fillRect(x0 + (1 + R() * (widths[i] - 2)) * u, R() * 32 * u, ps, ps);
      }
      x0 += w;
    }
  }

  function ensureTerrain() {
    if (terrain.size === TILE) return;
    terrain.size = TILE;
    var u = TILE / 32;
    function build(count, seed, paint, arg) {
      var out = [];
      for (var i = 0; i < count; i++) {
        var c = document.createElement("canvas");
        c.width = c.height = TILE + 1;
        paint(c.getContext("2d"), u, terrainRng(seed + i * 7919), arg);
        out.push(c);
      }
      return out;
    }
    terrain.earth = build(8, 101, paintEarth, false);
    terrain.rich = build(6, 202, paintEarth, true);
    terrain.wall = build(4, 303, paintWall);
    terrain.rock = build(4, 404, paintRock);
    terrain.ice = build(4, 505, paintIce);
    terrain.basalt = build(4, 606, paintBasalt);
  }

  function drawTerrain(kind, px, py) {
    ensureTerrain();
    var set = terrain[kind];
    var h = (Math.imul(gfx.cellX, 73856093) ^ Math.imul(gfx.cellY, 19349663)) >>> 0;
    ctx.drawImage(set[h % set.length], px, py);
  }

  // Stable pseudo-random value in [0,1) for a grid cell (n picks the stream)
  function cellRand(x, y, n) {
    var h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(n + 1, 83492791)) >>> 0;
    return (h % 10007) / 10007;
  }

  // Four-point star (a glint): two crossed slivers with a hot centre
  function drawSparkle(x, y, r, color) {
    if (r <= 0.2) return;
    var w = r * 0.22;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + w, y - w); ctx.lineTo(x + r, y); ctx.lineTo(x + w, y + w);
    ctx.lineTo(x, y + r); ctx.lineTo(x - w, y + w); ctx.lineTo(x - r, y); ctx.lineTo(x - w, y - w);
    ctx.closePath(); ctx.fill();
  }

  // ─── Sprite: Earth ───
  function drawEarth(px, py, rich) {
    drawTerrain(rich ? "rich" : "earth", px, py);
  }

  // Tiles that read as solid ground/masonry for edge shading
  var SOLID_TILE = {};
  [T.EARTH, T.EARTH_RICH, T.ROCK, T.WALL, T.HIDDEN_ELEM, T.WATER_SRC, T.LAVA_SRC, T.BASALT, T.ICE,
   T.SPIDER_NEST, T.DOOR, T.LOGIC_DOOR, T.GAS_SRC, T.REFUGE_POST].forEach(function(t) { SOLID_TILE[t] = true; });

  // Boulders, elements and power-ups sit *in* the ground until they are dug
  // out. A cell counts as buried while it has never been seen open and is
  // still hemmed in by solid ground on at least three sides.
  var EMBED_TILE = {};
  [T.BOULDER, T.ELEMENT, T.POWERUP, T.KEY, T.HAZARD, T.ROLL_BARREL].forEach(function(t) { EMBED_TILE[t] = true; });
  var OPEN_TILE = {};
  [T.EMPTY, T.PLAYER, T.WATER, T.LAVA, T.GAS, T.WEB, T.EXIT, T.REFUGE].forEach(function(t) { OPEN_TILE[t] = true; });
  var openCells = {}, openCellsFor = null;

  // Called once per visible cell each frame. `explored` identifies the level:
  // a new array means a new level, so the record of dug-out cells starts again.
  function noteOpenCell(explored, tile, x, y, cols) {
    if (openCellsFor !== explored) { openCellsFor = explored; openCells = {}; }
    if (OPEN_TILE[tile]) openCells[y * cols + x] = 1;
  }

  function isBuried(x, y) {
    var key = y * s.cols + x;
    if (openCells[key]) return false;
    var g = s.grid, n = 0, solid = 0;
    // neighbouring objects count as packing, but at least two sides must be
    // real ground - a row of items on a cave floor is not buried
    function tally(cx, cy) {
      var row = g[cy]; var t = row ? row[cx] : undefined;
      if (t === undefined || SOLID_TILE[t]) { n++; solid++; } else if (EMBED_TILE[t]) n++;
    }
    tally(x, y - 1); tally(x, y + 1); tally(x - 1, y); tally(x + 1, y);
    if (n >= 3 && solid >= 2) return true;
    openCells[key] = 1;   // dug out - stays open from now on
    return false;
  }

  // Background for an object's cell: packed earth while buried, cave once open
  function drawBackdrop(px, py, x, y) {
    if (isBuried(x, y)) drawEarth(px, py, false); else drawCaveBg(px, py);
  }

  // Depth cues where rock meets open cave: open cells are shaded along every
  // solid neighbour (the tunnel reads as carved out), solid cells get a lit
  // upper lip and a dark underside where they face open space
  function shadeTileEdges(px, py, x, y, tile) {
    var g = s.grid;
    function solidAt(cx, cy) {
      var row = g[cy]; if (!row || row[cx] === undefined) return true;
      return !!SOLID_TILE[row[cx]] || (!!EMBED_TILE[row[cx]] && isBuried(cx, cy));
    }
    var up = solidAt(x, y - 1), down = solidAt(x, y + 1), left = solidAt(x - 1, y), right = solidAt(x + 1, y);
    var a = S(2.2), i;
    var selfSolid = !!SOLID_TILE[tile] || (!!EMBED_TILE[tile] && isBuried(x, y));
    if (!selfSolid) {
      var fall = [0.30, 0.17, 0.07];
      for (i = 0; i < 3; i++) {
        if (up)    { ctx.fillStyle = "rgba(2,3,8," + fall[i] + ")";        ctx.fillRect(px, py + i * a, TILE, a); }
        if (down)  { ctx.fillStyle = "rgba(2,3,8," + fall[i] * 0.7 + ")";  ctx.fillRect(px, py + TILE - (i + 1) * a, TILE, a); }
        if (left)  { ctx.fillStyle = "rgba(2,3,8," + fall[i] * 0.8 + ")";  ctx.fillRect(px + i * a, py, a, TILE); }
        if (right) { ctx.fillStyle = "rgba(2,3,8," + fall[i] * 0.8 + ")";  ctx.fillRect(px + TILE - (i + 1) * a, py, a, TILE); }
      }
    } else {
      var warm = tile === T.EARTH || tile === T.EARTH_RICH || tile === T.HIDDEN_ELEM || tile === T.WATER_SRC || tile === T.LAVA_SRC || !!EMBED_TILE[tile];
      if (!up)    { ctx.fillStyle = warm ? "rgba(255,225,175,0.20)" : "rgba(205,215,255,0.16)"; ctx.fillRect(px, py, TILE, S(1.4)); }
      if (!left)  { ctx.fillStyle = warm ? "rgba(255,225,175,0.09)" : "rgba(205,215,255,0.08)"; ctx.fillRect(px, py, S(1.1), TILE); }
      if (!down)  { ctx.fillStyle = "rgba(0,0,6,0.34)"; ctx.fillRect(px, py + TILE - S(2), TILE, S(2)); }
      if (!right) { ctx.fillStyle = "rgba(0,0,6,0.20)"; ctx.fillRect(px + TILE - S(1.4), py, S(1.4), TILE); }
      if (ROUND_TILE[tile]) {
        // Natural ground has no sharp outer corners: where two neighbouring
        // sides both face bare cave, the corner is worn round
        var au = !up && airAt(x, y - 1), ad = !down && airAt(x, y + 1), al = !left && airAt(x - 1, y), ar = !right && airAt(x + 1, y);
        if (au && al) roundCorner(px, py, 1, 1, warm);
        if (au && ar) roundCorner(px, py, -1, 1, warm);
        if (ad && al) roundCorner(px, py, 1, -1, warm);
        if (ad && ar) roundCorner(px, py, -1, -1, warm);
      }
    }
  }

  // Ground that weathers: earth, rock and ice. Masonry, doors and posts keep
  // their square corners.
  var ROUND_TILE = {};
  [T.EARTH, T.EARTH_RICH, T.HIDDEN_ELEM, T.WATER_SRC, T.LAVA_SRC, T.ROCK, T.ICE].forEach(function(t) { ROUND_TILE[t] = true; });

  // Bare cave: nothing there, the miner, or a loose object lying in the open -
  // and no gas, water or lava creeping in (their overlays stop at the cell edge)
  function airAt(cx, cy) {
    var row = s.grid[cy]; if (!row) return false;
    var t = row[cx];
    if (t !== T.EMPTY && t !== T.PLAYER && !(EMBED_TILE[t] && !isBuried(cx, cy))) return false;
    var key = cy + "," + cx;
    return !(s.waterLevel && s.waterLevel[key]) && !(s.lavaLevel && s.lavaLevel[key]) && !(s.gasLevel && s.gasLevel[key]);
  }

  // Cut one outer corner of a ground tile back to a quarter circle and show
  // the cave behind it. ix, iy point from the corner into the tile.
  function roundCorner(px, py, ix, iy, warm) {
    var r = S(5);
    var cornerX = ix > 0 ? px : px + TILE, cornerY = iy > 0 ? py : py + TILE;
    var midX = cornerX + ix * r, midY = cornerY + iy * r;
    var a0 = -iy * Math.PI / 2, a1 = ix > 0 ? Math.PI : 0, acw = ix * iy > 0;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(cornerX, cornerY); ctx.lineTo(midX, cornerY);
    ctx.arc(midX, midY, r, a0, a1, acw); ctx.closePath(); ctx.clip();
    drawCaveBg(px, py);
    ctx.fillStyle = "rgba(2,3,8,0.30)"; ctx.fillRect(px, py, TILE, TILE);
    ctx.restore();
    // the lip follows the curve: lit from the upper left, shadowed below
    var lw = Math.max(1, S(1.4));
    if (iy > 0) ctx.strokeStyle = warm ? "rgba(255,225,175," + (ix > 0 ? 0.20 : 0.11) + ")" : "rgba(205,215,255," + (ix > 0 ? 0.16 : 0.09) + ")";
    else ctx.strokeStyle = "rgba(0,0,6," + (ix > 0 ? 0.26 : 0.34) + ")";
    ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(midX, midY, r - lw / 2, a0, a1, acw); ctx.stroke();
  }

  // ─── Shared with the other render files ───
  gfx.drawCaveBg = drawCaveBg; gfx.terrainRng = terrainRng; gfx.paintEarth = paintEarth;
  gfx.paintWall = paintWall; gfx.paintRock = paintRock; gfx.paintIce = paintIce;
  gfx.paintBasalt = paintBasalt; gfx.ensureTerrain = ensureTerrain; gfx.drawTerrain = drawTerrain;
  gfx.cellRand = cellRand; gfx.drawSparkle = drawSparkle; gfx.drawEarth = drawEarth;
  gfx.noteOpenCell = noteOpenCell; gfx.isBuried = isBuried; gfx.drawBackdrop = drawBackdrop;
  gfx.shadeTileEdges = shadeTileEdges;
})();
