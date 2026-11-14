"use strict";

var fs = require("fs");
var path = require("path");
var generator = require("./generate-levels-inline.js");

var levelsDir = generator.paths.levelsDir;
var tutorialsDir = generator.paths.tutorialsDir;
var elementRunDir = path.join(generator.paths.rootDir, "ElementRun");
var pendingTimer = null;
var isRebuilding = false;
var needsAnotherPass = false;
var lastSeenStampByFile = Object.create(null);

function timestamp() {
  return new Date().toLocaleTimeString();
}

function shouldHandle(fileName) {
  return typeof fileName === "string" && /\.json$/i.test(fileName);
}

function getFileStamp(dir, fileName) {
  try {
    var stat = fs.statSync(path.join(dir, fileName));
    return String(stat.mtimeMs);
  } catch (err) {
    return "missing";
  }
}

function runBuild(reason) {
  if (isRebuilding) {
    needsAnotherPass = true;
    return;
  }

  isRebuilding = true;
  needsAnotherPass = false;

  try {
    var result = generator.buildInlineBundle();
    console.log("[" + timestamp() + "] Synced mission bundle after " + reason + " (" + result.count + " levels)");
  } catch (err) {
    console.error("[" + timestamp() + "] Sync failed: " + (err && err.message ? err.message : err));
  } finally {
    isRebuilding = false;
    if (needsAnotherPass) scheduleBuild("queued change");
  }
}

function scheduleBuild(reason, dir, fileName) {
  if (fileName) {
    var stampKey = path.join(dir || levelsDir, fileName);
    var fileStamp = getFileStamp(dir || levelsDir, fileName);
    if (lastSeenStampByFile[stampKey] === fileStamp) return;
    lastSeenStampByFile[stampKey] = fileStamp;
  }

  clearTimeout(pendingTimer);
  pendingTimer = setTimeout(function() {
    pendingTimer = null;
    runBuild(reason);
  }, 150);
}

console.log("Watching mission + tutorial files for changes:");
console.log(levelsDir);
if (fs.existsSync(tutorialsDir)) console.log(tutorialsDir);
console.log("Press Ctrl+C to stop.\n");

runBuild("startup");

fs.watch(levelsDir, function(eventType, fileName) {
  if (!shouldHandle(fileName)) return;
  scheduleBuild((eventType || "change") + " in " + fileName, levelsDir, fileName);
});

if (fs.existsSync(tutorialsDir)) {
  fs.watch(tutorialsDir, function(eventType, fileName) {
    if (!shouldHandle(fileName)) return;
    scheduleBuild((eventType || "change") + " in Tutorials/" + fileName, tutorialsDir, fileName);
  });
}

if (fs.existsSync(elementRunDir)) {
  fs.watch(elementRunDir, function(eventType, fileName) {
    if (!shouldHandle(fileName)) return;
    scheduleBuild((eventType || "change") + " in ElementRun/" + fileName, elementRunDir, fileName);
  });
}

var bonusDir = path.join(generator.paths.rootDir, "BonusLevels");
if (fs.existsSync(bonusDir)) {
  fs.watch(bonusDir, function(eventType, fileName) {
    if (!shouldHandle(fileName)) return;
    scheduleBuild((eventType || "change") + " in BonusLevels/" + fileName, bonusDir, fileName);
  });
}