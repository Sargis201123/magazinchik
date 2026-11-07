"""Значки товаров для окон (не для полок): несколько товаров берут детальную иконку из набора Henry Software
«Pixel Food» (CC0, art/vendor/henry-pixel-food), переведённую в палитру игры (art/palette_snap.py).
Решение автора 07.11: в окнах — Henry для хлеба, мяса и рыбы, остальное — наши значки; на полках в зале — всё наше.

    python3 art/ui_items.py

Пишет public/assets/uiitem_<товар>.png (16×16). Окна берут их через src/ui/sheet.ts itemIcon().
Какие товары — UI_ITEMS ниже и UI_ITEMS в src/ui/sheet.ts (тест сверяет файлы).
"""

import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from palette_snap import snap  # noqa: E402

SHEET = os.path.join(HERE, "vendor", "henry-pixel-food", "Food.png")
OUT = os.path.join(HERE, "..", "public", "assets")
CELL = 16
# товар → (строка, столбец) клетки на листе Henry
UI_ITEMS = {
    "bread": (7, 5),
    "meat": (2, 5),
    "fish": (5, 2),
}


def main():
    sheet = Image.open(SHEET).convert("RGBA")
    for pid, (r, c) in UI_ITEMS.items():
        cell = sheet.crop((c * CELL, r * CELL, (c + 1) * CELL, (r + 1) * CELL))
        snap(cell).save(os.path.join(OUT, f"uiitem_{pid}.png"))
    print(f"ui_items: {len(UI_ITEMS)} значков")


if __name__ == "__main__":
    main()
