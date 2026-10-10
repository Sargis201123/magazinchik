"""Премиальное оформление за Telegram Stars: по пять вещей в каждом разделе.

Вывески на крышу, стены, полы, свет и украшения зала. Рисуется тем же холстом, что и
остальная графика (двойная детализация, общий контур), но с более богатой палитрой:
у каждой вещи свои полутона, блики и фактура. Запуск — вместе со всеми спрайтами:

    python3 art/sprites.py
"""

import math
import random

from sprites import Canvas, shadowed


def H(s, a=255):
    """'#rrggbb' → RGBA."""
    return (int(s[1:3], 16), int(s[3:5], 16), int(s[5:7], 16), a)


def mix(c1, c2, t):
    return tuple(round(c1[i] + (c2[i] - c1[i]) * t) for i in range(3)) + (255,)


def lit(c, t):
    """Светлее (t > 0) или темнее (t < 0)."""
    return mix(c, (255, 255, 255), t) if t > 0 else mix(c, (24, 20, 37), -t)


INK = H("#181425")


def noise(seed):
    rnd = random.Random(seed)
    table = {}

    def at(x, y):
        key = (x, y)
        if key not in table:
            table[key] = rnd.random()
        return table[key]

    return at


# ---------------------------------------------------------------- стены 32×64
# Высота стены в мире 32 точки (64 пикселя спрайта). Плитка повторяется по ширине,
# поэтому всё, что пересекает край, считается по модулю 32.


def baseboard(c, y, tone, hi, lo):
    c.rect(0, y, 32, 64 - y, tone)
    c.hline(0, y, 32, hi)
    c.hline(0, 63, 32, lo)


def wall_brick():
    """Лофт: старый кирпич с живой кладкой, дубовая полка-карниз и графитовые панели."""
    c = Canvas(32, 64)
    bricks = [H("#a0442f"), H("#b5523a"), H("#8f3b2a"), H("#c0613f"), H("#9c4a35"), H("#ab4b33")]
    mortar, mortar_lo = H("#d9c7b0"), H("#b9a387")
    rnd = random.Random(7)
    pick = {(row, col): rnd.choice(bricks) for row in range(10) for col in range(4)}
    c.rect(0, 0, 32, 4, H("#2b2d38"))
    c.hline(0, 3, 32, H("#4b4f60"))
    for y in range(4, 49):
        row, ry = (y - 4) // 5, (y - 4) % 5
        off = 4 if row % 2 else 0
        for x in range(32):
            bx = (x + off) % 32
            col, rx = bx // 8, bx % 8
            if ry == 4:
                c.px(x, y, mortar_lo if rx != 7 else mortar)
            elif rx == 7:
                c.px(x, y, mortar)
            else:
                base = pick[(row, col)]
                tone = lit(base, 0.18) if ry == 0 else lit(base, -0.18) if ry == 3 else base
                if rx == 0 and ry < 3:
                    tone = lit(base, 0.1)
                c.px(x, y, tone)
    # Сколы и следы старой краски.
    n = noise(11)
    for y in range(4, 49):
        for x in range(32):
            v = n(x, y)
            px = c.get(x, y)
            if v > 0.965 and px[:3] not in (mortar[:3], mortar_lo[:3]):
                c.px(x, y, lit(px, -0.25))
            elif v < 0.008:
                c.px(x, y, H("#e8dccb"))
    # Дубовая полка-карниз.
    c.rect(0, 49, 32, 3, H("#8a5a36"))
    c.hline(0, 49, 32, H("#c18b5a"))
    c.hline(0, 51, 32, H("#5c3a22"))
    c.hline(0, 52, 32, H("#3a2618"))
    # Графитовые панели снизу.
    c.rect(0, 53, 32, 6, H("#353a48"))
    for x in range(0, 32, 8):
        c.vline(x, 53, 6, H("#262a35"))
        c.vline(x + 1, 53, 6, H("#4a5064"))
    baseboard(c, 59, H("#1f2029"), H("#3c3f4f"), H("#121218"))
    c.save("wall_brick")


def wall_walnut():
    """Тёмный орех: доски с волокнами, латунный пояс и филёнки с фаской."""
    c = Canvas(32, 64)
    tones = [H("#5b3826"), H("#64402b"), H("#553321"), H("#6b4530")]
    n = noise(23)
    c.rect(0, 0, 32, 6, H("#3a2418"))
    c.hline(0, 4, 32, H("#d9a441"))
    c.hline(0, 5, 32, H("#8c6421"))
    c.hline(0, 1, 32, H("#5b3826"))
    for x in range(32):
        board = tones[(x // 8) % 4]
        for y in range(6, 39):
            tone = board
            if x % 8 == 0:
                tone = H("#2e1c12")
            elif x % 8 == 1:
                tone = lit(board, 0.14)
            else:
                # Волокна: длинные светлые и тёмные прожилки вдоль доски.
                g = math.sin((y * 0.45) + (x % 8) * 1.7 + (x // 8) * 2.3)
                if g > 0.86:
                    tone = lit(board, 0.1)
                elif g < -0.9:
                    tone = lit(board, -0.16)
                if n(x, y) > 0.97:
                    tone = lit(board, -0.3)
            c.px(x, y, tone)
    # Латунный пояс.
    c.hline(0, 39, 32, H("#9c6b1f"))
    c.hline(0, 40, 32, H("#f5d27a"))
    c.hline(0, 41, 32, H("#d9a441"))
    c.hline(0, 42, 32, H("#7a5216"))
    # Филёнки 16 пикселей: рамка, фаска со светом сверху-слева, тень снизу-справа.
    c.rect(0, 43, 32, 14, H("#4a2d1e"))
    for ox in (0, 16):
        c.rect(ox + 2, 45, 12, 10, H("#6b4530"))
        c.hline(ox + 2, 45, 12, H("#8a5c3e"))
        c.vline(ox + 2, 45, 10, H("#7d533a"))
        c.hline(ox + 2, 54, 12, H("#3a2418"))
        c.vline(ox + 13, 45, 10, H("#3a2418"))
        c.rect(ox + 4, 47, 8, 6, H("#5f3c29"))
        c.hline(ox + 4, 47, 8, H("#3f281b"))
        c.hline(ox + 4, 52, 8, H("#7d533a"))
    baseboard(c, 57, H("#2a1810"), H("#5b3826"), H("#150c08"))
    c.hline(0, 58, 32, H("#d9a441"))
    c.save("wall_walnut")


def wall_metro():
    """Плитка «кабанчик», как в старом метро: белая сверху, бутылочно-зелёная снизу."""
    c = Canvas(32, 64)

    def tiles(y0, y1, body, hi, lo, grout):
        for y in range(y0, y1):
            row, ry = (y - y0) // 5, (y - y0) % 5
            off = 4 if row % 2 else 0
            for x in range(32):
                rx = (x + off) % 8
                if ry == 4 or rx == 7:
                    c.px(x, y, grout)
                elif ry == 0 or rx == 0:
                    c.px(x, y, hi)
                elif ry == 3 or rx == 6:
                    c.px(x, y, lo)
                else:
                    c.px(x, y, body)
            # Блик на глазури.
        for y in range(y0, y1, 5):
            for x in range(0, 32, 8):
                off = 4 if ((y - y0) // 5) % 2 else 0
                c.px((x + 2 - off) % 32, y + 1, (255, 255, 255, 255))

    c.rect(0, 0, 32, 4, H("#d7dde5"))
    c.hline(0, 0, 32, H("#f4f6f8"))
    c.hline(0, 3, 32, H("#9aa6b6"))
    tiles(4, 39, H("#f1f4f7"), H("#ffffff"), H("#d3dae3"), H("#aeb8c6"))
    # Бордюр: тёмно-зелёная полоса с мозаикой.
    c.rect(0, 39, 32, 5, H("#1f5c4a"))
    c.hline(0, 39, 32, H("#3f8c72"))
    for x in range(0, 32, 4):
        c.rect(x + 1, 41, 2, 2, H("#e9c46a") if (x // 4) % 2 else H("#7cc6a6"))
    c.hline(0, 43, 32, H("#123a2f"))
    tiles(44, 59, H("#24684f"), H("#3d8a6c"), H("#1a4d3b"), H("#123a2f"))
    baseboard(c, 59, H("#1a2a2a"), H("#3a4a4a"), H("#0f1717"))
    c.save("wall_metro")


DAMASK = [
    "....G....",
    "...gGg...",
    "..g.G.g..",
    ".gg.g.gg.",
    "gG.gGg.Gg",
    ".g.gGg.g.",
    "...gGg...",
    "..g.g.g..",
    ".g..G..g.",
    "....g....",
    "...g.g...",
]


def wall_damask():
    """Обои с дамасским узором на тёмной бирюзе, белые панели и ореховый плинтус."""
    c = Canvas(32, 64)
    bg, mid, gold = H("#1d4e5a"), H("#2c6a77"), H("#c9a24a")
    c.rect(0, 0, 32, 6, H("#efe6d2"))
    c.hline(0, 0, 32, H("#fffaf0"))
    c.hline(0, 4, 32, gold)
    c.hline(0, 5, 32, H("#8a6a2a"))
    for x in range(0, 32, 4):
        c.rect(x + 1, 1, 2, 2, H("#d9cdb2"))
    c.rect(0, 6, 32, 34, bg)
    # Мелкий «шёлковый» рубчик.
    for y in range(6, 40):
        for x in range(32):
            if (x + y) % 4 == 0:
                c.px(x, y, lit(bg, 0.05))
    for oy, offs in ((7, 0), (24, 16)):
        for ox in (offs + 3, offs + 3 - 32 + 32):
            for dy, row in enumerate(DAMASK):
                for dx, ch in enumerate(row):
                    if ch != ".":
                        c.px((ox + dx) % 32, oy + dy, gold if ch == "G" else mid)
    # Маленькие ромбики между узорами.
    for ox, oy in ((15, 13), (31, 30)):
        c.px(ox % 32, oy, gold)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            c.px((ox + dx) % 32, oy + dy, mid)
    c.hline(0, 39, 32, H("#12343c"))
    # Белый пояс и панели с тонкой рамкой.
    c.rect(0, 40, 32, 3, H("#f6efe0"))
    c.hline(0, 40, 32, H("#ffffff"))
    c.hline(0, 42, 32, H("#c9bca0"))
    c.rect(0, 43, 32, 14, H("#ece3cf"))
    for ox in (0, 16):
        c.frame(ox + 2, 45, 12, 10, H("#c9bca0"))
        c.hline(ox + 3, 46, 10, H("#fffaf0"))
        c.vline(ox + 3, 46, 8, H("#fffaf0"))
    baseboard(c, 57, H("#4a2d1e"), H("#7d533a"), H("#24150d"))
    c.save("wall_damask")


def wall_provence():
    """Прованс: шалфейно-кремовая полоска с золотой ниткой, розовая вагонка, белый карниз с сухариками."""
    c = Canvas(32, 64)
    c.rect(0, 0, 32, 7, H("#fbf7ee"))
    for x in range(0, 32, 4):
        c.rect(x, 2, 2, 3, H("#e3dccb"))
        c.px(x, 2, H("#ffffff"))
    c.hline(0, 6, 32, H("#cfc6b0"))
    sage, cream = H("#a9c8a0"), H("#f3ead2")
    for x in range(32):
        k = x % 8
        tone = sage if k < 4 else cream
        if k == 6:
            tone = H("#d8b65a")
        for y in range(7, 40):
            t = tone
            if k == 0:
                t = lit(sage, -0.08)
            elif k == 3:
                t = lit(sage, 0.08)
            c.px(x, y, t)
    # Мелкие цветочки на шалфейной полосе.
    for y in range(10, 40, 9):
        for x in (1 if (y // 9) % 2 else 2,):
            for gx in range(0, 32, 8):
                c.px(gx + x, y, H("#ffffff"))
                c.px(gx + x, y + 1, H("#f2a7b8"))
    c.rect(0, 40, 32, 3, H("#ffffff"))
    c.hline(0, 42, 32, H("#d9d0bd"))
    c.rect(0, 43, 32, 14, H("#e9b8b0"))
    for x in range(0, 32, 4):
        c.vline(x, 43, 14, H("#c98f88"))
        c.vline(x + 1, 43, 14, H("#f6d3cc"))
    baseboard(c, 57, H("#fbf7ee"), H("#ffffff"), H("#c9bfa9"))
    c.hline(0, 57, 32, H("#b9ad94"))
    c.save("wall_provence")


# ---------------------------------------------------------------- полы 32×32


def floor_chevron():
    """Дубовая «французская ёлка»: шевроны с фаской, волокнами и тёплыми полутонами."""
    c = Canvas(32, 32)
    tones = [H("#8a5a36"), H("#9b6741"), H("#7e512f"), H("#a8744a"), H("#93603b")]
    rnd = random.Random(5)
    pick = {(col, plank): rnd.choice(tones) for col in range(4) for plank in range(8)}
    n = noise(31)
    for y in range(32):
        for x in range(32):
            col, lx = x // 8, x % 8
            slant = lx if col % 2 == 0 else 7 - lx
            t = (y + slant) % 32
            plank, inner = t // 4, t % 4
            base = pick[(col, plank)]
            if inner == 0:
                tone = H("#4e321e")
            elif inner == 1:
                tone = lit(base, 0.16)
            else:
                tone = base
                if n(x, y) > 0.9:
                    tone = lit(base, -0.12)
                elif n(x, y) < 0.06:
                    tone = lit(base, 0.08)
            if (col % 2 == 0 and lx == 7) or (col % 2 == 1 and lx == 7):
                tone = lit(tone, -0.28)
            c.px(x, y, tone)
    c.save("floor_chevron")


def floor_terracotta():
    """Терракотовые восьмиугольники с тёмно-синими вставками, как в старой лавке."""
    c = Canvas(32, 32)
    tones = [H("#c8693f"), H("#bf5f37"), H("#d0764a"), H("#b85a33")]
    insert, insert_hi = H("#2e5d6e"), H("#4d8296")
    grout = H("#7a4630")
    n = noise(47)
    for y in range(32):
        for x in range(32):
            tx, ty, lx, ly = x // 16, y // 16, x % 16, y % 16
            base = tones[(tx * 3 + ty * 2 + (tx ^ ty)) % 4]
            corner = min(lx + ly, (15 - lx) + ly, lx + (15 - ly), (15 - lx) + (15 - ly))
            if corner < 4:
                tone = insert_hi if corner == 0 or (lx in (0, 15) and ly in (0, 15)) else insert
                if corner == 3:
                    tone = grout
            elif lx == 0 or ly == 0:
                tone = grout
            elif corner == 4 or lx == 1 or ly == 1:
                tone = lit(base, 0.16)
            elif lx == 15 or ly == 15 or corner == 5 and (lx > 8 or ly > 8):
                tone = lit(base, -0.18)
            else:
                tone = base
                v = n(x, y)
                if v > 0.93:
                    tone = lit(base, -0.12)
                elif v < 0.05:
                    tone = lit(base, 0.12)
            c.px(x, y, tone)
    c.save("floor_terracotta")


def floor_azulejo():
    """Португальская плитка: кобальтовый узор на молочной глазури, круги сходятся на стыках."""
    c = Canvas(32, 32)
    white, cobalt, sky, grout = H("#f4f1e8"), H("#2a4fa0"), H("#8db0de"), H("#c9c4b6")
    for y in range(32):
        for x in range(32):
            lx, ly = x % 16 + 0.5, y % 16 + 0.5
            dc = math.hypot(lx - 8, ly - 8)
            # Четырёхлистник в центре.
            ang = math.atan2(ly - 8, lx - 8)
            petal = 4.6 * abs(math.cos(2 * ang)) ** 0.6
            # Четверть-круги в углах: на стыке четырёх плиток — целый круг.
            dk = min(math.hypot(lx - cx, ly - cy) for cx in (0, 16) for cy in (0, 16))
            tone = white
            if dc < petal:
                tone = cobalt if dc > 1.6 else H("#e9b949")
            elif 5.6 < dc < 6.6:
                tone = sky
            if 5.2 < dk < 6.4:
                tone = cobalt
            elif dk < 2.6:
                tone = sky if dk > 1.2 else cobalt
            if x % 16 == 0 or y % 16 == 0:
                tone = grout
            c.px(x, y, tone)
    # Глазурь бликует.
    for ox in (0, 16):
        for oy in (0, 16):
            c.px(ox + 2, oy + 2, H("#ffffff"))
            c.px(ox + 3, oy + 2, H("#ffffff"))
    c.save("floor_azulejo")


def marble(name, base, dark, vein, vein2, joint, seed):
    """Мрамор 64×64 (в мире — четыре плиты 16×16): облака оттенка, плавные прожилки
    с ответвлениями и чуть разный тон у каждой плиты. Всё замыкается по краям — без швов."""
    N = 64
    c = Canvas(N, N)
    n = noise(seed)
    tau = 2 * math.pi
    rnd = random.Random(seed)
    slab = {(i, j): rnd.uniform(-0.06, 0.06) for i in range(4) for j in range(4)}
    for y in range(N):
        for x in range(N):
            v = (math.sin(tau * (x + 2 * y) / N + seed) + math.sin(tau * (3 * x - y) / N) * 0.6) * 0.3 + 0.5
            t = min(1, max(0, v * 0.45 + n(x, y) * 0.07 + slab[(x // 16, y // 16)]))
            c.px(x, y, mix(base, dark, t))
    # Прожилки — плавные кривые наискосок; на краях переходят на соседнюю плиту.
    veins = [(vein, 70), (mix(vein2, base, 0.3), 50), (mix(vein, base, 0.5), 44), (mix(vein2, base, 0.5), 36)]
    for k, (tone, length) in enumerate(veins):
        x0, y0, phase = rnd.uniform(0, N), rnd.uniform(0, N), rnd.uniform(0, 6)
        slope = rnd.uniform(0.3, 0.75)
        prev = None
        for t in range(length * 2):
            u = t / 2
            x = round(x0 + u) % N
            y = round(y0 + u * slope + 3 * math.sin(u * 0.15 + phase)) % N
            if (x, y) != prev:
                c.px(x, y, tone)
                if k == 0 and t % 5 == 0:
                    c.px(x, (y + 1) % N, mix(tone, base, 0.5))
                prev = (x, y)
            if k < 2 and t % 31 == 11:
                for j in range(1, 6):
                    c.px((x + j) % N, (y - (j + 1) // 2) % N, mix(tone, base, 0.45))
    for i in range(N):
        for g in range(0, N, 16):
            c.px(i, g, joint)
            c.px(g, i, joint)
            c.px(i, (g + 1) % N, lit(joint, 0.25) if i % 16 else joint)
    c.save(name)


# ---------------------------------------------------------------- вывески 128×26


def board_text_area(c, x0, y0, x1, y1, tone):
    c.rect(x0, y0, x1 - x0, y1 - y0, tone)


def sign_wood():
    """Деревенская вывеска: три доски с волокнами, гвозди и плющ по краям."""
    c = Canvas(128, 26)
    planks = [H("#8a5a36"), H("#9b6741"), H("#7e512f")]
    for i, y0 in enumerate((2, 9, 16)):
        tone = planks[i]
        c.rect(6, y0, 116, 7, tone)
        c.hline(6, y0, 116, lit(tone, 0.2))
        c.hline(6, y0 + 6, 116, lit(tone, -0.3))
        rnd = random.Random(i + 3)
        for _ in range(9):
            gx, gy = rnd.randrange(8, 110), y0 + rnd.randrange(2, 5)
            c.hline(gx, gy, rnd.randrange(6, 16), lit(tone, -0.14))
        c.ellipse(rnd.randrange(20, 100), y0 + 3, 1.6, 1.2, lit(tone, -0.3))
    c.vline(6, 2, 21, H("#5c3a22"))
    c.vline(121, 2, 21, H("#5c3a22"))
    for x in (10, 117):
        for y in (5, 12, 19):
            c.px(x, y, H("#c0cbdc"))
            c.px(x + 1, y + 1, H("#3a4466"))
    # Плющ, спадающий с краёв.
    leaf, leaf_hi, leaf_lo = H("#3e8948"), H("#63c74d"), H("#265c42")
    rnd = random.Random(9)
    for side in (0, 1):
        for _ in range(16):
            lx = rnd.randrange(0, 12) if side == 0 else rnd.randrange(116, 128)
            ly = rnd.randrange(0, 24)
            if side == 0 and lx > 2 + ly // 2:
                continue
            if side == 1 and lx < 125 - ly // 2:
                continue
            c.ellipse(lx, ly, 1.8, 1.4, leaf)
            c.px(lx - 1, ly - 1, leaf_hi)
            c.px(lx + 1, ly + 1, leaf_lo)
    c.outline("k")
    c.save("sign_wood")


def sign_neon():
    """Неоновая: тёмная панель, двойная розовая трубка по краю и звёздочки."""
    c = Canvas(128, 26)
    c.round_rect(0, 0, 128, 26, H("#14122a"), r=4)
    c.round_rect(1, 1, 126, 24, H("#1c1938"), r=3)
    glow = H("#5a2453")
    tube, tube_hi = H("#ff4fa3"), H("#ffc3e1")
    for inset, tone, hi in ((3, tube, tube_hi), (6, H("#2ce8f5"), H("#c8fbff"))):
        x0, y0, x1, y1 = inset, inset, 127 - inset, 25 - inset
        for x in range(x0 + 2, x1 - 1):
            c.px(x, y0 - 1, glow)
            c.px(x, y1 + 1, glow)
            c.px(x, y0, tone)
            c.px(x, y1, tone)
        for y in range(y0 + 2, y1 - 1):
            c.px(x0 - 1, y, glow)
            c.px(x1 + 1, y, glow)
            c.px(x0, y, tone)
            c.px(x1, y, tone)
        for x, y in ((x0 + 1, y0 + 1), (x1 - 1, y0 + 1), (x0 + 1, y1 - 1), (x1 - 1, y1 - 1)):
            c.px(x, y, tone)
        for x in range(x0 + 4, x1 - 3, 9):
            c.px(x, y0, hi)
        if inset == 6:
            break
    # Звёздочки по бокам.
    for sx in (13, 114):
        for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
            c.px(sx + dx, 13 + dy, H("#fee761") if (dx, dy) != (0, 0) else H("#ffffff"))
        c.px(sx + 2, 13, H("#7a6a2a"))
        c.px(sx - 2, 13, H("#7a6a2a"))
    c.outline("k")
    c.save("sign_neon")


def sign_gold():
    """Золото на чёрном лаке: литая рама, завитки в углах и гребень сверху."""
    c = Canvas(128, 26)
    gold_lo, gold, gold_hi = H("#8c6a24"), H("#d9a93f"), H("#f7dc85")
    c.rect(2, 3, 124, 21, gold_lo)
    c.rect(3, 4, 122, 19, gold)
    c.hline(3, 4, 122, gold_hi)
    c.vline(3, 4, 19, gold_hi)
    c.rect(5, 6, 118, 15, gold_lo)
    for y in range(7, 20):
        c.hline(6, y, 116, mix(H("#2a2533"), H("#121017"), (y - 7) / 12))
    c.hline(6, 7, 116, H("#3a3446"))
    # Лаковый блик.
    for i in range(10):
        c.px(14 + i, 8, H("#4a4458"))
    # Завитки в углах.
    curl = ["GG.", "G.G", ".GG"]
    for x, y, fx, fy in ((7, 8, 0, 0), (118, 8, 1, 0), (7, 16, 0, 1), (118, 16, 1, 1)):
        for dy, row in enumerate(curl):
            for dx, ch in enumerate(row):
                if ch == "G":
                    c.px(x + (2 - dx if fx else dx), y + (2 - dy if fy else dy), gold_hi)
    # Гребень сверху по центру и подвески снизу.
    for dy, row in enumerate(["..G..", ".GgG.", "GgggG"]):
        for dx, ch in enumerate(row):
            if ch != ".":
                c.px(62 + dx, dy, gold_hi if ch == "G" else gold)
    for x in (20, 107):
        c.rect(x, 24, 2, 2, gold)
        c.px(x, 24, gold_hi)
    c.outline("k")
    c.save("sign_gold")


def sign_marquee():
    """«Бродвей»: красная доска с лампочками по всему краю — как у старого кинотеатра."""
    c = Canvas(128, 26)
    c.round_rect(0, 0, 128, 26, H("#6e1219"), r=3)
    c.round_rect(2, 2, 124, 22, H("#b3202c"), r=2)
    c.hline(3, 3, 122, H("#e0434f"))
    c.round_rect(7, 7, 114, 12, H("#8a1620"), r=1)
    c.hline(8, 7, 112, H("#5a0c12"))

    def bulb(x, y):
        c.px(x, y, H("#fff2a8"))
        c.px(x + 1, y, H("#ffd65a"))
        c.px(x, y + 1, H("#ffd65a"))
        c.px(x + 1, y + 1, H("#c9962c"))

    for x in range(5, 122, 6):
        bulb(x, 3)
        bulb(x, 21)
    for y in (9, 15):
        bulb(3, y)
        bulb(123, y)
    c.outline("k")
    c.save("sign_marquee")
    # Слой свечения лампочек: в игре мигает поверх вывески.
    g = Canvas(128, 26)
    for x in range(5, 122, 6):
        for y in (3, 21):
            g.rect(x - 1, y - 1, 4, 4, H("#ffe27a", 110))
            g.rect(x, y, 2, 2, H("#ffffff", 220))
    for y in (9, 15):
        for x in (3, 123):
            g.rect(x - 1, y - 1, 4, 4, H("#ffe27a", 110))
            g.rect(x, y, 2, 2, H("#ffffff", 220))
    g.save("sign_marquee_lit")


def sign_candy():
    """Кондитерская: пастельная доска, леденцовая полоска сверху, кружевной край и вишенки."""
    c = Canvas(128, 26)
    pink, pink_hi, pink_lo = H("#f4a6c0"), H("#fcd3e1"), H("#d77897")
    c.rect(3, 6, 122, 14, pink)
    c.hline(3, 6, 122, pink_hi)
    c.hline(3, 19, 122, pink_lo)
    # Полоска-леденец сверху.
    for x in range(3, 125):
        for y in range(1, 6):
            c.px(x, y, H("#ffffff") if (x + y) % 6 < 3 else H("#e8476f"))
    c.hline(3, 1, 122, H("#ffd0dc"))
    # Кружевной край снизу.
    for x in range(3, 125, 6):
        c.ellipse(x + 3, 20, 3, 2.6, H("#ffffff"))
        c.px(x + 3, 21, H("#f4a6c0"))
    # Вишенки по краям.
    for cx in (9, 118):
        c.line(cx, 9, cx + 2, 13, H("#3e8948"))
        c.line(cx + 2, 9, cx + 4, 13, H("#3e8948"))
        for bx in (cx - 1, cx + 3):
            c.ellipse(bx + 0.5, 15, 2.2, 2.2, H("#c41e3a"))
            c.px(bx, 14, H("#ff9eaa"))
        c.px(cx + 2, 8, H("#63c74d"))
        c.px(cx + 3, 8, H("#63c74d"))
    c.outline("k")
    c.save("sign_candy")


# ---------------------------------------------------------------- свет


def light_sconce():
    """Латунное бра: овальная розетка на стене, изогнутый рожок и матовый тюльпан с лампой."""
    c = Canvas(14, 22)
    brass, brass_hi, brass_lo = H("#d9a441"), H("#f5d27a"), H("#8c6421")
    # Розетка на стене.
    c.ellipse(3, 15, 2.2, 4, brass)
    c.vline(2, 13, 4, brass_hi)
    c.px(4, 18, brass_lo)
    # Рожок: вбок и вверх.
    c.hline(4, 16, 5, brass)
    c.hline(4, 17, 5, brass_lo)
    c.vline(9, 12, 5, brass)
    c.vline(10, 12, 5, brass_lo)
    c.rect(7, 11, 5, 2, brass)
    c.hline(7, 11, 5, brass_hi)
    # Тюльпан раскрывается вверх, сквозь матовое стекло светит лампа.
    for y in range(3, 11):
        half = 1 + (10 - y) * 0.45
        x0, x1 = round(9.5 - half), round(9.5 + half)
        for x in range(x0, x1 + 1):
            edge = x in (x0, x1)
            c.px(x, y, H("#f1ddb0") if edge else H("#fff6dc"))
    c.hline(6, 3, 8, H("#ffffff"))
    c.ellipse(9.5, 7, 1.4, 1.8, H("#ffd27a"))
    c.px(9, 6, H("#ffffff"))
    c.outline("k")
    c.save("light_sconce")


def light_pendant():
    """Лофт-лампа на шнуре: чёрный купол, лампа Эдисона с нитью накала."""
    c = Canvas(16, 26)
    c.vline(8, 0, 11, H("#262b44"))
    c.rect(7, 10, 3, 2, H("#3a4466"))
    for dy in range(6):
        half = 2 + dy
        c.hline(8 - half, 12 + dy, half * 2 + 1, H("#262b44"))
        c.px(8 - half, 12 + dy, H("#5a6988"))
    c.hline(1, 17, 15, H("#181425"))
    c.ellipse(8.5, 20, 2.6, 2.8, H("#ffd27a"))
    c.px(8, 19, H("#ffffff"))
    c.px(9, 20, H("#ff9a3c"))
    c.px(7, 21, H("#ff9a3c"))
    c.outline("k")
    c.save("light_pendant")


def light_lantern():
    """Кованый фонарь: крышка-колпак, четыре стекла с огоньком внутри."""
    c = Canvas(14, 24)
    iron, iron_hi = H("#262b44"), H("#5a6988")
    c.line(7, 0, 7, 3, iron)
    c.ellipse(7, 4, 2, 1.4, iron)
    for dy in range(3):
        c.hline(7 - 2 - dy * 2, 5 + dy, 5 + dy * 4, iron)
    c.hline(1, 7, 13, iron_hi)
    c.rect(2, 8, 11, 10, H("#ffe7a8"))
    c.rect(4, 10, 7, 6, H("#ffd27a"))
    c.ellipse(7.5, 13.5, 1.6, 2.4, H("#ffffff"))
    c.px(7, 11, H("#ff9a3c"))
    for x in (2, 7, 12):
        c.vline(x, 8, 10, iron)
    c.hline(2, 8, 11, iron)
    c.hline(1, 18, 13, iron)
    c.hline(3, 19, 9, iron_hi)
    c.px(7, 20, iron)
    c.outline("k")
    c.save("light_lantern")


def light_chandelier():
    """Хрустальная люстра: латунные рожки, свечи и подвески-капли."""
    c = Canvas(28, 24)
    brass, brass_hi = H("#d9a441"), H("#f5d27a")
    c.vline(14, 0, 6, brass)
    c.ellipse(14, 7, 2.5, 2, brass)
    c.px(13, 6, brass_hi)
    # Рожки.
    for x in (3, 8, 20, 25):
        c.line(14, 9, x, 11, brass)
    c.hline(3, 11, 23, brass)
    c.hline(3, 12, 23, H("#8c6421"))
    for x in (3, 8, 14, 20, 25):
        c.rect(x - 1, 8, 2, 3, H("#fff6dc"))
        c.px(x - 1, 7, H("#ffd27a"))
        c.px(x - 1, 6, H("#ffffff"))
    # Подвески.
    for x, length in ((5, 4), (9, 7), (14, 9), (19, 7), (23, 4), (11, 5), (17, 5)):
        for dy in range(length):
            c.px(x, 13 + dy, H("#c8fbff") if dy % 2 else H("#ffffff"))
        c.px(x, 13 + length, H("#7ad8ef"))
    c.ellipse(14, 22, 1.5, 1.5, H("#c8fbff"))
    c.outline("k")
    c.save("light_chandelier")


def light_garland():
    """Гирлянда 32×12 для повтора вдоль стены: провисший провод и разноцветные лампочки."""
    c = Canvas(32, 12)
    wire = H("#262b44")
    pts = []
    for x in range(32):
        y = 2 + round(4 * math.sin(math.pi * x / 32))
        pts.append(y)
        c.px(x, y, wire)
    colors = [H("#e43b44"), H("#feae34"), H("#63c74d"), H("#2ce8f5")]
    for i, x in enumerate((4, 12, 20, 28)):
        y = pts[x] + 1
        tone = colors[i]
        c.px(x, y, H("#5a6988"))
        c.rect(x - 1, y + 1, 3, 3, tone)
        c.px(x, y + 4, tone)
        c.px(x - 1, y + 1, lit(tone, 0.5))
        c.px(x + 1, y + 3, lit(tone, -0.3))
    c.save("light_garland")
    g = Canvas(32, 12)
    for i, x in enumerate((4, 12, 20, 28)):
        y = pts[x] + 3
        g.ellipse(x + 0.5, y, 3.2, 3.2, colors[i][:3] + (90,))
        g.rect(x - 1, y - 1, 3, 3, lit(colors[i], 0.6)[:3] + (220,))
    g.save("light_garland_lit")


# ---------------------------------------------------------------- украшения зала


def aquarium():
    """Аквариум на тумбе: вода с глубиной, водоросли, камни, пузырьки и рыбки."""
    c = Canvas(48, 40)
    # Тумба.
    c.rect(1, 28, 46, 11, H("#3b2a35"))
    c.hline(1, 28, 46, H("#73505f"))
    c.rect(4, 31, 19, 6, H("#4a3443"))
    c.rect(25, 31, 19, 6, H("#4a3443"))
    c.px(21, 34, H("#d9a441"))
    c.px(26, 34, H("#d9a441"))
    # Вода: светлее сверху, глубже снизу.
    for y in range(5, 27):
        c.hline(3, y, 42, mix(H("#7fd4f5"), H("#1e6fa8"), (y - 5) / 22))
    c.hline(3, 5, 42, H("#d8f6ff"))
    c.hline(3, 6, 42, H("#a8e6fa"))
    # Песок и камни.
    for x in range(3, 45):
        h = 2 + round(math.sin(x * 0.4) * 1)
        for y in range(27 - h, 27):
            c.px(x, y, H("#ead4aa") if y == 27 - h else H("#d8b88a"))
    for x, r in ((12, 2.4), (33, 3), (38, 1.8)):
        c.ellipse(x, 24, r, r * 0.8, H("#8b9bb4"))
        c.px(x - 1, 23, H("#c0cbdc"))
    # Водоросли.
    for x, hgt in ((7, 14), (10, 10), (30, 12), (41, 16)):
        for dy in range(hgt):
            sx = x + round(math.sin(dy * 0.6 + x) * 1)
            c.px(sx, 25 - dy, H("#3e8948") if dy % 3 else H("#63c74d"))
    # Рыбки.
    fish = [(17, 12, H("#f77622"), H("#ffffff")), (28, 17, H("#fee761"), H("#feae34")), (22, 21, H("#e43b44"), H("#ffffff"))]
    for fx, fy, body, fin in fish:
        c.ellipse(fx, fy, 3, 1.8, body)
        c.px(fx - 4, fy - 1, fin)
        c.px(fx - 4, fy + 1, fin)
        c.px(fx - 3, fy, body)
        c.px(fx + 1, fy - 1, H("#181425"))
        c.px(fx, fy + 1, lit(body, -0.2))
    for x, y in ((36, 9), (37, 12), (35, 15), (14, 8)):
        c.px(x, y, H("#ffffff"))
    # Стекло: рамка и блики.
    c.frame(2, 4, 44, 24, H("#262b44"))
    c.hline(2, 3, 44, H("#5a6988"))
    for i in range(6):
        c.px(5 + i, 20 - i * 2, H("#e8fbff"))
    c.vline(43, 7, 18, H("#bfefff"))
    c.outline("k")
    shadowed(c, 24, 39, 22, 2).save("aquarium")


def fountain():
    """Фонтанчик из камня: чаша на ножке, струйки и бирюзовая вода в бассейне."""
    c = Canvas(40, 40)
    stone, stone_hi, stone_lo = H("#c0cbdc"), H("#e7edf5"), H("#8b9bb4")
    # Бассейн.
    c.ellipse(20, 31, 18, 7, stone_lo)
    c.ellipse(20, 30, 18, 7, stone)
    c.ellipse(20, 29.5, 15.5, 5.2, H("#2a8fbf"))
    c.ellipse(20, 29, 13, 4, H("#4fc3e8"))
    c.hline(10, 26, 20, stone_hi)
    for x, y in ((12, 29), (27, 30), (18, 31), (24, 28)):
        c.px(x, y, H("#c8fbff"))
    # Ножка и чаша.
    c.rect(18, 15, 5, 13, stone)
    c.vline(18, 15, 13, stone_hi)
    c.vline(22, 15, 13, stone_lo)
    c.ellipse(20.5, 14, 9, 3.2, stone_lo)
    c.ellipse(20.5, 13, 9, 3, stone)
    c.ellipse(20.5, 12.6, 7, 1.8, H("#4fc3e8"))
    # Струи.
    for side in (-1, 1):
        for i in range(10):
            x = 20 + side * (2 + i)
            y = 6 + round((i - 3) ** 2 / 4)
            c.px(x, y, H("#c8fbff") if i % 2 else H("#7ad8ef"))
    c.vline(20, 2, 10, H("#c8fbff"))
    c.px(20, 1, H("#ffffff"))
    c.outline("k")
    shadowed(c, 20, 37, 18, 2.5).save("fountain")


def jukebox():
    """Музыкальный автомат: арка с радужной подсветкой, хромированная решётка и пластинка."""
    c = Canvas(30, 44)
    body, body_hi = H("#7a2a1e"), H("#a8452f")
    c.rect(2, 12, 26, 30, body)
    c.ellipse(15, 13, 13, 11, body)
    c.vline(3, 12, 30, body_hi)
    # Радужная арка.
    rainbow = [H("#e43b44"), H("#f77622"), H("#fee761"), H("#63c74d"), H("#2ce8f5"), H("#b55088")]
    for i, tone in enumerate(rainbow):
        r = 12 - i * 0.9
        for a in range(0, 181, 3):
            x = 15 + r * math.cos(math.radians(a))
            y = 13 - r * 0.9 * math.sin(math.radians(a))
            c.px(round(x), round(y), tone)
    # Окно с пластинкой.
    c.ellipse(15, 14, 5.5, 4.5, H("#262b44"))
    c.ellipse(15, 14.5, 4, 2, H("#181425"))
    c.px(15, 14, H("#e43b44"))
    c.px(12, 13, H("#5a6988"))
    # Панель кнопок.
    c.rect(6, 20, 18, 4, H("#f1ddb0"))
    for x in range(7, 23, 3):
        c.px(x, 21, H("#e43b44"))
        c.px(x + 1, 22, H("#181425"))
    # Хромированная решётка динамика.
    c.rect(6, 26, 18, 12, H("#c0cbdc"))
    for x in range(7, 24, 2):
        c.vline(x, 27, 10, H("#8b9bb4"))
    c.hline(6, 26, 18, H("#ffffff"))
    for y in (25, 38):
        c.hline(4, y, 22, H("#feae34"))
    c.rect(2, 40, 26, 3, H("#3b2a35"))
    c.outline("k")
    shadowed(c, 15, 43, 14, 2).save("jukebox")


def lucky_cat(paw_up):
    """Кот-удача на подставке: машет лапкой (два кадра)."""
    c = Canvas(26, 34)
    white, shade, red, gold = H("#ffffff"), H("#dadde6"), H("#e43b44"), H("#feae34")
    # Подставка.
    c.rect(3, 27, 20, 6, red)
    c.hline(3, 27, 20, H("#ff7a82"))
    c.hline(3, 32, 20, H("#a22633"))
    c.hline(5, 29, 16, gold)
    # Тело и голова.
    c.ellipse(13, 21, 7.5, 6.5, white)
    c.ellipse(13, 11, 7, 6, white)
    c.stamp(["w...w", "ww.ww"], 8, 4)
    for x, y in ((8, 4), (17, 4)):
        c.px(x + 1, y + 1, H("#f6a5b5"))
    c.ellipse(16.5, 22, 3, 4, shade)
    # Мордочка: закрытые довольные глазки, нос и усы.
    for ex in (10, 15):
        c.px(ex, 11, H("#181425"))
        c.px(ex + 1, 10, H("#181425"))
        c.px(ex + 2, 11, H("#181425"))
    c.px(13, 13, H("#f6757a"))
    c.hline(5, 13, 3, shade)
    c.hline(19, 13, 3, shade)
    c.ellipse(9.5, 14, 1.2, 0.8, H("#ffc4bc"))
    c.ellipse(17.5, 14, 1.2, 0.8, H("#ffc4bc"))
    # Ошейник с колокольчиком и монетка-кобан.
    c.hline(8, 16, 11, red)
    c.ellipse(13, 18, 1.4, 1.4, gold)
    c.rect(9, 20, 6, 6, gold)
    c.frame(9, 20, 6, 6, H("#b8862b"))
    c.px(11, 22, H("#fff2a8"))
    # Лапка: поднята или опущена.
    if paw_up:
        c.ellipse(21, 8, 2.4, 2.4, white)
        c.rect(19, 9, 4, 8, white)
        c.px(21, 7, H("#f6a5b5"))
    else:
        c.ellipse(21, 11, 2.4, 2.4, white)
        c.rect(19, 12, 4, 6, white)
        c.px(21, 10, H("#f6a5b5"))
    c.outline("k")
    shadowed(c, 13, 33, 11, 1.8).save("lucky_cat" if paw_up else "lucky_cat2")


def gumball():
    """Автомат с жвачкой: стеклянный шар с разноцветными шариками на красной ножке."""
    c = Canvas(22, 40)
    c.ellipse(11, 11, 9, 9, H("#d8f2fb"))
    rnd = random.Random(3)
    balls = [H("#e43b44"), H("#fee761"), H("#63c74d"), H("#2ce8f5"), H("#f77622"), H("#b55088"), H("#ffffff")]
    for y in range(18, 4, -2):
        for x in range(3, 20, 2):
            if (x + 0.5 - 11) ** 2 + (y + 0.5 - 11) ** 2 < 64 and y > 6:
                tone = rnd.choice(balls)
                c.rect(x, y, 2, 2, tone)
                c.px(x, y, lit(tone, 0.45))
    for i in range(4):
        c.px(5 + i, 8 - i, H("#ffffff"))
    c.ellipse(11, 2.5, 3, 1.5, H("#e43b44"))
    c.rect(4, 19, 14, 3, H("#a22633"))
    c.rect(5, 22, 12, 9, H("#e43b44"))
    c.vline(6, 22, 9, H("#ff7a82"))
    c.ellipse(11, 25, 2, 2, H("#c0cbdc"))
    c.px(11, 25, H("#5a6988"))
    c.rect(9, 28, 4, 2, H("#262b44"))
    c.rect(8, 31, 6, 5, H("#a22633"))
    c.rect(4, 36, 14, 3, H("#a22633"))
    c.hline(4, 36, 14, H("#e43b44"))
    c.outline("k")
    shadowed(c, 11, 39, 9, 1.6).save("gumball")


def main():
    wall_brick()
    wall_walnut()
    wall_metro()
    wall_damask()
    wall_provence()
    floor_chevron()
    floor_terracotta()
    floor_azulejo()
    marble("floor_noir", H("#2a2833"), H("#15141b"), H("#a8863f"), H("#4a4757"), H("#0d0c12"), 61)
    marble("floor_gold", H("#fbf1dc"), H("#e9d6b0"), H("#c9963a"), H("#e3c27a"), H("#c8a768"), 19)
    sign_wood()
    sign_neon()
    sign_gold()
    sign_marquee()
    sign_candy()
    light_sconce()
    light_pendant()
    light_lantern()
    light_chandelier()
    light_garland()
    aquarium()
    fountain()
    jukebox()
    lucky_cat(True)
    lucky_cat(False)
    gumball()


if __name__ == "__main__":
    main()
