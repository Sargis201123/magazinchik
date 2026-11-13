"""Лотерея у кассы (src/game/lottery.ts, сцена — src/scenes/lotteryFx.ts), 13.11.

Стойка с билетами 24×48 (в мире 12×24): синяя тумба с жёлтой полосой и звездой, сверху — витрина,
в ней висят ленты билетов четырёх цветов (с перфорацией), над витриной на двух стойках — красная
вывеска «ЛОТО». Три вида:
    lottery_stand        — работает;
    lottery_stand_closed — город запретил лотереи: вывеска погасла, витрина перетянута лентой;
    lottery_stand_lucky  — «здесь счастливый магазин»: вывеска золотая, сверху звезда.
И мелочи: билет, что летит в руки покупателю (lottery_ticket), и торт счастливчика (lottery_cake).

Сцена ставит стойку низом в точку у стойки со сладостями (origin 0.5, 1).

    python3 art/lottery.py
"""

from sprites import Canvas, shadowed

W, H = 24, 48
# Сверху 4 строки — под звезду «счастливой» стойки: все три вида одной высоты, низ на месте.
TOP = 4

FONT = {
    "Л": ["..##", ".#.#", ".#.#", ".#.#", "#..#"],
    "О": ["###", "#.#", "#.#", "#.#", "###"],
    "Т": ["###", ".#.", ".#.", ".#.", ".#."],
}
STAR5 = ["..Y..", ".YYY.", "YYYYY", ".YYY.", ".Y.Y."]
STAR7 = ["...Y...", "..YwY..", "YYYYYYY", ".YYYYY.", ".YY.YY."]
# Ленты билетов в витрине: x, цвет, цвет перфорации.
STRIPS = [(5, "Y", "y"), (9, "s", "P"), (13, "E", "e"), (17, "c", "U")]


def text(c, s, x, y, col):
    for ch in s:
        for dy, row in enumerate(FONT[ch]):
            for dx, v in enumerate(row):
                if v == "#":
                    c.px(x + dx, y + dy, col)
        x += len(FONT[ch][0]) + 1


def tape(c, x0, y0, x1, y1):
    """Сигнальная лента в две точки толщиной: красно-белая через каждые две точки."""
    n = max(abs(x1 - x0), abs(y1 - y0))
    for i in range(n + 1):
        x = round(x0 + (x1 - x0) * i / n)
        y = round(y0 + (y1 - y0) * i / n)
        col = "R" if (i // 2) % 2 == 0 else "w"
        c.px(x, y, col)
        c.px(x, y + 1, col)


def stand(kind):
    c = Canvas(W, H)
    t = TOP
    # Тумба: синяя, с бликом по верхней кромке, тенью справа, жёлтой полосой и звездой.
    c.rect(2, t + 26, 20, 15, "u")
    c.hline(2, t + 26, 20, "U")
    c.vline(20, t + 27, 13, "K")
    c.vline(21, t + 27, 13, "K")
    c.rect(2, t + 30, 20, 2, "Y")
    c.hline(2, t + 31, 20, "y")
    c.stamp(STAR5, 9, t + 33)
    c.hline(2, t + 40, 20, "K")
    # Витрина: тёмная задняя стенка, рейка сверху, ленты билетов с перфорацией.
    c.rect(3, t + 13, 18, 13, "K")
    c.hline(3, t + 13, 18, "G")
    for x, col, dark in STRIPS:
        c.rect(x, t + 14, 3, 11, col)
        for y in range(t + 16, t + 25, 3):
            c.hline(x, y, 3, dark)
        # Нижний билет чуть отогнут — висит.
        c.px(x + 2, t + 24, dark)
    # Блик на стекле.
    c.px(4, t + 15, "w")
    c.px(4, t + 16, "W")
    # Две стойки вывески.
    c.vline(6, t + 9, 4, "G")
    c.vline(17, t + 9, 4, "G")
    # Вывеска «ЛОТО».
    plate, light, dark, letters = {
        "open": ("R", "s", "r", "Y"),
        "closed": ("g", "G", "K", "l"),
        "lucky": ("y", "Y", "o", "r"),
    }[kind]
    c.round_rect(1, t, 22, 10, plate, r=2)
    c.hline(3, t + 1, 18, light)
    c.hline(3, t + 8, 18, dark)
    text(c, "ЛОТО", 4, t + 3, letters)
    if kind == "closed":
        # Запрет: витрина перетянута сигнальной лентой крест-накрест.
        tape(c, 3, t + 14, 20, t + 23)
        tape(c, 3, t + 23, 20, t + 14)
    if kind == "lucky":
        # «Счастливая»: звезда над вывеской и искорки по углам витрины.
        c.stamp(STAR7, 8, 0)
        c.px(2, t + 12, "Y")
        c.px(21, t + 12, "Y")
    c.outline("k")
    name = "lottery_stand" if kind == "open" else f"lottery_stand_{kind}"
    shadowed(c, 12, t + 41, 11, 2.5).save(name)


def ticket():
    """Билет 12×7: жёлтый, красная полоса слева, перфорация, строчки «номера»."""
    c = Canvas(12, 7)
    c.rect(1, 1, 10, 5, "Y")
    c.rect(1, 1, 2, 5, "R")
    for y in (2, 4):
        c.hline(5, y, 5, "y")
    c.vline(3, 1, 5, "N")
    c.outline("k")
    c.save("lottery_ticket")


def cake():
    """Торт 16×15 на тарелке: два коржа, розовая глазурь с подтёками, вишенки, свечка."""
    c = Canvas(16, 15)
    c.ellipse(8, 13, 7.5, 1.6, "W")
    c.rect(2, 7, 12, 6, "B")
    c.hline(2, 10, 12, "n")
    c.rect(2, 6, 12, 2, "s")
    for x in (3, 6, 10, 12):
        c.px(x, 8, "s")
    c.px(6, 9, "s")
    c.hline(3, 6, 10, "P")
    for x in (4, 8, 11):
        c.px(x, 5, "R")
    c.vline(8, 2, 3, "w")
    c.px(8, 1, "Y")
    c.outline("k")
    c.save("lottery_cake")


def main():
    for kind in ("open", "closed", "lucky"):
        stand(kind)
    ticket()
    cake()


if __name__ == "__main__":
    main()
