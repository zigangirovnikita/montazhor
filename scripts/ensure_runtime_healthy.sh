#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/montazhor}"
APP_USER="${APP_USER:-montazhor}"
APP_SERVICE="${APP_SERVICE:-montazhor}"
NGINX_SERVICE="${NGINX_SERVICE:-nginx}"
APP_PORT="${APP_PORT:-5001}"
APP_URL="${APP_URL:-http://127.0.0.1:${APP_PORT}}"
HEALTH_PATH="${HEALTH_PATH:-/}"
PREPARE_SCRIPT="${PREPARE_SCRIPT:-$APP_DIR/scripts/prepare_standalone_release.sh}"
TMP_DIR="${TMP_DIR:-/tmp/montazhor-healthcheck}"

mkdir -p "$TMP_DIR"
HTML_FILE="$TMP_DIR/home.html"

log() {
  echo "[healthcheck] $*"
}

restart_app() {
  log "Restarting ${APP_SERVICE}.service"
  systemctl restart "${APP_SERVICE}"
}

restart_nginx_if_needed() {
  if ! systemctl is-active --quiet "${NGINX_SERVICE}"; then
    log "${NGINX_SERVICE}.service is inactive, restarting"
    systemctl restart "${NGINX_SERVICE}"
  fi
}

prepare_release_if_possible() {
  if [[ ! -x "$PREPARE_SCRIPT" ]]; then
    log "Prepare script is missing: $PREPARE_SCRIPT"
    return 1
  fi

  log "Preparing standalone release"
  APP_USER="${APP_USER}" bash "$PREPARE_SCRIPT"
}

check_home_html() {
  curl -fsS --max-time 15 -o "$HTML_FILE" "${APP_URL}${HEALTH_PATH}"
}

extract_first_asset() {
  local pattern="$1"
  grep -oE "$pattern" "$HTML_FILE" | head -n 1 || true
}

check_asset() {
  local asset_path="$1"
  [[ -n "$asset_path" ]] || return 1
  curl -fsS --max-time 15 -o /dev/null "${APP_URL}${asset_path}"
}

main() {
  local css_path=""
  local js_path=""

  restart_nginx_if_needed
  if ! systemctl is-active --quiet "${APP_SERVICE}"; then
    log "${APP_SERVICE}.service is inactive"
    prepare_release_if_possible || true
    restart_app
  fi

  if ! check_home_html; then
    log "Home page check failed"
    prepare_release_if_possible || true
    restart_app
    sleep 5
    check_home_html
  fi

  css_path="$(extract_first_asset '/_next/static/[^"]+\.css')"
  js_path="$(extract_first_asset '/_next/static/[^"]+\.js')"

  if [[ -z "$css_path" || -z "$js_path" ]]; then
    log "Could not extract Next.js assets from home page"
    prepare_release_if_possible || true
    restart_app
    sleep 5
    check_home_html
    css_path="$(extract_first_asset '/_next/static/[^"]+\.css')"
    js_path="$(extract_first_asset '/_next/static/[^"]+\.js')"
  fi

  if ! check_asset "$css_path" || ! check_asset "$js_path"; then
    log "Static asset check failed"
    prepare_release_if_possible || true
    restart_app
    sleep 5
    check_home_html
    css_path="$(extract_first_asset '/_next/static/[^"]+\.css')"
    js_path="$(extract_first_asset '/_next/static/[^"]+\.js')"
    check_asset "$css_path"
    check_asset "$js_path"
  fi

  log "Runtime is healthy"
}

main "$@"
