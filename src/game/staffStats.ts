// Статистика персонала (11.11, идея автора: «интересная статистика у персонала, чтоб сделать их живее»).
// У каждого сотрудника копится своё: сколько дел за всё время (кассир — пробитые покупатели, уборщик — уборки,
// грузчик — разложенный товар…), рекорд за смену и в какой день, сколько в среднем за смену, сколько прошёл по
// залу. Побил свой рекорд — строчкой в итогах дня. И у каждого своя привычка — постоянная, по имени и должности.
// Дела и шаги считает сцена (scenes/staff.ts credit, workerWalk), ночью они складываются здесь (day.ts).

import type { StaffMember, StaffRole, StoreState } from './economy';

export interface StaffTally {
  /** Дел за всё время (с 11.11 — раньше не считали). */
  deeds: number;
  /** Смен, за которые считали. */
  shifts: number;
  /** Рекорд дел за смену и в какой день. */
  best?: number;
  bestDay?: number;
  /** Сколько прошёл по залу, метров. */
  walked?: number;
}

/** Что считается делом у каждой должности: так и подписано в карточке. */
export type DeedKind = 'served' | 'cleaned' | 'stocked' | 'caught' | 'managed' | 'baked' | 'brewed' | 'cooked';

export const DEED_OF: Record<StaffRole, DeedKind> = {
  cashier: 'served',
  cashier2: 'served',
  cashier3: 'served',
  cashier4: 'served',
  cashier5: 'served',
  cleaner: 'cleaned',
  loader: 'stocked',
  guard: 'caught',
  manager: 'managed',
  baker: 'baked',
  barista: 'brewed',
  cook: 'cooked',
};

export const DEED_ICON: Record<DeedKind, string> = { served: '🧾', cleaned: '🧹', stocked: '📦', caught: '🛡', managed: '📋', baked: '🥖', brewed: '☕', cooked: '🍲' };

/** Рекорд считается рекордом со стольких смен — в первые дни каждый день был бы «рекордом». */
export const RECORD_FROM_SHIFTS = 3;
/** Точек мира на метр: человечек ростом ~17 точек — это 1,7 м. */
export const WORLD_PER_METER = 10;
/** Сколько привычек (тексты staffStats.quirk.N). */
export const QUIRKS = 12;

export interface StaffRecord {
  role: StaffRole;
  name: number;
  friend?: string;
  n: number;
  kind: DeedKind;
}

/**
 * Ночь: дела и шаги за день — в копилку каждого, кто работал. Побил свой рекорд (с RECORD_FROM_SHIFTS-й смены) —
 * в список рекордов для итогов дня. Кто сегодня ничего не сделал (выходной, только нанят под вечер) — смена не считается.
 */
export function tallyNight(
  state: StoreState,
  deeds: Partial<Record<StaffRole, number>> = {},
  walked: Partial<Record<StaffRole, number>> = {},
): { state: StoreState; records: StaffRecord[] } {
  const records: StaffRecord[] = [];
  let changed = false;
  const staff = state.staff.map((m): StaffMember => {
    const n = Math.round(deeds[m.role] ?? 0);
    const steps = walked[m.role] ?? 0;
    if (n <= 0 && steps <= 0) return m;
    changed = true;
    const was = m.tally ?? { deeds: 0, shifts: 0 };
    const tally: StaffTally = { ...was, deeds: was.deeds + n, shifts: was.shifts + 1, walked: Math.round((was.walked ?? 0) + steps / WORLD_PER_METER) };
    if (n > (was.best ?? 0)) {
      if (was.shifts >= RECORD_FROM_SHIFTS && (was.best ?? 0) > 0) records.push({ role: m.role, name: m.name, friend: m.friend?.name, n, kind: DEED_OF[m.role] });
      tally.best = n;
      tally.bestDay = state.day;
    }
    return { ...m, tally };
  });
  return { state: changed ? { ...state, staff } : state, records };
}

/** В среднем дел за смену (0 — ещё не считали). */
export const deedsPerShift = (t: StaffTally): number => (t.shifts ? Math.round(t.deeds / t.shifts) : 0);

/** Привычка сотрудника: постоянная, от имени и должности (у друга из Telegram — от его имени). */
export function quirkOf(m: StaffMember): number {
  const key = `${m.friend?.name ?? m.name}:${m.role}`;
  let h = 7;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % QUIRKS;
}
