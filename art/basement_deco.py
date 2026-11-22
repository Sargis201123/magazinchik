"""Подвал 22.11 (автор: «надо улучшать дизайн этажей, сделать их красивее»). Зал этажа стал выше (290 точек вместо
230), и низ подвала остался пустым тёмным полом. Здесь - то, чем подвал обжит: кладовая с закрутками и бочками,
котёл с огоньком в окошке, верстак, ковёр в уголке отдыха, торшер, а на полу - трапы, трещины, пятна и жёлтая
разметка. Рисунок к scenes/floors/basementFloor.ts; палитра и приёмы - как в art/basement_art.py (Endesga 32,
контур #181425, свет сверху слева, двойная детализация: в мире всё вдвое меньше).

    python3 art/basement_deco.py

Картинки (размеры - в пикселях рисунка):
  bsm_rug         128×52  потёртый ковёр с медальоном (под диваном и столиком; лежит на полу, без контура);
  bsm_crack        40×20  трещина в бетоне (полупрозрачная, поверх пола);
  bsm_oil          30×14  тёмное пятно на бетоне;
  bsm_drain        18×14  круглый трап в полу;
  bsm_hazard        8×8   плитка жёлто-тёмной разметки (сцена тянет её полосой);
  bsm_rack         56×64  стеллаж кладовой: банки огурцов, помидоров, варенья, компота, бутылки; bsm_rack2 - другой набор;
  bsm_stairs2      56×84  лестница в подвал без проёма наверху: она уходит выше кадра (bsm_steps 46×16 - её
                          продолжение плиткой; bsm_stairs остаётся картинкой в меню «Этажи»);
  bsm_barrel       24×30  бочка с капустой под гнётом (камень на крышке, ткань);
  bsm_cask         34×28  винная бочка на козлах с латунным краником;
  bsm_sacks        34×24  мешки с картошкой (один развязан);
  bsm_crates       30×30  два ящика друг на друге (в верхнем - яблоки);
  bsm_boiler       40×76  котёл у левой стены: эмаль, манометр, дымоход в стену, окошко с огнём;
  bsm_boiler_lit   40×76  огонь в окошке котла (мерцает сценой);
  bsm_bench        64×44  верстак: тиски, инструмент, ящик, приёмник на столешнице;
  bsm_floorlamp    16×46  торшер с тёплым абажуром у дивана;
  bsm_mop          22×32  жёлтое ведро со шваброй (у трапа - подвал моют).
"""

import math
import random

from premium import H, lit
from sprites import Canvas, shadowed
from basement_art import (
    BLUE,
    BLUE_D,
    BR,
    BR_D,
    BR_L,
    CLAY,
    CLAY_L,
    CYAN,
    GOLD,
    GOLD_L,
    GREEN,
    GREEN_D,
    INK,
    MIST,
    NAVY,
    NAVY2,
    ORANGE,
    PALE,
    PINK,
    PINK_L,
    RED,
    RED_D,
    RED_L,
    SAND,
    SAND_D,
    SLATE,
    STEEL,
    TEAL,
)

DEEP = H("#265c42")


def rug():
    """Ковёр 88×52: тёмно-синяя кайма с золотой нитью, бордовое поле с ромбами, медальон; бахрома по коротким краям,
    в середине протёрто (там ходят к дивану). На полу лежит - контура нет, только тёмный нижний край (толщина)."""
    c = Canvas(128, 52)
    x0, y0, w, h = 4, 2, 120, 47
    for y in range(6, 46, 2):
        c.hline(0, y, 4, MIST)
        c.px(0, y, STEEL)
        c.hline(124, y, 4, lit(MIST, -0.15))
        c.px(127, y, SLATE)
    c.rect(x0, y0, w, h, NAVY)
    c.frame(x0 + 2, y0 + 2, w - 4, h - 4, GOLD)
    for x in range(x0 + 5, x0 + w - 4, 4):
        c.px(x, y0 + 1, SAND_D)
        c.px(x, y0 + h - 2, lit(SAND_D, -0.2))
    fx, fy, fw, fh = x0 + 5, y0 + 5, w - 10, h - 10
    c.rect(fx, fy, fw, fh, RED)
    # Узор поля: сетка мелких ромбов тоном темнее.
    for y in range(fy, fy + fh):
        for x in range(fx, fx + fw):
            if (abs((x - fx) % 8 - 4) + abs((y - fy) % 8 - 4)) == 3:
                c.px(x, y, lit(RED, -0.22))
    # Медальон по середине и углы поля.
    cx, cy = x0 + w / 2, y0 + h / 2
    for y in range(fy, fy + fh):
        for x in range(fx, fx + fw):
            d = abs(x + 0.5 - cx) / 24 + abs(y + 0.5 - cy) / 11
            if d <= 1:
                c.px(x, y, SAND_D if d > 0.86 else NAVY if d > 0.5 else RED_L if d > 0.28 else GOLD)
    for (ax, ay, sx, sy) in ((fx, fy, 1, 1), (fx + fw - 1, fy, -1, 1), (fx, fy + fh - 1, 1, -1), (fx + fw - 1, fy + fh - 1, -1, -1)):
        for k in range(7):
            c.hline(ax if sx > 0 else ax - (6 - k), ay + sy * k, 7 - k, NAVY)
        c.px(ax + sx * 1, ay + sy * 1, GOLD)
    # Протёрто: светлее нитки, кое-где проглядывает основа.
    rnd = random.Random(12)
    for _ in range(70):
        x = int(rnd.gauss(cx - 24, 11))
        y = int(rnd.gauss(cy + 4, 5))
        if fx < x < fx + fw - 1 and fy < y < fy + fh - 1:
            c.px(x, y, lit(c.get(x, y), 0.09))
    # Толщина ковра - тёмный нижний край.
    c.hline(x0, y0 + h, w, lit(NAVY, -0.45))
    c.save("bsm_rug")


def decals():
    """Трещина, масляное пятно и трап в полу. Трещина и пятно - полупрозрачные (ложатся на любой пол), трап - вещь."""
    c = Canvas(40, 20)
    dark, edge = H("#181425", 210), H("#8b9bb4", 70)

    def crack(pts):
        for (ax, ay), (bx, by) in zip(pts, pts[1:]):
            c.line(ax, ay, bx, by, dark)
        for (ax, ay), (bx, by) in zip(pts, pts[1:]):
            # Свет сверху слева: дальняя (нижняя) стенка трещины освещена.
            for x, y in _line(ax, ay, bx, by):
                if c.get(x, y + 1)[3] < 150:
                    c.px(x, y + 1, edge)

    crack([(1, 12), (6, 10), (10, 11), (15, 7), (21, 8), (26, 5), (31, 6), (38, 3)])
    crack([(15, 7), (17, 11), (16, 15), (19, 18)])
    crack([(26, 5), (28, 9), (33, 11)])
    c.save("bsm_crack")

    o = Canvas(30, 14)
    for y in range(14):
        for x in range(30):
            d = ((x + 0.5 - 14) / 14) ** 2 + ((y + 0.5 - 7) / 6) ** 2
            d2 = ((x + 0.5 - 22) / 6) ** 2 + ((y + 0.5 - 9) / 4) ** 2
            if d < 1 or d2 < 1:
                o.px(x, y, H("#181425", 150 if min(d, d2) < 0.55 else 95))
    for x, y, tone in ((9, 4, H("#68386c", 120)), (10, 4, H("#b55088", 90)), (11, 5, H("#2ce8f5", 60)), (20, 8, H("#8b9bb4", 80))):
        o.px(x, y, tone)
    o.save("bsm_oil")

    d = Canvas(18, 14)
    d.ellipse(9, 7, 8.5, 6, H("#181425", 90))
    d.ellipse(9, 6.5, 7, 5, SLATE)
    d.ellipse(9, 6.5, 5.5, 3.6, INK)
    for x in range(5, 14, 2):
        for y in range(3, 11):
            if ((x + 0.5 - 9) / 5.5) ** 2 + ((y + 0.5 - 6.5) / 3.6) ** 2 <= 1:
                d.px(x, y, STEEL if y < 7 else SLATE)
    for x in range(4, 9):
        d.px(x, 2, MIST)
    d.px(3, 4, MIST)
    d.px(14, 9, NAVY2)
    d.px(13, 10, NAVY2)
    d.save("bsm_drain")

    z = Canvas(8, 8)
    for y in range(8):
        for x in range(8):
            z.px(x, y, GOLD if (x + y) % 8 < 4 else NAVY)
    z.save("bsm_hazard")


def _line(x0, y0, x1, y1):
    """Точки прямой (как Canvas.line) - чтобы подсветить край трещины."""
    pts = []
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    while True:
        pts.append((x0, y0))
        if x0 == x1 and y0 == y1:
            return pts
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


def jar(c, x, y, w, h, kind):
    """Банка-закрутка (низ - y): плечики и горлышко уже тела, крышка; внутри видно, что закатано (огурцы - полосками,
    помидоры и вишня - кружками, варенье - ровным цветом с пузырём воздуха). Блик стекла слева, тень справа."""
    fill, dots, lid = JARS[kind]
    top = y - h
    c.rect(x, top + 3, w, h - 3, fill)
    c.rect(x + 1, top + 2, w - 2, 1, lit(fill, 0.12))
    if kind == "cuke":
        for dx in range(1, w - 1, 2):
            c.vline(x + dx, top + 4, h - 5, dots)
        c.px(x + 2, top + 4, SAND)
    elif kind in ("tomato", "cherry", "mush"):
        for k, (dx, dy) in enumerate(((2, 4), (w - 3, 6), (2, 8), (w - 3, 3), (3, 6))):
            if dx < w - 1 and top + dy < y - 1:
                c.px(x + dx, top + dy, dots)
                if w > 6:
                    c.px(x + dx + 1, top + dy, lit(dots, -0.2))
    else:
        c.hline(x + 1, top + 3, w - 2, lit(fill, 0.3))
    c.vline(x, top + 3, h - 4, lit(fill, 0.3))
    c.vline(x + 1, top + 4, h - 6, PALE)
    c.vline(x + w - 1, top + 3, h - 3, lit(fill, -0.35))
    c.hline(x, y - 1, w, lit(fill, -0.3))
    c.rect(x + 1, top, w - 2, 2, lid)
    c.hline(x + 1, top, w - 2, lit(lid, 0.35))
    c.px(x + w - 2, top + 1, lit(lid, -0.35))


JARS = {
    "cuke": (GREEN_D, GREEN, GOLD),
    "tomato": (RED, RED_L, GOLD),
    "jam": (ORANGE, GOLD_L, RED_L),
    "cherry": (RED_D, PINK, STEEL),
    "comp": (PINK, RED_D, GOLD),
    "mush": (SAND_D, BR, STEEL),
}


def bottle(c, x, y, tone):
    """Бутылка 3 в ширину (низ - y): горлышко, пробка, этикетка, блик."""
    c.rect(x, y - 10, 3, 10, tone)
    c.rect(x + 1, y - 13, 1, 3, tone)
    c.px(x + 1, y - 14, GOLD if tone == RED_D else RED_L)
    c.vline(x, y - 9, 6, lit(tone, 0.35))
    c.hline(x, y - 5, 3, SAND)
    c.px(x + 2, y - 5, SAND_D)


def rack(name, rows):
    """Стеллаж кладовой 56×64: деревянные стойки и полки, тёмная задняя стенка; на полках трёхлитровые банки огурцов
    и помидоров, варенье, компот, грибы, бутылки (rows - что на каждой полке: «вид:ширина» или «b:тон»). Левая
    стойка освещена, правая - в тени. Два стеллажа с разным набором - чтобы рядом не повторялись."""
    c = Canvas(56, 64)
    c.rect(2, 2, 52, 58, BR_D)
    for x in range(8, 52, 9):
        c.vline(x, 2, 58, lit(BR_D, -0.22))
    shelves = (18, 36, 54)
    for row, y in zip(rows, shelves):
        x = 4
        for item in row:
            if item == "_":
                x += 2
                continue
            kind, size = item.split(":")
            if kind == "b":
                bottle(c, x, y, {"g": GREEN_D, "r": RED_D, "d": DEEP}[size])
                x += 4
            elif size == "L":
                jar(c, x, y, 8, 13, kind)
                x += 9
            else:
                jar(c, x, y, 6, 8, kind)
                x += 7
    # Верх стеллажа (виден сверху) и полки - поверх банок.
    c.rect(0, 0, 56, 3, BR_L)
    c.hline(0, 0, 56, SAND_D)
    for y in shelves:
        c.rect(2, y, 52, 3, BR_L)
        c.hline(2, y, 52, SAND_D)
        c.hline(2, y + 3, 52, lit(BR_D, -0.35))
    for x, tone in ((0, BR_L), (53, BR)):
        c.rect(x, 0, 3, 64, tone)
    c.vline(0, 0, 64, SAND_D)
    c.vline(55, 0, 64, BR_D)
    c.outline(INK)
    shadowed(c, 28, 62, 27, 2.5).save(name)


def barrel():
    """Бочка 24×30 с квашеной капустой: клёпки, два обруча, крышка сверху, на ней камень-гнёт и край холстины."""
    c = Canvas(24, 30)
    # Тело: чуть пузатое, клёпки - полосы тоном.
    for y in range(7, 27):
        t = (y - 7) / 19
        half = 9 + round(1.4 * math.sin(t * math.pi))
        for x in range(12 - half, 12 + half):
            k = (x - (12 - half)) / (2 * half)
            tone = BR_L if k < 0.28 else BR if k < 0.75 else BR_D
            if (x - (12 - half)) % 4 == 0 and 0 < k < 0.95:
                tone = lit(tone, -0.2)
            c.px(x, y, tone)
    for y in (10, 22):
        t = (y - 7) / 19
        half = 9 + round(1.4 * math.sin(t * math.pi))
        c.hline(12 - half, y, 2 * half, SLATE)
        c.hline(12 - half, y - 1, 2 * half, STEEL)
        c.px(12 - half, y - 1, MIST)
        c.px(12 + half - 1, y, NAVY2)
    # Крышка (видна сверху) - светлые доски, ободок.
    c.ellipse(12, 7, 9.5, 4, BR)
    c.ellipse(12, 6.6, 8, 3, SAND_D)
    for x in (8, 12, 16):
        c.vline(x, 4, 6, lit(SAND_D, -0.2))
    # Холстина из-под крышки и камень-гнёт.
    c.rect(3, 8, 3, 4, SAND)
    c.px(3, 12, SAND)
    c.ellipse(13, 5, 4, 2.6, SLATE)
    c.ellipse(12.5, 4.5, 2.8, 1.6, STEEL)
    c.px(11, 4, MIST)
    c.outline(INK)
    shadowed(c, 12, 27, 11, 2.5).save("bsm_barrel")


def cask():
    """Винная бочка 34×28 на козлах, лежит к нам дном: кольца клёпок, обручи, латунный краник, под ним кружка."""
    c = Canvas(34, 28)
    # Козлы.
    for x in (5, 25):
        c.rect(x, 18, 4, 8, BR)
        c.vline(x, 18, 8, BR_L)
    c.rect(3, 22, 28, 2, BR_D)
    # Тело (сбоку) и дно к нам.
    c.rect(8, 3, 22, 18, BR)
    c.hline(8, 3, 22, BR_L)
    c.hline(8, 4, 22, lit(BR_L, -0.1))
    c.hline(8, 20, 22, BR_D)
    for x in (14, 24):
        c.vline(x, 3, 18, SLATE)
        c.vline(x - 1, 3, 18, STEEL)
    c.ellipse(9, 12, 7, 9, BR_D)
    c.ellipse(9, 12, 6, 8, BR_L)
    c.ellipse(9, 12, 4, 6, lit(BR_L, -0.1))
    for y in range(5, 20, 3):
        c.hline(4, y, 10, lit(BR_L, -0.18))
    # Обод дна - обруч.
    for k in range(40):
        a = k * math.pi / 20
        c.px(round(9 + 6.5 * math.cos(a)), round(12 + 8.5 * math.sin(a)), SLATE if math.sin(a) > -0.3 else STEEL)
    # Краник и капля.
    c.rect(8, 15, 3, 2, GOLD)
    c.px(8, 15, GOLD_L)
    c.vline(9, 17, 2, ORANGE)
    c.outline(INK)
    shadowed(c, 17, 26, 15, 2).save("bsm_cask")


def sacks():
    """Мешки с картошкой 34×24: два стоят, перевязаны бечёвкой; третий развязан - сверху видна картошка."""
    c = Canvas(34, 24)

    def sack(x, y, w, h, tone, open_=False):
        c.round_rect(x, y, w, h, tone, r=3)
        for yy in range(y + 1, y + h - 1):
            for xx in range(x + 1, x + w - 1):
                if (xx + yy * 2) % 5 == 0:
                    c.px(xx, yy, lit(tone, -0.12))
        c.vline(x + 1, y + 3, h - 5, lit(tone, 0.2))
        c.vline(x + w - 2, y + 2, h - 3, lit(tone, -0.28))
        c.hline(x + 2, y + h - 1, w - 4, lit(tone, -0.35))
        if open_:
            c.ellipse(x + w / 2, y + 2, w / 2 - 1, 2.5, lit(tone, -0.3))
            for px_, py_ in ((x + 3, y + 1), (x + 6, y + 2), (x + 9, y + 1), (x + 5, y), (x + 8, y + 3)):
                c.rect(px_, py_, 2, 2, BR_L)
                c.px(px_, py_, SAND_D)
        else:
            c.rect(x + w // 2 - 2, y - 3, 4, 4, tone)
            c.hline(x + w // 2 - 3, y + 1, 6, BR_D)

    sack(19, 5, 13, 17, lit(SAND_D, -0.08))
    sack(2, 4, 14, 18, SAND_D)
    sack(9, 10, 14, 13, lit(SAND_D, 0.06), open_=True)
    c.outline(INK)
    shadowed(c, 17, 22, 16, 2).save("bsm_sacks")


def crates():
    """Два деревянных ящика 30×30 друг на друге; в верхнем - яблоки."""
    c = Canvas(30, 30)

    def crate(x, y, w, h):
        c.rect(x, y, w, h, BR_L)
        for yy in range(y + 2, y + h, 4):
            c.hline(x, yy, w, BR)
        c.vline(x, y, h, SAND_D)
        c.vline(x + w - 1, y, h, BR_D)
        c.rect(x + 1, y, 2, h, lit(BR_L, 0.1))
        c.rect(x + w - 3, y, 2, h, BR)
        c.hline(x, y, w, SAND_D)

    crate(2, 15, 26, 13)
    crate(4, 6, 22, 10)
    for k, (ax, ay) in enumerate(((7, 5), (11, 4), (15, 5), (19, 4), (9, 2), (13, 2), (17, 2))):
        c.ellipse(ax + 1.5, ay + 1.5, 2, 2, RED_L if k % 3 else GREEN)
        c.px(ax + 1, ay + 1, PINK_L if k % 3 else lit(GREEN, 0.3))
    c.outline(INK)
    shadowed(c, 15, 28, 14, 2).save("bsm_crates")


def boiler():
    """Котёл 40×76 у левой стены: зелёная эмаль с бликом, манометр, вентиль, дымоход уходит вбок в стену, внизу -
    дверца с окошком (огонь - слой lit). Подходит под тёплый свет снизу зала."""
    c = Canvas(40, 76)
    # Дымоход: вверх и влево в стену.
    c.rect(18, 2, 6, 20, SLATE)
    c.vline(18, 2, 20, MIST)
    c.vline(23, 2, 20, NAVY2)
    c.rect(0, 2, 22, 6, SLATE)
    c.hline(0, 2, 22, MIST)
    c.hline(0, 7, 22, NAVY2)
    c.rect(16, 10, 10, 2, STEEL)
    # Трубы подачи справа: медь с вентилем.
    c.rect(31, 8, 3, 18, CLAY)
    c.vline(31, 8, 18, CLAY_L)
    c.rect(28, 8, 6, 3, CLAY)
    c.hline(28, 8, 6, CLAY_L)
    c.ellipse(32.5, 14, 3, 3, RED_L)
    c.ellipse(32.5, 14, 1.4, 1.4, INK)
    # Корпус.
    c.round_rect(4, 22, 30, 50, TEAL, r=2)
    c.rect(4, 22, 30, 4, DEEP)
    c.hline(5, 22, 28, GREEN_D)
    c.rect(4, 26, 30, 44, DEEP)
    c.rect(5, 27, 4, 42, GREEN_D)
    c.vline(5, 27, 42, GREEN)
    c.rect(30, 26, 4, 44, TEAL)
    c.vline(33, 26, 44, lit(TEAL, -0.3))
    # Шов панелей и заклёпки.
    c.hline(4, 44, 30, TEAL)
    for x in (7, 31):
        for y in (29, 47, 66):
            c.px(x, y, GREEN)
    # Манометр.
    c.ellipse(19, 34, 6, 6, STEEL)
    c.ellipse(19, 34, 4.6, 4.6, PALE)
    c.line(19, 34, 21, 31, INK)
    c.px(22, 33, RED_L)
    c.px(16, 32, MIST)
    c.px(14, 33, STEEL)
    # Табличка.
    c.rect(11, 47, 16, 4, GOLD)
    c.hline(11, 47, 16, GOLD_L)
    c.hline(13, 49, 12, ORANGE)
    # Дверца топки с окошком.
    c.rect(10, 54, 18, 14, NAVY2)
    c.hline(10, 54, 18, SLATE)
    c.vline(10, 54, 14, SLATE)
    c.rect(13, 57, 12, 7, INK)
    c.rect(26, 59, 2, 4, MIST)
    # Ножки.
    c.rect(6, 72, 4, 3, NAVY2)
    c.rect(28, 72, 4, 3, NAVY2)
    c.outline(INK)
    shadowed(c, 20, 74, 17, 2.5).save("bsm_boiler")
    f = Canvas(40, 76)
    f.rect(13, 57, 12, 7, RED)
    for x in range(13, 25):
        h = 3 + round(2.2 * abs(math.sin(x * 1.3)))
        f.vline(x, 64 - h, h, ORANGE)
        f.vline(x, 64 - max(1, h - 2), max(1, h - 2), GOLD_L)
    f.hline(14, 63, 10, PALE)
    f.save("bsm_boiler_lit")


def bench():
    """Верстак 64×44: толстая столешница (видна сверху) с тисками слева, молоток и ключ, банка с гвоздями, старый
    приёмник справа; снизу полка с красным ящиком для инструмента и банкой краски."""
    c = Canvas(64, 44)
    # Ножки и нижняя полка.
    for x in (3, 57):
        c.rect(x, 14, 4, 28, BR)
        c.vline(x, 14, 28, BR_L)
    c.rect(3, 34, 58, 3, BR_L)
    c.hline(3, 34, 58, SAND_D)
    c.hline(3, 37, 58, BR_D)
    c.rect(10, 26, 16, 8, RED)
    c.hline(10, 26, 16, RED_L)
    c.rect(16, 24, 4, 2, INK)
    c.hline(10, 29, 16, lit(RED, -0.3))
    c.rect(34, 27, 8, 7, STEEL)
    c.hline(34, 27, 8, MIST)
    c.hline(34, 30, 8, BLUE)
    c.rect(46, 30, 9, 4, BR_D)
    # Столешница: верх и торец.
    c.rect(0, 6, 64, 8, SAND_D)
    for y in (8, 11):
        c.hline(1, y, 62, lit(SAND_D, -0.1))
    c.hline(0, 6, 64, SAND)
    c.rect(0, 14, 64, 4, BR_L)
    c.hline(0, 17, 64, BR)
    # Тиски.
    c.rect(2, 2, 10, 6, SLATE)
    c.hline(2, 2, 10, MIST)
    c.rect(4, 0, 6, 2, STEEL)
    c.hline(0, 5, 3, STEEL)
    c.rect(4, 14, 6, 5, SLATE)
    # Молоток, ключ, гвозди.
    c.line(18, 11, 26, 8, BR)
    c.rect(25, 6, 2, 4, STEEL)
    c.line(30, 11, 37, 9, STEEL)
    c.px(37, 8, STEEL)
    c.px(30, 12, STEEL)
    c.rect(40, 5, 4, 5, MIST)
    c.hline(40, 5, 4, PALE)
    c.px(41, 4, SLATE)
    # Приёмник: корпус, шкала, ручки, антенна.
    c.rect(47, 0, 14, 10, BR)
    c.hline(47, 0, 14, BR_L)
    c.rect(49, 2, 7, 4, SAND)
    c.hline(50, 4, 5, BR)
    c.px(52, 3, RED_L)
    c.rect(57, 2, 2, 2, GOLD)
    c.rect(57, 6, 2, 2, GOLD)
    c.rect(49, 7, 7, 2, BR_D)
    c.line(60, 0, 63, -3, STEEL)
    c.outline(INK)
    shadowed(c, 32, 42, 30, 2.5).save("bsm_bench")


def floorlamp():
    """Торшер 16×46: абажур с бахромой (светится сценой пятном), латунная стойка, тяжёлое основание."""
    c = Canvas(16, 46)
    c.rect(7, 12, 2, 30, GOLD)
    c.vline(7, 12, 30, GOLD_L)
    c.vline(8, 12, 30, ORANGE)
    c.ellipse(8, 43, 5, 2, NAVY2)
    c.hline(5, 42, 5, SLATE)
    # Абажур трапецией: узкий верх, широкий низ.
    for y in range(0, 12):
        half = 4 + y * 0.35
        for x in range(round(8 - half), round(8 + half)):
            k = (x - (8 - half)) / (2 * half)
            c.px(x, y, SAND if k < 0.3 else GOLD_L if k < 0.7 else GOLD)
    c.hline(4, 0, 8, PALE)
    for x in range(2, 15, 2):
        c.px(x, 12, ORANGE)
    c.hline(3, 11, 11, ORANGE)
    c.outline(INK)
    shadowed(c, 8, 44, 6, 1.5).save("bsm_floorlamp")


def stairs():
    """Лестница вдоль левой стены (22.11): как bsm_stairs, но без тёмного проёма наверху - ступени уходят выше края
    зала, и сцена продолжает их плиткой bsm_steps в темноту (раньше над лестницей зияла чёрная дыра). Ступень - 8
    точек рисунка, ниже - светлее (ближе к лампам), кирпич слева, перила справа."""
    conc = H("#3a4466")

    def flight(c, rows, tone_of):
        for i in range(rows):
            y = i * 8
            tone = tone_of(i)
            c.rect(4, y, 36, 8, tone)
            c.hline(4, y, 36, lit(tone, 0.35))
            c.hline(4, y + 6, 36, lit(tone, -0.3))
            c.hline(4, y + 7, 36, lit(tone, -0.45))
            # Стёртая середина ступени - светлее.
            c.hline(14, y + 1, 14, lit(tone, 0.08))
        c.rect(0, 0, 4, c.h, BR_D)
        for y in range(2, c.h, 6):
            c.hline(0, y, 4, INK)
        c.vline(3, 0, c.h, lit(BR_D, -0.25))
        for y in range(2, c.h, 16):
            c.vline(44, y, 12, H("#3a4466"))
            c.px(44, y, STEEL)
        c.rect(42, 0, 2, c.h, SLATE)
        c.vline(42, 0, c.h, STEEL)
        c.outline(INK)

    c = Canvas(56, 84)
    flight(c, 11, lambda i: lit(conc, -0.42 + i * 0.045))
    c.save("bsm_stairs2")
    # Плитка - ровно до края перил (46): прозрачные столбцы справа атлас обрезал бы, и шаг плитки поплыл бы.
    t = Canvas(46, 16)
    flight(t, 2, lambda i: lit(conc, -0.46))
    t.save("bsm_steps")


def mop():
    """Жёлтое ведро со шваброй 22×32: в ведре вода, тряпка свисает через край, ручка швабры наискосок вверх."""
    c = Canvas(22, 32)
    c.line(10, 20, 18, 0, BR_L)
    c.line(11, 20, 19, 0, BR)
    for y in range(18, 30):
        half = 8 - 2 * (y - 18) / 12
        for x in range(round(11 - half), round(11 + half)):
            k = (x - (11 - half)) / (2 * half)
            c.px(x, y, GOLD_L if k < 0.22 else GOLD if k < 0.72 else ORANGE)
    c.ellipse(11, 18, 8, 2.2, lit(ORANGE, -0.2))
    c.ellipse(11, 18, 6.5, 1.5, BLUE_D)
    c.hline(7, 18, 4, BLUE)
    for x in (8, 10, 12):
        c.vline(x, 16, 5, SAND if x != 12 else SAND_D)
    c.hline(4, 21, 14, ORANGE)
    c.hline(4, 25, 13, lit(ORANGE, -0.15))
    c.px(4, 21, GOLD_L)
    c.outline(INK)
    shadowed(c, 11, 30, 9, 2).save("bsm_mop")


if __name__ == "__main__":
    rug()
    decals()
    rack("bsm_rack", [
        ["cuke:L", "cuke:L", "jam:S", "tomato:L", "b:g", "cherry:S"],
        ["tomato:L", "jam:S", "jam:S", "_", "cuke:L", "b:r", "b:r"],
        ["comp:L", "cuke:L", "mush:S", "tomato:L", "b:d", "_"],
    ])
    rack("bsm_rack2", [
        ["b:r", "b:r", "b:g", "tomato:L", "cherry:S", "cuke:L", "_"],
        ["cuke:L", "comp:L", "_", "mush:S", "jam:S", "b:d"],
        ["jam:S", "cherry:S", "tomato:L", "tomato:L", "cuke:L"],
    ])
    stairs()
    barrel()
    cask()
    sacks()
    crates()
    boiler()
    bench()
    floorlamp()
    mop()
