"""Питомцы за звёзды (src/game/pets.ts): шесть зверей, у каждого 4–6 кадров. Только для красоты.

  pet_parrot_*   — зелёный попугай на латунной жёрдочке с поилкой (18×34): сидит, наклоняет голову,
                   «говорит» (клюв открыт), спит (голова в пёрышках), радуется (крылья вверх);
  pet_hamster_*  — хомяк в клетке с колесом (26×24): бежит в колесе (три кадра), сидит с семечкой, спит клубком;
  pet_corgi_*    — рыжий корги на подстилке (30×18): спит (два кадра дыхания), поднял голову, виляет попой (два кадра);
  pet_turtle_*   — черепаха (20×12): идёт (два кадра), смотрит, спит в панцире;
  pet_bunny_*    — серая крольчиха на соломенном коврике (18×18): сидит, шевелит носом, прыжок, спит «буханкой»;
  pet_raccoon_*  — енот со склада (16×18): сидит, моргает, машет лапой, спит, свернувшись с полосатым хвостом.

Кадр «_0» каждого — и превью в меню «Питомцы». Свет сверху слева, общий тёмный контур, мягкая тень снизу.
Запуск: python3 art/pets.py (картинки — в public/assets, как у остальных скриптов).
"""

import math

from premium import H, lit
from sprites import Canvas, shadowed

# Попугай: зелёный с жёлто-зелёной грудкой, голубыми маховыми и красным лбом.
PG, PG_D, PG_L = H("#4fb348"), H("#2f7d3a"), H("#a8dc5a")
PB = H("#2f86c8")
PR = H("#e43b44")
BEAK, BEAK_D = H("#f5d27a"), H("#c99a3c")
BRASS, BRASS_D, BRASS_L = H("#d9a441"), H("#9a6a25"), H("#f6dc8a")
WOOD, WOOD_D = H("#8f563b"), H("#5c3426")

# Хомяк: золотистый с белым.
HF, HF_D, HF_L = H("#e3a35a"), H("#b8743a"), H("#f8dcae")
HW = H("#fbf4e6")
PINK = H("#f6a5b0")
CAGE, CAGE_D = H("#c8d2e0"), H("#7d8aa6")
TRAY, TRAY_D = H("#e05a6a"), H("#a23a4c")

# Корги: рыжий, белые лапы и грудка, подстилка в клетку.
CF, CF_D, CF_L = H("#e08a3c"), H("#a85a2a"), H("#f4b26a")
CW = H("#fff6ea")
MAT, MAT_D = H("#5b7fc4"), H("#3f5a99")

# Черепаха: оливковый панцирь с узором, ножки цвета хаки.
SH, SH_D, SH_L = H("#6e8f3a"), H("#4a6328"), H("#a4bf5a")
SKIN, SKIN_D = H("#b5c27a"), H("#7f8c50")

# Крольчиха: серая с белым хвостиком; солома.
BF, BF_D, BF_L = H("#b8b2c4"), H("#857f96"), H("#e2dfe8")
HAY, HAY_D, HAY_L = H("#e8c25a"), H("#b8903a"), H("#f8e39a")

# Енот: серый, чёрная маска, белые брови и мордочка, полосатый хвост.
RF, RF_D, RF_L = H("#8b8c9c"), H("#5d5e70"), H("#b9bac6")
MASK = H("#2a2838")
BOX, BOX_D = H("#c49a6c"), H("#8f6a44")

EYE = H("#181425")
SHINE = H("#ffffff")


def eye(c, x, y, closed=False):
    """Глазок 1×1 с бликом сверху; закрытый — чёрточка."""
    if closed:
        c.hline(x - 1, y, 2, EYE)
    else:
        c.px(x, y, EYE)


def finish(c, name, cx, cy, rx, ry=1.4):
    c.outline("k")
    shadowed(c, cx, cy, rx, ry).save(name)


# ---------------------------------------------------------------- попугай


def perch(c):
    """Латунная стойка: круглое основание, шест, деревянная жёрдочка, поилка справа."""
    c.ellipse(9, 31.5, 6, 1.8, BRASS_D)
    c.ellipse(9, 31, 5, 1.3, BRASS)
    c.hline(6, 30, 3, BRASS_L)
    c.vline(8, 14, 17, BRASS)
    c.vline(9, 14, 17, BRASS_D)
    c.vline(8, 15, 3, BRASS_L)
    c.hline(1, 13, 16, WOOD)
    c.hline(1, 14, 16, WOOD_D)
    # Поилка с водой на конце жёрдочки.
    c.rect(14, 10, 4, 3, CAGE)
    c.hline(15, 10, 2, H("#7ac8f0"))


def parrot(name, head_dx=0, head_dy=0, talk=False, sleep=False, wings=False):
    c = Canvas(18, 34)
    perch(c)
    # Хвост вниз за жёрдочку.
    c.line(6, 12, 5, 19, PB)
    c.line(7, 12, 6, 18, PG_D)
    # Тело.
    c.ellipse(7.5, 8.5, 3.6, 4.6, PG)
    c.ellipse(8.4, 9.5, 2, 3, PG_L)
    if wings:
        # Крылья вверх — радуется.
        c.line(4, 6, 1, 1, PB)
        c.line(4, 7, 2, 2, PG_D)
        c.line(11, 6, 14, 1, PB)
        c.line(11, 7, 13, 2, PG_D)
    else:
        c.ellipse(5.6, 9, 1.6, 3.4, PG_D)
        c.vline(5, 10, 3, PB)
    # Лапки на жёрдочке.
    c.px(7, 13, BEAK_D)
    c.px(9, 13, BEAK_D)
    hx, hy = 9 + head_dx, 3 + head_dy
    if sleep:
        # Голова втянута в пёрышки, глаз закрыт.
        hy += 2
    c.ellipse(hx, hy + 0.5, 3, 2.8, PG)
    c.hline(hx - 2, hy - 2, 3, PR)
    c.px(hx - 1, hy - 3, PR)
    # Клюв крючком.
    c.rect(hx + 2, hy, 2, 2, BEAK)
    c.px(hx + 3, hy + 2, BEAK_D)
    if talk:
        c.px(hx + 2, hy + 2, EYE)
        c.px(hx + 3, hy + 1, PR)
        c.px(hx + 4, hy + 2, BEAK_D)
    eye(c, hx + 1, hy, closed=sleep)
    if not sleep:
        c.px(hx, hy - 1, PG_L)
    finish(c, name, 9, 32, 6)


# ---------------------------------------------------------------- хомяк


def cage_back(c):
    """Поддон и задние прутья клетки."""
    c.rect(1, 19, 24, 4, TRAY)
    c.hline(1, 22, 24, TRAY_D)
    c.hline(2, 19, 22, lit(TRAY, 0.3))
    # Задние прутья — бледные, чтобы колесо и хомяк читались.
    # Внутри клетки — светлый фон (контур тогда идёт только снаружи).
    c.rect(2, 4, 22, 15, H("#e9eef6"))
    back = H("#cdd6e4")
    for x in range(4, 23, 4):
        c.vline(x, 4, 15, back)
    c.hline(2, 4, 22, back)
    # Опилки на дне.
    c.hline(2, 18, 22, HAY)
    for x in range(3, 24, 3):
        c.px(x, 17, HAY_L)


def cage_front(c):
    """Купол и редкие передние прутья поверх хомяка."""
    for x in range(1, 25):
        dy = abs(x - 12.5) // 4
        c.px(x, 3 + int(dy), CAGE)
    c.hline(8, 1, 10, CAGE)
    c.rect(11, 0, 4, 1, CAGE_D)
    for x in (1, 24):
        c.vline(x, 5, 14, CAGE)


def wheel(c, phase):
    """Колесо справа: обод и спицы, повёрнутые на phase."""
    cx, cy, r = 17.5, 11.5, 5.6
    for i in range(36):
        a = i / 36 * math.tau
        c.px(round(cx + math.cos(a) * r - 0.5), round(cy + math.sin(a) * r - 0.5), CAGE_D)
    for k in range(3):
        a = phase + k * math.tau / 3
        c.line(round(cx - 0.5), round(cy - 0.5), round(cx - 0.5 + math.cos(a) * (r - 1)), round(cy - 0.5 + math.sin(a) * (r - 1)), CAGE)
    c.vline(17, 12, 6, CAGE_D)


def hamster_body(c, x, y, run=None, sleep=False):
    """Хомяк мордой вправо: x, y — середина. run — кадр бега (0..2) или None."""
    if sleep:
        c.ellipse(x, y + 1, 3.6, 2.4, HF)
        c.ellipse(x + 1, y + 2, 2, 1.2, HW)
        c.px(x - 2, y - 1, HF_L)
        eye(c, x + 2, y + 1, closed=True)
        c.px(x + 1, y - 1, PINK)
        return
    c.ellipse(x, y, 3.6, 2.8, HF)
    c.ellipse(x + 1, y + 1, 2.4, 1.6, HW)
    c.px(x - 2, y - 2, HF_L)
    # Ушко и глаз, розовый нос.
    c.px(x + 1, y - 3, PINK)
    eye(c, x + 2, y - 1)
    c.px(x + 4, y, PINK)
    if run is not None:
        legs = [(-2, 1), (0, 2), (2, 1)][run % 3]
        c.px(x + legs[0], y + 3, PINK)
        c.px(x + legs[1], y + 3, PINK)
    else:
        c.px(x - 1, y + 3, PINK)
        c.px(x + 2, y + 3, PINK)


def hamster_run(name, frame):
    c = Canvas(26, 24)
    cage_back(c)
    wheel(c, frame * math.tau / 9)
    hamster_body(c, 17, 14 - (frame % 2), run=frame)
    cage_front(c)
    finish(c, name, 13, 22.5, 12)


def hamster_still(name, sleep=False):
    c = Canvas(26, 24)
    cage_back(c)
    wheel(c, 0.3)
    hamster_body(c, 7, 15, sleep=sleep)
    if not sleep:
        # Семечка в лапках.
        c.px(10, 15, H("#3a3a48"))
        c.px(10, 14, HW)
    cage_front(c)
    finish(c, name, 13, 22.5, 12)


# ---------------------------------------------------------------- корги


def corgi(name, head_up=False, breath=0, wag=None, tongue=False):
    """Лежит мордой влево на синей подстилке. wag — кадр виляния (0/1) или None."""
    c = Canvas(30, 18)
    # Подстилка.
    c.ellipse(15, 15, 14, 2.6, MAT_D)
    c.ellipse(15, 14.5, 13, 2, MAT)
    for x in range(4, 27, 4):
        c.px(x, 14, lit(MAT, 0.35))
    # Туловище: рыжая спина, белое брюшко.
    c.ellipse(17, 10.5 - breath * 0.5, 8.5, 3.6 + breath * 0.5, CF)
    c.ellipse(17, 12.5, 7, 1.6, CW)
    c.hline(12, 7 - breath, 9, CF_L)
    # Пушистая попа и хвостик.
    tail = {None: 0, 0: -1, 1: 1}[wag]
    c.ellipse(25 + (tail if wag is not None else 0) * 0.5, 10, 2.6, 2.6, CW)
    if wag is not None:
        c.px(27 + tail, 8, CF)
        c.px(28 + tail, 7, CF_L)
    # Короткие лапки вперёд.
    c.rect(7, 13, 5, 1, CW)
    c.px(7, 13, CF_D)
    hy = 6 if head_up else 9
    # Голова: рыжая, белая проточина и мордочка.
    c.ellipse(6, hy, 4, 3.4, CF)
    c.vline(6, hy - 3, 3, CW)
    c.ellipse(4, hy + 2, 2.6, 1.6, CW)
    c.px(1, hy + 1, EYE)
    # Большие стоячие уши.
    for ex in (4, 8):
        c.line(ex, hy - 3, ex - 1, hy - 6, CF)
        c.line(ex + 1, hy - 3, ex, hy - 6, CF_D)
        c.px(ex, hy - 4, PINK)
    if head_up:
        eye(c, 4, hy - 1)
        eye(c, 7, hy - 1)
        if tongue:
            c.px(3, hy + 3, PR)
    else:
        eye(c, 4, hy - 1, closed=True)
        eye(c, 8, hy - 1, closed=True)
    finish(c, name, 15, 16, 13, 1.6)


# ---------------------------------------------------------------- черепаха


def turtle(name, step=None, hide=False, look=False):
    """Мордой вправо. step — кадр шага (0/1); hide — спит в панцире."""
    c = Canvas(20, 12)
    if not hide:
        a, b = (0, 1) if step != 1 else (1, 0)
        # Ножки: передняя и задняя, по очереди вперёд.
        c.rect(4 - a, 8, 2, 2, SKIN)
        c.rect(13 + b, 8, 2, 2, SKIN)
        c.px(3 - a, 9, SKIN_D)
        c.px(15 + b, 9, SKIN_D)
        # Голова на шейке.
        hy = 4 if look else 6
        c.rect(16, hy + 1, 2, 3 - (hy - 4) // 2, SKIN)
        c.ellipse(18, hy, 2, 1.8, SKIN)
        c.px(18, hy - 1, EYE)
        c.px(19, hy + 1, SKIN_D)
        # Хвостик.
        c.px(2, 7, SKIN_D)
    # Панцирь-купол с узором и светлым ободком.
    c.ellipse(9.5, 6, 7, 4.4, SH)
    c.hline(3, 8, 14, SH_L)
    c.hline(4, 9, 12, SH_D)
    for x, y in ((7, 4), (11, 4), (9, 6), (5, 6), (13, 6)):
        c.px(x, y, SH_D)
        c.px(x + 1, y, SH_D)
    c.hline(7, 2, 5, SH_L)
    finish(c, name, 10, 10.5, 7, 1.2)


# ---------------------------------------------------------------- крольчиха


def bunny(name, nose=0, hop=False, sleep=False):
    """Сидит боком мордой вправо на соломенном коврике."""
    c = Canvas(18, 18)
    c.ellipse(9, 15.5, 8, 2, HAY_D)
    c.ellipse(9, 15, 7, 1.6, HAY)
    for x in range(3, 16, 3):
        c.px(x, 15, HAY_L)
    dy = -3 if hop else 0
    if sleep:
        # «Буханка»: уши лежат на спине, глаза закрыты.
        c.ellipse(8, 11.5, 5.4, 3.4, BF)
        c.ellipse(9, 13, 3.6, 1.4, BF_L)
        c.px(3, 11, SHINE)
        c.ellipse(13, 10.5, 2.6, 2.4, BF)
        c.line(11, 8, 6, 7, BF_D)
        c.line(11, 9, 6, 8, BF)
        eye(c, 14, 10, closed=True)
        c.px(15, 11, PINK)
        finish(c, name, 9, 16, 7, 1.2)
        return
    c.ellipse(7.5, 11 + dy, 4.6, 3.8 if not hop else 3, BF)
    c.ellipse(8.5, 12.5 + dy, 3, 2, BF_L)
    # Хвостик-помпон.
    c.ellipse(3, 11 + dy, 1.4, 1.4, SHINE)
    # Голова и уши торчком.
    c.ellipse(12, 7.5 + dy, 3, 2.8, BF)
    ear = 1 if nose else 0
    c.rect(10, 1 + dy + ear, 2, 5, BF)
    c.vline(11, 2 + dy + ear, 3, PINK)
    c.rect(12, 0 + dy, 2, 5, BF_D)
    c.vline(12, 1 + dy, 3, PINK)
    eye(c, 13, 7 + dy)
    c.px(15, 8 + dy + nose, PINK)
    c.px(13, 9 + dy, BF_L)
    # Лапки.
    if hop:
        c.line(5, 13 + dy, 3, 15 + dy, BF_D)
        c.px(11, 11 + dy, BF_D)
    else:
        c.hline(9, 14, 3, BF_L)
        c.hline(4, 14, 3, BF_D)
    finish(c, name, 9, 16, 7, 1.2)


# ---------------------------------------------------------------- енот


def raccoon(name, blink=False, wave=False, sleep=False):
    """Сидит мордой к нам (выглядывает со склада)."""
    c = Canvas(16, 18)
    if sleep:
        # В картонной коробке, свернулся, хвост сверху.
        c.rect(1, 11, 14, 6, BOX)
        c.hline(1, 16, 14, BOX_D)
        c.vline(14, 10, 7, BOX_D)
        c.ellipse(8, 8, 5.6, 3, RF)
        c.ellipse(5, 7.5, 2.4, 2, RF_L)
        c.hline(3, 7, 4, MASK)
        eye(c, 5, 7, closed=True)
        c.rect(3, 4, 2, 2, RF_D)
        for x in range(8, 14, 2):
            c.vline(x, 6, 3, MASK)
        c.rect(1, 10, 14, 1, BOX_D)
        finish(c, name, 8, 17, 7, 1)
        return
    # Полосатый хвост сбоку.
    for i, y in enumerate(range(9, 16)):
        c.rect(12 + (i > 3), y, 3, 1, MASK if i % 2 else RF_L)
    # Туловище.
    c.ellipse(7.5, 12.5, 5, 4, RF)
    c.ellipse(7.5, 13.5, 3, 2.6, RF_L)
    # Голова: уши, маска, белые брови, нос.
    c.ellipse(7.5, 6, 5, 3.8, RF)
    c.rect(3, 1, 2, 2, RF_D)
    c.rect(10, 1, 2, 2, RF_D)
    c.px(4, 2, RF_L)
    c.px(10, 2, RF_L)
    c.hline(3, 6, 10, MASK)
    c.hline(4, 5, 8, MASK)
    c.hline(4, 4, 2, SHINE)
    c.hline(9, 4, 2, SHINE)
    c.ellipse(7.5, 8, 2, 1.4, SHINE)
    c.px(7, 8, EYE)
    if blink:
        c.hline(4, 6, 2, RF_D)
        c.hline(9, 6, 2, RF_D)
    else:
        c.px(5, 6, SHINE)
        c.px(10, 6, SHINE)
    # Лапки: одна машет.
    if wave:
        c.rect(1, 6, 2, 3, RF_D)
        c.px(1, 5, MASK)
        c.px(2, 5, MASK)
    else:
        c.rect(4, 12, 2, 2, MASK)
    c.rect(9, 12, 2, 2, MASK)
    finish(c, name, 8, 17, 6, 1)


def main():
    parrot("pet_parrot_0")
    parrot("pet_parrot_1", head_dx=-1, head_dy=1)
    parrot("pet_parrot_talk", talk=True)
    parrot("pet_parrot_sleep", sleep=True)
    parrot("pet_parrot_happy", wings=True, talk=True)
    hamster_still("pet_hamster_0")
    for i in range(3):
        hamster_run(f"pet_hamster_run{i}", i)
    hamster_still("pet_hamster_sleep", sleep=True)
    corgi("pet_corgi_0")
    corgi("pet_corgi_1", breath=1)
    corgi("pet_corgi_up", head_up=True, tongue=True)
    corgi("pet_corgi_wag0", head_up=True, wag=0, tongue=True)
    corgi("pet_corgi_wag1", head_up=True, wag=1, tongue=True)
    turtle("pet_turtle_0", look=True)
    turtle("pet_turtle_walk0", step=0)
    turtle("pet_turtle_walk1", step=1)
    turtle("pet_turtle_sleep", hide=True)
    bunny("pet_bunny_0")
    bunny("pet_bunny_1", nose=1)
    bunny("pet_bunny_hop", hop=True)
    bunny("pet_bunny_sleep", sleep=True)
    raccoon("pet_raccoon_0")
    raccoon("pet_raccoon_1", blink=True)
    raccoon("pet_raccoon_wave", wave=True)
    raccoon("pet_raccoon_sleep", sleep=True)


if __name__ == "__main__":
    main()
