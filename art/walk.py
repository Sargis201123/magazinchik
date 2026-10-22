"""Взмах рук при ходьбе: к слоям рубашки и кожи (спереди, сзади, сбоку и с разными лицами)
два кадра — рука уходит вперёд-назад на точку. Спереди лицо нарисовано в три четверти,
поэтому кадр не зеркалим, как ноги, а рисуем оба: _w1 (левая рука ниже) и _w2 (правая ниже).
Сбоку рука уходит вперёд (_w1) и назад (_w2)."""

from PIL import Image

from sprites import OUT

BASES = ["p_shirt", "p_skin", "p_skin_happy", "p_skin_frown"]
# Рука: на слое рубашки — только наружная часть рукава (край туловища и плечо стоят),
# на слое кожи — кисть. Столбцы и строки включительно.
SLEEVE = {"left": (3, 5, 19, 24), "right": (19, 22, 19, 24)}
HAND = {"left": (3, 6, 24, 27), "right": (16, 20, 24, 27)}
SIDE_ARM = (11, 16, 17, 27)


def shift(im, box, dx, dy, keep=False):
    """Сдвинуть содержимое прямоугольника (x0..x1, y0..y1 включительно) на dx, dy.
    keep — старое место не стирать: рукав вытягивается на точку, а не отрывается от плеча."""
    x0, x1, y0, y1 = box
    region = im.crop((x0, y0, x1 + 1, y1 + 1))
    out = im.copy()
    if not keep:
        out.paste(Image.new("RGBA", region.size, (0, 0, 0, 0)), (x0, y0))
    out.alpha_composite(region, (x0 + dx, y0 + dy))
    return out


def front(im, down, boxes, keep):
    up = "right" if down == "left" else "left"
    im = shift(im, boxes[down], 0, 1, keep)
    return shift(im, boxes[up], 0, -1, keep)


def main():
    for base in BASES:
        for suffix in ("", "_b"):
            src = Image.open(OUT / f"{base}{suffix}.png").convert("RGBA")
            sleeve = base == "p_shirt"
            boxes = SLEEVE if sleeve else HAND
            front(src, "left", boxes, sleeve).save(OUT / f"{base}{suffix}_w1.png")
            front(src, "right", boxes, sleeve).save(OUT / f"{base}{suffix}_w2.png")
        src = Image.open(OUT / f"{base}_s.png").convert("RGBA")
        shift(src, SIDE_ARM, 1, 0).save(OUT / f"{base}_s_w1.png")
        shift(src, SIDE_ARM, -1, 0).save(OUT / f"{base}_s_w2.png")


if __name__ == "__main__":
    main()
