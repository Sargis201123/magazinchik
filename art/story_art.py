"""Иллюстрации сюжета: картинку нейросети уменьшаем до 320×180 и сводим к палитре игры —
так она выглядит родным пиксель-артом. Запуск: python3 art/story_art.py <папка с ch1.png … finale.png>"""

import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from sprites import PALETTE  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "public" / "story"
SIZE = (320, 180)


def palette_image():
    colors = []
    for value in PALETTE.values():
        if value and value.startswith("#") and value not in colors:
            colors.append(value)
    flat = []
    for c in colors:
        flat += [int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16)]
    flat += flat[:3] * (256 - len(colors))
    pal = Image.new("P", (1, 1))
    pal.putpalette(flat)
    return pal


def convert(src: Path, dst: Path, pal: Image.Image) -> None:
    im = Image.open(src).convert("RGB")
    # Обрезаем под 16:9 по центру и уменьшаем усреднением — «пиксели» нейросети сливаются в настоящие.
    w, h = im.size
    target = w / h
    want = SIZE[0] / SIZE[1]
    if target > want:
        nw = int(h * want)
        im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:
        nh = int(w / want)
        im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    im = im.resize(SIZE, Image.BOX)
    im = im.quantize(palette=pal, dither=Image.Dither.NONE).convert("RGB")
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, optimize=True)


def main():
    src_dir = Path(sys.argv[1])
    pal = palette_image()
    for name in ("ch1", "ch2", "ch3", "ch4", "ch5", "finale"):
        src = src_dir / f"{name}.png"
        if src.exists():
            convert(src, OUT / f"{name}.png", pal)
            print("готово:", name)


if __name__ == "__main__":
    main()
