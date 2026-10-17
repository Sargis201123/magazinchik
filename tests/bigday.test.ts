import { describe, expect, it } from 'vitest';
import {
  BAD_DAY_SOFTEN,
  BIG_DAY_FROM,
  BIG_DAY_GAP,
  BIG_DAYS,
  bigDayDemand,
  bigDayFor,
  bigDayGuests,
  bigDayKnown,
  bigDayProgress,
  bigDayStart,
  blackoutWarm,
  filmingReward,
  fulfillWedding,
  quakeBreak,
  weddingOrder,
} from '../src/game/bigday';
import { yearTime } from '../src/game/calendar';
import { guestsToday, spawnIntervalToday } from '../src/game/day';
import { newGame } from '../src/game/economy';

const DAYS = Array.from({ length: 800 }, (_, i) => i + 1);

describe('особые дни', () => {
  it('не бывает до BIG_DAY_FROM, а между событиями — не меньше BIG_DAY_GAP спокойных дней', () => {
    const big = DAYS.filter((d) => bigDayFor(d));
    expect(big.every((d) => d >= BIG_DAY_FROM)).toBe(true);
    for (let i = 1; i < big.length; i++) {
      const gap = big[i] - big[i - 1];
      // Внутри многодневного события — дни подряд, между событиями — пауза.
      if (bigDayStart(big[i]) !== bigDayStart(big[i - 1])) expect(gap).toBeGreaterThan(BIG_DAY_GAP);
      else expect(gap).toBe(1);
    }
  });

  it('бывают все и в своё время года', () => {
    const seen = new Set(DAYS.map(bigDayFor).filter(Boolean));
    expect(seen.size).toBe(Object.keys(BIG_DAYS).length);
    for (const d of DAYS) {
      const id = bigDayFor(d);
      if (id === 'heatwave' || id === 'carnival') expect(yearTime(d)).toBe('summer');
      if (id === 'flood' || id === 'quake' || id === 'parade') expect(['spring', 'autumn']).toContain(yearTime(d));
      if (id === 'frost') expect(['winter', 'autumn']).toContain(yearTime(d));
    }
  });

  it('не слишком часто: примерно каждый седьмой–десятый день', () => {
    const share = DAYS.filter((d) => bigDayFor(d)).length / DAYS.length;
    expect(share).toBeGreaterThan(0.06);
    expect(share).toBeLessThan(0.2);
  });

  it('утренний прогноз гостей не выдаёт особый день, а поток гостей — меняется', () => {
    const disaster = DAYS.find((d) => bigDayFor(d) === 'heatwave')!;
    const crowd = DAYS.find((d) => bigDayFor(d) === 'parade')!;
    const base = { ...newGame(), rating: 3 };
    for (const day of [disaster, crowd]) {
      const s = { ...base, day };
      const normal = { ...base, day: day + 1 };
      expect(bigDayFor(day + 1) ?? null).not.toBe(bigDayFor(day));
      // Прогноз — как в обычный день (тот же расчёт без особого дня).
      expect(guestsToday(s) / guestsToday(normal)).toBeCloseTo(1, 0);
      // Плохие дни мягче, чем в таблице (BAD_DAY_SOFTEN): событий стало больше — не душим кассу.
      const g = BIG_DAYS[bigDayFor(day)!].guests;
      expect(bigDayGuests(day)).toBeCloseTo(g < 1 ? 1 - (1 - g) * BAD_DAY_SOFTEN : g);
    }
    expect(spawnIntervalToday({ ...base, day: disaster })).toBeGreaterThan(spawnIntervalToday({ ...base, day: disaster - 1 }) * 1.3);
    expect(spawnIntervalToday({ ...base, day: crowd })).toBeLessThan(spawnIntervalToday({ ...base, day: crowd - 1 }) / 1.5);
  });

  it('спрос: в жару — вода и мороженое', () => {
    const heat = DAYS.find((d) => bigDayFor(d) === 'heatwave')!;
    expect(bigDayDemand(heat, 'water')).toBeGreaterThan(2);
    expect(bigDayDemand(heat, 'meat')).toBeLessThan(1);
    expect(bigDayDemand(heat - 1, 'water')).toBe(1);
  });

  it('землетрясение роняет часть товара с полок', () => {
    const s = newGame();
    const units = (n: number) => Array.from({ length: n }, () => ({ age: 0 }));
    const state = { ...s, shelves: s.shelves.map((sh, i) => ({ ...sh, items: i === 0 ? { bread: units(20) } : {} })) };
    let k = 0;
    const random = () => ((k++ % 4) === 0 ? 0 : 0.9);
    const { state: after, broken } = quakeBreak(state, random, 0.12);
    expect(broken).toBe(5);
    expect(after.shelves[0].items.bread?.length).toBe(15);
  });

  it('ремонт дороги — 5 дней подряд, болезнь — 3; со второго дня о них уже знают', () => {
    for (const [id, len] of [['roadworks', 5], ['epidemic', 3]] as const) {
      const start = DAYS.find((d) => bigDayFor(d) === id && bigDayStart(d) === d)!;
      expect(start).toBeDefined();
      for (let k = 0; k < len; k++) {
        expect(bigDayFor(start + k)).toBe(id);
        expect(bigDayProgress(start + k)).toEqual({ n: k + 1, of: len });
        expect(bigDayKnown(start + k)).toBe(k > 0);
      }
      expect(bigDayFor(start + len)).toBeNull();
      // Известный день входит в прогноз гостей.
      const base = { ...newGame(), rating: 3 };
      expect(guestsToday({ ...base, day: start + 1 })).toBeLessThan(guestsToday({ ...base, day: start }));
    }
  });

  it('свадьба: забирают что есть с наценкой; всё целиком — ещё и рейтинг', () => {
    const units = (n: number) => Array.from({ length: n }, () => ({ age: 0 }));
    const s = { ...newGame(), level: 0 };
    const order = weddingOrder(s);
    expect(order.items.length).toBeGreaterThan(0);
    const full = {
      ...s,
      warehouse: Object.fromEntries(order.items.map(({ product, qty }) => [product, units(qty)])),
    };
    const done = fulfillWedding(full, order);
    expect(done.complete).toBe(true);
    expect(done.earned).toBeGreaterThan(0);
    expect(done.state.rating).toBeGreaterThan(full.rating);
    expect(order.items.every(({ product }) => (done.state.warehouse[product]?.length ?? 0) === 0)).toBe(true);
    const empty = fulfillWedding({ ...s, warehouse: {}, shelves: s.shelves.map((sh) => ({ ...sh, items: {} })) }, order);
    expect(empty.complete).toBe(false);
    expect(empty.earned).toBe(0);
  });

  it('блэкаут старит товар в холодильниках, кино дарит рекламу на завтра', () => {
    const s = newGame();
    const warm = blackoutWarm(s);
    expect(warm.aged).toBeGreaterThanOrEqual(0);
    const reward = filmingReward({ ...s, day: 20, ads: undefined });
    expect(reward.ads).toEqual({ id: 'blogger', from: 21, until: 21 });
    const busy = { ...s, day: 20, ads: { id: 'banner' as const, from: 19, until: 22 } };
    expect(filmingReward(busy)).toBe(busy);
  });
});
