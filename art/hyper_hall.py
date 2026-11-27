"""Гипермаркет: низ торгового зала (27.11, слабое место «в гипермаркете нижняя половина зала пустая»).

Между нижним рядом островов и входом в гипермаркете оставалась голая плитка. Здесь - то, чем в большом магазине
обжита зона у входа: уголок аттракционов (машинка-качалка и автомат с игрушками на мягком коврике), сезонная
фотозона на круглом подиуме и скамья вокруг кадки с деревцем. Товара на них нет - игроки не примут их за полки
(островные витрины с товаром убрали 08.11 именно поэтому). Сцена - src/scenes/hyperHall.ts.

Палитра Endesga 32 (art/sprites.py), контур #181425, свет сверху слева, двойная детализация: в мире всё вдвое меньше.

    python3 art/hyper_hall.py

Картинки (размеры - в пикселях рисунка):
  hyper_kidsmat        128×68  мягкий коврик-пазл уголка аттракционов (лежит на полу: без контура, нижний край - толщина);
  hyper_ride            46×40  машинка-качалка на подставке с монетоприёмником (смотрит вправо);
  hyper_claw            30×56  автомат с игрушками: вывеска с лампочками, стекло, клешня, пульт, окошко выдачи;
  hyper_claw_lit        30×56  лампочки вывески и подсветка стекла (мигают сценой; вечером светят);
  hyper_capsule         20×36  автомат с игрушками-капсулами: два ящика с окошками друг на друге;
  hyper_season_<время>  76×60  сезонная фотозона на подиуме: winter - ёлочка и подарки, spring - клумба с тюльпанами,
                               summer - зонт, шезлонг и мяч на песке, autumn - стог, тыквы и ящик яблок;
  hyper_bench           68×50  скамья вокруг кадки с деревцем (зона отдыха у касс).
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


def kidsmat():
    """Коврик-пазл 128×68 (64×34 точки мира): крупные мягкие квадраты в пастельных тонах с замками, светлый валик по
    краю. Лежит на полу - контура нет, толщину даёт тёмный нижний край."""
    w, h = 128, 68
    m = Canvas(w, h)
    tiles = [H("#f6757a"), H("#feae34"), H("#2ce8f5"), H("#63c74d"), H("#b55088"), H("#0099db")]
    soft = [mix(t, WHITE, 0.32) for t in tiles]
    m.round_rect(0, 0, w, h - 2, WHITE, r=4)
    m.round_rect(0, 2, w, h - 2, PALE, r=4)
    m.round_rect(1, 1, w - 2, h - 4, WHITE, r=3)
    cell_w, cell_h = 17, 15
    for gy in range(4):
        for gx in range(7):
            tone = soft[(gx + gy * 2) % len(soft)]
            x, y = 3 + gx * cell_w, 3 + gy * cell_h
            m.rect(x, y, cell_w, cell_h, tone)
            m.hline(x, y, cell_w, lit(tone, 0.35))
            m.vline(x, y, cell_h, lit(tone, 0.18))
            m.hline(x, y + cell_h - 1, cell_w, lit(tone, -0.12))
    # Замки пазла: выступ каждой плитки вправо и вниз, в соседнюю (поверх уже уложенных).
    for gy in range(4):
        for gx in range(7):
            tone = soft[(gx + gy * 2) % len(soft)]
            x, y = 3 + gx * cell_w, 3 + gy * cell_h
            if gx < 6:
                m.rect(x + cell_w, y + 5, 2, 4, tone)
            if gy < 3:
                m.rect(x + 7, y + cell_h, 4, 2, tone)
    # Толщина коврика: тёмный нижний край и правый торец (свет сверху слева).
    m.hline(3, h - 3, w - 6, STEEL)
    m.hline(4, h - 2, w - 8, METAL)
    m.vline(w - 2, 4, h - 8, STEEL)
    m.save("hyper_kidsmat")


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


# ---------------------------------------------------------------- сезонная фотозона

SEASON_W, SEASON_H = 76, 60


def podium(c, top, edge, skirt):
    """Круглый низкий подиум (низ картинки): верх-тарелка top, кант edge, бок skirt с полосой."""
    cx, cy = SEASON_W / 2, SEASON_H - 11
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
    finish(c, "hyper_season_winter", (38, 55, 34, 3))


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
    # Лейка справа.
    c.rect(63, 30, 8, 7, SKY)
    c.hline(63, 30, 8, lit(SKY, 0.5))
    c.vline(70, 31, 6, BLUE)
    c.line(62, 32, 58, 28, BLUE)
    c.px(57, 27, BLUE)
    c.px(56, 27, BLUE)
    c.hline(64, 28, 6, BLUE)
    # Белый заборчик по переднему краю.
    for x in range(8, 70, 5):
        dy = round(3 * ((x - 38) / 34) ** 2)
        c.rect(x, 48 + dy - 2, 2, 6, WHITE)
        c.px(x, 48 + dy - 3, WHITE)
    for x in range(8, 70):
        dy = round(3 * ((x - 38) / 34) ** 2)
        c.px(x, 50 + dy - 1, PALE)
    finish(c, "hyper_season_spring", (38, 55, 34, 3))


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
    # Шезлонг справа: синяя полосатая ткань на деревянной раме, спинка поднята.
    c.line(42, 44, 50, 34, WOOD_D)
    c.line(66, 44, 62, 40, WOOD_D)
    c.line(48, 44, 66, 40, BARK)
    for k in range(4):
        tone = BLUE if k % 2 == 0 else WHITE
        c.line(50 + k * 4, 38 - k * 0, 52 + k * 4, 41, tone)
    for y in range(30, 41):
        x0 = 48 + (40 - y) // 2
        c.hline(x0, y, 4, BLUE if (y // 2) % 2 else WHITE)
    c.rect(52, 38, 14, 3, BLUE)
    c.hline(52, 38, 14, lit(BLUE, 0.4))
    c.hline(52, 40, 14, BLUE_D)
    for x in range(54, 66, 4):
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
    finish(c, "hyper_season_summer", (38, 55, 34, 3))


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
    finish(c, "hyper_season_autumn", (38, 55, 34, 3))


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


def main():
    kidsmat()
    ride()
    claw()
    capsule()
    season_winter()
    season_spring()
    season_summer()
    season_autumn()
    bench()


if __name__ == "__main__":
    main()
