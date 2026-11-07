"""Ферма над «Лавкой «Своё»» в полной детализации (как спрайты магазина, DETAIL = 2): амбар, курятник с выгулом,
теплица, грядки, пруд, стог, кормушка, трава с кочками и цветами, тропинки. Свет сверху-слева, контур #181425,
три тона на материал, мягкая тень на земле. Ставит их art/lavka.py.
"""

import math
import random

from PIL import Image, ImageDraw

from premium import H, lit, mix
from sprites import Canvas

INK = H("#181425")
RED, RED_D, RED_L = H("#b13a3a"), H("#8a2a33"), H("#d9574f")
TRIM, TRIM_D = H("#f4ead6"), H("#cfc0a3")
ROOF, ROOF_D, ROOF_L = H("#5a6988"), H("#3a4466"), H("#8b9bb4")
WOOD, WOOD_D, WOOD_L, WOOD_LL = H("#b86f50"), H("#8f563b"), H("#d9955f"), H("#e4a672")
DARK = H("#2a1d26")
HAY, HAY_D, HAY_L = H("#e7cc9f"), H("#c49a6c"), H("#f8ebcf")
STONE, STONE_D, STONE_L = H("#8b9bb4"), H("#5a6988"), H("#c0cbdc")
GLASS, GLASS_D, GLASS_L = H("#bfe6f0"), H("#8cc7d9"), H("#e8f8fc")
LEAF, LEAF_D, LEAF_DD, LEAF_L = H("#63c74d"), H("#3e8948"), H("#265c42"), H("#98c95a")
SOIL, SOIL_D, SOIL_L = H("#6b4433"), H("#4e3128"), H("#8a5a44")
WHITE = H("#ffffff")


def ground_shadow(img, pad=6, alpha=70, squash=0.22):
    """Мягкая тень под предметом (эллипс по ширине), картинка становится выше на высоту тени."""
    w, h = img.size
    sh = int(w * squash) + pad
    out = Image.new("RGBA", (w, h + sh // 2))
    d = ImageDraw.Draw(out)
    d.ellipse((2, h - sh // 2, w - 3, h + sh // 2 - 1), fill=(24, 20, 37, alpha))
    out.alpha_composite(img, (0, 0))
    return out


def planks_v(c, x, y, w, h, base, seam, hi, step=4, rnd=None):
    c.rect(x, y, w, h, base)
    for xx in range(x, x + w, step):
        c.vline(xx, y, h, seam)
        c.vline(xx + 1, y, h, hi)
    if rnd:
        for _ in range(w * h // 60):
            c.px(rnd.randrange(x, x + w), rnd.randrange(y, y + h), lit(base, -0.12))


def shingles(c, x, y, w, h, base, dark, light, row=4, rnd=None):
    """Крыша-черепица сверху: ряды со сдвинутыми швами, ряд светлее к коньку."""
    for i, yy in enumerate(range(y, y + h, row)):
        t = i / max(1, h // row)
        col = mix(light, base, min(1, t * 1.3))
        c.rect(x, yy, w, min(row, y + h - yy), col)
        c.hline(x, yy + row - 1, w, mix(col, dark, 0.6))
        off = 0 if i % 2 else 3
        for xx in range(x + off, x + w, 6):
            c.vline(xx, yy, row - 1, mix(col, dark, 0.45))
        if rnd:
            for _ in range(w // 18):
                c.px(rnd.randrange(x, x + w), yy + rnd.randrange(row - 1), lit(col, 0.12))


# ---------------------------------------------------------------- постройки


def barn():
    """Амбар-коровник: ломаная крыша из черепицы, красные доски, белая обвязка, открытые ворота, корова внутри."""
    w, h = 150, 132
    c = Canvas(w, h)
    rnd = random.Random(7)
    roof_h = 60
    # Крыша: верхний скат светлее, нижний круче и темнее (ломаная «амбарная» крыша сверху-спереди).
    for y in range(roof_h):
        inset = max(0, 14 - y // 2) if y < 26 else max(0, 2 - (y - 26) // 10)
        c.hline(inset, y, w - 2 * inset, ROOF)
    shingles(c, 0, 0, w, 26, ROOF, ROOF_D, ROOF_L, rnd=rnd)
    shingles(c, 0, 26, w, roof_h - 26, lit(ROOF, -0.08), ROOF_D, ROOF, rnd=rnd)
    for y in range(26):  # срезы по бокам верхнего ската
        inset = max(0, 14 - y // 2)
        c.hline(0, y, inset, (0, 0, 0, 0))
        c.hline(w - inset, y, inset, (0, 0, 0, 0))
    c.hline(10, 1, w - 20, ROOF_L)  # конёк
    c.hline(0, 26, w, ROOF_D)
    c.hline(0, roof_h - 1, w, ROOF_D)
    # Слуховое окно с вентиляцией на коньке.
    c.rect(w // 2 - 9, 3, 18, 12, TRIM)
    c.rect(w // 2 - 7, 5, 14, 8, DARK)
    for yy in range(6, 13, 2):
        c.hline(w // 2 - 7, yy, 14, WOOD_D)
    c.rect(w // 2 - 11, 2, 22, 2, ROOF_L)
    # Фасад: щипец и стена из вертикальных досок.
    top = roof_h
    planks_v(c, 2, top, w - 4, h - top - 6, RED, RED_D, RED_L, rnd=rnd)
    c.hline(2, top, w - 4, RED_D)
    c.hline(2, top + 1, w - 4, RED_D)
    # Каменный цоколь.
    for x in range(0, w, 8):
        for i, yy in enumerate((h - 6, h - 3)):
            c.rect(x + (4 if i else 0), yy, 7, 3, STONE if (x // 8 + i) % 2 else STONE_L)
            c.hline(x + (4 if i else 0), yy + 2, 7, STONE_D)
    # Белая обвязка углов.
    for x in (2, w - 6):
        c.rect(x, top, 4, h - top - 6, TRIM)
        c.vline(x + 3, top, h - top - 6, TRIM_D)
    # Сеновал над воротами: дверца открыта, сено торчит.
    hx, hy = w // 2 - 12, top + 4
    c.rect(hx - 2, hy - 2, 28, 22, TRIM)
    c.rect(hx, hy, 24, 18, DARK)
    for i in range(24):
        c.vline(hx + i, hy + 10 + (i * 7) % 4, 8 - (i * 7) % 4, HAY if i % 3 else HAY_D)
    c.hline(hx, hy + 17, 24, HAY_L)
    # Ворота: распахнуты, внутри темно, сено на полу, морда коровы.
    gx, gy, gw = w // 2 - 24, top + 28, 48
    gh = h - 6 - gy
    c.rect(gx - 3, gy - 3, gw + 6, 3, TRIM)
    c.rect(gx, gy, gw, gh, DARK)
    c.rect(gx, gy, gw, 3, H("#181425"))
    for i in range(gw):
        c.vline(gx + i, gy + gh - 5 + (i * 5) % 3, 5 - (i * 5) % 3, HAY if i % 4 else HAY_D)
    # корова выглядывает
    cx, cy = gx + 30, gy + 10
    c.rect(cx, cy, 12, 11, WHITE)
    c.rect(cx + 1, cy, 5, 4, H("#262b44"))
    c.rect(cx + 2, cy + 7, 8, 5, H("#f6757a"))
    c.px(cx + 4, cy + 9, H("#9e2835"))
    c.px(cx + 7, cy + 9, H("#9e2835"))
    c.px(cx + 3, cy + 4, INK)
    c.px(cx + 8, cy + 4, INK)
    c.px(cx - 1, cy - 1, HAY_L)
    c.px(cx + 12, cy - 1, HAY_L)
    # Створки ворот с белым «Х».
    for sx in (gx - 22, gx + gw + 3):
        c.rect(sx, gy, 19, gh, RED)
        planks_v(c, sx + 1, gy + 1, 17, gh - 2, RED, RED_D, RED_L)
        c.frame(sx, gy, 19, gh, TRIM)
        c.line(sx + 1, gy + 1, sx + 17, gy + gh - 2, TRIM)
        c.line(sx + 17, gy + 1, sx + 1, gy + gh - 2, TRIM)
        c.vline(sx + 18, gy, gh, TRIM_D)
    # Окошки по бокам.
    for wx in (14, w - 30):
        c.rect(wx, top + 10, 16, 14, TRIM)
        c.rect(wx + 2, top + 12, 12, 10, H("#3a4466"))
        c.px(wx + 3, top + 13, H("#8fd3ff"))
        c.px(wx + 4, top + 14, H("#8fd3ff"))
        c.vline(wx + 7, top + 12, 10, TRIM)
        c.hline(wx + 2, top + 16, 12, TRIM)
    # Фонарь над воротами.
    c.rect(w // 2 - 2, gy - 9, 4, 5, H("#fee761"))
    c.px(w // 2 - 1, gy - 10, INK)
    c.outline(INK)
    return ground_shadow(c.img, alpha=60)


def coop():
    """Курятник на ножках: черепичная крыша, гнездовой ящик сбоку, трап с перекладинами, круглое окно."""
    w, h = 76, 64
    c = Canvas(w, h)
    rnd = random.Random(3)
    roof_h = 24
    shingles(c, 4, 0, w - 8, roof_h, H("#a22633"), H("#6a1f2a"), H("#e43b44"), rnd=rnd)
    c.hline(6, 0, w - 12, H("#f6757a"))
    c.hline(4, roof_h - 1, w - 8, H("#6a1f2a"))
    # стена
    body_y = roof_h
    planks_v(c, 8, body_y, w - 26, 26, WOOD_LL, WOOD, H("#f1ddb6"), step=3, rnd=rnd)
    c.hline(8, body_y, w - 26, WOOD)
    # гнездовой ящик справа
    c.rect(w - 18, body_y + 4, 14, 16, WOOD_L)
    c.rect(w - 19, body_y + 2, 16, 4, H("#a22633"))
    c.hline(w - 19, body_y + 2, 16, H("#e43b44"))
    c.vline(w - 11, body_y + 6, 14, WOOD)
    # окошко круглое
    c.ellipse(24, body_y + 10, 5, 5, TRIM)
    c.ellipse(24, body_y + 10, 3.5, 3.5, H("#3a4466"))
    c.px(23, body_y + 9, H("#8fd3ff"))
    # дверца-лаз и трап
    c.rect(38, body_y + 12, 10, 14, DARK)
    c.frame(37, body_y + 11, 12, 15, WOOD)
    for i in range(6):
        y = body_y + 26 + i * 2
        c.hline(36 + i, y, 12, WOOD_L if i % 2 else WOOD)
    # ножки
    for x in (10, w - 24):
        c.rect(x, body_y + 26, 3, h - body_y - 26, WOOD_D)
    c.outline(INK)
    return ground_shadow(c.img, alpha=55)


def greenhouse():
    """Теплица: стеклянная двускатная крыша с бликами, внутри помидоры на подвязках, дверь посередине."""
    w, h = 112, 72
    c = Canvas(w, h)
    roof_h = 30
    c.rect(0, 0, w, roof_h, GLASS)
    for y in range(roof_h):  # стекло к низу чуть темнее
        c.hline(0, y, w, mix(GLASS_L, GLASS, y / roof_h))
    c.hline(0, roof_h // 2, w, WHITE)
    for x in range(0, w, 14):
        c.vline(x, 0, roof_h, WHITE)
    for k in range(0, w, 28):  # блики полосами
        c.line(k + 4, 2, k + 12, roof_h - 3, WHITE)
        c.line(k + 6, 2, k + 14, roof_h - 3, GLASS_L)
    # стена: сквозь стекло видны грядки и помидоры
    wall_y = roof_h
    c.rect(0, wall_y, w, h - wall_y, GLASS_D)
    rnd = random.Random(5)
    for x in range(3, w - 3, 6):
        stalk = rnd.randint(14, 22)
        c.vline(x, h - 4 - stalk, stalk, LEAF_D)
        for yy in range(h - 4 - stalk, h - 4, 3):
            c.px(x - 1, yy, LEAF)
            c.px(x + 1, yy + 1, LEAF_L if rnd.random() < 0.4 else LEAF)
        for _ in range(2):
            fy = rnd.randint(h - 4 - stalk + 2, h - 6)
            c.px(x + rnd.choice((-1, 1)), fy, H("#e43b44"))
    c.rect(0, h - 4, w, 4, SOIL)
    c.hline(0, h - 4, w, SOIL_L)
    for x in range(0, w, 14):
        c.vline(x, wall_y, h - wall_y, WHITE)
    c.hline(0, wall_y, w, WHITE)
    # дверь
    c.rect(w // 2 - 7, wall_y + 10, 14, h - wall_y - 10, mix(GLASS_D, WHITE, 0.25))
    c.frame(w // 2 - 7, wall_y + 10, 14, h - wall_y - 10, WHITE)
    c.px(w // 2 + 4, wall_y + 26, H("#feae34"))
    c.outline(INK)
    return ground_shadow(c.img, alpha=45)


def hay_stack():
    """Стог сена: копна с прожилками, вилы воткнуты."""
    w, h = 40, 30
    c = Canvas(w, h)
    c.ellipse(20, 18, 19, 12, HAY_D)
    c.ellipse(19, 15, 17, 12, HAY)
    c.ellipse(16, 11, 10, 7, HAY_L)
    rnd = random.Random(2)
    for _ in range(60):
        x, y = rnd.randrange(4, 36), rnd.randrange(5, 28)
        if c.get(x, y)[3]:
            c.px(x, y, rnd.choice((HAY_D, HAY_L, H("#feae34"))))
    c.line(30, 2, 26, 14, WOOD_D)
    c.line(29, 1, 33, 1, STONE)
    c.outline(INK)
    return ground_shadow(c.img, alpha=55)


def trough():
    w, h = 40, 14
    c = Canvas(w, h)
    c.rect(0, 2, w, 9, WOOD)
    c.hline(0, 2, w, WOOD_L)
    c.rect(2, 3, w - 4, 4, H("#2a6fb0"))
    c.hline(3, 3, w - 6, H("#5fa8e0"))
    c.vline(3, 11, 3, WOOD_D)
    c.vline(w - 4, 11, 3, WOOD_D)
    c.outline(INK)
    return c.img


def wire_h(w=32):
    """Сетка выгула: столбики и ромбики сетки (полупрозрачные), верхняя жердь."""
    c = Canvas(w, 16)
    for x in (0, w - 2):
        c.rect(x, 0, 2, 16, WOOD_D)
        c.px(x, 0, WOOD_L)
    c.hline(0, 1, w, WOOD)
    for y in range(3, 15, 3):
        for x in range(2 + (y // 3) % 2 * 2, w - 2, 4):
            c.px(x, y, (192, 203, 220, 200))
    c.hline(0, 15, w, (139, 155, 180, 200))
    return c.img


def wire_v(h=32):
    c = Canvas(4, h)
    c.rect(1, 0, 2, h, WOOD_D)
    for y in range(2, h, 3):
        c.px(0, y, (192, 203, 220, 200))
        c.px(3, y + 1, (192, 203, 220, 200))
    return c.img


def feeder():
    c = Canvas(18, 10)
    c.rect(0, 4, 18, 5, WOOD)
    c.hline(0, 4, 18, WOOD_L)
    for x in range(2, 16, 2):
        c.px(x, 5, HAY)
        c.px(x + 1, 6, H("#feae34"))
    c.outline(INK)
    return c.img


def duck(variant=0):
    c = Canvas(14, 11)
    body = WHITE if variant == 0 else H("#8f563b")
    c.ellipse(6, 7, 5.5, 3.2, body)
    c.hline(2, 9, 9, lit(body, -0.22))
    c.rect(9, 1, 4, 4, body if variant == 0 else H("#265c42"))
    c.px(13, 3, H("#feae34"))
    c.px(13, 4, H("#f77622"))
    c.px(11, 2, INK)
    c.rect(1, 5, 2, 2, lit(body, -0.1))
    c.outline(INK)
    return c.img


def pond(w=90, h=46):
    """Пруд: тёмная вода к середине, светлая кромка, кувшинки, камыш."""
    c = Canvas(w, h)
    c.ellipse(w / 2, h / 2, w / 2 - 1, h / 2 - 1, H("#8f563b"))
    c.ellipse(w / 2, h / 2, w / 2 - 3, h / 2 - 3, H("#2a6fb0"))
    c.ellipse(w / 2, h / 2 + 2, w / 2 - 10, h / 2 - 8, H("#124e89"))
    for x0 in range(14, w - 16, 18):
        c.hline(x0, h // 2 - 4 + (x0 % 3), 6, H("#5fa8e0"))
    for lx, ly in ((22, 30), (60, 16), (70, 30)):
        c.ellipse(lx, ly, 3.5, 2.2, LEAF)
        c.px(lx + 1, ly - 1, LEAF_L)
        c.px(lx, ly, H("#f6757a") if lx == 60 else LEAF_D)
    rnd = random.Random(8)
    for x in list(range(3, 16, 3)) + list(range(w - 14, w - 2, 3)):
        hh = rnd.randint(6, 11)
        c.vline(x, h // 2 - hh // 2, hh, H("#5e9535"))
        c.px(x, h // 2 - hh // 2 - 1, H("#8f563b"))
    c.outline(INK)
    return c.img


def scarecrow():
    """Пугало крупнее: шляпа, рубаха, соломенные руки."""
    w, h = 24, 40
    c = Canvas(w, h)
    c.vline(11, 8, 32, WOOD_D)
    c.vline(12, 8, 32, WOOD)
    c.rect(1, 15, 22, 3, WOOD)
    c.hline(1, 15, 22, WOOD_L)
    c.rect(5, 13, 14, 13, H("#0099db"))
    c.hline(5, 13, 14, H("#2ce8f5"))
    for y in (16, 20, 24):
        c.hline(5, y, 14, H("#124e89"))
    c.vline(11, 13, 13, H("#e43b44"))
    c.rect(4, 26, 16, 3, HAY)
    c.ellipse(12, 8, 4.5, 4.5, HAY_L)
    c.px(10, 8, INK)
    c.px(14, 8, INK)
    c.hline(10, 10, 5, WOOD_D)
    c.rect(3, 2, 18, 2, HAY_D)
    c.rect(7, 0, 10, 3, HAY)
    c.hline(7, 3, 10, H("#e43b44"))
    for x in (0, 1, 22, 23):
        c.px(x, 16, HAY)
    c.outline(INK)
    return ground_shadow(c.img, alpha=40, squash=0.3)


def bed(w, h, seed=0):
    """Пустая грядка-короб: борта из досок с торцами, рыхлая земля бороздами (растения — отдельным слоем, crops)."""
    c = Canvas(w, h)
    rnd = random.Random(seed)
    c.rect(0, 0, w, h, WOOD)
    c.hline(0, 0, w, WOOD_LL)
    c.hline(0, 1, w, WOOD_L)
    c.hline(0, h - 2, w, WOOD_D)
    c.vline(0, 0, h, WOOD_L)
    c.vline(w - 1, 0, h, WOOD_D)
    for x in (0, w - 3):
        c.rect(x, 0, 3, 3, WOOD_D)
        c.px(x + 1, 1, WOOD_LL)
    c.rect(3, 3, w - 6, h - 6, SOIL)
    for yy in range(5, h - 3, 3):
        c.hline(3, yy, w - 6, SOIL_D)
        c.hline(3, yy - 1, w - 6, SOIL_L if rnd.random() < 0.5 else SOIL)
    for _ in range(w * h // 14):
        c.px(rnd.randrange(3, w - 3), rnd.randrange(3, h - 3), rnd.choice((SOIL_L, SOIL_D)))
    c.outline(INK)
    return c.img


def bed_wet(w, h):
    """Политая земля: тёмный влажный слой поверх борозд (полупрозрачный, только внутри борта)."""
    c = Canvas(w, h)
    c.rect(3, 3, w - 6, h - 6, (40, 24, 28, 120))
    for x in range(6, w - 6, 9):
        c.px(x, 6 + x % 5, (120, 170, 220, 200))
    return c.img


def crops(w, h, crop, stage, seed=0):
    """Растения на грядке по стадиям: 1 — всходы, 2 — подросли, 3 — созрели (сам овощ видно)."""
    c = Canvas(w, h + 6)
    rnd = random.Random(seed)
    for ry in range(9, h - 3, 10):
        step = 11 if crop in ("cabbage", "pumpkin") else 8
        for rx in range(8, w - 6, step):
            x, y = rx + rnd.randint(-1, 1), ry + rnd.randint(-1, 0) + 6
            if stage == 1:
                c.px(x, y - 1, LEAF)
                c.px(x - 1, y - 2, LEAF_L)
                c.px(x + 1, y - 2, LEAF)
            elif stage == 2:
                c.ellipse(x, y - 1, 2.6, 2, LEAF_D)
                c.px(x - 1, y - 2, LEAF)
                c.px(x + 1, y - 3, LEAF_L)
                c.px(x, y - 3, LEAF)
            else:
                plant(c, x, y, crop, rnd)
    return c.img


def plant(c, x, y, crop, rnd):
    if crop == "cabbage":
        c.ellipse(x, y, 5, 4, LEAF_D)
        c.ellipse(x, y - 0.5, 4, 3.2, LEAF)
        c.ellipse(x - 0.5, y - 1, 2.6, 2, LEAF_L)
        c.ellipse(x - 1, y - 1.5, 1.2, 1, H("#d4ec9a"))
        c.px(x + 3, y + 1, LEAF_DD)
    elif crop == "carrot":
        for dx, dy, col in ((-2, -3, LEAF), (0, -5, LEAF_L), (2, -3, LEAF), (-1, -2, LEAF_D), (1, -2, LEAF_D), (-3, -4, LEAF_L), (3, -4, LEAF_L), (0, -4, LEAF)):
            c.px(x + dx, y + dy, col)
        c.rect(x - 1, y - 1, 3, 2, H("#f77622"))
        c.px(x - 1, y - 1, H("#feae34"))
    elif crop == "tomato":
        c.vline(x, y - 9, 10, WOOD_L)
        c.px(x, y - 10, WOOD_D)
        c.ellipse(x, y - 3, 4, 4, LEAF_D)
        c.ellipse(x - 1, y - 4, 3, 2.5, LEAF)
        c.px(x - 1, y - 6, LEAF_L)
        for dx, dy in ((-3, -2), (2, -1), (0, 0), (3, -4)):
            c.px(x + dx, y + dy, H("#e43b44"))
            c.px(x + dx, y + dy - 1, H("#f6757a"))
    elif crop == "strawberry":
        c.ellipse(x, y - 1, 4, 2.5, LEAF_D)
        c.px(x - 1, y - 2, LEAF)
        c.px(x + 1, y - 2, LEAF_L)
        c.px(x, y - 3, WHITE)
        for dx in (-3, 3):
            c.px(x + dx, y, H("#e43b44"))
            c.px(x + dx, y + 1, H("#a22633"))
            c.px(x + dx, y - 1, LEAF)
    elif crop == "potato":
        c.ellipse(x, y - 1, 4, 3, LEAF)
        c.ellipse(x - 1, y - 2, 2, 1.5, LEAF_L)
        c.px(x + 2, y - 3, WHITE)
        c.px(x + 2, y - 4, H("#fee761"))
        c.px(x - 3, y, LEAF_D)
    elif crop == "pumpkin":
        c.line(x - 4, y - 3, x + 3, y - 4, LEAF_D)
        c.ellipse(x - 3, y - 4, 3, 2, LEAF)
        c.ellipse(x, y, 4.5, 3.2, H("#f77622"))
        c.vline(x - 1, y - 2, 4, H("#c25a1a"))
        c.vline(x + 2, y - 2, 4, H("#c25a1a"))
        c.px(x - 2, y - 2, H("#feae34"))
        c.px(x, y - 3, LEAF_D)
    elif crop == "dill":
        for dx in (-2, 0, 2):
            c.vline(x + dx, y - 5, 6, LEAF)
            c.px(x + dx - 1, y - 6, H("#fee761"))
            c.px(x + dx + 1, y - 6, H("#fee761"))
            c.px(x + dx, y - 7, H("#feae34"))


def flowers_strip(w, h, seed):
    """Цветы вдоль забора: стебли и бутоны разных цветов."""
    c = Canvas(w, h)
    rnd = random.Random(seed)
    for x in range(1, w - 1, 3):
        stem = rnd.randint(3, h - 2)
        c.vline(x, h - stem, stem, LEAF_D)
        col = rnd.choice((H("#e43b44"), H("#fee761"), H("#f6757a"), WHITE, H("#b55088"), H("#0099db")))
        c.px(x, h - stem - 1, col)
        c.px(x - 1, h - stem, col)
        c.px(x + 1, h - stem, col)
    return c.img


def grass_detail(img, area, seed, density=0.012):
    """Трава живее: кочки потемнее, светлые травинки, редкие цветочки (рисует прямо на земле)."""
    x0, y0, x1, y1 = area
    rnd = random.Random(seed)
    px = img.load()
    n = int((x1 - x0) * (y1 - y0) * density)
    for _ in range(n):
        x, y = rnd.randrange(x0, x1 - 3), rnd.randrange(y0 + 3, y1)
        base = px[x, y]
        if not (base[1] > base[0] + 30 and base[1] > base[2] + 20):
            continue  # только по траве
        kind = rnd.random()
        if kind < 0.55:
            for dx, dy in ((0, 0), (1, -1), (2, 0), (1, -2)):
                px[x + dx, y + dy] = LEAF_D if dy == 0 else LEAF
        elif kind < 0.85:
            px[x, y] = LEAF_L
            px[x, y - 1] = LEAF_L
            px[x + 1, y] = LEAF
        else:
            col = rnd.choice((WHITE, H("#fee761"), H("#f6757a"), H("#b55088")))
            px[x, y - 1] = col
            px[x + 1, y] = col
            px[x - 1 if x else x, y] = col
            px[x, y] = H("#feae34")


def tractor():
    """Трактор сбоку-сверху в полной детализации: большое заднее колесо, кабина со стеклом, труба."""
    w, h = 58, 44
    c = Canvas(w, h)
    body, body_d, body_l = H("#0099db"), H("#124e89"), H("#2ce8f5")
    # колёса
    c.ellipse(15, 31, 12, 12, H("#262b44"))
    c.ellipse(15, 31, 8, 8, H("#3a4466"))
    c.ellipse(15, 31, 4, 4, H("#feae34"))
    c.px(14, 30, H("#fee761"))
    for a in range(0, 12):

        x = 15 + round(11 * math.cos(a * math.pi / 6))
        y = 31 + round(11 * math.sin(a * math.pi / 6))
        c.px(x, y, H("#181425"))
    c.ellipse(47, 35, 8, 8, H("#262b44"))
    c.ellipse(47, 35, 5, 5, H("#3a4466"))
    c.ellipse(47, 35, 2, 2, H("#feae34"))
    # капот и кабина
    c.rect(22, 18, 32, 12, body)
    c.hline(22, 18, 32, body_l)
    c.hline(22, 29, 32, body_d)
    for x in range(40, 52, 3):
        c.vline(x, 21, 6, body_d)
    c.rect(4, 2, 22, 22, body_d)
    c.rect(6, 4, 18, 13, GLASS)
    c.line(7, 5, 12, 14, WHITE)
    c.rect(4, 2, 22, 2, STONE_L)
    c.rect(2, 0, 26, 3, H("#e43b44"))
    c.hline(2, 0, 26, H("#f6757a"))
    # труба
    c.rect(44, 6, 3, 12, STONE_D)
    c.rect(43, 5, 5, 2, STONE)
    c.outline(INK)
    return ground_shadow(c.img, alpha=55)


def cart():
    """Прицеп с ящиками урожая и бидонами."""
    w, h = 56, 32
    c = Canvas(w, h)
    c.rect(2, 12, 48, 12, WOOD)
    c.hline(2, 12, 48, WOOD_LL)
    c.hline(2, 23, 48, WOOD_D)
    for x in range(2, 50, 8):
        c.vline(x, 12, 12, WOOD_D)
    c.rect(50, 18, 6, 2, STONE_D)
    for x in (12, 40):
        c.ellipse(x, 25, 6, 6, H("#262b44"))
        c.ellipse(x, 25, 3, 3, STONE)
    crates = ((4, H("#e43b44"), H("#f6757a")), (16, H("#f77622"), H("#feae34")), (28, LEAF, LEAF_L))
    for x, col, hi in crates:
        c.rect(x, 4, 11, 9, WOOD_LL)
        c.hline(x, 8, 11, WOOD_L)
        for k in range(4):
            c.rect(x + 1 + k * 2 + (k % 2), 2 + (k % 2), 3, 3, col)
            c.px(x + 1 + k * 2 + (k % 2), 2 + (k % 2), hi)
    for x in (41, 46):
        c.rect(x, 2, 5, 10, STONE_L)
        c.vline(x, 2, 10, WHITE)
        c.hline(x, 6, 5, STONE)
        c.rect(x + 1, 0, 3, 2, STONE)
    c.outline(INK)
    return ground_shadow(c.img, alpha=50)


def greenhouse_small():
    return greenhouse_sized(80, 52)


def greenhouse_sized(w, h):
    """Теплица любого размера (маленькая — на даче бабушки)."""
    c = Canvas(w, h)
    roof_h = h * 5 // 12
    for y in range(roof_h):
        c.hline(0, y, w, mix(GLASS_L, GLASS, y / roof_h))
    c.hline(0, roof_h // 2, w, WHITE)
    for x in range(0, w, 12):
        c.vline(x, 0, roof_h, WHITE)
    for k in range(0, w, 24):
        c.line(k + 3, 2, k + 9, roof_h - 3, WHITE)
    c.rect(0, roof_h, w, h - roof_h, GLASS_D)
    rnd = random.Random(w)
    for x in range(3, w - 3, 5):
        stalk = rnd.randint(8, h - roof_h - 6)
        c.vline(x, h - 4 - stalk, stalk, LEAF_D)
        for yy in range(h - 4 - stalk, h - 4, 3):
            c.px(x - 1, yy, LEAF)
        c.px(x + 1, h - 6 - rnd.randint(0, stalk // 2), H("#e43b44"))
    c.rect(0, h - 4, w, 4, SOIL)
    for x in range(0, w, 12):
        c.vline(x, roof_h, h - roof_h, WHITE)
    c.hline(0, roof_h, w, WHITE)
    c.rect(w // 2 - 5, roof_h + 6, 10, h - roof_h - 6, mix(GLASS_D, WHITE, 0.25))
    c.frame(w // 2 - 5, roof_h + 6, 10, h - roof_h - 6, WHITE)
    c.outline(INK)
    return ground_shadow(c.img, alpha=45)


# ---------------------------------------------------------------- значки над работой (в облачке) и яйцо на земле


def egg():
    c = Canvas(7, 8)
    c.ellipse(3.5, 4.4, 3, 3.6, TRIM)
    c.px(2, 2, WHITE)
    c.px(2, 3, WHITE)
    c.hline(2, 7, 3, TRIM_D)
    c.outline(INK)
    return c.img


def icon_honey():
    c = Canvas(10, 11)
    c.rect(1, 3, 8, 7, H("#feae34"))
    c.vline(2, 4, 5, H("#fee761"))
    c.hline(1, 9, 8, H("#f77622"))
    c.rect(1, 1, 8, 2, H("#b86f50"))
    c.rect(3, 5, 4, 3, TRIM)
    c.px(4, 6, H("#feae34"))
    c.outline(INK)
    return c.img


def icon_drop():
    c = Canvas(8, 10)
    c.ellipse(4, 6, 3, 3, H("#0099db"))
    c.vline(4, 1, 3, H("#0099db"))
    c.hline(3, 3, 3, H("#0099db"))
    c.px(3, 5, H("#8fd3ff"))
    c.px(3, 6, WHITE)
    c.outline(INK)
    return c.img


def icon_hay():
    c = Canvas(11, 9)
    c.rect(0, 2, 11, 6, HAY)
    c.hline(0, 2, 11, HAY_L)
    for x in range(1, 11, 2):
        c.vline(x, 3, 4, HAY_D)
    c.vline(3, 2, 6, WOOD_D)
    c.vline(7, 2, 6, WOOD_D)
    c.outline(INK)
    return c.img


def icon_grain():
    c = Canvas(10, 11)
    c.round_rect(1, 2, 8, 8, TRIM, r=2)
    c.rect(3, 0, 4, 3, TRIM_D)
    for x, y in ((3, 5), (5, 6), (6, 4), (4, 7)):
        c.px(x, y, H("#feae34"))
    c.outline(INK)
    return c.img


def icon_seed():
    c = Canvas(10, 10)
    c.rect(1, 1, 8, 8, H("#e4a672"))
    c.hline(1, 1, 8, H("#ead4aa"))
    c.rect(3, 3, 4, 4, LEAF)
    c.px(4, 2, LEAF_L)
    c.outline(INK)
    return c.img


def icon_tomato():
    c = Canvas(9, 9)
    c.ellipse(4.5, 5, 3.6, 3.2, H("#e43b44"))
    c.px(3, 4, H("#f6757a"))
    c.hline(3, 1, 3, LEAF)
    c.px(4, 0, LEAF_D)
    c.outline(INK)
    return c.img


def icon_apple():
    c = Canvas(9, 9)
    c.ellipse(4.5, 5, 3.6, 3.4, H("#e43b44"))
    c.px(3, 4, H("#f6757a"))
    c.px(4, 1, WOOD_D)
    c.px(5, 1, LEAF)
    c.px(6, 0, LEAF)
    c.outline(INK)
    return c.img


# ---------------------------------------------------------------- животные, крупнее и с объёмом


def cow(variant=0, head=0, tail=0):
    """Корова 46×36: пятнистая (чёрно-белая или рыжая), рога, ухо, вымя, копыта; head 0 — голова поднята,
    1 — жуёт траву (опущена); tail 0/1 — хвост висит / отмахивается."""
    w, h = 48, 38
    c = Canvas(w, h)
    body, body_l, body_d = WHITE, H("#f4ead6"), H("#c0cbdc")
    spot, spot_l = (H("#262b44"), H("#3a4466")) if variant == 0 else (H("#8f563b"), H("#b86f50"))
    # дальние ноги (темнее), ближние
    for x, far in ((12, True), (17, False), (32, True), (37, False)):
        col = body_d if far else body_l
        c.rect(x, 24, 4, 9, col)
        c.vline(x, 24, 9, lit(col, 0.2))
        c.rect(x, 32, 4, 3, H("#3b2a35"))
        c.hline(x, 32, 4, H("#5a4a5e"))
    # тело: бочкой, свет сверху-слева
    c.ellipse(24, 18, 17, 9.5, body)
    c.ellipse(22, 15, 13, 5.5, WHITE)
    for x in range(9, 41):
        for y in range(18, 28):
            if c.get(x, y)[3] and (y - 18) > 5 + (x % 3 == 0):
                c.px(x, y, body_d if y > 24 else body_l)
    # пятна
    rnd = random.Random(variant * 5 + 3)
    for sx, sy, rx, ry in ((16, 14, 5, 4), (29, 19, 5.5, 4), (36, 12, 3, 2.5), (11, 21, 2.5, 2)):
        c.ellipse(sx + rnd.randint(-1, 1), sy, rx, ry, spot)
        c.px(sx - 1, sy - 2, spot_l)
    # вымя
    c.ellipse(28, 26, 4, 2.6, H("#f6757a"))
    c.px(26, 28, H("#c48878"))
    c.px(30, 28, H("#c48878"))
    c.px(27, 25, H("#ffc4bc"))
    # хвост
    if tail:
        c.line(8, 13, 2, 9, body_d)
        c.rect(0, 7, 3, 3, spot)
    else:
        c.vline(7, 13, 10, body_d)
        c.rect(6, 22, 3, 3, spot)
    # голова
    hx, hy = (37, 12) if head else (37, 3)
    c.round_rect(hx, hy, 11, 12, body, r=3)
    c.vline(hx, hy + 2, 8, body_l)
    c.rect(hx + 1, hy, 6, 4, spot)
    c.rect(hx + 3, hy + 8, 8, 5, H("#f6757a"))
    c.hline(hx + 3, hy + 8, 8, H("#ffc4bc"))
    c.px(hx + 5, hy + 10, H("#9e2835"))
    c.px(hx + 8, hy + 10, H("#9e2835"))
    c.px(hx + 7, hy + 4, INK)
    c.px(hx + 7, hy + 3, WHITE)
    c.px(hx + 2, hy - 1, H("#e7cc9f"))
    c.px(hx + 1, hy - 2, H("#e7cc9f"))
    c.px(hx + 8, hy - 1, H("#e7cc9f"))
    c.px(hx + 9, hy - 2, H("#e7cc9f"))
    c.rect(hx - 3, hy + 3, 3, 3, body_d)  # ухо
    if head:  # травинки у морды
        for dx in (2, 5, 9):
            c.px(hx + dx, hy + 13, LEAF)
            c.px(hx + dx, hy + 12, LEAF_L)
    c.outline(INK)
    return c.img


def hen(variant=0, peck=False):
    """Курица 16×15 с объёмом: светлая спина, тёмное подхвостье, гребешок, бородка, лапки."""
    c = Canvas(18, 16)
    body = [WHITE, H("#b86f50"), H("#e7cc9f")][variant % 3]
    by = 6 if not peck else 7
    c.ellipse(8, by + 3, 5.5, 4, body)
    c.ellipse(7, by + 2, 3.5, 2.2, lit(body, 0.25))
    c.hline(4, by + 6, 9, lit(body, -0.25))
    c.rect(2, by - 1, 3, 4, lit(body, -0.12))
    c.px(2, by - 2, lit(body, -0.25))
    c.px(9, by + 3, lit(body, -0.15))  # крыло
    c.hline(7, by + 4, 4, lit(body, -0.18))
    hx, hy = (12, by - 3) if not peck else (13, by + 2)
    c.rect(hx, hy, 4, 4, body)
    c.px(hx, hy, lit(body, 0.2))
    c.px(hx + 1, hy - 1, H("#e43b44"))
    c.px(hx + 2, hy - 1, H("#e43b44"))
    c.px(hx + 2, hy - 2, H("#e43b44"))
    c.px(hx + 4, hy + 1, H("#feae34"))
    c.px(hx + 4, hy + 2, H("#f77622"))
    c.px(hx + 2, hy + 1, INK)
    if not peck:
        c.px(hx + 3, hy + 3, H("#e43b44"))
    c.vline(6, by + 7, 3, H("#feae34"))
    c.vline(10, by + 7, 3, H("#feae34"))
    c.px(5, by + 9, H("#feae34"))
    c.px(11, by + 9, H("#feae34"))
    c.outline(INK)
    return c.img


def chick(hop=False):
    c = Canvas(8, 8)
    y = 2 if not hop else 1
    c.ellipse(4, y + 3, 2.6, 2.2, H("#fee761"))
    c.px(3, y + 2, WHITE)
    c.px(6, y + 2, H("#f77622"))
    c.px(5, y + 2, INK)
    c.px(3, y + 5, H("#feae34"))
    c.px(5, y + 5, H("#feae34"))
    c.outline(INK)
    return c.img


def hive(color=0):
    """Улей 22×28: крашеные корпуса (жёлтый, голубой, белый), крыша-домик, леток с прилётной доской."""
    paint = [(H("#fee761"), H("#feae34"), WHITE), (H("#8fd3ff"), H("#0099db"), WHITE), (WHITE, H("#c0cbdc"), WHITE)][color % 3]
    base, dark, hi = paint
    c = Canvas(22, 28)
    for y in range(0, 6):
        inset = max(0, 4 - y)
        c.hline(inset, y, 22 - 2 * inset, ROOF if y < 3 else ROOF_D)
    c.hline(4, 0, 14, ROOF_L)
    for k, y in enumerate((6, 13)):
        c.rect(2, y, 18, 7, base)
        c.hline(2, y, 18, hi)
        c.hline(2, y + 6, 18, dark)
        c.vline(19, y, 7, dark)
        c.vline(2, y + 1, 5, hi)
    c.rect(2, 20, 18, 4, base)
    c.hline(2, 23, 18, dark)
    c.rect(7, 21, 8, 2, INK)
    c.rect(5, 23, 12, 2, WOOD_L)
    c.hline(5, 24, 12, WOOD)
    c.rect(3, 25, 3, 3, WOOD_D)
    c.rect(16, 25, 3, 3, WOOD_D)
    c.outline(INK)
    return ground_shadow(c.img, pad=2, alpha=45, squash=0.25)


def weathervane_barn(img):
    """Флюгер-петушок на коньке амбара (дорисовывается поверх готового амбара)."""
    w, h = img.size
    c = Canvas(w, h + 14)
    c.img.alpha_composite(img, (0, 14))
    x = w // 2
    c.vline(x, 4, 13, STONE_D)
    c.hline(x - 5, 9, 11, STONE_D)
    c.px(x - 6, 9, STONE)
    c.px(x + 6, 9, STONE)
    c.rect(x - 3, 1, 6, 4, H("#feae34"))
    c.px(x + 3, 1, H("#feae34"))
    c.px(x + 4, 0, H("#feae34"))
    c.px(x - 4, 2, H("#f77622"))
    c.px(x - 4, 3, H("#f77622"))
    c.px(x + 2, 1, INK)
    return c.img


# ---------------------------------------------------------------- земля сочнее

GREENS = [H("#265c42"), H("#3e8948"), H("#5e9535"), H("#63c74d"), H("#7cb342"), H("#98c95a")]
BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]


def _value_noise(w, h, cell, seed):
    rnd = random.Random(seed)
    gw, gh = w // cell + 2, h // cell + 2
    grid = [[rnd.random() for _ in range(gw)] for _ in range(gh)]

    def at(x, y):
        gx, gy = x / cell, y / cell
        x0, y0 = int(gx), int(gy)
        fx, fy = gx - x0, gy - y0
        fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
        a = grid[y0][x0] * (1 - fx) + grid[y0][x0 + 1] * fx
        b = grid[y0 + 1][x0] * (1 - fx) + grid[y0 + 1][x0 + 1] * fx
        return a * (1 - fy) + b * fy
    return at


def meadow(img, seed=5):
    """Луг пятнами: крупный шум сдвигает зелёный на ступень светлее или темнее, переход — дизерингом.
    Трогает только траву (цвета из ступеней зелёного)."""
    w, h = img.size
    n1 = _value_noise(w, h, 56, seed)
    n2 = _value_noise(w, h, 17, seed + 1)
    px = img.load()
    index = {g[:3]: i for i, g in enumerate(GREENS)}
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            i = index.get(p[:3])
            if i is None:
                continue
            v = n1(x, y) * 0.75 + n2(x, y) * 0.25
            t = BAYER4[(y & 3) * 4 + (x & 3)] / 16
            if v > 0.6 and (v - 0.6) * 4 > t and i < len(GREENS) - 1:
                px[x, y] = GREENS[i + 1]
            elif v < 0.4 and (0.4 - v) * 4 > t and i > 0:
                px[x, y] = GREENS[i - 1]


def fringe(img, seed=7):
    """Край тропинок и земли: травинки заходят на землю, на кромке — камешки."""
    w, h = img.size
    px = img.load()
    rnd = random.Random(seed)
    greens = {g[:3] for g in GREENS}

    def grass(x, y):
        return 0 <= x < w and 0 <= y < h and px[x, y][:3] in greens
    soil = []
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            p = px[x, y][:3]
            if p in greens:
                continue
            if p[0] > 110 and p[1] < 140 and p[2] < 110 and (grass(x, y - 1) or grass(x, y + 1) or grass(x - 1, y) or grass(x + 1, y)):
                soil.append((x, y))
    for x, y in soil:
        r = rnd.random()
        if r < 0.22:
            px[x, y] = GREENS[3]
            if y > 0:
                px[x, y - 1] = GREENS[4] if px[x, y - 1][:3] not in greens else px[x, y - 1]
        elif r < 0.27:
            px[x, y] = H("#c0cbdc")


def soft_shadow(img, cx, cy, rx, ry, alpha=55):
    """Мягкая тень на земле (дизерингом в два шага: край светлее)."""
    d = Image.new("RGBA", img.size)
    dd = ImageDraw.Draw(d)
    dd.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=(24, 20, 37, alpha // 2))
    dd.ellipse((cx - rx * 0.75, cy - ry * 0.7, cx + rx * 0.75, cy + ry * 0.7), fill=(24, 20, 37, alpha))
    img.alpha_composite(d)


def straw_floor(img, x0, y0, x1, y1, seed=3):
    """Утоптанный выгул: земля с соломинками."""
    px = img.load()
    rnd = random.Random(seed)
    cols = [H("#8f563b"), H("#8f563b"), H("#8f563b"), H("#733e39"), H("#b86f50")]
    for y in range(y0, y1):
        for x in range(x0, x1):
            px[x, y] = rnd.choice(cols)
    for _ in range((x1 - x0) * (y1 - y0) // 40):
        x, y = rnd.randrange(x0, x1 - 3), rnd.randrange(y0, y1)
        col = rnd.choice((HAY_D, HAY_D, HAY))
        for k in range(rnd.randint(2, 3)):
            px[x + k, y] = col
