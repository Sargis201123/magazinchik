#!/usr/bin/env python3
"""Тексты для ElevenLabs из promo/lines.json: один файл на весь ролик и по файлу на реплику.

script_for_elevenlabs.txt — сверху блок «вставить целиком» (реплики через пустую строку и «...»,
чтобы между ними были паузы: по ним сборка разрежет один общий файл на реплики), ниже — те же
реплики с номерами и подсказки по ударениям. lines/01.txt … — по одной реплике, если удобнее
генерировать по одной. Запуск: python3 promo/voice/make_texts.py
"""

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPT = json.loads((HERE.parent / "lines.json").read_text(encoding="utf-8"))


def main() -> None:
    lines = SCRIPT["lines"]
    paste = "\n\n...\n\n".join(l["voice"] for l in lines)
    numbered = "\n".join(f"{l['id']}. {l['voice']}" for l in lines)
    stress = "\n".join(f"- {s}" for s in SCRIPT.get("stress", []))
    text = f"""Магазинчик — промо-ролик, голос за кадром (ElevenLabs)
Голос: Alexandr Vlasov – Vibrant and Energetic · модель: Eleven v4 · язык: русский
Настроение: тепло, уютно, с улыбкой; не торопиться. Stability ~45–55 %, Similarity ~75 %, Style ~20–30 %.

=== ВСТАВИТЬ ЦЕЛИКОМ (один файл → promo/voice/voice.mp3) ===
(копируйте всё между линиями; «...» между репликами — это паузы, по ним сборка разрежет файл)
------------------------------------------------------------
{paste}
------------------------------------------------------------

=== ПО ОДНОЙ РЕПЛИКЕ (файлы → promo/voice/01.mp3 … {lines[-1]['id']}.mp3) ===
Тексты по одному: promo/voice/lines/01.txt … {lines[-1]['id']}.txt (номер в файл не входит).
{numbered}

=== УДАРЕНИЯ И ПРОИЗНОШЕНИЕ ===
{stress}
- «...» — пауза-вздох; «—» — короткая пауза. Восклицательные знаки — улыбка в голосе, не крик.
"""
    (HERE / "script_for_elevenlabs.txt").write_text(text, encoding="utf-8")
    out = HERE / "lines"
    out.mkdir(exist_ok=True)
    for old in out.glob("*.txt"):
        old.unlink()
    for l in lines:
        (out / f"{l['id']}.txt").write_text(l["voice"] + "\n", encoding="utf-8")
    print(f"{len(lines)} реплик → {HERE / 'script_for_elevenlabs.txt'}, {out}/")


if __name__ == "__main__":
    main()
