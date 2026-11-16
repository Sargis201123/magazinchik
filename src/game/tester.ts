// Режим тестировщика (16.11, автор: «Начисли мне 10 млн монет — чтоб тестировать всё, что возможно»).
// Сохранение живёт на телефоне, сервер его не правит, поэтому монеты выдаёт сама игра — по кнопке в
// «Развитии» (ui/tester.ts), а кнопки видны только «своим»: сервер сверил номер Telegram с TESTER_IDS
// (api/_lib/tester.ts, platform/tester.ts). Здесь — только чистые правила: сколько, куда и пометка.

import type { StoreState } from './economy';

/** Кнопки раздела «🧪 Тестер»: сколько монет кладёт каждая. */
export const TESTER_GRANTS = [10_000_000, 1_000_000] as const;
/** Больше миллиарда в кассе не кладём: счётчик сверху остаётся коротким, а в отчёте сервера — честное целое. */
export const TESTER_MONEY_CAP = 1_000_000_000;

/** Пометить сохранение: навсегда, сервер по ней не пускает магазин в рейтинги (api/_lib/stats.ts). */
export const markTester = (state: StoreState): StoreState => (state.tester ? state : { ...state, tester: true });

/**
 * Положить монеты тестеру: amount сверху (не выше TESTER_MONEY_CAP), долг гасится — иначе арендодатель
 * не даёт расширяться и проверять дальше нечего. Кредит банка не трогаем: его гасят по правилам bank.ts.
 */
export function grantTester(state: StoreState, amount: number): StoreState {
  const add = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  const money = Number.isFinite(state.money) ? state.money : 0;
  return { ...markTester(state), money: Math.max(money, Math.min(TESTER_MONEY_CAP, money + add)), debt: 0 };
}

/**
 * Монеты для счётчика сверху: до миллиона — как раньше, цифрами подряд; дальше — с узкими пробелами по
 * разрядам («10 000 000»), иначе восемь цифр подряд не читаются на телефоне.
 */
export function moneyLabel(value: number): string {
  const n = Math.round(value);
  if (Math.abs(n) < 1_000_000) return String(n);
  return `${n < 0 ? '-' : ''}${String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
}
