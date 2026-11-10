"""Двери магазина по размеру помещения (у всех был один раздвижной стеклянный вход):
  door_wood, door_wood_half, door_wood_open — ларёк и «Магазинчик»: деревянная дверь с окошком
    и колокольчиком, по бокам — узкие окна; открывается внутрь;
  door_wide, door_wide_half, door_wide_open — универмаг и гипермаркет: широкие раздвижные двери 80×20.
Средние помещения остаются с прежней дверью 64×20 (door, door_half, door_open — art/sprites.py).

    python3 art/doors.py        # или вместе со всем: python3 art/sprites.py
"""

from sprites import Canvas, rgb

WOOD, WOOD_D, WOOD_DD = rgb("#b86f50"), rgb("#8f563b"), rgb("#733e39")
GLASS, GLASS_D, WHITE = rgb("#5fcde4"), rgb("#3a8fb8"), rgb("#ffffff")
DARK, FLOOR, BRASS = rgb("#262b44"), rgb("#4a3a4a"), rgb("#feae34")


def wood():
    for name, swing in (("door_wood", 0), ("door_wood_half", 1), ("door_wood_open", 2)):
        c = Canvas(64, 20)
        c.rect(0, 0, 64, 20, WOOD_DD)
        # Узкие окна по бокам.
        for x in (3, 47):
            c.rect(x, 3, 14, 15, GLASS)
            c.rect(x, 12, 14, 6, GLASS_D)
            c.frame(x - 1, 2, 16, 17, WOOD_D)
            c.px(x + 2, 6, WHITE)
            c.px(x + 3, 5, WHITE)
            c.vline(x + 7, 3, 15, WOOD_D)
        # Проём и створка: закрыта, приоткрыта, распахнута внутрь (видна с ребра слева).
        c.rect(20, 2, 24, 17, DARK)
        c.rect(20, 15, 24, 4, FLOOR)
        leaf = (24, 13, 4)[swing]
        c.rect(20, 2, leaf, 17, WOOD)
        if swing < 2:
            for x in range(20 + 4, 20 + leaf, 5 if swing == 0 else 4):
                c.vline(x, 3, 15, WOOD_D)
            # Окошко в двери и латунная ручка.
            ww = 12 if swing == 0 else 6
            wx = 20 + (leaf - ww) // 2
            c.rect(wx, 4, ww, 6, GLASS)
            c.frame(wx - 1, 3, ww + 2, 8, WOOD_DD)
            c.px(wx + 1, 5, WHITE)
            c.rect(20 + leaf - 4, 11, 2, 3, BRASS)
        else:
            c.vline(23, 2, 17, WOOD_DD)
        c.frame(19, 1, 26, 19, WOOD_DD)
        # Притолока и колокольчик.
        c.rect(0, 0, 64, 2, WOOD_D)
        c.px(45, 3, BRASS)
        c.px(45, 4, BRASS)
        c.px(44, 5, BRASS)
        c.px(46, 5, BRASS)
        c.frame(0, 0, 64, 20, "k")
        c.save(name)


def wide():
    for name, gap in (("door_wide", 0), ("door_wide_half", 14), ("door_wide_open", 28)):
        c = Canvas(80, 20)
        c.rect(0, 0, 80, 20, "g")
        c.rect(2, 2, 76, 16, "K")
        half = 38 - gap
        for x, w in ((2, half), (78 - half, half)):
            if w <= 0:
                continue
            c.rect(x, 2, w, 16, "c")
            c.rect(x, 2, w, 3, "w")
            c.rect(x, 12, w, 6, "U")
            for i in range(3):
                c.px(x + 3 + i, 9 - i, "w")
            # Жёлтая полоса на стекле — чтобы не врезались.
            c.hline(x + 1, 10, w - 2, BRASS)
            c.frame(x, 2, w, 16, "G")
        c.rect(0, 0, 80, 2, "l")
        # Датчик движения над створками.
        c.rect(38, 0, 4, 2, "K")
        c.px(39, 1, rgb("#63c74d"))
        c.frame(0, 0, 80, 20, "k")
        c.save(name)


def main():
    wood()
    wide()


if __name__ == "__main__":
    main()
