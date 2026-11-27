// Строки выездной торговли (game/van.ts), нужные и в зале (итоги дня, nightShift.ts), и в утреннем окне
// (ui/van.ts): отдельным маленьким модулем, чтобы итоги дня не тянули за собой всё окно фургона.

import { t, type TextKey } from '../i18n';
import type { StoreState } from '../game/economy';
import { nearMatch, VAN_EVENTS, type VanEventId, type VanResult } from '../game/van';

/** «+820» / «−40»: итог выезда бывает и в минус (дождь на пляже, бензин). */
export const signed = (n: number): string => (n >= 0 ? `+${n}` : `−${-n}`);

/** Название события: матч — на своём стадионе или в соседнем районе. */
export const vanEventName = (state: StoreState, id: VanEventId): string =>
  t(id === 'match' && !nearMatch(state) ? 'van.ev.matchFar' : (`van.ev.${id}` as TextKey));

/** Итог выезда одной строкой: продано, товар по закупке, бензин, итого (случай в дороге — своей строкой, vanRoadText). */
export function vanResultText(r: VanResult): string {
  const parts = [t('van.sold', { icon: VAN_EVENTS[r.event].icon, n: r.sold, sum: r.revenue })];
  if (r.goods) parts.push(t('van.goods', { n: r.goods }));
  parts.push(t('van.fuel', { n: r.fuel }), t('van.net', { n: signed(r.net) }));
  return parts.join(' · ');
}

/** Случай в дороге (пробка, колесо, щедрый покупатель, дождь на пляже) — строкой в итогах дня; не было — null. */
export const vanRoadText = (r: VanResult): string | null => (r.incident ? t(`van.inc.${r.incident}` as TextKey, { n: Math.abs(r.extra) }) : null);
