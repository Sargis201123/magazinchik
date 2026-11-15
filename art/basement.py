"""Подвал (src/game/basement.ts, src/scenes/floorView.ts, src/scenes/basementFx.ts): тёмный кирпичный зал под магазином.

13.11 (задача автора #63 «Подвал со своей экосистемой»): первый из этажей здания. Наверху у правой стены зала —
спуск в подвал (приямок с перилами), к нему с улицы идут завсегдатаи автоматов. Внизу — кирпич, бетонный пол,
лестница сверху, игровые автоматы у стены, склад-холодильник и «серая» подсобка ломбарда.
Палитра Endesga 32, двойная детализация (в мире вдвое меньше).

    python3 art/basement.py

Картинки:
  bsm_brick    32×32 — кирпичная кладка подвала (плитка задней стены);
  bsm_stairs   56×84 — лестница сверху вниз вдоль левой стены, с перилами;
  bsm_hatch    24×28 — спуск в подвал с улицы: дверь в фасаде у правого угла, козырёк и ступени.

14.11: пол, автоматы, холодильник и подсобка первой версии (bsm_floor, bsm_slot, bsm_slot_lit, bsm_cold, bsm_back)
убраны — подвал перерисован (art/basement_art.py: bsm_floor2, bsm_slot2, bsm_cold2, bsm_pawn), старые нигде не
рисовались.
"""

from premium import H, lit
from sprites import Canvas

INK = H("#181425")
BRICK, BRICK_D, BRICK_L = H("#3e2731"), H("#181425"), H("#733e39")
CONC, CONC_L = H("#3a4466"), H("#5a6988")
METAL, METAL_D, METAL_L = H("#5a6988"), H("#3a4466"), H("#8b9bb4")
RED_D = H("#68386c")
GOLD = H("#feae34")
PALE = H("#ffffff")


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
    stairs()
    hatch()
