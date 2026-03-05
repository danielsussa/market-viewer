#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ ! -d "$ROOT_DIR/node_modules" ]; then
  echo "[run.sh] Installing dependencies..."
  npm --prefix "$ROOT_DIR" install
fi

echo "[run.sh] Starting Market Viewer..."
echo "[run.sh] App:  http://localhost:5173/"
echo "[run.sh] Help: http://localhost:5173/help/"

npm --prefix "$ROOT_DIR" run dev
