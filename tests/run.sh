#!/bin/sh
# Runs the smoke tests in headless Chrome, then the level validator over every
# level file, and prints a pass/fail list.
#   tests/run.sh            (set CHROME=/path/to/chrome if it is not found)
# Exit status is 0 only when every check passes.

cd "$(dirname "$0")/.." || exit 2

CHROME="${CHROME:-}"
for candidate in \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "$(command -v google-chrome 2>/dev/null)" \
  "$(command -v chromium 2>/dev/null)" \
  "$(command -v chromium-browser 2>/dev/null)"; do
  [ -z "$CHROME" ] && [ -n "$candidate" ] && [ -x "$candidate" ] && CHROME="$candidate"
done
[ -z "$CHROME" ] && { echo "Chrome not found. Set CHROME=/path/to/chrome"; exit 2; }

PAGE="_smoke.html"
trap 'rm -f "$PAGE"' EXIT
sed 's#</body>#<script src="tests/smoke.js"></script></body>#' index.html > "$PAGE"

OUT=$("$CHROME" --headless=new --disable-gpu --virtual-time-budget=12000 --window-size=1300,900 \
  --dump-dom "file://$PWD/$PAGE" 2>/dev/null | sed -n '/<pre id="TEST-RESULTS">/,/<\/pre>/p' \
  | grep -E '^(ok|FAIL)  ' | sed 's/&quot;/"/g;s/&amp;/\&/g;s/&lt;/</g;s/&gt;/>/g')

[ -z "$OUT" ] && { echo "FAIL  the test page produced no results (script error before the tests ran?)"; exit 1; }

# the level files themselves: every one must pass the validator
OUT="$OUT
$(sh tests/validate-levels.sh)"

# the teacher's answer key is written from the level files and must match them
if node generate-answer-key.js --check >/dev/null 2>&1; then OUT="$OUT
ok    the answer key matches the level files"
else OUT="$OUT
FAIL  the answer key matches the level files  -- run: node generate-answer-key.js"
fi

printf '%s\n' "$OUT"
FAILS=$(printf '%s\n' "$OUT" | grep -c '^FAIL')
TOTAL=$(printf '%s\n' "$OUT" | grep -c '')
echo "$((TOTAL - FAILS)) of $TOTAL checks passed"
[ "$FAILS" -eq 0 ]
