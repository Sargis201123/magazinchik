"""Лодка для наводнения (особый день «flood»): деревянная вёсельная лодка сбоку.

  boat        44×16 — корпус с бортом и скамьёй (гребец — человечек игры поверх);
  boat_oar    20×8  — весло (игра покачивает его, будто гребут).

    python3 art/sprites.py
"""

from sprites import Canvas


def boat():
    c = Canvas(44, 16)
    # Корпус: клин к носу и корме, светлая полоса борта, тёмное дно в воде.
    for y in range(4, 14):
        inset = max(0, (y - 4) // 2)
        c.hline(2 + inset, y, 40 - inset * 2, "n" if y < 8 else "a")
    c.hline(1, 3, 42, "N")
    c.hline(1, 4, 42, "Y")
    for x in range(6, 38, 6):
        c.vline(x, 5, 3, "a")
    c.rect(18, 2, 8, 2, "a")
    c.outline("k")
    c.save("boat")

    o = Canvas(20, 8)
    o.line(1, 1, 14, 5, "a")
    o.rect(14, 4, 5, 3, "n")
    o.outline("k")
    o.save("boat_oar")


def main():
    boat()


if __name__ == "__main__":
    main()
