"""Конкурсы «Лучший магазин района, города…» (src/game/contest.ts): кубки и картинки новостей.

Кубки 20×26 — стоят на прилавке: бронзовый (район), серебряный (город), золотой (область),
большой золотой со звездой (страна) и хрустальный (легенда). Новости 128×72: объявление
конкурса (сцена с кубком под гирляндой), победа (кубок над магазинчиком, конфетти)
и проигрыш (кубок уезжает в чужой магазин под дождём).

    python3 art/sprites.py
"""

import math
import random

from sprites import Canvas, shadowed
from news import W, H, C, broadcast, mix, person, sky, skyline

# Металл кубка: основной, светлый, тёмный.
METALS = {
    "district": ("#b86f50", "#e4a672", "#733e39"),
    "city": ("#8b9bb4", "#ffffff", "#5a6988"),
    "region": ("#feae34", "#fee761", "#b86f50"),
    "country": ("#feae34", "#fee761", "#b86f50"),
    "legend": ("#2ce8f5", "#ffffff", "#0099db"),
}


def cup(name):
    base, light, dark = (C(x) for x in METALS[name])
    big = name in ("country", "legend")
    c = Canvas(20, 26)
    # Чаша.
    top = 2 if big else 4
    c.ellipse(10, top + 6, 6.5 if big else 5.5, 6.5 if big else 5.5, base)
    c.rect(3 if big else 4, top, 14 if big else 12, 6, base)
    c.hline(3 if big else 4, top, 14 if big else 12, light)
    c.vline(6, top + 1, 8, light)
    c.vline(7, top + 2, 6, light)
    c.ellipse(13, top + 7, 2, 4, dark)
    # Ручки.
    for x in (1, 17) if big else (2, 16):
        c.rect(x, top + 2, 2, 5, base)
        c.px(x + (1 if x < 10 else 0), top + 3, (0, 0, 0, 0))
    # Ножка и подставка.
    c.rect(9, top + 12, 2, 4, dark)
    c.rect(7, top + 15, 6, 2, base)
    c.rect(5, 20, 10, 5, C("#4a3b52"))
    c.hline(5, 20, 10, C("#5a6988"))
    c.hline(7, 22, 6, light)
    if big:
        star = ["..#..", ".###.", "#####", ".###.", ".#.#."]
        for y, row in enumerate(star):
            for x, ch in enumerate(row):
                if ch == "#":
                    c.px(8 + x, top + 3 + y, C("#ffffff") if name == "legend" else C("#e43b44"))
    c.outline("k")
    return shadowed(c, 10, 25, 8, 1.5)


def podium(c, x, y, w, h, color):
    c.rect(x, y, w, h, color)
    c.hline(x, y, w, mix(color, C("#ffffff"), 0.3))


def garland(c, y):
    colors = [C("#e43b44"), C("#feae34"), C("#63c74d"), C("#0099db"), C("#b55088")]
    for i, x in enumerate(range(2, W, 8)):
        dy = 2 if i % 2 else 0
        c.line(x, y + dy, x + 8, y + 2 - dy, C("#262b44"))
        c.rect(x + 3, y + 2, 3, 3, colors[i % len(colors)])


def confetti(c, seed, n=60, top=0, bottom=H):
    rnd = random.Random(seed)
    colors = [C("#e43b44"), C("#feae34"), C("#fee761"), C("#63c74d"), C("#2ce8f5"), C("#f6757a")]
    for _ in range(n):
        x, y = rnd.randrange(W), rnd.randrange(top, bottom)
        col = rnd.choice(colors)
        c.px(x, y, col)
        if rnd.random() < 0.5:
            c.px(x + 1, y, col)


def news_contest():
    """Сцена на площади: гирлянда, пьедестал, на нём кубок, жюри за столом."""
    c = Canvas(W, H)
    sky(c, C("#5fcde4"), C("#c0cbdc"), 50)
    skyline(c, 50, C("#8b9bb4"), 23, lit=C("#ead4aa"), tall=(10, 22))
    c.rect(0, 50, W, 22, C("#c28569"))
    garland(c, 6)
    # Сцена.
    c.rect(20, 40, 88, 12, C("#a22633"))
    c.hline(20, 40, 88, C("#e43b44"))
    podium(c, 54, 30, 20, 10, C("#ead4aa"))
    trophy = cup("region").img.resize((20, 26))
    c.img.alpha_composite(trophy, (54, 6))
    # Жюри за столом.
    c.rect(82, 34, 24, 6, C("#ffffff"))
    for i, (shirt, hair) in enumerate(((C("#3a4466"), C("#4a2c1a")), (C("#68386c"), C("#c0cbdc")), (C("#265c42"), C("#181425")))):
        person(c, 84 + i * 8, 22, shirt, hair=hair)
    c.rect(82, 34, 24, 6, C("#ffffff"))
    # Зрители.
    for i, x in enumerate(range(6, W, 14)):
        if 18 < x < 110:
            continue
        person(c, x, 50, [C("#e43b44"), C("#0099db"), C("#63c74d"), C("#feae34")][i % 4])
    broadcast(c)
    c.save("news_contest")


def news_contest_won():
    """Магазинчик с лентой и огромным кубком над входом, конфетти и салют."""
    c = Canvas(W, H)
    sky(c, C("#262b44"), C("#5a6988"), 56)
    for cx, cy, col in ((22, 14, C("#feae34")), (104, 10, C("#2ce8f5")), (64, 6, C("#f6757a"))):
        for k in range(10):
            a = k * math.pi / 5
            c.line(cx, cy, int(cx + 7 * math.cos(a)), int(cy + 7 * math.sin(a)), col)
    skyline(c, 56, C("#3a4466"), 17, lit=C("#feae34"), tall=(10, 20))
    c.rect(0, 56, W, 16, C("#5a6988"))
    # Магазинчик.
    c.rect(34, 30, 60, 26, C("#b55088"))
    c.rect(32, 28, 64, 4, C("#68386c"))
    c.rect(40, 36, 14, 10, C("#fee761"))
    c.rect(74, 36, 14, 10, C("#fee761"))
    c.rect(57, 38, 14, 18, C("#8b9bb4"))
    # Лента через фасад.
    c.line(34, 30, 94, 50, C("#e43b44"))
    c.line(34, 31, 94, 51, C("#e43b44"))
    trophy = cup("region").img.resize((30, 39))
    c.img.alpha_composite(trophy, (49, 0))
    confetti(c, 5, 90, 0, 56)
    broadcast(c)
    c.save("news_contest_won")


def news_contest_lost():
    """Дождь, кубок увозят в чужой магазин с другой вывеской."""
    c = Canvas(W, H)
    sky(c, C("#3a4466"), C("#8b9bb4"), 54)
    skyline(c, 54, C("#5a6988"), 61, lit=C("#c0cbdc"), tall=(10, 22))
    c.rect(0, 54, W, 18, C("#5a6988"))
    c.rect(70, 28, 52, 26, C("#124e89"))
    c.rect(76, 20, 40, 8, C("#0099db"))
    c.rect(90, 38, 12, 16, C("#c0cbdc"))
    # Человечек несёт кубок в чужую дверь.
    person(c, 58, 36, C("#262b44"), hair=C("#181425"))
    trophy = cup("region").img.resize((12, 16))
    c.img.alpha_composite(trophy, (64, 30))
    rnd = random.Random(9)
    for _ in range(70):
        x, y = rnd.randrange(W), rnd.randrange(H - 4)
        c.line(x, y, x - 1, y + 3, mix(C("#c0cbdc"), C("#5a6988"), 0.3))
    broadcast(c)
    c.save("news_contest_lost")


def main():
    for name in METALS:
        cup(name).save(f"cup_{name}")
    news_contest()
    news_contest_won()
    news_contest_lost()


if __name__ == "__main__":
    main()
