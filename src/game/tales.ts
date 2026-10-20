// Истории постоянных покупателей: сюжет на несколько дней с выбором. Утром приходит знакомый
// гость — студентка Аня, жених Миша, музыкант Гоша — и рассказывает, что у него нового;
// игрок выбирает, как поступить. От выбора зависит, что будет дальше: вернут ли долг, приведут
// ли друзей, закажут ли банкет. Одна история за раз, между историями — передышка.

import { onShelves, PRODUCTS, warehouseOf, type ProductId, type StoreState } from './economy';

export type TaleId = 'anya' | 'wedding' | 'busker';

export interface TaleEffect {
  money?: number;
  rating?: number;
  /** Больше гостей: на сколько и сколько дней. */
  boost?: [number, number];
  /** Отдать товар (берётся с полок и со склада). */
  take?: [ProductId, number];
  /** Получить деньги за товар: цена × множитель за штуку. */
  sell?: [ProductId, number, number];
}

export interface TaleChoice {
  effect: TaleEffect;
  /** Что нужно, чтобы выбрать: товар в наличии или деньги. */
  require?: { product?: [ProductId, number]; money?: number };
  /** Следующий эпизод и через сколько дней; нет — история кончилась. */
  next?: [number, number];
}

export interface Tale {
  icon: string;
  /** С какого дня история может начаться. */
  from: number;
  episodes: TaleChoice[][];
}

export const TALES: Record<TaleId, Tale> = {
  anya: {
    icon: '🎓',
    from: 8,
    episodes: [
      [{ effect: { take: ['bread', 1], rating: 0.03 }, next: [1, 3] }, { effect: {} }],
      [{ effect: { money: -300 }, next: [2, 6] }, { effect: {}, next: [3, 6] }],
      [{ effect: { money: 600, boost: [0.15, 4] }, next: [4, 10] }],
      [{ effect: { boost: [0.08, 3] }, next: [4, 10] }],
      [{ effect: { boost: [0.1, 10], rating: 0.05 } }],
    ],
  },
  wedding: {
    icon: '💍',
    from: 15,
    episodes: [
      [{ effect: { money: -200, rating: 0.05 }, next: [1, 2] }, { effect: { rating: -0.02 } }],
      [{ effect: {}, next: [2, 5] }, { effect: {} }],
      [{ effect: { sell: ['bread', 30, 2], rating: 0.1 }, require: { product: ['bread', 30] }, next: [3, 14] }, { effect: { rating: -0.15 } }],
      [{ effect: { boost: [0.1, 7] } }],
    ],
  },
  busker: {
    icon: '🎸',
    from: 12,
    episodes: [
      [{ effect: { boost: [0.1, 4] }, next: [1, 5] }, { effect: {} }],
      [{ effect: { boost: [0.25, 2], rating: 0.05 }, next: [2, 6] }, { effect: {}, next: [2, 6] }],
      [{ effect: { money: -1000, boost: [0.12, 14] }, require: { money: 1000 } }, { effect: { rating: 0.02 } }],
    ],
  },
};
export const TALE_IDS = Object.keys(TALES) as TaleId[];

/** Шанс, что утром начнётся новая история, и передышка между историями. */
export const TALE_CHANCE = 0.35;
export const TALE_GAP = 3;

export interface TalesState {
  /** Идущая история: какой эпизод и с какого дня он ждёт игрока. */
  current?: { id: TaleId; ep: number; due: number };
  done: TaleId[];
  /** Прибавка гостей от историй. */
  boost?: { pct: number; until: number };
  /** Раньше этого дня новая история не начнётся. */
  nextAt?: number;
}

export const talesOf = (state: StoreState): TalesState => state.tales ?? { done: [] };

/** Эпизод, который ждёт ответа сегодня (или null). */
export function taleToday(state: StoreState): { id: TaleId; ep: number } | null {
  const cur = talesOf(state).current;
  return cur && state.day >= cur.due ? { id: cur.id, ep: cur.ep } : null;
}

/** Утро: если истории нет — может начаться новая. */
export function talesMorning(state: StoreState, random: () => number): StoreState {
  const tales = talesOf(state);
  if (tales.current || state.day < (tales.nextAt ?? 0)) return state;
  const options = TALE_IDS.filter((id) => !tales.done.includes(id) && state.day >= TALES[id].from);
  if (!options.length || random() >= TALE_CHANCE) return state;
  const id = options[Math.floor(random() * options.length)];
  return { ...state, tales: { ...tales, current: { id, ep: 0, due: state.day } } };
}

const stockOf = (state: StoreState, id: ProductId): number => warehouseOf(state, id) + onShelves(state, id);

/** Можно ли сейчас выбрать этот вариант. */
export function canChoose(state: StoreState, choice: TaleChoice): boolean {
  const need = choice.require;
  if (!need) return true;
  if (need.money !== undefined && state.money < need.money) return false;
  if (need.product && stockOf(state, need.product[0]) < need.product[1]) return false;
  return true;
}

/** Забрать штуки: сначала с полок, потом со склада. */
function take(state: StoreState, id: ProductId, n: number): StoreState {
  let left = n;
  const shelves = state.shelves.map((s) => {
    const units = s.items[id] ?? [];
    const k = Math.min(left, units.length);
    left -= k;
    return k ? { ...s, items: { ...s.items, [id]: units.slice(k) } } : s;
  });
  const fromWarehouse = Math.min(left, warehouseOf(state, id));
  return { ...state, shelves, warehouse: { ...state.warehouse, [id]: (state.warehouse[id] ?? []).slice(fromWarehouse) } };
}

/** Ответ игрока на эпизод: последствия и следующий эпизод (или конец истории). */
export function answerTale(state: StoreState, index: number): StoreState | null {
  const today = taleToday(state);
  if (!today) return null;
  const choice = TALES[today.id].episodes[today.ep][index];
  if (!choice || !canChoose(state, choice)) return null;
  const e = choice.effect;
  let s = state;
  if (e.take) s = take(s, e.take[0], Math.min(e.take[1], stockOf(s, e.take[0])));
  if (e.sell) {
    s = take(s, e.sell[0], e.sell[1]);
    s = { ...s, money: s.money + Math.round(PRODUCTS[e.sell[0]].basePrice * e.sell[1] * e.sell[2]) };
  }
  if (e.money) s = { ...s, money: s.money + e.money };
  if (e.rating) s = { ...s, rating: Math.round(Math.min(5, Math.max(0, s.rating + e.rating)) * 100) / 100 };
  const tales = talesOf(s);
  let boost = tales.boost;
  if (e.boost) {
    const [pct, days] = e.boost;
    const still = boost && boost.until >= s.day ? boost : undefined;
    boost = still && still.pct > pct ? still : { pct, until: s.day + days - 1 };
  }
  const next = choice.next;
  const current = next ? { id: today.id, ep: next[0], due: s.day + next[1] } : undefined;
  const done = next ? tales.done : [...tales.done, today.id];
  return { ...s, tales: { ...tales, current, done, boost, nextAt: next ? tales.nextAt : s.day + TALE_GAP } };
}

/** Множитель гостей от историй (друзья Ани, музыкант у входа, гости свадьбы). */
export const taleGuests = (state: StoreState): number => {
  const boost = talesOf(state).boost;
  return boost && state.day <= boost.until ? 1 + boost.pct : 1;
};
