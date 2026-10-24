"""Проверка уровней звуков действий и голосов (послушать нельзя — меряем): для каждой ленты в
public/audio/sfx — размер, длина, пик и RMS, а для каждого куска (по manifest.json) — длина, пик,
RMS, доля «подвала» ниже 150 Гц, громкость в модели телефона с множителем игры (должна совпадать
с опорной у синтезированного звука), вся энергия куска (у длинного звука она больше при том же окне)
и отношение сигнал/шум кодека к исходнику (art/build/sfx/*.wav). Касса с мелочью сверяется с прежней
монеткой по энергии: она звучит на каждой покупке и не должна быть «тяжелее».

    python3 art/sfx/check.py          # обе ленты, оба формата
    python3 art/sfx/check.py --brief  # только итоги по файлам и по звукам
"""

import json
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import common  # noqa: E402
from common import SR  # noqa: E402

ROOT = HERE.parent.parent
OUT = ROOT / "public" / "audio" / "sfx"
BUILD = ROOT / "art" / "build" / "sfx"

REF = {"scan": "scan", "till": "coin", "coin": "coin", "notes": "coin", "glass": "pop", "tin": "pop", "bump": "pop", "soft": "pop",
       "box": "pop", "paper": "pop", "door": "chime", "bell": "bell", "ding": "bell", "unbox": "pop", "boxland": "tap", "mop": "pop",
       "meow": "meow", "bark": "bark", "click": "tap", "page": "tap"}
# Как в игре (src/platform/sound.ts, till): мелочь или купюры ложатся через 0,2 с, вдвое тише.
PAY_AT, PAY_GAIN = 0.2, 0.5


def decode(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SR), "pipe:"],
                       capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype="<f4").astype(float)


def read_wav(path):
    with wave.open(str(path)) as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(float) / 32767


def db(v):
    return 20 * np.log10(max(v, 1e-9))


def marker_shift(x, expected):
    """Как в игре (src/platform/foley.ts, markerShift): где метка в разобранном звуке минус где она в исходнике.
    Порог — половина пика самой метки (10 мс с того места, где стало громко), а не первого куска за ней."""
    a = np.abs(x[: int((expected + 0.25) * SR)])
    loud = np.nonzero(a >= 0.05)[0]
    if not len(loud):
        return 0.0
    w = a[loud[0]:loud[0] + int(np.ceil(0.01 * SR))]
    return (loud[0] + int(np.argmax(w > w.max() * 0.5))) / SR - expected


def _mag(x, n=1024, hop=256):
    x = np.pad(x, (0, max(0, n - len(x))))
    w = np.hanning(n)
    return np.array([np.abs(np.fft.rfft(w * x[i:i + n])) for i in range(0, len(x) - n + 1, hop)])


def snr(ref, got):
    """ОСШ кодека по модулю спектра (фазу Opus и AAC на верхах не хранят — по форме волны мерить нечестно)."""
    k = min(len(ref), len(got))
    S, D = _mag(ref[:k]), _mag(got[:k])
    return 10 * np.log10(np.sum(S ** 2) / (np.sum((S - D) ** 2) + 1e-15) + 1e-15)


def till_energy(x, sounds, shift):
    """Самая «тяжёлая» касса с оплатой (каждый вариант кассы × каждый вариант мелочи и купюр), дБ."""
    def piece(seg):
        at, dur, gain = seg
        a = int((at + shift) * SR)
        return x[a:a + int(dur * SR)] * gain
    worst = -np.inf
    for till in map(piece, sounds["till"]):
        for pay in [piece(p) for p in sounds["coin"] + sounds["notes"]]:
            a = int(PAY_AT * SR)
            mix = np.zeros(max(len(till), a + len(pay)))
            mix[:len(till)] += till
            mix[a:a + len(pay)] += pay * PAY_GAIN
            worst = max(worst, common.energy(mix))
    return worst


def main(argv):
    brief = "--brief" in argv
    m = json.loads((HERE / "manifest.json").read_text())
    ref = m["references"]
    old_coin = common.energy(common.reference_sounds()["coin"])
    total = {"ogg": 0, "m4a": 0}
    for bank in ("sfx", "voice"):
        b = m[bank]
        src = BUILD / f"{bank}.wav"
        source = read_wav(src) if src.exists() else None
        for ext in ("ogg", "m4a"):
            f = OUT / f"{bank}.{ext}"
            x = decode(f)
            total[ext] += f.stat().st_size
            shift = marker_shift(x, b["marker"])
            body = x[int((b["marker"] + 0.05) * SR):]
            loudpart = body[np.abs(body) > 1e-4]
            print(f"{f.name:10s} {f.stat().st_size / 1024:6.1f} КБ  {len(x) / SR:5.1f} с  пик {db(np.abs(x).max()):6.1f} дБ  "
                  f"RMS звука {db(np.sqrt(np.mean(loudpart ** 2))):6.1f} дБ  сдвиг кодека {shift * 1000:+.1f} мс")
            if bank == "sfx":
                groups = b["sounds"].items()
            else:
                groups = b["voices"].items()
            for sid, segs in groups:
                rows = []
                for at, dur, gain in segs:
                    a = int((at + shift) * SR)
                    seg = x[a:a + int(dur * SR)]
                    row = {
                        "dur": dur,
                        "peak": db(np.abs(seg).max()),
                        "rms": db(np.sqrt(np.mean(seg ** 2))),
                        "low": common.low_share(seg),
                        "game": common.loud(seg * gain),
                        "energy": common.energy(seg * gain),
                    }
                    if source is not None:
                        s0 = int(at * SR)
                        row["snr"] = snr(source[s0:s0 + int(dur * SR)], seg)
                    rows.append(row)
                target = ref[REF[sid]] if bank == "sfx" else ref["voice"]
                game = [r["game"] for r in rows]
                line = (f"   {sid:8s} ×{len(rows):3d} длина {min(r['dur'] for r in rows):.2f}–{max(r['dur'] for r in rows):.2f} с  "
                        f"пик {max(r['peak'] for r in rows):5.1f}  RMS {np.mean([r['rms'] for r in rows]):6.1f}  "
                        f"ниже 150 Гц ≤{max(r['low'] for r in rows):5.1f} дБ  в игре {min(game):6.1f}…{max(game):6.1f} (опора {target})  "
                        f"энергия ≤{max(r['energy'] for r in rows):6.1f}")
                if source is not None:
                    line += f"  ОСШ кодека ≥{min(r['snr'] for r in rows):4.1f} дБ"
                print(line)
                if not brief and bank == "sfx":
                    for i, r in enumerate(rows):
                        print(f"       {i + 1}: {r['dur']:.2f} с  пик {r['peak']:5.1f}  RMS {r['rms']:6.1f}  в игре {r['game']:6.1f}"
                              f"  энергия {r['energy']:6.1f}"
                              + (f"  ОСШ {r['snr']:4.1f}" if "snr" in r else ""))
            if bank == "sfx":
                worst = till_energy(x, b["sounds"], shift)
                print(f"   касса с оплатой: энергия ≤{worst:6.1f} дБ, прежняя монетка {old_coin:6.1f} дБ"
                      + ("" if worst <= old_coin else "  ← громче прежней!"))
    print(f"всего: Opus {total['ogg'] / 1024:.0f} КБ (Android, ПК), AAC {total['m4a'] / 1024:.0f} КБ (iPhone)")


if __name__ == "__main__":
    main(sys.argv[1:])
