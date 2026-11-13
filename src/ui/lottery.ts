// Лотерея у кассы в утреннем меню (game/lottery.ts, 13.11): плитка в «Уголках» — поставить стойку, что она
// приносит, запрет и «счастливые» дни; новость утра о счастливом билете или запрете (headlines.ts, 'lottery').

import { t, type TextKey } from '../i18n';
import { STORE_LEVELS, type StoreState } from '../game/economy';
import {
  buyLottery,
  hasLottery,
  LOTTERY_MIN_LEVEL,
  LOTTERY_PRICE,
  lotteryLook,
  lotteryNews,
  luckyLeft,
  LUCKY_DAYS,
  LUCKY_GUESTS,
  seeLotteryNews,
  TICKET_CUT,
  ticketsEarned,
  WIN_BONUS,
} from '../game/lottery';
import { button, el } from './dom';
import { setItemIcon } from './sheet';

type Update = (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void;

const LUCKY_P = Math.round(LUCKY_GUESTS * 100);
/** Последний «счастливый» день. */
const luckyUntil = (state: StoreState): number => (state.lottery?.win?.day ?? state.day) + LUCKY_DAYS;

/** Что написать на плитке «Уголков»: цена, закрыта, «счастливая» или работает. */
export function lotteryStatus(state: StoreState): string {
  if (!hasLottery(state)) return state.level < LOTTERY_MIN_LEVEL ? '🔒' : `${LOTTERY_PRICE} 💰`;
  const look = lotteryLook(state);
  if (look === 'closed') return t('lottery.closedShort', { n: (state.lottery?.ban?.until ?? state.day) - state.day + 1 });
  return look === 'lucky' ? t('lottery.luckyShort', { n: luckyLeft(state) }) : t('lottery.open');
}

/** Подробности плитки: поставить стойку или как она работает сейчас. */
export function lotteryBox(state: StoreState, getState: () => StoreState, update: Update): HTMLElement[] {
  const box = el('div', 'ui-box');
  box.append(el('b', '', `🎟 ${t('lottery.title')}`), el('div', 'ui-muted', t('lottery.note', { n: TICKET_CUT })));
  const row = el('div', 'ui-item');
  const img = el('img', 'ui-item-art');
  setItemIcon(img, `lottery_stand${lotteryLook(state) === 'closed' ? '_closed' : lotteryLook(state) === 'lucky' ? '_lucky' : ''}`);
  img.alt = '';
  const body = el('div');
  const actions = el('div', 'ui-item-actions');
  if (!hasLottery(state)) {
    const name = el('div', 'ui-item-name', t('lottery.title'));
    name.append(el('span', 'ui-tag', `${LOTTERY_PRICE} 💰`));
    body.append(name);
    if (state.level < LOTTERY_MIN_LEVEL) body.append(el('div', 'ui-item-sub', t('lottery.lock', { name: t(STORE_LEVELS[LOTTERY_MIN_LEVEL].nameKey) })));
    else actions.append(button(t('lottery.buy'), () => update(buyLottery(getState()), 'success'), 'ui-chip', state.money < LOTTERY_PRICE));
  } else {
    body.append(el('div', 'ui-item-name', t('lottery.title')), el('div', 'ui-item-sub', t('lottery.sold', { n: state.lottery?.sold ?? 0, sum: ticketsEarned(state) })));
  }
  row.append(img, body, actions);
  box.append(row);
  const look = lotteryLook(state);
  if (look === 'closed') box.append(el('div', 'ui-note', t('lottery.banned', { d: state.lottery?.ban?.until ?? state.day })));
  if (look === 'lucky') box.append(el('div', 'ui-note', t('lottery.luckyNote', { until: luckyUntil(state), p: LUCKY_P })));
  box.append(el('div', 'ui-muted', t('lottery.odds', { bonus: WIN_BONUS, p: LUCKY_P })), el('div', 'ui-muted', t('lottery.risk')));
  return [box];
}

/** Новость утра: счастливый билет из нашего магазина или запрет города. */
export function lotteryNewsBox(state: StoreState, getState: () => StoreState, update: Update): HTMLElement[] {
  const kind = lotteryNews(state);
  if (!kind) return [];
  const box = el('div', 'ui-box ui-tale');
  // До какого дня: «счастливые» дни после тиража или запрет — числом дня, как везде в игре.
  const params = { bonus: WIN_BONUS, p: LUCKY_P, until: kind === 'win' ? luckyUntil(state) : (state.lottery?.ban?.until ?? state.day) };
  box.append(
    el('b', '', t(`lottery.${kind}.title` as TextKey)),
    el('p', '', t(`lottery.${kind}.text` as TextKey, params)),
    button(t(`lottery.${kind}.ok` as TextKey), () => update(seeLotteryNews(getState()), kind === 'win' ? 'success' : 'tap'), 'ui-btn'),
  );
  return [box];
}
