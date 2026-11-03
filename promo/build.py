#!/usr/bin/env python3
"""Сборка промо-ролика из снятых клипов (promo/footage/<язык>), голоса и музыки игры.
Запуск: bash promo/build.sh <язык> [<голос>]   (например: ru alexandr, ru veronica, en jesse; без голоса — превью)

Что делает:
  1. Голос. Есть promo/voice/<язык>/<голос>/voice.mp3 (один файл на весь текст) — режет его по паузам
     на реплики; есть promo/voice/<язык>/<голос>/lines/01.mp3 … (их делает promo/voice/tts.py) — берёт их;
     нет ничего — ПРЕВЬЮ без голоса, длительность реплики оценивается по тексту. Длительности меряет ffprobe.
  2. Монтаж. Каждой реплике — свой клип (promo/lines.json, scene), длиной «голос + воздух»;
     между клипами мягкий наплыв, в начале и в конце — из чёрного и в чёрный. Тряски нет.
  3. Звук. Голос сверху; музыка игры (Suno, public/audio/music/suno/theme) и уличный фон приглушаются
     под голосом; под погодой — её звук из игры (дождь, ливень с громом, птицы, вороны осенью);
     звон монет, дверь, мяу — тихими акцентами из звуков игры. Громкость ~ -14 LUFS.
  4. Субтитры. Nunito, белые с тёмной обводкой, над нижним краем (выше кнопок Telegram), по голосу;
     сверху — короткая подпись сцены; в конце — название и призыв (lines.json: title, cta, link).
     Отдельно — .srt.
  5. Выход (promo/out): promo_<язык>_<голос>.mp4 (или promo_<язык>_preview.mp4 без голоса), .srt,
     кадр-постер 1080×1920 и квадрат 1080×1080.

Нужны только python3 и ffmpeg/ffprobe.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

PROMO = Path(__file__).resolve().parent
ROOT = PROMO.parent
FOOTAGE = PROMO / "footage"
VOICE = PROMO / "voice"
OUT = PROMO / "out"
FONTS = PROMO / "fonts"
#: Музыка ролика: свой трек (promo/music/promo_theme.mp3, Suno), если он есть, иначе главная тема игры.
MUSIC = next((p for p in [PROMO / "music/promo_theme.mp3"] if p.exists()), ROOT / "public/audio/music/suno/theme.m4a")
#: Темп трека — чтобы удлинять его целыми тактами.
MUSIC_BPM = 100
AMBIENCE = ROOT / "public/audio/amb/street.m4a"
AMB = ROOT / "public/audio/amb"
#: Звук погоды под сценой (файл из public/audio/amb, громкость): живёт ровно на своём клипе.
BEDS = {
    "granny": ("birds", 0.35),
    "morning": ("birds", 0.3),
    "rain": ("rain", 0.75),
    "storm": ("downpour", 0.85),
    "leaves": ("crows", 0.3),
    "zar": ("birds", 0.18),
}
#: Гром в грозу: секунды от начала клипа (молнии снимает promo/record.ts в STORM_FLASHES = 1.1, 4.4 —
#: гром чуть позже вспышки, как в игре).
THUNDER_AT = {"storm": [(1.55, 0.9), (4.75, 0.7)]}
#: Цвет по сценам (ffmpeg): ночь в грозу темнее и синее, зима холоднее, осень теплее, дождь серее.
GRADE = {
    "rain": "eq=saturation=0.85:brightness=-0.03,colorbalance=bs=0.06:bm=0.04",
    "storm": "eq=brightness=-0.13:saturation=0.75:gamma=0.92,colorbalance=bs=0.12:bm=0.08:rs=-0.04",
    "leaves": "colorbalance=rm=0.07:gm=0.02:bm=-0.07,eq=saturation=1.12",
    "winter": "colorbalance=bs=0.08:bm=0.06:rs=-0.03,eq=brightness=-0.04",
    "zar": "colorbalance=rm=0.05:bm=-0.03",
}
SFX = ROOT / "public/audio/sfx/sfx.m4a"
#: Музыка: громкость темы и доля, до которой она уходит под голос.
MUSIC_VOL = 0.55
MUSIC_UNDER_VOICE = 0.38
#: Портрет бабушки над названием в концовке (64×64, увеличиваем пикселями).
PORTRAIT = ROOT / "public/assets/portrait_grandma_happy.png"

W, H, FPS = 1080, 1920, 30
#: Оценка длительности реплики без голоса: знаков в секунду (русский, спокойный темп).
CPS = 13.5  # для русского; у языка в lines.json может быть свой (cps)
#: Голос начинается через столько секунд после начала клипа (после наплыва) …
LEAD = 0.55
#: … и после него до следующей склейки столько воздуха.
TAIL = 0.75
#: Наплыв между клипами, секунд.
XFADE = 0.4
#: Последний клип держится после голоса — под название и призыв.
END_HOLD = 3.2
#: Самый короткий клип.
MIN_CLIP = 2.8
#: Видео не больше стольких мегабайт (Telegram и соцсети): битрейт считается от длины.
MAX_MB = 19.0

#: Звуки игры (src/platform/sfxData.ts, лента public/audio/sfx/sfx): начало и длина куска, секунды.
SFX_CUTS = {
    "coin": (3.2574, 0.30),
    "till": (0.992, 0.48),
    "door": (13.3803, 1.28),
    "bell": (17.4617, 1.75),
    "ding": (22.9821, 1.38),
    "meow": (32.4274, 0.62),
    "page": (37.0065, 0.20),
}
#: Акценты по сценам: (звук, секунда от начала клипа, громкость).
ACCENTS = {
    "morning": [("door", 0.9, 0.55)],
    "tap": [("coin", 0.9 + k * 0.8, 0.5) for k in range(6)],
    "grow": [("ding", 0.6, 0.35)],
    "cat": [("meow", 2.2, 0.55)],
    "notebook": [("page", 0.8, 0.8), ("page", 1.1, 0.6)],
    "cta": [("bell", 0.4, 0.4)],
}


def run(*cmd: str | os.PathLike, capture: bool = False) -> str:
    res = subprocess.run([str(c) for c in cmd], check=True, text=True, capture_output=True)
    return res.stdout + res.stderr if capture else ""


def duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        check=True, text=True, capture_output=True,
    ).stdout
    return float(out.strip())


def clean(text: str) -> str:
    """Текст субтитра из реплики голоса: без «...» (это паузы для голоса), без лишних пробелов."""
    text = re.sub(r"\s*\.\.\.\s*", "… ", text).strip()
    text = text.replace("… ", " ", 1) if text.startswith("… ") else text
    return re.sub(r"\s+", " ", text)


# ---------- Голос ----------


def find_voice(lines: list[dict], folder: Path | None) -> tuple[str, list[Path] | Path | None]:
    if folder is None:
        return "none", None
    for ext in ("mp3", "wav", "m4a", "ogg", "flac"):
        whole = folder / f"voice.{ext}"
        if whole.exists():
            return "whole", whole
    per: list[Path] = []
    for l in lines:
        hit = next((folder / "lines" / f"{l['id']}.{e}" for e in ("mp3", "wav", "m4a", "ogg", "flac") if (folder / "lines" / f"{l['id']}.{e}").exists()), None)
        if hit:
            per.append(hit)
    if per and len(per) == len(lines):
        return "lines", per
    if per:
        missing = [l["id"] for l in lines if not any(p.stem == l["id"] for p in per)]
        sys.exit(f"Голос по репликам неполный: нет {', '.join(missing)} ({folder.relative_to(ROOT)}/lines/<номер>.mp3)")
    sys.exit(f"В {folder.relative_to(ROOT)} нет голоса: voice.mp3 или lines/01.mp3 … (promo/voice/tts.py)")


def split_whole(path: Path, n: int, total: float) -> list[tuple[float, float]]:
    """Один файл на весь текст → n кусков (начало, конец) по самым длинным паузам."""
    for noise in (-38, -34, -30, -42):
        log = run("ffmpeg", "-hide_banner", "-i", path, "-af", f"silencedetect=noise={noise}dB:d=0.25", "-f", "null", "-", capture=True)
        starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", log)]
        ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
        gaps = [(e - s, s, e) for s, e in zip(starts, ends) if s > 0.05 and e < total - 0.05]
        if len(gaps) < n - 1:
            continue
        cuts = sorted(sorted(gaps, reverse=True)[: n - 1], key=lambda g: g[1])
        bounds: list[tuple[float, float]] = []
        prev = 0.0
        # Начало речи: после тишины в самом начале файла.
        lead = next((e for s, e in zip(starts, ends) if s <= 0.05), 0.0)
        prev = lead
        for _, s, e in cuts:
            bounds.append((prev, s))
            prev = e
        tail_silence = next((s for s, e in zip(starts, ends) if e >= total - 0.05), total)
        bounds.append((prev, max(prev + 0.3, tail_silence)))
        return bounds
    sys.exit(
        f"В promo/voice/{path.name} не нашлось {n - 1} пауз между репликами. Сгенерируйте текст из блока "
        "«ВСТАВИТЬ ЦЕЛИКОМ» (с «...» между репликами) или положите реплики по одной: promo/voice/01.mp3 …"
    )


# ---------- Субтитры ----------


def ass_time(t: float) -> str:
    t = max(0.0, t)
    h = int(t // 3600)
    m = int(t % 3600 // 60)
    s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def srt_time(t: float) -> str:
    t = max(0.0, t)
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def ass_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("{", "(").replace("}", ")")


def make_ass(script: dict, plan: list[dict], total: float, w: int, h: int) -> str:
    """Субтитры ASS: реплики снизу, подпись сцены сверху, концовка с названием по центру."""
    square = w == h
    sub_size = 66 if not square else 56
    # Снизу над интерфейсом Telegram: ~20% высоты в вертикали, поменьше в квадрате.
    sub_margin = int(h * 0.2) if not square else 90
    # Субтитры — белые на полупрозрачной тёмной плашке (BorderStyle 3): читаются и поверх окон игры.
    cap_size = 46 if not square else 40
    cap_margin = 250 if not square else 50
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {w}
PlayResY: {h}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Nunito Promo,{sub_size},&H00FFFFFF,&H00FFFFFF,&H38261A1D,&H00000000,0,0,0,0,100,100,0,0,3,16,0,2,90,90,{sub_margin},1
Style: Cap,Nunito Promo,{cap_size},&H0034AEFE,&H0034AEFE,&H00332B2B,&H66000000,0,0,0,0,100,100,1,0,1,5,2,8,60,60,{cap_margin},1
Style: Title,Nunito Promo,{150 if not square else 130},&H0034AEFE,&H0034AEFE,&H00332B2B,&H80000000,0,0,0,0,100,100,0,0,1,9,5,5,40,40,0,1
Style: Call,Nunito Promo,{62 if not square else 54},&H00E0EFF4,&H00E0EFF4,&H00332B2B,&H80000000,0,0,0,0,100,100,0,0,1,5,2,5,60,60,0,1
Style: Shade,Nunito Promo,10,&H00261A1D,&H00261A1D,&H00261A1D,&H00261A1D,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev: list[str] = []
    for p in plan:
        if p["caption"]:
            ev.append(f"Dialogue: 1,{ass_time(p['start'] + 0.25)},{ass_time(p['end'] - 0.1)},Cap,,0,0,0,,{{\\fad(300,250)}}{ass_escape(p['caption'])}")
        ev.append(f"Dialogue: 2,{ass_time(p['sub_in'])},{ass_time(p['sub_out'])},Sub,,0,0,0,,{{\\fad(120,160)}}{ass_escape(p['sub'])}")
    # Концовка: затемнение, название, призыв и ссылка на бота (если есть).
    last = plan[-1]
    end_in = last["sub_out"] - 0.2
    ev.append(f"Dialogue: 0,{ass_time(end_in)},{ass_time(total)},Shade,,0,0,0,,{{\\fad(600,0)\\alpha&H50&\\p1}}m 0 0 l {w} 0 {w} {h} 0 {h}{{\\p0}}")
    cy = h // 2
    ev.append(f"Dialogue: 3,{ass_time(end_in + 0.15)},{ass_time(total)},Title,,0,0,0,,{{\\fad(500,0)\\pos({w // 2},{cy - 70})}}{ass_escape(script['title'])}")
    call = script["cta"] + (f"\\N{script['link']}" if script.get("link") else "")
    ev.append(f"Dialogue: 3,{ass_time(end_in + 0.45)},{ass_time(total)},Call,,0,0,0,,{{\\fad(500,0)\\pos({w // 2},{cy + 70 + (30 if script.get('link') else 0)})}}{ass_escape(call)}")
    return head + "\n".join(ev) + "\n"


def make_srt(plan: list[dict]) -> str:
    out = []
    for i, p in enumerate(plan, 1):
        out.append(f"{i}\n{srt_time(p['sub_in'])} --> {srt_time(p['sub_out'])}\n{p['sub']}\n")
    return "\n".join(out)


# ---------- Звук ----------


def envelope(windows: list[tuple[float, float]], low: float, ramp: float = 0.25) -> str:
    """Громкость музыки: 1, а под голосом — low, с плавными переходами (выражение для volume)."""
    parts = []
    for a, b in windows:
        a0, b1 = a - ramp, b + ramp
        # Треугольно-трапециевидная «яма»: 0 вне окна, 1 внутри, линейно на краях.
        parts.append(f"clip(min((t-{a0:.3f})/{ramp},({b1:.3f}-t)/{ramp}),0,1)")
    # max() в ffmpeg принимает два аргумента — сворачиваем по парам.
    dip = parts[0] if parts else "0"
    for p in parts[1:]:
        dip = f"max({dip},{p})"
    return f"1-({1 - low:.3f})*{dip}"


def fit_music(path: Path, total: float, tmp: Path) -> Path:
    """Трек короче ролика — удлиняем его повтором куска из середины (целыми тактами, с наплывом), чтобы
    своя концовка песни пришлась на финал ролика, а не обрывалась и не начиналась заново."""
    have = duration(path)
    need = total + 0.5 - have
    if need <= 0:
        return path
    bar = 60 / MUSIC_BPM * 4
    ext = -(-need // bar) * bar
    xf = 1.5
    t1 = have * 0.55
    t2 = max(0.0, t1 - ext - xf)
    out = tmp / "music.wav"
    run("ffmpeg", "-v", "error", "-y", "-i", path, "-filter_complex",
        f"[0:a]atrim=0:{t1:.3f},asetpts=PTS-STARTPTS[a];[0:a]atrim={t2:.3f},asetpts=PTS-STARTPTS[b];[a][b]acrossfade=d={xf}[m]",
        "-map", "[m]", "-ar", "48000", out)
    return out


def main() -> None:
    doc = json.loads((PROMO / "lines.json").read_text(encoding="utf-8"))
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    lang = args[0] if args else "ru"
    if lang not in doc["langs"]:
        sys.exit(f"Нет языка {lang}: есть {', '.join(doc['langs'])}")
    script = {**doc["langs"][lang], "link": doc.get("link", "")}
    who = args[1] if len(args) > 1 else None
    if who and who not in script["voices"]:
        sys.exit(f"Нет голоса {who} для {lang}: есть {', '.join(script['voices'])}")
    lines = script["lines"]
    cps = script.get("cps", CPS)
    footage = FOOTAGE / lang
    if not shutil.which("ffmpeg"):
        sys.exit("Нужен ffmpeg")
    for l in lines:
        if not (footage / f"{l['id']}_{l['scene']}.mp4").exists():
            sys.exit(f"Нет клипа promo/footage/{lang}/{l['id']}_{l['scene']}.mp4 — снимите: npx vite-node promo/record.ts -- --lang {lang}")

    mode, src = find_voice(lines, VOICE / lang / who if who else None)
    preview = mode == "none"
    tmp = Path(tempfile.mkdtemp(prefix="promo-build-"))
    try:
        # 1. Голос: длительность каждой реплики и её кусок звука.
        pieces: list[Path | None] = []
        if mode == "lines":
            durs = [duration(p) for p in src]  # type: ignore[union-attr]
            pieces = list(src)  # type: ignore[arg-type]
        elif mode == "whole":
            total_voice = duration(src)  # type: ignore[arg-type]
            bounds = split_whole(src, len(lines), total_voice)  # type: ignore[arg-type]
            durs = []
            for i, (a, b) in enumerate(bounds):
                a = max(0.0, a - 0.06)
                b = min(total_voice, b + 0.12)
                piece = tmp / f"v{i:02d}.wav"
                run("ffmpeg", "-v", "error", "-y", "-i", src, "-ss", f"{a:.3f}", "-to", f"{b:.3f}", "-ac", "1", "-ar", "48000", piece)
                pieces.append(piece)
                durs.append(b - a)
        else:
            durs = [max(1.2, len(clean(l["voice"])) / cps) for l in lines]
            pieces = [None] * len(lines)

        # 2. План: клип каждой реплики, его начало на общей ленте, окно субтитра.
        plan: list[dict] = []
        t = 0.0
        for i, (l, d) in enumerate(zip(lines, durs)):
            last = i == len(lines) - 1
            length = max(MIN_CLIP, LEAD + d + TAIL + XFADE + (END_HOLD if last else 0))
            if i == 0:
                length += 0.3
            lead = LEAD + (0.3 if i == 0 else 0)
            v_in = t + lead
            plan.append({
                "id": l["id"], "scene": l["scene"], "clip": footage / f"{l['id']}_{l['scene']}.mp4",
                "start": t, "length": length, "end": t + length,
                "voice_in": v_in, "voice_dur": d,
                "sub_in": v_in - 0.08, "sub_out": v_in + d + 0.3,
                "sub": l.get("sub") or clean(l["voice"]), "caption": l.get("caption", ""),
            })
            t += length - XFADE
        total = plan[-1]["end"]

        # 3. Видео: клипы нужной длины (короче — последний кадр держится), наплывы, из чёрного и в чёрный.
        args: list[str] = ["ffmpeg", "-v", "error", "-y"]
        filters: list[str] = []
        for i, p in enumerate(plan):
            have = duration(p["clip"])
            args += ["-i", str(p["clip"])]
            pad = max(0.0, p["length"] - have + 0.05)
            filters.append(
                f"[{i}:v]fps={FPS},scale={W}:{H}:flags=lanczos,setsar=1,"
                + (GRADE[p["scene"]] + "," if p["scene"] in GRADE else "")
                + (f"tpad=stop_mode=clone:stop_duration={pad:.3f}," if pad > 0 else "")
                + f"trim=duration={p['length']:.3f},setpts=PTS-STARTPTS[c{i}]"
            )
        prev = "c0"
        for i in range(1, len(plan)):
            offset = plan[i]["start"]
            filters.append(f"[{prev}][c{i}]xfade=transition=fade:duration={XFADE}:offset={offset:.3f}[x{i}]")
            prev = f"x{i}"
        filters.append(f"[{prev}]fade=t=in:st=0:d=0.6,fade=t=out:st={total - 0.9:.3f}:d=0.9,format=yuv420p[v]")
        base = tmp / "base.mp4"
        run(*args, "-filter_complex", ";".join(filters), "-map", "[v]", "-c:v", "libx264", "-preset", "medium", "-crf", "12", "-r", str(FPS), base)

        # 4. Звук: музыка + улица (приглушаются под голосом), голос, акценты, громкость -14 LUFS.
        music = fit_music(MUSIC, total, tmp)
        a_args = ["ffmpeg", "-v", "error", "-y", "-stream_loop", "-1", "-i", str(music), "-stream_loop", "-1", "-i", str(AMBIENCE), "-i", str(SFX)]
        af: list[str] = []
        windows = [(p["voice_in"], p["voice_in"] + p["voice_dur"]) for p in plan]
        af.append(
            f"[0:a]atrim=0:{total:.3f},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,"
            f"volume={MUSIC_VOL},volume='{envelope(windows, MUSIC_UNDER_VOICE)}':eval=frame,afade=t=in:d=1.0,afade=t=out:st={total - 2.2:.3f}:d=2.2[mus]"
        )
        af.append(
            f"[1:a]atrim=0:{total:.3f},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,"
            f"volume=0.16,volume='{envelope(windows, 0.6)}':eval=frame,afade=t=in:d=1.5,afade=t=out:st={total - 2.5:.3f}:d=2.5[amb]"
        )
        mix = ["[mus]", "[amb]"]
        # Акценты из звуков игры.
        accents = [(name, p["start"] + at, vol) for p in plan for name, at, vol in ACCENTS.get(p["scene"], []) if at < p["length"] - 0.3]
        if accents:
            af.append(f"[2:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit={len(accents)}" + "".join(f"[s{k}]" for k in range(len(accents))))
            for k, (name, at, vol) in enumerate(accents):
                a, dur = SFX_CUTS[name]
                af.append(f"[s{k}]atrim={a:.4f}:{a + dur:.4f},asetpts=PTS-STARTPTS,volume={vol},adelay={int(at * 1000)}|{int(at * 1000)}[e{k}]")
                mix.append(f"[e{k}]")
        n_in = 3
        # Звук погоды: свой кусок под каждой сценой, с мягким входом и выходом на наплывах.
        for i, p in enumerate(plan):
            bed = BEDS.get(p["scene"])
            if not bed:
                continue
            name, vol = bed
            a_args += ["-stream_loop", "-1", "-i", str(AMB / f"{name}.m4a")]
            ms = int(p["start"] * 1000)
            ln = p["length"]
            af.append(
                f"[{n_in}:a]atrim=0:{ln:.3f},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,"
                f"volume={vol},afade=t=in:d=0.5,afade=t=out:st={ln - 0.6:.3f}:d=0.6,adelay={ms}|{ms}[bed{i}]"
            )
            mix.append(f"[bed{i}]")
            n_in += 1
        # Гром: низкий гул из шума (как синтез грома в игре, platform/sound.ts) с треском в начале.
        thunders = [(p["start"] + at, vol) for p in plan for at, vol in THUNDER_AT.get(p["scene"], []) if at < p["length"] - 0.5]
        for k, (at, vol) in enumerate(thunders):
            ms = int(at * 1000)
            a_args += ["-f", "lavfi", "-i", f"anoisesrc=color=brown:amplitude=1:duration=3.6:seed={11 + k}"]
            af.append(
                f"[{n_in}:a]lowpass=f=160,lowpass=f=220,volume=6,afade=t=in:d=0.08,afade=t=out:st=0.25:d=3.3:curve=exp,"
                f"aformat=sample_rates=48000:channel_layouts=stereo,volume={vol},adelay={ms}|{ms}[th{k}]"
            )
            mix.append(f"[th{k}]")
            n_in += 1
        for i, (p, piece) in enumerate(zip(plan, pieces)):
            if piece is None:
                continue
            a_args += ["-i", str(piece)]
            ms = int(p["voice_in"] * 1000)
            af.append(f"[{n_in}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=1.0,adelay={ms}|{ms}[vo{i}]")
            mix.append(f"[vo{i}]")
            n_in += 1
        af.append(f"{''.join(mix)}amix=inputs={len(mix)}:normalize=0:duration=longest,atrim=0:{total:.3f}[pre]")
        pre = tmp / "pre.wav"
        run(*a_args, "-filter_complex", ";".join(af), "-map", "[pre]", "-ar", "48000", pre)
        # Громкость: два прохода loudnorm до -14 LUFS, пики не выше -1.5 dBTP.
        log = run("ffmpeg", "-hide_banner", "-i", pre, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-", capture=True)
        m = json.loads(log[log.rindex("{"): log.rindex("}") + 1])
        mixed = tmp / "mix.wav"
        run(
            "ffmpeg", "-v", "error", "-y", "-i", pre, "-af",
            f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
            f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,aresample=48000",
            mixed,
        )

        # 5. Субтитры и выход.
        OUT.mkdir(parents=True, exist_ok=True)
        name = f"promo_{lang}_" + ("preview" if preview else who)
        (OUT / f"promo_{lang}.srt").write_text(make_srt(plan), encoding="utf-8")
        ass = tmp / "subs.ass"
        ass.write_text(make_ass(script, plan, total, W, H), encoding="utf-8")
        kbps = int(MAX_MB * 8 * 1024 / total) - 140
        vbit = min(6000, kbps)
        fonts = str(FONTS).replace(":", "\\:")
        final = OUT / f"{name}.mp4"
        encode = ["-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", str(FPS),
                  "-b:v", f"{vbit}k", "-maxrate", f"{int(vbit * 1.5)}k", "-bufsize", f"{vbit * 2}k",
                  "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-movflags", "+faststart", "-shortest"]
        vf = f"ass={ass.name}:fontsdir={fonts}"
        # Концовка: портрет бабушки над названием (поверх затемнения) — проявляется вместе с ним и уходит в чёрный со всем кадром.
        end_in = plan[-1]["sub_out"] - 0.2 + 0.15

        def ending(size: int, y: int, subs: str, crop: str = "") -> str:
            return (
                f"[2:v]scale={size}:{size}:flags=neighbor,format=rgba,"
                f"fade=t=in:st={end_in:.3f}:d=0.5:alpha=1,fade=t=out:st={total - 0.9:.3f}:d=0.9:alpha=1[p];"
                f"[0:v]{crop + ',' if crop else ''}{subs}[b];[b][p]overlay=x=(W-w)/2:y={y}:enable='gte(t,{end_in:.3f})':shortest=1:eof_action=pass[v]"
            )

        portrait = ["-loop", "1", "-framerate", str(FPS), "-i", str(PORTRAIT)]
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(base), "-i", str(mixed), *portrait,
                        "-filter_complex", ending(320, H // 2 - 70 - 120 - 330, vf), "-map", "[v]", "-map", "1:a", *encode, str(final)], check=True, cwd=tmp)
        # Постер: кадр концовки с названием (за 1.25 с до конца, до затемнения в чёрный).
        poster = OUT / f"promo_{lang}_poster.png"
        run("ffmpeg", "-v", "error", "-y", "-ss", f"{total - 1.25:.3f}", "-i", final, "-frames:v", "1", poster)
        # Квадрат 1080×1080: середина кадра, свои субтитры под квадрат.
        sq_ass = tmp / "square.ass"
        sq_ass.write_text(make_ass(script, plan, total, W, W), encoding="utf-8")
        square = OUT / f"{name}_square.mp4"
        # В квадрате точек на 44% меньше — и битрейт меньше.
        sq_bit = int(vbit * 0.62)
        sq_encode = [x for x in encode]
        sq_encode[sq_encode.index("-b:v") + 1] = f"{sq_bit}k"
        sq_encode[sq_encode.index("-maxrate") + 1] = f"{int(sq_bit * 1.5)}k"
        sq_encode[sq_encode.index("-bufsize") + 1] = f"{sq_bit * 2}k"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(base), "-i", str(mixed), *portrait,
                        "-filter_complex", ending(192, W // 2 - 70 - 100 - 200, f"ass={sq_ass.name}:fontsdir={fonts}", f"crop={W}:{W}:0:{(H - W) // 2 - 60}"),
                        "-map", "[v]", "-map", "1:a", *sq_encode, str(square)], check=True, cwd=tmp)
        timing = [{k: (round(v, 3) if isinstance(v, float) else str(v) if isinstance(v, Path) else v) for k, v in p.items()} for p in plan]
        (OUT / f"timing_{name}.json").write_text(json.dumps({"mode": mode, "total": round(total, 3), "plan": timing}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

        size = final.stat().st_size / 1e6
        print(f"{'ПРЕВЬЮ (без голоса, тайминг по оценке)' if preview else 'Голос: ' + ('один файл' if mode == 'whole' else 'по репликам')}")
        print(f"Ролик: {final.relative_to(ROOT)} — {total:.1f} с, {size:.1f} МБ")
        print(f"Квадрат: {square.relative_to(ROOT)} — {square.stat().st_size / 1e6:.1f} МБ")
        print(f"Субтитры: {(OUT / f'promo_{lang}.srt').relative_to(ROOT)}; постер: {poster.relative_to(ROOT)}")
        for p in plan:
            print(f"  {p['start']:5.1f}–{p['end']:5.1f} с  {p['id']} {p['scene']:<9} {p['sub']}")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
