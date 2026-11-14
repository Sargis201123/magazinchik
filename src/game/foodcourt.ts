// Третий этаж — фудкорт (13.11, задача автора #65): светлый зал над магазином с точками еды и общими столиками.
// Этаж открывается по общей основе (floors.ts: 'third', с «Универмага», над вторым этажом). Что тут живёт:
//  · точки еды — пицца, шаурма с грилем, суши, кофе с десертами. Мест три, после ремонта (отделка этажа) — четыре,
//    так что кого пустить — выбор. Точку обустраивает хозяин (один раз), дальше её либо СДАЮТ (аренда каждый
//    вечер, как у арендаторов флигеля, tenants.ts), либо ВЕДУТ САМИ — выручка больше, но её основа — своя кухня
//    (kitchen.ts): без кухни вести точку нечем, а без повара на смене заготовки докупаются и прибыль тоньше;
//  · общие столики — по выходным больше семей. Часть едоков спускается в магазин за продуктами: гостей зала
//    чуть больше (foodcourtGuests), вечером к лифту на фасаде идёт наплыв (scenes/foodcourtFx.ts);
//  · иногда утром — день рождения на фудкорте: семья заказывает у магазина торт и напитки (дороже розницы);
//  · иногда — жалоба в санинспекцию на одну из точек: навести порядок (сдаёшь — делите пополам) или закрыть
//    точку на день.
//
// Сколько едоков, будет ли праздник и жалоба — только от зерна магазина и номера дня (как в подвале, basement.ts):
// перезапуск дня ничего не перекатывает, симулятор считает то же. Нет поля foodcourt — на этаже пусто (или этажа
// нет): всё как раньше. В Заречье этаж Центра стоит закрытым.

import { PRODUCTS, onShelves, sellableProducts, warehouseOf, type ProductId, type StoreState } from './economy';
import { floorOf } from './floors';
import { addGoodwill } from './goodwill';
import { kitchenOpen, kitchenWorking } from './kitchen';
import { take } from './tales';
import { homeLevel, inZar } from './zarshop';

export type StallId = 'pizza' | 'grill' | 'sushi' | 'coffee';
export const STALL_IDS: StallId[] = ['pizza', 'grill', 'sushi', 'coffee'];
/** Как работает точка: сдана арендатору или своя. */
export type StallMode = 'rent' | 'own';

export interface Stall {
  icon: string;
  /** Обустройство точки (стойка, вытяжка, вывеска) — хозяин платит один раз. */
  setup: number;
  /** Аренда за вечер, если точку сдали. */
  rent: number;
  /** Сколько едоков у точки за обычный будний день в «Универмаге». */
  eaters: number;
  /** Средний чек едока, если точку ведём сами. */
  check: number;
  /** Сколько гостей зала приводит точка (0.015 — +1,5%): часть едоков спускается за продуктами. */
  guests: number;
}

/**
 * Цифры (13.11): аренда четырёх точек — ≈ 1150 💰 в вечер, обустройство всех — 23 тыс.; с этажом и ремонтом всё
 * окупается месяца за полтора-два — для конца игры, где денег много, а вложить их почти некуда. Своя точка с
 * поваром даёт в полтора раза больше аренды, без повара — примерно столько же, но с риском жалобы целиком на себя.
 */
export const STALLS: Record<StallId, Stall> = {
  pizza: { icon: '🍕', setup: 6000, rent: 300, eaters: 22, check: 40, guests: 0.015 },
  grill: { icon: '🌯', setup: 5000, rent: 260, eaters: 20, check: 38, guests: 0.015 },
  sushi: { icon: '🍣', setup: 8000, rent: 380, eaters: 14, check: 75, guests: 0.01 },
  coffee: { icon: '☕', setup: 4000, rent: 200, eaters: 30, check: 22, guests: 0.02 },
};

/** Мест под точки: голый этаж — три, после ремонта — четыре. Ремонт ещё и поднимает поток и аренду. */
export const STALL_PLACES = [3, 4];
export const FINISH_BOOST = 0.15;
/** Своя точка: какая доля выручки остаётся после продуктов — с поваром на смене (своя кухня готовит) и без. */
export const OWN_MARGIN_COOK = 0.5;
export const OWN_MARGIN = 0.35;
/** Выходные: семьи — едоков больше. Гипермаркет — на столько больше за ступень помещения выше «Универмага». */
export const WEEKEND_EATERS = 1.3;
export const LEVEL_EATERS = 0.2;

/** День рождения: шанс утром (при двух точках и больше), во сколько дороже розницы платят за заказ. */
export const PARTY_CHANCE = 0.12;
export const PARTY_PAY = 1.3;
export const PARTY_GOODWILL = 1;
/** Жалоба санинспекции: шанс утром, первая неделя после открытия — без жалоб; цена «навести порядок». */
export const INSPECT_CHANCE = 0.05;
export const INSPECT_GRACE = 7;
export const INSPECT_FIX = 900;
/** Сданную точку арендатор чинит сам, хозяин помогает половиной. */
export const INSPECT_TENANT_SHARE = 0.5;

export interface FoodPartyAnswer {
  day: number;
  ok: boolean;
}

/** Вечер на фудкорте: едоки, деньги (аренда + своё), закрытая по жалобе точка, был ли праздник. */
export interface FoodDay {
  eaters: number;
  income: number;
  closed?: StallId;
  party?: boolean;
}

export interface FoodcourtState {
  /** Обустроенные точки и как работают. Порядок не важен: места занимаются по STALL_IDS. */
  stalls?: Partial<Record<StallId, StallMode>>;
  /** Ответ на праздник сегодня (взяли заказ или нет). */
  party?: FoodPartyAnswer;
  /** Ответ на жалобу сегодня: навели порядок (fix) или закрыли точку. */
  inspect?: { day: number; fix: boolean };
  /** Прошлый вечер — для плитки «Фудкорт». */
  last?: FoodDay & { day: number };
  /** Сколько фудкорт принёс за всё время. */
  earned?: number;
}

/** Случайность фудкорта: зерно магазина, день и «соль» (как в подвале). */
function roll(state: StoreState, salt: number): number {
  let h = ((state.seed ?? 1) * 2654435761 + state.day * 2246822519 + salt * 3266489917 + 0x51ed27) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Фудкорт в сохранении; этажа нет или мы в Заречье — null. Кривые поля старого сохранения — как будто их нет. */
export function foodcourtOf(state: StoreState): FoodcourtState | null {
  if (!floorOf(state, 'third')) return null;
  return state.foodcourt && typeof state.foodcourt === 'object' ? state.foodcourt : {};
}

const set = (state: StoreState, fc: FoodcourtState): StoreState => ({ ...state, foodcourt: fc });

export const stallPlaces = (state: StoreState): number => STALL_PLACES[Math.min(STALL_PLACES.length - 1, floorOf(state, 'third')?.finish ?? 0)];

/** Какие точки стоят (по порядку мест); лишние (кривое сохранение) не считаем. */
export function stallsOf(state: StoreState): StallId[] {
  const stalls = foodcourtOf(state)?.stalls ?? {};
  return STALL_IDS.filter((id) => stalls[id] === 'rent' || stalls[id] === 'own').slice(0, stallPlaces(state));
}

/** Вести точку самим можно только со своей кухней (kitchen.ts); без неё «своя» работает как сданная. */
export const ownAllowed = (state: StoreState): boolean => kitchenOpen(state);
export function stallMode(state: StoreState, id: StallId): StallMode | null {
  if (!stallsOf(state).includes(id)) return null;
  return foodcourtOf(state)?.stalls?.[id] === 'own' && ownAllowed(state) ? 'own' : 'rent';
}

/** Почему точку нельзя обустроить: этажа нет, уже стоит, мест нет, не хватает денег. null — можно. */
export function stallLock(state: StoreState, id: StallId): 'floor' | 'here' | 'full' | 'money' | null {
  if (!foodcourtOf(state)) return 'floor';
  const here = stallsOf(state);
  if (here.includes(id)) return 'here';
  if (here.length >= stallPlaces(state)) return 'full';
  return state.money < STALLS[id].setup ? 'money' : null;
}

/** Обустроить точку и сразу решить, сдать её или вести самим (своя — только с кухней). */
export function openStall(state: StoreState, id: StallId, mode: StallMode): StoreState | null {
  if (!(id in STALLS) || stallLock(state, id) || (mode === 'own' && !ownAllowed(state))) return null;
  const fc = foodcourtOf(state)!;
  return set({ ...state, money: state.money - STALLS[id].setup }, { ...fc, stalls: { ...fc.stalls, [id]: mode } });
}

/** Сдать свою точку или забрать сданную себе — бесплатно: стойка та же, меняется только, кто за ней. */
export function setStallMode(state: StoreState, id: StallId, mode: StallMode): StoreState | null {
  const now = stallMode(state, id);
  if (!now || now === mode || (mode === 'own' && !ownAllowed(state))) return null;
  const fc = foodcourtOf(state)!;
  return set(state, { ...fc, stalls: { ...fc.stalls, [id]: mode } });
}

/** Убрать точку (место свободно, обустройство не возвращают) — чтобы пустить другую. */
export function closeStall(state: StoreState, id: StallId): StoreState | null {
  const fc = foodcourtOf(state);
  if (!fc || !stallsOf(state).includes(id)) return null;
  const stalls = { ...fc.stalls };
  delete stalls[id];
  return set(state, { ...fc, stalls });
}

/** Выходные по игровому календарю (cases.ts weekDay: 6 — суббота, 7 — воскресенье): за столиками семьи. */
export const isFoodWeekend = (state: StoreState): boolean => ((state.day - 1) % 7) + 1 >= 6;

/** Поток едоков: ремонт, выходные (семьи), помещение выше «Универмага». */
function eatersFactor(state: StoreState): number {
  const finish = (floorOf(state, 'third')?.finish ?? 0) > 0 ? 1 + FINISH_BOOST : 1;
  return finish * (isFoodWeekend(state) ? WEEKEND_EATERS : 1) * (1 + LEVEL_EATERS * Math.max(0, homeLevel(state) - 4));
}

/** Аренда точки за вечер: после ремонта зал наряднее — платят больше. */
export const stallRent = (state: StoreState, id: StallId): number =>
  Math.round(STALLS[id].rent * ((floorOf(state, 'third')?.finish ?? 0) > 0 ? 1 + FINISH_BOOST : 1));

// ---------- Жалоба и праздник ----------

export interface Inspection {
  stall: StallId;
  /** Сколько стоит навести порядок (сданную — пополам с арендатором). */
  fix: number;
}

/** Жалоба санинспекции сегодня утром (null — нет): первая неделя после открытия этажа — тихо. */
export function inspectionToday(state: StoreState): Inspection | null {
  const floor = floorOf(state, 'third');
  const stalls = stallsOf(state);
  if (!floor || !stalls.length || state.day - floor.since < INSPECT_GRACE || roll(state, 9) >= INSPECT_CHANCE) return null;
  const stall = stalls[Math.floor(roll(state, 10) * stalls.length)];
  const own = stallMode(state, stall) === 'own';
  return { stall, fix: Math.round(INSPECT_FIX * (own ? 1 : INSPECT_TENANT_SHARE)) };
}

/** Что решили с сегодняшней жалобой: null — ещё не решили (вечером точку закроют сами). */
export function inspectAnswer(state: StoreState): boolean | null {
  const a = foodcourtOf(state)?.inspect;
  return a && a.day === state.day ? a.fix : null;
}

/** Навести порядок (fix) или закрыть точку на день. */
export function answerInspection(state: StoreState, fix: boolean): StoreState | null {
  const ins = inspectionToday(state);
  if (!ins || inspectAnswer(state) !== null || (fix && state.money < ins.fix)) return null;
  const fc = foodcourtOf(state)!;
  return set({ ...state, money: state.money - (fix ? ins.fix : 0) }, { ...fc, inspect: { day: state.day, fix } });
}

/** Какая точка сегодня закрыта по жалобе: жалоба есть и порядок не навели (не ответили — тоже закрыта). */
export function closedToday(state: StoreState): StallId | null {
  const ins = inspectionToday(state);
  return ins && inspectAnswer(state) !== true ? ins.stall : null;
}

export interface FoodParty {
  /** Торт (медовик, пироги, булочки или мороженое — что продаём) и напитки (сок или вода). */
  items: Partial<Record<ProductId, number>>;
  pay: number;
  /** Всего хватает (склад и полки). */
  ready: boolean;
}

// Торт: медовик своей пекарни, иначе пироги или булочки; без пекарни — торт-мороженое.
const CAKES: ProductId[] = ['honeycake', 'pies', 'buns', 'icecream'];
const DRINKS: ProductId[] = ['juice', 'water'];

/** День рождения на фудкорте сегодня (null — нет): от двух точек, торт и напитки — из того, что магазин продаёт. */
export function partyToday(state: StoreState): FoodParty | null {
  if (stallsOf(state).length < 2 || roll(state, 7) >= PARTY_CHANCE) return null;
  const sell = sellableProducts(state);
  const cake = CAKES.find((id) => sell.includes(id));
  const drink = DRINKS.find((id) => sell.includes(id));
  if (!cake || !drink) return null;
  const level = homeLevel(state);
  const items: Partial<Record<ProductId, number>> = { [cake]: Math.max(2, level - 1), [drink]: 2 * level };
  const pay = Math.round(Object.entries(items).reduce((sum, [id, n]) => sum + PRODUCTS[id as ProductId].basePrice * (n ?? 0), 0) * PARTY_PAY);
  const ready = Object.entries(items).every(([id, n]) => warehouseOf(state, id as ProductId) + onShelves(state, id as ProductId) >= (n ?? 0));
  return { items, pay, ready };
}

export function partyAnswer(state: StoreState): boolean | null {
  const a = foodcourtOf(state)?.party;
  return a && a.day === state.day ? a.ok : null;
}

/** Собрать заказ на праздник (товар уходит, деньги приходят, район доволен) или отказать. null — нечего решать. */
export function answerParty(state: StoreState, ok: boolean): StoreState | null {
  const party = partyToday(state);
  if (!party || partyAnswer(state) !== null || (ok && !party.ready)) return null;
  let s = state;
  if (ok) {
    for (const [id, n] of Object.entries(party.items)) s = take(s, id as ProductId, n ?? 0);
    s = addGoodwill({ ...s, money: s.money + party.pay }, PARTY_GOODWILL);
  }
  return set(s, { ...foodcourtOf(state)!, party: { day: state.day, ok } });
}

/** Праздник сегодня идёт (заказ взяли) — в зале шарики, за столиками больше детей. */
export const partyOn = (state: StoreState): boolean => partyAnswer(state) === true;

// ---------- Вечер ----------

export interface StallPlan {
  id: StallId;
  mode: StallMode;
  eaters: number;
  /** Сколько точка даст магазину вечером (аренда или прибыль своей). 0 — закрыта по жалобе. */
  income: number;
  closed: boolean;
}

/**
 * Как пройдёт вечер на фудкорте: едоки и деньги каждой точки. Утром — тот же расчёт: прогноз в плитке честный, сцена
 * сажает за столики столько же людей.
 */
export function foodPlan(state: StoreState): { stalls: StallPlan[]; eaters: number; income: number } | null {
  const stalls = stallsOf(state);
  if (!stalls.length || inZar(state)) return null;
  const factor = eatersFactor(state);
  const closed = closedToday(state);
  const cook = kitchenWorking(state);
  const plans = stalls.map((id, i): StallPlan => {
    const mode = stallMode(state, id)!;
    const shut = id === closed;
    const eaters = shut ? 0 : Math.round(STALLS[id].eaters * factor * (0.8 + 0.4 * roll(state, 20 + i)));
    const own = Math.round((eaters * STALLS[id].check * (cook ? OWN_MARGIN_COOK : OWN_MARGIN)) / 10) * 10;
    return { id, mode, eaters, income: shut ? 0 : mode === 'own' ? own : stallRent(state, id), closed: shut };
  });
  return { stalls: plans, eaters: plans.reduce((n, p) => n + p.eaters, 0), income: plans.reduce((n, p) => n + p.income, 0) };
}

/** Едоки спускаются в магазин за продуктами: гостей зала больше (только в Центре — day.ts, homeOnly). */
export const foodcourtGuests = (state: StoreState): number => 1 + stallsOf(state).reduce((sum, id) => sum + STALLS[id].guests, 0);

/** Вечер (day.ts nightCycle, до счетов): аренда и выручка своих точек — в кассу. */
export function foodcourtNight(state: StoreState): { state: StoreState; day: FoodDay | null } {
  const plan = foodPlan(state);
  const fc = foodcourtOf(state);
  if (!plan || !fc) return { state, day: null };
  const closed = plan.stalls.find((p) => p.closed)?.id;
  const day: FoodDay = { eaters: plan.eaters, income: plan.income, ...(closed ? { closed } : {}), ...(partyOn(state) ? { party: true } : {}) };
  return { state: set({ ...state, money: state.money + plan.income }, { ...fc, last: { ...day, day: state.day }, earned: (fc.earned ?? 0) + plan.income }), day };
}

/** Что видно в мире: открыт ли этаж и сколько точек. Изменилось — сцена перестраивает вход на фасаде. */
export const foodcourtLook = (state: StoreState): string => (foodcourtOf(state) ? `${stallsOf(state).join(',')}` : '');
