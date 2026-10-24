"""Проверка готовых файлов атмосферы (public/audio/amb): то, что услышит игрок после декодирования.

Для каждого файла и формата (ogg — Opus, m4a — AAC): длительность, пик и true-peak, RMS, громкость
(LUFS); у петель — шов: WebAudio играет конец петли и сразу её начало, а в файле за концом петли лежит
её же начало «по кругу» (так кодек прошёл переход непрерывно). Сравниваем стык с этим эталоном:
diff — разница в дБ относительно сигнала (шум кодека; у шума вроде дождя она велика и неважна),
jump — скачок на самом стыке против самого большого естественного шага рядом (щелчок дал бы jump ≫ step). У нарезки — каждый кусок: длина, пик,
RMS и тишина вокруг (кусок не начинается и не кончается на полуслове — без щелчка).

    python3 art/ambience/check.py           # всё по manifest.json
    python3 art/ambience/check.py rain      # выборочно
Выход с кодом 1, если что-то не в порядке (перегруз, шов, длина, нет файла).
"""

import json
import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "music"))

import dsp  # noqa: E402
from dsp import SR  # noqa: E402

ROOT = HERE.parent.parent
OUT = ROOT / "public" / "audio" / "amb"


def decode(path, ch):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path), "-f", "f32le", "-ac", str(ch),
                        "-ar", str(SR), "pipe:"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype="<f4").reshape(-1, ch).T.astype(float)


def db(v):
    return float(20 * np.log10(max(v, 1e-12)))


def seam(d, s, e, k):
    """Шов петли после сглаживания, как его делает игра (playlist.ts smoothSeam: k отсчётов)."""
    y = d.copy()
    i = np.arange(k) / k
    y[:, e - k: e] = y[:, e - k: e] * (1 - i) + y[:, s - k: s] * i
    W = int(0.05 * SR)
    played = np.concatenate([y[:, e - W: e], y[:, s: s + W]], axis=1)
    natural = d[:, e - W: e + W]
    diff = db(np.sqrt(np.mean((played - natural) ** 2))) - db(np.sqrt(np.mean(natural ** 2)))
    jump = float(np.abs(played[:, W] - played[:, W - 1]).max())
    step = float(np.abs(np.diff(natural, axis=1)).max())
    return diff, jump, step


def main(argv):
    manifest = json.loads((OUT / "manifest.json").read_text())
    names = [a for a in argv if not a.startswith("--")] or list(manifest["files"])
    bad = []
    total = 0
    for name in names:
        e = manifest["files"][name]
        ch = e["channels"]
        for ext in ("ogg", "m4a"):
            path = ROOT / "public" / f"{e['path']}.{ext}"
            if not path.exists():
                bad.append(f"{name}.{ext}: нет файла")
                continue
            size = path.stat().st_size
            total += size
            d = decode(path, ch)
            dur = d.shape[1] / SR
            pk = db(np.max(np.abs(d)))
            tp = float(dsp.todb(dsp.true_peak(d)))
            rms = db(np.sqrt(np.mean(d ** 2)))
            line = f"{name:10s} {ext}  {size / 1024:6.1f} КБ  {dur:6.2f} с  пик {pk:6.2f}  tp {tp:6.2f}  RMS {rms:6.2f} дБ"
            if tp > -0.5:
                bad.append(f"{name}.{ext}: true-peak {tp:.2f} дБ")
            if abs(dur - e["duration"]) > 0.08:
                bad.append(f"{name}.{ext}: длина {dur:.3f} с, ждали {e['duration']}")
            if e["kind"] == "loop":
                s = int(round(e["loopStart"] * SR))
                end = int(round(e["loopEnd"] * SR))
                lufs = dsp.loudness(d[:, s:end], circular=True)
                diff, jump, step = seam(d, s, end, int(0.005 * SR))
                line += f"  {lufs:6.2f} LUFS  шов: разница {diff:6.1f} дБ, скачок {jump:.4f} (естеств. до {step:.4f})"
                # Разница — для сведения: у шума (дождь) кодек каждый раз кодирует его по-разному, и разница
                # велика, хотя на слух стык не отличить. Щелчок — это скачок больше любого естественного шага.
                if jump > max(step * 1.05, 1e-4):
                    bad.append(f"{name}.{ext}: шов петли (скачок {jump:.4f} > {step:.4f})")
            print(line)
            if e["kind"] == "sprite" and ext == "ogg":
                m = d.mean(axis=0)
                for seg in e["segments"]:
                    a = int(seg["start"] * SR)
                    b = a + int(seg["dur"] * SR)
                    y = m[a:b]
                    # Начало — первые полмиллисекунды (дальше уже законная атака удара), конец — 4 мс.
                    head, tail = int(0.0005 * SR), int(0.004 * SR)
                    # Тишина вокруг куска (середина промежутка) — чтобы соседний кусок не «подтекал».
                    gap_before = m[max(0, a - int(0.12 * SR)): max(0, a - int(0.06 * SR))]
                    quiet = db(np.sqrt(np.mean(gap_before ** 2))) if len(gap_before) else -120
                    ends = max(db(np.max(np.abs(y[:head]))), db(np.max(np.abs(y[-tail:]))))
                    print(f"    {seg['id']:18s} {seg['dur']:5.2f} с  пик {db(np.max(np.abs(y))):6.2f}  "
                          f"RMS {db(np.sqrt(np.mean(y ** 2))):6.2f}  края {ends:6.1f}  тишина до {quiet:6.1f} дБ")
                    if quiet > -50:
                        bad.append(f"{name}:{seg['id']}: перед куском не тихо ({quiet:.1f} дБ)")
                    if ends > -30:
                        bad.append(f"{name}:{seg['id']}: громкий край ({ends:.1f} дБ) — щелчок")
    print(f"всего: {total / 1e6:.2f} МБ")
    if bad:
        print("\nНЕ В ПОРЯДКЕ:\n  " + "\n  ".join(bad))
        return 1
    print("всё в порядке")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
