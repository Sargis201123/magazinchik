// Старые сохранения после упрощения закупки и продаж (02.11, docs/PLAN.md «Решено автором 02.11»):
// - электронные ценники (300) стали вечерней уценкой у всех — купившим деньги возвращаются;
// - «Автозаказ» (1200) стал бесплатным переключателем «Закупать сам» — купившим он остаётся включённым
//   (как и был), сам улучшения в списке больше нет;
// - «Акция дня» и договоры с поставщиками убраны — их поля просто забываются;
// - «Выгодная партия» в утреннем событии исчезает, заказ клиента без ответа переезжает на доску «Заказы».
// Оба магазина (Заречье держит второй в zar.away) — по одним правилам; деньги общие.

import type { StoreState } from './economy';
import type { ClientOrder } from './events';
import { RETIRED_UPGRADES } from './upgrades';

type Retired = keyof typeof RETIRED_UPGRADES;
type OldState = StoreState & { promo?: unknown; contracts?: unknown };
type OldEvent = { kind: string };

/** Убрать снятые улучшения из списка; сколько вернуть денег и был ли куплен автозаказ. */
function stripUpgrades(upgrades: readonly string[] | undefined): { upgrades?: StoreState['upgrades']; refund: number; auto: boolean } {
  if (!upgrades?.some((u) => u in RETIRED_UPGRADES)) return { upgrades: upgrades as StoreState['upgrades'], refund: 0, auto: false };
  return {
    upgrades: upgrades.filter((u) => !(u in RETIRED_UPGRADES)) as StoreState['upgrades'],
    refund: upgrades.includes('eTags') ? RETIRED_UPGRADES.eTags : 0,
    auto: upgrades.includes('autoOrder' satisfies Retired),
  };
}

function migratePlan(plan: StoreState['plan']): StoreState['plan'] {
  const event = plan?.event as OldEvent | undefined;
  if (!plan || !event || (event.kind !== 'deal' && event.kind !== 'order')) return plan;
  const { event: _event, ...rest } = plan;
  // Заказ клиента, на который ещё не ответили, ждёт на доске; «выгодная партия» — просто пропадает.
  if (event.kind === 'order' && !plan.decided) return { ...rest, offer: event as unknown as ClientOrder };
  return rest;
}

export function migrateBuying(state: StoreState): StoreState {
  const old = state as OldState;
  let next: OldState = old;
  if (old.promo !== undefined || old.contracts !== undefined) {
    const { promo: _promo, contracts: _contracts, ...rest } = old;
    next = rest;
  }
  const home = stripUpgrades(next.upgrades);
  let money = next.money + home.refund;
  let auto = home.auto;
  let zar = next.zar;
  if (zar?.away) {
    const away = stripUpgrades(zar.away.upgrades);
    money += away.refund;
    auto ||= away.auto;
    if (away.upgrades !== zar.away.upgrades) zar = { ...zar, away: { ...zar.away, upgrades: away.upgrades } };
  }
  const plan = migratePlan(next.plan);
  if (next === old && home.upgrades === next.upgrades && zar === next.zar && plan === next.plan) return state;
  return {
    ...next,
    money,
    ...(home.upgrades ? { upgrades: home.upgrades } : {}),
    ...(zar ? { zar } : {}),
    ...(plan ? { plan } : {}),
    // Купленный автозаказ остаётся как был; купили, но ни разу не трогали переключатель — включён.
    ...(auto ? { autoOrder: { ...next.autoOrder, on: next.autoOrder?.on ?? true } } : {}),
  };
}
