import { describe, expect, it } from 'vitest';
import { newGame, STORE_LEVELS, type StoreState } from '../src/game/economy';
import { BACK_ROOM_FROM, backRoomFree, freeRooms, rentLock, rentRoom, TENANT_IDS, TENANT_ROOMS, tenantRent, tenantRooms, TENANTS, tenantsLook, tenantsNight, tenantsOf, evict, type TenantId } from '../src/game/tenants';
import { simulate } from '../src/game/simulate';
import { BACK_DOOR_HALF, backDoorX, brandRect, brandSpotFor, iceboxRect, iceboxSpotFor, layoutFor, licenseRect, licenseSpotFor, shelfRect, WING_W, type Layout } from '../src/scenes/layout';
import { ru } from '../src/i18n/ru';

// 15.11, автор: «Минимаркет 1, Супермаркет 2, Универмаг 3, Гипермаркет 4». Новая комната с «Супермаркета» — задняя,
// за задней стеной зала (layout.backRoom): правило, место в планировке, старые сохранения, деньги.

const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 60, level: 3, money: 50_000, debt: 0, rating: 4, ...over });
type Rect = { x: number; y: number; w: number; h: number };
const overlap = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('комнаты под аренду: по одной на помещение с «Минимаркета»', () => {
  it('Минимаркет 1, Супермаркет 2, Универмаг 3, Гипермаркет 4', () => {
    expect(TENANT_ROOMS).toEqual([0, 0, 1, 2, 3, 4]);
    expect(STORE_LEVELS).toHaveLength(TENANT_ROOMS.length);
    STORE_LEVELS.forEach((_, level) => expect(tenantRooms(shop({ level })), `уровень ${level}`).toBe(TENANT_ROOMS[level]));
    // Видов больше, чем комнат даже в гипермаркете.
    expect(TENANT_IDS.length).toBeGreaterThan(TENANT_ROOMS.at(-1)!);
  });

  it('в каждом помещении можно сдать ровно столько комнат, сколько положено', () => {
    STORE_LEVELS.forEach((_, level) => {
      let state = shop({ level });
      for (const id of TENANT_IDS) state = rentRoom(state, id) ?? state;
      expect(tenantsOf(state), `уровень ${level}`).toHaveLength(TENANT_ROOMS[level]);
      expect(freeRooms(state)).toBe(0);
    });
  });
});

describe('задняя комната: место в планировке', () => {
  const wallShelves = (L: Layout) => L.slots.filter((p) => p.y === L.slots[0].y);

  it('есть с «Супермаркета», одна и последняя по порядку', () => {
    STORE_LEVELS.forEach((_, level) => {
      const L = layoutFor(level);
      const backs = L.tenants.filter((r) => r.back);
      expect(backs, `уровень ${level}`).toHaveLength(level >= BACK_ROOM_FROM ? 1 : 0);
      if (backs.length) expect(L.tenants.at(-1)).toBe(backs[0]);
    });
  });

  it('стоит за задней стеной в пределах здания и не налезает на другие комнаты', () => {
    for (let level = BACK_ROOM_FROM; level < STORE_LEVELS.length; level++) {
      const L = layoutFor(level);
      const back = L.tenants.find((r) => r.back)!;
      expect(back.w).toBe(WING_W);
      // Над карнизом задней стены (он от −4 до 0), правым краем — не дальше правой стены зала.
      expect(back.y + back.h).toBeLessThanOrEqual(-4);
      expect(back.x).toBeGreaterThan(0);
      expect(back.x + back.w).toBeLessThanOrEqual(L.w);
      // Вывеска магазина посередине над стеной (у гипермаркета — 96 точек) — левее комнаты со стенами.
      expect(L.w / 2 + 48).toBeLessThan(back.x - 6);
      // Экран на фасаде (премиальный свет, building.ts) — справа от вывески, 15 точек.
      expect(L.w / 2 + 50 + 8).toBeLessThanOrEqual(back.x - 6);
      for (const other of [...L.tenants.filter((r) => !r.back), L.warehouse, L.bakery, L.coffee, ...(L.kitchen ? [L.kitchen] : [])]) expect(overlap(back, other)).toBe(false);
    }
  });

  it('дверь — в просвете задней стены: не за полкой, не на туалете, внутри комнаты', () => {
    for (let level = BACK_ROOM_FROM; level < STORE_LEVELS.length; level++) {
      const L = layoutFor(level);
      const back = L.tenants.find((r) => r.back)!;
      const x = back.doorway.x;
      const door = { x: x - BACK_DOOR_HALF - 2, y: 0, w: 2 * BACK_DOOR_HALF + 4, h: L.wallH + 12 };
      for (const p of wallShelves(L)) expect(Math.abs(p.x - x), `уровень ${level}`).toBeGreaterThanOrEqual(20 + BACK_DOOR_HALF);
      // Полка на вид — 40 точек (её препятствие shelfRect шире на проход и кончается выше пола под дверью).
      for (const p of L.slots) expect(overlap({ ...shelfRect(p), x: p.x - 20, w: 40 }, { ...door, y: L.wallH - 4, h: 16 })).toBe(false);
      for (const p of L.slots) expect(shelfRect(p).y + shelfRect(p).h <= back.doorway.y - 6 || Math.abs(p.x - x) > 34).toBe(true);
      // Туалет — дверь в той же стене справа; между ними остаётся место под электрощиток (12 точек).
      expect(L.wc.x - 8 - (x + BACK_DOOR_HALF)).toBeGreaterThanOrEqual(14);
      expect(x).toBeGreaterThan(back.x + 4);
      expect(x).toBeLessThan(back.x + back.w - 4);
      // Точка в зале — под дверью на полу, в комнате — у порога.
      expect(back.doorway.y).toBeGreaterThan(L.wallH);
      expect(back.inside.y).toBeLessThan(back.y + back.h);
      expect(back.inside.y).toBeGreaterThan(back.y + 14);
    }
  });

  it('ларь, полка «От бабушки» и «Витрина 18+» не встают в проход к двери', () => {
    for (let level = BACK_ROOM_FROM; level < STORE_LEVELS.length; level++) {
      const L = layoutFor(level);
      const back = L.tenants.find((r) => r.back)!;
      const aisle = { x: back.doorway.x - 10, y: L.wallH, w: 20, h: 24 };
      for (const registers of [1, 2, 4]) {
        expect(overlap(iceboxRect(iceboxSpotFor(L, registers)), aisle)).toBe(false);
        expect(overlap(brandRect(brandSpotFor(L, registers)), aisle)).toBe(false);
        expect(overlap(licenseRect(licenseSpotFor(L, registers)), aisle)).toBe(false);
      }
    }
  });

  it('проём в стене — только когда комнату сняли, и только в Центре', () => {
    const L = layoutFor(3);
    const back = L.tenants.find((r) => r.back)!;
    expect(backDoorX(L, shop({ tenants: ['pickup'] }))).toBeNull();
    expect(backDoorX(L, shop({ tenants: ['pickup', 'atm'] }))).toBe(back.doorway.x);
    expect(backDoorX(layoutFor(2), shop({ level: 2, tenants: ['pickup'] }))).toBeNull();
    const zar = shop({ tenants: ['pickup', 'atm'], zar: { at: 'zar', level: 0, away: { level: 3 } } as unknown as StoreState['zar'] });
    expect(backDoorX(L, zar)).toBeNull();
  });
});

describe('старые сохранения', () => {
  it('«Супермаркет» с одним арендатором: он на месте, новая комната свободна и сдаётся за обычную отделку', () => {
    const old = shop({ level: 3, tenants: ['pharmacy'], tenantUp: { pharmacy: 1 }, tenantPal: { pharmacy: 2 } });
    expect(tenantsOf(old)).toEqual(['pharmacy']);
    expect(freeRooms(old)).toBe(1);
    expect(backRoomFree(old)).toBe(true);
    expect(rentLock(old, 'barber')).toBeNull();
    const next = rentRoom(old, 'barber')!;
    expect(next.money).toBe(old.money - TENANTS.barber.setup);
    // Порядок комнат прежний: старый арендатор во флигеле, новый — в задней комнате.
    expect(tenantsOf(next)).toEqual(['pharmacy', 'barber']);
    expect(next.tenantUp).toEqual({ pharmacy: 1 });
    expect(next.tenantPal).toEqual({ pharmacy: 2 });
    expect(backRoomFree(next)).toBe(false);
  });

  it('гипермаркет с тремя арендаторами: четвёртая комната свободна; полный список не трогаем', () => {
    const old = shop({ level: 5, tenants: ['pickup', 'pharmacy', 'repair'] });
    expect(freeRooms(old)).toBe(1);
    expect(backRoomFree(old)).toBe(true);
    const full = rentRoom(old, 'toys')!;
    expect(tenantsOf(full)).toEqual(['pickup', 'pharmacy', 'repair', 'toys']);
    expect(rentLock(full, 'barber')).toBe('full');
  });

  it('лишних арендаторов (помещение меньше) не считаем: ни в комнатах, ни в аренде', () => {
    const many: TenantId[] = ['pickup', 'pharmacy', 'repair', 'toys', 'barber'];
    const mini = shop({ level: 2, tenants: many });
    expect(tenantsOf(mini)).toEqual(['pickup']);
    expect(tenantRent(mini)).toBe(TENANTS.pickup.rent);
    expect(freeRooms(mini)).toBe(0);
    expect(backRoomFree(mini)).toBe(false);
    expect(tenantsOf(shop({ level: 5, tenants: many }))).toEqual(many.slice(0, 4));
    // Расстались с первым — остальные сдвигаются по комнатам, задняя освобождается.
    const hyper = shop({ level: 5, tenants: many.slice(0, 4) });
    expect(tenantsOf(evict(hyper, 'pickup'))).toEqual(['pharmacy', 'repair', 'toys']);
    expect(backRoomFree(evict(hyper, 'pickup'))).toBe(true);
  });

  it('без поля tenants и в ларьке — ничего не ломается', () => {
    expect(tenantsOf(shop({ tenants: undefined }))).toEqual([]);
    expect(backRoomFree(shop({ tenants: undefined }))).toBe(true);
    expect(backRoomFree(shop({ level: 0 }))).toBe(false);
    expect(tenantsLook(shop({ level: 3 }))).toMatch(/^2:/);
  });
});

describe('деньги', () => {
  it('аренда вечером — со всех четырёх комнат гипермаркета, одинаково при каждом пересчёте', () => {
    const ids: TenantId[] = ['pickup', 'pharmacy', 'repair', 'barber'];
    const state = shop({ level: 5, tenants: ids });
    const sum = ids.reduce((s, id) => s + TENANTS[id].rent, 0);
    expect(tenantRent(state)).toBe(sum);
    const night = tenantsNight(state);
    expect(night.income).toBe(sum);
    expect(night.state.money).toBe(state.money + sum);
    expect(tenantsNight(state)).toEqual(night);
  });

  it('новая комната прибавляет к аренде не больше одной самой дорогой комнаты', () => {
    const best = Math.max(...TENANT_IDS.map((id) => TENANTS[id].rent));
    for (let level = BACK_ROOM_FROM; level < STORE_LEVELS.length; level++) {
      // Сколько можно получить максимум: самые дорогие арендаторы во все комнаты.
      const top = [...TENANT_IDS].sort((a, b) => TENANTS[b].rent - TENANTS[a].rent);
      const before = shop({ level, tenants: top.slice(0, TENANT_ROOMS[level] - 1) });
      const after = shop({ level, tenants: top.slice(0, TENANT_ROOMS[level]) });
      expect(tenantRent(after) - tenantRent(before)).toBeLessThanOrEqual(best);
      expect(tenantRent(after)).toBeGreaterThan(tenantRent(before));
    }
  });

  it('симулятор сдаёт и новую комнату; прогон с тем же зерном повторяется', () => {
    const a = simulate({ days: 70, seed: 7, features: { tenants: true } });
    const b = simulate({ days: 70, seed: 7, features: { tenants: true } });
    expect(a.final.money).toBe(b.final.money);
    expect(a.final.tenants).toEqual(b.final.tenants);
    expect(a.final.level).toBeGreaterThanOrEqual(BACK_ROOM_FROM);
    expect(tenantsOf(a.final)).toHaveLength(tenantRooms(a.final));
  }, 60_000);
});

describe('тексты', () => {
  it('строчка о свободной комнате и подпись раздела есть', () => {
    expect(ru['tenant.freeRoom']).toContain('🔑');
    expect(ru['tenant.backRoom']).toBeTruthy();
    expect(ru['tenant.roomsFree']).toContain('{max}');
  });
});
