"""Значки отделов на шапке полки: крупнее прежних и у каждого отдела свой —
молоко, мясо и заморозку больше не путают (у холодильников была одна снежинка)."""

from premium import H
from sprites import Canvas

INK = H("#2b2233")
PLATE = H("#fbf6ea")

ICONS = {
    "bakery": (
        {"o": H("#7a4a28"), "b": H("#c8803e"), "l": H("#e8b06a"), "s": H("#f6d9a0")},
        [
            "............",
            "...oooooo...",
            "..ollllllo..",
            ".olsllslllo.",
            ".olllsllsbo.",
            ".obllllllbo.",
            ".obbbbbbbbo.",
            "..oooooooo..",
            "............",
        ],
    ),
    "produce": (
        {"o": H("#7a1f2a"), "r": H("#e43b44"), "h": H("#ff8a8a"), "g": H("#3e8948"), "t": H("#733e39")},
        [
            ".....t.gg...",
            ".....tgg....",
            "...oo.too...",
            "..orrrrrro..",
            ".orhhrrrrro.",
            ".orhrrrrrro.",
            ".orrrrrrrro.",
            "..orrrrrro..",
            "...oo..oo...",
        ],
    ),
    "dairy": (
        {"o": H("#3a4466"), "w": H("#ffffff"), "c": H("#dfe8f2"), "b": H("#3d8be0"), "y": H("#fee761")},
        [
            ".....bb.....",
            "....oooo....",
            "....owco....",
            "...owwwco...",
            "...owwwco...",
            "...obbbbo...",
            "...obyybo...",
            "...owwwco...",
            "...oooooo...",
        ],
    ),
    "meat": (
        {"o": H("#6e2030"), "r": H("#d94a5a"), "d": H("#a82e40"), "f": H("#fbe3d8"), "b": H("#f4ecd8")},
        [
            "............",
            "..ooooooo...",
            ".offfffffo..",
            "ofrrrrrrrfo.",
            "ofrdrrbrrfo.",
            "ofrrrrbbrfo.",
            ".ofrrdrrrfo.",
            "..offffffo..",
            "...oooooo...",
        ],
    ),
    "drinks": (
        {"o": H("#1a3a66"), "c": H("#e43b44"), "b": H("#2ea8e0"), "h": H("#9fe2ff"), "w": H("#ffffff")},
        [
            ".....cc.....",
            ".....oo.....",
            "....obbo....",
            "...obhbbo...",
            "...owwwwo...",
            "...owwwwo...",
            "...obhbbo...",
            "...obhbbo...",
            "....oooo....",
        ],
    ),
    "frozen": (
        {"s": H("#1fb8e6"), "h": H("#a8f0ff")},
        [
            ".....s......",
            "...s.s.s....",
            "....sss.....",
            ".s..shs..s..",
            "..sshhhss...",
            ".s..shs..s..",
            "....sss.....",
            "...s.s.s....",
            ".....s......",
        ],
    ),
    "household": (
        {"o": H("#3e2a5c"), "p": H("#b27ae0"), "h": H("#e0c4ff"), "w": H("#ffffff"), "g": H("#5a6988")},
        [
            "...gggg.....",
            "...g..gg....",
            "...oggo.....",
            "..oppppo....",
            "..ophppo....",
            "..owwwwo....",
            "..ophppo....",
            "..oppppo....",
            "..oooooo....",
        ],
    ),
}


def badge(kind, palette, rows):
    c = Canvas(20, 16)
    c.round_rect(0, 0, 20, 16, INK, r=2)
    c.round_rect(1, 1, 18, 14, PLATE, r=2)
    c.hline(2, 14, 16, H("#e6dcc4"))
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch in palette:
                c.px(4 + dx, 3 + dy, palette[ch])
    c.save(f"dept_{kind}")


def main():
    for kind, (palette, rows) in ICONS.items():
        badge(kind, palette, rows)


if __name__ == "__main__":
    main()
