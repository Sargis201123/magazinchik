"""Праздники по настоящему календарю (src/game/live.ts): Новый год, 23 Февраля и 8 Марта.

Портреты гостей 64×64 (Дед Мороз и Снегурочка — заходят в магазин в декабре), бесплатные
праздничные вещи в зал (ёлка, модель парусника, мимоза), новогодний набор за звёзды (снежная
вывеска и зимние обои), открытки адвент-календаря 96×64 и картинки к напоминаниям бота
512×288 (public/promo/remind_*.png: портрет героя крупно, без размытия). Запуск отдельно:

    python3 art/holidays.py
"""

import math
import random
from pathlib import Path

from PIL import Image

from sprites import OUT, Canvas, portrait, rgb, shade, shadowed

PROMO = OUT.parent / "promo"

# ---------------------------------------------------------------- портреты гостей


def hair_moroz(p, hair):
    """Шапка Деда Мороза: красная, круглая, с широкой белой опушкой; седые пряди у висков."""
    red, fur = rgb("#e43b44"), rgb("#ffffff")
    p.ellipse(16, 6, 10, 5.5, red)
    p.px(12, 3, shade(red, 1.25))
    p.px(13, 2, shade(red, 1.25))
    p.rect(6, 9, 20, 3, fur)
    p.hline(6, 11, 20, rgb("#c0cbdc"))
    p.rect(7, 12, 2, 5, hair)
    p.rect(23, 12, 2, 5, hair)


def moroz_extras(mood):
    def draw(p, skin, hair, shirt):
        white, shadow = rgb("#ffffff"), rgb("#c0cbdc")
        # Борода до груди, усы над ней.
        p.ellipse(16, 24, 8.5, 7.5, white)
        p.ellipse(16, 27, 6, 5, white)
        for x, y in ((11, 24), (14, 27), (18, 26), (20, 23), (16, 29)):
            p.px(x, y, shadow)
        p.hline(11, 19, 4, white)
        p.hline(17, 19, 4, white)
        p.px(10, 20, white)
        p.px(21, 20, white)
        if mood == "happy":
            # Улыбка видна между усами и бородой.
            p.hline(14, 20, 4, rgb("#9e2835"))
        # Румяный нос.
        p.px(16, 17, rgb("#f6757a"))
    return draw


def hair_snegurochka(p, hair):
    """Кокошник: голубой с белой опушкой и серебряной звёздочкой; светлая коса набок."""
    blue, fur = rgb("#9cd8ff"), rgb("#ffffff")
    p.ellipse(16, 8, 8.5, 5, hair)
    p.rect(8, 8, 2, 7, hair)
    p.rect(22, 8, 2, 8, hair)
    # Коса через плечо.
    for i, y in enumerate(range(16, 28, 2)):
        p.ellipse(24 + (i % 2) * 0.5, y, 1.6, 1.3, hair)
        p.px(24, y, shade(hair, 0.85))
    p.px(24, 28, rgb("#5fcde4"))
    p.px(25, 28, rgb("#5fcde4"))
    # Кокошник.
    for x in range(8, 25):
        top = 1 + round(abs(x - 16) * 0.45)
        p.vline(x, top, 7 - top + 1, blue)
    p.hline(8, 8, 17, fur)
    p.hline(9, 9, 15, fur)
    for x in range(10, 23, 3):
        p.px(x, 5 + abs(x - 16) // 3, fur)
    p.px(16, 3, rgb("#ffffff"))
    p.px(15, 4, rgb("#c0cbdc"))
    p.px(17, 4, rgb("#c0cbdc"))


def snegurochka_extras(mood):
    def draw(p, skin, hair, shirt):
        fur = rgb("#ffffff")
        # Белая опушка шубки и снежинка-брошь.
        p.line(11, 25, 15, 31, fur)
        p.line(21, 25, 17, 31, fur)
        p.px(16, 28, rgb("#2ce8f5"))
    return draw


def portraits():
    for mood in (None, "happy"):
        portrait("moroz", "#124e89", "#f2d3ab", "#ffffff", "#e43b44", hair_moroz, moroz_extras(mood), mood)
        portrait("snegurochka", "#68386c", "#f2d3ab", "#ead4aa", "#9cd8ff", hair_snegurochka, snegurochka_extras(mood), mood)


# ---------------------------------------------------------------- вещи в зал (в мире вдвое меньше)


def holiday_tree():
    """Ёлка 28×44: ярусы хвои с тенью, шары, гирлянда-нитка, звезда на макушке и ящик с подарком."""
    c = Canvas(28, 44)
    dark, mid, hi = rgb("#265c42"), rgb("#3e8948"), rgb("#63c74d")
    tiers = ((14, 8, 5, 4), (14, 15, 8, 5), (14, 23, 11, 6), (14, 31, 13, 6))
    for cx, cy, rx, ry in tiers:
        c.ellipse(cx, cy, rx, ry, dark)
        c.ellipse(cx - 1, cy - 1, rx - 1.5, ry - 1.5, mid)
        for i in range(-int(rx) + 2, int(rx) - 1, 3):
            c.px(cx + i, cy + int(ry) - 2, hi)
    # Ствол и кадка.
    c.rect(12, 36, 4, 3, "b")
    c.rect(8, 38, 12, 6, "r")
    c.hline(8, 38, 12, "R")
    c.vline(19, 39, 5, "m")
    c.hline(9, 40, 10, "Y")
    c.outline("k")
    # Шары и огоньки поверх контура хвои.
    rnd = random.Random(12)
    balls = [rgb("#e43b44"), rgb("#fee761"), rgb("#2ce8f5"), rgb("#f6757a"), rgb("#ffffff")]
    for cx, cy in ((10, 15), (17, 17), (8, 24), (14, 22), (20, 26), (11, 31), (18, 33), (6, 32), (23, 32), (13, 10)):
        tone = rnd.choice(balls)
        c.px(cx, cy, tone)
        c.px(cx + 1, cy, shade(tone, 0.7))
        c.px(cx, cy + 1, shade(tone, 0.7))
    # Нитка гирлянды по ярусам.
    for x in range(6, 22):
        y = 19 + round((x - 6) * 0.45)
        if x % 2 == 0:
            c.px(x, y, rgb("#feae34"))
    for x in range(5, 24):
        y = 28 + round((23 - x) * 0.3)
        if x % 2 == 1:
            c.px(x, y, rgb("#feae34"))
    # Звезда.
    c.stamp(["..Y..", ".YYY.", "YYyYY", ".Y.Y."], 12, 0)
    c.px(14, 1, "w")
    shadowed(c, 14, 42, 11, 2).save("holiday_tree")


def holiday_ship():
    """Модель парусника 30×30 на деревянной подставке: корпус, мачта, белые паруса, флажок."""
    c = Canvas(30, 30)
    # Подставка.
    c.rect(5, 25, 20, 4, "a")
    c.hline(5, 25, 20, "B")
    c.vline(9, 22, 4, "x")
    c.vline(20, 22, 4, "x")
    # Корпус.
    for i, y in enumerate(range(17, 23)):
        inset = max(0, i - 2)
        c.hline(3 + inset, y, 24 - 2 * inset, "b" if y > 18 else "B")
    c.hline(3, 17, 24, "N")
    c.hline(5, 20, 20, "Y")
    for x in (8, 12, 16, 20):
        c.px(x, 19, "k")
    # Мачты и паруса.
    c.vline(15, 2, 16, "x")
    c.vline(9, 7, 11, "x")
    for i in range(12):
        c.hline(16, 3 + i, max(1, 8 - abs(i - 6)), "w" if i % 4 else "W")
    for i in range(9):
        c.hline(10, 8 + i, max(1, 5 - abs(i - 4)), "w")
    c.px(16, 1, "R")
    c.px(17, 1, "R")
    c.px(18, 2, "R")
    c.outline("k")
    shadowed(c, 15, 29, 12, 1.5).save("holiday_ship")


def holiday_mimosa():
    """Мимоза в вазе 24×32: пушистые жёлтые шарики, перистые листья, стеклянная ваза с водой."""
    c = Canvas(24, 32)
    leaf, leaf_hi = rgb("#3e8948"), rgb("#63c74d")
    for x0, y0, x1, y1 in ((12, 20, 5, 5), (12, 20, 19, 4), (12, 20, 12, 2), (12, 20, 3, 12), (12, 20, 21, 11)):
        c.line(x0, y0, x1, y1, leaf)
    rnd = random.Random(8)
    for _ in range(26):
        x, y = rnd.randrange(3, 21), rnd.randrange(2, 15)
        c.px(x, y, rnd.choice([leaf, leaf_hi]))
    yellow, yellow_hi, yellow_lo = rgb("#fee761"), rgb("#fff6b0"), rgb("#feae34")
    for _ in range(30):
        x, y = rnd.randrange(2, 22), rnd.randrange(1, 15)
        c.ellipse(x + 0.5, y + 0.5, 1.3, 1.3, yellow)
        c.px(x, y, yellow_hi)
        c.px(x + 1, y + 1, yellow_lo)
    # Ваза.
    glass, water = rgb("#c0cbdc"), rgb("#9cd8ff")
    c.rect(8, 19, 8, 12, glass)
    c.rect(9, 23, 6, 7, water)
    c.hline(7, 19, 10, rgb("#ffffff"))
    c.vline(9, 20, 9, rgb("#ffffff"))
    c.line(11, 19, 11, 28, leaf)
    c.line(13, 19, 13, 27, leaf)
    c.outline("k")
    shadowed(c, 12, 31, 7, 1.2).save("holiday_mimosa")


# ---------------------------------------------------------------- новогодний набор за звёзды


def sign_frost():
    """Снежная вывеска 128×26: ледяная доска, сугроб сверху, сосульки и цветные лампочки."""
    c = Canvas(128, 26)
    ice, ice_hi, ice_lo = rgb("#4a7fb5"), rgb("#7fb2e0"), rgb("#2d5a8a")
    c.rect(6, 4, 116, 17, ice)
    c.hline(6, 4, 116, ice_hi)
    c.hline(6, 20, 116, ice_lo)
    rnd = random.Random(23)
    for _ in range(40):
        c.px(rnd.randrange(8, 120), rnd.randrange(6, 19), ice_hi)
    # Сугроб по верхнему краю.
    snow, snow_lo = rgb("#ffffff"), rgb("#cfe0f4")
    for x in range(4, 124):
        h = 3 + round(1.5 * math.sin(x * 0.35) + math.sin(x * 0.13))
        c.vline(x, 4 - h + 2, h, snow)
        c.px(x, 5, snow_lo)
    c.outline("k")
    # Сосульки снизу — после контура: тонкие, разной длины, светлые на тёмном.
    rnd = random.Random(5)
    for x in range(9, 120, 5 + rnd.randrange(3)):
        length = rnd.choice((1, 2, 2, 3, 4))
        c.vline(x, 22, length, rgb("#e8f4ff"))
        if length > 1:
            c.px(x, 22, rgb("#9cd8ff"))
    colors = [rgb("#e43b44"), rgb("#fee761"), rgb("#63c74d"), rgb("#2ce8f5")]
    for i, x in enumerate(range(10, 120, 9)):
        c.rect(x, 3, 2, 2, colors[i % 4])
    c.save("sign_frost")


def wall_winter():
    """Зимние обои 32×64 (повтор по ширине): голубые, с белыми снежинками, бордюр и деревянная панель."""
    c = Canvas(32, 64)
    base, base_hi = rgb("#d6e8f7"), rgb("#e8f2fb")
    c.rect(0, 0, 32, 64, base)
    c.rect(0, 0, 32, 4, rgb("#5a6988"))
    c.hline(0, 3, 32, rgb("#8b9bb4"))
    c.hline(0, 4, 32, base_hi)
    flake = rgb("#ffffff")
    shade_ = rgb("#b8d0ea")
    for cx, cy in ((8, 12), (24, 24), (8, 32), (24, 8)):
        for dx, dy in ((0, 0), (-2, 0), (2, 0), (0, -2), (0, 2), (-1, -1), (1, 1), (-1, 1), (1, -1)):
            c.px((cx + dx) % 32, cy + dy, flake)
        c.px((cx + 2) % 32, cy + 1, shade_)
    for cx, cy in ((16, 18), (0, 22), (16, 34)):
        c.px(cx % 32, cy, flake)
        c.px((cx + 1) % 32, cy, shade_)
    # Бордюр с ёлочками.
    c.rect(0, 38, 32, 3, rgb("#a22633"))
    for x in range(1, 32, 4):
        c.px(x, 39, rgb("#fee761"))
    # Деревянная панель и плинтус — как у обычной стены.
    c.rect(0, 41, 32, 15, "B")
    c.hline(0, 41, 32, "N")
    c.hline(0, 42, 32, "n")
    for x in range(0, 32, 6):
        c.vline(x, 43, 13, "a")
        c.vline(x + 1, 43, 13, "n")
    c.hline(0, 55, 32, "a")
    c.rect(0, 56, 32, 8, "K")
    c.hline(0, 56, 32, "G")
    c.hline(0, 57, 32, "g")
    c.save("wall_winter")


# ---------------------------------------------------------------- открытки 96×64


def card_base(sky_top, sky_bottom, ground=None):
    """Открытка: рамка с уголками, небо сверху вниз и снег или трава внизу."""
    c = Canvas(96, 64)
    for y in range(64):
        t = y / 63
        tone = tuple(round(sky_top[i] + (sky_bottom[i] - sky_top[i]) * t) for i in range(3)) + (255,)
        c.hline(0, y, 96, tone)
    if ground:
        for x in range(96):
            h = 12 + round(2 * math.sin(x * 0.09) + math.sin(x * 0.23))
            c.vline(x, 64 - h, h, ground)
    return c


def card_frame(c, tone=None):
    tone = tone or rgb("#fff3d6")
    c.frame(0, 0, 96, 64, "k")
    c.frame(1, 1, 94, 62, tone)
    c.frame(2, 2, 92, 60, tone)
    c.frame(3, 3, 90, 58, shade(tone, 0.8))
    for x, y in ((4, 4), (90, 4), (4, 58), (90, 58)):
        c.rect(x, y, 2, 2, rgb("#e43b44"))


def snowfall(c, seed, count=40):
    rnd = random.Random(seed)
    for _ in range(count):
        x, y = rnd.randrange(4, 92), rnd.randrange(4, 50)
        c.px(x, y, rgb("#ffffff"))
        if rnd.random() < 0.3:
            c.px(x + 1, y, rgb("#cfe0f4"))


NIGHT = (rgb("#181c40"), rgb("#3a4a8a"))
SNOW = rgb("#eef4ff")


def fir(c, x, y, size, lights=False, seed=0):
    dark, mid = rgb("#265c42"), rgb("#3e8948")
    for i in range(3):
        w = size - i * size // 3
        top = y - (i + 1) * size // 2
        for j in range(size // 2 + 2):
            half = max(0, round(w * j / (size // 2 + 2)))
            c.hline(x - half, top + j, half * 2 + 1, mid if j % 3 else dark)
    c.rect(x - 1, y, 3, 3, rgb("#733e39"))
    if lights:
        rnd = random.Random(seed)
        for _ in range(size):
            c.px(x + rnd.randrange(-size // 2, size // 2 + 1), y - rnd.randrange(2, size + size // 2), rnd.choice([rgb("#fee761"), rgb("#e43b44"), rgb("#2ce8f5")]))


def card_tree():
    c = card_base(*NIGHT, ground=SNOW)
    snowfall(c, 1)
    fir(c, 48, 50, 22, lights=True, seed=3)
    c.stamp(["..Y..", ".YYY.", "YYYYY", ".Y.Y."], 46, 13)
    for x, tone in ((36, "R"), (56, "U"), (61, "Y")):
        c.rect(x, 48, 5, 4, tone)
        c.vline(x + 2, 48, 4, "w")
    card_frame(c)
    c.save("card_newyear_tree")


def card_snowman():
    c = card_base(rgb("#5a8ad0"), rgb("#bcd8f4"), ground=SNOW)
    snowfall(c, 2, 25)
    for cx, cy, r in ((48, 46, 9), (48, 32, 7), (48, 21, 5)):
        c.ellipse(cx, cy, r, r, rgb("#ffffff"))
        c.ellipse(cx + 2, cy + 2, r - 2, r - 2, rgb("#dde9f8"))
    c.px(46, 20, "k")
    c.px(50, 20, "k")
    c.hline(51, 22, 3, "o")
    c.rect(43, 13, 10, 4, "R")
    c.rect(45, 9, 6, 4, "R")
    c.px(48, 8, "w")
    c.rect(42, 26, 12, 2, "R")
    c.vline(52, 27, 4, "R")
    c.line(40, 31, 33, 26, "a")
    c.line(56, 31, 63, 26, "a")
    for y in (30, 34, 38):
        c.px(48, y, "k")
    card_frame(c)
    c.save("card_newyear_snowman")


def card_gifts():
    c = card_base(rgb("#68386c"), rgb("#b55088"))
    c.rect(4, 48, 88, 12, rgb("#8f563b"))
    c.hline(4, 48, 88, rgb("#b86f50"))
    for x, y, w, h, tone, ribbon in ((18, 30, 20, 18, "R", "Y"), (40, 22, 18, 26, "U", "w"), (60, 34, 18, 14, "E", "R"), (30, 40, 12, 8, "Y", "R")):
        c.rect(x, y, w, h, tone)
        c.hline(x, y, w, shade(rgb({"R": "#e43b44", "U": "#0099db", "E": "#63c74d", "Y": "#fee761"}[tone]), 1.2))
        c.vline(x + w // 2, y, h, ribbon)
        c.hline(x, y + h // 2, w, ribbon)
        c.ellipse(x + w // 2 - 2, y - 1, 2, 1.5, ribbon)
        c.ellipse(x + w // 2 + 2, y - 1, 2, 1.5, ribbon)
        c.frame(x, y, w, h, "k")
    snowfall(c, 4, 18)
    card_frame(c)
    c.save("card_newyear_gifts")


def card_mittens():
    c = card_base(rgb("#c0e0f8"), rgb("#ffffff"))
    snowfall(c, 5, 10)
    for x0, tone, pat in ((26, rgb("#e43b44"), rgb("#ffffff")), (52, rgb("#0099db"), rgb("#fee761"))):
        c.ellipse(x0 + 9, 30, 9, 13, tone)
        c.ellipse(x0 + 1, 28, 3.5, 6, tone)
        c.rect(x0 + 2, 40, 15, 8, rgb("#ffffff"))
        for x in range(x0 + 3, x0 + 17, 3):
            c.px(x, 30, pat)
            c.px(x + 1, 31, pat)
        c.hline(x0 + 2, 47, 15, rgb("#c0cbdc"))
    c.line(36, 18, 48, 10, "a")
    c.line(48, 10, 60, 18, "a")
    card_frame(c)
    c.save("card_newyear_mittens")


def card_house():
    c = card_base(*NIGHT, ground=SNOW)
    snowfall(c, 6, 30)
    c.rect(30, 30, 36, 22, rgb("#8f563b"))
    for y in range(30, 52, 4):
        c.hline(30, y, 36, rgb("#733e39"))
    for i in range(14):
        c.hline(26 + i, 30 - i, 44 - 2 * i, rgb("#ffffff") if i < 3 else rgb("#a22633"))
    c.rect(38, 36, 8, 8, rgb("#fee761"))
    c.rect(52, 36, 8, 8, rgb("#fee761"))
    c.vline(42, 36, 8, "a")
    c.hline(38, 40, 8, "a")
    c.vline(56, 36, 8, "a")
    c.hline(52, 40, 8, "a")
    c.rect(58, 14, 4, 8, rgb("#5a6988"))
    for i, (x, y) in enumerate(((60, 11), (62, 8), (61, 5))):
        c.ellipse(x, y, 2 + i * 0.3, 1.5, rgb("#c0cbdc"))
    fir(c, 16, 52, 12)
    fir(c, 80, 52, 10)
    card_frame(c)
    c.save("card_newyear_house")


def card_tangerines():
    c = card_base(rgb("#fff3d6"), rgb("#f4dcb0"))
    c.ellipse(48, 46, 30, 8, rgb("#ffffff"))
    c.ellipse(48, 46, 26, 6, rgb("#dde9f8"))
    for cx, cy in ((36, 38), (48, 36), (60, 38), (42, 30), (54, 30), (48, 24)):
        c.ellipse(cx, cy, 6, 5.5, rgb("#f77622"))
        c.px(cx - 2, cy - 2, rgb("#feae34"))
        c.px(cx - 1, cy - 2, rgb("#feae34"))
        c.px(cx, cy - 5, rgb("#3e8948"))
    c.line(48, 19, 52, 15, rgb("#3e8948"))
    c.ellipse(54, 15, 3, 1.5, rgb("#63c74d"))
    # Веточка ели сбоку.
    for i in range(14):
        c.px(10 + i, 14 + i // 2, rgb("#265c42"))
        c.px(11 + i, 12 + i // 2, rgb("#3e8948"))
        c.px(9 + i, 16 + i // 2, rgb("#3e8948"))
    c.ellipse(20, 22, 2.5, 2.5, rgb("#e43b44"))
    card_frame(c)
    c.save("card_newyear_tangerines")


def card_star():
    c = card_base(*NIGHT)
    rnd = random.Random(9)
    for _ in range(50):
        c.px(rnd.randrange(4, 92), rnd.randrange(4, 60), rnd.choice([rgb("#ffffff"), rgb("#9cd8ff"), rgb("#fee761")]))
    cx, cy = 48, 30
    for a in range(10):
        r = 16 if a % 2 == 0 else 7
        ang = -math.pi / 2 + a * math.pi / 5
        nxt = -math.pi / 2 + (a + 1) * math.pi / 5
        r2 = 7 if a % 2 == 0 else 16
        for t in range(12):
            k = t / 11
            x = cx + (r * math.cos(ang)) * (1 - k) + (r2 * math.cos(nxt)) * k
            y = cy + (r * math.sin(ang)) * (1 - k) + (r2 * math.sin(nxt)) * k
            c.line(cx, cy, round(x), round(y), rgb("#fee761"))
    c.ellipse(cx - 2, cy - 2, 3, 3, rgb("#fff6b0"))
    for i in range(1, 24, 3):
        c.px(cx + i + 14, cy + i // 2 + 10, rgb("#fff6b0"))
    card_frame(c, rgb("#fee761"))
    c.save("card_newyear_star")


def card_clock():
    c = card_base(rgb("#262b44"), rgb("#3a4466"))
    snowfall(c, 11, 20)
    c.ellipse(48, 30, 20, 20, rgb("#feae34"))
    c.ellipse(48, 30, 17, 17, rgb("#fff3d6"))
    for i in range(12):
        ang = i * math.pi / 6
        c.px(round(48 + 14 * math.cos(ang)), round(30 + 14 * math.sin(ang)), "k")
    c.line(48, 30, 48, 17, "k")
    c.line(48, 30, 47, 19, "k")
    c.px(48, 30, "R")
    for x in (24, 72):
        c.line(x, 56, x + (6 if x < 48 else -6), 44, rgb("#c0cbdc"))
        c.ellipse(x + (7 if x < 48 else -7), 42, 3, 2, rgb("#fee761"))
    card_frame(c)
    c.save("card_newyear_clock")


def card_fireworks():
    c = card_base(rgb("#0d1030"), rgb("#262b44"))
    rnd = random.Random(31)
    for cx, cy, tone in ((28, 22, rgb("#e43b44")), (64, 18, rgb("#fee761")), (48, 34, rgb("#2ce8f5")), (76, 36, rgb("#f6757a"))):
        for k in range(14):
            ang = k * math.pi / 7
            for r in range(3, 11, 2):
                c.px(round(cx + r * math.cos(ang)), round(cy + r * math.sin(ang)), tone if r < 9 else shade(tone, 0.7))
        c.px(cx, cy, rgb("#ffffff"))
    for x in range(4, 92):
        h = 8 + (x * 13) % 5
        c.vline(x, 64 - h, h, rgb("#181425"))
    for x in range(10, 90, 7):
        c.px(x, 58 - (x * 3) % 4, rgb("#fee761"))
    card_frame(c, rgb("#fee761"))
    c.save("card_newyear_fireworks")


def card_feb23():
    c = card_base(rgb("#5a8ad0"), rgb("#c0e0f8"))
    for x in range(96):
        h = 14 + round(1.5 * math.sin(x * 0.3))
        c.vline(x, 64 - h, h, rgb("#124e89"))
        if x % 5 == 0:
            c.px(x, 64 - h, rgb("#ffffff"))
    # Парусник.
    for i, y in enumerate(range(42, 48)):
        c.hline(30 + i, y, 36 - 2 * i, rgb("#733e39"))
    c.hline(30, 42, 36, rgb("#b86f50"))
    c.vline(48, 14, 28, rgb("#3b2a35"))
    for i in range(22):
        c.hline(49, 16 + i, max(1, 14 - abs(i - 11)), rgb("#ffffff"))
    for i in range(16):
        c.hline(47 - max(1, 9 - abs(i - 8)), 22 + i, max(1, 9 - abs(i - 8)), rgb("#f0f0f8"))
    c.hline(49, 13, 5, rgb("#e43b44"))
    c.hline(49, 14, 4, rgb("#e43b44"))
    for x, y in ((14, 12), (80, 18), (22, 24)):
        c.hline(x, y, 4, rgb("#ffffff"))
        c.hline(x + 1, y - 1, 2, rgb("#ffffff"))
    card_frame(c)
    c.save("card_feb23")


def card_march8():
    c = card_base(rgb("#ffd2e2"), rgb("#fff3d6"))
    rnd = random.Random(38)
    leaf = rgb("#63c74d")
    for x0, y0, x1, y1 in ((48, 52, 30, 18), (48, 52, 48, 12), (48, 52, 66, 18), (48, 52, 22, 32), (48, 52, 74, 32)):
        c.line(x0, y0, x1, y1, rgb("#3e8948"))
    for _ in range(40):
        x, y = rnd.randrange(18, 78), rnd.randrange(10, 40)
        c.px(x, y, leaf)
    for _ in range(46):
        x, y = rnd.randrange(16, 80), rnd.randrange(8, 38)
        c.ellipse(x + 0.5, y + 0.5, 2, 2, rgb("#fee761"))
        c.px(x, y, rgb("#fff6b0"))
        c.px(x + 1, y + 1, rgb("#feae34"))
    # Лента бантом.
    c.rect(40, 46, 16, 5, rgb("#e43b44"))
    c.ellipse(42, 48, 4, 3, rgb("#f6757a"))
    c.ellipse(54, 48, 4, 3, rgb("#f6757a"))
    c.line(46, 51, 42, 58, rgb("#e43b44"))
    c.line(50, 51, 54, 58, rgb("#e43b44"))
    card_frame(c, rgb("#f6757a"))
    c.save("card_march8")


# ---------------------------------------------------------------- напоминания бота 512×288


def reminder(name, portrait_file, bg, sparkle):
    """Картинка к напоминанию: портрет героя ×4 по центру, фон его цвета с мерцающими точками."""
    face = Image.open(OUT / f"{portrait_file}.png").convert("RGBA")
    W_, H_ = 512, 288
    img = Image.new("RGBA", (W_, H_), bg)
    rnd = random.Random(name)
    px = img.load()
    # Мягкие полосы фона — как у портретов: светлее к центру.
    for y in range(H_):
        for x in range(W_):
            d = ((x - W_ / 2) / (W_ / 2)) ** 2 + ((y - H_ / 2) / (H_ / 1.2)) ** 2
            k = 1.18 if d < 0.25 else 1.09 if d < 0.6 else 1.0
            px[x, y] = shade(bg, k)
    for _ in range(70):
        x, y = rnd.randrange(0, W_ // 4) * 4, rnd.randrange(0, H_ // 4) * 4
        for dx in range(4):
            for dy in range(4):
                px[min(W_ - 1, x + dx), min(H_ - 1, y + dy)] = sparkle
    big = face.resize((256, 256), Image.NEAREST)
    img.alpha_composite(big, ((W_ - 256) // 2, (H_ - 256) // 2))
    PROMO.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(PROMO / f"remind_{name}.png")


def reminders():
    reminder("sonya", "portrait_sonya", rgb("#2f7f9a"), rgb("#fee761"))
    reminder("grandma", "portrait_grandma_happy", rgb("#6e2f58"), rgb("#ffd2e2"))
    reminder("valya", "portrait_valya_happy", rgb("#8a2030"), rgb("#feae34"))
    reminder("anchor", "portrait_anchor_happy", rgb("#262b44"), rgb("#2ce8f5"))
    reminder("moroz", "portrait_moroz_happy", rgb("#0d2f5e"), rgb("#ffffff"))
    reminder("snegurochka", "portrait_snegurochka_happy", rgb("#3e2048"), rgb("#9cd8ff"))


def main():
    portraits()
    holiday_tree()
    holiday_ship()
    holiday_mimosa()
    sign_frost()
    wall_winter()
    card_tree()
    card_snowman()
    card_gifts()
    card_mittens()
    card_house()
    card_tangerines()
    card_star()
    card_clock()
    card_fireworks()
    card_feb23()
    card_march8()
    reminders()


if __name__ == "__main__":
    main()
