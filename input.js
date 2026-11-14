"use strict";

// ═══════════════════════════════════════════════════════════════════
// input.js - Keyboard, touch, and d-pad event handlers
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
  }

  document.addEventListener("keydown", function(ev) {
    if (isTypingTarget(ev.target)) return;

    var moveKey = MOVE_KEYS[ev.key];
    if (moveKey) {
      ev.preventDefault();
      Game.state.keys[moveKey] = true;
      Game.state.lastMoveKey = moveKey;
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
  // Both the D-pad and dragging on the mine feed the same held-key state the
  // keyboard uses, so a held direction repeats at exactly the keyboard's pace.
  var MOVE_NAMES = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

  function holdDirection(key) {
    var st = Game.state, wasHeld = st.keys[key];
    MOVE_NAMES.forEach(function(k) { st.keys[k] = (k === key); });
    st.lastMoveKey = key;
    if (!wasHeld) st.pressSeq++;
    // take the first step at once, so even a quick tap or flick always moves
    if (!wasHeld && Game.loop && Game.loop.tickInput) Game.loop.tickInput(performance.now());
  }

  // D-pad: press and hold to keep walking
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

  // Mine: put a finger down anywhere and drag - the miner walks the way you
  // drag for as long as you hold, and turns when you change direction.
  (function() {
    var canvas = Game.state.canvas, active = null, DEAD = 14, LEASH = 46;
    canvas.addEventListener("pointerdown", function(ev) {
      if (ev.pointerType === "mouse") return;
      ev.preventDefault();
      active = { id: ev.pointerId, ox: ev.clientX, oy: ev.clientY, key: "" };
      try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
    });
    canvas.addEventListener("pointermove", function(ev) {
      if (!active || ev.pointerId !== active.id) return;
      ev.preventDefault();
      var dx = ev.clientX - active.ox, dy = ev.clientY - active.oy;
      var adx = Math.abs(dx), ady = Math.abs(dy), far = Math.max(adx, ady);
      if (far < DEAD) return;
      var key = adx > ady ? (dx > 0 ? "ArrowRight" : "ArrowLeft") : (dy > 0 ? "ArrowDown" : "ArrowUp");
      if (key !== active.key) { active.key = key; holdDirection(key); }
      // keep the anchor on a short leash so reversing never needs a long drag back
      if (far > LEASH) {
        var pull = (far - LEASH) / far;
        active.ox += dx * pull; active.oy += dy * pull;
      }
    });
    function end(ev) {
      if (!active || ev.pointerId !== active.id) return;
      active = null;
      clearMoveKeys();
    }
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    canvas.addEventListener("lostpointercapture", end);
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
