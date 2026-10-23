"""Проверка гармонии партитуры с учётом того, сколько нота реально звучит.

Нота звучит не только «по партитуре»: пэд отпускается, колокольчик звенит, струна гаснет.
Поэтому у каждой ноты два конца: конец по партитуре и конец слышимого звука (−20 дБ =
2.3 постоянных времени отпускания или собственного звона; см. engine.ring_seconds).

check_harmony — дискретные ошибки:
  * звук вне аккорда (звучащая часть): как раньше — проходящие ноты мелодии на слабых долях
    и подходы баса допустимы;
  * «хвост» в чужом аккорде: нота отзвучала, но ещё слышна (выше −20 дБ) в следующем аккорде,
    где её нет, дольше RING_GRACE;
  * трение: малая секунда/нона между звуками (оба от C3), если они одновременно слышны —
    звучащими частями дольше 0.3 доли или хвостом дольше RING_GRACE.
RING_GRACE ≈ 0.3 с — нормальное легато живого исполнителя (палец/смычок/демпфер снимается не мгновенно).

roughness — непрерывная мера на сетке 10 мс по модели огибающих (атака, затухание, отпускание),
с учётом громкости дорожек в миксе: доля энергии в парах звуков на полтона (малую нону)
и доля энергии каждой дорожки вне текущего аккорда.
"""

import collections

import numpy as np

import engine
from instruments import midi_hz
from score import name

RING_GRACE = 0.3  # с
LOW = 48  # ниже C3 «трение» не считаем (бас и так раздельно слышен)


def _semi(a, b):
    d = abs(a - b)
    return d % 12 == 1 and d <= 13


def note_spans(song):
    """Для каждой высотной ноты: (нота, начало, конец по партитуре, конец слышимого), в секундах."""
    out = []
    for n in song.notes:
        if n.role == "drum" or n.pitch <= 0 or n.inst not in engine.PITCHED:
            continue
        sw = not n.params.get("noswing", False)
        t0 = song.sec(n.start, sw)
        dur_s = max(0.03, song.sec(n.start + n.dur * n.sound, sw) - t0)
        off, end = engine.ring_seconds(n.inst, n.params, midi_hz(n.pitch), dur_s)
        out.append((n, t0, t0 + off, t0 + end))
    return out


def chord_spans_sec(song):
    return sorted((song.sec(a, False), song.sec(b, False), c, a, b) for a, b, c in song.chords)


RING_KINDS = ("modal", "pad", "ks", "epiano")


def auto_damp(song, target=0.25):
    """«Смена педали»: как живой исполнитель, глушим звенящую ноту, если её хвост попадает
    в аккорд, где её нет, или под ноту на полтона рядом. Отпускание укорачивается ровно настолько,
    чтобы после столкновения хвост гас до −20 дБ не дольше target секунд. Идемпотентно."""
    if getattr(song, "_damped", False):
        return
    spans = note_spans(song)
    csec = chord_spans_sec(song)
    onsets = sorted((t0, n.pitch, id(n)) for n, t0, _a, _b in spans if n.pitch >= LOW)
    on_t = np.array([o[0] for o in onsets]) if onsets else np.zeros(0)
    for n, t0, toff, tend in spans:
        m = engine.envelope_model(n.inst, n.params)
        if m["kind"] not in RING_KINDS or tend - toff <= target + 0.05:
            continue
        pc = n.pitch % 12
        tc = None
        for cs, ce, ch, a, b in csec:
            if a <= n.start + 1e-6 or cs >= tend or cs < toff - 1e-6 and ce <= toff:
                continue
            if cs >= toff - 1e-6 and pc not in ch.allowed() and ch.qual != "7b9":
                tc = cs
                break
        if n.pitch >= LOW and len(on_t):
            i0 = np.searchsorted(on_t, t0 + 1e-4)
            i1 = np.searchsorted(on_t, tend)
            for t1, p1, nid in onsets[i0:i1]:
                if nid != id(n) and _semi(p1, n.pitch):
                    c = max(t1, toff)
                    tc = c if tc is None else min(tc, c)
                    break
        if tc is None:
            continue
        need = max(0.0, tc + target - toff)
        if m["kind"] == "ks":
            rel = max(0.02, need / (2.3 * 2 / 6.9))
        else:
            rel = max(0.04, need / 2.3)
        cur = n.params.get("rel")
        if cur is None or m["kind"] == "modal" and m.get("rel") is None:
            cur = m["rel"] if m.get("rel") else 1e9
            if m["kind"] == "ks":
                cur = cur * 6.9 / 2
        n.params["rel"] = float(min(cur, rel))
    song._damped = True


def check_harmony(song):
    """Возвращает (ошибки, проходящие) — списки кортежей с описанием."""
    auto_damp(song)
    meter = song.meter
    issues, passing = [], []
    segs = sorted(song.chords, key=lambda c: c[0])
    csec = chord_spans_sec(song)

    def chords_at(s, e):
        return [(max(s, a), min(e, b), c) for a, b, c in segs if a < e and b > s]

    spans = note_spans(song)
    for n, t0, toff, tend in spans:
        s, e = n.start, n.start + n.dur * n.sound
        pc = n.pitch % 12
        # 1) звучащая часть
        for a, b, ch in chords_at(s, e):
            if pc in ch.allowed():
                continue
            ov = b - a
            pos = a % meter
            strong = abs(pos) < 1e-6 or (meter == 4 and abs(pos - 2) < 1e-6)
            on_beat = abs(a % 1.0) < 1e-6
            ok = False
            if n.role == "melody" and ov <= 0.5 + 1e-6 and not strong:
                ok = True
            if n.role == "melody" and ov <= 0.25 + 1e-6:
                ok = True
            if n.role == "bass" and ov <= 1.0 + 1e-6 and not strong:
                ok = True
            # Звук, начавшийся раньше смены аккорда и тянущийся в новый аккорд — недолго, допустимо.
            if a > n.start + 1e-6 and ov <= 0.25 + 1e-6:
                ok = True
            rec = (n.inst, name(n.pitch), round(n.start, 3), ch.sym, round(ov, 3),
                   "сильная" if strong else ("доля" if on_beat else "слабая"))
            (passing if ok else issues).append(("нота вне аккорда",) + rec)
        # 2) хвост в следующих аккордах (которые начались после начала ноты)
        if tend > toff + 1e-3:
            for cs, ce, ch, a, b in csec:
                if a <= n.start + 1e-6 or cs >= tend or ce <= toff:
                    continue
                if pc in ch.allowed():
                    continue
                ov = min(tend, ce) - max(toff, cs)
                if ov <= 0:
                    continue
                rec = ("хвост в чужом аккорде", n.inst, name(n.pitch), round(n.start, 3), ch.sym, round(ov, 2))
                (issues if ov > RING_GRACE else passing).append(rec)
    # 3) трение: малая секунда/нона между одновременно слышимыми звуками
    ev = sorted(spans, key=lambda z: z[1])
    for i, (n1, a0, a1, ae) in enumerate(ev):
        for n2, b0, b1, be in ev[i + 1:]:
            if b0 >= ae:
                break
            if not _semi(n1.pitch, n2.pitch) or min(n1.pitch, n2.pitch) < LOW:
                continue
            chs = chords_at(n2.start, n2.start + 0.01)
            sym = chs[0][2].sym if chs else "?"
            if chs and chs[0][2].qual == "7b9":
                continue  # b9 законна в аккорде 7b9
            e1 = n1.start + n1.dur * n1.sound
            e2 = n2.start + n2.dur * n2.sound
            ov_beats = min(e1, e2) - max(n1.start, n2.start)
            short_mel = (n1.role == "melody" and n1.dur <= 0.5) or (n2.role == "melody" and n2.dur <= 0.5)
            rec = (n1.inst, name(n1.pitch), n2.inst, name(n2.pitch), round(max(n1.start, n2.start), 3), sym)
            if ov_beats >= 0.3:
                (passing if short_mel else issues).append(("трение",) + rec)
                continue
            ov_s = min(ae, be) - max(a0, b0)
            if ov_s > RING_GRACE:
                kind = ("трение хвостом",) + rec + (round(ov_s, 2),)
                (passing if short_mel and ov_s <= 2 * RING_GRACE else issues).append(kind)
    return issues, passing


# ---------------------------------------------------------------- непрерывная мера

def _env(n, t0, toff, tend, grid):
    """Огибающая амплитуды ноты на сетке (без синтеза): атака, собственное затухание, отпускание."""
    m = engine.envelope_model(n.inst, n.params)
    t = grid - t0
    e = np.zeros_like(grid)
    on = (t >= 0) & (grid <= tend + 0.05)
    tt = t[on]
    a = 1 - np.exp(-tt / max(m["attack"], 1e-3))
    if m["kind"] == "epiano":
        tau = float(np.clip(n.params.get("decay", 1.0) * 3.0 * (220.0 / midi_hz(n.pitch)) ** 0.5, 0.5, 7.0))
        d = 0.6 * np.exp(-tt / tau) + 0.4 * np.exp(-tt / (0.22 * tau))
    elif m["kind"] == "upright":
        d = np.exp(-tt / float(np.clip(0.9 * (60.0 / midi_hz(n.pitch)) ** 0.25, 0.5, 1.4)))
    elif m.get("tau"):
        d = np.exp(-tt / m["tau"])
    else:
        d = np.ones_like(tt)
    rel = m["rel"] if m.get("rel") else None
    r = np.ones_like(tt)
    if rel:
        off = toff - t0
        r = np.where(tt > off, np.exp(-(tt - off) / rel), 1.0)
    e[on] = a * d * r * n.vel
    return e


def roughness(song, dt=0.01):
    """Доля энергии в звуках на полтона/малую нону (%) и доля энергии дорожек вне аккорда (%)."""
    auto_damp(song)
    spans = note_spans(song)
    if not spans:
        return {"semitonePct": 0.0, "outOfChordPct": {}}
    T = max(z[3] for z in spans) + 0.1
    grid = np.arange(0, T, dt)
    E = np.array([_env(n, t0, toff, tend, grid) for n, t0, toff, tend in spans])
    stems = [n.params.get("stem", n.inst) for n, *_ in spans]
    # Громкость дорожек: огибающие масштабируются так, чтобы средняя мощность дорожки
    # соответствовала её уровню в миксе (lufs в настройках песни).
    scale = {}
    for st in set(stems):
        idx = [i for i, s in enumerate(stems) if s == st]
        P = (E[idx] ** 2).sum(0)
        act = P[P > P.max() * 0.01] if P.max() > 0 else P
        lvl = song.stems.get(st, {}).get("lufs", -24)
        scale[st] = np.sqrt(10 ** (lvl / 10) / (act.mean() + 1e-12)) if len(act) else 0.0
    E *= np.array([scale[s] for s in stems])[:, None]
    tot = (E ** 2).sum()
    P = np.array([n.pitch for n, *_ in spans])
    clash = np.zeros_like(grid)
    pairs = collections.Counter()
    hi = [i for i in range(len(P)) if P[i] >= LOW]
    for ai, a in enumerate(hi):
        for b in hi[ai + 1:]:
            if _semi(P[a], P[b]):
                c = E[a] * E[b]
                s = c.sum()
                if s > 0:
                    clash += c
                    pairs[tuple(sorted((stems[a], stems[b])))] += s
    # аккорд на каждом шаге сетки
    csec = chord_spans_sec(song)
    starts = np.array([c[0] for c in csec])
    ci = np.clip(np.searchsorted(starts, grid, side="right") - 1, 0, len(csec) - 1)
    inside = grid < csec[-1][1]
    allowed = [c[2].allowed() for c in csec]
    q7b9 = np.array([csec[i][2].qual == "7b9" for i in ci])
    clash[q7b9] = 0
    out = collections.defaultdict(lambda: [0.0, 0.0])
    for j, (n, *_r) in enumerate(spans):
        e2 = E[j] ** 2
        if not e2.any():
            continue
        bad = np.array([n.pitch % 12 not in allowed[i] for i in ci]) & inside
        out[stems[j]][0] += e2.sum()
        out[stems[j]][1] += e2[bad].sum()
    worst = []
    order = np.argsort(clash)[::-1]
    for t in order[:2000]:
        if clash[t] <= 0:
            break
        if all(abs(t - w) > 50 for w in worst):
            worst.append(int(t))
        if len(worst) >= 3:
            break
    det = []
    for t in worst:
        snd = sorted(((E[j, t], name(P[j]), stems[j]) for j in range(len(P)) if E[j, t] > 0), reverse=True)[:6]
        mx = snd[0][0] if snd else 1
        det.append(f"{grid[t]:.1f}s {csec[ci[t]][2].sym}: " +
                   ", ".join(f"{nm}/{st} {20 * np.log10(v / mx):.0f}dB" for v, nm, st in snd))
    return {
        "semitonePct": round(float(100 * clash.sum() / (tot + 1e-20)), 2),
        "outOfChordPct": {k: round(100 * v[1] / v[0], 1) for k, v in sorted(out.items()) if v[0] > 0},
        "topPairs": [[list(k), round(100 * v / (tot + 1e-20), 2)] for k, v in pairs.most_common(3)],
        "worst": det,
    }
