#!/bin/sh
# Type-check the game's scripts (needs Node; TypeScript is fetched by npx on
# first use). Nothing is built: this only reports mistakes. The same checks
# show as you type in VS Code, which reads jsconfig.json by itself.
cd "$(dirname "$0")/.." || exit 1
npx -y -p typescript tsc -p jsconfig.json && echo "No type errors"
