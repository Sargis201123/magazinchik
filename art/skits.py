"""Портреты героев «Сценок дня» (src/game/skits.ts): шесть жителей района, каждый — с настроениями для диалога
(обычное, радостное, грустное, сердитое, удивлённое). Общая заготовка портрета — sprites.portrait.

    python3 art/skits.py
"""

from delivery import hair_long, hair_messy
from family import MOODS
from sprites import beard, glasses, hair_bun, hair_cap, hair_chef, portrait, rgb


def freckles(p, skin, hair, shirt):
    """Веснушки на щеках."""
    for x, y in ((11, 16), (13, 17), (20, 16), (22, 17)):
        p.px(x, y, rgb("#d77643"))


def phone(p, skin, hair, shirt):
    """Телефон в руке у плеча — блогер."""
    p.rect(23, 22, 4, 6, rgb("#262b44"))
    p.rect(24, 23, 2, 3, rgb("#2ce8f5"))


def satchel(p, skin, hair, shirt):
    """Лямка школьного рюкзака и бант."""
    p.line(9, 22, 12, 31, rgb("#0099db"))
    p.px(12, 6, rgb("#e43b44"))
    p.px(13, 6, rgb("#e43b44"))
    p.px(11, 7, rgb("#e43b44"))


def courier(p, skin, hair, shirt):
    """Лямка термосумки курьера."""
    p.line(20, 22, 24, 31, rgb("#262b44"))
    p.line(21, 22, 25, 31, rgb("#262b44"))


def old_beard(p, skin, hair, shirt):
    beard(p, skin, hair, shirt)
    glasses(p, skin, hair, shirt)


CAST = (
    # Тёма, мальчик с потерявшимся щенком: рыжий, вихрастый, в веснушках.
    ("skit_tyoma", "#0099db", "#f2d3ab", "#be4a2f", "#feae34", hair_messy, freckles),
    # Лёша, студент-повар: в поварском колпаке.
    ("skit_lyosha", "#63c74d", "#eec39a", "#3e2731", "#f4f4f4", hair_chef, None),
    # Карина, блогер: светлые длинные волосы, телефон.
    ("skit_karina", "#b55088", "#f2d3ab", "#fee761", "#e43b44", hair_long, phone),
    # Фёдор Иванович, сосед-пенсионер: кепка, седая борода, очки.
    ("skit_fyodor", "#8f563b", "#e4a672", "#c0cbdc", "#5a6988", hair_cap, old_beard),
    # Маша, школьница: пучок, бант, лямка рюкзака.
    ("skit_masha", "#f6757a", "#eec39a", "#4a2c1a", "#3e8948", hair_bun, satchel),
    # Руслан, курьер: кепка, термосумка.
    ("skit_ruslan", "#3a4466", "#d9a066", "#181425", "#feae34", hair_cap, courier),
)


def main():
    for name, bg, skin, hair, shirt, draw_hair, extras in CAST:
        for mood in MOODS:
            portrait(name, bg, skin, hair, shirt, draw_hair, extras, mood)


if __name__ == "__main__":
    main()
