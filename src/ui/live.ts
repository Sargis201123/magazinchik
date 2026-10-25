// Окно праздничной открытки (game/live.ts): картинка, тёплая строчка от героя, подарок и — если
// набралось открыток — праздничная вещь, которая уже стоит в зале.

import { t } from '../i18n';
import type { TextKey } from '../i18n/ru';
import { decorItem } from '../game/decor';
import type { CardGift, GuestId, LiveTheme } from '../game/live';
import { assetUrl } from '../platform/assets';
import { music } from '../platform/music';
import { sound } from '../platform/sound';
import { haptic } from '../platform/telegram';
import { dialogBox } from './dialog';
import { el, openModal } from './dom';

export const THEME_ICON: Record<LiveTheme, string> = { newyear: '🎄', feb23: '🎖', march8: '🌷' };
export const GUEST_ICON: Record<GuestId, string> = { moroz: '🎅', snegurochka: '❄️' };

/** Кто «подписал» открытку праздника: портрет и имя. */
const CARD_FROM: Record<LiveTheme, { portrait: string; who: TextKey; pitch: number }> = {
  newyear: { portrait: 'portrait_snegurochka_happy', who: 'who.snegurochka', pitch: 700 },
  feb23: { portrait: 'portrait_grandma_happy', who: 'who.grandma', pitch: 620 },
  march8: { portrait: 'portrait_valya_happy', who: 'who.valya', pitch: 600 },
};

/** Дата для людей: «7 декабря» / «December 7». */
export const dateLabel = (date: string): string => t('live.date', { d: Number(date.slice(8)), m: t(`live.m.${Number(date.slice(5, 7))}` as TextKey) });

export function showLiveCard(theme: LiveTheme, gift: CardGift): void {
  const { card, close } = openModal();
  const from = CARD_FROM[theme];
  card.append(el('h2', '', `${THEME_ICON[theme]} ${t('live.card.title', { n: gift.n, total: gift.total })}`));
  const art = el('img', 'ui-live-card');
  art.src = assetUrl(`assets/${gift.art}.png`);
  art.alt = '';
  card.append(art);
  const after = [el('div', 'ui-gift-reward', `+${gift.coins} 💰`)];
  if (gift.prize) after.push(el('div', 'ui-note', t('live.card.prize', { item: t(decorItem(gift.prize).nameKey) })));
  card.append(
    dialogBox({
      portrait: from.portrait,
      name: t(from.who),
      text: `«${t(gift.line)}»`,
      pitch: from.pitch,
      after,
      nextLabel: t('live.card.take'),
      onNext: () => {
        if (!music.sting('coin')) sound.coin();
        haptic.success();
        close();
      },
    }),
  );
}
