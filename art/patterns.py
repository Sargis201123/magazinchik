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


INK = (24, 20, 37, 255)


def coat():
    """Пуховик поверх рубашки: та же форма, стёганые полосы, спереди — молния."""
    for suffix in ("", "_b", "_s"):
        im, cloth = fabric(f"p_shirt{suffix}")
        c = Canvas(im.width, im.height)
        for y in range(im.height):
            for x in range(im.width):
                if not im.getpixel((x, y))[3]:
                    continue
                if not cloth(x, y):
                    c.px(x, y, INK)
                elif y in (20, 23):
                    c.px(x, y, (178, 178, 186, 255))
                else:
                    c.px(x, y, (240, 240, 240, 255) if y > 17 else (255, 255, 255, 255))
        if suffix == "":
            for y in range(17, 27):
                if cloth(11, y):
                    c.px(11, y, (140, 140, 150, 255))
        c.save(f"p_coat{suffix}")


def scarf():
    """Вязаный шарф на шее; спереди свисает конец."""
    for suffix, x0, x1, tail in (("", 7, 16, True), ("_b", 7, 16, False), ("_s", 8, 15, False)):
        c = Canvas(24, 36)
        c.hline(x0, 16, x1 - x0 + 1, INK)
        for y in (17, 18):
            c.px(x0 - 1, y, INK)
            c.px(x1 + 1, y, INK)
            c.hline(x0, y, x1 - x0 + 1, (255, 255, 255, 255))
            for x in range(x0 + 2, x1, 4):
                c.px(x, y, (196, 196, 204, 255))
        c.hline(x0, 19, x1 - x0 + 1, INK)
        if tail:
            for y in range(19, 23):
                c.px(12, y, INK)
                c.px(15, y, INK)
                c.hline(13, y, 2, (255, 255, 255, 255) if y % 2 else (196, 196, 204, 255))
            c.hline(12, 23, 4, INK)
        c.save(f"p_scarf{suffix}")


def main():
    stripes()
    chest_print()
    coat()
    scarf()


if __name__ == "__main__":
    main()
