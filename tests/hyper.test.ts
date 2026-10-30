import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { billTotal, expandStore, newLifetime, HYPER_LEVEL, monthlyBill, newGame, nextStoreLevel, STORE_LEVELS, type StoreState } from '../src/game/economy';
import { BRANCH_LEVEL, BRANCH_REF_MAX, branchInOldShop, branchLook, branchRef, branchUsual, buyBranch, hyperLock, isHyper, OLD_SHOP_SCALE, upgradeBranch } from '../src/game/branch';
import { mainGoal } from '../src/game/nudge';
import { soloExpandRisk } from '../src/game/tips';
import { canSell } from '../src/game/legacy';
import { buyRegister, nextCashierRole, nextRegisterPrice, registerCount, registerSlots, nextRegisterCount, REGISTER_PRICES } from '../src/game/registers';
import { STAFF_LIMIT, STAFF_ROLE_IDS } from '../src/game/economy';
import { kioskSlots } from '../src/game/lanes';
import { loanLimit } from '../src/game/bank';
import { CHAPTERS } from '../src/game/story';
import { ACHIEVEMENTS } from '../src/game/achievements';
import { layoutFor } from '../src/scenes/layout';

// Переезд в гипермаркет (economy.ts HYPER_LEVEL, branch.ts): шестое помещение открывается только
// с филиалом в здании «Гиганта»; старый магазин становится филиалом, ступени остаются, доход не прыгает.

const story = { ...newGame().story, chapter: CHAPTERS.length };
const shop = (over: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  day: 110,
  level: BRANCH_LEVEL,
  money: 400000,
  debt: 0,
  rating: 4.5,
  story,
  history: Array(7).fill(10000),
  giant: { phase: 'won', since: 90, revenue: 0, target: 0 },
  staff: [],
  ...over,
});
const withBranch = (over: Partial<StoreState> = {}): StoreState => buyBranch(shop(over))!;

describe('пятая касса — только в гипермаркете', () => {
  it('после переезда старые четыре кассы на месте, пятую покупают сами и за неё нанимают cashier5', () => {
    // Сохранение до пятой кассы: четыре кассы и кассиры второй–четвёртой.
    const staff = (['cashier2', 'cashier3', 'cashier4'] as const).map((role) => ({ role, name: 1, skill: 2, wage: 420, months: 3 }));
    const s = expandStore(withBranch({ registers: 4, staff }))!;
    expect(registerCount(s)).toBe(4);
    expect(nextRegisterPrice(s)).toBe(REGISTER_PRICES[4]);
    expect(nextCashierRole(s)).toBe('cashier5');
    const bought = buyRegister(s)!;
    expect(registerCount(bought)).toBe(5);
    expect(bought.money).toBe(s.money - REGISTER_PRICES[4]);
    expect(nextRegisterPrice(bought)).toBeNull();
    // В универмаге места под пятую нет.
    expect(nextRegisterPrice(shop({ registers: 4 }))).toBeNull();
    expect(nextCashierRole(shop({ registers: 4, staff }))).toBe('cashier');
  });

  it('в гипермаркете есть место для всех должностей', () => {
    expect(STAFF_LIMIT[HYPER_LEVEL]).toBe(STAFF_LIMIT[BRANCH_LEVEL] + 1);
    expect(STAFF_LIMIT[HYPER_LEVEL]).toBeGreaterThanOrEqual(STAFF_ROLE_IDS.length);
  });
});

describe('гипермаркет: когда можно переехать', () => {
  it('последнее помещение, больше универмага во всём', () => {
    expect(HYPER_LEVEL).toBe(STORE_LEVELS.length - 1);
    expect(BRANCH_LEVEL).toBe(HYPER_LEVEL - 1);
    const [a, b] = [STORE_LEVELS[BRANCH_LEVEL], STORE_LEVELS[HYPER_LEVEL]];
    for (const k of ['cost', 'slots', 'warehouse', 'rent', 'utilities', 'power', 'guests', 'maxCustomers'] as const) expect(b[k]).toBeGreaterThan(a[k]);
  });

  it('без филиала универмаг — последний: ни цели, ни переезда, ни предупреждений', () => {
    const s = shop();
    expect(hyperLock(s)).toBe('branch');
    expect(hyperLock(shop({ level: 3 }))).toBe('level');
    expect(nextStoreLevel(s)).toBeUndefined();
    expect(expandStore(s)).toBeNull();
    expect(nextRegisterCount(s)).toBeNull();
    expect(soloExpandRisk(s)).toBe(false);
    // Цель дня после сюжета без следующего помещения — испытания недели (как раньше на универмаге).
    expect(mainGoal(s)?.id).not.toBe('level');
  });

  it('с филиалом — переезд за деньги, без долга; первый счёт — новоселье', () => {
    const s = withBranch();
    expect(hyperLock(s)).toBeNull();
    expect(nextStoreLevel(s)).toBe(STORE_LEVELS[HYPER_LEVEL]);
    expect(mainGoal(s)?.id).toBe('level');
    expect(soloExpandRisk(s)).toBe(true);
    expect(expandStore({ ...s, money: STORE_LEVELS[HYPER_LEVEL].cost - 1 })).toBeNull();
    expect(expandStore({ ...s, debt: 10 })).toBeNull();
    const moved = expandStore(s)!;
    expect(moved.level).toBe(HYPER_LEVEL);
    expect(moved.money).toBe(s.money - STORE_LEVELS[HYPER_LEVEL].cost);
    expect(isHyper(moved)).toBe(true);
    const bill = monthlyBill(moved);
    expect(bill.housewarming).toBe(true);
    expect(bill.rent).toBe(STORE_LEVELS[BRANCH_LEVEL].rent);
    expect(nextStoreLevel(moved)).toBeUndefined();
    expect(expandStore(moved)).toBeNull();
    expect(billTotal(monthlyBill({ ...moved, movedFrom: undefined }))).toBeGreaterThan(billTotal(bill));
  });

  it('всё, что зависит от помещения, знает шестое', () => {
    const s = expandStore(withBranch())!;
    expect(registerSlots(s)).toBe(5);
    expect(kioskSlots(s)).toBeGreaterThanOrEqual(4);
    expect(loanLimit(s)).toBeGreaterThan(loanLimit(shop()));
    expect(canSell(s)).toBe(true);
    expect(canSell(shop())).toBe(true);
    expect(layoutFor(HYPER_LEVEL).slots).toHaveLength(STORE_LEVELS[HYPER_LEVEL].slots);
    expect(layoutFor(HYPER_LEVEL).w).toBeGreaterThan(layoutFor(BRANCH_LEVEL).w);
    expect(layoutFor(HYPER_LEVEL).h).toBeGreaterThan(layoutFor(BRANCH_LEVEL).h);
    const done = ACHIEVEMENTS.find((a) => a.id === 'hypermarket')!;
    const life = newLifetime();
    expect(done.progress({ state: s, life } as never)).toEqual([1, 1]);
    expect(done.progress({ state: withBranch(), life } as never)).toEqual([0, 1]);
  });
});

describe('гипермаркет: старый магазин — филиал', () => {
  it('ступени филиала переезжают вместе с ним, вид на улице меняется', () => {
    let s = withBranch();
    s = upgradeBranch(s, 'manager')!;
    s = upgradeBranch(s, 'repair')!;
    const moved = expandStore(s)!;
    expect(moved.branch).toEqual({ ...s.branch, moved: s.day });
    expect(branchInOldShop(s)).toBe(false);
    expect(branchInOldShop(moved)).toBe(true);
    expect(branchLook(moved)).not.toBe(branchLook(s));
    expect(branchLook(moved).startsWith('o')).toBe(true);
  });

  it('доход не прыгает: образец выручки — как у прежнего универмага', () => {
    const s = withBranch({ history: Array(7).fill(10000) });
    // В день переезда вся неделя — ещё выручка универмага: доход филиала тот же.
    const moved = expandStore(s)!;
    expect(moved.branch?.moved).toBe(s.day);
    expect(branchUsual(moved)).toBe(branchUsual(s));
    // Через три дня: три дня гипермаркета (он продаёт больше) уменьшены до размеров старого магазина.
    const later = { ...moved, day: s.day + 3, history: [...Array(4).fill(10000), ...Array(3).fill(10000 / OLD_SHOP_SCALE)] };
    expect(branchRef(later)).toBeCloseTo(branchRef(s), 0);
    // Неделя после переезда — целиком гипермаркет.
    const week = { ...moved, day: s.day + 9, history: Array(7).fill(10000 / OLD_SHOP_SCALE) };
    expect(branchUsual(week)).toBe(branchUsual(s));
    // И никогда выше потолка, сколько бы ни продавал гипермаркет.
    expect(branchRef({ ...moved, history: Array(7).fill(1e6) })).toBe(BRANCH_REF_MAX);
  });
});

// Старые сохранения: универмаг с филиалом и без — загружаются как есть; сохранение гипермаркета — тоже.
let local: Record<string, string> = {};
beforeEach(() => {
  vi.resetModules();
  local = {};
  Object.assign(globalThis, {
    localStorage: { getItem: (k: string) => local[k] ?? null, setItem: (k: string, v: string) => void (local[k] = v), removeItem: (k: string) => delete local[k] },
  });
});
afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

describe('гипермаркет: сохранения', () => {
  it('универмаг без филиала, с филиалом и гипермаркет переживают сохранение и загрузку', async () => {
    const { loadGame, saveGame } = await import('../src/game/save');
    for (const state of [shop(), withBranch(), expandStore(withBranch())!]) {
      saveGame(state);
      const back = loadGame()!;
      expect(back.level).toBe(state.level);
      expect(back.branch).toEqual(state.branch);
      expect(nextStoreLevel(back)).toEqual(nextStoreLevel(state));
    }
  });

  it('старое сохранение универмага (без новых полей) открывается: переезд закрыт до филиала', async () => {
    const { loadGame } = await import('../src/game/save');
    const old = shop() as Partial<StoreState>;
    delete old.branch;
    delete old.movedFrom;
    local['magazinchik.save'] = JSON.stringify({ version: 11, state: old });
    const back = loadGame()!;
    expect(back.level).toBe(BRANCH_LEVEL);
    expect(hyperLock(back)).toBe('branch');
  });
});
