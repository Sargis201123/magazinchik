"""Узоры поверх рубашки (перекрашиваются тинтом): полоски — со всех сторон,
принт на груди — только спереди. Строятся по готовым p_shirt*: попадают только
на ткань, не на контур."""

from PIL import Image

from sprites import OUT, Canvas


def fabric(name):
    im = Image.open(OUT / f"{name}.png").convert("RGBA")
    return im, lambda x, y: im.getpixel((x, y))[3] > 0 and sum(im.getpixel((x, y))[:3]) >= 300


def stripes():
    for suffix in ("", "_b", "_s"):
        im, cloth = fabric(f"p_shirt{suffix}")
        c = Canvas(im.width, im.height)
        for y in (19, 22, 25):
            for x in range(im.width):
                if cloth(x, y):
                    c.px(x, y, (255, 255, 255, 255))
        c.save(f"p_pat_stripes{suffix}")


def chest_print():
    im, cloth = fabric("p_shirt")
    c = Canvas(im.width, im.height)
    # Сердечко 5×4 на груди.
    heart = ["ww.ww", "wwwww", ".www.", "..w.."]
    for dy, row in enumerate(heart):
        for dx, ch in enumerate(row):
            x, y = 10 + dx, 19 + dy
            if ch == "w" and cloth(x, y):
                c.px(x, y, (255, 255, 255, 255))
    c.save("p_pat_print")


def main():
    stripes()
    chest_print()


if __name__ == "__main__":
    main()
