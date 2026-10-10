// Поиск сотрудников: игрок даёт объявление на конкретную роль и получает 3 кандидатов.
// Для одного дня и роли кандидаты всегда одни и те же (можно закрыть и открыть экран).

import { wageFor, type StaffMember, type StaffRole, type StoreState, type Trait } from './economy';
import { rng } from './random';

/** Сколько имён в списке (сами имена — в переводах). */
export const NAME_COUNT = 16;
export const CANDIDATES_PER_SEARCH = 3;
/** Объявление о вакансии стоит денег — искать «на всякий случай» невыгодно. */
export const JOB_AD_COST = 30;

const TRAIT_ROLL: (Trait | undefined)[] = [undefined, undefined, undefined, 'hardworker', 'slowpoke', 'sticky'];
const ROLE_SEED: Record<StaffRole, number> = { cashier: 1, cashier2: 5, cashier3: 6, cashier4: 7, cleaner: 2, loader: 3, guard: 4, manager: 8, baker: 9, barista: 10 };

export function candidatesFor(day: number, seed: number, role: StaffRole): StaffMember[] {
  const random = rng(day * 7919 + seed * 104729 + ROLE_SEED[role] * 31);
  const names = new Set<number>();
  return Array.from({ length: CANDIDATES_PER_SEARCH }, () => {
    const r = random();
    const skill = r < 0.5 ? 1 : r < 0.85 ? 2 : 3;
    const trait = TRAIT_ROLL[Math.floor(random() * TRAIT_ROLL.length)];
    let name = Math.floor(random() * NAME_COUNT);
    while (names.has(name)) name = (name + 1) % NAME_COUNT;
    names.add(name);
    return { role, name, skill, trait, wage: wageFor(role, skill, trait), months: 0 };
  });
}

/** Дать объявление: за деньги появляются 3 кандидата на роль. Повторный поиск той же роли в тот же день бесплатный. */
export function startJobSearch(state: StoreState, role: StaffRole): StoreState | null {
  const current = state.jobSearch;
  if (current && current.day === state.day && current.role === role) return state;
  if (state.money < JOB_AD_COST) return null;
  return {
    ...state,
    money: state.money - JOB_AD_COST,
    jobSearch: { day: state.day, role, candidates: candidatesFor(state.day, 0, role) },
  };
}

/** Кандидаты из сегодняшнего объявления (вчерашние уже нашли другую работу). */
export const currentCandidates = (state: StoreState): StaffMember[] =>
  state.jobSearch && state.jobSearch.day === state.day ? state.jobSearch.candidates : [];

// ---------- Обучение ----------

/** Курсы: поднять навык (до 3★) или, на 3★, отучить «тормоза». Цена — по текущему навыку. */
export const TRAINING_COST = [250, 600];
export const SLOWPOKE_FIX_COST = 500;

export function trainingCost(m: StaffMember): number | null {
  if (m.skill < 3) return TRAINING_COST[m.skill - 1];
  return m.trait === 'slowpoke' ? SLOWPOKE_FIX_COST : null;
}

/** Отправить на курсы: навык растёт (или уходит «тормоз»), зарплата — не меньше положенной по навыку. */
export function train(state: StoreState, role: StaffRole): StoreState | null {
  const m = state.staff.find((s) => s.role === role);
  const cost = m && trainingCost(m);
  if (!m || cost === null || cost === undefined || state.money < cost) return null;
  const skill = m.skill < 3 ? m.skill + 1 : m.skill;
  const trait: Trait | undefined = m.skill < 3 ? m.trait : undefined;
  const trained: StaffMember = { ...m, skill, trait, wage: Math.max(m.wage, wageFor(role, skill, trait)) };
  return { ...state, money: state.money - cost, staff: state.staff.map((s) => (s.role === role ? trained : s)) };
}
