"""Свет для карты освещения и ореолы «нажми сюда» (src/scenes/light.ts, src/scenes/halo.ts).

light_pool 64×64 — пятно света для карты освещения: белое, мягкое, с ровной серединой и плавным
краем без ступеньки (сила (1 − d²)²). Соседние лампы складываются в карте без светлых швов.
halo 24×24 — мягкий ореол для девятичастной картинки (NineSlice): от края предмета 8 точек спада наружу
и 2 — внутрь, середина пустая (её закрывает сам предмет, и сквозь его прозрачное ореол не просвечивает).
Растягивается под размер полки, ведра или щитка, а ширина свечения остаётся одной и той же. Оба белые:
цвет и силу задаёт игра.

    python3 art/light.py
"""

from sprites import Canvas

# Ореол: свечение спадает наружу за HALO_FALL точек, внутрь — за HALO_RAMP; вместе это край, который
# девятичастная картинка не растягивает (EDGE в src/scenes/halo.ts), середина (4 точки) — пустая.
HALO_FALL = 8
HALO_RAMP = 2
HALO_EDGE = HALO_FALL + HALO_RAMP
HALO = 2 * HALO_EDGE + 4


def light_pool():
    c = Canvas(64, 64)
    for y in range(64):
        for x in range(64):
            d2 = ((x - 31.5) ** 2 + (y - 31.5) ** 2) / 32**2
            if d2 < 1:
                c.px(x, y, (255, 255, 255, round(255 * (1 - d2) ** 2)))
    c.save("light_pool")


def halo():
    c = Canvas(HALO, HALO)
    # Край предмета — в HALO_FALL точках от края картинки: наружу свечение спадает, внутрь за HALO_RAMP
    # точек сходит на нет — середину закрывает сам предмет, и сквозь его прозрачное ореол не просвечивает.
    lo = HALO_FALL
    hi = HALO - HALO_FALL
    for y in range(HALO):
        for x in range(HALO):
            # Расстояние до края предмета: снаружи — плюс, внутри — минус.
            dx = max(lo - (x + 0.5), (x + 0.5) - hi)
            dy = max(lo - (y + 0.5), (y + 0.5) - hi)
            d = (dx * dx + dy * dy) ** 0.5 if dx > 0 and dy > 0 else max(dx, dy)
            a = max(0.0, 1 + d / HALO_RAMP) if d < 0 else max(0.0, 1 - d / HALO_FALL) ** 2
            if a > 0:
                c.px(x, y, (255, 255, 255, round(255 * a)))
    c.save("halo")


if __name__ == "__main__":
    light_pool()
    halo()
