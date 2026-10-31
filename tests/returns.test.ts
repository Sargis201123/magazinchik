import { describe, expect, it } from 'vitest';
import { newGame, onShelves, warehouseOf, type StoreState } from '../src/game/economy';
import { awayTrade } from '../src/game/away';
import { claimGift, giftBase, giftTomorrow, GIFT_DAYS, GIFT_SCALE } from '../src/game/gift';
import { comebackHooks } from '../src/game/comeback';
import { REGULARS } from '../src/game/regulars';
import { ru } from '../src/i18n/ru';
import { en } from '../src/i18n/en';
import {
  chestEstimate,
  collectOrder,
  daysApart,
  LETTER_VARIANTS,
  letterCoins,
  letterKey,
  letterSenders,
  noteSeen,
  openChest,
  orderPay,
  orderQty,
  orderTeaser,
  planLetter,
  planOrder,
  roundSum,
  stashAway,
  takeLetter,
  waitingHooks,
} from '../src/game/returns';

const H = 3_600_000;
const unit = () => ({ age: 0 });
const shop = (patch: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  day: 10,
  staff: [{ role: 'cashier', name: 0, skill: 1, wage: 420, months: 0 }] as StoreState['staff'],
  shelves: [{ kind: 'bakery', level: 0, items: { bread: Array.from({ length: 20 }, unit) } }],
  reports: [{ day: 1, sold: { bread: 30 }, missing: {} }] as unknown as StoreState['reports'],
  ...patch,
});
/** Случайность по списку: каждое обращение — следующее число. */
const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

describe('сундучок выручки', () => {
  it('упаковывает торговлю без игрока: деньги не начисляются дважды, открыл — в кассу', () => {
    const s = shop();
    const away = awayTrade(s, 5 * H)!;
    const stashed = stashAway(away.state, { cashier: away.revenue, branch: 0, hours: away.hours, units: away.units });
    // Пока сундучок закрыт — денег в кассе как до отлучки, полки уже пустее.
    expect(stashed.money).toBe(s.money);
    expect(stashed.ret?.chest).toMatchObject({ sum: away.revenue, cashier: away.revenue, units: away.units, hours: 5 });
    const opened = openChest(stashed)!;
    expect(opened.state.money).toBe(s.money + away.revenue);
    expect(opened.state.ret?.chest).toBeUndefined();
    expect(openChest(opened.state)).toBeNull();
  });

  it('не открыл — копится дальше; филиал — отдельной строкой', () => {
    const once = stashAway(shop(), { cashier: 100, branch: 0, hours: 8, units: 4 });
    const twice = stashAway({ ...once, money: once.money + 300 }, { cashier: 0, branch: 300, hours: 8, units: 0 });
    expect(twice.ret?.chest).toEqual({ sum: 400, cashier: 100, branch: 300, hours: 16, units: 4 });
    expect(twice.money).toBe(once.money);
    expect(stashAway(shop(), { cashier: 0, branch: 0, hours: 2, units: 0 }).ret).toBeUndefined();
  });

  it('оценка для бота: накопится за 8 часов плюс уже лежащее; круглые числа', () => {
    const s = shop();
    expect(chestEstimate(s)).toBe(awayTrade(s, 8 * H)!.revenue);
    expect(chestEstimate({ ...s, staff: [] })).toBe(0);
    expect(roundSum(1234)).toBe(1200);
    expect(roundSum(87)).toBe(90);
    expect(roundSum(15_600)).toBe(16_000);
  });
});

describe('письма', () => {
  it('написано вечером — приходит только на следующий настоящий день', () => {
    const s = planLetter(shop(), '2026-10-30', seq(0.1, 0.5));
    expect(s.ret?.letter).toMatchObject({ from: 'grandma', date: '2026-10-30' });
    // Второе письмо, пока первое не дошло, не пишется.
    expect(planLetter(s, '2026-10-30', seq(0.9, 0.1)).ret?.letter).toEqual(s.ret?.letter);
    expect(takeLetter(s, '2026-10-30')).toBeNull();
    const got = takeLetter(s, '2026-10-31')!;
    expect(got.gift.money).toBe(letterCoins(s));
    expect(got.state.money).toBe(s.money + letterCoins(s));
    expect(got.state.ret?.letter).toBeUndefined();
  });

  it('постоянный покупатель — чуть больше доверия; только знакомые и не в обиде', () => {
    const s = shop({ day: 10, regulars: { petr: { loyalty: 3, awayUntil: 0 } } });
    expect(letterSenders(s)).toEqual(['grandma', 'valya', 'sonya', 'petr', 'sveta', 'kostya', 'akhmed']);
    expect(letterSenders({ ...s, day: 3, regulars: { petr: { loyalty: 1, awayUntil: 9 } } })).toEqual(['grandma', 'valya']);
    const letter = { ...s, ret: { letter: { from: 'petr' as const, n: 2, date: '2026-10-29' } } };
    const got = takeLetter(letter, '2026-10-30')!;
    expect(got.gift.loyalty).toBe('petr');
    expect(got.state.regulars?.petr.loyalty).toBe(4);
    expect(got.state.money).toBe(s.money);
  });

  it('у каждого варианта письма есть текст на обоих языках', () => {
    for (const [group, n] of Object.entries(LETTER_VARIANTS))
      for (let i = 1; i <= n; i++) {
        const from = group === 'regular' ? 'petr' : (group as 'grandma');
        const key = letterKey({ from, n: i });
        expect(ru[key], key).toBeTruthy();
        expect((en as Record<string, string>)[key], key).toBeTruthy();
      }
    for (let d = 1; d <= GIFT_DAYS; d++) expect(ru[`gift.treat.${d}` as keyof typeof ru]).toBeTruthy();
  });
});

describe('заказ соседа на завтра', () => {
  const petr = REGULARS.find((r) => r.id === 'petr')!;
  const morning = shop({ day: 10, warehouse: { bread: Array.from({ length: 10 }, unit) } });

  it('вечером сосед просит отложить любимый товар; видно в «Завтра:»', () => {
    const s = planOrder(morning, seq(0.1, 0));
    expect(s.ret?.order).toEqual({ who: 'petr', pid: petr.favorite, qty: orderQty(s), day: 10 });
    expect(orderTeaser(s)).toMatchObject({ key: 'ret.order.teaser', params: { name: 'regular.petr', qty: orderQty(s), pay: orderPay(s, s.ret!.order!) } });
    // Не каждый вечер и не в первые дни.
    expect(planOrder(morning, seq(0.9)).ret).toBeUndefined();
    expect(planOrder({ ...morning, day: 2 }, seq(0)).ret).toBeUndefined();
  });

  it('товар есть — забирает с полок и платит чуть сверх цены; нет — ждёт закрытия', () => {
    const s = planOrder(morning, seq(0.1, 0));
    const o = s.ret!.order!;
    const res = collectOrder(s)!;
    expect(res.paid).toBe(Math.round(s.prices.bread * 1.2) * o.qty);
    expect(res.state.money).toBe(s.money + res.paid);
    expect(onShelves(res.state, 'bread') + warehouseOf(res.state, 'bread')).toBe(30 - o.qty);
    expect(res.state.ret?.order).toBeUndefined();
    const empty = { ...s, shelves: [], warehouse: {} };
    const wait = collectOrder(empty)!;
    expect(wait).toMatchObject({ paid: 0, waiting: true });
    expect(wait.state.ret?.order).toEqual(o);
    // Заказ на завтра сегодня не выдаётся; устаревший — убирается.
    expect(collectOrder({ ...s, day: 9 })).toBeNull();
    expect(collectOrder({ ...s, day: 11 })!.state.ret?.order).toBeUndefined();
  });
});

describe('для бота и аналитики', () => {
  it('поводы: сумма сундучка, от кого письмо, кто придёт за чем', () => {
    const s = planLetter(planOrder(shop({ warehouse: { bread: [unit()] } }), seq(0.1, 0)), '2026-10-30', seq(0.1, 0));
    const h = comebackHooks(s);
    expect(h).toMatchObject({ letter: 'grandma', order: 'petr:bread', qty: orderQty(s), chest: roundSum(chestEstimate(s)) });
    expect(waitingHooks(newGame())).toEqual({ chest: 0, letter: '', order: '', qty: 0 });
  });

  it('через сколько дней вернулся', () => {
    expect(daysApart('2026-12-31', '2027-01-01')).toBe(1);
    const first = noteSeen(newGame(), '2026-10-30');
    expect(first.gap).toBeNull();
    expect(noteSeen(first.state, '2026-10-31').gap).toBe(1);
    expect(noteSeen(first.state, '2026-10-30').state).toBe(first.state);
  });
});

describe('завтрашний гостинец', () => {
  it('после сегодняшнего — следующий день серии; после седьмого — заново', () => {
    const s = shop({ level: 1 });
    const today = claimGift({ ...s, gift: { lastDate: '2026-10-29', streak: 2 } }, '2026-10-30', () => 0)!.state;
    expect(giftTomorrow(today, '2026-10-30')).toEqual({ day: 4, money: Math.round(giftBase(today) * GIFT_SCALE[3]), goods: false, rating: false });
    expect(giftTomorrow({ ...today, gift: { lastDate: '2026-10-30', streak: 2 } }, '2026-10-30')).toMatchObject({ day: 3, goods: true });
    expect(giftTomorrow({ ...today, gift: { lastDate: '2026-10-30', streak: 6 } }, '2026-10-30')).toMatchObject({ day: 7, rating: true });
    expect(giftTomorrow({ ...today, gift: { lastDate: '2026-10-30', streak: 7 } }, '2026-10-30')?.day).toBe(1);
    // Сегодняшний ещё не вручён — о завтрашнем рано.
    expect(giftTomorrow(s, '2026-10-30')).toBeNull();
  });
});
