"""Ученик из района (src/game/apprentice.ts, 13.11, задача автора #51): портреты для окон и пакет на кассе.

  portrait_appr0[_happy|_angry]  64×64 — мальчик-ученик: красная кепка козырьком вперёд, белая футболка, красный
                                 фартук с жёлтым значком «У». Чётные имена (appr.names) — мальчики.
  portrait_appr1[_happy|_angry]  64×64 — девочка-ученица: та же форма, хвостик из-под кепки. Нечётные — девочки.
                                 Обычный — в карточке и в предложении, happy — выпускник-друг, angry — конкурент.
  appr_bag                       12×14 — бумажный пакет с покупками: ученик на кассе пакует, пакет встаёт
                                 на прилавок и уезжает с покупателем (scenes/apprentice.ts).

Форма в зале собрана из общих слоёв человечка (кепка p_hair_cap и фартук acc_apron под красный тинт),
поэтому здесь только то, чего в игре ещё не было.

    python3 art/apprentice.py
"""

from sprites import Canvas, portrait, rgb, shade

CAP = rgb("#e43b44")
CAP_D = rgb("#a22633")
WHITE = "#f4f4f4"
YELLOW = rgb("#fee761")


def cap(p, hair, tail=False):
    """Кепка козырьком вперёд, из-под неё — волосы по бокам; у девочки — хвостик набок."""
    p.rect(8, 9, 2, 4, hair)
    p.rect(22, 9, 2, 4, hair)
    if tail:
        # Волосы до плеч по бокам и чёлка из-под козырька; хвостик с жёлтой резинкой.
        p.rect(7, 9, 3, 10, hair)
        p.rect(22, 9, 3, 10, hair)
        p.hline(10, 11, 3, hair)
        p.rect(25, 11, 2, 5, shade(hair, 0.85))
        p.px(25, 11, YELLOW)
    p.ellipse(16, 7.5, 9, 4, CAP)
    p.ellipse(13, 6, 3, 1.3, shade(CAP, 1.15))
    # Козырёк — тёмная полоска поперёк лба, чуть шире головы.
    p.rect(6, 9, 20, 2, CAP_D)
    p.hline(7, 9, 18, shade(CAP_D, 1.2))
    # Белая пуговка на макушке.
    p.px(16, 4, rgb("#ffffff"))


def cap_boy(p, hair):
    cap(p, hair)


def cap_girl(p, hair):
    cap(p, hair, tail=True)


def apron(p, skin, hair, shirt):
    """Красный фартук ученика с лямками и жёлтым значком «У» на груди."""
    p.rect(12, 26, 8, 6, CAP)
    p.px(12, 25, CAP)
    p.px(19, 25, CAP)
    p.hline(12, 26, 8, shade(CAP, 1.15))
    p.rect(14, 27, 2, 2, YELLOW)


def portraits():
    looks = [
        ("appr0", "#0099db", "#f2d3ab", "#733e39", cap_boy),
        ("appr1", "#63c74d", "#eec39a", "#b86f50", cap_girl),
    ]
    for name, bg, skin, hair, draw in looks:
        for mood in (None, "happy", "angry"):
            portrait(name, bg, skin, hair, WHITE, draw, apron, mood)


def bag():
    """Бумажный пакет: загнутый край, тень сбоку, торчат батон и лук."""
    c = Canvas(12, 14)
    # Батон и зелёный лук над краем пакета.
    c.rect(3, 1, 2, 5, "y")
    c.px(3, 1, "Y")
    c.vline(7, 0, 5, "E")
    c.vline(8, 1, 4, "e")
    c.rect(1, 5, 10, 8, "n")
    c.rect(8, 5, 3, 8, "B")
    c.hline(1, 5, 10, "N")
    c.hline(1, 6, 10, "B")
    c.px(5, 9, "B")
    c.px(6, 9, "B")
    c.outline("k")
    c.save("appr_bag")


def main():
    portraits()
    bag()


if __name__ == "__main__":
    main()
