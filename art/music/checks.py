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
    ob = dsp.octave_bands(x)
    low = 10 * np.log10(10 ** (ob[63] / 10) + 10 ** (ob[125] / 10))
    lowmid = 10 * np.log10(10 ** (ob[250] / 10) + 10 ** (ob[500] / 10))
    mid = 10 * np.log10(10 ** (ob[1000] / 10) + 10 ** (ob[2000] / 10))
    hi = 10 * np.log10(10 ** (ob[4000] / 10) + 10 ** (ob[8000] / 10))
    flags = []
    if lowmid - mid > 15:
        flags.append("муть: 250–500 Гц сильно выше 1–2 кГц")
    if lowmid - mid < 2:
        flags.append("жёстко: мало тела, много середины")
    if low - lowmid > 6:
        flags.append("гудит: слишком много низа")
    if mid - hi > 22:
        flags.append("глухо: мало верха")
    return {"octaves_db": {str(k): round(v, 1) for k, v in ob.items()},
            "low_vs_lowmid": round(low - lowmid, 1), "lowmid_vs_mid": round(lowmid - mid, 1),
            "mid_vs_high": round(mid - hi, 1), "flags": flags}


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
        "use": USE.get(song.id, ""),
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
    e["checks"] = {
        "longestInnerSilence": round(silence_runs(x), 2),
        "balance": balance(x),
        "mono": dict(zip(("corr", "monoLoudnessDelta"), mono_check(x))),
        "harmonyIssues": len(rep.get("harmony_issues", [])),
        "harmonyPassingTones": rep.get("harmony_passing", 0),
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


def decoded_report(d, entry, kind):
    exp = entry["fileSamples"]
    r = {
        "samples": int(d.shape[1]),
        "lengthDeltaMs": round((d.shape[1] - exp) / SR * 1000, 1),
        "lufs": round(dsp.loudness(d), 2),
        "truePeakDb": round(float(dsp.todb(dsp.true_peak(d))), 2),
        "clippedSamples": int(np.sum(np.abs(d) >= 0.9999)),
        "dc": [round(float(v), 6) for v in d.mean(axis=1)],
    }
    if kind == "loop":
        s, e = entry["loopStartSample"], entry["loopEndSample"]
        bar = int(entry["meter"][0]) * 60.0 / entry["bpm"] * SR
        r["seam"] = seam_report(d, s, e, bar)
        r["loopLufs"] = round(dsp.loudness(d[:, s:e], circular=True), 2)
    return r


def summary_line(key, e, rep):
    dec = e.get("decoded", {})
    parts = [f"{key:18s} {e['duration']:6.1f}s  {e['lufs']:6.2f} LUFS  TP {e['truePeakDb']:5.2f}"]
    if "shortTermMaxLufs" in e:
        parts.append(f"ST {e['shortTermMaxLufs']:.1f}")
    c = e["checks"]
    parts.append(f"лим {c['limiterMaxGrDb']} дБ, комп {c['compMaxGrDb']} дБ")
    parts.append(f"гарм {c['harmonyIssues']}/{c['harmonyPassingTones']}")
    parts.append(f"моно {c['mono']['corr']}/{c['mono']['monoLoudnessDelta']}")
    parts.append(f"баланс {c['balance']['low_vs_lowmid']}/{c['balance']['lowmid_vs_mid']}/{c['balance']['mid_vs_high']}")
    if c["balance"]["flags"]:
        parts.append("!" + ";".join(c["balance"]["flags"]))
    if c["longestInnerSilence"] > 1.5:
        parts.append(f"!тишина {c['longestInnerSilence']}с")
    for ext, d in dec.items():
        s = f"{ext}: {e['bytes'][ext] // 1024}К TP {d['truePeakDb']} {d['lufs']}LU Δ{d['lengthDeltaMs']}мс"
        if "seam" in d:
            sm = d["seam"]
            s += f" шов {sm['diffDb']}дБ/пик {sm['spike']}"
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
    if e["kind"] == "sting":
        m["shortTermMaxLufs"] = e["shortTermMaxLufs"]
    return m
