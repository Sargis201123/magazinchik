"""Своя марка на полках (src/game/lines.ts): товар четырёх линеек и их уголки.

Товар 10×12, по три вида (как item_* в sprites.py, низ прячется за кромкой полки), и ящик 16×16 для склада:
банка варенья под клетчатой тряпочкой, банка солений (огурцы, помидоры, ассорти), пачка пельменей ручной лепки,
бутылки кваса. На каждой — белая наклейка магазина с красной полоской: «своё».

Уголки (картинка в меню «Развитие» и вещь в мире):
  line_jam      — табурет с медным тазом варенья и банками (во флигеле, у пекарни);
  line_pickles  — дубовая бочка с огурцами и гнётом (у овощей, в зале);
  line_pelmeni  — доска в муке с рядами пельменей и скалкой (на кухне);
  line_kvass    — жёлтая бочка-цистерна «КВАС» на колёсах с краником (на тротуаре у входа, весной и летом).

Запуск: python3 art/brand_lines.py (картинки — в public/assets, как у остальных скриптов).
"""

from premium import H, lit
from sprites import Canvas, shadowed

LABEL = "w"
STRIPE = "R"


def label(c, x, y, w):
    """Наклейка магазина: белая полоска с красной чертой посередине."""
    c.rect(x, y, w, 2, LABEL)
    c.hline(x + 1, y + 1, w - 2, STRIPE)


def jar(c, x, fill, fill_dark, lid, lid_alt, top=2):
    """Банка 8 шириной: крышка-тряпочка в клетку, стекло с содержимым, наклейка."""
    # Тряпочка с бантиком: в клетку двумя цветами.
    for i in range(8):
        c.px(x + i, top, lid if i % 2 == 0 else lid_alt)
        c.px(x + i, top + 1, lid_alt if i % 2 == 0 else lid)
    c.px(x + 3, top - 1, lid)
    c.px(x + 4, top - 1, lid_alt)
    c.hline(x + 1, top + 2, 6, "k")
    c.rect(x, top + 3, 8, 7, fill)
    c.vline(x + 7, top + 3, 7, fill_dark)
    c.hline(x, top + 9, 8, fill_dark)
    # Блик на стекле.
    c.vline(x + 1, top + 3, 3, "w")
    label(c, x + 1, top + 5, 6)


def items_jam():
    variants = [("R", "w"), ("y", "w"), ("E", "w")]
    for i, (lid, alt) in enumerate(variants):
        c = Canvas(10, 12)
        jar(c, 1, "r", "m", lid, alt)
        c.outline("k")
        c.save(f"item_jam_{i}")
        if i == 0:
            c.save("item_jam")


def items_pickles():
    for i, kind in enumerate(("cucumber", "tomato", "mix")):
        c = Canvas(10, 12)
        # Банка с жёлтой крышкой, рассол зеленоватый.
        c.rect(2, 1, 6, 2, "y")
        c.hline(2, 1, 6, "Y")
        c.hline(1, 3, 8, "k")
        c.rect(1, 4, 8, 7, H("#a8d5a0"))
        c.vline(8, 4, 7, H("#7fb27a"))
        c.vline(2, 4, 3, "w")
        if kind in ("cucumber", "mix"):
            for x in (3, 5, 7) if kind == "cucumber" else (3, 7):
                c.vline(x, 4, 6, "e")
                c.px(x, 5, "E")
        if kind in ("tomato", "mix"):
            for cx, cy in ((4, 5), (6, 8)) if kind == "tomato" else ((5, 6),):
                c.rect(cx - 1, cy - 1, 2, 2, "R")
                c.px(cx - 1, cy - 1, "s")
            if kind == "tomato":
                c.px(3, 8, "e")
        label(c, 2, 7, 6)
        c.outline("k")
        c.save(f"item_pickles_{i}")
        if i == 0:
            c.save("item_pickles")


def items_pelmeni():
    for i, band in enumerate(("U", "R", "e")):
        c = Canvas(10, 12)
        # Бумажная пачка с окошком: видно пельмени.
        c.rect(1, 2, 8, 9, "w")
        c.vline(8, 2, 9, "W")
        c.hline(1, 2, 8, band)
        c.hline(1, 3, 8, band)
        c.rect(2, 5, 6, 3, "N")
        for x in (2, 4, 6):
            c.px(x, 5, "w")
            c.px(x + 1, 7, "n")
        label(c, 2, 8, 6)
        c.outline("k")
        c.save(f"item_pelmeni_{i}")
        if i == 0:
            c.save("item_pelmeni")


def bottle(c, x, glass, glass_dark, cap):
    """Бутылка 4 шириной: пробка, горлышко, тёмное стекло, наклейка."""
    c.rect(x + 1, 0, 2, 1, cap)
    c.rect(x + 1, 1, 2, 2, glass)
    c.rect(x, 3, 4, 8, glass)
    c.vline(x + 3, 3, 8, glass_dark)
    c.px(x, 4, "n")
    label(c, x, 6, 4)


def items_kvass():
    for i, caps in enumerate((("R", "R"), ("y", "R"), ("R", "y"))):
        c = Canvas(10, 12)
        bottle(c, 0, "a", "b", caps[0])
        bottle(c, 5, "a", "b", caps[1])
        c.outline("k")
        c.save(f"item_kvass_{i}")
        if i == 0:
            c.save("item_kvass")


def crate(name, stamp):
    """Ящик для склада 16×16: деревянный, с наклейкой «своё» и картинкой товара."""
    c = Canvas(16, 16)
    c.rect(0, 4, 16, 11, "B")
    c.hline(0, 4, 16, "n")
    c.hline(0, 9, 16, "a")
    c.hline(0, 14, 16, "a")
    c.vline(0, 4, 11, "a")
    c.vline(15, 4, 11, "a")
    c.rect(4, 6, 8, 6, LABEL)
    c.hline(4, 11, 8, STRIPE)
    stamp(c)
    c.outline("k")
    c.save(f"crate_{name}")


def crates():
    crate("jam", lambda c: (c.rect(6, 7, 4, 3, "r"), c.hline(6, 7, 4, "R")))
    crate("pickles", lambda c: (c.vline(6, 7, 4, "e"), c.vline(8, 7, 4, "E"), c.px(10, 8, "R")))
    crate("pelmeni", lambda c: (c.rect(6, 8, 2, 2, "N"), c.rect(9, 8, 2, 2, "N"), c.px(6, 8, "w"), c.px(9, 8, "w")))
    crate("kvass", lambda c: (c.rect(6, 7, 2, 4, "a"), c.rect(9, 7, 2, 4, "a"), c.px(6, 7, "R"), c.px(9, 7, "R")))


# ---------------------------------------------------------------- уголки

WOOD = H("#b86f50")
WOOD_HI = H("#e4a672")
WOOD_LO = H("#8f563b")
WOOD_DK = H("#733e39")
COPPER = H("#c8763a")
COPPER_HI = H("#f2a65e")
COPPER_LO = H("#8a4a26")


def station_jam():
    """Табурет 34×40: медный таз с вареньем (пар идёт отдельно, в игре), рядом банки."""
    c = Canvas(34, 40)
    # Табурет.
    c.rect(4, 24, 26, 3, WOOD)
    c.hline(4, 24, 26, WOOD_HI)
    c.hline(4, 26, 26, WOOD_LO)
    for x in (6, 26):
        c.rect(x, 27, 2, 12, WOOD_LO)
        c.vline(x, 27, 12, WOOD_DK)
    c.hline(7, 33, 20, WOOD_LO)
    # Таз: медный, с ручками, внутри варенье.
    c.ellipse(13, 18, 10, 3, COPPER_LO)
    c.rect(3, 18, 21, 5, COPPER)
    c.hline(3, 22, 21, COPPER_LO)
    c.hline(4, 19, 19, COPPER_HI)
    c.ellipse(13, 18, 9, 2, "r")
    c.hline(8, 18, 7, "m")
    c.px(11, 17, "R")
    c.px(16, 18, "R")
    c.rect(0, 18, 3, 2, COPPER_LO)
    c.rect(24, 18, 3, 2, COPPER_LO)
    # Деревянная ложка в тазу.
    c.line(15, 17, 21, 9, WOOD_HI)
    c.px(21, 8, WOOD)
    # Две банки на табурете справа.
    for x, lid in ((22, "R"), (27, "y")):
        c.rect(x, 17, 5, 7, "r")
        c.vline(x + 4, 17, 7, "m")
        c.rect(x, 15, 5, 2, lid)
        c.px(x + 1, 15, "w")
        c.px(x + 3, 16, "w")
        c.hline(x, 20, 5, LABEL)
        c.px(x + 2, 20, STRIPE)
        c.px(x + 1, 18, "w")
    c.outline("k")
    shadowed(c, 17, 38, 14, 2).save("line_jam")


def station_pickles():
    """Дубовая бочка 26×34 с обручами, сверху огурцы в рассоле и гнёт-камень на круге."""
    c = Canvas(26, 34)
    c.round_rect(2, 8, 22, 25, WOOD, r=4)
    for x in (6, 11, 16, 20):
        c.vline(x, 9, 23, WOOD_LO)
    c.vline(3, 10, 21, WOOD_HI)
    for y in (11, 20, 29):
        c.hline(2, y, 22, "g")
        c.hline(2, y + 1, 22, "K")
    # Сверху: рассол, огурцы, деревянный круг и камень.
    c.ellipse(13, 8, 10, 3, H("#7fb27a"))
    for x, y in ((6, 8), (10, 7), (17, 8), (20, 8)):
        c.hline(x, y, 3, "e")
        c.px(x + 1, y, "E")
    c.ellipse(13, 8, 5, 1.5, WOOD_HI)
    c.ellipse(13, 6, 3, 2, "G")
    c.px(12, 5, "l")
    # Наклейка «своё» на боку.
    c.rect(8, 23, 10, 4, LABEL)
    c.hline(9, 25, 8, STRIPE)
    c.outline("k")
    shadowed(c, 13, 32, 11, 2).save("line_pickles")


def station_pelmeni():
    """Доска 30×18 в муке: ряды пельменей, скалка, горка фарша."""
    c = Canvas(30, 18)
    c.round_rect(1, 4, 28, 12, WOOD, r=2)
    c.hline(2, 4, 26, WOOD_HI)
    c.hline(1, 15, 28, WOOD_LO)
    c.speckle(3, 5, 24, 9, [H("#f4ecd8")], 14, 7)
    # Пельмени — полумесяцы: светлое тесто, снизу тень.
    for row, y in enumerate((6, 10)):
        for x in range(3 + row * 2, 20, 4):
            c.rect(x, y, 3, 2, "w")
            c.px(x + 1, y - 1, "w")
            c.hline(x, y + 2, 3, "a")
            c.px(x + 2, y + 1, "N")
    # Горка фарша и скалка.
    c.ellipse(24, 8, 2.5, 1.6, "R")
    c.px(23, 7, "s")
    c.rect(18, 1, 11, 2, WOOD)
    c.hline(18, 1, 11, WOOD_HI)
    c.rect(16, 1, 2, 2, WOOD_DK)
    c.outline("k")
    c.save("line_pelmeni")


def station_kvass():
    """Жёлтая бочка-цистерна 52×38 на двух колёсах, с краником, кружкой и надписью «КВАС»."""
    c = Canvas(52, 38)
    yellow = H("#fee761")
    yellow_lo = H("#feae34")
    yellow_dk = H("#c27c1e")
    # Цистерна — лёжа, с круглыми торцами.
    c.round_rect(4, 6, 44, 20, yellow, r=8)
    c.hline(8, 7, 36, H("#fff6b0"))
    c.hline(8, 24, 36, yellow_lo)
    c.hline(10, 25, 32, yellow_dk)
    c.ellipse(6, 16, 3, 9, yellow_lo)
    c.ellipse(46, 16, 3, 9, yellow_lo)
    # Люк сверху.
    c.rect(22, 3, 8, 3, yellow_lo)
    c.hline(22, 3, 8, yellow)
    # Надпись «КВАС» — красным по жёлтому, пиксельными буквами 3×5.
    glyphs = {
        "К": ["101", "110", "100", "110", "101"],
        "В": ["110", "101", "110", "101", "110"],
        "А": ["010", "101", "111", "101", "101"],
        "С": ["011", "100", "100", "100", "011"],
    }
    x = 15
    for ch in "КВАС":
        for dy, row in enumerate(glyphs[ch]):
            for dx, bit in enumerate(row):
                if bit == "1":
                    c.px(x + dx, 12 + dy, "r")
        x += 5
    # Наклейка магазина рядом с надписью.
    c.rect(36, 12, 6, 5, LABEL)
    c.hline(37, 14, 4, STRIPE)
    # Рама и колёса.
    c.rect(8, 26, 36, 2, "K")
    for wx in (14, 36):
        c.ellipse(wx, 31, 5, 5, "k")
        c.ellipse(wx, 31, 3.5, 3.5, "g")
        c.ellipse(wx, 31, 1.2, 1.2, "l")
    # Дышло слева и подпорка.
    c.line(0, 30, 6, 26, "K")
    c.vline(44, 28, 8, "K")
    # Краник справа внизу и кружка на полочке.
    c.rect(47, 20, 3, 2, "l")
    c.vline(49, 22, 2, "l")
    c.rect(46, 26, 6, 1, WOOD_LO)
    c.rect(47, 23, 3, 3, H("#c28569"))
    c.hline(47, 23, 3, "w")
    c.outline("k")
    shadowed(c, 26, 36, 22, 2).save("line_kvass")


def main():
    items_jam()
    items_pickles()
    items_pelmeni()
    items_kvass()
    crates()
    station_jam()
    station_pickles()
    station_pelmeni()
    station_kvass()


if __name__ == "__main__":
    main()
