// Окно «Бабушка прислала гостинец»: семь коробочек серии, сегодняшняя подпрыгивает, награда и «Забрать».

import { t } from '../i18n';
import { PRODUCTS } from '../game/economy';
import { GIFT_DAYS, type Gift } from '../game/gift';
import { sound } from '../platform/sound';
import { haptic } from '../platform/telegram';
import { dialogBox } from './dialog';
import { el, openModal } from './dom';

export function showGift(gift: Gift): void {
  const { card, close } = openModal();
  card.append(el('h2', '', `🎁 ${t('gift.title')}`));
  const days = el('div', 'ui-gift-days');
  for (let d = 1; d <= GIFT_DAYS; d++) {
    const cell = el('div', `ui-gift-day${d < gift.day ? ' done' : ''}${d === gift.day ? ' today' : ''}${d === GIFT_DAYS ? ' big' : ''}`);
    cell.append(el('span', 'ui-gift-box', d < gift.day ? '✓' : '🎁'), el('span', '', t('gift.day', { n: d })));
    days.append(cell);
  }
  const rewards = [`+${gift.money} 💰`];
  if (gift.goods) rewards.push(`+${gift.goods.qty} × ${PRODUCTS[gift.goods.id].icon} ${t(PRODUCTS[gift.goods.id].nameKey)}`);
  if (gift.rating) rewards.push(`+${gift.rating}★`);
  const reward = el('div', 'ui-gift-reward', rewards.join('   '));
  card.append(
    days,
    dialogBox({
      portrait: 'portrait_grandma_happy',
      name: t('who.grandma'),
      text: `«${t(gift.day === GIFT_DAYS ? 'gift.textBig' : 'gift.text', { n: gift.day, total: GIFT_DAYS })}»`,
      pitch: 620,
      after: [reward],
      nextLabel: t('gift.take'),
      onNext: () => {
        sound.coin();
        haptic.success();
        close();
      },
    }),
  );
}
