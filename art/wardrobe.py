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
}

SUFFIX = {"f": "", "b": "_b", "s": "_s"}


def main():
    for name, draw in ITEMS.items():
        for v, suffix in SUFFIX.items():
            draw(v).save(f"w_{name}{suffix}")


if __name__ == "__main__":
    main()
