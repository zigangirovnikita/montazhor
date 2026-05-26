# WalkReel / AI Reel Autopilot

Local MVP for turning raw talking-head footage into a draft short-video edit, then a final vertical MP4.

Core flow:

```text
upload video -> analyze draft -> review + voice correction -> final render -> preview/download
```

This is not a timeline editor. The app is built around an autopilot pipeline and a review screen.

## Requirements

- Node.js `>=22`
- `pnpm`
- SQLite
- FFmpeg and FFprobe available in `PATH`, or the bundled project wrappers in `./bin`
- Python `3.11` virtualenv with `faster-whisper`
- HyperFrames CLI through `npx hyperframes`

Current local setup may need:

```bash
sudo chown -R 501:20 "/Users/nikitazigangirov/.npm"
corepack enable
corepack prepare pnpm@latest --activate
```

If Homebrew is missing:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install ffmpeg python@3.11
```

Whisper setup:

```bash
python3.11 -m venv .venv
. .venv/bin/activate
pip install faster-whisper
```

Whisper models are cached under `storage/models/huggingface` so the app does not depend on write access to `~/.cache/huggingface`.

## Run

```bash
cp .env.example .env
pnpm install
pnpm prisma:generate
pnpm prisma:push
npx hyperframes doctor
pnpm dev
```

If system FFmpeg is not installed, use the project wrappers when checking HyperFrames:

```bash
PATH="$PWD/bin:$PATH" corepack pnpm exec hyperframes doctor
```

The Node pipeline uses `ffmpeg-static` and `ffprobe-static` as fallbacks. HyperFrames still needs enough free memory for Chrome-based rendering.

Open `http://localhost:5001`.

## Pipeline

- `POST /api/projects/upload`: stores original video under `/storage/uploads/{projectId}`.
- `POST /api/projects/{id}/process`: runs analysis and creates a draft proposal.
- `POST /api/projects/{id}/render`: renders the final MP4 after review.
- `GET /api/projects/{id}`: project state, logs, draft, media URLs.
- `GET /api/projects/{id}/download`: final MP4.
- `GET /api/projects/{id}/transcript`: transcript JSON.
- `GET /api/projects/{id}/edl`: edit decision list JSON.

## MVP Limits

- The local queue is in-memory and intended for one local user.
- Voice commands are transcribed locally, but automatic intent application is stubbed.
- HyperFrames inserts are optional. If rendering fails, the final video continues without inserts.
- Face tracking, cloud storage, auth, billing, and social publishing are intentionally out of scope.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm prisma:generate
pnpm prisma:push
```
