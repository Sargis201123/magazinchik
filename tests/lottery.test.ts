import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyDayStats, newGame, type StoreState } from '../src/game/economy';
import {
  BAN_CHANCE,
  BAN_DAYS,
  buyLottery,
  countTicket,
  GRACE_DAYS,
  hasLottery,
  LOTTERY_MIN_LEVEL,
  LOTTERY_PRICE,
  lotteryBanned,
  lotteryGuests,
  lotteryLook,
  lotteryNews,
  lotteryNight,
  lotteryOpen,
  lotteryRoll,
  luckyLeft,
  luckyOn,
  LUCKY_DAYS,
  LUCKY_GUESTS,
  LUCKY_TICKETS,
  seeLotteryNews,
  TICKET_CHANCE,
  TICKET_CUT,
  ticketChance,
  ticketsEarned,
  WIN_BONUS,
  WIN_CHANCE,
  winnerVisitToday,
} from '../src/game/lottery';
import { guestFactor, nightCycle } from '../src/game/day';
import { pickNews } from '../src/game/headlines';
import { pendingTip, type TipId } from '../src/game/tips';
import { isGood, isNeutral, note, reviewsFor } from '../src/game/reviews';
import { simulate } from '../src/game/simulate';

// Лотерея у кассы (13.11): стойка, доля с билетов, редкий крупный выигрыш («счастливый магазин»),
// запреты города — всё от зерна магазина и дня; старые сохранения без стойки живут как раньше.

const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 30, level: 1, money: 5000, seed: 7, ...over });
/** Стойка стоит давно (льготные дни прошли). */
const withStand = (over: Partial<StoreState> = {}): StoreState => shop({ lottery: { since: 1 }, ...over });

/** Первый вечер, когда стойка с этим зерном выиграет (тираж) — и в который запрет не объявят. */
function winningDay(seed: number, from = 10): number {
  for (let d = from; d < from + 2000; d++) if (lotteryRoll(shop({ seed }), d, 59) < WIN_CHANCE) return d;
  throw new Error('нет выигрыша');
}
/** Первый вечер с запретом и без выигрыша. */
function banDay(seed: number, from = 10): number {
  for (let d = from; d < from + 2000; d++) {
    const s = shop({ seed });
    if (lotteryRoll(s, d, 59) >= WIN_CHANCE && lotteryRoll(s, d, 137) < BAN_CHANCE) return d;
  }
  throw new Error('нет запрета');
}

afterEach(() => vi.restoreAllMocks());

describe('стойка: покупка', () => {
  it('ставится за свою цену с «Магазинчика», один раз', () => {
    const s = buyLottery(shop())!;
    expect(s.money).toBe(5000 - LOTTERY_PRICE);
    expect(s.lottery).toEqual({ since: 30 });
    expect(hasLottery(s)).toBe(true);
    expect(buyLottery(s)).toBeNull();
    expect(buyLottery(shop({ level: LOTTERY_MIN_LEVEL - 1 }))).toBeNull();
    expect(buyLottery(shop({ money: LOTTERY_PRICE - 1 }))).toBeNull();
  });

  it('проданные билеты считаются, доля магазина — по TICKET_CUT с каждого', () => {
    let s = withStand();
    for (let i = 0; i < 7; i++) s = countTicket(s);
    expect(s.lottery?.sold).toBe(7);
    expect(ticketsEarned(s)).toBe(7 * TICKET_CUT);
    // Без стойки счёт не заводится.
    expect(countTicket(shop())).toEqual(shop());
  });
});

describe('старые сохранения и магазин без стойки', () => {
  it('ничего не меняется: ни гостей, ни билетов, ни тиражей', () => {
    const s = shop();
    expect(hasLottery(s)).toBe(false);
    expect(lotteryGuests(s)).toBe(1);
    expect(ticketChance(s)).toBe(0);
    expect(lotteryNight(s)).toBe(s);
    expect(lotteryNews(s)).toBeNull();
    expect(lotteryLook(s)).toBe('none');
    expect(guestFactor(s)).toBe(guestFactor({ ...s, lottery: undefined }));
  });

  it('сохранение без поля lottery грузится как есть', async () => {
    const local: Record<string, string> = {};
    Object.assign(globalThis, {
      localStorage: { getItem: (k: string) => local[k] ?? null, setItem: (k: string, v: string) => (local[k] = v), removeItem: (k: string) => delete local[k] },
    });
    vi.resetModules();
    const { loadGame, saveGame } = await import('../src/game/save');
    local['magazinchik.save'] = JSON.stringify({ version: 10, state: { ...newGame(), day: 40, money: 900 } });
    const old = loadGame()!;
    expect(old.lottery).toBeUndefined();
    expect(old.day).toBe(40);
    // А купленная стойка с выигрышем и запретом переживает сохранение.
    const lot = { since: 12, sold: 33, win: { day: 20, seen: true }, ban: { from: 30, until: 32 } };
    saveGame({ ...old, lottery: lot });
    expect(loadGame()!.lottery).toEqual(lot);
    delete (globalThis as Record<string, unknown>).localStorage;
  });
});

describe('тираж и запреты: от зерна и дня', () => {
  it('один и тот же вечер — один и тот же итог, без Math.random', () => {
    const spy = vi.spyOn(Math, 'random');
    for (let day = 10; day < 200; day++) {
      const s = withStand({ day });
      expect(lotteryNight(s)).toEqual(lotteryNight(s));
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it('выигрыши и запреты редкие, у разных магазинов — в разные дни', () => {
    let wins = 0;
    let bans = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const s = shop({ seed: 1 + (i % 50), day: 10 + i });
      if (lotteryRoll(s, s.day, 59) < WIN_CHANCE) wins++;
      if (lotteryRoll(s, s.day, 137) < BAN_CHANCE) bans++;
    }
    expect(wins / N).toBeGreaterThan(WIN_CHANCE * 0.6);
    expect(wins / N).toBeLessThan(WIN_CHANCE * 1.5);
    expect(bans / N).toBeGreaterThan(BAN_CHANCE * 0.6);
    expect(bans / N).toBeLessThan(BAN_CHANCE * 1.5);
    expect(winningDay(3)).not.toBe(winningDay(42));
  });

  it('первые дни после покупки — ни тиражей, ни запретов', () => {
    const day = winningDay(5);
    const fresh = shop({ seed: 5, day, lottery: { since: day - GRACE_DAYS + 1 } });
    expect(lotteryNight(fresh)).toBe(fresh);
  });

  it('счастливый билет: премия, новость, торт, «счастливый магазин» на LUCKY_DAYS дней', () => {
    const day = winningDay(3);
    const s = withStand({ seed: 3, day });
    const won = lotteryNight(s);
    expect(won.money).toBe(s.money + WIN_BONUS);
    expect(won.lottery?.win).toEqual({ day });
    // Сам вечер тиража — ещё не «счастливый».
    expect(luckyOn(won)).toBe(false);
    const next = { ...won, day: day + 1 };
    expect(luckyOn(next)).toBe(true);
    expect(luckyLeft(next)).toBe(LUCKY_DAYS);
    expect(lotteryGuests(next)).toBeCloseTo(1 + LUCKY_GUESTS);
    expect(ticketChance(next)).toBeCloseTo(TICKET_CHANCE * LUCKY_TICKETS);
    expect(lotteryLook(next)).toBe('lucky');
    expect(winnerVisitToday(next)).toBe(true);
    expect(winnerVisitToday({ ...next, day: day + 2 })).toBe(false);
    expect(lotteryNews(next)).toBe('win');
    const seen = seeLotteryNews(next);
    expect(lotteryNews(seen)).toBeNull();
    expect(seen.lottery?.win?.seen).toBe(true);
    // Новость не прочитали за «счастливые» дни — она уходит сама.
    expect(lotteryNews({ ...next, day: day + LUCKY_DAYS + 1 })).toBeNull();
    const after = { ...won, day: day + LUCKY_DAYS + 1 };
    expect(luckyOn(after)).toBe(false);
    expect(lotteryGuests(after)).toBe(1);
  });

  it('«счастливые» дни не копятся: во время них второй тираж не выигрывает и запрет не начинается', () => {
    const day = winningDay(3);
    const won = lotteryNight(withStand({ seed: 3, day }));
    for (let d = day + 1; d <= day + LUCKY_DAYS; d++) {
      const s = { ...won, day: d };
      const next = lotteryNight(s);
      // Последний «счастливый» вечер может объявить запрет — со следующего утра, когда «счастье» кончилось.
      if (d < day + LUCKY_DAYS) expect(next).toBe(s);
      else expect(next.lottery?.win).toEqual(won.lottery?.win);
    }
  });

  it('запрет: стойка закрыта BAN_DAYS дней, билетов нет, тираж не играет', () => {
    const day = banDay(11);
    const s = withStand({ seed: 11, day });
    const banned = lotteryNight(s);
    expect(banned.money).toBe(s.money);
    expect(banned.lottery?.ban).toEqual({ from: day + 1, until: day + BAN_DAYS });
    // В сам вечер объявления стойка ещё работала.
    expect(lotteryOpen(banned)).toBe(true);
    for (let d = day + 1; d <= day + BAN_DAYS; d++) {
      const b = { ...banned, day: d };
      expect(lotteryBanned(b)).toBe(true);
      expect(ticketChance(b)).toBe(0);
      expect(lotteryLook(b)).toBe('closed');
      // Тираж без проданных билетов не выигрывает, новый запрет поверх старого не начинается.
      const n = lotteryNight(b);
      expect(n.lottery?.win).toBeUndefined();
      if (d < day + BAN_DAYS) expect(n.lottery?.ban).toEqual(banned.lottery?.ban);
    }
    const open = { ...banned, day: day + BAN_DAYS + 1 };
    expect(lotteryOpen(open)).toBe(true);
    expect(ticketChance(open)).toBe(TICKET_CHANCE);
    expect(lotteryNews({ ...banned, day: day + 1 })).toBe('ban');
    expect(lotteryNews(seeLotteryNews({ ...banned, day: day + 1 }))).toBeNull();
    expect(lotteryNews(open)).toBeNull();
  });

  it('в Заречье билетов не продают: стойка — в Центре', () => {
    const s = withStand({ zar: { at: 'zar' } as StoreState['zar'] });
    expect(ticketChance(s)).toBe(0);
    expect(ticketChance(withStand())).toBe(TICKET_CHANCE);
  });

  it('тираж идёт в смене дня (nightCycle): премия — в кассе к утру', () => {
    const day = winningDay(3, 40);
    const s = withStand({ seed: 3, day, money: 20000 });
    const night = nightCycle(s, emptyDayStats(), () => 0.5);
    expect(night.state.day).toBe(day + 1);
    expect(night.state.lottery?.win?.day).toBe(day);
    expect(luckyOn(night.state)).toBe(true);
  });
});

describe('утро: новость, подсказка, отзывы', () => {
  it('новость о лотерее встаёт в общую очередь утра', () => {
    expect(pickNews(shop(), ['lottery', 'tale']).id).toBe('lottery');
    expect(pickNews(shop(), ['story', 'lottery']).id).toBe('story');
  });

  it('подсказка «Новое!» — когда стойку поставили', () => {
    const others: TipId[] = ['broke', 'ownerTill', 'alone', 'weekly', 'fair', 'loyalty', 'delivery', 'register2', 'oven', 'coffee', 'nightShift', 'pawn', 'case', 'rhythm', 'echo', 'license', 'thief', 'crisis', 'rental'];
    const seen = shop({ seenTips: others });
    expect(pendingTip(seen)).toBeNull();
    expect(pendingTip(buyLottery(seen)!)).toBe('lottery');
  });

  it('проигравшие ворчат в отзывах редко, на три звезды и не вытесняя жалоб', () => {
    const days = Array.from({ length: 300 }, (_, i) => i + 1);
    const grumbly = () => {
      const stats = emptyDayStats();
      note(stats, 'lottery', 4);
      return stats;
    };
    const shown = days.map((d) => reviewsFor(grumbly(), d).find((r) => r.topic === 'lottery')).filter((r) => r !== undefined);
    // Редко: примерно в каждый третий день, когда ворчали хотя бы трое, — а таких дней около половины.
    expect(shown.length).toBeGreaterThan(days.length * 0.15);
    expect(shown.length).toBeLessThan(days.length * 0.45);
    expect(shown.every((r) => r.stars === 3 && isNeutral(r.topic) && !isGood(r.topic))).toBe(true);
    // Есть настоящая жалоба — о лотерее не пишут, место на доске ей.
    for (const d of days) {
      const stats = grumbly();
      note(stats, 'queue');
      const topics = reviewsFor(stats, d).map((r) => r.topic);
      expect(topics).toContain('queue');
      expect(topics).not.toContain('lottery');
    }
    // Двое заворчали — не повод.
    const few = emptyDayStats();
    note(few, 'lottery', 2);
    expect(days.some((d) => reviewsFor(few, d).some((r) => r.topic === 'lottery'))).toBe(false);
  });
});

describe('симулятор', () => {
  it('разумный игрок ставит стойку, билеты продаются, баланс не ломается', () => {
    // Один прогон шумит (сдвигаются случайности дня) — сравниваем в среднем по нескольким сидам.
    const days = 60;
    const seeds = [1, 2, 3, 4, 5, 6];
    const money = (r: ReturnType<typeof simulate>) => r.days[r.days.length - 1].money;
    let base = 0;
    let lot = 0;
    for (const seed of seeds) {
      const b = simulate({ days, seed });
      const l = simulate({ days, seed, features: { lottery: true } });
      expect(b.final.lottery).toBeUndefined();
      expect(hasLottery(l.final)).toBe(true);
      expect(l.final.lottery!.sold!).toBeGreaterThan(50);
      base += money(b);
      lot += money(l);
    }
    expect(lot).toBeGreaterThan(base * 0.9);
    expect(lot).toBeLessThan(base * 1.2);
  }, 60_000);
});
