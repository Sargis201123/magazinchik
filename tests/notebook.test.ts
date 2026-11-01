import { describe, expect, it } from 'vitest';
import { emptyDayStats, newGame, type StoreState } from '../src/game/economy';
import { answerEduard, EDUARD_DEBT, EDUARD_KEPT_RATING, hasNotebook, notebookDue, notebookLines, repayDay, writeSonya } from '../src/game/notebook';
import { letterKey, planLetter, takeLetter, waitingHooks } from '../src/game/returns';
import { CHAPTERS, finishChapter, finishIntro, linesFor } from '../src/game/story';
import { contestNight, CONTEST_DAYS, juryDay } from '../src/game/contest';
import { giantNight, GIANT_BATTLE_DAYS } from '../src/game/giant';
import { SCENES } from '../src/game/drama';
import { ru } from '../src/i18n/ru';

const shop = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 1, ...patch });
const ids = (s: StoreState) => notebookLines(s).map((l) => l.id);

describe('«Бабушкина тетрадь»: письмо', () => {
  it('вечером первого дня уходит письмо с тетрадью — приходит следующим же утром, без монет', () => {
    const s = shop();
    expect(notebookDue(s)).toBe(true);
    const planned = planLetter(s, '2026-11-01', () => 0.9);
    expect(planned.ret?.letter).toMatchObject({ from: 'grandma', story: 'notebook' });
    expect(letterKey(planned.ret!.letter!)).toBe('nb.letter');
    // Бот называет тетрадь своим поводом: «В тетради нашлась ещё одна страница…».
    expect(waitingHooks(planned).letter).toBe('notebook');
    // Тот же настоящий день — всё равно приходит (сюжет идёт по событиям, не по календарю).
    const got = takeLetter({ ...planned, day: 2 }, '2026-11-01')!;
    expect(got.gift.money).toBeUndefined();
    expect(got.state.money).toBe(planned.money);
    expect(hasNotebook(got.state)).toBe(true);
    expect(notebookDue(got.state)).toBe(false);
    // Дальше — обычные письма.
    expect(planLetter(got.state, '2026-11-02', () => 0.9).ret?.letter?.story).toBeUndefined();
  });

  it('старое сохранение без тетради получает её после уже ждущего письма — то не пропадает', () => {
    const old = shop({ day: 40, story: { chapter: 3, introSeen: true, ordersDone: 0, inspectionsPassed: 0 }, ret: { letter: { from: 'valya', n: 2, date: '2026-11-01' } } });
    expect(old.nb).toBeUndefined();
    expect(planLetter(old, '2026-11-01', () => 0.5).ret?.letter?.from).toBe('valya');
    const delivered = takeLetter(old, '2026-11-02')!.state;
    const planned = planLetter(delivered, '2026-11-02', () => 0.5);
    expect(planned.ret?.letter?.story).toBe('notebook');
    // Уже открытые главы сразу видны в тетради.
    expect(ids(takeLetter(planned, '2026-11-01')!.state)).toEqual(['debts', 'valya', 'marat', 'edik', 'many', 'torn']);
  });

  it('банкроту писем нет', () => {
    expect(planLetter(shop({ bankrupt: true }), '2026-11-01', () => 0.5).ret?.letter).toBeUndefined();
  });
});

describe('«Бабушкина тетрадь»: страницы по главам', () => {
  it('в начале — только её долг и вырванная страница; долг вернули — зачёркнут', () => {
    const s = shop({ nb: { got: true } });
    expect(ids(s)).toEqual(['debts', 'many', 'torn']);
    expect(notebookLines(s)[0].crossed).toBe(false);
    expect(notebookLines({ ...s, debt: 0 })[0].crossed).toBe(true);
  });

  it('каждая концовка главы открывает свою строчку, а реплика с ней показывает страницу', () => {
    let s = shop({ nb: { got: true }, debt: 0 });
    const seen: string[] = [];
    for (let ch = 0; ch < 3; ch++) {
      for (const l of CHAPTERS[ch].outro) if (l.page) seen.push(l.page);
      s = finishChapter(finishIntro(s));
    }
    expect(seen).toEqual(['valya', 'marat', 'edik']);
    expect(ids(s)).toEqual(['debts', 'valya', 'marat', 'edik', 'many', 'torn']);
    expect(notebookLines(s).find((l) => l.id === 'edik')?.note).toBe('nb.note.skip');
  });

  it('пятая глава: выбор — «взять» даёт деньги, «не брать» — звёзды; реплика по ответу, число реплик то же', () => {
    const ch5 = CHAPTERS[4];
    const s = shop({ nb: { got: true }, story: { chapter: 4, introSeen: false, ordersDone: 0, inspectionsPassed: 0 }, rating: 4 });
    const before = linesFor(s, ch5.intro);
    expect(before.some((l) => l.choice)).toBe(true);
    const took = answerEduard(s, 'took');
    const kept = answerEduard(s, 'kept');
    expect(took.money).toBe(s.money + EDUARD_DEBT);
    expect(kept.rating).toBeCloseTo(4 + EDUARD_KEPT_RATING);
    expect(linesFor(took, ch5.intro).map((l) => l.key)).toContain('story.ch5.took');
    expect(linesFor(kept, ch5.intro).map((l) => l.key)).toContain('story.ch5.kept');
    expect(linesFor(took, ch5.intro)).toHaveLength(before.length);
    // Ответ один раз.
    expect(answerEduard(took, 'kept')).toBe(took);
    expect(ids({ ...took, story: { ...took.story, chapter: 5 } })).toContain('eduard');
    // Старое сохранение прошло пятую главу без выбора — в тетради «не брать», как написано.
    const legacy = notebookLines(shop({ nb: { got: true }, story: { chapter: 5, introSeen: false, ordersDone: 0, inspectionsPassed: 0 } }));
    expect(legacy.find((l) => l.id === 'eduard')?.key).toBe('nb.line.eduardKept');
  });

  it('«Ладно. Вы победили» — не в начале пятой главы, а в развязке выбора; конец не объявляет «история пройдена»', () => {
    const first = CHAPTERS[4].intro[0];
    expect(first.who).toBe('grandma');
    expect(ru['story.ch5.outro3']).not.toMatch(/пройден/);
    expect(ru['contest.finale.end']).not.toMatch(/пройден/);
    expect(ru['contest.finale.end']).toMatch(/за мостом ещё темно/i);
  });

  it('Заречье дописывает вырванную страницу; Соня — свою строчку на церемонии', () => {
    const s = shop({ nb: { got: true } });
    expect(notebookLines({ ...s, zar: {} as StoreState['zar'] }).find((l) => l.id === 'torn')?.key).toBe('nb.line.tornDone');
    expect(ids(writeSonya(s))).toContain('sonya');
    expect(writeSonya(writeSonya(s))).toEqual(writeSonya(s));
  });
});

describe('«Бабушкина тетрадь»: кульминация', () => {
  it('первый конкурс объявляют во вторую неделю битвы с «Гигантом»: день жюри — её последний день', () => {
    const stats = { ...emptyDayStats(), revenue: 1000, served: 30 };
    let s = shop({ day: 70, rating: 4.8, history: Array(7).fill(1000), story: { chapter: 5, introSeen: false, ordersDone: 0, inspectionsPassed: 0 } });
    s = { ...s, giant: { phase: 'battle', since: 70, revenue: 0, target: 1, seen: 'battle' } };
    let jury = -1;
    let battleEnd = -1;
    for (let d = 71; d < 70 + GIANT_BATTLE_DAYS + 2; d++) {
      const prev = s;
      s = contestNight(giantNight({ ...s, day: d }, 1000), stats);
      if (juryDay(prev)) jury = prev.day;
      if (prev.giant?.phase === 'battle' && s.giant?.phase !== 'battle') battleEnd = prev.day;
      if (repayDay(prev)) expect(juryDay(prev)).toBe(true);
    }
    expect(battleEnd).toBe(70 + GIANT_BATTLE_DAYS - 1);
    expect(jury).toBe(battleEnd);
    expect(s.contest?.last).toBeDefined();
    expect(CONTEST_DAYS).toBeLessThan(GIANT_BATTLE_DAYS);
  });
});

describe('«Бабушкина тетрадь»: «Гигант» устоял', () => {
  it('оценки набраны, но битва проиграна — финала нет; новый конкурс района — только после победы над «Гигантом»', () => {
    const stats = { ...emptyDayStats(), revenue: 1000, served: 30 };
    let s = shop({ day: 70, rating: 4.8, history: Array(7).fill(1000), story: { chapter: 5, introSeen: false, ordersDone: 0, inspectionsPassed: 0 } });
    // Цель битвы недостижима — «Гигант» устоит; оценки конкурса (рейтинг, довольные, полки) — набраны.
    s = { ...s, giant: { phase: 'battle', since: 70, revenue: 0, target: 10 ** 9, seen: 'battle' } };
    for (let d = 71; d <= 70 + GIANT_BATTLE_DAYS; d++) s = contestNight(giantNight({ ...s, day: d }, 1000), stats);
    expect(s.giant?.phase).toBe('lost');
    expect(s.contest?.last).toMatchObject({ won: false, giant: true });
    expect(s.contest?.wins).toBe(0);
    const from = s.day;
    for (let d = from + 1; d < from + 25; d++) s = contestNight({ ...s, day: d }, stats);
    expect(s.contest?.phase).toBe('wait');
  });

  it('сохранение посреди битвы (конкурса ещё нет, вторая неделя уже идёт) — ждёт победы, как раньше', () => {
    const s = shop({ day: 80, history: Array(7).fill(1000), giant: { phase: 'battle', since: 70, revenue: 0, target: 1 } });
    expect(contestNight(s, emptyDayStats()).contest).toBeUndefined();
  });
});

describe('мелкие правки сюжета', () => {
  it('у Валентины больше нет повторяющегося «Ой, что это я»', () => {
    const keys = SCENES.flatMap((s) => s.lines.map((l) => l.key));
    for (const k of ['drama.5.2', 'drama.21.2', 'drama.28.2']) expect(keys).not.toContain(k);
  });

  it('инспектор не однофамилец семьи Ковалёвых, жених — не второй Миша', () => {
    expect(ru['who.inspector']).not.toMatch(/Ковал/);
    expect(ru['tale.wedding.name']).not.toMatch(/Миша/);
  });
});
