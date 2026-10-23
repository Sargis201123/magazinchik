"""Голоса героев: банк «русских» слогов для бормотания в диалогах (как в Animal Crossing).

Слог = согласный + гласный: 13 начал (без согласного, м, н, л, р, б, д, п, т, к, в, с, ш) × 6 гласных
(а, о, у, э, и, ы). Два голоса — низкий (мужской, ~118 Гц) и высокий (женский, ~210 Гц); в игре
каждый герой — один из них со своей скоростью воспроизведения (бабушка — высокий, но медленнее и ниже;
Соня — высокий и быстрее, это уже детский голос), а интонация фразы — сдвигом высоты слога.

Синтез формантный, как речь: гармоники основного тона, каждая — через резонансы горла и рта
(форманты гласного), согласные — переходы формант от «места» согласного к гласному, носовой гул,
взрыв и придыхание у п/т/к, шипение у с/ш. Полосы формант шире, чем у живой речи, а верх
мягче: голос тёплый и неразборчивый, а не робот и не «бормотание из-за стены».
"""

import numpy as np

from common import SR, hp, lp
from synth import harmonics, resonances, shaped_noise, smooth

ONSETS = ["", "m", "n", "l", "r", "b", "d", "p", "t", "k", "v", "s", "sh"]
VOWELS = ["a", "o", "u", "e", "i", "y"]

# Форманты русских гласных у мужского голоса (Гц): F1–F4.
VOWEL_F = {
    "a": (700, 1220, 2500, 3400),
    "o": (520, 880, 2450, 3300),
    "u": (330, 720, 2300, 3200),
    "e": (520, 1750, 2500, 3400),
    "i": (290, 2200, 2950, 3600),
    "y": (330, 1500, 2400, 3300),
}

# «Место» согласного: откуда к гласному идёт вторая форманта (у к — смотря по гласному).
LOCUS_F2 = {"m": 1000, "n": 1600, "l": 1100, "r": 1300, "b": 800, "p": 800, "d": 1700, "t": 1750, "v": 1100, "s": 1700, "sh": 1800}

VOICES = {
    # Низкий: тёплый мужской. Высокий: мягкий женский с лёгким придыханием.
    "low": dict(f0=118.0, scale=1.0, B=(95, 115, 180, 260), knee=600, tilt=-9.5, breath=0.025, hp=135),
    "high": dict(f0=212.0, scale=1.16, B=(105, 125, 190, 270), knee=800, tilt=-11.0, breath=0.05, hp=160),
}

TIMING = {
    "": (0.0, 0.0),
    "m": (0.045, 0.0), "n": (0.045, 0.0), "l": (0.04, 0.0), "r": (0.05, 0.0), "v": (0.04, 0.0),
    "b": (0.018, 0.0), "d": (0.018, 0.0),
    # Глухие: смычка (тишина) и придыхание после взрыва.
    "p": (0.022, 0.012), "t": (0.022, 0.014), "k": (0.024, 0.018),
    "s": (0.05, 0.0), "sh": (0.05, 0.0),
}

VOWEL_DUR = 0.075  # переход и сам гласный
RELEASE = 0.03


def syllable(voice, onset, vowel, seed):
    v = VOICES[voice]
    rng = np.random.default_rng(seed)
    sc = v["scale"]
    closure, vot = TIMING[onset]
    t_rel = closure  # момент «раскрытия» согласного
    total = t_rel + vot + VOWEL_DUR + RELEASE + 0.01
    n = int(total * SR)
    t = np.arange(n) / SR

    target = np.array(VOWEL_F[vowel], dtype=float) * sc
    if vowel in ("i", "y", "u"):
        target[0] = VOWEL_F[vowel][0] * (1 + (sc - 1) * 0.6)
    front = vowel in ("i", "e")
    locus2 = (2300 if front else 1350) if onset == "k" else LOCUS_F2.get(onset, target[1] / sc)
    locus = np.array([260.0, locus2, 2500.0 if onset != "r" else 1750.0, target[3] / sc]) * sc
    if onset == "":
        locus = target.copy()

    # Форманты: от места согласного к гласному за 35–45 мс после раскрытия, плавно.
    tr = 0.04 if onset in ("m", "n", "l", "r", "v") else 0.035
    k = np.clip((t - t_rel - vot * 0.5) / tr, 0, 1)
    k = k * k * (3 - 2 * k)
    F = locus[None, :] + (target - locus)[None, :] * k[:, None]
    B = np.tile(np.array(v["B"], dtype=float), (n, 1))
    # В носовом и боковом гуле верхние форманты слабые (широкие), первая — низкая.
    if onset in ("m", "n", "l", "b", "d"):
        murmur = 1 - k
        widen = {"m": 900, "n": 800, "l": 300, "b": 1400, "d": 1400}[onset]
        B[:, 1] += widen * murmur
        B[:, 2] += widen * 1.2 * murmur
        B[:, 3] += widen * 1.5 * murmur

    # Тон: чуть вверх в середине и вниз к концу слога, живая неровность.
    vow = np.clip((t - t_rel - vot) / (VOWEL_DUR + RELEASE), 0, 1)
    f0 = v["f0"] * (1 + 0.035 * np.sin(np.pi * np.clip(vow * 1.2, 0, 1)) - 0.04 * vow ** 2)
    f0 *= 1 + 0.004 * smooth(rng.standard_normal(n), 4)

    # Громкость голоса по участкам.
    amp = np.zeros(n)
    rise = np.clip((t - t_rel - vot) / 0.012, 0, 1)
    fall = np.clip((total - 0.01 - t) / RELEASE, 0, 1)
    vowel_amp = np.sin(rise * np.pi / 2) ** 2 * np.sin(fall * np.pi / 2) ** 1.5
    if onset in ("m", "n", "l", "r", "v"):
        on = np.clip(t / 0.012, 0, 1)
        lvl = {"m": 0.42, "n": 0.42, "l": 0.5, "r": 0.5, "v": 0.3}[onset]
        amp = np.where(t < t_rel, lvl * on, 0) + np.where(t >= t_rel, np.maximum(vowel_amp, lvl * (1 - np.clip((t - t_rel) / 0.012, 0, 1))), 0)
        amp = np.maximum(amp, vowel_amp)
        if onset == "r":
            # Раскат: два удара языка — громкость дважды проваливается.
            for c in (0.012, 0.032):
                amp *= 1 - 0.75 * np.exp(-0.5 * ((t - c) / 0.004) ** 2)
    elif onset in ("b", "d"):
        bar = 0.16 * np.clip(t / 0.006, 0, 1) * (t < t_rel)
        amp = np.maximum(bar, vowel_amp)
    elif onset == "":
        amp = vowel_amp * np.clip(t / 0.02, 0, 1)
    else:
        amp = vowel_amp
    amp = smooth(amp, 1.5)

    voiced = harmonics(f0, amp, F, B, knee=v["knee"], db_oct=v["tilt"], fmax=6500, rng=rng, shimmer=0.03)
    out = voiced / (np.abs(voiced).max() + 1e-9)

    # Придыхание по формантам гласного (у женского голоса заметнее) — мягкость, а не шипение.
    breath = shaped_noise(n, lambda tc, fr: resonances(fr, F[min(n - 1, int(tc * SR))], B[min(n - 1, int(tc * SR))]) * (fr > 600), rng)
    out += v["breath"] * breath / (np.abs(breath).max() + 1e-9) * amp

    def noise_band(lo, hi, env):
        z = shaped_noise(n, lambda tc, fr: np.exp(-0.5 * (np.log2(np.maximum(fr, 1) / np.sqrt(lo * hi)) / (np.log2(hi / lo) / 2.2)) ** 2), rng)
        return z / (np.abs(z).max() + 1e-9) * env

    if onset in ("b", "d", "p", "t", "k"):
        # Взрыв: короткий щелчок шума с краской места (б/п — низкий, д/т — высокий, к — по гласному).
        lo, hi = {"b": (500, 1800), "p": (500, 1800), "d": (2500, 5500), "t": (2800, 6000), "k": (1500 if front else 1000, 3200 if front else 2200)}[onset]
        env = np.exp(-np.maximum(t - t_rel, 0) / 0.004) * (t >= t_rel) * np.clip((t - t_rel) / 0.001, 0, 1)
        out += 0.35 * noise_band(lo * sc, hi * sc, env)
    if vot:
        # Придыхание: шум через форманты, пока не заработал голос.
        env = ((t >= t_rel) & (t < t_rel + vot + 0.006)) * np.exp(-np.maximum(t - t_rel, 0) / 0.02)
        asp = shaped_noise(n, lambda tc, fr: resonances(fr, F[min(n - 1, int(tc * SR))], B[min(n - 1, int(tc * SR))]), rng)
        out += 0.12 * asp / (np.abs(asp).max() + 1e-9) * smooth(env.astype(float), 2)
    if onset in ("s", "sh", "v"):
        lo, hi = {"s": (3800, 7000), "sh": (1900, 4200), "v": (1000, 3000)}[onset]
        lvl = {"s": 0.12, "sh": 0.16, "v": 0.06}[onset]
        env = np.clip(t / 0.015, 0, 1) * np.clip((t_rel + 0.012 - t) / 0.02, 0, 1)
        out += lvl * noise_band(lo, hi, smooth(env, 3))

    out = lp(hp(out, v["hp"]), 6500)
    fade = int(0.008 * SR)
    out[-fade:] *= np.cos(np.linspace(0, np.pi / 2, fade)) ** 2
    return out


def bank():
    """Все слоги обоих голосов: {(голос, начало, гласный): сигнал}."""
    out = {}
    seed = 1000
    for voice in VOICES:
        for onset in ONSETS:
            for vowel in VOWELS:
                out[(voice, onset, vowel)] = syllable(voice, onset, vowel, seed)
                seed += 1
    return out
