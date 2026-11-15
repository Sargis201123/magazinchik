// Живые этажи (game/floorLife.ts, 15.11): моменты этажей — по зерну и дню, делят бюджет внимания с залом, награда
// маленькая и никогда не уводит кассу в минус; толпа на этаже — не меньше минимума; старое сохранение — как было.
import { describe, expect, it } from 'vitest';
import {
  catchFloorMoment,
  FLOOR_GAP,
  FLOOR_MOMENT_KINDS,
  FLOOR_MOMENTS_MAX,
  FLOOR_SPAN,
  floorCrowd,
  floorKinds,
  floorMomentGain,
  floorMomentsFor,
  noteFloorMoment,
} from '../src/game/floorLife';
import { ATTENTION_CAP, attentionTotal, planAttention } from '../src/game/attention';
import { momentTip } from '../src/game/moments';
import { DAY_SECONDS, emptyDayStats, newGame, type StoreState } from '../src/game/economy';
import { pendingTip } from '../src/game/tips';
import { collectionFor, COLLECTIONS } from '../src/game/clothes';
import { blocks, CHATS, PATROL, RACKS, route, SPOTS, type Point, type Rect } from '../src/scenes/floors/secondLayout';

const base = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 120, level: 4, seed: 7, ...patch });
const withBasement = (s: StoreState, slots = 3): StoreState => ({ ...s, floors: { ...s.floors, basement: { since: 1, finish: 1 } }, basement: { slots, since: 1 } });
const withSecond = (s: StoreState, stock: Partial<Record<'warm' | 'rain' | 'summer', number>> = { warm: 20, rain: 20, summer: 20 }): StoreState => ({
  ...s,
  floors: { ...s.floors, second: { since: 1, finish: 0 } },
  clothes: { stock },
});

describe('моменты этажей: когда и какие', () => {
  it('нет этажей (старое сохранение) — моментов нет', () => {
    expect(floorMomentsFor(base())).toEqual([]);
    expect(floorMomentsFor({ ...base(), floors: undefined, basement: undefined, clothes: undefined })).toEqual([]);
  });

  it('этаж открыт, но пуст (нет автоматов, нет вещей) — звать некого', () => {
    const s = withSecond(withBasement(base(), 0), {});
    expect(floorMomentsFor(s)).toEqual([]);
  });

  it('по зерну и дню: тот же день — тот же момент; разные дни — разные', () => {
    const s = withSecond(withBasement(base()));
    expect(floorMomentsFor(s)).toEqual(floorMomentsFor({ ...s }));
    const seen = new Set<string>();
    for (let day = 100; day < 160; day++) for (const m of floorMomentsFor({ ...s, day })) seen.add(`${m.floor}:${m.kind}`);
    // За два месяца встречаются все шесть видов.
    expect(seen.size).toBe(6);
  });

  it('два этажа — два момента, в окне дня и не ближе FLOOR_GAP друг к другу', () => {
    for (let day = 100; day < 140; day++) {
      const list = floorMomentsFor(withSecond(withBasement(base({ day }))));
      expect(list).toHaveLength(Math.min(2, FLOOR_MOMENTS_MAX));
      expect(new Set(list.map((m) => m.floor)).size).toBe(2);
      for (const m of list) {
        expect(m.at).toBeGreaterThanOrEqual(Math.floor(FLOOR_SPAN[0] * DAY_SECONDS));
        expect(m.at).toBeLessThanOrEqual(Math.ceil(FLOOR_SPAN[1] * DAY_SECONDS));
        expect(FLOOR_MOMENT_KINDS[m.floor]).toContain(m.kind);
      }
      expect(list[1].at - list[0].at).toBeGreaterThanOrEqual(Math.floor(FLOOR_GAP * DAY_SECONDS));
    }
  });

  it('«нужен размер» — только когда есть вещи этого сезона', () => {
    for (let day = 100; day < 160; day += 7) {
      const coll = collectionFor(day);
      const other = COLLECTIONS.find((c) => c !== coll)!;
      expect(floorKinds(withSecond(base({ day }), { [coll]: 5 }), 'second')).toContain('size');
      const kinds = floorKinds(withSecond(base({ day }), { [other]: 5 }), 'second');
      expect(kinds).not.toContain('size');
      expect(kinds).toEqual(['queue', 'thief']);
    }
    expect(floorKinds(withSecond(base(), {}), 'second')).toEqual([]);
  });

  it('в Заречье этажей Центра нет — и моментов тоже', () => {
    const s = { ...withSecond(withBasement(base())), zar: { at: 'zar' } } as unknown as StoreState;
    expect(floorMomentsFor(s)).toEqual([]);
  });
});

describe('моменты этажей: награда', () => {
  it('деньги — от чаевых момента зала: вдвое за размер, вора и автомат, искорка — за буяна', () => {
    const tip = momentTip(4);
    expect(floorMomentGain('size', 4)).toEqual({ money: tip * 2, star: false });
    expect(floorMomentGain('thief', 4)).toEqual({ money: tip * 2, star: false });
    expect(floorMomentGain('jam', 4)).toEqual({ money: tip * 2, star: false });
    expect(floorMomentGain('queue', 4)).toEqual({ money: tip, star: false });
    expect(floorMomentGain('change', 4)).toEqual({ money: tip, star: false });
    expect(floorMomentGain('rowdy', 4)).toEqual({ money: 0, star: true });
  });

  it('поймал — деньги в кассу и учёт; пропустил — только «показали»', () => {
    const stats = emptyDayStats();
    const s = base({ money: 100 });
    const got = catchFloorMoment(s, stats, 'jam');
    expect(got.state.money).toBe(100 + momentTip(4) * 2);
    expect(stats).toMatchObject({ floorShown: 1, floorCaught: 1, floorMoney: momentTip(4) * 2 });
    noteFloorMoment(stats, false);
    expect(stats).toMatchObject({ floorShown: 2, floorCaught: 1 });
    const star = catchFloorMoment(s, stats, 'rowdy');
    expect(star.state).toBe(s);
    expect(stats.momentStars).toBe(1);
  });

  it('за день моменты этажей дают немного: два пойманных — меньше пятой части дневной аренды универмага', () => {
    const most = Math.max(...Object.values(FLOOR_MOMENT_KINDS).flat().map((k) => floorMomentGain(k, 5).money));
    expect(most * FLOOR_MOMENTS_MAX).toBeLessThan(200);
  });
});

describe('бюджет внимания: этажи делят те же пять мест', () => {
  it('без этажей — всё как раньше', () => {
    expect(planAttention({ moments: 3, live: 2, special: false, calls: 2 })).toEqual({ moments: 2, live: 1, special: false, calls: 2 });
  });

  it('обычный день с этажами: момент этажа есть, всего — не больше пяти', () => {
    const plan = planAttention({ moments: 3, live: 2, special: false, calls: 2, floor: 2 });
    expect(plan.floor).toBe(1);
    expect(attentionTotal(plan)).toBe(ATTENTION_CAP);
    expect(plan.calls).toBe(2);
    const quiet = planAttention({ moments: 3, live: 2, special: false, calls: 0, floor: 2 });
    expect(quiet.floor).toBe(2);
    expect(attentionTotal(quiet)).toBe(ATTENTION_CAP);
  });
});

describe('толпа на этаже', () => {
  it('не меньше минимума, не больше потолка; в лёгкой графике — вдвое меньше, но не пусто', () => {
    expect(floorCrowd('basement', 0, false)).toBe(4);
    expect(floorCrowd('basement', 100, false)).toBe(9);
    expect(floorCrowd('second', 0, false)).toBe(3);
    expect(floorCrowd('second', 200, false)).toBe(6);
    expect(floorCrowd('second', 1000, false)).toBe(7);
    expect(floorCrowd('second', 0, true)).toBe(2);
    expect(floorCrowd('basement', 100, true)).toBe(5);
  });
});

describe('карточка «Новое!» и старые сохранения', () => {
  it('карточка о моментах этажей — когда на этаже есть кого звать', () => {
    const seenAll = (s: StoreState): StoreState => ({ ...s, seenTips: ['broke', 'ownerTill', 'alone', 'thief', 'rhythm', 'weekly', 'basement', 'clothes', 'foodcourt', 'estate', 'gentrify', 'van', 'pawn', 'rental', 'lottery', 'license'] });
    const quiet = seenAll(withSecond(base(), {}));
    expect(pendingTip(quiet)).not.toBe('floorLife');
    const alive = seenAll(withBasement(base()));
    const tips: string[] = [];
    let s = alive;
    for (let i = 0; i < 40; i++) {
      const tip = pendingTip({ ...s, tipDay: undefined });
      if (!tip) break;
      tips.push(tip);
      s = { ...s, seenTips: [...(s.seenTips ?? []), tip] };
    }
    expect(tips).toContain('floorLife');
  });

  it('старое сохранение (без этажей и новых полей статистики) — без моментов, итоги дня без новой строки', () => {
    const old = JSON.parse(JSON.stringify({ ...newGame(), day: 30 })) as StoreState;
    expect(floorMomentsFor(old)).toEqual([]);
    expect(pendingTip({ ...old, seenTips: ['ownerTill', 'thief', 'rhythm'] })).not.toBe('floorLife');
    const stats = emptyDayStats();
    expect(stats.floorShown).toBeUndefined();
  });
});

/** Полкорпуса человечка в стороны (как в floor2-layout). */
const HALF = 3;
const inside = (p: Point, r: Rect): boolean => p.x > r.x - HALF && p.x < r.x + r.w + HALF && p.y > r.y && p.y < r.y + r.h;
function samples(from: Point, path: Point[]): Point[] {
  const out: Point[] = [];
  let at = from;
  for (const p of path) {
    const n = Math.max(1, Math.ceil(Math.hypot(p.x - at.x, p.y - at.y) * 2));
    for (let i = 1; i <= n; i++) out.push({ x: at.x + ((p.x - at.x) * i) / n, y: at.y + ((p.y - at.y) * i) / n });
    at = p;
  }
  return out;
}

describe('второй этаж: новые места для людей', () => {
  it('стол со стопками, болтовня, обход охранника — не в мебели, и путь к ним в обход', () => {
    const solid = blocks(6);
    const spots: Point[] = [SPOTS.stairsTop, SPOTS.fold, SPOTS.till, SPOTS.mirror, ...CHATS.flat(), ...PATROL, ...RACKS.map((r) => SPOTS.rack(r, 4))];
    for (const a of spots) {
      for (const r of solid) expect(inside(a, r), `точка ${a.x},${a.y} внутри ${r.name}`).toBe(false);
      for (const b of spots) {
        for (const p of samples(a, route(a, b))) {
          const hit = solid.find((r) => inside(p, r));
          expect(hit?.name, `путь ${a.x},${a.y} → ${b.x},${b.y} через ${p.x.toFixed(1)},${p.y.toFixed(1)}`).toBeUndefined();
        }
      }
    }
  });
});
