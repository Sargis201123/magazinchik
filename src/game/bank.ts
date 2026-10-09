// Банк: кредит на рост. Берёшь сразу, возвращаешь с процентом за четыре месяца — платёж
// приходит вместе со счетами. Быстрее расширишься, но если продажи упадут — не хватит на счета,
// и недостача уйдёт в долг с пени (как с любыми счетами).

import type { StoreState } from './economy';

/** Сколько даёт банк в каждом помещении: чем больше магазин, тем больше доверие. */
export const LOAN_LIMITS = [800, 1500, 3000, 6000, 10000];
/** Переплата за весь срок и на сколько месяцев. */
export const LOAN_INTEREST = 0.2;
export const LOAN_MONTHS = 4;

export const loanLimit = (state: StoreState): number => LOAN_LIMITS[Math.min(state.level, LOAN_LIMITS.length - 1)];
/** Варианты суммы: половина лимита и весь лимит. */
export const loanOptions = (state: StoreState): number[] => [Math.round(loanLimit(state) / 2 / 100) * 100, loanLimit(state)];
export const loanTotal = (amount: number): number => Math.round(amount * (1 + LOAN_INTEREST));
export const loanPayment = (amount: number): number => Math.ceil(loanTotal(amount) / LOAN_MONTHS);

/** Взять кредит: один за раз. */
export function takeLoan(state: StoreState, amount: number): StoreState | null {
  if (state.loan || !loanOptions(state).includes(amount)) return null;
  return { ...state, money: state.money + amount, loan: { left: loanTotal(amount), payment: loanPayment(amount) } };
}

/** Вернуть досрочно (сколько есть, но не больше остатка). Проценты уже посчитаны — скидки нет. */
export function repayLoan(state: StoreState, amount: number): StoreState | null {
  const loan = state.loan;
  const pay = Math.min(amount, loan?.left ?? 0, state.money);
  if (!loan || pay <= 0) return null;
  const left = loan.left - pay;
  return { ...state, money: state.money - pay, loan: left > 0 ? { ...loan, left } : undefined };
}

/** Платёж в этом месяце (идёт в счета). */
export const loanDue = (state: StoreState): number => (state.loan ? Math.min(state.loan.payment, state.loan.left) : 0);

/** После оплаты счетов: остаток уменьшается на платёж (неоплаченное ушло в долг вместе со счетами). */
export function afterLoanPayment(state: StoreState, paid: number): StoreState {
  const loan = state.loan;
  if (!loan || paid <= 0) return state;
  const left = loan.left - paid;
  return { ...state, loan: left > 0 ? { ...loan, left } : undefined };
}
