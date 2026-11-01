// Карточка друга с «Улицы друзей» (game/street.ts, scenes/friendStreet.ts): кто это, какой у него
// магазин и когда заходил; «Зайти в гости» (утром, тот же просмотр, что из списка друзей) и «Подарок»
// (ui/presents.ts: те же подарки и те же лимиты в день).

import { t, type TextKey } from '../i18n';
import { STORE_LEVELS, type StoreState } from '../game/economy';
import { lastSeen, type StreetFriend } from '../game/street';
import { presentGiven, presentsOn, showGiftPicker } from './presents';
import { button, el, openModal } from './dom';

/** Окно друга; onVisit — «Зайти в гости» (сцена решает, когда). */
export function showStreetCard(f: StreetFriend, home: StoreState, onVisit: () => void): void {
  const { card, close } = openModal();
  const level = STORE_LEVELS[Math.max(0, Math.min(STORE_LEVELS.length - 1, f.level))];
  const seen = lastSeen(f);
  card.append(
    el('h2', '', `🏠 ${f.shop || t('street.sign', { name: f.name })}`),
    el('div', '', t('street.card.who', { name: f.name, shop: t(level.nameKey) })),
    el('div', 'ui-muted', t('street.card.stats', { day: f.day, rating: f.rating.toFixed(1) })),
    el('div', 'ui-muted', t(seen.key as TextKey, { n: seen.n })),
    button(`🚪 ${t('street.card.visit')}`, () => {
      close();
      onVisit();
    }),
  );
  // Подарок — как в гостях: один в день этому другу, кнопка гаснет, когда подарен.
  if (presentsOn()) {
    const given = presentGiven(f.id);
    const gift = button(given ? t('social.give.done') : t('social.give.btn'), () => {
      close();
      showGiftPicker({ id: f.id, name: f.name }, home.day, home.level, () => undefined);
    }, 'ui-btn secondary', given);
    card.append(gift);
  }
  card.append(button(t('board.close'), close, 'ui-btn secondary'));
}
