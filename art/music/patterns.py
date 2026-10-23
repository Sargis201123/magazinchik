"""Помощники аранжировки: мелодия по тактам, арпеджио гитары, комп аккордами, басовые линии,
пэды, ударные по сетке."""

import numpy as np

from score import Note, bass_note, nearest, seq, voicing


def bars_mel(song, start_bar, bars, inst, vel=0.75, pickup=None, transpose=0, check=True, **params):
    """Мелодия по тактам: каждая строка — ровно один такт. pickup — затакт перед start_bar."""
    m = song.meter
    out = []
    if pickup:
        pk, end = seq(pickup, 0, inst=inst, vel=vel, transpose=transpose, **params)
        ln = end
        for n in pk:
            n.start += start_bar * m - ln
        out += pk
    for i, b in enumerate(bars):
        if b is None:
            continue
        ns, end = seq(b, (start_bar + i) * m, inst=inst, vel=vel, transpose=transpose, **params)
        if check and abs(end - (start_bar + i + 1) * m) > 1e-6:
            raise ValueError(f"{song.id}: такт {start_bar + i} длиной {end - (start_bar + i) * m} долей: {b!r}")
        out += ns
    song.add(out)
    return out


def melody_pitches(song, a, b, min_dur=0.4):
    """Долгие звуки, уже записанные на отрезке [a, b) (мелодия и другие партии) — новая партия
    не должна тереться с ними малой секундой/ноной."""
    return sorted({n.pitch for n in song.notes if n.role != "drum" and n.pitch > 0 and n.dur >= min_dur
                   and n.start < b - 0.25 and n.start + n.dur * n.sound > a + 0.25})


def until_change(song, b, d, overlap=0.05):
    """Длительность, обрезанная по следующей смене аккорда (струны глушатся, чтобы не тереть)."""
    end = b + d
    for a, e, c in song.chords:
        if b + 1e-6 < a < end:
            end = a + overlap
    return end - b


def chord_spans(song, bar_from, bar_to):
    """Отрезки аккордов, попадающие в такты [bar_from, bar_to)."""
    a0, a1 = bar_from * song.meter, bar_to * song.meter
    return [(max(a, a0), min(b, a1), c) for a, b, c in song.chords if a < a1 and b > a0]


def guitar_voicing(ch, prev=None, lo_bass=40, hi_bass=52, top=69, n_up=3, avoid=()):
    b = bass_note(ch, lo_bass, hi_bass, prev[0] if prev else None)
    up = voicing(ch, n=n_up, lo=b + 5, hi=top, prev=prev[1:] if prev else None, min_gap=3, max_span=15, avoid=avoid)
    return [b] + up


def arpeggio(song, bar_from, bar_to, inst, pattern, vel=0.6, lo_bass=40, hi_bass=52, top=69, n_up=3,
             ring=1.6, accent=0.12, role="chord", **params):
    """pattern: список (доля в такте, индекс голоса 0=бас.., длит.) — повторяется каждый такт.
    Голос берётся из аккорда, звучащего в этот момент."""
    prev = None
    cache = {}
    out = []
    for bar in range(bar_from, bar_to):
        for off, vi, dur in pattern:
            b = bar * song.meter + off
            ch = song.chord_at(b + 1e-6)
            if ch is None:
                continue
            if ch.sym not in cache or cache[ch.sym][1] != bar:
                span = [(a, e) for a, e, c in song.chords if a <= b + 1e-6 < e][0]
                v = guitar_voicing(ch, prev, lo_bass, hi_bass, top, n_up, avoid=melody_pitches(song, *span))
                prev = v
                cache[ch.sym] = (v, bar)
            v = cache[ch.sym][0]
            p = v[min(vi, len(v) - 1)]
            vv = vel * (1 + accent if off % 1 == 0 else 1 - accent * 0.5) * (1.1 if vi == 0 else 1)
            out.append(Note(b, until_change(song, b, dur * ring), p, float(np.clip(vv, 0.05, 1)), inst, role,
                            params=dict(params)))
    song.add(out)
    return out


def strum(song, beats, inst, vel=0.6, down=True, spread_ms=14, lo_bass=40, hi_bass=52, top=69, n_up=4,
          dur=1.0, mute=0.0, role="chord", skip_bass=False, **params):
    """Удар по струнам: аккорд раскатывается вниз/вверх. beats — список (доля, длит., сила, вниз?)."""
    out = []
    prev = None
    for item in beats:
        b, d, v, dn = (item + (down,))[:4] if len(item) == 3 else item
        ch = song.chord_at(b + 1e-6)
        if ch is None:
            continue
        vo = guitar_voicing(ch, prev, lo_bass, hi_bass, top, n_up, avoid=melody_pitches(song, b, b + d))
        prev = vo
        notes = vo[1:] if skip_bass else vo
        order = notes if dn else notes[::-1]
        d = until_change(song, b, d)
        for i, p in enumerate(order):
            out.append(Note(b, d, p, float(np.clip(v * (1 - 0.04 * i), 0.05, 1)), inst, role,
                            params=dict(params, mute=mute), offset_ms=i * spread_ms))
    song.add(out)
    return out


def comp(song, bar_from, bar_to, inst, rhythm, n=4, lo=52, hi=74, vel=0.55, top_max=None, roll_ms=8,
         role="chord", per_bar=None, **params):
    """Комп аккордами: rhythm — список (доля, длит., сила) на такт; per_bar(bar)->rhythm при желании."""
    out = []
    prev = None
    for bar in range(bar_from, bar_to):
        rh = per_bar(bar) if per_bar else rhythm
        for off, d, v in rh:
            b = bar * song.meter + off
            ch = song.chord_at(b + 1e-6)
            if ch is None:
                continue
            tm = top_max(b) if callable(top_max) else top_max
            vo = voicing(ch, n=n, lo=lo, hi=hi, prev=prev, top_max=tm, avoid=melody_pitches(song, b, b + d))
            prev = vo
            # не перезвучивать за сменой аккорда
            end = b + d
            for a, e, c in song.chords:
                if a > b + 1e-6 and a < end:
                    end = a
            for i, p in enumerate(vo):
                out.append(Note(b, end - b, p, float(np.clip(v * vel * (0.92 + 0.05 * i), 0.05, 1)), inst, role,
                                params=dict(params), offset_ms=i * roll_ms))
    song.add(out)
    return out


def pad(song, bar_from, bar_to, inst="pad", n=4, lo=55, hi=76, vel=0.5, role="pad", **params):
    out = []
    prev = None
    for a, b, ch in sorted(song.chords, key=lambda c: c[0]):
        if a < bar_from * song.meter or a >= bar_to * song.meter:
            continue
        vo = voicing(ch, n=n, lo=lo, hi=hi, prev=prev, avoid=melody_pitches(song, a, b))
        prev = vo
        for p in vo:
            out.append(Note(a, b - a, p, vel, inst, role, params=dict(params), sound=1.0))
    song.add(out)
    return out


def bass_line(song, bar_from, bar_to, inst, style="two", vel=0.75, lo=36, hi=52, role="bass", **params):
    """Басовые линии: two (на 1 и 3), walk (четверти с подходами), pop8 (восьмые), waltz, oompah, samba."""
    out = []
    m = song.meter
    prev = None
    for bar in range(bar_from, bar_to):
        b0 = bar * m
        spans = [(a, e, c) for a, e, c in song.chords if a < b0 + m and e > b0]
        for si, (a, e, ch) in enumerate(spans):
            a = max(a, b0)
            e = min(e, b0 + m)
            root = bass_note(ch, lo, hi, prev)
            prev = root
            length = e - a
            # вторая опора: квинта аккорда (у обращений — корень аккорда)
            other = ch.root if ch.bass != ch.root else (ch.root + 7) % 12
            if other not in ch.tones:
                other = ch.root
            fifth = nearest(other, root + 6)
            if fifth > hi + 2:
                fifth -= 12
            nxt_ch = song.chord_at(e + 1e-6)
            nxt_root = bass_note(nxt_ch, lo, hi, root) if nxt_ch else root
            if style == "two":
                if length >= 4:
                    out.append(Note(a, 1.9, root, vel, inst, role, params=dict(params)))
                    out.append(Note(a + 2, 1.5, fifth, vel * 0.85, inst, role, params=dict(params)))
                    out.append(Note(a + 3.5, 0.45, _approach(nxt_root, root, ch), vel * 0.6, inst, role, params=dict(params)))
                else:
                    out.append(Note(a, length * 0.95, root, vel, inst, role, params=dict(params)))
            elif style == "long":
                out.append(Note(a, length * 0.98, root, vel, inst, role, params=dict(params)))
            elif style == "walk":
                tones = _walk(ch, root, nxt_root, int(round(length)), lo, hi)
                for k, p in enumerate(tones):
                    out.append(Note(a + k, 0.9, p, vel * (1.0 if k % 2 == 0 else 0.88), inst, role, params=dict(params)))
            elif style == "pop8":
                for k in range(int(length * 2)):
                    p = root if k % 4 != 3 else (root + 12 if k % 8 == 3 else fifth)
                    if k == int(length * 2) - 1 and nxt_root != root:
                        p = _approach(nxt_root, root, ch)
                    out.append(Note(a + k * 0.5, 0.42, p, vel * (1.0 if k % 2 == 0 else 0.8), inst, role,
                                    params=dict(params)))
            elif style == "dayfunk":
                out.append(Note(a, 0.75, root, vel, inst, role, params=dict(params)))
                if length >= 2:
                    out.append(Note(a + 1.5, 0.45, root, vel * 0.7, inst, role, params=dict(params)))
                if length >= 4:
                    out.append(Note(a + 2, 0.75, fifth, vel * 0.85, inst, role, params=dict(params)))
                    out.append(Note(a + 3, 0.45, root + 12 if root + 12 <= hi + 7 else fifth, vel * 0.6, inst, role, params=dict(params)))
                out.append(Note(e - 0.5, 0.45, _approach(nxt_root, root, ch), vel * 0.65, inst, role, params=dict(params)))
            elif style == "waltz":
                out.append(Note(a, 1.4, root if bar % 2 == 0 else fifth, vel, inst, role, params=dict(params)))
            elif style == "oompah":
                # 2/4: корень на 1, квинта (ниже) на 2
                low5 = fifth - 12 if fifth - 12 >= lo - 2 else fifth
                out.append(Note(a, 0.6, root, vel, inst, role, params=dict(params)))
                out.append(Note(a + 1, 0.6, low5, vel * 0.85, inst, role, params=dict(params)))
            elif style == "samba":
                # 2/4: корень на 1 (коротко), квинта на 2 с опережением
                out.append(Note(a, 0.45, root, vel, inst, role, params=dict(params)))
                out.append(Note(a + 0.75, 0.2, root, vel * 0.55, inst, role, params=dict(params)))
                out.append(Note(a + 1, 0.7, fifth - 12 if fifth - 12 >= lo - 2 else fifth, vel * 0.9, inst, role, params=dict(params)))
    song.add(out)
    return out


def _approach(target, cur, ch):
    """Подход к следующему корню: на полтона снизу/сверху или через квинту."""
    if target == cur:
        return cur + 7 if cur + 7 < cur + 12 else cur
    cands = [target - 1, target + 1, target - 2, target + 2]
    allowed = ch.allowed()
    for c in cands:
        if c % 12 in allowed:
            return c
    return target - 1


def _walk(ch, root, nxt_root, beats, lo, hi):
    """Шагающий бас: корень, звуки аккорда, хроматический подход к следующему корню."""
    tones = [root]
    pcs = [p for p in ch.tones]
    if beats >= 2:
        third = nearest(pcs[1] if len(pcs) > 1 else ch.root, root + 4)
        fifth = nearest(pcs[2] if len(pcs) > 2 else ch.root, root + 7)
        if beats == 4:
            tones += [third if third > root else third + 12, fifth if fifth > root else fifth + 12]
        tones.append(_approach(nxt_root, root, ch))
        tones = tones[:beats]
    return [min(max(t, lo - 2), hi + 7) for t in tones]


VEL = {"X": 0.95, "x": 0.72, "o": 0.45, "-": 0.28, ".": 0}


def drums(song, bar_from, bar_to, patterns, grid=4, role="drum", every=None):
    """patterns: {инструмент: строка сетки на такт (или список строк, по кругу)}; grid — делений на долю."""
    out = []
    for bar in range(bar_from, bar_to):
        if every and not every(bar):
            continue
        for inst, pat in patterns.items():
            p = pat[(bar - bar_from) % len(pat)] if isinstance(pat, list) else pat
            p = p.replace(" ", "")
            step = 1.0 / grid
            for i, c in enumerate(p):
                v = VEL.get(c, 0)
                if v <= 0:
                    continue
                out.append(Note(bar * song.meter + i * step, step, 0, v, inst, role))
    song.add(out)
    return out


def harmony_below(song, notes, inst, vel_mul=0.8, min_iv=3, max_iv=5, role="chord", **params):
    """Второй голос: ближайший звук аккорда на терцию–кварту ниже каждой ноты мелодии."""
    out = []
    for n in notes:
        ch = song.chord_at(n.start + 1e-6)
        if ch is None:
            continue
        pick = None
        for iv in range(min_iv, max_iv + 1):
            p = n.pitch - iv
            if p % 12 in ch.tones:
                pick = p
                break
        if pick is None:
            for iv in range(min_iv, max_iv + 3):
                if (n.pitch - iv) % 12 in ch.allowed():
                    pick = n.pitch - iv
                    break
        if pick is None:
            continue
        out.append(Note(n.start, n.dur, pick, n.vel * vel_mul, inst, role, params=dict(n.params, **params),
                        sound=n.sound))
    song.add(out)
    return out
