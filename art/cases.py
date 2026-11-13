"""«Дело недели» (src/game/cases.ts): значки улик в зале и портреты новых героев дел.

Значки 16×16 (в мире 8×8) — что именно нашлось: обронённый чек, кадр камеры, находка в пакете для улик,
облачко «проговорился». Портреты — как у героев сценок (art/skits.py, общая заготовка sprites.portrait),
каждый с настроениями: аптекарь Роза Марковна, кассир Зина и охранник Гоша (у Эдуарда), кладовщик
Семёныч и грузчик Валера (соседний склад).

    python3 art/cases.py
"""

from delivery import hair_messy
from family import MOODS
from sprites import Canvas, glasses, hair_bald, hair_bun, hair_cap, hair_curly, mustache, portrait, rgb


def clue_receipt():
    """Чек: бумажная лента с зубчатым низом, строчки и итог."""
    c = Canvas(16, 16)
    c.rect(4, 1, 8, 13, "w")
    c.vline(11, 1, 13, "W")
    for x in range(4, 12, 2):
        c.px(x, 14, "w")
    for y in (3, 5, 7):
        c.hline(5, y, 5, "l")
    c.hline(5, 10, 3, "k")
    c.hline(9, 10, 2, "R")
    c.outline("k")
    c.save("clue_receipt")


def clue_camera():
    """Камера наблюдения на кронштейне с красным огоньком — «что-то сняла»."""
    c = Canvas(16, 16)
    c.rect(2, 4, 10, 6, "W")
    c.hline(2, 4, 10, "w")
    c.rect(2, 9, 10, 1, "l")
    c.rect(12, 5, 2, 4, "G")
    c.px(13, 6, "c")
    c.px(4, 6, "R")
    c.rect(6, 10, 2, 4, "G")
    c.rect(4, 13, 6, 2, "g")
    c.outline("k")
    c.save("clue_camera")


def clue_find():
    """Находка: прозрачный пакет для улик с красной полоской и чем-то тёмным внутри."""
    c = Canvas(16, 16)
    c.rect(3, 2, 10, 12, "W")
    c.rect(4, 4, 8, 9, "w")
    c.hline(3, 2, 10, "R")
    c.hline(3, 3, 10, "r")
    c.ellipse(8, 9, 2.6, 2.2, "b")
    c.px(7, 8, "B")
    c.vline(11, 5, 6, "W")
    c.outline("k")
    c.save("clue_find")


def clue_talk():
    """Облачко разговора с «…» — постоянный проговорился."""
    c = Canvas(16, 16)
    c.round_rect(1, 2, 14, 9, "w", r=2)
    c.hline(2, 10, 12, "W")
    c.rect(4, 11, 3, 2, "w")
    c.px(4, 13, "w")
    for x in (4, 7, 10):
        c.rect(x, 6, 2, 2, "g")
    c.outline("k")
    c.save("clue_talk")


def pharmacist(p, skin, hair, shirt):
    """Аптекарь: очки, лацканы халата и зелёный крестик на кармане."""
    glasses(p, skin, hair, shirt)
    p.line(15, 24, 13, 31, rgb("#c0cbdc"))
    p.line(17, 24, 19, 31, rgb("#c0cbdc"))
    p.rect(21, 26, 3, 1, rgb("#3e8948"))
    p.rect(22, 25, 1, 3, rgb("#3e8948"))


def cashier(p, skin, hair, shirt):
    """Кассир: бейджик и серёжки."""
    p.rect(19, 26, 4, 2, rgb("#ffffff"))
    p.px(20, 26, rgb("#e43b44"))
    p.px(8, 16, rgb("#fee761"))
    p.px(24, 16, rgb("#fee761"))


def guard(p, skin, hair, shirt):
    """Охранник: жёлтый значок, рация на плече и щетина."""
    p.rect(20, 27, 3, 3, rgb("#feae34"))
    p.rect(10, 24, 2, 4, rgb("#181425"))
    p.px(10, 23, rgb("#181425"))
    for x, y in ((12, 19), (14, 20), (18, 20), (20, 19), (16, 21)):
        p.px(x, y, shade_px(skin))


def storekeeper(p, skin, hair, shirt):
    """Кладовщик: седые усы и карандаш за ухом."""
    mustache(p, skin, rgb("#c0cbdc"), shirt)
    p.line(23, 12, 25, 9, rgb("#feae34"))
    p.px(25, 9, rgb("#3e2731"))
    p.hline(14, 26, 5, rgb("#5a6988"))


def loader(p, skin, hair, shirt):
    """Грузчик: лямки комбинезона и рабочая рукавица на плече."""
    p.vline(12, 24, 8, rgb("#0099db"))
    p.vline(20, 24, 8, rgb("#0099db"))
    p.px(12, 27, rgb("#fee761"))
    p.px(20, 27, rgb("#fee761"))
    p.rect(22, 23, 3, 3, rgb("#feae34"))
    p.px(25, 24, rgb("#feae34"))


def shade_px(color):
    return tuple(max(0, int(v * 0.8)) for v in color[:3]) + (255,)


CAST = (
    # Роза Марковна, аптекарь: седые кудри, очки, белый халат.
    ("case_rosa", "#3e8948", "#f2d3ab", "#c0cbdc", "#ffffff", hair_curly, pharmacist),
    # Зина, кассир у Эдуарда: рыжий пучок, синяя форма.
    ("case_zina", "#feae34", "#eec39a", "#be4a2f", "#0099db", hair_bun, cashier),
    # Гоша, охранник: фуражка с кокардой, чёрная форма.
    ("case_gosha", "#5a6988", "#e4a672", "#262b44", "#262b44", hair_cap, guard),
    # Семёныч, кладовщик: лысина, седые усы, коричневый рабочий халат.
    ("case_semyon", "#e4a672", "#f2d3ab", "#8b9bb4", "#8f563b", hair_bald, storekeeper),
    # Валера, грузчик: лохматый, в синем комбинезоне.
    ("case_valera", "#f77622", "#d9a066", "#4a2c1a", "#124e89", hair_messy, loader),
)


def main():
    clue_receipt()
    clue_camera()
    clue_find()
    clue_talk()
    for name, bg, skin, hair, shirt, draw_hair, extras in CAST:
        for mood in MOODS:
            portrait(name, bg, skin, hair, shirt, draw_hair, extras, mood)


if __name__ == "__main__":
    main()
