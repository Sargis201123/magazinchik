"""Серая схема (src/game/grey.ts, 13.11, задача автора #53): портрет «делового» Жоры и печать на двери.

  portrait_grey[_angry]  64×64 — Жора: короткий ёжик под тёмной кепкой-восьмиклинкой, щетина, кожанка
                         с поднятым воротом и золотая цепочка. Обычный — в утреннем предложении, angry —
                         в эхе «отомстил за отказ». Фон холодный и тёмный: человек явно не из добрых историй.
  grey_seal              40×18 — две бумажные ленты крест-накрест с красной печатью: так дверь опечатывают,
                         когда магазин попался (scenes/building.ts — в день, когда магазин закрыт до обеда).

    python3 art/grey.py
"""

from sprites import Canvas, portrait, rgb, shade

LEATHER = "#262b44"
CAP = rgb("#3a4466")
GOLD = rgb("#feae34")


def cap(p, hair):
    """Ёжик по вискам и низкая кепка-восьмиклинка с коротким козырьком."""
    p.rect(8, 10, 2, 4, hair)
    p.rect(22, 10, 2, 4, hair)
    p.ellipse(16, 7.5, 9.5, 4.2, CAP)
    p.hline(10, 5, 12, shade(CAP, 1.2))
    p.px(16, 4, shade(CAP, 0.7))
    p.rect(7, 9, 18, 2, shade(CAP, 0.65))


def jacket(p, skin, hair, shirt):
    """Щетина по челюсти, поднятый ворот кожанки и цепочка на шее."""
    # Щетина — тёмной полосой по подбородку и скулам (рот портрет рисует сам, выше).
    p.hline(13, 22, 7, shade(skin, 0.72))
    for x in (10, 11, 21, 22):
        p.px(x, 20, shade(skin, 0.78))
        p.px(x, 21, shade(skin, 0.72))
    # Ворот торчит по бокам шеи.
    p.rect(10, 22, 3, 4, shade(rgb(LEATHER), 1.5))
    p.rect(19, 22, 3, 4, shade(rgb(LEATHER), 1.5))
    # Цепочка — дугой на открытой шее.
    for x, y in ((13, 25), (14, 26), (15, 26), (16, 26), (17, 26), (18, 25)):
        p.px(x, y, GOLD)


def portraits():
    for mood in (None, "angry"):
        portrait("grey", "#4a3b52", "#e4a672", "#181425", LEATHER, cap, jacket, mood)


def seal():
    """Ленты крест-накрест через всю дверь; посередине — красная круглая печать."""
    c = Canvas(40, 18)
    for i in range(40):
        y = round(1 + i * 13 / 39)
        for dy in (0, 1, 2):
            c.px(i, y + dy, "w")
            c.px(i, 14 - y + dy, "w")
        c.px(i, y + 3, "W")
        c.px(i, 14 - y + 3, "W")
    # Печать — крупно и ярко: её должно быть видно с улицы и на маленьком экране.
    c.ellipse(20, 8.5, 6, 5.5, "R")
    c.ellipse(20, 8.5, 4.2, 3.8, "w")
    c.ellipse(20, 8.5, 2.6, 2.2, "R")
    c.hline(18, 8, 5, "m")
    c.outline("k")
    c.save("grey_seal")


def main():
    portraits()
    seal()


if __name__ == "__main__":
    main()
