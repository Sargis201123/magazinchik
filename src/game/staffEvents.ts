// Персонал с характером: иногда утром сотрудник приходит с просьбой или случается история —
// отпроситься на свадьбу сестры, оплатить курсы, аванс до зарплаты, ссора двух коллег,
// своя идея для магазина, премия за отличную смену. Это истории для души в очереди новостей
// (headlines.ts): поддержанный воодушевлён и несколько дней работает быстрее, а отказ ничем не грозит
// (с 02.11 обид, выходных и увольнений из-за них больше нет).

import type { StaffMember, StaffRole, StoreState } from './economy';

export type StaffEventKind = 'wedding' | 'course' | 'advance' | 'quarrel' | 'idea' | 'best';

export interface StaffEvent {
  kind: StaffEventKind;
  /** Кого касается (для ссоры — двое). */
  roles: StaffRole[];
  day: number;
}

export const STAFF_EVENT_FROM = 10;
export const STAFF_EVENT_CHANCE = 0.25;
/** Цены решений и сколько дней длится воодушевление. */
export const COURSE_COST = 600;
export const ADVANCE = 300;
export const PIZZA_COST = 150;
export const BONUS = 200;
export const INSPIRED_DAYS = 5;
export const IDEA_RATING = 0.05;

const KINDS: StaffEventKind[] = ['wedding', 'course', 'advance', 'quarrel', 'idea', 'best'];

/** Утро: может случиться история с сотрудниками (если их хотя бы двое). */
export function staffMorning(state: StoreState, random: () => number): StoreState {
  if (state.staffEvent || state.day < STAFF_EVENT_FROM || state.staff.length < 2 || random() >= STAFF_EVENT_CHANCE) return state;
  // «Лучшая смена» (best) — похвала за один день; «сотрудника месяца» выбирают по делу раз в четыре недели (career.ts).
  const kinds = KINDS.filter((k) => k !== 'course' || state.staff.some((m) => m.skill < 3));
  const kind = kinds[Math.floor(random() * kinds.length)];
  const pool = kind === 'course' ? state.staff.filter((m) => m.skill < 3) : state.staff;
  const a = pool[Math.floor(random() * pool.length)];
  const others = state.staff.filter((m) => m !== a);
  const roles = kind === 'quarrel' ? [a.role, others[Math.floor(random() * others.length)].role] : [a.role];
  return { ...state, staffEvent: { kind, roles, day: state.day } };
}

/** Сколько стоит согласиться (0 — бесплатно). */
export const eventCost = (event: StaffEvent): number =>
  ({ wedding: 0, course: COURSE_COST, advance: ADVANCE, quarrel: PIZZA_COST, idea: 0, best: BONUS })[event.kind];

const change = (state: StoreState, role: StaffRole, f: (m: StaffMember) => StaffMember): StoreState => ({
  ...state,
  staff: state.staff.map((m) => (m.role === role ? f(m) : m)),
});
const inspire = (m: StaffMember): StaffMember => ({ ...m, inspired: INSPIRED_DAYS });

/** Ответ игрока: yes — поддержать (согласиться, заплатить), no — отказать. */
export function answerStaffEvent(state: StoreState, yes: boolean): StoreState | null {
  const event = state.staffEvent;
  if (!event) return null;
  const cost = eventCost(event);
  if (yes && state.money < cost) return null;
  // Сотрудник мог уволиться, пока ждал ответа: просьба снимается, денег не берём.
  if (!event.roles.every((r) => state.staff.some((m) => m.role === r))) return { ...state, staffEvent: undefined };
  let s: StoreState = { ...state, staffEvent: undefined, money: state.money - (yes ? cost : 0) };
  const [a, b] = event.roles;
  switch (event.kind) {
    case 'wedding':
    case 'advance':
      // Отпустили на свадьбу (смену прикроют), дали аванс — вернётся воодушевлённым.
      return yes ? change(s, a, inspire) : s;
    case 'course':
      return yes ? change(s, a, (m) => ({ ...inspire(m), skill: Math.min(3, m.skill + 1) })) : s;
    case 'quarrel':
      // Пицца на всех — помирились и работают дружнее.
      return yes ? change(change(s, a, inspire), b, inspire) : s;
    case 'idea':
      if (yes) s = { ...s, rating: Math.round(Math.min(5, s.rating + IDEA_RATING) * 100) / 100 };
      return yes ? change(s, a, inspire) : s;
    case 'best':
      return yes ? change(s, a, inspire) : s;
  }
}
