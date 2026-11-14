"""Второй этаж — магазин одежды (src/game/clothes.ts, src/scenes/clothesFloor.ts, src/scenes/clothesFx.ts).

13.11 (задача автора #64 «Второй этаж: магазин одежды»): светлый зал над магазином — обои, паркет, окна на улицу,
стойки с одеждой по сезону, примерочная с занавеской, зеркало и своя касса. С улицы — дверь с лестницей наверх и
витрина с платьем в фасаде у левого угла зала. Палитра Endesga 32, двойная детализация (в мире вдвое меньше).

    python3 art/clothes_floor.py

Картинки:
  fl2_wall          32×32 — обои задней стены (плитка);
  fl2_floor         32×32 — паркет (плитка пола);
  fl2_window        36×30 — окно на улицу со шторами;
  fl2_stairs        48×56 — лестничный проём снизу: ступени уходят вниз, перила;
  fl2_rack          44×40 — пустая стойка-вешалка на колёсиках;
  fl2_rack_warm     44×40 — стойка с куртками и шапками;
  fl2_rack_rain     44×40 — стойка с плащами, дождевиками и зонтами;
  fl2_rack_summer   44×40 — стойка с футболками и шортами;
  fl2_fitting       40×56 — примерочная: занавеска сдвинута, внутри табурет и крючок;
  fl2_fitting_shut  40×56 — примерочная: занавеска задёрнута (внутри кто-то меряет);
  fl2_mirror        18×44 — напольное зеркало в золочёной раме;
  fl2_till          52×30 — касса этажа: стойка, кассовый аппарат, пакеты;
  fl2_bag           10×12 — розовый бумажный пакет с ручками (в руке у покупателя);
  fl2_bin           40×28 — стол уценки: куча сложенных вещей прошлого сезона;
  fl2_sale          18×14 — красная бирка «%» над столом распродажи;
  fl2_web           12×12 — паутинка: остатки пылятся;
  fl2_front         40×30 — с улицы: витрина с платьем и стеклянная дверь с лестницей наверх, под розовым козырьком.
"""

from premium import H, lit
from sprites import Canvas, shadowed

INK = H("#181425")
CREAM, SAND, PEACH, TAN = H("#ead4aa"), H("#e4a672"), H("#e8b796"), H("#c28569")
WOOD, WOOD_D, WOOD_DD = H("#b86f50"), H("#733e39"), H("#3e2731")
METAL, METAL_D, METAL_L = H("#8b9bb4"), H("#5a6988"), H("#c0cbdc")
PINK, PINK_D, PLUM = H("#f6757a"), H("#b55088"), H("#68386c")
RED, RED_D = H("#e43b44"), H("#a22633")
GOLD, GOLD_L, ORANGE = H("#feae34"), H("#fee761"), H("#f77622")
GREEN, GREEN_D, GREEN_L = H("#3e8948"), H("#265c42"), H("#63c74d")
NAVY, NAVY_L, BLUE, CYAN, DEEP = H("#262b44"), H("#3a4466"), H("#0099db"), H("#2ce8f5"), H("#124e89")
WHITE = H("#ffffff")


def wall():
    """Обои: тёплый кремовый фон, узкие полосы с ромбиками — уютно, как в маленьком бутике."""
    c = Canvas(32, 32)
    c.rect(0, 0, 32, 32, CREAM)
    for x in (0, 16):
        c.vline(x + 6, 0, 32, PEACH)
        c.vline(x + 9, 0, 32, PEACH)
        for y in range(2, 32, 8):
            c.px(x + 7, y, TAN)
            c.px(x + 8, y, TAN)
            c.px(x + 7, y + 1, PINK)
            c.px(x + 8, y + 1, PINK)
    c.save("fl2_wall")


def floor():
    """Паркет: светлые доски вдоль зала со сдвинутыми стыками, светлая кромка и шов — зал светлый, пол не рябит."""
    c = Canvas(32, 32)
    c.rect(0, 0, 32, 32, PEACH)
    for row in range(4):
        y = row * 8
        c.hline(0, y, 32, TAN)
        c.hline(0, y + 1, 32, lit(PEACH, 0.2))
        joint = (row * 11 + 5) % 32
        c.vline(joint, y + 1, 7, TAN)
        c.speckle(0, y + 2, 32, 6, [lit(PEACH, -0.06), lit(PEACH, 0.1)], 10, 40 + row)
    c.save("fl2_floor")


def window():
    """Окно на улицу: белая рама, небо со бликом, по бокам — розовые шторы, внизу подоконник."""
    c = Canvas(36, 30)
    c.rect(4, 0, 28, 26, WHITE)
    c.rect(6, 2, 24, 22, BLUE)
    c.rect(6, 2, 24, 9, CYAN)
    c.vline(18, 2, 22, WHITE)
    c.hline(6, 12, 24, WHITE)
    for i in range(5):
        c.px(9 + i, 8 - i, WHITE)
        c.px(22 + i, 21 - i, lit(CYAN, 0.4))
    # Шторы складками.
    for x0 in (0, 29):
        c.rect(x0, 0, 7, 28, PINK)
        c.vline(x0 + 2, 1, 26, PINK_D)
        c.vline(x0 + 5, 1, 26, PINK_D)
    c.rect(2, 26, 32, 3, METAL_L)
    c.hline(2, 28, 32, METAL)
    c.outline(INK)
    c.save("fl2_window")


def stairs():
    """Проём лестницы снизу: ступени уходят вниз, к нижнему краю темнее; перила по трём сторонам."""
    c = Canvas(48, 56)
    c.rect(4, 4, 40, 50, INK)
    for i in range(6):
        y = 6 + i * 8
        tone = lit(SAND, -0.1 - i * 0.14)
        c.rect(6, y, 36, 7, tone)
        c.hline(6, y, 36, lit(tone, 0.3))
        c.hline(6, y + 6, 36, lit(tone, -0.35))
    # Перила: поручень сверху и по бокам, стойки.
    c.rect(2, 2, 44, 2, METAL)
    c.hline(2, 2, 44, METAL_L)
    for x in (2, 44):
        c.rect(x, 2, 2, 52, METAL)
        c.vline(x, 2, 52, METAL_L)
    for x in (12, 24, 36):
        c.vline(x, 0, 4, METAL_D)
    c.outline(INK)
    c.save("fl2_stairs")


def rack_frame(c):
    """Стойка: две ножки на колёсиках и хромированная перекладина наверху."""
    for x in (3, 40):
        c.vline(x, 4, 32, METAL_D)
        c.vline(x + 1, 4, 32, METAL)
        c.hline(x - 2, 35, 6, METAL_D)
        c.px(x - 2, 37, INK)
        c.px(x + 3, 37, INK)
        c.px(x - 2, 36, NAVY_L)
        c.px(x + 3, 36, NAVY_L)
    c.rect(2, 3, 41, 2, METAL)
    c.hline(2, 3, 41, METAL_L)


def hanger(c, x):
    """Плечики: крючок над перекладиной и треугольник под ней."""
    c.px(x, 1, METAL_D)
    c.px(x, 2, METAL_D)
    c.px(x - 1, 5, METAL_D)
    c.px(x + 1, 5, METAL_D)


def jacket(c, x, tone):
    """Пуховик: стёганые полосы, мех на капюшоне, молния посередине."""
    hanger(c, x)
    c.rect(x - 3, 5, 7, 3, CREAM)
    c.px(x, 6, lit(CREAM, -0.3))
    c.rect(x - 3, 8, 7, 18, tone)
    c.vline(x - 3, 8, 18, lit(tone, -0.45))
    c.vline(x + 3, 8, 18, lit(tone, -0.3))
    for y in (12, 17, 22):
        c.hline(x - 2, y, 5, lit(tone, -0.3))
    c.vline(x, 8, 18, lit(tone, 0.35))


def hat(c, x, tone):
    """Вязаная шапка с помпоном на крючке."""
    c.px(x, 1, METAL_D)
    c.vline(x, 2, 4, METAL_D)
    c.rect(x - 1, 6, 3, 2, WHITE)
    c.rect(x - 3, 8, 7, 6, tone)
    c.hline(x - 3, 8, 7, lit(tone, 0.3))
    for xx in range(x - 3, x + 4, 2):
        c.vline(xx, 9, 4, lit(tone, -0.2))
    c.rect(x - 3, 14, 7, 2, lit(tone, -0.35))


def trench(c, x, tone):
    """Плащ: длинный, с поясом и пуговицами."""
    hanger(c, x)
    c.rect(x - 3, 5, 7, 24, tone)
    c.vline(x - 3, 6, 23, lit(tone, -0.45))
    c.vline(x + 3, 6, 23, lit(tone, -0.25))
    c.hline(x - 3, 14, 7, WOOD_D)
    c.px(x - 1, 9, WOOD_D)
    c.px(x + 1, 9, WOOD_D)
    c.px(x - 1, 18, WOOD_D)
    c.px(x + 1, 18, WOOD_D)
    c.rect(x - 2, 5, 5, 2, lit(tone, 0.3))


def umbrella(c, x, tone):
    """Сложенный зонт висит на ручке-крючке."""
    c.px(x, 1, WOOD_D)
    c.px(x + 1, 2, WOOD_D)
    c.px(x - 1, 2, WOOD_D)
    c.vline(x, 5, 3, WOOD_D)
    for i in range(12):
        w = 3 if i < 9 else 1
        c.hline(x - w // 2, 8 + i, w, tone if i % 3 else lit(tone, -0.3))
    c.px(x, 20, METAL_L)


def tshirt(c, x, tone):
    """Футболка: рукава в стороны, ворот."""
    hanger(c, x)
    c.rect(x - 4, 6, 9, 3, tone)
    c.rect(x - 3, 9, 7, 11, tone)
    c.vline(x - 3, 9, 11, lit(tone, -0.35))
    c.px(x, 6, lit(tone, -0.4))
    c.hline(x - 3, 19, 7, lit(tone, -0.25))
    c.vline(x + 3, 9, 8, lit(tone, -0.2))


def shorts(c, x, tone):
    """Шорты на прищепках."""
    c.px(x - 2, 4, METAL_D)
    c.px(x + 2, 4, METAL_D)
    c.rect(x - 3, 5, 7, 5, tone)
    c.rect(x - 3, 10, 3, 6, tone)
    c.rect(x + 1, 10, 3, 6, tone)
    c.vline(x - 3, 5, 11, lit(tone, -0.35))
    c.hline(x - 3, 5, 7, lit(tone, -0.3))


def rack(kind=None):
    c = Canvas(44, 40)
    rack_frame(c)
    xs = (8, 15, 22, 29, 36)
    if kind is None:
        for x in xs:
            hanger(c, x)
    elif kind == "warm":
        for x, (fn, tone) in zip(xs, ((jacket, NAVY_L), (hat, RED), (jacket, RED_D), (jacket, GREEN), (hat, BLUE))):
            fn(c, x, tone)
    elif kind == "rain":
        for x, (fn, tone) in zip(xs, ((trench, SAND), (umbrella, DEEP), (trench, GOLD), (umbrella, RED), (trench, TAN))):
            fn(c, x, tone)
    else:
        for x, (fn, tone) in zip(xs, ((tshirt, PINK), (shorts, BLUE), (tshirt, GOLD_L), (tshirt, GREEN_L), (shorts, WOOD))):
            fn(c, x, tone)
    c.outline(INK)
    shadowed(c, 22, 37, 20, 2).save(f"fl2_rack_{kind}" if kind else "fl2_rack")


def fitting(shut=False):
    """Примерочная: деревянная кабинка, карниз, внутри табурет, крючок и маленькое зеркало; занавеска — сдвинута или задёрнута."""
    c = Canvas(40, 56)
    c.rect(1, 2, 38, 52, WOOD)
    c.rect(4, 5, 32, 47, CREAM)
    c.vline(1, 2, 52, lit(WOOD, 0.25))
    c.vline(38, 2, 52, WOOD_D)
    # Внутри: зеркальце, крючок с вещью, табурет, коврик.
    c.rect(24, 10, 8, 14, METAL_L)
    c.frame(23, 9, 10, 16, GOLD)
    c.px(26, 13, WHITE)
    c.px(27, 12, WHITE)
    c.px(9, 10, METAL_D)
    c.rect(7, 11, 5, 9, PINK)
    c.rect(10, 38, 10, 3, WOOD_D)
    c.vline(11, 41, 6, WOOD_D)
    c.vline(18, 41, 6, WOOD_D)
    c.rect(6, 47, 28, 4, PLUM)
    # Карниз.
    c.rect(0, 0, 40, 3, METAL)
    c.hline(0, 0, 40, METAL_L)
    if shut:
        c.rect(3, 3, 34, 50, PINK_D)
        for x in range(5, 36, 4):
            c.vline(x, 4, 49, PLUM)
            c.vline(x + 1, 4, 49, lit(PINK_D, 0.25))
        # Из-под занавески видны ноги.
        c.rect(14, 51, 3, 3, NAVY)
        c.rect(22, 51, 3, 3, NAVY)
    else:
        c.rect(3, 3, 7, 50, PINK_D)
        for x in (4, 7):
            c.vline(x, 4, 49, PLUM)
        c.hline(3, 30, 7, GOLD)
    c.outline(INK)
    shadowed(c, 20, 54, 19, 2).save("fl2_fitting_shut" if shut else "fl2_fitting")


def mirror():
    """Напольное зеркало: овал в золочёной раме, блик наискось, подставка."""
    c = Canvas(18, 44)
    c.ellipse(9, 17, 8, 16, GOLD)
    c.ellipse(9, 17, 6.5, 14.5, METAL_L)
    c.ellipse(9, 20, 5, 10, METAL)
    for i in range(6):
        c.px(5 + i, 12 - i, WHITE)
        c.px(6 + i, 13 - i, WHITE)
    c.vline(9, 33, 8, WOOD_D)
    c.hline(4, 41, 11, WOOD_D)
    c.outline(INK)
    shadowed(c, 9, 42, 7, 2).save("fl2_mirror")


def till():
    """Касса этажа: деревянная стойка, кассовый аппарат с экранчиком, стопка розовых пакетов, вешалка с биркой."""
    c = Canvas(52, 30)
    c.rect(1, 10, 50, 18, WOOD_D)
    c.rect(1, 10, 50, 4, SAND)
    c.hline(1, 10, 50, CREAM)
    for x in range(6, 50, 10):
        c.vline(x, 15, 12, WOOD_DD)
    # Аппарат.
    c.rect(30, 2, 14, 9, NAVY_L)
    c.rect(32, 3, 7, 3, CYAN)
    c.rect(32, 7, 10, 2, METAL)
    c.rect(40, 0, 3, 3, NAVY)
    # Пакеты.
    for i, tone in enumerate((PINK, PINK_D, PINK)):
        c.rect(6 + i, 4 - i, 10, 7, tone)
        c.hline(9 + i, 2 - i, 4, PLUM)
    c.rect(20, 7, 6, 3, WHITE)
    c.px(22, 8, RED)
    c.outline(INK)
    shadowed(c, 26, 28, 25, 2).save("fl2_till")


def bag():
    """Пакет из бутика: розовый, с тёмными ручками."""
    c = Canvas(10, 12)
    c.rect(1, 4, 8, 8, PINK)
    c.vline(8, 4, 8, PINK_D)
    c.hline(1, 4, 8, lit(PINK, 0.3))
    c.px(3, 1, PLUM)
    c.px(6, 1, PLUM)
    c.vline(2, 2, 2, PLUM)
    c.vline(7, 2, 2, PLUM)
    c.hline(3, 0, 4, PLUM)
    c.px(4, 7, WHITE)
    c.outline(INK)
    c.save("fl2_bag")


def bin_():
    """Стол уценки: столешница на ножках, на ней ворох сложенных вещей разных цветов."""
    c = Canvas(40, 28)
    c.rect(2, 14, 36, 4, SAND)
    c.hline(2, 14, 36, CREAM)
    c.rect(2, 18, 36, 3, WOOD)
    for x in (4, 34):
        c.rect(x, 21, 2, 6, WOOD_D)
    pile = ((6, 9, BLUE), (13, 8, GOLD), (20, 7, GREEN_L), (27, 9, PINK), (9, 5, RED), (17, 4, SAND), (24, 5, NAVY_L), (14, 1, CYAN))
    for x, y, tone in pile:
        c.rect(x, y, 8, 5, tone)
        c.hline(x, y, 8, lit(tone, 0.3))
        c.hline(x, y + 4, 8, lit(tone, -0.3))
    c.outline(INK)
    shadowed(c, 20, 26, 18, 2).save("fl2_bin")


def sale():
    """Бирка распродажи: красная, с белым «%» и верёвочкой."""
    c = Canvas(18, 14)
    c.rect(2, 3, 15, 10, RED)
    c.px(1, 7, RED)
    c.hline(2, 3, 15, lit(RED, 0.3))
    c.px(3, 7, WHITE)
    c.stamp(["1...1", "...1.", "..1..", ".1...", "1...1"], 8, 5)
    c.vline(9, 0, 3, CREAM)
    c.outline(INK)
    c.save("fl2_sale")


def web():
    """Паутинка в углу: нити из угла и две дуги."""
    c = Canvas(12, 12)
    for i in range(12):
        c.px(i, 0, METAL_L)
        c.px(0, i, METAL_L)
        if i < 10:
            c.px(i, i, METAL_L)
    for x, y in ((4, 1), (3, 2), (2, 3), (1, 4), (8, 1), (8, 3), (7, 5), (5, 7), (3, 8), (1, 8)):
        c.px(x, y, METAL)
    c.save("fl2_web")


def front():
    """С улицы: розовый полосатый козырёк, слева витрина с манекеном в платье, справа стеклянная дверь — за ней
    ступени вверх (к верху светлее: наверху зал залит светом)."""
    c = Canvas(40, 30)
    c.rect(0, 0, 40, 5, PINK)
    for x in range(0, 40, 6):
        c.rect(x, 0, 3, 5, WHITE)
    c.hline(0, 5, 40, PINK_D)
    c.rect(1, 6, 38, 24, METAL_L)
    # Витрина: тёплый свет, манекен в платье, плечики.
    c.rect(3, 8, 18, 20, SAND)
    c.rect(3, 8, 18, 4, GOLD_L)
    c.ellipse(12, 12, 2, 2, CREAM)
    c.rect(9, 14, 7, 4, PINK_D)
    c.rect(8, 18, 9, 7, PINK_D)
    c.vline(12, 14, 11, PLUM)
    c.vline(12, 25, 3, WOOD_D)
    c.px(5, 10, METAL_D)
    c.rect(4, 11, 3, 6, CYAN)
    c.px(19, 10, METAL_D)
    c.rect(18, 11, 3, 6, GOLD)
    # Дверь: стекло, за ним ступени вверх.
    c.rect(23, 7, 14, 23, METAL)
    for i in range(5):
        y = 9 + i * 4
        tone = lit(SAND, 0.3 - i * 0.12)
        c.rect(25, y, 10, 4, tone)
        c.hline(25, y + 3, 10, lit(tone, -0.3))
    c.vline(35, 13, 6, GOLD)
    c.outline(INK)
    c.save("fl2_front")


if __name__ == "__main__":
    wall()
    floor()
    window()
    stairs()
    for kind in (None, "warm", "rain", "summer"):
        rack(kind)
    fitting()
    fitting(shut=True)
    mirror()
    till()
    bag()
    bin_()
    sale()
    web()
    front()
