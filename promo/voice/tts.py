#!/usr/bin/env python3
"""Голос ролика через API ElevenLabs: каждая реплика из promo/lines.json → promo/voice/<язык>/<голос>/lines/NN.mp3.

Запуск: ELEVENLABS_API_KEY=… python3 promo/voice/tts.py [ru alexandr] [--force]
Без аргументов — все голоса всех языков (lines.json → langs.*.voices). Ключ берётся только из
переменной окружения ELEVENLABS_API_KEY; в репозиторий и в логи он не попадает.

Голос ищется по имени из lines.json: сначала среди голосов аккаунта, потом в общей библиотеке
(shared voices). Модель — самая новая из доступных ключу (v4 → v3 → multilingual v2), либо
ELEVEN_MODEL. Уже готовые файлы не переделываются (--force — переделать).
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPT = json.loads((HERE.parent / "lines.json").read_text(encoding="utf-8"))
API = "https://api.elevenlabs.io"
#: Тёплый, живой, но ровный голос (как в подсказке script_for_elevenlabs.txt).
SETTINGS = {"stability": 0.5, "similarity_boost": 0.75, "style": 0.25, "use_speaker_boost": True}


def key() -> str:
    k = os.environ.get("ELEVENLABS_API_KEY") or os.environ.get("XI_API_KEY")
    if not k:
        sys.exit("Нет ключа: задайте ELEVENLABS_API_KEY в окружении.")
    return k


def call(path: str, body: dict | None = None, raw: bool = False):
    req = urllib.request.Request(API + path, method="POST" if body is not None else "GET")
    req.add_header("xi-api-key", key())
    if body is not None:
        req.add_header("Content-Type", "application/json")
        req.data = json.dumps(body).encode()
    if raw:
        req.add_header("Accept", "audio/mpeg")
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as res:
                data = res.read()
                return data if raw else json.loads(data)
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:400]
            if e.code in (429, 500, 502, 503) and attempt < 3:
                time.sleep(2 ** (attempt + 1))
                continue
            raise RuntimeError(f"{e.code} {path.split('?')[0]}: {detail}") from None


def pick_model() -> str:
    if os.environ.get("ELEVEN_MODEL"):
        return os.environ["ELEVEN_MODEL"]
    ids = [m["model_id"] for m in call("/v1/models") if m.get("can_do_text_to_speech", True)]
    for want in ("v4", "v3", "multilingual_v2"):
        hit = next((i for i in ids if want in i), None)
        if hit:
            return hit
    return ids[0]


def find_voice(name: str) -> str:
    """ID голоса по имени («Alexandr Vlasov – …»): сравниваем по первой части имени."""
    short = name.split("–")[0].split("-")[0].strip().lower()
    for v in call("/v1/voices").get("voices", []):
        if v["name"].lower().startswith(short):
            return v["voice_id"]
    q = urllib.parse.urlencode({"search": short, "page_size": 30})
    for v in call(f"/v1/shared-voices?{q}").get("voices", []):
        if v["name"].lower().startswith(short):
            return v["voice_id"]
    sys.exit(f"Голос «{name}» не найден ни в аккаунте, ни в библиотеке ElevenLabs.")


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    force = "--force" in sys.argv
    model = pick_model()
    print(f"Модель: {model}")
    for lang, spec in SCRIPT["langs"].items():
        if args and args[0] != lang:
            continue
        for folder, name in spec["voices"].items():
            if len(args) > 1 and args[1] != folder:
                continue
            voice = find_voice(name)
            out = HERE / lang / folder / "lines"
            out.mkdir(parents=True, exist_ok=True)
            texts = [l["voice"] for l in spec["lines"]]
            for i, l in enumerate(spec["lines"]):
                dst = out / f"{l['id']}.mp3"
                if dst.exists() and not force:
                    continue
                body = {
                    "text": l["voice"],
                    "model_id": model,
                    "voice_settings": SETTINGS,
                    "language_code": lang,
                    # Соседние реплики — чтобы интонация шла одной речью, а не 14 отдельными фразами.
                    "previous_text": " ".join(texts[max(0, i - 2): i]) or None,
                    "next_text": " ".join(texts[i + 1: i + 3]) or None,
                }
                path = f"/v1/text-to-speech/{voice}?output_format=mp3_44100_192"
                try:
                    audio = call(path, body, raw=True)
                except RuntimeError as e:
                    # Не все модели принимают соседний текст и язык — тогда без них.
                    if not str(e).startswith("4"):
                        raise
                    for k in ("previous_text", "next_text", "language_code"):
                        body.pop(k, None)
                    audio = call(path, body, raw=True)
                dst.write_bytes(audio)
                print(f"  {lang}/{folder} {l['id']}: {len(audio) // 1024} КБ")
            print(f"{lang}/{folder}: готово ({name})")


if __name__ == "__main__":
    main()
