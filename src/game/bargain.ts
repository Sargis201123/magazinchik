// Полка «Уценка» у входа — горка с ценниками «−50%» (модели побольше — gear 'bargain'): сюда уходит товар, который испортится этой ночью (и уже уценённый), —
// за полцены, под красной табличкой «АКЦИЯ». Покупатели по пути заглядывают и берут с неё сверх
// списка, так старое продаётся, а не выбрасывается, и на основных полках освобождается место.

import { PRODUCT_IDS, unitLife, type ProductId, type Stock, type StoreState, type Unit } from './economy';
import { bargainRows, fridgeLife } from './gear';
import { hasUpgrade } from './upgrades';

/** Мест в одном ряду горки; рядов — по модели полки (gear 'bargain': 2, 3, 4). */
export const BARGAIN_PER_ROW = 6;
/** Сколько штук помещается на полке уценки: 12, 18 или 24. */
export const bargainCapacity = (state: StoreState): number => BARGAIN_PER_ROW * bargainRows(state);
/** С такой вероятностью покупатель заглядывает на полку уценки, если на ней что-то есть. */
export const BARGAIN_CHANCE = 0.35;

export const hasBargain = (state: StoreState): boolean => hasUpgrade(state, 'bargain');

export const bargainCount = (state: StoreState): number => PRODUCT_IDS.reduce((sum, id) => sum + (state.bargain?.[id]?.length ?? 0), 0);

/** Штука просится на уценку: уже уценена или испортится этой ночью (брак, не разобранный игроком, — нет). */
const goesToBargain = (state: StoreState, id: ProductId, u: Unit): boolean => !u.pending && (Boolean(u.markdown) || u.age + 1 >= unitLife(id, u, fridgeLife(state)));

/**
 * Снести на полку уценки всё, что испортится ночью (с полок, потом со склада), пока есть место.
 * Штуки уцениваются (полцены). Возвращает новое состояние и сколько штук перенесли.
 */
export function fillBargain(state: StoreState): { state: StoreState; count: number } {
  if (!hasBargain(state)) return { state, count: 0 };
  let room = bargainCapacity(state) - bargainCount(state);
  if (room <= 0) return { state, count: 0 };
  const bargain: Stock = { ...(state.bargain ?? {}) };
  let count = 0;
  const take = (stock: Stock): Stock => {
    const next: Stock = { ...stock };
    for (const id of PRODUCT_IDS) {
      const units = stock[id];
      if (!units?.length || room <= 0) continue;
      const kept: Unit[] = [];
      for (const u of units) {
        if (room > 0 && goesToBargain(state, id, u)) {
          bargain[id] = [...(bargain[id] ?? []), { ...u, markdown: true }];
          room--;
          count++;
        } else kept.push(u);
      }
      next[id] = kept;
    }
    return next;
  };
  const shelves = state.shelves.map((s) => ({ ...s, items: take(s.items) }));
  const warehouse = take(state.warehouse);
  return count ? { state: { ...state, shelves, warehouse, bargain }, count } : { state, count: 0 };
}

/** Покупатель берёт с полки уценки одну штуку: самую старую из случайного товара. */
export function takeBargain(state: StoreState, random: () => number = Math.random): { state: StoreState; id: ProductId; unit: Unit } | null {
  const ids = PRODUCT_IDS.filter((id) => (state.bargain?.[id]?.length ?? 0) > 0);
  if (!ids.length) return null;
  const id = ids[Math.floor(random() * ids.length)];
  const [unit, ...rest] = state.bargain![id]!;
  return { state: { ...state, bargain: { ...state.bargain, [id]: rest } }, id, unit };
}
