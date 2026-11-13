// Ритуал закрытия (scenes/closingRitual.ts): что и когда показать после конца дня — чистый план, без Phaser.
// Табличка «Закрыто», свет гаснет рядами от задней стены к двери, выручка дня монетами в ящик кассы, рубильник,
// кот потягивается, Бобик уходит в будку, роллеты — и только потом итоги дня.
// 13.11, автор: «магазин долго закрывается» — без касаний весь ритуал не дольше ~3,5 с, в лёгкой графике ~2 с;
// одно касание сжимает остаток в 0,6 с. Случайности здесь нет: план зависит только от зала и выручки.

export type ClosingKind = 'sign' | 'row' | 'till' | 'main' | 'cat' | 'dog' | 'shutters' | 'end';

export interface ClosingStep {
  kind: ClosingKind;
  /** Мс от конца дня. */
  at: number;
  /** Шаг 'row': гаснут все ряды ламп до этого включительно (0 — у задней стены). */
  row?: number;
}

export interface ClosingPlan {
  steps: ClosingStep[];
  /** Сколько монет ссыпается в ящик (0 — выручки нет, шага кассы нет). */
  coins: number;
  /** Когда открываются итоги дня (шаг 'end'). */
  total: number;
}

export interface ClosingInput {
  /** Рядов потолочных ламп в зале (ряд у двери гаснет вместе с рубильником). */
  rows: number;
  revenue: number;
  lite: boolean;
  /** Свет уже отключили (событие дня): гасить нечего — рядов нет. */
  dark: boolean;
  /** Кот на лежанке (потягивается) и Бобик у будки (уходит в неё). */
  cat: boolean;
  dog: boolean;
}

/** Первые мс касания не считаются: игрок ещё жмёт на кассу в вечерней суете — пропустить случайно обидно. */
export const CLOSING_ARM_MS = 350;
/** Касание: всё, что осталось, доигрывается быстро — за столько мс (ничего не обрывается, просто бегом). */
export const CLOSING_CASCADE_MS = 600;
/** До какого дня внизу подсказка «Нажми — закроемся быстрее». */
export const CLOSING_HINT_DAYS = 7;
/** Потолок длительности без касаний (мс): тесты держат план в этих рамках. */
export const CLOSING_MAX = { normal: 3500, lite: 2000 } as const;
/** Больше монет не летит: длинная струйка — это ожидание, а не праздник. */
const COINS_MAX = { normal: 12, lite: 4 } as const;

const NORMAL = {
  sign: 100,
  afterSign: 180,
  rowFrom: 380,
  sweep: 800,
  stepMin: 160,
  stepMax: 300,
  mainGap: 280,
  tillGap: 220,
  coinFrom: 100,
  coinStep: 55,
  coinFly: 240,
  tillTail: 180,
  cat: 120,
  dog: 200,
  shutters: 380,
  end: 560,
};
const LITE: typeof NORMAL = {
  ...NORMAL,
  sign: 80,
  afterSign: 150,
  rowFrom: 300,
  mainGap: 250,
  tillGap: 200,
  coinFrom: 100,
  coinStep: 80,
  coinFly: 200,
  tillTail: 120,
  cat: 100,
  dog: 150,
  shutters: 220,
  end: 400,
};

/** Сроки монет кассы (мс): сцена берёт те же числа, что и план. */
export function closingCoinTiming(lite: boolean): { from: number; step: number; fly: number } {
  const T = lite ? LITE : NORMAL;
  return { from: T.coinFrom, step: T.coinStep, fly: T.coinFly };
}

/** Сколько монет ссыпается в ящик: от трёх, с выручкой растёт медленно (по логарифму), не больше потолка. */
export function closingCoins(revenue: number, lite: boolean): number {
  if (!(revenue > 0)) return 0;
  return Math.min(lite ? COINS_MAX.lite : COINS_MAX.normal, 3 + Math.floor(Math.log2(1 + revenue / 40)));
}

/** План ритуала: шаги по времени (не убывают), последний — 'end' (итоги дня) в момент total. */
export function closingPlan(o: ClosingInput): ClosingPlan {
  const T = o.lite ? LITE : NORMAL;
  const steps: ClosingStep[] = [{ kind: 'sign', at: T.sign }];
  // Гаснут все ряды, кроме ряда у двери: он, касса и фасад — вместе с рубильником.
  const sweep = o.dark ? 0 : Math.max(0, Math.floor(o.rows) - 1);
  let lit = T.sign + T.afterSign;
  if (sweep && o.lite) {
    // Лёгкая графика: карта света перерисовывается 4 раза в секунду — ряды гаснут разом, одним шагом.
    steps.push({ kind: 'row', at: T.rowFrom, row: sweep - 1 });
    lit = T.rowFrom;
  } else if (sweep) {
    // Шаг между рядами — заметный, но вся волна не дольше sweep (рядов больше обычного — шаг мельче).
    const step = Math.min(T.stepMax, Math.max(T.stepMin, Math.round(T.sweep / sweep)), Math.floor(T.sweep / Math.max(1, sweep - 1)));
    for (let r = 0; r < sweep; r++) steps.push({ kind: 'row', at: T.rowFrom + r * step, row: r });
    lit = T.rowFrom + (sweep - 1) * step;
  }
  const coins = closingCoins(o.revenue, o.lite);
  let main = lit + T.mainGap;
  if (coins) {
    const till = lit + T.tillGap;
    steps.push({ kind: 'till', at: till });
    main = till + T.coinFrom + (coins - 1) * T.coinStep + T.coinFly + T.tillTail;
  }
  steps.push({ kind: 'main', at: main });
  if (o.cat) steps.push({ kind: 'cat', at: main + T.cat });
  if (o.dog) steps.push({ kind: 'dog', at: main + T.dog });
  const shutters = main + T.shutters;
  steps.push({ kind: 'shutters', at: shutters }, { kind: 'end', at: shutters + T.end });
  return { steps, coins, total: shutters + T.end };
}
