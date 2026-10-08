// Книга достижений: все значки сеткой. Открытые — цветные, закрытые — серые с прогрессом.

import { t } from '../i18n';
import { ACHIEVEMENTS, achievementDesc, achievementName, liveProgress, type AchievementId } from '../game/achievements';
import type { StoreState } from '../game/economy';
import { button, el, openModal, toast } from './dom';
import { sound } from '../platform/sound';

export const badgeSrc = (id: AchievementId): string => `assets/badge_${id}.png`;

export function achievementsButton(state: StoreState): HTMLButtonElement {
  const n = state.achievements?.length ?? 0;
  return button(t('ach.button', { n, total: ACHIEVEMENTS.length }), () => showAchievements(state), 'ui-btn secondary');
}

export function showAchievements(state: StoreState): void {
  const { card, close } = openModal();
  const have = new Set(state.achievements ?? []);
  const progress = liveProgress(state);
  card.append(el('h2', '', `🏅 ${t('ach.title')}`), el('div', 'ui-muted', `${have.size} / ${ACHIEVEMENTS.length}`));
  const grid = el('div', 'ui-badges');
  // Сначала открытые, потом — ближайшие к открытию.
  const order = [...ACHIEVEMENTS].sort((a, b) => {
    const done = Number(have.has(b.id)) - Number(have.has(a.id));
    if (done) return done;
    const [av, ag] = a.progress(progress);
    const [bv, bg] = b.progress(progress);
    return bv / bg - av / ag;
  });
  for (const a of order) {
    const open = have.has(a.id);
    const cell = el('div', `ui-badge${open ? '' : ' locked'}`);
    const img = el('img');
    img.src = badgeSrc(a.id);
    img.alt = '';
    cell.append(img, el('b', '', t(achievementName(a.id))), el('span', '', t(achievementDesc(a.id))));
    const [value, goal] = a.progress(progress);
    if (!open && goal > 1) {
      const bar = el('div', 'ui-bar');
      const fill = el('div', 'ui-bar-fill');
      fill.style.width = `${Math.round((value / goal) * 100)}%`;
      fill.style.background = '#feae34';
      bar.append(fill);
      cell.append(bar, el('span', '', `${value} / ${goal}`));
    }
    grid.append(cell);
  }
  card.append(grid, button(t('ach.close'), close));
}

/** «Новое достижение!» — всплывашка со значком. */
export function announceAchievement(id: AchievementId): void {
  sound.good();
  toast(badgeSrc(id), t('ach.unlocked'), t(achievementName(id)));
}
