"""Портреты соседей, которые присылают заявки (src/game/neighbors.ts).

Школа уже есть (portrait_school); здесь комендант общежития, воспитательница детсада,
медсестра больницы и клерк бизнес-центра.

    python3 art/sprites.py
"""

from sprites import glasses, hair_bun, hair_curly, hair_slick, portrait, rgb, tie


def hair_nursecap(p, hair):
    """Волосы под белой шапочкой с красным крестом."""
    p.ellipse(16, 8, 8.5, 5, hair)
    p.rect(8, 8, 2, 7, hair)
    p.rect(22, 8, 2, 7, hair)
    p.rect(10, 2, 12, 5, rgb("#ffffff"))
    p.hline(10, 6, 12, rgb("#c0cbdc"))
    p.rect(15, 2, 2, 4, rgb("#e43b44"))
    p.rect(14, 3, 4, 2, rgb("#e43b44"))


def bow(p, skin, hair, shirt):
    """Бант в волосах воспитательницы."""
    for x in (20, 24):
        p.ellipse(x, 5, 2, 1.6, rgb("#e43b44"))
    p.px(22, 5, rgb("#a22633"))


def main():
    portrait("commandant", "#5a6988", "#eec39a", "#733e39", "#68386c", hair_bun, glasses)
    portrait("nanny", "#f6757a", "#f2d3ab", "#feae34", "#fee761", hair_curly, bow)
    portrait("nurse", "#2ce8f5", "#eec39a", "#4a2c1a", "#ffffff", hair_nursecap)
    portrait("clerk", "#262b44", "#d9a066", "#181425", "#3a4466", hair_slick, lambda p, *a: (tie(p, *a), glasses(p, *a)))


if __name__ == "__main__":
    main()
