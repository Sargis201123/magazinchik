import { describe, expect, it } from 'vitest';
import { acceptsPrice, MAX_LOYALTY, recordVisit, regularById, regularState, regularsToday, START_LOYALTY, tipFor } from '../src/game/regulars';
import { newGame } from '../src/game/economy';

describe('regulars', () => {
  it('знакомимся постепенно: в первый день никого, потом Пётр Ильич', () => {
    expect(regularsToday({ ...newGame(), day: 1 })).toEqual([]);
    expect(regularsToday({ ...newGame(), day: 2 }).map((r) => r.id)).toEqual(['petr']);
  });

  it('довольный — доверие растёт до максимума, недовольный — падает, на нуле обижается на неделю', () => {
    let s = { ...newGame(), day: 5 };
    for (let i = 0; i < 5; i++) s = recordVisit(s, 'petr', true).state;
    expect(regularState(s, 'petr').loyalty).toBe(MAX_LOYALTY);
    s = recordVisit(s, 'petr', false).state;
    expect(regularState(s, 'petr').loyalty).toBe(MAX_LOYALTY - 2);
    s = recordVisit(s, 'petr', false).state;
    const left = recordVisit(s, 'petr', false);
    expect(left.result).toBe('left');
    expect(regularsToday(left.state).map((r) => r.id)).not.toContain('petr');
    expect(regularsToday({ ...left.state, day: 5 + 8 }).map((r) => r.id)).toContain('petr');
  });

  it('Костя берёт картошку только дешевле обычного, а чаевые — только на полном доверии', () => {
    const s = { ...newGame(), day: 10 };
    const kostya = regularById('kostya');
    expect(acceptsPrice(s, kostya, 20)).toBe(false);
    expect(acceptsPrice(s, kostya, 15)).toBe(true);
    expect(tipFor(START_LOYALTY, 100)).toBe(0);
    expect(tipFor(MAX_LOYALTY, 100)).toBeGreaterThan(0);
  });
});
