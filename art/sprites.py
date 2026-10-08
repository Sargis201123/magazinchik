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
    # Газон светлее и желтее, чем листва деревьев, — чтобы кроны не сливались с травой.
    "j": "#7cb342",
    "J": "#98c95a",
    "i": "#5e9535",
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


def shadowed(c, cx, cy, rx, ry, alpha=70):
    """Мягкая тень под предметом: рисуется отдельно, без контура."""
    out = Canvas(c.w, c.h)
    out.ellipse(cx, cy, rx, ry, (24, 20, 37, alpha))
    out.img.alpha_composite(c.img)
    return out


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


# ---------------------------------------------------------------- склад
# Тара 16×16 (в мире 8×8): у каждого товара своя, товар виден сверху.


def crate_bread():
    """Хлеб в картонном лотке."""
    c = Canvas(16, 16)
    for x in (1, 6, 10):
        c.ellipse(x + 2.5, 7, 2.6, 2.2, "n")
        c.px(x + 1, 6, "N")
        c.px(x + 2, 6, "N")
        c.px(x + 3, 7, "B")
    c.rect(0, 9, 16, 6, "B")
    c.hline(0, 9, 16, "n")
    c.hline(0, 14, 16, "a")
    c.rect(5, 11, 6, 2, "N")
    c.outline("k")
    c.save("crate_bread")


def crate_apples():
    """Яблоки в деревянном ящике."""
    c = Canvas(16, 16)
    for x, y in ((3, 7), (7, 6), (11, 7), (5, 5), (10, 5)):
        c.ellipse(x + 0.5, y + 0.5, 2.1, 2.1, "R")
        c.px(x - 1, y - 1, "w")
        c.px(x + 1, y + 1, "r")
    c.px(7, 3, "e")
    c.px(10, 3, "e")
    c.rect(0, 8, 16, 7, "B")
    c.hline(0, 8, 16, "n")
    c.hline(0, 11, 16, "a")
    c.hline(0, 14, 16, "a")
    c.vline(0, 8, 7, "a")
    c.vline(15, 8, 7, "a")
    c.outline("k")
    c.save("crate_apples")


def crate_potatoes():
    """Картошка в мешке: мешковина, перевязанная горловина, картошка сверху."""
    c = Canvas(16, 16)
    c.ellipse(8, 11, 7, 4.6, "n")
    c.ellipse(6, 10, 4, 3, "N")
    c.ellipse(10.5, 12.5, 4, 2.2, "B")
    c.speckle(2, 7, 12, 8, ["B", "a"], 10, 7)
    c.rect(5, 5, 6, 3, "n")
    c.vline(5, 5, 3, "N")
    c.hline(5, 7, 6, "b")
    c.px(11, 7, "b")
    c.px(12, 8, "b")
    c.ellipse(8, 4, 4.2, 1.6, "a")
    for x, y in ((5.5, 3), (8.5, 2.5), (10.5, 3.5)):
        c.ellipse(x, y, 1.7, 1.3, "B")
        c.px(int(x) - 1, int(y) - 1, "n")
    c.outline("k")
    c.save("crate_potatoes")


def crate_milk():
    """Молоко в синем пластиковом ящике."""
    c = Canvas(16, 16)
    for i, x in enumerate((1, 5, 9, 12)):
        top = 3 if i % 2 == 0 else 4
        c.rect(x, top + 1, 3, 6, "w")
        c.vline(x + 2, top + 1, 6, "W")
        c.rect(x, top, 3, 1, "U" if i != 2 else "R")
    c.rect(0, 8, 16, 7, "U")
    c.hline(0, 8, 16, "c")
    for x in range(2, 15, 3):
        c.rect(x, 10, 2, 3, "u")
    c.hline(0, 14, 16, "u")
    c.outline("k")
    c.save("crate_milk")


def crate_meat():
    """Мясо в пенопластовом термобоксе с приоткрытой крышкой."""
    c = Canvas(16, 16)
    c.rect(1, 6, 9, 3, "R")
    c.px(2, 6, "s")
    c.px(5, 7, "w")
    c.px(7, 6, "s")
    c.rect(0, 8, 16, 7, "W")
    c.hline(0, 8, 16, "w")
    c.hline(0, 14, 16, "l")
    c.rect(5, 10, 6, 3, "w")
    c.rect(6, 11, 4, 1, "R")
    # Крышка сдвинута вправо.
    c.rect(8, 4, 8, 3, "w")
    c.hline(8, 6, 8, "W")
    c.outline("k")
    c.save("crate_meat")


def rack():
    """Секция складского стеллажа 120×19 (в мире 60×9,5): синие стойки, оранжевая балка."""
    c = Canvas(120, 19)
    for x in (2, 114):
        c.rect(x, 0, 4, 19, "u")
        c.vline(x, 0, 19, "U")
        for y in range(2, 18, 4):
            c.px(x + 2, y, "k")
    c.rect(0, 16, 120, 3, "o")
    c.hline(0, 16, 120, "Y")
    c.hline(0, 18, 120, "r")
    c.frame(2, 0, 4, 19, "k")
    c.frame(114, 0, 4, 19, "k")
    c.save("rack")


def crates():
    crate_bread()
    crate_apples()
    crate_potatoes()
    crate_milk()
    crate_meat()
    rack()


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


# ---------------------------------------------------------------- интерьер


def mat():
    """Коврик у входа 44×16."""
    c = Canvas(44, 16)
    c.round_rect(0, 0, 44, 16, "K", r=2)
    c.round_rect(2, 2, 40, 12, "g", r=1)
    for x in range(4, 40, 3):
        c.vline(x, 3, 10, "G")
    c.hline(3, 7, 38, "y")
    c.save("mat")


def vending():
    """Автомат с напитками 26×44: стекло с бутылками, кнопки, лоток."""
    c = Canvas(26, 44)
    c.rect(0, 0, 26, 44, "R")
    c.vline(1, 1, 42, "s")
    c.vline(24, 1, 42, "r")
    c.rect(3, 4, 15, 26, "K")
    for row, y in enumerate(range(6, 29, 6)):
        for x in range(4, 17, 4):
            tone = ("U", "E", "Y", "w")[(row + x) % 4]
            c.rect(x, y, 2, 4, tone)
            c.px(x, y, "w")
    for i in range(3):
        c.px(5 + i * 2, 4 + i, "W")
    c.rect(20, 6, 3, 10, "k")
    for y in range(7, 16, 3):
        c.px(21, y, "Y")
    c.rect(20, 18, 3, 3, "w")
    c.rect(4, 34, 18, 6, "k")
    c.hline(4, 34, 18, "G")
    c.rect(0, 0, 26, 3, "m")
    c.hline(2, 1, 22, "w")
    c.outline("k")
    shadowed(c, 13, 42, 12, 2.5).save("vending")


def pallet_water():
    """Поддон с упаковками воды 80×52 — стоит на месте будущей полки."""
    c = Canvas(80, 52)
    # Поддон.
    c.rect(4, 42, 72, 8, "B")
    c.hline(4, 42, 72, "n")
    for x in (4, 37, 70):
        c.rect(x, 46, 6, 4, "a")
    # Упаковки в плёнке: три яруса.
    for tier, (y, x0, n) in enumerate(((30, 6, 6), (18, 12, 5), (6, 18, 4))):
        for i in range(n):
            x = x0 + i * 11
            c.rect(x, y, 11, 12, "U")
            c.vline(x, y, 12, "c")
            for bx in range(x + 2, x + 10, 3):
                c.rect(bx, y + 1, 2, 3, "w")
                c.px(bx, y + 1, "u")
            c.hline(x, y + 6, 11, "u")
            c.px(x + 2, y + 8, "w")
    c.outline("k")
    shadowed(c, 40, 49, 38, 3).save("pallet_water")


def promo():
    """Картонная стойка «Акция» 80×52: ярусы с пачками печенья и большой знак %."""
    c = Canvas(80, 52)
    c.rect(14, 10, 52, 40, "N")
    c.vline(14, 10, 40, "w")
    c.vline(65, 10, 40, "n")
    for y in (22, 36):
        c.rect(14, y, 52, 3, "R")
        c.hline(14, y, 52, "s")
    for row, y in enumerate((13, 27, 41)):
        for x in range(17, 62, 9):
            tone = ("o", "y", "P")[(row + x // 9) % 3]
            c.rect(x, y, 7, 8 if row < 2 else 7, tone)
            c.hline(x, y, 7, "w")
            c.px(x + 3, y + 4, "w")
    # Шапка со знаком процента.
    c.round_rect(22, 0, 36, 12, "R", r=2)
    c.hline(23, 1, 34, "s")
    c.stamp(["w..w", "..w.", ".w..", "w..w"], 38, 4)
    c.outline("k")
    shadowed(c, 40, 49, 30, 3).save("promo")


def glow():
    """Пятно света 64×64: белое, мягко гаснет к краям; цвет и силу задаёт игра."""
    c = Canvas(64, 64)
    for y in range(64):
        for x in range(64):
            d = ((x - 31.5) ** 2 + (y - 31.5) ** 2) ** 0.5 / 32
            if d < 1:
                c.px(x, y, (255, 255, 255, int(255 * (1 - d) ** 1.8)))
    c.save("glow")


def effects():
    """Мелочи для эффектов: монетка, искра, облачко пыли, пузырь, запах, мусор разный."""
    c = Canvas(10, 10)
    c.ellipse(5, 5, 4.6, 4.6, "y")
    c.ellipse(4.6, 4.6, 3.4, 3.4, "Y")
    c.vline(5, 3, 4, "y")
    c.px(3, 3, "w")
    c.outline("k")
    c.save("coin")
    c = Canvas(7, 7)
    c.stamp(["...w...", "...Y...", "..YwY..", "wYwwwYw", "..YwY..", "...Y...", "...w..."])
    c.save("spark")
    c = Canvas(14, 10)
    for cx, cy, r in ((4, 6, 3.4), (8, 4, 3.8), (11, 6, 2.8), (7, 7, 3)):
        c.ellipse(cx, cy, r, r * 0.85, "w")
    c.ellipse(9, 6, 3, 2, "W")
    c.save("puff")
    c = Canvas(6, 6)
    c.ellipse(3, 3, 2.6, 2.6, "c")
    c.ellipse(3, 3, 1.6, 1.6, (255, 255, 255, 0))
    c.px(2, 1, "w")
    c.save("bubble_s")
    c = Canvas(14, 16)
    for x0 in (2, 7):
        for i, y in enumerate(range(14, 1, -2)):
            c.px(x0 + (1 if i % 2 else 0), y, "E")
            c.px(x0 + (1 if i % 2 else 0), y - 1, "e")
    c.save("stink")
    c = Canvas(12, 8)
    c.stamp(
        [
            "...........k",
            "..........kY",
            ".........kYk",
            "kk......kYYk",
            "kYk....kYYk.",
            ".kYYkkkYYk..",
            "..kyYYYYk...",
            "...kkkkk....",
        ]
    )
    c.save("trash_banana")
    c = Canvas(10, 12)
    c.rect(2, 2, 6, 9, "w")
    c.rect(2, 4, 6, 3, "R")
    c.hline(1, 1, 8, "W")
    c.vline(7, 2, 9, "W")
    c.outline("k")
    c.save("trash_cup")


def interior():
    mat()
    vending()
    pallet_water()
    promo()
    glow()
    effects()


# ---------------------------------------------------------------- улица


def grass():
    """Газон 32×32: два тона травы, редкие травинки и цветочки."""
    c = Canvas(32, 32)
    c.rect(0, 0, 32, 32, "j")
    rnd = random.Random(12)
    for _ in range(26):
        x, y = rnd.randrange(32), rnd.randrange(32)
        c.px(x, y, "J")
        c.px(x, (y + 1) % 32, "i")
    for _ in range(10):
        c.px(rnd.randrange(32), rnd.randrange(32), "i")
    c.px(7, 21, "Y")
    c.px(24, 9, "w")
    c.save("grass")


def paving():
    """Тротуарная плитка 32×32: кирпичики вразбежку."""
    c = Canvas(32, 32)
    c.rect(0, 0, 32, 32, "W")
    for row, y in enumerate(range(0, 32, 8)):
        c.hline(0, y, 32, "l")
        c.hline(0, y + 1, 32, "w")
        for x in range(8 if row % 2 else 0, 32, 16):
            c.vline(x, y, 8, "l")
            c.vline(x + 1, y + 1, 7, "w")
    c.speckle(0, 0, 32, 32, ["l"], 8, 3)
    c.save("paving")


def tree():
    """Дерево 48×56: крона из трёх тонов, ствол, тень."""
    c = Canvas(48, 56)
    c.ellipse(24, 50, 18, 5, (24, 20, 37, 70))
    c.rect(21, 34, 6, 16, "a")
    c.vline(21, 34, 16, "B")
    c.vline(26, 34, 16, "b")
    canopy = Canvas(48, 56)
    for cx, cy, r in ((24, 20, 17), (13, 26, 10), (35, 26, 10), (24, 9, 10)):
        canopy.ellipse(cx, cy, r, r * 0.9, "e")
    for cx, cy, r in ((19, 15, 7), (30, 13, 6), (14, 24, 4)):
        canopy.ellipse(cx, cy, r, r * 0.9, "E")
    for cx, cy, r in ((26, 30, 9), (36, 28, 5)):
        canopy.ellipse(cx, cy, r, r * 0.6, "d")
    rnd = random.Random(5)
    for _ in range(40):
        x, y = rnd.randrange(48), rnd.randrange(40)
        if canopy.get(x, y)[3]:
            canopy.px(x, y, rnd.choice(["E", "d", "e"]))
    canopy.outline("k")
    c.img.alpha_composite(canopy.img)
    c.save("tree")


def bush():
    c = Canvas(24, 18)
    c.ellipse(12, 10, 11, 7, "e")
    c.ellipse(9, 8, 6, 4, "E")
    c.ellipse(15, 12, 6, 3, "d")
    c.px(6, 7, "R")
    c.px(16, 6, "R")
    c.outline("k")
    c.save("bush")


def lamp():
    """Фонарь 16×56: столб, плафон; свет вечером рисует игра."""
    c = Canvas(16, 56)
    c.rect(7, 10, 3, 43, "g")
    c.vline(7, 10, 43, "G")
    c.rect(5, 50, 7, 3, "K")
    c.rect(2, 4, 12, 5, "K")
    c.hline(3, 4, 10, "G")
    c.rect(4, 8, 8, 2, "Y")
    c.hline(4, 9, 8, "y")
    c.outline("k")
    shadowed(c, 8, 53, 6, 2.5).save("lamp")


def bench():
    c = Canvas(36, 16)
    c.rect(1, 2, 34, 4, "B")
    c.hline(1, 2, 34, "n")
    c.rect(1, 7, 34, 4, "B")
    c.hline(1, 7, 34, "n")
    c.hline(1, 10, 34, "a")
    for x in (4, 30):
        c.rect(x, 11, 2, 4, "K")
    c.outline("k")
    c.save("bench")


def bin_():
    c = Canvas(12, 16)
    c.rect(1, 3, 10, 12, "e")
    c.vline(2, 3, 12, "E")
    c.vline(9, 3, 12, "d")
    c.rect(0, 1, 12, 3, "d")
    c.hline(0, 1, 12, "E")
    c.outline("k")
    c.save("bin")


def fence():
    """Забор участка «Сдаётся»: штакетник по горизонтали и по вертикали."""
    c = Canvas(32, 14)
    c.rect(0, 4, 32, 2, "a")
    c.rect(0, 10, 32, 2, "a")
    for x in range(1, 32, 6):
        c.rect(x, 1, 4, 13, "n")
        c.vline(x, 1, 13, "N")
        c.vline(x + 3, 1, 13, "B")
        c.hline(x, 0, 4, "k")
        c.px(x + 1, 0, "N")
    c.save("fence_h")
    c = Canvas(8, 32)
    c.rect(2, 0, 4, 32, "n")
    c.vline(2, 0, 32, "N")
    c.vline(5, 0, 32, "B")
    for y in range(0, 32, 8):
        c.hline(1, y, 6, "k")
    c.save("fence_v")


def for_rent():
    """Табличка на столбиках 56×36: игра пишет на ней «Сдаётся» и цену."""
    c = Canvas(56, 36)
    for x in (12, 42):
        c.rect(x, 20, 3, 13, "a")
        c.vline(x, 20, 13, "B")
    c.rect(2, 2, 52, 22, "N")
    c.frame(2, 2, 52, 22, "a")
    c.hline(3, 3, 50, "w")
    c.hline(3, 22, 50, "n")
    c.outline("k")
    shadowed(c, 28, 33, 22, 3).save("for_rent")


def awning():
    """Полосатый навес над входом 80×20 с фестонами."""
    c = Canvas(80, 20)
    for i, x in enumerate(range(0, 80, 8)):
        tone, shade = ("R", "r") if i % 2 == 0 else ("w", "W")
        c.rect(x, 0, 8, 14, tone)
        c.hline(x, 12, 8, shade)
        c.ellipse(x + 4, 14, 4, 3, tone)
        c.hline(x + 1, 16, 6, shade)
    c.hline(0, 0, 80, "m")
    c.outline("k")
    c.save("awning")


def car():
    """Машина сверху 64×30: кузов под тинт, стёкла, фары."""
    c = Canvas(64, 30)
    for x in (10, 46):
        c.rect(x, 1, 8, 3, "k")
        c.rect(x, 22, 8, 3, "k")
    c.round_rect(2, 3, 60, 20, "1", r=4)
    c.hline(4, 4, 56, "1")
    c.hline(4, 21, 56, "3")
    c.round_rect(18, 6, 28, 14, "2", r=2)
    c.rect(40, 6, 6, 14, "u")
    c.rect(18, 6, 5, 14, "u")
    c.vline(41, 7, 4, "c")
    c.rect(59, 5, 3, 4, "Y")
    c.rect(59, 17, 3, 4, "Y")
    c.rect(2, 5, 2, 4, "R")
    c.rect(2, 17, 2, 4, "R")
    c.outline("k")
    shadowed(c, 33, 26, 30, 4).save("car")


def sign():
    """Вывеска с названием магазина 128×26: доска с лампочками по краю."""
    c = Canvas(128, 26)
    c.round_rect(0, 0, 128, 26, "x", r=3)
    c.round_rect(3, 3, 122, 20, "p", r=2)
    c.hline(4, 4, 120, "P")
    for x in range(6, 124, 8):
        c.px(x, 1, "Y")
        c.px(x, 24, "Y")
    c.outline("k")
    c.save("sign")


def street():
    grass()
    paving()
    tree()
    bush()
    lamp()
    bench()
    bin_()
    fence()
    for_rent()
    awning()
    car()
    sign()


# ---------------------------------------------------------------- здание и участок (2)


def building():
    """Толстые стены, кирпичный фасад, витрины, раздвижные двери, роллет склада."""
    # Верх стены 16×16: тёмный бордюр с кирпичной крышкой.
    c = Canvas(16, 16)
    c.rect(0, 0, 16, 16, "z")
    for y in range(0, 16, 4):
        c.hline(0, y, 16, "p")
        off = 0 if (y // 4) % 2 == 0 else 4
        for x in range(off, 16, 8):
            c.vline(x, y, 4, "p")
    c.save("wall_cap")
    # Фасад 32×20: кирпич, сверху крышка стены, снизу цоколь.
    c = Canvas(32, 20)
    c.rect(0, 0, 32, 20, "B")
    for row, y in enumerate(range(4, 17, 3)):
        c.hline(0, y, 32, "a")
        for x in range(4 if row % 2 else 0, 32, 8):
            c.vline(x, y, 3, "a")
            c.px(x + 1, y + 1, "n")
    c.rect(0, 0, 4 + 28, 4, "z")
    c.hline(0, 3, 32, "k")
    c.hline(0, 0, 32, "p")
    c.rect(0, 17, 32, 3, "g")
    c.hline(0, 17, 32, "G")
    c.save("facade")
    # Витрина 40×14 (в мире 20×7): рама, стекло с бликами, товар за стеклом.
    c = Canvas(40, 14)
    c.rect(0, 0, 40, 14, "W")
    c.rect(2, 2, 36, 10, "u")
    for x, tone in ((4, "Y"), (9, "R"), (15, "E"), (21, "w"), (27, "o"), (32, "R")):
        c.rect(x, 7, 4, 5, tone)
        c.hline(x, 7, 4, "w")
    c.rect(2, 2, 36, 4, "U")
    for i in range(4):
        c.px(6 + i, 5 - i, "c")
        c.px(24 + i, 5 - i, "c")
    c.vline(20, 2, 10, "W")
    c.frame(0, 0, 40, 14, "k")
    c.save("shopwin")
    # Маленький навес над витриной 44×10.
    c = Canvas(44, 10)
    for i, x in enumerate(range(0, 44, 6)):
        tone = "E" if i % 2 == 0 else "w"
        c.rect(x, 0, 6, 7, tone)
        c.ellipse(x + 3, 7, 3, 2, tone)
    c.hline(0, 0, 44, "d")
    c.outline("k")
    c.save("awning_small")
    # Раздвижные двери 64×20: закрытые и открытые.
    for name, gap in (("door", 0), ("door_half", 11), ("door_open", 22)):
        c = Canvas(64, 20)
        c.rect(0, 0, 64, 20, "g")
        c.rect(2, 2, 60, 16, "K")
        half = 30 - gap
        for x, w in ((2, half), (62 - half, half)):
            if w <= 0:
                continue
            c.rect(x, 2, w, 16, "c")
            c.rect(x, 2, w, 3, "w")
            c.rect(x, 12, w, 6, "U")
            for i in range(3):
                c.px(x + 3 + i, 9 - i, "w")
            c.frame(x, 2, w, 16, "G")
        c.rect(0, 0, 64, 2, "l")
        c.frame(0, 0, 64, 20, "k")
        c.save(name)
    # Роллет склада 48×20.
    c = Canvas(48, 20)
    c.rect(0, 0, 48, 20, "l")
    for y in range(2, 19, 3):
        c.hline(2, y, 44, "G")
        c.hline(2, y + 1, 44, "W")
    c.rect(20, 15, 8, 3, "y")
    c.frame(0, 0, 48, 20, "k")
    c.save("shutter")


def lot2():
    """Заросший участок: земля, трава клочьями, камешки."""
    c = Canvas(32, 32)
    c.rect(0, 0, 32, 32, "a")
    c.speckle(0, 0, 32, 32, ["b", "B"], 18, 21)
    rnd = random.Random(8)
    for _ in range(5):
        cx, cy = rnd.randrange(32), rnd.randrange(32)
        for i in range(7):
            x, y = (cx + rnd.randrange(-3, 4)) % 32, (cy + rnd.randrange(-2, 3)) % 32
            c.px(x, y, rnd.choice(["i", "j", "J"]))
            c.px(x, (y - 1) % 32, "J")
    for x, y in ((6, 24), (25, 7), (14, 14)):
        c.rect(x, y, 2, 1, "W")
        c.px(x, y + 1, "G")
    c.save("lot")


def lot_props():
    """Что лежит на пустом участке: бурьян, кирпичи, песок, конус, шина, лужа."""
    c = Canvas(20, 16)
    rnd = random.Random(3)
    for i in range(14):
        x = 2 + rnd.randrange(16)
        h = 4 + rnd.randrange(9)
        for y in range(15 - h, 15):
            c.px(x + (1 if y < 15 - h // 2 and i % 2 else 0), y, rnd.choice(["i", "j", "J"]))
    c.px(5, 3, "Y")
    c.px(14, 5, "w")
    c.save("weeds")
    c = Canvas(32, 22)
    c.rect(1, 17, 30, 4, "B")
    c.hline(1, 17, 30, "n")
    for row, y in enumerate((11, 5)):
        for x in range(3 + row * 3, 28 - row * 3, 6):
            c.rect(x, y, 5, 6, "r")
            c.hline(x, y, 5, "R")
            c.vline(x + 4, y + 1, 5, "m")
    c.rect(4, 13, 25, 4, "r")
    c.outline("k")
    shadowed(c, 16, 20, 15, 2).save("bricks")
    c = Canvas(28, 14)
    c.ellipse(14, 9, 13, 5, "n")
    c.ellipse(11, 7, 7, 3.5, "N")
    c.speckle(3, 5, 22, 7, ["B"], 8, 4)
    c.outline("k")
    c.save("sand")
    c = Canvas(10, 14)
    c.rect(1, 11, 8, 3, "o")
    for y, w in ((1, 2), (4, 4), (7, 6)):
        c.rect(5 - w // 2, y, w, 4, "o")
    c.hline(3, 5, 4, "w")
    c.hline(2, 8, 6, "w")
    c.outline("k")
    c.save("cone")
    c = Canvas(16, 10)
    c.ellipse(8, 5, 7.5, 4.5, "K")
    c.ellipse(8, 5, 4, 2.2, "a")
    c.px(5, 3, "g")
    c.outline("k")
    c.save("tire")
    c = Canvas(30, 14)
    c.ellipse(15, 7, 14, 6, (90, 105, 136, 200))
    c.ellipse(12, 6, 7, 2.5, (139, 155, 180, 200))
    c.px(9, 5, "w")
    c.save("puddle")


def cars():
    """Машины сверху 72×36 в перспективе: кузов под тинт, крыша, стёкла, фары. Смотрят вправо."""
    def body(c, x0, x1, top, bottom):
        c.round_rect(x0, top, x1 - x0, bottom - top, "1", r=4)
        c.hline(x0 + 3, bottom - 2, x1 - x0 - 6, "3")
        c.hline(x0 + 3, bottom - 1, x1 - x0 - 6, "4")
        c.hline(x0 + 3, top + 1, x1 - x0 - 6, "1")

    def wheels(c, xs, top, bottom):
        for x in xs:
            c.rect(x, top - 1, 9, 3, "k")
            c.rect(x, bottom - 2, 9, 3, "k")

    # Фары и стоп-сигналы — отдельной картинкой, чтобы тинт кузова их не перекрашивал.
    lamps = {}

    def lights(c, x0, x1, top, bottom):
        lamp = Canvas(c.w, c.h)
        lamp.rect(x1 - 2, top + 2, 2, 4, "Y")
        lamp.rect(x1 - 2, bottom - 7, 2, 4, "Y")
        lamp.rect(x0, top + 2, 2, 4, "R")
        lamp.rect(x0, bottom - 7, 2, 4, "R")
        lamps["current"] = lamp

    def finish(c, name):
        c.outline("k")
        shadowed(c, 36, 32, 33, 3.5).save(name)
        lamps.pop("current").save(f"{name}_lights")

    # Седан.
    c = Canvas(72, 36)
    wheels(c, (12, 50), 6, 30)
    body(c, 3, 69, 6, 30)
    c.round_rect(22, 9, 30, 18, "2", r=3)
    c.rect(44, 9, 8, 18, "u")
    c.rect(22, 9, 6, 18, "u")
    c.vline(46, 10, 5, "c")
    c.hline(29, 9, 14, "U")
    c.hline(29, 26, 14, "U")
    lights(c, 3, 69, 6, 30)
    finish(c, "car_sedan")
    # Хэтчбек: короче, крыша до конца.
    c = Canvas(72, 36)
    wheels(c, (16, 46), 7, 29)
    body(c, 10, 64, 7, 29)
    c.round_rect(14, 10, 36, 16, "2", r=3)
    c.rect(42, 10, 8, 16, "u")
    c.rect(14, 10, 4, 16, "u")
    c.vline(44, 11, 4, "c")
    lights(c, 10, 64, 7, 29)
    finish(c, "car_hatch")
    # Такси: седан + шашечки и фонарь на крыше.
    c = Canvas(72, 36)
    wheels(c, (12, 50), 6, 30)
    body(c, 3, 69, 6, 30)
    c.round_rect(22, 9, 30, 18, "2", r=3)
    c.rect(44, 9, 8, 18, "u")
    c.rect(22, 9, 6, 18, "u")
    for x in range(5, 67, 4):
        c.rect(x, 6, 2, 2, "k")
        c.rect(x + 2, 28, 2, 2, "k")
    c.rect(33, 15, 6, 6, "w")
    c.rect(34, 16, 4, 4, "R")
    lights(c, 3, 69, 6, 30)
    finish(c, "car_taxi")
    # Фургон: высокая крыша во всю длину.
    c = Canvas(72, 36)
    wheels(c, (12, 52), 4, 32)
    body(c, 2, 70, 4, 32)
    c.round_rect(6, 7, 52, 22, "2", r=2)
    c.rect(58, 7, 7, 22, "u")
    c.vline(60, 8, 6, "c")
    c.hline(10, 18, 44, "3")
    lights(c, 2, 70, 4, 32)
    finish(c, "car_van")
    # Грузовик доставки: кабина и белый фургон с полосой.
    c = Canvas(88, 38)
    for x in (10, 26, 66):
        c.rect(x, 3, 9, 3, "k")
        c.rect(x, 32, 9, 3, "k")
    c.rect(2, 4, 60, 30, "w")
    c.hline(2, 32, 60, "W")
    c.hline(2, 33, 60, "l")
    c.rect(2, 16, 60, 6, "R")
    c.hline(2, 16, 60, "s")
    c.round_rect(63, 6, 22, 26, "1", r=3)
    c.rect(76, 8, 6, 22, "u")
    c.vline(78, 9, 6, "c")
    c.outline("k")
    shadowed(c, 44, 34, 42, 3.5).save("car_truck")
    lamp = Canvas(88, 38)
    lamp.rect(83, 8, 2, 4, "Y")
    lamp.rect(83, 26, 2, 4, "Y")
    lamp.rect(2, 6, 2, 4, "R")
    lamp.rect(2, 28, 2, 4, "R")
    lamp.save("car_truck_lights")


def floors():
    """Пол для больших уровней: прохладная плитка (3–4) и мрамор (5)."""
    c = Canvas(32, 32)
    light, dark, line, hi = (232, 238, 244, 255), (218, 226, 236, 255), (188, 198, 212, 255), (246, 249, 252, 255)
    for ox, oy, base in ((0, 0, light), (16, 16, light), (16, 0, dark), (0, 16, dark)):
        c.rect(ox, oy, 16, 16, base)
        c.hline(ox + 1, oy + 1, 14, hi)
        c.vline(ox + 1, oy + 1, 14, hi)
        c.hline(ox + 1, oy + 15, 15, line)
        c.vline(ox + 15, oy + 1, 15, line)
    for i in range(32):
        for x, y in ((i, 0), (0, i), (i, 16), (16, i)):
            c.px(x, y, line)
    c.save("floor2")
    c = Canvas(32, 32)
    c.rect(0, 0, 32, 32, (232, 226, 236, 255))
    rnd = random.Random(14)
    for _ in range(4):
        x, y = rnd.randrange(32), rnd.randrange(32)
        for i in range(10):
            c.px((x + i) % 32, (y + i // 2 + rnd.randrange(2)) % 32, (196, 186, 206, 255))
    for i in range(32):
        c.px(i, 0, (180, 170, 190, 255))
        c.px(0, i, (180, 170, 190, 255))
        c.px(i, 16, (205, 197, 214, 255))
        c.px(16, i, (205, 197, 214, 255))
    c.save("floor3")


def store_extras():
    """Стойка со сладостями у кассы и тележки у входа."""
    c = Canvas(26, 22)
    c.rect(1, 2, 24, 18, "G")
    c.rect(2, 3, 22, 16, "l")
    for row, y in enumerate((4, 9, 14)):
        for x in range(3, 22, 4):
            tone = ("R", "Y", "U", "E", "P", "o")[(row * 2 + x // 4) % 6]
            c.rect(x, y, 3, 4, tone)
            c.px(x, y, "w")
        c.hline(2, y + 4, 22, "G")
    c.rect(0, 0, 26, 2, "R")
    c.outline("k")
    shadowed(c, 13, 20, 12, 2).save("candy_rack")
    c = Canvas(34, 22)
    for i, x in enumerate((2, 8, 14)):
        c.frame(x, 3, 16, 12, "l")
        for gx in range(x + 3, x + 15, 3):
            c.vline(gx, 4, 10, "G")
        c.hline(x, 9, 16, "G")
        c.rect(x + 15, 1, 3, 3, "R")
    for x in (4, 26):
        c.rect(x, 17, 3, 3, "k")
    c.outline("k")
    shadowed(c, 17, 20, 15, 2).save("carts")


def weather_sprites():
    """Капля, брызги, снежинка, листик, зонт, ёлка."""
    c = Canvas(2, 8)
    c.vline(0, 0, 8, (192, 220, 255, 150))
    c.vline(1, 2, 6, (230, 240, 255, 200))
    c.save("raindrop")
    c = Canvas(8, 4)
    c.ellipse(4, 2, 3.6, 1.6, (220, 235, 255, 160))
    c.ellipse(4, 2, 2.2, 0.8, (0, 0, 0, 0))
    c.save("splash")
    c = Canvas(4, 4)
    c.stamp([".w..", "wWw.", ".w..", "...."])
    c.save("snowflake")
    c = Canvas(5, 4)
    c.stamp([".11.", "1111", "11.1", "...1"])
    c.save("leaf")
    c = Canvas(32, 32)
    c.rect(0, 0, 32, 32, (236, 242, 252, 235))
    c.speckle(0, 0, 32, 32, [(206, 220, 240, 235), (255, 255, 255, 255)], 30, 17)
    c.save("snow_ground")
    c = Canvas(20, 12)
    c.ellipse(10, 6, 9.5, 5, "1")
    c.ellipse(10, 7, 9.5, 3, "2")
    for x in (3, 10, 17):
        c.vline(x, 4, 5, "3")
    c.rect(9, 0, 2, 2, "K")
    c.outline("k")
    c.save("umbrella")
    # Ёлка 28×44: ярусы, игрушки, звезда, ведро.
    c = Canvas(28, 44)
    for i, (y, w) in enumerate(((6, 8), (12, 14), (19, 20), (27, 26))):
        for row in range(8):
            half = int(w / 2 * (row + 2) / 9)
            c.hline(14 - half, y + row, half * 2, "e" if row % 3 else "E")
    c.rect(12, 35, 4, 3, "a")
    c.rect(9, 37, 10, 6, "R")
    c.hline(9, 37, 10, "s")
    for x, y, tone in ((10, 14, "R"), (17, 17, "Y"), (8, 23, "U"), (19, 25, "R"), (12, 30, "Y"), (6, 32, "P"), (21, 31, "U")):
        c.px(x, y, tone)
        c.px(x, y + 1, tone)
    c.outline("k")
    c.stamp(["..Y..", ".YYY.", "YYwYY", ".YYY.", "Y...Y"], 12, 0)
    shadowed(c, 14, 42, 10, 2).save("xmas_tree")


def neighborhood():
    """Крыши соседних зданий, кондиционеры, окно в крыше, остановка, автобус."""
    c = Canvas(32, 32)
    c.rect(0, 0, 32, 32, "G")
    for y in range(0, 32, 8):
        c.hline(0, y, 32, "g")
        c.hline(0, y + 1, 32, "l")
    c.speckle(0, 0, 32, 32, ["g", "l"], 14, 31)
    c.save("roof")
    c = Canvas(22, 16)
    c.rect(1, 2, 20, 12, "W")
    c.hline(1, 2, 20, "w")
    c.ellipse(11, 8, 5, 4.5, "l")
    for i in range(-4, 5, 2):
        c.hline(7, 8 + i // 2, 9, "G")
    c.vline(20, 2, 12, "l")
    c.outline("k")
    shadowed(c, 12, 14, 10, 2).save("ac_unit")
    c = Canvas(24, 18)
    c.rect(1, 1, 22, 16, "W")
    c.rect(3, 3, 18, 12, "U")
    c.rect(3, 3, 18, 4, "c")
    c.vline(12, 3, 12, "W")
    c.outline("k")
    c.save("skylight")
    # Остановка 64×40: стеклянный навес, скамейка, табличка «А».
    c = Canvas(64, 40)
    c.rect(2, 4, 60, 6, "u")
    c.hline(2, 4, 60, "U")
    c.rect(4, 10, 56, 20, (180, 220, 240, 120))
    for x in (4, 59):
        c.rect(x, 10, 2, 24, "g")
    c.rect(10, 26, 44, 4, "B")
    c.hline(10, 26, 44, "n")
    c.rect(48, 0, 12, 10, "Y")
    c.frame(48, 0, 12, 10, "k")
    c.stamp(["..k..", ".k.k.", "kkkkk", "k...k"], 52, 3)
    c.outline("k")
    shadowed(c, 32, 36, 30, 3).save("bus_stop")
    # Автобус 120×42: кузов под тинт, окна, двери, фары.
    c = Canvas(120, 42)
    for x in (16, 92):
        c.rect(x, 3, 12, 3, "k")
        c.rect(x, 36, 12, 3, "k")
    c.round_rect(2, 5, 116, 32, "1", r=4)
    c.hline(4, 34, 112, "3")
    c.rect(8, 9, 98, 24, "2")
    for x in range(10, 104, 12):
        c.rect(x, 9, 9, 5, "u")
        c.rect(x, 28, 9, 5, "u")
    c.rect(106, 8, 10, 26, "u")
    c.vline(108, 9, 8, "c")
    c.outline("k")
    shadowed(c, 60, 38, 58, 4).save("bus")
    lamp = Canvas(120, 42)
    lamp.rect(116, 8, 2, 5, "Y")
    lamp.rect(116, 29, 2, 5, "Y")
    lamp.rect(2, 8, 2, 5, "R")
    lamp.rect(2, 29, 2, 5, "R")
    lamp.save("bus_lights")


def construction():
    """Строительные леса 40×44 и конфетти."""
    c = Canvas(40, 44)
    for x in (3, 19, 35):
        c.rect(x, 0, 2, 44, "l")
        c.vline(x, 0, 44, "W")
    for y in (8, 22, 36):
        c.rect(1, y, 38, 3, "B")
        c.hline(1, y, 38, "n")
    for i in range(14):
        c.px(5 + i, 10 + i, "G")
        c.px(21 + i, 24 - i, "G")
    c.outline("k")
    c.save("scaffold")
    c = Canvas(4, 3)
    c.rect(0, 0, 4, 3, "w")
    c.save("confetti")


def environment2():
    building()
    lot2()
    lot_props()
    cars()
    floors()
    store_extras()
    weather_sprites()
    neighborhood()
    construction()


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


HAIR["ponytail"] = HAIR["short"]
HAIR["curly"] = [
    ".......kkkkkkkkkk.......",
    ".....kk1112111211kk.....",
    "....k11211121112111k....",
    "...k1121111111111121k...",
    "...k1111211112111211k...",
    "...k121k11111111k121k...",
    "...k11k..........k11k...",
    "...k12k..........k21k...",
    "....kk............kk....",
]
HAIR_OFFSET = {"short": 3, "long": 3, "bun": 0, "cap": 2, "bald": 3, "ponytail": 3, "curly": 1}


def grid(rows, offset=0):
    """Слой 24×36 как список строк-списков; строки сдвинуты вниз на offset."""
    g = [["."] * 24 for _ in range(36)]
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            g[offset + dy][dx] = ch
    return g


def save_grid(g, name):
    c = Canvas(24, 36)
    c.stamp(["".join(r) for r in g])
    c.save(name)


# Голова спереди: всё непрозрачное в SKIN до 15-й строки.
HEAD = {(x, y) for y in range(3, 16) for x in range(24) if SKIN[y][x] != "."}


def back_skin():
    g = grid(SKIN)
    for y in range(10, 14):
        for x in range(6, 17):
            if g[y][x] in "k56":
                g[y][x] = "1"
    save_grid(g, "p_skin_b")


def back_shirt():
    g = grid(SHIRT)
    g[16] = list("......kkkkkkkkkkkk......")
    g[17][11] = "1"
    g[17][13] = "1"
    save_grid(g, "p_shirt_b")


def back_hair(style):
    """Затылок: волосы закрывают голову до своей длины."""
    c = Canvas(24, 36)
    cutoff = {"short": 12, "long": 15, "bun": 12, "cap": 8, "ponytail": 12, "curly": 13, "bald": 12}[style]
    top = 9 if style == "bald" else 0
    for x, y in HEAD:
        if top <= y <= cutoff and SKIN[y][x] != "k":
            c.px(x, y, "2" if x >= 16 or y == cutoff else "1")
    if style == "long":
        for y in range(16, 21):
            c.hline(5, y, 14, "1")
            c.px(17, y, "2")
            c.px(18, y, "2")
    if style == "bun":
        c.ellipse(12, 2, 2.6, 2.2, "1")
    if style == "cap":
        c.hline(5, 8, 14, "3")
    if style == "ponytail":
        c.rect(11, 13, 2, 7, "1")
        c.px(12, 19, "2")
    if style == "curly":
        for x, y in grid_points(HAIR["curly"], HAIR_OFFSET["curly"]):
            c.px(x, y, "1")
        for x, y in ((8, 5), (13, 4), (16, 7), (10, 9), (14, 11)):
            c.px(x, y, "2")
    c.outline("k")
    if style == "ponytail":
        c.hline(11, 13, 2, "k")
    c.save(f"p_hair_{style}_b")


def grid_points(rows, offset):
    return [(x, y + offset) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch not in ".k"]


def side_skin():
    c = Canvas(24, 36)
    c.round_rect(7, 4, 11, 12, "1", r=2)
    c.vline(7, 6, 8, "2")
    c.hline(9, 15, 7, "2")
    c.px(18, 10, "1")
    c.rect(11, 16, 3, 1, "2")
    c.rect(13, 24, 2, 2, "1")
    c.px(14, 25, "2")
    c.outline("k")
    c.px(15, 9, "k")
    c.px(15, 10, "k")
    c.px(14, 12, "5")
    c.px(16, 13, "6")
    c.px(10, 10, "2")
    c.px(10, 11, "2")
    c.save("p_skin_s")


def side_shirt():
    c = Canvas(24, 36)
    c.round_rect(8, 17, 8, 11, "1", r=1)
    c.vline(8, 18, 9, "2")
    c.hline(8, 26, 8, "2")
    c.hline(8, 27, 8, "3")
    c.outline("k")
    # Рука спереди.
    c.vline(11, 18, 7, "k")
    c.rect(12, 18, 3, 7, "1")
    c.vline(14, 19, 6, "2")
    c.hline(12, 25, 3, "k")
    c.save("p_shirt_s")


def side_legs():
    c = Canvas(24, 36)
    c.rect(9, 27, 6, 6, "1")
    c.vline(14, 27, 6, "2")
    c.rect(9, 33, 8, 2, "K")
    c.outline("k")
    c.save("p_legs0_s")
    c = Canvas(24, 36)
    c.rect(7, 30, 4, 3, "2")
    c.rect(10, 27, 5, 3, "1")
    c.rect(12, 30, 4, 3, "1")
    c.rect(5, 33, 5, 2, "K")
    c.rect(12, 33, 6, 2, "K")
    c.outline("k")
    c.save("p_legs1_s")
    # Второй шаг: другая нога впереди (дальняя — в тени).
    c = Canvas(24, 36)
    c.rect(12, 30, 4, 3, "2")
    c.rect(9, 27, 5, 3, "1")
    c.rect(7, 30, 4, 3, "1")
    c.rect(5, 33, 5, 2, "K")
    c.rect(12, 33, 6, 2, "K")
    c.outline("k")
    c.save("p_legs2_s")


def side_hair(style):
    c = Canvas(24, 36)
    if style in ("short", "long", "bun", "ponytail"):
        c.round_rect(6, 3, 12, 4, "1", r=1)
        c.rect(6, 6, 4, 6, "1")
        c.vline(6, 6, 6, "2")
        c.px(16, 6, "2")
    if style == "long":
        c.rect(5, 6, 5, 15, "1")
        c.vline(5, 8, 13, "2")
    if style == "bun":
        c.ellipse(6, 4, 2.6, 2.4, "1")
    if style == "ponytail":
        c.rect(3, 7, 4, 3, "1")
        c.rect(2, 10, 3, 5, "1")
        c.px(2, 14, "2")
    if style == "cap":
        c.round_rect(6, 2, 12, 6, "1", r=2)
        c.px(12, 4, "Y")
        c.hline(6, 7, 12, "3")
        c.rect(16, 7, 5, 2, "3")
    if style == "bald":
        c.rect(7, 8, 3, 4, "1")
    if style == "curly":
        c.ellipse(12, 6, 7.5, 4.5, "1")
        c.ellipse(8, 10, 4, 4.5, "1")
        for x, y in ((9, 4), (14, 3), (7, 9), (12, 7)):
            c.px(x, y, "2")
    c.outline("k")
    c.save(f"p_hair_{style}_s")


# Форма персонала: фартук (тинт), жилет грузчика, значок охранника. _b — спина, _s — бок.
def uniforms():
    c = Canvas(24, 36)
    c.rect(8, 19, 8, 9, "1")
    c.vline(15, 19, 9, "2")
    c.hline(10, 24, 4, "3")
    c.vline(9, 17, 2, "1")
    c.vline(14, 17, 2, "1")
    c.outline("k")
    c.rect(10, 20, 3, 1, "G")
    c.save("acc_apron")
    c = Canvas(24, 36)
    for i in range(5):
        c.px(9 + i // 2, 17 + i, "1")
        c.px(14 - i // 2, 17 + i, "1")
    c.rect(10, 22, 4, 2, "1")
    c.px(9, 24, "1")
    c.px(14, 24, "1")
    c.outline("k")
    c.save("acc_apron_b")
    c = Canvas(24, 36)
    c.rect(15, 19, 2, 9, "1")
    c.px(13, 17, "1")
    c.px(14, 18, "1")
    c.outline("k")
    c.save("acc_apron_s")

    def stripes(c, x, w):
        for y in (21, 24):
            c.hline(x, y, w, "w")

    c = Canvas(24, 36)
    c.rect(6, 17, 5, 10, "o")
    c.rect(13, 17, 5, 10, "o")
    stripes(c, 6, 5)
    stripes(c, 13, 5)
    c.outline("k")
    c.save("acc_vest")
    c = Canvas(24, 36)
    c.rect(6, 17, 12, 10, "o")
    stripes(c, 6, 12)
    c.outline("k")
    c.save("acc_vest_b")
    c = Canvas(24, 36)
    c.rect(8, 17, 3, 10, "o")
    c.rect(15, 17, 1, 10, "o")
    stripes(c, 8, 3)
    c.outline("k")
    c.save("acc_vest_s")
    c = Canvas(24, 36)
    c.stamp(["YY", "yy"], 8, 19)
    c.save("acc_badge")


def emotes():
    """Эмоции над головой 12×12: злость, сердечко, вопрос."""
    for name, rows in {
        "emo_angry": [
            "............",
            "..k......k..",
            ".kRk....kRk.",
            ".kRRk..kRRk.",
            "..kRRkkRRk..",
            "...kRRRRk...",
            "...kRRRRk...",
            "..kRRkkRRk..",
            ".kRRk..kRRk.",
            ".kRk....kRk.",
            "..k......k..",
            "............",
        ],
        "emo_heart": [
            "............",
            "..kkk..kkk..",
            ".kRwRkkRRRk.",
            ".kRwRRRRRRk.",
            ".kRRRRRRRrk.",
            "..kRRRRRrk..",
            "...kRRRrk...",
            "....kRrk....",
            ".....kk.....",
            "............",
            "............",
            "............",
        ],
        "emo_question": [
            "..kkkkkkk...",
            ".kwwwwwwwk..",
            "kwwwkkkwwwk.",
            "kwwkwwwkwwk.",
            "kwwwwwkwwwk.",
            "kwwwwkwwwwk.",
            "kwwwwwwwwwk.",
            "kwwwwkwwwwk.",
            ".kwwwwwwwk..",
            "..kkkkkkk...",
            "....kk......",
            "...k........",
        ],
    }.items():
        c = Canvas(12, 12)
        c.stamp(rows)
        c.save(name)


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
        c.save(f"p_legs{i}_b")
    for style, rows in HAIR.items():
        c = Canvas(24, 36)
        c.stamp(rows, 0, HAIR_OFFSET[style])
        c.save(f"p_hair_{style}")
        back_hair(style)
        side_hair(style)
    back_skin()
    back_shirt()
    side_skin()
    side_shirt()
    side_legs()
    uniforms()
    emotes()
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


# ---------------------------------------------------------------- интерфейс


def ui_frame():
    """Рамка окна 24×24 для border-image: тёмный контур, светлая фаска, кремовая середина."""
    c = Canvas(24, 24)
    c.round_rect(0, 0, 24, 24, "k", r=2)
    c.round_rect(1, 1, 22, 22, "B", r=1)
    c.rect(2, 2, 20, 20, "a")
    c.rect(3, 3, 18, 18, (244, 236, 216, 255))
    c.hline(3, 3, 18, "w")
    c.vline(3, 3, 18, "w")
    c.hline(2, 1, 20, "n")
    c.vline(1, 2, 20, "n")
    c.save("ui_frame")


def rgb(hex_):
    return (int(hex_[1:3], 16), int(hex_[3:5], 16), int(hex_[5:7], 16), 255)


def shade(color, k):
    return tuple(max(0, min(255, int(v * k))) for v in color[:3]) + (255,)


def portrait(name, bg, skin, hair, shirt, draw_hair, extras=None):
    """Портрет 32×32: голова и плечи на цветном фоне. Причёску и детали рисуют функции."""
    skin, hair, shirt, bg = rgb(skin), rgb(hair), rgb(shirt), rgb(bg)
    c = Canvas(32, 32)
    c.round_rect(0, 0, 32, 32, bg, r=4)
    c.ellipse(16, 10, 13, 9, shade(bg, 1.12))
    p = Canvas(32, 32)
    p.ellipse(16, 32, 13, 7.5, shirt)
    p.ellipse(19, 33, 9, 6, shade(shirt, 0.82))
    p.rect(13, 21, 6, 5, shade(skin, 0.86))
    p.ellipse(16, 14, 7.5, 8.5, skin)
    p.ellipse(19.5, 16, 3.5, 6, shade(skin, 0.92))
    p.px(8, 14, skin)
    p.px(24, 14, shade(skin, 0.9))
    draw_hair(p, hair)
    p.outline("k")
    # Лицо.
    for x in (12, 19):
        p.rect(x, 14, 2, 2, "k")
        p.px(x, 14, "w")
    p.px(16, 17, shade(skin, 0.8))
    p.hline(15, 19, 3, shade(skin, 0.6))
    p.px(11, 17, rgb("#f6757a"))
    p.px(21, 17, rgb("#f6757a"))
    if extras:
        extras(p, skin, hair, shirt)
    c.img.alpha_composite(p.img)
    c.save(f"portrait_{name}")


def hair_bun(p, hair):
    p.ellipse(16, 8, 8.5, 5, hair)
    p.ellipse(16, 2.5, 3.5, 2.5, hair)
    p.rect(8, 8, 2, 6, hair)
    p.rect(22, 8, 2, 6, hair)
    p.px(13, 6, shade(hair, 1.15))


def hair_curly(p, hair):
    for cx, cy in ((10, 9), (14, 6), (18, 6), (22, 9), (9, 13), (23, 13), (16, 5)):
        p.ellipse(cx, cy, 3.4, 3.2, hair)
    p.px(14, 5, shade(hair, 1.15))


def hair_chef(p, hair):
    p.ellipse(16, 9, 8, 3.5, rgb("#4a2c1a"))
    p.rect(9, 3, 14, 5, rgb("#ffffff"))
    for cx in (11, 16, 21):
        p.ellipse(cx, 2.5, 3.2, 2.6, rgb("#ffffff"))
    p.hline(9, 7, 14, rgb("#c0cbdc"))


def hair_slick(p, hair):
    p.ellipse(16, 8, 8.5, 4.5, hair)
    p.rect(8, 8, 2, 4, hair)
    p.rect(22, 8, 2, 4, hair)
    p.hline(11, 6, 8, shade(hair, 1.4))


def hair_cap(p, hair):
    p.ellipse(16, 7, 9, 4.5, hair)
    p.rect(7, 8, 18, 2, shade(hair, 0.7))
    p.rect(14, 4, 4, 3, rgb("#feae34"))


def hair_straw(p, hair):
    p.ellipse(16, 8, 13, 3, rgb("#e4a672"))
    p.ellipse(16, 5, 7, 4, rgb("#ead4aa"))
    p.hline(9, 7, 14, rgb("#b86f50"))


def hair_scarf(p, hair):
    p.ellipse(16, 7, 9.5, 5.5, hair)
    p.rect(7, 8, 3, 11, hair)
    p.rect(22, 8, 3, 11, hair)
    for x, y in ((11, 5), (17, 4), (21, 7), (13, 9), (8, 14), (23, 12)):
        p.px(x, y, rgb("#ffffff"))


def hair_bald(p, hair):
    p.rect(8, 11, 2, 4, hair)
    p.rect(22, 11, 2, 4, hair)


def hair_net(p, hair):
    p.ellipse(16, 8, 8.5, 5, hair)
    p.ellipse(16, 7, 9, 4, rgb("#c0cbdc"))
    for x in range(9, 24, 2):
        p.px(x, 7, rgb("#8b9bb4"))


def glasses(p, skin, hair, shirt):
    for x in (11, 18):
        p.frame(x, 13, 4, 4, "G")
        p.px(x + 1, 14, "k")
        p.px(x + 2, 15, "k")
        p.px(x + 1, 15, "k")
    p.hline(15, 14, 3, "G")


def mustache(p, skin, hair, shirt):
    p.hline(13, 18, 7, hair)
    p.px(12, 19, hair)
    p.px(20, 19, hair)


def beard(p, skin, hair, shirt):
    p.ellipse(16, 20, 6, 3.2, rgb("#8b9bb4"))
    p.hline(14, 19, 5, shade(skin, 0.6))


def tie(p, skin, hair, shirt):
    p.rect(15, 25, 2, 6, rgb("#e43b44"))
    p.px(14, 25, rgb("#ffffff"))
    p.px(17, 25, rgb("#ffffff"))


def badge(p, skin, hair, shirt):
    p.rect(20, 27, 3, 3, rgb("#feae34"))


def apron(p, skin, hair, shirt):
    p.rect(12, 26, 8, 6, rgb("#ffffff"))
    p.px(14, 28, rgb("#e43b44"))


def portraits():
    portrait("grandma", "#b55088", "#f2d3ab", "#d8d8e0", "#68386c", hair_bun, glasses)
    portrait("valya", "#e43b44", "#eec39a", "#c0cbdc", "#a22633", hair_curly)
    portrait("marat", "#feae34", "#d9a066", "#4a2c1a", "#ffffff", hair_chef, mustache)
    portrait("eduard", "#262b44", "#f2d3ab", "#181425", "#3a4466", hair_slick, tie)
    portrait("inspector", "#5a6988", "#eec39a", "#262b44", "#262b44", hair_cap, badge)
    portrait("farmer", "#63c74d", "#e4a672", "#8b9bb4", "#3e8948", hair_straw, beard)
    portrait("dairy", "#0099db", "#f2d3ab", "#0099db", "#ffffff", hair_scarf)
    portrait("butcher", "#a22633", "#eec39a", "#733e39", "#c0cbdc", hair_bald, lambda p, *a: (mustache(p, *a), apron(p, *a)))
    portrait("school", "#fee761", "#f2d3ab", "#733e39", "#5fcde4", hair_net)


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
    street()
    interior()
    shelf()
    stand()
    fridge()
    counter()
    wc()
    door()
    box()
    crates()
    trash()
    items()
    people()
    decor()
    ui_bits()
    ui_frame()
    portraits()
    icon()
    environment2()
    print("готово:", sorted(p.name for p in OUT.glob("*.png")))


if __name__ == "__main__":
    main()
