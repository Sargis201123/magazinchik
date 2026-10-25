"""Доставка на дом (src/game/delivery.ts): телефон у кассы, посылка, мопед курьера, значки транспорта
и портреты тех, кто звонит с заказом.

  phone        12×11 — красный настольный телефон: трубка на рычаге, белый диск;
  phone_ring   12×11 — он же звонит: трубка подпрыгнула и наклонилась (кадры меняются, пока звонят);
  parcel       12×10 — посылка: крафт-коробка, скотч крест-накрест и красная наклейка;
  scooter      24×14 — мопед курьера сбоку (едет вправо): оранжевый, с красным ящиком сзади;
  ico_scooter, ico_van 14×14 — значки 🛵 и 🚐 для меню и надписей в зале;
  portrait_caller0..5  64×64 — кто звонит: бабушка, студент, мама, дядя, офис, дедушка.

Велосипед курьера рисует stage11 в sprites.py, фургончик — это машина car_van с оранжевым тинтом.

    python3 art/delivery.py      (или вместе со всеми: python3 art/sprites.py)
"""

from sprites import (
    Canvas,
    beard,
    glasses,
    hair_bald,
    hair_bun,
    hair_cap,
    hair_slick,
    mustache,
    portrait,
    rgb,
    tie,
)

CLEAR = (0, 0, 0, 0)


def phone(name, ringing):
    """Настольный телефон: корпус с диском, трубка на рычагах сверху. Звонит — трубка подскакивает
    над рычагами и наклоняется (между ней и корпусом видна щель)."""
    c = Canvas(12, 11)
    # Корпус: блик сверху, тень снизу.
    c.round_rect(0, 5, 12, 6, "R", r=2)
    c.hline(2, 5, 8, "s")
    c.hline(1, 9, 10, "r")
    c.hline(2, 10, 8, "r")
    # Диск: белый круг с дырочками.
    c.ellipse(6, 7.5, 2.6, 1.8, "w")
    c.px(6, 7, "R")
    for x, y in ((4, 7), (8, 7), (5, 9), (7, 9)):
        c.px(x, y, "W")
    # Трубка: два наушника и ручка между ними; лежит на рычагах или подпрыгнула.
    top = 0 if ringing else 2
    tilt = 1 if ringing else 0
    c.round_rect(0, top, 4, 3, "m", r=1)
    c.round_rect(8, top + tilt, 4, 3, "m", r=1)
    c.hline(3, top, 6, "m")
    c.hline(3, top + 1, 6, "m")
    c.px(1, top, "R")
    c.outline("k")
    if ringing:
        # Щель между трубкой и корпусом — трубка в воздухе.
        for x in range(2, 10):
            if c.get(x, 4) and x not in (0, 11):
                c.px(x, 4, CLEAR)
    c.save(name)


def parcel():
    """Посылка: крафт-коробка сверху-спереди, скотч, красная наклейка с адресом."""
    c = Canvas(12, 10)
    c.rect(0, 0, 12, 3, "N")
    c.rect(0, 3, 12, 7, "n")
    c.hline(0, 3, 12, "t")
    c.vline(11, 3, 7, "t")
    # Скотч по крышке и вниз по передней стенке.
    c.vline(5, 0, 10, "y")
    c.vline(6, 0, 10, "Y")
    c.hline(0, 1, 12, "Y")
    # Наклейка с адресом.
    c.rect(1, 5, 3, 3, "w")
    c.hline(1, 5, 3, "R")
    c.px(2, 7, "G")
    c.outline("k")
    c.save("parcel")


def scooter():
    """Мопед курьера: маленькие колёса, оранжевый кожух, сиденье, руль и красный ящик для заказов сзади."""
    c = Canvas(24, 14)
    for cx in (5, 19):
        c.ellipse(cx, 10.5, 3.2, 3.2, "k")
        c.ellipse(cx, 10.5, 1.8, 1.8, "G")
        c.px(cx, 10, "l")
    # Задний кожух и подножка.
    c.ellipse(7, 8, 5, 2.6, "o")
    c.hline(4, 6, 6, "y")
    c.rect(9, 9, 7, 2, "G")
    c.hline(9, 9, 7, "l")
    # Сиденье.
    c.round_rect(5, 4, 7, 2, "K", r=1)
    # Передний щиток и руль с фарой.
    c.line(15, 9, 17, 3, "o")
    c.line(16, 9, 18, 3, "o")
    c.line(17, 9, 19, 4, "y")
    c.line(18, 3, 19, 1, "G")
    c.hline(17, 1, 4, "K")
    c.px(20, 3, "Y")
    c.px(21, 3, "Y")
    # Ящик для заказов на багажнике.
    c.rect(0, 0, 6, 5, "R")
    c.hline(0, 2, 6, "w")
    c.hline(0, 4, 6, "r")
    c.outline("k")
    c.save("scooter")


def ico_scooter():
    """🛵 значок мопеда 14×14."""
    c = Canvas(14, 14)
    for cx in (3, 11):
        c.ellipse(cx, 10, 2.2, 2.2, "K")
        c.px(cx, 10, "l")
    c.ellipse(4.5, 7.5, 3, 2, "o")
    c.rect(6, 8, 4, 2, "G")
    c.hline(3, 5, 4, "K")
    c.line(9, 9, 11, 4, "o")
    c.line(10, 9, 12, 4, "o")
    c.hline(10, 3, 3, "K")
    c.px(12, 5, "Y")
    c.rect(0, 2, 3, 3, "R")
    c.outline("k")
    c.save("ico_scooter")


def ico_van():
    """🚐 значок фургончика 14×14: оранжевый кузов, окно кабины, колёса."""
    c = Canvas(14, 14)
    c.round_rect(0, 3, 13, 7, "o", r=1)
    c.rect(9, 4, 3, 3, "c")
    c.px(9, 4, "w")
    c.hline(0, 8, 13, "y")
    c.rect(2, 5, 4, 2, "N")
    c.px(12, 8, "Y")
    for cx in (3, 10):
        c.ellipse(cx, 10.5, 1.8, 1.8, "K")
        c.px(cx, 10, "l")
    c.outline("k")
    c.save("ico_van")


def hair_long(p, hair):
    """Длинные волосы до плеч (мама)."""
    p.ellipse(16, 8, 9, 5.5, hair)
    p.rect(7, 8, 4, 14, hair)
    p.rect(21, 8, 4, 14, hair)
    p.px(13, 6, hair)


def hair_messy(p, hair):
    """Лохматый студент: вихры торчат."""
    p.ellipse(16, 8, 8.5, 5, hair)
    for x, y in ((9, 4), (13, 2), (18, 2), (22, 4)):
        p.ellipse(x, y, 2, 2, hair)
    p.rect(8, 8, 2, 5, hair)
    p.rect(22, 8, 2, 5, hair)


def headset(p, skin, hair, shirt):
    """Наушник с микрофоном — звонят из офиса."""
    p.rect(7, 12, 2, 4, rgb("#3a4466"))
    p.line(8, 16, 13, 20, rgb("#3a4466"))
    p.px(13, 20, rgb("#e43b44"))


def scarf(p, skin, hair, shirt):
    p.rect(10, 24, 12, 3, rgb("#e43b44"))
    p.px(12, 25, rgb("#fee761"))
    p.px(18, 25, rgb("#fee761"))


def callers():
    """Портреты тех, кто звонит (номер = HomeOrder.caller, имена — delivery.caller<N>)."""
    portrait("caller0", "#b55088", "#f2d3ab", "#d8d8e0", "#68386c", hair_bun, glasses)
    portrait("caller1", "#0099db", "#eec39a", "#733e39", "#63c74d", hair_messy)
    portrait("caller2", "#f6757a", "#f2d3ab", "#b86f50", "#feae34", hair_long, scarf)
    portrait("caller3", "#3e8948", "#d9a066", "#4a2c1a", "#5a6988", hair_bald, mustache)
    portrait("caller4", "#5a6988", "#eec39a", "#181425", "#ffffff", hair_slick, lambda p, *a: (tie(p, *a), headset(p, *a)))
    portrait("caller5", "#feae34", "#e4a672", "#c0cbdc", "#8f563b", hair_cap, beard)


def main():
    phone("phone", False)
    phone("phone_ring", True)
    parcel()
    scooter()
    ico_scooter()
    ico_van()
    callers()


if __name__ == "__main__":
    main()
    # Значки в надписях зала берутся из общего атласа — пересобираем его.
    import icons

    icons.atlas()
