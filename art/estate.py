"""Скупать улицу (src/game/estate.ts, src/scenes/estateFx.ts): вывески лавок на первых этажах домов за магазином,
табличка «Продаётся», заграждение на время отделки и табличка с названием улицы на столбе.

13.11 (задача автора «Скупать улицу»): дома за магазином продают первые этажи. Купил — над входом вывеска арендатора
(свой цвет и знак: крест аптеки, кружка бара, мишка детского клуба, гантель спортзала, цветок, сапожок), не купил —
во дворике стоит «Продаётся»; пока арендатор отделывает помещение, у входа козлы в полоску. Выкупил всю улицу — у
входа в магазин столб с синей табличкой, как на настоящих улицах. Надписи — текстом игры (семь языков), здесь
только доски и знаки. Палитра Endesga 32, двойная детализация (в мире вдвое меньше).

    python3 art/estate.py

Картинки:
  estate_sign_<вид>  84×18 — доска вывески: знак в светлом круге слева, справа — место под надпись;
  estate_sale        44×30 — табличка «Продаётся» на двух ножках: красная рамка, белое поле;
  estate_works       36×16 — козлы в красно-белую полоску;
  estate_plate       64×60 — синяя табличка с белой рамкой на сером столбе;
  estate_pointer    100×64 — указатель на том же столбе, пока улица не вся наша: светлая доска в деревянной рамке,
                     слева красная стрелка вверх (к задней улице), справа — место под значки лавок и «Продаётся».
"""

from premium import H, lit
from sprites import Canvas, shadowed

WHITE, PALE, CREAM = H("#ffffff"), H("#c0cbdc"), H("#ead4aa")
RED, RED_D = H("#e43b44"), H("#a22633")
DARK, INK = H("#262b44"), H("#181425")
GREY, GREY_D, GREY_L = H("#8b9bb4"), H("#5a6988"), H("#c0cbdc")
GREEN, GREEN_D = H("#3e8948"), H("#265c42")
AMBER, AMBER_L = H("#feae34"), H("#fee761")
WOOD, WOOD_D, WOOD_L = H("#733e39"), H("#3b2a35"), H("#b86f50")
PINK, PINK_D, PINK_L = H("#b55088"), H("#68386c"), H("#f6757a")
BLUE, BLUE_D, BLUE_L = H("#124e89"), H("#262b44"), H("#0099db")
ROSE = H("#f6757a")
BROWN, BROWN_L = H("#8f563b"), H("#c28569")
TEDDY, TEDDY_D = H("#c28569"), H("#8f563b")
LEAF = H("#63c74d")

# Доска вывески: цвет, тень и блик по виду лавки.
BOARDS = {
    "pharmacy": (GREEN, GREEN_D),
    "bar": (WOOD, WOOD_D),
    "kids": (PINK, PINK_D),
    "gym": (BLUE, BLUE_D),
    "florist": (H("#e43b44"), RED_D),
    "shoes": (BROWN, WOOD_D),
}


def cross(c, x, y):
    """Зелёный аптечный крест."""
    c.rect(x + 4, y + 1, 4, 10, GREEN)
    c.rect(x + 1, y + 4, 10, 4, GREEN)
    c.vline(x + 4, y + 1, 10, lit(GREEN, 0.3))


def mug(c, x, y):
    """Кружка пива с пеной и ручкой."""
    c.rect(x + 2, y + 4, 7, 8, AMBER)
    c.vline(x + 3, y + 5, 6, AMBER_L)
    c.rect(x + 1, y + 2, 9, 3, WHITE)
    c.px(x + 2, y + 1, WHITE)
    c.px(x + 6, y + 1, WHITE)
    c.rect(x + 9, y + 5, 2, 1, PALE)
    c.rect(x + 10, y + 5, 1, 5, PALE)
    c.rect(x + 9, y + 9, 2, 1, PALE)


def teddy(c, x, y):
    """Плюшевый мишка: уши, мордочка, пузо."""
    c.ellipse(x + 3, y + 2.5, 1.6, 1.6, TEDDY)
    c.ellipse(x + 9, y + 2.5, 1.6, 1.6, TEDDY)
    c.ellipse(x + 6, y + 5, 3.5, 3, TEDDY)
    c.ellipse(x + 6, y + 9.5, 3.5, 2.5, TEDDY_D)
    c.ellipse(x + 6, y + 6, 1.5, 1, CREAM)
    c.px(x + 4, y + 4, INK)
    c.px(x + 8, y + 4, INK)
    c.px(x + 6, y + 6, INK)


def dumbbell(c, x, y):
    """Гантель: гриф и блины."""
    c.rect(x + 3, y + 5, 6, 2, GREY)
    c.rect(x + 1, y + 2, 3, 8, DARK)
    c.rect(x + 8, y + 2, 3, 8, DARK)
    c.vline(x + 1, y + 2, 8, GREY_D)
    c.vline(x + 8, y + 2, 8, GREY_D)


def flower(c, x, y):
    """Цветок: пять лепестков, жёлтая серединка, стебель с листом."""
    for dx, dy in ((0, -2.5), (2.5, -0.5), (1.5, 2), (-1.5, 2), (-2.5, -0.5)):
        c.ellipse(x + 6 + dx, y + 4 + dy, 1.7, 1.7, ROSE)
    c.ellipse(x + 6, y + 4, 1.2, 1.2, AMBER_L)
    c.vline(x + 6, y + 7, 5, GREEN)
    c.rect(x + 7, y + 9, 2, 1, LEAF)


def boot(c, x, y):
    """Сапожок с каблуком."""
    c.rect(x + 3, y + 1, 4, 8, BROWN)
    c.rect(x + 3, y + 8, 8, 3, BROWN)
    c.vline(x + 4, y + 2, 6, BROWN_L)
    c.hline(x + 3, y + 11, 8, WOOD_D)
    c.rect(x + 3, y + 11, 2, 1, INK)
    c.hline(x + 3, y + 1, 4, BROWN_L)


MARKS = {"pharmacy": cross, "bar": mug, "kids": teddy, "gym": dumbbell, "florist": flower, "shoes": boot}


def sign(kind):
    """Вывеска лавки 84×18 (в мире 42×9): доска своего цвета, знак в светлом круге слева, крепления сверху."""
    board, shade = BOARDS[kind]
    c = Canvas(84, 18)
    c.round_rect(0, 1, 84, 16, board, r=2)
    c.hline(2, 1, 80, lit(board, 0.3))
    c.hline(2, 15, 80, shade)
    c.hline(2, 16, 80, lit(shade, -0.2))
    # Рамка-кант светлее доски: вывеска читается и на тёмном фасаде.
    c.frame(2, 3, 80, 12, lit(board, 0.18))
    # Знак — в светлом круге.
    c.ellipse(10, 9, 7, 7, WHITE)
    MARKS[kind](c, 4, 3)
    c.outline("k")
    c.save(f"estate_sign_{kind}")


def sale():
    """«Продаётся» 44×30 (в мире 22×15): белое поле в красной рамке, две ножки, тень."""
    c = Canvas(44, 30)
    for x in (9, 33):
        c.rect(x, 17, 3, 10, WOOD_L)
        c.vline(x + 2, 17, 10, WOOD)
    c.rect(1, 1, 42, 18, RED)
    c.hline(1, 1, 42, lit(RED, 0.3))
    c.rect(3, 3, 38, 14, WHITE)
    c.hline(3, 16, 38, PALE)
    c.outline("k")
    shadowed(c, 22, 27, 16, 2).save("estate_sale")


def works():
    """Козлы-заграждение 36×16 (в мире 18×8): перекладина в красно-белую полоску на двух ножках."""
    c = Canvas(36, 16)
    for x in (4, 29):
        c.line(x, 6, x - 2, 14, GREY_D)
        c.line(x + 2, 6, x + 4, 14, GREY_D)
    c.rect(1, 2, 34, 5, WHITE)
    for x in range(1, 35, 6):
        c.rect(x, 2, 3, 5, RED)
    c.hline(1, 6, 34, lit(RED, -0.3))
    c.outline("k")
    shadowed(c, 18, 14, 15, 2).save("estate_works")


def plate():
    """Табличка улицы на столбе 64×60 (в мире 32×30): синяя, белая рамка, столб серый, внизу — тень."""
    c = Canvas(64, 60)
    c.rect(30, 14, 4, 42, GREY)
    c.vline(30, 14, 42, GREY_L)
    c.vline(33, 14, 42, GREY_D)
    c.rect(29, 54, 6, 3, GREY_D)
    c.round_rect(1, 1, 62, 16, BLUE, r=2)
    c.frame(3, 3, 58, 12, WHITE)
    c.hline(4, 4, 56, lit(BLUE, 0.2))
    c.outline("k")
    shadowed(c, 32, 57, 8, 2).save("estate_plate")


def pointer():
    """Указатель 100×64 (в мире 50×32) у перехода: помещения — за магазином, в обычном кадре их не видно, а купленное
    и сданное должно где-то показываться (13.11, ревью). Доска крупнее таблички улицы: на ней две строки (значки лавок
    и «Продаётся»), а в большом зале камера дальше. Столб — как у таблички: потом на нём повесят её."""
    c = Canvas(100, 64)
    c.rect(48, 28, 4, 32, GREY)
    c.vline(48, 28, 32, GREY_L)
    c.vline(51, 28, 32, GREY_D)
    c.rect(47, 58, 6, 3, GREY_D)
    c.round_rect(1, 1, 98, 28, WOOD_L, r=2)
    c.hline(2, 2, 96, lit(WOOD_L, 0.25))
    c.rect(3, 3, 94, 24, CREAM)
    c.hline(3, 26, 94, lit(CREAM, -0.15))
    # Стрелка вверх: к задней улице, через магазин.
    c.rect(8, 12, 4, 11, RED)
    for row in range(6):
        c.hline(10 - row, 6 + row, 1 + 2 * row + 1, RED)
    c.vline(8, 12, 11, lit(RED, 0.3))
    c.outline("k")
    shadowed(c, 50, 61, 8, 2).save("estate_pointer")


if __name__ == "__main__":
    for kind in BOARDS:
        sign(kind)
    sale()
    works()
    plate()
    pointer()
