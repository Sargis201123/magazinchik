// Картинки «Бабушкиной фермы» (art/farm.py). В общий атлас мира они не кладутся: новые кадры меняли бы
// раскладку его листа, а игрокам «Магазинчика» они не нужны. Сцена фермы грузит их сама, когда её открыли
// (FarmScene.preload) — двадцать маленьких файлов, адреса с отпечатком (platform/assets.ts).

const CROPS = ['carrot', 'strawberry', 'pumpkin'];

export const FARM_TEXTURES: string[] = [
  'farm_bed',
  'farm_bed_wet',
  'farm_seed',
  ...CROPS.flatMap((c) => [1, 2, 3].map((stage) => `farm_${c}_${stage}`)),
  ...CROPS.map((c) => `farm_item_${c}`),
  'farm_stall',
  'farm_shelf',
  'farm_till',
  'farm_can',
  'farm_drop',
  'farm_fence',
  'farm_house',
];
