#!/usr/bin/env bash
# Builds a Chrome Web Store zip containing only shipping files.
set -euo pipefail
cd "$(dirname "$0")"
VERSION=$(python3 -c 'import json;print(json.load(open("manifest.json"))["version"])')
OUT="dist/todoist-task-toolkit-$VERSION.zip"
mkdir -p dist
rm -f "$OUT"
zip -X -r "$OUT" manifest.json background.js content.js groups.js chatgpt-work.js selectors.js \
  styles.css ui.css popup.html popup.js options.html options.js icons \
  -x '*.DS_Store'
echo "Contents of $OUT:"
unzip -l "$OUT"
