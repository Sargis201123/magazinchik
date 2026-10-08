// Спрос дня на товар сверх сезона: погода, ценовая война и запах свежего хлеба.

import type { ProductId, StoreState } from './economy';
import { weatherDemand, weatherFor } from './weather';
import { warDemand } from './war';
import { AROMA_DEMAND } from './bakery';
import { promoDemand } from './promo';

export const dayDemand = (state: StoreState, id: ProductId, aroma = false): number =>
  weatherDemand(weatherFor(state.day), id) * warDemand(state, id) * promoDemand(state, id) * (aroma && id === 'bread' ? AROMA_DEMAND : 1);
