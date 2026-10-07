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
const ROLE_SEED: Record<StaffRole, number> = { cashier: 1, cleaner: 2, loader: 3, guard: 4 };

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
