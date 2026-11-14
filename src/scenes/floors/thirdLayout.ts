// Раскладка фудкорта (14.11): где что стоит на третьем этаже и как по нему ходят. Голые числа без Phaser — их
// читает и сцена (floors/thirdFloor.ts), и тест (tests/floor3-layout.test.ts): «люди не ходят сквозь мебель»
// проверяется на этих же числах, а не на глаз.
//
// Мир этажа — 168×230 точек (floorView.ts W, H). Задняя стена своя, выше общей (58): окна на район до подоконника
// (40), под ними — обшивка. Вдоль стены — лифт слева и четыре места под точки еды; перед ними — очереди. Дальше —
// столы в два ряда по два (третий ряд — после ремонта), внизу слева — детская зона, справа — сцена (улучшения
// заменяют собой стол нижнего ряда). Ходят по проходам поперёк зала (AISLES) и двум коридорам вдоль (CORRIDORS):
// у лифта и посередине; к столу, к очереди и к урне — от ближнего прохода прямо вверх или вниз.
//
// Координаты людей — точка у ног (как низ предмета): глубина по ней же. Человечек выше ног на FOOT.

export interface Pt {
  x: number;
  y: number;
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Размер зала (как floorView.ts) и низ задней стены фудкорта. */
export const W = 168;
export const H = 230;
export const WALL_BOTTOM = 58;
/** Окна — от балки до подоконника. */
export const WINDOW_TOP = 2;
export const SILL = 40;
/** Сколько от ног до середины человечка (спрайт 12×18 точек, ноги внизу). */
export const FOOT = 8.5;

/** Лифт: середина проёма; в кабине стоят на этой высоте (ноги), выходят — вниз по коридору у лифта. */
export const LIFT_X = 19;
export const LIFT_IN: Pt = { x: LIFT_X, y: 56 };

/** Места под точки еды (середины), низ стойки; очередь — у стойки и за ним. */
export const STALL_X = [48, 80, 112, 144];
export const COUNTER_BOTTOM = 76;
export const QUEUE_Y = [80, 91];
/** Отошёл от стойки — шаг вбок, чтобы не идти сквозь того, кто стоит за ним. Последняя точка — влево. */
export const queueExit = (i: number): Pt => ({ x: STALL_X[i] + (i === STALL_X.length - 1 ? -11 : 11), y: 82 });

/** Проходы поперёк зала (высота ног) и коридоры вдоль (x). */
export const AISLES = [104, 150, 192];
export const CORRIDORS = [LIFT_X, 84];

/** Стойка с подносами и урны у левой стены: где стоят они и где встаёт тот, кто берёт или сдаёт поднос. */
export const TRAYS: Pt = { x: 9, y: 86 };
export const TRAY_SPOT: Pt = { x: LIFT_X, y: 84 };
export const BINS: Pt = { x: 9, y: 132 };
export const BIN_SPOT: Pt = { x: LIFT_X, y: 128 };

/** Стол на шестерых: середина, низ (y), ряд. Места — по три с каждой стороны. */
export interface Table {
  x: number;
  y: number;
  row: number;
}
export const TABLE_W = 50;
export const TABLE_D = 22;
export const SEAT_DX = [-16, 0, 16];
const ROWS = [136, 176, 220];
const COLS = [50, 118];
/** Ряды 0–1 — всегда; нижний (2) — после ремонта; детская зона и сцена занимают его левый и правый стол. */
export const TABLES: Table[] = ROWS.flatMap((y, row) => COLS.map((x) => ({ x, y, row })));

export interface Seat {
  table: number;
  /** Сидит за столом сзади (лицом к нам) или спереди (спиной). */
  back: boolean;
  x: number;
  /** Где сидит (середина человечка) и куда подходит, прежде чем сесть (ноги). */
  sitY: number;
  approach: Pt;
}

/** Все места за столом: у нижнего ряда — только сзади (спереди — край зала). */
export function seatsOf(k: number): Seat[] {
  const t = TABLES[k];
  const out: Seat[] = [];
  for (const dx of SEAT_DX) out.push({ table: k, back: true, x: t.x + dx, sitY: t.y - 23, approach: { x: t.x + dx, y: t.y - TABLE_D - 1 } });
  if (t.row < 2) for (const dx of SEAT_DX) out.push({ table: k, back: false, x: t.x + dx, sitY: t.y - 9, approach: { x: t.x + dx, y: t.y + 2 } });
  return out;
}

/** Детская зона (нижний левый стол): коврик, горка, сухой бассейн, лошадка; где играют дети. */
export const KIDS: Box = { x0: 6, y0: 195, x1: 76, y1: 224 };
export const SLIDE: Pt = { x: 18, y: 218 };
export const PIT: Pt = { x: 52, y: 219 };
export const HORSE: Pt = { x: 69, y: 212 };
/** Две «развилки» на коврике: от них — к горке (снизу), к бассейну и лошадке (сверху). */
export const KID_TOP: Pt = { x: 34, y: 202 };
export const KID_BOTTOM: Pt = { x: 34, y: 222 };
/** Горка: к лесенке (по низу коврика, перед горкой), наверх, съехать. */
export const SLIDE_PATH: Pt[] = [
  { x: 11, y: 222 },
  { x: 11, y: 206 },
  { x: 27, y: 220 },
];
/** Бассейн: край, откуда забираются, и где стоят в шариках. Лошадка: где сидит ребёнок. */
export const PIT_EDGE: Pt = { x: 48, y: 203 };
export const PIT_IN: Pt = { x: 52, y: 214 };
export const HORSE_SEAT: Pt = { x: 68, y: 213 };
/** К лошадке — по верху коврика, мимо бассейна. */
export const HORSE_WAY: Pt = { x: 68, y: 203 };
/** Сцена (нижний правый стол) и где стоит музыкант. */
export const STAGE: Box = { x0: 92, y0: 197, x1: 144, y1: 224 };
export const MUSICIAN: Pt = { x: 118, y: 211 };

/** Растения и кулер у правой стены. */
export const PLANTS: Pt[] = [
  { x: 156, y: 126 },
  { x: 156, y: 222 },
];
export const COOLER: Pt = { x: 157, y: 170 };

/** Что занимает пол (ноги людей сюда не заходят): прямоугольники по низу предметов. */
export function obstacles(o: { row3: boolean; kids: boolean; stage: boolean }): Box[] {
  const out: Box[] = [
    // Стойки точек (кухня у стены и стойка с витриной).
    { x0: STALL_X[0] - 16, y0: WALL_BOTTOM, x1: STALL_X[3] + 16, y1: COUNTER_BOTTOM },
    { x0: TRAYS.x - 5, y0: TRAYS.y - 6, x1: TRAYS.x + 5, y1: TRAYS.y },
    { x0: BINS.x - 5, y0: BINS.y - 6, x1: BINS.x + 5, y1: BINS.y },
    ...PLANTS.map((p) => ({ x0: p.x - 7, y0: p.y - 5, x1: p.x + 7, y1: p.y })),
    { x0: COOLER.x - 5, y0: COOLER.y - 5, x1: COOLER.x + 5, y1: COOLER.y },
  ];
  TABLES.forEach((t, k) => {
    if (t.row === 2 && (!o.row3 || (k === 4 && o.kids) || (k === 5 && o.stage))) return;
    out.push({ x0: t.x - TABLE_W / 2, y0: t.y - TABLE_D, x1: t.x + TABLE_W / 2, y1: t.y });
  });
  if (o.kids) out.push({ x0: 6, y0: 204, x1: 28, y1: 219 }, { x0: PIT.x - 11, y0: PIT.y - 12, x1: PIT.x + 11, y1: PIT.y });
  if (o.stage) out.push(STAGE);
  return out;
}

/** Ближний проход к точке (выше первого прохода — первый). */
export function aisleOf(p: Pt): number {
  if (p.y <= AISLES[0]) return AISLES[0];
  return AISLES.reduce((a, b) => (Math.abs(b - p.y) < Math.abs(a - p.y) ? b : a));
}

/**
 * Путь от точки до точки: до своего прохода прямо по вертикали, по проходу — к коридору, по коридору — к проходу
 * цели, по нему — к цели и прямо к ней. Повторяющиеся точки выкинуты.
 */
export function route(from: Pt, to: Pt): Pt[] {
  // Оба конца на одном коридоре (лифт, поднос, урна) — прямо по нему.
  if (Math.abs(from.x - to.x) < 0.5 && CORRIDORS.includes(from.x)) return [to];
  const a = aisleOf(from);
  const b = aisleOf(to);
  const pts: Pt[] = [{ x: from.x, y: a }];
  if (a === b) pts.push({ x: to.x, y: a });
  else {
    const via = CORRIDORS.reduce((p, q) => (Math.abs(q - from.x) + Math.abs(q - to.x) < Math.abs(p - from.x) + Math.abs(p - to.x) ? q : p));
    pts.push({ x: via, y: a }, { x: via, y: b }, { x: to.x, y: b });
  }
  pts.push(to);
  const out: Pt[] = [];
  let last = from;
  for (const p of pts) {
    if (Math.abs(p.x - last.x) + Math.abs(p.y - last.y) < 0.5) continue;
    out.push(p);
    last = p;
  }
  return out;
}
