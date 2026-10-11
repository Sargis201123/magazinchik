"""Предметы на улице в особые дни (src/game/bigday.ts): съёмки кино и ремонт дороги.

Двойная детализация, как у всей графики (sprites.DETAIL = 2).

    python3 art/sprites.py
"""

from sprites import Canvas, shadowed


def film_camera():
    """Кинокамера на штативе: две бобины, объектив, ножки."""
    c = Canvas(28, 38)
    c.line(13, 20, 5, 36, "G")
    c.line(14, 20, 22, 36, "G")
    c.line(13, 20, 13, 36, "l")
    c.rect(5, 12, 16, 9, "k")
    c.rect(6, 13, 14, 7, "K")
    c.rect(21, 14, 5, 5, "g")
    c.ellipse(26, 16.5, 1.6, 2.4, "c")
    c.ellipse(9, 8, 4, 4, "K")
    c.ellipse(9, 8, 1.4, 1.4, "l")
    c.ellipse(17, 8, 4, 4, "K")
    c.ellipse(17, 8, 1.4, 1.4, "l")
    c.px(8, 15, "R")
    c.outline("k")
    shadowed(c, 14, 36, 10, 2).save("film_camera")


def film_light():
    """Прожектор на стойке, светит вперёд."""
    c = Canvas(20, 44)
    c.vline(9, 14, 28, "G")
    c.line(9, 40, 3, 43, "G")
    c.line(10, 40, 16, 43, "G")
    c.round_rect(2, 2, 16, 12, "K", r=2)
    c.rect(4, 4, 12, 8, "Y")
    c.rect(5, 5, 4, 3, "w")
    c.outline("k")
    shadowed(c, 10, 42, 7, 1.6).save("film_light")


def director_chair():
    """Складное кресло режиссёра."""
    c = Canvas(22, 26)
    c.line(3, 12, 18, 25, "B")
    c.line(18, 12, 3, 25, "B")
    c.rect(2, 2, 18, 6, "R")
    c.hline(2, 2, 18, "s")
    c.rect(2, 12, 18, 3, "R")
    c.vline(2, 2, 13, "b")
    c.vline(19, 2, 13, "b")
    c.outline("k")
    shadowed(c, 11, 24, 8, 1.6).save("director_chair")


def road_barrier():
    """Ограждение ремонта: бело-красные полосы на ножках."""
    c = Canvas(40, 18)
    c.rect(1, 3, 38, 6, "w")
    for x in range(1, 39, 8):
        for k in range(4):
            c.vline(x + k + 2, 3, 6, "R")
    c.vline(4, 9, 8, "K")
    c.vline(35, 9, 8, "K")
    c.hline(1, 16, 7, "K")
    c.hline(32, 16, 7, "K")
    c.px(4, 2, "y")
    c.px(35, 2, "y")
    c.outline("k")
    c.save("road_barrier")


def road_pit():
    """Раскоп в асфальте с кучей земли."""
    c = Canvas(60, 26)
    c.ellipse(24, 15, 22, 8, "a")
    c.ellipse(24, 15, 19, 6, "x")
    c.ellipse(26, 17, 14, 3.5, "b")
    c.ellipse(49, 14, 10, 8, "B")
    c.ellipse(47, 12, 6, 4, "t")
    for x, y in ((44, 10), (51, 15), (47, 17)):
        c.px(x, y, "a")
    c.vline(24, 6, 10, "G")
    c.outline("k")
    c.save("road_pit")


def digger():
    """Маленький жёлтый экскаватор с ковшом."""
    c = Canvas(64, 46)
    c.round_rect(4, 36, 34, 8, "K", r=3)
    for x in range(8, 36, 6):
        c.ellipse(x, 40, 2, 2, "G")
    c.rect(6, 22, 30, 14, "y")
    c.hline(6, 22, 30, "Y")
    c.rect(20, 8, 16, 16, "y")
    c.rect(22, 10, 12, 9, "c")
    c.px(23, 11, "w")
    c.vline(6, 22, 14, "o")
    c.rect(8, 16, 3, 6, "G")
    # Стрела и ковш.
    c.line(36, 18, 50, 8, "o")
    c.line(36, 19, 50, 9, "o")
    c.line(50, 8, 56, 30, "o")
    c.line(51, 8, 57, 30, "o")
    c.rect(52, 30, 9, 6, "G")
    c.hline(52, 36, 9, "K")
    c.outline("k")
    shadowed(c, 24, 44, 22, 2.2).save("digger")


def main():
    film_camera()
    film_light()
    director_chair()
    road_barrier()
    road_pit()
    digger()


if __name__ == "__main__":
    main()
