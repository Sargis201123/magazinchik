// Полный список картинок мира для игры: спрайты из textures.ts плюс семейства, чьи имена складывает
// код, — товары и гардероб. Сборка этот модуль не читает (он тянет экономику) и находит те же
// семейства по именам файлов (textures.ts, FAMILIES; совпадение проверяет tests/textures.test.ts).

import { PRODUCT_IDS } from '../game/economy';
import { SPRITES } from './textures';
import { WARDROBE_TEXTURES } from './wardrobe';
import { FX_TEXTURES } from './fxSheets';
import { OUTFIT_TEXTURES } from './petOutfits';

/** Картинки товаров: на полке (item_<товар>), три вида россыпи (_0…_2) и ящик в подсобке (crate_<товар>). */
const ITEMS = PRODUCT_IDS.flatMap((id) => [`crate_${id}`, `item_${id}`, ...[0, 1, 2].map((v) => `item_${id}_${v}`)]);

/** Все картинки мира по именам (без повторов): спрайты, товары, гардероб человечков и кадры пиксельных эффектов. */
export const TEXTURES: string[] = [...new Set([...SPRITES, ...ITEMS, ...WARDROBE_TEXTURES, ...FX_TEXTURES, ...OUTFIT_TEXTURES])];
