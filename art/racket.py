"""«Крыша» (src/game/racket.ts): портреты и следы пакостей у входа.

Толик в кожанке — тот, кто приезжает на чёрной «девятке» (короткая стрижка, кожанка с воротником, девяностые —
без цепей и прочего «шика»); Борис с автомойки «Блеск» — подозреваемый в деле о рэкете (седой зачёс, усы,
рабочая куртка мойки с синей нашивкой). У обоих — настроения для диалогов. Трещины на витрине ложатся поверх
shopwin (40×14, левое стекло), осколки — на тротуар под ней, мешки с мусором — у двери.

    python3 art/racket.py
"""

from family import MOODS
from sprites import Canvas, mustache, portrait, rgb


def hair_buzz(p, hair):
    """Короткий «ёжик»: плотно по макушке, виски выбриты, на темени чуть светлее."""
    p.ellipse(16, 8.5, 8, 3.2, hair)
    p.rect(8, 9, 2, 3, hair)
    p.rect(22, 9, 2, 3, hair)
    p.hline(13, 6, 6, rgb("#4a3b52"))


def hair_grey_slick(p, hair):
    """Седой зачёс назад, высокий лоб."""
    p.ellipse(16, 7, 8.5, 3.6, hair)
    p.rect(8, 7, 2, 6, hair)
    p.rect(22, 7, 2, 6, hair)
    p.hline(12, 5, 8, rgb("#ffffff"))


def leather(p, skin, hair, shirt):
    """Кожанка: широкие лацканы, блик на плече, тёмная водолазка под горло."""
    p.rect(13, 24, 6, 3, rgb("#181425"))
    p.line(13, 25, 10, 31, rgb("#181425"))
    p.line(19, 25, 22, 31, rgb("#181425"))
    p.line(6, 27, 9, 25, rgb("#8f563b"))
    p.px(24, 27, rgb("#8f563b"))


def carwash(p, skin, hair, shirt):
    """Куртка мойки с нашивкой-каплей и седые усы."""
    mustache(p, skin, rgb("#c0cbdc"), shirt)
    p.rect(19, 26, 4, 3, rgb("#ffffff"))
    p.px(21, 27, rgb("#0099db"))
    p.vline(16, 24, 8, rgb("#124e89"))


CAST = (
    # Толик: короткий ёжик, кожанка цвета горького шоколада, фон — асфальт.
    ("racket_tolik", "#5a6988", "#e4a672", "#262b44", "#3e2731", hair_buzz, leather),
    # Борис: седой зачёс, синяя куртка мойки, фон — вода с пеной.
    ("case_boris", "#0099db", "#eec39a", "#c0cbdc", "#124e89", hair_grey_slick, carwash),
)


def crack():
    """Трещины на левом стекле витрины 40×14: тёмная дыра от камня, толстые белые лучи до рамы, осколки по краю."""
    c = Canvas(40, 14)
    cx, cy = 9, 6
    rays = ((2, 2), (17, 2), (2, 11), (17, 11), (9, 2), (13, 11), (2, 6), (17, 7))
    # Сначала тень луча (на соседнем пикселе), потом сам белый луч — так его видно и на пёстрой выкладке.
    for x, y in rays:
        c.line(cx + 1, cy + 1, x + (1 if x < 17 else 0), y + (1 if y < 11 else 0), "g")
    for x, y in rays:
        c.line(cx, cy, x, y, "w")
    c.rect(7, 4, 5, 4, "W")
    c.rect(8, 5, 3, 2, "k")
    c.px(7, 4, ".")
    c.px(11, 7, ".")
    c.px(8, 7, "k")
    c.px(11, 4, "K")
    c.save("racket_crack")


def shards():
    """Осколки на тротуаре 20×5: треугольные блики стекла и пара тёмных кусочков."""
    c = Canvas(20, 5)
    for x, y in ((1, 2), (6, 0), (10, 2), (15, 1), (17, 3)):
        c.px(x, y, "w")
        c.px(x + 1, y, "c")
        c.px(x, y + 1, "W")
    for x, y in ((4, 3), (13, 4), (8, 4)):
        c.px(x, y, "l")
    c.save("racket_shards")


def trash():
    """Мусор у двери 28×16: два чёрных мешка с хвостиками, банка, обёртка и шкурка банана."""
    c = Canvas(28, 16)
    c.ellipse(8, 10, 6.5, 5.5, "K")
    c.ellipse(19, 11, 6, 4.5, "g")
    c.px(8, 4, "K")
    c.px(7, 3, "k")
    c.px(9, 3, "k")
    c.px(19, 6, "g")
    c.px(18, 5, "k")
    c.px(20, 5, "k")
    c.hline(5, 8, 3, "g")
    c.hline(16, 9, 3, "G")
    c.outline("k")
    # Вывалилось: банка, обёртка, шкурка.
    c.rect(24, 12, 2, 3, "R")
    c.px(24, 12, "W")
    c.rect(1, 13, 3, 2, "w")
    c.px(2, 13, "Y")
    c.hline(13, 15, 3, "Y")
    c.px(12, 14, "y")
    c.save("racket_trash")


def main():
    for name, bg, skin, hair, shirt, draw_hair, extras in CAST:
        for mood in MOODS:
            portrait(name, bg, skin, hair, shirt, draw_hair, extras, mood)
    crack()
    shards()
    trash()


if __name__ == "__main__":
    main()
