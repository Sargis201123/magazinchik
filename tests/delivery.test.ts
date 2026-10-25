import { describe, expect, it } from 'vitest';
import { newGame, onShelves, warehouseOf, type StoreState } from '../src/game/economy';
import {
  CALLERS,
  DELIVERY_FEE,
  DELIVERY_RATING_START,
  deliveryDay,
  deliveryRating,
  makeHomeOrder,
  nextCallIn,
  ORDER_EVERY,
  orderUnits,
  outcomeFor,
  packHomeOrder,
  rateDelivery,
  ratingCalls,
  deliveryTip,
  TIPS,
  vehicleOf,
  VEHICLES,
} from '../src/game/delivery';
import { GEAR, gearAvailable, upgradeGear } from '../src/game/gear';
import { rng } from '../src/game/simulate';

// Доставка на дом: звонок, карточка, рейтинг доставки, чаевые за скорость и транспорт курьера.

const fresh = (n: number) => Array.from({ length: n }, () => ({ age: 0 }));
const shop = (patch: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  level: 2,
  money: 10_000,
  upgrades: ['delivery'],
  warehouse: { bread: fresh(20), apples: fresh(20), potatoes: fresh(20), milk: fresh(20) },
  ...patch,
});
const constant = (x: number) => () => x;

describe('заказ по телефону', () => {
  it('платят по ценам полки и наценку за доставку; кто звонит — один из портретов', () => {
    const order = makeHomeOrder(shop(), rng(3))!;
    const goods = order.items.reduce((sum, { id, qty }) => sum + shop().prices[id] * qty, 0);
    expect(order.pay).toBe(goods + DELIVERY_FEE);
    expect(order.caller).toBeGreaterThanOrEqual(0);
    expect(order.caller).toBeLessThan(CALLERS);
    expect(orderUnits(order)).toBe(order.items.reduce((sum, { qty }) => sum + qty, 0));
  });

  it('принятый заказ сразу откладывают со склада — второй раз то же не продать', () => {
    const s = shop({ warehouse: { bread: fresh(3) }, shelves: [{ kind: 'bakery', level: 0, items: {} }] });
    const order = { items: [{ id: 'bread' as const, qty: 3 }], pay: 3 * 40 + DELIVERY_FEE };
    const packed = packHomeOrder(s, order)!;
    expect(warehouseOf(packed, 'bread') + onShelves(packed, 'bread')).toBe(0);
    expect(packHomeOrder(packed, order)).toBeNull();
  });
});

describe('рейтинг доставки', () => {
  it('в старом сохранении его нет — четыре звезды', () => {
    expect(deliveryRating(newGame())).toBe(DELIVERY_RATING_START);
    expect(ratingCalls(newGame())).toBeCloseTo(1);
  });

  it('не ответить хуже, чем вежливо отказаться; быстрая доставка лучше обычной', () => {
    const s = shop();
    const r = (o: Parameters<typeof rateDelivery>[1]) => deliveryRating(rateDelivery(s, o));
    expect(r('missed')).toBeLessThan(r('declined'));
    expect(r('declined')).toBeLessThan(DELIVERY_RATING_START);
    expect(r('noStock')).toBeLessThan(DELIVERY_RATING_START);
    expect(r('fast')).toBeGreaterThan(r('delivered'));
    expect(r('delivered')).toBeGreaterThan(DELIVERY_RATING_START);
  });

  it('рейтинг не выходит за 1..5 и не копит дробный мусор', () => {
    let s = shop();
    for (let i = 0; i < 40; i++) s = rateDelivery(s, 'missed');
    expect(deliveryRating(s)).toBe(1);
    for (let i = 0; i < 40; i++) s = rateDelivery(s, 'fast');
    expect(deliveryRating(s)).toBe(5);
    s = rateDelivery(rateDelivery(shop(), 'delivered'), 'declined');
    expect(String(deliveryRating(s)).length).toBeLessThanOrEqual(4);
  });

  it('пропущенные звонки — звонят реже, хороший рейтинг — чаще', () => {
    let low = shop();
    for (let i = 0; i < 10; i++) low = rateDelivery(low, 'missed');
    const high = { ...shop(), deliveryRating: 5 };
    expect(nextCallIn(low, constant(0.5))).toBeGreaterThan(nextCallIn(shop(), constant(0.5)));
    expect(nextCallIn(high, constant(0.5))).toBeLessThan(nextCallIn(shop(), constant(0.5)));
  });
});

describe('чаевые за скорость', () => {
  it('быстро — больше, долго — ничего', () => {
    expect(deliveryTip(5)).toBe(TIPS[0][1]);
    expect(deliveryTip(TIPS[0][0])).toBe(TIPS[0][1]);
    expect(deliveryTip(TIPS[0][0] + 1)).toBe(TIPS[1][1]);
    expect(deliveryTip(TIPS[TIPS.length - 1][0] + 1)).toBe(0);
    expect(outcomeFor(deliveryTip(5))).toBe('fast');
    expect(outcomeFor(0)).toBe('delivered');
  });
});

describe('транспорт курьера', () => {
  it('без доставки улучшать нечего; велосипед → мопед → фургончик', () => {
    expect(gearAvailable(shop({ upgrades: [] }), 'courier')).toBe(false);
    expect(GEAR.courier.models).toHaveLength(VEHICLES.length);
    let s = shop();
    expect(vehicleOf(s).id).toBe('bike');
    s = upgradeGear(s, 'courier')!;
    expect(vehicleOf(s).id).toBe('scooter');
    s = upgradeGear(s, 'courier')!;
    expect(vehicleOf(s).id).toBe('van');
    expect(upgradeGear(s, 'courier')).toBeNull();
  });

  it('каждая следующая модель: быстрее или больше заказов, и звонят чаще', () => {
    for (let i = 1; i < VEHICLES.length; i++) {
      const [a, b] = [VEHICLES[i - 1], VEHICLES[i]];
      expect(b.calls).toBeGreaterThan(a.calls);
      expect(b.queue).toBeGreaterThan(a.queue);
      expect(b.carry >= a.carry && (b.speed > a.speed || b.carry > a.carry)).toBe(true);
    }
    const bike = shop();
    const van = shop({ gear: { courier: 2 } });
    expect(nextCallIn(van, constant(0.5))).toBeLessThan(nextCallIn(bike, constant(0.5)));
  });

  it('звонки — в пределах ORDER_EVERY с поправкой на транспорт и рейтинг', () => {
    const s = shop({ gear: { courier: 2 }, deliveryRating: 5 });
    const fastest = ORDER_EVERY[0] / (VEHICLES[2].calls * ratingCalls(s));
    for (let i = 0; i < 50; i++) expect(nextCallIn(s, Math.random)).toBeGreaterThanOrEqual(fastest - 1e-9);
  });
});

describe('день доставки (для симулятора)', () => {
  it('деньги = заказы + чаевые; товар уходит со склада; рейтинг меняется', () => {
    const s = shop();
    const day = deliveryDay(s, rng(7));
    expect(day.delivered).toBeGreaterThan(0);
    expect(day.state.money - s.money).toBe(day.pay);
    expect(day.tips).toBeLessThanOrEqual(day.delivered * TIPS[0][1]);
    const stock = (st: StoreState) => (['bread', 'apples', 'potatoes', 'milk'] as const).reduce((n, id) => n + warehouseOf(st, id) + onShelves(st, id), 0);
    expect(stock(s) - stock(day.state)).toBe(day.units);
    expect(deliveryRating(day.state)).not.toBe(deliveryRating(s));
  });

  it('выгодно, но не главный доход: наценка и чаевые за день — сотня-другая монет', () => {
    let extra = 0;
    const days = 40;
    for (let seed = 1; seed <= days; seed++) {
      const day = deliveryDay(shop(), rng(seed));
      extra += day.delivered * DELIVERY_FEE + day.tips;
    }
    const perDay = extra / days;
    expect(perDay).toBeGreaterThan(40);
    expect(perDay).toBeLessThan(300);
  });

  it('пустой магазин — звонить не о чем', () => {
    const day = deliveryDay(shop({ warehouse: {}, shelves: [] }), rng(1));
    expect(day.delivered + day.missed).toBe(0);
  });
});
