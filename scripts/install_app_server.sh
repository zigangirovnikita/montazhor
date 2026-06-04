#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/montazhor}"
ENV_FILE="${ENV_FILE:-.env.production}"
DATABASE_URL_VALUE="${DATABASE_URL_VALUE:-file:/opt/montazhor/storage/prisma/dev.db}"

cd "${APP_DIR}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${APP_DIR}/${ENV_FILE}"
  echo "Create it from .env.production.example before running this script."
  exit 1
fi

mkdir -p storage/prisma storage/models storage/.cache

if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi

. .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

corepack enable
corepack prepare pnpm@10.21.0 --activate
pnpm install --frozen-lockfile
pnpm prisma:generate
DATABASE_URL="${DATABASE_URL_VALUE}" pnpm prisma:push
pnpm build
bash scripts/prepare_standalone_release.sh

cat <<EOF
Application install complete.

Next:
1. sudo cp deploy/systemd/montazhor.service /etc/systemd/system/montazhor.service
2. sudo cp deploy/systemd/montazhor-healthcheck.service /etc/systemd/system/montazhor-healthcheck.service
3. sudo cp deploy/systemd/montazhor-healthcheck.timer /etc/systemd/system/montazhor-healthcheck.timer
4. sudo systemctl daemon-reload
5. sudo systemctl enable --now montazhor
6. sudo systemctl enable --now montazhor-healthcheck.timer
7. sudo cp deploy/nginx/montazhor.conf /etc/nginx/sites-available/montazhor
8. sudo ln -sf /etc/nginx/sites-available/montazhor /etc/nginx/sites-enabled/montazhor
9. sudo nginx -t && sudo systemctl reload nginx
EOF
