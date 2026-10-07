// Симулятор экономики: «разумный игрок» играет много дней по тем же правилам, что и игра.
// Нужен для баланса: на какой день игрок расширяет магазин, сколько зарабатывает, где застревает.
// Запуск: npm run sim

import {
  buyChance,
  buyShelf,
  buyStock,
  CARRY,
  type Category,
  checkout,
  type DayStats,
  emptyDayStats,
  endDay,
  expandStore,
  billTotal,
  daysUntilBill,
  MONTH_DAYS,
  monthlyBill,
  expectedGuests,
  moveToShelf,
  newGame,
  nextStoreLevel,
  onShelves,
  payDebt,
  PRODUCT_IDS,
  PRODUCTS,
  type ProductId,
  resolveBadBatch,
  returnToShelf,
  setPrice,
  sellableProducts,
  SHELF_KINDS,
  SHELF_LEVELS,
  shelfCapacity,
  shelfFor,
  STORE_LEVELS,
  takeFromShelf,
  unitSalePrice,
  upgradeCost,
  upgradeShelf,
  warehouseCapacity,
  warehouseCount,
  warehouseOf,
  type CartItem,
  BAD_COMPLAINT_CHANCE,
  hasUnmarkedBad,
  freeSlots,
  answerRaise,
  guardCatchChance,
  hire,
  staffLimit,
  staffOf,
  thiefChance,
  type StaffRole,
  type StoreState,
} from './economy';
import { candidatesFor } from './staff';
import { rng } from './random';
import { haggle, newDeal, SUPPLIER_IDS, SUPPLIERS, unitPrice } from './suppliers';

export { rng };

export interface SimDay {
  day: number;
  level: number;
  money: number;
  debt: number;
  rating: number;
  guests: number;
  served: number;
  lost: number;
  revenue: number;
  purchases: number;
  investments: number;
  spoiled: number;
  expenses: number;
  /** Выручка − закупка − расходы (без вложений в полки и расширение). */
  profit: number;
}

export interface SimResult {
  days: SimDay[];
  /** На какой день достигнут каждый уровень магазина (индекс = уровень). */
  levelDay: (number | null)[];
}

export interface SimOptions {
  days: number;
  seed?: number;
  /** Доля обслуженных, которые всё равно уходят из очереди (игрок не успел к кассе). */
  queueLoss?: number;
  /** Сколько походов на склад за день успевает игрок. */
  tripsPerDay?: (level: number) => number;
  /** Во сколько раз игрок ставит цены относительно базовых. */
  priceMult?: number;
  /** Нанимает ли игрок персонал. */
  hireStaff?: boolean;
}

/** В каком порядке разумный игрок докупает полки. */
const SHELF_PRIORITY: Category[] = ['dairy', 'meat', 'produce', 'bakery', 'dairy', 'produce', 'meat', 'bakery', 'produce', 'dairy'];

const AVG_WANTS = 1.5;

/** Когда разумный игрок нанимает людей: по мере того, как один не справляется. */
const HIRE_WHEN: [StaffRole, (state: StoreState) => boolean][] = [
  ['cashier', (s) => expectedGuests(s.rating, s.level) > SOLO_SERVE_CAP * 1.2],
  ['loader', (s) => s.level >= 2],
  ['guard', (s) => s.level >= 2],
  ['cleaner', (s) => s.level >= 3],
];

/** Сколько покупателей за 90 секунд успевает пробить один человек, если ещё и бегает по делам. */
const SOLO_SERVE_CAP = 30;
/** Сколько успевает кассир (хозяин помогает). */
const CASHIER_SERVE_CAP = 100;

export function simulate({
  days,
  seed = 1,
  queueLoss,
  tripsPerDay,
  priceMult = 1,
  hireStaff = true,
}: SimOptions): SimResult {
  const random = rng(seed);
  let state = newGame();
  for (const id of PRODUCT_IDS) state = setPrice(state, id, Math.round((PRODUCTS[id].basePrice * priceMult) / 5) * 5);
  const out: SimDay[] = [];
  const levelDay: (number | null)[] = STORE_LEVELS.map((_, i) => (i === 0 ? 1 : null));

  for (let d = 0; d < days; d++) {
    const moneyStart = state.money;
    let investments = 0;
    // Запас на закупку плюс копилка на счета в конце месяца.
    const bill = billTotal(monthlyBill(state));
    const reserve = 150 + 100 * state.level + Math.round(bill * (1 - daysUntilBill(state.day) / MONTH_DAYS));

    // ---------- Утро: долг, расширение, полки ----------
    if (state.debt > 0 && state.money - state.debt >= reserve) state = payDebt(state, state.debt) ?? state;

    const next = nextStoreLevel(state);
    if (next && state.money >= next.cost + reserve) {
      const expanded = expandStore(state);
      if (expanded) {
        investments += next.cost;
        state = expanded;
        levelDay[state.level] = state.day;
      }
    }

    while (freeSlots(state) > 0) {
      const kind = SHELF_PRIORITY.find(
        (k, i) => SHELF_PRIORITY.slice(0, i + 1).filter((x) => x === k).length > state.shelves.filter((s) => s.kind === k).length,
      );
      if (!kind || state.money < SHELF_KINDS[kind].price + reserve) break;
      investments += SHELF_KINDS[kind].price;
      state = buyShelf(state, kind)!;
    }

    for (let i = 0; i < state.shelves.length; i++) {
      const cost = upgradeCost(state.shelves[i]);
      if (cost !== null && state.money >= cost + reserve * 3) {
        investments += cost;
        state = upgradeShelf(state, i)!;
      }
    }

    // ---------- Утро: персонал ----------
    // Разумный игрок соглашается на прибавки: обиженный сотрудник работает хуже.
    for (const m of state.staff) if (m.raiseAsk) state = answerRaise(state, m.role, true);
    if (hireStaff) {
      const role = HIRE_WHEN.find(([r, need]) => !staffOf(state, r) && need(state))?.[0];
      const candidate = role && candidatesFor(state.day, 0, role).find((c) => c.trait !== 'sticky');
      if (candidate && state.staff.length < staffLimit(state) && state.money >= reserve + candidate.wage) {
        state = hire(state, candidate) ?? state;
      }
    }

    // ---------- Утро: закупка ----------
    const sellable = sellableProducts(state);
    const guests = expectedGuests(state.rating, state.level);
    let purchases = 0;
    const deals = Object.fromEntries(
      SUPPLIER_IDS.map((sid) => {
        const s = SUPPLIERS[sid];
        return [sid, haggle(s, newDeal(s), 0.05, state.rating, random()).deal];
      }),
    );
    for (const id of sellable) {
      const demand = (guests * AVG_WANTS * buyChance(state.prices[id], PRODUCTS[id].basePrice)) / sellable.length;
      const shelfRoom = state.shelves
        .filter((s) => s.kind === PRODUCTS[id].category)
        .reduce((sum, s) => sum + shelfCapacity(s), 0);
      const shareOfShelf = shelfRoom / sellable.filter((p) => PRODUCTS[p].category === PRODUCTS[id].category).length;
      const target = Math.ceil(Math.min(demand * 1.1, shareOfShelf + CARRY * 2));
      const have = onShelves(state, id) + warehouseOf(state, id);
      let qty = Math.max(0, target - have);
      // Самый дешёвый поставщик этого товара.
      const offers = SUPPLIER_IDS.map((sid) => ({ sid, price: unitPrice(SUPPLIERS[sid], deals[sid], id) })).filter(
        (o): o is { sid: (typeof SUPPLIER_IDS)[number]; price: number } => o.price !== null,
      );
      const best = offers.sort((a, b) => a.price - b.price)[0];
      if (!best) continue;
      qty = Math.min(qty, Math.floor(state.money / best.price), warehouseCapacity(state) - warehouseCount(state));
      if (qty <= 0) continue;
      const bad = random() < SUPPLIERS[best.sid].badChance;
      state = buyStock(state, id, qty, best.price, bad) ?? state;
      if (bad) state = resolveBadBatch(state, id, 'markdown', best.price);
      purchases += qty * best.price;
    }
    state.shelves.forEach((_, i) => (state = moveToShelf(state, i).state));

    // ---------- День ----------
    const stats: DayStats = emptyDayStats();
    const dayGuests = Math.max(0, Math.round(guests * (0.85 + random() * 0.3)));
    // Один игрок не успевает всё: чем больше магазин, тем больше теряется без персонала.
    const has = (r: StaffRole) => Boolean(staffOf(state, r));
    let trips = tripsPerDay ? tripsPerDay(state.level) : has('loader') ? 60 : 3 + state.level;
    const lossInQueue = queueLoss ?? (has('cashier') ? 0.02 : 0.05 + 0.05 * state.level);
    const serveCap = has('cashier') ? CASHIER_SERVE_CAP : SOLO_SERVE_CAP;
    const dirtComplaint = has('cleaner') ? 0.01 : 0.02 + 0.02 * state.level;
    const guard = staffOf(state, 'guard');
    for (let g = 0; g < dayGuests; g++) {
      if (random() < thiefChance(state.level)) {
        // Вор берёт товар; его ловит охранник или, реже, сам игрок.
        const id = sellable[Math.floor(random() * sellable.length)];
        const index = shelfFor(state, id);
        const taken = index >= 0 ? takeFromShelf(state, index, id) : null;
        if (!taken) continue;
        const caught = random() < (guard ? guardCatchChance(guard) : 0.3);
        state = caught ? returnToShelf(taken.state, [{ id, unit: taken.unit }]) : taken.state;
        if (caught) stats.caught++;
        else stats.stolen += unitSalePrice(state, id, taken.unit);
        continue;
      }
      // Игрок замечает пустую полку и несёт товар со склада.
      for (const id of sellable) {
        if (trips > 0 && onShelves(state, id) === 0 && warehouseOf(state, id) > 0) {
          const index = shelfFor(state, id);
          state = moveToShelf(state, index, undefined, CARRY).state;
          trips--;
        }
      }
      const wants = Math.floor(random() * sellable.length);
      const wanted = [sellable[wants], ...(random() < AVG_WANTS - 1 ? [sellable[(wants + 1) % sellable.length]] : [])];
      const cart: CartItem[] = [];
      let sawEmpty = false;
      let tooExpensive = false;
      for (const id of new Set(wanted)) {
        const index = shelfFor(state, id);
        const oldest = state.shelves[index]?.items[id]?.[0];
        if (!oldest) {
          sawEmpty = true;
          continue;
        }
        if (random() < buyChance(unitSalePrice(state, id, oldest), PRODUCTS[id].basePrice)) {
          const taken = takeFromShelf(state, index, id)!;
          state = taken.state;
          cart.push({ id, unit: taken.unit });
        } else if (unitSalePrice(state, id, oldest) > PRODUCTS[id].basePrice) {
          tooExpensive = true;
        }
      }
      if (cart.length === 0) {
        if (sawEmpty || tooExpensive) stats.lost++;
        continue;
      }
      if (random() < lossInQueue || stats.served >= serveCap) {
        state = returnToShelf(state, cart);
        stats.lost++;
        continue;
      }
      const paid = checkout(state, cart);
      state = paid.state;
      stats.revenue += paid.total;
      stats.served++;
      if (hasUnmarkedBad(cart) && random() < BAD_COMPLAINT_CHANCE) stats.complaints++;
      if (random() < dirtComplaint) stats.complaints++;
    }

    // ---------- Ночь ----------
    const night = endDay(state, stats);
    state = night.state;
    const expenses = night.bill ? billTotal(night.bill) : 0;
    out.push({
      day: state.day - 1,
      level: state.level,
      money: state.money,
      debt: state.debt,
      rating: state.rating,
      guests: dayGuests,
      served: stats.served,
      lost: stats.lost,
      revenue: stats.revenue,
      purchases,
      investments,
      spoiled: night.spoiled,
      expenses,
      profit: stats.revenue - purchases - expenses,
    });
    void moneyStart;
  }
  return { days: out, levelDay };
}


/** Средний результат по нескольким прогонам: день достижения каждого уровня. */
export function averageLevelDays(days: number, runs: number): (number | null)[] {
  const results = Array.from({ length: runs }, (_, i) => simulate({ days, seed: i + 1 }).levelDay);
  return STORE_LEVELS.map((_, level) => {
    const reached = results.map((r) => r[level]).filter((d): d is number => d !== null);
    if (reached.length < runs / 2) return null;
    return Math.round(reached.reduce((a, b) => a + b, 0) / reached.length);
  });
}

export { SHELF_LEVELS, type ProductId, PRODUCT_IDS };
