// Упрощение закупки и продаж (02.11): старые сохранения, доска «Заказы», вечерняя уценка у всех.
import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { migrateBuying } from '../src/game/buyMigrate';
import { RETIRED_UPGRADES, UPGRADE_IDS } from '../src/game/upgrades';
import { declineNeighbour, giveNeighbour, orderBoard } from '../src/game/orders';
import { answerOrder, type ClientOrder } from '../src/game/events';
import { orderPay } from '../src/game/returns';
import { restockPlan } from '../src/game/restock';
import { cafePay } from '../src/game/cafe';

const units = (n: number) => Array.from({ length: n }, () => ({ age: 0 }));
const shop = (patch: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  day: 10,
  level: 1,
  money: 1000,
  warehouse: { milk: units(5) },
  shelves: [
    { kind: 'bakery', level: 0, items: { bread: units(4) } },
    { kind: 'dairy', level: 0, items: { milk: units(3) } },
  ],
  plan: { day: 10, decided: false, inspection: false, quests: [] },
  ...patch,
});
const order: ClientOrder = { kind: 'order', client: 'school', product: 'milk', qty: 6, pay: 78 };

describe('старые сохранения (02.11)', () => {
  it('электронные ценники убираются с возвратом денег, автозаказ остаётся включённым', () => {
    const old = shop({ upgrades: ['cart', 'eTags', 'autoOrder'], autoOrder: undefined });
    const s = migrateBuying(old);
    expect(s.upgrades).toEqual(['cart']);
    expect(s.money).toBe(old.money + RETIRED_UPGRADES.eTags);
    expect(s.autoOrder?.on).toBe(true);
    // Выключенный игроком — остаётся выключенным.
    expect(migrateBuying(shop({ upgrades: ['autoOrder'], autoOrder: { on: false } })).autoOrder?.on).toBe(false);
    // Снятых улучшений в списке больше нет.
    for (const id of Object.keys(RETIRED_UPGRADES)) expect(UPGRADE_IDS).not.toContain(id);
  });

  it('второй магазин (Заречье) — по тем же правилам, деньги общие', () => {
    const base = shop({ upgrades: [] });
    const old = { ...base, zar: { at: 'home', since: 1, away: { upgrades: ['eTags'] } } } as unknown as StoreState;
    const s = migrateBuying(old);
    expect(s.money).toBe(base.money + RETIRED_UPGRADES.eTags);
    expect(s.zar?.away.upgrades).toEqual([]);
  });

  it('автозаказ и план дня — у каждого магазина свои: включается только там, где его купили', () => {
    const away = { upgrades: ['autoOrder'], plan: { day: 10, decided: false, inspection: false, quests: [], event: order } };
    const old = { ...shop({ upgrades: [] }), zar: { at: 'home', since: 1, away } } as unknown as StoreState;
    const s = migrateBuying(old);
    expect(s.autoOrder?.on).toBeFalsy();
    expect(s.zar?.away.autoOrder?.on).toBe(true);
    expect(s.zar?.away.plan?.event).toBeUndefined();
    expect(s.zar?.away.plan?.offer).toEqual(order);
  });

  it('акция дня и договоры забываются; «выгодная партия» пропадает, заказ без ответа — на доску', () => {
    const old = { ...shop(), promo: { day: 10, product: 'bread', kind: 'bogo' }, contracts: [{ sid: 'farmer', pid: 'bread', qty: 5, until: 12 }] } as unknown as StoreState;
    const s = migrateBuying(old) as StoreState & { promo?: unknown; contracts?: unknown };
    expect(s.promo).toBeUndefined();
    expect(s.contracts).toBeUndefined();
    const deal = migrateBuying({ ...shop(), plan: { ...shop().plan!, event: { kind: 'deal', supplier: 'dairy', product: 'milk', qty: 10, price: 18 } } } as unknown as StoreState);
    expect(deal.plan?.event).toBeUndefined();
    const asked = migrateBuying({ ...shop(), plan: { ...shop().plan!, event: order } } as unknown as StoreState);
    expect(asked.plan?.event).toBeUndefined();
    expect(asked.plan?.offer).toEqual(order);
  });

  it('новое сохранение не трогает', () => {
    const s = shop();
    expect(migrateBuying(s)).toBe(s);
  });
});

describe('доска «Заказы»', () => {
  it('пусто — строк нет; заказ клиента: принять — заберут вечером, отказать — уходит', () => {
    expect(orderBoard(shop())).toEqual([]);
    const s = shop({ plan: { ...shop().plan!, offer: order } });
    expect(orderBoard(s)).toEqual([{ kind: 'client', order, accepted: false, ready: true }]);
    const yes = answerOrder(s, true)!;
    expect(yes.plan?.order).toEqual(order);
    expect(orderBoard(yes)).toEqual([{ kind: 'client', order, accepted: true, ready: true }]);
    const no = answerOrder(s, false)!;
    expect(no.plan?.order).toBeUndefined();
    expect(orderBoard(no)).toEqual([]);
  });

  it('сосед «отложи мне»: отдать — платит +20%, не хватает — нельзя; отказать — заказ снят', () => {
    const n = { who: 'sveta' as const, pid: 'milk' as const, qty: 6, day: 10 };
    const s = shop({ ret: { order: n } });
    const row = orderBoard(s)[0];
    expect(row).toMatchObject({ kind: 'neighbour', ready: true, pay: orderPay(s, n) });
    const given = giveNeighbour(s)!;
    expect(given.paid).toBe(orderPay(s, n));
    expect(given.state.money).toBe(s.money + given.paid);
    expect(given.state.ret?.order).toBeUndefined();
    expect(giveNeighbour(shop({ ret: { order: { ...n, qty: 20 } } }))).toBeNull();
    expect(declineNeighbour(s).ret?.order).toBeUndefined();
    // «Закупить нужное» докупает и под заказ соседа.
    const price = () => 10;
    const need = (st: StoreState) => restockPlan(st, price, 30).lines.find((l) => l.pid === 'milk')?.qty ?? 0;
    expect(need(shop({ ret: { order: { ...n, qty: 20 } } }))).toBeGreaterThan(need(shop()));
  });

  it('«хватает» считает обещанное другим: принятый заказ и сосед на один товар не делят одни штуки', () => {
    // 8 штук молока: клиенту обещано 6, соседу нужно 4 — хватает только одному.
    const s = shop({ plan: { ...shop().plan!, order }, ret: { order: { who: 'sveta', pid: 'milk', qty: 4, day: 10 } } });
    const rows = orderBoard(s);
    expect(rows.find((r) => r.kind === 'neighbour')).toMatchObject({ ready: false });
    expect(rows.find((r) => r.kind === 'client')).toMatchObject({ ready: false });
    const alone = orderBoard(shop({ plan: { ...shop().plan!, order } }));
    expect(alone[0]).toMatchObject({ kind: 'client', ready: true });
  });

  it('кафе и хлеб соседям — тоже на доске; кафе платит как раньше', () => {
    const offer = { items: { bread: 4 }, pay: cafePay(shop(), { bread: 4 }), day: 10 };
    const s = shop({ cafe: { nextDay: 10, streak: 0, offer }, upgrades: ['oven'] });
    const kinds = orderBoard(s).map((r) => r.kind);
    expect(kinds).toEqual(['cafeOffer', 'bread']);
    expect(orderBoard({ ...s, upgrades: ['oven', 'wholesale'] }).find((r) => r.kind === 'bread')).toMatchObject({ owned: true });
  });
});
