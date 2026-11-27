"""Зимние клумбы и вазоны (27.11, слабое место «зимой клумбы - пустые белые прямоугольники»).

Клумба под снегом - не белая плашка, а сад, укрытый на зиму: бортик из камней в снежных шапках,
сугроб буграми (свет сверху слева: левые склоны светлее, правые и передний край в голубой тени),
из снега торчат сухие стебли с семенными головками и метёлки травы, лежит еловый лапник (им укрывают
розы), куст в мешковине, перевязанный бечёвкой, и веточки с красными ягодами.

Здесь - кисти для всего этого (их берут двор yard.py, вазоны hood.py и кадки у входа decor_coins.py),
клумба парка park_bed_snow (рисуется вместо летних цветов на аллее, streets.ts) и подсолнухи Сони
у входа зимой sunflowers_winter.
Двойная детализация, как у всей графики.

    python3 art/winter_beds.py
"""

import math
import random

from sprites import Canvas, shadowed

# Снег: те же тона, что у шапок на деревьях (snowy.py) и снега на газоне (snow_ground).
SNOW_HI = (255, 255, 255, 255)
SNOW = (244, 248, 255, 255)
SNOW_SH = (206, 222, 244, 255)
SNOW_D = "W"


def drift(c, x0, x1, y0, y1, rnd, step=(10, 7), big=1.0):
    """Сугроб на клумбе от x0 до x1 (не включая), поверхность от y0, передний край на y1.

    Бугры вразброс по всей клумбе (сзади наперёд, передние накрывают тени задних); задний ряд
    поднимает силуэт над y0. У каждого бугра голубая тень справа снизу и блик слева сверху.
    Передний край - в тени, по низу - тёмная кромка. big - во сколько раз бугры крупнее обычных.
    """
    w = x1 - x0
    c.rect(x0, y0, w, y1 - y0 + 1, SNOW)
    sx, sy = step
    spots = []
    for x in range(x0 + 2, x1 - 3, sx):
        spots.append((x + rnd.uniform(1, sx - 2), y0 + rnd.uniform(0.2, 1.0), rnd.uniform(3.6, 5.6) * big, rnd.uniform(2.0, 2.7) * big))
    for row, y in enumerate(range(y0 + sy - 2, y1 - 2, sy)):
        for x in range(x0 + 1 - (row % 2) * sx // 2, x1 - 3, sx):
            cx = min(max(x + rnd.uniform(1, sx - 1), x0 + 4), x1 - 5)
            spots.append((cx, y + rnd.uniform(-1.5, 1.5), rnd.uniform(3.2, 5.4) * big, rnd.uniform(1.6, 2.3) * big))
    for cx, cy, rx, ry in sorted(spots, key=lambda s: s[1]):
        cx = min(max(cx, x0 + rx - 0.5), x1 - rx - 1.2)
        cy = min(cy, y1 - ry - 0.6)
        c.ellipse(cx + 1.2 * big, cy + 1.1 * big, rx, ry, SNOW_SH)
        c.ellipse(cx, cy, rx, ry, SNOW)
        c.ellipse(cx - rx * 0.35, cy - ry * 0.45, rx * 0.5, ry * 0.42, SNOW_HI)
    # Передний край сугроба в тени, по низу - кромка.
    for x in range(x0, x1):
        if (x - x0) % 7 not in (0, 1):
            c.px(x, y1 - 1, SNOW_SH)
        c.px(x, y1, SNOW_D)


def stones(c, x0, x1, y, rnd, snow=True):
    """Бортик из камней 4×3 с зазором: сверху - снежная шапка, левый край светлее, низ темнее."""
    x = x0
    while x < x1 - 1:
        w = min(rnd.choice((4, 4, 5)), x1 - x)
        c.rect(x, y + 1, w, 2, "l")
        c.px(x, y + 1, "W")
        c.hline(x, y + 2, w, "G")
        c.px(x, y + 2, "l")
        if snow:
            c.hline(x, y, w, SNOW)
            c.px(x, y, SNOW_HI)
            c.px(x + w - 1, y, SNOW_SH)
            if rnd.random() < 0.5:
                c.px(x + 1, y + 1, SNOW)
        else:
            c.hline(x, y, w, "W")
        x += w + 1


def stem(c, x, base, h, kind, snow_cap=True):
    """Сухой стебель прошлогоднего цветка: головка (эхинацея), зонтик (укроп, тысячелистник) или колос."""
    c.vline(x, base - h, h, "a")
    top = base - h
    if kind == "head":
        c.rect(x - 1, top - 2, 3, 2, "b")
        c.px(x + 1, top - 1, "x")
        c.px(x - 1, top - 2, "a")
        if snow_cap:
            c.hline(x - 1, top - 3, 2, SNOW_HI)
            c.px(x + 1, top - 3, SNOW_SH)
    elif kind == "umbel":
        c.px(x - 1, top - 1, "a")
        c.px(x + 1, top - 1, "a")
        c.hline(x - 2, top - 2, 2, "t")
        c.hline(x + 1, top - 2, 2, "t")
        if snow_cap:
            c.hline(x - 2, top - 3, 2, SNOW_HI)
            c.px(x + 2, top - 3, SNOW_SH)
    else:  # колос: светлые зёрнышки ёлочкой
        for k in range(3):
            c.px(x - 1, top + k * 2, "t")
            c.px(x + 1, top + k * 2 + 1, "n")
        c.px(x, top - 1, "N")
        if snow_cap:
            c.px(x - 1, top - 1, SNOW_HI)


def grass(c, x, base, h):
    """Метёлка сухой травы: соломенные стебли веером, у основания темнее."""
    for dx, lean, tall in ((-2, -1, h - 2), (0, 0, h), (2, 1, h - 1), (-1, -1, h - 3), (1, 1, h - 3)):
        tip = (x + dx + lean, base - tall)
        c.line(x + dx // 2, base, tip[0], tip[1], "N" if dx <= 0 else "t")
        c.px(x + dx // 2, base - 1, "a")
    c.px(x, base - h - 1, SNOW_HI)


def fir(c, x, y, length, direction=1, snow=True):
    """Еловый лапник на снегу: веточка вбок и чуть вверх, хвоя ёлочкой назад к основанию (сверху
    светлее, снизу темнее), кончик - молодая хвоя, на хвое - снег."""
    tip = (x, y)
    for k in range(length):
        px, py = x + k * direction, y - k // 4
        c.px(px, py, "d")
        tip = (px, py)
        if k % 2 == 0 and k < length - 1:
            c.px(px - direction, py - 1, "e")
            c.px(px - direction, py + 1, "d")
            if k > 1:
                c.px(px - 2 * direction, py - 2, "e")
                c.px(px - 2 * direction, py + 2, "d")
    c.px(tip[0] + direction, tip[1], "E")
    c.px(tip[0], tip[1] - 1, "E")
    if snow:
        for k in range(3, length - 2, 4):
            px, py = x + k * direction, y - k // 4
            c.px(px - 2 * direction, py - 2, SNOW_HI)
            c.px(px - direction, py - 2, SNOW)
            c.px(px - direction, py - 1, SNOW_HI)


def burlap(c, cx, base, w, h):
    """Куст роз в мешковине: мешок яйцом (свет слева - светлее, справа - в тени), наверху завязан
    хвостиком, две перевязки бечёвкой ёлочкой, на макушке и левом плече - снег."""
    rx, ry = w / 2, h * 0.6
    cy = base - h + ry
    rows = {}
    for y in range(base - h, base):
        d = (y + 0.5 - cy) / ry
        half = rx * math.sqrt(max(0.0, 1 - d * d))
        x0, x1 = round(cx - half), max(round(cx + half), round(cx - half) + 1)
        rows[y] = (x0, x1)
        c.hline(x0, y, x1 - x0, "n")
        c.px(x0, y, "N")
        if x1 - x0 > 3:
            c.px(x0 + 1, y, "N" if y < cy else "n")
            c.px(x1 - 2, y, "t")
        c.px(x1 - 1, y, "t")
    x0, x1 = rows[base - 1]
    c.hline(x0 + 1, base - 1, x1 - x0 - 1, "t")
    # Перевязки бечёвкой: зигзаг через два ряда.
    for yy in (base - h + h // 3, base - h + h * 2 // 3):
        x0, x1 = rows[yy]
        for xx in range(x0, x1):
            c.px(xx, yy + ((xx - x0) % 2), "a")
    # Хвостик, где мешок завязан, и шапка снега.
    top = base - h
    c.px(cx - 1, top - 1, "t")
    c.px(cx, top - 2, "a")
    c.px(cx + 1, top - 1, "a")
    c.hline(cx - 2, top, 3, SNOW_HI)
    c.px(cx - 1, top - 1, SNOW_HI)
    c.px(cx + 1, top, SNOW_SH)
    x0, x1 = rows[top + h // 2]
    c.px(x0 + 1, top + h // 2 - 1, SNOW_HI)
    c.px(x0, top + h // 2 - 1, SNOW)
    # Тень от мешка на снегу - вправо.
    x0, x1 = rows[base - 1]
    c.hline(x1, base - 1, 3, SNOW_SH)
    c.hline(x1 - 1, base, 3, SNOW_SH)


def berries(c, x, base, h):
    """Веточка с красными ягодами (калина, шиповник): голая веточка, на концах - гроздья."""
    c.vline(x, base - h, h, "x")
    c.line(x, base - h + 2, x - 2, base - h, "x")
    c.line(x, base - h + 3, x + 3, base - h + 1, "x")
    for gx, gy in ((x - 3, base - h - 1), (x + 2, base - h), (x - 1, base - h - 2)):
        c.px(gx, gy, "R")
        c.px(gx + 1, gy, "R")
        c.px(gx, gy + 1, "R")
        c.px(gx + 1, gy + 1, "r")
        c.px(gx, gy, "s")
    c.px(x - 1, base - h - 3, SNOW_HI)
    c.px(x + 3, base - h - 1, SNOW_HI)


def yard_bed(c, x0, x1, base, rnd):
    """Цветник у переднего забора двора под снегом: каменный бортик в снежных шапках, сугроб, лапник,
    два куста в мешковине, сухие стебли, трава и ягоды. Низ клумбы прячется за передним забором
    (yard_fence ложится на ряды base-8 и ниже), поэтому всё главное - в верхних рядах."""
    y0 = base - 14
    # Бортик сзади и по бокам; спереди - те же камни, что летом (их закрывает перекладина забора).
    for x in range(x0, x1, 4):
        c.rect(x, base - 2, 3, 2, "l")
        c.px(x, base - 2, "W")
    drift(c, x0 + 2, x1 - 2, y0 + 3, base - 3, rnd, step=(10, 5))
    stones(c, x0, x1, y0, rnd)
    for x in (x0, x1 - 3):
        for y in range(y0 + 3, base - 2, 3):
            c.rect(x, y, 3, 2, "l")
            c.px(x, y, "W")
            c.hline(x, y + 2, 3, "G")
        c.vline(x, y0 + 3, 2, SNOW_HI)
    # Что торчит из снега: сзади наперёд.
    fir(c, x0 + 5, y0 + 6, 12, 1)
    fir(c, x1 - 6, y0 + 7, 12, -1)
    fir(c, x0 + 60, y0 + 8, 10, 1)
    burlap(c, x0 + 24, base - 4, 9, 12)
    burlap(c, x0 + 92, base - 4, 9, 11)
    tall = [(x0 + 12, base - 6, 8, "head"), (x0 + 15, base - 5, 6, "head"), (x0 + 37, base - 6, 9, "umbel"), (x0 + 40, base - 5, 6, "umbel"),
            (x0 + 52, base - 5, 7, "ear"), (x0 + 74, base - 6, 9, "head"), (x0 + 77, base - 5, 7, "head"), (x0 + 106, base - 5, 8, "umbel"),
            (x0 + 116, base - 6, 7, "ear")]
    for x, b, h, kind in tall:
        stem(c, x, b, h, kind)
    tufts = [(x0 + 46, base - 5, 8), (x0 + 84, base - 5, 7)]
    for x, b, h in tufts:
        grass(c, x, b, h)
    for x, b, h in ((x0 + 31, base - 5, 7), (x0 + 66, base - 5, 6), (x0 + 101, base - 5, 7)):
        berries(c, x, b, h)
    for x, b, *_ in tall + tufts:
        c.hline(x - 1, b - 1, 3, SNOW)
        c.px(x - 1, b - 1, SNOW_HI)
        c.px(x + 1, b, SNOW_SH)


def park_bed():
    """Клумба парка под снегом 128×44 (в мире 64×22): деревянный бортик, сугроб, по середине - лапник,
    по бокам - два куста в мешковине, у них - сухие стебли, трава и калина."""
    c = Canvas(128, 44)
    rnd = random.Random("park-bed")
    # Бортик из досок 4 точки: свет сверху слева - верхняя и левая доски светлее, правая и передняя темнее.
    c.rect(0, 0, 128, 44, "a")
    c.rect(0, 0, 128, 2, "B")
    c.rect(0, 0, 2, 44, "B")
    c.rect(124, 2, 4, 42, "b")
    c.rect(2, 40, 126, 4, "b")
    c.hline(2, 40, 124, "a")
    for x in (32, 64, 96):
        c.vline(x, 0, 4, "b")
        c.vline(x, 40, 4, "x")
    for y in (15, 29):
        c.hline(0, y, 4, "a")
        c.hline(124, y, 4, "x")
    # Внутренний край бортика - тень: клумба ниже досок.
    c.rect(4, 4, 120, 36, "x")
    # Сугроб внутри.
    drift(c, 5, 123, 5, 38, rnd, step=(15, 9), big=1.5)
    # Снег и на бортике: редкие подушки (дерево видно), на левой доске - полоской.
    for x, y, w in ((6, 0, 9), (27, 1, 6), (46, 0, 12), (71, 0, 7), (88, 1, 10), (108, 0, 8), (12, 40, 8), (52, 40, 10), (98, 40, 7)):
        c.hline(x + 1, y, w - 2, SNOW)
        c.hline(x, y + 1, w, SNOW)
        c.px(x + 1, y, SNOW_HI)
        c.px(x, y + 1, SNOW_HI)
        c.px(x + w - 1, y + 1, SNOW_SH)
        c.hline(x + w // 2, y + 2, w - w // 2 - 1, SNOW_SH)
    c.vline(0, 6, 7, SNOW)
    c.vline(1, 7, 4, SNOW_SH)
    # Середина: лапник внахлёст, за ним - калина.
    berries(c, 63, 18, 8)
    for fx, fy, n, d in ((44, 24, 13, 1), (84, 25, 13, -1), (56, 30, 12, 1), (74, 31, 11, -1)):
        fir(c, fx, fy, n, d)
    # Бока: кусты в мешковине, у каждого - сухие стебли, трава и ягоды.
    burlap(c, 24, 27, 10, 16)
    burlap(c, 104, 27, 10, 15)
    tall = [(12, 18, 9, "head"), (15, 17, 6, "head"), (36, 33, 7, "umbel"), (39, 34, 5, "umbel"), (90, 15, 9, "umbel"),
            (93, 16, 6, "ear"), (115, 34, 8, "head"), (118, 33, 6, "head"), (50, 14, 7, "ear"), (78, 14, 6, "head")]
    for x, base, h, kind in tall:
        stem(c, x, base, h, kind)
    tufts = [(13, 35, 8), (116, 17, 8)]
    for x, base, h in tufts:
        grass(c, x, base, h)
    for x, base, h in ((34, 16, 7), (96, 35, 7)):
        berries(c, x, base, h)
    for x, base, *_ in tall + tufts:
        c.hline(x - 1, base - 1, 3, SNOW)
        c.px(x - 1, base - 1, SNOW_HI)
        c.px(x + 1, base, SNOW_SH)
    c.save("park_bed_snow")


def sunflowers_winter():
    """Подсолнухи Сони у входа зимой 20×30 (как летние sunflowers из family.py): сухие стебли,
    шляпки поникли и в снегу, на ящике с землёй - сугроб."""
    c = Canvas(20, 30)
    for x, top, lean in ((4, 8, -1), (10, 4, 1), (16, 10, 1)):
        c.vline(x, top + 3, 26 - top, "t")
        c.vline(x, top + 14, 12 - top // 2, "a")
        # Сухие листья повисли.
        c.line(x, top + 9, x - 2, top + 11, "a")
        c.line(x, top + 15, x + 2, top + 17, "a")
        # Шляпка склонилась набок: тёмная серединка, по краю - остатки лепестков, сверху снег.
        hx, hy = x + lean * 2, top + 3
        c.line(x, top + 4, hx, hy, "t")
        c.ellipse(hx + 0.5, hy + 0.5, 2.4, 2.0, "x")
        c.ellipse(hx + 0.5 - lean * 0.4, hy, 1.6, 1.3, "b")
        for dx in (-2, 0, 2):
            c.px(hx + dx, hy + 2, "t")
        c.px(hx + 2 * lean, hy + 1, "n")
        c.hline(hx - 1, hy - 2, 3, SNOW_HI)
        c.px(hx + 2, hy - 1, SNOW_SH)
        c.px(hx - 2, hy - 1, SNOW)
    c.rect(1, 27, 18, 3, "a")
    c.hline(1, 29, 18, "b")
    # Сугроб на ящике: свет слева.
    c.hline(1, 26, 18, SNOW)
    c.hline(2, 25, 6, SNOW)
    c.hline(11, 25, 5, SNOW)
    c.hline(2, 25, 2, SNOW_HI)
    c.hline(1, 26, 2, SNOW_HI)
    c.hline(12, 27, 6, SNOW_SH)
    c.px(7, 26, SNOW_SH)
    c.outline("k")
    shadowed(c, 10, 29, 9, 1.5).save("sunflowers_winter")


def main():
    park_bed()
    sunflowers_winter()


if __name__ == "__main__":
    main()
