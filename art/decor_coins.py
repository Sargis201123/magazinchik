"""Оформление за монеты, второй набор: полы, картины, ковры, растения, свет, украшения зала,
вещицы на прилавок и у входа — и большая реклама на улице (билборд, флажки кампании).

Рисуется тем же холстом и палитрой, что и первые вещи за монеты (sprites.decor_items):
двойная детализация, общий контур. Запуск отдельно или вместе со всеми спрайтами:

    python3 art/decor_coins.py
"""

import math
import random

from sprites import Canvas, shadowed


def H(s, a=255):
    """'#rrggbb' → RGBA."""
    return (int(s[1:3], 16), int(s[3:5], 16), int(s[5:7], 16), a)


# ---------------------------------------------------------------- полы 32×32


def floor_oak():
    """Тёмный дуб: длинные доски вразбежку, прожилки и тёмные стыки."""
    c = Canvas(32, 32)
    tones = [H("#7a4a2e"), H("#8a5634"), H("#6e4229"), H("#82502f")]
    rnd = random.Random(5)
    for row in range(4):
        y = row * 8
        off = (row * 11) % 32
        for k in range(2):
            x0 = (off + k * 16) % 32
            tone = tones[(row + k) % 4]
            for dx in range(16):
                x = (x0 + dx) % 32
                c.vline(x, y, 8, tone)
            # Прожилки вдоль доски.
            for _ in range(3):
                gy = y + 1 + rnd.randrange(6)
                gx = x0 + rnd.randrange(10)
                for dx in range(rnd.randrange(3, 7)):
                    c.px((gx + dx) % 32, gy, H("#5c3720"))
            c.vline((x0 + 15) % 32, y, 8, H("#3f2616"))
        c.hline(0, y, 32, H("#a06a42"))
        c.hline(0, y + 7, 32, H("#4a2c1a"))
    c.save("floor_oak")


def floor_mosaic():
    """Мелкая мозаика: бело-голубые квадратики и синий узор-ромб по центру плитки."""
    c = Canvas(32, 32)
    rnd = random.Random(9)
    light = [H("#eef6fb"), H("#e2eef7"), H("#f6fbff")]
    for ty in range(8):
        for tx in range(8):
            x, y = tx * 4, ty * 4
            d = abs(tx - 3.5) + abs(ty - 3.5)
            tone = H("#a9cbe8") if 2.5 < d < 3.6 else H("#cfe3f3") if d < 1.6 else rnd.choice(light)
            c.rect(x, y, 4, 4, H("#b9cbd8"))
            c.rect(x, y, 3, 3, tone)
            c.px(x, y, tuple(min(255, v + 18) for v in tone[:3]) + (255,))
    c.save("floor_mosaic")


# ---------------------------------------------------------------- картины 24×18


def picture_frame(c, outer="x", inner="y"):
    c.frame(0, 0, 24, 18, outer)
    c.frame(1, 1, 22, 16, inner)
    c.outline("k")


def art_mountains():
    """Горы: снежные вершины, ель у озера, розовое утреннее небо."""
    c = Canvas(24, 18)
    for y in range(2, 16):
        c.hline(2, y, 20, H("#ffd9c2") if y < 6 else H("#bfe3f5"))
    c.ellipse(17, 5, 1.6, 1.6, H("#fff2a8"))
    for x in range(2, 22):
        peak = 7 + abs(x - 9) * 0.9 if x < 15 else 9 + abs(x - 17) * 0.8
        for y in range(round(peak), 13):
            snow = y < round(peak) + 2
            c.px(x, y, "w" if snow else ("G" if x % 3 else "g"))
    c.rect(2, 13, 20, 3, H("#4a8fc4"))
    c.hline(4, 14, 5, H("#9fd2f0"))
    for i in range(4):
        c.hline(18 - i, 9 + i * 1, 1 + i * 2, "d")
    c.vline(18, 13, 1, "a")
    picture_frame(c)
    c.save("art_mountains")


def art_stilllife():
    """Натюрморт: кувшин, яблоки и груша на скатерти, тёплый фон."""
    c = Canvas(24, 18)
    c.rect(2, 2, 20, 14, H("#6b4a3a"))
    c.rect(2, 11, 20, 5, H("#e8d8b8"))
    c.hline(2, 11, 20, H("#f6ead0"))
    # Кувшин.
    c.ellipse(8, 9, 3.4, 3.6, H("#5a8fc4"))
    c.rect(7, 3, 3, 4, H("#5a8fc4"))
    c.px(6, 8, H("#9fd2f0"))
    c.vline(11, 6, 3, H("#3a6a9a"))
    # Фрукты.
    c.ellipse(14, 12, 1.9, 1.7, "R")
    c.px(13, 11, "s")
    c.ellipse(17.5, 12.3, 1.8, 1.6, "E")
    c.px(17, 11, H("#a8e07a"))
    c.ellipse(15.5, 9.5, 1.5, 2, "Y")
    c.px(15, 7, "a")
    picture_frame(c, "b", "y")
    c.save("art_stilllife")


def art_city():
    """Ночной город: дома с огнями окон, луна, отражения в реке."""
    c = Canvas(24, 18)
    c.rect(2, 2, 20, 14, H("#1e2348"))
    c.ellipse(18, 5, 1.8, 1.8, H("#fff6dc"))
    c.px(5, 4, "w")
    c.px(11, 3, "w")
    rnd = random.Random(4)
    x = 2
    while x < 22:
        w = rnd.choice([3, 4, 5])
        top = rnd.randrange(6, 10)
        c.rect(x, top, min(w, 22 - x), 13 - top, H("#2f3566") if x % 2 else H("#3a4070"))
        for wy in range(top + 1, 12, 2):
            for wx in range(x + 1, min(x + w, 22) - 1, 2):
                if rnd.random() < 0.55:
                    c.px(wx, wy, H("#ffd27a"))
        x += w
    c.rect(2, 13, 20, 3, H("#14183a"))
    for i in range(4):
        c.hline(4 + i * 5, 14 + i % 2, 2, H("#c79a3a"))
    picture_frame(c, "K", "W")
    c.save("art_city")


# ---------------------------------------------------------------- ковры 80×44


def rug_blue():
    """Синий ковёр: светлая кайма с бахромой, ромбы и медальон в центре."""
    c = Canvas(80, 44)
    c.round_rect(0, 0, 80, 44, "u", r=3)
    c.round_rect(3, 3, 74, 38, H("#2a6fb0"), r=2)
    c.frame(6, 6, 68, 32, "N")
    c.frame(8, 8, 64, 28, H("#5aa0d8"))
    for x in range(14, 70, 10):
        for i in range(3):
            c.hline(x - i, 12 + i, 1 + 2 * i, "N" if x % 20 else "y")
            c.hline(x - i, 32 - i, 1 + 2 * i, "N" if x % 20 else "y")
    for i in range(7):
        c.hline(40 - (7 - i) * 2, 15 + i, (7 - i) * 4 + 1, "y" if i % 2 else "N")
        c.hline(40 - (7 - i) * 2, 29 - i, (7 - i) * 4 + 1, "y" if i % 2 else "N")
    c.ellipse(40, 22, 3, 2.4, "R")
    for y in range(2, 43, 3):
        c.px(0, y, "N")
        c.px(79, y, "N")
    c.save("rug_blue")


def rug_patch():
    """Лоскутный половик: полосы разных цветов, как бабушкин."""
    c = Canvas(80, 44)
    stripes = [H("#e8907e"), H("#f2cf7a"), H("#93c47d"), H("#7ab8d8"), H("#c48ab0"), H("#f0a860")]
    c.round_rect(0, 0, 80, 44, "N", r=4)
    for i, x in enumerate(range(4, 76, 6)):
        tone = stripes[i % len(stripes)]
        c.rect(x, 3, 6, 38, tone)
        for y in range(4, 41, 3):
            c.px(x + 1 + (y // 3) % 4, y, H("#fff6e0"))
        c.vline(x, 3, 38, "N")
    c.frame(2, 2, 76, 40, "B")
    for x in range(1, 80, 3):
        c.px(x, 0, "B")
        c.px(x, 43, "B")
    c.save("rug_patch")


# ---------------------------------------------------------------- растения 26×42


def pot(c, tone, hi, lo, x=6, y=30, w=14):
    c.rect(x, y + 1, w, 10, tone)
    c.rect(x - 1, y, w + 2, 3, hi)
    c.vline(x + w - 2, y + 3, 8, lo)
    c.frame(x - 1, y, w + 2, 3, "k")
    c.frame(x, y + 2, w, 9, "k")


def plants_cactus():
    """Кактус в терракотовом горшке: ствол с отростками, колючки и розовый цветок."""
    c = Canvas(26, 42)
    body = Canvas(26, 42)
    body.rect(10, 6, 6, 25, "e")
    body.ellipse(13, 6, 3, 3, "e")
    body.rect(4, 14, 4, 9, "e")
    body.ellipse(6, 14, 2, 2, "e")
    body.rect(7, 20, 4, 3, "e")
    body.rect(18, 10, 4, 8, "e")
    body.ellipse(20, 10, 2, 2, "e")
    body.rect(15, 15, 4, 3, "e")
    for x, y0, n in ((11, 6, 24), (5, 14, 8), (19, 10, 7)):
        body.vline(x, y0, n, "E")
    for x, y in ((14, 9), (12, 14), (14, 19), (12, 24), (6, 17), (20, 13), (15, 27)):
        body.px(x, y, "N")
    body.ellipse(13, 3, 2.2, 1.8, "s")
    body.px(13, 3, "Y")
    body.outline("k")
    c.img.alpha_composite(body.img)
    pot(c, "t", "n", "a")
    shadowed(c, 13, 41, 9, 2).save("plants_cactus")


def plants_palm():
    """Пальма в плетёной корзине: веер листьев и полосатый ствол."""
    c = Canvas(26, 42)
    leaves = Canvas(26, 42)
    # Вайи расходятся из макушки и свисают к концам; у каждой — светлая середина и тёмный край.
    for side in (-1, 1):
        for rise, length in ((1.1, 9), (0.45, 12), (-0.1, 11)):
            for i in range(length):
                x = 13 + side * i
                y = 10 - rise * i + 0.09 * i * i
                leaves.px(round(x), round(y), "E" if i < length - 3 else "e")
                leaves.px(round(x), round(y) + 1, "e")
                if i % 2 and i > 1:
                    leaves.px(round(x), round(y) + 2, "d")
    for i in range(6):
        leaves.px(13, 9 - i, "E")
        leaves.px(14, 9 - i, "e")
    leaves.ellipse(13, 9, 2.4, 2, "E")
    leaves.outline("k")
    for y in range(11, 31):
        c.rect(12, y, 3, 1, "a" if y % 3 else "B")
    c.img.alpha_composite(leaves.img)
    pot(c, "n", "N", "B")
    for x in range(6, 20, 2):
        c.vline(x, 33, 8, "B")
    shadowed(c, 13, 41, 9, 2).save("plants_palm")


# ---------------------------------------------------------------- свет 16×26 (висит на шнуре)


def light_bulbs():
    """Голая лампа Эдисона на шнуре: латунный патрон, спираль накала."""
    c = Canvas(16, 26)
    c.vline(8, 0, 12, "K")
    c.rect(6, 11, 5, 4, H("#d9a441"))
    c.hline(6, 12, 5, H("#8c6421"))
    c.px(7, 11, H("#f5d27a"))
    c.ellipse(8.5, 19, 3.6, 4.6, H("#ffe7a8"))
    c.ellipse(8.5, 19, 2.4, 3.4, H("#ffd27a"))
    c.line(7, 17, 10, 21, H("#ff9a3c"))
    c.line(10, 17, 7, 21, H("#ff9a3c"))
    c.px(6, 17, "w")
    c.outline("k")
    c.save("light_bulbs")


def light_shade():
    """Тканевый абажур с бахромой: мягкий тёплый свет снизу."""
    c = Canvas(16, 26)
    c.vline(8, 0, 9, "K")
    for dy in range(8):
        half = 3 + dy * 0.6
        c.hline(round(8.5 - half), 9 + dy, round(half * 2), H("#e8836a") if dy % 3 else H("#f2a088"))
    c.hline(3, 17, 11, H("#c45a48"))
    for x in range(3, 14, 2):
        c.px(x, 18, H("#feae34"))
    c.ellipse(8.5, 19.5, 2, 1.4, H("#fff2c8"))
    c.outline("k")
    c.save("light_shade")


# ---------------------------------------------------------------- украшения зала


def grand_clock():
    """Напольные часы: деревянный корпус, циферблат и маятник за стеклом."""
    c = Canvas(20, 46)
    c.rect(3, 6, 14, 38, "x")
    c.ellipse(10, 6, 7, 4, "x")
    c.vline(4, 6, 38, H("#5a3a40"))
    c.ellipse(10, 9, 5, 5, "N")
    c.ellipse(10, 9, 4, 4, "w")
    c.line(10, 9, 10, 6, "k")
    c.line(10, 9, 12, 10, "k")
    for a in range(0, 360, 90):
        c.px(round(10 + 3.3 * math.cos(math.radians(a))), round(9 + 3.3 * math.sin(math.radians(a))), "G")
    c.rect(6, 16, 8, 20, H("#2a1c24"))
    c.vline(10, 16, 13, H("#d9a441"))
    c.ellipse(10, 30, 2.2, 2.2, H("#f5d27a"))
    c.px(9, 29, "w")
    c.frame(6, 16, 8, 20, H("#d9a441"))
    c.rect(2, 41, 16, 4, "x")
    c.hline(2, 41, 16, H("#6b4a52"))
    c.outline("k")
    shadowed(c, 10, 45, 8, 1.6).save("grand_clock")


def globe():
    """Глобус на деревянной подставке: океан, материки и латунный меридиан."""
    c = Canvas(22, 34)
    c.ellipse(11, 12, 8, 8, "U")
    rnd = random.Random(12)
    for cx, cy, r in ((8, 9, 3), (14, 14, 2.6), (9, 16, 2), (15, 8, 1.6)):
        c.ellipse(cx, cy, r, r * 0.8, "E")
        c.px(round(cx), round(cy), "e")
    for _ in range(3):
        c.px(4 + rnd.randrange(14), 5 + rnd.randrange(14), "c")
    c.px(7, 7, "w")
    c.px(8, 6, "w")
    for a in range(-60, 241, 6):
        c.px(round(11 + 9.4 * math.cos(math.radians(a))), round(12 + 9.4 * math.sin(math.radians(a))), H("#d9a441"))
    c.rect(10, 21, 2, 6, "a")
    c.rect(5, 27, 12, 2, "B")
    c.rect(4, 29, 14, 3, "a")
    c.hline(4, 29, 14, "n")
    c.outline("k")
    shadowed(c, 11, 33, 8, 1.5).save("globe")


# ---------------------------------------------------------------- на прилавок


def counter_vase():
    """Ваза с ромашками и тюльпаном — на край прилавка."""
    c = Canvas(14, 20)
    for x, y, tone in ((4, 4, "w"), (9, 3, "w"), (7, 2, "s"), (11, 6, "Y"), (3, 8, "w")):
        c.line(7, 12, x, y + 1, "e")
        c.ellipse(x, y, 1.6, 1.4, tone)
        c.px(x, y, "y" if tone == "w" else "R")
    c.ellipse(7, 15, 3.4, 3.6, H("#5aa0d8"))
    c.rect(5, 11, 5, 2, H("#5aa0d8"))
    c.px(5, 14, "w")
    c.hline(4, 18, 7, H("#3a6a9a"))
    c.outline("k")
    c.save("counter_vase")


def counter_piggy():
    """Копилка-свинка: розовая, с монеткой в щёлке."""
    c = Canvas(18, 14)
    c.ellipse(9, 7.5, 6.5, 4.5, "s")
    c.ellipse(9, 6.5, 5, 3, H("#ffa0a8"))
    c.ellipse(14.5, 7.5, 2, 1.8, H("#ff8a94"))
    c.px(14, 7, "m")
    c.px(15, 7, "m")
    c.px(12, 6, "k")
    c.stamp(["ss", "s."], 10, 2)
    c.rect(5, 11, 2, 2, "s")
    c.rect(11, 11, 2, 2, "s")
    c.rect(7, 2, 4, 1, "k")
    c.ellipse(9, 1.5, 1.8, 1.2, "Y")
    c.px(2, 6, "s")
    c.outline("k")
    c.save("counter_piggy")


# ---------------------------------------------------------------- у входа


def out_planters():
    """Деревянная кадка с цветами — по одной с каждой стороны двери."""
    c = Canvas(18, 20)
    flowers = Canvas(18, 20)
    flowers.ellipse(9, 7, 7, 5, "e")
    flowers.ellipse(6, 6, 3, 2.4, "E")
    for x, y, tone in ((4, 5, "R"), (9, 3, "Y"), (13, 5, "P"), (7, 8, "w"), (12, 8, "R"), (10, 6, "s")):
        flowers.rect(x, y, 2, 2, tone)
        flowers.px(x, y, "w" if tone != "w" else "Y")
    flowers.outline("k")
    c.img.alpha_composite(flowers.img)
    c.rect(2, 11, 14, 8, "B")
    for x in (2, 6, 10, 14):
        c.vline(x, 11, 8, "a")
    c.hline(1, 11, 16, "n")
    c.hline(2, 14, 14, "x")
    c.frame(1, 10, 16, 10, "k")
    shadowed(c, 9, 19, 8, 1.4).save("out_planters")


def out_chalkboard():
    """Меловая доска-штендер у входа: «сегодня свежее» — рисунки мелом, без слов."""
    c = Canvas(20, 26)
    c.line(3, 25, 5, 4, "a")
    c.line(16, 25, 14, 4, "a")
    c.rect(4, 3, 12, 16, "K")
    c.frame(3, 2, 14, 18, "B")
    c.hline(3, 2, 14, "n")
    # Мелом: батон, яблоко, волна и звёздочка.
    c.hline(6, 6, 6, "W")
    c.hline(5, 7, 8, "W")
    c.px(7, 6, "K")
    c.px(10, 6, "K")
    c.ellipse(7, 12, 1.6, 1.6, "s")
    c.px(7, 10, "E")
    c.hline(10, 11, 4, "W")
    c.hline(10, 13, 3, "W")
    c.stamp([".Y.", "YYY", ".Y."], 11, 15)
    c.hline(5, 16, 4, "w")
    c.outline("k")
    shadowed(c, 10, 25, 8, 1.4).save("out_chalkboard")


# ---------------------------------------------------------------- большая реклама на улице


def ad_billboard():
    """Билборд на двух опорах: подсветка сверху, плакат с корзиной продуктов и звёздами."""
    c = Canvas(84, 60)
    # Опоры и мостик.
    for x in (20, 62):
        c.rect(x, 38, 3, 21, "G")
        c.vline(x, 38, 21, "l")
    c.hline(14, 57, 56, "g")
    # Щит.
    c.rect(2, 4, 80, 36, "K")
    c.rect(4, 6, 76, 32, H("#fff3d6"))
    # Плакат: солнечный фон и полосы.
    for y in range(6, 38):
        c.hline(4, y, 76, H("#ffe39a") if y < 22 else H("#ffd27a"))
    for x in range(4, 74, 8):
        c.line(x, 37, x + 6, 6, H("#ffeab0"))
    # Корзина с продуктами.
    c.ellipse(30, 25, 9, 3, "a")
    c.rect(21, 25, 18, 9, "B")
    for x in range(22, 39, 3):
        c.vline(x, 26, 8, "a")
    c.ellipse(25, 22, 3, 3, "R")
    c.ellipse(31, 21, 3.4, 3, "E")
    c.rect(34, 15, 3, 9, "w")
    c.rect(34, 14, 3, 2, "U")
    c.ellipse(27, 18, 5, 2, "n")
    c.hline(24, 17, 6, "N")
    # Большая звезда-ценник и полоски «текста».
    for i in range(9):
        c.hline(60 - i, 10 + i, 1 + 2 * i, "R")
    for i in range(6):
        c.hline(60 - (5 - i) * 2, 19 + i, (5 - i) * 4 + 1, "R")
    c.ellipse(60, 17, 3.2, 3.2, "Y")
    c.px(60, 17, "R")
    c.hline(48, 29, 24, "r")
    c.hline(50, 32, 20, "a")
    c.stamp([".Y.", "YYY", ".Y."], 8, 9)
    c.stamp([".w.", "www", ".w."], 12, 30)
    # Рама и лампы подсветки сверху.
    c.frame(2, 4, 80, 36, "x")
    c.hline(2, 39, 80, "g")
    for x in (14, 42, 70):
        c.line(x, 4, x, 1, "K")
        c.rect(x - 3, 0, 7, 2, "K")
    c.outline("k")
    c.save("ad_billboard")


def ad_flags():
    """Флажки кампании 32×10 для повтора вдоль фасада: провисший шнур и цветные треугольники."""
    c = Canvas(32, 10)
    colors = ["R", "Y", "U", "E"]
    for x in range(32):
        c.px(x, 1 + round(1.5 * math.sin(math.pi * x / 32)), "K")
    for i, x in enumerate(range(2, 32, 8)):
        y = 2 + round(1.5 * math.sin(math.pi * (x + 2) / 32))
        tone = colors[i % 4]
        for k in range(5):
            c.hline(x + k // 2, y + k, 5 - k, tone)
        c.px(x, y, "w")
    c.save("ad_flags")


def main():
    floor_oak()
    floor_mosaic()
    art_mountains()
    art_stilllife()
    art_city()
    rug_blue()
    rug_patch()
    plants_cactus()
    plants_palm()
    light_bulbs()
    light_shade()
    grand_clock()
    globe()
    counter_vase()
    counter_piggy()
    out_planters()
    out_chalkboard()
    ad_billboard()
    ad_flags()


if __name__ == "__main__":
    main()
