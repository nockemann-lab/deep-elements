#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Starting mission bundle auto-sync watcher..."
echo "Keep this window open while editing mission files."
echo
node watch-levels-inline.js