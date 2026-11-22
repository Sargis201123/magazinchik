// Раскладка фудкорта (14.11): где что стоит на третьем этаже и как по нему ходят. Голые числа без Phaser — их
// читает и сцена (floors/thirdFloor.ts), и тест (tests/floor3-layout.test.ts): «люди не ходят сквозь мебель»
// проверяется на этих же числах, а не на глаз.
//
// Мир этажа — 168×290 точек (22.11: было 230) (floorView.ts W, H). Задняя стена своя, выше общей (58): окна на район до подоконника
// (40), под ними — обшивка. Вдоль стены — лифт слева и четыре места под точки еды; перед ними — очереди. Дальше —
// столовая (DINE): столы в два ряда по два (третий ряд - после ремонта). 22.11, автор: «сделать этажи красивее» - зал
// стал выше, и внизу под столовой своя полоса: слева детская зона, справа сцена (раньше они заменяли столы нижнего
// ряда и ютились у самого края); пока их нет - мозаика в полу и кадки. Ходят по проходам поперёк зала (AISLES) и
// двум коридорам вдоль (CORRIDORS): у лифта и посередине; к столу, к очереди и к урне - от ближнего прохода прямо
// вверх или вниз.
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
export const H = 290;
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
export const AISLES = [104, 152, 200, 246];
export const CORRIDORS = [LIFT_X, 84];

/**
 * Стойка с подносами — у левой стены, у лифта; урна для подносов — у правой: где стоят они и где встаёт тот, кто
 * берёт или сдаёт поднос. 14.11, ревью: урна стояла слева под подносами, и узкий коридор у лифта (слева подносы,
 * справа столы) был дорогой в обе стороны на всю высоту зала — к закрытию в нём выстраивался столбик из десятка
 * человек один поверх другого. Теперь приходят слева, а уходят через зал: сдали поднос справа — и по проходу у
 * стоек к лифту; в коридоре у лифта встречаются только на коротком куске у подносов.
 */
export const TRAYS: Pt = { x: 9, y: 86 };
export const TRAY_SPOT: Pt = { x: LIFT_X, y: 84 };
export const BINS: Pt = { x: 158, y: 131 };
/** Чуть выше середины между проходами — ближний проход верхний (у стоек), к лифту — без крюка вниз. */
export const BIN_SPOT: Pt = { x: 148, y: 126 };
/** Сколько мест в очереди к урне (дальше — встают на последнее). */
export const BIN_QUEUE = 9;
/**
 * Очередь к урне: первый — у урны, второй — над ним, дальше — влево вдоль края столов (ниже прохода, чтобы не
 * стоять на пути). Без неё все, кто уходил разом, вставали в одну точку один поверх другого (14.11, ревью).
 */
export function binSlot(k: number): Pt {
  const n = Math.max(0, Math.min(BIN_QUEUE - 1, k));
  if (n === 0) return BIN_SPOT;
  // Над столами ряд на высоте 112: ниже — угол стола, выше — проход.
  return { x: BIN_SPOT.x - 9 * (n - 1), y: 112 };
}

/** Стол на шестерых: середина, низ (y), ряд. Места — по три с каждой стороны. */
export interface Table {
  x: number;
  y: number;
  row: number;
}
export const TABLE_W = 50;
export const TABLE_D = 22;
export const SEAT_DX = [-16, 0, 16];
const ROWS = [138, 186, 234];
const COLS = [50, 118];
/** Ряды 0-1 - всегда; нижний (2) - после ремонта (22.11: детская зона и сцена его больше не занимают). */
export const TABLES: Table[] = ROWS.flatMap((y, row) => COLS.map((x) => ({ x, y, row })));
/** Есть ли стол сегодня: нижний ряд - только после ремонта. */
export const hasTable = (k: number, row3: boolean): boolean => TABLES[k].row < 2 || row3;
/** Столовая - пол под столами другой (шашечка или настил) в рамке; вниз - до последнего ряда, что есть. */
export function dine(row3: boolean): Box {
  return { x0: 22, y0: 109, x1: 146, y1: (row3 ? ROWS[2] : ROWS[1]) + 8 };
}

export interface Seat {
  table: number;
  /** Сидит за столом сзади (лицом к нам) или спереди (спиной). */
  back: boolean;
  x: number;
  /** Где сидит (середина человечка) и куда подходит, прежде чем сесть (ноги). */
  sitY: number;
  approach: Pt;
}

/** Все места за столом: по три сзади (лицом к нам) и спереди (спиной). 22.11: и у нижнего ряда - под ним теперь проход. */
export function seatsOf(k: number): Seat[] {
  const t = TABLES[k];
  const out: Seat[] = [];
  for (const dx of SEAT_DX) out.push({ table: k, back: true, x: t.x + dx, sitY: t.y - 23, approach: { x: t.x + dx, y: t.y - TABLE_D - 1 } });
  for (const dx of SEAT_DX) out.push({ table: k, back: false, x: t.x + dx, sitY: t.y - 9, approach: { x: t.x + dx, y: t.y + 2 } });
  return out;
}

/** Детская зона (внизу слева, под столовой): коврик, горка, сухой бассейн, лошадка; где играют дети. */
export const KIDS: Box = { x0: 6, y0: 252, x1: 80, y1: 286 };
export const SLIDE: Pt = { x: 18, y: 276 };
export const PIT: Pt = { x: 54, y: 277 };
export const HORSE: Pt = { x: 71, y: 270 };
/** Две «развилки» на коврике: от них — к горке (снизу), к бассейну и лошадке (сверху). */
export const KID_TOP: Pt = { x: 34, y: 260 };
export const KID_BOTTOM: Pt = { x: 34, y: 281 };
/** Горка: к лесенке (по низу коврика, перед горкой), наверх, съехать. */
export const SLIDE_PATH: Pt[] = [
  { x: 11, y: 280 },
  { x: 11, y: 264 },
  { x: 27, y: 278 },
];
/** Бассейн: край, откуда забираются, и где стоят в шариках. Лошадка: где сидит ребёнок. */
export const PIT_EDGE: Pt = { x: 50, y: 261 };
export const PIT_IN: Pt = { x: 54, y: 272 };
export const HORSE_SEAT: Pt = { x: 70, y: 271 };
/** К лошадке — по верху коврика, мимо бассейна. */
export const HORSE_WAY: Pt = { x: 70, y: 261 };
/** Где стоит мама или папа, присматривая за детьми: между ковриком и сценой. */
export const WATCH: Pt = { x: 86, y: 266 };
/** Сцена (внизу справа) и где стоит музыкант. */
export const STAGE: Box = { x0: 94, y0: 255, x1: 150, y1: 285 };
export const MUSICIAN: Pt = { x: 122, y: 273 };
/** Мозаика в полу посередине нижней полосы - пока там нет ни детской зоны, ни сцены. */
export const MOSAIC: Pt = { x: 84, y: 268 };

/** Растения у правой стены (под урной), кулер - у левой, под подносами; узкие кадки - у левой стены ниже кулера. */
export const PLANTS: Pt[] = [
  { x: 157, y: 180 },
  { x: 157, y: 228 },
];
export const COOLER: Pt = { x: 9, y: 132 };
export const SLIM: Pt[] = [
  { x: 8, y: 184 },
  { x: 8, y: 232 },
];
/** Кадки в нижних углах (справа - всегда, слева - пока нет детской зоны). */
export const CORNERS: Pt[] = [
  { x: 13, y: 287 },
  { x: 158, y: 287 },
];
/** Меловой штендер у выхода из лифта, между подносами и первой точкой. */
export const ABOARD: Pt = { x: 29, y: 94 };
/** Длинная кадка с кустами - на месте стола нижнего ряда до ремонта и на месте сцены, пока её нет. */
export const HEDGE_W = 44;

/** Что занимает пол (ноги людей сюда не заходят): прямоугольники по низу предметов. */
export function obstacles(o: { row3: boolean; kids: boolean; stage: boolean }): Box[] {
  const pot = (p: Pt, half: number, up: number): Box => ({ x0: p.x - half, y0: p.y - up, x1: p.x + half, y1: p.y });
  const out: Box[] = [
    // Стойки точек (кухня у стены и стойка с витриной).
    { x0: STALL_X[0] - 16, y0: WALL_BOTTOM, x1: STALL_X[3] + 16, y1: COUNTER_BOTTOM },
    { x0: TRAYS.x - 5, y0: TRAYS.y - 6, x1: TRAYS.x + 5, y1: TRAYS.y },
    { x0: BINS.x - 5, y0: BINS.y - 6, x1: BINS.x + 5, y1: BINS.y },
    ...PLANTS.map((p) => pot(p, 7, 5)),
    pot(COOLER, 5, 5),
    ...SLIM.map((p) => pot(p, 5, 4)),
    pot(CORNERS[1], 7, 5),
    pot(ABOARD, 4, 4),
  ];
  if (!o.kids) out.push(pot(CORNERS[0], 7, 5));
  TABLES.forEach((t, k) => {
    // До ремонта на месте нижнего ряда - длинные кадки (по ширине стола, ниже его края).
    if (!hasTable(k, o.row3)) out.push({ x0: t.x - HEDGE_W / 2, y0: t.y - 10, x1: t.x + HEDGE_W / 2, y1: t.y - 2 });
    else out.push({ x0: t.x - TABLE_W / 2, y0: t.y - TABLE_D, x1: t.x + TABLE_W / 2, y1: t.y });
  });
  if (o.kids) out.push({ x0: 6, y0: 262, x1: 28, y1: 277 }, { x0: PIT.x - 11, y0: PIT.y - 12, x1: PIT.x + 11, y1: PIT.y });
  // Сцена - или, пока её нет (а детская зона есть), длинная кадка на её месте.
  if (o.stage) out.push(STAGE);
  else if (o.kids) out.push({ x0: MUSICIAN.x - HEDGE_W / 2, y0: STAGE.y1 - 8, x1: MUSICIAN.x + HEDGE_W / 2, y1: STAGE.y1 });
  return out;
}

/** Ближний проход к точке (выше первого прохода — первый). */
export function aisleOf(p: Pt): number {
  if (p.y <= AISLES[0]) return AISLES[0];
  return AISLES.reduce((a, b) => (Math.abs(b - p.y) < Math.abs(a - p.y) ? b : a));
}

/** На сколько точек в сторону от середины прохода может идти человек (своя «полоса»): см. route. */
export const LANE = 3;

/**
 * Путь от точки до точки: до своего прохода прямо по вертикали, по проходу — к коридору, по коридору — к проходу
 * цели, по нему — к цели и прямо к ней. Повторяющиеся точки выкинуты.
 *
 * lane (14.11, ревью): у каждого своя полоса — смещение от середины проходов и коридоров (до ±LANE). Без неё все
 * шли ровно по одной линии и в коридоре у лифта сливались в «паровозик» один поверх другого (к закрытию — до
 * десятка в столбик). Концы пути (место, очередь, лифт) не смещаются; проходы шире полосы с запасом — тест
 * tests/floor3-layout.test.ts проверяет и крайние полосы.
 */
export function route(from: Pt, to: Pt, lane = 0): Pt[] {
  const d = Math.max(-LANE, Math.min(LANE, lane));
  // Коридор у лифта узкий (подносы и кулер слева, столы справа) — там полоса уже: от −0,5 до +1,5.
  const side = (x: number): number => x + (x === LIFT_X ? (d > 0 ? d / 2 : d / 6) : d);
  // Оба конца на одном коридоре (лифт, подносы) — по нему, своей полосой, у цели — шаг на середину.
  if (Math.abs(from.x - to.x) < 0.5 && CORRIDORS.includes(from.x)) return tidy(from, [{ x: side(to.x), y: to.y }, to]);
  const a = aisleOf(from) + d;
  const b = aisleOf(to) + d;
  const pts: Pt[] = [{ x: from.x, y: a }];
  if (a === b) pts.push({ x: to.x, y: a });
  else {
    const via = side(CORRIDORS.reduce((p, q) => (Math.abs(q - from.x) + Math.abs(q - to.x) < Math.abs(p - from.x) + Math.abs(p - to.x) ? q : p)));
    pts.push({ x: via, y: a }, { x: via, y: b }, { x: to.x, y: b });
  }
  pts.push(to);
  return tidy(from, pts);
}

/** Без повторяющихся точек (шаг меньше полточки — не шаг). */
function tidy(from: Pt, pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  let last = from;
  for (const p of pts) {
    if (Math.abs(p.x - last.x) + Math.abs(p.y - last.y) < 0.5) continue;
    out.push(p);
    last = p;
  }
  return out;
}
