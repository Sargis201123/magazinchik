import { describe, expect, it } from 'vitest';
import { CLOSING_ARM_MS, CLOSING_CASCADE_MS, CLOSING_MAX, closingCoins, closingCoinTiming, closingPlan, type ClosingInput } from '../src/game/closing';
import { newGame } from '../src/game/economy';
import { loadGame, saveGame } from '../src/game/save';

const REVENUES = [0, 1, 40, 200, 1240, 1e4, 1e6, 1e9];
/** Все сочетания входа: залы от пустого до самого большого, любая выручка, со светом и без, с питомцами и без. */
function* inputs(): Generator<Omit<ClosingInput, 'lite'>> {
  for (let rows = 0; rows <= 8; rows++)
    for (const revenue of REVENUES)
      for (const dark of [false, true])
        for (const cat of [false, true]) for (const dog of [false, true]) yield { rows, revenue, dark, cat, dog };
}
const base: ClosingInput = { rows: 6, revenue: 1240, lite: false, dark: false, cat: true, dog: true };

describe('ритуал закрытия: план', () => {
  it('без касаний не дольше ~3,5 с, в лёгкой графике — не дольше 2 с и всегда короче', () => {
    for (const o of inputs()) {
      const normal = closingPlan({ ...o, lite: false });
      const lite = closingPlan({ ...o, lite: true });
      expect(normal.total).toBeLessThanOrEqual(CLOSING_MAX.normal);
      expect(lite.total).toBeLessThanOrEqual(CLOSING_MAX.lite);
      expect(lite.total).toBeLessThan(normal.total);
    }
  });

  it('и не мгновенный: даже пустой зал без выручки закрывается заметно (больше секунды)', () => {
    expect(closingPlan({ rows: 0, revenue: 0, lite: false, dark: true, cat: false, dog: false }).total).toBeGreaterThan(1000);
    expect(closingPlan({ rows: 0, revenue: 0, lite: true, dark: true, cat: false, dog: false }).total).toBeGreaterThan(800);
  });

  it('шаги по времени не убывают, «end» — последний и равен total', () => {
    for (const lite of [false, true])
      for (const o of inputs()) {
        const plan = closingPlan({ ...o, lite });
        const at = plan.steps.map((s) => s.at);
        expect(at).toEqual([...at].sort((a, b) => a - b));
        expect(plan.steps.at(-1)).toEqual({ kind: 'end', at: plan.total });
        expect(plan.steps.filter((s) => s.kind === 'end')).toHaveLength(1);
        expect(plan.steps[0].kind).toBe('sign');
        expect(plan.steps.every((s) => s.at > 0)).toBe(true);
      }
  });

  it('ряды гаснут от задней стены к двери, ряд у двери — с рубильником', () => {
    for (let rows = 1; rows <= 8; rows++) {
      const plan = closingPlan({ ...base, rows });
      const lit = plan.steps.filter((s) => s.kind === 'row');
      expect(lit.map((s) => s.row)).toEqual(Array.from({ length: rows - 1 }, (_, i) => i));
      expect(lit.some((s) => s.row === rows - 1)).toBe(false);
      const main = plan.steps.find((s) => s.kind === 'main')!.at;
      expect(lit.every((s) => s.at < main)).toBe(true);
    }
  });

  it('в лёгкой графике все ряды гаснут одним шагом', () => {
    for (let rows = 2; rows <= 8; rows++) {
      const lit = closingPlan({ ...base, rows, lite: true }).steps.filter((s) => s.kind === 'row');
      expect(lit).toHaveLength(1);
      expect(lit[0].row).toBe(rows - 2);
    }
    expect(closingPlan({ ...base, rows: 1, lite: true }).steps.some((s) => s.kind === 'row')).toBe(false);
  });

  it('выручка в ящик — после света и до рубильника; без выручки — без кассы и монет', () => {
    for (const lite of [false, true]) {
      const plan = closingPlan({ ...base, lite });
      const till = plan.steps.find((s) => s.kind === 'till')!;
      const main = plan.steps.find((s) => s.kind === 'main')!;
      const lastRow = Math.max(...plan.steps.filter((s) => s.kind === 'row').map((s) => s.at));
      expect(till.at).toBeGreaterThan(lastRow);
      // Все монеты долетают до рубильника.
      const { from, step, fly } = closingCoinTiming(lite);
      expect(till.at + from + (plan.coins - 1) * step + fly).toBeLessThan(main.at);
      for (const revenue of [0, -50, Number.NaN]) {
        const none = closingPlan({ ...base, lite, revenue });
        expect(none.coins).toBe(0);
        expect(none.steps.some((s) => s.kind === 'till')).toBe(false);
        expect(none.total).toBeLessThan(plan.total);
      }
    }
  });

  it('монеты: от 3, не убывают с выручкой, не больше 12 (лёгкая — 4)', () => {
    for (const lite of [false, true]) {
      let prev = 0;
      for (let revenue = 1; revenue < 1e7; revenue = Math.ceil(revenue * 1.7)) {
        const n = closingCoins(revenue, lite);
        expect(n).toBeGreaterThanOrEqual(3);
        expect(n).toBeGreaterThanOrEqual(prev);
        expect(n).toBeLessThanOrEqual(lite ? 4 : 12);
        prev = n;
      }
      expect(closingCoins(1e12, lite)).toBe(lite ? 4 : 12);
    }
    expect(closingCoins(0, false)).toBe(0);
    expect(closingPlan(base).coins).toBe(closingCoins(base.revenue, false));
  });

  it('без света (отключили) — ни одного ряда, рубильник есть', () => {
    for (const lite of [false, true]) {
      const plan = closingPlan({ ...base, lite, dark: true });
      expect(plan.steps.some((s) => s.kind === 'row')).toBe(false);
      expect(plan.steps.filter((s) => s.kind === 'main')).toHaveLength(1);
      expect(plan.steps.some((s) => s.kind === 'shutters')).toBe(true);
    }
  });

  it('нет кота / Бобика — нет их шагов; кот раньше Бобика, Бобик раньше роллет', () => {
    const kinds = (o: Partial<ClosingInput>) => closingPlan({ ...base, ...o }).steps.map((s) => s.kind);
    expect(kinds({ cat: false })).not.toContain('cat');
    expect(kinds({ dog: false })).not.toContain('dog');
    expect(kinds({ cat: false, dog: false })).not.toContain('dog');
    for (const lite of [false, true]) {
      const at = (k: string) => closingPlan({ ...base, lite }).steps.find((s) => s.kind === k)!.at;
      expect(at('main')).toBeLessThan(at('cat'));
      expect(at('cat')).toBeLessThan(at('dog'));
      expect(at('dog')).toBeLessThan(at('shutters'));
      expect(at('shutters')).toBeLessThan(at('end'));
    }
  });

  it('один и тот же вход — тот же план (никакой случайности)', () => {
    for (const o of inputs()) expect(closingPlan({ ...o, lite: false })).toEqual(closingPlan({ ...o, lite: false }));
  });

  it('касание: защита от случайного пропуска короче самого первого света, остаток — быстрее секунды', () => {
    const plan = closingPlan(base);
    expect(CLOSING_ARM_MS).toBeLessThan(plan.steps.find((s) => s.kind === 'row')!.at);
    expect(CLOSING_CASCADE_MS).toBeLessThanOrEqual(600);
  });

  it('старые сохранения: ритуал ничего не хранит — сохранение и загрузка те же', () => {
    const store = new Map<string, string>();
    const ls = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    };
    Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true });
    const old = { ...newGame(), day: 12, money: 345 };
    saveGame(old);
    const loaded = loadGame()!;
    expect(loaded.day).toBe(12);
    expect(loaded.money).toBe(345);
    expect(Object.keys(loaded).filter((k) => /clos|ritual/i.test(k))).toEqual([]);
  });
});
