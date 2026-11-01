import { afterEach, describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { activePet, cleanPetName, grantPets, normalizePets, PET_IDS, PETS, petFromItem, petItem, renamePet, setActivePet } from '../src/game/pets';
import { restartGame } from '../src/game/restart';
import { friendState, shopSnapshot } from '../src/game/friendShop';
import { simulate } from '../src/game/simulate';
import { canBuy, catalogItem, itemFromPayload, payloadFor, STARS_CATALOG } from '../api/_lib/telegram';
import { SPRITES } from '../src/scenes/textures';
import { ru } from '../src/i18n/ru';

const shop = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 12, ...patch });

describe('питомцы за звёзды', () => {
  it('шесть зверей по 25–100 ⭐, каждый продаётся на сервере по той же цене, у каждого свои кадры', () => {
    expect(PET_IDS).toHaveLength(6);
    for (const id of PET_IDS) {
      expect(PETS[id].stars).toBeGreaterThanOrEqual(25);
      expect(PETS[id].stars).toBeLessThanOrEqual(100);
      expect(STARS_CATALOG[petItem(id)].stars).toBe(PETS[id].stars);
      expect(canBuy(petItem(id))).toBe(true);
      expect(itemFromPayload(payloadFor(petItem(id)))).toBe(petItem(id));
      expect(catalogItem(petItem(id))?.ru).toBeTruthy();
      expect(petFromItem(petItem(id))).toBe(id);
      expect(SPRITES).toContain(`pet_${id}_0`);
      expect(ru[`pets.greet.${id}` as keyof typeof ru]).toContain('{name}');
    }
    expect(petFromItem('pet_dragon')).toBeUndefined();
    expect(petFromItem('sign_gold')).toBeUndefined();
  });

  it('купленный сразу в зале; второй — тоже, первый ждёт дома; можно позвать обратно и убрать', () => {
    let s = grantPets(shop(), ['pet_corgi', 'sign_gold']);
    expect(s.pets).toEqual({ owned: ['corgi'], active: 'corgi' });
    expect(grantPets(s, ['pet_corgi'])).toBe(s);
    s = grantPets(s, [petItem('parrot')]);
    expect(activePet(s)?.id).toBe('parrot');
    s = setActivePet(s, 'corgi')!;
    expect(activePet(s)?.id).toBe('corgi');
    expect(setActivePet(s, 'raccoon')).toBeNull();
    s = setActivePet(s, null)!;
    expect(activePet(s)).toBeUndefined();
    expect(s.pets?.owned).toEqual(['corgi', 'parrot']);
    // Восстановление покупок не трогает выбор игрока, но пустой зал не оставляет пустым.
    const restored = grantPets(setActivePet(grantPets(shop(), ['pet_bunny']), 'bunny')!, ['pet_bunny', 'pet_turtle'], false);
    expect(activePet(restored)?.id).toBe('bunny');
    expect(activePet(grantPets(shop(), ['pet_turtle'], false))?.id).toBe('turtle');
  });

  it('имя: чистится и обрезается, пустое — имя по умолчанию', () => {
    let s = grantPets(shop(), ['pet_hamster']);
    s = renamePet(s, 'hamster', '  Хома\n‮Большой Начальник  ')!;
    expect(activePet(s)).toEqual({ id: 'hamster', name: 'ХомаБольшой На' });
    expect(cleanPetName('x'.repeat(40))).toHaveLength(14);
    s = renamePet(s, 'hamster', '   ')!;
    expect(activePet(s)).toEqual({ id: 'hamster' });
    expect(renamePet(s, 'corgi', 'Бублик')).toBeNull();
  });

  it('сохранение: чужие и неизвестные выкидываются, без питомцев поля нет', () => {
    expect(normalizePets(undefined)).toBeUndefined();
    expect(normalizePets({ owned: ['ghost'] })).toBeUndefined();
    expect(normalizePets({ owned: ['corgi', 'corgi', 'ghost'], active: 'raccoon', names: { corgi: 'Бублик', raccoon: 'Енот', x: 1 } })).toEqual({ owned: ['corgi'], names: { corgi: 'Бублик' } });
  });

  it('«Начать заново»: питомцы, кто в зале и имена остаются', () => {
    const s = renamePet(grantPets(grantPets(shop({ level: 3, money: 9000 }), ['pet_raccoon']), ['pet_bunny']), 'bunny', 'Ушастик')!;
    const fresh = restartGame(s);
    expect(fresh.level).toBe(0);
    expect(fresh.pets).toEqual(s.pets);
    expect(activePet(fresh)).toEqual({ id: 'bunny', name: 'Ушастик' });
  });

  it('друг в гостях видит питомца; негодный снимок питомца отбрасывается', () => {
    const s = renamePet(grantPets(shop(), ['pet_parrot']), 'parrot', 'Кеша')!;
    const seen = friendState(JSON.parse(JSON.stringify(shopSnapshot(s))), newGame())!;
    expect(activePet(seen)).toEqual({ id: 'parrot', name: 'Кеша' });
    // Старый снимок — без поля; чужие данные — мимо.
    expect(friendState({ ...shopSnapshot(shop()) }, newGame())!.pets).toBeUndefined();
    expect(friendState({ ...shopSnapshot(shop()), pet: { id: 'dragon', name: 'x' } }, newGame())!.pets).toBeUndefined();
    expect(friendState({ ...shopSnapshot(shop()), pet: 'corgi' }, newGame())!.pets).toBeUndefined();
    const odd = friendState({ ...shopSnapshot(shop()), pet: { id: 'corgi', name: { evil: 1 } } }, newGame())!;
    expect(odd.pets).toEqual({ owned: ['corgi'], active: 'corgi' });
    // Без питомца в снимке поля нет вовсе.
    expect('pet' in shopSnapshot(shop())).toBe(false);
  });

  it('питомец только для красоты: симулятор с ним и без него даёт один и тот же результат', () => {
    const base = simulate({ days: 25, seed: 3 });
    for (const pet of PET_IDS) {
      const withPet = simulate({ days: 25, seed: 3, pet });
      // Итоговое состояние отличается только самим питомцем.
      expect(withPet.final.pets?.active).toBe(pet);
      const { pets: _, ...final } = withPet.final;
      expect({ ...withPet, final }).toEqual(base);
    }
  });
});

describe('старое сохранение', () => {
  afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

  const mount = () => {
    const local: Record<string, string> = {};
    Object.assign(globalThis, {
      localStorage: {
        getItem: (k: string) => local[k] ?? null,
        setItem: (k: string, v: string) => (local[k] = v),
        removeItem: (k: string) => delete local[k],
      },
    });
    return local;
  };

  it('без поля pets загружается как было', async () => {
    const local = mount();
    const state: StoreState = { ...newGame(), day: 40, level: 2 };
    delete state.pets;
    local['magazinchik.save'] = JSON.stringify({ version: 10, state });
    const { loadGame } = await import('../src/game/save');
    const loaded = loadGame()!;
    expect(loaded.day).toBe(40);
    expect('pets' in loaded).toBe(false);
  });

  it('с питомцами — загружается, неизвестные выкинуты', async () => {
    const local = mount();
    const state = { ...newGame(), day: 41, pets: { owned: ['corgi', 'unicorn'], active: 'unicorn', names: { corgi: 'Бублик' } } };
    local['magazinchik.save'] = JSON.stringify({ version: 10, state });
    const { loadGame } = await import('../src/game/save');
    expect(loadGame()!.pets).toEqual({ owned: ['corgi'], names: { corgi: 'Бублик' } });
  });
});
