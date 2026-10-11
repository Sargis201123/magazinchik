"""Гипермаркет «Гигант» за дорогой (src/game/giant.ts): стройка, открытый магазин и закрытый.

Здание большое — 300×176 пикселей (150×88 точек мира): крыша с вентиляцией сверху, фасад
с синими панелями, красная вывеска с буквами «ГИГАНТ», стеклянный вход. Плюс четыре картинки
новостей для ведущей.

    python3 art/sprites.py
"""

import random

from sprites import Canvas, shadowed
from news import W as NW, H as NH, C, broadcast, person, sky, skyline

# Пиксельный шрифт 5×7 для вывесок.
FONT = {
    "Г": ["#####", "#....", "#....", "#....", "#....", "#....", "#...."],
    "И": ["#...#", "#...#", "#..##", "#.#.#", "##..#", "#...#", "#...#"],
    "А": [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "Н": ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "Т": ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
    "С": [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
    "К": ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
    "О": [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
    "Р": ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
    "Д": ["..##.", ".#.#.", ".#.#.", "#..#.", "#..#.", "#####", "#...#"],
    "Ё": [".#.#.", "#####", "#....", "####.", "#....", "#....", "#####"],
    "Я": [".####", "#...#", "#...#", ".####", "..#.#", ".#..#", "#...#"],
    " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
}


def text(c, s, x, y, col, scale=1):
    """Надпись пиксельным шрифтом; возвращает ширину."""
    cx = x
    for ch in s:
        rows = FONT[ch]
        for dy, row in enumerate(rows):
            for dx, v in enumerate(row):
                if v == "#":
                    c.rect(cx + dx * scale, y + dy * scale, scale, scale, col)
        cx += 6 * scale
    return cx - x - scale


def text_width(s, scale=1):
    return len(s) * 6 * scale - scale


GW, GH = 300, 176
ROOF = 64


def body(c, closed=False):
    """Крыша и фасад; closed — серый, окна заколочены."""
    rnd = random.Random(5)
    roof, roof_edge = ("W", "l") if not closed else ("l", "G")
    c.rect(4, 4, GW - 8, ROOF, roof)
    c.frame(4, 4, GW - 8, ROOF, roof_edge)
    for _ in range(40):
        c.px(rnd.randrange(8, GW - 8), rnd.randrange(8, ROOF), "l" if not closed else "G")
    # Вентиляция по краям крыши.
    for x in (16, 254):
        c.rect(x, 40, 22, 14, "G")
        c.rect(x + 2, 42, 18, 4, "l")
        c.ellipse(x + 11, 50, 4, 2.5, "K")
    # Вывеска на крыше — её видно с улицы даже издалека.
    sign_col = "R" if not closed else "g"
    for x in (90, 210):
        c.rect(x, 36, 4, 18, "K")
    c.rect(56, 8, 188, 30, sign_col)
    c.frame(56, 8, 188, 30, "r" if not closed else "K")
    word = "ГИГАНТ"
    w = text_width(word, 3)
    text(c, word, 150 - w // 2, 12, "w" if not closed else "G", 3)
    if not closed:
        c.hline(58, 10, 184, "s")
    # Фасад.
    panel, panel_dark = ("U", "u") if not closed else ("G", "g")
    c.rect(4, ROOF + 4, GW - 8, GH - ROOF - 10, panel)
    for x in range(4, GW - 4, 20):
        c.vline(x, ROOF + 4, GH - ROOF - 10, panel_dark)
    c.rect(100, ROOF + 12, 100, 18, "w" if not closed else "G")
    text(c, "ГИГАНТ", 150 - text_width("ГИГАНТ", 2) // 2, ROOF + 15, "R" if not closed else "g", 2)
    c.rect(4, ROOF + 44, GW - 8, 4, "o" if not closed else "G")
    # Окна и вход.
    for x in list(range(14, 110, 26)) + list(range(186, 270, 26)):
        c.rect(x, ROOF + 56, 20, 30, "c" if not closed else "K")
        if closed:
            c.line(x, ROOF + 56, x + 19, ROOF + 85, "B")
            c.line(x + 19, ROOF + 56, x, ROOF + 85, "B")
        else:
            c.line(x + 3, ROOF + 58, x + 8, ROOF + 66, "w")
    c.rect(124, ROOF + 52, 52, GH - ROOF - 58, "K")
    c.rect(126, ROOF + 54, 23, GH - ROOF - 62, "c" if not closed else "g")
    c.rect(151, ROOF + 54, 23, GH - ROOF - 62, "c" if not closed else "g")
    if closed:
        for y in range(ROOF + 60, GH - 10, 8):
            c.rect(122, y, 56, 3, "B")
    c.hline(4, GH - 6, GW - 8, "K")
    c.outline("k")


def giant_store():
    c = Canvas(GW, GH)
    body(c)
    # Флажки над входом и цифры скидок.
    for i, x in enumerate(range(20, 284, 12)):
        c.rect(x, ROOF + 6, 6, 5, ["Y", "E", "R", "w"][i % 4])
    shadowed(c, GW // 2, GH - 3, GW // 2 - 8, 4).save("giant_store")


def giant_closed():
    c = Canvas(GW, GH)
    body(c, closed=True)
    # Табличка «СДАЁТСЯ».
    c.rect(116, ROOF + 92, 68, 14, "N")
    c.frame(116, ROOF + 92, 68, 14, "k")
    w = text_width("СДАЁТСЯ")
    text(c, "СДАЁТСЯ", 150 - w // 2, ROOF + 95, "r")
    shadowed(c, GW // 2, GH - 3, GW // 2 - 8, 4).save("giant_closed")


def giant_site():
    """Стройка: каркас из балок, кран, песок и синий забор с баннером «СКОРО ГИГАНТ»."""
    c = Canvas(GW, GH + 40)
    oy = 40
    c.rect(4, oy + 4, GW - 8, GH - 10, "t")
    rnd = random.Random(9)
    for _ in range(140):
        c.px(rnd.randrange(6, GW - 6), rnd.randrange(oy + 6, oy + GH - 8), rnd.choice(["a", "B", "n"]))
    # Каркас.
    for x in range(30, 272, 30):
        c.rect(x, oy + 30, 4, 100, "o")
    for y in (oy + 30, oy + 64, oy + 98):
        c.rect(30, y, 244, 4, "o")
    for x in range(30, 242, 30):
        c.line(x, oy + 34, x + 30, oy + 64, "y")
    # Кран.
    c.rect(250, 0, 8, oy + 130, "Y")
    for y in range(4, oy + 128, 8):
        c.line(250, y, 257, y + 8, "y")
    c.rect(150, 2, 140, 6, "Y")
    for x in range(150, 288, 8):
        c.line(x, 2, x + 8, 7, "y")
    c.vline(180, 8, 40, "K")
    c.rect(174, 48, 12, 8, "G")
    # Песок и плиты.
    c.ellipse(60, oy + 150, 24, 10, "N")
    c.rect(200, oy + 140, 30, 10, "W")
    c.rect(204, oy + 134, 30, 6, "l")
    # Забор с баннером.
    c.rect(4, oy + GH - 30, GW - 8, 24, "U")
    for x in range(4, GW - 4, 12):
        c.vline(x, oy + GH - 30, 24, "u")
    c.rect(70, oy + GH - 28, 160, 20, "w")
    word = "СКОРО ГИГАНТ"
    w = text_width(word, 2)
    text(c, word, 150 - w // 2, oy + GH - 25, "R", 2)
    c.outline("k")
    c.save("giant_site")


def news_giant(name, draw):
    c = Canvas(NW, NH)
    draw(c)
    broadcast(c)
    c.save(f"news_giant_{name}")


def mini_giant(c, x, y, closed=False):
    """Маленький «Гигант» для картинок новостей."""
    c.rect(x, y, 70, 30, "G" if closed else "U")
    c.rect(x + 10, y + 3, 50, 9, "g" if closed else "R")
    text(c, "ГИГАНТ", x + 35 - text_width("ГИГАНТ") // 2, y + 4, "G" if closed else "w")
    for k in range(5):
        c.rect(x + 4 + k * 14, y + 16, 9, 10, "K" if closed else "c")
    c.frame(x, y, 70, 30, "k")


def draw_build(c):
    sky(c, C("#8fd7f5"), C("#c0cbdc"), 52)
    c.rect(0, 52, NW, 8, C("#c28569"))
    # Каркас и кран.
    for x in range(30, 100, 14):
        c.rect(x, 20, 2, 32, C("#f77622"))
    for y in (20, 34):
        c.rect(30, y, 72, 2, C("#f77622"))
    c.rect(108, 4, 3, 48, C("#fee761"))
    c.rect(70, 4, 50, 3, C("#fee761"))
    c.vline(84, 7, 14, C("#262b44"))
    c.rect(81, 21, 6, 4, C("#5a6988"))
    c.rect(20, 44, 90, 8, C("#0099db"))
    text(c, "СКОРО", 46, 45, C("#ffffff"))


def draw_open(c):
    sky(c, C("#0099db"), C("#8fd7f5"), 52)
    mini_giant(c, 29, 18)
    c.rect(0, 48, NW, 12, C("#5a6988"))
    for i, x in enumerate(range(8, 120, 14)):
        person(c, x, 34 + (i % 2) * 4, [C("#e43b44"), C("#feae34"), C("#63c74d"), C("#b55088")][i % 4])
    for x in range(30, 100, 8):
        c.rect(x, 14, 4, 4, [C("#fee761"), C("#e43b44"), C("#63c74d")][(x // 8) % 3])


def draw_won(c):
    sky(c, C("#feae34"), C("#fee761"), 52)
    mini_giant(c, 50, 18, closed=True)
    c.rect(0, 48, NW, 12, C("#63c74d"))
    # Хозяин и бабушка радуются, конфетти.
    person(c, 18, 28, C("#8fd16a"))
    person(c, 30, 28, C("#68386c"), hair=C("#d8d8e0"))
    rnd = random.Random(3)
    for _ in range(50):
        c.px(rnd.randrange(NW), rnd.randrange(0, 46), rnd.choice([C("#e43b44"), C("#2ce8f5"), C("#ffffff"), C("#63c74d")]))


def draw_lost(c):
    sky(c, C("#5a6988"), C("#8b9bb4"), 52)
    mini_giant(c, 29, 18)
    c.rect(0, 48, NW, 12, C("#3a4466"))
    rnd = random.Random(4)
    for _ in range(40):
        x, y = rnd.randrange(NW), rnd.randrange(0, 46)
        c.px(x, y, C("#c0cbdc"))
        c.px(x - 1, y + 1, C("#c0cbdc"))


def main():
    giant_store()
    giant_closed()
    giant_site()
    news_giant("build", draw_build)
    news_giant("battle", draw_open)
    news_giant("won", draw_won)
    news_giant("lost", draw_lost)


if __name__ == "__main__":
    main()
