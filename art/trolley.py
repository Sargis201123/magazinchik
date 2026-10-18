"""Тележка в руках покупателя (часть гостей берёт её у входа и катит по залу).

  trolley    20×22 — вид сверху-спереди: корзина-сетка с покупками, красная ручка;
  trolley_s  26×22 — сбоку: сетка, ручка сзади, колёса.
Покупки в корзине нарисованы сразу: пустую тележку от полной на таком размере не отличить.

    python3 art/sprites.py
"""

from sprites import Canvas


def trolley():
    c = Canvas(20, 22)
    # Корзина: светлая рама, сетка, внутри — покупки.
    c.rect(2, 6, 16, 11, "l")
    c.rect(3, 7, 14, 9, "G")
    for x, tone in ((4, "Y"), (8, "R"), (12, "U")):
        c.rect(x, 8, 3, 4, tone)
        c.px(x, 8, "w")
    c.rect(6, 12, 8, 3, "E")
    for gx in range(4, 17, 3):
        c.vline(gx, 12, 4, "l")
    c.hline(2, 16, 16, "l")
    # Ручка спереди (к зрителю идёт покупатель — ручка у него в руках сверху).
    c.rect(3, 3, 14, 2, "R")
    c.vline(3, 3, 4, "G")
    c.vline(16, 3, 4, "G")
    for x in (3, 15):
        c.rect(x, 18, 3, 3, "k")
    c.outline("k")
    c.save("trolley")

    c = Canvas(26, 22)
    # Сбоку: корзина клином, ручка слева (покупатель толкает), колёса снизу.
    c.rect(7, 5, 17, 10, "l")
    c.rect(8, 6, 15, 8, "G")
    for x, tone in ((9, "Y"), (13, "R"), (17, "U")):
        c.rect(x, 7, 3, 4, tone)
        c.px(x, 7, "w")
    for gx in range(9, 23, 3):
        c.vline(gx, 11, 3, "l")
    c.line(7, 5, 2, 2, "G")
    c.rect(0, 1, 4, 2, "R")
    c.hline(8, 16, 15, "G")
    for x in (9, 21):
        c.ellipse(x, 18, 2, 2, "k")
        c.px(x, 18, "l")
    c.outline("k")
    c.save("trolley_s")


def main():
    trolley()


if __name__ == "__main__":
    main()
