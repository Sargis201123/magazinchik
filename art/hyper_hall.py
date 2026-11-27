"""Гипермаркет: низ торгового зала (27.11, слабое место «в гипермаркете нижняя половина зала пустая»).

Между нижним рядом островов и входом в гипермаркете оставалась голая плитка. Здесь - то, чем в большом магазине
обжита зона у входа: уголок аттракционов (автоматы и качалки на резиновом коврике с дорогой - не мягкий пазл
детской зоны фудкорта), сезонная фотозона на круглом подиуме и скамья вокруг кадки с деревцем; выше, через весь
зал к кассам, - главный проход из терракотовой плитки. Товара на них нет - игроки не примут их за полки
(островные витрины с товаром убрали 08.11 именно поэтому). Сцена - src/scenes/hyperHall.ts.

Палитра Endesga 32 (art/sprites.py), контур #181425, свет сверху слева, двойная детализация: в мире всё вдвое меньше.

    python3 art/hyper_hall.py

Картинки (размеры - в пикселях рисунка):
  hyper_kidsmat        128×68  резиновый коврик уголка: синяя резина, дорога кольцом с «зеброй», газон с прудом,
                               жёлтый бортик (лежит на полу: без контура, нижний край - толщина);
  hyper_kidsmat_s       88×56  он же поменьше - когда слева у входа стоит полка своей марки;
  hyper_ride            46×40  машинка-качалка на подставке с монетоприёмником (смотрит вправо);
  hyper_rocket          30×50  ракета-качалка на пружине, подставка с жёлтой полосой и монетоприёмником;
  hyper_claw            30×56  автомат с игрушками: вывеска с лампочками, стекло, клешня, пульт, окошко выдачи;
  hyper_claw_lit        30×56  лампочки вывески и подсветка стекла (мигают сценой; вечером светят);
  hyper_capsule         20×36  автомат с игрушками-капсулами: два ящика с окошками друг на друге;
  hyper_season_<время>  80×63  сезонная фотозона на подиуме с тенью на полу: winter - ёлочка и подарки, spring -
                               клумба с тюльпанами и лейкой, summer - зонт, шезлонг и мяч на песке, autumn - стог,
                               тыквы и ящик яблок; snow - зима без ёлки (снеговик и санки с подарками), когда у входа
                               уже стоит новогодняя ёлка из украшений;
  hyper_bench           68×50  скамья вокруг кадки с деревцем (зона отдыха у касс);
  hyper_aisle          128×48  кусок главного прохода к кассам (без швов слева и справа, сцена тянет его полосой);
  hyper_aisle_l/_r       4×48  торцы прохода.
"""

import random

from premium import H, lit, mix
from sprites import Canvas, shadowed

INK = H("#181425")
WHITE, PALE, STEEL = H("#ffffff"), H("#c0cbdc"), H("#8b9bb4")
METAL, METAL_D, NAVY = H("#5a6988"), H("#3a4466"), H("#262b44")
CREAM, SAND, TAN = H("#ead4aa"), H("#e4a672"), H("#c28569")
WOOD, WOOD_D = H("#b86f50"), H("#733e39")
BARK = H("#8f563b")
RED, RED_D, WINE = H("#e43b44"), H("#a22633"), H("#9e2835")
ORANGE, GOLD, GOLD_L = H("#f77622"), H("#feae34"), H("#fee761")
BLUE, BLUE_D, SKY = H("#0099db"), H("#124e89"), H("#2ce8f5")
GREEN, GREEN_D, GREEN_DD = H("#63c74d"), H("#3e8948"), H("#265c42")
PINK, PURPLE, PLUM = H("#f6757a"), H("#b55088"), H("#68386c")
DUSK = H("#4a3b52")


def finish(c, name, shadow=None, outline=True):
    """Контур #181425 (как у всех спрайтов) и, если нужно, мягкая тень под предметом."""
    if outline:
        c.outline(INK)
    if shadow:
        c = shadowed(c, *shadow)
    c.save(name)


# ---------------------------------------------------------------- уголок аттракционов


def kidsmat(w=128, h=68, name="hyper_kidsmat"):
    """Резиновый коврик уголка аттракционов w×h (в мире вдвое меньше): синяя резина с напечатанной дорогой-кольцом,
    пунктиром посередине и «зеброй» спереди, внутри кольца - газон с прудиком; по краю - жёлтый мягкий бортик (как у
    площадок у входа в большие магазины). Не пазл детской зоны фудкорта. Лежит на полу: без контура, толщину даёт
    тёмный нижний край."""
    m = Canvas(w, h)
    rubber, rubber_l = BLUE_D, lit(BLUE_D, 0.12)
    road, road_l = METAL, lit(METAL, 0.12)
    # Толщина: тёмный низ и правый торец бортика.
    m.round_rect(0, 2, w, h - 2, lit(ORANGE, -0.35), r=5)
    m.round_rect(0, 0, w, h - 2, GOLD, r=5)
    m.hline(5, 0, w - 10, GOLD_L)
    m.vline(0, 5, h - 12, GOLD_L)
    m.hline(5, h - 4, w - 10, ORANGE)
    m.vline(w - 1, 5, h - 12, ORANGE)
    # Резина: тёмно-синяя, с крошкой.
    m.round_rect(3, 3, w - 6, h - 9, rubber, r=3)
    m.hline(5, 3, w - 10, lit(rubber, -0.25))
    m.vline(3, 5, h - 13, lit(rubber, -0.25))
    m.speckle(4, 4, w - 8, h - 11, [rubber_l, lit(rubber, -0.12)], w * h // 20, 7)
    # Дорога кольцом: асфальт со светлой обочиной слева сверху.
    x0, y0, x1, y1, lane = 8, 7, w - 8, h - 12, 10
    m.round_rect(x0, y0, x1 - x0, y1 - y0, road, r=6)
    m.speckle(x0 + 1, y0 + 1, x1 - x0 - 2, y1 - y0 - 2, [road_l, lit(road, -0.1)], w * h // 34, 8)
    # Газон внутри кольца, пруд и пара кустиков.
    ix0, iy0, ix1, iy1 = x0 + lane, y0 + lane, x1 - lane, y1 - lane
    m.round_rect(ix0, iy0, ix1 - ix0, iy1 - iy0, GREEN_D, r=3)
    m.hline(ix0 + 2, iy0, ix1 - ix0 - 4, GREEN)
    m.vline(ix0, iy0 + 2, iy1 - iy0 - 4, GREEN)
    m.speckle(ix0 + 1, iy0 + 1, ix1 - ix0 - 2, iy1 - iy0 - 2, [lit(GREEN_D, 0.12), lit(GREEN_D, -0.12)], (ix1 - ix0) * (iy1 - iy0) // 16, 9)
    pcx, pcy = ix0 + (ix1 - ix0) * 0.68, iy0 + (iy1 - iy0) * 0.55
    m.ellipse(pcx, pcy, (ix1 - ix0) * 0.17, (iy1 - iy0) * 0.26, BLUE)
    m.ellipse(pcx - 1, pcy - 1, (ix1 - ix0) * 0.12, (iy1 - iy0) * 0.16, SKY)
    m.px(int(pcx) - 3, int(pcy) - 2, WHITE)
    for bx, by in ((ix0 + 6, iy0 + 5), (ix0 + 13, iy1 - 6)):
        m.ellipse(bx, by, 3, 2.4, GREEN)
        m.px(bx - 1, by - 1, lit(GREEN, 0.4))
    # Бордюр: светлая кромка вокруг газона и по внешнему краю дороги.
    m.frame(ix0 - 1, iy0 - 1, ix1 - ix0 + 2, iy1 - iy0 + 2, PALE)
    for x in range(x0 + 4, x1 - 4):
        m.px(x, y0, PALE)
        m.px(x, y1 - 1, STEEL)
    for y in range(y0 + 4, y1 - 4):
        m.px(x0, y, PALE)
        m.px(x1 - 1, y, STEEL)
    # Пунктир посередине дороги.
    mid = lane // 2
    for x in range(x0 + 8, x1 - 8):
        if (x // 4) % 2 == 0:
            m.px(x, y0 + mid, WHITE)
            m.px(x, y1 - mid - 1, WHITE)
    for y in range(y0 + 8, y1 - 8):
        if (y // 4) % 2 == 0:
            m.px(x0 + mid, y, WHITE)
            m.px(x1 - mid - 1, y, WHITE)
    # «Зебра» на ближней дороге, слева от середины: белые полосы поперёк, без пунктира под ними.
    zx = x0 + (x1 - x0) // 5
    for k in range(5):
        m.rect(zx + k * 3, y1 - lane + 1, 2, lane - 2, WHITE)
        m.vline(zx + k * 3 + 1, y1 - lane + 1, lane - 2, PALE)
    m.hline(zx + 15, y1 - mid - 1, 2, road)
    m.save(name)


def ride():
    """Машинка-качалка 46×40 (смотрит вправо): пухлый красный кабриолет с глазами-фарами и улыбкой на синей подставке,
    синее сиденье с подголовником и рулём; сзади - жёлтая стойка с монетоприёмником и красной кнопкой."""
    c = Canvas(46, 40)
    # Подставка: овальная платформа с жёлтой полосой и тёмным цоколем.
    c.round_rect(1, 31, 44, 7, BLUE, r=3)
    c.hline(3, 31, 40, lit(BLUE, 0.4))
    c.hline(2, 34, 42, GOLD_L)
    c.hline(2, 35, 42, GOLD)
    c.round_rect(2, 36, 42, 3, BLUE_D, r=1)
    # Стойка монетоприёмника сзади (слева): жёлтый ящик со звездой, щель для монеты, красная кнопка.
    c.round_rect(2, 7, 9, 6, RED, r=1)
    c.hline(3, 7, 7, lit(RED, 0.4))
    c.stamp(["..Y..", ".YYY.", "..Y.."], 4, 8)
    c.rect(3, 13, 7, 19, GOLD)
    c.vline(3, 13, 19, GOLD_L)
    c.vline(9, 14, 18, ORANGE)
    c.vline(6, 16, 3, INK)
    c.rect(5, 22, 3, 3, RED)
    c.px(5, 22, lit(RED, 0.45))
    # Колёса - крупные, низом на подставке.
    for wx in (18, 37):
        c.ellipse(wx, 30, 4.6, 4, NAVY)
        c.ellipse(wx, 30, 2, 1.8, STEEL)
        c.px(int(wx) - 1, 29, PALE)
    # Корпус: пухлый, круглый нос справа, крылья над колёсами.
    c.round_rect(12, 17, 32, 11, RED, r=4)
    c.round_rect(12, 15, 12, 6, RED, r=2)
    c.round_rect(28, 18, 16, 6, RED, r=3)
    for wx in (18, 37):
        c.ellipse(wx, 25.5, 6, 3, RED)
    # Свет сверху слева: светлая кромка, низ и правый бок темнее.
    c.hline(14, 15, 8, PINK)
    c.hline(30, 18, 11, PINK)
    c.px(13, 16, PINK)
    c.hline(13, 27, 30, RED_D)
    c.vline(43, 21, 5, RED_D)
    # Белая полоса по борту.
    c.hline(14, 23, 26, WHITE)
    c.hline(14, 24, 26, lit(RED, 0.2))
    # Сиденье с подголовником и руль, лобовое стекло.
    c.round_rect(15, 11, 5, 6, BLUE, r=1)
    c.vline(15, 12, 4, SKY)
    c.rect(15, 16, 9, 2, BLUE_D)
    c.line(24, 16, 26, 13, NAVY)
    c.ellipse(26, 13, 1.6, 1.2, NAVY)
    c.line(28, 17, 30, 11, SKY)
    c.line(29, 17, 31, 11, lit(SKY, 0.45))
    c.px(30, 11, WHITE)
    # Глаза-фары на капоте и улыбка на бампере.
    for ex in (35, 40):
        c.ellipse(ex, 19.5, 2.2, 2.2, WHITE)
        c.px(ex, 20, NAVY)
        c.px(ex + (1 if ex > 36 else 0), 19, NAVY)
    c.px(34, 18, WHITE)
    c.hline(37, 25, 5, WINE)
    c.px(36, 24, WINE)
    c.px(42, 24, WINE)
    finish(c, "hyper_ride", (23, 38, 21, 2))


CLAW_W, CLAW_H = 30, 56


def claw():
    """Автомат с игрушками 30×56: фиолетовый корпус, вывеска с лампочками, стекло с горкой игрушек и клешнёй,
    пульт с джойстиком и кнопкой, окошко выдачи. Второй слой - лампочки и подсветка стекла (hyper_claw_lit)."""
    c = Canvas(CLAW_W, CLAW_H)
    # Вывеска: скруглённая шапка с жёлтым звёздным бейджем и лампочками по краю.
    c.round_rect(1, 0, 28, 9, PURPLE, r=2)
    c.hline(3, 0, 24, lit(PURPLE, 0.4))
    c.hline(2, 8, 26, PLUM)
    for x in range(3, 27, 3):
        c.px(x, 1, GOLD_L)
        c.px(x + 1, 7, GOLD_L)
    star = ["..Y..", ".YYY.", "YYYYY", ".Y.Y."]
    c.stamp(star, 12, 2)
    c.px(14, 2, "w")
    # Стёкла: рама, тёмная глубина, игрушки горкой, клешня на тросике.
    c.rect(1, 9, 28, 24, PURPLE)
    c.vline(1, 9, 24, lit(PURPLE, 0.35))
    c.vline(28, 9, 24, PLUM)
    c.rect(3, 10, 24, 21, NAVY)
    c.rect(3, 10, 24, 3, METAL_D)
    # Рельс и каретка клешни.
    c.hline(3, 12, 24, STEEL)
    c.rect(15, 12, 4, 2, PALE)
    c.vline(17, 14, 5, PALE)
    c.rect(15, 19, 5, 1, STEEL)
    c.px(15, 20, STEEL)
    c.px(19, 20, STEEL)
    c.px(14, 21, METAL)
    c.px(20, 21, METAL)
    # Горка игрушек: мишка, утёнок, зайка, мячик, кит - выпуклые, со светлым верхом.
    toys = [
        (6, 26, 3.4, 3.0, TAN),
        (11, 27, 3.2, 2.8, GOLD_L),
        (16, 26, 3.0, 2.8, PINK),
        (21, 27, 3.4, 2.8, SKY),
        (25, 28, 2.4, 2.4, GREEN),
        (9, 23, 2.6, 2.4, BLUE),
        (19, 23, 2.6, 2.4, GOLD_L),
        (13, 22, 2.6, 2.4, PURPLE),
    ]
    for tx, ty, rx, ry, tone in toys:
        c.ellipse(tx, ty, rx, ry, tone)
        c.px(int(tx) - 1, int(ty) - 1, lit(tone, 0.45))
        c.px(int(tx) + 1, int(ty) + 1, lit(tone, -0.25))
    # Мордочки: ушки у мишки и зайки, глазки, клюв утёнка.
    c.px(4, 23, TAN)
    c.px(8, 23, TAN)
    c.px(5, 26, INK)
    c.px(7, 26, INK)
    c.vline(15, 22, 2, PINK)
    c.vline(17, 22, 2, PINK)
    c.px(16, 26, INK)
    c.px(11, 27, INK)
    c.px(13, 27, ORANGE)
    c.rect(3, 29, 24, 2, METAL_D)
    # Блик на стекле: короткие косые штрихи у левого верхнего угла.
    for k in range(3):
        c.px(4 + k, 16 - k, lit(NAVY, 0.6))
        c.px(4 + k, 19 - k, lit(NAVY, 0.4))
    # Пульт: выступающая светлая полка, джойстик с красным шариком, жёлтая кнопка, щель для монет.
    c.rect(0, 33, 30, 5, PALE)
    c.hline(0, 33, 30, WHITE)
    c.hline(0, 37, 30, STEEL)
    c.vline(8, 32, 3, NAVY)
    c.ellipse(8, 31.5, 1.8, 1.6, RED)
    c.px(7, 31, lit(RED, 0.5))
    c.ellipse(20, 35, 2, 1.2, GOLD)
    c.px(19, 34, GOLD_L)
    c.rect(24, 34, 3, 2, METAL_D)
    c.px(25, 34, INK)
    # Нижний шкаф: фиолетовый, окошко выдачи с откидной дверцей, наклейка-сердечко.
    c.rect(1, 38, 28, 16, PURPLE)
    c.vline(1, 38, 16, lit(PURPLE, 0.35))
    c.vline(28, 38, 16, PLUM)
    c.hline(1, 53, 28, PLUM)
    c.rect(4, 41, 10, 8, NAVY)
    c.rect(4, 41, 10, 2, METAL)
    c.hline(4, 41, 10, STEEL)
    c.rect(17, 42, 8, 6, PINK)
    heart = [".R.R.", "RRRRR", ".RRR.", "..R.."]
    c.stamp(heart, 19, 43)
    c.px(17, 42, lit(PINK, 0.4))
    c.rect(2, 54, 26, 2, NAVY)
    finish(c, "hyper_claw", (15, 54, 14, 2))

    # Лампочки вывески и подсветка стекла: светятся вечером, мигают по очереди (сцена).
    g = Canvas(CLAW_W, CLAW_H)
    for x in range(3, 27, 3):
        g.px(x, 1, (255, 248, 200, 255))
        g.px(x + 1, 7, (255, 248, 200, 255))
    g.rect(4, 11, 22, 8, (150, 120, 255, 60))
    g.rect(4, 19, 22, 10, (150, 120, 255, 34))
    g.save("hyper_claw_lit")


def capsule():
    """Автомат с игрушками-капсулами 20×36: два ящика друг на друге (как у выходов больших магазинов), в каждом -
    окошко с капсулами, серебряная ручка-монетник и лоток; сверху цветная табличка. Не круглый, как «жвачка» из
    украшений (gumball), - другой предмет."""
    c = Canvas(20, 36)
    for top, head in ((0, PINK), (15, GOLD)):
        c.rect(1, top, 18, 15, BLUE)
        c.vline(1, top, 15, lit(BLUE, 0.35))
        c.vline(18, top + 1, 14, BLUE_D)
        c.rect(2, top + 1, 16, 3, head)
        c.hline(2, top + 1, 16, lit(head, 0.4))
        # Окошко с капсулами: половинки двух цветов, горкой.
        c.rect(3, top + 5, 8, 7, H("#d8f4ff"))
        rnd = random.Random(80 + top)
        for k in range(7):
            x, y = 3 + (k * 3) % 7, top + 7 + (k * 5) % 4
            tone = (RED, GOLD_L, GREEN, PURPLE, ORANGE, SKY, PINK)[k]
            c.px(x, y, tone)
            c.px(x + 1, y, WHITE)
            c.px(x, y + 1, lit(tone, -0.2))
            c.px(x + 1, y + 1, tone)
        c.px(3, top + 5, WHITE)
        c.px(4, top + 5, WHITE)
        # Ручка-монетник и лоток.
        c.ellipse(15, top + 8, 2.4, 2.4, PALE)
        c.hline(14, top + 8, 3, METAL_D)
        c.px(14, top + 7, WHITE)
        c.rect(13, top + 11, 4, 2, NAVY)
        c.hline(1, top + 14, 18, BLUE_D)
    c.rect(2, 30, 16, 4, METAL)
    c.hline(2, 30, 16, STEEL)
    c.rect(3, 34, 3, 2, NAVY)
    c.rect(14, 34, 3, 2, NAVY)
    finish(c, "hyper_capsule", (10, 34, 9, 2))


def rocket():
    """Ракета-качалка 30×50 на пружине: белый корпус с красным носом и красными крыльями, круглый иллюминатор,
    сопло снизу; пружина на круглой синей подставке с жёлтой полосой (как у машинки) и жёлтым монетоприёмником."""
    c = Canvas(30, 50)
    # Подставка: овал с жёлтой полосой и тёмным цоколем.
    c.round_rect(1, 42, 28, 6, BLUE, r=3)
    c.hline(3, 42, 24, lit(BLUE, 0.4))
    c.hline(2, 45, 26, GOLD)
    c.hline(3, 44, 24, GOLD_L)
    c.round_rect(2, 46, 26, 3, BLUE_D, r=1)
    # Пружина: витки серебром, свет слева.
    for k, y in enumerate(range(36, 43, 2)):
        c.hline(12, y, 7, PALE if k % 2 == 0 else STEEL)
        c.px(12, y, WHITE)
        c.px(18, y, METAL)
        c.hline(13, y + 1, 5, METAL_D)
    # Монетоприёмник на подставке слева спереди.
    c.rect(3, 37, 6, 6, GOLD)
    c.vline(3, 37, 6, GOLD_L)
    c.vline(8, 38, 5, ORANGE)
    c.vline(5, 38, 2, INK)
    c.px(6, 41, RED)
    # Крылья: красные, по бокам низа корпуса.
    for side in (-1, 1):
        for k in range(8):
            x = 15 + side * (5 + k // 2)
            c.vline(x, 26 + k, 9 - k // 2, RED if side < 0 else RED_D)
            if side > 0:
                c.vline(x + 1, 26 + k, 9 - k // 2, RED_D)
    # Корпус: белый, справа тень, сверху красный нос.
    c.round_rect(10, 8, 11, 27, WHITE, r=3)
    c.vline(19, 10, 24, PALE)
    c.vline(20, 11, 22, STEEL)
    for k in range(8):
        half = (k + 2) // 2
        c.hline(15 - half, 1 + k, half * 2 + 1, RED)
        c.px(15 + half, 1 + k, RED_D)
    c.px(15, 0, RED)
    c.hline(11, 8, 9, RED)
    c.hline(11, 9, 9, RED_D)
    c.px(13, 3, lit(RED, 0.45))
    c.px(12, 5, lit(RED, 0.45))
    # Иллюминатор с бликом.
    c.ellipse(15.5, 16, 3.6, 3.6, STEEL)
    c.ellipse(15.5, 16, 2.6, 2.6, SKY)
    c.px(14, 15, WHITE)
    c.px(15, 14, WHITE)
    c.px(17, 17, BLUE)
    # Полоса и сопло.
    c.hline(10, 25, 11, RED)
    c.hline(10, 26, 11, RED_D)
    c.rect(12, 34, 7, 2, METAL)
    c.hline(12, 34, 7, STEEL)
    c.px(11, 13, WHITE)
    c.vline(11, 12, 12, WHITE)
    finish(c, "hyper_rocket", (15, 47, 13, 2))


# ---------------------------------------------------------------- сезонная фотозона

SEASON_W, SEASON_H = 76, 63
# Низ подиума (без контура) - строка 59: ниже - контур и тень на полу.
PODIUM_BASE = 60
# Готовая картинка шире рисунка на 2 точки с каждой стороны: тень уходит вправо-вниз (свет сверху слева).
SEASON_OUT_W = SEASON_W + 4


def finish_season(c, name):
    """Контур, как у всех спрайтов, и мягкая тень подиума на полу: сдвинута вправо и вниз, видна узким серпом."""
    c.outline(INK)
    out = Canvas(SEASON_OUT_W, SEASON_H)
    out.ellipse(SEASON_OUT_W / 2 + 2, PODIUM_BASE - 2, 37, 5, (24, 20, 37, 70))
    out.img.alpha_composite(c.img, (2, 0))
    out.save(name)


def podium(c, top, edge, skirt):
    """Круглый низкий подиум (низ картинки): верх-тарелка top, кант edge, бок skirt с полосой."""
    cx, cy = SEASON_W / 2, PODIUM_BASE - 11
    c.ellipse(cx, cy + 4, 36, 7, lit(skirt, -0.25))
    c.rect(2, int(cy), SEASON_W - 4, 4, skirt)
    c.ellipse(cx, cy + 3, 36, 6.6, skirt)
    c.hline(4, int(cy) + 3, SEASON_W - 8, lit(skirt, 0.3))
    c.ellipse(cx, cy, 36, 8, edge)
    c.ellipse(cx, cy - 0.5, 34.5, 7, top)
    # Светлый край тарелки слева сверху.
    for x in range(10, 34):
        y = int(cy - 7.6 * (1 - ((x - cx) / 36) ** 2) ** 0.5)
        c.px(x, y + 1, lit(top, 0.35))


def season_winter():
    """Зима: заснеженный подиум, ёлочка с огоньками и звездой, гора подарков справа, снеговичок слева."""
    c = Canvas(SEASON_W, SEASON_H)
    podium(c, WHITE, PALE, BLUE)
    rnd = random.Random(31)
    for _ in range(14):
        x, y = rnd.randrange(8, 68), rnd.randrange(44, 52)
        if c.get(x, y)[:3] == WHITE[:3]:
            c.px(x, y, mix(PALE, WHITE, 0.5))
    # Ёлка ярусами (свет слева): тёмная тень справа, светлые ветки слева.
    tx = 34
    for k, (y0, half) in enumerate(((6, 6), (13, 9), (20, 12), (28, 15))):
        for dy in range(9):
            hw = round(half * (dy + 2) / 10)
            for x in range(tx - hw, tx + hw + 1):
                tone = GREEN_D if x <= tx else GREEN_DD
                if x - (tx - hw) < 2:
                    tone = GREEN
                c.px(x, y0 + dy, tone)
        c.hline(tx - half + 1, y0 + 9, half * 2 - 1, GREEN_DD)
    c.rect(tx - 2, 38, 5, 5, BARK)
    c.vline(tx - 2, 38, 5, TAN)
    # Гирлянда: огоньки по ярусам.
    lights = [(30, 12, RED), (37, 13, GOLD_L), (28, 19, SKY), (35, 21, RED), (41, 20, GOLD_L), (26, 27, GOLD_L), (32, 29, SKY),
              (39, 28, RED), (45, 30, SKY), (24, 35, RED), (30, 36, GOLD_L), (37, 36, SKY), (44, 35, GOLD_L)]
    for x, y, tone in lights:
        if c.get(x, y)[3]:
            c.px(x, y, tone)
    # Звезда на макушке.
    c.stamp(["..Y..", "YYYYY", ".YYY.", "Y...Y"], tx - 2, 1)
    c.px(tx, 2, "w")
    # Подарки справа: большой красный, синий на нём, маленький зелёный.
    for x, y, bw, bh, box, rib in ((50, 34, 13, 11, RED, GOLD_L), (53, 26, 9, 8, BLUE, WHITE), (63, 38, 8, 8, GREEN, RED)):
        c.rect(x, y, bw, bh, box)
        c.hline(x, y, bw, lit(box, 0.35))
        c.vline(x + bw - 1, y + 1, bh - 1, lit(box, -0.3))
        c.vline(x + bw // 2, y, bh, rib)
        c.hline(x, y + bh // 2, bw, rib)
        c.px(x + bw // 2 - 1, y - 1, rib)
        c.px(x + bw // 2 + 1, y - 1, rib)
    # Снеговичок слева.
    c.ellipse(14, 40, 5.5, 5, WHITE)
    c.ellipse(14, 31, 4, 3.8, WHITE)
    c.px(12, 30, INK)
    c.px(15, 30, INK)
    c.px(16, 31, ORANGE)
    c.px(17, 31, ORANGE)
    c.hline(11, 34, 7, RED)
    c.px(17, 35, RED)
    c.px(13, 39, INK)
    c.px(13, 42, INK)
    for x in range(10, 14):
        c.px(x, 37 + (x - 10) // 3, PALE)
    c.rect(11, 25, 7, 3, NAVY)
    c.hline(10, 27, 9, NAVY)
    finish_season(c, "hyper_season_winter")


def season_snow():
    """Зима без ёлки (у входа уже стоит новогодняя ёлка из украшений): большой снеговик в шляпе-ведре, два
    леденца-трости в снегу и деревянные санки с горкой подарков."""
    c = Canvas(SEASON_W, SEASON_H)
    podium(c, WHITE, PALE, BLUE)
    rnd = random.Random(33)
    for _ in range(14):
        x, y = rnd.randrange(8, 68), rnd.randrange(44, 52)
        if c.get(x, y)[:3] == WHITE[:3]:
            c.px(x, y, mix(PALE, WHITE, 0.5))
    # Леденцы-трости сзади: красно-белые крючки.
    for cx0, top in ((40, 24), (7, 28)):
        for y in range(top + 3, 46):
            c.px(cx0, y, RED if (y // 2) % 2 else WHITE)
            c.px(cx0 + 1, y, RED_D if (y // 2) % 2 else PALE)
        for dx, dy, tone in ((0, 2, WHITE), (0, 1, RED), (1, 0, WHITE), (2, 0, RED), (3, 0, WHITE), (4, 1, RED), (4, 2, WHITE), (4, 3, RED)):
            c.px(cx0 + dx, top + dy, tone)
    # Снеговик: три кома (свет слева - справа тень), шляпа-ведро, нос-морковка, шарф, руки-веточки.
    sx = 27
    for cy0, r in ((41, 8.5), (29, 6.4), (19, 4.8)):
        c.ellipse(sx, cy0, r, r * 0.92, PALE)
        c.ellipse(sx - 0.8, cy0 - 0.8, r - 1.1, r * 0.92 - 1.1, WHITE)
    c.px(sx - 3, 37, PALE)
    c.px(sx + 4, 44, PALE)
    c.px(sx - 2, 17, INK)
    c.px(sx + 1, 17, INK)
    c.hline(sx + 1, 19, 4, ORANGE)
    c.px(sx + 1, 20, lit(ORANGE, -0.25))
    for y in (27, 30, 38, 42):
        c.px(sx, y, INK)
    c.hline(sx - 5, 23, 11, RED)
    c.hline(sx - 4, 24, 9, RED_D)
    c.rect(sx + 3, 24, 2, 5, RED)
    c.px(sx + 4, 28, RED_D)
    c.rect(sx - 4, 10, 8, 5, BLUE)
    c.vline(sx - 4, 10, 5, lit(BLUE, 0.4))
    c.vline(sx + 3, 10, 5, BLUE_D)
    c.hline(sx - 5, 15, 10, BLUE_D)
    c.line(sx - 6, 28, sx - 12, 22, BARK)
    c.px(sx - 12, 21, BARK)
    c.px(sx - 13, 23, BARK)
    c.line(sx + 6, 29, sx + 10, 25, BARK)
    c.px(sx + 11, 24, BARK)
    c.px(sx + 9, 24, BARK)
    # Санки справа: деревянные, полозья загнуты спереди, на них горка подарков.
    c.hline(46, 47, 22, WOOD_D)
    c.px(68, 46, WOOD_D)
    c.px(69, 45, WOOD_D)
    c.px(69, 44, WOOD_D)
    c.rect(47, 42, 20, 3, WOOD)
    c.hline(47, 42, 20, SAND)
    c.hline(47, 44, 20, BARK)
    for lx in (49, 64):
        c.vline(lx, 45, 2, BARK)
    for x, y, bw, bh, box, rib in ((48, 32, 10, 10, RED, GOLD_L), (58, 34, 8, 8, GREEN, WHITE), (51, 25, 8, 7, BLUE, GOLD_L), (59, 29, 6, 5, PURPLE, WHITE)):
        c.rect(x, y, bw, bh, box)
        c.hline(x, y, bw, lit(box, 0.35))
        c.vline(x + bw - 1, y + 1, bh - 1, lit(box, -0.3))
        c.vline(x + bw // 2, y, bh, rib)
        c.hline(x, y + bh // 2, bw, rib)
        c.px(x + bw // 2 - 1, y - 1, rib)
        c.px(x + bw // 2 + 1, y - 1, rib)
    finish_season(c, "hyper_season_snow")


def season_spring():
    """Весна: подиум-клумба с землёй, ряды тюльпанов, белый заборчик спереди, лейка и скворечник на шесте."""
    c = Canvas(SEASON_W, SEASON_H)
    podium(c, BARK, WOOD_D, GREEN_D)
    rnd = random.Random(41)
    for _ in range(26):
        x, y = rnd.randrange(6, 70), rnd.randrange(43, 54)
        if c.get(x, y)[:3] == BARK[:3]:
            c.px(x, y, rnd.choice([WOOD_D, TAN]))
    # Скворечник на шесте сзади слева.
    c.vline(16, 14, 30, WOOD_D)
    c.vline(15, 14, 30, BARK)
    c.rect(10, 6, 12, 10, WOOD)
    c.vline(10, 6, 10, SAND)
    c.vline(21, 7, 9, BARK)
    for k in range(7):
        c.hline(9 + k, 6 - k, 14 - 2 * k, RED if k else RED_D)
    c.ellipse(16, 11, 1.8, 1.8, INK)
    c.px(16, 14, WOOD_D)
    # Тюльпаны: стебли, листья, бутоны трёх цветов рядами (задние выше).
    rows = [(41, (22, 28, 34, 40, 46, 52, 58)), (46, (19, 25, 31, 37, 43, 49, 55, 61)), (51, (24, 30, 36, 42, 48, 54))]
    tones = [RED, GOLD_L, PINK, PURPLE, ORANGE]
    k = 0
    for base, xs in rows:
        for x in xs:
            stem = 8 if base == 41 else 7 if base == 46 else 6
            c.vline(x, base - stem, stem, GREEN_D)
            c.px(x - 1, base - 2, GREEN)
            c.px(x + 1, base - 3, GREEN_D)
            tone = tones[k % len(tones)]
            k += 1
            top = base - stem - 3
            c.rect(x - 1, top, 3, 3, tone)
            c.px(x - 1, top - 1, tone)
            c.px(x + 1, top - 1, tone)
            c.px(x - 1, top, lit(tone, 0.45))
            c.px(x + 1, top + 2, lit(tone, -0.3))
    # Белый заборчик по переднему краю.
    for x in range(8, 70, 5):
        dy = round(3 * ((x - 38) / 34) ** 2)
        c.rect(x, 48 + dy - 2, 2, 6, WHITE)
        c.px(x, 48 + dy - 3, WHITE)
    for x in range(8, 70):
        dy = round(3 * ((x - 38) / 34) ** 2)
        c.px(x, 50 + dy - 1, PALE)
    # Лейка - на краю подиума справа спереди, перед заборчиком: дно на кромке, носик к тюльпанам.
    c.rect(60, 47, 8, 7, SKY)
    c.hline(60, 47, 8, lit(SKY, 0.5))
    c.vline(60, 48, 6, lit(SKY, 0.3))
    c.vline(67, 48, 6, BLUE)
    c.hline(60, 53, 8, BLUE)
    c.line(59, 49, 55, 45, BLUE)
    c.px(54, 44, BLUE)
    c.px(53, 44, BLUE)
    c.px(54, 45, lit(BLUE, 0.3))
    c.hline(61, 45, 6, BLUE)
    c.px(61, 46, BLUE)
    c.px(66, 46, BLUE)
    finish_season(c, "hyper_season_spring")


def season_summer():
    """Лето: песчаный подиум, полосатый пляжный зонт, шезлонг, надувной круг и мяч."""
    c = Canvas(SEASON_W, SEASON_H)
    podium(c, CREAM, SAND, SKY)
    rnd = random.Random(51)
    for _ in range(22):
        x, y = rnd.randrange(6, 70), rnd.randrange(43, 54)
        if c.get(x, y)[:3] == CREAM[:3]:
            c.px(x, y, rnd.choice([SAND, WHITE]))
    # Волна по боку подиума.
    for x in range(4, 72):
        if (x // 3) % 2 == 0:
            c.px(x, 53, WHITE)
    # Зонт: шест и купол из красно-белых клиньев, светлее слева.
    c.vline(30, 10, 34, PALE)
    c.vline(31, 10, 34, STEEL)
    for y in range(0, 12):
        half = round(4 + y * 2.2)
        for x in range(30 - half, 31 + half + 1):
            wedge = int((x - 30) / 5.5 + 10) % 2
            tone = RED if wedge else WHITE
            if y >= 10:
                tone = RED_D if wedge else PALE
            if x > 31 + half - 4 and y < 10:
                tone = lit(tone, -0.18)
            c.px(x, y + 2, tone)
    for x in range(6, 56, 6):
        c.px(x, 14, RED_D)
    c.px(30, 0, RED)
    c.px(31, 0, RED)
    c.px(30, 1, RED)
    # Шезлонг справа: синяя полосатая ткань, спинка поднята слева и откинута назад; короткие ножки; под сиденьем -
    # мягкая тень на песке (тон песка темнее, без линий).
    c.ellipse(57, 43.5, 11, 1.8, lit(CREAM, -0.14))
    c.ellipse(56, 43.5, 7, 1.2, lit(CREAM, -0.2))
    for lx in (48, 53, 64):
        c.vline(lx, 41, 2, WOOD_D)
    for y in range(30, 41):
        x0 = 44 + (y - 30) * 4 // 10
        c.hline(x0, y, 4, BLUE if (y // 2) % 2 else WHITE)
        c.px(x0 + 3, y, lit(BLUE if (y // 2) % 2 else WHITE, -0.18))
    c.rect(50, 38, 16, 3, BLUE)
    c.hline(50, 38, 16, lit(BLUE, 0.4))
    c.hline(50, 40, 16, BLUE_D)
    for x in range(53, 66, 4):
        c.vline(x, 38, 3, WHITE)
    # Надувной круг слева.
    c.ellipse(15, 44, 8, 4.2, PINK)
    c.ellipse(15, 44, 3.6, 1.6, CREAM)
    for x, y in ((9, 43), (21, 45), (14, 41), (16, 47)):
        c.px(x, y, WHITE)
    c.px(10, 42, lit(PINK, 0.4))
    # Мяч в центре спереди: дольки красная, белая, синяя, жёлтая; блик слева сверху.
    bx, by = 37, 47
    for y in range(by - 4, by + 4):
        for x in range(bx - 4, bx + 4):
            u, v = x + 0.5 - bx, y + 0.5 - by
            if u * u + v * v > 15:
                continue
            k = int(((u + 4) / 8) * 4)
            c.px(x, y, (RED, WHITE, BLUE, GOLD_L)[min(3, k)])
    c.px(bx - 2, by - 3, WHITE)
    c.px(bx - 3, by - 2, WHITE)
    c.px(bx + 2, by + 2, lit(BLUE, -0.3))
    # Ведёрко с лопаткой.
    c.rect(22, 50, 5, 4, GOLD)
    c.hline(22, 50, 5, GOLD_L)
    c.vline(26, 46, 4, GREEN)
    finish_season(c, "hyper_season_summer")


def season_autumn():
    """Осень: подиум в опавших листьях, стог сена с тыквами, ящик яблок и пугало-флажок «урожай»."""
    c = Canvas(SEASON_W, SEASON_H)
    podium(c, SAND, TAN, BARK)
    rnd = random.Random(61)
    for _ in range(30):
        x, y = rnd.randrange(5, 71), rnd.randrange(42, 54)
        if c.get(x, y)[:3] in (SAND[:3], TAN[:3]):
            c.px(x, y, rnd.choice([ORANGE, RED, GOLD, WOOD]))
    # Стог сена сзади: соломенный тюк, перетянутый верёвками.
    c.round_rect(10, 22, 34, 20, GOLD, r=3)
    c.hline(12, 22, 30, GOLD_L)
    c.vline(10, 24, 16, GOLD_L)
    c.vline(43, 24, 16, ORANGE)
    c.hline(11, 41, 32, ORANGE)
    rnd2 = random.Random(62)
    for _ in range(26):
        x, y = rnd2.randrange(12, 40), rnd2.randrange(24, 40)
        c.hline(x, y, rnd2.choice((2, 3, 4)), rnd2.choice((GOLD_L, lit(GOLD, 0.35), ORANGE)))
    for x in (20, 33):
        c.vline(x, 22, 20, WOOD_D)
    # Тыквы: большая на стогу, две на подиуме.
    for px_, py_, rx, ry in ((27, 18, 6, 4.5), (13, 45, 6.5, 4.5), (52, 47, 5, 3.6)):
        c.ellipse(px_, py_, rx, ry, ORANGE)
        for dx in (-int(rx // 2), 0, int(rx // 2)):
            c.vline(int(px_) + dx, int(py_ - ry) + 1, int(ry * 2) - 1, lit(ORANGE, -0.25))
        c.px(int(px_ - rx) + 2, int(py_ - ry) + 1, GOLD_L)
        c.px(int(px_ - rx) + 1, int(py_), GOLD)
        c.rect(int(px_), int(py_ - ry) - 2, 2, 2, GREEN_D)
    # Ящик яблок справа.
    c.rect(48, 30, 18, 12, WOOD)
    c.hline(48, 30, 18, SAND)
    c.hline(48, 35, 18, BARK)
    c.hline(48, 41, 18, WOOD_D)
    c.vline(65, 31, 11, WOOD_D)
    c.vline(48, 31, 11, SAND)
    for k, (ax, ay) in enumerate(((50, 28), (54, 27), (58, 28), (62, 27), (52, 25), (56, 25), (60, 25))):
        tone = RED if k % 3 else GREEN
        c.ellipse(ax + 1, ay + 1, 2.2, 2, tone)
        c.px(ax, ay, lit(tone, 0.5))
    # Кленовые листья у края.
    leaves = [(30, 50, RED), (42, 51, ORANGE), (62, 52, GOLD), (24, 52, GOLD)]
    for x, y, tone in leaves:
        for dx, dy in ((1, 0), (0, 1), (1, 1), (2, 1), (1, 2)):
            c.px(x + dx, y + dy, tone)
    finish_season(c, "hyper_season_autumn")


# ---------------------------------------------------------------- скамья у касс


def bench():
    """Скамья вокруг кадки 68×50: квадратная каменная кадка с деревцем, деревянные сиденья спереди и по бокам."""
    c = Canvas(68, 50)
    # Деревце: ствол и пышная крона (свет слева сверху).
    c.rect(33, 16, 3, 14, BARK)
    c.vline(33, 16, 14, TAN)
    crown = [(34, 10, 13, 9), (25, 15, 8, 6), (43, 15, 8, 6), (30, 5, 8, 5), (39, 6, 7, 5)]
    for x, y, rx, ry in crown:
        c.ellipse(x, y, rx, ry, GREEN_D)
    for x, y, rx, ry in crown:
        c.ellipse(x - 1.5, y - 1.5, rx - 2.5, ry - 2.2, GREEN)
    rnd = random.Random(71)
    for _ in range(22):
        x, y = rnd.randrange(14, 56), rnd.randrange(0, 22)
        if c.get(x, y)[:3] == GREEN[:3]:
            c.px(x, y, lit(GREEN, 0.35) if x < 38 else GREEN_D)
    for x, y in ((22, 12), (28, 6), (37, 3), (46, 11), (50, 17)):
        c.px(x, y, lit(GREEN, 0.5))
    # Кадка: светлый камень, земля сверху.
    c.rect(18, 24, 32, 16, PALE)
    c.hline(18, 24, 32, WHITE)
    c.vline(18, 24, 16, WHITE)
    c.vline(49, 25, 15, STEEL)
    c.rect(20, 25, 28, 3, WOOD_D)
    c.hline(20, 25, 28, BARK)
    c.rect(33, 25, 3, 2, BARK)
    for x in range(22, 48, 6):
        c.vline(x, 29, 10, lit(PALE, -0.12))
    # Боковые сиденья (уходят вглубь) и переднее - доски вдоль, ножки.
    for x0 in (4, 52):
        c.rect(x0, 26, 12, 12, WOOD)
        for y in range(27, 38, 3):
            c.hline(x0, y, 12, SAND)
        c.vline(x0 + 11, 26, 12, WOOD_D)
        c.hline(x0, 37, 12, WOOD_D)
        c.rect(x0 + 1, 38, 2, 5, NAVY)
        c.rect(x0 + 9, 38, 2, 5, NAVY)
    c.rect(4, 38, 60, 6, WOOD)
    c.hline(4, 38, 60, SAND)
    c.hline(4, 40, 60, lit(WOOD, 0.15))
    c.hline(4, 43, 60, WOOD_D)
    for x in (8, 32, 58):
        c.rect(x, 44, 2, 4, NAVY)
    finish(c, "hyper_bench", (34, 47, 31, 2))


# ---------------------------------------------------------------- главный проход к кассам

AISLE_W, AISLE_H = 128, 48
# Тёплая терракота: не серая, как разметка «+» свободных мест под полки, и спокойнее вставок отделов.
TERRA = mix(TAN, CREAM, 0.48)
TERRA_L = lit(TERRA, 0.1)
TERRA_D = lit(TERRA, -0.03)
RIM = BARK
GROUT = mix(lit(RIM, 0.35), TERRA, 0.45)
CHEVRON = mix(CREAM, WHITE, 0.45)


def aisle_rows(c, x, w):
    """Кайма дорожки сверху и снизу на ширину w: тёмная затирка снаружи, полоса каймы, фаска (свет сверху)."""
    for y, tone in ((0, lit(RIM, -0.25)), (1, lit(RIM, 0.3)), (2, RIM), (AISLE_H - 3, RIM), (AISLE_H - 2, lit(RIM, -0.15)), (AISLE_H - 1, lit(RIM, -0.25))):
        c.hline(x, y, w, tone)


def aisle():
    """Главный проход к кассам 128×48 (в мире 64×24), кусок полосы без швов по краям: крупная терракотовая плитка
    вперевязку, коричневая кайма сверху и снизу и посередине - светлая сливочная стрелка «›» к кассам. Лежит в полу,
    как вставки отделов (без контура). Сцена тянет его полосой от левой стены до касс и закрывает торцами
    hyper_aisle_l / hyper_aisle_r."""
    c = Canvas(AISLE_W, AISLE_H)
    rnd = random.Random(91)
    tones = {}
    top, rows, tile_w = 3, 2, 32
    tile_h = (AISLE_H - 6) // rows
    for y in range(top, top + rows * tile_h):
        row = (y - top) // tile_h
        shift = 16 if row % 2 else 0
        for x in range(AISLE_W):
            col = ((x + shift) % AISLE_W) // tile_w
            tone = tones.setdefault((row, col), rnd.choice((TERRA, TERRA, TERRA_L, TERRA_D)))
            lx, ly = (x + shift) % tile_w, (y - top) % tile_h
            if lx == tile_w - 1 or ly == tile_h - 1:
                tone = GROUT
            elif lx == 0 or ly == 0:
                tone = lit(tone, 0.18)
            c.px(x, y, tone)
    # Крапинки в плитке - редкие, чтобы пол не пестрил.
    for _ in range(70):
        x, y = rnd.randrange(AISLE_W), rnd.randrange(top, top + rows * tile_h)
        if c.get(x, y)[:3] != GROUT[:3]:
            c.px(x, y, lit(c.get(x, y), rnd.choice((-0.14, 0.2))))
    aisle_rows(c, 0, AISLE_W)
    # Стрелка «›» к кассам: сливочная вставка, блик сверху слева, тень снизу справа.
    cx, cy = AISLE_W // 2, AISLE_H // 2
    for k in range(20):
        x0 = cx - 6 + min(k, 19 - k)
        y = cy - 10 + k
        c.hline(x0, y, 5, CHEVRON)
        c.px(x0, y, lit(CHEVRON, 0.3) if k < 10 else CHEVRON)
        c.px(x0 + 4, y, lit(CHEVRON, -0.18) if k >= 10 else CHEVRON)
    c.save("hyper_aisle")
    # Торцы: слева - светлая фаска (свет слева), справа - тёмная.
    for side in ("l", "r"):
        e = Canvas(4, AISLE_H)
        aisle_rows(e, 0, 4)
        cols = [lit(RIM, -0.25), lit(RIM, 0.3), RIM, RIM] if side == "l" else [RIM, RIM, lit(RIM, -0.15), lit(RIM, -0.25)]
        for x, tone in enumerate(cols):
            e.vline(x, 1 if side == "l" else 2, AISLE_H - 2 if side == "l" else AISLE_H - 3, tone)
        e.vline(0 if side == "l" else 3, 0, AISLE_H, lit(RIM, -0.25))
        e.save(f"hyper_aisle_{side}")


def main():
    kidsmat()
    kidsmat(88, 56, "hyper_kidsmat_s")
    ride()
    claw()
    capsule()
    rocket()
    season_winter()
    season_snow()
    season_spring()
    season_summer()
    season_autumn()
    bench()
    aisle()


if __name__ == "__main__":
    main()
