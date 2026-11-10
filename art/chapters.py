"""Иллюстрации глав сюжета (public/story, 320×180): сцена с маленькими фигурками, светом и погодой —
в духе фонов «Папы и Сони» (art/family.py), а не крупные бюсты на условном фоне. Рисуется в сетке
160×90 и увеличивается вдвое. Надписей на вывесках нет — картинки одни на все языки.

    python3 art/chapters.py        # или вместе со всем: python3 art/sprites.py
"""

import math
import random
from pathlib import Path

from PIL import Image

from sprites import Canvas

W, H = 160, 90
OUT = Path(__file__).resolve().parent.parent / "public" / "story"
GROUND = 62  # линия, на которой стоят дома; ноги людей — на 2 ниже


def C(s):
    return (int(s[1:3], 16), int(s[3:5], 16), int(s[5:7], 16), 255)


INK = C("#181425")
NAVY = C("#262b44")
SKIN = C("#eec39a")
WHITE = C("#ffffff")


def mix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)


def shade(color, k):
    return tuple(max(0, min(255, int(v * k))) for v in color[:3]) + (255,)


def bands(c, colors, y0, y1, steps=9):
    """Небо ступенями между опорными цветами (пиксель-арт, без плавного градиента)."""
    n = len(colors) - 1
    for i in range(steps):
        a = y0 + (y1 - y0) * i // steps
        b = y0 + (y1 - y0) * (i + 1) // steps
        t = i / max(1, steps - 1) * n
        k = min(n - 1, int(t))
        c.rect(0, a, W, b - a, mix(colors[k], colors[k + 1], t - k))


def tint(c, x0, y0, x1, y1, color, t):
    for y in range(max(0, y0), min(H, y1)):
        for x in range(max(0, x0), min(W, x1)):
            c.px(x, y, mix(c.get(x, y), color, t))


def glow(c, cx, cy, rx, ry, color, strength):
    """Пятно света в три ступени."""
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
            if d <= 1 and 0 <= x < W and 0 <= y < H:
                step = 3 - min(2, int(d * 3))
                c.px(x, y, mix(c.get(x, y), color, strength * step / 3))


def cone(c, x, top, bottom, half, color, strength):
    for y in range(top, bottom):
        t = (y - top) / max(1, bottom - top - 1)
        w = int(2 + (half - 2) * t)
        for xx in range(x - w, x + w + 1):
            if 0 <= xx < W and 0 <= y < H:
                c.px(xx, y, mix(c.get(xx, y), color, strength * (1 - 0.45 * t)))


def skyline(c, base, color, seed, lit=None, tall=(6, 18)):
    rnd = random.Random(seed)
    x = -3
    while x < W:
        w = rnd.randrange(10, 20)
        h = rnd.randrange(*tall)
        c.rect(x, base - h, w, h, color)
        c.hline(x, base - h, w, shade(color, 1.15))
        if lit:
            for wy in range(base - h + 3, base - 2, 4):
                for wx in range(x + 2, x + w - 2, 4):
                    if rnd.random() < 0.5:
                        c.rect(wx, wy, 2, 2, lit)
        x += w + rnd.randrange(0, 3)


def street(c, walk, road, dash, y=GROUND):
    """Тротуар плиткой и дорога с разметкой."""
    c.rect(0, y, W, 11, walk)
    c.hline(0, y, W, shade(walk, 1.12))
    for yy in (y + 4, y + 8):
        c.hline(0, yy, W, shade(walk, 0.88))
    for x in range(0, W, 10):
        c.vline(x, y + 1, 3, shade(walk, 0.88))
        c.vline(x + 5, y + 5, 3, shade(walk, 0.88))
    c.rect(0, y + 11, W, H - y - 11, road)
    c.hline(0, y + 11, W, shade(road, 0.7))
    for x in range(4, W, 22):
        c.rect(x, y + 19, 10, 2, dash)


def who(c, x, y, shirt, hair, skin=SKIN, pants=NAVY, small=False, long_hair=False, back=False):
    """Человечек 7×18 (ребёнок 7×14): (x, y) — макушка. back — стоит спиной."""
    h = 14 if small else 18
    c.ellipse(x + 3.5, y + 9 + h - 8.5, 5, 1.2, (24, 20, 37, 70))
    c.rect(x, y + h - 5, 3, 5, pants)
    c.rect(x + 4, y + h - 5, 3, 5, pants)
    c.rect(x - 1, y + 6, 9, h - 11, shirt)
    c.vline(x + 7, y + 6, h - 11, shade(shirt, 0.8))
    c.ellipse(x + 3, y + 3, 3, 3, skin)
    c.rect(x, y, 7, 2, hair)
    c.px(x, y + 2, hair)
    c.px(x + 6, y + 2, hair)
    if long_hair:
        c.rect(x - 1, y + 1, 2, 7, hair)
        c.rect(x + 6, y + 1, 2, 7, hair)
    if back:
        c.rect(x, y, 7, 5, hair)
    else:
        c.px(x + 2, y + 3, INK)
        c.px(x + 4, y + 3, INK)


def grandma(c, x, y):
    hair = C("#d8d8e0")
    who(c, x, y, C("#68386c"), hair, skin=C("#f2d3ab"), pants=C("#3a4466"))
    c.rect(x + 2, y - 2, 3, 2, hair)
    c.px(x + 3, y + 8, C("#feae34"))


def hero(c, x, y, **kw):
    who(c, x, y, C("#3e8948"), C("#4a2c1a"), **kw)


def valya(c, x, y):
    hair = C("#c0cbdc")
    who(c, x, y, C("#a22633"), hair)
    for dx, dy in ((-1, 1), (7, 1), (-1, 3), (7, 3)):
        c.px(x + dx, y + dy, hair)
    c.rect(x + 8, y + 10, 3, 4, C("#feae34"))
    c.px(x + 9, y + 9, C("#8f563b"))


def marat(c, x, y):
    who(c, x, y, WHITE, C("#4a2c1a"), skin=C("#d9a066"))
    c.rect(x, y - 3, 7, 3, WHITE)
    c.rect(x - 1, y - 5, 9, 3, WHITE)
    c.hline(x, y - 1, 7, C("#c0cbdc"))
    c.hline(x + 2, y + 5, 3, C("#4a2c1a"))
    c.hline(x + 1, y + 6, 5, C("#e43b44"))


def eduard(c, x, y):
    who(c, x, y, C("#3a4466"), INK, skin=C("#f2d3ab"), pants=NAVY)
    c.vline(x + 3, y + 6, 4, C("#e43b44"))
    c.px(x + 2, y + 6, WHITE)
    c.px(x + 4, y + 6, WHITE)


def inspector(c, x, y):
    who(c, x, y, NAVY, NAVY, pants=NAVY)
    c.rect(x - 1, y - 1, 9, 2, C("#3a4466"))
    c.hline(x - 2, y + 1, 5, INK)
    c.px(x + 3, y - 1, C("#feae34"))
    c.px(x + 6, y + 8, C("#feae34"))
    # Планшет с бумагой.
    c.rect(x - 5, y + 8, 5, 6, C("#8f563b"))
    c.rect(x - 4, y + 9, 3, 4, WHITE)
    c.px(x - 3, y + 10, C("#8b9bb4"))
    c.px(x - 3, y + 12, C("#8b9bb4"))


def sonya(c, x, y):
    who(c, x, y, C("#68386c"), C("#8f563b"), skin=C("#f2d3ab"), small=True, long_hair=True)
    c.px(x + 5, y, C("#fee761"))


def shop(c, x, w, top, wall, stripe=(C("#e43b44"), WHITE), lit=None, sign=C("#68386c"), rows=1, door=None):
    """Наш магазин: стена, карниз, вывеска с лампочками, полосатый навес, витрины с товаром, дверь."""
    h = GROUND - top
    c.rect(x, top, w, h, wall)
    c.vline(x + w - 1, top, h, shade(wall, 0.82))
    c.rect(x - 1, top - 2, w + 2, 3, shade(wall, 0.7))
    c.hline(x - 1, top - 2, w + 2, shade(wall, 1.1))
    for i in range(0, h, 4):
        c.hline(x + (3 if i % 8 else 9), top + 3 + i, 5, shade(wall, 0.93))
    glass = lit or C("#5fcde4")
    # Окна верхних этажей.
    for r in range(rows - 1):
        wy = top + 5 + r * 11
        for wx in range(x + 5, x + w - 9, 11):
            c.rect(wx, wy, 6, 7, glass)
            c.frame(wx - 1, wy - 1, 8, 9, shade(wall, 0.6))
            c.vline(wx + 3, wy, 7, shade(wall, 0.6))
    base = top + (rows - 1) * 11
    # Вывеска.
    sw = min(40, w - 16)
    sx = x + (w - sw) // 2
    c.rect(sx, base + 2, sw, 7, sign)
    c.frame(sx, base + 2, sw, 7, shade(sign, 0.6))
    for i in range(sx + 3, sx + sw - 3, 3):
        c.px(i, base + 5, C("#fee761"))
        c.px(i + 1, base + 5, C("#fee761") if (i // 3) % 2 else C("#feae34"))
    # Навес с фестонами.
    ay = base + 11
    for i, ax in enumerate(range(x - 1, x + w + 1, 4)):
        col = stripe[i % 2]
        c.rect(ax, ay, 4, 4, col)
        c.hline(ax, ay + 3, 4, shade(col, 0.8))
        c.px(ax + 1, ay + 4, col)
        c.px(ax + 2, ay + 4, col)
    c.hline(x - 1, ay - 1, w + 2, shade(stripe[0], 0.6))
    # Дверь и витрины.
    dx = door if door is not None else x + w - 15
    wy = ay + 7
    wh = GROUND - wy - 3
    c.rect(dx, wy - 1, 9, GROUND - wy + 1, C("#8f563b"))
    c.rect(dx + 1, wy, 7, wh - 2, glass)
    c.px(dx + 7, wy + wh // 2 + 2, C("#fee761"))
    goods = [C("#e43b44"), C("#feae34"), C("#63c74d"), C("#e4a672"), C("#f6757a")]
    rnd = random.Random(x * 7 + w)
    wx = x + 4
    while wx + 14 <= x + w - 2:
        if not (wx + 14 > dx - 2 and wx < dx + 11):
            c.rect(wx, wy, 14, wh, glass)
            c.frame(wx - 1, wy - 1, 16, wh + 2, shade(wall, 0.55))
            c.hline(wx, wy + wh - 4, 14, shade(wall, 0.7))
            for gx in range(wx + 1, wx + 13, 2):
                c.rect(gx, wy + wh - 3, 2, 3, rnd.choice(goods))
                if rnd.random() < 0.6:
                    c.px(gx, wy + wh - 7 + rnd.randrange(2), rnd.choice(goods))
            c.px(wx + 2, wy + 1, WHITE)
            c.px(wx + 3, wy + 2, WHITE)
        wx += 18
    c.hline(x, GROUND - 1, w, shade(wall, 0.6))
    return dx


def tree(c, x, base, leaf, r=8):
    c.rect(x - 1, base - 9, 3, 9, C("#733e39"))
    c.ellipse(x, base - 14, r, r - 1, shade(leaf, 0.8))
    c.ellipse(x - 2, base - 16, r - 2, r - 3, leaf)
    c.ellipse(x - 4, base - 18, 2.5, 2, shade(leaf, 1.18))


def lamp(c, x, base, on=None):
    if on:
        cone(c, x, base - 23, base + 4, 9, on, 0.16)
        glow(c, x, base + 3, 11, 3, on, 0.3)
    c.rect(x, base - 24, 1, 24, C("#3a4466"))
    c.rect(x - 2, base - 26, 5, 2, C("#3a4466"))
    c.hline(x - 1, base - 24, 3, on or C("#8b9bb4"))
    if on:
        glow(c, x, base - 24, 4, 3, on, 0.55)


def cloud(c, x, y, color, w=18):
    c.ellipse(x, y, w / 2, 2.5, color)
    c.ellipse(x - w / 5, y - 2, w / 4, 2.5, color)
    c.ellipse(x + w / 6, y - 3, w / 4, 3, color)


def megamart(c, x, top, glass, frame, sign, lit=None):
    """«МегаМарт»: стеклянная коробка в сетку с красной полосой вывески."""
    w = W - x
    c.rect(x, top, w, GROUND - top, glass)
    for gx in range(x, W, 8):
        c.vline(gx, top, GROUND - top, frame)
    for gy in range(top, GROUND, 7):
        c.hline(x, gy, w, frame)
    rnd = random.Random(top * 31 + x)
    for gy in range(top + 1, GROUND - 6, 7):
        for gx in range(x + 1, W, 8):
            if lit and rnd.random() < 0.45:
                c.rect(gx, gy, 7, 6, lit)
            elif rnd.random() < 0.3:
                c.rect(gx, gy, 3, 6, shade(glass, 1.15))
    c.rect(x + 6, top + 14, w - 10, 9, sign)
    c.frame(x + 6, top + 14, w - 10, 9, shade(sign, 0.6))
    for gx in range(x + 10, W - 8, 6):
        c.rect(gx, top + 17, 4, 3, shade(sign, 1.6) if sign[0] < 150 else WHITE)
    c.rect(x - 1, top - 2, w + 2, 3, shade(frame, 0.8))
    c.rect(x + w // 2 - 7, GROUND - 14, 14, 14, shade(glass, 0.6))
    c.vline(x + w // 2, GROUND - 14, 14, frame)


def firework(c, cx, cy, r, color, seed):
    rnd = random.Random(seed)
    for i in range(14):
        a = i * math.tau / 14 + rnd.random() * 0.2
        for d in range(2, r, 2):
            x = round(cx + math.cos(a) * d)
            y = round(cy + math.sin(a) * d * 0.9 + (d / r) ** 2 * 2)
            c.px(x, y, color if d > r * 0.45 else mix(color, WHITE, 0.6))
    c.rect(cx - 1, cy - 1, 2, 2, WHITE)
    glow(c, cx, cy, r + 3, r + 2, color, 0.16)


def save(c, name):
    OUT.mkdir(parents=True, exist_ok=True)
    c.img.resize((W * 2, H * 2), Image.NEAREST).save(OUT / f"{name}.png")


def ch1():
    """Наследство. Рассвет: бабушка у ларька отдаёт внуку ключи, её ждёт автобус на дачу."""
    c = Canvas(W, H)
    bands(c, [C("#3a3a6a"), C("#68386c"), C("#b55088"), C("#f77622"), C("#feae34")], 0, 52, 11)
    c.ellipse(118, 51, 10, 10, C("#fee761"))
    glow(c, 118, 48, 34, 16, C("#fee761"), 0.35)
    cloud(c, 34, 14, C("#b55088"), 22)
    cloud(c, 92, 9, C("#f6757a"), 16)
    skyline(c, 52, C("#4a3a66"), 11)
    c.rect(0, 52, W, 10, C("#3e6a52"))
    c.hline(0, 52, W, C("#63a05a"))
    street(c, C("#a79bb0"), C("#33304e"), C("#c8b8a8"))
    tree(c, 10, GROUND, C("#4a8a52"))
    shop(c, 22, 62, 22, C("#e8c8a0"), lit=C("#feae34"))
    glow(c, 53, GROUND + 5, 30, 5, C("#feae34"), 0.3)
    # Ящики у входа.
    for bx, col in ((25, C("#e43b44")), (33, C("#63c74d"))):
        c.rect(bx, GROUND - 5, 7, 5, C("#b86f50"))
        c.hline(bx + 1, GROUND - 6, 5, col)
    # Автобус на дачу: дверь открыта.
    c.rect(124, 44, 40, 20, C("#63c74d"))
    c.rect(124, 44, 40, 3, C("#3e8948"))
    c.hline(124, 58, 40, C("#3e8948"))
    for bx in range(134, W, 9):
        c.rect(bx, 48, 7, 6, C("#ffd9a0"))
    c.rect(126, 48, 6, 14, C("#2a2a3e"))
    c.ellipse(138, 64, 3, 3, INK)
    c.ellipse(138, 64, 1, 1, C("#8b9bb4"))
    c.ellipse(157, 64, 3, 3, INK)
    c.rect(120, 40, 1, 24, C("#3a4466"))
    c.rect(117, 38, 7, 5, C("#fee761"))
    c.frame(117, 38, 7, 5, C("#3a4466"))
    # Бабушка с чемоданом протягивает ключи.
    grandma(c, 94, 46)
    c.rect(87, 58, 6, 6, C("#8f563b"))
    c.hline(88, 57, 4, C("#5a3420"))
    c.px(90, 61, C("#feae34"))
    hero(c, 106, 46)
    c.hline(101, 54, 4, C("#f2d3ab"))
    c.px(103, 53, C("#fee761"))
    c.px(104, 53, C("#fee761"))
    c.px(104, 52, WHITE)
    for bx, by in ((60, 12), (66, 15), (140, 20)):
        c.px(bx, by, INK)
        c.px(bx + 1, by - 1, INK)
        c.px(bx + 2, by, INK)
    save(c, "ch1")


def ch2():
    """Свои люди. Солнечный день: Марат уносит заказ в кафе, Валентина с сумкой, у двери — первый сотрудник."""
    c = Canvas(W, H)
    bands(c, [C("#0099db"), C("#3fb8e8"), C("#9ad8f0"), C("#d8f0f8")], 0, 54, 9)
    c.ellipse(140, 14, 8, 8, C("#fee761"))
    glow(c, 140, 14, 20, 16, C("#fee761"), 0.3)
    cloud(c, 30, 12, WHITE, 24)
    cloud(c, 88, 20, WHITE, 18)
    skyline(c, 54, C("#8fb8d8"), 23, tall=(5, 14))
    c.rect(0, 54, W, 8, C("#63c74d"))
    c.hline(0, 54, W, C("#8fde5d"))
    street(c, C("#d2d6e0"), C("#3a4466"), C("#e6e1d6"))
    # Кафе «Пончик» слева: терракотовая стена, зонтики веранды.
    c.rect(0, 26, 40, 36, C("#d9825a"))
    c.rect(0, 24, 41, 3, C("#8f4a35"))
    c.rect(6, 31, 26, 6, C("#733e39"))
    for i in range(9, 30, 4):
        c.px(i, 34, C("#fee761"))
    c.rect(8, 42, 12, 12, C("#5fcde4"))
    c.frame(7, 41, 14, 14, C("#733e39"))
    for ux in (10, 30):
        c.vline(ux, 50, 14, C("#8b9bb4"))
        for i in range(-8, 9):
            col = C("#e43b44") if (i // 3) % 2 else WHITE
            c.vline(ux + i, 48 - (3 if abs(i) < 5 else 1 if abs(i) < 8 else 0), 3, col)
        c.rect(ux - 4, 58, 9, 1, C("#b86f50"))
    tree(c, 150, GROUND, C("#63c74d"), 9)
    dx = shop(c, 58, 76, 20, C("#f0d8b0"))
    for bx, col in ((62, C("#e43b44")), (71, C("#feae34")), (80, C("#63c74d"))):
        c.rect(bx, GROUND - 5, 8, 5, C("#b86f50"))
        c.hline(bx + 1, GROUND - 6, 6, col)
        c.px(bx + 2, GROUND - 7, col)
        c.px(bx + 5, GROUND - 7, col)
    # Марат несёт ящик к кафе.
    marat(c, 44, 46)
    c.rect(38, 54, 8, 5, C("#b86f50"))
    for i in (39, 41, 43):
        c.px(i, 53, C("#e43b44"))
    valya(c, 96, 46)
    hero(c, 108, 46)
    c.vline(116, 49, 4, SKIN)
    c.px(117, 48, SKIN)
    # Новый сотрудник в фартуке с метлой.
    who(c, dx + 12, 46, C("#5fcde4"), C("#733e39"))
    c.rect(dx + 13, 54, 5, 6, WHITE)
    c.line(dx + 22, 44, dx + 20, 62, C("#8f563b"))
    c.rect(dx + 18, 61, 5, 3, C("#feae34"))
    save(c, "ch2")


def ch3():
    """Конкурент. Пасмурно: стеклянный «МегаМарт» с краном навис над улицей, наш магазин — в его тени."""
    c = Canvas(W, H)
    bands(c, [C("#5a6988"), C("#7a8aa6"), C("#a8b4c8"), C("#c8d0dc")], 0, 54, 9)
    for cx, cy, cw in ((24, 10, 30), (70, 16, 26), (120, 7, 34)):
        cloud(c, cx, cy, C("#8b9bb4"), cw)
    skyline(c, 54, C("#7888a4"), 31, tall=(5, 12))
    c.rect(0, 54, W, 8, C("#4a7a5a"))
    street(c, C("#b4bccb"), C("#33384e"), C("#c8ccd4"))
    megamart(c, 86, 2, C("#3a4a6a"), C("#26304a"), C("#e43b44"), lit=C("#9ad8f0"))
    # Кран над стройкой второго корпуса.
    c.rect(151, 0, 2, 4, C("#f77622"))
    c.hline(92, 0, 66, C("#f77622"))
    c.hline(92, 1, 66, C("#c85a18"))
    c.vline(104, 2, 9, INK)
    c.rect(102, 11, 5, 3, C("#feae34"))
    # Флажки у входа.
    for i, fx in enumerate(range(90, W, 6)):
        c.rect(fx, GROUND - 17, 3, 2, (C("#e43b44"), C("#fee761"), WHITE)[i % 3])
    # Тень гиганта ложится на нашу сторону улицы: земля, стены и дерево темнее, а витрины горят.
    tint(c, 0, 54, 82, H, NAVY, 0.3)
    dim = lambda col: mix(col, NAVY, 0.3)
    shop(c, 6, 54, 30, dim(C("#e8c8a0")), stripe=(dim(C("#e43b44")), dim(WHITE)), lit=C("#feae34"), sign=dim(C("#68386c")))
    tree(c, 70, GROUND, dim(C("#5a8a5a")), 7)
    glow(c, 30, GROUND - 6, 12, 7, C("#feae34"), 0.3)
    hero(c, 48, 46)
    eduard(c, 100, 46)
    c.hline(99, 53, 9, C("#3a4466"))
    c.hline(100, 54, 7, shade(C("#3a4466"), 0.8))
    for i in range(26):
        rnd = random.Random(i)
        x, y = rnd.randrange(W), rnd.randrange(50)
        c.px(x, y, mix(c.get(x, y), WHITE, 0.25))
    save(c, "ch3")


def ch4():
    """Проверка. Зал: инспектор Белова с планшетом у полок, хозяин рядом, пол вымыт до блеска."""
    c = Canvas(W, H)
    c.rect(0, 0, W, 42, C("#f0dcb4"))
    for x in range(0, W, 12):
        c.vline(x, 0, 34, C("#e4cca0"))
    c.rect(0, 34, W, 8, C("#b86f50"))
    for x in range(0, W, 4):
        c.vline(x, 35, 7, C("#8f563b"))
    c.hline(0, 34, W, C("#e4a672"))
    # Пол плиткой.
    c.rect(0, 42, W, H - 42, C("#ead4aa"))
    for y in range(42, H, 8):
        c.hline(0, y, W, C("#d4b888"))
    for x in range(0, W, 12):
        c.vline(x, 42, H - 42, C("#d4b888"))
    c.hline(0, 42, W, C("#8f563b"))
    # Полки у стены: хлеб, овощи, холодильник.
    for sx, frame_col, back in ((8, C("#b86f50"), C("#8f563b")), (48, C("#3e8948"), C("#2a5a36"))):
        c.rect(sx, 8, 36, 34, frame_col)
        c.rect(sx + 2, 12, 32, 12, back)
        c.rect(sx + 2, 27, 32, 12, back)
        c.rect(sx + 12, 5, 12, 6, WHITE)
        c.frame(sx + 12, 5, 12, 6, INK)
    rnd = random.Random(4)
    for gx in range(11, 41, 4):
        for gy in (20, 35):
            c.ellipse(gx + 1.5, gy, 2, 1.8, rnd.choice([C("#e4a672"), C("#d9a066"), C("#ead4aa")]))
    c.ellipse(26, 8, 2.5, 1.5, C("#e4a672"))
    for gx in range(51, 81, 4):
        for gy in (20, 35):
            c.rect(gx, gy - 1, 3, 3, rnd.choice([C("#e43b44"), C("#63c74d"), C("#feae34"), C("#a22633")]))
    c.rect(64, 6, 3, 3, C("#e43b44"))
    c.rect(88, 8, 36, 34, C("#c0cbdc"))
    c.rect(90, 12, 15, 27, C("#d8f0f8"))
    c.rect(107, 12, 15, 27, C("#d8f0f8"))
    for gx in range(91, 121, 3):
        if gx in (103, 106):
            continue
        c.rect(gx, 19, 2, 5, rnd.choice([WHITE, C("#5fcde4"), C("#0099db")]))
        c.rect(gx, 32, 2, 5, rnd.choice([WHITE, C("#f6757a"), C("#5fcde4")]))
    c.hline(90, 25, 32, C("#8b9bb4"))
    c.rect(88, 8, 36, 3, C("#5fcde4"))
    # Дверь и часы.
    c.rect(134, 12, 14, 30, C("#8b9bb4"))
    c.frame(134, 12, 14, 30, C("#5a6988"))
    c.px(145, 28, C("#feae34"))
    c.ellipse(141, 5.5, 4, 4, INK)
    c.ellipse(141, 5.5, 3, 3, WHITE)
    c.vline(141, 3, 3, INK)
    c.hline(141, 5, 2, INK)
    # Лампы.
    for lx in (40, 112):
        c.vline(lx, 0, 3, C("#5a6988"))
        c.rect(lx - 3, 3, 7, 2, C("#feae34"))
        cone(c, lx, 5, 80, 34, C("#fff0c0"), 0.16)
    # Инспектор показывает на полку, хозяин вытянулся рядом.
    inspector(c, 70, 52)
    c.hline(77, 59, 5, NAVY)
    c.px(82, 58, SKIN)
    hero(c, 94, 52)
    # Ведро со шваброй и блеск на полу.
    c.rect(116, 64, 7, 6, C("#0099db"))
    c.hline(116, 64, 7, C("#5fcde4"))
    c.line(124, 48, 120, 66, C("#8f563b"))
    for sx, sy in ((30, 62), (54, 74), (104, 80), (138, 66), (22, 80)):
        c.px(sx, sy, WHITE)
        c.px(sx - 1, sy, WHITE)
        c.px(sx + 1, sy, WHITE)
        c.px(sx, sy - 1, WHITE)
        c.px(sx, sy + 1, WHITE)
    save(c, "ch4")


def big_store(c, x, w, night=False):
    wall = C("#e8d0a8") if not night else C("#8a7a8a")
    dx = shop(c, x, w, 14, wall, lit=C("#fee761"), rows=2, door=x + w // 2 - 4)
    glow(c, x + w // 2, GROUND + 5, w // 2, 6, C("#feae34"), 0.32)
    return dx


def ch5():
    """Универмаг. Сумерки: наш большой магазин светится, «МегаМарт» погас, Эдуард уходит с коробкой."""
    c = Canvas(W, H)
    bands(c, [NAVY, C("#3a3a6a"), C("#68386c"), C("#b55088"), C("#f6757a")], 0, 54, 11)
    for sx, sy in ((12, 6), (40, 10), (70, 4), (96, 12), (130, 5), (150, 16)):
        c.px(sx, sy, WHITE)
    skyline(c, 54, C("#3a3058"), 51, lit=C("#feae34"))
    c.rect(0, 54, W, 8, C("#2e4a48"))
    street(c, C("#8a84a0"), C("#2a2840"), C("#a89cb0"))
    megamart(c, 122, 8, C("#22263a"), C("#181c2c"), C("#4a5068"))
    # Заколоченный вход и листок «продаётся».
    c.line(134, GROUND - 13, 147, GROUND - 2, C("#8f563b"))
    c.line(147, GROUND - 13, 134, GROUND - 2, C("#8f563b"))
    c.rect(126, GROUND - 22, 8, 6, WHITE)
    c.hline(127, GROUND - 20, 6, C("#e43b44"))
    c.hline(127, GROUND - 18, 4, C("#8b9bb4"))
    big_store(c, 8, 104)
    tint(c, 8, 12, 112, 30, C("#68386c"), 0.18)
    lamp(c, 117, GROUND + 2, on=C("#fee761"))
    # Эдуард уходит с коробкой.
    eduard(c, 132, 48)
    c.rect(139, 56, 7, 5, C("#b86f50"))
    c.hline(139, 56, 7, C("#e4a672"))
    # Свои у входа.
    hero(c, 50, 46)
    c.vline(58, 48, 4, SKIN)
    who(c, 34, 46, C("#5fcde4"), C("#733e39"))
    who(c, 78, 46, C("#f6757a"), C("#181425"), skin=C("#d9a066"), long_hair=True)
    save(c, "ch5")


def finale():
    """Финал. Ночь, салют над универмагом, у входа — бабушка, Соня, Валентина, Марат и весь район."""
    c = Canvas(W, H)
    bands(c, [INK, C("#1d1a36"), NAVY, C("#33305a")], 0, 54, 8)
    rnd = random.Random(9)
    for _ in range(40):
        c.px(rnd.randrange(W), rnd.randrange(44), mix(NAVY, WHITE, rnd.choice([0.4, 0.7, 1])))
    skyline(c, 54, C("#221f3a"), 77, lit=C("#feae34"))
    firework(c, 30, 16, 13, C("#e43b44"), 1)
    firework(c, 78, 9, 10, C("#fee761"), 2)
    firework(c, 126, 18, 14, C("#2ce8f5"), 3)
    firework(c, 104, 30, 8, C("#63c74d"), 4)
    firework(c, 52, 32, 7, C("#b55088"), 5)
    c.rect(0, 54, W, 8, C("#22383a"))
    street(c, C("#6a6488"), C("#211f36"), C("#8a80a0"))
    big_store(c, 26, 108, night=True)
    # Гирлянда по карнизу.
    for i, gx in enumerate(range(26, 134, 3)):
        col = (C("#e43b44"), C("#fee761"), C("#63c74d"), C("#2ce8f5"))[i % 4]
        c.px(gx, 13 + (1 if i % 2 else 0), col)
    # Гости праздника.
    grandma(c, 62, 46)
    hero(c, 74, 46)
    c.vline(82, 48, 4, SKIN)
    sonya(c, 84, 50)
    valya(c, 96, 46)
    marat(c, 112, 46)
    for i, x in enumerate((10, 22, 36, 48, 126, 138, 150)):
        shirt = (C("#0099db"), C("#feae34"), C("#f6757a"), C("#63c74d"), C("#b55088"), C("#5fcde4"), C("#e43b44"))[i]
        hair = (C("#4a2c1a"), INK, C("#733e39"), C("#c0cbdc"), C("#8f563b"), INK, C("#4a2c1a"))[i]
        who(c, x, 50 + i % 2 * 3, shirt, hair, back=True, small=i in (2, 5))
    for _ in range(46):
        x, y = rnd.randrange(W), rnd.randrange(34, 62)
        c.px(x, y, rnd.choice([C("#e43b44"), C("#fee761"), C("#63c74d"), C("#2ce8f5"), WHITE]))
    save(c, "finale")


def main():
    ch1()
    ch2()
    ch3()
    ch4()
    ch5()
    finale()


if __name__ == "__main__":
    main()
