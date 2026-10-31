"""Альбом коллекций (src/game/collections.ts): витрина трофеев в зале и трофеи наборов.

Собранный набор ставит в витрину свой трофей (8×9 в рамке-контуре, в мире — 5×5,5):
фотоаппарат со звездой (редкие гости), шкатулка писем, золотой половник (рецепты), хлопушка
(праздники), плюшевый мишка (друзья района), макет магазина и песочные часы (моменты дня).
Витрина — застеклённый шкафчик 38×50 на ножках с тремя полками (trophy_case); когда собраны все
наборы — золотая (trophy_case_gold). Трофеи игра ставит на полки сама (scenes/collections.ts),
в альбоме они же — картинкой набора. Здесь же значок достижения «Хранитель альбома».

    python3 art/album.py
"""

import sprites
from premium import H, lit
from sprites import Canvas, shadowed

# ---------------------------------------------------------------- трофеи 8×9

TROPHIES = {
    # Фотоаппарат блогера, на нём золотая звёздочка-автограф.
    "guests": [
        "......Y.",
        ".....YwY",
        "..KK..Y.",
        "KKKKKKKK",
        "KlWWWWlK",
        "KWuccuWK",
        "KWuUUuWK",
        "KlWuuWlK",
        "KKKKKKKK",
    ],
    # Стопка писем, верхнее — с красной печатью-сердечком.
    "cards": [
        "........",
        "wwwwwwww",
        "wNwwwwNw",
        "wwNwwNww",
        "wwwRRwww",
        "wwwRmwww",
        "NNNNNNNN",
        "WWWWWWWW",
        "nnnnnnnn",
    ],
    # Золотой половник.
    "recipes": [
        "......yY",
        ".....yY.",
        "....yY..",
        "...yY...",
        "..yY....",
        "YYYYYY..",
        "YwYYYy..",
        ".YYYy...",
        "..yy....",
    ],
    # Хлопушка: конус в полоску и конфетти над ним.
    "holidays": [
        "R.U..Y.E",
        "..E.R...",
        ".Y..U.R.",
        "..PwPw..",
        "..wPwP..",
        "...Pw...",
        "...wP...",
        "....P...",
        "....p...",
    ],
    # Плюшевый мишка.
    "friends": [
        ".aa..aa.",
        ".aBaaBa.",
        "..aaaa..",
        ".aNkNka.",
        ".aNNNNa.",
        "..aRRa..",
        ".aaNNaa.",
        ".aaNNaa.",
        "..aa.aa.",
    ],
    # Макет магазинчика с полосатым навесом.
    "shops": [
        "..BBBB..",
        ".BBBBBB.",
        "RwRwRwRw",
        "RwRwRwRw",
        "NNNNNNNN",
        "NUcNbbNN",
        "NUUNbbNN",
        "NNNNbYNN",
        "aaaaaaaa",
    ],
    # Песочные часы в золотой рамке.
    "moments": [
        "YYYYYYYY",
        ".wyyyyw.",
        "..wyyw..",
        "...yw...",
        "...wy...",
        "..wwyw..",
        ".wwyyyw.",
        ".wyyyyw.",
        "YYYYYYYY",
    ],
}


def trophy(name, rows):
    c = Canvas(10, 11)
    c.stamp(rows, 1, 1)
    c.outline("k")
    c.save(f"trophy_{name}")


# ---------------------------------------------------------------- витрина 38×50

# Где стоят трофеи: левый верхний угол картинки трофея (10×11) на витрине, по порядку наборов.
# Ряды по 3, 2 и 2 штуки; низ трофея — на доске полки (доски на y = 17, 29, 41).
SLOTS = [(3, 6), (14, 6), (25, 6), (8, 18), (20, 18), (8, 30), (20, 30)]


def trophy_case(gold=False):
    """Шкафчик со стеклом: карниз, три полки, ножки. Золотой — рама золотая и искорки по углам."""
    c = Canvas(38, 50)
    if gold:
        frame, frame_hi, frame_lo = H("#e8b23a"), H("#fee761"), H("#9a6a1c")
    else:
        frame, frame_hi, frame_lo = H("#8f563b"), H("#b86f50"), H("#5a3324")
    glass, glass_hi = H("#d7ecef"), H("#f4fbfc")
    back = H("#c3dde3") if not gold else H("#f3e3b4")
    # Ножки.
    for x in (3, 33):
        c.rect(x, 43, 2, 5, frame_lo)
    # Корпус.
    c.rect(1, 3, 36, 41, frame)
    c.hline(1, 3, 36, frame_hi)
    c.vline(1, 3, 41, frame_hi)
    c.vline(36, 3, 41, frame_lo)
    c.hline(1, 43, 36, frame_lo)
    # Карниз с «короной».
    c.rect(0, 1, 38, 3, frame)
    c.hline(0, 1, 38, frame_hi)
    c.hline(0, 3, 38, frame_lo)
    c.rect(15, 0, 8, 1, frame)
    c.px(19, 0, frame_hi)
    # Стекло: задняя стенка, полки, блики.
    c.rect(3, 5, 32, 37, back)
    for y in (17, 29, 41):
        c.hline(3, y, 32, frame_lo)
        c.hline(3, y - 1, 32, lit(back, -0.12))
    for i in range(5):
        c.px(4 + i, 10 - i, glass_hi)
        c.px(29 + i, 39 - i, glass)
        c.px(30 + i, 39 - i, glass_hi)
    if gold:
        for x, y in ((2, 6), (36, 22), (2, 34), (19, 0)):
            c.px(x, y, H("#ffffff"))
    c.outline("k")
    shadowed(c, 19, 48, 16, 1.6).save("trophy_case_gold" if gold else "trophy_case")


# ---------------------------------------------------------------- значок достижения

BADGE = ["....#....", "...###...", "..#####..", "...#.#...", "####.####", "#.##.##.#", "#..#.#..#", "####.####", "....#...."]


def badge():
    """Значок «Хранитель альбома» тем же рисунком, что и остальные (sprites.badges)."""
    keep = sprites.BADGE_SYMBOLS
    sprites.BADGE_SYMBOLS = {"collections": BADGE}
    sprites.BADGE_TIER["collections"] = "gold"
    try:
        sprites.badges()
    finally:
        sprites.BADGE_SYMBOLS = keep


def main():
    for name, rows in TROPHIES.items():
        trophy(name, rows)
    trophy_case()
    trophy_case(gold=True)
    badge()


if __name__ == "__main__":
    main()
