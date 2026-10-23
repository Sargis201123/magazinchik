"""Синтез того, чего нет среди записей CC0: сканер, колокольчики, касса, швабра, скотч, кот и пёс.

Не «пищалки», а модели предметов: колокольчик — негармонические призвуки парами с биениями и
язычок, который бьёт несколько раз; ящик кассы — шум роликов через резонансы металлического
корпуса и стук в конце; кот и пёс — голос через резонансы горла и рта (как речь, только формы
другие). Всё детерминировано: seed — номер варианта.
"""

import numpy as np

from common import SR, bp, cut, hp, lp, resample, tail_trim
import sources

# ---------------------------------------------------------------- голос: гармоники через резонансы


def resonances(f, F, B):
    """АЧХ каскада резонансов (форманты F с полосами B) на частотах f, у нуля — 1.
    f: (n,) или (n, 1); F, B: (n, k) или (k,)."""
    ff = np.asarray(f, dtype=float)[..., None]
    F = np.asarray(F, dtype=float)
    B = np.asarray(B, dtype=float)
    h = (F ** 2 + (B / 2) ** 2) / np.sqrt(((ff - F) ** 2 + (B / 2) ** 2) * ((ff + F) ** 2 + (B / 2) ** 2))
    return np.prod(h, axis=-1)


def tilt(f, knee=700.0, db_oct=-9.0):
    """Наклон спектра источника выше knee: тёплый голос — круче, звонкий — положе."""
    return np.where(f > knee, (f / knee) ** (db_oct / 6.02), 1.0)


def harmonics(f0, amp, F, B, knee=700.0, db_oct=-9.0, fmax=7500.0, rng=None, shimmer=0.0):
    """Сумма гармоник основного тона f0 (массив по отсчётам), каждая — через резонансы F/B (по отсчётам)."""
    n = len(f0)
    phase = 2 * np.pi * np.cumsum(f0) / SR
    out = np.zeros(n)
    kmax = int(fmax / max(np.min(f0), 40.0))
    for k in range(1, kmax + 1):
        fk = k * f0
        a = tilt(fk, knee, db_oct) * resonances(fk, F, B)
        a = np.where(fk < fmax, a, 0.0) * np.clip(1 - (fk - fmax * 0.85) / (fmax * 0.15), 0, 1)
        out += a * np.sin(k * phase + (rng.uniform(0, 2 * np.pi) if rng is not None else 0))
    if shimmer and rng is not None:
        # Лёгкая неровность громкости по периодам — живое горло, а не генератор.
        wob = np.interp(np.arange(n), np.linspace(0, n, max(2, n // 400)), 1 + shimmer * rng.standard_normal(max(2, n // 400)))
        out *= wob
    return out * amp


def shaped_noise(n, mag_at, rng, frame=512, hop=128):
    """Шум с меняющимся во времени спектром: mag_at(t, freqs) → АЧХ кадра (STFT с перекрытием)."""
    win = np.hanning(frame)
    pad = np.zeros(n + frame)
    norm = np.zeros(n + frame)
    noise = rng.standard_normal(n + frame)
    freqs = np.fft.rfftfreq(frame, 1 / SR)
    for s in range(0, n, hop):
        X = np.fft.rfft(noise[s:s + frame] * win)
        y = np.fft.irfft(X * mag_at((s + frame / 2) / SR, freqs), frame) * win
        pad[s:s + frame] += y
        norm[s:s + frame] += win ** 2
    return pad[:n] / np.maximum(norm[:n], 1e-3)


def smooth(x, ms=8.0):
    n = max(1, int(ms * SR / 1000))
    k = np.hanning(n * 2 + 1)
    k /= k.sum()
    return np.convolve(np.pad(x, n, mode="edge"), k, mode="same")[n:-n]


def path(t, points):
    """Кусочно-линейная траектория [(время 0..1, значение), …] со сглаживанием."""
    xs, ys = zip(*points)
    return np.interp(t, xs, ys)


def ramp_env(n, attack, release, shape=1.0):
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    r = np.clip((n / SR - t) / max(release, 1e-4), 0, 1)
    return (np.sin(a * np.pi / 2) ** 2) * (np.sin(r * np.pi / 2) ** 2) ** shape


# ---------------------------------------------------------------- металл и стекло

def strike(f0, ratios, levels, decays, dur, rng, detune=0.0015, hit=0.25, hit_hz=6000):
    """Удар по колокольчику: у каждого призвука своё затухание, у верхних — слабый «двойник» рядом
    (медленные неглубокие биения, как у настоящего литья), плюс щелчок язычка."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for i, (r, lv, dc) in enumerate(zip(ratios, levels, decays)):
        f = f0 * r
        if f > 15000:
            continue
        pairs = [(0.0, 1.0)] if i == 0 else [(0.0, 0.85), (detune * rng.uniform(0.3, 1.0) * rng.choice([-1, 1]), 0.15)]
        for dt, share in pairs:
            out += share * lv * np.sin(2 * np.pi * f * (1 + dt) * t + rng.uniform(0, 2 * np.pi)) * np.exp(-t / dc)
    # Мягкая атака 0.6 мс — без цифрового щелчка; к концу куска — плавно в ноль, а не обрыв.
    out *= np.clip(t / 0.0006, 0, 1) * np.cos(np.clip((t - dur * 0.65) / (dur * 0.35), 0, 1) * np.pi / 2) ** 2
    click = rng.standard_normal(int(0.002 * SR)) * np.exp(-np.arange(int(0.002 * SR)) / (0.0004 * SR))
    click = bp(np.pad(click, (0, 64)), 1500, hit_hz)[: len(click)]
    out[: len(click)] += click * hit * np.abs(out).max() / (np.abs(click).max() + 1e-9)
    return out


SHOP_BELL = dict(ratios=[1.0, 2.42, 3.98, 5.63], levels=[1.0, 0.42, 0.22, 0.1], decays=[0.85, 0.36, 0.17, 0.09])
DOME_BELL = dict(ratios=[1.0, 2.31, 4.12, 6.4], levels=[1.0, 0.36, 0.16, 0.07], decays=[1.1, 0.42, 0.2, 0.1])
# Звонок кассы — та же чашечка, но придержанная: гаснет за полсекунды (касса звучит на каждой покупке).
TILL_BELL = dict(DOME_BELL, decays=[0.3, 0.16, 0.09, 0.05])


def door_bell(seed, hits, f0s, total, strength=1.0):
    """Колокольчики над дверью: язычок бьёт несколько раз, всё слабее, то в один, то в другой."""
    rng = np.random.default_rng(seed)
    out = np.zeros(int(total * SR))
    at = 0.0
    for i in range(hits):
        f0 = f0s[i % len(f0s)] * (1 + rng.uniform(-0.004, 0.004))
        amp = strength * (0.82 ** i) * rng.uniform(0.75, 1.0)
        s = strike(f0, **SHOP_BELL, dur=total - at, rng=rng, hit=0.18)
        a = int(at * SR)
        out[a:a + len(s)] += s[: len(out) - a] * amp
        at += rng.uniform(0.075, 0.13) * (1 + 0.12 * i)
        if at > total - 0.3:
            break
    return tail_trim(lp(hp(out, 400), 8000), -50)


def scanner(seed):
    """Сканер на кассе: короткое «пик» пьезопищалки и едва слышный стук товара о стекло."""
    rng = np.random.default_rng(seed)
    f = 1830 * 2 ** ([-22, -7, 8, 21][seed % 4] / 1200)
    dur = [0.085, 0.078, 0.092, 0.082][seed % 4]
    n = int((dur + 0.05) * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * f * t) + 0.16 * np.sin(2 * np.pi * 2 * f * t + 0.3) + 0.05 * np.sin(2 * np.pi * 3 * f * t)
    on = 0.014
    env = np.clip((t - on) / 0.003, 0, 1) * np.clip((on + dur - t) / 0.012, 0, 1)
    out = tone * np.sin(env * np.pi / 2) ** 2
    tick = rng.standard_normal(int(0.012 * SR)) * np.exp(-np.arange(int(0.012 * SR)) / (0.0025 * SR))
    out[: len(tick)] += bp(np.pad(tick, (0, 256)), 1800, 6000)[: len(tick)] * 0.12
    return lp(out, 6000)


def ding(seed):
    """Таймер печи: одно чистое «дзинь» маленькой чашечки; в третьем варианте молоточек отскакивает
    и тихо бьёт ещё раз — «дзинь-нь»."""
    rng = np.random.default_rng(seed + 50)
    f0 = [2489, 2349, 2637][seed % 3]
    s = strike(f0, **DOME_BELL, dur=1.4, rng=rng, hit=0.15)
    if seed % 3 == 2:
        a = int(0.085 * SR)
        s[a:] += strike(f0, **DOME_BELL, dur=1.4, rng=rng, hit=0.1)[: len(s) - a] * 0.3
    return tail_trim(lp(hp(s, 500), 9000), -50)


def till(seed):
    """Касса: щелчок рычага, «дзынь» звонка, ящик выезжает на роликах и стукается; в лотке звякает мелочь.
    Всё за полсекунды: звучит на каждой покупке, а при нескольких кассах — каждую секунду-две."""
    rng = np.random.default_rng(seed + 100)
    total = 0.6
    out = np.zeros(int(total * SR))

    def put(x, at, gain=1.0):
        a = int(at * SR)
        m = min(len(x), len(out) - a)
        out[a:a + m] += x[:m] * gain

    latch = sources.load("kenney-rpg-audio/metalLatch.ogg")
    o = latch[int(0.03 * SR):]
    latch = cut(resample(o, 0.82), 0.0, 0.12, pre=0.002, fade_out=0.06)
    put(hp(latch, 400) / (np.abs(latch).max() + 1e-9), 0.0, 0.35)
    # Звонок: маленькая чашечка, бьёт один раз (иногда второй, тише) и не тянет хвост.
    f0 = [2349, 2217, 2489, 2289][seed % 4]
    bell = strike(f0, **TILL_BELL, dur=0.45, rng=rng, hit=0.12)
    bell /= np.abs(bell).max()
    put(bell, 0.025, 1.0)
    if seed % 2:
        put(strike(f0, **TILL_BELL, dur=0.3, rng=rng, hit=0.1) / 1.2, 0.025 + rng.uniform(0.09, 0.12), 0.28)
    # Ящик: шум роликов через резонансы корпуса (650 и 1300 Гц) и мелкие стуки колёсиков.
    slide = [0.24, 0.3, 0.27, 0.22][seed % 4]
    n = int(slide * SR)
    t = np.arange(n) / SR
    rum = rng.standard_normal(n)
    rum = 0.6 * bp(rum, 500, 820, 4) + 0.4 * bp(rum, 1100, 1500, 4) + 0.25 * bp(rum, 250, 2500, 2)
    ticks = np.zeros(n)
    k = 0.0
    while k < slide:
        ticks[int(k * SR)] = rng.uniform(0.5, 1.0)
        k += rng.uniform(0.018, 0.03)
    ticks = bp(np.convolve(ticks, np.exp(-np.arange(200) / 40.0))[:n], 700, 3000)
    body = rum / (np.abs(rum).max() + 1e-9) + 0.5 * ticks / (np.abs(ticks).max() + 1e-9)
    env = np.clip(t / 0.05, 0, 1) * (0.55 + 0.45 * np.clip(1 - t / slide, 0, 1))
    put(body * env * np.clip((slide - t) / 0.01, 0, 1), 0.05, 0.16)
    # Стук ящика об упор: короткие моды корпуса (без «подвала» ниже 200 Гц).
    m = int(0.09 * SR)
    tt = np.arange(m) / SR
    thud = sum(a * np.sin(2 * np.pi * f * tt) * np.exp(-tt / d) for f, a, d in [(240, 1.0, 0.025), (470, 0.7, 0.02), (930, 0.4, 0.012), (1650, 0.25, 0.008)])
    thud += 0.4 * bp(rng.standard_normal(m), 600, 4000) * np.exp(-tt / 0.006)
    put(thud / np.abs(thud).max(), 0.05 + slide, 0.42)
    # Мелочь в лотке вздрагивает.
    coins = sources.load("kenney-rpg-audio/handleCoins2.ogg")
    starts = [0.075, 0.12, 0.15, 0.21]
    c = cut(coins, starts[seed % 4], 0.13, pre=0.003, fade_out=0.07)
    put(hp(c, 800) / (np.abs(c).max() + 1e-9), 0.06 + slide, 0.22)
    return tail_trim(hp(out, 180), -52)


# ---------------------------------------------------------------- швабра, скотч, картон

def mop(seed):
    """Швабра: мокрый «шшух» туда-обратно — шум с плывущей полосой, под ним брызги и капли."""
    rng = np.random.default_rng(seed + 200)
    dur = [0.42, 0.38, 0.46, 0.4][seed % 4]
    n = int(dur * SR)
    c0, c1, c2 = [(800, 1700, 1100), (950, 1500, 900), (700, 1800, 1300), (850, 1600, 1000)][seed % 4]

    def band(t, f):
        k = t / dur
        c = c0 + (c1 - c0) * min(1, k / 0.45) if k < 0.45 else c1 + (c2 - c1) * (k - 0.45) / 0.55
        w = np.exp(-0.5 * (np.log2(np.maximum(f, 1) / c) / 0.75) ** 2)
        return w * (f > 200)

    swish = shaped_noise(n, band, rng)
    t = np.arange(n) / SR
    env = np.sin(np.clip(t / dur, 0, 1) * np.pi) ** 1.3
    swish *= env / (np.abs(swish * env).max() + 1e-9)
    water = sources.load("kenney-foley-sounds/sinkWater3.ogg")
    a = [0.17, 0.42, 0.62, 0.3][seed % 4]
    w = cut(water, a, dur, pre=0.02, fade_out=dur * 0.4)
    w = bp(w, 500, 5000)
    w = np.pad(w, (0, max(0, n - len(w))))[:n] * env
    out = swish + 0.55 * w / (np.abs(w).max() + 1e-9)
    # Капли: короткие «пульки» вверх.
    for _ in range(rng.integers(5, 9)):
        at = rng.uniform(0.05, dur - 0.03)
        m = int(rng.uniform(0.006, 0.012) * SR)
        tt = np.arange(m) / SR
        f = rng.uniform(1400, 2600) * (1 + 3 * tt)
        drop = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / (m / SR / 3))
        s = int(at * SR)
        out[s:s + m] += drop[: n - s] * rng.uniform(0.08, 0.18)
    return lp(hp(out, 250), 7000)


def tape(seed, dur):
    """Скотч отрывают от картона: частые «хрусты» липкого слоя, через резонансы ленты и коробки."""
    rng = np.random.default_rng(seed + 300)
    n = int(dur * SR)
    imp = np.zeros(n)
    t = 0.0
    while t < dur:
        k = t / dur
        rate = 350 + 900 * np.sin(np.pi * min(1, k * 1.1)) ** 0.7
        imp[int(t * SR)] = rng.uniform(0.3, 1.0) * (0.4 + 0.6 * np.sin(np.pi * min(1, k * 1.05)))
        t += rng.exponential(1 / rate)
    tick = rng.standard_normal(96) * np.exp(-np.arange(96) / 14.0)
    crackle = np.convolve(imp, tick)[:n]
    tone = 0.55 * bp(crackle, 1700, 2300, 4) + 0.45 * bp(crackle, 2600, 3600, 4) + 0.5 * bp(crackle, 900, 6000, 2)
    box = 0.35 * bp(crackle, 380, 520, 4) + 0.25 * bp(crackle, 700, 860, 4)
    out = tone + box
    return out / (np.abs(out).max() + 1e-9)


def flap(seed):
    """Клапан коробки откинулся: мягкий картонный хлопок с шорохом."""
    rng = np.random.default_rng(seed + 400)
    m = int(0.12 * SR)
    tt = np.arange(m) / SR
    body = sum(a * np.sin(2 * np.pi * f * tt + rng.uniform(0, 6)) * np.exp(-tt / d) for f, a, d in [(330, 1.0, 0.03), (610, 0.6, 0.02), (1150, 0.3, 0.012)])
    rustle = bp(rng.standard_normal(m), 1200, 6000) * np.exp(-tt / 0.03)
    out = body / np.abs(body).max() + 0.35 * rustle / np.abs(rustle).max()
    return out * np.clip(tt / 0.002, 0, 1)


def unbox(seed):
    """Распаковка: «хрррт» скотча и два картонных клапана."""
    dur = [0.34, 0.4, 0.3][seed % 3]
    out = np.zeros(int((dur + 0.32) * SR))
    tp = tape(seed, dur)
    out[: len(tp)] += tp * 0.8
    for i, at in enumerate([dur + 0.03, dur + 0.12]):
        f = flap(seed * 2 + i)
        a = int(at * SR)
        out[a:a + len(f)] += f[: len(out) - a] * (0.75 - 0.15 * i)
    return tail_trim(lp(hp(out, 200), 7500), -50)


# ---------------------------------------------------------------- кот и пёс


def meow(seed):
    """Мяу: «м» закрытым ртом, рот открывается в «я-а», закрывается в «у»; тон вверх и вниз."""
    rng = np.random.default_rng(seed + 500)
    kind = seed % 4
    dur, f_lo, f_hi, f_end, trill = [(0.62, 520, 760, 470, 0.0), (0.36, 640, 860, 640, 0.0),
                                     (0.58, 480, 690, 760, 0.11), (0.82, 450, 650, 400, 0.0)][kind]
    n = int(dur * SR)
    t = np.arange(n) / SR
    k = t / dur
    f0 = path(k, [(0, f_lo), (0.35, f_hi), (0.65, f_hi * 0.96), (1, f_end)])
    f0 = smooth(f0, 20) * (1 + 0.012 * np.sin(2 * np.pi * 6.2 * t))
    f0 *= 1 + 0.006 * smooth(rng.standard_normal(n), 3)
    # Форманты кота (маленькое горло — всё выше, чем у человека).
    F1 = path(k, [(0, 600), (0.14, 1150), (0.6, 1150), (1, 720)])
    F2 = path(k, [(0, 1500), (0.14, 2250), (0.6, 2100), (1, 1350)])
    F3 = path(k, [(0, 3100), (0.14, 3700), (1, 3300)])
    F = np.stack([smooth(F1, 10), smooth(F2, 10), F3, np.full(n, 4700.0)], axis=1)
    B = np.array([150.0, 190.0, 280.0, 400.0])
    amp = path(k, [(0, 0.35), (0.12, 1.0), (0.7, 0.85), (1, 0.0)])
    amp = smooth(amp, 15) * np.clip(t / 0.03, 0, 1)
    if trill:
        # «Мррр» в начале: громкость дрожит 26 раз в секунду и плавно успокаивается к trill.
        depth = 0.6 * np.cos(np.clip(t / trill, 0, 1) * np.pi / 2) ** 2
        amp *= 1 - depth * (0.5 + 0.5 * np.cos(2 * np.pi * 26 * t))
    voiced = harmonics(f0, amp, F, B, knee=900, db_oct=-8, fmax=8000, rng=rng, shimmer=0.04)
    breath = shaped_noise(n, lambda tc, fr: resonances(fr, F[min(n - 1, int(tc * SR))], B) * (fr > 800), rng)
    out = voiced / np.abs(voiced).max() + 0.05 * breath * amp / (np.abs(breath).max() + 1e-9)
    return tail_trim(lp(hp(out, 350), 7500), -50)


def bark(seed):
    """Гав: резкое начало с придыханием, тон вниз, хрипотца (раздвоение периода), рот «а-у»."""
    rng = np.random.default_rng(seed + 600)
    kind = seed % 3
    plan = [[(0.0, 1.0, 0.17)], [(0.0, 1.0, 0.16), (0.24, 0.85, 0.15)], [(0.0, 0.9, 0.11), (0.17, 0.8, 0.1), (0.33, 0.7, 0.1)]][kind]
    base = [470, 430, 620][kind]
    total = plan[-1][0] + plan[-1][2] + 0.12
    out = np.zeros(int(total * SR))
    for i, (at, gain, dur) in enumerate(plan):
        n = int(dur * SR)
        t = np.arange(n) / SR
        k = t / dur
        f0 = base * (1 + rng.uniform(-0.04, 0.04)) * path(k, [(0, 1.0), (0.25, 1.06), (1, 0.72)])
        f0 *= 1 + 0.02 * smooth(rng.standard_normal(n), 2)
        F1 = path(k, [(0, 500), (0.2, 820), (1, 600)])
        F2 = path(k, [(0, 1300), (0.2, 1700), (1, 1100)])
        F = np.stack([F1, F2, np.full(n, 2800.0), np.full(n, 3800.0)], axis=1)
        B = np.array([170.0, 220.0, 320.0, 450.0])
        amp = np.clip(t / 0.006, 0, 1) * np.exp(-np.maximum(t - 0.03, 0) / (dur * 0.45))
        amp *= np.cos(np.clip((k - 0.7) / 0.3, 0, 1) * np.pi / 2) ** 2
        v = harmonics(f0, amp, F, B, knee=1000, db_oct=-7, fmax=6000, rng=rng)
        # Хрипотца: каждый второй период громче — слышится «рык» на октаву ниже.
        v *= 1 + 0.35 * np.sin(np.pi * np.cumsum(f0) / SR)
        h = shaped_noise(n, lambda tc, fr: resonances(fr, F[min(n - 1, int(tc * SR))], B), rng)
        h *= amp * (0.5 + 0.5 * np.exp(-t / 0.02))
        x = v / np.abs(v).max() + 0.3 * h / (np.abs(h).max() + 1e-9)
        a = int(at * SR)
        out[a:a + n] += x[: len(out) - a] * gain
    return tail_trim(lp(hp(out, 280), 5000), -50)
