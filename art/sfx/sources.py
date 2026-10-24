"""Записанные исходники звуков: наборы Kenney (CC0, www.kenney.nl) — только то, что идёт в игру.

Файлы не лежат в репозитории: fetch() скачивает их в art/build/sfx/src из зеркала наборов на GitHub
(series-ai/jam-ready-assets, сами .ogg — в Git LFS) и сверяет каждый с контрольной суммой — та же,
что записана в LFS-указателе зеркала. Лицензия набора (License.txt, CC0 1.0) скачивается рядом.
Если зеркало пропадёт, те же файлы есть в оригинальных архивах на kenney.nl (названия наборов ниже).

    python3 art/sfx/sources.py      # скачать и проверить
"""

import hashlib
import subprocess
import sys
import urllib.request
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
CACHE = ROOT / "art" / "build" / "sfx" / "src"
SR = 48000

MIRROR = "series-ai/jam-ready-assets"
RAW = f"https://raw.githubusercontent.com/{MIRROR}/main"
LFS = f"https://media.githubusercontent.com/media/{MIRROR}/main"

# Набор → название на kenney.nl (все — CC0 1.0, см. License.txt каждого набора).
PACKS = {
    "kenney-impact-sounds": "Impact Sounds (1.0)",
    "kenney-rpg-audio": "RPG Audio (1.0)",
    "kenney-casino-audio": "Casino Audio (1.1)",
    "kenney-foley-sounds": "Foley Sounds (1.0)",
}

# Подпапки внутри Audio/ у набора Foley Sounds.
_FOLEY_DIRS = {"sinkWater": "Water", "drip": "Water"}

FILES = {
    "kenney-impact-sounds/impactGlass_light_000.ogg": "518b3ca93556b42d330d20334cf6bad51d3b371bd3cf7b731f34ead41b5a0112",
    "kenney-impact-sounds/impactGlass_light_001.ogg": "40bd734d148e6b9fd3e72883e1ae289278fbc94027e4c43dceaf31df428e136a",
    "kenney-impact-sounds/impactGlass_light_002.ogg": "1893814a6ac478e652624e4342b00bbd8690e442d5d3e042f11ac5019faa9f70",
    "kenney-impact-sounds/impactGlass_light_003.ogg": "2a80cf5619ebbebbacdad212d85813f08af889343eaba91f0156081dc3945bc4",
    "kenney-impact-sounds/impactGlass_light_004.ogg": "aff091a74c44a7d8ba67674c93f70a0e48981730bcaa10d92621ccd0ca105d37",
    "kenney-impact-sounds/impactTin_medium_000.ogg": "d9b398f10c8243b824b865a325c4a763c00906415f842679e885163414ca4a27",
    "kenney-impact-sounds/impactTin_medium_001.ogg": "a9eb8fb614c98ad06f7745a5e1dffc9ec06588d59db51c5f103883fac306b4e8",
    "kenney-impact-sounds/impactTin_medium_002.ogg": "dd35b1c05242fa0bd43f97e82e98b9199c8061d715b02be2f3d6a18f2d0696be",
    "kenney-impact-sounds/impactTin_medium_003.ogg": "9b75b88297228dc41ecaa7ae7acf7c632a59e4abfe20c21bd6c2a9ba0b76a928",
    "kenney-impact-sounds/impactTin_medium_004.ogg": "b57bcb4b8189fe711d728dfec9bff26b8275b9737aa5de13c6d6b4f1acbd9af6",
    "kenney-impact-sounds/impactWood_light_000.ogg": "dced23f4708dbe08ae517902a4a4b2357ab0b88d737477f18560fbffee0a7a31",
    "kenney-impact-sounds/impactWood_light_001.ogg": "f2945c60d4c8bc939c7d9e73df7c3b620e4788c863b9e8628262f63664349386",
    "kenney-impact-sounds/impactWood_light_002.ogg": "64d181339ecb33c7781f04f18036d6d8625176834e0b1d9d752a28390d89f91b",
    "kenney-impact-sounds/impactWood_light_003.ogg": "d4e3acdadfe7f63dd06d96efb443058dcb914b43f117ed8ed078c740c71ccf6a",
    "kenney-impact-sounds/impactWood_light_004.ogg": "506caa98d6dbca245fb922853b16471412458a7b9a88423b0adc17916caf4582",
    "kenney-impact-sounds/impactGeneric_light_000.ogg": "cbf986108a30f9bd2575094062e4e217b9f1401aba194d90c7a379a3d59d25e0",
    "kenney-impact-sounds/impactGeneric_light_001.ogg": "55adffbeea7b64c64f58aae628c08640d08c7fa8f9c1f4470dd8978e0f23120b",
    "kenney-impact-sounds/impactGeneric_light_002.ogg": "5a768fd3a6a37ab0643378e98f8873765110125a8525e45df6c5b8e6a2947415",
    "kenney-impact-sounds/impactGeneric_light_003.ogg": "318582b411933cf3f4fdb2f6106491e7945211a75ed7ecca9f4e8ddd7863e762",
    "kenney-rpg-audio/handleCoins.ogg": "fc7d7de1b012b77e89b9f052065734eada8001a69226b5ca6086a0618f7ff4d6",
    "kenney-rpg-audio/handleCoins2.ogg": "32d79ea56ff22e6d74c4dd541674c95f5adbcff01300b9f99694627e3e9fdbfe",
    "kenney-rpg-audio/dropLeather.ogg": "1d4d88b55a72654af8c1239ad45117848126bc5121acdfe4b544bc3fb913f840",
    "kenney-rpg-audio/handleSmallLeather.ogg": "37fde28abdd317a47e0c02d5ce9a33201a93833b97fa43b40d7b38dffc3bc949",
    "kenney-rpg-audio/cloth4.ogg": "319705aab5795c4c514cb7c62e0611926011ec9566f50525350e32863e47c29b",
    "kenney-rpg-audio/bookPlace1.ogg": "026372c5e3abfc8caa2263ab46f7fa60ed37edc161a6a01bd62c9c67d428089c",
    "kenney-rpg-audio/bookPlace2.ogg": "7616b0da866cda26158e52e8b02cfef935c2cd069c5a483735487eacc13193e1",
    "kenney-rpg-audio/bookPlace3.ogg": "11d2e6635cb19cb0896d7861f73d7804448d98dd455b11b01e38baa0a964c743",
    "kenney-rpg-audio/bookFlip2.ogg": "c3fe4df86225099dee618c325e7b2e2eebade91ba0ddf1247d9a3cca2fa03713",
    "kenney-rpg-audio/bookFlip3.ogg": "e29574ea5187f582c6cc3dfaceb0ee9aee3978e7013554bfbad63a67aee8ad0c",
    "kenney-rpg-audio/metalLatch.ogg": "ea762526168b6ebeeefeb5a620be2b95a8da53e71ba8d7a2b736560ee00011d0",
    "kenney-casino-audio/card-fan-1.ogg": "7a9758ccad8899baef1b9f60b4064e4baa724a548293832fdaea07e6e07e638d",
    "kenney-casino-audio/card-fan-2.ogg": "5743373c9dde00c6eee949a2c8e65d75946522768999167e1f5632451630e848",
    "kenney-casino-audio/card-slide-1.ogg": "006cf9822d15d7063f8899e56041f41646df30adb6fbd8b974ee5d5420012690",
    "kenney-casino-audio/card-slide-5.ogg": "8638ab0c17f029aded0e27a4f9b9bb9f8c621b19a6e9975e855cb40ea63e2201",
    "kenney-casino-audio/card-slide-6.ogg": "be85da181ac879c20cb667d0f9f156dbdc236d3751737ad27359a15e946430a0",
    "kenney-casino-audio/card-place-1.ogg": "d8f26c33a665dcbdcc6f632f6050bc9dd548feb0d4942d4547615926d3926810",
    "kenney-casino-audio/card-place-3.ogg": "1d988631a6e5201ed1bb0d728f2e43a3ec79401258426858793598044ac95841",
    "kenney-casino-audio/card-place-4.ogg": "18e3ba713b7259605fd27cdc048085ed56cf86b32403f070b6cb125019f77183",
    "kenney-foley-sounds/sinkWater3.ogg": "49b5a23c816ea9b6afdff2d7c4a7f3bd6c6d96cc33b228c2707c90e7468ddf86",
}


def _url(rel, lfs=True):
    pack, name = rel.split("/", 1)
    sub = ""
    if pack == "kenney-foley-sounds":
        sub = next((d + "/" for k, d in _FOLEY_DIRS.items() if name.startswith(k)), "")
    return f"{LFS if lfs else RAW}/{pack}/audio/Audio/{sub}{name}"


def _get(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return r.read()


def fetch(verbose=True):
    """Скачать недостающее, проверить суммы всех файлов. Ошибка — исключение (собирать из чужого нельзя)."""
    for pack in PACKS:
        lic = CACHE / pack / "License.txt"
        if not lic.exists():
            lic.parent.mkdir(parents=True, exist_ok=True)
            lic.write_bytes(_get(f"{RAW}/{pack}/audio/License.txt"))
        if b"CC0" not in lic.read_bytes():
            raise RuntimeError(f"{pack}: в License.txt нет CC0")
    for rel, digest in FILES.items():
        path = CACHE / rel
        if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            path.parent.mkdir(parents=True, exist_ok=True)
            data = _get(_url(rel))
            if hashlib.sha256(data).hexdigest() != digest:
                raise RuntimeError(f"{rel}: контрольная сумма не сходится")
            path.write_bytes(data)
            if verbose:
                print(f"скачан {rel} ({len(data)} Б)")
    return CACHE


_CACHE = {}


def load(rel):
    """Исходник как моно float64 на 48 кГц (Vorbis у Kenney местами выходит за ±1 — не обрезаем)."""
    if rel not in _CACHE:
        if rel not in FILES:
            raise KeyError(f"{rel} нет в списке исходников")
        r = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(CACHE / rel), "-f", "f32le",
                            "-ac", "1", "-ar", str(SR), "pipe:"], capture_output=True, check=True)
        _CACHE[rel] = np.frombuffer(r.stdout, dtype="<f4").astype(float)
    return _CACHE[rel].copy()


if __name__ == "__main__":
    fetch()
    print(f"готово: {len(FILES)} файлов в {CACHE}")
    sys.exit(0)
