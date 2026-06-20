# Deploy on Beget Server

This project is prepared to run as a separate Docker container on the existing server.

## What was discovered on `185.77.231.30`

- Active nginx routing currently proxies traffic to `localhost:3001`.
- Docker is installed and already used on the host.
- The available SSH key is read-only and cannot access `/var/run/docker.sock`.

Because of that, the deployment can be prepared from this repo, but the final server commands must be executed with a writable/root-capable account.

## Suggested server layout

- App container: `montazhor`
- Internal app port in container: `5001`
- Host loopback port: `3002`
- Reverse proxy: nginx on the host (or existing nginx container) forwards a dedicated domain/subdomain to `127.0.0.1:3002`

## Files added for deployment

- `Dockerfile`
- `docker-compose.prod.yml`
- `.env.production.example`
- `docker/entrypoint.sh`

## One-time server setup

1. Clone the repository on the server.
2. Create `.env.production` from `.env.production.example`.
3. Fill required secrets:
   - `OPENROUTER_API_KEY`
   - `KIE_API_KEY` if used
   - `PYANNOTE_AUTH_TOKEN` if `VOICE_ACTIVITY_PROVIDER=pyannote`
4. Make sure the server has enough free disk space for:
   - uploaded videos
   - rendered outputs
   - Whisper / pyannote model caches inside `storage/models`

## Deploy commands

```bash
cp .env.production.example .env.production
mkdir -p storage
docker compose -f docker-compose.prod.yml up -d --build
```

## Update commands

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## Check logs

```bash
docker compose -f docker-compose.prod.yml logs -f montazhor
```

## nginx example

Replace the domain with the one you want to use for this app.

```nginx
server {
    listen 80;
    server_name montazhor.example.com;

    client_max_body_size 2g;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Notes

- This container keeps SQLite and all generated assets under `./storage` on the host.
- First boot may take a long time because Python models and Chrome assets can download/build.
- Browser-renderer MVP does not require HyperFrames provisioning on the server.
- CPU-only transcription/rendering on the server will be noticeably slower than local lightweight testing.
- If `pyannote` is too heavy for this host, switch the environment to `VOICE_ACTIVITY_PROVIDER=silero` as a fallback rather than disabling speech detection entirely.
