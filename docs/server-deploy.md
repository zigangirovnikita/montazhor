# Server Deploy

This project can run fully on a Linux server and should move there before heavy transcription/rendering work.

## Recommended target

- Ubuntu 22.04 or 24.04
- 8 vCPU minimum
- 32 GB RAM recommended
- 150+ GB SSD recommended
- Docker available if you want container deploy

## What to move

Copy these from local machine:

- repo source code
- `.env.production` created from `.env.production.example`
- `storage/uploads`
- `storage/projects`
- `storage/prisma/dev.db` if you want to keep current projects

Do not copy these:

- `node_modules`
- `.next`
- `.pnpm-store`
- `.venv`
- `storage/models` unless you explicitly want to migrate existing model caches

## Option A: native server deploy

Run as root once:

```bash
sudo bash scripts/bootstrap_server.sh
```

Then as app user:

```bash
cd /opt/montazhor
cp .env.production.example .env.production
bash scripts/install_app_server.sh
```

Notes:

- `.env.production.example` now contains native `/opt/montazhor/...` paths for `systemd` deploys.
- `docker-compose.prod.yml` overrides those path variables back to `/app/...` inside the container, so Docker deploy still uses the correct container paths.
- Native standalone deploy now requires `scripts/prepare_standalone_release.sh` after `pnpm build`; `scripts/install_app_server.sh` does this automatically and the systemd start script refuses to boot if `.next/standalone/.next/static` is missing.
- `scripts/start_standalone.sh` now self-repairs missing standalone static assets on startup, and `montazhor-healthcheck.timer` re-checks the homepage plus referenced `_next/static` assets every 2 minutes, auto-preparing the release and restarting the app if the runtime becomes inconsistent after a crash or host restore.

Enable service:

```bash
sudo cp deploy/systemd/montazhor.service /etc/systemd/system/montazhor.service
sudo cp deploy/systemd/montazhor-healthcheck.service /etc/systemd/system/montazhor-healthcheck.service
sudo cp deploy/systemd/montazhor-healthcheck.timer /etc/systemd/system/montazhor-healthcheck.timer
sudo systemctl daemon-reload
sudo systemctl enable --now montazhor
sudo systemctl enable --now montazhor-healthcheck.timer
sudo systemctl status montazhor
sudo systemctl status montazhor-healthcheck.timer
```

Enable nginx:

```bash
sudo cp deploy/nginx/montazhor.conf /etc/nginx/sites-available/montazhor
sudo ln -sf /etc/nginx/sites-available/montazhor /etc/nginx/sites-enabled/montazhor
sudo nginx -t
sudo systemctl reload nginx
```

## Option B: Docker deploy

Create `.env.production`, then:

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

## Runtime notes

- The app stores uploads, projects, models, caches, and SQLite data under `storage`.
- First transcription run will download Whisper/pyannote models into `storage/models`.
- HyperFrames and browser rendering need free RAM and `/dev/shm`; do not undersize the server.
- On server restart, startup recovery now resets stuck processing projects to `error`.

## Suggested migration order

1. Deploy code and env without copying model caches.
2. Copy only `storage/prisma/dev.db`, `storage/uploads`, and `storage/projects`.
3. Start the app and verify project list loads.
4. Run one existing project preview.
5. Only then test new heavy providers like WhisperX or CrisperWhisper.
