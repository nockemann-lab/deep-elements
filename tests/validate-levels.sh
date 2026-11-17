#!/bin/sh
# Runs the level validator (Tutorials/_validate.js) over every level file.
#   tests/validate-levels.sh
# Prints one line per folder and exits 0 only when no file has an error.
# Warnings do not fail the check; run the validator on a single file to read them.

cd "$(dirname "$0")/.." || exit 2
command -v node >/dev/null 2>&1 || { echo "FAIL  level files validate  -- node not found"; exit 2; }

STATUS=0
for dir in Tutorials Levels ElementRun; do
  COUNT=0; BAD=""
  for f in "$dir"/*.json; do
    case "$f" in */manifest.json) continue ;; esac
    COUNT=$((COUNT + 1))
    node Tutorials/_validate.js "$f" >/dev/null 2>&1 || BAD="$BAD $(basename "$f")"
  done
  if [ -z "$BAD" ]; then echo "ok    $dir: $COUNT level files validate"
  else echo "FAIL  $dir: level files validate  --$BAD"; STATUS=1; fi
done
exit $STATUS
