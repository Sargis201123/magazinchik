"""Эксклюзив звёздного пропуска и подарки за поддержку автора.

Каждый сезон пропуска (src/game/pass.ts) даёт на звёздной дорожке две вещи, которых больше
нигде не достать: вывеску на крышу и наряд хозяина. Здесь — два сезона:

- «Листопад»: янтарная доска с кленовыми листьями; вязаная шапка с листком и пальто с шарфом;
- «Северное сияние»: ночная доска с переливом сияния и звёздами; шапка с помпоном и свитер с узором.

Подарки за «Поддержать автора» (src/game/support.ts): табличка «Спасибо!» у кассы (надпись
игра пишет сама — на языке игрока) и кот в цилиндре на прилавке (моргает).

Слои наряда рисуются как остальной гардероб (art/wardrobe.py), превью наряда — в art/costumes.py.
Запуск (после sprites.py — нужны готовые слои человечка):

    python3 art/season.py
    python3 art/costumes.py
"""

import math
import random

from premium import H, lit, mix
from sprites import Canvas
from wardrobe import Big, finish, small, torso

SUFFIX = {"f": "", "b": "_b", "s": "_s"}

# ---------------------------------------------------------------- «Листопад»

LEAF = [H("#e8892c"), H("#d4502c"), H("#f2c14e"), H("#b8452a")]


def maple(c, x, y, tone, flip=False):
    """Кленовый листок 5×5 с черешком."""
    rows = ["..X..", "X.X.X", "XXXXX", ".XXX.", "..X.."]
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch == "X":
                c.px(x + (4 - dx if flip else dx), y + dy, tone)
    c.px(x + 2, y + 2, lit(tone, 0.3))
    c.px(x + (1 if flip else 3), y + 5, H("#5c3a22"))


def big_maple(c, x, y, tone, flip=False):
    """Кленовый лист покрупнее (7×7) — для вывески: пять лопастей и прожилка."""
    rows = ["...X...", ".X.X.X.", "XXXXXXX", ".XXXXX.", "XXXXXXX", "..XXX..", "...X..."]
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch == "X":
                c.px(x + (6 - dx if flip else dx), y + dy, tone)
    for dy in range(2, 6):
        c.px(x + 3, y + dy, lit(tone, -0.25))
    c.px(x + (2 if flip else 4), y + 2, lit(tone, 0.35))
    c.px(x + 3, y + 7, H("#5c3a22"))


def sign_s1():
    """«Листопад»: янтарная доска в деревянной раме, по краям — гирлянда из кленовых листьев."""
    c = Canvas(128, 26)
    frame, frame_hi, frame_lo = H("#7e4a26"), H("#a8683a"), H("#4f2c17")
    c.round_rect(2, 3, 124, 21, frame, r=2)
    c.hline(3, 3, 122, frame_hi)
    c.hline(3, 23, 122, frame_lo)
    for y in range(6, 21):
        c.hline(6, y, 116, mix(H("#5a2a1a"), H("#3a1a12"), (y - 6) / 14))
    c.hline(6, 6, 116, H("#6e3826"))
    # Тёплый отсвет посередине — буквы читаются.
    for x in range(30, 98):
        c.px(x, 7, H("#7a4030"))
    # Гирлянда листьев сверху и внизу по углам.
    rnd = random.Random(11)
    for x in (5, 15, 25, 103, 113, 123):
        big_maple(c, x - 3, 0 if x in (15, 113) else 1, LEAF[rnd.randrange(len(LEAF))], flip=x > 64)
    for x in (9, 119):
        big_maple(c, x - 3, 17, LEAF[rnd.randrange(len(LEAF))], flip=x > 64)
    # Шляпки гвоздей по раме.
    for x in (30, 64, 98):
        c.px(x, 4, H("#f2c14e"))
    c.outline("k")
    c.save("sign_s1")


def hat_leafcap(v):
    """Вязаная горчичная шапка с отворотом и кленовым листком сбоку."""
    c = Big()
    knit, knit_lo, cuff = H("#d9a03a"), H("#a8742a"), H("#b8452a")
    if v == "s":
        c.ellipse(12, 3, 6.8, 3.6, knit)
        c.rect(6, 4, 12, 3, cuff)
        for x in range(7, 18, 2):
            c.px(x, 2, knit_lo)
        c.px(12, -1, knit_lo)
    else:
        c.ellipse(11.5, 3, 8.6, 3.8, knit)
        c.rect(4, 4, 16, 3, cuff)
        c.hline(4, 5, 16, lit(cuff, -0.2))
        for x in range(6, 18, 2):
            c.vline(x, 0, 3, knit_lo)
        c.px(11, -1, knit_lo)
        c.px(12, -1, knit_lo)
    if v != "b":
        maple(c, 14 if v == "f" else 13, 1, H("#e8892c"))
    c.outline("k")
    return c


def outfit_trench(v):
    """Пальто цвета карамели до колен с клетчатым шарфом."""
    c = small()
    coat, coat_lo = H("#c98a4a"), H("#9a6232")
    torso(c, v, coat, coat_lo, long=3)
    red, cream = H("#b8452a"), H("#f2d8a0")
    if v == "s":
        c.rect(9, 16, 6, 3, red)
        c.px(11, 17, cream)
        c.rect(13, 19, 2, 5, red)
        c.px(13, 21, cream)
    else:
        c.rect(7, 16, 11, 3, red)
        for x in range(8, 17, 2):
            c.px(x, 17, cream)
        if v == "f":
            # Пояс с пряжкой и пуговицы в два ряда; конец шарфа свисает на грудь.
            c.hline(7, 25, 11, coat_lo)
            c.px(12, 25, H("#f2c14e"))
            for y in (20, 23, 27):
                c.px(10, y, H("#4f2c17"))
                c.px(14, y, H("#4f2c17"))
            c.rect(15, 19, 2, 5, red)
            c.px(15, 21, cream)
        else:
            c.hline(7, 25, 11, coat_lo)
            c.vline(12, 26, 4, coat_lo)
    return finish(c, v)


# ---------------------------------------------------------------- «Северное сияние»


def sign_s2():
    """«Северное сияние»: ночная доска, по ней переливаются зелёные и сиреневые волны, мерцают звёзды."""
    c = Canvas(128, 26)
    c.round_rect(1, 2, 126, 23, H("#0f1a33"), r=4)
    c.round_rect(3, 4, 122, 19, H("#14244a"), r=3)
    # Волны сияния: две полосы с мягким краем.
    green, violet = H("#52e0a0"), H("#9a6ad8")
    for x in range(4, 124):
        for band, tone, amp, base in ((0, green, 2.2, 9), (1, violet, 1.8, 15)):
            y = base + amp * math.sin(x / 9 + band * 2)
            for dy in range(-1, 2):
                yy = int(y) + dy
                if 5 <= yy <= 21:
                    k = 0.55 if dy else 0.28
                    c.px(x, yy, mix(tone, H("#14244a"), k))
    # Звёзды.
    rnd = random.Random(23)
    for _ in range(22):
        x, y = rnd.randrange(6, 122), rnd.randrange(5, 21)
        c.px(x, y, H("#ffffff") if rnd.random() < 0.4 else H("#bcd7ff"))
    # Серебряная рама и снежная шапка поверх.
    c.hline(4, 2, 120, H("#c0cbdc"))
    c.hline(4, 24, 120, H("#5a6988"))
    for x in range(2, 126):
        h = 2 + int(1.5 * (1 + math.sin(x / 5.3)))
        for y in range(0, h):
            c.px(x, y, H("#ffffff") if y < h - 1 else H("#dce8f7"))
    for x in (12, 40, 77, 109):
        c.vline(x, 3, 2, H("#dce8f7"))
    c.outline("k")
    c.save("sign_s2")
    # Слой сияния: в игре медленно дышит поверх вывески.
    g = Canvas(128, 26)
    for x in range(5, 123):
        y = 9 + 2.2 * math.sin(x / 9)
        g.px(x, int(y), H("#a8ffd8", 150))
        y2 = 15 + 1.8 * math.sin(x / 9 + 2)
        g.px(x, int(y2), H("#d6b8ff", 130))
    g.save("sign_s2_lit")


def hat_pompom(v):
    """Шапка с большим помпоном и северным узором."""
    c = Big()
    base, band, dot = H("#1f3f7a"), H("#ffffff"), H("#e43b44")
    if v == "s":
        c.ellipse(12, 3, 6.8, 3.6, base)
        c.rect(6, 4, 12, 3, band)
        for x in range(7, 18, 3):
            c.px(x, 5, dot)
        c.ellipse(12, -2, 2.6, 2.4, band)
    else:
        c.ellipse(11.5, 3, 8.6, 3.8, base)
        c.rect(4, 4, 16, 3, band)
        for x in range(5, 19, 3):
            c.px(x, 5, dot)
            c.px(x + 1, 4, base)
        for x in range(6, 18, 4):
            c.px(x, 1, H("#5a8ad0"))
        c.ellipse(11.5, -2, 3, 2.6, band)
        c.px(10, -3, H("#dce8f7"))
    c.outline("k")
    return c


def outfit_nordic(v):
    """Свитер с северным узором: снежинки и зигзаг по груди."""
    c = small()
    body, lo = H("#b8263a"), H("#861a2b")
    torso(c, v, body, lo)
    white = H("#ffffff")
    if v == "s":
        for x in range(8, 16, 2):
            c.px(x, 20, white)
        c.hline(8, 22, 8, white)
        c.hline(12, 22, 3, white)
    else:
        # Горло, зигзаг и пояс снежинок.
        c.hline(9, 17, 7, white)
        for i, x in enumerate(range(7, 18)):
            c.px(x, 20 + (i % 2), white)
        if v == "f":
            for x in (9, 15):
                for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
                    c.px(x + dx, 23 + dy, white)
            c.px(12, 23, H("#fee761"))
        else:
            for x in (10, 14):
                c.px(x, 23, white)
        c.hline(7, 26, 11, lo)
        c.hline(4, 23, 3, white)
        c.hline(19, 23, 3, white)
    return finish(c, v)


# ---------------------------------------------------------------- «Поддержать автора»


def thanks_plaque():
    """Латунная табличка на подставке 36×16 — надпись пишет игра; сверху сердечко."""
    c = Canvas(36, 16)
    brass, brass_hi, brass_lo = H("#d9a93f"), H("#f7dc85"), H("#8c6a24")
    c.rect(17, 11, 2, 3, brass_lo)
    c.rect(12, 14, 12, 2, brass_lo)
    c.round_rect(1, 2, 34, 10, brass, r=2)
    c.hline(2, 2, 32, brass_hi)
    c.hline(2, 11, 32, brass_lo)
    c.round_rect(3, 4, 30, 6, H("#3a2a1a"), r=1)
    c.hline(4, 4, 28, H("#4a3826"))
    for x, y in ((16, 0), (19, 0), (15, 1), (16, 1), (17, 1), (18, 1), (19, 1), (20, 1), (16, 2), (17, 2), (18, 2), (19, 2)):
        c.px(x, y, H("#e43b44"))
    c.px(16, 0, H("#f6757a"))
    c.outline("k")
    c.save("thanks_plaque")


def cat_hat(blink=False):
    """Рыжий кот в чёрном цилиндре с красной лентой сидит на прилавке (cat_hat, моргает — cat_hat_blink)."""
    c = Canvas(18, 24)
    o, y = H("#f77622"), H("#feae34")
    c.ellipse(9, 18, 5, 5, o)
    c.ellipse(9, 19, 3, 3.5, y)
    c.ellipse(9, 12, 4, 3.5, o)
    c.px(5, 9, o)
    c.px(13, 9, o)
    if blink:
        c.hline(6, 12, 2, H("#181425"))
        c.hline(11, 12, 2, H("#181425"))
    else:
        c.px(7, 12, H("#181425"))
        c.px(11, 12, H("#181425"))
    c.px(9, 13, H("#f6757a"))
    c.rect(6, 22, 2, 1, y)
    c.rect(10, 22, 2, 1, y)
    for x, yy in ((14, 21), (15, 20), (16, 19), (16, 18), (16, 17)):
        c.px(x, yy, o)
    # Цилиндр набекрень: поля, тулья, лента.
    c.hline(4, 8, 10, H("#262b44"))
    c.rect(6, 1, 6, 7, H("#262b44"))
    c.vline(6, 1, 7, H("#3a4466"))
    c.hline(6, 6, 6, H("#e43b44"))
    c.px(7, 2, H("#5a6988"))
    c.outline("k")
    c.save("cat_hat_blink" if blink else "cat_hat")


WARDROBE = {
    "hat_leafcap": hat_leafcap,
    "outfit_trench": outfit_trench,
    "hat_pompom": hat_pompom,
    "outfit_nordic": outfit_nordic,
}


def main():
    for name, draw in WARDROBE.items():
        for v, suffix in SUFFIX.items():
            draw(v).save(f"w_{name}{suffix}")
    sign_s1()
    sign_s2()
    thanks_plaque()
    cat_hat()
    cat_hat(blink=True)


if __name__ == "__main__":
    main()
