"""Второй этаж, 22.11: зал стал выше (290 вместо 230) — верх стены и новый низ бутика.

Автор, 22.11: «Надо улучшать дизайн этажей, сделать их красивее». Зал вытянули во весь экран телефона, и у бутика
(art/clothes_art.py, src/scenes/floors/secondFloor.ts) сверху осталась плоская полоса стены, а снизу — четверть зала
пустого паркета и лестница, висящая дырой посреди пола. Здесь — то, чем эти места заполнены:

  - верх стены над залом: обои продолжаются вверх, над окнами — полукруглые фрамуги с витражом, над примерочными —
    вывеска бутика (сливовая доска в золотой раме, золотая вешалка — без букв, читается на любом языке) с двумя
    латунными подсветками, гирлянда из зелени и роз между окнами, лепной карниз и тёплый потолок с точками ламп;
  - лестница вниз — у самого нижнего края зала, проём уходит за край в темноту (продолжение — шахта floorView),
    с латунными перилами и столбиками у входа, ковровая дорожка; полукруглый коврик на площадке;
  - внизу у лестницы — подиум «новая коллекция»: два манекена в новых нарядах сезона и ваза с пампасом;
  - уголок ожидания: бархатный изумрудный диван с подушками, торшер, ковёр с бахромой;
  - вешалка-стойка для шляп у входа, мраморный столик с большим букетом;
  - пустая стойка — с деревянными плечиками и разделителями размеров, а не голая рама (clothes_art.rack);
  - до ремонта (отделка 0) на месте третьего ряда стоек — «скоро»: стойка в плёнке, стремянка, коробки, краска.

Палитра Endesga 32 (art/sprites.py), двойная детализация (в мире вдвое меньше), контур #181425 у предметов, свет
сверху слева. Ковры и стена — без контура, как пол и обои зала.

    python3 art/clothes_decor.py

Картинки (ширина×высота в пикселях рисунка):
  fl2d_upper       336×128 — верх задней стены над залом (низ картинки — верх зала);
  fl2d_stairs      60×140  — проём лестницы вниз у нижнего края зала, ступени уходят в темноту;
  fl2d_mat         48×18   — полукруглый коврик на площадке лестницы;
  fl2d_stage       88×36   — двухъярусный подиум «новая коллекция»;
  fl2d_pampas      18×44   — высокая ваза с пампасной травой (на подиуме между манекенами);
  fl2d_manq_*0/1   24×40   — манекены подиума в новых нарядах сезона (warm / rain / summer);
  fl2d_sofa        72×42   — бархатный диван уголка ожидания;
  fl2d_lamp        18×62   — торшер;
  fl2d_rug         104×40  — ковёр с бахромой под диваном;
  fl2d_hatstand    28×70   — вешалка-стойка: шляпы, шарф, сумка;
  fl2d_flowers     40×54   — мраморный столик на ножке с большим букетом;
  fl2d_wrap        48×52   — новая стойка в плёнке (до ремонта);
  fl2d_reno        52×52   — стремянка, коробки и банка краски (до ремонта).
"""

import math

from premium import lit, mix
from sprites import Canvas, shadowed
import clothes_art as ca
from clothes_art import (
    BROWN, CREAM, CYAN, DARK, DEEP, GOLD, GOLD_L, GREEN, GREEN_D, GREEN_L, INK, METAL, METAL_L, NAVY, NAVY_L, ORANGE,
    PEACH, PINK, PINK_D, PLUM, RED, RED_D, SAND, SLATE, TAN, WHITE, WOOD, WOOD_D, a,
)


# ---------------------------------------------------------------- верх стены


def _paper(x, y):
    """Обои — как плитка fl2b_wall (полоса 32): кремовый фон, персиковые полосы с розовой нитью и ромбиками."""
    m = x % 32
    x0 = 0 if m < 16 else 16
    d = m - x0
    if 5 <= d <= 10:
        if d == 5:
            return lit(PEACH, -0.08)
        if d == 8:
            return lit(PINK, 0.5)
        return PEACH
    # Ромбик: как в плитке, шаг 12 по высоте (здесь — от низа картинки, чтобы совпало с узором зала не важно).
    yy = (y + (x0 // 16) * 6) % 12
    if (d, yy) in ((13, 1), (14, 2), (12, 2), (13, 3)):
        return lit(PINK, 0.5)
    return CREAM


def upper():
    """Верх задней стены: обои вверх, фрамуги-витражи над окнами, вывеска с золотой вешалкой и подсветкой,
    гирлянда из зелени и роз, лепной карниз с сухариками, тёплый потолок с точками ламп. Боковины (по 10 пикселей)
    прозрачные — там тёмные боковые стены сцены."""
    W_, H_ = 336, 128
    c = Canvas(W_, H_)
    L, R = 10, 326
    # Потолок: тёплый, к карнизу светлее (его подсвечивает зал).
    for y in range(0, 86):
        t = y / 85
        c.hline(L, y, R - L, mix(mix(WOOD_D, TAN, 0.35), mix(TAN, PEACH, 0.3), t))
    # Точки ламп в потолке.
    for x in range(L + 30, R, 64):
        c.ellipse(x, 72, 4, 1.6, lit(TAN, -0.25))
        c.ellipse(x, 72, 3, 1.1, GOLD_L)
        c.px(x - 1, 72, WHITE)
    # Карниз: верхняя полочка, выкружка, сухарики, нижняя полочка.
    c.hline(L, 84, R - L, METAL_L)
    c.rect(L, 85, R - L, 2, WHITE)
    for y, tone in ((87, lit(CREAM, 0.5)), (88, lit(CREAM, 0.3)), (89, CREAM), (90, SAND)):
        c.hline(L, y, R - L, tone)
    c.rect(L, 91, R - L, 5, CREAM)
    for x in range(L, R, 6):
        c.rect(x + 1, 91, 4, 4, WHITE)
        c.hline(x + 1, 95, 4, SAND)
        c.vline(x + 4, 92, 3, lit(CREAM, -0.08))
    c.rect(L, 96, R - L, 2, WHITE)
    c.hline(L, 98, R - L, CREAM)
    c.hline(L, 99, R - L, TAN)
    # Обои вниз до верха зала; под карнизом — тень.
    for y in range(100, H_):
        for x in range(L, R):
            tone = _paper(x, y)
            if y < 103:
                tone = lit(tone, -0.12 + (y - 100) * 0.04)
            c.px(x, y, tone)
    # Фрамуги над окнами (окна зала — по x 21 и 81 точек мира: середина рисунка 42 и 162).
    for cx in (42, 162):
        fanlight(c, cx, H_ - 1)
    # Гирлянда из зелени и роз между окнами и над стеллажом.
    swag(c, 66, 138, 104, 9)
    swag(c, 186, 206, 104, 4)
    swag(c, 312, 324, 104, 3)
    for x in (66, 138):
        rose(c, x, 104)
    rose(c, 102, 113, big=True)
    # Вывеска над примерочными.
    sign(c, 208, 102, 104, 22)
    return c


def fanlight(c, cx, base):
    """Полукруглая фрамуга: белая рама, лучи переплёта, витраж розово-золотой, золотая ступица, замковый камень."""
    R_ = 21
    for y in range(base - R_ - 1, base + 1):
        for x in range(cx - R_ - 1, cx + R_ + 1):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - base)
            if d > R_ + 0.3:
                continue
            if d > R_ - 2:
                tone = WHITE if x < cx else lit(METAL_L, 0.3)
            elif d > R_ - 3:
                tone = METAL_L
            elif d < 5:
                tone = GOLD if d > 3.2 else GOLD_L
            else:
                ang = math.atan2(base - (y + 0.5), x + 0.5 - cx)
                k = int(ang / (math.pi / 7))
                rel = ang / (math.pi / 7) - k
                if rel < 0.1 or rel > 0.92:
                    tone = WHITE
                else:
                    glass = (mix(PINK, WHITE, 0.55), mix(GOLD_L, WHITE, 0.4), mix(CYAN, WHITE, 0.6))[k % 3]
                    # К низу — светлее (свет с улицы), у рамы — гуще.
                    tone = lit(glass, 0.15) if d < 11 else glass
            c.px(x, y, tone)
    # Блик на стекле.
    for i in range(5):
        c.px(cx - 12 + i, base - 6 - i, a(WHITE, 255))
    # Замковый камень.
    c.rect(cx - 2, base - R_ - 3, 5, 4, WHITE)
    c.hline(cx - 2, base - R_ + 1, 5, SAND)
    c.vline(cx + 2, base - R_ - 3, 4, lit(CREAM, -0.05))
    # Тень от рамы на обоях справа.
    for y in range(base - R_ + 4, base + 1):
        x = cx + int(math.sqrt(max(0, R_ ** 2 - (base - y) ** 2))) + 1
        if c.get(x, y)[3] and c.get(x, y) != WHITE:
            c.px(x, y, lit(c.get(x, y), -0.12))


def swag(c, x0, x1, y0, sag):
    """Гирлянда-фестон из зелени: провисает дугой между двумя точками."""
    n = x1 - x0
    for i in range(n + 1):
        x = x0 + i
        t = i / n
        y = y0 + round(sag * math.sin(math.pi * t))
        c.px(x, y, GREEN)
        c.px(x, y + 1, GREEN_D)
        if i % 3 == 0:
            c.px(x, y - 1, GREEN_L)
        if i % 4 == 2:
            c.px(x, y + 2, GREEN)
        if i % 9 == 4 and 0.15 < t < 0.85:
            c.px(x, y, PINK)
            c.px(x + 1, y, lit(PINK, 0.4))
            c.px(x, y + 1, PINK_D)


def rose(c, x, y, big=False):
    """Розетка из роз на крюке гирлянды; большая — с бантом и лентами."""
    r = 3.2 if big else 2.2
    c.ellipse(x - 2, y + 1, 2, 1.5, GREEN)
    c.ellipse(x + 2, y + 1, 2, 1.5, GREEN_D)
    c.ellipse(x, y, r, r, PINK)
    c.ellipse(x - 0.5, y - 0.5, r * 0.55, r * 0.55, lit(PINK, 0.4))
    c.px(x, y, PINK_D)
    if big:
        c.ellipse(x - 4, y + 2, 2, 2, WHITE)
        c.ellipse(x + 4, y + 2, 2, 2, lit(PINK, 0.55))
        # Лента-бант вниз.
        for i in range(6):
            c.px(x - 2 - i // 3, y + 4 + i, PINK_D)
            c.px(x + 2 + i // 3, y + 4 + i, PINK_D)


def sign(c, x, y, w, h):
    """Вывеска бутика без букв: сливовая доска в золотой раме, золотая вешалка с бантом, звёздочки по бокам;
    над доской — две латунные подсветки на кронштейнах."""
    c.rect(x + 1, y, w - 2, h, PLUM)
    c.rect(x, y + 1, w, h - 2, PLUM)
    # Рама: снаружи золото, внутри тонкий кант.
    c.hline(x + 1, y, w - 2, GOLD_L)
    c.hline(x + 1, y + h - 1, w - 2, lit(GOLD, -0.2))
    c.vline(x, y + 1, h - 2, GOLD_L)
    c.vline(x + w - 1, y + 1, h - 2, lit(GOLD, -0.2))
    c.hline(x + 2, y + 1, w - 4, GOLD)
    c.hline(x + 2, y + h - 2, w - 4, GOLD)
    c.vline(x + 1, y + 2, h - 4, GOLD)
    c.vline(x + w - 2, y + 2, h - 4, GOLD)
    c.rect(x + 3, y + 3, w - 6, 3, lit(PLUM, 0.12))
    for xx in range(x + 4, x + w - 4, 2):
        c.px(xx, y + h - 4, a(GOLD, 255) if xx % 4 else lit(PLUM, 0.2))
    # Золотая вешалка посередине.
    mx, top = x + w // 2, y + 3
    # Крючок — толстой дугой, плечики — двойной линией: вешалка читается на телефоне.
    for px_, py in ((-1, 1), (0, 0), (1, 0), (2, 1), (2, 2), (1, 3), (0, 4), (0, 5)):
        c.px(mx + px_, top + py, GOLD_L)
        c.px(mx + px_ + 1, top + py, GOLD)
    for i in range(18):
        yy = top + 6 + (i * 9) // 18
        c.px(mx - i, yy, GOLD_L)
        c.px(mx - i, yy + 1, GOLD)
        c.px(mx + 1 + i, yy, GOLD_L if i < 6 else GOLD)
        c.px(mx + 1 + i, yy + 1, lit(GOLD, -0.15))
    c.hline(mx - 18, top + 15, 38, GOLD)
    c.hline(mx - 17, top + 15, 14, GOLD_L)
    c.hline(mx - 18, top + 16, 38, lit(GOLD, -0.25))
    # Розовый бант на крючке.
    for px_, py, tone in ((-3, 5, PINK), (-2, 6, PINK), (-3, 7, PINK_D), (3, 5, PINK), (4, 6, PINK), (4, 7, PINK_D), (0, 6, lit(PINK, 0.4)), (1, 6, PINK)):
        c.px(mx + px_, top + py, tone)
    # Звёздочки-ромбы по бокам.
    for sx in (x + 14, x + w - 15):
        c.px(sx, y + h // 2 - 2, GOLD_L)
        c.hline(sx - 1, y + h // 2 - 1, 3, GOLD)
        c.hline(sx - 2, y + h // 2, 5, GOLD_L)
        c.hline(sx - 1, y + h // 2 + 1, 3, GOLD)
        c.px(sx, y + h // 2 + 2, GOLD_L)
    for sx in (x + 26, x + w - 27):
        c.px(sx, y + h // 2, GOLD)
    # Контур доски (у стены — тоже контур, как у таблички марок).
    for yy in range(y - 1, y + h + 1):
        for xx in range(x - 1, x + w + 1):
            inside = x <= xx < x + w and y <= yy < y + h
            corner = (xx in (x, x + w - 1)) and (yy in (y, y + h - 1))
            if not inside or corner:
                if (x - 1 <= xx <= x + w and y - 1 <= yy <= y + h) and not (xx in (x - 1, x + w) and yy in (y - 1, y + h)):
                    c.px(xx, yy, INK)
    # Тень доски на обоях.
    c.hline(x + 1, y + h + 1, w, lit(PEACH, -0.2))
    c.vline(x + w + 1, y + 1, h, lit(PEACH, -0.2))
    # Подсветки: кронштейн от карниза, латунный колпачок, светящийся низ.
    for lx in (x + 22, x + w - 23):
        c.vline(lx, y - 6, 4, lit(GOLD, -0.3))
        c.hline(lx - 1, y - 6, 3, INK)
        c.rect(lx - 3, y - 3, 7, 2, GOLD)
        c.hline(lx - 3, y - 3, 7, GOLD_L)
        c.hline(lx - 2, y - 1, 5, WHITE)
        c.px(lx - 4, y - 3, INK)
        c.px(lx + 4, y - 3, INK)
        c.hline(lx - 3, y - 4, 7, INK)


def save_upper():
    upper().save("fl2d_upper")


# ---------------------------------------------------------------- лестница


def stairs():
    """Проём лестницы у нижнего края зала: латунная кромка у входа, перила по бокам с балясинами, два столбика
    с шарами у площадки; ступени с бордовой дорожкой и латунными прутками уходят вниз и темнеют до черноты —
    дальше за краем зала её продолжает шахта (floorView.drawAround)."""
    W_, H_ = 60, 140
    c = Canvas(W_, H_)
    top = 8
    c.rect(4, top, 52, H_ - top, INK)
    for i in range(16):
        y = top + 3 + i * 9
        if y >= H_:
            break
        k = min(0.95, 0.06 + i * 0.11)
        tone = lit(SAND, -k)
        c.rect(6, y, 48, 7, tone)
        c.hline(6, y, 48, lit(tone, 0.22))
        c.rect(6, y + 7, 48, 2, lit(tone, -0.5))
        run = lit(PINK_D, -min(0.95, 0.02 + i * 0.11))
        c.rect(20, y, 20, 8, run)
        c.hline(20, y, 20, lit(run, 0.2))
        c.vline(20, y, 8, lit(run, -0.25))
        c.vline(39, y, 8, lit(run, -0.25))
        c.hline(20, y + 7, 20, lit(GOLD, -min(0.95, 0.05 + i * 0.12)))
    # Стенки проёма: левая в тени, правая на свету — тоже темнеют вниз.
    for y in range(top, H_):
        f = min(0.95, (y - top) / 70)
        c.vline(4, y, 1, lit(WOOD_D, -0.3 - 0.6 * f))
        c.vline(5, y, 1, lit(WOOD_D, -0.15 - 0.6 * f))
        c.vline(54, y, 1, lit(TAN, -0.1 - 0.8 * f))
        c.vline(55, y, 1, lit(TAN, -0.25 - 0.7 * f))
    # Латунная кромка у входа (северный край проёма).
    c.hline(4, top, 52, GOLD_L)
    c.hline(4, top + 1, 52, GOLD)
    c.hline(4, top + 2, 52, lit(GOLD, -0.4))
    # Перила по бокам: свет слева, балясины — тёмные точки в проём; ниже края зала тускнеют.
    for y in range(top, H_):
        f = max(0.0, min(0.9, (y - 70) / 60))
        for x0 in (0, 56):
            c.px(x0, y, lit(GOLD_L, -f))
            c.px(x0 + 1, y, lit(GOLD, -f))
            c.px(x0 + 2, y, lit(GOLD, -f))
            c.px(x0 + 3, y, lit(GOLD, -0.3 - f * 0.65))
        if (y - top) % 8 == 5:
            c.px(4, y, lit(GOLD, -0.45 - f * 0.5))
            c.px(55, y, lit(GOLD, -0.35 - f * 0.6))
    # Столбики с шарами у площадки.
    for x0 in (0, 54):
        c.rect(x0, 4, 6, 10, GOLD)
        c.vline(x0, 4, 10, GOLD_L)
        c.vline(x0 + 5, 4, 10, lit(GOLD, -0.3))
        c.hline(x0, 13, 6, lit(GOLD, -0.35))
        c.ellipse(x0 + 3, 2.5, 3, 2.5, GOLD)
        c.px(x0 + 2, 1, WHITE)
        c.px(x0 + 1, 2, GOLD_L)
    c.outline(INK)
    c.save("fl2d_stairs")


def mat():
    """Полукруглый коврик на площадке у лестницы: сливовая кайма, розовое поле, кремовый узор и бахрома."""
    c = Canvas(48, 18)
    cx, base = 24, 17.5
    for y in range(18):
        for x in range(48):
            d = ((x + 0.5 - cx) / 23.5) ** 2 + ((y + 0.5 - base) / 17) ** 2
            if d < 1:
                if d > 0.78:
                    tone = PLUM
                elif d > 0.66:
                    tone = CREAM if (x // 2) % 2 else PEACH
                elif d > 0.58:
                    tone = PLUM
                else:
                    tone = PINK_D if ((x // 3 + y // 3) % 5) else lit(PINK_D, -0.15)
                c.px(x, y, tone)
    c.ellipse(cx, base, 7, 5, CREAM)
    c.ellipse(cx, base, 5, 3.5, GOLD)
    # Бахрома по дуге.
    for x in range(2, 46, 2):
        for y in range(18):
            if c.get(x, y)[3]:
                c.px(x, y - 1, a(CREAM, 255))
                break
    c.save("fl2d_mat")


# ---------------------------------------------------------------- подиум «новая коллекция»


def stage():
    """Двухъярусный подиум: белый с золотым кантом, верхний ярус — сливовый бархат; спереди — латунная планка."""
    c = Canvas(88, 36)
    cx = 44

    def side(x, tone):
        """Бок цилиндра: свет слева, к правому краю — ступенями темнее."""
        t = (x - cx) / 42
        return lit(tone, 0.25) if t < -0.6 else tone if t < 0.25 else lit(tone, -0.1) if t < 0.65 else lit(tone, -0.2)

    # Нижний ярус: бок с золотым кантом и верх.
    for x in range(88):
        for y in range(20, 34):
            if ((x + 0.5 - cx) / 42) ** 2 + ((y + 0.5 - 26) / 8) ** 2 <= 1 or (2 <= x < 86 and y < 26):
                c.px(x, y, side(x, lit(METAL_L, 0.5)))
    for x in range(3, 85):
        yy = 26 + round(7 * math.sqrt(max(0, 1 - ((x + 0.5 - cx) / 42) ** 2))) - 3
        c.px(x, yy, GOLD if x < cx + 20 else lit(GOLD, -0.2))
    c.ellipse(cx, 20, 42, 8, lit(CREAM, 0.55))
    c.ellipse(cx, 20, 39, 6.5, lit(CREAM, 0.35))
    # Верхний ярус: бархатный бок, золотой обод, бархатный верх с бликом.
    for x in range(15, 74):
        for y in range(12, 25):
            if ((x + 0.5 - cx) / 29) ** 2 + ((y + 0.5 - 18) / 6) ** 2 <= 1 or y < 18:
                c.px(x, y, side(x, PINK_D))
    c.ellipse(cx, 12, 29.5, 6, GOLD)
    c.ellipse(cx, 12, 28.5, 5.2, lit(PINK_D, 0.12))
    c.ellipse(cx - 6, 11, 13, 2.2, lit(PINK_D, 0.25))
    for x in range(16, 30):
        if c.get(x, 7)[3] and c.get(x, 7) == GOLD:
            c.px(x, 7, GOLD_L)
    c.outline(INK)
    shadowed(c, cx, 30, 42, 5).save("fl2d_stage")


def pampas():
    """Высокая белая ваза с пампасной травой: пушистые метёлки песочного и кремового цвета."""
    c = Canvas(18, 44)
    # Ваза.
    c.ellipse(9, 34, 5, 6, WHITE)
    c.rect(7, 26, 4, 4, WHITE)
    c.ellipse(9, 26, 2.5, 1, METAL_L)
    for y in range(27, 41):
        for x in range(10, 15):
            if c.get(x, y) == WHITE:
                c.px(x, y, METAL_L if x > 11 else lit(METAL_L, 0.5))
    c.hline(6, 34, 7, GOLD)
    # Стебли.
    for x0, x1 in ((9, 4), (9, 14), (9, 9), (8, 6), (10, 12)):
        c.line(x0, 26, x1, 12, lit(SAND, -0.25))
    # Метёлки.
    for (cx, cy, rx, ry, tone) in ((4, 9, 3, 6, SAND), (14, 8, 3, 6.5, CREAM), (9, 6, 3, 6, lit(CREAM, 0.3)), (6, 13, 2.5, 4, CREAM), (12, 14, 2.5, 4, SAND)):
        c.ellipse(cx, cy, rx, ry, tone)
    for x, y in ((3, 6), (9, 2), (14, 4), (5, 11), (10, 8), (13, 11)):
        c.px(x, y, WHITE)
    for x, y in ((5, 13), (15, 11), (8, 10), (12, 17)):
        c.px(x, y, lit(SAND, -0.15))
    c.outline(INK)
    shadowed(c, 9, 41, 5, 1.5).save("fl2d_pampas")


def manq(coll, k):
    """Манекены подиума: новые наряды сезона (у окон — другие, clothes_art.manq).
    Холода: верблюжье пальто с поясом и бордовый берет / зелёное вязаное платье, сапоги и белая шапка.
    Дожди: красный дождевик и жёлтые сапожки / тёмно-синий плащ с поясом и шляпа.
    Лето: голубое платье в цветочек и широкая шляпа / жёлтый сарафан, очки и розовая сумочка."""
    c = Canvas(24, 40)
    ca.mannequin_body(c)
    if coll == "warm" and k == 0:
        tone = TAN
        c.rect(6, 12, 12, 23, tone)
        c.rect(4, 13, 3, 13, tone)
        c.rect(17, 13, 3, 13, tone)
        c.vline(6, 12, 23, lit(tone, -0.4))
        c.vline(16, 13, 21, lit(tone, 0.2))
        c.hline(6, 21, 12, WOOD_D)
        c.px(12, 21, GOLD)
        c.px(10, 15, lit(tone, -0.3))
        c.px(14, 15, lit(tone, -0.3))
        c.px(12, 13, lit(tone, -0.35))
        c.px(12, 14, lit(tone, -0.35))
        c.vline(12, 22, 12, lit(tone, -0.25))
        # Шарф и берет.
        c.rect(8, 11, 8, 2, CREAM)
        c.rect(14, 13, 2, 6, CREAM)
        c.hline(14, 18, 2, RED)
        c.ellipse(12, 3, 5, 2.2, RED_D)
        c.px(12, 0, RED_D)
        c.hline(9, 2, 5, lit(RED_D, 0.25))
    elif coll == "warm":
        tone = GREEN
        c.rect(7, 12, 10, 19, tone)
        c.rect(5, 13, 2, 13, tone)
        c.rect(17, 13, 2, 13, tone)
        for x in range(8, 17, 2):
            c.vline(x, 14, 15, lit(tone, 0.12))
        c.hline(7, 30, 10, lit(tone, -0.3))
        c.rect(8, 11, 8, 2, lit(tone, -0.2))
        c.vline(7, 12, 19, lit(tone, -0.35))
        # Сапоги.
        for x in (9, 13):
            c.rect(x - 1, 31, 4, 5, BROWN)
            c.vline(x - 1, 31, 5, lit(BROWN, 0.25))
        # Белая вязаная шапка с помпоном.
        c.rect(8, 1, 8, 4, WHITE)
        c.hline(8, 4, 8, METAL_L)
        c.rect(11, 0, 2, 1, WHITE)
    elif coll == "rain" and k == 0:
        tone = RED
        c.rect(6, 12, 12, 19, tone)
        c.rect(4, 13, 3, 13, tone)
        c.rect(17, 13, 3, 13, tone)
        c.vline(15, 13, 16, lit(tone, 0.45))
        c.vline(12, 13, 18, lit(tone, -0.3))
        c.vline(6, 12, 19, lit(tone, -0.4))
        for y in (16, 21, 26):
            c.px(11, y, WHITE)
        # Капюшон на спине — ворот, сапожки.
        c.rect(8, 10, 8, 2, lit(tone, -0.25))
        for x in (9, 13):
            c.rect(x - 1, 32, 4, 4, GOLD_L)
            c.vline(x - 1, 32, 4, GOLD)
    elif coll == "rain":
        tone = NAVY_L
        c.rect(6, 12, 12, 22, tone)
        c.rect(4, 13, 3, 13, tone)
        c.rect(17, 13, 3, 13, tone)
        c.vline(6, 12, 22, lit(tone, -0.4))
        c.hline(6, 21, 12, lit(tone, -0.35))
        c.px(14, 22, lit(tone, -0.35))
        c.px(14, 23, lit(tone, -0.35))
        for y in (15, 18, 25):
            c.px(10, y, GOLD)
            c.px(14, y, GOLD)
        c.rect(9, 11, 6, 2, lit(tone, 0.3))
        # Шарф и шляпа.
        c.rect(9, 11, 6, 2, GOLD)
        c.ellipse(12, 3.5, 6, 1.4, SLATE)
        c.rect(9, 0, 6, 3, SLATE)
        c.hline(9, 2, 6, RED_D)
    elif coll == "summer" and k == 0:
        tone = mix(CYAN, WHITE, 0.25)
        c.rect(8, 12, 8, 8, tone)
        for i in range(15):
            w = 8 + (i * 2) // 3
            c.hline(12 - w // 2, 20 + i, w, tone)
        for dx, dy in ((-2, 14), (2, 17), (-3, 23), (1, 25), (4, 29), (-2, 31), (2, 33)):
            c.px(12 + dx, dy, PINK)
            c.px(12 + dx + 1, dy, WHITE)
        c.vline(8, 12, 8, lit(tone, -0.3))
        c.hline(8, 19, 8, lit(tone, -0.3))
        # Широкая шляпа с лентой.
        c.ellipse(12, 3.5, 9, 1.8, GOLD_L)
        c.ellipse(12, 2.2, 4, 2, SAND)
        c.hline(8, 3, 8, PINK_D)
    else:
        tone = GOLD_L
        c.px(9, 11, tone)
        c.px(14, 11, tone)
        c.rect(8, 12, 8, 7, tone)
        for i in range(10):
            w = 8 + i // 2
            c.hline(12 - w // 2, 19 + i, w, tone)
        c.hline(8, 18, 8, ORANGE)
        c.vline(8, 12, 7, lit(GOLD, -0.1))
        for i in range(1, 10, 3):
            c.px(12 - 4 - i // 4, 19 + i, GOLD)
        # Очки на голове и розовая сумочка в руке.
        c.hline(9, 5, 6, NAVY)
        c.px(12, 5, METAL)
        c.rect(18, 24, 4, 3, PINK)
        c.hline(18, 24, 4, lit(PINK, 0.3))
        c.px(19, 23, PINK_D)
        c.px(20, 23, PINK_D)
    c.outline(INK)
    shadowed(c, 12, 38, 6, 1.5).save(f"fl2d_manq_{coll}{k}")


# ---------------------------------------------------------------- уголок ожидания


def pillow(c, x, y, tone, trim):
    """Квадратная подушка, чуть наклонена: светлый верх, тёмный низ, пуговица и кант."""
    c.rect(x + 1, y, 9, 9, tone)
    c.rect(x, y + 1, 11, 7, tone)
    c.hline(x + 1, y, 9, lit(tone, 0.3))
    c.vline(x, y + 1, 7, lit(tone, 0.15))
    c.hline(x + 1, y + 8, 9, lit(tone, -0.3))
    c.vline(x + 10, y + 1, 7, lit(tone, -0.2))
    c.px(x + 5, y + 4, trim)
    for xx in (x + 1, x + 9):
        c.px(xx, y + 8, trim)


def sofa():
    """Бархатный диван-честерфилд: изумрудный, спинка горбом с каретной стяжкой, круглые подлокотники, две подушки
    сиденья, декоративные подушки — розовая и золотая, золотые ножки."""
    c = Canvas(72, 42)
    V, Vd, Vl = GREEN, GREEN_D, lit(GREEN, 0.2)
    # Спинка горбом.
    for x in range(7, 65):
        t = (x - 35.5) / 29
        top = 4 + round(4 * t * t)
        c.vline(x, top, 23 - top, V)
        c.px(x, top, Vl)
        c.px(x, top + 1, lit(V, 0.1))
    # Каретная стяжка: ромбы и пуговицы.
    for row, y in enumerate((11, 17)):
        for x in range(11 + (row % 2) * 4, 62, 8):
            c.px(x, y, Vd)
            c.px(x - 1, y - 1, lit(V, -0.12))
            c.px(x + 1, y + 1, lit(V, 0.12))
    for x in range(62, 65):
        for y in range(5, 23):
            if c.get(x, y) == V:
                c.px(x, y, lit(V, -0.15))
    # Подлокотники-валики.
    for x0 in (1, 61):
        c.rect(x0, 15, 10, 18, V)
        c.ellipse(x0 + 5, 15.5, 5, 3, Vl)
        c.ellipse(x0 + 5, 15.5, 3, 1.6, lit(V, 0.32))
        c.vline(x0 + 9, 16, 17, Vd)
        c.vline(x0, 16, 17, lit(V, 0.08))
        c.px(x0 + 5, 15, GOLD)
    # Сиденье: две подушки.
    c.rect(11, 23, 50, 4, Vl)
    c.rect(11, 27, 50, 5, V)
    c.vline(35, 23, 9, Vd)
    c.hline(11, 31, 50, Vd)
    c.hline(11, 23, 50, lit(V, 0.32))
    # Цоколь с золотым кантом и ножки.
    c.rect(1, 32, 70, 3, Vd)
    c.hline(1, 32, 70, GOLD)
    for x in (4, 65):
        c.rect(x, 35, 3, 2, GOLD)
        c.px(x + 1, 37, lit(GOLD, -0.3))
    # Декоративные подушки.
    pillow(c, 13, 13, PINK, GOLD_L)
    pillow(c, 47, 13, GOLD_L, PINK_D)
    c.outline(INK)
    shadowed(c, 36, 37, 34, 3).save("fl2d_sofa")


def lamp():
    """Торшер: кремовый абажур со светящимся низом, латунная стойка и круглое основание."""
    c = Canvas(18, 62)
    c.rect(8, 0, 2, 2, GOLD)
    for y in range(2, 15):
        half = 4 + (y - 2) * 3 // 12
        for x in range(9 - half, 9 + half):
            tone = CREAM
            if x <= 9 - half + 1:
                tone = WHITE
            elif x >= 9 + half - 2:
                tone = SAND
            c.px(x, y, tone)
    c.hline(3, 14, 12, GOLD_L)
    c.hline(5, 15, 8, WHITE)
    c.vline(8, 15, 41, GOLD_L)
    c.vline(9, 15, 41, GOLD)
    c.ellipse(9, 57, 6, 2.2, GOLD)
    c.ellipse(8, 56.5, 4, 1.2, GOLD_L)
    c.outline(INK)
    shadowed(c, 9, 59, 6, 1.5).save("fl2d_lamp")


def rug():
    """Ковёр уголка ожидания: кремовое поле, изумрудная кайма, розовые ромбы, бахрома по коротким краям."""
    c = Canvas(104, 40)
    x0, x1, y0, y1 = 4, 100, 1, 39
    for y in range(y0, y1):
        for x in range(x0, x1):
            edge = min(x - x0, x1 - 1 - x, (y - y0) * 2, (y1 - 1 - y) * 2)
            if edge < 3:
                tone = GREEN_D
            elif edge < 5:
                tone = GOLD if (x + y) % 4 else lit(GOLD, -0.2)
            elif edge < 7:
                tone = GREEN_D
            else:
                tone = lit(CREAM, 0.15)
                # Ромбы по полю.
                cx = (x - x0 - 7) % 16 - 8
                cy = (y - y0 - 3) % 12 - 6
                if abs(cx) / 8 + abs(cy) / 6 < 0.45:
                    tone = PINK if abs(cx) / 8 + abs(cy) / 6 > 0.2 else PINK_D
            c.px(x, y, tone)
    for y in range(y0 + 1, y1 - 1, 2):
        for x in (0, 1, 2, 3):
            c.px(x, y, CREAM)
        for x in (100, 101, 102, 103):
            c.px(x, y, CREAM)
    c.save("fl2d_rug")


# ---------------------------------------------------------------- у входа


def hatstand():
    """Вешалка-стойка у входа: тёмное дерево, крючки, на них фетровая шляпа, соломенная шляпа с лентой, полосатый
    шарф и сумка; ножки-тренога."""
    c = Canvas(28, 70)
    # Стойка и навершие.
    c.rect(13, 8, 2, 54, WOOD_D)
    c.vline(13, 8, 54, WOOD)
    c.ellipse(14, 6, 2.5, 2.5, WOOD)
    c.px(13, 5, SAND)
    # Крючки.
    for (x0, y0, x1, y1) in ((13, 13, 7, 10), (14, 13, 20, 10), (13, 24, 8, 21), (14, 24, 20, 21)):
        c.line(x0, y0, x1, y1, WOOD_D)
    # Ножки.
    for x1 in (4, 23):
        c.line(14, 60, x1, 66, WOOD_D)
    c.vline(14, 62, 5, WOOD_D)
    # Полосатый шарф с левого нижнего крючка.
    for y in range(21, 46):
        tone = PINK if (y // 3) % 2 else CREAM
        c.rect(6, y, 3, 1, tone)
        c.px(8, y, lit(tone, -0.2))
    for x in (6, 8):
        c.vline(x, 46, 2, PINK)
    # Сумка с правого нижнего крючка.
    c.line(18, 21, 16, 27, BROWN)
    c.line(21, 21, 23, 27, BROWN)
    c.rect(15, 27, 10, 8, TAN)
    c.hline(15, 27, 10, lit(TAN, 0.3))
    c.vline(24, 28, 7, lit(TAN, -0.3))
    c.rect(18, 29, 3, 2, GOLD)
    # Фетровая шляпа слева сверху.
    c.ellipse(6, 13, 6, 1.6, BROWN)
    c.rect(3, 8, 7, 5, BROWN)
    c.hline(3, 8, 7, lit(BROWN, 0.25))
    c.hline(3, 11, 7, NAVY)
    c.px(6, 9, lit(BROWN, -0.3))
    # Соломенная шляпа справа сверху.
    c.ellipse(21, 12.5, 6.5, 1.8, GOLD_L)
    c.ellipse(21, 10, 3.5, 2.5, SAND)
    c.hline(18, 11, 7, RED)
    c.px(25, 12, RED)
    c.px(25, 13, RED)
    c.outline(INK)
    shadowed(c, 14, 66, 9, 2).save("fl2d_hatstand")


def flowers():
    """Мраморный столик на ножке с большим букетом в золотистой вазе: пионы и гортензии в розовом и белом, зелень."""
    c = Canvas(40, 54)
    # Ножка и основание.
    c.ellipse(20, 50, 8, 2.5, WHITE)
    c.hline(13, 50, 15, METAL_L)
    c.rect(17, 34, 6, 16, WHITE)
    c.vline(21, 34, 16, METAL_L)
    c.vline(22, 34, 16, METAL_L)
    c.rect(15, 44, 10, 2, lit(CREAM, 0.4))
    # Столешница — мрамор с прожилками.
    c.ellipse(20, 33, 17, 4.5, lit(METAL_L, 0.2))
    c.ellipse(20, 31.5, 17, 4.5, WHITE)
    for x, y in ((9, 31), (10, 32), (11, 32), (25, 30), (26, 31), (28, 31), (17, 33)):
        c.px(x, y, METAL_L)
    c.hline(5, 34, 30, METAL)
    # Ваза.
    c.ellipse(20, 26, 5.5, 4.5, GOLD)
    c.rect(17, 21, 6, 4, GOLD)
    c.vline(16, 23, 6, GOLD_L)
    c.vline(24, 24, 4, lit(GOLD, -0.3))
    c.hline(17, 21, 6, GOLD_L)
    # Зелень.
    for (cx, cy, rx, ry) in ((7, 17, 4, 2.5), (33, 16, 4, 2.5), (11, 21, 3.5, 2), (29, 21, 3.5, 2), (20, 6, 3, 2)):
        c.ellipse(cx, cy, rx, ry, GREEN)
        c.px(int(cx), int(cy), GREEN_D)
    # Цветы: шапки гортензий и пионы.
    for (cx, cy, r, tone) in ((13, 13, 6, PINK), (27, 12, 6, lit(PINK, 0.45)), (20, 9, 6, WHITE), (16, 18, 4.5, lit(PINK, 0.2)), (25, 18, 4.5, PINK_D), (9, 9, 3.5, WHITE), (31, 7, 3.5, PINK)):
        c.ellipse(cx, cy, r, r * 0.9, tone)
        for i in range(5):
            ang = i * 1.3 + cx
            px_ = int(cx + math.cos(ang) * r * 0.5)
            py = int(cy + math.sin(ang) * r * 0.45)
            c.px(px_, py, lit(tone, -0.12) if tone != WHITE else METAL_L)
        c.px(int(cx - r * 0.4), int(cy - r * 0.4), lit(tone, 0.35) if tone != WHITE else WHITE)
    c.outline(INK)
    shadowed(c, 20, 51, 12, 2).save("fl2d_flowers")


# ---------------------------------------------------------------- до ремонта


def wrap():
    """Новая стойка, ещё в плёнке: над перекладиной торчат крючки плечиков, плёнка свисает мешком и расширяется
    книзу, вертикальные складки-блики, полоса скотча и красная бирка «новое»."""
    c = Canvas(48, 52)
    top = 7
    film, dark, hi = mix(METAL_L, WHITE, 0.35), mix(METAL_L, METAL, 0.35), WHITE
    # Крючки плечиков над перекладиной.
    for x in range(10, 40, 5):
        c.px(x, top - 4, METAL)
        c.px(x + 1, top - 3, METAL)
        c.px(x, top - 2, METAL_L)
    c.rect(3, top - 1, 42, 2, METAL)
    c.hline(3, top - 1, 42, METAL_L)
    # Мешок плёнки: сверху у перекладины узко, книзу шире; складки вертикальными полосами.
    for y in range(top, top + 37):
        t = (y - top) / 36
        half = 19 + round(4 * t)
        for x in range(24 - half, 24 + half):
            k = (x - (24 - half)) / (2 * half)
            tone = film
            if k > 0.78:
                tone = dark
            elif (x * 7 + y // 6) % 11 == 0:
                tone = METAL_L
            elif k < 0.12 or (x * 5) % 17 == 3:
                tone = hi
            c.px(x, y, tone)
    # Сквозь плёнку — тени вещей-чехлов.
    for x in range(9, 40, 6):
        c.vline(x, top + 3, 20 + (x % 7), lit(film, -0.12))
    # Скотч и бирка.
    c.rect(1, top + 16, 46, 3, SAND)
    c.hline(1, top + 16, 46, lit(SAND, 0.3))
    c.rect(33, top + 22, 7, 6, RED)
    c.hline(33, top + 22, 7, lit(RED, 0.3))
    c.px(36, top + 24, WHITE)
    c.vline(36, top + 19, 3, CREAM)
    # Низ: колёсики из-под плёнки.
    for x in (5, 42):
        c.rect(x - 3, top + 37, 7, 2, SLATE)
        c.rect(x - 3, top + 39, 2, 2, NAVY)
        c.rect(x + 2, top + 39, 2, 2, NAVY)
    c.outline(INK)
    shadowed(c, 24, 48, 22, 3).save("fl2d_wrap")


def reno():
    """Скоро ремонт: стремянка, две коробки со скотчем, банка розовой краски с валиком, свёрнутый ковёр."""
    c = Canvas(52, 52)
    # Свёрнутый ковёр у стены (лежит сзади).
    c.rect(2, 36, 30, 7, PINK_D)
    c.hline(2, 36, 30, lit(PINK_D, 0.25))
    c.hline(2, 42, 30, PLUM)
    c.ellipse(32, 39.5, 3, 3.5, CREAM)
    c.ellipse(32, 39.5, 1.6, 2, PLUM)
    # Коробки стопкой.
    for (x, y, w, h) in ((4, 30, 18, 14), (6, 18, 14, 12)):
        c.rect(x, y, w, h, SAND)
        c.hline(x, y, w, lit(SAND, 0.3))
        c.vline(x + w - 1, y, h, TAN)
        c.rect(x + w // 2 - 1, y, 3, h, lit(SAND, 0.15))
        c.vline(x + w // 2 - 1, y, h, CREAM)
        c.px(x + 3, y + h - 4, BROWN)
        c.px(x + 4, y + h - 4, BROWN)
    # Стремянка: две ноги буквой «А», ступени.
    for x0, x1 in ((30, 26), (44, 48)):
        c.line(x0, 4, x1, 47, WOOD)
        c.line(x0 + 1, 4, x1 + 1, 47, WOOD_D)
    c.rect(29, 2, 17, 3, WOOD)
    c.hline(29, 2, 17, SAND)
    for i, y in enumerate((14, 25, 36)):
        x0 = 30 - (y - 4) * 4 // 43
        x1 = 45 + (y - 4) * 4 // 43
        c.hline(x0, y, x1 - x0, SAND)
        c.hline(x0, y + 1, x1 - x0, WOOD)
    # Банка краски с валиком у ног.
    c.rect(34, 40, 10, 9, WHITE)
    c.vline(43, 40, 9, METAL_L)
    c.ellipse(39, 40, 5, 1.6, PINK)
    c.rect(36, 44, 6, 3, PINK)
    c.line(44, 40, 48, 32, METAL)
    c.rect(45, 28, 6, 4, PINK)
    c.hline(45, 28, 6, lit(PINK, 0.3))
    c.outline(INK)
    shadowed(c, 26, 48, 24, 2.5).save("fl2d_reno")


if __name__ == "__main__":
    save_upper()
    stairs()
    mat()
    stage()
    pampas()
    for coll in ("warm", "rain", "summer"):
        manq(coll, 0)
        manq(coll, 1)
    sofa()
    lamp()
    rug()
    hatstand()
    flowers()
    wrap()
    reno()
