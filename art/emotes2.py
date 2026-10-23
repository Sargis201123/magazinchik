"""Ещё эмоции над головой 12×12: часы (долго жду), вздох, «дорого», тревога «!»,
сон «z» и звезда (рекорд). И облачко 16×15, в котором любая эмоция всплывает над головой."""

from sprites import Canvas

P = {
    "k": (24, 20, 37, 255),
    "w": (255, 255, 255, 255),
    "g": (192, 203, 220, 255),
    "b": (156, 216, 255, 255),
    "B": (60, 140, 220, 255),
    "R": (228, 59, 68, 255),
    "Y": (254, 231, 97, 255),
    "O": (247, 118, 34, 255),
    "G": (99, 199, 77, 255),
}

EMOTES = {
    "emo_clock": [
        "...kkkkk....",
        "..kwwwwwk...",
        ".kwwwkwwwk..",
        "kwwwwkwwwwk.",
        "kwwwwkwwwwk.",
        "kwwwwkkkwwk.",
        "kwwwwwwwwwk.",
        "kwwwwwwwwwk.",
        ".kwwwwwwwk..",
        "..kwwwwwk...",
        "...kkkkk....",
        "............",
    ],
    "emo_sigh": [
        "............",
        "......kkk...",
        ".....kbbbk..",
        "..kk.kbwbk..",
        ".kbbkkbbbk..",
        ".kbwbbkkk...",
        ".kbbbbbk....",
        "..kbbbk.....",
        "...kkk......",
        "............",
        "............",
        "............",
    ],
    "emo_pricey": [
        "............",
        "..kkkkkkkk..",
        ".kYYYYYYYYk.",
        "kYwYYRYYYYk.",
        "kYYYRRRYYYk.",
        "kYYRRRRRYYk.",
        "kYYYYRYYYYk.",
        "kYYYYRYYYYk.",
        ".kYYYRYYYYk.",
        "..kkkkkkkk..",
        "............",
        "............",
    ],
    "emo_alert": [
        "....kkk.....",
        "...kRRRk....",
        "...kRwRk....",
        "...kRwRk....",
        "...kRwRk....",
        "...kRRRk....",
        "....kRk.....",
        "....kkk.....",
        "...kRRRk....",
        "...kRwRk....",
        "....kkk.....",
        "............",
    ],
    "emo_zzz": [
        "......kkkkk.",
        "......kgggk.",
        "........kk..",
        ".......kk...",
        "......kgggk.",
        ".kkkk.kkkkk.",
        ".kwwk.......",
        "...kk.......",
        "..kk........",
        ".kwwk.......",
        ".kkkk.......",
        "............",
    ],
    "emo_star": [
        ".....kk.....",
        ".....kYk....",
        "....kYYk....",
        "kkkkkYYkkkk.",
        "kYYYYYYYYYk.",
        ".kYYYwYYYk..",
        "..kYYYYYk...",
        "..kYYkYYk...",
        ".kYYk.kYYk..",
        ".kYk...kYk..",
        ".kk.....kk..",
        "............",
    ],
}


# Белое облачко с хвостиком вниз; нижний ряд в лёгкой тени — облачко выглядит пухлым.
BUBBLE = [
    "..kkkkkkkkkkkk..",
    ".kwwwwwwwwwwwwk.",
    "kwwwwwwwwwwwwwwk",
    "kwwwwwwwwwwwwwwk",
    "kwwwwwwwwwwwwwwk",
    "kwwwwwwwwwwwwwwk",
    "kwwwwwwwwwwwwwwk",
    "kwwwwwwwwwwwwwwk",
    "kwwwwwwwwwwwwwwk",
    "kwwwwwwwwwwwwwwk",
    "kwwwwwwwwwwwwwwk",
    ".kggggggggggggk.",
    "..kkkkkgggkkkk..",
    ".....kggk.......",
    ".....kk.........",
]


def main():
    for name, rows in {**EMOTES, "emo_bubble": BUBBLE}.items():
        c = Canvas(len(rows[0]), len(rows))
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch in P:
                    c.px(x, y, P[ch])
        c.save(name)


if __name__ == "__main__":
    main()
