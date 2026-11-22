"use strict";

// ═══════════════════════════════════════════════════════════════════
// input.js - Keyboard, touch joystick, and button handlers
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

  // ─── Touch controls: the joystick ───
  // The joystick feeds the same held-key state the keyboard uses. Pushing it
  // takes one step at once; kept pushed, the miner walks on - but only after
  // touchFirstRepeatMs, and then at touchRepeatMs a step (s.touchHeld), slower
  // than a held key, because a thumb rests and wavers where a key is struck.
  // The mine itself does not take touches: a finger resting on it, or a palm,
  // must never move the miner.
  var MOVE_NAMES = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
  var STEP = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

  function holdDirection(key) {
    var st = Game.state, wasHeld = st.keys[key];
    MOVE_NAMES.forEach(function(k) { st.keys[k] = (k === key); });
    st.lastMoveKey = key;
    st.touchHeld = true;
    if (!wasHeld) st.pressSeq++;
    // take the first step at once, so even a quick push always moves
    if (!wasHeld && Game.loop && Game.loop.tickInput) Game.loop.tickInput(performance.now());
  }

  (function() {
    var joy = document.getElementById("joystick"), knob = document.getElementById("joy-knob");
    if (!joy || !knob) return;
    // a push must reach ENGAGE of the way to the rim to count, and is let go below RELEASE;
    // turning to the other axis needs that axis to lead by TURN, so a wavering thumb
    // near a diagonal does not flick the miner from one way to the other
    var ENGAGE = 0.32, RELEASE = 0.22, TURN = 1.35, TRAVEL = 0.6;
    var active = null, raf = 0;
    ["up", "down", "left", "right"].forEach(function(d) {
      var a = document.createElement("span"); a.className = "joy-arrow joy-" + d; joy.insertBefore(a, knob);
    });

    function directionFor(nx, ny, current) {
      var ax = Math.abs(nx), ay = Math.abs(ny), mag = Math.sqrt(nx * nx + ny * ny);
      if (mag < (current ? RELEASE : ENGAGE)) return "";
      var horiz = nx > 0 ? "ArrowRight" : "ArrowLeft", vert = ny > 0 ? "ArrowDown" : "ArrowUp";
      if (current === "ArrowLeft" || current === "ArrowRight") return ay > ax * TURN ? vert : horiz;
      if (current === "ArrowUp" || current === "ArrowDown") return ax > ay * TURN ? horiz : vert;
      return ax >= ay ? horiz : vert;
    }
    function showAim() {
      var st = Game.state, m = active && active.key ? STEP[active.key] : null;
      st.touchAim = m ? { x: st.playerX + m[0], y: st.playerY + m[1] } : null;
    }
    function move(ev) {
      var r = joy.getBoundingClientRect(), rad = r.width / 2 || 1;
      var dx = ev.clientX - (r.left + rad), dy = ev.clientY - (r.top + rad);
      var nx = dx / rad, ny = dy / rad, mag = Math.sqrt(nx * nx + ny * ny);
      // the knob follows the thumb, but no further than its travel
      var k = mag > TRAVEL ? TRAVEL / mag : 1;
      knob.style.transform = "translate(" + (dx * k).toFixed(1) + "px," + (dy * k).toFixed(1) + "px)";
      var key = directionFor(nx, ny, active.key);
      if (key !== active.key) {
        active.key = key;
        joy.setAttribute("data-dir", key ? key.slice(5).toLowerCase() : "");
        if (key) holdDirection(key); else clearMoveKeys();
      }
      showAim();
    }
    // the miner walks on under a still thumb, so the outline is moved every frame
    function follow() { raf = 0; if (!active) return; showAim(); raf = requestAnimationFrame(follow); }
    function end(ev) {
      if (!active || ev.pointerId !== active.id) return;
      active = null;
      knob.style.transform = "";
      joy.classList.remove("held");
      joy.setAttribute("data-dir", "");
      Game.state.touchAim = null;
      clearMoveKeys();
    }
    joy.addEventListener("pointerdown", function(ev) {
      if (active) return;
      ev.preventDefault();
      active = { id: ev.pointerId, key: "" };
      try { joy.setPointerCapture(ev.pointerId); } catch (e) {}
      joy.classList.add("held");
      move(ev);
      if (!raf) raf = requestAnimationFrame(follow);
    });
    joy.addEventListener("pointermove", function(ev) {
      if (!active || ev.pointerId !== active.id) return;
      ev.preventDefault();
      move(ev);
    });
    joy.addEventListener("pointerup", end);
    joy.addEventListener("pointercancel", end);
    joy.addEventListener("lostpointercapture", end);
    joy.addEventListener("contextmenu", function(ev) { ev.preventDefault(); });
    Game.state.canvas.addEventListener("contextmenu", function(ev) { if (document.body.classList.contains("is-touch")) ev.preventDefault(); });
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
    toggleJoySide: function() { Game.camera.toggleJoystickSide(); Game.ui.syncTouchButtons(); },
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
