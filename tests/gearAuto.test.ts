// Упрощение оборудования (решение автора 02.11): сам игрок выбирает только кассу, холодильники, склад
// и камеры; остальное встаёт само с помещением. Старые сохранения: купленное не откатывается,
// за убранные указатели, солнечные панели и тележки — монеты назад.
import { describe, expect, it } from 'vitest';
import { newGame, STORE_LEVELS, type StoreState } from '../src/game/economy';
import { AUTO_GEAR, autoTier, GEAR, GEAR_IDS, gearArriving, gearAvailable, gearTier, MANUAL_GEAR, migrateGear, upgradeGear } from '../src/game/gear';
import { hasUpgrade, UPGRADE_IDS } from '../src/game/upgrades';

const at = (level: number, patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), level, money: 100000, ...patch });

describe('оборудование: четыре линейки сам, остальное — с помещением', () => {
  it('сам игрок выбирает только кассу, холодильники, склад и камеры', () => {
    expect(MANUAL_GEAR).toEqual(['register', 'fridge', 'warehouse', 'cameras']);
    expect(AUTO_GEAR.length + MANUAL_GEAR.length).toBe(GEAR_IDS.length);
    for (const id of AUTO_GEAR) {
      expect(GEAR[id].models.every((m) => m.price === 0)).toBe(true);
      expect(gearAvailable(at(4), id)).toBe(false);
      expect(upgradeGear(at(4), id)).toBeNull();
    }
    expect(upgradeGear(at(1), 'register')?.gear?.register).toBe(1);
  });

  it('модели встают сами по помещениям и не идут назад', () => {
    for (const id of AUTO_GEAR) {
      const tiers = STORE_LEVELS.map((_, level) => autoTier(level, id));
      expect(tiers[0]).toBe(0);
      expect(tiers.every((t, i) => i === 0 || t >= tiers[i - 1])).toBe(true);
      expect(tiers[tiers.length - 1]).toBe(GEAR[id].models.length - 1);
    }
    expect(gearTier(at(0), 'bin')).toBe(0);
    expect(gearTier(at(3), 'bin')).toBe(3);
    // Лучшая печь — в третьем помещении: с ней открывается марка «От бабушки» (brand.ts).
    expect(gearTier(at(3), 'oven')).toBe(2);
    expect(gearTier(at(4), 'lights')).toBe(2);
  });

  it('купленное до 02.11 остаётся, даже если помещение меньше', () => {
    expect(gearTier(at(1, { gear: { bin: 3, lights: 2 } }), 'bin')).toBe(3);
    expect(gearTier(at(1, { gear: { bin: 3, lights: 2 } }), 'lights')).toBe(2);
  });

  it('утром видно, что встанет с переездом (только то, что уже есть в магазине)', () => {
    const ids = gearArriving(at(1), 2).map((c) => c.id);
    expect(ids).toContain('bin');
    expect(ids).not.toContain('oven');
    expect(gearArriving(at(1, { upgrades: ['oven'] }), 2).map((c) => c.id)).toContain('oven');
    expect(gearArriving(at(1, { gear: { bin: 3 } }), 2).map((c) => c.id)).not.toContain('bin');
  });
});

describe('старые сохранения (до 02.11)', () => {
  it('указатели, солнечные панели и тележки — монеты назад, один раз', () => {
    const old = at(3, { money: 1000, gear: { signage: 2, solar: 1, register: 2 } as StoreState['gear'], upgrades: ['cart', 'oven'] as StoreState['upgrades'] });
    const s = migrateGear(old);
    expect(s.money).toBe(1000 + 600 + 2500 + 2500 + 700);
    expect(s.gear).toEqual({ register: 2 });
    expect(s.upgrades).toEqual(['oven']);
    expect(migrateGear(s)).toBe(s);
  });

  it('без убранного — ничего не меняется', () => {
    const s = at(2, { gear: { register: 1 } });
    expect(migrateGear(s)).toBe(s);
    expect(migrateGear(newGame())).toEqual(newGame());
  });

  it('Заречье: убранное во второй лавке тоже возвращается монетами', () => {
    const base = at(5, { money: 0 });
    const s = migrateGear({ ...base, zar: { at: 'home', since: 1, away: { level: 1, gear: { solar: 2 } as StoreState['gear'], upgrades: ['cart'] as StoreState['upgrades'] } } });
    expect(s.money).toBe(2500 + 6000 + 700);
    expect(s.zar?.away.gear).toEqual({});
    expect(s.zar?.away.upgrades).toEqual([]);
  });

  it('тележек больше нет в списке улучшений', () => {
    expect(UPGRADE_IDS as string[]).not.toContain('cart');
    expect(hasUpgrade(at(1), 'loyalty')).toBe(false);
  });
});

describe('Заречье (второй магазин, до 4-го помещения)', () => {
  it('оборудование там на два помещения новее — лучшие модели доезжают', () => {
    const zar = (level: number): StoreState => at(level, { zar: { at: 'zar', since: 1, away: {} } });
    expect(gearTier(zar(3), 'stove')).toBe(GEAR.stove.models.length - 1);
    expect(gearTier(zar(3), 'courier')).toBe(GEAR.courier.models.length - 1);
    expect(gearTier(at(3, { zar: { at: 'home', since: 1, away: {} } }), 'courier')).toBe(0);
    expect(gearArriving(zar(1), 2).map((c) => c.id)).toContain('lights');
  });
});
