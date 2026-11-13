// Касса в ритме (13.11, автор: «Час пик глубже: серия обслуживания заметно влияет на выручку»).
// Раньше хозяин, начав пробивать, пробивал корзину сам: одно касание — и жди. Теперь, когда покупателя
// пробивает сам игрок, первые товары корзины (не больше RHYTHM_TAPS) едут по ленте к сканеру, и каждый надо
// «пикнуть» касанием, когда он под лучом:
// - точно в такт — «Идеально ×N»: растёт ритм, а с ним чаевые (складываются с чаевыми серии, series.ts);
// - просто в окне — обычный «пик», ритм не рвётся;
// - промах (коснулся, но не в окне) — товар уезжает назад и проезжает ещё раз: покупатель ждёт чуть
//   дольше, денег за промах не берём. Второй промах на том же товаре — хозяин пробивает его сам, без бонуса:
//   лента не должна держать покупателя у кассы вечно;
// - проехал без касания — хозяин пробивает его сам сразу, без «Ещё разок» (13.11, ревью: игрока в это время
//   зовут и звонок, и вор, и «моменты» — не касался, значит, не промахивался). Ритм рвётся, ускорения нет,
//   но и медленнее прежнего не выходит: кто ленту не трогает, пробивает как раньше (beltRest).
// В такт пробивка на RHYTHM_PACE быстрее прежней — «руками выгоднее» и временем, а не только чаевыми.
// Кассир-сотрудник пробивает сам, как раньше. Здесь только правила и счёт (без Phaser): лента — scenes/tillBelt.ts.
// Случайностей нет: всё решает касание игрока; симулятор считает игрока средним по точности (SIM_HIT).

import { checkoutSeconds, type ScanTiming, type StoreState } from './economy';
import { seriesTipRate } from './series';

/** Сколько товаров корзины едут по ленте под касание: больше — уже мини-игра, а не касса. Остальное хозяин пробивает сам. */
export const RHYTHM_TAPS = 3;
/** Насколько быстрее прежней пробивки идёт корзина, пробитая в такт без промахов. */
export const RHYTHM_PACE = 0.85;
/** Шаг ленты (мс между товарами под лучом): не чаще — на телефоне не успеть, не реже — скучно. */
export const BEAT_MIN_MS = 420;
export const BEAT_MAX_MS = 1000;
/** Окно касания вокруг прихода товара под луч (мс в обе стороны): «Идеально» и просто «пик». */
export const PERFECT_MS = 90;
export const GOOD_MS = 200;
/** Касание раньше этого (мс до прихода товара) — ещё не про этот товар, его не считаем вовсе. */
export const EARLY_MS = 380;
/**
 * После окна прошлого товара столько мс касание не судим вовсе (13.11, ревью): на частой ленте опоздавшее
 * касание по прошлому товару или дребезг пальца после «пик» иначе засчитались бы ранним промахом по следующему —
 * одно касание, два «Ещё разок». Окно «пик» следующего товара это не трогает.
 */
export const CALM_MS = 100;
/** Промах: товар отъезжает к началу ленты за столько мс. */
export const RETURN_MS = 300;
/** Сколько раз товар может проехать под лучом; на последнем проезде без касания хозяин пробивает его сам. */
export const MAX_PASSES = 2;
/** Чаевые за ритм: доля корзины за каждое «Идеально» подряд, но не больше RHYTHM_TIP_MAX. */
export const RHYTHM_TIP_STEP = 0.01;
export const RHYTHM_TIP_MAX = 0.06;
/** В час пик чаевые за ритм вдвое: самое время держать такт. */
export const RUSH_RHYTHM = 2;
/**
 * Симулятор: средний игрок пробивает товар ленты в такт в 3 случаях из 5 — то держит ритм, то отвлёкся на
 * звонок или вора, а то и вовсе не трогает ленту. 13.11: не тронутая лента пробивает как прежде, так что
 * средний игрок чуть быстрее прежнего, а заметно быстрее — тот, кто держит такт.
 */
export const SIM_HIT = 0.6;

/** Лента включена, только когда карточку «Новое: Касса в ритме» уже прочли (tips.ts): правило не застаёт врасплох. */
export const rhythmOn = (state: StoreState): boolean => (state.seenTips ?? []).includes('rhythm');

/**
 * Метка в seenTips: первое «Идеально» уже было. До него, пока едет лента, внизу экрана подсказка — куда и когда
 * жать (карточку утром могли пролистать, а круг у сканера без слов понятен не всем).
 */
export const RHYTHM_HIT_TIP = 'rhythmHit';
export const rhythmTaught = (state: StoreState): boolean => (state.seenTips ?? []).includes(RHYTHM_HIT_TIP);

export type Grade = 'perfect' | 'good' | 'miss';
/** Как пробит товар: касанием (perfect/good) или самим хозяином после второго промаха (auto). */
export type Scanned = 'perfect' | 'good' | 'auto';

/** План пробивки игроком: taps товаров едут по ленте с шагом beat (мс), потом ещё rest мс — остальные товары и оплата. */
export interface BeltPlan {
  taps: number;
  beat: number;
  rest: number;
}

export function beltPlan(t: ScanTiming, items: number): BeltPlan {
  // Товарам ленты — их доля прежнего времени (быстрее на RHYTHM_PACE). Ловкому хозяину на хорошей кассе её
  // не хватает и на шаг BEAT_MIN_MS за товар — тогда касаний меньше, остальное он пробивает сам.
  const total = checkoutSeconds(t, items) * 1000;
  const share = Math.min(RHYTHM_TAPS, items) * t.item * 1000 * RHYTHM_PACE;
  let taps = items > 0 ? Math.max(1, Math.min(RHYTHM_TAPS, items, Math.round(share / BEAT_MIN_MS))) : 0;
  let beat = 0;
  // Товар, проехавший без касания, хозяин пробивает в конце его окна. Лента, которую не трогали, не должна
  // выйти дольше прежней пробивки (13.11, ревью) — иначе меньше касаний; совсем быстрому хозяину ленты нет.
  for (; taps > 0; taps--) {
    beat = Math.min(BEAT_MAX_MS, Math.max(BEAT_MIN_MS, share / taps));
    if (taps * beat + GOOD_MS <= total) break;
  }
  if (!taps) return { taps: 0, beat: 0, rest: total };
  // Всё вместе — как прежняя пробивка, только быстрее на RHYTHM_PACE; лента берёт своё, остальное — после неё.
  return { taps, beat, rest: Math.max(0, total * RHYTHM_PACE - taps * beat) };
}

/** До скольких мс раньше прихода товара касание ещё про него (раннее — промах): на частой ленте — меньше, см. CALM_MS. */
export const earlyFor = (beat: number): number => Math.max(GOOD_MS, Math.min(EARLY_MS, beat - GOOD_MS - CALM_MS));

/**
 * Как засчитать касание: dt — на сколько мс оно позже (+) или раньше (−) прихода товара под луч. null — слишком
 * рано, не считаем (раньше early мс).
 */
export function judge(dt: number, early = EARLY_MS): Grade | null {
  if (dt < -early) return null;
  const off = Math.abs(dt);
  return off <= PERFECT_MS ? 'perfect' : off <= GOOD_MS ? 'good' : 'miss';
}

/** Товар на ленте: когда придёт под луч (мс часов ленты), который это проезд и чем кончился. */
export interface BeltItem {
  index: number;
  arrive: number;
  passes: number;
  scanned?: Scanned;
}

export interface Belt {
  beat: number;
  items: BeltItem[];
}

/** Что случилось с товаром: пробит (perfect/good/auto) или промах — и он поехал ещё раз. */
export interface BeltEvent {
  index: number;
  grade: Grade | 'auto';
}

/** Покупатель выложил count товаров: первый придёт под луч через шаг, каждый следующий — шагом позже. */
export const startBelt = (count: number, beat: number, now: number): Belt => ({
  beat,
  items: Array.from({ length: count }, (_, index) => ({ index, arrive: now + beat * (index + 1), passes: 1 })),
});

/** Чей черёд под лучом: ближайший к сканеру непробитый товар. */
export const nextItem = (belt: Belt): BeltItem | undefined =>
  belt.items.filter((i) => !i.scanned).reduce<BeltItem | undefined>((best, i) => (!best || i.arrive < best.arrive ? i : best), undefined);

export const beltDone = (belt: Belt): boolean => belt.items.every((i) => i.scanned);

const settle = (belt: Belt, index: number, scanned: Scanned): Belt => ({ ...belt, items: belt.items.map((i) => (i.index === index ? { ...i, scanned } : i)) });

/** Промах по товару: ещё один проезд — в хвост ленты; проезды кончились — хозяин пробивает сам. */
function miss(belt: Belt, item: BeltItem, now: number): { belt: Belt; event: BeltEvent } {
  if (item.passes >= MAX_PASSES) return { belt: settle(belt, item.index, 'auto'), event: { index: item.index, grade: 'auto' } };
  const last = Math.max(-Infinity, ...belt.items.filter((i) => !i.scanned && i.index !== item.index).map((i) => i.arrive));
  const arrive = Math.max(now + RETURN_MS + belt.beat, last + belt.beat);
  return {
    belt: { ...belt, items: belt.items.map((i) => (i.index === item.index ? { ...i, arrive, passes: i.passes + 1 } : i)) },
    event: { index: item.index, grade: 'miss' },
  };
}

/**
 * Касание в момент at (часы ленты), засчитанное в now (по умолчанию тогда же): промах по полу сцена засчитывает,
 * когда палец подняли, — товар уезжает на второй проезд от now. event null — касание не про ленту (рано или
 * пробивать нечего).
 */
export function beltTap(belt: Belt, now: number, at = now): { belt: Belt; event: BeltEvent | null } {
  const item = nextItem(belt);
  const grade = item ? judge(at - item.arrive, earlyFor(belt.beat)) : null;
  if (!item || !grade) return { belt, event: null };
  if (grade === 'miss') return miss(belt, item, now);
  return { belt: settle(belt, item.index, grade), event: { index: item.index, grade } };
}

/** Время идёт: товар, проехавший окно без касания, хозяин пробивает сам — не промах и второго проезда нет. */
export function beltTick(belt: Belt, now: number): { belt: Belt; events: BeltEvent[] } {
  const events: BeltEvent[] = [];
  for (let item = nextItem(belt); item && now - item.arrive > GOOD_MS; item = nextItem(belt)) {
    belt = settle(belt, item.index, 'auto');
    events.push({ index: item.index, grade: 'auto' });
  }
  return { belt, events };
}

/** Корзина пробита в такт: каждый товар ленты — касанием в окне, с первого проезда. */
export const beltClean = (belt: Belt): boolean => belt.items.every((i) => i.passes === 1 && (i.scanned === 'perfect' || i.scanned === 'good'));

/**
 * Сколько мс пробивать остаток корзины и оплату после ленты, которая шла elapsed мс. В такт — по плану
 * (вся пробивка на RHYTHM_PACE быстрее прежней). Иначе ускорения нет, но вся пробивка не дольше прежней,
 * пока лента сама не заняла больше: кто ленту не трогал, пробивает ровно как раньше (13.11, ревью).
 */
export const beltRest = (plan: BeltPlan, t: ScanTiming, items: number, belt: Belt, elapsed: number): number =>
  beltClean(belt) ? plan.rest : Math.max(0, checkoutSeconds(t, items) * 1000 - elapsed);

/** «Идеально ×N» после товара: идеально — +1, просто «пик» — как было, промах — с нуля. */
export const rhythmAfter = (streak: number, grade: Grade | 'auto'): number => (grade === 'perfect' ? Math.max(0, streak) + 1 : grade === 'good' ? Math.max(0, streak) : 0);

/** Доля корзины, которую добавляет к чаевым ритм streak (в час пик — вдвое). */
export const rhythmTipRate = (streak: number, rush = false): number =>
  Math.min(RHYTHM_TIP_MAX, RHYTHM_TIP_STEP * Math.max(0, streak)) * (rush ? RUSH_RHYTHM : 1);

/**
 * Чаевые у кассы хозяина: серия (series.ts) и ритм складываются в одну долю корзины. Без ритма (streak 0) —
 * ровно прежние чаевые серии. Целые монеты, и раз уж положены — не меньше одной.
 */
export function tillTip(series: number, streak: number, total: number, rush = false): number {
  const rate = seriesTipRate(series) + rhythmTipRate(streak, rush);
  return rate > 0 && total > 0 ? Math.max(1, Math.round(total * rate)) : 0;
}

/**
 * Сколько секунд в среднем уходит на покупателя с items товарами, когда пробивает сам игрок в ритме (для
 * симулятора): все товары ленты в такт (hit — доля попаданий на товар) — на RHYTHM_PACE быстрее прежнего;
 * иначе — как прежде (beltRest). Лишний проезд после настоящего промаха обычно укладывается в прежнее время.
 */
export function rhythmSeconds(t: ScanTiming, items: number, hit = SIM_HIT): number {
  const plan = beltPlan(t, items);
  const old = checkoutSeconds(t, items);
  if (!plan.taps) return old;
  const clean = hit ** plan.taps;
  return clean * ((plan.taps * plan.beat + plan.rest) / 1000) + (1 - clean) * old;
}
