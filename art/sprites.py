"""Пиксельная графика «Магазинчика».

Все спрайты рисуются этим скриптом из пиксельных карт и простых фигур в одной
палитре — графика целиком своя, без чужих лицензий. Запуск:

    python3 art/sprites.py

Результат — PNG в public/assets/. Белые и светло-серые части спрайтов людей
перекрашиваются в игре тинтом (цвет кожи, одежды, волос), тени при этом сохраняются.
"""

from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "public" / "assets"

# Палитра в духе Endesga 32: тёплая, контрастная, хорошо читается на телефоне.
PALETTE = {
    ".": None,
    "k": "#181425",  # контур
    "K": "#262b44",
    "g": "#3a4466",
    "G": "#5a6988",
    "l": "#8b9bb4",
    "W": "#c0cbdc",
    "w": "#ffffff",
    "b": "#733e39",
    "B": "#b86f50",
    "n": "#e4a672",
    "N": "#ead4aa",
    "r": "#a22633",
    "R": "#e43b44",
    "o": "#f77622",
    "y": "#feae34",
    "Y": "#fee761",
    "d": "#265c42",
    "e": "#3e8948",
    "E": "#63c74d",
    "u": "#124e89",
    "U": "#0099db",
    "c": "#2ce8f5",
    "p": "#68386c",
    "P": "#b55088",
    "s": "#f6757a",
    "m": "#9e2835",
    "t": "#c28569",  # тёмная кожура картошки
    "a": "#8f563b",
    "z": "#4a3b52",  # стены здания
}


def rgba(ch):
    hex_ = PALETTE[ch]
    if hex_ is None:
        return (0, 0, 0, 0)
    return (int(hex_[1:3], 16), int(hex_[3:5], 16), int(hex_[5:7], 16), 255)


class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.img = Image.new("RGBA", (w, h), (0, 0, 0, 0))

    def px(self, x, y, ch):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.img.putpixel((x, y), rgba(ch))

    def rect(self, x, y, w, h, ch):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.px(xx, yy, ch)

    def frame(self, x, y, w, h, ch):
        for xx in range(x, x + w):
            self.px(xx, y, ch)
            self.px(xx, y + h - 1, ch)
        for yy in range(y, y + h):
            self.px(x, yy, ch)
            self.px(x + w - 1, yy, ch)

    def stamp(self, rows, x=0, y=0):
        for dy, row in enumerate(rows):
            for dx, ch in enumerate(row):
                if ch != ".":
                    self.px(x + dx, y + dy, ch)

    def save(self, name):
        OUT.mkdir(parents=True, exist_ok=True)
        self.img.save(OUT / f"{name}.png")


def from_rows(name, rows):
    width = len(rows[0])
    assert all(len(r) == width for r in rows), f"{name}: строки разной длины"
    c = Canvas(width, len(rows))
    c.stamp(rows)
    c.save(name)
    return c


# ---------------------------------------------------------------- пол и стены


def floor():
    """Плитка 16×16: четыре тёплых квадрата с затиркой и бликом."""
    c = Canvas(16, 16)
    c.rect(0, 0, 16, 16, "N")
    for ox, oy, tone in ((0, 0, "N"), (8, 8, "N"), (8, 0, "n"), (0, 8, "n")):
        c.rect(ox, oy, 8, 8, tone)
        c.px(ox + 1, oy + 1, "w" if tone == "N" else "N")
    for i in range(16):
        c.px(i, 0, "B")
        c.px(0, i, "B")
        c.px(i, 8, "B")
        c.px(8, i, "B")
    c.save("floor")


def wall():
    """Задняя стена 16×32: краска, полоса молдинга и плинтус."""
    c = Canvas(16, 32)
    c.rect(0, 0, 16, 32, "l")
    c.rect(0, 0, 16, 2, "G")
    c.rect(0, 2, 16, 1, "W")
    for x in range(0, 16, 8):
        c.rect(x, 4, 1, 16, "W")
    c.rect(0, 20, 16, 1, "W")
    c.rect(0, 21, 16, 7, "G")
    for x in range(1, 16, 4):
        c.frame(x, 22, 3, 5, "g")
    c.rect(0, 28, 16, 4, "K")
    c.rect(0, 28, 16, 1, "g")
    c.save("wall")


def concrete():
    """Пол склада: бетон с пятнами."""
    c = Canvas(16, 16)
    c.rect(0, 0, 16, 16, "l")
    for x, y in ((3, 4), (11, 2), (7, 11), (13, 13), (2, 13)):
        c.px(x, y, "G")
    for x, y in ((5, 7), (12, 9)):
        c.px(x, y, "W")
    c.rect(0, 15, 16, 1, "G")
    c.rect(15, 0, 1, 16, "G")
    c.save("concrete")


def asphalt():
    c = Canvas(16, 16)
    c.rect(0, 0, 16, 16, "K")
    for x, y in ((2, 3), (9, 6), (13, 12), (5, 13), (11, 1)):
        c.px(x, y, "g")
    c.px(7, 9, "G")
    c.save("asphalt")


def lot():
    """Пустырь «Сдаётся»: утоптанная земля с травой."""
    c = Canvas(16, 16)
    c.rect(0, 0, 16, 16, "a")
    for x, y in ((2, 2), (10, 4), (5, 9), (13, 11), (8, 14)):
        c.px(x, y, "b")
    for x, y in ((4, 5), (12, 8), (1, 12), (9, 1)):
        c.px(x, y, "e")
        c.px(x, y - 1, "E")
    c.save("lot")


# ---------------------------------------------------------------- мебель


def shelf():
    """Хлебный стеллаж 40×26: дерево, две полки с задней стенкой."""
    c = Canvas(40, 26)
    c.rect(0, 0, 40, 26, "B")
    c.frame(0, 0, 40, 26, "k")
    c.rect(1, 1, 38, 1, "n")
    for top in (3, 14):
        c.rect(2, top, 36, 8, "b")
        c.rect(2, top, 36, 1, "a")
        c.rect(2, top + 8, 36, 2, "n")
        c.rect(2, top + 9, 36, 1, "B")
    c.rect(1, 1, 1, 24, "n")
    c.rect(38, 1, 1, 24, "a")
    c.save("shelf")


def stand():
    """Овощной прилавок 40×26: зелёная рама и деревянные ящики."""
    c = Canvas(40, 26)
    c.rect(0, 0, 40, 26, "e")
    c.frame(0, 0, 40, 26, "k")
    c.rect(1, 1, 38, 1, "E")
    for top in (3, 14):
        for x in (2, 14, 26):
            c.rect(x, top, 12, 9, "B")
            c.frame(x, top, 12, 9, "b")
            c.rect(x + 1, top + 1, 10, 1, "n")
        c.rect(2, top + 9, 36, 1, "d")
    c.rect(38, 1, 1, 24, "d")
    c.save("stand")


def fridge():
    """Холодильник-витрина 40×26: нейтрально-светлый, цвет задаётся тинтом в игре."""
    c = Canvas(40, 26)
    c.rect(0, 0, 40, 26, "W")
    c.frame(0, 0, 40, 26, "g")
    c.rect(1, 1, 38, 1, "w")
    for top in (3, 14):
        c.rect(2, top, 36, 8, "l")
        c.rect(2, top, 36, 1, "w")
        c.rect(2, top + 8, 36, 2, "W")
        c.rect(2, top + 9, 36, 1, "G")
        # блики на стекле
        c.px(5, top + 2, "w")
        c.px(6, top + 3, "w")
        c.px(30, top + 2, "w")
    c.rect(38, 1, 1, 24, "l")
    c.save("fridge")


def counter():
    """Касса боком 16×52: стойка, лента, терминал с экраном."""
    c = Canvas(16, 52)
    c.rect(0, 0, 16, 52, "G")
    c.frame(0, 0, 16, 52, "k")
    c.rect(1, 1, 14, 1, "l")
    c.rect(1, 1, 1, 50, "l")
    # лента
    c.rect(3, 3, 10, 30, "k")
    for y in range(5, 33, 4):
        c.rect(3, y, 10, 1, "K")
    c.rect(3, 3, 10, 1, "g")
    # терминал
    c.rect(4, 36, 9, 12, "K")
    c.frame(4, 36, 9, 12, "k")
    c.rect(6, 38, 5, 4, "E")
    c.px(6, 38, "Y")
    c.rect(6, 44, 5, 2, "g")
    c.px(7, 44, "l")
    c.px(9, 44, "l")
    c.save("counter")


def wc():
    """Дверь туалета 16×24 с табличкой."""
    c = Canvas(16, 24)
    c.rect(0, 0, 16, 24, "z")
    c.rect(2, 2, 12, 22, "W")
    c.rect(2, 2, 12, 1, "w")
    c.rect(13, 2, 1, 22, "l")
    c.rect(4, 4, 8, 6, "w")
    c.frame(4, 4, 8, 6, "g")
    c.stamp(["U.R", "U.R", "U.R"], 6, 5)
    c.px(7, 5, "k")
    c.rect(11, 13, 2, 2, "y")
    c.save("wc")


def door():
    """Вход 32×8: стеклянные двери и коврик."""
    c = Canvas(32, 8)
    c.rect(0, 0, 32, 8, "g")
    c.rect(1, 1, 14, 3, "c")
    c.rect(17, 1, 14, 3, "c")
    c.rect(1, 1, 14, 1, "w")
    c.rect(17, 1, 14, 1, "w")
    c.rect(15, 0, 2, 4, "k")
    c.rect(2, 4, 28, 4, "r")
    c.rect(3, 5, 26, 2, "R")
    c.save("door")


def box():
    """Коробка на складе 8×7 (цвет наклейки — товар, задаётся тинтом)."""
    from_rows(
        "box",
        [
            "kkkkkkkk",
            "knnNNnnk",
            "kBBNNBBk",
            "kBwwwwBk",
            "kBwwwwBk",
            "kbBBBBbk",
            "kkkkkkkk",
        ],
    )


def trash():
    from_rows(
        "trash",
        [
            "..kk..",
            ".kwWk.",
            "kwWwlk",
            ".kllk.",
            "..kk..",
        ],
    )


def items():
    """Товар на полке, 3×4 — у каждого товара своя форма."""
    shapes = {
        "item_bread": ["nnn", "BnB", "BBB", "bBb"],
        "item_apples": [".e.", "RRw", "RRR", "rRr"],
        "item_potatoes": ["...", "tnt", "nBt", "aBa"],
        "item_milk": ["UUw", "www", "wUw", "WWW"],
        "item_meat": ["...", "RsR", "Rws", "mRm"],
    }
    for name, rows in shapes.items():
        from_rows(name, rows)


# ---------------------------------------------------------------- люди

# Человек 12×18 из слоёв: кожа (голова и кисти), волосы, рубашка, штаны.
# Белые пиксели перекрашиваются тинтом, контур и глаза остаются тёмными.

SKIN = [
    "............",
    "....kkkk....",
    "...kwwwwk...",
    "..kwwwwwwk..",
    "..kwkwwkwk..",
    "..kwwwwwwk..",
    "...kwwwwk...",
    "....kwwk....",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    ".kw......wk.",
    "..k......k..",
    "............",
    "............",
]

HAIR = {
    "short": [
        "....kkkk....",
        "...kwwwwk...",
        "..kwwwwwwk..",
        "..kw....wk..",
    ],
    "long": [
        "....kkkk....",
        "...kwwwwk...",
        "..kwwwwwwk..",
        "..kw....wk..",
        "..kw....wk..",
        "..kw....wk..",
        "..kw....wk..",
    ],
    "bun": [
        "....kkkk....",
        "...kwwwwk...",
        "...kwwwwk...",
        "..kwwwwwwk..",
        "..kw....wk..",
    ],
    "cap": [
        "...kkkkkk...",
        "..kwwwwwwk..",
        "..kwwYwwwk..",
        ".kkkkkkkkkk.",
    ],
    "bald": [],
}

SHIRT = [
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "............",
    "...kkwwkk...",
    "..kwwwwwwk..",
    ".kwwwwwwwwk.",
    ".kwWwwwwWwk.",
    ".kwkwwwwkwk.",
    ".kWkwWWwkWk.",
    "............",
    "............",
    "............",
    "............",
]

LEGS = [
    [
        "....kwwk....",
        "...kwwwwk...",
        "...kwkkwk...",
        "...kk..kk...",
    ],
    [
        "....kwwk....",
        "...kwwwk....",
        "..kwk.kwk...",
        "..kk...kk...",
    ],
]


def people():
    from_rows("p_skin", SKIN)
    for style, rows in HAIR.items():
        c = Canvas(12, 18)
        c.stamp(rows, 0, 1)
        c.save(f"p_hair_{style}")
    from_rows("p_shirt", SHIRT)
    for i, rows in enumerate(LEGS):
        c = Canvas(12, 18)
        c.stamp(rows, 0, 14)
        c.save(f"p_legs{i}")


# ---------------------------------------------------------------- декор


def decor():
    from_rows(
        "plant",
        [
            "....e.e.....",
            "..e.EeE.e...",
            ".eEeEEeEe...",
            "..EeEeEEe.e.",
            ".eEEeEeEEe..",
            "..eEEeEEe...",
            "...eEeEe....",
            "....kdk.....",
            "...kBBBBk...",
            "...kBnnBk...",
            "...kBBBBk...",
            "....kbbk....",
        ],
    )
    from_rows(
        "poster",
        [
            "kkkkkkkkkkkk",
            "kYYYYYYYYYYk",
            "kYRRRYYYYYYk",
            "kYRwRYoooYYk",
            "kYRRRYYYYYYk",
            "kYYYYYooooYk",
            "kYooYYYYYYYk",
            "kYYYYYYRRYYk",
            "kkkkkkkkkkkk",
        ],
    )
    from_rows(
        "baskets",
        [
            ".kkkkkkkk.",
            "kRRRRRRRRk",
            "kRwRwRwRRk",
            "kmRRRRRRmk",
            ".kRRRRRRk.",
            ".kmmmmmmk.",
            "..kkkkkk..",
        ],
    )


# ---------------------------------------------------------------- мелочи


def ui_bits():
    from_rows(
        "bubble",
        [
            "..www..",
            ".wwwww.",
            "wwwwwww",
            "wwwwwww",
            "wwwwwww",
            ".wwwww.",
            "..www..",
        ],
    )
    from_rows("pip", ["YY", "yy"])
    c = Canvas(1, 1)
    c.px(0, 0, "w")
    c.save("bar")


def main():
    floor()
    wall()
    concrete()
    asphalt()
    lot()
    shelf()
    stand()
    fridge()
    counter()
    wc()
    door()
    box()
    trash()
    items()
    people()
    decor()
    ui_bits()
    print("готово:", sorted(p.name for p in OUT.glob("*.png")))


if __name__ == "__main__":
    main()
