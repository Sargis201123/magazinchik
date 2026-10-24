"""Синтез звуков атмосферы, для которых нет подходящей записи под CC0: гомон покупателей, капли по
стеклу витрины, велозвонок, далёкий трамвай, взлёт голубей, «дзинь» зажёгшегося фонаря.

Всё — numpy, без чужих записей. Петли собираются «по кругу»: всё, что выходит за конец петли,
дописывается в её начало, а отзвук считается по кругу (dsp.reverb(circular=True)) — стык не слышен.

Гомон — это слоги, а не слова: голос (гармоники с огибающей формант, как в синтезаторе Клатта) и шум
согласных, интонация фразы (повышение на ударном слоге, спад к концу, иногда вопрос), коартикуляция
(форманты плавно перетекают от звука к звуку). Слоги случайные, по частотам русского языка, поэтому
речь звучит «по-нашему», но ни одного слова разобрать нельзя. Собеседники стоят парами в разных
углах зала, дальние глуше; всё вместе — через отзвук комнаты и мягкий срез верха.
"""

import numpy as np

import dsp
from dsp import SR

# ---------------------------------------------------------------- общие мелочи


def circ_add(buf, sig, start):
    """Прибавить sig к петле buf (форма (..., n)) начиная с отсчёта start, с переносом в начало."""
    n = buf.shape[-1]
    start %= n
    m = sig.shape[-1]
    pos = 0
    while pos < m:
        a = (start + pos) % n
        take = min(m - pos, n - a)
        buf[..., a: a + take] += sig[..., pos: pos + take]
        pos += take


def resample_up(x, factor):
    """Целое повышение частоты через спектр (идеальная интерполяция)."""
    n = x.shape[-1]
    X = np.fft.rfft(x, axis=-1)
    Y = np.zeros(X.shape[:-1] + (n * factor // 2 + 1,), dtype=complex)
    Y[..., : X.shape[-1]] = X
    return np.fft.irfft(Y, n * factor, axis=-1) * factor


def fade(x, a=0.01, b=0.05):
    """Мягкие вход и выход (секунды)."""
    y = x.copy()
    na, nb = int(a * SR), int(b * SR)
    if na:
        y[..., :na] *= np.sin(np.linspace(0, np.pi / 2, na)) ** 2
    if nb:
        y[..., -nb:] *= np.cos(np.linspace(0, np.pi / 2, nb)) ** 2
    return y


def modes(t, f0, table, rng, detune=2.5):
    """Металл: набор затухающих мод (отношение к f0, громкость, время спада), каждая — дублет
    из двух чуть разных частот (купол не идеально круглый — звон «переливается»)."""
    y = np.zeros_like(t)
    for ratio, amp, decay in table:
        f = f0 * ratio
        if f > SR / 2.2:
            continue
        d = rng.uniform(0.5, 1.0) * detune
        for s in (-1, 1):
            y += amp * 0.5 * np.sin(2 * np.pi * (f + s * d) * t + rng.uniform(0, 2 * np.pi)) * np.exp(-t / decay)
    return y


def click(n, rng, lo=2000, hi=9000):
    """Короткий щелчок: шум, сжатый в полосу, с мгновенным спадом."""
    x = rng.standard_normal(n) * np.exp(-np.arange(n) / (n / 5))
    return dsp.filt(x, lambda f: dsp.bp_mag(f, lo, hi, 2))


def norm_peak(x, peak=0.9):
    m = np.max(np.abs(x))
    return x * (peak / m) if m > 0 else x


# ---------------------------------------------------------------- гомон

SRV = 16000  # голос считаем в 16 кГц: у далёкого гомона выше 4 кГц всё равно ничего нет
CR = 500  # частота управляющих кривых (форманты, громкость, высота), Гц

# Форманты гласных (мужской голос), Гц. Безударные стягиваются к нейтральному «ə» (как в русском «малако»).
VOWELS = {
    "а": (700, 1220, 2600), "о": (535, 870, 2500), "у": (320, 740, 2300),
    "э": (500, 1750, 2550), "и": (290, 2250, 3000), "ы": (350, 1500, 2450),
}
NEUTRAL = (500, 1450, 2500)
VOWEL_W = {"а": 9, "о": 10, "э": 4, "и": 8, "у": 3, "ы": 2}
# Согласные: вид, куда тянутся форманты (у звонких), полоса шума (у шумных).
CONS = {
    "п": ("stop", None, (500, 1600)), "т": ("stop", None, (2600, 5500)), "к": ("stop", None, (1300, 2900)),
    "б": ("vstop", (250, 900, 2300), (400, 1500)), "д": ("vstop", (300, 1600, 2600), (2200, 4500)),
    "г": ("vstop", (300, 1300, 2300), (1100, 2700)),
    "с": ("fric", None, (4500, 7500)), "ш": ("fric", None, (1800, 4500)), "х": ("fric", None, (900, 2800)),
    "ф": ("fric", None, (1500, 6000)),
    "в": ("vfric", (300, 1100, 2300), (900, 3500)), "з": ("vfric", (300, 1500, 2600), (3500, 7000)),
    "ж": ("vfric", (300, 1500, 2400), (1800, 4200)),
    "м": ("nasal", (250, 1000, 2300), None), "н": ("nasal", (250, 1450, 2500), None),
    "л": ("liquid", (360, 1000, 2400), None), "р": ("trill", (420, 1350, 2500), None),
    "й": ("glide", (280, 2200, 2900), None),
}
CONS_W = {"т": 9, "н": 9, "с": 7, "р": 7, "в": 6, "л": 6, "к": 6, "м": 5, "д": 5, "п": 4, "й": 3, "б": 2,
          "г": 2, "з": 2, "ш": 2, "х": 1, "ж": 1, "ф": 0.5}
BW = (75, 85, 120)  # ширина формант, Гц


def _pick(rng, weights):
    keys = list(weights)
    w = np.array([weights[k] for k in keys], dtype=float)
    return keys[rng.choice(len(keys), p=w / w.sum())]


def formant_gain(f, F1, F2, F3):
    """Каскад трёх резонаторов (как у Клатта): усиление на частоте f при формантах F1…F3. Все массивы."""
    g = np.ones_like(f)
    for F, B in ((F1, BW[0]), (F2, BW[1]), (F3, BW[2])):
        h = B / 2
        g = g * (F * F + h * h) / np.sqrt(((f - F) ** 2 + h * h) * ((f + F) ** 2 + h * h))
    return g


def phrase_plan(rng, scale):
    """Фраза: сегменты (длительность, вид, форманты, голос, шум, полоса, ударный ли) и вопрос ли это."""
    segs = []
    words = rng.integers(2, 7)
    for w in range(words):
        syl = int(rng.choice([1, 2, 2, 3, 3, 4]))
        stress = rng.integers(0, syl)
        for s in range(syl):
            stressed = s == stress
            if rng.random() < 0.85:
                c = _pick(rng, CONS_W)
                segs += _consonant(c, rng)
            v = _pick(rng, VOWEL_W)
            F = VOWELS[v]
            if not stressed:
                F = tuple(a * 0.6 + b * 0.4 for a, b in zip(F, NEUTRAL))
            dur = rng.uniform(0.12, 0.17) if stressed else rng.uniform(0.055, 0.085)
            segs.append(dict(dur=dur, F=F, v=1.15 if stressed else 0.8, n=0.0, band=None, stress=stressed, dark=0.0))
            if rng.random() < 0.22:
                segs += _consonant(_pick(rng, CONS_W), rng)
        # Между словами иногда — крошечная пауза.
        if w < words - 1 and rng.random() < 0.25:
            segs.append(dict(dur=rng.uniform(0.04, 0.12), F=None, v=0.0, n=0.0, band=None, stress=False, dark=0.0))
    # Конец фразы тянется.
    for seg in segs[-3:]:
        seg["dur"] *= 1.35
    for seg in segs:
        if seg["F"] is not None:
            seg["F"] = tuple(f * scale for f in seg["F"])
        if seg["band"] is not None:
            seg["band"] = tuple(b * (0.85 + 0.15 * scale) for b in seg["band"])
    return segs, rng.random() < 0.22


def _consonant(c, rng):
    kind, F, band = CONS[c]
    if kind in ("stop", "vstop"):
        voiced = kind == "vstop"
        return [
            dict(dur=rng.uniform(0.04, 0.06), F=F, v=0.12 if voiced else 0.0, n=0.0, band=None, stress=False, dark=0.6),
            dict(dur=rng.uniform(0.012, 0.02), F=F, v=0.2 if voiced else 0.0, n=0.55, band=band, stress=False, dark=0.0),
        ]
    if kind == "fric":
        return [dict(dur=rng.uniform(0.06, 0.09), F=None, v=0.0, n=0.3, band=band, stress=False, dark=0.0)]
    if kind == "vfric":
        return [dict(dur=rng.uniform(0.05, 0.075), F=F, v=0.3, n=0.18, band=band, stress=False, dark=0.3)]
    if kind == "nasal":
        return [dict(dur=rng.uniform(0.05, 0.07), F=F, v=0.38, n=0.0, band=None, stress=False, dark=0.85)]
    if kind == "trill":
        return [dict(dur=rng.uniform(0.045, 0.065), F=F, v=0.55, n=0.0, band=None, stress=False, dark=0.2, trill=True)]
    return [dict(dur=rng.uniform(0.04, 0.06), F=F, v=0.6, n=0.0, band=None, stress=False, dark=0.1)]


def _smooth(a, k):
    if k <= 1:
        return a
    w = np.ones(k) / k
    return np.convolve(np.convolve(a, w, "same"), w, "same")


def say(rng, f0, scale, breath=0.05):
    """Одна фраза одного голоса (моно, частота SRV)."""
    segs, question = phrase_plan(rng, scale)
    total = sum(s["dur"] for s in segs) + 0.08
    m = int(total * CR) + 2
    tc = np.arange(m) / CR
    v = np.zeros(m)
    nz = np.zeros(m)
    dark = np.zeros(m)
    trill = np.zeros(m)
    lo = np.full(m, 1000.0)
    hi = np.full(m, 3000.0)
    keys_t, keys_F = [], []
    stress_at = []
    t = 0.03
    for s in segs:
        a, b = int(t * CR), int((t + s["dur"]) * CR)
        v[a:b] = s["v"]
        nz[a:b] = s["n"]
        dark[a:b] = s["dark"]
        if s.get("trill"):
            trill[a:b] = 1
        if s["band"] is not None:
            lo[a:b], hi[a:b] = s["band"]
        if s["F"] is not None:
            keys_t.append(t + s["dur"] / 2)
            keys_F.append(s["F"])
        if s["stress"]:
            stress_at.append(t + s["dur"] / 2)
        t += s["dur"]
    if not keys_t:
        keys_t, keys_F = [0.0], [NEUTRAL]
    KF = np.array(keys_F)
    F = [np.interp(tc, keys_t, KF[:, i]) for i in range(3)]
    # Коартикуляция и мягкие края: громкость и шум сглажены на ~12 мс, форманты — ещё сильнее.
    v = _smooth(v, 6)
    nz = _smooth(nz, 4)
    dark = _smooth(dark, 8)
    F = [_smooth(f, 10) for f in F]
    # «р» — дрожание языка: громкость качается ~28 раз в секунду.
    v *= 1 - 0.55 * _smooth(trill, 4) * (0.5 + 0.5 * np.sin(2 * np.pi * 28 * tc))
    # Интонация: плавный спад по фразе, подъём на ударных, в конце — спад или вопросительный подъём.
    tau = tc / total
    pitch = f0 * (1.08 - 0.2 * tau)
    for i, at in enumerate(stress_at):
        # Спокойный разговор у прилавка: ударный слог выше на 6–14 % (первый — чуть больше), вопрос — на 18–28 %.
        bump = rng.uniform(0.06, 0.14) * (1.25 if i == 0 else 1.0)
        if question and i == len(stress_at) - 1:
            bump = rng.uniform(0.18, 0.28)
        pitch *= 1 + bump * np.exp(-0.5 * ((tc - at) / 0.07) ** 2)
    if not question:
        pitch *= 1 - 0.1 * np.clip((tc - (total - 0.3)) / 0.3, 0, 1)
    drift = np.cumsum(rng.standard_normal(m)) * 0.0025
    drift -= _smooth(drift, 50)
    pitch *= 1 + np.clip(drift, -0.03, 0.03)
    # ---- голос: гармоники
    n = int(total * SRV)
    ta = np.arange(n) / SRV
    f0a = np.interp(ta, tc, pitch)
    phase = 2 * np.pi * np.cumsum(f0a) / SRV
    K = int(4500 / pitch.min()) + 1
    y = np.zeros(n)
    tilt_k = np.arange(1, K + 1, dtype=float) ** -0.55
    for k in range(1, K + 1):
        fk = k * pitch
        g = v * tilt_k[k - 1] * formant_gain(fk, *F)
        g *= 1 - dark + dark / (1 + (fk / 550) ** 2)
        g *= np.clip((4500 - fk) / 800, 0, 1)
        if g.max() < 1e-5:
            continue
        y += np.interp(ta, tc, g) * np.sin(k * phase + rng.uniform(0, 2 * np.pi))
    # ---- шум: согласные и придыхание (кадры 16 мс, шаг 4 мс, случайная фаза)
    N, H = 256, 64
    frames = n // H + 2
    fr = np.fft.rfftfreq(N, 1 / SRV)
    tf = np.arange(frames) * H / SRV
    nzf = np.interp(tf, tc, nz)
    lof = np.interp(tf, tc, lo)
    hif = np.interp(tf, tc, hi)
    vf = np.interp(tf, tc, v)
    Ff = [np.interp(tf, tc, f) for f in F]
    lf = np.log2(np.maximum(fr, 1.0))
    band = 1 / (1 + np.exp(-4 * (lf[None] - np.log2(lof)[:, None]))) / (1 + np.exp(4 * (lf[None] - np.log2(hif)[:, None])))
    asp = formant_gain(fr[None], Ff[0][:, None], Ff[1][:, None], Ff[2][:, None]) * (fr[None] / 1000) ** 0.5
    mag = nzf[:, None] * band * 6 + breath * vf[:, None] * asp
    spec = mag * np.exp(2j * np.pi * rng.random(mag.shape))
    win = np.hanning(N)
    noise = np.zeros(frames * H + N)
    wsum = np.zeros_like(noise)
    seg = np.fft.irfft(spec, N, axis=1) * win
    for i in range(frames):
        noise[i * H: i * H + N] += seg[i]
        wsum[i * H: i * H + N] += win * win
    noise = noise[:n] / np.maximum(wsum[:n], 1e-3)
    # Шум и голос — в одной шкале: шум нормирован по RMS голоса фразы.
    rv = np.sqrt(np.mean(y * y)) + 1e-9
    rn = np.sqrt(np.mean(noise * noise)) + 1e-9
    out = y / rv + noise / rn * 0.35 * (np.mean(nz) * 4 + breath)
    out = out / (np.sqrt(np.mean(out * out)) + 1e-9)
    edge = int(0.015 * SRV)
    out[:edge] *= np.linspace(0, 1, edge)
    out[-edge:] *= np.linspace(1, 0, edge)
    return out


def babble(seconds, pairs, seed, talk=0.42):
    """Петля гомона: pairs пар собеседников по углам зала, каждый говорит ~talk времени. Стерео (2, n)."""
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    mix = np.zeros((2, n))
    for p in range(pairs):
        pan = rng.uniform(-0.75, 0.75)
        dist = rng.uniform(0.0, 1.0)  # 0 — у самой кассы, 1 — в дальнем углу
        voices = []
        for _ in range(2):
            female = rng.random() < 0.5
            f0 = rng.uniform(175, 235) if female else rng.uniform(95, 135)
            scale = rng.uniform(1.12, 1.2) if female else rng.uniform(0.97, 1.03)
            voices.append((f0, scale, rng.uniform(0.75, 1.0)))
        track = np.zeros(n)
        t = rng.uniform(0, seconds)
        end = t + seconds
        who = 0
        while t < end:
            f0, scale, loud = voices[who]
            phrase = say(rng, f0 * rng.uniform(0.95, 1.05), scale, breath=0.08)
            x = resample_up(phrase, SR // SRV) * loud * rng.uniform(0.7, 1.0)
            circ_add(track, x, int(t * SR))
            t += len(phrase) / SRV
            # Ответ — почти сразу; иногда пара молчит подольше (выбирают товар).
            if rng.random() < 0.65:
                who = 1 - who
                t += rng.uniform(0.15, 0.6)
            else:
                t += rng.uniform(0.3, 0.9)
            if rng.random() < 1 - talk:
                t += rng.uniform(1.5, 5.0)
        # Дальше — глуше и тише; соседи по паре чуть врозь.
        cut = 2800 - 1200 * dist
        track = dsp.filt(track, lambda f, c=cut: dsp.lp_mag(f, c, 2), circular=True)
        g = 1.0 - 0.45 * dist
        for side, sgn in ((0, -1), (1, 1)):
            gl, gr = dsp.pan_gains(np.clip(pan + sgn * 0.08, -1, 1))
            mix[side] += track * g * (gl if side == 0 else gr) * 0.7
    # Без «подвала» и без звона; зал: отзвук комнаты по кругу.
    mix = dsp.filt(mix, lambda f: dsp.hp_mag(f, 170, 2) * dsp.lp_mag(f, 3200, 2), circular=True)
    wet = dsp.reverb(mix, "room", circular=True)
    wet *= np.sqrt(np.mean(mix * mix)) / (np.sqrt(np.mean(wet * wet)) + 1e-12)
    return mix * 0.8 + wet * 0.6


# ---------------------------------------------------------------- капли по стеклу


def glass_taps(seconds, rate, seed, big=0.18):
    """Капли по стеклу витрины: короткие звонкие «тик» (моды стекла 1.8–5.5 кГц), иногда капля
    покрупнее — с низким «ток». rate — капель в секунду. Петля, стерео."""
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    out = np.zeros((2, n))
    count = int(rate * seconds)
    L = int(0.06 * SR)
    t = np.arange(L) / SR
    for _ in range(count):
        a = 0.08 + 0.92 * rng.random() ** 2.6
        f = rng.uniform(1800, 5200)
        y = np.zeros(L)
        for ratio, amp, dec in ((1, 1, rng.uniform(0.004, 0.012)), (rng.uniform(1.55, 1.9), 0.5, 0.005),
                                (rng.uniform(2.4, 2.9), 0.3, 0.003)):
            y += amp * np.sin(2 * np.pi * f * ratio * t + rng.uniform(0, 6.28)) * np.exp(-t / dec)
        if rng.random() < big:
            fl = rng.uniform(650, 1100)
            y += 0.8 * np.sin(2 * np.pi * fl * t) * np.exp(-t / rng.uniform(0.012, 0.022))
        k = int(0.0015 * SR)
        y[:k] += click(k, rng, 3000, 12000) * 0.6
        y *= np.minimum(1, t / 0.0004)
        gl, gr = dsp.pan_gains(rng.uniform(-0.8, 0.8))
        circ_add(out, np.stack([y * gl, y * gr]) * a, int(rng.uniform(0, n)))
    return out


# ---------------------------------------------------------------- улица: велозвонок, трамвай, голуби, фонарь

# Купол велозвонка: моды (отношение, громкость, спад, с).
BIKE = [(0.53, 0.22, 0.5), (1.0, 1.0, 1.05), (1.465, 0.55, 0.75), (2.1, 0.32, 0.5), (2.63, 0.18, 0.38), (3.3, 0.1, 0.28)]


def bike_bell(kind, seed):
    """Велозвонок: 'ding2' — «дзынь-дзынь», 'trill' — крутящийся «дзззынь», 'ding1' — один и потише второй."""
    rng = np.random.default_rng(seed)
    f0 = 2350 * rng.uniform(0.94, 1.06)
    n = int(1.7 * SR)
    out = np.zeros(n)
    hits = {"ding2": [(0.0, 1.0), (0.17, 0.85)],
            "trill": [(i * 0.052, 0.55 + 0.4 * rng.random()) for i in range(7)],
            "ding1": [(0.0, 1.0), (0.45, 0.45)]}[kind]
    for at, a in hits:
        i = int(at * SR)
        t = np.arange(n - i) / SR
        y = modes(t, f0, BIKE, rng)
        k = int(0.002 * SR)
        y[:k] += click(k, rng, 3500, 10000) * 0.8
        out[i:] += y * a
    return fade(norm_peak(out), 0.001, 0.25)


TRAM_BELL = [(0.5, 0.25, 1.2), (1.0, 1.0, 1.6), (1.98, 0.5, 1.0), (2.76, 0.3, 0.7), (4.1, 0.15, 0.4)]


def tram_bell(kind, seed):
    """Звонок трамвая: ниже велосипедного и дольше звенит. 'two' — «дзинь-дзинь», 'three' — трижды."""
    rng = np.random.default_rng(seed)
    f0 = 1180 * rng.uniform(0.96, 1.04)
    n = int(2.6 * SR)
    out = np.zeros(n)
    hits = [(0.0, 1.0), (0.3, 0.9)] if kind == "two" else [(0.0, 1.0), (0.26, 0.85), (0.52, 0.8)]
    for at, a in hits:
        i = int(at * SR)
        t = np.arange(n - i) / SR
        out[i:] += modes(t, f0, TRAM_BELL, rng, detune=1.5) * a
    out = dsp.filt(out, lambda f: dsp.lp_mag(f, 4500, 2))
    wet = dsp.reverb(out, "hall")[0][:n]
    return fade(norm_peak(out * 0.8 + wet * 0.6 * np.std(out) / (np.std(wet) + 1e-12)), 0.001, 0.4)


def tram_pass(seed, squeal=False):
    """Трамвай проходит вдали: стук колёс на стыках «тук-тук… тук-тук», «пение» колёс, вой мотора,
    низкий гул и (иногда) скрип колёс на повороте. Громкость — по расстоянию: ближе всего на середине."""
    rng = np.random.default_rng(seed)
    T = 9.5
    n = int(T * SR)
    t = np.arange(n) / SR
    tc = T / 2
    near = 1 / (1 + ((t - tc) / 2.3) ** 2)
    y = np.zeros(n)
    # Гул корпуса — только низ (динамик телефона его почти не играет, в наушниках — «тяжесть» вагона).
    # Широкого шума нет: шум проезжающей машины звучал как прибой (его из игры и убрали).
    rumble = dsp.shaped_noise(n, rng, lambda f: dsp.bp_mag(f, 60, 240, 4))
    y += rumble * 0.08 * near ** 1.2
    # Колёса на рельсах «поют»: пара тонов с лёгким дрожанием.
    for f, a in ((870, 0.010), (1310, 0.006)):
        wob = f * (1 + 0.003 * np.sin(2 * np.pi * rng.uniform(3, 6) * t))
        y += np.sin(2 * np.pi * np.cumsum(wob) / SR) * a * near ** 1.5
    # Мотор: тон с гармониками, чуть выше на подходе и ниже на уходе (эффект Доплера).
    fm = 410 * (1 + 0.025 * np.tanh((tc - t) / 1.5))
    ph = 2 * np.pi * np.cumsum(fm) / SR
    y += (np.sin(ph) + 0.4 * np.sin(2 * ph) + 0.2 * np.sin(3 * ph)) * 0.03 * near ** 1.6
    # Стыки рельсов «тук-тук… тук-тук»: у вагона две тележки, у тележки две оси. Удар — глухой
    # низ и металлический «клац» (короткий звон рельса).
    L = int(0.08 * SR)
    tt = np.arange(L) / SR
    for joint in np.arange(1.2, T - 1.0, 2.1) + rng.uniform(-0.2, 0.2):
        for off in (0.0, 0.2, 1.05, 1.25):
            at = joint + off + rng.uniform(-0.01, 0.01)
            i = int(at * SR)
            if i + L >= n:
                continue
            thump = np.sin(2 * np.pi * rng.uniform(95, 125) * tt) * np.exp(-tt / 0.035)
            thump += dsp.filt(rng.standard_normal(L), lambda f: dsp.bp_mag(f, 300, 1800, 2)) * np.exp(-tt / 0.01) * 0.7
            fr = rng.uniform(1050, 1500)
            thump += (np.sin(2 * np.pi * fr * tt) + 0.5 * np.sin(2 * np.pi * fr * 2.3 * tt)) * np.exp(-tt / 0.022) * 0.35
            y[i: i + L] += thump * 0.4 * near[i] * rng.uniform(0.8, 1.1)
    if squeal:
        fsq = 3150 + 40 * np.sin(2 * np.pi * 5.5 * t)
        env = np.exp(-0.5 * ((t - tc - 0.6) / 0.9) ** 2)
        y += np.sin(2 * np.pi * np.cumsum(fsq) / SR) * env * 0.012
    # Далеко: верх глуше, вокруг — отзвук улицы.
    y = dsp.filt(y, lambda f: dsp.hp_mag(f, 60, 2) * dsp.lp_mag(f, 3200, 2))
    wet = dsp.reverb(y, "hall")[0][:n]
    y = y * 0.8 + wet * 0.4 * np.std(y) / (np.std(wet) + 1e-12)
    return fade(norm_peak(y), 0.6, 0.8)


def pigeons(seed, birds=3):
    """Голуби вспорхнули: у каждого 10–16 взмахов, первые — с хлопком, дальше реже и тише (улетают)."""
    rng = np.random.default_rng(seed)
    T = 2.2
    n = int(T * SR)
    out = np.zeros(n)
    for b in range(birds):
        t0 = b * rng.uniform(0.03, 0.12) + rng.uniform(0, 0.05)
        centre = rng.uniform(900, 1600)
        beats = rng.integers(10, 17)
        gap = rng.uniform(0.075, 0.09)
        at = t0
        for i in range(beats):
            L = int(rng.uniform(0.03, 0.045) * SR)
            tt = np.arange(L) / SR
            env = np.minimum(1, tt / 0.003) * np.exp(-tt / 0.012)
            burst = dsp.filt(rng.standard_normal(L), lambda f, c=centre: dsp.bp_mag(f, c / 2.5, c * 2.8, 2)) * env
            if i < 3:
                k = int(0.003 * SR)
                burst[:k] += click(k, rng, 800, 6000) * (1.2 - 0.3 * i)
            a = np.exp(-i / 5.5) * rng.uniform(0.8, 1.1)
            j = int(at * SR)
            if j + L < n:
                out[j: j + L] += burst * a
            at += gap * (1 + i * 0.035)
    # Улетают вверх и вдаль: верх постепенно гаснет.
    half = n // 2
    far = dsp.filt(out, lambda f: dsp.lp_mag(f, 2200, 2))
    w = np.clip((np.arange(n) - half * 0.6) / half, 0, 1)
    out = out * (1 - w) + far * w
    return fade(norm_peak(out), 0.001, 0.3)


LAMP_TINK = [(1.0, 1.0, 0.5), (2.41, 0.4, 0.26), (3.9, 0.18, 0.12)]


def lamp(seed):
    """Фонарь загорелся: щелчки поджига, «дзинь» нагревшегося плафона и короткое гудение дросселя."""
    rng = np.random.default_rng(seed)
    T = 2.4
    n = int(T * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    k = int(0.002 * SR)
    for at in np.cumsum(rng.uniform(0.02, 0.04, rng.integers(2, 4))):
        i = int(at * SR)
        out[i: i + k] += click(k, rng, 2500, 9000) * 0.5
    i = int(rng.uniform(0.12, 0.18) * SR)
    out[i:] += modes(t[: n - i], 3400 * rng.uniform(0.92, 1.1), LAMP_TINK, rng, detune=3)
    # Дроссель: 100 Гц (сеть 50 Гц) — в телефоне слышны только его гармоники, поэтому полоса 250–1500.
    ph = 2 * np.pi * 100 * t
    buzz = sum(np.sin(h * ph) / h for h in range(1, 16))
    buzz = dsp.filt(buzz, lambda f: dsp.bp_mag(f, 250, 1500, 2))
    blink = np.ones(n)
    for a, b in ((0.2, 0.27), (0.35, 0.4)):
        blink[int(a * SR): int(b * SR)] = 0.25
    env = np.clip((t - 0.15) / 0.25, 0, 1) * np.exp(-np.maximum(0, t - 0.9) / 0.45) * blink
    out += buzz / (np.std(buzz) + 1e-9) * env * 0.05
    return fade(norm_peak(out), 0.001, 0.3)
