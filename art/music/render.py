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
from harmony import check_harmony, roughness  # noqa: E402

ROOT = HERE.parent.parent
BUILD = ROOT / "art" / "build" / "music"
OUT = ROOT / "public" / "audio" / "music"

# Битрейты: клиент скачивает один формат (Opus — Android/ПК, AAC — iOS), бюджет ~6 МБ — на формат.
# Opus 48 и AAC 60 кбит/с: на 32/40 кбит/с кодек заметно шумел в 250–1000 Гц (ОСШ 10–15 дБ).
# Музыка после «плёнки» срезана выше ~11 кГц, поэтому кодекам велено не тратить биты выше 12 кГц.
# Заставки — Opus 64 (на 48 у колокольчиков ОСШ в 1–5 кГц падало до 0–10 дБ; файлы крошечные).
OPUS_KBPS = {"music": 48, "loop": 48, "sting": 64}
AAC_KBPS = {"music": 60, "loop": 60, "sting": 64}
# AAC — на 32 кГц: верх всё равно срезан на ~11 кГц, а на кадр приходится больше бит.
# (56 кбит/с на 48 кГц у заставок давали ОСШ 3–8 дБ и +1 дБ громкости шумом кодека.)
AAC_RATE = {"music": 32000, "loop": 32000, "sting": 32000}
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
               "-application", "audio", "-cutoff", "12000"]),
        (m4a, ["-c:a", "aac", "-b:a", f"{AAC_KBPS[kind]}k", "-ar", str(AAC_RATE[kind]),
               "-cutoff", "12000", "-movflags", "+faststart"]),
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
    x, rep = r.render()  # громкость — song.lufs
    rep["render_s"] = round(time.time() - t0, 1)
    issues, passing = check_harmony(song)
    rep["harmony_issues"] = issues
    rep["harmony_passing"] = len(passing)
    rep["roughness"] = roughness(song)
    rep["phone"] = checks.phone_report(song, r)
    return x, rep, r


def all_jobs():
    import stingers
    import tracks
    import tracks_radio
    jobs = []
    for k in tracks.SONGS:
        jobs.append((k, "music"))
    for k in tracks_radio.SONGS:
        jobs.append((k, "loop"))
    for k in stingers.SONGS:
        jobs.append((k, "sting"))
    return jobs


def song_by_key(key):
    import stingers
    import tracks
    import tracks_radio
    return {**tracks.SONGS, **tracks_radio.SONGS, **stingers.SONGS}[key]()


def job(args):
    """Один трек: рендер, проверки, кодирование, проверки декодированного. Работает в отдельном процессе."""
    key, kind, encode_on = args
    song = song_by_key(key)
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
            entry["decoded"][ext] = checks.decoded_report(d, entry, kind, body)
    entry["harmony"] = {"issues": rep["harmony_issues"], "passingTones": rep["harmony_passing"],
                        "roughness": rep["roughness"]}
    entry["phone"] = rep["phone"]
    entry["stems"] = rep.get("stems", {})
    if song.meta.get("keySections"):
        spb = 60.0 / song.bpm * song.meter
        entry["keySections"] = [dict(start=round(a * spb, 3), end=round(b * spb, 3), key=k)
                                for a, b, k in song.meta["keySections"]]
    if song.meta.get("baseKey"):
        entry["baseKey"], entry["transpose"] = song.meta["baseKey"], song.meta["transpose"]
    return key, entry, checks.summary_line(key, entry, rep)


def main(argv):
    from concurrent.futures import ProcessPoolExecutor

    encode_on = "--no-encode" not in argv
    workers = next((int(a.split("=")[1]) for a in argv if a.startswith("--jobs=")), 4)
    names = [a for a in argv if not a.startswith("--")]
    jobs = all_jobs()
    if names:
        jobs = [j for j in jobs if j[0] in names]
    BUILD.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    man_path = OUT / "manifest.json"
    rep_path = HERE / "report.json"
    old = json.loads(rep_path.read_text()) if rep_path.exists() else {}
    full = old.get("tracks", {})
    known = {k for k, _ in all_jobs()}
    full = {k: v for k, v in full.items() if k in known}  # убрать записи о том, чего больше нет
    results = {}
    with ProcessPoolExecutor(workers) as ex:
        for key, entry, line in ex.map(job, [(k, kind, encode_on) for k, kind in jobs]):
            full[key] = entry
            results[key] = entry
            print(line, flush=True)
    order = {"music": 0, "loop": 1, "sting": 2}
    full = {k: full[k] for k in sorted(full, key=lambda k: (order[full[k]["kind"]], k))}
    rep_path.write_text(json.dumps({"tracks": full}, ensure_ascii=False, indent=1) + "\n")
    import stingers as st_mod
    keyed = {}
    for sid in st_mod.KEYED:
        keyed[sid] = {k: (sid if k == "C" else f"{sid}_{k}") for k in st_mod.KEYS}
    manifest = {
        "version": 2,
        "sampleRate": SR,
        "motif": "Мотив «Магазинчик»: в до мажоре C D | A G E (затакт, секста вверх, «дзынь» G→E)",
        "playback": ("music — играть один раз с усилением 1.0 (громкость уже разная: ночь тише дня), затем "
                     "пауза silenceAfter (с); loop — WebAudio: loop=true, loopStart/loopEnd из манифеста, "
                     "start(0, loopStart), после decodeAudioData сгладить шов (seamCrossfadeSamples); "
                     "sting — один раз поверх музыки: для stingerKeys взять вариант в тональности текущей "
                     "музыки (key, у петель с модуляцией — keySections: секунды от loopStart), под заставками с duckDb приглушить музыку на их длительность. "
                     "ogg (Opus) — основной формат, m4a (AAC) — для iOS/Safari."),
        "seamCrossfade": ("после decodeAudioData для каждого канала d, s=loopStartSample, e=loopEndSample, "
                          "k=seamCrossfadeSamples: d[e-k+i] = d[e-k+i]*(1-i/k) + d[s-k+i]*i/k, i=0..k-1 — "
                          "убирает разницу шума кодека между копиями начала петли"),
        "seamCrossfadeSamples": 240,
        "stingerKeys": keyed,
        "tracks": {k: checks.manifest_entry(k, e) for k, e in full.items()},
    }
    for sid, db in st_mod.DUCK_DB.items():
        if sid in manifest["tracks"]:
            manifest["tracks"][sid]["duckDb"] = db
    man_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n")
    tot = sum(sum(e.get("bytes", {}).values()) for e in full.values())
    print(f"всего файлов: {tot / 1e6:.2f} МБ (ogg {sum(e.get('bytes', {}).get('ogg', 0) for e in full.values()) / 1e6:.2f}, "
          f"m4a {sum(e.get('bytes', {}).get('m4a', 0) for e in full.values()) / 1e6:.2f})")
    return results


if __name__ == "__main__":
    main(sys.argv[1:])
