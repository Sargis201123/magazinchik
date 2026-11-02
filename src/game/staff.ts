// Поиск сотрудников: игрок даёт объявление на конкретную роль и получает 3 кандидатов.
// Для одного дня и роли кандидаты всегда одни и те же (можно закрыть и открыть экран).

import { wageFor, type StaffMember, type StaffRole, type StoreState, type Trait } from './economy';
import { rng } from './random';
import { careerOf, nextRank, promote, rankXp, type Rank } from './career';

/** Сколько имён в списке (сами имена — в переводах). */
export const NAME_COUNT = 16;
export const CANDIDATES_PER_SEARCH = 3;
/** Объявление о вакансии стоит денег — искать «на всякий случай» невыгодно. */
export const JOB_AD_COST = 30;

const TRAIT_ROLL: (Trait | undefined)[] = [undefined, undefined, undefined, 'hardworker', 'slowpoke', 'sticky'];
const ROLE_SEED: Record<StaffRole, number> = { cashier: 1, cashier2: 5, cashier3: 6, cashier4: 7, cashier5: 12, cleaner: 2, loader: 3, guard: 4, manager: 8, baker: 9, barista: 10, cook: 11 };

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

// ---------- Обучение и повышение: одна лесенка ----------
// Курсы поднимают навык до 3★ (на 3★ — отучить «тормоза»), дальше та же кнопка повышает: старший
// (все должности), администратор зала (только старший кассир). Для повышения нужен опыт смен (career.ts).
// Раньше повышения предлагались утром отдельной карточкой — с 02.11 это следующая ступень «Учить».

/** Курсы: поднять навык (до 3★) или, на 3★, отучить «тормоза». Цена — по текущему навыку. */
export const TRAINING_COST = [250, 600];
export const SLOWPOKE_FIX_COST = 500;
/** Повышение на ступени обучения: старший, администратор зала. */
export const RANK_COST: Record<Rank, number> = { senior: 300, admin: 600 };

export type TrainingStep =
  | { kind: 'skill'; cost: number }
  | { kind: 'slowpoke'; cost: number }
  /** xpLeft > 0 — смен ещё не хватает: кнопка видна, но закрыта. */
  | { kind: 'rank'; to: Rank; cost: number; xpLeft: number };

/** Следующая ступень лесенки (null — расти некуда). day — сегодня (для опыта старых сохранений). */
export function trainingStep(m: StaffMember, day: number): TrainingStep | null {
  if (m.skill < 3) return { kind: 'skill', cost: TRAINING_COST[m.skill - 1] };
  if (m.trait === 'slowpoke') return { kind: 'slowpoke', cost: SLOWPOKE_FIX_COST };
  const to = nextRank(m);
  if (!to) return null;
  return { kind: 'rank', to, cost: RANK_COST[to], xpLeft: Math.max(0, Math.ceil(rankXp(to) - careerOf(m, day).xp)) };
}

/** Цена следующей ступени (null — расти некуда). */
export function trainingCost(m: StaffMember, day = 0): number | null {
  return trainingStep(m, day)?.cost ?? null;
}

/** Отправить на курсы или повысить: навык растёт (или уходит «тормоз»), или новое звание с прибавкой. */
export function train(state: StoreState, role: StaffRole): StoreState | null {
  const m = state.staff.find((s) => s.role === role);
  const step = m && trainingStep(m, state.day);
  if (!m || !step || state.money < step.cost) return null;
  const paid = { ...state, money: state.money - step.cost };
  if (step.kind === 'rank') return step.xpLeft > 0 ? null : promote(paid, role, step.to);
  const skill = m.skill < 3 ? m.skill + 1 : m.skill;
  const trait: Trait | undefined = m.skill < 3 ? m.trait : undefined;
  const trained: StaffMember = { ...m, skill, trait, wage: Math.max(m.wage, wageFor(role, skill, trait)) };
  return { ...paid, staff: paid.staff.map((s) => (s.role === role ? trained : s)) };
}

// ---------- Друзья на работе ----------

/** Друг просит меньше обычного: работает «по-дружески». */
export const FRIEND_WAGE = 0.7;

/**
 * Друг как кандидат на роль: опытнее новичка (2★, трудяга), зарплата на 30% ниже.
 * Один друг — на одном месте: кто уже работает, второй раз не предлагается.
 */
export function friendCandidates(state: StoreState, role: StaffRole, friends: { id: number; name: string }[]): StaffMember[] {
  const busy = new Set(state.staff.map((m) => m.friend?.id).filter(Boolean));
  return friends
    .filter((f) => !busy.has(f.id))
    .slice(0, 3)
    .map((f) => ({
      role,
      name: 0,
      skill: 2,
      trait: 'hardworker' as Trait,
      wage: Math.round((wageFor(role, 2, 'hardworker') * FRIEND_WAGE) / 10) * 10,
      months: 0,
      friend: { id: f.id, name: f.name.slice(0, 24) },
    }));
}

/** Друзья, работающие в магазине. */
export const friendsAtWork = (state: StoreState): StaffMember[] => state.staff.filter((m) => m.friend);
