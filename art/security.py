"""Ночная охрана (src/game/watch.ts): пёс Бобик с будкой, участковый и три картинки утренних новостей.

Бобик — рыжая дворняга с белой грудкой и тёмными висячими ушами: спит у будки (24×14),
сидит настороже и виляет хвостом (16×20, два кадра), лает (16×20). Будка 28×26 с миской.
Участковый — портрет 32×32 с эмоциями. Новости 128×72: взлом ночью, Бобик прогнал вора,
сторож задержал вора.

    python3 art/sprites.py
"""

import random

from sprites import Canvas, mustache, portrait, rgb, shade, shadowed
from news import W, H, C, mix, person, sky, skyline

FUR, FUR_D, FUR_L, CHEST, EAR = "B", "a", "n", "N", "b"


def bobik_lie():
    """Спит, положив морду на лапы: мордой влево."""
    c = Canvas(24, 14)
    c.ellipse(14, 8.5, 8.5, 4.2, FUR)
    c.ellipse(15, 10.5, 6.5, 2.2, FUR_L)
    c.ellipse(17, 6.5, 5, 2, FUR_L)
    # Хвост калачиком.
    c.line(22, 9, 23, 6, FUR)
    c.px(22, 5, FUR_L)
    # Голова на лапах.
    c.ellipse(6, 8, 4.6, 3.6, FUR)
    c.ellipse(3, 10, 2.6, 1.8, CHEST)
    c.px(0, 9, "k")
    c.rect(1, 12, 6, 2, CHEST)
    c.hline(4, 7, 2, "k")
    c.rect(7, 4, 2, 5, EAR)
    c.px(8, 9, EAR)
    c.hline(10, 12, 4, FUR_D)
    c.outline("k")
    return c


def bobik_sit(tail, bark=False):
    """Сидит мордой к нам: белая грудка, красный ошейник с жетоном; bark — пасть открыта."""
    c = Canvas(16, 20)
    c.ellipse(8, 14.5, 5, 5, FUR)
    c.ellipse(8, 13.5, 2.6, 3.6, CHEST)
    c.line(13, 17, 15, tail, FUR)
    c.rect(4, 17, 3, 3, CHEST)
    c.rect(9, 17, 3, 3, CHEST)
    c.vline(7, 17, 3, FUR_D)
    c.ellipse(8, 6.5, 4.8, 4.2, FUR)
    c.ellipse(8, 8.8, 2.8, 2.2, CHEST)
    c.rect(2, 3, 3, 6, EAR)
    c.rect(11, 3, 3, 6, EAR)
    c.px(2, 9, EAR)
    c.px(13, 9, EAR)
    for x in (6, 10):
        c.px(x, 6, "k")
    c.rect(7, 7, 3, 1, "k")
    if bark:
        c.rect(7, 9, 3, 2, "k")
        c.px(8, 10, "R")
    else:
        c.px(8, 9, shade(rgb("#ead4aa"), 0.7))
    c.hline(4, 11, 9, "R")
    c.px(8, 12, "Y")
    c.outline("k")
    return c


def kennel():
    """Будка: доски, двускатная крыша, табличка с косточкой, миска рядом."""
    c = Canvas(28, 26)
    body = Canvas(28, 26)
    body.rect(3, 11, 20, 13, "n")
    for x in range(5, 23, 4):
        body.vline(x, 12, 12, "B")
    body.hline(3, 23, 20, "a")
    for y in range(11):
        body.hline(12 - y - 1, y + 1, 2 * y + 3, "r" if y % 3 else "m")
    body.hline(0, 11, 26, "m")
    body.ellipse(13, 19.5, 4.5, 5, "k")
    body.rect(9, 20, 9, 4, "k")
    body.ellipse(13, 19.5, 3, 3.5, "K")
    body.rect(10, 13, 7, 2, "N")
    body.hline(12, 13, 3, "W")
    body.px(11, 14, "W")
    body.px(15, 14, "W")
    body.outline("k")
    c = shadowed(body, 14, 24, 13, 2)
    bowl = Canvas(28, 26)
    bowl.ellipse(24, 23.5, 3, 1.6, "U")
    bowl.hline(22, 22, 5, "u")
    bowl.px(23, 22, "a")
    bowl.px(25, 22, "a")
    bowl.outline("k")
    c.img.alpha_composite(bowl.img)
    return c


def police_cap(p, hair):
    """Фуражка: синяя тулья, красный околыш, чёрный козырёк, золотая кокарда."""
    p.ellipse(16, 6, 11, 4, rgb("#3a4466"))
    p.rect(6, 7, 20, 3, rgb("#e43b44"))
    p.rect(8, 10, 16, 2, rgb("#181425"))
    p.rect(15, 6, 3, 3, rgb("#feae34"))
    p.rect(8, 12, 2, 3, rgb("#4a2c1a"))
    p.rect(22, 12, 2, 3, rgb("#4a2c1a"))


def police_extras(p, skin, hair, shirt):
    """Погоны, усы, значок."""
    mustache(p, skin, rgb("#4a2c1a"), shirt)
    p.rect(5, 26, 5, 2, rgb("#feae34"))
    p.rect(22, 26, 5, 2, rgb("#feae34"))
    p.rect(18, 28, 2, 3, rgb("#fee761"))


def thief(c, x, y):
    """Вор: полосатая тельняшка, чёрная шапка-маска с прорезью для глаз."""
    person(c, x, y, C("#181425"), skin=C("#262b44"), hair=C("#181425"), pants=C("#262b44"))
    for yy in range(y + 7, y + 13, 2):
        c.hline(x - 1, yy, 9, C("#c0cbdc"))
    c.hline(x + 1, y + 3, 5, C("#eec39a"))
    c.px(x + 2, y + 3, C("#181425"))
    c.px(x + 4, y + 3, C("#181425"))


def night_street(c, seed):
    sky(c, C("#181425"), C("#3a4466"), 52)
    rnd = random.Random(seed)
    for _ in range(30):
        c.px(rnd.randrange(W), rnd.randrange(0, 26), C("#c0cbdc"))
    c.ellipse(108, 12, 6, 6, C("#ead4aa"))
    c.ellipse(110, 11, 5, 5, C("#262b44"))
    skyline(c, 52, C("#262b44"), seed, lit=C("#3a4466"), tall=(12, 26))
    c.rect(0, 52, W, 20, C("#3a4466"))
    c.hline(0, 52, W, C("#5a6988"))


def shop_front(c, x, door_open=False):
    """Фасад магазинчика: стены, вывеска, дверь."""
    c.rect(x, 22, 60, 32, C("#4a3b52"))
    c.rect(x - 2, 20, 64, 4, C("#262b44"))
    c.rect(x + 8, 12, 44, 8, C("#b55088"))
    c.hline(x + 10, 15, 40, C("#f6757a"))
    c.rect(x + 4, 30, 14, 12, C("#262b44"))
    c.rect(x + 42, 30, 14, 12, C("#262b44"))
    c.rect(x + 23, 30, 14, 22, C("#181425") if door_open else C("#5a6988"))
    if door_open:
        c.rect(x + 34, 30, 5, 22, C("#8b9bb4"))
        c.line(x + 35, 41, x + 38, 39, C("#c0cbdc"))


def news_burglary():
    """Взлом: дверь распахнута, вор с мешком и фонариком убегает, коробки разбросаны."""
    c = Canvas(W, H)
    night_street(c, 71)
    shop_front(c, 14, door_open=True)
    for x, y in ((40, 56), (50, 60), (32, 62)):
        c.rect(x, y, 7, 5, C("#b86f50"))
        c.hline(x, y + 2, 7, C("#8f563b"))
    # Вор в шапке-маске с мешком.
    thief(c, 92, 40)
    c.ellipse(104, 48, 6, 6, C("#c0cbdc"))
    c.hline(100, 44, 5, C("#8b9bb4"))
    # Луч фонарика.
    for k in range(12):
        c.line(90, 49, 64 + k, 66, mix(C("#fee761"), C("#3a4466"), 0.55))
    c.rect(88, 48, 3, 2, C("#fee761"))
    c.save("news_burglary")


def news_robbery():
    """Ограбление с заложниками: у магазина полиция с мигалками и тёмный фургон ОМОНа, в витрине — грабители."""
    c = Canvas(W, H)
    night_street(c, 59)
    shop_front(c, 6)
    # Грабители в масках за витриной.
    thief(c, 22, 30)
    thief(c, 40, 30)
    # Фургон ОМОНа: тёмный, с решёткой на окнах.
    c.rect(66, 40, 34, 16, C("#3a4466"))
    c.rect(70, 33, 18, 8, C("#3a4466"))
    c.rect(72, 35, 6, 4, C("#8b9bb4"))
    c.rect(80, 35, 6, 4, C("#8b9bb4"))
    for x in range(73, 86, 2):
        c.vline(x, 35, 4, C("#262b44"))
    c.hline(66, 47, 34, C("#fee761"))
    for x in (72, 94):
        c.ellipse(x, 56, 3.5, 3.5, C("#181425"))
    # Полицейская машина с мигалкой.
    c.rect(98, 46, 30, 10, C("#ffffff"))
    c.rect(103, 39, 20, 8, C("#ffffff"))
    c.rect(105, 41, 7, 5, C("#5a6988"))
    c.rect(114, 41, 7, 5, C("#5a6988"))
    c.hline(98, 50, 30, C("#124e89"))
    c.ellipse(110, 35, 9, 3.5, mix(C("#0099db"), C("#3a4466"), 0.6))
    c.ellipse(116, 35, 9, 3.5, mix(C("#e43b44"), C("#3a4466"), 0.65))
    c.rect(109, 36, 4, 3, C("#0099db"))
    c.rect(113, 36, 4, 3, C("#e43b44"))
    for x in (104, 122):
        c.ellipse(x, 56, 3.5, 3.5, C("#181425"))
    c.save("news_robbery")


def news_dog():
    """Бобик лает у будки, вор удирает через забор, бросив мешок."""
    c = Canvas(W, H)
    night_street(c, 83)
    shop_front(c, 8)
    dog = bobik_sit(9, bark=True).img.resize((24, 30))
    c.img.alpha_composite(dog, (70, 38))
    for i, (x, y) in enumerate(((95, 38), (99, 34), (92, 32))):
        c.hline(x, y, 4 - i, C("#ffffff"))
    # Забор и вор на нём.
    for x in range(104, W, 5):
        c.rect(x, 40, 3, 14, C("#8f563b"))
    c.hline(104, 44, W - 104, C("#733e39"))
    thief(c, 112, 24)
    c.ellipse(58, 64, 5, 4, C("#c0cbdc"))
    c.hline(55, 61, 5, C("#8b9bb4"))
    c.save("news_dog")


def news_watchman():
    """Сторож с фонарём держит вора, рядом мигалка полицейской машины."""
    c = Canvas(W, H)
    night_street(c, 97)
    shop_front(c, 4)
    # Полицейская машина.
    c.rect(86, 46, 40, 10, C("#ffffff"))
    c.rect(92, 39, 26, 8, C("#ffffff"))
    c.rect(95, 41, 9, 5, C("#5a6988"))
    c.rect(106, 41, 9, 5, C("#5a6988"))
    c.hline(86, 50, 40, C("#124e89"))
    c.rect(100, 36, 4, 3, C("#0099db"))
    c.rect(104, 36, 4, 3, C("#e43b44"))
    for x in (93, 118):
        c.ellipse(x, 56, 3.5, 3.5, C("#181425"))
    c.ellipse(101, 35, 9, 3.5, mix(C("#0099db"), C("#3a4466"), 0.6))
    c.ellipse(107, 35, 9, 3.5, mix(C("#e43b44"), C("#3a4466"), 0.65))
    c.rect(100, 36, 4, 3, C("#0099db"))
    c.rect(104, 36, 4, 3, C("#e43b44"))
    # Сторож в ушанке и ватнике.
    person(c, 62, 36, C("#5a6988"), hair=C("#c0cbdc"), pants=C("#262b44"), hat=C("#8f563b"))
    c.rect(61, 34, 9, 3, C("#8f563b"))
    c.rect(70, 44, 3, 2, C("#fee761"))
    # Вор.
    thief(c, 74, 38)
    c.hline(68, 45, 8, C("#5a6988"))
    c.save("news_watchman")


# Должно совпадать с WATCHMAN в src/scenes/StoreScene.ts.
WATCHMAN = {"skin": 0xEEC39A, "shirt": 0x5A6988, "pants": 0x262B44, "hair": 0xC0CBDC, "hat": 0x8F563B, "outfit": 0x7A8A5A}


def watchman_card():
    """Сторож Михалыч в полный рост на ночной подложке: ушанка, ватник, усы, фонарик."""
    from PIL import Image
    from costumes import tinted

    w = WATCHMAN
    card = Canvas(40, 48)
    for y in range(48):
        card.hline(0, y, 40, mix(C("#262b44"), C("#5a6988"), y / 47))
    card.ellipse(31, 8, 4, 4, C("#ead4aa"))
    card.ellipse(33, 7, 3.4, 3.4, mix(C("#262b44"), C("#5a6988"), 0.15))
    person = Image.new("RGBA", (40, 44), (0, 0, 0, 0))

    def put(name, tint=None, big=False):
        person.alpha_composite(tinted(name, tint), (0, 0) if big else (8, 8))

    put("p_legs0", w["pants"])
    put("p_shirt", w["shirt"])
    put("w_outfit_cardigan", w["outfit"])
    put("p_skin", w["skin"])
    put("w_face_mustache", w["hair"])
    put("p_hair_short", w["hair"])
    put("w_hat_ushanka", w["hat"], True)
    put("w_prop_flashlight", None, True)
    card.img.alpha_composite(person, (0, 3))
    card.save("watchman_card")


def main():
    watchman_card()
    bobik_lie().save("bobik_lie")
    for i, tail in enumerate((12, 18)):
        bobik_sit(tail).save(f"bobik_sit{i}")
    bobik_sit(12, bark=True).save("bobik_bark")
    kennel().save("kennel")
    for mood in (None, "happy", "sad", "surprised"):
        portrait("police", "#124e89", "#eec39a", "#262b44", "#3a4466", police_cap, police_extras, mood)
    news_burglary()
    news_robbery()
    news_dog()
    news_watchman()


if __name__ == "__main__":
    main()
