"""«Бабушкина ферма» (src/farm/FarmScene.ts): грядки, ростки, урожай и лавка у дороги.

Та же палитра Endesga 32 и та же двойная детализация (DETAIL = 2), что у «Магазинчика»: в мире каждая
картинка вдвое меньше своих пикселей. Контур — «k», как у всего остального.

  farm_bed, farm_bed_wet       — грядка 44×28: сухая (светлая земля) и политая (тёмная, с бликами);
  farm_seed                    — только что посаженное: холмик с бороздкой;
  farm_<культура>_1…3          — росток → куст → созрело (морковь, клубника, тыква), низ — у земли;
  farm_item_<культура>         — урожай на полке и в полёте;
  farm_stall                   — лавка у дороги: навес в полоску, стойки, вывеска (надпись пишет сцена);
  farm_shelf                   — ящик-полка лавки (товар раскладывает сцена);
  farm_till                    — столик с весами и денежной шкатулкой (касса);
  farm_can, farm_drop          — лейка (полив) и капля (грядке пора пить);
  farm_fence, farm_house       — штакетник и бабушкин домик за огородом.

Запуск: python3 art/farm.py (и в общем прогоне art/sprites.py).
"""

from sprites import Canvas, shadowed

CROPS = ("carrot", "strawberry", "pumpkin")


def bed(wet):
    """Грядка 44×28: деревянный бортик, земля с тремя бороздами. Политая — темнее, с бликами воды."""
    c = Canvas(44, 28)
    soil, hi, lo = ("x", "b", "k") if wet else ("a", "t", "b")
    # Бортик из досок: сверху светлая кромка, спереди — доска потолще.
    c.rect(1, 3, 42, 22, "B")
    c.hline(1, 3, 42, "n")
    c.rect(1, 21, 42, 5, "a")
    c.hline(1, 21, 42, "B")
    for x in (11, 22, 33):
        c.vline(x, 22, 4, "b")
    # Земля.
    c.rect(4, 5, 36, 16, soil)
    for y in (8, 13, 18):
        c.hline(5, y, 34, lo)
        c.hline(5, y - 1, 34, hi)
    c.speckle(4, 5, 36, 16, [hi, lo], 24, 7 if wet else 3)
    if wet:
        # Блики воды в бороздах.
        for x, y in ((8, 8), (19, 13), (30, 8), (13, 18), (34, 18), (25, 8)):
            c.hline(x, y, 3, "l")
            c.px(x + 1, y, "W")
    c.outline("k")
    c.save("farm_bed_wet" if wet else "farm_bed")


def seed():
    """Посажено: светлый холмик свежей земли, колышек с пакетиком семян и первые зелёные точки."""
    c = Canvas(20, 16)
    c.ellipse(10, 12, 8, 3.4, "t")
    c.hline(4, 10, 12, "n")
    c.hline(5, 13, 10, "a")
    for x in (6, 9, 13):
        c.px(x, 10, "E")
        c.px(x, 9, "e")
    # Колышек с пакетиком.
    c.vline(16, 4, 9, "a")
    c.rect(14, 1, 5, 5, "w")
    c.rect(15, 2, 3, 2, "R")
    c.outline("k")
    c.save("farm_seed")


def carrot(stage):
    """Морковь: перистая ботва; созрела — из земли видны оранжевые плечики."""
    c = Canvas(24, 24)
    base = 22
    tops = {1: [(11, 4), (13, 5)], 2: [(7, 8), (10, 10), (12, 11), (14, 10), (17, 8)], 3: [(6, 9), (9, 11), (12, 12), (15, 11), (18, 9)]}[stage]
    for tx, h in tops:
        # Стебель и перья по бокам.
        top = base - h
        c.line(12, base, tx, top, "e")
        for k in range(1, h, 2):
            px = 12 + (tx - 12) * (h - k) // h
            py = base - (h - k)
            c.px(px - 1, py, "E")
            c.px(px + 1, py, "e")
        c.px(tx, top, "E")
        c.px(tx, top - 1, "E")
    if stage == 3:
        # Плечики морковки и холмик земли.
        c.rect(9, base - 1, 6, 2, "o")
        c.hline(10, base - 1, 4, "y")
        c.ellipse(12, base + 1, 7, 1.5, "a")
    c.outline("k")
    c.save(f"farm_carrot_{stage}")


def strawberry(stage):
    """Клубника: тройные листья; куст в белых цветах; созрела — красные ягоды."""
    c = Canvas(24, 24)
    if stage == 1:
        for cx, cy in ((9, 17), (15, 17), (12, 14)):
            c.ellipse(cx, cy, 2.6, 2.2, "e")
            c.px(cx - 1, cy - 1, "E")
        c.vline(12, 17, 5, "d")
    else:
        for cx, cy in ((6, 15), (18, 15), (12, 10), (8, 10), (16, 10), (12, 16)):
            c.ellipse(cx, cy, 4, 3.2, "e")
            c.ellipse(cx - 1, cy - 1, 2, 1.5, "E")
            c.px(cx, cy + 1, "d")
        for x in (8, 12, 16):
            c.line(12, 22, x, 17, "d")
        if stage == 2:
            for cx, cy in ((7, 8), (17, 9), (12, 13)):
                c.ellipse(cx, cy, 1.8, 1.8, "w")
                c.px(cx, cy, "Y")
        else:
            for cx, cy in ((5, 19), (10, 20), (15, 20), (19, 18), (12, 12)):
                c.ellipse(cx, cy, 2.2, 2.4, "R")
                c.px(cx - 1, cy - 1, "s")
                c.px(cx, cy + 1, "r")
                c.px(cx, cy - 2, "E")
                c.px(cx + 1, cy, "Y")
    c.outline("k")
    c.save(f"farm_strawberry_{stage}")


def pumpkin(stage):
    """Тыква: две семядоли → плеть с большими листьями и жёлтым цветком → большая оранжевая тыква."""
    c = Canvas(28, 26)
    if stage == 1:
        c.vline(14, 18, 6, "e")
        c.ellipse(11, 17, 3.2, 2.2, "e")
        c.ellipse(17, 17, 3.2, 2.2, "e")
        c.px(10, 16, "E")
        c.px(16, 16, "E")
    else:
        # Плеть по земле и листья-«лопухи».
        c.line(3, 22, 25, 21, "d")
        for cx, cy, r in ((7, 14, 5), (20, 13, 5.5), (14, 9, 4.5)):
            c.ellipse(cx, cy, r, r * 0.85, "e")
            c.ellipse(cx - 1, cy - 1, r * 0.55, r * 0.45, "E")
            c.line(int(cx), int(cy), int(cx), int(cy + r * 0.7), "d")
        if stage == 2:
            # Жёлтый цветок.
            c.ellipse(13, 18, 2.6, 2.2, "Y")
            c.px(13, 18, "y")
            c.px(12, 17, "w")
        else:
            # Тыква: долька к дольке, светлые рёбра, хвостик.
            c.ellipse(14, 19, 8.5, 5.6, "o")
            for x in (9, 14, 19):
                c.vline(x, 15, 9, "y")
            c.vline(11, 15, 9, "R")
            c.vline(17, 15, 9, "R")
            c.ellipse(10, 17, 1.6, 1.2, "Y")
            c.rect(13, 12, 2, 3, "d")
            c.px(15, 12, "e")
    c.outline("k")
    c.save(f"farm_pumpkin_{stage}")


def items():
    """Урожай для полки: морковка, ягода клубники, тыква."""
    c = Canvas(10, 12)
    c.line(5, 10, 3, 3, "o")
    for y in range(3, 11):
        w = max(1, (11 - y) // 2)
        c.hline(5 - w // 2 - (10 - y) // 4, y, w + 1, "o")
    c.line(4, 4, 3, 8, "y")
    c.px(4, 2, "e")
    c.px(6, 1, "E")
    c.px(3, 1, "e")
    c.px(5, 0, "E")
    c.outline("k")
    c.save("farm_item_carrot")

    c = Canvas(10, 10)
    c.ellipse(5, 6, 3.6, 3.4, "R")
    c.px(3, 4, "s")
    c.px(4, 5, "s")
    for x, y in ((6, 5), (4, 7), (6, 8), (3, 6)):
        c.px(x, y, "Y")
    c.hline(3, 2, 5, "e")
    c.px(5, 1, "E")
    c.outline("k")
    c.save("farm_item_strawberry")

    c = Canvas(16, 14)
    c.ellipse(8, 8, 6.8, 4.8, "o")
    for x in (5, 8, 11):
        c.vline(x, 5, 7, "y")
    c.vline(6, 5, 7, "R")
    c.vline(10, 5, 7, "R")
    c.px(4, 6, "Y")
    c.rect(7, 1, 2, 3, "d")
    c.px(9, 1, "e")
    c.outline("k")
    c.save("farm_item_pumpkin")


def stall():
    """Лавка у дороги 112×72: четыре стойки, навес в зелёно-кремовую полоску, доска для вывески."""
    c = Canvas(112, 72)
    c.ellipse(56, 68, 52, 4, (24, 20, 37, 60))
    # Задняя стенка из досок.
    c.rect(8, 22, 96, 32, "a")
    for x in range(8, 104, 8):
        c.vline(x, 22, 32, "b")
    c.hline(8, 22, 96, "t")
    # Стойки.
    for x in (6, 102):
        c.rect(x, 18, 4, 50, "B")
        c.vline(x, 18, 50, "n")
        c.vline(x + 3, 18, 50, "b")
    # Навес: полосы и волнистая кромка.
    for x in range(0, 112):
        ch = "E" if (x // 8) % 2 == 0 else "N"
        c.vline(x, 8, 12, ch)
    c.hline(0, 8, 112, "w")
    for x in range(0, 112, 8):
        ch = "E" if (x // 8) % 2 == 0 else "N"
        c.rect(x + 1, 20, 6, 2, ch)
        c.hline(x + 2, 22, 4, ch)
    c.hline(0, 19, 112, "e")
    # Конёк навеса и доска вывески.
    c.rect(30, 0, 52, 10, "B")
    c.hline(30, 0, 52, "n")
    c.rect(32, 2, 48, 6, "N")
    c.hline(32, 7, 48, "t")
    c.outline("k")
    c.save("farm_stall")


def shelf():
    """Ящик-полка лавки 40×22: два яруса на ножках, товар раскладывает сцена."""
    c = Canvas(40, 22)
    c.ellipse(20, 20, 18, 2, (24, 20, 37, 70))
    for x in (3, 35):
        c.rect(x, 12, 3, 9, "a")
    c.rect(1, 4, 38, 9, "B")
    c.hline(1, 4, 38, "n")
    c.rect(3, 6, 34, 4, "b")
    c.hline(1, 12, 38, "a")
    for x in (13, 26):
        c.vline(x, 5, 7, "a")
    c.outline("k")
    c.save("farm_shelf")


def till():
    """Касса 32×24: столик, весы с чашей и деревянная шкатулка для денег."""
    c = Canvas(32, 24)
    c.ellipse(16, 22, 14, 2, (24, 20, 37, 70))
    c.rect(2, 10, 28, 4, "B")
    c.hline(2, 10, 28, "n")
    for x in (4, 26):
        c.rect(x, 14, 2, 8, "a")
    # Весы.
    c.rect(5, 6, 9, 4, "W")
    c.hline(5, 6, 9, "w")
    c.ellipse(9.5, 4.5, 5, 1.6, "l")
    c.hline(6, 4, 7, "W")
    # Шкатулка с монеткой.
    c.rect(17, 4, 11, 6, "x")
    c.hline(17, 4, 11, "b")
    c.rect(21, 6, 3, 2, "Y")
    c.px(21, 6, "w")
    c.outline("k")
    c.save("farm_till")


def can():
    """Лейка 16×14: синяя, с носиком и ручкой."""
    c = Canvas(16, 14)
    c.rect(3, 5, 8, 7, "U")
    c.vline(3, 5, 7, "c")
    c.hline(3, 11, 8, "u")
    c.line(10, 7, 14, 3, "U")
    c.px(15, 2, "W")
    c.px(14, 2, "W")
    c.line(4, 4, 6, 1, "u")
    c.hline(6, 1, 3, "u")
    c.line(9, 1, 10, 4, "u")
    c.outline("k")
    c.save("farm_can")

    c = Canvas(8, 10)
    c.px(4, 1, "U")
    c.rect(3, 2, 3, 2, "U")
    c.ellipse(4, 6, 3, 2.8, "U")
    c.px(3, 5, "w")
    c.px(3, 6, "c")
    c.outline("k")
    c.save("farm_drop")


def fence():
    """Штакетник 32×20: три заострённые доски на двух перекладинах."""
    c = Canvas(32, 20)
    for y in (6, 13):
        c.rect(0, y, 32, 2, "a")
        c.hline(0, y, 32, "t")
    for x in (2, 12, 22):
        c.rect(x, 2, 7, 17, "N")
        c.vline(x, 2, 17, "w")
        c.vline(x + 6, 2, 17, "t")
        c.px(x, 2, ".")
        c.px(x + 6, 2, ".")
        c.hline(x + 1, 1, 5, "N")
        c.hline(x + 2, 0, 3, "N")
    c.outline("k")
    c.save("farm_fence")


def house():
    """Бабушкин домик 96×84: бревенчатый сруб, красная крыша, окошко с наличником и занавеской, труба."""
    c = Canvas(96, 84)
    c.ellipse(48, 79, 46, 4, (24, 20, 37, 60))
    # Сруб.
    c.rect(10, 38, 76, 40, "B")
    for y in range(38, 78, 5):
        c.hline(10, y, 76, "a")
        c.hline(10, y + 1, 76, "n")
    # Труба.
    c.rect(64, 6, 8, 18, "r")
    c.hline(64, 6, 8, "R")
    c.rect(62, 4, 12, 3, "g")
    # Крыша.
    for i in range(30):
        c.hline(48 - 3 - i * 3 // 2 - 4, 8 + i, 2 * (3 + i * 3 // 2 + 4), "R" if i % 6 else "r")
    c.hline(4, 37, 88, "m")
    # Окошко с белым наличником и занавеской.
    c.rect(20, 46, 18, 16, "w")
    c.rect(22, 48, 14, 12, "u")
    c.rect(22, 48, 5, 12, "s")
    c.rect(31, 48, 5, 12, "s")
    c.vline(29, 48, 12, "w")
    c.hline(22, 54, 14, "w")
    c.hline(19, 62, 20, "W")
    # Дверь.
    c.rect(56, 50, 16, 28, "x")
    c.rect(58, 52, 12, 26, "b")
    c.px(68, 64, "Y")
    # Слуховое окошко под коньком.
    c.ellipse(48, 24, 4, 4, "N")
    c.ellipse(48, 24, 2.6, 2.6, "u")
    c.outline("k")
    c.save("farm_house")


def main():
    bed(False)
    bed(True)
    seed()
    for stage in (1, 2, 3):
        carrot(stage)
        strawberry(stage)
        pumpkin(stage)
    items()
    stall()
    shelf()
    till()
    can()
    fence()
    house()


if __name__ == "__main__":
    main()
