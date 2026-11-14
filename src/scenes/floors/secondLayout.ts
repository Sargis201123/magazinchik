// Раскладка второго этажа — бутика одежды (14.11): где что стоит и где ходят люди. Голые данные и маршрут без
// Phaser — их проверяет тест (tests/floor2-layout.test.ts: «люди не ходят сквозь мебель»), а рисует и водит людей
// scenes/floors/secondFloor.ts. Всё в точках мира этажа (зал 168×230, задняя стена 44 — scenes/floorView.ts).
//
// Координата человека здесь — где у него ноги (на полу), а не середина картинки: так глубина считается по ногам,
// как у мебели по низу, — кто ниже на экране, тот ближе (человек у стойки стоит перед ней, а не «в ней»).
//
// План зала:
//   задняя стена: окно · стеллаж · окно · [фикус или третья примерочная] · примерочная · примерочная;
//   у окон — манекены (с «Витринами» — на подиумах), у левой стены — обувь;
//   посередине — два ряда стоек по 2–3 (третий столбец — после ремонта), справа — зеркало с пуфом и (с «Брендами»)
//   витрина с сумками;
//   внизу: лестница слева, ковёр со столом аксессуаров, стол уценки, касса справа, растения по углам.
// Ходят по проходам (поперёк) и коридорам (вдоль) — как в зале, по сетке между мебелью.

export type Point = { x: number; y: number };
/** Прямоугольник на полу, который мебель занимает (ноги туда не ступают): x, y — левый верхний угол. */
export type Rect = { x: number; y: number; w: number; h: number; name: string };

/** Ноги человечка — на столько ниже середины его картинки (persons.makePerson: тень на +8.5). */
export const FOOT = 8.5;

/** Проходы (по высоте) и коридоры (по ширине) — по ним люди переходят с места на место. */
export const AISLES = [76, 112, 154, 196];
export const CORRIDORS = [52, 84, 118];

/** Задняя стена: окна (низ — на полу у стены), стеллаж, место у стены, примерочные. */
export const WINDOWS = [21, 81];
export const SHELF = { x: 51, y: 50 };
/** Примерочные: первая — только с улучшением «Ещё примерочная» (до него на её месте фикус). */
export const BOOTHS = [108, 130, 152];
export const BOOTH_Y = 68;
/** Манекены у окон: где ноги. */
export const MANNEQUINS: Point[] = [
  { x: 21, y: 59 },
  { x: 81, y: 59 },
];

/** Стойки: низ. Голый этаж — четыре (первые два столбца), после ремонта — шесть. */
export const RACKS: Point[] = [
  { x: 36, y: 104 },
  { x: 68, y: 104 },
  { x: 36, y: 146 },
  { x: 68, y: 146 },
  { x: 100, y: 104 },
  { x: 100, y: 146 },
];
export const RACK_W = 24;

// 14.11, ревью: при x 13 левый край стойки с обувью заезжал на тёмную боковую стену (боковина 0–5) — сдвинули.
export const SHOES = { x: 16, y: 104 };
export const MIRROR = { x: 150, y: 110 };
export const POUF = { x: 132, y: 110 };
export const BRAND = { x: 150, y: 148 };
export const TABLE = { x: 68, y: 182 };
export const BIN = { x: 101, y: 184 };
export const TILL = { x: 142, y: 190 };
export const CASHIER = { x: 142, y: 177 };
export const STAIRS = { x: 22, y: 200 };
export const PLANTS: Point[] = [
  { x: 157, y: 228 },
  { x: 47, y: 228 },
];

/** Где покупатель стоит, глядя на вещь (лицом вверх, к предмету). */
export const SPOTS = {
  /** Сверху лестницы: уже на полу этажа — и снизу, в проёме, где он появляется и тает. */
  stairsTop: { x: 22, y: 196 },
  stairsBottom: { x: 22, y: 230 },
  shelf: { x: 51, y: 76 },
  window: WINDOWS.map((x) => ({ x: x + 9, y: 76 })),
  shoes: { x: 16, y: 112 },
  mirror: { x: MIRROR.x, y: 112 },
  table: { x: TABLE.x, y: 196 },
  bin: { x: BIN.x, y: 196 },
  till: { x: 134, y: 196 },
  /** Перед шторой примерочной: шагнул отсюда — и скрылся внутри. */
  booth: (x: number): Point => ({ x, y: 76 }),
  /** У стойки: ряд стоек выходит на проход под ними. */
  rack: (r: Point, dx = 0): Point => ({ x: r.x + dx, y: r.y + 8 }),
};

/**
 * Что занимает пол (ноги туда не ступают): по низу предмета и на глубину, которую он стоит на полу. Тест водит
 * людей между всеми точками и проверяет, что ни одна нога не попала внутрь.
 */
export function blocks(racks: number): Rect[] {
  const box = (name: string, cx: number, bottom: number, w: number, depth: number): Rect => ({ name, x: cx - w / 2, y: bottom - depth, w, h: depth });
  return [
    box('shelf', SHELF.x, SHELF.y, 30, 6),
    ...BOOTHS.map((x, i) => box(`booth${i}`, x, BOOTH_Y, 22, 24)),
    ...MANNEQUINS.map((m, i) => box(`mannequin${i}`, m.x, m.y + 3, 14, 8)),
    ...RACKS.slice(0, racks).map((r, i) => box(`rack${i}`, r.x, r.y, RACK_W, 6)),
    box('shoes', SHOES.x, SHOES.y, 18, 8),
    box('mirror', MIRROR.x, MIRROR.y, 16, 5),
    box('pouf', POUF.x, POUF.y, 12, 6),
    box('brand', BRAND.x, BRAND.y, 24, 8),
    box('table', TABLE.x, TABLE.y, 22, 8),
    box('bin', BIN.x, BIN.y, 24, 8),
    box('till', TILL.x, TILL.y, 38, 12),
    ...PLANTS.map((p, i) => box(`plant${i}`, p.x, p.y, 12, 6)),
  ];
}

/**
 * Путь по сетке: от точки — к ближайшему проходу, по нему — к коридору, вдоль коридора — на проход цели, по нему —
 * к цели. Коридор берём тот, что короче. Те же правила, что у общей ходьбы этажей (floors/kit.ts walker), только
 * координаты — ног.
 */
export function route(from: Point, to: Point): Point[] {
  const aisle = (p: Point) => AISLES.reduce((a, b) => (Math.abs(b - p.y) < Math.abs(a - p.y) ? b : a));
  const a = aisle(from);
  const b = aisle(to);
  if (a === b) return [{ x: from.x, y: a }, { x: to.x, y: a }, to];
  const via = CORRIDORS.reduce((p, q) => (Math.abs(q - from.x) + Math.abs(q - to.x) < Math.abs(p - from.x) + Math.abs(p - to.x) ? q : p));
  return [{ x: from.x, y: a }, { x: via, y: a }, { x: via, y: b }, { x: to.x, y: b }, to];
}
