"use strict";

// ═══════════════════════════════════════════════════════════════════
// ui.js - HUD updates, overlays, menus, leaderboard, event log
// ═══════════════════════════════════════════════════════════════════

(function() {
  var s = Game.state;
  var LB_KEY = "deepElements_highscores";
  var DEPTH_KEY = "deepElements_bestDepth";
  var PT_KEY = "deepElements_ptDiscovered";
  var NB_KEY = "deepElements_notebook";
  // Best Element Run. Leftover seconds count towards the score, so the key
  // changes whenever the run's clock does: older records are not comparable.
  // Best result of each Element Run, kept under the run's own id
  var RUN_BEST_PREFIX = "deepElements_runBest_";

  // Text from a level file or from storage, made safe to put into HTML
  function esc(v) {
    return String(v === undefined || v === null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  // The notebook lasts for one sitting: it starts empty each time the game is
  // opened, so it always shows what has been found since then. Earlier
  // versions saved it in the browser; that copy is cleared here.
  var notebook = {};
  try { localStorage.removeItem(NB_KEY); } catch(e) {}

  Game.ui = {

    // ─── Tutorial hint banner (over the canvas) ───
    _hintTimeout: null,

    showHint: function(h) {
      var el = document.getElementById("tutorial-hint");
      if (!el) return;
      el.innerHTML = '<span class="th-title">' + (h.icon || "💡") + ' ' + (h.title || "HINT") + '</span>' +
        '<span class="th-text">' + (h.text || "") + '</span>' +
        (h.task ? '<span class="th-task">▶ ' + h.task + '</span>' : '') +
        '<span class="th-wait">⏸ The mine waits while you read - move to go on</span>' +
        '<span class="th-more">▴ Tap to read again</span>';
      el.classList.remove("waiting");
      // phones: shown in full over the foot of the mine, folded into the strip
      // under it once the miner moves on (minerActed); tapping it toggles
      el.classList.add("visible", "expanded");
      Game.ui._hintShownAt = Date.now();
      el.onclick = function() {
        if (document.body.classList.contains("is-mobile") && !Game.ui.thumbJustOnJoystick()) el.classList.toggle("expanded");
      };
      el.style.top = ""; Game.ui.placeOverMine(el);
      if (!h.silent && SFX.collectPowerup) SFX.collectPowerup();
      // "WELCOME, MINER!" needs no colon after it
      var logTitle = h.title ? "<strong>" + h.title + (/[!?.:]$/.test(h.title) ? "" : ":") + "</strong> " : "";
      Game.ui.addLog(h.icon || "💡", logTitle + (h.text || "") + (h.task ? " <em>▶ " + h.task + "</em>" : ""), "powerup-log");
      clearTimeout(Game.ui._hintTimeout);
      Game.ui._hintTimeout = setTimeout(function() { Game.ui.hideHint(); },
        Math.max(HINT_SHOW_MS, Game.ui.hintReadMs(h) + HINT_SHOW_AFTER_READ_MS));
    },

    // How long a hint takes to read: a base plus a time per word of its text
    hintReadMs: function(h) {
      var words = String((h.text || "") + " " + (h.task || "")).replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;
      return HINT_READ_BASE_MS + HINT_READ_MS_PER_WORD * words;
    },

    // Lessons: mark the banner while the mine stands still for its reader
    setHintWaiting: function(on) {
      var el = document.getElementById("tutorial-hint");
      if (el) el.classList.toggle("waiting", !!on);
      Game.ui.updateHUD();
    },

    // Phones: a tap on the strip under the mine within a moment of using the
    // joystick is a thumb that slipped, not a choice - it is ignored
    thumbJustOnJoystick: function() {
      return document.body.classList.contains("is-touch") && (!!s.touchHeld || performance.now() - s.lastJoystickAt < JOYSTICK_SLIP_MS);
    },

    // The miner moved or used a tool: a hint shown in full folds away - at
    // once in a mission, and in a lesson only once the mine has stopped waiting
    // for its reader (a key still held from before the hint does not count)
    _hintShownAt: 0,
    minerActed: function() {
      var el = document.getElementById("tutorial-hint");
      if (!el || !el.classList.contains("expanded") || !el.classList.contains("visible")) return;
      var hold = s.mode === "tutorial" ? HINT_MIN_HOLD_MS : 1000;
      if (Date.now() - Game.ui._hintShownAt >= hold) el.classList.remove("expanded");
    },

    hideHint: function() {
      var el = document.getElementById("tutorial-hint");
      if (el) el.classList.remove("visible", "waiting", "expanded");
      clearTimeout(Game.ui._hintTimeout);
      Game.ui._hintTimeout = null;
    },

    // On touch layouts the hint and the fact slip lie over the mine (they are
    // position:absolute there). They sit along its top edge - unless the miner
    // is under them: then they move to the bottom edge, and back the same way.
    // (Phones have the strip under the mine instead: see .msg-band in style.css.)
    placeOverMine: function(el) {
      var cv = /** @type {HTMLCanvasElement} */ (document.getElementById("game"));
      if (!el || !cv || !cv.height || !el.offsetHeight) return;
      if (document.body.classList.contains("is-mobile")) { el.style.top = ""; return; }
      if (getComputedStyle(el).position !== "absolute") { el.style.top = ""; return; }
      var row = s.tile * cv.offsetHeight / cv.height;            // one cell, as shown
      var miner = cv.offsetTop + (s.playerY - s.camY) * row;
      if (miner + row * 1.6 < el.offsetTop || miner - row * 0.6 > el.offsetTop + el.offsetHeight) return;
      if (el.style.top) el.style.top = "";
      else el.style.top = Math.max(cv.offsetTop + cv.offsetHeight - el.offsetHeight - 4, 0) + "px";
    },

    // The tools as the mine draws them, for the inventory slots: drawn once
    // with the game's own sprites, then reused. Until the sprites can be drawn
    // the slot shows the emoji from PU_INFO.
    _toolIcons: [], _invSig: "",
    toolIcon: function(i) {
      var url = Game.ui._toolIcons[i];
      if (!url && Game.render && Game.render.icon) {
        try {
          var cv = document.createElement("canvas"); cv.width = cv.height = 96;
          if (!Game.render.icon(cv, "tool" + i)) {
            // the sprite sits in the middle of its tile: keep the middle, so it fills the slot
            var crop = document.createElement("canvas"); crop.width = crop.height = 60;
            crop.getContext("2d").drawImage(cv, 18, 18, 60, 60, 0, 0, 60, 60);
            url = Game.ui._toolIcons[i] = crop.toDataURL();
          }
        } catch (e) { url = null; }
      }
      return url ? '<img class="inv-ico" src="' + url + '" alt="">' : PU_INFO[i].icon;
    },

    addLog: function(icon, text, cls) {
      var log = document.getElementById("collection-log"), entry = document.createElement("div");
      entry.className = "log-entry " + (cls || "");
      entry.innerHTML = '<span class="log-sym" style="color:' + (cls === "crush-log" ? "var(--red)" : cls === "combo-log" ? "var(--orange)" : cls === "powerup-log" ? "var(--cyan)" : "#8a90a0") + '">' + icon + '</span><span class="log-name">' + text + '</span>';
      log.insertBefore(entry, log.firstChild);
      // phones: the latest line also shows in the strip under the mine when it is free
      var idle = document.getElementById("band-idle");
      if (idle) idle.innerHTML = '<span class="bi-ico">' + icon + '</span><span class="bi-txt">' + String(text).replace(/<(?!\/?(strong|em)\b)[^>]*>/g, "") + '</span>';
    },

    updateHUD: function() {
      var sc3 = s.scenario || SCENARIOS[0];
      var hudLabel = s.levelName ? sc3.icon + " " + s.levelName : "Depth " + (s.level + 1) + " - " + sc3.icon + " " + sc3.name;
      document.getElementById("hud-level").textContent = hudLabel;
      var hc = document.getElementById("hud-collected");
      hc.textContent = s.collected.length + "/" + s.totalElements;
      if (s.collected.length >= s.totalElements) { hc.style.color = "var(--green)"; hc.textContent += " \u2714"; } else { hc.style.color = ""; }
      document.getElementById("hud-enemies").textContent = String(s.enemies.filter(function(e) { return e.alive; }).length);
      document.getElementById("hud-score").textContent = String(s.score);

      document.getElementById("timer-val").textContent = String(Math.ceil(s.levelTime));
      var pct = Math.max(0, (s.levelTime / s.maxLevelTime) * 100);
      var tf = document.getElementById("timer-fill"); tf.style.width = pct + "%";
      var reading = s.readFreeze > 0;
      tf.style.background = reading ? "var(--cyan)" : pct > 50 ? "var(--green)" : pct > 25 ? "var(--gold)" : "var(--red)";
      var tb = document.getElementById("timer-bar");
      if (tb) {
        tb.classList.toggle("reading", reading);
        tb.title = reading ? "Clock held while you read the new element card" : "";
        var tl = tb.querySelector(".timer-label");
        if (s.mineWaiting) tb.title = "The mine waits while you read";
        if (tl) tl.textContent = s.mineWaiting ? "\u23f8" : reading ? "\ud83d\udcd6 " + s.readFreeze : "\u23f0";
      }

      // compact status strip shown above the mine on phones
      var mhE = document.getElementById("mh-elems");
      if (mhE) {
        mhE.textContent = s.collected.length + "/" + s.totalElements;
        mhE.style.color = s.collected.length >= s.totalElements ? "var(--green)" : "";
        document.getElementById("mh-time").textContent = String(Math.ceil(s.levelTime));
        document.getElementById("mh-score").textContent = String(s.score);
        var mhF = document.getElementById("mh-fill");
        mhF.style.width = pct + "%"; mhF.style.background = tf.style.background;
        document.getElementById("mh-clock").textContent = s.mineWaiting ? "\u23f8" : s.readFreeze > 0 ? "\ud83d\udcd6" : "\u23f0";
      }

      document.getElementById("combo-fill").style.width = Math.min(s.comboCount / 5 * 100, 100) + "%";
      document.getElementById("combo-text").textContent = s.comboMultiplier > 1 ? "COMBO x" + s.comboMultiplier.toFixed(1) : "";

      // Inventory: base three slots always, mask/pump slots when owned.
      // Slots are tappable/clickable (mobile item use).
      var invBar = document.getElementById("inventory-bar");
      var mobileBar = document.getElementById("mobile-items");
      // rebuilt only when something in it changed, so the pictures do not flicker
      var fx = s.activeEffects;
      var invSig = s.inventory.join(",") + "|" + fx.lamp + "," + fx.geiger + "," + fx.mask + "|" + Game.ui._toolIcons.filter(Boolean).length;
      if (invSig !== Game.ui._invSig || !invBar.firstChild) {
        Game.ui._invSig = invSig;
        invBar.innerHTML = "";
        if (mobileBar) mobileBar.innerHTML = "";
        var makeSlot = function(i, container) {
          var sl = document.createElement("div");
          sl.className = "inv-slot" + (s.inventory[i] > 0 ? " active" : " empty");
          sl.innerHTML = Game.ui.toolIcon(i) + (s.inventory[i] > 0 ? '<span class="inv-count">' + s.inventory[i] + "</span>" : "");
          sl.title = PU_INFO[i].name + " [press " + (i + 1) + "] - " + PU_INFO[i].desc;
          sl.setAttribute("aria-label", PU_INFO[i].name + ", " + (s.inventory[i] || 0));
          sl.onclick = function() { Game.loop.usePowerup(i); };
          container.appendChild(sl);
        };
        // a tool still working: its picture with the seconds left
        var timedSlot = function(i, seconds, what, colour) {
          var sl = document.createElement("div");
          sl.className = "inv-slot active inv-timed";
          sl.innerHTML = Game.ui.toolIcon(i) + "<span class='inv-count'>" + seconds + "s</span>";
          sl.title = what + ": " + seconds + " s left";
          sl.style.borderColor = colour;
          invBar.appendChild(sl);
        };
        for (var i = 0; i < PU_INFO.length; i++) {
          if (i >= 3 && !(s.inventory[i] > 0)) continue;
          makeSlot(i, invBar);
          if (mobileBar) makeSlot(i, mobileBar);
        }
        if (fx.lamp > 0) timedSlot(PU.LAMP, fx.lamp, "Helmet lamp lit", "var(--gold)");
        if (fx.geiger > 0) timedSlot(PU.GEIGER, fx.geiger, "Geiger counter scanning", "var(--cyan)");
        if (fx.mask > 0) timedSlot(PU.MASK, fx.mask, "Gas mask on", "var(--green)");
      }

      var hintEl = document.getElementById("tutorial-hint"), slipEl = document.getElementById("fact-toast");
      if (hintEl && hintEl.classList.contains("visible")) Game.ui.placeOverMine(hintEl);
      if (slipEl && slipEl.classList.contains("visible")) Game.ui.placeOverMine(slipEl);

      if (s.mode !== "random") {
        for (var k in s.components) {
          var c = s.components[k], sl2 = document.getElementById("slot-" + k), pg = document.getElementById("prog-" + k);
          if (!sl2 || !pg) continue;
          pg.textContent = c.have + "/" + c.need;
          if (c.have >= c.need) { sl2.classList.add("complete"); pg.textContent = "\u2713 DONE"; } else sl2.classList.remove("complete");
        }
      }
    },

    showFact: function(elem) {
      var panel = document.getElementById("elem-panel");
      document.getElementById("ep-empty").style.display = "none";
      document.getElementById("ep-content").style.display = "block";
      document.getElementById("ep-sym").textContent = elem.symbol;
      document.getElementById("ep-sym").style.color = elem.color;
      document.getElementById("ep-name").textContent = elem.name;
      document.getElementById("ep-name").style.color = elem.color;
      var compText = elem.component ? elem.component.toUpperCase() : (s.mode === "random" || s.mode === "elementrun" ? "PERIODIC TABLE" : "BONUS ELEMENT");
      document.getElementById("ep-z").textContent = "Z = " + elem.z + " \u2022 " + compText;
      var realSrc = (typeof ALL_ELEMENTS !== "undefined" && ALL_ELEMENTS[elem.symbol]) ? ALL_ELEMENTS[elem.symbol].real : null;
      var roleLine = "";
      if (s.mode !== "random" && s.mode !== "elementrun" && elem.component && typeof SCENARIO_ROLES !== "undefined") {
        var scIdx = SCENARIOS.indexOf(s.scenario), role = scIdx >= 0 && SCENARIO_ROLES[scIdx] ? SCENARIO_ROLES[scIdx][elem.symbol] : null;
        if (role) roleLine = '<div class="ep-role">\ud83d\udd27 <strong>In this ' + s.scenario.name.toLowerCase() + ':</strong> ' + role + '.</div>';
      }
      Game.ui._lastRole = roleLine ? roleLine.replace(/<[^>]+>/g, "").replace(/^\S+\s/, "") : "";
      document.getElementById("ep-body").innerHTML = roleLine + Game.ui.glossify(elem.body) + (realSrc ? '<div class="ep-real">⚖️ <strong>Reality check:</strong> ' + Game.ui.glossify(realSrc) + '</div>' : '');
      document.getElementById("ep-fun").innerHTML = elem.fun;
      var r = document.getElementById("ep-risk"); r.textContent = elem.riskLabel; r.className = "ep-risk risk-" + elem.risk;
      r.title = Game.ui.riskExplain(elem);
      panel.classList.add("has-elem");
      panel.classList.remove("flash");
      void panel.offsetWidth;
      panel.classList.add("flash");
      // Phones: the side panel is below the fold, so show the fact as a slip
      // in the strip under the mine instead of scrolling the mine away. Tapping
      // it pauses the dig and opens that element's notebook page.
      var toast = document.getElementById("fact-toast");
      if (toast && document.body.classList.contains("is-mobile")) {
        toast.innerHTML = '<span class="ft-sym" style="background:' + (Game.ui._ptGroupColor[Game.ui._ptGroupMap[elem.symbol] || "transition"] || "#4a9ee8") + '">' + elem.symbol + '</span>' +
          '<span class="ft-txt"><strong>' + elem.name + '</strong>' + (Game.ui._lastRole || Game.ui.elementBlurb(elem.symbol)) + '<em>Tap ' + elem.symbol + ' for its page</em></span>';
        // Only the symbol opens the notebook (it pauses the dig): it sits on the far
        // side from the joystick, and a thumb fresh from the joystick is ignored
        toast.onclick = function(ev) {
          var hit = /** @type {Element} */ (ev.target);
          if (!hit || !hit.closest || !hit.closest(".ft-sym") || Game.ui.thumbJustOnJoystick()) return;
          toast.classList.remove("visible");
          if (s.running && !s.paused) Game.loop.togglePause();
          Game.ui.openNotebook(elem.symbol);
        };
        toast.classList.add("visible");
        toast.style.top = ""; Game.ui.placeOverMine(toast);
        clearTimeout(Game.ui._toastTimeout);
        Game.ui._toastTimeout = setTimeout(function() { toast.classList.remove("visible"); }, 6000);
      }
    },

    // ─── Field notebook: every element collected this sitting, with its fact card ───
    // Kept across modes and deaths until the game is closed or reloaded - it
    // records what the player has read, not what they got out of the mine alive.
    // Returns true when the element is new to the notebook. Each entry
    // records where and when it was first found, so the page can say so.
    noteElement: function(sym) {
      if (!ALL_ELEMENTS[sym] || notebook[sym]) return false;
      var where;
      if (s.mode === "custom") {
        var info = Game.map && Game.map.mineInfo ? Game.map.mineInfo(s.level) : null;
        where = (info ? info.mine + ", " + info.country : "a mission") + (s.scenario ? " (" + s.scenario.name + ")" : "");
      } else if (s.mode === "tutorial") where = "Tutorial lesson " + (s.level + 1);
      else if (s.mode === "elementrun") where = s.levelName ? "the run “" + s.levelName + "”" : "an Element Run";
      else if (s.mode === "shared") where = "a shared level";
      else where = "Endless Depths, depth " + (s.level + 1);
      notebook[sym] = { t: Date.now(), w: where };
      return true;
    },

    notebookCount: function() {
      var natural = 0, lab = 0;
      for (var k in notebook) { if (!ALL_ELEMENTS[k]) continue; if (SYNTHETIC_ELEMENTS[k]) lab++; else natural++; }
      return { natural: natural, lab: lab };
    },

    updateNotebookButton: function() {
      var b = document.getElementById("notebook-btn"), c = Game.ui.notebookCount();
      if (!b) return;
      b.textContent = c.natural + c.lab === 0
        ? "Empty so far - every element you dig up gets a page here"
        : c.natural + " of " + PT_TOTAL_COLLECTIBLE + " elements found - open it to read up on them";
    },

    // The button that opens the notebook from a win or death card
    notebookButtonHtml: function(note) {
      return '<button class="nb-open" data-action="openNotebook"><span class="nbo-icon">\ud83d\udcd3</span>' +
        '<span class="nbo-text"><strong>OPEN YOUR FIELD NOTEBOOK</strong><em>' + note + '</em></span><span class="nbo-go">\u2192</span></button>';
    },

    // win (optional): { note, actions, fresh } turns the notebook into the
    // level-complete screen - a result note on the page, this level's finds
    // starred, and the next-step buttons under the book. It then stays open
    // until one of those buttons is used.
    openNotebook: function(sym, win) {
      var ov = document.getElementById("notebook-overlay"), grid = document.getElementById("nb-grid");
      if (!ov || !grid) return;
      var noteEl = document.getElementById("nb-note"), actEl = document.getElementById("nb-actions");
      if (!win && ov.classList.contains("win-mode") && !ov.classList.contains("hidden")) win = Game.ui._winNotebook;
      Game.ui._winNotebook = win || null;
      ov.classList.toggle("win-mode", !!win);
      noteEl.innerHTML = win ? win.note : "";
      actEl.innerHTML = win ? win.actions : "";
      var fresh = (win && win.fresh) || {};
      var c = Game.ui.notebookCount();
      document.getElementById("nb-owner").textContent = "kept by " + (s.playerName || "MINER");
      document.getElementById("nb-sub").innerHTML = c.natural === 0 && c.lab === 0
        ? "Nothing pasted in yet. Every element you dig up, in any mode, gets a page here - and stays, even if the mine gets you afterwards."
        : "<strong>" + c.natural + " of " + PT_TOTAL_COLLECTIBLE + "</strong> naturally occurring elements found" + (c.lab ? ", plus <strong>" + c.lab + "</strong> lab-made" : "") +
          ". Each sticker is an element you have dug up at least once, in any mode - it stays even if the mine got you afterwards. Select one to read its page.";
      var gMap = Game.ui._ptGroupMap, gCol = Game.ui._ptGroupColor;
      var html = '<div class="nb-gap" style="grid-row:8"></div>';
      // the result post-it fills the gap above the transition metals
      if (win) html += '<div class="nb-postit">' + win.note + '</div>';
      Object.keys(PT_LAYOUT).forEach(function(k) {
        var pos = PT_LAYOUT[k], row = pos[0] <= 7 ? pos[0] : (pos[0] === 8 ? 9 : 10);
        var gc = gCol[gMap[k] || "transition"] || "#4a9ee8", e = ALL_ELEMENTS[k], found = !!notebook[k];
        var st = "grid-row:" + row + ";grid-column:" + pos[1] + ";" + (found ? "background:" + gc + ";" : "");
        html += '<button class="nb-cell' + (found ? " found" : "") + (found && fresh[k] ? " fresh" : "") + '" id="nb-' + k + '" style="' + st + '" data-action="showNotebookEntry" data-arg="' + k + '"' +
          ' title="' + (found && e ? e.name : "Element " + (e ? e.z : "") + " - not found yet") + '"><span class="nb-z">' + (e ? e.z : "") + '</span>' + (found ? '<span class="nb-s">' + k + '</span>' : '') + '</button>';
      });
      grid.innerHTML = html;
      var legend = document.getElementById("nb-legend");
      if (legend) legend.innerHTML = "<strong>About the stickers.</strong> " + RISK_ABOUT;
      ov.classList.remove("hidden");
      ov.scrollTop = 0;
      Game.ui._fitNotebookCard();
      Game.ui.showNotebookEntry(sym && notebook[sym] ? sym : null);
      // on a phone the table scrolls sideways: start with the open element in view
      var wrap = /** @type {HTMLElement} */ (grid.parentNode), sel = sym && document.getElementById("nb-" + sym);
      if (wrap && sel && wrap.scrollWidth > wrap.clientWidth) wrap.scrollLeft = Math.max(0, sel.offsetLeft - wrap.clientWidth / 2);
    },

    showNotebookEntry: function(sym) {
      var d = document.getElementById("nb-detail");
      document.querySelectorAll(".nb-cell.selected").forEach(function(el) { el.classList.remove("selected"); });
      var e = sym ? ALL_ELEMENTS[sym] : null;
      if (!e) { d.innerHTML = '<div class="nb-empty">Select a sticker to read that element\'s page.</div>'; return; }
      var cell = document.getElementById("nb-" + sym); if (cell) cell.classList.add("selected");
      var entry = notebook[sym];
      if (!entry) {
        d.innerHTML = '<div class="nb-empty">Element ' + e.z + ' is still a blank page. Dig it up in any mode to paste it in.</div>';
        return;
      }
      d.innerHTML = Game.ui._notebookEntryHtml(sym, entry);
    },

    // One element's page. entry is the stored note of where/when it was found.
    _notebookEntryHtml: function(sym, entry) {
      var e = ALL_ELEMENTS[sym];
      var groupNames = { alkali: "Alkali metal", alkaline: "Alkaline earth metal", transition: "Transition metal", posttrans: "Other metal",
        metalloid: "Metalloid", nonmetal: "Nonmetal", halogen: "Halogen", noble: "Noble gas", lanthanide: "Lanthanide (rare earth)", actinide: "Actinide" };
      var gc = Game.ui._ptGroupColor[Game.ui._ptGroupMap[sym] || "transition"] || "#4a9ee8";
      var foundLine = "";
      if (entry && typeof entry === "object" && entry.t) {
        var when = new Date(entry.t), months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        foundLine = "First found in " + entry.w + " &middot; " + when.getDate() + " " + months[when.getMonth()] + " " + when.getFullYear();
      } else foundLine = "Found before pages were dated";
      return '<div class="nb-d-head"><span class="nb-d-sym" style="background:' + gc + '">' + e.symbol + '</span>' +
        '<div class="nb-d-title"><div class="nb-d-name">' + e.name + '</div><div class="nb-d-meta">Z = ' + e.z + ' &middot; ' + (groupNames[Game.ui._ptGroupMap[sym]] || "") + '</div></div>' +
        '<span class="nb-d-risk gl-host risk-' + Game.ui.riskKind(e) + '" tabindex="0" data-def="' + Game.ui.riskExplain(e) + '">' + e.riskLabel + '</span></div>' +
        '<div class="nb-d-body">' + Game.ui.glossify(e.body) + (e.real ? '<div class="ep-real">⚖️ <strong>Reality check:</strong> ' + Game.ui.glossify(e.real) + '</div>' : '') + '</div>' +
        '<div class="nb-d-fun">' + e.fun + '</div>' +
        '<div class="nb-d-found">' + foundLine + '</div>';
    },

    // Keep the card - and so the whole notebook - one fixed size: as tall as
    // the longest page any element would need at the current width.
    _fitNotebookCard: function() {
      var d = document.getElementById("nb-detail");
      if (!d || !d.clientWidth) return;
      var width = d.clientWidth;
      if (Game.ui._nbCardWidth === width) return;
      Game.ui._nbCardWidth = width;
      var probe = /** @type {HTMLElement} */ (d.cloneNode(false));
      probe.removeAttribute("id");
      probe.style.cssText = "position:absolute;visibility:hidden;left:-9999px;top:0;min-height:0;height:auto;margin:0;transform:none;box-sizing:border-box;width:" + d.offsetWidth + "px";
      d.parentNode.appendChild(probe);
      var longest = { t: 1, w: "Salar de Atacama, Chile (Hydrogen Fuel Cell)" }, tallest = 0;
      for (var k in ALL_ELEMENTS) {
        probe.innerHTML = Game.ui._notebookEntryHtml(k, longest);
        if (probe.offsetHeight > tallest) tallest = probe.offsetHeight;
      }
      d.parentNode.removeChild(probe);
      d.style.minHeight = tallest + "px";
    },

    closeNotebook: function() {
      var ov = document.getElementById("notebook-overlay");
      if (ov) { ov.classList.add("hidden"); ov.classList.remove("win-mode"); }
      Game.ui._winNotebook = null;
    },

    notebookIsWinScreen: function() {
      var ov = document.getElementById("notebook-overlay");
      return !!ov && ov.classList.contains("win-mode") && !ov.classList.contains("hidden");
    },

    resetNotebook: function() {
      if (!confirm("Tear out every page? Your notebook will be empty and this cannot be undone.")) return;
      notebook = {};
      Game.ui.updateNotebookButton();
      Game.ui.openNotebook();
    },

    // Progress lines on the four mode cards
    updateMenuProgress: function() {
      function set(id, text) { var el = document.getElementById(id); if (el) el.textContent = text; }
      if (Game.map && Game.map.completedCount) {
        var done = Game.map.completedCount(), stars = Game.map.starTotal ? Game.map.starTotal() : 0;
        set("mc-prog-missions", done > 0 ? done + " of " + Game.map.total() + " mined · ⭐ " + stars : "");
      }
      var best = 0;
      Game.ui.getScores().forEach(function(sc) { if ((!sc.where || /^Depth /.test(sc.where)) && sc.score > best) best = sc.score; });
      var deep = Game.ui.bestDepth();
      set("mc-prog-endless", deep > 0 ? "Deepest: depth " + deep + (best > 0 ? " · best " + best + " pts" : "") : best > 0 ? "Best score: " + best : "");
      var runCount = Game.elementRun ? Game.elementRun.getCount() : 0, runsDone = 0, runTop = 0;
      for (var ri = 0; ri < runCount; ri++) {
        var rb = Game.ui.runBest(ri);
        if (rb && rb.score) { runsDone++; if (rb.score > runTop) runTop = rb.score; }
      }
      set("mc-prog-run", runsDone ? runsDone + " of " + runCount + " finished · best " + runTop + " pts" : "");
    },

    // ─── Element Runs: one level each, chosen from a list ───
    runInfo: function(i) {
      var lvl = Game.elementRun ? Game.elementRun.get(i) : null;
      if (!lvl) return null;
      var r = lvl.run || {};
      return { id: r.id || ("run" + i), title: lvl.levelName || "Element Run", tag: r.tag || "", blurb: r.blurb || "",
        winLine: r.winLine || "", winSub: r.winSub || "", minutes: Math.round((lvl.timer || 0) / 60),
        elements: (lvl.elements || []).length, bonus: (lvl.hiddenElems || []).length, color: r.color || "" };
    },

    runBest: function(i) {
      var info = Game.ui.runInfo(i);
      if (!info) return null;
      try { return JSON.parse(localStorage.getItem(RUN_BEST_PREFIX + info.id)); } catch (e) { return null; }
    },

    saveRunBest: function(i, record) {
      var info = Game.ui.runInfo(i);
      if (!info) return;
      try { localStorage.setItem(RUN_BEST_PREFIX + info.id, JSON.stringify(record)); } catch (e) {}
    },

    showRunChooser: function() {
      var ov = document.getElementById("run-overlay"), list = document.getElementById("run-list");
      if (!ov || !list) return;
      Game.ui.closeNotebook();
      var html = "", n = Game.elementRun ? Game.elementRun.getCount() : 0;
      for (var i = 0; i < n; i++) {
        var info = Game.ui.runInfo(i), best = Game.ui.runBest(i);
        var bestLine = best && best.score
          ? "🏆 Best: " + best.score + " pts in " + Game.ui.formatRunTime(best.timeUsed)
          : "Not finished yet";
        html += '<button class="run-choice" data-action="startRun" data-arg="' + i + '"' + (info.color ? ' style="--accent:' + esc(info.color) + '"' : '') + '>' +
          '<span class="rc-tag">' + esc(info.tag || (info.elements + " ELEMENTS")) + '</span>' +
          '<span class="rc-title">' + esc(info.title) + '</span>' +
          '<span class="rc-desc">' + esc(info.blurb) + '</span>' +
          '<span class="rc-best">' + esc(bestLine) + '</span></button>';
      }
      list.innerHTML = html;
      ov.classList.remove("hidden");
    },

    hideRunChooser: function() {
      var ov = document.getElementById("run-overlay");
      if (ov) ov.classList.add("hidden");
    },

    formatRunTime: function(seconds) {
      var m = Math.floor(seconds / 60), sec = Math.round(seconds % 60);
      return m + "m " + (sec < 10 ? "0" : "") + sec + "s";
    },

    // Menu and field-guide pictures. Most are drawn by the game's own renderer;
    // the globe and the little periodic table are drawn here.
    renderGuideIcons: function() {
      if (!Game.render || !Game.render.icon) return;
      var pending = false;
      document.querySelectorAll("canvas[data-icon]").forEach(function(cv) {
        var kind = cv.getAttribute("data-icon");
        if (kind === "globe") { if (!Game.ui._drawGlobe(cv)) pending = true; }
        else if (kind === "ptable") Game.ui._drawMiniTable(cv);
        else if (kind === "notebook") Game.ui._drawNotebookIcon(cv);
        else {
          Game.render.icon(cv, kind);
          if (kind === "miner" && !cv.getAttribute("data-drawn")) pending = true;
        }
      });
      // images still loading: try again shortly (gives up after a few seconds)
      Game.ui._iconTries = (Game.ui._iconTries || 0) + 1;
      if (pending && Game.ui._iconTries < 25) setTimeout(Game.ui.renderGuideIcons, 250);
    },

    _globeImg: null,
    _drawGlobe: function(cv) {
      var c2 = cv.getContext("2d"), n = cv.width, r = n * 0.42, cx = n / 2, cy = n / 2;
      if (!Game.ui._globeImg) { Game.ui._globeImg = new Image(); Game.ui._globeImg.src = "world-map.jpg"; }
      var img = Game.ui._globeImg, ready = img.complete && img.naturalWidth > 0;
      c2.clearRect(0, 0, n, n);
      c2.save();
      c2.beginPath(); c2.arc(cx, cy, r, 0, Math.PI * 2); c2.clip();
      c2.fillStyle = "#0e2a4a"; c2.fillRect(0, 0, n, n);
      if (ready) {
        // show the Atlantic side: Europe, Africa and the Americas' edge
        var sh = img.naturalHeight, sw = sh * 0.9, sx = img.naturalWidth * 0.5 - sw * 0.42;
        c2.drawImage(img, sx, 0, sw, sh, cx - r, cy - r, r * 2, r * 2);
      }
      var shade = c2.createRadialGradient(cx - r * 0.4, cy - r * 0.45, r * 0.1, cx, cy, r);
      shade.addColorStop(0, "rgba(255,255,255,0.28)"); shade.addColorStop(0.5, "rgba(255,255,255,0)"); shade.addColorStop(1, "rgba(0,8,20,0.62)");
      c2.fillStyle = shade; c2.fillRect(0, 0, n, n);
      c2.restore();
      c2.strokeStyle = "rgba(74,232,212,0.75)"; c2.lineWidth = n * 0.025;
      c2.beginPath(); c2.arc(cx, cy, r, 0, Math.PI * 2); c2.stroke();
      // mine markers
      /** @type {[number, number, string][]} */ ([[0.36, 0.4, "#e85454"], [0.6, 0.34, "#e8b84b"], [0.56, 0.62, "#4ae87a"], [0.3, 0.66, "#e8b84b"]]).forEach(function(m) {
        c2.fillStyle = "#0b0f16"; c2.beginPath(); c2.arc(n * m[0], n * m[1], n * 0.062, 0, Math.PI * 2); c2.fill();
        c2.fillStyle = m[2]; c2.beginPath(); c2.arc(n * m[0], n * m[1], n * 0.044, 0, Math.PI * 2); c2.fill();
      });
      return ready;
    },

    // A small ring-bound notebook with a few element stickers on the page
    _drawNotebookIcon: function(cv) {
      var c2 = cv.getContext("2d"), n = cv.width, u = n / 100, i;
      c2.clearRect(0, 0, n, n);
      c2.save(); c2.translate(n / 2, n / 2); c2.rotate(-0.09); c2.translate(-n / 2, -n / 2);
      // cover with thickness
      c2.fillStyle = "#24130a"; c2.fillRect(21 * u, 17 * u, 62 * u, 72 * u);
      var cover = c2.createLinearGradient(18 * u, 12 * u, 80 * u, 84 * u);
      cover.addColorStop(0, "#8a5631"); cover.addColorStop(1, "#4a2c18");
      c2.fillStyle = cover; c2.fillRect(18 * u, 13 * u, 62 * u, 72 * u);
      // page stack and page
      c2.fillStyle = "#c9bb98"; c2.fillRect(27 * u, 19 * u, 51 * u, 64 * u);
      c2.fillStyle = "#f3ead4"; c2.fillRect(26 * u, 17 * u, 50 * u, 63 * u);
      c2.strokeStyle = "rgba(70,100,150,0.22)"; c2.lineWidth = Math.max(1, 0.6 * u);
      for (i = 0; i < 6; i++) { c2.beginPath(); c2.moveTo(26 * u, (26 + i * 9) * u); c2.lineTo(76 * u, (26 + i * 9) * u); c2.stroke(); }
      // stickers
      /** @type {[number, number, string][]} */ ([[36, 24, "#e8654a"], [50, 24, "#4a9ee8"], [36, 39, "#6bc45a"], [50, 39, "#e8a44b"], [64, 39, "#a87ae8"], [43, 54, "#e87aad"]]).forEach(function(st) {
        c2.fillStyle = "rgba(60,40,10,0.35)"; c2.fillRect((st[0] + 1) * u, (st[1] + 1.5) * u, 11 * u, 11 * u);
        c2.fillStyle = st[2]; c2.fillRect(st[0] * u, st[1] * u, 11 * u, 11 * u);
        c2.fillStyle = "rgba(255,255,255,0.35)"; c2.fillRect(st[0] * u, st[1] * u, 11 * u, 3.5 * u);
      });
      // rings
      for (i = 0; i < 6; i++) {
        var ry = (21 + i * 10.6) * u;
        c2.fillStyle = "#1a0f07"; c2.beginPath(); c2.arc(29.5 * u, ry + 1.5 * u, 2.2 * u, 0, Math.PI * 2); c2.fill();
        c2.fillStyle = "#3a3f4a"; c2.fillRect(13 * u, ry, 17 * u, 3.4 * u);
        c2.fillStyle = "#dfe4ee"; c2.fillRect(13 * u, ry, 17 * u, 1.4 * u);
      }
      // ribbon
      c2.fillStyle = "#d8483a";
      c2.beginPath(); c2.moveTo(66 * u, 10 * u); c2.lineTo(73 * u, 10 * u); c2.lineTo(73 * u, 30 * u); c2.lineTo(69.5 * u, 26 * u); c2.lineTo(66 * u, 30 * u); c2.closePath(); c2.fill();
      c2.restore();
    },

    _drawMiniTable: function(cv) {
      var c2 = cv.getContext("2d"), n = cv.width, cell = n / 19.5, x0 = (n - cell * 18) / 2, y0 = (n - cell * 10.4) / 2;
      var gMap = Game.ui._ptGroupMap, gCol = Game.ui._ptGroupColor;
      c2.clearRect(0, 0, n, n);
      Object.keys(PT_LAYOUT).forEach(function(k) {
        var pos = PT_LAYOUT[k], row = pos[0] <= 7 ? pos[0] - 1 : pos[0] - 1 + 0.4;
        c2.fillStyle = gCol[gMap[k] || "transition"] || "#4a9ee8";
        c2.globalAlpha = SYNTHETIC_ELEMENTS[k] ? 0.35 : 1;
        c2.fillRect(x0 + (pos[1] - 1) * cell + 0.5, y0 + row * cell + 0.5, cell - 1, cell - 1);
      });
      c2.globalAlpha = 1;
    },

    // Underline the first use of each glossary word in a piece of card text.
    // Works on the text between tags only, so existing markup is left alone.
    glossify: function(html) {
      if (typeof GLOSSARY === "undefined") return html;
      if (!Game.ui._glossRe) {
        Game.ui._glossRe = GLOSSARY.map(function(g) { return { re: new RegExp("\\b(" + g[0] + ")\\b", "i"), def: g[1] }; });
      }
      var used = {}, parts = String(html).split(/(<[^>]+>)/);
      for (var i = 0; i < parts.length; i++) {
        if (!parts[i] || parts[i].charAt(0) === "<") continue;
        // one pass per text run: find the earliest unused term, wrap it, carry on after it
        var out = "", rest = parts[i];
        while (rest) {
          var best = null, bestIdx = -1;
          for (var g = 0; g < Game.ui._glossRe.length; g++) {
            if (used[g]) continue;
            var m = Game.ui._glossRe[g].re.exec(rest);
            if (m && (best === null || m.index < best.index)) { best = m; bestIdx = g; }
          }
          if (!best) { out += rest; break; }
          used[bestIdx] = true;
          out += rest.slice(0, best.index) + '<span class="gl" tabindex="0" data-def="' + Game.ui._glossRe[bestIdx].def.replace(/"/g, "&quot;") + '">' + best[0] + '</span>';
          rest = rest.slice(best.index + best[0].length);
        }
        parts[i] = out;
      }
      return parts.join("");
    },

    riskKind: function(e) { return /^SUPPLY RISK/.test(e.riskLabel) ? e.risk : "special"; },
    // What a sticker means. CRITICAL shares the colour of HIGH but has its own explanation.
    riskExplain: function(e) { return /CRITICAL$/.test(e.riskLabel) ? RISK_EXPLAIN.critical : RISK_EXPLAIN[Game.ui.riskKind(e)]; },

    // ─── Document viewer: sources, teacher's guide and credits, rendered ───
    openDoc: function(name) {
      var files = { sources: "SOURCES.md", guide: "TEACHERS_GUIDE.md", credits: "CREDITS.md" };
      var titles = { sources: "Sources", guide: "Teacher\u2019s guide", credits: "Credits" };
      var ov = document.getElementById("doc-overlay"), body = document.getElementById("doc-body");
      if (!ov || !files[name]) return;
      document.getElementById("doc-title").textContent = titles[name];
      function show(md) { body.innerHTML = Game.ui.renderMarkdown(md); ov.scrollTop = 0; }
      var bundled = (window.__DOCS__ && window.__DOCS__[name]) || "";
      show(bundled || "Loading\u2026");
      ov.classList.remove("hidden");
      // when served over http(s) the live file wins, so an edit shows up without a rebuild
      if (/^https?:$/.test(location.protocol) && window.fetch) {
        fetch(files[name]).then(function(r) { return r.ok ? r.text() : null; }).then(function(t) { if (t && t !== bundled) show(t); }).catch(function() {});
      }
    },

    closeDoc: function() { var ov = document.getElementById("doc-overlay"); if (ov) ov.classList.add("hidden"); },

    // A small Markdown renderer: headings, paragraphs, lists, tables, quotes,
    // rules, bold, italic, code and links - what the three documents use.
    // HTML comments are hidden, except "<!-- survey LINK EMBED -->", which
    // becomes a button that loads the teacher survey into the page on request
    // (so nothing is fetched from the survey service unless a teacher asks).
    renderMarkdown: function(md) {
      function esc(t) { return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
      function inline(t) {
        t = esc(t);
        t = t.replace(/`([^`]+)`/g, function(m, c) {
          var doc = { "SOURCES.md": "sources", "TEACHERS_GUIDE.md": "guide", "CREDITS.md": "credits" }[c];
          return doc ? '<a href="#" data-action="openDoc" data-arg="' + doc + '">' + c.replace(".md", "").replace(/_/g, " ").toLowerCase() + '</a>' : "<code>" + c + "</code>";
        });
        t = t.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
        t = t.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
        t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        t = t.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<em>$2</em>");
        return t;
      }
      var lines = String(md).replace(/\r/g, "").split("\n"), out = [], i = 0;
      function isBlockStart(l) { return /^(#{1,6} |> ?|\s*[-*] |\s*\d+\. |\||---+\s*$)/.test(l); }
      while (i < lines.length) {
        var l = lines[i];
        if (!l.trim()) { i++; continue; }
        var cm = /^<!--(.*)-->\s*$/.exec(l.trim());
        if (cm) {
          var sv = /^\s*survey\s+(https:\/\/\S+)\s+(https:\/\/\S+)\s*$/.exec(cm[1]);
          if (sv) out.push('<div class="doc-survey"><button class="overlay-btn primary" data-action="loadSurvey" data-arg="' + esc(sv[2]).replace(/"/g, "&quot;") + '">Show the survey here</button>' +
            '<p>This loads the form from Microsoft Forms. You can also <a href="' + esc(sv[1]).replace(/"/g, "&quot;") + '" target="_blank" rel="noopener">open it in a new tab</a>.</p></div>');
          i++; continue;
        }
        var h = /^(#{1,6}) (.*)$/.exec(l);
        if (h) { out.push("<h" + h[1].length + ">" + inline(h[2]) + "</h" + h[1].length + ">"); i++; continue; }
        if (/^---+\s*$/.test(l)) { out.push("<hr>"); i++; continue; }
        if (/^\|/.test(l)) {
          var rows = [];
          while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i]); i++; }
          var html = "<table>";
          rows.forEach(function(r, ri) {
            if (/^\|[\s:|-]+\|?\s*$/.test(r)) return;
            var cells = r.replace(/^\|/, "").replace(/\|\s*$/, "").split("|");
            html += "<tr>" + cells.map(function(c) { return (ri === 0 ? "<th>" : "<td>") + inline(c.trim()) + (ri === 0 ? "</th>" : "</td>"); }).join("") + "</tr>";
          });
          out.push(html + "</table>"); continue;
        }
        if (/^> ?/.test(l)) {
          var q = [];
          while (i < lines.length && /^> ?/.test(lines[i])) { q.push(lines[i].replace(/^> ?/, "")); i++; }
          out.push("<blockquote>" + inline(q.join(" ")).replace(/  +/g, " ") + "</blockquote>"); continue;
        }
        var li = /^(\s*)([-*]|\d+\.) (.*)$/.exec(l);
        if (li) {
          var ordered = /\d/.test(li[2]), items = [];
          while (i < lines.length) {
            var m2 = /^(\s*)([-*]|\d+\.) (.*)$/.exec(lines[i]);
            if (m2) { items.push(m2[3]); i++; }
            else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) { items[items.length - 1] += " " + lines[i].trim(); i++; }
            else if (!lines[i].trim() && i + 1 < lines.length && /^(\s*)([-*]|\d+\.) /.test(lines[i + 1])) { i++; }
            else break;
          }
          out.push((ordered ? "<ol>" : "<ul>") + items.map(function(t) { return "<li>" + inline(t) + "</li>"; }).join("") + (ordered ? "</ol>" : "</ul>"));
          continue;
        }
        var para = [l]; i++;
        while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) { para.push(lines[i]); i++; }
        out.push("<p>" + inline(para.join(" ")) + "</p>");
      }
      return out.join("\n");
    },

    // First sentence of an element's card, as plain text
    elementBlurb: function(sym) {
      var e = ALL_ELEMENTS[sym]; if (!e) return "";
      var text = e.body.replace(/<[^>]+>/g, "");
      var m = text.match(/^.*?[.!?](?=\s|$)/);
      return m ? m[0] : text;
    },

    showMenu: function() {
      Game.ui.closeNotebook();
      Game.ui.updateNotebookButton();
      Game.ui.updateMenuProgress();
      Game.ui.renderGuideIcons();
      document.getElementById("menu-overlay").classList.remove("hidden");
      Game.ui.renderLeaderboard();
      SFX.playMenuMusic();
    },

    showMenuTab: function(tab) {
      document.querySelectorAll(".menu-tab").forEach(function(t) { t.classList.remove("active"); });
      document.querySelectorAll(".menu-panel").forEach(function(p) { p.classList.remove("active"); });
      document.getElementById("menu-" + tab).classList.add("active");
      var btn = document.querySelector('.menu-tab[data-tab="' + tab + '"]');
      if (btn) btn.classList.add("active");
      if (tab === "scores") Game.ui.renderLeaderboard();
      if (tab === "guide") Game.ui.renderGuideIcons();
    },

    getScores: function() { try { return JSON.parse(localStorage.getItem(LB_KEY)) || []; } catch(e) { return []; } },

    saveScore: function(name, sc, depth) {
      var scores = Game.ui.getScores();
      // where the score was made: a named mine, or a depth of the endless mine
      var info = (s.mode === "custom" && Game.map && Game.map.mineInfo) ? Game.map.mineInfo(s.level) : null;
      var where = info ? info.mine : "Depth " + depth;
      var row = { name:name.toUpperCase().slice(0, 10), score:sc, depth:depth, where:where, date:Date.now() };
      // An Endless game keeps one row, its best: the score runs on from depth to depth
      if (s.mode === "random" && s.endlessRunId) {
        row.run = s.endlessRunId;
        var earlier = scores.filter(function(o) { return o.run === row.run; })[0];
        if (earlier && earlier.score > sc) return;
        scores = scores.filter(function(o) { return o.run !== row.run; });
      }
      scores.push(row);
      scores.sort(function(a, b) { return b.score - a.score; });
      if (scores.length > 20) scores.length = 20;
      try { localStorage.setItem(LB_KEY, JSON.stringify(scores)); } catch(e) {}
    },

    // Endless: the deepest depth ever cleared
    bestDepth: function() {
      var n = 0;
      try { n = parseInt(localStorage.getItem(DEPTH_KEY), 10) || 0; } catch(e) {}
      return n;
    },
    // true when this depth is a new record
    saveBestDepth: function(depth) {
      if (depth <= Game.ui.bestDepth()) return false;
      try { localStorage.setItem(DEPTH_KEY, String(depth)); } catch(e) {}
      return true;
    },

    renderLeaderboard: function() {
      var scores = Game.ui.getScores();
      var c = document.getElementById("lb-container");
      if (!scores.length) { c.innerHTML = '<div class="lb-empty">No scores yet - be the first!</div>'; return; }
      var h = '<table class="lb-table"><tr><th>#</th><th>NAME</th><th>WHERE</th><th style="text-align:right">SCORE</th></tr>';
      for (var i = 0; i < Math.min(scores.length, 10); i++) {
        var sc = scores[i];
        var medal = i === 0 ? "\ud83e\udd47" : i === 1 ? "\ud83e\udd48" : i === 2 ? "\ud83e\udd49" : (i + 1);
        h += '<tr><td class="lb-rank">' + medal + '</td><td>' + sc.name + '</td><td>' + (sc.where || ("Depth " + sc.depth)) + '</td><td class="lb-score">' + sc.score + '</td></tr>';
      }
      h += '</table>'; c.innerHTML = h;
    },

    clearScores: function() {
      if (confirm("Clear all high scores?")) { try { localStorage.removeItem(LB_KEY); localStorage.removeItem(DEPTH_KEY); } catch(e) {} Game.ui.renderLeaderboard(); Game.ui.updateMenuProgress(); }
    },

    showGameOverUI: function(won, cause) {
      Game.loop.clearIntervals();
      s.placedDynamite = [];
      Game.ui.hideHint();

      if (won) SFX.levelWin();
      var ov = document.getElementById("game-overlay"), card = document.getElementById("overlay-card");
      if (won) {
        var timeBonus = Math.floor(s.levelTime * 10); s.score += timeBonus;
        var timeLeft = s.maxLevelTime > 0 ? s.levelTime / s.maxLevelTime : 0;
        var stars = timeLeft >= STAR_TIME_FRACTIONS[0] ? 3 : timeLeft >= STAR_TIME_FRACTIONS[1] ? 2 : 1;
        var starsHtml = '<div class="stars-row">';
        for (var st = 1; st <= 3; st++) starsHtml += '<span class="star ' + (st <= stars ? "earned" : "") + '">\u2b50</span>';
        starsHtml += '</div>';
        var next = s.level + 1;
        if (s.mode !== "tutorial" && s.mode !== "elementrun" && s.mode !== "shared") Game.ui.saveScore(s.playerName, s.score, s.level + 1);
        var sc2 = s.scenario || SCENARIOS[0];

        var isRandom = (s.mode === "random");
        var deepest = isRandom && Game.ui.saveBestDepth(s.level + 1);
        // Record mission progress (world map stars) and detect full completion
        var allCleared = false;
        if (s.mode === "custom" && Game.map) {
          Game.map.recordResult(s.level, stars, s.score);
          allCleared = Game.map.completedCount() >= Game.map.total();
        }
        var customWinHtml = allCleared ? "<p style='color:var(--cyan); font-weight:bold; margin-top:8px;'>\ud83c\udf89 ALL MINES CONQUERED! \ud83c\udf89<br>Ready to brave the Endless Depths?</p>" : "";

        // Push-your-luck choice for Endless Depths mode
        var btnHtml;
        if (isRandom) {
          // Count discoveries at risk if pushing luck
          var atRiskCount;
          if (s.pushingLuck) {
            atRiskCount = s.unstashedDiscoveries.length;
          } else {
            atRiskCount = 0;
            for (var sym in s.ptDiscovered) {
              if (s.ptSnapshot && !s.ptSnapshot[sym]) atRiskCount++;
            }
          }
          var nextMult = Math.min(1.5 + (s.luckStreak + 1) * 1.0, 5.5);
          var luckLabel = s.pushingLuck
            ? '\ud83c\udfb2 LUCK STREAK: ' + s.luckStreak + (s.luckStreak > 1 ? ' levels' : ' level')
            : '\ud83c\udfb2 PUSH YOUR LUCK?';
          var riskInfo = atRiskCount > 0
            ? '<span style="color:var(--red)">\u26a0\ufe0f ' + atRiskCount + ' ' + (atRiskCount > 1 ? 'discoveries' : 'discovery') + ' at risk!</span> '
            : '';
          var rewardInfo = 'Rare element chance: <strong>' + nextMult.toFixed(1) + '\u00d7</strong>';
          var stashLabel = s.pushingLuck ? 'STASH & CASH OUT \u2192' : 'STASH & CONTINUE \u2192';
          var pushLabel = s.pushingLuck ? '\ud83c\udfb2 DOUBLE DOWN' : '\ud83c\udfb2 PUSH YOUR LUCK';

          btnHtml = '<p class="luck-line"><strong style="color:var(--gold)">' + luckLabel + '</strong> &nbsp; ' + riskInfo + rewardInfo + '</p>' +
            '<div class="btn-row">' +
            '<button class="overlay-btn primary" data-action="stashAndContinue" data-arg="' + next + '">' + stashLabel + '</button>' +
            '<button class="overlay-btn luck" data-action="pushLuckAndContinue" data-arg="' + next + '">' + pushLabel + '</button>' +
            '<button class="overlay-btn secondary" data-action="showMenuScreen">MENU</button>' +
            '</div>';
        } else if (s.mode === "elementrun") {
          var timeUsed = s.maxLevelTime - s.levelTime;
          var timeStr = Game.ui.formatRunTime(timeUsed);
          var erBonusCount = 0; for (var erk in (s.runBonusCollected || {})) erBonusCount++;
          var erInfo = Game.ui.runInfo(s.level) || { winLine: "", title: s.levelName };
          var erBest = Game.ui.runBest(s.level);
          var erRecord = !erBest || s.score > erBest.score;
          if (erRecord) Game.ui.saveRunBest(s.level, { name: s.playerName, score: s.score, timeUsed: timeUsed, bonus: erBonusCount, date: Date.now() });
          var erRecHtml = erRecord
            ? "<p style='color:var(--gold);font-weight:bold'>🏆 NEW RECORD!</p>"
            : (erBest ? "<p style='font-size:.78em;color:#889'>Best run: " + erBest.score + " pts by " + esc(erBest.name) + "</p>" : "");
          var erFamilies = s.families ? s.families.length : 0, erFamDone = 0;
          for (var efk in (s.familiesDone || {})) erFamDone++;
          btnHtml = (erInfo.winLine ? "<p style='color:var(--purple,#a87ae8);font-weight:bold'>🧪 " + esc(erInfo.winLine) + "</p>" : "") +
            "<p style='font-size:.82em'>All " + s.totalElements + " elements in <strong>" + timeStr + "</strong>" +
            (erFamilies ? " &middot; <strong>" + erFamDone + "/" + erFamilies + "</strong> groups complete" : "") +
            (erBonusCount ? " &middot; <strong>" + erBonusCount + "/" + s.bonusTotal + "</strong> lab-made bonus elements" : "") + "</p>" + erRecHtml +
            '<div class="btn-row"><button class="overlay-btn primary" data-action="startLevel" data-arg="' + s.level + '">RUN AGAIN</button>' +
            '<button class="overlay-btn secondary" data-action="chooseRun">OTHER RUNS</button><button class="overlay-btn secondary" data-action="showMenuScreen">MENU</button></div>';
        } else if (s.mode === "shared") {
          btnHtml = '<p style="color:var(--cyan);font-size:.8em">🎁 Shared level conquered - nice mining! Want to build your own? The level editor comes with the game.</p>' +
            '<div class="btn-row"><button class="overlay-btn primary" data-action="startLevel" data-arg="0">PLAY AGAIN</button><button class="overlay-btn secondary" data-action="showSharedLevelDialog">PASTE ANOTHER</button><button class="overlay-btn secondary" data-action="showMenuScreen">MENU</button></div>';
        } else if (s.mode === "tutorial") {
          var tutCount = Game.tutorials ? Game.tutorials.getCount() : 0;
          if (next < tutCount) {
            btnHtml = '<p style="color:var(--green);font-size:.78em">🎓 Lesson ' + (s.level + 1) + ' of ' + tutCount + ' complete!</p>' +
              '<div class="btn-row"><button class="overlay-btn primary" data-action="startLevel" data-arg="' + next + '">NEXT LESSON →</button><button class="overlay-btn secondary" data-action="showMenuScreen">MENU</button></div>';
          } else {
            btnHtml = '<p style="color:var(--green);font-weight:bold;font-size:.85em">🎓 TUTORIAL COMPLETE!<br><span style="font-weight:normal;font-size:.85em;color:#aab">You have mastered every tool, block and creature of the deep. The real mines await!</span></p>' +
              '<div class="btn-row"><button class="overlay-btn primary" data-action="showMissionMap">🗺️ START A MISSION</button><button class="overlay-btn secondary" data-action="showMenuScreen">MENU</button></div>';
          }
        } else {
          var nextMine = (Game.map && Game.map.nextUnfinished) ? Game.map.nextUnfinished(s.level) : -1;
          var nextInfo = nextMine >= 0 ? Game.map.mineInfo(nextMine) : null;
          btnHtml = (nextInfo ? '<p class="win-note">Next unmined: ' + nextInfo.flag + ' <strong>' + nextInfo.mine + '</strong> (' + nextInfo.diff + ')</p>' : '') +
            '<div class="btn-row">' +
            (nextInfo ? '<button class="overlay-btn primary" data-action="startMission" data-arg="' + nextMine + '">NEXT MINE \u2192</button>' : '') +
            '<button class="overlay-btn ' + (nextInfo ? 'secondary' : 'primary') + '" data-action="showMissionMap">🗺️ MINE MAP</button>' +
            '<button class="overlay-btn secondary" data-action="startLevel" data-arg="' + s.level + '">\u21bb REPLAY</button>' +
            '<button class="overlay-btn secondary" data-action="showMenuScreen">MENU</button></div>';
        }

        // Recap chips: the elements learned this level (element run shows the full PT instead)
        // Headline: say what was actually finished, per mode
        var winTitle, winSub = "";
        if (s.mode === "elementrun") {
          var wInfo = Game.ui.runInfo(s.level);
          winTitle = "\ud83e\uddea " + esc(s.levelName || "Element Run").toUpperCase() + " COMPLETE!"; winSub = wInfo ? esc(wInfo.winSub) : "";
        }
        else if (isRandom) { winTitle = "\u26cf\ufe0f DEPTH " + (s.level + 1) + " CLEARED!"; }
        else if (s.mode === "tutorial") { winTitle = "\ud83c\udf93 LESSON " + (s.level + 1) + " COMPLETE!"; winSub = s.levelName || ""; }
        else if (s.mode === "shared") { winTitle = "\ud83c\udf81 " + (s.levelName || "Shared level").toUpperCase() + " COMPLETE!"; }
        else {
          winTitle = sc2.icon + " " + sc2.name.toUpperCase() + " COMPLETE!";
          var mineInfo = Game.map && Game.map.mineInfo ? Game.map.mineInfo(s.level) : null;
          if (mineInfo) winSub = mineInfo.flag + " " + mineInfo.mine + ", " + mineInfo.country;
        }

        var tLeft = Math.max(0, s.levelTime), tStr = Math.floor(tLeft / 60) + ":" + ("0" + (tLeft % 60)).slice(-2);

        // What the next star would have taken
        var starHint = "";
        if (stars < 3) {
          var needFrac = STAR_TIME_FRACTIONS[stars === 2 ? 0 : 1];
          var needSecs = Math.ceil(s.maxLevelTime * needFrac);
          starHint = '<p class="win-note">Reach the exit with <strong>' + needSecs + ' s</strong> or more on the clock for ' + (stars === 2 ? "three" : "two") + ' stars.</p>';
        }
        var showDeviceFact = (s.mode === "custom" || isRandom) && sc2.winMsg;
        var factHtml = showDeviceFact ? '<p class="win-fact">' + sc2.winMsg + '</p>' : '';
        // The win screen IS the open notebook: a note with the result pasted in
        // at the top, this level's finds marked on the table, and the choices
        // (continue, push your luck, next mine…) underneath the book.
        // The note is post-it sized: headline, stars and one line of figures.
        // It sits in the empty top-middle of the periodic table, so the table
        // and the element card stay in view. The longer remarks go with the buttons.
        var figures = ['<strong>' + s.score + '</strong> pts', '<strong>' + tStr + '</strong> left', '<strong>' + s.moves + '</strong> steps'];
        if (s.enemiesKilled > 0) figures.push('<strong>' + s.enemiesKilled + '</strong> crushed');
        if (s.bonusTotal > 0) figures.push('bonus <strong>' + (s.bonusFound || 0) + '/' + s.bonusTotal + '</strong>');
        if (deepest && s.level > 0) figures.push('<strong>your deepest yet</strong>');
        var noteHtml = '<h3>' + winTitle + '</h3>' + (winSub ? '<div class="win-sub">' + winSub + '</div>' : '') +
          starsHtml + '<div class="pi-figs">' + figures.join(' &middot; ') + '</div>';
        var remarks = (starHint || '') + (isRandom ? '' : factHtml);
        var fresh = {};
        s.collected.forEach(function(k) { fresh[k] = 1; });
        for (var bk2 in (s.runBonusCollected || {})) fresh[bk2] = 1;
        card.className = "overlay-card";
        Game.ui.openNotebook(s.collected.length ? s.collected[s.collected.length - 1] : null,
          { note: noteHtml, actions: remarks + customWinHtml + btnHtml, fresh: fresh });
        return;
      } else {
        card.className = "overlay-card lose";
        var causeInfo = DEATH_CAUSES[cause] || DEATH_CAUSES.boulder;
        var title = causeInfo.icon + " " + causeInfo.label, msg = causeInfo.text;

        if (s.score > 0 && s.mode !== "tutorial" && s.mode !== "elementrun" && s.mode !== "shared") Game.ui.saveScore(s.playerName, s.score, s.level + 1);
        var deathPt = (s.mode === "random") ? "<p style='color:var(--cyan);font-size:.78em'>\ud83e\uddea Periodic Table: <strong>" + Game.ui.getPTCount() + "/" + PT_TOTAL_COLLECTIBLE + "</strong> discovered</p>" : "";
        var lostHtml = "";
        if (s.mode === "random" && s.luckStreak > 0) {
          var lostCount = s.unstashedDiscoveries.length;
          if (lostCount > 0) {
            lostHtml = "<p style='color:var(--red);font-size:.82em;font-weight:bold'>\ud83d\udcb8 " + lostCount + " unstashed " + (lostCount > 1 ? "discoveries" : "discovery") + " lost! Luck streak: " + s.luckStreak + "</p>";
          }
        }
        var mapBtn = (s.mode === "custom" && Game.map) ? '<button class="overlay-btn secondary" data-action="showMissionMap">🗺️ MINE MAP</button>' : '';
        // A lesson's own checkpoint is free; a refuge's costs points
        var respawnBtn = !s.checkpoint ? '' : '<button class="overlay-btn primary" data-action="respawnAtRefuge">' +
          (s.checkpointHint >= 0 ? '↩️ TRY THIS PART AGAIN' : '⛑️ RESPAWN AT REFUGE (−100)') + '</button>';
        var whereHtml = s.mode === "random" ? ' &middot; Depth ' + (s.level + 1) + (Game.ui.bestDepth() ? ' (deepest cleared: ' + Game.ui.bestDepth() + ')' : '') : '';
        card.innerHTML = '<h2 style="color:var(--red)">' + title + '</h2><p>' + msg + '</p>' +
          '<p class="lose-stats"><strong>' + s.collected.length + ' of ' + s.totalElements + '</strong> elements found &middot; Score <strong>' + s.score + '</strong>' + whereHtml + '</p>' + lostHtml + deathPt +
          (s.collected.length > 0 ? Game.ui.notebookButtonHtml('What you dug up is still in there - read up before you try again') : '') +
          '<div class="btn-row">' + respawnBtn + '<button class="overlay-btn ' + (s.checkpoint ? 'secondary' : 'primary') + '" data-action="startLevel" data-arg="' + s.level + '">' + (s.mode === "tutorial" ? 'RESTART LESSON' : 'TRY AGAIN') + '</button>' + mapBtn + '<button class="overlay-btn secondary" data-action="showMenuScreen">MENU</button></div>';
      }
      ov.classList.add("visible");
    },

    // ─── Periodic Table (Endless Depths) ───

    loadPTProgress: function() {
      try { s.ptDiscovered = JSON.parse(localStorage.getItem(PT_KEY)) || {}; } catch(e) { s.ptDiscovered = {}; }
    },

    savePTProgress: function() {
      try { localStorage.setItem(PT_KEY, JSON.stringify(s.ptDiscovered)); } catch(e) {}
    },

    getPTCount: function() {
      var n = 0; for (var k in s.ptDiscovered) n++; return n;
    },

    resetPTProgress: function() {
      if (confirm("Reset ALL Periodic Table progress? This cannot be undone.")) {
        s.ptDiscovered = {};
        try { localStorage.removeItem(PT_KEY); } catch(e) {}
        // Clear run snapshots so a death after resetting cannot restore old progress
        if (s.ptSnapshot) s.ptSnapshot = {};
        if (s.ptStashedSnapshot) s.ptStashedSnapshot = {};
        s.unstashedDiscoveries = [];
        if (s.mode === "random") Game.ui.renderPeriodicTable();
      }
    },

    // Element category color map (standard periodic table grouping)
    _ptGroupColor: {
      alkali:     '#e8654a', // warm red
      alkaline:   '#e8a44b', // amber
      transition: '#4a9ee8', // steel blue
      posttrans:  '#5ac4a0', // teal
      metalloid:  '#6bc45a', // green
      nonmetal:   '#c4cc4a', // yellow-green
      halogen:    '#e8d44a', // yellow
      noble:      '#a87ae8', // purple
      lanthanide: '#e87aad', // pink
      actinide:   '#e8a07a', // peach
    },
    _ptGroupMap: {
      H:'nonmetal',He:'noble',
      Li:'alkali',Be:'alkaline',B:'metalloid',C:'nonmetal',N:'nonmetal',O:'nonmetal',F:'halogen',Ne:'noble',
      Na:'alkali',Mg:'alkaline',Al:'posttrans',Si:'metalloid',P:'nonmetal',S:'nonmetal',Cl:'halogen',Ar:'noble',
      K:'alkali',Ca:'alkaline',Sc:'transition',Ti:'transition',V:'transition',Cr:'transition',Mn:'transition',Fe:'transition',Co:'transition',Ni:'transition',Cu:'transition',Zn:'transition',Ga:'posttrans',Ge:'metalloid',As:'metalloid',Se:'nonmetal',Br:'halogen',Kr:'noble',
      Rb:'alkali',Sr:'alkaline',Y:'transition',Zr:'transition',Nb:'transition',Mo:'transition',Tc:'transition',Ru:'transition',Rh:'transition',Pd:'transition',Ag:'transition',Cd:'transition',In:'posttrans',Sn:'posttrans',Sb:'metalloid',Te:'metalloid',I:'halogen',Xe:'noble',
      Cs:'alkali',Ba:'alkaline',Hf:'transition',Ta:'transition',W:'transition',Re:'transition',Os:'transition',Ir:'transition',Pt:'transition',Au:'transition',Hg:'transition',Tl:'posttrans',Pb:'posttrans',Bi:'posttrans',Po:'posttrans',At:'halogen',Rn:'noble',
      Fr:'alkali',Ra:'alkaline',Rf:'transition',Db:'transition',Sg:'transition',Bh:'transition',Hs:'transition',Mt:'transition',Ds:'transition',Rg:'transition',Cn:'transition',Nh:'posttrans',Fl:'posttrans',Mc:'posttrans',Lv:'posttrans',Ts:'halogen',Og:'noble',
      La:'lanthanide',Ce:'lanthanide',Pr:'lanthanide',Nd:'lanthanide',Pm:'lanthanide',Sm:'lanthanide',Eu:'lanthanide',Gd:'lanthanide',Tb:'lanthanide',Dy:'lanthanide',Ho:'lanthanide',Er:'lanthanide',Tm:'lanthanide',Yb:'lanthanide',Lu:'lanthanide',
      Ac:'actinide',Th:'actinide',Pa:'actinide',U:'actinide',Np:'actinide',Pu:'actinide',Am:'actinide',Cm:'actinide',Bk:'actinide',Cf:'actinide',Es:'actinide',Fm:'actinide',Md:'actinide',No:'actinide',Lr:'actinide'
    },

    // Live periodic-table tracker for an Element Run (renders into the side panel).
    // A run that names its own families colours the table by them; elements the
    // run does not hold are greyed out.
    renderRunPT: function() {
      var tracker = document.getElementById("comp-tracker");
      if (!tracker) return;
      var title = document.getElementById("comp-tracker-title");
      var syms = Object.keys(PT_LAYOUT);
      var gMap = Game.ui._ptGroupMap, gCol = Game.ui._ptGroupColor;
      var bonus = s.runBonusCollected || {};
      var gotBonus = 0; for (var bk in bonus) gotBonus++;
      if (title) title.innerHTML = "🧪 PERIODIC TABLE - " + s.collected.length + "/" + s.totalElements + (gotBonus ? " <span style='color:var(--cyan)'>+" + gotBonus + " lab</span>" : "");
      tracker.className = "phone-tracker pt-mode";
      var famColor = {}, families = s.families || [];
      families.forEach(function(f) { if (f.color) f.keys.forEach(function(k) { famColor[k] = f.color; }); });
      var html = '<div style="grid-column:1/-1;grid-row:8;height:4px"></div>';
      for (var i = 0; i < syms.length; i++) {
        var sym = syms[i], pos = PT_LAYOUT[sym];
        var row = pos[0] <= 7 ? pos[0] : (pos[0] === 8 ? 9 : 10);
        var grp = gMap[sym] || "transition", gc = famColor[sym] || gCol[grp] || "#4a9ee8";
        var isCollected = s.collected.indexOf(sym) >= 0 || bonus[sym];
        var inRun = !!(s.elements[sym] || (s.bonusElements && s.bonusElements[sym]));
        var cls = "pt-cell", st = "grid-row:" + row + ";grid-column:" + pos[1] + ";";
        if (isCollected) {
          st += "background:" + gc + ";border:1px solid " + gc + ";box-shadow:0 0 3px " + gc + ";color:#111;";
        } else if (!inRun) {
          cls += " pt-off";
        } else if (SYNTHETIC_ELEMENTS[sym]) {
          cls += " pt-synthetic";
        } else {
          st += "border:1px solid " + gc + "44;color:" + gc + ";background:rgba(255,255,255,0.03);";
        }
        html += '<div class="' + cls + '" style="' + st + '" title="' + (ALL_ELEMENTS[sym] ? ALL_ELEMENTS[sym].name : sym) + '">' + sym + '</div>';
      }
      // Families: how many are complete, and the ones under way
      if (families.length) {
        var done = 0, chips = "";
        families.forEach(function(f) {
          if (s.familiesDone && s.familiesDone[f.name]) { done++; return; }
          var have = 0;
          f.keys.forEach(function(k) { if (s.collected.indexOf(k) >= 0 || bonus[k]) have++; });
          if (have > 0) chips += '<span class="fam-chip"' + (f.color ? ' style="border-color:' + esc(f.color) + '"' : '') + '>' + esc(f.name) + " " + have + "/" + f.keys.length + '</span>';
        });
        html += '<div class="fam-row" style="grid-column:1/-1;grid-row:11"><span class="fam-chip fam-done">🏅 ' + done + "/" + families.length + '</span>' + chips + '</div>';
      }
      tracker.innerHTML = html;
    },

    // the line under the Endless Depths table: what is still to find (the count is in the heading)
    ptLeftHtml: function(count) {
      var left = PT_TOTAL_COLLECTIBLE - count;
      return left > 0 ? "<strong>" + left + "</strong> still to discover" : "<strong>Every element discovered!</strong>";
    },

    renderPeriodicTable: function() {
      var ct = document.getElementById("comp-tracker");
      var title = document.getElementById("comp-tracker-title");
      var count = Game.ui.getPTCount();
      title.textContent = "\ud83e\uddea PERIODIC TABLE - " + count + "/" + PT_TOTAL_COLLECTIBLE;
      ct.innerHTML = "";
      ct.className = "phone-tracker pt-mode";

      var syms = Object.keys(PT_LAYOUT);
      // Insert gap div between main table and f-block rows
      var gapDiv = document.createElement("div");
      gapDiv.className = "pt-gap";
      gapDiv.style.gridRow = "8";
      ct.appendChild(gapDiv);

      for (var i = 0; i < syms.length; i++) {
        var sym = syms[i];
        var pos = PT_LAYOUT[sym];
        var cell = document.createElement("div");
        cell.className = "pt-cell";
        cell.id = "pt-" + sym;
        cell.textContent = sym;
        cell.style.gridRow = pos[0] <= 7 ? pos[0] : (pos[0] === 8 ? 9 : 10);
        cell.style.gridColumn = pos[1];

        // Find element data for color
        var eData = ALL_ELEMENTS[sym];

        if (SYNTHETIC_ELEMENTS[sym]) {
          cell.classList.add("pt-synthetic");
        } else if (s.ptDiscovered[sym]) {
          cell.classList.add("pt-discovered");
          if (eData) cell.style.setProperty("--elem-color", eData.color);
        }

        // Mark current-level required elements (bonus elements stay hidden)
        if (s.elementKeys && s.elementKeys.indexOf(sym) >= 0) {
          cell.classList.add("pt-current");
          if (eData) cell.style.setProperty("--elem-color", eData.color);
        }

        ct.appendChild(cell);
      }

      // Progress text below the table
      var oldProg = document.getElementById("pt-progress-text");
      if (oldProg) oldProg.remove();
      var prog = document.createElement("div");
      prog.className = "pt-progress";
      prog.id = "pt-progress-text";
      prog.innerHTML = Game.ui.ptLeftHtml(count);
      ct.parentNode.appendChild(prog);

      // Reset button below the progress text
      var oldReset = document.getElementById("pt-reset-btn");
      if (oldReset) oldReset.remove();
      var resetBtn = document.createElement("button");
      resetBtn.className = "lb-clear";
      resetBtn.id = "pt-reset-btn";
      resetBtn.style.marginTop = "6px";
      resetBtn.textContent = "Reset Table";
      resetBtn.onclick = Game.ui.resetPTProgress;
      ct.parentNode.appendChild(resetBtn);
    },

    updatePTSlot: function(symbol, isNew) {
      var cell = document.getElementById("pt-" + symbol);
      if (!cell) return;
      var eData = ALL_ELEMENTS[symbol];

      // Remove pulsing "current" state - element has been collected
      cell.classList.remove("pt-current");
      // Apply discovered styling
      if (!cell.classList.contains("pt-discovered")) {
        cell.classList.add("pt-discovered");
        if (eData) cell.style.setProperty("--elem-color", eData.color);
      }
      // Flash animation on collection
      cell.classList.remove("pt-new");
      void cell.offsetWidth;
      cell.classList.add("pt-new");
      setTimeout(function() { cell.classList.remove("pt-new"); }, 900);

      if (isNew) {
        // Update counts only for new discoveries
        var count = Game.ui.getPTCount();
        var title = document.getElementById("comp-tracker-title");
        title.textContent = "\ud83e\uddea PERIODIC TABLE - " + count + "/" + PT_TOTAL_COLLECTIBLE;
        var prog = document.getElementById("pt-progress-text");
        if (prog) prog.innerHTML = Game.ui.ptLeftHtml(count);
      }
    }
  };

  // Expose to HTML inline handlers
  window.showMenuTab = function(tab) { Game.ui.showMenuTab(tab); };
  window.clearScores = function() { Game.ui.clearScores(); };
  window.showMenuScreen = function() { Game.ui.showMenu(); };
  window.openNotebook = function(sym) { Game.ui.openNotebook(sym); };
  window.closeNotebook = function() { Game.ui.closeNotebook(); };
  window.openDoc = function(name) { Game.ui.openDoc(name); };
  window.closeDoc = function() { Game.ui.closeDoc(); };

  // ─── Reduced-effects mode (accessibility: no screen shake, no flashes, no looping animations) ───
  var FX_KEY = "deepElements_reducedFx";
  function applyReducedFx() {
    document.body.classList.toggle("reduced-fx", !!s.reducedFx);
    var b = document.getElementById("fx-btn");
    if (b) b.textContent = s.reducedFx ? "✨ Effects: Reduced" : "✨ Effects: Full";
  }
  window.toggleReducedFx = function() {
    s.reducedFx = !s.reducedFx;
    try { localStorage.setItem(FX_KEY, s.reducedFx ? "1" : "0"); } catch(e) {}
    applyReducedFx();
  };
  // The player's own choice wins; without one, follow the system's "reduce motion" setting.
  var fxSaved = null;
  try { fxSaved = localStorage.getItem(FX_KEY); } catch(e) {}
  if (fxSaved === "1" || fxSaved === "0") s.reducedFx = fxSaved === "1";
  else s.reducedFx = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  applyReducedFx();
  window.resetPTProgress = function() { Game.ui.resetPTProgress(); };

  // ─── Touch screens: the joystick's side, and how close the camera sits (kept by camera.js) ───
  Game.ui.syncTouchButtons = function() {
    var left = Game.camera.joystickLeft(), zoom = Game.camera.zoomName();
    var b = document.getElementById("joy-side-btn");
    if (b) b.textContent = "🕹️ Joystick: " + (left ? "Left" : "Right");
    var pb = document.getElementById("pause-joy-btn");
    if (pb) pb.textContent = "🕹️ JOYSTICK: " + (left ? "LEFT" : "RIGHT");
    var pz = document.getElementById("pause-zoom-btn");
    if (pz) pz.textContent = "🔍 ZOOM: " + zoom.toUpperCase();
    var hz = document.getElementById("mh-zoom");
    if (hz) { hz.setAttribute("aria-label", "Zoom: " + zoom); hz.title = "Zoom: " + zoom; }
  };
  Game.ui.syncTouchButtons();
})();
