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

/** Итог выезда одной строкой: продано, случай в дороге (incident), что привёз и что испортилось, бензин, итого. */
export function vanResultText(r: VanResult, incident = true): string {
  const parts = [t('van.sold', { icon: VAN_EVENTS[r.event].icon, n: r.sold, sum: r.revenue })];
  // В утренней новости случай уже рассказан своими словами — строкой итога его не повторяем.
  if (r.incident && incident) parts.push(t(`van.inc.${r.incident}` as TextKey, { n: Math.abs(r.extra) }));
  if (r.back) parts.push(t('van.back', { n: r.back }));
  if (r.spoiled) parts.push(t('van.spoiled', { n: r.spoiled }));
  parts.push(t('van.fuel', { n: r.fuel }), t('van.net', { n: signed(r.net) }));
  return parts.join(' · ');
}
