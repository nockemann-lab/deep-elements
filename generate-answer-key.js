"use strict";

// Writes ANSWER_KEY.md, the teacher's answer key, from the level files, so the
// key cannot drift from the game. Re-run after editing any level's question:
//   node generate-answer-key.js
// With --check it writes nothing and fails if the key on disk is out of date
// (tests/run.sh uses this).
//
// The key is deliberately NOT one of the documents the game can show
// (generate-docs-inline.js): pupils play the game, teachers read the key.

var fs = require("fs");
var path = require("path");
var vm = require("vm");

function read(rel) { return fs.readFileSync(path.join(__dirname, rel), "utf8"); }
function levelsIn(dir) {
  return JSON.parse(read(dir + "/manifest.json")).map(function(entry) {
    var file = typeof entry === "string" ? entry : entry.file;
    return JSON.parse(read(dir + "/" + file));
  });
}

// Element names from the game's own table
var box = {};
vm.runInNewContext(read("data.js") + "\nthis.ALL = ALL_ELEMENTS;", box);
// The carbon card is headed "Graphite", the form the missions mine; the key names the element.
var NAMES = { C: "Carbon" };
function element(sym) {
  var e = box.ALL[sym];
  return e ? (NAMES[sym] || e.name) + " (" + sym + ")" : sym;
}

// Mine names, in the order of the world map (which is the order of the manifests)
var mines = [];
read("mission-map.js").replace(/\{\s*mine:"([^"]+)",\s*country:"([^"]+)"/g, function(_, mine, country) {
  mines.push({ mine: mine, country: country });
  return _;
});

function cell(text) { return String(text).replace(/\|/g, "\\|"); }
function others(pads, answer) {
  var seen = {}, out = [];
  (pads || []).forEach(function(p) {
    if (p.key !== answer && !seen[p.key]) { seen[p.key] = 1; out.push(element(p.key)); }
  });
  return out.join(", ");
}

var lines = [];
lines.push("# Deep Elements - Answer Key");
lines.push("");
lines.push("For teachers. Every quiz question in the game, with its answer and the other pads on");
lines.push("offer. This file is written by `generate-answer-key.js` from the level files, so it");
lines.push("always matches the game; it is not shown inside the game.");
lines.push("");
lines.push("In the game the answers are dealt onto the pads afresh every time a level loads, so");
lines.push("the key gives the element, not a pad position. A wrong pad costs thirty seconds.");
lines.push("");

var missions = levelsIn("Levels").concat(levelsIn("BonusLevels"));
if (mines.length !== missions.length) throw new Error("mission-map.js lists " + mines.length + " mines, the manifests " + missions.length + " levels");
lines.push("## Missions");
lines.push("");
lines.push("| # | Mine | Device | Question | Answer | Other pads |");
lines.push("|---|------|--------|----------|--------|------------|");
missions.forEach(function(L, i) {
  if (!L.triviaQuestion) return;
  lines.push("| " + (i + 1) + " | " + cell(mines[i].mine + ", " + mines[i].country) + " | " + cell(L.levelName || "") + " | " +
    cell(L.triviaQuestion) + " | **" + element(L.triviaAnswer) + "** | " + others(L.pads, L.triviaAnswer) + " |");
});
lines.push("");

lines.push("## Element Runs");
lines.push("");
lines.push("A run has several doors. Each asks about the elements of the hall the player has just");
lines.push("crossed, and opens only its own door.");
lines.push("");
levelsIn("ElementRun").forEach(function(L) {
  lines.push("### " + L.levelName);
  lines.push("");
  lines.push("| Door | Question | Answer | Other pads |");
  lines.push("|------|----------|--------|------------|");
  (L.gates || []).forEach(function(g, gi) {
    lines.push("| " + (gi + 1) + " | " + cell(g.question) + " | **" + element(g.answer) + "** | " + others(g.pads, g.answer) + " |");
  });
  if (L.triviaQuestion) {
    lines.push("| Bonus vault | " + cell(L.triviaQuestion) + " | **" + element(L.triviaAnswer) + "** | " + others(L.pads, L.triviaAnswer) + " |");
  }
  lines.push("");
  if (L.families && L.families.length) {
    lines.push("Groups that win time when completed: " + L.families.map(function(f) {
      return f.name + " (" + f.keys.length + ")";
    }).join(", ") + ".");
    lines.push("");
  }
});

var text = lines.join("\n");
var target = path.join(__dirname, "ANSWER_KEY.md");
if (process.argv.indexOf("--check") >= 0) {
  var onDisk = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
  if (onDisk !== text) { console.log("ANSWER_KEY.md is out of date: run node generate-answer-key.js"); process.exit(1); }
  console.log("ANSWER_KEY.md matches the level files");
} else {
  fs.writeFileSync(target, text);
  console.log("Wrote ANSWER_KEY.md");
}
