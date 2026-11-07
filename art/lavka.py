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
# Мир узкий (256 точек): на телефоне всё крупнее. Третья раскладка (07.11, по просьбе автора): сверху — огород
# из шести больших грядок; под ним слева сад с пасекой и курятник с гнёздами, справа маленький амбар и загон
# с одной коровой; поперёк — дорожка с трактором; ниже лавка (уголок-сыроварня, широкий зал, место под
# расширение), площадка и дорога.
W, HGT = 512, 900
ART = 2

# Полосы и места (пиксели рисунка); те же числа знает сцена (src/lavka/LavkaScene.ts, в точках — вдвое меньше).
GARDEN_B = 200          # низ огорода (забор с калиткой)
LANE0, LANE1 = 474, 514  # дорожка поперёк фермы
BX0, BX1 = 72, 440      # лавка по ширине
BY0, BY1 = 520, 740     # лавка по высоте
NOOK1 = 176             # сыроварня: BX0…NOOK1, перегородка NOOK1…HALL0, зал HALL0…BX1
HALL0 = 188
PLAZA_B = 800           # площадка перед лавкой
ROAD_B = 876            # дорога
DOOR_X = 310            # вход в зал
BACK_X = 256            # задняя дверь — на средней тропинке фермы
BED_X = (18, 182, 346)
BED_Y = (16, 104)
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
    # огород: утоптанные дорожки между грядками
    dirt_blob([("r", 10, 6, W - 20, GARDEN_B - 10)], 3, base=H("#c28569"))
    for r, y in enumerate(BED_Y):
        for c, x in enumerate(BED_X):
            lay(V.raised_bed(seed=r * 3 + c), x, y)
    # средняя тропинка от калитки огорода к задней двери лавки и дорожка поперёк
    dirt_blob([("r", BACK_X - 18, GARDEN_B - 8, 36, LANE0 - GARDEN_B + 16), ("r", 0, LANE0, W, LANE1 - LANE0)], 11)
    for y in (LANE0 + 12, LANE1 - 12):  # колеи
        for x in range(0, W, 3):
            if (x // 3) % 5:
                ground.putpixel((x, y + TOP), H("#8f563b"))
    # курятник: соломенный выгул; загон: вытоптано у кормушки
    F.straw_floor(ground, 100, 336 + TOP, 232, 464 + TOP, seed=3)
    dirt_blob([("e", 296, 338, 70, 30)], 41, base=H("#8a5a44"))
    lay(F.flowers_strip(96, 10, 2), 140, 312)
    lay(F.flowers_strip(70, 10, 5), 8, 312)
    # лавка: стены, полы, перегородка
    ink, wall = H("#181425"), H("#4a3b52")
    rect(BX0, BY0, BX1 - BX0, BY1 - BY0, ink)
    rect(BX0 + 2, BY0 + 2, BX1 - BX0 - 4, BY1 - BY0 - 4, wall)
    back = 30
    for (x0, x1), wall_t, floor_t in zip(((BX0 + 8, NOOK1), (HALL0, BX1 - 8)), ("wall_provence", "wall_walnut"), ("ktiles", "floor_wood")):
        tile(wall_t, x0, BY0 + 8, x1 - x0, back)
        rect(x0, BY0 + 8 + back, x1 - x0, 2, ink)
        tile(floor_t, x0, BY0 + 10 + back, x1 - x0, BY1 - BY0 - 20 - back)
    rect(NOOK1, BY0 + 8, HALL0 - NOOK1, BY1 - BY0 - 18, wall)
    rect(NOOK1, BY0 + 8, 1, BY1 - BY0 - 18, ink)
    rect(HALL0 - 1, BY0 + 8, 1, BY1 - BY0 - 18, ink)
    rect(NOOK1, 640, HALL0 - NOOK1, 40, H("#b86f50"))   # проём сыроварня — зал
    fw = BY1 - 10
    rect(BX0, fw, BX1 - BX0, 10, wall)
    rect(BX0, fw, BX1 - BX0, 1, ink)
    rect(BX0, fw + 9, BX1 - BX0, 1, ink)
    for wx in (96, 136, 214, 384):
        rect(wx, fw + 2, 26, 6, H("#8fd3ff"))
        rect(wx, fw + 2, 26, 1, H("#ffffff"))
    rect(DOOR_X - 20, fw, 40, 10, H("#b86f50"))       # вход
    rect(BACK_X - 18, BY0, 36, 10, H("#b86f50"))      # задняя дверь
    # место под расширение справа: утоптанная площадка
    dirt_blob([("r", 446, BY0 + 14, 60, BY1 - BY0 - 24)], 31)
    # перед лавкой: веранда, плитка, дорога, тротуар
    tile("paving", 0, BY1, W, PLAZA_B - BY1)
    lay(N.deck(BX1 - BX0, 26), BX0, BY1)
    rect(BX0, BY1 + 26, BX1 - BX0, 2, H("#8f563b"))
    lay(N.flower_bed(40, 14, 3), 20, 752)
    lay(N.flower_bed(40, 14, 4), 452, 752)
    rect(0, PLAZA_B, W, 4, H("#8b9bb4"))
    tile("asphalt", 0, PLAZA_B + 4, W, ROAD_B - PLAZA_B - 8)
    for x in range(8, W, 48):
        rect(x, (PLAZA_B + ROAD_B) // 2 - 1, 26, 3, (240, 240, 240, 255))
    rect(0, ROAD_B - 4, W, 4, H("#8b9bb4"))
    tile("paving", 0, ROAD_B, W, HGT - ROAD_B)

    # ============================================================ ОГОРОД
    for x in range(0, W, 32):
        put("fence_h", x + 16, 4)
        if not BACK_X - 24 <= x + 16 <= BACK_X + 24:
            put("fence_h", x + 16, GARDEN_B + 2)
    for y in range(4, GARDEN_B, 32):
        put("fence_v", 4, y + 32)
        put("fence_v", W - 4, y + 32)
    for seed in ("dill", "carrot", "strawberry", "pumpkin"):
        for stage in (1, 2, 3):
            for i in range(6):
                pass
            own(f"crop_{seed}{stage}", V.crops(seed, stage, bed_seed=stage))

    # ============================================================ САД И ПАСЕКА (слева)
    own("tree_apples", V.apple_tree(True, seed=1))
    own("tree_bare", V.apple_tree(False, seed=1))
    for i, x in enumerate((176, 214)):
        put(own(f"hive{i}", V.hive(i)), x, 312)

    # ============================================================ КУРЯТНИК (слева внизу)
    put(own("coop", F.coop()), 50, 450)
    put(own("nest", V.nest_box()), 168, 384)
    wire = own("wire_h", F.wire_h())
    for x in range(100, 232, 32):
        put(wire, x + 16, 336)
        put(wire, x + 16, 466)
    wv = own("wire_v", F.wire_v())
    for y in range(336, 466, 32):
        put(wv, 234, y + 32)
    put(own("feeder", F.feeder()), 212, 452)

    # ============================================================ АМБАР И ЗАГОН (справа)
    put(own("barn", V.barn()), 448, 318)
    put(own("hay", V.hay_bale()), 300, 330)
    put("lavka_hay", 330, 330)
    for x in range(280, W, 32):
        put("fence_h", x + 16, 334)
        put("fence_h", x + 16, 466)
    for y in range(334, 466, 32):
        put("fence_v", 280, y + 32)
    put(own("trough", F.trough()), 332, 360)
    put(own("bucket", N.bucket()), 498, 330)
    for x, y in ((488, 508), (500, 510)):
        put(own("milkcan", N.milk_can()), x, y)
    for x, y in ((BACK_X + 30, 512), (BACK_X + 40, 514)):
        put("lavka_milkcan", x, y)

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
    own("tractor", F.tractor())
    own("cart", F.cart())
    own("badge", U.badge(False))
    own("badge_gold", U.badge(True))
    own("timer", U.timer_strip())
    for crop in ("carrot", "strawberry", "pumpkin", "dill"):
        own(f"ico_{crop}", U.crop_icon(crop))
    for name, fn in (("honey", F.icon_honey), ("hayicon", F.icon_hay), ("grain", F.icon_grain), ("seed", F.icon_seed), ("apple", F.icon_apple)):
        own(f"ico_{name}", fn())

    # ============================================================ ЛАВКА
    # сыроварня (слева, уголок): стеллаж с головками, пресс, чан; витрина с готовым сыром — у проёма
    put(own("rack", N.cheese_rack()), 104, BY0 + 80)
    put(own("press", N.cheese_press()), 152, BY0 + 82)
    put(own("vat", N.vat()), 116, 660)
    own("case", N.cheese_case_empty(64))
    own("wheel", N.cheese_wheel(small=True))
    # зал: прилавок справа, ящики с овощами слева (полки с молоком, яйцами и мёдом ставит сцена — на них товар)
    put(own("stand_veg", stand_with(["apple", "potato", "carrot", "cabbage", "apple", "pumpkin", "potato", "carrot"])), 232, 690)
    put(own("counter", N.counter_wood(64, 24)), 400, 666)
    # место под расширение
    for y in range(BY0 + 14, BY1 - 10, 14):
        put("fence_v", 506, y + 14)
    put("fence_h", 476, BY0 + 14)
    put("fence_h", 476, BY1 - 8)

    # ============================================================ ПЕРЕД ЛАВКОЙ
    put("awning", DOOR_X, BY1 + 12, z=BY1 + 1)
    put(own("sign", N.sign_board(130)), DOOR_X, BY1 - 2, z=BY1 + 2)
    put("mat", DOOR_X, BY1 + 18, z=BY1 + 2)
    put("hood_planter", DOOR_X - 52, 762)
    put("hood_planter", DOOR_X + 52, 762)
    put(own("jars", N.table_jars()), 120, 786)
    put(own("bench", N.bench_wood()), 410, 780)
    put("bobik_lie", 200, 770)
    put("cat_sit", 440, 772)
    put("bus_stop", 60, PLAZA_B - 2)
    put(own("tree_birch_r", src("tree_birch")), 30, 744)
    put("bush_flower", 494, 792)
    own("puff", N.puff())


def main():
    build()
    F.meadow(ground, seed=5)
    F.fringe(ground, seed=7)
    F.grass_detail(ground, (0, 0, W, HGT + TOP), seed=17)
    # тени под деревьями и стогом: на землю, мягко
    for k, x, y, rx in (("tree", 50, 304, 24), ("tree", 118, 306, 24), ("barn", 448, 316, 52), ("birch", 30, 744, 14)):
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
