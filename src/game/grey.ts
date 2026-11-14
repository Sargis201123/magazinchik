// Серая схема (13.11, автор: задача #53). Время от времени утром заходит «деловой» Жора с предложением мимо
// закона — одна из новостей утра (headlines.ts, вид 'grey'):
//   • товар без накладных за полцены — партия на склад;
//   • «договориться» с проверяющим — следующий штраф санинспекции или проверки лицензии не выпишут;
//   • продать просрочку под новой этикеткой — уценка и то, что испортится этой ночью, уходит по полной цене.
// Согласился — выгода сразу, но за каждой сделкой прячется риск попасться через несколько дней: штраф (втрое
// больше выгоды, не меньше порога), магазин опечатан до обеда (гостей вдвое меньше), район шепчется (goodwill),
// разгромный отзыв. Риск копится: чем больше сделок за плечами, тем вернее следующая кончится плохо.
// Отказал — Жора обижается и иногда мелко мстит; а партия «без накладных» нередко оказывается краденой —
// тогда участковый заходит сказать спасибо (эхо решений, echoes.ts plantEcho).
//
// Подаём без романтики: в карточке прямо сказано, что это за поступок и чем грозит. Всё, что двигает деньги,
// — от зерна магазина и дня (как catFind в cat.ts): перезапуск дня ничего не перекатывает. Старые сохранения
// без поля grey работают как раньше: Жора просто ещё не заходил.

import { PRODUCT_IDS, PRODUCTS, homemade, restricted, sellableProducts, unitLife, warehouseCapacity, warehouseCount, type ProductId, type Stock, type StoreState, type Unit } from './economy';
import { fridgeLife } from './gear';
import { addGoodwill } from './goodwill';
import { plantEcho } from './echoes';
import { inZar } from './zarshop';
import { rng } from './random';

export type GreyKind = 'goods' | 'bribe' | 'relabel';
export const GREY_KINDS: readonly GreyKind[] = ['goods', 'bribe', 'relabel'];

/** Чем кончится сделка — решено в момент согласия, но игроку не видно до своего дня. */
export interface GreyBust {
  kind: GreyKind;
  /** В какую ночь попадёшься. */
  due: number;
  fine: number;
}

export interface GreyState {
  /** Не раньше этого дня — следующее предложение. */
  next?: number;
  /** Сколько раз соглашался (от этого растёт риск) и сколько отказывал. */
  deals?: number;
  refused?: number;
  /** Последний ответ: в какой день, на что и согласился ли. */
  last?: { day: number; kind: GreyKind; yes: boolean };
  /** Скрытые «хвосты» сделок: когда и на сколько оштрафуют. */
  busts?: GreyBust[];
  /** Проверяющий «прикормлен»: следующий штраф санинспекции или проверки лицензии не выпишут. */
  cover?: boolean;
  /** День, когда магазин опечатан до обеда. */
  sealed?: number;
  /** Попался: утренняя карточка (seen — её уже закрыли). */
  caught?: { day: number; kind: GreyKind; fine: number; seen?: boolean };
}

/** С какого дня и с какого помещения: середина игры, новичку и так хватает нового (обучение давно позади). */
export const GREY_FROM_DAY = 30;
export const GREY_FROM_LEVEL = 1;
/** После любого ответа — не раньше чем через столько дней; потом заходит в такую долю утр (в среднем раз в ~2 недели). */
export const GREY_GAP = 10;
export const GREY_CHANCE = 0.3;
/** Партия без накладных: штук (10 + 5 на помещение, сколько влезет на склад) по такой доле обычной закупки. */
export const GREY_QTY_BASE = 10;
export const GREY_QTY_LEVEL = 5;
export const GREY_GOODS_MIN = 6;
export const GREY_GOODS_CUT = 0.5;
/** Портящееся быстрее стольких дней Жора не возит: партия хлеба на два дня — не «выгода», а ловушка. */
export const GREY_GOODS_LIFE = 4;
/** Жора возит один из стольких самых дорогих товаров магазина. */
export const GREY_GOODS_TOP = 3;
/** «Договориться» с проверяющим: 300 + 200 за помещение — меньше штрафа лицензии, больше санинспекции. */
export const GREY_BRIBE_BASE = 300;
export const GREY_BRIBE_LEVEL = 200;
/** Перебить этикетки — если набралось хотя бы столько штук уценки и того, что испортится ночью. */
export const GREY_RELABEL_MIN = 4;
/** Риск попасться: с первой сделки 20%, каждая следующая — ещё +15%, не выше 85%. */
export const GREY_RISK_BASE = 0.2;
export const GREY_RISK_STEP = 0.15;
export const GREY_RISK_MAX = 0.85;
/** Попадаются через 3–8 дней после сделки. */
export const GREY_BUST_DELAY: [number, number] = [3, 8];
/** Штраф: втрое больше выгоды сделки, но не меньше 1000 + 500 за помещение. */
export const GREY_FINE_X = 3;
export const GREY_FINE_BASE = 1000;
export const GREY_FINE_LEVEL = 500;
/** Попался: район шепчется (доброе имя), рейтинг вниз, наутро магазин опечатан до обеда — гостей вдвое меньше. */
export const GREY_GOODWILL = -10;
export const GREY_RATING = 0.05;
/** До какой доли дня дверь опечатана: до обеда гостей нет, потом — как обычно; за день — вдвое меньше. */
export const GREY_OPEN_AT = 0.5;
export const GREY_SEALED_GUESTS = 1 - GREY_OPEN_AT;
/** Отказал: партия оказалась краденой (только товар) — в такой доле; иначе Жора мстит — в такой. */
export const GREY_STOLEN = 0.6;
export const GREY_REVENGE = 0.4;
/** Месть — через 2–5 дней; спасибо полиции и отравление просрочкой — через неделю–две. */
export const GREY_REVENGE_DELAY: [number, number] = [2, 5];
export const GREY_ECHO_DELAY: [number, number] = [7, 14];

export interface GreyOffer {
  kind: GreyKind;
  /** Товар партии (goods). */
  product?: ProductId;
  /** Штук: в партии или под новой этикеткой. */
  qty: number;
  /** Сколько платит игрок (goods, bribe). */
  price: number;
  /** Выгода: сэкономил на партии или выручка за просрочку (relabel). */
  gain: number;
}

export const greyOf = (state: StoreState): GreyState => state.grey ?? {};

/** Бросок от зерна магазина, дня и соли — одинаковый при каждом перезапуске дня. */
const roll = (state: StoreState, salt: number): number => rng(((state.seed ?? 1) * 2654435761 + state.day * 69069 + salt * 7919 + 53) >>> 0)();
const between = (r: number, [a, b]: [number, number]): number => a + Math.floor(r * (b - a + 1));

/** Штука «под новую этикетку»: уценена или испортится этой ночью (брак, о котором ещё не решили, — нет). */
const stale = (state: StoreState, id: ProductId, u: Unit): boolean => !u.pending && (Boolean(u.markdown) || u.age + 1 >= unitLife(id, u, fridgeLife(state)));

/** Все запасы магазина: полки, склад и полка уценки. */
const stocks = (state: StoreState): Stock[] => [...state.shelves.map((s) => s.items), state.warehouse, state.bargain ?? {}];

function relabelUnits(state: StoreState): { qty: number; gain: number } {
  let qty = 0;
  let gain = 0;
  for (const stock of stocks(state))
    for (const id of PRODUCT_IDS)
      for (const u of stock[id] ?? [])
        if (stale(state, id, u)) {
          qty++;
          gain += state.prices[id];
        }
  return { qty, gain };
}

/** Что сегодня может предложить Жора каждого вида (null — этот вид сегодня не к месту). */
function build(state: StoreState, kind: GreyKind): GreyOffer | null {
  if (kind === 'bribe') {
    const price = GREY_BRIBE_BASE + GREY_BRIBE_LEVEL * state.level;
    return greyOf(state).cover || state.money < price ? null : { kind, qty: 0, price, gain: 0 };
  }
  if (kind === 'relabel') {
    const { qty, gain } = relabelUnits(state);
    return qty >= GREY_RELABEL_MIN ? { kind, qty, price: 0, gain } : null;
  }
  // Товар, который магазин и так продаёт: обычный, долгоиграющий, не для взрослых. Из трёх самых дорогих: партия
  // дешёвой воды на 180 💰 никого не соблазнит, а «выгода» должна быть заметной — иначе выбора нет.
  const ids = sellableProducts(state)
    .filter((id) => !restricted(id) && !homemade(id) && PRODUCTS[id].shelfLife >= GREY_GOODS_LIFE)
    .sort((a, b) => PRODUCTS[b].cost - PRODUCTS[a].cost)
    .slice(0, GREY_GOODS_TOP);
  if (!ids.length) return null;
  const product = ids[Math.floor(roll(state, 3) * ids.length)];
  const room = warehouseCapacity(state) - warehouseCount(state);
  const qty = Math.min(room, GREY_QTY_BASE + GREY_QTY_LEVEL * state.level);
  const unit = Math.max(1, Math.round(PRODUCTS[product].cost * GREY_GOODS_CUT));
  const price = qty * unit;
  if (qty < GREY_GOODS_MIN || price > state.money) return null;
  return { kind, product, qty, price, gain: qty * PRODUCTS[product].cost - price };
}

/**
 * Предложение этого утра: середина игры, Центр, прошла пауза после прошлого ответа и выпал бросок дня. Вид — по
 * кругу от броска; не подходящий сегодня (нет просрочки, не хватает денег) уступает следующему.
 */
export function greyOffer(state: StoreState): GreyOffer | null {
  const g = greyOf(state);
  if (inZar(state) || state.day < GREY_FROM_DAY || state.level < GREY_FROM_LEVEL || (g.next ?? 0) > state.day || g.last?.day === state.day) return null;
  if (roll(state, 1) >= GREY_CHANCE) return null;
  const start = Math.floor(roll(state, 2) * GREY_KINDS.length);
  for (let i = 0; i < GREY_KINDS.length; i++) {
    const offer = build(state, GREY_KINDS[(start + i) % GREY_KINDS.length]);
    if (offer) return offer;
  }
  return null;
}

/** Шанс попасться на очередной сделке: копится с каждой. */
export const greyRisk = (deals: number): number => Math.min(GREY_RISK_MAX, GREY_RISK_BASE + GREY_RISK_STEP * Math.max(0, deals));

export const greyFine = (state: StoreState, gain: number): number => Math.max(GREY_FINE_BASE + GREY_FINE_LEVEL * state.level, Math.round(gain * GREY_FINE_X));

/** Убрать из запасов всё «под новую этикетку». */
function stripStale(state: StoreState): StoreState {
  const strip = (stock: Stock): Stock => {
    const out: Stock = { ...stock };
    for (const id of PRODUCT_IDS) if (stock[id]) out[id] = stock[id]!.filter((u) => !stale(state, id, u));
    return out;
  };
  return {
    ...state,
    shelves: state.shelves.map((s) => ({ ...s, items: strip(s.items) })),
    warehouse: strip(state.warehouse),
    ...(state.bargain ? { bargain: strip(state.bargain) } : {}),
  };
}

/**
 * Ответ Жоре. Согласился — выгода сразу, сделка в счёт риска; попадёшься ли и когда — решено здесь же, но
 * скрыто. Продал просрочку и не попался — она всё равно аукнется отравлением через неделю–две. Отказал — партия
 * иногда оказывается краденой (участковый благодарит), иначе Жора, бывает, мстит. null — предложения нет.
 */
export function answerGrey(state: StoreState, yes: boolean): StoreState | null {
  const offer = greyOffer(state);
  if (!offer) return null;
  const g = greyOf(state);
  const done = { last: { day: state.day, kind: offer.kind, yes }, next: state.day + GREY_GAP };
  if (!yes) {
    let s: StoreState = { ...state, grey: { ...g, ...done, refused: (g.refused ?? 0) + 1 } };
    if (offer.kind === 'goods' && roll(state, 6) < GREY_STOLEN) return plantEcho(s, 'greyStolen', state.day + between(roll(state, 7), GREY_ECHO_DELAY));
    if (roll(state, 8) < GREY_REVENGE) s = plantEcho(s, 'greyRevenge', state.day + between(roll(state, 9), GREY_REVENGE_DELAY));
    return s;
  }
  let s: StoreState = state;
  if (offer.kind === 'goods' && offer.product) {
    const units: Unit[] = Array.from({ length: offer.qty }, () => ({ age: 0 }));
    s = { ...s, money: s.money - offer.price, warehouse: { ...s.warehouse, [offer.product]: [...(s.warehouse[offer.product] ?? []), ...units] } };
  } else if (offer.kind === 'bribe') s = { ...s, money: s.money - offer.price };
  else s = { ...stripStale(s), money: s.money + offer.gain };
  const deals = g.deals ?? 0;
  const caught = roll(state, 4) < greyRisk(deals);
  const busts = caught ? [...(g.busts ?? []), { kind: offer.kind, due: state.day + between(roll(state, 5), GREY_BUST_DELAY), fine: greyFine(state, greyGain(offer)) }] : g.busts;
  s = { ...s, grey: { ...g, ...done, deals: deals + 1, ...(busts ? { busts } : {}), ...(offer.kind === 'bribe' ? { cover: true } : {}) } };
  if (offer.kind === 'relabel' && !caught) s = plantEcho(s, 'greyPoison', state.day + between(roll(state, 7), GREY_ECHO_DELAY));
  return s;
}

/** Выгода для строки карточки: сколько сэкономил (товар) или получил (просрочка); взятка — сколько отдал. */
export const greyGain = (offer: GreyOffer): number => (offer.kind === 'bribe' ? offer.price : offer.gain);

/**
 * Ночь (day.ts nightCycle, до счетов): пришёл день одной из сделок — штраф (не хватит в кассе — в долг, как
 * штраф лицензии), рейтинг и доброе имя вниз, наутро магазин опечатан до обеда. За ночь — не больше одной:
 * две беды разом читались бы как одна.
 */
export function greyNight(state: StoreState): StoreState {
  const g = greyOf(state);
  const at = (g.busts ?? []).findIndex((b) => b.due <= state.day);
  if (at < 0) return state;
  const bust = g.busts![at];
  const busts = g.busts!.filter((_, i) => i !== at);
  const { busts: _old, ...rest } = g;
  const grey: GreyState = {
    ...rest,
    ...(busts.length ? { busts } : {}),
    sealed: state.day + 1,
    caught: { day: state.day, kind: bust.kind, fine: bust.fine },
  };
  // Проверяющего взяли — «договорённость» сгорела вместе с ним.
  if (bust.kind === 'bribe') delete grey.cover;
  const s: StoreState = {
    ...state,
    money: Math.max(0, state.money - bust.fine),
    debt: state.debt + Math.max(0, bust.fine - Math.max(0, state.money)),
    rating: Math.max(0, Math.round((state.rating - GREY_RATING) * 100) / 100),
    grey,
  };
  return addGoodwill(s, GREY_GOODWILL);
}

/** Карточка утра «Попался» (ещё не закрытая). */
export const greyCaught = (state: StoreState): GreyState['caught'] | null => {
  const c = greyOf(state).caught;
  return c && !c.seen ? c : null;
};

export const seeGreyCaught = (state: StoreState): StoreState => {
  const c = greyOf(state).caught;
  return c ? { ...state, grey: { ...greyOf(state), caught: { ...c, seen: true } } } : state;
};

/** Магазин сегодня опечатан до обеда. */
export const greySealed = (state: StoreState): boolean => greyOf(state).sealed === state.day && !inZar(state);

/** Гости сегодня (day.ts guestFactor): опечатан до обеда — вдвое меньше. */
export const greyGuests = (state: StoreState): number => (greySealed(state) ? GREY_SEALED_GUESTS : 1);

/**
 * В зале (StoreScene): до обеда дверь опечатана — гостей нет (0), после — поток как в обычный день (guestFactor
 * уже уменьшил его вдвое, здесь возвращаем). share — доля прошедшего дня.
 */
export const greyRate = (state: StoreState, share: number): number => (!greySealed(state) ? 1 : share < GREY_OPEN_AT ? 0 : 1 / GREY_SEALED_GUESTS);

/** Есть ли «договорённость» с проверяющим. */
export const greyCovered = (state: StoreState): boolean => Boolean(greyOf(state).cover);

/** «Договорённость» сработала: штраф не выписали, второй раз она не действует. */
export const useGreyCover = (state: StoreState): StoreState => {
  const { cover: _used, ...rest } = greyOf(state);
  return { ...state, grey: rest };
};

/**
 * Санинспекция нашла нарушения, а проверяющий «прикормлен» — он ничего не замечает: проверка как пройденная,
 * «договорённость» израсходована (scenes/shoppers.ts и симулятор — до inspectionDone).
 */
export function greyCover<R extends { passed: boolean; problems: unknown[]; fine: number }>(state: StoreState, result: R): { state: StoreState; result: R; covered: boolean } {
  if (result.passed || !greyCovered(state)) return { state, result, covered: false };
  return { state: useGreyCover(state), result: { ...result, passed: true, problems: [], fine: 0 }, covered: true };
}
