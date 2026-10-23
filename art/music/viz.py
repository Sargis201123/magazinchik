"""Спектрограмма в PNG (для проверки «глазами»: ноты, плотность, хвосты, отсутствие мусора)."""

import numpy as np
from PIL import Image

from dsp import SR


def spectrogram_png(x, path, fmax=12000, width=1600, height=400, db_range=80, log_freq=True):
    m = x.mean(axis=0) if x.ndim == 2 else x
    nfft = 4096
    hop = max(256, len(m) // width)
    win = np.hanning(nfft)
    frames = []
    for i in range(0, max(1, len(m) - nfft), hop):
        frames.append(np.abs(np.fft.rfft(m[i: i + nfft] * win)))
    S = np.array(frames).T  # (freq, time)
    f = np.fft.rfftfreq(nfft, 1 / SR)
    if log_freq:
        fy = np.geomspace(40, fmax, height)
    else:
        fy = np.linspace(0, fmax, height)
    idx = np.searchsorted(f, fy).clip(0, len(f) - 1)
    S = S[idx][::-1]
    D = 20 * np.log10(S + 1e-9)
    D = np.clip((D - (D.max() - db_range)) / db_range, 0, 1)
    # «тепловая» палитра
    r = np.clip(D * 2.2, 0, 1)
    g = np.clip(D * 2.2 - 0.8, 0, 1)
    b = np.clip(D * 3 - 2, 0, 1) * 0.8 + np.clip(0.5 - np.abs(D - 0.25) * 2, 0, 1) * 0.6
    img = (np.stack([r, g, b], axis=-1) * 255).astype(np.uint8)
    im = Image.fromarray(img).resize((width, height))
    im.save(path)


def waveform_png(x, path, width=1600, height=200):
    m = np.abs(x).max(axis=0) if x.ndim == 2 else np.abs(x)
    n = len(m)
    step = max(1, n // width)
    k = n // step
    pk = m[: k * step].reshape(k, step).max(axis=1)
    img = np.zeros((height, k, 3), dtype=np.uint8) + 20
    for i, v in enumerate(pk):
        h = int(min(1, v) * (height - 1))
        img[height - 1 - h:, i] = (230, 180, 90)
    Image.fromarray(img).resize((width, height)).save(path)
