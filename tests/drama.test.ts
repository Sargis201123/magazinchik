import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { DRAMA_FREE_DAYS, DRAMA_PER_DAY, dramaDone, dramaHeld, dramaScene, dramaWaiting, eveningScene, NIGHT_NOTES, noteNight, PLACE_ART, sceneArt, SCENES, seeDrama, seeEvening, sonyaNightNote, sonyaVisits, sunflowersPlanted } from '../src/game/drama';
import { startCohort } from '../src/game/onboarding';
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
  /** Сцены первой недели: они идут без предела за настоящий день. */
  const WEEK = SCENES.filter((sc) => sc.day <= DRAMA_FREE_DAYS);

  it(`после первой недели за настоящий день — не больше ${DRAMA_PER_DAY} сцен, остальные ждут завтра`, () => {
    let s = shop({ day: DRAMA_FREE_DAYS + 1, drama: { upTo: WEEK[WEEK.length - 1].day } });
    let shown = 0;
    // Игрок за один вечер прошёл тридцать игровых дней.
    for (let day = DRAMA_FREE_DAYS + 1; day <= DRAMA_FREE_DAYS + 30; day++) {
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
    expect(dramaScene({ ...s, day: s.day + 1 }, tomorrow)).toBe(SCENES[WEEK.length + DRAMA_PER_DAY]);
    // Новый день — снова свой предел.
    s = seeDrama({ ...s, day: s.day + 1 }, tomorrow);
    expect(s.drama?.date).toBe(tomorrow);
    expect(s.drama?.today).toBe(1);
  });

  it('первая неделя — без предела: увлёкшийся новичок не упирается в «загляни завтра»', () => {
    let s = shop({ day: 2 });
    let shown = 0;
    for (let day = 2; day <= DRAMA_FREE_DAYS; day++) {
      s = { ...s, day };
      expect(dramaHeld(s, TODAY)).toBe(false);
      if (dramaScene(s, TODAY)) {
        s = seeDrama(s, TODAY);
        shown++;
      }
    }
    expect(shown).toBe(WEEK.length);
    expect(shown).toBeGreaterThan(DRAMA_PER_DAY);
    // Неделя кончилась — сегодняшние сцены в счёт: следующая ждёт завтра.
    const next = SCENES[WEEK.length].day;
    expect(dramaScene({ ...s, day: next }, TODAY)).toBeNull();
    expect(dramaHeld({ ...s, day: next }, TODAY)).toBe(true);
    expect(dramaScene({ ...s, day: next }, addDays(TODAY, 1))).toBe(SCENES[WEEK.length]);
  });

  it('вечер первого дня новичка: первая сцена — сразу после итогов, утром её уже не повторяют', () => {
    const s = startCohort(newGame(), 'play');
    // Первый день ещё идёт.
    expect(eveningScene(s)).toBeNull();
    // Итоги первого дня: номер дня уже следующий.
    const after: StoreState = { ...s, day: 2 };
    expect(eveningScene(after)).toBe(SCENES[0]);
    const seen = seeEvening(after, TODAY);
    expect(eveningScene(seen)).toBeNull();
    // Утро второго дня — вступление главы, Соня молчит; на третий — следующая сцена, а не первая.
    expect(dramaScene(seen, TODAY)).toBeNull();
    expect(dramaScene({ ...seen, day: 3 }, TODAY)).toBe(SCENES[1]);
    // Игру закрыли на итогах — первая сцена придёт утром третьего дня, как раньше.
    expect(dramaScene({ ...after, day: 3 }, TODAY)).toBe(SCENES[0]);
    // Не новичок нового начала (старое сохранение) — вечерней сцены нет.
    expect(eveningScene(shop({ day: 2 }))).toBeNull();
    expect(seeEvening(shop({ day: 2 }), TODAY).drama).toBeUndefined();
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

describe('Соня замечает ночные смены', () => {
  const ROAD = SCENES.find((s) => s.place === 'drama.place.road')!.day;
  /** История идёт: первая сцена уже показана. */
  const told = (patch: Partial<StoreState> = {}): StoreState => shop({ day: 20, drama: { upTo: 2 }, ...patch });

  it('счёт ночных смен подряд: отработал — растёт, закрылся вовремя — сброшен', () => {
    let s = told();
    expect(noteNight(s, false)).toBe(s);
    s = noteNight(noteNight(s, true), true);
    expect(s.nightRun).toBe(2);
    s = noteNight(s, false);
    expect(s.nightRun).toBeUndefined();
  });

  it('пишет на вторую, четвёртую и седьмую ночь подряд, дальше — на каждую седьмую', () => {
    const noted: number[] = [];
    for (let night = 1; night <= 21; night++) if (sonyaNightNote(told({ nightRun: night - 1 }))) noted.push(night);
    expect(noted).toEqual([...NIGHT_NOTES, 14, 21]);
    expect(sonyaNightNote(told({ nightRun: 1 }))).toBe('drama.night.before.1');
    expect(sonyaNightNote(told({ nightRun: 3 }))).toBe('drama.night.before.2');
    expect(sonyaNightNote(told({ nightRun: 6 }))).toBe('drama.night.before.3');
    expect(sonyaNightNote(told({ nightRun: 13 }))).toBe('drama.night.before.3');
  });

  it('после сцены у поворота Соня говорит иначе; пока история не началась — молчит', () => {
    expect(sonyaNightNote(told({ nightRun: 1, drama: { upTo: ROAD } }))).toBe('drama.night.after.1');
    expect(sonyaNightNote(told({ nightRun: 1, drama: { upTo: ROAD - 1 } }))).toBe('drama.night.before.1');
    expect(sonyaNightNote(shop({ day: 20, nightRun: 1 }))).toBeNull();
  });

  it('у каждой реплики есть текст на русском и английском', () => {
    for (const when of ['before', 'after'] as const)
      for (let step = 1; step <= NIGHT_NOTES.length; step++) {
        const key = `drama.night.${when}.${step}` as keyof typeof ru;
        expect(ru[key]).toBeTruthy();
        expect(en[key]).toBeTruthy();
      }
  });
});

describe('картинки сцен: своя или фон места', () => {
  // Картинки в public/assets — как их видит сборка (без node:fs).
  const files = Object.keys(import.meta.glob('../public/assets/drama_*.png')).map((f) => f.replace('../public/assets/', '').replace(/\.png$/, ''));

  it('у каждой картинки сцены и у каждого фона места есть файл', () => {
    for (const scene of SCENES) {
      const art = sceneArt(scene);
      if (art) expect(files, `сцена дня ${scene.day}`).toContain(art);
    }
    for (const art of Object.values(PLACE_ART)) expect(files).toContain(art);
  });

  it('своя картинка сцены важнее фона места; сцены в магазине — без фона', () => {
    const rain = SCENES.find((s) => s.art === 'drama_rain')!;
    expect(sceneArt(rain)).toBe('drama_rain');
    const home = SCENES.find((s) => s.place === 'drama.place.home_evening' && !s.art)!;
    expect(sceneArt(home)).toBe('drama_home');
    const shop = SCENES.find((s) => s.place === 'drama.place.shop' && !s.art)!;
    expect(sceneArt(shop)).toBeUndefined();
  });

  it('с картинкой — больше двух третей сцен (было 3 из 61)', () => {
    const drawn = SCENES.filter((s) => sceneArt(s)).length;
    expect(drawn / SCENES.length).toBeGreaterThan(2 / 3);
  });
});
