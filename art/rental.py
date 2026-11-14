"""Прокат у входа (src/game/rental.ts, src/scenes/rentalFx.ts): стойка и вещи — на стойке и в руках прохожих.

13.11 (задача автора «Прокат по погоде»): зимой санки и ватрушки, летом велосипеды и самокаты, в дождь — зонты.
Вещи проката одного цвета — синие с белым, как городской прокат: на улице сразу видно, кто катится на нашем
самокате или идёт под нашим зонтом. Палитра Endesga 32, двойная детализация (в мире вдвое меньше).

    python3 art/rental.py

Картинки:
  rent_stand          64×36 — невысокая стойка под полосатым козырьком (вывеска — сцена, на доске pitch_sign);
  rent_bike           24×16 — велосипед с корзинкой (едет вправо); на стойке и под седоком;
  rent_kick           18×18 — самокат (едет вправо);
  rent_sled           24×12 — санки со спинкой (полозья загнуты вперёд, вправо);
  rent_tube           20×12 — ватрушка: красный верх, тёмное дно, ручки;
  rent_sled_pull, rent_tube_pull — то же с верёвкой вперёд-вверх, к руке того, кто тянет;
  rent_umbrella       8×20  — сложенный зонт (висит на перекладине ручкой вверх);
  rent_umbrella_open  32×30 — раскрытый зонт сверху: синие и белые клинья (над головой, как umbrella).
"""

import math

from premium import H, lit
from sprites import Canvas, shadowed

BLUE, BLUE_D, BLUE_L = H("#0099db"), H("#124e89"), H("#2ce8f5")
WHITE, PALE = H("#ffffff"), H("#c0cbdc")
WOOD, WOOD_D, WOOD_L = H("#8f563b"), H("#5e3a2a"), H("#b86f50")
RED, RED_D, RED_L = H("#e43b44"), H("#a22633"), H("#f6757a")
TIN, TIN_D = H("#8b9bb4"), H("#5a6988")
DARK = H("#262b44")
WICKER, WICKER_D = H("#e4a672"), H("#b86f50")
ROPE = H("#ead4aa")


def stand():
    """Стойка: два столба, полосатый козырёк с фестонами, перекладина с крючками и нижний брус. 64×36 (в мире 32×18).
    Невысокая: тротуар у бордюра узкий, а выше — козырёк витрин магазина (он рисуется поверх всего тротуара)."""
    c = Canvas(64, 36)
    # Столбы.
    for x in (4, 57):
        c.rect(x, 8, 3, 26, WOOD)
        c.vline(x, 8, 26, WOOD_L)
        c.vline(x + 2, 8, 26, WOOD_D)
    # Перекладина (на ней висят зонты, к ней прислоняют санки) и нижний брус.
    c.rect(4, 12, 56, 2, WOOD)
    c.hline(4, 12, 56, WOOD_L)
    for x in range(12, 56, 8):
        c.px(x, 14, TIN_D)
    c.rect(4, 29, 56, 2, WOOD_D)
    c.hline(4, 29, 56, WOOD)
    # Козырёк: синие и белые полосы, сверху темнее, снизу фестоны.
    for y in range(1, 8):
        for x in range(1, 63):
            stripe = BLUE if (x // 6) % 2 == 0 else WHITE
            c.px(x, y, lit(stripe, -0.18) if y <= 2 else stripe)
    c.hline(0, 0, 64, BLUE_D)
    for x in range(1, 63):
        if x % 6 in (1, 2, 3, 4):
            stripe = BLUE if (x // 6) % 2 == 0 else WHITE
            c.px(x, 8, lit(stripe, -0.12))
    c.outline("k")
    shadowed(c, 32, 33, 30, 2.5).save("rent_stand")


def wheel(c, cx, cy, r):
    """Колесо: тёмная шина, пустота внутри, втулка."""
    c.ellipse(cx, cy, r, r, DARK)
    c.ellipse(cx, cy, r - 1.3, r - 1.3, (0, 0, 0, 0))
    c.px(int(cx), int(cy), TIN)


def bike():
    """Велосипед проката 24×16 (в мире 12×8): синяя рама, белые крылья, плетёная корзинка спереди. Едет вправо."""
    c = Canvas(24, 16)
    wheel(c, 5.5, 11.5, 4.3)
    wheel(c, 18.5, 11.5, 4.3)
    rear, bb, seat, head, front = (5, 11), (11, 11), (9, 5), (16, 5), (18, 11)
    for a, b in ((rear, bb), (rear, seat), (seat, bb), (seat, head), (bb, head), (head, front)):
        c.line(*a, *b, BLUE)
    c.px(10, 6, BLUE_L)
    c.px(13, 5, BLUE_L)
    # Крылья над колёсами.
    c.hline(3, 6, 4, WHITE)
    c.hline(17, 6, 4, WHITE)
    # Седло, руль, педаль.
    c.hline(7, 4, 4, DARK)
    c.vline(16, 3, 2, TIN_D)
    c.hline(14, 2, 3, DARK)
    c.px(11, 12, TIN_D)
    # Корзинка.
    c.rect(18, 3, 5, 4, WICKER)
    c.hline(18, 3, 5, WICKER_D)
    c.vline(20, 3, 4, WICKER_D)
    c.outline("k")
    c.save("rent_bike")


def kick():
    """Самокат 18×18 (в мире 9×9): синяя дека, стойка с рулём, маленькие колёса. Едет вправо."""
    c = Canvas(18, 18)
    wheel(c, 3.5, 14.5, 2.4)
    wheel(c, 14.5, 14.5, 2.4)
    c.rect(3, 12, 10, 2, BLUE)
    c.hline(3, 12, 10, BLUE_L)
    c.line(13, 13, 14, 12, BLUE_D)
    # Стойка руля чуть наклонена назад, ручки — тёмные.
    c.line(14, 12, 13, 3, TIN)
    c.line(15, 12, 14, 3, TIN_D)
    c.hline(10, 2, 7, BLUE_D)
    c.hline(10, 2, 2, DARK)
    c.hline(15, 2, 2, DARK)
    # Заднее крыло — тормоз.
    c.hline(1, 11, 4, WHITE)
    c.outline("k")
    c.save("rent_kick")


def sled(c, ox, oy):
    """Санки сбоку: деревянные рейки, спинка, красные полозья с загибом вперёд (вправо). Место 24×12 от (ox, oy)."""
    # Спинка.
    c.vline(ox + 3, oy + 1, 4, WOOD_D)
    c.hline(ox + 3, oy + 1, 4, WOOD)
    # Сиденье: три рейки.
    c.rect(ox + 3, oy + 5, 16, 2, WOOD)
    c.hline(ox + 3, oy + 5, 16, WOOD_L)
    for x in (ox + 8, ox + 13):
        c.vline(x, oy + 5, 2, WOOD_D)
    # Стойки и полозья.
    for x in (ox + 5, ox + 10, ox + 16):
        c.vline(x, oy + 7, 2, RED_D)
    c.hline(ox + 2, oy + 9, 18, RED)
    c.hline(ox + 2, oy + 10, 18, RED_D)
    c.line(ox + 20, oy + 9, ox + 21, oy + 8, RED)
    c.line(ox + 21, oy + 8, ox + 21, oy + 5, RED)
    c.px(ox + 20, oy + 4, RED_L)


def tube(c, ox, oy):
    """Ватрушка: красный верх с бликом, тёмное дно, дырка посередине, ручки по бокам. Место 20×12 от (ox, oy)."""
    cx, cy = ox + 10, oy + 6
    c.ellipse(cx, cy + 1, 9, 4.5, DARK)
    c.ellipse(cx, cy, 9, 4.2, RED)
    c.ellipse(cx - 2, cy - 2, 4, 1.2, RED_L)
    c.ellipse(cx, cy, 3.3, 1.5, RED_D)
    c.ellipse(cx, cy + 0.3, 2.4, 0.9, DARK)
    # Ручки — синие петли.
    c.rect(cx - 9, cy - 1, 2, 2, BLUE)
    c.rect(cx + 8, cy - 1, 2, 2, BLUE)


def rope(c, x0, y0, x1, y1):
    c.line(x0, y0, x1, y1, ROPE)


def sleds():
    c = Canvas(24, 12)
    sled(c, 0, 0)
    c.outline("k")
    c.save("rent_sled")
    c = Canvas(20, 12)
    tube(c, 0, 0)
    c.outline("k")
    c.save("rent_tube")
    # С верёвкой: вещь слева, верёвка от переда вверх-вправо — к руке того, кто тянет (сцена ставит её за человеком).
    c = Canvas(34, 14)
    sled(c, 0, 2)
    c.outline("k")
    rope(c, 22, 6, 33, 0)
    c.save("rent_sled_pull")
    c = Canvas(30, 14)
    tube(c, 0, 2)
    c.outline("k")
    rope(c, 20, 7, 29, 0)
    c.save("rent_tube_pull")


def umbrella_closed():
    """Сложенный зонт 8×20 (в мире 4×10): ручка-крючок сверху (висит на перекладине), синий чехол сужается к острию."""
    c = Canvas(8, 20)
    # Крючок.
    c.hline(2, 0, 3, DARK)
    c.vline(1, 1, 2, DARK)
    c.vline(4, 1, 4, DARK)
    # Чехол: от широкого к острию.
    for y in range(5, 17):
        half = 2 if y < 13 else 1 if y < 16 else 0
        for x in range(4 - half, 4 + half + 1):
            c.px(x, y, BLUE if (x + y // 3) % 3 else WHITE)
        c.px(4 - half, y, BLUE_D)
    c.hline(3, 9, 3, BLUE_D)
    c.vline(4, 17, 2, TIN)
    c.outline("k")
    c.save("rent_umbrella")


def umbrella_open():
    """Раскрытый зонт сверху 32×30 — как umbrella (scenes/weatherFx.ts), но синие и белые клинья и тёмная пуговка."""
    c = Canvas(32, 30)
    cx, cy = 15.5, 12.5
    for y in range(0, 26):
        for x in range(0, 32):
            dx, dy = (x + 0.5 - cx) / 15.2, (y + 0.5 - cy) / 12.6
            d = dx * dx + dy * dy
            if d > 1:
                continue
            wedge = int((math.atan2(dy, dx) + math.pi) / (math.pi / 4)) % 2
            col = BLUE if wedge else WHITE
            # Край зонта темнее, к пуговке светлее: купол.
            col = lit(col, -0.22) if d > 0.8 else lit(col, 0.12) if d < 0.15 else col
            c.px(x, y, col)
    c.rect(15, 12, 2, 2, DARK)
    c.outline("k")
    # Тень под зонтом — как у обычного: ручка и плечи в тени.
    out = shadowed(c, 16, 27, 11, 1.6, alpha=90)
    out.save("rent_umbrella_open")


if __name__ == "__main__":
    stand()
    bike()
    kick()
    sleds()
    umbrella_closed()
    umbrella_open()
