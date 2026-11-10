"""Бабушкин двор (src/scenes/gardenFx.ts): земля двора с хозяйством, передний забор с калиткой, грядки каждой
культуры на четырёх стадиях, теплица над первой грядкой и лейка огородника.

11.11 (просьба автора: «огород в ужасном состоянии»): раньше двор рисовался кружками и полосками прямо в сцене.
Теперь — пиксельные картинки в палитре Endesga 32. Двойная детализация (в мире вдвое меньше).

Двор 138×68 точек мира = 276×136 пикселей. Места (в мире, от левого верхнего угла двора) — как в gardenFx.ts:
грядки серединами на x 38 / 76 / 114, низом на y 44 (первая, в теплице, — на 40); дорожка y 50–56 к калитке справа;
сарай слева вверху, пугало слева, подсолнухи вдоль заднего забора, внизу — тачка, бочка с водой и цветник.

    python3 art/yard.py
"""

import random

from premium import H, lit
from sprites import Canvas

W, HH = 276, 136
GRASS, GRASS_D, GRASS_L = H("#6fa83c"), H("#4f8a34"), H("#8cc04f")
SNOW, SNOW_D, SNOW_L = H("#e8eef8"), H("#c0cbdc"), H("#f4f4f4")
PATH, PATH_D, PATH_L = H("#c8a073"), H("#a8805a"), H("#dcb98c")
WOOD, WOOD_D, WOOD_L = H("#8f563b"), H("#5e3a2a"), H("#b86f50")
PICKET, PICKET_D = H("#f4f4f4"), H("#c0cbdc")
LEAF, LEAF_D, LEAF_L = H("#3e8948"), H("#265c42"), H("#63c74d")
SOIL, SOIL_D, SOIL_L = H("#733e39"), H("#3e2731"), H("#8f563b")
INK = H("#181425")


def picket_row(c, x0, x1, base, tall=12):
    """Штакетник: планки с острым верхом, две перекладины, тень справа у каждой планки."""
    c.rect(x0, base - tall + 3, x1 - x0, 2, PICKET_D)
    c.rect(x0, base - 4, x1 - x0, 2, PICKET_D)
    for x in range(x0, x1 - 2, 5):
        c.rect(x, base - tall + 1, 3, tall - 1, PICKET)
        c.px(x + 1, base - tall, PICKET)
        c.vline(x + 2, base - tall + 1, tall - 1, PICKET_D)
        c.hline(x, base - 1, 3, lit(PICKET_D, -0.2))


def sunflower(c, x, base, tall, snow):
    if snow:
        # Зимой — сухие стебли с поникшими шапками.
        c.vline(x, base - tall, tall, H("#8f563b"))
        c.rect(x - 1, base - tall - 1, 3, 2, H("#5e3a2a"))
        c.px(x, base - tall - 2, SNOW_L)
        return
    c.vline(x, base - tall, tall, LEAF)
    c.vline(x + 1, base - tall + 4, tall - 4, LEAF_D)
    for k, side in ((tall // 3, -1), (tall * 2 // 3, 1)):
        y = base - k
        c.hline(x + (side < 0) * -3 + (side > 0) * 2, y, 3, LEAF_L if side < 0 else LEAF)
        c.px(x + (side < 0) * -3 + (side > 0) * 4, y - 1, LEAF_L)
    cy = base - tall - 3
    c.ellipse(x + 0.5, cy + 0.5, 4.6, 4.6, H("#feae34"))
    c.ellipse(x + 0.5, cy, 4.2, 4.0, H("#fee761"))
    for dx, dy in ((-4, 0), (4, 0), (0, -4), (0, 4)):
        c.px(x + dx, cy + dy, H("#feae34"))
    c.ellipse(x + 0.5, cy + 0.5, 2.2, 2.2, H("#733e39"))
    c.px(x - 1, cy - 1, H("#be4a2f"))
    c.px(x + 1, cy + 1, H("#3e2731"))


def shed(c, x, y, snow):
    """Сарайчик с инструментом: дощатые стены, двускатная крыша, дверь, у стены — лопата и грабли."""
    w, h = 40, 30
    # Стены.
    c.rect(x, y + 14, w, h - 14, WOOD)
    for xx in range(x, x + w, 5):
        c.vline(xx, y + 14, h - 14, WOOD_D)
        c.vline(xx + 1, y + 14, h - 14, WOOD_L)
    c.hline(x, y + h - 1, w, lit(WOOD_D, -0.3))
    # Крыша: два ската, край темнее.
    roof, roof_d = (SNOW, SNOW_D) if snow else (H("#be4a2f"), H("#733e39"))
    for k in range(15):
        c.hline(x - 3 + k // 2, y + k, w + 6 - k // 2 * 2, roof if k < 12 else roof_d)
    for xx in range(x - 2, x + w + 2, 4):
        c.vline(xx, y + 1, 11, lit(roof, -0.12))
    c.hline(x - 3, y + 14, w + 6, roof_d)
    # Дверь с ручкой и окошко.
    c.rect(x + 22, y + 18, 11, 12, WOOD_D)
    c.rect(x + 23, y + 19, 9, 11, H("#4a2c1a"))
    c.line(x + 23, y + 19, x + 31, y + 29, WOOD_D)
    c.px(x + 30, y + 24, H("#feae34"))
    c.rect(x + 5, y + 18, 9, 7, INK)
    c.rect(x + 6, y + 19, 7, 5, H("#9cd8ff") if not snow else H("#c0cbdc"))
    c.vline(x + 9, y + 19, 5, WOOD_L)
    c.hline(x + 6, y + 21, 7, WOOD_L)
    # Лопата и грабли у стены.
    c.vline(x + 16, y + 15, 14, WOOD_L)
    c.rect(x + 15, y + 27, 3, 3, H("#8b9bb4"))
    c.vline(x + 19, y + 16, 13, WOOD_L)
    c.hline(x + 17, y + 16, 5, H("#5a6988"))
    for xx in range(x + 17, x + 22, 2):
        c.px(xx, y + 17, H("#5a6988"))


def scarecrow(c, x, base):
    """Пугало: шест, перекладина, рубаха в заплатках, соломенная шляпа, солома из рукавов."""
    c.vline(x, base - 30, 30, WOOD)
    c.vline(x + 1, base - 30, 30, WOOD_D)
    c.hline(x - 10, base - 22, 22, WOOD)
    # Рубаха.
    c.rect(x - 6, base - 23, 14, 12, H("#e43b44"))
    c.rect(x - 9, base - 23, 4, 4, H("#e43b44"))
    c.rect(x + 7, base - 23, 4, 4, H("#e43b44"))
    c.rect(x - 2, base - 19, 4, 4, H("#0099db"))
    c.vline(x + 7, base - 23, 12, H("#a22633"))
    for dx in (-11, 11):
        c.px(x + dx, base - 22, H("#feae34"))
        c.px(x + dx, base - 20, H("#fee761"))
    c.rect(x - 4, base - 11, 10, 2, H("#feae34"))
    # Голова-мешок, глаза, улыбка.
    c.rect(x - 3, base - 31, 8, 8, H("#e4a672"))
    c.px(x - 1, base - 28, INK)
    c.px(x + 2, base - 28, INK)
    c.hline(x - 1, base - 25, 4, H("#733e39"))
    # Шляпа.
    c.hline(x - 6, base - 32, 14, H("#feae34"))
    c.rect(x - 3, base - 36, 8, 4, H("#fee761"))
    c.hline(x - 3, base - 33, 8, H("#e43b44"))


def barrel(c, x, base, snow):
    """Бочка с водой: клёпки, обручи, вода сверху; рядом — пустое место под лейку огородника."""
    c.rect(x, base - 16, 14, 16, WOOD)
    for xx in range(x, x + 14, 3):
        c.vline(xx, base - 16, 16, WOOD_D)
    c.hline(x, base - 13, 14, H("#5a6988"))
    c.hline(x, base - 5, 14, H("#5a6988"))
    c.rect(x + 1, base - 17, 12, 2, SNOW_L if snow else H("#0099db"))
    c.hline(x + 2, base - 17, 5, SNOW_L if snow else H("#2ce8f5"))


def wheelbarrow(c, x, base):
    """Тачка с землёй: зелёный кузов, колесо спереди, ручки назад."""
    c.rect(x + 2, base - 9, 16, 6, LEAF)
    c.hline(x + 2, base - 9, 16, LEAF_L)
    c.hline(x + 2, base - 4, 16, LEAF_D)
    c.rect(x + 4, base - 11, 12, 2, SOIL)
    c.px(x + 7, base - 12, SOIL_L)
    c.px(x + 12, base - 12, SOIL_L)
    c.line(x + 18, base - 7, x + 25, base - 5, WOOD)
    c.vline(x + 15, base - 4, 4, WOOD_D)
    c.ellipse(x + 2.5, base - 2.5, 2.6, 2.6, INK)
    c.px(x + 2, base - 3, H("#8b9bb4"))


def flowerbed(c, x0, x1, base, snow):
    """Цветник у переднего забора: камни бордюром, цветы в три цвета."""
    rnd = random.Random(7)
    c.rect(x0, base - 6, x1 - x0, 6, SOIL)
    for x in range(x0, x1, 4):
        c.rect(x, base - 2, 3, 2, H("#8b9bb4"))
        c.px(x, base - 2, H("#c0cbdc"))
    if snow:
        c.rect(x0, base - 7, x1 - x0, 3, SNOW_L)
        return
    for x in range(x0 + 2, x1 - 1, 3):
        col = rnd.choice((H("#e43b44"), H("#fee761"), H("#f6757a"), H("#b55088")))
        top = base - 8 - rnd.randint(0, 2)
        c.vline(x, top + 1, 3, LEAF)
        c.px(x - 1, top + 3, LEAF_L)
        c.rect(x, top - 1, 2, 2, col)


def yard_ground(snow):
    """Земля двора с хозяйством 276×136: всё, что не меняется от урожая."""
    c = Canvas(W, HH)
    base, dark, light = (SNOW, SNOW_D, SNOW_L) if snow else (GRASS, GRASS_D, GRASS_L)
    c.round_rect(0, 0, W, HH, base, r=4)
    rnd = random.Random(3)
    # Травинки и кочки (зимой — блёстки и тени сугробов).
    for _ in range(420):
        x, y = rnd.randrange(4, W - 4), rnd.randrange(16, HH - 4)
        c.px(x, y, dark if rnd.random() < 0.6 else light)
        if not snow and rnd.random() < 0.4:
            c.px(x, y - 1, dark)
    # Подстриженные полосы газона.
    if not snow:
        for x in range(8, W - 8, 24):
            for y in range(18, HH - 6):
                if c.get(x, y)[3] and c.get(x, y)[:3] == GRASS[:3]:
                    for dx in range(12):
                        if c.get(x + dx, y)[:3] == GRASS[:3]:
                            c.px(x + dx, y, lit(GRASS, 0.06))
    # Дорожка: от калитки справа внизу влево, к грядкам — утоптанная земля с камушками.
    path, path_d, path_l = (SNOW_D, lit(SNOW_D, -0.15), SNOW) if snow else (PATH, PATH_D, PATH_L)
    c.rect(10, 100, W - 10, 12, path)
    c.hline(10, 100, W - 10, path_l)
    c.hline(10, 111, W - 10, path_d)
    for _ in range(60):
        c.px(rnd.randrange(12, W - 2), rnd.randrange(102, 110), path_d if rnd.random() < 0.7 else path_l)
    c.rect(W - 34, 100, 32, HH - 100, path)
    # Задний забор и боковые.
    picket_row(c, 0, W, 14, 14)
    for y in range(4, HH - 8, 1):
        c.rect(0, y, 3, 1, PICKET)
        c.px(2, y, PICKET_D)
        if y < HH - 40:
            c.rect(W - 3, y, 3, 1, PICKET)
            c.px(W - 3, y, PICKET_D)
    # Подсолнухи вдоль заднего забора.
    for i, x in enumerate(range(100, 252, 22)):
        sunflower(c, x, 30, 10 + (i % 3) * 3, snow)
    shed(c, 6, 4, snow)
    scarecrow(c, 20, 96)
    # Внизу, между дорожкой и передним забором: тачка, бочка с водой, цветник.
    wheelbarrow(c, 30, 126)
    barrel(c, 66, 126, snow)
    flowerbed(c, 96, 220, 128, snow)
    c.save("yard_ground_snow" if snow else "yard_ground")


def yard_fence():
    """Передний забор 276×16 с калиткой справа (проём 32 пикселя, створка распахнута наружу)."""
    c = Canvas(W, 16)
    picket_row(c, 0, W - 34, 16, 13)
    for x in (W - 36, W - 3):
        c.rect(x, 0, 3, 16, WOOD)
        c.vline(x, 0, 16, WOOD_L)
        c.px(x + 1, 0, WOOD_D)
    # Распахнутая створка калитки — к нам и наискось.
    for k in range(5):
        c.line(W - 33 + k * 3, 6, W - 31 + k * 3, 15, PICKET)
    c.hline(W - 33, 8, 14, PICKET_D)
    c.hline(W - 32, 13, 14, PICKET_D)
    c.save("yard_fence")


# ---------------------------------------------------------------- грядки

BED_W, BED_H = 64, 56
BED_TOP = 34


def bed_box(c, snow):
    """Грядка-короб: доски по краю, земля с бороздами. Низ — по нижнему краю картинки."""
    c.rect(0, BED_TOP, BED_W, BED_H - BED_TOP, WOOD)
    c.hline(0, BED_TOP, BED_W, WOOD_L)
    c.hline(0, BED_H - 1, BED_W, WOOD_D)
    c.vline(0, BED_TOP, BED_H - BED_TOP, WOOD_D)
    c.vline(BED_W - 1, BED_TOP, BED_H - BED_TOP, WOOD_D)
    c.rect(2, BED_TOP + 2, BED_W - 4, BED_H - BED_TOP - 5, SOIL)
    for y in (BED_TOP + 5, BED_TOP + 11, BED_TOP + 17):
        c.hline(3, y, BED_W - 6, SOIL_D)
        c.hline(3, y - 1, BED_W - 6, SOIL_L)
    if snow:
        c.rect(2, BED_TOP + 1, BED_W - 4, 4, SNOW_L)
        for x in range(3, BED_W - 3, 7):
            c.rect(x, BED_TOP + 5, 4, 2, SNOW)


def potato_tuft(c, x, y, size, ripe, rnd):
    """Кустик картошки: ботва шапкой; спелая — с сиреневыми и белыми цветками."""
    if size == 0:
        c.px(x, y - 1, LEAF_L)
        c.px(x, y, LEAF)
        return
    for k in range(size + 1):
        c.hline(x - size + k // 2, y - k, (size - k // 2) * 2 + 1, LEAF if k % 2 == 0 else LEAF_L)
    c.px(x + size, y, LEAF_D)
    if ripe:
        c.px(x - 1, y - size - 1, rnd.choice((H("#b55088"), H("#f4f4f4"))))
        c.px(x + 1, y - size, H("#f4f4f4"))


def apple_tree(c, x, base, stage, rnd):
    """Яблонька: ствол и крона; с каждой стадией выше и шире, спелая — в красных яблоках."""
    tall = (5, 11, 16, 18)[stage]
    crown = (1, 4, 6, 7)[stage]
    c.vline(x, base - tall, tall, WOOD_D)
    c.vline(x + 1, base - tall + 2, tall - 2, WOOD)
    cy = base - tall
    if stage == 0:
        c.px(x - 1, cy, LEAF_L)
        c.px(x + 2, cy + 1, LEAF_L)
        return
    c.ellipse(x + 0.5, cy, crown + 0.6, crown * 0.85 + 0.6, LEAF_D)
    c.ellipse(x + 0.5, cy, crown, crown * 0.85, LEAF)
    c.ellipse(x - crown * 0.3, cy - crown * 0.3, crown * 0.5, crown * 0.45, LEAF_L)
    if stage == 3:
        for _ in range(6):
            ax = x + rnd.randint(-crown + 1, crown - 1)
            ay = cy + rnd.randint(-crown + 2, crown - 2)
            c.rect(ax, ay, 2, 2, H("#e43b44"))
            c.px(ax, ay, H("#f6757a"))


def bed(crop, stage, snow=False):
    c = Canvas(BED_W, BED_H)
    bed_box(c, snow)
    rnd = random.Random(f"{crop}{stage}")
    rows = (BED_TOP + 9, BED_TOP + 15, BED_TOP + 21)
    if crop == "quick":
        for ry in rows:
            for x in range(7, BED_W - 4, 9):
                potato_tuft(c, x + (ry % 2) * 3, ry, (0, 2, 3, 3)[stage], stage == 3, rnd)
        if stage == 3:
            for x in (10, 26, 44):
                c.rect(x, BED_H - 5, 3, 2, H("#e4a672"))
                c.px(x, BED_H - 5, H("#ead4aa"))
    elif crop == "mix":
        # Слева — картошка, справа — две яблоньки поменьше.
        for ry in rows:
            for x in range(6, 30, 9):
                potato_tuft(c, x + (ry % 2) * 3, ry, (0, 2, 3, 3)[stage], stage == 3, rnd)
        for x in (40, 54):
            apple_tree(c, x, BED_TOP + 16, stage, rnd)
    else:
        for x in (11, 32, 53):
            apple_tree(c, x, BED_TOP + 16, stage, rnd)
    c.outline("k")
    c.save(f"yard_bed_{crop}_{stage}" + ("_snow" if snow else ""))


def bed_plot():
    """Место под грядку, которую ещё не вскопали: колышки с бечёвкой по траве."""
    c = Canvas(BED_W, BED_H)
    twine = H("#ead4aa")
    c.hline(2, BED_TOP + 2, BED_W - 4, twine)
    c.hline(2, BED_H - 3, BED_W - 4, twine)
    c.vline(2, BED_TOP + 2, BED_H - BED_TOP - 4, twine)
    c.vline(BED_W - 3, BED_TOP + 2, BED_H - BED_TOP - 4, twine)
    for x, y in ((1, BED_TOP), (BED_W - 4, BED_TOP), (1, BED_H - 5), (BED_W - 4, BED_H - 5)):
        c.rect(x, y, 3, 5, WOOD)
        c.px(x + 1, y, WOOD_L)
    c.save("yard_bed_plot")


def greenhouse():
    """Теплица над первой грядкой 80×64: белый переплёт, двускатная крыша, стёкла полупрозрачные (грядку видно)."""
    c = Canvas(80, 64)
    glass = (191, 232, 255, 70)
    glint = (255, 255, 255, 150)
    frame, frame_d = H("#f4f4f4"), H("#8b9bb4")
    left, right, top, bottom, ridge = 4, 75, 22, 63, 4
    # Стёкла: стены и крыша.
    c.rect(left, top, right - left + 1, bottom - top, glass)
    for y in range(ridge, top):
        k = (y - ridge) / (top - ridge)
        half = int(8 + k * (right - left) / 2)
        c.hline(40 - half, y, half * 2, glass)
    # Переплёт.
    c.frame(left, top, right - left + 1, bottom - top + 1, frame)
    for x in (left + 18, 40, right - 18):
        c.vline(x, top, bottom - top, frame)
    c.hline(left, top + 18, right - left, frame)
    c.line(left - 2, top, 40, ridge, frame)
    c.line(40, ridge, right + 2, top, frame)
    c.line(left + 18, top, 40, ridge + 2, frame_d)
    c.line(right - 18, top, 40, ridge + 2, frame_d)
    c.hline(left, bottom, right - left + 1, frame_d)
    # Блики.
    c.line(left + 4, top + 4, left + 10, top + 12, glint)
    c.line(right - 12, top + 22, right - 6, top + 30, glint)
    c.line(28, ridge + 8, 33, ridge + 4, glint)
    c.save("yard_greenhouse")


def watering_can():
    """Лейка огородника 14×10 (в мире 7×5): носиком вправо."""
    c = Canvas(14, 10)
    can, can_d = H("#3e8948"), H("#265c42")
    c.rect(1, 3, 8, 6, can)
    c.hline(1, 3, 8, LEAF_L)
    c.line(9, 6, 12, 2, can_d)
    c.rect(12, 1, 2, 2, can_d)
    c.line(2, 3, 5, 0, can_d)
    c.line(5, 0, 8, 3, can_d)
    c.outline("k")
    c.save("yard_can")


def hoe():
    """Тяпка огородника 6×16 (в мире 3×8)."""
    c = Canvas(6, 16)
    c.vline(2, 0, 14, WOOD_L)
    c.vline(3, 1, 13, WOOD)
    c.rect(0, 13, 5, 3, H("#8b9bb4"))
    c.hline(0, 13, 5, H("#c0cbdc"))
    c.outline("k")
    c.save("yard_hoe")


def main():
    yard_ground(False)
    yard_ground(True)
    yard_fence()
    for crop in ("quick", "mix", "apples"):
        for stage in range(4):
            bed(crop, stage)
        for stage in range(4):
            bed(crop, stage, snow=True)
    bed_plot()
    greenhouse()
    watering_can()
    hoe()


if __name__ == "__main__":
    main()
