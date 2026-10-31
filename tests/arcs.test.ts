import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import {
  ARC_DEAL,
  ARC_HELPER,
  ARC_IDS,
  ARCS,
  answerArc,
  arcDeliver,
  arcGuests,
  arcKeys,
  arcSceneToday,
  arcsMorning,
  arcsOf,
  arcsOpen,
  arcTeaser,
  arcToday,
  canChooseArc,
  dealPay,
  nextArc,
  type ArcId,
} from '../src/game/arcs';
import { CHAPTERS } from '../src/game/story';
import { tomorrowTeaser } from '../src/game/nudge';
import { ru } from '../src/i18n/ru';
import { en } from '../src/i18n/en';

/** Магазин после финала: сюжет пройден, конкурс района выигран. */
const after = (day: number, patch: Partial<StoreState> = {}): StoreState => {
  const g = newGame();
  return {
    ...g,
    day,
    level: 4,
    money: 5000,
    seed: 12345,
    story: { ...g.story, chapter: CHAPTERS.length, introSeen: true },
    contest: { tier: 1, phase: 'wait', since: day - 10, target: 0, revenue: 0, served: 0, unhappy: 0, empty: 0, wins: 1 },
    ...patch,
  };
};
const start = (s: StoreState, id: ArcId): StoreState => ({ ...s, arcs: { done: [], cur: { id, beat: 0, due: s.day } } });
const next = (s: StoreState, days: number): StoreState => ({ ...s, day: s.day + days });
/** Прожить утро за утром, пока не придёт шаг истории. */
function untilBeat(s: StoreState, max = 30): StoreState {
  for (let i = 0; i < max && !arcToday(s); i++) s = arcsMorning(next(s, 1));
  return s;
}

describe('хроники района', () => {
  it('до финала не идут; у давнего игрока, прошедшего главы, — идут', () => {
    const g = newGame();
    expect(arcsOpen({ ...g, day: 200 })).toBe(false);
    expect(arcsMorning({ ...g, day: 200 })).toEqual({ ...g, day: 200 });
    expect(arcsOpen({ ...g, day: 130, story: { ...g.story, chapter: CHAPTERS.length } })).toBe(true);
    expect(arcsOpen(after(60))).toBe(true);
  });

  it('после финала — день передышки, потом первая история; следующая не начнётся во время идущей', () => {
    let s = arcsMorning(after(60));
    expect(arcsOf(s).nextAt).toBe(61);
    expect(arcToday(s)).toBeNull();
    s = arcsMorning(next(s, 1));
    expect(arcToday(s)).not.toBeNull();
    expect(arcsMorning(s)).toBe(s);
  });

  it('детерминировано: одно зерно — та же история и те же промежутки, перезагрузка ничего не меняет', () => {
    const run = (seed: number) => {
      let s = after(60, { seed });
      const seen: string[] = [];
      for (let i = 0; i < 80; i++) {
        s = arcsMorning(next(s, 1));
        const today = arcToday(s);
        if (today) {
          seen.push(`${s.day}:${today.id}.${today.beat}`);
          s = answerArc(s, ARCS[today.id].beats[today.beat].choices.length - 1)!;
        }
      }
      return seen;
    };
    expect(run(7)).toEqual(run(7));
    expect(run(7).length).toBeGreaterThan(8);
    expect(JSON.stringify(run(7))).not.toEqual(JSON.stringify(run(8)));
  });

  it('шаги идут через 3–5 дней, между историями — тоже', () => {
    let s = after(60);
    const days: number[] = [];
    for (let i = 0; i < 200; i++) {
      s = arcsMorning(next(s, 1));
      const today = arcToday(s);
      if (today) {
        days.push(s.day);
        s = answerArc(s, ARCS[today.id].beats[today.beat].choices.length - 1)!;
      }
    }
    const gaps = days.slice(1).map((d, i) => d - days[i]);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(12);
    const share = gaps.filter((g) => g >= 3 && g <= 5).length / gaps.length;
    expect(share).toBeGreaterThan(0.6);
  });

  it('все истории рассказываются по разу, потом поток кончается', () => {
    let s = after(60);
    for (let i = 0; i < 400; i++) {
      s = arcsMorning(next(s, 1));
      const today = arcToday(s);
      if (today) s = answerArc(s, 0) ?? answerArc(s, 1) ?? answerArc(s, ARCS[today.id].beats[today.beat].choices.length - 1)!;
    }
    expect([...arcsOf(s).done].sort()).toEqual([...ARC_IDS].sort());
    expect(nextArc(s)).toBeNull();
  });

  it('историй не меньше 12, у каждой 2–4 шага и не больше трёх вариантов', () => {
    expect(ARC_IDS.length).toBeGreaterThanOrEqual(12);
    for (const id of ARC_IDS) {
      expect(ARCS[id].beats.length).toBeGreaterThanOrEqual(2);
      expect(ARCS[id].beats.length).toBeLessThanOrEqual(4);
      for (const b of ARCS[id].beats) expect(b.choices.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('без наказаний: ни один выбор не снижает рейтинг и не отнимает больше 300 монет', () => {
    for (const id of ARC_IDS)
      for (const b of ARCS[id].beats)
        for (const c of b.choices) {
          expect(c.effect.rating ?? 0).toBeGreaterThanOrEqual(0);
          expect(c.effect.money ?? 0).toBeGreaterThanOrEqual(-300);
          if ((c.effect.money ?? 0) < 0) expect(c.require?.money).toBe(-(c.effect.money ?? 0));
        }
  });

  it('тексты всех историй есть на обоих языках', () => {
    const keys = ARC_IDS.flatMap(arcKeys);
    const missRu = keys.filter((k) => !(k in ru));
    const missEn = keys.filter((k) => !(k in en));
    expect(missRu).toEqual([]);
    expect(missEn).toEqual([]);
    expect('teaser.arc' in ru && 'teaser.arc' in en).toBe(true);
  });

  it('кафе Ахмеда: договор — хлеб раз в неделю за хорошую цену; нет хлеба — без штрафа', () => {
    let s = start(after(60), 'cafe');
    s = answerArc(s, 0)!;
    const deal = arcsOf(s).deal!;
    expect(deal.pay).toBe(dealPay());
    expect(deal.next).toBe(61);
    // Хлеба нет — поставка переносится на неделю, деньги и рейтинг не трогаем.
    s = { ...next(s, 1), warehouse: { ...s.warehouse, bread: [] }, shelves: s.shelves.map((sh) => ({ ...sh, items: { ...sh.items, bread: [] } })) };
    const before = { money: s.money, rating: s.rating };
    let res = arcDeliver(s);
    expect(res.result).toEqual({ delivered: false, pay: 0, ended: false });
    expect({ money: res.state.money, rating: res.state.rating }).toEqual(before);
    expect(arcsOf(res.state).deal!.next).toBe(s.day + ARC_DEAL.every);
    // Хлеб есть — забирает и платит.
    s = { ...next(res.state, ARC_DEAL.every), warehouse: { ...res.state.warehouse, bread: Array(30).fill(0) } };
    res = arcDeliver(s);
    expect(res.result!.delivered).toBe(true);
    expect(res.state.money).toBe(s.money + dealPay());
    expect(res.state.warehouse.bread!.length).toBe(30 - ARC_DEAL.qty);
    // Не день поставки — ничего.
    expect(arcDeliver(next(res.state, 1)).result).toBeNull();
  });

  it('свадьба: шаг виден в мире — нарядные гости, машина и молодые у кассы', () => {
    let s = start(after(60), 'wedding');
    s = answerArc(s, 2)!;
    expect(arcSceneToday(s)?.show).toEqual(['visit']);
    s = untilBeat(s);
    expect(arcToday(s)).toEqual({ id: 'wedding', beat: 1 });
    s = answerArc(s, 0)!;
    expect(arcSceneToday(s)?.show).toEqual(['festive', 'car', 'visit']);
    expect(arcGuests(s)).toBeCloseTo(1.1);
    expect(arcSceneToday(next(s, 1))).toBeNull();
    expect(arcGuests(next(s, 1))).toBe(1);
  });

  it('угощение к свадьбе нельзя выбрать без 20 буханок', () => {
    const s = start({ ...after(60), warehouse: {} }, 'wedding');
    const empty = { ...s, shelves: s.shelves.map((sh) => ({ ...sh, items: {} })) };
    expect(canChooseArc(empty, ARCS.wedding.beats[0].choices[0])).toBe(false);
    expect(answerArc(empty, 0)).toBeNull();
    expect(answerArc(empty, 2)).not.toBeNull();
  });

  it('летняя подработка: сын Светы — именной сотрудник за полцены, с ним больше гостей; осенью уходит', () => {
    let s = start(after(60, { staff: [] }), 'summer');
    s = answerArc(s, 0)!;
    const role = arcsOf(s).helper!.role;
    const misha = s.staff.find((m) => m.role === role)!;
    expect(misha.name).toBe(ARC_HELPER.name);
    expect(misha.skill).toBeGreaterThanOrEqual(2);
    expect(arcGuests(s)).toBeCloseTo(ARC_HELPER.guests);
    s = untilBeat(s);
    s = answerArc(s, 1)!;
    s = untilBeat(s);
    expect(arcToday(s)).toEqual({ id: 'summer', beat: 2 });
    s = answerArc(s, 0)!;
    expect(s.staff.find((m) => m.role === role)).toBeUndefined();
    expect(arcsOf(s).helper).toBeUndefined();
    expect(arcsOf(s).done).toContain('summer');
  });

  it('летняя подработка: нет свободного места — можно выбрать другой путь', () => {
    const full = after(60, { level: 0, staff: [{ role: 'cleaner', name: 1, skill: 1, wage: 100, months: 0 }] });
    const s = start(full, 'summer');
    expect(answerArc(s, 0)).toBeNull();
    const other = answerArc(s, 1)!;
    expect(arcsOf(other).cur?.beat).toBe(3);
  });

  it('«Завтра:» в итогах дня называет шаг истории', () => {
    const s = start(after(60), 'eduard');
    expect(arcTeaser(s)).toEqual({ id: 'eduard', icon: ARCS.eduard.icon });
    expect(tomorrowTeaser(s).key).toBe('teaser.arc');
    expect(tomorrowTeaser(s).params.name).toBe('arc.eduard.name');
  });

  it('старое сохранение без поля хроник загружается и работает', () => {
    const old = JSON.parse(JSON.stringify(after(60))) as StoreState;
    delete (old as Partial<StoreState>).arcs;
    expect(arcGuests(old)).toBe(1);
    expect(arcToday(old)).toBeNull();
    expect(arcsMorning(old).arcs?.nextAt).toBe(61);
  });
});
