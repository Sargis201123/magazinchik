"""Ферма «Лавки» — рисунок крупнее и понятнее (третья раскладка, по просьбе автора 07.11): большие грядки-короба и
культуры на них по стадиям, ульи, куры и яйца в гнездовом ящике, корова, маленький амбар, яблоня с яблоками и без.
Чем крупнее силуэт и чище цвет, тем лучше читается на телефоне: контур #181425, свет сверху-слева, три тона.
Ставит art/lavka.py.
"""

import math
import random

from PIL import Image

from premium import H, lit
from sprites import Canvas

INK = H("#181425")
WHITE = H("#ffffff")
WOOD, WOOD_D, WOOD_DD, WOOD_L, WOOD_LL = H("#b86f50"), H("#8f563b"), H("#733e39"), H("#d9955f"), H("#e4a672")
SOIL, SOIL_D, SOIL_DD, SOIL_L = H("#6b4433"), H("#4e3128"), H("#3e2731"), H("#8a5a44")
LEAF, LEAF_D, LEAF_DD, LEAF_L, LEAF_LL = H("#63c74d"), H("#3e8948"), H("#265c42"), H("#98c95a"), H("#c4e67a")
RED, RED_D, RED_L = H("#e43b44"), H("#a22633"), H("#f6757a")
ORANGE, ORANGE_D, ORANGE_L = H("#f77622"), H("#be4a2f"), H("#feae34")
YELLOW, YELLOW_D = H("#fee761"), H("#feae34")
CREAM, CREAM_D = H("#f4ead6"), H("#cfc0a3")
GREY, GREY_D, GREY_L = H("#8b9bb4"), H("#5a6988"), H("#c0cbdc")
STRAW, STRAW_D, STRAW_L = H("#e7cc9f"), H("#c49a6c"), H("#f8ebcf")
PINK, PINK_D = H("#f6a5a5"), H("#e07b7b")

BED_W, BED_H = 84, 44
CROP_TOP = 14  # растения выше борта: картинка культур на столько выше грядки


# ---------------------------------------------------------------- огород


def raised_bed(seed=0, w=BED_W, h=BED_H):
    """Грядка-короб: толстые доски с торцами-столбиками, рыхлая тёмная земля гребнями."""
    c = Canvas(w, h)
    rnd = random.Random(seed)
    # борт: верхняя кромка светлая, передняя стенка (низ) — высокая и темнее, видно, что короб приподнят
    c.rect(1, 1, w - 2, h - 2, WOOD)
    c.hline(1, 1, w - 2, WOOD_LL)
    c.hline(1, 2, w - 2, WOOD_L)
    c.rect(1, h - 9, w - 2, 8, WOOD_D)
    c.hline(1, h - 9, w - 2, WOOD)
    c.hline(1, h - 5, w - 2, WOOD_DD)
    for x in range(12, w - 8, 22):  # шляпки гвоздей и стыки досок
        c.px(x, h - 7, WOOD_DD)
        c.px(x, h - 3, WOOD_DD)
    # земля
    c.rect(6, 6, w - 12, h - 15, SOIL)
    rows = 2
    rh = (h - 15) / rows
    for r in range(rows):
        y0 = 6 + int(r * rh)
        y1 = 6 + int((r + 1) * rh)
        c.hline(6, y0, w - 12, SOIL_DD)            # борозда
        c.hline(6, y0 + 1, w - 12, SOIL_D)
        c.hline(6, y0 + 3, w - 12, SOIL_L)          # гребень на свету
        for _ in range((w - 12) // 5):
            x = rnd.randrange(7, w - 7)
            y = rnd.randrange(y0 + 2, y1 - 1)
            c.px(x, y, rnd.choice((SOIL_L, SOIL_D, SOIL_L)))
    # торцы-столбики по углам
    for x in (1, w - 7):
        c.rect(x, 1, 6, 6, WOOD_D)
        c.hline(x, 1, 6, WOOD_L)
        c.px(x + 2, 3, WOOD_DD)
    c.outline(INK)
    return c.img


def _sprout(c, x, y):
    c.vline(x, y - 3, 3, LEAF_D)
    c.px(x - 1, y - 4, LEAF)
    c.px(x - 2, y - 4, LEAF_L)
    c.px(x + 1, y - 4, LEAF)
    c.px(x + 2, y - 5, LEAF_L)


def _dill(c, x, y, big, rnd):
    """Укроп: тонкие стебли с перистыми веточками врозь; спелый — с жёлтыми зонтиками."""
    hgt = 17 if big else 11
    for dx, lean in ((-4, -2), (0, 0), (4, 2)):
        top = hgt - abs(dx) // 2
        for k in range(top):
            xx = x + dx + (lean * k) // top
            c.px(xx, y - k, LEAF_D if k < 4 else LEAF)
            if k > 3 and k % 3 == 1:
                c.px(xx - 1, y - k - 1, LEAF_L)
                c.px(xx + 1, y - k - 1, LEAF_L)
        if big:
            ux = x + dx + lean
            uy = y - top
            c.px(ux - 2, uy, YELLOW_D)
            c.px(ux + 2, uy, YELLOW_D)
            c.hline(ux - 1, uy - 1, 3, YELLOW)
            c.px(ux, uy - 2, YELLOW)


def _carrot(c, x, y, big, rnd):
    hgt = 12 if big else 8
    for ang in (-0.55, -0.2, 0.15, 0.5):
        for k in range(hgt):
            xx = x + int(math.sin(ang) * k)
            yy = y - 2 - int(math.cos(ang) * k)
            c.px(xx, yy, LEAF if k > 2 else LEAF_D)
            if k > 3 and k % 3 == 0:
                c.px(xx + (1 if ang > 0 else -1), yy, LEAF_L)
    if big:  # оранжевые плечики корнеплода из земли
        c.rect(x - 2, y - 2, 5, 3, ORANGE)
        c.hline(x - 2, y - 2, 5, ORANGE_L)
        c.px(x + 2, y, ORANGE_D)
        c.hline(x - 1, y + 1, 3, ORANGE_D)


def _leaf3(c, x, y, col, hi):
    """Тройчатый лист клубники."""
    for dx, dy in ((-3, -1), (0, -3), (3, -1)):
        c.ellipse(x + dx + 0.5, y + dy + 0.5, 2.3, 1.9, col)
        c.px(x + dx, y + dy - 1, hi)


def _strawberry(c, x, y, stage, rnd):
    _leaf3(c, x - 3, y - 3, LEAF_D, LEAF)
    _leaf3(c, x + 3, y - 4, LEAF, LEAF_L)
    _leaf3(c, x, y - 7, LEAF, LEAF_L)
    if stage == 2:
        for fx, fy in ((-5, -9), (5, -10)):
            c.ellipse(x + fx + 0.5, y + fy + 0.5, 1.8, 1.8, WHITE)
            c.px(x + fx, y + fy, YELLOW)
    if stage == 3:
        for fx, fy in ((-6, -1), (6, -2), (0, 0)):
            bx, by = x + fx, y + fy
            c.rect(bx - 2, by - 2, 5, 4, RED)
            c.hline(bx - 1, by + 2, 3, RED)
            c.px(bx, by + 3, RED_D)
            c.px(bx - 1, by - 1, RED_L)
            c.px(bx + 1, by, YELLOW)
            c.px(bx - 1, by + 1, YELLOW)
            c.hline(bx - 1, by - 3, 3, LEAF)


def _pumpkin_leaf(c, x, y, r, col, hi):
    c.ellipse(x + 0.5, y + 0.5, r, r * 0.8, col)
    c.px(x - 1, y - 1, hi)
    c.px(x, y - int(r * 0.6), hi)
    c.line(x, y, x + int(r * 0.6), y + int(r * 0.5), LEAF_DD)


def _pumpkin(c, x, y, stage, rnd):
    # плеть с крупными листьями
    c.line(x - 10, y - 1, x + 10, y - 2, LEAF_D)
    _pumpkin_leaf(c, x - 7, y - 5, 4.2, LEAF, LEAF_L)
    _pumpkin_leaf(c, x + 8, y - 6, 4.5, LEAF_D, LEAF)
    if stage == 2:
        c.ellipse(x + 1.5, y - 3.5, 1.8, 1.8, YELLOW)
        c.px(x + 1, y - 4, YELLOW_D)
    if stage == 3:  # тыква
        px, py = x + 1, y - 4
        c.ellipse(px + 0.5, py + 0.5, 7.5, 5.5, ORANGE)
        for dx in (-4, 0, 4):
            c.vline(px + dx, py - 3, 7, ORANGE_D)
        c.px(px - 3, py - 3, ORANGE_L)
        c.px(px - 2, py - 4, ORANGE_L)
        c.hline(px - 5, py + 5, 11, ORANGE_D)
        c.rect(px, py - 7, 2, 3, LEAF_DD)
        c.px(px + 2, py - 7, LEAF_D)


def crops(seed, stage, bed_seed=0, w=BED_W, h=BED_H):
    """Культуры на грядке w×(h+CROP_TOP): два ряда по гребням. stage 1 — всходы, 2 — растёт, 3 — поспело."""
    hh = h + CROP_TOP
    c = Canvas(w, hh)
    rnd = random.Random(bed_seed * 13 + stage)
    rows = (CROP_TOP + 16, CROP_TOP + 30) if seed != "pumpkin" else (CROP_TOP + 26,)
    cols = 3 if seed == "pumpkin" else 4
    for ri, ry in enumerate(rows):
        for k in range(cols):
            span = (w - 26) / (cols - 1)
            x = int(13 + k * span + (ri % 2) * 6) - (3 if ri % 2 else 0)
            x = max(11, min(w - 12, x))
            y = ry + rnd.randrange(-1, 2)
            if stage == 1:
                _sprout(c, x, y)
            elif seed == "dill":
                _dill(c, x, y, stage == 3, rnd)
            elif seed == "carrot":
                _carrot(c, x, y, stage == 3, rnd)
            elif seed == "strawberry":
                _strawberry(c, x, y, stage, rnd)
            elif seed == "pumpkin":
                _pumpkin(c, x, y, stage, rnd)
    c.outline(INK)
    return c.img


# ---------------------------------------------------------------- сад и пасека


def hive(color=0):
    """Улей 40×54 (как настоящий): крыша-домик с жестью, два корпуса с ручками, леток с прилётной доской,
    подставка на ножках, по корпусу — капля мёда."""
    w, h = 40, 54
    c = Canvas(w, h)
    body, body_d, body_l = ((YELLOW, YELLOW_D, H("#fff3a8")), (H("#8fd3ff"), H("#4fa4d9"), H("#d7f1ff")), (H("#b7e07a"), LEAF, H("#e2f5b8")))[color % 3]
    # ножки и подставка
    for x in (7, 30):
        c.rect(x, 46, 3, 7, WOOD_D)
        c.px(x, 46, WOOD)
    c.rect(4, 44, 32, 3, WOOD)
    c.hline(4, 44, 32, WOOD_L)
    # нижний корпус
    c.rect(5, 28, 30, 16, body)
    c.hline(5, 28, 30, body_l)
    c.vline(5, 28, 16, body_l)
    c.vline(34, 28, 16, body_d)
    c.hline(5, 43, 30, body_d)
    c.rect(15, 33, 10, 2, body_d)          # ручка-прорезь
    # прилётная доска и леток
    c.rect(11, 40, 18, 2, INK)
    c.rect(9, 42, 22, 2, WOOD_L)
    c.hline(9, 43, 22, WOOD_D)
    # верхний корпус (магазин)
    c.rect(5, 16, 30, 12, body)
    c.hline(5, 16, 30, body_l)
    c.vline(5, 16, 12, body_l)
    c.vline(34, 16, 12, body_d)
    c.hline(5, 27, 30, body_d)
    c.rect(15, 20, 10, 2, body_d)
    # мёд течёт по шву
    c.vline(27, 27, 4, ORANGE_L)
    c.px(27, 31, ORANGE)
    c.px(28, 27, YELLOW)
    # крыша: жесть, свес, конёк
    for i in range(6):
        c.hline(3 + i, 15 - i, 34 - 2 * i, GREY_L if i < 2 else GREY)
    c.hline(1, 15, 38, GREY_D)
    c.hline(2, 14, 36, GREY)
    c.hline(9, 9, 22, WHITE)
    c.hline(10, 10, 20, GREY_L)
    c.rect(16, 6, 8, 3, RED_D)               # кирпич на крыше — чтобы ветром не сдуло
    c.hline(16, 6, 8, RED)
    c.outline(INK)
    return c.img


def apple_tree(apples=True, seed=0):
    """Яблоня 78×92: ствол с развилкой, крона облаками в три тона; apples — спелые яблоки по кроне."""
    w, h = 78, 92
    c = Canvas(w, h)
    rnd = random.Random(seed)
    # ствол
    c.rect(35, 56, 9, 34, WOOD_D)
    c.vline(35, 56, 34, WOOD)
    c.vline(36, 60, 28, WOOD)
    c.vline(43, 56, 34, WOOD_DD)
    c.line(39, 64, 28, 54, WOOD_D)
    c.line(40, 62, 50, 52, WOOD_D)
    c.hline(31, 89, 17, WOOD_D)
    # крона: облака
    blobs = [(39, 30, 30, 24), (20, 40, 16, 13), (58, 40, 16, 13), (28, 20, 15, 13), (52, 22, 15, 13), (39, 48, 22, 10)]
    for bx, by, rx, ry in blobs:
        c.ellipse(bx, by, rx, ry, LEAF_D)
    for bx, by, rx, ry in blobs:
        c.ellipse(bx - 2, by - 2, rx - 4, ry - 4, LEAF)
    for bx, by, rx, ry in blobs[:5]:
        c.ellipse(bx - 5, by - 5, rx * 0.45, ry * 0.4, LEAF_L)
    for _ in range(40):  # листочки на кромках
        a = rnd.random() * math.tau
        bx, by, rx, ry = rnd.choice(blobs)
        x, y = int(bx + math.cos(a) * (rx - 3)), int(by + math.sin(a) * (ry - 3))
        c.px(x, y, rnd.choice((LEAF_DD, LEAF_L)))
    if apples:
        spots = [(22, 34), (34, 22), (50, 30), (60, 42), (28, 46), (44, 44), (16, 44), (54, 18), (40, 34), (30, 32)]
        for ax, ay in spots:
            c.rect(ax, ay, 4, 4, RED)
            c.hline(ax, ay + 3, 4, RED_D)
            c.vline(ax + 3, ay, 4, RED_D)
            c.px(ax, ay, RED_L)
            c.px(ax + 1, ay - 1, WOOD_DD)
    c.outline(INK)
    return c.img


# ---------------------------------------------------------------- куры


def hen(variant=0, peck=False):
    """Курица 26×24 боком (смотрит вправо): пухлое тело, крыло, хвост торчком, красный гребень и бородка,
    жёлтый клюв, глаз с бликом, ноги. variant 0 — белая, 1 — рыжая, 2 — пёстрая; peck — клюёт (голова внизу)."""
    w, h = 26, 24
    c = Canvas(w, h)
    body, shade, light = ((WHITE, GREY_L, WHITE), (H("#c86b3c"), H("#8f4a2a"), H("#e4955f")), (H("#e4cfae"), H("#a88a6a"), H("#f8ebcf")))[variant % 3]
    # ноги
    for x in (11, 15):
        c.vline(x, 18, 4, ORANGE_L)
        c.hline(x - 1, 22, 3, ORANGE_L)
    # хвост
    c.ellipse(5.5, 8.5, 4, 5, shade)
    c.ellipse(5.5, 7.5, 3, 4, body)
    c.px(3, 4, shade)
    # тело
    c.ellipse(13, 13, 9.5, 6.5, body)
    c.hline(6, 18, 14, shade)
    c.hline(8, 19, 10, shade)
    # крыло
    c.ellipse(12.5, 13.5, 5, 3.4, light)
    c.hline(9, 15, 8, shade)
    c.hline(10, 16, 6, shade)
    if variant == 2:  # крапинки
        for x, y in ((8, 11), (11, 10), (15, 12), (17, 9), (13, 17)):
            c.px(x, y, shade)
    # голова
    hx, hy = (20, 14) if peck else (19, 6)
    c.ellipse(hx + 0.5, hy + 0.5, 3.6, 3.6, body)
    c.px(hx + 1, hy - 1, INK)                         # глаз
    c.px(hx + 1, hy - 2, WHITE) if variant else None
    for i, dx in enumerate((-1, 0, 1)):               # гребень
        c.px(hx + dx, hy - 4 - (i % 2), RED)
        c.px(hx + dx, hy - 3, RED)
    c.rect(hx + 4, hy, 2, 1, ORANGE_L)                # клюв
    c.px(hx + 4, hy + 1, ORANGE)
    c.px(hx + 3, hy + 2, RED)                         # бородка
    c.px(hx + 3, hy + 3, RED_D)
    if not peck:  # шея
        c.rect(hx - 2, hy + 2, 4, 4, body)
    else:
        c.rect(hx - 3, hy - 4, 4, 5, body)
    c.outline(INK)
    return c.img


def chick(hop=False):
    w, h = 12, 11
    c = Canvas(w, h)
    y = 0 if hop else 1
    c.ellipse(5.5, 5.5 + y, 3.6, 3.2, YELLOW)
    c.px(4, 4 + y, H("#fff3a8"))
    c.ellipse(7.5, 3.5 + y, 2.2, 2.2, YELLOW)
    c.px(8, 3 + y, INK)
    c.px(10, 4 + y, ORANGE)
    c.vline(5, 9, 1, ORANGE)
    c.vline(7, 9, 1, ORANGE)
    c.outline(INK)
    return c.img


def egg(brown=False):
    """Яйцо 10×12: овал, блик сверху-слева, тень снизу-справа."""
    c = Canvas(10, 12)
    base, shade, hi = (H("#e8b796"), H("#c28569"), H("#f8dcc4")) if brown else (WHITE, GREY_L, WHITE)
    c.ellipse(5, 6.3, 3.6, 4.6, base)
    c.px(6, 9, shade)
    c.hline(4, 10, 3, shade)
    c.px(7, 8, shade)
    c.px(3, 3, hi)
    c.px(3, 4, hi)
    c.outline(INK)
    return c.img


def nest_box():
    """Гнездовой ящик 88×46: три ячейки с соломой, крыша-доска с навесом. Яйца сцена кладёт в ячейки
    (середины x 15, 44, 73, низ — y 37)."""
    w, h = 88, 46
    c = Canvas(w, h)
    c.rect(1, 6, w - 2, h - 7, WOOD_D)
    for i in range(3):
        x0 = 4 + i * 29
        c.rect(x0, 11, 24, 27, H("#2a1d26"))           # тёмная ячейка
        c.rect(x0, 30, 24, 8, STRAW)                    # солома
        for k in range(0, 24, 3):
            c.px(x0 + k, 29, STRAW_L)
            c.px(x0 + k + 1, 31, STRAW_D)
        c.hline(x0, 37, 24, STRAW_D)
    for x in (1, 30, 59, 85):                            # стойки
        c.rect(x, 6, 3, h - 7, WOOD)
        c.vline(x, 6, h - 7, WOOD_L)
    c.rect(1, 38, w - 2, 6, WOOD)                        # передняя доска
    c.hline(1, 38, w - 2, WOOD_L)
    c.hline(1, 43, w - 2, WOOD_DD)
    c.rect(0, 2, w, 5, WOOD_DD)                          # крыша-навес
    c.hline(0, 2, w, WOOD)
    c.hline(0, 3, w, WOOD_L)
    c.outline(INK)
    return c.img


# ---------------------------------------------------------------- корова и амбар


def cow(head=0, tail=0):
    """Корова 66×50 боком (смотрит вправо): белая с чёрными пятнами, розовое вымя и нос, рожки, ухо,
    колокольчик. head 0 — голова поднята, 1 — щиплет траву; tail 0 — висит, 1 — отмахивается."""
    w, h = 66, 50
    c = Canvas(w, h)
    body, shade, spot, spot_l = WHITE, GREY_L, H("#262b44"), H("#3a4466")
    # дальние ноги
    for x in (16, 42):
        c.rect(x, 33, 5, 12, shade)
        c.rect(x, 44, 5, 3, GREY_D)
    # хвост
    if tail:
        c.line(9, 16, 3, 26, shade)
        c.line(9, 17, 4, 27, body)
        c.rect(1, 26, 4, 5, spot)
    else:
        c.vline(8, 16, 16, shade)
        c.vline(9, 16, 15, body)
        c.rect(7, 31, 4, 5, spot)
    # тело
    c.round_rect(9, 13, 42, 24, body, r=5)
    c.hline(12, 36, 36, shade)
    c.hline(14, 37, 32, shade)
    c.hline(12, 13, 36, WHITE)
    # пятна — крупные, нарисованные, не случайные
    c.ellipse(21, 19, 7, 5, spot)
    c.ellipse(19, 18, 4, 3, spot_l)
    c.ellipse(39, 26, 6, 5.5, spot)
    c.ellipse(37.5, 24.5, 3, 2.5, spot_l)
    c.ellipse(46, 16, 4, 3, spot)
    c.ellipse(13, 30, 3, 3, spot)
    # вымя
    c.ellipse(32, 38, 5, 3, PINK)
    c.hline(29, 40, 7, PINK_D)
    for x in (29, 32, 35):
        c.vline(x, 40, 2, PINK_D)
    # ближние ноги
    for x in (12, 46):
        c.rect(x, 34, 6, 12, body)
        c.vline(x + 5, 34, 12, shade)
        c.rect(x, 45, 6, 3, GREY_D)
        c.hline(x, 45, 6, GREY)
    # голова
    if head:
        hx, hy = 51, 30
        c.line(48, 18, 54, 30, body)
        c.rect(48, 18, 6, 12, body)
    else:
        hx, hy = 52, 9
        c.rect(47, 14, 7, 10, body)
    c.round_rect(hx, hy, 12, 14, body, r=2)
    c.vline(hx + 11, hy + 1, 12, shade)
    c.rect(hx + 3, hy + 2, 5, 5, spot)                   # пятно вокруг глаза
    c.px(hx + 6, hy + 4, INK)
    c.px(hx + 5, hy + 3, WHITE)
    c.rect(hx + 2, hy + 9, 11, 6, PINK)                  # нос
    c.hline(hx + 2, hy + 14, 11, PINK_D)
    c.px(hx + 6, hy + 11, PINK_D)
    c.px(hx + 10, hy + 11, PINK_D)
    c.rect(hx - 3, hy + 2, 4, 3, shade)                  # ухо
    c.px(hx - 3, hy + 2, PINK)
    c.rect(hx + 2, hy - 3, 2, 3, CREAM)                  # рожки
    c.rect(hx + 8, hy - 3, 2, 3, CREAM)
    c.px(hx + 2, hy - 3, CREAM_D)
    if not head:  # колокольчик на шее
        c.rect(48, 23, 4, 4, YELLOW)
        c.px(48, 23, H("#fff3a8"))
        c.px(51, 26, YELLOW_D)
        c.hline(47, 22, 7, RED_D)
    c.outline(INK)
    return c.img


def barn():
    """Амбар 116×112 фасадом: двускатная крыша с конька, красные доски, белые наличники, большие ворота
    крест-накрест, сеновал с сеном, каменный цоколь."""
    w, h = 116, 112
    c = Canvas(w, h)
    RED_B, RED_BD, RED_BL = H("#b13a3a"), H("#8a2a33"), H("#d9574f")
    ROOF, ROOF_D, ROOF_L = H("#5a6988"), H("#3a4466"), H("#8b9bb4")
    peak, base_y = 8, 48
    # стена с фронтоном
    for y in range(peak + 6, h - 6):
        half = 52 if y >= base_y else int((y - peak) * 52 / (base_y - peak))
        c.hline(58 - half, y, 2 * half, RED_B)
    for x in range(10, 106, 6):                         # доски
        for y in range(peak + 6, h - 6):
            if c.get(x, y)[3]:
                c.px(x, y, RED_BD)
                if c.get(x + 1, y)[3]:
                    c.px(x + 1, y, RED_BL) if (y // 9) % 3 == 0 else None
    # крыша: две толстые полосы от конька
    for t in range(8):
        for x in range(0, 59):
            y = base_y - int(x * (base_y - peak) / 58) + t - 6
            col = ROOF_L if t < 2 else ROOF if t < 6 else ROOF_D
            c.px(x, y, col)
            c.px(w - 1 - x, y, col)
    # белые углы
    c.rect(6, base_y + 2, 3, h - base_y - 8, CREAM)
    c.rect(w - 9, base_y + 2, 3, h - base_y - 8, CREAM)
    # сеновал
    c.rect(46, 26, 24, 18, CREAM)
    c.rect(48, 28, 20, 14, H("#2a1d26"))
    c.rect(48, 34, 20, 8, STRAW)
    for x in range(48, 68, 2):
        c.px(x, 33, STRAW_L)
        c.px(x + 1, 41, STRAW_D)
    # ворота
    c.rect(30, 62, 56, 44, CREAM)
    c.rect(33, 65, 24, 41, RED_B)
    c.rect(59, 65, 24, 41, RED_B)
    for x0 in (33, 59):
        c.line(x0, 65, x0 + 23, 105, CREAM)
        c.line(x0 + 23, 65, x0, 105, CREAM)
        c.line(x0 + 1, 65, x0 + 23, 104, CREAM)
        c.line(x0 + 22, 65, x0, 104, CREAM)
    c.vline(58, 62, 44, CREAM_D)
    # цоколь
    c.rect(4, h - 6, w - 8, 5, GREY)
    for x in range(6, w - 6, 7):
        c.vline(x, h - 6, 5, GREY_D)
    c.hline(4, h - 6, w - 8, GREY_L)
    c.outline(INK)
    return c.img


def hay_bale():
    """Тюк сена 34×24 (вместо стога): обвязка, торец с завитком."""
    c = Canvas(34, 24)
    c.round_rect(1, 3, 32, 19, STRAW, r=3)
    c.hline(2, 3, 30, STRAW_L)
    c.hline(2, 21, 30, STRAW_D)
    for x in (9, 24):
        c.vline(x, 3, 19, H("#a22633"))
    rnd = random.Random(4)
    for _ in range(40):
        c.px(rnd.randrange(3, 31), rnd.randrange(5, 20), rnd.choice((STRAW_D, STRAW_L)))
    c.outline(INK)
    return c.img


# ---------------------------------------------------------------- четвёртая раскладка: крупные постройки


def barn_big():
    """Амбар 180×156 фасадом: двускатная крыша черепицей с коньком, сеновал с балкой и крюком, ворота
    крест-накрест (одна створка приоткрыта — внутри сено), окошки с наличниками, фонарь, каменный цоколь."""
    w, h = 180, 156
    c = Canvas(w, h)
    rnd = random.Random(7)
    RED_B, RED_BD, RED_BL = H("#b13a3a"), H("#8a2a33"), H("#d9574f")
    ROOF, ROOF_D, ROOF_L = H("#5a6988"), H("#3a4466"), H("#8b9bb4")
    peak, eave, base = 6, 62, h - 8
    mid = w // 2
    # стена с фронтоном
    for y in range(peak + 8, base):
        half = 80 if y >= eave else int((y - peak) * 80 / (eave - peak))
        c.hline(mid - half, y, 2 * half, RED_B)
    for x in range(mid - 80, mid + 80, 7):
        for y in range(peak + 8, base):
            if c.get(x, y)[3]:
                c.px(x, y, RED_BD)
                if (y + x) % 23 == 0:
                    c.px(x + 2, y, RED_BL)
    for y in range(eave + 2, base, 9):  # свет на досках слева
        c.hline(mid - 78, y, 2, RED_BL)
    # крыша: толстые скаты черепицей, свес
    for t in range(12):
        for x in range(0, mid + 1):
            y = eave - int(x * (eave - peak) / mid) + t - 10
            col = ROOF_L if t < 2 else (ROOF if (x // 4 + t // 3) % 2 else lit(ROOF, -0.08)) if t < 9 else ROOF_D
            c.px(x, y, col)
            c.px(w - 1 - x, y, col)
    c.rect(mid - 3, peak - 2, 6, 5, ROOF_D)
    # белые углы и балка
    c.rect(mid - 80, eave, 4, base - eave, CREAM)
    c.rect(mid + 76, eave, 4, base - eave, CREAM)
    c.rect(mid - 76, eave + 2, 152, 3, CREAM_D)
    # сеновал: дверца, сено, балка с крюком
    c.rect(mid - 16, 26, 32, 28, CREAM)
    c.rect(mid - 13, 29, 26, 22, H("#2a1d26"))
    c.rect(mid - 13, 38, 26, 13, STRAW)
    for x in range(mid - 13, mid + 13, 2):
        c.px(x, 37, STRAW_L)
        c.px(x + 1, 50, STRAW_D)
    c.rect(mid - 2, 18, 4, 8, WOOD_D)
    c.vline(mid, 26, 6, GREY_D)
    c.px(mid + 1, 31, GREY_D)
    # окошки
    for wx in (mid - 62, mid + 44):
        c.rect(wx, eave + 14, 18, 16, CREAM)
        c.rect(wx + 2, eave + 16, 14, 12, H("#3a4466"))
        c.rect(wx + 3, eave + 17, 5, 4, H("#8fd3ff"))
        c.vline(wx + 8, eave + 16, 12, CREAM)
        c.hline(wx + 2, eave + 21, 14, CREAM)
        c.rect(wx - 1, eave + 30, 20, 3, WOOD)
        c.px(wx + 3, eave + 29, H("#e43b44"))       # цветы в ящике
        c.px(wx + 9, eave + 29, YELLOW)
        c.px(wx + 14, eave + 29, H("#e43b44"))
    # ворота: левая створка закрыта (крест), правая приоткрыта — видно сено
    gx, gy, gw, gh = mid - 34, eave + 20, 68, base - eave - 20
    c.rect(gx - 3, gy - 3, gw + 6, gh + 3, CREAM)
    c.rect(gx, gy, gw, gh, H("#2a1d26"))
    c.rect(gx + 36, gy + gh - 18, 30, 18, STRAW)
    for x in range(gx + 36, gx + 66, 2):
        c.px(x, gy + gh - 19, STRAW_L)
    c.rect(gx, gy, 33, gh, RED_B)
    c.line(gx, gy, gx + 32, gy + gh - 1, CREAM)
    c.line(gx + 32, gy, gx, gy + gh - 1, CREAM)
    c.frame(gx, gy, 33, gh, CREAM)
    c.rect(gx + 58, gy, 10, gh, RED_BD)               # приоткрытая створка — в тени
    c.vline(gx + 58, gy, gh, CREAM)
    # фонарь над воротами
    c.rect(mid - 2, gy - 12, 5, 6, YELLOW)
    c.px(mid - 1, gy - 11, WHITE)
    c.hline(mid - 3, gy - 13, 7, INK)
    # цоколь
    c.rect(mid - 82, base, 164, 7, GREY)
    for x in range(mid - 80, mid + 82, 9):
        c.vline(x, base, 7, GREY_D)
    c.hline(mid - 82, base, 164, GREY_L)
    c.outline(INK)
    return c.img


def coop_big():
    """Курятник 136×106: домик на ножках с красной крышей, круглым окном и трапом; справа пристроен
    гнездовой ящик с откидной крышкой — три ячейки с соломой (яйца сцена кладёт: середины x 103, 115, 127,
    низ — y 72)."""
    w, h = 136, 106
    c = Canvas(w, h)
    rnd = random.Random(3)
    ROOF, ROOF_D, ROOF_L = H("#c0392b"), H("#7a2230"), H("#e8604f")
    WALL, WALL_D, WALL_L = H("#f2d3ab"), H("#c9a27a"), H("#fbe6c8")
    # ножки
    for x in (12, 30, 70, 84):
        c.rect(x, 82, 4, 22, WOOD_D)
        c.vline(x, 82, 22, WOOD)
    # трап с перекладинами
    for i in range(16):
        c.hline(36 + i, 82 + i, 14, WOOD if i % 4 else WOOD_DD)
    # стена домика
    c.rect(6, 40, 84, 44, WALL)
    for y in range(44, 84, 5):
        c.hline(6, y, 84, WALL_D)
        c.hline(6, y + 1, 84, WALL_L) if y % 10 == 4 else None
    c.vline(6, 40, 44, WALL_L)
    c.vline(89, 40, 44, WALL_D)
    # круглое окно и дверца
    c.ellipse(26, 58, 8, 8, CREAM)
    c.ellipse(26, 58, 6, 6, H("#2a1d26"))
    c.px(24, 56, H("#8fd3ff"))
    c.rect(52, 56, 18, 28, H("#2a1d26"))
    c.frame(51, 55, 20, 29, WOOD_D)
    c.ellipse(60.5, 66, 3, 3, WHITE)                  # курица выглядывает
    c.px(62, 65, INK)
    c.px(64, 66, ORANGE_L)
    c.px(60, 62, RED)
    c.px(61, 62, RED)
    # крыша-домик
    for i in range(34):
        x0 = 48 - int(i * 1.5) - 2
        x1 = 48 + int(i * 1.5) + 2
        col = ROOF_L if i < 3 else (ROOF if (i // 4) % 2 else lit(ROOF, -0.1))
        c.hline(max(0, x0), 6 + i, min(w, x1) - max(0, x0), col)
    c.hline(0, 40, 98, ROOF_D)
    c.hline(0, 41, 98, ROOF_D)
    c.rect(44, 2, 8, 6, ROOF_D)
    # гнездовой ящик справа: короб с крышкой, три ячейки
    bx, by = 92, 46
    c.rect(bx, by, 42, 30, WOOD)
    c.hline(bx, by, 42, WOOD_L)
    for i in range(3):
        cx = bx + 3 + i * 13
        c.rect(cx, by + 6, 11, 18, H("#2a1d26"))
        c.rect(cx, by + 18, 11, 6, STRAW)
        c.hline(cx, by + 17, 11, STRAW_L)
        c.hline(cx, by + 23, 11, STRAW_D)
    c.rect(bx, by + 24, 42, 6, WOOD_D)
    c.hline(bx, by + 24, 42, WOOD)
    for i in range(6):                                 # наклонная крышка
        c.hline(bx - 1, by - 6 + i, 44, ROOF if i > 1 else ROOF_L)
    c.hline(bx - 1, by, 44, ROOF_D)
    c.rect(bx + 4, by + 30, 3, 18, WOOD_D)
    c.rect(bx + 36, by + 30, 3, 18, WOOD_D)
    c.outline(INK)
    return c.img


def skep():
    """Улей-колода 44×48: соломенный купол кольцами, тёмный леток, на деревянной подставке; на куполе — капля
    мёда и пара пчёл."""
    w, h = 44, 48
    c = Canvas(w, h)
    # подставка
    c.rect(4, 38, 36, 4, WOOD)
    c.hline(4, 38, 36, WOOD_L)
    c.hline(4, 41, 36, WOOD_DD)
    for x in (7, 34):
        c.rect(x, 42, 3, 5, WOOD_D)
    # купол
    for y in range(4, 38):
        t = (38 - y) / 34
        half = int(18 * math.sqrt(max(0, 1 - (1 - t) ** 2 * 0.0 - t ** 2.2)) + 0.5) if t < 1 else 0
        half = max(2, half)
        ring = (y - 4) // 5
        base = STRAW if ring % 2 == 0 else H("#d9b47a")
        c.hline(22 - half, y, 2 * half, base)
        if (y - 4) % 5 == 4:
            c.hline(22 - half, y, 2 * half, STRAW_D)
        c.px(22 - half, y, STRAW_D)
        c.px(21 + half, y, H("#a8804e"))
    for y in range(8, 30):                              # свет слева-сверху
        t = (38 - y) / 34
        half = int(18 * math.sqrt(max(0, 1 - t ** 2.2)))
        c.px(22 - half + 3, y, STRAW_L)
    # леток
    c.ellipse(22, 33, 4, 3, H("#2a1d26"))
    c.hline(19, 36, 7, WOOD_D)
    # мёд течёт
    c.vline(31, 26, 5, ORANGE_L)
    c.px(31, 31, ORANGE)
    c.px(30, 26, YELLOW)
    # макушка
    c.rect(20, 2, 4, 3, STRAW_D)
    c.outline(INK)
    return c.img


def hay_shed():
    """Сенник 156×100: навес на столбах, задняя стенка из досок, пол — утоптанная солома (тюки кладёт сцена)."""
    w, h = 156, 100
    c = Canvas(w, h)
    ROOF, ROOF_D, ROOF_L = H("#8f563b"), H("#5e3a2a"), H("#b86f50")
    # задняя стенка
    c.rect(6, 22, w - 12, 64, WOOD_D)
    for x in range(6, w - 6, 8):
        c.vline(x, 22, 64, WOOD_DD)
        c.vline(x + 1, 22, 64, WOOD)
    # пол
    c.rect(4, 80, w - 8, 14, STRAW_D)
    rnd = random.Random(5)
    for _ in range(90):
        c.px(rnd.randrange(5, w - 5), rnd.randrange(81, 93), rnd.choice((STRAW, STRAW_L, STRAW_D)))
    # столбы
    for x in (4, w // 2 - 2, w - 9):
        c.rect(x, 18, 5, 78, WOOD)
        c.vline(x, 18, 78, WOOD_L)
        c.vline(x + 4, 18, 78, WOOD_DD)
    # крыша — односкатная, доски-тёс
    for i in range(20):
        c.hline(0, 2 + i, w, ROOF_L if i < 2 else (ROOF if (i // 3) % 2 else lit(ROOF, -0.1)))
    for x in range(0, w, 12):
        c.vline(x, 4, 18, ROOF_D)
    c.hline(0, 21, w, ROOF_D)
    c.outline(INK)
    return c.img


def build_sign():
    """Табличка «здесь будет стройка» 34×44: столбик, доска с молотком и плюсом, у столбика — кирпич."""
    w, h = 34, 44
    c = Canvas(w, h)
    c.rect(15, 18, 4, 24, WOOD_D)
    c.vline(15, 18, 24, WOOD)
    c.round_rect(2, 2, 30, 20, YELLOW, r=2)
    c.hline(3, 2, 28, H("#fff3a8"))
    c.hline(3, 21, 28, YELLOW_D)
    # молоток
    c.line(8, 17, 16, 9, WOOD_D)
    c.line(9, 17, 17, 9, WOOD)
    c.rect(14, 5, 7, 4, GREY_D)
    c.hline(14, 5, 7, GREY_L)
    # плюс
    c.rect(23, 8, 6, 2, LEAF_D)
    c.rect(25, 6, 2, 6, LEAF_D)
    c.rect(5, 38, 10, 5, RED_D)
    c.hline(5, 38, 10, RED)
    c.outline(INK)
    return c.img


def planks():
    """Стопка досок 44×12 у стройки."""
    c = Canvas(44, 12)
    for i, (x, y, ln) in enumerate(((1, 7, 40), (3, 4, 38), (2, 1, 36))):
        c.rect(x, y, ln, 3, WOOD if i % 2 else WOOD_L)
        c.hline(x, y + 2, ln, WOOD_D)
        c.vline(x, y, 3, WOOD_DD)
    c.outline(INK)
    return c.img
