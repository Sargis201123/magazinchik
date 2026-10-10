import { describe, expect, it } from 'vitest';
import { newGame, onShelves, warehouseOf, type StoreState } from '../src/game/economy';
import { answerCafe, CAFE_DAYS, CAFE_FROM_DAY, cafeCanDeliver, cafeDeliver, cafeMorning, cafeOf } from '../src/game/cafe';

const units = (n: number) => Array.from({ length: n }, () => ({ age: 0 }));
const shop = (patch: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  day: CAFE_FROM_DAY,
  money: 1000,
  warehouse: { bread: units(40), apples: units(40), potatoes: units(40) },
  ...patch,
});

describe('кафе «Пончик» по соседству', () => {
  it('с нужного дня приходит с предложением; отказ — придёт позже', () => {
    expect(cafeOf(cafeMorning(shop({ day: CAFE_FROM_DAY - 1 }), () => 0.3)).offer).toBeUndefined();
    const s = cafeMorning(shop(), () => 0.3);
    const offer = cafeOf(s).offer!;
    expect(Object.keys(offer.items).length).toBeGreaterThan(0);
    expect(offer.pay).toBeGreaterThan(0);
    const declined = answerCafe(s, false);
    expect(cafeOf(declined).offer).toBeUndefined();
    expect(cafeOf(declined).nextDay).toBeGreaterThan(s.day);
  });

  it('договор на неделю: каждое утро забирают заказ и платят, потом — новое предложение', () => {
    let s = answerCafe(cafeMorning(shop(), () => 0.3), true);
    const deal = cafeOf(s).deal!;
    expect(deal.until).toBe(s.day + CAFE_DAYS - 1);
    for (let i = 0; i < CAFE_DAYS; i++) {
      expect(cafeCanDeliver(s)).toBe(true);
      const before = s.money;
      const r = cafeDeliver(s);
      expect(r.result!.delivered).toBe(true);
      expect(r.state.money).toBe(before + deal.pay);
      s = { ...r.state, day: r.state.day + 1 };
      if (i === CAFE_DAYS - 1) expect(r.result!.ended).toBe('done');
    }
    expect(cafeOf(s).deal).toBeUndefined();
    expect(cafeOf(s).streak).toBe(1);
    // Следующее предложение — с надбавкой за верность.
    const again = cafeOf(cafeMorning(s, () => 0.3)).offer!;
    expect(again.pay).toBeGreaterThan(0);
  });

  it('не хватило товара — день не оплачен; два срыва — кафе уходит', () => {
    let s = answerCafe(cafeMorning(shop(), () => 0.3), true);
    s = { ...s, warehouse: {}, shelves: [] };
    const first = cafeDeliver(s);
    expect(first.result).toEqual({ delivered: false, pay: 0 });
    const second = cafeDeliver({ ...first.state, day: s.day + 1 });
    expect(second.result!.ended).toBe('canceled');
    expect(cafeOf(second.state).deal).toBeUndefined();
  });

  it('берут сначала со склада, потом с полок', () => {
    let s = answerCafe(cafeMorning(shop(), () => 0.3), true);
    const items = cafeOf(s).deal!.items;
    const [id, n] = Object.entries(items)[0] as [keyof typeof items, number];
    s = { ...s, warehouse: { ...s.warehouse, [id]: units(1) }, shelves: [{ kind: 'bakery', level: 1, items: {} }, { kind: 'produce', level: 1, items: { [id]: units(20) } }] };
    for (const [other] of Object.entries(items)) if (other !== id) s = { ...s, warehouse: { ...s.warehouse, [other]: units(20) } };
    const r = cafeDeliver(s).state;
    expect(warehouseOf(r, id)).toBe(0);
    expect(onShelves(r, id)).toBe(onShelves(s, id) - (n - 1));
  });
});
