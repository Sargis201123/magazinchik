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

  it('без истории продаж — поровну от гостей, с историей — по обычным продажам с запасом', () => {
    const s = start();
    expect(restockTarget(s, 'bread', 30)).toBeGreaterThan(0);
    const sold = { bread: 10 } as Record<string, number>;
    const withSales = start({ reports: [{ day: 1, sold, missing: {} }] as unknown as StoreState['reports'] });
    expect(restockTarget(withSales, 'bread', 30)).toBe(12);
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
