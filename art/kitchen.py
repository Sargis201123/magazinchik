"""Кухня во флигеле: плиты трёх моделей (gear.ts, «Плита на кухне»), кастрюля и сковорода на конфорку,
рабочий стол с разделочной доской и нож, витрина-раздача (задник и стекло отдельно — тарелки стоят
между ними), тарелки с блюдами для витрины, корзинка повара с продуктами, ящик с овощами
и кафельный фартук на стену.

Запуск: python3 art/kitchen.py (картинки — в public/assets, как у остальных скриптов)."""

from premium import H, lit
from sprites import Canvas, shadowed

STEEL = H("#c0cbdc")
STEEL_HI = H("#ffffff")
STEEL_LO = H("#8b9bb4")
STEEL_DK = H("#5a6988")
ENAMEL = H("#f4ecd8")
WOOD = H("#b86f50")
WOOD_HI = H("#e4a672")
WOOD_LO = H("#8f563b")
WOOD_DK = H("#733e39")


def burner(c, cx, cy, gas):
    """Конфорка сверху: у газовой — чёрная решётка крестом, у электрической — тёмный блин."""
    c.ellipse(cx, cy, 3.6, 1.6, "k")
    c.ellipse(cx, cy, 2.6, 1.0, "g" if gas else "K")
    if gas:
        c.hline(int(cx) - 3, int(cy), 7, "k")
        c.vline(int(cx), int(cy) - 1, 3, "k")
    else:
        c.px(int(cx) - 1, int(cy), "m")
        c.px(int(cx) + 1, int(cy), "m")


def oven_door(c, x, y, w, h, frame, glass="K"):
    """Дверца духовки со стеклом и ручкой."""
    c.rect(x, y, w, h, frame)
    c.rect(x + 2, y + 3, w - 4, h - 5, glass)
    c.hline(x + 3, y + 4, max(1, (w - 6) // 2), "g")
    c.hline(x + 2, y + 1, w - 4, STEEL_HI)


def stoves():
    """Три модели плиты одного размера 26×30 (конфорки под кастрюли — в одних и тех же точках):
    электроплитка на тумбе, газовая на четыре конфорки и стальная плита шефа с красными ручками."""
    # Электроплитка: тумба в эмали, одна большая конфорка посередине.
    c = Canvas(26, 30)
    c.rect(4, 10, 18, 17, ENAMEL)
    c.vline(4, 10, 17, STEEL_HI)
    c.vline(21, 10, 17, lit(ENAMEL, -0.2))
    c.rect(3, 4, 20, 6, STEEL)
    c.hline(3, 4, 20, STEEL_HI)
    c.hline(3, 9, 20, STEEL_LO)
    burner(c, 13, 7, False)
    c.rect(5, 11, 16, 2, lit(ENAMEL, -0.1))
    c.px(8, 11, "k")
    c.px(11, 11, "k")
    c.px(18, 11, "R")
    oven_door(c, 6, 14, 14, 11, lit(ENAMEL, -0.08))
    c.rect(5, 27, 2, 1, "K")
    c.rect(19, 27, 2, 1, "K")
    c.outline("k")
    shadowed(c, 13, 28, 11, 2).save("stove0")
    # Газовая плита: сталь, четыре конфорки с решётками, четыре ручки.
    c = Canvas(26, 30)
    c.rect(2, 10, 22, 17, STEEL)
    c.vline(2, 10, 17, STEEL_HI)
    c.vline(23, 10, 17, STEEL_LO)
    c.rect(1, 3, 24, 7, STEEL_DK)
    c.hline(1, 3, 24, STEEL)
    for x in (7, 19):
        burner(c, x, 5, True)
        burner(c, x, 8, True)
    c.rect(3, 11, 20, 2, STEEL_LO)
    for x in (5, 9, 17, 21):
        c.px(x, 11, "k")
        c.px(x, 12, "K")
    oven_door(c, 4, 14, 18, 11, STEEL_LO)
    c.rect(3, 27, 2, 1, "K")
    c.rect(21, 27, 2, 1, "K")
    c.outline("k")
    shadowed(c, 13, 28, 12, 2).save("stove1")
    # Плита шефа: тёмная сталь, бортик с лампочками сзади, красные ручки, две духовки.
    c = Canvas(26, 30)
    c.rect(1, 10, 24, 17, STEEL_DK)
    c.vline(1, 10, 17, STEEL_LO)
    c.vline(24, 10, 17, "g")
    c.rect(1, 1, 24, 3, STEEL)
    c.hline(1, 1, 24, STEEL_HI)
    c.px(4, 2, "E")
    c.px(6, 2, "y")
    c.rect(1, 4, 24, 6, "K")
    for x in (7, 19):
        burner(c, x, 5.5, True)
        burner(c, x, 8, True)
    c.rect(2, 11, 22, 2, "g")
    for x in (4, 8, 12, 16, 20):
        c.px(x, 11, "R")
        c.px(x, 12, "r")
    for x in (3, 13):
        oven_door(c, x, 14, 10, 11, STEEL_LO, glass="k")
    c.hline(2, 26, 22, "k")
    c.rect(2, 27, 2, 1, "K")
    c.rect(22, 27, 2, 1, "K")
    c.outline("k")
    shadowed(c, 13, 28, 12, 2).save("stove2")


def pot_and_pan():
    """Кастрюля с крышкой и сковорода (для блинов и сырников) — ставятся на конфорку, пока варится."""
    c = Canvas(12, 10)
    c.rect(1, 4, 10, 5, STEEL)
    c.vline(2, 4, 5, STEEL_HI)
    c.vline(9, 4, 5, STEEL_LO)
    c.hline(1, 8, 10, STEEL_LO)
    c.hline(0, 4, 12, STEEL_DK)
    c.px(0, 5, STEEL_DK)
    c.px(11, 5, STEEL_DK)
    c.ellipse(6, 3, 4.6, 1.5, STEEL_HI)
    c.hline(3, 3, 6, STEEL)
    c.rect(5, 0, 2, 2, "K")
    c.outline("k")
    c.save("kpot")
    c = Canvas(16, 8)
    c.ellipse(6, 4, 5.4, 2.4, "K")
    c.ellipse(6, 3.6, 4.2, 1.6, "g")
    c.ellipse(6, 3.6, 3.2, 1.1, "y")
    c.px(5, 3, "Y")
    c.line(11, 3, 15, 2, WOOD_DK)
    c.px(14, 2, WOOD)
    c.outline("k")
    c.save("kpan")


def table():
    """Рабочий стол повара: разделочная доска с нарезанным, миска и лук; полка внизу."""
    c = Canvas(40, 24)
    c.rect(1, 4, 38, 7, WOOD)
    c.hline(2, 4, 36, WOOD_HI)
    c.rect(1, 11, 38, 3, WOOD_LO)
    c.hline(1, 13, 38, WOOD_DK)
    for x in (2, 35):
        c.rect(x, 14, 3, 8, WOOD_LO)
        c.vline(x, 14, 8, WOOD)
    c.hline(5, 19, 30, WOOD_DK)
    c.hline(5, 18, 30, WOOD_LO)
    # Доска с нарезанным: кружочки моркови и зелень.
    c.rect(6, 5, 16, 5, H("#e8c98e"))
    c.hline(6, 5, 16, H("#f4dcaa"))
    c.frame(5, 4, 18, 7, WOOD_DK)
    for x, ch in ((9, "o"), (11, "o"), (13, "E"), (14, "e"), (16, "E")):
        c.px(x, 7, ch)
    c.px(10, 8, "o")
    c.px(15, 8, "E")
    # Миска и луковица.
    c.ellipse(30, 7, 4.2, 2.2, STEEL_HI)
    c.ellipse(30, 6.6, 3, 1.2, H("#f4ecd8"))
    c.px(29, 6, "y")
    c.px(31, 6, "R")
    c.ellipse(25.5, 7.5, 1.6, 1.4, H("#e8a65a"))
    c.px(25, 6, "e")
    c.outline("k")
    shadowed(c, 20, 22, 18, 2).save("ktable")
    # Нож: лезвие и ручка.
    c = Canvas(10, 4)
    c.hline(1, 1, 5, STEEL_HI)
    c.hline(1, 2, 5, STEEL)
    c.rect(6, 1, 3, 2, WOOD_DK)
    c.outline("k")
    c.save("kknife")


# Витрина-раздача 56×18: одна полка за стеклом, тарелки ставятся между задником и стеклом.
# Низ тарелок — y = 10 (в точках картинки).
SHOWCASE_W, SHOWCASE_H = 56, 18


def showcase():
    """Задник витрины (светлое нутро, полка, деревянная тумба) и стекло отдельно — поверх тарелок."""
    c = Canvas(SHOWCASE_W, SHOWCASE_H)
    inside = H("#f6eedc")
    c.rect(1, 1, 54, 2, STEEL)
    c.hline(1, 1, 54, STEEL_HI)
    c.rect(2, 3, 52, 7, inside)
    c.hline(2, 3, 52, lit(inside, -0.15))
    c.hline(2, 10, 52, STEEL_LO)
    c.vline(1, 3, 8, STEEL_LO)
    c.vline(54, 3, 8, STEEL_LO)
    c.rect(1, 11, 54, 5, WOOD)
    c.hline(1, 11, 54, WOOD_HI)
    for x in range(8, 54, 12):
        c.vline(x, 12, 3, WOOD_LO)
    c.hline(1, 15, 54, WOOD_DK)
    c.outline("k")
    shadowed(c, 28, 17, 27, 1.5).save("kshowcase")
    # Стекло: голубоватое, с косыми бликами; рамка — по краям, чтобы не закрывать тарелки.
    g = Canvas(SHOWCASE_W, SHOWCASE_H)
    g.rect(2, 3, 52, 7, (200, 232, 255, 46))
    for x0, alpha in ((8, 120), (30, 120), (38, 70)):
        for i in range(6):
            g.px(x0 + i, 9 - i, (255, 255, 255, alpha))
    g.hline(2, 3, 52, (255, 255, 255, 140))
    g.save("kshowcase_glass")


def plate(c, food):
    """Тарелка (или миска) 8×5 с едой, в 10×7 вместе с контуром."""
    c.ellipse(5, 5, 4.2, 1.6, STEEL_HI)
    c.hline(2, 6, 6, STEEL)
    food(c)
    c.outline("k")


def dishes():
    """Тарелки для витрины: по одной на каждое блюдо (kitchen.ts, DISHES)."""

    def olivier(c):
        c.ellipse(5, 3.6, 3, 1.8, H("#f4e3a0"))
        c.px(4, 3, "E")
        c.px(6, 4, "o")
        c.px(5, 2, "R")

    def borscht(c):
        c.ellipse(5, 4, 3.6, 1.6, "W")
        c.ellipse(5, 3.8, 2.8, 1.1, "m")
        c.px(4, 3, "r")
        c.px(6, 3, "w")
        c.px(5, 3, "E")

    def pancakes(c):
        for y in (4, 3, 2):
            c.hline(2, y, 6, "y")
        c.hline(3, 1, 4, "Y")
        c.px(7, 2, "R")

    def pelmeni(c):
        c.ellipse(5, 4, 3.6, 1.6, "U")
        for x, y in ((3, 3), (5, 2), (7, 3), (4, 4), (6, 4)):
            c.px(x, y, "w")
        c.px(5, 3, H("#ead4aa"))
        c.px(6, 2, "E")

    def syrniki(c):
        for x in (3, 6):
            c.ellipse(x + 0.5, 3.8, 1.8, 1.1, "y")
            c.px(x, 3, H("#c8803a"))
        c.px(5, 2, "w")
        c.px(5, 3, "w")

    def ukha(c):
        c.ellipse(5, 4, 3.6, 1.6, "W")
        c.ellipse(5, 3.8, 2.8, 1.1, "Y")
        c.px(4, 3, "o")
        c.px(6, 4, "l")
        c.px(7, 3, "E")

    for name, food in (("olivier", olivier), ("borscht", borscht), ("pancakes", pancakes), ("pelmeni", pelmeni), ("syrniki", syrniki), ("ukha", ukha)):
        c = Canvas(10, 8)
        plate(c, food)
        c.save(f"kdish_{name}")


def basket():
    """Корзинка повара: с ней он несёт продукты со склада."""
    c = Canvas(14, 12)
    c.line(3, 6, 6, 1, WOOD_DK)
    c.line(7, 1, 10, 6, WOOD_DK)
    c.hline(6, 1, 2, WOOD_DK)
    c.ellipse(4.5, 5.5, 1.8, 1.4, H("#c8955a"))
    c.px(7, 4, "E")
    c.px(8, 4, "e")
    c.ellipse(9.5, 5.5, 1.6, 1.2, "R")
    c.rect(2, 6, 10, 5, WOOD)
    for x in range(3, 12, 2):
        c.vline(x, 6, 5, WOOD_HI)
    c.hline(2, 8, 10, WOOD_LO)
    c.hline(2, 10, 10, WOOD_DK)
    c.outline("k")
    c.save("kbasket")


def crate():
    """Ящик с овощами в углу кухни: картошка, капуста, морковь."""
    c = Canvas(20, 16)
    c.ellipse(5, 6, 2.4, 1.8, H("#c8955a"))
    c.ellipse(8.5, 5.5, 2.2, 1.7, H("#a47a52"))
    c.ellipse(13, 5, 3.4, 2.8, "E")
    c.line(11, 4, 14, 6, "e")
    c.px(13, 3, H("#98c95a"))
    c.line(15, 6, 18, 4, "o")
    c.px(18, 3, "e")
    c.rect(1, 7, 18, 8, WOOD)
    for y in (8, 11):
        c.hline(1, y, 18, WOOD_LO)
    c.hline(1, 7, 18, WOOD_HI)
    c.vline(1, 7, 8, WOOD_DK)
    c.vline(18, 7, 8, WOOD_DK)
    c.outline("k")
    shadowed(c, 10, 15, 9, 2).save("kcrate")


def tiles():
    """Кафельный фартук на стене кухни: белая плитка 8×8 с затиркой, плитка повторяется."""
    c = Canvas(16, 16)
    tile = H("#eef3f6")
    c.rect(0, 0, 16, 16, tile)
    for i in range(16):
        for x, y in ((i, 0), (0, i), (i, 8), (8, i)):
            c.px(x, y, H("#c9d3dc"))
    for ox, oy in ((0, 0), (8, 0), (0, 8), (8, 8)):
        c.px(ox + 2, oy + 2, STEEL_HI)
        c.px(ox + 3, oy + 2, STEEL_HI)
        c.px(ox + 2, oy + 3, STEEL_HI)
    c.save("ktiles")


def main():
    stoves()
    pot_and_pan()
    table()
    showcase()
    dishes()
    basket()
    crate()
    tiles()


if __name__ == "__main__":
    main()
