// Музыка без WebAudio: какие файлы есть (public/audio/music, manifest.json), что играть под настроение
// дня, когда молчать, в какой тональности звучит музыка и какую заставку под неё взять. Чистые функции
// и расписание — их проверяют тесты (tests/playlist.test.ts), а music.ts только играет то, что решено здесь.
//
// Как в Stardew Valley: трек звучит один раз от начала до конца, потом 30–90 секунд только улица
// и зал, потом следующий — по тому, что сейчас в игре. День длится полторы минуты, а трек — две-три,
// поэтому утро, день и вечер выбирают следующий трек, но не обрывают играющий. Сразу (плавной сменой)
// музыка меняется только там, где она совсем не к месту: началась ночная смена — ночной трек;
// наступило утро, а играет ночной — утренний.

import type { Holiday, YearTime } from '../game/calendar';
import type { Random } from './mix';

/** Тональность (мажорная гамма с теми же нотами, у минора — параллельный мажор). */
export type Key = 'C' | 'Db' | 'D' | 'Eb' | 'E' | 'F' | 'Gb' | 'G' | 'Ab' | 'A' | 'Bb' | 'B';
const PITCH: Record<Key, number> = { C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5, Gb: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };

// ---------- Файлы ----------

/** Основная музыка — шесть треков Suno (art/music/suno.py). */
export type TrackId = 'theme' | 'morning' | 'day' | 'evening' | 'night' | 'winter';
/** Радиоволны-петли (art/music/tracks_radio.py): ретро и хиты — в приёмнике, самба, марш и хиты — на улице в особый день. */
export type StationId = 'retro' | 'hits' | 'samba' | 'march';
/** Заставки (art/music/stingers.py). */
export type StingId = 'day_open' | 'day_close' | 'record' | 'rank_up' | 'purchase' | 'story' | 'expand' | 'fail' | 'coin';

export interface TrackFile {
  /** Путь в public/ без расширения: к нему дописывается .ogg или .m4a. */
  path: string;
  /** Секунды. */
  duration: number;
  key: Key;
  /** Поправка громкости в игре: файлы выровнены на −16 LUFS, а ночь задумана тише дня. */
  gainDb: number;
}

export const TRACKS: Record<TrackId, TrackFile> = {
  theme: { path: 'audio/music/suno/theme', duration: 112, key: 'G', gainDb: 0 },
  morning: { path: 'audio/music/suno/morning', duration: 182.4, key: 'D', gainDb: -1 },
  day: { path: 'audio/music/suno/day', duration: 152.8, key: 'C', gainDb: 0 },
  evening: { path: 'audio/music/suno/evening', duration: 192.8, key: 'C', gainDb: -1 },
  night: { path: 'audio/music/suno/night', duration: 163.2, key: 'D', gainDb: -3 },
  winter: { path: 'audio/music/suno/winter', duration: 131.2, key: 'C', gainDb: 0 },
};

export interface LoopFile {
  path: string;
  key: Key;
  /** Петля внутри файла (секунды): до и после неё лежит по полсекунды той же музыки «по кругу». */
  loopStart: number;
  loopEnd: number;
  /** Где петля меняет тональность (секунды от loopStart): марш уходит в трио ми-бемоль мажора. */
  keySections?: { start: number; end: number; key: Key }[];
}

export const LOOPS: Record<StationId, LoopFile> = {
  retro: { path: 'audio/music/radio_retro', key: 'F', loopStart: 0.5, loopEnd: 67.7 },
  hits: { path: 'audio/music/radio_hits', key: 'A', loopStart: 0.5, loopEnd: 64.5 },
  samba: { path: 'audio/music/radio_samba', key: 'F', loopStart: 0.5, loopEnd: 64.5 },
  march: {
    path: 'audio/music/radio_march',
    key: 'Bb',
    loopStart: 0.5,
    loopEnd: 64.5,
    keySections: [
      { start: 0, end: 20, key: 'Bb' },
      { start: 20, end: 52, key: 'Eb' },
      { start: 52, end: 64, key: 'Bb' },
    ],
  },
};

/** Стык петли сглаживается за 5 мс: у каждой копии её начала свой шум кодека (manifest.json, seamCrossfade). */
export const SEAM_SECONDS = 0.005;

/**
 * Сгладить стык петли в разобранном звуке: последние 5 мс перед концом петли плавно переходят
 * в то, что лежит перед её началом, — и переход «конец → начало» звучит как в файле подряд.
 * Точки — в отсчётах буфера (его частота может быть ниже 48 кГц). channels меняются на месте.
 */
export function smoothSeam(channels: Float32Array[], rate: number, loop: LoopFile): void {
  const s = Math.round(loop.loopStart * rate);
  const e = Math.round(loop.loopEnd * rate);
  const k = Math.max(1, Math.round(SEAM_SECONDS * rate));
  for (const d of channels) {
    if (s < k || e > d.length) continue;
    for (let i = 0; i < k; i++) d[e - k + i] = d[e - k + i] * (1 - i / k) + d[s - k + i] * (i / k);
  }
}

export interface StingFile {
  /** Заставка в до мажоре; варианты в других тональностях — с суффиксом: sting_coin_Eb. */
  path: string;
  duration: number;
  /** Есть в семи тональностях: звучит поверх музыки в её тональности. */
  keyed?: boolean;
  /** На сколько приглушить музыку, пока звучит (у заставок только в до мажоре). */
  duckDb?: number;
}

export const STINGS: Record<StingId, StingFile> = {
  day_open: { path: 'audio/music/sting_day_open', duration: 3.532, duckDb: -8 },
  day_close: { path: 'audio/music/sting_day_close', duration: 4.679, duckDb: -8 },
  expand: { path: 'audio/music/sting_expand', duration: 4.7, duckDb: -8 },
  fail: { path: 'audio/music/sting_fail', duration: 4.5, duckDb: -8 },
  story: { path: 'audio/music/sting_story', duration: 5.575, duckDb: -8 },
  coin: { path: 'audio/music/sting_coin', duration: 1.965, keyed: true },
  purchase: { path: 'audio/music/sting_purchase', duration: 3.231, keyed: true },
  record: { path: 'audio/music/sting_record', duration: 3.3, keyed: true },
  rank_up: { path: 'audio/music/sting_rank_up', duration: 4.045, keyed: true },
};

/** В каких тональностях есть варианты заставок (stingerKeys в манифесте). */
export const STING_KEYS: Key[] = ['C', 'G', 'F', 'Eb', 'D', 'A', 'Bb'];

/** Место тональности на квинтовом круге: соседние отличаются одной нотой. */
const fifths = (key: Key): number => (PITCH[key] * 7) % 12;

/** Ближайшая тональность, в которой есть заставки: та же, иначе соседняя по квинтовому кругу (E → A). */
export function nearestStingKey(key: Key): Key {
  if (STING_KEYS.includes(key)) return key;
  const at = fifths(key);
  const distance = (k: Key) => {
    const d = Math.abs(fifths(k) - at);
    return Math.min(d, 12 - d);
  };
  return STING_KEYS.reduce((best, k) => (distance(k) < distance(best) ? k : best));
}

/** Файл заставки под тональность музыки (без музыки — в до мажоре). */
export function stingPath(id: StingId, key: Key | null): string {
  const sting = STINGS[id];
  const k = sting.keyed && key ? nearestStingKey(key) : 'C';
  return k === 'C' ? sting.path : `${sting.path}_${k}`;
}

/** Тональность петли в момент t (секунды от начала петли, по кругу). */
export function loopKeyAt(loop: LoopFile, t: number): Key {
  if (!loop.keySections) return loop.key;
  const length = loop.loopEnd - loop.loopStart;
  const at = ((t % length) + length) % length;
  return loop.keySections.find((s) => at >= s.start && at < s.end)?.key ?? loop.key;
}

/**
 * Формат: Ogg Opus меньше и звучит лучше, но Safari и всё на его движке (Telegram на iPhone и Mac)
 * надёжно разбирает только AAC — там берём .m4a. canPlayType иногда «врёт», поэтому music.ts
 * при ошибке разбора Ogg один раз переходит на .m4a.
 */
export function musicFormat(ua: string, canOgg: string): 'ogg' | 'm4a' {
  const appleWebKit = /AppleWebKit/.test(ua) && !/Chrome\/|Chromium\/|Android/.test(ua);
  return !appleWebKit && canOgg !== '' ? 'ogg' : 'm4a';
}

// ---------- Что играть ----------

/** Настроение момента: титул, утро (закупка и первые часы), день, вечер (фонари и итоги), ночная смена. */
export type MusicMood = 'title' | 'morning' | 'day' | 'evening' | 'night';

/**
 * Что подходит к настроению: первый — главный трек, дальше — замена, чтобы один и тот же
 * не звучал дважды подряд (тема «Магазинчика» иногда возвращается и днём). Ночью замены нет:
 * любой другой трек к ней не к месту (clashes) и тут же сменился бы обратно на ночной —
 * лучше пусть ночной, если итоги ночи затянулись, зазвучит ещё раз после тишины.
 */
export const POOLS: Record<MusicMood, TrackId[]> = {
  title: ['theme'],
  morning: ['morning', 'day', 'theme'],
  day: ['day', 'morning', 'theme'],
  evening: ['evening', 'day'],
  night: ['night'],
};

/** Зимой и под Новый год вальс «Зима» звучит вместо дня или вечера через раз. */
export const WINTER_SHARE = 0.5;

/** Зимняя музыка: зимний месяц игры, новогодняя неделя или настоящие новогодние дни (20 декабря — 10 января). */
export function winterMusic(season: YearTime, holiday: Holiday | null, date: Date): boolean {
  const month = date.getMonth();
  const day = date.getDate();
  return season === 'winter' || holiday === 'newyear' || (month === 11 && day >= 20) || (month === 0 && day <= 10);
}

/** Следующий трек под настроение — не тот же, что звучал последним (если есть замена). */
export function pickTrack(mood: MusicMood, winter: boolean, last: TrackId | null, random: Random): TrackId {
  let pool = POOLS[mood];
  if (winter && (mood === 'day' || mood === 'evening') && random() < WINTER_SHARE) pool = ['winter', ...pool];
  return pool.find((id) => id !== last) ?? pool[0];
}

/**
 * Трек совсем не к месту — сменить сразу, не дожидаясь конца: в ночную смену звучит только ночной,
 * а ночной уступает утру и дню (вечером, в итогах после ночной смены, он ещё к месту).
 */
export function clashes(track: TrackId, mood: MusicMood): boolean {
  if (mood === 'night') return track !== 'night';
  return track === 'night' && mood !== 'evening';
}

/** Тишина после трека, секунды (silenceAfter в манифесте). */
export const SILENCE = { min: 30, max: 90 };
/** Пока молчали, началась ночная смена — тишину сокращаем до пары секунд. */
export const NIGHT_GAP = 2;
/** Радио выключили или оркестр ушёл — музыка возвращается после короткой паузы. */
export const RESUME_GAP = 4;

/** Что сделать с музыкой: начать трек (fade — плавно сменить играющий) или замолчать (играет радио). */
export type Cue = { track: TrackId; fade: boolean } | 'stop';

/**
 * Расписание музыки. Время — часы звука (секунды AudioContext.currentTime): пока игра свёрнута,
 * они стоят, и трек с тишиной продолжаются с того же места. music.ts спрашивает next() несколько
 * раз в секунду, а когда трек и правда зазвучал (файл скачан и разобран) — сообщает started().
 */
export class Playlist {
  /** Что играет: с какого момента и до какого. */
  playing: { track: TrackId; from: number; until: number } | null = null;
  /** Тишина — до этого момента. */
  quietUntil = 0;
  /** Последний сыгранный трек и сколько их было за заход в игру. */
  last: TrackId | null = null;
  count = 0;
  /** Настроение, при котором началась тишина: пришла ночь — тишину сокращаем. */
  private quietMood: MusicMood | null = null;

  constructor(private readonly random: Random) {}

  /**
   * Что сделать сейчас (null — ничего). held — играет радио или оркестр на улице: своя музыка молчит
   * и вернётся через RESUME_GAP после них.
   */
  next(now: number, mood: MusicMood, winter: boolean, held = false): Cue | null {
    if (held) {
      if (this.playing) return 'stop';
      this.quietUntil = Math.max(this.quietUntil, now + RESUME_GAP);
      this.quietMood = mood;
      return null;
    }
    if (this.playing && now >= this.playing.until) this.ended(this.playing.until, mood);
    if (this.playing) return clashes(this.playing.track, mood) ? { track: this.pick(mood, winter), fade: true } : null;
    if (mood === 'night' && this.quietMood !== 'night') this.quietUntil = Math.min(this.quietUntil, now + NIGHT_GAP);
    this.quietMood = mood;
    if (now < this.quietUntil) return null;
    // Первый трек захода в игру — тема «Магазинчика» (титул), дальше — по настроению.
    return { track: this.count === 0 && mood !== 'night' ? 'theme' : this.pick(mood, winter), fade: false };
  }

  /** Трек зазвучал (длительность — по разобранному файлу). */
  started(track: TrackId, now: number, duration: number): void {
    this.playing = { track, from: now, until: now + duration };
    this.last = track;
    this.count++;
  }

  /** Музыку убрали (радио, оркестр, выключили): тишина gap секунд. */
  stopped(now: number, gap: number): void {
    this.playing = null;
    this.quietUntil = now + gap;
  }

  /** Сдвинуть всё расписание на seconds назад — для отладки: «прошло столько-то». */
  skip(seconds: number): void {
    if (this.playing) this.playing = { ...this.playing, from: this.playing.from - seconds, until: this.playing.until - seconds };
    this.quietUntil -= seconds;
  }

  private ended(at: number, mood: MusicMood): void {
    this.playing = null;
    this.quietUntil = at + SILENCE.min + (SILENCE.max - SILENCE.min) * this.random();
    this.quietMood = mood;
  }

  private pick(mood: MusicMood, winter: boolean): TrackId {
    return pickTrack(mood, winter, this.last, this.random);
  }
}

// ---------- Радио ----------

/**
 * Позывные «Радио Магазинчик»: мотив игры (C D | A G E — «Ма-га | ЗИН-чик… дзынь») в тональности
 * волны, ноты MIDI со временем (с) и длительностью. Сдвиг — не дальше −5…+6 полутонов (регистр почти тот же).
 */
export function jingleNotes(key: Key): { midi: number; at: number; dur: number }[] {
  const shift = ((PITCH[key] + 5) % 12) - 5;
  return [
    { midi: 72, at: 0, dur: 0.13 },
    { midi: 74, at: 0.14, dur: 0.16 },
    { midi: 81, at: 0.32, dur: 0.3 },
    { midi: 79, at: 0.64, dur: 0.16 },
    { midi: 76, at: 0.82, dur: 0.7 },
  ].map((n) => ({ ...n, midi: n.midi + shift }));
}
