"""Полка «Уценка» (src/game/bargain.ts) — три модели (gear 'bargain'), 60 пикселей в ширину (30 точек мира).

Низкая ступенчатая горка: ряды полок поднимаются к задней стенке, чтобы с прохода был виден
весь товар (его раскладывает сцена). Слева на
стойке красная вывеска «УЦЕНКА». Модели отличаются числом рядов (по 6 мест в ряду):
    0 — деревянная горка на 2 ряда, 1 — на 3 ряда, 2 — красная металлическая на 4 ряда
    с полосатым козырьком.
На кромке полок — жёлтые ярлычки цен, на передней юбке — большие ценники «-50%».

Высота корпуса = BASE + ряды × STEP; сцена ставит картинку низом в точку at.y + 8 и считает
места на полках по тем же числам (BARGAIN_STEP_PX в StoreScene).

    python3 art/bargain_shelf.py   (или вместе со всем: python3 art/sprites.py)
"""

from sprites import Canvas

W = 60
SIGN_H = 14
STEP = 8
BASE = 12
ROWS = [2, 3, 4]

# Пиксельный шрифт 5×7 для вывески и 3×5 — для ценников.
BIG = {
    "У": ["#...#", "#...#", "#...#", ".####", "....#", "#...#", ".###."],
    "Ц": ["#..#.", "#..#.", "#..#.", "#..#.", "#..#.", "#####", "....#"],
    "Е": ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
    "Н": ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
    "К": ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
    "А": [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
}
SMALL = {
    "-": ["...", "...", "###", "...", "..."],
    "5": ["###", "#..", "##.", "..#", "##."],
    "0": [".#.", "#.#", "#.#", "#.#", ".#."],
    "%": ["#..", "..#", ".#.", "#..", "..#"],
}


def text(c, s, x, y, col, font, step):
    for ch in s:
        for dy, row in enumerate(font[ch]):
            for dx, v in enumerate(row):
                if v == "#":
                    c.px(x + dx, y + dy, col)
        x += step


def tag(c, x, y):
    """Ценник 17×7: жёлтый, с красным «-50%»."""
    c.rect(x, y, 17, 7, "Y")
    c.hline(x, y + 6, 17, "y")
    c.frame(x, y, 17, 7, "k")
    text(c, "-50%", x + 2, y + 1, "R", SMALL, 4)


def shelf(tier):
    rows = ROWS[tier]
    body = BASE + rows * STEP
    h = SIGN_H + body
    c = Canvas(W, h)
    top = h - body
    metal = tier == 2
    side, side_d, plank, plank_l, edge = ("R", "r", "W", "w", "l") if metal else ("B", "a", "n", "N", "b")
    # Тень на полу.
    c.ellipse(W / 2, h - 2, W / 2 - 1, 2.5, (24, 20, 37, 70))
    # Задняя стенка горки (тёмная, на её фоне лежит товар).
    c.rect(4, top + 2, W - 8, body - 4, "K")
    c.hline(4, top + 2, W - 8, "g")
    for r in range(rows):
        # Ряд r (0 — передний, нижний): полка с кромкой и жёлтыми ярлычками цен по краю.
        y = h - BASE - r * STEP
        c.rect(3, y, W - 6, 2, plank)
        c.hline(3, y, W - 6, plank_l)
        c.hline(3, y + 2, W - 6, edge)
        for x in range(7 + (r % 2) * 4, W - 8, 9):
            c.rect(x, y + 1, 3, 2, "Y")
            c.px(x + 1, y + 2, "R")
    # Боковины: лесенкой вверх к задней стенке.
    for x0 in (0, W - 4):
        for r in range(rows):
            y = h - BASE - r * STEP
            c.rect(x0, y - STEP + 3, 4, STEP, side)
        c.rect(x0, h - BASE, 4, BASE - 1, side)
        c.vline(x0 + (3 if x0 == 0 else 0), top + 3, body - 4, side_d)
    # Передняя юбка с большими ценниками «-50%».
    c.rect(2, h - BASE + 3, W - 4, BASE - 4, side_d)
    c.hline(2, h - BASE + 3, W - 4, side)
    tag(c, 6, h - BASE + 3)
    tag(c, W - 23, h - BASE + 3)
    if metal:
        # Полосатый козырёк над задней стенкой.
        for x in range(2, W - 2):
            c.vline(x, top - 1, 4, "R" if (x // 4) % 2 else "w")
        c.hline(2, top + 3, W - 4, "r")
        # Заклёпки на боковинах.
        for y in range(top + 6, h - 4, 6):
            c.px(1, y, "s")
            c.px(W - 2, y, "s")
    # Стойка и вывеска «УЦЕНКА» слева сверху.
    c.rect(8, 6, 2, top - 4, "g")
    c.vline(8, 6, top - 4, "G")
    c.rect(1, 0, 41, 12, "R")
    c.hline(1, 0, 41, "s")
    c.hline(1, 11, 41, "r")
    c.frame(1, 0, 41, 12, "k")
    text(c, "УЦЕНКА", 4, 2, "w", BIG, 6)
    if tier >= 1:
        # Звёздочка-«взрыв» у вывески: у старших моделей.
        c.stamp(["..Y..", ".YYY.", "YYwYY", ".YYY.", "..Y.."], 44, 3)
    c.outline("k")
    c.save(f"bargain_shelf{tier}")


def main():
    for tier in range(len(ROWS)):
        shelf(tier)


if __name__ == "__main__":
    main()
