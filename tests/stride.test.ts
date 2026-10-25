import { describe, expect, it } from 'vitest';
import { crosses, findPath, type Rect } from '../src/scenes/paths';
import {
  facingAlong,
  frameStride,
  makeRoute,
  MAX_LANE,
  paceAt,
  planPace,
  polylineLength,
  roundCorners,
  sampleRoute,
  sidestep,
  turnVia,
} from '../src/scenes/stride';

const shelf: Rect = { x: 0, y: 0, w: 20, h: 20 };

describe('stride: скруглённые углы', () => {
  it('прямой путь не меняется', () => {
    expect(roundCorners({ x: 0, y: 0 }, [{ x: 30, y: 0 }], [])).toEqual([{ x: 30, y: 0 }]);
  });

  it('угол обхода полки — дугой, концы на месте, полку не задевает', () => {
    const from = { x: -10, y: 25 };
    const to = { x: 25, y: -10 };
    const legs = findPath(from, to, [shelf]);
    expect(legs.length).toBeGreaterThan(1);
    const round = roundCorners(from, legs, [shelf]);
    expect(round.length).toBeGreaterThan(legs.length);
    expect(round.at(-1)).toEqual(to);
    // Дуга короче излома, но срезает не больше допуска: внутрь полки (с запасом 1,5) не заходит.
    expect(polylineLength(from, round)).toBeLessThan(polylineLength(from, legs));
    const inner: Rect = { x: 1.5, y: 1.5, w: 17, h: 17 };
    let a = from;
    for (const b of round) {
      expect(crosses(a, b, inner)).toBe(false);
      a = b;
    }
  });

  it('поворот на дуге плавный: соседние куски пути расходятся не больше чем на 30°', () => {
    const from = { x: 0, y: 0 };
    const round = roundCorners(from, [{ x: 40, y: 0 }, { x: 40, y: 40 }], []);
    const pts = [from, ...round];
    for (let i = 2; i < pts.length; i++) {
      const a = Math.atan2(pts[i - 1].y - pts[i - 2].y, pts[i - 1].x - pts[i - 2].x);
      const b = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
      expect(Math.abs(b - a)).toBeLessThanOrEqual(Math.PI / 6 + 1e-9);
    }
  });

  it('разворот назад не скругляет — там поворот на месте', () => {
    const round = roundCorners({ x: 0, y: 0 }, [{ x: 20, y: 0 }, { x: 0, y: 1 }], []);
    expect(round).toEqual([{ x: 20, y: 0 }, { x: 0, y: 1 }]);
  });

  it('дуга, которая задела бы препятствие, уменьшается или остаётся углом', () => {
    // Узкий проход: стена сразу за углом.
    const wall: Rect = { x: 21, y: -30, w: 10, h: 29 };
    const from = { x: 0, y: 0 };
    const round = roundCorners(from, [{ x: 20, y: 0 }, { x: 20, y: -20 }], [wall]);
    let a = from;
    for (const b of round) {
      expect(crosses(a, b, { x: 22.5, y: -28.5, w: 7, h: 26 })).toBe(false);
      a = b;
    }
  });
});

describe('stride: путь и скорость', () => {
  it('точка на пути и направление', () => {
    const route = makeRoute([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    expect(route.length).toBe(20);
    expect(sampleRoute(route, 5)).toMatchObject({ x: 5, y: 0, dx: 1, dy: 0 });
    expect(sampleRoute(route, 15)).toMatchObject({ x: 10, y: 5, dx: 0, dy: 1 });
    expect(sampleRoute(route, 99)).toMatchObject({ x: 10, y: 10 });
  });

  it('разгон и торможение — за то же время, что ровным шагом: ход игры не меняется', () => {
    for (const [length, duration] of [
      [100, 2500],
      [8, 200],
      [3, 40],
    ]) {
      const pace = planPace(length, duration);
      expect(paceAt(pace, 0).s).toBe(0);
      expect(paceAt(pace, duration).s).toBeCloseTo(length, 6);
      // Путь только вперёд, без рывков назад.
      let last = 0;
      for (let t = 0; t <= duration; t += duration / 50) {
        const { s, v } = paceAt(pace, t);
        expect(s).toBeGreaterThanOrEqual(last - 1e-9);
        if (t > 0) expect(v).toBeGreaterThan(0);
        last = s;
      }
    }
  });

  it('с места — разгон, в конце — притормаживает, середина чуть быстрее ровного шага', () => {
    const pace = planPace(100, 2500);
    const even = 100 / 2500;
    expect(paceAt(pace, 0).v).toBe(0);
    expect(paceAt(pace, 1250).v).toBeGreaterThan(even);
    expect(paceAt(pace, 1250).v).toBeLessThan(even * 1.1);
    expect(paceAt(pace, 2500).v).toBeLessThan(paceAt(pace, 1250).v * 0.5);
  });

  it('продолжает путь на ходу — без разгона с нуля', () => {
    const pace = planPace(100, 2500, 0.04);
    expect(paceAt(pace, 0).v).toBeGreaterThan(0.035);
    expect(paceAt(pace, 2500).s).toBeCloseTo(100, 6);
  });

  it('нулевой путь — сразу на месте', () => {
    expect(paceAt(planPace(0, 0), 0)).toEqual({ s: 0, v: 0 });
  });
});

describe('stride: куда смотреть и шаг', () => {
  it('по диагонали не мигает: держит прежнюю сторону, пока поворот не явный', () => {
    expect(facingAlong(1, 0)).toBe('right');
    expect(facingAlong(0, -1)).toBe('up');
    expect(facingAlong(1, -1.1, 'right')).toBe('right');
    expect(facingAlong(1, -1.1, 'up')).toBe('up');
    expect(facingAlong(1, -1.5, 'right')).toBe('up');
    expect(facingAlong(-1, 0.2, 'right')).toBe('left');
  });

  it('кругом — через промежуточную сторону, на четверть — сразу', () => {
    expect(turnVia('left', 'right', 1)).toBe('down');
    expect(turnVia('up', 'down', -1)).toBe('left');
    expect(turnVia('down', 'up', 1)).toBe('right');
    expect(turnVia('left', 'up', 0)).toBeUndefined();
  });

  it('шаг шире у быстрых, короче у детей и стариков', () => {
    const base = frameStride(40, 40);
    expect(frameStride(90, 40)).toBeGreaterThan(base);
    expect(frameStride(90, 40) / base).toBeCloseTo(1.5, 6);
    expect(frameStride(40, 40, 0.8)).toBeLessThan(base);
    expect(frameStride(29, 40, 1, 0.8)).toBeLessThan(base);
  });
});

describe('stride: разойтись со встречным', () => {
  const me = { x: 0, y: 0 };
  const standing = (x: number, y: number) => ({ x, y, dx: 0, dy: 0, moving: false });
  const going = (x: number, y: number, dx: number, dy: number) => ({ x, y, dx, dy, moving: true });

  it('никого впереди — идёт своим путём', () => {
    expect(sidestep(me, 1, 0, 0, [])).toBe(0);
    expect(sidestep(me, 1, 0, 0, [standing(-10, 0)])).toBe(0);
    expect(sidestep(me, 1, 0, 0, [standing(10, 16)])).toBe(0);
  });

  it('встречный в лоб — держится правее', () => {
    const lane = sidestep(me, 1, 0, 0, [going(12, 0, -1, 0)]);
    // Идёт вправо (по экрану): его правая сторона — вниз.
    expect(lane).toBeGreaterThan(0);
    expect(lane).toBeLessThanOrEqual(MAX_LANE);
  });

  it('встречный уже правее — расходятся, оставляя его справа', () => {
    expect(sidestep(me, 1, 0, 0, [going(12, 4, -1, 0)])).toBeLessThan(0);
  });

  it('стоящего обходят с ближней стороны, попутчика не обгоняют', () => {
    expect(sidestep(me, 0, -1, 0, [standing(2, -10)])).toBeLessThan(0);
    expect(sidestep(me, 0, -1, 0, [standing(-2, -10)])).toBeGreaterThan(0);
    expect(sidestep(me, 1, 0, 0, [going(10, 0, 1, 0)])).toBe(0);
  });

  it('двое навстречу и стоящий у прохода — расходятся в разные стороны, а не оба туда же', () => {
    // Проход по горизонтали; стоящий чуть ниже пути, синий идёт вправо, красный — влево.
    // Синий решил первым; красный видит, куда тот уже отходит (shift), и обходит с другой стороны.
    const green = standing(110, 254);
    const blue = { x: 98, y: 252 };
    const red = { x: 116, y: 252 };
    const forBlue = sidestep(blue, 1, 0, 0, [green, going(red.x, red.y, -1, 0)]);
    const forRed = sidestep(red, -1, 0, 0, [green, { ...going(blue.x, blue.y, 1, 0), shift: forBlue }]);
    // В координатах экрана: сдвиг синего (вправо по ходу) — вниз, красного — вверх.
    const blueY = blue.y + forBlue;
    const redY = red.y - forRed;
    expect(Math.abs(blueY - redY)).toBeGreaterThanOrEqual(8);
  });

  it('встречный уже решил уступить — его ждут там, куда он отходит', () => {
    // Встречный на моём пути, но уже отходит вправо по своему ходу (для меня — влево): иду прямо или правее.
    expect(sidestep(me, 1, 0, 0, [{ ...going(20, 0, -1, 0), shift: MAX_LANE }])).toBeGreaterThanOrEqual(0);
  });

  it('кто стоит дальше цели (встаёт в очередь за ним), тот не помеха', () => {
    const ahead = standing(0, -15);
    expect(sidestep(me, 0, -1, 0, [ahead], 5)).toBe(0);
    expect(sidestep(me, 0, -1, 0, [ahead], 20)).not.toBe(0);
  });

  it('в мебель не отходит: свободна только одна сторона — туда', () => {
    const lane = sidestep(me, 1, 0, 0, [standing(10, 0)], Infinity, (l) => l <= 0);
    expect(lane).toBeLessThan(0);
    expect(sidestep(me, 1, 0, 0, [standing(10, 0)], Infinity, () => false)).toBe(0);
  });

  it('вбок — не дальше MAX_LANE', () => {
    expect(Math.abs(sidestep(me, 1, 0, 0, [standing(5, -0.5)]))).toBeLessThanOrEqual(MAX_LANE);
  });
});
