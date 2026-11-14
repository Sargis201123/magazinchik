// Район подстраивается (game/districtPlots.ts, 13.11): утренняя новость «на углу начали стройку — и вот
// почему», строка «скоро участок застроят по продажам» и строка «почему именно это» в карточке открытия.

import { BUILDINGS, type BuildingId, type PlotPick } from '../game/district';
import { plotNews, plotPickOf, plotSoon } from '../game/districtPlots';
import { PRODUCTS, type ProductId, type StoreState } from '../game/economy';
import { t, type TextKey } from '../i18n';
import { button, el } from './dom';

/** «💧 71 · 🧃 72»: сколько за неделю взяли «своих» товаров здания (иконки на всех языках одни). */
const soldList = (pick: PlotPick): string =>
  Object.entries(pick.sold ?? {})
    .filter(([, n]) => n > 0)
    .map(([id, n]) => `${id === 'coffee' ? '☕' : PRODUCTS[id as ProductId].icon} ${n}`)
    .join(' · ') || '—';

const named = (id: BuildingId) => ({ icon: BUILDINGS[id].icon, name: t(`district.${id}` as TextKey) });
const why = (id: BuildingId) => t(`district.why.${id}` as TextKey);

/** Новость утра: на участке начали стройку, и район выбрал это здание по нашим продажам. */
export function plotNewsBox(state: StoreState, ok: () => void): HTMLElement[] {
  const news = plotNews(state);
  if (!news) return [];
  const { pick } = news;
  const box = el('div', 'ui-box ui-tale');
  box.append(
    el('b', '', t('district.plot.title', named(pick.id))),
    el('p', '', t('district.plot.text', { why: why(pick.id), list: soldList(pick), n: pick.from + BUILDINGS[pick.id].build - state.day })),
    button(t('district.plot.ok'), ok, 'ui-chip'),
  );
  return [box];
}

/** В карточке открытия: почему открылось именно это (если выбирали по продажам). */
export function plotWhy(state: StoreState, id: BuildingId): HTMLElement[] {
  const pick = plotPickOf(state, id);
  return pick ? [el('div', 'ui-muted', t('district.plot.because', { ...named(id), why: why(id), list: soldList(pick) }))] : [];
}

/** Строка утра за неделю до стройки: участок застроят по продажам — можно успеть повлиять. */
export function plotSoonLine(state: StoreState): HTMLElement[] {
  const days = plotSoon(state);
  return days ? [el('div', 'ui-muted', t('district.plot.soon', { n: days }))] : [];
}
