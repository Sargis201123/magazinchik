"""«Улица друзей» (src/game/street.ts, src/scenes/friendStreet.ts): домики магазинов друзей вдоль аллеи за дорогой.

Вид сверху-спереди, как у соседей по улице: сверху крыша с парапетом и тем, что стоит на кровле,
снизу — полоса фасада высотой 12 точек мира (витрины, дверь, навес). Вывеску с названием кладёт игра
(своя доска или премиальная из «Оформления» друга), поэтому на краю крыши над фасадом — пусто.

  fshop_0 … fshop_5        — по помещению друга: ларёк, минимаркет, супермаркет, универсам, универмаг,
                             гипермаркет; чем больше магазин, тем шире домик и наряднее фасад;
  fshop_0_lit … fshop_5_lit — тот же размер, только стёкла витрин тёплым светом: друг играл сегодня;
  fshop_lot                — пустой участок: земля с травой, низкий заборчик и щит на столбиках
                             (надпись «Сдаётся — пригласи друга» пишет игра по-нужному языку).

Детализация двойная, как у всех спрайтов (sprites.py, DETAIL): размеры ниже — в точках мира.

    python3 art/friend_street.py
"""

from premium import H, lit
from sprites import Canvas, DETAIL

INK = H("#181425")
GLASS = H("#3a4466")
GLASS_HI = H("#8fd3ff")
STEP = H("#8b9bb4")
WARM = H("#ffd890")
WARM_HI = H("#fff3c4")

# Помещение → (ширина, высота, крыша, стена, навес, второй цвет навеса) в точках мира.
LEVELS = [
    (44, 34, H("#c28569"), H("#e8c8a0"), H("#e43b44"), H("#ffffff")),  # ларёк
    (50, 36, H("#d0d8c0"), H("#f2e6c8"), H("#3e8948"), H("#ffffff")),  # минимаркет
    (56, 38, H("#c8d4e4"), H("#e8eef4"), H("#0099db"), H("#ffffff")),  # супермаркет
    (60, 40, H("#e8d0b0"), H("#f4e2c4"), H("#f77622"), H("#fee761")),  # универсам
    (64, 40, H("#e0c8d8"), H("#f2e0ea"), H("#b55088"), H("#ffffff")),  # универмаг
    (68, 42, H("#b8c8d8"), H("#dce6f0"), H("#124e89"), H("#2ce8f5")),  # гипермаркет
]
FACADE = 12


def roof(c, w, h, color, rnd):
    """Крыша с парапетом (свет слева сверху) и мелочью на кровле — вытяжка, кондиционер, люк."""
    top = h - FACADE
    c.rect(0, 0, w, top, color)
    c.rect(0, 0, w, 2, lit(color, 0.35))
    c.rect(0, 0, 2, top, lit(color, 0.35))
    c.rect(w - 2, 0, 2, top, lit(color, -0.3))
    c.rect(0, top - 2, w, 2, lit(color, -0.3))
    # Тень от парапета на кровле.
    c.rect(2, 2, w - 4, 1, lit(color, -0.12))
    c.rect(2, 2, 1, top - 4, lit(color, -0.12))
    # Кондиционер: серый короб с решёткой вентилятора.
    ax = 6 + rnd % 7
    c.rect(ax, 6, 9, 7, H("#c0cbdc"))
    c.rect(ax, 12, 9, 1, H("#8b9bb4"))
    c.frame(ax + 2, 7, 5, 4, H("#5a6988"))
    c.px(ax + 4, 9, H("#262b44"))
    # Вытяжка — кружок с тенью.
    vx = w - 12 - rnd % 5
    c.ellipse(vx, 9, 2.6, 2.6, H("#8b9bb4"))
    c.ellipse(vx - 0.5, 8.5, 1.4, 1.4, H("#dfe6ef"))
    # Люк на крыше побольше.
    if w >= 56:
        c.rect(w // 2 - 3, 5, 7, 5, lit(color, -0.25))
        c.rect(w // 2 - 2, 6, 5, 3, lit(color, -0.4))


def facade(c, w, h, wall):
    """Полоса фасада: штукатурка, цоколь, тень под карнизом."""
    y = h - FACADE
    c.rect(0, y, w, FACADE, wall)
    c.hline(0, y, w, lit(wall, -0.35))
    c.hline(0, h - 2, w, lit(wall, -0.3))
    c.hline(0, h - 1, w, lit(wall, -0.5))
    c.vline(0, y, FACADE, lit(wall, 0.2))
    c.vline(w - 1, y, FACADE, lit(wall, -0.25))


def window(c, x, y, ww, wh, frame):
    """Витрина: рама, тёмное стекло с бликом наискосок и подоконник. Возвращает стекло — для света."""
    c.rect(x - 1, y - 1, ww + 2, wh + 2, frame)
    c.rect(x, y, ww, wh, GLASS)
    c.px(x + 1, y + 1, GLASS_HI)
    c.px(x + 2, y + 1, GLASS_HI)
    c.px(x + 1, y + 2, GLASS_HI)
    c.hline(x - 1, y + wh + 1, ww + 2, STEP)
    return (x, y, ww, wh)


def door(c, x, y, frame, glass=True):
    """Дверь 6×9 со стеклом и ручкой, ступенька под ней."""
    c.rect(x - 1, y - 1, 8, 10, frame)
    c.rect(x, y, 6, 9, GLASS if glass else lit(frame, 0.3))
    c.px(x + 1, y + 1, GLASS_HI)
    c.px(x + 4, y + 5, H("#feae34"))
    c.rect(x - 2, y + 9, 10, 1, STEP)
    return (x, y, 6, 8)


def awning(c, x, y, ww, a, b):
    """Полосатый навес над витриной: полосы через точку, фестоны снизу."""
    for i in range(ww):
        col = a if (i // 2) % 2 == 0 else b
        c.rect(x + i, y, 1, 3, col)
        if i % 2 == 0:
            c.px(x + i, y + 3, col)
    c.hline(x, y, ww, lit(a, -0.3))


def level_0(c, w, h, wall, a, b):
    """Ларёк: окошко выдачи с прилавком и большой навес, сбоку дверца."""
    y = h - FACADE + 2
    glass = [window(c, 6, y + 1, 20, 6, H("#733e39"))]
    c.rect(5, y + 8, 22, 2, H("#b86f50"))
    c.hline(5, y + 8, 22, H("#e4a672"))
    awning(c, 4, y - 2, 24, a, b)
    glass.append(door(c, w - 12, y, H("#733e39"), glass=False))
    return glass[:1]


def level_1(c, w, h, wall, a, b):
    """Минимаркет: витрина, дверь, зелёный навес."""
    y = h - FACADE + 2
    glass = [window(c, 5, y + 1, 22, 7, H("#5a6988"))]
    awning(c, 4, y - 2, 24, a, b)
    glass.append(door(c, w - 15, y, H("#5a6988")))
    return glass


def level_2(c, w, h, wall, a, b):
    """Супермаркет: две витрины по бокам, стеклянная дверь посередине, синий навес по всей ширине."""
    y = h - FACADE + 2
    d = w // 2 - 3
    glass = [window(c, 4, y + 1, d - 8, 7, H("#5a6988")), window(c, d + 10, y + 1, w - d - 14, 7, H("#5a6988"))]
    glass.append(door(c, d, y, H("#262b44")))
    awning(c, 3, y - 2, d - 5, a, b)
    awning(c, d + 9, y - 2, w - d - 12, a, b)
    return glass


def level_3(c, w, h, wall, a, b):
    """Универсам: три витрины и дверь, оранжевая полоса бренда по карнизу."""
    y = h - FACADE + 2
    c.rect(0, h - FACADE, w, 1, a)
    glass = []
    for x in (4, 18, w - 18):
        glass.append(window(c, x, y + 1, 11, 7, H("#5a6988")))
    glass.append(door(c, 33, y, H("#262b44")))
    awning(c, 3, y - 2, 27, a, b)
    awning(c, w - 19, y - 2, 13, a, b)
    return glass


def level_4(c, w, h, wall, a, b):
    """Универмаг: колонны между высокими витринами, двустворчатая дверь, ковровая дорожка."""
    y = h - FACADE + 1
    glass = []
    cols = [2, 16, 26, w - 26, w - 16, w - 3]
    for x in cols:
        c.rect(x, y - 1, 2, FACADE - 2, lit(wall, 0.25))
        c.vline(x + 1, y - 1, FACADE - 2, lit(wall, -0.2))
    for x, ww in ((5, 10), (w - 13, 10)):
        glass.append(window(c, x, y + 1, ww, 8, H("#733e39")))
    for x in (19, w - 23):
        glass.append(window(c, x, y + 1, 4, 8, H("#733e39")))
    # Двустворчатая дверь и красная дорожка.
    glass.append(door(c, w // 2 - 7, y + 1, H("#733e39")))
    glass.append(door(c, w // 2 + 1, y + 1, H("#733e39")))
    c.rect(w // 2 - 6, h - 1, 12, 1, a)
    c.rect(0, h - FACADE, w, 1, a)
    return glass


def level_5(c, w, h, wall, a, b):
    """Гипермаркет: стеклянная стена во всю ширину, раздвижные двери, бирюзовая полоса."""
    y = h - FACADE + 1
    c.rect(0, h - FACADE, w, 1, b)
    glass = []
    x = 3
    while x < w - 8:
        ww = min(9, w - 4 - x)
        glass.append(window(c, x, y + 1, ww, 8, H("#262b44")))
        x += ww + 2
    # Раздвижные двери посередине: рамка светлее.
    dx = w // 2 - 6
    c.rect(dx - 1, y, 14, 10, H("#c0cbdc"))
    c.rect(dx, y + 1, 12, 9, GLASS)
    c.vline(dx + 6, y + 1, 9, H("#c0cbdc"))
    c.px(dx + 1, y + 2, GLASS_HI)
    c.px(dx + 7, y + 2, GLASS_HI)
    glass.append((dx, y + 1, 12, 8))
    return glass


BUILDERS = [level_0, level_1, level_2, level_3, level_4, level_5]


def world(c):
    """Рисовали в точках мира — увеличить в DETAIL раз без сглаживания."""
    from PIL import Image

    big = Canvas(c.w * DETAIL, c.h * DETAIL)
    big.img = c.img.resize((c.w * DETAIL, c.h * DETAIL), Image.NEAREST)
    return big


def shops():
    for level, (w, h, roof_c, wall, a, b) in enumerate(LEVELS):
        c = Canvas(w, h)
        roof(c, w, h, roof_c, level * 3 + 1)
        facade(c, w, h, wall)
        glass = BUILDERS[level](c, w, h, wall, a, b)
        world(c).save(f"fshop_{level}")
        # Свет в витринах: только стёкла, тёплым, чуть светлее к верху.
        light = Canvas(w, h)
        for x, y, ww, wh in glass:
            light.rect(x, y, ww, wh, WARM)
            light.hline(x, y, ww, WARM_HI)
        world(light).save(f"fshop_{level}_lit")


def lot():
    """Пустой участок 56×36: земля с кочками травы, заборчик спереди, щит «Сдаётся» на двух столбиках."""
    w, h = 56, 36
    c = Canvas(w, h)
    dirt = H("#c49a6c")
    c.round_rect(1, 4, w - 2, h - 6, dirt, r=2)
    c.rect(1, 4, w - 2, 1, lit(dirt, -0.25))
    for i, (x, y) in enumerate(((6, 9), (14, 22), (40, 12), (47, 25), (26, 15), (33, 27), (9, 28))):
        c.px(x, y, H("#3e8948"))
        c.px(x + 1, y - 1, H("#63c74d"))
        c.px(x + 2, y, H("#3e8948"))
        if i % 2:
            c.px(x + 4, y + 1, lit(dirt, -0.3))
    # Камешки.
    for x, y in ((20, 10), (44, 18), (12, 16), (37, 23)):
        c.px(x, y, H("#8b9bb4"))
        c.px(x + 1, y, H("#c0cbdc"))
    # Щит на двух столбиках (надпись — игрой): светлая доска с рамкой, тень на земле.
    bx, by, bw, bh = 10, 3, 36, 15
    c.rect(bx + 4, by + bh, 2, 9, H("#5a3a2a"))
    c.rect(bx + bw - 6, by + bh, 2, 9, H("#5a3a2a"))
    c.rect(bx + 2, by + bh + 9, bw - 2, 1, lit(dirt, -0.35))
    c.rect(bx - 1, by - 1, bw + 2, bh + 2, H("#733e39"))
    c.rect(bx, by, bw, bh, H("#fff3d6"))
    c.hline(bx, by, bw, H("#ffffff"))
    c.hline(bx, by + bh - 1, bw, H("#ead4aa"))
    # Заборчик спереди: штакетник с проходом посередине.
    fy = h - 6
    for x in list(range(1, 22, 3)) + list(range(34, w - 1, 3)):
        c.rect(x, fy, 2, 5, H("#ead4aa"))
        c.px(x, fy, H("#ffffff"))
        c.px(x + 1, fy + 4, H("#c28569"))
    c.hline(1, fy + 1, 21, H("#c28569"))
    c.hline(34, fy + 1, w - 35, H("#c28569"))
    world(c).save("fshop_lot")


def main():
    shops()
    lot()


if __name__ == "__main__":
    main()
