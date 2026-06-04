#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/montazhor}"
APP_USER="${APP_USER:-montazhor}"
AS_USER_FLAG="${1:-}"
DEFAULT_HYPERFRAMES_BIN="${APP_DIR}/node_modules/.bin/hyperframes"
HYPERFRAMES_BIN="${HYPERFRAMES_BIN:-}"
HF_HOME="${HF_HOME:-$APP_DIR/storage/hyperframes-home}"
HF_CACHE_DIR="${HF_CACHE_DIR:-$HF_HOME/.cache}"
PUPPETEER_CACHE_DIR_VALUE="${PUPPETEER_CACHE_DIR_VALUE:-$HF_CACHE_DIR/puppeteer}"

if [[ "${AS_USER_FLAG}" != "--as-user" && "${EUID}" -eq 0 && -n "${APP_USER}" ]] && id -u "${APP_USER}" >/dev/null 2>&1; then
  mkdir -p "${HF_HOME}" "${HF_CACHE_DIR}" "${PUPPETEER_CACHE_DIR_VALUE}"
  chown -R "${APP_USER}:${APP_USER}" "${HF_HOME}"
  exec runuser -u "${APP_USER}" -- env \
    APP_DIR="${APP_DIR}" \
    APP_USER="${APP_USER}" \
    HYPERFRAMES_BIN="${HYPERFRAMES_BIN}" \
    HF_HOME="${HF_HOME}" \
    HF_CACHE_DIR="${HF_CACHE_DIR}" \
    PUPPETEER_CACHE_DIR_VALUE="${PUPPETEER_CACHE_DIR_VALUE}" \
    bash "$0" --as-user
fi

export APP_DIR
export HOME="${HF_HOME}"
export XDG_CACHE_HOME="${HF_CACHE_DIR}"
export PUPPETEER_CACHE_DIR="${PUPPETEER_CACHE_DIR_VALUE}"
export PUPPETEER_DISABLE_HEADLESS_WARNING="true"
export PRODUCER_BROWSER_GPU_MODE="${PRODUCER_BROWSER_GPU_MODE:-software}"
export PRODUCER_MAX_CONCURRENT_RENDERS="${PRODUCER_MAX_CONCURRENT_RENDERS:-1}"
export HYPERFRAMES_NO_UPDATE_CHECK="1"
export HYPERFRAMES_NO_TELEMETRY="1"

mkdir -p "${HOME}" "${XDG_CACHE_HOME}" "${PUPPETEER_CACHE_DIR}"
cd "${APP_DIR}"

run_hyperframes() {
  if [[ -x "${DEFAULT_HYPERFRAMES_BIN}" ]]; then
    "${DEFAULT_HYPERFRAMES_BIN}" "$@"
    return 0
  fi

  if [[ -n "${HYPERFRAMES_BIN}" ]]; then
    bash -lc "${HYPERFRAMES_BIN} $*"
    return 0
  fi

  echo "HyperFrames CLI is missing: ${DEFAULT_HYPERFRAMES_BIN}" >&2
  exit 1
}

run_hyperframes browser ensure
run_hyperframes browser path >/dev/null
