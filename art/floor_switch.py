"""Значки переключателя этажей (src/ui/floorSwitch.ts, 14.11): фудкорт, одежда и спуск в подвал.

Зал берёт готовый ico_shop (icons2.py), замок — ico_lock. Формат — как у icons.py: 12×12 в палитре
sprites.PALETTE, с общим контуром. Файлы — отдельные ico_floor_*.png: меню берёт их по одному
(ui/sheet.sheetPng — нет в листе, значит файлом), атлас ico_atlas для холста им не нужен.

    python3 art/floor_switch.py
"""

from icons import draw

FLOOR_ICONS = {
    # 🍕 третий этаж — фудкорт: кусок пиццы с колбасками, корочка сверху.
    "food": [
        "............",
        ".aaaaaaaaaa.",
        ".BBBBBBBBBB.",
        "..YYYYYYYY..",
        "..YRRYYYYY..",
        "...RRYYRR...",
        "...YYYYRR...",
        "....YRYY....",
        "....YRRY....",
        ".....YY.....",
        ".....Y......",
        "............",
    ],
    # 👗 второй этаж — одежда: платье на вешалке, жёлтый поясок.
    "clothes": [
        ".....ll.....",
        "......l.....",
        "...llllll...",
        "...PP..PP...",
        "...PPPPPP...",
        "....YYYY....",
        "....PPPP....",
        "...PPPPPP...",
        "..PPPPPPPP..",
        ".PPPPPPPPPP.",
        ".pppppppppp.",
        "............",
    ],
    # 🪜 подвал: кирпичный проём, ступени уходят вниз в темноту, над входом — лампочка.
    "cellar": [
        ".....YY.....",
        ".bbbbbbbbbb.",
        ".bBBBBBBBBb.",
        ".bKKKKKKKKb.",
        ".bWWKKKKKKb.",
        ".bllWWKKKKb.",
        ".bKKllWWKKb.",
        ".bKKKKllWWb.",
        ".bKKKKKKllb.",
        ".bKKKKKKKKb.",
        ".bKKKKKKKKb.",
        "GGGGGGGGGGGG",
    ],
}


def main():
    for name, rows in FLOOR_ICONS.items():
        assert len(rows) == 12 and all(len(r) == 12 for r in rows), (name, [len(r) for r in rows])
        draw(rows, None).save(f"ico_floor_{name}")


if __name__ == "__main__":
    main()
