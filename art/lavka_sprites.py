"""Спрайты «Лавки «Своё»» (вторая игра, src/lavka): в стиле игры — палитра Endesga, контур #181425, свет сверху-слева.
Рисуются в пикселях рисунка (DETAIL = 2), крупные постройки — в точках мира и увеличиваются вдвое. Сцену собирает art/lavka.py."""
import random
from PIL import Image
from sprites import Canvas
from premium import H, lit, mix

INK = H("#181425")
C = {k: H(v) for k, v in dict(
    ink="#181425", navy="#262b44", slate="#3a4466", steel="#5a6988", grey="#8b9bb4", silver="#c0cbdc", white="#ffffff",
    brown_d="#3b2a35", rust="#733e39", wood="#8f563b", wood_m="#b86f50", tan="#c28569", sand="#e4a672", cream="#ead4aa",
    straw="#e7cc9f", paper="#f8ebcf", red_d="#9e2835", red="#a22633", red_l="#e43b44", pink="#f6757a",
    orange="#f77622", gold="#feae34", yellow="#fee761", green_d="#265c42", green="#3e8948", leaf="#63c74d", lime="#98c95a",
    olive="#5e9535", blue_d="#124e89", blue="#0099db", cyan="#2ce8f5", plum="#68386c", magenta="#b55088", purple_d="#4a3b52",
).items()}

def big(c, k=2):
    out = Canvas(c.w * k, c.h * k)
    out.img = c.img.resize((c.w * k, c.h * k), Image.NEAREST)
    return out

def shade_rect(c, x, y, w, h, base, hi=0.18, lo=-0.25):
    c.rect(x, y, w, h, base)
    c.hline(x, y, w, lit(base, hi))
    c.vline(x, y, h, lit(base, hi * 0.6))
    c.hline(x, y + h - 1, w, lit(base, lo))
    c.vline(x + w - 1, y, h, lit(base, lo * 0.7))

# ---------------------------------------------------------------- животные (полная детализация)

def cow(facing='right', variant=0, head_down=False):
    """Корова сбоку-сверху, 34×26: белая с чёрными пятнами, розовая морда, рога."""
    w, h = 36, 28
    c = Canvas(w, h)
    body = C['white']; spot = C['navy'] if variant == 0 else C['wood']
    # Ноги (дальние темнее).
    for x, far in ((9, True), (13, False), (24, True), (28, False)):
        col = lit(body, -0.25) if far else lit(body, -0.08)
        c.rect(x, 17, 3, 8, col); c.rect(x, 24, 3, 2, C['navy'])
    # Тело.
    c.round_rect(5, 7, 28, 13, body, r=3)
    c.hline(7, 7, 24, lit(body, 0.0)); c.hline(6, 18, 26, lit(body, -0.18)); c.hline(7, 19, 24, lit(body, -0.3))
    # Пятна.
    rnd = random.Random(variant + 7)
    for sx, sy, rx, ry in ((12, 10, 4, 3), (22, 13, 4, 3), (27, 9, 2.5, 2), (8, 14, 2, 2)):
        c.ellipse(sx + rnd.randint(-1, 1), sy, rx, ry, spot)
    # Вымя.
    c.rect(19, 19, 5, 2, C['pink']); c.px(20, 21, C['pink']); c.px(22, 21, C['pink'])
    # Хвост.
    c.vline(4, 9, 7, lit(body, -0.2)); c.rect(3, 15, 2, 3, spot)
    # Голова.
    hy = 9 if head_down else 3
    c.round_rect(28, hy, 8, 9, body, r=2)
    c.rect(29, hy + 1, 4, 3, spot)
    c.rect(30, hy + 6, 6, 4, C['pink']); c.px(32, hy + 8, C['red_d']); c.px(34, hy + 8, C['red_d'])
    c.px(33, hy + 3, C['ink']); c.px(34, hy + 3, C['ink'])
    c.px(29, hy - 1, C['cream']); c.px(28, hy - 2, C['cream']); c.px(34, hy - 1, C['cream']); c.px(35, hy - 2, C['cream'])
    c.rect(27, hy + 2, 2, 2, lit(body, -0.15))  # ухо
    c.outline(INK)
    if facing == 'left':
        c.img = c.img.transpose(Image.FLIP_LEFT_RIGHT)
    return c.img

def hen(variant=0, peck=False):
    """Курица 12×12."""
    c = Canvas(14, 13)
    body = [C['white'], C['wood_m'], C['cream']][variant % 3]
    by = 5 if not peck else 6
    c.ellipse(6, by + 2.5, 4.5, 3.5, body)
    c.hline(3, by + 5, 7, lit(body, -0.25))
    c.rect(1, by - 1, 2, 3, lit(body, -0.1))  # хвост
    hx, hy = (9, by - 2) if not peck else (10, by + 2)
    c.rect(hx, hy, 3, 3, body)
    c.px(hx + 1, hy - 1, C['red_l']); c.px(hx + 2, hy - 1, C['red_l'])
    c.px(hx + 3, hy + 1, C['gold']); c.px(hx + 2, hy + 1, C['ink'])
    c.px(hx + 2, hy + 3, C['red_l']) if not peck else None
    c.vline(5, by + 6, 2, C['gold']); c.vline(8, by + 6, 2, C['gold'])
    c.outline(INK)
    return c.img

# ---------------------------------------------------------------- огород

def bed(w, h, crop, stage=3, seed=0, wet=False):
    """Грядка w×h (полная детализация): тёмная рыхлая земля в бортике и ряды растений."""
    c = Canvas(w, h)
    soil = H("#5b3a2e") if not wet else H("#3d2a2a")
    c.rect(0, 0, w, h, C['wood'])
    c.hline(0, 0, w, C['tan']); c.vline(0, 0, h, C['tan'])
    c.rect(2, 2, w - 4, h - 4, soil)
    rnd = random.Random(seed)
    for _ in range(w * h // 9):
        c.px(rnd.randrange(2, w - 2), rnd.randrange(2, h - 2), lit(soil, rnd.choice([0.1, -0.15, 0.05])))
    for yy in range(4, h - 3, 4):
        c.hline(3, yy, w - 6, lit(soil, -0.2))
    rows = list(range(6, h - 4, 9)) if crop != 'strawberry' else list(range(6, h - 4, 8))
    for ry in rows:
        for rx in range(6, w - 5, 9 if crop in ('cabbage', 'pumpkin') else 7):
            plant(c, rx + rnd.randint(-1, 1), ry, crop, stage, rnd)
    c.outline(INK)
    return c.img

def plant(c, x, y, crop, stage, rnd):
    g, gl, gd = C['leaf'], C['lime'], C['green']
    if crop == 'cabbage':
        c.ellipse(x, y, 4, 3.5, gd); c.ellipse(x, y - 0.5, 3, 2.5, C['lime']); c.ellipse(x - 0.5, y - 1, 1.6, 1.2, H("#d4ec9a"))
    elif crop == 'carrot':
        for dx, dy in ((-2, -2), (0, -3), (2, -2), (-1, -1), (1, -1)):
            c.px(x + dx, y + dy, g if (dx + dy) % 2 else gl)
        c.px(x, y - 4, gl); c.rect(x - 1, y, 3, 1, C['orange'])
    elif crop == 'tomato':
        c.vline(x, y - 5, 7, C['wood'])  # колышек
        c.ellipse(x, y - 1, 3, 3, gd); c.ellipse(x - 1, y - 2, 2, 2, g)
        for dx, dy in ((-2, 0), (2, -1), (0, 1)):
            c.px(x + dx, y + dy, C['red_l']); c.px(x + dx, y + dy - 1, H("#ff9a8a")) if dx == -2 else None
    elif crop == 'strawberry':
        c.ellipse(x, y, 3, 2, gd); c.px(x - 1, y - 1, g); c.px(x + 1, y - 1, gl)
        c.px(x + 2, y + 1, C['red_l']); c.px(x - 2, y + 1, C['red_l']); c.px(x - 2, y, C['pink'])
    elif crop == 'potato':
        c.ellipse(x, y, 3, 2.5, g); c.px(x - 1, y - 1, gl); c.px(x + 1, y - 2, C['white']); c.px(x + 2, y - 1, C['yellow'])
    elif crop == 'pumpkin':
        c.ellipse(x - 2, y - 2, 3, 2, gd); c.ellipse(x, y + 1, 3.5, 2.5, C['orange']); c.px(x - 1, y, C['gold']); c.px(x, y - 2, C['green'])
    elif crop == 'dill':
        for dx in (-2, 0, 2):
            c.vline(x + dx, y - 3, 4, g); c.px(x + dx, y - 4, C['yellow'])

def hay(w=22, h=16):
    c = Canvas(w, h)
    c.round_rect(0, 2, w, h - 2, C['straw'], r=2)
    c.round_rect(0, 0, w, 6, lit(C['straw'], 0.2), r=2)
    for x in range(2, w - 2, 3):
        c.vline(x, 6, h - 8, C['sand'])
    c.hline(0, h - 3, w, C['sand'])
    c.vline(6, 0, h, C['wood']); c.vline(w - 7, 0, h, C['wood'])
    c.outline(INK)
    return c.img

def milk_can():
    c = Canvas(10, 15)
    c.rect(1, 4, 8, 10, C['silver']); c.vline(1, 4, 10, C['white']); c.vline(7, 4, 10, C['grey']); c.vline(8, 4, 10, C['steel'])
    c.rect(2, 1, 6, 3, C['silver']); c.hline(2, 1, 6, C['white']); c.rect(3, 0, 4, 1, C['grey'])
    c.hline(1, 8, 8, C['grey'])
    c.outline(INK)
    return c.img

def cheese_wheel(small=False):
    w, h = (10, 7) if small else (14, 9)
    c = Canvas(w, h)
    c.round_rect(0, 2, w, h - 2, C['gold'], r=1); c.round_rect(0, 0, w, 4, C['yellow'], r=1)
    c.rect(w - 4, 1, 3, 3, H("#fff3b0")); c.px(3, h - 3, C['orange']); c.px(w // 2, h - 2, C['orange'])
    c.outline(INK)
    return c.img

def churn():
    c = Canvas(12, 22)
    c.rect(2, 8, 8, 13, C['wood_m'])
    c.vline(2, 8, 13, C['sand']); c.vline(9, 8, 13, C['wood'])
    for y in (10, 18): c.hline(2, y, 8, C['steel'])
    c.rect(3, 6, 6, 2, C['wood']); c.vline(6, 0, 7, C['tan']); c.rect(4, 0, 5, 1, C['tan'])
    c.outline(INK)
    return c.img

def cheese_press():
    c = Canvas(26, 26)
    c.rect(1, 2, 3, 22, C['wood']); c.rect(22, 2, 3, 22, C['wood'])
    c.rect(0, 1, 26, 3, C['wood_m']); c.hline(0, 1, 26, C['sand'])
    c.vline(13, 4, 6, C['steel']); c.rect(9, 3, 9, 2, C['grey'])
    c.rect(6, 10, 14, 3, C['wood_m']); c.hline(6, 10, 14, C['sand'])
    c.rect(7, 13, 12, 8, C['cream']); c.hline(7, 13, 12, C['paper']); c.vline(18, 13, 8, C['tan'])
    c.rect(4, 21, 18, 3, C['wood']); c.hline(4, 21, 18, C['wood_m'])
    c.outline(INK)
    return c.img

def cheese_rack():
    c = Canvas(40, 46)
    shade_rect(c, 0, 0, 40, 46, C['wood'], 0.2, -0.3)
    for y in (3, 17, 31):
        c.rect(3, y, 34, 12, H("#4a2f28"))
        c.hline(3, y + 11, 34, C['wood_m'])
        for i, x in enumerate(range(5, 34, 11)):
            img = cheese_wheel(small=True)
            c.img.alpha_composite(img, (x, y + 4))
    return c.img

def counter_wood(w=60, h=24):
    """Деревянный прилавок с весами и счётами."""
    c = Canvas(w, h)
    c.rect(0, 6, w, h - 6, C['wood_m'])
    for x in range(4, w, 8): c.vline(x, 9, h - 10, C['wood'])
    c.hline(0, h - 2, w, C['wood']); c.rect(0, 0, w, 7, C['sand']); c.hline(0, 0, w, C['cream']); c.hline(0, 6, w, C['wood'])
    # весы
    c.rect(6, -0 + 1, 12, 4, C['red']); c.rect(7, 0, 10, 2, C['silver']); c.px(12, 3, C['white'])
    # счёты
    c.rect(w - 22, 1, 14, 5, C['wood']); 
    for yy in (2, 4):
        for xx in range(w - 21, w - 9, 2): c.px(xx, yy, C['red_l'] if xx % 4 else C['cream'])
    c.outline(INK)
    return c.img

def scarecrow():
    c = Canvas(20, 30)
    c.vline(9, 6, 24, C['wood']); c.vline(10, 6, 24, C['wood_m'])
    c.rect(2, 11, 16, 2, C['wood'])
    c.rect(5, 10, 10, 9, C['blue']); c.hline(5, 10, 10, lit(C['blue'], 0.2)); c.rect(5, 19, 10, 2, C['straw'])
    c.ellipse(10, 6, 3.5, 3.5, C['cream']); c.px(9, 6, C['ink']); c.px(11, 6, C['ink'])
    c.rect(4, 1, 12, 2, C['straw']); c.rect(7, 0, 6, 2, C['straw']); c.hline(7, 2, 6, C['red_l'])
    c.px(2, 13, C['straw']); c.px(17, 13, C['straw'])
    c.outline(INK)
    return c.img

def sunflower():
    c = Canvas(10, 22)
    c.vline(5, 7, 15, C['green']); c.rect(6, 12, 3, 2, C['leaf']); c.rect(2, 15, 3, 2, C['leaf'])
    c.ellipse(5, 4.5, 4.5, 4.5, C['gold']); c.ellipse(5, 4.5, 2.2, 2.2, C['wood']); c.px(4, 3, C['yellow'])
    c.outline(INK)
    return c.img

def apple_crate(fill='apple'):
    c = Canvas(18, 12)
    c.rect(0, 3, 18, 9, C['sand']); c.hline(0, 7, 18, C['tan']); c.hline(0, 11, 18, C['wood_m']); c.vline(0, 3, 9, C['cream'])
    col = {'apple': (C['red_l'], C['lime']), 'potato': (C['tan'], C['sand']), 'pumpkin': (C['orange'], C['gold']), 'cabbage': (C['lime'], C['leaf']), 'carrot': (C['orange'], C['leaf'])}[fill]
    rnd = random.Random(fill)
    for i in range(7):
        x = 2 + i * 2 + rnd.randint(0, 1); y = rnd.randint(0, 3)
        c.rect(x, y + 1, 3, 3, col[0] if i % 3 else col[1]); c.px(x, y + 1, lit(col[0], 0.35))
    c.outline(INK)
    return c.img

# ---------------------------------------------------------------- постройки (в точках мира, ×2)

def barn(w=74, h=62):
    """Красный амбар-коровник сверху-спереди: двускатная крыша из металла, открытые ворота, внутри сено."""
    c = Canvas(w, h)
    roof = C['red']; wall = H("#b13a3a")
    top = 30
    for y in range(top):
        inset = max(0, 5 - y // 2)
        c.hline(inset, y, w - inset * 2, lit(roof, 0.15) if y < top // 2 else lit(roof, -0.05))
    for x in range(6, w - 6, 3):
        c.vline(x, 1, top - 2, lit(roof, -0.18) if x % 2 else lit(roof, 0.05))
    c.hline(3, top // 2, w - 6, lit(roof, -0.35))
    c.rect(w // 2 - 5, 3, 10, 6, C['silver']); c.hline(w // 2 - 5, 3, 10, C['white'])  # вентиляция
    # Стена.
    c.rect(1, top, w - 2, h - top, wall)
    for x in range(3, w - 2, 3): c.vline(x, top + 1, h - top - 1, lit(wall, -0.12))
    c.hline(1, top, w - 2, lit(roof, -0.5))
    # Ворота открыты: внутри тёмно, сено.
    gx, gw = w // 2 - 13, 26
    c.rect(gx, top + 6, gw, h - top - 6, H("#2a1d26"))
    c.rect(gx + 2, h - 7, gw - 4, 6, C['straw']); c.hline(gx + 2, h - 7, gw - 4, C['yellow'])
    for x in range(gx + 3, gx + gw - 3, 3): c.px(x, h - 5, C['sand'])
    # Створки ворот (распахнуты) с белым крестом.
    for sx in (gx - 9, gx + gw + 1):
        c.rect(sx, top + 6, 8, h - top - 6, wall)
        c.frame(sx, top + 6, 8, h - top - 6, C['paper'])
        c.line(sx, top + 6, sx + 7, h - 1, C['paper']); c.line(sx + 7, top + 6, sx, h - 1, C['paper'])
    c.hline(gx - 1, top + 5, gw + 2, C['paper'])
    # Чердачное окошко.
    c.rect(w // 2 - 3, top + 1, 6, 4, C['paper']); c.rect(w // 2 - 2, top + 2, 4, 2, H("#2a1d26"))
    c.outline(INK)
    return big(c).img

def coop(w=40, h=34):
    c = Canvas(w, h)
    roof = C['wood']; wall = C['sand']
    top = 16
    for y in range(top):
        inset = max(0, 3 - y // 2)
        c.hline(inset, y, w - inset * 2, lit(roof, 0.12) if y < top // 2 else roof)
    for x in range(4, w - 4, 4): c.vline(x, 1, top - 2, lit(roof, -0.15))
    c.rect(1, top, w - 2, h - top, wall)
    for y in range(top + 2, h, 3): c.hline(1, y, w - 2, lit(wall, -0.12))
    c.rect(6, top + 6, 8, h - top - 6, H("#2a1d26")); c.rect(4, h - 2, 12, 2, C['wood_m'])  # лаз и трап
    c.rect(24, top + 4, 9, 7, C['paper']); c.rect(25, top + 5, 7, 5, H("#3a4466")); c.px(26, top + 6, C['cyan'])
    c.outline(INK)
    return big(c).img

def greenhouse(w=52, h=34):
    c = Canvas(w, h)
    glass = H("#bfe6f0"); glass_d = H("#8cc7d9"); frame = C['white']
    c.rect(0, 0, w, h, glass_d)
    c.rect(0, 0, w, h // 2, glass)
    for x in range(0, w, 8): c.vline(x, 0, h, frame)
    c.hline(0, h // 2, w, frame); c.hline(0, 0, w, frame); c.hline(0, h - 1, w, frame); c.vline(w - 1, 0, h, frame)
    rnd = random.Random(3)
    for x in range(3, w - 3, 4):  # помидоры за стеклом
        c.rect(x, h // 2 + 3, 2, h // 2 - 5, C['green'])
        if rnd.random() < 0.7: c.px(x + rnd.randint(0, 1), h // 2 + rnd.randint(4, 10), C['red_l'])
    for x in range(2, w, 8): c.px(x, 2, C['white']); c.px(x + 1, 3, C['white'])
    c.rect(w // 2 - 3, h - 10, 6, 9, H("#a8d8e6")); c.frame(w // 2 - 3, h - 10, 6, 9, frame)
    c.outline(INK)
    return big(c).img

def tractor():
    c = Canvas(30, 22)
    body = C['blue']
    c.ellipse(7, 15, 6, 6, C['navy']); c.ellipse(7, 15, 3, 3, C['grey']); c.px(7, 15, C['silver'])
    c.ellipse(24, 17, 4, 4, C['navy']); c.ellipse(24, 17, 2, 2, C['grey'])
    c.rect(10, 9, 18, 6, body); c.hline(10, 9, 18, lit(body, 0.25)); c.hline(10, 14, 18, lit(body, -0.3))
    c.rect(2, 2, 11, 10, lit(body, -0.1)); c.rect(4, 4, 7, 5, H("#a8d8e6")); c.px(5, 5, C['white'])
    c.rect(2, 1, 11, 2, C['silver'])
    c.vline(22, 4, 5, C['steel']); c.px(22, 3, C['grey'])
    c.outline(INK)
    return big(c).img

def cart():
    c = Canvas(30, 16)
    c.rect(1, 4, 26, 8, C['wood_m']); c.hline(1, 4, 26, C['sand']); c.hline(1, 11, 26, C['wood'])
    for x in range(1, 27, 6): c.vline(x, 4, 8, C['wood'])
    c.ellipse(7, 13, 3, 3, C['navy']); c.ellipse(21, 13, 3, 3, C['navy']); c.px(7, 13, C['grey']); c.px(21, 13, C['grey'])
    c.hline(27, 8, 3, C['steel'])
    # ящики
    for i, (x, col) in enumerate(((3, C['red_l']), (10, C['orange']), (17, C['lime']))):
        c.rect(x, 0, 6, 5, C['sand']); c.rect(x + 1, 0, 4, 2, col); c.hline(x, 4, 6, C['tan'])
    c.outline(INK)
    return big(c).img

def train(w=150):
    """Электричка сверху-сбоку: зелёная с красной полосой, крыша серая с токоприёмником."""
    h = 28
    c = Canvas(w, h)
    body = H("#3e8948"); roof = C['silver']
    c.rect(0, 0, w, 9, roof); c.hline(0, 0, w, C['white']); c.hline(0, 8, w, C['grey'])
    for x in range(10, w, 20): c.rect(x, 3, 6, 3, C['grey'])
    c.rect(w // 3, 1, 14, 2, C['steel']); c.line(w // 3, 1, w // 3 + 7, -1, C['steel'])
    c.rect(0, 9, w, 16, body); c.hline(0, 9, w, lit(body, 0.2))
    c.rect(0, 20, w, 3, C['red_l']); c.hline(0, 23, w, lit(body, -0.3)); c.rect(0, 24, w, 2, C['navy'])
    for x in range(6, w - 8, 12):
        c.rect(x, 12, 8, 6, H("#a8d8e6")); c.px(x + 1, 13, C['white']); c.hline(x, 17, 8, H("#6aa9c4"))
    for dx in (w // 2 - 20, w - 30):
        c.rect(dx, 11, 7, 12, C['yellow']); c.vline(dx + 3, 11, 12, C['gold'])
    c.outline(INK)
    return big(c).img

def platform(w=170, h=22):
    c = Canvas(w, h)
    c.rect(0, 0, w, h, C['grey']); c.hline(0, 0, w, C['silver']); c.rect(0, 2, w, 2, C['yellow'])
    rnd = random.Random(5)
    for _ in range(w * h // 12): c.px(rnd.randrange(w), rnd.randrange(4, h), lit(C['grey'], rnd.choice([0.1, -0.1])))
    for x in range(0, w, 16): c.vline(x, 4, h - 4, lit(C['grey'], -0.15))
    c.outline(INK)
    return big(c).img

def shelter():
    c = Canvas(40, 26)
    c.rect(0, 0, 40, 8, C['blue']); c.hline(0, 0, 40, lit(C['blue'], 0.3)); c.hline(0, 7, 40, C['blue_d'])
    c.vline(2, 8, 17, C['steel']); c.vline(37, 8, 17, C['steel'])
    c.rect(4, 9, 32, 10, H("#bfe6f0")); c.hline(4, 9, 32, C['white'])
    c.rect(6, 18, 28, 3, C['wood_m']); c.hline(6, 18, 28, C['sand'])
    c.rect(14, 2, 12, 4, C['white']); c.rect(15, 3, 10, 2, C['blue_d'])
    c.outline(INK)
    return big(c).img

def rails(w):
    c = Canvas(w, 18)
    c.rect(0, 0, w, 18, H("#6b5a52"))
    for x in range(0, w, 6): c.rect(x, 1, 3, 16, C['wood'])
    for y in (4, 13): c.hline(0, y, w, C['silver']); c.hline(0, y + 1, w, C['steel'])
    return c.img

def well():
    c = Canvas(22, 30)
    c.rect(4, 0, 14, 3, C['wood']); c.hline(3, 3, 16, C['wood_m'])
    c.vline(5, 3, 14, C['wood']); c.vline(16, 3, 14, C['wood'])
    c.rect(7, 6, 8, 2, C['tan'])
    c.ellipse(11, 22, 9, 6, C['grey']); c.ellipse(11, 20, 7, 4, H("#2a3a5a")); c.hline(5, 18, 12, C['silver'])
    c.outline(INK)
    return c.img

def bench_wood():
    c = Canvas(30, 12)
    c.rect(0, 0, 30, 3, C['wood_m']); c.hline(0, 0, 30, C['sand'])
    c.rect(0, 4, 30, 3, C['wood_m']); c.hline(0, 4, 30, C['sand'])
    c.vline(3, 7, 4, C['wood']); c.vline(26, 7, 4, C['wood'])
    c.outline(INK)
    return c.img

def table_jars():
    c = Canvas(34, 22)
    c.rect(0, 8, 34, 4, C['wood_m']); c.hline(0, 8, 34, C['sand'])
    c.vline(2, 12, 9, C['wood']); c.vline(31, 12, 9, C['wood'])
    c.rect(0, 7, 34, 2, C['red_l'])  # скатерть
    for i, x in enumerate(range(3, 31, 6)):
        col = [C['red_l'], C['green'], C['orange'], C['magenta'], C['red']][i % 5]
        c.rect(x, 1, 4, 6, col); c.rect(x, 0, 4, 2, C['paper']); c.px(x, 3, lit(col, 0.4))
    c.outline(INK)
    return c.img

def wheat(w, h, seed=0):
    """Поле пшеницы: золотые колосья рядами, тени между рядами."""
    c = Canvas(w, h)
    c.rect(0, 0, w, h, H("#c9a24a"))
    rnd = random.Random(seed)
    for y in range(0, h, 4):
        c.hline(0, y + 3, w, H("#9a7a35"))
        for x in range(rnd.randint(0, 2), w, 3):
            c.px(x, y, H("#fee761") if rnd.random() < 0.5 else H("#e8c45a"))
            c.px(x, y + 1, H("#e7b84a"))
            if rnd.random() < 0.3:
                c.px(x + 1, y + 2, H("#fff3a0"))
    return c.img


def beehive():
    c = Canvas(16, 20)
    c.rect(1, 0, 14, 4, C['wood']); c.hline(0, 3, 16, C['wood']); c.hline(1, 0, 14, C['tan'])
    c.rect(2, 4, 12, 14, C['white']); c.vline(2, 4, 14, C['white']); c.vline(13, 4, 14, C['silver'])
    for y in (8, 12): c.hline(2, y, 12, C['silver'])
    c.rect(6, 15, 4, 2, C['ink'])
    c.rect(3, 18, 2, 2, C['wood']); c.rect(11, 18, 2, 2, C['wood'])
    c.outline(INK)
    return c.img


def bee():
    c = Canvas(3, 2)
    c.px(0, 0, C['gold']); c.px(1, 0, C['ink']); c.px(2, 0, C['gold']); c.px(1, 1, C['white'])
    return c.img


def bucket():
    c = Canvas(9, 9)
    c.rect(1, 2, 7, 6, C['silver']); c.vline(1, 2, 6, C['white']); c.vline(7, 2, 6, C['grey'])
    c.rect(2, 2, 5, 2, C['white']); c.line(1, 2, 4, 0, C['steel']); c.line(4, 0, 7, 2, C['steel'])
    c.outline(INK)
    return c.img


def egg_basket():
    c = Canvas(14, 10)
    c.rect(1, 4, 12, 5, C['sand']); c.hline(1, 6, 12, C['tan']); c.hline(1, 8, 12, C['wood_m'])
    for i, x in enumerate((2, 5, 8)):
        c.ellipse(x + 1.5, 3.5, 1.8, 2, C['paper'] if i % 2 else C['cream'])
    c.outline(INK)
    return c.img


def barrel():
    c = Canvas(14, 16)
    c.rect(1, 2, 12, 13, C['wood_m']); c.vline(1, 2, 13, C['sand']); c.vline(12, 2, 13, C['wood'])
    for y in (4, 11): c.hline(1, y, 12, C['steel'])
    c.ellipse(7, 2, 6, 2, H("#3a5a8a")); c.hline(3, 1, 8, H("#8fc8ff"))
    c.outline(INK)
    return c.img


def apples_on(img, seed=0, n=9):
    """Яблоки на кроне дерева из атласа."""
    im = img.copy(); px = im.load(); w, h = im.size
    rnd = random.Random(seed); placed = 0; tries = 0
    while placed < n and tries < 500:
        tries += 1
        x, y = rnd.randrange(3, w - 3), rnd.randrange(3, int(h * 0.6))
        if px[x, y][3] and px[x, y][1] > 90 and px[x - 1, y][3] and px[x + 1, y][3] and px[x, y + 1][3]:
            px[x, y] = H("#e43b44"); px[x + 1, y] = H("#a22633"); px[x, y + 1] = H("#a22633"); px[x + 1, y + 1] = H("#9e2835")
            px[x, y - 1] = H("#f6757a") if rnd.random() < 0.5 else px[x, y - 1]
            placed += 1
    return im


def cheese_case(w=70):
    """Витрина с сырами: деревянное основание, стекло сверху."""
    c = Canvas(w, 30)
    c.rect(0, 12, w, 18, C['wood_m']); c.hline(0, 12, w, C['sand']); c.hline(0, 29, w, C['wood'])
    for x in range(6, w, 12): c.vline(x, 15, 12, C['wood'])
    c.rect(1, 0, w - 2, 13, H("#d8f0f6")); c.hline(1, 0, w - 2, C['white']); c.hline(1, 12, w - 2, H("#9fc7d4"))
    for i, x in enumerate(range(4, w - 12, 13)):
        cw = cheese_wheel(small=True)
        c.img.alpha_composite(cw, (x, 4))
    c.px(3, 2, C['white']); c.px(4, 3, C['white'])
    c.outline(INK)
    return c.img


def sign_board(w=96):
    c = Canvas(w, 22)
    c.rect(0, 0, w, 22, C['wood_m']); c.hline(0, 0, w, C['sand']); c.hline(0, 21, w, C['wood'])
    for y in (7, 14): c.hline(1, y, w - 2, C['wood'])
    c.rect(3, 3, w - 6, 16, H("#5b3a2e"))
    c.px(1, 1, C['yellow']); c.px(w - 2, 1, C['yellow'])
    c.outline(INK)
    return c.img


def deck(w, h):
    """Деревянная веранда: доски поперёк, щели и сучки."""
    c = Canvas(w, h)
    rnd = random.Random(9)
    for y in range(0, h, 6):
        base = [C['sand'], H("#d9955f"), C['sand']][(y // 6) % 3]
        c.rect(0, y, w, 6, base); c.hline(0, y, w, lit(base, 0.18)); c.hline(0, y + 5, w, C['wood'])
        off = rnd.randrange(40)
        for x in range(off, w, 52 + rnd.randrange(30)):
            c.vline(x, y + 1, 4, C['wood'])
        for _ in range(w // 40):
            c.px(rnd.randrange(w), y + 2 + rnd.randrange(2), C['tan'])
    return c.img


def samovar_table():
    """Стол под яблоней: скатерть в горох, самовар, чашки, варенье."""
    c = Canvas(40, 34)
    c.rect(1, 14, 38, 12, C['white']); c.hline(1, 14, 38, C['white']); c.hline(1, 25, 38, C['silver'])
    for y in range(16, 25, 4):
        for x in range(3 + (y // 4) % 2 * 3, 38, 6): c.px(x, y, C['red_l'])
    c.vline(4, 26, 7, C['wood']); c.vline(35, 26, 7, C['wood'])
    # самовар
    c.rect(15, 4, 10, 11, C['gold']); c.vline(15, 4, 11, C['yellow']); c.vline(24, 4, 11, C['orange'])
    c.rect(17, 1, 6, 3, C['gold']); c.rect(19, 0, 2, 1, C['ink']); c.px(13, 9, C['orange']); c.px(12, 10, C['orange'])
    c.rect(16, 15, 8, 1, C['orange'])
    # чашки и варенье
    for x in (5, 30):
        c.rect(x, 11, 4, 3, C['white']); c.px(x + 4, 12, C['white']); c.hline(x, 11, 4, C['blue'])
    c.rect(9, 10, 4, 4, C['red_l']); c.rect(9, 9, 4, 1, C['paper'])
    c.outline(INK)
    return c.img


def banya():
    """Баня: тёмный сруб, дымок из трубы."""
    w, h = 40, 36
    c = Canvas(w, h)
    roof = C['slate']; wall = C['wood']
    top = 16
    for y in range(top):
        inset = max(0, 3 - y // 2)
        c.hline(inset, y, w - inset * 2, lit(roof, 0.15) if y < top // 2 else roof)
    c.hline(2, top // 2, w - 4, lit(roof, -0.3))
    c.rect(w - 12, 1, 4, 6, C['grey']); c.hline(w - 12, 1, 4, C['silver'])
    c.rect(1, top, w - 2, h - top, wall)
    for y in range(top + 1, h, 3): c.hline(1, y, w - 2, lit(wall, -0.25))
    c.rect(8, top + 6, 6, h - top - 6, H("#2a1d26")); c.rect(24, top + 4, 7, 5, H("#3a4466")); c.px(25, top + 5, C['cyan'])
    c.rect(6, h - 1, 10, 1, C['tan'])
    c.outline(INK)
    out = big(c).img
    # дымок
    s = Image.new('RGBA', out.size)
    from PIL import ImageDraw
    d = ImageDraw.Draw(s)
    for i, (dx, dy, r) in enumerate(((0, 0, 4), (4, -8, 5), (1, -17, 6))):
        x, y = 2 * (w - 10) + dx, 0 + dy + 6
        d.ellipse((x - r, y - r, x + r, y + r), fill=(220, 225, 235, 150 - i * 35))
    big_h = out.size[1] + 24
    canvas = Image.new('RGBA', (out.size[0], big_h))
    canvas.alpha_composite(out, (0, 24))
    canvas.alpha_composite(s.crop((0, 0, out.size[0], out.size[1])), (0, 8))
    return canvas


def vat():
    c = Canvas(30, 24)
    c.ellipse(15, 14, 14, 9, C['silver']); c.ellipse(15, 12, 12, 7, C['white']); c.ellipse(15, 12, 10, 5.5, C['paper'])
    c.ellipse(11, 11, 3, 1.5, C['white'])
    c.hline(4, 20, 22, C['grey'])
    c.vline(20, 2, 10, C['wood']); c.rect(19, 1, 3, 2, C['tan'])
    c.outline(INK)
    return c.img


def flour_sacks():
    c = Canvas(26, 18)
    for i, x in enumerate((1, 12)):
        c.round_rect(x, 4 - i * 2, 12, 13 + i * 2, C['cream'], r=2)
        c.vline(x + 1, 6, 9, C['paper']); c.hline(x + 1, 16, 10, C['tan'])
        c.rect(x + 3, 9 - i, 6, 3, C['wood_m']); c.rect(x + 4, 3 - i * 2, 4, 2, C['tan'])
    c.outline(INK)
    return c.img


def dough_table():
    c = Canvas(44, 24)
    c.rect(0, 0, 44, 16, C['sand']); c.hline(0, 0, 44, C['cream']); c.hline(0, 15, 44, C['tan'])
    for x in range(4, 44, 6): c.px(x, 4 + x % 3, C['paper'])
    for i, x in enumerate((6, 18, 30)):
        c.ellipse(x + 3, 8, 4, 3, C['paper']); c.px(x + 2, 7, C['white'])
    c.rect(2, 16, 40, 2, C['wood_m'])
    c.vline(3, 18, 5, C['wood']); c.vline(40, 18, 5, C['wood'])
    c.outline(INK)
    return c.img


def clothesline(w=60):
    c = Canvas(w, 30)
    c.vline(1, 0, 30, C['wood']); c.vline(w - 2, 0, 30, C['wood'])
    c.hline(1, 3, w - 2, C['silver'])
    cols = [C['blue'], C['red_l'], C['white'], C['yellow'], C['leaf']]
    x = 6
    for i, (cw, ch) in enumerate(((8, 10), (10, 14), (7, 8), (12, 10), (8, 12))):
        if x + cw > w - 4: break
        c.rect(x, 4, cw, ch, cols[i]); c.hline(x, 4, cw, lit(cols[i], 0.3)); c.hline(x, 4 + ch - 1, cw, lit(cols[i], -0.25))
        x += cw + 3
    c.outline(INK)
    return c.img


def chalkboard():
    c = Canvas(20, 26)
    c.line(2, 25, 6, 0, C['wood']); c.line(17, 25, 13, 0, C['wood'])
    c.rect(2, 2, 16, 14, C['navy']); c.frame(2, 2, 16, 14, C['wood_m'])
    for y, ln in ((5, 9), (8, 12), (11, 7)): c.hline(5, y, ln, C['paper'])
    c.px(14, 11, C['yellow'])
    c.outline(INK)
    return c.img


def flower_bed(w=40, h=14, seed=0):
    c = Canvas(w, h)
    c.rect(0, 0, w, h, H("#5b3a2e")); c.hline(0, 0, w, C['wood_m'])
    rnd = random.Random(seed)
    for x in range(2, w - 2, 3):
        y = rnd.randint(2, h - 4)
        col = rnd.choice([C['red_l'], C['yellow'], C['pink'], C['white'], C['magenta']])
        c.px(x, y, col); c.px(x + 1, y, col); c.px(x, y + 1, C['green']); c.px(x, y + 2, C['leaf'])
    c.outline(INK)
    return c.img


def cheese_case_empty(w=64):
    """Витрина сыров без сыра: головки сцена кладёт сама — сколько есть."""
    c = Canvas(w, 30)
    c.rect(0, 12, w, 18, C['wood_m']); c.hline(0, 12, w, C['sand']); c.hline(0, 29, w, C['wood'])
    for x in range(6, w, 12): c.vline(x, 15, 12, C['wood'])
    c.rect(1, 0, w - 2, 13, H("#d8f0f6")); c.hline(1, 0, w - 2, C['white']); c.hline(1, 12, w - 2, H("#9fc7d4"))
    c.px(3, 2, C['white']); c.px(4, 3, C['white'])
    c.outline(INK)
    return c.img


def banya_house():
    """Баня без дымка: дым в сцене живой (частицы)."""
    w, h = 40, 36
    c = Canvas(w, h)
    roof = C['slate']; wall = C['wood']
    top = 16
    for y in range(top):
        inset = max(0, 3 - y // 2)
        c.hline(inset, y, w - inset * 2, lit(roof, 0.15) if y < top // 2 else roof)
    c.hline(2, top // 2, w - 4, lit(roof, -0.3))
    c.rect(w - 12, 1, 4, 6, C['grey']); c.hline(w - 12, 1, 4, C['silver'])
    c.rect(1, top, w - 2, h - top, wall)
    for y in range(top + 1, h, 3): c.hline(1, y, w - 2, lit(wall, -0.25))
    c.rect(8, top + 6, 6, h - top - 6, H("#2a1d26")); c.rect(24, top + 4, 7, 5, H("#3a4466")); c.px(25, top + 5, C['cyan'])
    c.rect(6, h - 1, 10, 1, C['tan'])
    c.outline(INK)
    return big(c).img


def puff():
    """Клуб дыма или пара: мягкий, без контура (как пар чайника в игре)."""
    c = Canvas(8, 8)
    c.ellipse(4, 4, 3.6, 3.6, H("#dfe4ee")); c.ellipse(3.4, 3.2, 2, 2, C['white'])
    return c.img
