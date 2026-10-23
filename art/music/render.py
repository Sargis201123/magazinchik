"""Рендер всей музыки «Магазинчика»: партитуры -> WAV (art/build/music) -> Ogg Opus + M4A (AAC)
в public/audio/music, manifest.json и проверки качества.

    python3 art/music/render.py              # всё
    python3 art/music/render.py morning day  # выборочно (манифест дописывается)
    python3 art/music/render.py --no-encode  # только WAV и отчёт
"""

import json
import subprocess
import sys
import time
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import checks  # noqa: E402
import dsp  # noqa: E402
from dsp import SR  # noqa: E402
from engine import Renderer  # noqa: E402
from score import check_harmony  # noqa: E402

ROOT = HERE.parent.parent
BUILD = ROOT / "art" / "build" / "music"
OUT = ROOT / "public" / "audio" / "music"

# Битрейты подобраны под бюджет ~6 МБ на всё (оба формата, ~10 минут музыки). Музыка после
# «плёнки» срезана выше ~11 кГц, поэтому кодекам велено не тратить биты выше 12 кГц (-cutoff).
OPUS_KBPS = {"music": 32, "loop": 32, "sting": 48}
AAC_KBPS = {"music": 40, "loop": 40, "sting": 56}
# AAC для музыки — на 32 кГц: верх всё равно срезан на ~11 кГц, а на кадр приходится больше бит.
AAC_RATE = {"music": 32000, "loop": 32000, "sting": 48000}
LOOP_PAD = 0.5  # секунд «по кругу» до и после петли — шов не зависит от задержки кодека


def write_wav(path, x):
    """16-битный WAV (для прослушивания и как источник кодирования — float32 подаётся отдельно)."""
    import wave
    y = np.clip(x, -1, 1)
    pcm = (y.T * 32767).round().astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def _encode_one(raw, path, args, gain_db=0.0):
    common = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "pipe:"]
    af = ["-af", f"volume={gain_db:.2f}dB"] if gain_db else []
    subprocess.run(common + af + args + ["-map_metadata", "-1", "-fflags", "+bitexact", str(path)], input=raw, check=True)


def encode(x, base, kind, ceiling=-1.0):
    """x (2, n) float -> base.ogg (Opus) и base.m4a (AAC). Если после декодирования true-peak
    выше потолка (кодек «перелетает» пики), файл перекодируется чуть тише."""
    raw = np.ascontiguousarray(x.T.astype("<f4")).tobytes()
    ogg = base.with_suffix(".ogg")
    m4a = base.with_suffix(".m4a")
    jobs = [
        (ogg, ["-c:a", "libopus", "-b:a", f"{OPUS_KBPS[kind]}k", "-vbr", "on", "-compression_level", "10",
               "-application", "audio", "-cutoff", "12000" if kind != "sting" else "20000"]),
        (m4a, ["-c:a", "aac", "-b:a", f"{AAC_KBPS[kind]}k", "-ar", str(AAC_RATE[kind]),
               "-cutoff", "12000" if kind != "sting" else "16000", "-movflags", "+faststart"]),
    ]
    gains = {}
    for path, args in jobs:
        g = 0.0
        for _ in range(4):
            _encode_one(raw, path, args, g)
            tp = float(dsp.todb(dsp.true_peak(decode(path))))
            if tp <= ceiling:
                break
            g -= tp - ceiling + 0.15
        gains[path.suffix[1:]] = round(g, 2)
    return ogg, m4a, gains


def decode(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path), "-f", "f32le", "-ac", "2",
                        "-ar", str(SR), "pipe:"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype="<f4").reshape(-1, 2).T.astype(float)


def render_song(song, kind):
    t0 = time.time()
    r = Renderer(song)
    target = -14.0 if kind == "sting" else -16.0
    x, rep = r.render(target=target)
    rep["render_s"] = round(time.time() - t0, 1)
    issues, passing = check_harmony(song.notes, song.chords, song.meter)
    rep["harmony_issues"] = issues
    rep["harmony_passing"] = len(passing)
    return x, rep, r


def main(argv):
    import stingers
    import tracks
    import tracks_radio

    encode_on = "--no-encode" not in argv
    names = [a for a in argv if not a.startswith("--")]
    jobs = []
    for k, fn in tracks.SONGS.items():
        jobs.append((k, fn, "music"))
    for k, fn in tracks_radio.SONGS.items():
        jobs.append((k, fn, "loop"))
    for k, fn in stingers.SONGS.items():
        jobs.append((k, fn, "sting"))
    if names:
        jobs = [j for j in jobs if j[0] in names]
    BUILD.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    man_path = OUT / "manifest.json"
    rep_path = HERE / "report.json"
    old = json.loads(rep_path.read_text()) if rep_path.exists() else {}
    full = old.get("tracks", {})
    results = {}
    for key, fn, kind in jobs:
        song = fn()
        x, rep, r = render_song(song, kind)
        write_wav(BUILD / f"{key}.wav", x)
        try:
            import viz
            viz.spectrogram_png(x, BUILD / f"{key}.png")
        except Exception as e:  # noqa: BLE001
            print("спектрограмма:", e)
        entry = checks.describe(song, x, kind, rep)
        if kind == "loop":
            pad = int(LOOP_PAD * SR)
            body = np.concatenate([x[:, -pad:], x, x[:, :pad]], axis=1)
            entry["loopStart"] = LOOP_PAD
            entry["loopEnd"] = round(LOOP_PAD + x.shape[1] / SR, 6)
            entry["loopStartSample"] = pad
            entry["loopEndSample"] = pad + x.shape[1]
            entry["fileDuration"] = round(body.shape[1] / SR, 6)
            entry["fileSamples"] = int(body.shape[1])
        else:
            body = x
        if encode_on:
            ogg, m4a, gains = encode(body, OUT / key, kind)
            entry["encodeGainDb"] = gains
            entry["files"] = {"ogg": f"audio/music/{ogg.name}", "m4a": f"audio/music/{m4a.name}"}
            entry["bytes"] = {"ogg": ogg.stat().st_size, "m4a": m4a.stat().st_size}
            entry["decoded"] = {}
            for ext, p in (("ogg", ogg), ("m4a", m4a)):
                d = decode(p)
                entry["decoded"][ext] = checks.decoded_report(d, entry, kind)
        entry["harmony"] = {"issues": rep["harmony_issues"], "passingTones": rep["harmony_passing"]}
        entry["stems"] = rep.get("stems", {})
        full[key] = entry
        results[key] = (entry, rep)
        print(checks.summary_line(key, entry, rep), flush=True)
    order = {"music": 0, "loop": 1, "sting": 2}
    full = {k: full[k] for k in sorted(full, key=lambda k: (order[full[k]["kind"]], k))}
    rep_path.write_text(json.dumps({"tracks": full}, ensure_ascii=False, indent=1) + "\n")
    manifest = {
        "version": 1,
        "sampleRate": SR,
        "motif": "Мотив «Магазинчик»: в до мажоре C D | A G E (затакт, секста вверх, «дзынь» G→E)",
        "playback": ("music — играть один раз, затем пауза silenceAfter (с); loop — WebAudio: loop=true, "
                     "loopStart/loopEnd из манифеста, start(0, loopStart); sting — один раз поверх музыки. "
                     "ogg (Opus) — основной формат, m4a (AAC) — для iOS/Safari."),
        "tracks": {k: checks.manifest_entry(k, e) for k, e in full.items()},
    }
    man_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n")
    tot = sum(sum(e.get("bytes", {}).values()) for e in full.values())
    print(f"всего файлов: {tot / 1e6:.2f} МБ (ogg {sum(e.get('bytes', {}).get('ogg', 0) for e in full.values()) / 1e6:.2f}, "
          f"m4a {sum(e.get('bytes', {}).get('m4a', 0) for e in full.values()) / 1e6:.2f})")
    return results


if __name__ == "__main__":
    main(sys.argv[1:])
