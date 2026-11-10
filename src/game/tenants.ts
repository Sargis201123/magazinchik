// Арендаторы во флигеле. С «Минимаркета» над кофейней и кухней есть свободные комнаты — их сдают.
// Арендатор сам отделывает комнату и работает без хозяина: игрок один раз выбирает, кого пустить, и платит
// за отделку, дальше каждый вечер приходит аренда, а посетители арендатора заодно заходят в зал.
// Пункт выдачи заказов — тоже арендатор: за посылками идёт больше всего людей.
// Комнаты в мире — scenes/tenantsFx.ts (места — scenes/layout.ts), раздел «Развития» — ui/tenants.ts.

import type { StoreState } from './economy';
import type { TextKey } from '../i18n';
import { homeLevel, inZar } from './zarshop';

export type TenantId = 'pickup' | 'pharmacy' | 'repair' | 'toys';
export const TENANT_IDS: TenantId[] = ['pickup', 'pharmacy', 'repair', 'toys'];

export interface Tenant {
  icon: string;
  /** Отделка комнаты — платит хозяин один раз. */
  setup: number;
  /** Аренда за день, приходит вечером до счетов. */
  rent: number;
  /** Прибавка к потоку гостей зала (0.04 = +4%). */
  guests: number;
}

/**
 * Цифры подобраны так, чтобы отделка окупалась за 10–15 дней в «Минимаркете» и быстрее в больших залах
 * (аренда не растёт, а гости — доля от потока). Пункт выдачи: аренда маленькая, зато людей больше всех.
 */
export const TENANTS: Record<TenantId, Tenant> = {
  pickup: { icon: '📦', setup: 3000, rent: 150, guests: 0.04 },
  pharmacy: { icon: '💊', setup: 6000, rent: 320, guests: 0.02 },
  repair: { icon: '🔑', setup: 3500, rent: 220, guests: 0.01 },
  toys: { icon: '🧸', setup: 2500, rent: 120, guests: 0.03 },
};

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

/** Расстаться с арендатором: комната свободна, отделку не возвращают. */
export function evict(state: StoreState, id: TenantId): StoreState {
  return { ...state, tenants: tenantsOf(state).filter((other) => other !== id) };
}

/** Аренда за день со всех комнат. */
export const tenantRent = (state: StoreState): number => tenantsOf(state).reduce((sum, id) => sum + TENANTS[id].rent, 0);

/** Множитель гостей зала от арендаторов (только в Центре — day.ts, homeOnly). */
export const tenantGuests = (state: StoreState): number => 1 + tenantsOf(state).reduce((sum, id) => sum + TENANTS[id].guests, 0);

/** Вечером арендаторы платят за день — до счетов, как филиал. Платят и когда хозяин работает в Заречье. */
export function tenantsNight(state: StoreState): { state: StoreState; income: number } {
  const income = tenantRent(state);
  return income ? { state: { ...state, money: state.money + income }, income } : { state, income: 0 };
}

/** Что видно в мире: число комнат и кто в них. Изменилось — сцена перестраивает флигель. */
export const tenantsLook = (state: StoreState): string => (inZar(state) ? '' : `${tenantRooms(state)}:${tenantsOf(state).join(',')}`);

export const tenantName = (id: TenantId): TextKey => `tenant.${id}.name` as TextKey;
export const tenantDesc = (id: TenantId): TextKey => `tenant.${id}.desc` as TextKey;
