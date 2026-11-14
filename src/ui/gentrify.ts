// Район дорожает (game/gentrify.ts) в утреннем окне: выбор «для кого магазин», когда престиж дорос (вместо меню, как
// «крыша»: решить сразу), и строка «Сегодня» — престиж района и насколько подорожали счета и прайс. Файл — в сборке
// утреннего окна, не в основном коде.

import { t } from '../i18n';
import type { StoreState } from '../game/economy';
import { GENT_GOODWILL, GENT_SEEN, gentChoice, gentRises, prestigeOf, type GentChoice } from '../game/gentrify';
import { inZar } from '../game/zarshop';
import { button, el, who } from './dom';

/** Карточка выбора: соседка Валентина рассказывает, что творится в районе, и два ответа с ценой каждого. */
export function gentChoiceBox(state: StoreState, choose: (c: GentChoice) => void): HTMLElement {
  const box = el('div', 'ui-box');
  box.append(el('h3', '', t('gent.title')), who('valya_surprised', el('b', '', t('who.valya'))), el('p', '', t('gent.text', { n: prestigeOf(state) })));
  // «Для новых» — не зелёная «правильная» кнопка: деньги ценой своих, выбор взрослого.
  box.append(
    button(t('gent.rich'), () => choose('rich'), 'ui-btn secondary'),
    el('div', 'ui-muted', t('gent.rich.hint', { n: GENT_GOODWILL })),
    button(t('gent.own'), () => choose('own')),
    el('div', 'ui-muted', t('gent.own.hint', { n: GENT_GOODWILL })),
  );
  return box;
}

/** Строка «Сегодня»: престиж района, что подорожало и (после ответа) для кого магазин. */
export function gentLines(state: StoreState): HTMLElement[] {
  const n = prestigeOf(state);
  if (inZar(state) || n < GENT_SEEN) return [];
  const { rent, supply } = gentRises(state);
  const c = gentChoice(state);
  const line = el('div', 'ui-muted', t('gent.line', { n, rent, supply }));
  if (c) line.append(el('br'), t(c === 'rich' ? 'gent.line.rich' : 'gent.line.own'));
  return [line];
}
