// Арендаторы во флигеле. С «Минимаркета» над кофейней и кухней есть свободные комнаты — их сдают.
// Арендатор сам отделывает комнату и работает без хозяина: игрок один раз выбирает, кого пустить, и платит
// за отделку, дальше каждый вечер приходит аренда, а посетители арендатора заодно заходят в зал.
// Пункт выдачи заказов — тоже арендатор: за посылками идёт больше всего людей.
// Комнаты в мире — scenes/tenantsFx.ts (места — scenes/layout.ts), раздел «Развития» — ui/tenants.ts.
//
// 10.11 (третий обход): у арендатора есть лицо и имя. Раз в несколько дней он просит что-нибудь со склада (доска
// «Заказы») — платит чуть выше розницы, а доверие растёт и вместе с ним аренда. Комнату можно отделать второй раз:
// аренда заметно выше, гостей чуть больше, в мире — гирлянда и вторая витрина. Видов стало семь — комнат по-прежнему
// не больше трёх, так что есть из кого выбирать.

import { PRODUCTS, sellableProducts, onShelves, warehouseOf, type ProductId, type StoreState } from './economy';
import type { TextKey } from '../i18n';
import { take } from './tales';
import { homeLevel, inZar } from './zarshop';

export type TenantId = 'pickup' | 'pharmacy' | 'repair' | 'toys' | 'barber' | 'photo' | 'atm';
export const TENANT_IDS: TenantId[] = ['pickup', 'pharmacy', 'repair', 'toys', 'barber', 'photo', 'atm'];

export interface Tenant {
  icon: string;
  /** Отделка комнаты — платит хозяин один раз. */
  setup: number;
  /** Аренда за день, приходит вечером до счетов. */
  rent: number;
  /** Прибавка к потоку гостей зала (0.04 = +4%). */
  guests: number;
  /** Лицо хозяина комнаты (номер лица персонала, ui/dom.ts staffFace); нет — работает сам (банкомат). */
  face?: number;
  /** Что он просит со склада — по очереди, из того, что магазин продаёт. */
  wants?: ProductId[];
}

/**
 * Цифры подобраны так, чтобы отделка окупалась за 10–15 дней в «Минимаркете» и быстрее в больших залах
 * (аренда не растёт, а гости — доля от потока). Пункт выдачи: аренда маленькая, зато людей больше всех.
 * Новые (10.11): парикмахерская — вторая по аренде после аптеки; фото на документы и банкомат — дешёвые в отделке,
 * платят мало, зато ведут людей в зал.
 */
export const TENANTS: Record<TenantId, Tenant> = {
  pickup: { icon: '📦', setup: 3000, rent: 150, guests: 0.04, face: 1, wants: ['water', 'juice', 'bread'] },
  pharmacy: { icon: '💊', setup: 6000, rent: 320, guests: 0.02, face: 3, wants: ['water', 'soap', 'apples'] },
  repair: { icon: '🔑', setup: 3500, rent: 220, guests: 0.01, face: 4, wants: ['bread', 'water', 'milk'] },
  toys: { icon: '🧸', setup: 2500, rent: 120, guests: 0.03, face: 2, wants: ['juice', 'apples'] },
  barber: { icon: '💈', setup: 4500, rent: 260, guests: 0.02, face: 5, wants: ['water', 'soap', 'juice'] },
  photo: { icon: '📸', setup: 2000, rent: 100, guests: 0.02, face: 6, wants: ['water', 'bread'] },
  atm: { icon: '🏧', setup: 1500, rent: 70, guests: 0.03 },
};

/** Вторая отделка: во сколько раз выше аренда и сколько ещё гостей; цена — доля первой отделки. */
export const TIER_RENT = 1.6;
export const TIER_GUESTS = 0.01;
export const TIER_COST = 1.2;
/** Доверие арендатора: до трёх ступеней, каждая — +5% к его аренде. */
export const PAL_MAX = 3;
export const PAL_RENT = 0.05;
/** Просьба — раз в столько дней (у каждой комнаты свой день); платит на столько выше розницы. */
export const ASK_EVERY = 3;
export const ASK_BONUS = 1.15;

/** Комнат под аренду по помещению: сколько помещается во флигеле над кофейней и кухней (layout.ts, tenantRoomsFor). */
export const TENANT_ROOMS = [0, 0, 1, 1, 2, 3];

/** Комнаты считаем по магазину в Центре: в Заречье своего флигеля под аренду нет. */
export const tenantRooms = (state: StoreState): number => TENANT_ROOMS[Math.min(homeLevel(state), TENANT_ROOMS.length - 1)] ?? 0;

/** Кто снимает комнаты: по порядку комнат, снизу вверх. Лишних (старое сохранение, помещение меньше) не считаем. */
export const tenantsOf = (state: StoreState): TenantId[] => (state.tenants ?? []).filter((id) => id in TENANTS).slice(0, tenantRooms(state));

export const freeRooms = (state: StoreState): number => tenantRooms(state) - tenantsOf(state).length;

/** Почему нельзя пустить арендатора: уже снимает, нет комнаты, не хватает на отделку. null — можно. */
export function rentLock(state: StoreState, id: TenantId): 'here' | 'full' | 'money' | null {
  if (tenantsOf(state).includes(id)) return 'here';
  if (freeRooms(state) <= 0) return 'full';
  return state.money < TENANTS[id].setup ? 'money' : null;
}

/** Пустить арендатора в свободную комнату: отделку оплачивает хозяин. null — нельзя. */
export function rentRoom(state: StoreState, id: TenantId): StoreState | null {
  if (inZar(state) || rentLock(state, id)) return null;
  return { ...state, money: state.money - TENANTS[id].setup, tenants: [...tenantsOf(state), id] };
}

/** Расстаться с арендатором: комната свободна, отделку (и вторую) не возвращают, доверие не копится впрок. */
export function evict(state: StoreState, id: TenantId): StoreState {
  const up = { ...state.tenantUp };
  const pal = { ...state.tenantPal };
  delete up[id];
  delete pal[id];
  return { ...state, tenants: tenantsOf(state).filter((other) => other !== id), tenantUp: up, tenantPal: pal };
}

// ---------- Вторая отделка ----------

export const tenantTier = (state: StoreState, id: TenantId): 1 | 2 => (state.tenantUp?.[id] ? 2 : 1);
export const upgradeCost = (id: TenantId): number => Math.round((TENANTS[id].setup * TIER_COST) / 100) * 100;

/** Почему нельзя отделать второй раз: не снимает, уже отделано, не хватает денег. null — можно. */
export function upgradeLock(state: StoreState, id: TenantId): 'away' | 'done' | 'money' | null {
  if (!tenantsOf(state).includes(id)) return 'away';
  if (tenantTier(state, id) === 2) return 'done';
  return state.money < upgradeCost(id) ? 'money' : null;
}

export function upgradeTenant(state: StoreState, id: TenantId): StoreState | null {
  if (inZar(state) || upgradeLock(state, id)) return null;
  return { ...state, money: state.money - upgradeCost(id), tenantUp: { ...state.tenantUp, [id]: 1 } };
}

// ---------- Доверие и просьбы ----------

export const tenantPal = (state: StoreState, id: TenantId): number => Math.min(PAL_MAX, Math.max(0, Math.floor(state.tenantPal?.[id] ?? 0)));

/** Аренда комнаты за день: вторая отделка и доверие. */
export const rentOf = (state: StoreState, id: TenantId): number =>
  Math.round(TENANTS[id].rent * (tenantTier(state, id) === 2 ? TIER_RENT : 1) * (1 + PAL_RENT * tenantPal(state, id)));
export const guestsOf = (state: StoreState, id: TenantId): number => TENANTS[id].guests + (tenantTier(state, id) === 2 ? TIER_GUESTS : 0);

export interface TenantAsk {
  id: TenantId;
  product: ProductId;
  qty: number;
  pay: number;
  /** Товара хватает (склад и полки). */
  ready: boolean;
}

/**
 * Кто сегодня о чём-то просит. У каждой комнаты свой день из ASK_EVERY, товар — по очереди из его списка (только то,
 * что магазин продаёт); количество растёт с помещением. Уже отдали сегодня — не просит.
 */
export function tenantAsks(state: StoreState): TenantAsk[] {
  if (inZar(state)) return [];
  const done = state.tenantAsk?.day === state.day ? state.tenantAsk.done : [];
  const sell = sellableProducts(state);
  const asks: TenantAsk[] = [];
  tenantsOf(state).forEach((id, room) => {
    const wants = (TENANTS[id].wants ?? []).filter((pid) => sell.includes(pid));
    if (!wants.length || done.includes(id) || (state.day + room) % ASK_EVERY !== 0) return;
    const product = wants[Math.floor(state.day / ASK_EVERY) % wants.length];
    const qty = 2 + 2 * homeLevel(state);
    asks.push({ id, product, qty, pay: Math.round(PRODUCTS[product].basePrice * qty * ASK_BONUS), ready: warehouseOf(state, product) + onShelves(state, product) >= qty });
  });
  return asks;
}

/** Отнести арендатору, что просил: товар уходит, деньги приходят, доверие растёт. null — не просит или не хватает. */
export function giveTenant(state: StoreState, id: TenantId): { state: StoreState; ask: TenantAsk; pal: number } | null {
  const ask = tenantAsks(state).find((a) => a.id === id);
  if (!ask || !ask.ready) return null;
  const taken = take(state, ask.product, ask.qty);
  const pal = Math.min(PAL_MAX, tenantPal(state, id) + 1);
  const done = state.tenantAsk?.day === state.day ? state.tenantAsk.done : [];
  return { state: { ...taken, money: taken.money + ask.pay, tenantPal: { ...state.tenantPal, [id]: pal }, tenantAsk: { day: state.day, done: [...done, id] } }, ask, pal };
}

/** Сегодня не до него: просьба снимается без обид. */
export function skipTenant(state: StoreState, id: TenantId): StoreState {
  const done = state.tenantAsk?.day === state.day ? state.tenantAsk.done : [];
  return done.includes(id) ? state : { ...state, tenantAsk: { day: state.day, done: [...done, id] } };
}

// ---------- Итоги ----------

/** Аренда за день со всех комнат. */
export const tenantRent = (state: StoreState): number => tenantsOf(state).reduce((sum, id) => sum + rentOf(state, id), 0);

/** Множитель гостей зала от арендаторов (только в Центре — day.ts, homeOnly). */
export const tenantGuests = (state: StoreState): number => 1 + tenantsOf(state).reduce((sum, id) => sum + guestsOf(state, id), 0);

/** Вечером арендаторы платят за день — до счетов, как филиал. Платят и когда хозяин работает в Заречье. */
export function tenantsNight(state: StoreState): { state: StoreState; income: number } {
  const income = tenantRent(state);
  return income ? { state: { ...state, money: state.money + income }, income } : { state, income: 0 };
}

/** Что видно в мире: число комнат, кто в них и чья комната отделана дважды. Изменилось — сцена перестраивает флигель. */
export const tenantsLook = (state: StoreState): string =>
  inZar(state)
    ? ''
    : `${tenantRooms(state)}:${tenantsOf(state)
        .map((id) => (tenantTier(state, id) === 2 ? `${id}+` : id))
        .join(',')}`;

export const tenantName = (id: TenantId): TextKey => `tenant.${id}.name` as TextKey;
export const tenantDesc = (id: TenantId): TextKey => `tenant.${id}.desc` as TextKey;
/** Имя хозяина комнаты и его реплики: просьба и строчка при полном доверии. */
export const tenantWho = (id: TenantId): TextKey => `tenant.${id}.who` as TextKey;
export const tenantSay = (id: TenantId): TextKey => `tenant.${id}.say` as TextKey;
export const tenantPalLine = (id: TenantId): TextKey => `tenant.${id}.pal` as TextKey;
