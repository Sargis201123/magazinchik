"""Значки работы на ферме «Лавки»: облачко «нужна забота» (кремовое), «готово — собирай» (золотое),
круглый таймер ожидания (кадры полосой) и значки культур с грядок. Свет сверху-слева, контур #181425."""

import math

from PIL import Image

from premium import H
from sprites import Canvas

INK = H("#181425")
WHITE = H("#ffffff")
CREAM, CREAM_D, CREAM_DD = H("#f4ead6"), H("#cfc0a3"), H("#b8a888")
GOLD, GOLD_D, GOLD_L = H("#fee761"), H("#feae34"), H("#fff7c2")
TRACK, TRACK_L = H("#3a4466"), H("#5a6988")
LEAF, LEAF_D, LEAF_L, LEAF_DD = H("#63c74d"), H("#3e8948"), H("#98c95a"), H("#265c42")
TIMER_STEPS = 20


def _ang(dx, dy):
    """Угол от «12 часов» по часовой стрелке, 0…2π."""
    return math.atan2(dx, -dy) % (2 * math.pi)


def badge(ready=False):
    """Круглое облачко 19×21 с хвостиком вниз. ready — золотое (готово, собирай)."""
    w, h, r = 19, 22, 9.5
    cx = cy = 9.5
    body, shade, shade2, hi = (GOLD, GOLD_D, H("#f77622"), GOLD_L) if ready else (CREAM, CREAM_D, CREAM_DD, WHITE)
    c = Canvas(w, h)
    # хвостик
    for y, xs in ((18, range(7, 12)), (19, range(8, 11)), (20, range(9, 10))):
        for x in xs:
            c.px(x, y, shade)
    for y in range(h):
        for x in range(w):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            d = math.hypot(dx, dy)
            if d > r - 0.6:
                continue
            a = _ang(dx, dy)
            col = body
            # тень снизу-справа, блик сверху-слева
            if d > r - 2.4 and math.pi * 0.35 < a < math.pi * 1.15:
                col = shade if d < r - 1.5 else shade2
            elif r - 3.4 < d < r - 1.6 and math.pi * 1.45 < a < math.pi * 1.95:
                col = hi
            c.px(x, y, col)
    c.outline(INK)
    return c.img


def timer_strip():
    """Кружочек ожидания 17×17: тёмная дорожка, зелёный сектор растёт по часовой от 12 часов, белая
    стрелка на кромке. TIMER_STEPS+1 кадров полосой: k/TIMER_STEPS, последний — полный (без стрелки)."""
    s = 17
    n = TIMER_STEPS + 1
    strip = Image.new("RGBA", (s * n, s))
    cx = cy = s / 2
    for k in range(n):
        p = k / TIMER_STEPS
        c = Canvas(s, s)
        for y in range(s):
            for x in range(s):
                dx, dy = x + 0.5 - cx, y + 0.5 - cy
                d = math.hypot(dx, dy)
                if d > 7.9:
                    continue
                a = _ang(dx, dy)
                if d > 6.4:
                    # кремовый ободок, снизу-справа темнее
                    col = CREAM_D if math.pi * 0.35 < a < math.pi * 1.15 else CREAM
                elif a < p * 2 * math.pi or k == n - 1:
                    col = LEAF
                    if d > 5.2 and math.pi * 0.4 < a < math.pi * 1.1:
                        col = LEAF_D
                    elif 2.6 < d < 5.2 and math.pi * 1.5 < a < math.pi * 1.95:
                        col = LEAF_L
                else:
                    col = TRACK if d > 1.2 else TRACK_L
                c.px(x, y, col)
        # стрелка: от центра к кромке по текущему углу
        if 0 < k < n - 1:
            t = p * 2 * math.pi
            for step in range(0, 7):
                rr = step * 0.9
                c.px(int(cx + math.sin(t) * rr), int(cy - math.cos(t) * rr), WHITE)
        c.px(8, 8, WHITE)
        c.outline(INK)
        strip.alpha_composite(c.img, (k * s, 0))
    return strip


# ---------------------------------------------------------------- значки культур 9×9


def crop_icon(crop):
    c = Canvas(9, 9)
    if crop == "cabbage":
        c.ellipse(4.5, 4.5, 3.7, 3.5, LEAF)
        c.ellipse(4.5, 4.3, 2.3, 2.1, LEAF_L)
        c.ellipse(4.5, 4.2, 1.2, 1.1, H("#d4f0a0"))
        c.hline(2, 7, 5, LEAF_D)
        c.px(1, 6, LEAF_D)
        c.px(7, 6, LEAF_D)
    elif crop == "carrot":
        for i in range(6):
            c.px(1 + i, 7 - i, H("#f77622"))
            c.px(2 + i, 7 - i, H("#f77622") if i < 5 else H("#feae34"))
            if i < 4:
                c.px(2 + i, 8 - i, H("#be4a2f"))
        c.px(3, 6, H("#feae34"))
        c.px(7, 1, LEAF)
        c.px(8, 0, LEAF)
        c.px(6, 0, LEAF_D)
        c.px(8, 2, LEAF_D)
    elif crop == "strawberry":
        c.ellipse(4.5, 5, 3.3, 3, H("#e43b44"))
        c.hline(3, 8, 3, H("#a22633"))
        for x, y in ((3, 4), (5, 5), (4, 6), (6, 3)):
            c.px(x, y, H("#fee761"))
        c.px(2, 3, H("#f6757a"))
        c.hline(3, 1, 3, LEAF)
        c.px(4, 0, LEAF_D)
    elif crop == "potato":
        c.ellipse(4.5, 5, 3.8, 2.8, H("#c28569"))
        c.hline(2, 3, 4, H("#e4a672"))
        c.px(3, 5, H("#8f563b"))
        c.px(6, 4, H("#8f563b"))
        c.hline(3, 7, 4, H("#b86f50"))
    elif crop == "pumpkin":
        c.ellipse(4.5, 5.2, 4, 3.2, H("#f77622"))
        c.vline(4, 3, 5, H("#be4a2f"))
        c.vline(2, 4, 3, H("#be4a2f"))
        c.vline(6, 4, 3, H("#be4a2f"))
        c.px(3, 3, H("#feae34"))
        c.vline(4, 1, 2, LEAF_D)
        c.px(5, 1, LEAF)
    elif crop == "dill":
        for x, top in ((2, 2), (4, 0), (6, 1)):
            c.vline(x, top + 1, 8 - top, LEAF)
            c.px(x - 1, top + 1, LEAF_L)
            c.px(x + 1, top + 2, LEAF_L)
            c.px(x - 1, top + 3, LEAF)
            c.px(x, top, H("#fee761"))
    elif crop == "tomato":
        c.ellipse(4.5, 5, 3.6, 3.2, H("#e43b44"))
        c.px(3, 4, H("#f6757a"))
        c.hline(3, 1, 3, LEAF)
        c.px(4, 0, LEAF_D)
    c.outline(INK)
    return c.img
