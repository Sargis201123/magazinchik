#!/usr/bin/env bash
# Сборка промо-ролика: bash promo/build.sh
# Голос (если есть) — promo/voice/voice.mp3 или promo/voice/01.mp3 … ; без голоса выйдет превью.
# Подробно — promo/README.md. Переснять кадры игры: bash promo/build.sh --record
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "${1:-}" == "--record" ]]; then
  npx vite build
  npx vite preview --port 4173 --strictPort >/dev/null 2>&1 &
  server=$!
  trap 'kill $server 2>/dev/null || true' EXIT
  sleep 3
  NODE_PATH="${NODE_PATH:-$(npm root -g)}" npx vite-node promo/record.ts -- --port 4173
fi
python3 promo/voice/make_texts.py >/dev/null
python3 promo/build.py
