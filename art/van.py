"""Фургон магазина для выездной торговли (src/game/van.ts, 13.11).

Тот же размер и та же посадка, что у фургона car_van в art/sprites.py (cars, cars_vertical), — парковка и
проезд (src/scenes/cars.ts) возят его как любую машину. Только он не под тинт, а в цветах магазина: белый
кузов, крыша кузова — красно-белым полосатым навесом, как маркиза над входом, у кабины — жёлтая вывеска,
по борту — красная полоса. Его сразу видно среди машин соседей.

  shop_van              72×36 — вбок, носом вправо (и _lights — фары и стоп-сигналы отдельной картинкой);
  shop_van_up / _down   36×72 — носом вверх и вниз (и их _lights).

    python3 art/van.py
"""

from sprites import Canvas, shadowed

BODY, BODY_LO, BODY_SHADE = "w", "W", "l"
STRIPE = "R"
SIGN, SIGN_LO = "Y", "y"


def side():
    c = Canvas(72, 36)
    x0, x1, top, bottom = 2, 70, 4, 32
    for x in (12, 52):
        c.rect(x, top - 1, 9, 3, "k")
        c.rect(x, bottom - 2, 9, 3, "k")
    c.round_rect(x0, top, x1 - x0, bottom - top, BODY, r=4)
    # Борт к зрителю: красная полоса и тень снизу.
    c.hline(x0 + 3, bottom - 3, x1 - x0 - 6, STRIPE)
    c.hline(x0 + 3, bottom - 2, x1 - x0 - 6, BODY_LO)
    c.hline(x0 + 3, bottom - 1, x1 - x0 - 6, BODY_SHADE)
    # Крыша кузова — навес полосами поперёк, как маркиза над входом (art/sprites.py awning): у ближнего
    # края полосы темнеют и свисают фестонами.
    for i, x in enumerate(range(6, 54, 4)):
        tone, shade = (STRIPE, "r") if i % 2 == 0 else (BODY, BODY_LO)
        c.rect(x, 7, 4, 19, tone)
        c.hline(x, 24, 4, shade)
        c.hline(x, 25, 4, shade)
        c.ellipse(x + 2, 26, 2, 1.6, tone)
    c.hline(6, 7, 48, "m")
    # Жёлтая вывеска над кабиной и кабина: лобовое стекло с бликом.
    c.rect(54, 8, 4, 19, SIGN)
    c.vline(57, 8, 19, SIGN_LO)
    c.rect(58, 7, 7, 22, "u")
    c.vline(60, 8, 6, "c")
    c.outline("k")
    shadowed(c, 36, 32, 33, 3.5).save("shop_van")
    lamp = Canvas(72, 36)
    lamp.rect(x1 - 2, top + 2, 2, 4, "Y")
    lamp.rect(x1 - 2, bottom - 7, 2, 4, "Y")
    lamp.rect(x0, top + 2, 2, 4, "R")
    lamp.rect(x0, bottom - 7, 2, 4, "R")
    lamp.save("shop_van_lights")


def vertical(up):
    """Носом вверх (виден задний борт со стоп-сигналами) или вниз (перед с фарами) — как cars_vertical."""
    x0, x1, y0, y1 = 4, 32, 2, 70
    d, length, front = 10, 55, 7

    def span(at, h):
        return y0 + at if up else y1 - at - h

    c = Canvas(36, 72)
    for wy in (11, 51):
        c.rect(x0 - 1, wy, 3, 9, "k")
        c.rect(x1 - 2, wy, 3, 9, "k")
    c.round_rect(x0, y0, x1 - x0, y1 - y0, BODY, r=4)
    rx0, rw = x0 + 3, x1 - x0 - 6
    # Лобовое стекло у носа и вывеска за ним.
    c.rect(rx0, span(d, front), rw, front, "u")
    c.hline(rx0 + 1, span(d + 2, 1), 5, "c")
    c.rect(rx0, span(d + front, 3), rw, 3, SIGN)
    # Крыша кузова — навес полосами поперёк кузова.
    roof = length - front - 3
    for i, at in enumerate(range(d + front + 3, d + length, 4)):
        h = min(4, d + length - at)
        tone, shade = (STRIPE, "r") if i % 2 == 0 else (BODY, BODY_LO)
        c.rect(rx0, span(at, h), rw, h, tone)
        c.vline(rx0 + rw - 2, span(at, h), h, shade)
        c.vline(rx0 + rw - 1, span(at, h), h, shade)
    c.vline(rx0, span(d + front + 3, roof), roof, BODY_LO)
    # Борт к зрителю: задний с полосой или передний с решёткой.
    c.hline(x0 + 3, y1 - 3, x1 - x0 - 6, STRIPE)
    c.hline(x0 + 3, y1 - 2, x1 - x0 - 6, BODY_LO)
    c.hline(x0 + 3, y1 - 1, x1 - x0 - 6, BODY_SHADE)
    if not up:
        c.hline(x0 + 8, y1 - 2, x1 - x0 - 16, "k")
    c.outline("k")
    suffix = "up" if up else "down"
    shadowed(c, 18, y1 - 1, (x1 - x0) / 2 + 3, 4.5).save(f"shop_van_{suffix}")
    lamp = Canvas(36, 72)
    near = y1 - 3
    far = y0 + 1
    front_y, back_y = (far, near) if up else (near, far)
    for x in (x0 + 2, x1 - 6):
        lamp.rect(x, front_y, 4, 2, "Y")
        lamp.rect(x, back_y, 4, 2, "R")
    lamp.save(f"shop_van_{suffix}_lights")


if __name__ == "__main__":
    side()
    vertical(True)
    vertical(False)
