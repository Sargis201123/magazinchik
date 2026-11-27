// Грузчик и ученик на складе: какую полку пополнить следующей, как быстро они ходят и сколько ходок со склада
// успевают за день. Сцена (scenes/staff.ts, scenes/apprentice.ts) и симулятор (simulate.ts) считают по одним правилам.
//
// 27.11, разбор «Универмага» (автор: «товар на полке очень быстро исчезает, персонала не хватает»): узкое место —
// перенос со склада на полки, а не склад. Ходка грузчика на «Универмаге» ~9,8 с, за день ~10 ходок по 12 штук,
// а ~470 гостей разбирают ~6 штук в секунду: к закрытию полки пусты на 90%, а на складе лежат ~70 штук. Теперь в
// большом магазине грузчик и ученик ходят быстрее — ×(1 + 0,25·уровень), как с 22.11 растёт их тележка (staffCarry):
// на «Универмаге» вдвое, ходка по большому залу — как в маленьком. Видно глазами, касаний не нужно.

import { canPlace, managerBoost, PRODUCT_IDS, shelfFree, workSpeed, type StaffMember, type StoreState } from './economy';
import { warehouseSpeed } from './gear';

/** На сколько быстрее ходят грузчик и ученик на складе с каждым помещением. */
export const STAFF_LEVEL_PACE = 0.25;
/** Скорость грузчика и ученика на складе от помещения: ×1 в ларьке, ×2 в «Универмаге», ×2,25 в гипермаркете. */
export const levelPace = (state: StoreState): number => 1 + STAFF_LEVEL_PACE * state.level;
/** Скорость грузчика сверх его навыка и менеджера: оборудование склада (gear.ts) и большой магазин. */
export const loaderSpeed = (state: StoreState): number => warehouseSpeed(state) * levelPace(state);
/** Во сколько раз быстрее обычного ходит этот грузчик: навык, менеджер на смене, склад и помещение. */
export const loaderPace = (state: StoreState, m: StaffMember): number => workSpeed(m) * managerBoost(state) * loaderSpeed(state);

/**
 * Ходка со склада к полке и обратно при скорости 1, секунды, по помещениям: путь по залу (scenes/layout.ts,
 * от прохода склада к месту у полки и назад, в среднем по полкам; 60 px/с) плюс взять и положить (0,9 с).
 */
export const TRIP_SECONDS = [5.6, 6.8, 7.7, 9.2, 9.8, 11.5];
export const tripSeconds = (state: StoreState): number => TRIP_SECONDS[Math.min(state.level, TRIP_SECONDS.length - 1)];

/** Грузчик идёт к полке, на которой свободно хотя бы столько мест (или там кончился товар, а на складе он есть). */
export const RESTOCK_MIN_FREE = 3;

/**
 * Полка, которую стоит пополнить: место есть, а на складе есть подходящий товар; -1 — нести нечего.
 * Сначала те, где товар кончился, потом самые пустые.
 */
export function shelfToFill(state: StoreState): number {
  let best = -1;
  let bestScore = 0;
  state.shelves.forEach((shelf, i) => {
    const free = shelfFree(shelf);
    const hasGoods = PRODUCT_IDS.some((id) => canPlace(id, shelf) && (state.warehouse[id] ?? []).some((u) => !u.pending));
    const runningOut = PRODUCT_IDS.some((id) => canPlace(id, shelf) && (shelf.items[id]?.length ?? 0) === 0 && (state.warehouse[id]?.length ?? 0) > 0);
    if (!hasGoods || !(free >= RESTOCK_MIN_FREE || (runningOut && free > 0))) return;
    const score = (runningOut ? 100 : 0) + free;
    if (score > bestScore) [best, bestScore] = [i, score];
  });
  return best;
}
