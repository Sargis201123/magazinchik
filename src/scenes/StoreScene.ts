import Phaser from 'phaser';
import {
  BAD_COMPLAINT_CHANCE,
  buyChance,
  canPlace,
  promoKind,
  PRODUCTS,
  SHELF_LEVELS,
  checkout,
  DAY_SECONDS,
  emptyDayStats,
  billTotal,
  guardCatchChance,
  staffOf,
  isAbsent,
  managerBoost,
  markdownSurplus,
  SHELF_KINDS,
  thiefChance,
  workSpeed,
  hasUnmarkedBad,
  moveToShelf,
  newGame,
  PRODUCT_IDS,
  returnToShelf,
  shelfCapacity,
  shelfFor,
  shelfFree,
  STORE_LEVELS,
  storeLevel,
  takeFromShelf,
  recordSale,
  unitSalePrice,
  cashierScan,
  checkoutSeconds,
  ownerLevel,
  type ScanTiming,
  warehouseCapacity,
  warehouseCount,
  type CartItem,
  type Category,
  type DayStats,
  type LostReason,
  type ProductId,
  type StaffMember,
  type StaffRole,
  type StoreState,
} from '../game/economy';
import { ensurePlan, inspectionDone, nightCycle, spawnIntervalToday } from '../game/day';
import { inspect, RUSH_SECONDS, type InspectionResult , type ClientId } from '../game/events';
import {
  ALBUM_REWARD,
  collectRareGuest,
  perceivedBase,
  pickRareGuest,
  pickWanted,
  questDone,
  rankName,
  rankOf,
  RARE_GUESTS,
  RARE_TIP,
  rareGuestChance,
  seasonFor,
  type RareGuestId,
} from '../game/endless';
import { loadGame, saveGame } from '../game/save';
import { t, type TextKey } from '../i18n';
import { sound } from '../platform/sound';
import { music } from '../platform/music';
import { findPath, type Rect } from './paths';
import { ambience } from '../platform/ambience';
import { haptic } from '../platform/telegram';
import { button, el, openModal, UI_FONT } from '../ui/dom';
import { Hud } from '../ui/hud';
import { showMorning } from '../ui/morning';
import { showTitle } from '../ui/title';
import { isWet, weatherFor, type Weather } from '../game/weather';
import { holidayFor, yearTime } from '../game/calendar';
import { liveProgress, recordDay, unlockAchievements, type AchievementId } from '../game/achievements';
import { announceAchievement } from '../ui/achievements';
import { claimGift, localDate } from '../game/gift';
import { activeAd } from '../game/ads';
import { acceptsPrice, recordVisit, regularById, regularsToday, regularState, tipFor, type Regular, type RegularId } from '../game/regulars';
import { carryOf, cartExtra, ETAGS_EVENING, eveningSales, hasUpgrade, KIOSK_ITEM_SECONDS, KIOSK_MAX_ITEMS, KIOSK_PAY_SECONDS, loyaltyTolerance, withUpgrades } from '../game/upgrades';
import { showGift } from '../ui/gift';
import { activeDecor, grantDecor, isDecorId } from '../game/decor';
import { restorePurchases } from '../platform/stars';
import { layoutFor, unitsPerBox, WAREHOUSE_COLS, WING_OUTER, type Layout, type Room } from './layout';
import { dayDemand } from '../game/demand';
import { CANDY_PRICE, impulseChance, returnCandy, takeCandy } from '../game/impulse';
import { coffeeChance, cupsOf, useCup } from '../game/coffee';
import { carryBonus, charmPatience, eyeTheft, ownerTiming } from '../game/owner';
import { eduardLook, type EduardLook } from '../game/eduard';
import { updateRecords } from '../game/records';
import { cafeDeliver, type CafeDelivery } from '../game/cafe';
import { answerSpecial, grannyRepays, makeSpecial, type SpecialKind, type SpecialVisit } from '../game/special';
import { showChoice } from '../ui/choice';
import { BRAND_BATCH, brandBatchCost, brandToBake, startBrandBatch } from '../game/brand';
import { hasRadio, nextStation, radioExtra, radioPatience, radioSpeed, setStation, STATION_INFO, stationOf } from '../game/radio';
import { managerPick, orderUrgent, receiveUrgent, URGENT_QTYS, URGENT_SECONDS } from '../game/urgent';
import { showUrgent } from '../ui/urgent';
import {
  binCapacity,
  binSprite,
  brewSeconds,
  cameraTheft,
  climatePatience,
  coffeePrice,
  coffeeSprite,
  entranceMud,
  fridgeLeak,
  gearTier,
  type GearId,
  ovenBake,
  ovenBatchCost,
  ovenSprite,
  REGISTER_JAM_SECONDS,
  registerJam,
  registerSprite,
  warehouseSpeed,
  wcDirt,
} from '../game/gear';
import { CASHIER_ROLES, nextRegisterCount, registerCount, registerOfRole } from '../game/registers';
import { AROMA_SECONDS, AROMA_TOLERANCE, bakerShouldBake, bakeryWorking, OVEN_BURN_SECONDS, startBatch, takeOutBread } from '../game/bakery';
import { canWorkNight, NIGHT_GUESTS, NIGHT_MARKUP, NIGHT_POWER, NIGHT_SECONDS, NIGHT_TOLERANCE, startNight } from '../game/night';
import { CAT_BEDS, CAT_TIP, catHome, catPatience, catTipChance, fedToday } from '../game/cat';
import { note, reviewsFor } from '../game/reviews';
import { warLeaves } from '../game/war';
import { lossAdvice, noteLost } from '../game/losses';
import { fairTolerance, isFairDay, STALL_EVERY_SECONDS, STALL_MAX, stallSale } from '../game/fair';
import { DELIVERY_SECONDS, makeHomeOrder, ORDER_EVERY, ORDER_TIMEOUT, packHomeOrder, type HomeOrder } from '../game/delivery';
import { showReviews } from '../ui/reviews';

// Холст 720×1280 (9:16): на телефоне хватает пикселей для детальных спрайтов.
// Камера подбирает масштаб под размер магазина: ларёк крупно, универмаг мельче.
/**
 * Во сколько раз холст плотнее базовых 720×1280: под экран телефона (ширина × devicePixelRatio),
 * от 1 до 1,5 с шагом 0,25 (больше — тяжело слабым телефонам). Пиксель-арт и надписи не мылятся.
 */
export const RES = (() => {
  const cssWidth = Math.min(window.innerWidth, (window.innerHeight * 9) / 16);
  return Phaser.Math.Clamp(Math.round(((cssWidth * (window.devicePixelRatio || 1)) / 720) * 4) / 4, 1, 1.5);
})();
export const CANVAS_W = Math.round(720 * RES);
export const CANVAS_H = Math.round(1280 * RES);
/** Сверху интерфейс (деньги, товар), снизу подсказки — магазин рисуем между ними. */
const HUD_TOP = 140 * RES;
const HUD_BOTTOM = 80 * RES;
/** Спрайты нарисованы с двойной детализацией (DETAIL в art/sprites.py): в мире они вдвое меньше своих пикселей. */
const ART = 2;
/** Сколько улицы видно под зданием (в точках мира). */
const STREET_VIEW = 40;
/** Сколько первых дней показывать обучение: стрелки и яркую подсказку. */
const TUTORIAL_DAYS = 3;
/** Сколько штук на полке считается «почти пусто» — табличка «Осталось N». */
const LOW_STOCK = 2;
/** Высота видимой крышки мебели (TOP в art/sprites.py, в точках мира). */
const FURNITURE_TOP = 6;
/** На сколько выше по залу стоит следующая пара касс. */
const REGISTER_ROW = 60;
/** Насколько далеко можно отвести камеру от магазина пальцем. */
const CAMERA_REACH = 200;
/** Толщина наружных стен и высота фасада (в точках мира). */
const WALL = 6;
const FACADE_H = 10;
/** Пол по уровням помещения. */
const FLOORS = ['floor', 'floor', 'floor2', 'floor2', 'floor3'];
/** Машины на дороге: вид, цвет (null — свой, без перекраски), вес при выборе. */
const CAR_TYPES: [string, number | null, number][] = [
  ['car_sedan', 0, 35],
  ['car_hatch', 0, 25],
  ['car_taxi', 0xfee761, 10],
  ['car_van', 0, 16],
  ['car_truck', null, 14],
];
/** Слой света: выше людей и мебели, ниже всплывающих надписей (1000). */
const LIGHT_DEPTH = 900;
/** Цвет света на улице и в зале по ходу дня: [доля дня, цвет]. Умножается на картинку. */
const OUTDOOR_LIGHT: [number, number][] = [
  [0, 0xffeccc],
  [0.3, 0xffffff],
  [0.65, 0xffe2b8],
  [0.85, 0xe89c78],
  [1, 0x5c64a8],
];
const INDOOR_LIGHT: [number, number][] = [
  [0, 0xfff6e6],
  [0.5, 0xffffff],
  [0.85, 0xfff0dc],
  [1, 0xe4d8ec],
];

/** Погода приглушает свет на улице: в дождь серо-синий, в снег чуть холодный. */
const WEATHER_LIGHT: Record<Weather, number> = { clear: 0xffffff, heat: 0xfff4e0, rain: 0xb4bed2, storm: 0x9aa4c4, snow: 0xf0f4ff, leaves: 0xfff2e0 };

/** Перемножение цветов (как тинт). */
function mulColor(a: number, b: number): number {
  const ch = (shift: number) => Math.round((((a >> shift) & 255) * ((b >> shift) & 255)) / 255);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Цвет между ключевыми точками. */
function lerpKeys(keys: [number, number][], p: number): number {
  const i = Math.max(0, keys.findIndex(([at]) => at >= p) - 1);
  const [a, ca] = keys[i];
  const [b, cb] = keys[Math.min(i + 1, keys.length - 1)];
  const t = b === a ? 0 : (p - a) / (b - a);
  const mix = (shift: number) => Math.round(((ca >> shift) & 255) + (((cb >> shift) & 255) - ((ca >> shift) & 255)) * t);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}
/** Сколько видов у каждого товара (item_bread_0…2 в art/sprites.py). */
const ITEM_VARIANTS = 3;

/** Терпение в очереди. Отсчёт начинается, когда покупатель дошёл до очереди. */
const PATIENCE_MS = 20_000;
const CUSTOMER_SPEED = 40; // пикселей мира в секунду
const SELLER_SPEED = 90;
/** Как часто покупатель у пустой кассы зовёт продавца. */
const CALL_EVERY_MS = 3000;

const TRASH_CHANCE = 0.15;
const MAX_TRASH = 8;
/** Столько мусора на полу — и покупатели начинают жаловаться. */
const TRASH_COMPLAINT = 3;
/** В дождь, грозу и снег столько покупателей приносят грязь на ногах. */
const MUD_CHANCE = 0.15;
/** Больше двух грязных пятен разом не бывает — иначе гроза засыпает жалобами. */
const MAX_MUD = 2;
const MOP_MS = 1300;
/** Сколько мусора влезает в ведро. Полное ведро пахнет — покупатели жалуются, проверка снимает баллы. */
const BIN_DROP_MS = 250;
/** Больше стольких ходок за одно касание полки продавец не делает (дальше — новое касание). */
const MAX_RESTOCK_TRIPS = 4;
/** Завязать мешок и бросить его в контейнер на улице. */
const BAG_MS = 600;
const DUMP_MS = 450;
/** Покупатель иногда роняет покупку и разливает: молоко, сок, газировка. */
const SPILL_CHANCE = 0.035;
const SPILL_TINTS = [0xf4f8ff, 0xffb347, 0xb86f50];
const SPILL_MOP_MS = 1700;
/** Мини-события дня (свет, труба, голубь, курьер): с какого дня и как часто. */
const LIVE_FROM_DAY = 4;
const LIVE_CHANCE = 0.5;
const LIVE_KINDS = ['blackout', 'leak', 'pigeon', 'courier', 'mouse'] as const;
/** Мышь грызёт товар раз в столько секунд; сама уходит через столько. */
const MOUSE_BITE_MS = 4000;
const MOUSE_STAY_MS = 25_000;
type LiveKind = (typeof LIVE_KINDS)[number];
const FIX_MS = 1600;
const LEAK_FIX_MS = 2200;
/** Следующий покупатель обслужен за столько после предыдущего — серия продолжается. */
const COMBO_WINDOW_MS = 7000;
const COMBO_COLORS = ['#fee761', '#feae34', '#f77622', '#e43b44', '#b55088', '#2ce8f5'];
const TOILET_CHANCE = 0.25;
const TOILET_DIRT_PER_VISIT = 20;
const TOILET_DIRTY = 60;
const TOILET_CLEAN_MS = 1000;
const TRASH_CLEAN_MS = 400;
const PICKUP_MS = 500;
const PLACE_MS = 400;
/** Одна коробка на складе изображает минимум столько штук товара. */


const SHELF_LOOK: Record<Category, { texture: string; tint: number }> = {
  bakery: { texture: 'shelf', tint: 0xffffff },
  produce: { texture: 'stand', tint: 0xffffff },
  dairy: { texture: 'fridge', tint: 0xd8ecff },
  meat: { texture: 'fridge', tint: 0xffd6d6 },
  drinks: { texture: 'drinks', tint: 0xffffff },
  // Морозильник — тот же холодильник, но ледяной.
  frozen: { texture: 'fridge', tint: 0xc4f4ff },
  household: { texture: 'chem', tint: 0xffffff },
};
const SHIRTS = [0x5b6ee1, 0xd95763, 0x6abe30, 0xfbf236, 0x76428a, 0xdf7126, 0x37946e, 0xf6757a, 0x2ce8f5];
const PANTS = [0x3a4466, 0x262b44, 0x5a6988, 0x733e39, 0x265c42];
const HAIR_COLORS = [0x4a2c1a, 0x181425, 0x733e39, 0xfeae34, 0xb86f50, 0x8b9bb4];
const HAIR_STYLES = ['short', 'short', 'long', 'long', 'bald', 'ponytail', 'curly'] as const;
type HairStyle = 'short' | 'long' | 'bun' | 'cap' | 'bald' | 'ponytail' | 'curly' | 'beanie';
/** Поверх одежды: фартук (красится), жилет грузчика, значок охранника. */
type Accessory = 'apron' | 'vest' | 'badge' | 'tie';
type Facing = 'down' | 'up' | 'left' | 'right';
const VIEW_SUFFIX: Record<Facing, string> = { down: '', up: '_b', left: '_s', right: '_s' };

interface Look {
  shirt: number;
  skin: number;
  pants?: number;
  hair?: number;
  style?: HairStyle;
  acc?: Accessory;
  accTint?: number;
  /** Ребёнок — ростом поменьше. */
  kid?: boolean;
  glasses?: boolean;
  /** Сумка через плечо или школьный рюкзак. */
  bag?: 'bag' | 'backpack';
  bagTint?: number;
  /** Мама катит коляску. */
  stroller?: number;
  /** С собакой: окрас. Собаку привязывают у входа. */
  dog?: number;
}

const randomLook = (shirt: number): Look => ({
  shirt,
  skin: Phaser.Utils.Array.GetRandom(SKINS),
  pants: Phaser.Utils.Array.GetRandom(PANTS),
  hair: Phaser.Utils.Array.GetRandom(HAIR_COLORS),
  style: Phaser.Utils.Array.GetRandom([...HAIR_STYLES]),
});

/** Покупатели бывают разные: дети, пожилые, рабочие в касках и жилетах. */
const HAT_COLORS = [0xe43b44, 0x0099db, 0x63c74d, 0xfeae34, 0xb55088, 0x2ce8f5, 0xf6757a];
const BAG_COLORS = [0x8f563b, 0x262b44, 0xe43b44, 0xc28569, 0x68386c];
const DOG_COLORS = [0xc28569, 0xead4aa, 0x4a3b52, 0xffffff, 0xe4a672];

function customerLook(shirt: number): Look {
  const look = randomLook(shirt);
  const roll = Math.random();
  // Школьники с рюкзаками.
  if (roll < 0.14) {
    const kid: Look = { ...look, kid: true, style: Phaser.Utils.Array.GetRandom(['short', 'ponytail', 'curly'] as const) };
    return Math.random() < 0.7 ? { ...kid, bag: 'backpack', bagTint: Phaser.Utils.Array.GetRandom(HAT_COLORS) } : kid;
  }
  if (roll < 0.26) return { ...look, hair: Phaser.Utils.Array.GetRandom([0xd8d8e0, 0xc0cbdc]), style: Phaser.Utils.Array.GetRandom(['bun', 'bald', 'short'] as const) };
  if (roll < 0.33) return { ...look, style: 'cap', hair: 0xfeae34, acc: 'vest' };
  // Шапки и кепки разных цветов, сумки через плечо.
  const hat = Math.random();
  const head: Partial<Look> =
    hat < 0.16 ? { style: 'beanie', hair: Phaser.Utils.Array.GetRandom(HAT_COLORS) } : hat < 0.26 ? { style: 'cap', hair: Phaser.Utils.Array.GetRandom(HAT_COLORS) } : {};
  const bag: Partial<Look> = Math.random() < 0.28 ? { bag: 'bag', bagTint: Phaser.Utils.Array.GetRandom(BAG_COLORS) } : {};
  return { ...look, ...head, ...bag };
}

/** Ночной гость: тёмная куртка, кепка или шапка, у студентов рюкзак. */
function nightLook(): Look {
  const look = randomLook(Phaser.Utils.Array.GetRandom(NIGHT_SHIRTS));
  const roll = Math.random();
  if (roll < 0.35) return { ...look, style: 'cap', hair: Phaser.Utils.Array.GetRandom([0x181425, 0xfeae34, 0x262b44]) };
  if (roll < 0.6) return { ...look, style: 'beanie', hair: Phaser.Utils.Array.GetRandom(HAT_COLORS), bag: 'backpack', bagTint: Phaser.Utils.Array.GetRandom(BAG_COLORS) };
  return look;
}

/** Иногда покупатель приходит с коляской или с собакой. */
function withCompanionItems(look: Look): Look {
  if (look.kid) return look;
  const roll = Math.random();
  if (roll < 0.05) return { ...look, stroller: Phaser.Utils.Array.GetRandom(HAT_COLORS), style: Phaser.Utils.Array.GetRandom(['long', 'ponytail', 'bun'] as const) };
  if (roll < 0.11) return { ...look, dog: Phaser.Utils.Array.GetRandom(DOG_COLORS) };
  return look;
}

/** Форма персонала. */
const STAFF_ACC: Record<StaffRole, { acc: Accessory; tint: number }> = {
  cashier: { acc: 'apron', tint: 0xffffff },
  cashier2: { acc: 'apron', tint: 0xffffff },
  cashier3: { acc: 'apron', tint: 0xffffff },
  cashier4: { acc: 'apron', tint: 0xffffff },
  cleaner: { acc: 'apron', tint: 0x5fcde4 },
  loader: { acc: 'vest', tint: 0xffffff },
  guard: { acc: 'badge', tint: 0xffffff },
  manager: { acc: 'tie', tint: 0xffffff },
  baker: { acc: 'apron', tint: 0xffffff },
  barista: { acc: 'apron', tint: 0x8f563b },
};
/** Тёмная кофта — так игрок может заметить вора. */
const THIEF_SHIRT = 0x45444f;
const CAR_COLORS = [0xe43b44, 0x0099db, 0x3e8948, 0xfeae34, 0xc0cbdc, 0x68386c, 0x262b44];
const THIEF_SPEED = 52;
/** Форма сотрудников. */
const UNIFORMS: Record<StaffRole, number> = { cashier: 0x5fcde4, cashier2: 0x5fcde4, cashier3: 0x5fcde4, cashier4: 0x5fcde4, cleaner: 0xfbf236, loader: 0xdf7126, guard: 0x306082, manager: 0xf4f4f4, baker: 0xf4f4f4, barista: 0x3e8948 };
const STAFF_SPEED = 60;
/** Глубина веранды перед кафе «Пончик». */
const VERANDA_D = 28;
/** Сколько человек может ждать кофе сразу и что заказывают у стойки. */
const COFFEE_WAITING = 3;
const COFFEE_ORDERS: TextKey[] = ['popup.order1', 'popup.order2', 'popup.order3', 'popup.order4'];
/** Сколько кассир пробивает одного покупателя при обычной скорости. */
const INSPECTOR_SHIRT = 0x222034;
/** Соседка Валентина заходит раз в день — в вишнёвой кофте и с седыми волосами. */
const VALYA: Look = { shirt: 0xa22633, skin: 0xeec39a, pants: 0x68386c, hair: 0xc0cbdc, style: 'curly' };
/** Персонажи сюжета — как на портретах. */
const GRANDMA: Look = { shirt: 0x68386c, skin: 0xf2d3ab, pants: 0x3a4466, hair: 0xd8d8e0, style: 'bun', glasses: true };
const MARAT: Look = { shirt: 0xffffff, skin: 0xd9a066, pants: 0x262b44, hair: 0xffffff, style: 'cap' };
const SCHOOL_COOK: Look = { shirt: 0x5fcde4, skin: 0xf2d3ab, pants: 0x3a4466, hair: 0xc0cbdc, style: 'cap', acc: 'apron' };
const EDUARD: Look = { shirt: 0x3a4466, skin: 0xf2d3ab, pants: 0x262b44, hair: 0x181425, style: 'short', acc: 'tie' };
/** Аксессуары, которые видны только спереди. */
const FRONT_ONLY = new Set(['acc_badge', 'acc_tie', 'acc_glasses']);
const GRANDMA_LINES_KEYS: TextKey[] = ['visit.grandma1', 'visit.grandma2', 'visit.grandma3'];
const ORDER_GUESTS: Record<ClientId, [Look, TextKey]> = {
  chef: [MARAT, 'who.marat'],
  school: [SCHOOL_COOK, 'client.school'],
  valya: [VALYA, 'who.valya'],
};
const OWNER: Look = { shirt: 0x8fd16a, skin: 0xf2d3ab, pants: 0x3a4466, hair: 0x4a2c1a, style: 'short' };
const STAFF_HAIR: Record<StaffRole, HairStyle> = { cashier: 'long', cashier2: 'ponytail', cashier3: 'bun', cashier4: 'short', cleaner: 'short', loader: 'short', guard: 'cap', manager: 'short', baker: 'cap', barista: 'ponytail' };
/** На какой секунде дня приходит инспектор. */
const INSPECTOR_AT = 25;
const BROKEN_TINT = 0x8a8a8a;
const SKINS = [0xf2d3ab, 0xd9a066, 0x8f563b, 0xeec39a];

interface Customer {
  sprite: Phaser.GameObjects.Container;
  bubble: Phaser.GameObjects.Image;
  items: CartItem[];
  /** Что-то испортило впечатление (грязный туалет) — при оплате будет жалоба. */
  unhappy: boolean;
  patience?: Phaser.Time.TimerEvent;
  waitStart: number;
  gone: boolean;
  thief: boolean;
  /** Уже пробивается на кассе — из очереди не уйдёт. */
  serving?: boolean;
  /** Редкий гость для альбома. */
  rare?: RareGuestId;
  /** Уже поскользнулся на луже (второй раз не падает). */
  slipped?: boolean;
  /** Постоянный покупатель: кто и за чем пришёл. */
  regular?: RegularId;
  wants?: ProductId[];
  /** Шоколадка со стойки и кофе — оплачиваются на кассе вместе с товаром. */
  extras?: { kind: 'candy' | 'coffee'; price: number }[];
  /** Уже погладил кота. */
  petted?: boolean;
  /** Сколько готов ждать в очереди. */
  patienceMs?: number;
}

/** Касса: где стоит стол, покупатель и кассир, кого пробивают и полоска пробивки. */
interface Register {
  counter: { x: number; y: number };
  spot: { x: number; y: number };
  clerk: { x: number; y: number };
  /** Кто подошёл к этой кассе (идёт к ней, ждёт или уже пробивается). */
  customer: Customer | null;
  scan: { start: number; total: number; byOwner: boolean } | null;
  bar: Phaser.GameObjects.Rectangle;
  fill: Phaser.GameObjects.Rectangle;
  screen: Phaser.GameObjects.Rectangle;
  beam: Phaser.GameObjects.Rectangle;
}

/** Печь: что в ней и всё, что её рисует. */
interface Oven {
  img: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Rectangle;
  bread: Phaser.GameObjects.Image;
  bar: Phaser.GameObjects.Rectangle;
  fill: Phaser.GameObjects.Rectangle;
  fx?: Phaser.FX.Glow;
  state: 'idle' | 'baking' | 'ready';
  start: number;
  timer?: Phaser.Time.TimerEvent;
  /** Что в печи: хлеб или своя выпечка «От бабушки». */
  product: ProductId;
}

/** Ночью заходят таксисты, студенты и полуночники — в тёмном. */
const NIGHT_SHIRTS = [0x262b44, 0x3a4466, 0x45444f, 0x68386c, 0x124e89, 0x5a6988];
/** Кот гуляет по залу раз в столько секунд (если захочет). */
const CAT_WALK_EVERY = 18_000;
const CAT_SPEED = 26;

type TrashKind = 'trash' | 'mud' | 'spill';

interface Worker {
  member: StaffMember;
  sprite: Phaser.GameObjects.Container;
  carried: Phaser.GameObjects.Image;
  home: { x: number; y: number };
}

interface ShelfView {
  kind: Category;
  bg: Phaser.GameObjects.Image;
  /** Кромки полок, борта ящиков, стекло — поверх товара. */
  front: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  items: Phaser.GameObjects.Image[];
  /** Второй ряд в глубине полки: тот же товар потемнее — полка выглядит полной, а не редкой. */
  backItems: Phaser.GameObjects.Image[];
  pips: Phaser.GameObjects.Image[];
  /** Свет холодильника: стекло светится, на пол ложится холодный отсвет. */
  lights: Phaser.GameObjects.GameObject[];
  /** Табличка «Осталось 2» над почти пустой полкой. */
  low: Phaser.GameObjects.Text;
  /** Ценник «АКЦИЯ», если товар этой полки — товар дня. */
  promo: Phaser.GameObjects.Text;
  /** Подсветка: полка пустая, а на складе её товар есть — пора нести. */
  glow?: Phaser.FX.Glow;
  needsStock: boolean;
}

interface NightLight {
  obj: Phaser.GameObjects.Image | Phaser.GameObjects.Text | Phaser.GameObjects.Rectangle;
  /** Яркость к ночи. */
  alpha: number;
  /** Неон зажигается с мерцанием; у одной вывески общее число — мигает вся разом. */
  neon?: number;
}

interface Pigeon {
  img: Phaser.GameObjects.Image;
  home: { x: number; y: number };
  away: boolean;
}

/** Шаг дела продавца: дойти до точки, подождать, сделать действие. */
interface ChoreStep {
  x: number;
  y: number;
  ms?: number;
  action?: () => void;
}

export class StoreScene extends Phaser.Scene {
  private state!: StoreState;
  private layout!: Layout;
  /** Для какого уровня помещения построен зал (при расширении перестраиваем). */
  private builtLevel = -1;
  /** Каким было помещение Эдуарда, когда рисовали улицу. */
  private builtEduard: EduardLook | null = null;
  private stats: DayStats = emptyDayStats();
  private hud!: Hud;
  private shelfViews: ShelfView[] = [];
  private boxes: Phaser.GameObjects.Image[] = [];
  private shutters: Phaser.GameObjects.Image[] = [];
  private arrow?: Phaser.GameObjects.Image;
  /** Палец двигал камеру — это не нажатие. */
  private dragged = false;
  private dragStart = { x: 0, y: 0 };
  /** Куда камера возвращается после осмотра квартала. */
  private home = { x: 0, y: 0 };
  private homeTimer?: Phaser.Time.TimerEvent;
  private baseZoom = 1;
  /** Щипок двумя пальцами: расстояние и зум в начале. */
  private pinch: { dist: number; zoom: number } | null = null;
  /** Все люди на экране: для шагов и дыхания. */
  private people = new Set<Phaser.GameObjects.Container>();
  /** Насколько открыты двери: 0 — закрыты, 1 — открыты. */
  private doorOpen = 0;
  private outdoorShades: Phaser.GameObjects.Rectangle[] = [];
  /** Погода дня и всё, что её рисует (частицы, снег на газоне, гирлянда, ёлка). */
  private weather: Weather = 'clear';
  private weatherObjs: Phaser.GameObjects.GameObject[] = [];
  private lawns: { x: number; y: number; w: number; h: number }[] = [];
  private greenery: Phaser.GameObjects.Image[] = [];
  private doorImg!: Phaser.GameObjects.Image;
  private vignette?: Phaser.FX.Vignette;
  /** Насколько вечер (0 — день, 1 — сумерки): фары машин горят сильнее. */
  private evening = 0;
  private indoorShades: Phaser.GameObjects.Rectangle[] = [];
  private lampGlows: Phaser.GameObjects.Image[] = [];
  private ceilingGlows: Phaser.GameObjects.Image[] = [];
  /** Ночные огни (витрины, лужи света, конусы фонарей, неон): сила растёт к вечеру. */
  private nightLights: NightLight[] = [];
  /** Мебель в зале (в координатах центра человека): люди обходят её. */
  private obstacles: Rect[] = [];
  /** Касса самообслуживания (если куплена): картинка, экран и занята ли она. */
  private kiosk?: Phaser.GameObjects.Image;
  private kioskScreen?: Phaser.GameObjects.Rectangle;
  private kioskBusy = false;
  /** Мини-событие дня: что сейчас происходит и всё, что его рисует. */
  private liveEvent: LiveKind | null = null;
  private liveObjs: { destroy: () => void }[] = [];
  private blackout = false;
  private fuseBox?: Phaser.GameObjects.Image;
  private fuseGlow?: Phaser.FX.Glow;
  /** Утренняя закупка: сколько было на складе в начале утра и сколько коробок ещё ждут доставки. */
  private morningStock = 0;
  private awaitingBoxes = 0;
  /** Реклама на улице: промоутер с листовками, баннер на фасаде, блогер у входа. */
  private adObjs: { destroy: () => void }[] = [];
  /** Летучие мыши на Хэллоуин: видны только вечером. */
  private bats: Phaser.GameObjects.Image[] = [];
  /** Где стоят фонари: от них падают тени прохожих. */
  private lampXs: number[] = [];
  /** Поддон с водой или стойка «Акция» на местах, где полки ещё нет. */
  private slotDecor: Phaser.GameObjects.Image[] = [];
  /** Планировка следующего уровня: камера и улица рассчитаны на неё. */
  private next!: Layout;
  /** Линия тротуара, по которой ходят прохожие и приходят покупатели. */
  private streetY = 0;
  private customers = new Set<Customer>();
  private queue: Customer[] = [];
  private trash = new Set<Phaser.GameObjects.Image>();
  /** Мусор, за которым уже кто-то пошёл. */
  private claimedTrash = new Set<Phaser.GameObjects.Image>();
  private workers = new Map<StaffRole, Worker>();
  /** Смена номера останавливает циклы работы старых сотрудников. */
  private staffGen = 0;
  private toiletDirt = 0;
  /** Срочный подвоз: что едет и занят ли фургон. */
  private urgentOrders: { id: ProductId; qty: number }[] = [];
  private urgentVanBusy = false;
  /** Электронные ценники сегодня уже уценили старое. */
  private eveningMarkdown = false;
  private wcStink!: Phaser.GameObjects.Image;
  private wcDoor!: Phaser.GameObjects.Image;
  private wcBar!: Phaser.GameObjects.Image;
  private seller!: Phaser.GameObjects.Container;
  private carried!: Phaser.GameObjects.Image;
  private sellerBusy = false;
  /** Номер текущего дела продавца: смена номера отменяет дело (продавца позвали к кассе). */
  private choreId = 0;
  private lastCall = 0;
  private timeLeft = DAY_SECONDS;
  /** Инспектор: 'pending' — ещё не пришёл, 'here' — ходит по залу, 'done' — ушёл. */
  private inspector: 'none' | 'pending' | 'here' | 'done' = 'none';
  private inspection: InspectionResult | null = null;
  private rushAnnounced = false;
  /** Сколько заданий дня уже отпраздновали всплывашкой. */
  private questsSeen = 0;
  /** Кассы: основная и (если куплена) вторая слева от очереди. Очередь одна — идёт к свободной. */
  private registers: Register[] = [];
  /** Ведро с мусором в зале: сколько в нём, картинка, выносят ли его сейчас и сколько несут в мешке. */
  private binFill = 0;
  private binImg?: Phaser.GameObjects.Image;
  private binGlow?: Phaser.FX.Glow;
  private binStink?: Phaser.GameObjects.Image;
  private binBusy = false;
  /** Кто сейчас выносит мусор: продавец (его могут позвать к кассе) или уборщица. */
  private binBy: 'seller' | 'cleaner' | null = null;
  private bagCarried = 0;
  /** Продавец несёт мусор к ведру (если позовут к кассе — мусор упадёт обратно на пол). */
  private carryingTrash = false;
  /** Голуби на тротуаре: разлетаются, когда рядом проходит человек. */
  private pigeons: Pigeon[] = [];
  /** Таймеры кота и голубей: при перестройке мира старые останавливаются. */
  private critterTimers: Phaser.Time.TimerEvent[] = [];
  /** Как кафе забрало утром заказ по договору — для итогов дня. */
  private cafeToday: CafeDelivery | null = null;
  /** Ноты над радио, пока оно играет. */
  private radioTimer?: Phaser.Time.TimerEvent;
  private valyaCame = false;
  /** Серия обслуживания: сколько подряд и когда была последняя продажа. */
  private combo = 0;
  private lastSaleAt = -Infinity;
  private nextSpawn = 1;
  private running = false;
  /** Кофемашина (если куплена) и занята ли она. */
  private coffeeImg?: Phaser.GameObjects.Image;
  /** Кто сейчас у стойки кофейни делает заказ или забирает. */
  private coffeeCounter = false;
  /** Заказы кофе по очереди: бариста варит и отдаёт (done). */
  private coffeeOrders: { c: Customer; done: () => void }[] = [];
  private oven?: Oven;
  /** До какого времени в зале пахнет свежим хлебом. */
  private aromaUntil = 0;
  /** Идёт ночная смена; уже спрашивали про неё сегодня. */
  private night = false;
  private nightAsked = false;
  /** Кот у входа: картинка, где его лежанка и гуляет ли он сейчас по залу. */
  private catImg?: Phaser.GameObjects.Image;
  private catHome = { x: 0, y: 0 };
  private catOut = false;
  private reviewStar?: Phaser.GameObjects.Text;
  /** Флажки, шарики и лоток ярмарки; лоток продаёт со склада по таймеру. */
  private fairObjs: Phaser.GameObjects.GameObject[] = [];
  private stall?: Phaser.GameObjects.Image;
  private stallTimer?: Phaser.Time.TimerEvent;
  /** Доставка на дом: телефон у кассы, текущий заказ, курьер с велосипедом. */
  private phone?: Phaser.GameObjects.Image;
  private order: { data: HomeOrder; bubble: Phaser.GameObjects.Container; timer: Phaser.Time.TimerEvent } | null = null;
  private courier?: Phaser.GameObjects.Container;
  private courierBike?: Phaser.GameObjects.Image;
  private courierHome = { x: 0, y: 0 };
  private courierBusy = false;
  /** Ускорение дня (×1 или ×2). */
  private speed = 1;

  constructor() {
    super('store');
  }

  create(): void {
    const save = loadGame();
    this.state = ensurePlan(save ?? newGame());
    // Покупки за звёзды — по данным Telegram: вернутся и на новом телефоне.
    void restorePurchases().then((ids) => {
      const owned = (ids ?? []).filter(isDecorId);
      const next = grantDecor(this.state, owned, !save);
      if (next === this.state) return;
      this.state = next;
      saveGame(next);
      if (!save) this.buildWorld();
    });
    this.hud = new Hud();
    this.hud.onSpeed = () => this.running && this.setSpeed(this.speed > 1 ? 1 : 2);
    this.hud.onUrgent = () => this.openUrgent();

    this.buildWorld();
    this.hud.update(this.state, this.timeLeft);
    this.setupCameraDrag();
    // Улица живёт своей жизнью: прохожие и машины.
    this.time.addEvent({ delay: 1800, loop: true, callback: () => this.streetLife() });
    // Достижения проверяются и посреди дня: серия, сотый покупатель — сразу всплывашка.
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.running && this.checkAchievements(true) });
    // Сначала вывеска, потом утро. Первая встреча с сюжетом (письмо бабушки) — на утреннем экране.
    const stopShow = this.titleShow();
    showTitle({
      save,
      onPlay: () => {
        stopShow();
        this.showMorning();
      },
    });
  }

  /**
   * За титулом — живая улица на закате: горят фонари и неон, едут машины, идут люди,
   * камера медленно плывёт вдоль квартала. Возвращает функцию, которая вернёт камеру к магазину.
   */
  /** Ускорение дня: время, движения и таймеры идут вдвое быстрее. */
  private setSpeed(speed: number): void {
    this.speed = speed;
    this.time.timeScale = speed;
    this.tweens.timeScale = speed;
  }

  private titleShow(): () => void {
    const cam = this.cameras.main;
    this.updateLighting(0.88);
    cam.setZoom(this.baseZoom * 0.8).centerOn(this.layout.door.x - 110, this.next.h - 20);
    const pan = this.tweens.add({ targets: cam, scrollX: cam.scrollX + 220, duration: 20000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return () => {
      pan.remove();
      cam.pan(this.home.x, this.home.y, 700, 'Sine.easeInOut');
      cam.zoomTo(this.baseZoom, 700, 'Sine.easeInOut');
      this.updateLighting(0);
    };
  }

  update(_time: number, deltaMs: number): void {
    this.scarePigeons();
    ambience.update(this.weather, this.evening, this.running);
    this.hud.showSpeed(this.running && this.state.day > TUTORIAL_DAYS, this.speed);
    this.hud.showUrgent(this.running && !this.night && this.state.day > TUTORIAL_DAYS);
    if (!this.running) return;
    const dt = (deltaMs / 1000) * this.speed;
    this.timeLeft = Math.max(0, this.timeLeft - dt);

    const elapsed = DAY_SECONDS - this.timeLeft;
    // Электронные ценники: к вечеру то, что испортится ночью, уценяется само.
    if (!this.night && !this.eveningMarkdown && hasUpgrade(this.state, 'eTags') && this.timeLeft <= DAY_SECONDS * ETAGS_EVENING) {
      this.eveningMarkdown = true;
      const marked = markdownSurplus(this.state, (id) => eveningSales(this.stats.sold[id] ?? 0));
      if (marked.count) {
        this.state = marked.state;
        this.refreshShelves();
        this.popup(this.layout.w / 2, this.layout.wallH + 30, t('popup.etags', { n: marked.count }), '#c8f0ff');
      }
    }
    const rushAt = this.state.plan?.rushAt;
    const rush = !this.night && rushAt !== undefined && elapsed >= rushAt && elapsed < rushAt + RUSH_SECONDS;
    if (rush && !this.rushAnnounced) {
      this.rushAnnounced = true;
      haptic.tap();
      sound.bell();
      this.popup(this.layout.door.x, this.layout.door.y - 30, t('popup.rush'), '#fff3b0');
    }
    if (!this.night && this.inspector === 'pending' && elapsed >= INSPECTOR_AT) void this.runInspector();

    if (this.timeLeft > 0) {
      this.nextSpawn -= dt;
      const maxCustomers = storeLevel(this.state).maxCustomers + (rush ? 3 : 0);
      if (this.nextSpawn <= 0 && this.customers.size < maxCustomers) {
        this.spawnCustomer();
        const interval = spawnIntervalToday(this.state) / (rush ? 2 : 1) / (this.night ? NIGHT_GUESTS : 1);
        this.nextSpawn = interval * Phaser.Math.FloatBetween(0.7, 1.3);
      }
    } else if (this.customers.size === 0 && this.inspector !== 'here') {
      this.endOfDay();
    }

    for (const c of this.queue) this.updateBubble(c);
    for (const r of this.registers) if (r.customer) this.updateBubble(r.customer);
    this.checkSlips();
    this.updateScanBar();
    this.callSellerIfNeeded();
    this.hud.setHint(this.currentHint(), this.state.day <= TUTORIAL_DAYS);
    this.updateTutorialArrow();
    this.updateLighting(this.night ? 1 : undefined);
    this.updateDoor();
    this.pulseHighlights();
    this.animatePeople();
    this.updateOven();
    this.petCatNearby();
    this.hud.update(this.state, this.timeLeft, this.questsLine(), this.night);
  }

  /** «📋 1/3» в верхней панели: сколько заданий дня уже выполнено. */
  private questsLine(): string {
    const quests = this.state.plan?.quests ?? [];
    if (!quests.length) return '';
    const done = quests.filter((q) => questDone(q, this.stats)).length;
    if (done > this.questsSeen) {
      this.questsSeen = done;
      sound.good();
      const { sellerHome } = this.layout;
      this.popup(sellerHome.x - 20, sellerHome.y - 46, t('popup.questDone', { done, total: quests.length }), '#fee761');
    }
    return t('quest.hud', { done, total: quests.length });
  }

  private currentHint(): string {
    if (this.liveEvent) return t(`hint.${this.liveEvent}` as TextKey);
    if (this.oven?.state === 'ready') return t('hint.ovenReady');
    if (this.order) return t('hint.order');
    if (this.inspector === 'here') return t('hint.inspector');
    if (!this.workers.has('guard') && [...this.customers].some((c) => c.thief && !c.gone)) return t('hint.thief');
    if (this.sellerBusy && this.ownerRegister()) return t('hint.recall');
    if (this.ownerRegister() && this.state.day <= 2 && this.stats.served < 3) return t('hint.serve');
    // Очередь растёт — подсказать, что поможет: кассир, вторая касса или встать за неё самому.
    if (this.queue.length >= 4 && this.state.day > TUTORIAL_DAYS) {
      if (!staffOf(this.state, 'cashier')) return t('hint.queueHire');
      if (this.registers.every((_, i) => this.operator(i) !== null) && (nextRegisterCount(this.state) ?? 0) > this.registers.length)
        return t('hint.queueRegister');
    }
    const extra = this.registers.findIndex((r, i) => i > 0 && this.operator(i) === 'owner' && r.customer && !r.customer.serving);
    if (extra > 0 && !this.sellerBusy) return t('hint.register2');
    if (this.state.day <= 4 && this.shelfNeedsRestock()) return t('hint.restock');
    if (this.binFull() && !this.binBusy) return t('hint.bin');
    if ((this.trash.size > 0 || this.toiletDirt >= TOILET_DIRTY) && this.state.day <= 4) return t('hint.clean');
    return '';
  }

  /**
   * Обучение первых дней: над тем, что нужно нажать сейчас, прыгает стрелка —
   * касса, пустая полка, мусор или грязный туалет, вор.
   */
  private updateTutorialArrow(): void {
    const target = this.state.day <= TUTORIAL_DAYS || this.inspector === 'here' ? this.tutorialTarget() : null;
    if (!target) {
      this.arrow?.setVisible(false);
      return;
    }
    if (!this.arrow?.active) {
      this.arrow = this.art(0, 0, 'arrow').setScale(1.3 / ART).setDepth(LIGHT_DEPTH + 20);
    }
    const bob = Math.sin(this.time.now / 160) * 2;
    this.arrow.setVisible(true).setPosition(target.x, target.y - 12 + bob);
  }

  private tutorialTarget(): { x: number; y: number } | null {
    const { counter, wc } = this.layout;
    const thief = !this.workers.has('guard') ? [...this.customers].find((c) => c.thief && !c.gone) : undefined;
    if (thief) return { x: thief.sprite.x, y: thief.sprite.y - 12 };
    const waitingAt = this.ownerRegister();
    if (waitingAt && (this.sellerBusy || this.stats.served < 3)) return { x: waitingAt.counter.x, y: waitingAt.counter.y - 28 };
    void counter;
    if (this.shelfNeedsRestock()) {
      const index = this.shelfViews.findIndex((v) => v.needsStock);
      if (index >= 0) return { x: this.layout.slots[index].x, y: this.layout.slots[index].y - 18 };
    }
    const trash = [...this.trash].find((piece) => !this.claimedTrash.has(piece));
    if (trash) return { x: trash.x, y: trash.y - 2 };
    if (this.toiletDirt >= TOILET_DIRTY) return { x: wc.x, y: wc.y - 14 };
    return null;
  }

  /** Есть товар на складе, а на его полке он закончился. */
  private shelfNeedsRestock(): boolean {
    return PRODUCT_IDS.some(
      (id) =>
        (this.state.warehouse[id]?.length ?? 0) > 0 &&
        this.state.shelves.some((s) => canPlace(id, s) && (s.items[id]?.length ?? 0) === 0 && shelfFree(s) > 0),
    );
  }

  // ---------- Магазин ----------

  /** Строит зал под текущий уровень помещения. При расширении зал строится заново. */
  private buildWorld(): void {
    this.children.removeAll(true);
    // killAll не вызывает onStop: незаконченный шаг продавца никогда не завершится, и он
    // навсегда остался бы «занят» (не убирал бы мусор и не носил товар). Начинаем его дела заново.
    this.tweens.killAll();
    this.choreId++;
    this.sellerBusy = false;
    // Кто ждал кофе — уже не дождётся: отпускаем, чтобы никто не застрял.
    for (const o of this.coffeeOrders.splice(0)) o.done();
    this.coffeeCounter = false;
    this.carryingTrash = false;
    this.urgentVanBusy = false;
    this.shelfViews = [];
    this.boxes = [];
    this.slotDecor = [];
    this.shutters = [];
    this.nightLights = [];
    this.trash.clear();
    this.layout = layoutFor(this.state.level);
    this.builtLevel = this.state.level;

    // Камера показывает и соседнюю площадь, куда магазин вырастет: ларёк выглядит маленьким.
    const next = STORE_LEVELS[this.state.level + 1] ? layoutFor(this.state.level + 1) : this.layout;
    this.next = next;
    // Внизу кадра видна улица: тротуар и дорога с машинами.
    // Камера крупно показывает сам магазин (вывеска сверху, фасад снизу); участок под
    // расширение и улицу видно краем, а весь квартал — свайпом или отдалив двумя пальцами.
    const { w, h } = this.layout;
    // В кадре и флигель слева: склад, пекарня, кофейня.
    const viewW = w + WING_OUTER + 2 * WALL + 4;
    const viewH = h + 40;
    const zoom = Math.min(CANVAS_W / viewW, (CANVAS_H - HUD_TOP - HUD_BOTTOM) / viewH);
    const midY = HUD_TOP + (CANVAS_H - HUD_TOP - HUD_BOTTOM) / 2;
    this.baseZoom = zoom;
    // Если по высоте есть запас, вывеска прижимается под верхнюю панель — снизу видно больше улицы.
    const centered = (h + 4) / 2 + (CANVAS_H / 2 - midY) / zoom;
    this.home = { x: (w - WING_OUTER) / 2, y: Math.max(centered, -24 + (CANVAS_H / 2 - HUD_TOP) / zoom) };
    this.cameras.main.setZoom(zoom).centerOn(this.home.x, this.home.y);
    // Мягкая виньетка по краям кадра; к вечеру гуще.
    this.cameras.main.postFX?.clear();
    this.vignette = this.cameras.main.postFX?.addVignette(0.5, 0.5, 0.95, 0.2);
    this.buildStreet(next);
    this.buildCritters(next);
    this.buildNeighbors(next);
    if (next !== this.layout) this.buildForRent(next);

    this.buildStore();
    this.buildLighting(next);
    this.applyAds();
    this.refreshShelves();
    this.refreshWarehouse();
    this.refreshToilet();
    this.workers.clear();
    this.syncStaff();
    this.applyWeather();
    this.fairObjs = [];
    this.applyFair();
  }

  private buildStore(): void {
    const { w, h, wallH, wc, counter, sellerHome } = this.layout;
    // Пол богаче с каждым уровнем: тёплая плитка, прохладная плитка, мрамор.
    // Пол и цвет стен можно сменить в «Оформлении».
    const floor = activeDecor(this.state, 'floor')?.texture ?? FLOORS[Math.min(this.state.level, FLOORS.length - 1)];
    this.add.tileSprite(0, wallH, w, h - wallH, floor).setOrigin(0).setTileScale(1 / ART);
    // Стены: цветная краска за монеты или премиальная отделка (кирпич, плитка, обои) за звёзды.
    const wallDecor = activeDecor(this.state, 'wall');
    this.add
      .tileSprite(0, 0, w, wallH, wallDecor?.texture ?? 'wall')
      .setOrigin(0)
      .setTileScale(1 / ART)
      .setTint(wallDecor?.color ?? 0xffffff);
    this.buildShell();
    // Вывеска с названием на крыше; премиальная — своя доска и цвет букв.
    const sign = activeDecor(this.state, 'sign');
    const signColor = sign?.textColor ?? 0xfee761;
    this.art(w / 2, -9, sign?.texture ?? 'sign').setDepth(2);
    if (sign?.id === 'sign_marquee') {
      // Лампочки «Бродвея» перемигиваются.
      const lit = this.art(w / 2, -9, 'sign_marquee_lit').setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: lit, alpha: { from: 1, to: 0.25 }, duration: 520, yoyo: true, repeat: -1, ease: 'Stepped' });
    }
    this.add
      .text(w / 2, -9, t(storeLevel(this.state).nameKey), {
        fontFamily: UI_FONT,
        fontSize: '7px',
        color: `#${signColor.toString(16).padStart(6, '0')}`,
      })
      .setOrigin(0.5)
      .setResolution(4)
      .setDepth(3);
    this.neonSign(w / 2, -9, t(storeLevel(this.state).nameKey), '7px', signColor, 64);
    this.buildWing();
    this.buildWarehouse();
    this.buildDecor();

    this.wcDoor = this.art(wc.x, wc.y, 'wc');
    // Над грязным туалетом поднимается запах.
    this.wcStink = this.art(wc.x, wc.y - 10, 'stink').setScale(1.4 / ART).setDepth(wc.y + 30).setVisible(false);
    this.tweens.add({ targets: this.wcStink, y: wc.y - 15, alpha: { from: 1, to: 0.35 }, duration: 900, yoyo: true, repeat: -1 });
    this.art(wc.x, wc.y - 15, 'bar').setDisplaySize(14, 3).setTint(0x2b2233);
    this.wcBar = this.art(wc.x - 7, wc.y - 15, 'bar').setOrigin(0, 0.5).setDisplaySize(0, 2);
    this.add
      .zone(wc.x, wc.y + 4, 24, 36)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.tap(() => this.cleanToilet()));

    this.art(counter.x + 2, counter.y + 3, 'shadow_wide').setScale(0.62, 0.7).setAngle(90).setDepth(counter.y + 19);
    this.art(counter.x, counter.y + FURNITURE_TOP / 2, registerSprite(this.state)).setDepth(counter.y + 20);
    this.buildShowcases();
    this.buildBin();
    // Электрощиток на стене: нужен, когда отключат свет.
    this.fuseBox = this.art(wc.x - 24, 18, 'fusebox').setDepth(3);
    this.fuseBox.setInteractive({ useHandCursor: true }).on('pointerup', () => this.tap(() => this.fixFuse()));
    this.fuseGlow = this.fuseBox.preFX?.addGlow(0xfee761, 0, 0, false, 0.1, 6);
    this.registers = [];
    this.registers.push(this.makeRegister(counter, false, this.layout.queue, this.layout.sellerHome));
    this.buildUpgrades();
    void sellerHome;
    const home = this.ownerHome();
    this.seller = this.makePerson(home.x, home.y, OWNER);
    this.carried = this.art(0, 3, 'box').setVisible(false);
    this.seller.add(this.carried);
    this.add
      .zone(counter.x + 6, counter.y + 6, 40, 64)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.tap(() => this.serveNext()));
  }

  /**
   * Касса: полоска пробивки над столом, экран монитора и луч сканера. Вторая касса стоит
   * зеркально слева от очереди: её покупатель — второй в очереди, кассир — слева от стола.
   */
  private makeRegister(counter: { x: number; y: number }, mirrored: boolean, spot: { x: number; y: number }, clerk: { x: number; y: number }): Register {
    const bar = this.add.rectangle(counter.x - 9, counter.y - 31, 18, 4, 0x181425).setOrigin(0, 0.5).setDepth(1000).setVisible(false);
    const fill = this.add.rectangle(counter.x - 8, counter.y - 31, 0, 2, 0x63c74d).setOrigin(0, 0.5).setDepth(1001).setVisible(false);
    const sx = counter.x + (mirrored ? -0.5 : 0.5);
    const screen = this.add.rectangle(sx, counter.y + 10.5, 6, 3, 0xb6f58a).setDepth(counter.y + 21).setVisible(false);
    const beam = this.add
      .rectangle(sx, counter.y + 4.2, 8, 4.5, 0xff4a4a)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(counter.y + 21)
      .setVisible(false);
    return {
      counter,
      spot,
      clerk,
      customer: null,
      scan: null,
      bar,
      fill,
      screen,
      beam,
    };
  }

  /** Кто работает за кассой: нанятый кассир, сам хозяин (если основную взял кассир) или никто. */
  private operator(index: number): Worker | 'owner' | null {
    const worker = this.workers.get(CASHIER_ROLES[index]);
    if (worker) return worker;
    const free = this.registers.findIndex((_, i) => !this.workers.has(CASHIER_ROLES[i]));
    return free === index ? 'owner' : null;
  }

  /**
   * Касса номер index (с 1): нечётные — зеркально слева от очереди, чётные — справа;
   * каждая следующая пара — выше по залу. Покупатель встаёт в колонку очереди рядом со столом.
   */
  private buildRegister(index: number): void {
    const { counter, w, queue } = this.layout;
    const left = index % 2 === 1;
    const row = Math.floor(index / 2);
    const at = { x: left ? w - 64 : counter.x, y: counter.y - REGISTER_ROW * row };
    const shadowX = left ? at.x - 2 : at.x + 2;
    this.art(shadowX, at.y + 3, 'shadow_wide').setScale(0.62, 0.7).setAngle(90).setDepth(at.y + 19);
    this.art(at.x, at.y + FURNITURE_TOP / 2, registerSprite(this.state)).setFlipX(left).setDepth(at.y + 20);
    if (hasUpgrade(this.state, 'terminal')) this.art(at.x + (left ? -3 : 3), at.y - 4, 'card_terminal').setDepth(at.y + 22);
    this.obstacles.push({ x: at.x - 13, y: at.y - 30, w: 26, h: 54 });
    const spot = { x: queue.x, y: queue.y - REGISTER_ROW * row - (left ? queue.step : 0) };
    const clerk = { x: at.x + (left ? -16 : 16), y: at.y + 16 };
    this.registers.push(this.makeRegister(at, left, spot, clerk));
    this.add
      .zone(at.x + (left ? -6 : 6), at.y + 6, 40, 64)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.tap(() => this.serveNext()));
  }

  /** Хозяин сейчас пробивает кого-то. */
  private ownerScanning(): boolean {
    return this.registers.some((r) => r.scan?.byOwner);
  }

  /** Касса, у которой ждёт покупатель, а за кассой — хозяин (нужно нажать). */
  private ownerRegister(): Register | undefined {
    return this.registers.find((r, i) => this.operator(i) === 'owner' && r.customer && !r.customer.serving);
  }

  private registerOf(c: Customer): Register | undefined {
    return this.registers.find((r) => r.customer === c);
  }

  /** Покупатель уже стоит у своей кассы. */
  private atSpot(r: Register): boolean {
    const c = r.customer;
    return Boolean(c) && Phaser.Math.Distance.Between(c!.sprite.x, c!.sprite.y, r.spot.x, r.spot.y) < 2;
  }

  /** Сколько человек ждут: в очереди и у касс (кого ещё не пробивают). */
  private waiting(): number {
    return this.queue.length + this.registers.filter((r) => r.customer && !r.customer.serving).length;
  }

  /**
   * Свет: на улицу и в зал ложится оттенок времени суток (умножением цвета),
   * вечером загораются фонари и лампы в зале. Всё ниже всплывающих надписей.
   */
  private buildLighting(next: Layout): void {
    const { w, h } = this.layout;
    const far = 600;
    const shade = (x: number, y: number, ww: number, hh: number) =>
      this.add.rectangle(x, y, ww, hh, 0xffffff).setOrigin(0).setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(LIGHT_DEPTH);
    // Снаружи темнее, внутри (зал и флигель) — светлее.
    const wing = this.layout.wing;
    const left = -WING_OUTER;
    this.outdoorShades = [
      shade(-far, -far, next.w + 2 * far, far - 3),
      shade(-far, h + 3, next.w + 2 * far, far + next.h),
      shade(-far, -3, far + left - 3, h + 6),
      shade(left - 3, -3, -left, wing.y - 4 + 3),
      shade(w + 3, -3, next.w + far, h + 6),
    ];
    this.indoorShades = [shade(-3, -3, w + 6, h + 6), shade(left - 3, wing.y - 4, -left, h - wing.y + 7)];
    const glow = (x: number, y: number, size: number, color: number) =>
      this.art(x, y, 'glow').setScale(size / 64).setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(LIGHT_DEPTH + 1).setAlpha(0);
    this.lampGlows = [];
    this.lampXs = [];
    const top = next.h + 4;
    for (let x = -100; x < next.w + 40; x += 72) {
      if (!this.lampAt(x)) continue;
      this.lampXs.push(x);
      this.lampGlows.push(glow(x, this.streetY - 2, 44, 0xffc860));
      // Конус света от плафона до земли и ореол вокруг лампы.
      this.nightGlow(this.art(x, top - 19, 'light_cone').setOrigin(0.5, 0).setTint(0xffd27a), 0.6);
      this.nightGlow(this.art(x, top - 19, 'glow').setScale(16 / 64).setTint(0xfff0b0), 0.9);
    }
    this.lampGlows.push(glow(this.layout.door.x, h + 8, 40, 0xffd890));
    this.ceilingGlows = [];
    for (let y = this.layout.wallH + 40; y < h - 10; y += 64) {
      // LED светит белым, лампы накаливания — тёплым.
      for (let x = 34; x < w; x += 68) this.ceilingGlows.push(glow(x, y, 70, gearTier(this.state, 'lights') ? 0xf4f8ff : 0xfff0c8));
    }
    this.updateLighting(this.running ? undefined : 0);
  }

  /**
   * Шаги в 4 кадра (ноги: шаг, вместе, другой шаг, вместе; тело чуть подпрыгивает)
   * и дыхание, когда человек стоит. Спереди и сзади другой шаг — зеркало первого.
   */
  private animatePeople(): void {
    const now = this.time.now;
    for (const person of this.people) {
      if (!person.active) continue;
      const leader = person.getData('leader') as Phaser.GameObjects.Container | undefined;
      if (leader?.active) this.followLeader(person, leader);
      const trail = person.getData('trail') as { x: number; y: number }[] | undefined;
      const last = trail?.at(-1);
      if (trail && (!last || Phaser.Math.Distance.Between(last.x, last.y, person.x, person.y) > 0.5)) {
        trail.push({ x: person.x, y: person.y });
        if (trail.length > 40) trail.shift();
      }
      const dog = person.getData('dog') as Phaser.GameObjects.Image | undefined;
      if (dog?.active) this.updateDog(person, dog);
      const legs = person.getData('legs') as Phaser.GameObjects.Image | undefined;
      const facing = (person.getData('facing') as Facing | undefined) ?? 'down';
      const suffix = VIEW_SUFFIX[facing];
      const phase = (person.getData('phase') as number) ?? 0;
      let key = `p_legs0${suffix}`;
      let flip = facing === 'left';
      let bob = 0;
      if (person.getData('walking')) {
        const frame = Math.floor((now + phase) / 110) % 4;
        if (frame === 1) key = `p_legs1${suffix}`;
        if (frame === 3) {
          if (suffix === '_s') key = 'p_legs2_s';
          else {
            key = `p_legs1${suffix}`;
            flip = !flip;
          }
        }
        bob = frame % 2 === 0 ? -0.5 : 0;
        // Шаги слышно только у продавца — остальных было бы слишком много.
        if (person === this.seller && frame % 2 === 0 && person.getData('stepFrame') !== frame) ambience.step();
        person.setData('stepFrame', frame);
      } else {
        bob = Math.sin((now + phase) / 650) > 0.35 ? -0.5 : 0;
      }
      if (legs && (legs.texture.key !== key || legs.flipX !== flip)) legs.setTexture(key).setFlipX(flip);
      for (const img of (person.getData('upper') as Phaser.GameObjects.Image[]) ?? []) img.y = bob;
      const umbrella = person.getData('umbrella') as Phaser.GameObjects.Image | undefined;
      umbrella?.setVisible(person.y > this.layout.h + 2);
      this.lampShadow(person);
    }
  }

  /** Вечером на улице тень вытягивается в сторону от ближайшего фонаря. */
  private lampShadow(person: Phaser.GameObjects.Container): void {
    const shadow = person.getData('shadow') as Phaser.GameObjects.Image | undefined;
    if (!shadow) return;
    let lean = 0;
    if (this.evening > 0 && person.y > this.layout.h + FACADE_H && this.lampXs.length) {
      const lamp = this.lampXs.reduce((a, b) => (Math.abs(b - person.x) < Math.abs(a - person.x) ? b : a));
      lean = Phaser.Math.Clamp((person.x - lamp) / 5, -5, 5) * this.evening;
    }
    shadow.x = lean;
    shadow.scaleX = (1 + Math.abs(lean) / 5) / ART;
  }

  /** Облачко-мысль с товаром над головой. */
  private think(person: Phaser.GameObjects.Container, id: ProductId): Phaser.GameObjects.Container {
    const cloud = this.art(0, 0, 'think');
    const icon = this.art(1, -1.5, `item_${id}_0`).setScale(0.75 / ART);
    const thought = this.add.container(4, -22, [cloud, icon]).setScale(0.2);
    person.add(thought);
    this.tweens.add({ targets: thought, scale: 1, duration: 220, ease: 'Back.easeOut' });
    return thought;
  }

  /** Взял — облачко тает; не нашёл или дорого — товар перечёркнут, потом облачко тает. */
  private endThought(thought: Phaser.GameObjects.Container, failed: boolean): void {
    if (!thought.active) return;
    if (failed) thought.add(this.art(1, -1.5, 'cross'));
    this.tweens.add({ targets: thought, alpha: 0, delay: failed ? 1100 : 150, duration: 250, onComplete: () => thought.destroy() });
  }

  /** Покупатель тянется к полке; если взял — товар летит ему в руки. */
  private reachShelf(c: Customer, slot: { x: number; y: number }, id: ProductId | null): void {
    const base = (c.sprite.getData('baseScale') as number) ?? 1;
    this.tweens.add({ targets: c.sprite, scaleY: base * 1.07, duration: 140, yoyo: true, onComplete: () => c.sprite.setScale(base) });
    if (!id) return;
    const item = this.art(slot.x + Phaser.Math.Between(-12, 12), slot.y - 5, `item_${id}_0`).setDepth(c.sprite.y + 1);
    this.tweens.add({
      targets: item,
      x: c.sprite.x,
      y: c.sprite.y - 3,
      scale: 0.5 / ART,
      alpha: 0.4,
      duration: 320,
      ease: 'Quad.easeIn',
      onComplete: () => item.destroy(),
    });
  }

  /** То, что можно нажать, мягко пульсирует подсветкой: пустые полки (есть товар на складе) и мусор. */
  private pulseHighlights(): void {
    const pulse = 1.5 + Math.sin(this.time.now / 260) * 1.2;
    for (const view of this.shelfViews) if (view.glow) view.glow.outerStrength = view.needsStock ? pulse : 0;
    for (const piece of this.trash) {
      const glow = piece.getData('glow') as Phaser.FX.Glow | undefined;
      if (glow) glow.outerStrength = pulse;
    }
    if (this.binGlow) this.binGlow.outerStrength = this.binFull() && !this.binBusy ? pulse : 0;
    if (this.fuseGlow) this.fuseGlow.outerStrength = this.blackout ? pulse : 0;
  }

  /** Двери разъезжаются, когда к ним подходят. */
  private updateDoor(): void {
    const { door, h } = this.layout;
    const near = [...this.customers].some((c) => Math.abs(c.sprite.x - door.x) < 16 && Math.abs(c.sprite.y - h - 4) < 18);
    if (near && this.doorOpen === 0) ambience.chime();
    this.doorOpen = Phaser.Math.Clamp(this.doorOpen + (near ? 0.12 : -0.06), 0, 1);
    const key = this.doorOpen < 0.34 ? 'door' : this.doorOpen < 0.67 ? 'door_half' : 'door_open';
    if (this.doorImg.texture.key !== key) this.doorImg.setTexture(key);
  }

  /** Оттенок по ходу дня: тёплое утро, белый день, закат, сумерки. */
  private updateLighting(progress?: number): void {
    if (!this.indoorShades.length) return;
    const p = progress ?? Phaser.Math.Clamp(1 - this.timeLeft / DAY_SECONDS, 0, 1);
    const outdoor = mulColor(lerpKeys(OUTDOOR_LIGHT, p), WEATHER_LIGHT[this.weather]);
    // Свет отключили — в зале полумрак.
    const indoor = this.blackout ? mulColor(lerpKeys(INDOOR_LIGHT, p), 0x45456a) : lerpKeys(INDOOR_LIGHT, p);
    for (const r of this.outdoorShades) r.setFillStyle(outdoor);
    for (const r of this.indoorShades) r.setFillStyle(indoor);
    const evening = Phaser.Math.Clamp((p - 0.6) / 0.4, 0, 1);
    this.evening = evening;
    music.setMood(evening > 0.5 ? 'evening' : 'day');
    if (this.vignette) {
      this.vignette.strength = 0.2 + 0.3 * evening;
      this.vignette.radius = 0.95 - 0.12 * evening;
    }
    for (const g of this.lampGlows) g.setAlpha(0.7 * evening);
    for (const g of this.ceilingGlows) g.setAlpha(this.blackout ? 0 : 0.06 + 0.16 * evening);
    for (const bat of this.bats) bat.setAlpha(Phaser.Math.Clamp(evening * 1.5, 0, 1));
    const now = this.time.now;
    for (const light of this.nightLights) {
      let alpha = light.alpha * evening;
      // Неон зажигается не сразу: пару секунд мигает.
      if (light.neon !== undefined && evening < 0.18) alpha *= Math.sin((now + light.neon) / 41) + Math.sin((now + light.neon) / 97) > 0 ? 1 : 0.2;
      light.obj.setAlpha(alpha);
    }
  }

  /**
   * Погода дня: дождь с брызгами и зонтами, снег (белый газон, гирлянда на фасаде, ёлка в зале),
   * листопад (рыжие деревья). Частицы падают только снаружи: здание рисуется поверх них.
   */
  private applyWeather(): void {
    for (const obj of this.weatherObjs) obj.destroy();
    this.weatherObjs = [];
    this.nightLights = this.nightLights.filter((light) => light.obj.active);
    this.bats = [];
    this.weather = weatherFor(this.state.day);
    // Камера ещё не пересчитала видимую область — берём её с запасом от планировки.
    const area = { x: -80, y: -140, w: this.next.w + 160, h: this.next.h + STREET_VIEW + 220 };
    const keep = <T extends Phaser.GameObjects.GameObject>(obj: T): T => {
      this.weatherObjs.push(obj);
      return obj;
    };
    const tree = this.weather === 'snow' ? 0xdce6f2 : this.weather === 'leaves' ? 0xffb868 : 0xffffff;
    for (const g of this.greenery) g.setTint(tree);

    if (isWet(this.weather)) {
      const storm = this.weather === 'storm';
      keep(this.add.particles(0, 0, 'raindrop', {
        x: { min: area.x, max: area.x + area.w },
        y: area.y,
        speedY: { min: 240, max: 300 },
        speedX: storm ? -60 : -30,
        scale: 1 / ART,
        lifespan: (area.h / 260) * 1000,
        quantity: storm ? 4 : 3,
        frequency: storm ? 18 : 25,
      })).setDepth(-5);
      this.wetStreet(keep);
      if (storm) this.lightning(keep);
      keep(this.add.particles(0, 0, 'splash', {
        x: { min: area.x, max: area.x + area.w },
        y: { min: area.y, max: area.y + area.h },
        scale: { start: 0.3 / ART, end: 1 / ART },
        alpha: { start: 1, end: 0 },
        lifespan: 280,
        frequency: 30,
      })).setDepth(-5);
    }
    if (this.weather === 'snow') {
      for (const lawn of this.lawns) {
        keep(this.add.tileSprite(lawn.x, lawn.y, lawn.w, lawn.h, 'snow_ground').setOrigin(0).setTileScale(1 / ART).setDepth(-9.5));
      }
      keep(this.add.particles(0, 0, 'snowflake', {
        x: { min: area.x, max: area.x + area.w },
        y: area.y,
        speedY: { min: 14, max: 30 },
        speedX: { min: -10, max: 10 },
        scale: { min: 1.2 / ART, max: 2 / ART },
        lifespan: (area.h / 18) * 1000,
        frequency: 35,
      })).setDepth(-5);
      // Гирлянда на фасаде и ёлка в зале.
      const { w, wallH } = this.layout;
      this.garland([0xe43b44, 0xfee761, 0x63c74d, 0x0099db], keep);
      keep(this.art(w - 11, wallH + 14, 'xmas_tree').setDepth(wallH + 25));
    }
    if (this.weather === 'leaves') {
      keep(this.add.particles(0, 0, 'leaf', {
        x: { min: area.x, max: area.x + area.w },
        y: area.y,
        speedY: { min: 10, max: 22 },
        speedX: { min: -14, max: 6 },
        rotate: { min: 0, max: 360 },
        tint: [0xf77622, 0xfeae34, 0xb86f50, 0xe43b44],
        scale: 1.6 / ART,
        lifespan: (area.h / 12) * 1000,
        frequency: 150,
      })).setDepth(-5);
    }
    if (this.weather === 'heat') {
      // Жара: над асфальтом дрожит марево.
      keep(this.add.particles(0, 0, 'glow', {
        x: { min: area.x, max: area.x + area.w },
        y: { min: this.layout.h + 8, max: area.y + area.h },
        speedY: { min: -9, max: -4 },
        scale: { start: 0.05, end: 0.16 },
        alpha: { start: 0.14, end: 0 },
        tint: 0xfff0b8,
        lifespan: 2400,
        frequency: 70,
        blendMode: Phaser.BlendModes.ADD,
      })).setDepth(-5);
    }
    this.applySeason(keep);
    this.updateLighting(this.running ? undefined : 0);
  }

  /**
   * Ярмарка: флажки над фасадом и шарики у входа. Перерисовывается каждое утро
   * (ярмарка — один день в месяц, погода при этом может не меняться).
   */
  private applyFair(): void {
    for (const obj of this.fairObjs) obj.destroy();
    this.fairObjs = [];
    this.stall = undefined;
    if (!isFairDay(this.state.day)) return;
    const { w, h, door } = this.layout;
    const keep = <T extends Phaser.GameObjects.GameObject>(obj: T): T => {
      this.fairObjs.push(obj);
      return obj;
    };
    // Флажки треугольниками по краю крыши.
    const colors = [0xe43b44, 0xfee761, 0x0099db, 0x63c74d, 0xf77622];
    for (let x = -WALL + 3, i = 0; x < w + WALL; x += 6, i++) {
      const flag = keep(this.add.triangle(x, h + 3.5, 0, 0, 4, 0, 2, 4, colors[i % colors.length]).setDepth(h + 43));
      this.tweens.add({ targets: flag, angle: { from: -6, to: 6 }, duration: 600 + (i % 3) * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    // Связка шариков по обе стороны двери.
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const bx = door.x + side * (16 + k * 3);
        const by = h + 2 - k * 4;
        keep(this.add.line(0, 0, bx, by + 4, door.x + side * 15, h + FACADE_H + 2, 0x8b9bb4).setOrigin(0).setDepth(h + 44));
        const balloon = keep(this.add.ellipse(bx, by, 5, 6, colors[(k + (side > 0 ? 2 : 0)) % colors.length]).setDepth(h + 45));
        this.tweens.add({ targets: balloon, y: by - 1.5, duration: 900 + k * 150, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    }
    // Лоток слева от входа: торгует со склада мимо кассы.
    const at = { x: door.x - 58, y: h + FACADE_H + 14 };
    this.stall = keep(this.art(at.x, at.y, 'fair_stall').setOrigin(0.5, 1).setDepth(at.y));
  }

  /** Ярмарочный день: лоток раз в несколько секунд продаёт штуку со склада с наценкой. */
  private startStall(): void {
    this.stallTimer?.remove();
    this.stallTimer = undefined;
    if (!isFairDay(this.state.day)) return;
    let sold = 0;
    this.stallTimer = this.time.addEvent({
      delay: STALL_EVERY_SECONDS * 1000,
      loop: true,
      callback: () => {
        const stall = this.stall;
        if (!this.running || !stall?.active || sold >= STALL_MAX) return;
        const sale = stallSale(this.state, Math.random);
        if (!sale) return;
        sold++;
        this.state = sale.state;
        this.stats.revenue += sale.price;
        this.refreshWarehouse();
        sound.coin();
        this.tweens.add({ targets: stall, scaleY: 1.06 / ART, duration: 90, yoyo: true });
        this.popup(stall.x, stall.y - 18, `${PRODUCTS[sale.id].icon} +${sale.price} 💰`, '#c8ffb0');
      },
    });
  }

  /** Гирлянда по краю фасада: лампочки мигают по очереди. */
  private garland(colors: number[], keep: <T extends Phaser.GameObjects.GameObject>(obj: T) => T): void {
    const { w, h } = this.layout;
    for (let x = -WALL + 2, i = 0; x < w + WALL; x += 5, i++) {
      const bulb = keep(this.add.rectangle(x, h + 1, 1.6, 1.6, colors[i % colors.length]).setDepth(h + 42));
      this.tweens.add({ targets: bulb, alpha: 0.25, duration: 500, delay: (i % 4) * 250, yoyo: true, repeat: -1 });
    }
  }

  /**
   * Время года и праздники: весной цветут деревья и газон, летом у входа ларь с мороженым,
   * осенью желтеют деревья и лежат листья; 8 Марта — тюльпаны и розовая гирлянда,
   * Хэллоуин — тыквы со светом и летучие мыши, Новый год — снеговик и огоньки на деревьях.
   */
  private applySeason(keep: <T extends Phaser.GameObjects.GameObject>(obj: T) => T): void {
    const day = this.state.day;
    const time = yearTime(day);
    const holiday = holidayFor(day);
    const rnd = new Phaser.Math.RandomDataGenerator([`season${day}`]);
    const { door, h } = this.layout;
    const front = h + FACADE_H;
    const top = this.next.h + 4;
    const trees = this.greenery.filter((g) => g.texture.key === 'tree');
    // По всему газону вокруг: не на здании, участке «Сдаётся», соседях и улице.
    const scatter = (count: number, make: (x: number, y: number) => void) => {
      for (let placed = 0, tries = 0; placed < count && tries < count * 5; tries++) {
        const x = -190 + rnd.frac() * (this.next.w + 380);
        const y = -170 + rnd.frac() * (top + 330);
        if (y > top - 4 && y < top + 92) continue;
        if (x > -WALL - 4 && x < this.next.w + 4 && y > -14 && y < top) continue;
        if ((x < -20 || x > this.next.w + 20) && y > top - 156 && y < top) continue;
        make(x, y);
        placed++;
      }
    };
    if (this.weather !== 'leaves' && this.weather !== 'snow') {
      trees.forEach((tree, i) => {
        // Осенью кроны в рыжих и жёлтых пятнах листвы.
        if (time === 'autumn') {
          tree.setTint(i % 3 === 2 ? 0xffffff : 0xffe0a0);
          const tones = i % 3 === 2 ? [0xfeae34] : [0xf77622, 0xfeae34, 0xfee761, 0xe43b44];
          for (let n = 0; n < (i % 3 === 2 ? 5 : 22); n++) {
            keep(this.add.rectangle(tree.x + rnd.between(-9, 9), tree.y - rnd.between(5, 24), 2.4, 2.4, rnd.pick(tones)).setDepth(tree.depth + 0.5));
          }
        }
        // Весной кроны в розово-белом цвету.
        if (time === 'spring') {
          for (let n = 0; n < 14; n++) {
            keep(this.add.rectangle(tree.x + rnd.between(-9, 9), tree.y - rnd.between(5, 24), 1.6, 1.6, rnd.pick([0xffd2e2, 0xffffff, 0xf6a5c0])).setDepth(tree.depth + 0.5));
          }
        }
      });
    }
    const flowers = [0xffffff, 0xf6757a, 0xfee761, 0xb55088, 0xe43b44, 0x2ce8f5];
    if (time === 'spring' || time === 'summer') {
      scatter(time === 'spring' ? 160 : 70, (x, y) => keep(this.art(x, y, 'flower').setTint(rnd.pick(flowers)).setDepth(-9)));
    }
    if (time === 'spring') {
      // С цветущих деревьев облетают лепестки.
      keep(this.add.particles(0, 0, 'leaf', {
        x: { min: -120, max: this.next.w + 120 },
        y: -120,
        speedY: { min: 8, max: 16 },
        speedX: { min: -8, max: 8 },
        rotate: { min: 0, max: 360 },
        tint: [0xffd2e2, 0xffffff, 0xf6a5c0],
        scale: 1 / ART,
        lifespan: ((top + 200) / 12) * 1000,
        frequency: 260,
      })).setDepth(-5);
    }
    if (time === 'summer') keep(this.art(door.x - 26, front + 7, 'icecream').setDepth(front + 12));
    if (time === 'autumn' && this.weather !== 'snow') {
      scatter(110, (x, y) => keep(this.art(x, y, 'leaf').setTint(rnd.pick([0xf77622, 0xfeae34, 0xb86f50, 0xe43b44])).setAngle(rnd.angle()).setDepth(-9)));
    }

    if (holiday === 'march8') {
      this.garland([0xf6757a, 0xffffff, 0xe43b44, 0xffd2e2], keep);
      keep(this.art(door.x - 26, front + 6, 'tulips').setDepth(front + 12));
    }
    if (holiday === 'halloween') {
      this.garland([0xf77622, 0x68386c, 0xfeae34, 0x68386c], keep);
      for (const dx of [-20, 18]) {
        keep(this.art(door.x + dx, front + 5, 'pumpkin').setDepth(front + 8));
        // Вечером внутри тыкв горит свет.
        keep(this.nightGlow(this.art(door.x + dx, front + 5, 'glow').setScale(18 / 64).setTint(0xffa040), 0.9));
      }
      for (let i = 0; i < 4; i++) {
        const bat = keep(this.art(door.x, -40, 'bat0').setScale(1.6 / ART).setDepth(LIGHT_DEPTH + 2));
        this.bats.push(bat);
        const cx = this.layout.w / 2 + rnd.between(-60, 60);
        const cy = rnd.between(-48, -30);
        this.tweens.addCounter({
          from: 0,
          to: Math.PI * 2,
          duration: rnd.between(5000, 8000),
          repeat: -1,
          onUpdate: (tw) => {
            const a = (tw.getValue() ?? 0) + i;
            bat.setPosition(cx + Math.cos(a) * 46, cy + Math.sin(a * 2) * 10).setTexture(Math.floor(this.time.now / 140 + i) % 2 ? 'bat0' : 'bat1');
          },
        });
      }
    }
    if (holiday === 'newyear') {
      keep(this.art(-40, top - 190, 'snowman').setDepth(top - 180));
      // Разноцветные огоньки на деревьях.
      const colors = [0xe43b44, 0xfee761, 0x63c74d, 0x0099db, 0xffffff];
      trees.forEach((tree) => {
        for (let i = 0; i < 6; i++) {
          const bulb = keep(this.add.rectangle(tree.x + rnd.between(-8, 8), tree.y - rnd.between(6, 22), 1.4, 1.4, rnd.pick(colors)).setDepth(tree.depth + 1));
          this.tweens.add({ targets: bulb, alpha: 0.2, duration: rnd.between(400, 900), yoyo: true, repeat: -1 });
        }
      });
    }
  }

  /** Терминал на прилавке и касса самообслуживания у правой стены — если куплены. */
  private buildUpgrades(): void {
    const { counter, w, wallH } = this.layout;
    if (hasUpgrade(this.state, 'terminal')) this.art(counter.x + 3, counter.y - 4, 'card_terminal').setDepth(counter.y + 22);
    for (let i = 1; i < registerCount(this.state); i++) this.buildRegister(i);
    this.buildGearProps();
    this.buildCoffee();
    this.buildOven();
    this.buildRadio();
    this.buildDelivery();
    this.kiosk = undefined;
    this.kioskBusy = false;
    if (!hasUpgrade(this.state, 'selfCheckout')) return;
    const at = { x: w - 8, y: wallH + 86 };
    this.kiosk = this.art(at.x, at.y, 'kiosk').setDepth(at.y + 9);
    this.kioskScreen = this.add.rectangle(at.x, at.y - 9, 6, 4, 0x2ce8f5).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3).setDepth(at.y + 10);
    this.obstacles.push({ x: at.x - 7, y: at.y - 12, w: 14, h: 16 });
  }

  /** Радио на прилавке: касание переключает волну, пока играет — над ним плывут ноты. */
  private buildRadio(): void {
    this.radioTimer?.remove();
    this.radioTimer = undefined;
    music.setStation(null);
    if (!hasRadio(this.state)) return;
    const { counter } = this.layout;
    const at = { x: counter.x, y: counter.y + 24 };
    const radio = this.art(at.x, at.y, 'radio').setDepth(counter.y + 22);
    radio.setInteractive({ useHandCursor: true }).on('pointerup', () =>
      this.tap(() => {
        const next = setStation(this.state, nextStation(stationOf(this.state)));
        if (!next) return;
        this.state = next;
        saveGame(next);
        sound.tap();
        this.tweens.add({ targets: radio, scaleX: radio.scaleX * 1.15, scaleY: radio.scaleY * 1.15, duration: 90, yoyo: true });
        this.popup(at.x, at.y - 10, t('popup.radio', { name: t(STATION_INFO[stationOf(next)].nameKey) }), '#fee761');
        this.applyRadio();
      }),
    );
    this.radioTimer = this.time.addEvent({
      delay: 900,
      loop: true,
      callback: () => {
        const station = stationOf(this.state);
        if (station === 'off') return;
        const note = this.add
          .text(at.x + Phaser.Math.Between(-3, 3), at.y - 6, Math.random() < 0.5 ? '♪' : '♫', {
            fontFamily: UI_FONT,
            fontSize: '7px',
            color: station === 'hits' ? '#f6757a' : '#fee761',
          })
          .setOrigin(0.5)
          .setResolution(4)
          .setDepth(1000);
        this.tweens.add({
          targets: note,
          y: note.y - 16,
          x: note.x + Phaser.Math.Between(-6, 6),
          alpha: 0,
          duration: station === 'hits' ? 1100 : 1700,
          onComplete: () => note.destroy(),
        });
      },
    });
    this.applyRadio();
  }

  /** Волна радио — в музыку. */
  private applyRadio(): void {
    const station = stationOf(this.state);
    music.setStation(station === 'off' ? null : station);
  }

  /** Скорость покупателей: под бодрое радио ходят быстрее. */
  private customerSpeed(): number {
    return CUSTOMER_SPEED * radioSpeed(this.state);
  }

  /**
   * Оборудование, которое видно в зале: рохля, погрузчик или автосклад на складе, вентиляторы
   * или кондиционер на стене, камеры под потолком, решётка и тепловая завеса у входа,
   * экран на фасаде и датчик у туалета.
   */
  private buildGearProps(): void {
    const { w, h, door, warehouse, wc } = this.layout;
    const tier = (id: GearId) => gearTier(this.state, id);
    const store = tier('warehouse');
    if (store === 3) this.art(warehouse.x + warehouse.w - 13, warehouse.y + 12, 'autostore').setDepth(warehouse.y + 60);
    else if (store) this.art(warehouse.x + 11, h - 11, store === 1 ? 'pallet_jack' : 'forklift').setDepth(h - 4);
    const climate = tier('climate');
    // На стене между постером, часами и окном (они висят через 32 от x = 30) — свободные места.
    if (climate === 1) {
      for (const x of [46, 78]) {
        this.art(x, 13, 'fan_base').setDepth(4);
        const blades = this.art(x, 13, 'fan_blades').setDepth(5);
        this.tweens.add({ targets: blades, angle: 360, duration: 700, repeat: -1 });
      }
    } else if (climate === 2) {
      const ac = this.art(126, 7, 'ac_wall').setDepth(4);
      // Струйки холодного воздуха из кондиционера.
      for (let i = 0; i < 3; i++) {
        const puff = this.add.rectangle(ac.x - 8 + i * 8, ac.y + 6, 1, 3, 0xc8f0ff, 0.6).setDepth(5);
        this.tweens.add({ targets: puff, y: ac.y + 14, alpha: 0, duration: 1100, delay: i * 300, repeat: -1 });
      }
    }
    const cams = tier('cameras');
    const camSpots = cams === 2 ? [{ x: w - 5, y: 3, flip: true }, { x: 5, y: 3, flip: false }, { x: w / 2, y: 3, flip: false }] : cams === 1 ? [{ x: w - 5, y: 3, flip: true }] : [];
    for (const spot of camSpots) {
      this.art(spot.x, spot.y, 'cam').setFlipX(spot.flip).setDepth(6);
      const led = this.add.rectangle(spot.x + (spot.flip ? 2 : -2), spot.y + 1, 1, 1, 0xff4a4a).setDepth(7);
      this.tweens.add({ targets: led, alpha: 0.1, duration: 600, yoyo: true, repeat: -1 });
    }
    if (tier('entrance') === 2) this.art(door.x, h - 2, 'air_curtain').setDepth(h + 3);
    if (tier('lights') === 2) {
      const screen = this.art(w / 2 + 50, -9, 'facade_screen0').setDepth(3);
      this.time.addEvent({ delay: 1400, loop: true, callback: () => screen.active && screen.setTexture(screen.texture.key === 'facade_screen0' ? 'facade_screen1' : 'facade_screen0') });
    }
    if (tier('wc')) {
      const sensor = this.add.rectangle(wc.x + 9, wc.y - 13, 2, 2, tier('wc') === 2 ? 0x2ce8f5 : 0x63c74d).setDepth(wc.y + 2);
      this.tweens.add({ targets: sensor, alpha: 0.3, duration: 900, yoyo: true, repeat: -1 });
    }
  }

  // ---------- Доставка на дом ----------

  /** Телефон на кассе и курьер с велосипедом у входа (если доставка куплена). */
  private buildDelivery(): void {
    this.phone = undefined;
    this.order = null;
    this.courier = undefined;
    this.courierBusy = false;
    if (!hasUpgrade(this.state, 'delivery')) return;
    const { counter, door, h } = this.layout;
    this.phone = this.art(counter.x - 5, counter.y - 9, 'phone').setDepth(counter.y + 22);
    this.phone.setInteractive(new Phaser.Geom.Rectangle(-6, -6, 22, 20), Phaser.Geom.Rectangle.Contains).on('pointerup', () => this.tap(() => this.acceptOrder()));
    // Курьер ждёт у входа рядом со своим велосипедом.
    const at = { x: door.x - 36, y: h + FACADE_H + 9 };
    this.courierHome = at;
    this.courierBike = this.art(at.x + 9, at.y + 2, 'bike').setDepth(at.y + 1);
    this.courier = this.makePerson(at.x, at.y, { ...randomLook(0xf77622), style: 'cap', hair: 0xf77622, bag: 'backpack', bagTint: 0xe43b44 });
  }

  /** Звонок: заказ на пару товаров; над телефоном — облачко с тем, что просят. */
  private scheduleOrder(): void {
    if (!this.phone) return;
    this.time.delayedCall(Phaser.Math.FloatBetween(ORDER_EVERY[0], ORDER_EVERY[1]) * 1000, () => this.ringPhone());
  }

  private ringPhone(): void {
    const phone = this.phone;
    if (!phone?.active || !this.running) return;
    if (this.order || this.courierBusy) {
      this.scheduleOrder();
      return;
    }
    const data = makeHomeOrder(this.state, Math.random);
    if (!data) {
      this.scheduleOrder();
      return;
    }
    sound.bell();
    this.time.delayedCall(350, () => sound.bell());
    haptic.tap();
    this.popup(phone.x, phone.y - 14, t('popup.order'), '#fff3b0');
    this.tweens.add({ targets: phone, angle: { from: -12, to: 12 }, duration: 70, yoyo: true, repeat: 7, onComplete: () => phone.setAngle(0) });
    // Облачко: какие товары заказали.
    const bubble = this.add.container(phone.x, phone.y - 16).setDepth(1000);
    const width = 4 + data.items.length * 9;
    bubble.add(this.add.rectangle(0, 0, width, 9, 0xffffff).setStrokeStyle(0.6, 0x181425));
    data.items.forEach((item, i) => {
      bubble.add(this.art(-width / 2 + 6.5 + i * 9, -0.5, `item_${item.id}`).setScale(1.3 / ART));
      bubble.add(this.add.text(-width / 2 + 9.5 + i * 9, 2.5, String(item.qty), { fontFamily: UI_FONT, fontSize: '4px', fontStyle: 'bold', color: '#181425' }).setOrigin(0.5).setResolution(6));
    });
    this.tweens.add({ targets: bubble, y: bubble.y - 1.5, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const timer = this.time.delayedCall(ORDER_TIMEOUT * 1000, () => {
      if (!this.order || this.order.bubble !== bubble) return;
      this.order = null;
      bubble.destroy();
      sound.bad();
      this.popup(phone.x, phone.y - 14, t('popup.orderMissed'), '#ffd0d0');
      this.scheduleOrder();
    });
    this.order = { data, bubble, timer };
  }

  /** Нажали на телефон: собираем заказ, курьер уезжает и привозит деньги. */
  private acceptOrder(): void {
    const order = this.order;
    const phone = this.phone;
    if (!order || !phone) return;
    order.timer.remove();
    order.bubble.destroy();
    this.order = null;
    const packed = packHomeOrder(this.state, order.data);
    if (!packed) {
      sound.bad();
      this.popup(phone.x, phone.y - 14, t('popup.orderNoStock'), '#ffd0d0');
      this.scheduleOrder();
      return;
    }
    this.state = packed;
    this.refreshShelves();
    this.refreshWarehouse();
    haptic.success();
    sound.tap();
    this.popup(phone.x, phone.y - 14, t('popup.orderGo'), '#c8ffb0');
    void this.rideCourier(order.data.pay);
  }

  /** Курьер садится на велосипед, уезжает по тротуару и возвращается с деньгами. */
  private async rideCourier(pay: number): Promise<void> {
    const courier = this.courier;
    const bike = this.courierBike;
    if (!courier?.active || !bike) return;
    this.courierBusy = true;
    const home = this.courierHome;
    const ride = this.art(0, 3, 'bike').setOrigin(0.5);
    courier.addAt(ride, 0);
    bike.setVisible(false);
    const road = this.streetY + 2;
    const away = -80;
    await this.walk(courier, home.x, road, 70);
    await this.walk(courier, away, road, 70);
    await this.wait((DELIVERY_SECONDS * 1000) / 3);
    if (!courier.active) return;
    await this.walk(courier, home.x, road, 70);
    await this.walk(courier, home.x, home.y, 70);
    if (!courier.active) return;
    ride.destroy();
    bike.setVisible(true);
    this.setFacing(courier, 'down');
    this.courierBusy = false;
    this.state = { ...this.state, money: this.state.money + pay };
    this.stats.revenue += pay;
    this.stats.deliveries = (this.stats.deliveries ?? 0) + 1;
    sound.coin();
    this.popup(courier.x, courier.y - 16, t('popup.orderPaid', { n: pay }), '#c8ffb0');
    this.scheduleOrder();
  }

  // ---------- Мышь на складе ----------

  /**
   * Мышь бегает по складу и раз в несколько секунд грызёт товар. Нажми на неё — убежит.
   * Сытый кот сам прибегает и ловит её.
   */
  private mouseInWarehouse(keep: <T extends { destroy: () => void }>(obj: T) => T): void {
    const { warehouse } = this.layout;
    const point = () => ({ x: warehouse.x + 8 + Math.random() * (warehouse.w - 16), y: warehouse.y + 16 + Math.random() * Math.max(4, warehouse.h - 24) });
    const start = point();
    const mouse = keep(this.art(start.x, start.y, 'mouse0').setDepth(LIGHT_DEPTH - 3));
    mouse.setInteractive(new Phaser.Geom.Circle(6, 3.5, 16), Phaser.Geom.Circle.Contains).on('pointerup', () => this.tap(() => this.mouseGone(mouse, false)));
    const run = () => {
      if (!mouse.active || mouse.getData('caught')) return;
      const p = point();
      mouse.setFlipX(p.x > mouse.x);
      this.tweens.add({
        targets: mouse,
        x: p.x,
        y: p.y,
        duration: 500 + Math.random() * 400,
        onUpdate: () => mouse.setTexture(Math.floor(this.time.now / 90) % 2 ? 'mouse0' : 'mouse1'),
      });
    };
    keep(this.time.addEvent({ delay: 1100, loop: true, callback: run }));
    // Грызёт: штука товара со склада пропадает.
    keep(
      this.time.addEvent({
        delay: MOUSE_BITE_MS,
        loop: true,
        callback: () => {
          if (!mouse.active || mouse.getData('caught')) return;
          const id = PRODUCT_IDS.find((p) => (this.state.warehouse[p] ?? []).some((u) => !u.pending));
          if (!id) return;
          const units = this.state.warehouse[id]!;
          const i = units.findIndex((u) => !u.pending);
          this.state = { ...this.state, warehouse: { ...this.state.warehouse, [id]: units.filter((_, n) => n !== i) } };
          this.stats.spoiled++;
          this.refreshWarehouse();
          sound.tap();
          this.popup(mouse.x, mouse.y - 8, t('popup.mouseBite', { icon: PRODUCTS[id].icon }), '#ffd0d0');
        },
      }),
    );
    keep(this.time.delayedCall(MOUSE_STAY_MS, () => mouse.active && this.mouseGone(mouse, false, true)));
    // Сытый кот чует мышь и прибегает.
    if (this.catImg?.active && !this.catOut && this.state.cat && fedToday(this.state)) {
      keep(this.time.delayedCall(3000, () => mouse.active && void this.catHunt(mouse)));
    }
  }

  /** Мышь убежала (прогнали или сама ушла) или её поймал кот. */
  private mouseGone(mouse: Phaser.GameObjects.Image, caught: boolean, timeout = false): void {
    if (!mouse.active || mouse.getData('caught')) return;
    mouse.setData('caught', true);
    this.tweens.killTweensOf(mouse);
    if (!timeout) this.stats.mice = (this.stats.mice ?? 0) + 1;
    if (caught) {
      sound.meow();
      this.popup(mouse.x, mouse.y - 10, t('popup.mouseCaught', { name: this.state.cat?.name ?? '' }), '#c8ffb0');
      this.time.delayedCall(300, () => this.endLiveEvent());
      return;
    }
    if (!timeout) {
      sound.good();
      this.popup(mouse.x, mouse.y - 10, t('popup.mouseScared'), '#c8ffb0');
    }
    const { x: wx, h: wh, y: wy } = this.layout.warehouse;
    mouse.setFlipX(false);
    this.tweens.add({ targets: mouse, x: wx + 2, y: wy + wh - 4, alpha: 0, duration: 700, onComplete: () => this.endLiveEvent() });
  }

  /** Кот бежит на склад и ловит мышь. */
  private async catHunt(mouse: Phaser.GameObjects.Image): Promise<void> {
    const cat = this.catImg;
    if (!cat?.active || this.catOut) return;
    this.catOut = true;
    this.tweens.killTweensOf(cat);
    cat.setScale(1 / ART).setOrigin(0.5, 1).setTexture('cat_walk0');
    sound.meow();
    const { door, h, warehouse } = this.layout;
    const route = [{ x: door.x + 6, y: this.catHome.y }, { x: door.x + 6, y: h - 6 }, warehouse.doorway, warehouse.inside];
    for (const p of route) {
      await this.catStep(p.x, p.y);
      if (!cat.active) return;
    }
    if (mouse.active && !mouse.getData('caught')) {
      await this.catStep(mouse.x, mouse.y + 4);
      if (mouse.active && !mouse.getData('caught')) {
        this.mouseGone(mouse, true);
        this.heartAt(cat.x, cat.y - 10);
      }
    }
    const back = [warehouse.inside, warehouse.doorway, { x: door.x + 6, y: h - 6 }, { x: door.x + 6, y: this.catHome.y }, this.catHome];
    for (const p of back) {
      await this.catStep(p.x, p.y);
      if (!cat.active) return;
    }
    cat.setTexture('cat').setFlipX(false).setDepth(this.catHome.y + 7.5);
    this.tweens.add({ targets: cat, scaleY: 1.08 / ART, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.catOut = false;
  }

  /** Кофейня во флигеле: кофемашина у стены, стойка, за ней бариста; в углу столик. */
  private buildCoffee(): void {
    this.coffeeImg = undefined;
    if (!this.coffeeOpen()) return;
    const { x, y } = this.layout.coffee;
    this.coffeeImg = this.art(x + 10, y + 19, coffeeSprite(this.state)).setDepth(y + 20);
    this.art(x + 22, y + 28, 'coffee_bar').setDepth(y + 34);
    this.art(x + 47, y + 49, 'cafe_table').setDepth(y + 55);
  }

  /** У стойки: где делают заказ и куда отходят ждать (у столика и у стены). */
  private coffeeSpots(): { order: { x: number; y: number }; wait: { x: number; y: number }[] } {
    const { x, y } = this.layout.coffee;
    return {
      order: { x: x + 24, y: y + 43 },
      wait: [
        { x: x + 38, y: y + 45 },
        { x: x + 10, y: y + 47 },
        { x: x + 54, y: y + 40 },
      ],
    };
  }

  /**
   * Покупатель с покупками иногда заходит в кофейню: подходит к стойке, заказывает,
   * отходит ждать; бариста варит заказы по очереди и зовёт — покупатель забирает стаканчик.
   * Платят на кассе вместе с покупками.
   */
  private async buyCoffee(c: Customer): Promise<void> {
    const machine = this.coffeeImg;
    const barista = this.workers.get('barista');
    if (!machine?.active || !barista || this.coffeeOrders.length >= COFFEE_WAITING || c.thief || c.items.length === 0) return;
    if (Math.random() >= coffeeChance(this.state)) return;
    const next = useCup(this.state);
    if (!next) return;
    this.state = next;
    const room = this.layout.coffee;
    const spots = this.coffeeSpots();
    const alive = () => !c.gone && c.sprite.active;
    for (const p of [room.doorway, room.inside]) await this.walk(c.sprite, p.x, p.y);
    // К стойке по одному: пока там кто-то заказывает или забирает — подождать.
    await this.waitCounter(c);
    if (!alive()) return;
    this.coffeeCounter = true;
    await this.walk(c.sprite, spots.order.x, spots.order.y);
    if (!alive()) {
      this.coffeeCounter = false;
      return;
    }
    this.setFacing(c.sprite, 'up');
    this.popup(c.sprite.x, c.sprite.y - 18, t(Phaser.Utils.Array.GetRandom(COFFEE_ORDERS)), '#ffffff');
    await this.wait(900);
    this.coffeeCounter = false;
    if (!alive()) return;
    // Отходит ждать, пока сварят.
    const spot = spots.wait[this.coffeeOrders.length % spots.wait.length];
    const ready = new Promise<void>((done) => this.coffeeOrders.push({ c, done }));
    await this.walk(c.sprite, spot.x, spot.y);
    if (alive()) this.setFacing(c.sprite, 'up');
    await ready;
    if (!alive() || !this.sys.isActive()) return;
    await this.waitCounter(c);
    this.coffeeCounter = true;
    await this.walk(c.sprite, spots.order.x + 6, spots.order.y);
    this.coffeeCounter = false;
    if (!alive()) return;
    const cup = this.art(5, 1, 'cup');
    c.sprite.add(cup);
    c.extras = [...(c.extras ?? []), { kind: 'coffee', price: coffeePrice(this.state) }];
    this.stats.coffees = (this.stats.coffees ?? 0) + 1;
    sound.pop(2);
    this.popup(c.sprite.x, c.sprite.y - 18, t('popup.coffee', { n: coffeePrice(this.state) }), '#fff3b0');
    if (cupsOf(this.state) === 0) this.time.delayedCall(900, () => this.popup(machine.x + 10, machine.y - 16, t('popup.noCups'), '#ffd0d0'));
    for (const p of [room.inside, room.doorway]) await this.walk(c.sprite, p.x, p.y);
  }

  /** Подождать, пока у стойки освободится место (не дольше 8 секунд). */
  private async waitCounter(c: Customer): Promise<void> {
    for (let i = 0; i < 32 && this.coffeeCounter && !c.gone; i++) await this.wait(250);
  }

  /** Бариста варит заказы по очереди: пар над машиной, «Готово!» — покупатель подходит за стаканчиком. */
  private async baristaLoop(w: Worker, gen: number): Promise<void> {
    while (this.alive(gen)) {
      const order = this.coffeeOrders[0];
      const machine = this.coffeeImg;
      if (!order || !machine?.active) {
        if (Phaser.Math.Distance.Between(w.sprite.x, w.sprite.y, w.home.x, w.home.y) > 2) await this.workerWalk(w, w.home.x, w.home.y);
        this.setFacing(w.sprite, 'down');
        await this.wait(300);
        continue;
      }
      // К машине: варит, над машиной пар.
      await this.workerWalk(w, machine.x + 7, w.home.y);
      if (!this.alive(gen)) return;
      this.setFacing(w.sprite, 'left');
      sound.hiss(brewSeconds(this.state) * 0.8, 2600, 0.035);
      const steam = this.time.addEvent({ delay: 260, repeat: Math.floor((brewSeconds(this.state) * 1000) / 260), callback: () => this.steamPuff(machine.x, machine.y - 6) });
      await this.workerWait(w, brewSeconds(this.state) * 1000);
      steam.remove();
      if (!this.alive(gen)) return;
      await this.workerWalk(w, w.home.x, w.home.y);
      this.setFacing(w.sprite, 'down');
      this.popup(w.sprite.x, w.sprite.y - 18, t('popup.coffeeReady'), '#c8ffb0');
      if (this.coffeeOrders[0] === order) this.coffeeOrders.shift();
      order.done();
      await this.wait(500);
    }
  }

  /** Облачко пара: поднимается и тает. */
  private steamPuff(x: number, y: number, tint = 0xffffff): void {
    const puff = this.art(x + Phaser.Math.FloatBetween(-2, 2), y, 'glow').setScale(0.08).setTint(tint).setAlpha(0.7).setDepth(LIGHT_DEPTH - 2);
    this.tweens.add({ targets: puff, y: y - 10, scale: 0.16, alpha: 0, duration: 900, ease: 'Sine.easeOut', onComplete: () => puff.destroy() });
  }

  /** Шоколадка со стойки у кассы летит в руки стоящему в очереди. */
  private grabCandy(c: Customer): void {
    const next = takeCandy(this.state);
    if (!next) return;
    this.state = next;
    c.extras = [...(c.extras ?? []), { kind: 'candy', price: CANDY_PRICE }];
    const { counter } = this.layout;
    const candy = this.art(counter.x, counter.y + 36, 'candy').setDepth(1000);
    this.tweens.add({
      targets: candy,
      x: c.sprite.x + 4,
      y: c.sprite.y - 2,
      duration: 420,
      ease: 'Quad.easeOut',
      onComplete: () => {
        candy.destroy();
        sound.pop(3);
        if (c.sprite.active && !c.gone) this.popup(c.sprite.x, c.sprite.y - 18, t('popup.candy', { n: CANDY_PRICE }), '#fff3b0');
      },
    });
  }

  // ---------- Печь ----------

  /** Печь в пекарне во флигеле: окошко светится, пока печётся; рядом стеллаж с хлебом и стол пекаря. */
  private buildOven(): void {
    this.oven?.timer?.remove();
    this.oven = undefined;
    if (!this.bakeryOpen()) return;
    const room = this.layout.bakery;
    this.art(room.x + 31, room.y + 24, 'bread_rack').setDepth(room.y + 33);
    this.art(room.x + 26, room.y + 44, 'baker_table').setDepth(room.y + 50);
    const at = { x: room.x + 11, y: room.y + 25 };
    const img = this.art(at.x, at.y, ovenSprite(this.state)).setDepth(at.y + 9);
    const glow = this.add.rectangle(at.x, at.y + 1.5, 7, 3, 0xf77622).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(at.y + 10);
    const bread = this.art(at.x, at.y + 1.5, 'oven_bread').setDepth(at.y + 11).setVisible(false);
    const bar = this.add.rectangle(at.x - 8, at.y - 13, 16, 3, 0x181425).setOrigin(0, 0.5).setDepth(1000).setVisible(false);
    const fill = this.add.rectangle(at.x - 7.5, at.y - 13, 0, 2, 0xfeae34).setOrigin(0, 0.5).setDepth(1001).setVisible(false);
    const fx = img.preFX?.addGlow(0xfee761, 0, 0, false, 0.1, 6);
    this.oven = { img, glow, bread, bar, fill, fx, state: 'idle', start: 0, product: 'bread' };
    img.setInteractive({ useHandCursor: true }).on('pointerup', () => this.tap(() => this.tapOven()));
  }

  /** Печью занимается пекарь: без него пекарня стоит, касание подсказывает, что делать. */
  private tapOven(): void {
    const oven = this.oven;
    if (!oven || !this.running) return;
    const why = bakeryWorking(this.state) ? t('popup.bakerWorks') : t('popup.needBaker');
    this.popup(oven.img.x + 10, oven.img.y - 18, why, bakeryWorking(this.state) ? '#fff3b0' : '#ffd0d0');
  }

  /** Пекарь ставит противень: деньги за муку, через время хлеб готов. */
  private startOven(product: ProductId = 'bread'): void {
    const oven = this.oven;
    if (!oven || oven.state !== 'idle') return;
    const next = product === 'bread' ? startBatch(this.state) : startBrandBatch(this.state, product);
    if (!next) {
      const why = this.state.money < ovenBatchCost(this.state) ? t('popup.ovenMoney') : t('popup.ovenFull');
      this.popup(oven.img.x - 10, oven.img.y - 18, why, '#ffd0d0');
      sound.bad();
      return;
    }
    this.state = next;
    haptic.tap();
    sound.hiss(0.5, 900, 0.04);
    const cost = product === 'bread' ? ovenBatchCost(this.state) : brandBatchCost(product);
    this.popup(oven.img.x - 10, oven.img.y - 18, `${PRODUCTS[product].icon} ${t('popup.ovenStart', { n: cost })}`, '#fff3b0');
    oven.product = product;
    oven.state = 'baking';
    oven.start = this.time.now;
    oven.timer = this.time.delayedCall(ovenBake(this.state) * 1000, () => this.breadReady());
  }

  private breadReady(): void {
    const oven = this.oven;
    if (!oven?.img.active || oven.state !== 'baking') return;
    oven.state = 'ready';
    oven.start = this.time.now;
    oven.bread.setVisible(true);
    sound.bell();
    this.tweens.add({ targets: oven.img, scaleY: 1.08 / ART, duration: 120, yoyo: true, repeat: 1 });
    // Пекарь рядом и вынет сам; если он ушёл (заболел посреди дня) — хлеб может сгореть.
    if (!this.workers.get('baker')) oven.timer = this.time.delayedCall(OVEN_BURN_SECONDS * 1000, () => this.burnBread());
  }

  /** Не вынули вовремя — хлеб сгорел, из печи валит чёрный дым. */
  private burnBread(): void {
    const oven = this.oven;
    if (!oven?.img.active || oven.state !== 'ready') return;
    this.resetOven();
    this.stats.burnt = (this.stats.burnt ?? 0) + 1;
    sound.bad();
    haptic.error();
    this.popup(oven.img.x - 10, oven.img.y - 20, t('popup.ovenBurnt'), '#ffd0d0');
    for (let i = 0; i < 8; i++) this.time.delayedCall(i * 160, () => this.steamPuff(oven.img.x, oven.img.y - 8, 0x3a3046));
  }

  private resetOven(): void {
    const oven = this.oven;
    if (!oven) return;
    oven.timer?.remove();
    oven.state = 'idle';
    oven.bread.setVisible(false);
    oven.glow.setAlpha(0);
    oven.bar.setVisible(false);
    oven.fill.setVisible(false);
    if (oven.fx) oven.fx.outerStrength = 0;
  }

  /**
   * Пекарь: ставит противень, когда на хлебных полках есть место, пока печётся — месит тесто,
   * готовый хлеб выносит в зал на хлебную полку. По залу от двери пекарни идёт запах хлеба.
   */
  private async bakerLoop(w: Worker, gen: number): Promise<void> {
    const room = this.layout.bakery;
    while (this.alive(gen)) {
      const oven = this.oven;
      if (!this.running || !oven?.img.active) {
        await this.wait(500);
        continue;
      }
      const atOven = { x: oven.img.x + 10, y: oven.img.y + 12 };
      if (oven.state === 'ready') {
        await this.workerWalk(w, atOven.x, atOven.y);
        await this.workerWait(w, 400);
        if (!this.alive(gen)) return;
        if (oven.state !== 'ready') continue;
        const product = oven.product;
        this.resetOven();
        w.carried.setTexture('bread_tray').setPosition(0, 1).setVisible(true);
        const index = this.breadShelfIndex(product);
        const slot = index >= 0 ? this.layout.slots[index] : null;
        await this.workerWalk(w, room.inside.x, room.inside.y);
        await this.workerWalk(w, room.doorway.x, room.doorway.y);
        if (slot) await this.workerWalk(w, slot.x, slot.y + 20);
        await this.workerWait(w, PLACE_MS);
        if (!this.alive(gen)) return;
        w.carried.setVisible(false).setTexture('box').setPosition(0, 3);
        this.freshBread(slot ? { x: slot.x, y: slot.y - 18 } : room.doorway, product);
        await this.workerWalk(w, room.doorway.x, room.doorway.y);
        await this.workerWalk(w, room.inside.x, room.inside.y);
        continue;
      }
      // Сначала хлеб; когда хлеба хватает — своя выпечка «От бабушки».
      const next = oven.state === 'idle' ? (bakerShouldBake(this.state) ? 'bread' : brandToBake(this.state)) : null;
      if (next) {
        await this.workerWalk(w, atOven.x, atOven.y);
        if (!this.alive(gen)) return;
        this.startOven(next);
        continue;
      }
      // Пока печётся — месит тесто у стола.
      if (Phaser.Math.Distance.Between(w.sprite.x, w.sprite.y, w.home.x, w.home.y) > 2) await this.workerWalk(w, w.home.x, w.home.y);
      this.setFacing(w.sprite, 'up');
      await this.wait(600);
    }
  }

  /** Хлебная полка, где есть место (первая по порядку); -1 — нет. */
  private breadShelfIndex(product: ProductId = 'bread'): number {
    return this.state.shelves.findIndex((s) => !s.broken && canPlace(product, s) && shelfFree(s) > 0);
  }

  /** Свежий хлеб из печи — на полки (лишнее на склад); по залу от двери пекарни идёт запах. */
  private freshBread(at: { x: number; y: number }, product: ProductId = 'bread'): void {
    const out = product === 'bread' ? takeOutBread(this.state) : takeOutBread(this.state, BRAND_BATCH, product);
    this.state = out.state;
    this.refreshShelves();
    this.refreshWarehouse();
    sound.hiss(0.6, 1400, 0.04);
    sound.good();
    const text = product === 'bread' ? t('popup.freshBread', { n: out.onShelves }) : t('popup.freshOwn', { icon: PRODUCTS[product].icon, n: out.onShelves });
    this.popup(at.x, at.y, text, '#c8ffb0');
    this.time.delayedCall(900, () => this.popup(this.layout.w / 2, this.layout.wallH + 50, t('popup.aroma'), '#fff3b0'));
    this.aromaUntil = this.time.now + AROMA_SECONDS * 1000;
    // Тёплые завитки запаха плывут из пекарни по залу.
    const { w, wallH, h, bakery } = this.layout;
    this.time.addEvent({
      delay: 380,
      repeat: Math.floor((AROMA_SECONDS * 1000) / 380),
      callback: () => {
        const wisp = this.art(bakery.doorway.x, bakery.doorway.y - 6, 'glow').setScale(0.07).setTint(0xfeae34).setAlpha(0.5).setDepth(LIGHT_DEPTH - 2);
        this.tweens.add({
          targets: wisp,
          x: Phaser.Math.Between(10, w - 20),
          y: Phaser.Math.Between(wallH + 20, h - 30),
          scale: 0.2,
          alpha: 0,
          duration: 2600,
          ease: 'Sine.easeInOut',
          onComplete: () => wisp.destroy(),
        });
      },
    });
  }

  /** Полоска над печью: сколько осталось печься; готовый хлеб — окошко мигает. */
  private updateOven(): void {
    const oven = this.oven;
    if (!oven?.img.active) return;
    const now = this.time.now;
    if (oven.state === 'baking') {
      const k = Math.min(1, (now - oven.start) / (ovenBake(this.state) * 1000));
      oven.bar.setVisible(true);
      oven.fill.setVisible(true).setFillStyle(0xfeae34);
      oven.fill.width = 15 * k;
      oven.glow.setAlpha(0.35 + 0.15 * Math.sin(now / 200));
      if (Math.random() < 0.03) this.steamPuff(oven.img.x + 3, oven.img.y - 16, 0xc0cbdc);
    } else if (oven.state === 'ready') {
      // Сколько осталось до «сгорит»: полоска краснеет и убывает.
      const k = 1 - Math.min(1, (now - oven.start) / (OVEN_BURN_SECONDS * 1000));
      oven.bar.setVisible(true);
      oven.fill.setVisible(true).setFillStyle(k > 0.4 ? 0x63c74d : 0xe43b44);
      oven.fill.width = 15 * k;
      oven.glow.setAlpha(Math.floor(now / 250) % 2 ? 0.7 : 0.3);
      if (oven.fx) oven.fx.outerStrength = 2 + 2 * Math.sin(now / 120);
      if (Math.random() < 0.06) this.steamPuff(oven.img.x, oven.img.y - 6);
    }
  }

  // ---------- Ночная смена ----------

  /** Вечер: если куплена ночная смена — спросить, работать ли ещё; иначе закрываемся. */
  private endOfDay(): void {
    // Срочный заказ не успел доехать до закрытия — водитель всё равно выгрузил.
    this.receiveUrgentOrders();
    if (this.night || this.nightAsked || !canWorkNight(this.state)) {
      this.finishDay();
      return;
    }
    this.nightAsked = true;
    this.running = false;
    this.setSpeed(1);
    const { card, close } = openModal();
    card.append(
      el('h2', '', t('night.title')),
      el('p', '', t('night.text', { n: NIGHT_SECONDS, p: Math.round((NIGHT_MARKUP - 1) * 100) })),
      el('div', 'ui-muted', t('night.cost', { n: NIGHT_POWER })),
      button(
        t('night.yes'),
        () => {
          close();
          this.startNightShift();
        },
        'ui-btn',
        this.state.money < NIGHT_POWER,
      ),
      button(
        t('night.no'),
        () => {
          close();
          this.finishDay();
        },
        'ui-btn secondary',
      ),
    );
  }

  private startNightShift(): void {
    const next = startNight(this.state);
    if (!next) {
      this.finishDay();
      return;
    }
    this.state = next;
    this.night = true;
    this.stats.nightRevenue ??= 0;
    this.timeLeft = NIGHT_SECONDS;
    this.nextSpawn = 1;
    this.running = true;
    music.setMood('evening');
    sound.bell();
    this.popup(this.layout.door.x, this.layout.door.y - 30, t('popup.night'), '#2ce8f5');
  }

  // ---------- Кот ----------

  /**
   * Кот у входа. Бродячий просто спит; свой — на лежанке, мурчит, если погладить,
   * и иногда заходит в зал посидеть среди покупателей. Голодный три дня — уходит гулять.
   */
  private buildCat(x: number, y: number): void {
    this.catImg = undefined;
    this.catOut = false;
    const own = this.state.cat;
    if (own && !catHome(this.state)) return;
    this.catHome = { x, y };
    if (own?.bed) this.art(x, y + 1.5, CAT_BEDS[own.bed].texture).setOrigin(0.5, 1).setDepth(y + 6);
    const cat = this.art(x, y, 'cat').setOrigin(0.5, 1).setDepth(y + 7.5);
    this.catImg = cat;
    this.tweens.add({ targets: cat, scaleY: 1.08 / ART, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const snore = () => {
      if (!cat.active || this.catOut) return;
      const z = this.add
        .text(cat.x - 3, cat.y - 6, 'z', { fontFamily: UI_FONT, fontSize: '6px', fontStyle: 'bold', color: '#e8f0ff' })
        .setOrigin(0.5)
        .setResolution(4)
        .setDepth(cat.depth + 1)
        .setScale(0.6);
      this.tweens.add({ targets: z, x: z.x - 4, y: z.y - 9, scale: 1, alpha: 0, duration: 1800, onComplete: () => z.destroy() });
    };
    this.critterTimers.push(this.time.addEvent({ delay: 2600, loop: true, callback: snore }));
    if (!own) return;
    cat.setInteractive({ useHandCursor: true }).on('pointerup', () => this.tap(() => this.petCat()));
    this.critterTimers.push(
      this.time.addEvent({
        delay: CAT_WALK_EVERY,
        loop: true,
        callback: () => {
          if (this.running && !this.catOut && fedToday(this.state) && Math.random() < 0.55) void this.catVisit();
        },
      }),
    );
  }

  /** Погладили кота: мурчит, сердечко. */
  private petCat(): void {
    const cat = this.catImg;
    if (!cat?.active || !this.state.cat) return;
    sound.purr();
    haptic.tap();
    this.heartAt(cat.x, cat.y - 10);
    this.popup(cat.x, cat.y - 16, t('popup.catPurr', { name: this.state.cat.name }), '#fff3b0');
  }

  private heartAt(x: number, y: number): void {
    const heart = this.art(x, y, 'emo_heart').setDepth(1000).setScale(0.6 / ART);
    this.tweens.add({ targets: heart, y: y - 8, scale: 1 / ART, alpha: { from: 1, to: 0 }, duration: 1000, ease: 'Quad.easeOut', onComplete: () => heart.destroy() });
  }

  /** Кот идёт: перебирает лапами и смотрит туда, куда идёт (спрайт смотрит влево). */
  private catStep(x: number, y: number): Promise<void> {
    const cat = this.catImg;
    if (!cat?.active) return Promise.resolve();
    const distance = Phaser.Math.Distance.Between(cat.x, cat.y, x, y);
    if (Math.abs(x - cat.x) > 0.5) cat.setFlipX(x > cat.x);
    return new Promise((resolve) => {
      this.tweens.add({
        targets: cat,
        x,
        y,
        duration: (distance / CAT_SPEED) * 1000,
        onUpdate: () => {
          cat.setDepth(cat.y);
          cat.setTexture(Math.floor(this.time.now / 140) % 2 ? 'cat_walk0' : 'cat_walk1');
        },
        onComplete: () => resolve(),
        onStop: () => resolve(),
      });
    });
  }

  /** Кот заходит в зал, садится посреди и через несколько секунд возвращается на лежанку. */
  private async catVisit(): Promise<void> {
    const cat = this.catImg;
    if (!cat?.active) return;
    this.catOut = true;
    this.tweens.killTweensOf(cat);
    cat.setScale(1 / ART).setOrigin(0.5, 1).setTexture('cat_walk0');
    sound.meow();
    const { door, h } = this.layout;
    const spot = this.freeFloorPoint();
    const route = [
      { x: door.x + 6, y: this.catHome.y },
      { x: door.x + 6, y: h - 6 },
      ...findPath({ x: door.x + 6, y: h - 6 }, { x: spot.x, y: spot.y + 8 }, this.obstacles),
    ];
    for (const p of route) {
      await this.catStep(p.x, p.y);
      if (!cat.active) return;
    }
    cat.setTexture('cat_sit').setFlipX(false);
    await this.wait(Phaser.Math.Between(9000, 13000));
    if (!cat.active) return;
    sound.meow();
    const back = [...findPath({ x: cat.x, y: cat.y }, { x: door.x + 6, y: h - 6 }, this.obstacles), { x: door.x + 6, y: this.catHome.y }, this.catHome];
    for (const p of back) {
      await this.catStep(p.x, p.y);
      if (!cat.active) return;
    }
    cat.setTexture('cat').setFlipX(false).setDepth(this.catHome.y + 7.5);
    this.tweens.add({ targets: cat, scaleY: 1.08 / ART, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.catOut = false;
  }

  /** Покупатель проходит мимо кота в зале — гладит (сердечко, кот мурчит). Это попадёт в отзывы. */
  private petCatNearby(): void {
    const cat = this.catImg;
    if (!this.catOut || !cat?.active || cat.texture.key !== 'cat_sit') return;
    for (const c of this.customers) {
      if (c.petted || c.gone || c.thief) continue;
      if (Math.abs(c.sprite.x - cat.x) > 14 || Math.abs(c.sprite.y + 8 - cat.y) > 10) continue;
      c.petted = true;
      note(this.stats, 'cat');
      this.emote(c.sprite, 'emo_heart');
      this.heartAt(cat.x, cat.y - 10);
      if (Math.random() < 0.5) sound.purr();
    }
  }

  // ---------- Доска отзывов ----------

  private buildReviewBoard(x: number, y: number): void {
    const board = this.art(x, y, 'review_board').setOrigin(0.5, 1).setDepth(y);
    board.setInteractive({ useHandCursor: true }).on('pointerup', () => this.tap(() => showReviews(this.state.reviews)));
    // Есть отзывы — звёздочка над доской мигает.
    this.reviewStar = this.add
      .text(x + 5, y - 17, '★', { fontFamily: UI_FONT, fontSize: '7px', color: '#fee761' })
      .setOrigin(0.5)
      .setResolution(4)
      .setDepth(y + 1)
      .setVisible(Boolean(this.state.reviews?.length));
    this.tweens.add({ targets: this.reviewStar, y: y - 19, alpha: 0.4, duration: 700, yoyo: true, repeat: -1 });
  }

  /** Покупатель с 1–2 товарами, пока у кассы очередь, пробивает себя сам. */
  private async useKiosk(c: Customer): Promise<boolean> {
    const kiosk = this.kiosk;
    if (!kiosk?.active || this.kioskBusy || c.thief || c.items.length > KIOSK_MAX_ITEMS || this.waiting() === 0) return false;
    this.kioskBusy = true;
    await this.walk(c.sprite, kiosk.x - 14, kiosk.y + 4);
    if (c.gone || !c.sprite.active) {
      this.kioskBusy = false;
      return true;
    }
    this.setFacing(c.sprite, 'right');
    c.serving = true;
    for (const { id } of c.items) {
      await this.wait(KIOSK_ITEM_SECONDS * 1000);
      if (!this.sys.isActive()) return true;
      const item = this.art(c.sprite.x, c.sprite.y - 2, `item_${id}`).setScale(1.5 / ART).setDepth(1000);
      this.tweens.add({ targets: item, x: kiosk.x, y: kiosk.y - 6, alpha: 0.2, duration: 220, onComplete: () => item.destroy() });
      sound.scan();
      this.kioskScreen?.setAlpha(0.9);
      this.time.delayedCall(150, () => this.kioskScreen?.setAlpha(0.3));
    }
    await this.wait(KIOSK_PAY_SECONDS * 1000);
    this.kioskBusy = false;
    if (!this.sys.isActive()) return true;
    this.finishCheckout(c, { x: kiosk.x - 10, y: kiosk.y - 12 });
    return true;
  }

  /** Постоянные покупатели на сегодня: каждый заходит в своё случайное время. */
  private scheduleRegulars(): void {
    for (const r of regularsToday(this.state)) {
      if (Math.random() >= r.every) continue;
      this.time.delayedCall(Phaser.Math.FloatBetween(0.1, 0.75) * DAY_SECONDS * 1000, () => this.running && this.timeLeft > 0 && this.spawnRegular(r));
    }
  }

  private spawnRegular(r: Regular): void {
    const start = this.streetSpawn();
    const sprite = this.makePerson(start.x, start.y, { ...r.look });
    this.addUmbrella(sprite);
    const bubble = this.art(0, -14, 'bubble').setVisible(false);
    sprite.add(bubble);
    // Любимый товар — всегда; иногда ещё что-нибудь.
    const extra = Math.random() < 0.4 ? this.wanted(1).filter((id) => id !== r.favorite) : [];
    const customer: Customer = { sprite, bubble, items: [], unhappy: false, waitStart: 0, gone: false, thief: false, regular: r.id, wants: [r.favorite, ...extra] };
    this.customers.add(customer);
    void this.runCustomer(customer);
  }

  /** Постоянный покупатель нашёл любимое по своей цене — доверие растёт (и чаевые), нет — падает. */
  private regularVerdict(c: Customer): void {
    const r = regularById(c.regular!);
    const happy = c.items.some((item) => item.id === r.favorite);
    const { state, result } = recordVisit(this.state, r.id, happy);
    this.state = state;
    const name = t(r.nameKey);
    const y = c.sprite.y - 24;
    if (result === 'up') {
      this.emote(c.sprite, 'emo_heart');
      this.popup(c.sprite.x, y, t('regular.up', { name }), '#c8ffb0');
      const total = c.items.reduce((sum, item) => sum + unitSalePrice(this.state, item.id, item.unit), 0);
      const tip = tipFor(regularState(this.state, r.id).loyalty, total);
      if (tip > 0) {
        this.state = { ...this.state, money: this.state.money + tip };
        this.time.delayedCall(900, () => this.popup(c.sprite.x, y - 8, t('regular.tip', { n: tip }), '#fee761'));
      }
    } else {
      this.emote(c.sprite, 'emo_angry');
      this.popup(c.sprite.x, y, t(result === 'left' ? 'regular.left' : 'regular.down', { name }), '#ffd0d0');
      sound.bad();
    }
    saveGame(this.state);
  }

  /** Начало мини-события дня. */
  private startLiveEvent(kind: LiveKind): void {
    if (this.liveEvent) return;
    this.liveEvent = kind;
    const { w, h } = this.layout;
    sound.bell();
    haptic.tap();
    this.popup(w / 2, h / 2 - 20, t(`live.${kind}` as TextKey), '#fff3b0');
    const keep = <T extends { destroy: () => void }>(obj: T): T => {
      this.liveObjs.push(obj);
      return obj;
    };
    if (kind === 'blackout') {
      this.blackout = true;
      this.updateLighting();
      // Если не починить — через 20 секунд свет дадут сами.
      keep(this.time.delayedCall(20000, () => this.restoreLight()));
    }
    if (kind === 'leak') this.startLeak(keep);
    if (kind === 'pigeon') this.pigeonInside(keep);
    if (kind === 'courier') void this.courierVisit(keep);
    if (kind === 'mouse') this.mouseInWarehouse(keep);
  }

  private endLiveEvent(): void {
    for (const obj of this.liveObjs) obj.destroy();
    this.liveObjs = [];
    this.liveEvent = null;
    if (this.blackout) {
      this.blackout = false;
      this.updateLighting();
    }
  }

  /** Продавец идёт к щитку и включает свет. */
  private fixFuse(): void {
    if (!this.blackout || this.sellerBusy || this.ownerScanning() || !this.fuseBox) return;
    this.carried.setTexture('wrench').setPosition(5, -1).setVisible(true);
    void this.doChore([
      {
        x: this.fuseBox.x,
        y: this.layout.wallH + 16,
        ms: FIX_MS,
        action: () => {
          this.carried.setVisible(false).setTexture('box').setPosition(0, 3);
          this.restoreLight();
        },
      },
    ]);
  }

  private restoreLight(): void {
    if (!this.blackout) return;
    this.blackout = false;
    this.liveEvent = null;
    this.updateLighting();
    sound.good();
    this.popup(this.layout.w / 2, this.layout.h / 2 - 20, t('live.lightOn'), '#c8ffb0');
  }

  /** Свободная точка пола посреди зала (не в мебели и не у кассы). */
  private freeFloorPoint(): { x: number; y: number } {
    const { w, h, wallH } = this.layout;
    const tries = [
      [0.5, 0.45],
      [0.4, 0.55],
      [0.6, 0.35],
      [0.35, 0.4],
      [0.55, 0.6],
      [0.45, 0.3],
    ];
    for (const [fx, fy] of tries) {
      const x = w * fx;
      const y = wallH + (h - wallH) * fy;
      if (this.obstacles.every((o) => x < o.x - 8 || x > o.x + o.w + 8 || y < o.y - 8 || y > o.y + o.h + 8)) return { x, y };
    }
    return { x: this.layout.door.x, y: h - 40 };
  }

  /** Прорвало трубу: с потолка капает, натекают лужи. Нажми — продавец починит ключом. */
  private startLeak(keep: <T extends { destroy: () => void }>(obj: T) => T): void {
    const at = this.freeFloorPoint();
    const drops = keep(
      this.add.particles(at.x, at.y - 34, 'raindrop', {
        speedY: 140,
        lifespan: 240,
        frequency: 110,
        x: { min: -3, max: 3 },
        scale: 1 / ART,
        tint: 0x9fd8ff,
      }),
    ).setDepth(LIGHT_DEPTH - 1);
    const ring = keep(this.art(at.x, at.y, 'ripple').setTint(0x9fd8ff).setDepth(0.7));
    this.tweens.add({ targets: ring, scale: 1.6 / ART, alpha: { from: 1, to: 0.2 }, duration: 700, repeat: -1 });
    const puddle = () => {
      const piece = this.dropTrash(at.x + Phaser.Math.Between(-8, 8), at.y - 6, 'spill');
      piece?.setTint(0xbfe4ff);
    };
    puddle();
    const more = keep(this.time.addEvent({ delay: 7000, repeat: 2, callback: puddle }));
    const stop = () => {
      drops.destroy();
      ring.destroy();
      more.remove();
      this.liveEvent = null;
    };
    keep(this.time.delayedCall(40000, stop));
    const zone = keep(this.add.zone(at.x, at.y - 10, 26, 30).setInteractive({ useHandCursor: true }).setDepth(LIGHT_DEPTH));
    zone.on('pointerup', () =>
      this.tap(() => {
        if (this.sellerBusy || this.ownerScanning() || !drops.active) return;
        this.carried.setTexture('wrench').setPosition(5, -1).setVisible(true);
        void this.doChore([
          {
            x: at.x + 9,
            y: at.y + 2,
            ms: LEAK_FIX_MS,
            action: () => {
              this.carried.setVisible(false).setTexture('box').setPosition(0, 3);
              stop();
              zone.destroy();
              sound.good();
              this.popup(at.x, at.y - 16, t('live.leakFixed'), '#c8ffb0');
            },
          },
        ]);
      }),
    );
  }

  /** В зал залетел голубь: скачет по полу и пугает покупателей. Нажми — улетит. */
  private pigeonInside(keep: <T extends { destroy: () => void }>(obj: T) => T): void {
    const { door, h } = this.layout;
    const bird = keep(this.art(door.x, h + 20, 'pigeon_fly').setScale(1.6 / ART).setDepth(LIGHT_DEPTH - 1));
    const scared = new Set<Customer>();
    let done = false;
    const flyOut = () => {
      if (done || !bird.active) return;
      done = true;
      this.liveEvent = null;
      bird.setTexture('pigeon_fly').setDepth(LIGHT_DEPTH - 1);
      this.tweens.add({ targets: bird, x: door.x, y: h + 30, duration: 900, ease: 'Sine.easeIn', onComplete: () => bird.destroy() });
    };
    const hop = () => {
      if (done || !bird.active) return;
      const to = this.freeFloorPoint();
      const x = to.x + Phaser.Math.Between(-40, 40);
      const y = to.y + Phaser.Math.Between(-30, 30);
      bird.setTexture('pigeon_fly').setDepth(LIGHT_DEPTH - 1).setFlipX(x < bird.x);
      this.tweens.add({
        targets: bird,
        x,
        y,
        duration: 700,
        ease: 'Sine.easeInOut',
        onComplete: () => bird.active && bird.setTexture('pigeon0').setDepth(y),
      });
    };
    hop();
    keep(this.time.addEvent({ delay: 2200, loop: true, callback: hop }));
    // Кто окажется рядом — пугается и уходит недовольным.
    keep(
      this.time.addEvent({
        delay: 500,
        loop: true,
        callback: () => {
          if (done || !bird.active) return;
          for (const c of this.customers) {
            if (scared.has(c) || c.thief || Phaser.Math.Distance.Between(c.sprite.x, c.sprite.y + 8, bird.x, bird.y) > 14) continue;
            scared.add(c);
            c.unhappy = true;
            this.emote(c.sprite, 'emo_angry');
          }
        },
      }),
    );
    bird.setInteractive(new Phaser.Geom.Rectangle(-6, -6, 21, 19), Phaser.Geom.Rectangle.Contains).on('pointerup', () =>
      this.tap(() => {
        sound.tap();
        flyOut();
      }),
    );
    keep(this.time.delayedCall(25000, flyOut));
  }

  /** Курьер с посылкой: ждёт у входа; продавец успел принять — в посылке деньги. */
  private async courierVisit(keep: <T extends { destroy: () => void }>(obj: T) => T): Promise<void> {
    const { door } = this.layout;
    const courier = keep(this.makePerson(door.x + 60, this.streetY, { ...randomLook(0xe43b44), style: 'cap', hair: 0xe43b44 }));
    const parcel = this.art(0, 3, 'box').setTint(0xc28569);
    courier.add(parcel);
    await this.walk(courier, door.x, this.streetY);
    await this.walk(courier, door.x - 10, door.y - 14);
    if (!courier.active) return;
    let taken = false;
    const leave = async (left: boolean) => {
      if (!courier.active) return;
      this.liveEvent = null;
      courier.disableInteractive();
      if (left) this.popup(courier.x, courier.y - 18, t('live.courierLeft'), '#ffd0d0');
      await this.walk(courier, door.x, this.streetY);
      await this.walk(courier, door.x - 80, this.streetY);
      courier.destroy();
    };
    courier.setSize(16, 22).setInteractive({ useHandCursor: true }).on('pointerup', () =>
      this.tap(() => {
        if (taken || this.sellerBusy || this.ownerScanning()) return;
        taken = true;
        void this.doChore([
          {
            x: courier.x + 9,
            y: courier.y,
            ms: 600,
            action: () => {
              parcel.destroy();
              const gift = 40 + 40 * this.state.level;
              this.state = { ...this.state, money: this.state.money + gift };
              saveGame(this.state);
              sound.coin();
              this.popup(courier.x, courier.y - 18, t('live.courierGift', { n: gift }), '#c8ffb0');
              this.flyCoins(courier.x, courier.y, 3);
              void leave(false);
            },
          },
        ]);
      }),
    );
    keep(this.time.delayedCall(15000, () => !taken && void leave(true)));
  }

  /** Сколько коробок закуплено этим утром (по разнице с началом утра). */
  private boxesToDeliver(): number {
    const added = warehouseCount(this.state) - this.morningStock;
    return added > 0 ? Math.ceil(added / unitsPerBox(warehouseCapacity(this.state))) : 0;
  }

  /**
   * Доставка закупки: фургон подъезжает к складу, водитель через проход в заборе носит коробки
   * к роллету склада — и они по одной появляются на стеллаже. Потом фургон уезжает.
   */
  private async deliver(): Promise<void> {
    const { warehouse, h } = this.layout;
    const shutterX = warehouse.x + warehouse.w / 2;
    const roadY = this.streetY + 24;
    const back = h + FACADE_H + 6;
    const vanX = shutterX + 14;
    const body = this.art(0, 0, 'car_van').setTint(0xffffff);
    const lights = this.art(0, 0, 'car_van_lights');
    const van = this.add.container(-260, roadY, [body, lights]).setDepth(roadY);
    ambience.carPass();
    await new Promise<void>((done) => this.tweens.add({ targets: van, x: vanX, duration: 2200, ease: 'Sine.easeOut', onComplete: () => done() }));
    if (!van.active) return;
    const driver = this.makePerson(vanX, this.streetY + 10, { ...randomLook(0x0099db), style: 'cap', hair: 0x0099db });
    const box = this.art(0, 3, 'box').setVisible(false);
    driver.add(box);
    // С тротуара по подъезду к воротам склада во флигеле.
    const route = [
      { x: shutterX, y: this.streetY + 4 },
      { x: shutterX, y: back },
    ];
    const trips = Math.min(this.awaitingBoxes, 4);
    for (let trip = 0; trip < trips && driver.active; trip++) {
      box.setVisible(true);
      for (const p of route) await this.walk(driver, p.x, p.y, SELLER_SPEED);
      if (!driver.active) return;
      await this.wait(300);
      box.setVisible(false);
      // Каждый рейс открывает свою долю коробок (на последнем — все оставшиеся).
      this.awaitingBoxes = trip === trips - 1 ? 0 : Math.max(0, this.awaitingBoxes - Math.ceil(this.awaitingBoxes / (trips - trip)));
      this.refreshWarehouse();
      sound.pop(trip);
      if (trip < trips - 1) for (const p of [...route].reverse()) await this.walk(driver, p.x, p.y, SELLER_SPEED);
    }
    for (const p of [...route].reverse()) await this.walk(driver, p.x, p.y, SELLER_SPEED);
    await this.walk(driver, vanX, this.streetY + 10, SELLER_SPEED);
    driver.destroy();
    if (!van.active) return;
    this.tweens.add({ targets: van, x: this.next.w + 300, delay: 300, duration: 2600, ease: 'Sine.easeIn', onComplete: () => van.destroy() });
  }

  /** Реклама видна на улице, пока работает. */
  private applyAds(): void {
    for (const obj of this.adObjs) obj.destroy();
    this.adObjs = [];
    const ad = activeAd(this.state);
    if (!ad) return;
    const { door, h } = this.layout;
    const keep = <T extends { destroy: () => void }>(obj: T): T => {
      this.adObjs.push(obj);
      return obj;
    };
    if (ad.id === 'banner') {
      const banner = keep(this.art(door.x - 44, h + 4, 'ad_banner').setDepth(h + 44));
      this.tweens.add({ targets: banner, angle: { from: -1.5, to: 1.5 }, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    if (ad.id === 'flyers') {
      // Промоутер в жёлтом жилете раздаёт листовки прохожим.
      const spot = { x: door.x + 24, y: this.streetY - 3 };
      const promoter = keep(this.makePerson(spot.x, spot.y, { ...randomLook(0xfee761), acc: 'vest', accTint: 0xfee761 }));
      this.people.delete(promoter);
      keep(
        this.time.addEvent({
          delay: 2200,
          loop: true,
          callback: () => {
            const target = [...this.people].find((p) => p.active && Math.abs(p.x - spot.x) < 50 && p.y > this.layout.h + FACADE_H);
            if (!target) return;
            const flyer = this.art(spot.x, spot.y - 4, 'flyer').setDepth(spot.y + 20);
            this.tweens.add({ targets: flyer, x: target.x, y: target.y - 4, angle: 180, duration: 450, onComplete: () => flyer.destroy() });
          },
        }),
      );
    }
    if (ad.id === 'blogger') {
      // Блогер снимает обзор у входа: блёстки вокруг.
      const spot = { x: door.x - 20, y: this.layout.h + FACADE_H + 8 };
      const blogger = keep(this.makePerson(spot.x, spot.y, { shirt: 0xf6757a, pants: 0x262b44, hair: 0xb55088, style: 'long', skin: 0xf2d3ab }));
      this.people.delete(blogger);
      this.setFacing(blogger, 'up');
      const sparkles = keep(
        this.add.particles(0, 0, 'spark', {
          lifespan: 700,
          speed: { min: 4, max: 14 },
          scale: { start: 0.5, end: 0 },
          alpha: { start: 1, end: 0 },
          frequency: 220,
          x: { min: -8, max: 8 },
          y: { min: -16, max: 2 },
        }),
      );
      sparkles.startFollow(blogger).setDepth(LIGHT_DEPTH - 1);
    }
  }

  /** Мокрая улица: асфальт блестит, в нём отражаются фонари, по лужам идут круги. */
  private wetStreet(keep: <T extends Phaser.GameObjects.GameObject>(obj: T) => T): void {
    const top = this.next.h + 4;
    keep(this.add.rectangle(-400, top, this.next.w + 800, 88, 0xa8c0f0).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.06).setDepth(-8.9));
    for (const x of this.lampXs) {
      const streak = keep(this.nightGlow(this.art(x, top + 34, 'glow').setDisplaySize(9, 46).setTint(0xffd27a), 0.4));
      this.tweens.add({ targets: streak, scaleX: streak.scaleX * 0.65, duration: Phaser.Math.Between(600, 1100), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    const rnd = new Phaser.Math.RandomDataGenerator([`puddles${this.state.day}`]);
    const puddles: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 0; i < 10; i++) {
      const x = -120 + rnd.frac() * (this.next.w + 240);
      if (Math.abs(x - this.layout.door.x) < 16) continue;
      const y = rnd.pick([top + 17, top + 19, top + 74, top + 80]);
      puddles.push({ x, y });
      keep(this.art(x, y, 'puddle_wet').setDepth(-8.8));
    }
    if (!puddles.length) return;
    const source = {
      getRandomPoint: (point: Phaser.Types.Math.Vector2Like) => {
        const at = Phaser.Utils.Array.GetRandom(puddles);
        point.x = (at.x ?? 0) + Phaser.Math.FloatBetween(-6, 6);
        point.y = (at.y ?? 0) + Phaser.Math.FloatBetween(-1.5, 1.5);
      },
    };
    keep(this.add.particles(0, 0, 'ripple', {
      emitZone: { type: 'random', source },
      scale: { start: 0.15 / ART, end: 0.9 / ART },
      alpha: { start: 0.8, end: 0 },
      lifespan: 650,
      frequency: 70,
    })).setDepth(-8.7);
  }

  /** Гроза: время от времени вспышка молнии на весь квартал, через миг — раскат грома. */
  private lightning(keep: <T extends Phaser.GameObjects.GameObject>(obj: T) => T): void {
    const flash = keep(this.add.rectangle(-1200, -1200, 4000, 4000, 0xdde6ff).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(LIGHT_DEPTH + 5).setAlpha(0));
    const strike = () => {
      if (!flash.active) return;
      if (this.running) {
        this.tweens.chain({
          targets: flash,
          tweens: [
            { alpha: 0.26, duration: 50 },
            { alpha: 0.05, duration: 90 },
            { alpha: 0.18, duration: 45 },
            { alpha: 0, duration: 550 },
          ],
        });
        this.cameras.main.shake(180, 0.0015);
        this.time.delayedCall(Phaser.Math.Between(250, 1100), () => sound.thunder());
      }
      this.time.delayedCall(Phaser.Math.Between(7000, 15000), strike);
    };
    this.time.delayedCall(Phaser.Math.Between(2500, 5000), strike);
  }

  /** Зонт над головой: только в дождь и только на улице. */
  private addUmbrella(person: Phaser.GameObjects.Container): void {
    if (!isWet(this.weather)) return;
    const umbrella = this.art(0, -13, 'umbrella').setTint(Phaser.Utils.Array.GetRandom(CAR_COLORS));
    person.add(umbrella);
    person.setData('umbrella', umbrella);
  }

  /**
   * Расширение — событие: утреннее окно прячется, на участке леса и строители стучат молотками,
   * вспышка — и зал уже больше, летит конфетти, звучат фанфары.
   */
  private async celebrateExpansion(): Promise<void> {
    const modal = document.querySelector<HTMLElement>('.ui-modal:not(.closing)');
    if (modal) modal.style.visibility = 'hidden';
    const { w, h } = this.layout;
    const next = this.next;
    const spots: { x: number; y: number }[] = [];
    if (next.w > w) spots.push({ x: w + (next.w - w) / 2, y: next.h * 0.3 }, { x: w + (next.w - w) / 2, y: next.h * 0.7 });
    if (next.h > h) spots.push({ x: w * 0.3, y: h + (next.h - h) / 2 }, { x: w * 0.7, y: h + (next.h - h) / 2 });
    const crew: Phaser.GameObjects.GameObject[] = [];
    for (const spot of spots) {
      crew.push(this.art(spot.x, spot.y, 'scaffold').setDepth(spot.y));
      const builder = this.makePerson(spot.x + 14, spot.y + 10, { ...randomLook(0xfeae34), style: 'cap', hair: 0xfeae34, acc: 'vest' });
      this.tweens.add({ targets: builder, scaleY: 0.92, duration: 140, yoyo: true, repeat: -1 });
      crew.push(builder);
    }
    this.popup(next.w / 2, next.h / 2, t('popup.construction'), '#fee761');
    const hammer = this.time.addEvent({
      delay: 260,
      loop: true,
      callback: () => {
        sound.tap();
        const spot = Phaser.Utils.Array.GetRandom(spots);
        if (spot) this.puff(spot.x + Phaser.Math.Between(-14, 14), spot.y + Phaser.Math.Between(-10, 14));
      },
    });
    await this.wait(2400);
    hammer.remove();
    for (const obj of crew) obj.destroy();
    this.cameras.main.flash(300, 255, 250, 235);
    this.buildWorld();
    this.refreshShelves();
    this.refreshWarehouse();
    this.hud.update(this.state, DAY_SECONDS);
    const confetti = this.add.particles(this.layout.w / 2, this.layout.h / 2, 'confetti', {
      speed: { min: 60, max: 170 },
      angle: { min: 200, max: 340 },
      gravityY: 160,
      rotate: { min: 0, max: 360 },
      scale: 1 / ART,
      lifespan: 1800,
      tint: [0xe43b44, 0xfee761, 0x63c74d, 0x0099db, 0xb55088],
      emitting: false,
    });
    confetti.setDepth(LIGHT_DEPTH + 10).explode(70);
    sound.fanfare();
    haptic.success();
    this.popup(this.layout.w / 2, this.layout.h / 2 - 20, t('popup.expanded', { name: t(storeLevel(this.state).nameKey) }), '#fee761');
    await this.wait(1600);
    confetti.destroy();
    if (modal) modal.style.visibility = '';
  }

  /** Нажатие засчитывается, только если палец не двигал камеру. */
  private tap(action: () => void): void {
    if (!this.dragged) action();
  }

  /** Квартал можно рассмотреть, проведя пальцем; через несколько секунд камера возвращается к магазину. */
  private setupCameraDrag(): void {
    const cam = this.cameras.main;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragged = false;
      this.dragStart = { x: p.x, y: p.y };
    });
    this.input.addPointer(1);
    const zoomTo = (z: number) => cam.setZoom(Phaser.Math.Clamp(z, this.baseZoom * 0.6, this.baseZoom * 2.2));
    // Колёсико на компьютере.
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      zoomTo(cam.zoom * (dy > 0 ? 0.9 : 1.1));
      this.scheduleHome();
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const a = this.input.pointer1;
      const b = this.input.pointer2;
      if (a.isDown && b.isDown) {
        // Два пальца: приближаем или отдаляем.
        const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        this.pinch ??= { dist, zoom: cam.zoom };
        zoomTo(this.pinch.zoom * (dist / this.pinch.dist));
        this.dragged = true;
        this.homeTimer?.remove();
        return;
      }
      this.pinch = null;
      if (!p.isDown) return;
      if (!this.dragged && Phaser.Math.Distance.Between(p.x, p.y, this.dragStart.x, this.dragStart.y) < 12 * RES) return;
      this.dragged = true;
      this.homeTimer?.remove();
      const dx = (p.x - p.prevPosition.x) / cam.zoom;
      const dy = (p.y - p.prevPosition.y) / cam.zoom;
      const cx = Phaser.Math.Clamp(cam.midPoint.x - dx, -CAMERA_REACH, this.next.w + CAMERA_REACH);
      const cy = Phaser.Math.Clamp(cam.midPoint.y - dy, -CAMERA_REACH / 2, this.next.h + CAMERA_REACH / 2);
      cam.centerOn(cx, cy);
    });
    this.input.on('pointerup', () => {
      this.pinch = null;
      if (this.dragged) this.scheduleHome();
    });
  }

  /** Через несколько секунд после осмотра камера возвращается к магазину. */
  private scheduleHome(): void {
    const cam = this.cameras.main;
    this.homeTimer?.remove();
    this.homeTimer = this.time.delayedCall(4000, () => {
      cam.pan(this.home.x, this.home.y, 700, 'Sine.easeInOut');
      cam.zoomTo(this.baseZoom, 700, 'Sine.easeInOut');
    });
  }

  /**
   * Соседи по улице: слева кафе и жилой дом, справа магазин конкурента Эдуарда и аптека.
   * Крыши с кондиционерами, кирпичные фасады с витринами, вывески.
   */
  private buildNeighbors(next: Layout): void {
    const base = next.h + 4;
    // back — здание отступает от тротуара (у кафе перед ним веранда).
    type Neighbor = { x: number; w: number; h: number; name: TextKey; sign: number; awning: number; roof: number; neon: number; dark?: boolean; back?: number };
    // Помещение Эдуарда: пустует, «МегаМарт» по сюжету, а после сюжета — его ларёк, маркет и молл.
    const look = eduardLook(this.state);
    this.builtEduard = look;
    const eduard: Record<EduardLook, Omit<Neighbor, 'x' | 'w'>> = {
      vacant: { h: 130, name: 'eduard.stage0', sign: 0x5a6988, awning: 0x8b9bb4, roof: 0xc0cbdc, neon: 0, dark: true },
      mega: { h: 140, name: 'eduard.mega', sign: 0x124e89, awning: 0x0099db, roof: 0xc4d0ec, neon: 0x6cd8ff },
      kiosk: { h: 110, name: 'eduard.stage1', sign: 0x68386c, awning: 0xb55088, roof: 0xe0c8dc, neon: 0xff8ad8 },
      market: { h: 145, name: 'eduard.stage2', sign: 0x124e89, awning: 0x0099db, roof: 0xc4d0ec, neon: 0x6cd8ff },
      mall: { h: 190, name: 'eduard.stage3', sign: 0xa22633, awning: 0xe43b44, roof: 0xf2e6c8, neon: 0xffd040 },
    };
    const neighbors: Neighbor[] = [
      { x: -136 - WING_OUTER, w: 112, h: 120, name: 'neighbor.cafe', sign: 0x733e39, awning: 0xb86f50, roof: 0xe8c8b0, neon: 0xffb860, back: VERANDA_D },
      { x: -268 - WING_OUTER, w: 116, h: 150, name: 'neighbor.pharmacy', sign: 0x3e8948, awning: 0x63c74d, roof: 0xd0e4d0, neon: 0x7cff8a },
      { x: next.w + 26, w: 128, ...eduard[look] },
      { x: next.w + 170, w: 110, h: 120, name: 'neighbor.bakery', sign: 0xb55088, awning: 0xf6757a, roof: 0xf2d0dc, neon: 0xff8ad8 },
    ];
    const rnd = new Phaser.Math.RandomDataGenerator(['neighbors']);
    for (const n of neighbors) {
      const bottom = base - (n.back ?? 0);
      const top = bottom - n.h;
      this.add.tileSprite(n.x, top, n.w, n.h - FACADE_H, 'roof').setOrigin(0).setTileScale(1 / ART).setTint(n.roof).setDepth(-3);
      this.add.tileSprite(n.x - 2, top - 3, n.w + 4, 3, 'wall_cap').setOrigin(0).setTileScale(1 / ART).setDepth(-3);
      this.add.tileSprite(n.x, bottom - FACADE_H, n.w, FACADE_H, 'facade').setOrigin(0).setTileScale(1 / ART).setDepth(bottom - 5);
      // Кондиционеры и окна в крыше (у большого молла — больше).
      for (let i = 0; i < Math.max(3, Math.round(n.h / 45)); i++) {
        this.art(n.x + 14 + rnd.frac() * (n.w - 28), top + 12 + rnd.frac() * (n.h - 40), i === 0 ? 'skylight' : 'ac_unit').setDepth(-2);
      }
      // Витрины, дверь и навес.
      const doorX = n.x + n.w * 0.62;
      this.art(doorX, bottom - 5, 'door').setDepth(bottom - 4);
      for (let x = n.x + 14; x < n.x + n.w - 10; x += 24) {
        if (Math.abs(x - doorX) < 22) continue;
        const win = this.art(x, bottom - 4.5, 'shopwin').setDepth(bottom - 4);
        // Пустующее помещение — тёмные витрины без света.
        if (n.dark) win.setTint(0x8b9bb4);
        else this.windowLight(x, bottom - 4.5, bottom);
      }
      this.art(doorX, bottom - 9, 'awning').setScale(1 / ART, 0.6 / ART).setTint(n.awning).setDepth(bottom + 40);
      // Вывеска на краю крыши.
      this.art(n.x + n.w / 2, bottom - FACADE_H - 8, 'sign').setTint(n.sign).setDepth(bottom - 3);
      this.add
        .text(n.x + n.w / 2, bottom - FACADE_H - 8, t(n.name), { fontFamily: UI_FONT, fontSize: '6px', color: '#fee761' })
        .setOrigin(0.5)
        .setResolution(4)
        .setDepth(bottom - 2);
      if (n.neon) this.neonSign(n.x + n.w / 2, bottom - FACADE_H - 8, t(n.name), '6px', n.neon, 64);
    }
    // Остановка на тротуаре слева.
    this.art(-70 - WING_OUTER, this.streetY - 4, 'bus_stop').setDepth(this.streetY);
    this.buildVeranda(neighbors[0].x, neighbors[0].w, base);
  }

  /**
   * Летняя веранда кафе «Пончик»: деревянный настил с перилами, столики под полосатыми
   * зонтиками, за ними сидят посетители. Если с кафе договор — днём от него приходит
   * официант за заказом.
   */
  private buildVeranda(x: number, w: number, base: number): void {
    const top = base - VERANDA_D;
    this.add.tileSprite(x, top, w, VERANDA_D, 'floor_wood').setOrigin(0).setTileScale(1 / ART).setTint(0xd8b48a).setDepth(-6);
    // Перила по краю, проход посередине — к двери кафе.
    const gap = x + w * 0.62;
    const rail = (rx: number, rw: number) => {
      this.add.rectangle(rx, base - 2, rw, 2, 0x733e39).setOrigin(0).setDepth(base);
      for (let px = rx; px <= rx + rw; px += 8) this.add.rectangle(px, base - 5, 1.5, 5, 0x5a3a2a).setOrigin(0).setDepth(base);
    };
    rail(x, gap - 10 - x);
    rail(gap + 10, x + w - gap - 10);
    const looks = [0xe43b44, 0x0099db, 0x63c74d, 0xfeae34, 0xb55088];
    const spots = [x + 18, x + 46, x + w - 18];
    spots.forEach((tx, i) => {
      const ty = top + 15;
      this.art(tx, ty + 2, 'cafe_table').setDepth(ty + 6);
      this.art(tx, ty - 3, 'umbrella').setDepth(ty + 30);
      // За столиком кто-нибудь сидит (через раз — вдвоём).
      const guest = this.makePerson(tx - 7, ty + 3, randomLook(looks[i % looks.length]));
      this.people.delete(guest);
      guest.setDepth(ty + 5);
      if (i !== 1) {
        const second = this.makePerson(tx + 7, ty + 3, randomLook(looks[(i + 2) % looks.length]));
        this.people.delete(second);
        second.setDepth(ty + 5);
      }
    });
  }

  /** Улица вокруг здания: газон с деревьями, тротуар с фонарями и скамейкой, дорога. */
  private buildStreet(next: Layout): void {
    const { h, door } = this.layout;
    const tile = (x: number, y: number, w: number, hh: number, key: string) =>
      this.add.tileSprite(x, y, w, hh, key).setOrigin(0).setTileScale(1 / ART).setDepth(-10);
    const left = -400;
    const width = next.w + 800;
    const top = next.h + 4;
    this.streetY = top + 12;
    this.lawns = [
      { x: left, y: -400, w: width, h: top + 400 },
      { x: left, y: top + 88, w: width, h: 300 },
    ];
    tile(left, -400, width, top + 400, 'grass');
    tile(left, top, width, 22, 'paving');
    this.add.rectangle(left, top + 22, width, 2, 0x8b9bb4).setOrigin(0).setDepth(-9);
    tile(left, top + 24, width, 40, 'asphalt');
    for (let x = left; x < left + width; x += 24) this.add.rectangle(x, top + 43.5, 12, 1.5, 0xe6e1d6).setOrigin(0).setDepth(-9);
    this.add.rectangle(left, top + 64, width, 2, 0x8b9bb4).setOrigin(0).setDepth(-9);
    tile(left, top + 66, width, 22, 'paving');
    tile(left, top + 88, width, 300, 'grass');
    // Дорожка от двери до тротуара через пустой участок.
    if (top > h + FACADE_H) tile(door.x - 12, h + FACADE_H, 24, top - h - FACADE_H, 'paving');
    // Пешеходный переход напротив входа.
    for (let y = top + 26; y < top + 62; y += 5) this.add.rectangle(door.x - 9, y, 18, 2.5, 0xe6e1d6).setOrigin(0).setDepth(-9);

    // Фонари вдоль тротуара (не на дорожке), скамейка и урна у входа.
    for (let x = -100; x < next.w + 40; x += 72) {
      if (this.lampAt(x)) this.art(x, top + 3, 'lamp').setOrigin(0.5, 0.95).setDepth(top + 3);
    }
    this.art(door.x + 44, top + 7, 'bench').setDepth(top + 7);
    this.art(door.x - 32, top + 6, 'bin').setDepth(top + 6);
    // Деревья и кусты на газоне вокруг здания.
    const trees: [number, number][] = [
      [-14 - WING_OUTER, next.h * 0.35],
      [-16 - WING_OUTER, next.h * 0.8],
      [next.w + 14, next.h * 0.3],
      [next.w + 16, next.h * 0.75],
      [next.w * 0.25, -12],
      [next.w * 0.75, -16],
    ];
    this.greenery = [];
    for (const [x, y] of trees) this.greenery.push(this.art(x, y, 'tree').setOrigin(0.5, 0.9).setDepth(y));
    for (let x = 10; x < next.w; x += 34) this.greenery.push(this.art(x, -6, 'bush').setDepth(-6));
  }

  /** Фонарь не ставим на дорожку к двери и на подъезд к складу. */
  private lampAt(x: number): boolean {
    const { door, warehouse } = this.layout;
    return Math.abs(x - door.x) > 20 && Math.abs(x - (warehouse.x + warehouse.w / 2)) > 18;
  }

  /** Светящийся слой поверх темноты: виден только вечером. */
  private nightGlow<T extends NightLight['obj']>(obj: T, alpha: number, neon?: number): T {
    obj.setBlendMode(Phaser.BlendModes.ADD).setDepth(LIGHT_DEPTH + 1).setAlpha(0);
    this.nightLights.push({ obj, alpha, neon });
    return obj;
  }

  /** Вывеска-неон: ореол и светящиеся буквы поверх вечерней темноты. */
  private neonSign(x: number, y: number, text: string, size: string, color: number, width: number): void {
    const seed = Math.random() * 1000;
    this.nightGlow(this.art(x, y, 'glow').setDisplaySize(width * 1.5, 34).setTint(color), 0.4, seed);
    const css = `#${color.toString(16).padStart(6, '0')}`;
    this.nightGlow(
      this.add.text(x, y, text, { fontFamily: UI_FONT, fontSize: size, color: css }).setOrigin(0.5).setResolution(4),
      0.85,
      seed,
    );
  }

  /** Кот спит на скамейке у входа, голуби клюют крошки на тротуаре. */
  private buildCritters(next: Layout): void {
    const { door } = this.layout;
    const top = next.h + 4;
    this.critterTimers.forEach((timer) => timer.remove());
    this.critterTimers = [];
    // Кот и доска отзывов — у самого входа: пока рядом пустой участок, они стоят у фасада,
    // а в самом большом магазине — на тротуаре (кот спит на скамейке).
    const atStreet = next === this.layout;
    const front = this.layout.h + FACADE_H;
    this.buildCat(door.x + 47, atStreet ? top + 8.5 : front + 10);
    this.buildReviewBoard(door.x + 28, atStreet ? top + 13 : front + 13);

    this.pigeons = [];
    // У края газона, подальше от прохожих: пугаются только тех, кто прошёл совсем рядом.
    const spots: [number, number][] = [
      [door.x - 64, top + 5],
      [door.x - 55, top + 7],
      [door.x - 47, top + 4],
    ];
    for (const [x, y] of spots) {
      const img = this.art(x, y, 'pigeon0').setOrigin(0.5, 1).setDepth(y).setFlipX(Math.random() < 0.5);
      const bird: Pigeon = { img, home: { x, y }, away: false };
      this.pigeons.push(bird);
      // Клюёт: наклоняется к земле и иногда разворачивается.
      const peck = () => {
        if (bird.away || Math.random() < 0.4) return;
        img.setTexture('pigeon1');
        this.time.delayedCall(220, () => !bird.away && img.active && img.setTexture('pigeon0'));
        if (Math.random() < 0.25) img.setFlipX(!img.flipX);
      };
      this.critterTimers.push(this.time.addEvent({ delay: Phaser.Math.Between(500, 900), loop: true, callback: peck }));
    }
  }

  /** Человек подошёл близко — голуби разлетаются и через десяток секунд возвращаются. */
  private scarePigeons(): void {
    for (const bird of this.pigeons) {
      if (bird.away || !bird.img.active) continue;
      // Ноги человека на 8 ниже центра спрайта.
      const near = [...this.people].some((p) => Math.abs(p.x - bird.home.x) < 12 && Math.abs(p.y + 8 - bird.home.y) < 14);
      if (!near) continue;
      bird.away = true;
      const { img, home } = bird;
      const dir = Math.random() < 0.5 ? -1 : 1;
      img.setTexture('pigeon_fly').setFlipX(dir < 0).setDepth(LIGHT_DEPTH - 1);
      const flap = this.time.addEvent({
        delay: 110,
        loop: true,
        callback: () => img.active && img.setTexture(img.texture.key === 'pigeon_fly' ? 'pigeon0' : 'pigeon_fly'),
      });
      this.tweens.add({
        targets: img,
        x: home.x + dir * Phaser.Math.Between(60, 90),
        y: home.y - Phaser.Math.Between(70, 100),
        alpha: 0,
        duration: 1400,
        ease: 'Sine.easeIn',
        onComplete: () => {
          flap.remove();
          this.time.delayedCall(Phaser.Math.Between(5000, 8000), () => {
            if (!img.active) return;
            // Прилетает обратно сверху и садится на своё место.
            img.setPosition(home.x - dir * 50, home.y - 60).setAlpha(1).setTexture('pigeon_fly').setFlipX(dir > 0);
            this.tweens.add({
              targets: img,
              x: home.x,
              y: home.y,
              duration: 1200,
              ease: 'Sine.easeOut',
              onComplete: () => {
                img.setTexture('pigeon0').setDepth(home.y);
                bird.away = false;
              },
            });
          });
        },
      });
    }
  }

  /** Толстые стены с кирпичной крышкой и фасад с витринами и дверями; в левой стене — двери во флигель. */
  private buildShell(): void {
    const { w, h, door } = this.layout;
    const cap = (x: number, y: number, ww: number, hh: number) =>
      this.add.tileSprite(x, y, ww, hh, 'wall_cap').setOrigin(0).setTileScale(1 / ART).setDepth(2);
    cap(-WALL, -4, w + 2 * WALL, 4);
    // Левая стена с проёмами в открытые комнаты флигеля.
    const gaps = this.openRooms()
      .map((room) => room.doorway.y)
      .sort((a, b) => a - b);
    let from = 0;
    for (const y of gaps) {
      cap(-WALL, from, WALL, y - 8 - from);
      this.buildWingDoor(y);
      from = y + 8;
    }
    cap(-WALL, from, WALL, h - from);
    cap(w, 0, WALL, h);
    this.add.tileSprite(-WALL, h, w + 2 * WALL, FACADE_H, 'facade').setOrigin(0).setTileScale(1 / ART).setDepth(h + 1);
    this.doorImg = this.art(door.x, h + 5, 'door').setDepth(h + 2);
    // Витрины с маленькими навесами слева и справа от двери.
    const segments: [number, number][] = [
      [8, door.x - 18],
      [door.x + 18, w - 2],
    ];
    for (const [from, to] of segments) {
      const n = Math.floor((to - from) / 24);
      const start = (from + to) / 2 - ((n - 1) * 24) / 2;
      for (let i = 0; i < n; i++) {
        const x = start + i * 24;
        this.art(x, h + 5.5, 'shopwin').setDepth(h + 2);
        this.art(x, h + 1.5, 'awning_small').setDepth(h + 40);
        this.windowLight(x, h + 5.5, h + 9);
      }
    }
    // Из дверей свет падает дорожкой на тротуар.
    this.nightGlow(this.art(door.x, h + 9, 'light_spill').setOrigin(0.5, 0).setScale(1.3 / ART, 1.4 / ART).setTint(0xffd890), 0.55);
    // Главный навес над входом: покупатели проходят под ним.
    this.art(door.x, h + 1, 'awning').setScale(1 / ART, 0.6 / ART).setDepth(h + 41);
  }

  /**
   * Острова-витрины «Акция» в пустом центре зала и список препятствий для обхода:
   * полки (и места под них), витрины, касса. Человек за мебелью — если его центр выше её задней кромки,
   * перед ней — если ноги ниже передней.
   */
  private buildShowcases(): void {
    // Витрины с товаром в пустом центре зала больше не ставим: игроки принимали их за полки,
    // с которых почему-то не покупают. Пустые места под полки размечены на полу.
    const { slots, counter } = this.layout;
    const furniture = (x: number, y: number): Rect => ({ x: x - 25, y: y - 16, w: 50, h: 24 });
    // Места под полки обходят всегда: полку могут купить утром без перестройки зала.
    this.obstacles = slots.map(({ x, y }) => furniture(x, y));
    this.obstacles.push({ x: counter.x - 13, y: counter.y - 30, w: 26, h: 54 });
    // Левая стена: вдоль неё не ходят, во флигель — только через двери.
    const { h } = this.layout;
    let from = -4;
    for (const y of this.openRooms().map((room) => room.doorway.y).sort((a, b) => a - b)) {
      this.obstacles.push({ x: -WALL - 2, y: from, w: WALL + 2, h: y - 8 - from });
      from = y + 8;
    }
    this.obstacles.push({ x: -WALL - 2, y: from, w: WALL + 2, h: h - from });
  }

  /** Где стоит ведро (в правом нижнем углу, за кассой) и уличный контейнер (у роллета склада). */
  private binSpot(): { x: number; y: number } {
    return { x: this.layout.w - 10, y: this.layout.h - 12 };
  }

  /** Куда встать, чтобы завязать мешок: ведро у правой стены, подходим слева. */
  private binStand(): { x: number; y: number } {
    const bin = this.binSpot();
    return { x: bin.x - 16, y: bin.y + 2 };
  }

  /** Контейнер у фасада слева от двери, на пути от двери не стоит. */
  private dumpSpot(): { x: number; y: number } {
    const { h } = this.layout;
    return { x: 18, y: h + FACADE_H + 9 };
  }

  /** Ведро в зале (нажми — продавец вынесет мусор) и зелёный контейнер на улице. */
  private buildBin(): void {
    const bin = this.binSpot();
    const dump = this.dumpSpot();
    this.binFill = 0;
    this.binBusy = false;
    this.binBy = null;
    this.bagCarried = 0;
    this.art(dump.x, dump.y, 'dumpster').setDepth(dump.y + 8);
    this.binImg = this.art(bin.x, bin.y, binSprite(this.state, 0)).setDepth(bin.y + 6);
    this.binImg.setInteractive({ useHandCursor: true }).on('pointerup', () => this.tap(() => this.takeOutTrash()));
    this.binGlow = this.binImg.preFX?.addGlow(0xe43b44, 0, 0, false, 0.1, 6);
    this.binStink = this.art(bin.x, bin.y - 14, 'stink').setDepth(bin.y + 30).setVisible(false);
    this.tweens.add({ targets: this.binStink, y: bin.y - 19, alpha: { from: 1, to: 0.35 }, duration: 900, yoyo: true, repeat: -1 });
    this.obstacles.push({ x: bin.x - 8, y: bin.y - 12, w: 16, h: 14 });
    this.refreshBin();
  }

  private binFull(): boolean {
    return this.binFill >= binCapacity(this.state);
  }

  private refreshBin(): void {
    if (!this.binImg?.active) return;
    const level = this.binFill === 0 ? 0 : this.binFull() ? 3 : this.binFill >= binCapacity(this.state) / 2 ? 2 : 1;
    this.binImg.setTexture(binSprite(this.state, level));
    this.binStink?.setVisible(this.binFull());
  }

  /** Мусор в ведро: оно подпрыгивает. */
  private putInBin(): void {
    this.binFill = Math.min(binCapacity(this.state), this.binFill + 1);
    this.refreshBin();
    sound.tap();
    if (this.binImg) this.tweens.add({ targets: this.binImg, scaleY: 1.15 / ART, duration: 90, yoyo: true });
    if (this.binFull()) this.popup(this.binSpot().x, this.binSpot().y - 18, t('popup.binFull'), '#ffd0d0');
  }

  /** Шаги «вынести мусор»: к ведру, завязать мешок, через дверь к контейнеру, бросить и вернуться. */
  private takeOutSteps(onBag: () => void, onDump: () => void): ChoreStep[] {
    const dump = this.dumpSpot();
    const { door, h } = this.layout;
    const outside = h + FACADE_H + 6;
    return [
      { ...this.binStand(), ms: BAG_MS, action: onBag },
      { x: door.x, y: door.y - 8 },
      { x: door.x, y: outside },
      { x: dump.x + 15, y: dump.y + 3, ms: DUMP_MS, action: onDump },
      { x: door.x, y: outside },
      { x: door.x, y: door.y - 8 },
    ];
  }

  private bagFromBin(): void {
    this.bagCarried = this.binFill;
    this.binFill = 0;
    this.refreshBin();
  }

  private bagToDumpster(): void {
    this.bagCarried = 0;
    this.binBusy = false;
    this.binBy = null;
    sound.coin();
    const dump = this.dumpSpot();
    this.puff(dump.x, dump.y - 6);
  }

  /** Продавец выносит мусор: долго, касса в это время пустует. */
  private takeOutTrash(): void {
    if (!this.running || this.sellerBusy || this.ownerScanning() || this.binBusy || this.binFill === 0) return;
    this.binBusy = true;
    this.binBy = 'seller';
    void this.doChore(
      this.takeOutSteps(
        () => {
          this.bagFromBin();
          this.carried.setTexture('trash_bag').setPosition(5, 1).setVisible(true);
        },
        () => {
          this.carried.setVisible(false).setTexture('box').setPosition(0, 3);
          this.bagToDumpster();
        },
      ),
    );
  }

  /** Витрина вечером светится, и тёплый свет из неё ложится на тротуар. */
  private windowLight(x: number, glassY: number, groundY: number): void {
    this.nightGlow(this.add.rectangle(x, glassY, 18, 5, 0xffc870), 0.45);
    this.nightGlow(this.art(x, groundY, 'light_spill').setOrigin(0.5, 0).setTint(0xffd08a), 0.45);
  }

  /** На пустом участке растёт бурьян и лежит всякое: кирпичи, песок, конусы, шина, лужа. */
  private scatterLot(next: Layout): void {
    const { w, h, door } = this.layout;
    const rnd = new Phaser.Math.RandomDataGenerator([`lot${this.state.level}`]);
    const areas: { x: number; y: number; w: number; h: number }[] = [];
    if (next.w > w) areas.push({ x: w + WALL + 6, y: 6, w: next.w - w - WALL - 14, h: next.h - 16 });
    if (next.h > h) areas.push({ x: 8, y: h + FACADE_H + 6, w: w - 4, h: next.h - h - FACADE_H - 16 });
    for (const a of areas) {
      if (a.w < 10 || a.h < 10) continue;
      const count = 2 + Math.round((a.w * a.h) / 1400);
      for (let i = 0; i < count; i++) {
        const x = a.x + rnd.frac() * a.w;
        const y = a.y + rnd.frac() * a.h;
        // Не на дорожке к двери.
        if (Math.abs(x - door.x) < 20 && y > h) continue;
        const key = rnd.weightedPick(['weeds', 'weeds', 'weeds', 'puddle', 'tire', 'cone', 'sand', 'bricks']);
        this.art(x, y, key).setDepth(key === 'puddle' ? -7 : y);
      }
    }
  }

  /** Пустая соседняя площадь «Сдаётся» за забором — туда магазин вырастет при расширении. */
  private buildForRent(next: Layout): void {
    const { w, h, door } = this.layout;
    const cost = STORE_LEVELS[this.state.level + 1].cost;
    const tile = (x: number, y: number, ww: number, hh: number, key: string, depth = -5) =>
      this.add.tileSprite(x, y, ww, hh, key).setOrigin(0).setTileScale(1 / ART).setDepth(depth);
    if (next.w > w) tile(w + 3, 0, next.w - w - 3, next.h, 'lot', -8);
    if (next.h > h) tile(0, h + 3, w + 3, next.h - h - 3, 'lot', -8);
    this.scatterLot(next);
    // Забор по краю участка, в нём проход к двери.
    if (next.w > w) {
      tile(w + 3, -5, next.w - w - 3, 7, 'fence_h');
      tile(next.w - 4, 0, 4, next.h, 'fence_v');
    }
    if (next.h > h) {
      tile(0, h + 3, 4, next.h - h - 3, 'fence_v');
      tile(0, next.h - 7, door.x - 12, 7, 'fence_h', next.h);
      tile(door.x + 12, next.h - 7, next.w - door.x - 12, 7, 'fence_h', next.h);
    } else if (next.w > w) {
      tile(w + 3, next.h - 7, next.w - w - 3, 7, 'fence_h', next.h);
    }
    // Табличка «Сдаётся» с ценой.
    // Табличка стоит ниже кота и доски отзывов у входа.
    const signX = next.w - w > 40 ? w + (next.w - w) / 2 : door.x + 44;
    const signY = next.w - w > 40 ? next.h / 2 : Math.max(h + (next.h - h) / 2, h + FACADE_H + 22);
    this.art(signX, signY, 'for_rent').setDepth(signY + 8);
    this.add
      .text(signX, signY - 2.5, `${t('store.forRent')}\n${cost} 💰`, {
        fontFamily: UI_FONT,
        fontSize: '4px',
        color: '#2b2233',
        align: 'center',
      })
      .setOrigin(0.5)
      .setResolution(8)
      .setDepth(signY + 9);
  }

  /** Плакаты на стене, растения и корзинки у входа — чтобы зал не выглядел пустым. */
  /** Первое место, где вещь 26×20 не мешает полкам, кассе, складу и автомату. */
  private freeSpot(candidates: { x: number; y: number }[]): { x: number; y: number } | null {
    const { slots, counter, w, wallH } = this.layout;
    const blocked = [
      ...slots.map((s) => ({ x: s.x - 22, y: s.y - 14, w: 44, h: 30 })),
      { x: counter.x - 10, y: counter.y - 28, w: 20, h: 64 },
      { x: w - 16, y: wallH + 44, w: 16, h: 24 },
    ];
    return (
      candidates.find((c) =>
        blocked.every((b) => c.x + 13 < b.x || c.x - 13 > b.x + b.w || c.y + 10 < b.y || c.y - 10 > b.y + b.h),
      ) ?? null
    );
  }

  private buildDecor(): void {
    const { w, h, wallH, wc, door, slots } = this.layout;
    // На стене по очереди плакаты и окна, между ними часы.
    // Вместо плакатов — купленная картина; вместо часов — неон «ОТКРЫТО».
    const art = activeDecor(this.state, 'art')?.texture ?? 'poster';
    for (let x = 30, i = 0; x < wc.x - 16; x += 64, i++) this.art(x, 12, i % 2 ? 'window' : art).setDepth(1);
    if (62 < wc.x - 16) {
      if (activeDecor(this.state, 'neon')) {
        const glow = this.art(62, 14, 'glow').setScale(46 / 64, 24 / 64).setTint(0xf6757a).setBlendMode(Phaser.BlendModes.ADD).setDepth(1);
        this.tweens.add({ targets: glow, alpha: { from: 0.8, to: 0.4 }, duration: 900, yoyo: true, repeat: -1 });
        this.art(62, 13, 'neon').setDepth(2);
      } else this.art(62, 11, 'clock').setDepth(1);
    }
    // Ковёр в центре зала.
    if (activeDecor(this.state, 'rug')) this.art(w / 2, (wallH + h) / 2 + 6, 'rug').setDepth(1);
    this.buildLights();
    this.buildShowpiece();
    // Стойка со сладостями у кассы, в больших магазинах — тележки у входа.
    const { counter } = this.layout;
    this.art(counter.x, counter.y + 39, 'candy_rack').setDepth(counter.y + 40);
    if (this.state.level >= 2 || (this.state.level >= 1 && hasUpgrade(this.state, 'cart'))) this.art(door.x + 46, h - 10, 'carts').setDepth(h - 4);
    // Коврик у входа и автомат с напитками у правой стены.
    this.art(door.x, h - 7, gearTier(this.state, 'entrance') ? 'mat_grate' : 'mat').setDepth(1);
    this.art(w - 8, wallH + 56, 'vending').setDepth(wallH + 66);
    // Мягкая тень вдоль стены — пол уходит под неё.
    this.add.rectangle(0, wallH, w, 3, 0x181425, 0.18).setOrigin(0).setDepth(1);
    this.art(door.x + 26, h - 8, 'baskets').setDepth(h - 8);
    // Растения в свободных углах у правой стены — не на пути покупателей.
    const spots = [
      { x: w - 9, y: wallH + 14 },
      { x: w - 9, y: h - 40 },
    ];
    for (const p of spots) {
      const busy = [...slots, ...this.layout.showcases].some((s) => Math.abs(s.x - p.x) < 28 && Math.abs(s.y - p.y) < 24);
      if (!busy) this.art(p.x, p.y, activeDecor(this.state, 'plants') ? 'plant_big' : 'plant').setDepth(p.y + 6);
    }
  }

  /** Премиальный свет: бра, лампы, фонари или люстры между картинами, гирлянда — по всей стене. */
  private buildLights(): void {
    const light = activeDecor(this.state, 'light');
    if (!light) return;
    const { w, wallH, wc } = this.layout;
    const warm = 0xffd27a;
    if (light.id === 'light_garland') {
      this.add.tileSprite(0, 0, w, 6, 'light_garland').setOrigin(0).setTileScale(1 / ART).setDepth(2);
      const lit = this.add.tileSprite(0, 0, w, 6, 'light_garland_lit').setOrigin(0).setTileScale(1 / ART).setDepth(2);
      lit.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: lit, alpha: { from: 1, to: 0.35 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      return;
    }
    // Между плакатами и окнами (над часами место занято).
    const hanging = light.id !== 'light_sconce';
    const y = hanging ? (light.id === 'light_chandelier' ? 6 : 6.5) : 10;
    // По бокам от часов и дальше — между плакатами и окнами.
    const spots = [46, 78];
    for (let x = 126; x < wc.x - 12; x += 64) spots.push(x);
    for (const x of spots.filter((sx) => sx < wc.x - 12)) {
      this.art(x, y, light.texture!).setDepth(2);
      const bulb = this.art(x + (hanging ? 0.5 : 2), hanging ? y + 3 : y - 3, 'glow')
        .setDisplaySize(light.id === 'light_chandelier' ? 30 : 18, 14)
        .setTint(warm)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.45)
        .setDepth(2);
      this.tweens.add({ targets: bulb, alpha: { from: 0.45, to: 0.32 }, duration: 1600 + (x % 5) * 140, yoyo: true, repeat: -1 });
      // Тёплое пятно на полу у стены — вечером ярче.
      this.nightGlow(this.art(x, wallH + 6, 'glow').setDisplaySize(52, 22).setTint(warm), 0.35);
      this.add.image(x, wallH + 6, 'glow').setScale(52 / 64, 22 / 64).setTint(warm).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.12).setDepth(1);
    }
  }

  /** Украшение зала (аквариум, фонтан, автомат…) — в свободном месте, с маленькой анимацией. */
  private buildShowpiece(): void {
    const item = activeDecor(this.state, 'showpiece');
    if (!item) return;
    const { w, wallH, h } = this.layout;
    const spot = this.freeSpot([
      { x: w - 16, y: wallH + 92 },
      { x: w - 70, y: wallH + 40 },
      { x: w / 2, y: h - 30 },
    ]);
    if (!spot) return;
    const img = this.art(spot.x, spot.y, item.texture!).setDepth(spot.y + 8);
    const top = spot.y - img.displayHeight / 2;
    if (item.id === 'lucky_cat') {
      // Кот-удача машет лапкой.
      let up = true;
      this.tweens.add({
        targets: img,
        alpha: 1,
        duration: 450,
        repeat: -1,
        onRepeat: () => {
          up = !up;
          img.setTexture(up ? 'lucky_cat' : 'lucky_cat2');
        },
      });
    } else if (item.id === 'jukebox') {
      // Музыкальный автомат играет: из него всплывают ноты.
      const note = this.add
        .text(spot.x + 4, top + 2, '♪', { fontFamily: UI_FONT, fontSize: '7px', color: '#fee761', stroke: '#181425', strokeThickness: 2 })
        .setOrigin(0.5)
        .setResolution(4)
        .setDepth(spot.y + 9);
      this.tweens.add({
        targets: note,
        y: top - 10,
        x: spot.x + 8,
        alpha: { from: 1, to: 0 },
        duration: 1400,
        repeat: -1,
        repeatDelay: 500,
        onRepeat: () => note.setText(Math.random() < 0.5 ? '♪' : '♫'),
      });
    } else if (item.id === 'fountain' || item.id === 'aquarium') {
      // Блики на воде.
      const glint = this.art(spot.x + (item.id === 'fountain' ? 0 : 6), item.id === 'fountain' ? top + 3 : spot.y - 4, 'glow')
        .setDisplaySize(10, 10)
        .setTint(0xc8fbff)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(spot.y + 9);
      this.tweens.add({ targets: glint, alpha: { from: 0.7, to: 0.15 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  // ---------- Флигель: склад, пекарня, кофейня ----------

  /** Пекарня и кофейня открыты, когда куплены печь и кофейный уголок. */
  private bakeryOpen(): boolean {
    return hasUpgrade(this.state, 'oven');
  }

  private coffeeOpen(): boolean {
    return hasUpgrade(this.state, 'coffee');
  }

  /** Комнаты флигеля, в которые есть дверь из зала. */
  private openRooms(): Room[] {
    const { warehouse, bakery, coffee } = this.layout;
    return [warehouse, ...(this.bakeryOpen() ? [bakery] : []), ...(this.coffeeOpen() ? [coffee] : [])];
  }

  /**
   * Флигель слева от зала: наружные стены, стены между комнатами, фасад склада с воротами
   * и подъезд к ним с улицы. Пекарня и кофейня, пока не открыты, стоят тёмные и запертые.
   */
  private buildWing(): void {
    const { h, wing, warehouse, bakery, coffee } = this.layout;
    const cap = (x: number, y: number, ww: number, hh: number) =>
      this.add.tileSprite(x, y, ww, hh, 'wall_cap').setOrigin(0).setTileScale(1 / ART).setDepth(2);
    const left = -WING_OUTER;
    cap(left, wing.y - 4, WING_OUTER - WALL, 4);
    cap(left, wing.y, WALL, h - wing.y);
    cap(left + WALL, warehouse.y - WALL, wing.w, WALL);
    cap(left + WALL, bakery.y - WALL, wing.w, WALL);
    this.add.tileSprite(left, h, WING_OUTER - WALL, FACADE_H, 'facade').setOrigin(0).setTileScale(1 / ART).setDepth(h + 1);
    const gateX = warehouse.x + warehouse.w / 2;
    this.art(gateX, h + 5.5, 'shutter').setDepth(h + 2);
    // Подъезд от тротуара к воротам склада.
    const top = this.next.h + 4;
    if (top > h + FACADE_H) this.add.tileSprite(gateX - 12, h + FACADE_H, 24, top - h - FACADE_H, 'paving').setOrigin(0).setTileScale(1 / ART).setDepth(-9);
    this.buildRoom(bakery, 'bakery', this.bakeryOpen());
    this.buildRoom(coffee, 'coffee', this.coffeeOpen());
  }

  /**
   * Дверь из зала во флигель: порог, деревянные косяки, створка открыта внутрь комнаты,
   * коврик в зале и табличка над входом — куда ведёт.
   */
  private buildWingDoor(y: number): void {
    const { warehouse, bakery, coffee } = this.layout;
    const room = [warehouse, bakery, coffee].find((r) => r.doorway.y === y);
    this.add.tileSprite(-WALL, y - 8, WALL, 16, 'wh_floor').setOrigin(0).setTileScale(1 / ART).setDepth(1);
    // Косяки — сверху и снизу проёма.
    for (const jy of [y - 9.5, y + 7.5]) this.add.rectangle(-WALL - 1, jy, WALL + 2, 2.5, 0x5a3a2a).setOrigin(0).setDepth(jy + 6);
    // Створка распахнута внутрь комнаты.
    this.add.rectangle(-WALL - 11, y - 8, 11, 2, 0xb86f50).setOrigin(0).setStrokeStyle(0.5, 0x3b2a35).setDepth(y - 2);
    // Коврик со стороны зала.
    this.add.rectangle(0.5, y - 6, 9, 12, room === warehouse ? 0x5a6988 : 0x9e2835, 0.85).setOrigin(0).setDepth(1);
    const label = room === coffee ? t('wing.doorCoffee') : room === bakery ? t('wing.doorBakery') : t('wing.doorWarehouse');
    const plate = this.add
      .text(3, y - 15, label, { fontFamily: UI_FONT, fontSize: '5px', color: '#fee761', backgroundColor: '#2b2233', padding: { x: 2, y: 1 } })
      .setOrigin(0, 0.5)
      .setResolution(4)
      .setDepth(y + 40);
    plate.setAlpha(0.95);
  }

  /** Комната флигеля: пол, кусок стены с табличкой; закрытая — тёмная, с замком. */
  private buildRoom(room: Room, kind: 'bakery' | 'coffee', open: boolean): void {
    const { x, y, w, h } = room;
    this.add.tileSprite(x, y, w, h, kind === 'bakery' ? 'floor2' : 'floor_wood').setOrigin(0).setTileScale(1 / ART);
    this.add
      .tileSprite(x, y, w, 14, 'wall')
      .setOrigin(0)
      .setTileScale(1 / ART)
      .setTint(kind === 'bakery' ? 0xffe2d2 : 0xe6dcf6)
      .setDepth(1);
    this.add.rectangle(x, y + 14, w, 2, 0x181425, 0.18).setOrigin(0).setDepth(1);
    this.art(x + w / 2, y + 7, 'wh_sign').setDepth(y + 5);
    this.add
      .text(x + w / 2, y + 7, t(`wing.${kind}`), { fontFamily: UI_FONT, fontSize: '5px', color: '#fee761' })
      .setOrigin(0.5)
      .setResolution(4)
      .setDepth(y + 6);
    if (open) {
      this.nightGlow(this.art(x + w / 2, y + 26, 'glow').setScale(44 / 64).setTint(kind === 'bakery' ? 0xffd8a0 : 0xffe8c8), 0.5);
      return;
    }
    this.add.rectangle(x, y + 16, w, h - 16, 0x1d1a26, 0.62).setOrigin(0).setDepth(y + h);
    this.add
      .text(x + w / 2, y + h / 2 + 6, `🔒\n${t(`wing.${kind}Locked`)}`, { fontFamily: UI_FONT, fontSize: '5px', color: '#c0cbdc', align: 'center' })
      .setOrigin(0.5)
      .setResolution(4)
      .setDepth(y + h + 1);
  }

  /** Центр ряда тары на складе: ряды стоят на балках стеллажа. */
  private warehouseRowY(row: number): number {
    return this.layout.warehouse.y + 16 + row * 8;
  }

  private buildWarehouse(): void {
    const { x, y, w, h, doorway } = this.layout.warehouse;
    this.add.tileSprite(x, y, w, h, 'wh_floor').setOrigin(0).setTileScale(1 / ART);
    // Складской стеллаж: на каждой балке — поддон и ряд тары.
    const rows = this.layout.warehouse.rows;
    for (let row = 0; row < rows; row++) {
      const rowY = this.warehouseRowY(row);
      this.art(x, rowY - 4, 'rack').setOrigin(0).setDepth(rowY - 101);
    }
    // Жёлто-чёрная разметка проезда под стеллажом и у проёма.
    const laneY = this.warehouseRowY(rows - 1) + 7;
    this.add.tileSprite(x + 2, laneY, w - 4, 2, 'hazard').setOrigin(0).setTileScale(1 / ART).setDepth(laneY - 100);
    this.add.tileSprite(x + w - 2, doorway.y - 10, 2, 20, 'hazard').setOrigin(0).setTileScale(1 / ART).setDepth(doorway.y - 100);
    // Огнетушитель у проёма и лампа под потолком.
    this.art(x + w - 4, doorway.y - 16, 'extinguisher').setDepth(doorway.y - 90);
    this.nightGlow(this.art(x + w / 2, y + 10, 'glow').setScale(40 / 64).setTint(0xfff0c8), 0.5);
    this.art(x + w / 2, y + 6, 'wh_sign').setDepth(y + 5);
    this.add
      .text(x + w / 2, y + 6, t('warehouse.label'), { fontFamily: UI_FONT, fontSize: '6px', color: '#fee761' })
      .setOrigin(0.5)
      .setResolution(4)
      .setDepth(y + 6);
  }

  /** Создаёт картинки для новых полок и обновляет товар на всех. */
  private refreshShelves(): void {
    this.layout.slots.forEach((slot, i) => {
      // Свободное место под полку — разметка на полу: полку покупают утром во вкладке «Полки».
      if (!this.slotDecor[i]) {
        const mark = this.art(slot.x, slot.y + 2, 'slot_empty').setDepth(1.5);
        mark.setInteractive({ useHandCursor: true }).on('pointerup', () =>
          this.tap(() => i >= this.state.shelves.length && this.popup(slot.x, slot.y - 8, t('popup.slotEmpty'), '#fff3b0')),
        );
        this.slotDecor[i] = mark;
      }
      this.slotDecor[i].setVisible(i >= this.state.shelves.length);
    });
    this.state.shelves.forEach((shelf, i) => {
      let view = this.shelfViews[i];
      if (!view || view.kind !== shelf.kind) {
        view?.bg.destroy();
        view?.front.destroy();
        view?.shadow.destroy();
        view?.items.forEach((img) => img.destroy());
        view?.backItems.forEach((img) => img.destroy());
        view?.pips.forEach((img) => img.destroy());
        view?.low.destroy();
        view?.promo.destroy();
        view?.lights.forEach((obj) => obj.destroy());
        view = this.buildShelf(i, shelf.kind);
        this.shelfViews[i] = view;
      }

      const capacity = shelfCapacity(shelf);
      const perRow = capacity / 2;
      const step = 34 / perRow;
      const slot = this.layout.slots[i];
      const units = PRODUCT_IDS.flatMap((id) => (shelf.items[id] ?? []).map((unit) => ({ id, unit })));
      view.items.forEach((img, n) => {
        const entry = units[n];
        img.setVisible(n < capacity && Boolean(entry));
        img.setPosition(slot.x - 17 + step * ((n % perRow) + 0.5), slot.y - 5 + Math.floor(n / perRow) * 11);
        if (entry) {
          // Три вида каждого товара (батон, багет, булка…) — полка выглядит живой.
          img.setTexture(`item_${entry.id}_${(n + PRODUCT_IDS.indexOf(entry.id)) % ITEM_VARIANTS}`);
          img.setTint(entry.unit.markdown ? 0xffe08a : entry.unit.bad ? 0x9a8a80 : 0xffffff);
        }
        // Позади — такой же товар чуть выше и в тени, между передними.
        const back = view.backItems[n];
        back.setVisible(img.visible);
        if (entry) {
          back.setPosition(Math.min(img.x + step / 2, slot.x + 15), img.y - 2);
          back.setTexture(`item_${entry.id}_${(n + PRODUCT_IDS.indexOf(entry.id) + 1) % ITEM_VARIANTS}`);
        }
      });
      view.pips.forEach((pip, n) => pip.setVisible(n < shelf.level));
      view.promo.setVisible(PRODUCT_IDS.some((id) => canPlace(id, shelf) && promoKind(this.state, id)));
      const few = !shelf.broken && units.length > 0 && units.length <= LOW_STOCK;
      if (few) view.low.setText(t('shelf.low', { n: units.length }));
      view.low.setVisible(few);
      view.needsStock = !shelf.broken && units.length === 0 && PRODUCT_IDS.some((id) => canPlace(id, shelf) && (this.state.warehouse[id]?.length ?? 0) > 0);
      view.bg.setTint(shelf.broken ? BROKEN_TINT : SHELF_LOOK[shelf.kind].tint);
    });
  }

  private buildShelf(index: number, kind: Category): ShelfView {
    const slot = this.layout.slots[index];
    const look = SHELF_LOOK[kind];
    const shadow = this.art(slot.x, slot.y + 12, 'shadow_wide').setDepth(slot.y - 15);
    // Мебель в виде «три четверти»: над передней частью видна крышка высотой FURNITURE_TOP.
    const bg = this.art(slot.x, slot.y - FURNITURE_TOP / 2, look.texture).setTint(look.tint).setDepth(slot.y - 14);
    const front = this.art(slot.x, slot.y - FURNITURE_TOP / 2, `${look.texture}_front`).setDepth(slot.y - 12);
    bg.setInteractive({ useHandCursor: true }).on('pointerup', () => this.tap(() => this.restockShelf(index)));
    const items = Array.from({ length: SHELF_LEVELS[SHELF_LEVELS.length - 1].capacity }, () => this.art(slot.x, slot.y, 'item').setDepth(slot.y - 13));
    const backItems = items.map(() => this.art(slot.x, slot.y, 'item').setDepth(slot.y - 13.5).setTint(0xa89a90).setVisible(false));
    // Уровень улучшения — жёлтые точки над полкой.
    const pips = [0, 1, 2].map((n) => this.art(slot.x - 17 + n * 4, slot.y - 16, 'pip').setDepth(slot.y - 12));
    // Красный ценник «АКЦИЯ» над полкой с товаром дня.
    const promo = this.add
      .text(slot.x - 12, slot.y - 22, t('shelf.promo'), { fontFamily: UI_FONT, fontSize: '5px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#e43b44', padding: { x: 2, y: 1 } })
      .setOrigin(0.5)
      .setResolution(6)
      .setDepth(990)
      .setAngle(-8)
      .setVisible(false);
    this.tweens.add({ targets: promo, angle: 8, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const glow = bg.preFX?.addGlow(0xfee761, 0, 0, false, 0.1, 8);
    const low = this.add
      .text(slot.x + 6, slot.y - 22, '', {
        fontFamily: UI_FONT,
        fontSize: '5px',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: '#d95763',
        padding: { x: 2, y: 1 },
      })
      .setOrigin(0.5)
      .setResolution(6)
      .setDepth(990)
      .setVisible(false);
    this.tweens.add({ targets: low, y: low.y - 1.5, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const lights: Phaser.GameObjects.GameObject[] = [];
    if (look.texture === 'fridge') {
      // Новые холодильники — с наклейкой класса энергосбережения.
      if (gearTier(this.state, 'fridge')) lights.push(this.art(slot.x + 13, slot.y - 15, 'eco_label').setDepth(slot.y - 11));
      const cool = kind === 'meat' ? 0xffd8d8 : 0xc8f0ff;
      const glass = this.add.rectangle(slot.x, slot.y - 1.5, 36, 19, cool).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.1).setDepth(slot.y - 12.5);
      this.tweens.add({ targets: glass, alpha: 0.16, duration: 1800 + index * 130, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const spill = this.art(slot.x, slot.y + 13, 'light_spill').setOrigin(0.5, 0).setScale(1.4 / ART, 0.5 / ART).setTint(cool);
      spill.setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3).setDepth(0.4);
      lights.push(glass, spill);
    }
    return { kind, bg, front, shadow, items, backItems, pips, lights, low, promo, glow, needsStock: false };
  }

  private refreshWarehouse(): void {
    // На складе помещается ~30 коробок: в большом складе одна коробка изображает больше штук.
    const perBox = unitsPerBox(warehouseCapacity(this.state));
    const boxes = PRODUCT_IDS.flatMap((id) =>
      Array.from({ length: Math.ceil((this.state.warehouse[id]?.length ?? 0) / perBox) }, () => id),
    ).slice(0, WAREHOUSE_COLS * this.layout.warehouse.rows);
    // Купленное утром ещё едет: последние коробки появятся, когда водитель их занесёт.
    boxes.length = Math.max(0, boxes.length - this.awaitingBoxes);
    while (this.boxes.length < boxes.length) this.boxes.push(this.art(0, 0, 'box'));
    this.boxes.forEach((img, n) => {
      const id = boxes[n];
      img.setVisible(Boolean(id));
      if (!id) return;
      // У каждого товара своя тара: лоток, ящик, мешок, пластиковый ящик, термобокс.
      const row = Math.floor(n / WAREHOUSE_COLS);
      const y = this.warehouseRowY(row);
      img.setPosition(this.layout.warehouse.x + 8 + (n % WAREHOUSE_COLS) * 9, y).setTexture(`crate_${id}`).setDepth(y - 100);
    });
  }

  private refreshToilet(): void {
    const dirt = this.toiletDirt;
    this.wcBar.setDisplaySize((14 * dirt) / 100, 2);
    this.wcBar.setTint(dirt < 30 ? 0x8fd16a : dirt < TOILET_DIRTY ? 0xf2c14e : 0xd95763);
    this.wcDoor.setTint(dirt >= TOILET_DIRTY ? 0xc8a878 : 0xffffff);
    this.wcStink.setVisible(dirt >= TOILET_DIRTY);
  }

  /** Картинка из public/assets в мировом масштабе. */
  private art(x: number, y: number, key: string): Phaser.GameObjects.Image {
    return this.add.image(x, y, key).setScale(1 / ART);
  }

  /** Человечек из слоёв: тень, штаны, рубашка, форма, кожа, волосы — каждый слой перекрашивается тинтом. */
  private makePerson(x: number, y: number, look: Look): Phaser.GameObjects.Container {
    const shadow = this.art(0, 8.5, 'shadow');
    const legs = this.art(0, 0, 'p_legs0').setTint(look.pants ?? 0x3a4466);
    const shirt = this.art(0, 0, 'p_shirt').setTint(look.shirt);
    const skin = this.art(0, 0, 'p_skin').setTint(look.skin);
    const hairBase = `p_hair_${look.style ?? 'short'}`;
    const hair = this.art(0, 0, hairBase).setTint(look.hair ?? 0x4a2c1a);
    // Слои, которые поворачиваются вместе с человеком: [картинка, имя текстуры спереди].
    const layers: [Phaser.GameObjects.Image, string][] = [
      [shirt, 'p_shirt'],
      [skin, 'p_skin'],
      [hair, hairBase],
    ];
    const parts = [shadow, legs, shirt];
    if (look.acc) {
      const acc = this.art(0, 0, `acc_${look.acc}`).setTint(look.accTint ?? 0xffffff);
      layers.push([acc, `acc_${look.acc}`]);
      parts.push(acc);
    }
    if (look.bag) {
      const bag = this.art(0, 0, look.bag).setTint(look.bagTint ?? 0xffffff);
      layers.push([bag, look.bag]);
      parts.push(bag);
    }
    parts.push(skin);
    if (look.glasses) {
      const glasses = this.art(0, 0, 'acc_glasses');
      layers.push([glasses, 'acc_glasses']);
      parts.push(glasses);
    }
    parts.push(hair);
    const person = this.add.container(x, y, parts).setDepth(y);
    const baseScale = look.kid ? 0.8 : 1;
    person.setScale(baseScale);
    person.setData('legs', legs);
    person.setData('shadow', shadow);
    person.setData('layers', layers);
    person.setData('upper', layers.map(([img]) => img));
    person.setData('facing', 'down');
    person.setData('baseScale', baseScale);
    // Сдвиг фазы: люди дышат и шагают не в унисон.
    person.setData('phase', Math.random() * 1000);
    if (look.stroller !== undefined) {
      const stroller = this.art(0, 9, 'stroller').setTint(look.stroller);
      person.add(stroller);
      person.setData('stroller', stroller);
    }
    if (look.dog !== undefined) {
      const dog = this.art(x - 9, y + 6, 'dog_sit0').setTint(look.dog);
      person.setData('dog', dog);
      person.once('destroy', () => dog.destroy());
    }
    this.people.add(person);
    person.once('destroy', () => this.people.delete(person));
    return person;
  }

  /** Открывает выполненные достижения; новые — всплывашкой по очереди. Возвращает, что открылось. */
  private checkAchievements(live: boolean): AchievementId[] {
    const { state, unlocked } = unlockAchievements(liveProgress(this.state, live ? this.stats : undefined));
    if (!unlocked.length) return unlocked;
    this.state = state;
    saveGame(state);
    unlocked.forEach((id, i) => this.time.delayedCall(i * 3800, () => announceAchievement(id)));
    return unlocked;
  }

  /** Вторая половинка пары идёт следом за первой — тем же путём, чуть позади. */
  private addCompanion(leader: Phaser.GameObjects.Container): void {
    const companion = this.makePerson(leader.x - 8, leader.y + 1, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS)));
    this.addUmbrella(companion);
    companion.setData('leader', leader);
    leader.setData('trail', [] as { x: number; y: number }[]);
    leader.once('destroy', () => companion.destroy());
    // Парочка иногда обменивается сердечками.
    const hearts = this.time.addEvent({
      delay: 5000,
      loop: true,
      callback: () => companion.active && Math.random() < 0.35 && this.emote(companion, 'emo_heart'),
    });
    companion.once('destroy', () => hearts.remove());
  }

  /** Спутник идёт по следу ведущего: берёт точку следа не ближе 9 к нему. */
  private followLeader(person: Phaser.GameObjects.Container, leader: Phaser.GameObjects.Container): void {
    const trail = (leader.getData('trail') as { x: number; y: number }[] | undefined) ?? [];
    let target: { x: number; y: number } | undefined;
    for (let i = trail.length - 1; i >= 0; i--) {
      if (Phaser.Math.Distance.Between(trail[i].x, trail[i].y, leader.x, leader.y) >= 9) {
        target = trail[i];
        break;
      }
    }
    const dx = (target?.x ?? person.x) - person.x;
    const dy = (target?.y ?? person.y) - person.y;
    const moving = Math.hypot(dx, dy) > 0.4;
    if (moving) {
      person.x += dx * 0.2;
      person.y += dy * 0.2;
      person.setDepth(person.y);
      this.setFacing(person, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy < 0 ? 'up' : 'down');
    }
    person.setData('walking', moving);
  }

  /** Собака идёт рядом с хозяином; пока он в магазине — сидит привязанная у входа и виляет хвостом. */
  private updateDog(person: Phaser.GameObjects.Container, dog: Phaser.GameObjects.Image): void {
    const { h, door } = this.layout;
    const outside = person.y > h + FACADE_H;
    const side = person.getData('facing') === 'left' ? 1 : -1;
    const tx = outside ? person.x + side * 9 : door.x + 17;
    const ty = outside ? person.y + 5 : h + FACADE_H + 7;
    const dx = tx - dog.x;
    const dy = ty - dog.y;
    const d = Math.hypot(dx, dy);
    const now = this.time.now;
    if (d > 0.8) {
      const step = Math.min(d, Math.max(0.9, d * 0.18));
      dog.x += (dx / d) * step;
      dog.y += (dy / d) * step;
      dog.setTexture(Math.floor(now / 110) % 2 ? 'dog0' : 'dog1').setFlipX(dx < 0);
    } else {
      dog.setTexture(Math.floor(now / (outside ? 700 : 220)) % 2 ? 'dog_sit0' : 'dog_sit1').setFlipX(false);
    }
    dog.setDepth(dog.y + 3);
  }

  /** Коляска всегда впереди мамы: снизу, сверху (за ней) или сбоку. */
  private placeStroller(person: Phaser.GameObjects.Container, facing: Facing): void {
    const stroller = person.getData('stroller') as Phaser.GameObjects.Image | undefined;
    if (!stroller) return;
    if (facing === 'down') {
      stroller.setTexture('stroller').setPosition(0, 9).setFlipX(false);
      person.bringToTop(stroller);
    } else if (facing === 'up') {
      stroller.setTexture('stroller').setPosition(0, -5).setFlipX(false);
      person.sendToBack(stroller);
    } else {
      stroller.setTexture('stroller_s').setPosition(facing === 'right' ? 11 : -11, 3).setFlipX(facing === 'left');
      person.bringToTop(stroller);
    }
  }

  /** Поворот: спереди, со спины или боком (левый бок — зеркальный правый). Значок охранника виден только спереди. */
  private setFacing(person: Phaser.GameObjects.Container, facing: Facing): void {
    if (person.getData('facing') === facing) return;
    person.setData('facing', facing);
    const suffix = VIEW_SUFFIX[facing];
    const layers = person.getData('layers') as [Phaser.GameObjects.Image, string][] | undefined;
    for (const [img, base] of layers ?? []) {
      if (FRONT_ONLY.has(base)) {
        img.setVisible(facing === 'down');
        continue;
      }
      img.setTexture(base + suffix).setFlipX(facing === 'left');
    }
    const legs = person.getData('legs') as Phaser.GameObjects.Image | undefined;
    legs?.setTexture(`p_legs0${suffix}`).setFlipX(facing === 'left');
    this.placeStroller(person, facing);
  }

  /** Монетки летят от кассы к счётчику денег в углу экрана. */
  private flyCoins(x: number, y: number, count: number): void {
    const target = this.cameras.main.getWorldPoint(70 * RES, 52 * RES);
    for (let i = 0; i < count; i++) {
      const coin = this.art(x + Phaser.Math.Between(-4, 4), y - 10, 'coin').setDepth(LIGHT_DEPTH + 5);
      this.tweens.add({
        targets: coin,
        x: target.x,
        y: target.y,
        scale: 0.8 / ART,
        delay: i * 70,
        duration: 650,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          coin.destroy();
          if (i === count - 1) this.hud.bumpMoney();
        },
      });
    }
  }

  /** «Серия ×3!» над кассой: крупная цифра, звёздочки, нота всё выше. */
  private celebrateCombo(n: number): void {
    const { counter } = this.layout;
    const color = COMBO_COLORS[Math.min(n - 2, COMBO_COLORS.length - 1)];
    const label = this.add
      .text(counter.x - 14, counter.y - 40, t('popup.combo', { n }), {
        fontFamily: UI_FONT,
        fontSize: `${Math.min(9 + n, 15)}px`,
        fontStyle: 'bold',
        color,
        stroke: '#181425',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setResolution(5)
      .setDepth(LIGHT_DEPTH + 6)
      .setScale(0.2)
      .setAngle(-8);
    this.tweens.add({ targets: label, scale: 1, angle: 0, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: label, y: label.y - 12, alpha: 0, delay: 900, duration: 500, onComplete: () => label.destroy() });
    const burst = this.add.particles(counter.x - 14, counter.y - 40, 'spark', {
      speed: { min: 20, max: 40 + n * 6 },
      lifespan: 600,
      scale: { start: 0.7, end: 0 },
      tint: [0xfee761, 0xffffff, 0xfeae34],
      quantity: 6 + n * 2,
      emitting: false,
    });
    burst.setDepth(LIGHT_DEPTH + 5).explode(6 + n * 2);
    this.time.delayedCall(800, () => burst.destroy());
    sound.combo(n);
  }

  /** Облачко пыли: мусор убрали. */
  private puff(x: number, y: number): void {
    const cloud = this.art(x, y - 2, 'puff').setDepth(y + 5);
    this.tweens.add({ targets: cloud, y: y - 8, scale: 0.8 / ART, alpha: 0, duration: 500, onComplete: () => cloud.destroy() });
  }

  /** Пузыри: туалет отмыт. */
  private bubbles(x: number, y: number): void {
    for (let i = 0; i < 6; i++) {
      const b = this.art(x + Phaser.Math.Between(-7, 7), y + Phaser.Math.Between(-4, 8), 'bubble_s').setDepth(y + 40);
      this.tweens.add({ targets: b, y: b.y - Phaser.Math.Between(10, 18), alpha: 0, delay: i * 80, duration: 700, onComplete: () => b.destroy() });
    }
  }

  /** Эмоция над головой: всплывает и тает. */
  private emote(person: Phaser.GameObjects.Container, key: 'emo_angry' | 'emo_heart' | 'emo_question'): void {
    if (!person.active) return;
    const icon = this.art(0, -17, key);
    person.add(icon);
    this.tweens.add({
      targets: icon,
      y: -21,
      duration: 500,
      ease: 'Back.easeOut',
      onComplete: () => this.tweens.add({ targets: icon, alpha: 0, delay: 800, duration: 300, onComplete: () => icon.destroy() }),
    });
  }

  // ---------- Продавец: уборка и выкладка ----------

  /** Продавец уходит от кассы по шагам и возвращается. Пока его нет, касса пустует. */
  private async doChore(steps: ChoreStep[]): Promise<void> {
    if (this.sellerBusy || this.ownerScanning()) return;
    const id = ++this.choreId;
    this.sellerBusy = true;
    haptic.tap();
    for (const step of steps) {
      await this.walk(this.seller, step.x, step.y, SELLER_SPEED);
      if (id !== this.choreId) return;
      if (step.ms) await this.wait(step.ms);
      if (id !== this.choreId) return;
      step.action?.();
    }
    await this.returnSeller();
  }

  /** Продавца позвали к кассе: бросает дело на полпути и идёт обратно. Несённый товар остаётся на складе. */
  private recallSeller(): void {
    if (!this.sellerBusy) return;
    this.choreId++;
    this.tweens.killTweensOf(this.carried);
    this.carried.setVisible(false).setTexture('box').setPosition(0, 3);
    // Несли мусор — роняем обратно; несли мешок — он «возвращается» в ведро.
    if (this.carryingTrash) this.dropTrash(this.seller.x, this.seller.y - 6);
    this.carryingTrash = false;
    if (this.binBy === 'seller') {
      this.binFill = Math.min(binCapacity(this.state), this.binFill + this.bagCarried);
      this.bagCarried = 0;
      this.binBusy = false;
      this.binBy = null;
      this.refreshBin();
    }
    haptic.tap();
    void this.returnSeller();
  }

  private async returnSeller(): Promise<void> {
    const id = this.choreId;
    const home = this.ownerHome();
    // С улицы — через дверь, а не сквозь стену.
    if (this.seller.y > this.layout.h - 2) {
      await this.walk(this.seller, this.layout.door.x, this.layout.h + FACADE_H + 6, SELLER_SPEED);
      await this.walk(this.seller, this.layout.door.x, this.layout.door.y - 8, SELLER_SPEED);
      if (id !== this.choreId) return;
    }
    if (!this.ownerFree()) await this.walk(this.seller, home.x, home.y, SELLER_SPEED);
    if (id === this.choreId) this.sellerBusy = false;
  }

  /** Где стоит хозяин (игрок): за кассой, а если нанят кассир — рядом с ним. */
  private ownerHome(): { x: number; y: number } {
    const { sellerHome } = this.layout;
    // Хозяин встаёт за первую кассу, где нет кассира; все заняты — рядом с основной.
    const free = this.registers.find((_, i) => !staffOf(this.state, CASHIER_ROLES[i]));
    if (free) return free.clerk;
    return { x: sellerHome.x, y: sellerHome.y - 24 };
  }

  private callSellerIfNeeded(): void {
    const r = this.ownerRegister();
    const front = r?.customer;
    if (!r || !front || !this.atSpot(r)) return;
    // Зовём, если хозяин занят делом или стоит не у этой кассы.
    if (!this.sellerBusy && Phaser.Math.Distance.Between(this.seller.x, this.seller.y, r.clerk.x, r.clerk.y) <= 2) return;
    if (this.time.now - this.lastCall < CALL_EVERY_MS) return;
    this.lastCall = this.time.now;
    this.popup(front.sprite.x, front.sprite.y - 22, t('popup.callRegister'), '#fff3b0');
  }

  /** Касание полки: продавец идёт на склад, берёт коробку подходящего товара и раскладывает. */
  private restockShelf(index: number): void {
    if (!this.running || this.sellerBusy) return;
    const shelf = this.state.shelves[index];
    const slot = this.layout.slots[index];
    if (shelf.broken) {
      this.popup(slot.x, slot.y - 18, t('popup.broken'), '#ffd0d0');
      return;
    }
    if (shelfFree(shelf) === 0) {
      this.popup(slot.x, slot.y - 18, t('popup.shelfFull'), '#fff3b0');
      return;
    }
    const available = PRODUCT_IDS.some((id) => canPlace(id, shelf) && (this.state.warehouse[id] ?? []).some((u) => !u.pending));
    if (!available) {
      this.popup(slot.x, slot.y - 18, t('popup.warehouseEmpty'), '#ffd0d0');
      return;
    }
    // Одно касание — полка заполняется целиком: продавец ходит на склад, пока есть место и товар.
    const stock = PRODUCT_IDS.reduce((sum, id) => sum + (canPlace(id, shelf) ? (this.state.warehouse[id] ?? []).filter((u) => !u.pending).length : 0), 0);
    const trips = Math.max(1, Math.ceil(Math.min(shelfFree(shelf), stock) / (carryOf(this.state) + carryBonus(this.state))));
    const { doorway, pickup } = this.layout.warehouse;
    const trip: ChoreStep[] = [
      { ...doorway },
      { ...pickup, ms: PICKUP_MS, action: () => this.carried.setTexture('box').setPosition(0, 3).setVisible(true) },
      { ...doorway },
      {
        x: slot.x,
        y: slot.y + 20,
        ms: PLACE_MS,
        action: () => {
          this.carried.setVisible(false);
          this.stockShelf(index, this.seller);
        },
      },
    ];
    void this.doChore(Array.from({ length: Math.min(trips, MAX_RESTOCK_TRIPS) }, () => trip).flat());
  }

  /** Товар из коробки на полку: штуки вылетают по одной и встают на место с «чпок». */
  private stockShelf(index: number, by: Phaser.GameObjects.Container): void {
    const view = this.shelfViews[index];
    const before = view ? view.items.filter((img) => img.visible).length : 0;
    // Хозяин-силач носит больше (навык «Силач»), сотрудники — как обычно.
    this.state = moveToShelf(this.state, index, undefined, carryOf(this.state) + (by === this.seller ? carryBonus(this.state) : 0)).state;
    this.refreshShelves();
    this.refreshWarehouse();
    const items = this.shelfViews[index]?.items ?? [];
    const backs = this.shelfViews[index]?.backItems ?? [];
    const fresh = items.filter((img, n) => img.visible && n >= before);
    // Задний ряд проявляется, когда штука долетела до полки.
    backs.forEach((back, n) => n >= before && back.visible && back.setAlpha(0));
    this.time.delayedCall(fresh.length * 90 + 300, () => backs.forEach((back) => back.active && back.alpha < 1 && this.tweens.add({ targets: back, alpha: 1, duration: 200 })));
    fresh.forEach((img, n) => {
      const { x, y } = img;
      const scale = img.scaleX;
      const from = { x: by.x, y: by.y - 4 };
      img.setPosition(from.x, from.y).setScale(scale * 0.6).setAlpha(0);
      // Летит дугой вверх из рук на своё место и подпрыгивает.
      this.tweens.addCounter({
        from: 0,
        to: 1,
        delay: n * 90,
        duration: 280,
        onStart: () => {
          img.setAlpha(1);
          if (n % 2 === 0) sound.pop(n);
        },
        onUpdate: (tween) => {
          const k = tween.getValue() ?? 0;
          img.setPosition(from.x + (x - from.x) * k, from.y + (y - from.y) * k - Math.sin(k * Math.PI) * 10);
          img.setScale(scale * (0.6 + 0.4 * k));
        },
        onComplete: () => {
          img.setPosition(x, y);
          this.tweens.add({ targets: img, scale: { from: scale * 1.35, to: scale }, duration: 140, ease: 'Back.easeOut' });
        },
      });
    });
  }

  private cleanToilet(): void {
    if (this.toiletDirt === 0) return;
    void this.doChore([
      {
        x: this.layout.wc.x,
        y: this.layout.wc.spotY,
        ms: TOILET_CLEAN_MS,
        action: () => {
          this.toiletDirt = 0;
          this.refreshToilet();
          this.bubbles(this.layout.wc.x, this.layout.wc.y);
        },
      },
    ]);
  }

  /**
   * Мусор на полу. trash — фантики и стаканчики: подобрать и отнести в ведро;
   * mud — грязные следы с улицы и spill — пролитое: их моют шваброй, это дольше.
   */
  private dropTrash(x: number, y: number, kind: TrashKind = 'trash'): Phaser.GameObjects.Image | undefined {
    if (this.trash.size >= MAX_TRASH) return undefined;
    const key = kind === 'trash' ? Phaser.Utils.Array.GetRandom(['trash', 'trash', 'trash_banana', 'trash_cup']) : kind;
    const area =
      kind === 'mud' ? new Phaser.Geom.Rectangle(-2, -2, 30, 26) : kind === 'spill' ? new Phaser.Geom.Rectangle(-2, -4, 32, 20) : new Phaser.Geom.Rectangle(-5, -5, 16, 15);
    const piece = this
      .art(x + Phaser.Math.Between(-6, 6), y + Phaser.Math.Between(4, 8), key)
      .setDepth(kind === 'trash' ? 1 : 0.5)
      .setInteractive(area, Phaser.Geom.Rectangle.Contains);
    piece.setData('kind', kind);
    piece.setData('glow', piece.preFX?.addGlow(0xffffff, 1, 0, false, 0.1, 6));
    piece.on('pointerup', () => {
      if (this.dragged || this.claimedTrash.has(piece) || this.sellerBusy || this.ownerScanning()) return;
      if (kind === 'trash' && this.binFull()) {
        // Ведро полное — сначала вынести.
        this.popup(this.binSpot().x, this.binSpot().y - 18, t('popup.binFull'), '#ffd0d0');
        sound.bad();
        return;
      }
      this.claimedTrash.add(piece);
      if (kind === 'trash') {
        const stand = this.binStand();
        void this.doChore([
          {
            x: piece.x + 6,
            y: piece.y,
            ms: TRASH_CLEAN_MS,
            action: () => {
              this.carried.setTexture(piece.texture.key).setPosition(5, 0).setVisible(true);
              this.carryingTrash = true;
              this.removeTrash(piece);
            },
          },
          {
            ...stand,
            ms: BIN_DROP_MS,
            action: () => {
              this.carryingTrash = false;
              this.carried.setVisible(false).setTexture('box').setPosition(0, 3);
              this.putInBin();
            },
          },
        ]);
        return;
      }
      // Продавец берёт швабру и трёт пол туда-сюда.
      this.carried.setTexture('mop').setPosition(5, -1).setVisible(true);
      let scrub: Phaser.Tweens.Tween | undefined;
      void this.doChore([
        { x: piece.x + 7, y: piece.y, action: () => (scrub = this.tweens.add({ targets: this.carried, x: 1, duration: 160, yoyo: true, repeat: -1 })) },
        {
          x: piece.x + 7,
          y: piece.y,
          ms: kind === 'spill' ? SPILL_MOP_MS : MOP_MS,
          action: () => {
            scrub?.remove();
            this.carried.setVisible(false).setTexture('box').setPosition(0, 3);
            this.removeTrash(piece);
          },
        },
      ]);
    });
    this.trash.add(piece);
    return piece;
  }

  /** Покупатель уронил покупку: лужа и опрокинутый пакет. По луже скользко. */
  private spill(x: number, y: number): void {
    const piece = this.dropTrash(x, y, 'spill');
    if (!piece) return;
    piece.setTint(Phaser.Utils.Array.GetRandom(SPILL_TINTS));
    const pack = this.art(piece.x + 9, piece.y - 3, 'spill_pack').setAngle(70).setDepth(0.6);
    piece.once('destroy', () => pack.destroy());
    sound.bad();
    this.popup(x, y - 16, t('popup.spill'), '#ffd0d0');
  }

  /** Протёк холодильник: лужа перед ним (её моют, как пролитое). */
  private fridgeLeaks(): void {
    const fridges = this.state.shelves.map((s, i) => ({ s, i })).filter(({ s }) => SHELF_KINDS[s.kind].fridge);
    if (!fridges.length) return;
    const slot = this.layout.slots[Phaser.Utils.Array.GetRandom(fridges).i];
    const piece = this.dropTrash(slot.x + Phaser.Math.Between(-8, 8), slot.y + 24, 'spill');
    if (!piece) return;
    piece.setTint(0xc8f0ff);
    sound.bad();
    this.popup(slot.x, slot.y + 8, t('popup.leak'), '#ffd0d0');
  }

  /** Наступил в лужу — чуть не упал: настроение испорчено. */
  private checkSlips(): void {
    const spills = [...this.trash].filter((piece) => piece.getData('kind') === 'spill');
    if (!spills.length) return;
    for (const c of this.customers) {
      if (c.slipped || c.gone || c.thief) continue;
      const feetY = c.sprite.y + 8;
      if (!spills.some((sp) => Math.abs(sp.x - c.sprite.x) < 7 && Math.abs(sp.y - feetY) < 4)) continue;
      c.slipped = true;
      c.unhappy = true;
      note(this.stats, 'slip');
      this.tweens.add({ targets: c.sprite, angle: { from: -14, to: 12 }, duration: 110, yoyo: true, repeat: 1, onComplete: () => c.sprite.setAngle(0) });
      this.emote(c.sprite, 'emo_angry');
      this.popup(c.sprite.x, c.sprite.y - 18, t('popup.slip'), '#ffd0d0');
    }
  }

  private removeTrash(piece: Phaser.GameObjects.Image): void {
    if (this.trash.has(piece)) this.stats.trashCleaned++;
    this.trash.delete(piece);
    this.claimedTrash.delete(piece);
    if (piece.getData('kind') === 'trash') this.puff(piece.x, piece.y);
    else this.bubbles(piece.x, piece.y);
    piece.destroy();
  }

  // ---------- Сотрудники ----------

  /** Расставляет нанятых сотрудников по местам и запускает их работу. */
  private syncStaff(): void {
    const gen = ++this.staffGen;
    for (const w of this.workers.values()) {
      this.tweens.killTweensOf(w.sprite);
      w.sprite.destroy();
    }
    this.workers.clear();
    this.claimedTrash.clear();
    if (this.binBy === 'cleaner') {
      this.binFill = Math.min(binCapacity(this.state), this.binFill + this.bagCarried);
      this.bagCarried = 0;
      this.binBusy = false;
      this.binBy = null;
      this.refreshBin();
    }
    // Кассир не вышел, а менеджер на месте — менеджер встаёт за его кассу.
    const manager = this.state.staff.find((m) => m.role === 'manager' && !isAbsent(this.state, m));
    const cover = manager
      ? CASHIER_ROLES.slice(0, this.registers.length).find((role) => {
          const m = staffOf(this.state, role);
          return m && isAbsent(this.state, m);
        })
      : undefined;
    for (const member of this.state.staff) {
      if (isAbsent(this.state, member)) continue;
      const covering = member.role === 'manager' && cover ? cover : undefined;
      const home = covering ? this.workerHome(covering) : this.workerHome(member.role);
      const sprite = this.makePerson(home.x, home.y, {
        ...randomLook(UNIFORMS[member.role]),
        style: STAFF_HAIR[member.role],
        acc: STAFF_ACC[member.role].acc,
        accTint: STAFF_ACC[member.role].tint,
        // У охранника форменная кепка, у пекаря — белый колпак.
        hair: member.role === 'guard' ? UNIFORMS.guard : member.role === 'baker' ? 0xffffff : Phaser.Utils.Array.GetRandom(HAIR_COLORS),
      });
      const carried = this.art(0, 3, 'box').setVisible(false);
      sprite.add(carried);
      const worker: Worker = { member, sprite, carried, home };
      this.workers.set(member.role, worker);
      if (covering) {
        this.workers.set(covering, worker);
        void this.cashierLoop(worker, gen, registerOfRole(covering));
        continue;
      }
      const loop = {
        cashier: this.cashierLoop,
        cashier2: this.cashierLoop,
        cashier3: this.cashierLoop,
        cashier4: this.cashierLoop,
        cleaner: this.cleanerLoop,
        loader: this.loaderLoop,
        guard: null,
        manager: this.managerLoop,
        baker: this.bakerLoop,
        barista: this.baristaLoop,
      }[member.role];
      if (loop) void loop.call(this, worker, gen);
    }
    // Хозяин уступает место кассиру.
    const home = this.ownerHome();
    if (!this.sellerBusy) this.seller.setPosition(home.x, home.y).setDepth(home.y);
  }

  private workerHome(role: StaffRole): { x: number; y: number } {
    const { sellerHome, wc, warehouse, door } = this.layout;
    switch (role) {
      case 'cashier':
      case 'cashier2':
      case 'cashier3':
      case 'cashier4':
        return this.registers[registerOfRole(role)]?.clerk ?? { x: sellerHome.x, y: sellerHome.y - 24 };
      case 'cleaner':
        return { x: wc.x - 18, y: wc.spotY + 8 };
      case 'loader':
        return { x: warehouse.doorway.x + 6, y: warehouse.doorway.y - 18 };
      case 'guard':
        return { x: door.x + 22, y: door.y - 14 };
      case 'manager':
        // Менеджер ходит у входа, где проход свободен.
        return { x: door.x - 24, y: door.y - 30 };
      case 'baker':
        return { x: this.layout.bakery.x + 26, y: this.layout.bakery.y + 36 };
      case 'barista':
        return { x: this.layout.coffee.x + 26, y: this.layout.coffee.y + 19 };
    }
  }

  private alive(gen: number): boolean {
    return gen === this.staffGen && this.scene.isActive();
  }

  /** Шаг сотрудника с учётом его скорости. */
  private workerWalk(w: Worker, x: number, y: number): Promise<void> {
    return this.walk(w.sprite, x, y, STAFF_SPEED * this.workerPace(w));
  }

  private workerWait(w: Worker, ms: number): Promise<void> {
    return this.wait(ms / this.workerPace(w));
  }

  /** Скорость сотрудника: его навык, менеджер на смене, а у грузчика — ещё и оборудование склада. */
  private workerPace(w: Worker): number {
    return workSpeed(w.member) * managerBoost(this.state) * (w.member.role === 'loader' ? warehouseSpeed(this.state) : 1);
  }

  /**
   * Менеджер обходит зал: заглядывает к полкам, а когда товар кончился и на полке, и на складе —
   * сам звонит и заказывает срочный подвоз (если хватает денег).
   */
  private async managerLoop(w: Worker, gen: number): Promise<void> {
    while (this.alive(gen)) {
      if (!this.running) {
        await this.wait(400);
        continue;
      }
      const pick = managerPick(this.state);
      if (pick && !this.urgentOrders.some((o) => o.id === pick)) {
        const qty = URGENT_QTYS[0];
        if (this.orderUrgentDelivery(pick, qty)) this.popup(w.sprite.x, w.sprite.y - 20, t('popup.managerOrder', { icon: PRODUCTS[pick].icon }), '#fff3b0');
      }
      const slot = Phaser.Utils.Array.GetRandom(this.layout.slots.slice(0, Math.max(1, this.state.shelves.length)));
      if (slot) await this.workerWalk(w, slot.x + Phaser.Math.Between(-12, 12), slot.y + 22);
      await this.workerWait(w, 2500);
    }
  }

  // ---------- Срочный подвоз ----------

  /** Сколько штук срочного заказа сейчас едет. */
  private urgentOnTheWay(): number {
    return this.urgentOrders.reduce((sum, o) => sum + o.qty, 0);
  }

  /** Оплатить срочный заказ и отправить фургон. false — нет денег, места или товара. */
  private orderUrgentDelivery(id: ProductId, qty: number): boolean {
    const next = orderUrgent(this.state, id, qty, this.urgentOnTheWay());
    if (!next) return false;
    this.state = next;
    this.urgentOrders.push({ id, qty });
    this.hud.update(this.state, this.timeLeft);
    if (!this.urgentVanBusy) void this.urgentVan();
    return true;
  }

  /** Фургон срочного подвоза: подъезжает к складу, товар — на стеллаж, уезжает. */
  private async urgentVan(): Promise<void> {
    this.urgentVanBusy = true;
    const { warehouse } = this.layout;
    const vanX = warehouse.x + warehouse.w / 2 + 14;
    const roadY = this.streetY + 24;
    const van = this.add.container(-260, roadY, [this.art(0, 0, 'car_van').setTint(0xffd27a), this.art(0, 0, 'car_van_lights')]).setDepth(roadY);
    ambience.carPass();
    await this.wait((URGENT_SECONDS * 1000) / Math.max(1, this.speed) - 1800);
    await new Promise<void>((done) => this.tweens.add({ targets: van, x: vanX, duration: 1800, ease: 'Sine.easeOut', onComplete: () => done(), onStop: () => done() }));
    this.receiveUrgentOrders();
    if (van.active) this.tweens.add({ targets: van, x: this.next.w + 300, delay: 600, duration: 2400, ease: 'Sine.easeIn', onComplete: () => van.destroy() });
    this.urgentVanBusy = false;
    if (this.urgentOrders.length) void this.urgentVan();
  }

  /** Всё, что едет, — на склад (и в конце дня, если фургон не успел). */
  private receiveUrgentOrders(): void {
    if (!this.urgentOrders.length) return;
    const list = this.urgentOrders.map((o) => `${PRODUCTS[o.id].icon}×${o.qty}`).join(' ');
    for (const o of this.urgentOrders) this.state = receiveUrgent(this.state, o.id, o.qty);
    this.urgentOrders = [];
    this.refreshWarehouse();
    this.refreshShelves();
    sound.pop(0);
    const { warehouse } = this.layout;
    this.popup(warehouse.x + warehouse.w / 2, warehouse.y - 4, t('popup.urgent', { list }), '#fff3b0');
  }

  private openUrgent(): void {
    if (!this.running || this.night) return;
    showUrgent({
      getState: () => this.state,
      onTheWay: () => this.urgentOnTheWay(),
      onTheWayList: () => this.urgentOrders.map((o) => `${PRODUCTS[o.id].icon}×${o.qty}`).join(' '),
      order: (id, qty) => {
        if (this.orderUrgentDelivery(id, qty)) sound.coin();
      },
    });
  }

  /** Кассир сам пробивает тех, кто подошёл к его кассе (второй кассир — ко второй). */
  private async cashierLoop(w: Worker, gen: number, index = registerOfRole(w.member.role)): Promise<void> {
    while (this.alive(gen)) {
      const r = this.registers[index];
      const front = r?.customer;
      if (!this.running || !r || !front || !this.atSpot(r)) {
        await this.wait(200);
        continue;
      }
      if (front.serving || r.scan) {
        await this.wait(100);
        continue;
      }
      await this.scanCustomer(r, front, withUpgrades(this.state, cashierScan(w.member)), false);
    }
  }

  /** Уборщик подбирает мусор, а когда его нет — моет туалет. */
  private async cleanerLoop(w: Worker, gen: number): Promise<void> {
    while (this.alive(gen)) {
      // Ведро почти полное — сначала вынести.
      if (this.running && this.binFill >= binCapacity(this.state) - 1 && !this.binBusy) {
        this.binBusy = true;
        this.binBy = 'cleaner';
        for (const step of this.takeOutSteps(
          () => {
            this.bagFromBin();
            w.carried.setTexture('trash_bag').setVisible(true);
          },
          () => {
            w.carried.setVisible(false).setTexture('box');
            this.bagToDumpster();
          },
        )) {
          await this.workerWalk(w, step.x, step.y);
          if (!this.alive(gen)) return;
          if (step.ms) await this.workerWait(w, step.ms);
          step.action?.();
        }
        continue;
      }
      const piece = this.running ? this.nearestTrash(w.sprite.x, w.sprite.y) : undefined;
      if (piece) {
        const kind = piece.getData('kind') as TrashKind;
        if (kind === 'trash' && this.binFull()) {
          await this.wait(300);
          continue;
        }
        this.claimedTrash.add(piece);
        await this.workerWalk(w, piece.x + 6, piece.y);
        if (!this.alive(gen)) return;
        await this.workerWait(w, kind === 'trash' ? TRASH_CLEAN_MS : kind === 'spill' ? SPILL_MOP_MS : MOP_MS);
        if (!piece.active) continue;
        if (kind !== 'trash') {
          this.removeTrash(piece);
          continue;
        }
        w.carried.setTexture(piece.texture.key).setVisible(true);
        this.removeTrash(piece);
        const stand = this.binStand();
        await this.workerWalk(w, stand.x, stand.y);
        if (!this.alive(gen)) return;
        await this.workerWait(w, BIN_DROP_MS);
        w.carried.setVisible(false).setTexture('box');
        this.putInBin();
        continue;
      }
      if (this.running && this.toiletDirt >= 40) {
        await this.workerWalk(w, this.layout.wc.x, this.layout.wc.spotY);
        if (!this.alive(gen)) return;
        await this.workerWait(w, TOILET_CLEAN_MS);
        this.toiletDirt = 0;
        this.refreshToilet();
        this.bubbles(this.layout.wc.x, this.layout.wc.y);
        continue;
      }
      if (Phaser.Math.Distance.Between(w.sprite.x, w.sprite.y, w.home.x, w.home.y) > 2) await this.workerWalk(w, w.home.x, w.home.y);
      await this.wait(300);
    }
  }

  private nearestTrash(x: number, y: number): Phaser.GameObjects.Image | undefined {
    let best: Phaser.GameObjects.Image | undefined;
    let bestDist = Infinity;
    for (const piece of this.trash) {
      if (this.claimedTrash.has(piece)) continue;
      const d = Phaser.Math.Distance.Between(x, y, piece.x, piece.y);
      if (d < bestDist) [best, bestDist] = [piece, d];
    }
    return best;
  }

  /** Грузчик носит товар со склада на полки, где он кончается. */
  private async loaderLoop(w: Worker, gen: number): Promise<void> {
    while (this.alive(gen)) {
      const index = this.running ? this.shelfToRestock() : -1;
      if (index < 0) {
        if (Phaser.Math.Distance.Between(w.sprite.x, w.sprite.y, w.home.x, w.home.y) > 2) await this.workerWalk(w, w.home.x, w.home.y);
        await this.wait(400);
        continue;
      }
      const { doorway, pickup } = this.layout.warehouse;
      const slot = this.layout.slots[index];
      await this.workerWalk(w, doorway.x, doorway.y);
      await this.workerWalk(w, pickup.x, pickup.y);
      await this.workerWait(w, PICKUP_MS);
      if (!this.alive(gen)) return;
      w.carried.setVisible(true);
      await this.workerWalk(w, doorway.x, doorway.y);
      await this.workerWalk(w, slot.x, slot.y + 20);
      await this.workerWait(w, PLACE_MS);
      if (!this.alive(gen)) return;
      w.carried.setVisible(false);
      this.stockShelf(index, w.sprite);
    }
  }

  /** Полка, которую стоит пополнить: место есть, а на складе есть подходящий товар. */
  /** Сначала полки со звёздочкой, потом те, где товар кончился, потом самые пустые. */
  private shelfToRestock(): number {
    let best = -1;
    let bestScore = 0;
    this.state.shelves.forEach((shelf, i) => {
      if (shelf.broken) return;
      const free = shelfFree(shelf);
      const hasGoods = PRODUCT_IDS.some((id) => canPlace(id, shelf) && (this.state.warehouse[id] ?? []).some((u) => !u.pending));
      const runningOut = PRODUCT_IDS.some(
        (id) => canPlace(id, shelf) && (shelf.items[id]?.length ?? 0) === 0 && (this.state.warehouse[id]?.length ?? 0) > 0,
      );
      if (!hasGoods || !(free >= 3 || (runningOut && free > 0))) return;
      const score = (shelf.priority ? 1000 : 0) + (runningOut ? 100 : 0) + free;
      if (score > bestScore) [best, bestScore] = [i, score];
    });
    return best;
  }

  // ---------- Проверка ----------

  /** Инспектор обходит полки, туалет и кассу, потом выносит решение. */
  private async runInspector(): Promise<void> {
    this.inspector = 'here';
    const { door, wc, sellerHome, slots } = this.layout;
    const start = this.streetSpawn();
    const sprite = this.makePerson(start.x, start.y, { shirt: INSPECTOR_SHIRT, skin: SKINS[0], pants: INSPECTOR_SHIRT, hair: 0x181425, style: 'short' });
    const look = (x: number, y: number) => this.walk(sprite, x, y, 35).then(() => this.wait(700));
    this.popup(door.x, door.y - 24, t('popup.inspector'), '#fff3b0');
    haptic.tap();
    sound.bell();
    await this.walk(sprite, door.x, this.streetY, 35);
    await this.walk(sprite, door.x, door.y - 10, 35);
    for (const i of this.state.shelves.map((_, i) => i)) await look(slots[i].x, slots[i].y + 22);
    await look(wc.x - 6, wc.spotY + 4);
    await look(sellerHome.x - 30, sellerHome.y - 10);
    if (!this.sys.isActive()) return;

    // Переполненное ведро инспектор считает как две кучки мусора.
    const result = inspect(this.state, { trash: this.trash.size + (this.binFull() ? 2 : 0), toiletDirt: this.toiletDirt });
    this.inspection = result;
    this.state = inspectionDone(this.state, result);
    if (result.passed) {
      haptic.success();
      sound.good();
      this.popup(sprite.x, sprite.y - 16, t('popup.inspectionPassed'), '#c8ffb0');
    } else {
      haptic.error();
      sound.bad();
      this.popup(sprite.x, sprite.y - 16, t('popup.inspectionFailed', { n: result.fine }), '#ffd0d0');
    }
    await this.walk(sprite, door.x, this.layout.h + 16, 35);
    void this.strollAway(sprite);
    this.inspector = 'done';
  }

  // ---------- Покупатели ----------

  private spawnCustomer(): void {
    const thief = Math.random() < thiefChance(this.state.level) * cameraTheft(this.state) * eyeTheft(this.state);
    const valya = !thief && !this.night && !this.valyaCame && this.state.day > 1 && Math.random() < 0.15;
    const shirt = thief ? THIEF_SHIRT : valya ? VALYA.shirt : Phaser.Utils.Array.GetRandom(SHIRTS);
    // Блогер сегодня снимает обзор — редкие гости заходят вдвое чаще.
    const rareChance = rareGuestChance(this.state.level) * (activeAd(this.state)?.id === 'blogger' ? 2 : 1);
    const rare = !thief && !valya && !this.night && Math.random() < rareChance ? pickRareGuest(this.state, Math.random) : null;
    const look: Look = rare
      ? rare.look
      : valya
        ? VALYA
        : thief
          ? { ...randomLook(shirt), style: 'long' as const, hair: THIEF_SHIRT }
          : this.night
            ? nightLook()
            : withCompanionItems(customerLook(shirt));
    const start = this.streetSpawn();
    const sprite = this.makePerson(start.x, start.y, look);
    this.addUmbrella(sprite);
    // Иногда приходят парой.
    if (!thief && !rare && !valya && look.stroller === undefined && Math.random() < 0.08) this.addCompanion(sprite);
    if (rare) {
      sound.bell();
      // Редкий гость сверкает, пока он в магазине.
      const sparkles = this.add.particles(0, 0, 'spark', {
        lifespan: 700,
        speed: { min: 4, max: 14 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 1, end: 0 },
        frequency: 160,
        x: { min: -7, max: 7 },
        y: { min: -16, max: 4 },
      });
      sparkles.startFollow(sprite).setDepth(LIGHT_DEPTH - 1);
      sprite.once('destroy', () => sparkles.destroy());
      this.time.delayedCall(1500, () => this.popup(sprite.x, sprite.y - 16, t('popup.rareGuest', { name: `${rare.icon} ${t(rare.nameKey)}` }), '#fee761'));
    }
    if (valya) {
      this.valyaCame = true;
      this.time.delayedCall(1500, () => this.popup(sprite.x, sprite.y - 16, t('popup.valya'), '#fff3b0'));
    }
    const bubble = this.art(0, -14, 'bubble').setVisible(false);
    sprite.add(bubble);
    const customer: Customer = { sprite, bubble, items: [], unhappy: false, waitStart: 0, gone: false, thief, rare: rare?.id };
    // Вора без охранника видно по красному контуру — его можно поймать касанием. Редкий гость — в золотом.
    if (thief && !this.workers.has('guard')) sprite.postFX?.addGlow(0xe43b44, 3, 0, false, 0.1, 6);
    if (rare) sprite.postFX?.addGlow(0xfee761, 3, 0, false, 0.1, 6);
    this.customers.add(customer);
    if (thief) {
      // Вора можно поймать касанием.
      sprite.setSize(16, 22).setInteractive({ useHandCursor: true }).on('pointerup', () => this.tap(() => this.catchThief(customer, false)));
      void this.runThief(customer);
    } else {
      void this.runCustomer(customer);
    }
  }

  // ---------- Воры ----------

  private async runThief(c: Customer): Promise<void> {
    const { door } = this.layout;
    await this.walk(c.sprite, door.x, this.streetY);
    await this.walk(c.sprite, door.x, door.y - 10);
    // С тележкой у входа покупатель иногда берёт что-то сверх списка.
    const wanted = this.wanted(Phaser.Math.Between(1, 2) + cartExtra(this.state, Math.random) + radioExtra(this.state, Math.random));
    for (const id of wanted) {
      const index = shelfFor(this.state, id);
      if (index < 0 || c.gone) continue;
      const slot = this.layout.slots[index];
      await this.walk(c.sprite, slot.x + Phaser.Math.Between(-8, 8), slot.y + 22);
      if (c.gone) return;
      await this.wait(400);
      const taken = takeFromShelf(this.state, index, id);
      if (taken && !c.gone) {
        this.state = taken.state;
        c.items.push({ id, unit: taken.unit });
        this.refreshShelves();
      }
    }
    if (c.gone) return;
    // Мимо кассы — сразу к выходу.
    await this.walk(c.sprite, door.x, door.y - 10, THIEF_SPEED);
    if (c.gone) return;
    const guard = this.workers.get('guard');
    if (guard && c.items.length && Math.random() < guardCatchChance(guard.member)) {
      void this.walk(guard.sprite, c.sprite.x + 10, c.sprite.y, STAFF_SPEED * 1.5).then(() =>
        this.walk(guard.sprite, guard.home.x, guard.home.y, STAFF_SPEED),
      );
      this.catchThief(c, true);
      return;
    }
    if (c.items.length) {
      const value = c.items.reduce((sum, { id, unit }) => sum + unitSalePrice(this.state, id, unit), 0);
      this.stats.stolen += value;
      note(this.stats, 'thief');
      haptic.error();
      sound.bad();
      this.popup(c.sprite.x, c.sprite.y - 14, `${t('popup.stolen')} −${value} 💰`, '#ffd0d0');
    }
    await this.leave(c);
  }

  /** Вора поймали: товар возвращается на полки, вор уходит ни с чем. */
  private catchThief(c: Customer, byGuard: boolean): void {
    if (c.gone || !this.running) return;
    c.sprite.disableInteractive();
    this.state = returnToShelf(this.state, c.items);
    c.items = [];
    this.refreshShelves();
    this.refreshWarehouse();
    this.stats.caught++;
    haptic.success();
    sound.good();
    this.popup(c.sprite.x, c.sprite.y - 14, byGuard ? t('popup.guardCaught') : t('popup.thiefCaught'), '#c8ffb0');
    void this.leave(c);
  }

  private async runCustomer(c: Customer): Promise<void> {
    await this.walk(c.sprite, this.layout.door.x, this.streetY);
    await this.walk(c.sprite, this.layout.door.x, this.layout.door.y - 10);
    // В дождь и снег с улицы несут грязь.
    const muddy = isWet(this.weather) || this.weather === 'snow';
    const mud = [...this.trash].filter((piece) => piece.texture.key === 'mud').length;
    if (muddy && mud < MAX_MUD && Math.random() < MUD_CHANCE * entranceMud(this.state)) this.dropTrash(this.layout.door.x, this.layout.door.y - 30, 'mud');

    const wanted = c.wants ?? this.wanted(Phaser.Math.Between(1, 2) + cartExtra(this.state, Math.random) + radioExtra(this.state, Math.random));
    if (c.regular) this.popup(c.sprite.x, c.sprite.y - 20, t('regular.hello', { name: t(regularById(c.regular).nameKey) }), '#fff3b0');
    let disappointed = false;
    let why: { reason: LostReason; id: ProductId } | undefined;
    for (const id of wanted) {
      const index = shelfFor(this.state, id);
      if (index < 0) continue;
      const slot = this.layout.slots[index];
      // Над головой облачко: что покупатель ищет.
      const thought = this.think(c.sprite, id);
      await this.walk(c.sprite, slot.x + Phaser.Math.Between(-8, 8), slot.y + 22);
      await this.wait(500);
      const result = this.tryTake(c, id);
      this.reachShelf(c, slot, result === 'taken' ? id : null);
      if (result === 'taken' && Math.random() < SPILL_CHANCE) this.spill(c.sprite.x, c.sprite.y + 2);
      const failed = result === 'empty' || result === 'expensive' || result === 'eduard';
      this.endThought(thought, failed);
      if (failed) {
        disappointed = true;
        // Первая неудача — причина ухода, если покупатель так ничего и не возьмёт.
        why ??= { reason: result, id };
      }
    }

    if (Math.random() < TRASH_CHANCE) this.dropTrash(c.sprite.x, c.sprite.y);
    if (c.regular) this.regularVerdict(c);

    if (c.items.length === 0) {
      // Не нашёл товар или всё слишком дорого — ушёл недовольным, это бьёт по рейтингу.
      if (disappointed) {
        this.stats.lost++;
        if (why) noteLost(this.stats, why.reason, why.id);
      }
      await this.leave(c);
      return;
    }

    if (Math.random() < TOILET_CHANCE) await this.visitToilet(c);
    await this.buyCoffee(c);

    if (await this.useKiosk(c)) return;
    this.queue.push(c);
    this.layoutQueue();
    const spot = this.registerOf(c)?.spot ?? { x: this.layout.queue.x, y: this.queueSpotY(this.queue.indexOf(c)) };
    await this.walk(c.sprite, spot.x, spot.y);
    if (c.gone) return;
    // Заскучал в очереди — тянется к стойке со сладостями.
    if (!c.serving && Math.random() < impulseChance(this.state, this.queue.indexOf(c) + 1)) this.grabCandy(c);
    c.waitStart = this.time.now;
    c.bubble.setVisible(true);
    // С котом рядом ждут дольше.
    c.patienceMs = PATIENCE_MS * catPatience(this.state) * climatePatience(this.state, weatherFor(this.state.day)) * charmPatience(this.state) * radioPatience(this.state);
    c.patience = this.time.delayedCall(c.patienceMs, () => void this.giveUp(c));
    this.layoutQueue();
  }

  /** Корзина покупателя с учётом спроса дня: погода, ценовая война, запах хлеба. */
  private wanted(count: number): ProductId[] {
    const aroma = this.aroma();
    return pickWanted(this.state, Math.random, count, (id) => dayDemand(this.state, id, aroma));
  }

  /** В зале пахнет свежим хлебом из печи. */
  private aroma(): boolean {
    return this.time.now < this.aromaUntil;
  }

  /** Покупатель у полки: берёт товар, если он есть и цена устраивает. */
  private tryTake(c: Customer, id: ProductId): 'taken' | 'empty' | 'expensive' | 'eduard' | 'skipped' {
    const index = shelfFor(this.state, id);
    if (this.state.shelves[index]?.broken) {
      this.popup(c.sprite.x, c.sprite.y - 14, t('popup.broken'), '#ffd0d0');
      return 'empty';
    }
    const oldest = this.state.shelves[index]?.items[id]?.[0];
    if (!oldest) {
      this.popup(c.sprite.x, c.sprite.y - 14, t('popup.noStock'), '#ffd0d0');
      note(this.stats, 'noStock');
      return 'empty';
    }
    // Ценовая война: у Эдуарда дешевле — часть покупателей уходит к нему.
    if (Math.random() < warLeaves(this.state, id)) {
      this.popup(c.sprite.x, c.sprite.y - 14, t('popup.toEduard'), '#ffd0d0');
      note(this.stats, 'expensive');
      return 'eduard';
    }
    // Ночью — наценка, зато к ценам не придираются; пока пахнет свежим хлебом, за него готовы платить больше.
    const price = Math.ceil(unitSalePrice(this.state, id, oldest) * (this.night ? NIGHT_MARKUP : 1));
    const fair =
      perceivedBase(this.state, id) *
      (this.night ? NIGHT_TOLERANCE : 1) *
      (id === 'bread' && this.aroma() ? AROMA_TOLERANCE : 1) *
      fairTolerance(this.state.day) *
      loyaltyTolerance(this.state);
    // «2 по цене 1»: за штуку выходит вдвое дешевле.
    const bogo = promoKind(this.state, id) === 'bogo';
    const perUnit = bogo ? price / 2 : price;
    // Постоянный покупатель решает не по случаю, а по своей границе цены.
    const regular = c.regular ? regularById(c.regular) : undefined;
    const declines = regular?.favorite === id ? !acceptsPrice(this.state, regular, perUnit) : Math.random() >= buyChance(perUnit, fair);
    if (declines) {
      if (price <= fair) return 'skipped';
      this.popup(c.sprite.x, c.sprite.y - 14, t('popup.expensive'), '#ffd0d0');
      note(this.stats, 'expensive');
      return 'expensive';
    }
    const taken = takeFromShelf(this.state, index, id);
    if (!taken) return 'empty';
    if (id === 'bread' && this.aroma()) note(this.stats, 'fresh');
    this.state = taken.state;
    c.items.push({ id, unit: taken.unit });
    // По акции «2 по цене 1» берут вторую штуку бесплатно.
    if (bogo) {
      const second = takeFromShelf(this.state, index, id);
      if (second) {
        this.state = second.state;
        c.items.push({ id, unit: second.unit, free: true });
        this.popup(c.sprite.x, c.sprite.y - 22, t('popup.bogo'), '#fee761');
      }
    }
    this.refreshShelves();
    return 'taken';
  }

  private async visitToilet(c: Customer): Promise<void> {
    await this.walk(c.sprite, this.layout.wc.x, this.layout.wc.spotY);
    if (this.toiletDirt >= 100) {
      c.unhappy = true;
      note(this.stats, 'toilet');
      this.popup(c.sprite.x - 10, c.sprite.y - 14, t('popup.toiletAwful'), '#ffd0d0');
      return;
    }
    if (this.toiletDirt >= TOILET_DIRTY) {
      c.unhappy = true;
      note(this.stats, 'toilet');
    }
    c.sprite.setVisible(false);
    await this.wait(1200);
    c.sprite.setVisible(true);
    this.toiletDirt = Math.min(100, this.toiletDirt + TOILET_DIRT_PER_VISIT * wcDirt(this.state));
    this.refreshToilet();
  }

  /** Касание кассы: хозяин пробивает того, кто ждёт у его кассы, или возвращается с дела. */
  private async serveNext(): Promise<void> {
    if (this.ownerScanning()) return;
    const r = this.ownerRegister();
    if (this.sellerBusy) {
      if (r) this.recallSeller();
      return;
    }
    const c = r?.customer;
    if (!r || !c || c.serving || !this.atSpot(r)) return;
    haptic.tap();
    // Хозяин отошёл (кассир работает, а он остался там, где закончил дело) — сначала к кассе.
    if (Phaser.Math.Distance.Between(this.seller.x, this.seller.y, r.clerk.x, r.clerk.y) > 2) {
      const id = ++this.choreId;
      this.sellerBusy = true;
      await this.walk(this.seller, r.clerk.x, r.clerk.y, SELLER_SPEED);
      if (id !== this.choreId) return;
      this.sellerBusy = false;
      if (r.customer !== c || c.serving || c.gone) return;
    }
    void this.scanCustomer(r, c, withUpgrades(this.state, ownerTiming(this.state)), true);
  }

  /** Есть кассир — хозяину не нужно стоять у кассы: после дела он остаётся там, где закончил. */
  private ownerFree(): boolean {
    return CASHIER_ROLES.some((role) => this.workers.has(role));
  }

  /**
   * Пробивка: товары по одному уезжают по ленте, потом оплата. Время зависит от навыка
   * того, кто стоит за кассой (хозяин или кассир) и от размера корзины.
   */
  private async scanCustomer(r: Register, c: Customer, timing: ScanTiming, byOwner: boolean): Promise<void> {
    c.serving = true;
    c.patience?.remove();
    c.bubble.setVisible(false);
    // Без света касса не работает — ждём.
    while (this.blackout && this.sys.isActive()) await this.wait(250);
    r.scan = { start: this.time.now, total: checkoutSeconds(timing, c.items.length) * 1000, byOwner };
    const { counter } = r;
    for (const { id } of c.items) {
      await this.wait(timing.item * 1000);
      if (!this.sys.isActive()) return;
      const item = this.art(c.sprite.x, c.sprite.y - 2, `item_${id}`).setScale(2 / ART).setDepth(1000);
      this.tweens.add({ targets: item, x: counter.x, y: counter.y - 14, alpha: 0.2, duration: 220, onComplete: () => item.destroy() });
      haptic.tap();
      sound.scan();
    }
    // Старая касса иногда заедает: пока продавец стучит по ней, очередь ждёт.
    if (Math.random() < registerJam(this.state)) {
      r.scan.total += REGISTER_JAM_SECONDS * 1000;
      this.popup(counter.x, counter.y - 22, t('popup.jam'), '#ffd0d0');
      haptic.error();
      this.tweens.add({ targets: r.screen, alpha: 0, duration: 120, yoyo: true, repeat: 4 });
      await this.wait(REGISTER_JAM_SECONDS * 1000);
      if (!this.sys.isActive()) return;
    }
    await this.wait(timing.pay * 1000);
    r.scan = null;
    if (!this.sys.isActive()) return;
    this.finishCheckout(c);
    if (byOwner) this.ownerServedOne();
  }

  /** Редкий гость оставляет чаевые; первый раз — попадает в альбом. */
  private rareGuestServed(c: Customer, total: number): void {
    const tip = Math.round(total * RARE_TIP);
    this.state = { ...this.state, money: this.state.money + tip };
    this.stats.revenue += tip;
    const guest = RARE_GUESTS.find((g) => g.id === c.rare)!;
    const result = collectRareGuest(this.state, guest.id);
    this.state = result.state;
    const { sellerHome } = this.layout;
    const text = result.isNew
      ? t('popup.albumNew', { name: `${guest.icon} ${t(guest.nameKey)}`, tip })
      : t('popup.tip', { tip });
    this.popup(sellerHome.x - 24, sellerHome.y - 40, text, '#fee761');
    if (result.isNew) sound.fanfare();
    if (result.completed) {
      haptic.success();
      this.time.delayedCall(1200, () => this.popup(sellerHome.x - 24, sellerHome.y - 52, t('popup.albumDone', { money: ALBUM_REWARD.money }), '#fee761'));
    }
  }

  /** Хозяин обслужил покупателя: растёт навык кассы. */
  private ownerServedOne(): void {
    const before = ownerLevel(this.state.ownerServed);
    this.state = { ...this.state, ownerServed: this.state.ownerServed + 1 };
    const after = ownerLevel(this.state.ownerServed);
    if (after > before) {
      haptic.success();
      sound.good();
      const { sellerHome } = this.layout;
      this.popup(sellerHome.x - 20, sellerHome.y - 34, t('popup.skillUp', { stars: '★'.repeat(after) }), '#fee761');
    }
  }

  private updateScanBar(): void {
    for (const r of this.registers) {
      const scan = r.scan;
      r.bar.setVisible(Boolean(scan));
      r.fill.setVisible(Boolean(scan));
      if (scan) r.fill.width = 16 * Math.min(1, (this.time.now - scan.start) / scan.total);
      r.screen.setVisible(Boolean(scan));
      // У кассового аппарата нет сканера — луча нет.
      r.beam.setVisible(Boolean(scan) && gearTier(this.state, 'register') > 0);
      if (scan) {
        const blink = Math.floor(this.time.now / 140) % 2;
        r.screen.setAlpha(blink ? 0.95 : 0.45);
        r.beam.setAlpha(blink ? 0.15 : 0.6);
      }
    }
  }

  private finishCheckout(c: Customer, where?: { x: number; y: number }): void {
    this.queue = this.queue.filter((q) => q !== c);
    const at = this.registerOf(c);
    if (at) at.customer = null;

    const { state, total: goods } = checkout(this.state, c.items, this.night ? NIGHT_MARKUP : 1);
    // Шоколадка и кофе — сверху к товару.
    const extras = (c.extras ?? []).reduce((sum, e) => sum + e.price, 0);
    const total = goods + extras;
    this.state = { ...state, money: state.money + extras };
    for (const e of c.extras ?? []) note(this.stats, e.kind);
    // Чаевые «за котика».
    if (catHome(this.state) && Math.random() < catTipChance(this.state)) {
      this.state = { ...this.state, money: this.state.money + CAT_TIP };
      this.stats.revenue += CAT_TIP;
      note(this.stats, 'cat');
      this.time.delayedCall(500, () => this.popup(c.sprite.x, c.sprite.y - 30, t('popup.catTip', { n: CAT_TIP }), '#fff3b0'));
    }
    if (this.night) {
      this.stats.nightRevenue = (this.stats.nightRevenue ?? 0) + total;
      note(this.stats, 'night');
    }
    this.stats.revenue += total;
    this.stats.served++;
    recordSale(this.stats, c.items);
    if (c.rare) this.rareGuestServed(c, total);
    haptic.success();
    sound.coin();
    const base = (c.sprite.getData('baseScale') as number) ?? 1;
    this.tweens.add({ targets: c.sprite, scaleY: base * 1.12, duration: 110, yoyo: true, onComplete: () => c.sprite.setScale(base) });
    const shown = where ?? (at ? { x: at.counter.x + (at === this.registers[0] ? 8 : -8), y: at.counter.y + 0 } : { x: this.layout.sellerHome.x - 8, y: this.layout.sellerHome.y - 18 });
    this.popup(shown.x, shown.y, `+${total} 💰`, '#c8ffb0');
    this.combo = this.time.now - this.lastSaleAt < COMBO_WINDOW_MS ? this.combo + 1 : 1;
    this.lastSaleAt = this.time.now;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
    // В серии монет летит больше.
    this.flyCoins(where?.x ?? at?.counter.x ?? this.layout.counter.x, where?.y ?? at?.counter.y ?? this.layout.counter.y, Math.min(6, 2 + Math.floor(total / 40)) + Math.min(this.combo - 1, 5));
    if (this.combo >= 2) this.celebrateCombo(this.combo);

    const dirty = this.trash.size >= TRASH_COMPLAINT || this.binFull();
    const badGoods = hasUnmarkedBad(c.items) && Math.random() < BAD_COMPLAINT_CHANCE;
    if (c.unhappy || dirty || badGoods) {
      this.stats.complaints++;
      if (badGoods) note(this.stats, 'badGoods');
      else if (dirty) note(this.stats, 'dirty');
      const why = badGoods ? t('popup.badProduct') : dirty ? t('popup.dirty') : '😣';
      this.popup(c.sprite.x, c.sprite.y - 26, why, '#ffd0d0');
      this.emote(c.sprite, 'emo_angry');
    } else if (Math.random() < 0.5) {
      this.emote(c.sprite, 'emo_heart');
    }
    this.layoutQueue();
    void this.leave(c, true);
  }

  private async giveUp(c: Customer): Promise<void> {
    if (c.gone || c.serving) return;
    this.queue = this.queue.filter((q) => q !== c);
    const at = this.registerOf(c);
    if (at) at.customer = null;
    c.bubble.setVisible(false);
    this.state = returnToShelf(this.state, c.items);
    c.items = [];
    for (const extra of c.extras ?? []) if (extra.kind === 'candy') this.state = returnCandy(this.state);
    c.extras = [];
    this.refreshShelves();
    this.refreshWarehouse();
    this.stats.lost++;
    note(this.stats, 'queue');
    noteLost(this.stats, 'queue');
    this.combo = 0;
    haptic.error();
    sound.bad();
    this.popup(c.sprite.x, c.sprite.y - 14, t('popup.leftAngry'), '#ffd0d0');
    this.emote(c.sprite, 'emo_angry');
    this.layoutQueue();
    await this.leave(c);
  }

  private async leave(c: Customer, pastCounter = false): Promise<void> {
    c.gone = true;
    if (pastCounter) await this.walk(c.sprite, this.layout.queue.x, this.layout.counter.y + 40);
    await this.walk(c.sprite, this.layout.door.x, this.layout.h + 16);
    this.customers.delete(c);
    void this.strollAway(c.sprite);
  }

  /** Прохожий идёт по тротуару, машина проезжает по дороге. */
  private streetLife(): void {
    const left = -60;
    const right = this.next.w + 60;
    if (Math.random() < 0.45) {
      const fromLeft = Math.random() < 0.5;
      const y = this.streetY + Phaser.Math.Between(-5, 5);
      const person = this.makePerson(fromLeft ? left : right, y, withCompanionItems(customerLook(Phaser.Utils.Array.GetRandom(SHIRTS))));
      this.addUmbrella(person);
      if (Math.random() < 0.1) this.addCompanion(person);
      void this.walk(person, fromLeft ? right : left, y, CUSTOMER_SPEED * Phaser.Math.FloatBetween(0.7, 1.1)).then(() => person.destroy());
    }
    if (Math.random() < 0.04) this.driveBus();
    if (Math.random() < 0.3) {
      const toRight = Math.random() < 0.5;
      const y = this.streetY + (toRight ? 24 : 42);
      const total = CAR_TYPES.reduce((sum, [, , weight]) => sum + weight, 0);
      let roll = Math.random() * total;
      const [key, color] = CAR_TYPES.find(([, , weight]) => (roll -= weight) < 0) ?? CAR_TYPES[0];
      const body = this.art(0, 0, key);
      if (color !== null) body.setTint(color || Phaser.Utils.Array.GetRandom(CAR_COLORS));
      const lights = this.art(0, 0, `${key}_lights`);
      // Вечером фары светят вперёд.
      const beam = this.art(body.displayWidth / 2 + 8, 0, 'glow')
        .setScale(30 / 64, 16 / 64)
        .setTint(0xfff0b0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.8 * this.evening);
      const parts = [body, lights, beam];
      // На мокрой дороге фары отражаются бликом.
      if (isWet(this.weather)) {
        parts.push(
          this.art(body.displayWidth / 2 + 6, 7, 'glow')
            .setScale(28 / 64, 5 / 64)
            .setTint(0xfff0b0)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setAlpha(0.2 + 0.5 * this.evening),
        );
      }
      const car = this.add.container(toRight ? left : right, y, parts).setDepth(y);
      ambience.carPass();
      car.setScale(toRight ? 1 : -1, 1);
      this.tweens.add({ targets: car, x: toRight ? right : left, duration: Phaser.Math.Between(2600, 4200), onComplete: () => car.destroy() });
    }
  }

  /** Иногда по дороге едет автобус и останавливается на остановке. */
  private driveBus(): void {
    const y = this.streetY + 25;
    const body = this.art(0, 0, 'bus').setTint(Phaser.Utils.Array.GetRandom([0xfeae34, 0xe43b44, 0x63c74d]));
    const lights = this.art(0, 0, 'bus_lights');
    const bus = this.add.container(-120, y, [body, lights]).setDepth(y);
    const stopX = -70;
    this.tweens.add({
      targets: bus,
      x: stopX,
      duration: 2600,
      ease: 'Sine.easeOut',
      onComplete: () =>
        this.tweens.add({ targets: bus, x: this.next.w + 140, delay: 1800, duration: 3200, ease: 'Sine.easeIn', onComplete: () => bus.destroy() }),
    });
  }

  /** Кто из героев сюжета заглянет сегодня: бабушка, заказчик за заказом, Эдуард. */
  private scheduleStoryGuests(): void {
    const day = this.state.day;
    const at = (share: number, fn: () => Promise<void>) =>
      this.time.delayedCall(DAY_SECONDS * share * 1000, () => {
        if (this.running) void fn();
      });
    if (day > 2 && day % 6 === 2) at(0.25, () => this.runVisitor(GRANDMA, t(Phaser.Utils.Array.GetRandom(GRANDMA_LINES_KEYS))));
    const order = this.state.plan?.order;
    if (order) {
      const [look, name] = ORDER_GUESTS[order.client];
      at(0.78, () => this.runVisitor(look, t('popup.orderPickup', { name: t(name) }), true));
    }
    if (eduardLook(this.state) !== 'vacant' && day % 5 === 1) at(0.5, () => this.runEduard());
    if (this.cafeToday) at(0.08, () => this.runCafeWaiter());
    // Особый гость с выбором (бизнесмен, бабушка без денег, ребёнок с мелочью).
    const special = makeSpecial(this.state, Math.random);
    if (special) at(Phaser.Math.FloatBetween(0.2, 0.6), () => this.runSpecial(special));
    // Добрая бабушка возвращает долг.
    if (this.state.grannyOwed && Math.random() < 0.5) at(0.35, () => this.runGrannyRepay());
  }

  /**
   * Особый гость: заходит, встаёт у кассы, над ним «!». Нажми — окно выбора.
   * Не ответил за 14 секунд — гость уходит сам.
   */
  private async runSpecial(visit: SpecialVisit): Promise<void> {
    const { door, sellerHome } = this.layout;
    const looks: Record<SpecialKind, Look> = {
      business: { shirt: 0x262b44, skin: Phaser.Utils.Array.GetRandom(SKINS), pants: 0x181425, hair: 0x181425, style: 'short', acc: 'tie' },
      granny: { shirt: 0x8f563b, skin: 0xf2d3ab, pants: 0x3a4466, hair: 0xd8d8e0, style: 'bun', glasses: true },
      kid: { ...randomLook(Phaser.Utils.Array.GetRandom(HAT_COLORS)), kid: true, style: 'short', bag: 'backpack', bagTint: 0xe43b44 },
    };
    const start = this.streetSpawn();
    const sprite = this.makePerson(start.x, start.y, looks[visit.kind]);
    await this.walk(sprite, door.x, this.streetY);
    await this.walk(sprite, door.x, door.y - 10);
    await this.walk(sprite, sellerHome.x - 30, sellerHome.y - 16);
    if (!sprite.active || !this.running) {
      sprite.destroy();
      return;
    }
    this.setFacing(sprite, 'right');
    const item = PRODUCTS[visit.product];
    this.popup(sprite.x, sprite.y - 18, t(`special.${visit.kind}.hello` as TextKey), '#fff3b0');
    // «!» над головой мигает, пока не ответишь.
    const mark = this.add.text(0, -24, '!', { fontFamily: UI_FONT, fontSize: '10px', color: '#fee761', stroke: '#181425', strokeThickness: 3 }).setOrigin(0.5).setResolution(4);
    sprite.add(mark);
    const blink = this.tweens.add({ targets: mark, y: -27, duration: 400, yoyo: true, repeat: -1 });
    let answered: boolean | null = null;
    let closeChoice: (() => void) | null = null;
    const hit = this.add.zone(sprite.x, sprite.y - 6, 22, 30).setInteractive({ useHandCursor: true }).setDepth(2000);
    const decided = new Promise<void>((resolve) => {
      const finish = (yes: boolean | null) => {
        if (answered !== null) return;
        answered = yes;
        resolve();
      };
      hit.on('pointerup', () =>
        this.tap(() => {
          if (closeChoice) return;
          closeChoice = showChoice({
            title: t(`special.${visit.kind}.title` as TextKey),
            text: t(`special.${visit.kind}.text` as TextKey, { n: visit.qty, item: `${item.icon} ${t(item.nameKey)}`, pay: visit.pay, full: this.state.prices[visit.product] * visit.qty }),
            note: t(`special.${visit.kind}.note` as TextKey),
            yes: t(`special.${visit.kind}.yes` as TextKey),
            no: t(`special.${visit.kind}.no` as TextKey),
            onYes: () => finish(true),
            onNo: () => finish(false),
          });
        }),
      );
      this.time.delayedCall(14000, () => {
        closeChoice?.();
        if (answered === null) answered = false;
        resolve();
      });
    });
    await decided;
    hit.destroy();
    blink.stop();
    mark.destroy();
    if (!sprite.active) return;
    const yes = answered === true;
    const res = answerSpecial(this.state, visit, yes);
    this.state = res.state;
    this.refreshShelves();
    this.refreshWarehouse();
    this.hud.update(this.state, this.timeLeft);
    if (yes && res.money) {
      sound.coin();
      this.popup(sprite.x, sprite.y - 18, `+${res.money} 💰`, '#c8ffb0');
    }
    if (res.rating > 0) this.time.delayedCall(500, () => this.popup(sprite.x, sprite.y - 26, `★ +${res.rating}`, '#fee761'));
    if (res.rating < 0) this.time.delayedCall(500, () => this.popup(sprite.x, sprite.y - 26, `★ ${res.rating}`, '#ffd0d0'));
    this.emote(sprite, yes ? 'emo_heart' : 'emo_angry');
    if (yes && visit.kind === 'business') sprite.add(this.art(0, 3, 'box'));
    if (yes) sprite.add(this.art(5, 1, `item_${visit.product}`).setScale(1 / ART));
    await this.wait(1200);
    await this.walk(sprite, door.x, door.y - 10);
    await this.strollAway(sprite);
  }

  /** Добрая бабушка возвращается с пирожками и отдаёт долг вдвое. */
  private async runGrannyRepay(): Promise<void> {
    const owed = grannyRepays(this.state).paid;
    if (!owed) return;
    const look: Look = { shirt: 0x8f563b, skin: 0xf2d3ab, pants: 0x3a4466, hair: 0xd8d8e0, style: 'bun', glasses: true };
    // Деньги — когда бабушка дошла до кассы; не дошла (день кончился) — придёт в другой раз.
    await this.runVisitor(look, t('special.granny.repay', { n: owed }), false, () => {
      this.state = grannyRepays(this.state).state;
      sound.coin();
      this.hud.update(this.state, this.timeLeft);
    });
  }

  /** Гость заходит к кассе, говорит фразу и уходит (заказчик уносит коробку). */
  private async runVisitor(look: Look, line: string, carriesBox = false, onArrive?: () => void): Promise<void> {
    const { door, sellerHome } = this.layout;
    const start = this.streetSpawn();
    const sprite = this.makePerson(start.x, start.y, look);
    this.addUmbrella(sprite);
    await this.walk(sprite, door.x, this.streetY);
    await this.walk(sprite, door.x, door.y - 10);
    await this.walk(sprite, sellerHome.x - 28, sellerHome.y - 12);
    if (!sprite.active) return;
    this.setFacing(sprite, 'right');
    this.popup(sprite.x, sprite.y - 18, line, '#fff3b0');
    this.emote(sprite, 'emo_heart');
    onArrive?.();
    await this.wait(2200);
    if (carriesBox && sprite.active) sprite.add(this.art(0, 3, 'box'));
    await this.walk(sprite, door.x, door.y - 10);
    await this.walk(sprite, door.x, this.layout.h + 16);
    void this.strollAway(sprite);
  }

  /** Эдуард подходит к витрине, присматривается и уходит в свой магазин по соседству. */
  private async runEduard(): Promise<void> {
    const { w, h } = this.layout;
    const sprite = this.makePerson(this.next.w + 60, this.streetY, EDUARD);
    await this.walk(sprite, w - 20, this.streetY);
    await this.walk(sprite, w - 20, h + 15);
    if (!sprite.active) return;
    this.setFacing(sprite, 'up');
    this.emote(sprite, 'emo_question');
    this.popup(sprite.x, sprite.y - 18, t('popup.eduard'), '#d0e0ff');
    await this.wait(2500);
    const eduardDoor = this.next.w + 26 + 128 * 0.62;
    await this.walk(sprite, w - 20, this.streetY);
    await this.walk(sprite, eduardDoor, this.streetY);
    await this.walk(sprite, eduardDoor, this.next.h - 2);
    sprite.destroy();
  }

  /** Официант кафе «Пончик» приходит к магазину за заказом по договору и уносит коробку. */
  private async runCafeWaiter(): Promise<void> {
    const { door, h } = this.layout;
    const cafeDoor = -136 - WING_OUTER + 112 * 0.62;
    const sprite = this.makePerson(cafeDoor, this.next.h - 2, { ...randomLook(0x733e39), acc: 'apron', accTint: 0xffffff });
    await this.walk(sprite, cafeDoor, this.streetY);
    await this.walk(sprite, door.x, this.streetY);
    await this.walk(sprite, door.x, h + 15);
    if (!sprite.active) return;
    this.setFacing(sprite, 'up');
    this.popup(sprite.x, sprite.y - 18, t('popup.cafeWaiter'), '#fff3b0');
    await this.wait(1500);
    const result = this.cafeToday;
    if (!sprite.active) return;
    if (result?.delivered) {
      sound.coin();
      this.popup(sprite.x, sprite.y - 18, t('popup.cafePaid', { n: result.pay }), '#c8ffb0');
      sprite.add(this.art(0, 3, 'box'));
    } else this.popup(sprite.x, sprite.y - 18, t('popup.cafeShort'), '#ffd0d0');
    await this.wait(900);
    await this.walk(sprite, door.x, this.streetY);
    await this.walk(sprite, cafeDoor, this.streetY);
    await this.walk(sprite, cafeDoor, this.next.h - 2);
    sprite.destroy();
  }

  /** Откуда приходят с улицы: с тротуара слева или справа от входа. */
  private streetSpawn(): Phaser.Types.Math.Vector2Like {
    const side = Math.random() < 0.5 ? -1 : 1;
    return { x: this.layout.door.x + side * Phaser.Math.Between(50, 90), y: this.streetY + Phaser.Math.Between(-3, 3) };
  }

  /** Вышел из магазина — уходит по тротуару за край кадра. */
  private async strollAway(sprite: Phaser.GameObjects.Container): Promise<void> {
    await this.walk(sprite, this.layout.door.x, this.streetY + Phaser.Math.Between(-3, 3));
    const side = Math.random() < 0.5 ? -1 : 1;
    await this.walk(sprite, side < 0 ? -60 : this.next.w + 60, sprite.y);
    sprite.destroy();
  }

  /** Свободные кассы забирают первых из очереди; остальные стоят в линию за кассами. */
  private layoutQueue(): void {
    this.registers.forEach((r, i) => {
      if (r.customer || !this.operator(i) || !this.queue.length) return;
      const c = this.queue.shift()!;
      r.customer = c;
      void this.walk(c.sprite, r.spot.x, r.spot.y);
    });
    this.queue.forEach((c, i) => void this.walk(c.sprite, this.layout.queue.x, this.queueSpotY(i)));
  }

  private updateBubble(c: Customer): void {
    if (!c.bubble.visible) return;
    const left = 1 - (this.time.now - c.waitStart) / (c.patienceMs ?? PATIENCE_MS);
    c.bubble.setTint(left > 0.6 ? 0x8fd16a : left > 0.3 ? 0xf2c14e : 0xd95763);
  }

  // ---------- Утилиты ----------

  /** Место в очереди: в тесном ларьке длинная очередь стоит плотнее, чтобы не упираться в полки. */
  /** Место в линии: сразу за кассами (выше их мест), длинная очередь сжимается до стены. */
  private queueSpotY(index: number): number {
    const { y, step, minY } = this.layout.queue;
    const top = (this.registers.length ? Math.min(...this.registers.map((r) => r.spot.y)) : y + step) - step;
    const fit = this.queue.length > 1 ? (top - minY) / (this.queue.length - 1) : step;
    return top - index * Math.min(step, fit);
  }

  /** Идёт к точке; в зале — в обход мебели, по нескольким отрезкам. Новый walk отменяет прежний. */
  private walk(target: Phaser.GameObjects.Container, x: number, y: number, speed = this.customerSpeed()): Promise<void> {
    const gen = ((target.getData('walkGen') as number | undefined) ?? 0) + 1;
    target.setData('walkGen', gen);
    const indoor = target.y < this.layout.h - 2 && y < this.layout.h - 2;
    const legs = indoor ? findPath({ x: target.x, y: target.y }, { x, y }, this.obstacles) : [{ x, y }];
    return legs.reduce<Promise<void>>(
      (done, leg) => done.then(() => (target.active && target.getData('walkGen') === gen ? this.walkLeg(target, leg.x, leg.y, speed) : undefined)),
      Promise.resolve(),
    );
  }

  private walkLeg(target: Phaser.GameObjects.Container, x: number, y: number, speed: number): Promise<void> {
    // Останавливаем только прошлый шаг: прыжок от радости и прочие анимации доигрывают.
    (target.getData('move') as Phaser.Tweens.Tween | undefined)?.stop();
    const distance = Phaser.Math.Distance.Between(target.x, target.y, x, y);
    // Поворачивается туда, куда идёт.
    const dx = x - target.x;
    const dy = y - target.y;
    if (distance > 0.5) this.setFacing(target, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy < 0 ? 'up' : 'down');
    target.setData('walking', true);
    return new Promise((resolve) => {
      const move = this.tweens.add({
        targets: target,
        x,
        y,
        duration: (distance / speed) * 1000,
        onUpdate: () => target.setDepth(target.y),
        onComplete: () => {
          target.setData('walking', false);
          resolve();
        },
        onStop: () => {
          target.setData('walking', false);
          resolve();
        },
      });
      target.setData('move', move);
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  /** Всплывающая надпись: жирная, на тёмной плашке, выпрыгивает, потом поднимается и тает. */
  private popup(x: number, y: number, text: string, color: string): void {
    const label = this.add
      .text(x, y, text, {
        fontFamily: UI_FONT,
        fontSize: '8.5px',
        fontStyle: 'bold',
        color,
        backgroundColor: 'rgba(24, 20, 37, 0.78)',
        padding: { x: 3, y: 1.5 },
        align: 'center',
        // Длинная фраза переносится, чтобы не вылезать за край магазина.
        wordWrap: { width: Math.min(110, this.layout.w - 10) },
      })
      .setOrigin(0.5)
      .setResolution(5)
      .setDepth(1000)
      .setScale(0.4);
    // Длинная надпись не должна вылезать за край магазина; и висит дольше, чтобы успеть прочитать.
    const half = label.width / 2 + 2;
    label.x = Phaser.Math.Clamp(x, half, Math.max(half, this.layout.w - half));
    const hold = Math.min(1800, 500 + 40 * text.length);
    this.tweens.add({
      targets: label,
      scale: 1,
      duration: 220,
      ease: 'Back.easeOut',
      onComplete: () =>
        this.tweens.add({ targets: label, y: y - 12, alpha: 0, delay: hold, duration: 600, ease: 'Quad.easeIn', onComplete: () => label.destroy() }),
    });
  }

  // ---------- День ----------

  /** Подарок за ежедневный вход: деньги (и товар) сразу в состоянии, окно — поверх утра. */
  private offerGift(): void {
    const claimed = claimGift(this.state, localDate(new Date()), Math.random);
    if (!claimed) return;
    this.state = claimed.state;
    saveGame(this.state);
    this.hud.update(this.state, DAY_SECONDS);
    this.refreshWarehouse();
    this.time.delayedCall(400, () => showGift(claimed.gift));
  }

  private showMorning(): void {
    // Подарок за ежедневный вход — но не во время бабушкиного обучения: его вручат, когда оно закончится.
    if (this.state.tourDone !== false) this.offerGift();
    // Старые сохранения сразу получают значки за то, что уже сделано.
    this.checkAchievements(false);
    this.morningStock = warehouseCount(this.state);
    this.reviewStar?.setVisible(Boolean(this.state.reviews?.length));
    this.applyFair();
    this.awaitingBoxes = 0;
    this.hud.update(this.state, DAY_SECONDS);
    if (weatherFor(this.state.day) !== this.weather) this.applyWeather();
    // Примерка премиальной вещи кончилась вчера — убрать её из зала.
    const trial = this.state.decor.trial;
    const trialOver = Boolean(trial && trial.day < this.state.day);
    if (trialOver) this.state = { ...this.state, decor: { ...this.state.decor, trial: undefined } };
    // Эдуард за ночь открыл магазин побольше — перерисовать улицу.
    if (trialOver || eduardLook(this.state) !== this.builtEduard) this.buildWorld();
    this.updateLighting(0);
    this.openShop();
    showMorning({
      onTourDone: () => this.offerGift(),
      getState: () => this.state,
      setState: (s) => {
        const staffChanged = s.staff !== this.state.staff;
        const decorChanged = s.decor !== this.state.decor;
        const adsChanged = s.ads !== this.state.ads;
        // Купили приёмник — его надо поставить на прилавок; сменили волну — только музыка.
        const upgradesChanged = s.upgrades !== this.state.upgrades || s.gear !== this.state.gear || hasRadio(s) !== hasRadio(this.state);
        const radioChanged = s.radio !== this.state.radio;
        // Кота оставили, купили лежанку или он вернулся с прогулки — перерисовать вход.
        const was = this.state;
        const catChanged = Boolean(s.cat) !== Boolean(was.cat) || s.cat?.bed !== was.cat?.bed || catHome(s) !== catHome(was);
        this.state = s;
        saveGame(s);
        if (s.level > this.builtLevel) void this.celebrateExpansion();
        else if (s.level !== this.builtLevel || decorChanged || upgradesChanged || catChanged || eduardLook(s) !== this.builtEduard) this.buildWorld();
        else if (staffChanged) this.syncStaff();
        if (adsChanged) this.applyAds();
        if (radioChanged) this.applyRadio();
        this.awaitingBoxes = this.boxesToDeliver();
        this.refreshShelves();
        this.refreshWarehouse();
        this.hud.update(s, DAY_SECONDS);
      },
      onOpen: () => this.startDay(),
    });
  }

  private startDay(): void {
    for (const r of this.registers) {
      r.scan = null;
      r.customer = null;
    }
    this.night = false;
    this.nightAsked = false;
    this.aromaUntil = 0;
    this.resetOven();
    this.inspector = this.state.plan?.inspection ? 'pending' : 'none';
    this.inspection = null;
    this.rushAnnounced = false;
    this.questsSeen = 0;
    this.valyaCame = false;
    this.syncStaff();
    // Кафе по соседству забирает свой заказ по договору — сразу, как открылись.
    const cafe = cafeDeliver(this.state);
    this.state = cafe.state;
    this.cafeToday = cafe.result;
    if (cafe.result) {
      this.refreshShelves();
      this.refreshWarehouse();
    }
    this.scheduleStoryGuests();
    const season = seasonFor(this.state.day);
    if (season) this.time.delayedCall(600, () => this.popup(this.layout.w / 2, this.layout.h / 2, `${season.icon} ${t(season.nameKey)}!`, '#fee761'));
    else if (isFairDay(this.state.day)) this.time.delayedCall(600, () => this.popup(this.layout.w / 2, this.layout.h / 2, t('popup.fair'), '#fee761'));
    this.stats = emptyDayStats();
    if (isFairDay(this.state.day)) this.stats.fair = true;
    this.startStall();
    this.setSpeed(1);
    this.scheduleOrder();
    // Вечером мусор выносят — утром ведро пустое.
    this.binFill = 0;
    this.refreshBin();
    this.combo = 0;
    this.lastSaleAt = -Infinity;
    if (this.awaitingBoxes > 0) void this.deliver();
    this.endLiveEvent();
    this.scheduleRegulars();
    // Старые холодильники иногда подтекают: лужа у одного из них посреди дня.
    if (Math.random() < fridgeLeak(this.state)) {
      this.time.delayedCall(Phaser.Math.FloatBetween(0.15, 0.7) * DAY_SECONDS * 1000, () => this.running && this.fridgeLeaks());
    }
    if (this.state.day >= LIVE_FROM_DAY && Math.random() < LIVE_CHANCE) {
      const kind = Phaser.Utils.Array.GetRandom([...LIVE_KINDS]);
      this.time.delayedCall(Phaser.Math.FloatBetween(0.2, 0.6) * DAY_SECONDS * 1000, () => this.running && this.startLiveEvent(kind));
    }
    this.timeLeft = DAY_SECONDS;
    this.nextSpawn = 1;
    this.eveningMarkdown = false;
    this.toiletDirt = 0;
    this.refreshToilet();
    for (const piece of this.trash) piece.destroy();
    this.trash.clear();
    this.running = true;
  }

  private finishDay(): void {
    this.running = false;
    this.night = false;
    this.setSpeed(1);
    this.stallTimer?.remove();
    this.stallTimer = undefined;
    if (this.order) {
      this.order.timer.remove();
      this.order.bubble.destroy();
      this.order = null;
    }
    // Хлеб, оставшийся в печи к закрытию, продавец вынимает сам.
    if (this.oven && this.oven.state !== 'idle') {
      const product = this.oven.product;
      this.resetOven();
      this.state = (product === 'bread' ? takeOutBread(this.state) : takeOutBread(this.state, BRAND_BATCH, product)).state;
    }
    const finishedDay = this.state.day;
    const ratingBefore = this.state.rating;
    const rankBefore = rankOf(this.state.totalRevenue);
    const { state, spoiled, bill, shortfall, skimmed, order, quests, weekly } = nightCycle(this.state, this.stats);
    const cafe = this.cafeToday;
    this.cafeToday = null;
    const extra: [string, string][] = [];
    if (quests.total) extra.push([t('summary.quests'), t('summary.questsValue', { done: quests.done, total: quests.total, n: quests.earned })]);
    if (weekly.completed.length) extra.push([t('summary.weekly'), t('summary.weeklyDone', { n: weekly.completed.length, money: weekly.earned })]);
    const rankAfter = rankOf(state.totalRevenue);
    if (rankAfter > rankBefore) extra.push(['🏅', t('summary.rankUp', { name: rankName(rankAfter, t) })]);
    if (order) extra.push([t('summary.order'), order.delivered ? t('summary.orderDone', { n: order.earned }) : t('summary.orderFailed')]);
    if (cafe) {
      const end = cafe.ended === 'done' ? ` · ${t('summary.cafeDone')}` : cafe.ended === 'canceled' ? ` · ${t('summary.cafeCanceled')}` : '';
      extra.push([t('summary.cafe'), `${cafe.delivered ? t('summary.cafePaid', { n: cafe.pay }) : t('summary.cafeMissed')}${end}`]);
    }
    if (this.inspection) {
      const r = this.inspection;
      extra.push([
        t('summary.inspection'),
        r.passed ? t('summary.inspectionPassed') : t('summary.inspectionFailed', { n: r.fine, problems: r.problems.map((p) => t(p)).join(', ') }),
      ]);
    }
    const promoted = state.staff !== this.state.staff;
    // Вечером посетители пишут отзывы: они висят на доске у входа и видны в итогах дня.
    const reviews = reviewsFor(this.stats, finishedDay);
    const best = updateRecords({ ...recordDay(state, this.stats), reviews }, this.stats, finishedDay);
    this.state = best.state;
    for (const id of best.broken) extra.push(['🏆', t('records.broken', { name: t(`records.${id}` as TextKey) })]);
    this.stats.spoiled = spoiled;
    this.stats.skimmed = skimmed;
    if (promoted) this.syncStaff();
    const unlocked = this.checkAchievements(false);
    if (unlocked.length) extra.push([t('ach.summary'), unlocked.map((id) => t(`ach.${id}` as TextKey)).join(', ')]);
    saveGame(this.state);
    this.refreshShelves();
    this.refreshWarehouse();
    this.hud.update(this.state, 0);
    // Магазин закрывается: опускаются роллеты, потом — итоги дня.
    this.closeShop();
    this.time.delayedCall(1500, () => {
      sound.fanfare();
      this.hud.showSummary(
        finishedDay,
        this.stats,
        { before: ratingBefore, after: state.rating },
        { bill: bill && billTotal(bill), shortfall, total: state.money },
        extra,
        this.state.history,
        lossAdvice(this.stats, this.state),
        reviews,
        () => this.showMorning(),
      );
    });
  }

  /** Вечером на витрины, дверь и склад опускаются роллеты. */
  private closeShop(): void {
    const { h, door, w, warehouse } = this.layout;
    const spots = [{ x: door.x, w: 32 }, { x: warehouse.x + warehouse.w / 2, w: 24 }];
    for (let x = 18; x < w - 10; x += 24) {
      if (Math.abs(x - door.x) > 24) spots.push({ x, w: 20 });
    }
    for (const spot of spots) {
      const shutter = this.art(spot.x, h + 0.5, 'shutter').setOrigin(0.5, 0).setDepth(h + 3);
      shutter.setDisplaySize(spot.w, 0.1);
      this.tweens.add({ targets: shutter, displayHeight: FACADE_H - 1, duration: 900, ease: 'Bounce.easeOut', delay: Math.random() * 200 });
      this.shutters.push(shutter);
    }
  }

  /** Утром роллеты поднимаются. */
  private openShop(): void {
    for (const shutter of this.shutters) {
      this.tweens.add({ targets: shutter, displayHeight: 0.1, duration: 600, ease: 'Quad.easeIn', onComplete: () => shutter.destroy() });
    }
    this.shutters = [];
  }
}
