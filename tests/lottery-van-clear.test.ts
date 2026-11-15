import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import {
  bonusEarned,
  countTicket,
  GRACE_DAYS,
  JACKPOTS,
  LOG_MAX,
  lotteryBanned,
  lotteryDay,
  lotteryNight,
  lotteryRoll,
  SMALL_PRIZES,
  SMALL_WIN_CHANCE,
  TICKET_CUT,
  ticketPrize,
  ticketsEarned,
  ticketsToday,
  ticketsYesterday,
  WHO_COUNT,
  WIN_BONUS,
  WIN_CHANCE,
} from '../src/game/lottery';
import { settleVan, vanCalendar, vanDemand, vanEvents, vanTaken, VAN_EVENTS, type VanResult } from '../src/game/van';
import { hasLicense } from '../src/game/license';

// Лотерея и фургон понятные (15.11, автор): у лотереи — статистика билетов и тиражей, мгновенные выигрыши
// с именами (платит лотерея, не касса), у фургона — календарь выездов и итог с «взял в кузов».

const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 30, level: 1, money: 5000, seed: 7, ...over });
const withStand = (over: Partial<StoreState> = {}): StoreState => shop({ lottery: { since: 1 }, ...over });

/** Продать n билетов в день state.day. */
const sell = (state: StoreState, n: number): StoreState => {
  let s = state;
  for (let i = 0; i < n; i++) s = countTicket(s);
  return s;
};

describe('лотерея: мгновенные выигрыши билетов', () => {
  it('выигрыш билета — от зерна и номера: одинаковый при повторе, из списка призов, примерно каждый восьмой', () => {
    const s = withStand();
    let wins = 0;
    for (let n = 1; n <= 4000; n++) {
      const prize = ticketPrize(s, n);
      expect(prize).toBe(ticketPrize(s, n));
      if (prize) {
        wins++;
        expect(SMALL_PRIZES).toContain(prize);
      }
    }
    expect(wins / 4000).toBeGreaterThan(SMALL_WIN_CHANCE * 0.8);
    expect(wins / 4000).toBeLessThan(SMALL_WIN_CHANCE * 1.2);
    // Другое зерно — другие счастливые билеты.
    const other = withStand({ seed: 8 });
    expect(Array.from({ length: 200 }, (_, i) => ticketPrize(other, i + 1))).not.toEqual(Array.from({ length: 200 }, (_, i) => ticketPrize(s, i + 1)));
  });

  it('проданный билет считает выигрыш в статистику; деньги игрока выигрыш не трогает', () => {
    const s = sell(withStand(), 60);
    const lot = s.lottery!;
    expect(lot.sold).toBe(60);
    expect(s.money).toBe(5000);
    const expected = Array.from({ length: 60 }, (_, i) => ticketPrize(withStand(), i + 1)).filter(Boolean);
    expect(lot.wins ?? 0).toBe(expected.length);
    expect(lot.prizes ?? 0).toBe(expected.reduce((a, b) => a + b, 0));
    expect(lot.today).toEqual({ day: 30, n: 60, ...(expected.length ? { w: expected.length } : {}) });
    // Список последних — не длиннее LOG_MAX, новые в конце, у каждого имя из списка.
    expect((lot.log ?? []).length).toBe(Math.min(LOG_MAX, expected.length));
    expect((lot.log ?? []).map((w) => w.prize)).toEqual(expected.slice(-LOG_MAX));
    for (const w of lot.log ?? []) {
      expect(w.day).toBe(30);
      expect(w.who).toBeGreaterThanOrEqual(0);
      expect(w.who).toBeLessThan(WHO_COUNT);
      expect(w.big).toBeUndefined();
    }
    // Доля магазина — как раньше: с каждого билета.
    expect(ticketsEarned(s)).toBe(60 * TICKET_CUT);
  });

  it('билеты по дням: сегодня, вчера; на новый день счёт начинается заново', () => {
    let s = sell(withStand(), 4);
    expect(ticketsToday(s)).toBe(4);
    expect(ticketsYesterday(s)).toBe(0);
    s = { ...s, day: 31 };
    expect(ticketsToday(s)).toBe(0);
    expect(ticketsYesterday(s)).toBe(4);
    s = sell(s, 2);
    expect(s.lottery?.today?.n).toBe(2);
    expect(ticketsYesterday(s)).toBe(0);
    // Через день без билетов «вчера» — ноль, а не позавчерашние.
    expect(ticketsYesterday({ ...s, day: 33 })).toBe(0);
  });
});

describe('лотерея: тиражи и крупный выигрыш в статистике', () => {
  /** Первый вечер, когда наш билет выигрывает крупно. */
  const winningDay = (seed: number): number => {
    for (let d = 10; d < 3000; d++) if (lotteryRoll(shop({ seed }), d, 59) < WIN_CHANCE) return d;
    throw new Error('нет выигрыша');
  };

  it('тираж считается, только когда стойка работала; в льготные дни — нет', () => {
    let quiet = 0;
    for (let d = 10; d < 400 && !quiet; d++) {
      const s = withStand({ day: d });
      if (lotteryRoll(s, d, 59) >= WIN_CHANCE && lotteryRoll(s, d, 137) >= 0.025) quiet = d;
    }
    const s = withStand({ day: quiet, lottery: { since: 1, draws: 4 } });
    expect(lotteryNight(s).lottery?.draws).toBe(5);
    expect(lotteryNight(s).money).toBe(s.money);
    // Свежая стойка — ни тиража, ни счёта.
    const fresh = withStand({ day: quiet, lottery: { since: quiet - GRACE_DAYS + 1 } });
    expect(lotteryNight(fresh)).toBe(fresh);
    // Запрет: стойка закрыта — тиража нет.
    const banned = withStand({ day: quiet, lottery: { since: 1, ban: { from: quiet, until: quiet + 1 } } });
    expect(lotteryBanned(banned)).toBe(true);
    expect(lotteryNight(banned).lottery?.draws).toBeUndefined();
  });

  it('крупный выигрыш: премия магазину, запись «крупный» с суммой джекпота и счётчик премий', () => {
    const day = winningDay(5);
    const s = sell(withStand({ seed: 5, day }), 3);
    const won = lotteryNight(s);
    expect(won.money).toBe(s.money + WIN_BONUS);
    const lot = won.lottery!;
    expect(lot.bigs).toBe(1);
    expect(bonusEarned(won)).toBe(WIN_BONUS);
    const last = lot.log!.at(-1)!;
    expect(last.big).toBe(true);
    expect(last.day).toBe(day);
    expect(JACKPOTS).toContain(last.prize);
    expect(lot.wins).toBe((s.lottery?.wins ?? 0) + 1);
    // Тот же вечер — тот же итог.
    expect(lotteryNight(s)).toEqual(won);
    // Строка итогов дня: билеты дня, доля, крупный тираж.
    expect(lotteryDay(s, won, day)).toEqual({ n: 3, sum: 3 * TICKET_CUT, w: s.lottery?.today?.w ?? 0, big: true });
  });

  it('итоги дня: без билетов и без крупного выигрыша — строки нет', () => {
    const s = withStand();
    expect(lotteryDay(s, s, 30)).toBeNull();
    const sold = sell(s, 2);
    expect(lotteryDay(sold, sold, 30)).toMatchObject({ n: 2, sum: 2 * TICKET_CUT, big: false });
    // Вчерашние билеты в итоги сегодняшнего дня не попадают.
    expect(lotteryDay({ ...sold, day: 31 }, { ...sold, day: 31 }, 31)).toBeNull();
  });

  it('старое сохранение (стойка без статистики) читается: нули, пустой список, первый билет заводит поля', () => {
    const old = withStand({ lottery: { since: 1, sold: 40, win: { day: 5, seen: true } } });
    expect(ticketsToday(old)).toBe(0);
    expect(ticketsYesterday(old)).toBe(0);
    expect(bonusEarned(old)).toBe(0);
    expect(ticketsEarned(old)).toBe(40 * TICKET_CUT);
    const next = countTicket(old);
    expect(next.lottery?.sold).toBe(41);
    expect(next.lottery?.today?.n).toBe(1);
    expect(next.lottery?.win).toEqual({ day: 5, seen: true });
    // Без стойки ничего не заводится.
    expect(countTicket(shop())).toEqual(shop());
  });
});

describe('фургон: календарь выездов и итог', () => {
  const van = (over: Partial<StoreState> = {}): StoreState => shop({ level: 2, van: { since: 1 }, ...over });

  it('календарь: ближайшие выезды по порядку, с сегодняшнего дня, не больше n и не дальше горизонта', () => {
    const s = van();
    const plan = vanCalendar(s, 5, 14);
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.length).toBeLessThanOrEqual(5);
    for (let i = 0; i < plan.length; i++) {
      const p = plan[i];
      expect(p.day).toBeGreaterThanOrEqual(s.day);
      expect(p.day).toBeLessThanOrEqual(s.day + 14);
      expect(vanEvents(s, p.day)).toContain(p.event);
      expect(p.demand).toBe(vanDemand(s, p.event));
      if (i) expect(p.day).toBeGreaterThanOrEqual(plan[i - 1].day);
    }
    // Каждый день с выездом в пределах горизонта есть в календаре, пока не набрали n.
    const full = vanCalendar(s, 99, 14);
    let expected = 0;
    for (let d = 0; d <= 14; d++) expected += vanEvents(s, s.day + d).length;
    expect(full.length).toBe(expected);
    // Матч — каждую неделю: за 14 дней хоть один выезд найдётся.
    expect(full.some((p) => p.event === 'match')).toBe(true);
    expect(vanCalendar(s, 0)).toEqual([]);
  });

  it('спрос события: пиво и сигареты — только с лицензией', () => {
    const s = van();
    expect(hasLicense(s)).toBe(false);
    const all = Object.values(VAN_EVENTS.match.wants).reduce((a, b) => a + (b ?? 0), 0);
    expect(vanDemand(s, 'match')).toBe(all - (VAN_EVENTS.match.wants.beer ?? 0) - (VAN_EVENTS.match.wants.cigarettes ?? 0));
    expect(vanDemand(s, 'beach')).toBe(Object.values(VAN_EVENTS.beach.wants).reduce((a, b) => a + (b ?? 0), 0));
  });

  it('«взял в кузов» = продал + привёз + испортилось; старый итог без новых полей читается', () => {
    const r: VanResult = { day: 29, event: 'match', sold: 10, revenue: 300, back: 4, spoiled: 2, extra: 0, fuel: 80, net: 220 };
    expect(vanTaken(r)).toBe(16);
    // Пустой выезд — ничего не меняется (settleVan без кузова).
    const s = van({ van: { since: 1, last: r } });
    expect(settleVan(s).state).toBe(s);
  });
});
