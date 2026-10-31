// «Приходи завтра»: что игра сообщает серверу вместе с прогрессом, чтобы бот напомнил о магазине
// по делу и от лица героя (api/_lib/remind.ts): Соня ждёт сцену, товар портится этой ночью,
// серия бабушкиных гостинцев, кассир торгует без хозяина, что ждёт в сундучке, от кого письмо и кто
// придёт за отложенным (returns.ts). Только флаги, числа и короткие метки — без сохранения.

import { canTradeAway } from './away';
import { dramaWaiting } from './drama';
import { expiringCount, type StoreState } from './economy';
import { waitingHooks } from './returns';

export interface Hooks {
  /** 1 — Соне есть что сказать (сцена ждёт сейчас или следующим утром). */
  sonya: number;
  /** Сколько штук испортится ближайшей ночью магазина. */
  spoil: number;
  /** Серия бабушкиных гостинцев: день серии и дата последнего (местная, «ГГГГ-ММ-ДД»). */
  streak: number;
  gift: string;
  /** 1 — нанят кассир: пока хозяина нет, он торгует и полки пустеют (away.ts). */
  cashier: number;
  /** День магазина — для «День 14: покупатели у дверей». */
  day: number;
  /** Сколько примерно накопится в сундучке выручки (округлено), 0 — нечему копиться. */
  chest: number;
  /** От кого письмо ждёт завтра: grandma, valya, sonya или постоянный покупатель; '' — нет. */
  letter: string;
  /** Кто придёт за отложенным и за чем: «petr:bread»; '' — нет; qty — сколько штук. */
  order: string;
  qty: number;
}

export function comebackHooks(state: StoreState): Hooks {
  return {
    sonya: dramaWaiting(state) ? 1 : 0,
    spoil: expiringCount(state),
    streak: state.gift?.streak ?? 0,
    gift: state.gift?.lastDate ?? '',
    cashier: canTradeAway(state) ? 1 : 0,
    day: state.day,
    ...waitingHooks(state),
  };
}
