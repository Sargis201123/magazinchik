"""Короткие музыкальные заставки (0.5–3 с): все построены на мотиве «Магазинчик» (C D | A G E)
или его частях.

Частые заставки, которые звучат поверх музыки (монетка, покупка, рекорд, звание), есть во всех
тональностях фоновых пьес и радио (C, G, F, Eb, D, A, Bb): игра берёт вариант в тональности
текущей музыки (см. stingerKeys в манифесте) — иначе ми у монетки бьётся с ми-бемолем ночи.
Остальные — в до мажоре; под ними музыку стоит приглушить (duck в манифесте).

Громкость (интегральная): частые и короткие — тише (монетка −18, покупка −18.5 LUFS),
торжественные — −14, остальные −15…−16.
"""

from functools import partial

from engine import Song
from patterns import comp, harmony_below
from score import Note, chord, mel, nm
from tracks import HALL, PLATE, ROOM

KEYS = ["C", "G", "F", "Eb", "D", "A", "Bb"]
_PC = {"C": 0, "D": 2, "Eb": 3, "F": 5, "G": 7, "A": 9, "Bb": 10}
_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
# Сдвиг выбирается ближе к исходному регистру: звонкие заставки — в пределах −5…+6 полутонов,
# медь (звание) — −7…+4, чтобы фанфара не уходила в писк.
_RANGE = {"bright": (-5, 6), "brass": (-7, 4)}


def shift_for(key, kind="bright"):
    lo, hi = _RANGE[kind]
    k = _PC[key]
    for c in (k, k - 12):
        if lo <= c <= hi:
            return c
    return k


def transpose_sym(sym, k, flats):
    """Транспонирует символ аккорда («Cmaj9», «D/F#») на k полутонов."""
    import re
    names = _FLAT if flats else _SHARP

    def tr(note):
        return names[(nm(note + "4") + k) % 12]

    m = re.fullmatch(r"([A-G][#b]?)([a-z0-9#]*)(?:/([A-G][#b]?))?", sym)
    r, q, b = m.groups()
    return tr(r) + q + (("/" + tr(b)) if b else "")


def in_key(song, key, kind="bright"):
    """Переносит готовую заставку (написанную в до мажоре) в тональность key."""
    if key == "C":
        return song
    k = shift_for(key, kind)
    flats = key in ("F", "Bb", "Eb")
    for n in song.notes:
        if n.pitch > 0:
            n.pitch += k
    song.chords = [(a, b, chord(transpose_sym(c.sym, k, flats))) for a, b, c in song.chords]
    song.id = f"{song.id}_{key}"
    song.meta = dict(song.meta, key=key, baseKey="C", transpose=k)
    return song


def _st(sid, bpm, title, chords, tail=1.6, fade_out=0.5, meter=4, seed=0, lufs=-15.0):
    s = Song(sid, bpm=bpm, meter=meter, seed=seed, tail=tail, fade_in=0.0, lufs=lufs)
    s.fade_out = fade_out
    s.meta = dict(title=title, key="C")
    for a, b, c in chords:
        s.chords.append((a, b, chord(c)))
    return s


def day_open():
    s = _st("sting_day_open", 132, "Открытие дня", [(0, 1.25, "C69"), (1.25, 6, "C69")], seed=901, lufs=-15)
    s.add(mel("C5:.25 D5:.25 A5:.5 G5:.25 E5:2", 0, inst="celesta", vel=0.7))
    s.add([Note(1.25, 0.4, nm("G6"), 0.55, "doorbell", "fx"), Note(1.6, 2.5, nm("E6"), 0.5, "doorbell", "fx")])
    comp(s, 0, 1, "epiano", [(1.25, 3, 0.75)], n=5, lo=48, hi=67, vel=0.6, roll_ms=18)
    s.add([Note(1.25, 3, nm("C2"), 0.6, "upright", "bass")])
    s.stems = {
        "celesta": dict(lufs=-17, pan=0.0, sends={PLATE: -11}),
        "doorbell": dict(lufs=-20, pan=0.15, sends={PLATE: -10}),
        "epiano": dict(lufs=-20, pan=-0.15, sends={ROOM: -14}),
        "upright": dict(lufs=-22, sends={ROOM: -18}),
    }
    return s


def day_close():
    s = _st("sting_day_close", 112, "Итоги дня", [(0, 2, "Fmaj7"), (2, 8, "C69")], tail=2.0, fade_out=0.8, seed=902,
            lufs=-15)
    s.add(mel("C5:.5 D5:.5 A5:1 G5:.5 E5:2.5", 0, inst="epiano", vel=0.6, stem="epmel"))
    comp(s, 0, 1, "epiano", [(0, 2, 0.7), (2, 3, 0.65)], n=4, lo=48, hi=64, vel=0.6, roll_ms=15)
    s.add([Note(0, 2, nm("F2"), 0.55, "upright", "bass"), Note(2, 3, nm("C2"), 0.6, "upright", "bass")])
    s.add([Note(0, 2, p, 0.4, "pad", "pad") for p in (nm("A3"), nm("C4"), nm("E4"))])
    s.add([Note(2, 3, p, 0.4, "pad", "pad") for p in (nm("G3"), nm("C4"), nm("D4"))])
    s.stems = {
        "epmel": dict(lufs=-16.5, pan=0.05, trem=(3.6, 0.15), sends={PLATE: -12}),
        "epiano": dict(lufs=-20, pan=-0.1, trem=(3.6, 0.2), sends={ROOM: -14}),
        "upright": dict(lufs=-21, sends={ROOM: -18}),
        "pad": dict(lufs=-26, sends={HALL: -9}),
    }
    return s


def record(key="C"):
    s = _st("sting_record", 150, "Новый рекорд", [(0, 8, "Cmaj9")], tail=1.8, seed=903, lufs=-14)
    run = "C5:.25 E5:.25 G5:.25 C6:.25 E6:.25 G6:2"
    s.add(mel(run, 0, inst="glock", vel=0.6))
    s.add(mel(run.replace("G6:2", "G6:.5"), 0, inst="harp", vel=0.6, transpose=-12))
    comp(s, 0, 1, "epiano", [(1.25, 2.5, 0.7)], n=5, lo=55, hi=74, vel=0.6, roll_ms=10)
    s.add([Note(1.25, 2.5, nm("C3"), 0.6, "upright", "bass"), Note(1.25, 1, 0, 0.7, "sleigh", "drum")])
    s.stems = {
        "glock": dict(lufs=-17, pan=0.05, sends={PLATE: -10}),
        "harp": dict(lufs=-21, pan=-0.15, sends={PLATE: -12}),
        "epiano": dict(lufs=-20, pan=-0.05, sends={ROOM: -14}),
        "upright": dict(lufs=-23, sends={ROOM: -18}),
        "sleigh": dict(lufs=-27, pan=0.2, sends={ROOM: -10}),
    }
    return in_key(s, key)


def rank_up(key="C"):
    s = _st("sting_rank_up", 132, "Новое звание", [(0, 1, "G7sus4"), (1, 2, "Fadd9"), (2, 8, "C")], tail=2.0,
            seed=904, lufs=-14)
    lead = mel("C5:.5 D5:.5 A5:.75 G5:.25 C6:2.5", 0, inst="brass", vel=0.72, vib=5.0)
    s.add(lead)
    harmony_below(s, lead, "brass", vel_mul=0.85, stem="brass2", vib=5.0)
    s.add([Note(2, 2.5, p, 0.6, "horn", "chord") for p in (nm("E4"), nm("G4"), nm("C4"))])
    s.add([Note(2, 2.5, nm("C3"), 0.7, "tuba", "bass")])
    s.add([Note(k * 0.125, 0.125, 0, 0.25 + 0.05 * k, "fsnare", "drum") for k in range(8)])
    s.add([Note(2, 1, 0, 0.8, "bdrum", "drum"), Note(2, 1, 0, 0.6, "cymbals", "drum")])
    s.stems = {
        "brass": dict(lufs=-17, pan=0.05, sends={HALL: -14, ROOM: -15}),
        "brass2": dict(lufs=-21, pan=-0.1, sends={HALL: -14, ROOM: -15}),
        "horn": dict(lufs=-22, pan=-0.15, sends={HALL: -13}),
        "tuba": dict(lufs=-21, sends={ROOM: -16}),
        "fsnare": dict(lufs=-25, pan=-0.1, sends={ROOM: -12}),
        "bdrum": dict(lufs=-22, sends={ROOM: -14}),
        "cymbals": dict(lufs=-27, pan=0.2, sends={ROOM: -12}),
    }
    return in_key(s, key, "brass")


def purchase(key="C"):
    s = _st("sting_purchase", 160, "Покупка", [(0, 8, "C")], tail=2.2, fade_out=0.8, seed=905, lufs=-18.5)
    s.add([Note(0, 0.5, 0, 0.8, "pop", "drum")])
    s.add(mel("G5:.25 C6:.25 E6:2", 0.25, inst="glock", vel=0.62))
    s.add(mel("G4:.25 C5:.25 E5:1.5", 0.25, inst="celesta", vel=0.5))
    s.stems = {
        "pop": dict(lufs=-19, sends={ROOM: -14}),
        "glock": dict(lufs=-17, pan=0.08, sends={PLATE: -10}),
        "celesta": dict(lufs=-21, pan=-0.08, sends={PLATE: -11}),
    }
    return in_key(s, key)


def story():
    s = _st("sting_story", 80, "Сюжетный момент", [(0, 8, "Fmaj9")], tail=2.2, fade_out=1.0, seed=906, lufs=-16)
    s.add([Note(0, 3.5, p, 0.5, "pad", "pad", params=dict(attack=0.8, rel=1.5))
           for p in (nm("F3"), nm("C4"), nm("E4"), nm("G4"))])
    s.add(mel("C5:.5 D5:.5 A5:2.5", 1, inst="celesta", vel=0.62))
    s.add([Note(2, 2.5, nm("A6"), 0.25, "musicbox", "fx")])
    s.add([Note(0, 3.5, nm("F2"), 0.45, "upright", "bass")])
    s.stems = {
        "pad": dict(lufs=-20, sends={HALL: -8}),
        "celesta": dict(lufs=-17, pan=0.0, sends={PLATE: -10},
                        echo=dict(beats=0.75, send=-18, fb=0.35, lp=2800)),
        "musicbox": dict(lufs=-25, pan=-0.2, sends={PLATE: -9}),
        "upright": dict(lufs=-24, sends={ROOM: -16}),
    }
    return s


def expand():
    s = _st("sting_expand", 120, "Расширение магазина", [(0, 8, "C69")], tail=2.2, fade_out=0.9, seed=907, lufs=-14)
    s.add([Note(0, 2, 0, 0.8, "whoosh", "drum")])
    gl = "C4 D4 E4 G4 A4 C5 D5 E5 G5 A5 C6 D6 E6 G6".split()
    s.add([Note(1 + i * 0.0625, 1.5, nm(p), 0.45 + 0.02 * i, "harp", "chord") for i, p in enumerate(gl)])
    s.add([Note(2, 3, nm("C5"), 0.55, "bell", "fx")])
    s.add([Note(2, 3, p, 0.55, "pad", "pad") for p in (nm("C4"), nm("E4"), nm("G4"), nm("D5"))])
    s.add(mel("A6:.5 G6:.5 E6:2", 2, inst="glock", vel=0.45))
    s.add([Note(2, 3, nm("C2"), 0.6, "upright", "bass")])
    s.stems = {
        "whoosh": dict(lufs=-24, sends={HALL: -10}),
        "harp": dict(lufs=-19, pan=-0.1, sends={PLATE: -10}),
        "bell": dict(lufs=-20, pan=0.0, sends={HALL: -8}),
        "pad": dict(lufs=-22, sends={HALL: -9}),
        "glock": dict(lufs=-21, pan=0.1, sends={PLATE: -10}),
        "upright": dict(lufs=-23, sends={ROOM: -16}),
    }
    return s


def fail():
    s = _st("sting_fail", 100, "Мягкая неудача", [(0, 1, "C"), (1, 2, "Fm6"), (2, 8, "C")], tail=1.8,
            fade_out=0.8, seed=908, lufs=-16)
    s.add(mel("G5:.5 E5:.5 D5:.5 C5:2", 0, inst="vibes", vel=0.55))
    s.add([Note(0, 1, p, 0.5, "epiano", "chord") for p in (nm("E4"), nm("G4"), nm("C4"))])
    s.add([Note(1, 1, p, 0.5, "epiano", "chord") for p in (nm("Ab3"), nm("C4"), nm("F4"))])
    s.add([Note(2, 2.5, p, 0.45, "epiano", "chord") for p in (nm("G3"), nm("C4"), nm("E4"))])
    s.add([Note(0, 1, nm("C3"), 0.5, "upright", "bass"), Note(1, 1, nm("F2"), 0.5, "upright", "bass"),
           Note(2, 2.5, nm("C2"), 0.5, "upright", "bass")])
    s.stems = {
        "vibes": dict(lufs=-17, pan=0.05, sends={PLATE: -12}),
        "epiano": dict(lufs=-20, pan=-0.1, trem=(3.6, 0.2), sends={ROOM: -14}),
        "upright": dict(lufs=-22, sends={ROOM: -18}),
    }
    return s


def coin(key="C"):
    s = _st("sting_coin", 120, "Монетка", [(0, 4, "C")], tail=1.3, fade_out=0.4, seed=909, lufs=-18)
    s.add([Note(0, 0.12, nm("E6"), 0.6, "coin", "fx"), Note(0.13, 1.2, nm("C7"), 0.7, "coin", "fx")])
    s.add([Note(0.13, 0.5, 0, 0.35, "sleigh", "drum")])
    s.stems = {
        "coin": dict(lufs=-15, pan=0.0, sends={PLATE: -14}),
        "sleigh": dict(lufs=-26, pan=0.1, sends={ROOM: -12}),
    }
    return in_key(s, key)


BASE = {
    "sting_day_open": day_open,
    "sting_day_close": day_close,
    "sting_record": record,
    "sting_rank_up": rank_up,
    "sting_purchase": purchase,
    "sting_story": story,
    "sting_expand": expand,
    "sting_fail": fail,
    "sting_coin": coin,
}
KEYED = ("sting_coin", "sting_purchase", "sting_record", "sting_rank_up")
# Под этими (до мажор, звучат реже) музыку приглушить на время заставки.
DUCK_DB = {"sting_day_open": -8, "sting_day_close": -8, "sting_story": -8, "sting_expand": -8, "sting_fail": -8}

SONGS = dict(BASE)
for _sid in KEYED:
    for _k in KEYS[1:]:
        SONGS[f"{_sid}_{_k}"] = partial(BASE[_sid], key=_k)
