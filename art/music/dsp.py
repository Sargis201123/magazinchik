"""Обработка сигнала на чистом numpy: фильтры в частотной области, реверб на синтетическом
импульсе, задержки, «плёнка», компрессор, true-peak лимитер и громкость по BS.1770 (LUFS).

Все функции работают со стерео-массивами формы (2, n) или моно (n,), частота SR.
Флаг circular=True — обработка по кругу (для бесшовных петель радио): хвосты
заворачиваются в начало, состояние компрессора/лимитера «прогревается» на копии петли.
"""

import numpy as np

SR = 48000


def undb(d):
    return 10.0 ** (np.asarray(d, dtype=float) / 20.0)


def todb(x, floor=1e-12):
    return 20.0 * np.log10(np.maximum(np.abs(x), floor))


def fast_len(n):
    """Ближайшая сверху длина вида 2^a*3^b*5^c — быстрые FFT."""
    best = 1 << int(np.ceil(np.log2(max(n, 1))))
    a = 1
    while a < best:
        b = a
        while b < best:
            c = b
            while c < best:
                if c >= n:
                    best = min(best, c)
                    break
                c *= 5
            b *= 3
        a *= 2
    return best


# ---------------------------------------------------------------- фильтры (АЧХ)

def lp_mag(f, fc, order=2):
    return 1.0 / np.sqrt(1.0 + (np.asarray(f) / fc) ** (2 * order))


def hp_mag(f, fc, order=2):
    r = (np.maximum(np.asarray(f), 1e-9) / fc) ** order
    return r / np.sqrt(1.0 + r * r)


def bp_mag(f, lo, hi, order=2):
    return hp_mag(f, lo, order) * lp_mag(f, hi, order)


def shelf_mag(f, fc, gain_db, high=True, width=1.0):
    """Мягкая полка: плавный переход (логистика по октавам) от 0 дБ к gain_db."""
    x = np.log2(np.maximum(np.asarray(f), 1.0) / fc) / width
    s = 1.0 / (1.0 + np.exp(-2.5 * x))
    if not high:
        s = 1.0 - s
    return undb(gain_db * s)


def peak_mag(f, fc, gain_db, q_oct=1.0):
    """Колокол: гаусс в октавах, ширина q_oct октав (на уровне половины усиления)."""
    x = np.log2(np.maximum(np.asarray(f), 1.0) / fc)
    return undb(gain_db * np.exp(-0.5 * (x / (q_oct / 2.355)) ** 2))


def filt(x, mag_fn, circular=False, tail=0):
    """Нуль-фазовая фильтрация через FFT. mag_fn(freqs) -> АЧХ (или комплексная)."""
    x = np.asarray(x, dtype=float)
    n = x.shape[-1]
    N = n if circular else fast_len(n + max(tail, 2048))
    X = np.fft.rfft(x, N, axis=-1)
    f = np.fft.rfftfreq(N, 1.0 / SR)
    y = np.fft.irfft(X * mag_fn(f), N, axis=-1)
    if circular:
        return y
    if tail:
        return y[..., : n + tail]
    return y[..., :n]


def shaped_noise(n, rng, mag_fn):
    """Шум с заданной спектральной огибающей, нормированный по RMS=1."""
    N = fast_len(n)
    X = np.fft.rfft(rng.standard_normal(N))
    f = np.fft.rfftfreq(N, 1.0 / SR)
    y = np.fft.irfft(X * mag_fn(f), N)[:n]
    r = np.sqrt(np.mean(y * y)) + 1e-12
    return y / r


def fft_convolve(x, h, circular=False):
    """Свёртка (по последней оси). h может быть (n,) или (2, n) при стерео x."""
    n = x.shape[-1]
    m = h.shape[-1]
    if circular:
        N = n
        if m > n:
            raise ValueError("импульс длиннее петли")
        hh = np.zeros(h.shape[:-1] + (N,))
        hh[..., :m] = h
        return np.fft.irfft(np.fft.rfft(x, N, axis=-1) * np.fft.rfft(hh, N, axis=-1), N, axis=-1)
    N = fast_len(n + m)
    y = np.fft.irfft(np.fft.rfft(x, N, axis=-1) * np.fft.rfft(h, N, axis=-1), N, axis=-1)
    return y[..., : n + m - 1]


def pan_gains(p):
    """Равномощностная панорама: p от -1 (лево) до 1 (право)."""
    a = (np.clip(p, -1, 1) + 1) * np.pi / 4
    return np.cos(a), np.sin(a)


# ---------------------------------------------------------------- реверберация

def make_ir(rt60=1.2, predelay=0.012, hf_rt=0.45, lf_rt=1.15, er=0.35, er_span=0.05,
            buildup=0.012, bright=1.0, seed=1, length=None):
    """Синтетический импульс комнаты/пластины (стерео, декоррелированный).

    rt60 — время затухания на средних частотах; hf_rt/lf_rt — множители на 8 кГц и 125 Гц
    (высокие гаснут быстрее — «тёплый» хвост); er — уровень ранних отражений.
    """
    rng = np.random.default_rng(seed)
    T = length or (predelay + rt60 * 1.15 + 0.05)
    n = int(T * SR)
    t = np.arange(n) / SR
    pre = int(predelay * SR)
    N = fast_len(n)
    f = np.fft.rfftfreq(N, 1.0 / SR)
    centers = np.array([63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000], dtype=float)
    # Время затухания по полосам: интерполяция в логарифме частоты.
    lc = np.log2(centers)
    rt_pts = np.interp(lc, [np.log2(125), np.log2(1000), np.log2(8000)], [rt60 * lf_rt, rt60, rt60 * hf_rt])
    out = np.zeros((2, n))
    lf = np.log2(np.maximum(f, 20.0))
    for ch in range(2):
        X = np.fft.rfft(rng.standard_normal(N))
        tail = np.zeros(n)
        for i, c in enumerate(centers):
            # Треугольные (в октавах) маски — в сумме дают единицу.
            w = np.clip(1.0 - np.abs(lf - lc[i]), 0.0, 1.0)
            if i == 0:
                w[lf < lc[0]] = 1.0
            if i == len(centers) - 1:
                w[lf > lc[-1]] = 1.0
            band = np.fft.irfft(X * w * lp_mag(f, 11000 * bright, 2), N)[:n]
            tail += band * np.exp(-6.91 * t / rt_pts[i])
        tail *= 1.0 - np.exp(-t / buildup)
        y = np.zeros(n)
        y[pre:] = tail[: n - pre]
        # Ранние отражения: редкие отводы, слегка затемнённые.
        if er > 0:
            k = 14
            times = np.sort(rng.uniform(0.003, er_span, k)) + predelay * 0.4
            gains = er * rng.uniform(0.4, 1.0, k) * np.exp(-times / (er_span * 1.5)) * rng.choice([-1, 1], k)
            erbuf = np.zeros(n)
            for tt, g in zip(times, gains):
                j = int(tt * SR)
                if j < n:
                    erbuf[j] += g
            erbuf = filt(erbuf, lambda ff: lp_mag(ff, 6000, 1))
            y += erbuf * np.sqrt(np.sum(y * y)) / (np.sqrt(np.sum(erbuf * erbuf)) + 1e-12) * er
        out[ch] = y
    # Нормировка энергии: шумоподобный сигнал проходит без изменения средней мощности.
    out /= np.sqrt(np.mean(np.sum(out * out, axis=1))) + 1e-12
    fade = np.ones(n)
    fl = int(0.05 * SR)
    fade[-fl:] = np.linspace(1, 0, fl) ** 2
    return out * fade


IRS = {}


def ir(name):
    """Набор импульсов: комната, пластина, зал."""
    if name not in IRS:
        if name == "room":
            IRS[name] = make_ir(rt60=0.75, predelay=0.008, hf_rt=0.4, lf_rt=1.1, er=0.6, er_span=0.045, seed=11)
        elif name == "plate":
            IRS[name] = make_ir(rt60=1.9, predelay=0.018, hf_rt=0.55, lf_rt=0.9, er=0.0, buildup=0.004, seed=23)
        elif name == "hall":
            IRS[name] = make_ir(rt60=2.6, predelay=0.028, hf_rt=0.4, lf_rt=1.2, er=0.3, er_span=0.08, buildup=0.03, seed=37)
        else:
            raise KeyError(name)
    return IRS[name]


def reverb(x, name, circular=False):
    h = ir(name)
    if x.ndim == 1:
        x = np.stack([x, x])
    y = fft_convolve(x, h, circular=circular)
    if not circular:
        y = y[:, : x.shape[1] + h.shape[1]]
    return y


# ---------------------------------------------------------------- эхо

def echo(x, delay_s, feedback=0.35, repeats=6, lp=3500, pingpong=True, circular=False):
    """Эхо с затемнением повторов. x стерео (2, n). Возвращает только «мокрый» сигнал."""
    n = x.shape[1]
    D = delay_s * SR
    tail = 0 if circular else int(D * (repeats + 1))
    N = n if circular else fast_len(n + tail)
    X = np.fft.rfft(x, N, axis=-1)
    f = np.fft.rfftfreq(N, 1.0 / SR)
    H = lp_mag(f, lp, 1) * hp_mag(f, 250, 1)
    mono = 0.5 * (X[0] + X[1])
    YL = np.zeros_like(mono)
    YR = np.zeros_like(mono)
    g = 1.0
    Hk = np.ones_like(f)
    for k in range(1, repeats + 1):
        Hk = Hk * H
        ph = np.exp(-2j * np.pi * f * (D * k) / SR)
        term = mono * Hk * ph * g
        if pingpong:
            if k % 2:
                YL += term
            else:
                YR += term
        else:
            YL += term
            YR += term
        g *= feedback
    y = np.fft.irfft(np.stack([YL, YR]), N, axis=-1)
    return y if circular else y[:, : n + tail]


# ---------------------------------------------------------------- «плёнка»

def wow_flutter(x, depth_cents=2.5, rate=0.55, flutter_cents=0.5, frate=6.3, seed=0, period=None):
    """Медленное «плавание» скорости плёнки (через переменную задержку).

    period — длина петли в секундах: частоты округляются так, чтобы модуляция была периодичной.
    """
    rng = np.random.default_rng(seed)
    n = x.shape[-1]
    t = np.arange(n) / SR

    def q(fr):
        if period:
            return max(1, round(fr * period)) / period
        return fr

    d = np.zeros(n)
    comps = [(q(rate), depth_cents), (q(rate * 1.73), depth_cents * 0.5), (q(frate), flutter_cents)]
    for fr, cents in comps:
        dev = 2 ** (cents / 1200) - 1  # относительное отклонение скорости
        amp = dev / (2 * np.pi * fr) * SR  # амплитуда задержки в отсчётах
        d += amp * np.sin(2 * np.pi * fr * t + rng.uniform(0, 2 * np.pi))
    d -= d.min()
    idx = np.arange(n) - d - 2
    out = np.empty_like(x)
    if x.ndim == 1:
        x = x[None]
        out = out[None]
    for c in range(x.shape[0]):
        if period:
            ext = np.concatenate([x[c, -64:], x[c], x[c, :64]])
            out[c] = np.interp(idx + 64, np.arange(n + 128), ext)
        else:
            out[c] = np.interp(idx, np.arange(n), x[c], left=0.0)
    return out if out.shape[0] > 1 else out[0]


def saturate(x, drive=1.6, mix=0.35, asym=0.08):
    """Мягкое насыщение: tanh с лёгкой асимметрией (чётные гармоники), смешано с чистым."""
    y = np.tanh(drive * (x + asym * x * x)) / drive
    return (1 - mix) * x + mix * y


def tape(x, circular=False, hicut=11000, wow=2.5, seed=0, period=None, drive=1.5, mix=0.3):
    y = wow_flutter(x, depth_cents=wow, seed=seed, period=period)
    y = saturate(y, drive=drive, mix=mix)
    y = filt(y, lambda f: lp_mag(f, hicut, 2) * hp_mag(f, 28, 2) * shelf_mag(f, 95, 0.8, high=False), circular=circular)
    return y


# ---------------------------------------------------------------- динамика

def _smooth_env(level_db, attack, release, rate):
    """Сглаживание огибающей с разными атакой/спадом (рекурсия на управляющей частоте)."""
    a = np.exp(-1.0 / (attack * rate))
    r = np.exp(-1.0 / (release * rate))
    out = np.empty_like(level_db)
    s = level_db[0]
    for i, v in enumerate(level_db):
        c = a if v > s else r
        s = c * s + (1 - c) * v
        out[i] = s
    return out


def compress(x, ratio=2.0, thresh_db=None, knee=6.0, attack=0.025, release=0.3, circular=False, rate=1000,
             makeup=False):
    """Мягкий шинный компрессор (RMS-детектор, мягкое колено). Возвращает (y, gain_db)."""
    n = x.shape[-1]
    hop = SR // rate
    m = n // hop + 1
    p = np.mean(x * x, axis=0) if x.ndim == 2 else x * x
    pad = np.zeros(m * hop)
    pad[:n] = p
    if circular:
        pad[n:] = p[: m * hop - n]
    blk = pad.reshape(m, hop).mean(axis=1)
    # RMS по окну 30 мс
    w = max(1, int(0.03 * rate))
    if circular:
        ext = np.concatenate([blk[-w:], blk, blk[:w]])
        rms = np.convolve(ext, np.ones(w) / w, mode="same")[w:-w]
    else:
        rms = np.convolve(blk, np.ones(w) / w, mode="same")
    lvl = 10 * np.log10(rms + 1e-12)
    if thresh_db is None:
        active = lvl[lvl > -60]
        thresh_db = np.percentile(active, 70) if len(active) else -20
    over = lvl - thresh_db
    gr = np.where(over <= -knee / 2, 0.0,
                  np.where(over >= knee / 2, over * (1 / ratio - 1),
                           (1 / ratio - 1) * (over + knee / 2) ** 2 / (2 * knee)))
    if circular:
        g3 = _smooth_env(-np.concatenate([gr, gr, gr]), attack, release, rate)
        gs = -g3[m: 2 * m]
    else:
        gs = -_smooth_env(-gr, attack, release, rate)
    if makeup:
        gs = gs - np.median(gs)
    tt = np.arange(n) / hop
    g = np.interp(tt, np.arange(m), gs)
    return x * undb(g), g


def oversample4(x, circular=False):
    """4-кратная передискретизация через FFT (идеальная интерполяция)."""
    n = x.shape[-1]
    N = n if circular else fast_len(n + 256)
    X = np.fft.rfft(x, N, axis=-1)
    Y = np.zeros(X.shape[:-1] + (N * 2 + 1,), dtype=complex)
    Y[..., : X.shape[-1]] = X
    y = np.fft.irfft(Y, N * 4, axis=-1) * 4
    return y[..., : n * 4]


def true_peak(x, circular=False):
    return float(np.max(np.abs(oversample4(x, circular=circular))))


def _sliding_min(a, w):
    """Минимум в окне [i-w, i+w] (удвоение радиуса)."""
    out = a.copy()
    r = 0
    while r < w:
        s = min(2 * r + 1, w - r)
        left = np.concatenate([out[s:], np.full(s, np.inf)])
        right = np.concatenate([np.full(s, np.inf), out[:-s]])
        out = np.minimum(out, np.minimum(left, right))
        r += s
    return out


def peak_env(x, circular=False):
    """Огибающая true-peak по отсчётам: максимум |x| на 4x по обоим каналам."""
    n = x.shape[-1]
    os = np.abs(oversample4(x, circular=circular))
    if os.ndim == 2:
        os = os.max(axis=0)
    return os.reshape(n, 4).max(axis=1)


def limiter_gain(pk, ceiling_db=-1.0, lookahead=0.0015, release=0.08, circular=False):
    """Гладкое усиление лимитера по огибающей пиков pk (см. peak_env)."""
    n = len(pk)
    ceil = undb(ceiling_db)
    req = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
    w = max(1, int(lookahead * SR))
    if circular:
        ext = np.concatenate([req[-4 * w:], req, req[: 4 * w]])
        m = _sliding_min(ext, w)
        s = np.convolve(m, np.ones(w) / w, mode="same")[4 * w: -4 * w]
    else:
        m = _sliding_min(req, w)
        s = np.convolve(np.pad(m, w, mode="edge"), np.ones(w) / w, mode="same")[w:-w]
    s = np.minimum(s, req)
    if s.min() >= 1.0:
        return np.ones(n)
    # Плавное восстановление: экспоненциальная релаксация вверх (по блокам 0.25 мс).
    hop = 12
    mm = (n + hop - 1) // hop
    blk = np.ones(mm * hop)
    blk[:n] = s
    blk = blk.reshape(mm, hop).min(axis=1)
    rel = np.exp(-1.0 / (release * SR / hop))
    seq = np.concatenate([blk, blk]) if circular else blk
    out = np.empty_like(seq)
    st = 1.0
    for i, v in enumerate(seq):
        st = v if v < st else rel * st + (1 - rel) * v
        out[i] = st
    if circular:
        out = out[mm:]
    g = np.interp(np.arange(n) / hop, np.arange(mm), out)
    return np.minimum(g, s)


def limiter(x, ceiling_db=-1.0, lookahead=0.0015, release=0.08, circular=False):
    """True-peak лимитер: пики ищутся на 4x, усиление — гладкое, с упреждением."""
    g = limiter_gain(peak_env(x, circular), ceiling_db, lookahead, release, circular)
    return x * g, g


# ---------------------------------------------------------------- громкость (ITU-R BS.1770-4)

_KCACHE = {}


def _k_weight_resp(f):
    """Комплексная АЧХ K-фильтра (коэффициенты для 48 кГц из BS.1770)."""
    key = (len(f), float(f[-1]))
    if key in _KCACHE:
        return _KCACHE[key]
    z1 = np.exp(-2j * np.pi * f / SR)
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
    a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]
    a2 = [1.0, -1.99004745483398, 0.99007225036621]
    h1 = (b1[0] + b1[1] * z1 + b1[2] * z1 ** 2) / (a1[0] + a1[1] * z1 + a1[2] * z1 ** 2)
    h2 = (b2[0] + b2[1] * z1 + b2[2] * z1 ** 2) / (a2[0] + a2[1] * z1 + a2[2] * z1 ** 2)
    if len(_KCACHE) > 8:
        _KCACHE.clear()
    _KCACHE[key] = h1 * h2
    return h1 * h2


def k_weight(x, circular=False):
    return filt(x, _k_weight_resp, circular=circular, tail=0)


def _block_powers(y, win, hop):
    p = np.sum(y * y, axis=0) if y.ndim == 2 else y * y
    c = np.concatenate([[0.0], np.cumsum(p)])
    n = len(p)
    starts = np.arange(0, max(n - win, 0) + 1, hop)
    return (c[starts + win] - c[starts]) / win


def loudness(x, circular=False):
    """Интегральная громкость LUFS с гейтами -70 LUFS и -10 LU."""
    if x.ndim == 1:
        x = np.stack([x, x]) * np.sqrt(0.5)  # моно как два канала той же мощности
    return loudness_kw(k_weight(x, circular=circular), circular)


def loudness_kw(y, circular=False):
    """То же по уже K-взвешенному сигналу."""
    if circular:
        y = np.concatenate([y, y[:, : int(0.4 * SR)]], axis=1)
    z = _block_powers(y, int(0.4 * SR), int(0.1 * SR))
    if len(z) == 0:
        return -99.0
    lk = -0.691 + 10 * np.log10(z + 1e-15)
    z1 = z[lk > -70]
    if len(z1) == 0:
        return -99.0
    rel = -0.691 + 10 * np.log10(np.mean(z1)) - 10
    z2 = z[(lk > -70) & (lk > rel)]
    return float(-0.691 + 10 * np.log10(np.mean(z2)))


def short_term_max(x, win=3.0):
    if x.ndim == 1:
        x = np.stack([x, x]) * np.sqrt(0.5)
    y = k_weight(x)
    w = min(int(win * SR), y.shape[1])
    z = _block_powers(y, w, int(0.1 * SR))
    return float(np.max(-0.691 + 10 * np.log10(z + 1e-15)))


def momentary_max(x):
    return short_term_max(x, 0.4)


def lra(x):
    """Диапазон громкости (LRA) по коротким окнам 3 с — упрощённо."""
    y = k_weight(x)
    z = _block_powers(y, int(3 * SR), int(0.1 * SR))
    lk = -0.691 + 10 * np.log10(z + 1e-15)
    lk = lk[lk > -70]
    if len(lk) < 2:
        return 0.0
    rel = -0.691 + 10 * np.log10(np.mean(10 ** ((lk + 0.691) / 10))) - 20
    lk = lk[lk > rel]
    return float(np.percentile(lk, 95) - np.percentile(lk, 10))


def octave_bands(x):
    """Энергия по октавам (дБ относительно общей), центры 31.5 Гц … 16 кГц."""
    m = x.mean(axis=0) if x.ndim == 2 else x
    N = fast_len(len(m))
    P = np.abs(np.fft.rfft(m, N)) ** 2
    f = np.fft.rfftfreq(N, 1.0 / SR)
    centers = [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
    tot = P.sum() + 1e-20
    res = {}
    for c in centers:
        sel = (f >= c / np.sqrt(2)) & (f < c * np.sqrt(2))
        res[c] = 10 * np.log10(P[sel].sum() / tot + 1e-20)
    return res
