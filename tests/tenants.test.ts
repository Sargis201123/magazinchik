import { describe, expect, it } from 'vitest';
import { newGame, STORE_LEVELS, type StoreState } from '../src/game/economy';
import { evict, freeRooms, rentLock, rentRoom, TENANT_IDS, TENANT_ROOMS, tenantGuests, tenantRent, tenantRooms, TENANTS, tenantsLook, tenantsNight, tenantsOf } from '../src/game/tenants';
import { guestFactor } from '../src/game/day';
import { layoutFor } from '../src/scenes/layout';
import { ru } from '../src/i18n/ru';

// Арендаторы флигеля (tenants.ts): сколько комнат, кого можно пустить, аренда вечером, гости, место в планировке.

const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 60, level: 4, money: 50_000, debt: 0, rating: 4, ...over });

describe('арендаторы: комнаты', () => {
  it('в ларьке и «Магазинчике» комнат нет, дальше — больше, в гипермаркете три', () => {
    expect(TENANT_ROOMS).toHaveLength(STORE_LEVELS.length);
    expect(TENANT_ROOMS.slice(0, 2)).toEqual([0, 0]);
    for (let i = 1; i < TENANT_ROOMS.length; i++) expect(TENANT_ROOMS[i]).toBeGreaterThanOrEqual(TENANT_ROOMS[i - 1]);
    expect(TENANT_ROOMS.at(-1)).toBe(3);
  });

  it('у каждой комнаты есть место во флигеле: над остальными, не выше зала, с дверью в зал', () => {
    STORE_LEVELS.forEach((_, level) => {
      const layout = layoutFor(level);
      expect(layout.tenants, `уровень ${level}`).toHaveLength(TENANT_ROOMS[level]);
      let below = layout.wing.y;
      for (const room of layout.tenants) {
        expect(room.y + room.h).toBeLessThan(below);
        expect(room.y).toBeGreaterThanOrEqual(4);
        expect(room.doorway.y).toBeGreaterThan(room.y);
        expect(room.doorway.y).toBeLessThan(room.y + room.h);
        below = room.y;
      }
    });
  });
});

describe('арендаторы: пустить и расстаться', () => {
  it('отделку платит хозяин, комната занята, второй раз того же не пустить', () => {
    const before = shop();
    const after = rentRoom(before, 'pickup')!;
    expect(after.money).toBe(before.money - TENANTS.pickup.setup);
    expect(tenantsOf(after)).toEqual(['pickup']);
    expect(rentLock(after, 'pickup')).toBe('here');
    expect(rentRoom(after, 'pickup')).toBeNull();
  });

  it('комнат не больше, чем положено помещению; не хватает денег — нельзя', () => {
    let state = shop();
    for (const id of TENANT_IDS) state = rentRoom(state, id) ?? state;
    expect(tenantsOf(state)).toHaveLength(tenantRooms(state));
    expect(freeRooms(state)).toBe(0);
    const left = TENANT_IDS.find((id) => !tenantsOf(state).includes(id))!;
    expect(rentLock(state, left)).toBe('full');
    expect(rentLock(shop({ money: 10 }), 'toys')).toBe('money');
    expect(rentRoom(shop({ level: 1 }), 'toys')).toBeNull();
  });

  it('расстались — комната свободна, отделку не возвращают', () => {
    const rented = rentRoom(shop(), 'pharmacy')!;
    const free = evict(rented, 'pharmacy');
    expect(tenantsOf(free)).toEqual([]);
    expect(free.money).toBe(rented.money);
    expect(rentLock(free, 'pharmacy')).toBeNull();
  });

  it('вид флигеля меняется, когда меняются арендаторы', () => {
    const empty = shop();
    const rented = rentRoom(empty, 'repair')!;
    expect(tenantsLook(rented)).not.toBe(tenantsLook(empty));
    expect(tenantsLook(evict(rented, 'repair'))).toBe(tenantsLook(empty));
  });
});

describe('арендаторы: польза', () => {
  it('вечером приходит аренда со всех комнат', () => {
    const state = rentRoom(rentRoom(shop(), 'pickup')!, 'pharmacy')!;
    expect(tenantRent(state)).toBe(TENANTS.pickup.rent + TENANTS.pharmacy.rent);
    const night = tenantsNight(state);
    expect(night.income).toBe(tenantRent(state));
    expect(night.state.money).toBe(state.money + night.income);
    expect(tenantsNight(shop()).income).toBe(0);
  });

  it('гостей в зале больше — на долю каждого арендатора', () => {
    const empty = shop();
    const state = rentRoom(empty, 'pickup')!;
    expect(tenantGuests(empty)).toBe(1);
    expect(tenantGuests(state)).toBeCloseTo(1 + TENANTS.pickup.guests);
    expect(guestFactor(state) / guestFactor(empty)).toBeCloseTo(1 + TENANTS.pickup.guests);
  });

  it('отделка окупается за 5–25 дней одной арендой с гостями в «Минимаркете»', () => {
    // Гость «Минимаркета» приносит около 18 прибыли (docs/ECONOMY.md), гостей в день — около 60.
    for (const id of TENANT_IDS) {
      const perDay = TENANTS[id].rent + TENANTS[id].guests * 60 * 18;
      const days = TENANTS[id].setup / perDay;
      expect(days, id).toBeGreaterThan(5);
      expect(days, id).toBeLessThan(25);
    }
  });

  it('старое сохранение без арендаторов и с мусором в списке читается', () => {
    expect(tenantsOf(shop({ tenants: undefined }))).toEqual([]);
    expect(tenantsOf(shop({ tenants: ['pickup', 'nobody' as never] }))).toEqual(['pickup']);
  });
});

describe('арендаторы: тексты', () => {
  it('у каждого есть название, описание и табличка комнаты', () => {
    for (const id of TENANT_IDS) for (const key of [`tenant.${id}.name`, `tenant.${id}.desc`, `wing.tenant.${id}`]) expect(ru[key as keyof typeof ru], key).toBeTruthy();
  });
});
