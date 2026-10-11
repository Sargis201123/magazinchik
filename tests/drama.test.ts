import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { dramaDone, dramaScene, SCENES, seeDrama, sonyaVisits, sunflowersPlanted } from '../src/game/drama';
import { ru } from '../src/i18n/ru';
import { en } from '../src/i18n/en';

const shop = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), tourDone: true, ...patch });

describe('сюжет «Папа и Соня»', () => {
  it('сцены идут по порядку, по дням, не больше одной за утро', () => {
    expect(dramaScene(shop({ day: 1 }))).toBeNull();
    expect(dramaScene(shop({ day: 2, tourDone: false }))).toBeNull();
    let s = shop({ day: 2 });
    expect(dramaScene(s)).toBe(SCENES[0]);
    s = seeDrama(s);
    expect(dramaScene(s)).toBeNull();
    // Игрок, который давно играет, получает сцены по одной каждое утро.
    s = { ...s, day: 200 };
    expect(dramaScene(s)).toBe(SCENES[1]);
    s = seeDrama(s);
    expect(dramaScene(s)).toBeNull();
    expect(dramaScene({ ...s, day: 201 })).toBe(SCENES[2]);
  });

  it('история целиком: дни растут, тексты есть на обоих языках, финал — на озере', () => {
    for (let i = 1; i < SCENES.length; i++) expect(SCENES[i].day).toBeGreaterThan(SCENES[i - 1].day);
    for (const scene of SCENES) {
      expect(ru[scene.place]).toBeTruthy();
      for (const line of scene.lines) {
        expect(ru[line.key]).toBeTruthy();
        expect(en[line.key]).toBeTruthy();
      }
    }
    // Правда о том, что случилось, — только ближе к концу.
    const reveal = SCENES.findIndex((s) => s.lines.some((l) => ru[l.key].includes('грузовик')));
    expect(reveal).toBeGreaterThan(SCENES.length * 0.7);
    let s = shop();
    for (let day = 2; day <= 120; day++) {
      s = { ...s, day };
      if (dramaScene(s)) s = seeDrama(s);
    }
    expect(dramaDone(s)).toBe(true);
    expect(sunflowersPlanted(s)).toBe(true);
    expect(SCENES[SCENES.length - 1].art).toBe('drama_lake');
  });

  it('на экономику не влияет: меняется только сам сюжет', () => {
    const before = shop({ day: 2 });
    const after = seeDrama(before);
    expect({ ...after, drama: undefined }).toEqual({ ...before, drama: undefined });
  });

  it('Соня заходит в магазин в день своей сцены и по субботам после примирения', () => {
    const i = SCENES.findIndex((s) => s.visit);
    let s = shop({ day: SCENES[i].day, drama: { seen: i } });
    s = seeDrama(s);
    expect(sonyaVisits(s)).toBe(true);
    expect(sonyaVisits({ ...s, day: s.day + 1 })).toBe(false);
    const done = shop({ day: 125, drama: { seen: SCENES.length } });
    expect(sonyaVisits(done)).toBe(done.day % 7 === 6);
    expect(sonyaVisits({ ...done, day: 125 + ((6 - (125 % 7) + 7) % 7) })).toBe(true);
  });
});
