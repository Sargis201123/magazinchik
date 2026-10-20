"""Циферблат без стрелок: стрелки рисует игра и двигает по ходу смены (clock_face)."""
from PIL import Image

from sprites import OUT


def main() -> None:
    im = Image.open(OUT / "clock.png").convert("RGBA")
    face = im.getpixel((4, 7))
    # Нарисованные стрелки (вертикальная и короткая вправо) закрашиваются цветом циферблата.
    for x, y in [(7, 3), (7, 4), (7, 5), (7, 6), (8, 7), (9, 7)]:
        im.putpixel((x, y), face)
    # Метки 12, 3, 6, 9.
    mark = (90, 80, 100, 255)
    for x, y in [(7, 2), (11, 7), (7, 11), (2, 7)]:
        im.putpixel((x, y), mark)
    im.save(OUT / "clock_face.png")


if __name__ == "__main__":
    main()
