"""Лицензия на пиво и сигареты (src/game/license.ts): товар, ящики склада и «Витрина 18+» у кассы.

Товар 10×12, по три вида (как item_* в sprites.py, низ прячется за кромкой полки), и ящик 16×16 для склада:
  item_beer        — две банки пива (зелёные, жёлтые, синие); значок в меню — 🥫, у кваса своя 🍺;
  item_cigarettes  — пачка: белая, с цветной полосой сверху и тёмной полосой предупреждения снизу;
  crate_beer       — картонная упаковка банок; crate_cigarettes — блоки сигарет в коробке.
Витрина 60×56 (в мире 30×28): тёмный шкаф со стеклом, две стеклянные полки, наверху — красная табличка «18+».
Товар ставит сцена на полки (shelves.ts ITEM_AREA.license); license_stand_front — тумба и блики стекла поверх товара.

Подаём нейтрально (игра для всех возрастов): товар как товар, без бокалов и дыма; на пачках — полоса предупреждения.

Запуск: python3 art/license.py (картинки — в public/assets, как у остальных скриптов).
"""

from sprites import Canvas, shadowed

# Банка 4×8: светлая крышка с ободком, цветной корпус со светлой полосой, тень справа.
CANS = (("e", "d", "N"), ("y", "o", "w"), ("U", "u", "w"))


def can(c, x, body, dark, band, top=3):
    c.hline(x, top, 4, "W")
    c.px(x + 3, top, "l")
    c.rect(x, top + 1, 4, 7, body)
    c.vline(x + 3, top + 1, 7, dark)
    c.hline(x, top + 3, 4, band)
    c.px(x + 3, top + 3, "W" if band == "w" else "n")
    # Блик слева на корпусе.
    c.vline(x, top + 1, 2, "w" if body != "y" else "Y")


def items_beer():
    for i, (body, dark, band) in enumerate(CANS):
        c = Canvas(10, 12)
        can(c, 0, body, dark, band, top=3)
        can(c, 5, body, dark, band, top=2)
        c.outline("k")
        c.save(f"item_beer_{i}")
        if i == 0:
            c.save("item_beer")


# Пачка 8×9: белая, полоса марки сверху, тёмная полоса предупреждения снизу.
PACKS = ("R", "U", "y")


def pack(c, x, y, band):
    c.rect(x, y, 8, 9, "w")
    c.vline(x + 7, y, 9, "W")
    c.rect(x, y, 8, 3, band)
    c.hline(x, y + 3, 8, "W")
    # Значок марки — светлая точка на полосе.
    c.px(x + 3, y + 1, "w")
    c.px(x + 4, y + 1, "w")
    # Полоса предупреждения: тёмная, с «строчками».
    c.rect(x, y + 6, 8, 3, "K")
    c.hline(x + 1, y + 7, 5, "G")


def items_cigarettes():
    for i, band in enumerate(PACKS):
        c = Canvas(10, 12)
        pack(c, 1, 2, band)
        c.outline("k")
        c.save(f"item_cigarettes_{i}")
        if i == 0:
            c.save("item_cigarettes")


def crate_beer():
    """Картонная упаковка банок: сверху видны крышки, на боку — полоса с банкой."""
    c = Canvas(16, 16)
    c.rect(0, 6, 16, 9, "n")
    c.hline(0, 6, 16, "N")
    c.vline(15, 6, 9, "B")
    c.hline(0, 14, 16, "B")
    for x in (1, 5, 9, 13):
        c.rect(x, 3, 3, 3, "W")
        c.px(x + 2, 3, "l")
        c.px(x, 5, "l")
    c.rect(3, 9, 10, 3, "e")
    c.rect(7, 8, 2, 5, "W")
    c.outline("k")
    c.save("crate_beer")


def crate_cigarettes():
    """Коробка с блоками сигарет: два белых блока с полосой марки и полосой предупреждения."""
    c = Canvas(16, 16)
    c.rect(0, 4, 16, 11, "B")
    c.hline(0, 4, 16, "n")
    c.vline(15, 4, 11, "a")
    for y, band in ((6, "R"), (10, "U")):
        c.rect(2, y, 12, 4, "w")
        c.vline(13, y, 4, "W")
        c.hline(2, y, 12, band)
        c.hline(2, y + 3, 12, "K")
        c.hline(4, y + 3, 6, "G")
    c.outline("k")
    c.save("crate_cigarettes")


# «18+» шрифтом 3×5: единица, восьмёрка, плюс.
DIGITS = (
    [".w.", "ww.", ".w.", ".w.", "www"],
    ["www", "w.w", "www", "w.w", "www"],
    ["...", ".w.", "www", ".w.", "..."],
)


def license_stand():
    c = Canvas(60, 56)
    # Боковины шкафа — тёмное дерево.
    for x in (1, 55):
        c.rect(x, 6, 4, 49, "x")
        c.vline(x + 1, 6, 49, "b")
    # Внутри — тёмная задняя стенка, сверху тёплая полоска подсветки.
    c.rect(5, 8, 50, 36, "K")
    c.hline(5, 8, 50, "g")
    c.hline(6, 9, 48, (254, 231, 97, 90))
    # Стеклянные полки: светлая кромка и тень под ней.
    for y in (23, 37):
        c.hline(5, y, 50, "W")
        c.hline(5, y + 1, 50, "l")
    # Карниз со вставкой посередине.
    c.rect(0, 2, 60, 6, "x")
    c.hline(0, 2, 60, "a")
    c.hline(0, 7, 60, "k")
    # Табличка «18+»: красная, с белыми цифрами.
    c.round_rect(22, 0, 16, 8, "r", r=1)
    c.round_rect(23, 1, 14, 6, "R", r=1)
    x = 24
    for glyph in DIGITS:
        c.stamp(glyph, x, 1)
        x += 4
    # Тумба: дверцы с ручками.
    c.rect(1, 44, 58, 11, "b")
    c.hline(1, 44, 58, "B")
    c.hline(1, 45, 58, "a")
    for x0 in (4, 31):
        c.frame(x0, 47, 25, 7, "x")
        c.hline(x0 + 1, 48, 23, "B")
        c.px(x0 + (22 if x0 == 4 else 2), 50, "Y")
    c.outline("k")
    out = shadowed(c, 30, 54, 28, 2.5)
    out.save("license_stand")
    # Поверх товара: тумба, боковины, карниз и блики стекла (товар стоит за стеклом).
    f = Canvas(60, 56)
    for yy in range(56):
        for xx in range(60):
            p = out.get(xx, yy)
            inside = 6 <= xx <= 53 and 9 <= yy <= 43
            if not inside:
                f.px(xx, yy, p)
    # Стекло: две косые полоски бликов и тонкая рамка дверец посередине.
    glint = (255, 255, 255, 70)
    for k in range(10):
        f.px(12 + k, 41 - k * 3, glint)
        f.px(13 + k, 41 - k * 3, glint)
        f.px(36 + k, 40 - k * 3, glint)
    f.vline(30, 9, 35, (24, 20, 37, 120))
    f.save("license_stand_front")


if __name__ == "__main__":
    items_beer()
    items_cigarettes()
    crate_beer()
    crate_cigarettes()
    license_stand()
