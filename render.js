"use strict";

// ═══════════════════════════════════════════════════════════════════
// render.js - the frame: draws the visible part of the level, then
// creatures, the miner, machines, effects, fog and the minimap.
// Sprites live in render-tiles.js, render-creatures.js and
// render-player.js; shared helpers in render-core.js.
// ═══════════════════════════════════════════════════════════════════

(function() {
  var s = Game.state, gfx = Game.gfx;

  var ctx, TILE, animFrame;
  gfx.bind(function() { ctx = gfx.ctx; TILE = gfx.tile; animFrame = gfx.animFrame; });

  var PARALLAX_FACTOR = 0.15;
  var isRenderingFrame = false;

  var cellRand = gfx.cellRand,
      drawBackdrop = gfx.drawBackdrop,
      drawTool = gfx.drawTool,
      drawBat = gfx.drawBat,
      drawBoulder = gfx.drawBoulder,
      drawBoulderBody = gfx.drawBoulderBody,
      drawCartBody = gfx.drawCartBody,
      drawCaveBg = gfx.drawCaveBg,
      drawCrab = gfx.drawCrab,
      drawDoor = gfx.drawDoor,
      drawDynamite = gfx.drawDynamite,
      drawEarth = gfx.drawEarth,
      drawExit = gfx.drawExit,
      drawKey = gfx.drawKey,
      drawLiquid = gfx.drawLiquid,
      drawLogicDoor = gfx.drawLogicDoor,
      drawMinecart = gfx.drawMinecart,
      drawMinecartFront = gfx.drawMinecartFront,
      drawPlayer = gfx.drawPlayer,
      drawRollingBarrel = gfx.drawRollingBarrel,
      drawShaftLift = gfx.drawShaftLift,
      drawSnake = gfx.drawSnake,
      drawSparkle = gfx.drawSparkle,
      drawSpider = gfx.drawSpider,
      drawTerrain = gfx.drawTerrain,
      drawWaterPump = gfx.drawWaterPump,
      drawToxicWaste = gfx.drawToxicWaste,
      noteOpenCell = gfx.noteOpenCell,
      playerSprites = gfx.playerSprites,
      shadeTileEdges = gfx.shadeTileEdges;

  // ─── Fog-of-war simplified tile ───
  function drawTileSimple(px, py, tile, x, y) {
    switch (tile) {
      case T.WALL: drawTerrain("wall", px, py); break;
      case T.REFUGE: case T.REFUGE_POST:
        ctx.fillStyle = "#232733"; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "rgba(255,200,120,0.08)"; ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2); break;
      case T.GAS: case T.GAS_SRC:
        ctx.fillStyle = "#101a12"; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "rgba(90,205,110,0.16)"; ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2); break;
      case T.EARTH: case T.HIDDEN_ELEM: drawEarth(px, py, false); break;
      case T.EARTH_RICH: drawEarth(px, py, true); break;
      case T.ROCK: drawTerrain("rock", px, py); break;
      case T.ICE: drawTerrain("ice", px, py); break;
      case T.BOULDER: drawBoulder(px, py); break;
      case T.EXIT:
        ctx.fillStyle = "#0e0e16"; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "#2a2a3a"; ctx.fillRect(px + S(4), py + S(2), TILE - S(8), TILE - S(4)); break;
      case T.ELEMENT:
        drawBackdrop(px, py, x, y); var eKey = s.elementMap[y + "," + x];
        if (eKey) {
          var el = s.elements[eKey];
          ctx.fillStyle = el.color; ctx.globalAlpha = 0.4;
          ctx.beginPath(); ctx.moveTo(px + TILE / 2, py + S(4)); ctx.lineTo(px + TILE - S(6), py + TILE / 2); ctx.lineTo(px + TILE / 2, py + TILE - S(4)); ctx.lineTo(px + S(6), py + TILE / 2); ctx.closePath(); ctx.fill();
          ctx.globalAlpha = 1;
        } break;
      case T.POWERUP:
        drawBackdrop(px, py, x, y); var puKey = s.powerupMap[y + "," + x];
        if (puKey !== undefined) {
          ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.beginPath(); ctx.arc(px + TILE / 2, py + TILE / 2, S(8), 0, Math.PI * 2); ctx.fill();
        } break;
      case T.HAZARD: drawToxicWaste(px, py, x, y); break;
      case T.ROLL_BARREL: drawRollingBarrel(px, py, x, y); break;
      case T.EMPTY:
        ctx.fillStyle = "#0e0e16"; ctx.fillRect(px, py, TILE, TILE); break;
      case T.WATER:
        ctx.fillStyle = "#0a0e1a"; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "rgba(30,80,160,0.35)"; ctx.fillRect(px, py, TILE, TILE); break;
      case T.LAVA:
        ctx.fillStyle = "#1a0800"; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "rgba(200,60,10,0.5)"; ctx.fillRect(px, py, TILE, TILE); break;
      case T.LAVA_SRC: drawEarth(px, py, false); break;
      case T.WATER_SRC: drawEarth(px, py, false); break;
      case T.KEY: drawBackdrop(px, py, x, y); break;
      case T.PAD:
        drawEarth(px, py, false);
        ctx.fillStyle = "#2a2a35"; ctx.fillRect(px + S(2), py + S(2), TILE - S(4), TILE - S(4)); break;
      case T.DOOR: drawDoor(px, py); break;
      case T.LOGIC_DOOR: drawLogicDoor(px, py); break;
      case T.WEB: ctx.fillStyle = "#0e0e16"; ctx.fillRect(px, py, TILE, TILE); break;
      case T.SPIDER_NEST:
        ctx.fillStyle = "#0e0e16"; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = "rgba(60,20,70,0.5)"; ctx.fillRect(px, py, TILE, TILE); break;
      case T.BASALT: drawTerrain("basalt", px, py); break;
      default: ctx.fillStyle = "#0e0e16"; ctx.fillRect(px, py, TILE, TILE); break;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Main render function
  // ═══════════════════════════════════════════════════════════════════
  // ─── Frame state ───
  // Set once per frame by beginFrame() and read by the draw functions below.
  var grid, COLS, ROWS, canvas, camTileX, camTileY, viewCols, viewRows, playerX, playerY, playerTileX, playerTileY,
      sightR, activeEffects, explored, seenTile, enemies, collected, totalElements, elementMap, hiddenElementMap, powerupMap, inventory, placedDynamite,
      explosionEffects, crushEffects, digParticles, exitX, exitY, ELEMENTS, BONUS_ELEMENTS, playerOnWater, slideDraws, slideNow;

  // Sets up everything the draw functions below read: the level, the camera,
  // the miner and how far they can see. Leaves the canvas translated for
  // screen shake and sub-tile scrolling until render() restores it.
  function beginFrame(frameTime) {
    grid = s.grid, COLS = s.cols, ROWS = s.rows;

    var playerVisual = (Game.loop && typeof Game.loop.getPlayerVisualPosition === "function")
    ? Game.loop.getPlayerVisualPosition(frameTime || performance.now())
    : { x: s.playerX, y: s.playerY };

    // Camera: locked to where the miner is drawn, not to the tile they have
    // already been moved to. The view scrolls exactly in step with the miner
    // and stops the instant they stop - no drift after a move.
    var camViewCols = Math.min(COLS, VP_COLS), camViewRows = Math.min(ROWS, VP_ROWS);
    if (COLS > camViewCols) s.camSmoothX = Math.max(0, Math.min(playerVisual.x - Math.floor(camViewCols / 2), COLS - camViewCols));
    else s.camSmoothX = 0;
    if (ROWS > camViewRows) s.camSmoothY = Math.max(0, Math.min(playerVisual.y - Math.floor(camViewRows / 2), ROWS - camViewRows));
    else s.camSmoothY = 0;
    camTileX = Math.floor(s.camSmoothX), camTileY = Math.floor(s.camSmoothY);
    var subPixelX = Math.round((s.camSmoothX - camTileX) * TILE);
    var subPixelY = Math.round((s.camSmoothY - camTileY) * TILE);

    // Parallax background follows the camera directly
    gfx.bgX = s.camSmoothX * TILE * PARALLAX_FACTOR;
    gfx.bgY = s.camSmoothY * TILE * PARALLAX_FACTOR;

    playerX = playerVisual.x, playerY = playerVisual.y;
    playerTileX = s.playerX, playerTileY = s.playerY;
    activeEffects = s.activeEffects;
    explored = s.explored, seenTile = s.seenTile;
    enemies = s.enemies;
    collected = s.collected, totalElements = s.totalElements;
    elementMap = s.elementMap, hiddenElementMap = s.hiddenElementMap, powerupMap = s.powerupMap;
    inventory = s.inventory;
    placedDynamite = s.placedDynamite;
    explosionEffects = s.explosionEffects, crushEffects = s.crushEffects;
    digParticles = s.digParticles;
    exitX = s.exitX, exitY = s.exitY;
    ELEMENTS = s.elements;
    BONUS_ELEMENTS = s.bonusElements;
    playerOnWater = s.playerOnWater;
    canvas = s.canvas;

    viewCols = Math.min(COLS, VP_COLS);
    viewRows = Math.min(ROWS, VP_ROWS);

    ctx.fillStyle = "#060810";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ─── Screen shake offset ───
    var shakeOffX = 0, shakeOffY = 0;
    if (s.reducedFx) s.screenShake = 0;
    if (s.screenShake > 0) {
    var shakeElapsed = Date.now() - s.screenShakeTime;
    if (shakeElapsed < 400) {
        var shakeIntensity = s.screenShake * (1 - shakeElapsed / 400);
        shakeOffX = (Math.random() - 0.5) * shakeIntensity * S(2);
        shakeOffY = (Math.random() - 0.5) * shakeIntensity * S(2);
    } else {
        s.screenShake = 0;
    }
    }
    ctx.save();
    ctx.translate(shakeOffX - subPixelX, shakeOffY - subPixelY);

    var baseSight = s.baseSight || BASE_SIGHT;
    sightR = activeEffects.lamp > 0 ? baseSight * 2 : baseSight;
    if (s.previewMode) sightR = 100000; // editor preview: everything lit, no fog

    // Sliding tiles (falling boulders/barrels): drawn in a second pass with a
    // pixel offset easing to 0, so a leftward slide is not overpainted by the
    // origin cell drawn later in the row
    slideDraws = [];
    slideNow = Date.now();
  }

  function getSlide(x, y) {
    if (!s.tileSlide) return null;
    var sl = s.tileSlide[x + "," + y];
    if (!sl) return null;
    var st = (slideNow - sl.start) / sl.dur;
    if (st >= 1) { delete s.tileSlide[x + "," + y]; return null; }
    // a tile starting from rest eases in; one already falling keeps its speed
    var sp = sl.accel ? Math.pow(st, 1.7) : st;
    // sideways moves roll: about a third of a turn per tile, ending upright
    return { ox: -sl.dx * TILE * (1 - sp), oy: -sl.dy * TILE * (1 - sp), rot: -sl.dx * 2.1 * (1 - st) };
  }

  // Landing bounce: two quick, shrinking hops after a boulder comes to rest
  function getBounce(x, y) {
    if (!s.tileBounce) return 0;
    var b = s.tileBounce[x + "," + y];
    if (!b) return 0;
    var u = (slideNow - b.start) / 300;
    if (u >= 1) { delete s.tileBounce[x + "," + y]; return 0; }
    return Math.abs(Math.sin(u * Math.PI * 2)) * Math.pow(1 - u, 1.6) * S(5.6);
  }

  // Machines stay hidden in the dark exactly as creatures do: visible only
  // when some part of them (tile box x0..x1, y0..y1) is within sight
  function machineInSight(x0, y0, x1, y1) {
    var nx = Math.max(x0, Math.min(playerTileX, x1)), ny = Math.max(y0, Math.min(playerTileY, y1));
    var mdx = nx - playerTileX, mdy = ny - playerTileY;
    return Math.sqrt(mdx * mdx + mdy * mdy) <= sightR + 2;
  }

  // ─── Cell painters: one function per kind of tile ───

  // Tile: ice
  function paintIce(px, py, x, y) {
    drawTerrain("ice", px, py);
    var iceGl = ((Date.now() + cellRand(x, y, 3) * 4000) % 4000) / 4000;
    if (iceGl < 0.12) drawSparkle(px + (0.2 + cellRand(x, y, 5) * 0.6) * TILE, py + (0.2 + cellRand(x, y, 6) * 0.6) * TILE, S(3.6) * Math.sin(iceGl / 0.12 * Math.PI), "rgba(255,255,255,0.95)");
  }

  // Tile: boulder
  function paintBoulder(px, py, x, y) {
    var bSl = getSlide(x, y);
    var bHop = bSl ? 0 : getBounce(x, y);
    if (bSl) { drawBackdrop(px, py, x, y); slideDraws.push({ tile: T.BOULDER, px: px + bSl.ox, py: py + bSl.oy, rot: bSl.rot, x: x, y: y }); }
    else if (bHop) { drawBackdrop(px, py, x, y); slideDraws.push({ tile: T.BOULDER, px: px, py: py - bHop, rot: 0, x: x, y: y }); }
    else drawBoulder(px, py);
  }

  // The cell under the miner: an answer pad, water, or open cave
  function paintMinerCell(px, py, x, y) {
    if (s.triviaMap && s.triviaMap[y + "," + x]) {
      drawEarth(px, py, false);
      var pKey = s.triviaMap[y + "," + x];
      var pColor = "#4ae8d4";
      ctx.fillStyle = "#111"; ctx.fillRect(px + S(2), py + S(2), TILE - S(4), TILE - S(4));
      ctx.fillStyle = "#1a1a22"; ctx.fillRect(px + S(4), py + S(8), TILE - S(8), TILE - S(12));
      ctx.fillStyle = pColor; ctx.globalAlpha = 0.4;
      ctx.fillRect(px + S(4), py + S(8), TILE - S(8), TILE - S(12)); ctx.globalAlpha = 1.0;
      if (pKey) { ctx.fillStyle = "#fff"; ctx.font = 'bold ' + S(11) + 'px "Press Start 2P",monospace'; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(pKey, px + TILE / 2, py + TILE / 2 + S(6)); ctx.textBaseline = "alphabetic"; }
    } else if (playerOnWater) {
      ctx.fillStyle = "#0a0e1a"; ctx.fillRect(px, py, TILE, TILE);
      drawLiquid(px, py, x, y, false);
    } else {
      drawCaveBg(px, py);
    }
  }

  // Tile: exit
  function paintExit(px, py, x, y) {
    drawCaveBg(px, py);
    drawExit(px, py, collected.length >= totalElements);
  }

  // An element's symbol in the pixel font, with a dark outline so it reads on
  // pale gems as well as dark ones; two letters are set a size smaller so
  // they stay on the gem
  function drawSymbol(symbol, cx, cy) {
    ctx.font = 'bold ' + S(symbol.length > 1 ? 9 : 10) + 'px "Press Start 2P",monospace';
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineJoin = "round"; ctx.lineWidth = Math.max(2, S(2.1)); ctx.strokeStyle = "rgba(10,12,24,0.88)";
    ctx.strokeText(symbol, cx, cy);
    ctx.fillStyle = "#fff"; ctx.fillText(symbol, cx, cy);
    ctx.textBaseline = "alphabetic";
  }

  // A collectible element: glowing gem with its symbol, a sweeping shine and twinkles
  function paintElement(px, py, x, y) {
    drawBackdrop(px, py, x, y);
    var eKey = elementMap[y + "," + x];
    if (eKey) {
      var el = ELEMENTS[eKey];
      var eNow = Date.now(), eSeed = x * 7 + y * 13;
      var pulse = Math.sin(eNow * 0.004 + eSeed) * .3 + .7;
      var ecx = px + TILE / 2, ecy = py + TILE / 2;
      var eRgb = hexRgb(el.color);
      // Soft breathing halo
      var glowGrad = ctx.createRadialGradient(ecx, ecy, S(2), ecx, ecy, S(17));
      glowGrad.addColorStop(0, "rgba(" + eRgb + "," + (0.30 + pulse * 0.22) + ")");
      glowGrad.addColorStop(0.55, "rgba(" + eRgb + "," + pulse * 0.14 + ")");
      glowGrad.addColorStop(1, "rgba(" + eRgb + ",0)");
      ctx.fillStyle = glowGrad;
      ctx.fillRect(px - S(1), py - S(1), TILE + S(2), TILE + S(2));
      // Crystal diamond - outer shape
      var cTop = py + S(3), cBot = py + TILE - S(3), cLeft = px + S(5), cRight = px + TILE - S(5);
      var gemPath = function() { ctx.beginPath(); ctx.moveTo(ecx, cTop); ctx.lineTo(cRight, ecy); ctx.lineTo(ecx, cBot); ctx.lineTo(cLeft, ecy); ctx.closePath(); };
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath(); ctx.moveTo(ecx, cTop - S(1)); ctx.lineTo(cRight + S(1), ecy); ctx.lineTo(ecx, cBot + S(1)); ctx.lineTo(cLeft - S(1), ecy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = el.color; gemPath(); ctx.fill();
      // Facets: lit upper left, shaded lower right, bright crown table
      ctx.fillStyle = "rgba(255,255,255,0.36)";
      ctx.beginPath(); ctx.moveTo(ecx, cTop); ctx.lineTo(cLeft, ecy); ctx.lineTo(ecx, ecy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.beginPath(); ctx.moveTo(ecx, cTop); ctx.lineTo(cRight, ecy); ctx.lineTo(ecx, ecy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.beginPath(); ctx.moveTo(cLeft, ecy); ctx.lineTo(ecx, cBot); ctx.lineTo(ecx, ecy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.26)";
      ctx.beginPath(); ctx.moveTo(ecx, ecy); ctx.lineTo(cRight, ecy); ctx.lineTo(ecx, cBot); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.20)";
      ctx.beginPath(); ctx.moveTo(ecx, cTop + S(4)); ctx.lineTo(ecx + S(4.5), ecy); ctx.lineTo(ecx, ecy + S(5)); ctx.lineTo(ecx - S(4.5), ecy); ctx.closePath(); ctx.fill();
      // A band of light sweeping across the gem every couple of seconds
      var sweep = ((eNow + eSeed * 173) % 2600) / 2600;
      if (sweep < 0.34) {
        var sw = sweep / 0.34, bandX = px - S(6) + sw * (TILE + S(12));
        ctx.save(); gemPath(); ctx.clip();
        ctx.fillStyle = "rgba(255,255,255," + (0.55 * Math.sin(sw * Math.PI)) + ")";
        ctx.beginPath();
        ctx.moveTo(bandX, py); ctx.lineTo(bandX + S(4.5), py); ctx.lineTo(bandX - S(4), py + TILE); ctx.lineTo(bandX - S(8.5), py + TILE);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      // Outline
      ctx.strokeStyle = "rgba(255,255,255,0.42)"; ctx.lineWidth = S(0.8); ctx.lineJoin = "round";
      gemPath(); ctx.stroke();
      // Symbol
      drawSymbol(el.symbol, ecx, ecy + S(1));
      // Twinkling four-point stars around the gem
      for (var sp = 0; sp < 5; sp++) {
        var spSeed = eSeed + sp * 37;
        var spPhase = ((eNow * 0.00075 * (0.8 + (spSeed % 5) * 0.12)) + spSeed * 0.137) % 1;
        var spAlpha = Math.sin(spPhase * Math.PI);
        if (spAlpha < 0.12) continue;
        var spAngle = spSeed * 2.4;
        var spDist = S(6.5 + (spSeed % 6) * 1.4);
        var spx = ecx + Math.cos(spAngle) * spDist;
        var spy = ecy + Math.sin(spAngle) * spDist * 0.95;
        var spSize = S(1.6 + (spSeed % 4) * 0.65) * (0.45 + spAlpha * 0.55);
        drawSparkle(spx, spy, spSize, "rgba(255,255,255," + (spAlpha * 0.95) + ")");
      }
      // A bright glint that flares on the top facet now and then
      var gl = ((eNow + eSeed * 311) % 3400) / 3400;
      if (gl < 0.16) drawSparkle(ecx - S(3.2), cTop + S(5.5), S(4.6) * Math.sin(gl / 0.16 * Math.PI), "rgba(255,255,255,0.95)");
    }
  }

  // A hidden bonus element: plain earth unless the Geiger counter is running
  function paintHiddenElement(px, py, x, y) {
    if (activeEffects.geiger > 0) {
      drawEarth(px, py, true); var hk = hiddenElementMap[y + "," + x];
      if (hk) {
        var be = BONUS_ELEMENTS[hk]; var hp2 = Math.sin(animFrame * .12 + x * 3 + y * 2) * .4 + .6;
        ctx.fillStyle = "rgba(" + hexRgb(be.color) + "," + hp2 * .3 + ")"; ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = be.color; ctx.save(); ctx.translate(px + TILE / 2, py + TILE / 2);
        ctx.beginPath(); for (var si = 0; si < 5; si++) { var a1 = (si * 72 - 90) * Math.PI / 180, a2 = ((si * 72) + 36 - 90) * Math.PI / 180; ctx.lineTo(Math.cos(a1) * S(11), Math.sin(a1) * S(11)); ctx.lineTo(Math.cos(a2) * S(5), Math.sin(a2) * S(5)); } ctx.closePath(); ctx.fill(); ctx.restore();
        ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.save(); ctx.translate(px + TILE / 2 - S(1), py + TILE / 2 - S(1));
        ctx.beginPath(); for (var si = 0; si < 5; si++) { var a1 = (si * 72 - 90) * Math.PI / 180, a2 = ((si * 72) + 36 - 90) * Math.PI / 180; ctx.lineTo(Math.cos(a1) * S(7), Math.sin(a1) * S(7)); ctx.lineTo(Math.cos(a2) * S(3), Math.sin(a2) * S(3)); } ctx.closePath(); ctx.fill(); ctx.restore();
        drawSymbol(be.symbol, px + TILE / 2, py + TILE / 2 + S(2));
        ctx.strokeStyle = "rgba(" + hexRgb(be.color) + "," + hp2 * .5 + ")"; ctx.lineWidth = Math.max(1, S(1)); ctx.beginPath(); ctx.arc(px + TILE / 2, py + TILE / 2, S(14) + Math.sin(animFrame * .15) * S(2), 0, Math.PI * 2); ctx.stroke();
      }
    } else {
      drawEarth(px, py, false);
      if (inventory[PU.GEIGER] > 0) { var tick = Math.sin(animFrame * .06 + x * 5 + y * 7); if (tick > 0.85) { ctx.fillStyle = "rgba(74,232,212,0.06)"; ctx.fillRect(px, py, TILE, TILE); } }
    }
  }

  // A tool lying in the mine
  function paintPowerup(px, py, x, y) {
    drawBackdrop(px, py, x, y);
    var type = powerupMap[y + "," + x];
    if (type !== undefined) drawTool(type, px, py, x, y);
  }

  // Tile: hazard
  function paintToxicBarrel(px, py, x, y) {
    var hSl = getSlide(x, y);
    if (hSl) { drawCaveBg(px, py); slideDraws.push({ tile: T.HAZARD, px: px + hSl.ox, py: py + hSl.oy, x: x, y: y }); }
    else drawToxicWaste(px, py, x, y);
  }

  // Tile: pad
  function paintAnswerPad(px, py, x, y) {
    drawEarth(px, py, false);
    var pKey = s.triviaMap[y + "," + x];
    var pColor = (typeof ALL_ELEMENTS !== 'undefined' && ALL_ELEMENTS[pKey]) ? ALL_ELEMENTS[pKey].color : "#4ae8d4";
    ctx.fillStyle = "#111"; ctx.fillRect(px + S(2), py + S(2), TILE - S(4), TILE - S(4));
    ctx.fillStyle = "#2a2a35"; ctx.fillRect(px + S(4), py + S(4), TILE - S(8), TILE - S(8));
    ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.fillRect(px + S(4), py + S(4), TILE - S(8), S(3));
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(px + S(4), py + TILE - S(7), TILE - S(8), S(3));
    // the plate is lit from within in its element's colour, breathing slowly
    var padLw = Math.max(1, S(1)), padBeat = 0.5 + 0.5 * Math.sin(animFrame * 0.06 + x * 1.7 + y);
    ctx.save();
    ctx.globalAlpha = 0.10 + 0.08 * padBeat;
    var padGlow = ctx.createRadialGradient(px + TILE / 2, py + TILE / 2, S(1), px + TILE / 2, py + TILE / 2, TILE * 0.5);
    padGlow.addColorStop(0, pColor); padGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = padGlow; ctx.fillRect(px + S(4), py + S(4), TILE - S(8), TILE - S(8));
    ctx.globalAlpha = 0.30 + 0.25 * padBeat;
    ctx.strokeStyle = pColor; ctx.lineWidth = padLw;
    ctx.strokeRect(px + S(4) + padLw / 2, py + S(4) + padLw / 2, TILE - S(8) - padLw, TILE - S(8) - padLw);
    ctx.restore();
    if (pKey) {
      ctx.font = 'bold ' + S(11) + 'px "Press Start 2P",monospace'; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineJoin = "round"; ctx.lineWidth = Math.max(2, S(2.1)); ctx.strokeStyle = "rgba(8,8,14,0.9)";
      ctx.strokeText(pKey, px + TILE / 2, py + TILE / 2 + S(2));
      ctx.fillStyle = pColor; ctx.fillText(pKey, px + TILE / 2, py + TILE / 2 + S(2)); ctx.textBaseline = "alphabetic";
    }
  }

  // A spider's web across the cell: spokes out to the corners and the middle
  // of each side (so webs in neighbouring cells join up), slightly off-centre
  // hub, and rings of thread sagging between the spokes
  var WEB_ENDS = [[0, 0], [0.5, 0], [1, 0], [1, 0.5], [1, 1], [0.5, 1], [0, 1], [0, 0.5]];
  function strokeWeb(px, py, x, y, rgb, alpha, rings) {
    var hx = px + TILE / 2 + (cellRand(x, y, 11) - 0.5) * S(5), hy = py + TILE / 2 + (cellRand(x, y, 12) - 0.5) * S(5);
    var i, r;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(" + rgb + "," + alpha + ")"; ctx.lineWidth = Math.max(1, S(0.9));
    ctx.beginPath();
    for (i = 0; i < 8; i++) { ctx.moveTo(hx, hy); ctx.lineTo(px + WEB_ENDS[i][0] * TILE, py + WEB_ENDS[i][1] * TILE); }
    ctx.stroke();
    ctx.strokeStyle = "rgba(" + rgb + "," + (alpha * 0.8).toFixed(3) + ")"; ctx.lineWidth = Math.max(1, S(0.7));
    ctx.beginPath();
    for (r = 0; r < rings; r++) {
      var f = 0.26 + r * (0.56 / Math.max(1, rings - 1)) + (cellRand(x, y, 13 + r) - 0.5) * 0.06;
      for (i = 0; i <= 8; i++) {
        var e = WEB_ENDS[i % 8];
        var ex = hx + (px + e[0] * TILE - hx) * f, ey = hy + (py + e[1] * TILE - hy) * f;
        if (i === 0) { ctx.moveTo(ex, ey); }
        else {
          // each span sags towards the hub
          var p = WEB_ENDS[i - 1];
          var qx = hx + (px + (p[0] + e[0]) / 2 * TILE - hx) * f * 0.8, qy = hy + (py + (p[1] + e[1]) / 2 * TILE - hy) * f * 0.8;
          ctx.quadraticCurveTo(qx, qy, ex, ey);
        }
      }
    }
    ctx.stroke();
    return { x: hx, y: hy };
  }

  // Tile: web
  function paintWeb(px, py, x, y) {
    drawCaveBg(px, py);
    var hub = strokeWeb(px, py, x, y, "236,240,255", 0.36, 3);
    // dew catching the lamp now and then
    for (var d = 0; d < 3; d++) {
      var e = WEB_ENDS[Math.floor(cellRand(x, y, 20 + d) * 8)], f = 0.3 + cellRand(x, y, 24 + d) * 0.5;
      var wx = hub.x + (px + e[0] * TILE - hub.x) * f, wy = hub.y + (py + e[1] * TILE - hub.y) * f;
      ctx.fillStyle = "rgba(236,244,255,0.5)";
      ctx.beginPath(); ctx.arc(wx, wy, Math.max(0.8, S(0.8)), 0, Math.PI * 2); ctx.fill();
      var tw = ((Date.now() + cellRand(x, y, 28 + d) * 5200) % 5200) / 5200;
      if (tw < 0.1) drawSparkle(wx, wy, S(3) * Math.sin(tw / 0.1 * Math.PI), "rgba(255,255,255,0.9)");
    }
  }

  // Tile: spider nest
  function paintSpiderNest(px, py, x, y) {
    drawCaveBg(px, py);
    var nestGrad = ctx.createRadialGradient(px + TILE / 2, py + TILE / 2, S(2), px + TILE / 2, py + TILE / 2, TILE * 0.6);
    nestGrad.addColorStop(0, "#3a1848"); nestGrad.addColorStop(0.6, "#1e0e28"); nestGrad.addColorStop(1, "#0e0e16");
    ctx.fillStyle = nestGrad; ctx.fillRect(px, py, TILE, TILE);
    strokeWeb(px, py, x, y, "190,150,210", 0.3, 2);
    // egg sacs: pale, faintly pulsing, each with a sheen
    var eggPulse = Math.sin(animFrame * 0.06 + x * 2 + y) * 0.15 + 0.6;
    var eggs = [[0.35, 0.4, 3, 2.5, 0.3], [0.6, 0.55, 2.5, 2, -0.2], [0.45, 0.65, 2, 2.5, 0.5]];
    for (var ei = 0; ei < eggs.length; ei++) {
      var eg = eggs[ei], egx = px + TILE * eg[0], egy = py + TILE * eg[1];
      ctx.fillStyle = "rgba(40,14,52,0.55)";
      ctx.beginPath(); ctx.ellipse(egx, egy + S(0.6), S(eg[2] + 0.8), S(eg[3] + 0.8), eg[4], 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(206,186,226," + (eggPulse * 0.5).toFixed(3) + ")";
      ctx.beginPath(); ctx.ellipse(egx, egy, S(eg[2]), S(eg[3]), eg[4], 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255," + (eggPulse * 0.28).toFixed(3) + ")";
      ctx.beginPath(); ctx.ellipse(egx - S(0.8), egy - S(0.8), S(eg[2] * 0.4), S(eg[3] * 0.35), eg[4], 0, Math.PI * 2); ctx.fill();
    }
  }

  // Tile: basalt
  function paintBasalt(px, py, x, y) {
    var bKey = y + "," + x;
    var bLife = s.basaltLife[bKey] !== undefined ? s.basaltLife[bKey] : 100;
    var bStage = bLife > 75 ? 0 : bLife > 50 ? 1 : bLife > 25 ? 2 : 3;
    drawTerrain("basalt", px, py);
    if (bStage >= 2) { ctx.fillStyle = "rgba(0,0,0," + (bStage === 3 ? 0.3 : 0.14) + ")"; ctx.fillRect(px, py, TILE, TILE); }
    ctx.strokeStyle = "rgba(6,6,10,0.85)"; ctx.lineWidth = S(1); ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (bStage >= 1) {
      ctx.beginPath(); ctx.moveTo(px + S(6), py + S(4)); ctx.lineTo(px + TILE * 0.4, py + TILE * 0.5);
      ctx.lineTo(px + TILE * 0.55, py + TILE - S(5)); ctx.stroke();
    }
    if (bStage >= 2) {
      ctx.lineWidth = S(1.5);
      ctx.beginPath(); ctx.moveTo(px + TILE - S(5), py + S(6)); ctx.lineTo(px + TILE * 0.5, py + TILE * 0.45);
      ctx.lineTo(px + S(8), py + TILE - S(4)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px + TILE * 0.3, py + S(3)); ctx.lineTo(px + TILE * 0.35, py + TILE * 0.35); ctx.stroke();
    }
    if (bStage >= 3) {
      ctx.lineWidth = S(2);
      ctx.beginPath(); ctx.moveTo(px + S(3), py + TILE * 0.3); ctx.lineTo(px + TILE * 0.45, py + TILE * 0.6);
      ctx.lineTo(px + TILE - S(4), py + TILE * 0.7); ctx.stroke();
      ctx.fillStyle = "rgba(14,14,22,0.3)";
      ctx.fillRect(px + S(4), py + TILE * 0.55, S(5), S(4));
      ctx.fillRect(px + TILE * 0.6, py + S(3), S(4), S(5));
    }
  }

  // Refuge chamber floor
  function paintRefugeFloor(px, py, x, y) {
    // safe-room floor: dark steel plating with a warm glow
    ctx.fillStyle = "#232733"; ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = "#2c3140"; ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
    ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1;
    ctx.strokeRect(px + TILE * 0.5 + 0.5, py + 0.5, TILE * 0.5, TILE * 0.5);
    ctx.strokeRect(px + 0.5, py + TILE * 0.5 + 0.5, TILE * 0.5, TILE * 0.5);
    var rfGlow = 0.10 + Math.sin(animFrame * 0.06 + x) * 0.03;
    ctx.fillStyle = "rgba(255,200,120," + rfGlow + ")";
    ctx.fillRect(px, py, TILE, TILE);
    // a lit upper edge and a rivet in each corner of the plate
    ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fillRect(px + 1, py + 1, TILE - 2, Math.max(1, S(1)));
    var rvS = Math.max(1, S(1.6)), rvIn = S(3);
    for (var rv = 0; rv < 4; rv++) {
      var rvx = px + (rv % 2 ? TILE - rvIn - rvS : rvIn), rvy = py + (rv < 2 ? rvIn : TILE - rvIn - rvS);
      ctx.fillStyle = "rgba(0,0,0,0.38)"; ctx.fillRect(rvx, rvy, rvS, rvS);
      ctx.fillStyle = "rgba(232,184,75,0.42)"; ctx.fillRect(rvx, rvy, Math.max(1, rvS - 1), Math.max(1, rvS - 1));
    }
    // Which cell of the 3×3 shelter is this?
    var rfW = grid[y][x - 1], rfE = grid[y][x + 1];
    var rfN = grid[y - 1] ? grid[y - 1][x] : -1, rfS2 = grid[y + 1] ? grid[y + 1][x] : -1;
    if (rfW === T.REFUGE_POST && rfE === T.REFUGE_POST && rfS2 === T.REFUGE) {
      // Top-middle: illuminated "REFUGE" shelter sign hanging between the posts
      var rsx = px + TILE / 2, rsw = TILE - S(5), rsy = py + S(7), rsh = S(17);
      // hanger chains from the ceiling
      ctx.strokeStyle = "#3a3f4c"; ctx.lineWidth = S(1.2);
      ctx.beginPath();
      ctx.moveTo(rsx - S(8), py); ctx.lineTo(rsx - S(8), rsy);
      ctx.moveTo(rsx + S(8), py); ctx.lineTo(rsx + S(8), rsy);
      ctx.stroke();
      // pulsing halo behind the sign
      var rsPulse = 0.5 + Math.sin(animFrame * 0.08) * 0.25;
      var rsHalo = ctx.createRadialGradient(rsx, rsy + rsh / 2, S(2), rsx, rsy + rsh / 2, TILE * 0.75);
      rsHalo.addColorStop(0, "rgba(90,230,140," + (0.22 * rsPulse + 0.1).toFixed(3) + ")");
      rsHalo.addColorStop(1, "rgba(90,230,140,0)");
      ctx.fillStyle = rsHalo;
      ctx.fillRect(px, py, TILE, TILE);
      // sign panel
      ctx.fillStyle = "#0d2a16";
      ctx.fillRect(rsx - rsw / 2, rsy, rsw, rsh);
      ctx.strokeStyle = "rgba(95,232,138," + (0.55 + rsPulse * 0.45).toFixed(2) + ")";
      ctx.lineWidth = S(1.4);
      ctx.strokeRect(rsx - rsw / 2, rsy, rsw, rsh);
      // pictogram: person sheltered under a roof
      ctx.strokeStyle = "#eafff0"; ctx.lineWidth = S(1.6); ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(rsx - S(7.5), rsy + S(8)); ctx.lineTo(rsx, rsy + S(2.5)); ctx.lineTo(rsx + S(7.5), rsy + S(8));
      ctx.stroke();
      ctx.fillStyle = "#eafff0";
      ctx.beginPath(); ctx.arc(rsx, rsy + S(8.5), S(2), 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#eafff0"; ctx.lineWidth = S(1.8);
      ctx.beginPath(); ctx.moveTo(rsx, rsy + S(10.5)); ctx.lineTo(rsx, rsy + S(14.5)); ctx.stroke();
      ctx.lineWidth = S(1.3);
      ctx.beginPath();
      ctx.moveTo(rsx - S(3.5), rsy + S(12)); ctx.lineTo(rsx + S(3.5), rsy + S(12));
      ctx.stroke();
      // blinking beacon lamp on top of the sign
      var rsBlink = Math.sin(animFrame * 0.14) > 0.2 ? 1 : 0.25;
      ctx.fillStyle = "rgba(120,255,160," + rsBlink + ")";
      ctx.beginPath(); ctx.arc(rsx, rsy - S(1.6), S(1.7), 0, Math.PI * 2); ctx.fill();
    } else if (rfW === T.REFUGE && rfE === T.REFUGE && rfN === T.REFUGE && rfS2 === T.REFUGE) {
      // Center: save-point beacon - expanding rings on the floor
      var rcx = px + TILE / 2, rcy = py + TILE / 2;
      ctx.strokeStyle = "rgba(95,232,138,0.5)"; ctx.lineWidth = S(1.2);
      ctx.beginPath(); ctx.arc(rcx, rcy, S(6.5), 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = S(2);
      ctx.beginPath();
      ctx.moveTo(rcx - S(3), rcy); ctx.lineTo(rcx + S(3), rcy);
      ctx.moveTo(rcx, rcy - S(3)); ctx.lineTo(rcx, rcy + S(3));
      ctx.stroke();
      for (var rri = 0; rri < 2; rri++) {
        var rrp = ((animFrame * 0.02 + rri * 0.5) % 1);
        var rrr = S(4) + rrp * TILE * 0.52;
        ctx.strokeStyle = "rgba(95,232,138," + (0.45 * (1 - rrp)).toFixed(3) + ")";
        ctx.lineWidth = S(1.4);
        ctx.beginPath(); ctx.arc(rcx, rcy, rrr, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  // Refuge chamber corner post
  function paintRefugePost(px, py, x, y) {
    // reinforced shelter post: steel with a first-aid cross
    ctx.fillStyle = "#1a1d26"; ctx.fillRect(px, py, TILE, TILE);
    var rpGrad = ctx.createLinearGradient(px, py, px, py + TILE);
    rpGrad.addColorStop(0, "#5c6472"); rpGrad.addColorStop(0.5, "#454c58"); rpGrad.addColorStop(1, "#31363f");
    ctx.fillStyle = rpGrad; ctx.fillRect(px + S(2), py + S(2), TILE - S(4), TILE - S(4));
    ctx.strokeStyle = "#141720"; ctx.lineWidth = S(2);
    ctx.strokeRect(px + S(2), py + S(2), TILE - S(4), TILE - S(4));
    ctx.fillStyle = "#e8e8ec";
    ctx.beginPath(); ctx.arc(px + TILE / 2, py + TILE / 2, S(7), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#3fae5a";
    ctx.fillRect(px + TILE / 2 - S(1.6), py + TILE / 2 - S(4.6), S(3.2), S(9.2));
    ctx.fillRect(px + TILE / 2 - S(4.6), py + TILE / 2 - S(1.6), S(9.2), S(3.2));
  }

  // Tile: gas
  function paintGas(px, py, x, y) {
    // drifting greenish wisps - soft, layered, breathing
    drawCaveBg(px, py);
    var gPhase = animFrame * 0.045 + (x * 5.13 + y * 2.71);
    for (var gw = 0; gw < 3; gw++) {
      var gwx = px + TILE / 2 + Math.sin(gPhase * (0.7 + gw * 0.23) + gw * 2.1) * TILE * 0.28;
      var gwy = py + TILE / 2 + Math.cos(gPhase * (0.5 + gw * 0.31) + gw * 1.4) * TILE * 0.24;
      var gwr = TILE * (0.42 + 0.1 * Math.sin(gPhase + gw * 2.4));
      var gwAlpha = 0.16 + 0.07 * Math.sin(gPhase * 1.3 + gw);
      var gGrad = ctx.createRadialGradient(gwx, gwy, gwr * 0.15, gwx, gwy, gwr);
      gGrad.addColorStop(0, "rgba(140,235,150," + (gwAlpha + 0.10).toFixed(3) + ")");
      gGrad.addColorStop(0.6, "rgba(90,205,110," + gwAlpha.toFixed(3) + ")");
      gGrad.addColorStop(1, "rgba(60,160,80,0)");
      ctx.fillStyle = gGrad;
      ctx.beginPath(); ctx.arc(gwx, gwy, gwr, 0, Math.PI * 2); ctx.fill();
    }
    // rising motes
    for (var gm = 0; gm < 2; gm++) {
      var gmx = px + ((x * 17 + gm * 13 + Math.floor(animFrame * 0.3)) % TILE);
      var gmy = py + TILE - ((animFrame * 0.5 + gm * 11 + x * 5) % TILE);
      ctx.fillStyle = "rgba(170,255,180,0.35)";
      ctx.fillRect(gmx, gmy, S(1.4), S(1.4));
    }
  }

  // Tile: gas src
  function paintGasPipe(px, py, x, y) {
    // ruptured gas pipe embedded in rock, hissing
    ctx.fillStyle = "#1a1a2e"; ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = "#252540"; ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
    // the pipe is round: lit along the top, dark underneath, with bolted flanges
    var gpY = py + TILE / 2;
    ctx.fillStyle = "#0e1016"; ctx.fillRect(px + S(3), gpY - S(4.4), TILE - S(6), S(8.8));
    var gpBody = ctx.createLinearGradient(0, gpY - S(3.4), 0, gpY + S(3.4));
    gpBody.addColorStop(0, "#77859a"); gpBody.addColorStop(0.3, "#566273"); gpBody.addColorStop(1, "#2c333f");
    ctx.fillStyle = gpBody; ctx.fillRect(px + S(4), gpY - S(3.4), TILE - S(8), S(6.8));
    for (var gf = 0; gf < 2; gf++) {
      var gfx0 = gf ? px + TILE - S(6.2) : px + S(3);
      ctx.fillStyle = "#0e1016"; ctx.fillRect(gfx0 - 1, gpY - S(4.6) - 1, S(3.2) + 2, S(9.2) + 2);
      var gpFl = ctx.createLinearGradient(0, gpY - S(4.6), 0, gpY + S(4.6));
      gpFl.addColorStop(0, "#8d9bb0"); gpFl.addColorStop(0.35, "#657285"); gpFl.addColorStop(1, "#353d4a");
      ctx.fillStyle = gpFl; ctx.fillRect(gfx0, gpY - S(4.6), S(3.2), S(9.2));
      ctx.fillStyle = "rgba(10,12,18,0.6)";
      ctx.fillRect(gfx0 + S(1), gpY - S(3.4), Math.max(1, S(1.1)), Math.max(1, S(1.1)));
      ctx.fillRect(gfx0 + S(1), gpY + S(2.3), Math.max(1, S(1.1)), Math.max(1, S(1.1)));
    }
    // the crack
    ctx.strokeStyle = "#10131a"; ctx.lineWidth = S(1.4);
    ctx.beginPath();
    ctx.moveTo(px + TILE / 2 - S(2), py + TILE / 2 - S(3.4));
    ctx.lineTo(px + TILE / 2 + S(1), py + TILE / 2);
    ctx.lineTo(px + TILE / 2 - S(1), py + TILE / 2 + S(3.4));
    ctx.stroke();
    // hissing jet
    var hissA = 0.25 + 0.15 * Math.sin(animFrame * 0.4 + x);
    var hGrad = ctx.createRadialGradient(px + TILE / 2, py + TILE / 2 - S(4), S(1), px + TILE / 2, py + TILE / 2 - S(8), S(8));
    hGrad.addColorStop(0, "rgba(140,235,150," + hissA.toFixed(3) + ")");
    hGrad.addColorStop(1, "rgba(90,205,110,0)");
    ctx.fillStyle = hGrad;
    ctx.beginPath(); ctx.arc(px + TILE / 2, py + TILE / 2 - S(6), S(8), 0, Math.PI * 2); ctx.fill();
  }

  // Gas, water or lava part-way through filling an open cell
  function paintFluidLevels(px, py, x, y) {
    // ─── Partial gas overlay (clouds creeping in from the ceiling) ───
    var glKey = y + "," + x;
    var glEntry = s.gasLevel && s.gasLevel[glKey];
    if (glEntry) {
      var gLvl = Math.min(glEntry.level, 1.0);
      var gpGrad = ctx.createLinearGradient(px, py, px, py + TILE * gLvl);
      gpGrad.addColorStop(0, "rgba(110,220,125," + (0.30 * gLvl).toFixed(3) + ")");
      gpGrad.addColorStop(1, "rgba(70,170,90,0)");
      ctx.fillStyle = gpGrad;
      ctx.fillRect(px, py, TILE, TILE * gLvl);
    }

    // ─── Partial water overlay (filling tiles) ───
    var wlKey = y + "," + x;
    var wlEntry = s.waterLevel[wlKey];
    if (wlEntry) {
      var wLvl = Math.min(wlEntry.level, 1.0);
      var wH = TILE * wLvl;
      var wTop = py + TILE - wH;
      var wfGrad = ctx.createLinearGradient(px, wTop, px, py + TILE);
      wfGrad.addColorStop(0, "rgba(50,120,210,0.35)");
      wfGrad.addColorStop(1, "rgba(15,50,120,0.65)");
      ctx.fillStyle = wfGrad;
      ctx.fillRect(px, wTop, TILE, wH);
      if (wLvl > 0.15) {
        ctx.strokeStyle = "rgba(130,200,255,0.3)"; ctx.lineWidth = S(0.8);
        ctx.beginPath(); ctx.moveTo(px, wTop);
        for (var wsx = 0; wsx <= TILE; wsx += S(3)) ctx.lineTo(px + wsx, wTop + Math.sin(animFrame * 0.12 + x * 2.5 + wsx * 0.2) * S(1));
        ctx.stroke();
      }
    }

    // ─── Partial lava overlay (filling tiles) ───
    var llKey = y + "," + x;
    var llEntry = s.lavaLevel[llKey];
    if (llEntry) {
      var lLvl = Math.min(llEntry.level, 1.0);
      var lH = TILE * lLvl;
      var lTop = py + TILE - lH;
      var lfGrad = ctx.createLinearGradient(px, lTop, px, py + TILE);
      lfGrad.addColorStop(0, "rgba(220,80,10,0.45)");
      lfGrad.addColorStop(1, "rgba(160,30,0,0.75)");
      ctx.fillStyle = lfGrad;
      ctx.fillRect(px, lTop, TILE, lH);
      if (lLvl > 0.15) {
        ctx.strokeStyle = "rgba(255,180,40,0.35)"; ctx.lineWidth = S(0.8);
        ctx.beginPath(); ctx.moveTo(px, lTop);
        for (var lsx = 0; lsx <= TILE; lsx += S(3)) ctx.lineTo(px + lsx, lTop + Math.sin(animFrame * 0.08 + x * 2.0 + lsx * 0.18) * S(1));
        ctx.stroke();
      }
    }
  }

  // The visible cells, back to front: everything within reach of the lamp in
  // full, remembered cells beyond it simplified. Nothing is dimmed here - the
  // light falling off is one smooth gradient laid over the frame by drawFog().
  function drawCells() {
    // reach: how far the miner sees and remembers, as before. shown: cells
    // drawn, a third of a tile further. Every point within FOG_EDGE tiles of
    // the sight radius then lies on a drawn cell (0.35 + 1.5 - half a cell's
    // diagonal), so the round edge of the lamplight never cuts across the
    // corner of a cell left black. The extra cells lie under the darkest fog.
    var reach = sightR + 1.5, shown = reach + 0.35, shown2 = shown * shown;
    for (var y = camTileY; y < camTileY + viewRows + 1 && y < ROWS; y++) {
      for (var x = camTileX; x < camTileX + viewCols + 1 && x < COLS; x++) {
        var px = (x - camTileX) * TILE, py = (y - camTileY) * TILE;
        var tile = grid[y][x];
        gfx.cellX = x; gfx.cellY = y;
        noteOpenCell(explored, tile, x, y, COLS);
        var dx = x - playerTileX, dy = y - playerTileY, dist = Math.sqrt(dx * dx + dy * dy);
        // A cell is seen (and remembered) from the tile the miner stands on.
        // It is drawn in full while it lies within the lamp's reach of where
        // the miner is *drawn*, which trails the tile by part of a step - so
        // the simplified cells never show inside the moving pool of light.
        var seen = dist <= reach;
        if (seen) { explored[y][x] = true; seenTile[y][x] = tile; }
        var vdx = x - playerX, vdy = y - playerY;
        var lit = dist <= shown || (explored[y][x] && vdx * vdx + vdy * vdy <= shown2);

        if (!lit) {
          gfx.parallax = false;
          if (explored[y][x]) drawTileSimple(px, py, seenTile[y][x], x, y);
          continue;
        }

        gfx.parallax = true;
        switch (tile) {
          case T.WALL: drawTerrain("wall", px, py); break;
          case T.EARTH: drawEarth(px, py, false); break;
          case T.EARTH_RICH: drawEarth(px, py, true); break;
          case T.ROCK: drawTerrain("rock", px, py); break;
          case T.ICE: paintIce(px, py, x, y); break;
          case T.BOULDER: paintBoulder(px, py, x, y); break;
          case T.PLAYER: paintMinerCell(px, py, x, y); break;
          case T.EXIT: paintExit(px, py, x, y); break;
          case T.ELEMENT: paintElement(px, py, x, y); break;
          case T.HIDDEN_ELEM: paintHiddenElement(px, py, x, y); break;
          case T.POWERUP: paintPowerup(px, py, x, y); break;
          case T.HAZARD: paintToxicBarrel(px, py, x, y); break;
          case T.ROLL_BARREL: drawRollingBarrel(px, py, x, y); break;
          case T.EMPTY: drawCaveBg(px, py); break;
          case T.WATER: drawLiquid(px, py, x, y, false); break;
          case T.WATER_SRC:
            drawEarth(px, py, false); ctx.fillStyle = "rgba(40,100,200,0.08)"; ctx.fillRect(px, py, TILE, TILE); break;
          case T.LAVA: drawLiquid(px, py, x, y, true); break;
          case T.LAVA_SRC:
            drawEarth(px, py, false); ctx.fillStyle = "rgba(200,60,10,0.08)"; ctx.fillRect(px, py, TILE, TILE); break;
          case T.CART: drawCartBody(px, py); break;
          case T.KEY: drawBackdrop(px, py, x, y); drawKey(px, py, x, y); break;
          case T.DOOR: drawDoor(px, py); break;
          case T.PAD: paintAnswerPad(px, py, x, y); break;
          case T.LOGIC_DOOR: drawLogicDoor(px, py); break;
          case T.WEB: paintWeb(px, py, x, y); break;
          case T.SPIDER_NEST: paintSpiderNest(px, py, x, y); break;
          case T.BASALT: paintBasalt(px, py, x, y); break;
          case T.REFUGE: paintRefugeFloor(px, py, x, y); break;
          case T.REFUGE_POST: paintRefugePost(px, py, x, y); break;
          case T.GAS: paintGas(px, py, x, y); break;
          case T.GAS_SRC: paintGasPipe(px, py, x, y); break;
        }

        paintFluidLevels(px, py, x, y);

        shadeTileEdges(px, py, x, y, tile);
      }
    }
    gfx.parallax = true;
  }

  // ─── Sliding boulders/barrels (drawn over both cells they straddle) ───
  function drawSlidingTiles() {
    for (var sdi = 0; sdi < slideDraws.length; sdi++) {
      var sd = slideDraws[sdi];
      if (sd.tile === T.BOULDER) drawBoulderBody(sd.px, sd.py, sd.rot);
      else drawToxicWaste(sd.px, sd.py, sd.x, sd.y);
    }
  }

  // ─── Placed dynamite overlay ───
  // A lit stick with its countdown; in the last two ticks the blast area is outlined
  function drawPlacedDynamite() {
    for (var di = 0; di < placedDynamite.length; di++) {
      var dd = placedDynamite[di];
      if (dd.x < camTileX || dd.x >= camTileX + viewCols + 1 || dd.y < camTileY || dd.y >= camTileY + viewRows + 1) continue;
      var dpx = (dd.x - camTileX) * TILE, dpy = (dd.y - camTileY) * TILE;
      var ddx2 = dd.x - playerX, ddy2 = dd.y - playerY, ddist2 = Math.sqrt(ddx2 * ddx2 + ddy2 * ddy2);
      if (ddist2 > sightR + 1.5 && !explored[dd.y][dd.x]) continue;
      var fPulse = Math.sin(animFrame * .3) * .4 + .6;
      var dcx = dpx + TILE / 2, dcy = dpy + TILE / 2;
      var dGlow = ctx.createRadialGradient(dcx, dcy, S(2), dcx, dcy, TILE * 0.85);
      dGlow.addColorStop(0, "rgba(232,84,84," + (fPulse * 0.45).toFixed(3) + ")");
      dGlow.addColorStop(0.6, "rgba(232,84,84," + (fPulse * 0.16).toFixed(3) + ")");
      dGlow.addColorStop(1, "rgba(232,84,84,0)");
      ctx.fillStyle = dGlow; ctx.fillRect(dpx - TILE * 0.35, dpy - TILE * 0.35, TILE * 1.7, TILE * 1.7);
      drawDynamite(dpx, dpy - S(1), dd.x, dd.y, fPulse, null, true);
      // countdown, outlined so it reads on any ground
      ctx.font = 'bold ' + S(10) + 'px "Press Start 2P",monospace'; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineJoin = "round"; ctx.lineWidth = S(2.6); ctx.strokeStyle = "rgba(24,6,6,0.9)";
      ctx.strokeText(dd.fuse.toString(), dcx, dcy + S(10));
      ctx.fillStyle = dd.fuse <= 2 ? "#ffe08a" : "#fff";
      ctx.fillText(dd.fuse.toString(), dcx, dcy + S(10)); ctx.textBaseline = "alphabetic";
      if (dd.fuse <= 2) {
        ctx.strokeStyle = "rgba(232,84,84," + (fPulse * .5).toFixed(3) + ")"; ctx.lineWidth = Math.max(1, S(1));
        ctx.setLineDash([S(4), S(3)]); ctx.lineDashOffset = -animFrame * 0.4;
        ctx.strokeRect(dpx - TILE + 0.5, dpy - TILE + 0.5, TILE * 3 - 1, TILE * 3 - 1);
        ctx.setLineDash([]); ctx.lineDashOffset = 0;
      }
    }
  }

  // ─── Enemies ───
  function drawCreatures() {
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (!e.alive) continue;
      if (e.floatX === undefined) e.floatX = e.x;
      if (e.floatY === undefined) e.floatY = e.y;
      e.floatX += (e.x - e.floatX) * ease(0.18);
      e.floatY += (e.y - e.floatY) * ease(0.18);
      var renderTileX = Math.round(e.floatX), renderTileY = Math.round(e.floatY);
      if (renderTileX < camTileX - 1 || renderTileX >= camTileX + viewCols + 2 || renderTileY < camTileY - 1 || renderTileY >= camTileY + viewRows + 2) continue;
      var edx = e.floatX - playerTileX, edy = e.floatY - playerTileY, edist = Math.sqrt(edx * edx + edy * edy);
      if (edist > sightR + 2) continue;
      var epx = (e.floatX - camTileX) * TILE, epy = (e.floatY - camTileY) * TILE;
      if (e.type === "bat") drawBat(epx, epy, e);
      else if (e.type === "snake") drawSnake(epx, epy, e);
      else if (e.type === "crab") drawCrab(epx, epy, e);
      else if (e.type === "spider") drawSpider(epx, epy, e);
    }
  }

  // ─── Player sprite ───
  // Touch screens: a soft outline on the cell the finger is steering the miner into
  function drawTouchAim() {
    var aim = s.touchAim;
    if (!aim || aim.x < 0 || aim.y < 0 || aim.x >= COLS || aim.y >= ROWS) return;
    var ax = (aim.x - camTileX) * TILE, ay = (aim.y - camTileY) * TILE, inset = S(2.5);
    ctx.save();
    ctx.strokeStyle = "rgba(232,184,75,0.75)"; ctx.lineWidth = S(2);
    ctx.fillStyle = "rgba(232,184,75,0.10)";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(ax + inset, ay + inset, TILE - inset * 2, TILE - inset * 2, S(5));
    else ctx.rect(ax + inset, ay + inset, TILE - inset * 2, TILE - inset * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function drawMiner() {
    if (playerX >= camTileX - 1 && playerX < camTileX + viewCols + 1 && playerY >= camTileY - 1 && playerY < camTileY + viewRows + 1) {
      var plpx = (playerX - camTileX) * TILE, plpy = (playerY - camTileY) * TILE;
      // Danger indicator - flashing red warning when enemy is on the player's tile
      if (s.enemyDanger) {
        var dFlash = s.reducedFx ? 0.55 : Math.sin(Date.now() * 0.012) * 0.3 + 0.45;   // steady with "Effects: Reduced"
        ctx.fillStyle = "rgba(255,40,40," + dFlash.toFixed(2) + ")";
        ctx.beginPath(); ctx.arc(plpx + TILE / 2, plpy + TILE / 2, TILE * 0.85, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(255,80,80," + (dFlash + 0.2).toFixed(2) + ")";
        ctx.lineWidth = S(2);
        ctx.beginPath(); ctx.arc(plpx + TILE / 2, plpy + TILE / 2, TILE * 0.85, 0, Math.PI * 2); ctx.stroke();
      }
      var rideSpin = playerX * TILE / S(3.6);
      if (s.riding) drawCartBody(plpx, plpy, { spin: rideSpin });
      drawPlayer(plpx, plpy);
      if (s.riding) {
        // tub and wheels over the miner's legs for depth
        drawMinecartFront(plpx, plpy, { spin: rideSpin });
      }
    }
  }

  // ─── Water pumps ───
  // The pump the miner set down: the same machine as the tool lying in the
  // mine, shuddering and gushing while it drains, still once the flood is gone
  function drawPumps() {
    if (s.pumps) {
      for (var pmi = 0; pmi < s.pumps.length; pmi++) {
        var pm = s.pumps[pmi];
        if (pm.x < camTileX - 1 || pm.x > camTileX + viewCols + 1 || pm.y < camTileY - 1 || pm.y > camTileY + viewRows + 1) continue;
        var pmx = (pm.x - camTileX) * TILE, pmy = (pm.y - camTileY) * TILE;
        var running = !pm.done;
        // intake hose hanging into the flood
        var sway = running ? Math.sin(animFrame * 0.35 + pmi) * S(2) : 0;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#141a24"; ctx.lineWidth = S(3.4);
        ctx.beginPath(); ctx.moveTo(pmx + S(9), pmy + TILE - S(7));
        ctx.quadraticCurveTo(pmx + S(6), pmy + TILE + S(1), pmx + S(9) + sway, pmy + TILE + S(5)); ctx.stroke();
        ctx.strokeStyle = "#2f6ea3"; ctx.lineWidth = S(1.8);
        ctx.beginPath(); ctx.moveTo(pmx + S(9), pmy + TILE - S(7));
        ctx.quadraticCurveTo(pmx + S(6), pmy + TILE + S(1), pmx + S(9) + sway, pmy + TILE + S(5)); ctx.stroke();
        var shudder = running ? Math.round(Math.sin(animFrame * 0.9 + pmi * 2)) * Math.max(1, S(0.5)) * 0.5 : 0;
        drawWaterPump(pmx + shudder, pmy, pm.x, pm.y, 1, null, running ? "run" : "off");
      }
    }
  }

  // ─── Rolling barrels ───
  function drawRollingBarrels() {
    if (s.rollingBarrels) {
      for (var rbi = s.rollingBarrels.length - 1; rbi >= 0; rbi--) {
        var rb = s.rollingBarrels[rbi];
        rb.floatX += (rb.x - rb.floatX) * ease(0.3);
        rb.floatY += (rb.y - rb.floatY) * ease(0.3);
        // Advance rotation based on horizontal movement direction
        rb.rot = (rb.rot || 0) + rb.dx * 0.35 * frameStep;
        var rbpx = (rb.floatX - camTileX) * TILE, rbpy = (rb.floatY - camTileY) * TILE;
        drawRollingBarrel(rbpx, rbpy, Math.round(rb.floatX), Math.round(rb.floatY), rb.rot);
      }
    }
  }

  // ─── Rolling carts ───
  function drawRollingCarts() {
    var carts = s.rollingCarts || [];
    for (var i = 0; i < carts.length; i++) {
      var x = Game.machines.rollingCartX(carts[i], Date.now());
      drawCartBody((x - camTileX) * TILE, (carts[i].y - camTileY) * TILE, { ore: true, spin: x * TILE / S(3.6) });
    }
  }

  // ─── Bouncing carts ───
  function drawRunawayCarts() {
    if (s.bouncingCarts) {
      for (var i = 0; i < s.bouncingCarts.length; i++) {
        var bc = s.bouncingCarts[i];
        if (!machineInSight(bc.floatX, bc.y, bc.floatX, bc.y)) continue;
        if (bc.y >= camTileY && bc.y < camTileY + viewRows + 1 && bc.floatX >= camTileX - 1 && bc.floatX < camTileX + viewCols + 1) {
          var rcpx = (bc.floatX - camTileX) * TILE, rcpy = (bc.y - camTileY) * TILE;
          drawMinecart(rcpx, rcpy, { rogue: true, spin: bc.floatX * TILE / S(3.6), dir: bc.dx });
        }
      }
    }
  }

  // ─── Tunnel boring machines (3×2, rotating cutter head at the front) ───
  // One tunnel borer: armoured body with hazard stripe and cab, a spinning
  // cutter head at the front, and sparks while it is grinding into something
  function drawTunnelBorer(tbm) {
    var mpx = (tbm.floatX - camTileX) * TILE, mpy = (tbm.y - camTileY) * TILE;
    var mw = 3 * TILE, mh = 2 * TILE;
    var headX = tbm.dir > 0 ? mpx + mw - TILE * 0.5 : mpx + TILE * 0.5;

    // Body: armored shield segments with hazard stripes
    var bodyX = tbm.dir > 0 ? mpx : mpx + TILE * 0.6;
    var bodyW = mw - TILE * 0.6;
    var grad = ctx.createLinearGradient(bodyX, mpy, bodyX, mpy + mh);
    grad.addColorStop(0, "#6a7280"); grad.addColorStop(0.5, "#4a505c"); grad.addColorStop(1, "#33383f");
    ctx.fillStyle = grad;
    ctx.fillRect(bodyX, mpy + S(2), bodyW, mh - S(4));
    ctx.strokeStyle = "#22262c"; ctx.lineWidth = S(2);
    ctx.strokeRect(bodyX, mpy + S(2), bodyW, mh - S(4));
    // lit top plate, shadowed underside and skids
    ctx.fillStyle = "rgba(220,230,245,0.22)"; ctx.fillRect(bodyX + S(1), mpy + S(3), bodyW - S(2), S(2.2));
    ctx.fillStyle = "rgba(0,0,0,0.32)"; ctx.fillRect(bodyX + S(1), mpy + mh - S(9), bodyW - S(2), S(6));
    ctx.fillStyle = "#1a1c22"; ctx.fillRect(bodyX + S(4), mpy + mh - S(3), bodyW - S(8), S(3));
    // segment seams + rivets
    for (var seg = 1; seg < 3; seg++) {
      var sx = bodyX + (bodyW * seg / 3);
      ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = S(1.2);
      ctx.beginPath(); ctx.moveTo(sx, mpy + S(3)); ctx.lineTo(sx, mpy + mh - S(3)); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = S(0.6);
      ctx.beginPath(); ctx.moveTo(sx + S(1), mpy + S(3)); ctx.lineTo(sx + S(1), mpy + mh - S(3)); ctx.stroke();
      ctx.fillStyle = "#aab2c0";
      for (var rv = 0; rv < 5; rv++) { ctx.beginPath(); ctx.arc(sx - S(2.4), mpy + S(8) + rv * (mh - S(16)) / 4, S(0.9), 0, Math.PI * 2); ctx.fill(); }
    }
    // operator's cab window at the rear, glowing
    var cabX = tbm.dir > 0 ? bodyX + S(5) : bodyX + bodyW - S(17);
    ctx.fillStyle = "#15171d"; ctx.fillRect(cabX - S(1), mpy + S(8), S(14), S(9));
    var cabG = ctx.createLinearGradient(0, mpy + S(9), 0, mpy + S(16));
    cabG.addColorStop(0, "#ffe9a8"); cabG.addColorStop(1, "#e8a93c");
    ctx.fillStyle = cabG; ctx.fillRect(cabX, mpy + S(9), S(12), S(7));
    ctx.fillStyle = "#15171d"; ctx.fillRect(cabX + S(5.6), mpy + S(9), S(0.9), S(7));
    // hazard stripe band
    ctx.save();
    ctx.beginPath(); ctx.rect(bodyX + S(2), mpy + mh / 2 - S(3), bodyW - S(4), S(6)); ctx.clip();
    for (var hz = -1; hz < 12; hz++) {
      ctx.fillStyle = hz % 2 === 0 ? "#e8b84b" : "#1a1c22";
      ctx.beginPath();
      var hx = bodyX + hz * S(8);
      ctx.moveTo(hx, mpy + mh / 2 + S(3)); ctx.lineTo(hx + S(8), mpy + mh / 2 - S(3));
      ctx.lineTo(hx + S(16), mpy + mh / 2 - S(3)); ctx.lineTo(hx + S(8), mpy + mh / 2 + S(3));
      ctx.fill();
    }
    ctx.restore();
    // warning beacon
    var beacon = Math.sin(animFrame * 0.3) * 0.5 + 0.5;
    ctx.fillStyle = "rgba(255,120,40," + (0.4 + beacon * 0.6) + ")";
    ctx.beginPath(); ctx.arc(bodyX + bodyW / 2, mpy + S(1), S(3), Math.PI, 0); ctx.fill();

    // Cutter head: rotating disc with spokes and teeth
    var headR = TILE * 0.92;
    var cy2 = mpy + mh / 2;
    var ang = animFrame * 0.12 * tbm.dir;
    ctx.save();
    ctx.translate(headX, cy2);
    ctx.rotate(ang);
    ctx.fillStyle = "#4c535f";
    ctx.beginPath(); ctx.arc(0, 0, headR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#16191e"; ctx.lineWidth = S(2.4);
    ctx.beginPath(); ctx.arc(0, 0, headR, 0, Math.PI * 2); ctx.stroke();
    // six spoke arms, each carrying a row of disc cutters
    for (var sp = 0; sp < 6; sp++) {
      ctx.rotate(Math.PI / 3);
      ctx.fillStyle = "#2b3038";
      ctx.fillRect(-S(2.6), -headR + S(2), S(5.2), headR - S(2));
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.fillRect(-S(2.6), -headR + S(2), S(1.0), headR - S(2));
      for (var dc = 0; dc < 3; dc++) {
        var dcy = -headR * (0.34 + dc * 0.22);
        ctx.fillStyle = "#14161b"; ctx.beginPath(); ctx.arc(0, dcy, S(2.3), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#b9c0cc"; ctx.beginPath(); ctx.arc(0, dcy, S(1.5), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#5b626e"; ctx.beginPath(); ctx.arc(0, dcy, S(0.6), 0, Math.PI * 2); ctx.fill();
      }
    }
    // carbide teeth around the rim
    for (var th = 0; th < 12; th++) {
      ctx.rotate(Math.PI / 6);
      ctx.fillStyle = "#14161b"; ctx.fillRect(headR - S(5.2), -S(2.4), S(5.2), S(4.8));
      ctx.fillStyle = "#c9cfda"; ctx.fillRect(headR - S(4.4), -S(1.6), S(4.4), S(3.2));
    }
    ctx.fillStyle = "#16191e";
    ctx.beginPath(); ctx.arc(0, 0, headR * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#6b7380";
    ctx.beginPath(); ctx.arc(0, 0, headR * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // fixed shading over the spinning head so it reads as a lit dome
    var domeG = ctx.createRadialGradient(headX - headR * 0.35, cy2 - headR * 0.4, headR * 0.1, headX, cy2, headR);
    domeG.addColorStop(0, "rgba(255,255,255,0.22)"); domeG.addColorStop(0.5, "rgba(255,255,255,0)"); domeG.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = domeG;
    ctx.beginPath(); ctx.arc(headX, cy2, headR, 0, Math.PI * 2); ctx.fill();

    // Drilling sparks when the front face is against material
    var frontProbe = tbm.dir > 0 ? Math.floor(tbm.floatX + 3.05) : Math.floor(tbm.floatX - 0.05);
    if (frontProbe > 0 && frontProbe < s.cols - 1) {
      var grinding = false;
      for (var pr = tbm.y; pr <= tbm.y + 1; pr++) {
        var pt = s.grid[pr] && s.grid[pr][frontProbe];
        if (pt !== undefined && pt !== T.EMPTY && pt !== T.PLAYER) { grinding = true; break; }
      }
      if (grinding) {
        var sparkX = tbm.dir > 0 ? headX + headR : headX - headR;
        for (var sk = 0; sk < 4; sk++) {
          var skAng = (animFrame * 0.7 + sk * 1.7) % (Math.PI * 2);
          ctx.fillStyle = sk % 2 ? "rgba(255,190,80,0.9)" : "rgba(255,120,40,0.8)";
          ctx.fillRect(sparkX + Math.cos(skAng) * S(6) * tbm.dir, cy2 + Math.sin(skAng) * S(10), S(2), S(2));
        }
      }
    }
  }

  function drawTunnelBorers() {
    var borers = s.tbms || [];
    for (var i = 0; i < borers.length; i++) {
      var tbm = borers[i];
      if (!machineInSight(tbm.floatX, tbm.y, tbm.floatX + 2, tbm.y + 1)) continue;
      if (tbm.y < camTileY - 2 || tbm.y > camTileY + viewRows + 1 ||
          tbm.floatX + 3 < camTileX - 1 || tbm.floatX > camTileX + viewCols + 1) continue;
      drawTunnelBorer(tbm);
    }
  }

  // ─── Shaft lifts ───
  function drawShaftLifts() {
    if (s.shaftLifts) {
      for (var sli = 0; sli < s.shaftLifts.length; sli++) {
        var lift = s.shaftLifts[sli];
        if (!machineInSight(lift.x, lift.floatY, lift.x, lift.floatY)) continue;
        if (lift.x >= camTileX && lift.x < camTileX + viewCols + 1 && lift.floatY >= camTileY - 1 && lift.floatY < camTileY + viewRows + 1) {
          var slpx = (lift.x - camTileX) * TILE, slpy = (lift.floatY - camTileY) * TILE;
          drawShaftLift(slpx, slpy);
        }
      }
    }
  }

  // ─── Trivia question overlay ───
  // The quiz question written on the wall: the level's single question and
  // the question of every gate, each at its own place
  function drawQuizQuestion() {
    if (s.triviaPos && s.triviaQuestion) drawWallText(s.triviaPos, s.triviaQuestion);
    if (s.gates) {
      for (var gi = 0; gi < s.gates.length; gi++) {
        var g = s.gates[gi];
        if (g.pos && g.question) drawWallText(g.pos, g.question);
      }
    }
  }

  function drawWallText(pos, text) {
    var tx = pos.x, ty = pos.y;
    if (tx < camTileX || tx >= camTileX + viewCols + 1 || ty < camTileY || ty >= camTileY + viewRows + 1) return;
    if (!explored[ty] || !explored[ty][tx]) return;
    var gpx = (tx - camTileX) * TILE, gpy = (ty - camTileY) * TILE;
    ctx.save(); ctx.translate(gpx, gpy + TILE * 0.8); ctx.rotate(-0.06);
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.font = 'italic 700 ' + S(10) + 'px "DM Sans", sans-serif';
    ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    var words = text.split(" "), line = "", ly = 0;
    for (var n = 0; n < words.length; n++) {
      var testLine = line + words[n] + " ";
      var metrics = ctx.measureText(testLine);
      if (metrics.width > TILE * 5.5 && n > 0) { ctx.fillText(line, 0, ly); line = words[n] + " "; ly += S(16); }
      else { line = testLine; }
    }
    ctx.fillText(line, 0, ly); ctx.restore();
  }

  // ─── Fog radial gradient (skipped in editor preview mode) ───
  // How dark the frame is from the inner to the outer edge of the lamplight's
  // fall-off, in even steps (see drawFog)
  var FOG_FALL = [0, 0.06, 0.22, 0.45, 0.70, 0.93];
  var FOG_START = -0.6, FOG_EDGE = 1.14;   // in tiles, measured from the sight radius

  function drawFog() {
    var ppx = (playerX - camTileX) * TILE + TILE / 2, ppy = (playerY - camTileY) * TILE + TILE / 2;
    var fogR = sightR * TILE;
    // the canvas is still shifted by the sub-tile scroll, so every overlay
    // here is a tile larger than the view on each side
    var ovX = -TILE, ovY = -TILE, ovW = canvas.width + TILE * 2, ovH = canvas.height + TILE * 2;
    if (!s.previewMode) {
      // The lamplight: full brightness to just inside the sight radius, then
      // a smooth fall to near-darkness a good tile beyond it, the level at
      // which remembered cells are shown. Centred on the miner as drawn, so
      // the pool of light glides with them instead of stepping tile by tile.
      var fog0 = Math.max(0, sightR + FOG_START) * TILE, fog1 = (sightR + FOG_EDGE) * TILE;
      var grad = ctx.createRadialGradient(ppx, ppy, fog0, ppx, ppy, fog1);
      for (var fi = 0; fi < FOG_FALL.length; fi++) grad.addColorStop(fi / (FOG_FALL.length - 1), "rgba(6,8,16," + FOG_FALL[fi] + ")");
      ctx.fillStyle = grad; ctx.fillRect(ovX, ovY, ovW, ovH);
    }

    if (activeEffects.lamp > 0) {
      var lglow = ctx.createRadialGradient(ppx, ppy, 0, ppx, ppy, fogR * 0.5);
      lglow.addColorStop(0, "rgba(255,255,170,0.04)"); lglow.addColorStop(1, "rgba(255,255,170,0)");
      ctx.fillStyle = lglow; ctx.fillRect(ovX, ovY, ovW, ovH);
    }

    // ─── Gas exposure: green vignette closing in as you suffocate ───
    if (s.gasExposure > 0 && !s.previewMode) {
      var gxAlpha = Math.min(0.75, s.gasExposure * 0.8);
      var gxR = Math.max(canvas.width, canvas.height) * (0.95 - s.gasExposure * 0.35);
      var gxGrad = ctx.createRadialGradient(ppx, ppy, gxR * 0.35, ppx, ppy, gxR);
      gxGrad.addColorStop(0, "rgba(60,160,80,0)");
      gxGrad.addColorStop(0.7, "rgba(60,160,80," + (gxAlpha * 0.4).toFixed(3) + ")");
      gxGrad.addColorStop(1, "rgba(30,90,45," + gxAlpha.toFixed(3) + ")");
      ctx.fillStyle = gxGrad; ctx.fillRect(ovX, ovY, ovW, ovH);
    }
    if (activeEffects.mask > 0 && !s.previewMode) {
      // faint goggle tint while the mask is sealed
      ctx.fillStyle = "rgba(120,232,122,0.035)";
      ctx.fillRect(ovX, ovY, ovW, ovH);
    }
  }

  // ─── Dig particles ───
  function drawDigParticles() {
    for (var di = digParticles.length - 1; di >= 0; di--) {
      var dp = digParticles[di];
      dp.life -= dp.decay * frameStep;
      if (dp.life <= 0) { digParticles.splice(di, 1); continue; }
      dp.x += dp.vx * 0.12 * frameStep;
      dp.y += dp.vy * 0.12 * frameStep;
      dp.vy += dp.gravity * frameStep;
      var drag = Math.pow(0.96, frameStep);
      dp.vx *= drag;
      dp.vy *= drag;
      var dpx = (dp.x - camTileX) * TILE + TILE / 2;
      var dpy = (dp.y - camTileY) * TILE + TILE / 2;
      ctx.globalAlpha = dp.life * 0.8;
      ctx.fillStyle = dp.color;
      var dsz = S(dp.size) * (0.5 + dp.life * 0.5);
      // a tumbling chip: an uneven four-sided flake, spinning as it flies
      if (dp.rot === undefined) { dp.rot = Math.random() * 6.283; dp.spin = (Math.random() - 0.5) * 0.5; }
      dp.rot += dp.spin * frameStep;
      var chipC = Math.cos(dp.rot) * dsz * 0.66, chipS = Math.sin(dp.rot) * dsz * 0.66;
      ctx.beginPath();
      ctx.moveTo(dpx + chipC, dpy + chipS); ctx.lineTo(dpx - chipS * 0.62, dpy + chipC * 0.62);
      ctx.lineTo(dpx - chipC * 0.8, dpy - chipS * 0.8); ctx.lineTo(dpx + chipS * 0.7, dpy - chipC * 0.7);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ─── Explosion effects ───
  function drawExplosions() {
    var now = Date.now();
    for (var i = explosionEffects.length - 1; i >= 0; i--) {
      var fx = explosionEffects[i]; var lifeTime = now - fx.startTime; var maxLife = fx.toxic ? 1000 : 800;
      if (lifeTime >= maxLife) { explosionEffects.splice(i, 1); continue; }
      // a burning gas cloud starts its flames one after another: a flame whose
      // time has not come yet is not drawn (a negative radius is an error)
      if (lifeTime < 0) continue;
      var fpx = (fx.x - camTileX) * TILE + TILE / 2, fpy = (fx.y - camTileY) * TILE + TILE / 2;
      var life = 1 - (lifeTime / maxLife);
      var phase = lifeTime / maxLife;

      if (fx.toxic) {
        // ─── Toxic green cloud explosion ───
        // Green flash (left out with "Effects: Reduced")
        if (phase < 0.12 && !s.reducedFx) {
          var tFlashA = (1 - phase / 0.12) * 0.5;
          ctx.fillStyle = "rgba(80,255,80," + tFlashA + ")";
          ctx.fillRect(fpx - TILE * 1.5, fpy - TILE * 1.5, TILE * 3, TILE * 3);
        }

        // Toxic cloud core - expanding green radial gradient
        if (phase < 0.7) {
          var tCoreSize = TILE * (0.6 + phase * 2.5);
          var tCoreA = (1 - phase / 0.7) * 0.85;
          var tGrad = ctx.createRadialGradient(fpx, fpy, 0, fpx, fpy, tCoreSize);
          tGrad.addColorStop(0, "rgba(180,255,140," + tCoreA + ")");
          tGrad.addColorStop(0.3, "rgba(80,220,60," + (tCoreA * 0.7) + ")");
          tGrad.addColorStop(0.6, "rgba(40,160,30," + (tCoreA * 0.4) + ")");
          tGrad.addColorStop(1, "rgba(20,80,10,0)");
          ctx.fillStyle = tGrad;
          ctx.beginPath(); ctx.arc(fpx, fpy, tCoreSize, 0, Math.PI * 2); ctx.fill();
        }

        // Toxic shockwave ring
        if (phase > 0.02 && phase < 0.5) {
          var tRingR = (phase / 0.5) * TILE * 3;
          var tRingA = (1 - phase / 0.5) * 0.55;
          ctx.strokeStyle = "rgba(100,255,80," + tRingA + ")";
          ctx.lineWidth = S(3) * (1 - phase / 0.5);
          ctx.beginPath(); ctx.arc(fpx, fpy, tRingR, 0, Math.PI * 2); ctx.stroke();
        }

        // Toxic particles (droplets, mist, shards)
        if (fx.particles) {
          for (var p = 0; p < fx.particles.length; p++) {
            var pt = fx.particles[p];
            var pDist = pt.speed * phase * TILE * 2.5 * Math.pow(pt.drag, phase * 25);
            var ppx = fpx + Math.cos(pt.angle) * pDist;
            var ppy = fpy + Math.sin(pt.angle) * pDist + (pt.type === "shard" ? phase * phase * TILE * 1.5 : -phase * TILE * 0.3);
            var pAlpha = Math.max(0, life * 0.9);
            if (pAlpha <= 0) continue;
            ctx.save();
            ctx.translate(ppx, ppy);
            ctx.globalAlpha = Math.min(1, pAlpha);
            ctx.fillStyle = pt.color;
            if (pt.type === "droplet") {
              ctx.beginPath(); ctx.arc(0, 0, S(pt.size) * life, 0, Math.PI * 2); ctx.fill();
            } else if (pt.type === "mist") {
              ctx.globalAlpha = Math.min(1, pAlpha * 0.5);
              ctx.beginPath(); ctx.arc(0, 0, S(pt.size * 1.8) * (0.5 + phase * 0.5), 0, Math.PI * 2); ctx.fill();
            } else {
              ctx.rotate(pt.rot + pt.rotSpeed * phase);
              ctx.fillRect(-S(pt.size * 0.5), -S(pt.size * 0.3), S(pt.size), S(pt.size * 0.6));
            }
            ctx.restore();
          }
        }

        // Toxic smoke - lingering green haze rising upwards
        if (phase > 0.15) {
          var tSmokeP = (phase - 0.15) / 0.85;
          for (var si = 0; si < 5; si++) {
            var tsa = si * Math.PI * 2 / 5 + phase * 0.3;
            var tsr = tSmokeP * TILE * 2.0;
            var tspx = fpx + Math.cos(tsa) * tsr;
            var tspy = fpy + Math.sin(tsa) * tsr - tSmokeP * TILE * 1.5;
            var tSmokeA = (1 - tSmokeP) * 0.3;
            ctx.fillStyle = "rgba(50,140,40," + tSmokeA + ")";
            ctx.beginPath(); ctx.arc(tspx, tspy, S(6 + tSmokeP * 8), 0, Math.PI * 2); ctx.fill();
          }
        }

      } else {
      // ─── Normal dynamite explosion ───

      // Flash - bright white burst at start (left out with "Effects: Reduced")
      if (phase < 0.1 && !s.reducedFx) {
        var flashAlpha = 1 - phase / 0.1;
        ctx.fillStyle = "rgba(255,255,255," + (flashAlpha * 0.65) + ")";
        ctx.fillRect(fpx - TILE * 2.5, fpy - TILE * 2.5, TILE * 5, TILE * 5);
      }

      // Fireball core - radial gradient
      if (phase < 0.5) {
        var coreSize = TILE * (0.8 + phase * 3.2);
        var coreAlpha = (1 - phase / 0.5) * 0.9;
        var grad = ctx.createRadialGradient(fpx, fpy, 0, fpx, fpy, coreSize);
        grad.addColorStop(0, "rgba(255,255,200," + coreAlpha + ")");
        grad.addColorStop(0.3, "rgba(255,160,40," + (coreAlpha * 0.8) + ")");
        grad.addColorStop(0.6, "rgba(255,60,0," + (coreAlpha * 0.5) + ")");
        grad.addColorStop(1, "rgba(80,20,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(fpx, fpy, coreSize, 0, Math.PI * 2); ctx.fill();
      }

      // Shockwave rings
      for (var ring = 0; ring < 3; ring++) {
        var ringDelay = ring * 0.08;
        var ringPhase = Math.max(0, phase - ringDelay);
        if (ringPhase > 0 && ringPhase < 0.6) {
          var ringR = ringPhase / 0.6 * TILE * 4;
          var ringAlpha = (1 - ringPhase / 0.6) * (ring === 0 ? 0.7 : ring === 1 ? 0.4 : 0.25);
          ctx.strokeStyle = ring === 0 ? "rgba(255,120,20," + ringAlpha + ")" : ring === 1 ? "rgba(255,200,80," + ringAlpha + ")" : "rgba(255,240,150," + ringAlpha + ")";
          ctx.lineWidth = S(3.5 - ring) * (1 - ringPhase / 0.6);
          ctx.beginPath(); ctx.arc(fpx, fpy, ringR, 0, Math.PI * 2); ctx.stroke();
        }
      }

      // Particles - debris, sparks, embers
      if (fx.particles) {
        for (var p = 0; p < fx.particles.length; p++) {
          var pt = fx.particles[p];
          var pDist = pt.speed * phase * TILE * 3 * Math.pow(pt.drag, phase * 30);
          var ppx = fpx + Math.cos(pt.angle) * pDist;
          var ppy = fpy + Math.sin(pt.angle) * pDist + (pt.type === "shard" ? phase * phase * TILE * 2 : 0);
          var pAlpha = Math.max(0, life * (pt.type === "spark" ? 1.2 : 0.9));
          if (pAlpha <= 0) continue;
          ctx.save();
          ctx.translate(ppx, ppy);
          ctx.rotate(pt.rot + pt.rotSpeed * phase);
          ctx.globalAlpha = Math.min(1, pAlpha);
          ctx.fillStyle = pt.color;
          if (pt.type === "spark") {
            ctx.fillRect(-S(0.5), -S(pt.size), S(1), S(pt.size * 2));
          } else if (pt.type === "ember") {
            ctx.beginPath(); ctx.arc(0, 0, S(pt.size) * life, 0, Math.PI * 2); ctx.fill();
          } else {
            ctx.fillRect(-S(pt.size * 0.5), -S(pt.size * 0.3), S(pt.size), S(pt.size * 0.6));
          }
          ctx.restore();
        }
      }

      // Smoke wisps
      if (phase > 0.2) {
        var smokePhase = (phase - 0.2) / 0.8;
        for (var si = 0; si < 7; si++) {
          var sa = si * Math.PI * 2 / 7 + phase * 0.5;
          var sr = smokePhase * TILE * 2.5;
          var spx = fpx + Math.cos(sa) * sr;
          var spy = fpy + Math.sin(sa) * sr - smokePhase * TILE * 1.0;
          var smokeAlpha = (1 - smokePhase) * 0.25;
          ctx.fillStyle = "rgba(80,60,40," + smokeAlpha + ")";
          ctx.beginPath(); ctx.arc(spx, spy, S(5 + smokePhase * 7), 0, Math.PI * 2); ctx.fill();
        }
      }

      } // end normal explosion
    }
  }

  // ─── Element collection burst: flash, ring, flying glints, score pop ───
  function drawCollectBursts() {
    var collectFx = s.collectEffects || [];
    var cNow = Date.now();
    for (var ci = collectFx.length - 1; ci >= 0; ci--) {
      var cf = collectFx[ci], cAge = cNow - cf.start, cLife = cf.bonus ? 1150 : 950;
      if (cAge >= cLife) { collectFx.splice(ci, 1); continue; }
      var cu = cAge / cLife, cRgb = hexRgb(cf.color);
      var ccx = (cf.x - camTileX) * TILE + TILE / 2, ccy = (cf.y - camTileY) * TILE + TILE / 2;
      if (!cf.parts) {
        cf.parts = [];
        var cCount = cf.bonus ? 18 : 12;
        for (var cp = 0; cp < cCount; cp++) {
          cf.parts.push({ a: (cp / cCount) * Math.PI * 2 + Math.random() * 0.5, d: 0.75 + Math.random() * 0.85, r: 2.2 + Math.random() * 2.4, white: cp % 3 === 0 });
        }
      }
      // flash
      if (cu < 0.22 && !s.reducedFx) {
        var cFlash = ctx.createRadialGradient(ccx, ccy, 0, ccx, ccy, TILE * 1.1);
        cFlash.addColorStop(0, "rgba(255,255,255," + (0.85 * (1 - cu / 0.22)) + ")");
        cFlash.addColorStop(0.4, "rgba(" + cRgb + "," + (0.5 * (1 - cu / 0.22)) + ")");
        cFlash.addColorStop(1, "rgba(" + cRgb + ",0)");
        ctx.fillStyle = cFlash; ctx.fillRect(ccx - TILE * 1.1, ccy - TILE * 1.1, TILE * 2.2, TILE * 2.2);
      }
      // expanding ring
      var cEase = 1 - Math.pow(1 - Math.min(cu / 0.6, 1), 3);
      if (cu < 0.6) {
        ctx.strokeStyle = "rgba(" + cRgb + "," + (0.9 * (1 - cu / 0.6)) + ")"; ctx.lineWidth = S(2.4) * (1 - cu / 0.6) + S(0.4);
        ctx.beginPath(); ctx.arc(ccx, ccy, TILE * (0.3 + cEase * (cf.bonus ? 1.25 : 0.95)), 0, Math.PI * 2); ctx.stroke();
      }
      // glints flying outward, slowing and shrinking
      var cOut = 1 - Math.pow(1 - Math.min(cu / 0.8, 1), 2.4);
      for (var cq = 0; cq < cf.parts.length; cq++) {
        var cpt = cf.parts[cq], cFade = Math.max(0, 1 - cu / 0.85);
        if (cFade <= 0) continue;
        drawSparkle(ccx + Math.cos(cpt.a) * cpt.d * TILE * cOut, ccy + Math.sin(cpt.a) * cpt.d * TILE * cOut - cOut * S(3),
          S(cpt.r) * (0.35 + cFade * 0.65), cpt.white ? "rgba(255,255,255," + cFade + ")" : "rgba(" + cRgb + "," + cFade + ")");
      }
      // score pop rising from the spot
      var cRise = 1 - Math.pow(1 - cu, 2.2), cPop = cu < 0.14 ? 0.6 + (cu / 0.14) * 0.55 : 1.15 - Math.min((cu - 0.14) / 0.12, 1) * 0.15;
      ctx.save();
      ctx.translate(ccx, ccy - S(6) - cRise * TILE * 0.95); ctx.scale(cPop, cPop);
      ctx.globalAlpha = cu < 0.7 ? 1 : Math.max(0, 1 - (cu - 0.7) / 0.3);
      ctx.font = 'bold ' + S(cf.bonus ? 9 : 8) + 'px "Press Start 2P",monospace'; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineWidth = S(2.6); ctx.strokeStyle = "rgba(6,8,16,0.9)"; ctx.lineJoin = "round";
      var cText = (cf.bonus ? "★ " : "") + cf.symbol + " +" + cf.pts;
      ctx.strokeText(cText, 0, 0);
      ctx.fillStyle = cf.color; ctx.fillText(cText, 0, 0);
      ctx.restore(); ctx.textBaseline = "alphabetic";
    }
  }

  // ─── Crush effects ───
  function drawCrushEffects() {
    var now = Date.now();
    for (var i = crushEffects.length - 1; i >= 0; i--) {
      var fx2 = crushEffects[i]; var lifeTime = now - fx2.startTime; var maxLife = 1500;
      if (lifeTime >= maxLife) { crushEffects.splice(i, 1); continue; }
      var fpx2 = (fx2.x - camTileX) * TILE, fpy2 = (fx2.y - camTileY) * TILE;
      var life = 1 - (lifeTime / maxLife);
      var phase = lifeTime / maxLife;
      var cx2 = fpx2 + TILE / 2, cy2 = fpy2 + TILE * 0.75;

      // Impact flash - bright burst at point of crush (left out with "Effects: Reduced")
      if (phase < 0.06 && !s.reducedFx) {
        var flashA = (1 - phase / 0.06) * 0.7;
        var flashR = TILE * 1.8;
        var flashG = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, flashR);
        flashG.addColorStop(0, "rgba(255,255,220," + flashA + ")");
        flashG.addColorStop(0.5, "rgba(255,200,100," + (flashA * 0.4) + ")");
        flashG.addColorStop(1, "rgba(255,150,50,0)");
        ctx.fillStyle = flashG;
        ctx.beginPath(); ctx.arc(cx2, cy2, flashR, 0, Math.PI * 2); ctx.fill();
      }

      // Dust cloud - expands outward and fades
      if (phase > 0.02 && phase < 0.7) {
        var dustP = (phase - 0.02) / 0.68;
        var dustR = TILE * (0.4 + dustP * 1.6);
        var dustA = (1 - dustP) * 0.35;
        ctx.fillStyle = "rgba(120,100,80," + dustA + ")";
        ctx.beginPath(); ctx.arc(cx2, cy2, dustR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(160,140,110," + (dustA * 0.5) + ")";
        ctx.beginPath(); ctx.arc(cx2 + S(3), cy2 - S(4), dustR * 0.6, 0, Math.PI * 2); ctx.fill();
      }

      // Squashed body - dramatic squash with bounce
      ctx.save(); ctx.globalAlpha = life;
      var squash;
      if (phase < 0.08) squash = 1 - phase / 0.08 * 0.75;
      else if (phase < 0.15) squash = 0.25 + (phase - 0.08) / 0.07 * 0.15;
      else if (phase < 0.22) squash = 0.4 - (phase - 0.15) / 0.07 * 0.1;
      else squash = 0.3;
      var stretch = 1 + (1 - squash) * 0.5;
      ctx.translate(cx2, cy2); ctx.scale(stretch, squash);

      if (fx2.type === "bat") {
        ctx.strokeStyle = "#c8c8d8"; ctx.lineWidth = S(1.5); ctx.lineCap = "round";
        for (var bside = -1; bside <= 1; bside += 2) {
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(bside * S(16), -S(4)); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(bside * S(12), S(6)); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(bside * S(16), -S(4)); ctx.lineTo(bside * S(12), S(6)); ctx.stroke();
        }
        ctx.fillStyle = "#d0d0e0"; ctx.beginPath(); ctx.arc(0, -S(6), S(4), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#0e0e16";
        ctx.beginPath(); ctx.arc(-S(1.5), -S(6.5), S(1.2), 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(S(1.5), -S(6.5), S(1.2), 0, Math.PI * 2); ctx.fill();
      } else if (fx2.type === "spider") {
        ctx.strokeStyle = "#b0a0c8"; ctx.lineWidth = S(1.5); ctx.lineCap = "round";
        for (var sli = 0; sli < 8; sli++) {
          var sside = (sli < 4) ? -1 : 1; var srow = sli % 4;
          var srootX = sside * S(3), srootY = (srow - 1.5) * S(3);
          var skneeX = srootX + sside * S(8) + S((srow - 1.5) * 2), skneeY = srootY + S(5);
          var sfootX = skneeX + sside * S(3), sfootY = skneeY + S(6);
          ctx.beginPath(); ctx.moveTo(srootX, srootY); ctx.lineTo(skneeX, skneeY); ctx.lineTo(sfootX, sfootY); ctx.stroke();
        }
        ctx.fillStyle = "#c8b8e0"; ctx.beginPath(); ctx.arc(0, -S(4), S(4), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#0e0e16";
        ctx.beginPath(); ctx.arc(-S(1.5), -S(4.5), S(1.2), 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(S(1.5), -S(4.5), S(1.2), 0, Math.PI * 2); ctx.fill();
      } else if (fx2.type === "snake") {
        ctx.strokeStyle = "#88cc88"; ctx.lineWidth = S(2); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(S(10), -S(4)); ctx.quadraticCurveTo(S(4), S(4), -S(2), S(2)); ctx.quadraticCurveTo(-S(8), 0, -S(12), -S(6)); ctx.stroke();
        ctx.fillStyle = "#88ee88"; ctx.beginPath(); ctx.arc(S(10), -S(5), S(4), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#0e0e16";
        ctx.beginPath(); ctx.arc(S(11.5), -S(5.5), S(1.2), 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(S(8.5), -S(5.5), S(1.2), 0, Math.PI * 2); ctx.fill();
      } else if (fx2.type === "crab") {
        ctx.strokeStyle = "#e8a070"; ctx.lineWidth = S(1.5); ctx.lineCap = "round";
        for (var cside = -1; cside <= 1; cside += 2) {
          ctx.beginPath(); ctx.moveTo(cside * S(6), 0); ctx.lineTo(cside * S(12), S(5)); ctx.lineTo(cside * S(14), S(3)); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cside * S(12), S(5)); ctx.lineTo(cside * S(14), S(8)); ctx.stroke();
        }
        for (var cli = 0; cli < 3; cli++) { for (var clside = -1; clside <= 1; clside += 2) { ctx.beginPath(); ctx.moveTo(clside * S(3), S(cli * 2)); ctx.lineTo(clside * S(10), S(cli * 3 + 6)); ctx.stroke(); } }
        ctx.fillStyle = "#c8784a"; ctx.beginPath(); ctx.ellipse(0, -S(2), S(7), S(5), 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#0e0e16";
        ctx.beginPath(); ctx.arc(-S(2.5), -S(3), S(1.2), 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(S(2.5), -S(3), S(1.2), 0, Math.PI * 2); ctx.fill();
      } else if (fx2.type === "cart" || fx2.type === "cart_bounce" || fx2.type === "shaft_lift") {
        ctx.scale(1 / stretch, 1 / squash); ctx.scale(1, 0.4);
        var flatH = S(4) + phase * S(3);
        ctx.fillStyle = "#2a2a38"; ctx.fillRect(-TILE / 2 + S(2), -flatH / 2, TILE - S(4), flatH);
        ctx.strokeStyle = "#555566"; ctx.lineWidth = S(1.5);
        ctx.beginPath(); ctx.moveTo(-TILE / 2 + S(2), -flatH / 2); ctx.lineTo(TILE / 2 - S(2), -flatH / 2); ctx.stroke();
        var wAngle = phase * Math.PI * 0.4;
        for (var wside = -1; wside <= 1; wside += 2) {
          ctx.save(); ctx.translate(wside * S(10), 0); ctx.rotate(wside * wAngle);
          ctx.strokeStyle = "#444"; ctx.lineWidth = S(3); ctx.beginPath(); ctx.arc(0, 0, S(4), 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = "#666"; ctx.lineWidth = S(1.5);
          ctx.beginPath(); ctx.moveTo(-S(3), 0); ctx.lineTo(S(3), 0); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, -S(3)); ctx.lineTo(0, S(3)); ctx.stroke();
          ctx.restore();
        }
      } else {
        ctx.fillStyle = "#d0d0d8"; ctx.beginPath(); ctx.arc(0, -S(5), S(5), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#0e0e16";
        ctx.beginPath(); ctx.arc(-S(2), -S(5.5), S(1.5), 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(S(2), -S(5.5), S(1.5), 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      // Flying debris particles
      if (fx2.particles) {
        for (var cp = 0; cp < fx2.particles.length; cp++) {
          var cpt = fx2.particles[cp];
          var cpDist = cpt.speed * phase * TILE * 2.5;
          var cpx = cx2 + Math.cos(cpt.angle) * cpDist;
          var cpy = cy2 + Math.sin(cpt.angle) * cpDist + phase * phase * TILE * 1.5;
          var cpA = Math.max(0, life * 1.2);
          if (cpA <= 0) continue;
          ctx.save();
          ctx.translate(cpx, cpy);
          ctx.rotate(cpt.rot + cpt.rotSpd * phase);
          ctx.globalAlpha = Math.min(1, cpA);
          ctx.fillStyle = cpt.color;
          var cpSz = S(cpt.size) * (0.7 + life * 0.3);
          ctx.fillRect(-cpSz * 0.5, -cpSz * 0.3, cpSz, cpSz * 0.6);
          ctx.restore();
        }
      }

      // Impact stars (brief sparkle burst)
      if (phase < 0.25) {
        var starA = (1 - phase / 0.25) * 0.8;
        ctx.strokeStyle = "rgba(255,255,200," + starA + ")";
        ctx.lineWidth = S(1.2);
        for (var si2 = 0; si2 < 6; si2++) {
          var sa2 = si2 * Math.PI / 3 + phase * 2;
          var sInner = S(3) + phase * S(8);
          var sOuter = S(8) + phase * S(20);
          ctx.beginPath();
          ctx.moveTo(cx2 + Math.cos(sa2) * sInner, cy2 + Math.sin(sa2) * sInner);
          ctx.lineTo(cx2 + Math.cos(sa2) * sOuter, cy2 + Math.sin(sa2) * sOuter);
          ctx.stroke();
        }
      }
    }
  }

  // ─── Minimap ───
  function drawMinimap() {
    if (COLS > VP_COLS || ROWS > VP_ROWS) {
      // in screen pixels: a phone's canvas has two canvas pixels to each of them
      var dens = canvas.clientWidth ? Math.max(1, Math.round(canvas.width / canvas.clientWidth)) : 1;
      var mmS = Math.max(1, Math.min(3, Math.floor(100 / COLS))) * dens;
      var mmW = COLS * mmS, mmH = ROWS * mmS;
      var mmX = canvas.width - mmW - 8 * dens, mmY = 8 * dens;
      ctx.fillStyle = "rgba(6,8,16,0.85)"; ctx.fillRect(mmX - 2, mmY - 2, mmW + 4, mmH + 4);
      ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1; ctx.strokeRect(mmX - 2, mmY - 2, mmW + 4, mmH + 4);
      for (var my = 0; my < ROWS; my++) for (var mx = 0; mx < COLS; mx++) {
        if (!explored[my][mx]) continue;
        var mt = seenTile[my][mx];
        var mc = mt === T.WALL ? "#252540" : mt === T.EARTH || mt === T.EARTH_RICH || mt === T.HIDDEN_ELEM || mt === T.WATER_SRC || mt === T.LAVA_SRC ? "#3a2810" : mt === T.ROCK ? "#4a4a5a" : mt === T.ICE ? "#8ac8e8" : mt === T.BOULDER ? "#6a6a7a" : mt === T.WATER ? "#1a4a80" : mt === T.LAVA ? "#c03000" : mt === T.HAZARD ? "#205020" : mt === T.ROLL_BARREL ? "#305020" : mt === T.SPIDER_NEST ? "#3a1848" : mt === T.BASALT ? "#4a4a5a" : mt === T.ELEMENT ? "#e8b84b" : mt === T.EXIT ? "#4ae87a" : "#0e0e16";
        ctx.fillStyle = mc; ctx.fillRect(mmX + mx * mmS, mmY + my * mmS, mmS, mmS);
      }
      ctx.fillStyle = "#e8b84b"; ctx.fillRect(mmX + playerTileX * mmS - 1, mmY + playerTileY * mmS - 1, mmS + 2, mmS + 2);
      if (explored[exitY] && explored[exitY][exitX]) { ctx.fillStyle = "#4ae87a"; ctx.fillRect(mmX + exitX * mmS, mmY + exitY * mmS, mmS, mmS); }
      ctx.strokeStyle = "rgba(232,184,75,0.6)"; ctx.lineWidth = 1;
      ctx.strokeRect(mmX + camTileX * mmS, mmY + camTileY * mmS, viewCols * mmS, viewRows * mmS);
    }
  }

  // ─── One frame ───
  // Animation is paced by the clock, not by the number of frames drawn: a
  // 120 Hz screen draws twice as often as a 60 Hz one and must not animate
  // twice as fast. frameStep is the time since the last frame in 60ths of a
  // second (1 on a 60 Hz screen, 0.5 at 120 Hz), capped after a long gap.
  var FRAME_MS = 1000 / 60, lastFrameAt = 0, frameStep = 1;
  // a per-frame easing factor (tuned at 60 Hz) for the time that really passed
  function ease(perFrame) { return 1 - Math.pow(1 - perFrame, frameStep); }

  function render(frameTime) {
    if (isRenderingFrame) return;
    isRenderingFrame = true;
    try {
      if (s.renderReq) cancelAnimationFrame(s.renderReq);
      if (s.running && Game.loop && typeof Game.loop.tickInput === "function") Game.loop.tickInput(frameTime);
      var frameNow = frameTime || performance.now();
      frameStep = lastFrameAt ? Math.max(0, Math.min((frameNow - lastFrameAt) / FRAME_MS, 3)) : 1;
      lastFrameAt = frameNow;
      s.animFrame += frameStep;
      gfx.begin(s.ctx, s.tile, s.animFrame);

      beginFrame(frameTime);
      drawCells();
      drawSlidingTiles();
      drawPlacedDynamite();
      drawCreatures();
      drawMiner();
      drawPumps();
      drawRollingBarrels();
      drawRollingCarts();
      drawRunawayCarts();
      drawTunnelBorers();
      drawShaftLifts();
      drawQuizQuestion();
      drawTouchAim();
      drawFog();
      drawDigParticles();
      drawExplosions();
      drawCollectBursts();
      drawCrushEffects();
      ctx.restore();   // end of the shake / scroll transform

      drawMinimap();

      if (s.running) s.renderReq = requestAnimationFrame(render);
    } finally {
      isRenderingFrame = false;
    }
  }

  // Draw one game sprite into another canvas, using the same drawing code as
  // the game. The menu and field guide use it for their pictures (sprite at
  // 70% of the canvas, transparent around it); the level editor passes
  // fill = true to get a whole tile, edge to edge, on the cave background.
  // Borrows the drawing state for the duration of the call and puts it back.
  function drawIcon(canvas, kind, fill) {
    var c2 = canvas.getContext("2d"); if (!c2) return;
    var size = canvas.width, keep = { ctx: ctx, TILE: TILE, tile: s.tile, par: gfx.parallax, gx: gfx.cellX, gy: gfx.cellY };
    s.tile = fill ? size : Math.round(size * 0.7); gfx.parallax = false; gfx.cellX = 3; gfx.cellY = 5;
    gfx.begin(c2, s.tile, gfx.animFrame);
    var px = Math.round((size - TILE) / 2), py = Math.round((size - TILE) / 2);
    // painters that look at neighbouring cells see an empty room
    var keepGrid = grid, room = [];
    for (var ry = 0; ry < 4; ry++) room.push([0, 0, 0, 0]);
    grid = room;
    var problem = null;
    var foe = { x: 0, y: 0, floatX: 0, floatY: 0, state: AI_PATROL, animOffset: 0.6, aggroGlow: 0, fDir: 1, alive: true };
    try {
      c2.clearRect(0, 0, size, size);
      if (fill) { c2.fillStyle = "#0e0e16"; c2.fillRect(0, 0, size, size); }
      switch (kind) {
        case "miner":
          var mf = playerSprites.idle.south[0];
          if (mf && mf.ready) {
            // the figure occupies the middle of its 112px frame: enlarge so it fills the icon
            var k = size / 60, was = c2.imageSmoothingEnabled;
            c2.imageSmoothingEnabled = false;
            c2.fillStyle = "rgba(0,0,0,0.35)";
            c2.beginPath(); c2.ellipse(size / 2, size * 0.93, size * 0.26, size * 0.05, 0, 0, Math.PI * 2); c2.fill();
            c2.drawImage(mf.image, size / 2 - 55 * k, size / 2 - 55.5 * k, 112 * k, 112 * k);
            c2.imageSmoothingEnabled = was;
            canvas.setAttribute("data-drawn", "1");
          }
          break;
        case "bat": drawBat(px, py + S(2), foe); break;
        case "spider": drawSpider(px, py, foe); break;
        case "crab": drawCrab(px, py + S(3), foe); break;
        case "snake": foe.slitherUntil = Infinity; drawSnake(px, py - S(2), foe); break;
        case "boulder": drawBoulderBody(px, py, 0); break;
        case "earth": drawTerrain("earth", px, py); break;
        case "rock": drawTerrain("rock", px, py); break;
        case "ice": drawTerrain("ice", px, py); break;
        case "basalt": drawTerrain("basalt", px, py); break;
        case "water": drawLiquid(px, py, 0, -1, false); break;
        case "lava": drawLiquid(px, py, 0, -1, true); break;
        case "barrel": drawToxicWaste(px, py, 0, 0); break;
        case "cart": drawMinecart(px, py, { ore: true }); break;
        case "roguecart": drawMinecart(px, py, { rogue: true }); break;
        case "lift": drawShaftLift(px, py); break;
        case "key": drawKey(px, py, 0, 0); break;
        case "door": drawDoor(px, py); break;
        case "logicdoor": drawLogicDoor(px, py); break;
        case "exit": drawExit(px, py, true); break;
        case "gem":
          var gx = px + TILE / 2, gy = py + TILE / 2;
          c2.fillStyle = "rgba(0,0,0,0.45)";
          c2.beginPath(); c2.moveTo(gx, py + S(2)); c2.lineTo(px + TILE - S(4), gy); c2.lineTo(gx, py + TILE - S(2)); c2.lineTo(px + S(4), gy); c2.closePath(); c2.fill();
          c2.fillStyle = "#d4884a";
          c2.beginPath(); c2.moveTo(gx, py + S(3)); c2.lineTo(px + TILE - S(5), gy); c2.lineTo(gx, py + TILE - S(3)); c2.lineTo(px + S(5), gy); c2.closePath(); c2.fill();
          c2.fillStyle = "rgba(255,255,255,0.38)";
          c2.beginPath(); c2.moveTo(gx, py + S(3)); c2.lineTo(px + S(5), gy); c2.lineTo(gx, gy); c2.closePath(); c2.fill();
          c2.fillStyle = "rgba(0,0,0,0.25)";
          c2.beginPath(); c2.moveTo(gx, gy); c2.lineTo(px + TILE - S(5), gy); c2.lineTo(gx, py + TILE - S(3)); c2.closePath(); c2.fill();
          c2.strokeStyle = "rgba(255,255,255,0.42)"; c2.lineWidth = S(0.8); c2.lineJoin = "round";
          c2.beginPath(); c2.moveTo(gx, py + S(3)); c2.lineTo(px + TILE - S(5), gy); c2.lineTo(gx, py + TILE - S(3)); c2.lineTo(px + S(5), gy); c2.closePath(); c2.stroke();
          drawSymbol("Cu", gx, gy + S(1));
          drawSparkle(gx - S(8), py + S(7), S(3.4), "rgba(255,255,255,0.95)");
          break;
        case "empty": drawCaveBg(px, py); break;
        case "wall": drawTerrain("wall", px, py); break;
        case "rich": drawTerrain("rich", px, py); break;
        case "watersrc": drawTerrain("earth", px, py); c2.fillStyle = "rgba(60,140,255,0.38)"; c2.fillRect(px, py, TILE, TILE); break;
        case "lavasrc": drawTerrain("earth", px, py); c2.fillStyle = "rgba(255,90,20,0.42)"; c2.fillRect(px, py, TILE, TILE); break;
        case "rollbarrel": drawRollingBarrel(px, py, 0, 0); break;
        case "web": paintWeb(px, py, 0, 0); break;
        case "nest": paintSpiderNest(px, py, 0, 0); break;
        case "gas": paintGas(px, py, 0, 0); break;
        case "gaspipe": paintGasPipe(px, py, 0, 0); break;
        case "refuge": paintRefugeFloor(px, py, 1, 1); break;
        case "refugepost": paintRefugePost(px, py, 0, 0); break;
        case "pad": drawTerrain("earth", px, py); paintAnswerPad(px, py, -1, -1); break;
        case "exitclosed": drawExit(px, py, false); break;
        case "tool0": case "tool1": case "tool2": case "tool3": case "tool4": drawTool(+kind.charAt(4), px, py, 0, 0); break;
      }
    } catch (err) { problem = err; }     // a picture is decoration only: never let it stop the caller
    grid = keepGrid;
    s.tile = keep.tile; gfx.parallax = keep.par; gfx.cellX = keep.gx; gfx.cellY = keep.gy;
    gfx.begin(keep.ctx, keep.TILE, gfx.animFrame);
    return problem;
  }

  Game.render = { frame: render, icon: drawIcon };
})();
