"""Фудкорт на третьем этаже (src/game/foodcourt.ts, src/scenes/foodcourtView.ts, src/scenes/foodcourtFx.ts).

13.11 (задача автора #65 «Третий этаж: фудкорт»): светлый зал над магазином. Задняя стена — панорамные окна на
крыши района, вдоль неё — точки еды (пицца, шаурма с грилем, суши, кофе с десертами), в зале — общие столы со
скамьями. Внизу, в фасаде слева, — стеклянный лифт «наверх». Палитра Endesga 32, двойная детализация (в мире вдвое
меньше), как у подвала (art/basement.py).

    python3 art/foodcourt.py

Картинки:
  fc_floor    32×32 — светлая плитка зала (плитка пола);
  fc_wall     32×88 — панорамное окно: рама, небо, крыши района (плитка задней стены);
  fc_pizza    52×60 — точка «Пицца»: красная вывеска, печь с огнём, на стойке — пицца;
  fc_grill    52×60 — точка «Шаурма и гриль»: оранжевая вывеска, вертел, на стойке — лаваши;
  fc_sushi    52×60 — точка «Суши»: синяя вывеска, фонарик, на стойке — роллы;
  fc_coffee   52×60 — точка «Кофе и десерты»: коричневая вывеска, кофемашина, на стойке — пирожные;
  fc_shutter  44×24 — опущенные жалюзи поверх стойки (точка закрыта по жалобе);
  fc_table    44×30 — общий стол со скамьями спереди и сзади;
  fc_food0…3  10×8  — еда на столе: кусок пиццы, шаурма, роллы, чашка кофе;
  fc_balloons 20×34 — связка шариков (день рождения);
  fc_lift     24×30 — вход на фудкорт с улицы: стеклянный лифт в фасаде слева, стрелка «вверх», вывеска.
"""

from premium import H, lit
from sprites import Canvas, shadowed

INK = H("#181425")
WHITE, PALE = H("#ffffff"), H("#c0cbdc")
CREAM, SAND = H("#ead4aa"), H("#e4a672")
METAL, METAL_D, METAL_L = H("#5a6988"), H("#3a4466"), H("#8b9bb4")
WOOD, WOOD_D, WOOD_L = H("#b86f50"), H("#733e39"), H("#e4a672")
RED, RED_D = H("#e43b44"), H("#a22633")
ORANGE, GOLD, GOLD_L = H("#f77622"), H("#feae34"), H("#fee761")
BLUE, BLUE_D, SKY, CYAN = H("#0099db"), H("#124e89"), H("#2ce8f5"), H("#2ce8f5")
GREEN, GREEN_D = H("#63c74d"), H("#3e8948")
BROWN, BROWN_D = H("#733e39"), H("#3e2731")
PINK, PURPLE = H("#f6757a"), H("#b55088")


def floor():
    """Светлая плитка: крупные квадраты с тонким швом и редкой крошкой терраццо — зал чистый, не рябит."""
    c = Canvas(32, 32)
    c.rect(0, 0, 32, 32, CREAM)
    c.hline(0, 0, 32, lit(SAND, -0.05))
    c.vline(0, 0, 32, lit(SAND, -0.05))
    c.hline(1, 1, 31, lit(CREAM, 0.35))
    c.speckle(2, 2, 29, 29, [SAND, PALE, lit(CREAM, -0.12)], 14, 65)
    c.save("fc_floor")


def wall():
    """Панорамное окно: металлическая рама сверху и снизу, стойка слева; за стеклом — небо и крыши района."""
    c = Canvas(32, 88)
    # Небо сверху светлеет к горизонту.
    for y in range(4, 64):
        t = (y - 4) / 60
        c.hline(0, y, 32, lit(BLUE, t * 0.55))
    # Крыши района: силуэты домов разной высоты, кое-где окна.
    tops = [(0, 46, 9), (9, 40, 7), (16, 50, 6), (22, 43, 10)]
    for x, top, w in tops:
        c.rect(x, top, w, 64 - top, METAL)
        c.hline(x, top, w, METAL_L)
        for wy in range(top + 4, 62, 5):
            for wx in range(x + 2, x + w - 1, 3):
                c.px(wx, wy, GOLD_L if (wx + wy) % 4 == 0 else METAL_D)
    # Облачко.
    c.rect(18, 14, 8, 2, WHITE)
    c.rect(20, 12, 4, 2, WHITE)
    # Блик на стекле наискосок.
    for i in range(10):
        c.px(4 + i, 30 - i, lit(BLUE, 0.75))
    # Рама: стойка, верх, подоконник и стена под окном.
    c.rect(0, 0, 32, 4, METAL_D)
    c.hline(0, 3, 32, METAL_L)
    c.rect(0, 0, 2, 64, METAL_D)
    c.vline(1, 0, 64, METAL_L)
    c.rect(0, 64, 32, 3, METAL_L)
    c.hline(0, 66, 32, METAL_D)
    c.rect(0, 67, 32, 21, lit(CREAM, -0.1))
    c.hline(0, 67, 32, lit(CREAM, -0.3))
    c.hline(0, 86, 32, lit(SAND, -0.2))
    c.hline(0, 87, 32, lit(SAND, -0.35))
    c.save("fc_wall")


def stall_base(c, sign, sign_d, counter):
    """Каркас точки: вывеска сверху, задняя стенка, стойка с цветной полосой."""
    # Вывеска.
    c.round_rect(2, 0, 48, 13, sign, r=2)
    c.hline(4, 1, 44, lit(sign, 0.3))
    c.hline(3, 12, 46, sign_d)
    # Задняя стенка (кафель).
    c.rect(4, 13, 44, 20, WHITE)
    for y in range(17, 33, 4):
        c.hline(4, y, 44, PALE)
    for x in range(8, 48, 6):
        c.vline(x, 13, 20, lit(PALE, 0.4))
    # Боковины.
    c.rect(2, 13, 2, 45, METAL_D)
    c.rect(48, 13, 2, 45, METAL_D)
    # Стойка: столешница и фасад с полосой цвета точки.
    c.rect(2, 33, 48, 4, METAL_L)
    c.hline(2, 33, 48, WHITE)
    c.rect(3, 37, 46, 21, counter)
    c.hline(3, 37, 46, lit(counter, -0.35))
    c.rect(3, 44, 46, 4, sign)
    c.hline(3, 44, 46, lit(sign, 0.3))
    c.hline(3, 57, 46, lit(counter, -0.4))


def finish_stall(c, name):
    c.outline(INK)
    shadowed(c, 26, 58, 25, 2).save(name)


def pizza():
    c = Canvas(52, 60)
    stall_base(c, RED, RED_D, WOOD)
    # Значок на вывеске: кусок пиццы.
    c.stamp(["yyyyyyy", ".yRyyR.", "..yyy..", "..yRy..", "...y...", "...y..."], 8, 3)
    for x in range(18, 44, 3):
        c.rect(x, 5, 2, 3, WHITE)
    # Печь: кирпичная арка с огнём.
    c.round_rect(16, 15, 20, 17, H("#a22633"), r=4)
    for y in range(17, 31, 3):
        c.hline(17, y, 18, lit(RED_D, -0.25))
    c.round_rect(20, 21, 12, 10, INK, r=3)
    c.rect(22, 26, 8, 5, ORANGE)
    c.rect(24, 24, 4, 3, GOLD)
    c.px(25, 23, GOLD_L)
    # На стойке — пицца.
    c.ellipse(13, 34, 7, 2.2, GOLD)
    c.ellipse(13, 34, 5.5, 1.6, H("#feae34"))
    for x, y in ((10, 34), (14, 33), (16, 35)):
        c.px(x, y, RED)
    c.ellipse(38, 34, 6, 2, GOLD)
    c.px(37, 34, RED)
    c.px(40, 34, GREEN)
    finish_stall(c, "fc_pizza")


def grill():
    c = Canvas(52, 60)
    stall_base(c, ORANGE, H("#a22633"), BROWN)
    # Значок: шаурма в лаваше.
    c.stamp([".NNN.", "NBNBN", "NeNRN", "NNNNN", ".NNN."], 8, 4)
    for x in range(17, 44, 3):
        c.rect(x, 5, 2, 3, WHITE)
    # Вертел с мясом и решётка гриля.
    c.vline(16, 14, 19, METAL)
    c.round_rect(12, 16, 9, 15, WOOD, r=2)
    for y in range(18, 30, 3):
        c.hline(13, y, 7, WOOD_D)
    c.vline(13, 17, 13, WOOD_L)
    c.rect(26, 22, 18, 9, METAL_D)
    for x in range(27, 44, 3):
        c.vline(x, 22, 9, INK)
    c.rect(28, 19, 3, 3, ORANGE)
    c.rect(34, 18, 3, 4, GOLD)
    c.rect(39, 19, 3, 3, ORANGE)
    # На стойке — лаваши.
    for x in (10, 22, 34):
        c.rect(x, 32, 8, 3, CREAM)
        c.hline(x, 32, 8, WHITE)
        c.px(x + 3, 33, GREEN)
        c.px(x + 5, 33, RED)
    finish_stall(c, "fc_grill")


def sushi():
    c = Canvas(52, 60)
    stall_base(c, BLUE_D, H("#262b44"), H("#262b44"))
    # Значок: ролл.
    c.ellipse(11, 6.5, 4, 4, INK)
    c.ellipse(11, 6.5, 3, 3, WHITE)
    c.ellipse(11, 6.5, 1.4, 1.4, ORANGE)
    for x in range(19, 45, 3):
        c.rect(x, 5, 2, 3, WHITE)
    # Красные фонарики и доска с меню.
    for x in (12, 40):
        c.vline(x, 13, 3, INK)
        c.round_rect(x - 3, 16, 7, 8, RED, r=2)
        c.hline(x - 2, 18, 5, RED_D)
        c.hline(x - 2, 21, 5, RED_D)
    c.rect(19, 15, 14, 12, INK)
    for y in (17, 20, 23):
        c.hline(21, y, 10, PALE)
    # На стойке — роллы на доске.
    c.rect(8, 33, 18, 3, WOOD_L)
    for x in (10, 14, 18, 22):
        c.rect(x, 31, 3, 3, WHITE)
        c.px(x + 1, 32, ORANGE)
    c.rect(31, 33, 14, 3, WOOD_L)
    for x in (33, 37, 41):
        c.rect(x, 31, 3, 2, PINK)
        c.hline(x, 33, 3, WHITE)
    finish_stall(c, "fc_sushi")


def coffee():
    c = Canvas(52, 60)
    stall_base(c, BROWN, BROWN_D, WOOD_D)
    # Значок: чашка с паром.
    c.rect(7, 5, 7, 5, WHITE)
    c.rect(14, 6, 2, 2, WHITE)
    c.hline(7, 5, 7, WOOD_L)
    c.px(9, 2, PALE)
    c.px(11, 3, PALE)
    c.px(10, 1, PALE)
    for x in range(19, 45, 3):
        c.rect(x, 5, 2, 3, CREAM)
    # Кофемашина и полка с банками.
    c.rect(12, 16, 16, 16, METAL)
    c.hline(12, 16, 16, METAL_L)
    c.rect(14, 19, 12, 4, INK)
    c.px(16, 20, GREEN)
    c.px(18, 20, RED)
    c.rect(17, 25, 6, 3, METAL_D)
    c.rect(18, 29, 4, 3, WHITE)
    c.rect(32, 20, 14, 2, WOOD_D)
    for x, tone in ((33, BROWN), (37, GOLD), (41, BROWN)):
        c.rect(x, 16, 3, 4, tone)
        c.hline(x, 16, 3, lit(tone, 0.3))
    # На стойке — пирожные под колпаком и стаканчики.
    c.rect(8, 32, 14, 3, WHITE)
    for x, tone in ((9, PINK), (13, GOLD), (17, H("#b86f50"))):
        c.rect(x, 30, 3, 2, tone)
        c.px(x + 1, 29, RED)
    for x in (32, 36, 40):
        c.rect(x, 30, 3, 4, WHITE)
        c.hline(x, 31, 3, WOOD)
    finish_stall(c, "fc_coffee")


def shutter():
    """Опущенные жалюзи над стойкой: серые рейки, замок посередине — точка сегодня закрыта."""
    c = Canvas(44, 24)
    c.rect(0, 0, 44, 24, METAL)
    for y in range(0, 24, 3):
        c.hline(0, y, 44, METAL_L)
        c.hline(0, y + 2, 44, METAL_D)
    c.rect(19, 18, 6, 5, GOLD)
    c.rect(20, 16, 4, 2, METAL_D)
    c.outline(INK)
    c.save("fc_shutter")


def table():
    """Общий стол: столешница светлого дерева, передний край, ножки; скамьи — сзади (узкая) и спереди."""
    c = Canvas(44, 30)
    # Скамья сзади (видна узкой полосой за столом).
    c.rect(4, 0, 36, 3, WOOD_D)
    c.hline(4, 0, 36, WOOD)
    # Столешница и край.
    c.round_rect(1, 4, 42, 12, WOOD_L, r=2)
    c.hline(3, 5, 38, lit(WOOD_L, 0.35))
    c.rect(1, 16, 42, 3, WOOD)
    c.hline(1, 18, 42, WOOD_D)
    # Ножки.
    for x in (4, 38):
        c.rect(x, 19, 2, 4, WOOD_D)
    # Скамья спереди.
    c.rect(3, 23, 38, 3, WOOD)
    c.hline(3, 23, 38, WOOD_L)
    for x in (5, 37):
        c.rect(x, 26, 2, 3, WOOD_D)
    c.outline(INK)
    shadowed(c, 22, 28, 21, 2).save("fc_table")


def food():
    """Еда на столе: кусок пиццы, шаурма, роллы на дощечке, чашка кофе — по одной картинке."""
    rows = [
        ["...........", "..yyyyyy...", "..yRyyRy...", "...yyyy....", "....yR.....", ".....y....."],
        ["...........", "..NNNNNN...", ".NBeBRBN...", "..NNNNNN...", "...........", "..........."],
        ["...........", ".wwwwwwww..", ".wowwowwo..", ".BBBBBBBB..", "...........", "..........."],
        ["....W......", "...W.......", "..wwwww....", "..wbbbww...", "..wwwww....", ".WWWWWWW..."],
    ]
    for i, r in enumerate(rows):
        c = Canvas(10, 8)
        c.stamp(r, 0, 1)
        c.outline(INK)
        c.save(f"fc_food{i}")


def balloons():
    """Связка шариков: красный, жёлтый, голубой и розовый, ниточки сходятся к узелку внизу."""
    c = Canvas(20, 34)
    for cx, cy, tone in ((6, 7, RED), (14, 6, GOLD), (10, 12, SKY), (4, 15, PINK)):
        c.ellipse(cx, cy, 3.6, 4.4, tone)
        c.px(int(cx) - 1, int(cy) - 2, lit(tone, 0.6))
        c.px(int(cx), int(cy + 4.5), lit(tone, -0.3))
    for x0, y0 in ((6, 12), (14, 11), (10, 17), (4, 20)):
        c.line(x0, y0, 10, 31, PALE)
    c.rect(9, 31, 3, 2, METAL_D)
    c.outline(INK)
    c.save("fc_balloons")


def lift():
    """Вход на фудкорт с улицы — стеклянный лифт в фасаде: вывеска-козырёк, стеклянные створки, стрелка «вверх»."""
    c = Canvas(24, 30)
    c.rect(0, 0, 24, 5, ORANGE)
    c.hline(0, 0, 24, GOLD)
    c.hline(0, 4, 24, H("#a22633"))
    # Кусочек пиццы на козырьке.
    c.stamp(["yyyyy", ".yRy.", "..y.."], 2, 1)
    c.rect(1, 5, 22, 25, METAL_L)
    c.rect(3, 6, 18, 24, METAL)
    # Стеклянные створки: голубое стекло, блик, щель посередине.
    c.rect(4, 7, 16, 23, BLUE_D)
    c.rect(4, 7, 16, 2, lit(BLUE, 0.2))
    for i in range(6):
        c.px(6 + i, 22 - i * 2, lit(BLUE, 0.6))
    c.vline(12, 7, 23, INK)
    # Табло со стрелкой вверх.
    c.rect(9, 9, 7, 6, INK)
    c.stamp(["..Y..", ".YYY.", "YYYYY", "..Y.."], 10, 10)
    c.outline(INK)
    c.save("fc_lift")


if __name__ == "__main__":
    floor()
    wall()
    pizza()
    grill()
    sushi()
    coffee()
    shutter()
    table()
    food()
    balloons()
    lift()
