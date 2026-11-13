"""Беда района (src/game/crisis.ts, scenes/crisisFx.ts): что стоит на улице, пока она идёт.

Паводок — мешки с песком у входа (34×18). Буран — сугроб у тротуара (44×14). Отключили воду —
объявление на двери (10×12) и бочка-водовоз на колёсах у бордюра (48×30). Жара обходится маревом
и солнцем из погоды (weatherFx.ts). Палитра — Endesga 32 из sprites.py.

    python3 art/crisis.py
"""

from sprites import Canvas, shadowed

SACK, SACK_D, SACK_L, TIE = "N", "t", "w", "a"


def sack(c, x, y, w=12, h=7):
    """Мешок с песком: светлый верх, тёмный низ, перевязанный край."""
    c.round_rect(x, y, w, h, SACK, r=2)
    c.hline(x + 2, y + 1, w - 5, SACK_L)
    c.hline(x + 1, y + h - 2, w - 2, SACK_D)
    c.hline(x + 2, y + h - 1, w - 4, SACK_D)
    # Завязка с правого края и шов посередине.
    c.vline(x + w - 3, y + 1, h - 2, TIE)
    c.px(x + w - 1, y + h // 2, TIE)
    c.px(x + w // 2 - 1, y + 2, SACK_D)
    c.px(x + w // 2, y + 3, SACK_D)


def sandbags():
    c = Canvas(34, 18)
    for i in range(3):
        sack(c, 1 + i * 11, 10)
    for i in range(2):
        sack(c, 6 + i * 11, 4)
    sack(c, 12, 0, w=10, h=6)
    c.outline("k")
    return shadowed(c, 17, 16.5, 16, 2.2)


def drift():
    """Сугроб: белая горка с голубой тенью снизу и искрами на гребне."""
    c = Canvas(44, 14)
    c.ellipse(14, 10, 13, 5.5, "W")
    c.ellipse(30, 9, 13, 6.5, "W")
    c.ellipse(13, 9, 11, 4.2, "w")
    c.ellipse(29, 8, 11, 5.2, "w")
    c.hline(4, 13, 36, "l")
    c.hline(2, 12, 40, "W")
    for x, y in ((9, 6), (22, 5), (31, 3), (36, 6)):
        c.px(x, y, "c")
    c.outline("G")
    return c


def notice():
    """Объявление на двери: лист с капелькой и строчками, кнопки по углам."""
    c = Canvas(10, 12)
    c.rect(1, 1, 8, 10, "w")
    c.hline(1, 10, 8, "W")
    # Капля с косой чертой: «воды нет».
    c.px(4, 2, "U")
    c.rect(3, 3, 3, 2, "U")
    c.hline(4, 5, 1, "u")
    c.line(2, 5, 6, 2, "R")
    for y in (7, 9):
        c.hline(2, y, 6 if y == 7 else 4, "G")
    c.px(1, 1, "R")
    c.px(8, 1, "R")
    c.outline("k")
    return c


def cistern():
    """Бочка-водовоз: голубая цистерна на двух колёсах, кран сзади, дышло спереди, капля на боку."""
    c = Canvas(48, 30)
    # Рама и дышло.
    c.hline(6, 20, 36, "K")
    c.hline(6, 21, 36, "g")
    c.line(42, 20, 47, 23, "K")
    c.px(47, 24, "K")
    # Цистерна: бочка с ободами.
    c.round_rect(5, 3, 38, 17, "U", r=5)
    c.round_rect(7, 4, 34, 4, "c", r=2)
    c.hline(8, 17, 32, "u")
    c.hline(9, 18, 30, "u")
    for x in (12, 35):
        c.vline(x, 4, 15, "u")
    # Люк сверху.
    c.rect(21, 1, 6, 3, "g")
    c.hline(22, 1, 4, "G")
    # Капля на боку.
    c.px(24, 8, "w")
    c.rect(23, 9, 3, 3, "w")
    c.hline(24, 12, 1, "W")
    # Кран сзади и ведро под ним.
    c.rect(2, 13, 3, 2, "l")
    c.px(2, 15, "l")
    c.rect(0, 22, 5, 4, "G")
    c.hline(0, 22, 5, "l")
    # Колёса.
    for x in (13, 31):
        c.ellipse(x, 24, 4.5, 4.5, "k")
        c.ellipse(x, 24, 2.2, 2.2, "G")
        c.px(x, 24, "l")
    c.outline("k")
    return shadowed(c, 24, 28, 22, 2)


def main():
    sandbags().save("crisis_sandbags")
    drift().save("crisis_drift")
    notice().save("crisis_notice")
    cistern().save("crisis_cistern")


if __name__ == "__main__":
    main()
