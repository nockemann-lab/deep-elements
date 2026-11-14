"use strict";

// ═══════════════════════════════════════════════════════════════════
// shared-level.js - "Play a shared level": paste a level code made in
// the level editor. The code is untrusted input, so it is validated and
// cleaned before the game loads it.
// ═══════════════════════════════════════════════════════════════════

(function() {
  var s = Game.state;

  // ─── Shared level codes (community levels from the editor) ───
  var sharedLevel = null;

  function escapeHtml(v) {
    return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function validateSharedLevel(lvl) {
    if (!lvl || typeof lvl !== "object") return "That is not a level object.";
    if (typeof lvl.cols !== "number" || typeof lvl.rows !== "number" ||
        lvl.cols !== Math.floor(lvl.cols) || lvl.rows !== Math.floor(lvl.rows) ||
        lvl.cols < 5 || lvl.rows < 5 || lvl.cols > 200 || lvl.rows > 200) return "Level size is missing or out of range (5–200).";
    if (!Array.isArray(lvl.grid) || lvl.grid.length !== lvl.cols * lvl.rows) return "The grid does not match the level size.";
    // Highest tile id allowed in level files - keep tied to the tile table so
    // new tiles are accepted automatically (T.REFUGE_POST is runtime-only).
    var tileMax = T.GAS_SRC;
    for (var i = 0; i < lvl.grid.length; i++) {
      var t = lvl.grid[i];
      if (typeof t !== "number" || t < 0 || t > tileMax || t !== Math.floor(t)) return "The grid contains an invalid tile (index " + i + ").";
    }
    return null;
  }

  function shareInput() { return /** @type {HTMLTextAreaElement} */ (document.getElementById("share-input")); }

  window.showSharedLevelDialog = function() {
    Game.ui.closeNotebook();
    document.getElementById("share-error").textContent = "";
    shareInput().value = "";
    document.getElementById("share-overlay").classList.remove("hidden");
    document.getElementById("share-input").focus();
  };
  window.hideSharedLevelDialog = function() {
    document.getElementById("share-overlay").classList.add("hidden");
  };
  window.playSharedLevel = function() {
    var errEl = document.getElementById("share-error");
    var raw = shareInput().value.trim();
    if (!raw) { errEl.textContent = "Paste a level code first."; return; }
    var lvl;
    try { lvl = JSON.parse(raw); } catch (e) { errEl.textContent = "Not a valid level code (JSON could not be read)."; return; }
    var problem = validateSharedLevel(lvl);
    if (problem) { errEl.textContent = problem; return; }

    // Normalise + defuse: clamp entities to the grid, default odd scenarios to
    // Free Play, and escape hint text (it is rendered as HTML in the banner)
    var inB = function(e) { return e && typeof e.x === "number" && typeof e.y === "number" && e.x === Math.floor(e.x) && e.y === Math.floor(e.y) && e.x >= 0 && e.x < lvl.cols && e.y >= 0 && e.y < lvl.rows; };
    ["elements", "hiddenElems", "powerups", "enemies", "pads"].forEach(function(k) {
      lvl[k] = Array.isArray(lvl[k]) ? lvl[k].filter(inB) : [];
    });
    // Unknown creatures or elements would crash the enemy loop / leave the
    // level unwinnable - drop them
    var knownElem = function(e) { return typeof e.key === "string" && ALL_ELEMENTS.hasOwnProperty(e.key); };
    lvl.enemies = lvl.enemies.filter(function(e) { return typeof e.type === "string" && ENEMY_TYPES.hasOwnProperty(e.type); });
    lvl.elements = lvl.elements.filter(knownElem);
    lvl.hiddenElems = lvl.hiddenElems.filter(knownElem);
    // an answer pad stands for an element; its key is shown in the banner
    lvl.pads = lvl.pads.filter(knownElem);
    if (typeof lvl.timer !== "number" || !(lvl.timer >= 10 && lvl.timer <= 36000)) delete lvl.timer;
    else lvl.timer = Math.floor(lvl.timer);
    lvl.powerups = lvl.powerups.filter(function(p) {
      return typeof p.type === "number" && p.type >= 0 && p.type < PU_INFO.length;
    });
    if (!inB(lvl.player)) lvl.player = null;
    if (!inB(lvl.exit)) lvl.exit = null;
    if (typeof lvl.scenario !== "number" || lvl.scenario !== Math.floor(lvl.scenario) || lvl.scenario < 0 || lvl.scenario > 15) lvl.scenario = 15;
    lvl.levelName = escapeHtml(lvl.levelName || "Shared Level").slice(0, 40);
    if (Array.isArray(lvl.hints)) {
      lvl.hints = lvl.hints.filter(inB).map(function(h) {
        return { x: h.x, y: h.y, r: (typeof h.r === "number" && h.r >= 0 ? h.r : 1), icon: escapeHtml(h.icon || "💡").slice(0, 8), title: escapeHtml(h.title || ""), text: escapeHtml(h.text || "") };
      });
    }
    if (typeof lvl.difficulty !== "number" || !(lvl.difficulty >= 0)) delete lvl.difficulty;
    // The question is drawn on the mine wall as plain text and shown in the
    // banner as HTML; the game escapes it where it builds that HTML. Answers
    // are element symbols or nothing.
    var symbolOrNone = function(v) { return typeof v === "string" && ALL_ELEMENTS.hasOwnProperty(v) ? v : ""; };
    lvl.triviaQuestion = (typeof lvl.triviaQuestion === "string" ? lvl.triviaQuestion : "").slice(0, 120);
    lvl.triviaAnswer = symbolOrNone(lvl.triviaAnswer);
    lvl.triviaTrap = symbolOrNone(lvl.triviaTrap);
    lvl.triviaPos = inB(lvl.triviaPos) ? { x: lvl.triviaPos.x, y: lvl.triviaPos.y } : null;
    if (typeof lvl.sight !== "number") delete lvl.sight;
    // Quiz gates and element families (hand-written; the editor has no tool
    // for them): same rules as the single quiz - text is text, keys are
    // element symbols, places are inside the grid
    lvl.gates = (Array.isArray(lvl.gates) ? lvl.gates : []).slice(0, 40).filter(function(g) { return g && typeof g === "object"; }).map(function(g) {
      return {
        question: (typeof g.question === "string" ? g.question : "").slice(0, 120),
        answer: symbolOrNone(g.answer),
        pos: inB(g.pos) ? { x: g.pos.x, y: g.pos.y } : null,
        pads: (Array.isArray(g.pads) ? g.pads : []).filter(inB).filter(knownElem).map(function(p) { return { x: p.x, y: p.y, key: p.key }; }),
        doors: (Array.isArray(g.doors) ? g.doors : []).filter(inB).map(function(d) { return { x: d.x, y: d.y }; })
      };
    });
    lvl.families = (Array.isArray(lvl.families) ? lvl.families : []).slice(0, 40).filter(function(f) { return f && typeof f === "object"; }).map(function(f) {
      return {
        name: (typeof f.name === "string" ? f.name : "").slice(0, 40),
        keys: (Array.isArray(f.keys) ? f.keys : []).filter(function(k) { return typeof k === "string" && ALL_ELEMENTS.hasOwnProperty(k); }),
        bonus: (typeof f.bonus === "number" && f.bonus >= 0 && f.bonus <= 600) ? Math.floor(f.bonus) : 0,
        color: (typeof f.color === "string" && /^#[0-9a-fA-F]{3,8}$/.test(f.color)) ? f.color : ""
      };
    }).filter(function(f) { return f.name && f.keys.length; });
    delete lvl.run;

    sharedLevel = lvl;
    window.hideSharedLevelDialog();
    document.getElementById("menu-overlay").classList.add("hidden");
    s.mode = "shared";
    Game.loop.startLevel(0);
  };

  Game.sharedLevel = {
    current: function() { return sharedLevel; }
  };
})();
