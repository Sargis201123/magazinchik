"""Район подстраивается (13.11): крыши новых зданий на участках и щит на заборе стройки.

Здания района видно сверху: у бизнес-центра вертолётная площадка, у поликлиники крест
(art/rooftops.py). У зданий участков — своё, чтобы с высоты было понятно, что открылось:
спортзал — гантель на оранжевом круге, свадебный салон — кольца и сердце, коворкинг — терраса
с зонтом и столиками, детский клуб — площадка с горкой и мячом, столовая — тарелка супа с ложкой.
Щит «Здесь будет» вешают на забор стройки; на него игра кладёт значок будущего здания.

Двойная детализация, как у всей графики (sprites.DETAIL = 2).

    python3 art/district_plots.py
"""

import math

from sprites import Canvas, shadowed

STEEL = (198, 206, 220, 255)
STEEL_LO = (128, 140, 162, 255)
DARK = (58, 68, 102, 255)
PINK_LO = (232, 150, 170, 255)
GOLD = (254, 231, 97, 255)
GOLD_LO = (254, 174, 52, 255)


def badge(c, cx, cy, r, ring, fill):
    """Круг-эмблема на кровле: светлый обод и заливка (как крест поликлиники)."""
    c.ellipse(cx, cy, r, r, ring)
    c.ellipse(cx, cy, r - 1.5, r - 1.5, fill)


def gym():
    """Спортзал 30×30: гантель на оранжевом круге."""
    c = Canvas(30, 30)
    badge(c, 15, 15, 14, "w", "o")
    c.ellipse(15, 15, 11, 11, "y")
    c.ellipse(15, 15, 10, 10, "o")
    # Гриф и блины.
    c.rect(7, 14, 16, 3, STEEL)
    c.hline(7, 14, 16, "w")
    for x, h in ((4, 11), (8, 9), (19, 9), (23, 11)):
        c.rect(x, 15 - h // 2, 3, h, "K")
        c.vline(x, 15 - h // 2, h, "g")
    c.save("roof_gym")


def wedding():
    """Свадебный салон 30×30: два золотых кольца и сердце на розовом круге."""
    c = Canvas(30, 30)
    badge(c, 15, 15, 14, "w", "s")
    c.ellipse(15, 15, 11, 11, PINK_LO)
    c.ellipse(15, 15, 10, 10, "s")
    # Сердце сверху.
    c.ellipse(12.5, 9.5, 2.6, 2.6, "R")
    c.ellipse(17.5, 9.5, 2.6, 2.6, "R")
    for y in range(10, 15):
        w = 10 - (y - 10) * 2
        c.hline(15 - w // 2, y, w, "R")
    c.px(12, 8, "w")
    # Кольца внахлёст: правое поверх левого сверху, левое поверх правого снизу — сцеплены.
    def ring(cx, cy, part):
        for y in range(cy - 6, cy + 7):
            for x in range(int(cx) - 6, int(cx) + 7):
                d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
                if 3.4 <= d <= 5.2 and part(y):
                    c.px(x, y, GOLD if d < 4.3 else GOLD_LO)

    ring(11.5, 19, lambda y: True)
    ring(18.5, 19, lambda y: True)
    ring(11.5, 19, lambda y: y >= 19)
    c.save("roof_wedding")


def cowork():
    """Коворкинг 40×28: терраса на крыше — настил, зелень в кадках, зонт и столики с ноутбуками."""
    c = Canvas(40, 28)
    c.rect(1, 1, 38, 26, "t")
    for y in range(2, 26, 3):
        c.hline(2, y, 36, "B")
    c.frame(1, 1, 38, 26, "a")
    # Кадки с зеленью по краю.
    for x in (3, 33):
        for y in (3, 20):
            c.rect(x, y + 2, 4, 3, "b")
            c.ellipse(x + 2, y + 1.5, 2.6, 2.2, "e")
            c.px(x + 1, y, "E")
    # Столики с ноутбуками.
    for x, y in ((11, 14), (24, 9), (24, 19)):
        c.ellipse(x, y, 3.5, 3, "w")
        c.rect(x - 1, y - 1, 3, 2, "K")
        c.px(x, y - 1, "c")
    # Зонт.
    c.ellipse(13, 8, 6, 5, "Y")
    for a in range(0, 360, 60):
        c.line(13, 8, int(13 + 5 * math.cos(math.radians(a))), int(8 + 4 * math.sin(math.radians(a))), "y")
    c.px(13, 8, "o")
    c.outline("k")
    c.save("roof_cowork")


def kids():
    """Детский клуб 40×28: площадка на крыше — мягкое покрытие, горка, песочница и мяч."""
    c = Canvas(40, 28)
    c.rect(1, 1, 38, 26, "U")
    c.rect(2, 2, 36, 24, (64, 176, 226, 255))
    # Классики.
    for i, (x, y) in enumerate(((4, 4), (4, 9), (9, 9), (4, 14))):
        c.frame(x, y, 5, 5, "w")
    # Горка: лесенка и скат.
    c.rect(22, 4, 6, 6, "R")
    c.rect(23, 5, 4, 4, "s")
    for i in range(10):
        c.rect(24 + i, 10 + i, 4, 2, "Y")
    c.rect(20, 5, 2, 4, "W")
    # Песочница.
    c.rect(5, 19, 12, 6, "a")
    c.rect(6, 20, 10, 4, "N")
    c.px(9, 21, "y")
    c.px(12, 22, "R")
    # Мяч.
    c.ellipse(32, 6, 2.6, 2.6, "w")
    c.hline(30, 6, 5, "R")
    c.outline("k")
    c.save("roof_kids")


def canteen():
    """Столовая 30×30: тарелка супа с ложкой на белом круге — видно с высоты, что тут кормят."""
    c = Canvas(30, 30)
    badge(c, 15, 15, 14, "W", "w")
    c.ellipse(14, 16, 10, 8, "W")
    c.ellipse(14, 15.5, 9, 7, "w")
    c.ellipse(14, 15.5, 6.5, 5, "o")
    c.ellipse(13, 14.5, 4, 2.6, "y")
    c.px(11, 15, "e")
    c.px(15, 14, "e")
    c.px(13, 17, "R")
    # Ложка.
    c.line(21, 9, 26, 4, STEEL_LO)
    c.line(22, 9, 27, 4, STEEL)
    c.ellipse(20, 11, 2.4, 1.8, STEEL)
    # Пар.
    for x in (11, 15):
        for y in range(3, 8):
            c.px(x + (y % 2), y, "W")
    c.save("roof_canteen")


def board():
    """Щит «Здесь будет» на заборе стройки 44×34: рама, белое поле под значок, две опоры."""
    c = Canvas(44, 34)
    for x in (8, 34):
        c.rect(x, 22, 3, 11, DARK)
    c.rect(1, 1, 42, 23, "e")
    c.rect(3, 3, 38, 19, "w")
    c.hline(3, 21, 38, "W")
    # Полоски сверху: строительная лента.
    for x in range(1, 43, 4):
        c.rect(x, 1, 2, 2, "Y")
    c.outline("k")
    shadowed(c, 22, 32, 18, 2).save("site_board")


def main():
    gym()
    wedding()
    cowork()
    kids()
    canteen()
    board()


if __name__ == "__main__":
    main()
