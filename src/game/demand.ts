// Спрос дня на товар сверх сезона: погода, особый день, ценовая война, своя марка, здания района,
// беда района (воду и хлеб разбирают) и запах свежего хлеба.

import { restricted, type ProductId, type StoreState } from './economy';
import { LICENSE_DEMAND } from './license';
import { weatherDemand } from './weather';
import { warDemand } from './war';
import { AROMA_DEMAND } from './bakery';
import { brandDemand, isOwnProduct } from './brand';
import { bigDayDemand } from './bigday';
import { districtDemand } from './district';
import { inZar, zarDemand } from './zarechye';
import { crisisDemand, weatherToday } from './crisis';

export const dayDemand = (state: StoreState, id: ProductId, aroma = false): number =>
  // Погода — та, что видна на улице: в беду поверх прогноза жара, буран или ливень (crisis.ts).
  weatherDemand(weatherToday(state), id) *
  crisisDemand(state, id) *
  bigDayDemand(state.day, id) *
  warDemand(state, id) *
  brandDemand(state, id) *
  // Здания района — в Центре; в Заречье свой спрос: рыба у реки, студенты, туристы (zarechye.ts).
  (inZar(state) ? zarDemand(state, id) : districtDemand(state, id)) *
  // Пока пахнет выпечкой — хлеб и своя выпечка идут охотнее.
  (aroma && (id === 'bread' || isOwnProduct(id)) ? AROMA_DEMAND : 1) *
  // Пиво и сигареты берут не все (license.ts): их доля в корзинах меньше, чем у хлеба и молока.
  (restricted(id) ? LICENSE_DEMAND : 1);
