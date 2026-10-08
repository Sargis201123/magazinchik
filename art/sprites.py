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
    # Перекрестья затирки чуть темнее, линии между ними — мягче.
    for i in range(32):
        for x, y in ((i, 0), (0, i), (i, 16), (16, i)):
            if x % 16 not in (0,) or y % 16 not in (0,):
                c.px(x, y, "Q")
    for x, y in ((0, 0), (16, 0), (0, 16), (16, 16)):
        c.px(x, y, "v")
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
# Все стеллажи 80×52 (в мире 40×26). Товар в игре стоит в двух рядах:
# центры рядов на y=16 и y=38 пикселей, по ширине от 6 до 74.
# У каждого стеллажа есть «передний слой» (*_front): кромки полок, борта ящиков,
# стекло холодильника. Он рисуется поверх товара — товар оказывается внутри.

# Кромки полок перекрывают низ товара: ряд 1 — y 20..23, ряд 2 — y 42..45.
LIPS = (20, 42)
BACKS = ((4, 16), (24, 18))  # задняя стенка: (начало, высота)


def cabinet(c, hi, base, lo):
    """Корпус: крышка с бликом, боковины с фаской, цоколь."""
    c.rect(0, 0, 80, 52, base)
    c.hline(1, 1, 78, hi)
    c.hline(1, 3, 78, lo)
    for x, (l, r) in ((0, (hi, lo)), (76, (hi, lo))):
        c.vline(x + 1, 4, 42, l)
        c.vline(x + 3, 4, 42, r)
    c.rect(0, 46, 80, 6, lo)
    c.hline(0, 46, 80, base)
    c.rect(4, 48, 72, 3, "k")
    c.hline(4, 48, 72, lo)
    c.frame(0, 0, 80, 52, "k")


def wood_lips(c, tags=True):
    """Деревянные кромки полок с бумажными ценниками."""
    for y in LIPS:
        c.hline(4, y, 72, "N")
        c.rect(4, y + 1, 72, 2, "n")
        c.hline(4, y + 3, 72, "a")
        if tags:
            for x in range(9, 72, 17):
                c.rect(x, y + 1, 6, 2, "w")
                c.px(x + 1, y + 1, "R")
                c.px(x + 3, y + 2, "K")
                c.px(x + 4, y + 2, "K")


def shelf():
    """Хлебный стеллаж: тёплое дерево, стенка из досок с тенью от полки сверху."""
    c = Canvas(80, 52)
    cabinet(c, "n", "B", "a")
    for top, h in BACKS:
        c.rect(4, top, 72, h, "b")
        for x in range(4, 76, 9):
            c.vline(x, top, h, "x")
        c.speckle(4, top, 72, h, ["a"], 14, top)
        c.rect(4, top, 72, 3, "x")
    wood_lips(c)
    c.save("shelf")
    f = Canvas(80, 52)
    wood_lips(f)
    f.vline(4, LIPS[0], 4, "k")
    f.save("shelf_front")


def crate_fronts(c):
    """Передние борта ящиков: доски, тень между ящиками, меловые ценники."""
    for y in LIPS:
        c.rect(4, y, 72, 4, "B")
        c.hline(4, y, 72, "n")
        c.hline(4, y + 3, 72, "b")
        for x in (28, 52):
            c.vline(x, y, 4, "x")
            c.vline(x + 1, y, 4, "n")
        for x in (12, 37, 61):
            c.rect(x, y, 7, 3, "K")
            c.frame(x, y, 7, 3, "a")
            c.px(x + 2, y + 1, "w")
            c.px(x + 3, y + 1, "w")
            c.px(x + 4, y + 1, "W")


def stand():
    """Овощной прилавок: зелёная рама, внутри деревянные ящики."""
    c = Canvas(80, 52)
    cabinet(c, "E", "e", "d")
    for top, h in BACKS:
        c.rect(4, top, 72, h, "a")
        for y in range(top + 1, top + h, 3):
            c.hline(4, y, 72, "B")
        c.rect(4, top, 72, 2, "b")
        for x in (28, 52):
            c.vline(x, top, h, "b")
    crate_fronts(c)
    c.save("stand")
    f = Canvas(80, 52)
    crate_fronts(f)
    f.save("stand_front")


GLASS = (215, 240, 255, 46)
GLINT = (255, 255, 255, 150)
FROST = (240, 250, 255, 110)


def fridge():
    """Холодильник-витрина: светлый корпус под тинт, подсветка, металлические полки."""
    c = Canvas(80, 52)
    cabinet(c, "1", "2", "3")
    # Подсветка в крышке.
    c.hline(6, 2, 68, "c")
    for top, h in BACKS:
        c.rect(4, top, 72, h, "l")
        c.rect(4, top, 72, 2, "w")
        c.rect(4, top + 2, 72, 2, "W")
        for x in range(10, 76, 12):
            c.vline(x, top + 4, h - 4, "G")
    fridge_rails(c)
    for x in range(6, 74, 3):
        c.vline(x, 48, 2, "4")
    c.save("fridge")

    # Стекло, рамы дверей и ручки — поверх товара.
    f = Canvas(80, 52)
    f.rect(4, 4, 72, 42, GLASS)
    for door_x in (4, 40):
        for i in range(10):
            f.px(door_x + 6 + i, 40 - i * 3, GLINT)
            f.px(door_x + 7 + i, 40 - i * 3, GLINT)
            f.px(door_x + 7 + i, 39 - i * 3, GLINT)
        for i in range(4):
            f.px(door_x + 22 + i, 16 - i * 3, GLINT)
        f.rect(door_x + 1, 38, 6, 3, FROST)
        f.rect(door_x + 1, 37, 3, 1, FROST)
    fridge_rails(f)
    for x in (3, 39, 40, 75, 76):
        f.vline(x, 4, 42, "W")
    f.vline(39, 4, 42, "w")
    f.vline(4, 4, 42, "w")
    for x in (35, 44):
        f.rect(x, 26, 2, 12, "G")
        f.vline(x, 26, 12, "l")
    f.save("fridge_front")


def fridge_rails(c):
    """Металлические полки с жёлтыми ценниками."""
    for y in LIPS:
        c.hline(4, y + 1, 72, "w")
        c.rect(4, y + 2, 72, 1, "W")
        c.hline(4, y + 3, 72, "G")
        for x in range(9, 72, 17):
            c.rect(x, y + 1, 5, 2, "Y")
            c.px(x + 1, y + 2, "K")
            c.px(x + 2, y + 2, "K")


def counter():
    """Касса боком 32×104: деревянный бок к покупателю, лента с разделителем, сканер,
    монитор с денежным ящиком и пакеты в конце."""
    c = Canvas(32, 104)
    # Бок к покупателю — дерево, столешница — светлая, край к продавцу — тёмный.
    c.rect(0, 0, 6, 104, "B")
    c.vline(1, 1, 102, "n")
    c.vline(5, 1, 102, "a")
    for y in range(12, 100, 22):
        c.hline(1, y, 4, "a")
    c.rect(6, 0, 22, 104, "W")
    c.vline(6, 0, 104, "w")
    c.rect(28, 0, 4, 104, "G")
    c.vline(28, 0, 104, "l")
    # Лента.
    c.rect(8, 3, 18, 50, "l")
    c.rect(9, 4, 16, 48, "K")
    for y in range(6, 52, 5):
        c.hline(9, y, 16, "g")
    # Разделитель «следующий покупатель».
    c.rect(10, 26, 14, 2, "y")
    c.hline(10, 26, 14, "Y")
    # Сканер со стеклом и красным лучом.
    c.rect(8, 55, 18, 11, "k")
    c.rect(9, 56, 16, 9, "u")
    c.hline(9, 60, 16, "R")
    c.vline(17, 56, 9, "R")
    c.px(10, 57, "U")
    c.px(11, 57, "U")
    c.px(10, 58, "U")
    # Тень от монитора на столешницу.
    c.rect(12, 70, 16, 18, "l")
    # Монитор и денежный ящик.
    c.rect(9, 68, 16, 18, "k")
    c.rect(10, 69, 14, 9, "K")
    c.rect(11, 70, 12, 6, "e")
    c.hline(11, 70, 12, "E")
    c.hline(12, 72, 5, "Y")
    c.hline(12, 74, 8, "E")
    c.rect(10, 79, 14, 6, "g")
    for x in range(11, 23, 3):
        c.rect(x, 80, 2, 1, "W")
        c.rect(x, 82, 2, 1, "W")
    c.hline(10, 84, 14, "G")
    # Лента чека.
    c.rect(26, 72, 2, 6, "w")
    # Пакеты.
    for x, tone in ((8, "N"), (17, "n")):
        c.rect(x, 90, 8, 10, tone)
        c.hline(x, 90, 8, "w")
        c.frame(x, 90, 8, 10, "a")
        c.frame(x + 2, 87, 4, 4, "a")
    # Передний торец.
    c.rect(0, 101, 32, 3, "g")
    c.hline(0, 101, 32, "G")
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
    """Коробка на складе 16×14: картон, скотч и белая наклейка — на неё игра кладёт картинку товара."""
    c = Canvas(16, 14)
    c.rect(0, 0, 16, 14, "B")
    c.rect(0, 0, 16, 4, "n")
    c.hline(0, 0, 16, "N")
    c.rect(7, 0, 2, 4, "N")
    c.hline(0, 4, 16, "a")
    c.rect(3, 6, 10, 7, "w")
    c.hline(3, 12, 10, "W")
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


ITEMS = {
    "bread": [
        [  # батон с надрезами
            "..........",
            "..........",
            "..........",
            "...kkkk...",
            ".kknNNnkk.",
            "knNNnNNnnk",
            "knnBnnBnBk",
            "knBnnBnnBk",
            "kBnnBnnBak",
            "kaBBBBBBak",
            ".kaaaaaak.",
            "..kkkkkk..",
        ],
        [  # багет
            "........kk",
            ".......knk",
            "......knNk",
            ".....knNBk",
            "....knNnk.",
            "...knNBk..",
            "..knnnk...",
            ".knnBk....",
            "knnBk.....",
            "kBak......",
            "kak.......",
            "kk........",
        ],
        [  # булка с кунжутом
            "..........",
            "..........",
            "...kkkk...",
            "..knNNnk..",
            ".knNwNnnk.",
            "knNnnnwnnk",
            "knwnNnnnBk",
            "knnnnwnBBk",
            "kBnnnnBBak",
            ".kBBBBBak.",
            "..kaaaak..",
            "...kkkk...",
        ],
    ],
    "apples": [
        [
            "....dd....",
            ".....dE...",
            "..kkkdkk..",
            ".kRRRkRRk.",
            "kRwwRRRRrk",
            "kRwRRRRRrk",
            "kRRRRRRRrk",
            "kRRRRRRrrk",
            ".kRRRRrrk.",
            ".krrrrrrk.",
            "..kkkkkk..",
            "..........",
        ],
        [
            "....bb....",
            ".....b....",
            "..kkkbkk..",
            ".kEEEkEEk.",
            "kEYYEEEEek",
            "kEYEEEEEek",
            "kEEEEEEEek",
            "kEEEEEEeek",
            ".kEEEEeek.",
            ".keeeeeek.",
            "..kkkkkk..",
            "..........",
        ],
        [
            "....bEE...",
            "....bEEE..",
            "..kkbkkk..",
            ".krrrkrrk.",
            "krssrrrrmk",
            "krsrrrrrmk",
            "krrrrrrrmk",
            "krrrrrrmmk",
            ".krrrrmmk.",
            ".kmmmmmmk.",
            "..kkkkkk..",
            "..........",
        ],
    ],
    "potatoes": [
        [
            "..........",
            "..........",
            "..........",
            "...kkkkk..",
            "..knNNnnk.",
            ".knNnntnBk",
            "knNnnnnnBk",
            "kntnnnBnBk",
            "knnnBtnBak",
            ".kBnnBBak.",
            "..kaaaak..",
            "...kkkk...",
        ],
        [
            "..........",
            "..........",
            "..........",
            "..........",
            ".kkk..kkk.",
            "knNnk.kNnk",
            "kNtnkknntk",
            "knnBkknBBk",
            "kBBakkBBak",
            ".kkk..kkk.",
            "..........",
            "..........",
        ],
        [
            "..........",
            "..........",
            "..........",
            ".kkkkkkkk.",
            "knNNnnnnnk",
            "kNnntnnnBk",
            "knnnnnnBtk",
            "kntnnnBnBk",
            "kBBBBBBBak",
            ".kaaaaaak.",
            "..........",
            "..........",
        ],
    ],
    "milk": [
        [  # пакет
            "....kk....",
            "...kwWk...",
            "..kwwwWk..",
            ".kwwwwwWk.",
            "kwwwwwwWWk",
            "kUUUUUUUuk",
            "kUwwwUUUuk",
            "kUwUUwUUuk",
            "kUUUUUUUuk",
            "kwwwwwwwWk",
            "kwwwwwwwWk",
            ".kkkkkkkk.",
        ],
        [  # бутылка
            "...kkkk...",
            "...kUUk...",
            "...kUUk...",
            "...kwwk...",
            "..kwwwWk..",
            ".kwwwwwWk.",
            "kwwwwwwwWk",
            "kwUUUUUUWk",
            "kwUwwUUUWk",
            "kwUUUUUUWk",
            "kWwwwwwWlk",
            ".kkkkkkkk.",
        ],
        [  # кефир
            "....kk....",
            "...kwWk...",
            "..kwwwWk..",
            ".kwwwwwWk.",
            "kwwwwwwWWk",
            "kRRRRRRRrk",
            "kRwwwRRRrk",
            "kRwRRwRRrk",
            "kRRRRRRRrk",
            "kwwwwwwwWk",
            "kwwwwwwwWk",
            ".kkkkkkkk.",
        ],
    ],
    "meat": [
        [  # стейк на подложке
            "..........",
            "..........",
            "..........",
            "..........",
            "kkkkkkkkkk",
            "kWRRsRRRWk",
            "kRswwRRRmk",
            "kRRRwsRRmk",
            "kRRRRRRmmk",
            "kWmmmmmmWk",
            "kWWWWWWWWk",
            ".kkkkkkkk.",
        ],
        [  # сосиски
            "..........",
            "..........",
            "..........",
            ".kkkkkkkk.",
            "kwssssssPk",
            "kkkkkkkkkk",
            "kwssssssPk",
            "kkkkkkkkkk",
            "kwssssssPk",
            "kkkkkkkkkk",
            "kWWWWWWWWk",
            ".kkkkkkkk.",
        ],
        [  # фарш
            "..........",
            "..........",
            "..........",
            "..........",
            "kkkkkkkkkk",
            "kwRRsRsRRk",
            "kRwRsRRsmk",
            "kRsRRmRRmk",
            "kRRmRRmmmk",
            "kWWWWWWWWk",
            "kWWWWWWWWk",
            ".kkkkkkkk.",
        ],
    ],
}


def items():
    """Товар 10×12 (в мире 5×6), по три вида каждого: полка выглядит живой.
    Низ товара прячется за кромкой полки."""
    for product, variants in ITEMS.items():
        for i, rows in enumerate(variants):
            assert len(rows) == 12 and all(len(r) == 10 for r in rows), f"{product}_{i}"
            c = Canvas(10, 12)
            c.stamp(rows)
            c.save(f"item_{product}_{i}")
            if i == 0:
                c.save(f"item_{product}")


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
    # Мягкая тень под мебелью 88×12.
    c = Canvas(88, 12)
    for i, alpha in enumerate((28, 46, 62)):
        c.round_rect(i * 2, i, 88 - i * 4, 12 - i * 2, (24, 20, 37, alpha), r=4 - i)
    c.save("shadow_wide")

    # Окно на стене 28×22: рама, небо, крыши напротив, блик.
    c = Canvas(28, 22)
    c.rect(0, 0, 28, 22, "N")
    c.rect(2, 2, 24, 17, "c")
    c.rect(2, 2, 24, 6, "U")
    c.rect(2, 13, 24, 6, "l")
    for x, h in ((3, 4), (9, 6), (16, 3), (21, 5)):
        c.rect(x, 19 - h, 5, h, "G")
        c.px(x + 2, 19 - h + 1, "Y")
    c.vline(13, 2, 17, "N")
    c.hline(2, 10, 24, "N")
    for i in range(4):
        c.px(5 + i, 7 - i, "w")
    c.rect(0, 19, 28, 3, "n")
    c.hline(0, 19, 28, "w")
    c.frame(0, 0, 28, 22, "k")
    c.save("window")

    # Часы 14×14.
    c = Canvas(14, 14)
    c.ellipse(7, 7, 6.5, 6.5, "w")
    c.ellipse(7, 7, 5.5, 5.5, "N")
    c.ellipse(7, 7, 5, 5, "w")
    c.vline(7, 3, 5, "k")
    c.hline(7, 7, 3, "k")
    for x, y in ((7, 2), (12, 7), (7, 12), (2, 7)):
        c.px(x, y, "G")
    c.px(7, 7, "R")
    c.outline("k")
    c.save("clock")

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


def icon():
    """Иконка 32×32: витрина магазинчика с полосатым навесом. Сохраняется и крупно — для аватарки бота."""
    c = Canvas(32, 32)
    c.round_rect(0, 0, 32, 32, "K", r=4)
    # Стены и витрина.
    c.rect(4, 12, 24, 16, "N")
    c.hline(4, 12, 24, "w")
    c.rect(6, 16, 10, 8, "c")
    c.hline(6, 16, 10, "w")
    c.px(8, 18, "w")
    c.px(9, 17, "w")
    c.rect(7, 21, 3, 3, "y")
    c.rect(11, 20, 3, 4, "R")
    c.rect(18, 16, 8, 12, "B")
    c.vline(18, 16, 12, "n")
    c.px(24, 22, "Y")
    c.rect(4, 27, 24, 1, "a")
    # Навес с фестонами.
    for i, x in enumerate(range(2, 30, 4)):
        c.rect(x, 5, 4, 6, "R" if i % 2 == 0 else "w")
        c.px(x + 1, 11, "R" if i % 2 == 0 else "w")
        c.px(x + 2, 11, "R" if i % 2 == 0 else "w")
    c.hline(2, 4, 28, "r")
    c.outline("k")
    pub = OUT.parent
    c.img.save(pub / "favicon.png")
    c.img.resize((512, 512), Image.NEAREST).save(pub / "icon-512.png")


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
    icon()
    print("готово:", sorted(p.name for p in OUT.glob("*.png")))


if __name__ == "__main__":
    main()
