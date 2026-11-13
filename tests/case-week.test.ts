import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import {
  accuse,
  accuseToday,
  askCase,
  CASE_FROM,
  CASE_IDS,
  CASE_RATING,
  caseGuests,
  caseMoney,
  caseMorning,
  caseOrder,
  CASES,
  clueCount,
  clueDay,
  clueToday,
  closedToday,
  confrontable,
  dueFrom,
  extraClues,
  FRIDAY,
  nextWeekly,
  openCase,
  openCaseOf,
  pinClue,
  seeBoard,
  takeClue,
  weekDay,
  weeklyDue,
} from '../src/game/cases';
import { guestFactor } from '../src/game/day';
import { planAttention, attentionTotal } from '../src/game/attention';
import { pendingTip } from '../src/game/tips';
import { simulate } from '../src/game/simulate';
import { ru, type TextKey } from '../src/i18n/ru';

// «Дело недели» (cases.ts): дело открывается в понедельник, улики — по дням до пятницы, допросы, обвинение.

const MONDAY = 15;
const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: MONDAY, money: 1000, rating: 3, seed: 7, ...over });
/** Утро понедельника: дело открылось. */
const monday = (over: Partial<StoreState> = {}): StoreState => caseMorning(shop(over));
/** Перейти на n дней вперёд «утрами» (как смена дня в day.ts). */
const after = (s: StoreState, n: number): StoreState => {
  let next = s;
  for (let i = 0; i < n; i++) next = caseMorning({ ...next, day: next.day + 1 });
  return next;
};
/** Найти все чёткие улики (как будто игрок нажимал каждую в зале) и дойти до пятницы. */
function sharpFriday(over: Partial<StoreState> = {}): StoreState {
  let s = monday(over);
  for (let i = 0; i < 4; i++) {
    const n = clueToday(s);
    if (n !== null) s = takeClue(s, n);
    s = after(s, 1);
  }
  return s;
}

describe('дело недели: календарь', () => {
  it('день недели: 1-й — понедельник, 5-й — пятница, 7-й — воскресенье (счета)', () => {
    expect(weekDay(1)).toBe(1);
    expect(weekDay(5)).toBe(FRIDAY);
    expect(weekDay(7)).toBe(7);
    expect(weekDay(MONDAY)).toBe(1);
    expect(weekDay(MONDAY + 4)).toBe(FRIDAY);
  });

  it('первое дело — в понедельник не раньше CASE_FROM; в другие дни и раньше — нет', () => {
    expect(caseMorning(shop({ day: 8 })).cases).toBeUndefined();
    expect(caseMorning(shop({ day: 16 })).cases).toBeUndefined();
    expect(MONDAY).toBeGreaterThanOrEqual(CASE_FROM);
    const s = monday();
    expect(openCaseOf(s)).toMatchObject({ origin: 'week', from: MONDAY, due: MONDAY + 4 });
    expect(openCaseOf(s)!.got).toEqual([0, 0, 0, 0]);
  });

  it('не во время бабушкиного обучения', () => {
    const s = shop({ tut: { step: 'serve' } as StoreState['tut'] });
    expect(weeklyDue(s)).toBe(false);
    expect(caseMorning(s).cases).toBeUndefined();
  });

  it('порядок дел — от зерна: тот же магазин — тот же порядок, все четыре дела в нём есть', () => {
    expect(caseOrder(7)).toEqual(caseOrder(7));
    for (let seed = 1; seed < 20; seed++) expect([...caseOrder(seed)].sort()).toEqual([...CASE_IDS].sort());
    const firsts = new Set(Array.from({ length: 40 }, (_, i) => caseOrder(i + 1)[0]));
    expect(firsts.size).toBeGreaterThan(1);
  });

  it('пятница — не раньше чем через 4 дня после открытия', () => {
    for (let day = 1; day < 40; day++) {
      const due = dueFrom(day);
      expect(weekDay(due)).toBe(FRIDAY);
      expect(due - day).toBeGreaterThanOrEqual(4);
      expect(due - day).toBeLessThan(11);
    }
  });
});

describe('дело недели: улики', () => {
  it('с понедельника по четверг — по одной в день, в пятницу улик в зале нет', () => {
    const s = monday();
    const open = openCaseOf(s)!;
    expect([0, 1, 2, 3].map((n) => clueDay(open, n))).toEqual([MONDAY, MONDAY + 1, MONDAY + 2, MONDAY + 3]);
    expect(clueToday(s)).toBe(0);
    expect(clueToday(after(s, 1))).toBe(1);
    expect(clueToday(after(s, 4))).toBeNull();
  });

  it('нажал в зале — улика чёткая; не нажал — утром приходит размытая', () => {
    let s = monday();
    s = takeClue(s, 0);
    expect(openCaseOf(s)!.got[0]).toBe(2);
    s = after(s, 1);
    expect(openCaseOf(s)!.got).toEqual([2, 0, 0, 0]);
    s = after(s, 1);
    expect(openCaseOf(s)!.got).toEqual([2, 1, 0, 0]);
    // Утренняя (размытая) улика в зале уже не появится, а будущую раньше срока не взять.
    expect(clueToday(s)).toBe(2);
    expect(takeClue(s, 3)).toBe(s);
  });

  it('счётчик «новых» на доске', () => {
    let s = after(takeClue(monday(), 0), 2);
    expect(clueCount(openCaseOf(s)!)).toEqual({ got: 2, fresh: 2 });
    s = seeBoard(s);
    expect(clueCount(openCaseOf(s)!)).toEqual({ got: 2, fresh: 0 });
    expect(seeBoard(s)).toBe(s);
  });

  it('улики других систем (ломбард) — на доске своего дела, без дублей', () => {
    let s = monday();
    const id = openCaseOf(s)!.id;
    const other = CASE_IDS.find((x) => x !== id)!;
    s = pinClue(s, { key: 'case.src.find' as TextKey, icon: '💍' });
    s = pinClue(s, { key: 'case.src.find' as TextKey, icon: '💍' });
    s = pinClue(s, { key: 'case.src.talk' as TextKey, icon: '💍', case: other });
    expect(extraClues(s).map((c) => c.key)).toEqual(['case.src.find']);
    // Чужое дело закрылось — его улика ждёт своего часа, своя ушла вместе с делом.
    s = after(s, 5);
    expect(openCaseOf(s)).toBeNull();
    expect(s.cases!.extra!.map((c) => c.case)).toEqual([other]);
  });
});

describe('дело недели: допрос и обвинение', () => {
  it('показать можно только чёткую улику о самом подозреваемом; виновный от неё признаётся', () => {
    const s = sharpFriday();
    const open = openCaseOf(s)!;
    const def = CASES[open.id];
    expect(confrontable(open, def.culprit).length).toBe(1);
    const innocent = Object.keys(def.suspects).find((x) => x !== def.culprit && confrontable(open, x).length)!;
    const n = confrontable(open, innocent)[0];
    const asked = askCase(s, innocent, `c${n}`);
    expect(openCaseOf(asked)!.confessed).toBeFalsy();
    expect(openCaseOf(asked)!.asked).toEqual([`${innocent}:c${n}`]);
    // Чужую улику не покажешь, неизвестный вопрос не задашь.
    expect(askCase(s, def.culprit, `c${n}`)).toBe(s);
    expect(askCase(s, def.culprit, 'bribe')).toBe(s);
    const confessed = askCase(asked, def.culprit, `c${confrontable(open, def.culprit)[0]}`);
    expect(openCaseOf(confessed)!.confessed).toBe(true);
    // Повторный вопрос ничего не меняет.
    expect(askCase(confessed, def.culprit, 'where')).not.toBe(confessed);
    const twice = askCase(confessed, def.culprit, 'where');
    expect(askCase(twice, def.culprit, 'where')).toBe(twice);
  });

  it('размытую улику не покажешь — признания не будет', () => {
    const s = after(monday(), 4);
    const open = openCaseOf(s)!;
    expect(open.got).toEqual([1, 1, 1, 1]);
    for (const who of Object.keys(CASES[open.id].suspects)) expect(confrontable(open, who)).toEqual([]);
  });

  it('обвинить — только в пятницу дела', () => {
    const s = monday();
    const culprit = CASES[openCaseOf(s)!.id].culprit;
    expect(accuseToday(s)).toBe(false);
    expect(accuse(s, culprit)).toBeNull();
    const fri = after(s, 4);
    expect(accuseToday(fri)).toBe(true);
    expect(accuse(fri, 'nobody')).toBeNull();
  });

  it('с признанием — лучший итог: деньги, рейтинг, «слава района»; дело закрыто', () => {
    let s = sharpFriday({ level: 2 });
    const open = openCaseOf(s)!;
    const def = CASES[open.id];
    s = askCase(s, def.culprit, `c${confrontable(open, def.culprit)[0]}`);
    const r = accuse(s, def.culprit)!;
    expect(r.tone).toBe('great');
    expect(r.state.money).toBe(s.money + caseMoney(2));
    expect(r.state.rating).toBeCloseTo(3 + CASE_RATING.great, 5);
    expect(openCaseOf(r.state)).toBeNull();
    expect(closedToday(r.state)).toMatchObject({ id: open.id, tone: 'great', who: def.culprit });
    expect(caseGuests(r.state)).toBeCloseTo(1.1, 5);
    expect(caseGuests({ ...r.state, day: r.state.day + 4 })).toBe(1);
    expect(guestFactor(r.state)).toBeGreaterThan(guestFactor({ ...r.state, cases: { ...r.state.cases, fame: undefined } }));
  });

  it('угадал без признания — меньше; ошибся — минус рейтинг и ни монеты', () => {
    const s = after(monday(), 4);
    const def = CASES[openCaseOf(s)!.id];
    const right = accuse(s, def.culprit)!;
    expect(right.tone).toBe('good');
    expect(right.state.money - s.money).toBe(Math.round(caseMoney(s.level) / 2));
    const innocent = Object.keys(def.suspects).find((x) => x !== def.culprit)!;
    const wrong = accuse(s, innocent)!;
    expect(wrong.tone).toBe('wrong');
    expect(wrong.state.money).toBe(s.money);
    expect(wrong.state.rating).toBeCloseTo(3 + CASE_RATING.wrong, 5);
    expect(caseGuests(wrong.state)).toBe(1);
    expect(closedToday(wrong.state)?.who).toBe(innocent);
  });

  it('не обвинил — в субботу дело уходит в архив без награды', () => {
    const fri = after(monday(), 4);
    const sat = after(fri, 1);
    expect(openCaseOf(sat)).toBeNull();
    expect(closedToday(sat)).toMatchObject({ tone: 'archived' });
    expect(sat.money).toBe(fri.money);
    expect(sat.rating).toBe(fri.rating);
  });
});

describe('дело недели: очередь дел и другие системы', () => {
  it('раскрытое не повторяется; нераскрытое поднимают из архива после остальных', () => {
    const order = caseOrder(7);
    expect(nextWeekly(shop())).toBe(order[0]);
    const done = [{ id: order[0], tone: 'good' as const, day: 19 }, { id: order[1], tone: 'archived' as const, day: 27 }];
    expect(nextWeekly(shop({ cases: { done } }))).toBe(order[2]);
    const all = CASE_IDS.map((id) => ({ id, tone: 'great' as const, day: 1 }));
    expect(nextWeekly(shop({ cases: { done: all } }))).toBeNull();
    expect(caseMorning(shop({ cases: { done: all } })).cases).toEqual({ done: all });
  });

  it('openCase: другое дело уже идёт — нельзя; открытое не на неделе — пятница позже', () => {
    const s = monday();
    expect(openCase(s, 'till', 'racket')).toBeNull();
    const wed = shop({ day: MONDAY + 2 });
    const opened = openCase(wed, 'till', 'racket')!;
    expect(openCaseOf(opened)).toMatchObject({ id: 'till', origin: 'racket', due: MONDAY + 11 });
    // В понедельник своего дела недели не откроется — идёт чужое.
    expect(openCaseOf(after(opened, 5))!.id).toBe('till');
  });

  it('то же утро дважды — то же состояние (перезапуск дня ничего не перекатывает)', () => {
    const s = after(takeClue(monday(), 0), 2);
    expect(caseMorning(s)).toBe(s);
    expect(caseMorning(shop({ day: 16 }))).toEqual(shop({ day: 16 }));
  });

  it('первая подсказка — когда открылось первое дело', () => {
    const seen = ['broke', 'ownerTill', 'alone', 'weekly', 'fair', 'loyalty', 'delivery', 'register2', 'oven', 'coffee', 'nightShift'];
    expect(pendingTip(shop({ seenTips: seen }))).toBeNull();
    expect(pendingTip(monday({ seenTips: seen }))).toBe('case');
  });

  it('улика занимает место в бюджете внимания дня', () => {
    const want = { moments: 3, live: 2, special: true, calls: 2 };
    const without = planAttention(want);
    const withClue = planAttention({ ...want, clue: true });
    expect(without.clue).toBeUndefined();
    expect(withClue.clue).toBe(true);
    expect(attentionTotal(withClue)).toBe(attentionTotal(without));
  });
});

describe('дело недели: тексты и сохранения', () => {
  it('у каждого дела есть все тексты: рассказ, подозреваемые, улики, ответы', () => {
    for (const id of CASE_IDS) {
      const def = CASES[id];
      const keys = [`case.${id}.title`, `case.${id}.victim`, `case.${id}.intro`, `case.${id}.thanks`];
      for (const sus of Object.keys(def.suspects)) keys.push(...['', '.hi', '.where', '.seen'].map((q) => `case.${id}.s.${sus}${q}`));
      def.clues.forEach((c, i) => {
        keys.push(`case.${id}.c${i}`, `case.${id}.c${i}.weak`);
        if (c.about) keys.push(`case.${id}.c${i}.ans`);
      });
      for (const k of keys) expect(ru[k as TextKey], k).toBeTruthy();
      // Улик четыре — по одной на день с понедельника по четверг, все четыре вида; у виновного своя одна.
      expect(def.clues.length).toBe(4);
      expect(new Set(def.clues.map((c) => c.src)).size).toBe(4);
      expect(def.clues.filter((c) => c.about === def.culprit).length).toBe(1);
      expect(Object.keys(def.suspects).length).toBeGreaterThanOrEqual(3);
      expect(def.suspects[def.culprit]).toBeTruthy();
    }
  });

  it('старое сохранение без дел: ничего не ломается и гостей столько же', () => {
    const old = shop({ day: 40 });
    delete (old as Partial<StoreState>).cases;
    expect(openCaseOf(old)).toBeNull();
    expect(caseGuests(old)).toBe(1);
    expect(clueToday(old)).toBeNull();
    expect(accuse(old, 'viktor')).toBeNull();
    expect(caseMorning({ ...old, day: 41 }).cases).toBeUndefined();
  });

  it('симулятор крутит недели: дела открываются и, без игрока, уходят в архив; деньги не трогают', () => {
    const r = simulate({ days: 36, seed: 3 });
    const done = r.final.cases?.done ?? [];
    expect(done.length).toBeGreaterThanOrEqual(2);
    expect(done.every((d) => d.tone === 'archived')).toBe(true);
    expect(r.final.cases?.fame).toBeUndefined();
  });
});
