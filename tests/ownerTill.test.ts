import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newGame, type StaffMember, type StaffRole, type StoreState } from '../src/game/economy';
import { cashierCount, idleRegisters, migrateOwnerTill, nextCashierRole, registerOfRole, tillRole } from '../src/game/registers';
import { canTradeAway } from '../src/game/away';
import { simulate } from '../src/game/simulate';

// «Касса — хозяина»: за первой кассой всегда сам игрок, кассиры — за второй и дальше, сменщик
// подменяет хозяина, пока тот в зале. Старые сохранения переезжают без потерь.
const member = (role: StaffRole, patch: Partial<StaffMember> = {}): StaffMember => ({ role, name: 3, skill: 2, wage: 420, months: 4, ...patch });
const shop = (level: number, registers: number, roles: StaffRole[], patch: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  day: 40,
  level,
  registers,
  money: 5000,
  staff: roles.map((role) => member(role)),
  ...patch,
});
const roles = (s: StoreState) => s.staff.map((m) => m.role);

describe('кассы и кассиры', () => {
  it('первая касса — хозяина, у остальных свои кассиры', () => {
    expect([0, 1, 2, 3].map(tillRole)).toEqual([undefined, 'cashier2', 'cashier3', 'cashier4']);
    // Сменщик встаёт за кассу хозяина (0), не-кассир — нигде.
    expect(registerOfRole('cashier')).toBe(0);
    expect(registerOfRole('cashier3')).toBe(2);
    expect(registerOfRole('loader')).toBe(-1);
  });

  it('кого брать следующим: кассира за свободную кассу, а когда своих касс нет — сменщика', () => {
    // В ларьке сменщика ещё нет — хозяин справляется сам; с «Магазинчика» — можно.
    expect(nextCashierRole(shop(0, 1, []))).toBeNull();
    expect(nextCashierRole(shop(1, 1, []))).toBe('cashier');
    expect(nextCashierRole(shop(1, 1, ['cashier']))).toBeNull();
    // Место под вторую кассу есть (её докупят) — сначала кассир за неё.
    expect(nextCashierRole(shop(2, 1, []))).toBe('cashier2');
    expect(nextCashierRole(shop(2, 2, ['cashier2']))).toBe('cashier');
    expect(nextCashierRole(shop(4, 4, ['cashier2', 'cashier4']))).toBe('cashier3');
  });

  it('касса без кассира считается простаивающей, касса хозяина — нет', () => {
    expect(idleRegisters(shop(0, 1, []))).toBe(0);
    expect(idleRegisters(shop(3, 3, ['cashier2']))).toBe(1);
    expect(cashierCount(shop(3, 3, ['cashier', 'cashier2', 'loader']))).toBe(2);
  });

  it('пока игрока нет, торгует любой кассир — и сменщик, и кассир своей кассы', () => {
    expect(canTradeAway(shop(2, 2, ['cashier2']))).toBe(true);
    expect(canTradeAway(shop(0, 1, ['cashier']))).toBe(true);
    expect(canTradeAway(shop(2, 2, ['loader']))).toBe(false);
  });
});

describe('старые сохранения: кассир переходит за свою кассу', () => {
  it('кассир с первой кассы — за вторую, если она стоит и свободна', () => {
    const s = migrateOwnerTill(shop(2, 2, ['cashier', 'loader']));
    expect(roles(s)).toEqual(['cashier2', 'loader']);
    expect(s.ownerTill).toBe(true);
    // Тот же человек: имя, навык, зарплата и стаж не меняются.
    expect(s.staff[0]).toEqual({ ...member('cashier'), role: 'cashier2' });
  });

  it('касса одна — остаётся сменщиком: никого не увольняем и денег не берём', () => {
    const before = shop(1, 1, ['cashier']);
    const s = migrateOwnerTill(before);
    expect(roles(s)).toEqual(['cashier']);
    expect(s.money).toBe(before.money);
  });

  it('все кассы заняты — тоже сменщик; в универмаге встаёт за свободную четвёртую', () => {
    expect(roles(migrateOwnerTill(shop(2, 2, ['cashier', 'cashier2'])))).toEqual(['cashier', 'cashier2']);
    expect(roles(migrateOwnerTill(shop(4, 4, ['cashier', 'cashier2', 'cashier3'])))).toEqual(['cashier4', 'cashier2', 'cashier3']);
    // Сохранение без поля registers (кассы ставились сами при стройке) — тоже.
    expect(roles(migrateOwnerTill(shop(3, undefined as never, ['cashier', 'cashier2'])))).toEqual(['cashier3', 'cashier2']);
  });

  it('за кассами работает столько же людей, сколько раньше', () => {
    // Раньше: кассир за первой, хозяин — за первой свободной. Теперь: хозяин за первой, кассиры — за своими.
    for (const [level, registers, hired] of [
      [1, 1, ['cashier']],
      [2, 2, ['cashier']],
      [2, 2, ['cashier', 'cashier2']],
      [3, 3, ['cashier', 'cashier3']],
      [4, 4, ['cashier', 'cashier2', 'cashier3', 'cashier4']],
    ] as [number, number, StaffRole[]][]) {
      const before = shop(level, registers, hired);
      const oldManned = Math.min(registers, hired.length + 1);
      const s = migrateOwnerTill(before);
      const tills = s.staff.filter((m) => m.role !== 'cashier' && registerOfRole(m.role) > 0 && registerOfRole(m.role) < registers).length;
      expect(1 + tills).toBe(oldManned);
    }
  });

  it('вместе с ролью переезжает всё, что на неё ссылается', () => {
    const before = shop(2, 2, ['cashier'], {
      plan: { day: 40, decided: false, inspection: false, quests: [], sick: 'cashier', event: { kind: 'dayOff', role: 'cashier', reason: 0 } },
      staffEvent: { kind: 'best', roles: ['cashier'], day: 40 },
      jobSearch: { day: 40, role: 'cashier2', candidates: [member('cashier2', { months: 0 })] },
    });
    const s = migrateOwnerTill(before);
    expect(s.plan?.sick).toBe('cashier2');
    expect(s.plan?.event).toEqual({ kind: 'dayOff', role: 'cashier2', reason: 0 });
    expect(s.staffEvent?.roles).toEqual(['cashier2']);
    // Объявление на вторую кассу (её место уже занято переехавшим) становится объявлением на сменщика.
    expect(s.jobSearch?.role).toBe('cashier');
    expect(s.jobSearch?.candidates.map((c) => c.role)).toEqual(['cashier']);
  });

  it('без кассира — только отметка, остальное как было', () => {
    const before = shop(2, 2, ['loader']);
    expect(migrateOwnerTill(before)).toEqual({ ...before, ownerTill: true });
  });
});

describe('загрузка сохранения', () => {
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

  it('старое сохранение переезжает один раз, новое не трогаем', async () => {
    const { loadGame, saveGame } = await import('../src/game/save');
    const old = shop(2, 2, ['cashier']) as Partial<StoreState>;
    delete old.ownerTill;
    local['magazinchik.save'] = JSON.stringify({ version: 11, state: old });
    const s = loadGame()!;
    expect(roles(s)).toEqual(['cashier2']);
    expect(s.ownerTill).toBe(true);
    // Потом игрок нанял сменщика — при следующей загрузке он так и остаётся сменщиком.
    saveGame({ ...s, staff: [...s.staff, member('cashier')] });
    expect(roles(loadGame()!)).toEqual(['cashier2', 'cashier']);
  });
});

describe('симулятор: хозяин всегда за своей кассой', () => {
  it('навык кассы хозяина растёт и с кассирами', () => {
    const r = simulate({ days: 60, seed: 2 });
    expect(r.final.staff.some((m) => m.role === 'cashier2' || m.role === 'cashier')).toBe(true);
    // Раньше с первым кассиром навык замирал; теперь хозяин пробивает весь день сам — до сменщика
    // (с «Магазинчика»): тот встаёт за кассу хозяина, и дальше хозяин уже не пробивает (по 8 прогонам — 270–580).
    expect(r.final.ownerServed).toBeGreaterThan(250);
  });

  it('кассира за кассу, которой нет, не нанимают', () => {
    for (let seed = 1; seed <= 4; seed++) {
      const { final } = simulate({ days: 100, seed });
      for (const m of final.staff) if (m.role !== 'cashier' && registerOfRole(m.role) > 0) expect(registerOfRole(m.role)).toBeLessThan(final.registers ?? 1);
    }
  });
});
