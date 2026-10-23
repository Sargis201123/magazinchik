"""Проверки качества (раз послушать нельзя — меряем): клиппинг и true-peak, громкость LUFS,
постоянная составляющая, тишина внутри пьес, баланс по октавам («муть»), моно-совместимость,
швы петель после декодирования, точность длины (задержка кодека)."""

import numpy as np

import dsp
from dsp import SR

USE = {
    "morning": "Утро: открытие магазина, первые часы дня",
    "day": "День: основной фон торговли",
    "evening": "Вечер: закат, последние покупатели, итоги",
    "night": "Ночная смена: тихий фон ночью",
    "winter": "Зима и Новый год: сезонный фон (вместо дня/вечера в декабре–январе)",
    "radio_retro": "Радио «Ретро»: медленный свинг, крутится по кругу",
    "radio_hits": "Радио «Хиты»: бодрый поп-бит, по кругу (марафон)",
    "radio_samba": "Радио «Самба»: карнавал, по кругу (особый день — карнавал)",
    "radio_march": "Радио «Марш»: духовой оркестр на параде, по кругу (парады)",
    "sting_day_open": "Открытие дня: колокольчик двери и мотив",
    "sting_day_close": "Закрытие дня / итоги",
    "sting_record": "Новый рекорд",
    "sting_rank_up": "Новое звание / повышение",
    "sting_purchase": "Покупка оборудования / распаковка",
    "sting_story": "Сюжетный момент (начало диалога, поворот)",
    "sting_expand": "Расширение магазина",
    "sting_fail": "Мягкая неудача (банкротство-предупреждение, проваленная цель)",
    "sting_coin": "Монетка (крупная выручка, награда)",
}

# Стемы мелодии (для «мелодия над аккомпанементом в телефоне») и баса/бочки.
MELODY = {"morning": ["flute"], "day": ["vibes"], "evening": ["epmel", "flugel"], "night": ["epmel", "celesta"],
          "winter": ["celesta", "strmel"], "radio_retro": ["clarinet", "vibes"], "radio_hits": ["lead"],
          "radio_samba": ["brass", "flute"], "radio_march": ["brass", "hornmel"]}
LOWEND = ("upright", "ebass", "tuba", "kick", "bdrum", "surdo")


def phone(x):
    """Модель динамика телефона: крутой срез ниже ~350 Гц, мягкий завал выше 10 кГц, подъём 2.5 кГц."""
    return dsp.filt(x, lambda f: dsp.hp_mag(f, 350, 4) * dsp.lp_mag(f, 10000, 2) * dsp.peak_mag(f, 2500, 3, 1.5))


def _blocks(x, win=0.4, hop=0.1):
    y = dsp.k_weight(x)
    z = dsp._block_powers(y, int(win * SR), int(hop * SR))
    return -0.691 + 10 * np.log10(z + 1e-15)


def phone_report(song, r):
    """Уровни баса/бочки и мелодии относительно смеси — в полном диапазоне и «в телефоне» (LU)."""
    if song.id.startswith("sting"):
        return {}
    mix = r.premaster
    circ = bool(r.loop)
    pm = phone(mix)
    Lm, Pm = dsp.loudness(mix, circular=circ), dsp.loudness(pm)
    out = {}
    for name, x in r.stem_audio.items():
        if name in LOWEND:
            out[name] = {"full": round(dsp.loudness(x, circular=circ) - Lm, 1),
                         "phone": round(dsp.loudness(phone(x)) - Pm, 1)}
    mel = [m for m in MELODY.get(song.id, []) if m in r.stem_audio]
    if mel:
        mx = sum(r.stem_audio[m] for m in mel)
        acc = mix - mx
        bm, ba = _blocks(phone(mx)), _blocks(phone(acc))
        on = bm > np.percentile(bm, 50)
        out["melodyOverAccPhone"] = round(float(np.median(bm[on] - ba[on])), 1)
    return out


def third_octaves(x):
    """Энергия по третьоктавам (дБ от общей) — для «присутствия»: 2 кГц против 630/800 Гц."""
    m = x.mean(axis=0) if x.ndim == 2 else x
    N = dsp.fast_len(len(m))
    P = np.abs(np.fft.rfft(m, N)) ** 2
    f = np.fft.rfftfreq(N, 1.0 / SR)
    tot = P.sum() + 1e-20
    res = {}
    for c in (630, 800, 2000, 2500, 3150):
        sel = (f >= c / 2 ** (1 / 6)) & (f < c * 2 ** (1 / 6))
        res[c] = 10 * np.log10(P[sel].sum() / tot + 1e-20)
    return res


def silence_runs(x, thresh_db=-60.0, frame=0.05):
    m = np.abs(x).max(axis=0)
    hop = int(frame * SR)
    k = len(m) // hop
    fr = m[: k * hop].reshape(k, hop)
    rms = np.sqrt(np.mean(fr ** 2, axis=1))
    loud = dsp.todb(rms) > thresh_db
    idx = np.where(loud)[0]
    if len(idx) == 0:
        return 0.0
    inner = ~loud[idx[0]: idx[-1] + 1]
    best = cur = 0
    for v in inner:
        cur = cur + 1 if v else 0
        best = max(best, cur)
    return best * frame


def balance(x):
    """Баланс по октавам и флаги. «Жёстко» — когда 2–4 кГц почти догоняют «тело» 250–500 Гц
    (мелодия на 1 кГц — это не жёсткость); «глухо» — когда 2 кГц тише 700 Гц больше чем на 16 дБ."""
    ob = dsp.octave_bands(x)
    low = 10 * np.log10(10 ** (ob[63] / 10) + 10 ** (ob[125] / 10))
    lowmid = 10 * np.log10(10 ** (ob[250] / 10) + 10 ** (ob[500] / 10))
    mid = 10 * np.log10(10 ** (ob[1000] / 10) + 10 ** (ob[2000] / 10))
    upper = 10 * np.log10(10 ** (ob[2000] / 10) + 10 ** (ob[4000] / 10))
    hi = 10 * np.log10(10 ** (ob[4000] / 10) + 10 ** (ob[8000] / 10))
    to = third_octaves(x)
    pres = to[2000] - 10 * np.log10((10 ** (to[630] / 10) + 10 ** (to[800] / 10)) / 2)
    flags = []
    if lowmid - mid > 15:
        flags.append("муть: 250–500 Гц сильно выше 1–2 кГц")
    if upper - lowmid > -3:
        flags.append("жёстко: 2–4 кГц почти как 250–500 Гц")
    if low - lowmid > 6:
        flags.append("гудит: слишком много низа")
    if pres < -16:
        flags.append("глухо: 2 кГц на 16+ дБ тише 700 Гц")
    return {"octaves_db": {str(k): round(v, 1) for k, v in ob.items()},
            "low_vs_lowmid": round(low - lowmid, 1), "lowmid_vs_mid": round(lowmid - mid, 1),
            "upper_vs_lowmid": round(upper - lowmid, 1), "mid_vs_high": round(mid - hi, 1), "flags": flags}


def mono_check(x):
    L, R = x
    corr = float(np.sum(L * R) / (np.sqrt(np.sum(L * L) * np.sum(R * R)) + 1e-12))
    mono = 0.5 * (L + R)
    drop = dsp.loudness(np.stack([mono, mono])) - dsp.loudness(x)
    return round(corr, 3), round(drop, 2)


def describe(song, x, kind, rep):
    circ = kind == "loop"
    lu = dsp.loudness(x, circular=circ)
    tp = dsp.true_peak(x, circular=circ)
    e = {
        "kind": kind,
        "title": song.meta.get("title", song.id),
        "use": USE.get(song.id) or USE.get(song.id.rsplit("_", 1)[0], ""),
        "key": song.meta.get("key"),
        "bpm": song.bpm,
        "meter": f"{song.meter}/4",
        "duration": round(x.shape[1] / SR, 3),
        "samples": int(x.shape[1]),
        "fileSamples": int(x.shape[1]),
        "lufs": round(lu, 2),
        "truePeakDb": round(float(dsp.todb(tp)), 2),
        "dc": [round(float(v), 6) for v in x.mean(axis=1)],
    }
    if kind == "music":
        e["silenceAfter"] = [30, 90]
        e["fadeIn"] = song.fade_in
        e["lra"] = round(dsp.lra(x), 1)
    if kind == "sting":
        e["shortTermMaxLufs"] = round(dsp.short_term_max(x), 2)
        e["momentaryMaxLufs"] = round(dsp.momentary_max(x), 2)
    to = third_octaves(x)
    ref = 10 * np.log10((10 ** (to[630] / 10) + 10 ** (to[800] / 10)) / 2)
    bal = balance(x)
    if kind == "sting":
        bal["flags"] = []  # спектральные флаги — для смесей; у «динь» монетки другой спектр по природе
    e["checks"] = {
        "longestInnerSilence": round(silence_runs(x), 2),
        "balance": bal,
        "balanceTrimDb": rep.get("balance_trim_db"),
        "presence2kVs700Db": round(to[2000] - ref, 1),
        "lrDb": round(float(10 * np.log10(np.mean(x[0] ** 2) / (np.mean(x[1] ** 2) + 1e-20))), 2),
        "mono": dict(zip(("corr", "monoLoudnessDelta"), mono_check(x))),
        "harmonyIssues": len(rep.get("harmony_issues", [])),
        "harmonyPassingTones": rep.get("harmony_passing", 0),
        "semitoneRoughnessPct": rep.get("roughness", {}).get("semitonePct"),
        "limiterMaxGrDb": rep.get("limiter_gr_max_db"),
        "compMaxGrDb": rep.get("comp_gr_max_db"),
    }
    return e


def seam_report(d, s, e, bar):
    """Шов петли после декодирования.

    В файле за концом петли лежит её же начало (0.5 с «по кругу»), и кодек прошёл этот переход
    непрерывно — это эталон. WebAudio играет конец петли и сразу её начало: сравниваем этот
    стык с эталоном. diffDb — разница (шум кодека) относительно сигнала в ±50 мс; spike —
    пик разницы у самого стыка (±2 мс) против её RMS в окне: щелчок дал бы ≫ 6.
    """
    m = d.mean(axis=0)
    W = int(0.05 * SR)
    played = np.concatenate([m[e - W: e], m[s: s + W]])
    natural = m[e - W: e + W]
    diff = played - natural
    rms_d = np.sqrt(np.mean(diff ** 2)) + 1e-12
    rms_s = np.sqrt(np.mean(natural ** 2)) + 1e-12
    k = int(0.002 * SR)
    spike = np.abs(diff[W - k: W + k]).max() / rms_d
    return {"diffDb": round(float(20 * np.log10(rms_d / rms_s)), 1), "spike": round(float(spike), 2)}


def codec_snr(ref, d):
    """ОСШ кодека по полосам (дБ): исходник против декодированного (начала совпадают)."""
    n = min(ref.shape[1], d.shape[1])
    r, y = ref[:, :n], d[:, :n]
    g = np.sum(r * y) / (np.sum(y * y) + 1e-20)
    e = r - g * y
    out = {}
    for lo, hi in ((250, 1000), (1000, 2500), (2500, 5000)):
        def band(z, lo=lo, hi=hi):
            return dsp.filt(z, lambda f: ((f >= lo) & (f < hi)).astype(float))
        out[f"{lo}-{hi}"] = round(float(10 * np.log10(np.sum(band(r) ** 2) / (np.sum(band(e) ** 2) + 1e-20))), 1)
    return out


def decoded_report(d, entry, kind, ref=None):
    exp = entry["fileSamples"]
    r = {
        "samples": int(d.shape[1]),
        "lengthDeltaMs": round((d.shape[1] - exp) / SR * 1000, 1),
        "lufs": round(dsp.loudness(d), 2),
        "truePeakDb": round(float(dsp.todb(dsp.true_peak(d))), 2),
        "clippedSamples": int(np.sum(np.abs(d) >= 0.9999)),
        "dc": [round(float(v), 6) for v in d.mean(axis=1)],
    }
    if ref is not None:
        r["snrDb"] = codec_snr(ref, d)
    if kind == "loop":
        s, e = entry["loopStartSample"], entry["loopEndSample"]
        bar = int(entry["meter"][0]) * 60.0 / entry["bpm"] * SR
        r["seam"] = seam_report(d, s, e, bar)
        r["seamXf"] = seam_crossfaded(d, s, e)
        r["loopLufs"] = round(dsp.loudness(d[:, s:e], circular=True), 2)
    return r


def seam_crossfaded(d, s, e, k=240):
    """Шов после рекомендованного плеером кроссфейда (5 мс): скачок на стыке против
    наибольшего естественного шага рядом (без щелчка — не больше)."""
    y = d.copy()
    i = np.arange(k) / k
    y[:, e - k: e] = y[:, e - k: e] * (1 - i) + y[:, s - k: s] * i
    seq = np.concatenate([y[:, e - 480: e], y[:, s: s + 480]], axis=1)
    nat = d[:, e - 480: e + 480]
    jump = float(np.abs(np.diff(seq, axis=1))[:, 479].max())
    nat_max = float(np.abs(np.diff(nat, axis=1)).max())
    raw = np.concatenate([d[:, e - 480: e], d[:, s: s + 480]], axis=1)
    return {"jump": round(jump, 4), "rawJump": round(float(np.abs(np.diff(raw, axis=1))[:, 479].max()), 4),
            "naturalMaxStep": round(nat_max, 4)}


def summary_line(key, e, rep):
    dec = e.get("decoded", {})
    parts = [f"{key:18s} {e['duration']:6.1f}s  {e['lufs']:6.2f} LUFS  TP {e['truePeakDb']:5.2f}"]
    if "shortTermMaxLufs" in e:
        parts.append(f"ST {e['shortTermMaxLufs']:.1f}")
    c = e["checks"]
    parts.append(f"лим {c['limiterMaxGrDb']} дБ, комп {c['compMaxGrDb']} дБ")
    parts.append(f"гарм {c['harmonyIssues']}/{c['harmonyPassingTones']} шерох {c['semitoneRoughnessPct']}%")
    parts.append(f"2к/700 {c['presence2kVs700Db']} L/R {c['lrDb']}")
    ph = e.get("phone") or {}
    if ph:
        parts.append("тел " + " ".join(f"{k}:{v['phone'] if isinstance(v, dict) else v}" for k, v in ph.items()))
    parts.append(f"моно {c['mono']['corr']}/{c['mono']['monoLoudnessDelta']}")
    parts.append(f"баланс {c['balance']['low_vs_lowmid']}/{c['balance']['lowmid_vs_mid']}/{c['balance']['mid_vs_high']}")
    if c["balance"]["flags"]:
        parts.append("!" + ";".join(c["balance"]["flags"]))
    if c["longestInnerSilence"] > 1.5:
        parts.append(f"!тишина {c['longestInnerSilence']}с")
    for ext, d in dec.items():
        s = f"{ext}: {e['bytes'][ext] // 1024}К TP {d['truePeakDb']} {d['lufs']}LU Δ{d['lengthDeltaMs']}мс"
        if "snrDb" in d:
            s += " ОСШ " + "/".join(str(v) for v in d["snrDb"].values())
        if "seam" in d:
            sm = d["seam"]
            s += f" шов {sm['diffDb']}дБ/пик {sm['spike']} скачок {d['seamXf']['rawJump']}→{d['seamXf']['jump']}" \
                 f" (ест. {d['seamXf']['naturalMaxStep']})"
        parts.append(s)
    return " | ".join(parts)


def manifest_entry(key, e):
    """Краткая запись для игры (полный отчёт — art/music/report.json)."""
    m = {
        "kind": e["kind"],
        "title": e["title"],
        "use": e["use"],
        "files": e.get("files"),
        "duration": e.get("fileDuration", e["duration"]),
        "lufs": e["lufs"],
        "truePeakDb": max([e["truePeakDb"]] + [d["truePeakDb"] for d in e.get("decoded", {}).values()]),
        "bpm": e["bpm"],
        "key": e["key"],
        "meter": e["meter"],
        "bytes": e.get("bytes"),
    }
    if e["kind"] == "music":
        m["silenceAfter"] = e["silenceAfter"]
        m["fadeIn"] = e["fadeIn"]
    if e["kind"] == "loop":
        for k in ("loopStart", "loopEnd", "loopStartSample", "loopEndSample"):
            m[k] = e[k]
        m["loopDuration"] = e["duration"]
    if e.get("keySections"):
        m["keySections"] = e["keySections"]
    if e["kind"] == "sting":
        m["shortTermMaxLufs"] = e["shortTermMaxLufs"]
        if e.get("baseKey"):
            m["baseKey"], m["transpose"] = e["baseKey"], e["transpose"]
    return m
