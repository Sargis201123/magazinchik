"""Живые этажи (15.11): второй этаж «дорисуй — красивее» и значки моментов этажей.

Автор, 15.11: «2 этаж дорисуй — красивее» и «подвал и второй этаж — больше трафика, я бы хотел эти части тоже
активными сделать». Здесь — то, чего не хватало бутику (art/clothes_art.py) до уровня основного зала и фудкорта:
подвесные латунные лампы над залом, бра на стене, гирлянда тёплых огоньков под карнизом, блики на паркете от ламп
и окон, второй вариант стоек с вещами сезона (раньше все стойки одной коллекции были одинаковыми), низкий стол со
стопками сложенных вещей; и значки моментов этажей (scenes/floors/momentFx.ts): вешалка с биркой размера,
гаечный ключ, жетоны.

Палитра Endesga 32 (art/sprites.py), двойная детализация, контур #181425 у предметов, свет и блики — белые
полупрозрачные (в игре кладутся сложением с тинтом).

    python3 art/floors_life.py

Картинки (ширина×высота в пикселях рисунка):
  fl2c_rack_*      48×52 — стойка с вещами сезона, второй набор (warm / rain / summer);
  fl2c_fold[_*]    44×30 — низкий стол-подиум со стопками сложенных вещей сезона (без сезона — пара стопок);
  fl2c_pendant     16×14 — подвесная лампа: латунный купол, светящийся низ;
  fl2c_sconce      10×14 — бра на стене: латунь и матовый плафон;
  fl2c_garland     32×10 — гирлянда тёплых огоньков на проводе (плитка по ширине);
  fl2c_gloss       48×20 — блик на паркете (белый, полупрозрачный);
  flm_size         12×12 — вешалка с биркой размера (момент «нужен другой размер»);
  flm_fix          12×12 — гаечный ключ (момент «автомат заело»);
  flm_token        12×12 — стопка жетонов (момент «разменять на жетоны»).
"""

from premium import H, lit
from sprites import Canvas, shadowed
import clothes_art as ca

INK = H("#181425")
WHITE, METAL, METAL_L = H("#ffffff"), H("#8b9bb4"), H("#c0cbdc")
GOLD, GOLD_L, ORANGE, BROWN = H("#feae34"), H("#fee761"), H("#f77622"), H("#8f563b")
WOOD_D, WOOD, SAND, CREAM = H("#733e39"), H("#b86f50"), H("#e4a672"), H("#ead4aa")
RED, NAVY = H("#e43b44"), H("#262b44")


def a(c, alpha):
    return c[:3] + (alpha,)


# Второй набор вещей на стойках: другие вещи и цвета той же коллекции — ряд стоек больше не повторяет одну картинку.
RACK_B = {
    "warm": ((ca.sweater, ca.PLUM, ca.CREAM), (ca.puffer, ca.GREEN_D), (ca.coat, ca.WOOD), (ca.sweater, ca.RED, ca.WHITE), (ca.puffer, ca.SLATE), (ca.coat, ca.DARK)),
    "rain": ((ca.raincoat, ca.GREEN), (ca.trench, ca.CREAM), (ca.umbrella, ca.RED_D), (ca.raincoat, ca.BLUE), (ca.trench, ca.TAN), (ca.umbrella, ca.GOLD)),
    "summer": ((ca.shirt, ca.CYAN), (ca.dress, ca.HOT, ca.WHITE), (ca.shorts, ca.SAND), (ca.tshirt, ca.WHITE, ca.RED), (ca.dress, ca.CYAN), (ca.shirt, ca.GOLD_L), (ca.tshirt, ca.PINK_D, ca.GOLD_L)),
}


def rack_b(kind):
    """Стойка как у clothes_art.rack, только с другим набором вещей."""
    saved = ca.SEASON_RACK[kind]
    ca.SEASON_RACK[kind] = RACK_B[kind]
    try:
        # rack() сохраняет под своим именем — перехватываем сохранение и кладём под своим.
        real = ca.shadowed

        def grab(c, cx, cy, rx, ry, alpha=70):
            out = real(c, cx, cy, rx, ry, alpha)
            out.save = lambda name, o=out: Canvas.save(o, f"fl2c_rack_{kind}")
            return out

        ca.shadowed = grab
        ca.rack(kind)
    finally:
        ca.shadowed = real
        ca.SEASON_RACK[kind] = saved


def fold(kind=None):
    """Низкий стол-подиум: светлое дерево на тёмных ножках, сверху — ряды стопок сложенных вещей сезона."""
    c = Canvas(44, 30)
    top = 14
    c.rect(2, top, 40, 4, lit(CREAM, 0.35))
    c.hline(2, top, 40, WHITE)
    c.rect(2, top + 4, 40, 3, SAND)
    c.hline(2, top + 6, 40, WOOD)
    for x in (4, 38):
        c.rect(x, top + 7, 2, 7, WOOD_D)
        c.vline(x, top + 7, 7, WOOD)
    c.hline(6, top + 9, 32, WOOD_D)
    tones = ca.SEASON_FOLD[kind]
    xs = (4, 13, 22, 31) if kind else (8, 26)
    for i, x in enumerate(xs):
        ca.folded(c, x, top + 1, 8, tones[(i * 3) % len(tones)], n=4 if (i % 2 == 0 and kind) else 3, step=3)
    # Бирка с ценой на краю стола.
    c.rect(18, top + 3, 6, 3, WHITE)
    c.hline(19, top + 4, 4, RED)
    c.outline(INK)
    shadowed(c, 22, 28, 20, 2).save(f"fl2c_fold_{kind}" if kind else "fl2c_fold")


def pendant():
    """Подвесная лампа: латунный купол с бликом, под ним — светящийся край и лампочка."""
    c = Canvas(16, 14)
    c.vline(8, 0, 3, NAVY)
    c.rect(7, 3, 2, 1, GOLD)
    for y in range(4, 10):
        half = 1 + (y - 4)
        c.hline(8 - half, y, half * 2, GOLD if y < 8 else ORANGE)
        c.px(8 - half, y, lit(GOLD, -0.25))
    c.hline(5, 5, 2, GOLD_L)
    c.px(4, 7, GOLD_L)
    c.hline(2, 10, 12, lit(GOLD_L, 0.4))
    c.hline(5, 11, 6, WHITE)
    c.outline(INK)
    c.save("fl2c_pendant")


def sconce():
    """Бра: латунная планка на стене, рожок и матовый плафон-тюльпан."""
    c = Canvas(10, 14)
    c.rect(4, 6, 2, 6, GOLD)
    c.vline(4, 6, 6, lit(GOLD, -0.2))
    c.rect(2, 1, 6, 5, lit(CREAM, 0.5))
    c.hline(2, 1, 6, WHITE)
    c.hline(3, 5, 4, GOLD_L)
    c.rect(3, 12, 4, 1, GOLD)
    c.outline(INK)
    c.save("fl2c_sconce")


def garland():
    """Гирлянда: провод провисает дугой, на нём — тёплые лампочки с бликом (плитка 32 — две дуги)."""
    c = Canvas(32, 10)
    for x in range(32):
        y = 2 + round(2.6 * (1 - ((x % 16) - 8) ** 2 / 64))
        c.px(x, y, NAVY)
    for x, tone in ((4, GOLD_L), (12, GOLD), (20, GOLD_L), (28, ORANGE)):
        y = 2 + round(2.6 * (1 - ((x % 16) - 8) ** 2 / 64))
        c.rect(x - 1, y + 1, 3, 3, tone)
        c.px(x, y + 1, WHITE)
        c.px(x, y + 4, lit(tone, -0.3))
    c.save("fl2c_garland")


def gloss():
    """Блик на паркете: две косые светлые полосы, к краям тают (белый — в игре тинт и сложение)."""
    c = Canvas(48, 20)
    for y in range(20):
        for x in range(48):
            for x0, w in ((10, 7), (24, 4)):
                d = x - (x0 + y * 0.9)
                if 0 <= d < w:
                    edge = min(d + 1, w - d, y + 1, 20 - y) / 3
                    c.px(x, y, a(WHITE, int(min(1, edge) * 120)))
    c.save("fl2c_gloss")


def icon_size():
    """Вешалка с биркой размера — «нужен другой размер»."""
    c = Canvas(12, 12)
    c.stamp([
        ".....kk.....",
        "....k..k....",
        ".......k....",
        "......k.....",
        "....kkkk....",
        "..kkWWWWkk..",
        ".kWW....WWk.",
        "kkkkkkkkkkkk",
    ], 0, 0)
    c.rect(6, 7, 5, 4, GOLD_L)
    c.frame(6, 7, 5, 4, INK)
    c.px(8, 9, RED)
    c.save("flm_size")


def icon_fix():
    """Гаечный ключ — «автомат заело, почини»."""
    c = Canvas(12, 12)
    c.stamp([
        "........kkk.",
        ".......kWWk.",
        "......kWk.k.",
        "......kWWkk.",
        ".....kWWWk..",
        "....kWWWk...",
        "...kWWWk....",
        "..kWWWk.....",
        ".kWWWk......",
        "kWWlk.......",
        "kWlk........",
        ".kk.........",
    ], 0, 0)
    c.save("flm_fix")


def icon_token():
    """Стопка жетонов и один сверху — «разменять на жетоны»."""
    c = Canvas(12, 12)
    for i, y in enumerate((9, 7, 5)):
        c.rect(2, y, 8, 2, GOLD if i % 2 == 0 else ORANGE)
        c.hline(2, y, 8, GOLD_L)
    c.ellipse(6, 3, 3, 2.2, GOLD_L)
    c.px(6, 3, ORANGE)
    c.outline(INK)
    c.save("flm_token")


if __name__ == "__main__":
    for kind in ("warm", "rain", "summer"):
        rack_b(kind)
        fold(kind)
    fold(None)
    pendant()
    sconce()
    garland()
    gloss()
    icon_size()
    icon_fix()
    icon_token()
