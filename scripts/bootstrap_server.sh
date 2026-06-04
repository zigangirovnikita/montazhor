#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/bootstrap_server.sh"
  exit 1
fi

APP_USER="${APP_USER:-montazhor}"
APP_DIR="${APP_DIR:-/opt/montazhor}"
NODE_MAJOR="${NODE_MAJOR:-22}"
PNPM_VERSION="${PNPM_VERSION:-10.21.0}"

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  ffmpeg \
  git \
  nginx \
  python3 \
  python3-pip \
  python3-venv \
  sqlite3

if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "${APP_USER}"
fi

mkdir -p "${APP_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

if ! command -v node >/dev/null 2>&1 || ! node -v | grep -q "^v${NODE_MAJOR}\."; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y --no-install-recommends nodejs
fi

corepack enable
corepack prepare "pnpm@${PNPM_VERSION}" --activate

cat <<EOF
Bootstrap complete.

Prepared:
- user: ${APP_USER}
- app dir: ${APP_DIR}
- node: $(node -v)
- pnpm: $(pnpm -v)
- python: $(python3 --version)
- ffmpeg: $(ffmpeg -version | head -n 1)

Next:
1. Copy the repo into ${APP_DIR}
2. Copy .env.production based on .env.production.example
3. Run deploy steps as ${APP_USER}
EOF
