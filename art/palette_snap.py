"""Чужую картинку — в стиль игры: ровная пиксельная сетка, только цвета нашей палитры (art/sprites.py PALETTE —
Endesga 32 и свои тона), прозрачность без полутонов, по желанию — контур #181425, как у наших спрайтов.

Для готовых наборов (CC0-иконки, тайлы), набросков нейросети и фото товара. Сама картинка остаётся чужой работой —
лицензию набора проверяем до того, как класть его в игру (docs/ART_SOURCES.md).

    python3 art/palette_snap.py in.png out.png                      # только палитра и прозрачность
    python3 art/palette_snap.py in.png out.png --cell 4             # картинка увеличена ×4 → вернуть к 1:1
    python3 art/palette_snap.py in.png out.png --pixelate           # «неровный» пиксель-арт (нейросеть, ресайз):
                                                                     # сетку найдёт proper-pixel-art, если он стоит
    python3 art/palette_snap.py sheet.png out_dir --tile 16 --prefix food   # нарезать лист на клетки 16×16
    python3 art/palette_snap.py in.png out.png --outline --fit 12   # вписать в 12×12 и обвести контуром

Из скриптов: from palette_snap import snap; img = snap(Image.open(...), outline=True).
"""

import argparse
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sprites import PALETTE  # noqa: E402

INK = (0x18, 0x14, 0x25)


def _rgb(hexs):
    h = hexs.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


COLORS = sorted({_rgb(v) for v in PALETTE.values() if v})


def _dist(a, b):
    """Разница цветов «на глаз» (redmean): зелёный весомее, синий — смотря по красному."""
    r = (a[0] + b[0]) / 2
    dr, dg, db = a[0] - b[0], a[1] - b[1], a[2] - b[2]
    return (2 + r / 256) * dr * dr + 4 * dg * dg + (2 + (255 - r) / 256) * db * db


_near = {}


def nearest(c):
    """Ближайший цвет палитры игры."""
    if c not in _near:
        _near[c] = min(COLORS, key=lambda p: _dist(c, p))
    return _near[c]


def downscale(img, cell):
    """Увеличенный пиксель-арт (каждая точка — cell×cell) обратно к 1:1: в каждой клетке — самый частый цвет."""
    w, h = img.width // cell, img.height // cell
    src = img.load()
    out = Image.new("RGBA", (w, h))
    px = out.load()
    for y in range(h):
        for x in range(w):
            seen = {}
            for yy in range(y * cell, (y + 1) * cell):
                for xx in range(x * cell, (x + 1) * cell):
                    c = src[xx, yy]
                    seen[c] = seen.get(c, 0) + 1
            px[x, y] = max(seen, key=seen.get)
    return out


def pixelate(img):
    """Неровный пиксель-арт (нейросеть, растянутый скриншот) — на ровную сетку. Нужен proper-pixel-art (MIT,
    pip install proper-pixel-art); без него — ошибка с подсказкой."""
    try:
        from proper_pixel_art import PixelateConfig, pixelate as ppa  # type: ignore
    except ImportError as e:
        raise SystemExit("нужен proper-pixel-art: pip install proper-pixel-art (или укажите --cell N)") from e
    return ppa(img.convert("RGBA"), PixelateConfig(transparent_background=True)).image.convert("RGBA")


def outline(img, color=INK):
    """Контур по 4 соседям вокруг непрозрачного — как Canvas.outline у наших спрайтов. Картинка шире на 1 с краёв."""
    w, h = img.size
    out = Image.new("RGBA", (w + 2, h + 2))
    out.alpha_composite(img, (1, 1))
    px = out.load()
    solid = {(x, y) for y in range(h + 2) for x in range(w + 2) if px[x, y][3]}
    for x, y in solid:
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w + 2 and 0 <= ny < h + 2 and (nx, ny) not in solid:
                px[nx, ny] = (*color, 255)
    return out


def trim(img):
    box = img.getbbox()
    return img.crop(box) if box else img


def fit(img, size):
    """Вписать в size×size: уменьшить в целое число раз (если не влезает — ближайшим соседом), по центру внизу."""
    img = trim(img)
    if img.width > size or img.height > size:
        k = size / max(img.width, img.height)
        img = img.resize((max(1, round(img.width * k)), max(1, round(img.height * k))), Image.NEAREST)
    out = Image.new("RGBA", (size, size))
    out.alpha_composite(img, ((size - img.width) // 2, size - img.height))
    return out


def snap(img, cell=None, do_pixelate=False, with_outline=False, alpha=128, size=None):
    """Главное: сетка → палитра игры → прозрачность без полутонов → (вписать) → (контур)."""
    img = img.convert("RGBA")
    if do_pixelate:
        img = pixelate(img)
    elif cell and cell > 1:
        img = downscale(img, cell)
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            px[x, y] = (*nearest((r, g, b)), 255) if a >= alpha else (0, 0, 0, 0)
    if size:
        img = fit(img, size - (2 if with_outline else 0))
    if with_outline:
        img = outline(trim(img)) if not size else outline(img)
    return img


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src")
    ap.add_argument("dst", help="файл PNG или папка (с --tile)")
    ap.add_argument("--cell", type=int, help="во сколько раз картинка увеличена (вернуть к 1:1)")
    ap.add_argument("--pixelate", action="store_true", help="найти сетку сам (proper-pixel-art)")
    ap.add_argument("--outline", action="store_true", help="обвести контуром #181425")
    ap.add_argument("--fit", type=int, help="вписать в квадрат N×N")
    ap.add_argument("--alpha", type=int, default=128, help="порог прозрачности 0–255")
    ap.add_argument("--tile", type=int, help="нарезать лист на клетки N×N (пустые пропускаются)")
    ap.add_argument("--prefix", default="tile")
    a = ap.parse_args()
    src = Image.open(a.src).convert("RGBA")
    if a.tile:
        os.makedirs(a.dst, exist_ok=True)
        n = 0
        for ty in range(0, src.height - a.tile + 1, a.tile):
            for tx in range(0, src.width - a.tile + 1, a.tile):
                cell = src.crop((tx, ty, tx + a.tile, ty + a.tile))
                if not cell.getbbox():
                    continue
                snap(cell, a.cell, a.pixelate, a.outline, a.alpha, a.fit).save(os.path.join(a.dst, f"{a.prefix}_{n:02d}.png"))
                n += 1
        print(f"{n} клеток → {a.dst}")
        return
    snap(src, a.cell, a.pixelate, a.outline, a.alpha, a.fit).save(a.dst)
    print(f"→ {a.dst}")


if __name__ == "__main__":
    main()
