"""Второй этаж — бутик одежды «как настоящий зал» (src/scenes/floors/secondFloor.ts, src/game/clothes.ts).

14.11, автор: «нужно отрисовать красиво и подвал, и второй этаж, и третий… всё как в основном зале, чтобы было
красиво». Прежний этаж (art/clothes_floor.py) был схемой: голые стойки на паркете. Здесь — светлый бутик:
обои в полоску над белыми панелями, пол «ёлочкой» с потёртостями на ходу, окна во всю стену с улицей за стеклом
и бархатными шторами, стойки с вещами сезона (каждая вещь своя — пуховик, пальто, свитер, плащ, сарафан),
стеллаж со сложенными вещами, обувь на ступенчатой подставке, круглый стол с аксессуарами, примерочные под
карнизом, большое зеркало в золочёной раме, пуф, касса с витриной, стол уценки, растения, ковёр, лестница
с ковровой дорожкой. Улучшения этажа (game/clothesUps.ts) видны: подиумы и споты, неоновая вешалка, витрина
с сумками и таблички марок, чёрный пакет с золотом.

Палитра Endesga 32 (art/sprites.py), двойная детализация (в мире вдвое меньше), контур #181425 у предметов —
как у полок и людей основного зала; пол и обои без контура. Старые картинки этажа (fl2_*) остаются: вход с улицы
(fl2_front), розовый пакет, бирка распродажи и паутинка.

    python3 art/clothes_art.py

Картинки (ширина×высота в пикселях рисунка):
  fl2b_wall        32×88 — обои в полоску, карниз, белые панели и плинтус (плитка задней стены);
  fl2b_floor       48×48 — паркет «ёлочкой», медовые доски (плитка пола);
  fl2b_wear        48×24 — потёртость паркета на ходу (полупрозрачная, кладётся поверх пола);
  fl2b_window[_*]  56×84 — окно во всю стену: улица за стеклом (лето; _warm — снег, _rain — пасмурно и капли),
                           переплёт, бархатные шторы с подхватами;
  fl2b_shelf[_*]   60×84 — стеллаж со сложенными вещами сезона и коробками (без сезона — почти пустой);
  fl2b_rack[_*]    48×52 — стойка-вешалка: пустая или с вещами сезона warm / rain / summer;
  fl2b_table[_*]   48×32 — круглый стол: стопки вещей и аксессуары сезона (шапки, зонт, очки и панама);
  fl2b_shoes[_*]   36×34 — ступенчатая подставка с обувью сезона (сапоги, резиновые, сандалии и кеды);
  fl2b_booth       44×76 — примерочная: карниз, лампа, табурет и крючок, штора сдвинута;
  fl2b_booth_shut  44×76 — штора задёрнута, из-под неё видны ноги;
  fl2b_mirror      32×64 — большое напольное зеркало в золочёной раме;
  fl2b_pouf        24×16 — бархатный пуф у зеркала;
  fl2b_till        76×44 — касса: стойка со стеклянной витриной, аппарат, пакеты, цветы;
  fl2b_bin         48×34 — стол уценки: корзины и ворох вещей прошлого сезона;
  fl2b_plant       26×48 — монстера в белом горшке; fl2b_ficus 22×40 — фикус в плетёном;
  fl2b_stairs      60×64 — проём лестницы снизу: латунные перила, ступени с ковровой дорожкой;
  fl2b_rug         104×52 — овальный ковёр под столом;
  fl2b_podium      30×14 — круглый подиум под манекен (улучшение «Витрины»);
  fl2b_track       64×10 — рейка со спотами под потолком (улучшение «Витрины»);
  fl2b_neon        40×30 — неоновая вешалка на стене (улучшение «Витрины», и значок строки в меню);
  fl2b_brand       48×60 — стеклянная витрина с сумками под золотой табличкой (улучшение «Бренды»);
  fl2b_logo        28×18 — табличка марки на стене (улучшение «Бренды»);
  fl2b_bag_lux     10×12 — чёрный пакет с золотом (покупка с брендами);
  fl2b_sun         64×56 — солнце из окна на полу (белое, кладётся сложением);
  fl2b_manq_*0/1   24×40 — манекен без лица в вещах сезона (два наряда на коллекцию), на подставке;
  fl2b_form[_*]    20×40 — портновский бюст на треноге в вещи сезона (посреди зала, пока нет витрины марок);
  fl2b_poster0/1   20×26 — модные картинки в рамах над примерочными (пока нет неона и табличек).
"""

import math

from premium import H, lit, mix, noise
from sprites import Canvas, shadowed

INK = H("#181425")
NAVY, NAVY_L, SLATE = H("#262b44"), H("#3a4466"), H("#5a6988")
METAL, METAL_L, WHITE = H("#8b9bb4"), H("#c0cbdc"), H("#ffffff")
DARK, WOOD_D, WOOD, BROWN = H("#3e2731"), H("#733e39"), H("#b86f50"), H("#8f563b")
SAND, CREAM, PEACH, TAN = H("#e4a672"), H("#ead4aa"), H("#e8b796"), H("#c28569")
RUST, CLAY = H("#be4a2f"), H("#d77643")
RED_D, RED, ORANGE = H("#a22633"), H("#e43b44"), H("#f77622")
GOLD, GOLD_L = H("#feae34"), H("#fee761")
GREEN_L, GREEN, GREEN_D, TEAL_D = H("#63c74d"), H("#3e8948"), H("#265c42"), H("#193c3e")
DEEP, BLUE, CYAN = H("#124e89"), H("#0099db"), H("#2ce8f5")
PLUM, PINK_D, PINK, HOT = H("#68386c"), H("#b55088"), H("#f6757a"), H("#ff0044")


def a(c, alpha):
    """Тот же цвет с прозрачностью (для потёртостей и стекла)."""
    return c[:3] + (alpha,)


# ---------------------------------------------------------------- стены и пол


def wall():
    """Задняя стена: белый карниз, обои в мягкую розово-кремовую полоску с мелким узором, белая планка, панели
    с филёнками и плинтус. Плитка 32 по ширине — полосы и филёнки ложатся ровно по 16."""
    c = Canvas(32, 88)
    # Карниз под потолком.
    c.hline(0, 0, 32, METAL_L)
    c.rect(0, 1, 32, 2, WHITE)
    c.hline(0, 3, 32, CREAM)
    c.hline(0, 4, 32, TAN)
    # Обои: кремовый фон, широкие персиковые полосы с тонкой розовой нитью и ромбиками.
    c.rect(0, 5, 32, 49, CREAM)
    for x0 in (0, 16):
        c.rect(x0 + 5, 5, 6, 49, PEACH)
        c.vline(x0 + 5, 5, 49, lit(PEACH, -0.08))
        c.vline(x0 + 8, 5, 49, lit(PINK, 0.5))
        for y in range(9 + (x0 // 16) * 6, 54, 12):
            c.px(x0 + 13, y, lit(PINK, 0.5))
            c.px(x0 + 14, y + 1, lit(PINK, 0.5))
            c.px(x0 + 12, y + 1, lit(PINK, 0.5))
            c.px(x0 + 13, y + 2, lit(PINK, 0.5))
    # Тень под карнизом.
    c.hline(0, 5, 32, lit(PEACH, -0.12))
    # Планка над панелями.
    c.hline(0, 54, 32, WHITE)
    c.hline(0, 55, 32, CREAM)
    c.hline(0, 56, 32, TAN)
    # Панели с филёнками.
    c.rect(0, 57, 32, 24, lit(CREAM, 0.35))
    for x0 in (0, 16):
        c.hline(x0 + 2, 59, 12, WHITE)
        c.vline(x0 + 2, 59, 19, WHITE)
        c.hline(x0 + 3, 77, 12, SAND)
        c.vline(x0 + 14, 60, 18, SAND)
        c.rect(x0 + 3, 60, 11, 17, lit(CREAM, 0.2))
    # Плинтус.
    c.hline(0, 81, 32, WHITE)
    c.rect(0, 82, 32, 4, CREAM)
    c.hline(0, 86, 32, TAN)
    c.hline(0, 87, 32, WOOD)
    c.save("fl2b_wall")


def _herringbone(s):
    """Чья доска в точке: ёлочка из досок s×2s, плитка 8s×8s повторяется без швов (решётка (s,s) и (−2s,2s))."""
    boards = {}
    period = 8 * s
    for band in range(-8, 9):
        ox, oy = -2 * s * band, 2 * s * band
        for i in range(-16, 17):
            # Поперечная доска 2s×s и продольная s×2s.
            hx, hy = ox + s * i, oy + s * i
            vx, vy = ox + s * i + 2 * s, oy + s * i - s
            for (bx, by, bw, bh, kind) in ((hx, hy, 2 * s, s, 0), (vx, vy, s, 2 * s, 1)):
                # Имя доски — её угол по модулю плитки: доска, которую режет край плитки, с обеих сторон одна.
                name = (bx % period, by % period, kind)
                for yy in range(by, by + bh):
                    for xx in range(bx, bx + bw):
                        if 0 <= xx < period and 0 <= yy < period:
                            boards[(xx, yy)] = name
    return boards


def floor():
    """Паркет «ёлочкой»: медовые доски в два-три тона, тонкий шов, светлая кромка сверху-слева. Тона близкие —
    пол живой, но не рябит под людьми (как спокойная плитка основного зала)."""
    s = 6
    n = 8 * s
    c = Canvas(n, n)
    boards = _herringbone(s)
    tones = [mix(PEACH, SAND, 0.35), mix(PEACH, CREAM, 0.25), mix(PEACH, SAND, 0.15), PEACH]
    grain = noise(77)
    for y in range(n):
        for x in range(n):
            b = boards.get((x, y))
            k = (hash(b) & 0xFFFF) % len(tones)
            tone = tones[k]
            if grain(x, y) > 0.93:
                tone = lit(tone, -0.06)
            c.px(x, y, tone)
    for y in range(n):
        for x in range(n):
            b = boards.get((x, y))
            right = boards.get(((x + 1) % n, y))
            down = boards.get((x, (y + 1) % n))
            if right != b or down != b:
                c.px(x, y, mix(SAND, TAN, 0.35))
            left = boards.get(((x - 1) % n, y))
            up = boards.get((x, (y - 1) % n))
            if (left != b or up != b) and not (right != b or down != b):
                c.px(x, y, mix(PEACH, CREAM, 0.6))
    c.save("fl2b_floor")


def wear():
    """Потёртость на ходу: доски посветлели и потеряли лак — неровное пятно светлее и тусклее, пара царапин."""
    c = Canvas(48, 24)
    nz = noise(5)
    for y in range(24):
        for x in range(48):
            d = ((x - 23.5) / 24) ** 2 + ((y - 11.5) / 12) ** 2
            if d < 1:
                alpha = int(70 * (1 - d) ** 1.2 * (0.6 + 0.4 * nz(x // 2, y)))
                if alpha > 6:
                    c.px(x, y, a(CREAM, alpha))
    for x0, y0, ln in ((10, 9, 9), (26, 14, 7), (18, 6, 5)):
        for i in range(ln):
            c.px(x0 + i, y0 + (i // 4), a(TAN, 90))
    c.save("fl2b_wear")


def blend(c, x, y, col, t):
    """Подмешать цвет к уже нарисованному пикселю (блик и капли на стекле — без дыр в прозрачность)."""
    c.px(x, y, mix(c.get(x, y), col, t))


def window(kind=None):
    """Окно во всю стену: белая рама и переплёт, за стеклом — улица (мы на втором этаже): небо, дом напротив
    (кирпич, окна), дом пониже, дерево и кусочек тротуара; по бокам — бархатные шторы на кольцах, подхваченные
    золотым шнуром; снизу — широкий подоконник. За окном — сезон коллекции: летом солнце и зелень, в сезон плащей —
    пасмурно и капли на стекле, к холодам — снег на крышах и голое дерево."""
    W_, H_ = 56, 84
    c = Canvas(W_, H_)
    gx, gy, gw, gh = 9, 4, 38, 72
    if kind == "warm":
        sky = (mix(METAL_L, CYAN, 0.15), mix(METAL_L, WHITE, 0.3), mix(METAL_L, WHITE, 0.55))
    elif kind == "rain":
        sky = (SLATE, METAL, mix(METAL, METAL_L, 0.5))
    else:
        sky = (BLUE, mix(BLUE, CYAN, 0.45), mix(CYAN, WHITE, 0.35))
    # Небо: сверху насыщеннее, к горизонту светлее.
    for y in range(gy, gy + gh):
        t = (y - gy) / gh
        c.hline(gx, y, gw, sky[0] if t < 0.18 else sky[1] if t < 0.32 else sky[2])
    # Облако (в дождь — низкие тучи).
    cloud = WHITE if kind != "rain" else mix(METAL_L, WHITE, 0.2)
    for cx, cy, r in ((18, 12, 3.5), (22, 11, 4.5), (27, 12, 3.5)) + (((36, 9, 4), (40, 10, 3)) if kind == "rain" else ()):
        c.ellipse(cx, cy, r, r * 0.7, cloud)
    # Дом напротив: кирпич, белые наличники, окна.
    brick = RUST if kind != "rain" else lit(RUST, -0.15)
    c.rect(gx, 30, 24, 46, brick)
    c.rect(gx, 28, 24, 2, WOOD_D)
    for yy in range(32, 76, 3):
        for xx in range(gx + (yy // 3) % 2 * 2, gx + 24, 4):
            c.px(xx, yy, lit(brick, -0.15))
    glass = GOLD_L if kind == "warm" else mix(DEEP, CYAN, 0.4)
    for wx in (gx + 3, gx + 13):
        for wy in (34, 50):
            c.rect(wx, wy, 7, 10, CREAM)
            c.rect(wx + 1, wy + 1, 5, 8, DEEP)
            c.rect(wx + 1, wy + 1, 5, 3, glass)
            c.vline(wx + 3, wy + 1, 8, CREAM)
    # Второй дом — пониже, оштукатуренный.
    c.rect(gx + 24, 40, 14, 36, CREAM)
    c.rect(gx + 24, 38, 14, 2, TAN)
    for wy in (44, 56):
        c.rect(gx + 27, wy, 8, 7, CREAM)
        c.rect(gx + 28, wy + 1, 6, 5, NAVY_L)
        c.rect(gx + 28, wy + 1, 6, 2, glass if kind == "warm" else lit(BLUE, 0.2))
    if kind == "warm":
        # Снег на крышах и карнизах.
        c.rect(gx, 27, 24, 2, WHITE)
        c.rect(gx + 24, 37, 14, 2, WHITE)
        for wx in (gx + 3, gx + 13):
            for wy in (34, 50):
                c.hline(wx, wy + 10, 7, WHITE)
    # Дерево перед домами: летом — пышная крона, в дождь — темнее, к холодам — голые ветки в снегу.
    if kind == "warm":
        c.vline(gx + 30, 52, 20, WOOD_D)
        for (x0, y0, x1, y1) in ((30, 60, 25, 54), (30, 58, 35, 52), (30, 64, 36, 60), (30, 62, 24, 59), (25, 54, 23, 51), (35, 52, 37, 49)):
            c.line(gx + x0, y0, gx + x1, y1, WOOD_D)
        for x, y in ((25, 53), (35, 51), (36, 59), (24, 58), (23, 50), (37, 48)):
            c.px(gx + x, y, WHITE)
    else:
        leaf, leaf_l = (GREEN, GREEN_L) if kind != "rain" else (GREEN_D, GREEN)
        for cx, cy, r in ((gx + 30, 58, 6), (gx + 25, 62, 5), (gx + 35, 63, 4.5)):
            c.ellipse(cx, cy, r, r, leaf)
        for cx, cy, r in ((gx + 29, 56, 3.5), (gx + 24, 60, 2.5)):
            c.ellipse(cx, cy, r, r, leaf_l)
        c.vline(gx + 30, 64, 8, WOOD_D)
    # Тротуар и бордюр внизу (к холодам — в снегу, в дождь — мокрый с лужей).
    c.rect(gx, 70, gw, 6, WHITE if kind == "warm" else METAL_L if kind != "rain" else METAL)
    c.hline(gx, 70, gw, WHITE)
    c.hline(gx, 73, gw, METAL_L if kind == "warm" else METAL)
    if kind == "rain":
        c.hline(gx + 6, 74, 10, lit(CYAN, -0.2))
        c.hline(gx + 22, 75, 7, lit(CYAN, -0.2))
    if kind == "warm":
        # Снежинки в небе.
        for x, y in ((12, 20), (20, 6), (31, 18), (40, 8), (44, 24), (15, 30), (37, 30), (26, 24)):
            c.px(x, y, WHITE)
    # Стекло: косые блики, в дождь — капли и дорожки.
    for i in range(10):
        blend(c, gx + 4 + i, gy + 24 - i * 2, WHITE, 0.6)
        blend(c, gx + 5 + i, gy + 24 - i * 2, WHITE, 0.6)
    for i in range(6):
        blend(c, gx + 28 + i, gy + 50 - i * 2, WHITE, 0.45)
    if kind == "rain":
        for x0, y0, ln in ((12, 6, 9), (17, 22, 7), (24, 40, 10), (30, 8, 6), (38, 30, 9), (43, 52, 7), (14, 50, 8), (35, 60, 6)):
            for k in range(ln):
                blend(c, x0, y0 + k, WHITE, 0.35 if k < ln - 1 else 0.7)
    # Рама и переплёт: две створки и фрамуга.
    c.frame(gx - 2, gy - 2, gw + 4, gh + 4, WHITE)
    c.frame(gx - 1, gy - 1, gw + 2, gh + 2, METAL_L)
    c.vline(gx + gw // 2, gy, gh, WHITE)
    c.vline(gx + gw // 2 + 1, gy, gh, METAL_L)
    c.hline(gx, gy + 16, gw, WHITE)
    c.hline(gx, gy + 17, gw, METAL_L)
    c.px(gx + gw // 2 - 2, gy + 44, GOLD)
    c.px(gx + gw // 2 + 3, gy + 44, GOLD)
    # Подоконник.
    c.rect(4, 76, 48, 4, WHITE)
    c.hline(4, 79, 48, METAL_L)
    c.hline(5, 80, 46, a(INK, 90))
    # Карниз и шторы: бархат, складки, подхват золотым шнуром.
    c.rect(1, 0, 54, 2, GOLD)
    c.hline(1, 0, 54, GOLD_L)
    c.px(0, 0, WOOD_D)
    c.px(55, 0, WOOD_D)
    for side in (0, 1):
        for y in range(2, 78):
            # Штора прихвачена у подхвата (y≈44) и чуть расходится к полу; уже рамы не становится — за ней не
            # видно пустоты.
            w = 10 + (1 if y > 60 else 0) + (1 if y > 70 else 0) - (1 if 40 <= y <= 47 else 0)
            x0 = 0 if side == 0 else 56 - w
            for i in range(w):
                fold = (i + (0 if side == 0 else 1)) % 4
                tone = PINK_D if fold in (0, 1) else lit(PINK_D, 0.18) if fold == 2 else PLUM
                c.px(x0 + i, y, tone)
            edge = x0 + w - 1 if side == 0 else x0
            c.px(edge, y, PLUM)
        tie_x = 2 if side == 0 else 47
        c.rect(tie_x, 43, 7, 2, GOLD)
        c.hline(tie_x, 43, 7, GOLD_L)
        c.px(tie_x + (6 if side == 0 else 0), 45, GOLD)
        c.px(tie_x + (6 if side == 0 else 0), 46, GOLD_L)
    c.outline(INK)
    c.save(f"fl2b_window_{kind}" if kind else "fl2b_window")


# ---------------------------------------------------------------- вещи на вешалках

# Каждая вещь — спереди, на плечиках: крючок над перекладиной, плечи, корпус. x — середина вещи, top — строка
# перекладины. Ширина 9 (рукава чуть шире), вещи стоят с шагом 6 и слегка заходят друг на друга — висит плотно,
# как в магазине. Левый край — в тени соседней вещи.


def hook(c, x, top):
    c.px(x, top - 2, METAL)
    c.px(x + 1, top - 1, METAL)
    c.px(x, top - 1, METAL_L)


def shade(c, x, y, h, tone):
    c.vline(x, y, h, lit(tone, -0.4))


def puffer(c, x, top, tone):
    """Пуховик: меховой капюшон, стёганые полосы, молния."""
    hook(c, x, top)
    y = top + 2
    c.rect(x - 3, y, 7, 3, CREAM)
    c.px(x - 1, y + 1, lit(CREAM, -0.2))
    c.px(x + 1, y, WHITE)
    c.rect(x - 4, y + 3, 9, 19, tone)
    for yy in range(y + 6, y + 22, 4):
        c.hline(x - 4, yy, 9, lit(tone, -0.3))
        c.hline(x - 4, yy - 1, 9, lit(tone, 0.12))
    c.vline(x, y + 3, 19, lit(tone, 0.4))
    shade(c, x - 4, y + 3, 19, tone)
    c.vline(x + 4, y + 3, 19, lit(tone, -0.15))


def coat(c, x, top, tone):
    """Пальто: длинное, с лацканами и двумя рядами пуговиц."""
    hook(c, x, top)
    y = top + 2
    c.rect(x - 4, y, 9, 26, tone)
    c.px(x - 1, y, lit(tone, -0.45))
    c.px(x, y + 1, lit(tone, -0.45))
    c.px(x + 1, y, lit(tone, -0.45))
    c.vline(x - 2, y + 1, 5, lit(tone, 0.25))
    c.vline(x + 2, y + 1, 5, lit(tone, 0.25))
    for yy in (y + 9, y + 14, y + 19):
        c.px(x - 1, yy, GOLD)
        c.px(x + 1, yy, GOLD)
    c.hline(x - 3, y + 16, 2, lit(tone, -0.3))
    c.hline(x + 2, y + 16, 2, lit(tone, -0.3))
    shade(c, x - 4, y, 26, tone)
    c.hline(x - 4, y + 25, 9, lit(tone, -0.3))


def sweater(c, x, top, tone, stripe=None):
    """Свитер: вязка, резинка внизу и на рукавах, иногда полоса узора."""
    hook(c, x, top)
    y = top + 2
    c.rect(x - 5, y, 11, 3, tone)
    c.rect(x - 4, y + 3, 9, 13, tone)
    c.rect(x - 5, y + 3, 1, 10, lit(tone, -0.2))
    c.rect(x + 5, y + 3, 1, 10, lit(tone, -0.2))
    for xx in range(x - 4, x + 5, 2):
        c.vline(xx, y + 4, 10, lit(tone, 0.1))
    c.hline(x - 4, y + 15, 9, lit(tone, -0.3))
    c.hline(x - 4, y + 14, 9, lit(tone, -0.15))
    c.px(x, y, lit(tone, -0.4))
    if stripe:
        c.hline(x - 4, y + 7, 9, stripe)
        for xx in range(x - 3, x + 4, 2):
            c.px(xx, y + 8, stripe)
    shade(c, x - 4, y + 3, 13, tone)


def trench(c, x, top, tone):
    """Плащ: длинный, с поясом, погончиками и двубортной застёжкой."""
    hook(c, x, top)
    y = top + 2
    c.rect(x - 4, y, 9, 27, tone)
    c.rect(x - 3, y, 7, 2, lit(tone, 0.25))
    c.px(x, y + 2, lit(tone, -0.4))
    c.hline(x - 4, y + 12, 9, lit(tone, -0.35))
    c.px(x + 2, y + 13, lit(tone, -0.35))
    c.px(x + 2, y + 14, lit(tone, -0.35))
    for yy in (y + 5, y + 9, y + 17):
        c.px(x - 2, yy, WOOD_D)
        c.px(x + 1, yy, WOOD_D)
    c.vline(x - 1, y + 13, 14, lit(tone, -0.15))
    shade(c, x - 4, y, 27, tone)


def raincoat(c, x, top, tone):
    """Дождевик: глянцевый, с капюшоном и кнопками; блик вдоль."""
    hook(c, x, top)
    y = top + 2
    c.rect(x - 3, y, 7, 4, tone)
    c.rect(x - 2, y + 1, 5, 2, lit(tone, -0.35))
    c.rect(x - 4, y + 4, 9, 20, tone)
    c.vline(x + 2, y + 5, 16, lit(tone, 0.5))
    c.vline(x, y + 4, 20, lit(tone, -0.25))
    for yy in (y + 8, y + 13, y + 18):
        c.px(x - 1, yy, WHITE)
    shade(c, x - 4, y + 4, 20, tone)


def dress(c, x, top, tone, dots=None):
    """Сарафан: бретельки, приталенный лиф, расклёшенная юбка; бывает в горошек."""
    hook(c, x, top)
    y = top + 2
    c.px(x - 2, y, tone)
    c.px(x + 2, y, tone)
    c.px(x - 2, y + 1, tone)
    c.px(x + 2, y + 1, tone)
    c.rect(x - 3, y + 2, 7, 7, tone)
    c.hline(x - 3, y + 9, 7, lit(tone, -0.35))
    for i in range(12):
        w = 7 + (i * 4) // 11
        c.hline(x - w // 2, y + 10 + i, w + (w + 1) % 2, tone)
    for i in range(2, 12, 3):
        c.px(x - 2, y + 10 + i, lit(tone, -0.2))
        c.px(x + 2, y + 10 + i, lit(tone, 0.2))
    if dots:
        for dx, dy in ((-2, 4), (1, 6), (-1, 12), (2, 15), (-3, 18), (0, 19), (3, 20)):
            c.px(x + dx, y + dy, dots)
    c.vline(x - 3, y + 2, 7, lit(tone, -0.3))


def tshirt(c, x, top, tone, print_=None):
    """Футболка: рукава в стороны, круглый ворот, картинка на груди."""
    hook(c, x, top)
    y = top + 2
    c.rect(x - 5, y, 11, 4, tone)
    c.rect(x - 3, y + 4, 7, 11, tone)
    c.px(x, y, lit(tone, -0.45))
    c.px(x - 1, y, lit(tone, -0.3))
    c.px(x + 1, y, lit(tone, -0.3))
    c.hline(x - 5, y + 3, 2, lit(tone, -0.25))
    c.hline(x + 4, y + 3, 2, lit(tone, -0.25))
    if print_:
        c.rect(x - 1, y + 5, 3, 3, print_)
    c.hline(x - 3, y + 14, 7, lit(tone, -0.3))
    shade(c, x - 3, y + 4, 11, tone)


def shirt(c, x, top, tone):
    """Рубашка: воротник, планка с пуговицами, короткие рукава."""
    hook(c, x, top)
    y = top + 2
    c.rect(x - 4, y, 9, 4, tone)
    c.rect(x - 3, y + 4, 7, 14, tone)
    c.px(x - 1, y, WHITE)
    c.px(x + 1, y, WHITE)
    c.px(x - 2, y + 1, lit(tone, -0.2))
    c.px(x + 2, y + 1, lit(tone, -0.2))
    c.vline(x, y + 2, 16, lit(tone, -0.2))
    for yy in range(y + 4, y + 17, 4):
        c.px(x, yy, METAL)
    c.hline(x - 3, y + 17, 7, lit(tone, -0.3))
    shade(c, x - 3, y + 4, 14, tone)


def shorts(c, x, top, tone):
    """Шорты на плечиках с прищепками."""
    hook(c, x, top)
    y = top + 2
    c.hline(x - 3, y, 7, METAL)
    c.px(x - 3, y + 1, METAL_L)
    c.px(x + 3, y + 1, METAL_L)
    c.rect(x - 3, y + 2, 7, 4, tone)
    c.rect(x - 3, y + 6, 3, 5, tone)
    c.rect(x + 1, y + 6, 3, 5, tone)
    c.hline(x - 3, y + 2, 7, lit(tone, -0.3))
    c.px(x, y + 3, lit(tone, -0.3))
    c.vline(x - 3, y + 2, 9, lit(tone, -0.35))


def umbrella(c, x, top, tone):
    """Сложенный зонт на ручке-крючке."""
    c.px(x + 1, top - 2, WOOD_D)
    c.px(x + 2, top - 1, WOOD_D)
    c.px(x + 1, top, WOOD_D)
    c.vline(x, top + 1, 3, WOOD_D)
    for i in range(16):
        w = 4 if i < 4 else 3 if i < 11 else 2 if i < 14 else 1
        c.hline(x - w // 2, top + 4 + i, w, tone if i % 3 else lit(tone, -0.3))
    c.px(x, top + 20, METAL_L)


SEASON_RACK = {
    "warm": ((puffer, RED_D), (coat, NAVY_L), (sweater, GREEN, CREAM), (puffer, DEEP), (coat, TAN), (sweater, CREAM, RED)),
    "rain": ((trench, SAND), (raincoat, GOLD), (trench, TAN), (umbrella, DEEP), (raincoat, RED), (trench, CREAM), (coat, SLATE)),
    "summer": ((dress, PINK, WHITE), (tshirt, CYAN, GOLD_L), (shirt, WHITE), (dress, GOLD_L), (tshirt, GREEN_L, PINK), (shorts, BLUE), (dress, ORANGE)),
}


def rack(kind=None):
    """Стойка-вешалка: хромированная перекладина на двух стойках, колёсики, вещи сезона плотным рядом."""
    c = Canvas(48, 52)
    top = 6
    # Задняя часть рамы — до вещей.
    for x in (3, 44):
        c.vline(x, top, 40, METAL)
        c.vline(x + 1, top, 40, METAL_L)
    c.rect(2, top - 1, 44, 2, METAL)
    c.hline(2, top - 1, 44, WHITE)
    c.px(2, top - 2, METAL_L)
    c.px(45, top - 2, METAL_L)
    if kind is None:
        for x in range(9, 42, 5):
            hook(c, x, top)
            c.px(x - 2, top + 2, METAL_L)
            c.px(x + 2, top + 2, METAL_L)
            c.hline(x - 1, top + 1, 3, METAL_L)
    else:
        items = SEASON_RACK[kind]
        step = 34 / (len(items) - 1)
        for i, item in enumerate(items):
            fn, *args = item
            fn(c, round(8 + i * step), top + 1, *args)
    # Основание: поперечина, ножки на колёсиках.
    c.rect(2, top + 38, 44, 2, METAL)
    c.hline(2, top + 38, 44, METAL_L)
    for x in (3, 44):
        c.rect(x - 3, top + 40, 8, 2, SLATE)
        c.hline(x - 3, top + 40, 8, METAL)
        c.rect(x - 3, top + 42, 2, 2, NAVY)
        c.rect(x + 3, top + 42, 2, 2, NAVY)
    c.outline(INK)
    shadowed(c, 24, 48, 22, 3).save(f"fl2b_rack_{kind}" if kind else "fl2b_rack")


# ---------------------------------------------------------------- сложенные вещи, стеллаж, стол, обувь

SEASON_FOLD = {
    "warm": (RED_D, NAVY_L, GREEN, CREAM, PLUM, TAN, DEEP, RED),
    "rain": (SAND, GOLD, TAN, DEEP, CREAM, SLATE, RED, GREEN),
    "summer": (PINK, CYAN, GOLD_L, WHITE, GREEN_L, ORANGE, BLUE, PINK_D),
    None: (CREAM, METAL_L),
}


def folded(c, x, y, w, tone, n=3, step=3):
    """Стопка сложенных вещей: n слоёв, у каждого светлый верх и тёмная кромка; верхняя — с воротом."""
    for i in range(n):
        yy = y - i * step
        t = tone if i % 2 == 0 else lit(tone, 0.12)
        c.rect(x, yy - step + 1, w, step, t)
        c.hline(x, yy - step + 1, w, lit(t, 0.3))
        c.hline(x, yy, w, lit(t, -0.3))
        c.px(x, yy - 1, lit(t, -0.2))
        c.px(x + w - 1, yy - 1, lit(t, -0.2))
    topy = y - n * step + 1
    c.px(x + w // 2, topy + 1, lit(tone, -0.35))
    c.px(x + w // 2 - 1, topy + 1, lit(tone, -0.2))


def shelf(kind=None):
    """Стеллаж у стены: белое дерево с карнизом, три полки ячейками по три со стопками сложенных вещей сезона,
    внизу — коробки с обувью; наверху — шляпная коробка и корзина."""
    c = Canvas(60, 84)
    body = lit(CREAM, 0.35)
    c.rect(2, 10, 56, 72, body)
    c.rect(1, 8, 58, 3, WHITE)
    c.hline(1, 11, 58, SAND)
    # Внутри — тень задней стенки.
    for row in range(4):
        y0 = 13 + row * 17
        c.rect(5, y0, 50, 14, mix(CREAM, PEACH, 0.5))
        c.hline(5, y0, 50, TAN)
        c.rect(4, y0 + 14, 52, 2, WHITE)
        c.hline(4, y0 + 16, 52, SAND)
    for x in (21, 38):
        c.rect(x, 13, 2, 66, WHITE)
        c.vline(x + 1, 13, 66, METAL_L)
    c.vline(2, 10, 72, WHITE)
    c.vline(57, 10, 72, SAND)
    c.rect(1, 80, 58, 3, TAN)
    c.hline(1, 80, 58, SAND)
    tones = SEASON_FOLD[kind]
    k = 0
    for row in range(3):
        y0 = 13 + row * 17
        for col, x0 in enumerate((6, 23, 40)):
            if kind is None and (row + col) % 3:
                continue
            for sx in (x0 + 1, x0 + 8):
                if kind is None and sx != x0 + 1:
                    continue
                folded(c, sx, y0 + 13, 7, tones[k % len(tones)], n=3 if (row + col + sx) % 2 else 4)
                k += 1
    # Нижняя полка: коробки с обувью.
    y0 = 13 + 3 * 17
    for i, x0 in enumerate(range(6, 54, 8)):
        tone = (WHITE, PINK, CREAM, DEEP, WHITE, TAN)[i % 6]
        c.rect(x0, y0 + 6, 7, 8, tone)
        c.hline(x0, y0 + 6, 7, lit(tone, 0.3))
        c.hline(x0, y0 + 8, 7, lit(tone, -0.25))
        c.px(x0 + 3, y0 + 11, lit(tone, -0.4))
    # Наверху: шляпная коробка в полоску и плетёная корзина.
    c.ellipse(14, 4, 7, 3, PINK)
    c.rect(7, 3, 15, 5, PINK)
    for x in range(8, 22, 3):
        c.vline(x, 3, 5, WHITE)
    c.ellipse(14, 3, 7, 2, lit(PINK, 0.3))
    c.rect(36, 2, 16, 6, SAND)
    for x in range(37, 52, 2):
        c.vline(x, 2, 6, TAN)
    c.hline(36, 2, 16, lit(SAND, 0.3))
    c.outline(INK)
    shadowed(c, 30, 82, 28, 2).save(f"fl2b_shelf_{kind}" if kind else "fl2b_shelf")


def table(kind=None):
    """Круглый стол-подиум: светлая столешница, стопки вещей и аксессуары сезона, ножка-тумба."""
    c = Canvas(48, 32)
    c.rect(18, 18, 12, 10, WHITE)
    c.vline(18, 18, 10, METAL_L)
    c.vline(29, 18, 10, METAL_L)
    c.ellipse(24, 28, 9, 2.5, CREAM)
    c.ellipse(24, 15, 22, 7, CREAM)
    c.ellipse(24, 14, 22, 6.5, lit(CREAM, 0.4))
    c.ellipse(24, 14, 20, 5, WHITE)
    tones = SEASON_FOLD[kind or None]
    folded(c, 8, 16, 8, tones[0], n=3)
    folded(c, 31, 16, 8, tones[1 % len(tones)], n=4)
    if kind == "warm":
        # Вязаная шапка с помпоном и варежки.
        c.rect(19, 9, 8, 5, RED)
        for xx in range(19, 27, 2):
            c.vline(xx, 10, 3, lit(RED, -0.2))
        c.hline(19, 13, 8, WHITE)
        c.rect(22, 7, 2, 2, WHITE)
        c.rect(27, 14, 3, 4, NAVY_L)
        c.px(30, 15, NAVY_L)
    elif kind == "rain":
        # Сложенный зонт поперёк и резиновые сапожки.
        for i in range(12):
            c.px(16 + i, 12 + i // 4, DEEP if i % 3 else lit(DEEP, 0.3))
            c.px(16 + i, 13 + i // 4, DEEP)
        c.px(28, 15, WOOD_D)
        c.px(29, 14, WOOD_D)
        c.rect(19, 7, 3, 6, GOLD)
        c.rect(19, 12, 4, 2, GOLD)
        c.rect(23, 7, 3, 6, GOLD)
        c.rect(23, 12, 4, 2, GOLD)
    elif kind == "summer":
        # Соломенная панама и тёмные очки.
        c.ellipse(23, 12, 6, 2, GOLD_L)
        c.ellipse(23, 10, 3.5, 2.5, SAND)
        c.hline(20, 11, 7, RED)
        c.rect(27, 15, 3, 2, NAVY)
        c.rect(31, 15, 3, 2, NAVY)
        c.hline(30, 15, 1, NAVY)
    c.outline(INK)
    shadowed(c, 24, 28, 14, 3).save(f"fl2b_table_{kind}" if kind else "fl2b_table")


SEASON_SHOES = {
    "warm": ((WOOD_D, "boot"), (NAVY, "boot"), (TAN, "boot"), (DARK, "boot"), (RED_D, "low"), (BROWN, "boot")),
    "rain": ((GOLD, "boot"), (RED, "boot"), (GREEN, "boot"), (DEEP, "boot"), (WOOD_D, "low"), (PINK, "boot")),
    "summer": ((WHITE, "sneak"), (PINK, "sandal"), (CYAN, "sneak"), (GOLD_L, "sandal"), (WHITE, "sneak"), (TAN, "sandal")),
}


def pair(c, x, y, tone, kind):
    """Пара обуви боком: сапоги — высокие, туфли — низкие, кеды — со светлой подошвой, сандалии — ремешки."""
    for dx in (0, 4):
        xx = x + dx
        if kind == "boot":
            c.rect(xx, y - 7, 3, 7, tone)
            c.rect(xx, y - 2, 4, 2, tone)
            c.vline(xx, y - 7, 5, lit(tone, 0.25))
            c.hline(xx, y, 4, lit(tone, -0.4))
        elif kind == "sneak":
            c.rect(xx, y - 3, 4, 3, tone)
            c.hline(xx, y, 4, METAL_L)
            c.px(xx + 1, y - 2, RED)
        elif kind == "sandal":
            c.hline(xx, y, 4, SAND)
            c.px(xx + 1, y - 1, tone)
            c.px(xx + 3, y - 1, tone)
            c.px(xx + 2, y - 2, tone)
        else:
            c.rect(xx, y - 2, 4, 2, tone)
            c.px(xx + 3, y - 3, tone)
            c.hline(xx, y, 4, lit(tone, -0.4))


def shoes(kind=None):
    """Подставка с обувью: три белые ступени, на каждой — пары сезона."""
    c = Canvas(36, 34)
    for i in range(3):
        y = 10 + i * 8
        x0 = 6 - i * 2
        c.rect(x0, y, 36 - 2 * x0, 8, lit(CREAM, 0.35))
        c.hline(x0, y, 36 - 2 * x0, WHITE)
        c.hline(x0, y + 1, 36 - 2 * x0, METAL_L)
        c.vline(x0 + 35 - 2 * x0, y, 8, SAND)
    c.rect(1, 32, 34, 1, TAN)
    pairs = SEASON_SHOES.get(kind, ((METAL_L, "low"), (TAN, "low")))
    k = 0
    for i in range(3):
        y = 9 + i * 8
        x0 = 8 - i * 2
        for j in range(2):
            tone, form = pairs[k % len(pairs)]
            pair(c, x0 + j * 11 + (i % 2) * 2, y, tone, form)
            k += 1
    c.outline(INK)
    shadowed(c, 18, 32, 17, 2).save(f"fl2b_shoes_{kind}" if kind else "fl2b_shoes")


# ---------------------------------------------------------------- примерочные, зеркало, касса


def booth(shut=False):
    """Примерочная: кабинка светлого дерева с карнизом и номерком, бра над входом; внутри — зеркальце, крючок
    с вещью и табурет; бархатная штора на кольцах — сдвинута или задёрнута (тогда из-под неё видны ноги)."""
    c = Canvas(44, 76)
    # Корпус и крыша-карниз (видна верхняя грань — объём, как у полок зала).
    c.rect(1, 6, 42, 68, lit(CREAM, 0.35))
    c.rect(0, 0, 44, 6, WHITE)
    c.hline(0, 5, 44, SAND)
    c.rect(2, 1, 40, 3, lit(CREAM, 0.2))
    c.vline(1, 6, 68, WHITE)
    c.vline(42, 6, 68, SAND)
    # Проём.
    c.rect(5, 12, 34, 60, mix(PEACH, CREAM, 0.4))
    c.vline(5, 12, 60, TAN)
    c.hline(5, 12, 34, TAN)
    # Внутри: зеркальце в раме, крючок с вещью, табурет, коврик.
    c.rect(26, 20, 9, 18, METAL_L)
    c.frame(25, 19, 11, 20, GOLD)
    for i in range(4):
        c.px(28 + i, 25 - i, WHITE)
    c.px(10, 18, METAL)
    c.px(11, 19, METAL)
    c.rect(8, 20, 7, 12, PINK)
    c.vline(8, 20, 12, PINK_D)
    c.hline(8, 31, 7, PINK_D)
    c.rect(12, 52, 14, 3, WOOD)
    c.hline(12, 52, 14, SAND)
    c.vline(13, 55, 9, WOOD_D)
    c.vline(24, 55, 9, WOOD_D)
    c.rect(8, 66, 28, 4, PLUM)
    c.hline(8, 66, 28, PINK_D)
    # Бра и номерок над входом.
    c.rect(19, 7, 6, 3, GOLD)
    c.hline(19, 7, 6, GOLD_L)
    c.px(21, 10, GOLD_L)
    c.px(22, 10, GOLD_L)
    # Карниз шторы.
    c.hline(4, 11, 36, GOLD)
    for x in range(5, 40, 4):
        c.px(x, 12, GOLD_L)
    if shut:
        for x in range(5, 39):
            fold = (x - 5) % 5
            tone = PINK_D if fold < 3 else lit(PINK_D, 0.2) if fold == 3 else PLUM
            c.vline(x, 13, 57, tone)
        c.hline(5, 69, 34, PLUM)
        # Ноги из-под шторы.
        c.rect(16, 70, 3, 2, NAVY)
        c.rect(24, 70, 3, 2, NAVY)
        c.hline(15, 71, 4, INK)
        c.hline(24, 71, 4, INK)
    else:
        for x in range(5, 14):
            fold = (x - 5) % 4
            c.vline(x, 13, 58, PINK_D if fold < 2 else PLUM if fold == 3 else lit(PINK_D, 0.2))
        c.rect(5, 40, 9, 2, GOLD)
        c.hline(5, 40, 9, GOLD_L)
    c.outline(INK)
    shadowed(c, 22, 74, 21, 2).save("fl2b_booth_shut" if shut else "fl2b_booth")


def mirror():
    """Большое напольное зеркало: высокая арка в золочёной раме с завитками, в стекле — светлый отблеск зала,
    блики наискось, ножки-лапки."""
    c = Canvas(32, 64)
    cx = 16
    # Рама: арка сверху, прямые бока.
    for y in range(2, 58):
        if y < 14:
            half = int(13 * math.sqrt(max(0, 1 - ((14 - y) / 12) ** 2)))
        else:
            half = 13
        c.hline(cx - half, y, half * 2, GOLD)
        if half > 2:
            inner = half - 2
            # Стекло: сверху голубоватое, к низу — тёплый отблеск паркета.
            t = (y - 2) / 56
            tone = mix(METAL_L, WHITE, 0.4) if t < 0.5 else mix(METAL_L, CREAM, (t - 0.5) * 1.6)
            c.hline(cx - inner, y, inner * 2, tone)
    for y in range(2, 58):
        for x in range(32):
            if c.get(x, y) == GOLD and (c.get(x - 1, y)[3] == 0):
                c.px(x, y, GOLD_L)
    # Отражение зала в стекле: полоска стены и окно.
    c.rect(cx - 9, 22, 18, 2, mix(PEACH, WHITE, 0.4))
    c.rect(cx - 7, 14, 5, 7, mix(CYAN, WHITE, 0.5))
    for i in range(14):
        c.px(cx - 6 + i // 2, 40 - i, WHITE)
        c.px(cx - 5 + i // 2, 40 - i, WHITE)
    for i in range(6):
        c.px(cx + 4 + i // 2, 30 - i, WHITE)
    # Завиток-корона наверху и ножки.
    c.rect(cx - 2, 0, 4, 3, GOLD)
    c.px(cx, 0, GOLD_L)
    c.rect(cx - 12, 57, 24, 2, GOLD)
    c.hline(cx - 12, 57, 24, GOLD_L)
    for x in (cx - 11, cx + 9):
        c.rect(x, 59, 2, 3, WOOD_D)
    c.outline(INK)
    shadowed(c, cx, 61, 13, 2).save("fl2b_mirror")


def pouf():
    """Бархатный пуф: круглый, с пуговицей посередине и стёжкой."""
    c = Canvas(24, 16)
    c.ellipse(12, 10, 10, 5, PLUM)
    c.ellipse(12, 7, 10, 4.5, PINK_D)
    c.ellipse(12, 6, 8, 3, lit(PINK_D, 0.2))
    c.px(12, 7, GOLD_L)
    c.px(8, 6, PLUM)
    c.px(16, 6, PLUM)
    c.hline(4, 12, 16, a(PLUM, 255))
    c.outline(INK)
    shadowed(c, 12, 14, 10, 2).save("fl2b_pouf")


def till():
    """Касса бутика: стойка светлого дерева со стеклянной витриной (в ней — ремни, кошельки, бижутерия), на
    стойке — аппарат с экраном, стопка розовых пакетов, папиросная бумага и ваза с цветами."""
    c = Canvas(76, 44)
    # Столешница с верхней гранью.
    c.rect(1, 14, 74, 5, lit(CREAM, 0.35))
    c.hline(1, 14, 74, WHITE)
    c.hline(1, 18, 74, SAND)
    # Корпус: слева — витрина, справа — дерево с филёнками.
    c.rect(2, 19, 72, 22, WOOD)
    c.hline(2, 19, 72, SAND)
    c.rect(4, 21, 36, 18, mix(METAL_L, WHITE, 0.3))
    c.frame(3, 20, 38, 20, GOLD)
    c.hline(5, 30, 34, METAL_L)
    # Витрина: ремни, кошелёк, бусы, часики.
    c.rect(6, 25, 8, 2, WOOD_D)
    c.px(13, 25, GOLD)
    c.rect(17, 24, 6, 4, RED_D)
    c.px(21, 25, GOLD_L)
    for i in range(7):
        c.px(26 + i, 25 + (1 if 1 < i < 5 else 0), WHITE if i % 2 else PINK)
    c.rect(6, 34, 5, 3, NAVY)
    c.px(8, 35, GOLD_L)
    c.rect(14, 34, 7, 3, PINK_D)
    c.rect(25, 33, 6, 4, TAN)
    c.px(34, 35, GOLD)
    c.px(35, 34, GOLD)
    for i in range(3):
        c.px(8 + i * 10, 22, a(WHITE, 200))
    for x0 in (44, 59):
        c.frame(x0, 22, 13, 16, lit(WOOD, -0.2))
        c.hline(x0, 22, 13, SAND)
    c.rect(1, 41, 74, 2, WOOD_D)
    # На стойке: аппарат.
    c.rect(48, 4, 18, 10, NAVY_L)
    c.rect(48, 4, 18, 2, SLATE)
    c.rect(50, 6, 9, 4, CYAN)
    c.hline(50, 6, 9, lit(CYAN, 0.4))
    c.rect(60, 7, 5, 6, METAL)
    for yy in (8, 10):
        c.hline(61, yy, 3, WHITE)
    c.rect(66, 2, 3, 4, NAVY)
    c.rect(46, 12, 22, 2, METAL)
    # Пакеты стопкой и папиросная бумага.
    for i, tone in enumerate((PINK, PINK_D, PINK)):
        c.rect(6 + i * 2, 7 - i, 11, 7, tone)
        c.hline(6 + i * 2, 7 - i, 11, lit(tone, 0.25))
        c.hline(9 + i * 2, 5 - i, 5, PLUM)
    c.rect(22, 10, 9, 4, WHITE)
    c.px(24, 11, PINK)
    c.px(28, 12, PINK)
    # Ваза с цветами.
    c.rect(35, 7, 5, 7, METAL_L)
    c.vline(35, 7, 7, WHITE)
    for fx, fy, tone in ((34, 3, PINK), (37, 1, GOLD_L), (40, 3, RED), (36, 5, WHITE)):
        c.rect(fx, fy, 2, 2, tone)
    for fx in (35, 37, 39):
        c.px(fx, 6, GREEN)
    c.outline(INK)
    shadowed(c, 38, 42, 36, 2).save("fl2b_till")


def bin_():
    """Стол уценки: столешница на ножках, плетёные корзины и ворох сложенных вещей разных цветов."""
    c = Canvas(48, 34)
    c.rect(2, 18, 44, 4, lit(CREAM, 0.35))
    c.hline(2, 18, 44, WHITE)
    c.rect(2, 22, 44, 3, WOOD)
    c.hline(2, 22, 44, SAND)
    for x in (4, 42):
        c.rect(x, 25, 2, 8, WOOD_D)
    # Корзины.
    for x0 in (4, 30):
        c.rect(x0, 10, 14, 9, SAND)
        for x in range(x0, x0 + 14, 2):
            c.vline(x, 10, 9, TAN)
        c.hline(x0, 10, 14, lit(SAND, 0.3))
        c.hline(x0, 14, 14, TAN)
    pile = ((5, 8, BLUE), (10, 6, GOLD), (31, 8, GREEN_L), (36, 6, PINK), (18, 14, RED), (20, 10, SAND), (24, 13, NAVY_L), (21, 6, CYAN), (14, 16, CREAM))
    for x, y, tone in pile:
        c.rect(x, y, 9, 4, tone)
        c.hline(x, y, 9, lit(tone, 0.3))
        c.hline(x, y + 3, 9, lit(tone, -0.3))
    c.outline(INK)
    shadowed(c, 24, 32, 22, 2).save("fl2b_bin")


# ---------------------------------------------------------------- растения, ковёр, лестница


def plant():
    """Монстера в белом горшке: резные листья в два зелёных, прожилки."""
    c = Canvas(26, 48)
    c.rect(7, 34, 12, 12, WHITE)
    c.vline(7, 34, 12, METAL_L)
    c.vline(18, 34, 12, METAL_L)
    c.hline(6, 34, 14, METAL_L)
    c.rect(8, 33, 10, 1, WOOD_D)
    for (cx, cy, rx, ry, tone) in ((7, 22, 6, 5, GREEN), (19, 20, 6, 5, GREEN), (13, 12, 7, 6, GREEN_L), (8, 9, 5, 4, GREEN), (19, 9, 5, 4.5, GREEN_L), (13, 27, 6, 4, GREEN)):
        c.ellipse(cx, cy, rx, ry, tone)
        c.line(int(cx - rx + 2), int(cy), int(cx + rx - 2), int(cy), lit(tone, -0.3))
        # Прорези монстеры.
        c.px(int(cx - 2), int(cy - 2), a(tone, 0))
        c.px(int(cx + 2), int(cy + 2), a(tone, 0))
    for x0, y0 in ((13, 33), (12, 30), (14, 28)):
        c.px(x0, y0, GREEN_D)
    c.outline(INK)
    shadowed(c, 13, 46, 8, 2).save("fl2b_plant")


def ficus():
    """Фикус в плетёном горшке: тонкий ствол и густая круглая крона."""
    c = Canvas(22, 40)
    c.rect(5, 28, 12, 10, SAND)
    for x in range(5, 17, 2):
        c.vline(x, 28, 10, TAN)
    c.hline(5, 28, 12, lit(SAND, 0.3))
    c.vline(11, 14, 14, WOOD_D)
    c.px(10, 20, WOOD_D)
    for (cx, cy, r, tone) in ((11, 11, 8, GREEN_D), (8, 9, 5, GREEN), (14, 8, 5, GREEN), (11, 5, 4, GREEN_L), (7, 14, 3.5, GREEN), (15, 14, 3.5, GREEN_L)):
        c.ellipse(cx, cy, r, r * 0.9, tone)
    for x, y in ((6, 7), (13, 4), (16, 11), (9, 13), (12, 9)):
        c.px(x, y, lit(GREEN_L, 0.3))
    c.outline(INK)
    shadowed(c, 11, 38, 7, 2).save("fl2b_ficus")


def rug():
    """Овальный ковёр: бордовое поле, кремовая кайма, узор-медальон — под круглым столом посреди зала."""
    c = Canvas(104, 52)
    cx, cy = 51.5, 25.5
    for y in range(52):
        for x in range(104):
            d = ((x + 0.5 - 52) / 52) ** 2 + ((y + 0.5 - 26) / 26) ** 2
            if d < 1:
                if d > 0.86:
                    tone = PLUM
                elif d > 0.74:
                    tone = CREAM if (x + y) % 6 else PEACH
                elif d > 0.68:
                    tone = PLUM
                else:
                    tone = PINK_D if ((x // 3 + y // 3) % 7) else lit(PINK_D, -0.15)
                c.px(x, y, tone)
    # Медальон.
    c.ellipse(cx + 0.5, cy + 0.5, 14, 7, CREAM)
    c.ellipse(cx + 0.5, cy + 0.5, 12, 5.5, PLUM)
    c.ellipse(cx + 0.5, cy + 0.5, 6, 3, GOLD)
    c.ellipse(cx + 0.5, cy + 0.5, 3, 1.5, CREAM)
    c.save("fl2b_rug")


def stairs():
    """Проём лестницы снизу: латунные перила с балясинами по трём сторонам, ступени уходят вниз и темнеют,
    по середине — бордовая ковровая дорожка с латунными прутками."""
    c = Canvas(60, 64)
    c.rect(4, 6, 52, 56, INK)
    for i in range(7):
        y = 8 + i * 8
        tone = lit(SAND, -0.08 - i * 0.12)
        c.rect(6, y, 48, 7, tone)
        c.hline(6, y, 48, lit(tone, 0.25))
        c.hline(6, y + 6, 48, lit(tone, -0.35))
        run = lit(PINK_D, -0.05 - i * 0.12)
        c.rect(20, y, 20, 7, run)
        c.hline(20, y, 20, lit(run, 0.2))
        c.hline(20, y + 6, 20, GOLD if i < 3 else lit(GOLD, -0.3 - i * 0.08))
        c.vline(20, y, 7, lit(run, -0.25))
        c.vline(39, y, 7, lit(run, -0.25))
    # Перила.
    c.rect(1, 2, 58, 3, GOLD)
    c.hline(1, 2, 58, GOLD_L)
    for x in (1, 56):
        c.rect(x, 2, 3, 60, GOLD)
        c.vline(x, 2, 60, GOLD_L)
    for x in range(8, 54, 6):
        c.vline(x, 0, 3, lit(GOLD, -0.3))
    for y in range(10, 60, 8):
        c.px(0, y, lit(GOLD, -0.3))
        c.px(59, y, lit(GOLD, -0.3))
    c.outline(INK)
    c.save("fl2b_stairs")


# ---------------------------------------------------------------- улучшения


def podium():
    """Подиум под манекен: белый круглый с золотым кантом."""
    c = Canvas(30, 14)
    c.ellipse(15, 9, 13, 4, METAL_L)
    c.rect(2, 6, 26, 3, WHITE)
    c.ellipse(15, 6, 13, 4, WHITE)
    c.ellipse(15, 6, 11, 3, lit(CREAM, 0.5))
    c.hline(3, 9, 24, GOLD)
    c.outline(INK)
    c.save("fl2b_podium")


def track():
    """Рейка со спотами под потолком: чёрная шина и четыре поворотных фонаря, смотрящих вниз."""
    c = Canvas(64, 10)
    c.rect(0, 0, 64, 2, NAVY)
    c.hline(0, 0, 64, NAVY_L)
    for x in (6, 22, 38, 54):
        c.vline(x + 1, 2, 2, NAVY)
        c.rect(x - 1, 4, 5, 4, NAVY_L)
        c.hline(x - 1, 4, 5, SLATE)
        c.rect(x, 8, 3, 1, GOLD_L)
    c.outline(INK)
    c.save("fl2b_track")


def neon():
    """Неоновая вешалка на стене: розовая трубка крючком и плечиками, вокруг — мягкий ореол; держатели на стене."""
    c = Canvas(40, 30)
    glow = [(x, y) for y in range(30) for x in range(40)]
    path = []
    # Крючок.
    for t in range(0, 200):
        ang = math.pi * 1.1 * t / 200 - math.pi * 0.1
        path.append((20 + 3.5 * math.cos(ang + math.pi), 7 + 3.5 * math.sin(ang + math.pi)))
    for i in range(30):
        path.append((20 + 0 * i, 7 + i * 0.2))
    # Плечики: две наклонные и перекладина.
    for i in range(60):
        t = i / 59
        path.append((20 - 15 * t, 13 + 9 * t))
        path.append((20 + 15 * t, 13 + 9 * t))
        path.append((5 + 30 * t, 22))
    tube = {(int(round(x)), int(round(y))) for x, y in path}
    for x, y in glow:
        d = min(abs(x - tx) + abs(y - ty) for tx, ty in tube) if tube else 9
        if 0 < d <= 3:
            c.px(x, y, a(PINK, int(90 / d)))
    for x, y in tube:
        c.px(x, y, HOT)
    for x, y in tube:
        if (x + y) % 3 == 0:
            c.px(x, y, lit(PINK, 0.5))
    for x in (6, 34):
        c.px(x, 24, METAL)
        c.px(x, 25, METAL)
    c.save("fl2b_neon")


def brand():
    """Стеклянная витрина марок: чёрный корпус с золотым кантом, на полках — сумки (кожаная, лаковая, клатч),
    наверху — золотая табличка с вензелем."""
    c = Canvas(48, 60)
    c.rect(2, 8, 44, 50, NAVY)
    c.rect(1, 6, 46, 3, GOLD)
    c.hline(1, 6, 46, GOLD_L)
    c.rect(1, 56, 46, 3, GOLD)
    # Стекло и подсветка изнутри.
    c.rect(5, 11, 38, 44, mix(NAVY_L, CYAN, 0.12))
    c.hline(5, 11, 38, a(GOLD_L, 200))
    for y in (25, 40):
        c.rect(5, y, 38, 2, mix(METAL_L, WHITE, 0.3))
    # Сумки.
    def bag(x, y, w, h, tone, handle=True):
        c.rect(x, y - h, w, h, tone)
        c.hline(x, y - h, w, lit(tone, 0.3))
        c.vline(x + w - 1, y - h, h, lit(tone, -0.3))
        c.px(x + w // 2, y - h + 2, GOLD_L)
        if handle:
            for i in range(w - 2):
                c.px(x + 1 + i, y - h - 2 - (1 if 0 < i < w - 3 else 0), lit(tone, -0.2))
    bag(8, 25, 10, 7, RED_D)
    bag(22, 25, 8, 6, CREAM)
    bag(33, 25, 8, 8, WOOD)
    bag(9, 40, 12, 5, NAVY_L, handle=False)
    bag(25, 40, 9, 8, PINK_D)
    bag(9, 55, 10, 7, DARK)
    bag(24, 55, 14, 6, TAN)
    for i in range(6):
        c.px(8 + i * 2, 50 - i * 6, a(WHITE, 140))
    # Табличка с вензелем.
    c.rect(14, 0, 20, 6, NAVY)
    c.frame(14, 0, 20, 6, GOLD)
    c.stamp(["Y.Y", ".Y.", "Y.Y"], 22, 1)
    c.outline(INK)
    shadowed(c, 24, 58, 22, 2).save("fl2b_brand")


def logo():
    """Табличка марки на стене: чёрная, в золотой раме, с вензелем из двух букв-завитков."""
    c = Canvas(28, 18)
    c.rect(1, 1, 26, 16, NAVY)
    c.frame(1, 1, 26, 16, GOLD)
    c.hline(2, 1, 24, GOLD_L)
    c.stamp(["YY...YY", ".YY.YY.", "..YYY..", ".YY.YY.", "YY...YY"], 6, 5)
    c.stamp(["..Y..", ".Y.Y.", "Y...Y", ".Y.Y.", "..Y.."], 16, 5)
    c.hline(5, 12, 18, a(GOLD, 180))
    c.outline(INK)
    c.save("fl2b_logo")


def bag_lux():
    """Пакет марки: чёрный, с золотой каймой и шнуровыми ручками."""
    c = Canvas(10, 12)
    c.rect(1, 4, 8, 8, NAVY)
    c.vline(8, 4, 8, INK)
    c.hline(1, 4, 8, GOLD)
    c.px(4, 7, GOLD_L)
    c.px(5, 8, GOLD_L)
    c.hline(3, 0, 4, GOLD)
    c.vline(2, 1, 3, GOLD)
    c.vline(7, 1, 3, GOLD)
    c.outline(INK)
    c.save("fl2b_bag_lux")


def mannequin_body(c):
    """Манекен без лица: гладкая голова-овал, шея, белые руки и ноги, подставка-диск со стержнем."""
    skin, skin_d = lit(METAL_L, 0.45), METAL_L
    c.ellipse(12, 7, 3.5, 4.2, skin)
    c.vline(14, 5, 4, skin_d)
    c.px(10, 5, WHITE)
    c.rect(11, 11, 3, 2, skin_d)
    # Руки вдоль тела и ноги (их закроет одежда, сколько закроет).
    for x in (5, 18):
        c.rect(x, 14, 2, 12, skin)
        c.vline(x + 1, 14, 12, skin_d)
    c.rect(9, 27, 2, 9, skin)
    c.rect(13, 27, 2, 9, skin)
    c.vline(10, 27, 9, skin_d)
    c.vline(14, 27, 9, skin_d)
    # Подставка.
    c.vline(12, 35, 3, METAL)
    c.ellipse(12, 38.5, 6, 1.6, SLATE)
    c.hline(8, 38, 9, METAL)


def manq(coll, k):
    """Манекен в вещах сезона: тёплое — пуховик и вязаная шапка или пальто и меховая шапка; дождь — плащ и берет
    или жёлтый дождевик с капюшоном; лето — сарафан и соломенная шляпа или футболка, шорты и кепка."""
    c = Canvas(24, 40)
    mannequin_body(c)
    if coll == "warm":
        tone = (RED_D, NAVY_L)[k]
        long_ = 32 if k else 28
        c.rect(6, 12, 12, long_ - 12, tone)
        c.rect(4, 13, 3, 13, tone)
        c.rect(17, 13, 3, 13, tone)
        if k == 0:
            for y in range(16, long_, 4):
                c.hline(4, y, 16, lit(tone, -0.3))
            c.rect(8, 11, 8, 3, CREAM)
        else:
            c.vline(12, 14, long_ - 14, lit(tone, -0.35))
            for y in (17, 21, 25):
                c.px(11, y, GOLD)
                c.px(13, y, GOLD)
        c.vline(6, 12, long_ - 12, lit(tone, -0.4))
        c.rect(8, 11, 8, 2, (GOLD_L, RED)[k])
        c.rect(14, 13, 2, 6, (GOLD_L, RED)[k])
        if k == 0:
            c.rect(8, 1, 8, 4, RED)
            c.rect(11, 0, 2, 2, WHITE)
            c.hline(8, 4, 8, WHITE)
            for x in range(8, 16, 2):
                c.vline(x, 1, 3, lit(RED, -0.2))
        else:
            c.rect(7, 1, 10, 4, BROWN)
            c.hline(7, 4, 10, lit(BROWN, 0.25))
            c.rect(6, 4, 2, 4, BROWN)
            c.rect(16, 4, 2, 4, BROWN)
    elif coll == "rain":
        tone = (SAND, GOLD)[k]
        c.rect(6, 12, 12, 21, tone)
        c.rect(4, 13, 3, 13, tone)
        c.rect(17, 13, 3, 13, tone)
        c.vline(6, 12, 21, lit(tone, -0.4))
        if k == 0:
            c.hline(6, 20, 12, WOOD_D)
            c.px(13, 21, WOOD_D)
            c.px(13, 22, WOOD_D)
            for y in (15, 18, 25):
                c.px(10, y, WOOD_D)
                c.px(14, y, WOOD_D)
            c.rect(9, 11, 6, 2, lit(tone, 0.3))
            c.ellipse(12, 3.5, 5, 2, DEEP)
            c.px(12, 1, DEEP)
            # Зонт-трость на руке.
            c.vline(21, 19, 14, RED)
            c.vline(22, 21, 10, lit(RED, -0.3))
            c.px(20, 18, WOOD_D)
            c.px(21, 17, WOOD_D)
        else:
            c.ellipse(12, 6, 5, 5.5, tone)
            c.ellipse(12, 7.5, 3, 3.5, lit(METAL_L, 0.45))
            c.vline(16, 13, 18, lit(tone, 0.5))
            c.vline(12, 13, 20, lit(tone, -0.25))
            for y in (16, 21, 26):
                c.px(11, y, WHITE)
    else:
        if k == 0:
            tone = PINK
            c.rect(8, 12, 8, 8, tone)
            c.px(9, 11, tone)
            c.px(14, 11, tone)
            for i in range(12):
                w = 8 + i // 2
                c.hline(12 - w // 2, 20 + i, w, tone)
            for dx, dy in ((-2, 14), (2, 16), (-3, 22), (1, 24), (3, 28), (-1, 29)):
                c.px(12 + dx, dy, WHITE)
            c.vline(8, 12, 8, lit(tone, -0.3))
            c.ellipse(12, 3.5, 8, 1.6, GOLD_L)
            c.ellipse(12, 2.5, 4, 2, SAND)
            c.hline(8, 3, 8, RED)
        else:
            c.rect(6, 12, 12, 10, CYAN)
            c.rect(4, 12, 3, 4, CYAN)
            c.rect(17, 12, 3, 4, CYAN)
            c.vline(6, 12, 10, lit(CYAN, -0.35))
            c.rect(10, 15, 4, 3, GOLD_L)
            c.rect(7, 22, 10, 6, SAND)
            c.vline(12, 24, 4, lit(SAND, -0.35))
            c.vline(7, 22, 6, lit(SAND, -0.3))
            c.rect(8, 1, 8, 3, RED)
            c.hline(12, 4, 6, RED)
            c.hline(8, 1, 8, lit(RED, 0.3))
    c.outline(INK)
    shadowed(c, 12, 38, 6, 1.5).save(f"fl2b_manq_{coll}{k}")


def form(coll):
    """Портновский манекен-бюст на треноге в вещи сезона: стоит посреди зала, пока нет витрины марок."""
    c = Canvas(20, 40)
    c.vline(10, 24, 12, WOOD_D)
    c.line(10, 34, 5, 38, WOOD_D)
    c.line(10, 34, 15, 38, WOOD_D)
    c.rect(9, 0, 3, 3, WOOD)
    c.px(10, 0, SAND)
    tone = {"warm": GREEN, "rain": GOLD, "summer": PINK}.get(coll, CREAM)
    c.rect(4, 4, 13, 4, tone)
    c.rect(5, 8, 11, 6, tone)
    c.rect(6, 14, 9, 4, tone)
    for i in range(7):
        c.hline(5 - i // 3, 18 + i, 11 + 2 * (i // 3), tone)
    c.vline(4, 4, 4, lit(tone, -0.3))
    c.vline(5, 8, 10, lit(tone, -0.3))
    c.hline(6, 14, 9, lit(tone, -0.3))
    c.vline(13, 5, 12, lit(tone, 0.3))
    if coll == "warm":
        for y in range(6, 24, 3):
            c.hline(6, y, 9, lit(tone, 0.15))
    elif coll == "summer":
        for dx, dy in ((7, 6), (12, 9), (8, 15), (11, 20), (6, 22), (14, 23)):
            c.px(dx, dy, WHITE)
    elif coll == "rain":
        c.hline(5, 14, 11, WOOD_D)
    c.outline(INK)
    shadowed(c, 10, 38, 6, 1.5).save(f"fl2b_form_{coll}" if coll else "fl2b_form")


def poster(kind):
    """Модная картинка в тонкой золотой раме: силуэт в пальто (тёплая) или в платье с шляпой (светлая) — висит над
    примерочными, пока там нет неона и табличек марок."""
    c = Canvas(20, 26)
    c.rect(1, 1, 18, 24, GOLD)
    c.hline(1, 1, 18, GOLD_L)
    bg = PEACH if kind == 0 else lit(CYAN, 0.55)
    c.rect(3, 3, 14, 20, bg)
    c.rect(3, 19, 14, 4, lit(bg, -0.12))
    if kind == 0:
        c.rect(8, 6, 4, 4, CREAM)
        c.rect(7, 4, 6, 2, NAVY)
        c.rect(7, 10, 6, 10, RED_D)
        c.vline(10, 10, 10, lit(RED_D, -0.3))
        c.rect(8, 20, 1, 2, NAVY)
        c.rect(11, 20, 1, 2, NAVY)
    else:
        c.ellipse(10, 6, 5, 1.5, GOLD_L)
        c.rect(9, 5, 3, 2, SAND)
        c.rect(9, 7, 3, 3, CREAM)
        c.rect(8, 10, 5, 4, PINK_D)
        for i in range(6):
            c.hline(10 - (2 + i // 2), 14 + i, 5 + (i // 2) * 2, PINK_D)
        c.px(10, 20, CREAM)
    c.outline(INK)
    c.save(f"fl2b_poster{kind}")


def sun():
    """Солнце из окна на полу: светлая трапеция, скошенная вправо-вниз, с мягкими краями и тенью переплёта
    посередине (белая — цвет и силу задаёт игра, кладётся сложением, как свет зала)."""
    c = Canvas(64, 56)
    for y in range(56):
        t = y / 55
        x0 = 6 + t * 18
        x1 = 46 + t * 18
        for x in range(64):
            edge = min(x - x0, x1 - x)
            if edge <= 0:
                continue
            soft = min(1, edge / 5) * (1 - t) ** 1.3
            # Тень переплёта — посередине и поперёк у фрамуги.
            mid = (x0 + x1) / 2
            if abs(x - mid) < 1 or abs(y - 12) < 1:
                soft *= 0.35
            alpha = int(150 * soft)
            if alpha > 4:
                c.px(x, y, (255, 255, 255, alpha))
    c.save("fl2b_sun")


if __name__ == "__main__":
    for coll in ("warm", "rain", "summer"):
        manq(coll, 0)
        manq(coll, 1)
        form(coll)
    form(None)
    poster(0)
    poster(1)
    sun()
    wall()
    floor()
    wear()
    for kind in (None, "warm", "rain"):
        window(kind)
    for kind in (None, "warm", "rain", "summer"):
        rack(kind)
        shelf(kind)
        table(kind)
        shoes(kind)
    booth()
    booth(shut=True)
    mirror()
    pouf()
    till()
    bin_()
    plant()
    ficus()
    rug()
    stairs()
    podium()
    track()
    neon()
    brand()
    logo()
    bag_lux()
