"""Район дорожает (src/game/gentrify.ts, src/scenes/gentrifyFx.ts): дорогие машины, витрины новых соседей, вывески.

13.11 (задача автора «Район дорожает»): когда в район тянутся богатые, на улице это видно — у магазина паркуются длинные
чёрные машины с хромом, у кофейни третьей волны стоит меловой штендер, а магазин, выбравший новых соседей, вешает у
вывески золотую табличку; выбравший своих — дощечку с сердечком. Вид сверху и спереди, как остальная улица
(sprites.py). Палитра Endesga 32, двойная детализация (в мире вдвое меньше).

    python3 art/gentrify.py

Картинки:
  car_lux (+ _up, _down и *_lights) — длинный чёрный седан: капот длиннее, кабина ниже и дальше назад, хром по борту
             и решётка; кузов НЕ под тинт (всегда чёрный — его видно издалека среди цветных машин);
  gent_board   20×26 — меловой штендер кофейни: на доске чашка с паром и три строчки;
  gent_plaque  26×12 — золотая табличка с ромбом у вывески («премиум» без букв);
  gent_own     22×22 — грифельная дощечка «для своих» у вывески: сердечко и строчка мелом, на верёвочке.
"""

from premium import H, lit
from sprites import Canvas, shadowed

INK = H("#181425")
BODY, BODY_L, BODY_D = H("#262b44"), H("#3a4466"), H("#181425")
CHROME, CHROME_L = H("#c0cbdc"), H("#ffffff")
GLASS, GLASS_L = H("#124e89"), H("#2ce8f5")
YELLOW, RED = H("#fee761"), H("#e43b44")
GOLD, GOLD_L, GOLD_D = H("#feae34"), H("#fee761"), H("#be4a2f")
WOOD, WOOD_D = H("#8f563b"), H("#733e39")
SLATE, SLATE_L = H("#262b44"), H("#3a4466")
CHALK = H("#ead4aa")
HEART = H("#e43b44")


def car_side():
    """Сбоку 72×36 (носом вправо), как sprites.py cars: колёса — полоски сверху и снизу, кабина сдвинута назад."""
    c = Canvas(72, 36)
    for x in (10, 52):
        c.rect(x, 5, 9, 3, INK)
        c.rect(x, 29, 9, 3, INK)
        # Хромированные диски видны краешком.
        c.hline(x + 2, 6, 5, CHROME)
        c.hline(x + 2, 30, 5, CHROME)
    c.round_rect(2, 7, 68, 23, BODY, r=5)
    c.hline(5, 8, 62, BODY_L)
    c.hline(5, 28, 62, BODY_D)
    # Длинный капот с бликом, короткая низкая кабина ближе к багажнику.
    c.hline(48, 12, 16, BODY_L)
    c.hline(48, 24, 16, BODY_L)
    c.round_rect(16, 10, 26, 17, BODY_L, r=3)
    c.rect(36, 10, 7, 17, GLASS)
    c.rect(16, 10, 5, 17, GLASS)
    c.vline(38, 11, 5, GLASS_L)
    # Хромовая полоса по бортам и решётка радиатора.
    c.hline(4, 9, 64, CHROME)
    c.hline(4, 27, 64, CHROME)
    c.vline(68, 12, 13, CHROME)
    c.vline(69, 13, 11, CHROME_L)
    c.outline(INK)
    shadowed(c, 36, 32, 34, 3.5).save("car_lux")
    lamp = Canvas(72, 36)
    lamp.rect(68, 9, 2, 3, YELLOW)
    lamp.rect(68, 25, 2, 3, YELLOW)
    lamp.rect(2, 9, 2, 4, RED)
    lamp.rect(2, 24, 2, 4, RED)
    lamp.save("car_lux_lights")


def car_vertical():
    """Носом вверх (_up) и вниз (_down) 36×72 — для парковки. Сверху крыша, к зрителю — задний борт или решётка."""
    x0, x1, y0, y1 = 6, 30, 2, 69
    for up in (True, False):
        def span(d, h):
            return y0 + d if up else y1 - d - h

        c = Canvas(36, 72)
        for wy in (12, 52):
            c.rect(x0 - 1, wy, 3, 9, INK)
            c.rect(x1 - 2, wy, 3, 9, INK)
        c.round_rect(x0, y0, x1 - x0, y1 - y0, BODY, r=5)
        # Капот длинный: кабина начинается дальше от носа, чем у седана.
        rx0, rw = x0 + 3, x1 - x0 - 6
        d, length = 26, 26
        c.round_rect(rx0, span(d, length), rw, length, BODY_L, r=3)
        c.rect(rx0, span(d, 6), rw, 6, GLASS)
        c.rect(rx0, span(d + length - 5, 5), rw, 5, GLASS)
        c.hline(rx0 + 1, span(d + 2, 1), 5, GLASS_L)
        # Блик на капоте и хром по бокам.
        c.vline(18, span(4, 18), 18, BODY_L)
        c.vline(x0, y0 + 4, y1 - y0 - 8, CHROME)
        c.vline(x1 - 1, y0 + 4, y1 - y0 - 8, CHROME)
        c.hline(x0 + 3, y1 - 2, x1 - x0 - 6, BODY_D)
        if not up:
            # Решётка к зрителю — хромом.
            c.hline(x0 + 6, y1 - 2, x1 - x0 - 12, CHROME_L)
            c.hline(x0 + 6, y1 - 3, x1 - x0 - 12, CHROME)
        c.outline(INK)
        suffix = "up" if up else "down"
        shadowed(c, 18, y1, (x1 - x0) / 2 + 3, 4.5).save(f"car_lux_{suffix}")
        lamp = Canvas(36, 72)
        near, far = (y1 - 3), (y0 + 1)
        front, back = (far, near) if up else (near, far)
        for x in (x0 + 2, x1 - 6):
            lamp.rect(x, front, 4, 2, YELLOW)
            lamp.rect(x, back, 4, 2, RED)
        lamp.save(f"car_lux_{suffix}_lights")


def board():
    """Меловой штендер 20×26: тёмная доска в деревянной раме, чашка с паром и строчки — «кофе здесь»."""
    c = Canvas(20, 26)
    # Ножки домиком.
    c.line(3, 18, 1, 25, WOOD_D)
    c.line(16, 18, 18, 25, WOOD_D)
    c.rect(2, 1, 16, 19, WOOD)
    c.hline(2, 1, 16, lit(WOOD, 0.25))
    c.rect(4, 3, 12, 15, SLATE)
    c.hline(4, 3, 12, SLATE_L)
    # Чашка с паром.
    c.rect(7, 8, 5, 4, CHALK)
    c.vline(12, 9, 2, CHALK)
    c.hline(6, 12, 7, CHALK)
    c.px(8, 6, CHALK)
    c.px(9, 5, CHALK)
    c.px(10, 6, CHALK)
    # Строчки меню.
    c.hline(6, 14, 8, lit(CHALK, -0.3))
    c.hline(6, 16, 6, lit(CHALK, -0.3))
    c.outline(INK)
    shadowed(c, 10, 24, 9, 2).save("gent_board")


def plaque():
    """Золотая табличка 26×12 с ромбом: «премиум» без букв — читается на любом языке."""
    c = Canvas(26, 12)
    c.round_rect(1, 1, 24, 10, GOLD, r=1)
    c.hline(2, 1, 22, GOLD_L)
    c.hline(2, 10, 22, GOLD_D)
    c.frame(3, 3, 20, 6, lit(GOLD, -0.25))
    # Ромб посередине и по точке по бокам.
    for dy, w in ((0, 1), (1, 3), (2, 3), (3, 1)):
        c.hline(13 - w // 2, 4 + dy, w, GOLD_L)
    c.px(6, 6, GOLD_L)
    c.px(19, 6, GOLD_L)
    c.outline(INK)
    c.save("gent_plaque")


def own_sign():
    """Грифельная дощечка 22×22 на верёвочке: сердечко и две строчки мелом — «для своих»."""
    c = Canvas(22, 22)
    c.line(5, 6, 11, 1, WOOD_D)
    c.line(16, 6, 11, 1, WOOD_D)
    c.rect(2, 6, 18, 14, WOOD)
    c.rect(4, 8, 14, 10, SLATE)
    # Сердечко: два бугорка, потом сужается к низу.
    c.hline(7, 9, 2, HEART)
    c.hline(11, 9, 2, HEART)
    for row, (x, w) in enumerate(((6, 8), (7, 6), (8, 4), (9, 2))):
        c.hline(x, 10 + row, w, HEART)
    c.hline(6, 16, 10, CHALK)
    c.outline(INK)
    c.save("gent_own")


if __name__ == "__main__":
    car_side()
    car_vertical()
    board()
    plaque()
    own_sign()
