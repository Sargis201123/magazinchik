// Воришка по повадкам (13.11, автор: «вор подсвечен красным — ловить скучно»). Вора больше не выдают ни красный
// контур, ни тёмная кофта: он одет как все. Выдаёт его поведение — оглядывается, подолгу стоит у самого дорогого,
// прячет товар в карман и идёт к выходу мимо кассы. Игрок нажимает на того, кого подозревает: вор — товар
// возвращается на полку и награда; честный покупатель — обида: уходит без покупки, рейтинг чуть ниже.
// Помогают Бобик (рычит на вора у входа) и камеры (берут вора в рамку). Здесь — правила без Phaser; в зале —
// scenes/thiefTells.ts, вор ходит в scenes/shoppers.ts (runThief).

import { shelfFor, sellableProducts, type DayStats, type ProductId, type StoreState } from './economy';
import { gearTier } from './gear';

/** Награда хозяину за вора, пойманного по повадкам (охранник ловит за зарплату, Бобик — за корм). */
export const OWNER_BOUNTY = 20;
/** Сколько мс вор стоит у самого дорогого товара: честный покупатель решает за полсекунды. */
export const LINGER_MS = 2400;
/** У остальных полок вор задерживается чуть дольше честного — тоже ждёт, пока никто не смотрит. */
export const PICK_MS = 700;
/** Сколько раз вор оглядывается у полки (влево-вправо — один раз). */
export const GLANCES = 2;
/**
 * Доля честных покупателей, которые разок оглянутся у полки: оглядываться — не преступление, улика —
 * всё вместе (дорогое, карман, мимо кассы). Иначе игрок ловил бы по одной примете и не смотрел на остальные.
 */
export const HONEST_GLANCE = 0.15;
/** Больше стольких вещей вор не уносит: одну дорогую и, бывает, ещё одну. */
export const MAX_PICKS = 2;
/** Сколько разных реплик у обиженного покупателя (thief.offended.N). */
export const OFFENDED_LINES = 4;

/**
 * Как часто игрок без охранника ловит вора — для симулятора. По повадкам замечают примерно каждого третьего, как
 * и раньше по красному контуру (тогда тоже ловили не всех); с камерами приметы виднее — чуть чаще.
 */
export const OWNER_CATCH = [0.3, 0.34, 0.38];
export const ownerCatch = (state: StoreState): number => OWNER_CATCH[gearTier(state, 'cameras')] ?? OWNER_CATCH[0];

/** Камеры в зале: 0 — нет; 1 — берут вора в рамку, когда он прячет товар; 2 — на каждой повадке. */
export const camTells = (state: StoreState): number => gearTier(state, 'cameras');

/**
 * Учебный воришка: пока игрок не поймал ни одного (ни за всё время, ни сегодня), вор подсвечен красным и над ним
 * стрелка — видно, как он себя ведёт. Дальше — только по повадкам. caughtToday — пойманные за этот день
 * (в lifetime они попадут ночью).
 */
export const trainingThief = (state: StoreState, caughtToday: number): boolean => (state.lifetime?.caught ?? 0) + caughtToday === 0;

/** Товар можно стащить: лежит на полке в зале. Ларь у кассы на виду — туда вор не идёт. */
function grabbable(state: StoreState, id: ProductId): boolean {
  const index = shelfFor(state, id);
  const shelf = index >= 0 ? state.shelves[index] : undefined;
  return Boolean(shelf && shelf.kind !== 'icebox' && (shelf.items[id]?.length ?? 0) > 0);
}

/**
 * Что возьмёт вор: первым — самое дорогое из того, что лежит на полках (у него он и стоит подолгу), дальше — что
 * хотел (wanted), без повторов и не больше MAX_PICKS. Пусто — красть нечего, вор просто уйдёт.
 */
export function thiefPicks(state: StoreState, wanted: ProductId[]): ProductId[] {
  const pool = sellableProducts(state).filter((id) => grabbable(state, id));
  if (!pool.length) return [];
  const top = pool.reduce((best, id) => (state.prices[id] > state.prices[best] ? id : best));
  const rest = [...new Set(wanted)].filter((id) => id !== top && grabbable(state, id));
  return [top, ...rest].slice(0, MAX_PICKS);
}

/**
 * Честного приняли за вора: он вернул товар на полку и ушёл без покупки — в рейтинг идёт как ушедший ни с чем
 * и ещё как жалоба (жалоба — «полпокупателя», economy.ts satisfaction). Немного: при 30 гостях — около 0,02★.
 */
export function offend(stats: DayStats): void {
  stats.lost++;
  stats.complaints++;
}

/**
 * Пойман по повадкам — награда в кассу, но только с поличным: carried — сколько товара было у вора при себе.
 * 13.11: у порога, пока ничего не взял, он просто уходит ни с чем — иначе выгодно тыкать в каждого входящего.
 */
export const catchBounty = (state: StoreState, carried: number): StoreState => (carried > 0 ? { ...state, money: state.money + OWNER_BOUNTY } : state);
