"""Иллюстрации сюжета 320×180 (public/story): кадр как в визуальной новелле — фон улицы
или зала пиксель-артом в палитре игры и герои крупно на переднем плане (их портреты
из art/sprites.py, вырезанные по контуру). Запуск: python3 art/story_scenes.py"""

import math
import random
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw

OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "story"
ASSETS = Path(__file__).resolve().parent.parent / "public" / "assets"
W, H = 320, 180
INK = (24, 20, 37)


def hexc(s):
    return tuple(int(s[i : i + 2], 16) for i in (1, 3, 5))


def mix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def sky(d, top, bottom, h, bands=10):
    """Небо полосами (как в пиксель-арте — без плавного градиента)."""
    for i in range(bands):
        y0 = h * i // bands
        y1 = h * (i + 1) // bands
        d.rectangle([0, y0, W, y1], fill=mix(top, bottom, i / (bands - 1)))


def cloud(d, x, y, s, color):
    for dx, dy, r in ((0, 0, 7), (8, -3, 9), (17, 0, 7), (8, 3, 7)):
        d.ellipse([x + dx * s - r * s, y + dy * s - r * s / 2, x + dx * s + r * s, y + dy * s + r * s / 2], fill=color)


def ground(d, y, tone=(196, 186, 168), road=None):
    """Тротуар из плитки до низа кадра (и дорога за ним, если задана)."""
    if road:
        d.rectangle([0, y - 14, W, y], fill=road)
        for x in range(4, W, 28):
            d.rectangle([x, y - 8, x + 12, y - 7], fill=(230, 225, 214))
    d.rectangle([0, y, W, H], fill=tone)
    dark = mix(tone, INK, 0.2)
    for yy in range(y + 6, H, 8):
        d.line([0, yy, W, yy], fill=dark)
        off = 0 if (yy // 8) % 2 else 8
        for x in range(off, W, 16):
            d.line([x, yy - 7, x, yy], fill=dark)
    d.line([0, y, W, y], fill=mix(tone, (255, 255, 255), 0.4))


def building(d, x, top, w, base, color, *, windows=True, lit=False, awning=None, door=True, sign=None, rnd=None):
    """Фасад: кирпич (крапинки), окна в ряд, дверь, навес полосками, вывеска-плашка."""
    rnd = rnd or random.Random(1)
    d.rectangle([x, top, x + w, base], fill=color, outline=INK)
    dark = mix(color, INK, 0.18)
    for _ in range(w * (base - top) // 40):
        px, py = rnd.randint(x + 2, x + w - 3), rnd.randint(top + 2, base - 2)
        d.rectangle([px, py, px + 2, py], fill=dark)
    d.rectangle([x - 2, top - 3, x + w + 2, top], fill=mix(color, INK, 0.35), outline=INK)
    glass = (255, 214, 140) if lit else (120, 170, 210)
    if windows:
        for wy in range(top + 8, base - 34, 22):
            for wx in range(x + 8, x + w - 14, 20):
                d.rectangle([wx, wy, wx + 11, wy + 13], fill=glass, outline=INK)
                d.line([wx + 6, wy, wx + 6, wy + 13], fill=INK)
                if not lit:
                    d.line([wx + 2, wy + 2, wx + 4, wy + 2], fill=(220, 240, 255))
    if awning:
        ay = base - 30
        for i, sx in enumerate(range(x + 2, x + w - 2, 8)):
            d.rectangle([sx, ay, min(sx + 7, x + w - 2), ay + 7], fill=awning if i % 2 == 0 else (250, 245, 235))
        d.line([x + 2, ay + 7, x + w - 2, ay + 7], fill=INK)
    if door:
        dx = x + w // 2 - 8
        d.rectangle([dx, base - 22, dx + 16, base], fill=(90, 60, 50), outline=INK)
        d.rectangle([dx + 3, base - 19, dx + 13, base - 9], fill=glass, outline=INK)
        # Витрины по бокам от двери.
        for vx in (x + 6, dx + 22):
            if vx + 20 < x + w - 2:
                d.rectangle([vx, base - 20, vx + 18, base - 4], fill=glass, outline=INK)
    if sign:
        sw = min(w - 10, 70)
        sx = x + (w - sw) // 2
        d.rectangle([sx, base - 44, sx + sw, base - 34], fill=sign, outline=INK)
        for i in range(sx + 6, sx + sw - 5, 6):
            d.rectangle([i, base - 41, i + 3, base - 37], fill=(254, 231, 97))


def crates(d, x, y, n, fruit):
    for i in range(n):
        cx = x + i * 16
        d.rectangle([cx, y, cx + 14, y + 9], fill=(184, 111, 80), outline=INK)
        d.line([cx, y + 4, cx + 14, y + 4], fill=(115, 62, 57))
        for k in range(4):
            d.ellipse([cx + 1 + k * 3, y - 3, cx + 5 + k * 3, y + 1], fill=fruit[(i + k) % len(fruit)], outline=INK)


def tree(d, x, base, s=1.0):
    d.rectangle([x - 2, base - 16 * s, x + 2, base], fill=(115, 62, 57), outline=INK)
    for dx, dy, r in ((0, -26, 13), (-9, -20, 9), (9, -19, 9)):
        d.ellipse([x + dx * s - r * s, base + dy * s - r * s, x + dx * s + r * s, base + dy * s + r * s], fill=(62, 137, 72), outline=INK)
    d.ellipse([x - 6 * s, base - 34 * s, x + 2 * s, base - 28 * s], fill=(99, 199, 77))


def lamp(d, x, base, lit=False):
    d.rectangle([x - 1, base - 46, x + 1, base], fill=(58, 68, 102))
    d.rectangle([x - 4, base - 50, x + 4, base - 46], fill=(254, 231, 97) if lit else (139, 155, 180), outline=INK)


def glow(img, x, y, r, color, strength=0.5):
    """Тёплое пятно света: смешиваем по кругу с затуханием (ступенями — как пиксель-арт)."""
    px = img.load()
    for yy in range(max(0, y - r), min(H, y + r)):
        for xx in range(max(0, x - r), min(W, x + r)):
            dist = math.hypot(xx - x, yy - y) / r
            if dist < 1:
                t = round((1 - dist) * 4) / 4 * strength
                px[xx, yy] = mix(px[xx, yy][:3], color, t)


def cutout(name):
    """Портрет без подложки. Подложка — свои цвета (с переливом): собираем их по верхним
    строкам и боковым столбцам, где героя нет, и заливаем от прозрачных углов только по ним.
    Контур героя замкнут, поэтому одинаковый с подложкой цвет внутри героя не трогаем."""
    im = Image.open(ASSETS / f"{name}.png").convert("RGBA")
    w, h = im.size
    px = im.load()
    bg = {px[x, y] for y in range(0, 4) for x in range(w) if px[x, y][3]}
    bg |= {px[x, y] for y in range(h // 3) for x in list(range(0, 4)) + list(range(w - 4, w)) if px[x, y][3]}
    passable = lambda c: c[3] == 0 or c in bg  # noqa: E731
    seen = set()
    q = deque((x, y) for x in range(w) for y in (0, 1) if px[x, y][3] == 0 or px[x, y] in bg)
    while q:
        x, y = q.popleft()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h) or not passable(px[x, y]):
            continue
        seen.add((x, y))
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if (nx, ny) not in seen:
                q.append((nx, ny))
    for x, y in seen:
        px[x, y] = (0, 0, 0, 0)
    return im


FIGURES = Path(__file__).resolve().parent / "build" / "figures"


def figure(name):
    """Герой без подложки: портрет, нарисованный заново без фона (sprites.portrait → build/figures).
    Если его там нет — вырезаем из готового портрета."""
    bare = FIGURES / (name.removeprefix("portrait_") + ".png")
    return Image.open(bare).convert("RGBA") if bare.exists() else cutout(name)


def hero(img, name, x, scale=2, flip=False, base=H):
    p = figure(name)
    p = p.resize((p.width * scale, p.height * scale), Image.NEAREST)
    if flip:
        p = p.transpose(Image.FLIP_LEFT_RIGHT)
    # Тень на земле под героем.
    sh = Image.new("RGBA", p.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([p.width * 0.15, p.height - 10, p.width * 0.85, p.height + 6], fill=(24, 20, 37, 70))
    img.alpha_composite(sh, (x, base - p.height))
    img.alpha_composite(p, (x, base - p.height))


def save(img, name):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(OUT_DIR / f"{name}.png", optimize=True)


def ch1():
    """«Наследство»: закат, маленький ларёк бабушки на углу, ящики с яблоками."""
    img = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(img)
    sky(d, (90, 70, 140), (247, 170, 110), 130)
    d.ellipse([228, 70, 268, 110], fill=(254, 231, 97))
    cloud(d, 30, 34, 1.2, (250, 200, 170))
    cloud(d, 180, 22, 0.9, (250, 200, 170))
    # Дома вдали — силуэты.
    for x, h in ((0, 70), (46, 52), (210, 64), (262, 80)):
        d.rectangle([x, 130 - h, x + 44, 130], fill=(110, 80, 120))
    ground(d, 130)
    building(d, 92, 66, 120, 130, (232, 200, 150), windows=False, awning=(228, 59, 68), sign=(115, 62, 57))
    crates(d, 98, 121, 2, [(228, 59, 68), (99, 199, 77)])
    crates(d, 168, 121, 2, [(247, 118, 34), (254, 231, 97)])
    lamp(d, 230, 130)
    tree(d, 290, 132)
    hero(img, "portrait_grandma_happy", 6)
    hero(img, "portrait_valya_happy", 194, flip=True)
    save(img, "ch1")


def ch2():
    """«Свои люди»: кафе «Уют» с тёплыми окнами, шеф Марат и ящики овощей."""
    img = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(img)
    sky(d, (120, 190, 240), (210, 236, 250), 120)
    cloud(d, 40, 26, 1.0, (255, 255, 255))
    cloud(d, 220, 40, 1.3, (255, 255, 255))
    ground(d, 130)
    building(d, 10, 40, 150, 130, (200, 120, 90), lit=True, awning=(184, 111, 80), sign=(115, 62, 57), rnd=random.Random(3))
    building(d, 170, 54, 140, 130, (226, 214, 190), awning=(99, 199, 77), sign=(62, 137, 72), rnd=random.Random(4))
    # Столики веранды.
    for tx in (20, 120):
        d.ellipse([tx, 120, tx + 18, 126], fill=(245, 240, 230), outline=INK)
        d.rectangle([tx + 8, 125, tx + 10, 132], fill=(58, 68, 102))
    crates(d, 200, 122, 3, [(228, 59, 68), (247, 118, 34), (99, 199, 77), (184, 111, 80)])
    hero(img, "portrait_marat_happy", 100)
    save(img, "ch2")


def ch3():
    """«Конкурент»: напротив нашего магазинчика строят огромный «МегаМарт» — кран и леса."""
    img = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(img)
    sky(d, (90, 105, 136), (192, 203, 220), 120)
    cloud(d, 60, 30, 1.4, (139, 155, 180))
    cloud(d, 200, 18, 1.1, (139, 155, 180))
    ground(d, 134, road=(58, 68, 102))
    # Огромная серая коробка «МегаМарта» и кран.
    d.rectangle([140, 30, 316, 120], fill=(139, 155, 180), outline=INK)
    for y in range(36, 116, 12):
        d.line([140, y, 316, y], fill=(110, 125, 150))
    for x in range(146, 316, 14):
        d.line([x, 30, x, 120], fill=(110, 125, 150))
    d.rectangle([180, 40, 280, 56], fill=(228, 59, 68), outline=INK)
    for i in range(190, 272, 8):
        d.rectangle([i, 44, i + 4, 52], fill=(255, 255, 255))
    d.line([300, 120, 300, 8], fill=(247, 118, 34), width=3)
    d.line([300, 10, 200, 10], fill=(247, 118, 34), width=2)
    d.line([230, 10, 230, 40], fill=INK)
    d.rectangle([224, 40, 236, 46], fill=(184, 111, 80), outline=INK)
    # Наш магазинчик слева — маленький и уютный.
    building(d, 6, 70, 100, 120, (232, 200, 150), windows=False, awning=(228, 59, 68), sign=(115, 62, 57))
    hero(img, "portrait_valya_angry", 4)
    hero(img, "portrait_eduard_angry", 186, flip=True)
    save(img, "ch3")


def ch4():
    """«Проверка»: в зале между полками — инспектор с папкой."""
    img = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 112], fill=(241, 221, 182))
    for x in range(0, W, 22):
        d.line([x, 0, x, 112], fill=(226, 204, 160))
    d.rectangle([0, 98, W, 112], fill=(184, 111, 80))
    d.rectangle([0, 112, W, H], fill=(236, 226, 206))
    for y in range(118, H, 12):
        d.line([0, y, W, y], fill=(214, 200, 176))
    for x in range(-20, W, 34):
        d.line([x, 112, x - 20, H], fill=(214, 200, 176))
    # Полки с товаром вдоль стены.
    colors = [(228, 59, 68), (99, 199, 77), (254, 231, 97), (0, 153, 219), (247, 118, 34), (181, 80, 136)]
    for i, sx in enumerate(range(8, W - 40, 76)):
        d.rectangle([sx, 30, sx + 66, 112], fill=(115, 62, 57), outline=INK)
        for row, sy in enumerate(range(38, 104, 18)):
            d.rectangle([sx + 4, sy + 12, sx + 62, sy + 14], fill=(184, 111, 80))
            for k in range(7):
                c = colors[(i + row + k) % len(colors)]
                d.rectangle([sx + 6 + k * 8, sy + 2, sx + 11 + k * 8, sy + 11], fill=c, outline=INK)
    # Лампы под потолком.
    for lx in (60, 160, 260):
        d.rectangle([lx - 14, 0, lx + 14, 4], fill=(255, 250, 220), outline=INK)
    hero(img, "portrait_inspector_angry", 160)
    hero(img, "portrait_valya_angry", 10)
    save(img, "ch4")


def ch5():
    """«Универмаг»: вечер, большой магазин сияет витринами, у входа очередь гостей."""
    img = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(img)
    sky(d, (38, 43, 68), (181, 80, 136), 120)
    rnd = random.Random(7)
    for _ in range(30):
        x, y = rnd.randint(0, W), rnd.randint(0, 60)
        d.point((x, y), fill=(255, 255, 255))
    ground(d, 132, tone=(150, 145, 160))
    building(d, 30, 26, 260, 132, (226, 214, 190), lit=True, awning=(228, 59, 68), sign=(104, 56, 108), rnd=random.Random(9))
    glow(img, 160, 120, 90, (255, 214, 140), 0.35)
    for lx in (14, 306):
        lamp(d, lx, 132, lit=True)
        glow(img, lx, 84, 20, (254, 231, 97), 0.5)
    hero(img, "portrait_eduard_sad", 100)
    save(img, "ch5")


def finale():
    """Финал: ночь, над «Универмагом» салют, бабушка и Валентина радуются."""
    img = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(img)
    sky(d, (24, 20, 37), (58, 68, 102), 120)
    rnd = random.Random(11)
    for cx, cy, color in ((70, 34, (254, 231, 97)), (160, 22, (246, 117, 122)), (250, 40, (44, 232, 245)), (120, 50, (99, 199, 77))):
        for k in range(14):
            a = k / 14 * 2 * math.pi
            for r in range(6, 22, 3):
                d.point((cx + math.cos(a) * r, cy + math.sin(a) * r), fill=color)
        d.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=(255, 255, 255))
    for _ in range(40):
        d.point((rnd.randint(0, W), rnd.randint(0, 90)), fill=(255, 255, 255))
    ground(d, 134, tone=(130, 125, 145))
    building(d, 50, 60, 220, 134, (226, 214, 190), lit=True, awning=(228, 59, 68), sign=(104, 56, 108), rnd=random.Random(12))
    glow(img, 160, 120, 100, (255, 214, 140), 0.35)
    hero(img, "portrait_grandma_happy", 0)
    hero(img, "portrait_valya_happy", 192, flip=True)
    save(img, "finale")


def main():
    # Сначала рисуем героев без подложки (заодно перерисуются и их портреты — те же самые).
    import sprites

    sprites.portraits()
    for scene in (ch1, ch2, ch3, ch4, ch5, finale):
        scene()


if __name__ == "__main__":
    main()
