import { describe, expect, it } from 'vitest';
import { newGame, onShelves, PRODUCTS, warehouseOf, type StoreState } from '../src/game/economy';
import {
  answerSpecial,
  BUSINESS_DISCOUNT,
  grannyRepays,
  KID_RATING,
  KIND_RATING,
  makeSpecial,
  REFUSE_RATING,
  SPECIAL_FROM_DAY,
  type SpecialVisit,
} from '../src/game/special';

const units = (n: number) => Array.from({ length: n }, () => ({ age: 0 }));
const shop = (patch: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  day: SPECIAL_FROM_DAY,
  money: 500,
  rating: 3,
  warehouse: { bread: units(20), apples: units(20), milk: units(20) },
  ...patch,
});
/** Случайность по списку: каждый вызов — следующее число. */
const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

describe('особые гости', () => {
  it('до нужного дня и при неудачном броске никто не приходит', () => {
    expect(makeSpecial(shop({ day: SPECIAL_FROM_DAY - 1 }), () => 0)).toBeNull();
    expect(makeSpecial(shop(), () => 0.99)).toBeNull();
  });

  it('бизнесмен берёт оптом со скидкой 20%: деньги сразу, товар уходит', () => {
    const s = shop();
    const visit = makeSpecial(s, seq(0, 0.1, 0, 0.5))!;
    expect(visit.kind).toBe('business');
    expect(visit.qty).toBeGreaterThanOrEqual(6);
    expect(visit.pay).toBe(Math.round(s.prices[visit.product] * visit.qty * BUSINESS_DISCOUNT));
    const r = answerSpecial(s, visit, true);
    expect(r.state.money).toBe(s.money + visit.pay);
    const stock = (x: StoreState) => warehouseOf(x, visit.product) + onShelves(x, visit.product);
    expect(stock(r.state)).toBe(stock(s) - visit.qty);
    // Отказ бизнесмену ничего не стоит.
    expect(answerSpecial(s, visit, false).state.rating).toBe(s.rating);
  });

  it('бабушка: дать в долг — рейтинг выше и она вернёт вдвое; отказать — рейтинг ниже', () => {
    const s = shop();
    const visit = makeSpecial(s, seq(0, 0.5))!;
    expect(visit).toMatchObject({ kind: 'granny', product: 'bread', pay: 0 });
    const kind = answerSpecial(s, visit, true);
    expect(kind.state.rating).toBeCloseTo(s.rating + KIND_RATING);
    expect(kind.state.grannyOwed).toBe(PRODUCTS.bread.basePrice);
    const back = grannyRepays(kind.state);
    expect(back.paid).toBe(PRODUCTS.bread.basePrice * 2);
    expect(back.state.money).toBe(kind.state.money + back.paid);
    expect(back.state.grannyOwed).toBe(0);
    expect(grannyRepays(back.state).paid).toBe(0);
    expect(answerSpecial(s, visit, false).state.rating).toBeCloseTo(s.rating - REFUSE_RATING);
  });

  it('ребёнок платит половину, рейтинг чуть растёт', () => {
    const s = shop();
    const visit = makeSpecial(s, seq(0, 0.9))!;
    expect(visit.kind).toBe('kid');
    expect(visit.pay).toBe(Math.max(1, Math.floor(s.prices[visit.product] / 2)));
    const r = answerSpecial(s, visit, true);
    expect(r.state.money).toBe(s.money + visit.pay);
    expect(r.state.rating).toBeCloseTo(s.rating + KID_RATING);
  });

  it('если товар кончился — согласие ничего не меняет', () => {
    const visit: SpecialVisit = { kind: 'business', product: 'apples', qty: 50, pay: 999 };
    const s = shop();
    expect(answerSpecial(s, visit, true).state).toBe(s);
  });
});
