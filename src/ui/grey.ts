// Серая схема в утреннем окне (game/grey.ts): предложение Жоры — одна из новостей утра; «Попался» — отдельной
// карточкой до новостей (как штраф лицензии); строки сводки — опечатан сегодня, проверяющий «прикормлен».
// Подача без романтики (13.11, автор): в карточке прямо сказано, что это за поступок; «Отказать» — главная
// кнопка, сделка — блёклая, риск — красной строкой.

import { t, type TextKey } from '../i18n';
import { PRODUCTS, type StoreState } from '../game/economy';
import { answerGrey, greyCaught, greyCovered, greyOf, greyOffer, greySealed, seeGreyCaught } from '../game/grey';
import { button, el, who } from './dom';

type Update = (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void;

/** Тёмная карточка: эта история не из добрых — её видно сразу, ещё до текста. */
const darkBox = (): HTMLElement => {
  const box = el('div', 'ui-box');
  box.style.cssText = 'background: #ece6ef; border-color: #68386c;';
  return box;
};

const warn = (text: string): HTMLElement => {
  const note = el('div', 'ui-note', text);
  note.style.color = '#b13e53';
  return note;
};

/** Новость утра: Жора с предложением (очередь game/headlines.ts выбрала его сегодня). */
export function greyOfferBox(state: StoreState, getState: () => StoreState, update: Update): HTMLElement[] {
  const offer = greyOffer(state);
  if (!offer) return [];
  // Название товара посреди фразы — со строчной («Есть 🐟 рыба»), а не как заголовок с полки.
  const name = offer.product ? t(PRODUCTS[offer.product].nameKey) : '';
  const item = offer.product ? `${PRODUCTS[offer.product].icon} ${name.charAt(0).toLocaleLowerCase()}${name.slice(1)}` : '';
  const params = { item, n: offer.qty, price: offer.price, gain: offer.gain };
  const box = darkBox();
  box.append(
    el('h3', '', t('grey.title')),
    who('grey', el('b', '', t('grey.name'))),
    el('p', '', t(`grey.${offer.kind}` as TextKey, params)),
    el('div', 'ui-item-sub', t(`grey.deal.${offer.kind}` as TextKey, params)),
    warn(t('grey.risk')),
  );
  const deals = greyOf(state).deals ?? 0;
  if (deals) box.append(warn(t('grey.riskMore', { n: deals })));
  box.append(
    button(t('grey.no'), () => update(answerGrey(getState(), false), 'tap')),
    button(t(`grey.yes.${offer.kind}` as TextKey), () => update(answerGrey(getState(), true), 'tap'), 'ui-btn secondary'),
  );
  return [box];
}

/** Утро после «хвоста» сделки: попался — что случилось и чего это стоило (деньги уже списаны ночью). */
export function greyCaughtBox(state: StoreState, getState: () => StoreState, update: Update): HTMLElement | null {
  const c = greyCaught(state);
  if (!c) return null;
  const box = darkBox();
  box.append(
    el('h3', '', t('grey.caught.title')),
    who(c.kind === 'relabel' ? 'inspector_angry' : 'police', el('b', '', t(c.kind === 'relabel' ? 'echo.greyPoison.name' : 'echo.greyStolen.name'))),
    el('p', '', t(`grey.caught.${c.kind}` as TextKey)),
    warn(t('grey.caught.cost', { fine: c.fine })),
    button(t('grey.caught.ok'), () => update(seeGreyCaught(getState()), 'tap')),
  );
  return box;
}

/** Строки сводки утра: магазин опечатан до обеда; проверяющий «прикормлен». */
export function greyLines(state: StoreState): HTMLElement[] {
  const out: HTMLElement[] = [];
  if (greySealed(state)) out.push(warn(t('grey.sealed')));
  if (greyCovered(state)) out.push(el('div', 'ui-muted', t('grey.cover')));
  return out;
}
