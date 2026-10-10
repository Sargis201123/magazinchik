// Банкротство. Если на счетах долг выше предела (стартовый долг и три месячных счёта без долга),
// банк присылает последнее предупреждение. Не уложился к следующим счетам — бабушка один раз
// за игру выручает и гасит половину долга. Во второй раз спасать некому: магазин закрывают,
// и игра начинается заново.

import { START_DEBT, monthlyBill, type StoreState } from './economy';

/** Сколько месячных счетов долга банк терпит сверх стартового долга. */
export const BANKRUPT_BILLS = 3;
/** Какую долю долга гасит бабушка. */
export const GRANDMA_SHARE = 0.5;

/** Обычный счёт месяца без платежей по долгам: аренда, коммуналка, свет и зарплаты. */
export function baseBill(state: StoreState): number {
  const b = monthlyBill(state);
  return b.rent + b.utilities + b.power + b.salaries;
}

/** Предел долга: выше — предупреждение, а потом закрытие. */
export const debtLimit = (state: StoreState): number => START_DEBT + BANKRUPT_BILLS * baseBill(state);

export type DebtOutcome = 'ok' | 'warning' | 'rescue' | 'bankrupt';

/** Что происходит после счетов. */
export function debtOutcome(state: StoreState): DebtOutcome {
  if (state.debt <= debtLimit(state)) return 'ok';
  if (!state.debtWarning) return 'warning';
  return state.grandmaRescue ? 'bankrupt' : 'rescue';
}

/** Вызывается сразу после оплаты счетов. */
export function afterBills(state: StoreState): StoreState {
  switch (debtOutcome(state)) {
    case 'ok':
      return state.debtWarning ? { ...state, debtWarning: undefined } : state;
    case 'warning':
      return { ...state, debtWarning: { seen: false } };
    case 'rescue': {
      const paid = Math.round(state.debt * GRANDMA_SHARE);
      return { ...state, debt: state.debt - paid, debtWarning: undefined, grandmaRescue: { paid, seen: false } };
    }
    case 'bankrupt':
      return { ...state, bankrupt: true };
  }
}

export const seeDebtWarning = (state: StoreState): StoreState =>
  state.debtWarning ? { ...state, debtWarning: { seen: true } } : state;

export const seeGrandmaRescue = (state: StoreState): StoreState =>
  state.grandmaRescue ? { ...state, grandmaRescue: { ...state.grandmaRescue, seen: true } } : state;
