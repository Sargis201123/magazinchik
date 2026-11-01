import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newGame, roleOpen, type StaffMember, type StaffRole, type StoreState } from '../src/game/economy';
import { nextCashierRole, REGISTERS_BY_LEVEL, RELIEF_LEVEL } from '../src/game/registers';
import { ensurePlan, guestsGain, guestsToday } from '../src/game/day';
import { canTradeAway } from '../src/game/away';
import {
  buyKiosk,
  extraLanes,
  KIOSK_PRICES,
  KIOSK_TIERS,
  kioskCount,
  kioskSlots,
  KIOSKS_BY_LEVEL,
  kioskTier,
  laneGuests,
  LANE_GUESTS_MAX,
  nextKioskPrice,
  openRegisters,
  staffedTills,
  upgradeKiosks,
  withNextTill,
} from '../src/game/lanes';
import { simulate } from '../src/game/simulate';
import { iceboxRect, iceboxSpotFor, kioskRect, kioskSpot, kioskZones, layoutFor, registerSpot } from '../src/scenes/layout';
import { kioskSpotFree, overlapsRect, tillZones } from '../src/scenes/placement';

// Кассы и поток гостей (lanes.ts): сменщик — с «Магазинчика» и весь день за кассой хозяина; открытые
// кассы зовут гостей с убывающей прибавкой; киоски — несколько, с моделями, тоже зовут гостей.
const member = (role: StaffRole): StaffMember => ({ role, name: 3, skill: 2, wage: 420, months: 4 });
const shop = (level: number, roles: StaffRole[], patch: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  day: 40,
  rating: 4,
  level,
  registers: REGISTERS_BY_LEVEL[level],
  money: 20000,
  staff: roles.map(member),
  ...patch,
});

describe('сменщик — с «Магазинчика»', () => {
  it('в ларьке его не нанять (подсказка «с помещения…» в «Персонале»), с «Магазинчика» — можно', () => {
    expect(RELIEF_LEVEL).toBe(1);
    expect(roleOpen(shop(0, []), 'cashier')).toBe(false);
    expect(roleOpen(shop(1, []), 'cashier')).toBe(true);
    expect(nextCashierRole(shop(0, []))).toBeNull();
    expect(nextCashierRole(shop(1, []))).toBe('cashier');
  });

  it('нанятый в ларьке раньше — остаётся и работает: не увольняем и денег не берём', () => {
    const s = shop(0, ['cashier']);
    // Утро нового дня с ним: никого не увольняют, торгует, пока игрока нет, как и раньше.
    const next = ensurePlan({ ...s, day: s.day + 1, plan: undefined });
    expect(next.staff.map((m) => m.role)).toContain('cashier');
    expect(next.money).toBe(s.money);
    expect(canTradeAway(next)).toBe(true);
    // Сменщик — касса хозяина: новых касс он не открывает, гостей сам по себе не прибавляет.
    expect(laneGuests(s)).toBe(1);
    // И в «Персонале» его не нанять второй раз.
    expect(nextCashierRole(s)).toBeNull();
  });

});

describe('открытые кассы зовут гостей', () => {
  it('касса хозяина открыта всегда, остальные — только с кассиром', () => {
    expect(openRegisters(shop(2, []))).toBe(1);
    expect(openRegisters(shop(2, ['cashier']))).toBe(1);
    expect(openRegisters(shop(2, ['cashier2']))).toBe(2);
    // Кассу поставили, а кассира нет — она закрыта и гостей не зовёт.
    expect(extraLanes(shop(3, ['cashier2']))).toBe(1);
  });

  it('каждая следующая касса прибавляет меньше, и всё вместе — не больше +40%', () => {
    const steps = [[], ['cashier2'], ['cashier2', 'cashier3'], ['cashier2', 'cashier3', 'cashier4']].map((r) => laneGuests(shop(4, r as StaffRole[])));
    expect(steps[0]).toBe(1);
    const gains = steps.slice(1).map((k, i) => k - steps[i]);
    expect(gains[0]).toBeGreaterThan(0.08);
    for (let i = 1; i < gains.length; i++) expect(gains[i]).toBeLessThan(gains[i - 1]);
    const all = laneGuests(shop(4, ['cashier2', 'cashier3', 'cashier4'], { kiosks: { n: 4, tier: 2 }, upgrades: ['selfCheckout'] }));
    expect(all).toBeLessThan(1 + LANE_GUESTS_MAX);
    // Пятая касса гипермаркета прибавляет ещё меньше, потолок тот же.
    const four = laneGuests(shop(5, ['cashier2', 'cashier3', 'cashier4']));
    const five = laneGuests(shop(5, ['cashier2', 'cashier3', 'cashier4', 'cashier5']));
    expect(five).toBeGreaterThan(four);
    expect(five - four).toBeLessThan(gains[gains.length - 1]);
    expect(laneGuests(shop(5, ['cashier2', 'cashier3', 'cashier4', 'cashier5'], { kiosks: { n: 4, tier: 2 } }))).toBeLessThan(1 + LANE_GUESTS_MAX);
  });

  it('прибавка видна в прогнозе гостей дня, и «Развитие» показывает, сколько даст следующая касса', () => {
    const before = shop(2, []);
    const after = withNextTill(before)!;
    expect(after.staff.map((m) => m.role)).toEqual(['cashier2']);
    expect(guestsToday(after)).toBeGreaterThan(guestsToday(before));
    expect(guestsGain(before, after)).toBe(guestsToday(after) - guestsToday(before));
    // Все места под кассы заняты — следующей кассы нет.
    expect(withNextTill(shop(2, ['cashier2']))).toBeNull();
  });
});

describe('кассы самообслуживания', () => {
  it('места — с «Минимаркета», и чем больше помещение, тем больше', () => {
    expect([0, 1, 2, 3, 4, 5].map((level) => kioskSlots(shop(level, [])))).toEqual(KIOSKS_BY_LEVEL);
    expect(buyKiosk(shop(1, []))).toBeNull();
    expect(nextKioskPrice(shop(2, []))).toBe(KIOSK_PRICES[0]);
  });

  it('ставятся по одному, пока есть места; первый — заодно улучшение «Касса самообслуживания»', () => {
    let s = shop(2, []);
    s = buyKiosk(s)!;
    expect(kioskCount(s)).toBe(1);
    expect(s.upgrades).toContain('selfCheckout');
    expect(s.money).toBe(20000 - KIOSK_PRICES[0]);
    s = buyKiosk(s)!;
    expect(kioskCount(s)).toBe(2);
    expect(s.upgrades?.filter((id) => id === 'selfCheckout')).toHaveLength(1);
    // Мест больше нет — до расширения.
    expect(buyKiosk(s)).toBeNull();
    expect(nextKioskPrice({ ...s, level: 3 })).toBe(KIOSK_PRICES[2]);
    // Денег не хватает — не ставим.
    expect(buyKiosk({ ...shop(2, []), money: 10 })).toBeNull();
  });

  it('старое сохранение с киоском-улучшением — один киоск первой модели', () => {
    const old = shop(2, [], { upgrades: ['selfCheckout'] });
    delete (old as Partial<StoreState>).kiosks;
    expect(kioskCount(old)).toBe(1);
    expect(kioskTier(old)).toBe(KIOSK_TIERS[0]);
    expect(nextKioskPrice(old)).toBe(KIOSK_PRICES[1]);
  });

  it('модель общая для всех: быстрее, реже ошибки и непробитый товар; лучшая — с «Супермаркета»', () => {
    for (let i = 1; i < KIOSK_TIERS.length; i++) {
      const [a, b] = [KIOSK_TIERS[i - 1], KIOSK_TIERS[i]];
      expect(b.item).toBeLessThan(a.item);
      expect(b.error).toBeLessThan(a.error);
      expect(b.skip).toBeLessThan(a.skip);
      expect(b.lane).toBeGreaterThan(a.lane);
      expect(b.maxItems).toBeGreaterThanOrEqual(a.maxItems);
    }
    // Без киоска обновлять нечего.
    expect(upgradeKiosks(shop(2, []))).toBeNull();
    const one = buyKiosk(shop(2, []))!;
    const up = upgradeKiosks(one)!;
    expect(kioskTier(up)).toBe(KIOSK_TIERS[1]);
    expect(up.money).toBe(one.money - KIOSK_TIERS[1].price);
    expect(upgradeKiosks(up)).toBeNull();
    expect(kioskTier(upgradeKiosks({ ...up, level: 3 })!)).toBe(KIOSK_TIERS[2]);
    // Новый киоск ставится сразу текущей модели.
    expect(kioskTier(buyKiosk(up)!)).toBe(KIOSK_TIERS[1]);
  });

  it('каждый киоск зовёт гостей — меньше кассы с кассиром, а новая модель — больше', () => {
    const base = shop(4, []);
    const k1 = buyKiosk(base)!;
    const k2 = buyKiosk(k1)!;
    expect(laneGuests(k1)).toBeGreaterThan(laneGuests(base));
    expect(laneGuests(k2) - laneGuests(k1)).toBeLessThan(laneGuests(k1) - laneGuests(base));
    expect(laneGuests(k1)).toBeLessThan(laneGuests(shop(4, ['cashier2'])));
    expect(laneGuests(upgradeKiosks(k2)!)).toBeGreaterThan(laneGuests(k2));
    expect(openRegisters(k2)).toBe(3);
  });

  it('в зале все киоски помещаются у правой стены: не на кассах, не на очереди, не друг на друге', () => {
    for (let level = 2; level <= 5; level++) {
      const layout = layoutFor(level);
      const n = KIOSKS_BY_LEVEL[level];
      // Мест под киоски — столько же, сколько под кассы (в гипермаркете касс пять, киосков — четыре).
      expect(n).toBe(Math.min(4, REGISTERS_BY_LEVEL[level]));
      const others = tillZones(layout, REGISTERS_BY_LEVEL[level], 0).filter((z) => !kioskZones(layout, 1).some((k) => k.x === z.x && k.y === z.y));
      for (let i = 0; i < n; i++) {
        const k = kioskRect(layout, i);
        expect(k.x + k.w, `уровень ${level}, киоск ${i}`).toBeLessThanOrEqual(layout.w);
        for (const z of others) expect(overlapsRect(k, z), `уровень ${level}, киоск ${i}`).toBe(false);
        for (let j = 0; j < i; j++) expect(overlapsRect(k, kioskRect(layout, j))).toBe(false);
        // Покупатель встаёт слева от киоска — не на месте кассира и не за стеной.
        const spot = kioskSpot(layout, i);
        for (let r = 1; r < REGISTERS_BY_LEVEL[level]; r++) expect(Math.hypot(spot.x - 14 - registerSpot(layout, r).x, spot.y + 4 - registerSpot(layout, r).y)).toBeGreaterThan(20);
      }
    }
  });

  it('место под киоск занято полкой (своя расстановка) — поставить нельзя, пока не переставят', () => {
    const s = shop(4, []);
    expect(kioskSpotFree(s, 0)).toBe(true);
    const layout = layoutFor(4);
    const k = kioskSpot(layout, 2);
    const at = layout.slots.map((p, i) => (i === layout.slots.length - 1 ? { x: k.x - 12, y: k.y } : p));
    const moved = { ...s, slotPos: { level: 4, at } };
    expect(kioskSpotFree(moved, 2)).toBe(false);
    expect(kioskSpotFree(moved, 0)).toBe(true);
  });

  it('купили все киоски — ларь с мороженым переезжает и на них не встаёт', () => {
    for (let level = 2; level <= 5; level++) {
      const layout = layoutFor(level);
      const n = KIOSKS_BY_LEVEL[level];
      const ice = iceboxRect(iceboxSpotFor(layout, REGISTERS_BY_LEVEL[level], [], n));
      for (const k of kioskZones(layout, n)) expect(overlapsRect(ice, k), `уровень ${level}`).toBe(false);
    }
  });

  it('симулятор: киоски ставят и обновляют, гостей с ними больше', () => {
    // Четыре прогона: на одном гости к концу шумят (с кнопкой «Закупить нужное» киоски выиграли в 11 сидах из 12).
    const late = (x: ReturnType<typeof simulate>) => x.days.slice(-20).reduce((s, d) => s + d.guests, 0);
    let withKiosks = 0;
    let plain = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const r = simulate({ days: 100, seed, features: { kiosks: true } });
      expect(kioskCount(r.final)).toBeGreaterThan(0);
      withKiosks += late(r);
      plain += late(simulate({ days: 100, seed }));
    }
    expect(withKiosks).toBeGreaterThan(plain);
  }, 30_000);
});

describe('загрузка сохранения: киоски и сменщик', () => {
  let local: Record<string, string> = {};
  beforeEach(() => {
    vi.resetModules();
    local = {};
    Object.assign(globalThis, {
      localStorage: {
        getItem: (k: string) => local[k] ?? null,
        setItem: (k: string, v: string) => (local[k] = v),
        removeItem: (k: string) => delete local[k],
      },
    });
  });
  afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

  it('киоск-улучшение и сменщик в ларьке переживают загрузку (и переезд «касса — хозяина»)', async () => {
    const { loadGame } = await import('../src/game/save');
    const old = shop(0, ['cashier'], { upgrades: ['selfCheckout'] }) as Partial<StoreState>;
    delete old.kiosks;
    delete old.ownerTill;
    delete old.registers;
    local['magazinchik.save'] = JSON.stringify({ version: 11, state: old });
    const s = loadGame()!;
    expect(s.staff.map((m) => m.role)).toEqual(['cashier']);
    expect(s.ownerTill).toBe(true);
    expect(kioskCount({ ...s, level: 2 })).toBe(1);
  });
});

describe('открытая касса — где кассир сегодня на месте', () => {
  it('кассир на больничном или выходном кассу не открывает (и гостей не зовёт); менеджер на смене встаёт за одну пустую', () => {
    const s = shop(3, ['cashier2', 'cashier3'], { plan: { ...ensurePlan(newGame()).plan!, sick: 'cashier2' } });
    expect(staffedTills(shop(3, ['cashier2', 'cashier3']))).toBe(2);
    expect(staffedTills(s)).toBe(1);
    expect(laneGuests(s)).toBeLessThan(laneGuests(shop(3, ['cashier2', 'cashier3'])));
    const off = shop(3, ['cashier2', 'cashier3'], { staff: [{ ...member('cashier2'), offDay: 40 }, member('cashier3')] });
    expect(staffedTills(off)).toBe(1);
    expect(staffedTills({ ...s, staff: [...s.staff, member('manager')] })).toBe(2);
  });
});
