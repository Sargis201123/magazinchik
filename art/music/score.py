"""Нотная запись, аккорды, голосоведение и проверка гармонии.

Запись мелодий строкой: «C5:1.5 D5:.5 r:1 A5:2!» — нота:длительность в долях (четвертях),
r — пауза. Значки после длительности: ! акцент, ? тише, , стаккато, ~ легато.
Аккорды: «Cmaj7», «Dm9», «G7sus4», «D/F#», «Bbm6», «C13», «D7b9» и т. п.
"""

import itertools
import re
from dataclasses import dataclass, field

import numpy as np

NAMES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
PC_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]


def nm(s):
    """'C4' -> 60, 'Bb3' -> 58, 'F#5' -> 78."""
    m = re.fullmatch(r"([A-G])([#b]?)(-?\d)", s.strip())
    if not m:
        raise ValueError(f"нота? {s!r}")
    pc = NAMES[m.group(1)] + {"": 0, "#": 1, "b": -1}[m.group(2)]
    return pc + 12 * (int(m.group(3)) + 1)


def name(m):
    return f"{PC_NAMES[m % 12]}{m // 12 - 1}"


@dataclass
class Note:
    start: float  # в долях
    dur: float  # в долях
    pitch: int  # MIDI; для ударных — 0
    vel: float
    inst: str
    role: str = "melody"  # melody | chord | bass | pad | drum | fx
    pan: float | None = None
    params: dict = field(default_factory=dict)
    sound: float = 1.0  # доля длительности, которую нота звучит
    offset_ms: float = 0.0  # заданный сдвиг (раскат аккорда)


def _dur(s):
    if "/" in s:
        a, b = s.split("/")
        return float(a) / float(b)
    return float(s)


def seq(text, start=0.0, inst="lead", vel=0.75, role="melody", transpose=0, **params):
    """Строка нот -> список Note. Возвращает (ноты, позиция конца)."""
    out = []
    pos = start
    for tok in text.split():
        m = re.fullmatch(r"([A-Gr][#b]?-?\d?):([0-9./]+)([!?,~]*)", tok)
        if not m:
            raise ValueError(f"токен? {tok!r}")
        nt, d, mods = m.groups()
        d = _dur(d)
        if nt != "r":
            v = vel + 0.15 * mods.count("!") - 0.2 * mods.count("?")
            snd = 0.55 if "," in mods else (1.08 if "~" in mods else 0.95)
            out.append(Note(pos, d, nm(nt) + transpose, float(np.clip(v, 0.05, 1.0)), inst, role,
                            params=dict(params), sound=snd))
        pos += d
    return out, pos


def mel(text, start=0.0, **kw):
    return seq(text, start, **kw)[0]


# ---------------------------------------------------------------- аккорды

# качество: (звуки аккорда, допустимые опевания/надстройки) — интервалы от корня
QUAL = {
    "": ([0, 4, 7], [2, 9, 11]),
    "add9": ([0, 4, 7, 2], [9, 11]),
    "6": ([0, 4, 7, 9], [2, 11]),
    "69": ([0, 4, 7, 9, 2], [11]),
    "maj7": ([0, 4, 7, 11], [2, 9, 6]),
    "maj9": ([0, 4, 7, 11, 2], [9, 6]),
    "m": ([0, 3, 7], [2, 5, 10]),
    "m7": ([0, 3, 7, 10], [2, 5]),
    "m9": ([0, 3, 7, 10, 2], [5]),
    "m11": ([0, 3, 7, 10, 2, 5], []),
    "m6": ([0, 3, 7, 9], [2, 5]),
    "7": ([0, 4, 7, 10], [2, 9]),
    "9": ([0, 4, 7, 10, 2], [9]),
    "13": ([0, 4, 10, 2, 9], [7]),
    "7b9": ([0, 4, 7, 10, 1], [8]),
    "7sus4": ([0, 5, 7, 10], [2, 9]),
    "13sus": ([0, 5, 10, 2, 9], [7]),
    "sus4": ([0, 5, 7], [2, 10]),
    "m7b5": ([0, 3, 6, 10], [5, 8]),
    "dim7": ([0, 3, 6, 9], [2, 5, 8, 11]),
}


@dataclass
class Chord:
    sym: str
    root: int  # pc
    tones: list  # pcs
    tensions: list  # pcs
    bass: int  # pc
    qual: str

    def allowed(self):
        return set(self.tones) | set(self.tensions)

    def guide(self):
        """Направляющие тоны: терция (или кварта у sus) и септима/секста."""
        iv = [(p - self.root) % 12 for p in self.tones]
        g = []
        for want in ([3, 4, 5], [10, 11, 9]):
            for w in want:
                if w in iv:
                    g.append((self.root + w) % 12)
                    break
        return g


def chord(sym):
    m = re.fullmatch(r"([A-G][#b]?)([a-z0-9#]*)(?:/([A-G][#b]?))?", sym)
    if not m:
        raise ValueError(f"аккорд? {sym!r}")
    r, q, b = m.groups()
    root = nm(r + "4") % 12
    if q not in QUAL:
        raise ValueError(f"качество? {sym!r}")
    tones, tens = QUAL[q]
    bass = nm(b + "4") % 12 if b else root
    return Chord(sym, root, [(root + i) % 12 for i in tones], [(root + i) % 12 for i in tens], bass, q)


def voicing(ch, n=4, lo=50, hi=74, prev=None, top_max=None, need_root=False, min_gap=1, max_span=16,
            prefer_top=None, avoid=()):
    """Плотное «джазовое» расположение n звуков в диапазоне [lo, hi] с плавным голосоведением."""
    iv = {(p - ch.root) % 12: p for p in ch.tones}
    req = ch.guide()
    opts = []
    for want in (7, 2, 9, 0, 5, 1, 6, 3, 4, 10, 11):  # квинта, нона, терцдецима, корень…
        if want in iv and iv[want] not in req and iv[want] not in opts:
            opts.append(iv[want])
    for t in ch.tensions:
        if t not in req and t not in opts and (t - ch.root) % 12 in (2, 9):
            opts.append(t)
    # Трезвучия (и их варианты с секстой/ноной) — корень и квинта обязательны, иначе аккорд
    # не узнаётся; у септаккордов хватает терции и септимы (+ корень по просьбе).
    if ch.qual in ("", "m", "sus4", "add9", "6", "m6", "69") and n >= 3:
        for w in (0, 7):
            if w in iv and iv[w] not in req:
                req.append(iv[w])
        if ch.qual in ("6", "m6", "69", "add9"):
            # характерный звук (секста/нона) важнее квинты
            extra = iv.get(9) if ch.qual in ("6", "m6", "69") else iv.get(2)
            if extra is not None and extra not in req:
                if len(req) >= n:
                    req = [p for p in req if p != iv.get(7)]
                req.append(extra)
        opts = [o for o in opts if o not in req]
    if need_root and ch.root not in req:
        req = [ch.root] + req
        opts = [o for o in opts if o != ch.root]
    # В крайнем случае — удвоение корня или квинты (лучше, чем трение с мелодией).
    for w in (0, 7):
        if w in iv:
            opts.append(iv[w])
    k = n - len(req)
    pcsets = []
    if k <= 0:
        pcsets = [req[:n]]
    else:
        for combo in itertools.combinations(opts[:7], min(k, len(opts[:7]))):
            pcsets.append(req + list(combo))
    # Большая септима против корня в мелодии трёт — тогда вместо неё секста (Dmaj7 -> D6).
    if avoid and ch.qual in ("maj7", "maj9"):
        maj7, six = (ch.root + 11) % 12, (ch.root + 9) % 12
        pcsets += [[six if p == maj7 else p for p in ps] for ps in pcsets if maj7 in ps and six not in ps]
    hi_eff = min(hi, top_max) if top_max else hi
    best, bcost = None, 1e9
    for pcs in pcsets:
        places = []
        for p in pcs:
            places.append([m for m in range(lo, hi_eff + 1) if m % 12 == p])
        for cand in itertools.product(*places):
            c = sorted(cand)
            if len(set(c)) < len(c):
                continue
            if c[-1] - c[0] > max_span:
                continue
            bad = False
            for a, b in itertools.combinations(c, 2):
                d = b - a
                if d < min_gap or d % 12 == 1 or (d == 2 and min_gap > 2):
                    bad = True
                    break
            if not bad and avoid:
                for a in c:
                    for b in avoid:
                        d = abs(a - b)
                        if d % 12 == 1 and d <= 13 or d == 0 and False:
                            bad = True
                            break
                    if bad:
                        break
            if bad:
                continue
            if prev:
                pv = sorted(prev)
                if len(pv) == len(c):
                    cost = sum(abs(x - y) for x, y in zip(c, pv))
                else:
                    cost = abs(np.mean(c) - np.mean(pv)) * len(c)
            else:
                cost = abs(np.mean(c) - (lo + hi_eff) / 2) * 2
            if prefer_top is not None:
                cost += abs(c[-1] - prefer_top) * 0.7
            cost += 0.15 * (c[-1] - c[0])
            if cost < bcost:
                best, bcost = c, cost
    if best is None:
        if max_span < 30 or min_gap > 1:
            return voicing(ch, n, lo, hi + 4, prev, top_max, need_root, 1, 30, avoid=avoid)
        if avoid:
            return voicing(ch, n, lo, hi, prev, top_max, need_root, min_gap, max_span, prefer_top)
        raise ValueError(f"нет расположения для {ch.sym} в {lo}..{hi}")
    return best


def bass_note(ch, lo=36, hi=52, prev=None):
    """Басовая нота аккорда (с учётом обращения) ближе к предыдущей."""
    cands = [m for m in range(lo, hi + 1) if m % 12 == ch.bass]
    if prev is None:
        return cands[0] if cands[0] >= lo + 3 or len(cands) == 1 else cands[0]
    return min(cands, key=lambda m: abs(m - prev) + (0.5 if m < lo + 2 else 0))


def nearest(pc, around):
    c = [m for m in range(around - 6, around + 7) if m % 12 == pc]
    return min(c, key=lambda m: abs(m - around))


# ---------------------------------------------------------------- проверка гармонии

def check_harmony(notes, chords, meter=4):
    """Каждый звук сверяется с текущим аккордом, а одновременные звуки — между собой.

    Возвращает (ошибки, проходящие). Проходящие допустимы: короткая нота мелодии
    (≤ 1/2 доли) не на сильной доле, либо подход баса на слабой доле.
    """
    issues, passing = [], []
    segs = sorted(chords, key=lambda c: c[0])

    def chords_at(s, e):
        return [(max(s, a), min(e, b), c) for a, b, c in segs if a < e and b > s]

    pitched = [n for n in notes if n.role != "drum" and n.pitch > 0]
    for n in pitched:
        s, e = n.start, n.start + n.dur * n.sound
        for a, b, ch in chords_at(s, e):
            pc = n.pitch % 12
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
            rec = (n.inst, name(n.pitch), round(n.start, 3), ch.sym, round(ov, 3), "сильная" if strong else ("доля" if on_beat else "слабая"))
            (passing if ok else issues).append(("нота вне аккорда",) + rec)
    # Попарные столкновения: малая секунда/нона между долгими одновременными звуками.
    ev = sorted(pitched, key=lambda n: n.start)
    for i, n1 in enumerate(ev):
        e1 = n1.start + n1.dur * n1.sound
        for n2 in ev[i + 1:]:
            if n2.start >= e1:
                break
            e2 = n2.start + n2.dur * n2.sound
            ov = min(e1, e2) - max(n1.start, n2.start)
            if ov < 0.3:
                continue
            d = abs(n1.pitch - n2.pitch)
            if d % 12 == 1 and d <= 13 and min(n1.pitch, n2.pitch) >= 48:
                t0 = max(n1.start, n2.start)
                chs = chords_at(t0, t0 + 0.01)
                sym = chs[0][2].sym if chs else "?"
                # b9 законна в аккорде 7b9 — пропускаем
                if chs and chs[0][2].qual == "7b9":
                    continue
                if n1.role == "melody" and n1.dur <= 0.5 or n2.role == "melody" and n2.dur <= 0.5:
                    passing.append(("трение", n1.inst, name(n1.pitch), n2.inst, name(n2.pitch), round(t0, 3), sym))
                    continue
                issues.append(("трение", n1.inst, name(n1.pitch), n2.inst, name(n2.pitch), round(t0, 3), sym))
    return issues, passing
