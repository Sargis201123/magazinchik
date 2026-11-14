// Район дорожает (13.11, автор: задача #57). Когда район у магазина цветёт — семей много (residents.ts), доброе имя
// высокое (goodwill.ts), рейтинг хороший, мечты соседей сбылись (dreams.ts), улица благоустроена (hood.ts), — сюда
// тянутся обеспеченные. Это одно число — престиж района 0…100: каждое утро на шаг ближе к тому, что сейчас
// заслужил район (медленно и без случая — перезапуск утра его не меняет).
//
// С престижем всё дорожает: аренда и коммуналка, прайс поставщиков (на несколько процентов), а новые жители берут
// дорогое — мясо, рыбу, медовик, своё варенье и пельмени (сыра и вина в магазине нет — спрос идёт на самое дорогое,
// что есть). Старым постоянным становится не по карману: при высоком престиже кто-то из них иногда уезжает — через
// residents.ts, с прощальной историей утром.
//
// Когда престиж переходит GENT_ASK, утром приходит выбор (очередь headlines.ts): «перестроиться под новых» —
// больше гостей, к ценам терпимее, дорогое берут охотнее, но свои обижаются и уезжают чаще; или «остаться для своих» —
// постоянные верны и не уезжают из-за цен, доброе имя растёт, но богатые обходят магазин. Удержать всех нельзя.
// Только Центр (Заречье — свой район). Старое сохранение (поля нет) — престиж 0, всё как раньше.

import type { StoreState, ProductId } from './economy';
import { PRODUCTS, homemade, restricted } from './economy';
import { goodwillOf, addGoodwill } from './goodwill';
import { investsOf, DREAMS } from './dreams';
import { hoodOwned } from './hood';
import { inZar } from './zarshop';
import { RES_START, residents, regularLeaves } from './residents';
import { MAX_LOYALTY, met, regularById, regularState, type RegularId } from './regulars';

export type GentChoice = 'rich' | 'own';

export interface GentState {
  /** Престиж района 0…100. */
  p: number;
  /** Ответ на утреннюю карточку. Нет — ещё не спрашивали или не ответили. */
  choice?: GentChoice;
  /** День ответа. */
  day?: number;
  /** Кто из постоянных уехал из-за дороговизны (не больше GENT_MAX_LEFT за игру). */
  left?: RegularId[];
}

export const GENT_MAX = 100;
/** С какого дня район начинает дорожать: первые недели магазину не до того. */
export const GENT_FROM = 20;
/** Шаг за утро: вверх на 1; вниз — тоже на 1, но только если район заметно отстал (GENT_SLACK) — престиж держится. */
export const GENT_STEP = 1;
export const GENT_SLACK = 5;
/** С какого престижа его видно: строка в «Сегодня» и первая подсказка. */
export const GENT_SEEN = 15;
/** Престиж, на котором утром приходит выбор «для кого магазин». */
export const GENT_ASK = 40;
/** На улице: с этого престижа вместо цветочного — кофейня третьей волны, с GENT_LOOK2 вместо аптеки — барбершоп. */
export const GENT_LOOK1 = 40;
export const GENT_LOOK2 = 70;
/**
 * Что весит в престиже (сумма обрезается до 100). Новый магазин (12 семей, имя 0, 3★, ничего не куплено) — 0–4;
 * хороший магазин середины игры (14 семей, имя 20, 4,5★, мечта, три улучшения района, «Супермаркет») — около 40:
 * выбор приходит к середине игры, а не в первый месяц.
 */
export const W_FAMILY = 3;
export const W_GOODWILL = 0.2;
export const W_RATING = 12;
export const RATING_FROM = 3.5;
export const W_DREAM = 6;
export const W_HOOD = 2.5;
export const W_LEVEL = 2;
/** Аренда и коммуналка магазина на 100 престижа — дороже на 8%, прайс поставщиков — на 4%. */
export const GENT_RENT = 0.08;
export const GENT_SUPPLY = 0.04;
/** Дорогой товар: розница от стольких монет или своё (выпечка, своя марка). Пиво и сигареты — нет. */
export const POSH_PRICE = 99;
/** Дешёвый товар: розница до стольких монет — его берут старые жители, которые уезжают. */
export const CHEAP_PRICE = 30;
/** Спрос на дорогое на 100 престижа: +40% (×1,5 «для новых», ×0,5 «для своих»). */
export const GENT_POSH = 0.2;
/** «Для новых»: дешёвое на 100 престижа берут на 15% реже — его покупатели уезжают. */
export const GENT_CHEAP = 0.15;
/** Гости на 100 престижа: «для новых» +8%, «для своих» −6% (богатые обходят). */
export const GENT_RICH_GUESTS = 0.05;
export const GENT_OWN_GUESTS = 0.05;
/** «Для новых» к ценам терпимее: на 100 престижа «справедливая» цена выше на 12%. */
export const GENT_TOLERANCE = 0.06;
/** Разовое: «для новых» доброе имя −10 и доверие своих −2; «для своих» — +10 и +1. */
export const GENT_GOODWILL = 10;
export const GENT_RICH_LOYALTY = -2;
export const GENT_OWN_LOYALTY = 1;
/** Аренда флигеля (tenants.ts) тоже растёт: на 100 престижа арендаторы платят на 10% больше. */
export const GENT_TENANT_RENT = 0.1;
/** Уезжают от цен с этого престижа, раз в GENT_EVERY дней (день — свой у магазина), с таким шансом. */
export const GENT_LEAVE_FROM = 50;
export const GENT_EVERY = 6;
export const LEAVE_RICH = 0.5;
export const LEAVE_NONE = 0.2;
/** Больше двух постоянных цены из района не выгоняют: район меняется, но не пустеет. */
export const GENT_MAX_LEFT = 2;
/** Кто из старых может уехать от цен, по порядку: пенсионер Пётр Ильич первым. Надя въехала сама — её нет. */
export const OLD_FOLKS: RegularId[] = ['petr', 'olga', 'kostya', 'akhmed'];

/** Престиж района 0…100 (нет поля — 0). */
export const prestigeOf = (state: Pick<StoreState, 'gentrify'>): number => state.gentrify?.p ?? 0;

/** Доля престижа 0…1: от неё все прибавки. В Заречье — 0 (там свой район). */
const heat = (state: StoreState): number => (inZar(state) ? 0 : Math.max(0, Math.min(GENT_MAX, prestigeOf(state))) / GENT_MAX);

export const gentChoice = (state: Pick<StoreState, 'gentrify'>): GentChoice | null => state.gentrify?.choice ?? null;

/** Сколько престижа сейчас заслужил район (к этому числу престиж идёт по шагу в утро). */
export function prestigeTarget(state: StoreState): number {
  const dreams = investsOf(state).filter((v) => v.end === 'ok' && DREAMS[v.id]).length;
  const sum =
    Math.max(0, residents(state) - RES_START) * W_FAMILY +
    Math.max(0, goodwillOf(state)) * W_GOODWILL +
    Math.max(0, state.rating - RATING_FROM) * W_RATING +
    dreams * W_DREAM +
    hoodOwned(state).length * W_HOOD +
    state.level * W_LEVEL;
  return Math.round(Math.max(0, Math.min(GENT_MAX, sum)));
}

/** Бросок 0…1 от зерна магазина и дня (salt — какой вопрос), как catFind в cat.ts. */
function roll(state: StoreState, salt: number): number {
  let h = ((state.seed ?? 1) * 374761393 + state.day * 668265263 + salt * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return (h % 10000) / 10000;
}

/** Сегодня цены могут выжить кого-то из старых (раз в GENT_EVERY дней; день — от зерна, не совпадает у всех магазинов). */
export const gentLeaveDay = (state: StoreState): boolean => ((state.day + (state.seed ?? 1) * 3) % GENT_EVERY + GENT_EVERY) % GENT_EVERY === 0;

/** Кто из старых съедет следующим: знаком, ещё здесь, не ждёт новостей о своей мечте. */
function nextLeaver(state: StoreState): RegularId | null {
  const dreaming = new Set(investsOf(state).filter((v) => !v.end).map((v) => DREAMS[v.id]?.regular));
  return OLD_FOLKS.find((id) => met(state, regularById(id)) && !dreaming.has(id)) ?? null;
}

/** Шанс, что сегодня кто-то съедет от цен (0 — никто). */
export function leaveChance(state: StoreState): number {
  if (inZar(state) || prestigeOf(state) < GENT_LEAVE_FROM || (state.gentrify?.left?.length ?? 0) >= GENT_MAX_LEFT) return 0;
  const c = gentChoice(state);
  return c === 'own' ? 0 : c === 'rich' ? LEAVE_RICH : LEAVE_NONE;
}

/**
 * Утро (day.ts, после жителей): престиж на шаг ближе к заслуженному; в свой день при высоком престиже кто-то из
 * старых постоянных может уехать (если сегодня в районе уже не было переезда). Тот же объект, если ничего не поменялось.
 */
export function gentMorning(state: StoreState): StoreState {
  if (inZar(state) || state.day < GENT_FROM) return state;
  const p = prestigeOf(state);
  const target = prestigeTarget(state);
  const next = target > p ? p + GENT_STEP : target < p - GENT_SLACK ? p - GENT_STEP : p;
  let s: StoreState = next === p ? state : { ...state, gentrify: { ...state.gentrify, p: next } };
  if (!s.gentrify) return s;
  // Переезд в районе сегодня уже был (residents.ts) — второго грузовика у подъезда в тот же день не будет.
  if (s.residents?.move?.day === s.day || !gentLeaveDay(s) || roll(s, 1) >= leaveChance(s)) return s;
  const who = nextLeaver(s);
  if (!who) return s;
  s = regularLeaves(s, who, 'rent');
  return { ...s, gentrify: { ...s.gentrify!, left: [...(s.gentrify!.left ?? []), who] } };
}

/** Утром спросить, для кого магазин: престиж дорос, ответа ещё нет. */
export const gentAsk = (state: StoreState): boolean => !inZar(state) && prestigeOf(state) >= GENT_ASK && !gentChoice(state);

/**
 * Ответ. «Для новых» — свои обижаются (доверие знакомых −2, доброе имя −10); «для своих» — наоборот (+1, +10).
 * Дальше всё — от престижа и ответа (гости, спрос, цены). Ответить можно один раз.
 */
export function chooseGent(state: StoreState, choice: GentChoice): StoreState | null {
  if (!gentAsk(state)) return null;
  const rich = choice === 'rich';
  const delta = rich ? GENT_RICH_LOYALTY : GENT_OWN_LOYALTY;
  const regulars = { ...state.regulars };
  for (const id of [...OLD_FOLKS, 'sveta', 'misha', 'nadya'] as RegularId[]) {
    if (!met(state, regularById(id))) continue;
    const r = regularState(state, id);
    regulars[id] = { ...r, loyalty: Math.max(0, Math.min(MAX_LOYALTY, r.loyalty + delta)) };
  }
  const s = addGoodwill({ ...state, regulars }, rich ? -GENT_GOODWILL : GENT_GOODWILL);
  return { ...s, gentrify: { ...s.gentrify!, choice, day: state.day } };
}

/** Множитель счетов за аренду и коммуналку (economy.ts monthlyBill). */
export const gentBill = (state: StoreState): number => 1 + heat(state) * GENT_RENT;

/** Множитель прайса поставщиков (suppliers.ts priceFor). */
export const gentSupply = (state: StoreState): number => 1 + heat(state) * GENT_SUPPLY;

/** Множитель аренды, которую платят арендаторы флигеля (tenants.ts). */
// Платят и когда хозяин в Заречье — флигель стоит в Центре, поэтому престиж берём как есть.
export const gentTenantRent = (state: StoreState): number => 1 + (Math.max(0, Math.min(GENT_MAX, prestigeOf(state))) / GENT_MAX) * GENT_TENANT_RENT;

export const isPosh = (id: ProductId): boolean => !restricted(id) && (PRODUCTS[id].basePrice >= POSH_PRICE || homemade(id));
const isCheap = (id: ProductId): boolean => PRODUCTS[id].basePrice <= CHEAP_PRICE;

/** Спрос дня на товар (demand.ts): новые жители берут дорогое, «для новых» дешёвое берут реже. */
export function gentDemand(state: StoreState, id: ProductId): number {
  const h = heat(state);
  if (!h) return 1;
  const c = gentChoice(state);
  if (isPosh(id)) return 1 + h * GENT_POSH * (c === 'rich' ? 1.5 : c === 'own' ? 0.5 : 1);
  return c === 'rich' && isCheap(id) ? 1 - h * GENT_CHEAP : 1;
}

/** Гости (day.ts guestFactor): «для новых» — богатые заходят, «для своих» — обходят. */
export function gentGuests(state: StoreState): number {
  const c = gentChoice(state);
  const h = heat(state);
  return c === 'rich' ? 1 + h * GENT_RICH_GUESTS : c === 'own' ? 1 - h * GENT_OWN_GUESTS : 1;
}

/** «Справедливая» цена в глазах покупателя (endless.ts perceivedBase): «для новых» на ценник смотрят меньше. */
export const gentTolerance = (state: StoreState): number => (gentChoice(state) === 'rich' ? 1 + heat(state) * GENT_TOLERANCE : 1);

/** Насколько подорожали счета и прайс — для строки утра (в процентах, целые). */
export const gentRises = (state: StoreState): { rent: number; supply: number } => ({
  rent: Math.round((gentBill(state) - 1) * 100),
  supply: Math.round((gentSupply(state) - 1) * 100),
});

/** Доля прохожих в пальто и дорогих машин на улице (сцена): до 45% при полном престиже. */
export const poshShare = (state: StoreState): number => heat(state) * 0.45;

/** Как район выглядит на улице: ступень витрин соседей и ответ. Сменилось — сцена перестраивает мир. */
export function gentLook(state: StoreState): string {
  if (inZar(state)) return '';
  const p = prestigeOf(state);
  return `${p >= GENT_LOOK2 ? 2 : p >= GENT_LOOK1 ? 1 : 0}${gentChoice(state) ?? ''}`;
}
