// Лотерея у кассы в утреннем меню (game/lottery.ts, 13.11): плитка в «Уголках» — поставить стойку, что она
// приносит, запрет и «счастливые» дни; новость утра о счастливом билете или запрете (headlines.ts, 'lottery').
// 15.11, автор: «нет статистики — непонятно, кто что выиграл и получил ли игрок деньги». Теперь в карточке —
// как это работает одной строкой, таблица билетов и тиражей и последние выигрыши с именами.

import { staffName, t, type TextKey } from '../i18n';
import { STORE_LEVELS, type StoreState } from '../game/economy';
import {
  bonusEarned,
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
  ticketsToday,
  ticketsYesterday,
  WIN_BONUS,
  type LotteryState,
} from '../game/lottery';
import { button, el, kvTable } from './dom';
import { setItemIcon } from './sheet';

type Update = (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void;

const LUCKY_P = Math.round(LUCKY_GUESTS * 100);
/** Последний «счастливый» день. */
const luckyUntil = (state: StoreState): number => (state.lottery?.win?.day ?? state.day) + LUCKY_DAYS;

/** Картинка стойки по сегодняшнему виду: работает, закрыта по запрету, «счастливая». */
export const lotteryArt = (state: StoreState): string => {
  const look = lotteryLook(state);
  return look === 'closed' ? 'lottery_stand_closed' : look === 'lucky' ? 'lottery_stand_lucky' : 'lottery_stand';
};

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
  setItemIcon(img, lotteryArt(state));
  img.alt = '';
  const body = el('div');
  const actions = el('div', 'ui-item-actions');
  if (!hasLottery(state)) {
    const name = el('div', 'ui-item-name', t('lottery.stand'));
    name.append(el('span', 'ui-tag', `${LOTTERY_PRICE} 💰`));
    body.append(name);
    if (state.level < LOTTERY_MIN_LEVEL) body.append(el('div', 'ui-item-sub', t('lottery.lock', { name: t(STORE_LEVELS[LOTTERY_MIN_LEVEL].nameKey) })));
    else actions.append(button(t('lottery.buy'), () => update(buyLottery(getState()), 'success'), 'ui-chip', state.money < LOTTERY_PRICE));
  } else {
    // Как это работает — одной строкой на виду (длинные пояснения карточки прячутся за «❔»).
    body.append(el('div', 'ui-item-name', t('lottery.stand')), el('div', 'ui-item-sub', t('lottery.how', { n: TICKET_CUT })));
  }
  row.append(img, body, actions);
  box.append(row);
  const look = lotteryLook(state);
  if (look === 'closed') box.append(el('div', 'ui-note', t('lottery.banned', { d: state.lottery?.ban?.until ?? state.day })));
  if (look === 'lucky') box.append(el('div', 'ui-note', t('lottery.luckyNote', { until: luckyUntil(state), p: LUCKY_P })));
  if (state.lottery) box.append(...lotteryStats(state, state.lottery));
  box.append(el('div', 'ui-muted', t('lottery.odds', { bonus: WIN_BONUS, p: LUCKY_P })), el('div', 'ui-muted', t('lottery.risk')));
  return [box];
}

/** Лица счастливчиков в списке выигрышей (по номеру имени — у одного и того же имени одно лицо). */
const FACES = ['🧔', '👩', '👴', '👵', '🧑', '👱'];
const money = (n: number): string => n.toLocaleString('ru-RU');

/** Таблица билетов и тиражей и последние выигрыши: видно, что магазин получил и кому повезло. */
function lotteryStats(state: StoreState, lot: LotteryState): HTMLElement[] {
  const today = ticketsToday(state);
  const yesterday = ticketsYesterday(state);
  const rows: [string, string, boolean?][] = [];
  if (today) rows.push([t('lottery.st.today'), `${today} · +${today * TICKET_CUT} 💰`]);
  rows.push(
    [t('lottery.st.yesterday'), `${yesterday} · +${yesterday * TICKET_CUT} 💰`],
    [t('lottery.st.total'), String(lot.sold ?? 0)],
    [t('lottery.st.draws'), String(lot.draws ?? 0)],
    [t('lottery.st.wins'), t('lottery.st.winsV', { n: lot.wins ?? 0, sum: money(lot.prizes ?? 0) })],
  );
  if (lot.bigs) rows.push([t('lottery.st.bigs'), t('lottery.st.bigsV', { n: lot.bigs, sum: bonusEarned(state) })]);
  rows.push([t('lottery.st.earned'), `${ticketsEarned(state) + bonusEarned(state)} 💰`, true]);
  const out = [kvTable(t('lottery.stats'), rows)];
  const log = [...(lot.log ?? [])].reverse();
  if (log.length) {
    out.push(
      kvTable(
        t('lottery.log'),
        // Крупный — с пометкой вместо лица: строка сразу выделяется в списке.
        log.map((w) => [`${w.big ? t('lottery.logBig') : FACES[w.who % FACES.length]} ${t('lottery.logRow', { who: staffName(w.who), day: w.day })}`, `${money(w.prize)} 💰`]),
      ),
    );
  } else out.push(el('div', 'ui-item-sub', t('lottery.logNone')));
  // Что дал крупный выигрыш — пока «счастливые» дни идут, об этом и так говорит заметка выше.
  if (lot.bigs && lotteryLook(state) !== 'lucky') out.push(el('div', 'ui-note', t('lottery.bigGave', { bonus: WIN_BONUS, days: LUCKY_DAYS, p: LUCKY_P })));
  return out;
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
