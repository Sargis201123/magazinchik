"""Сезонные недели игрового года (src/game/weeks.ts): «Ярмарка урожая», «Ночь распродаж», «Летний фестиваль».

Товары недель (тыквы и арбузы: три вида на полке и ящик в подсобке), украшения улицы (лоток урожая,
сено, стол конкурса пирогов, баннер «−20%», бумажный фонарик) и памятные вещи в зал за всю дорожку
недели (пугало с тыквой, золотая тележка, фонарик на подставке). Запуск отдельно:

    python3 art/weeks.py
"""

from sprites import Canvas, shadowed

# ---------------------------------------------------------------- товары

WEEK_ITEMS = {
    "pumpkins": [
        ["..........", "....e.....", "....ee....", "..kkkkkk..", ".kyoyoyok.", "kyoyoyoyok",
         "kooyoyoook", "kooyoyoook", ".kooyooyk.", "..kkkkkk..", "..........", ".........."],
        ["..........", "..........", "...e..e...", ".kkkkkkkk.", "kyoykyoyok", "koooykooyk",
         "kooyykoyyk", ".kkkk.kkk.", "..........", "..........", "..........", ".........."],
        ["....e.....", "...ee.....", "..kkkkk...", ".kyoyoyk..", "kyoyoyoyk.", "kooykkooyk",
         "koook.kook", ".kkk...kk.", "..........", "..........", "..........", ".........."],
    ],
    "watermelons": [
        ["..........", "..........", "..kkkkkk..", ".kEeEeEek.", "kEeEeEeEek", "keEeEeEeEk",
         "kEeEeEeEek", ".keEeEeEk.", "..kkkkkk..", "..........", "..........", ".........."],
        ["..........", "..........", "..........", "kkkkkkkkkk", "kRRkRRkRRk", "kRwRRwRRwk",
         ".kRRRRRRk.", "..kEEEEk..", "...kkkk...", "..........", "..........", ".........."],
        ["..........", "..........", "....kkk...", "...kRRRk..", "..kRkRRRk.", ".kRRRRkRk.",
         ".kwwwwwwk.", "..kEEEEk..", "...kkkk...", "..........", "..........", ".........."],
    ],
}


def week_goods():
    for product, variants in WEEK_ITEMS.items():
        for i, rows in enumerate(variants):
            assert len(rows) == 12 and all(len(r) == 10 for r in rows), f"{product}_{i}"
            c = Canvas(10, 12)
            c.stamp(rows)
            c.save(f"item_{product}_{i}")
            if i == 0:
                c.save(f"item_{product}")
    # Тыквы в деревянном ящике.
    c = Canvas(16, 16)
    for x, y in ((4, 7), (11, 7), (8, 5)):
        c.ellipse(x + 0.5, y + 0.5, 2.8, 2.2, "o")
        c.px(x - 1, y, "y")
        c.px(x, y - 2, "e")
    c.rect(0, 9, 16, 6, "n")
    c.hline(0, 9, 16, "N")
    for x in (5, 10):
        c.vline(x, 10, 5, "a")
    c.outline("k")
    c.save("crate_pumpkins")
    # Арбузы в сетке.
    c = Canvas(16, 16)
    for x, y in ((4, 9), (11, 9), (8, 5)):
        c.ellipse(x + 0.5, y + 0.5, 3.2, 2.8, "e")
        for dx in (-2, 0, 2):
            c.vline(x + dx, y - 1, 3, "E")
    for y in range(4, 14, 3):
        c.hline(1, y, 14, "W")
    c.outline("k")
    c.save("crate_watermelons")


# ---------------------------------------------------------------- улица


def week_stall():
    """Лоток урожая 34×32: соломенный навес на стойках, прилавок с тыквами, яблоками и кабачками,
    мешок картошки и табличка-грифель."""
    c = Canvas(34, 32)
    for x in (3, 30):
        c.vline(x, 6, 24, "a")
    # Соломенный навес: жёлтые полосы с тенью и бахромой.
    c.rect(1, 2, 32, 6, "y")
    for x in range(1, 33, 3):
        c.vline(x, 2, 6, "Y")
    c.hline(1, 2, 32, "N")
    c.hline(1, 7, 32, "n")
    for x in range(2, 33, 2):
        c.px(x, 8, "y")
    # Прилавок — ящики.
    c.rect(2, 19, 30, 10, "B")
    c.hline(2, 19, 30, "n")
    for x in range(5, 31, 7):
        c.vline(x, 20, 9, "a")
    # Урожай на прилавке.
    for x, y, rx, ry, tone, hi in ((7, 16, 3.4, 2.6, "o", "y"), (14, 17, 2.2, 1.8, "R", "s"), (18, 16, 2.2, 1.8, "R", "s"), (25, 16, 3.4, 2.6, "o", "y")):
        c.ellipse(x, y, rx, ry, tone)
        c.px(x - 1, y - 1, hi)
    c.px(7, 13, "e")
    c.px(25, 13, "e")
    c.rect(10, 17, 2, 2, "e")
    c.rect(21, 17, 2, 2, "E")
    # Табличка-грифель с ценой.
    c.rect(12, 22, 10, 5, "K")
    c.hline(14, 24, 6, "w")
    c.outline("k")
    shadowed(c, 17, 30, 15, 2).save("week_stall")


def week_hay():
    """Тюк сена 16×12 с тыквой сверху."""
    c = Canvas(16, 12)
    c.rect(1, 5, 14, 6, "y")
    for x in range(2, 15, 3):
        c.vline(x, 5, 6, "Y")
    c.hline(1, 8, 14, "a")
    c.ellipse(8, 4, 3.2, 2.4, "o")
    c.px(7, 3, "y")
    c.px(8, 1, "e")
    c.outline("k")
    shadowed(c, 8, 11, 7, 1.2).save("week_hay")


def week_pietable():
    """Стол конкурса пирогов 34×22: скатерть в клетку, три пирога на блюдах и кубок."""
    c = Canvas(34, 22)
    c.rect(1, 10, 32, 8, "w")
    for x in range(1, 33, 4):
        c.rect(x, 10, 2, 8, "s")
    for y in (12, 16):
        c.hline(1, y, 32, "s")
    c.vline(4, 18, 3, "a")
    c.vline(29, 18, 3, "a")
    for x in (7, 17, 27):
        c.ellipse(x, 8, 4, 1.6, "W")
        c.ellipse(x, 7, 3.2, 2, "y")
        c.hline(x - 2, 6, 5, "n")
        c.px(x, 5, "B")
    # Кубок победителю.
    c.rect(21, 1, 3, 3, "Y")
    c.px(22, 4, "y")
    c.hline(21, 5, 3, "y")
    c.outline("k")
    shadowed(c, 17, 21, 15, 1.2).save("week_pietable")


def week_sale_banner():
    """Баннер «−20%» 48×18: красное полотно с белой каймой и крупными буквами, на двух шнурах."""
    c = Canvas(48, 18)
    c.rect(1, 2, 46, 14, "R")
    c.hline(1, 2, 46, "s")
    c.hline(1, 15, 46, "r")
    c.frame(2, 3, 44, 12, "w")
    glyphs = {
        "-": ["....", "....", "####", "....", "...."],
        "2": ["###.", "...#", ".##.", "#...", "####"],
        "0": [".##.", "#..#", "#..#", "#..#", ".##."],
        "%": ["#..#", "..#.", ".#..", "#...", "#..#"],
    }
    for i, ch in enumerate("-20%"):
        x0 = 5 + i * 10
        for dy, row in enumerate(glyphs[ch]):
            for dx, v in enumerate(row):
                if v == "#":
                    c.rect(x0 + dx * 2, 4 + dy * 2, 2, 2, "w")
    # Подвес: шнуры к крыше.
    for x in (3, 44):
        c.vline(x, 0, 2, "x")
    c.outline("k")
    c.save("week_sale_banner")


def week_lantern():
    """Бумажный фонарик 8×10 под тинт: белый (красится в игре), рёбра серые, тёмные крышки."""
    c = Canvas(8, 10)
    c.vline(4, 0, 2, "K")
    c.rect(2, 2, 4, 1, "K")
    c.ellipse(4, 5.5, 3.4, 3, "1")
    for x in (2, 4, 6):
        c.vline(x, 3, 6, "2")
    c.rect(2, 8, 4, 1, "K")
    c.px(3, 4, "1")
    c.outline("k")
    c.save("week_lantern")


# ---------------------------------------------------------------- памятные вещи в зал


def holiday_scarecrow():
    """Пугало 26×40: соломенная шляпа, лицо-мешок, клетчатая рубаха на палке, тыква и корзинка у ног."""
    c = Canvas(26, 40)
    c.vline(13, 10, 26, "a")
    c.hline(4, 18, 18, "a")
    # Рубаха в клетку.
    c.rect(7, 16, 12, 11, "R")
    for x in range(7, 19, 3):
        c.vline(x, 16, 11, "r")
    for y in range(18, 27, 3):
        c.hline(7, y, 12, "r")
    c.rect(4, 16, 3, 4, "R")
    c.rect(19, 16, 3, 4, "R")
    for x in (3, 22):
        c.px(x, 19, "Y")
        c.px(x, 20, "y")
    # Голова-мешок и шляпа.
    c.ellipse(13, 11, 4.2, 4, "N")
    c.px(11, 10, "k")
    c.px(15, 10, "k")
    c.hline(11, 13, 5, "a")
    c.rect(5, 6, 16, 2, "y")
    c.rect(9, 2, 8, 5, "y")
    c.hline(9, 5, 8, "R")
    # Солома из рукавов и тыква у ног.
    c.ellipse(7, 34, 4.2, 3.2, "o")
    c.px(6, 32, "y")
    c.px(7, 30, "e")
    c.rect(16, 32, 7, 5, "B")
    c.hline(16, 32, 7, "n")
    c.px(18, 31, "R")
    c.px(20, 31, "R")
    c.rect(11, 36, 5, 2, "a")
    c.outline("k")
    shadowed(c, 13, 38, 10, 1.5).save("holiday_scarecrow")


def holiday_cart():
    """Золотая тележка 28×28 с бантом и бирочкой «−20%»: память о «Ночи распродаж»."""
    c = Canvas(28, 28)
    c.line(3, 4, 7, 6, "y")
    c.rect(6, 7, 18, 11, "y")
    for x in range(8, 24, 3):
        c.vline(x, 8, 9, "Y")
    for y in (10, 14):
        c.hline(7, y, 16, "Y")
    c.hline(6, 18, 18, "o")
    c.line(8, 18, 7, 22, "y")
    c.line(22, 18, 23, 22, "y")
    for x in (8, 22):
        c.ellipse(x, 24, 2, 2, "K")
        c.px(x, 24, "W")
    # Бант и бирка.
    c.rect(13, 4, 2, 3, "R")
    c.px(11, 4, "R")
    c.px(16, 4, "R")
    c.rect(18, 1, 6, 4, "w")
    c.hline(19, 3, 4, "R")
    c.outline("k")
    shadowed(c, 15, 26, 11, 1.5).save("holiday_cart")


def holiday_lantern():
    """Бумажный фонарь на подставке 18×34: красный, с золотыми кистями, тёплый свет внутри."""
    c = Canvas(18, 34)
    c.vline(9, 4, 26, "x")
    c.rect(4, 30, 10, 3, "x")
    c.hline(4, 30, 10, "a")
    c.hline(5, 3, 8, "x")
    c.ellipse(9, 13, 6.4, 7, "R")
    for x in (5, 9, 13):
        c.vline(x, 7, 13, "r")
    c.ellipse(9, 13, 2.6, 4, "y")
    c.ellipse(9, 13, 1.4, 2.4, "Y")
    c.rect(6, 5, 7, 2, "K")
    c.rect(6, 20, 7, 2, "K")
    for x in (7, 9, 11):
        c.vline(x, 22, 4, "y")
    c.outline("k")
    shadowed(c, 9, 32, 7, 1.2).save("holiday_lantern")


def main():
    week_goods()
    week_stall()
    week_hay()
    week_pietable()
    week_sale_banner()
    week_lantern()
    holiday_scarecrow()
    holiday_cart()
    holiday_lantern()


if __name__ == "__main__":
    main()
