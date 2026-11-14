// Жители района (game/residents.ts) в утреннем меню: новость о переезде над вкладками (одна за утро — headlines.ts)
// и строка в «Сегодня» — сколько семей и куда идёт район, с главной причиной. Файл — в сборке утреннего окна.

import { t, type TextKey } from '../i18n';
import type { StoreState } from '../game/economy';
import { regularById } from '../game/regulars';
import { RES_FROM, residents, residentsMood, residentsNews, residentsTrend, seeResidents } from '../game/residents';
import { button, el, who } from './dom';
import { FACES } from './returns';

type Update = (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void;

/** Утренняя карточка: кто въехал или уехал и что это значит для магазина. */
export function residentsBox(state: StoreState, getState: () => StoreState, update: Update): HTMLElement[] {
  const m = residentsNews(state);
  if (!m) return [];
  const up = m.dir > 0;
  const box = el('div', 'ui-box ui-tale');
  box.append(el('b', '', t(up ? 'res.in.title' : 'res.out.title')));
  const name = m.who ? t(regularById(m.who).nameKey) : '';
  if (m.who) {
    const label = el('div');
    label.append(el('b', '', name));
    box.append(who(FACES[m.who].replace(/^portrait_/, ''), label, true));
  }
  const text = m.who ? (m.back ? t('res.back', { name }) : t(`res.${up ? 'in' : 'out'}.${m.who}` as TextKey)) : t(`res.${up ? 'in' : 'out'}.${m.tale ?? 0}` as TextKey);
  box.append(el('p', '', text));
  if (m.who) box.append(el('div', up ? 'ui-note' : 'ui-muted', t(up ? 'res.note.regIn' : 'res.note.regOut', { name })));
  box.append(el('div', 'ui-muted', t(up ? 'res.note.in' : 'res.note.out', { n: residents(state) })));
  box.append(button(t(up ? 'res.ok.in' : 'res.ok.out'), () => update(seeResidents(getState()), up ? 'success' : 'tap')));
  return [box];
}

/** Строка «Сегодня»: сколько семей и, если район куда-то тянет, — куда и почему. */
export function residentsLines(state: StoreState): HTMLElement[] {
  // Первые недели район не меняется — и строки нет: новичку хватает своего.
  if (state.day < RES_FROM) return [];
  const n = residents(state);
  const trend = residentsTrend(state);
  if (!trend) return [el('div', 'ui-muted', t('res.line', { n }))];
  const why = t(`res.why.${residentsMood(state).why}.${trend > 0 ? 'up' : 'down'}` as TextKey);
  return [el('div', trend > 0 ? 'ui-note' : 'ui-muted', t(trend > 0 ? 'res.line.up' : 'res.line.down', { n, why }))];
}
