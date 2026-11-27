import { describe, expect, it } from 'vitest';
import { newGame, type Shelf, type StaffMember, type StoreState } from '../src/game/economy';
import { levelPace, loaderPace, loaderSpeed, shelfToFill, STAFF_LEVEL_PACE, TRIP_SECONDS, tripSeconds } from '../src/game/loader';
import { warehouseSpeed } from '../src/game/gear';
import { staffCarry } from '../src/game/upgrades';
import { simulate } from '../src/game/simulate';

// 27.11, разбор «Универмага»: полки пустели, потому что грузчик не успевал носить со склада (ходка ~9,8 с,
// ~10 ходок за день), а склад к закрытию оставался полон. Теперь грузчик и ученик в большом магазине ходят быстрее.

const units = (n: number) => Array.from({ length: n }, () => ({ age: 0 }));
const shop = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), ...patch });
const loader: StaffMember = { name: 1, role: 'loader', skill: 1, wage: 350, months: 0 };

describe('грузчик в большом магазине ходит быстрее', () => {
  it('×(1 + 0,25·уровень): ларёк ×1, «Универмаг» ×2', () => {
    expect(STAFF_LEVEL_PACE).toBe(0.25);
    expect(levelPace(shop({ level: 0 }))).toBe(1);
    expect(levelPace(shop({ level: 4 }))).toBe(2);
  });

  it('склад с оборудованием и помещение складываются', () => {
    const s = shop({ level: 4, gear: { warehouse: 3 } });
    expect(loaderSpeed(s)).toBeCloseTo(warehouseSpeed(s) * 2);
    expect(loaderPace(s, loader)).toBeGreaterThan(loaderPace(shop({ level: 0, gear: { warehouse: 3 } }), loader));
  });

  it('ходка по большому залу с новой скоростью - не дольше, чем по ларьку', () => {
    // Путь растёт с помещением (5,6 с в ларьке → 9,8 с в «Универмаге»), скорость растёт быстрее.
    for (let level = 1; level < TRIP_SECONDS.length; level++) {
      const s = shop({ level });
      expect(TRIP_SECONDS[level]).toBeGreaterThan(TRIP_SECONDS[level - 1]);
      expect(tripSeconds(s) / levelPace(s)).toBeLessThanOrEqual(TRIP_SECONDS[0]);
    }
  });
});

describe('какую полку грузчик пополняет', () => {
  // Полка напитков на 24 места: вода и сок.
  const drinks = (water: number, juice: number): Shelf => ({ kind: 'drinks', level: 3, items: { water: units(water), juice: units(juice) } });

  it('сначала ту, где товар кончился, потом самую пустую', () => {
    const s = shop({ level: 4, shelves: [drinks(2, 2), drinks(0, 22)], warehouse: { water: units(30), juice: units(30) } });
    expect(shelfToFill(s)).toBe(1);
    const both = shop({ level: 4, shelves: [drinks(8, 8), drinks(2, 2)], warehouse: { water: units(30), juice: units(30) } });
    expect(shelfToFill(both)).toBe(1);
  });

  it('почти полную полку не трогает, нести нечего - -1', () => {
    const full = shop({ level: 4, shelves: [drinks(11, 11)], warehouse: { water: units(30), juice: units(30) } });
    expect(shelfToFill(full)).toBe(-1);
    const empty = shop({ level: 4, shelves: [drinks(1, 1)], warehouse: {} });
    expect(shelfToFill(empty)).toBe(-1);
  });

  it('тележка сотрудника тоже растёт с помещением', () => {
    expect(staffCarry(shop({ level: 4 }))).toBe(2 * staffCarry(shop({ level: 0 })));
  });
});

// Симулятор с пределом зала (hall: true) - это «Трафик v2»: зал + поток «на бегу», ходки грузчика по времени.
describe('симулятор: Трафик v2', () => {
  const runs = [1, 2, 3].map((seed) => simulate({ days: 60, seed, hall: true }));
  const days = runs.flatMap((r) => r.days);

  it('сверх зала гости идут «на бегу», а не пропадают', () => {
    const big = days.filter((d) => d.level >= 2);
    expect(big.length).toBeGreaterThan(30);
    // Касс без хозяина хватает - пробивают «на бегу» больше, чем проходит через зал.
    const quick = big.reduce((n, d) => n + d.quick, 0) / big.length;
    const served = big.reduce((n, d) => n + d.served, 0) / big.length;
    expect(quick).toBeGreaterThan(served / 3);
    // Пришли все позванные (кассы без хозяина есть), а зал пропустил не больше своего предела.
    for (const d of big.filter((x) => x.quick > 0)) expect(d.guests).toBe(d.wanted);
  });

  it('базовый игрок доходит до «Супермаркета» и не уходит в минус', () => {
    for (const r of runs) {
      expect(r.levelDay[3]).not.toBeNull();
      expect(r.bankruptDay).toBeNull();
    }
  });

  it('грузчик делает ходки по времени, как в сцене: 5-40 за день, а не 60', () => {
    const withLoader = days.filter((d) => d.level >= 3);
    expect(withLoader.length).toBeGreaterThan(10);
    const trips = withLoader.reduce((n, d) => n + d.trips, 0) / withLoader.length;
    expect(trips).toBeGreaterThanOrEqual(5);
    expect(trips).toBeLessThanOrEqual(40);
  });
});
