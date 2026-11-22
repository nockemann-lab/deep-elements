"use strict";

// ═══════════════════════════════════════════════════════════════════
// input.js - Keyboard, touch, and D-pad event handlers
// ═══════════════════════════════════════════════════════════════════

(function() {
  var MOVE_KEYS = {
    ArrowUp: "ArrowUp", w: "ArrowUp", W: "ArrowUp",
    ArrowDown: "ArrowDown", s: "ArrowDown", S: "ArrowDown",
    ArrowLeft: "ArrowLeft", a: "ArrowLeft", A: "ArrowLeft",
    ArrowRight: "ArrowRight", d: "ArrowRight", D: "ArrowRight"
  };

  function isTypingTarget(target) {
    return !!(target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable));
  }

  function clearMoveKeys() {
    var keys = Game.state.keys;
    for (var key in keys) keys[key] = false;
    Game.state.lastMoveKey = "";
    Game.state.activeMoveKey = "";
    Game.state.touchHeld = false;
  }

  document.addEventListener("keydown", function(ev) {
    if (isTypingTarget(ev.target)) return;

    var moveKey = MOVE_KEYS[ev.key];
    if (moveKey) {
      ev.preventDefault();
      Game.state.keys[moveKey] = true;
      Game.state.lastMoveKey = moveKey;
      Game.state.touchHeld = false;
      if (!ev.repeat) { Game.state.tapQueued = moveKey; Game.state.pressSeq++; }
      return;
    }

    if (ev.repeat) return;

    var docOverlay = document.getElementById("doc-overlay");
    if (docOverlay && !docOverlay.classList.contains("hidden")) {
      if (ev.key === "Escape") Game.ui.closeDoc();
      return;
    }

    // The notebook sits on top of everything: Esc closes it, other keys wait
    var nbOverlay = document.getElementById("notebook-overlay");
    if (nbOverlay && !nbOverlay.classList.contains("hidden")) {
      // as the level-complete screen it only closes through its own buttons
      if (ev.key === "Escape" && !Game.ui.notebookIsWinScreen()) Game.ui.closeNotebook();
      return;
    }

    var menuOverlay = document.getElementById("menu-overlay");
    if (menuOverlay && !menuOverlay.classList.contains("hidden")) return;
    var mapOverlay = document.getElementById("map-overlay");
    if (mapOverlay && !mapOverlay.classList.contains("hidden")) return;

    if (ev.key === "p" || ev.key === "P" || ev.key === "Escape") { Game.loop.togglePause(); return; }
    if (ev.key === "r" || ev.key === "R") { Game.loop.requestRestart(); return; }
    if (ev.key === "1") Game.loop.usePowerup(0);
    if (ev.key === "2") Game.loop.usePowerup(1);
    if (ev.key === "3") Game.loop.usePowerup(2);
    if (ev.key === "4") Game.loop.usePowerup(3);
    if (ev.key === "5") Game.loop.usePowerup(4);
  });

  document.addEventListener("keyup", function(ev) {
    var moveKey = MOVE_KEYS[ev.key];
    if (!moveKey) return;
    ev.preventDefault();
    Game.state.keys[moveKey] = false;
    if (Game.state.lastMoveKey === moveKey) Game.state.lastMoveKey = "";
  });

  window.addEventListener("blur", clearMoveKeys);
  document.addEventListener("visibilitychange", function() {
    if (document.hidden) clearMoveKeys();
  });

  // ─── Touch controls ───
  // Both the D-pad and the mine itself feed the same held-key state the
  // keyboard uses. A touch steps at once, then waits TOUCH_FIRST_REPEAT_MS
  // before it repeats (s.touchHeld), so a tap is always exactly one tile:
  // a finger rests on the glass far longer than a key is struck.
  var MOVE_NAMES = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

  function holdDirection(key) {
    var st = Game.state, wasHeld = st.keys[key];
    MOVE_NAMES.forEach(function(k) { st.keys[k] = (k === key); });
    st.lastMoveKey = key;
    st.touchHeld = true;
    if (!wasHeld) st.pressSeq++;
    // take the first step at once, so even a quick tap always moves
    if (!wasHeld && Game.loop && Game.loop.tickInput) Game.loop.tickInput(performance.now());
  }

  // D-pad (switched on in the pause card or the menu): press and hold to keep walking
  Array.prototype.forEach.call(document.querySelectorAll(".dpad-btn[data-key]"), function(btn) {
    var key = btn.getAttribute("data-key");
    btn.addEventListener("pointerdown", function(ev) {
      ev.preventDefault();
      if (key === "pause") { Game.loop.togglePause(); return; }
      try { btn.setPointerCapture(ev.pointerId); } catch (e) {}
      btn.classList.add("held");
      holdDirection(key);
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(function(type) {
      btn.addEventListener(type, function() {
        btn.classList.remove("held");
        if (key !== "pause" && Game.state.keys[key]) clearMoveKeys();
      });
    });
    btn.addEventListener("contextmenu", function(ev) { ev.preventDefault(); });
  });

  // Mine: touch it on the side of the miner you want to go. A tap is one step
  // that way; holding keeps walking towards the finger, and sliding it steers.
  // (The view scrolls with the miner, so a finger held still mostly stays
  // ahead of them; near the edge of the mine they reach it and stop.) The
  // finger may be anywhere on that side, so it need not hide the cell being dug.
  (function() {
    var canvas = Game.state.canvas, active = null, raf = 0;

    // the way from the miner to the finger, or "" while it rests on the miner's own cell
    function aimAt(clientX, clientY) {
      var st = Game.state, r = canvas.getBoundingClientRect();
      if (!canvas.clientWidth || !st.tile) return "";
      var cell = canvas.clientWidth / (canvas.width / st.tile);      // one cell, as shown
      var camX = st.camSmoothX !== undefined ? st.camSmoothX : st.camX;
      var camY = st.camSmoothY !== undefined ? st.camSmoothY : st.camY;
      var dx = (clientX - r.left - canvas.clientLeft) / cell + camX - (st.playerX + 0.5);
      var dy = (clientY - r.top - canvas.clientTop) / cell + camY - (st.playerY + 0.5);
      var adx = Math.abs(dx), ady = Math.abs(dy);
      if (adx < 0.5 && ady < 0.5) return "";
      return adx > ady ? (dx > 0 ? "ArrowRight" : "ArrowLeft") : (dy > 0 ? "ArrowDown" : "ArrowUp");
    }
    function showAim(key) {
      var st = Game.state, m = key ? { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[key] : null;
      st.touchAim = m ? { x: st.playerX + m[0], y: st.playerY + m[1] } : null;
    }
    function steer() {
      if (!active) return;
      var key = aimAt(active.x, active.y);
      if (key !== active.key) {
        active.key = key;
        if (key) holdDirection(key); else clearMoveKeys();
      }
      showAim(key);
    }
    // the miner walks under a still finger, so the aim is taken again every frame
    function follow() { raf = 0; if (!active) return; steer(); raf = requestAnimationFrame(follow); }

    canvas.addEventListener("pointerdown", function(ev) {
      if (ev.pointerType === "mouse" || active) return;
      ev.preventDefault();
      active = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, key: "" };
      try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
      steer();
      if (!raf) raf = requestAnimationFrame(follow);
    });
    canvas.addEventListener("pointermove", function(ev) {
      if (!active || ev.pointerId !== active.id) return;
      ev.preventDefault();
      active.x = ev.clientX; active.y = ev.clientY;
      steer();
    });
    function end(ev) {
      if (!active || ev.pointerId !== active.id) return;
      active = null;
      Game.state.touchAim = null;
      clearMoveKeys();
    }
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    canvas.addEventListener("lostpointercapture", end);
    canvas.addEventListener("contextmenu", function(ev) { ev.preventDefault(); });
  })();

  // the notebook card is sized to its longest page; re-measure if the window changes
  window.addEventListener("resize", function() {
    var nb = document.getElementById("notebook-overlay");
    if (nb && !nb.classList.contains("hidden") && Game.ui && Game.ui._fitNotebookCard) Game.ui._fitNotebookCard();
  });

  // ─── Buttons ───
  // Markup says what a control does with data-action (and optionally
  // data-arg); this is the one place those names are tied to code. The
  // innermost element with a data-action wins, so a button inside a
  // click-to-dismiss overlay does only its own thing.
  var ACTIONS = {
    beginGame: function(mode) { window.beginGame(mode); },
    startLevel: function(n) { window.startLevel(+n); },
    startMission: function(n) { Game.map.start(+n); },
    stashAndContinue: function(n) { window.stashAndContinue(+n); },
    pushLuckAndContinue: function(n) { window.pushLuckAndContinue(+n); },
    respawnAtRefuge: function() { window.respawnAtRefuge(); },
    togglePause: function() { Game.loop.togglePause(); },
    requestRestart: function() { Game.loop.requestRestart(); },
    quitToMenu: function() { Game.loop.quitToMenu(); },
    showMenuScreen: function() { Game.ui.showMenu(); },
    showMenuTab: function(tab) { Game.ui.showMenuTab(tab); },
    showMissionMap: function() { Game.map.show(); },
    mapBackToMenu: function() { Game.map.backToMenu(); },
    openNotebook: function() { Game.ui.openNotebook(); },
    closeNotebook: function() { Game.ui.closeNotebook(); },
    showNotebookEntry: function(sym) { Game.ui.showNotebookEntry(sym); },
    resetNotebook: function() { Game.ui.resetNotebook(); },
    openDoc: function(name) { Game.ui.openDoc(name); },
    closeDoc: function() { Game.ui.closeDoc(); },
    printDoc: function() { window.print(); },
    startRun: function(n) { window.startElementRun(+n); },
    chooseRun: function() { Game.ui.showMenu(); Game.ui.showRunChooser(); },
    hideRunChooser: function() { Game.ui.hideRunChooser(); },
    noop: function() {},
    showSharedLevelDialog: function() { window.showSharedLevelDialog(); },
    hideSharedLevelDialog: function() { window.hideSharedLevelDialog(); },
    playSharedLevel: function() { window.playSharedLevel(); },
    clearScores: function() { Game.ui.clearScores(); },
    toggleMute: function() { window.toggleMute(); },
    cycleVolume: function() { window.cycleVolume(); },
    toggleReducedFx: function() { window.toggleReducedFx(); },
    cycleZoom: function() { Game.camera.cycleZoom(); Game.ui.syncTouchButtons(); },
    toggleDpad: function() { Game.camera.toggleDpad(); Game.ui.syncTouchButtons(); },
    // the teacher survey, loaded into the guide only when asked for
    loadSurvey: function(url, el) {
      if (!/^https:\/\//.test(url || "")) return;
      var frame = document.createElement("iframe");
      frame.src = url; frame.title = "Anonymous teacher feedback survey (Microsoft Forms)"; frame.allowFullscreen = true;
      el.parentNode.replaceChild(frame, el);
    }
  };

  document.addEventListener("click", function(ev) {
    var target = /** @type {Element} */ (ev.target);
    var el = target.closest ? target.closest("[data-action]") : null;
    if (!el) return;
    var action = ACTIONS[el.getAttribute("data-action")];
    if (!action) return;
    if (el.tagName === "A") ev.preventDefault();
    action(el.getAttribute("data-arg"), el);
  });

  // Leaving the tab or switching app pauses the dig instead of running the clock down
  document.addEventListener("visibilitychange", function() {
    var st = Game.state;
    if (document.hidden && st.running && !st.paused && !st.deathAnim && Game.loop) Game.loop.togglePause();
  });
})();
