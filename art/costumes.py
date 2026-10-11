"""Наряды хозяина за звёзды (src/game/decor.ts, раздел «Наряд»): превью для магазина.

Хозяин в полный рост спереди на цветной подложке. Собирается из уже нарисованных слоёв
человечка (sprites.py) и гардероба (wardrobe.py) — поэтому запускается после них:

    python3 art/sprites.py
"""

from PIL import Image

from sprites import OUT

OWNER = {"skin": 0xF2D3AB, "shirt": 0x8FD16A, "pants": 0x3A4466, "hair": 0x4A2C1A}

# Должно совпадать с COSTUMES в src/scenes/StoreScene.ts.
COSTUMES = {
    "outfit_farmer": ({"hat": "straw", "outfit": "overalls"}, {"pants": 0x3B5A9A}, ((0x63C74D, 0x3E8948))),
    "outfit_retro": ({"hat": "papercap", "outfit": "soda", "face": "mustache"}, {"pants": 0x262B44}, ((0xF6757A, 0xA22633))),
    "outfit_tuxedo": ({"hat": "silkhat", "outfit": "tuxedo", "face": "monocle", "back": "tails"}, {"pants": 0x181425}, ((0xFEE761, 0xB86F50))),
    "outfit_cyber": ({"hat": "cyberhelmet", "outfit": "cyber", "back": "jetpack"}, {"pants": 0x262B44}, ((0x2CE8F5, 0x68386C))),
}


def tinted(name, tint=None):
    im = Image.open(OUT / f"{name}.png").convert("RGBA")
    if tint is None:
        return im
    r, g, b = (tint >> 16) & 255, (tint >> 8) & 255, tint & 255
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            p = px[x, y]
            if p[3]:
                px[x, y] = (p[0] * r // 255, p[1] * g // 255, p[2] * b // 255, p[3])
    return im


def main():
    for name, (wear, colors, (top, bottom)) in COSTUMES.items():
        look = {**OWNER, **colors}
        W, H = 40, 48
        card = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        # Подложка: вертикальный градиент и мягкий круг-прожектор.
        for y in range(H):
            t = y / (H - 1)
            col = tuple(round(((top >> s) & 255) * (1 - t) + ((bottom >> s) & 255) * t) for s in (16, 8, 0)) + (255,)
            for x in range(W):
                card.putpixel((x, y), col)
        glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        for y in range(H):
            for x in range(W):
                d = ((x - 20) ** 2 / 15**2 + (y - 22) ** 2 / 18**2) ** 0.5
                if d < 1:
                    glow.putpixel((x, y), (255, 255, 255, int(70 * (1 - d))))
        card.alpha_composite(glow)
        person = Image.new("RGBA", (40, 44), (0, 0, 0, 0))

        def put(img, big=False):
            person.alpha_composite(img, (0, 0) if big else (8, 8))

        if wear.get("back"):
            put(tinted(f"w_back_{wear['back']}"), True)
        put(tinted("p_legs0", look["pants"]))
        put(tinted("p_shirt", look["shirt"]))
        put(tinted(f"w_outfit_{wear['outfit']}"))
        put(tinted("p_skin", look["skin"]))
        if wear.get("face"):
            put(tinted(f"w_face_{wear['face']}", look["hair"] if wear["face"] in ("beard", "mustache") else None))
        put(tinted("p_hair_short", look["hair"]))
        put(tinted(f"w_hat_{wear['hat']}"), True)
        card.alpha_composite(person, (0, 2))
        card.save(OUT / f"{name}.png")


if __name__ == "__main__":
    main()
