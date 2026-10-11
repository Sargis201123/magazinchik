"""Снежные шапки на деревьях и кустах (погода «снег»): белый слой на верхних краях кроны,
с голубой тенью снизу. Рисуется поверх готовых tree.png и bush.png.
  tree_snow, bush_snow — как исходные, но под снегом.

    python3 art/sprites.py
"""

from PIL import Image

from sprites import OUT

SNOW = (244, 248, 255, 255)
SNOW_SHADE = (206, 222, 244, 255)


def green(p):
    r, g, b, a = p
    return a == 255 and g > r + 15 and g > b + 15


def cap(name, depth):
    img = Image.open(OUT / f"{name}.png").convert("RGBA")
    w, h = img.size
    px = img.load()
    out = img.copy()
    po = out.load()
    light = max((px[x, y] for x in range(w) for y in range(h) if green(px[x, y])), key=lambda p: p[1])
    for x in range(w):
        # Шапка: верхние depth пикселей кроны в каждом столбце.
        top = next((y for y in range(h) if green(px[x, y])), None)
        if top is not None:
            for y in range(top, min(h, top + depth)):
                if green(px[x, y]):
                    po[x, y] = SNOW if y < top + depth - 1 else SNOW_SHADE
        # Снег на ветках: верхние края светлых пятен кроны.
        for y in range(1, h):
            p, up = px[x, y], px[x, y - 1]
            if green(p) and abs(p[1] - light[1]) < 25 and not (green(up) and abs(up[1] - light[1]) < 25):
                po[x, y] = SNOW
                if y + 1 < h and green(px[x, y + 1]):
                    po[x, y + 1] = SNOW_SHADE
    out.save(OUT / f"{name}_snow.png")


def main():
    cap("tree", 5)
    cap("bush", 3)


if __name__ == "__main__":
    main()
