import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { DRAMA_PER_DAY, dramaDone, dramaHeld, dramaScene, dramaWaiting, SCENES, seeDrama, sonyaVisits, sunflowersPlanted } from '../src/game/drama';
import { addDays } from '../src/game/live';
import { ru } from '../src/i18n/ru';
import { en } from '../src/i18n/en';

const shop = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), tourDone: true, ...patch });
/** Настоящие дни игрока: каждый игровой день в тестах — свой, чтобы предел за день не мешал. */
const TODAY = '2026-12-01';
const realDay = (n: number): string => addDays('2026-01-01', n);

describe('сюжет «Папа и Соня»', () => {
  it('сцены идут по порядку, по дням, не больше одной за утро', () => {
    expect(dramaScene(shop({ day: 1 }), TODAY)).toBeNull();
    expect(dramaScene(shop({ day: 2, tourDone: false }), TODAY)).toBeNull();
    let s = shop({ day: 2 });
    expect(dramaScene(s, TODAY)).toBe(SCENES[0]);
    s = seeDrama(s, TODAY);
    expect(dramaScene(s, TODAY)).toBeNull();
    // Игрок, который давно играет, получает сцены по одной каждое утро.
    s = { ...s, day: 200 };
    expect(dramaScene(s, realDay(1))).toBe(SCENES[1]);
    s = seeDrama(s, realDay(1));
    expect(dramaScene(s, realDay(1))).toBeNull();
    expect(dramaScene({ ...s, day: 201 }, realDay(2))).toBe(SCENES[2]);
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
      if (dramaScene(s, realDay(day))) s = seeDrama(s, realDay(day));
    }
    expect(dramaDone(s)).toBe(true);
    expect(sunflowersPlanted(s)).toBe(true);
    expect(SCENES[SCENES.length - 1].art).toBe('drama_lake');
  });

  it('старое сохранение (счётчик сцен первой версии) продолжается с того же места', () => {
    // В первой версии 10-я сцена была на 27-й день — дальше идёт первая сцена после 27-го.
    const next = dramaScene(shop({ day: 200, drama: { seen: 10 } }), TODAY)!;
    expect(next).toBe(SCENES.find((s) => s.day > 27));
    expect(dramaDone(shop({ day: 200, drama: { seen: 32 } }))).toBe(true);
  });

  it('сцены почти каждые полтора дня, правда раскрывается ближе к концу', () => {
    const span = SCENES[SCENES.length - 1].day - SCENES[0].day;
    expect(span / (SCENES.length - 1)).toBeLessThan(1.6);
  });

  it('на экономику не влияет: меняется только сам сюжет', () => {
    const before = shop({ day: 2 });
    const after = seeDrama(before, TODAY);
    expect({ ...after, drama: undefined }).toEqual({ ...before, drama: undefined });
  });

  it('Соня заходит в магазин в день своей сцены и по субботам после примирения', () => {
    const i = SCENES.findIndex((s) => s.visit);
    let s = shop({ day: SCENES[i].day, drama: { upTo: i ? SCENES[i - 1].day : 0 } });
    s = seeDrama(s, TODAY);
    expect(sonyaVisits(s)).toBe(true);
    expect(sonyaVisits({ ...s, day: s.day + 1 })).toBe(false);
    const done = shop({ day: 125, drama: { upTo: SCENES[SCENES.length - 1].day } });
    expect(sonyaVisits(done)).toBe(done.day % 7 === 6);
    expect(sonyaVisits({ ...done, day: 125 + ((6 - (125 % 7) + 7) % 7) })).toBe(true);
  });
});

describe('«Приходи завтра»: сцены Сони по настоящим дням', () => {
  it(`за настоящий день — не больше ${DRAMA_PER_DAY} сцен, остальные ждут завтра`, () => {
    let s = shop({ day: 2 });
    let shown = 0;
    // Игрок за один вечер прошёл тридцать игровых дней.
    for (let day = 2; day <= 31; day++) {
      s = { ...s, day };
      if (dramaScene(s, TODAY)) {
        s = seeDrama(s, TODAY);
        shown++;
      }
    }
    expect(shown).toBe(DRAMA_PER_DAY);
    // Сцена готова, но ждёт: в итогах дня — тизер, назавтра она первая.
    expect(dramaHeld(s, TODAY)).toBe(true);
    expect(dramaWaiting(s)).toBe(true);
    const tomorrow = addDays(TODAY, 1);
    expect(dramaHeld(s, tomorrow)).toBe(false);
    expect(dramaScene({ ...s, day: s.day + 1 }, tomorrow)).toBe(SCENES[DRAMA_PER_DAY]);
    // Новый день — снова свой предел.
    s = seeDrama({ ...s, day: s.day + 1 }, tomorrow);
    expect(s.drama?.date).toBe(tomorrow);
    expect(s.drama?.today).toBe(1);
  });

  it('без сцены в запасе тизера нет: сцена просто покажется следующим утром', () => {
    const s = seeDrama(shop({ day: 2 }), TODAY);
    // Одна сцена за день — предел не выбран.
    expect(dramaHeld({ ...s, day: 3 }, TODAY)).toBe(false);
    expect(dramaScene({ ...s, day: 3 }, TODAY)).toBe(SCENES[1]);
    // История рассказана — Соне больше нечего ждать.
    const done = shop({ day: 300, drama: { upTo: SCENES[SCENES.length - 1].day } });
    expect(dramaWaiting(done)).toBe(false);
    expect(dramaHeld(done, TODAY)).toBe(false);
  });

  it('старое сохранение без даты: сегодня ещё ничего не показано', () => {
    const old = shop({ day: 40, drama: { upTo: 20, last: 39 } });
    expect(dramaScene(old, TODAY)).toBe(SCENES.find((sc) => sc.day > 20));
    const seen = seeDrama(old, TODAY);
    expect(seen.drama).toMatchObject({ date: TODAY, today: 1, last: 40 });
  });
});
