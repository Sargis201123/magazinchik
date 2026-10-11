import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buyShelf,
  canPlace,
  daysUntilSeason,
  freeSlots,
  monthlyBill,
  newGame,
  normalizeShelves,
  productAvailable,
  sellableProducts,
  sellShelf,
  shelfFor,
  slotOf,
  storeLevel,
  upgradeCost,
  upgradeShelf,
  FRIDGE_POWER,
  MONTH_DAYS,
  SHELF_KINDS,
  type Shelf,
  type StoreState,
  type Unit,
} from '../src/game/economy';
import { YEAR_MONTHS } from '../src/game/calendar';
import { planDay } from '../src/game/events';

// Сезонные места: ларь с мороженым у входа и вёдра с цветами у кассы. Это «полки», но на своих
// местах: мест под полки в зале не занимают, ларь — один, вёдра — бесплатные и есть у всех.
const year = Array.from({ length: YEAR_MONTHS * MONTH_DAYS }, (_, i) => i + 1);
const summer = year.find((d) => productAvailable('icecream', d))!;
const winter = year.find((d) => !productAvailable('icecream', d))!;
const spring = year.find((d) => productAvailable('flowers', d))!;
const units = (n: number): Unit[] => Array.from({ length: n }, () => ({ age: 0 }));
const rich = (s: StoreState = newGame()): StoreState => ({ ...s, money: 1e6, debt: 0 });

describe('ларь с мороженым и вёдра с цветами', () => {
  it('мороженое — только в ларе, цветы — только в вёдрах, мандарины — на овощном прилавке', () => {
    const shelf = (kind: Shelf['kind']): Shelf => ({ kind, level: 0, items: {} });
    expect(canPlace('icecream', shelf('icebox'))).toBe(true);
    expect(canPlace('icecream', shelf('dairy'))).toBe(false);
    expect(canPlace('flowers', shelf('florist'))).toBe(true);
    expect(canPlace('flowers', shelf('produce'))).toBe(false);
    expect(canPlace('tangerines', shelf('produce'))).toBe(true);
    expect(canPlace('milk', shelf('icebox'))).toBe(false);
  });

  it('вёдра для цветов есть с первого дня: весной цветы можно продавать без покупок', () => {
    const s = newGame();
    expect(s.shelves.some((sh) => sh.kind === 'florist')).toBe(true);
    expect(sellableProducts({ ...s, day: spring })).toContain('flowers');
    // Вёдра бесплатные — их не продать (иначе бесконечные деньги ни из чего не берутся, но и смысла нет).
    expect(SHELF_KINDS.florist.price).toBe(0);
    expect(sellShelf(s, s.shelves.findIndex((sh) => sh.kind === 'florist'))).toBeNull();
  });

  it('без ларя мороженое не продаётся даже летом; ларь — один и места в зале не занимает', () => {
    let s = rich();
    expect(sellableProducts({ ...s, day: summer })).not.toContain('icecream');
    // Занимаем все места в зале — ларь всё равно ставится (он на улице у входа).
    while (freeSlots(s) > 0) s = buyShelf(s, 'bakery')!;
    expect(buyShelf(s, 'bakery')).toBeNull();
    const before = s.money;
    s = buyShelf(s, 'icebox')!;
    expect(s).not.toBeNull();
    expect(before - s.money).toBe(SHELF_KINDS.icebox.price);
    expect(freeSlots(s)).toBe(0);
    expect(buyShelf(s, 'icebox')).toBeNull();
    expect(sellableProducts({ ...s, day: summer })).toContain('icecream');
    expect(sellableProducts({ ...s, day: winter })).not.toContain('icecream');
    // Покупатель за мороженым идёт именно к ларю.
    expect(s.shelves[shelfFor(s, 'icecream')].kind).toBe('icebox');
  });

  it('ларь продаётся за половину цены, как обычная полка; товар с него — на склад', () => {
    let s = buyShelf(rich(), 'icebox')!;
    const i = s.shelves.findIndex((sh) => sh.kind === 'icebox');
    s = { ...s, shelves: s.shelves.map((sh, k) => (k === i ? { ...sh, items: { icecream: units(3) } } : sh)) };
    const sold = sellShelf(s, i)!;
    expect(sold.money - s.money).toBe(SHELF_KINDS.icebox.price / 2);
    expect(sold.warehouse.icecream).toHaveLength(3);
    expect(sold.shelves.some((sh) => sh.kind === 'icebox')).toBe(false);
  });

  it('ларь и вёдра улучшаются только раз: сезонный товар больше мест не окупит', () => {
    let s = buyShelf(rich(), 'icebox')!;
    const i = s.shelves.findIndex((sh) => sh.kind === 'icebox');
    expect(upgradeCost(s.shelves[i])).not.toBeNull();
    s = upgradeShelf(s, i)!;
    expect(upgradeCost(s.shelves[i])).toBeNull();
    expect(upgradeShelf(s, i)).toBeNull();
    const f = s.shelves.findIndex((sh) => sh.kind === 'florist');
    expect(upgradeCost(upgradeShelf(s, f)!.shelves[f])).toBeNull();
  });

  it('номера мест в зале считаются только по обычным полкам', () => {
    const s = buyShelf(rich(), 'icebox')!;
    const kinds = s.shelves.map((sh) => sh.kind);
    expect(kinds).toEqual(['bakery', 'produce', 'florist', 'icebox']);
    expect(s.shelves.map((_, i) => slotOf(s, i))).toEqual([0, 1, -1, -1]);
    const more = buyShelf(s, 'dairy')!;
    expect(slotOf(more, more.shelves.length - 1)).toBe(2);
    expect(freeSlots(more)).toBe(storeLevel(more).slots - 3);
  });

  it('свет: ларь работает только летом, зимой выключен и денег не берёт', () => {
    const s = buyShelf(rich(), 'icebox')!;
    const base = newGame();
    const extra = (day: number) => monthlyBill({ ...s, day }).power - monthlyBill({ ...base, day }).power;
    expect(extra(summer)).toBe(FRIDGE_POWER);
    expect(extra(winter)).toBe(0);
  });

  it('выключенный зимой ларь не «ломается», а летом может', () => {
    // Из холодильников — только ларь: поломка возможна лишь в сезон.
    const s = buyShelf(rich(), 'icebox')!;
    const days = Array.from({ length: 3 * year.length }, (_, i) => i + 4);
    const broke = days.filter((day) => planDay({ ...s, day }).event?.kind === 'fridgeBroken');
    expect(broke.length).toBeGreaterThan(0);
    for (const day of broke) expect(productAvailable('icecream', day)).toBe(true);
  });

  it('сколько ждать сезона: 0 — сезон сейчас, иначе через столько дней он начнётся', () => {
    expect(daysUntilSeason('icecream', summer)).toBe(0);
    const n = daysUntilSeason('icecream', winter);
    expect(n).toBeGreaterThan(0);
    expect(productAvailable('icecream', winter + n)).toBe(true);
    expect(productAvailable('icecream', winter + n - 1)).toBe(false);
    expect(daysUntilSeason('bread', winter)).toBe(0);
  });
});

describe('старые сохранения: мороженое и цветы переезжают', () => {
  const legacy = (): StoreState => ({
    ...newGame(),
    shelves: [
      { kind: 'bakery', level: 0, items: {} },
      { kind: 'produce', level: 0, items: { apples: units(2), flowers: units(3), tangerines: units(2) } },
      { kind: 'dairy', level: 0, items: { milk: units(2), icecream: units(12) } },
    ],
    warehouse: {},
  });

  it('у кого был молочный холодильник — ставим ларь и переносим мороженое; цветы — в вёдра', () => {
    const s = normalizeShelves(legacy(), true);
    const box = s.shelves.find((sh) => sh.kind === 'icebox')!;
    const florist = s.shelves.find((sh) => sh.kind === 'florist')!;
    expect(box.items.icecream).toHaveLength(8); // ларь ур.0 вмещает 8
    expect(s.warehouse.icecream).toHaveLength(4); // остальное — на склад, ничего не пропало
    expect(florist.items.flowers).toHaveLength(3);
    expect(s.shelves.find((sh) => sh.kind === 'dairy')!.items.icecream).toBeUndefined();
    expect(s.shelves.find((sh) => sh.kind === 'produce')!.items).toEqual({ apples: units(2), tangerines: units(2) });
    expect(s.shelves.find((sh) => sh.kind === 'dairy')!.items.milk).toHaveLength(2);
    // Ларь подарен — денег не списали; повторная загрузка ничего не меняет.
    expect(s.money).toBe(legacy().money);
    expect(normalizeShelves(s, false)).toBe(s);
  });

  it('новое сохранение: ларь не дарим снова, если его продали', () => {
    const s = normalizeShelves(legacy(), false);
    expect(s.shelves.some((sh) => sh.kind === 'icebox')).toBe(false);
    expect(s.warehouse.icecream).toHaveLength(12);
  });

  it('без молочного холодильника ларь не дарим', () => {
    const noDairy = { ...legacy(), shelves: legacy().shelves.filter((sh) => sh.kind !== 'dairy') };
    expect(normalizeShelves(noDairy, true).shelves.some((sh) => sh.kind === 'icebox')).toBe(false);
  });
});

// Загрузка из телефона: старая версия (10) — с переносом, новая — как есть.
let local: Record<string, string> = {};
beforeEach(() => {
  vi.resetModules();
  local = {};
  Object.assign(globalThis, {
    localStorage: { getItem: (k: string) => local[k] ?? null, setItem: (k: string, v: string) => (local[k] = v), removeItem: (k: string) => delete local[k] },
  });
});
afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

describe('загрузка сохранения', () => {
  const old = (): StoreState => ({
    ...newGame(),
    shelves: [
      { kind: 'bakery', level: 0, items: {} },
      { kind: 'dairy', level: 0, items: { icecream: units(2) } },
    ],
  });

  it('версия 10: ставим ларь и вёдра, мороженое — в ларь', async () => {
    const { loadGame } = await import('../src/game/save');
    local['magazinchik.save'] = JSON.stringify({ version: 10, state: old() });
    const s = loadGame()!;
    expect(s.shelves.map((sh) => sh.kind).sort()).toEqual(['bakery', 'dairy', 'florist', 'icebox']);
    expect(s.shelves.find((sh) => sh.kind === 'icebox')!.items.icecream).toHaveLength(2);
  });

  it('версия 11: проданный ларь не возвращается', async () => {
    const { loadGame, saveGame } = await import('../src/game/save');
    saveGame({ ...old(), shelves: [{ kind: 'bakery', level: 0, items: {} }, { kind: 'dairy', level: 0, items: {} }, { kind: 'florist', level: 0, items: {} }] });
    const s = loadGame()!;
    expect(s.shelves.some((sh) => sh.kind === 'icebox')).toBe(false);
  });
});
