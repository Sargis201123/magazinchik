"""Иллюстрации глав сюжета (public/story, 320×180) - сцены в полном разрешении, без увеличения сетки.

Люди собираются из тех же слоёв, что и человечки мира (public/assets/p_*, w_*, acc_*: тинт
умножением, вид спереди, со спины или боком), - герои глав выглядят так же, как в игре. Сцена в три
плана: дальний город в дымке, дома и магазины улицы, люди и вещи на тротуаре; свет по времени суток
(рассвет, полдень, пасмурно, сумерки, ночь), окна и фонари светят, тени ложатся по солнцу.
Надписей на вывесках нет - картинки одни на все языки, вместо букв значки.

    python3 art/chapters.py        # после art/sprites.py: слои людей берутся из public/assets
"""

import math
import random
from pathlib import Path

from PIL import Image, ImageChops

from sprites import Canvas, PALETTE

W, H = 320, 180
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "story"
ASSETS = ROOT / "public" / "assets"
GY = 136  # низ фасадов: дальше тротуар, бордюр и дорога


def C(s):
    """Цвет по букве палитры (sprites.PALETTE) или по #rrggbb."""
    if len(s) == 1:
        s = PALETTE[s]
    return (int(s[1:3], 16), int(s[3:5], 16), int(s[5:7], 16), 255)


def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)


def shade(color, k):
    return tuple(max(0, min(255, int(v * k))) for v in color[:3]) + (255,)


INK = C("k")
WHITE = C("w")


def M(a, b, t):
    """Смесь двух букв палитры: промежуточный тон сцены без новых цветов в PALETTE."""
    return mix(C(a), C(b), t)


# Общие тона сцен - все из палитры (смеси двух букв).
ICE = M("U", "w", 0.6)  # голубое стекло, холодный свет холодильника
MIST = M("U", "w", 0.85)  # светлая голубизна у горизонта, тень облака
BLUE_LIGHT = M("c", "W", 0.4)  # кромка холодильника, вода в ведре, капелька пота
LAMP = M("Y", "w", 0.6)  # тёплый свет ламп


# ---------------------------------------------------------------- приёмы


def blend(c, x, y, color, t):
    if 0 <= x < c.w and 0 <= y < c.h:
        c.px(x, y, mix(c.get(x, y), color, t))


def tint(c, x0, y0, x1, y1, color, t):
    for y in range(max(0, y0), min(c.h, y1)):
        for x in range(max(0, x0), min(c.w, x1)):
            c.px(x, y, mix(c.get(x, y), color, t))


def glow(c, cx, cy, rx, ry, color, strength, steps=3):
    """Пятно света ступенями (пиксель-арт, без плавного градиента): к центру сильнее."""
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
            if d <= 1:
                step = steps - min(steps - 1, int(d * steps))
                blend(c, x, y, color, strength * step / steps)


def dark(c, cx, cy, rx, ry, t=0.32, color=INK):
    """Тень на земле: полупрозрачный эллипс без контура."""
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1:
                blend(c, x, y, color, t)


def cone(c, x, top, bottom, half, color, strength):
    """Конус света от лампы вниз."""
    for y in range(top, bottom):
        t = (y - top) / max(1, bottom - top - 1)
        w = int(1 + (half - 1) * t)
        for xx in range(x - w, x + w + 1):
            edge = abs(xx - x) > w - 2
            blend(c, xx, y, color, strength * (1 - 0.5 * t) * (0.6 if edge else 1))


def sky(c, stops, y0, y1, steps=12):
    """Небо полосами между опорными цветами; на стыке полос - строка шахматки (пиксельный переход)."""
    n = len(stops) - 1
    cols = []
    for i in range(steps):
        t = i / max(1, steps - 1) * n
        k = min(n - 1, int(t))
        cols.append(mix(stops[k], stops[k + 1], t - k))
    for i in range(steps):
        a = y0 + (y1 - y0) * i // steps
        b = y0 + (y1 - y0) * (i + 1) // steps
        c.rect(0, a, W, b - a, cols[i])
        if i + 1 < steps:
            for x in range((b - 1) % 2, W, 2):
                c.px(x, b - 1, cols[i + 1])


def stars(c, n, y1, seed, color=WHITE):
    rnd = random.Random(seed)
    for _ in range(n):
        x, y = rnd.randrange(W), rnd.randrange(y1)
        t = rnd.choice((0.35, 0.5, 0.8))
        blend(c, x, y, color, t)
        if t > 0.7 and rnd.random() < 0.4:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                blend(c, x + dx, y + dy, color, 0.3)


def grade(img, color, t):
    """Вся картинка ближе к цвету (дымка, сумерки), прозрачность та же."""
    img = img.img if isinstance(img, Canvas) else img
    if t <= 0:
        return img
    rgb = Image.blend(img.convert("RGB"), Image.new("RGB", img.size, color[:3]), t).convert("RGBA")
    rgb.putalpha(img.getchannel("A"))
    return rgb


def multiply(img, color):
    rgb = ImageChops.multiply(img.convert("RGB"), Image.new("RGB", img.size, color[:3])).convert("RGBA")
    rgb.putalpha(img.getchannel("A"))
    return rgb


def put(c, img, x, y):
    """Наложить картинку с прозрачностью; края за холстом обрезаются."""
    img = img.img if isinstance(img, Canvas) else img
    x, y = int(x), int(y)
    l, t = max(0, -x), max(0, -y)
    r, b = min(img.width, c.w - x), min(img.height, c.h - y)
    if r <= l or b <= t:
        return
    c.img.alpha_composite(img.crop((l, t, r, b)), (x + l, y + t))


def outlined(o, color=INK):
    """Контур вокруг предмета; холст шире на пиксель с каждой стороны, чтобы контур не срезался краем."""
    pad = Canvas(o.w + 2, o.h + 2)
    pad.img.alpha_composite(o.img, (1, 1))
    pad.outline(color)
    return pad


# ---------------------------------------------------------------- люди из слоёв игры

_cache = {}


def asset(name):
    if name not in _cache:
        p = ASSETS / f"{name}.png"
        _cache[name] = Image.open(p).convert("RGBA") if p.exists() else None
    return _cache[name]


def layer(name, view, arms=""):
    suf = "_b" if view == "back" else "_s" if view in ("right", "left") else ""
    for n in (name + suf + arms, name + suf, name + arms, name):
        im = asset(n)
        if im is not None:
            return im
    raise FileNotFoundError(f"нет слоя {name} в public/assets - сначала python3 art/sprites.py")


FRONT_ONLY = {"badge", "tie", "glasses"}
UNDER_HAT = {"cap", "beanie"}  # со спины под шапкой видны волосы - иначе пустой овал кожи, «манекен»


def bald_back(im, skin, hair):
    """Лысина со спины: в мире венчик волос - светлая полоса с контуром сверху и точками ушей, на
    картинке главы она читается как очки виртуальной реальности. Здесь венчик - тон между кожей и
    волосами, без верхнего контура и без точек ушей."""
    out = Image.new("RGBA", im.size)
    src, dst = im.load(), out.load()
    top = im.getbbox()[1]
    fringe = shade(mix(C(skin), C(hair), 0.45), 0.85)
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = src[x, y]
            if not a or y == top or (y == top + 1 and x % 2 == 0 and src[x, y - 1][3]):
                continue
            ink = (r, g, b) == INK[:3]
            inner = 0 < x < im.width - 1 and src[x - 1, y][3] and src[x + 1, y][3] and src[x, y + 1][3]
            if ink and inner:
                dst[x, y] = shade(fringe, 0.9)
            elif ink:
                dst[x, y] = INK
            else:
                dst[x, y] = shade(fringe, (r + g + b) / 765)
    return out


def reach_arm(img, sleeve, skin):
    """Вторая рука вытянута вперёд (вид боком вправо): рукав от груди и кисть - отдать или взять вещь.
    Рисуется до зеркального разворота, поэтому годится и для вида влево."""
    o = Canvas(40, 46)
    for x in range(23, 28):
        o.px(x, 28, sleeve)
        o.px(x, 29, shade(sleeve, 0.8))
    o.rect(28, 28, 2, 2, skin)
    o.px(28, 29, shade(skin, 0.86))
    o.outline("k")
    img.alpha_composite(o.img)


def person(look, view="front", mood=None, walk=0, reach=False):
    """Человечек 40×46 из слоёв мира (порядок как в src/scenes/persons.ts makePerson).
    Ноги - на строке 42, середина - x 20. view: front, back, right, left; walk 1/2 - кадр шага;
    reach - вторая рука вытянута вперёд (только боком)."""
    arms = ("", "_w1", "_w2")[walk]
    img = Image.new("RGBA", (40, 46))

    def add(name, color=None, big=False, frames=False):
        im = layer(name, view, arms if frames else "")
        if color is not None:
            im = multiply(im, C(color) if isinstance(color, str) else color)
        if name == "p_hair_bald" and view == "back":
            im = bald_back(layer(name, view), look["skin"], look.get("hair", "#4a2c1a"))
        img.alpha_composite(im, (0, 0) if big else (8, 8))

    add("p_legs1" if walk else "p_legs0", look.get("pants", "#3a4466"))
    add("p_shirt", look["shirt"], frames=True)
    if look.get("outfit"):
        add("w_outfit_" + look["outfit"], look.get("outfit_tint"))
    if look.get("acc") and (view == "front" or look["acc"] not in FRONT_ONLY):
        add("acc_" + look["acc"], look.get("acc_tint"))
    add("p_skin" + (f"_{mood}" if mood else ""), look["skin"], frames=True)
    if look.get("scarf"):
        add("p_scarf", look["scarf"])
    if look.get("face"):
        add("w_face_" + look["face"], look.get("face_tint", look.get("hair")))
    if look.get("glasses") and view == "front":
        add("acc_glasses")
    style = look.get("style", "short")
    if view == "back" and style in UNDER_HAT:
        add("p_hair_short", look.get("under", "#3b2a35"))
    add("p_hair_" + style, look.get("hair", "#4a2c1a"))
    if look.get("hat"):
        add("w_hat_" + look["hat"], look.get("hat_tint"), big=True)
        if look.get("band"):
            # Фуражка как на портрете: околыш в цвет тульи (в мире он красный), спереди оранжевая кокарда.
            red = C("R")[:3]
            px = img.load()
            for y in range(img.height):
                for x in range(img.width):
                    if px[x, y][:3] == red and px[x, y][3]:
                        px[x, y] = C(look["band"])
            if view in ("right", "left"):
                for x, y in ((23, 11), (24, 11), (23, 12), (24, 12)):
                    px[x, y] = C("y") if (x, y) != (24, 12) else C("o")
                px[22, 26] = C("y")
    if look.get("prop"):
        add("w_prop_" + look["prop"], look.get("prop_tint"), big=True)
    if reach and view in ("right", "left"):
        sleeve = img.getpixel((21, 28))
        reach_arm(img, sleeve, C(look["skin"]))
    if view == "left":
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
    return img


def rimmed(img, color, t, side=-1):
    """Контровой свет: у края силуэта со стороны солнца (side -1 - слева) первый пиксель внутри контура светлее."""
    out = img.copy()
    src = img.load()
    dst = out.load()
    for y in range(img.height):
        for x in range(img.width):
            if src[x, y][3] and 0 <= x + 2 * side < img.width and src[x + side, y][3] and not src[x + 2 * side, y][3]:
                r, g, b, a = src[x, y]
                dst[x, y] = mix((r, g, b, a), color, t)[:3] + (a,)
    return out


def place(c, x, y, look, view="front", mood=None, walk=0, light=None, shadow=0.3, cast=None, rim=None, reflect=0, reach=False):
    """Поставить человечка ногами в (x, y). light - (цвет, доля) общего света сцены;
    cast - длина косой тени вправо (низкое солнце); rim - (цвет, доля) контрового света слева;
    reflect - отражение на мытом полу (доля); reach - рука вытянута вперёд (вид боком)."""
    if shadow:
        dark(c, x + (cast or 0) / 2, y, 8 + (cast or 0) / 2, 2, shadow)
    img = person(look, view, mood, walk, reach)
    if light:
        img = grade(img, *light)
    if rim:
        img = rimmed(img, *rim)
    if reflect:
        r = img.transpose(Image.FLIP_TOP_BOTTOM)
        r.putalpha(r.getchannel("A").point(lambda a: int(a * reflect)))
        put(c, r.crop((0, 0, 40, 22)), x - 20, y - 2)
    put(c, img, x - 20, y - 42)
    return img


# Герои: те же цвета, что на портретах диалогов (sprites.portraits) и у человечков мира.
HERO = dict(skin="#eec39a", shirt="#3e8948", pants="#262b44", hair="#4a2c1a", style="short")
GRANDMA = dict(skin="#f2d3ab", shirt="#68386c", pants="#3a4466", hair="#d8d8e0", style="bun", outfit="cardigan", outfit_tint="#b55088", glasses=True)
VALYA = dict(skin="#eec39a", shirt="#a22633", pants="#3a4466", hair="#c0cbdc", style="curly")
MARAT = dict(skin="#d9a066", shirt="#ffffff", pants="#3a4466", hair="#4a2c1a", style="short", outfit="chefcoat", hat="toque", face="mustache")
EDUARD = dict(skin="#f2d3ab", shirt="#3a4466", pants="#262b44", hair="#181425", style="short", outfit="suit")
INSPECTOR = dict(skin="#eec39a", shirt="#262b44", pants="#262b44", hair="#262b44", style="bun", hat="policecap", acc="badge", acc_tint="#feae34")
SONYA = dict(skin="#f2d3ab", shirt="#68386c", pants="#3a4466", hair="#8f563b", style="long")
STAFF = dict(skin="#d9a066", shirt="#5fcde4", pants="#3a4466", hair="#733e39", style="ponytail", acc="apron")

# Прохожие района: кожа, рубашка, штаны, волосы, причёска.
CROWD = [
    ("#eec39a", "#0099db", "#262b44", "#4a2c1a", "short"),
    ("#f2d3ab", "#feae34", "#3a4466", "#181425", "ponytail"),
    ("#d9a066", "#f6757a", "#262b44", "#733e39", "long"),
    ("#eec39a", "#63c74d", "#3a4466", "#c0cbdc", "bald"),
    ("#c28569", "#b55088", "#262b44", "#181425", "curly"),
    ("#f2d3ab", "#5fcde4", "#3a4466", "#8f563b", "cap"),
    ("#eec39a", "#e43b44", "#262b44", "#0099db", "beanie"),  # шапка из HAT_COLORS игры
    ("#d9a066", "#ead4aa", "#3a4466", "#3b2a35", "short"),
]


def passer(i, **more):
    skin, shirt, pants, hair, style = CROWD[i % len(CROWD)]
    return dict(skin=skin, shirt=shirt, pants=pants, hair=hair, style=style, under="#4a2c1a", **more)


# ---------------------------------------------------------------- улица


def pavement(c, y0, y1, base, seed, joint=None):
    """Тротуар плиткой в перспективе: ряды к зрителю выше, плитки шире; свет сверху слева."""
    rnd = random.Random(seed)
    joint = joint or shade(base, 0.8)
    y, h, row = y0, 3, 0
    while y < y1:
        hh = min(h, y1 - y)
        tw = 10 + row * 4
        off = (row * 7) % tw
        c.hline(0, y, W, joint)
        for x in range(off - tw, W, tw):
            tone = shade(base, rnd.choice((1.0, 1.0, 0.97, 1.03)))
            c.rect(x + 1, y + 1, tw - 1, hh - 1, tone)
            c.hline(x + 1, y + 1, tw - 2, shade(tone, 1.06))
            c.vline(x, y, hh, joint)
        y += hh
        h += 1
        row += 1


def curb_road(c, y, curb, road, dash, seed):
    c.rect(0, y, W, 2, shade(curb, 1.08))
    c.rect(0, y + 2, W, 3, shade(curb, 0.78))
    for x in range(10, W, 26):
        c.vline(x, y, 5, shade(curb, 0.66))
    c.rect(0, y + 5, W, H - y - 5, road)
    c.hline(0, y + 5, W, shade(road, 0.7))
    rnd = random.Random(seed)
    for _ in range(140):
        c.px(rnd.randrange(W), rnd.randrange(y + 6, H), shade(road, rnd.choice((0.85, 1.15))))
    for x in range(6, W, 44):
        c.rect(x, y + 11, 22, 2, dash)


def far_city(c, base, color, seed, lit=None, lit_p=0.25, tall=(14, 40)):
    """Дальний город силуэтом: дома, антенны, трубы; редкие огни окон."""
    rnd = random.Random(seed)
    top_line = shade(color, 1.12)
    x = -4
    while x < W:
        w = rnd.randrange(14, 30)
        h = rnd.randrange(*tall)
        c.rect(x, base - h, w, h, color)
        c.hline(x, base - h, w, top_line)
        kind = rnd.random()
        if kind < 0.25:
            c.vline(x + w // 2, base - h - 6, 6, color)
            c.px(x + w // 2, base - h - 7, top_line)
        elif kind < 0.45:
            c.rect(x + 3, base - h - 4, 5, 4, color)
        elif kind < 0.6:
            for i in range(3):
                c.hline(x + i * 2, base - h - 2 - i * 2, w - i * 4, color)
        if lit:
            for wy in range(base - h + 3, base - 3, 4):
                for wx in range(x + 2, x + w - 2, 3):
                    if rnd.random() < lit_p:
                        c.px(wx, wy, lit)
                        c.px(wx, wy + 1, shade(lit, 0.8))
        x += w + rnd.randrange(-2, 3)


def cloud(c, x, y, w, top, mid, low, seed):
    """Кучевое облако: шапки разной величины (в середине выше), светлый верх слева, плоское тёмное дно.
    (x, y) - левый край и линия дна."""
    h = w // 3 + 6
    o = Canvas(w + 12, h + 2)
    rnd = random.Random(seed)
    n = max(3, w // 9)
    puffs = []
    for i in range(n):
        t = (i + 0.5) / n
        r = (w / n) * (0.75 + 1.0 * math.sin(t * math.pi)) * rnd.uniform(0.85, 1.15)
        puffs.append((6 + w * t, h - r * 0.62, r))
    for cx, cy, r in puffs:
        o.ellipse(cx, cy, r, r * 0.85, mid)
    for cx, cy, r in puffs:
        o.ellipse(cx - r * 0.28, cy - r * 0.32, r * 0.62, r * 0.5, top)
    for yy in range(o.h):
        for xx in range(o.w):
            if o.get(xx, yy)[3]:
                if yy > h:
                    o.px(xx, yy, (0, 0, 0, 0))
                elif yy >= h - 2:
                    o.px(xx, yy, low)
                elif yy == h - 3 and xx % 2:
                    o.px(xx, yy, low)
    put(c, o, x - 6, y - h)


def overcast(c, rows, seed):
    """Пасмурное небо: ряды тяжёлых облаков внахлёст, верхние (ближние) темнее."""
    rnd = random.Random(seed)
    for y, (top, mid, low) in rows:
        x = -30 + rnd.randrange(20)
        while x < W:
            w = rnd.randrange(50, 90)
            cloud(c, x, y + rnd.randrange(-4, 5), w, top, mid, low, rnd.randrange(1000))
            x += w - rnd.randrange(10, 24)


def streaks(c, x, y, parts, color, under):
    """Перистые облака полосками: светлый верх, тёмная кромка снизу (рассвет подсвечивает снизу)."""
    for dx, dy, w in parts:
        c.hline(x + dx, y + dy, w, color)
        c.hline(x + dx + 2, y + dy + 1, w - 3, under)
        c.px(x + dx - 1, y + dy + 1, color)


def sun(c, x, y, r, core, halo):
    glow(c, x, y, r * 4.5, r * 3.5, halo, 0.28, 4)
    glow(c, x, y, r * 2, r * 1.8, core, 0.3)
    c.ellipse(x, y, r, r, core)
    c.ellipse(x - r * 0.3, y - r * 0.3, r * 0.55, r * 0.55, mix(core, WHITE, 0.5))


def birds(c, pts, color):
    for x, y in pts:
        c.px(x - 2, y - 1, color)
        c.px(x - 1, y, color)
        c.px(x + 1, y, color)
        c.px(x + 2, y - 1, color)


def tree(w, h, leaf, seed, trunk=C("b")):
    """Дерево как в мире (sprites.tree), но крупнее: крона кистями в три тона, ствол с ветками, контур."""
    o = Canvas(w, h)
    lt, md, dk = leaf
    tx = w // 2
    th = h // 3
    o.rect(tx - 2, h - th - 2, 5, th + 2, trunk)
    o.vline(tx - 2, h - th - 2, th + 2, shade(trunk, 1.35))
    o.vline(tx + 2, h - th - 2, th + 2, shade(trunk, 0.75))
    o.line(tx, h - th, tx - w // 5, h - th - h // 6, trunk)
    o.line(tx + 1, h - th + 2, tx + w // 5, h - th - h // 7, trunk)
    rnd = random.Random(seed)
    crown = Canvas(w, h)
    ccx, ccy, rx, ry = w / 2, (h - th) / 2 + 1, w / 2 - 2, (h - th) / 2 - 1
    blobs = []
    for _ in range(int(w * h / 90) + 6):
        a = rnd.random() * math.tau
        d = rnd.random() ** 0.6
        bx, by = ccx + math.cos(a) * rx * d * 0.78, ccy + math.sin(a) * ry * d * 0.78
        r = rnd.uniform(0.18, 0.3) * w
        blobs.append((bx, by, r))
    blobs.sort(key=lambda b: b[1])
    for bx, by, r in blobs:
        crown.ellipse(bx, by, r, r * 0.85, md)
    for bx, by, r in blobs:
        crown.ellipse(bx + r * 0.3, by + r * 0.35, r * 0.75, r * 0.55, dk)
    for bx, by, r in blobs:
        if by < ccy + ry * 0.3:
            crown.ellipse(bx - r * 0.3, by - r * 0.35, r * 0.55, r * 0.4, lt)
    for _ in range(w * h // 18):
        x, y = rnd.randrange(w), rnd.randrange(h)
        if crown.get(x, y)[3]:
            crown.px(x, y, rnd.choice((lt, md, dk)))
    o.img.alpha_composite(crown.img)
    return outlined(o)


def lamp_post(c, x, base, on=None, light=None, h=58):
    """Уличный фонарь: столб с основанием и фонарь-коробка; включён - свет вокруг и пятно на плитке."""
    if on:
        dark(c, x, base, 7, 2, 0.25)
        glow(c, x, base + 1, 22, 6, on, 0.32)
        cone(c, x, base - h + 8, base, 18, on, 0.12)
    o = Canvas(14, h + 2)
    m = 7
    o.rect(m - 1, 8, 3, h - 8, C("g"))
    o.vline(m - 1, 8, h - 8, C("G"))
    o.rect(m - 3, h - 5, 7, 5, C("K"))
    o.hline(m - 3, h - 5, 7, C("g"))
    o.rect(m - 2, h - 14, 5, 2, C("K"))
    o.rect(m - 4, 0, 9, 2, C("K"))
    o.hline(m - 3, 0, 7, C("g"))
    o.rect(m - 3, 2, 7, 6, on or C("W"))
    o.vline(m - 3, 2, 6, C("K"))
    o.vline(m + 3, 2, 6, C("K"))
    o.px(m - 1, 3, WHITE)
    o.hline(m - 3, 8, 7, C("K"))
    o = outlined(o)
    img = grade(o, *light) if light else o.img
    put(c, img, x - m, base - h)
    if on:
        glow(c, x, base - h + 5, 9, 8, on, 0.4)


def bricks(c, x, y, w, h, base, seed, mortar=None):
    """Кирпичная кладка 6×3: шов темнее, у каждого кирпича свой тон, верхняя грань светлее."""
    rnd = random.Random(seed)
    mortar = mortar or shade(base, 0.78)
    c.rect(x, y, w, h, mortar)
    for row, yy in enumerate(range(y, y + h, 3)):
        off = 3 if row % 2 else 0
        for xx in range(x - off, x + w, 6):
            tone = shade(base, rnd.choice((0.94, 1.0, 1.0, 1.06)))
            for bx in range(max(x, xx), min(x + w, xx + 5)):
                for by in range(yy, min(y + h, yy + 2)):
                    c.px(bx, by, tone)
            if xx >= x:
                c.px(xx, yy, shade(tone, 1.1))


def plaster(c, x, y, w, h, base, seed, n=None):
    c.rect(x, y, w, h, base)
    rnd = random.Random(seed)
    for _ in range(n if n is not None else w * h // 22):
        c.px(x + rnd.randrange(w), y + rnd.randrange(h), shade(base, rnd.choice((0.94, 1.05))))


ITEMS = ["bread", "milk", "apples", "juice", "buns", "jam", "kvass", "honeycake", "tangerines", "water", "fish", "pies", "pickles", "icecream"]


def goods(c, x, y, w, h, back, light, seed, shelf=C("B"), items=None, step=15, glare=True):
    """Витрина изнутри: полки с товарами игры (item_*_0, 10×12), тёплый свет и блики на стекле."""
    c.rect(x, y, w, h, back)
    rnd = random.Random(seed)
    names = items or ITEMS
    by = y + h - 2
    while by - 12 >= y:
        c.rect(x, by, w, 2, shelf)
        c.hline(x, by, w, shade(shelf, 1.2))
        gx = x + 1 + rnd.randrange(3)
        while gx + 10 <= x + w:
            im = asset(f"item_{rnd.choice(names)}_{rnd.randrange(3)}")
            if im is not None:
                put(c, im, gx, by - 12)
            gx += 11
        by -= step
    tint(c, x, y, x + w, y + h, light, 0.14)
    if not glare:
        return
    # Блик на стекле: две косые полосы у левого края.
    for i in range(h):
        for k, (dx, t) in enumerate(((0, 0.24), (1, 0.24), (5, 0.14))):
            gx = x + 3 + dx + (h - 1 - i) // 2
            if gx < x + w:
                blend(c, gx, y + i, WHITE, t)


def framed(c, x, y, w, h, col, sill=None):
    c.frame(x - 1, y - 1, w + 2, h + 2, col)
    c.hline(x - 1, y - 1, w + 2, shade(col, 1.25))
    if sill:
        c.rect(x - 3, y + h + 1, w + 6, 2, sill)
        c.hline(x - 3, y + h + 1, w + 6, shade(sill, 1.15))


def awning(c, x, y, w, stripes, depth=9):
    """Полосатый навес: скат с полосами, фестоны, тень на стене под ним; правый край темнее."""
    for row in range(depth):
        for xx in range(x - row // 3, x + w + row // 3):
            i = ((xx - x) * 6) // (6 * 6 + row)
            col = stripes[(i // 1) % 2]
            k = 1.08 - row * 0.03
            if xx > x + w - 6:
                k *= 0.86
            c.px(xx, y + row, shade(col, k))
    c.hline(x, y, w, shade(stripes[0], 0.6))
    fy = y + depth
    for i, sx in enumerate(range(x - depth // 3, x + w + depth // 3, 6)):
        col = stripes[i % 2]
        c.rect(sx, fy, 6, 2, shade(col, 0.9))
        c.hline(sx + 1, fy + 2, 4, shade(col, 0.8))
        c.hline(sx + 2, fy + 3, 2, shade(col, 0.7))
    return fy + 4


def shadow_band(c, x, y, w, h, t=0.25):
    for i in range(h):
        tint(c, x, y + i, x + w, y + i + 1, INK, t * (1 - i / h))


def basket_icon(c, x, y, bg):
    """Значок вместо надписи: корзинка с яблоком и батоном."""
    rows = [
        "....RR.nn...",
        "...RRRnnnn..",
        "..yyyyyyyyy.",
        ".ywywywywywy",
        "..yyyyyyyyy.",
        "...ywywywy..",
        "....yyyyy...",
    ]
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch != ".":
                c.px(x + dx, y + dy, C(ch) if ch != "w" else bg)


def sign_board(c, x, y, w, h, base, bulbs=True, on=True):
    c.rect(x, y, w, h, shade(base, 0.6))
    c.rect(x + 1, y + 1, w - 2, h - 2, base)
    c.hline(x + 1, y + 1, w - 2, shade(base, 1.3))
    c.rect(x + 2, y + 3, w - 4, h - 5, shade(base, 0.82))
    if bulbs:
        for i, bx in enumerate(range(x + 2, x + w - 1, 3)):
            col = (C("Y") if i % 2 else C("y")) if on else shade(C("y"), 0.55)
            c.px(bx, y, col)
            c.px(bx, y + h - 1, col)
    basket_icon(c, x + w // 2 - 6, y + (h - 7) // 2, shade(base, 0.82))


def little_shop(c, x, w, top, wall, seed, stripes=(C("R"), WHITE), light=C("y"), sign=C("p"), door_right=True, lamp_on=None, sign_on=True):
    """Наш магазин в один этаж: цоколь кирпичом, штукатурка, карниз, вывеска со значком, навес,
    витрина с товарами игры и дверь со стеклом. Возвращает x середины двери."""
    plaster(c, x, top, w, GY - top, wall, seed)
    bricks(c, x, GY - 12, w, 12, C("B"), seed + 1)
    c.hline(x, GY - 13, w, shade(wall, 0.8))
    c.rect(x + w - 3, top, 3, GY - top, shade(wall, 0.84))
    # Карниз и вывеска на крыше.
    c.rect(x - 3, top - 4, w + 6, 4, shade(wall, 0.72))
    c.hline(x - 3, top - 4, w + 6, shade(wall, 1.12))
    c.hline(x - 3, top - 1, w + 6, shade(wall, 0.55))
    sw = min(64, w - 16)
    sx = x + (w - sw) // 2
    c.vline(sx + 6, top - 6, 2, C("g"))
    c.vline(sx + sw - 7, top - 6, 2, C("g"))
    sign_board(c, sx, top - 20, sw, 14, sign, on=sign_on)
    if sign_on:
        glow(c, sx + sw // 2, top - 13, sw // 2 + 6, 10, C("Y"), 0.12)
    below = awning(c, x - 2, top + 2, w + 4, stripes)
    shadow_band(c, x, below, w - 3, 5)
    dw = 18
    dx = x + w - dw - 8 if door_right else x + 8
    # Витрины.
    wy = below + 3
    wh = GY - 15 - wy
    wx = x + 6
    while wx + 20 <= x + w - 6:
        ww = min(46, x + w - 6 - wx)
        if wx < dx + dw + 4 and wx + ww > dx - 4:
            if wx < dx - 24:
                ww = dx - 6 - wx
            else:
                wx = dx + dw + 6
                continue
        goods(c, wx, wy, ww, wh, mix(C("x"), light, 0.25), light, seed + wx, step=13)
        framed(c, wx, wy, ww, wh, C("a"), sill=shade(wall, 0.75))
        wx += ww + 6
    # Дверь: рама, стекло с тёплым светом, ручка, ступенька.
    dy = below + 1
    c.rect(dx - 2, dy - 2, dw + 4, GY - dy + 2, C("b"))
    c.rect(dx, dy, dw, GY - dy, C("a"))
    c.vline(dx, dy, GY - dy, C("B"))
    c.rect(dx + 3, dy + 3, dw - 6, (GY - dy) // 2, mix(light, C("n"), 0.3))
    c.hline(dx + 3, dy + 3, dw - 6, shade(light, 1.1))
    c.line(dx + 4, dy + 8, dx + 8, dy + 4, mix(light, WHITE, 0.5))
    c.rect(dx + 3, dy + (GY - dy) // 2 + 6, dw - 6, 1, C("b"))
    c.rect(dx + dw - 5, dy + (GY - dy) // 2 + 2, 2, 3, C("Y"))
    c.rect(dx - 4, GY - 2, dw + 8, 2, C("l"))
    c.hline(dx - 4, GY - 2, dw + 8, C("W"))
    if lamp_on:
        c.rect(dx + dw // 2 - 2, dy - 9, 5, 3, C("K"))
        c.rect(dx + dw // 2 - 1, dy - 6, 3, 2, lamp_on)
        glow(c, dx + dw // 2, dy - 4, 14, 10, lamp_on, 0.3)
    return dx + dw // 2


def panel_house(c, x, base, w, floors, wall, seed, glass, lit=None, lit_p=0.25, fh=17):
    """Пятиэтажка за улицей: панели со швами, окна в рамах, балконы, правый край в тени."""
    top = base - floors * fh
    plaster(c, x, top, w, floors * fh, wall, seed, n=w * floors * fh // 40)
    rnd = random.Random(seed)
    for fy in range(top, base, fh):
        c.hline(x, fy, w, shade(wall, 0.9))
    for px_ in range(x, x + w, 24):
        c.vline(px_, top, base - top, shade(wall, 0.93))
    c.rect(x + w - 4, top, 4, base - top, shade(wall, 0.82))
    c.rect(x - 1, top - 3, w + 2, 3, shade(wall, 0.7))
    c.hline(x - 1, top - 3, w + 2, shade(wall, 1.1))
    c.rect(x + 10, top - 7, 6, 4, shade(wall, 0.7))
    c.vline(x + w - 18, top - 13, 10, C("g"))
    c.hline(x + w - 22, top - 11, 9, C("g"))
    for f in range(floors):
        fy = top + f * fh
        for col, wx in enumerate(range(x + 6, x + w - 10, 16)):
            on = lit and rnd.random() < lit_p
            for yy in range(9):
                c.hline(wx, fy + 4 + yy, 7, mix(lit, shade(lit, 0.75), yy / 9) if on else mix(glass[0], glass[1], yy / 8))
            if on:
                c.rect(wx, fy + 4, 2, 9, shade(lit, 0.7))
            else:
                c.px(wx + 1, fy + 5, mix(glass[0], WHITE, 0.4))
            c.frame(wx - 1, fy + 3, 9, 11, shade(wall, 0.62))
            c.vline(wx + 3, fy + 4, 9, shade(wall, 0.62))
            c.hline(wx - 2, fy + 14, 11, shade(wall, 1.12))
            if col % 2 == 1 and f < floors - 1 and f > 0:
                c.rect(wx - 3, fy + 10, 13, 5, shade(wall, 0.78))
                c.hline(wx - 3, fy + 10, 13, shade(wall, 1.05))
                for rx in range(wx - 2, wx + 10, 2):
                    c.px(rx, fy + 12, shade(wall, 0.6))
    return top


def crate(kind):
    """Ящик с товаром у входа (16×16 из мира: crate_apples, crate_bread…)."""
    return asset(f"crate_{kind}")


def suitcase():
    o = Canvas(14, 20)
    o.rect(2, 0, 2, 7, C("G"))
    o.rect(2, 0, 9, 2, C("G"))
    o.rect(9, 0, 2, 7, C("G"))
    o.rect(0, 6, 13, 11, C("a"))
    o.vline(0, 6, 11, C("B"))
    o.hline(0, 6, 13, C("B"))
    o.vline(12, 6, 11, C("b"))
    o.rect(0, 10, 13, 2, C("b"))
    o.px(6, 10, C("y"))
    o.rect(5, 13, 3, 2, C("s"))
    o.ellipse(2.5, 18, 1.6, 1.6, C("K"))
    o.ellipse(10.5, 18, 1.6, 1.6, C("K"))
    return outlined(o)


def keys(c, x, y):
    """Связка ключей с бликом - то, что бабушка передаёт внуку. (x, y) - кольцо, за него держит рука;
    два ключа висят вниз: золотой и серебряный, с бородками; над кольцом искорка."""
    o = Canvas(9, 12)
    o.ellipse(4, 2, 2.6, 2.4, C("y"))
    o.px(4, 2, (0, 0, 0, 0))
    o.px(3, 1, C("Y"))
    # Золотой ключ: головка с дыркой, стержень, бородка вправо.
    o.rect(1, 4, 3, 3, C("Y"))
    o.px(2, 5, C("o"))
    o.vline(2, 7, 5, C("Y"))
    o.vline(3, 7, 5, C("y"))
    o.px(4, 9, C("y"))
    o.px(4, 11, C("y"))
    # Серебряный ключ - чуть в сторону.
    o.rect(5, 4, 3, 3, WHITE)
    o.px(6, 5, C("l"))
    o.vline(6, 7, 4, C("W"))
    o.vline(7, 7, 4, C("l"))
    o.px(5, 9, C("l"))
    o = outlined(o)
    put(c, o, x - 5, y - 3)
    sparkle(c, x + 4, y - 5)
    blend(c, x + 6, y - 8, WHITE, 0.6)
    blend(c, x - 4, y - 6, WHITE, 0.5)


def save(c, name):
    # Картинка глав непрозрачна целиком: дырка в ней - фон окна диалога точкой посреди сцены.
    assert c.img.getchannel("A").getextrema() == (255, 255), f"{name}: есть прозрачные пиксели"
    OUT.mkdir(parents=True, exist_ok=True)
    c.img.save(OUT / f"{name}.png")


# ---------------------------------------------------------------- главы


def ch1():
    """Наследство. Рассвет: бабушкин ларёк на углу; бабушка с чемоданом отдаёт внуку ключи,
    её ждёт автобус на дачу с открытой дверью. Солнце встаёт слева - тени длинные, вправо."""
    c = Canvas(W, H)
    sky(c, [C("K"), C("p"), C("P"), C("s"), C("o"), C("y")], 0, 124, 12)
    sun(c, 26, 94, 10, C("Y"), C("y"))
    cloud(c, 112, 40, 64, C("s"), C("P"), C("p"), 1)
    cloud(c, 222, 26, 46, C("s"), C("P"), C("p"), 2)
    streaks(c, 30, 66, ((0, 0, 46), (18, 4, 60), (6, 9, 30), (60, -6, 34)), C("Y"), C("o"))
    streaks(c, 170, 76, ((0, 0, 38), (16, 4, 52), (40, -5, 24)), C("y"), C("s"))
    far_city(c, 120, mix(C("P"), C("p"), 0.5), 11, tall=(10, 30))
    far_city(c, 126, mix(C("p"), C("z"), 0.5), 12, lit=C("y"), lit_p=0.12, tall=(8, 22))
    # Двор за ларьком: пятиэтажка в утренней дымке, кое-где уже горит свет.
    house = Canvas(W, H)
    panel_house(house, 158, 128, 138, 5, C("t"), 5, (C("s"), C("p")), lit=C("y"), lit_p=0.22, fh=15)
    put(c, grade(house, mix(C("P"), C("s"), 0.4), 0.4), 0, 0)
    c.rect(0, 124, W, 12, C("d"))
    for x in range(0, W, 3):
        c.px(x, 123, C("d"))
        c.px(x + 1, 124, C("e"))
    pavement(c, GY, 160, mix(C("l"), C("s"), 0.3), 7)
    curb_road(c, 160, C("W"), mix(C("g"), C("p"), 0.3), C("N"), 8)
    glow(c, 24, 140, 110, 22, C("y"), 0.18)
    lamp_post(c, 30, GY + 8, on=C("Y"), light=(C("p"), 0.2))
    # Берёза за спиной героев.
    put(c, grade(tree(44, 80, (C("E"), C("e"), C("d")), 4, trunk=C("W")), C("P"), 0.24), 146, GY - 79)
    # Ларёк: тень от него ложится вправо по плитке.
    for i in range(10):
        tint(c, 146 + i, GY + i, 176 + i * 2, GY + i + 1, INK, 0.18)
    door = little_shop(c, 46, 100, 80, C("N"), 21, lamp_on=C("Y"))
    tint(c, 46, 60, 146, GY, C("s"), 0.06)
    glow(c, 96, GY + 6, 50, 6, C("y"), 0.2)
    # Ящики и пачка газет у входа.
    for kind, bx in (("apples", 52), ("bread", 68), ("milk", 84)):
        for i in range(5):
            tint(c, bx + 16 + i, GY - 4 + i, bx + 24 + i * 2, GY - 3 + i, INK, 0.2)
        put(c, crate(kind), bx, GY - 12)
    c.rect(door - 22, GY - 6, 9, 6, C("W"))
    c.hline(door - 22, GY - 6, 9, WHITE)
    c.hline(door - 22, GY - 3, 9, C("l"))
    c.vline(door - 18, GY - 6, 6, C("R"))
    # Автобус на дачу: дверь открыта, на табло - значок домика с деревом.
    bus(c, 238, 108)
    # Бабушка с чемоданом протягивает ключи, внук тянет руку; солнце светит им в спину.
    rim = (C("Y"), 0.55)
    place(c, 182, 152, HERO, "right", "happy", cast=28, shadow=0.26, rim=rim, reach=True)
    for i in range(14):
        tint(c, 228 + i, 151 + i // 5, 232 + i * 2, 152 + i // 5, INK, 0.2)
    put(c, rimmed(suitcase().img, C("Y"), 0.5), 220, 133)
    keys(c, 196, 141)
    place(c, 208, 153, GRANDMA, "left", "happy", cast=28, shadow=0.26, rim=rim, reach=True)
    birds(c, [(84, 30), (92, 34), (100, 28), (180, 18)], C("p"))
    # Роса бликами на плитке.
    rnd = random.Random(1)
    for _ in range(22):
        x, y = rnd.randrange(0, 236), rnd.randrange(GY + 2, 160)
        blend(c, x, y, C("Y"), 0.55)
    save(c, "ch1")


def bus(c, x, top):
    """Пригородный автобус боком, мордой влево: открытая дверь, окна с рассветом, табло со значком."""
    o = Canvas(W - x + 4, H - top)
    bw, bh = o.w + 20, 58
    body, low = C("y"), C("o")
    o.round_rect(0, 4, bw, bh - 8, body, 4)
    o.rect(0, 36, bw, bh - 44, low)
    o.hline(0, 35, bw, WHITE)
    o.hline(0, 4, bw, shade(body, 1.12))
    o.rect(0, 46, bw, 4, shade(low, 0.8))
    # Лобовое стекло и табло.
    o.rect(2, 8, 4, 6, C("K"))
    o.rect(3, 9, 2, 4, C("Y"))
    o.round_rect(1, 15, 10, 18, C("u"), 1)
    for yy in range(18):
        o.hline(2, 15 + yy, 8, mix(C("s"), C("p"), yy / 18))
    o.line(3, 17, 7, 25, mix(C("s"), WHITE, 0.6))
    o.rect(14, 7, 26, 6, C("K"))
    o.rect(15, 8, 24, 4, C("y"))
    o.rect(24, 8, 4, 3, C("e"))
    o.px(25, 11, C("b"))
    o.rect(30, 9, 5, 3, C("N"))
    o.px(32, 8, C("r"))
    o.px(31, 8, C("r"))
    o.px(33, 8, C("r"))
    # Открытая дверь: створки сложены, внутри тёплый свет и ступеньки.
    o.rect(14, 15, 18, 35, C("x"))
    for yy in range(15, 50):
        o.hline(16, yy, 14, mix(C("n"), C("y"), (yy - 15) / 35))
    o.rect(14, 15, 3, 35, C("g"))
    o.rect(29, 15, 3, 35, C("g"))
    o.vline(15, 16, 33, C("W"))
    o.rect(16, 44, 14, 2, C("a"))
    o.rect(16, 48, 14, 2, C("a"))
    o.vline(18, 18, 24, C("W"))
    # Окна салона: рассвет в стекле, силуэт пассажирки в шляпе.
    for i, wx in enumerate(range(36, bw, 20)):
        o.rect(wx, 15, 16, 16, C("K"))
        for yy in range(14):
            o.hline(wx + 1, 16 + yy, 14, mix(C("s"), C("P"), yy / 14))
        o.line(wx + 2, 17, wx + 7, 28, mix(C("s"), WHITE, 0.55))
        o.line(wx + 3, 17, wx + 8, 28, mix(C("s"), WHITE, 0.4))
        if i == 1:
            o.ellipse(wx + 10, 24, 3, 3, C("p"))
            o.ellipse(wx + 10, 21, 5, 1.5, C("p"))
            o.rect(wx + 6, 27, 9, 4, C("p"))
    # Колёса в арках.
    for wx in (46, bw - 30):
        o.ellipse(wx, bh - 4, 9, 9, shade(low, 0.6))
        o.ellipse(wx, bh - 2, 7, 7, C("K"))
        o.ellipse(wx, bh - 2, 3.5, 3.5, C("l"))
        o.ellipse(wx, bh - 2, 1.5, 1.5, C("G"))
    o.rect(0, 40, 4, 3, C("Y"))
    o.rect(0, 46, 6, 3, C("G"))
    o = outlined(o)
    dark(c, x + 60, top + bh - 1, 80, 3, 0.4)
    glow(c, x - 4, top + 41, 10, 5, C("Y"), 0.4)
    put(c, o, x, top)
    glow(c, x + 23, top + 52, 14, 4, C("y"), 0.3)


def ch2():
    """Свои люди. Солнечный полдень: Марат несёт ящик продуктов в своё кафе «Уют», тётя Валя с авоськой,
    хозяин рядом, у двери - первый сотрудник в фартуке с метлой; у входа - коробки заказов."""
    c = Canvas(W, H)
    sky(c, [C("U"), M("U", "w", 0.25), ICE, MIST], 0, 122, 10)
    sun(c, 40, 20, 8, C("Y"), C("Y"))  # свет сверху слева, как у всех спрайтов
    cloud(c, 128, 40, 58, WHITE, MIST, C("W"), 4)
    cloud(c, 226, 52, 36, WHITE, MIST, C("W"), 5)
    cloud(c, 168, 18, 24, WHITE, MIST, C("W"), 6)
    far_city(c, 122, M("U", "w", 0.62), 23, tall=(10, 30))
    far_city(c, 126, M("U", "W", 0.72), 24, tall=(6, 20))
    c.rect(0, 122, W, 14, C("i"))
    for x in range(0, W, 2):
        c.px(x, 122 - (x % 3 == 0), C("j"))
    pavement(c, GY, 160, C("W"), 9)
    curb_road(c, 160, C("W"), C("g"), C("N"), 10)
    cafe(c, 0, 116, 58)
    umbrella(c, 134, 150)
    # Наш магазин: побольше ларька, витрины с товаром, коробки заказов у двери.
    door = little_shop(c, 166, 124, 78, C("N"), 41)
    for bx, by in ((232, GY - 10), (244, GY - 10), (238, GY - 19)):
        put(c, box(), bx, by)
    dark(c, 244, GY, 14, 2, 0.2)
    # Дерево справа, тень пятнами.
    dark(c, 312, 152, 28, 5, 0.2)
    put(c, tree(58, 90, (C("E"), C("e"), C("d")), 6), 286, GY - 86)
    for sx, sy in ((300, 150), (318, 154), (306, 156)):
        glow(c, sx, sy, 3, 1.5, C("Y"), 0.3)
    # Люди: Марат несёт ящик к кафе, тётя Валя с авоськой, хозяин, сотрудник с метлой у двери.
    marat_box(c, 112, 152)
    place(c, 178, 150, dict(VALYA, prop="stringbag"), "front", "happy", shadow=0.25)
    place(c, 202, 154, HERO, "left", "happy", shadow=0.25)
    staff_broom(c, door - 9, 150)
    for px_, py in ((150, 156), (158, 158)):
        pigeon(c, px_, py)
    save(c, "ch2")


def cafe(c, x, w, top):
    """Кафе «Уют»: терракотовая штукатурка, два арочных окна с тёплым залом, арочная дверь,
    ящики с цветами, кронштейн с чашкой вместо надписи."""
    wall = M("B", "n", 0.4)
    plaster(c, x, top, w, GY - top, wall, 30)
    c.rect(x + w - 3, top, 3, GY - top, shade(wall, 0.84))
    c.rect(x - 2, top - 5, w + 5, 5, C("b"))
    c.hline(x - 2, top - 5, w + 5, C("B"))
    for i in range(x, x + w, 6):
        c.rect(i, top, 3, 2, shade(wall, 0.8))
    bricks(c, x, GY - 10, w, 10, C("b"), 31)

    def arch(ax, aw, ay, ah, fill):
        for yy in range(ay, ay + ah):
            for xx in range(ax, ax + aw):
                r = aw / 2
                if yy >= ay + r or ((xx + 0.5 - ax - r) / r) ** 2 + ((yy + 0.5 - ay - r) / r) ** 2 <= 1:
                    c.px(xx, yy, fill(xx, yy))

    for ax in (6, 78):
        arch(ax - 2, 34, 74, 52, lambda xx, yy: C("x"))
        arch(ax, 30, 76, 48, lambda xx, yy: mix(C("Y"), C("n"), (yy - 76) / 48))
        c.vline(ax + 15, 76, 48, C("x"))
        c.hline(ax, 100, 30, C("x"))
        for lx in (ax + 7, ax + 23):
            c.vline(lx, 78, 6, C("x"))
            c.rect(lx - 2, 84, 5, 2, C("o"))
            glow(c, lx, 88, 6, 4, C("Y"), 0.35)
        # Гости за столиками - силуэты.
        c.ellipse(ax + 8, 109, 2.5, 2.5, C("B"))
        c.rect(ax + 5, 112, 7, 6, C("B"))
        c.ellipse(ax + 22, 110, 2.5, 2.5, C("a"))
        c.rect(ax + 19, 113, 7, 5, C("a"))
        c.rect(ax + 2, 116, 26, 2, C("b"))
        c.rect(ax - 3, 124, 36, 2, shade(wall, 0.7))
        c.rect(ax - 1, 126, 32, 4, C("a"))
        for fx in range(ax, ax + 30, 3):
            c.px(fx, 125, C("E"))
            c.px(fx + 1, 124, (C("R"), C("Y"), C("s"))[(fx // 3) % 3])
    # Дверь посередине.
    arch(44, 26, 84, 52, lambda xx, yy: C("x"))
    arch(46, 22, 86, 50, lambda xx, yy: C("a"))
    arch(49, 16, 89, 22, lambda xx, yy: mix(C("Y"), C("n"), (yy - 89) / 22))
    c.vline(57, 86, 50, C("b"))
    c.px(54, 114, C("Y"))
    c.px(60, 114, C("Y"))
    c.rect(42, GY - 2, 30, 2, C("l"))
    # Кронштейн с чашкой над дверью.
    c.hline(56, 66, 16, C("K"))
    c.rect(60, 68, 13, 13, C("N"))
    c.frame(60, 68, 13, 13, C("b"))
    c.rect(63, 72, 6, 6, WHITE)
    c.vline(69, 73, 3, WHITE)
    c.px(70, 74, WHITE)
    c.hline(62, 78, 9, C("W"))
    c.px(64, 70, C("l"))
    c.px(66, 69, C("l"))


def umbrella(c, x, base):
    o = Canvas(44, 46)
    o.vline(22, 8, 36, C("l"))
    for row in range(8):
        for xx in range(22 - 4 - row * 2, 22 + 5 + row * 2):
            i = (xx - 22) * 8 // (row + 4)
            o.px(xx, 2 + row, C("R") if (i // 3) % 2 else WHITE)
    for sx in range(4, 41, 6):
        o.px(sx, 10, C("R"))
        o.px(sx + 1, 10, C("R"))
    o.rect(12, 30, 21, 2, C("B"))
    o.hline(12, 30, 21, C("n"))
    o.rect(21, 32, 3, 12, C("b"))
    o.rect(17, 43, 11, 1, C("b"))
    o.rect(6, 34, 2, 10, C("a"))
    o.rect(6, 34, 5, 2, C("a"))
    o.rect(8, 38, 5, 2, C("a"))
    o.rect(11, 38, 2, 6, C("a"))
    o.rect(37, 34, 2, 10, C("a"))
    o.rect(34, 34, 5, 2, C("a"))
    o.rect(32, 38, 5, 2, C("a"))
    o.rect(32, 38, 2, 6, C("a"))
    o.rect(26, 27, 3, 3, WHITE)
    o.rect(16, 28, 4, 2, C("o"))
    o = outlined(o)
    dark(c, x + 2, base, 18, 3, 0.26)
    put(c, o, x - 22, base - 44)


def box():
    o = Canvas(12, 10)
    o.rect(0, 0, 12, 10, C("n"))
    o.rect(0, 0, 12, 3, C("N"))
    o.vline(11, 0, 10, C("B"))
    o.rect(5, 0, 2, 10, C("t"))
    o.px(2, 6, C("R"))
    o.px(3, 6, C("R"))
    return outlined(o)


def pigeon(c, x, y):
    o = Canvas(8, 6)
    o.rect(1, 2, 5, 3, C("l"))
    o.rect(5, 1, 2, 2, C("G"))
    o.px(7, 2, C("y"))
    o.hline(2, 2, 3, C("W"))
    o.px(0, 3, C("G"))
    o.px(2, 5, C("o"))
    o.px(4, 5, C("o"))
    o = outlined(o)
    dark(c, x + 4, y + 7, 4, 1, 0.25)
    put(c, o, x, y)


def marat_box(c, x, y):
    """Марат идёт влево к кафе, в руках - ящик с овощами от нас."""
    place(c, x, y, MARAT, "left", "happy", walk=1, shadow=0.25)
    o = Canvas(18, 12)
    o.rect(0, 4, 18, 8, C("B"))
    o.hline(0, 4, 18, C("n"))
    o.hline(0, 8, 18, C("b"))
    o.vline(17, 4, 8, C("b"))
    for i, col in enumerate(("R", "E", "y", "R", "o", "E")):
        o.ellipse(2 + i * 2.8, 3, 1.6, 1.6, C(col))
    o.px(8, 0, C("E"))
    o.px(9, 0, C("e"))
    o = outlined(o)
    put(c, o, x - 16, y - 20)


def staff_broom(c, x, y):
    """Первый сотрудник у двери: в фартуке, метла в руке (черенок проходит через кисть)."""
    place(c, x, y, STAFF, "front", "happy", shadow=0.25)
    hx, hy = x + 8, y - 10  # левая кисть (справа от нас): слой p_skin, x 17-18, строки 24-25
    o = Canvas(13, 40)
    o.line(7, 0, 6, 32, C("a"))
    o.line(8, 0, 7, 32, C("B"))
    o.rect(3, 31, 8, 2, C("b"))
    for i in range(9):
        o.line(6, 33, 2 + i, 39, C("y") if i % 2 else C("o"))
    o = outlined(o)
    put(c, o, hx - 7, y - 40)
    skin = C(STAFF["skin"])
    c.rect(hx - 1, hy - 1, 2, 2, skin)
    c.px(hx, hy, shade(skin, 0.86))
    c.hline(hx - 1, hy - 2, 2, INK)
    c.hline(hx - 1, hy + 1, 2, INK)


def megamart(c, x, top, base, glass, frame, sign, lit=None, seed=1, sky_refl=None, parapet=True):
    """«МегаМарт»: стеклянная коробка в сетку, в стекле отражается небо, красная полоса вывески
    со значком тележки и «%» (без букв), раздвижные двери под козырьком."""
    w = W - x
    rnd = random.Random(seed)
    for y in range(top, base):
        t = (y - top) / max(1, base - top)
        c.hline(x, y, w, mix(sky_refl or glass, glass, min(1, t * 1.4)))
    # Отражения неба - широкие косые светлые полосы.
    for i in range(-40, w + base - top, 46):
        for y in range(top, base):
            for d in range(12):
                gx = x + i + d + (base - y) // 2
                if x <= gx < W:
                    blend(c, gx, y, WHITE, 0.1 if 2 <= d <= 9 else 0.05)
    for gy in range(top, base, 12):
        for gx in range(x + 1, W, 16):
            if lit and gy > base - 40 and rnd.random() < 0.75:
                c.rect(gx, gy + 1, 15, 11, mix(lit, glass, rnd.choice((0.1, 0.3))))
                if rnd.random() < 0.5:
                    c.rect(gx + 2, gy + 6, 11, 2, mix(glass, lit, 0.5))
    for gx in range(x, W, 16):
        c.vline(gx, top, base - top, frame)
        c.vline(gx + 1, top, base - top, shade(frame, 1.35))
    for gy in range(top, base, 12):
        c.hline(x, gy, w, frame)
    c.rect(x, top, 5, base - top, shade(frame, 1.25))
    c.vline(x, top, base - top, shade(frame, 1.6))
    if parapet:
        c.rect(x - 2, top - 5, w + 2, 5, shade(frame, 1.2))
        c.hline(x - 2, top - 5, w + 2, shade(frame, 1.7))
    # Вывеска: полоса со значком тележки и «%».
    sy = base - 66
    c.rect(x + 8, sy, w - 8, 20, shade(sign, 0.6))
    c.rect(x + 9, sy + 1, w - 10, 18, sign)
    c.hline(x + 9, sy + 1, w - 10, shade(sign, 1.25) if sign[0] > 100 else shade(sign, 1.4))
    ink = WHITE if sign[0] > 100 else shade(sign, 1.45)
    cart = [
        "ww..........",
        ".w..........",
        ".wwwwwwwwww.",
        ".w.w.w.w.ww.",
        ".wwwwwwwwww.",
        "..w.w.w.w.w.",
        "..wwwwwwwww.",
        "..w.......w.",
        "...ww...ww..",
        "...ww...ww..",
    ]
    pct = [
        "ww...w",
        "ww..w.",
        "...w..",
        "..w...",
        ".w..ww",
        "w...ww",
    ]
    for dy, row in enumerate(cart):
        for dx, ch in enumerate(row):
            if ch == "w":
                c.px(x + 16 + dx, sy + 5 + dy, ink)
    for i, gx in enumerate(range(x + 38, W - 8, 18)):
        if i % 2:
            for dx, dy in ((0, 0), (1, 0), (2, 0), (-1, 0), (-2, 0), (0, 1), (0, -1), (0, 2), (0, -2), (1, 1), (-1, -1), (1, -1), (-1, 1)):
                c.px(gx + 3 + dx, sy + 10 + dy, ink)
            continue
        for dy, row in enumerate(pct):
            for dx, ch in enumerate(row):
                if ch == "w":
                    c.px(gx + dx, sy + 7 + dy, ink)
    # Вход: раздвижные двери под козырьком.
    ex = x + min(w // 2, 72) - 20
    c.rect(ex - 8, base - 46, 56, 4, shade(frame, 0.8))
    c.hline(ex - 8, base - 46, 56, shade(frame, 1.6))
    c.rect(ex, base - 42, 40, 42, mix(lit or glass, frame, 0.35))
    c.vline(ex + 20, base - 42, 42, frame)
    c.frame(ex, base - 42, 40, 42, frame)
    return ex + 20


def crane(c, x, top, arm_l, arm_r, color, tower=30):
    """Башенный кран: решётчатая башня (видна над крышей), стрела с противовесом, кабина. Крюк рисует сцена."""
    for y in range(top, top + tower - 6, 6):
        c.line(x - 3, y, x + 3, y + 6, shade(color, 0.8))
        c.line(x + 3, y, x - 3, y + 6, shade(color, 0.8))
    c.vline(x - 3, top, tower, color)
    c.vline(x + 3, top, tower, color)
    c.hline(x - arm_l, top, arm_l + arm_r, color)
    c.hline(x - arm_l, top + 4, arm_l + arm_r, color)
    for xx in range(x - arm_l, x + arm_r, 6):
        c.line(xx, top + 4, xx + 3, top, shade(color, 0.8))
        c.line(xx + 3, top, xx + 6, top + 4, shade(color, 0.8))
    c.line(x, top - 12, x - arm_l + 4, top, C("K"))
    c.line(x, top - 12, x + arm_r - 2, top, C("K"))
    c.rect(x - 2, top - 14, 5, 14, color)
    c.rect(x + arm_r - 12, top + 5, 12, 7, C("G"))
    c.rect(x - 9, top + 5, 10, 9, shade(color, 0.85))
    c.rect(x - 7, top + 7, 6, 4, ICE)


def ch3():
    """Конкурент. Пасмурно: стеклянный «МегаМарт» навис над улицей, кран несёт балку над нашим
    магазином; у входа гиганта - Эдуард с листовками, флажки и шары, туда идут покупатели.
    Наш магазин - в серой тени, но витрины горят тёплым; хозяин и тётя Валя хмурятся."""
    c = Canvas(W, H)
    sky(c, [C("G"), M("G", "l", 0.65), C("l"), M("l", "W", 0.75)], 0, 124, 10)
    overcast(c, [
        (98, (M("W", "w", 0.15), M("l", "W", 0.55), C("l"))),
        (72, (M("l", "W", 0.75), M("l", "W", 0.25), M("G", "l", 0.65))),
        (44, (M("l", "W", 0.4), M("G", "l", 0.8), M("G", "l", 0.35))),
        (18, (M("G", "l", 0.95), M("G", "l", 0.5), C("G"))),
    ], 31)
    far_city(c, 124, C("l"), 31, tall=(10, 32))
    c.rect(0, 124, W, 12, M("e", "G", 0.4))
    pavement(c, GY, 160, M("l", "W", 0.75), 11)
    curb_road(c, 160, C("W"), M("K", "g", 0.4), C("W"), 12)
    # Стройка второго корпуса и кран за «МегаМартом».
    for gx in range(244, W, 14):
        c.vline(gx, 0, 40, C("G"))
        c.vline(gx + 1, 0, 40, M("G", "l", 0.55))
    for gy in range(2, 40, 10):
        c.hline(244, gy, W - 244, C("G"))
    crane(c, 304, 8, 200, 18, C("o"))
    ex = megamart(c, 150, 30, GY, C("g"), C("K"), C("R"), lit=ICE, seed=3, sky_refl=M("l", "W", 0.4))
    glow(c, ex, GY + 6, 40, 7, ICE, 0.22)
    # Флажки и арка из шаров - открытие.
    for i, fx in enumerate(range(152, W, 7)):
        sag = int(6 * math.sin((fx - 152) / 56 * math.pi) ** 2)
        c.px(fx, GY - 36 + sag, C("K"))
        col = (C("R"), C("Y"), WHITE)[i % 3]
        c.rect(fx + 1, GY - 35 + sag, 4, 2, col)
        c.hline(fx + 2, GY - 33 + sag, 2, col)
    for i in range(22):
        a = math.pi * i / 21
        bx, by = ex - math.cos(a) * 30, GY - 2 - math.sin(a) * 50
        col = (C("R"), WHITE, C("Y"))[i % 3]
        c.ellipse(bx, by, 3, 3, shade(col, 0.8))
        c.ellipse(bx - 0.5, by - 0.5, 2, 2, col)
        c.px(int(bx) - 1, int(by) - 2, WHITE)
    for tx in (ex + 30, ex + 42, ex + 54):
        trolley(c, tx, GY + 4)
    # Наш магазин в тени гиганта.
    door = little_shop(c, 8, 112, 84, C("N"), 51)
    put(c, grade(tree(40, 72, (C("E"), C("e"), C("d")), 8), C("l"), 0.25), 112, GY - 70)
    for y in range(0, H):
        for x in range(0, 156):
            fall = (x - 100) / 56
            t = 0.3 if fall <= 0 else 0.3 * (1 - fall)
            if t > 0 and (y > 60 or x > 0):
                blend(c, x, y, C("K"), t if y > 60 else t * 0.4)
    for wx in (14, 66):
        glow(c, wx + 22, 112, 30, 14, C("y"), 0.2)
    glow(c, door, GY + 6, 26, 5, C("y"), 0.2)
    # Балка на крюке крана - над нашей крышей.
    hx = 116
    c.vline(hx, 12, 44, C("g"))
    c.vline(hx + 3, 12, 44, C("g"))
    c.rect(hx - 1, 54, 6, 3, C("K"))
    c.line(hx, 56, hx - 16, 62, C("K"))
    c.line(hx + 3, 56, hx + 19, 62, C("K"))
    c.rect(hx - 22, 62, 48, 6, C("y"))
    c.hline(hx - 22, 62, 48, C("Y"))
    c.hline(hx - 22, 67, 48, C("o"))
    for bx in range(hx - 18, hx + 24, 8):
        c.rect(bx, 64, 3, 2, C("o"))
    # Люди.
    gray = (C("K"), 0.14)
    place(c, 64, 152, VALYA, "right", "frown", shadow=0.25, light=gray)
    place(c, 88, 150, HERO, "front", "frown", shadow=0.25, light=gray)
    place(c, 226, 154, EDUARD, "front", "happy", shadow=0.3)
    flyers(c, 233, 133)
    place(c, 146, 156, passer(0, prop="stringbag"), "right", walk=1, shadow=0.25)
    place(c, 176, 148, passer(1), "right", walk=2, shadow=0.25)
    place(c, 288, 150, passer(2, bag=True), "back", walk=1, shadow=0.25)
    # Листовка на плитке, лужица.
    c.rect(118, 154, 7, 5, WHITE)
    c.hline(119, 155, 5, C("R"))
    c.ellipse(121, 157.5, 1.5, 1, C("R"))
    for yy in range(4):
        c.hline(36 - yy * 2, 157 + yy, 24 + yy * 4, mix(M("l", "W", 0.4), M("l", "W", 0.75), 0.3))
    save(c, "ch3")


def flyers(c, x, y):
    """Пачка листовок «скидки» в руке Эдуарда."""
    o = Canvas(8, 8)
    o.rect(0, 1, 7, 7, WHITE)
    o.rect(1, 0, 7, 7, WHITE)
    o.hline(2, 2, 4, C("R"))
    o.ellipse(4, 5, 1.5, 1.5, C("R"))
    o = outlined(o)
    put(c, o, x, y)


def trolley(c, x, y):
    o = Canvas(14, 14)
    o.frame(1, 1, 12, 7, C("W"))
    for xx in range(3, 12, 2):
        o.vline(xx, 2, 5, C("l"))
    o.hline(2, 9, 10, C("W"))
    o.line(0, 0, 1, 1, C("W"))
    o.px(3, 12, C("K"))
    o.px(10, 12, C("K"))
    o.vline(3, 9, 3, C("l"))
    o.vline(10, 9, 3, C("l"))
    o = outlined(o)
    dark(c, x + 7, y, 6, 1, 0.25)
    put(c, o, x, y - 13)


def ch4():
    """Проверка. Наш зал: инспектор Белова (фуражка с кокардой, как на портрете) с планшетом смотрит
    на градусник холодильника; хозяин вытянулся (капелька пота), тётя Валя хмурится у стеллажа - это
    Эдуард нажаловался. Пол вымыт до блеска - в нём отражаются люди и стеллажи; ведро со шваброй,
    знак «мокрый пол» значком и корзинки - ближний план; свет ламп, за окном день."""
    c = Canvas(W, H)
    FY = 118  # низ стены, дальше пол: стена выше - стеллажи крупнее, пол не пустует
    plaster(c, 0, 0, W, FY, C("F"), 61)
    for x in range(0, W, 24):
        c.vline(x, 0, FY - 30, shade(C("F"), 0.97))
    c.rect(0, FY - 30, W, 30, C("B"))
    for x in range(0, W, 8):
        c.vline(x, FY - 29, 29, C("a"))
        c.vline(x + 1, FY - 29, 29, shade(C("B"), 1.08))
    c.rect(0, FY - 32, W, 3, C("b"))
    c.hline(0, FY - 32, W, C("n"))
    c.hline(0, FY - 1, W, C("x"))
    # Окно: день, напротив дом и дерево.
    wx, wy, ww, wh = 10, 18, 50, 52
    view = Canvas(ww, wh)
    for y in range(wh):
        view.hline(0, y, ww, mix(ICE, MIST, y / wh))
    cloud(view, 6, 12, 18, WHITE, MIST, C("W"), 3)
    view.rect(0, 38, ww, 14, C("i"))
    view.rect(3, 16, 22, 28, C("t"))
    view.rect(3, 16, 22, 2, shade(C("t"), 0.8))
    for xx in range(6, 22, 6):
        for yy in (20, 29):
            view.rect(xx, yy, 3, 5, C("U"))
    put(view, tree(20, 36, (C("E"), C("e"), C("d")), 2), 30, 10)
    view.rect(0, 46, ww, 6, C("W"))
    put(c, view, wx, wy)
    c.frame(wx - 2, wy - 2, ww + 4, wh + 4, WHITE)
    c.frame(wx - 1, wy - 1, ww + 2, wh + 2, C("W"))
    c.vline(wx + ww // 2, wy, wh, WHITE)
    c.hline(wx, wy + wh // 2 - 4, ww, WHITE)
    c.rect(wx - 4, wy + wh + 2, ww + 8, 3, WHITE)
    c.hline(wx - 4, wy + wh + 4, ww + 8, C("W"))
    c.rect(wx + 6, wy + wh - 4, 6, 6, C("B"))
    c.ellipse(wx + 9, wy + wh - 7, 4, 3, C("e"))
    c.px(wx + 8, wy + wh - 9, C("R"))
    c.px(wx + 11, wy + wh - 8, C("R"))
    # Стеллажи с товарами игры, холодильник, часы, касса.
    shelf_unit(c, 72, 26, 56, FY - 26, C("B"), ["bread", "buns", "pies", "honeycake", "jam"], 1)
    shelf_unit(c, 132, 26, 56, FY - 26, C("e"), ["apples", "tangerines", "pickles", "potatoes", "pumpkins"], 2)
    fridge(c, 194, 20, 62, FY - 20)
    c.ellipse(292, 22, 8, 8, C("K"))
    c.ellipse(292, 22, 6, 6, WHITE)
    c.vline(292, 17, 5, C("K"))
    c.hline(292, 22, 4, C("K"))
    c.px(292, 22, C("R"))
    c.rect(266, FY - 38, 54, 6, C("n"))
    c.hline(266, FY - 38, 54, C("N"))
    c.rect(266, FY - 32, 54, 32, C("a"))
    c.vline(266, FY - 32, 32, C("b"))
    for yy in range(FY - 28, FY, 6):
        c.hline(268, yy, 52, C("b"))
    c.rect(286, FY - 54, 20, 16, C("G"))
    c.rect(288, FY - 52, 16, 6, C("E"))
    c.hline(289, FY - 50, 6, C("e"))
    c.rect(284, FY - 40, 24, 2, C("g"))
    c.rect(270, FY - 44, 10, 6, C("W"))
    # Пол плиткой в перспективе: тона пола игры через одну, ближе к зрителю - на ступень темнее.
    y, h, row = FY, 4, 0
    while y < H:
        hh = min(h, H - y)
        tw = 22 + row * 6
        near = 0.97 if y > 156 else 1.0
        for x in range(-((row * 9) % tw), W, tw):
            tone = shade(C("f") if ((x // tw) + row) % 2 else C("Q"), near)
            c.rect(x, y, tw, hh, tone)
            c.hline(x, y, tw, shade(tone, 0.92))
            c.vline(x, y, hh, shade(tone, 0.9))
            c.hline(x + 1, y + 1, tw - 2, shade(tone, 1.03))
        y += hh
        h += 2
        row += 1
    # Отражения стеллажей в мытом полу.
    for sx, sw, col in ((72, 56, C("B")), (132, 56, C("e")), (194, 62, ICE), (266, 54, C("a"))):
        for i in range(20):
            for xx in range(sx + 2, sx + sw - 2):
                if (xx + i) % 3:
                    blend(c, xx, FY + 1 + i, col, 0.26 * (1 - i / 20))
    # Свет из окна косой полосой по полу.
    for i in range(40):
        for xx in range(wx + 6 + i // 2, wx + ww + 10 + i):
            blend(c, xx, FY + 2 + i, C("Y"), 0.06)
    # Лампы под потолком.
    for lx in (100, 226):
        c.vline(lx, 0, 4, C("G"))
        c.rect(lx - 7, 4, 15, 3, C("y"))
        c.hline(lx - 6, 7, 13, C("Y"))
        glow(c, lx, 8, 16, 5, C("Y"), 0.3)
        cone(c, lx, 9, 150, 50, LAMP, 0.07)
    # Градусник на дверце холодильника - на него смотрит инспектор.
    thermometer(c, 200, 92)
    # Люди с отражениями: Валя хмурится у стеллажа, хозяин навытяжку, инспектор у градусника.
    place(c, 100, 151, VALYA, "right", "frown", shadow=0.22, reflect=0.2)
    place(c, 140, 153, HERO, "front", "frown", shadow=0.22, reflect=0.22)
    c.px(151, 122, WHITE)
    c.rect(150, 123, 2, 2, BLUE_LIGHT)
    c.px(151, 125, C("U"))
    clipboard(c, 186, 130)
    place(c, 178, 155, dict(INSPECTOR, band="g"), "right", None, shadow=0.22, reflect=0.22, reach=True)
    # Ближний план: знак «мокрый пол», ведро со шваброй, корзинки у входа.
    wet_sign(c, 22, 168)
    mop_bucket(c, 60, 178)
    baskets(c, 306, 180)
    for sx, sy in ((48, 132), (120, 166), (232, 128), (246, 170), (90, 174), (214, 140), (296, 136)):
        sparkle(c, sx, sy)
    # Края кадра чуть темнее - взгляд в середину, на людей.
    for yy in range(H):
        for xx in list(range(0, 14)) + list(range(W - 14, W)):
            d = min(xx, W - 1 - xx)
            blend(c, xx, yy, INK, 0.05 * (1 - d / 14) + (0.04 if yy > 164 else 0))
    save(c, "ch4")


def thermometer(c, x, y):
    """Градусник 5×20: стекло, красный столбик, шарик снизу, риски сбоку."""
    o = Canvas(7, 22)
    o.round_rect(1, 0, 4, 17, WHITE, 1)
    o.vline(4, 1, 15, C("W"))
    for yy in range(2, 15, 3):
        o.px(1, yy, C("l"))
    o.vline(2, 7, 11, C("R"))
    o.vline(3, 7, 11, C("r"))
    o.ellipse(3, 18.5, 2.6, 2.6, C("R"))
    o.px(2, 18, C("s"))
    o = outlined(o)
    put(c, o, x - 4, y)


def baskets(c, x, base):
    """Стопка красных корзинок для покупателей - ближний план, у края кадра."""
    o = Canvas(30, 26)
    for i in range(3):
        y = 14 - i * 5
        o.rect(2, y, 26, 10, C("R"))
        o.hline(2, y, 26, C("s"))
        for xx in range(5, 26, 4):
            o.rect(xx, y + 3, 2, 5, C("r"))
        o.vline(27, y, 10, C("r"))
    o.line(6, 4, 15, 0, C("g"))
    o.line(15, 0, 24, 4, C("g"))
    o = outlined(o)
    dark(c, x, base - 1, 16, 3, 0.25)
    put(c, o, x - 15, base - 26)


def shelf_unit(c, x, y, w, h, color, items, seed):
    """Стеллаж у стены: рама цвета отдела, три полки с товарами игры, табличка-значок сверху."""
    c.rect(x, y, w, h, shade(color, 0.6))
    c.rect(x + 2, y + 2, w - 4, h - 4, shade(color, 0.45))
    c.vline(x, y, h, shade(color, 1.15))
    c.vline(x + w - 1, y, h, shade(color, 0.5))
    c.rect(x - 1, y - 3, w + 2, 4, color)
    c.hline(x - 1, y - 3, w + 2, shade(color, 1.2))
    goods(c, x + 3, y + 4, w - 6, h - 8, shade(color, 0.42), C("Y"), seed, shelf=color, items=items, step=18, glare=False)
    # Значок отдела вместо надписи.
    ico = asset(f"item_{items[0]}_0")
    c.rect(x + w // 2 - 8, y - 14, 16, 12, WHITE)
    c.frame(x + w // 2 - 8, y - 14, 16, 12, shade(color, 0.6))
    if ico is not None:
        put(c, ico, x + w // 2 - 5, y - 14)
    c.vline(x + w // 2 - 4, 0, y - 14, C("G"))
    c.vline(x + w // 2 + 3, 0, y - 14, C("G"))


def fridge(c, x, y, w, h):
    """Холодильник со стеклянными дверцами: холодный свет, иней по углам, молочное и мороженое."""
    c.rect(x, y, w, h, C("W"))
    c.vline(x, y, h, WHITE)
    c.vline(x + w - 1, y, h, C("l"))
    c.rect(x, y, w, 6, C("U"))
    c.hline(x, y, w, BLUE_LIGHT)
    for i in range(2):
        dx = x + 3 + i * (w - 6) // 2
        dw = (w - 6) // 2 - 2
        goods(c, dx, y + 9, dw, h - 14, mix(MIST, BLUE_LIGHT, 0.3), MIST, 70 + i, shelf=C("l"), items=["milk", "icecream", "water", "juice", "kvass"], step=17)
        c.frame(dx - 1, y + 8, dw + 2, h - 12, C("l"))
        c.vline(dx + dw - 3, y + h // 2 - 6, 12, C("G"))
        for k in range(6):
            blend(c, dx + k, y + 9, WHITE, 0.6 - k * 0.1)
            blend(c, dx, y + 9 + k, WHITE, 0.6 - k * 0.1)
    glow(c, x + w // 2, y + h // 2, w // 2 + 8, h // 2 + 6, ICE, 0.12)


def clipboard(c, x, y):
    o = Canvas(10, 13)
    o.rect(0, 1, 10, 12, C("a"))
    o.rect(1, 3, 8, 9, WHITE)
    o.rect(3, 0, 4, 2, C("l"))
    for yy in (5, 7, 9):
        o.hline(2, yy, 5, C("l"))
    o.px(7, 5, C("E"))
    o.px(7, 7, C("E"))
    o = outlined(o)
    put(c, o, x, y)


def mop_bucket(c, x, base):
    o = Canvas(22, 46)
    o.line(15, 0, 8, 36, C("a"))
    o.line(16, 0, 9, 36, C("B"))
    o.rect(2, 32, 16, 12, C("U"))
    o.rect(2, 32, 16, 2, BLUE_LIGHT)
    o.vline(17, 34, 10, C("u"))
    o.rect(4, 30, 12, 2, ICE)
    for i in range(6):
        o.vline(5 + i * 2, 28, 3, WHITE if i % 2 else C("W"))
    o = outlined(o)
    dark(c, x, base, 10, 2, 0.25)
    put(c, o, x - 11, base - 45)
    glow(c, x - 18, base + 4, 14, 3, ICE, 0.3)


def wet_sign(c, x, base):
    """Знак «мокрый пол»: жёлтая раскладушка с человечком, который поскальзывается (без слов)."""
    o = Canvas(18, 26)
    for row in range(24):
        half = 2 + row * 6 // 24
        o.hline(9 - half, row, half * 2, C("Y"))
        o.px(9 + half - 1, row, C("y"))
    o.rect(5, 23, 9, 2, C("y"))
    o.ellipse(9, 7, 1.5, 1.5, C("K"))
    o.line(9, 9, 8, 14, C("K"))
    o.line(8, 11, 11, 10, C("K"))
    o.line(8, 14, 6, 17, C("K"))
    o.line(8, 14, 11, 16, C("K"))
    o.hline(5, 19, 8, C("K"))
    o = outlined(o)
    dark(c, x, base, 10, 2, 0.25)
    put(c, o, x - 9, base - 25)


def sparkle(c, x, y):
    c.px(x, y, WHITE)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        blend(c, x + dx, y + dy, WHITE, 0.8)
    for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2)):
        blend(c, x + dx, y + dy, WHITE, 0.4)


def univermag(c, x, w, top, wall, seed, lit=C("Y"), garland=False, ground=54, lit_p=0.88):
    """Наш универмаг: два верхних этажа с окнами (свет, полки, люди), карнизы и пилястры,
    вывеска-значок с лампочками на крыше и флажки, первый этаж - навес, витрины с товарами
    игры, двустворчатая дверь со светом. Возвращает x середины двери."""
    up = (GY - ground - top) // 2
    plaster(c, x, top, w, GY - top, wall, seed)
    c.rect(x + w - 4, top, 4, GY - top, shade(wall, 0.8))
    rnd = random.Random(seed)
    mid = x + w // 2
    for px_ in (x, mid - 3, x + w - 10):
        c.rect(px_, top, 6, GY - ground - top, shade(wall, 1.06))
        c.vline(px_ + 5, top, GY - ground - top, shade(wall, 0.86))
    for f in range(2):
        fy = top + f * up
        c.rect(x - 2, fy + up - 3, w + 4, 3, shade(wall, 0.76))
        c.hline(x - 2, fy + up - 3, w + 4, shade(wall, 1.12))
        for wx in range(x + 12, x + w - 22, 22):
            if abs(wx + 7 - mid) < 14:
                continue
            wh = up - 9
            on = rnd.random() < lit_p
            for yy in range(wh):
                c.hline(wx, fy + 3 + yy, 14, mix(lit, C("y"), yy / wh) if on else shade(wall, 0.55))
            if on:
                c.rect(wx, fy + 3 + wh - 3, 14, 3, C("o"))
                k = rnd.random()
                if k < 0.4:
                    hx = wx + 3 + rnd.randrange(6)
                    c.ellipse(hx + 1.5, fy + wh - 3, 2, 2, shade(C("o"), 0.7))
                    c.rect(hx, fy + wh - 1, 4, 4, shade(C("o"), 0.7))
                elif k < 0.7:
                    c.rect(wx + 1, fy + 6, 12, 1, shade(C("o"), 0.8))
                    for gx in range(wx + 2, wx + 12, 3):
                        c.rect(gx, fy + 4, 2, 2, (C("R"), C("E"), C("U"))[(gx // 3) % 3])
                c.rect(wx, fy + 3, 3, wh, shade(C("R"), 0.8))
                c.rect(wx + 11, fy + 3, 3, wh, shade(C("R"), 0.8))
                glow(c, wx + 7, fy + 3 + wh // 2, 14, wh // 2 + 4, lit, 0.12)
            framed(c, wx, fy + 3, 14, wh, shade(wall, 0.55), sill=shade(wall, 0.78))
            c.vline(wx + 7, fy + 3, wh, shade(wall, 0.55))
    # Карниз, вывеска с лампочками и флажки на крыше.
    c.rect(x - 4, top - 5, w + 8, 5, shade(wall, 0.7))
    c.hline(x - 4, top - 5, w + 8, shade(wall, 1.15))
    for i in range(x - 2, x + w + 2, 5):
        c.rect(i, top, 3, 2, shade(wall, 0.75))
    sw = 92
    c.vline(mid - 30, top - 8, 3, C("g"))
    c.vline(mid + 30, top - 8, 3, C("g"))
    sign_board(c, mid - sw // 2, top - 24, sw, 17, C("p"))
    glow(c, mid, top - 15, sw // 2 + 12, 14, C("Y"), 0.16)
    for fx in (x + 6, x + w - 9):
        c.vline(fx, top - 24, 19, C("G"))
        c.rect(fx + 1, top - 24, 8, 5, C("R"))
        c.hline(fx + 1, top - 22, 8, WHITE)
    # Первый этаж.
    gy0 = GY - ground
    below = awning(c, x - 1, gy0 + 3, w + 2, (C("R"), WHITE))
    shadow_band(c, x, below, w - 4, 4)
    dw = 32
    dx = mid - dw // 2
    wy = below + 3
    wh = GY - 14 - wy
    for wx in list(range(x + 8, dx - 44, 48)) + list(range(dx + dw + 10, x + w - 46, 48)):
        goods(c, wx, wy, 40, wh, mix(C("x"), lit, 0.3), lit, seed + wx, step=13)
        framed(c, wx, wy, 40, wh, C("a"), sill=shade(wall, 0.75))
        glow(c, wx + 20, GY + 6, 26, 5, lit, 0.2)
    bricks(c, x, GY - 11, w, 11, C("B"), seed + 3)
    c.rect(dx - 3, below, dw + 6, GY - below, C("b"))
    c.rect(dx, below + 2, dw, GY - below - 2, mix(lit, C("n"), 0.2))
    c.vline(dx + dw // 2, below + 2, GY - below - 2, C("a"))
    c.vline(dx, below + 2, GY - below - 2, C("a"))
    c.vline(dx + dw - 1, below + 2, GY - below - 2, C("a"))
    for yy in range(below + 2, GY):
        blend(c, dx + 3 + (yy - below) // 3, yy, WHITE, 0.3)
        blend(c, dx + dw // 2 + 3 + (yy - below) // 3, yy, WHITE, 0.3)
    c.rect(dx + dw // 2 - 4, below + 20, 2, 5, C("y"))
    c.rect(dx + dw // 2 + 2, below + 20, 2, 5, C("y"))
    c.rect(dx - 8, GY - 2, dw + 16, 2, C("l"))
    c.hline(dx - 8, GY - 2, dw + 16, C("W"))
    glow(c, mid, GY + 10, 60, 14, lit, 0.3)
    if garland:
        for row_y in (top - 1, top + up - 1, top + 2 * up - 1):
            for i, gx in enumerate(range(x - 4, x + w + 4, 4)):
                sag = int(3 * math.sin((gx - x) / 24 * math.pi) ** 2)
                col = (C("R"), C("Y"), C("E"), C("c"))[(i + row_y) % 4]
                c.px(gx, row_y + sag, col)
                blend(c, gx, row_y + sag + 1, col, 0.35)
                blend(c, gx - 1, row_y + sag, col, 0.25)
    return mid


def ch5():
    """Универмаг. Сумерки: наш универмаг светится, у входа свои; «МегаМарт» погас и заколочен,
    листок «продаётся»; Эдуард идёт от него к нам под фонарём с коробкой - несёт старый долг."""
    c = Canvas(W, H)
    sky(c, [C("K"), M("g", "p", 0.2), C("p"), C("P"), C("s"), C("o")], 0, 124, 12)
    stars(c, 40, 50, 3)
    c.ellipse(300, 12, 6, 6, C("N"))
    c.ellipse(303, 10, 5, 5, mix(C("K"), M("g", "p", 0.2), 0.15))
    glow(c, 298, 12, 12, 10, C("N"), 0.1)
    far_city(c, 124, M("K", "p", 0.35), 51, lit=C("y"), lit_p=0.3, tall=(14, 44))
    c.rect(0, 124, W, 12, M("d", "K", 0.45))
    pavement(c, GY, 160, M("l", "p", 0.25), 13)
    curb_road(c, 160, M("W", "p", 0.25), M("k", "g", 0.4), M("W", "p", 0.25), 14)
    # «МегаМарт» погас: тёмное стекло, вывеска без света, двери заколочены, листок «продаётся».
    ex = megamart(c, 238, 34, GY, M("k", "K", 0.6), M("k", "K", 0.2), M("g", "G", 0.3), seed=5, sky_refl=M("g", "p", 0.5))
    for d in (0, 2):
        c.line(ex - 20, GY - 40 + d, ex + 20, GY - 4 + d, C("a") if d else C("B"))
        c.line(ex + 20, GY - 40 + d, ex - 20, GY - 4 + d, C("a") if d else C("B"))
    for nx, ny in ((ex - 19, GY - 39), (ex + 18, GY - 39), (ex - 19, GY - 5), (ex + 18, GY - 5)):
        c.px(nx, ny, C("W"))
    c.rect(ex + 26, GY - 36, 10, 13, WHITE)
    c.hline(ex + 27, GY - 33, 8, C("R"))
    c.hline(ex + 27, GY - 30, 6, C("l"))
    c.hline(ex + 27, GY - 28, 7, C("l"))
    c.px(ex + 31, GY - 36, C("R"))
    # Наш универмаг: стены в сиреневой тени сумерек, окна горят.
    door = univermag(c, 10, 214, 34, mix(C("N"), C("p"), 0.38), 61)
    lamp_post(c, 230, GY + 10, on=C("Y"))
    lamp_post(c, 6, GY + 14, on=C("Y"))
    amb = (C("p"), 0.14)
    place(c, door - 30, 150, passer(1, bag=True), "front", "happy", light=amb)
    place(c, door, 148, HERO, "front", "happy", light=amb)
    place(c, door + 28, 151, VALYA, "front", "happy", light=amb)
    place(c, 52, 156, passer(4, prop="stringbag"), "back", walk=1, light=amb)
    place(c, 176, 158, passer(5), "right", walk=2, light=amb)
    # Эдуард с коробкой идёт к нам под фонарём.
    place(c, 214, 156, EDUARD, "left", None, walk=1, light=(C("y"), 0.06))
    o = Canvas(14, 11)
    o.rect(0, 1, 14, 10, C("n"))
    o.rect(0, 1, 14, 3, C("N"))
    o.rect(6, 1, 2, 10, C("t"))
    o.vline(13, 1, 10, C("B"))
    o.rect(2, 0, 3, 2, C("N"))
    o.px(10, 0, WHITE)
    o = outlined(o)
    put(c, o, 196, 138)
    save(c, "ch5")


def firework(c, cx, cy, r, color, seed):
    """Салют: лучи от белого центра к цвету, искры на концах, лёгкое свечение."""
    glow(c, cx, cy, r + 8, r + 7, color, 0.14, 4)
    rnd = random.Random(seed)
    n = 16
    for i in range(n):
        a = i * math.tau / n + rnd.random() * 0.15
        rr = r * rnd.uniform(0.85, 1.05)
        for d in range(3, int(rr)):
            x = round(cx + math.cos(a) * d)
            y = round(cy + math.sin(a) * d * 0.95 + (d / rr) ** 2 * 3)
            t = d / rr
            if t < 0.35:
                col = mix(WHITE, color, t / 0.35)
            else:
                col = color if t < 0.8 else mix(color, shade(color, 0.6), (t - 0.8) / 0.2)
            if d % 3 or t < 0.5:
                c.px(x, y, col)
        tx, ty = round(cx + math.cos(a) * rr), round(cy + math.sin(a) * rr * 0.95 + 4)
        blend(c, tx, ty + 1, color, 0.6)
        c.px(tx, ty, mix(color, WHITE, 0.5))
    c.rect(cx - 1, cy - 1, 3, 3, WHITE)


def ch6_finale():
    """Финал. Ночь, салют над универмагом в гирляндах; у входа - Марат, тётя Валя, бабушка, хозяин,
    Соня и Эдуард, а впереди спиной к нам - весь район смотрит салют."""
    c = Canvas(W, H)
    sky(c, [INK, M("k", "K", 0.4), C("K"), M("K", "p", 0.3)], 0, 124, 10)
    stars(c, 70, 100, 9)
    far_city(c, 124, M("k", "K", 0.6), 77, lit=C("y"), lit_p=0.3, tall=(14, 44))
    firework(c, 30, 46, 24, C("R"), 1)
    firework(c, 290, 50, 26, C("c"), 3)
    firework(c, 236, 14, 11, C("E"), 4)
    firework(c, 84, 14, 10, C("P"), 5)
    for sx, top in ((56, 80), (268, 86)):
        for y in range(top, 122, 2):
            blend(c, sx + (y - top) // 10, y, C("y"), 0.55 - (y - top) / 90)
    c.rect(0, 124, W, 12, M("K", "d", 0.4))
    pavement(c, GY, 160, M("G", "p", 0.3), 15)
    curb_road(c, 160, M("l", "p", 0.3), M("k", "K", 0.5), M("l", "p", 0.3), 16)
    door = univermag(c, 58, 204, 34, mix(C("N"), C("p"), 0.55), 71, garland=True, lit_p=1)
    glow(c, 70, 60, 30, 40, C("R"), 0.1)
    glow(c, 252, 60, 30, 40, C("c"), 0.1)
    lamp_post(c, 30, GY + 12, on=C("Y"))
    lamp_post(c, 290, GY + 12, on=C("Y"))
    amb = (M("K", "p", 0.3), 0.1)
    place(c, door - 64, 148, MARAT, "front", "happy", light=amb)
    place(c, door - 42, 147, VALYA, "front", "happy", light=amb)
    place(c, door - 20, 146, GRANDMA, "front", "happy", light=amb)
    place(c, door + 2, 146, HERO, "front", "happy", light=amb)
    place(c, door + 24, 147, SONYA, "front", "happy", light=amb)
    c.rect(door + 28, 117, 2, 1, C("Y"))
    place(c, door + 48, 148, EDUARD, "front", "happy", light=amb)
    # Район спиной к нам: ближе к зрителю - темнее, у двоих шарики.
    front = (INK, 0.3)
    spots = ((14, 178), (44, 182), (76, 176), (232, 180), (264, 176), (296, 182), (120, 184), (196, 184))
    for i, (x, y) in enumerate(spots):
        extra = {}
        if i == 1:
            extra = dict(prop="balloon", prop_tint="#e43b44")
        if i == 4:
            extra = dict(prop="balloon", prop_tint="#fee761")
        place(c, x, y, passer(i, **extra), "back", None, light=front, shadow=0)
    rnd = random.Random(9)
    for _ in range(70):
        x, y = rnd.randrange(W), rnd.randrange(30, 150)
        col = rnd.choice([C("R"), C("Y"), C("E"), C("c"), C("P"), WHITE])
        c.px(x, y, col)
        if rnd.random() < 0.4:
            c.px(x + 1, y + 1, shade(col, 0.7))
    save(c, "finale")


def main():
    ch1()
    ch2()
    ch3()
    ch4()
    ch5()
    ch6_finale()


if __name__ == "__main__":
    main()
