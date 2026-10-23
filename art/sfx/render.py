"""Звуки действий и голоса героев: исходники (записи Kenney CC0 и свой синтез) → два файла-«ленты»
в public/audio/sfx (Ogg Opus для Android/ПК и M4A/AAC для iPhone), таблица кусков для игры
(src/platform/sfxData.ts) и список источников (art/sfx/SOURCES.md).

    python3 art/sfx/render.py              # всё
    python3 art/sfx/render.py --no-encode  # только WAV в art/build/sfx и отчёт

Лента: в начале — метка (короткий тональный щелчок, в игре не звучит: по ней игра узнаёт, на сколько
кодек сдвинул звук), дальше куски через паузы. Каждый кусок нормирован по пику, а громкость в игре
задаёт его множитель gain: он подобран так, чтобы звук в модели динамика телефона был так же громок,
как синтезированный звук, который он заменяет (common.references), с поправкой trim (дБ).
"""

import json
import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import common  # noqa: E402
import sources  # noqa: E402
import synth  # noqa: E402
import voice  # noqa: E402
from common import SR, cut, hp, lp, loud, resample, tail_trim  # noqa: E402

ROOT = HERE.parent.parent
OUT = ROOT / "public" / "audio" / "sfx"
BUILD = ROOT / "art" / "build" / "sfx"
TS = ROOT / "src" / "platform" / "sfxData.ts"
MANIFEST = HERE / "manifest.json"

GAP = {"sfx": 0.08, "voice": 0.05}  # тишина перед каждым куском: запас на сдвиг кодека
MARK_AT = 0.05
PEAK_DB = {"sfx": -1.5, "voice": -2.5}  # AAC «перелетает» пик голосов почти на 2 дБ

# Битрейты: клиент качает один формат. Звуки — с транзиентами (монетки, стекло), голоса — до 6.5 кГц.
ENC = {
    "sfx": {"opus": ["-b:a", "48k", "-cutoff", "20000"], "aac": ["-b:a", "64k", "-cutoff", "15000"]},
    "voice": {"opus": ["-b:a", "32k", "-cutoff", "8000"], "aac": ["-b:a", "40k", "-ar", "24000", "-cutoff", "8000"]},
}

KENNEY = "CC0 1.0 (Kenney, www.kenney.nl; License.txt набора)"
OWN = "свой синтез (art/sfx), без чужих прав"


def take(rel, start=0.0, dur=None, rate=1.0, hp_hz=200, lp_hz=None, pre=0.004, fade=None, gate_db=None):
    """Кусок записи: [start, start+dur] с плавными краями, высота × rate, без «подвала» ниже hp_hz."""
    x = sources.load(rel)
    if dur is None:
        dur = len(x) / SR - start
    y = cut(x, start, dur, pre=pre, fade_out=fade)
    if gate_db is not None:
        y = common.gate(y, gate_db)
    y = resample(y, rate)
    if hp_hz:
        # Круто (36 дБ/окт): в записях гул комнаты ниже 150 Гц, телефон его не сыграет, а запас громкости он съест.
        y = hp(y, hp_hz, 6)
    if lp_hz:
        y = lp(y, lp_hz)
    return tail_trim(y, -55)


def note_take(rel, start=0.0, dur=None, rate=1.0, **kw):
    pack, name = rel.split("/", 1)
    what = f"{sources.PACKS[pack]} / {name}"
    if start or dur:
        what += f", {start:.2f}–{start + (dur or 0):.2f} с" if dur else f", с {start:.2f} с"
    if rate != 1.0:
        what += f", высота ×{rate:g}"
    return what


def rec(rel, start=0.0, dur=None, rate=1.0, **kw):
    return take(rel, start, dur, rate, **kw), note_take(rel, start, dur, rate), KENNEY


def own(x, what):
    return x, what, OWN


K = "kenney-impact-sounds/"
R = "kenney-rpg-audio/"
C = "kenney-casino-audio/"


def sfx_bank():
    """Звуки действий: id → (опорный синтез, поправка дБ, варианты [(сигнал, откуда, лицензия)])."""
    till_src = f"{OWN}; щелчок рычага — {sources.PACKS['kenney-rpg-audio']} / metalLatch.ogg, мелочь — handleCoins2.ogg ({KENNEY})"
    mop_src = f"{OWN}; брызги — {sources.PACKS['kenney-foley-sounds']} / sinkWater3.ogg ({KENNEY})"
    return {
        # Касса
        "scan": ("scan", 0, [own(synth.scanner(i), f"сканер: пьезо «пик» {i + 1}") for i in range(4)]),
        # Касса (рычаг, звонок, ящик, а следом мелочь) длиннее монетки, которую заменяет: равнять по самому
        # громкому окну мало — тише на 5 дБ, чтобы и вся её энергия была меньше, чем у прежней монетки (check.py).
        "till": ("coin", -5, [(synth.till(i), f"касса: рычаг, звонок, ящик {i + 1}", till_src) for i in range(4)]),
        "coin": ("coin", -2, [
            rec(R + "handleCoins.ogg", 0.105, 0.3),
            rec(R + "handleCoins.ogg", 0.43, 0.3),
            rec(R + "handleCoins2.ogg", 0.0, 0.32),
            rec(R + "handleCoins.ogg", 0.225, 0.22),
            rec(R + "handleCoins.ogg", 0.57, 0.28),
        ]),
        "notes": ("coin", -4, [
            rec(C + "card-fan-1.ogg", 0.14, 0.3),
            rec(C + "card-fan-1.ogg", 0.37, 0.33),
            rec(C + "card-fan-2.ogg", 0.49, 0.3),
            rec(C + "card-fan-2.ogg", 0.8, 0.32),
        ]),
        # Полки по отделам
        "glass": ("pop", 0, [rec(K + f"impactGlass_light_00{i}.ogg", hp_hz=300) for i in range(5)]),
        "tin": ("pop", 0, [rec(K + f"impactTin_medium_00{i}.ogg", hp_hz=200) for i in range(5)]),
        "bump": ("pop", 0, [rec(K + f"impactGeneric_light_00{i}.ogg", hp_hz=250) for i in range(4)]),
        "soft": ("pop", -1, [
            rec(R + "dropLeather.ogg", 0.12, 0.3, hp_hz=170),
            rec(R + "handleSmallLeather.ogg", 0.06, 0.26),
            rec(R + "cloth4.ogg", 0.0, 0.3),
            rec(C + "card-slide-1.ogg", 0.12, 0.28),
        ]),
        "box": ("pop", 0, [
            rec(C + "card-place-1.ogg", 0.13, 0.27, hp_hz=180),
            rec(C + "card-place-3.ogg", 0.27, 0.29, hp_hz=180),
            rec(C + "card-place-4.ogg", 0.11, 0.3, hp_hz=180),
            rec(R + "bookPlace2.ogg", 0.0, 0.25, rate=1.25, hp_hz=180),
        ]),
        "paper": ("pop", -1, [
            rec(C + "card-slide-5.ogg", 0.1, 0.25),
            rec(C + "card-slide-6.ogg", 0.0, 0.14),
            rec(C + "card-slide-6.ogg", 0.145, 0.25),
            rec(C + "card-place-4.ogg", 0.23, 0.22),
        ]),
        # Дверь, печь
        "door": ("chime", 0, [own(synth.door_bell(10 + i, [2, 3, 2][i], [[2093, 2637], [2217, 2794], [1976, 2489]][i], 1.3, 1.0), f"колокольчик над дверью {i + 1}") for i in range(3)]),
        "bell": ("bell", -1, [own(synth.door_bell(20 + i, [5, 4, 6][i], [[1568, 1976], [1760, 2217], [1661, 2093]][i], 1.8, 1.0), f"колокольчик: дверь распахнули {i + 1}") for i in range(3)]),
        "ding": ("bell", -2, [own(synth.ding(i), f"таймер печи {i + 1}") for i in range(2)]),
        # Распаковка, уборка
        "unbox": ("pop", 2, [own(synth.unbox(i), f"скотч и клапаны коробки {i + 1}") for i in range(3)]),
        "boxland": ("tap", 4, [rec(R + f"bookPlace{i}.ogg", hp_hz=170) for i in (1, 2, 3)]),
        "mop": ("pop", -3, [(synth.mop(i), f"швабра {i + 1}", mop_src) for i in range(4)]),
        # Кот и пёс
        "meow": ("meow", 1, [own(synth.meow(i), ["мяу", "короткое «мя»", "«мррау?»", "долгое «мяяу»"][i]) for i in range(4)]),
        "bark": ("bark", 1, [own(synth.bark(i), ["гав", "гав-гав", "тяв-тяв-тяв"][i]) for i in range(3)]),
        # Меню
        "click": ("tap", -3, [rec(K + f"impactWood_light_00{i}.ogg", 0.0, 0.07, rate=1.7, hp_hz=250) for i in range(5)]),
        "page": ("tap", -4, [
            rec(R + "bookFlip2.ogg", 0.0, 0.2),
            rec(R + "bookFlip2.ogg", 0.19, 0.22),
            rec(R + "bookFlip3.ogg", 0.0, 0.22),
        ]),
    }


def voice_bank():
    """Слоги: (голос, начало, гласный) → сигнал; громкость — как у прежнего «пика» голоса."""
    return voice.bank()


def marker():
    n = int(0.005 * SR)
    t = np.arange(n) / SR
    return 0.5 * np.sin(2 * np.pi * 2000 * t) * np.hanning(n)


def first_cross(x, rel=0.5):
    a = np.abs(x)
    return int(np.argmax(a > a.max() * rel))


def assemble(pieces, gap):
    """Куски → лента. Возвращает сигнал, время метки (с) и [(начало, длина)] каждого куска."""
    out = [np.zeros(int(MARK_AT * SR)), marker()]
    pos = sum(len(o) for o in out)
    spots = []
    for x in pieces:
        out.append(np.zeros(int(gap * SR)))
        pos += int(gap * SR)
        spots.append((pos / SR, len(x) / SR))
        out.append(x)
        pos += len(x)
    out.append(np.zeros(int(0.2 * SR)))
    y = np.concatenate(out)
    mark = first_cross(y[: int((MARK_AT + 0.01) * SR)]) / SR
    return y, mark, spots


def write_wav(path, x):
    import wave
    pcm = (np.clip(x, -1, 1) * 32767).round().astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def encode(x, base, kind):
    raw = np.ascontiguousarray(x.astype("<f4")).tobytes()
    common_in = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "pipe:"]
    tail = ["-map_metadata", "-1", "-fflags", "+bitexact"]
    subprocess.run(common_in + ["-c:a", "libopus", "-vbr", "on", "-compression_level", "10", "-application", "audio"]
                   + ENC[kind]["opus"] + tail + [str(base.with_suffix(".ogg"))], input=raw, check=True)
    subprocess.run(common_in + ["-c:a", "aac"] + ENC[kind]["aac"] + ["-movflags", "+faststart"] + tail
                   + [str(base.with_suffix(".m4a"))], input=raw, check=True)


def r4(v):
    return float(f"{v:.4g}")


def main(argv):
    encode_files = "--no-encode" not in argv
    sources.fetch(verbose=False)
    BUILD.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    ref = common.references()
    peak = 10 ** (PEAK_DB["sfx"] / 20)

    # ---- звуки действий
    bank = sfx_bank()
    pieces, table, notes = [], {}, []
    for sid, (rkey, trim, variants) in bank.items():
        for x, what, lic in variants:
            y = x * (peak / (np.abs(x).max() + 1e-12))
            low = common.low_share(y)
            gain = 10 ** ((ref[rkey] + trim - loud(y)) / 20)
            table.setdefault(sid, []).append({"i": len(pieces), "gain": gain, "low": low})
            notes.append((sid, what, lic))
            pieces.append(y)
    sfx, sfx_mark, sfx_spots = assemble(pieces, GAP["sfx"])

    # ---- голоса
    vb = voice_bank()
    vpieces, vtable = [], {}
    vpeak = 10 ** (PEAK_DB["voice"] / 20)
    for (vid, onset, vowel), x in vb.items():
        y = x * (vpeak / (np.abs(x).max() + 1e-12))
        gain = 10 ** ((ref["voice"] - loud(y)) / 20)
        vtable.setdefault(vid, []).append({"i": len(vpieces), "gain": gain})
        vpieces.append(y)
    vox, vox_mark, vox_spots = assemble(vpieces, GAP["voice"])

    write_wav(BUILD / "sfx.wav", sfx)
    write_wav(BUILD / "voice.wav", vox)
    if encode_files:
        encode(sfx, OUT / "sfx", "sfx")
        encode(vox, OUT / "voice", "voice")

    def seg(spots, e):
        at, dur = spots[e["i"]]
        return [round(at, 4), round(dur, 4), r4(e["gain"])]

    manifest = {
        "sampleRate": SR,
        "sfx": {"path": "audio/sfx/sfx", "marker": round(sfx_mark, 5), "duration": round(len(sfx) / SR, 3),
                "sounds": {k: [seg(sfx_spots, e) for e in v] for k, v in table.items()}},
        "voice": {"path": "audio/sfx/voice", "marker": round(vox_mark, 5), "duration": round(len(vox) / SR, 3),
                  "onsets": voice.ONSETS, "vowels": voice.VOWELS,
                  "voices": {k: [seg(vox_spots, e) for e in v] for k, v in vtable.items()}},
        "references": {k: round(v, 1) for k, v in ref.items()},
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n")
    write_ts(manifest)
    write_sources(notes, manifest)
    for sid, entries in table.items():
        lows = ", ".join(f"{e['low']:.0f}" for e in entries)
        gains = ", ".join(f"{20 * np.log10(e['gain']):.1f}" for e in entries)
        print(f"{sid:8s} ×{len(entries)}  усиление, дБ: {gains}  ниже 150 Гц, дБ: {lows}")
    print(f"лента звуков {len(sfx) / SR:.1f} с, голосов {len(vox) / SR:.1f} с")
    if encode_files:
        for f in sorted(OUT.iterdir()):
            print(f"  {f.name}: {f.stat().st_size / 1024:.0f} КБ")


def write_ts(m):
    s = m["sfx"]
    v = m["voice"]
    ids = list(s["sounds"])
    lines = [
        "// Создано art/sfx/render.py — руками не править (python3 art/sfx/render.py пересобирает и файлы, и эту таблицу).",
        "// Куски звуковых «лент» public/audio/sfx/sfx и voice: [начало, длина (с), множитель громкости].",
        "// Множитель подобран замером: в модели динамика телефона кусок звучит так же громко, как",
        "// синтезированный звук, который он заменяет (art/sfx/common.py, references).",
        "",
        "export type Segment = readonly [at: number, dur: number, gain: number];",
        "",
        "/** Лента: путь без расширения, где в файле метка (по ней ищется сдвиг кодека) и длина. */",
        "export interface Bank {",
        "  path: string;",
        "  marker: number;",
        "  duration: number;",
        "}",
        "",
        f"export type SfxId = {' | '.join(repr(i) for i in ids)};",
        "",
        f"export const SFX_BANK: Bank = {{ path: '{s['path']}', marker: {s['marker']}, duration: {s['duration']} }};",
        "",
        "export const SFX: Record<SfxId, readonly Segment[]> = {",
    ]
    for k in ids:
        segs = ", ".join(f"[{a}, {d}, {g}]" for a, d, g in s["sounds"][k])
        lines.append(f"  {k}: [{segs}],")
    lines += [
        "};",
        "",
        f"export const VOICE_BANK: Bank = {{ path: '{v['path']}', marker: {v['marker']}, duration: {v['duration']} }};",
        "",
        "/** Слоги банка: начала × гласные, по порядку (м + а, м + о, …). Пустое начало — слог с гласного. */",
        f"export const ONSETS = [{', '.join(repr(o) for o in v['onsets'])}] as const;",
        f"export const VOWELS = [{', '.join(repr(o) for o in v['vowels'])}] as const;",
        "",
        "/** Голоса: низкий (мужской) и высокий (женский); слог (начало i, гласный j) — индекс i × VOWELS.length + j. */",
        "export const SYLLABLES: Record<'low' | 'high', readonly Segment[]> = {",
    ]
    for k, segs in v["voices"].items():
        body = ", ".join(f"[{a}, {d}, {g}]" for a, d, g in segs)
        lines.append(f"  {k}: [{body}],")
    lines += ["};", ""]
    TS.write_text("\n".join(lines))


def write_sources(notes, m):
    out = [
        "# Звуки действий и голоса: откуда каждый звук",
        "",
        "Всё, что лежит в `public/audio/sfx/`, собирает `art/sfx/render.py` из двух источников:",
        "",
        "- **записи Kenney** (www.kenney.nl) — наборы *Impact Sounds*, *RPG Audio*, *Casino Audio*, *Foley Sounds*,",
        "  лицензия **CC0 1.0** (`License.txt` каждого набора: «free to use in personal, educational and commercial",
        "  projects», указывать автора не обязательно). Файлы скачивает `art/sfx/sources.py` из зеркала",
        "  `series-ai/jam-ready-assets` на GitHub и сверяет с контрольными суммами SHA-256 (они же — в Git LFS зеркала);",
        "  лицензия набора скачивается рядом и проверяется на CC0;",
        "- **свой синтез** (`art/sfx/synth.py`, `art/sfx/voice.py`) — numpy, без чужих записей: колокольчики, сканер,",
        "  касса, швабра, скотч, кот, пёс и все слоги голосов. Чужих прав в нём нет, указывать авторов не нужно.",
        "",
        "Записанных голосов кота и собаки под CC0 отсюда достать не удалось (freesound, BigSoundBank и OpenGameArt",
        "закрыты для этой машины, а копии в чужих репозиториях — без проверяемой лицензии), поэтому они синтезированы",
        "моделью голоса. Свою запись можно подложить вместо синтеза: функция `meow`/`bark` в `synth.py` → чтение файла.",
        "",
        "Проверка уровней: `python3 art/sfx/check.py` (пик, RMS, длительность, доля «подвала» каждого куска).",
        "",
        "## Ленты",
        "",
        f"- `sfx.ogg` / `sfx.m4a` — звуки действий, {m['sfx']['duration']} с;",
        f"- `voice.ogg` / `voice.m4a` — слоги голосов, {m['voice']['duration']} с, {len(m['voice']['onsets']) * len(m['voice']['vowels'])} слогов × 2 голоса,",
        "  свой синтез (`voice.py`), без чужих прав.",
        "",
        "## Звуки действий",
        "",
        "| звук | вариант | откуда | лицензия |",
        "|---|---|---|---|",
    ]
    count = {}
    for sid, what, lic in notes:
        count[sid] = count.get(sid, 0) + 1
        out.append(f"| `{sid}` | {count[sid]} | {what} | {lic} |")
    out.append("")
    (HERE / "SOURCES.md").write_text("\n".join(out))


if __name__ == "__main__":
    main(sys.argv[1:])
