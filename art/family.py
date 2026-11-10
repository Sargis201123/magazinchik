"""Сюжет «Папа и Соня» (src/game/drama.ts): портреты, три картинки и подсолнухи у входа.

Портреты 32×32 с эмоциями: Соня — четырнадцать лет, каштановые волосы до плеч, жёлтая
заколка, сиреневая толстовка; папа (это игрок) — взъерошенный, небритый, усталые глаза.
Картинки 128×72: фото с озера на холодильнике, ночная дорога под дождём у поворота,
закат на озере — папа и Соня на мостках; фоны мест, где сцены идут чаще всего: вечер дома,
утро на кухне, бабушкина дача (звонки), бессонная ночь дома и ночной магазин. Подсолнухи 20×28 — их Соня сажает у входа.

    python3 art/sprites.py
"""

import random

from sprites import Canvas, portrait, rgb, shade, shadowed
from news import W, H, C, mix, sky

MOODS = (None, "happy", "sad", "angry", "surprised")


def hair_sonya(p, hair):
    """Волосы до плеч с чёлкой набок и жёлтая заколка."""
    p.ellipse(16, 9, 9.5, 6.5, hair)
    p.rect(6, 9, 4, 15, hair)
    p.rect(22, 9, 4, 15, hair)
    p.ellipse(8, 24, 2.5, 2, hair)
    p.ellipse(24, 24, 2.5, 2, hair)
    p.line(10, 9, 17, 6, shade(hair, 1.2))
    p.hline(9, 10, 5, hair)
    p.rect(21, 7, 3, 2, rgb("#fee761"))


def sonya_extras(mood):
    def draw(p, skin, hair, shirt):
        # Шнурки толстовки.
        p.vline(14, 26, 4, rgb("#ffffff"))
        p.vline(18, 26, 4, rgb("#ffffff"))
        if mood == "sad":
            p.px(12, 16, rgb("#5fcde4"))
            p.px(12, 17, rgb("#5fcde4"))
    return draw


def hair_father(p, hair):
    """Взъерошенные волосы: торчащие пряди, давно не стриженные виски."""
    p.ellipse(16, 8, 8.5, 5, hair)
    for x, y in ((9, 4), (13, 2), (18, 2), (22, 4), (24, 7)):
        p.rect(x, y, 2, 3, hair)
    p.rect(8, 8, 2, 6, hair)
    p.rect(22, 8, 2, 6, hair)
    p.px(15, 4, shade(hair, 1.3))


def father_extras(mood):
    def draw(p, skin, hair, shirt):
        # Щетина и тени под глазами — человек давно не высыпается.
        stubble = shade(skin, 0.86)
        for x, y in ((11, 19), (13, 21), (16, 22), (19, 21), (21, 19)):
            p.px(x, y, stubble)
        if mood != "happy":
            for x in (12, 13, 19, 20):
                p.px(x, 16, shade(skin, 0.85))
        # Воротник рубашки.
        p.line(13, 26, 15, 28, rgb("#ffffff"))
        p.line(19, 26, 17, 28, rgb("#ffffff"))
    return draw


def portraits():
    for mood in MOODS:
        portrait("sonya", "#5fcde4", "#f2d3ab", "#8f563b", "#68386c", hair_sonya, sonya_extras(mood), mood)
        portrait("father", "#5a6988", "#eec39a", "#4a2c1a", "#3e8948", hair_father, father_extras(mood), mood)


def tiny(c, x, y, shirt, hair, skin=C("#eec39a"), long_hair=False, small=False):
    """Человечек для картинок: (x, y) — макушка; small — ребёнок."""
    h = 14 if small else 18
    c.ellipse(x + 3, y + 3, 3, 3, skin)
    c.rect(x, y, 7, 2, hair)
    if long_hair:
        c.rect(x - 1, y + 1, 2, 7, hair)
        c.rect(x + 6, y + 1, 2, 7, hair)
    c.rect(x - 1, y + 6, 9, h - 11, shirt)
    c.rect(x, y + h - 5, 3, 5, C("#262b44"))
    c.rect(x + 4, y + h - 5, 3, 5, C("#262b44"))


def drama_photo():
    """Фото на холодильнике: озеро летом, трое смеются; уголок загнулся, магнит-солнышко."""
    c = Canvas(W, H)
    c.rect(0, 0, W, H, C("#c0cbdc"))
    for y in range(0, H, 6):
        c.hline(0, y, W, C("#b3bfd1"))
    # Сама фотография с белой рамкой.
    c.rect(22, 6, 84, 62, C("#ffffff"))
    photo = Canvas(76, 48)
    for y in range(48):
        photo.hline(0, y, 76, mix(C("#5fcde4"), C("#c0e8f0"), y / 30) if y < 26 else mix(C("#0099db"), C("#124e89"), (y - 26) / 22))
    photo.ellipse(62, 8, 5, 5, C("#fee761"))
    photo.rect(0, 22, 76, 4, C("#3e8948"))
    photo.ellipse(10, 22, 12, 5, C("#265c42"))
    photo.ellipse(64, 22, 14, 5, C("#265c42"))
    photo.rect(0, 40, 76, 8, C("#ead4aa"))
    tiny(photo, 18, 22, C("#3e8948"), C("#4a2c1a"))
    tiny(photo, 30, 22, C("#fee761"), C("#b86f50"), long_hair=True)
    tiny(photo, 42, 27, C("#e43b44"), C("#8f563b"), long_hair=True, small=True)
    # Тёплый выцветший тон старой фотографии.
    px = photo.img.load()
    for y in range(48):
        for x in range(76):
            r, g, b, a = px[x, y]
            px[x, y] = (min(255, int(r * 0.9 + 30)), min(255, int(g * 0.85 + 22)), int(b * 0.75 + 10), a)
    c.img.alpha_composite(photo.img, (26, 10))
    # Загнутый уголок и магнит.
    for i in range(6):
        c.hline(100 - i, 62 + i, i + 1, C("#8b9bb4"))
    c.ellipse(64, 7, 4, 4, C("#feae34"))
    c.px(63, 6, C("#fee761"))
    c.save("drama_photo")


def drama_rain():
    """Ночная загородная дорога под дождём, поворот, знак и одинокий фонарь. Никого нет."""
    c = Canvas(W, H)
    sky(c, C("#181425"), C("#262b44"), 40)
    c.rect(0, 40, W, 32, C("#265c42"))
    # Дорога уходит в поворот.
    for y in range(40, H):
        t = (y - 40) / (H - 40)
        left = int(70 - 50 * t - 16 * (1 - t))
        width = int(10 + 70 * t)
        c.hline(left, y, width, C("#3a4466"))
        if y % 4 < 2:
            c.px(left + width // 2, y, C("#ead4aa"))
    c.rect(96, 30, 2, 22, C("#8b9bb4"))
    c.rect(91, 22, 12, 10, C("#ffffff"))
    c.line(93, 30, 100, 24, C("#e43b44"))
    c.line(94, 30, 101, 24, C("#e43b44"))
    c.rect(20, 18, 2, 34, C("#5a6988"))
    c.hline(20, 18, 6, C("#5a6988"))
    c.ellipse(26, 20, 3, 2, C("#fee761"))
    c.ellipse(26, 54, 14, 3, mix(C("#fee761"), C("#3a4466"), 0.7))
    # Подсолнухи у столбика — их кто-то оставил.
    for x in (88, 92):
        c.vline(x, 54, 8, C("#3e8948"))
        c.ellipse(x, 53, 2.2, 2.2, C("#feae34"))
        c.px(x, 53, C("#733e39"))
    rnd = random.Random(4)
    for _ in range(110):
        x, y = rnd.randrange(W), rnd.randrange(H - 4)
        c.line(x, y, x - 1, y + 4, mix(C("#8b9bb4"), C("#262b44"), 0.35))
    c.save("drama_rain")


def drama_lake():
    """Закат на озере: папа и Соня сидят на мостках, рядом подсолнух."""
    c = Canvas(W, H)
    for y in range(40):
        c.hline(0, y, W, mix(C("#f77622"), C("#68386c"), 1 - y / 39) if y < 20 else mix(C("#feae34"), C("#f77622"), (y - 20) / 19))
    c.ellipse(64, 38, 12, 12, C("#fee761"))
    c.ellipse(20, 36, 22, 6, C("#4a3b52"))
    c.ellipse(108, 37, 26, 6, C("#4a3b52"))
    for y in range(40, H):
        c.hline(0, y, W, mix(C("#b55088"), C("#262b44"), (y - 40) / (H - 40)))
    for y in range(41, H, 3):
        w = max(2, 14 - (y - 40) // 3)
        c.hline(64 - w // 2, y, w, C("#fee761"))
    # Мостки.
    c.rect(30, 52, 52, 4, C("#8f563b"))
    for x in (34, 54, 76):
        c.rect(x, 56, 2, 12, C("#733e39"))
    # Силуэты: папа и Соня, она положила голову ему на плечо.
    sil = C("#262b44")
    c.ellipse(52, 40, 3.5, 3.5, sil)
    c.rect(48, 44, 9, 9, sil)
    c.ellipse(60, 43, 3, 3, sil)
    c.rect(57, 46, 7, 7, sil)
    c.rect(56, 41, 3, 4, sil)
    c.rect(50, 53, 3, 6, sil)
    c.rect(58, 53, 3, 6, sil)
    c.vline(76, 40, 12, C("#265c42"))
    c.ellipse(76, 39, 3, 3, C("#feae34"))
    c.px(76, 39, C("#733e39"))
    c.save("drama_lake")


def glow(c, cx, cy, rx, ry, color, strength):
    """Пятно света ступенями (не плавным градиентом — чтобы осталось пиксель-артом): к центру сильнее."""
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
            if d <= 1 and 0 <= x < W and 0 <= y < H:
                step = 3 - min(2, int(d * 3))
                c.px(x, y, mix(c.get(x, y), color, strength * step / 3))


def cone(c, x, top, bottom, half, color, strength):
    """Конус света от лампы: от точки (x, top) расширяется до half в каждую сторону к строке bottom."""
    for y in range(top, bottom):
        t = (y - top) / max(1, bottom - top - 1)
        w = int(2 + (half - 2) * t)
        for xx in range(x - w, x + w + 1):
            if 0 <= xx < W and 0 <= y < H:
                c.px(xx, y, mix(c.get(xx, y), color, strength * (1 - 0.45 * t)))


def window(c, x, y, w, h, top, bottom, frame):
    """Окно с рамой и перекрестьем; внутри — небо от top к bottom."""
    for yy in range(h):
        c.hline(x, y + yy, w, mix(top, bottom, yy / max(1, h - 1)))
    c.frame(x - 1, y - 1, w + 2, h + 2, frame)
    c.vline(x + w // 2, y, h, frame)
    c.hline(x, y + h // 2, w, frame)
    c.rect(x - 2, y + h + 1, w + 4, 2, frame)


def drama_home():
    """Вечер, дома: тёмная комната, лампа над столом, на столе — накрытый тарелкой остывший ужин.
    Соня ждёт за столом; второй стул пустой, на часах поздно."""
    c = Canvas(W, H)
    for y in range(52):
        c.hline(0, y, W, mix(C("#262b44"), C("#3a4466"), y / 51))
    # Пол: тёмные доски.
    c.rect(0, 52, W, 20, C("#4a2c1a"))
    for y in range(55, H, 5):
        c.hline(0, y, W, C("#3f2618"))
    c.hline(0, 52, W, C("#733e39"))
    # Окно: ночь, месяц, огни дома напротив.
    window(c, 10, 10, 26, 26, C("#181425"), C("#262b44"), C("#5a6988"))
    c.ellipse(29, 17, 3, 3, C("#ead4aa"))
    c.ellipse(30.5, 16, 2.5, 2.5, C("#1d1a2f"))
    for sx, sy in ((14, 14), (19, 20), (26, 26), (33, 13)):
        c.px(sx, sy, C("#c0cbdc"))
    c.rect(11, 30, 10, 6, C("#181425"))
    for wx, wy in ((13, 31), (17, 33), (13, 34)):
        c.px(wx, wy, C("#feae34"))
    # Часы на стене: без четверти одиннадцать.
    c.ellipse(106, 18, 5, 5, C("#ead4aa"))
    c.ellipse(106, 18, 4, 4, C("#ffffff"))
    c.line(106, 18, 106, 15, C("#262b44"))
    c.line(106, 18, 103, 17, C("#262b44"))
    # Стол и стулья.
    c.rect(44, 46, 56, 3, C("#b86f50"))
    c.hline(44, 49, 56, C("#733e39"))
    for x in (47, 95):
        c.rect(x, 50, 2, 14, C("#733e39"))
    # Пустой стул справа.
    c.rect(102, 36, 2, 28, C("#8f563b"))
    c.rect(102, 36, 9, 2, C("#8f563b"))
    c.rect(102, 50, 11, 2, C("#8f563b"))
    c.rect(111, 50, 2, 14, C("#8f563b"))
    # Соня сидит за столом слева, подперев щёку: толстовка сиреневая, волосы каштановые.
    tiny(c, 52, 30, C("#68386c"), C("#8f563b"), skin=C("#f2d3ab"), long_hair=True)
    c.px(59, 31, C("#fee761"))
    c.rect(44, 46, 56, 3, C("#b86f50"))
    # Ужин: тарелка, накрытая второй, вилка, чашка.
    c.ellipse(78, 45, 7, 2, C("#c0cbdc"))
    c.ellipse(78, 43.5, 6, 2.5, C("#ffffff"))
    c.hline(73, 44, 10, C("#c0cbdc"))
    c.hline(88, 45, 5, C("#8b9bb4"))
    c.rect(64, 42, 4, 4, C("#e43b44"))
    c.px(68, 43, C("#e43b44"))
    # Лампа над столом и её свет.
    c.vline(72, 0, 14, C("#5a6988"))
    cone(c, 72, 18, 50, 30, C("#feae34"), 0.22)
    c.rect(67, 14, 11, 2, C("#f77622"))
    c.rect(65, 16, 15, 3, C("#feae34"))
    c.hline(68, 19, 9, C("#fee761"))
    glow(c, 72, 47, 26, 3, C("#fee761"), 0.25)
    c.save("drama_home")


def drama_kitchen():
    """Утро, кухня: солнце в окне, чайник парит, на столе две чашки, на холодильнике — то самое фото."""
    c = Canvas(W, H)
    for y in range(50):
        c.hline(0, y, W, mix(C("#f2d3ab"), C("#ead4aa"), y / 49))
    # Фартук из плитки над столешницей.
    for y in range(30, 42):
        for x in range(0, 60):
            c.px(x, y, C("#ffffff") if (x // 6 + y // 6) % 2 == 0 else C("#e8dcc8"))
    # Пол в шашечку.
    for y in range(50, H):
        for x in range(W):
            c.px(x, y, C("#c0cbdc") if ((x + (y - 50) // 2) // 8 + (y - 50) // 6) % 2 == 0 else C("#8b9bb4"))
    c.hline(0, 50, W, C("#b86f50"))
    # Окно: утро, солнце, занавески.
    window(c, 62, 8, 30, 26, C("#5fcde4"), C("#c0e8f0"), C("#ffffff"))
    c.ellipse(84, 14, 4, 4, C("#fee761"))
    c.ellipse(69, 28, 6, 3, C("#3e8948"))
    for x, w in ((60, 6), (88, 6)):
        c.rect(x, 6, w, 30, C("#f77622"))
        c.vline(x + 2, 6, 30, C("#feae34"))
    c.rect(58, 5, 38, 2, C("#b86f50"))
    # Столешница с плитой и чайником.
    c.rect(0, 42, 58, 3, C("#8b9bb4"))
    c.rect(0, 45, 58, 5, C("#5a6988"))
    for x in (12, 30, 46):
        c.vline(x, 45, 5, C("#3a4466"))
    c.rect(34, 39, 14, 3, C("#262b44"))
    c.rect(37, 33, 8, 6, C("#e43b44"))
    c.rect(38, 32, 6, 1, C("#a22633"))
    c.hline(45, 35, 3, C("#e43b44"))
    c.px(41, 31, C("#262b44"))
    for sx, sy in ((48, 31), (49, 28), (47, 26), (49, 23)):
        c.px(sx, sy, C("#ffffff"))
    c.rect(8, 37, 5, 5, C("#3e8948"))
    c.rect(16, 36, 6, 6, C("#ead4aa"))
    # Холодильник с фотографией на магните.
    c.rect(100, 10, 24, 54, C("#c0cbdc"))
    c.rect(100, 10, 24, 2, C("#ffffff"))
    c.hline(100, 30, 24, C("#8b9bb4"))
    c.rect(102, 18, 2, 8, C("#8b9bb4"))
    c.rect(102, 34, 2, 12, C("#8b9bb4"))
    c.vline(123, 10, 54, C("#8b9bb4"))
    c.rect(109, 14, 11, 9, C("#ffffff"))
    c.rect(110, 15, 9, 4, C("#5fcde4"))
    c.rect(110, 19, 9, 3, C("#ead4aa"))
    for fx, col in ((112, "#3e8948"), (114, "#fee761"), (116, "#e43b44")):
        c.px(fx, 19, C(col))
    c.ellipse(114.5, 13.5, 1.5, 1.5, C("#feae34"))
    # Стол на переднем плане: две чашки и тарелка с бутербродами.
    c.rect(52, 56, 44, 3, C("#b86f50"))
    c.hline(52, 59, 44, C("#733e39"))
    for x in (55, 91):
        c.rect(x, 60, 2, 12, C("#733e39"))
    c.rect(60, 52, 4, 4, C("#ffffff"))
    c.px(64, 53, C("#ffffff"))
    c.rect(84, 52, 4, 4, C("#5fcde4"))
    c.px(88, 53, C("#5fcde4"))
    c.ellipse(74, 55, 6, 1.6, C("#ffffff"))
    c.rect(71, 53, 3, 2, C("#feae34"))
    c.rect(75, 53, 3, 2, C("#feae34"))
    # Солнечный зайчик на полу.
    glow(c, 74, 66, 22, 5, C("#fee761"), 0.3)
    c.save("drama_kitchen")


def drama_call():
    """Звонок: бабушкина дача на закате — домик с тёплым окном, яблоня, штакетник; бабушка с телефоном на крыльце."""
    c = Canvas(W, H)
    for y in range(46):
        c.hline(0, y, W, mix(C("#68386c"), C("#f77622"), y / 45) if y < 30 else mix(C("#f77622"), C("#feae34"), (y - 30) / 15))
    c.ellipse(22, 44, 9, 9, C("#fee761"))
    c.ellipse(96, 44, 34, 8, C("#4a3b52"))
    c.ellipse(10, 46, 26, 6, C("#4a3b52"))
    c.rect(0, 46, W, 26, C("#3e8948"))
    for y in range(50, H, 4):
        c.hline(0, y, W, C("#265c42") if (y // 4) % 2 else C("#3e8948"))
    # Столб и провод к дому.
    c.rect(6, 14, 2, 40, C("#733e39"))
    c.hline(3, 16, 8, C("#733e39"))
    for x in range(8, 78):
        c.px(x, int(17 + 7 * (1 - abs((x - 43) / 35) ** 2)), C("#262b44"))
    # Домик.
    c.rect(72, 34, 40, 24, C("#ead4aa"))
    for i in range(14):
        c.hline(68 + i * 2 - 0, 33 - i, 48 - i * 4 + 0, C("#b55088") if i % 3 else C("#a22633"))
    c.rect(100, 12, 5, 10, C("#8b9bb4"))
    for sx, sy in ((102, 9), (104, 6), (103, 3)):
        c.px(sx, sy, C("#c0cbdc"))
    c.rect(78, 40, 10, 10, C("#fee761"))
    c.frame(77, 39, 12, 12, C("#733e39"))
    c.vline(83, 40, 10, C("#733e39"))
    c.hline(78, 45, 10, C("#733e39"))
    c.rect(96, 42, 9, 16, C("#733e39"))
    c.px(103, 50, C("#fee761"))
    c.rect(92, 58, 18, 2, C("#8f563b"))
    glow(c, 83, 54, 12, 5, C("#fee761"), 0.3)
    # Бабушка на крыльце: седая, в вишнёвой кофте, телефон у уха.
    tiny(c, 108, 41, C("#a22633"), C("#c0cbdc"), skin=C("#f2d3ab"))
    c.rect(115, 43, 2, 4, C("#262b44"))
    # Яблоня.
    c.rect(38, 40, 3, 16, C("#733e39"))
    c.ellipse(39, 34, 13, 10, C("#265c42"))
    c.ellipse(36, 31, 9, 6, C("#3e8948"))
    for ax, ay in ((32, 33), (41, 29), (46, 36), (36, 39), (29, 38)):
        c.px(ax, ay, C("#e43b44"))
    # Штакетник.
    for x in range(0, W, 5):
        c.rect(x, 60, 3, 9, C("#ead4aa"))
        c.px(x + 1, 59, C("#ead4aa"))
    c.hline(0, 63, W, C("#b86f50"))
    c.save("drama_call")


def drama_night():
    """Ночь, дома: папе не спится. Сидит в тёмной комнате с телефоном; из прихожей — полоска света,
    там три пары тапочек (одни — с помпонами); за окном дождь."""
    c = Canvas(W, H)
    for y in range(52):
        c.hline(0, y, W, mix(C("#181425"), C("#262b44"), y / 51))
    c.rect(0, 52, W, 20, C("#1d1a2f"))
    for y in range(55, H, 5):
        c.hline(0, y, W, C("#181425"))
    c.hline(0, 52, W, C("#3a4466"))
    # Дверь в прихожую: там горит свет.
    for y in range(12, 58):
        c.hline(8, y, 20, mix(C("#feae34"), C("#b86f50"), (y - 12) / 45))
    c.frame(7, 11, 22, 48, C("#5a6988"))
    c.rect(8, 52, 20, 6, C("#8f563b"))
    # Три пары тапочек: большие, поменьше и с помпонами.
    for sx, col in ((10, "#3a4466"), (16, "#68386c"), (22, "#b55088")):
        c.rect(sx, 54, 2, 3, C(col))
        c.rect(sx + 3, 54, 2, 3, C(col))
    c.px(22, 53, C("#ffffff"))
    c.px(25, 53, C("#ffffff"))
    # Свет из двери ложится на пол комнаты.
    for i in range(10):
        c.hline(28, 58 + i, 16 - i, mix(C("#feae34"), C("#1d1a2f"), 0.72))
    # Окно: ночь, дождь по стеклу.
    window(c, 88, 8, 28, 28, C("#181425"), C("#262b44"), C("#5a6988"))
    c.ellipse(108, 14, 3, 3, C("#8b9bb4"))
    rnd = random.Random(11)
    for _ in range(26):
        x, y = 88 + rnd.randrange(27), 8 + rnd.randrange(24)
        c.line(x, y, x - 1, y + 3, mix(C("#8b9bb4"), C("#262b44"), 0.4))
    # Диван и папа на краю: локти на коленях, в руках светится телефон.
    c.rect(48, 44, 34, 10, C("#3a4466"))
    c.rect(46, 36, 4, 18, C("#3a4466"))
    c.rect(78, 40, 4, 14, C("#3a4466"))
    c.hline(48, 44, 30, C("#5a6988"))
    for x in (49, 79):
        c.rect(x, 54, 2, 4, C("#262b44"))
    tiny(c, 60, 28, C("#3e8948"), C("#4a2c1a"))
    c.rect(48, 46, 30, 8, C("#3a4466"))
    c.rect(60, 46, 3, 10, C("#262b44"))
    c.rect(64, 46, 3, 10, C("#262b44"))
    c.rect(66, 40, 2, 3, C("#5fcde4"))
    glow(c, 66, 38, 9, 8, C("#5fcde4"), 0.3)
    c.save("drama_night")


def drama_shopnight():
    """Ночь в магазине: тёмные полки, одна лампа над кассой — и папа под ней один (раскладывал товар до утра)."""
    c = Canvas(W, H)
    for y in range(50):
        c.hline(0, y, W, mix(C("#181425"), C("#262b44"), y / 49))
    for y in range(50, H):
        for x in range(W):
            c.px(x, y, C("#262b44") if ((x + (y - 50)) // 8 + (y - 50) // 6) % 2 == 0 else C("#1d1a2f"))
    # Стеклянная дверь: улица, фонарь, табличка «закрыто».
    c.rect(6, 14, 22, 44, C("#181425"))
    c.frame(5, 13, 24, 46, C("#5a6988"))
    c.vline(17, 14, 44, C("#5a6988"))
    c.rect(22, 20, 1, 30, C("#5a6988"))
    c.ellipse(22, 20, 2, 1.5, C("#fee761"))
    glow(c, 22, 50, 6, 3, C("#fee761"), 0.35)
    c.ellipse(11, 20, 2, 2, C("#ead4aa"))
    c.rect(8, 32, 8, 5, C("#e43b44"))
    c.hline(9, 34, 6, C("#ffffff"))
    # Полки в темноте: товар еле виден.
    rnd = random.Random(7)
    for sx in (38, 62):
        c.rect(sx, 18, 20, 36, C("#3a4466"))
        for sy in (26, 34, 42):
            c.hline(sx, sy, 20, C("#262b44"))
            for i in range(6):
                c.rect(sx + 1 + i * 3, sy - 4, 2, 4, mix(C(rnd.choice(["#e43b44", "#feae34", "#3e8948", "#5fcde4"])), C("#262b44"), 0.62))
    # Прилавок и касса.
    c.rect(88, 44, 36, 4, C("#b86f50"))
    c.rect(88, 48, 36, 14, C("#733e39"))
    c.hline(88, 48, 36, C("#4a2c1a"))
    c.rect(108, 36, 10, 8, C("#8b9bb4"))
    c.rect(109, 37, 8, 3, C("#63c74d"))
    c.rect(106, 43, 14, 1, C("#5a6988"))
    # Папа за прилавком: зелёная рубашка, взъерошенный; перед ним — чашка.
    tiny(c, 94, 28, C("#3e8948"), C("#4a2c1a"))
    c.rect(88, 44, 36, 4, C("#b86f50"))
    c.rect(103, 41, 3, 3, C("#ffffff"))
    # Лампа и её свет.
    c.vline(98, 0, 10, C("#5a6988"))
    cone(c, 98, 14, 46, 20, C("#feae34"), 0.3)
    c.rect(94, 10, 9, 2, C("#f77622"))
    c.rect(92, 12, 13, 2, C("#feae34"))
    glow(c, 98, 45, 18, 3, C("#fee761"), 0.3)
    # Часы: далеко за полночь.
    c.ellipse(76, 9, 4, 4, C("#5a6988"))
    c.ellipse(76, 9, 3, 3, C("#c0cbdc"))
    c.line(76, 9, 76, 7, C("#262b44"))
    c.line(76, 9, 78, 9, C("#262b44"))
    c.save("drama_shopnight")


def sunflowers():
    """Три подсолнуха у входа — их сажает Соня."""
    c = Canvas(20, 30)
    for x, top in ((4, 6), (10, 2), (16, 8)):
        c.vline(x, top + 3, 26 - top, "e")
        c.ellipse(x - 2, top + 12, 2, 1.2, "E")
        for dx, dy in ((-2, 0), (2, 0), (0, -2), (0, 2), (-1, -1), (1, 1), (1, -1), (-1, 1)):
            c.ellipse(x + dx, top + dy, 1.4, 1.4, "Y")
        c.ellipse(x, top, 1.4, 1.4, "b")
    c.rect(1, 27, 18, 3, "a")
    c.outline("k")
    return shadowed(c, 10, 29, 9, 1.5)


def main():
    portraits()
    drama_photo()
    drama_rain()
    drama_lake()
    drama_home()
    drama_kitchen()
    drama_call()
    drama_night()
    drama_shopnight()
    sunflowers().save("sunflowers")


if __name__ == "__main__":
    main()
