"""Лица портретов 64×64 (portrait_*.png): у каждого героя своё лицо, а не один шаблон на всех.

Портрет собирает sprites.portrait(): силуэт и причёска рисуются в сетке 32×32 и увеличиваются вдвое, лицо -
в полном размере. Здесь всё про лицо: овал головы и уши (head, сетка 32×32, до причёски) и само лицо
(face, сетка 64×64): глаза, брови, нос, рот, румянец и приметы, потом свои детали героев сюжета (EXTRAS).

Сетку двигать нельзя - диалог моргает и говорит поверх картинки (src/ui/dialog.ts, EYES и EYE_TOP):
  глаза - коробки 4×5 с левым краем x=24 и x=38, строки 27..31 (веко закрашивается цветом кожи под глазом,
  поэтому в точках (25, 34) и (39, 34) только кожа - можно чуть темнее, но без веснушек и родинок);
  рот - по центру: открытый рот рисуется в x 30..34, строки 38..40.
Внутри сетки меняется всё остальное: форма головы и подбородка, уши, разрез и цвет глаз, ресницы, тяжёлые
и опущенные веки, взгляд вбок, брови (тонкие, густые, лохматые, дугой, прямые, седые), нос (кнопкой,
маленький, длинный, широкий, с горбинкой, картошкой), ширина рта и губы, румянец, возраст (мешки под глазами,
гусиные лапки, складки у рта, морщины на лбу), веснушки, родинка, ямочки, щетина, скулы, шрам.

Черты - в таблице LOOKS по имени портрета: там герои сюжета и все, кто приходит в игру. Чего в строке нет,
берётся из устойчивого хэша имени (md5: встроенный hash() меняется от запуска к запуску), так что новый
персонаж без строки тоже получает своё лицо. Настроения (happy, sad, angry, surprised) - одно и то же лицо.

Модуль сам ничего не сохраняет: перерисовать портреты - запустить модули с portrait() (см. grep "portrait(").
"""

import hashlib

INK = (24, 20, 37, 255)
WHITE = (255, 255, 255, 255)
CLEAR = (0, 0, 0, 0)


def H(hex_):
    return (int(hex_[1:3], 16), int(hex_[3:5], 16), int(hex_[5:7], 16), 255)


def shade(color, k):
    return tuple(max(0, min(255, int(v * k))) for v in color[:3]) + (255,)


def mix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)


GOLD = H("#feae34")
LIP = (200, 80, 90, 255)
# Радужка: цвета палитры Endesga 32. auto - как раньше, по цвету волос.
IRIS = {
    "blue": H("#124e89"),
    "sky": H("#0099db"),
    "green": H("#3e8948"),
    "grey": H("#5a6988"),
    "hazel": H("#8f563b"),
    "brown": H("#733e39"),
    "dark": H("#3e2731"),
}
FRECKLE = H("#b86f50")


# ---------------------------------------------------------------- овал головы (сетка 32×32)
#
# Голова по умолчанию - овал x 9..22, строки 6..21 (подбородок), уши в (8, 14) и (24, 14), шея x 13..18 со строки 21.
# Форма задаётся строками: {строка: (левый край, правый край)}. Лишняя кожа срезается, недостающая
# дорисовывается (правая половина - в тени, свет слева сверху), уши переезжают к новым краям.


def _spans(p, skin, rows):
    lit, dark = skin, shade(skin, 0.92)
    tones = {skin, dark}
    for y, (lo, hi) in rows.items():
        for x in range(6, 26):
            here = p.get(x, y)
            if lo <= x <= hi:
                if here not in tones:
                    p.px(x, y, lit if x < 17 else dark)
            elif here in tones:
                p.px(x, y, CLEAR)
    if 14 in rows:
        lo, hi = rows[14]
        for x in (7, 8, 24, 25):
            if not lo <= x <= hi and p.get(x, 14) in (skin, shade(skin, 0.9)):
                p.px(x, 14, CLEAR)
        p.px(lo - 1, 14, skin)
        p.px(hi + 2, 14, shade(skin, 0.9))


def head_chubby(p, skin):
    """Мягкие полные щёки, округлый подбородок (бабушка)."""
    p.ellipse(16, 17, 8, 5, skin)
    p.ellipse(20.5, 18, 3, 4, shade(skin, 0.92))


def head_round(p, skin):
    """Круглое лицо (Валя)."""
    p.ellipse(16, 15, 8.2, 7.5, skin)
    p.ellipse(20.5, 16, 3, 5.5, shade(skin, 0.92))


def head_square(p, skin):
    """Широкая квадратная челюсть (Марат)."""
    p.rect(9, 14, 14, 6, skin)
    p.rect(10, 20, 12, 2, skin)
    p.rect(20, 14, 3, 7, shade(skin, 0.92))


def head_narrow(p, skin):
    """Узкое лицо с острым подбородком: срезаем щёки (Эдуард)."""
    for y, (lo, hi) in ((17, (10, 21)), (18, (10, 21)), (19, (11, 20)), (20, (12, 19)), (21, (13, 18)), (22, (14, 17))):
        for x in range(6, 26):
            if x < lo or x > hi:
                p.px(x, y, CLEAR)


def head_child(p, skin):
    """Детские щёки, маленький подбородок (Соня)."""
    p.ellipse(16, 16, 7.8, 6.5, skin)
    p.ellipse(20, 17, 3, 4.5, shade(skin, 0.93))


SHAPES = {
    # Овал шире к низу: полные щёки, круглый подбородок.
    "full": {y: (9, 22) for y in range(12, 20)} | {20: (10, 21), 21: (11, 20)},
    # Длинное лицо: щёки уже, подбородок ниже на строку.
    "long": {15: (10, 21), 16: (10, 21), 17: (10, 21), 18: (10, 21), 19: (10, 21), 20: (11, 20), 21: (11, 20), 22: (13, 18)},
    # Сердечком: широкие скулы, узкий острый подбородок.
    "heart": {y: (8, 23) for y in range(11, 16)} | {16: (9, 22), 17: (10, 21), 18: (10, 21), 19: (11, 20), 20: (12, 19), 21: (13, 18)},
    # Широкое лицо целиком.
    "wide": {y: (8, 23) for y in range(10, 18)} | {18: (9, 22), 19: (9, 22), 20: (10, 21), 21: (12, 19)},
    # Тяжёлая нижняя часть: брыли, широкий подбородок.
    "jowl": {y: (8, 23) for y in range(15, 20)} | {20: (9, 22), 21: (11, 20)},
    # Худое: впалые щёки, прямые бока, подбородок чуть ниже.
    "lean": {y: (10, 21) for y in range(15, 20)} | {20: (11, 20), 21: (12, 19), 22: (13, 18)},
    # Квадратная челюсть без нижней ступеньки.
    "jaw": {y: (9, 22) for y in range(14, 20)} | {20: (10, 21), 21: (10, 21)},
}

HEADS = {"oval": None, "chubby": head_chubby, "round": head_round, "square": head_square, "narrow": head_narrow, "child": head_child}


def head(name, p, skin):
    """Овал головы и уши - до причёски, в сетке 32×32."""
    look = look_of(name)
    shape = look["head"]
    if shape in SHAPES:
        _spans(p, skin, SHAPES[shape])
    elif HEADS.get(shape):
        HEADS[shape](p, skin)
    if look.get("ears") == "big":
        # Лопоухие: ухо на клетку длиннее вниз. У узкого лица щека на этой строке уже уха -
        # промежуток до щеки тоже кожа, иначе между ухом и лицом просвечивает фон.
        left = next(x for x in range(4, 16) if p.get(x, 14)[3])
        right = next(x for x in range(28, 16, -1) if p.get(x, 14)[3])
        for x, color, step in ((left, skin, 1), (right, shade(skin, 0.9), -1)):
            while not p.get(x, 15)[3]:
                p.px(x, 15, color)
                x += step


# ---------------------------------------------------------------- выбор черт


HASHED = {
    "head": ("oval", "full", "long", "heart", "wide", "jowl", "lean", "jaw", "oval"),
    "iris": ("auto", "blue", "green", "grey", "hazel", "brown", "auto", "sky"),
    "brow": ("std", "arch", "thick", "straight", "short", "std"),
    "nose": ("std", "button", "long", "wide", "hooked", "small", "std"),
    "mouth": ("smile", "small", "wide", "flat", "smile"),
    "blush": ("soft", "soft", "none"),
}
MOLES = ((27, 37), (41, 36), (37, 40), (22, 33), (43, 38))


def look_of(name):
    h = hashlib.md5(name.encode()).digest()
    look = {key: opts[h[i] % len(opts)] for i, (key, opts) in enumerate(HASHED.items())}
    look.update(eye="std", lash=False, lips=None, gaze=0, ears=None, brow_col=None, brow_dy=0, marks=(), specs=None, mole=None)
    if name not in LOOKS:
        # Новый герой без строки: родинка и веснушки - тоже по хэшу. У тех, кто в таблице, - только как записано.
        if h[8] % 4 == 0:
            look["mole"] = MOLES[h[9] % len(MOLES)]
        if h[10] % 7 == 0:
            look["marks"] = ("freckles",)
    row = LOOKS.get(name, {})
    age = row.get("age")
    if age == "kid":
        look.update(head="child", eye="big", nose="button", blush="kid", mouth="small")
    elif age == "old":
        look.update(eye="droop", marks=("bags", "fold"))
    look.update(row)
    if look["specs"]:
        # За стёклами мешки и «лапки» только рябят у оправы.
        look["marks"] = tuple(m for m in look["marks"] if m not in ("bags", "crow"))
    return look


# ---------------------------------------------------------------- лицо (сетка 64×64)

EYES = (24, 38)


def face(name, b, skin, hair, mood):
    """Лицо портрета: глаза 4×5 в сетке диалога, брови по настроению, нос, рот, румянец, приметы."""
    look = look_of(name)
    tones = {skin, shade(skin, 0.92), shade(skin, 0.93), shade(skin, 0.9), shade(skin, 1.07)}

    def dab(x, y, color):
        """Только по коже: не залезть на контур, волосы и бороду."""
        if b.get(x, y) in tones:
            b.px(x, y, color)

    def dim(x, y, k):
        """Темнее той кожи, что под точкой (на светлой и на теневой половине лица одинаково заметно)."""
        here = b.get(x, y)
        if here in tones:
            b.px(x, y, shade(here, k))

    marks = set(look["marks"])
    old = look.get("age") == "old"
    _under(b, skin, look, marks, mood, dim)
    _eyes(b, skin, hair, look, mood)
    _brows(b, skin, hair, look, mood, old)
    _nose(b, skin, look)
    _mouth(b, skin, look, mood)
    _blush(b, look, mood, dab)
    _over(b, skin, look, marks, mood, dab, dim)
    if look["specs"] == "wire":
        _wire_specs(b, skin)
    if name in EXTRAS:
        EXTRAS[name](b, skin, hair, mood)


# Морщины и тени - цельные штрихи одним тоном, зеркально слева и справа (не россыпь точек).
WRINKLES = {
    "bags": [(x, 33) for x in range(24, 28)] + [(x, 33) for x in range(38, 42)],
    "crow": ((22, 31), (21, 32), (43, 31), (44, 32)),
    "fold": ((27, 36), (26, 37), (26, 38), (37, 36), (38, 37), (38, 38)),
    "cheek": ((21, 36), (22, 37), (23, 38), (43, 36), (42, 37), (41, 38)),
    "chin2": [(x, 45) for x in range(29, 36)] + [(28, 44), (36, 44)],
}
AGE_MARKS = ("bags", "crow", "fold", "cheek", "lines", "chin2")
STUBBLE = H("#5a6988")


def _under(b, skin, look, marks, mood, dim):
    """Приметы под глазами, бровями и ртом: возраст, скулы, щетина."""
    tones = (skin, shade(skin, 0.92), shade(skin, 0.93), shade(skin, 0.9))
    if "lines" in marks:
        # Морщины на лбу - две дужки, если лоб открыт; под чёлкой не рисуем обрывки.
        for line in ([(x, 21 if 29 <= x <= 35 else 22) for x in range(27, 38) if x != 32], [(x, 19) for x in range(29, 36)]):
            if all(b.get(x, y) in tones for x, y in line):
                for x, y in line:
                    dim(x, y, 0.88)
    for mark, pts in WRINKLES.items():
        if mark in marks:
            for x, y in pts:
                dim(x, y, 0.85)
    if "stubble" in marks:
        # Щетина: челюсть, подбородок и над губой ровно сизые, по линии челюсти - редкие точки.
        for y in range(35, 48):
            for x in range(16, 49):
                jaw = y >= 40 or (y >= 36 and (x <= 22 or x >= 42)) or (36 <= y <= 37 and 28 <= x <= 36)
                here = b.get(x, y)
                if jaw and here in tones:
                    b.px(x, y, mix(here, STUBBLE, 0.18))
        tinted = {mix(t, STUBBLE, 0.18) for t in tones}
        for x, y in ((21, 40), (24, 43), (28, 45), (36, 45), (40, 43), (43, 40)):
            if b.get(x, y) in tinted:
                b.px(x, y, shade(b.get(x, y), 0.82))
    if "cleft" in marks:
        dim(32, 43, 0.82)
        dim(32, 44, 0.86)


def _iris(hair, look):
    if look["iris"] in IRIS:
        return IRIS[look["iris"]]
    return shade(hair, 0.9) if sum(hair[:3]) < 450 else H("#5a4a3c")


def _eyes(b, skin, hair, look, mood):
    iris = _iris(hair, look)
    kind = look["eye"]
    if mood == "surprised":
        kind = "big" if kind == "big" else "wide"
    for side, ex in ((-1, 24), (1, 38)):
        outer = ex - 1 if side < 0 else ex + 4
        if mood == "happy":
            # Прищур от улыбки: глаза-дужки.
            b.hline(ex, 30, 4, INK)
            b.px(ex - 1, 31, INK)
            b.px(ex + 4, 31, INK)
            if look["lash"]:
                b.px(outer + side, 30, INK)
            continue
        if kind == "dot":
            # Глазки-бусинки без белка: тёмный зрачок с бликом под коротким веком (добряки, весельчаки).
            ix = ex + 1 + look["gaze"]
            b.hline(ex, 28, 4, shade(skin, 0.62))
            b.rect(ix, 29, 2, 3, INK)
            b.px(ix, 29, WHITE)
            b.hline(ex, 32, 4, shade(skin, 0.88))
            continue
        top = 27 if kind == "wide" else 29 if kind == "narrow" else 28
        b.rect(ex, top, 4, 32 - top, WHITE)
        # Радужка 2 клетки шириной, снизу - зрачок; взгляд вбок сдвигает её к краю.
        ix = ex + 1 + look["gaze"]
        it = top if kind in ("big", "narrow") else top + 1
        b.rect(ix, it, 2, 31 - it, iris)
        b.px(ix, 31, INK)
        b.px(ix + 1, 31, INK)
        b.px(ix, it, WHITE)
        if kind == "big":
            b.px(ix + 1, 30, mix(iris, WHITE, 0.45))
        # Верхнее веко.
        if kind == "droop":
            # Внешний уголок опущен: усталый, пожилой взгляд.
            b.hline(ex - 1 if side > 0 else ex, top - 1, 5, INK)
            b.px(outer, top, INK)
            b.px(ex if side < 0 else ex + 3, top, shade(skin, 0.86))
        else:
            b.hline(ex - 1, top - 1, 6, INK)
        if kind == "narrow":
            # Тяжёлое веко складкой над глазом.
            b.hline(ex, top - 2, 4, shade(skin, 0.86))
        if look["lash"]:
            b.px(outer + side, top - 2, INK)
            b.px(outer, top - 1, INK)
        b.hline(ex, 32, 4, shade(skin, 0.85))


def _brow_color(hair, look, old):
    if look["brow_col"]:
        return H(look["brow_col"])
    greyish = max(hair[:3]) - min(hair[:3]) < 45 and sum(hair[:3]) > 420
    if old and greyish:
        # Седые брови - тёмно-серые: светлая полоска на коже не читается, а брови несут настроение.
        return shade(hair, 0.45)
    return shade(hair, 0.7) if sum(hair[:3]) < 600 else H("#5a4a52")


# Брови: ширина (клеток от внешнего края), второй ряд (None - одна линия, "dark" - тем же тоном,
# "soft" - чуть светлее) и сдвиг по высоте вдоль брови от внешнего края к внутреннему.
BROWS = {
    "std": (5, "soft", None),
    "thin": (5, None, None),
    "thick": (6, "dark", None),
    "bushy": (6, "dark", None),
    "straight": (5, "soft", None),
    "short": (3, "dark", None),
    # Дуга: хвостик ниже, середина выше, к переносице - двойная линия.
    "arch": (6, "arch", (1, 0, -1, -1, 0, 0)),
    "angled": (5, "dark", None),
}


def _brows(b, skin, hair, look, mood, old):
    brow = _brow_color(hair, look, old)
    style = look["brow"]
    width, second, bend = BROWS[style]
    base = {"straight": (25, 25, 25, 25), "angled": (23, 25, 25, 23)}.get(style, (25, 24, 24, 25))
    lift = {"happy": (24, 24, 24, 24), "sad": (26, 23, 23, 26), "angry": (23, 26, 26, 23), "surprised": (22, 22, 22, 22)}.get(mood, base)
    lift = tuple(v + look["brow_dy"] for v in lift)
    # (внешний край, внутренний край) по x для левой и правой брови.
    spans = ((28 - width, 27), (36 + width, 37))
    for (xo, xi), (yo, yi) in ((spans[0], lift[:2]), (spans[1], lift[3:1:-1])):
        step = 1 if xi > xo else -1
        xs = list(range(xo, xi + step, step))
        for i, x in enumerate(xs):
            y = round(yo + (yi - yo) * i / (len(xs) - 1))
            if bend:
                y += bend[i]
            y = min(y, 26)
            b.px(x, y, brow)
            if second == "soft":
                b.px(x, y + 1, shade(brow, 1.15))
            elif second == "dark" or (second == "arch" and i >= 2):
                b.px(x, y + 1, brow)
        if style == "bushy":
            # Лохматые: торчащие волоски над внешним краем и у переносицы.
            yo2 = min(round(yo), 26)
            b.px(xo + step, yo2 - 1, brow)
            b.px(xo + 3 * step, yo2 - 1, shade(brow, 1.15))
            b.px(xo, yo2 + 1, shade(brow, 1.15))


# Нос: карта 5×6 от (30, 31) - h блик, s полутень, S тень, D ноздря.
NOSES = {
    "std": [".....", ".h...", "...S.", "..sS."],
    "button": [".....", ".....", "..h..", ".sSs.", "..s.."],
    "small": [".....", ".....", "..h..", "..sS."],
    "long": ["..h..", "..hS.", "...S.", "...S.", ".sDS."],
    "wide": [".....", "..h..", "..hS.", "sD.DS", ".sss."],
    "hooked": ["..S..", "..hS.", "..hSS", "..DS.", "..s.."],
    "potato": [".....", "..hs.", ".hsSs", ".sSSs", "..sD."],
}


def _nose(b, skin, look):
    tone = {"h": shade(skin, 1.06), "s": shade(skin, 0.86), "S": shade(skin, 0.78), "D": shade(skin, 0.66)}
    for dy, row in enumerate(NOSES[look["nose"]]):
        for dx, ch in enumerate(row):
            if ch != ".":
                b.px(30 + dx, 31 + dy, tone[ch])


def _mouth(b, skin, look, mood):
    mouth = shade(skin, 0.5)
    kind = look["mouth"]
    lips = look["lips"]
    w = {"wide": 1, "small": -1}.get(kind, 0)
    if mood == "happy":
        if kind in ("flat", "stern", "smirk"):
            # Сдержанный человек улыбается, не показывая зубов.
            b.hline(29, 39, 7, mouth)
            b.hline(30, 40, 5, mouth)
            b.px(28, 38, mouth)
            b.px(36, 38, mouth)
            b.px(27, 37, mouth)
            b.px(37, 37, mouth)
            return
        a, n = 28 - w, 9 + 2 * w
        b.hline(a, 38, n, INK)
        b.hline(a, 39, n, mouth)
        b.hline(a + 1, 39, n - 2, WHITE)
        b.hline(a + 1, 40, n - 2, mouth)
        b.hline(a + 2, 41, n - 4, LIP if lips == "paint" else (200, 80, 90, 255))
        b.hline(a + 2, 42, n - 4, INK)
        b.px(a - 1, 37, INK)
        b.px(a + n, 37, INK)
    elif mood == "sad":
        b.hline(30, 39, 5, mouth)
        b.px(29, 40, mouth)
        b.px(35, 40, mouth)
        # Слезинка.
        b.px(40, 33, H("#9cd8ff"))
        b.px(40, 34, H("#5fb4f0"))
    elif mood == "angry":
        b.hline(29, 40, 7, mouth)
        b.hline(30, 39, 5, WHITE)
        b.px(28, 41, mouth)
        b.px(36, 41, mouth)
    elif mood == "surprised":
        b.rect(30, 38, 5, 5, INK)
        b.rect(31, 39, 3, 3, H("#7a2a35"))
        b.px(32, 41, LIP)
    else:
        line = LIP if lips == "paint" else mouth
        a, n = 29 - w, 7 + 2 * w
        b.hline(a, 39, n, line)
        if kind == "stern":
            b.px(a - 1, 40, line)
            b.px(a + n, 40, line)
        elif kind == "smirk":
            b.px(a + n, 38, line)
            b.px(a + n + 1, 37, shade(skin, 0.7))
        elif kind != "flat":
            b.px(a - 1, 38, line)
            b.px(a + n, 38, line)
    # Губы: нижняя - полоской под ртом (у накрашенных - цветом помады).
    if lips and mood in (None, "sad"):
        lower = mix(skin, LIP, 0.55 if lips == "paint" else 0.3)
        b.hline(30, 40 if mood is None else 41, 5, lower)
        if lips == "paint" and mood is None:
            b.px(31, 40, mix(lower, WHITE, 0.35))


def _blush(b, look, mood, dab):
    kind = look["blush"]
    happy = mood == "happy"
    if kind == "none":
        if not happy:
            return
        kind = "faint"
    pink = (232, 120, 130, 255) if happy or kind == "rosy" else (240, 150, 150, 255)
    for cx in (21, 43):
        if kind == "faint":
            pts = [(cx - 1, 35), (cx, 35)]
        elif kind == "rosy":
            pts = [(cx + dx, 35) for dx in range(-2, 2)] + [(cx - 1, 36), (cx, 36)]
        elif kind == "kid":
            pts = [(cx + dx, 35) for dx in range(-1, 2)] + [(cx + dx, 36) for dx in range(-1, 2)]
        else:
            pts = [(cx + dx, 35) for dx in range(-2 if happy else -1, 2)]
        for x, y in pts:
            dab(x, y, pink)


def _over(b, skin, look, marks, mood, dab, dim):
    """Приметы поверх: веснушки, родинка, ямочки, шрам."""
    if "freckles" in marks:
        dot = mix(skin, FRECKLE, 0.5)
        for x, y in ((21, 34), (23, 35), (22, 36), (28, 34), (36, 34), (42, 34), (44, 35), (41, 36)):
            dab(x, y, dot)
    if look.get("mole"):
        x, y = look["mole"]
        dab(x, y, shade(skin, 0.5))
    if "dimples" in marks and mood in (None, "happy"):
        dim(26 if mood is None else 25, 39, 0.82)
        dim(38 if mood is None else 39, 39, 0.82)
    if "scar" in marks:
        # Шрам наискось по левой щеке: светлый рубец с тёмной кромкой, только по коже.
        scar = mix(skin, WHITE, 0.4)
        for x, y in ((21, 33), (21, 34), (22, 35), (22, 36), (23, 37)):
            dab(x, y, scar)
        for x, y in ((22, 33), (22, 34), (23, 36)):
            dab(x, y, shade(skin, 0.8))


def _wire_specs(b, skin):
    """Тонкие очки в золотой оправе вокруг глаз: сами глаза видны, моргание - внутри стёкол."""
    rim, glint = H("#8f563b"), H("#feae34")
    for x0 in (22, 36):
        b.hline(x0 + 1, 26, 6, rim)
        b.hline(x0 + 1, 33, 6, rim)
        b.vline(x0, 27, 6, rim)
        b.vline(x0 + 7, 27, 6, rim)
        b.px(x0 + 1, 26, glint)
        b.px(x0, 27, glint)
    b.hline(30, 28, 6, rim)
    tones = {skin, shade(skin, 0.92), shade(skin, 0.9), shade(skin, 0.93), shade(skin, 1.07)}
    for x in (19, 20, 21, 44, 45, 46):
        if b.get(x, 28) in tones:
            b.px(x, 28, rim)


# ---------------------------------------------------------------- свои детали героев сюжета
# Поверх лица: серьги, брошь, платок, усмешка - то, чего нет в общих чертах.


def extra_grandma(b, skin, hair, mood):
    line = shade(skin, 0.8)
    soft = shade(skin, 0.89)
    # «Гусиные лапки», мешочки под глазами, складки у рта и подбородок.
    for x, y in ((22, 30), (21, 31), (43, 30), (44, 31)):
        b.px(x, y, line)
    for ex in (24, 38):
        b.hline(ex, 34, 4, soft)
    for x, y in ((27, 36), (26, 37), (26, 38), (38, 36), (39, 37), (39, 38)):
        b.px(x, y, line)
    b.hline(30, 44, 5, soft)
    # Брошь на кофте.
    b.rect(31, 54, 3, 3, GOLD)
    b.px(32, 55, H("#e43b44"))
    b.px(31, 54, H("#fff0b0"))


def extra_valya(b, skin, hair, mood):
    # Серьги-капли, ресницы, родинка, помада.
    for x in (17, 46):
        b.rect(x, 33, 2, 2, GOLD)
        b.px(x, 35, H("#fff0b0"))
    if mood != "happy":
        b.px(23, 27, INK)
        b.px(42, 27, INK)
    b.px(41, 36, shade(skin, 0.5))
    for x, y in ((27, 36), (38, 36)):
        b.px(x, y, shade(skin, 0.86))
    if mood is None:
        b.hline(30, 40, 5, LIP)


def extra_marat(b, skin, hair, mood):
    dot = shade(skin, 0.8)
    # Щетина по челюсти и ямочки.
    for x, y in ((22, 41), (25, 43), (28, 44), (36, 44), (39, 43), (42, 41)):
        b.px(x, y, dot)
    for x, y in ((26, 37), (39, 37)):
        b.px(x, y, shade(skin, 0.84))
    # Красный шейный платок повара.
    red = H("#e43b44")
    b.rect(26, 47, 12, 3, red)
    b.hline(26, 49, 12, shade(red, 0.78))
    b.rect(30, 50, 4, 3, red)
    b.px(31, 51, shade(red, 0.78))


def extra_eduard(b, skin, hair, mood):
    line = shade(skin, 0.84)
    # Скулы, тени под глазами, седые виски.
    for x, y in ((22, 35), (23, 36), (24, 37), (42, 35), (41, 36), (40, 37)):
        b.px(x, y, line)
    for ex in (24, 38):
        b.hline(ex, 33, 4, shade(skin, 0.88))
    grey = H("#8b9bb4")
    for x in (17, 46):
        b.vline(x, 19, 4, grey)
    # Усмешка на одну сторону - только в спокойном лице.
    if mood is None:
        b.px(28, 38, skin)
        b.px(37, 37, shade(skin, 0.5))


def extra_inspector(b, skin, hair, mood):
    # Строгий взгляд из-под век, тонкие губы, родинка, белый воротничок.
    if mood in (None, "angry", "sad"):
        for ex in (24, 38):
            b.hline(ex, 28, 4, shade(skin, 0.8))
    if mood is None:
        b.hline(30, 40, 5, LIP)
    b.px(27, 37, shade(skin, 0.55))
    white = H("#ffffff")
    for i in range(4):
        b.hline(25 + i, 49 + i, 3, white)
        b.hline(36 - i, 49 + i, 3, white)


def extra_sonya(b, skin, hair, mood):
    # Веснушки.
    dot = shade(skin, 0.8)
    for x, y in ((22, 35), (24, 36), (26, 35), (39, 35), (41, 36), (43, 35)):
        b.px(x, y, dot)


EXTRAS = {
    "grandma": extra_grandma,
    "valya": extra_valya,
    "marat": extra_marat,
    "eduard": extra_eduard,
    "inspector": extra_inspector,
    "sonya": extra_sonya,
}


# ---------------------------------------------------------------- кто как выглядит
#
# head   овал: oval, full, long, heart, wide, jowl, lean, jaw; у героев сюжета - свои
#        chubby (бабушка), round (Валя), square (Марат), narrow (Эдуард), child (Соня)
# eye    std, big (ребёнок: крупная радужка), narrow (тяжёлое веко, прищур), droop (опущенный уголок),
#        wide (широко открытые), dot (бусинки без белка)
# lash   ресницы стрелкой; gaze  -1/1 - взгляд вбок; iris  цвет радужки (IRIS) или auto - по волосам
# brow   std, thin, thick, bushy, arch (дугой), straight (прямые), short (короткие), angled (домиком к переносице);
#        brow_dy  +1 ниже (хмурый); brow_col  свой цвет (светлые волосы). У кого есть настроения - не thin:
#        одна светлая линия не держит эмоцию.
# nose   std, button, small, long, wide, hooked, potato
# mouth  smile, small, wide, flat, stern (уголки вниз), smirk (усмешка); lips  full / paint (помада)
# blush  soft, none, rosy (румяный), kid
# marks  возраст (bags, crow, fold, lines, cheek, chin2 - не больше двух, cheek без fold), stubble, cleft,
#        freckles, dimples, scar
# mole   (x, y) родинки (у накрашенных губ - не ближе 3 клеток ко рту); ears  big;
# specs  frame - очки рисует модуль героя (глаза за ними почти не видны), wire - тонкая золотая оправа здесь;
# age    kid / old (подставляет детские / возрастные черты)
#
# Проверка, что лица не повторяются: python3 art/looks.py (после перерисовки портретов).

LOOKS = {
    # --- Герои сюжета (sprites.py) и семья (family.py).
    "grandma": dict(head="chubby", age="old", eye="std", iris="blue", brow="std", brow_col="#5a4a52", nose="button", mouth="smile", blush="rosy", specs="frame", marks=()),
    "valya": dict(head="round", iris="green", lash=True, brow="arch", nose="small", mouth="smile", lips="paint", blush="soft"),
    "marat": dict(head="square", iris="dark", brow="thick", nose="wide", mouth="wide", blush="none"),
    "eduard": dict(head="narrow", eye="narrow", iris="grey", brow="straight", nose="long", mouth="flat", blush="none"),
    "inspector": dict(head="long", eye="narrow", iris="grey", brow="straight", brow_dy=1, nose="hooked", mouth="flat", lips="paint", blush="none"),
    "sonya": dict(age="kid", iris="hazel", brow="short", mouth="smile", marks=()),
    "father": dict(head="lean", iris="brown", brow="std", nose="long", mouth="flat", blush="none", marks=("fold",)),
    # --- Праздники, новости, полиция.
    "moroz": dict(age="old", head="wide", eye="std", iris="sky", brow="bushy", brow_col="#8b9bb4", nose="potato", mouth="smile", blush="rosy", marks=("crow",)),
    "snegurochka": dict(head="heart", eye="wide", iris="sky", lash=True, brow="arch", brow_col="#8f563b", nose="small", mouth="small", lips="full", blush="rosy"),
    "anchor": dict(head="oval", iris="blue", lash=True, brow="straight", nose="long", mouth="wide", lips="paint", blush="soft", mole=(41, 36)),
    "police": dict(head="jaw", eye="narrow", iris="grey", brow="thick", brow_dy=1, nose="wide", mouth="flat", blush="none", marks=("cleft",)),
    "grey": dict(head="lean", eye="narrow", gaze=1, iris="grey", brow="angled", nose="hooked", mouth="smirk", blush="none", marks=("scar",)),
    # --- Ученики (apprentice.py).
    "appr0": dict(head="full", eye="big", iris="sky", brow="straight", nose="small", mouth="wide", blush="kid", ears="big", marks=("dimples",)),
    "appr1": dict(head="heart", eye="big", iris="green", lash=True, brow="std", nose="small", mouth="smirk", blush="kid", marks=("freckles",)),
    # --- Поставщики (sprites.py).
    "farmer": dict(age="old", head="jaw", eye="narrow", iris="blue", brow="bushy", nose="long", mouth="flat", blush="rosy", marks=("crow", "fold")),
    "dairy": dict(head="full", eye="dot", iris="blue", brow="thick", brow_col="#733e39", nose="std", mouth="wide", blush="rosy", marks=("dimples",)),
    "butcher": dict(head="jowl", eye="dot", iris="dark", brow="bushy", nose="potato", mouth="smile", blush="rosy", marks=("chin2",)),
    "school": dict(head="wide", eye="narrow", iris="hazel", brow="straight", nose="wide", mouth="stern", lips="paint", blush="rosy", mole=(22, 33)),
    "wholesale": dict(head="wide", eye="dot", iris="dark", brow="straight", nose="potato", mouth="flat", blush="none"),
    # --- Те, кто звонит с заказом, и постоянные покупатели (delivery.py, returns.ts).
    "caller0": dict(age="old", head="lean", iris="hazel", brow="thick", brow_col="#3e2731", nose="long", mouth="small", lips="paint", blush="none", specs="wire", marks=("fold",)),
    "caller1": dict(head="long", iris="blue", brow="thick", nose="long", mouth="wide", blush="soft", ears="big", marks=("stubble",)),
    "caller2": dict(head="jaw", eye="wide", iris="hazel", brow="thick", nose="small", mouth="smirk", blush="soft", marks=("freckles",)),
    "caller3": dict(head="full", eye="narrow", iris="dark", brow="angled", nose="wide", mouth="smile", blush="none", marks=("dimples",)),
    "caller4": dict(head="jaw", iris="blue", brow="straight", nose="std", mouth="smile", blush="none", marks=("cleft",)),
    "caller5": dict(age="old", head="long", eye="droop", iris="grey", brow="bushy", nose="potato", mouth="smile", blush="rosy", marks=("bags", "lines")),
    # --- Дела (cases.py), рэкет (racket.py).
    "case_rosa": dict(age="old", head="heart", iris="green", brow="std", nose="hooked", mouth="small", lips="paint", blush="none", specs="frame", marks=("fold",)),
    "case_zina": dict(head="full", eye="narrow", iris="green", brow="arch", brow_col="#a22633", nose="button", mouth="smirk", blush="soft", marks=("freckles",)),
    "case_gosha": dict(head="jaw", eye="narrow", iris="dark", brow="angled", nose="std", mouth="stern", blush="none", marks=("stubble",)),
    "case_semyon": dict(age="old", head="full", iris="blue", brow="std", nose="long", mouth="smile", blush="rosy", marks=("bags", "chin2")),
    "case_valera": dict(head="jaw", eye="dot", iris="hazel", brow="bushy", nose="wide", mouth="wide", blush="soft", ears="big", marks=("cleft", "dimples")),
    "racket_tolik": dict(head="jowl", eye="narrow", iris="grey", brow="thick", brow_dy=1, nose="wide", mouth="stern", blush="none", ears="big", marks=("scar", "stubble")),
    "case_boris": dict(head="long", eye="droop", iris="grey", brow="bushy", nose="hooked", mouth="flat", blush="none", marks=("fold",)),
    # --- Сценки у кассы (skits.py).
    "skit_tyoma": dict(age="kid", iris="sky", brow="thick", ears="big", mouth="wide", marks=("dimples",)),
    "skit_lyosha": dict(head="long", eye="wide", iris="hazel", brow="std", nose="button", mouth="wide", blush="soft", ears="big"),
    "skit_karina": dict(head="heart", eye="narrow", gaze=1, iris="blue", lash=True, brow="thick", brow_col="#8f563b", nose="small", mouth="smirk", lips="paint", blush="soft"),
    "skit_fyodor": dict(age="old", head="lean", iris="blue", brow="bushy", nose="long", mouth="flat", blush="soft", specs="frame", marks=("fold",)),
    "skit_masha": dict(age="kid", iris="blue", lash=True, brow="arch", nose="small", mouth="wide", marks=("freckles",)),
    "skit_ruslan": dict(head="lean", iris="dark", brow="thick", nose="hooked", mouth="smile", blush="none", marks=("cheek", "stubble")),
    "skit_galina": dict(age="old", head="narrow", iris="grey", brow="straight", nose="long", mouth="stern", blush="soft", specs="frame", mole=(27, 37), marks=("fold",)),
    "skit_hoodie": dict(head="oval", eye="narrow", iris="grey", brow="straight", nose="std", mouth="flat", blush="none", marks=("stubble",)),
    "skit_painter": dict(head="full", eye="wide", iris="blue", brow="short", nose="potato", mouth="wide", blush="rosy", marks=("dimples",)),
    "skit_viktor": dict(head="full", gaze=-1, iris="green", brow="arch", nose="small", mouth="smirk", blush="none", mole=(43, 38)),
    # --- Мечты соседей (dreams.py), Надя (residents.py).
    "dream_kostya": dict(head="heart", eye="wide", iris="dark", brow="std", nose="small", mouth="wide", blush="soft", marks=("dimples",)),
    "dream_anya": dict(head="oval", eye="wide", iris="blue", brow="std", nose="button", mouth="small", lips="full", blush="soft", marks=("freckles",)),
    "dream_petr": dict(age="old", head="full", iris="grey", brow="straight", nose="potato", mouth="smile", blush="none", specs="frame", marks=("lines",)),
    "dream_akhmed": dict(head="wide", eye="dot", iris="dark", brow="thick", nose="hooked", mouth="wide", blush="none", marks=("cheek",)),
    "nadya": dict(head="full", iris="green", lash=True, brow="short", nose="small", mouth="wide", blush="soft", marks=("freckles", "dimples")),
    # --- Сотрудники (career.py): чётные - мужчины, нечётные - женщины.
    "staff0": dict(head="oval", eye="wide", iris="blue", brow="std", nose="small", mouth="smile", blush="none"),
    "staff1": dict(head="long", eye="droop", iris="hazel", brow="thick", nose="hooked", mouth="wide", blush="soft"),
    "staff2": dict(head="heart", eye="narrow", iris="dark", brow="short", nose="wide", mouth="smile", blush="none"),
    "staff3": dict(head="heart", iris="green", brow="thick", nose="button", mouth="small", lips="full", blush="soft", specs="frame"),
    "staff4": dict(head="lean", eye="droop", iris="grey", brow="straight", nose="hooked", mouth="flat", blush="none", marks=("lines",)),
    "staff5": dict(head="wide", eye="droop", iris="dark", lash=True, brow="arch", nose="wide", mouth="smile", lips="paint", blush="soft", marks=("dimples",)),
    "staff6": dict(head="oval", eye="dot", iris="green", brow="std", nose="button", mouth="smirk", blush="soft", ears="big", marks=("freckles",)),
    "staff7": dict(head="lean", iris="blue", brow="short", nose="long", mouth="smirk", lips="full", blush="soft", specs="frame", marks=("dimples",)),
    # --- Заречье (zarechye.py).
    "zar_som": dict(age="old", head="jowl", eye="narrow", iris="sky", brow="bushy", nose="wide", mouth="flat", blush="rosy", marks=("crow", "lines")),
    "zar_nina": dict(age="old", head="jowl", iris="blue", brow="thick", nose="potato", mouth="stern", blush="rosy", mole=(27, 37), marks=("chin2",)),
    "zar_yegor": dict(head="jaw", iris="hazel", brow="thick", nose="long", mouth="smirk", blush="none", marks=("cheek",)),
    "zar_stepan": dict(age="old", head="jaw", iris="grey", brow="straight", nose="potato", mouth="stern", blush="none", marks=("bags", "cheek")),
    "zar_lida": dict(head="wide", eye="wide", iris="green", brow="arch", brow_col="#8f563b", nose="button", mouth="smile", blush="rosy", marks=("freckles",)),
    "zar_tolik": dict(head="full", eye="wide", iris="sky", brow="thick", nose="button", mouth="wide", blush="soft", ears="big", marks=("freckles",)),
}

# Женщины и девочки: у них свой, более строгий порог непохожести (см. check).
WOMEN = {
    "grandma", "valya", "inspector", "sonya", "snegurochka", "anchor", "appr1", "dairy", "school", "caller0", "caller2",
    "case_rosa", "case_zina", "skit_karina", "skit_masha", "skit_galina", "dream_anya", "nadya", "staff1", "staff3",
    "staff5", "staff7", "zar_nina", "zar_lida",
}


# ---------------------------------------------------------------- проверка: лица не повторяются

KEYS = ("head", "eye", "brow", "nose", "mouth", "lips", "marks", "specs")
FACE_KEYS = ("head", "eye", "brow", "nose", "mouth", "lips")


def differ(a, b, keys=KEYS):
    """Сколько заметных черт у двух лиц разные (цвет радужки не в счёт - на телефоне его не видно)."""
    n = 0
    for key in keys:
        if key == "eye" and a["specs"] == b["specs"] == "frame":
            continue  # глаза обоих за толстыми очками
        x, y = a[key], b[key]
        if key == "marks":
            x, y = set(x), set(y)
        n += x != y
    return n


def check(assets=None):
    """Ошибки таблицы LOOKS: похожие пары, слабые брови у героев с настроениями, рябь морщин, очки."""
    from pathlib import Path

    from PIL import Image

    assets = Path(assets or Path(__file__).resolve().parent.parent / "public" / "assets")
    moods = ("happy", "sad", "angry", "surprised")
    names = sorted(f.stem[9:] for f in assets.glob("portrait_*.png") if not f.stem.endswith(tuple("_" + m for m in moods)))
    errors = [f"{n}: нет строки в LOOKS (лицо возьмётся из хэша)" for n in names if n not in LOOKS]
    errors += [f"{n}: есть в LOOKS, но нет portrait_{n}.png" for n in LOOKS if n not in names]
    errors += [f"{n}: в WOMEN, но нет в LOOKS" for n in WOMEN if n not in LOOKS]
    looks = {n: look_of(n) for n in LOOKS}
    pairs = sorted(looks)
    for i, a in enumerate(pairs):
        for b in pairs[i + 1:]:
            d = differ(looks[a], looks[b])
            if d < 3:
                errors.append(f"{a} ~ {b}: разных черт {d} из {len(KEYS)} (нужно 3)")
            if a in WOMEN and b in WOMEN and differ(looks[a], looks[b], FACE_KEYS) < 3:
                errors.append(f"{a} ~ {b}: у двух женщин разных черт лица меньше 3 из {len(FACE_KEYS)}")
    for n, look in looks.items():
        moody = any((assets / f"portrait_{n}_{m}.png").exists() for m in moods)
        if moody and BROWS[look["brow"]][1] is None:
            errors.append(f"{n}: есть настроения, а бровь {look['brow']} в одну линию")
        age = [m for m in look["marks"] if m in AGE_MARKS]
        if len(age) > 2 or {"cheek", "fold"} <= set(age):
            errors.append(f"{n}: морщин {age} - больше двух или скулы вместе со складками")
        if look["lips"] == "paint" and look["mole"]:
            x, y = look["mole"]
            if 26 <= x <= 38 and 35 <= y <= 43:
                errors.append(f"{n}: родинка {look['mole']} у самых накрашенных губ")
        png = assets / f"portrait_{n}.png"
        if png.exists():
            frame = Image.open(png).convert("RGBA").getpixel((22, 28))[:3] == (0x5A, 0x69, 0x88)
            if frame != (look["specs"] == "frame"):
                errors.append(f"{n}: очки в портрете {'есть' if frame else 'нет'}, а specs={look['specs']}")
    return errors


if __name__ == "__main__":
    import sys

    problems = check()
    print("\n".join(problems) or f"Лица не повторяются: {len(LOOKS)} героев, у любых двух не меньше 3 разных черт.")
    sys.exit(1 if problems else 0)
