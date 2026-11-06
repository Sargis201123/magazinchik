// Культуры «Бабушкиной фермы» (docs/FARM.md): морковь — быстро и дёшево, клубника — средне, тыква — долго,
// но дорого. Выгода в секунду у всех почти одна (≈0,4 монеты в секунду с грядки): морковь — больше касаний,
// тыква — «посадил утром и забыл», зато за неё платят сразу много. Секунды — игрового дня фермы, не настоящие:
// урожай растёт, только пока идёт день (решено автором).

export type CropId = 'carrot' | 'strawberry' | 'pumpkin';

export interface Crop {
  /** Сколько стоят семена на одну грядку. */
  seed: number;
  /** Сколько секунд дня растёт на политой грядке. */
  grow: number;
  /** Сколько штук снимаешь с грядки. */
  yield: number;
  /** Цена штуки в лавке. */
  price: number;
  /** Сколько штук влезает на полку лавки. */
  shelf: number;
  /** Как часто покупатель хочет именно её (доля среди всех). */
  demand: number;
  /** Сколько штук берёт покупатель: от и до. */
  take: [number, number];
}

export const CROPS: Record<CropId, Crop> = {
  carrot: { seed: 2, grow: 24, yield: 3, price: 4, shelf: 9, demand: 1, take: [1, 3] },
  strawberry: { seed: 6, grow: 45, yield: 4, price: 6, shelf: 8, demand: 0.9, take: [1, 3] },
  pumpkin: { seed: 12, grow: 90, yield: 1, price: 50, shelf: 3, demand: 0.35, take: [1, 1] },
};

export const CROP_IDS = Object.keys(CROPS) as CropId[];

/** Номер культуры для аналитики (farm_plant, farm_harvest: value). */
export const cropIndex = (id: CropId): number => CROP_IDS.indexOf(id);

/** Стадия на грядке: 0 — только посадили, 1 — росток, 2 — куст, 3 — созрело. */
export type Stage = 0 | 1 | 2 | 3;

export function stageOf(grow: number): Stage {
  if (grow >= 1) return 3;
  if (grow >= 0.5) return 2;
  if (grow >= 0.1) return 1;
  return 0;
}
