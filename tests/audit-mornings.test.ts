import { describe, expect, it } from 'vitest';
import { newGame, type StoreState, type Unit } from '../src/game/economy';
import { catchUpTips, pendingTip, seeTip, type TipId } from '../src/game/tips';
import { NEWS_KIND, pickNews, type NewsId } from '../src/game/headlines';
import { autoLoad, buyVan, planTrip, settleVan, vanEvents, vanIncident, vanOutcome } from '../src/game/van';
import { archive, caseOrder, CASE_ARCHIVE, nextWeekly, type CaseRecord } from '../src/game/cases';

// Аудит 14.11, утро: одна «Новое!» за утро, очередь новостей не съедают ломбард с делом недели,
// фургон уходит в долг, архив дел не растёт без конца.

/** Утро с «Понятно» на каждой карточке, как в ui/morning.ts tipBox: сколько карточек прошло за это утро. */
function morningTips(state: StoreState): { tips: TipId[]; state: StoreState } {
  const tips: TipId[] = [];
  let s = state;
  for (let id = pendingTip(s); id && tips.length < 40; id = pendingTip(s)) {
    tips.push(id);
    s = { ...seeTip(s, id), tipDay: s.day };
  }
  return { tips, state: s };
}

describe('«Новое!»: одна карточка за утро', () => {
  it('утро «Минимаркета» больше не выкладывает 4–5 карточек подряд — по одной в утро', () => {
    let s: StoreState = { ...newGame(), day: 20 };
    s = morningTips(s).state;
    s = { ...s, level: 2, day: 21 };
    const seen: TipId[] = [];
    for (let d = 21; d < 31; d++) {
      const m = morningTips({ ...s, day: d });
      expect(m.tips.length).toBeLessThanOrEqual(1);
      seen.push(...m.tips);
      s = m.state;
    }
    // Все карточки уровня всё равно приходят — в следующие утра.
    expect(seen).toEqual(expect.arrayContaining(['pawn', 'rental', 'van', 'basement']));
  });

  it('seeTip сам день не ставит: молча отмеченная карточка (newcomer.ts, сцены) не съедает утро', () => {
    const s = { ...newGame(), day: 5 };
    expect(seeTip(s, 'thief').tipDay).toBeUndefined();
  });

  it('срочные идут и после карточки этого утра: пустая касса', () => {
    const empty = newGame().shelves.map((sh) => ({ ...sh, items: {} }));
    const broke: StoreState = { ...newGame(), day: 5, money: 0, warehouse: {}, shelves: empty, tipDay: 5, seenTips: ['ownerTill'] };
    expect(pendingTip(broke)).toBe('broke');
    // Обычная в тот же день — нет, назавтра — да.
    const calm = { ...newGame(), day: 5, seenTips: ['ownerTill'] };
    expect(pendingTip(calm)).not.toBeNull();
    expect(pendingTip({ ...calm, tipDay: 5 })).toBeNull();
    expect(pendingTip({ ...calm, tipDay: 4 })).toBe(pendingTip(calm));
  });

  it('ритм кассы — сразу за воришкой: карточка включает механику, её не откладывают ломбард и фургон', () => {
    const s: StoreState = { ...newGame(), day: 25, level: 2, seenTips: ['ownerTill', 'alone', 'thief'] };
    expect(pendingTip(s)).toBe('rhythm');
  });
});

describe('«Новое!»: вернувшийся игрок', () => {
  const OLD = ['broke', 'ownerTill', 'alone', 'weekly', 'fair', 'loyalty', 'delivery', 'register2', 'oven', 'coffee', 'nightShift'];
  const old = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 61, level: 3, seenTips: OLD, ...over });

  it('карточки уже открытых механик отмечены, воришка и ритм — нет', () => {
    const s = catchUpTips(old());
    expect(s.seenTips).toEqual(expect.arrayContaining(['pawn', 'rental', 'van', 'basement', 'clothes', 'estate']));
    expect(s.seenTips).not.toContain('thief');
    expect(s.seenTips).not.toContain('rhythm');
    expect(pendingTip(s)).toBe('thief');
    // Ещё не открытое (фудкорт на третьем уровне закрыт) — придёт своей карточкой.
    expect(s.seenTips).not.toContain('foodcourt');
  });

  it('новичок и игрок после 13.11 — без изменений (тот же объект)', () => {
    const fresh = old({ day: 15 });
    expect(catchUpTips(fresh)).toBe(fresh);
    const played = old({ seenTips: [...OLD, 'thief'] });
    expect(catchUpTips(played)).toBe(played);
  });
});

describe('очередь новостей: истории для души доходят', () => {
  /** Утро `day`, где `waited` ждут со вчера. */
  const morning = (day: number, waited: NewsId[]): StoreState => ({
    ...newGame(),
    day,
    newsQ: { day: day - 1, done: 1, wait: Object.fromEntries(waited.map((id) => [id, day - 1])) },
  });

  it('прождавшая день история — раньше ломбарда и дела недели', () => {
    expect(pickNews(morning(40, ['life']), ['pawn', 'case', 'life']).id).toBe('life');
    expect(pickNews(morning(40, ['van']), ['case', 'van']).id).toBe('van');
  });

  it('свежая — по-прежнему после них; событие дня, главное и другие сроки — раньше прождавшей', () => {
    expect(pickNews(morning(40, []), ['pawn', 'life']).id).toBe('pawn');
    expect(pickNews(morning(40, ['life']), ['event', 'life']).id).toBe('event');
    expect(pickNews(morning(40, ['life']), ['eduard', 'life']).id).toBe('eduard');
    expect(pickNews(morning(40, ['life']), ['lottery', 'life']).id).toBe('lottery');
    expect(pickNews(morning(40, ['life']), ['story', 'life']).id).toBe('story');
  });

  it('мечта соседа — денежное решение: идёт со сроками, раньше ломбарда и истории', () => {
    expect(NEWS_KIND.dream).toBe('timed');
    expect(pickNews(morning(40, ['pawn', 'life']), ['pawn', 'life', 'dream']).id).toBe('dream');
  });
});

describe('мелочи аудита', () => {
  const units = (n: number, age = 0): Unit[] => Array.from({ length: n }, () => ({ age }));

  it('неудачный выезд фургона уводит не в минус, а в долг', () => {
    let day = 20;
    const base = (d: number): StoreState => ({ ...newGame(), day: d, level: 2, money: 10_000, debt: 0, seed: 7, warehouse: { water: units(10), juice: units(6) } });
    while (!(vanEvents(base(day)).includes('beach') && vanIncident(base(day), 'beach') === 'rain')) day++;
    const loaded = autoLoad(planTrip(buyVan(base(day))!, 'beach')!);
    const net = vanOutcome(loaded)!.net;
    expect(net).toBeLessThan(0);
    const s = settleVan({ ...loaded, money: 5, debt: 100 }).state;
    expect(s.money).toBe(0);
    expect(s.debt).toBe(100 - (5 + net));
  });

  it('архив дел — не больше последних CASE_ARCHIVE; раскрытое давно не повторяется', () => {
    const order = caseOrder(7);
    let cases = { done: [{ id: order[0], tone: 'good', day: 5 }] as CaseRecord[] };
    for (let i = 0; i < 60; i++) cases = archive(cases, { id: order[1 + (i % 3)], tone: 'archived', day: 12 + i * 7 }) as typeof cases;
    expect(cases.done.length).toBe(CASE_ARCHIVE + 1);
    expect(cases.done[0]).toEqual({ id: order[0], tone: 'good', day: 5 });
    expect(cases.done.at(-1)?.day).toBe(12 + 59 * 7);
    expect(nextWeekly({ ...newGame(), seed: 7, cases })).not.toBe(order[0]);
  });
});
