"""Основная музыка игры — шесть треков, сделанных автором в Suno (тариф Pro: коммерческое использование
разрешено). Файлы уже обрезаны, с плавным входом и концом, громкость около −16 LUFS:
public/audio/music/suno/<id>.m4a (AAC 96 кбит/с) и <id>.ogg (Opus 64 кбит/с).

Здесь — их описание для manifest.json: длительность и размер (по самим файлам), громкость и пик,
тональность (оценка по спектру) и поправка громкости для игры (ночь тише дня).

    python3 art/music/suno.py          # обновить записи треков Suno в public/audio/music/manifest.json
    python3 art/music/suno.py --keys   # заново оценить тональности по файлам и показать уверенность

Тональность нужна заставкам: монетка, покупка, рекорд и звание звучат поверх музыки в её тональности
(stingerKeys). Оценка — по хроме: сколько энергии спектра попадает в семь нот каждой мажорной гаммы
(у минора та же гамма, что у параллельного мажора, — заставке важна именно она) и профиль
Крумхансла—Шмуклера для проверки. Этим же способом верно угадываются тональности всех синтезированных
пьес и радиоволн (их тональности известны по нотам).
"""

import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
DIR = ROOT / "public" / "audio" / "music" / "suno"
MANIFEST = ROOT / "public" / "audio" / "music" / "manifest.json"

# key — оценка по спектру (--keys), gainDb — поправка в игре: файлы выровнены на −16 LUFS, а ночь
# задумана тише дня (как и у прежних пьес: утро −17, вечер −17.5, ночь −19). Поправки подобраны
# замером в модели динамика телефона (срез ниже 300 Гц): у вечера много баса, в телефоне он и так
# на ~3.5 дБ тише дня — ему хватает −1 дБ.
SUNO = {
    "theme": dict(title="Тема «Магазинчика»", use="Титульный экран: первый трек каждого захода в игру", key="G", gainDb=0.0),
    "morning": dict(title="Утро", use="Утро: экран закупки и первые часы дня", key="D", gainDb=-1.0),
    "day": dict(title="День", use="День: основной фон торговли", key="C", gainDb=0.0),
    "evening": dict(title="Вечер", use="Вечер: фонари, последние покупатели, итоги дня", key="C", gainDb=-1.0),
    "night": dict(title="Ночная смена", use="Ночная смена: тихий фон ночью", key="D", gainDb=-3.0),
    "winter": dict(title="Зима", use="Зима и Новый год: вместо дня или вечера через раз", key="C", gainDb=0.0),
}
SILENCE_AFTER = [30, 90]

NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
SCALE = [0, 2, 4, 5, 7, 9, 11]
MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def probe(path):
    """Длительность (с) по контейнеру."""
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def loudness(path):
    """Интегральная громкость (LUFS) и true-peak (dBTP) — фильтр ebur128 у ffmpeg."""
    err = subprocess.run(["ffmpeg", "-nostats", "-hide_banner", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    summary = err[err.rfind("Summary:"):]
    lufs = float(re.search(r"I:\s+(-?[\d.]+) LUFS", summary).group(1))
    peak = float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", summary).group(1))
    return lufs, peak


def chroma(path, sr=22050):
    """Хрома по пикам спектра (70–1800 Гц): у каждого окна — доли энергии по 12 нотам."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32)
    n, hop = 8192, 4096
    win = np.hanning(n)
    freqs = np.fft.rfftfreq(n, 1 / sr)
    sel = np.where((freqs > 70) & (freqs < 1800))[0]
    midi = 69 + 12 * np.log2(freqs[sel] / 440)
    near = np.abs(midi - np.round(midi)) < 0.3
    pc = np.round(midi).astype(int) % 12
    c = np.zeros(12)
    for i in range(0, len(x) - n, hop):
        s = np.abs(np.fft.rfft(x[i:i + n] * win))[sel]
        peaks = (s > np.roll(s, 1)) & (s > np.roll(s, -1)) & near
        e = (s ** 2) * peaks
        if e.sum() > 0:
            np.add.at(c, pc, np.sqrt(e / e.sum()))
    return c / c.sum()


def estimate_key(path):
    """(гамма, запас над второй, лучшая по профилю К—Ш): гамма — мажор с теми же семью нотами."""
    c = chroma(path)
    scales = sorted(((sum(c[(i + s) % 12] for s in SCALE), NAMES[i]) for i in range(12)), reverse=True)
    profile = []
    for i in range(12):
        profile.append((np.corrcoef(np.roll(MAJOR, i), c)[0, 1], NAMES[i]))
        profile.append((np.corrcoef(np.roll(MINOR, i), c)[0, 1], NAMES[i] + "m"))
    profile.sort(reverse=True)
    return scales[0][1], round(scales[0][0] - scales[1][0], 3), profile[0][1]


def entry(track_id):
    meta = SUNO[track_id]
    files = {ext: DIR / f"{track_id}.{ext}" for ext in ("ogg", "m4a")}
    durations = {ext: probe(p) for ext, p in files.items()}
    levels = {ext: loudness(p) for ext, p in files.items()}
    return {
        "kind": "music",
        "source": "suno",
        "title": meta["title"],
        "use": meta["use"],
        "files": {ext: f"audio/music/suno/{track_id}.{ext}" for ext in files},
        # Короче из двух: у Opus в конце бывают лишние миллисекунды тишины.
        "duration": round(min(durations.values()), 3),
        "lufs": round(float(np.mean([v[0] for v in levels.values()])), 1),
        "truePeakDb": round(max(v[1] for v in levels.values()), 1),
        "key": meta["key"],
        "keyEstimated": True,
        "gainDb": meta["gainDb"],
        "bytes": {ext: p.stat().st_size for ext, p in files.items()},
        "silenceAfter": SILENCE_AFTER,
    }


def entries():
    return {k: entry(k) for k in SUNO}


def update_manifest():
    """Записи Suno — в манифест (остальное в нём не трогаем)."""
    manifest = json.loads(MANIFEST.read_text())
    tracks = {k: v for k, v in manifest["tracks"].items() if not (v["kind"] == "music")}
    manifest["tracks"] = {**entries(), **tracks}
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n")
    print("манифест:", ", ".join(f"{k} {v['duration']} с {v['key']}" for k, v in manifest["tracks"].items() if v["kind"] == "music"))


if __name__ == "__main__":
    if "--keys" in sys.argv:
        for k, meta in SUNO.items():
            scale, margin, profile = estimate_key(DIR / f"{k}.ogg")
            mark = "" if scale == meta["key"] else f"  ← в таблице {meta['key']}"
            print(f"{k:8} гамма {scale:3} (запас {margin}), профиль {profile}{mark}")
    else:
        update_manifest()
