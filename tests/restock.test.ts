import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { bestOffer, restockPlan, restockTarget } from '../src/game/restock';

const start = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), money: 5000, ...patch });

describe('«Закупить нужное»', () => {
  it('берёт у того, у кого дешевле', () => {
    const s = start();
    const price = (sid: string) => (sid === 'dairy' ? 30 : 40);
    expect(bestOffer(s, 'milk', price)).toEqual({ sid: 'dairy', price: 30 });
    // Оптовик закрыт, пока нет полки его отдела: его цену не берём даже самую низкую.
    expect(bestOffer(s, 'milk', (sid) => (sid === 'wholesale' ? 1 : 40))?.sid).not.toBe('wholesale');
  });

  it('цель — по модели спроса и по продажам (что больше), с запасом, но не больше места на полках', () => {
    const s = start();
    const base = restockTarget(s, 'bread', 30);
    expect(base).toBeGreaterThan(0);
    // Больше гостей — больше нужно.
    expect(restockTarget(s, 'bread', 60)).toBeGreaterThanOrEqual(base);
    const report = (n: number) => start({ reports: [{ day: 1, sold: { bread: n }, missing: {} }] as unknown as StoreState['reports'] });
    // Продавали много — берём не меньше обычных продаж с запасом.
    expect(restockTarget(report(10), 'bread', 1)).toBeGreaterThanOrEqual(12);
    // Но и не больше, чем встанет на полки плюс пара походов со склада.
    expect(restockTarget(report(500), 'bread', 1)).toBeLessThan(500);
  });

  it('заказ дня и договор с кафе докупаются сверху', () => {
    // Склад побольше, чтобы всё влезло.
    const s = start({ level: 2 });
    const plain = restockPlan(s, () => 10, 30).lines.find((l) => l.pid === 'bread')?.qty ?? 0;
    const withCafe = restockPlan({ ...s, cafe: { deal: { items: { bread: 7 } } } } as unknown as StoreState, () => 10, 30).lines.find((l) => l.pid === 'bread')?.qty ?? 0;
    expect(withCafe).toBe(plain + 7);
  });

  it('докупает только недостающее, сначала самое пустое, в пределах денег', () => {
    const s = start();
    const plan = restockPlan(s, () => 10, 30);
    expect(plan.lines.length).toBeGreaterThan(0);
    for (const line of plan.lines) expect(line.qty).toBeGreaterThan(0);
    expect(plan.total).toBe(plan.lines.reduce((sum, l) => sum + l.qty * l.price, 0));
    const poor = restockPlan({ ...s, money: 25 }, () => 10, 30);
    expect(poor.total).toBeLessThanOrEqual(25);
    expect(poor.cut).toBe(true);
  });
});
