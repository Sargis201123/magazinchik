#!/usr/bin/env bash
# Сборка промо-ролика: bash promo/build.sh <язык> [<голос>]
#   bash promo/build.sh ru alexandr   bash promo/build.sh ru veronica   bash promo/build.sh en jesse
#   bash promo/build.sh ru            — превью без голоса
# Голос: promo/voice/<язык>/<голос>/voice.mp3 или .../lines/01.mp3 … (сделать через API: python3 promo/voice/tts.py).
# Подробно — promo/README.md. Переснять кадры игры: bash promo/build.sh <язык> --record
set -euo pipefail
cd "$(dirname "$0")/.."
lang="${1:-ru}"
if [[ " $* " == *" --record "* ]]; then
  npx vite build
  npx vite preview --port 4173 --strictPort >/dev/null 2>&1 &
  server=$!
  trap 'kill $server 2>/dev/null || true' EXIT
  sleep 3
  NODE_PATH="${NODE_PATH:-$(npm root -g)}" npx vite-node promo/record.ts -- --port 4173 --lang "$lang"
fi
python3 promo/voice/make_texts.py >/dev/null
python3 promo/build.py "$@"
