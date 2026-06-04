#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/montazhor}"
STANDALONE_DIR="${STANDALONE_DIR:-$APP_DIR/.next/standalone}"
STATIC_DIR="${STATIC_DIR:-$STANDALONE_DIR/.next/static}"
SERVER_JS="${SERVER_JS:-$STANDALONE_DIR/server.js}"
PREPARE_SCRIPT="${PREPARE_SCRIPT:-$APP_DIR/scripts/prepare_standalone_release.sh}"
HYPERFRAMES_RUNTIME_SCRIPT="${HYPERFRAMES_RUNTIME_SCRIPT:-$APP_DIR/scripts/ensure_hyperframes_runtime.sh}"

if [[ ! -f "$SERVER_JS" ]]; then
  echo "Missing standalone server entrypoint: $SERVER_JS" >&2
  exit 1
fi

if [[ ! -d "$STATIC_DIR" ]]; then
  if [[ -x "$PREPARE_SCRIPT" ]]; then
    echo "Standalone static assets are missing, repairing release layout..." >&2
    bash "$PREPARE_SCRIPT"
  fi
fi

if [[ ! -d "$STATIC_DIR" ]]; then
  echo "Missing standalone static assets: $STATIC_DIR" >&2
  echo "Run scripts/prepare_standalone_release.sh after pnpm build." >&2
  exit 1
fi

if [[ -x "$HYPERFRAMES_RUNTIME_SCRIPT" ]]; then
  APP_DIR="$APP_DIR" bash "$HYPERFRAMES_RUNTIME_SCRIPT"
fi

exec /usr/bin/node "$SERVER_JS"
