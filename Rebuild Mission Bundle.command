#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Rebuilding local mission bundle..."
node generate-levels-inline.js
echo
echo "Done. Press Enter to close."
read -r