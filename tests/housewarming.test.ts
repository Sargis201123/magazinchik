import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { billTotal, emptyDayStats, endDay, expandStore, MONTH_DAYS, monthlyBill, newGame, payBill, STORE_LEVELS, type StaffMember, type StoreState } from '../src/game/economy';
import { soloExpandRisk } from '../src/game/tips';

const member = (patch: Partial<StaffMember> = {}): StaffMember => ({ role: 'cashier', name: 0, skill: 1, wage: 360, months: 0, ...patch });

// «Новоселье»: первый счёт после расширения — по аренде и коммуналке старого помещения, иначе стройка,
// полки и новая аренда разом загоняли в долг с пени. Дальше — по новой.
const start = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 10, money: 20_000, debt: 0, ...patch });

describe('новоселье', () => {
  it('после переезда первый счёт — по старой аренде и коммуналке, свет — уже нового помещения', () => {
    const moved = expandStore(start())!;
    expect(moved.level).toBe(1);
    expect(moved.movedFrom).toBe(0);
    const bill = monthlyBill(moved);
    expect(bill.housewarming).toBe(true);
    expect(bill.rent).toBe(STORE_LEVELS[0].rent);
    expect(bill.utilities).toBe(STORE_LEVELS[0].utilities);
    // Свет считается по новому помещению — как у тех, кто живёт в нём давно.
    expect(bill.power).toBe(monthlyBill({ ...moved, movedFrom: undefined }).power);
    expect(billTotal(bill)).toBeLessThan(billTotal(monthlyBill({ ...moved, movedFrom: undefined })));
  });

  it('новоселье — на один счёт: после оплаты поле убрано, следующий счёт — по новой аренде', () => {
    const moved = expandStore(start())!;
    const paid = payBill(moved);
    expect(paid.bill.housewarming).toBe(true);
    expect(paid.bill.rent).toBe(STORE_LEVELS[0].rent);
    expect(paid.state.movedFrom).toBeUndefined();
    const next = monthlyBill(paid.state);
    expect(next.housewarming).toBeUndefined();
    expect(next.rent).toBe(STORE_LEVELS[1].rent);
  });

  it('ночь со счетами отдаёт счёт с пометкой и забирает новоселье; ночь без счетов его не трогает', () => {
    const moved = expandStore(start({ day: MONTH_DAYS * 2 - 1 }))!;
    const quiet = endDay(moved, emptyDayStats(), () => 0.5);
    expect(quiet.bill).toBeNull();
    expect(quiet.state.movedFrom).toBe(0);
    const night = endDay(quiet.state, emptyDayStats(), () => 0.5);
    expect(night.bill?.housewarming).toBe(true);
    expect(night.bill?.rent).toBe(STORE_LEVELS[0].rent);
    expect(night.state.movedFrom).toBeUndefined();
  });

  it('два переезда до счетов — счёт по тому помещению, где встретили прошлые счета', () => {
    const twice = expandStore(expandStore(start({ money: 100_000 }))!)!;
    expect(twice.level).toBe(2);
    expect(twice.movedFrom).toBe(0);
    expect(monthlyBill(twice).rent).toBe(STORE_LEVELS[0].rent);
  });

  it('старое сохранение без поля: счёт как раньше, без пометки', () => {
    const old = start({ level: 2 });
    delete (old as Partial<StoreState>).movedFrom;
    const bill = monthlyBill(old);
    expect(bill.housewarming).toBeUndefined();
    expect(bill.rent).toBe(STORE_LEVELS[2].rent);
    expect(bill.utilities).toBe(STORE_LEVELS[2].utilities);
    // Поле из будущего (уровень выше нынешнего) не делает счёт ни дороже, ни дешевле.
    expect(monthlyBill({ ...old, movedFrom: 4 })).toEqual(bill);
  });
});

describe('новоселье в сохранении', () => {
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

  it('старое сохранение грузится без поля, новое — с ним', async () => {
    const { loadGame, saveGame } = await import('../src/game/save');
    local['magazinchik.save'] = JSON.stringify({ version: 11, state: { ...newGame(), day: 30, level: 2 } });
    const old = loadGame()!;
    expect(old.movedFrom).toBeUndefined();
    expect(monthlyBill(old).rent).toBe(STORE_LEVELS[2].rent);
    saveGame(expandStore({ ...old, money: 50_000, debt: 0 })!);
    const back = loadGame()!;
    expect(back.level).toBe(3);
    expect(back.movedFrom).toBe(2);
    expect(monthlyBill(back).rent).toBe(STORE_LEVELS[2].rent);
  });
});

describe('одиночка выше третьего помещения', () => {
  it('предупреждение — только без персонала и только при расширении из третьего помещения и дальше', () => {
    expect(soloExpandRisk(start({ level: 0, staff: [] }))).toBe(false);
    expect(soloExpandRisk(start({ level: 1, staff: [] }))).toBe(false);
    expect(soloExpandRisk(start({ level: 2, staff: [] }))).toBe(true);
    expect(soloExpandRisk(start({ level: 3, staff: [] }))).toBe(true);
    // Универмаг — расширяться некуда.
    expect(soloExpandRisk(start({ level: STORE_LEVELS.length - 1, staff: [] }))).toBe(false);
    // Хоть один нанятый (и друг из Telegram на работе) — уже не один.
    expect(soloExpandRisk(start({ level: 2, staff: [member()] }))).toBe(false);
    expect(soloExpandRisk(start({ level: 2, staff: [member({ friend: { id: 7, name: 'Оля' } })] }))).toBe(false);
    // Друзья на подмоге на один день — не персонал.
    expect(soloExpandRisk(start({ level: 2, staff: [], helpDay: 10 }))).toBe(true);
    // Пекарь, бариста, повар — в пристройках, сторож ловит воров: касса, полки и склад всё равно на хозяине.
    for (const role of ['baker', 'barista', 'cook', 'guard'] as const) expect(soloExpandRisk(start({ level: 2, staff: [member({ role })] }))).toBe(true);
    expect(soloExpandRisk(start({ level: 2, staff: [member({ role: 'baker' }), member({ role: 'guard' })] }))).toBe(true);
    // Кто-то в зале — кассир любой кассы, грузчик, уборщица, менеджер — уже не один.
    for (const role of ['cashier', 'cashier2', 'loader', 'cleaner', 'manager'] as const) expect(soloExpandRisk(start({ level: 2, staff: [member({ role })] }))).toBe(false);
  });
});
