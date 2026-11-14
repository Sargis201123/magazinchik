"""Жители района (src/game/residents.ts, src/scenes/streets.ts): переезд у подъезда и пустые квартиры.

13.11 (задача автора «Жители приезжают и уезжают»): в день переезда у дома на задней улице стоит грузовик с мебелью,
рядом — гора коробок; в окнах пустых квартир висит табличка «Сдаётся». Вид сверху, как машины (sprites.py cars):
кабина справа, кузов слева, задние двери распахнуты. Палитра Endesga 32, двойная детализация (в мире вдвое меньше).

    python3 art/residents.py

Картинки:
  res_truck  92×40 — мебельный фургон сверху: синяя кабина, светлый кузов с оранжевой полосой, двери открыты;
  res_boxes  40×26 — коробки, свёрнутый ковёр и торшер на тротуаре;
  res_rent   12×9  — листок «Сдаётся» в окне: белый, красная рамка, строчки (букв не разобрать — и не надо).
"""

from premium import H, lit
from sprites import Canvas, shadowed

BLUE, BLUE_D, BLUE_L = H("#0099db"), H("#124e89"), H("#2ce8f5")
CREAM, CREAM_D = H("#ead4aa"), H("#c0a888")
WHITE, PALE = H("#ffffff"), H("#c0cbdc")
ORANGE, ORANGE_D = H("#f77622"), H("#be4a2f")
CARD, CARD_D, CARD_L = H("#c28569"), H("#8f563b"), H("#e4a672")
TAPE = H("#e4a672")
RED, RED_D = H("#e43b44"), H("#a22633")
DARK, INK = H("#262b44"), H("#181425")
GREEN, GREEN_D = H("#3e8948"), H("#265c42")
YELLOW = H("#fee761")
GLASS, GLASS_L = H("#3a4466"), H("#8b9bb4")


def truck():
    """Мебельный фургон сверху 92×40 (в мире 46×20). Едет вправо; задние двери (слева) распахнуты вверх и вниз."""
    c = Canvas(92, 40)
    # Колёса — тёмные полоски по бокам, как у машин улицы.
    for x in (16, 30, 70):
        c.rect(x, 5, 9, 3, INK)
        c.rect(x, 32, 9, 3, INK)
    # Кузов: светлый короб с рёбрами жёсткости на крыше и оранжевой полосой.
    c.rect(8, 6, 56, 28, CREAM)
    c.hline(8, 6, 56, WHITE)
    c.hline(8, 32, 56, CREAM_D)
    c.hline(8, 33, 56, lit(CREAM_D, -0.2))
    for x in range(14, 62, 8):
        c.vline(x, 8, 24, lit(CREAM, -0.08))
    c.rect(8, 17, 56, 6, ORANGE)
    c.hline(8, 17, 56, lit(ORANGE, 0.25))
    c.hline(8, 22, 56, ORANGE_D)
    # На полосе — диванчик: знак «переезд» читается и без букв.
    c.rect(30, 18, 12, 2, WHITE)
    c.rect(29, 18, 2, 4, WHITE)
    c.rect(41, 18, 2, 4, WHITE)
    c.rect(31, 20, 10, 2, PALE)
    # Открытые задние двери: створки торчат вверх и вниз от заднего края.
    for y0, y1 in ((0, 6), (34, 40)):
        c.rect(4, y0, 5, y1 - y0, CREAM_D)
        c.vline(4, y0, y1 - y0, WHITE)
    # Тёмная щель кузова сзади: двери распахнуты, видно нутро.
    c.rect(6, 8, 3, 24, DARK)
    # Кабина: синяя, лобовое стекло справа, зеркала.
    c.round_rect(65, 7, 23, 26, BLUE, r=3)
    c.hline(66, 7, 21, BLUE_L)
    c.hline(66, 32, 21, BLUE_D)
    c.rect(66, 9, 8, 22, lit(BLUE, -0.12))
    c.rect(79, 9, 6, 22, GLASS)
    c.vline(81, 10, 6, GLASS_L)
    c.rect(77, 4, 3, 3, BLUE_D)
    c.rect(77, 33, 3, 3, BLUE_D)
    # Фары.
    c.rect(86, 9, 2, 4, YELLOW)
    c.rect(86, 27, 2, 4, YELLOW)
    c.outline("k")
    shadowed(c, 46, 36, 44, 3.5).save("res_truck")


def box(c, x, y, w, h, tape=True):
    """Картонная коробка: верх светлее, бок темнее, скотч по середине."""
    c.rect(x, y, w, h, CARD)
    c.rect(x, y, w, 3, CARD_L)
    c.rect(x, y + h - 2, w, 2, CARD_D)
    if tape:
        c.vline(x + w // 2, y, 3, TAPE)
        c.vline(x + w // 2, y, 3, lit(TAPE, 0.2))


def boxes():
    """Гора вещей у подъезда 40×26 (в мире 20×13): коробки в два яруса, свёрнутый ковёр и торшер."""
    c = Canvas(40, 26)
    # Торшер: ножка и абажур.
    c.vline(35, 6, 17, DARK)
    c.rect(33, 22, 5, 2, DARK)
    c.rect(31, 2, 9, 5, YELLOW)
    c.hline(31, 2, 9, lit(YELLOW, 0.3))
    c.hline(31, 6, 9, ORANGE)
    # Ковёр рулоном вдоль низа.
    c.rect(2, 19, 26, 5, RED)
    c.hline(2, 19, 26, lit(RED, 0.3))
    c.hline(2, 23, 26, RED_D)
    for x in range(5, 27, 5):
        c.vline(x, 20, 3, YELLOW)
    c.ellipse(2, 21, 2, 2.5, RED_D)
    # Коробки: две внизу, одна сверху.
    box(c, 3, 9, 12, 10)
    box(c, 16, 10, 12, 9)
    box(c, 8, 1, 11, 9)
    # Цветок в горшке на коробке — новоселье.
    c.rect(22, 6, 4, 4, ORANGE_D)
    c.ellipse(24, 4, 3, 2.5, GREEN)
    c.px(23, 3, lit(GREEN, 0.3))
    c.px(25, 5, GREEN_D)
    c.outline("k")
    shadowed(c, 20, 24, 18, 2).save("res_boxes")


def rent_sign():
    """Листок «Сдаётся» 12×9 (в мире 6×4,5): белый, красная рамка, строчки — висит в окне пустой квартиры."""
    c = Canvas(12, 9)
    c.rect(0, 0, 12, 9, RED)
    c.rect(1, 1, 10, 7, WHITE)
    c.hline(2, 2, 8, RED_D)
    c.hline(2, 4, 6, DARK)
    c.hline(2, 6, 7, DARK)
    c.save("res_rent")


if __name__ == "__main__":
    truck()
    boxes()
    rent_sign()
