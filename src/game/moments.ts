// Активные моменты дня: короткие дела на пару секунд, которые хочется нажать. Малыш уронил монетку,
// банка для чаевых у кассы полна, постоянный гость машет с порога, покупатель просит уступить, разбилась
// банка варенья, довольный гость оставил звёздочку. Каждый — по желанию: не успел — просто нет маленького
// бонуса, штрафа нет. Новой экономики тоже нет: чаевые, искорка к рейтингу (вечером) и задание дня
// «поймай моменты» (endless.ts). День — 90 секунд, моментов 1–3: примерно раз в 20–40 секунд.
// Здесь — чистая логика (сколько, когда, что, награда); показывает сцена (StoreScene.ts, «Моменты»).

import { DAY_SECONDS, type DayStats, type StoreState } from './economy';
import { bigDayFor, type BigDayId } from './bigday';
import { tutStep } from './tutorial';

export const MOMENT_KINDS = ['coin', 'tipjar', 'wave', 'haggle', 'spill', 'star'] as const;
export type MomentKind = (typeof MOMENT_KINDS)[number];

/** Со второго дня: первый день — только бабушкино обучение. */
export const MOMENTS_FROM_DAY = 2;
/** Больше стольких за день не бывает. */
export const MOMENTS_CAP = 3;
/** Сколько момент ждёт нажатия, мс настоящего времени (на ×2 — столько же: окно не сжимается). */
export const MOMENT_WINDOW_MS = 4500;
/** Где в дне бывают моменты (доли дня): не в первые секунды и не под закрытие. */
export const MOMENT_SPAN: readonly [number, number] = [0.12, 0.85];
/** Момент не случился вовремя (окно, звонок, обучение) — сколько секунд дня ещё ждать, прежде чем отменить. */
export const MOMENT_PATIENCE = 12;
/** Особые дни, когда и так хватает дел: момент один. */
const BIG_BUSY: BigDayId[] = ['robbery', 'quake', 'flood', 'blackout', 'epidemic'];

/** Кому нужен человек в зале или в очереди: без него момент заменяется другим. */
export const MOMENT_NEEDS: Record<MomentKind, 'hall' | 'queue' | null> = {
  coin: null,
  tipjar: null,
  spill: null,
  wave: 'hall',
  star: 'hall',
  haggle: 'queue',
};

/** Чем награждает: чаевые в кассу, искорка к рейтингу или и то и другое со скидкой (уступил в цене). */
export const MOMENT_REWARD: Record<MomentKind, 'tip' | 'star' | 'haggle'> = {
  coin: 'tip',
  tipjar: 'tip',
  wave: 'tip',
  spill: 'star',
  star: 'star',
  haggle: 'haggle',
};

/** Значок момента — в подсказке и в аналитике. */
export const MOMENT_ICONS: Record<MomentKind, string> = {
  coin: '🪙',
  tipjar: '🫙',
  wave: '👋',
  haggle: '🤝',
  spill: '🧹',
  star: '⭐',
};

/**
 * Чаевые за момент растут с магазином: в ларьке 5, в универмаге ~33, в гипермаркете ~40. Два-три пойманных
 * за день — около 1–3% прибыли дня (docs/BALANCE.md «Активные моменты»).
 */
export const momentTip = (level: number): number => Math.round(5 + 5 * level ** 1.2);
/** «Уступить»: скидка — половина чаевых, зато гость счастлив и рейтингу искорка. */
export const haggleDiscount = (level: number): number => Math.max(2, Math.round(momentTip(level) / 2));
/** Искорка к рейтингу за момент (вечером) и не больше стольких за день. */
export const MOMENT_RATING = 0.01;
export const MOMENT_RATING_CAP = 0.03;

/** Прибавка к рейтингу вечером за искорки дня. */
export const momentRating = (stats: Pick<DayStats, 'momentStars'>): number => Math.min(MOMENT_RATING_CAP, (stats.momentStars ?? 0) * MOMENT_RATING);

/**
 * Сколько моментов сегодня: второй день — один (обучение «пробей покупку» уже позади), с третьего — два,
 * с восьмого — три (раз в ~20 секунд). В тяжёлый особый день — один.
 */
export function momentCount(state: StoreState): number {
  if (state.day < MOMENTS_FROM_DAY) return 0;
  // Бабушка ещё учит пробивать — не отвлекать.
  if (tutStep(state) === 'serve') return 0;
  if (state.day === 2) return 1;
  if (state.day === 3) return 2;
  const big = bigDayFor(state.day);
  if (big && BIG_BUSY.includes(big)) return 1;
  return Math.min(MOMENTS_CAP, state.day >= 8 ? 3 : 2);
}

export interface MomentPlan {
  /** На какой секунде дня. */
  at: number;
  kind: MomentKind;
}

/**
 * Моменты дня по порядку. День делится на равные куски — в каждом по моменту, в случайном месте, но не
 * у самого края: между двумя всегда не меньше ~12 секунд дня. Виды не повторяются; первый момент новичка
 * (2-й день) — монетка: она понятнее всех и не требует гостей.
 */
export function momentsFor(state: StoreState, random: () => number): MomentPlan[] {
  const count = momentCount(state);
  if (!count) return [];
  const [from, to] = MOMENT_SPAN;
  const slot = ((to - from) * DAY_SECONDS) / count;
  const pool: MomentKind[] = [...MOMENT_KINDS];
  const out: MomentPlan[] = [];
  for (let i = 0; i < count; i++) {
    const at = Math.round(from * DAY_SECONDS + slot * i + slot * (0.25 + 0.5 * random()));
    const kind = state.day === MOMENTS_FROM_DAY && i === 0 ? 'coin' : pool[Math.floor(random() * pool.length)];
    pool.splice(pool.indexOf(kind), 1);
    out.push({ at, kind });
  }
  return out;
}

/** Замена, если для момента некого позвать (в зале пусто или очереди нет): то, что не требует гостей. */
const FALLBACK: Record<MomentKind, MomentKind> = { coin: 'coin', tipjar: 'tipjar', spill: 'spill', wave: 'coin', star: 'spill', haggle: 'tipjar' };

/** Какой момент показать сейчас: задуманный, если для него есть гость, иначе замена. */
export function momentNow(kind: MomentKind, ctx: { hall: boolean; queue: boolean }): MomentKind {
  const need = MOMENT_NEEDS[kind];
  if (need === 'hall' && !ctx.hall) return FALLBACK[kind];
  if (need === 'queue' && !ctx.queue) return FALLBACK[kind];
  return kind;
}

/** Что даёт пойманный момент: деньги (минус — скидка) и искорка ли к рейтингу. */
export function momentGain(kind: MomentKind, level: number): { money: number; star: boolean } {
  switch (MOMENT_REWARD[kind]) {
    case 'tip':
      return { money: momentTip(level), star: false };
    case 'star':
      return { money: 0, star: true };
    case 'haggle':
      return { money: -haggleDiscount(level), star: true };
  }
}

/** Учёт в статистике дня: показали, поймали, искорки. */
export function noteMoment(stats: DayStats, caught: boolean, star = false): void {
  stats.momentsShown = (stats.momentsShown ?? 0) + 1;
  if (!caught) return;
  stats.moments = (stats.moments ?? 0) + 1;
  if (star) stats.momentStars = (stats.momentStars ?? 0) + 1;
}

/**
 * Модель для симулятора: игрок ловит каждый момент с вероятностью catchRate (по умолчанию ~60%).
 * Вид — тот, что задуман (в симуляторе гости в зале есть всегда).
 */
export const SIM_CATCH = 0.6;
export function simMoments(state: StoreState, random: () => number, catchRate = SIM_CATCH): { shown: number; caught: number; money: number; stars: number } {
  let caught = 0;
  let money = 0;
  let stars = 0;
  const plan = momentsFor(state, random);
  for (const m of plan) {
    if (random() >= catchRate) continue;
    caught++;
    const gain = momentGain(m.kind, state.level);
    money += gain.money;
    if (gain.star) stars++;
  }
  return { shown: plan.length, caught, money, stars };
}
