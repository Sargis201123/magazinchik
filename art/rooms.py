"""Мелочи комнат флигеля: доска меню в кофейне, полка с банками в пекарне,
сковородки на кухне, мешки с мукой."""

from premium import H, lit
from sprites import Canvas

INK = H("#2b2233")


def menu_chalk():
    """Грифельная доска с меню: рамка, строчки мелом и нарисованная чашка."""
    c = Canvas(22, 14)
    c.rect(0, 0, 22, 14, H("#7a4a28"))
    c.rect(1, 1, 20, 12, H("#2f3a36"))
    for y, w in ((3, 9), (6, 11), (9, 8)):
        c.hline(3, y, w, H("#dfe8e0"))
        c.hline(3 + w + 1, y, 2, H("#fee761"))
    c.rect(16, 7, 3, 3, H("#ffffff"))
    c.px(19, 8, H("#ffffff"))
    c.hline(16, 4, 3, H("#9aa6a0"))
    c.save("menu_chalk")


def jar_shelf():
    """Настенная полка: банки с вареньем и мукой."""
    c = Canvas(24, 12)
    jars = [(2, H("#e43b44")), (7, H("#f4ecd8")), (12, H("#feae34")), (17, H("#63c74d"))]
    for x, tone in jars:
        c.rect(x, 3, 4, 6, INK)
        c.rect(x + 1, 4, 2, 4, tone)
        c.px(x + 1, 4, lit(tone, 0.5))
        c.rect(x, 2, 4, 1, H("#b86f50"))
    c.rect(0, 9, 24, 2, H("#9e5b33"))
    c.hline(0, 11, 24, H("#5a3420"))
    c.save("jar_shelf")


def pot_rack():
    """Рейлинг с половником и сковородками."""
    c = Canvas(24, 14)
    c.hline(0, 1, 24, H("#8b9bb4"))
    c.hline(0, 2, 24, H("#5a6988"))
    for x, r in ((5, 3), (14, 4)):
        c.vline(x, 3, 2, H("#5a6988"))
        c.ellipse(x + 0.5, 8, r, r * 0.9, INK)
        c.ellipse(x + 0.5, 8, r - 1, r * 0.9 - 1, H("#3a4466"))
        c.px(x - 1, 6, H("#8b9bb4"))
    c.vline(21, 3, 7, H("#c0cbdc"))
    c.rect(20, 10, 3, 2, H("#c0cbdc"))
    c.save("pot_rack")


def flour_sacks():
    """Два мешка с мукой у стены."""
    c = Canvas(18, 14)
    c.ellipse(9, 12, 8, 2, (24, 20, 37, 60))
    for x, y in ((1, 3), (8, 1)):
        c.round_rect(x, y, 9, 11, INK, r=2)
        c.round_rect(x + 1, y + 1, 7, 9, H("#efe4cc"), r=2)
        c.hline(x + 2, y + 2, 5, H("#d8c8a8"))
        c.rect(x + 3, y + 5, 3, 2, H("#3d8be0"))
    c.save("flour_sacks")


def paper_bag():
    """Бумажный пакет с покупками: торчат батон и зелень — с ним покупатель уходит."""
    c = Canvas(12, 15)
    c.line(7, 0, 9, 5, H("#b86f50"))
    c.line(8, 0, 10, 5, H("#e8a65a"))
    c.rect(2, 2, 2, 4, H("#3e8948"))
    c.px(1, 3, H("#63c74d"))
    c.px(4, 2, H("#63c74d"))
    c.rect(1, 5, 10, 10, INK)
    c.rect(2, 6, 8, 8, H("#c8955a"))
    c.hline(2, 6, 8, H("#e0b47c"))
    c.vline(9, 7, 7, H("#a87542"))
    c.save("paper_bag")


def hand_truck():
    """Тележка-рохля водителя с двумя коробками."""
    c = Canvas(16, 22)
    c.vline(2, 1, 18, INK)
    c.vline(3, 1, 18, H("#8b9bb4"))
    c.hline(2, 19, 11, INK)
    c.hline(3, 18, 10, H("#8b9bb4"))
    for y in (2, 10):
        c.rect(4, y, 10, 8, INK)
        c.rect(5, y + 1, 8, 6, H("#c8955a"))
        c.hline(5, y + 1, 8, H("#e0b47c"))
        c.vline(9, y + 1, 6, H("#a87542"))
    c.ellipse(4, 20, 2, 2, INK)
    c.px(4, 20, H("#8b9bb4"))
    c.save("hand_truck")


def door_sign():
    """Табличка на двери: зелёная «ОТКРЫТО» и красная «ЗАКРЫТО» (буквы — полосками)."""
    for name, tone in (("door_sign_open", H("#3e8948")), ("door_sign_closed", H("#e43b44"))):
        c = Canvas(14, 9)
        c.line(4, 0, 2, 2, INK)
        c.line(9, 0, 11, 2, INK)
        c.round_rect(0, 2, 14, 7, INK, r=1)
        c.round_rect(1, 3, 12, 5, tone, r=1)
        for x in range(2, 12, 2):
            c.vline(x, 4, 3, H("#ffffff"))
        c.save(name)


def frost():
    """Изморозь в углу стекла холодильника: белые кристаллы, полупрозрачные."""
    c = Canvas(16, 10)
    pts = [(0, 0), (1, 0), (2, 0), (3, 0), (5, 0), (0, 1), (1, 1), (2, 1), (0, 2), (1, 2), (0, 3), (0, 5),
           (4, 1), (2, 3), (6, 1), (3, 2), (1, 4), (8, 0), (0, 7), (11, 0), (4, 3), (2, 5)]
    for i, (x, y) in enumerate(pts):
        c.px(x, y, (255, 255, 255, 200 if i < 10 else 130))
    c.save("frost")


def main():
    menu_chalk()
    jar_shelf()
    pot_rack()
    flour_sacks()
    paper_bag()
    hand_truck()
    door_sign()
    frost()


if __name__ == "__main__":
    main()
