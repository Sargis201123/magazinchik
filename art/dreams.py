"""Мечты соседей (src/game/dreams.ts, src/scenes/dreamsFx.ts, src/ui/dreams.ts).

13.11, автор: «вложиться в мечту соседа». Что сбылось — видно на улице:

  dream_cart        48×52 (в мире 24×26) — кофейная тележка Кости у нашего входа: полосатый навес, кофемашина,
                    стопка стаканчиков, на борту — чашка с паром, колёса и ручка;
  dream_boat_sign   24×44 (в мире 12×22) — указатель «к лодочной станции» на тротуаре: столбик и доска-стрелка
                    с лодочкой на волнах (надписей нет — понятно на любом языке).

Портреты (общий portrait() из sprites.py) — те, кто приходит с мечтой: Костя, Аня, Пётр Ильич, Ахмед.
Палитра Endesga 32, двойная детализация, как вся улица.

    python3 art/dreams.py
"""

import sprites
from premium import H, lit
from sprites import Canvas, shadowed

INK = H("#181425")
WOOD, WOOD_D, WOOD_L = H("#8f563b"), H("#5e3a2a"), H("#b86f50")
CREAM, CREAM_D = H("#ead4aa"), H("#e4a672")
COFFEE = H("#733e39")
TIN, TIN_D, TIN_L = H("#8b9bb4"), H("#5a6988"), H("#c0cbdc")
WHITE = H("#f4f4f4")
NAVY = H("#262b44")


def cart():
    """Кофейная тележка: навес в коричнево-кремовую полоску на двух стойках, на прилавке кофемашина и стаканчики,
    кремовый короб с чашкой на борту, два колеса и ручка справа."""
    c = Canvas(48, 52)
    # Навес: полосы, фестоны снизу, светлый край сверху.
    for y in range(2, 11):
        inset = max(0, 3 - y)
        for x in range(2 + inset, 46 - inset):
            col = WOOD if ((x - 2) // 5) % 2 == 0 else CREAM
            c.px(x, y, lit(col, -0.15) if y == 10 else col)
    c.hline(4, 1, 40, lit(CREAM, 0.2))
    for x in range(2, 46):
        if (x - 2) % 5 in (1, 2, 3):
            c.px(x, 11, WOOD if ((x - 2) // 5) % 2 == 0 else CREAM_D)
    # Стойки навеса.
    for x in (6, 41):
        c.vline(x, 12, 14, TIN_D)
        c.vline(x + 1, 12, 14, TIN)
    # Кофемашина: серебристый короб, тёмная панель, рожок и чашка под ним.
    c.rect(10, 15, 14, 11, TIN)
    c.vline(10, 15, 11, TIN_L)
    c.vline(23, 15, 11, TIN_D)
    c.hline(10, 15, 14, TIN_L)
    c.rect(12, 17, 10, 3, NAVY)
    c.px(13, 18, H("#63c74d"))
    c.px(15, 18, H("#e43b44"))
    c.rect(14, 21, 6, 2, INK)
    c.rect(15, 23, 3, 3, WHITE)
    c.px(16, 23, COFFEE)
    # Стопка стаканчиков и банка с зёрнами.
    for i in range(4):
        c.rect(28, 17 + i * 2, 5, 2, WHITE if i % 2 == 0 else H("#d8d8e0"))
    c.hline(28, 25, 5, H("#d8d8e0"))
    c.rect(35, 19, 5, 7, H("#c28569"))
    c.rect(35, 18, 5, 1, WOOD_D)
    c.px(36, 21, COFFEE)
    c.px(38, 23, COFFEE)
    c.px(37, 24, COFFEE)
    # Столешница.
    c.rect(4, 26, 40, 3, WOOD)
    c.hline(4, 26, 40, WOOD_L)
    c.hline(4, 28, 40, WOOD_D)
    # Короб тележки.
    c.rect(6, 29, 36, 14, CREAM)
    c.vline(6, 29, 14, lit(CREAM, 0.15))
    c.vline(41, 29, 14, CREAM_D)
    c.hline(6, 42, 36, CREAM_D)
    c.rect(6, 37, 36, 2, WOOD)
    # Чашка с паром на борту.
    c.ellipse(24, 33, 6, 4.5, WOOD_D)
    c.rect(20, 32, 7, 4, WHITE)
    c.hline(20, 32, 7, COFFEE)
    c.px(27, 33, WHITE)
    c.px(28, 34, WHITE)
    c.px(27, 35, WHITE)
    c.hline(19, 36, 9, H("#d8d8e0"))
    for x, y in ((21, 30), (22, 29), (24, 30), (25, 29)):
        c.px(x, y, WHITE)
    # Ручка и колёса.
    c.line(42, 31, 47, 28, TIN_D)
    c.rect(46, 26, 2, 3, NAVY)
    for x in (12, 34):
        c.ellipse(x, 46, 4.5, 4.5, NAVY)
        c.ellipse(x, 46, 2, 2, TIN)
        c.px(x, 46, TIN_D)
    c.outline("k")
    shadowed(c, 24, 49, 22, 2.5).save("dream_cart")


def boat_sign():
    """Указатель к лодочной станции: столбик, доска-стрелка вправо, на ней белая лодочка с парусом на синих волнах."""
    c = Canvas(24, 44)
    # Столбик и опора.
    c.rect(10, 12, 3, 30, WOOD)
    c.vline(10, 12, 30, WOOD_L)
    c.vline(12, 12, 30, WOOD_D)
    c.rect(8, 40, 7, 2, WOOD_D)
    # Доска-стрелка.
    c.rect(1, 3, 17, 11, WOOD)
    for i in range(6):
        c.vline(18 + i, 3 + i, 11 - 2 * i, WOOD)
    c.hline(1, 3, 17, WOOD_L)
    c.hline(1, 13, 17, WOOD_D)
    # Вода и лодочка.
    c.rect(3, 10, 15, 2, H("#0099db"))
    for x in range(3, 18, 3):
        c.px(x, 10, H("#2ce8f5"))
    c.rect(6, 8, 9, 2, WHITE)
    c.px(5, 8, WHITE)
    c.px(15, 8, WHITE)
    c.hline(7, 9, 7, H("#e43b44"))
    c.vline(10, 3, 5, NAVY)
    for y in range(4, 8):
        c.hline(11, y, y - 3, WHITE)
    c.px(9, 5, H("#e43b44"))
    c.outline("k")
    shadowed(c, 11, 42, 6, 1.5).save("dream_boat_sign")


def hair_long(p, hair):
    """Длинные волосы до плеч с чёлкой — Аня (в sprites.py такой причёски нет)."""
    p.ellipse(16, 8, 9, 5.5, hair)
    p.rect(7, 8, 3, 13, hair)
    p.rect(22, 8, 3, 13, hair)
    p.hline(10, 11, 4, hair)
    p.px(14, 6, lit(hair, 0.2))


def portraits():
    p = sprites
    # Костя — кудрявый, в синей рубашке (regulars.ts), за спиной цвет кофе.
    p.portrait("dream_kostya", "#b86f50", "#d9a066", "#181425", "#5b6ee1", p.hair_curly)
    # Аня — студентка: длинные волосы, розовая кофта, тёплый «пекарский» фон.
    p.portrait("dream_anya", "#feae34", "#f2d3ab", "#733e39", "#f6757a", hair_long)
    # Пётр Ильич — лысый, в очках, седой; фон — вода пруда.
    p.portrait("dream_petr", "#0099db", "#f2c9a0", "#d8d8e0", "#8b9bb4", p.hair_bald, p.glasses)
    # Ахмед — таксист: жёлтая «таксистская» кепка (как в зале, regulars.ts), чёрные брови и усы, тёмная куртка.
    p.portrait("dream_akhmed", "#262b44", "#c68642", "#181425", "#3a4466", lambda q, hair: p.hair_cap(q, H("#fee761")), p.mustache)


def main():
    cart()
    boat_sign()
    portraits()


if __name__ == "__main__":
    main()
