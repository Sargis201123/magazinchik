// Атмосфера «изнутри магазина» из файлов (public/audio/amb, собирает art/ambience): что должно звучать
// сейчас — по погоде, сезону, времени дня и числу покупателей. Игрок качает только то, что нужно сейчас:
// в дождь — дождь за витриной, весной и летом — птиц, зимой — ворон, на Новый год — салют; на слабом
// телефоне — ещё меньше (без записанного дождя, гомон — одним слоем). Чистые функции без WebAudio — их
// проверяют тесты (tests/ambienceLayers.test.ts), а играет ambienceFiles.ts.

import type { YearTime } from '../game/calendar';
import type { Weather } from '../game/weather';
import type { Random } from './mix';

/** Файлы атмосферы. */
export type AmbId = 'rain' | 'downpour' | 'murmur' | 'birds' | 'crows' | 'fireworks' | 'street';

/** Петля: вокруг неё в файле по полсекунды той же петли «по кругу» (шов не зависит от кодека). */
export interface AmbLoop {
  kind: 'loop';
  /** Путь в public/ без расширения: к нему дописывается .ogg или .m4a. */
  path: string;
  loopStart: number;
  loopEnd: number;
}

/** Нарезка (моно): группа кусков → [начало, длина] в секундах; сторону и громкость задаёт игра. */
export interface AmbSprite {
  kind: 'sprite';
  path: string;
  groups: Record<string, [number, number][]>;
}

export type AmbFile = AmbLoop | AmbSprite;

/** Таблица файлов: python3 art/ambience/render.py --ts (тест сверяет её с manifest.json). */
export const AMB = {
  rain: { kind: 'loop', path: 'audio/amb/rain', loopStart: 0.5, loopEnd: 25.1 },
  downpour: { kind: 'loop', path: 'audio/amb/downpour', loopStart: 0.5, loopEnd: 22.0 },
  murmur: { kind: 'loop', path: 'audio/amb/murmur', loopStart: 0.5, loopEnd: 28.5 },
  birds: {
    kind: 'sprite',
    path: 'audio/amb/birds',
    groups: {
      bird: [[0.25, 0.263], [0.763, 0.503], [1.516, 1.353], [3.119, 1.773], [5.142, 0.373], [5.765, 0.963], [6.978, 0.523], [7.751, 0.403], [8.404, 0.443], [9.097, 0.463], [9.81, 0.413], [10.473, 0.443], [11.166, 2.203]],
    },
  },
  crows: {
    kind: 'sprite',
    path: 'audio/amb/crows',
    groups: {
      crow: [[0.25, 1.783], [2.283, 2.593], [5.126, 2.483], [7.859, 2.103], [10.212, 2.353], [12.815, 0.543]],
    },
  },
  fireworks: {
    kind: 'sprite',
    path: 'audio/amb/fireworks',
    groups: {
      burst: [[0.25, 2.713], [3.213, 0.783], [4.246, 0.723], [5.219, 0.733], [6.202, 1.553], [8.005, 1.063], [9.318, 0.753], [10.321, 2.643]],
    },
  },
  street: {
    kind: 'sprite',
    path: 'audio/amb/street',
    groups: {
      bike: [[0.25, 1.703], [2.203, 1.703], [4.156, 1.703]],
      tram: [[6.109, 9.503], [15.862, 9.503]],
      tramBell: [[25.615, 2.603], [28.468, 2.603]],
      pigeons: [[31.321, 2.203], [33.774, 2.203], [36.227, 2.203]],
      lamp: [[38.68, 2.403], [41.333, 2.403], [43.986, 2.403]],
    },
  },
} satisfies Record<AmbId, AmbFile>;

/** Что сейчас в мире — всё, от чего зависит атмосфера. */
export interface AmbScene {
  weather: Weather;
  season: YearTime;
  /** Поздняя осень (после урожая, до Нового года): только тогда осенью каркают вороны. */
  lateAutumn: boolean;
  /** Вечер: 0 — день, 1 — ночь (как в сцене). */
  evening: number;
  /** Утро: 1 — магазин только открылся (и утренний экран), 0 — с середины дня. */
  morning: number;
  /** Покупателей в зале. */
  customers: number;
  /** Новый год: новогодняя неделя в игре или 31 декабря — 1 января по календарю. */
  newYear: boolean;
  /** Ночная смена. */
  night: boolean;
  /** Облегчённый режим (слабый телефон). */
  lite: boolean;
  /** Гомон громче в больших залах: множитель (hallLayers.ts); нет — как в магазинчике. */
  murmur?: number;
}

const wet = (w: Weather): boolean => w === 'rain' || w === 'storm';

/** Промежуток между случайными звуками: от и до, секунды. null — сейчас не звучат. */
export type Gap = [number, number] | null;

/**
 * Птицы за окном: весной и летом в сухую погоду, к вечеру смолкают. Редко — фон, а не щебет без
 * перерыва (просьба автора): утром раз в 5–12 с, днём — раз в 12–30 с.
 */
export function birdGap(s: AmbScene): Gap {
  if (s.season !== 'spring' && s.season !== 'summer') return null;
  if (wet(s.weather) || s.weather === 'snow' || s.night || s.evening >= 0.55) return null;
  return s.morning > 0.4 ? [5, 12] : [12, 30];
}

/** Вороны: зимой и в снег — изредка, поздней осенью — ещё реже (в начале осени их нет); в темноте молчат. */
export function crowGap(s: AmbScene): Gap {
  if (s.night || s.evening > 0.75) return null;
  if (s.season === 'winter' || s.weather === 'snow') return [16, 40];
  if (s.season === 'autumn' && s.lateAutumn && !wet(s.weather)) return [40, 90];
  return null;
}

/** Салют: на Новый год, как стемнеет (и всю ночную смену). */
export const fireworksOn = (s: AmbScene): boolean => s.newYear && (s.evening >= 0.35 || s.night);

/** Трамвай вдали: раз в одну-три минуты, ночью — реже (на слабом телефоне — ещё реже). */
export function tramGap(s: AmbScene): Gap {
  const k = s.lite ? 1.5 : 1;
  return s.night ? [150 * k, 300 * k] : [70 * k, 160 * k];
}

/** Настоящий Новый год по календарю игрока: 31 декабря и 1 января. */
export function realNewYear(date: Date): boolean {
  return (date.getMonth() === 11 && date.getDate() === 31) || (date.getMonth() === 0 && date.getDate() === 1);
}

/** Записанный дождь вместо синтезированного: не на слабом телефоне (там остаётся синтез, без загрузки). */
export function rainFile(s: AmbScene): 'rain' | 'downpour' | null {
  if (s.lite) return null;
  return s.weather === 'rain' ? 'rain' : s.weather === 'storm' ? 'downpour' : null;
}

/** Какие файлы нужны сейчас (только их и качаем). Улица — всегда: её звуки мелкие и бывают в любой день. */
export function wantedFiles(s: AmbScene): AmbId[] {
  const out: AmbId[] = ['street'];
  const rain = rainFile(s);
  if (rain) out.push(rain);
  if (s.customers > 0) out.push('murmur');
  if (birdGap(s)) out.push('birds');
  if (crowGap(s)) out.push('crows');
  if (fireworksOn(s)) out.push('fireworks');
  return out;
}

/** Сколько слоёв гомона (одна и та же петля, сдвинутая и чуть иначе по высоте — разные голоса). */
export const MURMUR_LAYERS = 3;

/**
 * Гомон по числу покупателей: громкость каждого из трёх слоёв (0…1). Один-два человека — едва
 * слышный разговор у полки, к пяти — первый слой целиком, к девяти-десяти — второй, к четырнадцати —
 * третий. Не «вечеринка»: даже полный зал — ровный негромкий гул голосов (и весь он тише прежнего,
 * ambienceFiles.ts). На слабом телефоне — один слой (чуть громче, когда людно).
 */
export function murmurGains(customers: number, lite: boolean): number[] {
  const n = Math.max(0, customers);
  const first = Math.min(1, (n / 5) ** 1.5);
  if (lite) return [Math.min(1.25, first * (1 + Math.max(0, n - 6) * 0.05)), 0, 0];
  return [first, Math.min(1, Math.max(0, (n - 5) / 5)), Math.min(1, Math.max(0, (n - 9) / 5))];
}

/** Следующий промежуток: случайно между min и max. */
export const nextGap = (gap: [number, number], random: Random): number => gap[0] + random() * (gap[1] - gap[0]);

/**
 * Улица за стеклом витрины. Дверь закрыта — верх глуше (полка shelf дБ выше ~1.8 кГц и срез cut Гц);
 * открыта (open 0…1) — стекла нет: улица на миг яркая и чуть громче (gain).
 */
export const GLASS = { shelf: -8, cut: 7000, open: 16000, lift: 1.5 };
export function glassAt(open: number): { shelf: number; cut: number; gain: number } {
  const k = Math.min(1, Math.max(0, open));
  return {
    shelf: GLASS.shelf * (1 - k),
    // По частоте — как слышит ухо: равномерно по октавам, а не по герцам.
    cut: GLASS.cut * (GLASS.open / GLASS.cut) ** k,
    gain: 1 + (GLASS.lift - 1) * k,
  };
}
