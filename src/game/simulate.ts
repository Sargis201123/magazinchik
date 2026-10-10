// Симулятор экономики: «разумный игрок» играет много дней по тем же правилам, что и игра.
// Нужен для баланса: на какой день игрок расширяет магазин, сколько зарабатывает, где застревает.
// Запуск: npm run sim

import {
  buyChance,
  buyShelf,
  buyStock,
  type Category,
  checkout,
  type DayStats,
  emptyDayStats,
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
  seasonalDemand,
  giveDayOff,
  isTired,
  markdownSurplus,
  shelfKindOpen,
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
  cashierScan,
  workSpeed,
  checkoutSeconds,
  DAY_SECONDS,
  recordSale,
} from './economy';
import { ensurePlan, guestsToday, inspectionDone, nightCycle } from './day';
import { answerEvent, inspect } from './events';
import { candidatesFor } from './staff';
import { CHAPTERS, finishChapter, finishIntro, pendingStory } from './story';
import { rng } from './random';
import { perceivedBase, pickWanted, seasonFor } from './endless';
import { haggle, newDeal, SUPPLIER_IDS, SUPPLIERS, unitPrice } from './suppliers';
import { buyUpgrade, carryOf, cartExtra, ETAGS_EVENING, eveningSales, hasUpgrade, loyaltyTolerance, UPGRADES, withUpgrades, type UpgradeId } from './upgrades';
import { CARRY } from './economy';
import { fairTolerance, isFairDay, STALL_MAX, stallSale } from './fair';
import { CASHIER_ROLES, registerCount } from './registers';
import { CANDY_PRICE, impulseChance, nextRack, refillRack, takeCandy, upgradeRack } from './impulse';
import { buyCups, coffeeChance, useCup } from './coffee';
import { weatherFor } from './weather';
import { brewSeconds, cameraTheft, climatePatience, coffeePrice, entranceMud, fridgeLeak, GEAR_IDS, gearAvailable, nextGear, ovenBatch, REGISTER_JAM_SECONDS, registerJam, upgradeGear, wcDirt } from './gear';
import { AROMA_SECONDS, AROMA_TOLERANCE, startBatch, takeOutBread } from './bakery';
import { NIGHT_GUESTS, NIGHT_MARKUP, NIGHT_SECONDS, NIGHT_TOLERANCE, startNight } from './night';
import { adoptCat, buyBed, CAT_BED_IDS, CAT_BEDS, CAT_TIP, catOffer, catPatience, catTipChance, feedCat } from './cat';
import { answerWar, warLeaves, type WarAnswer } from './war';
import { dayDemand } from './demand';
import { recordDay } from './achievements';
import { buyRadio, hasRadio, radioExtra, radioPatience, RADIO_PRICE, setStation } from './radio';
import { carryBonus, charmPatience, eyeTheft, haggleBonus, learnSkill, ownerTiming, SKILL_IDS, skillPoints } from './owner';

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
  /** Доход от новых механик за день (выручка минус себестоимость). */
  candy: number;
  coffee: number;
  /** Экономия на хлебе из своей печи против закупки. */
  oven: number;
  night: number;
  expenses: number;
  /** Выручка − закупка − расходы (без вложений в полки и расширение). */
  profit: number;
}

export interface SimResult {
  days: SimDay[];
  /** На какой день достигнут каждый уровень магазина (индекс = уровень). */
  levelDay: (number | null)[];
  /** С какого дня шла каждая глава сюжета (последний элемент — свободная игра). */
  chapterDay: (number | null)[];
  /** В какой день бабушка выручила с долгами и в какой магазин закрыли за долги (null — не было). */
  rescueDay: number | null;
  bankruptDay: number | null;
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
  /** Какие новые механики использует игрок (по умолчанию — никакие, как раньше). */
  features?: Partial<Record<Feature, boolean>>;
  /** Как отвечать на ценовую войну. */
  war?: WarAnswer;
  /** Сколько закладок в печь игрок успевает за день и как часто забывает вынуть. */
  ovenBatches?: number;
  ovenBurn?: number;
}

export type Feature = 'candy' | 'coffee' | 'oven' | 'night' | 'cat' | 'cart' | 'loyalty' | 'gear' | 'etags' | 'departments' | 'skills' | 'radio';

/** В каком порядке разумный игрок докупает полки. */
const SHELF_PRIORITY: Category[] = ['dairy', 'meat', 'produce', 'bakery', 'dairy', 'produce', 'meat', 'bakery', 'produce', 'dairy'];
/** С новыми отделами: напитки, заморозка и химия — как только помещение позволяет. */
const SHELF_PRIORITY_DEPTS: Category[] = ['dairy', 'meat', 'drinks', 'produce', 'frozen', 'bakery', 'household', 'dairy', 'produce', 'meat'];

const AVG_WANTS = 1.5;

/** Когда разумный игрок нанимает людей: по мере того, как один не справляется. */
// Кассир — первым: остальные места не занимаем, пока за кассой стоит сам хозяин.
const HIRE_WHEN: [StaffRole, (state: StoreState) => boolean][] = [
  ['cashier', (s) => expectedGuests(s.rating, s.level) > SOLO_SERVE_CAP * 1.2],
  ['loader', (s) => s.level >= 2 && Boolean(staffOf(s, 'cashier'))],
  ['guard', (s) => s.level >= 2 && Boolean(staffOf(s, 'cashier'))],
  ['cleaner', (s) => s.level >= 3 && Boolean(staffOf(s, 'cashier'))],
  // Кассиры на остальные кассы — когда кассы есть и гостей больше, чем пробьют уже нанятые.
  ['cashier2', (s) => registerCount(s) >= 2 && expectedGuests(s.rating, s.level) > SOLO_SERVE_CAP * 2],
  ['cashier3', (s) => registerCount(s) >= 3 && expectedGuests(s.rating, s.level) > SOLO_SERVE_CAP * 3],
  ['cashier4', (s) => registerCount(s) >= 4 && expectedGuests(s.rating, s.level) > SOLO_SERVE_CAP * 4],
  ['manager', (s) => s.level >= 3 && s.staff.length >= 4],
];

/** Для решения «пора нанимать кассира»: примерно столько успевает один человек. */
const SOLO_SERVE_CAP = 30;
/** Средняя корзина в штуках. */
const AVG_BASKET = 1.4;
/** Один игрок стоит за кассой не весь день: ещё бегает на склад и убирает — в большом магазине дел больше. */
const ownerAtRegister = (level: number): number => 0.65 - 0.07 * level;
/** Подойти к кассе и отойти — секунды на каждого покупателя. */
const QUEUE_STEP_SECONDS = 0.3;

/** Сколько покупателей реально пробить за день: пробивка занимает время и зависит от навыка. */
function serveCapacity(state: StoreState): number {
  // Старая касса иногда заедает — в среднем столько секунд на покупателя.
  const jam = registerJam(state) * REGISTER_JAM_SECONDS;
  const owner = checkoutSeconds(withUpgrades(state, ownerTiming(state)), AVG_BASKET) + QUEUE_STEP_SECONDS + jam;
  const ownerCap = Math.floor((DAY_SECONDS * ownerAtRegister(state.level)) / owner);
  // Каждая касса: свой кассир или (одна, первая свободная) — хозяин между другими делами.
  let total = 0;
  let ownerUsed = false;
  for (const role of CASHIER_ROLES.slice(0, registerCount(state))) {
    const m = staffOf(state, role);
    if (m) total += Math.floor(DAY_SECONDS / (checkoutSeconds(withUpgrades(state, cashierScan(m)), AVG_BASKET) + QUEUE_STEP_SECONDS + jam));
    else if (!ownerUsed) {
      total += ownerCap;
      ownerUsed = true;
    }
  }
  return total;
}

export function simulate({
  days,
  seed = 1,
  queueLoss,
  tripsPerDay,
  priceMult = 1,
  hireStaff = true,
  features = {},
  war = 'wait',
  ovenBatches = 3,
  ovenBurn = 0.1,
}: SimOptions): SimResult {
  const random = rng(seed);
  // Случайности новых механик — отдельно: тогда прогоны с механикой и без идут по одним и тем же
  // событиям дня, и разницу видно точно, а не сквозь шум.
  const extraRandom = rng(seed * 7919 + 1);
  let state = ensurePlan(newGame());
  for (const id of PRODUCT_IDS) state = setPrice(state, id, Math.round((PRODUCTS[id].basePrice * priceMult) / 5) * 5);
  const out: SimDay[] = [];
  const levelDay: (number | null)[] = STORE_LEVELS.map((_, i) => (i === 0 ? 1 : null));
  let rescueDay: number | null = null;
  let bankruptDay: number | null = null;
  const chapterDay: (number | null)[] = [...CHAPTERS, null].map((_, i) => (i === 0 ? 1 : null));

  for (let d = 0; d < days; d++) {
    const moneyStart = state.money;
    let investments = 0;
    // Запас на закупку плюс копилка на счета в конце месяца.
    const bill = billTotal(monthlyBill(state));
    const reserve = 150 + 100 * state.level + Math.round(bill * (1 - daysUntilBill(state.day) / MONTH_DAYS));

    // ---------- Утро: долг, расширение, полки ----------
    if (state.debt > 0 && state.money - state.debt >= reserve) state = payDebt(state, state.debt) ?? state;

    const next = nextStoreLevel(state);
    // Расширяется, только если после стройки останется на счета уже по новой аренде.
    const nextBill = next ? billTotal(monthlyBill({ ...state, level: state.level + 1 })) : 0;
    if (next && state.money >= next.cost + Math.max(reserve, nextBill)) {
      const expanded = expandStore(state);
      if (expanded) {
        investments += next.cost;
        state = expanded;
        levelDay[state.level] = state.day;
      }
    }

    const priority = features.departments ? SHELF_PRIORITY_DEPTS : SHELF_PRIORITY;
    while (freeSlots(state) > 0) {
      // Закрытый в этом помещении отдел пропускаем — берём следующую по списку полку.
      const kind = priority.find(
        (k, i) => shelfKindOpen(state, k) && priority.slice(0, i + 1).filter((x) => x === k).length > state.shelves.filter((s) => s.kind === k).length,
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
    // Сюжет: прочитать диалоги, получить награды.
    for (let story = pendingStory(state); story; story = pendingStory(state)) {
      state = story.kind === 'intro' ? finishIntro(state) : finishChapter(state);
      chapterDay[state.story.chapter] ??= state.day;
    }
    // Утреннее событие: заказ — если товара хватает, партия — если есть деньги, холодильник — чинить.
    const event = state.plan?.event;
    if (event?.kind === 'priceWar' && !state.plan?.decided) {
      state = answerWar(state, event, war) ?? answerWar(state, event, 'wait')!;
    } else if (event && !state.plan?.decided) {
      // Заказ берём, если товар сейчас продаётся: под него докупим в закупке ниже.
      const accept = event.kind !== 'order' || sellableProducts(state).includes(event.product);
      state = answerEvent(state, accept) ?? answerEvent(state, false) ?? state;
    }

    // Разумный игрок соглашается на прибавки: обиженный сотрудник работает хуже.
    for (const m of state.staff) if (m.raiseAsk) state = answerRaise(state, m.role, true);
    // И даёт выходной тому, кто устал (по одному за раз).
    const tired = state.staff.find((m) => isTired(m) && m.offDay !== state.day + 1);
    if (tired) state = giveDayOff(state, tired.role) ?? state;
    if (hireStaff) {
      const role = HIRE_WHEN.find(([r, need]) => !staffOf(state, r) && need(state))?.[0];
      // Берём самого быстрого; «тормоз» за кассой навсегда упирает магазин в потолок.
      const candidate =
        role &&
        candidatesFor(state.day, 0, role)
          .filter((c) => c.trait !== 'sticky' && !(role === 'cashier' && c.trait === 'slowpoke'))
          .sort((a, b) => workSpeed(b) - workSpeed(a))[0];
      if (candidate && state.staff.length < staffLimit(state) && state.money >= reserve + candidate.wage) {
        state = hire(state, candidate) ?? state;
      }
    }

    // ---------- Утро: новые механики ----------
    const wants: [Feature, UpgradeId][] = [
      ['coffee', 'coffee'],
      ['oven', 'oven'],
      ['night', 'nightShift'],
      ['cart', 'cart'],
      ['loyalty', 'loyalty'],
      ['etags', 'eTags'],
    ];
    // Дорогое «для удобства» (ночная смена, новые модели) разумный игрок берёт, когда уже не копит на расширение.
    const nextLevel = nextStoreLevel(state);
    const canSplurge = (price: number) => !nextLevel || state.money - price >= nextLevel.cost + reserve;
    for (const [feature, id] of wants) {
      if (!features[feature] || hasUpgrade(state, id) || state.money < UPGRADES[id].price + reserve) continue;
      if ((id === 'nightShift' || id === 'eTags') && !canSplurge(UPGRADES[id].price)) continue;
      const bought = buyUpgrade(state, id);
      if (bought) {
        investments += UPGRADES[id].price;
        state = bought;
      }
    }
    // Новые модели оборудования — когда хватает денег с запасом и не копит на расширение.
    if (features.gear) {
      for (const id of GEAR_IDS) {
        const next = nextGear(state, id);
        if (!next || !gearAvailable(state, id) || state.money < next.price + reserve * 2 || !canSplurge(next.price)) continue;
        investments += next.price;
        state = upgradeGear(state, id) ?? state;
      }
    }
    // Радио: купить, когда есть запас; со сладостями у кассы — хиты, иначе ретро.
    if (features.radio) {
      if (!hasRadio(state) && state.money >= RADIO_PRICE + reserve) state = buyRadio(state) ?? state;
      if (hasRadio(state)) state = setStation(state, features.candy ? 'hits' : 'retro') ?? state;
    }
    // Навыки хозяина: очки — по кругу во все навыки.
    if (features.skills) {
      for (let i = 0; skillPoints(state) > 0 && i < SKILL_IDS.length * 3; i++) {
        state = learnSkill(state, SKILL_IDS[i % SKILL_IDS.length]) ?? state;
      }
    }
    if (features.cat) {
      if (catOffer(state)) state = adoptCat(state, 'Барсик');
      state = feedCat(state) ?? state;
      const bed = CAT_BED_IDS.find((b) => !state.cat?.beds.includes(b));
      if (bed && state.money >= CAT_BEDS[bed].price + reserve * 4) {
        investments += CAT_BEDS[bed].price;
        state = buyBed(state, bed) ?? state;
      }
    }
    if (features.candy) {
      const next = nextRack(state);
      if (next && state.money >= next.cost + reserve * 2) {
        investments += next.cost;
        state = upgradeRack(state) ?? state;
      }
      state = refillRack(state, 999) ?? state;
    }
    if (features.coffee && hasUpgrade(state, 'coffee')) state = buyCups(state, 999) ?? state;
    // Печь: хлеб из своих закладок (часть сгорает — игрок не успел вынуть). Хлеб пойдёт в зачёт закупки.
    let breadBaked = 0;
    let batches = 0;
    if (features.oven && hasUpgrade(state, 'oven') && sellableProducts(state).includes('bread')) {
      for (let b = 0; b < ovenBatches; b++) {
        const next = startBatch(state);
        if (!next) break;
        state = next;
        batches++;
        if (extraRandom() < ovenBurn) continue;
        state = takeOutBread(state).state;
        breadBaked += ovenBatch(state);
      }
    }
    // Доля дня, когда в зале пахнет хлебом.
    const aromaShare = Math.min(1, ((batches * AROMA_SECONDS) / DAY_SECONDS) * (1 - ovenBurn));

    // ---------- Утро: закупка ----------
    const sellable = sellableProducts(state);
    // Ярмарка: докупить на склад под лоток и продать через него (мимо кассы).
    let stallRevenue = 0;
    if (isFairDay(state.day) && sellable.length) {
      for (let n = 0; n < STALL_MAX; n++) {
        const id = sellable[n % sellable.length];
        const best = SUPPLIER_IDS.map((sid) => unitPrice(SUPPLIERS[sid], newDeal(SUPPLIERS[sid]), id)).filter((p): p is number => p !== null).sort((a, b) => a - b)[0];
        const bought = best !== undefined && state.money > reserve + best ? buyStock(state, id, 1, best) : null;
        if (!bought) break;
        state = bought;
        const sale = stallSale(state, () => n / STALL_MAX);
        if (!sale) break;
        state = sale.state;
        stallRevenue += sale.price;
      }
    }
    const guests = guestsToday(state);
    let purchases = 0;
    const deals = Object.fromEntries(
      SUPPLIER_IDS.map((sid) => {
        const s = SUPPLIERS[sid];
        return [sid, haggle(s, newDeal(s), 0.05, state.rating, random(), haggleBonus(state)).deal];
      }),
    );
    for (const id of sellable) {
      // Доля спроса на товар: в сезон любимые товары берут чаще.
      const weight = (p: ProductId) =>
        (seasonFor(state.day)?.demand[p] ?? 1) * seasonalDemand(p, state.day) * dayDemand(state, p, aromaShare > 0.5);
      const share = weight(id) / sellable.reduce((sum, p) => sum + weight(p), 0);
      const demand = guests * AVG_WANTS * buyChance(state.prices[id], perceivedBase(state, id)) * share;
      const shelfRoom = state.shelves
        .filter((s) => s.kind === PRODUCTS[id].category)
        .reduce((sum, s) => sum + shelfCapacity(s), 0);
      const shareOfShelf = shelfRoom / sellable.filter((p) => PRODUCTS[p].category === PRODUCTS[id].category).length;
      const order = state.plan?.order?.product === id ? state.plan.order.qty : 0;
      const target = Math.ceil(Math.min(demand * 1.1, shareOfShelf + CARRY * 2)) + order;
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
    // С котом в очереди ждут дольше — уходят реже.
    const lossInQueue =
      (queueLoss ?? (has('cashier') ? 0.02 : 0.05 + 0.05 * state.level)) / catPatience(state) / climatePatience(state, weatherFor(state.day)) / charmPatience(state) / radioPatience(state);
    const serveCap = serveCapacity(state);
    // Грязь: уборщик, а ещё вход (грязь с улицы) и туалет (gear.ts).
    const dirtComplaint = (has('cleaner') ? 0.01 : 0.02 + 0.02 * state.level) * (0.6 + 0.2 * entranceMud(state) + 0.2 * wcDirt(state));
    const guard = staffOf(state, 'guard');
    let candy = 0;
    let coffee = 0;
    let coffees = 0;
    const coffeeCap = Math.floor(DAY_SECONDS / (brewSeconds(state) + 3));
    // Пробить покупателя: товар, а ещё шоколадка у кассы и кофе.
    const extras = (night: boolean): number => {
      let extra = 0;
      if (features.candy && extraRandom() < impulseChance(state, night ? 0 : 1)) {
        const next = takeCandy(state);
        if (next) {
          state = next;
          extra += CANDY_PRICE;
          candy += CANDY_PRICE;
        }
      }
      if (features.coffee && coffees < coffeeCap && extraRandom() < coffeeChance(state)) {
        const next = useCup(state);
        if (next) {
          state = next;
          coffees++;
          extra += coffeePrice(state);
          coffee += coffeePrice(state);
        }
      }
      return extra;
    };
    const runGuests = (count: number, tolerance: number, cap: number, night: boolean) => {
    for (let g = 0; g < count; g++) {
      if (random() < thiefChance(state.level) * cameraTheft(state) * eyeTheft(state)) {
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
          state = moveToShelf(state, index, undefined, carryOf(state) + (has('loader') ? 0 : carryBonus(state))).state;
          trips--;
        }
      }
      const aroma = random() < aromaShare;
      const wanted = pickWanted(state, random, (random() < AVG_WANTS - 1 ? 2 : 1) + cartExtra(state, extraRandom) + radioExtra(state, extraRandom), (p) => dayDemand(state, p, aroma));
      const fair = (p: ProductId) =>
        perceivedBase(state, p) * tolerance * fairTolerance(state.day) * loyaltyTolerance(state) * (aroma && p === 'bread' ? AROMA_TOLERANCE : 1);
      const cart: CartItem[] = [];
      let sawEmpty = false;
      let tooExpensive = false;
      for (const id of new Set(wanted)) {
        const index = shelfFor(state, id);
        const shelf = state.shelves[index];
        const oldest = shelf && !shelf.broken ? shelf.items[id]?.[0] : undefined;
        if (!oldest) {
          sawEmpty = true;
          continue;
        }
        if (warLeaves(state, id) > 0 && extraRandom() < warLeaves(state, id)) {
          tooExpensive = true;
          continue;
        }
        const price = Math.ceil(unitSalePrice(state, id, oldest) * (night ? NIGHT_MARKUP : 1));
        if (random() < buyChance(price, fair(id))) {
          const taken = takeFromShelf(state, index, id)!;
          state = taken.state;
          cart.push({ id, unit: taken.unit });
        } else if (price > fair(id)) {
          tooExpensive = true;
        }
      }
      if (cart.length === 0) {
        if (sawEmpty || tooExpensive) stats.lost++;
        continue;
      }
      if (random() < lossInQueue || stats.served >= cap) {
        state = returnToShelf(state, cart);
        stats.lost++;
        continue;
      }
      const paid = checkout(state, cart, night ? NIGHT_MARKUP : 1);
      const extra = extras(night) + (extraRandom() < catTipChance(state) ? CAT_TIP : 0);
      state = { ...paid.state, money: paid.state.money + extra };
      stats.revenue += paid.total + extra;
      if (night) nightRevenue += paid.total + extra;
      stats.served++;
      recordSale(stats, cart);
      if (hasUnmarkedBad(cart) && random() < BAD_COMPLAINT_CHANCE) stats.complaints++;
      if (random() < dirtComplaint) stats.complaints++;
    }
    };
    let nightRevenue = 0;
    if (hasUpgrade(state, 'eTags')) {
      // Электронные ценники: к вечеру то, что испортится ночью, уценяется само.
      const evening = Math.round(dayGuests * ETAGS_EVENING);
      runGuests(dayGuests - evening, 1, serveCap, false);
      state = markdownSurplus(state, (id) => eveningSales(stats.sold[id] ?? 0)).state;
      runGuests(evening, 1, serveCap, false);
    } else runGuests(dayGuests, 1, serveCap, false);
    // Ночная смена: гостей меньше, к ценам терпимее, касса успевает пропорционально времени.
    let nightProfit = 0;
    if (features.night && hasUpgrade(state, 'nightShift')) {
      const paid = startNight(state);
      if (paid) {
        state = paid;
        const before = stats.served;
        const nightGuests = Math.round(((guests * NIGHT_SECONDS) / DAY_SECONDS) * NIGHT_GUESTS * (0.85 + random() * 0.3));
        runGuests(nightGuests, NIGHT_TOLERANCE, before + Math.floor((serveCap * NIGHT_SECONDS) / DAY_SECONDS), true);
        nightProfit = nightRevenue;
      }
    }

    stats.revenue += stallRevenue;
    // Протёк старый холодильник — кто-то поскользнулся и пожаловался.
    if (extraRandom() < fridgeLeak(state) && state.shelves.some((sh) => SHELF_KINDS[sh.kind].fridge)) stats.complaints++;

    // Мусор: уборщик убирает всё, игрок — сколько успеет.
    stats.trashCleaned = has('cleaner') ? 3 + state.level : Math.floor(random() * (3 + state.level));

    // Проверка: с уборщиком чисто почти всегда, в одиночку — как повезёт.
    if (state.plan?.inspection) {
      const clean = random() < (staffOf(state, 'cleaner') ? 0.9 : 0.6);
      state = inspectionDone(state, inspect(state, { trash: clean ? 0 : 3, toiletDirt: clean ? 0 : 70 }));
    }

    // ---------- Ночь ----------
    if (!has('cashier')) state = { ...state, ownerServed: state.ownerServed + stats.served };
    state = recordDay(state, stats);
    const night = nightCycle(state, stats, random);
    state = night.state;
    if (state.grandmaRescue && rescueDay === null) rescueDay = state.day;
    if (state.bankrupt && bankruptDay === null) bankruptDay = state.day;
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
      candy,
      coffee,
      oven: breadBaked,
      night: nightProfit,
    });
    void moneyStart;
  }
  return { days: out, levelDay, chapterDay, rescueDay, bankruptDay };
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
