"""Подвал «как настоящий зал» (14.11, автор: «нужно отрисовать красиво и подвал… и трафик туда, и улучшения — всё как
в основном зале»). Рисунок к scenes/floors/basementFloor.ts: тёмный кирпичный зал со сводами, трубами и кабелями,
автоматы с неоном, барная стойка с окошком администратора, грузовой лифт и холодильник-склад с паллетами, подсобка
ломбарда за решёткой, уголок с диваном и телевизором. Улучшения подвала (game/basement.ts BASEMENT_UPS) видны на
этаже: неон, вытяжка (без неё — сырость и лужа), охрана у лестницы.

Палитра Endesga 32 (art/sprites.py), двойная детализация: в мире всё вдвое меньше (ART = 2). Свет и полутени —
сценой (пятна ADD поверх тёмной вуали, как lighting.ts в зале), здесь — только предметы и их светящиеся слои.

    python3 art/basement_art.py

Картинки (размеры — в пикселях рисунка):
  bsm_wall        336×88  задняя стена целиком: кирпич, своды на пилонах, трубы с вентилем, кабели, цоколь;
  bsm_damp        336×88  сырость на стене (пока нет вытяжки): потёки, отбитая штукатурка, плесень у пола;
  bsm_duct        336×16  короб вытяжки под сводом (улучшение «вентиляция и ремонт»);
  bsm_fan         24×24   решётка вытяжного вентилятора; bsm_fan_blade 20×20 — лопасти (крутятся сценой);
  bsm_floor2      64×64   бетонный пол: четыре плиты своего тона (22.11, было 32×32); bsm_floor_fin 64×64 - плитка
                          после ремонта; трещины, пятна, трап, ковёр и низ зала - art/basement_deco.py;
  bsm_wear        48×20   затёртое место на полу (у автоматов, у стойки); bsm_puddle 30×10 — лужа под трубой;
  bsm_slot2       28×54   игровой автомат: корпус, козырёк, экран, панель кнопок, лоток;
  bsm_slot2_lit   28×54   что светится у включённого автомата (козырёк, экран, кнопки, боковые полосы);
  bsm_slot2_win   28×54   то же золотым — вспышка «выигрыша» (без сумм и монет — подвал подаём нейтрально);
  bsm_reels0/1    16×12   барабаны на экране, пока играют (два кадра);
  bsm_stool       12×16   барный табурет;
  bsm_bar         104×40  барная стойка: столешница, панели, латунная подножка, касса;
  bsm_bar_back    104×52  шкаф за стойкой: полки с банками и чайником, окошко администратора с решёткой;
  bsm_lift        56×72   грузовой лифт в задней стене (двери закрыты); bsm_lift_open — открыт, внутри свет;
  bsm_cold2       88×100  холодильник-склад у правой стены: панели, дверь с инеем, табло, компрессор на крыше;
  bsm_cold2_open  88×100  он же с открытой дверью (внутри синий свет и пар);
  bsm_pallet      36×30   паллета с коробками в плёнке; bsm_jack 30×16 — тележка-рохля (смотрит вправо);
  bsm_pawn        112×84  ломбард: кирпичная будка с окном, полки «Разное», световой короб вывески, три золотых шара;
  bsm_pawn_bars   112×84  решётка, прилавок и низ будки — поверх вещей на полках и ломбардщика за прилавком;
  bsm_sofa        64×32   старый диван; bsm_tv 30×34 — телевизор на тумбе, bsm_tv_lit — его экран;
  bsm_neon_big    124×36  большая неоновая вывеска над автоматами (вишенка, звезда, молния, волна);
  bsm_neon_small  24×22   маленькая розовая стрелка-неон у лестницы;
  bsm_cam         16×12   камера на стене; bsm_post 26×26 — пост охраны;
  bsm_lamp        12×10   лампа в сетке-клетке под сводом;
  bsm_ico_neon    26×26   значок «неона» в «Этажах»; bsm_ico_fan 24×24 — значок «вытяжки».
"""

import math
import random

from premium import H, lit
from sprites import Canvas, shadowed

INK = H("#181425")
NAVY, NAVY2, SLATE, STEEL, MIST, PALE = H("#262b44"), H("#3a4466"), H("#5a6988"), H("#8b9bb4"), H("#c0cbdc"), H("#ffffff")
BR_D, BR, BR_L, CLAY, CLAY_L = H("#3e2731"), H("#733e39"), H("#b86f50"), H("#be4a2f"), H("#d77643")
SAND, SAND_D, SKIN = H("#ead4aa"), H("#e4a672"), H("#c28569")
RED, RED_D, RED_L, HOT = H("#a22633"), H("#68386c"), H("#e43b44"), H("#ff0044")
PINK, PINK_L = H("#b55088"), H("#f6757a")
GOLD, GOLD_L, ORANGE = H("#feae34"), H("#fee761"), H("#f77622")
CYAN, BLUE, BLUE_D = H("#2ce8f5"), H("#0099db"), H("#124e89")
GREEN, GREEN_D, TEAL = H("#63c74d"), H("#3e8948"), H("#193c3e")


def brick_wall(c, x0, y0, w, h, seed, tone=BR_D, joint=INK, hi=BR):
    """Кладка вперевязку: кирпич 14×6, шов 1; светлее верхняя кромка, темнее нижняя; редкие выщербины."""
    rnd = random.Random(seed)
    c.rect(x0, y0, w, h, joint)
    for row in range((h + 6) // 7):
        y = y0 + row * 7
        shift = 0 if row % 2 == 0 else 8
        for i in range(-1, w // 16 + 2):
            x = x0 + i * 16 + shift
            t = rnd.random()
            base = lit(tone, 0.08) if t < 0.2 else lit(tone, -0.12) if t > 0.85 else tone
            for yy in range(y + 1, min(y + 7, y0 + h)):
                for xx in range(max(x + 1, x0), min(x + 15, x0 + w)):
                    c.px(xx, yy, base)
            if y + 1 < y0 + h:
                for xx in range(max(x + 1, x0), min(x + 15, x0 + w)):
                    c.px(xx, y + 1, hi if t < 0.3 else lit(base, 0.14))
            if rnd.random() < 0.18:
                c.px(x + 2 + rnd.randrange(10), y + 3 + rnd.randrange(3), joint)


def wall():
    """Задняя стена 336×88: кирпич, три свода на пилонах (под сводом стена глубже и темнее), две трубы с фланцами и
    красным вентилем, провисающие кабели на крюках, цоколь из бетона. Слева (под лестницей) — тот же кирпич."""
    c = Canvas(336, 88)
    brick_wall(c, 0, 0, 336, 88, 11, tone=BR, joint=BR_D, hi=lit(BR, 0.18))
    # Ниши под сводами: кирпич темнее (глубже), арка выложена ребром — светлые клинья по дуге.
    piers = [0, 112, 224, 336]
    for a, b in zip(piers, piers[1:]):
        cx = (a + b) / 2
        rx = (b - a) / 2 - 10
        cy, ry, ring = 44, 30, 6
        for y in range(0, 80):
            for x in range(a + 6, b - 6):
                dx = (x + 0.5 - cx) / rx
                dy = (y + 0.5 - cy) / ry
                inner = y >= cy or dx * dx + dy * dy <= 1
                ox = (x + 0.5 - cx) / (rx + ring)
                oy = (y + 0.5 - cy) / (ry + ring)
                p = c.get(x, y)
                if inner:
                    if abs(x + 0.5 - cx) < rx + 0.5:
                        c.px(x, y, lit(p, -0.45))
                elif y < cy and ox * ox + oy * oy <= 1:
                    # Клинья: по углу — свой кирпич, между ними тёмный шов; нижний ряд клина светлее.
                    ang = math.degrees(math.atan2(cy - y - 0.5, x + 0.5 - cx))
                    k = int(ang // 9)
                    edge = abs(ang - (k * 9)) < 1.2
                    tone = BR_L if k % 2 else CLAY
                    if dx * dx + dy * dy <= 1.12:
                        tone = lit(tone, 0.18)
                    c.px(x, y, BR_D if edge else tone)
        # Тень под аркой: верх ниши темнее всего.
        for x in range(a + 6, b - 6):
            for y in range(0, cy):
                dx = (x + 0.5 - cx) / rx
                dy = (y + 0.5 - cy) / ry
                if dx * dx + dy * dy <= 1 and dx * dx + dy * dy > 0.8:
                    c.px(x, y, lit(c.get(x, y), -0.3))
    # Пилоны: выступающие столбы кирпича со светлой гранью.
    for x in piers:
        for xx in range(x - 6, x + 6):
            for y in range(0, 80):
                p = c.get(xx, y)
                if p[3]:
                    c.px(xx, y, lit(p, 0.08))
        c.vline(x - 6, 0, 80, INK)
        c.vline(x + 5, 0, 80, lit(BR_D, -0.3))
        c.vline(x - 5, 0, 80, BR_L)
    # Цоколь: бетонная полоса с тёмной кромкой и пятнами.
    c.rect(0, 80, 336, 8, NAVY2)
    c.hline(0, 80, 336, SLATE)
    c.hline(0, 87, 336, INK)
    c.speckle(0, 81, 336, 6, [NAVY, SLATE], 90, 5)
    # Трубы под сводом: толстая (вода) и тонкая (отопление), фланцы через каждые 48, вентиль.
    for y, th, tone in ((4, 5, SLATE), (11, 3, BR)):
        c.rect(0, y, 336, th, tone)
        c.hline(0, y, 336, lit(tone, 0.35))
        c.hline(0, y + th - 1, 336, lit(tone, -0.35))
        for x in range(20, 336, 48):
            c.rect(x, y - 1, 3, th + 2, lit(tone, -0.15))
            c.vline(x, y - 1, th + 2, lit(tone, 0.3))
    # Вентиль: красное колесо на толстой трубе.
    c.ellipse(258, 6.5, 4, 4, RED_L)
    c.ellipse(258, 6.5, 2, 2, INK)
    c.px(256, 4, PINK_L)
    # Опуск трубы вниз у правого края (к холодильнику).
    c.rect(322, 9, 5, 71, SLATE)
    c.vline(322, 9, 71, STEEL)
    c.vline(326, 9, 71, NAVY2)
    for y in (30, 60):
        c.rect(321, y, 7, 3, NAVY2)
    # Кабели: два провода провисают между крюками.
    hooks = list(range(8, 336, 56))
    for tone, sag, dy in ((INK, 5, 18), (NAVY, 3, 20)):
        for a, b in zip(hooks, hooks[1:]):
            for x in range(a, b + 1):
                t = (x - a) / (b - a)
                y = dy + round(sag * 4 * t * (1 - t))
                c.px(x, y, tone)
        for x in hooks:
            c.rect(x - 1, dy - 2, 2, 3, STEEL)
    # Распределительная коробка с лампочкой-индикатором.
    c.rect(176, 26, 12, 14, NAVY2)
    c.frame(176, 26, 12, 14, INK)
    c.hline(177, 27, 10, SLATE)
    c.px(185, 30, GREEN)
    c.vline(182, 20, 6, INK)
    c.save("bsm_wall")


def damp():
    """Сырость (пока нет вытяжки): тёмные потёки из-под труб, отбитая штукатурка, зеленоватый налёт у цоколя."""
    c = Canvas(336, 88)
    rnd = random.Random(7)
    stain = H("#181425", 120)
    green = H("#265c42", 150)
    for x0 in (44, 150, 236, 300):
        w = rnd.randint(8, 16)
        for x in range(x0, x0 + w):
            h = rnd.randint(14, 40) - abs(x - x0 - w // 2) * 2
            for y in range(16, 16 + max(4, h)):
                c.px(x, y, stain)
        for k in range(3):
            x = x0 + rnd.randrange(w)
            c.vline(x, 16, rnd.randint(30, 56), H("#181425", 170))
    for x0, y0 in ((86, 40), (206, 54)):
        c.ellipse(x0, y0, 7, 4, H("#8b9bb4", 200))
        c.ellipse(x0 + 1, y0 + 1, 5, 2.5, H("#c0cbdc", 200))
        c.px(x0 - 3, y0, H("#5a6988", 220))
    for x in range(0, 336):
        h = 2 + int(3 * (0.5 + 0.5 * math.sin(x / 9.0)) + rnd.random() * 3)
        for y in range(80 - h, 80):
            c.px(x, y, green)
    c.save("bsm_damp")


def duct():
    """Короб вытяжки под сводом: оцинковка с рёбрами, хомуты, решётки отсоса."""
    c = Canvas(336, 16)
    c.rect(0, 2, 336, 11, STEEL)
    c.hline(0, 2, 336, MIST)
    c.hline(0, 3, 336, PALE)
    c.hline(0, 11, 336, SLATE)
    c.hline(0, 12, 336, NAVY2)
    for x in range(14, 336, 28):
        c.rect(x, 1, 2, 13, SLATE)
        c.vline(x, 1, 13, MIST)
    for x in range(40, 336, 84):
        c.rect(x, 5, 14, 5, NAVY2)
        for xx in range(x + 1, x + 14, 2):
            c.vline(xx, 5, 5, INK)
    c.outline(INK)
    c.save("bsm_duct")


def fan():
    """Вытяжной вентилятор в стене: квадратная рама с болтами и решётка; лопасти — отдельной картинкой."""
    c = Canvas(24, 24)
    c.rect(1, 1, 22, 22, SLATE)
    c.hline(1, 1, 22, MIST)
    c.vline(1, 1, 22, STEEL)
    c.ellipse(12, 12, 9, 9, INK)
    for p in ((3, 3), (20, 3), (3, 20), (20, 20)):
        c.px(*p, MIST)
    c.outline(INK)
    c.save("bsm_fan")
    b = Canvas(20, 20)
    for k in range(4):
        ang = k * math.pi / 2
        for r in range(2, 9):
            for w in (-1, 0, 1, 2):
                a = ang + w * 0.12 + r * 0.03
                b.px(round(10 + r * math.cos(a)), round(10 + r * math.sin(a)), STEEL if w < 2 else SLATE)
    b.ellipse(10, 10, 2, 2, MIST)
    b.px(10, 10, SLATE)
    b.save("bsm_fan_blade")
    # Сетка поверх лопастей рисуется в сцене тонкой окружностью; здесь — только рама.


def _cloud(x, y, seed, n=64):
    """Плавные пятна, бесшовные по плитке n×n: сумма синусов с целыми частотами (−1…1)."""
    rnd = random.Random(seed)
    waves = [(rnd.choice([1, 2]), rnd.choice([-1, 0, 1, 2]), rnd.random() * 6.28) for _ in range(4)]
    return sum(math.sin(2 * math.pi * (kx * x + ky * y) / n + ph) for kx, ky, ph in waves) / len(waves)


def floors():
    """Бетонный пол 64×64 (22.11, было 32×32 с одной трещиной - на весь зал она повторялась узором): четыре плиты
    своего тона с пятнами (матовый бетон, соседние почти одного цвета), щебень, пропил швов (тёмный шов, светлая
    нижняя кромка - свет сверху слева), сколы на стыках, одна тонкая волосяная трещина. Крупные трещины, пятна и трапы
    кладёт сцена отдельными картинками (basement_deco.py). После ремонта - плитка 8×8 в шахматку, у каждой свой тон
    и блик глазури."""
    c = Canvas(64, 64)
    rnd = random.Random(21)
    slabs = {(0, 0): 0.0, (1, 0): 0.035, (0, 1): 0.02, (1, 1): -0.04}
    for y in range(64):
        for x in range(64):
            base = lit(NAVY, slabs[(x // 32, y // 32)])
            v = _cloud(x, y, 5) * 0.5 + 0.5 + (rnd.random() - 0.5) * 0.22
            c.px(x, y, lit(base, 0.045) if v > 0.72 else lit(base, -0.09) if v < 0.26 else base)
    for _ in range(150):
        x, y = rnd.randrange(64), rnd.randrange(64)
        p = c.get(x, y)
        c.px(x, y, lit(p, 0.13) if rnd.random() < 0.55 else lit(p, -0.2))
    for x0, y0 in ((0, 0), (32, 0), (0, 32), (32, 32)):
        c.hline(x0, y0, 32, INK)
        c.vline(x0, y0, 32, INK)
        c.hline(x0 + 1, y0 + 1, 31, lit(c.get(x0 + 4, y0 + 4), 0.1))
        c.vline(x0 + 1, y0 + 1, 31, lit(c.get(x0 + 4, y0 + 4), 0.05))
    # Сколы на стыках плит и волосяная трещина в одной плите.
    for x, y in ((31, 31), (32, 30), (30, 32), (63, 0), (0, 62)):
        c.px(x, y, INK)
    for x, y in ((33, 33), (32, 33)):
        c.px(x, y, lit(NAVY, -0.2))
    hair = lit(NAVY, -0.28)
    for x, y in ((40, 44), (41, 44), (42, 45), (43, 45), (44, 46), (45, 47), (46, 47), (47, 48), (45, 48), (44, 49)):
        c.px(x, y, hair)
    c.save("bsm_floor2")
    t = Canvas(64, 64)
    rt = random.Random(8)
    for ty in range(4):
        for tx in range(4):
            x, y = tx * 16, ty * 16
            tone = BR_D if (tx + ty) % 2 == 0 else NAVY
            tone = lit(tone, rt.choice([0.0, 0.03, -0.04, 0.05]))
            t.rect(x, y, 16, 16, tone)
            t.hline(x + 1, y + 1, 14, lit(tone, 0.16))
            t.vline(x + 1, y + 1, 14, lit(tone, 0.08))
            t.hline(x + 1, y + 14, 14, lit(tone, -0.1))
            t.vline(x + 14, y + 1, 14, lit(tone, -0.06))
            t.hline(x, y + 15, 16, INK)
            t.vline(x + 15, y, 16, INK)
            t.speckle(x + 2, y + 2, 12, 12, [lit(tone, -0.12)], 5, tx * 3 + ty * 7)
            # Блик глазури - точка у верхнего левого угла, не на каждой плитке (иначе по залу рябит узором).
            if (tx * 5 + ty * 3) % 7 == 0:
                t.px(x + 3, y + 3, lit(tone, 0.22))
    # Две плитки с трещинкой - пол живой, а не нарисованный по линейке.
    for x, y in ((37, 6), (38, 7), (38, 8), (39, 9), (8, 41), (9, 41), (10, 42)):
        t.px(x, y, lit(t.get(x, y), -0.3))
    t.save("bsm_floor_fin")


def decals():
    """Затёртое место на полу (полупрозрачное: светлее и с тёмными чирками), лужа с бликами."""
    c = Canvas(48, 20)
    rnd = random.Random(4)
    for y in range(20):
        for x in range(48):
            d = ((x - 24) / 24) ** 2 + ((y - 10) / 10) ** 2
            if d < 1 and rnd.random() < 0.55 * (1 - d) + 0.1:
                c.px(x, y, H("#8b9bb4", 38 + int(30 * (1 - d))))
    for _ in range(9):
        x, y = rnd.randrange(8, 40), rnd.randrange(4, 16)
        c.hline(x, y, rnd.randint(2, 5), H("#181425", 110))
    c.save("bsm_wear")
    p = Canvas(30, 10)
    p.ellipse(15, 5, 14, 4.5, H("#124e89", 150))
    p.ellipse(13, 4.5, 9, 2.5, H("#0099db", 120))
    p.hline(8, 3, 5, H("#c0cbdc", 200))
    p.hline(19, 6, 3, H("#c0cbdc", 160))
    p.save("bsm_puddle")


def slot(kind="base"):
    """Автомат 28×54: корпус винного цвета с золотыми кантами, козырёк-полукруг, экран с тремя барабанами, наклонная
    панель кнопок, ручка сбоку, лоток. lit — только светящееся (козырёк, экран, кнопки, полосы по бокам), win — оно
    же золотым."""
    c = Canvas(28, 54)
    if kind == "base":
        body, body_d, body_l = RED_D, BR_D, PINK
        c.round_rect(2, 6, 22, 47, body, r=2)
        c.vline(2, 8, 44, body_l)
        c.vline(3, 8, 44, lit(body, 0.1))
        c.vline(23, 8, 44, body_d)
        c.vline(22, 8, 44, lit(body, -0.15))
        # Козырёк: полукруглый, золотой кант, внутри — тёмное стекло (светится слоем lit).
        c.ellipse(13, 9, 10, 7, GOLD)
        c.ellipse(13, 9, 8.5, 5.5, INK)
        c.rect(3, 9, 21, 4, body)
        c.hline(3, 9, 21, GOLD)
        # Экран в золотой рамке.
        c.rect(4, 15, 18, 15, GOLD)
        c.rect(5, 16, 16, 13, INK)
        for x in (6, 11, 16):
            c.rect(x, 18, 4, 9, NAVY)
        # Панель кнопок — выступает (светлее сверху, тень снизу).
        c.rect(3, 31, 20, 5, STEEL)
        c.hline(3, 31, 20, MIST)
        c.hline(3, 36, 20, INK)
        for x in (5, 10, 15):
            c.rect(x, 32, 3, 2, NAVY2)
        # Нижняя дверца с замком и лоток.
        c.rect(5, 39, 16, 8, lit(body, -0.12))
        c.frame(5, 39, 16, 8, body_d)
        c.px(18, 42, GOLD)
        c.rect(8, 48, 10, 3, INK)
        c.hline(8, 48, 10, STEEL)
        # Ручка сбоку: шар на штанге.
        c.vline(25, 14, 12, STEEL)
        c.vline(26, 14, 12, SLATE)
        c.ellipse(25.5, 12.5, 2, 2, RED_L)
        c.px(25, 11, PINK_L)
        # Цоколь.
        c.hline(2, 52, 22, INK)
        c.outline(INK)
        shadowed(c, 13, 52, 12, 2.5).save("bsm_slot2")
        return
    win = kind == "win"
    glass = GOLD if win else BLUE
    c.ellipse(13, 9, 8.5, 5.5, GOLD_L if win else HOT)
    c.ellipse(13, 9.5, 6, 3.5, PALE if win else PINK_L)
    c.rect(4, 9, 19, 0, INK)
    for k, x in enumerate(range(6, 21, 3)):
        c.px(x, 4 + (k % 2), PALE)
    c.rect(5, 16, 16, 13, H("#124e89") if not win else ORANGE)
    c.hline(5, 16, 16, glass)
    for x, tone in ((6, GOLD), (11, RED_L), (16, CYAN)):
        c.rect(x, 18, 4, 9, PALE if not win else GOLD_L)
        if win:
            c.rect(x + 1, 21, 2, 3, ORANGE)
        else:
            c.rect(x + 1, 20, 2, 2, tone)
            c.rect(x + 1, 23, 2, 2, tone if x != 11 else GREEN)
    for x, tone in ((5, GOLD_L), (10, GREEN), (15, PINK_L)):
        c.rect(x, 32, 3, 2, GOLD_L if win else tone)
    # Полосы света по бокам корпуса.
    for y in range(9, 50, 3):
        c.px(2, y, GOLD_L if win else CYAN)
        c.px(23, y, GOLD_L if win else CYAN)
    c.save("bsm_slot2_win" if win else "bsm_slot2_lit")


def reels():
    """Барабаны в движении: размытые полосы, два кадра (сцена меняет их, пока человек играет)."""
    for f in range(2):
        c = Canvas(16, 12)
        for k, x in enumerate((1, 6, 11)):
            c.rect(x, 1, 4, 10, PALE)
            for y in range(1, 11):
                if (y + f * 2 + k) % 4 == 0:
                    c.hline(x, y, 4, (GOLD, RED_L, CYAN)[k])
                elif (y + f * 2 + k) % 4 == 1:
                    c.hline(x, y, 4, MIST)
        c.save(f"bsm_reels{f}")


def stool():
    """Барный табурет: красное сиденье с бликом, хромированная ножка, кольцо для ног и крестовина."""
    c = Canvas(12, 16)
    c.ellipse(6, 3, 5, 2.5, RED)
    c.hline(3, 2, 5, RED_L)
    c.hline(2, 5, 8, RED_D)
    c.rect(5, 6, 2, 8, STEEL)
    c.vline(5, 6, 8, MIST)
    c.hline(3, 10, 6, SLATE)
    c.hline(2, 14, 8, NAVY2)
    c.hline(3, 14, 6, SLATE)
    c.outline(INK)
    c.save("bsm_stool")


def bar():
    """Барная стойка 104×40: тёмное дерево, столешница с кромкой и бликом, филёнки, латунная подножка, касса
    и стаканы на стойке, табличка «чай»-самовар не рисуем (сцена ставит кружки людям)."""
    c = Canvas(104, 40)
    # Столешница (видна сверху).
    c.rect(0, 4, 104, 8, BR_L)
    c.hline(0, 4, 104, SAND_D)
    c.hline(2, 5, 100, lit(BR_L, 0.2))
    c.hline(0, 11, 104, BR)
    # Фасад: филёнки.
    c.rect(0, 12, 104, 26, BR)
    for x in range(2, 104, 20):
        c.rect(x, 15, 17, 18, BR_D)
        c.frame(x, 15, 17, 18, lit(BR, -0.25))
        c.hline(x + 1, 16, 15, lit(BR_D, 0.12))
    # Латунная подножка.
    c.hline(0, 34, 104, GOLD)
    c.hline(0, 35, 104, ORANGE)
    for x in range(6, 104, 24):
        c.rect(x, 33, 2, 4, SAND_D)
    c.hline(0, 38, 104, INK)
    # Касса на стойке (справа): корпус, дисплей, ящик.
    c.rect(78, 0, 18, 8, NAVY2)
    c.rect(80, 1, 9, 3, GREEN_D)
    c.hline(81, 2, 5, GREEN)
    c.rect(78, 6, 18, 3, SLATE)
    # Стаканы и банка с печеньем.
    for x in (14, 20):
        c.rect(x, 2, 4, 5, MIST)
        c.vline(x, 2, 5, PALE)
        c.rect(x + 1, 4, 2, 2, ORANGE)
    c.rect(40, 0, 8, 7, H("#9cd8ff") if False else MIST)
    c.rect(41, 1, 6, 1, RED)
    c.rect(41, 3, 6, 3, SAND_D)
    c.px(42, 4, BR)
    c.px(45, 3, BR)
    c.outline(INK)
    shadowed(c, 52, 38, 50, 3).save("bsm_bar")


def bar_back():
    """Шкаф за стойкой 104×52: полки с банками и пачками, чайник и кружки, справа — окошко администратора с решёткой
    и табличкой, слева — щиток с часами."""
    c = Canvas(104, 52)
    c.rect(0, 0, 104, 52, BR_D)
    c.frame(0, 0, 104, 52, INK)
    c.vline(1, 1, 50, BR)
    # Полки.
    rnd = random.Random(3)
    for row, y in enumerate((10, 24, 38)):
        c.rect(2, y, 64, 3, BR)
        c.hline(2, y, 64, BR_L)
        x = 4
        while x < 62:
            kind = rnd.random()
            if kind < 0.4:
                tone = rnd.choice([GOLD, RED_L, GREEN, BLUE, SAND_D])
                c.rect(x, y - 7, 4, 7, tone)
                c.hline(x, y - 7, 4, lit(tone, 0.3))
                c.rect(x + 1, y - 9, 2, 2, MIST)
                x += 6
            elif kind < 0.75:
                tone = rnd.choice([PINK, ORANGE, CYAN, MIST])
                c.rect(x, y - 5, 6, 5, tone)
                c.hline(x, y - 5, 6, lit(tone, 0.3))
                c.hline(x + 1, y - 3, 4, lit(tone, -0.3))
                x += 8
            else:
                x += 3
    # Чайник и кружки на нижней полке справа.
    c.ellipse(56, 46, 5, 4, STEEL)
    c.hline(52, 43, 8, MIST)
    c.rect(60, 44, 3, 2, STEEL)
    # Окошко администратора: рама, стекло, решётка, табличка.
    c.rect(70, 6, 30, 30, SLATE)
    c.rect(72, 8, 26, 22, NAVY)
    c.hline(72, 8, 26, BLUE_D)
    for x in range(75, 98, 5):
        c.vline(x, 8, 22, STEEL)
    c.hline(72, 18, 26, STEEL)
    c.rect(72, 30, 26, 4, BR_L)
    c.hline(72, 30, 26, SAND_D)
    c.rect(76, 38, 20, 7, SAND)
    c.frame(76, 38, 20, 7, BR)
    c.hline(79, 41, 14, BR)
    # Часы.
    c.ellipse(85, 49, 3, 2, MIST)
    c.outline(INK)
    c.save("bsm_bar_back")


def lift():
    """Грузовой лифт в стене 56×72: стальная рама в жёлто-чёрной разметке, двустворчатая дверь, кнопки, табличка.
    Открыт — внутри тёплый свет и пол кабины."""
    for open_ in (False, True):
        c = Canvas(56, 72)
        c.rect(0, 0, 56, 72, SLATE)
        c.hline(0, 0, 56, STEEL)
        # Разметка по раме.
        for x in range(0, 56):
            for y in (2, 3, 4):
                c.px(x, y, GOLD_L if ((x + y) // 4) % 2 == 0 else INK)
        for y in range(5, 72):
            for x in (2, 3, 52, 53):
                c.px(x, y, GOLD_L if ((x + y) // 4) % 2 == 0 else INK)
        c.rect(5, 6, 46, 66, INK)
        if open_:
            c.rect(6, 7, 44, 65, H("#3a4466"))
            c.rect(6, 7, 44, 10, H("#feae34"))
            c.rect(8, 8, 40, 7, GOLD_L)
            c.rect(6, 58, 44, 14, STEEL)
            for x in range(8, 50, 6):
                c.vline(x, 58, 14, SLATE)
            c.hline(6, 58, 44, MIST)
            # Створки — в стороны (тонкими полосками).
            c.rect(5, 6, 4, 66, STEEL)
            c.rect(47, 6, 4, 66, STEEL)
        else:
            for x0 in (6, 28):
                c.rect(x0, 7, 22, 65, STEEL)
                c.vline(x0, 7, 65, MIST)
                for y in range(14, 70, 10):
                    c.hline(x0 + 2, y, 18, SLATE)
                    c.hline(x0 + 2, y + 1, 18, MIST)
            c.vline(27, 7, 65, INK)
            c.vline(28, 7, 65, SLATE)
        c.outline(INK)
        c.save("bsm_lift_open" if open_ else "bsm_lift")


def cold():
    """Холодильник-склад 88×100 у правой стены (вид сверху-сбоку): крыша из сэндвич-панелей с компрессором и
    вентилятором, фасад — белые панели со швами, тяжёлая дверь с инеем, ручкой и полосовой завесой, синее табло.
    open — дверь отъехала вправо, внутри синий свет, пар, видны паллеты."""
    for open_ in (False, True):
        c = Canvas(88, 100)
        # Крыша.
        c.rect(0, 10, 88, 22, MIST)
        for x in range(0, 88, 11):
            c.vline(x, 10, 22, STEEL)
        c.hline(0, 10, 88, PALE)
        c.hline(0, 31, 88, SLATE)
        # Компрессор на крыше: короб с решёткой вентилятора.
        c.rect(52, 0, 30, 20, SLATE)
        c.hline(52, 0, 30, STEEL)
        c.ellipse(67, 10, 7, 7, INK)
        for k in range(4):
            a = k * math.pi / 2 + 0.4
            c.line(67, 10, round(67 + 6 * math.cos(a)), round(10 + 6 * math.sin(a)), STEEL)
        c.rect(56, 16, 4, 3, INK)
        c.vline(84, 4, 28, NAVY2)
        # Фасад: панели.
        c.rect(0, 32, 88, 66, MIST)
        for x in range(0, 88, 22):
            c.vline(x, 32, 66, STEEL)
            c.vline(x + 1, 32, 66, PALE)
        c.hline(0, 32, 88, PALE)
        c.rect(0, 92, 88, 6, STEEL)
        c.hline(0, 92, 88, SLATE)
        # Дверь (или проём).
        dx, dy, dw, dh = 14, 40, 40, 58
        if open_:
            c.rect(dx, dy, dw, dh, BLUE_D)
            c.rect(dx + 2, dy + 2, dw - 4, dh - 2, H("#0099db"))
            c.rect(dx + 2, dy + 2, dw - 4, 6, CYAN)
            # Паллеты внутри (силуэты) и пар.
            for k, x in enumerate((dx + 4, dx + 20)):
                c.rect(x, dy + 30 - k * 4, 14, 18 + k * 4, BLUE_D)
                c.hline(x, dy + 30 - k * 4, 14, H("#2ce8f5"))
            for y in range(dy + 46, dy + dh):
                for x in range(dx + 2, dx + dw - 2):
                    if (x * 7 + y * 3) % 5 == 0:
                        c.px(x, y, PALE)
            # Отъехавшая створка — справа, поверх панелей.
            c.rect(dx + dw - 2, dy - 2, 20, dh + 2, PALE)
            c.frame(dx + dw - 2, dy - 2, 20, dh + 2, STEEL)
            c.rect(dx + dw + 2, dy + 26, 3, 8, NAVY2)
        else:
            c.rect(dx, dy, dw, dh, PALE)
            c.frame(dx, dy, dw, dh, STEEL)
            c.rect(dx + 2, dy + 2, dw - 4, dh - 4, MIST)
            # Иней по краям двери.
            rnd = random.Random(2)
            for _ in range(70):
                x = dx + 2 + rnd.randrange(dw - 4)
                y = dy + 2 + rnd.randrange(dh - 4)
                edge = min(x - dx, dx + dw - x, y - dy) < 6
                if edge:
                    c.px(x, y, PALE)
            # Полосовая завеса просвечивает через окно.
            c.rect(dx + 12, dy + 8, 16, 10, BLUE_D)
            c.frame(dx + 12, dy + 8, 16, 10, STEEL)
            for x in range(dx + 14, dx + 28, 3):
                c.vline(x, dy + 9, 8, H("#0099db"))
            # Ручка-рычаг и щеколда.
            c.rect(dx + dw - 8, dy + 24, 4, 14, NAVY2)
            c.vline(dx + dw - 8, dy + 24, 14, SLATE)
            c.rect(dx + dw - 11, dy + 28, 3, 4, INK)
        # Табло с температурой (светится сценой) и табличка-снежинка.
        c.rect(60, 44, 20, 9, INK)
        c.rect(61, 45, 18, 7, NAVY)
        for x in (63, 67, 72, 76):
            c.rect(x, 46, 2, 5, H("#2ce8f5"))
        c.ellipse(70, 64, 6, 6, BLUE)
        for k in range(3):
            a = k * math.pi / 3
            c.line(round(70 - 4 * math.cos(a)), round(64 - 4 * math.sin(a)), round(70 + 4 * math.cos(a)), round(64 + 4 * math.sin(a)), PALE)
        c.outline(INK)
        shadowed(c, 44, 98, 44, 3).save("bsm_cold2_open" if open_ else "bsm_cold2")


def pallet():
    """Паллета с коробками в стрейч-плёнке (блики плёнки по углам) и тележка-рохля: вилы, колёса, ручка."""
    c = Canvas(36, 30)
    c.rect(2, 23, 32, 5, BR_L)
    c.hline(2, 23, 32, SAND_D)
    for x in (2, 16, 30):
        c.rect(x, 26, 4, 3, BR)
    for tier, (y, n) in enumerate(((14, 3), (5, 3))):
        for i in range(n):
            x = 3 + i * 10
            tone = SAND_D if (i + tier) % 2 else lit(SAND_D, -0.1)
            c.rect(x, y, 10, 9, tone)
            c.hline(x, y, 10, SAND)
            c.vline(x, y, 9, lit(tone, -0.25))
            c.hline(x + 2, y + 4, 6, BR_L)
    for y in range(5, 23, 2):
        c.px(3, y, H("#ffffff", 150))
        c.px(32, y + 1, H("#ffffff", 120))
    c.hline(3, 9, 30, H("#c0cbdc", 120))
    c.outline(INK)
    shadowed(c, 18, 28, 17, 2).save("bsm_pallet")
    j = Canvas(30, 16)
    # Ручка слева (за ней идёт грузчик), вилы вправо.
    j.rect(3, 1, 2, 9, RED)
    j.rect(1, 0, 6, 2, INK)
    j.rect(4, 8, 6, 4, RED_L)
    j.hline(4, 8, 6, PINK_L)
    j.rect(10, 10, 19, 2, STEEL)
    j.hline(10, 10, 19, MIST)
    j.ellipse(7, 13, 2, 2, INK)
    j.px(26, 13, INK)
    j.px(18, 13, INK)
    j.outline(INK)
    j.save("bsm_jack")


def pawn():
    """Ломбард в подвале 112×84 (15.11, автор: «в подвале его держать как комнату в подвале со своей вывеской»):
    кирпичная будка с широким окном. Над окном — световой короб вывески (слово пишет сцена: на любом языке) и справа
    на кронштейне три золотых шара — старый знак ломбарда. В окне — задняя стенка с двумя полками (вещи ставит сцена:
    сверху на продажу с ценником, снизу в залоге). Решётка, прилавок и низ будки — отдельным слоем поверх вещей
    и ломбардщика (bsm_pawn_bars): он стоит за прилавком, видно голову и плечи."""
    c = Canvas(112, 84)
    # Крыша будки (тёмная, видна сверху).
    c.rect(0, 0, 112, 8, NAVY)
    c.hline(0, 0, 112, NAVY2)
    c.hline(0, 7, 112, INK)
    brick_wall(c, 0, 8, 112, 74, 21, tone=BR, hi=BR_L)
    # Световой короб вывески: тёмное поле в латунной рамке, по краю — тёплая подсветка.
    c.rect(6, 10, 72, 14, INK)
    c.rect(7, 11, 70, 12, RED_D)
    c.rect(8, 12, 68, 10, lit(RED_D, -0.25))
    c.hline(8, 12, 68, lit(RED_D, 0.15))
    c.frame(6, 10, 72, 14, GOLD)
    c.hline(7, 10, 70, GOLD_L)
    for x in (9, 74):
        c.px(x, 13, GOLD_L)
        c.px(x, 20, GOLD_L)
    # Кронштейн и три золотых шара на цепочках.
    c.hline(82, 9, 24, STEEL)
    c.hline(82, 10, 24, SLATE)
    c.vline(105, 9, 4, SLATE)
    for bx, by in ((88, 20), (100, 20), (94, 26)):
        c.vline(bx, 11, by - 13, STEEL)
        c.ellipse(bx + 0.5, by, 3.6, 3.6, ORANGE)
        c.ellipse(bx, by - 0.5, 2.8, 2.8, GOLD)
        c.px(bx - 1, by - 2, GOLD_L)
        c.px(bx, by - 2, PALE)
    # Окно: глубокий проём, задняя стенка из досок, две полки.
    c.rect(4, 28, 92, 40, INK)
    c.rect(6, 30, 88, 36, BR_D)
    for x in range(14, 94, 12):
        c.vline(x, 30, 36, lit(BR_D, -0.18))
    c.hline(6, 30, 88, lit(BR_D, -0.3))
    for y in (38, 52):
        c.rect(6, y, 88, 3, BR_L)
        c.hline(6, y, 88, SAND_D)
        c.hline(6, y + 3, 88, lit(BR_D, -0.3))
    # Настольная лампа в углу окна (свет — пятном сцены).
    c.rect(86, 44, 6, 2, GREEN_D)
    c.hline(86, 44, 6, GREEN)
    c.vline(88, 46, 6, STEEL)
    # Цоколь.
    c.rect(0, 80, 112, 4, NAVY2)
    c.hline(0, 80, 112, SLATE)
    c.outline(INK)
    out = shadowed(c, 56, 83, 56, 3)
    out.save("bsm_pawn")
    # Поверх вещей и ломбардщика: решётка над верхней полкой (вещи на продажу), ниже — открытое окошко, где стоит
    # ломбардщик; прилавок и низ будки.
    b = Canvas(112, 84)
    b.img.paste(out.img.crop((0, 60, 112, 84)), (0, 60))
    for x in range(10, 94, 7):
        b.vline(x, 30, 11, STEEL)
        b.vline(x + 1, 30, 11, SLATE)
    b.hline(4, 33, 92, STEEL)
    b.hline(4, 40, 92, STEEL)
    b.hline(4, 41, 92, SLATE)
    # Прилавок: столешница, передняя доска, звонок и раскрытая книга залогов.
    b.rect(2, 60, 96, 4, BR_L)
    b.hline(2, 60, 96, SAND)
    b.rect(2, 64, 96, 5, BR)
    b.hline(2, 68, 96, BR_D)
    for x in range(8, 96, 16):
        b.vline(x, 64, 5, BR_D)
    b.ellipse(14, 59, 2.4, 1.6, GOLD)
    b.px(14, 57, GOLD_L)
    b.rect(62, 58, 10, 2, PALE)
    b.vline(67, 58, 2, STEEL)
    b.save("bsm_pawn_bars")


def lounge():
    """Уголок отдыха: старый диван с пледом и телевизор на тумбе (экран светится отдельным слоем)."""
    c = Canvas(64, 32)
    c.rect(2, 4, 60, 14, BR)
    c.hline(2, 4, 60, BR_L)
    c.rect(0, 10, 8, 18, BR)
    c.rect(56, 10, 8, 18, BR)
    c.hline(0, 10, 8, BR_L)
    c.hline(56, 10, 8, BR_L)
    c.rect(8, 16, 48, 10, lit(BR, 0.08))
    c.hline(8, 16, 48, BR_L)
    c.vline(32, 16, 10, BR_D)
    c.rect(2, 26, 60, 3, BR_D)
    # Плед в клетку.
    for y in range(6, 24):
        for x in range(40, 52):
            if (x // 3 + y // 3) % 2 == 0:
                c.px(x, y, GREEN_D)
            elif (x + y) % 3 == 0:
                c.px(x, y, GOLD)
    c.rect(4, 29, 3, 2, BR_D)
    c.rect(57, 29, 3, 2, BR_D)
    c.outline(INK)
    shadowed(c, 32, 30, 31, 2.5).save("bsm_sofa")
    t = Canvas(30, 34)
    t.rect(1, 18, 28, 15, BR)
    t.hline(1, 18, 28, BR_L)
    t.rect(4, 22, 10, 8, BR_D)
    t.rect(16, 22, 10, 8, BR_D)
    t.rect(4, 2, 22, 17, SLATE)
    t.hline(4, 2, 22, STEEL)
    t.rect(6, 4, 16, 12, INK)
    t.rect(23, 6, 2, 2, RED_L)
    t.rect(23, 10, 2, 2, NAVY2)
    t.line(10, 1, 7, -2, STEEL)
    t.line(18, 1, 21, -2, STEEL)
    t.outline(INK)
    shadowed(t, 15, 32, 14, 2).save("bsm_tv")
    s = Canvas(30, 34)
    s.rect(6, 4, 16, 12, H("#3e8948"))
    s.rect(6, 4, 16, 6, H("#0099db"))
    s.hline(6, 10, 16, PALE)
    s.rect(12, 11, 2, 2, PALE)
    s.rect(9, 7, 4, 1, PALE)
    s.save("bsm_tv_lit")


def neon():
    """Неон: большая вывеска над автоматами — вишенка, звезда, молния и волна трубками (розовый, голубой, жёлтый) на
    тёмной подложке с креплениями; маленькая розовая стрелка вниз у лестницы."""
    c = Canvas(124, 36)
    c.round_rect(0, 2, 124, 32, H("#181425", 200), r=3)
    for x in (4, 119):
        for y in (5, 29):
            c.px(x, y, STEEL)

    def tube(points, tone, core):
        for (x0, y0), (x1, y1) in zip(points, points[1:]):
            for dx, dy in ((0, 0), (1, 0), (0, 1)):
                c.line(x0 + dx, y0 + dy, x1 + dx, y1 + dy, tone)
            c.line(x0, y0, x1, y1, core)

    # Вишенка: две ягоды и черенки.
    for cx in (12, 22):
        for k in range(16):
            a = k * math.pi / 8
            x, y = round(cx + 4 * math.cos(a)), round(24 + 4 * math.sin(a))
            c.px(x, y, HOT)
            c.px(x + 1, y, HOT)
        c.ellipse(cx, 24, 2, 2, PINK_L)
    tube([(12, 20), (18, 9), (22, 20)], GREEN, PALE)
    tube([(18, 9), (24, 8)], GREEN, PALE)
    # Звезда.
    pts = []
    for k in range(11):
        r = 11 if k % 2 == 0 else 5
        a = -math.pi / 2 + k * math.pi / 5
        pts.append((round(50 + r * math.cos(a)), round(18 + r * math.sin(a))))
    tube(pts, GOLD, GOLD_L)
    # Молния.
    tube([(80, 6), (72, 19), (79, 19), (73, 30)], CYAN, PALE)
    # Волна.
    wave = [(90 + i * 3, 18 + round(5 * math.sin(i * 1.1))) for i in range(10)]
    tube(wave, PINK, PINK_L)
    c.save("bsm_neon_big")
    s = Canvas(24, 22)
    s.round_rect(0, 0, 24, 22, H("#181425", 200), r=2)
    for (x0, y0), (x1, y1) in (((12, 3), (12, 16)), ((6, 11), (12, 17)), ((18, 11), (12, 17))):
        s.line(x0, y0, x1, y1, HOT)
        s.line(x0 + 1, y0, x1 + 1, y1, PINK_L)
    s.save("bsm_neon_small")


def guard():
    """Охрана: камера на кронштейне (красный глазок светится сценой), стойка поста с журналом и лампой."""
    c = Canvas(16, 12)
    c.rect(1, 2, 3, 6, SLATE)
    c.rect(3, 3, 10, 6, MIST)
    c.hline(3, 3, 10, PALE)
    c.hline(3, 8, 10, STEEL)
    c.rect(12, 4, 3, 4, NAVY2)
    c.px(13, 5, CYAN)
    c.px(5, 5, RED_L)
    c.outline(INK)
    c.save("bsm_cam")
    p = Canvas(26, 26)
    p.rect(1, 8, 24, 16, NAVY2)
    p.hline(1, 8, 24, SLATE)
    p.rect(0, 5, 26, 4, BR_L)
    p.hline(0, 5, 26, SAND_D)
    p.rect(3, 2, 9, 4, SAND)
    p.hline(4, 3, 7, BR)
    p.vline(20, 0, 6, STEEL)
    p.rect(18, 0, 5, 2, GOLD)
    p.rect(4, 12, 18, 2, NAVY)
    p.rect(9, 16, 8, 5, BLUE_D)
    p.px(12, 18, CYAN)
    p.outline(INK)
    shadowed(p, 13, 24, 12, 2).save("bsm_post")


def icons():
    """Значки строк «Этажей» (ui/floors.ts): неоновая звезда на тёмной подложке и вентилятор с лопастями."""
    c = Canvas(26, 26)
    c.round_rect(0, 0, 26, 26, INK, r=3)
    pts = []
    for k in range(11):
        r = 10 if k % 2 == 0 else 4
        a = -math.pi / 2 + k * math.pi / 5
        pts.append((round(13 + r * math.cos(a)), round(14 + r * math.sin(a))))
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        c.line(x0, y0, x1, y1, HOT)
        c.line(x0 + 1, y0, x1 + 1, y1, PINK_L)
    c.save("bsm_ico_neon")
    f = Canvas(24, 24)
    f.rect(1, 1, 22, 22, SLATE)
    f.hline(1, 1, 22, MIST)
    f.vline(1, 1, 22, STEEL)
    f.ellipse(12, 12, 9, 9, INK)
    for k in range(4):
        ang = k * math.pi / 2 + 0.3
        for r in range(2, 9):
            for w in (-1, 0, 1):
                a = ang + w * 0.13 + r * 0.03
                f.px(round(12 + r * math.cos(a)), round(12 + r * math.sin(a)), STEEL)
    f.ellipse(12, 12, 2, 2, MIST)
    f.outline(INK)
    f.save("bsm_ico_fan")


def lamp():
    """Лампа в сетке-клетке под сводом: патрон, колба, проволочная клетка."""
    c = Canvas(12, 10)
    c.rect(5, 0, 2, 2, NAVY2)
    c.ellipse(6, 5.5, 3.5, 3.5, GOLD_L)
    c.ellipse(6, 5, 2, 2, PALE)
    for x in (2, 6, 9):
        c.vline(x, 2, 7, SLATE)
    c.hline(3, 9, 6, SLATE)
    c.save("bsm_lamp")


if __name__ == "__main__":
    wall()
    damp()
    duct()
    fan()
    floors()
    decals()
    slot("base")
    slot("lit")
    slot("win")
    reels()
    stool()
    bar()
    bar_back()
    lift()
    cold()
    pallet()
    pawn()
    lounge()
    neon()
    guard()
    lamp()
    icons()
