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
import lavka_sprites as N
from premium import H
from sprites import OUT

ROOT = Path(__file__).resolve().parent.parent
LAYOUT = ROOT / "src" / "lavka" / "layout.json"
# Мир узкий (256 точек): на телефоне всё крупнее. Сверху — большая ферма (главное), под ней — лавка из трёх
# нешироких комнат (зал маленький, справа — место под расширение), внизу — площадка и дорога.
W, HGT = 512, 940
ART = 2

# Полосы (пиксели рисунка); те же числа знает сцена (src/lavka/LavkaScene.ts, в точках — вдвое меньше).
FARM_B = 524            # низ фермы — задняя стена лавки
BX0, BX1 = 72, 440      # лавка по ширине
BY0, BY1 = 524, 760     # лавка по высоте
PLAZA_B = 824           # площадка перед лавкой
ROAD_B = 900            # дорога
# Мир продолжается вверх полем: на пшеницу ложится верхняя панель игры, а не амбар.
# Земля на картинке начинается с y = -TOP (в точках мира — с -TOP / 2, сцена ставит её туда же).
TOP = 80

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
    lay(N.wheat(W, TOP - 6, 1), 0, -TOP)
    # Тропинка от задней двери лавки через всю ферму к полю, площадка у задней двери, отводки к сараям.
    dirt_blob([("r", 250, -16, 22, FARM_B + 10), ("e", 198, 456, 124, 76), ("r", 120, 330, 132, 14), ("r", 270, 360, 50, 14)], 11)
    # огород 3×3: пустые короба, растения сцена кладёт по стадиям
    crops = [["cabbage", "carrot", "tomato"], ["strawberry", "potato", "pumpkin"], ["dill", "cabbage", "strawberry"]]
    for r, row in enumerate(crops):
        for c, crop in enumerate(row):
            lay(F.bed(76, 36, seed=r * 3 + c), 8 + c * 82, 12 + r * 48)
            for stage in (1, 2, 3):
                own(f"crop_{crop}{stage}", F.crops(76, 36, crop, stage, seed=r * 3 + c))
    lay(F.pond(), 334, 388)
    lay(F.flowers_strip(80, 10, 2), 160, 250)
    # лавка: стены, полы, перегородки — три нешироких комнаты
    ink, wall = H("#181425"), H("#4a3b52")
    rect(BX0, BY0, BX1 - BX0, BY1 - BY0, ink)
    rect(BX0 + 2, BY0 + 2, BX1 - BX0 - 4, BY1 - BY0 - 4, wall)
    rooms = ((BX0 + 8, 176), (188, 340), (352, BX1 - 8))
    back = 30
    for (x0, x1), wall_t, floor_t in zip(rooms, ("wall_provence", "wall_walnut", "wall_brick"), ("ktiles", "floor_wood", "floor")):
        tile(wall_t, x0, BY0 + 8, x1 - x0, back)
        rect(x0, BY0 + 8 + back, x1 - x0, 2, ink)
        tile(floor_t, x0, BY0 + 10 + back, x1 - x0, BY1 - BY0 - 20 - back)
    for x in (176, 340):
        rect(x, BY0 + 8, 12, BY1 - BY0 - 18, wall)
        rect(x, BY0 + 8, 1, BY1 - BY0 - 18, ink)
        rect(x + 11, BY0 + 8, 1, BY1 - BY0 - 18, ink)
        rect(x, 650, 12, 36, H("#b86f50"))
    fw = BY1 - 10
    rect(BX0, fw, BX1 - BX0, 10, wall)
    rect(BX0, fw, BX1 - BX0, 1, ink)
    rect(BX0, fw + 9, BX1 - BX0, 1, ink)
    for wx in (96, 136, 372, 404):
        rect(wx, fw + 2, 26, 6, H("#8fd3ff"))
        rect(wx, fw + 2, 26, 1, H("#ffffff"))
    rect(242, fw, 40, 10, H("#b86f50"))      # входная дверь
    rect(240, BY0, 40, 10, H("#b86f50"))     # задняя дверь
    # место под расширение справа: утоптанная площадка
    dirt_blob([("r", 446, BY0 + 14, 60, BY1 - BY0 - 24)], 31)
    # перед лавкой: веранда, плитка, дорога, тротуар
    tile("paving", 0, BY1, W, PLAZA_B - BY1)
    lay(N.deck(BX1 - BX0, 26), BX0, BY1)
    rect(BX0, BY1 + 26, BX1 - BX0, 2, H("#8f563b"))
    lay(N.flower_bed(40, 14, 3), 20, 772)
    lay(N.flower_bed(40, 14, 4), 452, 772)
    rect(0, PLAZA_B, W, 4, H("#8b9bb4"))
    tile("asphalt", 0, PLAZA_B + 4, W, ROAD_B - PLAZA_B - 8)
    for x in range(8, W, 48):
        rect(x, (PLAZA_B + ROAD_B) // 2 - 1, 26, 3, (240, 240, 240, 255))
    rect(0, ROAD_B - 4, W, 4, H("#8b9bb4"))
    tile("paving", 0, ROAD_B, W, HGT - ROAD_B)

    # ============================================================ ФЕРМА
    for x in range(0, W, 32):
        if not 236 <= x <= 270:
            put("fence_h", x + 16, -6)
    put(own("scarecrow", F.scarecrow()), 128, 104)
    put(own("barrel", N.barrel()), 236, 60)
    put(own("barn", F.barn()), 394, 150)
    put(own("hay", F.hay_stack()), 488, 230)
    # загон под амбаром
    for x in range(300, W, 32):
        put("fence_h", x + 16, 168)
        put("fence_h", x + 16, 340)
    for y in range(168, 340, 14):
        put("fence_v", 298, y + 14)
    put(own("trough", F.trough()), 400, 332)
    put(own("bucket", N.bucket()), 436, 322)
    put(own("greenhouse", F.greenhouse()), 80, 262)
    for x, y in ((172, 238), (198, 244), (224, 238)):
        put(own("hive", N.beehive()), x, y)
    put(own("tree_apples", N.apples_on(src("tree"), 2)), 470, 410)
    put(own("tree_round_apples", N.apples_on(src("tree_round"), 3)), 300, 470)
    # курятник и выгул под сеткой
    put(own("coop", F.coop()), 46, 400)
    wire = own("wire_h", F.wire_h())
    for x in range(92, 236, 32):
        put(wire, x + 16, 292)
        put(wire, x + 16, 412)
    wv = own("wire_v", F.wire_v())
    for y in range(292, 412, 32):
        put(wv, 236, y + 32)
    put(own("feeder", F.feeder()), 160, 370)
    put(own("eggs", N.egg_basket()), 104, 398)
    for x, y in ((214, 504), (226, 508), (202, 510)):
        put(own("milkcan", N.milk_can()), x, y)
    # живое и значки — картинки для сцены
    for v in (0, 1):
        for down in (False, True):
            own(f"cow{v}{int(down)}", N.cow("right", v, down))
    for v in range(3):
        for peck in (False, True):
            own(f"hen{v}{int(peck)}", N.hen(v, peck))
    own("bee", N.bee())
    own("duck0", F.duck(0))
    own("duck1", F.duck(1))
    own("tractor", F.tractor())
    own("cart", F.cart())
    own("bed_wet", F.bed_wet(76, 36))
    own("egg", F.egg())
    for name, fn in (("honey", F.icon_honey), ("drop", F.icon_drop), ("hayicon", F.icon_hay), ("grain", F.icon_grain), ("seed", F.icon_seed), ("tomato", F.icon_tomato), ("apple", F.icon_apple)):
        own(f"ico_{name}", fn())

    # ============================================================ ЛАВКА
    # сыроварня (слева): стеллаж с головками, пресс, чан, бидоны
    put(own("rack", N.cheese_rack()), 108, BY0 + 92)
    put(own("press", N.cheese_press()), 150, 640)
    put(own("vat", N.vat()), 108, 700)
    for i, x in enumerate((92, 106, 120)):
        put("lavka_milkcan", x, 744 + (i % 2))
    # зал (маленький): молочная полка (в сцене), полка с мёдом и яйцами, ящики с овощами, прилавок
    put(own("shelf_jam", shelf_with(["item_jam", "item_jam_0", "item_honeycake", "item_jam_1", "item_honeycake_0", "item_jam_2"])), 304, BY0 + 104)
    put(own("stand_veg", stand_with(["apple", "potato", "carrot", "cabbage", "apple", "pumpkin", "potato", "carrot"])), 224, 724)
    put(own("counter", N.counter_wood(64, 24)), 304, 696)
    own("case", N.cheese_case_empty(64))
    own("wheel", N.cheese_wheel(small=True))
    # пекарня (справа): печи, стеллаж с хлебом, стол
    put("oven", 372, BY0 + 80)
    put("oven", 406, BY0 + 80)
    put("bread_rack", 410, 700)
    put(own("dough", N.dough_table()), 384, 656)
    put(own("sacks", N.flour_sacks()), 372, 748)
    # место под расширение
    for y in range(BY0 + 14, BY1 - 10, 14):
        put("fence_v", 506, y + 14)
    put("fence_h", 476, BY0 + 14)
    put("fence_h", 476, BY1 - 8)

    # ============================================================ ПЕРЕД ЛАВКОЙ
    put("awning", 262, BY1 + 12, z=BY1 + 1)
    put(own("sign", N.sign_board(130)), 262, BY1 - 2, z=BY1 + 2)
    put("mat", 262, BY1 + 18, z=BY1 + 2)
    put("hood_planter", 214, 782)
    put("hood_planter", 310, 782)
    put(own("jars", N.table_jars()), 120, 806)
    put(own("chalk", N.chalkboard()), 344, 808)
    put(own("bench", N.bench_wood()), 410, 800)
    put("bobik_lie", 292, 790)
    put("cat_sit", 440, 792)
    put("bus_stop", 60, PLAZA_B - 2)
    put(own("tree_birch_r", src("tree_birch")), 30, 760)
    put("bush_flower", 494, 812)
    own("train", N.train())
    own("puff", N.puff())


def main():
    build()
    F.grass_detail(ground, (0, 0, W, HGT + TOP), seed=17)
    ground.save(OUT / "lavka_ground.png")
    for key, img in made.items():
        img.save(OUT / f"{key}.png")
    LAYOUT.parent.mkdir(parents=True, exist_ok=True)
    data = {"keys": sorted(["lavka_ground", *made]), "top": TOP // ART, "props": props}
    LAYOUT.write_text(json.dumps(data, ensure_ascii=False, indent=0) + "\n")
    print(f"lavka: {len(made)} картинок, {len(props)} предметов")


if __name__ == "__main__":
    main()
