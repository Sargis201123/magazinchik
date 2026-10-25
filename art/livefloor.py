"""Живой пол: плиточные вставки отделов и газон без повтора.

Вставки отделов вместо полупрозрачных цветных рамок: перед каждой полкой на полу — своя плитка
в спокойных тонах отдела, с затиркой и фаской, как настоящая вставка в пол магазина. Пекарня —
медовый паркет, овощи — зелёно-сливочная шахматка, молочка — голубая, мясо — белый «кабанчик»
с красной каймой, напитки — синяя мозаика, заморозка — крупная ледяная плитка с изморозью,
бытовая химия — сиреневые ромбы.

    deptfloor_<отдел>       80×60 (в мире 40×30) — под полкой и перед ней
    deptfloor_<отдел>_side  60×100 (в мире 30×50) — у полки боком у стены

Газон: четыре плитки 64×64 в одной полосе grass_set (256×64). У всех одна и та же ровная трава
по краям, а кустики, клевер, цветы и пятна — внутри: сцена раскладывает их вразнобой и с
отражениями (scenes/floor.ts), и повтор не виден даже издалека.

Двойная детализация, как у всей графики (sprites.DETAIL = 2).

    python3 art/livefloor.py
"""

import math
import random

from premium import H, lit, mix
from sprites import Canvas

# ---------------------------------------------------------------- вставки отделов

# Тона отделов (в духе DEPT_FLOOR сцены, но мягче: пол не должен пестрить).
DEPTS = {
    "bakery": {"a": H("#e9b47e"), "b": H("#dda06a"), "c": H("#f0c592"), "grout": H("#b9794a"), "rim": H("#a8683f")},
    "produce": {"a": H("#b4dd94"), "b": H("#e6f1c8"), "grout": H("#8fbf6c"), "rim": H("#5e9e44")},
    "dairy": {"a": H("#bfe3f7"), "b": H("#f3fbff"), "grout": H("#95c8e8"), "rim": H("#5fa6d8")},
    "meat": {"a": H("#f7eeec"), "b": H("#efe2df"), "grout": H("#ddb8b6"), "rim": H("#cf5660")},
    "drinks": {"a": H("#94cdf2"), "b": H("#80c2ee"), "c": H("#acdaf7"), "grout": H("#62a8da"), "rim": H("#3f8fcb")},
    "frozen": {"a": H("#e2f4ff"), "b": H("#d0ebfb"), "grout": H("#9fcbe6"), "rim": H("#78b4dc")},
    "household": {"a": H("#d9c2f2"), "b": H("#f4eefb"), "grout": H("#b89ad8"), "rim": H("#9a72c8")},
}


def pattern(kind, x, y, rnd_tone):
    """Цвет плитки отдела в точке (x, y) — без каймы."""
    p = DEPTS[kind]
    if kind == "bakery":
        # Паркет «ёлочкой» попроще: доски 16×4 со сдвигом через ряд, тон доски — свой.
        row = y // 4
        shift = 8 if row % 2 else 0
        board = (x + shift) // 16
        if y % 4 == 3 or (x + shift) % 16 == 15:
            return p["grout"]
        tone = (p["a"], p["b"], p["c"])[rnd_tone(board, row) % 3]
        # Волокна дерева — редкие тёмные чёрточки вдоль доски.
        if (x * 7 + row * 13) % 23 == 0:
            return lit(tone, -0.06)
        return tone
    if kind in ("produce", "dairy"):
        # Шахматка 8×8 с тонкой затиркой.
        if x % 8 == 7 or y % 8 == 7:
            return p["grout"]
        tone = p["a"] if (x // 8 + y // 8) % 2 else p["b"]
        if x % 8 == 0 or y % 8 == 0:
            return lit(tone, 0.12)
        return tone
    if kind == "meat":
        # Белый «кабанчик» 12×6 со сдвигом через ряд.
        row = y // 6
        shift = 6 if row % 2 else 0
        if y % 6 == 5 or (x + shift) % 12 == 11:
            return p["grout"]
        tone = p["a"] if rnd_tone((x + shift) // 12, row) % 3 else p["b"]
        if y % 6 == 0:
            return lit(tone, 0.25)
        return tone
    if kind == "drinks":
        # Мозаика 4×4: квадратики трёх синих тонов вразнобой.
        if x % 4 == 3 or y % 4 == 3:
            return p["grout"]
        return (p["a"], p["b"], p["c"])[rnd_tone(x // 4, y // 4) % 3]
    if kind == "frozen":
        # Крупная ледяная плитка 16×16 с изморозью в углах.
        if x % 16 == 15 or y % 16 == 15:
            return p["grout"]
        tone = p["a"] if (x // 16 + y // 16) % 2 else p["b"]
        lx, ly = x % 16, y % 16
        if lx == 0 or ly == 0:
            return lit(tone, 0.3)
        if rnd_tone(x, y) % 37 == 0:
            return H("#ffffff")
        return tone
    if kind == "household":
        # Ромбы: диагональная шахматка.
        u, v = (x + y) // 8, (x - y + 64) // 8
        if (x + y) % 8 == 7 or (x - y + 64) % 8 == 7:
            return mix(p["a"], p["grout"], 0.5)
        return p["a"] if (u + v) % 2 else p["b"]
    raise ValueError(kind)


def inlay(kind, w, h, name, seed):
    """Вставка w×h: узор отдела, кайма в тон отдела, фаска (блик сверху и слева, тень снизу и справа)."""
    p = DEPTS[kind]
    rnd = random.Random(seed)
    tones = {}

    def rnd_tone(i, j):
        if (i, j) not in tones:
            tones[(i, j)] = rnd.randrange(1000)
        return tones[(i, j)]

    c = Canvas(w, h)
    for y in range(h):
        for x in range(w):
            c.px(x, y, pattern(kind, x - 3, y - 3, rnd_tone))
    rim = p["rim"]
    # Кайма в два ряда: тёмная затирка снаружи и полоса цвета отдела.
    c.frame(0, 0, w, h, lit(rim, -0.25))
    c.frame(1, 1, w - 2, h - 2, rim)
    # Фаска каймы: свет сверху слева.
    c.hline(2, 2, w - 4, lit(rim, 0.35))
    c.vline(2, 2, h - 4, lit(rim, 0.35))
    c.hline(2, h - 3, w - 4, lit(rim, -0.12))
    c.vline(w - 3, 2, h - 4, lit(rim, -0.12))
    c.save(name)


def dept_inlays():
    for i, kind in enumerate(DEPTS):
        inlay(kind, 80, 60, f"deptfloor_{kind}", 101 + i)
        inlay(kind, 60, 100, f"deptfloor_{kind}_side", 201 + i)


# ---------------------------------------------------------------- газон

BASE = (124, 179, 66, 255)
# Пятна — между основой и светлой/тёмной травой: заметны, но не «наклеены».
PATCH_LIGHT = (132, 186, 72, 255)
PATCH_DARK = (115, 171, 61, 255)
LIGHT = (140, 192, 78, 255)
LIGHTER = (156, 204, 92, 255)
DARK = (106, 162, 56, 255)
DARKER = (94, 149, 53, 255)


def blob(c, ox, cx, cy, r, color, rnd, keep=0.75):
    """Мягкое пятно травы чуть другого тона: три круга внахлёст, край — через пиксель (рваный)."""
    parts = [(cx + rnd.uniform(-r, r) * 0.45, cy + rnd.uniform(-r, r) * 0.35, r * rnd.uniform(0.55, 0.85)) for _ in range(3)]
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            d = min(math.hypot(x + 0.5 - px, y + 0.5 - py) / pr for px, py, pr in parts)
            if d > 1:
                continue
            if d > keep and (x * 3 + y) % 2:
                continue
            if 1 <= x < 63 and 1 <= y < 63:
                c.px(ox + x, y, color)


def lawn_tile(c, ox, seed, tufts, blades, clovers, flowers, blobs):
    """Плитка газона 64×64 в полосе со сдвигом ox. Края — ровная трава: плитки стыкуются как угодно."""
    rnd = random.Random(seed)
    c.rect(ox, 0, 64, 64, BASE)
    # Пятна чуть светлее и темнее — целиком внутри плитки.
    for _ in range(blobs):
        r = rnd.uniform(5, 9)
        cx, cy = rnd.uniform(r + 2, 62 - r), rnd.uniform(r + 2, 62 - r)
        blob(c, ox, cx, cy, r, rnd.choice((PATCH_LIGHT, PATCH_DARK, PATCH_LIGHT)), rnd)
    # Светлые травинки — по всей плитке.
    for _ in range(blades):
        x, y = rnd.randrange(1, 63), rnd.randrange(1, 63)
        c.px(ox + x, y, LIGHTER if rnd.random() < 0.6 else LIGHT)
    # Кустики травы: тёмная «галочка» с бликом сверху.
    for _ in range(tufts):
        x, y = rnd.randrange(2, 62), rnd.randrange(3, 62)
        c.px(ox + x, y, DARKER)
        c.px(ox + x + 1, y - 1, DARK)
        c.px(ox + x - 1, y - 1, DARK)
        c.px(ox + x, y - 2, LIGHTER)
    # Клевер — три тёмные точки.
    for _ in range(clovers):
        x, y = rnd.randrange(2, 61), rnd.randrange(2, 61)
        for dx, dy in ((0, 0), (1, 0), (0, 1)):
            c.px(ox + x + dx, y + dy, DARKER)
    # Цветы: белые, жёлтые, сиреневые — с тёмной ножкой.
    for _ in range(flowers):
        x, y = rnd.randrange(2, 62), rnd.randrange(2, 61)
        c.px(ox + x, y, rnd.choice(((255, 255, 255, 255), (254, 231, 97, 255), (255, 255, 255, 255), (198, 160, 230, 255))))
        c.px(ox + x, y + 1, DARKER)


def lawn_set():
    """Полоса из четырёх плиток газона: редкая, обычная, с клевером, с цветами."""
    c = Canvas(256, 64)
    lawn_tile(c, 0, 41, tufts=48, blades=90, clovers=3, flowers=0, blobs=2)
    lawn_tile(c, 64, 42, tufts=62, blades=100, clovers=4, flowers=1, blobs=3)
    lawn_tile(c, 128, 43, tufts=54, blades=96, clovers=10, flowers=0, blobs=2)
    lawn_tile(c, 192, 44, tufts=56, blades=104, clovers=4, flowers=3, blobs=3)
    c.save("grass_set")


def main():
    dept_inlays()
    lawn_set()


if __name__ == "__main__":
    main()
