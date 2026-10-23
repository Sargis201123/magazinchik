"""Сборка атмосферы «Магазинчика»: записи CC0 (sources.py) и синтез (synth.py) → WAV (art/build/ambience)
→ Ogg Opus + M4A (AAC) в public/audio/amb и manifest.json.

Что получается (игра качает только то, что нужно сейчас: по погоде, сезону и времени):
  rain        петля ~25 с: дождь за витриной (6 записей CC0, сшиты и выровнены по тембру) + капли по стеклу
  downpour    петля ~21 с: ливень (5 записей CC0) + частые капли по стеклу
  murmur      петля 28 с: гомон покупателей — синтез слогов, слов не разобрать
  birds       нарезка: фразы птиц (5 записей CC0, фон срезан) — весна и лето
  crows       нарезка: «кар-кар» (4 записи CC0) — зима, снег, поздняя осень
  fireworks   нарезка: залпы салюта (записи CC0 с хлопками и шипением) — Новый год
  street      нарезка (синтез): велозвонок, трамвай вдали и его звонок, голуби, «дзинь» фонаря

    python3 art/ambience/render.py              # всё
    python3 art/ambience/render.py rain birds   # выборочно (манифест дописывается)
    python3 art/ambience/render.py --no-encode  # только WAV (art/build/ambience) и спектрограммы
    python3 art/ambience/render.py --ts         # таблица AMB для src/platform/ambienceLayers.ts (после рендера)

Нужны Python 3 с numpy и ffmpeg с libopus и aac. Проверка готовых файлов — art/ambience/check.py.
"""

import json
import subprocess
import sys
import time
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "music"))
sys.path.insert(0, str(HERE))

import dsp  # noqa: E402
import sources  # noqa: E402
import synth  # noqa: E402
from dsp import SR  # noqa: E402

ROOT = HERE.parent.parent
BUILD = ROOT / "art" / "build" / "ambience"
OUT = ROOT / "public" / "audio" / "amb"
MANIFEST = OUT / "manifest.json"

LOOP_PAD = 0.5  # секунд «по кругу» до и после петли: шов не зависит от задержки кодека
GAP = 0.25  # тишина между кусками нарезки, с
# Петли — стерео, нарезки — моно (сторону задаёт игра). Дождь за стеклом выше 12 кГц не нужен.
OPUS_KBPS = {"loop": 48, "sprite": 32}
AAC_KBPS = {"loop": 64, "sprite": 48}
AAC_RATE = 32000
LOOP_LUFS = -22.0
SPRITE_RMS_DB = -20.0  # громкость звучащей части каждого куска нарезки (дБ RMS)

RAIN_LIGHT = ["2-73027-A-10", "5-198321-A-10", "5-181766-A-10", "4-180380-A-10", "2-82367-A-10", "1-21189-A-10"]
RAIN_HEAVY = ["1-50060-A-10", "3-157615-A-10", "1-26222-A-10", "2-87781-A-10", "1-54958-A-10"]
BIRDS = ["2-122616-A-14", "4-187769-B-14", "4-182795-A-14", "3-181132-A-14", "4-223127-A-14"]
CROWS = ["4-188287-A-9", "1-75162-A-9", "1-56233-A-9", "4-138344-A-9"]
FIREWORKS = ["2-117615-A-48", "2-117615-B-48", "2-117615-C-48", "2-117615-D-48", "2-117615-E-48", "2-117616-A-48",
             "1-160563-A-48", "1-160563-B-48"]


# ---------------------------------------------------------------- спектр: окна, шумодав, тембр

def stft(x, n=2048, hop=512):
    win = np.hanning(n)
    pad = np.concatenate([np.zeros(n), x, np.zeros(n)])
    frames = (len(pad) - n) // hop + 1
    idx = np.arange(n)[None] + hop * np.arange(frames)[:, None]
    return np.fft.rfft(pad[idx] * win, axis=1), len(x)


def istft(X, length, n=2048, hop=512):
    win = np.hanning(n)
    frames = X.shape[0]
    y = np.zeros((frames - 1) * hop + n)
    w = np.zeros_like(y)
    seg = np.fft.irfft(X, n, axis=1) * win
    for i in range(frames):
        y[i * hop: i * hop + n] += seg[i]
        w[i * hop: i * hop + n] += win * win
    y /= np.maximum(w, 1e-6)
    return y[n: n + length]


def denoise(x, over=2.2, floor_pct=25):
    """Шумодав: ровный фон (ветер, машины вдали, шипение) — это то, что в каждой полосе частот звучит
    почти всё время; его уровень — нижний процентиль. Всё, что не выше фона в over раз, гасим (мягко)."""
    X, n = stft(x)
    mag = np.abs(X)
    floor = np.percentile(mag, floor_pct, axis=0)
    mask = np.clip((mag - over * floor) / (mag + 1e-12), 0, 1)
    k = np.ones(3) / 3
    mask = np.apply_along_axis(lambda m: np.convolve(m, k, "same"), 0, mask)
    mask = np.apply_along_axis(lambda m: np.convolve(m, np.ones(5) / 5, "same"), 1, mask)
    return istft(X * mask, n)


THIRDS = 1000 * 2.0 ** (np.arange(-14, 12) / 3)  # 40 Гц … 12.7 кГц


def band_levels(x):
    N = dsp.fast_len(len(x))
    P = np.abs(np.fft.rfft(x, N)) ** 2
    f = np.fft.rfftfreq(N, 1 / SR)
    return np.array([P[(f >= c / 2 ** (1 / 6)) & (f < c * 2 ** (1 / 6))].mean() + 1e-20 for c in THIRDS])


def match_tone(clips, limit_db=6.0):
    """Выровнять тембр записей к общему (среднему в логарифме) — сшитые подряд, они звучат как один дождь."""
    levels = [band_levels(c) for c in clips]
    target = np.exp(np.mean([np.log(lv) for lv in levels], axis=0))
    out = []
    for c, lv in zip(clips, levels):
        g_db = np.clip(10 * np.log10(target / lv), -limit_db, limit_db)
        lc = np.log2(THIRDS)
        y = dsp.filt(c, lambda f, g=g_db: dsp.undb(np.interp(np.log2(np.maximum(f, 1)), lc, g)))
        out.append(y / (np.sqrt(np.mean(y * y)) + 1e-12))
    return out


def stitch(clips, xf, order):
    """Петля из записей встык, с равномощными переходами по xf секунд, по кругу."""
    seg = len(clips[0])
    step = seg - int(xf * SR)
    n = step * len(clips)
    k = int(xf * SR)
    w = np.ones(seg)
    w[:k] = np.sin(np.linspace(0, np.pi / 2, k))
    w[-k:] = np.cos(np.linspace(0, np.pi / 2, k))
    out = np.zeros(n)
    for i, j in enumerate(order):
        synth.circ_add(out, clips[j][:seg] * w, i * step)
    return out


# ---------------------------------------------------------------- куски: найти звучащее и вырезать

def regions(x, thr_db, merge, min_len, max_len, pad=0.06):
    """Участки, где звук громче (пик − thr_db): близкие склеены (merge, с), короткие отброшены."""
    hop = int(0.01 * SR)
    m = len(x) // hop
    env = np.sqrt(np.mean(x[: m * hop].reshape(m, hop) ** 2, axis=1))
    db = 20 * np.log10(env + 1e-9)
    db = np.convolve(db, np.ones(3) / 3, "same")
    on = db > db.max() - thr_db
    out = []
    i = 0
    while i < m:
        if on[i]:
            j = i
            while j < m and on[j:j + int(merge * 100)].any():
                j += 1
            out.append([i, j])
            i = j
        else:
            i += 1
    res = []
    for a, b in out:
        # Запись началась посреди звука (отрывок вырезан из длинной) — такой кусок без начала не берём.
        if a <= 2 and db[: 3].max() > db[a:b].max() - 20:
            continue
        a = max(0, a * hop - int(pad * SR))
        b = min(len(x), b * hop + int(pad * SR * 2))
        if b - a < min_len * SR:
            continue
        if b - a > max_len * SR:
            # Длинное — режем по самому тихому месту во второй половине допустимого.
            lo, hi = a + int(max_len * SR * 0.5), a + int(max_len * SR)
            seg_env = env[lo // hop: hi // hop]
            b = lo + int(np.argmin(seg_env)) * hop if len(seg_env) else hi
        res.append((a, b))
    return res


def piece(x, a, b):
    y = x[a:b].copy()
    return synth.fade(y, 0.008, min(0.12, (b - a) / SR / 4))


def active_rms(y):
    """RMS звучащей части (без тишины по краям): окна по 20 мс громче −40 дБ от пика."""
    hop = int(0.02 * SR)
    m = max(1, len(y) // hop)
    e = np.sqrt(np.mean(y[: m * hop].reshape(m, hop) ** 2, axis=1))
    on = e[e > e.max() * 0.01]
    return float(np.sqrt(np.mean(on ** 2))) if len(on) else 1e-9


def flatness(y, lo=1500, hi=9000):
    """Плоскость спектра (0 — чистый тон, 1 — белый шум): медиана по звучащим кадрам."""
    X, _ = stft(y)
    f = np.fft.rfftfreq(2048, 1 / SR)
    m = np.abs(X)[:, (f > lo) & (f < hi)]
    e = m.sum(axis=1)
    m = m[e > e.max() * 0.05]
    return float(np.median(np.exp(np.mean(np.log(m + 1e-12), axis=1)) / (np.mean(m, axis=1) + 1e-12)))


def level_piece(y, rms_db=SPRITE_RMS_DB, ceiling_db=-1.0):
    y = y * dsp.undb(rms_db) / active_rms(y)
    pk = dsp.true_peak(y)
    if pk > dsp.undb(ceiling_db):
        y, _ = dsp.limiter(y, ceiling_db)
    return y


# ---------------------------------------------------------------- слои

def build_rain(clip_ids, taps_rate, seed, xf=0.9):
    raw = [dsp.filt(sources.load(c), lambda f: dsp.hp_mag(f, 90, 2)) for c in clip_ids]
    seg = min(len(r) for r in raw)
    clips = match_tone([r[:seg] for r in raw])
    nclip = len(clips)
    left = stitch(clips, xf, list(range(nclip)))
    right = stitch(clips, xf, [(i + nclip // 2) % nclip for i in range(nclip)])
    wash = np.stack([left, right])
    taps = synth.glass_taps(wash.shape[1] / SR, taps_rate, seed)
    taps *= np.sqrt(np.mean(wash ** 2)) / (np.sqrt(np.mean(taps ** 2)) + 1e-12) * dsp.undb(-8)
    return wash + taps, {"sources": clip_ids}


def build_murmur():
    return synth.babble(28.0, pairs=4, seed=17), {"sources": ["синтез (synth.babble)"]}


def sprite(pieces):
    """Куски подряд через GAP тишины: отрезки [начало, длина] в секундах."""
    gap = np.zeros(int(GAP * SR))
    parts, segs, at = [], [], GAP
    parts.append(gap)
    lead = np.zeros(int(0.003 * SR))
    for name, y in pieces:
        # 3 мс тишины перед ударом: кусок начинается с нуля, а не с середины атаки (без щелчка).
        y = np.concatenate([lead, y])
        segs.append({"id": name, "start": round(at, 4), "dur": round(len(y) / SR, 4)})
        parts += [y, gap]
        at += (len(y) + len(gap)) / SR
    return np.concatenate(parts), segs


def build_birds():
    pieces = []
    for c in BIRDS:
        x = sources.load(c)
        x = dsp.filt(x, lambda f: dsp.hp_mag(f, 1300, 4))
        x = denoise(x, over=2.5)
        found = regions(x, thr_db=26, merge=0.22, min_len=0.25, max_len=2.4)
        # Самые громкие фразы — не больше трёх с записи.
        # Только пение: шумные куски (порыв ветра, машина, стая скворцов «шумом») — мимо.
        found = [r for r in found if flatness(x[r[0]:r[1]]) < 0.1]
        found = sorted(found, key=lambda r: -active_rms(x[r[0]:r[1]]))[:3]
        for k, (a, b) in enumerate(sorted(found)):
            pieces.append((f"{c}:{k}", level_piece(piece(x, a, b))))
    return pieces, BIRDS


def build_crows():
    pieces = []
    for c in CROWS:
        x = sources.load(c)
        x = dsp.filt(x, lambda f: dsp.hp_mag(f, 280, 3))
        x = denoise(x, over=2.0)
        found = regions(x, thr_db=24, merge=0.5, min_len=0.3, max_len=2.6)
        found = sorted(found, key=lambda r: -active_rms(x[r[0]:r[1]]))[:3]
        for k, (a, b) in enumerate(sorted(found)):
            pieces.append((f"{c}:{k}", level_piece(piece(x, a, b))))
    return pieces, CROWS


def build_fireworks():
    pieces = []
    for c in FIREWORKS:
        x = sources.load(c)
        x = dsp.filt(x, lambda f: dsp.hp_mag(f, 60, 2))
        x = denoise(x, over=1.6, floor_pct=15)
        found = regions(x, thr_db=30, merge=0.3, min_len=0.7, max_len=3.0)
        found = sorted(found, key=lambda r: -active_rms(x[r[0]:r[1]]))[:2]
        for k, (a, b) in enumerate(sorted(found)):
            pieces.append((f"{c}:{k}", level_piece(piece(x, a, b), rms_db=-22)))
    return pieces, FIREWORKS


def build_street():
    pieces = [
        ("bike_ding2", synth.bike_bell("ding2", 1)),
        ("bike_trill", synth.bike_bell("trill", 2)),
        ("bike_ding1", synth.bike_bell("ding1", 3)),
        ("tram_pass", synth.tram_pass(4)),
        ("tram_squeal", synth.tram_pass(5, squeal=True)),
        ("tram_bell2", synth.tram_bell("two", 6)),
        ("tram_bell3", synth.tram_bell("three", 7)),
        ("pigeons_a", synth.pigeons(8, 3)),
        ("pigeons_b", synth.pigeons(9, 4)),
        ("pigeons_c", synth.pigeons(10, 2)),
        ("lamp_a", synth.lamp(11)),
        ("lamp_b", synth.lamp(12)),
        ("lamp_c", synth.lamp(13)),
    ]
    return [(name, level_piece(y)) for name, y in pieces], ["синтез (synth.py)"]


LAYERS = {
    "rain": ("loop", lambda: build_rain(RAIN_LIGHT, 7.0, 21)),
    "downpour": ("loop", lambda: build_rain(RAIN_HEAVY, 15.0, 22, xf=0.7)),
    "murmur": ("loop", build_murmur),
    "birds": ("sprite", build_birds),
    "crows": ("sprite", build_crows),
    "fireworks": ("sprite", build_fireworks),
    "street": ("sprite", build_street),
}
USE = {
    "rain": "дождь за витриной (погода «дождь»)",
    "downpour": "ливень за витриной (гроза)",
    "murmur": "гомон покупателей в зале: громче, когда их больше",
    "birds": "птицы за окном: весна и лето, утро и день",
    "crows": "вороны: зима, снег, поздняя осень",
    "fireworks": "салют: Новый год, вечер и ночь",
    "street": "редкие звуки улицы: велозвонок, трамвай, голуби, фонарь",
}


# ---------------------------------------------------------------- файлы

def write_wav(path, x):
    x = np.atleast_2d(x)
    pcm = (np.clip(x, -1, 1).T * 32767).round().astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(x.shape[0])
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def encode(x, base, kind, ceiling=-1.0):
    """x (каналы, n) → base.ogg и base.m4a; перелетел кодек потолок true-peak — чуть тише и заново."""
    x = np.atleast_2d(x)
    ch = x.shape[0]
    raw = np.ascontiguousarray(x.T.astype("<f4")).tobytes()
    jobs = [
        (base.with_suffix(".ogg"), ["-c:a", "libopus", "-b:a", f"{OPUS_KBPS[kind]}k", "-vbr", "on",
                                    "-compression_level", "10", "-application", "audio", "-cutoff", "12000"]),
        (base.with_suffix(".m4a"), ["-c:a", "aac", "-b:a", f"{AAC_KBPS[kind]}k", "-ar", str(AAC_RATE),
                                    "-cutoff", "12000", "-movflags", "+faststart"]),
    ]
    for path, args in jobs:
        g = 0.0
        for _ in range(4):
            af = ["-af", f"volume={g:.2f}dB"] if g else []
            subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac",
                            str(ch), "-i", "pipe:"] + af + args + ["-map_metadata", "-1", "-fflags", "+bitexact", str(path)],
                           input=raw, check=True)
            tp = float(dsp.todb(dsp.true_peak(decode(path, ch))))
            if tp <= ceiling:
                break
            g -= tp - ceiling + 0.15
    return {"ogg": jobs[0][0].stat().st_size, "m4a": jobs[1][0].stat().st_size}


def decode(path, ch):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path), "-f", "f32le", "-ac", str(ch),
                        "-ar", str(SR), "pipe:"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype="<f4").reshape(-1, ch).T.astype(float)


def render(name, encode_on):
    kind, make = LAYERS[name]
    t0 = time.time()
    if kind == "loop":
        x, meta = make()
        # Громкость петли — по BS.1770 «по кругу», пики — не выше −1 dBTP.
        x = x * dsp.undb(LOOP_LUFS - dsp.loudness(x, circular=True))
        if dsp.true_peak(x, circular=True) > dsp.undb(-1.0):
            x, _ = dsp.limiter(x, -1.0, circular=True)
        pad = int(LOOP_PAD * SR)
        body = np.concatenate([x[:, -pad:], x, x[:, :pad]], axis=1)
        entry = {"kind": "loop", "channels": 2, "loopStart": LOOP_PAD, "loopEnd": round(LOOP_PAD + x.shape[1] / SR, 6),
                 "loopStartSample": pad, "loopEndSample": pad + x.shape[1], "lufs": round(dsp.loudness(x, circular=True), 2)}
    else:
        pieces, src = make()
        body, segs = sprite(pieces)
        meta = {"sources": src}
        entry = {"kind": "sprite", "channels": 1, "segments": segs}
    entry.update({"path": f"audio/amb/{name}", "use": USE[name], "sources": meta["sources"],
                  "duration": round(body.shape[-1] / SR, 4),
                  "peakDb": round(float(dsp.todb(np.max(np.abs(body)))), 2),
                  "rmsDb": round(float(dsp.todb(np.sqrt(np.mean(body ** 2)))), 2)})
    BUILD.mkdir(parents=True, exist_ok=True)
    write_wav(BUILD / f"{name}.wav", body)
    try:
        import viz
        viz.spectrogram_png(np.atleast_2d(body), BUILD / f"{name}.png", fmax=12000)
    except Exception as e:  # noqa: BLE001
        print("спектрограмма:", e)
    if encode_on:
        OUT.mkdir(parents=True, exist_ok=True)
        entry["bytes"] = encode(body, OUT / name, kind)
    print(f"{name:10s} {kind:6s} {entry['duration']:6.2f} с  пик {entry['peakDb']:6.2f} дБ  RMS {entry['rmsDb']:6.2f} дБ"
          + (f"  {entry['bytes']['ogg'] // 1024} КБ ogg / {entry['bytes']['m4a'] // 1024} КБ m4a" if "bytes" in entry else "")
          + f"  ({time.time() - t0:.1f} с)", flush=True)
    return entry


# Куски нарезки по группам: игра выбирает случайный кусок группы (птица, ворона, залп, велозвонок…).
GROUPS = {"bike": "bike_", "tram": "tram_pass,tram_squeal", "tramBell": "tram_bell", "pigeons": "pigeons_", "lamp": "lamp_"}


def ts_table(files):
    """Таблица для src/platform/ambienceLayers.ts (AMB) — из манифеста; тест сверяет её с manifest.json."""
    out = ["export const AMB = {"]
    for name, e in files.items():
        if e["kind"] == "loop":
            out.append(f"  {name}: {{ kind: 'loop', path: '{e['path']}', loopStart: {e['loopStart']}, loopEnd: {e['loopEnd']} }},")
            continue
        groups = {}
        for seg in e["segments"]:
            if name == "street":
                key = next(g for g, pre in GROUPS.items() if any(seg["id"].startswith(p) for p in pre.split(",")))
            else:
                key = {"birds": "bird", "crows": "crow", "fireworks": "burst"}[name]
            groups.setdefault(key, []).append(f"[{seg['start']}, {seg['dur']}]")
        out.append(f"  {name}: {{")
        out.append(f"    kind: 'sprite',")
        out.append(f"    path: '{e['path']}',")
        out.append("    groups: {")
        for key, segs in groups.items():
            out.append(f"      {key}: [{', '.join(segs)}],")
        out.append("    },")
        out.append("  },")
    out.append("} satisfies Record<AmbId, AmbFile>;")
    return "\n".join(out)


def main(argv):
    if "--ts" in argv:
        print(ts_table(json.loads(MANIFEST.read_text())["files"]))
        return
    encode_on = "--no-encode" not in argv
    names = [a for a in argv if not a.startswith("--")] or list(LAYERS)
    text = sources.license_text()
    for clip in sources.CLIPS:
        sources.verify_license(clip, text)
    old = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    files = old.get("files", {})
    for name in names:
        files[name] = render(name, encode_on)
    manifest = {
        "version": 1,
        "sampleRate": SR,
        "playback": ("loop — WebAudio: loop=true, loopStart/loopEnd (вокруг петли по 0.5 с той же петли «по кругу»), "
                     "после decodeAudioData сгладить шов (как у радио, playlist.ts smoothSeam); sprite — моно, кусок "
                     "segments[i]: start(when, start, dur), сторону и громкость задаёт игра. ogg (Opus) — основной формат, "
                     "m4a (AAC) — для iOS/Safari."),
        "files": {k: files[k] for k in LAYERS if k in files},
    }
    OUT.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n")
    total = sum(sum(e.get("bytes", {}).values()) for e in manifest["files"].values())
    print(f"всего на сервере: {total / 1e6:.2f} МБ (оба формата)")


if __name__ == "__main__":
    main(sys.argv[1:])
