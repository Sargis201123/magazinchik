"""Радиоволны магазина: четыре пьесы-петли (40–50 с), играют по кругу без шва.

Длина петли — целое число тактов и целое число отсчётов при 48 кГц; всё, что звучит за концом
(хвосты нот, реверб, эхо), заворачивается в начало — поэтому стык неслышен.
"""

from engine import Song
from patterns import bars_mel, bass_line, comp, drums, harmony_below, pad, strum
from score import Note
from tracks import HALL, PLATE, ROOM, _two_chord_bar


def retro():
    """Ретро: фа мажор, медленный свинг 100. Кларнет, вибрафон, гитара «четвертями», шагающий контрабас, щётки."""
    s = Song("radio_retro", bpm=100, meter=4, swing=0.15, loop_beats=80, seed=611)
    s.meta = dict(title="Радио «Ретро»", key="F", mood="медленный свинг, танцплощадка в парке")
    s.progression([
        "F6", "D7", "Gm7", "C7", "Am7 D7", "Gm7 C7", "F6 D7", "Gm7 C7",
        "F6", "F7", "Bbmaj7", "Bbm6", "Am7 D7", "Gm7 C7", "F6", "F6",
        "Am7 D7", "Gm7 C7", "Am7 D7", "Gm7 C7",
    ])
    bars_mel(s, 0, [
        "D6:1.5 C6:.5 A5:2",
        "r:.5 F#5:.5 A5:.5 C6:.5 B5:1 A5:1",
        "Bb5:1.5 A5:.5 G5:1 D5:1",
        "E5:1 G5:1 Bb5:1.5 A5:.5",
        "C6:1.5 A5:.5 F#5:1 A5:1",
        "Bb5:1 G5:1 E5:1 C5:1",
        "F5:2 F#5:1 A5:1",
        "Bb5:1 A5:1 G5:1 F5:.5 G5:.5",
        "D6:1.5 C6:.5 A5:2",
        "r:.5 A5:.5 C6:.5 Eb6:.5 D6:1 C6:1",
        "D6:1.5 C6:.5 A5:2",
        "Db6:1.5 C6:.5 Bb5:1 G5:1",
        "A5:1.5 G5:.5 F#5:1 D5:1",
        "Bb5:1.5 A5:.5 G5:1 E5:1",
        "F5:3 r:1",
        None, None, None,
        "E5:1.5 G5:.5 F#5:1 A5:1",
        "Bb5:1.5 A5:.5 G5:1 F5:.5 G5:.5",
    ], "clarinet", vel=0.66)
    # Вибрафон отвечает мотивом в «хвосте» формы
    bars_mel(s, 16, ["D6:1.5 C6:.5 A5:2", "Bb5:1 A5:1 G5:1 E5:1"], "vibes", vel=0.62, pickup="F5:.5 G5:.5")
    comp(s, 8, 14, "vibes", None, n=3, lo=57, hi=70, vel=0.4, role="chord", stem="vibcomp",
         per_bar=lambda b: [(0, 1.5, 0.7), (2, 1.5, 0.6)] if _two_chord_bar(s, b) else [(0, 3, 0.7)])
    # Гитара «четвертями» (как в биг-бэнде): короткие удары, акцент на 2 и 4
    strum(s, [(b * 4 + k, 0.45, 0.5 if k % 2 == 0 else 0.62, True) for b in range(20) for k in range(4)], "archtop",
          spread_ms=6, lo_bass=40, hi_bass=52, top=64, n_up=2, mute=0.3)
    bass_line(s, 0, 20, "upright", style="walk", vel=0.65, lo=36, hi=50)
    drums(s, 0, 20, {"tap": "o.xoo.xo", "swishl": "x...x...", "kick": "o.o.o.o."}, grid=2)
    s.stems = {
        "clarinet": dict(lufs=-19, pan=0.1, sends={PLATE: -13, ROOM: -17}),
        "vibes": dict(lufs=-21, pan=-0.3, sends={PLATE: -12}),
        "vibcomp": dict(lufs=-28, pan=-0.35, sends={PLATE: -12}),
        "archtop": dict(lufs=-25, pan=0.35, body="steel", sends={ROOM: -12}),
        "upright": dict(lufs=-21, sends={ROOM: -18}),
        "tap": dict(lufs=-28, pan=-0.15, sends={ROOM: -12}),
        "swishl": dict(lufs=-32, pan=-0.15, sends={ROOM: -12}),
        "kick": dict(lufs=-37, sends={ROOM: -20}),
    }
    s.master = dict(hicut=10000, wow=3.0, warm=1.5)
    return s


def hits():
    """Хиты: ля мажор, 120, бодрый поп. Мягкий лид, колокольчик в припеве, электропиано, бас, ударные."""
    s = Song("radio_hits", bpm=120, meter=4, swing=0.03, swing_unit=0.5, loop_beats=96, seed=622)
    s.meta = dict(title="Радио «Хиты»", key="A", mood="бодрый поп, солнечно")
    s.progression([
        "F#m7", "Dmaj7", "A", "E", "F#m7", "Dmaj7", "A", "E",
        "Dmaj7", "E", "C#m7", "F#m7", "Dmaj7", "E", "A", "A",
        "Bm7", "C#m7", "Dmaj7", "E", "Bm7", "C#m7", "D", "Esus4 E",
    ])
    verse = [
        "F#5:1.5 E5:.5 C#5:2",
        "r:1 D5:.5 E5:.5 F#5:1 A5:1",
        "E5:2 C#5:1 B4:1",
        "B4:2 G#4:1 A4:.5 B4:.5",
        "F#5:1.5 E5:.5 C#5:2",
        "r:1 A5:.5 F#5:.5 E5:1 D5:1",
        "C#5:1.5 E5:.5 A5:2",
        "G#5:1 F#5:1 E5:1 A4:.5 B4:.5",
    ]
    chorus = [
        "F#5:1.5 E5:.5 C#5:2",
        "r:.5 B4:.5 C#5:.5 E5:.5 B5:2",
        "G#5:1.5 F#5:.5 E5:2",
        "C#5:1 E5:1 F#5:1 A5:1",
        "F#5:1.5 E5:.5 C#5:2",
        "B4:1 E5:1 G#5:1 B5:1",
        "A5:3 r:1",
        "r:2 C#5:.5 E5:.5 F#5:.5 A5:.5",
    ]
    bridge = [
        "B5:2 A5:1 F#5:1",
        "G#5:2 E5:1 C#5:1",
        "F#5:1.5 E5:.5 D5:1 C#5:1",
        "B4:3 r:1",
        "D5:1.5 E5:.5 F#5:2",
        "E5:1.5 F#5:.5 G#5:2",
        "A5:2 F#5:2",
        "E5:2 r:1 A4:.5 B4:.5",
    ]
    bars_mel(s, 0, verse + chorus + bridge, "lead", vel=0.66)
    bars_mel(s, 8, [" ".join(_up(t) for t in b.split()) for b in chorus], "glock", vel=0.3)
    # Электропиано: в куплете — «вторые доли», в припеве — длинные аккорды
    comp(s, 0, 8, "epiano", [(0.5, 0.45, 0.75), (1.5, 0.45, 0.6), (2.5, 0.45, 0.75), (3.5, 0.45, 0.6)], n=4,
         lo=52, hi=69, vel=0.6)
    comp(s, 8, 16, "epiano", None, n=4, lo=52, hi=69, vel=0.55,
         per_bar=lambda b: [(0, 1.5, 0.8), (1.5, 2.5, 0.6)])
    comp(s, 16, 24, "epiano", None, n=4, lo=52, hi=69, vel=0.55,
         per_bar=lambda b: [(0, 2, 0.75), (2, 2, 0.65)] if _two_chord_bar(s, b) else [(0, 0.75, 0.75), (0.75, 1.25, 0.6), (2.5, 1.5, 0.7)])
    strum(s, [(b * 4 + k * 0.5, 0.45, 0.55 if k % 2 == 0 else 0.4, k % 2 == 0) for b in range(8, 16) for k in range(8)],
          "steel", spread_ms=8, top=71, n_up=4, skip_bass=True, mute=0.4)
    pad(s, 8, 24, "pad", n=4, lo=57, hi=74, vel=0.42)
    bass_line(s, 0, 24, "ebass", style="pop8", vel=0.68, lo=33, hi=47)
    drums(s, 0, 24, {"kick": "x.....x.x......."}, grid=4)
    drums(s, 0, 24, {"clap": "....x.......x...", "hat": "x.o.x.o.x.o.x.o."}, grid=4)
    drums(s, 8, 16, {"ohat": "..............x."}, grid=4)
    drums(s, 16, 24, {"shaker": "o-x-o-x-o-x-o-x-"}, grid=4)
    drums(s, 8, 9, {"crash": "x..............."}, grid=4)
    drums(s, 16, 17, {"crash": "o..............."}, grid=4)
    s.stems = {
        "lead": dict(lufs=-19, pan=0.05, sends={PLATE: -15}, echo=dict(beats=0.75, send=-20, fb=0.3, lp=3000)),
        "glock": dict(lufs=-26, pan=0.3, sends={PLATE: -12}),
        "epiano": dict(lufs=-22, pan=-0.2, sends={ROOM: -15}),
        "steel": dict(lufs=-25, pan=0.45, body="steel", sends={ROOM: -14}),
        "pad": dict(lufs=-30, sends={HALL: -10}),
        "ebass": dict(lufs=-20.5, sends={ROOM: -26}),
        "kick": dict(lufs=-23.5, sends={ROOM: -24}),
        "clap": dict(lufs=-25.5, pan=0.05, sends={PLATE: -14}),
        "hat": dict(lufs=-30, pan=0.35, sends={ROOM: -18}),
        "ohat": dict(lufs=-33, pan=0.35, sends={ROOM: -16}),
        "shaker": dict(lufs=-32, pan=-0.4, sends={ROOM: -14}),
        "crash": dict(lufs=-31, pan=-0.25, sends={ROOM: -14}),
    }
    return s


def _up(tok, k=1):
    if tok.startswith("r:"):
        return tok
    n, d = tok.split(":")
    mods = ""
    return f"{n[:-1]}{int(n[-1]) + k}:{d}{mods}"


def samba():
    """Самба: фа мажор, 2/4, 120. Медь в терцию, кавакиньо, сурдо, тамборим, ганза, агого, свисток."""
    s = Song("radio_samba", bpm=120, meter=2, swing=0.025, swing_unit=0.5, loop_beats=96, seed=633)
    s.meta = dict(title="Радио «Самба»", key="F", mood="карнавал, улица, жарко")
    A = ["F6", "F6", "D7", "D7", "Gm7", "Gm7", "C7", "C7", "F6", "F6", "F7", "F7", "Bb6", "Bbm6", "F6", "C7"]
    B = ["Bb6", "Bb6", "Bbm6", "Bbm6", "Am7", "Am7", "D7", "D7", "Gm7", "Gm7", "C7", "C7", "Am7", "D7", "Gm7", "C7"]
    C = ["F6", "F6", "D7", "D7", "Gm7", "Gm7", "C7", "C7", "F6", "F6", "D7", "D7", "Gm7", "Gm7", "C7", "C7"]
    s.progression(A + B + C)
    melA = [
        "D6:.75 C6:.25 A5:1", "C6:.5 A5:.25 F5:.75 G5:.5",
        "F#5:.75 A5:.25 C6:1", "B5:.5 A5:.5 F#5:.5 D5:.5",
        "Bb5:.75 A5:.25 G5:1", "D5:.5 F5:.5 A5:.5 Bb5:.5",
        "G5:.75 E5:.25 C5:1", "r:1 F5:.5 G5:.5",
    ]
    melA2 = [
        "D6:.75 C6:.25 A5:1", "C6:.5 D6:.5 C6:.5 A5:.5",
        "Eb6:.75 D6:.25 C6:1", "A5:.5 C6:.5 Eb6:.5 D6:.5",
        "D6:.75 C6:.25 Bb5:1", "Db6:.75 C6:.25 Bb5:.5 G5:.5",
        "A5:.75 G5:.25 F5:1", "r:1 F5:.5 G5:.5",
    ]
    melB = [
        "D5:.75 F5:.25 G5:1", "Bb5:1.5 A5:.5",
        "Db6:.75 C6:.25 Bb5:1", "G5:1 F5:1",
        "E5:.75 G5:.25 C6:1", "A5:1 G5:.5 E5:.5",
        "F#5:.75 A5:.25 C6:1", "B5:.5 A5:.5 F#5:1",
        "Bb5:.75 A5:.25 G5:1", "F5:.5 D5:.5 F5:.5 A5:.5",
        "G5:1 Bb5:1", "E5:1 r:.5 G5:.5",
        "C6:.75 A5:.25 E5:1", "F#5:.75 A5:.25 D6:1",
        "Bb5:.75 A5:.25 G5:1", "E5:1 F5:.5 G5:.5",
    ]
    melC = [
        "D6:.75 C6:.25 A5:1", "r:2",
        "C6:.75 A5:.25 F#5:1", "r:2",
        "Bb5:.75 A5:.25 G5:1", "r:2",
        "G5:.75 E5:.25 C5:1", "r:1 F5:.5 G5:.5",
    ]
    lead = bars_mel(s, 0, melA + melA2 + melB + melC + melA, "brass", vel=0.62, vib=6.0)
    harmony_below(s, lead, "brass", vel_mul=0.82, stem="brass2", vib=6.0)
    bars_mel(s, 16, melB, "flute", vel=0.5, stem="flute")
    # Кавакиньо: синкопированный бой шестнадцатыми
    cav = []
    for b in range(48):
        for off, v, dn in ((0, 0.75, True), (0.5, 0.5, False), (0.75, 0.62, True), (1.25, 0.6, False), (1.5, 0.5, True)):
            cav.append((b * 2 + off, 0.22, v, dn))
    strum(s, cav, "cavaco", spread_ms=5, lo_bass=50, hi_bass=62, top=76, n_up=3, skip_bass=True, mute=0.6)
    bass_line(s, 0, 48, "ebass", style="samba", vel=0.7, lo=33, hi=47)
    drums(s, 0, 48, {
        "surdo_m": "x.......",
        "surdo": "....X...",
        "caixa": "x-ox-ox-",
        "ganza": "xooox-oo",
        "tamb": ["x.xx.x.x", ".x.x.xx."],
        "agogo_h": ["x...x...", "x.x....."],
        "agogo_l": ["..x....x", "....x.x."],
    }, grid=4)
    drums(s, 32, 40, {"apito": ["........", "x.x.X...", "........", "........"],
                      "cuica_u": ["........", "........", "....x...", "........"],
                      "cuica_d": ["........", "........", "......x.", "........"]}, grid=4)
    s.stems = {
        "brass": dict(lufs=-19.5, pan=0.12, sends={PLATE: -14, ROOM: -16}),
        "brass2": dict(lufs=-23, pan=-0.12, sends={PLATE: -14, ROOM: -16}),
        "flute": dict(lufs=-25, pan=0.35, sends={PLATE: -12}),
        "cavaco": dict(lufs=-24, pan=-0.35, body="steel", sends={ROOM: -14}),
        "ebass": dict(lufs=-21.5, sends={ROOM: -26}),
        "surdo": dict(lufs=-23.5, sends={ROOM: -16}),
        "surdo_m": dict(lufs=-28, sends={ROOM: -16}),
        "caixa": dict(lufs=-30, pan=0.2, sends={ROOM: -14}),
        "ganza": dict(lufs=-30, pan=0.45, sends={ROOM: -14}),
        "tamb": dict(lufs=-27, pan=-0.3, sends={ROOM: -12}),
        "agogo_h": dict(lufs=-29, pan=0.4, sends={ROOM: -12}),
        "agogo_l": dict(lufs=-29, pan=0.4, sends={ROOM: -12}),
        "apito": dict(lufs=-30, pan=-0.45, sends={ROOM: -10}),
        "cuica_u": dict(lufs=-29, pan=0.25, sends={ROOM: -12}),
        "cuica_d": dict(lufs=-29, pan=0.25, sends={ROOM: -12}),
    }
    s.master = dict(warm=1.5)
    return s


def march():
    """Марш: си-бемоль мажор, 2/4, 120. Корнеты, валторны на слабые доли, туба, колокольчики, барабаны."""
    s = Song("radio_march", bpm=120, meter=2, loop_beats=96, seed=644)
    s.meta = dict(title="Радио «Марш»", key="Bb", mood="духовой оркестр на параде")
    s.progression([
        "Bb", "Bb", "F7", "F7",
        "Bb", "Bb", "F7", "F7", "F7", "F7", "Bb", "Bb", "Bb", "Bb7", "Eb", "Ebm6", "Bb/F", "F7", "Bb", "F7",
        "Eb", "Eb", "Bb7", "Bb7", "Bb7", "Bb7", "Eb", "Eb", "Eb", "Eb7", "Ab", "Abm6", "Eb/Bb", "Bb7", "Eb", "Eb",
        "Bb", "Gm", "Cm7", "F7", "Bb", "Eb", "F7", "Bb",
        "F7", "F7", "F7", "F7",
    ])
    intro = ["Bb4:.5 D5:.25 F5:.25 Bb5:1", "F5:.5 D5:.5 Bb4:1", "A4:.5 C5:.25 F5:.25 A5:1", "Eb5:1 Bb4:.5 C5:.5"]
    A = [
        "G5:.75 F5:.25 D5:1", "Bb4:.5 D5:.5 F5:.5 G5:.5", "A5:.75 G5:.25 F5:1", "C5:1 Eb5:1",
        "D5:.75 C5:.25 A4:1", "Eb5:1 Bb4:.5 C5:.5", "G5:.75 F5:.25 D5:1", "Bb5:1 F5:1",
        "D6:.75 C6:.25 Bb5:1", "Ab5:1 F5:.5 D5:.5", "G5:.75 F5:.25 Eb5:1", "Gb5:1 Eb5:1",
        "F5:.75 D5:.25 Bb4:1", "C5:.75 Eb5:.25 A4:1", "Bb4:1.5 r:.5", "r:1 Eb5:.5 F5:.5",
    ]
    trio = [
        "C5:.75 Bb4:.25 G4:1", "G4:.5 Bb4:.5 Eb5:1", "D5:.75 C5:.25 Bb4:1", "Ab4:1 F4:1",
        "F4:.5 Ab4:.5 D5:.5 C5:.5", "Bb4:1 Eb4:.5 F4:.5", "C5:.75 Bb4:.25 G4:1", "Bb4:1.5 G4:.5",
        "Eb5:.75 D5:.25 C5:1", "Db5:1 Bb4:1", "C5:.75 Bb4:.25 Ab4:1", "B4:1 Ab4:1",
        "G4:.75 F4:.25 Eb4:1", "F4:1 Ab4:1", "Eb4:1.5 r:.5", "r:1 Bb4:.5 C5:.5",
    ]
    ret = ["G5:.75 F5:.25 D5:1", "Bb5:.75 A5:.25 G5:1", "Eb5:.75 D5:.25 C5:1", "A4:.5 C5:.5 Eb5:.5 F5:.5",
           "D6:.75 C6:.25 Bb5:1", "G5:.75 F5:.25 Eb5:1", "C5:.5 Eb5:.5 A5:.5 C6:.5", "Bb5:1.5 r:.5"]
    cor = bars_mel(s, 0, intro + A, "brass", vel=0.66, vib=0.0, scoop=10)
    cor += bars_mel(s, 36, ret, "brass", vel=0.68, vib=0.0, scoop=10)
    harmony_below(s, cor, "brass", vel_mul=0.85, stem="brass2", vib=0.0, scoop=10)
    bars_mel(s, 20, trio, "horn", vel=0.7, stem="hornmel")
    bars_mel(s, 4, [" ".join(_up(t) for t in b.split()) for b in A[:14]] + [None, None], "glock", vel=0.3)
    bars_mel(s, 36, [" ".join(_up(t) for t in b.split()) for b in ret], "glock", vel=0.3)
    # Валторны «на после-доли», туба «ум-па»
    comp(s, 0, 48, "horn", [(0.5, 0.3, 0.85), (1.5, 0.3, 0.75)], n=3, lo=53, hi=67, vel=0.55, roll_ms=3)
    bass_line(s, 0, 44, "tuba", style="oompah", vel=0.7, lo=34, hi=48)
    s.add([Note(88 + k, 0.6, 41 if k % 2 == 0 else 36, 0.7, "tuba", "bass") for k in range(8)])
    drums(s, 0, 48, {"fsnare": ["x-o-x-oo", "x-o-xxo-"], "bdrum": "X...x..."}, grid=4)
    drums(s, 18, 19, {"fsnare": "xxxxxxxx"}, grid=4)
    drums(s, 34, 35, {"fsnare": "xxxxxxxx"}, grid=4)
    drums(s, 44, 48, {"fsnare": ["x-x-x-x-", "xxx-xxx-", "x-x-x-x-", "xxxxxxxx"]}, grid=4)
    for b in (0, 4, 20, 36):
        drums(s, b, b + 1, {"cymbals": "x......."}, grid=4)
    s.stems = {
        "brass": dict(lufs=-19.5, pan=0.15, sends={HALL: -16, ROOM: -15}),
        "brass2": dict(lufs=-23, pan=-0.1, sends={HALL: -16, ROOM: -15}),
        "hornmel": dict(lufs=-19.5, pan=0.05, sends={HALL: -14, ROOM: -15}),
        "glock": dict(lufs=-26, pan=0.4, sends={HALL: -14}),
        "horn": dict(lufs=-25, pan=-0.3, sends={HALL: -14, ROOM: -15}),
        "tuba": dict(lufs=-21.5, pan=0.0, sends={ROOM: -18}),
        "fsnare": dict(lufs=-27, pan=-0.15, sends={ROOM: -12}),
        "bdrum": dict(lufs=-25, sends={ROOM: -14}),
        "cymbals": dict(lufs=-31, pan=0.3, sends={ROOM: -12}),
    }
    return s


SONGS = {
    "radio_retro": retro,
    "radio_hits": hits,
    "radio_samba": samba,
    "radio_march": march,
}

