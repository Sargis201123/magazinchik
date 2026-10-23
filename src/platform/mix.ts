// Звуковой «пульт» без WebAudio: громкость каналов и её хранение, сторона звука по месту на экране,
// варианты и ограничение одинаковых звуков подряд. Чистые функции — их проверяют тесты,
// а сам граф (mixer.ts) только применяет то, что они посчитали.

/** Ползунки громкости в настройках: общая и по каналам (0…1). */
export interface Volumes {
  master: number;
  music: number;
  /** Окружение: улица (дождь, ветер, птицы) и зал (гул, шаги, колокольчик). */
  ambience: number;
  /** Эффекты: касса, монетки, товар на полке, кнопки. */
  effects: number;
  /** Голоса героев в диалогах. */
  voices: number;
}

export type VolumeKey = keyof Volumes;
export const VOLUME_KEYS: VolumeKey[] = ['master', 'music', 'ambience', 'effects', 'voices'];

/** По умолчанию не на максимуме: если на телефоне тихо, есть куда прибавить. */
export const DEFAULT_VOLUMES: Volumes = { master: 0.8, music: 0.8, ambience: 0.8, effects: 0.8, voices: 0.8 };

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * Громкости из хранилища. Новых настроек ещё нет — переносим старые выключатели: «без звука»
 * гасил эффекты и погоду (и голоса), «без музыки» — музыку. Игрок, который их выключил, не должен
 * после обновления снова услышать то, от чего отказался.
 */
export function parseVolumes(raw: string | null, legacySound: string | null, legacyMusic: string | null): Volumes {
  if (raw) {
    try {
      const data = JSON.parse(raw) as Partial<Record<VolumeKey, unknown>>;
      const out = { ...DEFAULT_VOLUMES };
      for (const key of VOLUME_KEYS) {
        const v = data?.[key];
        if (typeof v === 'number' && Number.isFinite(v)) out[key] = clamp01(v);
      }
      return out;
    } catch {
      // Испорченная запись — как будто её нет.
    }
  }
  const out = { ...DEFAULT_VOLUMES };
  if (legacySound === '1') out.effects = out.ambience = out.voices = 0;
  if (legacyMusic === '1') out.music = 0;
  return out;
}

/**
 * Положение ползунка → усиление. Слух логарифмический: при линейной шкале половина ползунка
 * звучала бы почти как полный. Квадрат — середина ≈ −12 дБ (на слух примерно вдвое тише), ноль — тишина.
 */
export const sliderGain = (v: number): number => clamp01(v) ** 2;

/** Что выключено (для аналитики): 1 — всё без звука, 2 — музыка, 4 — окружение, 8 — эффекты, 16 — голоса. */
export function silenceMask(v: Volumes, muted: boolean): number {
  let mask = muted || v.master === 0 ? 1 : 0;
  if (v.music === 0) mask |= 2;
  if (v.ambience === 0) mask |= 4;
  if (v.effects === 0) mask |= 8;
  if (v.voices === 0) mask |= 16;
  return mask;
}

/** Насколько разводить звук по сторонам: −1…1 звучало бы как в одном наушнике. */
export const PAN_SPREAD = 0.6;

/**
 * Звук из мира: касса слева на экране — слышна слева. Возвращает сторону (−1…1), громкость
 * и виден ли источник: за краем экрана звук тише, а мелочь (шаги) там можно не играть вовсе.
 */
export function worldPan(x: number, viewLeft: number, viewWidth: number): { pan: number; gain: number; onScreen: boolean } {
  if (!(viewWidth > 0) || !Number.isFinite(x)) return { pan: 0, gain: 1, onScreen: true };
  const rel = (x - viewLeft) / viewWidth;
  const pan = Math.max(-1, Math.min(1, rel * 2 - 1)) * PAN_SPREAD;
  // На сколько экранов источник за краем: на экран дальше — вдвое тише, но не глуше −12 дБ.
  const away = rel < 0 ? -rel : rel > 1 ? rel - 1 : 0;
  return { pan, gain: Math.max(0.25, 1 / (1 + 2 * away)), onScreen: away === 0 };
}

/** Генератор случайных чисел: Math.random в игре, с зерном — в тестах. */
export type Random = () => number;

/** Разброс высоты (в центах) и громкости (в дБ): одинаковый звук подряд не звучит «пулемётом». */
export function jitter(random: Random, cents: number, db: number): { rate: number; gain: number } {
  const c = (random() * 2 - 1) * cents;
  const d = (random() * 2 - 1) * db;
  return { rate: 2 ** (c / 1200), gain: 10 ** (d / 20) };
}

/** Какой из count вариантов сыграть: случайный, но не тот же, что в прошлый раз. */
export function pickVariant(last: number, count: number, random: Random): number {
  if (count <= 1) return 0;
  const pick = Math.floor(random() * (count - 1));
  return last >= 0 && last < count && pick >= last ? pick + 1 : pick;
}

/** Правило для частого звука: не чаще раза в gap секунд и не больше max сразу. */
export interface VoiceRule {
  gap: number;
  max: number;
  /** Мелочь (шаги, «чпок») уступает место, когда звуков и так много. */
  low?: boolean;
}

/**
 * Ограничитель голосов: на большой корзине, при ×2 и в час пик одинаковые звуки не идут очередью
 * и не накладываются десятком, а общий счёт звуков сразу не растёт без конца (на слабом телефоне — меньше).
 */
export class VoiceLimiter {
  private readonly last = new Map<string, number>();
  private readonly playing = new Map<string, number[]>();
  private all: number[] = [];

  constructor(public cap: number) {}

  /** Можно ли сыграть звук key сейчас (now — секунды), длиной dur. Если да — он учтён. */
  allow(key: string, rule: VoiceRule, now: number, dur: number): boolean {
    this.all = this.all.filter((end) => end > now);
    if (now - (this.last.get(key) ?? -Infinity) < rule.gap) return false;
    const mine = (this.playing.get(key) ?? []).filter((end) => end > now);
    if (mine.length >= rule.max) return false;
    // Мелочи — не больше половины общего запаса.
    if (this.all.length >= (rule.low ? Math.ceil(this.cap / 2) : this.cap)) return false;
    this.last.set(key, now);
    mine.push(now + dur);
    this.playing.set(key, mine);
    this.all.push(now + dur);
    return true;
  }
}
