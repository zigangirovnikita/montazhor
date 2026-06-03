#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
APP_USER="${APP_USER:-}"
BUILD_DIR="${BUILD_DIR:-$APP_DIR/.next}"
STANDALONE_DIR="${STANDALONE_DIR:-$BUILD_DIR/standalone}"
STATIC_SRC_DIR="${STATIC_SRC_DIR:-$BUILD_DIR/static}"
STATIC_DST_DIR="${STATIC_DST_DIR:-$STANDALONE_DIR/.next/static}"
PUBLIC_SRC_DIR="${PUBLIC_SRC_DIR:-$APP_DIR/public}"
PUBLIC_DST_DIR="${PUBLIC_DST_DIR:-$STANDALONE_DIR/public}"

if [[ ! -f "$STANDALONE_DIR/server.js" ]]; then
  echo "Missing standalone server: $STANDALONE_DIR/server.js"
  echo "Run 'pnpm build' before preparing the release."
  exit 1
fi

if [[ ! -d "$STATIC_SRC_DIR" ]]; then
  echo "Missing Next.js static assets: $STATIC_SRC_DIR"
  echo "The build is incomplete and cannot be deployed safely."
  exit 1
fi

mkdir -p "$(dirname "$STATIC_DST_DIR")"
rm -rf "$STATIC_DST_DIR"
cp -R "$STATIC_SRC_DIR" "$STATIC_DST_DIR"

if [[ -d "$PUBLIC_SRC_DIR" ]]; then
  rm -rf "$PUBLIC_DST_DIR"
  cp -R "$PUBLIC_SRC_DIR" "$PUBLIC_DST_DIR"
fi

if [[ ! -d "$STATIC_DST_DIR/chunks" ]]; then
  echo "Prepared standalone release is missing chunk assets under: $STATIC_DST_DIR/chunks"
  exit 1
fi

if [[ "${EUID}" -eq 0 && -n "$APP_USER" ]] && id -u "$APP_USER" >/dev/null 2>&1; then
  chown -R "$APP_USER:$APP_USER" "$STANDALONE_DIR/.next"
  if [[ -d "$PUBLIC_DST_DIR" ]]; then
    chown -R "$APP_USER:$APP_USER" "$PUBLIC_DST_DIR"
  fi
fi

echo "Standalone release prepared:"
echo "  server: $STANDALONE_DIR/server.js"
echo "  static: $STATIC_DST_DIR"
if [[ -d "$PUBLIC_DST_DIR" ]]; then
  echo "  public: $PUBLIC_DST_DIR"
fi
