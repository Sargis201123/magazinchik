"""Записи для атмосферы «Магазинчика»: только CC0 (общественное достояние), с проверкой лицензии.

Источник — набор ESC-50 (K. J. Piczak, «ESC: Dataset for Environmental Sound Classification», 2015,
https://github.com/karolpiczak/ESC-50): 2000 пятисекундных отрывков из записей Freesound. Набор целиком
выложен под CC BY-NC, но у каждого отрывка своя лицензия — та, под которой автор выложил запись на
Freesound, — и она указана в файле LICENSE набора («[CC0]», «[CC-BY]»…). Берём только отрывки с [CC0]:
их можно использовать как угодно, в том числе в коммерческой игре, без указания автора.

Проверка лицензии — не на слово: скрипт скачивает LICENSE набора и для каждого отрывка сверяет, что
он записан именно с [CC0] и именно от этого автора и этой записи Freesound. Не сошлось — рендер
останавливается. Сами отрывки сверяются по SHA-256: подменённый или изменённый файл не пройдёт.

    python3 art/ambience/sources.py     # скачать (в art/build/ambience/src) и проверить всё
"""

import hashlib
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
CACHE = ROOT / "art" / "build" / "ambience" / "src"
RAW = "https://raw.githubusercontent.com/karolpiczak/ESC-50/master"
SR = 48000

# Отрывок: имя файла в ESC-50 → автор и номер записи на Freesound, её название, что внутри, SHA-256 (16 знаков).
# Заметки «что внутри» — по спектрограммам и замерам ровности при отборе (ровный дождь без машин и голосов).
CLIPS = {
    # Дождь за стеклом: ровные, без машин и голосов. Тихий дождь — с каплями по стеклу и плёнке.
    "2-73027-A-10": ("j1987", 73027, "rain_on_greenhouse.mp3", "дождь по стеклу теплицы", "42eba8ebc797e9fa"),
    "5-198321-A-10": ("schafferdavid", 198321, "rain.wav", "ровный дождь", "a16dbc1f4320ade2"),
    "5-181766-A-10": ("laura222", 181766, "rain.aiff", "ровный дождь", "608fcc0bef32512e"),
    "4-180380-A-10": ("aumguy", 180380, "rain.wav", "дождь с каплями", "d73fdc45016ab102"),
    "2-82367-A-10": ("gynation", 82367, "Rain on Plastic Roof.WAV", "капли по навесу", "2cce637e5f60368d"),
    "1-21189-A-10": ("uberhuberman", 21189, "Louisiana Rain 1.wav", "ровный дождь", "5f15ab2d8f6ef993"),
    # Ливень.
    "1-50060-A-10": ("vibe_crc", 50060, "rain_session_27sec_2006.wav", "сильный ровный дождь", "cc8119be878eafdc"),
    "3-157615-A-10": ("Keygenerator", 157615, "rain recording.mp3", "сильный ровный дождь", "5d3ac19904b4f7f0"),
    "1-26222-A-10": ("Walter_Odington", 26222, "medium heavey rain.wav", "сильный дождь", "7a03695543a56d61"),
    "2-87781-A-10": ("sagetyrtle", 87781, "rain.wav", "сильный дождь, низкий", "81fe7ce5da401a69"),
    "1-54958-A-10": ("thammo", 54958, "rain.ogg", "ливень", "d93233d42dc57a3e"),
    # Птицы (весна и лето): чистые фразы, фон срезается.
    "2-122616-A-14": ("urupin", 122616, "Song thrush (pevchiy drozd)", "певчий дрозд", "3007fb5df39d042a"),
    "4-187769-B-14": ("dwareing", 187769, "binaural-birds-06-05-2013.flac", "щебет", "4bdf0f2e55640ac8"),
    "4-182795-A-14": ("keweldog", 182795, "bird chirps4.wav", "чириканье", "c993100465e6db94"),
    "3-181132-A-14": ("keweldog", 181132, "bird chirps.wav", "чириканье", "e454897f74f9c366"),
    "4-223127-A-14": ("keweldog", 223127, "general birdsong.wav", "пение", "36f76b6e7b928388"),
    # Вороны (зима, снег, поздняя осень).
    "4-188287-A-9": ("pepv", 188287, "crow 1", "карканье, чисто", "d5c647f22d6e62b7"),
    "1-75162-A-9": ("nigelcoop", 75162, "crow.wav", "карканье, чисто", "d7970b542228a728"),
    "1-56233-A-9": ("Q.K.", 56233, "Crows_01.wav", "несколько ворон", "9cb4e70950714136"),
    "4-138344-A-9": ("UncleSigmund", 138344, "crow.wav", "карканье", "67b10b27be5bb2ce"),
    # Салют (Новый год): хлопки и шипение.
    "2-117615-A-48": ("soundmary", 117615, "Fireworks - explode and fizz.wav", "салют", "767834d60f2684da"),
    "2-117615-B-48": ("soundmary", 117615, "Fireworks - explode and fizz.wav", "салют", "1dfdaa1f7b217ba3"),
    "2-117615-C-48": ("soundmary", 117615, "Fireworks - explode and fizz.wav", "салют", "e5a9aeaddae0a2e5"),
    "2-117615-D-48": ("soundmary", 117615, "Fireworks - explode and fizz.wav", "салют", "53e46153374aff6b"),
    "2-117615-E-48": ("soundmary", 117615, "Fireworks - explode and fizz.wav", "салют", "bbc06aa38e2b5126"),
    "2-117616-A-48": ("soundmary", 117616, "fireworks exploding 1.wav", "салют", "f87acf8b797d8ae5"),
    "1-160563-A-48": ("daveincamas", 160563, "Fireworks July 3, 2012", "далёкий салют", "853c5ceac82891c5"),
    "1-160563-B-48": ("daveincamas", 160563, "Fireworks July 3, 2012", "далёкий салют", "810d1ca90e7a6b3c"),
}

def _get(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return r.read()


def license_text():
    path = CACHE / "ESC-50-LICENSE"
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        path.write_bytes(_get(f"{RAW}/LICENSE"))
    return path.read_text(encoding="utf-8")


def verify_license(clip, text=None):
    """Отрывок записан в LICENSE набора как CC0, от того же автора и той же записи Freesound."""
    text = text or license_text()
    author, sound = CLIPS[clip][:2]
    stem = clip.rsplit("-", 1)[0]  # 2-73027-A-10 → 2-73027-A (в LICENSE — 2-73027-A.ogg)
    m = re.search(r"\[" + re.escape(stem) + r"\.ogg\]:\s*clip derived from .* \((http[^)]*)\) by (.*) \[([^\]]+)\]", text)
    if not m:
        raise SystemExit(f"{clip}: нет в LICENSE набора ESC-50")
    url, by, lic = m.groups()
    if lic != "CC0":
        raise SystemExit(f"{clip}: лицензия {lic}, а не CC0 — брать нельзя")
    if by.strip() != author or f"/sounds/{sound}/" not in url:
        raise SystemExit(f"{clip}: в LICENSE другой автор или запись ({by}, {url})")
    return url


def fetch(clip):
    """Скачать отрывок (если ещё нет), сверить отпечаток. Путь к WAV."""
    path = CACHE / f"{clip}.wav"
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        path.write_bytes(_get(f"{RAW}/audio/{clip}.wav"))
    digest = hashlib.sha256(path.read_bytes()).hexdigest()[:16]
    want = CLIPS[clip][4]
    if digest != want:
        raise SystemExit(f"{clip}: отпечаток {digest}, ожидался {want} — файл изменился")
    return path, digest


def load(clip):
    """Отрывок как моно-массив на 48 кГц (ffmpeg пересчитывает частоту из 44.1 кГц)."""
    path, _ = fetch(clip)
    r = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path), "-f", "f32le", "-ac", "1",
                        "-ar", str(SR), "pipe:"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, dtype="<f4").astype(float)


def main():
    text = license_text()
    for clip, (author, sound, title, note, _) in CLIPS.items():
        url = verify_license(clip, text)
        _, digest = fetch(clip)
        print(f"{clip:15s} CC0  {author:15s} {url}  sha256 {digest}  — {note}")


if __name__ == "__main__":
    main()
    sys.exit(0)
