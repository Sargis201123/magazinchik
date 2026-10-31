// Окно «Бабушка прислала гостинец»: семь коробочек серии, сегодняшняя подпрыгивает, награда и «Забрать».

import { t } from '../i18n';
import { PRODUCTS } from '../game/economy';
import { GIFT_DAYS, type Gift, type GiftPreview } from '../game/gift';
import type { TextKey } from '../i18n/ru';
import { sound } from '../platform/sound';
import { music } from '../platform/music';
import { haptic } from '../platform/telegram';
import { dialogBox } from './dialog';
import { el, openModal } from './dom';

/** tomorrow — что будет завтра (gift.ts giftTomorrow): «Завтра — 3-й день подряд: банка варенья». */
export function showGift(gift: Gift, tomorrow?: GiftPreview | null): void {
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
  const after = [reward];
  if (tomorrow) {
    const treat = t(`gift.treat.${tomorrow.day}` as TextKey);
    after.push(el('div', 'ui-tomorrow', tomorrow.day === 1 ? t('gift.restart', { treat }) : t('gift.tomorrow', { n: tomorrow.day, treat })));
  }
  card.append(
    days,
    dialogBox({
      portrait: 'portrait_grandma_happy',
      name: t('who.grandma'),
      text: `«${t(gift.day === GIFT_DAYS ? 'gift.textBig' : 'gift.text', { n: gift.day, total: GIFT_DAYS })}»`,
      pitch: 620,
      after,
      nextLabel: t('gift.take'),
      onNext: () => {
        if (!music.sting('coin')) sound.coin();
        haptic.success();
        close();
      },
    }),
  );
}
