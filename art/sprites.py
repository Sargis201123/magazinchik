"""Пиксельная графика «Магазинчика».

Все спрайты рисуются этим скриптом из пиксельных карт и простых фигур в одной
палитре — графика целиком своя, без чужих лицензий. Запуск:

    python3 art/sprites.py

Результат — PNG в public/assets/. Спрайты нарисованы с двойной детализацией
(DETAIL = 2): в игре каждый вдвое меньше своих пикселей, поэтому у людей есть лица,
у мебели — объём и блики, а товар на полке узнаётся.

Белые и серые части спрайтов людей и холодильника перекрашиваются в игре тинтом
(цвет кожи, одежды, волос): тинт умножается на цвет, поэтому серые тени сохраняются.
"""

import random
from pathlib import Path

from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "public" / "assets"

# Во сколько раз пикселей в спрайте больше, чем точек мира. Должно совпадать с ART в StoreScene.
DETAIL = 2

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
    "t": "#c28569",
    "a": "#8f563b",
    "z": "#4a3b52",  # стены здания
    "x": "#3b2a35",  # тёмное дерево
    # Спокойные тона пола: соседние плитки почти одного цвета, чтобы зал не рябил.
    "F": "#f1ddb6",
    "f": "#e7cc9f",
    "q": "#f8ebcf",
    "Q": "#d8b88a",
    "v": "#c49a6c",
    # Оттенки для слоёв под тинт: белый — основной цвет, серые — тени.
    "1": "#ffffff",
    "2": "#dadada",
    "3": "#b8b8b8",
    "4": "#8e8e8e",
    "5": "#ffc4bc",  # румянец (умножится на цвет кожи)
    "6": "#c48878",  # рот
}


def rgba(ch, alpha=255):
    if isinstance(ch, tuple):
        return ch
    hex_ = PALETTE[ch]
    if hex_ is None:
        return (0, 0, 0, 0)
    return (int(hex_[1:3], 16), int(hex_[3:5], 16), int(hex_[5:7], 16), alpha)


class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.img = Image.new("RGBA", (w, h), (0, 0, 0, 0))

    def px(self, x, y, ch):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.img.putpixel((x, y), rgba(ch))

    def get(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.img.getpixel((x, y))
        return (0, 0, 0, 0)

    def rect(self, x, y, w, h, ch):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.px(xx, yy, ch)

    def hline(self, x, y, w, ch):
        self.rect(x, y, w, 1, ch)

    def vline(self, x, y, h, ch):
        self.rect(x, y, 1, h, ch)

    def frame(self, x, y, w, h, ch):
        self.hline(x, y, w, ch)
        self.hline(x, y + h - 1, w, ch)
        self.vline(x, y, h, ch)
        self.vline(x + w - 1, y, h, ch)

    def round_rect(self, x, y, w, h, ch, r=1):
        """Прямоугольник со срезанными углами."""
        for yy in range(h):
            inset = max(0, r - yy, r - (h - 1 - yy))
            self.hline(x + inset, y + yy, w - 2 * inset, ch)

    def ellipse(self, cx, cy, rx, ry, ch):
        for yy in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for xx in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((xx + 0.5 - cx) / rx) ** 2 + ((yy + 0.5 - cy) / ry) ** 2 <= 1:
                    self.px(xx, yy, ch)

    def stamp(self, rows, x=0, y=0):
        for dy, row in enumerate(rows):
            for dx, ch in enumerate(row):
                if ch != ".":
                    self.px(x + dx, y + dy, ch)

    def speckle(self, x, y, w, h, colors, count, seed):
        rnd = random.Random(seed)
        for _ in range(count):
            self.px(x + rnd.randrange(w), y + rnd.randrange(h), rnd.choice(colors))

    def outline(self, ch="k"):
        """Контур вокруг всех непрозрачных пикселей (по 4 соседям)."""
        solid = {(x, y) for y in range(self.h) for x in range(self.w) if self.get(x, y)[3] > 0}
        for x, y in list(solid):
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if (nx, ny) not in solid:
                    self.px(nx, ny, ch)

    def save(self, name):
        OUT.mkdir(parents=True, exist_ok=True)
        self.img.save(OUT / f"{name}.png")


# ---------------------------------------------------------------- пол и стены


def floor():
    """Плитка 32×32 (в мире 16×16): две пары плиток почти одного тона, мягкая фаска и затирка."""
    c = Canvas(32, 32)
    for ox, oy, base in ((0, 0, "F"), (16, 16, "F"), (16, 0, "f"), (0, 16, "f")):
        c.rect(ox, oy, 16, 16, base)
        c.hline(ox + 1, oy + 1, 14, "q")
        c.vline(ox + 1, oy + 1, 14, "q")
        c.hline(ox + 1, oy + 15, 15, "Q")
        c.vline(ox + 15, oy + 1, 15, "Q")
    for i in range(32):
        c.px(i, 0, "v")
        c.px(0, i, "v")
        c.px(i, 16, "v")
        c.px(16, i, "v")
    c.save("floor")


def wall():
    """Задняя стена 32×64: светлая краска, молдинг, деревянные панели снизу и плинтус."""
    c = Canvas(32, 64)
    c.rect(0, 0, 32, 64, "W")
    c.rect(0, 0, 32, 4, "G")
    c.hline(0, 4, 32, "l")
    c.hline(0, 5, 32, "w")
    # Вертикальные панели с тенью.
    for x in (0, 16):
        c.vline(x, 6, 32, "l")
        c.vline(x + 1, 6, 32, "w")
    # Молдинг.
    c.hline(0, 38, 32, "w")
    c.hline(0, 39, 32, "l")
    c.hline(0, 40, 32, "G")
    # Деревянная вагонка снизу.
    c.rect(0, 41, 32, 15, "B")
    c.hline(0, 41, 32, "N")
    c.hline(0, 42, 32, "n")
    for x in range(0, 32, 6):
        c.vline(x, 43, 13, "a")
        c.vline(x + 1, 43, 13, "n")
    c.hline(0, 55, 32, "a")
    # Плинтус.
    c.rect(0, 56, 32, 8, "K")
    c.hline(0, 56, 32, "G")
    c.hline(0, 57, 32, "g")
    c.save("wall")


def concrete():
    """Пол склада: бетон с плитами и пятнами."""
    c = Canvas(32, 32)
    c.rect(0, 0, 32, 32, "l")
    c.speckle(0, 0, 32, 32, ["G", "W"], 12, 11)
    c.hline(0, 31, 32, "G")
    c.vline(31, 0, 32, "G")
    c.hline(0, 0, 32, "W")
    c.vline(0, 0, 32, "W")
    c.save("concrete")


def asphalt():
    """Улица: асфальт с крошкой."""
    c = Canvas(32, 32)
    c.rect(0, 0, 32, 32, "K")
    c.speckle(0, 0, 32, 32, ["g", "k"], 40, 5)
    c.save("asphalt")


def lot():
    """Пустырь «Сдаётся»: земля с травой и камешками."""
    c = Canvas(32, 32)
    c.rect(0, 0, 32, 32, "a")
    c.speckle(0, 0, 32, 32, ["b"], 12, 9)
    rnd = random.Random(2)
    for _ in range(4):
        x, y = rnd.randrange(32), rnd.randrange(2, 32)
        c.px(x, y, "d")
        c.px(x, y - 1, "e")
        c.px(x - 1, y - 1, "E")
        c.px(x + 1, y - 2, "E")
    for x, y in ((6, 20), (25, 8)):
        c.rect(x, y, 2, 1, "l")
        c.px(x, y + 1, "G")
    c.save("lot")


# ---------------------------------------------------------------- мебель
# Все стеллажи 80×52 (в мире 40×26). Товар в игре стоит на двух полках:
# центры рядов на y≈14 и y≈38 пикселей, по ширине от 6 до 74.


def shelf_frame(c, side, side_hi, side_lo, top, top_hi):
    """Боковины, крышка и цоколь стеллажа."""
    c.rect(0, 0, 80, 52, side)
    c.rect(0, 0, 80, 4, top)
    c.hline(1, 1, 78, top_hi)
    c.rect(0, 46, 80, 6, side_lo)
    c.hline(0, 46, 80, side)
    c.vline(1, 4, 42, side_hi)
    c.vline(78, 4, 42, side_lo)
    c.frame(0, 0, 80, 52, "k")


def shelf():
    """Хлебный стеллаж: тёплое дерево, две полки с задней стенкой и ценниками."""
    c = Canvas(80, 52)
    shelf_frame(c, "B", "n", "a", "n", "N")
    for top in (5, 28):
        # Задняя стенка с волокнами.
        c.rect(3, top, 74, 17, "b")
        c.hline(3, top, 74, "x")
        for y in range(top + 3, top + 17, 4):
            c.speckle(3, y, 74, 1, ["a"], 10, y)
        # Полка: кромка и тень.
        c.rect(3, top + 15, 74, 3, "n")
        c.hline(3, top + 15, 74, "N")
        c.hline(3, top + 18, 74, "a")
        # Ценники.
        for x in (10, 34, 58):
            c.rect(x, top + 16, 6, 2, "w")
            c.px(x + 1, top + 16, "R")
    c.save("shelf")


def stand():
    """Овощной прилавок: зелёная рама, наклонные деревянные ящики, бумажные ценники."""
    c = Canvas(80, 52)
    shelf_frame(c, "e", "E", "d", "E", "w")
    for top in (5, 28):
        c.rect(3, top, 74, 17, "d")
        for x in (3, 28, 53):
            c.rect(x, top + 2, 24, 15, "B")
            c.frame(x, top + 2, 24, 15, "b")
            c.hline(x + 1, top + 3, 22, "n")
            c.hline(x + 1, top + 9, 22, "a")
            c.vline(x + 1, top + 3, 13, "n")
        c.rect(3, top + 17, 74, 1, "k")
        for x in (12, 37, 62):
            c.rect(x, top + 15, 6, 3, "N")
            c.px(x + 1, top + 16, "e")
    c.save("stand")


def fridge():
    """Холодильник-витрина: светлый корпус под тинт, лампа, стекло с бликами, решётка."""
    c = Canvas(80, 52)
    shelf_frame(c, "2", "1", "3", "1", "1")
    # Световой короб сверху.
    c.rect(3, 1, 74, 3, "c")
    c.hline(3, 1, 74, "w")
    for top in (5, 28):
        c.rect(3, top, 74, 17, "l")
        c.rect(3, top, 74, 2, "W")
        # Металлическая решётка полки.
        c.rect(3, top + 15, 74, 3, "W")
        c.hline(3, top + 15, 74, "w")
        for x in range(5, 77, 4):
            c.px(x, top + 17, "G")
        c.hline(3, top + 18, 74, "G")
        # Блики на стекле — диагональные полосы.
        for i in range(6):
            c.px(8 + i, top + 12 - i * 2, "w")
            c.px(9 + i, top + 12 - i * 2, "w")
            c.px(58 + i, top + 12 - i * 2, "W")
    # Стыки дверей.
    c.vline(40, 5, 41, "3")
    c.vline(41, 5, 41, "1")
    # Решётка мотора внизу.
    for x in range(6, 74, 3):
        c.vline(x, 48, 3, "4")
    c.frame(0, 0, 80, 52, "k")
    c.save("fridge")


def counter():
    """Касса боком 32×104: стойка, лента с роликами, сканер, терминал и пакеты."""
    c = Canvas(32, 104)
    # Корпус: светлая столешница, тёмный бок.
    c.rect(0, 0, 32, 104, "g")
    c.rect(2, 0, 26, 104, "W")
    c.vline(2, 0, 104, "w")
    c.vline(27, 0, 104, "l")
    c.rect(28, 2, 4, 102, "G")
    c.vline(31, 2, 102, "g")
    # Лента.
    c.rect(5, 4, 20, 58, "k")
    c.rect(6, 5, 18, 56, "K")
    for y in range(7, 60, 6):
        c.hline(6, y, 18, "g")
    c.hline(5, 4, 20, "G")
    c.hline(5, 62, 20, "l")
    # Сканер: стекло с красной линией.
    c.rect(6, 64, 18, 8, "k")
    c.rect(7, 65, 16, 6, "u")
    c.hline(7, 68, 16, "R")
    c.px(8, 66, "U")
    c.px(9, 66, "U")
    # Терминал с экраном.
    c.rect(7, 74, 18, 16, "k")
    c.rect(8, 75, 16, 14, "K")
    c.rect(10, 77, 12, 6, "e")
    c.hline(10, 77, 12, "E")
    c.px(11, 79, "Y")
    c.px(12, 79, "Y")
    c.px(14, 79, "Y")
    for x in range(10, 22, 3):
        c.rect(x, 85, 2, 2, "l")
    # Пакеты внизу.
    c.rect(9, 93, 14, 8, "N")
    c.frame(9, 93, 14, 8, "B")
    c.hline(10, 94, 12, "w")
    c.frame(0, 0, 32, 104, "k")
    c.save("counter")


def wc():
    """Дверь туалета 32×48 с табличкой и ручкой."""
    c = Canvas(32, 48)
    c.rect(0, 0, 32, 48, "z")
    c.rect(2, 2, 28, 46, "x")
    c.rect(4, 4, 24, 44, "W")
    c.vline(4, 4, 44, "w")
    c.vline(27, 4, 44, "l")
    c.frame(7, 22, 18, 22, "l")
    # Табличка «М|Ж».
    c.rect(8, 7, 16, 11, "w")
    c.frame(8, 7, 16, 11, "G")
    c.ellipse(12, 10, 1.5, 1.5, "U")
    c.rect(11, 12, 3, 4, "U")
    c.vline(16, 8, 9, "l")
    c.ellipse(20, 10, 1.5, 1.5, "R")
    c.rect(18, 12, 5, 2, "R")
    c.rect(19, 14, 3, 2, "R")
    # Ручка.
    c.rect(22, 26, 4, 2, "y")
    c.px(22, 26, "Y")
    c.save("wc")


def door():
    """Вход 64×16: раздвижные стеклянные двери и коврик."""
    c = Canvas(64, 16)
    c.rect(0, 0, 64, 8, "g")
    for x in (2, 33):
        c.rect(x, 1, 29, 6, "c")
        c.rect(x, 1, 29, 1, "w")
        c.rect(x, 5, 29, 2, "U")
        for i in range(3):
            c.px(x + 4 + i, 4 - i, "w")
    c.rect(31, 0, 2, 8, "k")
    c.rect(2, 8, 60, 8, "r")
    c.rect(4, 9, 56, 6, "R")
    for x in range(6, 58, 4):
        c.vline(x, 10, 4, "r")
    c.save("door")


def box():
    """Коробка на складе 16×14: картон, скотч и наклейка (цвет товара — тинт)."""
    c = Canvas(16, 14)
    c.rect(0, 0, 16, 14, "B")
    c.rect(0, 0, 16, 4, "n")
    c.hline(0, 0, 16, "N")
    c.rect(7, 0, 2, 4, "N")
    c.hline(0, 4, 16, "a")
    c.rect(4, 6, 8, 5, "w")
    c.frame(4, 6, 8, 5, "W")
    c.hline(5, 8, 6, "W")
    c.vline(15, 1, 13, "a")
    c.frame(0, 0, 16, 14, "k")
    c.save("box")


def trash():
    """Мусор 12×10: смятая бумажка и обёртка."""
    c = Canvas(12, 10)
    c.ellipse(5, 5, 4, 3.5, "W")
    c.px(3, 3, "w")
    c.px(4, 4, "w")
    c.px(6, 6, "l")
    c.px(4, 6, "l")
    c.rect(7, 6, 4, 2, "R")
    c.px(7, 6, "s")
    c.outline("k")
    c.save("trash")


def items():
    """Товар 8×10 (в мире 4×5): у каждого своя форма, свет слева сверху."""
    shapes = {
        "item_bread": [
            "........",
            "..kkkk..",
            ".knNNnk.",
            "knNnNnnk",
            "knnnnnBk",
            "kBnBnBBk",
            "kBBBBBak",
            ".kaaaak.",
            "..kkkk..",
            "........",
        ],
        "item_apples": [
            "....e...",
            "...ke...",
            ".kkkkkk.",
            "kRwRRRRk",
            "kRwRRRrk",
            "kRRRRRrk",
            "kRRRRrrk",
            ".krrrrk.",
            "..kkkk..",
            "........",
        ],
        "item_potatoes": [
            "........",
            "........",
            "..kkkk..",
            ".knNnnk.",
            "knNntnBk",
            "kntnnnBk",
            "knnBntBk",
            ".kBBBak.",
            "..kkkk..",
            "........",
        ],
        "item_milk": [
            "..kkkk..",
            ".kWwwWk.",
            "kwwwwwWk",
            "kwUUUUWk",
            "kwUwwUWk",
            "kwUUUUWk",
            "kwwwwwWk",
            "kwwwwwWk",
            "kWWWWWlk",
            ".kkkkkk.",
        ],
        "item_meat": [
            "........",
            "........",
            ".kkkkkk.",
            "kRsRRRRk",
            "kswwRRRk",
            "kRwsRRmk",
            "kRRRRmmk",
            ".kmmmmk.",
            "..kkkk..",
            "........",
        ],
    }
    for name, rows in shapes.items():
        c = Canvas(8, 10)
        c.stamp(rows)
        c.save(name)


# ---------------------------------------------------------------- люди

# Человек 24×36 (в мире 12×18) из слоёв: кожа (голова, шея, кисти), волосы,
# одежда, штаны с обувью. Цифры — оттенки под тинт: 1 — основной цвет,
# 2–4 — тени, 5 — румянец, 6 — рот. Контур «k» и обувь «K» не красятся.

SKIN = [
    "........................",
    "........................",
    "........................",
    "........kkkkkkkk........",
    "......kk11111111kk......",
    ".....k111111111112k.....",
    ".....k111111111112k.....",
    "....k11111111111122k....",
    "....k11111111111122k....",
    "....k11111111111122k....",
    "....k11k1111111k122k....",
    "....k11k1111111k122k....",
    "....k1511111111152k.....",
    "....k1111111661112k.....",
    ".....k11111111122k......",
    "......kk222222kkk.......",
    "........kk22kk..........",
    "..........22............",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "...k11k.........k11k....",
    "...k12k.........k12k....",
    "....kk...........kk.....",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
]

SHIRT = [
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "......kkkk2..2kkkk......",
    ".....k11111k1k11112k....",
    "....k1111111211111122k..",
    "...k111k1111111111k122k.",
    "...k11k111111111112k12k.",
    "...k11k111111111112k12k.",
    "...k11k111111111112k22k.",
    "...k12k111111111112k22k.",
    "...kkkk111111111122kkkk.",
    ".....k1111111111122k....",
    ".....k2222222222233k....",
    "......kkkkkkkkkkkkk.....",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
]

LEGS = [
    [
        "......k1111111112k......",
        "......k1111k11112k......",
        "......k1112k11122k......",
        "......k1112k11122k......",
        "......k1112k11122k......",
        "......kkkkkkkkkkkk......",
        ".....kKKKKk.kKKKKk......",
        ".....kkkkkk.kkkkkk......",
    ],
    [
        "......k1111111112k......",
        "......k1111k11112k......",
        ".....k1112k.k1122k......",
        ".....k1112k.k1122k......",
        "....kkkkkk...kkkkk......",
        "....kKKKKk...kKKKk......",
        "....kkkkkk...kkkkkk.....",
        "........................",
    ],
]

HAIR = {
    "short": [
        "........kkkkkkkk........",
        "......kk11111111kk......",
        ".....k111111111111k.....",
        "....k11111211111122k....",
        "....k1112k1111k1122k....",
        "....k12k..k11k..k22k....",
        "....kk.........kk2k.....",
    ],
    "long": [
        "........kkkkkkkk........",
        "......kk11111111kk......",
        ".....k111111111112k.....",
        "....k11111211111122k....",
        "...k1112k1111k111122k...",
        "...k112k..k11k..k122k...",
        "...k12k..........k22k...",
        "...k12k..........k22k...",
        "...k12k..........k22k...",
        "...k12k..........k22k...",
        "...k12k..........k23k...",
        "...k22k..........k33k...",
        "...k23k..........k33k...",
        "...k33k..........k33k...",
        "....kk............kk....",
    ],
    "bun": [
        "..........kkkk..........",
        ".........k1112k.........",
        ".........k1222k.........",
        "........kkkkkkkk........",
        "......kk11111111kk......",
        ".....k111112111112k.....",
        "....k11111111111122k....",
        "....k112kk1111kk122k....",
        "....k12k..k11k..k22k....",
        "....kk...........kk.....",
    ],
    "cap": [
        ".........kkkkkk.........",
        ".......kk111111kk.......",
        "......k1111YY11112k.....",
        ".....k11111YY111122k....",
        ".....k11111111111222k...",
        "....kkkkkkkkkkkkkkkkkk..",
        "....k3333333333333333k..",
        "....kkkkkkkkkkkkkkkkk...",
    ],
    "bald": [
        "........................",
        "........................",
        "........................",
        "........................",
        "........................",
        "........................",
        "....kk...........kk.....",
        "....k1k..........k2k....",
        "....k1k..........k2k....",
        "....kk...........kk.....",
    ],
}


def people():
    c = Canvas(24, 36)
    c.stamp(SKIN)
    c.save("p_skin")
    c = Canvas(24, 36)
    c.stamp(SHIRT)
    c.save("p_shirt")
    for i, rows in enumerate(LEGS):
        c = Canvas(24, 36)
        c.stamp(rows, 0, 27)
        c.save(f"p_legs{i}")
    for style, rows in HAIR.items():
        c = Canvas(24, 36)
        c.stamp(rows, 0, 0 if style == "bun" else 2 if style == "cap" else 3)
        c.save(f"p_hair_{style}")
    # Тень под ногами.
    c = Canvas(20, 8)
    c.ellipse(10, 4, 9, 3.2, (24, 20, 37, 90))
    c.save("shadow")


# ---------------------------------------------------------------- декор


def decor():
    # Растение в горшке 24×24.
    c = Canvas(24, 24)
    rnd = random.Random(4)
    for cx, cy, rx, ry in ((12, 8, 7, 6), (7, 11, 4, 3), (17, 11, 4, 3), (12, 4, 4, 3)):
        c.ellipse(cx, cy, rx, ry, "e")
    for _ in range(30):
        x, y = rnd.randrange(4, 20), rnd.randrange(1, 14)
        if c.get(x, y)[3]:
            c.px(x, y, rnd.choice(["E", "E", "d"]))
    c.outline("k")
    c.rect(7, 15, 10, 8, "B")
    c.rect(6, 14, 12, 3, "n")
    c.hline(6, 14, 12, "N")
    c.vline(15, 17, 6, "a")
    c.hline(8, 22, 8, "a")
    c.frame(6, 14, 12, 3, "k")
    c.frame(7, 16, 10, 8, "k")
    c.rect(7, 14, 10, 1, "b")
    c.save("plant")

    # Плакат «Скидки» 24×18.
    c = Canvas(24, 18)
    c.rect(0, 0, 24, 18, "Y")
    c.rect(1, 1, 22, 2, "y")
    c.ellipse(7, 9, 5, 5, "R")
    c.ellipse(7, 9, 3.5, 3.5, "s")
    c.stamp(["w...w", "...w.", "..w..", ".w...", "w...w"], 5, 7)
    c.rect(14, 5, 7, 2, "o")
    c.rect(14, 9, 6, 1, "y")
    c.rect(14, 11, 7, 1, "y")
    c.rect(14, 13, 4, 1, "y")
    c.px(22, 15, "w")
    c.frame(0, 0, 24, 18, "k")
    c.save("poster")

    # Стопка корзинок 20×14.
    c = Canvas(20, 14)
    c.rect(1, 3, 18, 9, "R")
    c.hline(1, 3, 18, "s")
    for x in range(3, 18, 3):
        c.vline(x, 5, 5, "r")
    c.hline(2, 10, 16, "m")
    c.rect(4, 0, 12, 1, "K")
    c.vline(4, 0, 3, "K")
    c.vline(15, 0, 3, "K")
    c.outline("k")
    c.save("baskets")


# ---------------------------------------------------------------- мелочи


def ui_bits():
    # Облачко над покупателем 14×14 с хвостиком (цвет — тинт: терпение).
    c = Canvas(14, 14)
    c.ellipse(7, 5.5, 6, 5, "1")
    c.hline(4, 2, 4, "w")
    c.stamp(["11", "1."], 6, 10)
    c.outline("K")
    c.save("bubble")
    # Метка улучшения полки 4×4 — звёздочка.
    c = Canvas(4, 4)
    c.stamp([".Y..", "YYYy", ".yy.", ".y.y"])
    c.save("pip")
    c = Canvas(2, 2)
    c.rect(0, 0, 2, 2, "w")
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
