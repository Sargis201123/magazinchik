"""Карьера сотрудников (src/game/career.ts): портреты для окон, доска почёта на стене зала и нашивки звания.

  portrait_staff0..7  64×64 — сотрудники в форме магазина (бейдж на груди). Чётные — мужчины, нечётные —
                      женщины: так же чередуются имена в списке (i18n ruNames). Картинки — для окон (DOM).
  honor_board         52×38 — доска почёта на стене: деревянная рамка, красная шапка со звездой и три
                      пустых гнезда под таблички (в мире вдвое меньше);
  honor_plate         30×5  — золотая табличка в гнездо доски; имя на ней пишет игра (decorations.ts);
  rank_senior         6×5   — нашивка старшего: одна золотая полоска на плече;
  rank_admin          6×7   — нашивка администратора зала: две полоски и звёздочка.

    python3 art/career.py
"""

from sprites import Canvas, glasses, hair_bald, hair_bun, hair_cap, hair_curly, hair_slick, mustache, portrait, rgb
from delivery import hair_long, hair_messy

UNIFORM = "#5fcde4"


def name_pin(p, skin, hair, shirt):
    """Бейдж с именем на груди: белая карточка с полоской."""
    p.rect(18, 26, 4, 3, rgb("#ffffff"))
    p.hline(18, 27, 4, rgb("#e43b44"))


def collar(p, skin, hair, shirt):
    """Воротничок формы."""
    p.px(13, 25, rgb("#ffffff"))
    p.px(18, 25, rgb("#ffffff"))


def staff_portraits():
    """Восемь лиц: фон, кожа, волосы, причёска и мелочи у каждого свои; форма — одна на всех."""
    looks = [
        ("staff0", "#3e8948", "#f2d3ab", "#4a2c1a", hair_slick, None),
        ("staff1", "#b55088", "#eec39a", "#733e39", hair_long, None),
        ("staff2", "#feae34", "#d9a066", "#181425", hair_messy, None),
        ("staff3", "#0099db", "#f2d3ab", "#8f563b", hair_bun, glasses),
        ("staff4", "#5a6988", "#e4a672", "#3a4466", hair_bald, mustache),
        ("staff5", "#e43b44", "#eec39a", "#181425", hair_curly, None),
        ("staff6", "#63c74d", "#eec39a", "#b86f50", hair_cap, None),
        ("staff7", "#68386c", "#d9a066", "#feae34", hair_long, glasses),
    ]
    for name, bg, skin, hair, style, extra in looks:
        portrait(name, bg, skin, hair, UNIFORM, style, lambda p, *a, extra=extra: (collar(p, *a), name_pin(p, *a), extra and extra(p, *a)))


def honor_board():
    """Доска почёта: тёмное дерево, светлое поле, красная шапка со звездой, три гнезда под таблички."""
    c = Canvas(52, 38)
    c.round_rect(0, 0, 52, 38, "x", r=2)
    c.rect(2, 2, 48, 34, "b")
    c.rect(3, 10, 46, 25, "N")
    c.hline(3, 10, 46, "n")
    # Шапка: красная лента с золотой звездой посередине.
    c.rect(3, 3, 46, 7, "R")
    c.hline(3, 3, 46, "s")
    c.hline(3, 9, 46, "r")
    for x, y in ((25, 4), (24, 5), (25, 5), (26, 5), (23, 6), (24, 6), (25, 6), (26, 6), (27, 6), (24, 7), (26, 7), (24, 8), (26, 8)):
        c.px(x, y, "Y")
    c.px(25, 7, "y")
    # Три гнезда под таблички: тёмные углубления.
    for y in (13, 20, 27):
        c.rect(10, y, 32, 5, "Q")
        c.hline(10, y, 32, "v")
    # Гвоздики по углам.
    for x, y in ((3, 34), (48, 34)):
        c.px(x, y, "y")
    c.outline("k")
    c.save("honor_board")


def honor_plate():
    """Золотая табличка во всё гнездо: блик сверху, тень снизу; имя пишет игра поверх (своим шрифтом)."""
    c = Canvas(30, 5)
    c.rect(0, 0, 30, 5, "y")
    c.hline(0, 0, 30, "Y")
    c.hline(0, 4, 30, "a")
    c.save("honor_plate")


def rank_badges():
    """Нашивки на плече: золото с тёмной окантовкой — видно и на голубой, и на белой форме."""
    c = Canvas(6, 5)
    c.rect(1, 1, 4, 3, "Y")
    c.hline(1, 3, 4, "y")
    c.outline("k")
    c.save("rank_senior")
    c = Canvas(6, 7)
    c.rect(1, 1, 4, 2, "Y")
    c.rect(1, 4, 4, 2, "Y")
    c.hline(1, 2, 4, "y")
    c.hline(1, 5, 4, "y")
    c.outline("k")
    c.save("rank_admin")


def main():
    staff_portraits()
    honor_board()
    honor_plate()
    rank_badges()


if __name__ == "__main__":
    main()
