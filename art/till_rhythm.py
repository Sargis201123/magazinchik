"""Касса в ритме (src/game/tillRhythm.ts, scenes/tillBelt.ts): окно сканера на ленте кассы.

13.11, автор: «Час пик глубже». Пока игрок сам пробивает покупателя, товары едут по ленте, а у сканера горит
рамка — сюда товар должен прийти в миг касания. Рамка 28×18 (в мире 14×9): уголки и две стрелки по бокам на
линии луча. Спокойная — жёлтая; «горячая» (товар уже в окне — жми!) — белая с жёлтым ореолом.

    python3 art/till_rhythm.py   (или вместе со всем: python3 art/sprites.py)
"""

from sprites import Canvas

W, H = 28, 18


def corners(c, color, glow=None):
    """Уголки рамки: по 5 точек в стороны от угла, в ореоле — светлая кайма внутри."""
    for x0, y0, dx, dy in ((1, 1, 1, 1), (W - 2, 1, -1, 1), (1, H - 2, 1, -1), (W - 2, H - 2, -1, -1)):
        for i in range(5):
            c.px(x0 + dx * i, y0, color)
            c.px(x0, y0 + dy * i, color)
        if glow:
            for i in range(1, 4):
                c.px(x0 + dx * i, y0 + dy, glow)
                c.px(x0 + dx, y0 + dy * i, glow)


def arrows(c, color):
    """Треугольные стрелки по бокам на линии луча (середина рамки по высоте) остриём внутрь: «сюда»."""
    mid = H // 2
    for x0, d in ((3, 1), (W - 4, -1)):
        for step, half in enumerate((3, 2, 1)):
            for y in range(mid - half, mid + half):
                c.px(x0 + d * step, y, color)


def window(hot):
    c = Canvas(W, H)
    if hot:
        corners(c, "w", glow="Y")
        arrows(c, "w")
    else:
        corners(c, "Y")
        arrows(c, "y")
    c.outline("k")
    c.save("belt_window_hot" if hot else "belt_window")


def main():
    window(False)
    window(True)


if __name__ == "__main__":
    main()
