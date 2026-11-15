// Что сделал менеджер зала (15.11, автор: «я всё ещё не могу понять, чем занят менеджер зала и зачем он нужен»).
// Польза у него и раньше была (все быстрее на MANAGER_BOOST, срочный подвоз дешевле автозаказа, берёт трубку,
// собирает заказы на дом), но её не было видно. Теперь сцена считает его дела за день (DayStats.mgr), ночью
// они ложатся в его карточку: вчера и за всё время — звонки, заказы на дом, срочный подвоз и сколько на нём
// сэкономили, и на скольких покупателей быстрее шла касса. Сами правила и деньги не меняются.

import { MANAGER_BOOST, type StaffMember, type StoreState } from './economy';
import { topUpPrice } from './autoorder';
import { urgentUnitPrice } from './urgent';
import type { ProductId } from './economy';

export interface ManagerDay {
  /** Ответил на звонки (заказы на дом). */
  calls: number;
  /** Собрал заказов на дом и вынес курьеру. */
  parcels: number;
  /** Сколько раз сам заказал срочный подвоз и сколько на этом сэкономил против автозаказа. */
  urgent: number;
  saved: number;
  /** На скольких покупателей за день касса успела больше благодаря его +10% (≈). */
  faster: number;
}

export interface ManagerLog {
  /** Последняя смена (в какой день) и всё вместе. */
  last?: ManagerDay & { day: number };
  total: ManagerDay;
  shifts: number;
}

/** Дела менеджера за день, как их считает сцена (scenes/staff.ts managerLoop). */
export type ManagerDayStats = Partial<Pick<ManagerDay, 'calls' | 'parcels' | 'urgent' | 'saved'>>;

const ZERO: ManagerDay = { calls: 0, parcels: 0, urgent: 0, saved: 0, faster: 0 };

/**
 * Сколько сэкономил срочный заказ менеджера против подвоза автозаказом (тот берёт +25%, менеджер +10%).
 * Товар никто не продаёт — 0.
 */
export function urgentSaving(state: StoreState, id: ProductId, qty: number): number {
  const mine = urgentUnitPrice(state, id);
  const auto = topUpPrice(id);
  return mine === null || auto === null ? 0 : Math.max(0, (auto - mine) * qty);
}

/**
 * Из served покупателей примерно столько успели пробить только благодаря менеджеру: все пробивают в
 * MANAGER_BOOST раз быстрее, значит без него за то же время прошло бы served / MANAGER_BOOST.
 */
export const fasterServed = (served: number): number => Math.max(0, Math.round(served - served / MANAGER_BOOST));

export const managerLogOf = (m: StaffMember | undefined): ManagerLog | undefined => m?.mgr;

/**
 * Ночь: дела менеджера за день — в его карточку (вчера и за всё время). Менеджера нет — ничего не меняется.
 * Касса «быстрее на N» считается по всем пробитым за день (served), даже если звонков не было.
 */
export function managerNight(state: StoreState, day: ManagerDayStats | undefined, served: number): StoreState {
  const idx = state.staff.findIndex((m) => m.role === 'manager');
  if (idx < 0) return state;
  const today: ManagerDay = {
    calls: day?.calls ?? 0,
    parcels: day?.parcels ?? 0,
    urgent: day?.urgent ?? 0,
    saved: Math.round(day?.saved ?? 0),
    faster: fasterServed(served),
  };
  const was = state.staff[idx].mgr ?? { total: ZERO, shifts: 0 };
  const total = Object.fromEntries((Object.keys(ZERO) as (keyof ManagerDay)[]).map((k) => [k, (was.total[k] ?? 0) + today[k]])) as unknown as ManagerDay;
  const mgr: ManagerLog = { last: { ...today, day: state.day }, total, shifts: was.shifts + 1 };
  const staff = state.staff.map((m, i) => (i === idx ? { ...m, mgr } : m));
  return { ...state, staff };
}
