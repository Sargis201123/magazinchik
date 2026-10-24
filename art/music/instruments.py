"""Тёплые инструменты, синтезированные с нуля (numpy): FM-электропиано, струна Карплуса—Стронга,
контрабас/бас-гитара, пэды, челеста/колокольчик/вибрафон (модальный синтез), медь, кларнет,
флейта, ударные из отфильтрованного шума.

Каждая функция возвращает моно-массив одной ноты: f — частота (Гц), dur — длительность (с),
vel — сила 0..1. Уровни примерно нормированы к пику ~1 при vel=1; баланс делает микшер.
"""

import numpy as np

from dsp import SR, bp_mag, hp_mag, lp_mag, shaped_noise


def midi_hz(m):
    return 440.0 * 2.0 ** ((m - 69) / 12.0)


def _t(n):
    return np.arange(n) / SR


def _release(t, dur, rel):
    """Множитель затухания после отпускания ноты."""
    g = np.ones_like(t)
    off = t > dur
    g[off] = np.exp(-(t[off] - dur) / max(rel, 1e-4))
    return g


def _attack(t, a):
    return 1.0 - np.exp(-t / max(a, 1e-5))


def _fade_tail(y, ms=8):
    k = min(len(y), int(ms * SR / 1000))
    if k > 1:
        y[-k:] *= np.linspace(1, 0, k)
    return y


# ---------------------------------------------------------------- FM-электропиано (Rhodes)

def epiano(f, dur, vel, rng, tine=1.0, decay=1.0, rel=0.12, bark=1.0):
    """FM-электропиано: «тело» 1:1 + металлический «язычок» 1:14, яркость растёт с силой удара.

    Колокольный «язычок» звучит ~0.1 с (а не 20 мс), индекс тела держится дольше, а нелинейность
    звукоснимателя (несимметричное насыщение, как у Rhodes при сильном ударе) добавляет 2–4-ю
    гармоники — от них «присутствие» в 1.5–4 кГц, которое слышно и в динамике телефона.
    """
    tau = np.clip(decay * 3.0 * (220.0 / f) ** 0.5, 0.5, 7.0)
    n = int((dur + rel * 6) * SR)
    t = _t(n)
    v = vel
    amp = (0.6 * np.exp(-t / tau) + 0.4 * np.exp(-t / (tau * 0.22))) * _attack(t, 0.0015)
    amp *= _release(t, dur, rel)
    ph = 2 * np.pi * f * t + rng.uniform(0, 2 * np.pi)
    reg = np.clip((520.0 / f) ** 0.6, 0.35, 1.4)  # верхние ноты мягче — меньше индекса
    i1 = bark * (0.25 + 1.5 * v ** 2) * (0.5 * np.exp(-t / 0.22) + 0.7 * np.exp(-t / 2.5)) * reg
    body = np.sin(ph + i1 * np.sin(ph + 0.3))
    k = np.clip(800.0 / f, 0.0, 1.0)
    i2 = tine * (0.5 + 1.4 * v) * np.exp(-t / 0.12) * k
    tine_sig = np.sin(ph * 1.0007 + i2 * np.sin(14.0 * ph)) * np.exp(-t / 0.35)
    y = amp * (body + 0.7 * tine * (0.4 + 0.6 * v) * tine_sig)
    # звукосниматель: чем сильнее удар, тем больше «рычания»; спадает вместе с амплитудой
    drive = bark * (0.6 + 1.6 * v ** 1.5) * np.clip((330.0 / f) ** 0.3, 0.6, 1.3)
    y = np.tanh(drive * (y + 0.35 * y * y)) / np.tanh(drive)
    # квадратичный член даёт и постоянную составляющую, повторяющую огибающую, — убираем её
    y = np.fft.irfft(np.fft.rfft(y) * hp_mag(np.fft.rfftfreq(n, 1 / SR), 30, 2), n)
    return _fade_tail(y * (0.25 + 0.75 * v ** 1.4) * 0.55)


# ---------------------------------------------------------------- Карплус—Стронг

def ks_string(f, dur, vel, rng, bright=0.45, pos=0.18, t60=3.0, rel=0.09, body=True, mute=0.0):
    """Щипковая струна Карплуса—Стронга с дробной задержкой и потерями в петле.

    bright — яркость (0 — нейлон под большим пальцем, 1 — металл медиатором);
    pos — место щипка (доля длины струны); mute — глушение ладонью (0..1).
    """
    N = SR / f
    c = 0.5 * (1 - bright) * 0.9  # дополнительное сглаживание в петле
    lp = np.convolve([0.5, 0.5], [1 - c, c])
    L = int(np.floor(N - 0.5 - c))
    fr = N - 0.5 - c - L
    h = np.convolve(lp, [1 - fr, fr])
    t60 = t60 * (1 - 0.8 * mute)
    rho = 10 ** (-3.0 / (f * t60))
    rho_off = 10 ** (-3.0 / (f * max(rel, 0.01) * 2.0))
    total = int((dur + rel * 6) * SR)
    pad = L + len(h) + 1
    y = np.zeros(total + pad)
    x = np.zeros(total + pad)
    nex = int(round(N))
    ex = rng.standard_normal(nex + 64)
    # Окраска возбуждения: мягкий щипок — сглаженный шум.
    k = max(1, int(round(SR / (900 + 7000 * bright * (0.4 + 0.6 * vel)))))
    ex = np.convolve(ex, np.ones(k) / k, mode="same")[:nex]
    p = max(1, int(round(pos * N)))
    ex = ex - np.concatenate([np.zeros(p), ex[:-p]])
    ex -= ex.mean()
    ex *= np.hanning(nex) ** 0.25
    # Ровная энергия щипка: случайность меняет только тембр, а не громкость; выше — чуть громче,
    # чтобы верхние голоса перебора не тонули.
    ex /= np.sqrt(np.mean(ex * ex)) + 1e-9
    ex *= (f / 196.0) ** 0.3
    x[pad:pad + nex] = ex * vel * 0.5
    off = pad + int(dur * SR)
    taps = len(h)
    s = pad
    while s < total + pad:
        e = min(s + L, total + pad)
        r = rho if s < off else rho_off
        acc = np.zeros(e - s)
        for j in range(taps):
            acc += h[j] * y[s - L - j: e - L - j]
        y[s:e] = x[s:e] + r * acc
        s = e
    out = y[pad:]
    return _fade_tail(out * 0.9)


def guitar_body_ir(kind="nylon"):
    """Короткий импульс «деревянного корпуса»: прямой звук + резонансы."""
    n = int(0.12 * SR)
    t = _t(n)
    y = np.zeros(n)
    y[0] = 1.0
    if kind == "nylon":
        modes = [(98, 0.10, 0.06), (196, 0.07, 0.05), (290, 0.05, 0.04), (410, 0.04, 0.03), (580, 0.025, 0.02),
                 (1000, 0.012, 0.012)]
    else:  # металлические струны / кавакиньо / джазовая гитара
        modes = [(110, 0.06, 0.05), (230, 0.05, 0.04), (340, 0.04, 0.03), (720, 0.03, 0.015), (1500, 0.015, 0.01)]
    for fr, g, tau in modes:
        y += g * np.sin(2 * np.pi * fr * t) * np.exp(-t / tau) * 2 * np.pi * fr / SR * 30
    return y


# ---------------------------------------------------------------- бас

def _finger(n, t, rng, level=0.15):
    """Шум пальца по струне: 25 мс полосы 500–1500 Гц — по нему бас «читается» в телефоне."""
    return shaped_noise(n, rng, lambda ff: bp_mag(ff, 500, 1500, 2)) * np.exp(-t / 0.025) * level


def bass_upright(f, dur, vel, rng, rel=0.07, tone=1.0, tau=None):
    """Контрабас щипком: богатый ряд гармоник (2–8-я) и шум пальца — основной тон дома слышно
    в наушниках, а в динамике телефона бас «достраивается» ухом по гармоникам."""
    tau = tau or float(np.clip(0.9 * (60.0 / f) ** 0.25, 0.5, 1.4))
    n = int((dur + rel * 6) * SR)
    t = _t(n)
    fi = f * (1 + 0.006 * np.exp(-t / 0.035))
    ph = 2 * np.pi * np.cumsum(fi) / SR + rng.uniform(0, 2 * np.pi)
    amps = np.array([1.0, 0.7, 0.55, 0.4, 0.3, 0.22, 0.15, 0.1])
    y = np.zeros(n)
    for k, a in enumerate(amps, start=1):
        if k * f > 5000:
            break
        a = a * (tone if k > 1 else 1.0)
        y += a * np.exp(-t * (1 + 0.35 * (k - 1)) / tau) * np.sin(k * ph + 0.2 * k)
    thump = shaped_noise(n, rng, lambda ff: lp_mag(ff, 700, 2)) * np.exp(-t / 0.012) * 0.25
    y = (y + thump + _finger(n, t, rng) * (0.5 + vel)) * _attack(t, 0.004) * _release(t, dur, rel)
    y = np.tanh(1.1 * y / 2.2) / np.tanh(1.1)  # лёгкое насыщение (ряд гармоник и так богат)
    return _fade_tail(y * (0.35 + 0.65 * vel) * 0.6)


def bass_electric(f, dur, vel, rng, rel=0.06, tone=1.0):
    """Округлая бас-гитара пальцами: протяжнее контрабаса, ряд гармоник до 8-й, шум пальца."""
    n = int((dur + rel * 6) * SR)
    t = _t(n)
    ph = 2 * np.pi * f * t + rng.uniform(0, 2 * np.pi)
    amps = [1.0, 0.7, 0.55, 0.4, 0.3, 0.22, 0.15, 0.1]
    y = np.zeros(n)
    for k, a in enumerate(amps, start=1):
        if k * f > 6000:
            break
        a = a * (tone if k > 1 else 1)
        dk = 1 + 0.35 * (k - 1)
        y += a * (0.65 * np.exp(-t * dk / 3.5) + 0.35 * np.exp(-t * dk / 0.25)) * np.sin(k * ph + 0.3 * k)
    y = (y + _finger(n, t, rng, 0.12) * (0.5 + vel)) * _attack(t, 0.003) * _release(t, dur, rel)
    y = np.tanh(1.2 * y / 2.2) / np.tanh(1.2)
    return _fade_tail(y * (0.4 + 0.6 * vel) * 0.55)


# ---------------------------------------------------------------- таблицы волн

def _table(amps, size=4096):
    spec = np.zeros(size // 2 + 1, dtype=complex)
    k = np.arange(1, len(amps) + 1)
    spec[1: len(amps) + 1] = np.asarray(amps) * np.exp(1j * (-np.pi / 2 + 0.0 * k))
    tab = np.fft.irfft(spec, size) * size / 2
    return np.concatenate([tab, tab[:1]])


def _osc(tab, phase):
    """Чтение таблицы с линейной интерполяцией."""
    size = len(tab) - 1
    x = (phase % 1.0) * size
    i0 = x.astype(np.int64)
    fr = x - i0
    return tab[i0] * (1 - fr) + tab[i0 + 1] * fr


def saw_amps(f, cutoff, slope=1.0, order=2, fmax=10000.0):
    K = max(1, int(min(fmax, SR * 0.45) // f))
    k = np.arange(1, K + 1)
    return (1.0 / k ** slope) * lp_mag(k * f, cutoff, order)


def pad_voice(f, dur, vel, rng, attack=0.9, rel=1.4, cutoff=1400.0, detune=7.0, voices=3, spread=0.8):
    """Пэд: несколько расстроенных «пил», мягко отфильтрованных, медленная атака. Стерео (2, n)."""
    n = int((dur + rel * 3.2) * SR)
    t = _t(n)
    env = (1 - np.exp(-t / (attack / 3))) * _release(t, dur, rel)
    dark = _table(saw_amps(f, cutoff * 0.6, 1.2))
    br = _table(saw_amps(f, cutoff, 1.0))
    out = np.zeros((2, n))
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(0.07, 0.15) * t + rng.uniform(0, 6.28))
    for i in range(voices):
        cents = (i - (voices - 1) / 2) * 2 * detune / max(voices - 1, 1)
        drift = 1.5 * np.sin(2 * np.pi * rng.uniform(0.1, 0.3) * t + rng.uniform(0, 6.28))
        fi = f * 2 ** ((cents + drift) / 1200)
        ph = np.cumsum(fi) / SR + rng.uniform(0, 1)
        s = _osc(dark, ph) * (1 - 0.4 * lfo) + _osc(br, ph) * 0.4 * lfo
        p = (i - (voices - 1) / 2) / max((voices - 1) / 2, 1) * spread
        a = (p + 1) * np.pi / 4
        out[0] += np.cos(a) * s
        out[1] += np.sin(a) * s
    out *= env * (0.4 + 0.6 * vel) * 0.35 / voices
    return out


def brass(f, dur, vel, rng, voices=3, detune=4.0, vib=8.0, vib_rate=5.2, dark=0.0, attack=None, rel=0.1,
          scoop=25.0, breath=0.03):
    """Медь: ансамбль «пил» с огибающей яркости (сначала ярче, потом ровнее), подъезд снизу,
    задержанное вибрато. dark>0 — темнее (флюгельгорн/валторна)."""
    attack = attack if attack is not None else 0.035 + 0.03 * (1 - vel)
    n = int((dur + rel * 6) * SR)
    t = _t(n)
    fmax = 7000 - 3500 * dark
    tab_d = _table(saw_amps(f, 900 + 400 * (1 - dark), 1.6, 2, fmax))
    tab_b = _table(saw_amps(f, 2600 - 1200 * dark, 1.05, 2, fmax))
    env = _attack(t, attack / 2.5) * _release(t, dur, rel)
    peak = 0.55 + 0.45 * vel
    sus = 0.25 + 0.35 * vel
    b = np.clip(t / (attack * 1.2), 0, 1) * peak
    b = np.where(t > attack * 1.2, sus + (peak - sus) * np.exp(-(t - attack * 1.2) / 0.18), b)
    b = b * _release(t, dur, rel * 0.7) * (1 - 0.5 * dark)
    vib_env = np.clip((t - 0.22) / 0.3, 0, 1)
    y = np.zeros(n)
    for i in range(voices):
        cents = (i - (voices - 1) / 2) * detune + rng.normal(0, 1.0)
        sc = -scoop * np.exp(-t / 0.035)
        vb = vib * vib_env * np.sin(2 * np.pi * (vib_rate + rng.normal(0, 0.15)) * t + rng.uniform(0, 6.28))
        fi = f * 2 ** ((cents + sc + vb) / 1200)
        ph = np.cumsum(fi) / SR + rng.uniform(0, 1)
        off = int(abs(rng.normal(0, 0.006)) * SR) if i else 0
        s = _osc(tab_d, ph) * (1 - b) + _osc(tab_b, ph) * b
        if off:
            s = np.concatenate([np.zeros(off), s[:-off]])
        y += s
    nz = shaped_noise(n, rng, lambda ff: bp_mag(ff, 900, 3500, 1)) * breath * (0.3 + b)
    y = (y / voices + nz) * env
    return _fade_tail(y * (0.3 + 0.7 * vel) * 0.4)


def clarinet(f, dur, vel, rng, vib=10.0, rel=0.07, attack=0.045):
    """Кларнет: нечётные гармоники преобладают, тёплый тембр, лёгкое джазовое вибрато."""
    n = int((dur + rel * 6) * SR)
    t = _t(n)
    K = int(min(9000, SR * 0.45) // f)
    k = np.arange(1, K + 1)
    odd = np.where(k % 2 == 1, 1.0 / k ** 1.05, 0.12 / k ** 1.3)
    a_d = odd * lp_mag(k * f, 1500, 2)
    a_b = odd * lp_mag(k * f, 3200, 2)
    td, tb = _table(a_d), _table(a_b)
    env = _attack(t, attack / 2.5) * _release(t, dur, rel)
    b = (0.35 + 0.5 * vel) * (0.7 + 0.3 * np.exp(-t / 0.15))
    vib_env = np.clip((t - 0.25) / 0.35, 0, 1)
    fi = f * 2 ** ((vib * vib_env * np.sin(2 * np.pi * 5.4 * t) - 12 * np.exp(-t / 0.03)) / 1200)
    ph = np.cumsum(fi) / SR
    y = _osc(td, ph) * (1 - b) + _osc(tb, ph) * b
    nz = shaped_noise(n, rng, lambda ff: bp_mag(ff, 1200, 5000, 1)) * 0.025
    y = (y + nz) * env
    return _fade_tail(y * (0.35 + 0.65 * vel) * 0.45)


def flute(f, dur, vel, rng, vib=12.0, rel=0.09, attack=0.06, breath=0.045):
    """Флейта-окарина: почти синус + чуть гармоник, дыхание, «чифф» в атаке, вибрато с задержкой."""
    n = int((dur + rel * 6) * SR)
    t = _t(n)
    vib_env = np.clip((t - 0.3) / 0.4, 0, 1)
    fi = f * 2 ** ((vib * vib_env * np.sin(2 * np.pi * 5.0 * t + rng.uniform(0, 6)) - 8 * np.exp(-t / 0.04)) / 1200)
    ph = 2 * np.pi * np.cumsum(fi) / SR
    y = np.sin(ph) + 0.30 * np.sin(2 * ph + 0.4) + 0.14 * np.sin(3 * ph + 1.1) + 0.07 * np.sin(4 * ph + 0.5)
    env = _attack(t, attack / 2.5) * _release(t, dur, rel)
    nz = shaped_noise(n, rng, lambda ff: bp_mag(ff, f * 0.8, min(f * 4, 5000), 2)) * breath
    chiff = shaped_noise(n, rng, lambda ff: bp_mag(ff, 1500, 6000, 1)) * np.exp(-t / 0.025) * 0.12 * vel
    y = (y + nz) * env + chiff * _attack(t, 0.003)
    return _fade_tail(y * (0.4 + 0.6 * vel) * 0.45)


def pluck_lead(f, dur, vel, rng, rel=0.12):
    """Мягкий «поп»-лид: пила с быстро закрывающимся фильтром (две таблицы) и хорусом."""
    n = int((dur + rel * 6) * SR)
    t = _t(n)
    tb = _table(saw_amps(f, 3000, 1.0, 2, 9000))
    td = _table(saw_amps(f, 900, 1.3, 2, 6000))
    b = 0.15 + 0.75 * vel * np.exp(-t / 0.12)
    env = _attack(t, 0.004) * (0.55 + 0.45 * np.exp(-t / 0.35)) * _release(t, dur, rel)
    y = np.zeros(n)
    for c in (-6, 6):
        ph = np.cumsum(np.full(n, f * 2 ** (c / 1200))) / SR + rng.uniform(0, 1)
        y += _osc(td, ph) * (1 - b) + _osc(tb, ph) * b
    return _fade_tail(y * env * (0.35 + 0.65 * vel) * 0.3)


# ---------------------------------------------------------------- модальный синтез

CELESTA = [(1.0, 1.0, 1.5), (2.0, 0.25, 0.5), (3.0, 0.12, 0.25), (4.0, 0.08, 0.12), (6.9, 0.012, 0.04)]
GLOCK = [(1.0, 1.0, 1.4), (2.76, 0.28, 0.35), (5.40, 0.12, 0.1), (8.93, 0.05, 0.04)]
VIBES = [(1.0, 1.0, 2.6), (3.99, 0.4, 0.6), (9.8, 0.1, 0.15)]
MUSICBOX = [(1.0, 1.0, 1.9), (2.0, 0.12, 0.6), (5.95, 0.05, 0.15), (9.3, 0.02, 0.05)]
BELL = [(0.5, 0.35, 4.0), (1.0, 1.0, 3.0), (2.0, 0.5, 1.6), (2.76, 0.16, 0.8), (3.0, 0.25, 1.0), (4.07, 0.1, 0.5),
        (5.2, 0.05, 0.25)]  # «куранты»: без малой терции церковного колокола — не спорит с мажором
DOORBELL = [(1.0, 1.0, 1.2), (2.32, 0.3, 0.5), (4.25, 0.12, 0.2), (6.8, 0.05, 0.08)]
COIN = [(1.0, 1.0, 0.45), (2.0, 0.15, 0.2), (2.98, 0.25, 0.12), (5.1, 0.08, 0.05)]


def modal(f, dur, vel, rng, partials, rel=None, attack=0.001, hammer=0.03, hammer_lp=6000, tremolo=0.0,
          trem_rate=5.0, decay=1.0, bright=1.0):
    """Сумма затухающих синусоид (бруски, пластины, колокола)."""
    longest = max(p[2] for p in partials) * decay
    length = (min(dur, longest * 5) + (rel if rel else 0) * 5) if rel else longest * 5
    n = int(max(length, 0.05) * SR)
    t = _t(n)
    y = np.zeros(n)
    for r, a, tau in partials:
        fr = f * r
        if fr > SR * 0.42:
            continue
        if r > 1.5:
            a = a * np.sqrt(vel) * bright  # верхние призвуки ярче при сильном ударе
        y += a * np.exp(-t / (tau * decay)) * np.sin(2 * np.pi * fr * t + rng.uniform(0, 6.28))
    if hammer:
        y += shaped_noise(n, rng, lambda ff: bp_mag(ff, 1500, hammer_lp, 1)) * np.exp(-t / 0.004) * hammer * vel
    y *= _attack(t, attack)
    if tremolo:
        y *= 1 - tremolo * (0.5 + 0.5 * np.sin(2 * np.pi * trem_rate * t + rng.uniform(0, 6.28)))
    if rel:
        y *= _release(t, dur, rel)
    return _fade_tail(y * (0.25 + 0.75 * vel) * 0.5)


# ---------------------------------------------------------------- ударные

def _nz(n, rng, fn):
    # Всё выше ~12 кГц всё равно срежет «плёнка» — сразу убираем, чтобы громкость стема была честной.
    return shaped_noise(n, rng, lambda f: fn(f) * lp_mag(f, 12500, 2))


def kick_soft(vel, rng, f0=52.0, punch=70.0, decay=0.28, click=0.35, knock=0.3):
    n = int((decay * 5) * SR)
    t = _t(n)
    fi = f0 + punch * np.exp(-t / 0.03)
    ph = 2 * np.pi * np.cumsum(fi) / SR
    body = np.sin(ph) * np.exp(-t / decay)
    h2 = 0.25 * np.sin(2 * ph) * np.exp(-t / (decay * 0.4))  # 2-я гармоника — слышно в телефоне
    ck = _nz(n, rng, lambda ff: bp_mag(ff, 800, 4000, 1)) * np.exp(-t / 0.003) * click
    # «стук» колотушки ~150 Гц: в динамике телефона бочка слышна по нему
    kn = np.sin(2 * np.pi * 150 * t + 0.5) * np.exp(-t / 0.04) * knock
    y = (body + h2 + ck + kn) * _attack(t, 0.0008)
    return _fade_tail(y * (0.3 + 0.7 * vel) * 0.8)


def bass_drum(vel, rng):
    """Большой маршевый барабан: глубокий, мягкая колотушка."""
    n = int(1.3 * SR)
    t = _t(n)
    fi = 58 + 22 * np.exp(-t / 0.05)
    ph = 2 * np.pi * np.cumsum(fi) / SR
    y = np.sin(ph) * np.exp(-t / 0.35) + 0.35 * np.sin(1.6 * ph) * np.exp(-t / 0.15) + 0.2 * np.sin(2 * ph) * np.exp(-t / 0.2)
    y += _nz(n, rng, lambda ff: lp_mag(ff, 500, 2)) * np.exp(-t / 0.03) * 0.3
    return _fade_tail(y * _attack(t, 0.002) * (0.3 + 0.7 * vel) * 0.8)


def surdo(vel, rng, f0=80.0, muted=False):
    n = int((0.25 if muted else 1.0) * SR)
    t = _t(n)
    dec = 0.07 if muted else 0.4
    fi = f0 + 12 * np.exp(-t / 0.04)
    ph = 2 * np.pi * np.cumsum(fi) / SR
    y = np.sin(ph) * np.exp(-t / dec) + 0.4 * np.sin(2 * ph) * np.exp(-t / (dec * 0.5)) + 0.2 * np.sin(3.1 * ph) * np.exp(-t / (dec * 0.3))
    y += _nz(n, rng, lambda ff: bp_mag(ff, 100, 900, 1)) * np.exp(-t / 0.015) * 0.3
    return _fade_tail(y * _attack(t, 0.001) * (0.3 + 0.7 * vel) * 0.75)


def brush_tap(vel, rng):
    n = int(0.35 * SR)
    t = _t(n)
    nz = _nz(n, rng, lambda ff: bp_mag(ff, 700, 7000, 1)) * np.exp(-t / 0.07)
    body = np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.05) * 0.4
    y = (nz * 0.5 + body) * _attack(t, 0.0015)
    return _fade_tail(y * (0.2 + 0.8 * vel) * 0.6)


def brush_swish(vel, rng, length=0.45):
    """Щётка по пластику по кругу: «шшш» с медленным нарастанием."""
    n = int((length + 0.2) * SR)
    t = _t(n)
    env = np.sin(np.pi * np.clip(t / length, 0, 1)) ** 1.5
    nz = _nz(n, rng, lambda ff: bp_mag(ff, 1800, 8000, 1))
    return _fade_tail(nz * env * (0.3 + 0.7 * vel) * 0.18)


def rim(vel, rng):
    """Удар по ободу (кросс-стик): деревянный «ток»."""
    n = int(0.15 * SR)
    t = _t(n)
    y = (np.sin(2 * np.pi * 1750 * t) * np.exp(-t / 0.012) + 0.7 * np.sin(2 * np.pi * 820 * t) * np.exp(-t / 0.02)
         + 0.5 * np.sin(2 * np.pi * 450 * t) * np.exp(-t / 0.03))
    y += _nz(n, rng, lambda ff: bp_mag(ff, 2000, 9000, 1)) * np.exp(-t / 0.002) * 0.6
    return _fade_tail(y * _attack(t, 0.0004) * (0.2 + 0.8 * vel) * 0.5)


def clock_tick(vel, rng, high=True):
    n = int(0.06 * SR)
    t = _t(n)
    f = 1800 if high else 1400
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.004) + 0.5 * np.sin(2 * np.pi * f * 1.62 * t) * np.exp(-t / 0.003)
    y += _nz(n, rng, lambda ff: bp_mag(ff, 3000, 9000, 1)) * np.exp(-t / 0.0015) * 0.4
    return _fade_tail(y * vel * 0.35)


def shaker(vel, rng, length=0.07, lo=4500, hi=12000):
    n = int((length * 3) * SR)
    t = _t(n)
    env = _attack(t, 0.006) * np.exp(-t / length)
    nz = _nz(n, rng, lambda ff: bp_mag(ff, lo, hi, 2))
    return _fade_tail(nz * env * (0.2 + 0.8 * vel) * 0.25)


def hat(vel, rng, open_=False):
    n = int((0.6 if open_ else 0.12) * SR)
    t = _t(n)
    dec = 0.22 if open_ else 0.035
    metal = np.zeros(n)
    for r in (1.0, 1.342, 1.651, 1.985, 2.3, 2.71):
        metal += np.sin(2 * np.pi * 2600 * r * t + rng.uniform(0, 6.28))
    nz = _nz(n, rng, lambda ff: hp_mag(ff, 6000, 2))
    y = (0.35 * metal * np.exp(-t / (dec * 0.6)) + nz) * np.exp(-t / dec) * _attack(t, 0.0005)
    y = np.fft.irfft(np.fft.rfft(y) * hp_mag(np.fft.rfftfreq(n, 1 / SR), 5000, 2), n)
    return _fade_tail(y * (0.2 + 0.8 * vel) * 0.2)


def ride(vel, rng):
    n = int(1.6 * SR)
    t = _t(n)
    y = np.zeros(n)
    for _ in range(18):
        fr = rng.uniform(3000, 9000)
        y += rng.uniform(0.3, 1) * np.sin(2 * np.pi * fr * t + rng.uniform(0, 6.28)) * np.exp(-t / rng.uniform(0.3, 1.0))
    y = y / 18 * 1.2 + _nz(n, rng, lambda ff: bp_mag(ff, 5000, 11000, 1)) * np.exp(-t / 0.4) * 0.25
    y += np.sin(2 * np.pi * 4200 * t) * np.exp(-t / 0.15) * 0.15  # «пинг» удара
    return _fade_tail(y * _attack(t, 0.0008) * (0.2 + 0.8 * vel) * 0.25)


def crash(vel, rng, length=1.8):
    n = int(length * 2 * SR)
    t = _t(n)
    nz = _nz(n, rng, lambda ff: bp_mag(ff, 2500, 12000, 1))
    y = np.zeros(n)
    for _ in range(30):
        fr = rng.uniform(1500, 9000)
        y += np.sin(2 * np.pi * fr * t + rng.uniform(0, 6.28)) * np.exp(-t / rng.uniform(0.3, length))
    y = (nz * np.exp(-t / (length * 0.5)) + y / 30 * 0.6) * _attack(t, 0.002)
    return _fade_tail(y * (0.2 + 0.8 * vel) * 0.22)


def clap(vel, rng):
    n = int(0.4 * SR)
    t = _t(n)
    nz = _nz(n, rng, lambda ff: bp_mag(ff, 900, 4500, 2))
    env = np.zeros(n)
    for i, d in enumerate((0.0, 0.009, 0.019, 0.03)):
        tt = t - d
        e = np.where(tt >= 0, np.exp(-np.maximum(tt, 0) / (0.006 if i < 3 else 0.11)), 0)
        env += e * (0.7 if i < 3 else 1.0)
    return _fade_tail(nz * env * (0.2 + 0.8 * vel) * 0.3)


def snare(vel, rng, wires=1.0, f0=190.0, decay=0.16, bright=1.0):
    n = int((decay * 4) * SR)
    t = _t(n)
    body = (np.sin(2 * np.pi * f0 * t) * np.exp(-t / 0.05) + 0.5 * np.sin(2 * np.pi * f0 * 1.74 * t) * np.exp(-t / 0.035))
    nz = _nz(n, rng, lambda ff: bp_mag(ff, 1400, 6000 + 3000 * bright, 2)) * np.exp(-t / decay) * wires
    y = (0.6 * body + 0.55 * nz) * _attack(t, 0.0008)
    return _fade_tail(y * (0.15 + 0.85 * vel) * 0.5)


def tamborim(vel, rng):
    n = int(0.12 * SR)
    t = _t(n)
    y = np.sin(2 * np.pi * 620 * t) * np.exp(-t / 0.03) + 0.4 * np.sin(2 * np.pi * 1350 * t) * np.exp(-t / 0.015)
    y += _nz(n, rng, lambda ff: bp_mag(ff, 1500, 8000, 1)) * np.exp(-t / 0.006) * 0.5
    return _fade_tail(y * _attack(t, 0.0005) * (0.2 + 0.8 * vel) * 0.4)


def agogo(vel, rng, high=True):
    f = 930.0 if high else 700.0
    n = int(0.6 * SR)
    t = _t(n)
    y = (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.18) + 0.4 * np.sin(2 * np.pi * f * 2.41 * t) * np.exp(-t / 0.06)
         + 0.2 * np.sin(2 * np.pi * f * 3.9 * t) * np.exp(-t / 0.03))
    y += _nz(n, rng, lambda ff: bp_mag(ff, 2000, 8000, 1)) * np.exp(-t / 0.002) * 0.3
    return _fade_tail(y * _attack(t, 0.0005) * (0.2 + 0.8 * vel) * 0.3)


def cuica(vel, rng, up=True, length=0.22):
    """Куика: трение палочкой — скользящий «вой» с формантой."""
    n = int((length + 0.08) * SR)
    t = _t(n)
    x = np.clip(t / length, 0, 1)
    f = (420 + 380 * x) if up else (800 - 330 * x)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)
    env = np.sin(np.pi * np.clip(t / (length + 0.05), 0, 1)) ** 0.7
    return _fade_tail(y * env * vel * 0.18)


def apito(vel, rng, length=0.25):
    """Свисток самбы: высокий тон с трелью шарика и дыханием."""
    n = int((length + 0.05) * SR)
    t = _t(n)
    trill = 1 + 0.03 * np.sin(2 * np.pi * 28 * t)
    ph = 2 * np.pi * np.cumsum(2650 * trill) / SR
    y = np.sin(ph) * (0.75 + 0.25 * np.sin(2 * np.pi * 28 * t))
    y += _nz(n, rng, lambda ff: bp_mag(ff, 2000, 5000, 1)) * 0.15
    env = _attack(t, 0.01) * _release(t, length, 0.02)
    return _fade_tail(y * env * vel * 0.12)


def sleigh(vel, rng, length=0.12):
    """Бубенцы: много крошечных металлических ударов за одно встряхивание."""
    n = int((length + 0.35) * SR)
    t = _t(n)
    y = np.zeros(n)
    hits = rng.integers(6, 12)
    for _ in range(hits):
        d = rng.uniform(0, length)
        j = int(d * SR)
        m = n - j
        tt = t[:m]
        g = np.zeros(m)
        for _k in range(4):
            fr = rng.uniform(3800, 8500)
            g += np.sin(2 * np.pi * fr * tt + rng.uniform(0, 6.28)) * np.exp(-tt / rng.uniform(0.02, 0.09))
        y[j:] += g * rng.uniform(0.3, 1.0)
    y += _nz(n, rng, lambda ff: bp_mag(ff, 5000, 11000, 1)) * np.exp(-t / 0.06) * 0.3
    return _fade_tail(y * vel * 0.06)


def whoosh(length, rng, up=True):
    """Шорох нарастающий (для расширения): шум, полоса которого плывёт вверх."""
    n = int(length * SR)
    t = _t(n)
    x = t / length
    lo = shaped_noise(n, rng, lambda ff: bp_mag(ff, 300, 1500, 1))
    hi = shaped_noise(n, rng, lambda ff: bp_mag(ff, 2000, 8000, 1))
    mix = x if up else 1 - x
    env = np.sin(np.pi * x) ** 2
    return (lo * (1 - mix) + hi * mix) * env * 0.12


def box_pop(vel, rng):
    """«Чпок» картонной коробки: глухой короткий удар + шорох."""
    n = int(0.25 * SR)
    t = _t(n)
    fi = 160 + 220 * np.exp(-t / 0.01)
    y = np.sin(2 * np.pi * np.cumsum(fi) / SR) * np.exp(-t / 0.04)
    y += _nz(n, rng, lambda ff: bp_mag(ff, 400, 3000, 1)) * np.exp(-t / 0.03) * 0.5
    return _fade_tail(y * _attack(t, 0.001) * vel * 0.6)
