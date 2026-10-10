// Спрос дня на товар сверх сезона: погода, особый день, ценовая война, своя марка и запах свежего хлеба.

import type { ProductId, StoreState } from './economy';
import { weatherDemand, weatherFor } from './weather';
import { warDemand } from './war';
import { AROMA_DEMAND } from './bakery';
import { promoDemand } from './promo';
import { brandDemand, isOwnProduct } from './brand';
import { bigDayDemand } from './bigday';

export const dayDemand = (state: StoreState, id: ProductId, aroma = false): number =>
  weatherDemand(weatherFor(state.day), id) *
  bigDayDemand(state.day, id) *
  warDemand(state, id) *
  promoDemand(state, id) *
  brandDemand(state, id) *
  // Пока пахнет выпечкой — хлеб и своя выпечка идут охотнее.
  (aroma && (id === 'bread' || isOwnProduct(id)) ? AROMA_DEMAND : 1);
