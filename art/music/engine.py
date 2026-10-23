"""Песня: ноты и аккорды во времени, темп со свингом и замедлением, очеловечивание,
рендер нот в дорожки (стемы), сведение по громкости стемов, посылы на реверб и эхо, мастеринг.
"""

import hashlib

import numpy as np

import dsp
import instruments as I
from dsp import SR
from score import chord

# ---------------------------------------------------------------- инструменты

def _ks(**base):
    def fn(f, d, v, rng, **p):
        q = dict(base)
        q.update(p)
        return I.ks_string(f, d, v, rng, **q)
    return fn


def _modal(parts, **base):
    def fn(f, d, v, rng, **p):
        q = dict(base)
        q.update(p)
        return I.modal(f, d, v, rng, parts, **q)
    return fn


def _brass(**base):
    def fn(f, d, v, rng, **p):
        q = dict(base)
        q.update(p)
        return I.brass(f, d, v, rng, **q)
    return fn


def _pad(**base):
    def fn(f, d, v, rng, **p):
        q = dict(base)
        q.update(p)
        return I.pad_voice(f, d, v, rng, **q)
    return fn


PITCHED = {
    "epiano": I.epiano,
    "guitar": _ks(bright=0.35, pos=0.2, t60=3.2),
    "steel": _ks(bright=0.7, pos=0.14, t60=2.6),
    "archtop": _ks(bright=0.5, pos=0.22, t60=0.9, rel=0.05),
    "cavaco": _ks(bright=0.85, pos=0.12, t60=0.9, rel=0.04),
    "harp": _ks(bright=0.55, pos=0.3, t60=4.0, rel=0.4),
    "upright": I.bass_upright,
    "ebass": I.bass_electric,
    "pad": _pad(),
    "strings": _pad(attack=1.4, rel=1.8, cutoff=1800, detune=9, voices=4, spread=0.9),
    "celesta": _modal(I.CELESTA, hammer=0.02, rel=0.6),
    "glock": _modal(I.GLOCK, hammer=0.04, hammer_lp=9000),
    "vibes": _modal(I.VIBES, tremolo=0.22, trem_rate=4.8, attack=0.004, hammer=0.015, rel=0.35),
    "musicbox": _modal(I.MUSICBOX, hammer=0.03),
    "bell": _modal(I.BELL, hammer=0.01, attack=0.002),
    "doorbell": _modal(I.DOORBELL, hammer=0.02),
    "coin": _modal(I.COIN, hammer=0.02, hammer_lp=10000),
    "brass": _brass(),
    "horn": _brass(dark=0.55, vib=0.0, voices=3, scoop=12, attack=0.05),
    "tuba": _brass(dark=0.75, vib=0.0, voices=2, detune=3, scoop=8, breath=0.01, attack=0.04),
    "flugel": _brass(dark=0.85, vib=11.0, voices=1, scoop=18, attack=0.07, breath=0.05),
    "clarinet": I.clarinet,
    "flute": I.flute,
    "lead": I.pluck_lead,
}

DRUMS = {
    "kick": lambda v, r: I.kick_soft(v, r),
    "tap": I.brush_tap,
    "swish": I.brush_swish,
    "swishl": lambda v, r: I.brush_swish(v, r, length=0.9),
    "rim": I.rim,
    "shaker": I.shaker,
    "ganza": lambda v, r: I.shaker(v, r, length=0.05, lo=3500, hi=10000),
    "hat": I.hat,
    "ohat": lambda v, r: I.hat(v, r, open_=True),
    "ride": I.ride,
    "crash": I.crash,
    "cymbals": lambda v, r: I.crash(v, r, length=1.2),
    "clap": I.clap,
    "snare": I.snare,
    "fsnare": lambda v, r: I.snare(v, r, wires=1.3, f0=210, decay=0.2, bright=0.8),
    "caixa": lambda v, r: I.snare(v, r, wires=1.0, f0=240, decay=0.08, bright=1.0),
    "bdrum": I.bass_drum,
    "surdo": I.surdo,
    "surdo_m": lambda v, r: I.surdo(v, r, muted=True),
    "tamb": I.tamborim,
    "agogo_h": lambda v, r: I.agogo(v, r, True),
    "agogo_l": lambda v, r: I.agogo(v, r, False),
    "cuica_u": lambda v, r: I.cuica(v, r, True),
    "cuica_d": lambda v, r: I.cuica(v, r, False),
    "apito": I.apito,
    "sleigh": I.sleigh,
    "tick_h": lambda v, r: I.clock_tick(v, r, True),
    "tick_l": lambda v, r: I.clock_tick(v, r, False),
    "pop": I.box_pop,
    "whoosh": lambda v, r: I.whoosh(1.0, r) * v,
}

# Разброс по времени (σ, мс) — живой исполнитель; у ударных меньше.
HUMAN_MS = {"drum": 4.0, "bass": 6.0, "chord": 7.0, "melody": 8.0, "pad": 10.0, "fx": 2.0}


def _seed(*parts):
    h = hashlib.blake2b(repr(parts).encode(), digest_size=8).digest()
    return int.from_bytes(h, "little")


class Song:
    def __init__(self, sid, bpm, meter=4, swing=0.0, swing_unit=1.0, loop_beats=None, seed=1, rit=None,
                 tail=4.0, fade_in=2.0, master=None):
        self.id = sid
        self.bpm = bpm
        self.meter = meter
        self.swing = swing  # доля доли, на которую запаздывает слабая восьмая (0.1–0.17)
        self.swing_unit = swing_unit  # 1.0 — свинг восьмых, 0.5 — шестнадцатых
        self.loop_beats = loop_beats
        self.seed = seed
        self.rit = rit  # (начало в долях, конец в долях, итоговый темп как доля)
        self.tail = tail
        self.fade_in = fade_in
        self.fade_out = 1.2
        self.notes = []
        self.chords = []  # (начало, конец, Chord)
        self.stems = {}
        self.master = master or {}
        self.meta = {}
        self.end_beat = 0.0

    # ---- аккорды
    def progression(self, bars, start_bar=0):
        """bars: список строк, по строке на такт; «Em7 A7» — два аккорда поровну."""
        for i, bar in enumerate(bars):
            syms = bar.split()
            span = self.meter / len(syms)
            for j, s in enumerate(syms):
                a = (start_bar + i) * self.meter + j * span
                self.chords.append((a, a + span, chord(s)))

    def chord_at(self, beat):
        for a, b, c in self.chords:
            if a <= beat < b:
                return c
        return None

    def add(self, notes):
        self.notes.extend(notes)

    # ---- время
    def _swing(self, b):
        if not self.swing:
            return b
        u = self.swing_unit
        k = np.floor(b / u + 1e-9)
        x = b / u - k
        s = self.swing / u
        y = np.where(x < 0.5, x * (0.5 + s) / 0.5, 0.5 + s + (x - 0.5) * (0.5 - s) / 0.5)
        return (k + y) * u

    def sec(self, b, swing=True):
        bb = self._swing(b) if swing else b
        spb = 60.0 / self.bpm
        if not self.rit:
            return float(bb * spb)
        a, e, fac = self.rit
        if bb <= a:
            return float(bb * spb)
        # Линейное замедление темпа от 1 до fac на [a, e], дальше — fac.
        x = min(bb, e) - a
        L = e - a
        # ∫ spb / (1 + (fac-1) u/L) du
        k = (fac - 1) / L
        t = a * spb + spb * np.log1p(k * x) / k if abs(k) > 1e-9 else a * spb + spb * x
        if bb > e:
            t += (bb - e) * spb / fac
        return float(t)

    # ---- длительность
    @property
    def loop_samples(self):
        if not self.loop_beats:
            return None
        n = self.loop_beats * 60.0 / self.bpm * SR
        assert abs(n - round(n)) < 1e-6, "петля должна быть целым числом отсчётов"
        return int(round(n))


# ---------------------------------------------------------------- рендер

class Renderer:
    def __init__(self, song):
        self.song = song
        self.loop = song.loop_samples
        if self.loop:
            self.n = self.loop
        else:
            last = max(n.start + n.dur for n in song.notes)
            song.end_beat = last
            self.n = int((song.sec(last) + song.tail + 1.0) * SR)
        self.drum_cache = {}
        self.stem_audio = {}

    def place(self, buf, sig, i0, gl, gr):
        """Кладёт сигнал в стерео-буфер (по кругу для петли)."""
        if sig.ndim == 1:
            L, R = sig * gl, sig * gr
        else:
            L, R = sig[0] * gl * np.sqrt(2), sig[1] * gr * np.sqrt(2)
        n = len(L)
        if self.loop:
            pos = i0 % self.loop
            k = 0
            while k < n:
                m = min(n - k, self.loop - pos)
                buf[0, pos: pos + m] += L[k: k + m]
                buf[1, pos: pos + m] += R[k: k + m]
                k += m
                pos = 0
        else:
            if i0 < 0:
                L, R = L[-i0:], R[-i0:]
                i0 = 0
            m = min(len(L), self.n - i0)
            if m > 0:
                buf[0, i0: i0 + m] += L[:m]
                buf[1, i0: i0 + m] += R[:m]

    def drum(self, inst, v, var):
        key = (inst, var)
        if key not in self.drum_cache:
            rng = np.random.default_rng(_seed("drum", inst, var, self.song.seed))
            self.drum_cache[key] = DRUMS[inst](1.0, rng)
        return self.drum_cache[key] * v ** 1.3

    def render_notes(self):
        s = self.song
        stems = {}
        for idx, nt in enumerate(s.notes):
            stem = nt.params.get("stem", nt.inst)
            cfg = s.stems.get(stem, {})
            rng = np.random.default_rng(_seed(s.id, idx, nt.inst, nt.start, nt.pitch))
            # Очеловечивание: общий сдвиг для одновременных нот одного инструмента + свой.
            onset_rng = np.random.default_rng(_seed(s.id, nt.inst, round(nt.start * 96)))
            sigma = cfg.get("hum", HUMAN_MS.get(nt.role, 6.0))
            jit = float(np.clip(onset_rng.normal(0, sigma) + rng.normal(0, sigma * 0.25), -15, 15))
            if nt.params.get("tight"):
                jit *= 0.3
            sw = not nt.params.get("noswing", False)
            t0 = s.sec(nt.start, sw) + (jit + nt.offset_ms) / 1000.0
            dur_s = max(0.03, s.sec(nt.start + nt.dur * nt.sound, sw) - s.sec(nt.start, sw))
            vel = float(np.clip(nt.vel * (1 + rng.normal(0, cfg.get("vel_jit", 0.05))), 0.05, 1.0))
            if nt.role == "drum" or nt.inst in DRUMS:
                sig = self.drum(nt.inst, vel, int(rng.integers(0, 6)))
            else:
                fn = PITCHED[nt.inst]
                p = {k: v for k, v in nt.params.items() if k not in ("stem", "tight", "noswing", "cents")}
                f = I.midi_hz(nt.pitch + nt.params.get("cents", 0.0) / 100.0)
                sig = fn(f, dur_s, vel, rng, **p)
            pan = nt.pan if nt.pan is not None else cfg.get("pan", 0.0)
            gl, gr = dsp.pan_gains(pan)
            if stem not in stems:
                stems[stem] = np.zeros((2, self.n))
            self.place(stems[stem], sig, int(round(t0 * SR)), gl, gr)
        self.stem_audio = stems
        return stems

    def process_stem(self, name, x):
        s = self.song
        cfg = s.stems.get(name, {})
        circ = bool(self.loop)
        if cfg.get("body"):
            h = I.guitar_body_ir(cfg["body"])
            y = dsp.fft_convolve(x, h, circular=circ)
            x = y if circ else y[:, : self.n]
        if cfg.get("eq"):
            fns = cfg["eq"]
            x = dsp.filt(x, lambda f: np.prod([fn(f) for fn in fns], axis=0), circular=circ)
        if cfg.get("trem"):
            rate, depth = cfg["trem"]
            if self.loop:
                per = self.loop / SR
                rate = max(1, round(rate * per)) / per
            t = np.arange(self.n) / SR
            m = depth * np.sin(2 * np.pi * rate * t)
            x = np.stack([x[0] * (1 + m), x[1] * (1 - m)])
        if cfg.get("width"):
            # Расширение: короткая задержка правого канала (эффект Хааса), небольшая.
            d = int(cfg["width"] * SR / 1000)
            x = np.stack([x[0], np.roll(x[1], d) if circ else np.concatenate([np.zeros(d), x[1, :-d]])])
        return x

    def mix(self, report=None):
        s = self.song
        circ = bool(self.loop)
        stems = self.render_notes()
        dry = np.zeros((2, self.n))
        buses = {}
        echo_bus = {}
        levels = {}
        for name, x in stems.items():
            cfg = s.stems.get(name)
            if cfg is None:
                raise KeyError(f"{s.id}: нет настроек для дорожки {name}")
            x = self.process_stem(name, x)
            lu = dsp.loudness(x, circular=circ)
            g = dsp.undb(cfg.get("lufs", -24) - lu) if lu > -90 else 0.0
            x = x * g
            levels[name] = (lu, cfg.get("lufs", -24))
            self.stem_audio[name] = x
            dry += x
            for bus, db in cfg.get("sends", {}).items():
                buses.setdefault(bus, np.zeros((2, self.n)))
                buses[bus] += x * dsp.undb(db)
            if cfg.get("echo"):
                e = cfg["echo"]
                key = (e.get("beats", 0.75), e.get("fb", 0.35), e.get("lp", 3000))
                echo_bus.setdefault(key, np.zeros((2, self.n)))
                echo_bus[key] += x * dsp.undb(e.get("send", -14))
        out = dry.copy()
        for (beats, fb, lp), x in echo_bus.items():
            w = dsp.echo(x, beats * 60.0 / s.bpm, feedback=fb, lp=lp, circular=circ)
            out += w[:, : self.n] if not circ else w
            # эхо тоже уходит в зал
            if "plate" in buses:
                buses["plate"] += (w[:, : self.n] if not circ else w) * 0.5
        for bus, x in buses.items():
            w = dsp.reverb(x, bus, circular=circ)
            out += w[:, : self.n] if not circ else w
        if report is not None:
            report["stems"] = {k: {"raw_lufs": round(v[0], 1), "target": v[1]} for k, v in levels.items()}
        return out

    def master_chain(self, x, target=-16.0, ceiling=-1.0, report=None):
        s = self.song
        circ = bool(self.loop)
        m = s.master
        period = self.loop / SR if circ else None
        y = dsp.tape(x, circular=circ, hicut=m.get("hicut", 11000), wow=m.get("wow", 2.5), seed=s.seed,
                     period=period, drive=m.get("drive", 1.5), mix=m.get("sat", 0.3))
        if m.get("warm"):
            # «Тёплый наклон»: чуть больше нижней середины, чуть меньше 2–3 кГц.
            w = m["warm"]
            y = dsp.filt(y, lambda f: dsp.peak_mag(f, 300, 1.2 * w, 2.0) * dsp.peak_mag(f, 2500, -1.5 * w, 1.6),
                         circular=circ)
        if m.get("air"):
            y = dsp.filt(y, lambda f: dsp.shelf_mag(f, 4500, m["air"]), circular=circ)
        if m.get("eq"):
            fns = m["eq"]
            y = dsp.filt(y, lambda f: np.prod([fn(f) for fn in fns], axis=0), circular=circ)
        y, gcomp = dsp.compress(y, ratio=m.get("ratio", 1.8), attack=0.02, release=0.3, circular=circ,
                                knee=8.0)
        if not circ:
            y = self._shape_ends(y)
        # Нормировка громкости с лимитером: огибающая пиков и K-взвешивание считаются один раз,
        # дальше подбирается усиление (лимитер меняет громкость лишь чуть-чуть).
        pk = dsp.peak_env(y, circular=circ)
        ky = dsp.k_weight(y, circular=circ)
        gain = target - dsp.loudness_kw(ky, circ)
        g = np.ones(y.shape[1])
        for _ in range(5):
            g = dsp.limiter_gain(pk * dsp.undb(gain), ceiling_db=ceiling - 0.2, circular=circ)
            lu2 = dsp.loudness_kw(ky * g * dsp.undb(gain), circ)
            if abs(lu2 - target) < 0.03:
                break
            gain += target - lu2
        z = y * g * dsp.undb(gain)
        # Страховка: точный true-peak после лимитера.
        tp = dsp.true_peak(z, circular=circ)
        if tp > dsp.undb(ceiling):
            z *= dsp.undb(ceiling) / tp
        if report is not None:
            report["comp_gr_max_db"] = round(float(-gcomp.min()), 2)
            report["limiter_gr_max_db"] = round(float(-dsp.todb(g.min())), 2)
            report["limiter_gr_p99_db"] = round(float(-dsp.todb(np.percentile(g, 1))), 2)
        return z

    def _shape_ends(self, y):
        """Мягкое начало и чистое окончание: хвост дозвучивает, затем короткое затухание."""
        s = self.song
        n = y.shape[1]
        fi = int(s.fade_in * SR)
        if fi > 0:
            r = np.linspace(0, 1, fi)
            y[:, :fi] *= (np.sin(r * np.pi / 2) ** 2)
        end = int((s.sec(s.end_beat) + s.tail) * SR)
        end = min(end, n)
        fo = int(s.fade_out * SR)
        r = np.linspace(1, 0, fo)
        y[:, end - fo: end] *= r ** 2
        y[:, end:] = 0
        return y[:, :end]

    def render(self, target=-16.0, ceiling=-1.0):
        rep = {}
        mix = self.mix(rep)
        out = self.master_chain(mix, target, ceiling, rep)
        return out, rep
