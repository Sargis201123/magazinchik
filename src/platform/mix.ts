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

/** Каналы под общей громкостью. */
const CHANNEL_KEYS = VOLUME_KEYS.filter((key) => key !== 'master');

/**
 * Не слышно ничего: выключено кнопкой, общая громкость на нуле или на нуле все каналы разом —
 * так переезжают старые «без звука» и «без музыки», выключенные вместе.
 */
export function inaudible(v: Volumes, muted: boolean): boolean {
  return muted || v.master === 0 || CHANNEL_KEYS.every((key) => v[key] === 0);
}

/**
 * Громкости, когда звук включают быстрой кнопкой. Ползунки остаются как были — разве что звук убран
 * ими до нуля (общая или все каналы): их возвращаем к обычным, иначе «включить» ничего бы не включило.
 */
export function audibleAgain(v: Volumes): Volumes {
  const out = { ...v };
  if (v.master === 0) out.master = DEFAULT_VOLUMES.master;
  if (CHANNEL_KEYS.every((key) => v[key] === 0)) for (const key of CHANNEL_KEYS) out[key] = DEFAULT_VOLUMES[key];
  return out;
}

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

/**
 * Важность звука — кто уступает, когда звуков много. По убыванию: отклик на то, что сделал игрок (деньги,
 * продажа, кнопки, «хорошо» и «плохо»), сюжет (голоса героев, важный гость, гром), события мира (касса
 * у кассира, товар на полке, кот, печь, швабра) и разовые звуки окружения (колокольчик двери, птицы,
 * велозвонок, фонарь). Первые два звучат всегда; события мира и окружение ждут, пока станет тише.
 */
export type Tier = 'feedback' | 'story' | 'world' | 'ambience';

/** Правило для частого звука: не чаще раза в gap секунд и не больше max сразу. */
export interface VoiceRule {
  gap: number;
  max: number;
  /** Мелочь (шаги, «чпок»): уступает место, когда звуков и так много, и сама «людность» не прибавляет. */
  low?: boolean;
  /** Важность; по умолчанию — событие мира. */
  tier?: Tier;
  /**
   * Звук по событию игры (а не по касанию игрока или часам атмосферы — тогда false): на ×2 таких
   * событий вдвое больше, поэтому пауза между ними вдвое длиннее, а у событий мира и окружения
   * звучит лишь каждое второе. По умолчанию — да.
   */
  game?: boolean;
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

/**
 * Бюджет звука. Сколько звуков слышно за последние полторы секунды: событиям мира хватает места,
 * пока их меньше пяти, окружению — пока меньше двух (в час пик колокольчик двери и птицы молчат,
 * а касса слышна). Игрок только что коснулся экрана, идёт диалог или заставка — «тише»: события мира
 * на ~4 дБ тише, окружение не звучит вовсе.
 */
export const BUDGET = {
  window: 1.5,
  busy: { world: 5, ambience: 2 } as Record<'world' | 'ambience', number>,
  /** Сколько секунд после касания мир звучит тише. */
  calm: 1.2,
  calmGain: 0.63,
  /**
   * Сколько звуков каждого канала звучит сразу: мир не займёт весь общий запас, и кнопкам с голосами
   * всегда есть место (на слабом телефоне — вдвое меньше).
   */
  voices: { ui: 4, world: 6, hall: 3, street: 3, voice: 3, sting: 2 } as Record<string, number>,
};

/**
 * Пульт решает, что звучит: ограничитель голосов (паузы и запас одновременных звуков) плюс важность,
 * «людность» и скорость игры. На ×2 мир не вдвое шумнее: пауза у звука по событию игры растёт вместе
 * со скоростью, а из событий мира и окружения звучит каждое второе — за настоящую секунду их столько же,
 * сколько на ×1 (или меньше).
 */
export class SoundBudget {
  /** Скорость игры (×1, ×2). */
  pace = 1;
  /** До какого момента (секунды) игрок занят: касание, диалог, заставка. */
  calmUntil = -Infinity;
  readonly limiter: VoiceLimiter;
  /** Когда начались недавние звуки (без мелочи). */
  private recent: number[] = [];
  /** «Право» звука на ×2: копится по 1/pace за событие, звучит, когда накопилась единица. */
  private readonly credit = new Map<string, number>();
  /** Когда отзвучат звуки каждого канала. */
  private readonly buses = new Map<string, number[]>();

  /** cap — общий запас одновременных звуков; busScale — доля запаса каналов (слабый телефон — 0.5). */
  constructor(cap: number, private readonly busScale = 1) {
    this.limiter = new VoiceLimiter(cap);
  }

  /** Игрок занят ещё seconds секунд с момента now (дольше, если уже занят дольше). */
  calm(now: number, seconds = BUDGET.calm): void {
    this.calmUntil = Math.max(this.calmUntil, now + seconds);
  }

  /**
   * С какой громкостью можно сыграть звук key канала bus сейчас (now — секунды, dur — длина): 0 — не
   * играть, иначе он учтён (1 — как есть, меньше — мир притих, пока игрок занят).
   */
  admit(key: string, rule: VoiceRule, now: number, dur: number, bus?: string): number {
    const tier = rule.tier ?? 'world';
    const minor = tier === 'world' || tier === 'ambience';
    const paced = rule.game !== false && this.pace > 1;
    this.recent = this.recent.filter((t) => now - t < BUDGET.window);
    const calm = now < this.calmUntil;
    let credit = 1;
    if (minor) {
      if (calm && tier === 'ambience') return 0;
      if (this.recent.length >= BUDGET.busy[tier]) return 0;
      if (paced) {
        credit = Math.min(1, (this.credit.get(key) ?? 1 - 1 / this.pace) + 1 / this.pace);
        this.credit.set(key, credit);
        if (credit < 1 - 1e-9) return 0;
      }
    }
    const mine = bus ? (this.buses.get(bus) ?? []).filter((end) => end > now) : [];
    const room = bus && bus in BUDGET.voices ? Math.max(1, Math.ceil(BUDGET.voices[bus] * this.busScale)) : Infinity;
    if (mine.length >= room) return 0;
    if (!this.limiter.allow(key, paced ? { ...rule, gap: rule.gap * this.pace } : rule, now, dur)) return 0;
    if (bus) {
      mine.push(now + dur);
      this.buses.set(bus, mine);
    }
    if (minor && paced) this.credit.set(key, credit - 1);
    if (!rule.low) this.recent.push(now);
    return minor && calm ? BUDGET.calmGain : 1;
  }
}
