"""«Лавка «Своё»» — мир второй игры (src/lavka, docs/farm/mockup): земля одним слоем, свои спрайты и раскладка.

    python3 art/lavka.py

Пишет в public/assets:
- lavka_ground.png — вся земля 512×1020 пикселей рисунка (256×510 точек мира, из них 40 сверху — поле под
  панелью игры): трава, пшеница, двор, грядки, полы и стены лавки, веранда, площадка, дорога. По ней ходят.
- lavka_*.png — предметы, за которые заходят люди (амбар, коровы, прилавок…): каждый — своя картинка.
и src/lavka/layout.json — где стоят неподвижные предметы (точки мира, низ по середине), в том числе кадры
общего атласа (деревья, заборы, лотки) — сцена ставит их по этому списку.

Координаты ниже — пиксели рисунка (как в макете docs/farm/mockup/compose.py), в JSON делятся на ART = 2.
"""

import json
import random
from pathlib import Path

from PIL import Image, ImageDraw

import lavka_farm as F
import lavka_ui as U
import lavka_v3 as V
import lavka_sprites as N
from premium import H
from sprites import OUT

ROOT = Path(__file__).resolve().parent.parent
LAYOUT = ROOT / "src" / "lavka" / "layout.json"
# Мир узкий (256 точек): на телефоне всё крупнее. Четвёртая раскладка (07.11, по замечаниям автора): огород
# сверху слева — небольшой, справа — крупный амбар; под ними сад с ульями вразбивку и загон с коровой и прудом;
# ещё ниже курятник с выгулом и сенник, куда трактор привозит сено по дорожке; лавка — один широкий зал (4 полки
# и прилавок), справа площадка под стройку; улица с фонарями, скамейками и зеброй.
W, HGT = 512, 900
ART = 2

# Полосы и места (пиксели рисунка); те же числа знает сцена (src/lavka/LavkaScene.ts, в точках — вдвое меньше).
GARDEN = (6, 4, 304, 158)   # x0, y0, x1, y1 — огород
PATH_X = (204, 236)         # средняя тропинка
LANE0, LANE1 = 474, 512     # дорожка поперёк фермы
BX0, BX1 = 72, 440          # лавка по ширине
BY0, BY1 = 518, 738         # лавка по высоте
PLAZA_B = 800               # площадка перед лавкой
ROAD_B = 876                # дорога
DOOR_X = 256                # вход в зал
BACK_X = 220                # задняя дверь — на средней тропинке фермы
BED_X = (18, 112, 206)
BED_Y = (24, 92)
RUN = (4, 326, 200, 468)    # выгул кур
PADDOCK = (244, 182, 508, 340)
# Над миром — полоска травы под панелью игры (монеты, часы), ферма начинается под ней.
TOP = 40

ground = Image.new("RGBA", (W, HGT + TOP), (0, 0, 0, 255))
props = []              # {"k": ключ картинки, "x", "y" — низ по середине в точках мира, "z"?, "tint"?, "flip"?}
made = {}               # свои картинки: ключ → Image


def src(name):
    return Image.open(OUT / f"{name}.png").convert("RGBA")


def tile(name, x0, y0, w, h):
    t = src(name)
    tw, th = t.size
    region = Image.new("RGBA", (w, h))
    for yy in range(0, h, th):
        for xx in range(0, w, tw):
            region.alpha_composite(t.crop((0, 0, min(tw, w - xx), min(th, h - yy))), (xx, yy))
    ground.alpha_composite(region, (x0, y0 + TOP))


def lay(img, x, y):
    ground.alpha_composite(img, (int(x), int(y) + TOP))


def rect(x, y, w, h, col):
    ground.paste(Image.new("RGBA", (w, h), col), (x, y + TOP))


def own(key, img):
    """Своя картинка: сохраняется один раз как lavka_<key>.png."""
    full = f"lavka_{key}"
    if full not in made:
        made[full] = img
    return full


def put(key, x, y, z=None, tint=None, flip=False):
    """Предмет: x — середина, y — низ (пиксели рисунка). key — кадр атласа или своя картинка (own)."""
    p = {"k": key, "x": round(x / ART, 1), "y": round(y / ART, 1)}
    if z is not None:
        p["z"] = round(z / ART, 1)
    if tint is not None:
        p["tint"] = tint
    if flip:
        p["flip"] = True
    props.append(p)


def dirt_blob(shapes, seed, base=H("#c28569")):
    """Утоптанная земля неровной формы: тёмная кромка, камешки."""
    mask = Image.new("L", ground.size, 0)
    d = ImageDraw.Draw(mask)
    for kind, x, y, w, h in shapes:
        y += TOP
        if kind == "e":
            d.ellipse((x, y, x + w, y + h), fill=255)
        else:
            d.rounded_rectangle((x, y, x + w, y + h), radius=10, fill=255)
    rnd = random.Random(seed)
    m = mask.load()
    px = ground.load()
    cols = [H("#c28569"), H("#c28569"), H("#b86f50"), H("#e4a672"), H("#8f563b")]
    gw, gh = ground.size
    for y in range(gh):
        for x in range(W):
            if not m[x, y]:
                continue
            edge = any(not m[nx, ny] for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)) if 0 <= nx < W and 0 <= ny < gh)
            if edge:
                if rnd.random() < 0.55:
                    px[x, y] = H("#8f563b")
            else:
                px[x, y] = rnd.choice(cols) if rnd.random() < 0.18 else base
    for _ in range(80):
        x, y = rnd.randrange(W - 1), rnd.randrange(gh)
        if m[x, y] and m[x + 1, y]:
            px[x, y] = H("#e4a672")
            px[x + 1, y] = H("#8f563b")


def fence_run(x0, x1, y):
    for x in range(x0, x1, 32):
        put("fence_h", x + 16, y)


def fence_col(x, y0, y1):
    for y in range(y0, y1, 14):
        put("fence_v", x, y + 14)


def shelf_with(items):
    """Полка из атласа с товаром на двух ярусах и передней кромкой (как ставит товар магазин)."""
    im = src("shelf").copy()
    for row, by in enumerate((30, 52)):
        for i in range(6):
            fr = src(items[(row * 6 + i) % len(items)])
            im.alpha_composite(fr, (8 + i * 11 + (11 - fr.size[0]) // 2, by - fr.size[1]))
    im.alpha_composite(src("shelf_front"), (0, 0))
    return im


def stand_with(fills):
    im = src("stand").copy()
    for i, f in enumerate(fills):
        im.alpha_composite(N.apple_crate(f), (6 + (i % 4) * 17, 16 + (i // 4) * 22))
    im.alpha_composite(src("stand_front"), (0, 0))
    return im


def build():
    # ============================================================ ЗЕМЛЯ
    tile("grass", 0, -TOP, W, HGT + TOP)
    gx0, gy0, gx1, gy1 = GARDEN
    dirt_blob([("r", gx0 + 4, gy0 + 4, gx1 - gx0 - 8, gy1 - gy0 - 6)], 3, base=H("#c28569"))
    for r, y in enumerate(BED_Y):
        for c, x in enumerate(BED_X):
            lay(V.raised_bed(seed=r * 3 + c), x, y)
    # тропинка: от калитки огорода вниз к задней двери лавки, дорожка поперёк, отводки к саду и сеннику
    dirt_blob([("r", PATH_X[0], gy1 - 6, PATH_X[1] - PATH_X[0], LANE0 - gy1 + 12), ("r", 0, LANE0, W, LANE1 - LANE0)], 11)
    for y in (LANE0 + 11, LANE1 - 11):  # колеи
        for x in range(0, W, 3):
            if (x // 3) % 5:
                ground.putpixel((x, y + TOP), H("#8f563b"))
    # выгул: солома; загон: вытоптано у поилки
    F.straw_floor(ground, RUN[0] + 2, RUN[1] + 2 + TOP, RUN[2] - 2, RUN[3] - 2 + TOP, seed=3)
    dirt_blob([("e", 262, 300, 76, 30)], 41, base=H("#8a5a44"))
    lay(F.pond(92, 46), 404, 276)
    # сад: цветы по траве
    lay(F.flowers_strip(70, 10, 2), 104, 296)
    lay(F.flowers_strip(60, 10, 5), 8, 300)
    lay(F.flowers_strip(70, 10, 6), 120, 206)
    # лавка: стены и пол — один широкий зал
    ink, wall = H("#181425"), H("#4a3b52")
    rect(BX0, BY0, BX1 - BX0, BY1 - BY0, ink)
    rect(BX0 + 2, BY0 + 2, BX1 - BX0 - 4, BY1 - BY0 - 4, wall)
    back = 30
    tile("wall_walnut", BX0 + 8, BY0 + 8, BX1 - BX0 - 16, back)
    rect(BX0 + 8, BY0 + 8 + back, BX1 - BX0 - 16, 2, ink)
    tile("floor_wood", BX0 + 8, BY0 + 10 + back, BX1 - BX0 - 16, BY1 - BY0 - 20 - back)
    fw = BY1 - 10
    rect(BX0, fw, BX1 - BX0, 10, wall)
    rect(BX0, fw, BX1 - BX0, 1, ink)
    rect(BX0, fw + 9, BX1 - BX0, 1, ink)
    for wx in (96, 150, 320, 380):
        rect(wx, fw + 2, 30, 6, H("#8fd3ff"))
        rect(wx, fw + 2, 30, 1, H("#ffffff"))
    rect(DOOR_X - 20, fw, 40, 10, H("#b86f50"))       # вход
    rect(BACK_X - 16, BY0, 32, 10, H("#b86f50"))      # задняя дверь
    # площадка под стройку справа от лавки
    dirt_blob([("r", 448, BY0 + 16, 58, BY1 - BY0 - 28)], 31)
    # перед лавкой: веранда, плитка, дорога с зеброй, тротуар
    tile("paving", 0, BY1, W, PLAZA_B - BY1)
    lay(N.deck(BX1 - BX0, 24), BX0, BY1)
    rect(BX0, BY1 + 24, BX1 - BX0, 2, H("#8f563b"))
    lay(N.flower_bed(40, 14, 3), 16, 748)
    lay(N.flower_bed(40, 14, 4), 456, 748)
    rect(0, PLAZA_B, W, 4, H("#8b9bb4"))
    tile("asphalt", 0, PLAZA_B + 4, W, ROAD_B - PLAZA_B - 8)
    for x in range(8, W, 48):
        if not DOOR_X - 40 < x + 13 < DOOR_X + 40:
            rect(x, (PLAZA_B + ROAD_B) // 2 - 1, 26, 3, (240, 240, 240, 255))
    for x in range(DOOR_X - 30, DOOR_X + 30, 10):   # зебра к входу
        rect(x, PLAZA_B + 8, 6, ROAD_B - PLAZA_B - 16, (238, 238, 238, 255))
    rect(0, ROAD_B - 4, W, 4, H("#8b9bb4"))
    tile("paving", 0, ROAD_B, W, HGT - ROAD_B)

    # ============================================================ ОГОРОД
    for x in range(gx0, gx1, 32):
        put("fence_h", x + 16, gy0)
        if not PATH_X[0] - 8 <= x + 16 <= PATH_X[1] + 8:
            put("fence_h", x + 16, gy1)
    for y in range(gy0, gy1 - 4, 32):
        put("fence_v", gx0, min(gy1, y + 32))
        put("fence_v", gx1, min(gy1, y + 32))
    for seed in ("dill", "carrot", "strawberry", "pumpkin"):
        for stage in (1, 2, 3):
            own(f"crop_{seed}{stage}", V.crops(seed, stage, bed_seed=stage))
    put(own("scarecrow", F.scarecrow()), 290, 150)

    # ============================================================ АМБАР, ЗАГОН, ПРУД
    put(own("barn", V.barn_big()), 410, 174)
    px0, py0, px1, py1 = PADDOCK
    for x in range(px0, px1, 32):
        if not 360 <= x + 16 <= 460:
            put("fence_h", x + 16, py0)
        put("fence_h", x + 16, py1)
    for y in range(py0, py1, 32):
        put("fence_v", px0, min(py1, y + 32))
        put("fence_v", W - 4, min(py1, y + 32))
    put(own("trough", F.trough()), 296, 328)

    # ============================================================ САД И ПАСЕКА (вразбивку)
    own("tree_apples", V.apple_tree(True, seed=1))
    own("tree_bare", V.apple_tree(False, seed=1))
    own("hive", V.skep())

    # ============================================================ КУРЯТНИК И ВЫГУЛ
    put(own("coop", V.coop_big()), 72, 446)
    wire = own("wire_h", F.wire_h())
    for x in range(RUN[0], RUN[2], 32):
        put(wire, x + 16, RUN[1])
        put(wire, x + 16, RUN[3])
    wv = own("wire_v", F.wire_v())
    for y in range(RUN[1], RUN[3], 32):
        put(wv, RUN[2], min(RUN[3], y + 32))
        put(wv, RUN[0] + 2, min(RUN[3], y + 32))
    put(own("feeder", F.feeder()), 176, 456)

    # ============================================================ СЕННИК (сюда трактор привозит сено)
    put(own("shed", V.hay_shed()), 380, 464)
    own("hay", V.hay_bale())
    put(own("barrel", N.barrel()), 262, 456)
    put(own("milkcan", N.milk_can()), 280, 462)
    put("lavka_milkcan", 290, 464)
    put(own("bucket", N.bucket()), 482, 462)

    # живое и значки — картинки для сцены
    for head in (0, 1):
        for tail in (0, 1):
            own(f"cow{head}{tail}", V.cow(head, tail))
    for v in range(3):
        for peck in (False, True):
            own(f"hen{v}{int(peck)}", V.hen(v, peck))
    own("chick0", V.chick(False))
    own("chick1", V.chick(True))
    own("egg", V.egg())
    own("egg_brown", V.egg(True))
    own("bee", N.bee())
    own("duck0", F.duck(0))
    own("duck1", F.duck(1))
    own("tractor", F.tractor())
    own("cart", F.cart())
    own("badge", U.badge(False))
    own("badge_gold", U.badge(True))
    own("timer", U.timer_strip())
    for crop in ("carrot", "strawberry", "pumpkin", "dill"):
        own(f"ico_{crop}", U.crop_icon(crop))
    for name, fn in (("honey", F.icon_honey), ("hayicon", F.icon_hay), ("grain", F.icon_grain), ("seed", F.icon_seed), ("apple", F.icon_apple)):
        own(f"ico_{name}", fn())

    # ============================================================ ЛАВКА (полки с товаром ставит сцена)
    own("stand_veg", stand_with(["apple", "potato", "carrot", "cabbage", "apple", "pumpkin", "potato", "carrot"]))
    put(own("counter", N.counter_wood(64, 24)), 396, 664)
    put("baskets", 104, 676)
    put(own("jars", N.table_jars()), 110, 712)
    # стройка
    put(own("build_sign", V.build_sign()), 476, 640)
    put(own("planks", V.planks()), 478, 700)
    for y in range(BY0 + 16, BY1 - 10, 14):
        put("fence_v", 506, y + 14)
    put("fence_h", 478, BY0 + 16)
    put("fence_h", 478, BY1 - 10)

    # ============================================================ УЛИЦА
    put("awning", DOOR_X, BY1 + 10, z=BY1 + 1)
    put("mat", DOOR_X, BY1 + 16, z=BY1 + 2)
    put("hood_planter", DOOR_X - 50, 760)
    put("hood_planter", DOOR_X + 50, 760)
    for x in (24, 180, 336, 494):
        put("hood_lamp", x, 796)
    put("bench", 408, 782)
    put("bench", 104, 782)
    put("hood_bikes", 150, 790)
    put("bin", 440, 790)
    put("bobik_lie", 210, 772)
    put("cat_sit", 430, 768)
    put("bus_stop", 60, PLAZA_B - 2)
    put(own("tree_birch_r", src("tree_birch")), 30, 742)
    put("bush_flower", 494, 790)
    own("puff", N.puff())


def main():
    build()
    F.meadow(ground, seed=5)
    F.fringe(ground, seed=7)
    F.grass_detail(ground, (0, 0, W, HGT + TOP), seed=17)
    # тени под деревьями и стогом: на землю, мягко
    for k, x, y, rx in (("tree", 52, 268, 24), ("tree", 150, 336, 24), ("barn", 410, 172, 70), ("coop", 72, 446, 40), ("shed", 380, 462, 60), ("birch", 30, 742, 14)):
        F.soft_shadow(ground, x + 4, y + TOP - 2, rx, rx * 0.32)
    ground.save(OUT / "lavka_ground.png")
    for key, img in made.items():
        img.save(OUT / f"{key}.png")
    LAYOUT.parent.mkdir(parents=True, exist_ok=True)
    data = {"keys": sorted(["lavka_ground", *made]), "top": TOP // ART, "props": props}
    LAYOUT.write_text(json.dumps(data, ensure_ascii=False, indent=0) + "\n")
    print(f"lavka: {len(made)} картинок, {len(props)} предметов")


if __name__ == "__main__":
    main()
