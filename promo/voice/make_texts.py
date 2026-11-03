#!/usr/bin/env python3
"""Тексты для ElevenLabs из promo/lines.json: по языку — один файл на весь ролик и по файлу на реплику.

promo/voice/<язык>/script_for_elevenlabs.txt — сверху блок «вставить целиком» (реплики через пустую
строку и «...», чтобы между ними были паузы: по ним сборка разрежет один общий файл на реплики), ниже —
те же реплики с номерами, куда класть звук и подсказки по ударениям. promo/voice/<язык>/lines/01.txt … —
по одной реплике, если удобнее генерировать по одной. Запуск: python3 promo/voice/make_texts.py
"""

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPT = json.loads((HERE.parent / "lines.json").read_text(encoding="utf-8"))

HEAD = {
    "ru": {
        "title": "Магазинчик — промо-ролик, голос за кадром (ElevenLabs)",
        "model": "модель: Eleven v4 · язык: русский",
        "mood": "Настроение: тепло, уютно, с улыбкой; не торопиться. Stability ~45–55 %, Similarity ~75 %, Style ~20–30 %.",
        "paste": "=== ВСТАВИТЬ ЦЕЛИКОМ (один файл) ===",
        "paste_note": "(копируйте всё между линиями; «...» между репликами — это паузы, по ним сборка разрежет файл)",
        "save_whole": "Куда положить: promo/voice/ru/<голос>/voice.mp3",
        "per": "=== ПО ОДНОЙ РЕПЛИКЕ ===",
        "save_per": "Тексты по одному: promo/voice/ru/lines/01.txt …; звук → promo/voice/ru/<голос>/lines/01.mp3 …",
        "voices": "Голоса (папка <голос>)",
        "stress": "=== УДАРЕНИЯ И ПРОИЗНОШЕНИЕ ===",
        "pauses": "- «...» — пауза-вздох; «—» — короткая пауза. Восклицательные знаки — улыбка в голосе, не крик.",
    },
    "en": {
        "title": "Magazinchik — promo video, voice-over (ElevenLabs)",
        "model": "model: Eleven v4 · language: English (American)",
        "mood": "Mood: warm, cosy, smiling; don't rush. Stability ~45–55 %, Similarity ~75 %, Style ~20–30 %.",
        "paste": "=== PASTE AS ONE (single file) ===",
        "paste_note": "(copy everything between the lines; the \"...\" between lines are pauses the build cuts on)",
        "save_whole": "Save to: promo/voice/en/<voice>/voice.mp3",
        "per": "=== ONE LINE AT A TIME ===",
        "save_per": "Texts: promo/voice/en/lines/01.txt …; audio → promo/voice/en/<voice>/lines/01.mp3 …",
        "voices": "Voices (folder <voice>)",
        "stress": "=== PRONUNCIATION ===",
        "pauses": "- \"...\" is a breath pause; \"—\" a short one. Exclamation marks = a smile, not a shout.",
    },
}


def main() -> None:
    for lang, spec in SCRIPT["langs"].items():
        h = HEAD[lang]
        lines = [l for l in spec["lines"] if l["voice"]]
        out = HERE / lang
        out.mkdir(exist_ok=True)
        paste = "\n\n...\n\n".join(l["voice"] for l in lines)
        numbered = "\n".join(f"{l['id']}. {l['voice']}" for l in lines)
        voices = "\n".join(f"- {folder}: {name}" for folder, name in spec["voices"].items())
        stress = "\n".join(f"- {s}" for s in spec.get("stress", []))
        text = f"""{h['title']}
{h['model']}
{h['mood']}

{h['voices']}:
{voices}

{h['paste']}
{h['save_whole']}
{h['paste_note']}
------------------------------------------------------------
{paste}
------------------------------------------------------------

{h['per']}
{h['save_per']}
{numbered}

{h['stress']}
{stress}
{h['pauses']}
"""
        (out / "script_for_elevenlabs.txt").write_text(text, encoding="utf-8")
        per = out / "lines"
        per.mkdir(exist_ok=True)
        for old in per.glob("*.txt"):
            old.unlink()
        for l in lines:
            (per / f"{l['id']}.txt").write_text(l["voice"] + "\n", encoding="utf-8")
        for folder in spec["voices"]:
            (out / folder).mkdir(exist_ok=True)
            keep = out / folder / ".gitkeep"
            if not keep.exists():
                keep.write_text("")
        print(f"{lang}: {len(lines)} реплик → {out / 'script_for_elevenlabs.txt'}")


if __name__ == "__main__":
    main()
