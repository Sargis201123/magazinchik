// Беда района в утреннем окне (game/crisis.ts): соседка Валентина рассказывает, что стряслось, и три
// ответа — поднять цены, держать или держать и раздавать старикам; потом — строка «Сегодня» на дни беды,
// доброе имя района (goodwill.ts) и итог беды новостью утра (headlines.ts). Файл — в сборке утреннего окна.

import { t, type TextKey } from '../i18n';
import { PRODUCTS, type StoreState } from '../game/economy';
import { CRISES, CRISIS_MODES, crisisDaysLeft, crisisToday, giveUnits, type CrisisEnd, type CrisisMode } from '../game/crisis';
import { goodwillOf, goodwillTier } from '../game/goodwill';
import { button, el, who } from './dom';

const name = (kind: keyof typeof CRISES): string => t(`crisis.${kind}.name` as TextKey);
const staples = (kind: keyof typeof CRISES): string => CRISES[kind].staples.map((id) => PRODUCTS[id].icon).join('');

/** Утро беды, пока не решено, как быть (morning.ts — вместо меню, как утреннее событие). */
export function crisisChoiceBox(state: StoreState, choose: (mode: CrisisMode) => void): HTMLElement {
  const c = crisisToday(state)!;
  const box = el('div', 'ui-box');
  box.append(
    el('h3', '', `${CRISES[c.kind].icon} ${t(`crisis.${c.kind}.title` as TextKey)}`),
    who('valya_sad', el('b', '', t('who.valya'))),
    el('p', '', t(`crisis.${c.kind}.text` as TextKey, { n: crisisDaysLeft(state) })),
    el('div', 'ui-note', t('crisis.staples', { list: staples(c.kind) })),
  );
  for (const mode of CRISIS_MODES) {
    box.append(
      button(t(`crisis.mode.${mode}` as TextKey), () => choose(mode), mode === 'gouge' ? 'ui-btn secondary' : 'ui-btn'),
      el('div', 'ui-muted', t(`crisis.mode.${mode}.hint` as TextKey, { n: giveUnits(state.level) })),
    );
  }
  return box;
}

/** Итог беды — новостью утра: что решил район и насколько сдвинулось доброе имя. */
export function crisisEndBox(end: CrisisEnd, ok: () => void): HTMLElement[] {
  const box = el('div', 'ui-box ui-tale');
  box.append(
    el('b', '', `${CRISES[end.kind].icon} ${t('crisis.end.title')}`),
    who(end.mode === 'gouge' ? 'valya_angry' : 'valya_happy', el('b', '', t('who.valya')), true),
    el('p', '', t(`crisis.end.${end.mode}` as TextKey, { n: end.given, sold: end.sold })),
    el('div', end.delta >= 0 ? 'ui-note' : 'ui-muted', t(end.delta >= 0 ? 'crisis.end.up' : 'crisis.end.down', { n: Math.abs(end.delta) })),
    button(t('crisis.end.ok'), ok, 'ui-chip'),
  );
  return [box];
}

/** Строки «Сегодня»: идёт беда (сколько ещё, что разбирают, как торгуем) и доброе имя района, если о нём говорят. */
export function crisisLines(state: StoreState): HTMLElement[] {
  const out: HTMLElement[] = [];
  const c = crisisToday(state);
  if (c) {
    const params = { icon: CRISES[c.kind].icon, name: name(c.kind), n: crisisDaysLeft(state), list: staples(c.kind), mode: t(`crisis.now.${c.mode ?? 'hold'}` as TextKey) };
    out.push(el('div', 'ui-note', t('crisis.line', params)));
  }
  const g = goodwillOf(state);
  if (Math.abs(g) >= 5) out.push(el('div', 'ui-muted', t('goodwill.line', { tier: t(`goodwill.${goodwillTier(state)}` as TextKey), n: g > 0 ? `+${g}` : String(g) })));
  return out;
}
