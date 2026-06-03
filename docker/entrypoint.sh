#!/bin/sh
set -eu

mkdir -p \
  /app/storage/prisma \
  /app/storage/models/huggingface \
  /app/storage/models/torch \
  /app/storage/models/pyannote \
  /app/storage/models/nltk_data \
  /app/storage/models/.cache \
  /app/storage/.cache/puppeteer

pnpm prisma:push

exec pnpm start

