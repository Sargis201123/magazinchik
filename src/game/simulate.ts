// Симулятор экономики: «разумный игрок» играет много дней по тем же правилам, что и игра.
// Нужен для баланса: на какой день игрок расширяет магазин, сколько зарабатывает, где застревает.
// Запуск: npm run sim

import { noThieves } from './firstday';
import { ownerCatch } from './thiefTells';
import { grantPets, petItem, type PetId } from './pets';
import { noteLost } from './losses';
import { isBroke } from './tips';
import { loanOptions, takeLoan } from './bank';
import { cook, cookBatch, cookRoundsPerDay, DISHES, DISH_IDS, kitchenWorking, morningCook, sellDish, servePortions, stockKitchen, takeIngredients, topUpKitchen } from './kitchen';
import { answerStaffEvent, eventCost } from './staffEvents';
import { answerCeremony, answerOffer, bestBonus } from './career';
import { answerTale, taleToday } from './tales';
import { dreamNews, investDream, seeDream, skipDream } from './dreams';
import { answerArc, arcDeliver, arcToday } from './arcs';
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
  guardCatchChance,
  hire,
  staffLimit,
  staffOf,
  roleOpen,
  thiefChance,
  type StaffRole,
  type StoreState,
  workSpeed,
  DAY_SECONDS,
  recordSale,
} from './economy';
import { activeAds, AD_IDS, adBasket, adBlock, adExtraItems, adGuests, adPrice, adTrust, buyAd, type AdId } from './ads';
import { actualGuestsToday, ensurePlan, guestsToday, inspectionDone, nightCycle } from './day';
import { buyZar, homeShop, inZar, switchToday, ZAR_MAX_LEVEL, ZAR_PRICE } from './zarechye';
import { canStock, restockPlan } from './restock';
import { addBed, bedsOf, buildGarden, GARDEN_PRICE, harvest, nextBedCost, plant, type CropId } from './garden';
import { freeRooms, giveTenant, invitePitch, rentRoom, TENANT_IDS, TENANTS, tenantAsks, tenantsOf, upgradeCost as tenantUpCost, upgradeTenant } from './tenants';
import { pawnOffer, refusePawn, takePawn } from './pawnshop';
import { buyLine } from './reorder';
import { bigDaySeed, setBigDaySeed } from './bigday';
import { autoActive, autoArrived, autoMorning, autoTopUp, autoAvailable, autoToggle } from './autoorder';
import { answerEvent, inspect, answerOrder } from './events';
import { candidatesFor, train, trainingStep } from './staff';
import { CHAPTERS, finishChapter, finishIntro, pendingStory } from './story';
import { rng } from './random';
import { hallCap } from './hall';
import { perceivedBase, pickWanted, seasonFor } from './endless';
import { badBatch, SUPPLIER_IDS, SUPPLIERS, supplierOpen, listPrice, priceFor } from './suppliers';
import { buyUpgrade, carryOf, eveningSales, hasUpgrade, LOYALTY_TOLERANCE, loyaltyTolerance, staffCarry, UPGRADES, type UpgradeId, MARKDOWN_EVENING } from './upgrades';
import { CARRY, homemade } from './economy';
import { fairToday, fairTodayTolerance, STALL_MAX, stallSale } from './fair';
import { endSale, SALE_CROWD, saleExtraItems, startSale, weekFor } from './weeks';
import { buyRegister, cashierCount, isCashierRole, nextCashierRole, nextRegisterPrice, registerCount, registerOfRole } from './registers';
import { CANDY_PRICE, impulseChance, nextRack, refillRack, takeCandy, upgradeRack } from './impulse';
import { buyCups, coffeeChance, useCup } from './coffee';
import { buyLottery, countTicket, hasLottery, LOTTERY_PRICE, ticketChance, TICKET_CUT } from './lottery';
import { simSmellComplaint } from './rot';
import { brewSeconds, cameraTheft, coffeePrice, entranceMud, fridgeLeak, gearAvailable, MANUAL_GEAR, nextGear, ovenBatch, ovenBatchCost, upgradeGear, wcDirt } from './gear';
import { AROMA_SECONDS, AROMA_TOLERANCE, bakerShouldBake, bakeryWorking, sellWholesale, startBatch, takeOutBread, wholesaleToBake } from './bakery';
import { NIGHT_GUESTS, NIGHT_MARKUP, NIGHT_SECONDS, NIGHT_TOLERANCE, startNight } from './night';
import { adoptCat, buyBed, CAT_BED_IDS, CAT_BEDS, CAT_TIP, catOffer, catPatience, catTipChance, feedCat } from './cat';
import { APPR_SKILLS, APPR_TIP, apprOffer, apprPatience, apprStockPace, apprTipChance, praiseAppr, setApprPost, takeAppr, TIRED_FROM } from './apprentice';
import { answerWar, warLeaves, type WarAnswer } from './war';
import { dayDemand } from './demand';
import { buyLicense, hasLicense, LICENSE_PRICE, licenseLock } from './license';
import { answerGrey, greyCover, greyOffer } from './grey';
import { recordDay } from './achievements';
import { answerCafe, cafeDeliver } from './cafe';
import { answerRaise, chooseRacket, racketAsk, type RacketMode } from './racket';
import { echoesOf } from './echoes';
import { buyLot, lease, LOT_PRICES, lotOf, SHOP_KINDS, SHOPS, shopIn } from './estate';
import { chooseGent, gentAsk, type GentChoice } from './gentrify';
import { chooseCrisis, crisisAsk, crisisExtraItems, crisisGive, crisisTolerance, type CrisisMode } from './crisis';
import { deliveryDay } from './delivery';
import { buyLineTier, LINE_IDS, LINES, lineLock, lineUnitCost, nextLineCost, type LineId } from './lines';
import { BRAND_BATCH, brandAvailable, brandToBake, buyBrandLevel, nextBrandCost, startBrandBatch } from './brand';
import { buyRadio, hasRadio, radioPatience, RADIO_PRICE, radioTolerance, setStation } from './radio';
import { buyKiosk, kioskCount, kioskTier, laneGuests, nextKioskPrice, nextKioskTier, upgradeKiosks } from './lanes';
import { BRANCH_PRICE, BRANCH_TRACK_IDS, branchGain, branchOpen, buyBranch, nextBranchTier, upgradeBranch } from './branch';
import { buyHood, HOOD, nextHood } from './hood';
import { simMoments } from './moments';
import { carryBonus, eyeTheft } from './owner';
import { buyStand, ITEM_COST, RENTAL_CAP, rentalOf, restockRental, STAND_COST } from './rental';
import { buyFloor, finishCost, finishFloor, floorAvailable, FLOORS, hasFloor } from './floors';
import { basementOf, buyPart, buySlot, PARTS, SLOT_COST, slotPlaces } from './basement';
import { batchCost, buyBatch, clothesOf, freePlaces, setClerk, setSale } from './clothes';
import { answerInspection, answerParty, inspectionToday, openStall, ownAllowed, partyToday, setStallMode, stallLock, stallMode, stallPlaces, stallsOf, STALL_IDS, STALLS } from './foodcourt';
import { autoCapacity, CREDIT_MAX, QUICK_PATIENCE, quickPick, serveCapacity, smallBasket } from './traffic';
import { levelPace, loaderPace, shelfToFill, tripSeconds } from './loader';
import { buyVan, loadVan, planTrip, vanEvents, vanFuel, vanOpen, vanPrice, vanWant, VAN_EVENTS, VAN_PRICE } from './van';

export { rng };

export interface SimDay {
  day: number;
  level: number;
  money: number;
  debt: number;
  rating: number;
  guests: number;
  /** Сколько гостей звали рейтинг, реклама и прочее (до предела зала). */
  wanted: number;
  served: number;
  lost: number;
  /** Из обслуженных — гости «на бегу» (traffic.ts, только с hall): зал полон, пробили кассы без хозяина. */
  quick: number;
  /** Ушли ни с чем у пустой полки (в зале и «на бегу»). */
  empty: number;
  /** Ходки со склада на полки за день: грузчик и ученик (loader.ts), а без грузчика — хозяин. */
  trips: number;
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
  /** Работали в Заречье (zarechye.ts) и сколько принёс за день Центр без игрока. */
  zar: boolean;
  home: number;
  /** Постоянные расходы сегодняшнего магазина на день: аренда, вода, свет, зарплаты — месячные ÷ 7 (для окупаемости помещений). */
  fixed: number;
  /** Сколько потрачено на рекламу сегодня. */
  ads: number;
  /** Своя марка на полках (lines.ts): выручка за проданное минус сырьё и банки (по себестоимости штуки). */
  lines: number;
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
  /** Смены фаз «Гиганта» и итоги конкурсов — по дням. */
  giant: { day: number; phase: string }[];
  contests: { day: number; tier: number; won: boolean }[];
  /** Заречье: в какой день открыли и на какой день достигнуто каждое помещение там (индекс = уровень). */
  zarLevelDay: (number | null)[];
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
  /** С features.lines: какие линейки своей марки открывать (по умолчанию — все; замер одной — для окупаемости). */
  lineIds?: LineId[];
  /** Питомец за звёзды в зале с первого дня (pets.ts): только для проверки, что он ничего не меняет. */
  pet?: PetId;
  /** Как отвечать на ценовую войну. */
  war?: WarAnswer;
  /** Как вести себя в беду района (crisis.ts): по умолчанию — держать обычные цены. */
  crisis?: CrisisMode;
  /** Как ответить «крыше» (racket.ts): по умолчанию — отказать (две недели пакостей, потом тихо). */
  racket?: RacketMode;
  /** С features.gentrify: как ответить, когда район подорожал (gentrify.ts): по умолчанию — «для новых». */
  gentrify?: GentChoice;
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
  /**
   * Заречье (zarechye.ts): с какого дня игрок готов его открыть (как только Центр — гипермаркет и денег
   * хватает; финал в симуляторе не обязателен — иначе до Заречья не дожить) и в какие дни там работает:
   * every = 2 — через день, 1 — каждый день.
   */
  zar?: { from: number; every: number; cap?: number };
  /**
   * «Трафик v2» (hall.ts, traffic.ts): зал пропускает за день hallCap гостей, остальные берут своё «на бегу» (1–2 товара,
   * пустая полка — похожее) и идут к кассам без хозяина — сменщик, кассиры, киоски (autoCapacity); кому не хватило
   * касс — уходят. Без таких касс лишние проходят мимо. Ночью потока нет — ночных гостей тоже держит зал.
   * Закупка — на тех, кого пробьют (зал + кассы без хозяина), а не на всех позванных.
   * По умолчанию выключен: на прогонах без предела зала откалиброваны проверки баланса (tests/balance*).
   */
  hall?: boolean;
  /** Каждое утро до решений игрока — посмотреть состояние (scripts/decisions.ts считает, что видит игрок). */
  onMorning?: (state: StoreState) => void;
}

export type Feature =
  | 'candy'
  | 'coffee'
  | 'oven'
  | 'night'
  | 'cat'
  | 'loyalty'
  | 'gear'
  | 'departments'
  | 'radio'
  | 'brand'
  // Линейки своей марки (lines.ts): открывает и улучшает, когда есть запас и не копит на помещение.
  | 'lines'
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
  | 'hood'
  // Карьера сотрудников (career.ts): награждает «сотрудника месяца», повышает (ступень обучения) и ставит на филиал.
  | 'career'
  // Арендаторы флигеля (tenants.ts): сдаёт комнаты (самые выгодные — первыми), отделывает второй раз, зовёт сезонного
  // торговца и носит арендаторам, что просят.
  | 'tenants'
  // Бабушкин двор (garden.ts): ставит теплицу, докапывает грядки, сажает «яблоки и картошку» и собирает урожай
  // каждое утро — прямо на овощной прилавок.
  | 'garden'
  // Лицензия на пиво и сигареты (license.ts): покупает, когда есть запас и не копит на расширение. Подросткам
  // не продаёт (особых гостей симулятор не водит) — нарушений нет, проверки проходят чисто.
  | 'license'
  // Ломбард (pawnshop.ts): берёт вещь у гостя со спокойной приметой, если в кассе с запасом; суетливым отказывает.
  | 'pawn'
  // Прокат у входа (rental.ts, 13.11): ставит стойку, когда не копит на помещение, и каждое утро докупает пропавшее;
  // залог — средний (по умолчанию).
  | 'rental'
  // Лотерея у кассы (lottery.ts): ставит стойку, когда есть запас; тираж и запреты — в nightCycle, как в игре.
  | 'lottery'
  // Выездная торговля (van.ts): покупает фургон, в дни событий докупает под выезд что там берут и грузит кузов.
  | 'van'
  // Ученик (apprentice.ts): берёт, когда просится; ставит по кругу на кассу, склад и в зал, раз в неделю —
  // выходной, стипендию платит, хвалит, когда можно (так выпускник — друг).
  | 'apprentice'
  // Серая схема (grey.ts): соглашается на всё, что предлагает Жора, — сколько это стоит в итоге (штрафы, опечатанные
  // дни, доброе имя). Эхо (отравление, месть) симулятор не разбирает — как и эхо сценок.
  | 'grey'
  // Подвал (floors.ts, basement.ts, 13.11): открывает, когда не копит на помещение, ставит склад-холодильник
  // (и подсобку, если ведёт ломбард), потом автоматы — до мест в подвале, ремонт — когда два уже стоят.
  // Облавы и уход мам с детьми — в nightCycle и гостях дня, как в игре.
  | 'basement'
  // Второй этаж — одежда (floors.ts, clothes.ts, 13.11): открывает, когда не копит на помещение; каждое утро
  // докупает партии текущей коллекции до полных стоек, остатки прошлого сезона всегда распродаёт, продавца
  // нанимает с универмага (там гостей хватает, чтобы он окупался), ремонт — когда стойки полны.
  | 'clothes'
  // Район дорожает (gentrify.ts, 13.11): престиж растёт сам, на выбор утром отвечает как в SimOptions.gentrify.
  // Без этой механики престиж в прогоне не копится: на прежних прогонах откалиброван баланс (аренда и прайс — как были).
  | 'gentrify'
  // Фудкорт на третьем этаже (floors.ts, foodcourt.ts, 13.11): открывает этаж, когда не копит на помещение, точки —
  // по одной, своей точку ведёт, только если повар на смене (иначе сдаёт); ремонт — когда места кончились. Праздник
  // берёт, если товар есть; на жалобу — наводит порядок. Третий стоит на втором: без него сначала открывает второй.
  | 'foodcourt'
  // Улица (estate.ts, 13.11): помещения на задней улице из лишних денег — после района (с features.hood), арендатор —
  // кто платит больше всех.
  | 'estate';

/** В каком порядке разумный игрок докупает полки. */
const SHELF_PRIORITY: Category[] = ['dairy', 'meat', 'produce', 'bakery', 'dairy', 'produce', 'meat', 'bakery', 'produce', 'dairy', 'meat', 'bakery', 'produce', 'dairy', 'meat', 'produce', 'bakery'];
/** С новыми отделами: напитки, заморозка и химия — как только помещение позволяет. */
const SHELF_PRIORITY_DEPTS: Category[] = ['dairy', 'meat', 'drinks', 'produce', 'frozen', 'bakery', 'household', 'dairy', 'produce', 'meat', 'drinks', 'frozen', 'bakery', 'household', 'dairy', 'produce', 'meat'];

const AVG_WANTS = 1.5;
/** Двор в симуляторе: игрок заходит раз в день, утром; время двора — по игровым дням. */
const DAY_MS = 86_400_000;
const SIM_CROP: CropId = 'mix';
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
/** Хозяин собирает заказ на дом: сходить на склад, уложить коробку, вынести курьеру. */
const OWNER_PACK_SECONDS = 8;
/** Столько секунд кассы в среднем уходит на одного покупателя у хозяина (для «пока собирал заказ»). */
const OWNER_SECONDS_PER_GUEST = 2.5;

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
  crisis = 'hold',
  racket = 'refuse',
  gentrify = 'rich',
  ovenBatches = 3,
  ovenBurn = 0.1,
  adAlways,
  momentCatch = 0,
  lineIds = LINE_IDS,
  pet,
  zar,
  onMorning,
  hall = false,
}: SimOptions): SimResult {
  const random = rng(seed);
  // Случайности новых механик — отдельно: тогда прогоны с механикой и без идут по одним и тем же
  // событиям дня, и разницу видно точно, а не сквозь шум.
  const extraRandom = rng(seed * 7919 + 1);
  // Своё расписание особых дней на каждый прогон — как в игре у каждого магазина своё (StoreScene, setBigDaySeed);
  // после прогона — прежнее зерно.
  const bigDaySeedBefore = bigDaySeed();
  setBigDaySeed(seed);
  // Зерно магазина — своё на каждый прогон, как в игре (StoreScene). 14.11, аудит: без него все броски
  // `state.seed ?? 1` (крыша, Жора, лотерея, подвал…) шли по одному расписанию — «40 прогонов» были одним.
  // Хеш, а не сам seed: тесты с зашитыми маленькими зёрнами (3, 5, 7) не совпадают с прогонами.
  let state = ensurePlan({ ...newGame(), seed: 1 + ((Math.imul(seed, 0x9e3779b1) >>> 0) % 1_000_000_000) });
  if (pet) state = grantPets(state, [petItem(pet)]);
  for (const id of PRODUCT_IDS) state = setPrice(state, id, Math.round((PRODUCTS[id].basePrice * priceMult) / 5) * 5);
  const out: SimDay[] = [];
  // Гипермаркет — отдельная механика: с одним филиалом «разумный игрок» туда не переезжает и на него не копит.
  const nextFor = (s: StoreState) => (s.level + 1 === HYPER_LEVEL && !features.hyper ? undefined : nextStoreLevel(s));
  const levelDay: (number | null)[] = STORE_LEVELS.map((_, i) => (i === 0 ? 1 : null));
  let rescueDay: number | null = null;
  let bankruptDay: number | null = null;
  const chapterDay: (number | null)[] = [...CHAPTERS, null].map((_, i) => (i === 0 ? 1 : null));
  const giantLog: SimResult['giant'] = [];
  const contests: SimResult['contests'] = [];
  const zarLevelDay: (number | null)[] = Array.from({ length: ZAR_MAX_LEVEL + 1 }, () => null);

  for (let d = 0; d < days; d++) {
    onMorning?.(state);
    const moneyStart = state.money;
    let investments = 0;
    let adSpent = 0;
    // ---------- Утро: Заречье ----------
    if (zar) {
      if (!state.zar && state.day >= zar.from && homeShop(state).level >= HYPER_LEVEL && state.money >= ZAR_PRICE * 1.5) {
        const opened = buyZar(state, true);
        if (opened) {
          investments += ZAR_PRICE;
          state = opened;
          zarLevelDay[0] = state.day;
        }
      }
      if (state.zar) state = switchToday(state, (state.day - state.zar.since) % zar.every === 0 ? 'zar' : 'home');
    }
    // Запас на закупку плюс копилка на счета в конце месяца.
    const bill = billTotal(monthlyBill(state));
    const reserve = 150 + 100 * state.level + Math.round(bill * (1 - daysUntilBill(state.day) / MONTH_DAYS));

    // ---------- Утро: долг, расширение, полки ----------
    // Касса пуста и товара нет — берёт кредит на закупку (как советует подсказка).
    if (isBroke(state)) state = takeLoan(state, loanOptions(state)[0]) ?? state;
    if (state.debt > 0 && state.money - state.debt >= reserve) state = payDebt(state, state.debt) ?? state;

    const next = zar?.cap !== undefined && inZar(state) && state.level >= zar.cap ? undefined : nextFor(state);
    // Расширяется, только если после стройки останется на ближайший счёт — так же, как предупреждает
    // утро (morning.ts): первый счёт после переезда — по старой аренде («новоселье»).
    const nextBill = next ? billTotal(monthlyBill({ ...state, level: state.level + 1, movedFrom: state.movedFrom ?? state.level })) : 0;
    if (next && state.money >= next.cost + Math.max(reserve, nextBill)) {
      const expanded = expandStore(state);
      if (expanded) {
        investments += next.cost;
        state = expanded;
        if (inZar(state)) zarLevelDay[state.level] ??= state.day;
        else levelDay[state.level] = state.day;
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
      state = answerEvent(state, true) ?? answerEvent(state, false) ?? state;
    }
    // Доска «Заказы» (orders.ts): заказ клиента берём, если товар сейчас продаётся, — под него докупим в закупке ниже.
    const offer = state.plan?.offer;
    if (offer) state = answerOrder(state, sellableProducts(state).includes(offer.product)) ?? state;

    // Кафе по соседству: договор на неделю — соглашаемся (и докупаем под него товар ниже).
    if (features.cafe && state.cafe?.offer) state = answerCafe(state, state.money > reserve * 3);
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
      ['loyalty', 'loyalty'],
      ['oven', 'wholesale'],
      ['coffee', 'coffeeTables'],
      ['kitchen', 'kitchen'],
      ['delivery', 'delivery'],
    ];
    // Дорогое «для удобства» (ночная смена, новые модели) разумный игрок берёт, когда уже не копит на расширение.
    const nextLevel = nextFor(state);
    const canSplurge = (price: number) => !nextLevel || state.money - price >= nextLevel.cost + reserve;
    // «Закупать сам» (бесплатно): включает, как только переключатель появился.
    if (buyMode === 'auto' && !autoActive(state) && autoAvailable(state)) state = autoToggle(state);
    for (const [feature, id] of wants) {
      if (!features[feature] || hasUpgrade(state, id) || state.money < UPGRADES[id].price + reserve) continue;
      if ((id === 'nightShift' || id === 'coffeeTables' || id === 'kitchen') && !canSplurge(UPGRADES[id].price)) continue;
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
    // Новые модели оборудования — когда хватает денег с запасом и не копит на расширение. Покупает только
    // четыре ручные линейки: остальное встаёт само с помещением (gear.ts).
    if (features.gear) {
      for (const id of MANUAL_GEAR) {
        const next = nextGear(state, id);
        if (!next || !gearAvailable(state, id) || state.money < next.price + reserve * 2 || !canSplurge(next.price)) continue;
        investments += next.price;
        state = upgradeGear(state, id) ?? state;
      }
    }
    // Своя марка: рецепты «От бабушки» — когда есть запас (лучшая печь встаёт сама в третьем помещении, gear.ts).
    if (features.brand && hasUpgrade(state, 'oven')) {
      const cost = nextBrandCost(state);
      if (cost !== null && brandAvailable(state) && state.money >= cost + reserve * 2) {
        investments += cost;
        state = buyBrandLevel(state) ?? state;
      }
    }
    // Своя марка на полках: по одной ступени за день — самую дешёвую из доступных, с запасом.
    if (features.lines) {
      const next = lineIds.filter((id) => !lineLock(state, id) && nextLineCost(state, id) !== null).sort((a, b) => nextLineCost(state, a)! - nextLineCost(state, b)!)[0];
      const cost = next && nextLineCost(state, next);
      if (next && cost && state.money >= cost + reserve * 2 && canSplurge(cost)) {
        investments += cost;
        state = buyLineTier(state, next) ?? state;
      }
    }
    if (features.license && !hasLicense(state) && !licenseLock(state) && state.money >= LICENSE_PRICE + reserve * 2 && canSplurge(LICENSE_PRICE)) {
      investments += LICENSE_PRICE;
      state = buyLicense(state) ?? state;
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
    // Улица (estate.ts): помещения — из лишних денег, когда район благоустроен (или им не занимается) и не копит
    // на помещение; в купленное пускает того, кто платит больше всех. 14.11, аудит: без этого прогон «со всем»
    // копил деньги, которые в игре уходят на улицу.
    if (features.estate && (!features.hood || !nextHood(state))) {
      const lot = LOT_PRICES.findIndex((_, i) => !lotOf(state, i));
      const saving = nextFor(state)?.cost ?? 0;
      if (lot >= 0 && state.money >= LOT_PRICES[lot] + saving + reserve * 3) {
        const bought = buyLot(state, lot);
        if (bought) {
          investments += LOT_PRICES[lot];
          state = bought;
        }
      }
      LOT_PRICES.forEach((_, i) => {
        const kind = lotOf(state, i) && !shopIn(state, i) && [...SHOP_KINDS].sort((a, b) => SHOPS[b].rent - SHOPS[a].rent).find((k) => !LOT_PRICES.some((__, j) => shopIn(state, j) === k));
        if (kind) state = lease(state, i, kind) ?? state;
      });
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
    if (features.apprentice) {
      if (apprOffer(state)) state = takeAppr(state);
      const a = state.appr;
      if (a) {
        state = setApprPost(state, (a.worked ?? 0) + 1 >= TIRED_FROM ? 'rest' : APPR_SKILLS[state.day % APPR_SKILLS.length]) ?? state;
        state = praiseAppr(state) ?? state;
      }
    }
    if (features.grey && greyOffer(state)) state = answerGrey(state, true) ?? state;
    // Район подорожал: для кого магазин — как решено для прогона.
    if (features.gentrify && gentAsk(state)) state = chooseGent(state, gentrify) ?? state;
    // Бобика симулятор не берёт: ночных воров больше нет (02.11), днём он только помогает поймать воришку.
    if (features.candy) {
      const next = nextRack(state);
      if (next && state.money >= next.cost + reserve * 2) {
        investments += next.cost;
        state = upgradeRack(state) ?? state;
      }
      state = refillRack(state, 999) ?? state;
    }
    if (features.lottery && !hasLottery(state) && state.money >= LOTTERY_PRICE + reserve * 2) {
      const bought = buyLottery(state);
      if (bought) {
        investments += LOTTERY_PRICE;
        state = bought;
      }
    }
    if (features.coffee && hasUpgrade(state, 'coffee')) state = buyCups(state, 999) ?? state;
    // Кухня без повара: утром по закладке каждого блюда, на что хватает продуктов (с поваром — днём, ниже).
    if (features.kitchen && !kitchenWorking(state)) for (const id of DISH_IDS) state = cook(state, id) ?? state;
    // «Чёрная пятница района» — каждые 6-й и 7-й дни недели (как суббота и воскресенье).
    state = { ...state, rush: (features.rush && state.day % 7 >= 5) || undefined };
    // Просьбы сотрудников и истории покупателей: соглашается, если деньги есть с запасом.
    // Карьера: премия лучшему, если деньги есть с запасом (иначе выходной), повышения — да.
    if (features.career && state.career?.ceremony) state = answerCeremony(state, state.money >= bestBonus(state) + reserve * 2 ? 'cash' : 'gift') ?? state;
    if (features.career && state.career?.offer) state = answerOffer(state, true);
    // Повышение — ступень обучения (staff.ts): как только хватает смен и денег с запасом.
    if (features.career) {
      for (const m of state.staff) {
        const step = trainingStep(m, state.day);
        if (step?.kind === 'rank' && !step.xpLeft && state.money >= step.cost + reserve * 2) state = train(state, m.role) ?? state;
      }
    }
    if (state.staffEvent) state = answerStaffEvent(state, state.money >= eventCost(state.staffEvent) + reserve * 2) ?? answerStaffEvent(state, false) ?? state;
    if (taleToday(state)) state = answerTale(state, 0) ?? answerTale(state, 1) ?? state;
    // Мечта соседа (dreams.ts): вкладывается, если хватает с запасом и не копит на помещение; новость — читает.
    const dream = dreamNews(state);
    if (dream?.kind === 'ask') state = (canSplurge(dream.sum) && state.money >= dream.sum + reserve * 3 ? investDream(state, dream.id) : null) ?? skipDream(state, dream.id);
    else if (dream) state = seeDream(state) ?? state;
    if (arcToday(state)) state = answerArc(state, 0) ?? answerArc(state, 1) ?? answerArc(state, 2) ?? state;
    // Открылось здание в районе — поздравляет, если деньги есть с запасом и не копит на расширение.
    // Козни конкурента: отвечает, если деньги есть с запасом и не копит на расширение; иначе жалуется (или молчит).
    const trick = trickToday(state);
    if (trick) {
      const saving = nextFor(state);
      const afford = state.money >= counterCost(trick.kind, state.level) + reserve * 2 + (saving ? saving.cost : 0);
      state = answerTrick(state, afford ? 'counter' : trick.kind === 'banner' ? 'ignore' : 'complain', extraRandom) ?? answerTrick(state, 'ignore') ?? state;
    }
    // Беда района: как решено для прогона (по умолчанию держит цены).
    if (crisisAsk(state)) state = chooseCrisis(state, crisis) ?? state;
    // «Крыша»: как решено для прогона (в полиции дело без игрока уходит в архив — значит, пакости).
    if (racketAsk(state)) state = chooseRacket(state, racket) ?? state;
    // 14.11, аудит: платящий соглашается и на «поднимаем ставку» — иначе прогон всю игру платил стартовую долю.
    if (racket === 'pay' && echoesOf(state).list.some((e) => e.id === 'racketRaise' && e.due <= state.day)) state = answerRaise(state, 'racketRaise', 0) ?? state;
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

    // ---------- Утро: двор и флигель ----------
    if (features.garden) {
      const now = state.day * DAY_MS;
      const built = buildGarden(state, now);
      if (built) {
        state = built;
        investments += GARDEN_PRICE;
      }
      const bedCost = nextBedCost(state);
      if (bedCost !== null && state.money >= bedCost * 2 + reserve && canSplurge(bedCost)) {
        const dug = addBed(state, now);
        if (dug) {
          state = dug;
          investments += bedCost;
        }
      }
      // Новая грядка вскопана под картошку — пересаживает под «яблоки и картошку» (за один заход в день с неё больше всего,
      // а два вида делят прилавок).
      bedsOf(state).forEach((bed, i) => {
        if (bed.crop !== SIM_CROP) state = plant(state, i, SIM_CROP, now) ?? state;
      });
      state = harvest(state, now)?.state ?? state;
    }
    if (features.tenants) {
      const best = [...TENANT_IDS].sort((a, b) => TENANTS[b].rent / TENANTS[b].setup - TENANTS[a].rent / TENANTS[a].setup);
      for (const id of best) {
        if (freeRooms(state) <= 0) break;
        if (state.money < TENANTS[id].setup * 2 + reserve) continue;
        const rented = rentRoom(state, id);
        if (rented) {
          state = rented;
          investments += TENANTS[id].setup;
        }
      }
      for (const id of tenantsOf(state)) {
        const cost = tenantUpCost(id);
        if (state.money < cost * 3 + reserve || !canSplurge(cost)) continue;
        const up = upgradeTenant(state, id);
        if (up) {
          state = up;
          investments += cost;
        }
      }
      state = invitePitch(state) ?? state;
      for (const ask of tenantAsks(state)) state = giveTenant(state, ask.id)?.state ?? state;
    }
    if (features.pawn) {
      const offer = pawnOffer(state);
      if (offer) state = (offer.tell === 'calm' && state.money >= offer.lent + reserve * 2 ? takePawn(state) : null) ?? refusePawn(state);
    }
    if (features.basement) {
      const spend = (price: number, next: StoreState | null): void => {
        if (!next || state.money < price * 2 + reserve || !canSplurge(price)) return;
        state = next;
        investments += price;
      };
      if (floorAvailable(state, 'basement')) spend(FLOORS.basement.cost, buyFloor(state, 'basement'));
      if (hasFloor(state, 'basement')) {
        const parts = basementOf(state)?.parts ?? [];
        if (!parts.includes('cold')) spend(PARTS.cold.cost, buyPart(state, 'cold'));
        else if (features.pawn && !parts.includes('back')) spend(PARTS.back.cost, buyPart(state, 'back'));
        const slots = basementOf(state)?.slots ?? 0;
        const fin = finishCost(state, 'basement');
        if (slots < slotPlaces(state)) spend(SLOT_COST, buySlot(state));
        else if (fin !== null) spend(fin, finishFloor(state, 'basement'));
      }
    }
    if (features.clothes) {
      const spend = (price: number, next: StoreState | null): void => {
        if (!next || state.money < price * 2 + reserve || !canSplurge(price)) return;
        state = next;
        investments += price;
      };
      if (floorAvailable(state, 'second')) spend(FLOORS.second.cost, buyFloor(state, 'second'));
      if (clothesOf(state)) {
        state = setSale(state, true) ?? state;
        if (state.level >= 4) state = setClerk(state, true) ?? state;
        for (let k = 0; k < 6 && freePlaces(state) > 0 && state.money >= batchCost(state) + reserve; k++) state = buyBatch(state) ?? state;
        const fin = finishCost(state, 'second');
        if (fin !== null && !freePlaces(state)) spend(fin, finishFloor(state, 'second'));
      }
    }
    if (features.foodcourt) {
      const spend = (price: number, next: StoreState | null): void => {
        if (!next || state.money < price * 2 + reserve || !canSplurge(price)) return;
        state = next;
        investments += price;
      };
      // Третий этаж стоит на втором (FLOORS.third.needs): без одежды второй открывают пустым — как проход наверх.
      if (floorAvailable(state, 'second')) spend(FLOORS.second.cost, buyFloor(state, 'second'));
      if (floorAvailable(state, 'third')) spend(FLOORS.third.cost, buyFloor(state, 'third'));
      if (hasFloor(state, 'third')) {
        const mode = ownAllowed(state) && staffOf(state, 'cook') ? 'own' : 'rent';
        const next = STALL_IDS.find((id) => stallLock(state, id) === null);
        const fin = finishCost(state, 'third');
        if (next) spend(STALLS[next].setup, openStall(state, next, mode));
        else if (fin !== null && stallsOf(state).length >= stallPlaces(state)) spend(fin, finishFloor(state, 'third'));
        for (const id of stallsOf(state)) if (stallMode(state, id) !== mode) state = setStallMode(state, id, mode) ?? state;
        if (partyToday(state)?.ready) state = answerParty(state, true) ?? state;
        if (inspectionToday(state)) state = answerInspection(state, true) ?? answerInspection(state, false) ?? state;
      }
    }
    if (features.rental) {
      if (!state.rental && state.money >= STAND_COST * 2 + reserve && canSplurge(STAND_COST)) {
        const stand = buyStand(state);
        if (stand) {
          state = stand;
          investments += STAND_COST;
        }
      }
      const missing = RENTAL_CAP - (rentalOf(state)?.stock ?? RENTAL_CAP);
      if (missing && state.money >= missing * ITEM_COST + reserve) state = restockRental(state, missing) ?? state;
    }

    // ---------- Утро: закупка ----------
    const sellable = sellableProducts(state);
    // Ярмарка: докупить на склад под лоток и продать через него (мимо кассы).
    let stallRevenue = 0;
    if (fairToday(state) && sellable.length) {
      for (let n = 0; n < STALL_MAX; n++) {
        const id = sellable[n % sellable.length];
        const best = listPrice(id) ?? undefined;
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
    // Цены дня со скидкой постоянного покупателя (suppliers.ts supplierDiscount) — торга больше нет (02.11).
    // Случайные числа, которые раньше уходили на торг, тянем по-прежнему: ряд не сдвигается, и прогоны
    // до и после упрощения идут по тем же событиям дня.
    for (let i = 0; i < SUPPLIER_IDS.length; i++) random();
    const priceOf = priceFor(state);
    // Доля спроса на товар: в сезон любимые товары берут чаще.
    const weight = (p: ProductId) =>
      (seasonFor(state.day)?.demand[p] ?? 1) * seasonalDemand(p, state.day) * dayDemand(state, p, aromaShare > 0.5);
    const totalWeight = sellable.reduce((sum, p) => sum + weight(p), 0);
    // Гостей, которых привели открытые кассы (lanes.ts), закупка учитывает отдельно — см. ниже.
    const itemWants = (guests / laneGuests(state)) * (AVG_WANTS + adBasket(state));
    // Свою выпечку хотят, только пока она на полке: раскупили — хотят другое.
    const ownWanted = sellable.filter((p) => homemade(p)).reduce(
      (sum, p) => sum + Math.min(onShelves(state, p), (itemWants * weight(p)) / totalWeight),
      0,
    );
    const otherWeight = sellable.filter((p) => !homemade(p)).reduce((sum, p) => sum + weight(p), 0);
    // Кухня с поваром закупает продукты в свою кладовую сама — из кассы, на день вперёд (полки зала не трогает).
    if (features.kitchen) {
      const pantry = stockKitchen(state);
      state = pantry.state;
      purchases += pantry.spent;
      // 15.11: повар, как пекарь, варит до открытия — к первым гостям полка «Еда» уже не пустая.
      const early = morningCook(state);
      state = early.state;
      purchases += early.spent;
    }
    // С пределом зала закупка — на тех, кого пробьют (зал + кассы без хозяина): 27.11, разбор симулятора — на всех
    // позванных он закупал вдвое-втрое лишнего (порча, минус на «Минимаркете», банкротства у «базового» игрока).
    const buyFor = hall ? Math.min(guestsToday(state), hallCap(state) + autoCapacity(state)) : guestsToday(state);
    if (buyMode === 'auto' && autoActive(state)) {
      // «Закупать сам»: тот же расчёт и те же цены, что у кнопки, только без брака.
      const before = state.money;
      state = autoMorning(state, priceOf, buyFor);
      purchases += before - state.money;
    } else if (buyMode === 'restock' || buyMode === 'auto') {
      // Одно нажатие: купленное сразу встаёт на полки, лишнее — на склад (buyLine).
      // Печь в симуляторе печёт до закупки: её хлеб уже в запасе, вычитать его из плана второй раз не нужно.
      const plan = restockPlan(state, priceOf, buyFor, [], 0);
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
      const shareOfShelf = shelfRoom / sellable.filter((p) => PRODUCTS[p].category === PRODUCTS[id].category && !homemade(p)).length;
      const order = (state.plan?.order?.product === id ? state.plan.order.qty : 0) + (state.cafe?.deal?.items[id] ?? 0);
      const target = Math.ceil(Math.min(demand * 1.1, shareOfShelf + CARRY * 2)) + order;
      return Math.max(0, target - onShelves(state, id) - warehouseOf(state, id));
    };
    // Под рекламу закупаются с умом: места на складе не хватит на всё — режут закупку поровну, а не по
    // порядку списка. Иначе при наплыве гостей первые по списку дешёвые товары забивают склад, а мясо и
    // цветы не влезают. В обычные дни — по списку, как было (баланс теперь считают по 'restock').
    const toBuy = buyMode === 'smart' && activeAds(state).length ? sellable.filter((p) => !homemade(p)).reduce((sum, p) => sum + lacking(p), 0) : 0;
    const fit = toBuy > 0 ? Math.min(1, (warehouseCapacity(state) - warehouseCount(state)) / toBuy) : 1;
    for (const id of buyMode === 'smart' || buyMode === 'naive' ? sellable : []) {
      if (homemade(id)) continue;
      if (buyMode === 'naive') {
        // Новичок: всего поровну, у первого же поставщика, у кого товар есть.
        const sid = SUPPLIER_IDS.find((x) => supplierOpen(SUPPLIERS[x], state.shelves) && priceOf(x, id) !== null);
        if (!sid) continue;
        const price = priceOf(sid, id)!;
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
      const offers = SUPPLIER_IDS.map((sid) => ({ sid, price: priceOf(sid, id) })).filter(
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
        .filter((id) => !homemade(id))
        .map((id) => {
          const offers = SUPPLIER_IDS.map((sid) => ({ sid, price: priceOf(sid, id) })).filter(
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
    // Выездная торговля (van.ts): фургон — когда на него есть лишние деньги; в день события — самое выгодное
    // из событий дня, под него докупает сколько там обычно разбирают (у самого дешёвого поставщика) и грузит.
    if (features.van) {
      if (!state.van && vanOpen(state) && state.money >= VAN_PRICE * 2 + reserve && canSplurge(VAN_PRICE)) {
        state = buyVan(state) ?? state;
        investments += VAN_PRICE;
      }
      const best = vanEvents(state)
        .map((id) => ({ id, gain: (Object.keys(VAN_EVENTS[id].wants) as ProductId[]).reduce((sum, p) => sum + (canStock(state, p) ? vanWant(state, id, p) * vanPrice(p, id) : 0), 0) - vanFuel(state, id) }))
        .sort((a, b) => b.gain - a.gain)[0];
      const planned = state.van && best ? planTrip(state, best.id) : null;
      if (planned && best) {
        state = planned;
        for (const p of (Object.keys(VAN_EVENTS[best.id].wants) as ProductId[]).filter((x) => canStock(state, x))) {
          const offers = SUPPLIER_IDS.map((sid) => priceOf(sid, p)).filter((x): x is number => x !== null);
          const price = Math.min(...offers);
          const qty = Math.min(vanWant(state, best.id, p), Math.floor((state.money - reserve) / price), warehouseCapacity(state) - warehouseCount(state));
          if (!offers.length || qty <= 0) continue;
          const bought = buyStock(state, p, qty, price);
          if (!bought) continue;
          purchases += state.money - bought.money;
          state = loadVan(bought, p, qty) ?? bought;
        }
      }
    }
    // Кафе по соседству забирает заказ, как только магазин открылся.
    const cafeRes = cafeDeliver(state);
    state = cafeRes.state;
    // Кафе Ахмеда (хроники района) забирает хлеб в день поставки.
    const arcRes = arcDeliver(state);
    state = arcRes.state;
    const cafeIncome = (cafeRes.result?.pay ?? 0) + (arcRes.result?.pay ?? 0);
    // Беда района, выбор «раздавать»: старикам — к открытию, как в игре (crisisFx.openDay).
    state = crisisGive(state).state;
    state.shelves.forEach((_, i) => (state = moveToShelf(state, i).state));

    // ---------- День ----------
    const stats: DayStats = emptyDayStats();
    // Оплата кафе — тоже выручка дня (деньги уже зачислены при отгрузке).
    stats.revenue += cafeIncome;
    const wantedGuests = Math.max(0, Math.round(guests * (0.85 + random() * 0.3)));
    // «Трафик v2»: в зал — сколько он пропускает, остальные «на бегу» к кассам без хозяина (если такие кассы есть).
    const autoCap = hall ? autoCapacity(state) : 0;
    const hallGuests = hall ? Math.min(wantedGuests, hallCap(state)) : wantedGuests;
    const quickGuests = autoCap > 0 ? wantedGuests - hallGuests : 0;
    const dayGuests = hallGuests + quickGuests;
    // Один игрок не успевает всё: чем больше магазин, тем больше теряется без персонала.
    const has = (r: StaffRole) => Boolean(staffOf(state, r));
    // Хозяин без грузчика носит со склада сам, когда заметит пустую полку: столько ходок за день. Без предела зала —
    // по-старому (на этом откалиброваны проверки баланса, tests/balance*, и цифры docs/BALANCE.md): грузчик — 60 таких
    // ходок, ученик на складе (apprentice.ts) — ещё несколько.
    let trips = tripsPerDay ? tripsPerDay(state.level) : has('loader') ? (hall ? 0 : 60) : 3 + state.level;
    if (!hall) trips += Math.round(apprStockPace(state) * 6);
    // «Трафик v2»: грузчик и ученик на складе носят по времени, как в сцене (loader.ts): ходка — путь по залу помещения,
    // делённый на их скорость; несут тележку сотрудника (staffCarry) на самую пустую полку. 27.11: раньше и здесь стояло
    // «60 ходок за день», а в сцене грузчик успевал 9-25, — симулятор не видел, что полки пустеют.
    const loaderM = hall ? staffOf(state, 'loader') : undefined;
    const stockRate = hall ? ((loaderM ? loaderPace(state, loaderM) : 0) + apprStockPace(state) * levelPace(state)) / tripSeconds(state) : 0;
    let stockClock = 0;
    let staffTrips = 0;
    let ownerTrips = 0;
    // С котом и радио в очереди ждут дольше — уходят реже. Климат, указатели, тележки и обаяние хозяина
    // убраны 02.11: из шести «терпений» остались два, что игрок замечает (docs/BALANCE.md).
    const lossInQueue = (queueLoss ?? (hasCashier(state) ? 0.02 : 0.05 + 0.05 * state.level)) / catPatience(state) / radioPatience(state) / apprPatience(state);
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
      // Лотерейный билет у кассы: доля магазина — к чеку (lottery.ts). Бросок — только пока стойка работает:
      // до покупки ход случайностей тот же, что без лотереи (парные сравнения sim:features не шумят).
      const ticket = features.lottery ? ticketChance(state) : 0;
      if (ticket > 0 && extraRandom() < ticket) {
        state = countTicket(state);
        extra += TICKET_CUT;
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
    // Время дня (секунды) — для ходок со склада и касс «на бегу».
    let clock = 0;
    let hallServed = 0;
    let quickServed = 0;
    // Гостей зала у кассиров, сменщика и киосков — эта доля: их время касс уходит и на поток «на бегу».
    const autoShare = autoCap > 0 ? autoCap / (autoCap + capacity.owner) : 0;
    /** Прошло dt секунд: грузчик и ученик сделали свои ходки (несут на самую пустую полку, где есть что положить). */
    const stockTick = (dt: number) => {
      clock += dt;
      if (stockRate <= 0) return;
      stockClock += stockRate * dt;
      while (stockClock >= 1) {
        const index = shelfToFill(state);
        // Нести нечего — ждут у склада: впрок ходки не копятся, следующая начнётся, когда понадобится.
        if (index < 0) {
          stockClock = 0;
          break;
        }
        state = moveToShelf(state, index, undefined, staffCarry(state)).state;
        stockClock--;
        staffTrips++;
      }
    };
    /** Автозаказ подвозит кончившееся, хозяин без грузчика сам несёт на пустую полку. */
    const beforeGuest = (night: boolean) => {
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
          ownerTrips++;
        }
      }
    };
    /**
     * Гость «на бегу» (traffic.ts quickPick, как в сцене trafficFx.arrive): 1–2 товара с полок, нет нужного — похожее;
     * платит у касс без хозяина. Они пробивают поток в своё время: к этой минуте дня — не больше autoCap × прошедшая
     * доля (часть уходит на гостей зала у кассиров и киосков) и очередь на терпение гостя; не хватило — оставил корзину.
     */
    const runQuick = () => {
      beforeGuest(false);
      const aroma = random() < aromaShare;
      const want = pickWanted(state, random, (random() < 0.5 ? 2 : 1) + crisisExtraItems(state) + adExtraItems(state, extraRandom) + saleExtraItems(state, extraRandom), (p) => dayDemand(state, p, aroma));
      const pick = quickPick(state, want, random);
      state = pick.state;
      if (!pick.cart.length) {
        if (pick.why) {
          stats.lost++;
          noteLost(stats, pick.why, pick.id);
        }
        return;
      }
      if (quickServed + hallServed * autoShare >= (autoCap * (clock + QUICK_PATIENCE)) / DAY_SECONDS + CREDIT_MAX) {
        state = returnToShelf(state, pick.cart);
        stats.lost++;
        noteLost(stats, 'queue');
        stats.quickQueue = (stats.quickQueue ?? 0) + 1;
        return;
      }
      const paid = checkout(state, pick.cart);
      state = paid.state;
      stats.revenue += paid.total;
      stats.served++;
      stats.quick = (stats.quick ?? 0) + 1;
      quickServed++;
      recordSale(stats, pick.cart);
    };
    // Гости части дня (seconds — сколько она длится): count — в зал, quick — «на бегу», вперемешку ровно по времени.
    const runGuests = (count: number, tolerance: number, cap: number, night: boolean, seconds: number, quick = 0) => {
    const total = count + quick;
    if (!total) stockTick(seconds);
    for (let g = 0; g < total; g++) {
      stockTick(seconds / total);
      if (quick > 0 && Math.floor(((g + 1) * quick) / total) > Math.floor((g * quick) / total)) {
        runQuick();
        continue;
      }
      if (!noThieves(state) && random() < thiefChance(state.level) * cameraTheft(state) * eyeTheft(state)) {
        // Вор берёт товар; его ловит охранник или, реже, сам игрок — по повадкам (thiefTells.ts), за награду.
        const id = sellable[Math.floor(random() * sellable.length)];
        const index = shelfFor(state, id);
        const taken = index >= 0 ? takeFromShelf(state, index, id) : null;
        if (!taken) continue;
        const caught = random() < (guard ? guardCatchChance(guard) : ownerCatch(state));
        state = caught ? returnToShelf(taken.state, [{ id, unit: taken.unit }]) : taken.state;
        // Награду за пойманного (thiefTells.ts OWNER_BOUNTY) симулятор не начисляет (13.11): это мелочь — десятки
        // 💰 в день против тысяч выручки, — а лишние монеты сдвигают пороги покупок, и пороговые проверки
        // баланса (tests/weeks, tests/balanceZar) уезжают от шума, а не от игры. Важное — доля пойманных — учтено.
        if (caught) stats.caught++;
        else stats.stolen += unitSalePrice(state, id, taken.unit);
        continue;
      }
      beforeGuest(night);
      const aroma = random() < aromaShare;
      const wanted = pickWanted(state, random, (random() < AVG_WANTS - 1 ? 2 : 1) + crisisExtraItems(state) + adExtraItems(state, extraRandom) + saleExtraItems(state, extraRandom), (p) => dayDemand(state, p, aroma));
      const fair = (p: ProductId) =>
        perceivedBase(state, p) * tolerance * fairTodayTolerance(state) * loyaltyTolerance(state) * radioTolerance(state) * adTrust(state) * crisisTolerance(state, p) * (aroma && p === 'bread' ? AROMA_TOLERANCE : 1);
      const cart: CartItem[] = [];
      let sawEmpty = false;
      // Чего не хватило — записываем в отчёт дня (по нему «Закупить нужное» и печь считают спрос).
      let emptyId: ProductId | undefined;
      let tooExpensive = false;
      for (const id of new Set(wanted)) {
        const index = shelfFor(state, id);
        const shelf = state.shelves[index];
        const oldest = shelf ? shelf.items[id]?.[0] : undefined;
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
      // Чаевые «за помощь» ученику в зале — свой генератор не трогаем, пока ученика в зале нет.
      const extra = extras(night) + (extraRandom() < catTipChance(state) ? CAT_TIP : 0) + (!night && apprTipChance(state) > 0 && extraRandom() < apprTipChance(state) ? APPR_TIP : 0);
      state = { ...state, money: state.money + extra };
      const dish = dishExtra(night);
      stats.revenue += paid.total + extra + dish;
      if (night) nightRevenue += paid.total + extra + dish;
      stats.served++;
      if (!night) hallServed++;
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
    // Гости части дня (от доли start, длиной share; quick из них — «на бегу»): с поваром — по четвертям, между ними он готовит.
    const dayPart = (count: number, quick: number, start: number, share: number) => {
      const parts = chef ? Math.max(1, Math.round(share * 4)) : 1;
      let done = 0;
      let doneQuick = 0;
      for (let i = 0; i < parts; i++) {
        if (chef) cookFor(1 - start - (share * i) / parts);
        const n = Math.round((count * (i + 1)) / parts) - done;
        const q = Math.round((quick * (i + 1)) / parts) - doneQuick;
        runGuests(n, 1, serveCap, false, (share * DAY_SECONDS) / parts, q);
        done += n;
        doneQuick += q;
      }
    };
    // Вечер «Ночи распродаж» (weeks.ts): последняя четверть дня — всё на 20% дешевле, гостей больше.
    const sale = weekFor(state.day)?.id === 'sale';
    {
      // Вечерняя уценка (у всех с 02.11): к вечеру то, что испортится ночью, уценяется само (вечер тот же, что у распродажи, — SALE_EVENING).
      const evening = Math.round(hallGuests * MARKDOWN_EVENING);
      const eveningQuick = Math.round(quickGuests * MARKDOWN_EVENING);
      dayPart(hallGuests - evening, quickGuests - eveningQuick, 0, 1 - MARKDOWN_EVENING);
      state = markdownSurplus(state, (id) => eveningSales(stats.sold[id] ?? 0)).state;
      if (sale) state = startSale(state);
      // Распродажа зовёт больше гостей; с пределом зала лишние идут «на бегу» (или мимо, если касс без хозяина нет).
      const crowd = sale ? Math.round(evening * SALE_CROWD) : evening;
      const inHall = hall ? Math.min(crowd, Math.max(evening, Math.round(hallCap(state) * MARKDOWN_EVENING))) : crowd;
      dayPart(inHall, eveningQuick + (autoCap > 0 ? crowd - inHall : 0), 1 - MARKDOWN_EVENING, MARKDOWN_EVENING);
    }
    // Ночная смена: гостей меньше, к ценам терпимее, касса успевает пропорционально времени.
    let nightProfit = 0;
    // Вечерняя распродажа кончается с закрытием (как в игре — nightShift.startNightShift).
    state = endSale(state);
    if (features.night && hasUpgrade(state, 'nightShift')) {
      const paid = startNight(state);
      if (paid) {
        state = paid;
        const before = stats.served;
        const called = Math.round(((guests * NIGHT_SECONDS) / DAY_SECONDS) * NIGHT_GUESTS * (0.85 + random() * 0.3));
        // Ночью потока «на бегу» нет (trafficFx.arrive): гостей держит зал.
        const nightGuests = hall ? Math.min(called, Math.round((hallCap(state) * NIGHT_SECONDS) / DAY_SECONDS)) : called;
        runGuests(nightGuests, NIGHT_TOLERANCE, before + Math.floor((serveCap * NIGHT_SECONDS) / DAY_SECONDS), true, NIGHT_SECONDS);
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
      // «Прикормленный» проверяющий (grey.ts) нарушений не видит.
      const cover = greyCover(state, inspect(state, { trash: clean ? 0 : 3, toiletDirt: clean ? 0 : 70 }));
      state = inspectionDone(cover.state, cover.result);
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
    // Сахар, банки и рассол своей марки (lines.ts) — та же закупка, только ночью.
    purchases += night.lines.spent;
    const before = night.state;
    state = night.state;
    // Без механики «Район дорожает» престиж не копится (утро nightCycle поднимает его на шаг — снимаем).
    if (!features.gentrify && state.gentrify) {
      const { gentrify: _off, ...rest } = state;
      state = rest;
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
      wanted: wantedGuests,
      served: stats.served,
      lost: stats.lost,
      quick: stats.quick ?? 0,
      empty: stats.lostWhy?.empty ?? 0,
      trips: staffTrips + ownerTrips,
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
      zar: inZar(before),
      fixed: Math.round((STORE_LEVELS[before.level].rent + STORE_LEVELS[before.level].utilities + STORE_LEVELS[before.level].power + before.staff.reduce((sum, m) => sum + m.wage, 0)) / MONTH_DAYS),
      home: night.home,
      ads: adSpent,
      lines: LINE_IDS.reduce((sum, id) => sum + (stats.sold[LINES[id].product] ?? 0) * (state.prices[LINES[id].product] - lineUnitCost(id)), 0),
      quests: night.quests.earned,
    });
    void moneyStart;
  }
  setBigDaySeed(bigDaySeedBefore);
  return { days: out, levelDay, chapterDay, rescueDay, bankruptDay, giant: giantLog, contests, zarLevelDay, final: state };
}


/** Средний результат по нескольким прогонам: день достижения каждого уровня. */
export function averageLevelDays(days: number, runs: number, features: SimOptions['features'] = {}): (number | null)[] {
  const results = Array.from({ length: runs }, (_, i) => simulate({ days, seed: i + 1, features }).levelDay);
  return STORE_LEVELS.map((_, level) => {
    const reached = results.map((r) => r[level]).filter((d): d is number => d !== null);
    if (reached.length < runs / 2) return null;
    return Math.round(reached.reduce((a, b) => a + b, 0) / reached.length);
  });
}

export { SHELF_LEVELS, type ProductId, PRODUCT_IDS };
