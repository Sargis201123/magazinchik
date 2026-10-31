"""Благоустройство района (src/game/hood.ts): что покупают на улицу в конце игры.

Новые фонари, клумбы-вазоны, велопарковка, остановка с навесом, роспись на стене, ель на площади,
фонтан у пруда, детская площадка, ящики с цветами на окна соседей, ярмарочные лавки и памятник бабушке.

Двойная детализация, как у всей графики (sprites.DETAIL = 2).

    python3 art/hood.py
"""

from sprites import Canvas, shadowed


def lamp():
    """Чугунный фонарь с двумя плафонами на завитках — наряднее обычного."""
    c = Canvas(24, 60)
    c.rect(11, 12, 3, 44, "K")
    c.vline(11, 12, 44, "g")
    # Основание с ободком и шар на макушке.
    c.rect(8, 53, 9, 4, "K")
    c.hline(8, 53, 9, "g")
    c.rect(10, 48, 5, 5, "K")
    c.ellipse(12.5, 7.5, 2, 2, "K")
    # Завитки к плафонам.
    c.hline(4, 12, 17, "K")
    c.px(4, 11, "K")
    c.px(20, 11, "K")
    c.px(9, 13, "K")
    c.px(15, 13, "K")
    for x in (1, 17):
        c.rect(x, 13, 7, 2, "K")
        c.rect(x + 1, 15, 5, 5, "Y")
        c.vline(x + 1, 15, 5, "y")
        c.hline(x + 1, 19, 5, "y")
        c.rect(x + 2, 20, 3, 1, "K")
    c.outline("k")
    shadowed(c, 12, 56, 7, 2.5).save("hood_lamp")


def planter(winter=False):
    """Каменный вазон с цветами (зимой — еловые лапы под снегом)."""
    c = Canvas(36, 22)
    c.rect(2, 10, 32, 10, "W")
    c.hline(2, 10, 32, "w")
    c.rect(1, 9, 34, 2, "l")
    c.hline(1, 9, 34, "W")
    c.hline(3, 19, 30, "l")
    for x in (9, 18, 27):
        c.vline(x, 12, 6, "l")
    if winter:
        for x in range(3, 33, 5):
            c.ellipse(x + 2, 7, 3, 2.5, "d")
            c.ellipse(x + 2, 6, 2, 1.4, "e")
        c.hline(3, 4, 30, "w")
        c.speckle(3, 4, 30, 3, ["w", "W"], 30, 7)
        c.px(10, 7, "R")
        c.px(24, 6, "R")
    else:
        for x in range(3, 33, 3):
            c.vline(x, 5, 4, "e")
        petals = ["R", "Y", "s", "P", "w", "o"]
        for i, x in enumerate(range(3, 33, 3)):
            ch = petals[i % len(petals)]
            y = 3 + (i % 2)
            c.rect(x - 1, y, 3, 2, ch)
            c.px(x, y + 1, "y" if ch != "Y" else "o")
    c.outline("k")
    shadowed(c, 18, 20, 16, 2.5).save("hood_planter_winter" if winter else "hood_planter")


def bike(c, x, frame):
    """Велосипед сбоку: два колеса, рама, руль и седло."""
    for wx in (x + 3, x + 15):
        c.ellipse(wx + 0.5, 15.5, 4, 4, "K")
        c.ellipse(wx + 0.5, 15.5, 2.6, 2.6, (0, 0, 0, 0))
        c.px(wx, 15, "l")
    c.line(x + 3, 15, x + 8, 9, frame)
    c.line(x + 8, 9, x + 14, 9, frame)
    c.line(x + 14, 9, x + 15, 15, frame)
    c.line(x + 8, 9, x + 9, 15, frame)
    c.line(x + 9, 15, x + 3, 15, frame)
    c.rect(x + 6, 7, 4, 1, "x")
    c.vline(x + 14, 6, 3, "K")
    c.hline(x + 13, 6, 3, "K")


def bikes():
    """Велопарковка: изогнутые стойки и два велосипеда."""
    c = Canvas(48, 24)
    for x in (2, 14, 26, 38):
        c.vline(x, 9, 12, "G")
        c.vline(x + 8, 9, 12, "G")
        c.hline(x + 1, 8, 7, "G")
    bike(c, 1, "R")
    bike(c, 25, "U")
    c.outline("k")
    shadowed(c, 24, 21, 22, 2.5).save("hood_bikes")


def bus():
    """Остановка с навесом: стеклянные стенки, скамейка, табличка «А» и расписание."""
    c = Canvas(72, 56)
    # Задняя стенка — стекло в раме.
    c.rect(6, 14, 52, 30, "c")
    c.rect(7, 15, 50, 28, "U")
    for x in (7, 24, 41):
        c.rect(x + 2, 17, 4, 24, "c")
    for x in (6, 23, 40, 57):
        c.vline(x, 12, 40, "K")
    # Реклама на боковой стенке.
    c.rect(8, 18, 12, 20, "w")
    c.rect(9, 19, 10, 9, "E")
    c.ellipse(14, 23, 3, 3, "Y")
    c.hline(9, 31, 10, "R")
    c.hline(9, 34, 8, "G")
    # Крыша.
    c.rect(2, 7, 60, 5, "e")
    c.hline(2, 7, 60, "E")
    c.hline(2, 11, 60, "d")
    # Скамейка.
    c.rect(26, 36, 28, 3, "B")
    c.hline(26, 36, 28, "n")
    c.vline(28, 39, 9, "K")
    c.vline(51, 39, 9, "K")
    # Знак: столб, круг с «А».
    c.vline(66, 10, 42, "G")
    c.ellipse(66, 8, 5, 5, "Y")
    c.ellipse(66, 8, 3.6, 3.6, "w")
    c.rect(63, 16, 7, 9, "w")
    for y in (18, 20, 22):
        c.hline(64, y, 5, "G")
    c.outline("k")
    # Буква «А» на знаке — поверх контура.
    for dx, dy in ((1, 0), (0, 1), (2, 1), (0, 2), (1, 2), (2, 2), (0, 3), (2, 3)):
        c.px(65 + dx, 6 + dy, "u")
    shadowed(c, 34, 50, 32, 3).save("hood_bus")


def mural():
    """Роспись на стене: солнце, бабушка с караваем, цветы и подпись-лента."""
    c = Canvas(76, 44)
    c.rect(0, 0, 76, 44, "U")
    c.rect(0, 0, 76, 16, "c")
    c.rect(0, 30, 76, 14, "E")
    c.hline(0, 30, 76, "j")
    # Солнце с лучами.
    c.ellipse(14, 11, 7, 7, "Y")
    c.ellipse(13, 10, 4, 4, "w")
    for dx, dy in ((-11, 0), (11, 0), (0, -10), (-8, -7), (8, -7), (-8, 7), (8, 7)):
        c.px(14 + dx, 11 + dy, "y")
    # Бабушка: платок, лицо, кофта, каравай в руках.
    c.ellipse(40, 14, 6, 6, "R")
    c.ellipse(40, 16, 4, 4, "n")
    c.px(38, 15, "k")
    c.px(42, 15, "k")
    c.hline(39, 18, 3, "m")
    c.round_rect(32, 21, 16, 17, "P", r=3)
    c.ellipse(40, 27, 6, 3.5, "y")
    c.ellipse(40, 26, 5, 2, "Y")
    c.hline(37, 27, 6, "o")
    # Цветы по низу.
    for x, ch in ((5, "R"), (12, "Y"), (20, "s"), (55, "w"), (62, "R"), (70, "Y")):
        c.vline(x, 34, 6, "d")
        c.ellipse(x + 0.5, 33.5, 2, 2, ch)
        c.px(x, 33, "y")
    # Лента с надписью — точками.
    c.rect(52, 6, 20, 6, "w")
    c.hline(54, 8, 16, "R")
    c.hline(54, 10, 12, "R")
    c.frame(0, 0, 76, 44, "x")
    c.save("hood_mural")


def fir(dressed=False):
    """Большая ель на площади. Зимой — игрушки, гирлянда и звезда (огоньки зажигает игра)."""
    c = Canvas(52, 84)
    c.rect(23, 70, 6, 10, "x")
    tiers = [(26, 10, 6, 8), (26, 22, 11, 10), (26, 36, 16, 12), (26, 51, 21, 13), (26, 64, 25, 10)]
    for cx, cy, rx, ry in tiers:
        for y in range(int(cy - ry), int(cy + ry)):
            k = (y - (cy - ry)) / (2 * ry)
            half = int(rx * k) + 1
            c.hline(cx - half, y, 2 * half, "d")
            c.hline(cx - half + 1, y, max(1, half - 1), "e")
    # Светлые иголки — только на кроне.
    import random

    rnd = random.Random(3)
    for _ in range(60):
        x, y = rnd.randrange(4, 48), rnd.randrange(6, 70)
        if c.get(x, y)[3]:
            c.px(x, y, "E")
    if dressed:
        balls = [(20, 26, "R"), (31, 30, "Y"), (16, 42, "U"), (34, 44, "R"), (24, 48, "P"), (12, 58, "Y"), (38, 60, "U"), (26, 62, "R"), (8, 68, "P"), (44, 70, "Y")]
        for x, y, ch in balls:
            c.rect(x, y, 2, 2, ch)
            c.px(x, y, "w")
        c.line(14, 34, 38, 40, "y")
        c.line(9, 52, 43, 56, "y")
        c.line(5, 66, 47, 70, "y")
        c.stamp([".Y.", "YYY", ".Y."], 25, 1)
        c.px(26, 0, "Y")
    c.outline("k")
    shadowed(c, 26, 79, 18, 3).save("hood_fir_xmas" if dressed else "hood_fir")


def fountain():
    """Фонтан: каменная чаша, вода, ярус с чашей поменьше и струя."""
    c = Canvas(72, 52)
    c.ellipse(36, 38, 34, 11, "W")
    c.ellipse(36, 37, 31, 9, "w")
    c.ellipse(36, 38, 28, 7.5, "U")
    c.ellipse(36, 37, 25, 6, "c")
    c.rect(4, 38, 64, 6, "W")
    c.ellipse(36, 44, 34, 6, "l")
    c.rect(2, 38, 68, 5, "W")
    c.hline(2, 42, 68, "l")
    # Столбик и верхняя чаша.
    c.rect(33, 18, 6, 18, "W")
    c.vline(33, 18, 18, "w")
    c.ellipse(36, 18, 11, 3.5, "W")
    c.ellipse(36, 17, 9, 2.5, "c")
    # Струя и брызги (в игре по ним бегут блики).
    c.rect(35, 5, 2, 12, "c")
    c.px(35, 4, "w")
    for x, y in ((31, 9), (41, 9), (28, 13), (44, 13), (26, 17), (46, 17)):
        c.px(x, y, "c")
    c.outline("k")
    shadowed(c, 36, 46, 34, 4).save("hood_fountain")


def playground():
    """Детская площадка: горка, качели, песочница, всё на мягком покрытии."""
    c = Canvas(100, 64)
    c.round_rect(2, 30, 96, 32, "s", r=3)
    c.round_rect(4, 32, 92, 28, "R", r=2)
    c.speckle(4, 32, 92, 28, ["s", "m"], 90, 5)
    # Песочница с бортиком.
    c.rect(60, 44, 30, 12, "B")
    c.rect(62, 46, 26, 8, "N")
    c.speckle(62, 46, 26, 8, ["n", "F"], 30, 9)
    c.rect(70, 48, 3, 3, "U")
    c.px(78, 50, "Y")
    # Горка: лесенка, площадка, скат.
    c.vline(8, 14, 34, "U")
    c.vline(14, 14, 34, "U")
    for y in range(18, 46, 5):
        c.hline(8, y, 7, "U")
    c.rect(6, 10, 12, 4, "Y")
    c.line(17, 12, 36, 44, "Y")
    c.line(18, 12, 37, 44, "Y")
    c.line(18, 11, 37, 43, "y")
    # Качели: стойки буквой А и два сиденья.
    c.line(42, 44, 48, 6, "P")
    c.line(54, 44, 48, 6, "P")
    c.line(64, 40, 70, 6, "P")
    c.line(76, 40, 70, 6, "P")
    c.hline(48, 6, 23, "p")
    for x in (53, 64):
        c.vline(x, 7, 18, "G")
        c.vline(x + 4, 7, 18, "G")
        c.rect(x, 25, 5, 2, "x")
    c.outline("k")
    shadowed(c, 50, 60, 48, 3).save("hood_playground")


def flowerbox():
    """Ящик с цветами под окно соседнего дома."""
    c = Canvas(18, 8)
    c.rect(1, 4, 16, 3, "a")
    c.hline(1, 4, 16, "B")
    for i, x in enumerate(range(2, 16, 2)):
        c.vline(x, 2, 2, "e")
        c.px(x, 1, ["R", "Y", "s", "w", "P", "o", "R"][i])
    c.outline("k")
    c.save("hood_flowerbox")


def stall(roof):
    """Ярмарочная лавка: полосатый навес, прилавок с товаром."""
    c = Canvas(44, 44)
    c.vline(3, 10, 30, "x")
    c.vline(40, 10, 30, "x")
    for i in range(10):
        x = 1 + i * 4
        c.rect(x, 4, 4, 8, roof if i % 2 == 0 else "w")
        c.px(x + 1, 12, roof if i % 2 == 0 else "w")
        c.px(x + 2, 12, roof if i % 2 == 0 else "w")
    c.hline(1, 4, 41, "w")
    c.rect(2, 26, 40, 14, "B")
    c.hline(2, 26, 40, "n")
    c.hline(2, 39, 40, "a")
    for x in range(4, 40, 6):
        c.vline(x, 28, 10, "a")
    # Товар: яблоки, банки, караваи.
    for i, x in enumerate(range(5, 39, 5)):
        ch = ["R", "y", "E", "o", "P", "Y", "R"][i % 7]
        c.ellipse(x + 1, 23.5, 2.2, 2.2, ch)
        c.px(x, 22, "w")
    c.outline("k")
    shadowed(c, 22, 41, 20, 2.5).save(f"hood_stall_{roof}")


def statue():
    """Памятник бабушке: бронзовая фигура в платке с караваем на гранитном постаменте."""
    c = Canvas(40, 76)
    # Постамент.
    c.rect(4, 58, 32, 14, "g")
    c.hline(4, 58, 32, "G")
    c.rect(2, 70, 36, 4, "K")
    c.hline(2, 70, 36, "g")
    c.rect(8, 44, 24, 15, "G")
    c.hline(8, 44, 24, "l")
    c.vline(8, 44, 15, "l")
    # Табличка.
    c.rect(12, 49, 16, 6, "y")
    c.hline(13, 51, 14, "a")
    c.hline(14, 53, 10, "a")
    # Бабушка — бронза (a/B/n).
    # Платок с узелком под подбородком, из-под него — лицо.
    c.ellipse(20, 9, 6.5, 6.5, "a")
    c.ellipse(19, 7, 4, 3, "B")
    c.ellipse(20, 11, 3.5, 3, "n")
    c.px(18, 11, "b")
    c.px(22, 11, "b")
    c.hline(19, 13, 3, "b")
    c.rect(18, 15, 4, 2, "a")
    c.px(19, 4, "n")
    c.round_rect(11, 16, 18, 22, "a", r=4)
    c.vline(13, 18, 18, "B")
    c.vline(26, 18, 18, "b")
    # Руки держат каравай.
    c.rect(11, 22, 4, 4, "B")
    c.rect(25, 22, 4, 4, "b")
    c.rect(10, 37, 20, 7, "a")
    c.hline(10, 43, 20, "b")
    # Каравай в руках.
    c.ellipse(20, 24, 7, 3.5, "B")
    c.ellipse(20, 23, 5, 2, "n")
    c.px(17, 23, "N")
    c.outline("k")
    shadowed(c, 20, 73, 18, 3).save("hood_statue")


def main():
    lamp()
    planter()
    planter(winter=True)
    bikes()
    bus()
    mural()
    fir()
    fir(dressed=True)
    fountain()
    playground()
    flowerbox()
    for roof in ("R", "U", "E"):
        stall(roof)
    statue()


if __name__ == "__main__":
    main()
