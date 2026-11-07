"""Макет экрана «Лавка Своё»: мир из спрайтов игры + новые фермерские спрайты (newart.py).
Координаты — пиксели рисунка (2 на точку мира, как DETAIL в игре).
Запуск (нужна сборка: npm run build, спрайты берутся из dist/assets/atlas0): python3 docs/farm/mockup/compose.py lavka.png"""
import os, sys, random, json
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(ROOT, 'art'))
from PIL import Image, ImageDraw, ImageFilter
import atlas
import newart as N
from premium import H, lit, mix

W, HGT = 640, 1300
world = Image.new('RGBA', (W, HGT), (0, 0, 0, 255))
sprites = []  # (sort_y, x, y, img)
labels = []   # подписи для HTML-слоя: (kind, x, y, text)


def F(name):
    return atlas.frame(name)


def tint(img, hexcol):
    r, g, b = (hexcol >> 16) & 255, (hexcol >> 8) & 255, hexcol & 255
    px = img.load(); out = img.copy(); po = out.load()
    for y in range(img.size[1]):
        for x in range(img.size[0]):
            pr, pg, pb, pa = px[x, y]
            if pa:
                po[x, y] = (pr * r // 255, pg * g // 255, pb * b // 255, pa)
    return out


def ground(img, x, y):
    world.alpha_composite(img, (int(x), int(y)))


def tile(name_or_img, x0, y0, w, h):
    t = F(name_or_img) if isinstance(name_or_img, str) else name_or_img
    tw, th = t.size
    region = Image.new('RGBA', (w, h))
    for yy in range(0, h, th):
        for xx in range(0, w, tw):
            region.alpha_composite(t.crop((0, 0, min(tw, w - xx), min(th, h - yy))), (xx, yy))
    world.alpha_composite(region, (x0, y0))


def put(img, x, y, z=None):
    """x — середина, y — низ картинки; сортировка по низу (или z)."""
    w, h = img.size
    sprites.append(((z if z is not None else y), int(x - w / 2), int(y - h), img))


def rect(x, y, w, h, col):
    world.paste(Image.new('RGBA', (w, h), col), (x, y))


def dirt_blob(shapes, seed, base=H('#c28569')):
    """Утоптанная земля неровной формы: эллипсы и прямоугольники, край с тёмной кромкой и травинками."""
    mask = Image.new('L', (W, HGT), 0)
    d = ImageDraw.Draw(mask)
    for s in shapes:
        if s[0] == 'e':
            _, x, y, w, h = s; d.ellipse((x, y, x + w, y + h), fill=255)
        else:
            _, x, y, w, h = s; d.rounded_rectangle((x, y, x + w, y + h), radius=10, fill=255)
    rnd = random.Random(seed)
    m = mask.load(); px = world.load()
    cols = [H('#c28569'), H('#c28569'), H('#b86f50'), H('#e4a672'), H('#8f563b')]
    for y in range(HGT):
        for x in range(W):
            if m[x, y]:
                edge = any(not m[nx, ny] for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)) if 0 <= nx < W and 0 <= ny < HGT)
                if edge:
                    if rnd.random() < 0.55:
                        px[x, y] = H('#8f563b')
                else:
                    px[x, y] = rnd.choice(cols) if rnd.random() < 0.18 else base
    # камешки
    for _ in range(80):
        x, y = rnd.randrange(W), rnd.randrange(HGT)
        if m[x, y] and m[min(W - 1, x + 1), y]:
            px[x, y] = H('#e4a672'); px[min(W - 1, x + 1), y] = H('#8f563b')


# ---------------------------------------------------------------- люди
SK = [0xf2d3ab, 0xd9a066, 0x8f563b, 0xeec39a]


def person(shirt, pants=0x3a4466, skin=0xf2d3ab, hair=0x4a2c1a, style='short', view='', mood=None,
           hat=None, hat_tint=None, outfit=None, outfit_tint=None, face=None, prop=None, prop_tint=None, apron=None, coat=None, scarf=None, legs='p_legs0'):
    """Человечек по слоям, как persons.ts (makePerson). view: '' спереди, '_b' спиной, '_s' боком."""
    canvas = Image.new('RGBA', (40, 48))
    ox, oy = 8, 8

    def lay(key, t=None, bigl=False):
        k = key + view if (key + view) in atlas._fr else key
        if k not in atlas._fr:
            return
        im = F(k)
        if t is not None:
            im = tint(im, t)
        dy = -4 if bigl else 0
        canvas.alpha_composite(im, (ox + 12 - im.size[0] // 2, oy + 18 + dy - im.size[1] // 2))
    sh = F('shadow')
    canvas.alpha_composite(sh, (ox + 12 - sh.size[0] // 2, oy + 18 + 17 - sh.size[1] // 2))
    lay(legs + ('_b' if view == '_b' else ''), pants)
    lay('p_shirt', shirt)
    if coat is not None:
        lay('p_coat', coat)
    if outfit:
        lay(f'w_outfit_{outfit}', outfit_tint)
    if apron is not None:
        lay('acc_apron', apron)
    lay(f'p_skin_{mood}' if (mood and view == '') else 'p_skin', skin)
    if scarf is not None:
        lay('p_scarf', scarf)
    if face:
        lay(f'w_face_{face}', hair if face in ('beard', 'mustache') else None)
    lay(f'p_hair_{style}', hair)
    if hat:
        lay(f'w_hat_{hat}', hat_tint, bigl=True)
    if prop:
        lay(f'w_prop_{prop}', prop_tint, bigl=True)
    return canvas


def man(x, y, flip=False, emo=None, say=None, **kw):
    """y — где стоят ноги."""
    im = person(**kw)
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    put(im, x, y + 5)
    if emo:
        e = F(f'emo_{emo}')
        put(e, x + 1, y - 34, z=y + 1)
    if say:
        labels.append(('say', x, y - 40, say))


def car(name, col, x, y):
    put(tint(F(name), col), x, y)


def shelf_with(x, y, items, base='shelf', front='shelf_front'):
    im = F(base).copy()
    for row, by in enumerate((30, 52)):
        for i in range(6):
            it = items[(row * 6 + i) % len(items)]
            fr = F(it)
            im.alpha_composite(fr, (8 + i * 11 + (11 - fr.size[0]) // 2, by - fr.size[1]))
    im.alpha_composite(F(front), (0, 0))
    put(im, x, y)


def stand_with(x, y, fills):
    im = F('stand').copy()
    for i, f in enumerate(fills):
        cr = N.apple_crate(f)
        im.alpha_composite(cr, (6 + (i % 4) * 17, 16 + (i // 4) * 22))
    im.alpha_composite(F('stand_front'), (0, 0))
    put(im, x, y)


# ================================================================ РАСКЛАДКА ПО ВЫСОТЕ
FARM_B = 300            # низ фермы = задняя стена лавки
BY0, BY1 = 300, 616     # лавка
PLAZA_B = 712           # площадка перед лавкой
PARK_B = 792            # парковка
ROAD_B = 880            # трасса
STATION = 1222          # платформа

# ================================================================ ЗЕМЛЯ
tile('grass', 0, 0, W, HGT)
# пшеница сверху (уходит за край экрана)
ground(N.wheat(250, 54, 1), 230, 0)
# двор фермы и дорожки
dirt_blob([('e', 176, 168, 300, 150), ('r', 300, 150, 60, 60), ('r', 236, 52, 18, 140), ('r', 444, 150, 46, 60)], 11)
# площадка перед лавкой: плитка
tile('paving', 0, BY1, W, PLAZA_B - BY1)
ground(N.deck(W - 16, 34), 8, BY1)
rect(8, BY1 + 34, W - 16, 2, H('#8f563b'))
tile('concrete', 0, PLAZA_B, W, PARK_B - PLAZA_B)
for x in range(300, 640, 56):
    rect(x, PLAZA_B + 4, 2, 34, (240, 240, 240, 255))
rect(0, PARK_B, W, 4, H('#8b9bb4'))
tile('asphalt', 0, PARK_B + 4, W, ROAD_B - PARK_B - 8)
for x in range(8, W, 48):
    rect(x, (PARK_B + ROAD_B) // 2 - 1, 26, 3, (240, 240, 240, 255))
for x in range(278, 362, 12):
    rect(x, PARK_B + 6, 7, ROAD_B - PARK_B - 12, (236, 236, 236, 255))
rect(0, ROAD_B - 4, W, 4, H('#8b9bb4'))
# грунтовка к станции
dirt_blob([('r', 284, ROAD_B, 72, STATION - ROAD_B + 6), ('e', 250, STATION - 30, 140, 50)], 21)
# станция
ground(N.rails(W), 0, 1262)
tile('concrete', 0, STATION, W, 40)
rect(0, STATION, W, 2, H('#c0cbdc')); rect(0, STATION + 36, W, 4, H('#fee761')); rect(0, STATION + 40, W, 1, H('#181425'))

# ================================================================ ФЕРМА
crops = [['cabbage', 'carrot', 'tomato'], ['strawberry', 'potato', 'pumpkin'], ['dill', 'cabbage', 'strawberry']]
for r, row in enumerate(crops):
    for cidx, crop in enumerate(row):
        ground(N.bed(66, 30, crop, seed=r * 3 + cidx, wet=(r == 0 and cidx == 1)), 14 + cidx * 74, 66 + r * 38)
for x in range(6, 236, 32):
    put(F('fence_h'), x + 16, 62)
    put(F('fence_h'), x + 16, 186)
put(N.scarecrow(), 118, 140)
for i, x in enumerate(range(160, 236, 10)):
    put(N.sunflower(), x, 60 + (i % 2) * 2, z=50)
put(N.barrel(), 238, 196)
# теплица и пасека
put(N.greenhouse(), 318, 150)
for i, (x, y) in enumerate(((398, 128), (422, 134), (446, 128))):
    put(N.beehive(), x, y)
for x, y in ((394, 98), (410, 92), (430, 104), (452, 96), (441, 112)):
    put(N.bee(), x, y, z=200)
put(N.apples_on(F('tree'), 2), 470, 98)
put(N.apples_on(F('tree_round'), 3), 382, 88)
# амбар и загон
put(N.barn(), 564, 154)
for x in range(484, 640, 32):
    put(F('fence_h'), x + 16, 238)
for y in range(156, 238, 14):
    put(F('fence_v'), 482, y + 14)
put(N.cow('left', 0), 548, 202)
put(N.cow('right', 1, True), 604, 228)
put(N.cow('left', 0, True), 520, 232)
put(N.hay(), 624, 188)
put(N.hay(), 508, 180)
man(574, 218, shirt=0xf6757a, skin=SK[0], hair=0xfeae34, style='ponytail', hat='headscarf', hat_tint=0xe43b44, apron=0xffffff, view='_s', flip=True)
put(N.bucket(), 590, 222)
# курятник
put(N.coop(), 56, 258)
rnd = random.Random(4)
for i in range(8):
    put(N.hen(i % 3, i % 2 == 1), 28 + rnd.randint(0, 140), 270 + rnd.randint(0, 22))
put(N.egg_basket(), 130, 262)
man(150, 252, shirt=0xfbf236, skin=SK[1], hair=0x181425, style='curly', prop='basket', mood='happy', emo='heart')
# трактор с прицепом у задней двери
put(N.cart(), 268, 290)
put(N.tractor(), 332, 292)
man(220, 160, shirt=0x5b6ee1, skin=SK[1], hair=0x733e39, style='short', outfit='overalls', hat='straw', prop='basket')
man(86, 110, flip=True, shirt=0xd95763, skin=SK[0], hair=0xfeae34, style='ponytail', view='_b', hat='bandana', hat_tint=0xe43b44)
man(420, 214, shirt=0xffffff, pants=0x262b44, skin=SK[3], hair=0xc0cbdc, style='bald', outfit='overalls', hat='flatcap', hat_tint=0x5a6988, face='beard', say='Митя: «Сено к обеду привезу»')
put(N.milk_can(), 456, 256); put(N.milk_can(), 468, 260); put(N.milk_can(), 444, 262)

# ================================================================ ЛАВКА
INK = H('#181425'); WALL = H('#4a3b52')
rect(8, BY0, W - 16, BY1 - BY0, INK)
rect(10, BY0 + 2, W - 20, BY1 - BY0 - 4, WALL)
ROOMS = ((18, 166), (178, 462), (474, 622))
BACK = 34
for (x0, x1), wall_t, floor_t in zip(ROOMS, ('wall_provence', 'wall_walnut', 'wall_brick'), ('ktiles', 'floor_wood', 'floor')):
    tile(wall_t, x0, BY0 + 8, x1 - x0, BACK)
    rect(x0, BY0 + 8 + BACK, x1 - x0, 2, INK)
    tile(floor_t, x0, BY0 + 10 + BACK, x1 - x0, BY1 - BY0 - 20 - BACK)
for x in (166, 462):
    rect(x, BY0 + 8, 12, BY1 - BY0 - 18, WALL); rect(x, BY0 + 8, 1, BY1 - BY0 - 18, INK); rect(x + 11, BY0 + 8, 1, BY1 - BY0 - 18, INK)
    rect(x, 470, 12, 40, H('#b86f50'))
# передняя стена с окнами и дверью
FW = BY1 - 10
rect(8, FW, W - 16, 10, WALL); rect(8, FW, W - 16, 1, INK); rect(8, FW + 9, W - 16, 1, INK)
for wx in (40, 110, 196, 410, 500, 570):
    rect(wx, FW + 2, 34, 6, H('#8fd3ff')); rect(wx, FW + 2, 34, 1, H('#ffffff'))
rect(298, FW, 46, 10, H('#b86f50'))
# задняя дверь для трактора
rect(300, BY0, 42, 10, H('#b86f50'))

# --- сыроварня
put(N.cheese_rack(), 54, BY0 + 92)
put(N.cheese_rack(), 128, BY0 + 92)
put(N.cheese_press(), 46, 450)
put(N.churn(), 144, 436)
put(N.cheese_case(70), 92, 520)
put(N.vat(), 70, 410 + 90)
man(40, 520, shirt=0xffffff, skin=SK[1], hair=0x181425, style='long', apron=0xffffff, view='_s')
for i, x in enumerate((30, 44, 58)):
    put(N.milk_can(), x, 586 + (i % 2))
put(F('icebox'), 124, 596)
man(104, 470, shirt=0xffffff, pants=0x262b44, skin=SK[0], hair=0x733e39, style='bun', apron=0xffffff, hat='headscarf', hat_tint=0xffffff, mood='happy', say='Сыр дозрел!')

# --- зал
SY = BY0 + 106
shelf_with(222, SY, ['item_milk', 'item_milk_0', 'item_milk_1', 'item_milk_2'])
shelf_with(304, SY, ['item_jam', 'item_jam_0', 'item_pickles', 'item_pickles_0', 'item_jam_1', 'item_pickles_1'])
shelf_with(386, SY, ['item_honeycake', 'item_honeycake_0', 'item_bread', 'item_buns', 'item_pies', 'item_bread_0'])
put(F('bread_rack'), 446, SY - 6)
stand_with(236, 486, ['apple', 'potato', 'carrot', 'cabbage', 'apple', 'pumpkin', 'potato', 'carrot'])
stand_with(330, 486, ['pumpkin', 'apple', 'cabbage', 'carrot', 'apple', 'potato', 'pumpkin', 'apple'])
put(N.cheese_case(64), 232, 566)
# прилавок: папа, весы, очередь
man(412, 520, shirt=0x37946e, pants=0x3a4466, skin=SK[0], hair=0x4a2c1a, style='short', apron=0xe4a672, mood='happy')
put(N.counter_wood(68, 26), 412, 548)
labels.append(('coin', 434, 500, '+46'))
man(412, 576, shirt=0xd95763, skin=SK[3], hair=0x8b9bb4, style='curly', view='_b', prop='stringbag')
man(388, 592, shirt=0x5b6ee1, skin=SK[1], hair=0x181425, style='short', view='_b', hat='bucket', hat_tint=0xfee761)
man(362, 600, shirt=0xfbf236, skin=SK[0], hair=0xfeae34, style='long', view='_b', prop='basket', emo='clock')
# покупатели
man(200, 450, shirt=0x76428a, skin=SK[0], hair=0xc0cbdc, style='bun', view='_b', prop='stringbag', scarf=0xe43b44)
man(286, 532, flip=True, shirt=0xdf7126, skin=SK[2], hair=0x181425, style='short', hat='sunhat', hat_tint=0xffffff, say='Творог есть?')
man(200, 590, shirt=0x2ce8f5, skin=SK[3], hair=0x733e39, style='ponytail', prop='basket', emo='heart')
man(300, 470, shirt=0x6abe30, skin=SK[0], hair=0xfeae34, style='short', view='_b')

# --- пекарня
put(F('oven'), 494, BY0 + 82); put(F('oven'), 528, BY0 + 82); put(F('oven2'), 562, BY0 + 82)
put(F('bread_rack'), 604, BY0 + 88)
man(548, 450, shirt=0xffffff, skin=SK[3], hair=0x181425, style='short', outfit='chefcoat', hat='toque', face='mustache', mood='happy', say='Хлеб из своей муки!')
for x, y in ((604, 470),):
    put(F('bread_rack'), x, y)
put(N.counter_wood(64, 24), 552, 560)
put(N.flour_sacks(), 600, 540)
put(N.dough_table(), 520, 500)
man(520, 470, shirt=0xffffff, skin=SK[0], hair=0xfeae34, style='ponytail', apron=0xffffff, view='_b')
for x in (530, 546, 562, 576):
    put(F('item_bread'), x, 542, z=561)
man(552, 596, shirt=0xf6757a, skin=SK[0], hair=0x733e39, style='long', view='_b', prop='stringbag')

# ================================================================ ПЕРЕД ЛАВКОЙ
put(F('awning'), 321, BY1 + 12, z=BY1 + 1)
put(N.sign_board(150), 321, BY1 - 2, z=BY1 + 2)
labels.append(('sign', 321, BY1 - 13, 'ЛАВКА «СВОЁ»'))
put(F('mat'), 321, BY1 + 18, z=BY1 + 2)
put(F('hood_stall_E'), 60, 684)
put(F('hood_stall_R'), 116, 684)
put(N.table_jars(), 476, 676)
put(F('hood_planter'), 260, 642); put(F('hood_planter'), 382, 642)
put(N.chalkboard(), 404, 680)
labels.append(('chalk', 404, 664, 'творог · сыр'))
put(F('hood_bikes'), 236, 704)
put(N.flower_bed(44, 14, 3), 560, 704)
put(N.flower_bed(44, 14, 4), 30, 652)
put(N.bench_wood(), 580, 664)
put(F('bobik_lie'), 352, 648)
put(F('cat_sit'), 612, 652)
man(580, 664, shirt=0xa22633, skin=SK[0], hair=0xc0cbdc, style='curly', mood='happy', say='Валя: «Огурчики почём?»')
man(470, 700, shirt=0x5b6ee1, skin=SK[1], hair=0x4a2c1a, style='short', view='_b', prop='bottle')
man(320, 676, shirt=0xf6757a, skin=SK[0], hair=0xfeae34, style='ponytail', view='_b', prop='bouquet')
man(180, 706, shirt=0x6abe30, skin=SK[2], hair=0x181425, style='curly', prop='stringbag', emo='star')
man(30, 702, flip=True, shirt=0xfbf236, skin=SK[0], hair=0x733e39, style='long', hat='sunhat', hat_tint=0xfee761)

# парковка: автобус и машины дачников
put(tint(F('bus'), 0xfee761), 92, PARK_B - 6)
put(F('bus_stop'), 222, PARK_B - 22)
car('car_sedan', 0xe43b44, 380, PARK_B - 10)
car('car_hatch', 0x5b6ee1, 456, PARK_B - 10)
car('car_van', 0xffffff, 540, PARK_B - 10)
man(166, 766, shirt=0xd95763, skin=SK[3], hair=0x8b9bb4, style='bald', prop='cane', view='_b')
man(192, 756, shirt=0x37946e, skin=SK[0], hair=0x4a2c1a, style='short', view='_b')
man(262, 736, shirt=0x76428a, skin=SK[1], hair=0x181425, style='long', view='_b', prop='basket')

# трасса
car('car_taxi', 0xffffff, 110, (PARK_B + ROAD_B) // 2 - 4)
car('car_truck', 0x3e8948, 530, ROAD_B - 4)

# ================================================================ ДАЧНЫЙ ПОСЁЛОК «СОСНОВКА»
VY = ROAD_B + 14


def fence_run(x0, x1, y):
    for x in range(x0, x1, 32):
        put(F('fence_h'), x + 16, y)


def fence_col(x, y0, y1):
    for y in range(y0, y1, 14):
        put(F('fence_v'), x, y + 14)


# участок деда Мити
fence_run(0, 268, VY); fence_col(270, VY, 1180); fence_run(0, 268, 1186)
put(F('zar_house_0'), 64, VY + 92)
ground(N.bed(64, 28, 'potato', seed=31), 140, VY + 26)
ground(N.bed(64, 28, 'cabbage', seed=32), 140, VY + 60)
ground(N.bed(56, 28, 'strawberry', seed=33), 16, VY + 140)
ground(N.bed(56, 28, 'carrot', seed=34), 84, VY + 140)
put(N.apples_on(F('tree'), 7), 236, VY + 112)
put(N.well(), 176, VY + 146)
put(N.banya(), 50, VY + 290)
put(N.clothesline(70), 170, VY + 232)
put(N.flower_bed(48, 14, 5), 26, VY + 108)
put(F('bobik_sit0'), 120, VY + 128)
man(246, VY + 170, flip=True, shirt=0xffffff, pants=0x262b44, skin=SK[0], hair=0xc0cbdc, style='bald', face='beard', hat='straw', outfit='overalls', prop='cane', mood='happy')
for i in range(4):
    put(N.hen(i % 3, i == 2), 150 + i * 16, VY + 186 - (i % 2) * 6)
# участок бабушки
fence_run(372, 640, VY); fence_col(370, VY, 1180); fence_run(372, 640, 1186)
put(F('zar_house_1'), 574, VY + 92)
ground(N.bed(60, 28, 'tomato', seed=41), 384, VY + 26)
ground(N.bed(60, 28, 'dill', seed=42), 384, VY + 60)
ground(N.bed(56, 28, 'strawberry', seed=43), 384, VY + 140)
ground(N.bed(56, 28, 'strawberry', seed=44), 452, VY + 140)
put(N.greenhouse().resize((80, 52), Image.NEAREST), 486, VY + 84)
put(N.apples_on(F('tree_round'), 9), 610, VY + 176)
put(N.barrel(), 530, VY + 132)
put(N.samovar_table(), 520, VY + 236)
put(N.bench_wood(), 520, VY + 254)
man(500, VY + 226, shirt=0x5b6ee1, skin=SK[0], hair=0x4a2c1a, style='long', mood='happy', view='_s')
man(548, VY + 222, flip=True, shirt=0xfbf236, skin=SK[3], hair=0xfeae34, style='curly', mood='happy', view='_s', emo='heart')
put(N.flower_bed(48, 14, 6), 600, VY + 108)
put(N.flower_bed(60, 14, 7), 420, VY + 200)
for i, x in enumerate((420, 450, 480)): put(F('bush_flower'), x, VY + 290)
man(470, VY + 128, shirt=0xb55088, skin=SK[0], hair=0xffffff, style='bun', outfit='cardigan', outfit_tint=0xc4a8e8, hat='headscarf', hat_tint=0xfee761, mood='happy', say='Бабушка: «Клубнику — на варенье!»')
put(N.bucket(), 490, VY + 132)
# Соня несёт клубнику в лавку
man(320, VY + 90, shirt=0x76428a, skin=SK[0], hair=0x733e39, style='ponytail', outfit='hoodie', outfit_tint=0x9b6bc8, prop='basket', view='_b', emo='heart')
# берёзы и кусты
for x, y in ((290, VY + 6), (354, VY + 30), (20, 1214), (620, 1214), (276, 1200), (366, 1206)):
    put(F('tree_birch'), x, y)
for x, y in ((10, VY + 110), (300, VY + 180), (628, VY + 56)):
    put(F('bush_flower'), x, y)
# станция: павильон, электричка, дачники
put(N.shelter(), 150, STATION + 34)
put(N.train(), 470, 1300)
man(300, STATION - 4, shirt=0xdf7126, skin=SK[1], hair=0x181425, style='short', view='_b', prop='basket')
man(334, STATION + 10, shirt=0x5b6ee1, skin=SK[3], hair=0x8b9bb4, style='curly', view='_b', prop='stringbag')
man(230, STATION + 26, shirt=0x6abe30, skin=SK[0], hair=0xfeae34, style='long', hat='sunhat', hat_tint=0xffffff)
man(410, STATION + 24, shirt=0xd95763, skin=SK[2], hair=0x181425, style='short', view='_b', prop='bottle')

# ================================================================ СБОРКА
for _, x, y, img in sorted(sprites, key=lambda s: s[0]):
    world.alpha_composite(img, (x, y))

out = sys.argv[1]
world.save(out)
json.dump(labels, open(out.replace('.png', '.labels.json'), 'w'), ensure_ascii=False)
print('ok', world.size, len(sprites), 'sprites', len(labels), 'labels')
