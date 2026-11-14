"""Подвал (src/game/basement.ts, src/scenes/floorView.ts, src/scenes/basementFx.ts): тёмный кирпичный зал под магазином.

13.11 (задача автора #63 «Подвал со своей экосистемой»): первый из этажей здания. Наверху у правой стены зала —
спуск в подвал (приямок с перилами), к нему с улицы идут завсегдатаи автоматов. Внизу — кирпич, бетонный пол,
лестница сверху, игровые автоматы у стены, склад-холодильник и «серая» подсобка ломбарда.
Палитра Endesga 32, двойная детализация (в мире вдвое меньше).

    python3 art/basement.py

Картинки:
  bsm_brick    32×32 — кирпичная кладка подвала (плитка задней стены);
  bsm_floor    32×32 — бетонный пол плитами (плитка пола);
  bsm_stairs   56×84 — лестница сверху вниз вдоль левой стены, с перилами;
  bsm_slot     24×44 — игровой автомат: тёмный корпус, погасший экран, кнопки;
  bsm_slot_lit 24×44 — то, что светится у включённого автомата (экран, лампа сверху) — слоем поверх;
  bsm_cold     44×56 — склад-холодильник: утеплённая дверь с инеем и щеколдой;
  bsm_back     72×52 — «серая» подсобка: перегородка из досок, занавеска и полка «Разное»;
  bsm_hatch    24×28 — спуск в подвал с улицы: дверь в фасаде у правого угла, козырёк и ступени.
"""

from premium import H, lit
from sprites import Canvas, shadowed

INK = H("#181425")
BRICK, BRICK_D, BRICK_L = H("#3e2731"), H("#181425"), H("#733e39")
CONC, CONC_D, CONC_L = H("#3a4466"), H("#262b44"), H("#5a6988")
WOOD, WOOD_D, WOOD_L = H("#733e39"), H("#3e2731"), H("#b86f50")
METAL, METAL_D, METAL_L = H("#5a6988"), H("#3a4466"), H("#8b9bb4")
RED, RED_D = H("#a22633"), H("#68386c")
GOLD, GOLD_L = H("#feae34"), H("#fee761")
CYAN, BLUE = H("#2ce8f5"), H("#0099db")
FROST, PALE = H("#c0cbdc"), H("#ffffff")
CURTAIN, CURTAIN_D = H("#68386c"), H("#3e2731")


def brick():
    """Кладка: ряды кирпичей вперевязку, тёмный шов, редкие светлые и выщербленные кирпичи — стена живая, не ровная."""
    c = Canvas(32, 32)
    c.rect(0, 0, 32, 32, BRICK_D)
    for row in range(4):
        y = row * 8
        shift = 0 if row % 2 == 0 else 8
        for i in range(-1, 3):
            x = i * 16 + shift
            c.rect(x + 1, y + 1, 14, 6, BRICK)
            c.hline(x + 1, y + 1, 14, BRICK_L if (row + i) % 3 == 0 else lit(BRICK, 0.12))
            c.hline(x + 1, y + 6, 14, lit(BRICK, -0.25))
    # Пара выщербин и потёк сырости.
    for x, y in ((6, 3), (21, 12), (11, 27)):
        c.px(x, y, BRICK_D)
    c.vline(26, 17, 6, lit(BRICK, -0.35))
    c.save("bsm_brick")


def floor():
    """Бетонные плиты: швы крестом, мелкая крошка; плитка ложится без видимого стыка."""
    c = Canvas(32, 32)
    c.rect(0, 0, 32, 32, CONC_D)
    c.hline(0, 0, 32, INK)
    c.vline(0, 0, 32, INK)
    c.hline(1, 1, 31, lit(CONC_D, 0.1))
    c.speckle(1, 1, 31, 31, [CONC, lit(CONC_D, -0.2)], 26, 63)
    c.save("bsm_floor")


def stairs():
    """Лестница вдоль левой стены: верх — у потолка (тёмный проём), ступени спускаются вниз к полу; перила справа."""
    c = Canvas(56, 84)
    # Проём наверху — свет из зала.
    c.rect(4, 0, 36, 8, INK)
    c.rect(8, 2, 28, 5, H("#ead4aa"))
    c.hline(8, 2, 28, PALE)
    # Ступени: каждая — светлая кромка и тёмный подступенок, ниже — шире и светлее (ближе к лампам).
    steps = 9
    for i in range(steps):
        y = 8 + i * 8
        w = 36
        tone = lit(CONC, -0.35 + i * 0.05)
        c.rect(4, y, w, 8, tone)
        c.hline(4, y, w, lit(tone, 0.35))
        c.hline(4, y + 6, w, lit(tone, -0.3))
        c.hline(4, y + 7, w, lit(tone, -0.45))
    # Стена слева (кирпич в тени).
    c.rect(0, 0, 4, 84, BRICK)
    for y in range(2, 84, 6):
        c.hline(0, y, 4, BRICK_D)
    # Перила: стойки и поручень наискосок вниз.
    for i in range(0, steps, 2):
        y = 8 + i * 8
        c.vline(44, y - 6, 12, METAL_D)
        c.px(44, y - 6, METAL_L)
    c.rect(42, 0, 2, 84, METAL)
    c.vline(42, 0, 84, METAL_L)
    c.outline(INK)
    c.save("bsm_stairs")


def slot(lit_layer=False):
    """Автомат 24×44: корпус с закруглённым верхом, лампа-маячок, экран с тремя окошками, кнопки и лоток.
    Слой lit — только то, что светится: экран, окошки, лампа и кнопки (сцена мигает им, в лёгкой графике — горит ровно)."""
    c = Canvas(24, 44)
    if not lit_layer:
        c.round_rect(1, 4, 22, 39, METAL_D, r=3)
        c.rect(2, 8, 20, 34, lit(METAL_D, -0.15))
        c.vline(2, 6, 36, METAL)
        c.vline(21, 6, 36, INK)
        # Лампа сверху — погасшая.
        c.rect(9, 0, 6, 4, RED_D)
        # Экран погасший: три окошка.
        c.rect(4, 9, 16, 14, INK)
        for x in (5, 10, 15):
            c.rect(x, 12, 4, 8, CONC_D)
        # Панель с кнопками.
        c.rect(3, 25, 18, 4, METAL)
        for x in (5, 10, 15):
            c.rect(x, 26, 3, 2, RED_D)
        # Ручка сбоку.
        c.rect(22, 14, 2, 2, METAL_L)
        # Лоток внизу.
        c.rect(6, 34, 12, 5, INK)
        c.hline(6, 34, 12, METAL)
        c.outline(INK)
        shadowed(c, 12, 42, 11, 2).save("bsm_slot")
        return
    c.rect(9, 0, 6, 4, H("#e43b44"))
    c.hline(10, 0, 4, H("#f6757a"))
    c.rect(4, 9, 16, 14, H("#124e89"))
    c.hline(4, 9, 16, BLUE)
    for x, tone in ((5, GOLD), (10, CYAN), (15, H("#e43b44"))):
        c.rect(x, 12, 4, 8, PALE)
        c.rect(x + 1, 14, 2, 4, tone)
    for x, tone in ((5, GOLD_L), (10, H("#63c74d")), (15, H("#f6757a"))):
        c.rect(x, 26, 3, 2, tone)
    c.save("bsm_slot_lit")


def cold():
    """Склад-холодильник: металлическая утеплённая дверь в бетонной раме, иней по краям, щеколда и табличка-снежинка."""
    c = Canvas(44, 56)
    c.rect(0, 0, 44, 56, CONC)
    c.hline(0, 0, 44, CONC_L)
    c.rect(5, 6, 34, 50, METAL)
    c.vline(5, 6, 50, METAL_L)
    c.vline(38, 6, 50, METAL_D)
    # Рёбра двери.
    for y in (16, 30, 44):
        c.hline(6, y, 32, METAL_D)
        c.hline(6, y + 1, 32, METAL_L)
    # Щеколда.
    c.rect(30, 24, 6, 4, INK)
    c.rect(31, 25, 4, 2, METAL_L)
    # Табличка со снежинкой.
    c.rect(12, 8, 12, 7, PALE)
    c.px(18, 9, BLUE)
    c.vline(18, 9, 5, BLUE)
    c.hline(15, 11, 7, BLUE)
    c.px(16, 10, BLUE)
    c.px(20, 10, BLUE)
    c.px(16, 12, BLUE)
    c.px(20, 12, BLUE)
    # Иней по кромке двери.
    c.speckle(5, 6, 34, 4, [FROST, PALE], 18, 7)
    c.speckle(5, 50, 34, 6, [FROST, PALE], 22, 8)
    c.outline(INK)
    c.save("bsm_cold")


def back():
    """«Серая» подсобка: перегородка из досок, сбоку занавеска, на перегородке — длинная полка (вещи ставит сцена)."""
    c = Canvas(72, 52)
    c.rect(0, 0, 72, 48, WOOD_D)
    for x in range(0, 72, 9):
        c.vline(x, 0, 48, INK)
        c.vline(x + 1, 0, 48, WOOD)
    c.speckle(0, 0, 72, 48, [WOOD], 30, 11)
    # Занавеска слева: складки.
    c.rect(0, 0, 18, 50, CURTAIN)
    for x in (3, 8, 13):
        c.vline(x, 2, 47, CURTAIN_D)
    c.hline(0, 0, 18, METAL_L)
    # Полка — две доски (вещи ставит сцена).
    for y in (16, 34):
        c.rect(20, y, 50, 3, WOOD_L)
        c.hline(20, y + 3, 50, INK)
        for x in (24, 64):
            c.rect(x, y + 3, 2, 3, METAL_D)
    c.outline(INK)
    shadowed(c, 36, 50, 34, 2).save("bsm_back")


def hatch():
    """Спуск в подвал с улицы — в фасаде у правого угла зала: козырёк, бетонная рама, наверху тёмная дверь, от неё
    к тротуару поднимаются три ступени (чем ближе к улице, тем светлее). 24×28 (в мире 12×14)."""
    c = Canvas(24, 28)
    c.rect(0, 0, 24, 4, RED_D)
    c.hline(0, 0, 24, H("#b55088"))
    c.rect(1, 4, 22, 24, CONC_L)
    c.rect(3, 5, 18, 23, CONC)
    # Дверь: тёмная, с ручкой.
    c.rect(4, 5, 16, 10, INK)
    c.rect(6, 6, 12, 9, BRICK_D)
    c.vline(12, 6, 9, INK)
    c.px(10, 10, GOLD)
    c.px(14, 10, GOLD)
    # Ступени к тротуару.
    for i in range(3):
        y = 15 + i * 4
        tone = lit(CONC, -0.4 + i * 0.18)
        c.rect(4, y, 16, 4, tone)
        c.hline(4, y, 16, lit(tone, 0.35))
    c.vline(21, 4, 24, METAL_L)
    c.vline(2, 4, 24, METAL_L)
    c.outline(INK)
    c.save("bsm_hatch")


if __name__ == "__main__":
    brick()
    floor()
    stairs()
    slot()
    slot(lit_layer=True)
    cold()
    back()
    hatch()
