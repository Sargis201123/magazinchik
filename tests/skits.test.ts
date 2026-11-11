import { describe, expect, it } from 'vitest';
import { newGame, onShelves, type StoreState } from '../src/game/economy';
import { answerSkit, canAnswer, SKIT_FROM, SKIT_GAP, SKIT_IDS, SKITS, skitGuests, skitsOf, skitToday, type SkitId } from '../src/game/skits';
import { ru } from '../src/i18n/ru';
import { bigDayFor } from '../src/game/bigday';
import { isWet, weatherFor } from '../src/game/weather';

// «Сценки дня» (skits.ts): расписание от дня и зерна, выбор и его последствия, продолжение через пару дней.

const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 20, money: 5000, seed: 7, ...over });

/** Первый день с новой сценкой начиная с from (обычный, не особый). */
function firstSkitDay(from: number, over: Partial<StoreState> = {}): { day: number; id: SkitId; ep: number } {
  for (let day = from; day < from + 200; day++) {
    const today = skitToday(shop({ ...over, day }));
    if (today) return { day, ...today };
  }
  throw new Error('нет сценки за 200 дней');
}

describe('сценки: расписание', () => {
  it('не раньше SKIT_FROM, не в особые дни, не в Заречье', () => {
    expect(skitToday(shop({ day: SKIT_FROM - 1 }))).toBeNull();
    for (let day = SKIT_FROM; day < 120; day++) if (bigDayFor(day)) expect(skitToday(shop({ day }))).toBeNull();
  });

  it('то же на тот же день (перезапуск не перекатывает), а в разных магазинах — по-разному', () => {
    const a = firstSkitDay(SKIT_FROM);
    expect(skitToday(shop({ day: a.day }))).toEqual({ id: a.id, ep: 0 });
    const days = (seed: number) => Array.from({ length: 60 }, (_, i) => Boolean(skitToday(shop({ seed, day: SKIT_FROM + i }))));
    expect(days(7)).not.toEqual(days(8));
  });

  it('курьер приходит только в дождь', () => {
    for (let day = SKIT_FROM; day < 160; day++) {
      const today = skitToday(shop({ day, skits: { done: SKIT_IDS.filter((id) => id !== 'rain') } }));
      if (today) expect(isWet(weatherFor(day))).toBe(true);
    }
  });
});

describe('сценки: выбор', () => {
  it('ответ — последствия и продолжение через пару дней', () => {
    const at = firstSkitDay(SKIT_FROM, { skits: { done: SKIT_IDS.filter((id) => id !== 'pies') } });
    expect(at.id).toBe('pies');
    const s = shop({ day: at.day, skits: { done: SKIT_IDS.filter((id) => id !== 'pies') } });
    const next = answerSkit(s, 'pies', 0, 0)!;
    expect(next.money).toBe(s.money - 150);
    expect(skitsOf(next).cur).toEqual({ id: 'pies', ep: 1, due: at.day + 3 });
    // Сегодня уже ответили — второй раз нельзя; через три дня — продолжение.
    expect(skitToday(next)).toBeNull();
    expect(skitToday({ ...next, day: at.day + 3 })).toEqual({ id: 'pies', ep: 1 });
    const end = answerSkit({ ...next, day: at.day + 3 }, 'pies', 1, 0)!;
    expect(end.money).toBe(next.money + 500);
    expect(skitsOf(end).done).toContain('pies');
    expect(skitsOf(end).nextAt).toBe(at.day + 3 + SKIT_GAP);
    expect(skitGuests(end)).toBeCloseTo(1.06);
    expect(skitGuests({ ...end, day: at.day + 3 + 7 })).toBe(1);
  });

  it('не хватает денег или товара — вариант недоступен', () => {
    expect(canAnswer(shop({ money: 100 }), SKITS.pies.episodes[0].choices[0])).toBe(false);
    const empty = shop({ warehouse: {}, shelves: shop().shelves.map((sh) => ({ ...sh, items: {} })) });
    expect(canAnswer(empty, SKITS.gift.episodes[0].choices[1])).toBe(false);
  });

  it('отданный товар уходит с полок', () => {
    const s = shop();
    const has = onShelves(s, 'bread');
    expect(has).toBeGreaterThan(0);
    const at = firstSkitDay(SKIT_FROM, { skits: { done: SKIT_IDS.filter((id) => id !== 'wallet') } });
    const st = shop({ day: at.day, skits: { done: SKIT_IDS.filter((id) => id !== 'wallet') } });
    const next = answerSkit(st, 'wallet', 0, 0)!;
    expect(onShelves(next, 'bread')).toBe(onShelves(st, 'bread') - 1);
  });

  it('чужой эпизод или не сегодня — null', () => {
    expect(answerSkit(shop({ day: SKIT_FROM - 1 }), 'puppy', 0, 0)).toBeNull();
  });
});

describe('сценки: тексты', () => {
  it('у каждого эпизода — реплики, варианты и ответы на них', () => {
    const keys = ru as Record<string, string>;
    for (const id of SKIT_IDS) {
      expect(keys[`skit.${id}.name`]).toBeTruthy();
      SKITS[id].episodes.forEach((_, ep) => {
        for (const k of ['line1', 'line2', 'a', 'b', 'a.reply', 'b.reply']) expect(keys[`skit.${id}.${ep}.${k}`], `skit.${id}.${ep}.${k}`).toBeTruthy();
      });
    }
  });
});
