"""Срочные новости особых дней (src/game/bigday.ts): ведущая и картинки «в эфире» 128×72.

Картинка стоит над репликой ведущей в начале дня: что за окном — жара, мороз, вода на улицах,
трещины после толчков, карнавал или парад. Внизу — красная бегущая строка, в углу «В ЭФИРЕ».

    python3 art/sprites.py
"""

import math
import random

from sprites import Canvas, portrait, rgb, shade

W, H = 128, 72


def C(s, a=255):
    return (int(s[1:3], 16), int(s[3:5], 16), int(s[5:7], 16), a)


def mix(c1, c2, t):
    return tuple(round(c1[i] + (c2[i] - c1[i]) * t) for i in range(3)) + (255,)


def sky(c, top, bottom, h=H):
    for y in range(h):
        c.hline(0, y, W, mix(top, bottom, y / max(1, h - 1)))


def skyline(c, base, color, seed, lit=None, tall=(14, 30)):
    """Ряд домов до линии base: крыши разной высоты, окна."""
    rnd = random.Random(seed)
    x = -2
    while x < W:
        w = rnd.randrange(12, 22)
        h = rnd.randrange(*tall)
        c.rect(x, base - h, w, h, color)
        c.hline(x, base - h, w, shade(color, 1.18))
        if lit:
            for wy in range(base - h + 4, base - 3, 5):
                for wx in range(x + 3, x + w - 3, 4):
                    c.rect(wx, wy, 2, 2, lit if rnd.random() < 0.6 else shade(color, 0.8))
        x += w + rnd.randrange(0, 3)


def thermometer(c, x, y, level, liquid):
    """Градусник: трубка, шкала, столбик до level (0…1)."""
    c.round_rect(x, y, 6, 30, C("#ffffff"), r=2)
    c.ellipse(x + 3, y + 31, 4.5, 4.5, C("#ffffff"))
    c.ellipse(x + 3, y + 31, 3, 3, liquid)
    top = y + 3 + int((1 - level) * 24)
    c.rect(x + 2, top, 2, y + 30 - top, liquid)
    for k in range(5):
        c.hline(x + 7, y + 4 + k * 5, 3, C("#262b44"))


def broadcast(c):
    """Оформление эфира: «В ЭФИРЕ» в углу и бегущая строка снизу."""
    c.round_rect(4, 4, 22, 8, C("#e43b44"), r=1)
    c.ellipse(8.5, 8, 1.8, 1.8, C("#ffffff"))
    for i, x in enumerate(range(12, 24, 3)):
        c.rect(x, 6, 2, 4, C("#ffffff"))
    c.rect(0, H - 12, W, 12, C("#a22633"))
    c.rect(0, H - 12, 30, 12, C("#e43b44"))
    c.hline(0, H - 12, W, C("#f6757a"))
    for x in range(4, 26, 4):
        c.rect(x, H - 8, 3, 4, C("#ffffff"))
    rnd = random.Random(5)
    x = 34
    while x < W - 4:
        w = rnd.randrange(3, 9)
        c.rect(x, H - 7, w, 2, C("#ead4aa"))
        x += w + 2
    c.frame(0, 0, W, H, C("#181425"))


def news_heatwave():
    c = Canvas(W, H)
    sky(c, C("#feae34"), C("#f77622"), 52)
    c.ellipse(96, 18, 15, 15, C("#fee761"))
    c.ellipse(96, 18, 11, 11, C("#fff7c2"))
    for k in range(12):
        a = k * math.pi / 6
        for r in range(18, 24):
            c.px(int(96 + r * math.cos(a)), int(18 + r * math.sin(a)), C("#fee761"))
    skyline(c, 52, C("#b86f50"), 3, lit=C("#ead4aa"))
    c.rect(0, 52, W, 8, C("#8f563b"))
    # Марево над асфальтом.
    for y in (54, 57):
        for x in range(0, W, 2):
            c.px(x, y + (x // 6) % 2, C("#e4a672"))
    thermometer(c, 14, 14, 0.95, C("#e43b44"))
    broadcast(c)
    c.save("news_heatwave")


def news_frost():
    c = Canvas(W, H)
    sky(c, C("#8b9bb4"), C("#c0cbdc"), 52)
    skyline(c, 52, C("#5a6988"), 7, lit=C("#fee761"))
    rnd = random.Random(11)
    c.rect(0, 52, W, 8, C("#ffffff"))
    c.hline(0, 52, W, C("#c0cbdc"))
    for _ in range(90):
        x, y = rnd.randrange(W), rnd.randrange(0, 58)
        c.px(x, y, C("#ffffff"))
    thermometer(c, 14, 14, 0.12, C("#0099db"))
    # Снежинка-знак.
    for a in range(6):
        ang = a * math.pi / 3
        for r in range(0, 9):
            c.px(int(100 + r * math.cos(ang)), int(22 + r * math.sin(ang)), C("#ffffff"))
    broadcast(c)
    c.save("news_frost")


def news_flood():
    c = Canvas(W, H)
    sky(c, C("#5a6988"), C("#8b9bb4"), 40)
    skyline(c, 48, C("#4a3b52"), 21, lit=C("#ead4aa"), tall=(16, 34))
    # Вода по окна, волны и лодка спасателей.
    for y in range(40, 60):
        c.hline(0, y, W, mix(C("#124e89"), C("#0099db"), (y - 40) / 20))
    for y in range(42, 60, 4):
        for x in range(0, W, 8):
            off = (y // 4) % 2 * 4
            c.hline(x + off, y, 4, C("#2ce8f5"))
    c.ellipse(70, 43, 14, 3.5, C("#f77622"))
    c.hline(57, 41, 27, C("#feae34"))
    for x in (64, 74):
        c.rect(x, 34, 3, 6, C("#e43b44"))
        c.rect(x, 31, 3, 3, C("#eec39a"))
    rnd = random.Random(2)
    for _ in range(60):
        x, y = rnd.randrange(W), rnd.randrange(0, 40)
        c.px(x, y, C("#c0cbdc"))
        c.px(x - 1, y + 1, C("#c0cbdc"))
    broadcast(c)
    c.save("news_flood")


def news_quake():
    c = Canvas(W, H)
    sky(c, C("#c28569"), C("#e4a672"), 52)
    # Дома накренились.
    rnd = random.Random(8)
    for i, x in enumerate(range(4, W, 22)):
        h = rnd.randrange(18, 32)
        lean = (-1 if i % 2 else 1) * rnd.randrange(1, 3)
        for y in range(h):
            dx = int(lean * y / 8)
            c.hline(x + dx, 52 - y, 16, C("#733e39") if i % 2 else C("#8f563b"))
        for y in range(4, h - 2, 6):
            dx = int(lean * y / 8)
            c.rect(x + dx + 3, 52 - y - 2, 3, 3, C("#ead4aa"))
            c.rect(x + dx + 10, 52 - y - 2, 3, 3, C("#ead4aa"))
    c.rect(0, 52, W, 8, C("#5a6988"))
    # Трещина через дорогу.
    x, y = 0, 55
    while x < W:
        nx = x + rnd.randrange(4, 9)
        ny = max(52, min(59, y + rnd.randrange(-3, 4)))
        c.line(x, y, nx, ny, C("#181425"))
        c.line(x, y + 1, nx, ny + 1, C("#262b44"))
        x, y = nx, ny
    # Пыль.
    for _ in range(12):
        c.ellipse(rnd.randrange(W), rnd.randrange(42, 54), 2.5, 1.6, C("#ead4aa"))
    # Падающие кирпичи.
    for x, y in ((30, 20), (58, 14), (92, 24), (110, 12)):
        c.rect(x, y, 3, 2, C("#a22633"))
    broadcast(c)
    c.save("news_quake")


def news_carnival():
    c = Canvas(W, H)
    sky(c, C("#68386c"), C("#b55088"), 60)
    rnd = random.Random(4)
    # Гирлянда лампочек.
    for x in range(0, W, 2):
        y = 14 + int(4 * math.sin(x / 10))
        c.px(x, y, C("#262b44"))
        if x % 8 == 0:
            c.ellipse(x, y + 2, 1.5, 1.5, [C("#fee761"), C("#2ce8f5"), C("#63c74d"), C("#e43b44")][(x // 8) % 4])
    # Платформа с цветком.
    c.rect(20, 40, 52, 12, C("#feae34"))
    c.hline(20, 40, 52, C("#fee761"))
    for x in range(22, 72, 6):
        c.ellipse(x, 52, 2, 2, C("#262b44"))
    for k in range(8):
        a = k * math.pi / 4
        c.ellipse(46 + 9 * math.cos(a), 30 + 7 * math.sin(a), 5, 4, C("#f6757a"))
    c.ellipse(46, 30, 5, 5, C("#fee761"))
    # Танцоры с перьями.
    for i, x in enumerate((84, 100, 116)):
        col = [C("#63c74d"), C("#0099db"), C("#e43b44")][i]
        for k, dx in enumerate((-4, 0, 4)):
            c.ellipse(x + dx, 30, 2, 6, col if k != 1 else C("#fee761"))
        c.ellipse(x, 38, 3, 3, C("#d9a066"))
        c.rect(x - 3, 41, 7, 7, C("#b55088"))
        c.rect(x - 4, 48, 9, 2, C("#fee761"))
        c.rect(x - 2, 50, 2, 6, C("#d9a066"))
        c.rect(x + 1, 50, 2, 6, C("#d9a066"))
    for _ in range(70):
        c.px(rnd.randrange(W), rnd.randrange(0, 58), rnd.choice([C("#fee761"), C("#2ce8f5"), C("#63c74d"), C("#ffffff"), C("#f6757a")]))
    c.rect(0, 56, W, 4, C("#4a3b52"))
    broadcast(c)
    c.save("news_carnival")


def news_parade():
    c = Canvas(W, H)
    sky(c, C("#0099db"), C("#8fd7f5"), 50)
    skyline(c, 50, C("#c28569"), 13, lit=C("#ead4aa"), tall=(10, 22))
    # Флажки на верёвке.
    for x in range(0, W, 2):
        y = 10 + int(3 * math.sin(x / 12))
        c.px(x, y, C("#262b44"))
        if x % 10 == 0:
            col = [C("#e43b44"), C("#fee761"), C("#63c74d"), C("#0099db")][(x // 10) % 4]
            for k in range(5):
                c.hline(x - 2 + k // 2, y + 1 + k, 5 - k, col)
    c.rect(0, 50, W, 10, C("#8b9bb4"))
    # Оркестр: кивера, красные мундиры, трубы.
    for i, x in enumerate(range(16, W - 8, 16)):
        c.rect(x - 3, 28, 7, 7, C("#e43b44"))
        c.hline(x - 3, 28, 7, C("#fee761"))
        c.ellipse(x, 26, 1.5, 2, C("#ffffff"))
        c.rect(x - 3, 35, 7, 2, C("#181425"))
        c.ellipse(x, 39, 3, 2.5, C("#eec39a"))
        c.rect(x - 4, 42, 9, 8, C("#e43b44"))
        c.line(x - 3, 43, x + 3, 49, C("#ffffff"))
        c.line(x + 3, 43, x - 3, 49, C("#ffffff"))
        c.rect(x - 3, 50, 3, 5, C("#262b44"))
        c.rect(x + 1, 50, 3, 5, C("#262b44"))
        if i % 2:
            c.ellipse(x + 6, 40, 2.5, 2, C("#fee761"))
            c.hline(x + 2, 40, 4, C("#feae34"))
        else:
            c.rect(x - 3, 44, 7, 5, C("#ffffff"))
            c.hline(x - 3, 46, 7, C("#e43b44"))
    # Шарики.
    rnd = random.Random(9)
    for _ in range(7):
        x, y = rnd.randrange(8, W - 8), rnd.randrange(12, 26)
        col = rnd.choice([C("#e43b44"), C("#fee761"), C("#63c74d"), C("#b55088")])
        c.ellipse(x, y, 3, 3.6, col)
        c.px(x - 1, y - 2, C("#ffffff"))
        c.vline(x, y + 4, 5, C("#262b44"))
    broadcast(c)
    c.save("news_parade")


def person(c, x, y, shirt, skin=C("#eec39a"), hair=C("#4a2c1a"), pants=C("#262b44"), hat=None):
    """Маленький человечек 7×18 для картинок новостей: (x, y) — макушка."""
    c.ellipse(x + 3, y + 3, 3, 3, skin)
    c.rect(x, y, 7, 2, hair)
    if hat:
        c.rect(x - 1, y - 1, 9, 2, hat)
    c.rect(x - 1, y + 6, 9, 7, shirt)
    c.rect(x, y + 13, 3, 5, pants)
    c.rect(x + 4, y + 13, 3, 5, pants)


def news_blackout():
    c = Canvas(W, H)
    sky(c, C("#181425"), C("#262b44"), 60)
    rnd = random.Random(31)
    for _ in range(40):
        c.px(rnd.randrange(W), rnd.randrange(0, 30), C("#c0cbdc"))
    c.ellipse(104, 14, 6, 6, C("#ead4aa"))
    c.ellipse(106, 13, 5, 5, C("#262b44"))
    skyline(c, 60, C("#3a4466"), 41, lit=C("#262b44"), tall=(18, 36))
    # Свечи в нескольких окнах.
    for x, y in ((14, 40), (46, 34), (78, 44), (96, 38)):
        c.rect(x, y, 3, 3, C("#feae34"))
        c.px(x + 1, y - 1, C("#fee761"))
    # Опора ЛЭП с искрами.
    c.line(60, 60, 64, 18, C("#8b9bb4"))
    c.line(68, 60, 64, 18, C("#8b9bb4"))
    c.hline(56, 24, 17, C("#8b9bb4"))
    for x, y in ((56, 22), (72, 21), (58, 26)):
        c.px(x, y, C("#fee761"))
        c.px(x + 1, y - 1, C("#ffffff"))
    c.line(0, 26, 56, 24, C("#5a6988"))
    c.line(73, 24, W, 30, C("#5a6988"))
    broadcast(c)
    c.save("news_blackout")


def news_filming():
    c = Canvas(W, H)
    sky(c, C("#5a6988"), C("#8b9bb4"), 60)
    skyline(c, 48, C("#4a3b52"), 52, lit=C("#ead4aa"), tall=(10, 22))
    c.rect(0, 48, W, 12, C("#c28569"))
    # Лучи прожекторов.
    for x0, x1 in ((20, 60), (110, 70)):
        for k in range(10):
            c.line(x0, 16, x1 + k - 5, 50, C("#fff3b0"))
    for x in (16, 106):
        c.rect(x, 12, 9, 7, C("#262b44"))
        c.rect(x + 2, 13, 5, 5, C("#fee761"))
        c.vline(x + 4, 19, 30, C("#3a4466"))
    # Камера на штативе.
    c.rect(44, 26, 14, 9, C("#181425"))
    c.ellipse(60, 30, 3, 3, C("#5a6988"))
    c.ellipse(46, 23, 3.5, 3.5, C("#262b44"))
    c.ellipse(54, 23, 3.5, 3.5, C("#262b44"))
    c.line(51, 35, 45, 52, C("#8b9bb4"))
    c.line(51, 35, 57, 52, C("#8b9bb4"))
    # Хлопушка и актёры.
    c.rect(28, 38, 10, 7, C("#181425"))
    for x in range(28, 38, 3):
        c.px(x, 38, C("#ffffff"))
    person(c, 72, 32, C("#c0cbdc"), hat=C("#c0cbdc"))
    person(c, 86, 32, C("#b55088"), hair=C("#fee761"), hat=C("#fee761"))
    person(c, 100, 32, C("#a22633"), hat=C("#181425"))
    broadcast(c)
    c.save("news_filming")


def news_marathon():
    c = Canvas(W, H)
    sky(c, C("#2ce8f5"), C("#8fd7f5"), 50)
    skyline(c, 46, C("#c28569"), 61, lit=C("#ead4aa"), tall=(8, 18))
    c.rect(0, 46, W, 14, C("#8b9bb4"))
    # Арка финиша.
    c.rect(8, 10, 4, 40, C("#e43b44"))
    c.rect(116, 10, 4, 40, C("#e43b44"))
    c.rect(8, 10, 112, 8, C("#ffffff"))
    for x in range(14, 114, 6):
        c.rect(x, 12, 3, 4, C("#262b44") if (x // 6) % 2 else C("#e43b44"))
    rnd = random.Random(62)
    for i, x in enumerate(range(18, 112, 14)):
        shirt = [C("#e43b44"), C("#0099db"), C("#63c74d"), C("#feae34"), C("#b55088")][i % 5]
        y = 28 + (i % 2) * 6
        person(c, x, y, shirt, skin=rnd.choice([C("#eec39a"), C("#d9a066"), C("#8f563b")]))
        c.rect(x + 1, y + 8, 5, 3, C("#ffffff"))
        c.px(x + 3, y + 9, C("#262b44"))
    broadcast(c)
    c.save("news_marathon")


def news_tourbus():
    c = Canvas(W, H)
    sky(c, C("#0099db"), C("#8fd7f5"), 50)
    skyline(c, 48, C("#c28569"), 71, lit=C("#ead4aa"), tall=(10, 20))
    c.rect(0, 48, W, 12, C("#5a6988"))
    # Двухэтажный автобус.
    c.round_rect(10, 18, 70, 32, C("#feae34"), r=3)
    c.rect(10, 33, 70, 2, C("#f77622"))
    for x in range(14, 76, 10):
        c.rect(x, 21, 8, 8, C("#2ce8f5"))
        c.rect(x, 36, 8, 7, C("#2ce8f5"))
        c.px(x + 1, 22, C("#ffffff"))
    for x in (22, 66):
        c.ellipse(x, 50, 5, 5, C("#181425"))
        c.ellipse(x, 50, 2, 2, C("#8b9bb4"))
    # Туристы с фотоаппаратами и флажок гида.
    for i, x in enumerate((88, 100, 112)):
        person(c, x, 32, [C("#63c74d"), C("#f6757a"), C("#0099db")][i], hat=C("#ffffff"))
        c.rect(x + 1, 39, 5, 3, C("#181425"))
    c.vline(122, 18, 32, C("#733e39"))
    c.rect(115, 18, 7, 5, C("#e43b44"))
    broadcast(c)
    c.save("news_tourbus")


def news_starfall():
    c = Canvas(W, H)
    sky(c, C("#181425"), C("#3a4466"), 60)
    rnd = random.Random(81)
    for _ in range(70):
        c.px(rnd.randrange(W), rnd.randrange(0, 50), rnd.choice([C("#ffffff"), C("#c0cbdc"), C("#fee761")]))
    for x, y, n in ((20, 8, 14), (60, 4, 18), (96, 14, 12), (40, 22, 10)):
        for k in range(n):
            col = C("#ffffff") if k > n - 3 else C("#8fd7f5") if k > n // 2 else C("#5a6988")
            c.px(x + k, y + k // 2, col)
    # Холм и зрители.
    c.ellipse(64, 70, 80, 16, C("#262b44"))
    for i, x in enumerate(range(28, 100, 12)):
        y = 44 + abs(64 - x) // 10
        c.ellipse(x + 3, y + 3, 3, 3, C("#181425"))
        c.rect(x, y + 6, 7, 8, C("#181425"))
    broadcast(c)
    c.save("news_starfall")


def news_pigeons():
    c = Canvas(W, H)
    sky(c, C("#8fd7f5"), C("#c0cbdc"), 60)
    skyline(c, 60, C("#b86f50"), 91, lit=C("#ead4aa"), tall=(16, 30))
    rnd = random.Random(92)
    for _ in range(26):
        x, y = rnd.randrange(4, W - 8), rnd.randrange(6, 36)
        c.ellipse(x + 3, y + 2, 3, 1.6, C("#8b9bb4"))
        c.line(x, y, x + 2, y + 2, C("#5a6988"))
        c.line(x + 6, y, x + 4, y + 2, C("#5a6988"))
        c.px(x + 6, y + 2, C("#f77622"))
    # На крышах сидят.
    for x in range(6, W, 9):
        y = 30 + (x * 7) % 9
        c.ellipse(x, y, 2.4, 1.8, C("#8b9bb4"))
        c.px(x + 2, y - 1, C("#5a6988"))
    broadcast(c)
    c.save("news_pigeons")


def news_roadworks():
    c = Canvas(W, H)
    sky(c, C("#8fd7f5"), C("#c0cbdc"), 44)
    skyline(c, 40, C("#8f563b"), 101, lit=C("#ead4aa"), tall=(8, 18))
    c.rect(0, 40, W, 20, C("#5a6988"))
    # Яма и куча земли.
    c.ellipse(64, 50, 20, 5, C("#733e39"))
    c.ellipse(64, 50, 16, 3.5, C("#4a3b52"))
    c.ellipse(96, 46, 10, 6, C("#8f563b"))
    # Экскаватор.
    c.rect(14, 34, 22, 10, C("#feae34"))
    c.rect(26, 26, 10, 8, C("#feae34"))
    c.rect(28, 28, 6, 4, C("#2ce8f5"))
    c.rect(12, 44, 26, 4, C("#262b44"))
    c.line(36, 30, 50, 22, C("#f77622"))
    c.line(50, 22, 56, 40, C("#f77622"))
    c.rect(53, 40, 6, 4, C("#5a6988"))
    # Ограждения и конусы.
    for x in range(4, W, 22):
        c.rect(x, 52, 14, 3, C("#e43b44"))
        for k in range(0, 14, 4):
            c.rect(x + k, 52, 2, 3, C("#ffffff"))
        c.vline(x + 1, 55, 4, C("#262b44"))
        c.vline(x + 12, 55, 4, C("#262b44"))
    person(c, 78, 30, C("#f77622"), hat=C("#fee761"))
    broadcast(c)
    c.save("news_roadworks")


def news_sanitary():
    c = Canvas(W, H)
    sky(c, C("#c0cbdc"), C("#ffffff"), 60)
    # Витрины магазинов района.
    for x in range(0, W, 32):
        c.rect(x + 2, 16, 28, 34, C("#ead4aa"))
        c.rect(x + 5, 24, 22, 14, C("#8fd7f5"))
        for k in range(0, 28, 4):
            c.rect(x + 2 + k, 12, 4, 5, C("#e43b44") if k % 8 else C("#ffffff"))
    c.rect(0, 50, W, 10, C("#8b9bb4"))
    # Фургон СЭС и инспекторы в белом.
    c.round_rect(6, 32, 40, 18, C("#ffffff"), r=2)
    c.rect(36, 36, 9, 6, C("#2ce8f5"))
    c.rect(14, 38, 12, 3, C("#e43b44"))
    c.rect(18, 35, 3, 9, C("#e43b44"))
    for x in (14, 38):
        c.ellipse(x, 50, 4, 4, C("#181425"))
    for x in (64, 84):
        person(c, x, 32, C("#ffffff"), hat=C("#ffffff"))
        c.rect(x + 7, 39, 4, 5, C("#8f563b"))
    c.ellipse(108, 30, 7, 7, C("#5a6988"))
    c.ellipse(108, 30, 5, 5, C("#2ce8f5"))
    c.line(113, 35, 120, 44, C("#733e39"))
    broadcast(c)
    c.save("news_sanitary")


def news_wedding():
    c = Canvas(W, H)
    sky(c, C("#f6757a"), C("#ead4aa"), 60)
    # Арка из цветов.
    for k in range(40):
        a = math.pi * k / 39
        x = int(64 - 30 * math.cos(a))
        y = int(52 - 38 * math.sin(a))
        c.ellipse(x, y, 2.5, 2.5, [C("#ffffff"), C("#f6757a"), C("#e43b44")][k % 3])
    c.rect(0, 52, W, 8, C("#63c74d"))
    # Жених и невеста.
    c.ellipse(57, 30, 3, 3, C("#eec39a"))
    c.rect(54, 27, 7, 2, C("#4a2c1a"))
    c.rect(53, 34, 9, 10, C("#181425"))
    c.rect(56, 34, 3, 5, C("#ffffff"))
    c.rect(54, 44, 3, 8, C("#181425"))
    c.rect(58, 44, 3, 8, C("#181425"))
    c.ellipse(71, 30, 3, 3, C("#eec39a"))
    c.ellipse(71, 28, 4, 2.5, C("#fee761"))
    for i in range(18):
        c.hline(66 - i // 3, 34 + i, 10 + (i // 3) * 2, C("#ffffff"))
    c.rect(68, 26, 6, 3, C("#ffffff"))
    # Шарики-сердца и машина с лентами.
    for x, y in ((18, 18), (28, 12), (102, 14), (112, 20)):
        c.ellipse(x - 1.5, y, 2.4, 2.4, C("#e43b44"))
        c.ellipse(x + 1.5, y, 2.4, 2.4, C("#e43b44"))
        for k in range(4):
            c.hline(x - 3 + k, y + 1 + k, 7 - 2 * k, C("#e43b44"))
        c.vline(x, y + 5, 10, C("#5a6988"))
    broadcast(c)
    c.save("news_wedding")


def news_epidemic():
    c = Canvas(W, H)
    sky(c, C("#8a9a7a"), C("#c0cbdc"), 60)
    skyline(c, 60, C("#5a6988"), 111, lit=C("#ead4aa"), tall=(16, 30))
    # Вирусы.
    rnd = random.Random(112)
    for _ in range(8):
        x, y, r = rnd.randrange(10, W - 10), rnd.randrange(8, 38), rnd.choice([3, 4, 5])
        for k in range(8):
            a = k * math.pi / 4
            c.px(int(x + (r + 2) * math.cos(a)), int(y + (r + 2) * math.sin(a)), C("#3e8948"))
        c.ellipse(x, y, r, r, C("#63c74d"))
        c.px(x - 1, y - 1, C("#c8ffb0"))
    # Прохожие в масках.
    for i, x in enumerate((20, 40, 92, 108)):
        person(c, x, 38, [C("#e43b44"), C("#0099db"), C("#feae34"), C("#b55088")][i])
        c.rect(x, 41, 7, 3, C("#ffffff"))
    # Большая маска-знак.
    c.round_rect(52, 30, 24, 14, C("#ffffff"), r=3)
    for y in (34, 37, 40):
        c.hline(55, y, 18, C("#8fd7f5"))
    c.line(52, 33, 46, 30, C("#ffffff"))
    c.line(76, 33, 82, 30, C("#ffffff"))
    broadcast(c)
    c.save("news_epidemic")


def hair_bob(p, hair):
    """Каре ведущей с пробором."""
    p.ellipse(16, 9, 9.5, 6.5, hair)
    p.rect(6, 9, 4, 12, hair)
    p.rect(22, 9, 4, 12, hair)
    p.hline(8, 20, 3, shade(hair, 0.8))
    p.hline(21, 20, 3, shade(hair, 0.8))
    p.px(13, 5, shade(hair, 1.3))
    p.px(14, 5, shade(hair, 1.3))


def mic(p, skin, hair, shirt):
    """Микрофон с логотипом канала у плеча и брошка."""
    p.rect(23, 23, 3, 6, rgb("#262b44"))
    p.ellipse(24.5, 22, 2.4, 2.4, rgb("#5a6988"))
    p.rect(22, 26, 5, 3, rgb("#e43b44"))
    p.px(12, 27, rgb("#fee761"))


def main():
    for mood in (None, "happy", "surprised", "sad"):
        portrait("anchor", "#124e89", "#f2d3ab", "#4a2c1a", "#e43b44", hair_bob, mic, mood)
    news_heatwave()
    news_frost()
    news_flood()
    news_quake()
    news_carnival()
    news_parade()
    for draw in (news_blackout, news_filming, news_marathon, news_tourbus, news_starfall, news_pigeons, news_roadworks, news_sanitary, news_wedding, news_epidemic):
        draw()


if __name__ == "__main__":
    main()
