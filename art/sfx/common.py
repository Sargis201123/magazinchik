"""Общее для звуков: громкость «в телефоне», подрезка и плавные края, копии синтезированных звуков игры.

Послушать нельзя — меряем. Громкость короткого звука — самое громкое окно 100 мс после модели динамика
телефона (срез ниже ~300 Гц, завал выше 9 кГц, подъём около 2.5 кГц) и K-взвешивания BS.1770: так
мерить честнее, чем по пику, — звонкий щелчок и мягкий шорох с одним пиком звучат очень по-разному.
"""

import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "music"))

import dsp  # noqa: E402

SR = dsp.SR


def phone(x):
    """Модель динамика телефона (как в art/music/checks.py, чуть мягче снизу)."""
    return dsp.filt(x, lambda f: dsp.hp_mag(f, 300, 2) * dsp.lp_mag(f, 9000, 2) * dsp.peak_mag(f, 2500, 3, 1.5))


def loud(x, win=0.1):
    """Громкость короткого звука в телефоне, дБ: самое громкое окно win (K-взвешенная мощность)."""
    y = dsp.k_weight(phone(np.asarray(x, dtype=float)))
    n = max(1, min(len(y), int(win * SR)))
    c = np.concatenate([[0.0], np.cumsum(y * y)])
    p = (c[n:] - c[:-n]) / n
    return float(-0.691 + 10 * np.log10(p.max() + 1e-15))


def energy(x):
    """Вся энергия звука в телефоне, дБ (K-взвешенная, как loud, но сумма за всю длину, а не одно окно).
    При том же самом громком окне длинный звук «тяжелее»: касса со звонком и ящиком на каждой покупке
    утомляет больше короткой монетки — loud этого не видит."""
    y = dsp.k_weight(phone(np.asarray(x, dtype=float)))
    return float(-0.691 + 10 * np.log10(np.sum(y * y) / SR + 1e-15))


def low_share(x, cut=150):
    """Доля энергии ниже cut Гц, дБ относительно всей (телефон её не сыграет, а запас громкости она съедает)."""
    X = np.abs(np.fft.rfft(x)) ** 2
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return float(10 * np.log10(X[f < cut].sum() / (X.sum() + 1e-20) + 1e-12))


def hp(x, fc=150, order=2):
    return dsp.filt(x, lambda f: dsp.hp_mag(f, fc, order))


def lp(x, fc, order=2):
    return dsp.filt(x, lambda f: dsp.lp_mag(f, fc, order))


def bp(x, lo, hi, order=2):
    return dsp.filt(x, lambda f: dsp.bp_mag(f, lo, hi, order))


def onset(x, rel=0.08):
    """Начало звука: первый отсчёт выше rel от пика."""
    a = np.abs(x)
    return int(np.argmax(a > a.max() * rel))


def cut(x, start, dur, pre=0.004, fade_out=None):
    """Кусок [start, start+dur] (секунды) с плавным входом pre и выходом (по умолчанию — треть длины)."""
    a = max(0, int((start - pre) * SR))
    b = min(len(x), int((start + dur) * SR))
    y = x[a:b].copy()
    fi = max(1, int(pre * SR))
    y[:fi] *= np.sin(np.linspace(0, np.pi / 2, fi)) ** 2
    fo = max(1, int((fade_out if fade_out is not None else dur / 3) * SR))
    fo = min(fo, len(y))
    y[-fo:] *= np.cos(np.linspace(0, np.pi / 2, fo)) ** 2
    return y


def tail_trim(x, floor_db=-55.0, fade=0.02):
    """Обрезать тихий хвост (ниже floor_db от пика) и закончить плавно — без щелчка и без лишних байт."""
    a = np.abs(x)
    thr = a.max() * 10 ** (floor_db / 20)
    idx = np.where(a > thr)[0]
    end = int(idx[-1]) + 1 if len(idx) else len(x)
    y = x[: min(len(x), end + int(fade * SR))].copy()
    fo = min(len(y), int(fade * SR))
    if fo > 1:
        y[-fo:] *= np.cos(np.linspace(0, np.pi / 2, fo)) ** 2
    return y


def gate(x, floor_db=-42.0, win=0.006):
    """Мягкий шумовой гейт: шипение записи между событиями уходит, сами события не трогаем."""
    n = max(1, int(win * SR))
    env = np.sqrt(np.convolve(x * x, np.ones(n) / n, mode="same"))
    thr = np.abs(x).max() * 10 ** (floor_db / 20)
    g = np.clip((env - thr * 0.5) / (thr * 0.5 + 1e-12), 0, 1)
    g = np.convolve(g, np.ones(n * 2) / (n * 2), mode="same")
    return x * g


def resample(x, rate):
    """Высота × rate (и длина / rate) — как playbackRate: через FFT-интерполяцию."""
    if abs(rate - 1) < 1e-6:
        return x.copy()
    n = len(x)
    m = max(1, int(round(n / rate)))
    t = np.arange(m) * rate
    return np.interp(t, np.arange(n), x)


def peak_norm(x, db=-1.0):
    return x * (10 ** (db / 20) / (np.abs(x).max() + 1e-12))


# ---------------------------------------------------------------- копии синтезированных звуков игры
# Те же рецепты, что в src/platform/sound.ts (и колокольчик из ambience.ts), — чтобы записанный звук
# звучал не громче и не тише того, что он заменяет.

def _osc(wave, freq, n):
    ph = 2 * np.pi * np.cumsum(freq) / SR
    if wave == "sine":
        return np.sin(ph)
    out = np.zeros(n)
    f0 = float(np.max(freq))
    for k in range(1, int(20000 / f0) + 1):
        if wave == "triangle" and k % 2:
            out += (8 / np.pi ** 2) * ((-1) ** ((k - 1) // 2)) * np.sin(k * ph) / k ** 2
        elif wave == "square" and k % 2:
            out += (4 / np.pi) * np.sin(k * ph) / k
        elif wave == "sawtooth":
            out += (2 / np.pi) * ((-1) ** (k + 1)) * np.sin(k * ph) / k
    return out


def _biquad_lp(x, fc, q):
    return dsp.filt(x, lambda f: 1 / np.sqrt((1 - (f / fc) ** 2) ** 2 + (f / (fc * q)) ** 2))


def synth_play(notes, lp_hz=4200, total=None):
    """play() из sound.ts: ноты {freq, at, dur, wave, vol, slide, attack} → фильтр Q 0.5."""
    end = max(n.get("at", 0) + n["dur"] for n in notes) + 0.05
    N = int((total or end) * SR)
    out = np.zeros(N)
    for n in notes:
        at, dur = n.get("at", 0), n["dur"]
        m = int(dur * SR)
        t = np.arange(m) / SR
        f1 = n.get("slide")
        freq = n["freq"] * (f1 / n["freq"]) ** (t / dur) if f1 else np.full(m, float(n["freq"]))
        att = n.get("attack", 0.008)
        vol = n.get("vol", 0.05)
        env = np.where(t < att, vol * t / att, vol * (0.0001 / vol) ** ((t - att) / max(dur - att, 1e-4)))
        s = int(at * SR)
        out[s:s + m] += _osc(n.get("wave", "triangle"), freq, m) * env
    return _biquad_lp(out, lp_hz, 0.5)


def synth_ring(strikes, partials, lp_hz=7000):
    """ring() из sound.ts: удары {freq, at, vol, ring} по негармоническим призвукам."""
    end = max(s.get("at", 0) + s["ring"] for s in strikes) + 0.05
    out = np.zeros(int(end * SR))
    for s in strikes:
        for ratio, level, decay in partials:
            f = s["freq"] * ratio
            if f > 16000:
                continue
            d = s["ring"] * decay
            m = int(d * SR)
            t = np.arange(m) / SR
            v = s["vol"] * level
            env = np.where(t < 0.003, v * t / 0.003, v * (0.0001 / v) ** ((t - 0.003) / max(d - 0.003, 1e-4)))
            a = int(s.get("at", 0) * SR)
            out[a:a + m] += np.sin(2 * np.pi * f * t) * env
    return dsp.filt(out, lambda f: dsp.lp_mag(f, lp_hz, 2))


BELL = [[1, 1, 1], [2.76, 0.45, 0.55], [5.4, 0.22, 0.32], [8.93, 0.1, 0.2]]
COIN = [[1, 1, 1], [2.32, 0.6, 0.6], [3.81, 0.32, 0.4], [5.12, 0.15, 0.25]]


def reference_sounds():
    """Синтезированные звуки игры, которые заменяют записи (сигналы)."""
    return {
        "tap": synth_play([dict(freq=660, dur=0.05, vol=0.035, slide=540)], 2400),
        "scan": synth_play([dict(freq=1175, dur=0.09, wave="sine", vol=0.03, attack=0.006),
                            dict(freq=2350, dur=0.06, wave="sine", vol=0.006, attack=0.006)], 3500),
        "coin": synth_ring([dict(freq=1397, vol=0.028, ring=0.16), dict(freq=1397 * 1.335, at=0.065, vol=0.024, ring=0.32)], COIN, 6000),
        "pop": synth_play([dict(freq=740, dur=0.06, wave="sine", vol=0.045, slide=1090, attack=0.004)]),
        "bell": synth_ring([dict(freq=1175, vol=0.035, ring=1), dict(freq=880, at=0.18, vol=0.035, ring=1.3)], BELL),
        "meow": synth_play([dict(freq=620, dur=0.12, vol=0.04, slide=900, attack=0.02),
                            dict(freq=900, at=0.12, dur=0.23, vol=0.036, slide=520)], 2600),
        "bark": synth_play([dict(freq=340, dur=0.09, wave="sawtooth", vol=0.045, slide=220),
                            dict(freq=360, at=0.17, dur=0.1, wave="sawtooth", vol=0.045, slide=230)], 1400),
        "voice": synth_play([dict(freq=560, dur=0.05, wave="square", vol=0.03, attack=0.006)], 1750),
        # Колокольчик над дверью (ambience.ts, chime) — канал «зал».
        "chime": synth_ring([dict(freq=2093, vol=0.022, ring=0.7), dict(freq=2637, at=0.075, vol=0.022, ring=0.7)],
                            [[1, 1, 1], [2.76, 0.35, 0.43], [5.4, 0.12, 0.21]], 16000),
    }


def references():
    """Громкость (loud) синтезированных звуков игры: на неё равняются записанные."""
    return {k: loud(v) for k, v in reference_sounds().items()}
