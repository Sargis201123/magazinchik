"""Сюжет «Папа и Соня» (src/game/drama.ts): портреты, три картинки и подсолнухи у входа.

Портреты 32×32 с эмоциями: Соня — четырнадцать лет, каштановые волосы до плеч, жёлтая
заколка, сиреневая толстовка; папа (это игрок) — взъерошенный, небритый, усталые глаза.
Картинки 128×72: фото с озера на холодильнике, ночная дорога под дождём у поворота,
закат на озере — папа и Соня на мостках. Подсолнухи 20×28 — их Соня сажает у входа.

    python3 art/sprites.py
"""

import random

from sprites import Canvas, portrait, rgb, shade, shadowed
from news import W, H, C, mix, sky

MOODS = (None, "happy", "sad", "angry", "surprised")


def hair_sonya(p, hair):
    """Волосы до плеч с чёлкой набок и жёлтая заколка."""
    p.ellipse(16, 9, 9.5, 6.5, hair)
    p.rect(6, 9, 4, 15, hair)
    p.rect(22, 9, 4, 15, hair)
    p.ellipse(8, 24, 2.5, 2, hair)
    p.ellipse(24, 24, 2.5, 2, hair)
    p.line(10, 9, 17, 6, shade(hair, 1.2))
    p.hline(9, 10, 5, hair)
    p.rect(21, 7, 3, 2, rgb("#fee761"))


def sonya_extras(mood):
    def draw(p, skin, hair, shirt):
        # Шнурки толстовки.
        p.vline(14, 26, 4, rgb("#ffffff"))
        p.vline(18, 26, 4, rgb("#ffffff"))
        if mood == "sad":
            p.px(12, 16, rgb("#5fcde4"))
            p.px(12, 17, rgb("#5fcde4"))
    return draw


def hair_father(p, hair):
    """Взъерошенные волосы: торчащие пряди, давно не стриженные виски."""
    p.ellipse(16, 8, 8.5, 5, hair)
    for x, y in ((9, 4), (13, 2), (18, 2), (22, 4), (24, 7)):
        p.rect(x, y, 2, 3, hair)
    p.rect(8, 8, 2, 6, hair)
    p.rect(22, 8, 2, 6, hair)
    p.px(15, 4, shade(hair, 1.3))


def father_extras(mood):
    def draw(p, skin, hair, shirt):
        # Щетина и тени под глазами — человек давно не высыпается.
        stubble = shade(skin, 0.86)
        for x, y in ((11, 19), (13, 21), (16, 22), (19, 21), (21, 19)):
            p.px(x, y, stubble)
        if mood != "happy":
            for x in (12, 13, 19, 20):
                p.px(x, 16, shade(skin, 0.85))
        # Воротник рубашки.
        p.line(13, 26, 15, 28, rgb("#ffffff"))
        p.line(19, 26, 17, 28, rgb("#ffffff"))
    return draw


def portraits():
    for mood in MOODS:
        portrait("sonya", "#5fcde4", "#f2d3ab", "#8f563b", "#68386c", hair_sonya, sonya_extras(mood), mood)
        portrait("father", "#5a6988", "#eec39a", "#4a2c1a", "#3e8948", hair_father, father_extras(mood), mood)


def tiny(c, x, y, shirt, hair, skin=C("#eec39a"), long_hair=False, small=False):
    """Человечек для картинок: (x, y) — макушка; small — ребёнок."""
    h = 14 if small else 18
    c.ellipse(x + 3, y + 3, 3, 3, skin)
    c.rect(x, y, 7, 2, hair)
    if long_hair:
        c.rect(x - 1, y + 1, 2, 7, hair)
        c.rect(x + 6, y + 1, 2, 7, hair)
    c.rect(x - 1, y + 6, 9, h - 11, shirt)
    c.rect(x, y + h - 5, 3, 5, C("#262b44"))
    c.rect(x + 4, y + h - 5, 3, 5, C("#262b44"))


def drama_photo():
    """Фото на холодильнике: озеро летом, трое смеются; уголок загнулся, магнит-солнышко."""
    c = Canvas(W, H)
    c.rect(0, 0, W, H, C("#c0cbdc"))
    for y in range(0, H, 6):
        c.hline(0, y, W, C("#b3bfd1"))
    # Сама фотография с белой рамкой.
    c.rect(22, 6, 84, 62, C("#ffffff"))
    photo = Canvas(76, 48)
    for y in range(48):
        photo.hline(0, y, 76, mix(C("#5fcde4"), C("#c0e8f0"), y / 30) if y < 26 else mix(C("#0099db"), C("#124e89"), (y - 26) / 22))
    photo.ellipse(62, 8, 5, 5, C("#fee761"))
    photo.rect(0, 22, 76, 4, C("#3e8948"))
    photo.ellipse(10, 22, 12, 5, C("#265c42"))
    photo.ellipse(64, 22, 14, 5, C("#265c42"))
    photo.rect(0, 40, 76, 8, C("#ead4aa"))
    tiny(photo, 18, 22, C("#3e8948"), C("#4a2c1a"))
    tiny(photo, 30, 22, C("#fee761"), C("#b86f50"), long_hair=True)
    tiny(photo, 42, 27, C("#e43b44"), C("#8f563b"), long_hair=True, small=True)
    # Тёплый выцветший тон старой фотографии.
    px = photo.img.load()
    for y in range(48):
        for x in range(76):
            r, g, b, a = px[x, y]
            px[x, y] = (min(255, int(r * 0.9 + 30)), min(255, int(g * 0.85 + 22)), int(b * 0.75 + 10), a)
    c.img.alpha_composite(photo.img, (26, 10))
    # Загнутый уголок и магнит.
    for i in range(6):
        c.hline(100 - i, 62 + i, i + 1, C("#8b9bb4"))
    c.ellipse(64, 7, 4, 4, C("#feae34"))
    c.px(63, 6, C("#fee761"))
    c.save("drama_photo")


def drama_rain():
    """Ночная загородная дорога под дождём, поворот, знак и одинокий фонарь. Никого нет."""
    c = Canvas(W, H)
    sky(c, C("#181425"), C("#262b44"), 40)
    c.rect(0, 40, W, 32, C("#265c42"))
    # Дорога уходит в поворот.
    for y in range(40, H):
        t = (y - 40) / (H - 40)
        left = int(70 - 50 * t - 16 * (1 - t))
        width = int(10 + 70 * t)
        c.hline(left, y, width, C("#3a4466"))
        if y % 4 < 2:
            c.px(left + width // 2, y, C("#ead4aa"))
    c.rect(96, 30, 2, 22, C("#8b9bb4"))
    c.rect(91, 22, 12, 10, C("#ffffff"))
    c.line(93, 30, 100, 24, C("#e43b44"))
    c.line(94, 30, 101, 24, C("#e43b44"))
    c.rect(20, 18, 2, 34, C("#5a6988"))
    c.hline(20, 18, 6, C("#5a6988"))
    c.ellipse(26, 20, 3, 2, C("#fee761"))
    c.ellipse(26, 54, 14, 3, mix(C("#fee761"), C("#3a4466"), 0.7))
    # Подсолнухи у столбика — их кто-то оставил.
    for x in (88, 92):
        c.vline(x, 54, 8, C("#3e8948"))
        c.ellipse(x, 53, 2.2, 2.2, C("#feae34"))
        c.px(x, 53, C("#733e39"))
    rnd = random.Random(4)
    for _ in range(110):
        x, y = rnd.randrange(W), rnd.randrange(H - 4)
        c.line(x, y, x - 1, y + 4, mix(C("#8b9bb4"), C("#262b44"), 0.35))
    c.save("drama_rain")


def drama_lake():
    """Закат на озере: папа и Соня сидят на мостках, рядом подсолнух."""
    c = Canvas(W, H)
    for y in range(40):
        c.hline(0, y, W, mix(C("#f77622"), C("#68386c"), 1 - y / 39) if y < 20 else mix(C("#feae34"), C("#f77622"), (y - 20) / 19))
    c.ellipse(64, 38, 12, 12, C("#fee761"))
    c.ellipse(20, 36, 22, 6, C("#4a3b52"))
    c.ellipse(108, 37, 26, 6, C("#4a3b52"))
    for y in range(40, H):
        c.hline(0, y, W, mix(C("#b55088"), C("#262b44"), (y - 40) / (H - 40)))
    for y in range(41, H, 3):
        w = max(2, 14 - (y - 40) // 3)
        c.hline(64 - w // 2, y, w, C("#fee761"))
    # Мостки.
    c.rect(30, 52, 52, 4, C("#8f563b"))
    for x in (34, 54, 76):
        c.rect(x, 56, 2, 12, C("#733e39"))
    # Силуэты: папа и Соня, она положила голову ему на плечо.
    sil = C("#262b44")
    c.ellipse(52, 40, 3.5, 3.5, sil)
    c.rect(48, 44, 9, 9, sil)
    c.ellipse(60, 43, 3, 3, sil)
    c.rect(57, 46, 7, 7, sil)
    c.rect(56, 41, 3, 4, sil)
    c.rect(50, 53, 3, 6, sil)
    c.rect(58, 53, 3, 6, sil)
    c.vline(76, 40, 12, C("#265c42"))
    c.ellipse(76, 39, 3, 3, C("#feae34"))
    c.px(76, 39, C("#733e39"))
    c.save("drama_lake")


def sunflowers():
    """Три подсолнуха у входа — их сажает Соня."""
    c = Canvas(20, 30)
    for x, top in ((4, 6), (10, 2), (16, 8)):
        c.vline(x, top + 3, 26 - top, "e")
        c.ellipse(x - 2, top + 12, 2, 1.2, "E")
        for dx, dy in ((-2, 0), (2, 0), (0, -2), (0, 2), (-1, -1), (1, 1), (1, -1), (-1, 1)):
            c.ellipse(x + dx, top + dy, 1.4, 1.4, "Y")
        c.ellipse(x, top, 1.4, 1.4, "b")
    c.rect(1, 27, 18, 3, "a")
    c.outline("k")
    return shadowed(c, 10, 29, 9, 1.5)


def main():
    portraits()
    drama_photo()
    drama_rain()
    drama_lake()
    sunflowers().save("sunflowers")


if __name__ == "__main__":
    main()
