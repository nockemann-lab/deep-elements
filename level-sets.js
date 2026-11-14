"use strict";

// ═══════════════════════════════════════════════════════════════════
// level-sets.js - loads the four sets of hand-built levels
//
//   Game.levels       Levels/        the first 21 missions
//   Game.bonusLevels  BonusLevels/   ten further missions (map entries 22–31)
//   Game.tutorials    Tutorials/     six guided lessons
//   Game.elementRun   ElementRun/    the three Element Runs (one level each)
//
// Each set is a folder of JSON files plus a manifest.json naming them in
// order. All sets are also bundled into levels-inline.js (see
// generate-levels-inline.js), which is what the game normally reads:
// it works from file:// and needs no extra requests when hosted.
// On localhost the JSON files are fetched live instead, so a level edit
// shows up on reload without rebuilding the bundle.
// ═══════════════════════════════════════════════════════════════════

(function() {

  function servedFromLocalhost() {
    var host = window.location && window.location.hostname;
    return /^https?:$/.test(window.location.protocol) && (host === "localhost" || host === "127.0.0.1" || host === "[::1]");
  }

  // config: { label, folder, manifestGlobal, levelsGlobal, defaultName(index, fileName), optional }
  function createLevelSet(config) {
    var levels = [];
    var loadPromise = null;

    function bundledLevels() {
      var list = window[config.levelsGlobal];
      return Array.isArray(list) && list.length > 0 ? list : null;
    }

    function normalise(level, index, fileName) {
      if (!level || typeof level !== "object" || !Array.isArray(level.grid) ||
          typeof level.cols !== "number" || typeof level.rows !== "number") {
        throw new Error("Invalid " + config.label + " level: " + fileName);
      }
      level.levelNumber = index + 1;
      if (!level.levelName) level.levelName = config.defaultName(index, fileName);
      return level;
    }

    function fetchJson(url, what) {
      return fetch(url, { cache: "no-store" }).then(function(response) {
        if (!response.ok) throw new Error("Unable to load " + what + " (" + response.status + ")");
        return response.json();
      });
    }

    function loadFromBundle() {
      var files = window[config.manifestGlobal] || [];
      // deep copy: levels are mutated when loaded into the game state
      return Promise.resolve(bundledLevels().map(function(level, index) {
        return normalise(JSON.parse(JSON.stringify(level)), index, files[index] || "");
      }));
    }

    function loadFromFiles() {
      return fetchJson(config.folder + "/manifest.json", config.label + " manifest").then(function(files) {
        if (!Array.isArray(files)) throw new Error(config.label + " manifest must be an array of file names");
        return Promise.all(files.map(function(fileName, index) {
          return fetchJson(config.folder + "/" + encodeURIComponent(fileName), config.label + " file " + fileName)
            .then(function(level) { return normalise(level, index, fileName); });
        }));
      });
    }

    var set = {
      isReady: false,
      error: null,

      loadAllLevels: function() {
        if (loadPromise) return loadPromise;
        set.isReady = false;
        set.error = null;

        var useFiles = servedFromLocalhost() || !bundledLevels();
        loadPromise = (useFiles ? loadFromFiles() : loadFromBundle())
          .catch(function(err) {
            // live files unavailable: fall back to the bundle if there is one
            if (useFiles && bundledLevels()) return loadFromBundle();
            throw err;
          })
          .then(function(loaded) {
            levels = loaded;
            set.isReady = true;
            return levels;
          })
          .catch(function(err) {
            if (config.optional) {       // an absent optional set is simply empty
              levels = [];
              set.isReady = true;
              return levels;
            }
            set.error = err;
            loadPromise = null;
            throw err;
          });
        return loadPromise;
      },

      whenReady: function() {
        return set.isReady ? Promise.resolve(levels) : (loadPromise || set.loadAllLevels());
      },

      get: function(index) { return levels[index] || null; },
      getCount: function() { return levels.length; }
    };
    return set;
  }

  // "01_Circuit_Board.json" → "Circuit Board"
  function nameFromFile(fileName) {
    var parts = String(fileName || "").replace(/\.json$/i, "").split("_");
    if (parts.length > 1) parts.shift();
    return parts.join(" ");
  }

  Game.levels = createLevelSet({
    label: "mission", folder: "Levels",
    manifestGlobal: "__MISSION_MANIFEST__", levelsGlobal: "__MISSION_LEVELS__",
    defaultName: function(index, fileName) { return nameFromFile(fileName) || "Mission " + (index + 1); }
  });

  Game.bonusLevels = createLevelSet({
    label: "mission", folder: "BonusLevels", optional: true,
    manifestGlobal: "__BONUS_MANIFEST__", levelsGlobal: "__BONUS_LEVELS__",
    defaultName: function(index, fileName) { return nameFromFile(fileName) || "Mission " + (index + 22); }
  });

  Game.tutorials = createLevelSet({
    label: "tutorial", folder: "Tutorials",
    manifestGlobal: "__TUTORIAL_MANIFEST__", levelsGlobal: "__TUTORIAL_LEVELS__",
    defaultName: function(index, fileName) { return nameFromFile(fileName) || "Tutorial " + (index + 1); }
  });

  Game.elementRun = createLevelSet({
    label: "element run", folder: "ElementRun",
    manifestGlobal: "__ELEMENTRUN_MANIFEST__", levelsGlobal: "__ELEMENTRUN_LEVELS__",
    defaultName: function() { return "Deep Element Run"; }
  });
})();
