// Симулятор экономики: «разумный игрок» играет много дней по тем же правилам, что и игра.
// Нужен для баланса: на какой день игрок расширяет магазин, сколько зарабатывает, где застревает.
// Запуск: npm run sim

import { noteLost } from './losses';
import { isBroke } from './tips';
import { loanOptions, takeLoan } from './bank';
import { cook, cookBatch, cookRoundsPerDay, DISHES, DISH_IDS, kitchenWorking, sellDish, servePortions, stockKitchen, takeIngredients, topUpKitchen } from './kitchen';
import { answerStaffEvent, eventCost } from './staffEvents';
import { answerTale, taleToday } from './tales';
import { answerOpening, BUILDINGS, districtNews } from './district';
import { answerTrick, counterCost, trickToday } from './tricks';
import { answerNightStory, nightStory } from './nightGuests';
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
  HYPER_LEVEL,
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
  roleOpen,
  thiefChance,
  type StaffMember,
  type StaffRole,
  type StoreState,
  cashierScan,
  workSpeed,
  checkoutSeconds,
  DAY_SECONDS,
  recordSale,
} from './economy';
import { activeAds, AD_IDS, adBasket, adBlock, adExtraItems, adGuests, adPrice, adTrust, buyAd, type AdId } from './ads';
import { actualGuestsToday, ensurePlan, guestsToday, inspectionDone, nightCycle } from './day';
import { restockPlan } from './restock';
import { buyLine } from './reorder';
import { bigDaySeed, setBigDaySeed } from './bigday';
import { autoActive, autoArrived, autoMorning, autoTopUp } from './autoorder';
import { answerEvent, inspect } from './events';
import { candidatesFor } from './staff';
import { CHAPTERS, finishChapter, finishIntro, pendingStory } from './story';
import { rng } from './random';
import { perceivedBase, pickWanted, seasonFor } from './endless';
import { badBatch, haggle, newDeal, SUPPLIER_IDS, SUPPLIERS, supplierOpen, unitPrice } from './suppliers';
import { buyUpgrade, carryOf, cartPatience, ETAGS_EVENING, eveningSales, hasUpgrade, LOYALTY_TOLERANCE, loyaltyTolerance, UPGRADES, withUpgrades, type UpgradeId } from './upgrades';
import { CARRY, OWN_PRODUCTS } from './economy';
import { fairTolerance, isFairDay, STALL_MAX, stallSale } from './fair';
import { buyRegister, cashierCount, isCashierRole, nextCashierRole, nextRegisterPrice, registerCount, registerOfRole, RELIEF_ROLE, TILL_ROLES } from './registers';
import { CANDY_PRICE, impulseChance, nextRack, refillRack, takeCandy, upgradeRack } from './impulse';
import { buyCups, coffeeChance, useCup } from './coffee';
import { weatherFor } from './weather';
import { simSmellComplaint } from './rot';
import { brewSeconds, cameraTheft, climatePatience, coffeePrice, entranceMud, fridgeLeak, GEAR_IDS, gearAvailable, nextGear, ovenBatch, ovenBatchCost, REGISTER_JAM_SECONDS, registerJam, signagePatience, upgradeGear, wcDirt } from './gear';
import { AROMA_SECONDS, AROMA_TOLERANCE, bakerShouldBake, bakeryWorking, sellWholesale, startBatch, takeOutBread, wholesaleToBake } from './bakery';
import { NIGHT_GUESTS, NIGHT_MARKUP, NIGHT_SECONDS, NIGHT_TOLERANCE, startNight } from './night';
import { adoptDog, DOG_FROM_DAY, DOG_PRICE, hasDog } from './watch';
import { adoptCat, buyBed, CAT_BED_IDS, CAT_BEDS, CAT_TIP, catOffer, catPatience, catTipChance, feedCat } from './cat';
import { answerWar, warLeaves, type WarAnswer } from './war';
import { dayDemand } from './demand';
import { recordDay } from './achievements';
import { answerCafe, cafeDeliver } from './cafe';
import { deliveryDay } from './delivery';
import { BRAND_BATCH, brandAvailable, brandToBake, buyBrandLevel, nextBrandCost, startBrandBatch } from './brand';
import { buyRadio, hasRadio, radioPatience, RADIO_PRICE, radioTolerance, setStation } from './radio';
import { buyKiosk, kioskCount, kioskTier, laneGuests, nextKioskPrice, nextKioskTier, upgradeKiosks } from './lanes';
import { BRANCH_PRICE, BRANCH_TRACK_IDS, branchGain, branchOpen, buyBranch, nextBranchTier, upgradeBranch } from './branch';
import { buyHood, HOOD, nextHood } from './hood';
import { simMoments } from './moments';
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
  /** Чистый доход филиала за день (branch.ts). */
  branch: number;
  /** Сколько потрачено на рекламу сегодня. */
  ads: number;
  /** Награды за задания дня (endless.ts questsFor). */
  quests: number;
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
  /** Ночные воры: день, чем кончилось, во сколько обошлось (товар по закупке + касса + замок). */
  burglaries: { day: number; outcome: string; loss: number }[];
  /** Смены фаз «Гиганта» и итоги конкурсов — по дням. */
  giant: { day: number; phase: string }[];
  contests: { day: number; tier: number; won: boolean }[];
  /** Состояние в конце прогона. */
  final: StoreState;
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
  /**
   * Как игрок закупается утром: 'restock' (по умолчанию) — жмёт «Закупить нужное» (restock.ts): одно
   * нажатие закупает и на полки, и на склад, на этом игроке откалиброван баланс; 'smart' — знает спрос
   * дня точно, но закупку режет свободный склад (старая модель, до раскладки на полки); 'naive' —
   * новичок: держит всего поровну, по 8 штук; 'auto' — как 'restock', пока не купит автозаказ
   * (autoorder.ts), а дальше закупается он сам: утром в пределах лимита, днём подвозит кончившееся.
   */
  buyMode?: 'smart' | 'restock' | 'naive' | 'auto';
  /** Замер одной рекламы: держать её всегда, пока магазин на этом уровне (индекс STORE_LEVELS) и есть запас. */
  adAlways?: { id: AdId; level: number };
  /**
   * Какую долю активных моментов дня ловит игрок (moments.ts). По умолчанию 0 — как раньше, до моментов
   * (на этом откалиброваны прежние проверки баланса); их вклад меряют отдельно: SIM_CATCH против 0
   * на тех же сидах (tests/moments.test.ts, npm run sim:quests).
   */
  momentCatch?: number;
}

export type Feature =
  | 'candy'
  | 'coffee'
  | 'oven'
  | 'night'
  | 'cat'
  | 'cart'
  | 'loyalty'
  | 'gear'
  | 'etags'
  | 'departments'
  | 'skills'
  | 'radio'
  | 'brand'
  | 'cafe'
  | 'kitchen'
  | 'rush'
  | 'delivery'
  | 'ads'
  | 'adsMax'
  | 'kiosks'
  | 'branch'
  // Переезд в гипермаркет (economy.ts, HYPER_LEVEL): только вместе с филиалом — без него переезд закрыт.
  | 'hyper'
  // Благоустройство района (hood.ts): тратит лишнее — самое дешёвое, когда не копит на помещение.
  | 'hood';

/** В каком порядке разумный игрок докупает полки. */
const SHELF_PRIORITY: Category[] = ['dairy', 'meat', 'produce', 'bakery', 'dairy', 'produce', 'meat', 'bakery', 'produce', 'dairy', 'meat', 'bakery', 'produce', 'dairy', 'meat', 'produce', 'bakery'];
/** С новыми отделами: напитки, заморозка и химия — как только помещение позволяет. */
const SHELF_PRIORITY_DEPTS: Category[] = ['dairy', 'meat', 'drinks', 'produce', 'frozen', 'bakery', 'household', 'dairy', 'produce', 'meat', 'drinks', 'frozen', 'bakery', 'household', 'dairy', 'produce', 'meat'];

const AVG_WANTS = 1.5;
/** Сколько штук каждого товара держит новичок (buyMode: 'naive'). */
const NAIVE_STOCK = 8;

/** Когда разумный игрок нанимает людей: по мере того, как один не справляется. */
type Hire = (state: StoreState) => StaffRole | null;
const want =
  (role: StaffRole, need: (state: StoreState) => boolean): Hire =>
  (s) =>
    !staffOf(s, role) && need(s) ? role : null;
/**
 * Ещё один кассир — когда гостей больше, чем пробьют хозяин и уже нанятые (n — сколько их уже).
 * Кого именно — решает nextCashierRole: за свободную кассу (её докупим), а нет своих касс — сменщика.
 */
const cashier =
  (n: number, need: number): Hire =>
  (s) =>
    cashierCount(s) === n && expectedGuests(s.rating, s.level) > SOLO_SERVE_CAP * (need + kioskLanes(s)) ? nextCashierRole(s) : null;
/** Киоски берут на себя часть очереди: каждый — как кассир на долю своей модели (lanes.ts). */
const kioskLanes = (s: StoreState): number => kioskCount(s) * kioskTier(s).lane;
const hasCashier = (s: StoreState): boolean => cashierCount(s) > 0;
// Кассир — первым: остальные места не занимаем, пока хозяин один на всё.
const HIRE_WHEN: Hire[] = [
  cashier(0, 1.2),
  // Пекарь и бариста — как только есть печь и кофейня: без них флигель стоит.
  want('baker', (s) => roleOpen(s, 'baker')),
  want('barista', (s) => roleOpen(s, 'barista')),
  // Повар — как только есть кухня: без него готовить приходится утром самому.
  want('cook', (s) => roleOpen(s, 'cook')),
  want('loader', (s) => s.level >= 2 && hasCashier(s)),
  want('guard', (s) => s.level >= 2 && hasCashier(s)),
  want('cleaner', (s) => s.level >= 3 && hasCashier(s)),
  // Ещё кассиры — когда гостей больше, чем пробьют уже нанятые.
  cashier(1, 2),
  cashier(2, 3),
  cashier(3, 4),
  // Пятая касса — только в гипермаркете (registers.ts).
  cashier(4, 5),
  want('manager', (s) => s.level >= 3 && s.staff.length >= 4),
];

/** Реклама имеет смысл, только если вчера ушли ни с чем не больше этой доли гостей. */
const AD_LOST_OK = 0.05;
/** …и кассы вчера были заняты не больше чем на эту долю: есть кому пробить новых гостей. */
const AD_BUSY_OK = 0.8;
/** Для решения «пора нанимать кассира»: примерно столько успевает один человек. */
const SOLO_SERVE_CAP = 30;
/** Улучшение филиала разумный игрок берёт, если оно окупится не дольше чем за столько дней. */
const BRANCH_PAYBACK_OK = 60;
/** Средняя корзина в штуках. */
const AVG_BASKET = 1.4;
/** Один игрок стоит за кассой не весь день: ещё бегает на склад и убирает — в большом магазине дел больше. */
const ownerAtRegister = (level: number): number => 0.65 - 0.07 * level;
/** Подойти к кассе и отойти — секунды на каждого покупателя. */
const QUEUE_STEP_SECONDS = 0.3;
/** Сменщик за кассой хозяина весь день, а хозяин между делами касается кассы — пробивка чуть быстрее (в игре касаниями срезают до 30%). */
const RELIEF_TAPS = 1.1;
/** Киоск занят не весь день (к нему идут с небольшой корзиной), дойти и уложить покупки — секунды. */
const KIOSK_BUSY = 0.5;
const KIOSK_WALK_SECONDS = 2;
/** Какая доля гостей с корзиной не больше maxItems штук (корзина в среднем AVG_BASKET). */
const smallBasket = (maxItems: number): number => (maxItems >= 3 ? 0.9 : 0.75);
/** Хозяин собирает заказ на дом: сходить на склад, уложить коробку, вынести курьеру. */
const OWNER_PACK_SECONDS = 8;
/** Столько секунд кассы в среднем уходит на одного покупателя у хозяина (для «пока собирал заказ»). */
const OWNER_SECONDS_PER_GUEST = 2.5;

/**
 * Сколько покупателей реально пробить за день (total) и сколько из них — сам хозяин (owner):
 * пробивка занимает время и зависит от навыка.
 */
function serveCapacity(state: StoreState): { total: number; owner: number; kiosk: number } {
  // Старая касса иногда заедает — в среднем столько секунд на покупателя.
  const jam = registerJam(state) * REGISTER_JAM_SECONDS;
  const owner = checkoutSeconds(withUpgrades(state, ownerTiming(state)), AVG_BASKET) + QUEUE_STEP_SECONDS + jam;
  const share = ownerAtRegister(state.level);
  const ownerCap = Math.floor((DAY_SECONDS * share) / owner);
  const cashierCap = (m: StaffMember, part: number) =>
    Math.floor((DAY_SECONDS * part) / (checkoutSeconds(withUpgrades(state, cashierScan(m)), AVG_BASKET) + QUEUE_STEP_SECONDS + jam));
  // Первая касса — хозяина: он за ней между другими делами. Нанят сменщик — за ней весь день он,
  // а хозяин свободен и только торопит его касаниями.
  const relief = staffOf(state, RELIEF_ROLE);
  let total = relief ? Math.floor(cashierCap(relief, 1) * RELIEF_TAPS) : ownerCap;
  // Остальные кассы — у каждой свой кассир; без кассира касса стоит закрытой.
  for (const role of TILL_ROLES.slice(0, registerCount(state) - 1)) {
    const m = staffOf(state, role);
    if (m) total += cashierCap(m, 1);
  }
  return { total, owner: relief ? 0 : ownerCap, kiosk: kioskCapacity(state) };
}

/** Сколько покупателей за день пробьют себя сами на киосках (lanes.ts). */
function kioskCapacity(state: StoreState): number {
  const n = kioskCount(state);
  if (!n) return 0;
  const tier = kioskTier(state);
  const items = Math.min(tier.maxItems, AVG_BASKET);
  return Math.floor((n * DAY_SECONDS * KIOSK_BUSY) / (items * tier.item + tier.pay + KIOSK_WALK_SECONDS));
}

export function simulate({
  days,
  seed = 1,
  queueLoss,
  tripsPerDay,
  priceMult = 1,
  buyMode = 'restock',
  hireStaff = true,
  features = {},
  war = 'wait',
  ovenBatches = 3,
  ovenBurn = 0.1,
  adAlways,
  momentCatch = 0,
}: SimOptions): SimResult {
  const random = rng(seed);
  // Случайности новых механик — отдельно: тогда прогоны с механикой и без идут по одним и тем же
  // событиям дня, и разницу видно точно, а не сквозь шум.
  const extraRandom = rng(seed * 7919 + 1);
  // Своё расписание особых дней на каждый прогон — как в игре у каждого магазина своё (StoreScene, setBigDaySeed);
  // после прогона — прежнее зерно.
  const bigDaySeedBefore = bigDaySeed();
  setBigDaySeed(seed);
  let state = ensurePlan(newGame());
  for (const id of PRODUCT_IDS) state = setPrice(state, id, Math.round((PRODUCTS[id].basePrice * priceMult) / 5) * 5);
  const out: SimDay[] = [];
  // Гипермаркет — отдельная механика: с одним филиалом «разумный игрок» туда не переезжает и на него не копит.
  const nextFor = (s: StoreState) => (s.level + 1 === HYPER_LEVEL && !features.hyper ? undefined : nextStoreLevel(s));
  const levelDay: (number | null)[] = STORE_LEVELS.map((_, i) => (i === 0 ? 1 : null));
  let rescueDay: number | null = null;
  let bankruptDay: number | null = null;
  const chapterDay: (number | null)[] = [...CHAPTERS, null].map((_, i) => (i === 0 ? 1 : null));
  const burglaries: SimResult['burglaries'] = [];
  const giantLog: SimResult['giant'] = [];
  const contests: SimResult['contests'] = [];

  for (let d = 0; d < days; d++) {
    const moneyStart = state.money;
    let investments = 0;
    let adSpent = 0;
    // Запас на закупку плюс копилка на счета в конце месяца.
    const bill = billTotal(monthlyBill(state));
    const reserve = 150 + 100 * state.level + Math.round(bill * (1 - daysUntilBill(state.day) / MONTH_DAYS));

    // ---------- Утро: долг, расширение, полки ----------
    // Касса пуста и товара нет — берёт кредит на закупку (как советует подсказка).
    if (isBroke(state)) state = takeLoan(state, loanOptions(state)[0]) ?? state;
    if (state.debt > 0 && state.money - state.debt >= reserve) state = payDebt(state, state.debt) ?? state;

    const next = nextFor(state);
    // Расширяется, только если после стройки останется на ближайший счёт — так же, как предупреждает
    // утро (morning.ts): первый счёт после переезда — по старой аренде («новоселье»).
    const nextBill = next ? billTotal(monthlyBill({ ...state, level: state.level + 1, movedFrom: state.movedFrom ?? state.level })) : 0;
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
    // Ларь с мороженым: разумный игрок ставит его, когда уже есть молочный холодильник.
    if (
      !state.shelves.some((s) => s.kind === 'icebox') &&
      state.shelves.some((s) => s.kind === 'dairy') &&
      shelfKindOpen(state, 'icebox') &&
      state.money >= SHELF_KINDS.icebox.price + reserve
    ) {
      investments += SHELF_KINDS.icebox.price;
      state = buyShelf(state, 'icebox')!;
    }

    for (let i = 0; i < state.shelves.length; i++) {
      // Ларь и вёдра нужны на один сезон — их разумный игрок не улучшает.
      if (SHELF_KINDS[state.shelves[i].kind].fixture) continue;
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

    // Кафе по соседству: договор на неделю — соглашаемся (и докупаем под него товар ниже).
    if (features.cafe && state.cafe?.offer) state = answerCafe(state, state.money > reserve * 3);
    // Разумный игрок соглашается на прибавки: обиженный сотрудник работает хуже.
    for (const m of state.staff) if (m.raiseAsk) state = answerRaise(state, m.role, true);
    // И даёт выходной тому, кто устал (по одному за раз).
    const tired = state.staff.find((m) => isTired(m) && m.offDay !== state.day + 1);
    if (tired) state = giveDayOff(state, tired.role) ?? state;
    if (hireStaff) {
      const role = HIRE_WHEN.reduce<StaffRole | null>((found, next) => found ?? next(state), null);
      // Под нового кассира сначала ставим кассу.
      const price = nextRegisterPrice(state);
      if (role && registerOfRole(role) >= registerCount(state) && price !== null && state.money >= reserve + price) state = buyRegister(state) ?? state;
      // Касса так и не встала (не хватило денег) — кассира за неё пока не берём: стоял бы без дела.
      const seat = role && registerOfRole(role) < registerCount(state);
      // Берём самого быстрого; «тормоз» за кассой навсегда упирает магазин в потолок.
      const candidate =
        role &&
        seat &&
        candidatesFor(state.day, 0, role)
          .filter((c) => c.trait !== 'sticky' && !(isCashierRole(role) && c.trait === 'slowpoke'))
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
      ['oven', 'wholesale'],
      ['coffee', 'coffeeTables'],
      ['kitchen', 'kitchen'],
      ['delivery', 'delivery'],
    ];
    // Дорогое «для удобства» (ночная смена, новые модели) разумный игрок берёт, когда уже не копит на расширение.
    const nextLevel = nextFor(state);
    const canSplurge = (price: number) => !nextLevel || state.money - price >= nextLevel.cost + reserve;
    // Автозаказ: берёт, как только хватает с запасом, и сразу включает.
    if (buyMode === 'auto' && !hasUpgrade(state, 'autoOrder') && state.level >= UPGRADES.autoOrder.minLevel && state.money >= UPGRADES.autoOrder.price + reserve) {
      const bought = buyUpgrade(state, 'autoOrder');
      if (bought) {
        investments += UPGRADES.autoOrder.price;
        state = { ...bought, autoOrder: { on: true } };
      }
    }
    for (const [feature, id] of wants) {
      if (!features[feature] || hasUpgrade(state, id) || state.money < UPGRADES[id].price + reserve) continue;
      if ((id === 'nightShift' || id === 'eTags' || id === 'coffeeTables' || id === 'kitchen') && !canSplurge(UPGRADES[id].price)) continue;
      const bought = buyUpgrade(state, id);
      if (bought) {
        investments += UPGRADES[id].price;
        state = bought;
        // С картой лояльности к ценам терпимее — игрок чуть поднимает их (как советует подсказка), с небольшим запасом.
        if (id === 'loyalty') for (const p of PRODUCT_IDS) state = setPrice(state, p, Math.round((state.prices[p] * (1 + (LOYALTY_TOLERANCE - 1) * 0.8)) / 5) * 5);
      }
    }
    // Киоски: ставит по одному, когда касса не успевает за гостями и не копит на расширение; модель
    // обновляет, когда киосков уже два.
    if (features.kiosks) {
      const price = nextKioskPrice(state);
      const short = (() => {
        const cap = serveCapacity(state);
        return cap.total + cap.kiosk < guestsToday(state);
      })();
      if (price !== null && short && state.money >= price + reserve && canSplurge(price)) {
        state = buyKiosk(state) ?? state;
        investments += price;
      }
      const tier = nextKioskTier(state);
      if (tier && kioskCount(state) >= 2 && state.money >= tier.price + reserve && canSplurge(tier.price)) {
        const up = upgradeKiosks(state);
        if (up) {
          state = up;
          investments += tier.price;
        }
      }
    }
    // Новые модели оборудования — когда хватает денег с запасом и не копит на расширение.
    if (features.gear) {
      for (const id of GEAR_IDS) {
        const next = nextGear(state, id);
        // Полка «Уценка» в симуляторе не моделируется (fillBargain) — места на ней не покупаем.
        if (id === 'bargain' || !next || !gearAvailable(state, id) || state.money < next.price + reserve * 2 || !canSplurge(next.price)) continue;
        investments += next.price;
        state = upgradeGear(state, id) ?? state;
      }
    }
    // Своя марка: печь до лучшей модели, потом рецепты «От бабушки» — когда есть запас.
    if (features.brand && hasUpgrade(state, 'oven')) {
      const oven = nextGear(state, 'oven');
      if (oven && state.money >= oven.price + reserve * 2) {
        investments += oven.price;
        state = upgradeGear(state, 'oven') ?? state;
      }
      const cost = nextBrandCost(state);
      if (cost !== null && brandAvailable(state) && state.money >= cost + reserve * 2) {
        investments += cost;
        state = buyBrandLevel(state) ?? state;
      }
    }
    // Радио: купить, когда есть запас; со сладостями у кассы — хиты, иначе ретро.
    if (features.radio) {
      if (!hasRadio(state) && state.money >= RADIO_PRICE + reserve) state = buyRadio(state) ?? state;
      if (hasRadio(state)) state = setStation(state, features.candy ? 'hits' : 'retro') ?? state;
    }
    // Реклама: 'ads' — разумный игрок: когда вчера почти никто не ушёл ни с чем (магазин справляется),
    // не копит на расширение и есть свободные деньги — берёт самую сильную рекламу на четверть запаса,
    // по одной за раз. 'adsMax' — каждый день самую дорогую, что по карману, и сверху ещё.
    const yesterday = out.at(-1);
    const coping =
      !yesterday || (yesterday.lost <= (yesterday.served + yesterday.lost) * AD_LOST_OK && yesterday.served < serveCapacity(state).total * AD_BUSY_OK);
    if (features.adsMax || (features.ads && coping && !activeAds(state).length)) {
      const budget = features.adsMax ? state.money - reserve : (state.money - reserve * 2) / 4;
      const pick = AD_IDS.filter((id) => !adBlock(state, id) && adPrice(state, id) <= budget && (features.adsMax || canSplurge(adPrice(state, id)))).sort(
        (a, b) => adPrice(state, b) - adPrice(state, a),
      )[0];
      if (pick) {
        adSpent += adPrice(state, pick);
        state = buyAd(state, pick) ?? state;
      }
    }
    if (adAlways && state.level === adAlways.level && !adBlock(state, adAlways.id) && state.money >= adPrice(state, adAlways.id) + reserve) {
      adSpent += adPrice(state, adAlways.id);
      state = buyAd(state, adAlways.id) ?? state;
    }
    investments += adSpent;
    // Филиал (branch.ts): здание — как только можно и хватает с запасом на счета; улучшения — самое
    // выгодное из доступных, если окупится за два месяца и после покупки останется тройной запас.
    if (features.branch) {
      if (branchOpen(state) && state.money >= BRANCH_PRICE + reserve * 3) {
        const bought = buyBranch(state);
        if (bought) {
          investments += BRANCH_PRICE;
          state = bought;
        }
      }
      const best = BRANCH_TRACK_IDS.map((id) => ({ id, next: nextBranchTier(state, id), gain: branchGain(state, id) }))
        .filter((o) => o.next && o.gain > 0 && o.next.price / o.gain <= BRANCH_PAYBACK_OK)
        .sort((a, b) => a.next!.price / a.gain - b.next!.price / b.gain)[0];
      if (best && state.money >= best.next!.price + reserve * 3) {
        investments += best.next!.price;
        state = upgradeBranch(state, best.id) ?? state;
      }
    }
    // Район (hood.ts): деньги сверх запаса — на самое дешёвое улучшение. Пока впереди помещение (или
    // филиал), сначала копит на него: район — трата лишнего, а не вложение.
    if (features.hood) {
      const id = nextHood(state);
      const saving = (nextFor(state)?.cost ?? 0) + (features.branch && branchOpen(state) ? BRANCH_PRICE : 0);
      if (id && state.money >= HOOD[id].price + saving + reserve * 3) {
        investments += HOOD[id].price;
        state = buyHood(state, id) ?? state;
      }
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
    // Бобик — как только по карману: ночные воры обходятся дороже корма.
    if (!hasDog(state) && state.day >= DOG_FROM_DAY && state.money >= DOG_PRICE + reserve * 3) {
      investments += DOG_PRICE;
      state = adoptDog(state) ?? state;
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
    // Кухня без повара: утром по закладке каждого блюда, на что хватает продуктов (с поваром — днём, ниже).
    if (features.kitchen && !kitchenWorking(state)) for (const id of DISH_IDS) state = cook(state, id) ?? state;
    // «Чёрная пятница района» — каждые 6-й и 7-й дни недели (как суббота и воскресенье).
    state = { ...state, rush: (features.rush && state.day % 7 >= 5) || undefined };
    // Просьбы сотрудников и истории покупателей: соглашается, если деньги есть с запасом.
    if (state.staffEvent) state = answerStaffEvent(state, state.money >= eventCost(state.staffEvent) + reserve * 2) ?? answerStaffEvent(state, false) ?? state;
    if (taleToday(state)) state = answerTale(state, 0) ?? answerTale(state, 1) ?? state;
    // Открылось здание в районе — поздравляет, если деньги есть с запасом и не копит на расширение.
    // Козни конкурента: отвечает, если деньги есть с запасом и не копит на расширение; иначе жалуется (или молчит).
    const trick = trickToday(state);
    if (trick) {
      const saving = nextFor(state);
      const afford = state.money >= counterCost(trick.kind, state.level) + reserve * 2 + (saving ? saving.cost : 0);
      state = answerTrick(state, afford ? 'counter' : trick.kind === 'banner' ? 'ignore' : 'complain', extraRandom) ?? answerTrick(state, 'ignore') ?? state;
    }
    const opened = districtNews(state);
    if (opened) {
      const saving = nextFor(state);
      const spare = state.money - BUILDINGS[opened].gift - reserve * 2 - (saving ? saving.cost : 0);
      state = answerOpening(state, opened, spare >= 0) ?? answerOpening(state, opened, false) ?? state;
    }
    // Печь: хлеб из своих закладок (часть сгорает — игрок не успел вынуть). Хлеб пойдёт в зачёт закупки.
    let breadBaked = 0;
    let batches = 0;
    // Печёт пекарь (без него пекарня стоит): закладки, пока на хлебных полках есть место; он не сжигает.
    if (features.oven && bakeryWorking(state) && sellableProducts(state).includes('bread')) {
      for (let b = 0; b < ovenBatches; b++) {
        if (!bakerShouldBake(state)) break;
        const next = startBatch(state);
        if (!next) break;
        state = next;
        batches++;
        if (extraRandom() < ovenBurn) continue;
        state = takeOutBread(state).state;
        breadBaked += ovenBatch(state);
      }
    }
    // Противни для соседей — по договору, когда пекарь на смене.
    if (features.oven) {
      for (let b = 0; wholesaleToBake(state, b) && batches < ovenBatches; b++) {
        state = sellWholesale({ ...state, money: state.money - ovenBatchCost(state) }).state;
        batches++;
      }
    }
    // Своя выпечка — когда хлеба хватает.
    if (features.brand) {
      for (let b = 0; b < ovenBatches; b++) {
        const id = brandToBake(state);
        const next = id && startBrandBatch(state, id);
        if (!id || !next) break;
        state = takeOutBread(next, BRAND_BATCH, id).state;
        batches++;
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
    const guests = actualGuestsToday(state);
    let purchases = 0;
    const deals = Object.fromEntries(
      SUPPLIER_IDS.map((sid) => {
        const s = SUPPLIERS[sid];
        return [sid, haggle(s, newDeal(s), 0.05, state.rating, random(), haggleBonus(state)).deal];
      }),
    );
    // Доля спроса на товар: в сезон любимые товары берут чаще.
    const weight = (p: ProductId) =>
      (seasonFor(state.day)?.demand[p] ?? 1) * seasonalDemand(p, state.day) * dayDemand(state, p, aromaShare > 0.5);
    const totalWeight = sellable.reduce((sum, p) => sum + weight(p), 0);
    // Гостей, которых привели открытые кассы (lanes.ts), закупка учитывает отдельно — см. ниже.
    const itemWants = (guests / laneGuests(state)) * (AVG_WANTS + adBasket(state));
    // Свою выпечку хотят, только пока она на полке: раскупили — хотят другое.
    const ownWanted = OWN_PRODUCTS.filter((p) => sellable.includes(p)).reduce(
      (sum, p) => sum + Math.min(onShelves(state, p), (itemWants * weight(p)) / totalWeight),
      0,
    );
    const otherWeight = sellable.filter((p) => !OWN_PRODUCTS.includes(p)).reduce((sum, p) => sum + weight(p), 0);
    // Кухня с поваром закупает продукты в свою кладовую сама — из кассы, на день вперёд (полки зала не трогает).
    if (features.kitchen) {
      const pantry = stockKitchen(state);
      state = pantry.state;
      purchases += pantry.spent;
    }
    if (buyMode === 'auto' && autoActive(state)) {
      // Закупщик платит обычную цену (без торга) и брака не берёт.
      const before = state.money;
      state = autoMorning(state, (sid, pid) => unitPrice(SUPPLIERS[sid], newDeal(SUPPLIERS[sid]), pid), guestsToday(state));
      purchases += before - state.money;
    } else if (buyMode === 'restock' || buyMode === 'auto') {
      // Одно нажатие: купленное сразу встаёт на полки, лишнее — на склад (buyLine).
      // Печь в симуляторе печёт до закупки: её хлеб уже в запасе, вычитать его из плана второй раз не нужно.
      const plan = restockPlan(state, (sid, pid) => unitPrice(SUPPLIERS[sid], deals[sid], pid), guestsToday(state), [], 0);
      for (const line of plan.lines) {
        const before = state.money;
        const got = buyLine(state, line, badBatch(line.sid, state.day, random()));
        state = got.state;
        if (got.bad) state = resolveBadBatch(state, line.pid, 'markdown', line.price);
        purchases += before - state.money;
      }
    }
    /** Сколько штук товара не хватает до запаса на сегодня (разумная закупка). */
    const lacking = (id: ProductId): number => {
      const demand = (itemWants - ownWanted) * buyChance(state.prices[id], perceivedBase(state, id)) * (weight(id) / otherWeight);
      const shelfRoom = state.shelves
        .filter((s) => s.kind === PRODUCTS[id].category)
        .reduce((sum, s) => sum + shelfCapacity(s), 0);
      const shareOfShelf = shelfRoom / sellable.filter((p) => PRODUCTS[p].category === PRODUCTS[id].category && !OWN_PRODUCTS.includes(p)).length;
      const order = (state.plan?.order?.product === id ? state.plan.order.qty : 0) + (state.cafe?.deal?.items[id] ?? 0);
      const target = Math.ceil(Math.min(demand * 1.1, shareOfShelf + CARRY * 2)) + order;
      return Math.max(0, target - onShelves(state, id) - warehouseOf(state, id));
    };
    // Под рекламу закупаются с умом: места на складе не хватит на всё — режут закупку поровну, а не по
    // порядку списка. Иначе при наплыве гостей первые по списку дешёвые товары забивают склад, а мясо и
    // цветы не влезают. В обычные дни — по списку, как было (баланс теперь считают по 'restock').
    const toBuy = buyMode === 'smart' && activeAds(state).length ? sellable.filter((p) => !OWN_PRODUCTS.includes(p)).reduce((sum, p) => sum + lacking(p), 0) : 0;
    const fit = toBuy > 0 ? Math.min(1, (warehouseCapacity(state) - warehouseCount(state)) / toBuy) : 1;
    for (const id of buyMode === 'smart' || buyMode === 'naive' ? sellable : []) {
      if (OWN_PRODUCTS.includes(id)) continue;
      if (buyMode === 'naive') {
        // Новичок: всего поровну, у первого же поставщика, у кого товар есть.
        const sid = SUPPLIER_IDS.find((x) => supplierOpen(SUPPLIERS[x], state.shelves) && unitPrice(SUPPLIERS[x], deals[x], id) !== null);
        if (!sid) continue;
        const price = unitPrice(SUPPLIERS[sid], deals[sid], id)!;
        const qty = Math.min(Math.max(0, NAIVE_STOCK - onShelves(state, id) - warehouseOf(state, id)), Math.floor(state.money / price), warehouseCapacity(state) - warehouseCount(state));
        if (qty <= 0) continue;
        const bad = badBatch(sid, state.day, random());
        state = buyStock(state, id, qty, price, bad) ?? state;
        if (bad) state = resolveBadBatch(state, id, 'markdown', price);
        purchases += qty * price;
        continue;
      }
      let qty = Math.ceil(lacking(id) * fit);
      // Самый дешёвый поставщик этого товара.
      const offers = SUPPLIER_IDS.map((sid) => ({ sid, price: unitPrice(SUPPLIERS[sid], deals[sid], id) })).filter(
        (o): o is { sid: (typeof SUPPLIER_IDS)[number]; price: number } => o.price !== null,
      );
      const best = offers.sort((a, b) => a.price - b.price)[0];
      if (!best) continue;
      qty = Math.min(qty, Math.floor(state.money / best.price), warehouseCapacity(state) - warehouseCount(state));
      if (qty <= 0) continue;
      const bad = badBatch(best.sid, state.day, random());
      state = buyStock(state, id, qty, best.price, bad) ?? state;
      if (bad) state = resolveBadBatch(state, id, 'markdown', best.price);
      purchases += qty * best.price;
    }
    // Под гостей, которых привели открытые кассы, — докупка на остаток места на складе, поровну по спросу
    // (жадно по списку — первые товары забили бы склад, а остальные полки пустовали).
    if (buyMode === 'smart' && laneGuests(state) > 1) {
      const allWants = guests * (AVG_WANTS + adBasket(state)) - ownWanted;
      const extra = sellable
        .filter((id) => !OWN_PRODUCTS.includes(id))
        .map((id) => {
          const offers = SUPPLIER_IDS.map((sid) => ({ sid, price: unitPrice(SUPPLIERS[sid], deals[sid], id) })).filter(
            (o): o is { sid: (typeof SUPPLIER_IDS)[number]; price: number } => o.price !== null,
          );
          const best = offers.sort((a, b) => a.price - b.price)[0];
          // Сколько не хватает до спроса всех гостей с учётом того, что уже есть на полках и складе.
          const demand = allWants * buyChance(state.prices[id], perceivedBase(state, id)) * (weight(id) / otherWeight);
          const want = demand * 1.1 - onShelves(state, id) - warehouseOf(state, id);
          return { id, best, want };
        })
        .filter((x) => x.best && x.want > 0);
      const total = extra.reduce((sum, x) => sum + x.want, 0);
      const share = Math.min(1, (warehouseCapacity(state) - warehouseCount(state)) / Math.max(1, total));
      for (const { id, best, want } of extra) {
        const qty = Math.min(Math.floor(want * share), Math.floor((state.money - reserve) / best!.price));
        if (qty <= 0) continue;
        const bad = badBatch(best!.sid, state.day, random());
        state = buyStock(state, id, qty, best!.price, bad) ?? state;
        if (bad) state = resolveBadBatch(state, id, 'markdown', best!.price);
        purchases += qty * best!.price;
      }
    }
    // Кафе по соседству забирает заказ, как только магазин открылся.
    const cafeRes = cafeDeliver(state);
    state = cafeRes.state;
    const cafeIncome = cafeRes.result?.pay ?? 0;
    state.shelves.forEach((_, i) => (state = moveToShelf(state, i).state));

    // ---------- День ----------
    const stats: DayStats = emptyDayStats();
    // Оплата кафе — тоже выручка дня (деньги уже зачислены при отгрузке).
    stats.revenue += cafeIncome;
    const dayGuests = Math.max(0, Math.round(guests * (0.85 + random() * 0.3)));
    // Один игрок не успевает всё: чем больше магазин, тем больше теряется без персонала.
    const has = (r: StaffRole) => Boolean(staffOf(state, r));
    let trips = tripsPerDay ? tripsPerDay(state.level) : has('loader') ? 60 : 3 + state.level;
    // С котом в очереди ждут дольше — уходят реже.
    const lossInQueue =
      (queueLoss ?? (hasCashier(state) ? 0.02 : 0.05 + 0.05 * state.level)) / catPatience(state) / climatePatience(state, weatherFor(state.day)) / charmPatience(state) / radioPatience(state) / signagePatience(state) / cartPatience(state);
    // Доставка на дом: звонки идут весь день, а здесь заказы забирают товар раньше покупателей
    // (осторожная оценка). Без менеджера и грузчика заказ собирает хозяин — это время не за кассой
    // (сменщик, если нанят, в это время стоит за его кассой).
    let packTime = 0;
    if (features.delivery && hasUpgrade(state, 'delivery')) {
      const delivery = deliveryDay(state, extraRandom);
      state = delivery.state;
      stats.revenue += delivery.pay;
      stats.deliveries = delivery.delivered;
      stats.deliveryPay = delivery.pay;
      stats.deliveryTips = delivery.tips;
      stats.deliveryMissed = delivery.missed;
      if (!has('manager') && !has('loader') && !has('cashier')) packTime = delivery.delivered * OWNER_PACK_SECONDS;
    }
    const capacity = serveCapacity(state);
    // Киоски пробивают только небольшие корзины: больше, чем таких гостей, они не возьмут.
    const kioskServe = Math.min(capacity.kiosk, Math.round(dayGuests * smallBasket(kioskTier(state).maxItems)));
    const serveCap = Math.max(0, capacity.total + kioskServe - Math.round(packTime / OWNER_SECONDS_PER_GUEST));
    // У киоска кто-то «забывает» пробить товар — доля таких чеков от всех.
    const kioskSkip = serveCap > 0 ? (kioskServe / serveCap) * kioskTier(state).skip : 0;
    // Грязь: уборщик, а ещё вход (грязь с улицы) и туалет (gear.ts); без уборщика мусор ещё и гниёт — пахнет (rot.ts).
    const dirtComplaint =
      (has('cleaner') ? 0.01 : 0.02 + 0.02 * state.level) * (0.6 + 0.2 * entranceMud(state) + 0.2 * wcDirt(state)) + simSmellComplaint(state.level, has('cleaner'));
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
    // Порция с кухни — после чека (иначе чек затёр бы убыль в витрине): по ней повар считает спрос, ночью списывают остаток.
    const dishExtra = (night: boolean): number => {
      const dish = features.kitchen && !night ? sellDish(state, extraRandom) : null;
      if (!dish) return 0;
      stats.dishWanted = (stats.dishWanted ?? 0) + 1;
      if (!dish.dish) return 0;
      state = { ...dish.state, money: dish.state.money + DISHES[dish.dish].price };
      stats.dishes = (stats.dishes ?? 0) + 1;
      return DISHES[dish.dish].price;
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
      // Автозаказ днём: разобрали, а на складе пусто — подвоз (фургон в симуляции приезжает сразу).
      if (!night && autoActive(state)) {
        const top = autoTopUp(state, (id) => stats.sold[id] ?? 0);
        if (top) {
          state = autoArrived(top.state, top.pid, top.qty);
          purchases += top.cost;
        }
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
      const wanted = pickWanted(state, random, (random() < AVG_WANTS - 1 ? 2 : 1) + adExtraItems(state, extraRandom), (p) => dayDemand(state, p, aroma));
      const fair = (p: ProductId) =>
        perceivedBase(state, p) * tolerance * fairTolerance(state.day) * loyaltyTolerance(state) * radioTolerance(state) * adTrust(state) * (aroma && p === 'bread' ? AROMA_TOLERANCE : 1);
      const cart: CartItem[] = [];
      let sawEmpty = false;
      // Чего не хватило — записываем в отчёт дня (по нему «Закупить нужное» и печь считают спрос).
      let emptyId: ProductId | undefined;
      let tooExpensive = false;
      for (const id of new Set(wanted)) {
        const index = shelfFor(state, id);
        const shelf = state.shelves[index];
        const oldest = shelf && !shelf.broken ? shelf.items[id]?.[0] : undefined;
        if (!oldest) {
          sawEmpty = true;
          emptyId ??= id;
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
        // Ночные гости рейтинг не роняют (как в игре): после дня полки полупустые — это норма.
        if ((sawEmpty || tooExpensive) && !night) {
          stats.lost++;
          noteLost(stats, sawEmpty ? 'empty' : 'expensive', sawEmpty ? emptyId : undefined);
        }
        continue;
      }
      if (random() < lossInQueue || stats.served >= cap) {
        state = returnToShelf(state, cart);
        if (!night) stats.lost++;
        continue;
      }
      // Непробитый на киоске товар уходит без оплаты (только из корзины в несколько штук, как в игре).
      if (cart.length > 1 && kioskSkip > 0 && extraRandom() < kioskSkip) {
        const lost = cart.pop()!;
        stats.stolen += unitSalePrice(state, lost.id, lost.unit);
      }
      // Сначала чек, потом шоколадка и стаканчик (extras списывает их из state): иначе чек затёр бы списание.
      const paid = checkout(state, cart, night ? NIGHT_MARKUP : 1);
      state = paid.state;
      const extra = extras(night) + (extraRandom() < catTipChance(state) ? CAT_TIP : 0);
      state = { ...state, money: state.money + extra };
      const dish = dishExtra(night);
      stats.revenue += paid.total + extra + dish;
      if (night) nightRevenue += paid.total + extra + dish;
      stats.served++;
      recordSale(stats, cart);
      if (hasUnmarkedBad(cart) && random() < BAD_COMPLAINT_CHANCE) stats.complaints++;
      if (random() < dirtComplaint) stats.complaints++;
    }
    };
    let nightRevenue = 0;
    // Повар готовит весь день: перед каждой четвертью дня ставит кастрюли — сколько успеет и сколько разберут.
    const chef = features.kitchen && kitchenWorking(state) ? staffOf(state, 'cook') : undefined;
    let cookRounds = chef ? cookRoundsPerDay(state, DAY_SECONDS, workSpeed(chef)) : 0;
    const perQuarter = Math.ceil(cookRounds / 4);
    const cookFor = (dayLeft: number) => {
      for (let r = 0; r < perQuarter && cookRounds > 0; r++) {
        // Кончились продукты — кухня докупает ровно на эту закладку.
        const plan = cookBatch(state, dayLeft, 0, undefined, true);
        if (!plan.length) break;
        const top = topUpKitchen(state, plan);
        state = top.state;
        purchases += top.spent;
        const batch = cookBatch(state, dayLeft);
        if (!batch.length) break;
        for (const id of batch) {
          const taken = takeIngredients(state, id);
          if (taken) state = servePortions(taken, id);
        }
        cookRounds--;
      }
    };
    // Гости части дня (от доли start, длиной share): с поваром — по четвертям, между ними он готовит.
    const dayPart = (count: number, start: number, share: number) => {
      const parts = chef ? Math.max(1, Math.round(share * 4)) : 1;
      let done = 0;
      for (let i = 0; i < parts; i++) {
        if (chef) cookFor(1 - start - (share * i) / parts);
        const n = Math.round((count * (i + 1)) / parts) - done;
        runGuests(n, 1, serveCap, false);
        done += n;
      }
    };
    if (hasUpgrade(state, 'eTags')) {
      // Электронные ценники: к вечеру то, что испортится ночью, уценяется само.
      const evening = Math.round(dayGuests * ETAGS_EVENING);
      dayPart(dayGuests - evening, 0, 1 - ETAGS_EVENING);
      state = markdownSurplus(state, (id) => eveningSales(stats.sold[id] ?? 0)).state;
      dayPart(evening, 1 - ETAGS_EVENING, ETAGS_EVENING);
    } else dayPart(dayGuests, 0, 1);
    // Ночная смена: гостей меньше, к ценам терпимее, касса успевает пропорционально времени.
    let nightProfit = 0;
    if (features.night && hasUpgrade(state, 'nightShift')) {
      const paid = startNight(state);
      if (paid) {
        state = paid;
        const before = stats.served;
        const nightGuests = Math.round(((guests * NIGHT_SECONDS) / DAY_SECONDS) * NIGHT_GUESTS * (0.85 + random() * 0.3));
        runGuests(nightGuests, NIGHT_TOLERANCE, before + Math.floor((serveCap * NIGHT_SECONDS) / DAY_SECONDS), true);
        // Ночная история (nightGuests.ts): соглашается; товар студенту в долг — как продажа в минус.
        const story = nightStory(extraRandom);
        if (story) {
          const avgCheck = stats.served ? stats.revenue / stats.served : 100;
          const answered = answerNightStory(state, story, true, avgCheck);
          state = answered.state;
          nightRevenue += answered.money;
        }
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

    // Активные моменты дня (moments.ts): пойманные — чаевые сразу в кассу, искорки к рейтингу вечером.
    // Своя случайность: остальные события дня от моментов не сдвигаются.
    const moments = simMoments(state, rng(seed * 7919 + state.day * 104729), momentCatch);
    state = { ...state, money: state.money + moments.money };
    stats.momentsShown = moments.shown;
    stats.moments = moments.caught;
    stats.momentStars = moments.stars;

    // ---------- Ночь ----------
    // Навык кассы растёт у хозяина: его доля пробитых (за первой кассой он всегда сам).
    const byOwner = serveCap > 0 ? Math.min(capacity.owner, Math.round((stats.served * capacity.owner) / serveCap)) : 0;
    state = { ...state, ownerServed: state.ownerServed + byOwner };
    state = recordDay(state, stats);
    stats.adGuests = adGuests(state, stats.served + stats.lost);
    const night = nightCycle(state, stats, random);
    const before = night.state;
    state = night.state;
    const news = before.security?.news;
    if (news && news.day === state.day && !news.seen) {
      const goods = news.goods.reduce((sum, g) => sum + g.n * PRODUCTS[g.id].cost, 0);
      burglaries.push({ day: state.day, outcome: news.outcome, loss: goods + news.cash + news.repair - news.bounty });
      state = { ...state, security: { ...state.security, news: { ...news, seen: true } } };
    }
    if (state.giant && state.giant.phase !== giantLog[giantLog.length - 1]?.phase) giantLog.push({ day: state.day, phase: state.giant.phase });
    const contest = state.contest;
    if (contest?.last && contest.phase === 'wait' && contest.since === state.day) contests.push({ day: state.day, tier: contest.last.tier, won: contest.last.won });
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
      branch: night.branch,
      ads: adSpent,
      quests: night.quests.earned,
    });
    void moneyStart;
  }
  setBigDaySeed(bigDaySeedBefore);
  return { days: out, levelDay, chapterDay, rescueDay, bankruptDay, burglaries, giant: giantLog, contests, final: state };
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
