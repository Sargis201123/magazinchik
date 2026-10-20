"""Лица покупателей: глаза крупнее (2×2 с бликом) и три настроения спереди —
обычное, радостное (нашёл товар) и хмурое (долго в очереди). Сбоку и сзади
лицо то же, копии нужны, чтобы слой поворачивался вместе с человеком."""

from PIL import Image

from sprites import OUT

INK = (24, 20, 37, 255)
SHINE = (200, 204, 220, 255)
MOUTH = (150, 80, 80, 255)
BLUSH = (238, 170, 160, 255)
SKIN = (255, 255, 255, 255)

# Глаза 2×2: левый x=7..8, правый x=14..15 (лицо в три четверти — правый ближе к носу).
EYES = (7, 14)


def blank():
    im = Image.open(OUT / "p_skin.png").convert("RGBA")
    # Стираем прежние глаза, рот и румянец (контур лица за пределами этой области) —
    # кожа белая, её красит тинт. Повторный запуск даёт тот же результат.
    for y in range(9, 14):
        for x in range(6, 18):
            if im.getpixel((x, y))[3]:
                im.putpixel((x, y), SKIN)
    return im


def cheeks(im, tone=BLUSH):
    for x in (6, 16):
        im.putpixel((x, 12), tone)


def neutral(im):
    for ex in EYES:
        for dx in (0, 1):
            for y in (10, 11):
                im.putpixel((ex + dx, y), INK)
        im.putpixel((ex + 1, 10), SHINE)
    im.putpixel((11, 13), MOUTH)
    im.putpixel((12, 13), MOUTH)
    cheeks(im)


def happy(im):
    # Глаза-дужки (зажмурился от радости) и широкая улыбка, румянец ярче.
    for ex in EYES:
        im.putpixel((ex, 10), INK)
        im.putpixel((ex + 1, 10), INK)
        im.putpixel((ex - 1, 11), INK)
        im.putpixel((ex + 2, 11), INK)
    for x, y in [(9, 13), (10, 14), (11, 14), (12, 14), (13, 13)]:
        im.putpixel((x, y), MOUTH)
    cheeks(im, (232, 132, 132, 255))


def frown(im):
    # Недовольный прищур «-_-», брови сведены, рот уголками вниз.
    for ex in EYES:
        im.putpixel((ex, 11), INK)
        im.putpixel((ex + 1, 11), INK)
        im.putpixel((ex, 9), INK)
        im.putpixel((ex + 1, 9), INK)
    for x, y in [(10, 14), (11, 13), (12, 13), (13, 14)]:
        im.putpixel((x, y), MOUTH)


def main():
    base = blank()
    for name, draw in (("p_skin", neutral), ("p_skin_happy", happy), ("p_skin_frown", frown)):
        im = base.copy()
        draw(im)
        im.save(OUT / f"{name}.png")
        if name != "p_skin":
            for suffix in ("_b", "_s"):
                Image.open(OUT / f"p_skin{suffix}.png").save(OUT / f"{name}{suffix}.png")


if __name__ == "__main__":
    main()
