import { describe, expect, it } from 'vitest';
import { buyStock, newGame, onShelves, PRODUCTS, STORE_LEVELS, warehouseOf, type StoreState } from '../src/game/economy';
import { invitePitch, PITCH_BY_SEASON, PITCH_DAYS, PITCH_FROM_DAY, PITCH_GUESTS, pitchDaysLeft, pitchNow, pitchOffer, pitchRent, ASK_EVERY, giveTenant, PAL_MAX, rentOf, skipTenant, tenantAsks, tenantPal, tenantTier, TIER_RENT, upgradeCost, upgradeLock, upgradeTenant, type TenantId, evict, freeRooms, rentLock, rentRoom, TENANT_IDS, TENANT_ROOMS, tenantGuests, tenantRent, tenantRooms, TENANTS, tenantsLook, tenantsNight, tenantsOf } from '../src/game/tenants';
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

describe('арендаторы: вторая отделка, доверие и просьбы (10.11)', () => {
  const rented = (ids: TenantId[], over: Partial<StoreState> = {}): StoreState => ({ ...shop({ level: 5, ...over }), tenants: ids });
  /** На складе по 30 штук того, что просят (бесплатно, как урожай). */
  const stocked = (state: StoreState): StoreState => (['water', 'juice', 'bread'] as const).reduce((s, id) => buyStock({ ...s, warehouse: { ...s.warehouse, [id]: [] } }, id, 30, 0)!, state);

  it('видов больше, чем комнат: есть из кого выбирать', () => {
    expect(TENANT_IDS.length).toBeGreaterThan(TENANT_ROOMS.at(-1)!);
    for (const id of TENANT_IDS) {
      expect(ru[`tenant.${id}.name` as keyof typeof ru]).toBeTruthy();
      expect(ru[`wing.tenant.${id}` as keyof typeof ru]).toBeTruthy();
      if (TENANTS[id].face !== undefined) for (const part of ['who', 'say', 'pal']) expect(ru[`tenant.${id}.${part}` as keyof typeof ru], `${id}.${part}`).toBeTruthy();
    }
  });

  it('вторая отделка: за деньги, один раз, аренда и гости выше; при расставании пропадает', () => {
    const state = rented(['pharmacy']);
    expect(upgradeLock(shop(), 'pharmacy')).toBe('away');
    expect(upgradeLock({ ...state, money: upgradeCost('pharmacy') - 1 }, 'pharmacy')).toBe('money');
    const up = upgradeTenant(state, 'pharmacy')!;
    expect(up.money).toBe(state.money - upgradeCost('pharmacy'));
    expect(tenantTier(up, 'pharmacy')).toBe(2);
    expect(rentOf(up, 'pharmacy')).toBe(Math.round(TENANTS.pharmacy.rent * TIER_RENT));
    expect(tenantGuests(up)).toBeGreaterThan(tenantGuests(state));
    expect(upgradeTenant(up, 'pharmacy')).toBeNull();
    expect(tenantsLook(up)).not.toBe(tenantsLook(state));
    expect(tenantTier(rentRoom(evict(up, 'pharmacy'), 'pharmacy')!, 'pharmacy')).toBe(1);
  });

  it('просьба: раз в несколько дней, товар со склада, платит выше розницы, доверие поднимает аренду', () => {
    const base = stocked(rented(['pickup']));
    const days = Array.from({ length: ASK_EVERY * 2 }, (_, i) => ({ ...base, day: 60 + i }));
    expect(days.filter((s) => tenantAsks(s).length).length).toBe(2);
    const state = days.find((s) => tenantAsks(s).length)!;
    const [ask] = tenantAsks(state);
    expect(ask.ready).toBe(true);
    expect(ask.pay).toBeGreaterThan(PRODUCTS[ask.product].basePrice * ask.qty);
    const done = giveTenant(state, 'pickup')!;
    expect(done.state.money).toBe(state.money + ask.pay);
    const have = (st: StoreState) => warehouseOf(st, ask.product) + onShelves(st, ask.product);
    expect(have(done.state)).toBe(have(state) - ask.qty);
    expect(done.pal).toBe(1);
    expect(rentOf(done.state, 'pickup')).toBeGreaterThan(rentOf(state, 'pickup'));
    // Сегодня больше не просит; отказ тоже закрывает просьбу, но доверия не даёт.
    expect(tenantAsks(done.state)).toEqual([]);
    expect(giveTenant(done.state, 'pickup')).toBeNull();
    expect(tenantAsks(skipTenant(state, 'pickup'))).toEqual([]);
    expect(tenantPal(skipTenant(state, 'pickup'), 'pickup')).toBe(0);
  });

  it('доверие не выше трёх, товара нет — отдать нельзя, банкомат ни о чём не просит', () => {
    let state = rented(['pickup']);
    for (let day = 60; day < 60 + ASK_EVERY * 8; day++) state = giveTenant(stocked({ ...state, day }), 'pickup')?.state ?? { ...state, day };
    expect(tenantPal(state, 'pickup')).toBe(PAL_MAX);
    const bare = (st: StoreState): StoreState => ({ ...st, warehouse: {}, shelves: st.shelves.map((sh) => ({ ...sh, items: {} })) });
    const empty = Array.from({ length: ASK_EVERY }, (_, i) => bare(rented(['pickup'], { day: 60 + i }))).find((s) => tenantAsks(s).length)!;
    expect(tenantAsks(empty)[0].ready).toBe(false);
    expect(giveTenant(empty, 'pickup')).toBeNull();
    for (let day = 60; day < 60 + ASK_EVERY; day++) expect(tenantAsks({ ...rented(['atm']), day })).toEqual([]);
  });
});

describe('сезонная площадка у входа (10.11)', () => {
  it('с «Магазинчика» и второй недели; торговец — по времени года; стоит неделю и платит', () => {
    expect(pitchOffer(shop({ level: 0 }))).toBeNull();
    expect(pitchOffer(shop({ level: 1, day: PITCH_FROM_DAY - 1 }))).toBeNull();
    const state = shop({ level: 2, day: 60 });
    const kind = pitchOffer(state)!;
    expect(Object.values(PITCH_BY_SEASON)).toContain(kind);
    const on = invitePitch(state)!;
    expect(pitchNow(on)).toBe(kind);
    expect(on.money).toBe(state.money);
    expect(invitePitch(on)).toBeNull();
    expect(pitchDaysLeft(on)).toBe(PITCH_DAYS);
    expect(tenantRent(on)).toBe(tenantRent(state) + pitchRent(state));
    expect(tenantGuests(on)).toBeCloseTo(tenantGuests(state) + PITCH_GUESTS);
    expect(tenantsLook(on)).not.toBe(tenantsLook(state));
    // Последний день — ещё стоит, на следующий — уехал, можно звать снова.
    expect(pitchNow({ ...on, day: 60 + PITCH_DAYS - 1 })).toBe(kind);
    expect(pitchNow({ ...on, day: 60 + PITCH_DAYS })).toBeNull();
    expect(pitchOffer({ ...on, day: 60 + PITCH_DAYS })).not.toBeNull();
    expect(tenantsNight(on).income).toBe(pitchRent(on));
  });

  it('у каждого времени года свой торговец с названием', () => {
    expect(new Set(Object.values(PITCH_BY_SEASON)).size).toBe(4);
    for (const kind of Object.values(PITCH_BY_SEASON)) expect(ru[`pitch.${kind}` as keyof typeof ru]).toBeTruthy();
  });
});
