// Окно «Поддержать автора» (профиль 🏆): три ступени за Telegram Stars (game/support.ts).
// Только украшения и благодарность — так и написано в окне. Оплата — тем же счётом, что и
// премиальное оформление (platform/stars.ts); подарок ставится сразу, сервер подтвердит его при
// следующем запуске (stars-owned), а золотую табличку в рейтинге ставит сам сервер.

import { t, type TextKey } from '../i18n';
import type { StoreState } from '../game/economy';
import { flushCloud } from '../game/save';
import { grantSupport, SUPPORT_TIERS } from '../game/support';
import { buyWithStars, starsAvailable } from '../platform/stars';
import { haptic } from '../platform/telegram';
import { button, el, openModal } from './dom';
import { sheetPng } from './sheet';

export function showSupport(getState: () => StoreState, update: (next: StoreState, feedback: 'success') => void): void {
  const { card, close } = openModal();
  const render = (message?: string) => {
    const state = getState();
    const show = el('div', 'ui-support-show');
    for (const key of ['thanks_plaque', 'cat_hat']) {
      const img = el('img');
      img.src = sheetPng(key);
      img.alt = '';
      show.append(img);
    }
    const note = el('div', 'ui-muted');
    const items: HTMLElement[] = [el('h2', '', `💛 ${t('support.title')}`), show, el('div', 'ui-muted', t('support.note'))];
    if (state.supporter) items.push(el('div', 'ui-note', t('support.you')));
    for (const tier of SUPPORT_TIERS) {
      const box = el('div', 'ui-support-tier');
      const got = (state.supporter ?? 0) >= tier.stars;
      const buy = button(got ? t('support.done') : t('support.buy', { n: tier.stars }), () => {
        buy.disabled = true;
        note.textContent = t('decor.paying');
        void buyWithStars(tier.id).then((result) => {
          if (result === 'paid') {
            update(grantSupport(getState(), [tier.id]), 'success');
            void flushCloud();
            render(t('support.thanks'));
            return;
          }
          buy.disabled = false;
          note.textContent = t(result === 'unavailable' ? 'decor.starsOff' : result === 'cancelled' ? 'decor.payCancelled' : 'decor.payFailed');
          if (result === 'unavailable') haptic.error();
        });
      }, 'ui-btn ui-btn-stars', got);
      const head = el('b', '', t(tier.nameKey));
      box.append(el('span', 'ui-support-icon', tier.icon), head, el('div', 'ui-muted', t(`support.give.${tier.stars}` as TextKey)), buy);
      items.push(box);
    }
    items.push(note, button(t('board.close'), close, 'ui-btn secondary'));
    if (message) note.textContent = message;
    else if (!starsAvailable()) note.textContent = t('decor.starsOff');
    card.replaceChildren(...items);
  };
  render();
}
