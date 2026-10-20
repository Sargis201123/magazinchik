import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { answerTale, canChoose, taleGuests, taleToday, TALES, TALE_GAP, talesMorning, talesOf } from '../src/game/tales';

const at = (day: number, patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day, money: 5000, ...patch });
const start = (s: StoreState, id: 'anya' | 'wedding' | 'busker'): StoreState => ({ ...s, tales: { done: [], current: { id, ep: 0, due: s.day } } });
const next = (s: StoreState, days: number): StoreState => ({ ...s, day: s.day + days });

describe('истории постоянных покупателей', () => {
  it('история начинается утром не раньше своего дня и не во время другой', () => {
    expect(talesMorning(at(3), () => 0).tales).toBeUndefined();
    const s = talesMorning(at(20), () => 0);
    expect(taleToday(s)).not.toBeNull();
    expect(talesMorning(s, () => 0)).toBe(s);
    expect(talesMorning(at(20), () => 0.99).tales).toBeUndefined();
  });

  it('Аня: одолжить 300 → вернёт 600 и приведёт друзей', () => {
    let s = start(at(10), 'anya');
    s = answerTale(s, 0)!;
    expect(taleToday(s)).toBeNull();
    s = next(s, 3);
    const money = s.money;
    s = answerTale(s, 0)!;
    expect(s.money).toBe(money - 300);
    s = next(s, 6);
    expect(taleToday(s)).toEqual({ id: 'anya', ep: 2 });
    s = answerTale(s, 0)!;
    expect(s.money).toBe(money + 300);
    expect(taleGuests(s)).toBeCloseTo(1.15);
    s = answerTale(next(s, 10), 0)!;
    expect(talesOf(s).done).toEqual(['anya']);
    expect(talesOf(s).current).toBeUndefined();
    expect(talesOf(s).nextAt).toBe(s.day + TALE_GAP);
  });

  it('свадьба: заказ нельзя отдать без хлеба, а если отдали — двойная цена', () => {
    let s = start(at(20), 'wedding');
    s = answerTale(next(answerTale(s, 0)!, 2), 0)!;
    s = next(s, 5);
    const order = TALES.wedding.episodes[2][0];
    expect(canChoose(s, order)).toBe(false);
    expect(answerTale(s, 0)).toBeNull();
    const bread = Array.from({ length: 40 }, () => ({ age: 0 }));
    s = { ...s, warehouse: { ...s.warehouse, bread } };
    const money = s.money;
    s = answerTale(s, 0)!;
    expect(s.money).toBe(money + 30 * 40 * 2);
    expect(s.warehouse.bread!.length + s.shelves.reduce((n, sh) => n + (sh.items.bread?.length ?? 0), 0)).toBeLessThan(44);
  });

  it('отказ Гоше — история кончается сразу', () => {
    const s = answerTale(start(at(15), 'busker'), 1)!;
    expect(talesOf(s).done).toEqual(['busker']);
    expect(taleGuests(s)).toBe(1);
  });
});
