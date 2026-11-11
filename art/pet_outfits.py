"""Одежда питомцев (src/game/cat.ts, src/game/watch.ts): слои-наряды поверх кадров кота и Бобика.

11.11 (решение автора 2а): котику — колокольчик, бантик, шарфик; Бобику — бандана, бабочка, свитер. Наряд — отдельная
прозрачная картинка того же размера, что кадр питомца (ovl_<кадр>_<наряд>): сцена кладёт её поверх питомца и двигает
вместе с ним (scenes/pets.ts syncOutfits) — вся прежняя анимация остаётся как была. Кадры берутся готовыми из
public/assets (их рисуют art/sprites.py и art/security.py), поэтому этот скрипт запускается после них.

    python3 art/pet_outfits.py
"""

from PIL import Image

from sprites import OUT

RED, RED_D = (228, 59, 68, 255), (162, 38, 51, 255)
GOLD = (254, 231, 97, 255)
PINK, PINK_D = (246, 117, 122, 255), (181, 80, 136, 255)
BLUE, BLUE_L = (0, 153, 219, 255), (44, 232, 245, 255)
WHITE = (244, 244, 244, 255)
GREEN, GREEN_L = (62, 137, 72, 255), (99, 199, 77, 255)
INK = (24, 20, 37, 255)
# Шерсть Бобика (art/security.py: B, a, n, N, b) — её свитер перекрашивает.
DOG_FUR = {(184, 111, 80), (143, 86, 59), (228, 166, 114), (234, 212, 170), (115, 62, 57)}

# Кот: где шея у каждого кадра — (x0, x1, y) для ошейника поперёк или ("v", x, y0, y1) вдоль (кот в профиль),
# и где бантик (x, y — левый край). Числа — по рисунку кадров в art/sprites.py.
CAT = {}
for f in range(4):
    bob = 1 if f >= 2 else 0
    CAT[f"cat_walk{f}"] = {"neck": ("v", 7, 5 - bob, 8 - bob), "bell": (6, 9 - bob), "bow": (3, 1 - bob)}
CAT["cat_sit"] = {"neck": ("h", 5, 11, 9), "bell": (8, 10), "bow": (10, 2)}
for name in ("cat_sit0", "cat_sit1", "cat_sit2", "cat_sit_blink"):
    CAT[name] = {"neck": ("h", 7, 13, 9), "bell": (10, 10), "bow": (12, 2)}
for name in ("cat_groom0", "cat_groom1"):
    # Лапа у мордочки закрывает левую половину груди — ошейник видно справа.
    CAT[name] = {"neck": ("h", 11, 13, 9), "bell": (12, 10), "bow": (12, 2)}
for name in ("cat", "cat_flick"):
    CAT[name] = {"neck": ("v", 8, 4, 9), "bell": (9, 9), "bow": (3, 2)}

# Бобик: где ошейник и грудка (сидит/лает), шея (идёт, лежит) и туловище (для свитера).
DOG = {
    "bobik_sit0": {"neck": ("h", 4, 11, 11), "chest": (8, 12), "body": (2, 11, 14, 18)},
    "bobik_sit1": {"neck": ("h", 4, 11, 11), "chest": (8, 12), "body": (2, 11, 14, 18)},
    "bobik_bark": {"neck": ("h", 4, 11, 11), "chest": (8, 12), "body": (2, 11, 14, 18)},
    "bobik_walk0": {"neck": ("v", 8, 4, 8), "chest": (8, 9), "body": (9, 3, 19, 10)},
    "bobik_walk1": {"neck": ("v", 8, 4, 8), "chest": (8, 9), "body": (9, 3, 19, 10)},
    "bobik_lie": {"neck": ("v", 10, 5, 10), "chest": (10, 11), "body": (10, 3, 22, 12)},
}


def blank(name):
    base = Image.open(OUT / f"{name}.png").convert("RGBA")
    return base, Image.new("RGBA", base.size, (0, 0, 0, 0))


def put(img, base, x, y, color, solid_only=True):
    """Пиксель наряда — только поверх самого питомца (не в пустоту рядом), если solid_only."""
    if 0 <= x < img.width and 0 <= y < img.height and (not solid_only or base.getpixel((x, y))[3] > 0):
        img.putpixel((x, y), color)


def neck_line(img, base, neck, color, thick=1):
    kind = neck[0]
    if kind == "h":
        _, x0, x1, y = neck
        for t in range(thick):
            for x in range(x0, x1 + 1):
                put(img, base, x, y + t, color)
    else:
        _, x, y0, y1 = neck
        for t in range(thick):
            for y in range(y0, y1 + 1):
                put(img, base, x + t, y, color)


def bow(img, x, y, color, dark):
    """Бантик 5×2: две петли и узелок."""
    for dx, dy, c in ((0, 0, color), (1, 0, color), (3, 0, color), (4, 0, color), (0, 1, color), (4, 1, color), (2, 0, dark), (2, 1, dark), (1, 1, dark), (3, 1, dark)):
        if 0 <= x + dx < img.width and 0 <= y + dy < img.height:
            img.putpixel((x + dx, y + dy), c)


def cat_outfits():
    for name, spot in CAT.items():
        for outfit in ("bell", "bow", "scarf"):
            base, img = blank(name)
            if outfit == "bell":
                neck_line(img, base, spot["neck"], RED)
                bx, by = spot["bell"]
                put(img, base, bx, by, GOLD, solid_only=False)
                put(img, base, bx + 1, by, GOLD, solid_only=False)
            elif outfit == "bow":
                bow(img, *spot["bow"], PINK, PINK_D)
            else:
                neck_line(img, base, spot["neck"], BLUE, thick=2)
                bx, by = spot["bell"]
                put(img, base, bx, by + 1, BLUE_L, solid_only=False)
                put(img, base, bx, by + 2, BLUE, solid_only=False)
            img.save(OUT / f"ovl_{name}_{outfit}.png")


def dog_outfits():
    for name, spot in DOG.items():
        for outfit in ("bandana", "bowtie", "sweater"):
            base, img = blank(name)
            if outfit == "bandana":
                neck_line(img, base, spot["neck"], BLUE, thick=1)
                cx, cy = spot["chest"]
                # Треугольник банданы на грудке, белые горошины.
                for row, half in enumerate((3, 2, 1, 0)):
                    for x in range(cx - half, cx + half + 1):
                        put(img, base, x, cy + row, WHITE if (x + row) % 3 == 0 else BLUE)
            elif outfit == "bowtie":
                cx, cy = spot["chest"]
                bow(img, cx - 2, cy - 1, RED, RED_D)
            else:
                x0, y0, x1, y1 = spot["body"]
                for y in range(y0, y1 + 1):
                    for x in range(x0, x1 + 1):
                        if base.getpixel((x, y))[3] and base.getpixel((x, y))[:3] in DOG_FUR:
                            img.putpixel((x, y), GREEN_L if y % 3 == 0 else GREEN)
                neck_line(img, base, spot["neck"], WHITE)
            img.save(OUT / f"ovl_{name}_{outfit}.png")


def main():
    cat_outfits()
    dog_outfits()


if __name__ == "__main__":
    main()
