"""Гардероб покупателей: головные уборы, одежда, вещи в руках, на спине и на лице.

Каждая вещь рисуется в трёх видах: спереди (имя), со спины (_b) и сбоку (_s, лицом вправо —
влево игра отражает). Координаты — как у человечка 24×36 (sprites.SKIN): голова спереди
x 4…19, y 3…16, плечи y 17, руки x 3…6 и 18…22, ладони y 24…26, ноги y 27…34; сбоку голова
x 7…17, лицо смотрит вправо, рука x 11…14.

Шляпы, вещи и то, что на спине, могут торчать за пределы человечка (перья, флаг, гитара),
поэтому их холст больше: 40×44, человечек в нём сдвинут на (8, 8). Игра ставит такие слои
на 2 точки выше (src/scenes/wardrobe.ts). Одежда и лицо — обычные 24×36.

Цвета: символы палитры sprites.PALETTE. Белое и серое ('1'…'4') перекрашивается тинтом
(цвет платка, худи, платья), остальное — как нарисовано.

    python3 art/sprites.py
"""

from sprites import PALETTE, Canvas, rgba

BIG_W, BIG_H, OX, OY = 40, 44, 8, 8


class Big(Canvas):
    """Холст 40×44 в координатах человечка: (0, 0) человечка — это (8, 8) холста."""

    def __init__(self):
        super().__init__(BIG_W, BIG_H)

    def px(self, x, y, ch):
        super().px(int(x) + OX, int(y) + OY, ch)

    def get(self, x, y):
        return super().get(int(x) + OX, int(y) + OY)

    def outline(self, ch="k"):
        raw_get, raw_px = Canvas.get, Canvas.px
        solid = {(x, y) for y in range(self.h) for x in range(self.w) if raw_get(self, x, y)[3] > 0}
        for x, y in list(solid):
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if (nx, ny) not in solid:
                    raw_px(self, nx, ny, ch)


def small():
    return Canvas(24, 36)


# ---------------------------------------------------------------- головные уборы
# Голова спереди: верх y 3, лоб y 6…8, уши на уровне y 9…11, края x 4 и 19.


def hat_feathers(v):
    """Карнавальный убор: золотой обруч с камнем и веер перьев."""
    c = Big()
    if v == "s":
        for cx, cy, rx, ry, col in ((6, 1, 2.2, 6, "E"), (9, -1, 2.2, 7, "U"), (12, -2, 2.2, 7, "P"), (14.5, 0, 2, 5.5, "Y")):
            c.ellipse(cx, cy, rx, ry, col)
            c.vline(int(cx), int(cy - ry + 2), int(ry * 2 - 3), "w")
        c.rect(8, 5, 9, 2, "Y")
        c.hline(8, 6, 9, "y")
        c.px(15, 5, "R")
    else:
        for cx, cy, rx, ry, col in (
            (3.5, 3, 2.2, 5, "E"),
            (19.5, 3, 2.2, 5, "E"),
            (6.5, -1, 2.4, 6.5, "U"),
            (16.5, -1, 2.4, 6.5, "U"),
            (11.5, -3, 2.8, 8, "P"),
        ):
            c.ellipse(cx, cy, rx, ry, col)
            c.vline(int(cx), int(cy - ry + 2), int(ry * 2 - 3), "s" if col == "P" else "w")
        c.ellipse(9, 0, 1.8, 5, "Y")
        c.ellipse(14, 0, 1.8, 5, "Y")
        c.rect(5, 5, 14, 2, "Y")
        c.hline(5, 6, 14, "y")
        if v == "f":
            c.rect(11, 4, 2, 2, "R")
            c.px(11, 4, "s")
            c.px(7, 5, "c")
            c.px(16, 5, "c")
    c.outline("k")
    return c


def hat_shako(v):
    """Кивер оркестранта: высокий красный, золотая кокарда, белый плюмаж, чёрный козырёк."""
    c = Big()
    if v == "s":
        c.rect(8, -2, 8, 8, "R")
        c.vline(8, -2, 8, "r")
        c.hline(8, -2, 8, "Y")
        c.hline(8, 4, 8, "Y")
        c.ellipse(13, -5, 1.8, 3, "w")
        c.rect(15, 6, 4, 1, "K")
        c.hline(8, 6, 8, "K")
    else:
        c.rect(6, -2, 12, 8, "R")
        c.vline(6, -2, 8, "r")
        c.vline(17, -2, 8, "r")
        c.hline(6, -2, 12, "Y")
        c.hline(6, 4, 12, "Y")
        c.ellipse(11.5, -5, 2, 3, "w")
        c.px(11, -6, "W")
        c.hline(5, 6, 14, "K")
        if v == "f":
            c.ellipse(11.5, 1, 2, 2, "Y")
            c.px(11, 0, "w")
            c.hline(6, 7, 2, "Y")
            c.hline(16, 7, 2, "Y")
    c.outline("k")
    return c


# ---------------------------------------------------------------- одежда (поверх рубашки)
# Спереди: тело x 7…18, y 16…27; рукава x 3…6 и 18…22, y 18…24. Сбоку: тело x 8…15, рука x 12…14.


def outfit_samba(v):
    """Костюм танцора: блестящий топ с оборками на плечах, пояс с бахромой."""
    c = small()
    if v == "s":
        c.rect(8, 17, 8, 6, "P")
        c.ellipse(13, 18, 2.5, 1.6, "Y")
        c.rect(8, 25, 8, 2, "Y")
        for x in range(8, 16):
            c.vline(x, 27, 2 + (x % 2), "Y" if x % 2 else "o")
        for x, y in ((9, 19), (11, 21), (14, 20)):
            c.px(x, y, "Y")
    else:
        c.rect(7, 17, 11, 6, "P")
        c.ellipse(5, 18, 2.6, 1.8, "Y")
        c.ellipse(19.5, 18, 2.6, 1.8, "Y")
        c.rect(6, 25, 13, 2, "Y")
        c.hline(6, 26, 13, "y")
        for x in range(6, 19):
            c.vline(x, 27, 2 + (x % 2), "Y" if x % 2 else "o")
        if v == "f":
            for x, y in ((8, 18), (10, 20), (12, 18), (14, 21), (16, 19), (9, 22), (15, 17)):
                c.px(x, y, "Y")
            c.px(12, 25, "c")
        else:
            c.hline(7, 19, 11, "p")
    c.outline("k")
    return c


def outfit_band(v):
    """Мундир оркестра: красный, золотые пуговицы и эполеты, белые перевязи."""
    c = small()
    if v == "s":
        c.rect(8, 17, 8, 10, "R")
        c.vline(8, 17, 10, "r")
        c.rect(12, 18, 3, 7, "R")
        c.vline(14, 18, 7, "r")
        c.hline(12, 24, 3, "Y")
        c.rect(10, 17, 3, 1, "Y")
        for y in (19, 22):
            c.px(15, y, "Y")
    else:
        c.rect(7, 17, 11, 10, "R")
        c.rect(3, 18, 4, 7, "R")
        c.rect(18, 18, 4, 7, "R")
        c.hline(3, 24, 4, "Y")
        c.hline(18, 24, 4, "Y")
        c.rect(4, 17, 4, 2, "Y")
        c.rect(17, 17, 4, 2, "Y")
        c.hline(7, 26, 11, "r")
        for i in range(8):
            c.px(8 + i, 18 + i, "w")
            c.px(16 - i, 18 + i, "w")
        if v == "f":
            for y in (19, 21, 23):
                c.px(12, y, "Y")
    c.outline("k")
    return c


# ---------------------------------------------------------------- вещи в руках
# Ладони спереди: левая x 4…5, правая x 18…19, y 24…25. Сбоку ладонь x 13…14, y 24…25.


def prop_maracas(v):
    """Маракасы в обеих руках."""
    c = Big()
    spots = ((13, 21),) if v == "s" else ((4, 21), (19, 21))
    for x, y in spots:
        c.vline(x, y + 1, 3, "B")
        c.ellipse(x + 0.5, y - 1, 2, 2.4, "R")
        c.px(x, y - 2, "Y")
        c.px(x + 1, y, "Y")
        c.px(x - 1, y - 1, "s")
    c.outline("k")
    return c


def prop_trumpet(v):
    """Труба: спереди раструб у губ, сбоку — вдоль, раструбом вперёд."""
    c = Big()
    if v == "s":
        c.hline(16, 12, 6, "Y")
        c.hline(16, 13, 6, "y")
        c.rect(18, 10, 2, 2, "y")
        c.ellipse(23, 12.5, 1.6, 3, "Y")
        c.px(23, 12, "w")
        c.rect(13, 13, 2, 3, "y")
    elif v == "f":
        c.ellipse(11.5, 14, 3.2, 2.6, "Y")
        c.ellipse(11.5, 14, 1.6, 1.2, "y")
        c.px(10, 13, "w")
        c.rect(14, 15, 4, 2, "y")
    else:
        c.ellipse(20, 12, 1.4, 1.4, "Y")
    c.outline("k")
    return c


def prop_drum(v):
    """Барабан на ремне и палочки."""
    c = Big()
    if v == "s":
        c.rect(13, 21, 7, 7, "R")
        c.vline(19, 21, 7, "r")
        for y in (21, 27):
            c.hline(13, y, 7, "W")
        for i in range(3):
            c.px(14 + i * 2, 23 + (i % 2) * 2, "Y")
        c.line(15, 18, 18, 21, "N")
    elif v == "f":
        c.rect(6, 22, 12, 6, "R")
        c.vline(17, 22, 6, "r")
        c.ellipse(11.5, 22, 6, 1.6, "W")
        c.hline(6, 27, 12, "W")
        for i in range(5):
            c.px(7 + i * 2, 24 + (i % 2) * 2, "Y")
        c.line(4, 22, 8, 19, "N")
        c.line(19, 22, 15, 19, "N")
    else:
        c.rect(4, 22, 2, 6, "R")
        c.rect(18, 22, 2, 6, "R")
    c.outline("k")
    return c


def prop_flag(v):
    """Флажок на древке: красно-жёлто-зелёный праздничный."""
    c = Big()
    if v == "s":
        pole, flag = 14, range(5, 14)
    elif v == "f":
        pole, flag = 19, range(20, 29)
    else:
        pole, flag = 4, range(-5, 4)
    c.vline(pole, -6, 31, "B")
    for i, x in enumerate(flag):
        wave = 1 if (i // 3) % 2 else 0
        for row, col in enumerate(("R", "R", "Y", "Y", "E", "E")):
            c.px(x, -5 + row + wave, col)
    c.px(pole, -7, "Y")
    c.outline("k")
    return c


def prop_balloon(v):
    """Воздушный шарик на нитке (белый — цвет задаёт игра)."""
    c = Big()
    hand = {"f": (19, 24), "b": (4, 24), "s": (14, 24)}[v]
    bx, by = hand[0] + (2 if v != "b" else -2), -3
    c.ellipse(bx + 0.5, by, 3.4, 3.8, "1")
    c.ellipse(bx + 1.5, by + 1, 2, 2.6, "2")
    c.px(bx - 1, by - 2, "w")
    c.px(bx - 1, by - 1, "w")
    c.rect(bx, by + 4, 2, 1, "2")
    c.outline("k")
    # Нитка тонкая, без контура.
    c.line(hand[0], hand[1], bx, by + 5, "g")
    return c


# ---------------------------------------------------------------- на спине (за телом; со спины — поверх)


def back_fan(v):
    """Веер из перьев за спиной танцора. Со спины — кольцом вокруг фигуры, сама она видна."""
    import math

    c = Big()
    if v == "s":
        c.ellipse(4, 14, 5, 13, "P")
        c.ellipse(5, 14, 3.5, 10, "Y")
        c.ellipse(6, 14, 2, 7, "s")
        c.outline("k")
        return c
    c.ellipse(11.5, 15, 15, 14, "P")
    c.ellipse(11.5, 15, 12, 11, "Y")
    c.ellipse(11.5, 15, 9, 8, "s")
    for i in range(9):
        ang = math.pi * (i / 8)
        x = 11.5 - 13.5 * math.cos(ang)
        y = 15 - 12.5 * math.sin(ang)
        c.px(int(x), int(y), "U")
        c.px(int(x), int(y) + 1, "c")
    if v == "b":
        c.ellipse(11.5, 19, 8.5, 15, (0, 0, 0, 0))
    c.outline("k")
    return c


# ---------------------------------------------------------------- покупатели: головные уборы
# '1'…'4' — перекрашиваются тинтом (цвет кепки, платка, каски), остальное — свои цвета.


def hat_flatcap(v):
    """Кепка-восьмиклинка с пуговкой."""
    c = Big()
    if v == "s":
        c.ellipse(12, 4.5, 6.5, 3, "1")
        c.ellipse(13, 3.5, 3, 1.5, "2")
        c.rect(16, 6, 5, 2, "3")
        c.hline(6, 7, 11, "3")
    else:
        c.ellipse(11.5, 4.5, 8.5, 3.2, "1")
        c.ellipse(11.5, 3.5, 4, 1.5, "2")
        c.hline(4, 7, 16, "3")
        if v == "f":
            c.rect(6, 7, 12, 1, "4")
            for x in (8, 15):
                c.px(x, 4, "2")
    c.px(11 if v != "s" else 12, 1, "3")
    c.outline("k")
    return c


def hat_headscarf(v):
    """Платок в горошек, узел под подбородком."""
    c = Big()
    if v == "s":
        c.round_rect(6, 3, 12, 6, "1", r=2)
        c.rect(6, 7, 4, 9, "1")
        c.rect(10, 15, 3, 2, "2")
        for x, y in ((9, 5), (13, 4), (8, 10), (15, 6)):
            c.px(x, y, "3")
    elif v == "f":
        c.ellipse(11.5, 6, 8.6, 4.4, "1")
        c.rect(4, 7, 2, 8, "1")
        c.rect(18, 7, 2, 8, "1")
        c.rect(10, 16, 4, 2, "2")
        c.px(9, 17, "2")
        c.px(14, 17, "2")
        for x, y in ((7, 5), (11, 3), (15, 5), (9, 8), (14, 8), (4, 11), (19, 12)):
            c.px(x, y, "3")
    else:
        c.ellipse(11.5, 8, 8.6, 6.5, "1")
        for i in range(4):
            c.hline(8 + i, 14 + i, 8 - 2 * i, "1")
        for x, y in ((7, 5), (11, 3), (15, 6), (9, 10), (14, 11), (11, 15)):
            c.px(x, y, "3")
    c.outline("k")
    return c


def hat_headphones(v):
    """Большие наушники с дужкой."""
    c = Big()
    if v == "s":
        c.ellipse(11.5, 3, 6, 2, "4")
        c.ellipse(11.5, 3.5, 5, 1.2, (0, 0, 0, 0))
        c.round_rect(9, 7, 4, 5, "1", r=1)
        c.vline(9, 8, 3, "2")
    else:
        c.hline(7, 1, 10, "4")
        c.px(6, 2, "4")
        c.px(17, 2, "4")
        c.vline(5, 3, 5, "4")
        c.vline(18, 3, 5, "4")
        c.round_rect(2, 7, 4, 6, "1", r=1)
        c.round_rect(18, 7, 4, 6, "1", r=1)
        c.vline(2, 8, 4, "2")
        c.vline(21, 8, 4, "2")
    c.outline("k")
    return c


def hat_headband(v):
    """Спортивная повязка на лоб."""
    c = Big()
    if v == "s":
        c.hline(7, 6, 11, "1")
        c.hline(7, 7, 11, "2")
        c.vline(5, 7, 3, "1")
        c.vline(6, 8, 3, "2")
    else:
        c.hline(4, 6, 16, "1")
        c.hline(4, 7, 16, "2")
        if v == "b":
            c.vline(11, 8, 3, "1")
            c.vline(12, 8, 4, "2")
        else:
            c.px(11, 6, "w")
    c.outline("k")
    return c


def hat_nursecap(v):
    """Шапочка медсестры с красным крестом."""
    c = Big()
    x, w = (9, 7) if v == "s" else (7, 10)
    c.rect(x, 1, w, 4, "w")
    c.hline(x, 4, w, "W")
    if v == "f":
        c.rect(11, 1, 2, 3, "R")
        c.rect(10, 2, 4, 1, "R")
    if v == "s":
        c.rect(12, 2, 2, 1, "R")
    c.outline("k")
    return c


def hat_toque(v):
    """Поварской колпак."""
    c = Big()
    if v == "s":
        for cx, cy, r in ((10, -3, 3), (14, -4, 3), (12, -6, 3)):
            c.ellipse(cx, cy, r, r, "w")
        c.rect(8, -3, 9, 7, "w")
        c.vline(8, -2, 6, "W")
        c.rect(7, 4, 11, 2, "W")
    else:
        for cx, cy, r in ((7.5, -3, 3.4), (15.5, -3, 3.4), (11.5, -6, 3.8)):
            c.ellipse(cx, cy, r, r, "w")
        c.rect(6, -3, 12, 7, "w")
        c.vline(16, -3, 7, "W")
        c.px(10, -6, "W")
        c.rect(5, 4, 14, 2, "W")
    c.outline("k")
    return c


def hat_policecap(v):
    """Фуражка полицейского: тёмно-синяя, околыш, козырёк и кокарда."""
    c = Big()
    if v == "s":
        c.ellipse(11.5, 2.5, 7, 2.4, "g")
        c.rect(7, 3, 10, 3, "K")
        c.hline(7, 4, 10, "R")
        c.rect(16, 6, 4, 1, "k")
    else:
        c.ellipse(11.5, 2.5, 9.5, 2.6, "g")
        c.hline(6, 1, 12, "G")
        c.rect(5, 3, 14, 3, "K")
        c.hline(5, 4, 14, "R")
        c.hline(6, 6, 12, "k")
        if v == "f":
            c.rect(11, 3, 2, 3, "Y")
    c.outline("k")
    return c


def hat_firehelmet(v):
    """Каска пожарного: красная, с гербом и назатыльником."""
    c = Big()
    if v == "s":
        c.ellipse(12, 4, 6.8, 4.6, "R")
        c.px(10, 1, "s")
        c.rect(3, 7, 7, 3, "r")
        c.rect(16, 7, 4, 1, "r")
        c.hline(7, 8, 11, "r")
    else:
        c.ellipse(11.5, 4, 9, 4.6, "R")
        c.vline(11, 0, 7, "r")
        c.vline(12, 0, 7, "r")
        c.hline(3, 7, 18, "r")
        c.px(7, 2, "s")
        if v == "f":
            c.rect(9, 1, 6, 5, "Y")
            c.rect(10, 2, 4, 3, "y")
            c.px(11, 3, "R")
        else:
            c.rect(4, 8, 16, 3, "r")
    c.outline("k")
    return c


def hat_hardhat(v):
    """Строительная каска с ребром."""
    c = Big()
    if v == "s":
        c.ellipse(12, 4, 6.5, 4, "1")
        c.hline(6, 3, 12, "2")
        c.rect(6, 7, 14, 1, "2")
        c.rect(17, 6, 3, 1, "2")
    else:
        c.ellipse(11.5, 4, 8.6, 4, "1")
        c.rect(11, 0, 2, 7, "2")
        c.hline(4, 7, 16, "3")
        c.px(7, 2, "w")
    c.outline("k")
    return c


def hat_bucket(v):
    """Панама рыбака."""
    c = Big()
    if v == "s":
        c.round_rect(8, 1, 9, 5, "1", r=1)
        c.hline(8, 5, 9, "3")
        c.rect(5, 6, 15, 2, "2")
    else:
        c.round_rect(6, 1, 12, 5, "1", r=2)
        c.hline(6, 5, 12, "3")
        c.rect(4, 6, 16, 2, "2")
        c.hline(3, 7, 18, "2")
        if v == "f":
            c.px(8, 3, "2")
            c.px(15, 3, "2")
    c.outline("k")
    return c


def hat_sunhat(v):
    """Широкополая шляпа от солнца с лентой."""
    c = Big()
    if v == "s":
        c.ellipse(12, 6, 10, 1.6, "2")
        c.round_rect(9, 0, 8, 6, "1", r=2)
        c.hline(9, 4, 8, "3")
    else:
        c.ellipse(11.5, 6, 13.5, 2.4, "2")
        c.round_rect(7, -1, 10, 7, "1", r=3)
        c.hline(7, 4, 10, "3")
        c.hline(7, 5, 10, "3")
        if v == "f":
            c.px(15, 3, "4")
    c.outline("k")
    return c


def hat_straw(v):
    """Соломенная шляпа дачника с красной лентой."""
    c = Big()
    if v == "s":
        c.ellipse(12, 6, 9.5, 1.6, "n")
        c.round_rect(9, 1, 8, 5, "N", r=2)
        c.hline(9, 4, 8, "R")
        for x in range(4, 21, 3):
            c.px(x, 6, "B")
    else:
        c.ellipse(11.5, 6, 13, 2.3, "n")
        c.round_rect(7, 0, 10, 6, "N", r=3)
        c.hline(7, 4, 10, "R")
        for x in range(0, 24, 3):
            c.px(x, 6 + (x % 2), "B")
        for x in range(8, 17, 3):
            c.px(x, 2, "n")
    c.outline("k")
    return c


def hat_bandana(v):
    """Бандана с узором и узлом сзади."""
    c = Big()
    if v == "s":
        c.ellipse(12, 4.5, 6.5, 3, "1")
        c.hline(6, 7, 12, "2")
        c.rect(4, 7, 2, 4, "2")
        c.px(3, 10, "2")
    else:
        c.ellipse(11.5, 4.5, 8.6, 3.2, "1")
        c.hline(4, 7, 16, "2")
        if v == "b":
            c.rect(10, 8, 4, 2, "2")
            c.vline(10, 10, 3, "2")
            c.vline(13, 10, 2, "2")
    for x, y in ((8, 3), (12, 2), (15, 4), (10, 5)):
        c.px(x if v != "s" else x - 1, y, "3")
    c.outline("k")
    return c


def hat_mohawk(v):
    """Ирокез: гребень шипами."""
    c = Big()
    if v == "s":
        for i, x in enumerate(range(6, 17)):
            top = -1 + (i % 2) * 2
            c.vline(x, top, 7 - top, "1")
        for x in range(6, 17, 2):
            c.px(x, -1, "2")
    else:
        for i, x in enumerate(range(9, 15)):
            top = -4 + abs(11.5 - x) // 1
            c.vline(x, int(top), int(7 - top), "1")
        c.vline(13, -2, 8, "2")
        c.vline(14, -1, 7, "2")
    c.outline("k")
    return c


def hat_beret(v):
    """Берет художника, сдвинутый набок, с хвостиком."""
    c = Big()
    if v == "s":
        c.ellipse(11, 3.5, 7, 2.6, "1")
        c.ellipse(6.5, 4.5, 3, 2, "1")
        c.hline(7, 5, 10, "2")
        c.px(12, 0, "3")
    else:
        c.ellipse(10.5, 3.5, 9, 2.8, "1")
        c.ellipse(4, 4.5, 3, 2, "1")
        c.hline(5, 5, 14, "2")
        c.vline(12, -1, 2, "3")
        c.px(9, 2, "2")
    c.outline("k")
    return c


def hat_sailor(v):
    """Бескозырка: белый верх, тёмный околыш, ленты сзади."""
    c = Big()
    if v == "s":
        c.ellipse(12, 2.5, 7.5, 2.4, "w")
        c.rect(7, 3, 10, 3, "K")
        c.hline(9, 4, 6, "Y")
        c.vline(6, 5, 7, "K")
        c.vline(7, 6, 6, "K")
    else:
        c.ellipse(11.5, 2.5, 10, 2.6, "w")
        c.hline(4, 2, 16, "W")
        c.rect(5, 3, 14, 3, "K")
        if v == "f":
            c.hline(8, 4, 8, "Y")
        else:
            c.vline(10, 6, 7, "K")
            c.vline(13, 6, 7, "K")
            c.px(10, 13, "Y")
            c.px(13, 13, "Y")
    c.outline("k")
    return c


def hat_cowboy(v):
    """Ковбойская шляпа: тулья с заломом, лента, загнутые поля."""
    c = Big()
    if v == "s":
        c.round_rect(9, -2, 7, 6, "1", r=1)
        c.hline(9, 3, 7, "3")
        c.ellipse(12, 5, 9.5, 1.6, "2")
        c.px(2, 4, "2")
        c.px(22, 4, "2")
    else:
        c.round_rect(7, -2, 10, 6, "1", r=2)
        c.hline(10, -2, 4, "2")
        c.hline(7, 3, 10, "3")
        c.ellipse(11.5, 5, 13, 2, "2")
        for x, y in ((-1, 3), (0, 4), (24, 3), (23, 4)):
            c.px(x, y, "2")
    c.outline("k")
    return c


def hat_bikehelmet(v):
    """Велошлем с прорезями и ремешком."""
    c = Big()
    if v == "s":
        c.ellipse(11, 3.5, 7.5, 4, "1")
        c.px(3, 4, "1")
        for x in (8, 11, 14):
            c.rect(x, 1, 2, 2, "3")
        c.rect(17, 6, 2, 1, "4")
        c.vline(14, 8, 6, "g")
    else:
        c.ellipse(11.5, 3.5, 8.8, 4, "1")
        for x in (7, 11, 15):
            c.rect(x, 1, 2, 3, "3")
        c.hline(3, 7, 18, "2")
        if v == "f":
            c.vline(4, 8, 6, "g")
            c.vline(19, 8, 6, "g")
    c.outline("k")
    return c


def hat_bow(v):
    """Большой бант на макушке."""
    c = Big()
    x = 15 if v == "f" else 8 if v == "b" else 9
    for dx in (-3, 3):
        c.ellipse(x + dx, 2, 2.6, 2.2, "1")
    c.rect(x - 1, 1, 2, 3, "2")
    c.px(x - 3, 2, "3")
    c.px(x + 3, 2, "3")
    c.outline("k")
    return c


def hat_ushanka(v):
    """Ушанка: верх, меховой отворот и уши."""
    c = Big()
    if v == "s":
        c.ellipse(12, 3, 6.8, 3.4, "1")
        c.rect(6, 4, 12, 3, "2")
        c.rect(8, 7, 4, 7, "2")
        for x in range(6, 18, 2):
            c.px(x, 4, "3")
    else:
        c.ellipse(11.5, 3, 8.6, 3.5, "1")
        c.rect(4, 4, 16, 3, "2")
        c.rect(3, 7, 3, 7, "2")
        c.rect(18, 7, 3, 7, "2")
        for x in range(4, 20, 2):
            c.px(x, 4, "3")
        c.px(4, 13, "3")
        c.px(19, 13, "3")
    c.outline("k")
    return c


def hat_furhat(v):
    """Высокая меховая шапка."""
    c = Big()
    x, w = (7, 11) if v == "s" else (5, 14)
    c.round_rect(x, -2, w, 9, "B", r=3)
    import random as _r

    rnd = _r.Random(3)
    for _ in range(18):
        c.px(rnd.randrange(x, x + w), rnd.randrange(-2, 7), rnd.choice(["n", "a", "t"]))
    c.hline(x, 6, w, "a")
    c.outline("k")
    return c


# ---------------------------------------------------------------- на лице (сзади не видно)


def face_beard(v):
    """Борода (цвет — как волосы)."""
    c = small()
    if v == "f":
        c.ellipse(11.5, 14, 6.4, 3.4, "1")
        c.rect(5, 10, 2, 4, "1")
        c.rect(17, 10, 2, 4, "1")
        c.hline(10, 13, 4, "3")
        c.hline(9, 12, 6, "2")
    elif v == "s":
        c.ellipse(14, 13.5, 3.6, 3, "1")
        c.rect(10, 10, 3, 4, "1")
        c.hline(16, 12, 2, "2")
    return c


def face_mustache(v):
    """Пышные усы."""
    c = small()
    if v == "f":
        c.hline(9, 12, 6, "1")
        c.px(8, 13, "1")
        c.px(15, 13, "1")
        c.hline(10, 13, 4, "2")
    elif v == "s":
        c.hline(15, 12, 3, "1")
        c.px(17, 13, "1")
    return c


def face_sunglasses(v):
    """Тёмные очки."""
    c = small()
    if v == "f":
        c.rect(5, 9, 5, 3, "k")
        c.rect(14, 9, 5, 3, "k")
        c.hline(10, 9, 4, "k")
        c.px(6, 9, "G")
        c.px(15, 9, "G")
    elif v == "s":
        c.rect(14, 9, 4, 3, "k")
        c.hline(9, 9, 5, "k")
        c.px(15, 9, "G")
    return c


# ---------------------------------------------------------------- покупатели: одежда
# Спереди: тело x 7…17, y 17…26; рукава x 4…6 и 19…21, y 18…23; руки отделены линиями x 7 и 18.
# Сбоку: тело x 8…15, рука x 12…14, y 18…24 (линия руки x 11, низ рукава y 25).


def torso(c, v, body, shade, sleeve=None, long=0):
    """Силуэт куртки или кофты во всех видах; long — насколько ниже пояса (пальто, платье)."""
    sleeve = sleeve or body
    if v == "s":
        c.rect(8, 17, 8, 10 + long, body)
        c.vline(8, 17, 10 + long, shade)
        c.rect(12, 18, 3, 7, sleeve)
        c.vline(14, 18, 7, shade)
    else:
        c.rect(5, 17, 15, 2, body)
        c.rect(7, 17, 11, 10 + long, body)
        c.vline(17 if v == "f" else 7, 17, 10 + long, shade)
        c.rect(4, 18, 3, 6, sleeve)
        c.rect(19, 18, 3, 6, sleeve)
        c.vline(21 if v == "f" else 4, 18, 6, shade)


def finish(c, v):
    """Контур и линии рук поверх одежды."""
    c.outline("k")
    if v == "s":
        c.vline(11, 18, 7, "k")
        c.hline(12, 25, 3, "k")
    else:
        c.vline(7, 19, 5, "k")
        c.vline(18, 19, 5, "k")
    return c


def outfit_cardigan(v):
    """Кофта на пуговицах с карманами (спереди видна рубашка)."""
    c = small()
    torso(c, v, "1", "2")
    if v == "f":
        c.rect(11, 17, 3, 9, (0, 0, 0, 0))
        for y in (19, 21, 23):
            c.px(10, y, "3")
        c.rect(8, 22, 2, 2, "2")
        c.rect(15, 22, 2, 2, "2")
    if v != "s":
        c.hline(7, 26, 11, "3")
        c.hline(4, 23, 3, "3")
        c.hline(19, 23, 3, "3")
    return finish(c, v)


def outfit_hoodie(v):
    """Худи: капюшон, карман-кенгуру, шнурки."""
    c = small()
    torso(c, v, "1", "2")
    if v == "f":
        c.hline(8, 17, 9, "2")
        c.rect(9, 22, 7, 3, "2")
        c.px(10, 18, "w")
        c.px(14, 18, "w")
        c.px(10, 19, "w")
        c.px(14, 19, "w")
    elif v == "b":
        c.ellipse(12, 17, 4.5, 2.5, "2")
        c.hline(9, 18, 6, "3")
    else:
        c.rect(7, 15, 4, 4, "2")
    return finish(c, v)


def outfit_tracksuit(v):
    """Олимпийка: молния, лампасы на рукавах. Лампасы — прорези: в них видна рубашка (белая у спортсменов)."""
    c = small()
    torso(c, v, "1", "2")
    clear = (0, 0, 0, 0)
    if v == "f":
        c.vline(12, 18, 8, "3")
    finish(c, v)
    if v == "s":
        c.vline(13, 18, 7, clear)
    else:
        c.vline(5, 18, 6, clear)
        c.vline(20, 18, 6, clear)
        c.hline(9, 17, 7, clear)
    return c


def outfit_suit(v):
    """Деловой костюм: тёмный пиджак, белая рубашка, красный галстук."""
    c = small()
    torso(c, v, "g", "K")
    if v == "f":
        for i in range(5):
            c.hline(11 - i // 2, 17 + i, 2 + (i // 2) * 2, "w")
        c.vline(12, 18, 5, "R")
        c.px(11, 18, "R")
        c.px(10, 21, "G")
        c.px(14, 21, "G")
        c.px(12, 24, "G")
    if v == "b":
        c.hline(9, 17, 7, "w")
    return finish(c, v)


def outfit_labcoat(v):
    """Белый халат до колен, ручки в кармане."""
    c = small()
    torso(c, v, "w", "W", long=4)
    if v == "f":
        c.rect(11, 17, 3, 13, (0, 0, 0, 0))
        c.rect(14, 20, 3, 3, "W")
        c.px(14, 19, "U")
        c.px(15, 19, "R")
        c.rect(8, 25, 3, 2, "W")
    return finish(c, v)


def outfit_chefcoat(v):
    """Китель повара: белый, двубортный."""
    c = small()
    torso(c, v, "w", "W")
    if v == "f":
        for y in (19, 21, 23):
            c.px(10, y, "K")
            c.px(14, y, "K")
        c.hline(9, 17, 7, "W")
    if v == "s":
        c.px(15, 19, "K")
        c.px(15, 22, "K")
    return finish(c, v)


def outfit_police(v):
    """Форма полиции: тёмно-синяя куртка, значок, ремень, погоны."""
    c = small()
    torso(c, v, "g", "K")
    if v != "s":
        c.rect(5, 17, 3, 1, "K")
        c.rect(17, 17, 3, 1, "K")
        c.hline(7, 24, 11, "k")
    if v == "f":
        c.rect(14, 19, 2, 2, "Y")
        c.rect(8, 20, 3, 2, "K")
        c.vline(12, 17, 7, "K")
        c.px(12, 24, "W")
    if v == "s":
        c.hline(8, 24, 8, "k")
    return finish(c, v)


def outfit_firecoat(v):
    """Боёвка пожарного: песочная, со светоотражающими полосами."""
    c = small()
    torso(c, v, "n", "t", long=2)
    rows = (22, 26)
    if v == "s":
        for y in rows:
            c.hline(8, y, 8, "Y")
        c.hline(12, 23, 3, "Y")
    else:
        for y in rows:
            c.hline(7, y, 11, "Y")
        c.hline(4, 22, 3, "Y")
        c.hline(19, 22, 3, "Y")
        if v == "f":
            c.vline(12, 17, 12, "t")
    return finish(c, v)


def outfit_leather(v):
    """Чёрная кожанка: косая молния, лацканы, блик."""
    c = small()
    torso(c, v, "K", "k")
    if v == "f":
        c.line(10, 17, 13, 26, "G")
        c.px(8, 17, "g")
        c.px(9, 18, "g")
        c.px(16, 17, "g")
        c.px(15, 18, "g")
        c.px(5, 19, "G")
    if v == "b":
        c.px(9, 19, "G")
        c.px(10, 19, "G")
    if v == "s":
        c.px(13, 19, "G")
    return finish(c, v)


def outfit_fishvest(v):
    """Жилет с кучей карманов (рукава — от рубашки)."""
    c = small()
    if v == "s":
        c.rect(8, 17, 8, 9, "1")
        c.vline(8, 17, 9, "2")
        c.rect(9, 21, 3, 3, "2")
    else:
        c.rect(7, 17, 11, 9, "1")
        c.vline(17 if v == "f" else 7, 17, 9, "2")
        if v == "f":
            c.rect(11, 17, 3, 9, (0, 0, 0, 0))
            for x, y in ((8, 19), (14, 19), (8, 22), (14, 22)):
                c.rect(x, y, 3, 2, "2")
                c.px(x + 1, y, "3")
    c.outline("k")
    return c


def outfit_hawaii(v):
    """Гавайская рубашка: голубая с цветами."""
    c = small()
    torso(c, v, "U", "u")
    spots = ((9, 18), (15, 20), (11, 23), (5, 20), (20, 19), (16, 25), (8, 25)) if v != "s" else ((10, 19), (13, 21), (9, 24))
    for i, (x, y) in enumerate(spots):
        col = ("R", "Y", "w")[i % 3]
        c.px(x, y, col)
        c.px(x + 1, y, col)
        c.px(x, y + 1, col)
        c.px(x + 1, y + 1, "y" if col != "Y" else "o")
    if v == "f":
        c.px(11, 17, "w")
        c.px(13, 17, "w")
    return finish(c, v)


def outfit_telnyashka(v):
    """Тельняшка: белая в тёмно-синюю полоску."""
    c = small()
    torso(c, v, "w", "W")
    for y in range(18, 27, 2):
        if v == "s":
            c.hline(8, y, 8, "u")
            if y < 25:
                c.hline(12, y, 3, "u")
        else:
            c.hline(7, y, 11, "u")
            if y < 24:
                c.hline(4, y, 3, "u")
                c.hline(19, y, 3, "u")
    return finish(c, v)


def outfit_dress(v):
    """Платье с пояском и расклешённой юбкой."""
    c = small()
    torso(c, v, "1", "2")
    if v == "s":
        for i in range(6):
            c.hline(8 - i // 2, 26 + i, 9 + i // 2, "1")
        c.hline(8, 23, 8, "3")
        c.vline(8, 26, 5, "2")
    else:
        for i in range(6):
            c.hline(7 - (i + 1) // 2, 26 + i, 11 + (i + 1), "1")
        c.hline(7, 23, 11, "3")
        for x in (8, 12, 16):
            c.vline(x, 27, 4, "2")
        if v == "f":
            c.hline(10, 17, 5, "2")
    return finish(c, v)


def outfit_furcoat(v):
    """Шуба до колен с меховым воротником."""
    c = small()
    torso(c, v, "B", "a", long=4)
    import random as _r

    rnd = _r.Random(7 + len(v))
    for _ in range(14):
        x, y = rnd.randrange(5, 20), rnd.randrange(18, 30)
        if c.get(x, y)[3]:
            c.px(x, y, rnd.choice(["n", "a", "t"]))
    if v == "s":
        c.rect(9, 16, 7, 3, "N")
    else:
        c.rect(7, 16, 11, 3, "N")
        c.hline(4, 23, 3, "N")
        c.hline(19, 23, 3, "N")
        if v == "f":
            c.vline(12, 19, 11, "a")
    return finish(c, v)


# ---------------------------------------------------------------- покупатели: вещи в руках
# Правая ладонь спереди x 18…19, y 24…25; со спины эта рука слева, x 4…5; сбоку ладонь x 13…14.


def hand(v):
    return {"f": (19, 25), "b": (4, 25), "s": (14, 25)}[v]


def prop_cane(v):
    """Трость с загнутой ручкой."""
    c = Big()
    x, _ = hand(v)
    x += 1 if v != "b" else -1
    c.vline(x, 24, 10, "b")
    c.hline(x - 2 if v != "b" else x, 23, 3, "b")
    c.px(x - 2 if v != "b" else x + 2, 24, "b")
    c.px(x, 33, "K")
    c.outline("k")
    return c


def prop_stringbag(v):
    """Авоська: сетка с морковкой, капустой и батоном."""
    c = Big()
    x, y = hand(v)
    cx = x + (1 if v != "b" else -1)
    c.ellipse(cx, y + 5, 4, 4, "W")
    c.ellipse(cx - 1.5, y + 5, 2, 2, "E")
    c.px(cx - 2, y + 4, "e")
    c.rect(cx, y + 2, 3, 2, "n")
    c.px(cx + 1, y + 6, "o")
    c.px(cx + 2, y + 7, "o")
    for yy in range(y + 2, y + 9, 2):
        for xx in range(cx - 3, cx + 4, 2):
            if c.get(xx, yy)[3]:
                c.px(xx, yy, "l")
    c.vline(cx, y, 2, "l")
    c.outline("k")
    return c


def prop_briefcase(v):
    """Портфель (цвет задаёт игра)."""
    c = Big()
    x, y = hand(v)
    if v == "s":
        c.rect(12, y + 1, 4, 6, "1")
        c.vline(15, y + 1, 6, "2")
    else:
        c.rect(x - 3, y + 1, 8, 6, "1")
        c.hline(x - 3, y + 3, 8, "2")
        c.px(x + 1, y + 3, "3")
    c.hline(x - 1, y, 3, "3")
    c.outline("k")
    return c


def prop_rod(v):
    """Удочка с катушкой и леской."""
    c = Big()
    x, y = hand(v)
    tip = {"f": (28, -6), "b": (-5, -6), "s": (24, -5)}[v]
    c.line(x, y, tip[0], tip[1], "B")
    c.line(x, y + 1, (x + tip[0]) // 2, (y + tip[1]) // 2 + 1, "b")
    c.ellipse(x + (1 if v != "b" else -1), y - 1, 1.2, 1.2, "G")
    c.outline("k")
    c.vline(tip[0], tip[1] + 1, 9, "W")
    return c


def prop_camera(v):
    """Фотоаппарат на ремне у груди."""
    c = Big()
    if v == "f":
        c.line(9, 17, 10, 19, "K")
        c.line(15, 17, 14, 19, "K")
        c.rect(9, 19, 7, 4, "K")
        c.ellipse(12.5, 21, 1.8, 1.8, "G")
        c.px(12, 20, "c")
        c.px(14, 19, "R")
    elif v == "s":
        c.rect(15, 19, 3, 4, "K")
        c.rect(18, 20, 1, 2, "G")
        c.line(12, 17, 15, 19, "K")
    else:
        c.hline(9, 17, 6, "K")
    c.outline("k")
    return c


def prop_basket(v):
    """Плетёная корзинка с овощами."""
    c = Big()
    x, y = hand(v)
    bx = x - 4 if v != "b" else x - 5
    c.ellipse(bx + 4.5, y + 1, 3, 2.5, "E")
    c.ellipse(bx + 2, y + 1.5, 1.5, 1.5, "R")
    c.px(bx + 6, y - 1, "e")
    c.rect(bx, y + 2, 10, 5, "B")
    c.hline(bx, y + 2, 10, "n")
    for xx in range(bx + 1, bx + 10, 2):
        c.vline(xx, y + 3, 4, "a")
    c.outline("k")
    c.line(bx + 1, y + 1, bx + 4, y - 3, "a")
    c.line(bx + 8, y + 1, bx + 5, y - 3, "a")
    return c


def prop_newspaper(v):
    """Газета: спереди раскрыта перед собой, со спины — под мышкой."""
    c = Big()
    if v == "f":
        c.rect(6, 18, 12, 8, "w")
        c.vline(11, 18, 8, "W")
        c.rect(7, 19, 3, 2, "K")
        for y in (22, 24):
            c.hline(7, y, 3, "l")
            c.hline(13, y, 4, "l")
        c.hline(13, 19, 4, "K")
    elif v == "s":
        c.rect(14, 18, 4, 8, "w")
        c.hline(15, 20, 2, "l")
        c.hline(15, 22, 2, "l")
    else:
        c.rect(2, 20, 3, 6, "w")
        c.hline(2, 22, 3, "l")
    c.outline("k")
    return c


def prop_bouquet(v):
    """Букет в бумаге."""
    c = Big()
    x, y = hand(v)
    top = y - 7
    c.rect(x - 1, y - 4, 3, 5, "e")
    for dx, dy, col in ((-2, 0, "R"), (1, -1, "s"), (0, 2, "Y"), (-1, 3, "P"), (2, 2, "R")):
        c.ellipse(x + dx + 0.5, top + dy, 1.6, 1.4, col)
        c.px(x + dx, top + dy, "w")
    for i in range(4):
        c.hline(x - 2 + i // 2, y - 3 + i, 5 - i, "w")
    c.outline("k")
    return c


def prop_books(v):
    """Стопка книг у груди."""
    c = Big()
    x = {"f": 14, "b": 2, "s": 13}[v]
    for i, col in enumerate(("R", "U", "E")):
        c.rect(x + (i % 2), 20 + i * 2, 7, 2, col)
        c.hline(x + (i % 2) + 1, 21 + i * 2, 5, "w")
    c.outline("k")
    return c


def prop_coffee(v):
    """Стаканчик кофе навынос."""
    c = Big()
    x, y = hand(v)
    c.rect(x - 1, y - 4, 3, 4, "w")
    c.hline(x - 1, y - 5, 3, "b")
    c.hline(x - 1, y - 2, 3, "B")
    c.outline("k")
    return c


def prop_palette(v):
    """Палитра художника и кисть."""
    c = Big()
    x, y = hand(v)
    c.ellipse(x + (1 if v != "b" else -1), y + 1, 4, 3, "N")
    for dx, dy, col in ((-2, 0, "R"), (0, -1, "Y"), (2, 0, "U"), (0, 2, "E")):
        c.px(x + dx, y + 1 + dy, col)
    if v == "f":
        c.line(4, 25, 2, 19, "b")
        c.px(2, 18, "R")
    c.outline("k")
    return c


def prop_flask(v):
    """Колба с зелёной жидкостью."""
    c = Big()
    x, y = hand(v)
    c.vline(x, y - 6, 3, "W")
    c.ellipse(x + 0.5, y - 1, 2.6, 2.4, "W")
    c.ellipse(x + 0.5, y - 0.5, 2, 1.6, "E")
    c.px(x, y - 1, "w")
    c.outline("k")
    c.px(x + 1, y - 8, "E")
    c.px(x, y - 9, "E")
    return c


def prop_bottle(v):
    """Бутылка воды."""
    c = Big()
    x, y = hand(v)
    c.rect(x - 1, y - 5, 3, 6, "c")
    c.vline(x + 1, y - 5, 6, "U")
    c.hline(x - 1, y - 3, 3, "w")
    c.px(x, y - 6, "w")
    c.outline("k")
    return c


# ---------------------------------------------------------------- покупатели: на спине


def back_guitar(v):
    """Гитара за спиной: спереди виден гриф над плечом и низ корпуса."""
    c = Big()
    if v == "b":
        c.line(10, 22, 19, 3, "b")
        c.line(11, 22, 20, 3, "b")
        c.rect(18, 1, 3, 3, "x")
        c.ellipse(9, 25, 5, 4, "B")
        c.ellipse(9, 21, 3.5, 3, "B")
        c.ellipse(9, 24, 1.4, 1.4, "x")
        c.line(4, 15, 17, 27, "a")
    elif v == "f":
        c.line(14, 22, 1, 5, "b")
        c.line(15, 22, 2, 5, "b")
        c.rect(-1, 2, 3, 3, "x")
        c.ellipse(16, 26, 5, 4, "B")
    else:
        c.line(5, 25, 9, 4, "b")
        c.rect(8, 1, 3, 3, "x")
        c.ellipse(5, 25, 3.5, 4.5, "B")
    c.outline("k")
    return c


def back_cube(v):
    """Короб курьера (цвет задаёт игра)."""
    c = Big()
    if v == "s":
        c.rect(0, 14, 9, 15, "1")
        c.vline(0, 14, 15, "2")
        c.hline(0, 14, 9, "2")
    else:
        c.rect(3, 13, 18, 16, "1")
        c.hline(3, 13, 18, "2")
        c.vline(20, 13, 16, "2")
        if v == "b":
            c.rect(9, 18, 6, 5, "3")
            c.rect(10, 19, 4, 3, "2")
    c.outline("k")
    return c


def back_yogamat(v):
    """Свёрнутый коврик для йоги на ремне."""
    c = Big()
    if v == "s":
        c.rect(3, 12, 4, 17, "1")
        c.vline(6, 12, 17, "2")
        c.ellipse(4.5, 12, 2, 1, "3")
    else:
        for i in range(15):
            c.rect(5 + i, 26 - i, 3, 3, "1")
        c.ellipse(21, 11.5, 2, 2, "2")
        c.px(21, 11, "3")
        if v == "b":
            c.line(6, 17, 17, 26, "a")
    c.outline("k")
    return c


# ---------------------------------------------------------------- редкие гости: костюмы


def hat_crown(v):
    """Королевская корона с камнями."""
    c = Big()
    x, w = (8, 9) if v == "s" else (6, 12)
    c.rect(x, 0, w, 4, "Y")
    for k in range(0, w, 3):
        c.vline(x + k, -2, 2, "Y")
        c.px(x + k, -3, "w" if k % 2 else "Y")
    c.hline(x, 3, w, "y")
    if v == "f":
        c.px(11, 1, "R")
        c.px(12, 1, "R")
        c.px(8, 1, "U")
        c.px(15, 1, "E")
    c.outline("k")
    return c


def hat_tricorn(v):
    """Пиратская треуголка с черепом."""
    c = Big()
    if v == "s":
        c.round_rect(7, 0, 11, 6, "K", r=2)
        c.rect(4, 4, 17, 2, "K")
        c.px(4, 3, "K")
        c.px(20, 3, "K")
    else:
        c.round_rect(6, 0, 12, 6, "K", r=2)
        c.rect(1, 4, 22, 2, "K")
        c.px(1, 3, "K")
        c.px(22, 3, "K")
        c.hline(2, 5, 20, "Y")
        if v == "f":
            c.rect(11, 1, 2, 2, "w")
            c.px(10, 3, "w")
            c.px(13, 3, "w")
    c.outline("k")
    return c


def hat_clownwig(v):
    """Рыжий кудрявый парик клоуна."""
    c = Big()
    pts = ((2, 7), (4, 3), (8, 1), (12, 0), (16, 1), (20, 3), (22, 7), (2, 11), (22, 11)) if v != "s" else ((5, 5), (8, 2), (12, 1), (15, 3), (5, 10), (8, 12))
    for x, y in pts:
        c.ellipse(x, y, 3, 2.8, "o")
        c.px(x - 1, y - 1, "y")
    if v != "s":
        c.ellipse(11.5, 4, 6, 3, "o")
    c.outline("k")
    return c


def hat_knighthelmet(v):
    """Рыцарский шлем с забралом-щелью и красным плюмажем."""
    c = Big()
    if v == "s":
        c.round_rect(7, 1, 11, 15, "W", r=3)
        c.vline(7, 3, 11, "l")
        c.hline(13, 9, 5, "k")
        c.ellipse(9, -2, 3, 2.5, "R")
    else:
        c.round_rect(4, 1, 16, 15, "W", r=4)
        c.vline(19, 3, 11, "l")
        c.ellipse(11.5, -2, 2.4, 3, "R")
        if v == "f":
            c.hline(6, 9, 12, "k")
            c.vline(11, 4, 11, "l")
            for y in (12, 14):
                c.hline(8, y, 2, "l")
                c.hline(14, y, 2, "l")
    c.outline("k")
    return c


def hat_antennae(v):
    """Антенны инопланетянина с шариками."""
    c = Big()
    for x, top in (((7, -3), (16, -3)) if v != "s" else ((10, -3), (13, -4))):
        c.vline(x, top + 1, 4 - top, "E")
        c.ellipse(x + 0.5, top, 1.6, 1.6, "Y")
    c.outline("k")
    return c


def hat_tophat(v):
    """Цилиндр фокусника с красной лентой."""
    c = Big()
    x, w = (9, 7) if v == "s" else (7, 10)
    c.rect(x, -5, w, 10, "K")
    c.vline(x + 1, -4, 8, "g")
    c.rect(x, 2, w, 2, "R")
    c.rect(x - 3, 5, w + 6, 2, "K")
    c.outline("k")
    return c


def hat_viking(v):
    """Шлем викинга с рогами."""
    c = Big()
    if v == "s":
        c.ellipse(12, 5, 6.5, 4, "W")
        c.hline(6, 7, 12, "l")
        c.line(8, 3, 5, -2, "N")
        c.px(5, -3, "N")
    else:
        c.ellipse(11.5, 5, 8.6, 4.5, "W")
        c.hline(3, 8, 18, "l")
        c.rect(11, 1, 2, 7, "l")
        for side in (-1, 1):
            x = 11.5 + side * 9
            c.ellipse(x, 2, 1.8, 2, "N")
            c.ellipse(x + side * 2, -1, 1.5, 2, "N")
            c.px(int(x + side * 3), -3, "n")
    c.outline("k")
    return c


def hat_tiara(v):
    """Диадема балерины на гладкой причёске."""
    c = Big()
    x, w = (9, 7) if v == "s" else (7, 10)
    c.hline(x, 3, w, "W")
    for k in range(0, w, 2):
        c.px(x + k, 2, "W")
    c.px(x + w // 2, 1, "c")
    c.px(x + w // 2, 2, "c")
    return c


def hat_ninjahood(v):
    """Капюшон ниндзя: открыты только глаза."""
    c = Big()
    if v == "s":
        c.round_rect(6, 2, 12, 15, "K", r=3)
        c.rect(13, 8, 5, 3, (0, 0, 0, 0))
        c.rect(3, 6, 3, 2, "R")
        c.rect(1, 8, 3, 2, "R")
        c.hline(6, 6, 12, "R")
    else:
        c.round_rect(4, 2, 16, 15, "K", r=4)
        c.hline(4, 6, 16, "R")
        if v == "f":
            c.rect(6, 9, 12, 3, (0, 0, 0, 0))
        else:
            c.rect(10, 6, 4, 2, "R")
            c.rect(9, 8, 2, 4, "R")
            c.rect(13, 8, 2, 4, "R")
    c.outline("k")
    return c


def face_eyepatch(v):
    """Пиратская повязка на глаз."""
    c = small()
    if v == "f":
        c.rect(14, 9, 4, 3, "k")
        c.line(5, 6, 14, 10, "k")
        c.line(18, 9, 19, 8, "k")
    elif v == "s":
        c.line(8, 7, 16, 9, "k")
    return c


def face_clownnose(v):
    """Красный нос клоуна и румяные щёки."""
    c = small()
    if v == "f":
        c.ellipse(11.5, 12, 1.8, 1.6, "R")
        c.px(11, 11, "w")
        c.hline(9, 14, 6, "R")
    elif v == "s":
        c.ellipse(18, 11, 1.6, 1.6, "R")
    return c


def face_heromask(v):
    """Маска супергероя."""
    c = small()
    if v == "f":
        c.rect(5, 9, 14, 3, "u")
        c.rect(6, 10, 2, 1, "w")
        c.rect(15, 10, 2, 1, "w")
        c.px(4, 10, "u")
        c.px(19, 10, "u")
    elif v == "s":
        c.rect(9, 9, 9, 3, "u")
        c.rect(15, 10, 2, 1, "w")
        c.rect(6, 9, 3, 2, "u")
    return c


def outfit_gown(v):
    """Платье королевы: пурпурное, золотой пояс, длинная юбка."""
    c = small()
    torso(c, v, "P", "p")
    if v == "s":
        for i in range(8):
            c.hline(8 - i // 2, 26 + i, 9 + i // 2, "P")
        c.hline(8, 22, 8, "Y")
    else:
        for i in range(8):
            c.hline(6 - i // 2, 26 + i, 12 + i, "P")
        c.hline(7, 22, 11, "Y")
        if v == "f":
            c.vline(12, 23, 11, "Y")
            c.px(12, 18, "c")
    return finish(c, v)


def outfit_piratecoat(v):
    """Камзол пирата: красный с золотыми пуговицами, белый воротник."""
    c = small()
    torso(c, v, "r", "m", long=3)
    if v == "f":
        c.rect(11, 17, 3, 12, "w")
        c.vline(12, 18, 10, "W")
        for y in (19, 22, 25):
            c.px(10, y, "Y")
            c.px(14, y, "Y")
        c.hline(7, 24, 11, "x")
        c.rect(11, 24, 3, 1, "Y")
    elif v == "b":
        c.hline(7, 24, 11, "x")
    else:
        c.hline(8, 24, 8, "x")
    c.hline(4, 23, 3, "Y") if v != "s" else None
    return finish(c, v)


def outfit_clownsuit(v):
    """Комбинезон клоуна в горошек с пышным воротником."""
    c = small()
    torso(c, v, "Y", "y", long=6)
    for x, y in ((9, 20), (14, 19), (11, 24), (16, 26), (8, 28), (13, 30), (5, 20), (20, 21)):
        if c.get(x, y)[3]:
            c.rect(x, y, 2, 2, "R" if (x + y) % 2 else "U")
    if v == "s":
        c.ellipse(12, 17, 4, 1.6, "w")
    else:
        c.ellipse(12, 17, 6, 1.8, "w")
        for x in range(7, 18, 2):
            c.px(x, 18, "W")
        if v == "f":
            c.rect(11, 20, 2, 2, "E")
    return finish(c, v)


def outfit_armor(v):
    """Латы рыцаря: стальные с бликами, красная накидка-сюрко с крестом."""
    c = small()
    torso(c, v, "W", "l", long=2)
    if v == "f":
        c.rect(9, 18, 7, 10, "R")
        c.rect(11, 19, 3, 7, "Y")
        c.rect(10, 21, 5, 2, "Y")
        c.px(5, 19, "w")
        c.px(20, 19, "w")
    elif v == "b":
        c.rect(9, 18, 7, 10, "R")
    else:
        c.rect(9, 18, 3, 10, "R")
        c.px(13, 19, "w")
    c.hline(7 if v != "s" else 8, 28, 11 if v != "s" else 8, "l")
    return finish(c, v)


def outfit_spacesuit(v):
    """Серебристый комбинезон с пультом на груди."""
    c = small()
    torso(c, v, "W", "l", long=2)
    if v == "f":
        c.rect(9, 19, 6, 4, "K")
        c.px(10, 20, "E")
        c.px(12, 20, "R")
        c.px(13, 21, "c")
        c.hline(7, 25, 11, "c")
    elif v == "b":
        c.rect(9, 18, 6, 6, "l")
        c.hline(7, 25, 11, "c")
    else:
        c.hline(8, 25, 8, "c")
        c.px(15, 20, "R")
    return finish(c, v)


def outfit_vikingfur(v):
    """Меховая накидка викинга поверх рубахи и кожаный пояс."""
    c = small()
    torso(c, v, "B", "a")
    import random as _r

    rnd = _r.Random(11)
    for _ in range(12):
        x, y = rnd.randrange(4, 21), rnd.randrange(17, 26)
        if c.get(x, y)[3]:
            c.px(x, y, rnd.choice(["n", "t", "a"]))
    if v == "s":
        c.rect(8, 16, 8, 3, "N")
        c.hline(8, 24, 8, "x")
    else:
        c.rect(5, 16, 15, 3, "N")
        c.hline(7, 24, 11, "x")
        if v == "f":
            c.rect(11, 24, 3, 1, "W")
    return finish(c, v)


def outfit_herosuit(v):
    """Костюм супергероя: синий, жёлтая эмблема-молния, красный пояс."""
    c = small()
    torso(c, v, "U", "u")
    if v == "f":
        c.ellipse(12, 20, 3, 2.2, "Y")
        c.line(13, 18, 11, 21, "R")
        c.line(13, 20, 11, 22, "R")
    c.hline(7 if v != "s" else 8, 25, 11 if v != "s" else 8, "R")
    if v != "s":
        c.hline(4, 23, 3, "R")
        c.hline(19, 23, 3, "R")
    else:
        c.hline(12, 23, 3, "R")
    return finish(c, v)


def outfit_tutu(v):
    """Балетная пачка: розовый лиф и пышная юбка."""
    c = small()
    if v == "s":
        c.rect(8, 17, 8, 8, "s")
        c.vline(8, 17, 8, "P")
        c.ellipse(12, 26, 7, 2, "w")
        c.ellipse(12, 25.5, 6, 1.4, "s")
    else:
        c.rect(7, 17, 11, 8, "s")
        c.vline(17 if v == "f" else 7, 17, 8, "P")
        c.ellipse(12, 26, 10, 2.3, "w")
        c.ellipse(12, 25.5, 9, 1.6, "s")
        if v == "f":
            c.px(12, 19, "w")
            c.px(10, 21, "w")
            c.px(14, 21, "w")
    c.outline("k")
    return c


def outfit_ninja(v):
    """Чёрный костюм ниндзя с красным поясом."""
    c = small()
    torso(c, v, "K", "k")
    if v == "f":
        c.line(8, 17, 12, 22, "g")
        c.line(16, 17, 12, 22, "g")
    c.hline(7 if v != "s" else 8, 24, 11 if v != "s" else 8, "R")
    if v == "b":
        c.line(5, 16, 19, 28, "a")
        c.rect(3, 14, 2, 3, "x")
    return finish(c, v)


def prop_scepter(v):
    """Скипетр с рубином."""
    c = Big()
    x, y = hand(v)
    c.vline(x, y - 9, 12, "Y")
    c.vline(x + 1, y - 9, 12, "y")
    c.ellipse(x + 0.5, y - 11, 2, 2, "R")
    c.px(x, y - 12, "w")
    c.outline("k")
    return c


def prop_parrot(v):
    """Попугай на плече."""
    c = Big()
    x = {"f": 18, "b": 5, "s": 10}[v]
    c.ellipse(x, 13, 2.5, 3.2, "R")
    c.ellipse(x, 10, 2, 2, "R")
    c.rect(x - 1, 15, 3, 4, "U")
    c.px(x - 1, 14, "Y")
    c.px(x + 1, 14, "E")
    if v != "b":
        c.px(x + 2, 10, "Y")
        c.px(x, 9, "k")
    c.outline("k")
    return c


def prop_sword(v):
    """Меч в руке, клинком вверх."""
    c = Big()
    x, y = hand(v)
    c.rect(x, y - 13, 2, 11, "W")
    c.vline(x + 1, y - 13, 11, "l")
    c.px(x, y - 14, "W")
    c.hline(x - 2, y - 2, 6, "Y")
    c.rect(x, y - 1, 2, 2, "b")
    c.outline("k")
    return c


def prop_raygun(v):
    """Бластер инопланетянина."""
    c = Big()
    x, y = hand(v)
    d = 1 if v != "b" else -1
    c.rect(x - 1, y - 3, 2, 4, "l")
    c.rect(x - (2 if d < 0 else 0), y - 4, 5, 2, "W")
    c.px(x + d * 4, y - 4, "c")
    c.px(x + d * 3, y - 3, "c")
    c.outline("k")
    return c


def prop_wand(v):
    """Волшебная палочка со звёздочками."""
    c = Big()
    x, y = hand(v)
    tip = (x + (4 if v != "b" else -4), y - 6)
    c.line(x, y, tip[0], tip[1], "K")
    c.px(tip[0], tip[1], "w")
    c.outline("k")
    for dx, dy in ((2, -2), (-1, -3), (3, 1)):
        c.px(tip[0] + dx, tip[1] + dy, "Y")
    return c


def back_mantle(v):
    """Королевская мантия: алая, с горностаевой опушкой."""
    c = Big()
    if v == "s":
        c.rect(3, 16, 7, 18, "R")
        c.vline(3, 16, 18, "r")
        c.rect(3, 15, 8, 3, "w")
        c.px(5, 16, "k")
    else:
        for i in range(19):
            c.hline(4 - i // 4, 16 + i, 16 + (i // 4) * 2, "R")
        c.hline(4, 15, 16, "w")
        c.hline(4, 16, 16, "w")
        for x in range(5, 20, 3):
            c.px(x, 16, "k")
        c.hline(0, 34, 24, "w")
    c.outline("k")
    return c


def back_cape(v):
    """Плащ (цвет задаёт игра): у фокусника — чёрный, у героя — красный."""
    c = Big()
    if v == "s":
        c.rect(2, 16, 7, 16, "1")
        c.vline(2, 18, 14, "2")
        c.px(1, 31, "1")
    else:
        for i in range(17):
            c.hline(5 - i // 5, 16 + i, 14 + (i // 5) * 2, "1")
        c.vline(11, 18, 15, "2")
        c.hline(5, 16, 14, "3")
    c.outline("k")
    return c


def back_shield(v):
    """Круглый щит викинга за спиной."""
    c = Big()
    if v == "s":
        c.ellipse(4, 22, 3, 7, "B")
        c.vline(4, 16, 13, "W")
    else:
        c.ellipse(11.5, 22, 8, 8, "B")
        c.ellipse(11.5, 22, 6.5, 6.5, "R" if v == "b" else "B")
        for k in range(4):
            c.line(11, 22, int(11.5 + 7 * (1 if k % 2 else -1) * (k < 2)), int(22 + 7 * (1 if k > 1 else -1) * (k % 2 == 0)), "w")
        c.ellipse(11.5, 22, 1.6, 1.6, "W")
    c.outline("k")
    return c


ITEMS = {
    "hat_feathers": hat_feathers,
    "hat_shako": hat_shako,
    "outfit_samba": outfit_samba,
    "outfit_band": outfit_band,
    "prop_maracas": prop_maracas,
    "prop_trumpet": prop_trumpet,
    "prop_drum": prop_drum,
    "prop_flag": prop_flag,
    "prop_balloon": prop_balloon,
    "back_fan": back_fan,
    "hat_flatcap": hat_flatcap,
    "hat_headscarf": hat_headscarf,
    "hat_headphones": hat_headphones,
    "hat_headband": hat_headband,
    "hat_nursecap": hat_nursecap,
    "hat_toque": hat_toque,
    "hat_policecap": hat_policecap,
    "hat_firehelmet": hat_firehelmet,
    "hat_hardhat": hat_hardhat,
    "hat_bucket": hat_bucket,
    "hat_sunhat": hat_sunhat,
    "hat_straw": hat_straw,
    "hat_bandana": hat_bandana,
    "hat_mohawk": hat_mohawk,
    "hat_beret": hat_beret,
    "hat_sailor": hat_sailor,
    "hat_cowboy": hat_cowboy,
    "hat_bikehelmet": hat_bikehelmet,
    "hat_bow": hat_bow,
    "hat_ushanka": hat_ushanka,
    "hat_furhat": hat_furhat,
    "face_beard": face_beard,
    "face_mustache": face_mustache,
    "face_sunglasses": face_sunglasses,
    "outfit_cardigan": outfit_cardigan,
    "outfit_hoodie": outfit_hoodie,
    "outfit_tracksuit": outfit_tracksuit,
    "outfit_suit": outfit_suit,
    "outfit_labcoat": outfit_labcoat,
    "outfit_chefcoat": outfit_chefcoat,
    "outfit_police": outfit_police,
    "outfit_firecoat": outfit_firecoat,
    "outfit_leather": outfit_leather,
    "outfit_fishvest": outfit_fishvest,
    "outfit_hawaii": outfit_hawaii,
    "outfit_telnyashka": outfit_telnyashka,
    "outfit_dress": outfit_dress,
    "outfit_furcoat": outfit_furcoat,
    "prop_cane": prop_cane,
    "prop_stringbag": prop_stringbag,
    "prop_briefcase": prop_briefcase,
    "prop_rod": prop_rod,
    "prop_camera": prop_camera,
    "prop_basket": prop_basket,
    "prop_newspaper": prop_newspaper,
    "prop_bouquet": prop_bouquet,
    "prop_books": prop_books,
    "prop_coffee": prop_coffee,
    "prop_palette": prop_palette,
    "prop_flask": prop_flask,
    "prop_bottle": prop_bottle,
    "back_guitar": back_guitar,
    "back_cube": back_cube,
    "back_yogamat": back_yogamat,
    "hat_crown": hat_crown,
    "hat_tricorn": hat_tricorn,
    "hat_clownwig": hat_clownwig,
    "hat_knighthelmet": hat_knighthelmet,
    "hat_antennae": hat_antennae,
    "hat_tophat": hat_tophat,
    "hat_viking": hat_viking,
    "hat_tiara": hat_tiara,
    "hat_ninjahood": hat_ninjahood,
    "face_eyepatch": face_eyepatch,
    "face_clownnose": face_clownnose,
    "face_heromask": face_heromask,
    "outfit_gown": outfit_gown,
    "outfit_piratecoat": outfit_piratecoat,
    "outfit_clownsuit": outfit_clownsuit,
    "outfit_armor": outfit_armor,
    "outfit_spacesuit": outfit_spacesuit,
    "outfit_vikingfur": outfit_vikingfur,
    "outfit_herosuit": outfit_herosuit,
    "outfit_tutu": outfit_tutu,
    "outfit_ninja": outfit_ninja,
    "prop_scepter": prop_scepter,
    "prop_parrot": prop_parrot,
    "prop_sword": prop_sword,
    "prop_raygun": prop_raygun,
    "prop_wand": prop_wand,
    "back_mantle": back_mantle,
    "back_cape": back_cape,
    "back_shield": back_shield,
}

SUFFIX = {"f": "", "b": "_b", "s": "_s"}


def main():
    for name, draw in ITEMS.items():
        for v, suffix in SUFFIX.items():
            draw(v).save(f"w_{name}{suffix}")


if __name__ == "__main__":
    main()
