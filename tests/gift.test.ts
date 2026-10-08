import { describe, expect, it } from 'vitest';
import { claimGift, GIFT_DAYS, localDate } from '../src/game/gift';
import { newGame } from '../src/game/economy';

const r = () => 0;

describe('daily gift', () => {
  it('первый вход — подарок первого дня, второй раз в тот же день — ничего', () => {
    const first = claimGift(newGame(), '2026-10-08', r)!;
    expect(first.gift.day).toBe(1);
    expect(first.state.money).toBeGreaterThan(newGame().money);
    expect(claimGift(first.state, '2026-10-08', r)).toBeNull();
  });

  it('подряд — серия растёт, пропуск — с начала', () => {
    let s = claimGift(newGame(), '2026-10-08', r)!.state;
    const second = claimGift(s, '2026-10-09', r)!;
    expect(second.gift.day).toBe(2);
    s = second.state;
    expect(claimGift(s, '2026-10-11', r)!.gift.day).toBe(1);
  });

  it('через конец месяца серия тоже продолжается', () => {
    const s = claimGift(newGame(), '2026-10-31', r)!.state;
    expect(claimGift(s, '2026-11-01', r)!.gift.day).toBe(2);
  });

  it('седьмой день — самый большой и с рейтингом, потом снова первый', () => {
    let s = newGame();
    const gifts = [];
    for (let i = 0; i < GIFT_DAYS + 1; i++) {
      const res = claimGift(s, localDate(new Date(2026, 9, 1 + i)), r)!;
      gifts.push(res.gift);
      s = res.state;
    }
    expect(gifts[6].day).toBe(7);
    expect(gifts[6].rating).toBeGreaterThan(0);
    expect(gifts[6].money).toBe(Math.max(...gifts.map((g) => g.money)));
    expect(gifts[7].day).toBe(1);
    expect(gifts[2].goods?.qty).toBeGreaterThan(0);
  });
});
