"""Сезонный торговец у входа (src/scenes/tenantsFx.ts, buildPitch): прилавок на каждое время года и вывеска.

11.11 (просьба автора): раньше торговец был нарисован кружками и полосками прямо в сцене — непонятный, «просто
стоит». Теперь — пиксельные картинки в палитре Endesga 32, как вся улица. Двойная детализация (в мире вдвое меньше).

    python3 art/pitch.py
"""

import math

from premium import H, lit
from sprites import Canvas, shadowed

WOOD, WOOD_D, WOOD_L = H("#8f563b"), H("#5e3a2a"), H("#b86f50")
LEAF, LEAF_D, LEAF_L = H("#3e8948"), H("#265c42"), H("#63c74d")
SOIL, SOIL_D = H("#733e39"), H("#3e2731")
TIN, TIN_D, TIN_L = H("#8b9bb4"), H("#5a6988"), H("#c0cbdc")
INK = H("#181425")


def sprout(c, x, y, tall, seed):
    """Росток: стебелёк и два листка, верхушка светлее."""
    c.vline(x, y - tall, tall, LEAF)
    c.px(x - 1, y - tall + 1, LEAF_L if seed % 2 else LEAF)
    c.px(x + 1, y - tall + 2, LEAF_L)
    c.px(x, y - tall, LEAF_L)


def tulips(c, x, y, color):
    """Оцинкованное ведро с тюльпанами: три цветка на стеблях."""
    c.rect(x, y, 9, 10, TIN)
    c.vline(x + 1, y, 10, TIN_L)
    c.vline(x + 7, y, 10, TIN_D)
    c.hline(x - 1, y, 11, TIN_D)
    c.hline(x, y + 4, 9, TIN_D)
    dark = lit(color, -0.35)
    for i, (dx, top) in enumerate(((1, 9), (4, 11), (7, 8))):
        c.vline(x + dx, y - top + 3, top - 3, LEAF)
        c.px(x + dx - 1, y - 3, LEAF_L)
        c.rect(x + dx - 1, y - top, 3, 3, color)
        c.px(x + dx, y - top - 1, color)
        c.px(x + dx - 1, y - top - 1, color)
        c.px(x + dx + 1, y - top - 1, color)
        c.px(x + dx, y - top + 2, dark)
        c.px(x + dx - 1, y - top, lit(color, 0.35))


def seedlings():
    """Весна: стол с лотками рассады, по бокам вёдра с красными и жёлтыми тюльпанами. 64×40 (в мире 32×20)."""
    c = Canvas(64, 40)
    # Ножки и столешница.
    for x in (10, 51):
        c.rect(x, 25, 3, 13, WOOD_D)
    c.rect(8, 21, 48, 4, WOOD)
    c.hline(8, 21, 48, WOOD_L)
    c.hline(8, 24, 48, WOOD_D)
    c.hline(13, 31, 38, WOOD_D)
    # Лотки с землёй и ростками.
    for i in range(4):
        x0 = 10 + i * 11
        c.rect(x0, 16, 10, 5, H("#be4a2f") if i % 2 else SOIL)
        c.hline(x0, 16, 10, SOIL_D)
        c.hline(x0, 20, 10, lit(SOIL, -0.3))
        for k in range(3):
            sprout(c, x0 + 2 + k * 3, 16, 4 + (k + i) % 3, i + k)
    # Лейка под столом.
    can = H("#3e8948")
    c.rect(26, 31, 9, 6, can)
    c.hline(26, 31, 9, LEAF_L)
    c.line(35, 33, 39, 29, can)
    c.rect(39, 28, 2, 2, LEAF_D)
    c.line(27, 31, 30, 28, LEAF_D)
    c.line(30, 28, 33, 31, LEAF_D)
    tulips(c, 0, 28, H("#e43b44"))
    tulips(c, 55, 28, H("#fee761"))
    c.outline("k")
    shadowed(c, 32, 38, 30, 2.5).save("pitch_seedlings")


def icecream():
    """Лето: тележка-морозилка на колёсах под полосатым зонтом, на крышке — рожки. 56×60 (в мире 28×30)."""
    c = Canvas(56, 60)
    pink, white = H("#f6757a"), H("#f4f4f4")
    # Зонт: полосатый купол с фестонами и спица.
    def stripe(x, y):
        return pink if int((math.atan2(x + 0.5 - 28, y + 6) + 1.6) / 0.32) % 2 == 0 else white

    for y in range(0, 11):
        half = 4 + y * 2.3
        for x in range(int(28 - half), int(28 + half) + 1):
            if 0 <= x < 56:
                col = stripe(x, y)
                c.px(x, y, lit(col, -0.12) if y == 10 else col)
    for x in range(3, 53):
        if (x - 3) % 5 in (1, 2, 3):
            c.px(x, 11, stripe(x, 11))
    c.px(28, 0, H("#feae34"))
    c.vline(27, 12, 22, TIN_D)
    c.vline(28, 12, 22, TIN)
    # Рожки на крышке.
    for i, scoop in enumerate((H("#f6757a"), H("#fee761"), H("#ead4aa"), H("#63c74d"))):
        x0 = 13 + i * 8
        c.rect(x0, 26, 5, 4, scoop)
        c.px(x0 + 1, 26, lit(scoop, 0.45))
        c.px(x0 + 3, 29, lit(scoop, -0.3))
        c.rect(x0 + 1, 30, 3, 3, H("#e4a672"))
        c.px(x0 + 2, 33, H("#c28569"))
    # Короб морозилки.
    c.rect(8, 33, 40, 15, white)
    c.hline(8, 33, 40, TIN_L)
    c.rect(8, 38, 40, 3, H("#0099db"))
    c.hline(8, 41, 40, H("#124e89"))
    c.vline(47, 33, 15, TIN_L)
    c.rect(22, 43, 12, 3, TIN_L)
    c.hline(8, 47, 40, TIN)
    # Ручка и колёса.
    c.line(48, 36, 54, 33, TIN_D)
    c.rect(53, 31, 3, 3, H("#262b44"))
    for x in (12, 40):
        c.ellipse(x + 2, 51, 3.5, 3.5, H("#262b44"))
        c.px(x + 2, 51, TIN)
    c.outline("k")
    shadowed(c, 28, 56, 24, 2.5).save("pitch_icecream")


def pumpkin(c, x, y, r):
    """Тыква: оранжевый шар с бороздками, хвостик."""
    c.ellipse(x, y, r + 1, r, H("#f77622"))
    c.ellipse(x - r * 0.35, y - r * 0.3, r * 0.4, r * 0.35, H("#feae34"))
    c.vline(int(x), int(y - r + 1), int(2 * r - 1), H("#be4a2f"))
    c.vline(int(x - r * 0.55), int(y - r * 0.6), int(r * 1.3), H("#d77643"))
    c.vline(int(x + r * 0.55), int(y - r * 0.6), int(r * 1.3), H("#be4a2f"))
    c.rect(int(x), int(y - r - 2), 2, 2, LEAF_D)


def pumpkins():
    """Осень: два ящика тыкв и тюк сена. 64×40 (в мире 32×20)."""
    c = Canvas(64, 40)
    # Тюк сена справа.
    hay, hay_d = H("#fee761"), H("#d4b44a")
    c.rect(44, 24, 18, 13, hay)
    for y in range(26, 37, 3):
        c.hline(44, y, 18, hay_d)
    c.vline(49, 24, 13, H("#be4a2f"))
    c.vline(57, 24, 13, H("#be4a2f"))
    c.hline(44, 24, 18, lit(hay, 0.5))
    pumpkin(c, 53, 20, 4)
    # Ящики.
    for x0 in (2, 22):
        c.rect(x0, 25, 19, 12, WOOD)
        c.hline(x0, 25, 19, WOOD_L)
        c.hline(x0, 30, 19, WOOD_D)
        c.hline(x0, 36, 19, WOOD_D)
        c.vline(x0, 25, 12, WOOD_D)
        c.vline(x0 + 18, 25, 12, WOOD_D)
    for x, y, r in ((7, 22, 4), (15, 21, 4.5), (27, 22, 4), (36, 21, 4.5), (11, 15, 4), (31, 15, 4)):
        pumpkin(c, x, y, r)
    # Маленькие тыковки на земле перед ящиками.
    pumpkin(c, 20, 37, 2.5)
    pumpkin(c, 41, 37, 2.5)
    c.outline("k")
    shadowed(c, 32, 38, 30, 2.5).save("pitch_pumpkins")


def fir(c, x, y, tall):
    """Ёлка: три яруса, справа тень, на кончиках — снег."""
    c.rect(x - 1, y - 3, 3, 3, WOOD_D)
    tiers = 3
    for t in range(tiers):
        top = y - tall + t * tall // 4
        bottom = y - 3 - (tiers - 1 - t) * tall // 5
        for yy in range(top, bottom):
            half = 1 + (yy - top) * (4 + t) // max(1, bottom - top)
            for xx in range(x - half, x + half + 1):
                c.px(xx, yy, LEAF_D if xx > x else LEAF)
            c.px(x - half, yy, LEAF_L if (yy - top) % 3 == 0 else LEAF)
        c.hline(x - 2, top + 1, 2, H("#f4f4f4"))


def trees():
    """Зима: ёлочный базар — стойка-перекладина и пять ёлок разного роста. 64×44 (в мире 32×22). Огоньки — сцена."""
    c = Canvas(64, 44)
    # Сугроб под ёлками.
    c.ellipse(32, 40, 31, 4, H("#c0cbdc"))
    c.ellipse(30, 39, 26, 3, H("#f4f4f4"))
    # Стойка: два столба и перекладина.
    for x in (1, 61):
        c.rect(x, 12, 2, 28, WOOD_D)
        c.vline(x, 12, 28, WOOD)
    c.rect(1, 12, 62, 2, WOOD)
    c.hline(1, 12, 62, WOOD_L)
    for i, tall in enumerate((26, 31, 28, 33, 27)):
        fir(c, 8 + i * 12, 40, tall)
    c.outline("k")
    c.save("pitch_trees")


def pitch_sign():
    """Табличка торговца 42×10 (в мире 21×5) на прилавке: грифельная доска в деревянной раме; надпись мелом — сцена."""
    c = Canvas(42, 10)
    c.round_rect(0, 0, 42, 10, WOOD_D, r=2)
    c.round_rect(1, 1, 40, 8, WOOD, r=1)
    c.rect(2, 2, 38, 6, H("#262b44"))
    c.hline(2, 2, 38, H("#3a4466"))
    c.outline("k")
    c.save("pitch_sign")


# ---------------------------------------------------------------- витрины

VW, VH = 38, 11


def vitrine(season):
    """Сезонная выкладка в витрине магазина 38×11 (в мире 19×5.5) — встаёт в нижнюю часть стекла (building.ts).
    11.11 (решение автора 1а): «остров сезона» переехал из середины зала в витрины."""
    c = Canvas(VW, VH)
    b = VH - 1
    if season == "autumn":
        hay, hay_d = H("#fee761"), H("#d4b44a")
        c.rect(13, b - 5, 12, 5, hay)
        c.hline(13, b - 3, 12, hay_d)
        c.vline(16, b - 5, 5, H("#be4a2f"))
        c.vline(21, b - 5, 5, H("#be4a2f"))
        for x, y, r in ((7, b - 2, 2.6), (31, b - 2, 2.6), (19, b - 7, 2.4), (3, b - 1.5, 1.6), (35, b - 1.5, 1.6)):
            pumpkin(c, x, y, r)
    elif season == "winter":
        c.rect(0, b - 1, VW, 2, H("#f4f4f4"))
        fir(c, 19, b, 10)
        c.px(19, b - 11, H("#fee761"))
        for x, col, rib in ((6, H("#e43b44"), H("#fee761")), (11, H("#0099db"), H("#f4f4f4")), (27, H("#63c74d"), H("#e43b44")), (32, H("#b55088"), H("#fee761"))):
            c.rect(x - 2, b - 4, 5, 4, col)
            c.vline(x, b - 4, 4, rib)
            c.hline(x - 2, b - 3, 5, rib)
    elif season == "spring":
        for i, col in enumerate((H("#e43b44"), H("#fee761"), H("#f6757a"), H("#b55088"), H("#e43b44"))):
            x = 4 + i * 7
            c.rect(x - 2, b - 3, 5, 4, H("#be4a2f"))
            c.hline(x - 2, b - 3, 5, H("#d77643"))
            c.vline(x, b - 7, 4, LEAF)
            c.px(x - 1, b - 5, LEAF_L)
            c.rect(x - 1, b - 9, 3, 2, col)
            c.px(x, b - 10, col)
    else:
        for x, y in ((7, b - 2.5), (14, b - 2.5), (24, b - 2.5), (10.5, b - 6.5)):
            c.ellipse(x, y, 3.2, 2.8, LEAF)
            c.vline(int(x), int(y - 2), 4, LEAF_D)
            c.px(int(x - 1), int(y - 1.5), LEAF_L)
        c.ellipse(32, b - 2, 3.4, 3, LEAF)
        c.ellipse(32, b - 2, 2.6, 2.2, H("#e43b44"))
        c.px(31, b - 2, INK)
        c.px(33, b - 3, INK)
    c.outline("k")
    c.save(f"vitrine_{season}")


def main():
    for season in ("spring", "summer", "autumn", "winter"):
        vitrine(season)
    seedlings()
    icecream()
    pumpkins()
    trees()
    pitch_sign()


if __name__ == "__main__":
    main()
