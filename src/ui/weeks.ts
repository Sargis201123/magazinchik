// Утренняя карточка сезонной недели (game/weeks.ts): какой день недели, дорожка из шести шагов
// (пройденные — галочкой, сегодняшний подпрыгивает), цель дня и награда, памятная вещь в конце.
// До начала недели — строчка «через N дн.» в сводке утра.

import { t } from '../i18n';
import type { TextKey } from '../i18n/ru';
import { decorItem } from '../game/decor';
import { PRODUCTS, type StoreState } from '../game/economy';
import { FIREWORKS_DAY, nextWeek, PIE_CONTEST_DAY, SALE_DISCOUNT, stepReward, trackOf, weekFor, weekGoal, WEEK_STEPS, WEEKS, type WeekGoalToday, type WeekId } from '../game/weeks';
import { el } from './dom';

/** Цель шага словами: «обслужить 20 гостей», «продать 4 🎃 Тыквы», «выручка 600 💰». */
export function goalText(goal: WeekGoalToday): string {
  if (goal.kind === 'serve') return t('week.goal.serve', { n: goal.target });
  if (goal.kind === 'revenue') return t('week.goal.revenue', { n: goal.target });
  return t('week.goal.sell', { n: goal.target, what: goal.what ? t(goal.what) : (goal.products ?? []).map((id) => PRODUCTS[id].icon).join('') });
}

/** Что особенного сегодня в неделе: конкурс пирогов, салют, вечерняя распродажа. */
const todayNote = (id: WeekId, n: number): TextKey | null => {
  if (id === 'harvest' && n === PIE_CONTEST_DAY) return 'week.note.pies';
  if (id === 'summer' && n === FIREWORKS_DAY) return 'week.note.fireworks';
  if (id === 'sale') return 'week.note.sale';
  return null;
};

/** Карточка недели утром. guests — прогноз гостей дня (для цели шага, если плана ещё нет). */
export function weekBox(state: StoreState, guests: number): HTMLElement[] {
  const w = weekFor(state.day);
  if (!w) return [];
  const week = WEEKS[w.id];
  const track = trackOf(state, w.id, state.day);
  const box = el('div', 'ui-box ui-week');
  box.append(el('b', '', `${week.icon} ${t(week.nameKey)} · ${t('week.dayOf', { n: w.n, total: 7 })}`), el('div', 'ui-muted', t(week.descKey)));
  const note = todayNote(w.id, w.n);
  if (note) box.append(el('div', 'ui-note', t(note, { p: Math.round((1 - SALE_DISCOUNT) * 100) })));
  // Дорожка: пройденные шаги — галочкой, сегодняшний — подпрыгивает, последний — с подарком.
  const grid = el('div', 'ui-advent');
  grid.style.gridTemplateColumns = `repeat(${WEEK_STEPS}, 1fr)`;
  const doneToday = track.last === state.day;
  for (let n = 1; n <= WEEK_STEPS; n++) {
    const done = n <= track.steps;
    const now = !done && n === track.steps + 1 && !doneToday;
    grid.append(el('span', `ui-advent-day${done ? ' done' : now ? ' today' : ' later'}`, done ? '✓' : n === WEEK_STEPS ? '🎁' : String(n)));
  }
  box.append(grid);
  const goal = state.plan?.day === state.day && state.plan.week !== undefined ? state.plan.week : weekGoal(state, guests);
  if (goal) {
    box.append(el('div', '', t('week.today', { goal: goalText(goal), n: stepReward(state.level, goal.step) })));
  } else if (track.steps >= WEEK_STEPS) {
    box.append(el('div', 'ui-note', t('week.trackDone')));
  } else if (doneToday) {
    box.append(el('div', 'ui-note', t('week.stepDone')));
  }
  const item = t(decorItem(week.keepsake).nameKey);
  box.append(el('div', 'ui-muted', state.decor.owned.includes(week.keepsake) ? t('week.prizeGot', { item }) : t('week.prize', { item, n: WEEK_STEPS })));
  return [box];
}

/** Строчка в сводке утра: неделя скоро (в пределах трёх дней). */
export function weekSoonLine(state: StoreState): HTMLElement[] {
  if (weekFor(state.day)) return [];
  const next = nextWeek(state.day, 3);
  if (!next) return [];
  const week = WEEKS[next.id];
  return [el('div', 'ui-muted', t('week.soon', { n: next.in, icon: week.icon, name: t(week.nameKey) }))];
}
