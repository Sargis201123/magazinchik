import { describe, expect, it } from 'vitest';
import { checkoutSeconds, newGame, type StoreState } from '../src/game/economy';
import { seriesTip } from '../src/game/series';
import { pendingTip, seeTip } from '../src/game/tips';
import { simulate } from '../src/game/simulate';
import {
  BEAT_MAX_MS,
  BEAT_MIN_MS,
  beltDone,
  beltPlan,
  beltTap,
  beltTick,
  EARLY_MS,
  GOOD_MS,
  judge,
  MAX_PASSES,
  nextItem,
  PERFECT_MS,
  RETURN_MS,
  RHYTHM_PACE,
  RHYTHM_TAPS,
  RHYTHM_TIP_MAX,
  rhythmAfter,
  rhythmOn,
  rhythmSeconds,
  rhythmTipRate,
  RUSH_RHYTHM,
  startBelt,
  tillTip,
  type Belt,
} from '../src/game/tillRhythm';

// Касса в ритме (tillRhythm.ts, 13.11): товары едут по ленте, игрок «пикает» их касанием в такт.

const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 12, seed: 5, ...over });
const owner = { item: 0.85, pay: 0.6 };

/** Коснуться ленты в миг now — и вернуть ленту с тем, что случилось. */
const tap = (belt: Belt, now: number) => beltTap(belt, now);

describe('касса в ритме: окно касания', () => {
  it('точно в такт — «Идеально», рядом — «пик», дальше — промах, совсем рано — не считается', () => {
    expect(judge(0)).toBe('perfect');
    expect(judge(-PERFECT_MS)).toBe('perfect');
    expect(judge(PERFECT_MS)).toBe('perfect');
    expect(judge(PERFECT_MS + 1)).toBe('good');
    expect(judge(-GOOD_MS)).toBe('good');
    expect(judge(GOOD_MS + 1)).toBe('miss');
    expect(judge(-GOOD_MS - 1)).toBe('miss');
    expect(judge(-EARLY_MS - 1)).toBeNull();
  });
});

describe('касса в ритме: план пробивки', () => {
  it('корзина в такт без промахов — быстрее прежней пробивки на RHYTHM_PACE', () => {
    for (const items of [1, 2, 3, 5]) {
      const plan = beltPlan(owner, items);
      expect(plan.taps).toBe(Math.min(items, RHYTHM_TAPS));
      expect(plan.taps * plan.beat + plan.rest).toBeCloseTo(checkoutSeconds(owner, items) * 1000 * RHYTHM_PACE, 6);
    }
  });

  it('касаний не больше трёх, шаг ленты не чаще BEAT_MIN_MS и не реже BEAT_MAX_MS', () => {
    for (const item of [0.15, 0.3, 0.5, 0.85, 1, 1.5, 3]) {
      for (const items of [1, 2, 3, 4, 8]) {
        const plan = beltPlan({ item, pay: item * 0.7 }, items);
        expect(plan.taps).toBeGreaterThanOrEqual(1);
        expect(plan.taps).toBeLessThanOrEqual(Math.min(RHYTHM_TAPS, items));
        expect(plan.beat).toBeGreaterThanOrEqual(BEAT_MIN_MS);
        expect(plan.beat).toBeLessThanOrEqual(BEAT_MAX_MS);
        expect(plan.rest).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('ловкому хозяину на быстрой кассе — меньше касаний: лента не тормозит его до шага BEAT_MIN_MS за товар', () => {
    expect(beltPlan({ item: 0.2, pay: 0.1 }, 3).taps).toBe(1);
    expect(beltPlan(owner, 3).taps).toBe(3);
  });

  it('пустая корзина — ленты нет', () => {
    expect(beltPlan(owner, 0)).toMatchObject({ taps: 0, beat: 0 });
  });
});

describe('касса в ритме: лента', () => {
  it('товары приходят под луч по одному, шаг за шагом', () => {
    const belt = startBelt(3, 500, 1000);
    expect(belt.items.map((i) => i.arrive)).toEqual([1500, 2000, 2500]);
    expect(nextItem(belt)?.index).toBe(0);
  });

  it('три касания точно в такт — три «Идеально», лента пробита', () => {
    let belt = startBelt(3, 500, 0);
    const grades: string[] = [];
    for (const at of [500, 1000, 1500]) {
      const r = tap(belt, at);
      belt = r.belt;
      grades.push(r.event!.grade);
    }
    expect(grades).toEqual(['perfect', 'perfect', 'perfect']);
    expect(beltDone(belt)).toBe(true);
  });

  it('касание задолго до товара не считается и ничего не ломает', () => {
    const belt = startBelt(1, 800, 0);
    const r = tap(belt, 800 - EARLY_MS - 50);
    expect(r.event).toBeNull();
    expect(r.belt).toBe(belt);
  });

  it('промах — товар уезжает в хвост ленты и проезжает ещё раз; денег не трогаем', () => {
    let belt = startBelt(2, 500, 0);
    // Рано: товар 0 ещё в 300 мс от луча.
    const r = tap(belt, 200);
    expect(r.event).toEqual({ index: 0, grade: 'miss' });
    belt = r.belt;
    const again = belt.items[0];
    expect(again.passes).toBe(2);
    // В хвост: после товара 1 и не раньше, чем успеет вернуться к началу ленты.
    expect(again.arrive).toBeGreaterThanOrEqual(belt.items[1].arrive + 500);
    expect(again.arrive).toBeGreaterThanOrEqual(200 + RETURN_MS + 500);
    expect(nextItem(belt)?.index).toBe(1);
    expect(beltDone(belt)).toBe(false);
  });

  it('проехал окно без касания — тоже промах (лента сама)', () => {
    const belt = startBelt(1, 500, 0);
    expect(beltTick(belt, 500 + GOOD_MS).events).toEqual([]);
    const r = beltTick(belt, 500 + GOOD_MS + 1);
    expect(r.events).toEqual([{ index: 0, grade: 'miss' }]);
    expect(r.belt.items[0].passes).toBe(2);
  });

  it('на последнем проезде без касания хозяин пробивает сам — покупатель у кассы не застревает', () => {
    let belt = startBelt(1, 500, 0);
    let now = 0;
    const seen: string[] = [];
    for (let i = 0; i < 100 && !beltDone(belt); i++) {
      now += 100;
      const r = beltTick(belt, now);
      belt = r.belt;
      seen.push(...r.events.map((e) => e.grade));
    }
    expect(seen).toEqual([...Array(MAX_PASSES - 1).fill('miss'), 'auto']);
    expect(beltDone(belt)).toBe(true);
    // Ни одного касания — и всё равно не дольше двух проездов с возвратом (плюс шаг часов на каждый промах).
    expect(now).toBeLessThanOrEqual(500 + GOOD_MS + RETURN_MS + 500 + GOOD_MS + 2 * 100);
  });

  it('одно и то же — один и тот же итог (никаких случайностей)', () => {
    const play = () => {
      let belt = startBelt(3, 600, 0);
      const out: string[] = [];
      for (const at of [550, 1250, 1300, 2600, 3000]) {
        const r = tap(belt, at);
        belt = r.belt;
        if (r.event) out.push(`${r.event.index}:${r.event.grade}`);
        const t = beltTick(belt, at + 1);
        belt = t.belt;
        out.push(...t.events.map((e) => `${e.index}:${e.grade}`));
      }
      return out;
    };
    expect(play()).toEqual(play());
  });
});

describe('касса в ритме: чаевые', () => {
  it('«Идеально ×N»: идеально — +1, «пик» — как было, промах и «сам» — с нуля', () => {
    expect(rhythmAfter(0, 'perfect')).toBe(1);
    expect(rhythmAfter(4, 'perfect')).toBe(5);
    expect(rhythmAfter(4, 'good')).toBe(4);
    expect(rhythmAfter(4, 'miss')).toBe(0);
    expect(rhythmAfter(4, 'auto')).toBe(0);
  });

  it('ритм прибавляет к чаевым, с потолком; в час пик — вдвое', () => {
    expect(rhythmTipRate(0)).toBe(0);
    expect(rhythmTipRate(3)).toBeCloseTo(0.03, 6);
    expect(rhythmTipRate(100)).toBe(RHYTHM_TIP_MAX);
    expect(rhythmTipRate(3, true)).toBeCloseTo(0.03 * RUSH_RHYTHM, 6);
  });

  it('без ритма чаевые — ровно прежние чаевые серии', () => {
    for (const series of [0, 1, 2, 3, 5, 9]) for (const total of [0, 7, 40, 133]) expect(tillTip(series, 0, total)).toBe(seriesTip(series, total));
  });

  it('ритм и серия складываются; чаевые идут и до третьей покупки серии', () => {
    expect(tillTip(1, 0, 100)).toBe(0);
    expect(tillTip(1, 2, 100)).toBe(2);
    expect(tillTip(3, 2, 100)).toBe(seriesTip(3, 100) + 2);
    expect(tillTip(1, 2, 100, true)).toBe(4);
    // Мелкая корзина: раз уж положены — хоть монетка.
    expect(tillTip(1, 1, 10)).toBe(1);
    expect(tillTip(1, 3, 0)).toBe(0);
  });
});

describe('касса в ритме: карточка и старые сохранения', () => {
  it('лента — только после карточки «Новое»', () => {
    const s = shop();
    expect(rhythmOn(s)).toBe(false);
    expect(rhythmOn(seeTip(s, 'rhythm'))).toBe(true);
  });

  it('старое сохранение без новых полей грузится как было: ленты нет, пока карточку не прочли', () => {
    const old = shop({ seenTips: ['ownerTill', 'register2'] });
    expect(rhythmOn(old)).toBe(false);
    const { seenTips: _drop, ...noTips } = old;
    expect(rhythmOn(noTips as StoreState)).toBe(false);
  });

  it('карточка — хозяину за кассой; со сменщиком и в тихие дни новичка — нет', () => {
    const seenOthers = ['broke', 'ownerTill', 'alone', 'weekly', 'fair', 'loyalty', 'delivery', 'register2', 'oven', 'coffee', 'nightShift'];
    const s = shop({ seenTips: seenOthers, money: 5000 });
    expect(pendingTip(s)).toBe('rhythm');
    expect(pendingTip(seeTip(s, 'rhythm'))).toBeNull();
    // Сменщик за кассой хозяина (registers.ts RELIEF_ROLE) — хозяин за неё не встаёт, карточка подождёт.
    const relief = { ...s, staff: [...s.staff, { role: 'cashier' as const, name: 0, skill: 1, wage: 100, months: 1 }] };
    expect(pendingTip(relief)).toBeNull();
    expect(pendingTip({ ...s, onboarding: 'play', day: 2 })).toBeNull();
  });
});

describe('касса в ритме: симулятор', () => {
  it('средний игрок пробивает примерно так же, как раньше; идеальный — быстрее', () => {
    for (const t of [owner, { item: 1, pay: 0.7 }, { item: 0.6, pay: 0.42 }]) {
      const before = checkoutSeconds(t, 1.4);
      expect(rhythmSeconds(t, 1.4) / before).toBeGreaterThan(0.9);
      expect(rhythmSeconds(t, 1.4) / before).toBeLessThan(1.1);
      expect(rhythmSeconds(t, 1.4, 1)).toBeLessThan(before);
    }
  });

  it('симулятор живёт и с кассой в ритме', () => {
    const { days } = simulate({ days: 20, seed: 3 });
    expect(days).toHaveLength(20);
    expect(days.reduce((sum, d) => sum + d.served, 0)).toBeGreaterThan(100);
  });
});
