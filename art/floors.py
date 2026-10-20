"""Пол торгового зала: тёплая и прохладная плитка, мрамор старшего уровня.

Плитки 64×64 (в мире — четыре на четыре плиты по 8×8): у каждой плиты свой чуть
другой тон, мягкое «облако» оттенка и блик у верхнего края; затирка лишь немного
темнее плитки — зал не похож на тетрадь в клетку, а вблизи не рябит."""

import math
import random

from premium import H, lit, mix, noise
from sprites import Canvas


def tiles(name, tones, joint, seed):
    N, S = 64, 16
    c = Canvas(N, N)
    n = noise(seed)
    rnd = random.Random(seed)
    tau = 2 * math.pi
    tone = {(i, j): rnd.choice(tones) for i in range(N // S) for j in range(N // S)}
    for y in range(N):
        for x in range(N):
            base = tone[(x // S, y // S)]
            # Плавное облако оттенка (замыкается по краям) и редкие крапинки.
            cloud = 0.5 + 0.25 * math.sin(tau * (x + 2 * y) / N + seed) + 0.25 * math.sin(tau * (2 * x - y) / N)
            px = mix(base, lit(base, -0.07), cloud * 0.6)
            if n(x, y) > 0.985:
                px = lit(px, -0.06)
            lx, ly = x % S, y % S
            if ly == 1 or lx == 1:
                px = lit(px, 0.35)
            elif ly == S - 1 or lx == S - 1:
                px = mix(px, joint, 0.35)
            c.px(x, y, px)
    for i in range(N):
        for g in range(0, N, S):
            c.px(i, g, joint)
            c.px(g, i, joint)
    c.save(name)


def stone(name, base, dark, vein, joint, seed):
    """Мрамор 128×128 (в мире — четыре на четыре плиты по 16×16): мягкие облака оттенка,
    у каждой плиты свой тон, редкие тонкие прожилки без «каракулей». Узор крупный — повтор
    не бросается в глаза."""
    N, S = 128, 32
    c = Canvas(N, N)
    rnd = random.Random(seed)
    tau = 2 * math.pi
    waves = [(rnd.randint(1, 3), rnd.randint(-3, 3), rnd.uniform(0, tau), w) for w in (0.5, 0.3, 0.2)]
    slab = {(i, j): rnd.uniform(-0.12, 0.12) for i in range(N // S) for j in range(N // S)}
    for y in range(N):
        for x in range(N):
            v = 0.5 + sum(w * math.sin(tau * (a * x + b * y) / N + ph) for a, b, ph, w in waves) * 0.5
            t = min(1.0, max(0.0, v * 0.7 + slab[(x // S, y // S)]))
            c.px(x, y, mix(base, dark, t))
    # Прожилки: длинные плавные линии, лишь чуть темнее камня; на швах обрываются.
    for k in range(5):
        x0, y0, ph = rnd.uniform(0, N), rnd.uniform(0, N), rnd.uniform(0, tau)
        slope, amp = rnd.uniform(0.25, 0.6), rnd.uniform(2, 5)
        tone = mix(c.get(0, 0), vein, 0.55 if k < 2 else 0.35)
        for u in range(int(rnd.uniform(40, 80))):
            x = round(x0 + u) % N
            y = round(y0 + u * slope + amp * math.sin(u * 0.08 + ph)) % N
            c.px(x, y, mix(c.get(x, y), tone, 0.8))
    for i in range(N):
        for g in range(0, N, S):
            c.px(i, g, joint)
            c.px(g, i, joint)
            if i % S:
                c.px(i, g + 1, lit(c.get(i, g + 1), 0.4))
                c.px(g + 1, i, lit(c.get(g + 1, i), 0.4))
    c.save(name)


def queue_mark():
    """Разметка на полу «стойте здесь»: жёлтая рамка из ленты и два следа, внутри — пол."""
    c = Canvas(20, 12)
    tape, foot = H("#f2b33a"), H("#7a6a5c")
    c.frame(0, 0, 20, 12, tape)
    c.frame(1, 1, 18, 10, H("#f7cf72"))
    for x in (6, 11):
        c.rect(x, 3, 3, 3, foot)
        c.rect(x, 7, 3, 2, foot)
    c.save("queue_mark")


def facades():
    """Фасад магазина по уровням (32×20, как facade): ларёк — доски, потом кирпич,
    дальше светлая плитка и стеклянный фасад супермаркета. Карниз и цоколь — как у кирпича."""
    from PIL import Image
    from sprites import OUT

    brick = Image.open(OUT / "facade.png").convert("RGBA")

    def build(name, paint):
        c = Canvas(32, 20)
        c.img = brick.copy()
        for y in range(4, 17):
            for x in range(32):
                c.px(x, y, paint(x, y))
        c.save(name)

    def wood(x, y):
        row = (y - 4) // 3
        seam = (y - 4) % 3 == 2
        end = (x + row * 11) % 16 == 0
        if seam or end:
            return H("#6e4426")
        return H("#a8693f") if row % 2 else H("#b97a4a")

    def tile(x, y):
        if (y - 4) % 6 == 5 or (x + ((y - 4) // 6) * 4) % 8 == 7:
            return H("#c4bba8")
        return H("#ece4d4") if ((x // 8) + (y - 4) // 6) % 2 else H("#e2d9c6")

    def glass(x, y):
        if x % 16 in (0, 1):
            return H("#9aa6bc") if x % 16 == 0 else H("#6c7894")
        shine = (x - (y - 4)) % 16 in (3, 4, 5)
        if shine:
            return H("#7fa8d8")
        return H("#3d5a8c") if y > 10 else H("#4a6a9c")

    build("facade_wood", wood)
    build("facade_tile", tile)
    build("facade_glass", glass)


def main():
    tiles("floor", [H("#f2dfba"), H("#eed8b0"), H("#f0dcb5"), H("#ebd4a9")], H("#d6bd93"), 7)
    tiles("floor2", [H("#eaeff5"), H("#e4eaf1"), H("#e7edf3"), H("#e0e7ef")], H("#cbd4e0"), 11)
    queue_mark()
    facades()
    stone("floor3", H("#f5f1f6"), H("#e2dbe8"), H("#b4a7c0"), H("#d3cadd"), 14)


if __name__ == "__main__":
    main()
