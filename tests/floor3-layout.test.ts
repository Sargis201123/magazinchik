// Раскладка фудкорта (scenes/floors/thirdLayout.ts, 14.11): люди ходят только по проходам — ни один путь между
// лифтом, подносами, очередями, местами за столами, урной и детской зоной не проходит сквозь мебель, при любом
// наборе улучшений и с ремонтом и без.
import { describe, expect, it } from 'vitest';
import * as L from '../src/scenes/floors/thirdLayout';

/** Полоса у ног человека: полкорпуса в стороны, чуть выше и ниже ног. */
const HALF = 4.5;
const FOOT_UP = 2;
const FOOT_DOWN = 0.5;

const hits = (p: L.Pt, b: L.Box): boolean => p.x + HALF > b.x0 && p.x - HALF < b.x1 && p.y + FOOT_DOWN > b.y0 && p.y - FOOT_UP < b.y1;

/** Прошёл ли отрезок пути сквозь предмет (проверяем часто, через полточки). */
function crosses(a: L.Pt, b: L.Pt, boxes: L.Box[]): L.Box | null {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2);
  for (let k = 0; k <= n; k++) {
    const p = { x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n };
    const box = boxes.find((o) => hits(p, o));
    if (box) return box;
  }
  return null;
}

const VARIANTS = [
  { row3: false, kids: false, stage: false },
  { row3: false, kids: true, stage: false },
  { row3: true, kids: false, stage: false },
  { row3: true, kids: true, stage: true },
];

/** Куда ходят на этом наборе: лифт, подносы, урна, очереди и выход из них, подходы к местам, детская зона. */
function targets(v: (typeof VARIANTS)[number]): L.Pt[] {
  const out: L.Pt[] = [L.LIFT_IN, L.TRAY_SPOT];
  for (let k = 0; k < L.BIN_QUEUE; k++) out.push(L.binSlot(k));
  L.STALL_X.forEach((x, i) => out.push({ x, y: L.AISLES[0] }, { x, y: L.QUEUE_Y[1] }, { x, y: L.QUEUE_Y[0] }, L.queueExit(i)));
  L.TABLES.forEach((_, k) => {
    if (!L.hasTable(k, v.row3)) return;
    for (const s of L.seatsOf(k)) out.push(s.approach);
  });
  if (v.kids) out.push(L.KID_TOP);
  return out;
}

describe('фудкорт: люди не ходят сквозь мебель', () => {
  for (const v of VARIANTS) {
    it(`ремонт ${v.row3 ? 'есть' : 'нет'}, детская зона ${v.kids ? 'есть' : 'нет'}, сцена ${v.stage ? 'есть' : 'нет'}`, () => {
      const boxes = L.obstacles(v);
      const spots = targets(v);
      // Сами точки свободны.
      for (const p of spots) expect(boxes.find((b) => hits(p, b)), `точка ${p.x},${p.y}`).toBeUndefined();
      // Между любыми двумя — путь по проходам, ни один отрезок не задевает мебель. И по середине прохода, и по
      // крайним полосам (у каждого человека своя, до ±LANE — 14.11).
      for (const lane of [-L.LANE, 0, L.LANE]) {
        for (const from of spots) {
          for (const to of spots) {
            let at = from;
            for (const p of L.route(from, to, lane)) {
              const box = crosses(at, p, boxes);
              expect(box, `полоса ${lane}, ${from.x},${from.y} → ${to.x},${to.y}: отрезок ${at.x},${at.y} → ${p.x},${p.y}`).toBeNull();
              at = p;
            }
            expect(at).toEqual(to);
          }
        }
      }
    });
  }

  it('очередь к урне: места свободны, от места к месту — шаг без мебели, первое — у урны', () => {
    expect(L.binSlot(0)).toEqual(L.BIN_SPOT);
    expect(L.binSlot(99)).toEqual(L.binSlot(L.BIN_QUEUE - 1));
    for (const v of VARIANTS) {
      const boxes = L.obstacles(v);
      for (let k = 1; k < L.BIN_QUEUE; k++) {
        expect(crosses(L.binSlot(k), L.binSlot(k - 1), boxes), `место ${k} → ${k - 1}`).toBeNull();
        expect(L.binSlot(k)).not.toEqual(L.binSlot(k - 1));
      }
    }
  });

  it('путь кончается в цели, без лишних точек; по коридору у лифта — напрямую', () => {
    const path = L.route(L.TRAY_SPOT, L.LIFT_IN);
    expect(path).toEqual([L.LIFT_IN]);
    // От урны (у правой стены) к лифту — по проходу у стоек, без крюка вниз (14.11).
    const out = L.route(L.BIN_SPOT, L.LIFT_IN);
    expect(out.every((q) => q.y <= L.BIN_SPOT.y)).toBe(true);
    expect(out.at(-1)).toEqual(L.LIFT_IN);
    const seat = L.seatsOf(1)[3].approach;
    const p = L.route(L.LIFT_IN, seat);
    expect(p.at(-1)).toEqual(seat);
    for (let k = 1; k < p.length; k++) expect(p[k]).not.toEqual(p[k - 1]);
    // Своя полоса: по коридору у лифта идут сбоку от середины и только у цели шагают на неё.
    expect(L.route(L.TRAY_SPOT, L.LIFT_IN, 3)).toEqual([{ x: L.LIFT_X + 1.5, y: L.LIFT_IN.y }, L.LIFT_IN]);
    expect(L.route(L.LIFT_IN, seat, 2).slice(0, -1).every((q) => q.x !== seat.x || q.y !== seat.y)).toBe(true);
  });

  it('места за столами: по шесть у каждого стола (22.11: и у нижнего ряда - под ним теперь проход)', () => {
    expect(L.seatsOf(0)).toHaveLength(6);
    expect(L.seatsOf(3)).toHaveLength(6);
    expect(L.seatsOf(4)).toHaveLength(6);
    // Сидят лицом к нам — выше столешницы, спиной — ниже; подходят снаружи стола.
    for (const s of L.seatsOf(2)) {
      const t = L.TABLES[s.table];
      if (s.back) expect(s.approach.y).toBeLessThan(t.y - L.TABLE_D);
      else expect(s.approach.y).toBeGreaterThan(t.y);
    }
  });

  it('22.11: детская зона и сцена - своей полосой внизу зала, ниже столовой и нижнего прохода, в пределах зала', () => {
    const dine = L.dine(true);
    const last = L.AISLES[L.AISLES.length - 1];
    for (const b of [L.KIDS, L.STAGE]) {
      expect(b.y0).toBeGreaterThan(dine.y1);
      expect(b.y0).toBeGreaterThan(last + L.LANE);
      expect(b.y1).toBeLessThanOrEqual(L.H);
      expect(b.x0).toBeGreaterThanOrEqual(4);
      expect(b.x1).toBeLessThanOrEqual(L.W - 4);
    }
    // Не наезжают друг на друга, и между ними стоит тот, кто присматривает за детьми.
    expect(L.KIDS.x1).toBeLessThan(L.STAGE.x0);
    expect(L.WATCH.x).toBeGreaterThan(L.KIDS.x1);
    expect(L.WATCH.x).toBeLessThan(L.STAGE.x0);
    // Все столы - внутри столовой.
    for (const t of L.TABLES) {
      expect(t.x - L.TABLE_W / 2).toBeGreaterThan(dine.x0);
      expect(t.x + L.TABLE_W / 2).toBeLessThan(dine.x1);
      expect(t.y).toBeLessThan(dine.y1);
    }
  });
});
