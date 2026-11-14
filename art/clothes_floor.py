"""Второй этаж — магазин одежды: вход с улицы и мелочи (src/scenes/clothesFx.ts, src/scenes/floors/secondFloor.ts).

13.11 (задача автора #64 «Второй этаж: магазин одежды»): с улицы — дверь с лестницей наверх и витрина с платьем
в фасаде у левого угла зала; розовый пакет бутика, бирка распродажи и паутинка на уценке. 14.11 сам зал этажа
(обои, паркет, окна, стойки, примерочные, зеркало, касса, лестница, стол уценки) перерисован «как настоящий зал» —
art/clothes_art.py; прежние картинки зала отсюда убраны. Палитра Endesga 32, двойная детализация (в мире вдвое
меньше).

    python3 art/clothes_floor.py

Картинки:
  fl2_bag           10×12 — розовый бумажный пакет с ручками (в руке у покупателя);
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
    bag()
    sale()
    web()
    front()
