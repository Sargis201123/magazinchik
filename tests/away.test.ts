import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { AWAY_MAX_HOURS, awayTrade } from '../src/game/away';

const H = 3_600_000;
const unit = () => ({ age: 0 });
const shop = (patch: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  staff: [{ role: 'cashier', name: 0, skill: 1, wage: 420, months: 0 }] as StoreState['staff'],
  shelves: [{ kind: 'bakery', level: 0, items: { bread: Array.from({ length: 20 }, unit) } }],
  reports: [{ day: 1, sold: { bread: 30 }, missing: {} }] as unknown as StoreState['reports'],
  ...patch,
});

describe('пока игрока нет', () => {
  it('кассир продаёт с полок по ценам хозяина', () => {
    const s = shop();
    const r = awayTrade(s, 5 * H)!;
    // 30 в день × 4% × 5 часов = 6 штук.
    expect(r.units).toBe(6);
    expect(r.revenue).toBe(6 * s.prices.bread);
    expect(r.state.money).toBe(s.money + r.revenue);
    expect(r.state.shelves[0].items.bread).toHaveLength(14);
  });

  it('не больше 8 часов, не меньше часа, не больше, чем на полках', () => {
    expect(awayTrade(shop(), 100 * H)!.hours).toBe(AWAY_MAX_HOURS);
    expect(awayTrade(shop(), 0.5 * H)).toBeNull();
    const empty = shop({ shelves: [{ kind: 'bakery', level: 0, items: { bread: [unit()] } }] });
    expect(awayTrade(empty, 8 * H)!.units).toBe(1);
  });

  it('без кассира никто не торгует', () => {
    expect(awayTrade(shop({ staff: [] }), 8 * H)).toBeNull();
  });
});
