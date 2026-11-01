"""«Заречье» (src/game/zarechye.ts, src/scenes/zarechye.ts): второй район у реки.

Улица у реки вместо сквера за дорогой: за дальним тротуаром — гранитный парапет набережной, вода,
на том берегу — деревянные дома с наличниками, ивы, пристань, мост через реку. Летом к пристани
подходит теплоход с туристами. Вид сверху-спереди, как у остальной улицы.

  zar_water        32×16 — плитка воды: полосы глубины и рябь (игра кладёт её tileSprite'ом);
  zar_bank         32×10 — плитка гранитного парапета набережной (наш берег);
  zar_shore        32×12 — плитка того берега: травяной склон с камышом у воды;
  zar_bridge       44×150 — мост через реку сверху: настил, перила, фонари, быки в воде;
  zar_house_0…2    44×40 — дома на том берегу: скатная крыша, бревенчатый фасад, наличники;
  zar_pier         40×22 — деревянная пристань на сваях: тумбы, спасательный круг;
  zar_willow       34×36 — плакучая ива у воды;
  zar_tourboat     72×24 — речной трамвайчик: белый корпус, синяя полоса, окна салона, флажок;
  zar_fish_sign    20×12 — вывеска-рыба над лавкой Семёна Сома;
  zar_offer.png    240×112 — картинка к утренней карточке «В Заречье пустует торговая улица».

Портреты (общий portrait() из sprites.py): Семён Сом — с настроениями для диалогов, жители Заречья —
Нина Петровна, Егор, Степан Ильич, Лида, Толик.

    python3 art/zarechye.py
"""

import random

from PIL import Image

import sprites
from premium import H, lit, mix
from sprites import Canvas, DETAIL, OUT

INK = H("#181425")
WATER_DEEP = H("#124e89")
WATER = H("#2a6fb0")
WATER_HI = H("#5fa8e0")
FOAM = H("#c8e8ff")
GRANITE = H("#8b9bb4")
GRANITE_HI = H("#c0cbdc")
GRANITE_LO = H("#5a6988")
GRASS = H("#63c74d")
GRASS_LO = H("#3e8948")
REED = H("#a5b84a")
WOOD = H("#b86f50")
WOOD_LO = H("#8f563b")
WOOD_HI = H("#e4a672")
WARM = H("#ffd890")


def big(c, name):
    """Рисовали в точках мира — увеличить в DETAIL раз без сглаживания и сохранить."""
    out = Canvas(c.w * DETAIL, c.h * DETAIL)
    out.img = c.img.resize((c.w * DETAIL, c.h * DETAIL), Image.NEAREST)
    out.save(name)
    return out


def water():
    """Вода в полную детализацию: полосы глубины (дальше от берега — темнее) и рябь черточками."""
    w, h = 32 * DETAIL, 16 * DETAIL
    c = Canvas(w, h)
    for y in range(h):
        t = y / (h - 1)
        c.hline(0, y, w, mix(WATER, WATER_DEEP, 0.15 + 0.25 * abs(0.5 - t)))
    rnd = random.Random(7)
    for _ in range(9):
        x = rnd.randrange(w)
        y = rnd.randrange(2, h - 2)
        n = rnd.randrange(3, 7)
        for k in range(n):
            c.px((x + k) % w, y, WATER_HI)
        c.px((x + 1) % w, y - 1, FOAM)
    for _ in range(5):
        x = rnd.randrange(w)
        y = rnd.randrange(h)
        c.px(x, y, lit(WATER_DEEP, -0.15))
        c.px((x + 1) % w, y, lit(WATER_DEEP, -0.15))
    c.save("zar_water")


def bank():
    """Парапет набережной: тёсаные гранитные блоки, светлая верхняя грань, тень в воду."""
    c = Canvas(32, 10)
    c.rect(0, 0, 32, 4, GRANITE_HI)
    c.hline(0, 0, 32, lit(GRANITE_HI, 0.3))
    c.rect(0, 4, 32, 4, GRANITE)
    for x in (0, 11, 22):
        c.vline(x, 0, 4, GRANITE_LO)
    for x in (5, 16, 27):
        c.vline(x, 4, 4, GRANITE_LO)
    c.hline(0, 3, 32, GRANITE_LO)
    c.hline(0, 7, 32, GRANITE_LO)
    # Тень парапета на воде.
    c.rect(0, 8, 32, 2, (18, 52, 100, 150))
    c.speckle(0, 0, 32, 7, [lit(GRANITE, -0.1), lit(GRANITE_HI, -0.08)], 14, 3)
    big(c, "zar_bank")


def shore():
    """Тот берег: трава на склоне, у воды камыш и песок."""
    c = Canvas(32, 12)
    c.rect(0, 0, 32, 12, GRASS)
    c.rect(0, 0, 32, 3, H("#d8c890"))
    c.hline(0, 0, 32, H("#e8dcb0"))
    c.hline(0, 3, 32, GRASS_LO)
    rnd = random.Random(11)
    for x in range(0, 32, 3):
        hgt = rnd.randrange(3, 6)
        xx = x + rnd.randrange(2)
        c.vline(xx, 3 - hgt + 3, hgt, REED)
        c.px(xx, 3 - hgt + 3, H("#733e39"))
    c.speckle(0, 4, 32, 8, [GRASS_LO, H("#98c95a")], 20, 5)
    big(c, "zar_shore")


def bridge():
    """Мост сверху: асфальтовый настил с разметкой, чугунные перила, фонари, быки с бурунами."""
    w, h = 44, 150
    c = Canvas(w, h)
    # Быки — каменные опоры, видны по бокам настила, вода обтекает их.
    for y in (34, 74, 114):
        c.rect(2, y, 40, 10, GRANITE)
        c.hline(2, y, 40, GRANITE_HI)
        c.hline(2, y + 9, 40, GRANITE_LO)
        for x in (0, 41):
            c.rect(x, y + 2, 3, 6, FOAM)
    # Настил.
    c.rect(6, 0, 32, h, H("#5a6070"))
    c.rect(6, 0, 3, h, H("#a8a8a0"))
    c.rect(35, 0, 3, h, H("#a8a8a0"))
    for y in range(4, h, 12):
        c.rect(21, y, 2, 6, H("#e6e1d6"))
    c.speckle(9, 0, 26, h, [H("#4a4f66"), H("#6a7080")], 120, 9)
    # Перила: столбики и поручень.
    for x in (5, 38):
        c.vline(x, 0, h, H("#262b44"))
        for y in range(2, h, 6):
            c.rect(x - 1 + (1 if x > 20 else 0), y, 2, 2, H("#3a4466"))
    # Фонари на мосту.
    for y in (20, 60, 100, 140):
        for x in (3, 40):
            c.rect(x, y, 2, 2, H("#262b44"))
            c.px(x, y - 1, WARM)
            c.px(x + 1, y - 1, WARM)
    big(c, "zar_bridge")


HOUSES = [
    # (крыша, стена, наличники, дверь)
    (H("#a22633"), H("#c28569"), H("#ffffff"), H("#733e39")),
    (H("#3e8948"), H("#e4a672"), H("#5fcde4"), H("#8f563b")),
    (H("#124e89"), H("#ead4aa"), H("#f6757a"), H("#733e39")),
]


def house(i):
    """Деревянный дом на том берегу: двускатная крыша, бревенчатый сруб, окна с резными наличниками."""
    roof, wall, trim, door = HOUSES[i]
    w, h = 44, 40
    c = Canvas(w, h)
    # Крыша — сверху видно оба ската, конёк посередине.
    top = 22
    for y in range(top):
        inset = max(0, 6 - y // 2)
        c.hline(inset, y, w - inset * 2, lit(roof, 0.12) if y < top // 2 else roof)
    c.hline(4, top // 2, w - 8, lit(roof, -0.3))
    for x in range(8, w - 8, 4):
        c.vline(x, 2, top - 4, lit(roof, -0.1))
    # Печная труба.
    c.rect(w - 14, 3, 4, 6, H("#8b9bb4"))
    c.hline(w - 14, 3, 4, H("#c0cbdc"))
    # Сруб: брёвна полосами.
    c.rect(2, top, w - 4, h - top, wall)
    for y in range(top + 1, h, 3):
        c.hline(2, y, w - 4, lit(wall, -0.18))
    c.hline(2, top, w - 4, lit(roof, -0.4))
    # Окна с наличниками.
    for x in (7, 29):
        c.rect(x - 1, top + 3, 9, 9, trim)
        c.rect(x, top + 5, 7, 6, H("#3a4466"))
        c.px(x + 1, top + 6, H("#8fd3ff"))
        c.vline(x + 3, top + 5, 6, trim)
        c.hline(x - 2, top + 3, 11, trim)
        c.px(x + 3, top + 2, trim)
    # Дверь с крыльцом.
    c.rect(19, top + 6, 6, h - top - 7, door)
    c.px(23, top + 11, H("#fee761"))
    c.rect(17, h - 2, 10, 2, WOOD_HI)
    c.outline(INK)
    big(c, f"zar_house_{i}")


def pier():
    """Пристань: дощатый настил на сваях, тумбы для швартовки, спасательный круг."""
    w, h = 40, 22
    c = Canvas(w, h)
    for x in (3, 13, 26, 36):
        c.rect(x, 12, 2, 10, WOOD_LO)
        c.px(x, 21, FOAM)
        c.px(x + 1, 21, FOAM)
    c.rect(0, 2, w, 11, WOOD)
    for x in range(0, w, 5):
        c.vline(x, 2, 11, WOOD_LO)
    c.hline(0, 2, w, WOOD_HI)
    c.hline(0, 12, w, lit(WOOD_LO, -0.3))
    for x in (4, 33):
        c.rect(x, 0, 3, 4, H("#3a4466"))
        c.hline(x, 0, 3, H("#8b9bb4"))
    # Спасательный круг.
    c.ellipse(20, 7, 3.5, 3.5, H("#e43b44"))
    c.ellipse(20, 7, 1.6, 1.6, WOOD)
    c.px(17, 7, H("#ffffff"))
    c.px(23, 7, H("#ffffff"))
    c.px(20, 4, H("#ffffff"))
    c.px(20, 10, H("#ffffff"))
    c.outline(INK)
    big(c, "zar_pier")


def willow():
    """Плакучая ива: ветви свисают до воды, ствол чуть наклонён к реке."""
    w, h = 34, 36
    c = Canvas(w, h)
    c.rect(15, 20, 4, 16, H("#733e39"))
    c.vline(15, 20, 16, H("#4a2c1a"))
    c.ellipse(17, 12, 15, 11, H("#3e8948"))
    c.ellipse(15, 10, 11, 8, H("#63c74d"))
    rnd = random.Random(4)
    for x in range(3, 32, 2):
        n = rnd.randrange(10, 20)
        c.vline(x, 12, n, H("#3e8948") if x % 4 else H("#63c74d"))
    c.speckle(4, 3, 26, 14, [H("#98c95a"), H("#3e8948")], 30, 8)
    c.outline(INK)
    big(c, "zar_willow")


def tourboat():
    """Речной трамвайчик: белый корпус, синяя ватерлиния, салон с окнами, флажок на корме."""
    w, h = 72, 24
    c = Canvas(w, h)
    # Корпус с острым носом справа.
    for y in range(12, 22):
        inset = max(0, y - 17)
        c.hline(2 + inset, y, w - 10 - inset * 2 + (22 - y), H("#ffffff"))
    c.hline(2, 18, w - 6, H("#124e89"))
    c.hline(3, 19, w - 8, H("#0099db"))
    c.hline(4, 21, w - 14, lit(H("#c0cbdc"), -0.2))
    # Салон.
    c.rect(10, 5, 44, 8, H("#f2f4f8"))
    c.hline(10, 4, 44, H("#e43b44"))
    c.hline(9, 3, 46, H("#a22633"))
    for x in range(12, 52, 6):
        c.rect(x, 7, 4, 3, H("#3a4466"))
        c.px(x, 7, H("#8fd3ff"))
    # Рубка и флажок.
    c.rect(54, 7, 8, 6, H("#ffffff"))
    c.rect(55, 8, 6, 2, H("#3a4466"))
    c.vline(6, 0, 12, H("#262b44"))
    c.rect(7, 0, 5, 3, H("#e43b44"))
    c.hline(7, 1, 5, H("#ffffff"))
    c.outline(INK)
    # Буруны у носа.
    for k in range(4):
        c.px(w - 4 + k % 2, 20 + k // 2, FOAM)
    big(c, "zar_tourboat")


def fish_sign():
    """Вывеска-рыба над лавкой Сома: серебристая рыбина с плавниками на цепочках."""
    c = Canvas(20, 12)
    c.vline(6, 0, 3, H("#5a6988"))
    c.vline(13, 0, 3, H("#5a6988"))
    c.ellipse(9, 7, 7, 3.5, H("#c0cbdc"))
    c.ellipse(8, 6, 5, 1.6, H("#dfe6ef"))
    c.stamp(["W..", "WW.", "WWW", "WW.", "W.."], 15, 5)
    c.px(4, 6, INK)
    c.hline(7, 9, 4, H("#8b9bb4"))
    c.outline(INK)
    big(c, "zar_fish_sign")


def offer():
    """Картинка к карточке: мост через реку, на нашем берегу — пустая лавка «Сдаётся», вдали дома."""
    w, h = 240, 112
    img = Image.new("RGBA", (w, h), (0, 0, 0, 255))
    c = Canvas(w, h)
    c.img = img
    for y in range(44):
        c.hline(0, y, w, mix(H("#8fd3ff"), H("#fff3c4"), y / 44))
    # Дальний берег и дома.
    c.rect(0, 40, w, 10, GRASS_LO)
    for i, x in enumerate(range(8, w, 38)):
        roof = HOUSES[i % 3][0]
        wall = HOUSES[i % 3][1]
        c.rect(x, 30, 22, 12, wall)
        for y in range(8):
            c.hline(x - 2 + y, 22 + y, 26 - 2 * y, roof) if False else c.hline(x + 11 - y - 2, 22 + y, 2 * y + 4, roof)
        c.rect(x + 4, 33, 4, 4, H("#3a4466"))
        c.rect(x + 14, 33, 4, 4, H("#3a4466"))
    # Река.
    for y in range(50, 80):
        c.hline(0, y, w, mix(WATER, WATER_DEEP, (y - 50) / 30))
    rnd = random.Random(3)
    for _ in range(40):
        x, y = rnd.randrange(w), rnd.randrange(52, 78)
        c.hline(x, y, rnd.randrange(3, 8), WATER_HI)
    # Мост аркой.
    for x in range(140, 230):
        t = (x - 185) / 45
        y = int(46 + 10 * t * t)
        c.rect(x, y, 1, 4, GRANITE)
        c.px(x, y, GRANITE_HI)
    for x in range(144, 228, 8):
        c.vline(x, 40, 7, H("#262b44"))
    c.hline(140, 40, 90, H("#262b44"))
    # Набережная и наш берег.
    c.rect(0, 80, w, 6, GRANITE_HI)
    c.hline(0, 85, w, GRANITE_LO)
    c.rect(0, 86, w, 26, H("#c8c0b0"))
    # Пустая лавка «Сдаётся».
    c.rect(30, 84, 70, 28, H("#ead4aa"))
    c.rect(26, 80, 78, 6, H("#8f563b"))
    for k, x in enumerate(range(28, 102, 6)):
        c.rect(x, 86, 6, 4, H("#e43b44") if k % 2 == 0 else H("#ffffff"))
    c.rect(38, 92, 22, 14, H("#3a4466"))
    c.rect(66, 94, 12, 18, H("#733e39"))
    c.rect(44, 96, 12, 6, H("#fee761"))
    c.hline(46, 98, 8, H("#a22633"))
    c.hline(46, 100, 6, H("#a22633"))
    # Ива и лодка.
    c.ellipse(140, 74, 14, 10, H("#3e8948"))
    for x in range(128, 154, 2):
        c.vline(x, 74, 10, H("#63c74d"))
    c.rect(139, 80, 3, 20, H("#733e39"))
    c.ellipse(110, 66, 10, 2.5, H("#b86f50"))
    c.hline(102, 65, 16, H("#e4a672"))
    out = img.resize((w * 2, h * 2), Image.NEAREST)
    out.save(OUT / "zar_offer.png")


def portraits():
    p = sprites
    # Семён Сом — хозяин рыбной лавки: седые усы, кепка речника, свитер грубой вязки.
    for mood in (None, "happy", "angry", "surprised"):
        p.portrait("zar_som", "#124e89", "#e4a672", "#c0cbdc", "#5a6988", p.hair_cap, lambda q, *a: (p.mustache(q, *a), p.beard(q, *a)), mood)
    p.portrait("zar_nina", "#0099db", "#f2d3ab", "#d8d8e0", "#124e89", p.hair_bun, p.glasses)
    p.portrait("zar_yegor", "#63c74d", "#eec39a", "#4a2c1a", "#3e8948", p.hair_curly)
    p.portrait("zar_stepan", "#8f563b", "#d9a066", "#8b9bb4", "#733e39", p.hair_cap, p.mustache)
    p.portrait("zar_lida", "#f6757a", "#f2d3ab", "#e43b44", "#b55088", p.hair_scarf)
    p.portrait("zar_tolik", "#feae34", "#eec39a", "#b86f50", "#f77622", p.hair_cap)


def main():
    water()
    bank()
    shore()
    bridge()
    for i in range(len(HOUSES)):
        house(i)
    pier()
    willow()
    tourboat()
    fish_sign()
    offer()
    portraits()


if __name__ == "__main__":
    main()
