// Создано scripts/fx-bake.mjs из pixelfx a841596 (MIT, NOTICE.md) — не править руками: поменять эффект там и перезапечь.
// Кадры лежат в public/assets/fx_<эффект>_<номер>.png и попадают в лист атласа (семейство fx_ в textures.ts).

export interface FxSheet {
  key: string;
  source: string;
  frames: number;
  fps: number;
  loop: boolean;
  w: number;
  h: number;
  /** Точка эффекта в кадре (доли ширины и высоты) — origin спрайта. */
  ox: number;
  oy: number;
  /** Во сколько раз точка эффекта крупнее точки рисунка: спрайт рисуется в масштабе down / ART. */
  down: number;
  blend: 'normal' | 'add';
}

export const FX_SHEETS = {
  ripple: {"key":"ripple","source":"water/ripples","frames":30,"fps":15,"loop":true,"w":35,"h":11,"ox":0.4857,"oy":0.4545,"down":1,"blend":"normal"},
  firefly: {"key":"firefly","source":"custom:firefly","frames":30,"fps":15,"loop":true,"w":12,"h":10,"ox":0.5,"oy":0.5,"down":1,"blend":"add"},
  coin: {"key":"coin","source":"pickups/coin-spin","frames":24,"fps":15,"loop":true,"w":28,"h":20,"ox":0.4643,"oy":1.35,"down":1,"blend":"normal"},
  coinpop: {"key":"coinpop","source":"pickups/collect-burst","frames":21,"fps":15,"loop":false,"w":35,"h":39,"ox":0.4571,"oy":0.9744,"down":2,"blend":"normal"},
  confetti: {"key":"confetti","source":"ui/confetti","frames":29,"fps":12,"loop":false,"w":148,"h":82,"ox":0.5,"oy":0.9878,"down":1,"blend":"normal"},
  firework: {"key":"firework","source":"explosions/firework-burst","frames":40,"fps":12,"loop":false,"w":91,"h":96,"ox":0.5165,"oy":0.3021,"down":2,"blend":"add"},
  levelup: {"key":"levelup","source":"ui/level-up","frames":13,"fps":10,"loop":false,"w":154,"h":114,"ox":0.5,"oy":0.8596,"down":1,"blend":"normal"},
  chest: {"key":"chest","source":"pickups/chest-open","frames":24,"fps":8,"loop":false,"w":153,"h":55,"ox":0.5163,"oy":0.9636,"down":1,"blend":"normal"},
  star: {"key":"star","source":"pickups/power-star","frames":10,"fps":10,"loop":false,"w":63,"h":63,"ox":0.5079,"oy":0.8889,"down":1,"blend":"normal"},
  sunburst: {"key":"sunburst","source":"holy/sunburst","frames":10,"fps":10,"loop":false,"w":44,"h":45,"ox":0.5455,"oy":0.4889,"down":2,"blend":"normal"},
  beam: {"key":"beam","source":"pickups/loot-beam","frames":10,"fps":8,"loop":false,"w":54,"h":154,"ox":0.5,"oy":0.961,"down":1,"blend":"add"},
  hearts: {"key":"hearts","source":"status/charmed","frames":16,"fps":10,"loop":false,"w":40,"h":51,"ox":0.5,"oy":1.1765,"down":1,"blend":"normal"},
  starfall: {"key":"starfall","source":"arcane/star-fall","frames":26,"fps":10,"loop":false,"w":152,"h":136,"ox":0.5592,"oy":0.9412,"down":1,"blend":"add"},
  coindrop: {"key":"coindrop","source":"spawn/coin-drop","frames":31,"fps":10,"loop":false,"w":104,"h":61,"ox":0.5962,"oy":0.9016,"down":1,"blend":"normal"},
} as const satisfies Record<string, FxSheet>;

export type FxKey = keyof typeof FX_SHEETS;

/** Имена кадров эффекта в атласе. */
export const fxFrames = (key: FxKey): string[] => Array.from({ length: FX_SHEETS[key].frames }, (_, i) => `fx_${key}_${i}`);

/** Все кадры всех эффектов — для списка картинок мира (worldTextures.ts). */
export const FX_TEXTURES: string[] = (Object.keys(FX_SHEETS) as FxKey[]).flatMap(fxFrames);
