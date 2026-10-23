"""Партитуры: пять основных пьес (утро, день, вечер, ночная смена, зима) на мотиве «Магазинчик».

Мотив (в до мажоре): затакт C–D, затем A (с опорой) – G – E:  «Ма-га | ЗИН-чик… дзынь».
Сексту вверх на ударном слоге и падение G→E (как дверной колокольчик) узнаём во всех пьесах.
"""

from engine import Song
from patterns import arpeggio, bars_mel, bass_line, comp, drums, melody_pitches, pad, strum
from score import Note, nm

ROOM, PLATE, HALL = "room", "plate", "hall"


def morning():
    """Утро: соль мажор, 80 ударов. Нейлоновая гитара, флейта-окарина, колокольчик, пэд, контрабас."""
    s = Song("morning", bpm=80, meter=4, seed=101, rit=(84, 92, 0.78), tail=5.0, fade_in=2.5)
    s.meta = dict(title="Утро", key="G", mood="светлое, с надеждой, просторное")
    s.progression([
        "Gmaj7", "Cadd9", "Gmaj7", "D7sus4",  # 0–3 вступление
        "G", "D/F#", "Em7", "Cmaj7", "G/B", "Am7", "D7sus4 D7", "G",  # 4–11 A
        "Cmaj7", "Bm7", "Am7", "D7sus4",  # 12–15 B
        "G", "D/F#", "Em7", "Cmaj7",  # 16–19 A'
        "Am7", "D7sus4", "Gadd9",  # 20–22 окончание
    ])
    # Флейта
    bars_mel(s, 4, [
        "E5:1.5 D5:.5 B4:2",
        "r:1 A4:.5 B4:.5 D5:1 A4:1",
        "B4:1.5 G4:.5 E5:2",
        "D5:1 E5:.5 D5:.5 B4:1.5 C5:.5",
        "G5:1.5 F#5:.5 D5:2",
        "E5:1 C5:.5 D5:.5 E5:1 G5:1",
        "G5:1.5 E5:.5 F#5:1 A5:1",
        "G5:3 r:1",
        "E5:1.5 D5:.5 E5:1 G5:1",
        "F#5:2 D5:1 r:1",
        "r:4",
        "C5:1 D5:1 r:1 G4:.5 A4:.5",
        "E5:1.5 D5:.5 B4:2",
        "r:1 A4:.5 B4:.5 D5:1 F#5:1",
        "G5:1.5 F#5:.5 E5:2",
        "D5:1 E5:.5 D5:.5 B4:2",
        "C5:1.5 B4:.5 A4:2",
        "G4:2 A4:2",
        "D5:4",
    ], "flute", vel=0.62, pickup="G4:.5 A4:.5")
    # Колокольчик: ответ в середине, удвоение мотива, последний «дзынь»
    bars_mel(s, 14, ["E6:1.5 D6:.5 B5:2"], "glock", vel=0.5, pickup="G5:.5 A5:.5")
    bars_mel(s, 16, ["E6:1.5 D6:.5 B5:2"], "glock", vel=0.32)
    bars_mel(s, 22, ["E6:1.5 D6:.5 B5:2"], "glock", vel=0.5, pickup="G5:.5 A5:.5")
    # Гитара: перебор восьмыми (бас — средний — верхний — нижний голос)
    pat = [(0, 0, 2), (0.5, 2, 1.5), (1, 3, 1.5), (1.5, 1, 1), (2, 0, 2), (2.5, 2, 1.5), (3, 3, 1), (3.5, 1, 1)]
    arpeggio(s, 0, 22, "guitar", pat, vel=0.55, top=67)
    strum(s, [(88, 7, 0.6, False)], "guitar", spread_ms=45, top=71)
    pad(s, 4, 23, "pad", n=4, lo=55, hi=72, vel=0.45)
    bass_line(s, 8, 22, "upright", style="two", vel=0.6, lo=38, hi=50)
    s.add([Note(88, 6, nm("G2"), 0.6, "upright", "bass")])
    drums(s, 12, 20, {"shaker": "oxoxoxox"}, grid=2)
    s.stems = {
        "guitar": dict(lufs=-21, pan=-0.2, body="nylon", sends={ROOM: -13, PLATE: -22}),
        "flute": dict(lufs=-19, pan=0.12, sends={PLATE: -13}, echo=dict(beats=0.75, send=-21, fb=0.3, lp=2800)),
        "glock": dict(lufs=-24, pan=0.35, sends={PLATE: -11}),
        "pad": dict(lufs=-30, sends={HALL: -9}),
        "upright": dict(lufs=-22.5, pan=0.0, sends={ROOM: -20}),
        "shaker": dict(lufs=-32, pan=0.45, sends={ROOM: -14}),
    }
    return s




def _two_chord_bar(song, bar):
    return sum(1 for a, b, c in song.chords if bar * song.meter <= a < (bar + 1) * song.meter) > 1


def day():
    """День: до мажор, 96 ударов, лёгкий грув со щётками. Вибрафон, электропиано, бас, шейкер."""
    s = Song("day", bpm=96, meter=4, seed=202, swing=0.05, swing_unit=0.5, rit=(110, 116, 0.8), tail=4.5,
             fade_in=1.5)
    s.meta = dict(title="День", key="C", mood="спокойный грув, тёплый полдень")
    A = ["Cmaj7", "Em7 A7", "Dm7", "G7", "Cmaj7", "Em7 A7", "Dm7 G7", "C6"]
    s.progression(["Dm7", "G7"] + A + ["Fmaj7", "Em7", "Dm7", "Cmaj7", "Fmaj7", "Em7 A7", "Dm7", "G7sus4 G7"]
                  + A + ["Fmaj7", "Fm6", "C69"])
    a_mel = [
        "A5:1.5 G5:.5 E5:2",
        "D5:.5 E5:.5 G5:1 G5:.5 E5:.5 C#5:1",
        "D5:1.5 F5:.5 A5:1 C6:1",
        "B5:1.5 A5:.5 G5:1 C5:.5 D5:.5",
        "A5:1.5 G5:.5 E5:1.5 r:.5",
        "B4:.5 D5:.5 E5:.5 G5:.5 A5:1 G5:.5 E5:.5",
        "F5:1.5 E5:.5 D5:1 B4:1",
    ]
    bars_mel(s, 2, a_mel + ["C5:2 r:1 E5:.5 G5:.5"], "vibes", vel=0.62, pickup="C5:.5 D5:.5")
    bars_mel(s, 10, [
        "A5:2 G5:1 E5:1",
        "G5:1.5 E5:.5 B4:2",
        "F5:1 E5:.5 D5:.5 A5:2",
        "G5:2.5 r:.5 C5:.5 D5:.5",
        "A5:1.5 G5:.5 E5:2",
        "D5:1 E5:1 C#5:1 E5:1",
        "F5:1.5 A5:.5 C6:2",
        "C6:1.5 A5:.5 B5:1 C5:.5 D5:.5",
    ], "vibes", vel=0.62)
    bars_mel(s, 18, a_mel + ["C5:2 r:1 C5:.5 D5:.5"], "vibes", vel=0.66)
    bars_mel(s, 26, ["A5:1.5 G5:.5 E5:2", "Ab5:2 F5:1 D5:1", "E5:4"], "vibes", vel=0.6)
    # Колокольчик удваивает мотив в репризе
    bars_mel(s, 18, ["A6:1.5 G6:.5 E6:2"], "glock", vel=0.3)
    bars_mel(s, 22, ["A6:1.5 G6:.5 E6:2"], "glock", vel=0.3)
    bars_mel(s, 28, ["A6:1.5 G6:.5 E6:2"], "glock", vel=0.35, pickup="C6:.5 D6:.5")

    def rh(bar):
        if _two_chord_bar(s, bar):
            return [(0, 1.0, 0.85), (1.5, 0.5, 0.55), (2, 1.0, 0.8), (3.5, 0.5, 0.5)]
        return [(0, 1.5, 0.85), (1.5, 0.5, 0.55), (2.5, 1.5, 0.75)] if bar % 2 == 0 else \
            [(0, 0.75, 0.8), (0.75, 1.0, 0.55), (2.5, 0.5, 0.6), (3, 1.0, 0.7)]

    comp(s, 0, 26, "epiano", None, n=4, lo=50, hi=70, vel=0.6, per_bar=rh)
    comp(s, 26, 29, "epiano", [(0, 4, 0.8)], n=4, lo=50, hi=70, vel=0.55)
    s.add([Note(112, 6, nm("C4"), 0.4, "epiano", "chord", sound=1.0)])
    bass_line(s, 1, 28, "ebass", style="dayfunk", vel=0.7, lo=36, hi=50)
    s.add([Note(112, 5, nm("C2"), 0.65, "ebass", "bass")])
    strum(s, [(b * 4 + o, 0.4, 0.5, o == 1.5) for b in range(10, 26) for o in (1.5, 3.5)], "guitar", spread_ms=9,
          top=67, n_up=3, skip_bass=True, mute=0.5)
    pad(s, 10, 18, "pad", n=4, lo=55, hi=72, vel=0.4)
    pad(s, 26, 29, "pad", n=4, lo=55, hi=72, vel=0.4)
    drums(s, 0, 26, {"shaker": "o-x-o-x-o-x-o-x-"}, grid=4)
    drums(s, 0, 26, {"kick": "x.......x.....o."}, grid=4)
    drums(s, 2, 26, {"tap": ["....x..o....x...", "....x..o....x.o."], "swishl": "x.......x......."}, grid=4)
    drums(s, 26, 28, {"swishl": "x.......x.......", "tap": "....o.......o..."}, grid=4)
    s.add([Note(112, 1, 0, 0.5, "swishl", "drum")])
    s.stems = {
        "vibes": dict(lufs=-19, pan=0.12, sends={PLATE: -14, ROOM: -18}),
        "glock": dict(lufs=-27, pan=0.35, sends={PLATE: -12}),
        "epiano": dict(lufs=-21, pan=-0.15, trem=(4.2, 0.12), sends={ROOM: -15, PLATE: -22}),
        "ebass": dict(lufs=-21.5, sends={ROOM: -24}),
        "guitar": dict(lufs=-26, pan=0.45, body="nylon", sends={ROOM: -14}),
        "pad": dict(lufs=-31, sends={HALL: -9}),
        "kick": dict(lufs=-28, sends={ROOM: -22}),
        "tap": dict(lufs=-28, pan=-0.1, sends={ROOM: -12}),
        "swishl": dict(lufs=-33, pan=-0.1, sends={ROOM: -12}),
        "shaker": dict(lufs=-31.5, pan=0.5, sends={ROOM: -14}),
    }
    return s


def evening():
    """Вечер: фа мажор, 72 удара, медленный свинг. Электропиано с тремоло, флюгельгорн, контрабас, щётки."""
    s = Song("evening", bpm=72, meter=4, seed=303, swing=0.13, rit=(76, 84, 0.75), tail=5.5, fade_in=2.0)
    s.meta = dict(title="Вечер", key="F", mood="тёплый, неторопливый, джазовые аккорды")
    s.progression([
        "Gm9", "C13",
        "Fmaj9", "Dm9", "Gm9", "C13", "Am7", "D7b9", "Gm9", "C7sus4 C7",
        "Fmaj9", "F9", "Bbmaj7", "Bbm6", "Am7", "D7", "Gm7 C7", "F69",
        "Bbmaj7", "Bbm6", "Fmaj9",
    ])
    bars_mel(s, 2, [
        "D6:1.5 C6:.5 A5:2",
        "C6:1 A5:.5 F5:.5 E5:2",
        "r:.5 D5:.5 F5:.5 A5:.5 Bb5:1.5 A5:.5",
        "G5:1.5 E5:.5 D5:1 F5:.5 G5:.5",
        "D6:1.5 C6:.5 A5:2",
        "r:.5 F#5:.5 A5:.5 C6:.5 Eb6:1.5 D6:.5",
        "D6:1 Bb5:.5 A5:.5 G5:2",
        "F5:2 E5:1 r:1",
    ], "epiano", vel=0.62, pickup="F5:.5 G5:.5", stem="epmel")
    bars_mel(s, 10, [
        "D5:1.5 C5:.5 A4:2",
        "Eb5:1.5 D5:.5 C5:2",
        "D5:2 F5:1 A4:1",
        "Db5:2 Bb4:1 G4:1",
        "C5:1.5 A4:.5 E5:2",
        "D5:1 C5:.5 A4:.5 F#4:2",
        "Bb4:1.5 A4:.5 G4:1 E4:1",
        "A4:3 r:1",
    ], "flugel", vel=0.6, pickup="F4:.5 G4:.5")
    bars_mel(s, 18, ["D6:1.5 C6:.5 A5:2", "Db6:1.5 C6:.5 Bb5:1 G5:1", "A5:4"], "epiano", vel=0.6,
             pickup="F5:.5 G5:.5", stem="epmel")
    comp(s, 0, 2, "epiano", [(0, 4, 0.7)], n=4, lo=50, hi=67, vel=0.6, roll_ms=25)
    comp(s, 2, 10, "epiano", None, n=4, lo=48, hi=65, vel=0.55, roll_ms=12,
         per_bar=lambda b: [(0, 2, 0.75), (2, 2, 0.6)] if _two_chord_bar(s, b) else [(0, 2.5, 0.75), (2.5, 1.5, 0.5)])
    comp(s, 10, 18, "epiano", None, n=4, lo=48, hi=64, vel=0.55, roll_ms=12,
         per_bar=lambda b: [(0, 2, 0.75), (2, 2, 0.6)] if _two_chord_bar(s, b) else [(0, 1.5, 0.7), (1.5, 2.5, 0.55)])
    comp(s, 18, 21, "epiano", [(0, 4, 0.7)], n=4, lo=48, hi=65, vel=0.55, roll_ms=30)
    arpeggio(s, 10, 17, "guitar", [(0, 0, 2), (1, 1, 1.5), (1.5, 2, 1.5), (2, 3, 2)], vel=0.42, top=64, lo_bass=41,
             ring=1.3)
    pad(s, 10, 21, "pad", n=4, lo=53, hi=70, vel=0.4)
    bass_line(s, 2, 10, "upright", style="two", vel=0.62, lo=36, hi=50)
    bass_line(s, 10, 17, "upright", style="walk", vel=0.6, lo=36, hi=50)
    bass_line(s, 17, 20, "upright", style="long", vel=0.6, lo=36, hi=50)
    s.add([Note(80, 6, nm("F2"), 0.6, "upright", "bass")])
    drums(s, 2, 18, {"swishl": "x...x...x...x...", "tap": "....o.......o...", "kick": "o.......o......."}, grid=4)
    drums(s, 18, 20, {"swishl": "x.......x......."}, grid=4)
    s.stems = {
        "epmel": dict(lufs=-19, pan=0.05, trem=(3.6, 0.18), sends={PLATE: -13, ROOM: -18},
                      echo=dict(beats=0.75, send=-24, fb=0.25, lp=2500)),
        "flugel": dict(lufs=-19, pan=0.1, sends={PLATE: -12, ROOM: -16}),
        "epiano": dict(lufs=-22, pan=-0.12, trem=(3.6, 0.22), sends={ROOM: -15, PLATE: -20}),
        "guitar": dict(lufs=-27, pan=-0.4, body="nylon", sends={ROOM: -13}),
        "pad": dict(lufs=-31, sends={HALL: -9}),
        "upright": dict(lufs=-22, sends={ROOM: -20}),
        "swishl": dict(lufs=-32, pan=-0.15, sends={ROOM: -12}),
        "tap": dict(lufs=-31, pan=-0.1, sends={ROOM: -12}),
        "kick": dict(lufs=-33, sends={ROOM: -20}),
    }
    return s


def night():
    """Ночная смена: ми-бемоль мажор, 60 ударов. Тихое электропиано, пэд, челеста с эхом, часы."""
    s = Song("night", bpm=60, meter=4, seed=404, rit=(60, 68, 0.8), tail=6.0, fade_in=3.0)
    s.meta = dict(title="Ночная смена", key="Eb", mood="тихо, редко, мягко")
    s.progression([
        "Ebmaj9", "Abmaj9", "Ebmaj9", "Abmaj9",
        "Cm9", "Abmaj7", "Fm9", "Bb13sus",
        "Ebmaj9", "Gm7", "Abmaj7", "Abm6",
        "Ebmaj9/G", "Abmaj9", "Fm9", "Bb7sus4",
        "Ebmaj9",
    ])
    bars_mel(s, 2, ["C6:1.5 Bb5:.5 G5:2"], "celesta", vel=0.55, pickup="Eb5:.5 F5:.5")
    bars_mel(s, 8, ["C6:1.5 Bb5:.5 G5:2"], "celesta", vel=0.5, pickup="Eb5:.5 F5:.5")
    bars_mel(s, 16, ["C6:1.5 Bb5:.5 G5:2"], "celesta", vel=0.55, pickup="Eb5:.5 F5:.5")
    bars_mel(s, 3, [
        "r:1 Eb5:1 G5:1 Bb5:1",
        "G5:2 Eb5:2",
        "C5:3 r:1",
        "Ab5:2 G5:1 F5:1",
        "Eb5:2 C5:1 r:1",
        "r:4",
        "Bb5:2 F5:2",
        "Eb5:1 G5:1 C6:2",
        "B5:2 Ab5:1 r:1",
        "Bb5:3 r:1",
        "C6:1.5 Bb5:.5 G5:2",
        "Ab5:2 G5:2",
        "F5:2 Eb5:1 r:1",
    ], "epiano", vel=0.5, stem="epmel")
    comp(s, 0, 16, "epiano", None, n=4, lo=46, hi=63, vel=0.45, roll_ms=22,
         per_bar=lambda b: [(0, 4, 0.7)] if b % 2 == 0 else [(0, 2.5, 0.65), (2.5, 1.5, 0.45)])
    comp(s, 16, 17, "epiano", [(0, 6, 0.6)], n=4, lo=46, hi=63, vel=0.45, roll_ms=40)
    pad(s, 0, 17, "pad", n=4, lo=51, hi=70, vel=0.42, attack=1.6, rel=2.2)
    bass_line(s, 4, 16, "upright", style="long", vel=0.5, lo=36, hi=48)
    s.add([Note(64, 6, nm("Eb2"), 0.5, "upright", "bass")])
    drums(s, 4, 12, {"tick_h": "x...x...x...x...", "tick_l": "..x...x...x...x."}, grid=4)
    drums(s, 8, 16, {"swishl": "x.......x......."}, grid=4)
    s.stems = {
        "epmel": dict(lufs=-20, pan=0.08, trem=(3.0, 0.2), sends={PLATE: -11}),
        "celesta": dict(lufs=-21, pan=0.3, sends={PLATE: -10, HALL: -14}, echo=dict(beats=0.75, send=-15, fb=0.4, lp=2600)),
        "epiano": dict(lufs=-22, pan=-0.12, trem=(3.0, 0.25), sends={ROOM: -14, HALL: -18}),
        "pad": dict(lufs=-27, sends={HALL: -7}),
        "upright": dict(lufs=-24, sends={ROOM: -18}),
        "tick_h": dict(lufs=-41, pan=0.55, sends={ROOM: -10}),
        "tick_l": dict(lufs=-41, pan=0.55, sends={ROOM: -10}),
        "swishl": dict(lufs=-37, pan=-0.2, sends={ROOM: -10}),
    }
    s.master = dict(air=1.5)
    return s


def winter():
    """Зима/Новый год: ре мажор, вальс 3/4, 144 удара. Челеста, колокольчик, бубенцы, струнный пэд, пиццикато."""
    s = Song("winter", bpm=144, meter=3, seed=505, rit=(138, 144, 0.7), tail=6.0, fade_in=2.0)
    s.meta = dict(title="Зима", key="D", mood="снег, огни, вальс")
    s.progression([
        "D", "Gmaj7", "D", "A7",
        "D", "D", "F#m", "F#m", "G", "G", "A7", "A7", "Bm", "Bm", "G", "Gm6", "D/A", "A7", "D", "D",
        "G", "A", "F#m7", "Bm", "Em7", "A7", "Dmaj7", "D7", "G", "Gm6", "D/F#", "B7", "Em7", "A7", "D", "A7",
        "D", "D", "F#m", "F#m", "G", "Gm6", "A7", "D",
        "G", "Gm6", "D", "D",
    ])
    A = [
        "B5:1.5 A5:.5 F#5:1", "A5:2 D5:1", "C#6:1.5 B5:.5 A5:1", "F#5:2 D5:.5 E5:.5",
        "B5:1.5 A5:.5 G5:1", "D6:2 B5:1", "C#6:1.5 B5:.5 A5:1", "G5:1 E5:1 C#5:1",
        "D5:1.5 E5:.5 F#5:1", "B5:2 A5:1", "B5:1.5 A5:.5 G5:1", "Bb5:2 G5:1",
        "A5:1.5 F#5:.5 D5:1", "E5:1 G5:1 C#5:1", "D5:3", "r:2 D5:.5 E5:.5",
    ]
    B = [
        "B5:1.5 A5:.5 F#5:1", "A5:2 E5:1", "C#6:1.5 B5:.5 A5:1", "F#5:2 D5:.5 E5:.5",
        "B5:1.5 A5:.5 G5:1", "A5:1 G5:1 E5:1", "F#5:3", "r:1 A5:1 C6:1",
        "B5:2 D6:1", "Bb5:2 G5:1", "A5:1.5 F#5:.5 D5:1", "D#5:2 F#5:1",
        "G5:1.5 F#5:.5 E5:1", "C#5:1.5 E5:.5 G5:1", "F#5:3", "r:2 D5:.5 E5:.5",
    ]
    A2 = [
        "B5:1.5 A5:.5 F#5:1", "A5:2 D5:1", "C#6:1.5 B5:.5 A5:1", "F#5:2 D5:.5 E5:.5",
        "B5:1.5 A5:.5 F#5:1", "Bb5:1.5 A5:.5 G5:1", "E5:1.5 F#5:.5 G5:1", "F#5:2 D5:.5 E5:.5",
        "B5:1.5 A5:.5 F#5:1", "Bb5:2 G5:1", "A5:3", "D6:3",
    ]
    bars_mel(s, 4, A + B + A2, "celesta", vel=0.62, pickup="D5:.5 E5:.5")
    glock = []
    for b in B[:8]:
        glock.append(" ".join(_oct(t, 1) for t in b.split()))
    bars_mel(s, 20, glock, "glock", vel=0.28)
    bars_mel(s, 44, [" ".join(_oct(t, 1) for t in A2[8].split())], "glock", vel=0.32)
    # Вальс: бас на раз, аккорды на два-три
    bass_line(s, 4, 47, "upright", style="waltz", vel=0.6, lo=38, hi=52)
    s.add([Note(141, 4, nm("D2"), 0.55, "upright", "bass")])
    comp(s, 4, 46, "epiano", [(1, 0.6, 0.6), (2, 0.6, 0.5)], n=3, lo=55, hi=69, vel=0.5, roll_ms=4)
    comp(s, 46, 48, "epiano", [(0, 3, 0.6)], n=4, lo=52, hi=69, vel=0.45, roll_ms=30)
    arpeggio(s, 0, 4, "harp", [(0, 0, 3), (0.5, 1, 2.5), (1, 2, 2), (1.5, 3, 2), (2, 2, 1), (2.5, 1, 1)], vel=0.5,
             lo_bass=50, hi_bass=62, top=79, ring=1.2)
    pad(s, 4, 48, "strings", n=4, lo=55, hi=74, vel=0.45)
    drums(s, 4, 44, {"sleigh": "x.o.o."}, grid=2)
    drums(s, 20, 36, {"sleigh": "..x.x."}, grid=2)
    # Снежинки: редкие высокие звоночки — только звуки текущего аккорда
    import numpy as np
    rng = np.random.default_rng(7)
    for bar in range(6, 44, 2):
        beat = bar * 3 + float(rng.choice([0.5, 1.5]))
        ch = s.chord_at(beat)
        busy = melody_pitches(s, beat, beat + 0.5, min_dur=0.25)
        cands = [84 + (pc - 84) % 12 for pc in ch.tones[:3]]
        cands = [c for c in cands if all(abs(c - b) % 12 != 1 for b in busy)] or cands
        p = cands[int(rng.integers(0, len(cands)))]
        s.add([Note(beat, 0.5, p, float(rng.uniform(0.2, 0.35)), "musicbox", "fx", pan=float(rng.uniform(-0.6, 0.6)))])
    s.add([Note(141, 6, nm("D4"), 0.55, "bell", "fx")])
    s.stems = {
        "celesta": dict(lufs=-19.5, pan=0.08, sends={PLATE: -11}, echo=dict(beats=1.5, send=-24, fb=0.3, lp=3000)),
        "glock": dict(lufs=-28, pan=0.35, sends={PLATE: -12}),
        "epiano": dict(lufs=-22.5, pan=-0.2, sends={ROOM: -14}),
        "harp": dict(lufs=-23, pan=-0.1, sends={PLATE: -12}),
        "strings": dict(lufs=-25, sends={HALL: -8}),
        "upright": dict(lufs=-23, sends={ROOM: -18}),
        "sleigh": dict(lufs=-31, pan=0.5, sends={ROOM: -12}),
        "musicbox": dict(lufs=-30, sends={PLATE: -9}),
        "bell": dict(lufs=-24, pan=-0.1, sends={HALL: -8}),
    }
    s.master = dict(warm=1.5)
    return s


def _oct(tok, k):
    """'B5:1.5' -> 'B6:1.5' (на k октав выше); паузы как есть."""
    if tok.startswith("r:"):
        return tok
    n, d = tok.split(":")
    return f"{n[:-1]}{int(n[-1]) + k}:{d}"


SONGS = {
    "morning": morning,
    "day": day,
    "evening": evening,
    "night": night,
    "winter": winter,
}
