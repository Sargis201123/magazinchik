// Места под кассы растут вместе с помещением: в ларьке и маленьком магазине — одно, дальше с каждым
// расширением ещё одно (до четырёх в универмаге). Первая касса — всегда хозяина: за ней стоит сам
// игрок и пробивает касанием. Остальные кассы хозяин покупает сам, когда очередь того стоит, и за
// каждую нанимает своего кассира. Сменщик (роль cashier) подменяет хозяина за его кассой, только
// пока тот отошёл по делу (выложить товар, убрать), — вернулся хозяин, и пробивает снова он.

import { STORE_LEVELS, type StaffMember, type StaffRole, type StoreState } from './economy';

export const REGISTERS_BY_LEVEL = [1, 1, 2, 3, 4];
/** Все, кто работает за кассой: сменщик хозяина и кассиры второй, третьей и четвёртой касс. */
export const CASHIER_ROLES: StaffRole[] = ['cashier', 'cashier2', 'cashier3', 'cashier4'];
/** Сменщик: встаёт за кассу хозяина, пока тот в зале, и торгует, пока игрока нет в игре. */
export const RELIEF_ROLE: StaffRole = 'cashier';
/** Кассиры своих касс: TILL_ROLES[0] — за второй кассой (у первой кассы кассира нет — она хозяина). */
export const TILL_ROLES: StaffRole[] = ['cashier2', 'cashier3', 'cashier4'];
/** Цена второй, третьей и четвёртой кассы (первая есть всегда). */
export const REGISTER_PRICES = [0, 1200, 2400, 4000];

const slotsAt = (level: number): number => REGISTERS_BY_LEVEL[Math.min(level, REGISTERS_BY_LEVEL.length - 1)];

/** Сколько мест под кассы в помещении. */
export const registerSlots = (state: StoreState): number => slotsAt(state.level);

/**
 * Сколько касс стоит. Старые сохранения (без поля registers) получили кассы при стройке — их не отнимаем;
 * купленная когда-то «вторая касса» — тоже не меньше двух.
 */
export const registerCount = (state: StoreState): number => {
  const legacy = (state.upgrades ?? []).includes('register2') ? 2 : 1;
  const bought = state.registers ?? slotsAt(state.level);
  return Math.max(legacy, Math.min(registerSlots(state), bought));
};

/** Цена следующей кассы (null — мест нет, сначала расширься). */
export const nextRegisterPrice = (state: StoreState): number | null => {
  const n = registerCount(state);
  return n < registerSlots(state) ? REGISTER_PRICES[n] ?? null : null;
};

/** Поставить кассу на свободное место. */
export function buyRegister(state: StoreState): StoreState | null {
  const price = nextRegisterPrice(state);
  if (price === null || price > state.money) return null;
  return { ...state, money: state.money - price, registers: registerCount(state) + 1 };
}

/** Мест под кассы будет после следующего расширения (null — расширяться некуда). */
export const nextRegisterCount = (state: StoreState): number | null =>
  STORE_LEVELS[state.level + 1] ? slotsAt(state.level + 1) : null;

export const isCashierRole = (role: StaffRole): boolean => CASHIER_ROLES.includes(role);
/** За какой кассой работает этот кассир: 0 — касса хозяина (там только сменщик), -1 — не кассир. */
export const registerOfRole = (role: StaffRole): number => (role === RELIEF_ROLE ? 0 : isCashierRole(role) ? TILL_ROLES.indexOf(role) + 1 : -1);
/** Кассир кассы номер index (с 0); у первой кассы его нет — за ней хозяин. */
export const tillRole = (index: number): StaffRole | undefined => (index > 0 ? TILL_ROLES[index - 1] : undefined);

const hired = (state: StoreState, role: StaffRole): boolean => state.staff.some((m) => m.role === role);

/** Сколько кассир за кассами (сменщик тоже считается). */
export const cashierCount = (state: StoreState): number => state.staff.filter((m) => isCashierRole(m.role)).length;

/** Касса стоит, а кассира за ней нет (первая не в счёт — она хозяина). */
export const idleRegisters = (state: StoreState): number =>
  TILL_ROLES.slice(0, registerCount(state) - 1).filter((role) => !hired(state, role)).length;

/**
 * Кого брать следующим, когда очередь не успевает: кассира за первую свободную кассу (её можно
 * докупить, если место есть), а когда свои кассы кончились — сменщика. null — все места заняты.
 */
export function nextCashierRole(state: StoreState): StaffRole | null {
  const till = TILL_ROLES.slice(0, registerSlots(state) - 1).find((role) => !hired(state, role));
  return till ?? (hired(state, RELIEF_ROLE) ? null : RELIEF_ROLE);
}

/**
 * Сохранения до «касса — хозяина»: раньше кассир (роль cashier) стоял за первой кассой, а хозяин — за
 * первой свободной. Теперь первая касса — хозяина, поэтому кассир переходит за первую из остальных
 * касс, где никого нет; такой нет (касса одна или все заняты) — остаётся сменщиком. Никого не
 * увольняем и денег не берём: за кассами стоит столько же людей, сколько раньше. Вместе с ролью
 * меняется всё, что на неё ссылается: болезнь и отгул сегодня, история с сотрудником, объявление.
 */
export function migrateOwnerTill(state: StoreState): StoreState {
  const done = { ...state, ownerTill: true };
  if (!hired(state, RELIEF_ROLE)) return done;
  const to = TILL_ROLES.slice(0, registerCount(state) - 1).find((role) => !hired(state, role));
  if (!to) return done;
  const swap = (role: StaffRole): StaffRole => (role === RELIEF_ROLE ? to : role === to ? RELIEF_ROLE : role);
  const member = (m: StaffMember): StaffMember => ({ ...m, role: swap(m.role) });
  const plan = state.plan && {
    ...state.plan,
    sick: state.plan.sick && swap(state.plan.sick),
    event: state.plan.event && 'role' in state.plan.event ? { ...state.plan.event, role: swap(state.plan.event.role) } : state.plan.event,
  };
  return {
    ...done,
    staff: state.staff.map(member),
    plan,
    staffEvent: state.staffEvent && { ...state.staffEvent, roles: state.staffEvent.roles.map(swap) },
    jobSearch: state.jobSearch && { ...state.jobSearch, role: swap(state.jobSearch.role), candidates: state.jobSearch.candidates.map(member) },
  };
}
