import { describe, expect, it } from 'vitest';
import { STORE_LEVELS } from '../src/game/economy';
import { REGISTERS_BY_LEVEL } from '../src/game/registers';
import { HALL_PROFILES, hallMix, NIGHT, type HallScene } from '../src/platform/hallLayers';

// Звук зала по размеру магазина: ларёк тихий с радио, большие залы гулче и людней, плотность —
// по людям и кассам, ночью и в закрытом магазине тише.

const scene = (patch: Partial<HallScene> = {}): HallScene => ({ level: 1, people: 5, tills: 1, open: true, night: false, lite: false, ...patch });
const mid = (gap: [number, number] | null): number => (gap ? (gap[0] + gap[1]) / 2 : Infinity);

describe('звук зала по помещению', () => {
  it('профиль на каждое помещение', () => {
    expect(HALL_PROFILES).toHaveLength(STORE_LEVELS.length);
  });

  it('ларёк: радио и улица за окошком, без тележек, сканеров и объявлений', () => {
    const m = hallMix(scene({ level: 0, people: 4 }));
    expect(m.radio).toBeGreaterThan(0);
    expect(m.street).toBeGreaterThan(0);
    expect(m.trolley).toBeNull();
    expect(m.beep).toBeNull();
    expect(m.pa).toBeNull();
    expect(m.hall).toBe(0);
  });

  it('радио — только в ларьке', () => {
    for (let level = 1; level < STORE_LEVELS.length; level++) expect(hallMix(scene({ level })).radio).toBe(0);
  });

  it('чем больше зал, тем гулче, громче гомон и холодильники (но без перебора)', () => {
    const all = HALL_PROFILES.map((_, level) => hallMix(scene({ level })));
    for (let i = 1; i < all.length; i++) {
      expect(all[i].room).toBeGreaterThanOrEqual(all[i - 1].room);
      expect(all[i].murmur).toBeGreaterThanOrEqual(all[i - 1].murmur);
      expect(all[i].hum).toBeGreaterThanOrEqual(all[i - 1].hum);
      expect(all[i].street).toBeLessThanOrEqual(all[i - 1].street);
    }
    // Тихо: даже гипермаркет гудит голосами не больше чем на ~3 дБ громче магазинчика.
    expect(20 * Math.log10(all[5].murmur / all[1].murmur)).toBeLessThan(3);
  });

  it('супермаркет и выше: тележки и сканеры других касс; гипермаркет: объявления и большой зал', () => {
    const superm = hallMix(scene({ level: 3, people: 8, tills: 3 }));
    expect(superm.trolley).not.toBeNull();
    expect(superm.beep).not.toBeNull();
    expect(superm.pa).toBeNull();
    const hyper = hallMix(scene({ level: 5, people: 15, tills: 5 }));
    expect(hyper.pa).not.toBeNull();
    expect(hyper.hall).toBe(1);
    expect(mid(hyper.trolley)).toBeLessThan(mid(superm.trolley));
  });

  it('плотность — по людям: пустой зал тише, полный — чаще тележки', () => {
    const empty = hallMix(scene({ level: 4, people: 0, tills: 4 }));
    expect(empty.trolley).toBeNull();
    expect(empty.beep).toBeNull();
    const few = hallMix(scene({ level: 4, people: 2, tills: 4 }));
    const full = hallMix(scene({ level: 4, people: 20, tills: 4 }));
    expect(mid(full.trolley)).toBeLessThan(mid(few.trolley));
    expect(mid(full.beep)).toBeLessThan(mid(few.beep));
  });

  it('сканеры — по кассам: одна касса (своя) — фоновых нет, больше касс — чаще', () => {
    expect(hallMix(scene({ level: 3, people: 8, tills: 1 })).beep).toBeNull();
    const two = hallMix(scene({ level: 5, people: 10, tills: 2 }));
    const five = hallMix(scene({ level: 5, people: 10, tills: REGISTERS_BY_LEVEL[5] }));
    expect(mid(five.beep)).toBeLessThan(mid(two.beep));
  });

  it('ночью реже и тише, закрыто — ни тележек, ни сканеров, ни объявлений', () => {
    const day = hallMix(scene({ level: 5, people: 10, tills: 5 }));
    const night = hallMix(scene({ level: 5, people: 10, tills: 5, night: true }));
    expect(night.gain).toBe(NIGHT.gain);
    expect(mid(night.trolley)).toBeGreaterThan(mid(day.trolley));
    expect(mid(night.pa)).toBeGreaterThan(mid(day.pa));
    const closed = hallMix(scene({ level: 5, people: 0, tills: 5, open: false }));
    expect(closed.trolley).toBeNull();
    expect(closed.beep).toBeNull();
    expect(closed.pa).toBeNull();
    expect(hallMix(scene({ level: 0, open: false })).radio).toBeLessThan(hallMix(scene({ level: 0 })).radio);
  });

  it('слабый телефон: без длинного хвоста и реже', () => {
    const lite = hallMix(scene({ level: 5, people: 10, tills: 5, lite: true }));
    expect(lite.hall).toBe(0);
    expect(mid(lite.trolley)).toBeGreaterThan(mid(hallMix(scene({ level: 5, people: 10, tills: 5 })).trolley));
  });

  it('странное помещение (старое сохранение, мусор) — ближайший профиль, без падения', () => {
    expect(hallMix(scene({ level: 99 })).pa).not.toBeNull();
    expect(hallMix(scene({ level: -1 })).radio).toBeGreaterThan(0);
    expect(hallMix(scene({ level: NaN })).radio).toBeGreaterThan(0);
  });
});
