// Хроники района в утреннем окне (game/arcs.ts): карточка шага истории с выбором и строки
// «Вести района» в сводке утра — что сейчас происходит в районе, договор с кафе Ахмеда,
// летний помощник и прибавка гостей. Как это выглядит на улице и в зале — scenes/arcsFx.ts.

import { t, type TextKey } from '../i18n';
import { PRODUCTS, staffOf, type StoreState } from '../game/economy';
import { ARC_DEAL, ARC_HELPER, ARCS, arcsOf, arcToday, canChooseArc, dealPay, helperRole, answerArc, type ArcChoice } from '../game/arcs';
import { button, el } from './dom';

type Update = (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void;

/** Параметры текста шага: сколько хлеба для кафе, сколько заплатят за товар к празднику. */
function params(choice?: ArcChoice): Record<string, number> {
  const sell = choice?.effect.sell;
  return {
    qty: ARC_DEAL.qty,
    pay: dealPay(),
    n: sell ? Math.round(PRODUCTS[sell[0]].basePrice * sell[1] * sell[2]) : 0,
  };
}

/** Карточка шага истории: что случилось и как поступить. */
export function arcBox(state: StoreState, getState: () => StoreState, update: Update): HTMLElement[] {
  const today = arcToday(state);
  if (!today) return [];
  const arc = ARCS[today.id];
  const beat = arc.beats[today.beat];
  if (!beat) return [];
  const key = (tail: string) => `arc.${today.id}.${today.beat}.${tail}` as TextKey;
  const box = el('div', 'ui-box ui-tale ui-arc');
  box.append(el('b', '', t('arc.title', { icon: arc.icon, name: t(`arc.${today.id}.name` as TextKey) })), el('p', '', t(key('text'), params())));
  beat.choices.forEach((choice, i) => {
    const ok = canChooseArc(state, choice);
    const need = choice.require;
    box.append(button(t(key(String(i)), params(choice)), () => update(answerArc(getState(), i), 'success'), i === 0 ? 'ui-btn' : 'ui-btn secondary', !ok));
    if (ok || !need) return;
    if (need.money !== undefined && state.money < need.money) box.append(el('div', 'ui-item-sub', t('arc.need.money', { n: need.money })));
    else if (need.product) box.append(el('div', 'ui-item-sub', `${PRODUCTS[need.product[0]].icon} ${t('arc.need.product', { n: need.product[1] })}`));
    else if (need.slot && !helperRole(state)) box.append(el('div', 'ui-item-sub', t('arc.need.slot')));
  });
  return [box];
}

/** Строки сводки утра: вести района, договор с кафе, помощник на лето, прибавка гостей. */
export function arcLines(state: StoreState): HTMLElement[] {
  const arcs = state.arcs;
  if (!arcs) return [];
  const out: HTMLElement[] = [];
  // Идущая история, шаг которой ещё впереди, — заметкой в газете (сам шаг — карточкой сверху).
  if (arcs.cur && !arcToday(state)) out.push(el('div', 'ui-muted', t('arc.newsHead', { text: t(`arc.${arcs.cur.id}.news` as TextKey) })));
  const deal = arcs.deal;
  if (deal) {
    out.push(
      el(
        'div',
        deal.next <= state.day ? 'ui-note' : 'ui-muted',
        deal.next <= state.day ? t('arc.deal.today', { qty: deal.qty }) : t('arc.deal.line', { qty: deal.qty, pay: deal.pay, left: deal.left }),
      ),
    );
  }
  if (arcs.helper && staffOf(state, arcs.helper.role)?.name === ARC_HELPER.name) out.push(el('div', 'ui-muted', t('arc.helper.line')));
  const boost = arcsOf(state).boost;
  if (boost && boost.until >= state.day) out.push(el('div', 'ui-muted', t('arc.boost', { p: Math.round(boost.pct * 100), n: boost.until - state.day + 1 })));
  return out;
}
