import { afterEach, describe, expect, it } from 'vitest';
import { checkoutSeconds, newGame, type StoreState } from '../src/game/economy';
import { seriesTip } from '../src/game/series';
import { pendingTip, seeTip } from '../src/game/tips';
import { simulate } from '../src/game/simulate';
import {
  BEAT_MAX_MS,
  BEAT_MIN_MS,
  CALM_MS,
  beltDone,
  beltPlan,
  beltRest,
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
  rhythmTaught,
  rhythmTipRate,
  RHYTHM_HIT_TIP,
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
        const t = { item, pay: item * 0.7 };
        const plan = beltPlan(t, items);
        expect(plan.taps).toBeLessThanOrEqual(Math.min(RHYTHM_TAPS, items));
        expect(plan.rest).toBeGreaterThanOrEqual(0);
        if (!plan.taps) continue;
        expect(plan.beat).toBeGreaterThanOrEqual(BEAT_MIN_MS);
        expect(plan.beat).toBeLessThanOrEqual(BEAT_MAX_MS);
        // Лента, которую не трогали (каждый товар — в конце окна), не дольше прежней пробивки.
        expect(plan.taps * plan.beat + GOOD_MS).toBeLessThanOrEqual(checkoutSeconds(t, items) * 1000);
      }
    }
  });

  it('ловкому хозяину на быстрой кассе — меньше касаний: лента не тормозит его до шага BEAT_MIN_MS за товар', () => {
    expect(beltPlan({ item: 0.25, pay: 0.15 }, 3).taps).toBe(1);
    expect(beltPlan(owner, 3).taps).toBe(3);
  });

  it('совсем быстрому хозяину ленты нет: товар не доехал бы быстрее, чем он пробивает сам', () => {
    expect(beltPlan({ item: 0.15, pay: 0.1 }, 1)).toMatchObject({ taps: 0, beat: 0 });
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
    let belt = startBelt(2, 800, 0);
    // Рано: товар 0 ещё в 300 мс от луча.
    const r = tap(belt, 500);
    expect(r.event).toEqual({ index: 0, grade: 'miss' });
    belt = r.belt;
    const again = belt.items[0];
    expect(again.passes).toBe(2);
    // В хвост: после товара 1 и не раньше, чем успеет вернуться к началу ленты.
    expect(again.arrive).toBeGreaterThanOrEqual(belt.items[1].arrive + 800);
    expect(again.arrive).toBeGreaterThanOrEqual(500 + RETURN_MS + 800);
    expect(nextItem(belt)?.index).toBe(1);
    expect(beltDone(belt)).toBe(false);
  });

  it('проехал окно без касания — не промах: хозяин пробивает сам, второго проезда нет', () => {
    const belt = startBelt(1, 500, 0);
    expect(beltTick(belt, 500 + GOOD_MS).events).toEqual([]);
    const r = beltTick(belt, 500 + GOOD_MS + 1);
    expect(r.events).toEqual([{ index: 0, grade: 'auto' }]);
    expect(r.belt.items[0].passes).toBe(1);
    expect(beltDone(r.belt)).toBe(true);
  });

  it('после настоящего промаха второй проезд без касания — хозяин пробивает сам; покупатель не застревает', () => {
    let belt = tap(startBelt(1, 800, 0), 500).belt;
    let now = 500;
    const seen: string[] = [];
    for (let i = 0; i < 100 && !beltDone(belt); i++) {
      now += 100;
      const r = beltTick(belt, now);
      belt = r.belt;
      seen.push(...r.events.map((e) => e.grade));
    }
    expect(seen).toEqual(['auto']);
    expect(belt.items[0].passes).toBe(MAX_PASSES);
    expect(now).toBeLessThanOrEqual(500 + RETURN_MS + 800 + GOOD_MS + 100);
  });

  it('ленту не трогали — пробивка не дольше прежней; в такт — быстрее на RHYTHM_PACE', () => {
    for (const t of [owner, { item: 0.48, pay: 0.336 }, { item: 0.6, pay: 0.42 }, { item: 1, pay: 0.7 }]) {
      for (const items of [1, 2, 3, 5]) {
        const plan = beltPlan(t, items);
        if (!plan.taps) continue;
        const old = checkoutSeconds(t, items) * 1000;
        // Никто не касается: часы идут кадрами по 16 мс, пока лента не кончится.
        let belt = startBelt(plan.taps, plan.beat, 0);
        let now = 0;
        while (!beltDone(belt)) belt = beltTick(belt, (now += 16)).belt;
        expect(now + beltRest(plan, t, items, belt, now)).toBeLessThanOrEqual(old + 16);
        // Каждый товар — точно в такт.
        let clean = startBelt(plan.taps, plan.beat, 0);
        for (const i of clean.items) clean = tap(clean, i.arrive).belt;
        const end = plan.taps * plan.beat;
        expect(end + beltRest(plan, t, items, clean, end)).toBeCloseTo(old * RHYTHM_PACE, 6);
      }
    }
  });

  it('частая лента: опоздавшее касание или дребезг пальца после «пик» не пишут промах следующему товару', () => {
    const beat = BEAT_MIN_MS;
    // Опоздал по первому: лента уже пробила его сама, касание не про второй.
    let belt = beltTick(startBelt(3, beat, 0), beat + GOOD_MS + 1).belt;
    expect(belt.items[0].scanned).toBe('auto');
    expect(tap(belt, beat + GOOD_MS + 10).event).toBeNull();
    // «Идеально» по первому — и тут же второе касание (дребезг или двойное).
    belt = tap(startBelt(3, beat, 0), beat).belt;
    for (const dt of [50, 100, 150, GOOD_MS]) expect(tap(belt, beat + dt).event).toBeNull();
    // Окно «пик» второго товара от этого не уже.
    expect(tap(belt, 2 * beat - GOOD_MS).event).toEqual({ index: 1, grade: 'good' });
    // На неспешной ленте ранний промах остаётся: касание за EARLY_MS до товара.
    const slow = startBelt(2, BEAT_MAX_MS, 0);
    expect(tap(slow, BEAT_MAX_MS - EARLY_MS).event).toEqual({ index: 0, grade: 'miss' });
    expect(BEAT_MAX_MS - GOOD_MS - CALM_MS).toBeGreaterThanOrEqual(EARLY_MS);
  });

  it('промах по полу засчитывают, когда палец подняли: товар едет на второй проезд от этого мига', () => {
    const belt = startBelt(1, 800, 0);
    const r = beltTap(belt, 800, 500);
    expect(r.event).toEqual({ index: 0, grade: 'miss' });
    expect(r.belt.items[0].arrive).toBeGreaterThanOrEqual(800 + RETURN_MS + 800);
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
    const seenOthers = ['broke', 'ownerTill', 'alone', 'weekly', 'fair', 'loyalty', 'delivery', 'register2', 'oven', 'coffee', 'nightShift', 'thief'];
    const s = shop({ seenTips: seenOthers, money: 5000 });
    expect(pendingTip(s)).toBe('rhythm');
    expect(pendingTip(seeTip(s, 'rhythm'))).toBeNull();
    // Сменщик за кассой хозяина (registers.ts RELIEF_ROLE) — хозяин за неё не встаёт, карточка подождёт.
    const relief = { ...s, staff: [...s.staff, { role: 'cashier' as const, name: 0, skill: 1, wage: 100, months: 1 }] };
    expect(pendingTip(relief)).toBeNull();
    expect(pendingTip({ ...s, onboarding: 'play', day: 2 })).toBeNull();
  });
});

describe('касса в ритме: первая подсказка в зале', () => {
  it('до первого «Идеально» подсказка внизу, после — нет; метка своя, карточку «Новое» не трогает', () => {
    const s = seeTip(shop(), 'rhythm');
    expect(rhythmTaught(s)).toBe(false);
    const hit = { ...s, seenTips: [...(s.seenTips ?? []), RHYTHM_HIT_TIP] };
    expect(rhythmTaught(hit)).toBe(true);
    expect(rhythmOn(hit)).toBe(true);
    // Метка — не карточка: в очереди карточек её нет, и pendingTip её не покажет.
    expect(pendingTip(hit)).not.toBe(RHYTHM_HIT_TIP);
  });
});

describe('касса в ритме: сохранение', () => {
  afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

  it('старое сохранение (без карточки ритма и без новых полей дня) грузится без изменений', async () => {
    const local: Record<string, string> = {};
    Object.assign(globalThis, {
      localStorage: {
        getItem: (k: string) => local[k] ?? null,
        setItem: (k: string, v: string) => (local[k] = v),
        removeItem: (k: string) => delete local[k],
      },
    });
    const state: StoreState = { ...newGame(), day: 40, level: 2, money: 1234, seenTips: ['ownerTill'] };
    local['magazinchik.save'] = JSON.stringify({ version: 11, state });
    const { loadGame } = await import('../src/game/save');
    const loaded = loadGame()!;
    expect(loaded.day).toBe(40);
    expect(loaded.money).toBe(1234);
    expect(loaded.seenTips).toEqual(['ownerTill']);
    expect(rhythmOn(loaded)).toBe(false);
    expect(rhythmTaught(loaded)).toBe(false);
  });
});

describe('касса в ритме: промах не стоит денег', () => {
  it('после промаха чаевые — ровно чаевые серии, не меньше; ни при каком ритме они не отрицательные', () => {
    for (const series of [0, 1, 3, 6]) {
      for (const total of [0, 5, 60, 250]) {
        const afterMiss = tillTip(series, rhythmAfter(5, 'miss'), total);
        expect(afterMiss).toBe(seriesTip(series, total));
        for (const streak of [0, 1, 4, 50]) expect(tillTip(series, streak, total, true)).toBeGreaterThanOrEqual(seriesTip(series, total));
      }
    }
  });
});

describe('касса в ритме: симулятор', () => {
  it('один и тот же прогон — один и тот же итог', () => {
    const a = simulate({ days: 12, seed: 7 }).days.map((d) => [d.money, d.served]);
    const b = simulate({ days: 12, seed: 7 }).days.map((d) => [d.money, d.served]);
    expect(a).toEqual(b);
  });

  it('средний игрок пробивает не дольше прежнего и ненамного быстрее; идеальный — быстрее', () => {
    for (const t of [owner, { item: 1, pay: 0.7 }, { item: 0.6, pay: 0.42 }, { item: 0.15, pay: 0.1 }]) {
      const before = checkoutSeconds(t, 1.4);
      expect(rhythmSeconds(t, 1.4) / before).toBeGreaterThan(0.9);
      expect(rhythmSeconds(t, 1.4)).toBeLessThanOrEqual(before);
      expect(rhythmSeconds(t, 1.4, 0)).toBeCloseTo(before, 9);
      if (beltPlan(t, 1.4).taps) expect(rhythmSeconds(t, 1.4, 1)).toBeLessThan(before);
    }
  });

  it('симулятор живёт и с кассой в ритме', () => {
    const { days } = simulate({ days: 20, seed: 3 });
    expect(days).toHaveLength(20);
    expect(days.reduce((sum, d) => sum + d.served, 0)).toBeGreaterThan(100);
  });
});
