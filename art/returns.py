"""Ритуал возвращения (src/game/returns.ts, src/ui/returns.ts): сундучок выручки и конверт с письмом.

  chest_closed  24×20 — деревянный сундучок с жёлтыми оковками и замочком;
  chest_open    24×24 — он же открытый: крышка откинута назад, внутри горка монет с бликами;
  envelope      22×16 — почтовый конверт с красной сургучной печатью и маркой в углу.

Картинки — для окна в DOM (не текстуры мира): в атлас Phaser не попадают.

    python3 art/returns.py
"""

from sprites import Canvas


def chest_closed():
    c = Canvas(24, 20)
    # Крышка-полукруг.
    c.round_rect(1, 1, 22, 7, "B", r=3)
    c.hline(4, 1, 16, "n")
    c.hline(3, 2, 18, "n")
    for x in (3, 20):
        c.vline(x, 1, 7, "y")
    c.hline(1, 7, 22, "y")
    # Короб.
    c.rect(1, 8, 22, 11, "B")
    for y in (11, 15):
        c.hline(2, y, 20, "a")
    c.vline(1, 8, 11, "b")
    c.vline(22, 8, 11, "b")
    c.hline(1, 18, 22, "b")
    for x in (3, 20):
        c.vline(x, 8, 11, "y")
    # Замочек: жёлтая пластина с чёрной скважиной.
    c.rect(10, 6, 4, 5, "Y")
    c.px(11, 8, "k")
    c.px(12, 8, "k")
    c.px(11, 9, "k")
    c.outline("k")
    return c


def chest_open():
    c = Canvas(24, 24)
    # Откинутая крышка — сзади, видна изнутри (темнее).
    c.round_rect(2, 1, 20, 7, "a", r=2)
    c.hline(2, 7, 20, "y")
    for x in (4, 19):
        c.vline(x, 1, 7, "y")
    c.rect(4, 3, 16, 3, "b")
    # Горка монет над краем короба.
    c.ellipse(12, 11.5, 9, 3.5, "y")
    c.ellipse(12, 10.5, 7, 2.6, "Y")
    for x, y in ((6, 10), (9, 9), (13, 9), (16, 10), (11, 11), (15, 11), (8, 11)):
        c.px(x, y, "w")
        c.px(x + 1, y, "Y")
    c.px(12, 8, "w")
    # Короб.
    c.rect(1, 12, 22, 11, "B")
    for y in (15, 19):
        c.hline(2, y, 20, "a")
    c.vline(1, 12, 11, "b")
    c.vline(22, 12, 11, "b")
    c.hline(1, 22, 22, "b")
    for x in (3, 20):
        c.vline(x, 12, 11, "y")
    c.hline(1, 12, 22, "y")
    c.rect(10, 12, 4, 3, "Y")
    c.px(11, 13, "k")
    c.px(12, 13, "k")
    c.outline("k")
    return c


def envelope():
    c = Canvas(22, 16)
    c.rect(1, 1, 20, 14, "N")
    # Клапан треугольником и боковые сгибы.
    for i in range(8):
        c.hline(1 + i, 1 + i, 20 - 2 * i, "q")
        c.px(1 + i, 1 + i, "Q")
        c.px(20 - i, 1 + i, "Q")
    for i in range(6):
        c.px(1 + i, 14 - i, "Q")
        c.px(20 - i, 14 - i, "Q")
    # Сургучная печать на клапане.
    c.ellipse(11, 9, 2.6, 2.4, "r")
    c.px(10, 8, "R")
    c.px(11, 8, "R")
    # Марка в углу.
    c.rect(16, 2, 4, 4, "U")
    c.frame(16, 2, 4, 4, "w")
    c.outline("k")
    return c


def main():
    chest_closed().save("chest_closed")
    chest_open().save("chest_open")
    envelope().save("envelope")


if __name__ == "__main__":
    main()
