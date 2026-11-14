"use strict";

// ═══════════════════════════════════════════════════════════════════
// camera.js - Viewport management and canvas sizing
// ═══════════════════════════════════════════════════════════════════

(function() {
  var resizeTimer;
  var DESKTOP_COLS = 20, DESKTOP_ROWS = 15;

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

      var availW, availH;
      if (L.landscape) {
        // mine on the left at full height, controls in a column on the right
        var rows = Math.max(7, Math.min(11, Math.floor((L.winH - 12) / 32)));
        var tileL = Math.floor((L.winH - 12) / rows);
        VP_ROWS = rows;
        VP_COLS = Math.max(9, Math.min(DESKTOP_COLS, Math.floor((L.winW - 236) / tileL)));
        availW = L.winW - 236; availH = L.winH - 12;
      } else if (L.mobile) {
        // mine on top, status strip above it, items and D-pad underneath
        var cols = Math.max(9, Math.min(13, Math.floor((L.winW - 8) / 32)));
        var tileP = Math.floor((L.winW - 8) / cols);
        VP_COLS = cols;
        VP_ROWS = Math.max(7, Math.min(13, Math.floor((L.winH - 296) / tileP)));
        availW = L.winW - 8; availH = L.winH - 296;
      } else {
        VP_COLS = DESKTOP_COLS; VP_ROWS = DESKTOP_ROWS;
        availW = Math.min(L.winW - 420, 960);
        availH = L.winH - 120 - (L.touch ? 215 : 0);   // tablets: leave room for the D-pad
      }
      var viewCols = Math.min(s.cols, VP_COLS);
      var viewRows = Math.min(s.rows, VP_ROWS);
      var tileFromW = Math.floor(availW / viewCols);
      var tileFromH = Math.floor(availH / viewRows);
      s.tile = Math.max(Math.min(tileFromW, tileFromH, L.tablet ? 56 : L.mobile ? 44 : 9999), 12);
      s.canvas.width = viewCols * s.tile;
      s.canvas.height = viewRows * s.tile;
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
