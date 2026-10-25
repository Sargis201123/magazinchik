"""Мусор на полу (StoreScene.dropTrash) и он же сгнивший (src/game/rot.ts).

Шесть видов мусора: смятая бумажка, банановая кожура, стаканчик из-под кофе, фантик,
мятая банка из-под газировки и огрызок яблока. У каждого есть «_rot» — тот же мусор,
пролежавший на полу: потемнел, позеленел, под ним бурое пятно. Над гнилым мусором
кружит муха («fly») и поднимается вонь («rot_stink»).

    python3 art/litter.py   (или вместе со всем: python3 art/sprites.py)
"""

from sprites import Canvas

KINDS = ["trash", "trash_banana", "trash_cup", "trash_wrapper", "trash_can", "trash_apple"]


def paper():
    """Смятая бумажка 14×12: комок с гранями-складками и уголком чека."""
    c = Canvas(14, 12)
    c.ellipse(6.5, 6.5, 5, 4.2, "W")
    c.ellipse(5.5, 5.5, 3.2, 2.6, "w")
    # Складки: тени между гранями.
    for x, y in ((4, 8), (5, 8), (8, 4), (9, 5), (7, 7), (3, 5)):
        c.px(x, y, "l")
    c.px(6, 3, "w")
    c.px(9, 8, "l")
    # Торчит уголок чека с печатью строк.
    c.rect(10, 2, 3, 4, "w")
    c.px(11, 3, "l")
    c.px(11, 5, "l")
    c.outline("k")
    return c


def banana():
    """Банановая кожура 14×10: три лепестка в стороны, тёмные пятнышки, хвостик."""
    c = Canvas(14, 10)
    c.stamp(
        [
            "..............",
            "..YY......yY..",
            "...YYy...YY...",
            "....YYy.YYy...",
            "Yy...YYYYy....",
            ".YYYYYYYYYYYy.",
            "..yyYYYYYYyy..",
            "....aaa.......",
        ],
        0,
        1,
    )
    for x, y in ((6, 6), (9, 6), (4, 7)):
        c.px(x, y, "a")
    c.px(7, 4, "w")
    c.outline("k")
    return c


def cup():
    """Стаканчик из-под кофе 14×10 лежит на боку: красная полоса, крышка, капля кофе."""
    c = Canvas(14, 10)
    c.ellipse(3, 8, 2.4, 1, "a")
    # Корпус расширяется к донышку (вправо).
    for x in range(3, 12):
        top = 3 - (x - 3) // 4
        c.vline(x, top, 9 - top - (x - 3) // 4, "w")
    for x in range(6, 9):
        c.vline(x, 2, 6, "R")
    c.vline(8, 2, 6, "r")
    c.hline(3, 6, 9, "W")
    # Крышка слева.
    c.rect(1, 3, 2, 5, "G")
    c.vline(1, 4, 3, "g")
    c.outline("k")
    return c


def wrapper():
    """Фантик 14×9: сине-жёлтая обёртка с закрученными хвостиками."""
    c = Canvas(14, 9)
    c.rect(4, 2, 6, 5, "U")
    c.hline(4, 2, 6, "c")
    c.rect(5, 4, 4, 1, "Y")
    c.hline(4, 6, 6, "u")
    # Хвостики-«бантики».
    c.stamp(["Y.", "YY", "yY", "YY", "Y."], 2, 2)
    c.stamp([".Y", "YY", "Yy", "YY", ".Y"], 10, 2)
    c.px(1, 3, "Y")
    c.px(12, 5, "Y")
    c.outline("k")
    return c


def can():
    """Мятая банка из-под газировки 14×9 на боку: красная, с вмятиной и серебристым ободком."""
    c = Canvas(14, 9)
    c.rect(3, 2, 8, 5, "R")
    c.hline(3, 2, 8, "s")
    c.hline(3, 6, 8, "r")
    # Вмятина посередине.
    c.vline(7, 2, 5, "r")
    c.px(6, 3, "s")
    c.px(8, 5, "m")
    # Белая волна логотипа.
    for x, y in ((4, 4), (5, 3), (9, 4), (10, 5)):
        c.px(x, y, "w")
    # Донышко и крышка — серебро.
    c.vline(2, 3, 3, "W")
    c.vline(11, 2, 5, "l")
    c.vline(12, 3, 3, "W")
    c.outline("k")
    return c


def apple():
    """Огрызок яблока 12×12: красные «шапочки» сверху и снизу, светлая мякоть с косточками."""
    c = Canvas(12, 12)
    c.ellipse(6, 3, 3.6, 1.8, "R")
    c.ellipse(6, 9.5, 3.4, 1.7, "R")
    c.px(4, 2, "s")
    c.px(4, 9, "s")
    c.rect(4, 4, 4, 5, "N")
    c.vline(4, 4, 5, "n")
    c.px(6, 6, "b")
    c.px(6, 7, "x")
    # Хвостик и листик.
    c.vline(6, 0, 2, "a")
    c.px(7, 0, "E")
    c.outline("k")
    return c


def rot(src):
    """Сгнивший мусор: тот же рисунок темнее и зеленее, бурое пятно под ним, плесень точками."""
    w, h = src.w + 2, src.h + 2
    c = Canvas(w, h)
    # Пятно протекло из-под мусора.
    for cx, cy, rx, ry in ((w / 2, h - 3, w / 2 - 0.5, 2.6), (w / 2 + 2, h - 2, 3.5, 1.6)):
        c.ellipse(cx, cy, rx, ry, (92, 74, 38, 150))
    body = src.img.copy()
    px = body.load()
    for y in range(src.h):
        for x in range(src.w):
            r, g, b, a = px[x, y]
            if not a:
                continue
            lum = (r * 0.3 + g * 0.55 + b * 0.15) / 255
            # Цвет уходит к оливково-бурому, контур остаётся тёмным.
            k = 0.42
            r2 = int(r * (1 - k) + (96 + 60 * lum) * k)
            g2 = int(g * (1 - k) + (80 + 52 * lum) * k)
            b2 = int(b * (1 - k) + (34 + 30 * lum) * k)
            px[x, y] = (int(r2 * 0.85), int(g2 * 0.88), int(b2 * 0.8), a)
    c.img.alpha_composite(body, (1, 0))
    # Плесень: зелёные точки на самом мусоре (по детерминированной сетке, чтобы файл не менялся).
    for y in range(1, src.h - 1):
        for x in range(1, src.w - 1):
            if (x * 7 + y * 13) % 11 == 0 and src.get(x, y)[3] and src.get(x, y)[:3] != (24, 20, 37):
                c.px(x + 1, y, "E" if (x + y) % 2 else "e")
    return c


def fly():
    """Муха 5×4: чёрное тельце и прозрачные крылышки."""
    c = Canvas(5, 4)
    c.px(1, 0, (220, 236, 255, 170))
    c.px(3, 0, (220, 236, 255, 170))
    c.px(0, 1, (220, 236, 255, 120))
    c.px(4, 1, (220, 236, 255, 120))
    c.rect(1, 1, 3, 2, "k")
    c.px(2, 1, "g")
    c.px(2, 3, "k")
    c.save("fly")


def stink():
    """Запах 12×14: две зелёные волнистые струйки, тающие кверху."""
    c = Canvas(12, 14)
    for x0 in (2, 7):
        for i, y in enumerate(range(13, 0, -1)):
            a = int(230 * (0.35 + 0.65 * y / 13))
            dx = (0, 1, 1, 0, -1, -1)[(i + x0) % 6]
            c.px(x0 + dx, y, (99, 199, 77, a))
            if y % 3 == 0:
                c.px(x0 + dx + 1, y, (62, 137, 72, a))
    c.save("rot_stink")


def main():
    for name, draw in zip(KINDS, (paper, banana, cup, wrapper, can, apple)):
        c = draw()
        c.save(name)
        rot(c).save(f"{name}_rot")
    fly()
    stink()


if __name__ == "__main__":
    main()
