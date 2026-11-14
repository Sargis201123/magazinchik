"""Третий этаж — фудкорт «как настоящий зал» (src/scenes/floors/thirdFloor.ts, 14.11).

Автор: «нужно отрисовать красиво и подвал, и второй этаж, и третий — и трафик туда, и улучшения, всё как в основном
зале». Здесь — весь рисунок нового фудкорта: панорама района за окнами (днём, а вечером в окнах домов зажигается
свет), рамы окон, обшивка стены под окнами (голая и после «дизайна зала»), светлая плитка и деревянный настил под
столами, лифт с раздвижными дверями, четыре точки еды (подвесная вывеска, табло-меню, кухня у стены и стойка с
витриной), общие столы (простые и деревянные), стойка с подносами, урны с приёмом подносов, кадки с растениями,
кулер, подносы с едой в руках и тарелки на столах (полная, надкусанная, пустая), облачко разговора и нота, детская
зона (мягкий коврик, горка, сухой бассейн), сцена с колонками и гитара в руках музыканта.

Палитра Endesga 32 (art/sprites.py), двойная детализация: в мире всё вдвое меньше (ART = 2). Старые картинки
art/foodcourt.py (fc_*) остаются: ими рисуются лифт на фасаде и строки меню.

    python3 art/foodcourt_art.py
"""

import math
import random

from premium import H, lit, mix
from sprites import Canvas, shadowed

INK = H("#181425")
WHITE, PALE, STEEL = H("#ffffff"), H("#c0cbdc"), H("#8b9bb4")
METAL, METAL_D, NAVY = H("#5a6988"), H("#3a4466"), H("#262b44")
CREAM, SAND, TAN = H("#ead4aa"), H("#e4a672"), H("#c28569")
WOOD, WOOD_D, WOOD_DD = H("#b86f50"), H("#733e39"), H("#3e2731")
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


# ---------------------------------------------------------------- окна и стена
# Стена фудкорта в мире — 58 точек: сверху балка (0–2), окна до подоконника (2–40), подоконник (40–42) и обшивка
# (42–58). Небо за окнами сцена рисует сама (цвет по часу дня), здесь — то, что перед ним.

CITY_W, CITY_H = 336, 76


def city():
    """Панорама района за окнами (вся ширина зала, без повтора): дальние дома в дымке, ближние крыши, телебашня,
    купол, деревья. Небо прозрачное. Второй слой — окна домов, которые светятся вечером."""
    c = Canvas(CITY_W, CITY_H)
    lit_layer = Canvas(CITY_W, CITY_H)
    rnd = random.Random(314)
    # Дальний ряд: светлая голубая дымка, редкие высокие дома.
    haze, haze_d = H("#8b9bb4"), mix(H("#8b9bb4"), H("#5a6988"), 0.4)
    x = 0
    while x < CITY_W:
        w = rnd.randint(14, 26)
        top = rnd.randint(22, 40)
        c.rect(x, top, w, CITY_H - top, haze)
        c.vline(x, top, CITY_H - top, haze_d)
        for wy in range(top + 3, CITY_H, 4):
            for wx in range(x + 2, x + w - 1, 3):
                if rnd.random() < 0.5:
                    c.px(wx, wy, haze_d)
        x += w + rnd.randint(-2, 3)
    # Телебашня и купол — приметы района.
    tx = 238
    c.rect(tx, 4, 2, 40, STEEL)
    c.vline(tx + 1, 4, 40, PALE)
    c.rect(tx - 3, 18, 8, 4, PALE)
    c.hline(tx - 3, 21, 8, STEEL)
    c.px(tx, 2, RED)
    c.px(tx, 3, RED)
    lit_layer.px(tx, 2, RED)
    lit_layer.px(tx, 3, lit(RED, 0.4))
    c.ellipse(72, 38, 9, 7, GOLD)
    c.ellipse(70, 36, 3, 3, GOLD_L)
    c.rect(71, 26, 2, 6, GOLD)
    c.px(72, 25, GOLD_L)
    # Ближний ряд: кирпич, штукатурка, крыши-скаты, окна. Окна вечером светятся (второй слой).
    near = [
        (H("#b86f50"), H("#733e39")),
        (H("#c28569"), H("#8f563b")),
        (H("#5a6988"), H("#3a4466")),
        (H("#ead4aa"), H("#c28569")),
        (H("#e4a672"), H("#b86f50")),
        (H("#8b9bb4"), H("#5a6988")),
    ]
    roofs = [H("#a22633"), H("#3a4466"), H("#733e39"), H("#265c42")]
    x = -4
    i = 0
    while x < CITY_W:
        w = rnd.randint(22, 38)
        top = rnd.randint(40, 54)
        body, dark = near[i % len(near)]
        c.rect(x, top, w, CITY_H - top, body)
        c.vline(x, top, CITY_H - top, dark)
        c.vline(x + w - 1, top, CITY_H - top, dark)
        kind = rnd.random()
        if kind < 0.45:
            # Скат крыши.
            roof = roofs[i % len(roofs)]
            for k in range(6):
                c.hline(x + k - 1, top - 6 + k, w - 2 * k + 2, roof)
            c.hline(x + 5, top - 6, w - 10, lit(roof, 0.25))
        else:
            # Плоская крыша: парапет, будка, бак.
            c.hline(x, top, w, lit(body, 0.3))
            c.hline(x, top + 1, w, dark)
            if rnd.random() < 0.6:
                bx = x + rnd.randint(3, max(4, w - 9))
                c.rect(bx, top - 4, 6, 4, dark)
                c.hline(bx, top - 4, 6, lit(dark, 0.3))
        # Окна: ряды по 4 точки; часть — тёмные, часть с занавеской; вечером горят тёплым.
        for wy in range(top + 4, CITY_H - 2, 6):
            for wx in range(x + 3, x + w - 4, 5):
                c.rect(wx, wy, 3, 3, NAVY)
                c.px(wx, wy, lit(NAVY, 0.3))
                if rnd.random() < 0.55:
                    tone = rnd.choice([GOLD_L, GOLD, H("#ffd59e")[:3] + (255,)])
                    lit_layer.rect(wx, wy, 3, 3, tone)
                    lit_layer.px(wx + 2, wy + 2, lit(tone, -0.25))
        x += w + rnd.randint(0, 3)
        i += 1
    # Кроны деревьев над крышами — зелёные пятна с бликом.
    for tx in (30, 104, 168, 214, 290, 322):
        ty = rnd.randint(69, 73)
        c.ellipse(tx, ty, 7, 5, GREEN_D)
        c.ellipse(tx - 1, ty - 1, 5, 3.5, GREEN)
        c.px(tx - 3, ty - 3, lit(GREEN, 0.4))
    c.save("fc3_city")
    lit_layer.save("fc3_city_lit")


def cloud():
    """Облако за окном: сцена медленно ведёт его по небу (в лёгкой графике — стоит)."""
    c = Canvas(30, 10)
    c.ellipse(9, 6, 7, 3.6, WHITE)
    c.ellipse(17, 4.5, 7, 4.2, WHITE)
    c.ellipse(24, 6.5, 5, 3, WHITE)
    c.hline(4, 9, 24, PALE)
    c.save("fc3_cloud")


def frame():
    """Рама панорамного окна (повтор по ширине, 32 точки мира): балка сверху, стойка, поперечина, подоконник.
    Стекло прозрачное — за ним панорама и небо; на стекле — пара бликов."""
    c = Canvas(64, 84)
    glint = (255, 255, 255, 70)
    for i in range(14):
        c.px(14 + i, 54 - i * 2, glint)
        c.px(15 + i, 54 - i * 2, glint)
        c.px(22 + i, 58 - i * 2, (255, 255, 255, 40))
    # Балка под потолком.
    c.rect(0, 0, 64, 4, NAVY)
    c.hline(0, 3, 64, METAL)
    # Стойка рамы и тонкая поперечина форточки.
    c.rect(0, 0, 3, 80, METAL_D)
    c.vline(1, 4, 76, STEEL)
    c.rect(0, 22, 64, 2, METAL_D)
    c.hline(0, 22, 64, STEEL)
    # Подоконник: светлый камень с тенью.
    c.rect(0, 78, 64, 4, PALE)
    c.hline(0, 78, 64, WHITE)
    c.hline(0, 81, 64, STEEL)
    c.rect(0, 82, 64, 2, (24, 20, 37, 90))
    c.save("fc3_frame")


def wainscot():
    """Стена под окнами (16 точек мира): голая — крашеная штукатурка с плинтусом; после «дизайна зала» — тёплые
    деревянные рейки с латунной полосой."""
    c = Canvas(32, 32)
    c.rect(0, 0, 32, 32, lit(CREAM, -0.05))
    c.speckle(0, 0, 32, 26, [lit(CREAM, -0.12), lit(CREAM, 0.15)], 10, 7)
    c.hline(0, 0, 32, lit(CREAM, -0.3))
    c.rect(0, 26, 32, 6, lit(SAND, -0.15))
    c.hline(0, 26, 32, lit(SAND, 0.2))
    c.hline(0, 31, 32, WOOD_D)
    c.save("fc3_wain")
    d = Canvas(32, 32)
    d.rect(0, 0, 32, 32, WOOD)
    for x in range(0, 32, 4):
        d.vline(x, 0, 26, WOOD_D)
        d.vline(x + 1, 0, 26, lit(WOOD, 0.22))
        d.vline(x + 2, 2, 20, lit(WOOD, 0.08))
    d.rect(0, 0, 32, 2, GOLD)
    d.hline(0, 1, 32, lit(GOLD, -0.3))
    d.rect(0, 26, 32, 6, WOOD_DD)
    d.hline(0, 26, 32, GOLD)
    d.hline(0, 31, 32, INK)
    d.save("fc3_wain_d")


def floor_tiles():
    """Пол: светлая плитка 16×16 точек мира — тёплый камень со швом и крошкой терраццо; после «дизайна зала» под
    столами — деревянный настил (доски вразбежку)."""
    c = Canvas(32, 32)
    base = H("#f1ddb6")
    c.rect(0, 0, 32, 32, base)
    c.rect(16, 0, 16, 16, lit(base, -0.03))
    c.rect(0, 16, 16, 16, lit(base, -0.03))
    c.speckle(1, 1, 30, 30, [H("#d8b88a"), H("#c0cbdc"), H("#e4a672"), lit(base, 0.4)], 22, 41)
    for k in (0, 16):
        c.hline(0, k, 32, H("#d8b88a"))
        c.vline(k, 0, 32, H("#d8b88a"))
        c.hline(1, k + 1, 15, lit(base, 0.35))
        c.hline(17, k + 1, 15, lit(base, 0.35))
    c.save("fc3_floor")
    # Настил: длинные доски вдоль зала, стыки вразбежку, швы — чуть темнее дерева (не кирпич).
    d = Canvas(64, 32)
    plank = [H("#c28569"), H("#c99070")[:3] + (255,), H("#bd7f60")[:3] + (255,), H("#c68a69")[:3] + (255,)]
    for row in range(4):
        y = row * 8
        tone = plank[row]
        d.rect(0, y, 64, 8, tone)
        d.hline(0, y + 1, 64, lit(tone, 0.12))
        d.hline(0, y + 7, 64, lit(tone, -0.22))
        off = (row * 23) % 64
        d.vline(off, y, 7, lit(tone, -0.22))
        d.speckle(0, y + 2, 64, 4, [lit(tone, -0.07), lit(tone, 0.07)], 12, 90 + row)
    d.save("fc3_deck")


# ---------------------------------------------------------------- лифт


def lift():
    """Лифт в задней стене (26×48 точек мира): стальная рамка, табло с «3» и стрелкой, кнопка вызова; в проёме —
    кабина с тёплым светом, поручнем и зеркалом. Створки — отдельной картинкой (сцена их раздвигает)."""
    c = Canvas(52, 96)
    # Стена вокруг — тёмный камень (портал).
    c.rect(0, 10, 52, 86, METAL_D)
    c.rect(2, 12, 48, 84, METAL)
    c.vline(2, 12, 84, STEEL)
    c.vline(49, 12, 84, METAL_D)
    # Табло: «▲ 3».
    c.round_rect(14, 0, 24, 11, NAVY, r=2)
    c.rect(16, 2, 20, 7, INK)
    c.stamp(["..Y..", ".YYY.", "YYYYY"], 18, 3)
    c.stamp(["YYY", "..Y", ".YY", "..Y", "YYY"], 28, 2)
    # Проём и кабина.
    c.rect(7, 18, 38, 78, INK)
    cab = H("#ffd59e")[:3] + (255,)
    c.rect(8, 19, 36, 77, lit(cab, -0.2))
    c.rect(10, 21, 32, 50, lit(cab, -0.05))
    c.rect(14, 24, 24, 38, lit(PALE, 0.2))  # зеркало
    for i in range(10):
        c.px(18 + i, 58 - i * 3, WHITE)
    c.rect(10, 66, 32, 2, STEEL)  # поручень
    c.hline(10, 66, 32, WHITE)
    c.rect(8, 84, 36, 12, lit(cab, -0.35))  # пол кабины
    c.hline(8, 84, 36, lit(cab, -0.15))
    # Кнопка вызова справа.
    c.rect(46, 44, 4, 10, NAVY)
    c.px(47, 46, GOLD_L)
    c.px(48, 46, GOLD)
    c.px(47, 50, PALE)
    c.outline(INK)
    c.save("fc3_lift")
    # Створка: матовая сталь с вертикальным бликом (18 точек проёма — две створки по 19 пикселей).
    d = Canvas(19, 77)
    d.rect(0, 0, 19, 77, STEEL)
    d.vline(0, 0, 77, METAL)
    d.vline(3, 0, 77, PALE)
    d.vline(4, 0, 77, lit(PALE, 0.3))
    d.vline(18, 0, 77, METAL_D)
    d.speckle(5, 0, 12, 77, [lit(STEEL, -0.08), lit(STEEL, 0.1)], 30, 3)
    d.save("fc3_lift_door")


# ---------------------------------------------------------------- точки еды
# Точка: задняя часть (64×104 пикселя = 32×52 точки мира, низ — у стены, y 58) — подвесная вывеска и табло-меню
# на тросиках, между ними видно окно, ниже — кухня у стены. Передняя — стойка с витриной (64×36 = 32×18 точек,
# y 58–76). Повар стоит между ними.

BRANDS = {
    "pizza": (RED, RED_D, WHITE),
    "grill": (ORANGE, RED_D, GOLD_L),
    "sushi": (NAVY, INK, RED),
    "coffee": (WOOD_D, WOOD_DD, CREAM),
}


def hanging_sign(c, tone, dark, trim, icon):
    # Тросики от потолка.
    for x in (12, 51):
        c.vline(x, 0, 4, METAL_D)
        c.vline(x, 18, 6, METAL_D)
    # Вывеска: короб с рамкой, значок по центру, по бокам — узор цвета точки.
    c.round_rect(2, 3, 60, 16, dark, r=2)
    c.round_rect(3, 4, 58, 14, tone, r=2)
    c.hline(5, 4, 54, lit(tone, 0.35))
    c.hline(4, 16, 56, lit(tone, -0.25))
    for x in list(range(6, 22, 3)) + list(range(43, 59, 3)):
        c.px(x, 8, trim)
        c.px(x + 1, 13, trim)
    c.stamp(icon, 32 - len(icon[0]) // 2, 11 - len(icon) // 2)


def menu_board(c, items):
    """Табло-меню под вывеской: тёмный экран, три блюда с ценой (жёлтые чёрточки)."""
    c.rect(6, 23, 52, 16, NAVY)
    c.rect(7, 24, 50, 14, INK)
    c.hline(7, 24, 50, lit(NAVY, 0.2))
    for k, pic in enumerate(items):
        x0 = 9 + k * 17
        c.stamp(pic, x0, 26)
        c.hline(x0, 34, 7, GOLD_L)
        c.hline(x0 + 9, 34, 4, GOLD)
        c.hline(x0, 36, 5, STEEL)


def back_kitchen(c, tile, tile_l):
    """Кухня у стены: кафель (виден от подоконника вниз) и рабочий стол."""
    c.rect(2, 60, 60, 44, tile)
    for y in range(64, 92, 5):
        c.hline(2, y, 60, tile_l)
    for x in range(7, 62, 7):
        c.vline(x, 60, 32, tile_l)
    c.vline(2, 60, 44, lit(tile, -0.3))
    c.vline(61, 60, 44, lit(tile, -0.3))
    c.rect(2, 92, 60, 3, PALE)
    c.hline(2, 92, 60, WHITE)
    c.rect(2, 95, 60, 9, METAL)
    c.hline(2, 103, 60, METAL_D)
    for x in (10, 30, 50):
        c.rect(x, 97, 6, 1, STEEL)


SLICE = ["yyyyyyyyy", ".yRyyyRy.", "..yyRyy..", "...yRy...", "....y...."]
WRAP = [".NNNNNN.", "NNeNRNNN", "NBNBNeNN", ".NNNNNN."]
ROLL = ["..kkkk..", ".kwwwwk.", "kwwoowwk", "kwwoowwk", ".kwwwwk.", "..kkkk.."]
CUP = ["..W.W...", "...W....", "wwwwww..", "wbbbbwww", "wbbbbw.w", "wwwwwww.", ".WWWW..."]


def pizza():
    c = Canvas(64, 104)
    hanging_sign(c, RED, RED_D, WHITE, [".yyyyyyyyyyy.", "yyRyyyyyRyyyy", ".yyyyRyyyyyy.", "..yyyyyyRyy..", "...yRyyyyy...", "....yyyRy....", ".....yyy.....", "......y......"])
    menu_board(c, [["yyyyyyy", ".yRyRy.", "..yyy..", "...y..."], ["..ooo..", ".oyyyo.", "oyyRyyo", ".ooooo."], ["..E....", ".EwwE..", "EwwwwE.", ".EEEE.."]])
    back_kitchen(c, WHITE, PALE)
    # Печь: кирпичный купол с огнём, труба вверх.
    brick, brick_d = H("#b86f50"), H("#8f563b")
    c.rect(26, 50, 6, 12, METAL_D)
    c.vline(27, 50, 12, METAL)
    c.ellipse(29, 78, 18, 15, brick_d)
    c.ellipse(29, 77, 17, 14, brick)
    for y in range(66, 92, 4):
        for x in range(12 + (y // 4 % 2) * 3, 47, 6):
            c.hline(x, y, 4, brick_d)
    c.round_rect(19, 77, 20, 15, INK, r=5)
    c.rect(22, 84, 14, 8, ORANGE)
    c.rect(24, 82, 10, 4, GOLD)
    c.rect(27, 80, 4, 3, GOLD_L)
    c.rect(12, 91, 34, 2, brick_d)
    # Лопата у печи и пицца на столе.
    c.vline(52, 66, 26, WOOD)
    c.ellipse(52, 64, 3, 3.5, TAN)
    c.ellipse(10, 93, 5, 1.5, GOLD)
    c.px(9, 93, RED)
    c.px(11, 92, RED)
    c.outline(INK)
    c.save("fc3_pizza")


def grill():
    c = Canvas(64, 104)
    hanging_sign(c, ORANGE, RED_D, GOLD_L, ["..NNNNNNN..", ".NNBNNeNNN.", "NNeNNRNNBNN", "NBNNBNNeNNN", "NNNRNNBNNRN", ".NNNNNNNNN.", "..NNNNNNN.."])
    menu_board(c, [WRAP, ["..aaa..", ".aBBBa.", "aBBaBBa", ".aaaaa."], ["..R.R..", "RRRRRRR", ".RRRRR.", "..RRR.."]])
    back_kitchen(c, H("#ead4aa"), H("#e4a672"))
    # Вертел с мясом: конус, капли жира, под ним — красный жар.
    c.vline(18, 52, 44, METAL_D)
    for k in range(26):
        w = 14 - k // 3
        tone = WOOD if (k // 2) % 2 else BARK
        c.hline(18 - w // 2, 60 + k, w, tone)
    c.vline(13, 62, 20, lit(WOOD, 0.3))
    c.rect(8, 86, 20, 6, METAL_D)
    c.rect(9, 87, 18, 3, RED)
    c.hline(9, 87, 18, ORANGE)
    # Гриль с решёткой и огоньками, вытяжка над ним.
    c.rect(32, 54, 28, 8, METAL)
    c.hline(32, 54, 28, PALE)
    c.rect(36, 62, 20, 6, METAL_D)
    c.rect(32, 78, 28, 14, NAVY)
    for x in range(33, 60, 3):
        c.vline(x, 78, 8, INK)
    c.hline(32, 78, 28, STEEL)
    for x in (36, 44, 52):
        c.rect(x, 74, 3, 4, ORANGE)
        c.px(x + 1, 72, GOLD)
        c.px(x + 1, 73, GOLD_L)
    c.outline(INK)
    c.save("fc3_grill")


def sushi():
    c = Canvas(64, 104)
    hanging_sign(c, NAVY, INK, RED, ["....RRRRR....", "..RRRRRRRRR..", ".RRRRRRRRRRR.", "RRRRRRRRRRRRR", ".RRRRRRRRRRR.", "..RRRRRRRRR..", "....RRRRR...."])
    menu_board(c, [ROLL, [".wwwww.", "wsssssw", "wwwwwww", ".BBBBB."], ["..ooo..", ".ooooo.", "wwwwwww", "BBBBBBB"]])
    back_kitchen(c, H("#c0cbdc"), WHITE)
    # Фонарики, ширма-норэн и деревянная полка с посудой.
    for x in (12, 52):
        c.vline(x, 54, 4, INK)
        c.round_rect(x - 4, 58, 9, 11, RED, r=3)
        c.hline(x - 3, 61, 7, RED_D)
        c.hline(x - 3, 65, 7, RED_D)
        c.px(x - 2, 59, lit(RED, 0.5))
    c.rect(20, 60, 24, 14, NAVY)
    for x in (27, 36):
        c.vline(x, 62, 12, INK)
    c.ellipse(32, 66, 3, 3, WHITE)
    c.ellipse(32, 66, 1.5, 1.5, RED)
    c.rect(18, 80, 28, 2, WOOD)
    for x, tone in ((20, WHITE), (26, RED_D), (32, WHITE), (38, NAVY)):
        c.rect(x, 76, 5, 4, tone)
        c.hline(x, 76, 5, lit(tone, 0.3))
    c.rect(48, 82, 10, 10, METAL)
    c.hline(48, 82, 10, PALE)
    c.px(52, 86, GREEN)
    c.outline(INK)
    c.save("fc3_sushi")


def coffee():
    c = Canvas(64, 104)
    hanging_sign(c, WOOD_D, WOOD_DD, CREAM, ["..W..W.....", "...W..W....", "...........", "wwwwwwwww..", "wbbbbbbbwww", "wbbbbbbbw.w", "wbbbbbbbwww", ".wwwwwww...", "WWWWWWWWW.."])
    menu_board(c, [CUP, [".sssss.", "ssYsYss", "NNNNNNN", ".NNNNN."], ["..bbb..", ".bnnnb.", "bnnnnnb", ".bbbbb."]])
    back_kitchen(c, H("#3e8948"), H("#63c74d"))
    # Полки с банками кофе и чашками.
    for y in (62, 76):
        c.rect(6, y, 52, 2, WOOD)
        c.hline(6, y, 52, lit(WOOD, 0.3))
    for x, tone in ((8, BARK), (14, GOLD), (20, BARK), (26, RED_D), (40, WHITE), (46, WHITE), (52, WHITE)):
        c.rect(x, 56, 4, 6, tone)
        c.hline(x, 56, 4, lit(tone, 0.35))
    for x in range(8, 30, 5):
        c.rect(x, 71, 4, 5, WHITE)
        c.hline(x, 72, 4, PALE)
    # Кофемашина: блестящий корпус, два рожка, манометр, чашки сверху.
    c.rect(32, 70, 26, 22, STEEL)
    c.hline(32, 70, 26, WHITE)
    c.rect(34, 73, 22, 6, METAL_D)
    c.ellipse(45, 76, 2, 2, WHITE)
    c.px(45, 76, RED)
    for x in (36, 50):
        c.rect(x, 80, 5, 3, INK)
        c.rect(x + 1, 86, 3, 4, WHITE)
    c.vline(33, 66, 4, PALE)
    c.vline(56, 66, 4, PALE)
    c.outline(INK)
    c.save("fc3_coffee")


VITRINE = {
    "pizza": [(GOLD, RED), (GOLD, GREEN), (GOLD, RED)],
    "grill": [(CREAM, GREEN), (CREAM, RED), (WOOD, GOLD)],
    "sushi": [(WHITE, ORANGE), (WHITE, PINK), (WHITE, GREEN)],
    "coffee": [(PINK, RED), (GOLD, WOOD_D), (CREAM, GOLD)],
}


def counter(sid):
    """Стойка точки: столешница из светлого камня, витрина со стеклом и едой, касса; фасад — цвет точки с полосой."""
    tone, dark, trim = BRANDS[sid]
    face = {"pizza": WOOD, "grill": WOOD_D, "sushi": H("#c28569"), "coffee": WOOD_D}[sid]
    c = Canvas(64, 36)
    # Столешница.
    c.rect(0, 6, 64, 6, PALE)
    c.hline(0, 6, 64, WHITE)
    c.hline(0, 11, 64, STEEL)
    # Фасад: панели, полоса цвета точки, цоколь.
    c.rect(1, 12, 62, 22, face)
    for x in range(1, 63, 10):
        c.vline(x, 14, 14, lit(face, -0.25))
        c.vline(x + 1, 14, 14, lit(face, 0.18))
    c.rect(1, 22, 62, 4, tone)
    c.hline(1, 22, 62, lit(tone, 0.35))
    for x in range(4, 62, 6):
        c.px(x, 24, trim)
    c.rect(1, 30, 62, 4, WOOD_DD)
    c.hline(1, 30, 62, lit(WOOD_DD, 0.3))
    # Витрина: стекло на ножках, внутри — три подноса еды.
    c.rect(4, 0, 34, 2, STEEL)
    c.hline(4, 0, 34, WHITE)
    c.rect(4, 2, 34, 6, (192, 220, 240, 110))
    c.vline(4, 0, 9, STEEL)
    c.vline(37, 0, 9, STEEL)
    for k, (base, top) in enumerate(VITRINE[sid]):
        x0 = 7 + k * 10
        c.rect(x0, 6, 8, 2, base)
        c.hline(x0, 5, 8, lit(base, 0.3))
        c.px(x0 + 2, 5, top)
        c.px(x0 + 5, 6, top)
    for i in range(4):
        c.px(8 + i * 2, 4 - i // 2, (255, 255, 255, 160))
    # Касса и салфетки справа.
    c.rect(46, 2, 12, 5, METAL_D)
    c.rect(47, 3, 7, 2, SKY)
    c.rect(54, 0, 3, 3, INK)
    c.rect(41, 4, 3, 3, WHITE)
    c.outline(INK)
    shadowed(c, 32, 34, 32, 2).save(f"fc3_{sid}_front")


def shutter():
    """Опущенная рольставня поверх стойки и кухни: точка сегодня закрыта по жалобе."""
    c = Canvas(64, 60)
    c.rect(0, 0, 64, 4, METAL_D)
    c.rect(1, 4, 62, 56, STEEL)
    for y in range(4, 60, 4):
        c.hline(1, y, 62, PALE)
        c.hline(1, y + 3, 62, METAL)
    c.rect(28, 52, 8, 6, GOLD)
    c.rect(30, 49, 4, 3, METAL_D)
    c.outline(INK)
    c.save("fc3_shutter")


# ---------------------------------------------------------------- мебель


def table(design):
    """Общий стол на шестерых (50×22 точки мира): столешница, ножки, скамья спереди; скамья сзади — отдельно
    (fc3_bench), под теми, кто сидит лицом к нам. Голый этаж — светлый пластик на стальных ножках, после «дизайна
    зала» — массив дерева и зелёные сиденья. Посередине — салфетница, соль и перец."""
    c = Canvas(100, 44)
    if design:
        top, edge, bench, seat = H("#cf9a74")[:3] + (255,), WOOD, WOOD_D, H("#3e8948")
    else:
        top, edge, bench, seat = H("#dfe6ef")[:3] + (255,), STEEL, METAL, H("#5a6988")
    # Столешница и торец.
    c.round_rect(1, 8, 98, 22, top, r=2)
    c.hline(3, 9, 94, lit(top, 0.45))
    c.hline(3, 26, 94, lit(top, -0.08))
    if design:
        for y in (14, 20):
            c.hline(2, y, 96, lit(top, -0.08))
        for x in (24, 61, 83):
            c.vline(x, 9, 20, lit(top, -0.12))
    else:
        c.speckle(3, 10, 94, 16, [lit(top, 0.25), lit(top, -0.05)], 26, 5)
    c.rect(1, 28, 98, 4, edge)
    c.hline(1, 31, 98, lit(edge, -0.35))
    # Салфетница и соль с перцем — между местами.
    for x0 in (30, 66):
        c.rect(x0, 13, 4, 5, WHITE)
        c.hline(x0, 13, 4, PALE)
        c.rect(x0 + 5, 15, 2, 3, WHITE)
        c.rect(x0 + 5, 14, 2, 1, METAL)
        c.rect(x0 + 8, 15, 2, 3, NAVY)
    # Ножки.
    for x in (6, 92):
        c.rect(x, 32, 3, 5, lit(edge, -0.3))
    # Скамья спереди.
    c.rect(5, 36, 90, 6, bench)
    c.rect(5, 36, 90, 3, seat)
    c.hline(5, 36, 90, lit(seat, 0.35))
    c.hline(5, 41, 90, lit(bench, -0.3))
    c.outline(INK)
    shadowed(c, 50, 42, 48, 2).save("fc3_table_d" if design else "fc3_table")
    b = Canvas(92, 10)
    b.rect(1, 1, 90, 8, bench)
    b.rect(1, 1, 90, 4, seat)
    b.hline(1, 1, 90, lit(seat, 0.35))
    b.hline(1, 8, 90, lit(bench, -0.3))
    b.outline(INK)
    b.save("fc3_bench_d" if design else "fc3_bench")


def trays():
    """Стойка с подносами у лифта: стопка подносов, стаканы с приборами и салфетки."""
    c = Canvas(20, 46)
    c.rect(2, 14, 16, 30, METAL)
    c.vline(2, 14, 30, STEEL)
    c.rect(4, 18, 12, 24, METAL_D)
    for k in range(5):
        tone = (RED, ORANGE, RED, ORANGE, RED)[k]
        c.rect(1, 10 - k * 2, 18, 2, tone)
        c.hline(1, 10 - k * 2, 18, lit(tone, 0.3))
    for x, tone in ((6, STEEL), (12, STEEL)):
        c.rect(x, 22, 4, 6, tone)
        c.px(x + 1, 21, PALE)
        c.px(x + 2, 20, PALE)
    c.rect(5, 32, 10, 6, WHITE)
    c.hline(5, 32, 10, PALE)
    c.outline(INK)
    shadowed(c, 10, 44, 9, 2).save("fc3_trays")


def bins():
    """Урны и приём подносов: шкаф с двумя дверцами и окошком, сверху — сданные подносы."""
    c = Canvas(20, 40)
    c.rect(1, 6, 18, 32, GREEN_D)
    c.vline(1, 6, 32, GREEN)
    c.rect(1, 6, 18, 3, GREEN)
    c.rect(4, 11, 12, 6, INK)
    c.hline(4, 16, 12, METAL_D)
    for y in (20, 29):
        c.rect(3, y, 14, 7, lit(GREEN_D, -0.15))
        c.rect(8, y + 2, 4, 2, PALE)
    for k in range(2):
        c.rect(2, 4 - k * 2, 16, 2, ORANGE if k else RED)
    c.outline(INK)
    shadowed(c, 10, 38, 9, 2).save("fc3_bins")


def planter(tall):
    """Деревянная кадка с растением: низкий куст или высокий фикус (после «дизайна зала»)."""
    h = 60 if tall else 42
    c = Canvas(30, h)
    by = h - 14
    c.rect(4, by, 22, 12, WOOD)
    c.hline(4, by, 22, lit(WOOD, 0.3))
    for x in (8, 14, 20):
        c.vline(x, by + 1, 11, WOOD_D)
    c.rect(3, by - 1, 24, 2, WOOD_D)
    rnd = random.Random(7 if tall else 3)
    if tall:
        c.vline(15, 18, by - 17, BARK)
        blobs = [(15, 10, 9, 7), (8, 18, 6, 5), (22, 17, 6, 5), (12, 26, 6, 5), (20, 28, 5, 4), (15, 4, 5, 4)]
    else:
        blobs = [(15, 14, 10, 8), (8, 20, 6, 5), (22, 20, 6, 5), (15, 6, 6, 5)]
    for cx, cy, rx, ry in blobs:
        c.ellipse(cx, cy, rx, ry, GREEN_D)
    for cx, cy, rx, ry in blobs:
        c.ellipse(cx - 1, cy - 1, rx - 2, ry - 2, GREEN)
    for _ in range(14):
        x, y = rnd.randrange(4, 26), rnd.randrange(2, by - 2)
        if c.get(x, y)[3]:
            c.px(x, y, lit(GREEN, 0.35))
    c.outline(INK)
    shadowed(c, 15, h - 2, 12, 2).save("fc3_plant_tall" if tall else "fc3_plant")


def cooler():
    """Кулер с водой у правой стены: синий бутыль, краники, стопка стаканчиков."""
    c = Canvas(18, 40)
    c.round_rect(4, 0, 10, 12, (120, 200, 255, 255), r=3)
    c.vline(6, 2, 8, WHITE)
    c.rect(3, 12, 12, 26, WHITE)
    c.vline(3, 12, 26, PALE)
    c.rect(5, 16, 8, 6, PALE)
    c.px(6, 19, BLUE)
    c.px(11, 19, RED)
    c.rect(5, 26, 8, 2, STEEL)
    c.rect(15, 16, 3, 8, WHITE)
    c.outline(INK)
    shadowed(c, 9, 38, 8, 2).save("fc3_cooler")


# ---------------------------------------------------------------- еда в руках и на столе

FOOD = {
    "pizza": ["yyyyyy", ".yRyR.", "..yy..", "...y.."],
    "grill": [".NNNN.", "NeNRNN", "NNBNNN", ".NNNN."],
    "sushi": ["kwk.kwk", "kok.kok", "BBBBBBB"],
    "coffee": [".ww.ss.", "wbbwss.", "wbbwYY.", ".ww...."],
}


def tray_food():
    """Поднос с едой в руках (14×10) и тарелки на столе: полная, надкусанная и пустая с крошками."""
    for sid, pic in FOOD.items():
        c = Canvas(16, 10)
        c.rect(0, 4, 16, 5, ORANGE)
        c.hline(0, 4, 16, lit(ORANGE, 0.3))
        c.hline(0, 8, 16, RED_D)
        c.stamp(pic, 8 - len(pic[0]) // 2, 6 - len(pic))
        c.rect(12, 3, 2, 3, WHITE)
        c.outline(INK)
        c.save(f"fc3_tray_{sid}")
        p = Canvas(14, 9)
        p.ellipse(7, 5, 6.5, 3.2, WHITE)
        p.ellipse(7, 5, 5, 2.2, PALE)
        p.stamp(pic, 7 - len(pic[0]) // 2, 6 - len(pic))
        p.outline(INK)
        p.save(f"fc3_plate_{sid}")
        # Надкусано: правая половина блюда съедена.
        q = Canvas(14, 9)
        q.ellipse(7, 5, 6.5, 3.2, WHITE)
        q.ellipse(7, 5, 5, 2.2, PALE)
        half = [row[: (len(row) + 1) // 2] for row in pic]
        q.stamp(half, 7 - len(pic[0]) // 2, 6 - len(pic))
        q.outline(INK)
        q.save(f"fc3_plate_{sid}2")
    # Пустой поднос — взяли у стойки с подносами; с пустой тарелкой — несут к урне.
    t = Canvas(16, 10)
    t.rect(0, 4, 16, 5, ORANGE)
    t.hline(0, 4, 16, lit(ORANGE, 0.3))
    t.hline(0, 8, 16, RED_D)
    t.outline(INK)
    t.save("fc3_tray")
    u = Canvas(16, 10)
    u.rect(0, 4, 16, 5, ORANGE)
    u.hline(0, 4, 16, lit(ORANGE, 0.3))
    u.hline(0, 8, 16, RED_D)
    u.ellipse(7, 5, 5, 2.2, WHITE)
    u.px(6, 5, SAND)
    u.rect(12, 2, 2, 4, WHITE)
    u.outline(INK)
    u.save("fc3_tray_done")
    e = Canvas(14, 9)
    e.ellipse(7, 5, 6.5, 3.2, WHITE)
    e.ellipse(7, 5, 5, 2.2, PALE)
    for x, y in ((5, 5), (8, 4), (9, 6)):
        e.px(x, y, SAND)
    e.outline(INK)
    e.save("fc3_plate")


def talk():
    """Облачко разговора: белое, с хвостиком внизу слева и тремя точками."""
    c = Canvas(16, 13)
    c.round_rect(1, 1, 14, 9, WHITE, r=3)
    c.px(3, 10, WHITE)
    c.px(3, 11, WHITE)
    c.px(2, 12, WHITE)
    for x in (4, 7, 10):
        c.rect(x, 5, 2, 2, NAVY)
    c.outline(INK)
    c.save("fc3_talk")


def note():
    """Нота над сценой — две: восьмая и две связанные."""
    a = Canvas(8, 10)
    a.vline(5, 0, 7, INK)
    a.ellipse(3.5, 7.5, 2.5, 2, INK)
    a.px(6, 1, INK)
    a.px(7, 2, INK)
    a.save("fc3_note")
    b = Canvas(10, 10)
    for x in (3, 8):
        b.vline(x, 1, 6, INK)
        b.ellipse(x - 1.5, 7.5, 2.2, 1.8, INK)
    b.hline(3, 1, 6, INK)
    b.hline(3, 2, 6, INK)
    b.save("fc3_note2")


# ---------------------------------------------------------------- детская зона и сцена


def kids():
    """Детская зона: мягкий коврик-пазл с бортиком, горка, сухой бассейн с шариками (спереди — бортик отдельно,
    чтобы ребёнок «сидел» в шариках), лошадка-качалка."""
    m = Canvas(140, 58)
    tiles = [H("#63c74d"), H("#feae34"), H("#2ce8f5"), H("#f6757a"), H("#b55088"), H("#0099db")]
    for gy in range(4):
        for gx in range(9):
            tone = tiles[(gx + gy * 3) % len(tiles)]
            x, y = 4 + gx * 14, 4 + gy * 12
            m.rect(x, y, 14, 12, tone)
            m.hline(x, y, 14, lit(tone, 0.3))
            m.px(x + 7, y, lit(tone, -0.3))
            m.px(x, y + 6, lit(tone, -0.3))
    m.rect(130, 4, 6, 48, tiles[0])
    m.frame(2, 2, 136, 52, WHITE)
    m.frame(3, 3, 134, 50, PALE)
    m.outline(INK)
    m.save("fc3_kmat")
    s = Canvas(40, 44)
    # Лесенка слева, площадка, жёлтый скат вправо-вниз.
    for y in range(8, 40, 5):
        s.hline(4, y, 7, WHITE)
    s.vline(3, 6, 36, RED)
    s.vline(11, 6, 36, RED)
    s.rect(2, 4, 12, 3, BLUE)
    for k in range(26):
        s.hline(12 + k, 8 + k, 5, GOLD)
        s.px(12 + k, 8 + k, GOLD_L)
        s.px(16 + k, 8 + k, ORANGE)
    s.rect(36, 34, 4, 8, GOLD)
    s.outline(INK)
    shadowed(s, 20, 42, 18, 2).save("fc3_slide")
    p = Canvas(44, 26)
    p.round_rect(0, 0, 44, 24, BLUE, r=5)
    p.round_rect(3, 3, 38, 14, lit(BLUE, -0.4), r=4)
    rnd = random.Random(11)
    for _ in range(70):
        x, y = rnd.randrange(4, 40), rnd.randrange(4, 17)
        p.px(x, y, rnd.choice([RED, GOLD, GREEN, SKY, PINK, WHITE]))
    p.outline(INK)
    shadowed(p, 22, 24, 21, 2).save("fc3_pit")
    f = Canvas(44, 12)
    f.round_rect(0, 0, 44, 10, BLUE, r=3)
    f.hline(2, 1, 40, lit(BLUE, 0.4))
    rnd = random.Random(12)
    for _ in range(12):
        f.ellipse(rnd.randrange(4, 40), 0.5, 1.6, 1.6, rnd.choice([RED, GOLD, GREEN, PINK]))
    f.outline(INK)
    f.save("fc3_pit_f")
    h = Canvas(22, 20)
    h.ellipse(11, 17, 10, 2.4, WOOD_D)
    h.rect(5, 8, 12, 5, WHITE)
    h.rect(14, 3, 4, 6, WHITE)
    h.rect(17, 3, 3, 3, WHITE)
    h.vline(14, 2, 4, RED)
    h.vline(6, 13, 3, RED)
    h.vline(15, 13, 3, RED)
    h.px(18, 4, INK)
    h.outline(INK)
    h.save("fc3_horse")


def stage():
    """Сцена у правой стены (52×24 точки мира): деревянный помост с юбкой, колонки по краям, стойка микрофона,
    задник с лампочками."""
    c = Canvas(104, 50)
    # Задник: тёмная ткань с рядом лампочек.
    c.rect(10, 0, 84, 18, PLUM)
    for x in range(12, 92, 4):
        c.vline(x, 0, 18, lit(PLUM, -0.2))
    for x in range(14, 92, 8):
        c.px(x, 2, GOLD_L)
    # Помост.
    c.rect(2, 16, 100, 16, BARK)
    for y in range(18, 32, 4):
        c.hline(2, y, 100, lit(BARK, -0.25))
    c.hline(2, 16, 100, lit(BARK, 0.35))
    c.rect(2, 32, 100, 14, RED_D)
    for x in range(4, 102, 6):
        c.vline(x, 32, 14, WINE)
    c.hline(2, 32, 100, RED)
    c.hline(2, 45, 100, INK)
    # Колонки.
    for x in (2, 88):
        c.rect(x, 4, 14, 22, NAVY)
        c.hline(x, 4, 14, METAL)
        c.ellipse(x + 7, 11, 4, 4, INK)
        c.ellipse(x + 7, 11, 1.5, 1.5, METAL)
        c.ellipse(x + 7, 20, 3, 3, INK)
    # Стойка микрофона.
    c.vline(52, 6, 22, METAL_D)
    c.ellipse(52, 5, 2, 2, STEEL)
    c.hline(48, 28, 9, METAL_D)
    c.outline(INK)
    shadowed(c, 52, 47, 50, 2).save("fc3_stage")
    g = Canvas(18, 10)
    g.ellipse(5, 6, 4.5, 3.5, WOOD)
    g.ellipse(5, 6, 1.4, 1.4, WOOD_DD)
    g.rect(9, 5, 8, 2, WOOD_D)
    g.rect(16, 4, 2, 4, BARK)
    g.outline(INK)
    g.save("fc3_guitar")


def main():
    city()
    cloud()
    frame()
    wainscot()
    floor_tiles()
    lift()
    pizza()
    grill()
    sushi()
    coffee()
    for sid in BRANDS:
        counter(sid)
    shutter()
    table(False)
    table(True)
    trays()
    bins()
    planter(False)
    planter(True)
    cooler()
    tray_food()
    talk()
    note()
    kids()
    stage()


if __name__ == "__main__":
    main()
