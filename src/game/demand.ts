// Спрос дня на товар сверх сезона: погода, особый день, ценовая война, своя марка, здания района
// и запах свежего хлеба.

import type { ProductId, StoreState } from './economy';
import { weatherDemand, weatherFor } from './weather';
import { warDemand } from './war';
import { AROMA_DEMAND } from './bakery';
import { promoDemand } from './promo';
import { brandDemand, isOwnProduct } from './brand';
import { bigDayDemand } from './bigday';
import { districtDemand } from './district';
import { inZar, zarDemand } from './zarechye';

export const dayDemand = (state: StoreState, id: ProductId, aroma = false): number =>
  weatherDemand(weatherFor(state.day), id) *
  bigDayDemand(state.day, id) *
  warDemand(state, id) *
  promoDemand(state, id) *
  brandDemand(state, id) *
  // Здания района — в Центре; в Заречье свой спрос: рыба у реки, студенты, туристы (zarechye.ts).
  (inZar(state) ? zarDemand(state, id) : districtDemand(state, id)) *
  // Пока пахнет выпечкой — хлеб и своя выпечка идут охотнее.
  (aroma && (id === 'bread' || isOwnProduct(id)) ? AROMA_DEMAND : 1);
