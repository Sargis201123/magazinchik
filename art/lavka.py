"""«Лавка «Своё»» — мир второй игры (src/lavka, docs/farm/mockup): земля одним слоем, свои спрайты и раскладка.

    python3 art/lavka.py

Пишет в public/assets:
- lavka_ground.png — вся земля 640×1300 пикселей рисунка (320×650 точек мира): трава, пшеница, двор, грядки,
  полы и стены лавки, веранда, площадка, парковка, трасса, грунтовка, станция. По ней ходят, за неё не заходят.
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
W, HGT = 640, 1300
ART = 2

# Высоты полос (пиксели рисунка); те же числа знает сцена (src/lavka/LavkaScene.ts, в точках — вдвое меньше).
BY0, BY1 = 300, 616     # лавка
PLAZA_B = 712           # площадка перед лавкой
PARK_B = 792            # парковка
ROAD_B = 880            # трасса
STATION = 1222          # платформа
VY = ROAD_B + 14        # посёлок
# Мир продолжается вверх полем: над фермой — пшеница, на неё ложится верхняя панель игры, а не амбар.
# Земля на картинке начинается с y = -TOP (в точках мира — с -TOP / 2, сцена ставит её туда же).
TOP = 100

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
    # Поле пшеницы и полевая дорога над фермой.
    lay(N.wheat(W, 62, 1), 0, -TOP)
    dirt_blob([("r", -10, -40, W + 20, 16)], 9)
    # Тропинка от задней двери лавки к полю и площадка, где разгружается трактор.
    dirt_blob([("r", 309, -30, 24, 300), ("e", 262, 236, 128, 70), ("r", 240, 126, 70, 14), ("r", 333, 166, 60, 12)], 11)
    tile("paving", 0, BY1, W, PLAZA_B - BY1)
    lay(N.deck(W - 16, 34), 8, BY1)
    rect(8, BY1 + 34, W - 16, 2, H("#8f563b"))
    tile("concrete", 0, PLAZA_B, W, PARK_B - PLAZA_B)
    for x in range(300, 640, 56):
        rect(x, PLAZA_B + 4, 2, 34, (240, 240, 240, 255))
    rect(0, PARK_B, W, 4, H("#8b9bb4"))
    tile("asphalt", 0, PARK_B + 4, W, ROAD_B - PARK_B - 8)
    for x in range(8, W, 48):
        rect(x, (PARK_B + ROAD_B) // 2 - 1, 26, 3, (240, 240, 240, 255))
    for x in range(278, 362, 12):
        rect(x, PARK_B + 6, 7, ROAD_B - PARK_B - 12, (236, 236, 236, 255))
    rect(0, ROAD_B - 4, W, 4, H("#8b9bb4"))
    dirt_blob([("r", 284, ROAD_B, 72, STATION - ROAD_B + 6), ("e", 250, STATION - 30, 140, 50)], 21)
    lay(N.rails(W), 0, 1262)
    tile("concrete", 0, STATION, W, 40)
    rect(0, STATION, W, 2, H("#c0cbdc"))
    rect(0, STATION + 36, W, 4, H("#fee761"))
    rect(0, STATION + 40, W, 1, H("#181425"))

    # огород фермы: девять грядок-коробов, между ними дорожки
    crops = [["cabbage", "carrot", "tomato"], ["strawberry", "potato", "pumpkin"], ["dill", "cabbage", "strawberry"]]
    for r, row in enumerate(crops):
        for c, crop in enumerate(row):
            lay(F.bed(76, 36, crop, seed=r * 3 + c, wet=(r == 0 and c == 1)), 12 + c * 82, -6 + r * 44)
    lay(F.pond(), 366, 196)
    lay(F.flowers_strip(80, 10, 2), 360, 158)

    # лавка: стены, полы, перегородки
    ink, wall = H("#181425"), H("#4a3b52")
    rect(8, BY0, W - 16, BY1 - BY0, ink)
    rect(10, BY0 + 2, W - 20, BY1 - BY0 - 4, wall)
    rooms = ((18, 166), (178, 462), (474, 622))
    back = 34
    for (x0, x1), wall_t, floor_t in zip(rooms, ("wall_provence", "wall_walnut", "wall_brick"), ("ktiles", "floor_wood", "floor")):
        tile(wall_t, x0, BY0 + 8, x1 - x0, back)
        rect(x0, BY0 + 8 + back, x1 - x0, 2, ink)
        tile(floor_t, x0, BY0 + 10 + back, x1 - x0, BY1 - BY0 - 20 - back)
    for x in (166, 462):
        rect(x, BY0 + 8, 12, BY1 - BY0 - 18, wall)
        rect(x, BY0 + 8, 1, BY1 - BY0 - 18, ink)
        rect(x + 11, BY0 + 8, 1, BY1 - BY0 - 18, ink)
        rect(x, 470, 12, 40, H("#b86f50"))
    fw = BY1 - 10
    rect(8, fw, W - 16, 10, wall)
    rect(8, fw, W - 16, 1, ink)
    rect(8, fw + 9, W - 16, 1, ink)
    for wx in (40, 110, 196, 410, 500, 570):
        rect(wx, fw + 2, 34, 6, H("#8fd3ff"))
        rect(wx, fw + 2, 34, 1, H("#ffffff"))
    rect(298, fw, 46, 10, H("#b86f50"))
    rect(300, BY0, 42, 10, H("#b86f50"))

    # клумбы
    lay(N.flower_bed(44, 14, 3), 538, 690)
    lay(N.flower_bed(44, 14, 4), 8, 638)

    # посёлок: грядки и клумбы
    lay(N.bed(64, 28, "potato", seed=31), 108, VY + 26)
    lay(N.bed(64, 28, "cabbage", seed=32), 108, VY + 60)
    lay(N.bed(56, 28, "strawberry", seed=33), -12, VY + 140)
    lay(N.bed(56, 28, "carrot", seed=34), 56, VY + 140)
    lay(N.flower_bed(48, 14, 5), 2, VY + 94)
    lay(N.bed(60, 28, "tomato", seed=41), 384, VY + 26)
    lay(N.bed(60, 28, "dill", seed=42), 384, VY + 60)
    lay(N.bed(56, 28, "strawberry", seed=43), 384, VY + 140)
    lay(N.bed(56, 28, "strawberry", seed=44), 452, VY + 140)
    lay(N.flower_bed(48, 14, 6), 576, VY + 94)
    lay(N.flower_bed(60, 14, 7), 390, VY + 186)

    # ============================================================ ФЕРМА
    for x in range(0, W, 32):
        if not 296 <= x <= 330:
            put("fence_h", x + 16, -20)
    put(own("scarecrow", F.scarecrow()), 135, 92)
    put(own("barrel", N.barrel()), 266, 40)
    put(own("hay", F.hay_stack()), 616, 214)
    put(own("greenhouse", F.greenhouse()), 412, 104)
    for x, y in ((372, 160), (398, 166), (424, 160)):
        put(own("hive", N.beehive()), x, y)
    put(own("tree_apples", N.apples_on(src("tree"), 2)), 280, 18)
    put(own("tree_round_apples", N.apples_on(src("tree_round"), 3)), 290, 196)
    put(own("barn", F.barn()), 562, 136)
    # загон: забор с трёх сторон, поилка
    for x in range(480, W, 32):
        put("fence_h", x + 16, 150)
        put("fence_h", x + 16, 296)
    for y in range(150, 296, 14):
        put("fence_v", 478, y + 14)
    put(own("trough", F.trough()), 526, 286)
    # курятник и выгул под сеткой
    put(own("coop", F.coop()), 50, 244)
    wire = own("wire_h", F.wire_h())
    for x in range(92, 236, 32):
        put(wire, x + 16, 156)
        put(wire, x + 16, 276)
    wv = own("wire_v", F.wire_v())
    for y in range(156, 276, 32):
        put(wv, 236, y + 32)
    put(own("feeder", F.feeder()), 150, 232)
    put(own("eggs", N.egg_basket()), 104, 252)
    put(own("bucket", N.bucket()), 552, 262)
    for x, y in ((240, 132), (252, 136), (228, 138)):
        put(own("milkcan", N.milk_can()), x, y)
    # куры, утки, трактор с прицепом — живые (сцена), здесь только картинки
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

    # ============================================================ ЛАВКА
    # сыроварня
    rack = own("rack", N.cheese_rack())
    put(rack, 54, BY0 + 92)
    put(rack, 128, BY0 + 92)
    put(own("press", N.cheese_press()), 46, 450)
    put(own("churn", N.churn()), 144, 436)
    put(own("vat", N.vat()), 92, 512)
    for i, x in enumerate((30, 44, 58)):
        put("lavka_milkcan", x, 586 + (i % 2))
    put("icebox", 124, 596)
    # зал: полки у задней стены (молочная — в сцене, у неё товар меняется)
    put(own("shelf_jam", shelf_with(["item_jam", "item_jam_0", "item_pickles", "item_pickles_0", "item_jam_1", "item_pickles_1"])), 304, BY0 + 106)
    put(own("shelf_bake", shelf_with(["item_honeycake", "item_honeycake_0", "item_bread", "item_buns", "item_pies", "item_bread_0"])), 386, BY0 + 106)
    put("bread_rack", 446, BY0 + 100)
    put(own("stand_veg", stand_with(["apple", "potato", "carrot", "cabbage", "apple", "pumpkin", "potato", "carrot"])), 250, 500)
    put(own("counter", N.counter_wood(68, 26)), 412, 548)
    own("case", N.cheese_case_empty(64))
    own("wheel", N.cheese_wheel(small=True))
    put(own("crates", N.apple_crate("potato")), 448, 590)
    # пекарня
    put("oven", 494, BY0 + 82)
    put("oven", 528, BY0 + 82)
    put("oven2", 562, BY0 + 82)
    put("bread_rack", 604, BY0 + 88)
    put("bread_rack", 604, 470)
    put(own("dough", N.dough_table()), 520, 500)
    put(own("counter_s", N.counter_wood(64, 24)), 552, 560)
    for x in (530, 546, 562, 576):
        put("item_bread", x, 542, z=561)
    put(own("sacks", N.flour_sacks()), 600, 540)

    # ============================================================ ПЕРЕД ЛАВКОЙ
    put("awning", 321, BY1 + 12, z=BY1 + 1)
    put(own("sign", N.sign_board(150)), 321, BY1 - 2, z=BY1 + 2)
    put("mat", 321, BY1 + 18, z=BY1 + 2)
    put("hood_stall_E", 60, 684)
    put("hood_stall_R", 116, 684)
    put(own("jars", N.table_jars()), 476, 676)
    put("hood_planter", 260, 642)
    put("hood_planter", 382, 642)
    put(own("chalk", N.chalkboard()), 404, 680)
    put("hood_bikes", 236, 704)
    put(own("bench", N.bench_wood()), 580, 664)
    put("bobik_lie", 352, 648)
    put("cat_sit", 612, 652)
    # парковка
    put("bus_stop", 222, PARK_B - 22)
    put("car_sedan", 380, PARK_B - 10, tint=0xE43B44)
    put("car_hatch", 456, PARK_B - 10, tint=0x5B6EE1)
    put("car_van", 540, PARK_B - 10, tint=0xFFFFFF)

    # ============================================================ ПОСЁЛОК
    fence_run(0, 268, VY)
    fence_col(270, VY, 1180)
    fence_run(0, 268, 1186)
    put("zar_house_0", 64, VY + 92)
    put(own("tree_apples", N.apples_on(src("tree"), 2)), 236, VY + 112)
    put(own("well", N.well()), 176, VY + 146)
    put(own("banya", N.banya_house()), 50, VY + 290)
    put(own("line", N.clothesline(70)), 170, VY + 232)
    fence_run(372, 640, VY)
    fence_col(370, VY, 1180)
    fence_run(372, 640, 1186)
    put("zar_house_1", 574, VY + 92)
    put(own("greenhouse_s", F.greenhouse_small()), 486, VY + 94)
    put("lavka_tree_round_apples", 610, VY + 176)
    put("lavka_barrel", 530, VY + 132)
    put("lavka_bucket", 490, VY + 132)
    put(own("samovar", N.samovar_table()), 520, VY + 236)
    put("lavka_bench", 520, VY + 254)
    for x in (420, 450, 480):
        put("bush_flower", x, VY + 290)
    for x, y in ((290, VY + 6), (354, VY + 30), (20, 1214), (620, 1214), (276, 1200), (366, 1206)):
        put("tree_birch", x, y)
    for x, y in ((10, VY + 110), (300, VY + 180), (628, VY + 56)):
        put("bush_flower", x, y)
    put(own("shelter", N.shelter()), 150, STATION + 34)
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
