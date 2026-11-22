"use strict";

// ═══════════════════════════════════════════════════════════════════
// camera.js - Viewport management and canvas sizing
// ═══════════════════════════════════════════════════════════════════

(function() {
  var resizeTimer;
  var DESKTOP_COLS = 20, DESKTOP_ROWS = 15;

  // Touch-screen preferences, kept in this browser: how close the camera sits
  // and which side of the screen the joystick is on.
  var ZOOM_KEY = "deepElements_zoom", JOY_KEY = "deepElements_joystickLeft";
  // cells across a phone held upright, and cells down a phone on its side
  var ZOOM_COLS = [7, 9, 11], ZOOM_ROWS = [6, 8, 10], ZOOM_NAMES = ["Close", "Medium", "Far"];
  function readPref(key, fallback) {
    try { var v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; }
  }
  function writePref(key, value) { try { localStorage.setItem(key, String(value)); } catch (e) {} }
  var zoom = +readPref(ZOOM_KEY, 1);
  if (!(zoom >= 0 && zoom < ZOOM_COLS.length)) zoom = 1;
  var joyLeft = readPref(JOY_KEY, "0") === "1";

  // the height of an element as laid out, margins included
  function outerH(el) {
    if (!el || !el.offsetParent) return 0;
    var cs = getComputedStyle(el);
    return el.offsetHeight + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
  }

  Game.camera = {

    // Phones and small tablets get a closer view: fewer tiles on screen, each
    // big enough to read, with the camera following the miner. The layout
    // (controls under or beside the mine) is switched by classes on <body>.
    layout: function() {
      var winW = window.innerWidth, winH = window.innerHeight;
      var landscape = winW > winH && winH <= 520;
      // a touch screen with no mouse (tablets included) needs on-screen controls
      var touch = !!(window.matchMedia && window.matchMedia("(hover: none) and (pointer: coarse)").matches);
      // a tablet held upright has no room for the side panel beside the mine: it gets the
      // phone's arrangement (mine on top, controls underneath) with larger tiles
      var tablet = touch && winH > winW && winW > 760 && winW <= 1100;
      var mobile = winW <= 760 || landscape || tablet;
      return { mobile: mobile, landscape: mobile && landscape, tablet: tablet, touch: touch || mobile, winW: winW, winH: winH };
    },

    zoomName: function() { return ZOOM_NAMES[zoom]; },
    // Close → Medium → Far → Close
    cycleZoom: function() {
      zoom = (zoom + 1) % ZOOM_COLS.length;
      writePref(ZOOM_KEY, zoom);
      Game.camera.resize();
      return ZOOM_NAMES[zoom];
    },
    joystickLeft: function() { return joyLeft; },
    toggleJoystickSide: function() {
      joyLeft = !joyLeft;
      writePref(JOY_KEY, joyLeft ? "1" : "0");
      Game.camera.resize();
      return joyLeft;
    },

    // duringLoad: a level is being built, so size the canvas but do not draw -
    // the grid and the dimensions do not match each other yet
    resize: function(duringLoad) {
      var s = Game.state;
      var L = Game.camera.layout();
      var body = document.body;
      body.classList.toggle("is-mobile", L.mobile);
      body.classList.toggle("is-landscape", L.landscape);
      body.classList.toggle("is-tablet", L.tablet);
      body.classList.toggle("is-touch", L.touch);
      body.classList.toggle("joystick-left", joyLeft);

      var availW, availH, cap = 9999;
      if (L.mobile) {
        // what lies above and below the mine (status strip, message band, tools,
        // joystick) is measured, so the mine gets exactly the room that is left
        var hud = document.getElementById("mobile-hud"), band = document.getElementById("msg-band");
        var controls = document.querySelector(".mobile-controls");
        var pad = 4 + 6 + 4 + (parseFloat(getComputedStyle(body).paddingBottom) || 6);   // body padding, canvas border
        if (L.landscape) {
          // mine on the left at full height, everything else in a column on the right
          availW = L.winW - 236; availH = L.winH - pad;
          var tileL = Math.floor(availH / ZOOM_ROWS[zoom]);
          VP_ROWS = Math.max(5, Math.floor(availH / tileL));
          VP_COLS = Math.max(7, Math.min(DESKTOP_COLS, Math.floor(availW / tileL)));
        } else {
          // mine on top; status strip above it, messages, tools and joystick underneath
          availW = L.winW - 10;
          availH = L.winH - pad - outerH(hud) - outerH(band) - outerH(controls) - 6;
          var tileP = Math.floor(availW / (L.tablet ? ZOOM_COLS[zoom] + 4 : ZOOM_COLS[zoom]));
          VP_COLS = Math.floor(availW / tileP);
          VP_ROWS = Math.max(5, Math.min(17, Math.floor(availH / tileP)));
        }
        cap = L.tablet ? 72 : 64;
      } else {
        VP_COLS = DESKTOP_COLS; VP_ROWS = DESKTOP_ROWS;
        availW = Math.min(L.winW - 420, 960);
        availH = L.winH - 120 - (L.touch ? 150 : 0);   // tablets: leave room for the tools and joystick
      }
      var viewCols = Math.min(s.cols, VP_COLS);
      var viewRows = Math.min(s.rows, VP_ROWS);
      var tileFromW = Math.floor(availW / viewCols);
      var tileFromH = Math.floor(availH / viewRows);
      var cssTile = Math.max(Math.min(tileFromW, tileFromH, cap), 12);
      // Phones draw at the screen's own pixel density (up to 2×), so the
      // sprites are sharp instead of a blurred enlargement. Everything is
      // drawn in units of s.tile, so only the canvas's displayed size changes.
      var dpr = L.mobile ? Math.min(2, Math.max(1, window.devicePixelRatio || 1)) : 1;
      s.tile = Math.round(cssTile * dpr);
      s.canvas.width = viewCols * s.tile;
      s.canvas.height = viewRows * s.tile;
      // (the page sizes boxes border included: add the canvas's own border)
      var edge = dpr > 1 ? 2 * (parseFloat(getComputedStyle(s.canvas).borderLeftWidth) || 0) : 0;
      s.canvas.style.width = dpr > 1 ? viewCols * cssTile + edge + "px" : "";
      s.canvas.style.height = dpr > 1 ? viewRows * cssTile + edge + "px" : "";
      if (duringLoad === true) return;
      if (s.grid.length > 0) Game.camera.update();
      if (s.running && s.grid.length > 0 && Game.render) Game.render.frame();
    },

    update: function() {
      var s = Game.state;
      var viewCols = Math.min(s.cols, VP_COLS);
      var viewRows = Math.min(s.rows, VP_ROWS);
      if (s.cols <= VP_COLS && s.rows <= VP_ROWS) { s.camX = 0; s.camY = 0; return; }

      var targetX = s.playerX - Math.floor(viewCols / 2);
      var targetY = s.playerY - Math.floor(viewRows / 2);
      s.camX = Math.max(0, Math.min(targetX, s.cols - viewCols));
      s.camY = Math.max(0, Math.min(targetY, s.rows - viewRows));
    }
  };

  // Initial resize + listen for window changes (rotation included)
  Game.camera.resize();
  window.addEventListener("resize", function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() { Game.camera.resize(); }, 150);
  });
})();
