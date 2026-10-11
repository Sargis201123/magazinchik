"""Сезонные места (src/game/economy.ts, FIXTURE_KINDS): ларь с мороженым у входа и вёдра с цветами у кассы.

Ларь — горизонтальный морозильник «три четверти»: белый корпус, розовая панель с рожком, сверху
стеклянная раздвижная крышка, под ней — иней и мороженое (товар рисует игра между слоями).
  icebox        64×44 — корпус, ванна с инеем, передняя панель;
  icebox_front  64×44 — рама и стёкла крышки с бликами (поверх товара);
  icebox_closed 64×44 — не сезон: крышку накрыли синим чехлом с табличкой.
Цветы — деревянная ступенчатая подставка с тремя оцинкованными вёдрами.
  florist       30×34 — подставка и задние стенки вёдер;
  florist_front 30×34 — передние стенки вёдер (поверх стеблей букетов).

    python3 art/sprites.py
"""

from sprites import Canvas, shadowed

GLASS = (215, 240, 255, 60)
GLINT = (255, 255, 255, 170)
FROST = (232, 246, 255, 255)
ICE = (198, 228, 246, 255)
ICE_D = (170, 206, 232, 255)

# Ванна ларя (под стеклом) в пикселях спрайта: x 6…57, y 5…23.
TUB = (6, 5, 52, 19)


def icebox():
    c = Canvas(64, 44)
    # Корпус: белая крышка-рама и белые бока.
    c.rect(1, 1, 62, 26, "w")
    c.rect(1, 26, 62, 14, "W")
    # Ванна с инеем: светлый верх, к дну чуть темнее, перегородки корзин.
    x, y, w, h = TUB
    for yy in range(y, y + h):
        t = (yy - y) / (h - 1)
        c.hline(x, yy, w, FROST if t < 0.15 else ICE if t < 0.7 else ICE_D)
    for bx in (x + 17, x + 34):
        c.vline(bx, y + 2, h - 3, "l")
    c.speckle(x, y, w, h, [FROST, "w"], 30, 7)
    # Передняя панель: розовая полоса с рожком мороженого и голубой кант.
    c.rect(3, 28, 58, 10, "P")
    c.hline(3, 28, 58, "s")
    c.hline(3, 37, 58, "p")
    c.hline(3, 39, 58, "U")
    cone = [
        "..sw..",
        ".swws.",
        ".wYYw.",
        "..yy..",
        "..yy..",
        "...y..",
    ]
    for cx in (10, 30, 50):
        c.stamp(cone, cx - 3, 30)
    for cx in (19, 40):
        c.rect(cx, 31, 6, 1, "w")
        c.rect(cx + 1, 33, 4, 1, "w")
    # Цоколь и колёсики.
    c.rect(2, 40, 60, 2, "G")
    for wx in (5, 56):
        c.rect(wx, 41, 3, 2, "k")
    c.outline("k")
    out = shadowed(c, 32, 42, 30, 2)
    out.save("icebox")

    # Рама и стёкла крышки: две раздвижные створки с бликами — поверх товара.
    f = Canvas(64, 44)
    f.rect(x, y, w, h, GLASS)
    f.frame(x - 1, y - 1, w + 2, h + 2, "W")
    f.vline(x + w // 2, y, h, "W")
    f.vline(x + w // 2 + 1, y, h, "l")
    for door in (x + 3, x + w // 2 + 4):
        for i in range(7):
            f.px(door + i * 2, y + h - 3 - i * 2, GLINT)
            f.px(door + i * 2 + 1, y + h - 3 - i * 2, GLINT)
        f.rect(door + 15, y + 2, 4, 1, GLINT)
    # Ручки створок.
    f.rect(x + w // 2 - 4, y + h - 2, 3, 1, "G")
    f.rect(x + w // 2 + 3, y + h - 2, 3, 1, "G")
    f.save("icebox_front")

    # Не сезон: синий чехол на крышке и табличка «до лета» (снежинка).
    k = Canvas(64, 44)
    k.rect(x - 2, y - 2, w + 4, h + 3, "u")
    for yy in range(y, y + h, 4):
        k.hline(x - 1, yy, w + 2, "U")
    k.hline(x - 2, y + h, w + 4, "g")
    k.rect(25, 9, 14, 10, "w")
    k.frame(25, 9, 14, 10, "G")
    snow = ["..c..", "c.c.c", ".ccc.", "c.c.c", "..c.."]
    k.stamp(snow, 30, 11)
    k.save("icebox_closed")


def florist():
    c = Canvas(30, 34)
    # Ступенчатая деревянная подставка: верхняя ступень сзади, нижняя спереди.
    c.rect(4, 14, 22, 4, "n")
    c.hline(4, 14, 22, "N")
    c.rect(1, 26, 28, 4, "n")
    c.hline(1, 26, 28, "N")
    c.rect(1, 30, 28, 2, "a")
    for lx in (3, 26):
        c.rect(lx, 18, 2, 12, "a")
    # Вёдра: заднее (выше) и два передних — сейчас только внутренние стенки и тёмное нутро.
    for bx, by in ((10, 6), (2, 18), (17, 18)):
        c.rect(bx, by, 11, 2, "G")
        c.rect(bx + 1, by + 2, 9, 7, "l")
    c.outline("k")
    out = shadowed(c, 15, 32, 14, 2)
    out.save("florist")

    f = Canvas(30, 34)
    for bx, by in ((10, 6), (2, 18), (17, 18)):
        # Передняя стенка ведра: обод, оцинковка с бликом, ручка.
        f.rect(bx, by + 3, 11, 6, "W")
        f.hline(bx, by + 3, 11, "w")
        f.hline(bx, by + 8, 11, "l")
        f.vline(bx + 2, by + 4, 4, "w")
        f.px(bx, by + 4, "G")
        f.px(bx + 10, by + 4, "G")
    f.outline("k")
    f.save("florist_front")


def main():
    icebox()
    florist()


if __name__ == "__main__":
    main()
