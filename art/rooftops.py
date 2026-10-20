"""Крыши и газон: детали, которые видно сверху, когда отдаляешь камеру.

Вентиляционные грибки, баки с водой, спутниковые тарелки, солнечные панели, люки, трубы;
вертолётная площадка бизнес-центра, красный крест поликлиники, бельё на верёвках общежития,
флагшток школы. И газон 64×64 — пятна, кустики травы, клевер, редкие цветы.

Двойная детализация, как у всей графики (sprites.DETAIL = 2).

    python3 art/sprites.py
"""

import math
import random

from sprites import Canvas, shadowed

# Тени и блики кровельных предметов — свои тона, чтобы не тонуть в светлой кровле.
STEEL = (198, 206, 220, 255)
STEEL_HI = (236, 240, 246, 255)
STEEL_LO = (128, 140, 162, 255)
DARK = (58, 68, 102, 255)


def vent():
    """Грибок вытяжки 12×12: шляпка с тенью и ножка."""
    c = Canvas(12, 12)
    c.ellipse(6, 5, 5, 4, STEEL)
    c.ellipse(6, 4, 4, 2.6, STEEL_HI)
    c.hline(2, 7, 8, STEEL_LO)
    c.rect(5, 8, 3, 3, STEEL_LO)
    c.outline("k")
    shadowed(c, 7, 10, 5, 1.5).save("roof_vent")


def tank():
    """Бак с водой на опорах 22×28 (общежития, старые дома)."""
    c = Canvas(22, 28)
    for x in (4, 16):
        c.line(x, 16, x - 2, 26, DARK)
    c.line(4, 22, 16, 22, DARK)
    c.round_rect(2, 3, 18, 15, STEEL, r=3)
    c.rect(4, 4, 3, 13, STEEL_HI)
    c.rect(15, 4, 3, 13, STEEL_LO)
    for y in (7, 12):
        c.hline(2, y, 18, STEEL_LO)
    c.ellipse(11, 3.5, 8, 2, STEEL_HI)
    c.outline("k")
    shadowed(c, 12, 26, 9, 2).save("roof_tank")


def dish():
    """Спутниковая тарелка 16×16."""
    c = Canvas(16, 16)
    c.ellipse(7, 7, 6, 6, STEEL_HI)
    c.ellipse(7.6, 7.6, 4.4, 4.4, STEEL)
    c.line(7, 7, 12, 3, DARK)
    c.px(12, 3, "R")
    c.rect(6, 12, 4, 3, STEEL_LO)
    c.outline("k")
    shadowed(c, 8, 14, 5, 1.5).save("roof_dish")


def solar():
    """Солнечная панель 30×18: синие ячейки, рамка, блик."""
    c = Canvas(30, 18)
    c.rect(1, 1, 28, 16, "W")
    for y in range(2, 16, 5):
        for x in range(2, 28, 7):
            c.rect(x, y, 6, 4, "u")
            c.px(x, y, "U")
    c.line(4, 15, 14, 3, (120, 200, 255, 255))
    c.outline("k")
    shadowed(c, 16, 17, 14, 1.5).save("roof_solar")


def hatch():
    """Люк выхода на крышу 14×12."""
    c = Canvas(14, 12)
    c.rect(1, 1, 12, 9, STEEL_LO)
    c.rect(2, 2, 10, 6, STEEL)
    c.hline(2, 2, 10, STEEL_HI)
    c.rect(6, 4, 2, 2, DARK)
    c.outline("k")
    shadowed(c, 7, 11, 6, 1.2).save("roof_hatch")


def pipe():
    """Труба вдоль крыши 28×7 с хомутами."""
    c = Canvas(28, 7)
    c.rect(0, 1, 28, 4, STEEL)
    c.hline(0, 1, 28, STEEL_HI)
    c.hline(0, 4, 28, STEEL_LO)
    for x in (4, 14, 24):
        c.rect(x, 0, 2, 6, DARK)
    c.save("roof_pipe")


def helipad():
    """Вертолётная площадка бизнес-центра 44×44: круг, «H», огни."""
    c = Canvas(44, 44)
    c.ellipse(22, 22, 21, 21, (74, 86, 112, 255))
    c.ellipse(22, 22, 18, 18, (96, 108, 136, 255))
    c.ellipse(22, 22, 16.5, 16.5, "Y")
    c.ellipse(22, 22, 15, 15, (96, 108, 136, 255))
    for y in range(13, 32):
        c.rect(14, y, 3, 1, "w")
        c.rect(27, y, 3, 1, "w")
    c.rect(14, 21, 16, 3, "w")
    for a in range(0, 360, 45):
        x = 22 + 19.5 * math.cos(math.radians(a))
        y = 22 + 19.5 * math.sin(math.radians(a))
        c.rect(int(x), int(y), 2, 2, "E")
    c.save("roof_helipad")


def cross():
    """Красный крест поликлиники на крыше 30×30 (на белом круге)."""
    c = Canvas(30, 30)
    c.ellipse(15, 15, 14, 14, "w")
    c.ellipse(15, 15, 13, 13, (240, 244, 248, 255))
    c.rect(11, 5, 8, 20, "R")
    c.rect(5, 11, 20, 8, "R")
    c.rect(11, 5, 8, 2, (255, 120, 120, 255))
    c.rect(5, 11, 2, 8, (255, 120, 120, 255))
    c.save("roof_cross")


def laundry():
    """Бельё на верёвках 40×20: простыни, футболки, носки — крыша общежития."""
    c = Canvas(40, 20)
    for x in (1, 38):
        c.rect(x, 1, 2, 18, DARK)
    rnd = random.Random(5)
    colors = ["w", "R", "U", "Y", "E", "P", "s", "c"]
    for y in (4, 12):
        c.hline(2, y, 36, "l")
        x = 4
        while x < 34:
            w = rnd.choice((3, 4, 6))
            h = rnd.choice((3, 5, 6))
            col = rnd.choice(colors)
            c.rect(x, y + 1, w, h, col)
            c.hline(x, y + 1, w, "k")
            x += w + rnd.choice((1, 2))
    c.save("roof_laundry")


def flagpole():
    """Флагшток у школы 16×44: мачта и флаг с гербом района."""
    c = Canvas(16, 44)
    c.rect(2, 2, 2, 40, STEEL_LO)
    c.vline(2, 2, 40, STEEL_HI)
    c.rect(1, 0, 4, 2, "Y")
    c.rect(4, 3, 11, 3, "w")
    c.rect(4, 6, 11, 3, "U")
    c.rect(4, 9, 11, 3, "R")
    c.rect(1, 41, 4, 2, DARK)
    c.outline("k")
    shadowed(c, 3, 42, 4, 1.2).save("flagpole")


def lawn():
    """Газон 64×64: мягкие пятна светлой и тёмной травы, кустики, клевер, редкие цветы.

    Тайл крупнее прежнего (32×32), поэтому повтор почти не заметен, когда отдаляешь камеру.
    """
    n = 64
    c = Canvas(n, n)
    base = (124, 179, 66, 255)
    light = (140, 192, 78, 255)
    lighter = (156, 204, 92, 255)
    dark = (106, 162, 56, 255)
    darker = (94, 149, 53, 255)
    c.rect(0, 0, n, n, base)
    # Плавные пятна: сумма синусов, зацикленная по тайлу.
    for y in range(n):
        for x in range(n):
            v = (
                math.sin(2 * math.pi * x / n * 2 + 1.3)
                + math.sin(2 * math.pi * y / n * 2 + 0.4)
                + 0.7 * math.sin(2 * math.pi * (x + y) / n * 3)
                + 0.5 * math.sin(2 * math.pi * (x - 2 * y) / n * 1)
            )
            if v > 1.55:
                c.px(x, y, light)
            elif v < -1.75:
                c.px(x, y, dark)
    rnd = random.Random(31)
    # Кустики травы: тёмная «галочка» с бликом.
    for _ in range(46):
        x, y = rnd.randrange(n), rnd.randrange(n)
        c.px(x, y, darker)
        c.px((x + 1) % n, (y - 1) % n, dark)
        c.px((x - 1) % n, (y - 1) % n, dark)
        c.px(x, (y - 2) % n, lighter)
    # Светлые травинки.
    for _ in range(60):
        c.px(rnd.randrange(n), rnd.randrange(n), lighter)
    # Клевер — три тёмных точки.
    for _ in range(5):
        x, y = rnd.randrange(n), rnd.randrange(n)
        for dx, dy in ((0, 0), (1, 0), (0, 1)):
            c.px((x + dx) % n, (y + dy) % n, darker)
    # Редкие цветы: белые, жёлтые, сиреневые.
    for col in ((255, 255, 255, 255), (254, 231, 97, 255), (255, 255, 255, 255), (198, 160, 230, 255)):
        x, y = rnd.randrange(1, n - 1), rnd.randrange(1, n - 1)
        c.px(x, y, col)
        c.px(x, y + 1, darker)
    c.save("grass")


def roof():
    """Плоская кровля 64×64 под тинт: мембрана, редкие длинные швы, заплаты, гравий, водосток.

    Раньше швы шли через 16 точек и кровля читалась как кирпичная кладка; теперь полосы шире,
    а мелкий гравий и пятна делают её похожей на настоящую крышу сверху.
    """
    n = 64
    c = Canvas(n, n)
    base = (222, 226, 232, 255)
    c.rect(0, 0, n, n, base)
    # Едва заметные полосы рулонов: шов — тёмная линия с бликом, раз в 32 точки.
    for y in (0, 32):
        c.hline(0, y, n, (196, 202, 212, 255))
        c.hline(0, y + 1, n, (238, 240, 244, 255))
    for x, y0 in ((21, 2), (49, 34)):
        c.vline(x, y0, 30, (204, 208, 218, 255))
    # Гравий и пыль.
    c.speckle(0, 2, n, n - 2, [(208, 212, 220, 255), (232, 234, 238, 255), (200, 204, 214, 255)], 260, 7)
    # Заплата и потёки.
    c.rect(36, 10, 9, 6, (206, 210, 218, 255))
    c.frame(36, 10, 9, 6, (194, 198, 208, 255))
    c.rect(8, 44, 12, 2, (210, 214, 222, 255))
    # Водосток.
    c.ellipse(12.5, 18.5, 2, 1.6, (170, 176, 190, 255))
    c.px(12, 18, (120, 126, 140, 255))
    c.save("roof")


def main():
    roof()
    vent()
    tank()
    dish()
    solar()
    hatch()
    pipe()
    helipad()
    cross()
    laundry()
    flagpole()
    lawn()


if __name__ == "__main__":
    main()
