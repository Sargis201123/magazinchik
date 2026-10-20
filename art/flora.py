"""Разные деревья и кусты для сквера и парка: берёза, ель, круглая липа, цветущий куст.

Раньше весь газон был засажен одним деревом — теперь сквер пёстрый. Зимой у каждого
своя снежная шапка (snowy.cap → *_snow.png). Двойная детализация (sprites.DETAIL = 2).

    python3 art/sprites.py
"""

import random

from sprites import Canvas

SHADOW = (24, 20, 37, 70)


def birch():
    """Берёза 40×60: белый ствол с чёрными чёрточками, лёгкая светлая крона."""
    c = Canvas(40, 60)
    c.ellipse(20, 55, 13, 4, SHADOW)
    c.rect(18, 26, 4, 29, "w")
    c.vline(21, 26, 29, "W")
    for y in (30, 36, 41, 47, 52):
        c.hline(18, y, 2, "k")
    canopy = Canvas(40, 60)
    for cx, cy, r in ((20, 16, 12), (12, 24, 8), (28, 22, 8), (20, 7, 8)):
        canopy.ellipse(cx, cy, r, r * 1.05, "E")
    for cx, cy, r in ((16, 12, 5), (26, 10, 4), (11, 21, 3)):
        canopy.ellipse(cx, cy, r, r, "J")
    for cx, cy, r in ((22, 26, 7), (30, 24, 4)):
        canopy.ellipse(cx, cy, r, r * 0.6, "e")
    rnd = random.Random(9)
    for _ in range(36):
        x, y = rnd.randrange(40), rnd.randrange(34)
        if canopy.get(x, y)[3]:
            canopy.px(x, y, rnd.choice(["J", "E", "e"]))
    canopy.outline("k")
    c.img.alpha_composite(canopy.img)
    c.save("tree_birch")


def pine():
    """Ель 36×60: ярусы тёмной хвои с бликами, ствол."""
    c = Canvas(36, 60)
    c.ellipse(18, 56, 12, 3.5, SHADOW)
    c.rect(16, 46, 4, 10, "a")
    c.vline(16, 46, 10, "B")
    tiers = Canvas(36, 60)
    for top, w in ((2, 10), (11, 18), (21, 26), (32, 34)):
        for row in range(13):
            half = int(w / 2 * (row + 3) / 15)
            tiers.hline(18 - half, top + row, half * 2, "d" if row % 4 else "e")
    rnd = random.Random(4)
    for _ in range(26):
        x, y = rnd.randrange(36), rnd.randrange(46)
        if tiers.get(x, y)[3]:
            tiers.px(x, y, rnd.choice(["e", "E"]))
    tiers.outline("k")
    c.img.alpha_composite(tiers.img)
    c.save("tree_pine")


def linden():
    """Круглая липа 52×56: широкая плотная крона, короткий ствол."""
    c = Canvas(52, 56)
    c.ellipse(26, 51, 20, 5, SHADOW)
    c.rect(23, 36, 6, 15, "a")
    c.vline(23, 36, 15, "B")
    canopy = Canvas(52, 56)
    canopy.ellipse(26, 21, 23, 19, "e")
    for cx, cy, r in ((19, 13, 9), (31, 11, 7), (13, 22, 5)):
        canopy.ellipse(cx, cy, r, r * 0.85, "E")
    for cx, cy, r in ((29, 31, 12), (40, 26, 6)):
        canopy.ellipse(cx, cy, r, r * 0.55, "d")
    rnd = random.Random(21)
    for _ in range(50):
        x, y = rnd.randrange(52), rnd.randrange(42)
        if canopy.get(x, y)[3]:
            canopy.px(x, y, rnd.choice(["E", "d", "e", "J"]))
    canopy.outline("k")
    c.img.alpha_composite(canopy.img)
    c.save("tree_round")


def blossom():
    """Цветущий куст 26×20: зелень в розовых и белых цветах."""
    c = Canvas(26, 20)
    c.ellipse(13, 17, 11, 3, SHADOW)
    c.ellipse(13, 10, 12, 8, "e")
    c.ellipse(10, 8, 7, 4, "E")
    c.ellipse(16, 13, 7, 3, "d")
    rnd = random.Random(2)
    for _ in range(14):
        x, y = rnd.randrange(3, 23), rnd.randrange(3, 16)
        if c.get(x, y)[1] > 100:
            c.px(x, y, rnd.choice(["s", "w", "P", "s"]))
    c.outline("k")
    c.save("bush_flower")


def main():
    birch()
    pine()
    linden()
    blossom()
    import snowy

    for name, depth in (("tree_birch", 4), ("tree_pine", 3), ("tree_round", 5), ("bush_flower", 3)):
        snowy.cap(name, depth)


if __name__ == "__main__":
    main()
