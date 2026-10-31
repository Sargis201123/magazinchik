// Раздел «Благоустройство района» во вкладке «Развитие» (hood.ts): картинка, цена и польза каждого
// улучшения. Купленное отмечено галочкой, закрытое — замком с причиной. Покупка ставит вещь на улицу
// (сцена перестраивает мир по hoodLook) и показывает тост.

import { t } from '../i18n';
import { STORE_LEVELS, type StoreState } from '../game/economy';
import { buyHood, hasHood, HOOD, HOOD_IDS, hoodDesc, hoodGuests, hoodLock, hoodName, hoodSpent, hoodVisible, type HoodId } from '../game/hood';
import { track } from '../platform/analytics';
import { button, el, toast } from './dom';
import { sheetPng } from './sheet';

/** Картинка улучшения в списке — спрайт с улицы. */
const ART: Record<HoodId, string> = {
  lamps: 'hood_lamp',
  beds: 'hood_planter',
  bikes: 'hood_bikes',
  bus: 'hood_bus',
  mural: 'hood_mural',
  benches: 'bench',
  fir: 'hood_fir_xmas',
  fountain: 'hood_fountain',
  playground: 'hood_playground',
  facades: 'hood_flowerbox',
  fair: 'hood_stall_R',
  statue: 'hood_statue',
};

/** Польза строкой: «гостей +2% · рейтинг +0.1». */
function effects(id: HoodId): string {
  const item = HOOD[id];
  const parts = [t('hood.effect.guests', { n: Math.round(item.guests * 100) })];
  if (item.rating) parts.push(t('hood.effect.rating', { n: item.rating }));
  if (item.tips) parts.push(t('hood.effect.tips', { n: Math.round(item.tips * 100) }));
  return parts.join(' · ');
}

export function hoodBox(state: StoreState, getState: () => StoreState, update: (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void): HTMLElement[] {
  if (!hoodVisible(state)) return [];
  const box = el('div', 'ui-box');
  box.append(el('b', '', `🌷 ${t('hood.title')}`), el('div', 'ui-muted', t('hood.note')));
  const spent = hoodSpent(state);
  if (spent) box.append(el('div', '', t('hood.spent', { n: spent, g: Math.round((hoodGuests(state) - 1) * 100) })));
  if (state.debt > 0) box.append(el('div', 'ui-note', t('hood.needNoDebt')));
  for (const id of HOOD_IDS) {
    const item = HOOD[id];
    const owned = hasHood(state, id);
    const lock = hoodLock(state, id);
    const row = el('div', 'ui-item');
    const img = el('img');
    img.src = sheetPng(ART[id]);
    img.alt = '';
    img.style.cssText = `width: 44px; height: 44px; object-fit: contain; flex: none; image-rendering: pixelated;${lock && !owned ? ' filter: grayscale(0.8) opacity(0.6);' : ''}`;
    const body = el('div');
    body.append(el('div', 'ui-item-name', `${item.icon} ${t(hoodName(id))}`), el('div', 'ui-item-sub', t(hoodDesc(id))), el('div', 'ui-item-sub', effects(id)));
    const actions = el('div', 'ui-item-actions');
    if (owned) actions.append(el('span', 'ui-tag', t('hood.done')));
    else if (lock) body.append(el('div', 'ui-item-sub', lock === 'level' ? t('hood.lock.level', { name: t(STORE_LEVELS[item.level].nameKey) }) : t('hood.lock.rest')));
    else {
      const buy = button(
        `${item.price} 💰`,
        () => {
          const bought = buyHood(getState(), id);
          if (!bought) return;
          track('hood', bought.day, item.price);
          toast('assets/ico_shop.png', t('hood.bought'), t('hood.boughtText', { name: t(hoodName(id)) }));
          update(bought, 'success');
        },
        'ui-chip hood-buy',
        state.debt > 0 || state.money < item.price,
      );
      actions.append(buy);
    }
    row.append(img, body, actions);
    box.append(row);
  }
  return [box];
}
