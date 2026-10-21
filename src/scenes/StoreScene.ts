import Phaser from 'phaser';
import {
  BAD_COMPLAINT_CHANCE,
  buyChance,
  CHEAP_RATIO,
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
  markdownExpiring,
  expiringIn,
  SHELF_KINDS,
  thiefChance,
  workSpeed,
  hasUnmarkedBad,
  moveToShelf,
  shelveAll,
  newGame,
  PRODUCT_IDS,
  returnToShelf,
  shelfCapacity,
  shelfFor,
  shelfFree,
  slotOf,
  STORE_LEVELS,
  sellableProducts,
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
import { getLang, t, type TextKey } from '../i18n';
import { sound } from '../platform/sound';
import { music } from '../platform/music';
import { findPath, type Rect } from './paths';
import { ambience } from '../platform/ambience';
import { haptic, trustedNow } from '../platform/telegram';
import { button, el, openModal, toast, UI_FONT } from '../ui/dom';
import {
  BIG_DAYS,
  BLACKOUT_CHECKOUT,
  BLACKOUT_UNTIL,
  ROBBERY_AT,
  ROBBERY_RATING,
  ROBBERY_RELEASE,
  ROBBERY_STORM,
  bigDayExtraItems,
  bigDayFor,
  bigDayNightGuests,
  bigDayProgress,
  blackoutWarm,
  CROWD_EXTRA_GUESTS,
  CROWD_PATIENCE,
  filmingReward,
  fulfillWedding,
  isCrowdDay,
  MASKS,
  quakeBreak,
  setBigDaySeed,
  ROADWORKERS,
  TOURISTS,
  weddingOrder,
  weddingText,
  type BigDayId,
  type WeddingOrder,
} from '../game/bigday';
import { dialogBox } from '../ui/dialog';
import { giantLook, type GiantLook } from '../game/giant';
import { pickWear, wearOf } from './archetypes';
import { BIG_LAYER_DY, type BackId, type FaceId, type HatId, type OutfitId, type PropId } from './wardrobe';
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
import { carryOf, CART_SHARE, cartPatience, ETAGS_EVENING, eveningSales, hasUpgrade, KIOSK_ITEM_SECONDS, KIOSK_MAX_ITEMS, KIOSK_PAY_SECONDS, loyaltyTolerance, withUpgrades } from '../game/upgrades';
import { showGift } from '../ui/gift';
import { activeDecor, grantDecor, isDecorId, type DecorId } from '../game/decor';
import { restorePurchases } from '../platform/stars';
import { DOG_DAY_CATCH, hasDog, hasWatchman } from '../game/watch';
import { contestOf, juryDay, tierKey } from '../game/contest';
import { sonyaVisits, sunflowersPlanted } from '../game/drama';
import { askWriteAccessOnce, socialPing, WELCOME_GIFT } from '../platform/social';
import { reportProgress, track } from '../platform/analytics';
import { shareDay } from '../platform/shareCard';
import { duelInfo, loadMultiplayer, treatFriend, visitsInfo, type VisitFriend } from '../platform/multiplayer';
import { ensureSeason, grantPass } from '../game/pass';
import { ensureRush } from '../game/rush';
import { DISHES, DISH_IDS, kitchenOpen, portionsOf, sellDish } from '../game/kitchen';
import { activeTrick, seeTrickResult, trickResult } from '../game/tricks';
import {
  answerNightStory,
  BUSKER_GUESTS,
  DEBT_UNITS,
  debtLabel,
  debtProduct,
  NIGHT_GUEST_TYPES,
  nightStory,
  pickNightGuest,
  STORY_GUEST,
  type NightGuestId,
  type NightStoryId,
} from '../game/nightGuests';
import { BUILDINGS, BUILDING_IDS, buildingStage, districtGuest, districtKey, isMatchDay, type BuildingId } from '../game/district';
import { reportError, setErrorContext } from '../platform/errors';
import { bodyRect, iceboxFits, slotIssues, slotPosFor, snap, withSlots } from './placement';
import { iceboxSpotFor, layoutFor, REGISTER_ROW, registerSpot, unitsPerBox, WAREHOUSE_COLS, WING_OUTER, type Layout, type Room } from './layout';
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
import { hasRadio, nextStation, radioPatience, radioTolerance, radioSpeed, setStation, STATION_INFO, stationOf } from '../game/radio';
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
  ovenBatch,
  ovenBatchCost,
  signagePatience,
  ovenSprite,
  REGISTER_JAM_SECONDS,
  registerJam,
  registerSprite,
  warehouseSpeed,
  wcDirt,
} from '../game/gear';
import { CASHIER_ROLES, nextRegisterCount, nextRegisterPrice, registerCount, registerOfRole, registerSlots } from '../game/registers';
import { AROMA_SECONDS, AROMA_TOLERANCE, bakerShouldBake, bakeryWorking, OVEN_BURN_SECONDS, sellWholesale, startBatch, takeOutBread, wholesaleToBake } from '../game/bakery';
import { canWorkNight, NIGHT_GUESTS, NIGHT_MARKUP, NIGHT_POWER, NIGHT_SECONDS, NIGHT_TOLERANCE, startNight } from '../game/night';
import { CAT_BEDS, CAT_TIP, catHome, catPatience, catTipChance, fedToday } from '../game/cat';
import { note, reviewsFor } from '../game/reviews';
import { warLeaves } from '../game/war';
import { lossAdvice, noteLost } from '../game/losses';
import { fairTolerance, isFairDay, STALL_EVERY_SECONDS, STALL_MAX, stallSale } from '../game/fair';
import { fpsSummary, LITE_FPS, liteMode, setLiteMode } from '../platform/quality';
import { DELIVERY_SECONDS, makeHomeOrder, ORDER_EVERY, ORDER_TIMEOUT, packHomeOrder, type HomeOrder } from '../game/delivery';

// Холст шириной 720 и высотой под экран телефона: от 9:16 до 9:20 — на вытянутых телефонах
// картинка во весь экран, без пустых полос сверху и снизу. Камера подбирает масштаб под магазин.
export const ASPECT = Phaser.Math.Clamp(window.innerHeight / Math.max(1, window.innerWidth), 16 / 9, 20 / 9);
/**
 * Во сколько раз холст плотнее базовых 720 точек по ширине: под экран телефона (ширина × devicePixelRatio),
 * от 1 до 1,5 с шагом 0,25 (больше — тяжело слабым телефонам). Пиксель-арт и надписи не мылятся.
 */
export const RES = (() => {
  const cssWidth = Math.min(window.innerWidth, window.innerHeight / ASPECT);
  // Лёгкая графика (platform/quality.ts) — без повышенной плотности: вдвое меньше пикселей.
  return Phaser.Math.Clamp(Math.round(((cssWidth * (window.devicePixelRatio || 1)) / 720) * 4) / 4, 1, liteMode() ? 1 : 1.5);
})();
export const CANVAS_W = Math.round(720 * RES);
export const CANVAS_H = Math.round(720 * ASPECT * RES);
/** Сверху интерфейс (деньги, товар), снизу подсказки — магазин рисуем между ними. */
const HUD_TOP = 140 * RES;
const HUD_BOTTOM = 80 * RES;
/** Насколько ближе стартовый кадр, чем «весь магазин с флигелем по ширине». */
const HOME_ZOOM = 1.1;
/** Верх вывески над стеной магазина: под верхнюю панель — без полосы пустого газона. */
const SIGN_TOP = -16;
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
/** Насколько далеко можно отвести камеру от магазина пальцем. */
const CAMERA_REACH = 200;
/** Толщина наружных стен и высота фасада (в точках мира). */
const WALL = 6;
const FACADE_H = 10;
/**
 * Вид фасада по уровню магазина: ларёк в досках, кирпич, светлая плитка и стеклянный
 * супермаркет. У двух старших вместо навесиков над окнами — сплошной козырёк фирменного
 * цвета (у супермаркета — с подсветкой), главный навес над входом того же цвета.
 */
const FACADE_STYLES: { texture: string; awning?: number; canopy?: number; led?: boolean }[] = [
  { texture: 'facade_wood', awning: 0x8fd16a },
  { texture: 'facade' },
  { texture: 'facade', awning: 0xfee761 },
  { texture: 'facade_tile', canopy: 0x3e8948 },
  { texture: 'facade_glass', canopy: 0x262b44, led: true },
];
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
/** Всплывающая надпись и сколько раз подряд она повторилась. */
type Popup = { label: Phaser.GameObjects.Text; text: string; count: number; fade?: Phaser.Tweens.Tween };

/** Здание по соседству; back — отступ от тротуара (у кафе перед ним веранда). */
/** Особая крыша: вертолётная площадка, красный крест, бельё, солнечные панели (art/rooftops.py). */
type RoofKit = 'office' | 'clinic' | 'dorm' | 'school';
type Neighbor = { x: number; w: number; h: number; name: TextKey; label?: string; sign: number; awning: number; roof: number; neon: number; dark?: boolean; back?: number; roofKit?: RoofKit };

/** Помещение конкурента: пустует, «МегаМарт» по сюжету, а после сюжета — боссы района по очереди. */
const RIVAL_LOOKS: Record<EduardLook, Omit<Neighbor, 'x' | 'w'>> = {
  vacant: { h: 130, name: 'eduard.stage0', sign: 0x5a6988, awning: 0x8b9bb4, roof: 0xc0cbdc, neon: 0, dark: true },
  mega: { h: 140, name: 'eduard.mega', sign: 0x124e89, awning: 0x0099db, roof: 0xc4d0ec, neon: 0x6cd8ff },
  kiosk: { h: 110, name: 'eduard.stage1', sign: 0x68386c, awning: 0xb55088, roof: 0xe0c8dc, neon: 0xff8ad8 },
  discount: { h: 145, name: 'eduard.stage2', sign: 0xb13e53, awning: 0xfee761, roof: 0xf2e6c8, neon: 0xffd040 },
  farm: { h: 135, name: 'eduard.stage3', sign: 0x3e8948, awning: 0x63c74d, roof: 0xd8e4c0, neon: 0x9cff7a },
  mall: { h: 190, name: 'eduard.stage4', sign: 0xa22633, awning: 0xe43b44, roof: 0xf2e6c8, neon: 0xffd040, roofKit: 'office' },
};

/** Друзья в гостях: сколько за день, чаевые за уровень их магазина, подарок за угощение (как на сервере). */
const FRIEND_VISITS = 2;
const FRIEND_TIP = 40;
const FRIEND_GIFT = 300;

/** Деревья сквера: обычное чаще, остальные для разнообразия. */
const PARK_TREES = ['tree', 'tree', 'tree_round', 'tree_birch', 'tree_pine'];

/** Высота здания босса за дорогой: умещается на месте «Гиганта». */
const RIVAL_ACROSS_H = 106;

/** Слой света: выше людей и мебели, ниже всплывающих надписей (1000). */
const LIGHT_DEPTH = 900;
/** Цвет света на улице и в зале по ходу дня: [доля дня, цвет]. Умножается на картинку. */
const OUTDOOR_LIGHT: [number, number][] = [
  [0, 0xfff2dc],
  [0.15, 0xffffff],
  [0.7, 0xffffff],
  [0.82, 0xffe2b8],
  [0.92, 0xe89c78],
  [1, 0x5c64a8],
];
/** В снег на улице свет холоднее: снег белый днём и голубой в сумерках, а не песочный. */
const SNOW_OUTDOOR_LIGHT: [number, number][] = [
  [0, 0xeef4ff],
  [0.15, 0xffffff],
  [0.7, 0xffffff],
  [0.82, 0xe4ecff],
  [0.92, 0xa9b8ec],
  [1, 0x5c64a8],
];
const INDOOR_LIGHT: [number, number][] = [
  [0, 0xfffaf0],
  [0.15, 0xffffff],
  [0.75, 0xffffff],
  [0.9, 0xfff0dc],
  [1, 0xe4d8ec],
];

/** С какой доли дня начинается вечер. */
const EVENING_FROM = 0.72;

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
  // Ларь с мороженым у входа и вёдра с цветами у кассы — свои картинки и свои места.
  icebox: { texture: 'icebox', tint: 0xffffff },
  florist: { texture: 'florist', tint: 0xffffff },
};
/** Цвет плитки отдела под полкой. */
const DEPT_FLOOR: Record<Category, number> = {
  bakery: 0xe8a65a,
  produce: 0x63c74d,
  dairy: 0x5fb4f0,
  meat: 0xe4606a,
  drinks: 0x2ea8e0,
  frozen: 0x9ad8ff,
  household: 0xb27ae0,
  icebox: 0x9ad8ff,
  florist: 0xf6757a,
};
/** Где на картинке лежит товар (относительно центра места): x, ширина, верхний ряд, шаг рядов. */
const ITEM_AREA: Partial<Record<Category, { x: number; w: number; y: number; row: number }>> = {
  icebox: { x: -13, w: 26, y: -6, row: 4 },
};
/** Вёдра с цветами: в каждом ведре по три букета (заднее ведро выше). */
const FLORIST_SPOTS = [
  [0, -9], [-2, -9.5], [2, -9.5],
  [-6.5, -3], [-8.5, -3.5], [-4.5, -3.5],
  [6.5, -3], [4.5, -3.5], [8.5, -3.5],
];
/** Белая рубашка под майкой бегуна: номер на груди — прорезь, в ней видна рубашка. */
const WHITE_SHIRT = 0xffffff;
const SHIRTS = [0x5b6ee1, 0xd95763, 0x6abe30, 0xfbf236, 0x76428a, 0xdf7126, 0x37946e, 0xf6757a, 0x2ce8f5];
const PANTS = [0x3a4466, 0x262b44, 0x5a6988, 0x733e39, 0x265c42];
const HAIR_COLORS = [0x4a2c1a, 0x181425, 0x733e39, 0xfeae34, 0xb86f50, 0x8b9bb4];
const HAIR_STYLES = ['short', 'short', 'long', 'long', 'bald', 'ponytail', 'curly'] as const;
type HairStyle = 'short' | 'long' | 'bun' | 'cap' | 'bald' | 'ponytail' | 'curly' | 'beanie';
/** Поверх одежды: фартук (красится), жилет грузчика, значок охранника. */
type Accessory = 'apron' | 'vest' | 'badge' | 'tie';
type Facing = 'down' | 'up' | 'left' | 'right';
type EmoteKey = 'emo_angry' | 'emo_heart' | 'emo_question' | 'emo_clock' | 'emo_sigh' | 'emo_pricey' | 'emo_alert' | 'emo_zzz' | 'emo_star';

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
  /** Гардероб (wardrobe.ts): головной убор, одежда поверх рубашки, вещь в руках, на лице, на спине. */
  hat?: HatId;
  hatTint?: number;
  outfit?: OutfitId;
  outfitTint?: number;
  prop?: PropId;
  propTint?: number;
  face?: FaceId;
  /** Цвет бороды и усов (по умолчанию — как волосы). */
  faceTint?: number;
  back?: BackId;
  backTint?: number;
  /** Узор на рубашке: полоски или сердечко на груди. */
  pattern?: 'stripes' | 'print';
  /** Пуховик (цвет) и шарф (цвет) — зимой и в холодное межсезонье. */
  coat?: number;
  scarf?: number;
}

/** Ночной сторож Михалыч: ушанка, ватник цвета хаки, седые усы, фонарик (как в art/security.py). */
const WATCHMAN: Look = {
  skin: 0xeec39a,
  shirt: 0x5a6988,
  pants: 0x262b44,
  hair: 0xc0cbdc,
  hat: 'ushanka',
  hatTint: 0x8f563b,
  outfit: 'cardigan',
  outfitTint: 0x7a8a5a,
  face: 'mustache',
  prop: 'flashlight',
};

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

/** Доля покупателей в узнаваемом образе (archetypes.ts): пенсионер с тростью, повар, турист… */
const ARCHETYPE_SHARE = 0.5;

function customerLook(shirt: number, day = 0): Look {
  // Каждый пятый — в полоску, каждый восьмой — с сердечком на груди.
  const roll = Math.random();
  const pattern: Partial<Look> = roll < 0.2 ? { pattern: 'stripes' } : roll < 0.32 ? { pattern: 'print' } : {};
  return seasonalLook({ ...plainLook(shirt, day), ...pattern }, day);
}

const COAT_COLORS = [0x262b44, 0xe43b44, 0x3e8948, 0x5a6988, 0xb86f50, 0x68386c, 0x0099db, 0xc0cbdc];

/** Одежда по погоде: зимой пуховики, шарфы и шапки, летом панамы и тёмные очки. */
function seasonalLook(look: Look, day: number): Look {
  if (!day) return look;
  const time = yearTime(day);
  const pick = <T,>(items: readonly T[]): T => Phaser.Utils.Array.GetRandom(items as T[]);
  const free = !look.hat && look.style !== 'cap' && look.style !== 'beanie';
  const out = { ...look };
  const cold = time === 'winter' ? 1 : time === 'autumn' ? 0.45 : time === 'spring' ? 0.2 : 0;
  if (cold && !look.outfit && Math.random() < 0.7 * cold) out.coat = pick(COAT_COLORS);
  if (cold && Math.random() < 0.55 * cold) out.scarf = pick(HAT_COLORS);
  if (time === 'winter' && free) {
    const r = Math.random();
    if (r < 0.35) Object.assign(out, { style: 'beanie', hair: pick(HAT_COLORS) });
    else if (r < 0.45) Object.assign(out, { hat: 'ushanka', hatTint: pick([0x8f563b, 0x262b44, 0x5a6988]) });
  }
  if (time === 'summer') {
    if (free && Math.random() < 0.25) Object.assign(out, { hat: pick(['bucket', 'sunhat', 'straw'] as const), hatTint: pick([0xffffff, 0xfee761, 0x9cd8ff, 0xf6757a]) });
    if (!look.face && Math.random() < 0.15) out.face = 'sunglasses';
  }
  return out;
}

function plainLook(shirt: number, day: number): Look {
  const look = randomLook(shirt);
  if (day && Math.random() < ARCHETYPE_SHARE) return { ...look, ...pickWear(day, Math.random).wear };
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

/** Ночной гость с характером (nightGuests.ts): таксист, студент, врач, охранник… */
function nightGuestLook(id: NightGuestId): Look {
  const base = randomLook(Phaser.Utils.Array.GetRandom(NIGHT_SHIRTS));
  const pick = <T,>(items: readonly T[]): T => Phaser.Utils.Array.GetRandom(items as T[]);
  switch (id) {
    case 'taxi':
      return { ...base, style: 'cap', hair: 0xfee761, outfit: 'leather', outfitTint: 0x262b44, prop: 'coffee' };
    case 'student':
      return { ...base, outfit: 'hoodie', outfitTint: pick(HAT_COLORS), hat: 'headphones', hatTint: 0x262b44, bag: 'backpack', bagTint: pick(BAG_COLORS) };
    case 'doctor':
      return { ...base, outfit: 'labcoat', outfitTint: 0xffffff, face: Math.random() < 0.5 ? 'medmask' : undefined, hat: Math.random() < 0.4 ? 'nursecap' : undefined };
    case 'guard':
      return { ...base, outfit: 'leather', outfitTint: 0x181425, acc: 'badge', accTint: 0xfee761, hat: 'policecap', hatTint: 0x262b44 };
    case 'musician':
      return { ...base, back: 'guitar', backTint: pick([0x8f563b, 0xe43b44, 0x262b44]), hat: 'beret', hatTint: pick(HAT_COLORS) };
    case 'insomniac':
      return { ...base, outfit: 'cardigan', outfitTint: 0x5a6988, hat: 'flatcap', hatTint: 0x4a3b52, prop: 'newspaper', glasses: true, hair: 0xc0cbdc };
    case 'lovers':
      return { ...base, style: pick(['long', 'ponytail'] as const), prop: 'bouquet', propTint: pick([0xe43b44, 0xf6757a, 0xfee761]) };
    case 'vampire':
      return { ...base, back: 'cape', backTint: 0x181425, outfit: 'suit', outfitTint: 0x181425, face: 'sunglasses', hair: 0x181425, style: 'short', skin: 0xeec39a };
  }
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
const FRONT_ONLY = new Set(['acc_badge', 'acc_tie', 'acc_glasses', 'p_pat_print']);
const GRANDMA_LINES_KEYS: TextKey[] = ['visit.grandma1', 'visit.grandma2', 'visit.grandma3'];
const ORDER_GUESTS: Record<ClientId, [Look, TextKey]> = {
  chef: [MARAT, 'who.marat'],
  school: [SCHOOL_COOK, 'client.school'],
  valya: [VALYA, 'who.valya'],
};
const OWNER: Look = { shirt: 0x8fd16a, skin: 0xf2d3ab, pants: 0x3a4466, hair: 0x4a2c1a, style: 'short' };
/** Наряды хозяина за звёзды (decor.ts, раздел «Наряд»). Должно совпадать с art/costumes.py. */
const COSTUMES: Partial<Record<DecorId, Partial<Look>>> = {
  outfit_farmer: { hat: 'straw', outfit: 'overalls', pants: 0x3b5a9a },
  outfit_retro: { hat: 'papercap', outfit: 'soda', face: 'mustache', pants: 0x262b44 },
  outfit_tuxedo: { hat: 'silkhat', outfit: 'tuxedo', face: 'monocle', back: 'tails', pants: 0x181425 },
  outfit_cyber: { hat: 'cyberhelmet', outfit: 'cyber', back: 'jetpack', pants: 0x262b44 },
};
const ownerLook = (state: StoreState): Look => {
  const outfit = activeDecor(state, 'outfit');
  return { ...OWNER, ...(outfit ? COSTUMES[outfit.id] : {}) };
};
const STAFF_HAIR: Record<StaffRole, HairStyle> = { cashier: 'long', cashier2: 'ponytail', cashier3: 'bun', cashier4: 'short', cleaner: 'short', loader: 'short', guard: 'cap', manager: 'short', baker: 'cap', barista: 'ponytail' };
/** На какой секунде дня приходит инспектор. */
const INSPECTOR_AT = 25;
/** Соня заходит после школы — на этой секунде дня. */
const SONYA_AT = 18;
/** Соня: каштановые волосы, сиреневая толстовка, жёлтый рюкзак (как на портрете, art/family.py). */
const SONYA: Look = { shirt: 0xffffff, skin: 0xf2d3ab, pants: 0x3a4466, hair: 0x8f563b, style: 'long', outfit: 'hoodie', outfitTint: 0x68386c, bag: 'backpack', bagTint: 0xfee761 };
/** Жюри конкурса приходит на этой секунде дня. */
const JURY_AT = 40;
/** Жюри: строгие костюмы, у одного портфель, у другого блокнот (как у инспектора). */
const JURY_LOOKS: Look[] = [
  { shirt: 0xffffff, skin: 0xf2d3ab, pants: 0x262b44, hair: 0xc0cbdc, outfit: 'suit', outfitTint: 0x3a4466, prop: 'briefcase', propTint: 0x733e39 },
  { shirt: 0xf6757a, skin: 0xeec39a, pants: 0x262b44, hair: 0x4a2c1a, style: 'long', outfit: 'suit', outfitTint: 0x68386c, face: 'sunglasses' },
  { shirt: 0xffffff, skin: 0xd9a066, pants: 0x181425, hair: 0x181425, outfit: 'suit', outfitTint: 0x265c42, prop: 'newspaper' },
];
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
  /** Друг из Telegram зашёл в гости (platform/multiplayer.ts → visits). */
  friend?: VisitFriend;
  wants?: ProductId[];
  /** Шоколадка со стойки и кофе — оплачиваются на кассе вместе с товаром. */
  extras?: { kind: 'candy' | 'coffee' | 'dish'; price: number }[];
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
  /** Противень для соседних магазинов (договор «Хлеб соседям»): не в зал, а на продажу. */
  forShops?: boolean;
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
  /** Где стоит: если после продажи соседней полки место сменилось — пересобираем. */
  at: { x: number; y: number };
  /** Чехол на ларе с мороженым не в сезон. */
  cover?: Phaser.GameObjects.Image;
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
  /** «⏳ −50%?»: на полке товар, который испортится ночью; нажать — уценить всё такое. */
  expire: Phaser.GameObjects.Text;
  /** Ценник «АКЦИЯ», если товар этой полки — товар дня. */
  promo: Phaser.GameObjects.Text;
  /** Подсветка: полка пустая, а на складе её товар есть — пора нести. */
  glow?: Phaser.FX.Glow;
  needsStock: boolean;
}

interface NightLight {
  obj: Phaser.GameObjects.Image | Phaser.GameObjects.Text | Phaser.GameObjects.Rectangle | Phaser.GameObjects.Ellipse;
  /** Яркость к ночи. */
  alpha: number;
  /** Неон зажигается с мерцанием; у одной вывески общее число — мигает вся разом. */
  neon?: number;
  /** С какой «вечерности» зажигается (окна домов загораются не разом). */
  from?: number;
  /** Мерцает (звёзды в пруду, светлячки): своя фаза. */
  twinkle?: number;
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
  /** Всплывающие надписи на экране: чтобы не налезали друг на друга и склеивались. */
  private popups: Popup[] = [];
  /** Табличка с порциями на кухне. */
  private kitchenLabel?: Phaser.GameObjects.Text;
  /** Чей магазин друга нарисован сбоку (торговая неделя). */
  private builtFriend?: string;
  /** Магазин босса района стоит за дорогой (на месте «Гиганта»), а не сбоку. */
  private rivalAcross = false;
  /** Каким построен «Гигант» за дорогой (giant.ts): стройка, магазин, закрытый. */
  private builtGiant: GiantLook = 'none';
  /** Какие здания района стояли, когда рисовали улицу (district.ts). */
  private builtDistrict = '';
  /** Снежные покрывала на крышах соседей: видны в снегопад. */
  private roofSnow: Phaser.GameObjects.Rectangle[] = [];
  /** Козни конкурента на улице сегодня (tricks.ts): промоутеры, перетяжки, их таймеры. */
  private trickObjs: Phaser.GameObjects.GameObject[] = [];
  private trickTimers: Phaser.Time.TimerEvent[] = [];
  /** Ночью у входа играет музыкант — ночных гостей больше (nightGuests.ts). */
  private busker = false;
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
  /** Дождь дня: капли, брызги, круги и лужи — разгоняется утром и в иные дни к вечеру кончается. */
  private rainFx?: { rain: Phaser.GameObjects.Particles.ParticleEmitter; splash: Phaser.GameObjects.Particles.ParticleEmitter; base: number; puddles: Phaser.GameObjects.Image[]; ripple?: Phaser.GameObjects.Particles.ParticleEmitter; sheen?: Phaser.GameObjects.Rectangle };
  /** Дождь сегодня уже кончился: зонты закрыты, лужи сохнут. */
  private rainStopped = false;
  /** Доля прошедшего дня (0 — утро, 1 — конец смены): солнце, туман, тени. */
  private dayProgress = 0;
  /** Мусорный контейнер на улице (его трясёт мусоровоз). */
  private dumpImg?: Phaser.GameObjects.Image;
  /** Пол блестит (мрамор): в нём отражаются полки. */
  private glossyFloor = false;
  /** Пруд в парке: рядом летают светлячки. */
  private parkPond?: { x: number; y: number };
  /** Солнечные пятна от окон на полу зала. */
  private sunPatches: Phaser.GameObjects.Image[] = [];
  /** Утренний туман над улицей и газонами. */
  private fogs: Phaser.GameObjects.Image[] = [];
  /** Табличка «Открыто / Закрыто» на двери. */
  private doorSign?: Phaser.GameObjects.Image;
  private lawns: { x: number; y: number; w: number; h: number }[] = [];
  private greenery: Phaser.GameObjects.Image[] = [];
  /** Снимок зала перед закрытием — для карточки итогов дня. */
  private dayShot: HTMLImageElement | null = null;
  private doorImg!: Phaser.GameObjects.Image;
  private vignette?: Phaser.FX.Vignette;
  /** Насколько вечер (0 — день, 1 — сумерки): фары машин горят сильнее. */
  private evening = 0;
  private indoorShades: Phaser.GameObjects.Rectangle[] = [];
  private lampGlows: Phaser.GameObjects.Image[] = [];
  private ceilingGlows: Phaser.GameObjects.Image[] = [];
  /** Ночные огни (витрины, лужи света, конусы фонарей, неон): сила растёт к вечеру. */
  private nightLights: NightLight[] = [];
  /** Неподвижные картинки мира (деревья, дома, клумбы) с их рамками — для отсечения за краем экрана. */
  private cullables: { obj: Phaser.GameObjects.GameObject & { cameraFilter: number }; box: Phaser.Geom.Rectangle }[] = [];
  /** Мир перестроен — список для отсечения собрать заново (на следующем кадре, когда всё уже на месте). */
  private cullDirty = true;
  /** Идёт перестановка полок: камера не ездит, полки — «призраки», которые тянут пальцем. */
  private arranging = false;
  /** Лёгкая графика: без виньетки и облаков (холст поменьше — со следующего запуска). */
  private lite = liteMode();
  /** Посекундные замеры FPS за день: медиана уходит в аналитику, при тормозах — лёгкая графика. */
  private fpsSamples: number[] = [];
  private fpsFrames = 0;
  private fpsMs = 0;
  private cullAt = '';
  /** Ночь между днями: какая доля окон в домах уже погасла (0 — все горят). */
  private lightsOut = 0;
  /** Стрелки настенных часов: идут по ходу смены с 8:00 до 20:00. */
  private clockHands?: Phaser.GameObjects.Graphics;
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
  /** Идёт захват магазина (особый день «ограбление»): новые покупатели не заходят. */
  private siege = false;
  /** Сколько противней сегодня испекли для соседних магазинов. */
  private wholesaleBaked = 0;
  /** Идёт ночная смена; уже спрашивали про неё сегодня. */
  private night = false;
  private nightAsked = false;
  /** Кот у входа: картинка, где его лежанка и гуляет ли он сейчас по залу. */
  private catImg?: Phaser.GameObjects.Image;
  /** Пёс Бобик у будки и таймер, который машет его хвостом. */
  private bobik?: Phaser.GameObjects.Image;
  private bobikWag?: Phaser.Time.TimerEvent;
  /** Магазин закрыт на ночь (роллеты опущены): Бобик сидит настороже, у двери — сторож. */
  private closed = false;
  /** Рабочий день идёт (от «Открыть магазин» до итогов) — для сторожа зависаний. */
  private dayOpen = false;
  /** Сколько мс день стоит без открытых окон — сторож запускает его дальше. */
  private stallMs = 0;
  private nightWatch: Phaser.GameObjects.GameObject[] = [];
  /** Сколько кубков стоит на прилавке; жюри конкурса сегодня: ждём, пришло, ушло. */
  private builtCup = 0;
  private jury: 'none' | 'pending' | 'here' | 'done' = 'none';
  /** Соня сегодня заглянет в магазин (сюжет «Папа и Соня»). */
  private sonya: 'none' | 'pending' | 'here' | 'done' = 'none';
  private catHome = { x: 0, y: 0 };
  private catOut = false;
  /** Флажки, шарики и лоток ярмарки; лоток продаёт со склада по таймеру. */
  private fairObjs: Phaser.GameObjects.GameObject[] = [];
  /** Особый день (bigday.ts): что на улице — марево, вода, шествие; убирается к вечеру. */
  private bigObjs: { destroy: () => void }[] = [];
  /** Блэкаут на весь район: темно, касса считает вручную (щиток не поможет). */
  private powerCut = false;
  /** Свадебный заказ: заберут вечером. */
  private wedding: WeddingOrder | null = null;
  private stall?: Phaser.GameObjects.Image;
  private stallTimer?: Phaser.Time.TimerEvent;
  /** Доставка на дом: телефон у кассы, текущий заказ, курьер с велосипедом. */
  private phone?: Phaser.GameObjects.Image;
  private order: { data: HomeOrder; bubble: Phaser.GameObjects.Container; timer: Phaser.Time.TimerEvent } | null = null;
  private courier?: Phaser.GameObjects.Container;
  private courierBike?: Phaser.GameObjects.Image;
  private courierHome = { x: 0, y: 0 };
  private courierBusy = false;
  /** Принятый заказ на дом ждёт, пока менеджер соберёт посылку и вынесет курьеру (деньги за заказ). */
  private parcel: number | null = null;
  /** Менеджер сейчас ходит по залу (а не стоит за кассой вместо кассира) — ему можно поручить посылку. */
  private managerOnFloor = false;
  /** Ускорение дня (×1 или ×2). */
  private speed = 1;

  constructor() {
    super('store');
  }

  create(): void {
    setErrorContext(() => ({ day: this.state?.day, level: this.state?.level, running: this.running, ua: navigator.userAgent.slice(0, 120) }));
    const save = loadGame();
    this.state = ensureRush(ensureSeason(ensurePlan(save ?? newGame()), trustedNow()), trustedNow());
    if (!save) track('new_game', 1);
    // Игра открылась — прогресс и накопленные события на сервер (рейтинг и аналитика).
    void reportProgress(this.state);
    // Своё расписание особых дней: зерно появляется у новой игры и у старых сохранений при первом запуске.
    if (!this.state.seed) this.state = { ...this.state, seed: 1 + Math.floor(Math.random() * 1e9) };
    setBigDaySeed(this.state.seed!);
    // Покупки за звёзды — по данным Telegram: вернутся и на новом телефоне.
    void restorePurchases().then((ids) => {
      const owned = (ids ?? []).filter(isDecorId);
      const next = grantPass(grantDecor(this.state, owned, !save), ids ?? []);
      if (next === this.state) return;
      this.state = next;
      saveGame(next);
      if (!save) this.buildWorld();
    });
    // Игрок на месте — бот не будет напоминать. Пришёл по приглашению друга — подарок новичку.
    void socialPing(getLang()).then((info) => {
      // Торговая неделя и гильдия: магазин друга появится на улице, если соперник есть.
      void loadMultiplayer().then(() => {
        if (!this.running && (this.rivalAcross || this.builtEduard === 'vacant') && duelInfo()?.rival?.name !== this.builtFriend) this.buildWorld();
      });
      if (!info?.welcome) return;
      this.state = { ...this.state, money: this.state.money + WELCOME_GIFT };
      saveGame(this.state);
      this.hud.update(this.state, this.timeLeft);
      toast('assets/ico_gift.png', t('social.welcome'), t('social.welcomeText', { n: WELCOME_GIFT }));
    });
    this.hud = new Hud();
    this.hud.onSpeed = () => this.running && this.setSpeed(this.speed > 1 ? 1 : 2);
    this.hud.onUrgent = () => this.openUrgent();

    this.buildWorld();
    this.hud.update(this.state, this.timeLeft);
    this.setupCameraDrag();
    // Улица живёт своей жизнью: прохожие и машины.
    this.time.addEvent({ delay: 1800, loop: true, callback: () => this.streetLife() });
    // Над кварталом плывут тени облаков, иногда пролетает стайка птиц.
    this.time.addEvent({ delay: 6000, loop: true, callback: () => this.skyLife() });
    // Живая очередь и продавец без дела: кто-то вздыхает, смотрит на часы, продавец протирает прилавок.
    this.time.addEvent({ delay: 1300, loop: true, callback: () => this.running && this.queueIdle() });
    this.time.addEvent({ delay: 4200, loop: true, callback: () => this.running && this.sellerIdle() });
    // Пока пахнет свежей выпечкой, из пекарни в зал тянутся волны запаха.
    this.time.addEvent({ delay: 650, loop: true, callback: () => this.running && this.time.now < this.aromaUntil && this.aromaWisp() });
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
    this.cullView();
    this.measureFps(deltaMs);
    this.watchStall(deltaMs);
    this.scarePigeons();
    ambience.update(this.rainStopped ? 'clear' : this.weather, this.evening, this.running, yearTime(this.state.day));
    this.updateRain();
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
    if (!this.night && this.jury === 'pending' && elapsed >= JURY_AT) void this.runJury();
    if (!this.night && this.sonya === 'pending' && elapsed >= SONYA_AT) void this.runSonya();

    if (this.timeLeft > 0) {
      this.nextSpawn -= dt;
      const maxCustomers = storeLevel(this.state).maxCustomers + (rush ? 3 : 0) + (isCrowdDay(this.state.day) && !this.night ? CROWD_EXTRA_GUESTS : 0);
      if (this.nextSpawn <= 0 && this.customers.size < maxCustomers && !this.siege) {
        this.spawnCustomer();
        const interval =
          spawnIntervalToday(this.state) / (rush ? 2 : 1) / (this.night ? NIGHT_GUESTS * bigDayNightGuests(this.state.day) * (this.busker ? BUSKER_GUESTS : 1) : 1);
        this.nextSpawn = interval * Phaser.Math.FloatBetween(0.7, 1.3);
      }
    } else if (this.customers.size === 0 && this.inspector !== 'here' && this.jury !== 'here' && this.sonya !== 'here') {
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
      if (this.registers.every((_, i) => this.operator(i) !== null)) {
        if (nextRegisterPrice(this.state) !== null) return t('hint.queueBuy');
        if ((nextRegisterCount(this.state) ?? 0) > registerSlots(this.state)) return t('hint.queueRegister');
      }
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
      if (index >= 0) return { x: this.spotOf(index).x, y: this.spotOf(index).y - 18 };
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
    this.cullDirty = true;
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
    this.clockHands = undefined;
    this.nightLights = [];
    this.trash.clear();
    // Своя расстановка мест под полки (placement.ts) — если игрок переставлял в этом помещении.
    this.layout = withSlots(layoutFor(this.state.level), this.state.slotPos, this.state.level);
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
    // Магазин шире, чем выше: если по высоте есть запас, камера подходит ближе (до HOME_ZOOM) —
    // люди и товар крупнее, флигель слева виден краем, а пустой газон над вывеской — нет.
    const fitW = CANVAS_W / viewW;
    const zoom = Math.min(fitW * HOME_ZOOM, (CANVAS_H - HUD_TOP - HUD_BOTTOM) / viewH);
    const midY = HUD_TOP + (CANVAS_H - HUD_TOP - HUD_BOTTOM) / 2;
    this.baseZoom = zoom;
    // Если по высоте есть запас, вывеска прижимается под верхнюю панель — снизу видно больше улицы.
    const centered = (h + 4) / 2 + (CANVAS_H / 2 - midY) / zoom;
    const signUnderHud = SIGN_TOP + (CANVAS_H / 2 - HUD_TOP) / zoom;
    // Правая стена — у края экрана; не влезает слева только часть флигеля.
    const homeX = Math.max((w - WING_OUTER) / 2, w + WALL + 2 - CANVAS_W / zoom / 2);
    this.home = { x: homeX, y: Math.max(centered, signUnderHud) };
    this.cameras.main.setZoom(zoom).centerOn(this.home.x, this.home.y);
    // Мягкая виньетка по краям кадра; к вечеру гуще.
    this.cameras.main.postFX?.clear();
    // Виньетка — лишний проход по всему экрану: в лёгкой графике без неё.
    this.vignette = this.lite ? undefined : this.cameras.main.postFX?.addVignette(0.5, 0.5, 0.95, 0.1);
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
    this.glossyFloor = ['floor3', 'floor_gold', 'floor_noir'].includes(floor);
    this.floorLight(w, h, wallH);
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
      .text(w / 2, -9, this.shopTitle(), {
        fontFamily: UI_FONT,
        fontSize: '7px',
        color: `#${signColor.toString(16).padStart(6, '0')}`,
      })
      .setOrigin(0.5)
      .setResolution(4)
      .setDepth(3);
    this.neonSign(w / 2, -9, this.shopTitle(), '7px', signColor, 64);
    if (!sign) this.signLights(w / 2, -9);
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
    this.seller = this.makePerson(home.x, home.y, ownerLook(this.state));
    // Кибер-продавец светится неоном.
    if (activeDecor(this.state, 'outfit')?.id === 'outfit_cyber') this.seller.postFX?.addGlow(0x2ce8f5, 2, 0, false, 0.1, 6);
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
    const { queue } = this.layout;
    const { left, ...at } = registerSpot(this.layout, index);
    const row = Math.floor(index / 2);
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
    // Флигель светится так же, как зал: в каждой открытой комнате и на складе — свой плафон.
    for (const room of this.openRooms()) {
      this.ceilingGlows.push(glow(room.x + room.w / 2, room.y + room.h / 2 + 4, Math.max(room.w, room.h) * 1.3, 0xfff0c8));
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
      for (const img of (person.getData('upper') as Phaser.GameObjects.Image[]) ?? []) img.y = bob + ((img.getData('dy') as number | undefined) ?? 0);
      const umbrella = person.getData('umbrella') as Phaser.GameObjects.Image | undefined;
      // Зонт раскрывается на выходе из магазина и закрывается, когда дождь кончился.
      const open = person.y > this.layout.h + 2 && !this.rainStopped;
      if (umbrella && umbrella.visible !== open) {
        umbrella.setVisible(open);
        if (open) {
          umbrella.setScale(umbrella.scaleX, 0.1 / ART);
          this.tweens.add({ targets: umbrella, scaleY: 1 / ART, duration: 220, ease: 'Back.easeOut' });
        }
      }
      this.lampShadow(person);
    }
  }

  /** Вечером на улице тень вытягивается в сторону от ближайшего фонаря. */
  private lampShadow(person: Phaser.GameObjects.Container): void {
    const shadow = person.getData('shadow') as Phaser.GameObjects.Image | undefined;
    if (!shadow) return;
    // Днём тень поворачивается вслед за солнцем: утром — вправо, к вечеру — влево.
    let lean = this.evening > 0 ? 0 : (0.45 - this.dayProgress) * 4;
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
    // Нашёл — улыбается, полка пустая — хмурится.
    this.setMood(c.sprite, id ? 'happy' : 'frown', id ? 1400 : 1200);
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
    for (const view of this.shelfViews) this.glowOn(view.bg, view.glow, view.needsStock ? pulse : 0);
    for (const piece of this.trash) this.glowOn(piece, piece.getData('glow') as Phaser.FX.Glow | undefined, pulse);
    if (this.binImg) this.glowOn(this.binImg, this.binGlow, this.binFull() && !this.binBusy ? pulse : 0);
    if (this.fuseBox) this.glowOn(this.fuseBox, this.fuseGlow, this.blackout ? pulse : 0);
  }

  /**
   * Подсветка «нажми сюда». Погасшую выключаем целиком: даже с нулевой силой эффект перерисовывал
   * объект через отдельный буфер каждый кадр — на телефоне это заметно садило FPS.
   */
  private glowOn(obj: Phaser.GameObjects.Image, glow: Phaser.FX.Glow | undefined, strength: number): void {
    if (!glow || !obj.preFX) return;
    if (strength > 0) {
      if (!obj.preFX.enabled) obj.preFX.enable();
      glow.outerStrength = strength;
    } else if (obj.preFX.enabled) obj.preFX.disable();
  }

  /** Двери разъезжаются, когда к ним подходят. */
  private updateDoor(): void {
    const { door, h } = this.layout;
    const near = [...this.customers].some((c) => Math.abs(c.sprite.x - door.x) < 16 && Math.abs(c.sprite.y - h - 4) < 18);
    if (near && this.doorOpen === 0) ambience.chime();
    this.doorOpen = Phaser.Math.Clamp(this.doorOpen + (near ? 0.12 : -0.06), 0, 1);
    const key = this.doorOpen < 0.34 ? 'door' : this.doorOpen < 0.67 ? 'door_half' : 'door_open';
    if (this.doorImg.texture.key !== key) this.doorImg.setTexture(key);
    // В снегопад в открытые двери залетают снежинки и тают у входа.
    if (this.weather === 'snow' && this.doorOpen > 0.6 && Math.random() < 0.3) {
      const flake = this.art(door.x + Phaser.Math.Between(-8, 8), h + 6, 'snowflake').setScale(1.4 / ART).setDepth(h + 4);
      this.tweens.add({
        targets: flake,
        x: flake.x + Phaser.Math.Between(-6, 6),
        y: h - Phaser.Math.Between(8, 22),
        alpha: 0,
        duration: Phaser.Math.Between(700, 1200),
        ease: 'Sine.easeOut',
        onComplete: () => flake.destroy(),
      });
    }
  }

  /** Название на вывеске: своё, если игрок назвал магазин, иначе — по помещению. */
  private shopTitle(): string {
    return this.state.shopName?.trim() || t(storeLevel(this.state).nameKey);
  }

  /**
   * Перестановка полок утром: зал целиком в кадре, каждое место под полку — «призрак», который тянут
   * пальцем по сетке. Место, куда ставить нельзя (вплотную к проходу, на кассе, у двери, так, что к
   * полке не подойти), — красное; «Готово» — только когда красных нет.
   */
  private arrange(): void {
    if (this.arranging) return;
    this.arranging = true;
    const { w, h } = this.layout;
    const defaults = layoutFor(this.state.level).slots;
    let at = this.layout.slots.map((p) => ({ ...p }));
    // Настоящие полки и разметку прячем — вместо них «призраки».
    for (const view of this.shelfViews.splice(0)) this.destroyShelfView(view);
    for (const mark of this.slotDecor) mark?.setVisible(false);
    const cam = this.cameras.main;
    cam.setZoom(Math.min(CANVAS_W / (w + 24), (CANVAS_H - HUD_TOP - 120 * RES) / (h + 24))).centerOn(w / 2, h / 2 + 10);
    const grid = this.add.graphics().setDepth(LIGHT_DEPTH + 10);
    grid.lineStyle(0.4, 0x2b2233, 0.18);
    for (let x = 0; x <= w; x += 8) grid.lineBetween(x, this.layout.wallH, x, h);
    for (let y = this.layout.wallH; y <= h; y += 8) grid.lineBetween(0, y, w, y);
    // Какая полка в каком месте: обычные полки занимают места по порядку покупки.
    const kinds = this.state.shelves.filter((sh) => !SHELF_KINDS[sh.kind].fixture).map((sh) => sh.kind);
    const ghosts = at.map((p, i) => {
      const kind = kinds[i];
      const look = kind ? SHELF_LOOK[kind] : null;
      const img = look ? this.art(0, -FURNITURE_TOP / 2, look.texture).setTint(look.tint) : this.art(0, 2, 'slot_empty');
      const frame = this.add.graphics();
      const ghost = this.add.container(p.x, p.y, [img, frame]).setDepth(LIGHT_DEPTH + 11);
      ghost.setSize(44, 30);
      ghost.setInteractive({ draggable: true, useHandCursor: true });
      ghost.setData('frame', frame);
      return ghost;
    });
    const bar = el('div', 'ui-arrange');
    const hint = el('div', 'ui-arrange-hint', t('arrange.hint'));
    const done = button(t('arrange.done'), () => finish(true), 'ui-btn');
    const reset = button(t('arrange.reset'), () => {
      at = defaults.map((p) => ({ ...p }));
      ghosts.forEach((g, i) => g.setPosition(at[i].x, at[i].y));
      check();
    }, 'ui-btn secondary');
    const cancel = button(t('arrange.cancel'), () => finish(false), 'ui-btn secondary');
    const row = el('div', 'ui-arrange-row');
    row.append(cancel, reset, done);
    bar.append(hint, row);
    document.body.append(bar);
    const check = () => {
      const bad = slotIssues(this.layout, at, defaults, registerSlots(this.state));
      ghosts.forEach((g, i) => {
        const frame = g.getData('frame') as Phaser.GameObjects.Graphics;
        const r = bodyRect({ x: 0, y: 0 });
        frame.clear();
        frame.fillStyle(bad.has(i) ? 0xe43b44 : 0x63c74d, 0.28).fillRect(r.x, r.y, r.w, r.h);
        frame.lineStyle(1, bad.has(i) ? 0xe43b44 : 0x3e8948, 1).strokeRect(r.x, r.y, r.w, r.h);
      });
      // Ларь ищет место сам — после перестановки ему должно найтись место у стены.
      const iceless = this.state.shelves.some((sh) => sh.kind === 'icebox') && !iceboxFits(this.layout, at);
      done.disabled = bad.size > 0 || iceless;
      hint.textContent = bad.size ? t('arrange.bad', { n: bad.size }) : iceless ? t('arrange.icebox') : t('arrange.hint');
      return iceless ? new Set([...bad, -1]) : bad;
    };
    const onDrag = (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject, x: number, y: number) => {
      const i = ghosts.indexOf(obj as Phaser.GameObjects.Container);
      if (i < 0) return;
      at[i] = { x: Phaser.Math.Clamp(snap(x), 22, w - 22), y: Phaser.Math.Clamp(snap(y), this.layout.wallH + 12, h - 28) };
      ghosts[i].setPosition(at[i].x, at[i].y).setDepth(LIGHT_DEPTH + 12);
      check();
    };
    const onDragEnd = (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
      (obj as Phaser.GameObjects.Container).setDepth?.(LIGHT_DEPTH + 11);
      haptic.tap();
    };
    this.input.on('drag', onDrag);
    this.input.on('dragend', onDragEnd);
    check();
    const finish = (save: boolean) => {
      if (save && check().size) return;
      this.input.off('drag', onDrag);
      this.input.off('dragend', onDragEnd);
      bar.remove();
      grid.destroy();
      ghosts.forEach((g) => g.destroy());
      this.arranging = false;
      if (save) {
        this.state = { ...this.state, slotPos: slotPosFor(this.state.level, at) };
        saveGame(this.state);
        track('arrange', this.state.day, at.length);
      }
      // Всё пересобираем по новым местам (обход, ларь, растения) и возвращаемся к утру.
      this.buildWorld();
      this.showMorning();
    };
  }

  /**
   * Отсечение: то, что не двигается и сейчас за краем экрана, камера не рисует (через cameraFilter —
   * собственную видимость объектов не трогаем). В большом магазине за кадром ~800 деревьев, кустов
   * и домов — на слабом телефоне это треть времени отрисовки.
   */
  private cullView(): void {
    const cam = this.cameras.main;
    if (this.cullDirty) {
      this.cullDirty = false;
      this.cullAt = '';
      // Люди и звери (контейнеры, кот, Бобик) ходят, частицы летают — их не трогаем.
      const moving = new Set<unknown>([this.catImg, this.bobik]);
      this.cullables = [];
      for (const obj of this.children.list) {
        if (obj.type === 'Container' || obj.type === 'ParticleEmitter' || moving.has(obj)) continue;
        const shape = obj as unknown as Phaser.GameObjects.Components.GetBounds & { cameraFilter: number };
        if (typeof shape.getBounds !== 'function') continue;
        this.cullables.push({ obj: obj as Phaser.GameObjects.GameObject & { cameraFilter: number }, box: shape.getBounds() });
      }
    }
    // Пересчитываем, только когда камера сдвинулась или приблизилась.
    const key = `${Math.round(cam.scrollX)}|${Math.round(cam.scrollY)}|${cam.zoom.toFixed(3)}|${this.cullables.length}`;
    if (key === this.cullAt) return;
    this.cullAt = key;
    const margin = 24;
    const v = cam.worldView;
    const view = new Phaser.Geom.Rectangle(v.x - margin, v.y - margin, v.width + margin * 2, v.height + margin * 2);
    for (const c of this.cullables) {
      if (!c.obj.active) continue;
      c.obj.cameraFilter = Phaser.Geom.Rectangle.Overlaps(view, c.box) ? 0 : cam.id;
    }
  }

  /**
   * FPS по секундам, пока идёт день и вкладка на экране. Если игра заметно тормозит (медиана меньше
   * LITE_FPS за полминуты) — включаем лёгкую графику и один раз говорим об этом.
   */
  private measureFps(deltaMs: number): void {
    // Свернули вкладку или окно утра поверх — такие кадры не в счёт.
    if (!this.running || document.hidden || deltaMs > 250) {
      this.fpsFrames = 0;
      this.fpsMs = 0;
      return;
    }
    this.fpsFrames++;
    this.fpsMs += deltaMs;
    if (this.fpsMs < 1000) return;
    this.fpsSamples.push((this.fpsFrames * 1000) / this.fpsMs);
    if (this.fpsSamples.length > 600) this.fpsSamples.shift();
    this.fpsFrames = 0;
    this.fpsMs = 0;
    if (this.lite || this.fpsSamples.length < 30) return;
    const summary = fpsSummary(this.fpsSamples.slice(-30));
    if (!summary || summary.median >= LITE_FPS) return;
    this.lite = true;
    setLiteMode(true);
    track('lite_auto', this.state.day, summary.median);
    if (this.vignette) this.cameras.main.postFX?.remove(this.vignette);
    this.vignette = undefined;
    toast('assets/ico_phone.png', t('lite.autoTitle'), t('lite.autoText'));
  }

  /** Оттенок по ходу дня: тёплое утро, белый день, закат, сумерки. */
  private updateLighting(progress?: number): void {
    if (!this.indoorShades.length) return;
    const p = progress ?? Phaser.Math.Clamp(1 - this.timeLeft / DAY_SECONDS, 0, 1);
    const outdoor = mulColor(lerpKeys(this.weather === 'snow' ? SNOW_OUTDOOR_LIGHT : OUTDOOR_LIGHT, p), WEATHER_LIGHT[this.weather]);
    // Свет отключили — в зале полумрак.
    const indoor = this.blackout || this.powerCut ? mulColor(lerpKeys(INDOOR_LIGHT, p), 0x45456a) : lerpKeys(INDOOR_LIGHT, p);
    for (const r of this.outdoorShades) r.setFillStyle(outdoor);
    for (const r of this.indoorShades) r.setFillStyle(indoor);
    // Днём светло; вечер — последняя четверть смены: фонари, неон, тёплый свет.
    const evening = Phaser.Math.Clamp((p - EVENING_FROM) / (1 - EVENING_FROM), 0, 1);
    this.evening = evening;
    music.setMood(evening > 0.5 ? 'evening' : 'day');
    if (this.vignette) {
      this.vignette.strength = 0.1 + 0.4 * evening;
      this.vignette.radius = 0.95 - 0.12 * evening;
    }
    for (const g of this.lampGlows) g.setAlpha(0.7 * evening);
    for (const g of this.ceilingGlows) g.setAlpha(this.blackout || this.powerCut ? 0 : 0.06 + 0.16 * evening);
    for (const bat of this.bats) bat.setAlpha(Phaser.Math.Clamp(evening * 1.5, 0, 1));
    const now = this.time.now;
    for (const light of this.nightLights) {
      let alpha = light.alpha * evening;
      // Неон зажигается не сразу: пару секунд мигает.
      if (light.neon !== undefined && evening < 0.18) alpha *= Math.sin((now + light.neon) / 41) + Math.sin((now + light.neon) / 97) > 0 ? 1 : 0.2;
      // Окна в домах вокруг загораются по одному.
      if (light.from !== undefined) alpha *= Phaser.Math.Clamp((evening - light.from) / 0.08, 0, 1);
      // Глубокой ночью окна гаснут по одному — в том же порядке, в каком зажигались.
      if (light.from !== undefined && this.lightsOut > light.from * 1.6) alpha = 0;
      if (light.twinkle !== undefined) alpha *= 0.55 + 0.45 * Math.sin(now / 260 + light.twinkle);
      light.obj.setAlpha(alpha);
    }
    this.dayProgress = p;
    this.updateDaylight(p);
    this.drawClock(p);
  }

  /** Часы на стене: часовая стрелка проходит 8:00 → 20:00, минутная крутится каждый час. */
  private drawClock(p: number): void {
    const g = this.clockHands;
    if (!g?.active) return;
    const hours = 8 + 12 * p;
    const hour = (hours / 12) * Math.PI * 2 - Math.PI / 2;
    const minute = (hours % 1) * Math.PI * 2 - Math.PI / 2;
    g.clear();
    g.lineStyle(0.7, 0x262b44, 1);
    g.lineBetween(0, 0, Math.cos(minute) * 2.6, Math.sin(minute) * 2.6);
    g.lineStyle(0.9, 0x181425, 1);
    g.lineBetween(0, 0, Math.cos(hour) * 1.7, Math.sin(hour) * 1.7);
    g.fillStyle(0xe43b44, 1).fillRect(-0.4, -0.4, 0.8, 0.8);
  }

  /**
   * Свет дня: утром из окон на пол падают солнечные пятна и ползут за солнцем, к полудню гаснут;
   * утренний туман рассеивается. Тени людей поворачиваются вслед за солнцем (lampShadow).
   */
  private updateDaylight(p: number): void {
    const sunny = this.weather === 'clear' || this.weather === 'heat' || this.weather === 'leaves';
    const sun = Phaser.Math.Clamp(1 - p / 0.55, 0, 1) * (sunny ? 1 : 0.25) * (this.blackout || this.powerCut ? 1 : 1);
    for (const patch of this.sunPatches) {
      if (!patch.active) continue;
      patch.setAlpha(0.42 * sun);
      patch.x = (patch.getData('x') as number) + (p - 0.2) * 24;
      patch.setAngle(-24 + p * 50);
    }
    const fog = Phaser.Math.Clamp(1 - p / 0.22, 0, 1);
    for (const f of this.fogs) if (f.active) f.setAlpha(0.7 * fog);
  }

  /** Много мелких цветных квадратиков — одной картинкой (вдвое чётче мира, чтобы не мылились). */
  private bakeSpots(list: { x: number; y: number; size: number; color: number }[]): Phaser.GameObjects.RenderTexture {
    const K = 2;
    const minX = Math.min(...list.map((p) => p.x - p.size / 2)) - 1;
    const minY = Math.min(...list.map((p) => p.y - p.size / 2)) - 1;
    const maxX = Math.max(...list.map((p) => p.x + p.size / 2)) + 1;
    const maxY = Math.max(...list.map((p) => p.y + p.size / 2)) + 1;
    const g = this.make.graphics({}, false);
    for (const p of list) g.fillStyle(p.color, 1).fillRect((p.x - p.size / 2 - minX) * K, (p.y - p.size / 2 - minY) * K, p.size * K, p.size * K);
    const rt = this.add.renderTexture(minX, minY, Math.ceil((maxX - minX) * K), Math.ceil((maxY - minY) * K)).setOrigin(0).setScale(1 / K);
    rt.draw(g);
    g.destroy();
    return rt;
  }

  /**
   * Погода дня: дождь с брызгами и зонтами, снег (белый газон, гирлянда на фасаде, ёлка в зале),
   * листопад (рыжие деревья). Частицы падают только снаружи: здание рисуется поверх них.
   */
  private applyWeather(): void {
    this.cullDirty = true;
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
    const tree = this.weather === 'leaves' ? 0xffb868 : 0xffffff;
    this.roofSnow = this.roofSnow.filter((r) => r.active);
    for (const r of this.roofSnow) r.setVisible(this.weather === 'snow');
    for (const g of this.greenery) {
      // В снег — деревья и кусты в снежных шапках (tree_snow, bush_snow).
      const base = (g.getData('base') as string | undefined) ?? g.texture.key;
      g.setData('base', base);
      const snowy = `${base}_snow`;
      g.setTexture(this.weather === 'snow' && this.textures.exists(snowy) ? snowy : base).setTint(tree);
    }

    this.rainFx = undefined;
    this.rainStopped = false;
    if (isWet(this.weather)) {
      const storm = this.weather === 'storm';
      const rain = keep(this.add.particles(0, 0, 'raindrop', {
        x: { min: area.x, max: area.x + area.w },
        y: area.y,
        speedY: { min: 240, max: 300 },
        speedX: storm ? -60 : -30,
        scale: 1 / ART,
        lifespan: (area.h / 260) * 1000,
        quantity: storm ? 4 : 3,
        frequency: storm ? 18 : 25,
      })).setDepth(-5);
      this.rainFx = { rain, splash: rain, base: storm ? 18 : 25, puddles: [] };
      this.wetStreet(keep);
      if (storm) this.lightning(keep);
      this.rainFx.splash = keep(this.add.particles(0, 0, 'splash', {
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
        scale: { min: 1.2 / ART, max: 2.2 / ART },
        lifespan: (area.h / 18) * 1000,
        quantity: 2,
        frequency: 30,
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
    this.weatherExtras(keep);
    this.applySeason(keep);
    this.updateLighting(this.running ? undefined : 0);
  }

  /**
   * Погода с настроением: в иные утра над улицей стелется туман, осенью у бордюров кучи листьев,
   * летними вечерами у пруда светлячки.
   */
  private weatherExtras(keep: <T extends Phaser.GameObjects.GameObject>(obj: T) => T): void {
    const { h } = this.layout;
    const next = this.next;
    this.fogs = [];
    const rnd = new Phaser.Math.RandomDataGenerator([`mood${this.state.day}`]);
    if (this.weather !== 'heat' && this.weather !== 'storm' && this.state.day % 3 === 1) {
      for (let i = 0; i < 16; i++) {
        const fog = keep(this.art(-200 + rnd.frac() * (next.w + 400), h + 20 + rnd.frac() * 320, 'glow'))
          .setDisplaySize(rnd.between(220, 340), rnd.between(70, 110))
          .setTint(0xf4f6ff)
          .setAlpha(0)
          .setDepth(LIGHT_DEPTH + 2);
        this.tweens.add({ targets: fog, x: fog.x + rnd.between(30, 60), duration: rnd.between(14000, 22000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.fogs.push(fog);
      }
    }
    if (this.weather === 'leaves') {
      const tones = [0xf77622, 0xfeae34, 0xb86f50, 0xe43b44];
      for (let i = 0; i < 16; i++) {
        const cx = -160 + rnd.frac() * (next.w + 320);
        const cy = rnd.pick([this.streetY - 6, this.streetY + 6, next.h + 4 + 88, next.h + 4 + 92]);
        for (let k = 0; k < 7; k++) {
          keep(this.art(cx + rnd.between(-5, 5), cy + rnd.between(-2, 2), 'leaf'))
            .setScale(1.5 / ART)
            .setAngle(rnd.between(0, 359))
            .setTint(rnd.pick(tones))
            .setDepth(-8.5);
        }
      }
    }
    const pond = this.parkPond;
    if (pond && yearTime(this.state.day) === 'summer' && !isWet(this.weather)) {
      for (let i = 0; i < 12; i++) {
        const fly = keep(this.art(pond.x + rnd.between(-90, 90), pond.y + rnd.between(-50, 40), 'glow')).setScale(11 / 64).setTint(0xd8ff7a);
        this.nightGlow(fly, 0.9, undefined, { twinkle: i * 2.3 });
        this.tweens.add({ targets: fly, x: fly.x + rnd.between(-16, 16), y: fly.y + rnd.between(-10, 10), duration: rnd.between(2400, 4200), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    }
  }

  /** После дождя над районом на полминуты встаёт радуга. */
  private rainbow(): void {
    const cx = this.layout.door.x;
    const cy = this.next.h + 4 + 330;
    const g = this.add.graphics().setDepth(LIGHT_DEPTH + 2).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    [0xe43b44, 0xf77622, 0xfee761, 0x63c74d, 0x0099db, 0x68386c].forEach((color, i) => {
      g.lineStyle(5, color, 1);
      g.beginPath();
      g.arc(cx, cy, 250 - i * 5, Math.PI * 1.08, Math.PI * 1.92);
      g.strokePath();
    });
    this.weatherObjs.push(g);
    this.tweens.add({ targets: g, alpha: 0.32, duration: 4000, hold: 26000, yoyo: true, onComplete: () => g.destroy() });
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
    // Лиственные деревья (ель осенью не желтеет и весной не цветёт).
    const trees = this.greenery.filter((g) => ['tree', 'tree_round', 'tree_birch'].includes((g.getData('base') as string | undefined) ?? g.texture.key));
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
    // Пятна листвы и цвета на кронах — тысячи крошечных квадратиков. Отдельными объектами они съедали
    // кадр на телефоне, поэтому рисуем их один раз в картинку (по одной на слой глубины).
    const spots = new Map<number, { x: number; y: number; size: number; color: number }[]>();
    const spot = (depth: number, x: number, y: number, size: number, color: number) => {
      if (!spots.has(depth)) spots.set(depth, []);
      spots.get(depth)!.push({ x, y, size, color });
    };
    if (this.weather !== 'leaves' && this.weather !== 'snow') {
      trees.forEach((tree, i) => {
        // Осенью кроны в рыжих и жёлтых пятнах листвы.
        if (time === 'autumn') {
          tree.setTint(i % 3 === 2 ? 0xffffff : 0xffe0a0);
          const tones = i % 3 === 2 ? [0xfeae34] : [0xf77622, 0xfeae34, 0xfee761, 0xe43b44];
          for (let n = 0; n < (i % 3 === 2 ? 5 : 22); n++) spot(tree.depth + 0.5, tree.x + rnd.between(-9, 9), tree.y - rnd.between(5, 24), 2.4, rnd.pick(tones));
        }
        // Весной кроны в розово-белом цвету.
        if (time === 'spring') {
          for (let n = 0; n < 14; n++) spot(tree.depth + 0.5, tree.x + rnd.between(-9, 9), tree.y - rnd.between(5, 24), 1.6, rnd.pick([0xffd2e2, 0xffffff, 0xf6a5c0]));
        }
      });
    }
    for (const [depth, list] of spots) keep(this.bakeSpots(list).setDepth(depth));
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

  /**
   * Мелочи большого зала (когда кассы уже стоят): наклейки «стойте здесь» на местах очереди
   * и растения в кадках вдоль правой стены и в нижнем левом углу. Кадки — препятствия:
   * их обходят и покупатели, и продавец.
   */
  private buildHallDecor(): void {
    const { w, h, wallH, queue } = this.layout;
    const marks = [...this.registers.map((r) => r.spot.y)];
    const top = (marks.length ? Math.min(...marks) : queue.y + queue.step) - queue.step;
    for (let i = 0; i < 6 && top - i * queue.step >= queue.minY; i++) marks.push(top - i * queue.step);
    for (const y of marks) this.art(queue.x, y + 7, 'queue_mark').setAlpha(0.85).setDepth(1);
    if (this.state.level < 2) return;
    const clerks = this.registers.map((r) => r.clerk);
    const free = (x: number, y: number) =>
      this.obstacles.every((o) => x < o.x - 10 || x > o.x + o.w + 10 || y < o.y - 12 || y > o.y + o.h + 12) &&
      clerks.every((c) => Math.hypot(c.x - x, c.y - y) > 22);
    const spots: { x: number; y: number }[] = [];
    for (let y = wallH + 116; y < h - 70; y += 46) spots.push({ x: w - 9, y });
    const ice = this.iceboxSpot();
    if (ice.x >= 36) spots.push({ x: 12, y: h - 14 });
    const big = Boolean(activeDecor(this.state, 'plants'));
    spots.forEach((p, i) => {
      if (!free(p.x, p.y)) return;
      this.art(p.x, p.y + 3, 'shadow').setScale(0.7 / ART).setDepth(p.y - 1);
      this.art(p.x, p.y, big || i % 2 ? 'plant_big' : 'plant').setDepth(p.y + 6);
      this.obstacles.push({ x: p.x - 7, y: p.y - 10, w: 14, h: 14 });
    });
  }

  /** Терминал на прилавке и касса самообслуживания у правой стены — если куплены. */
  private buildUpgrades(): void {
    const { counter, w, wallH } = this.layout;
    if (hasUpgrade(this.state, 'terminal')) this.art(counter.x + 3, counter.y - 4, 'card_terminal').setDepth(counter.y + 22);
    for (let i = 1; i < registerCount(this.state); i++) this.buildRegister(i);
    this.buildHallDecor();
    this.buildGearProps();
    this.buildCoffee();
    this.buildOven();
    this.buildRadio();
    this.buildCup();
    this.buildDelivery();
    this.kiosk = undefined;
    this.kioskBusy = false;
    if (!hasUpgrade(this.state, 'selfCheckout')) return;
    const at = { x: w - 8, y: wallH + 86 };
    this.kiosk = this.art(at.x, at.y, 'kiosk').setDepth(at.y + 9);
    this.kioskScreen = this.add.rectangle(at.x, at.y - 9, 6, 4, 0x2ce8f5).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3).setDepth(at.y + 10);
    this.obstacles.push({ x: at.x - 7, y: at.y - 12, w: 14, h: 16 });
  }

  /** Кубок последнего выигранного конкурса — на прилавке, слегка поблёскивает. */
  private buildCup(): void {
    const wins = contestOf(this.state)?.wins ?? 0;
    this.builtCup = wins;
    if (!wins) return;
    const { counter } = this.layout;
    const cup = this.art(counter.x - 11, counter.y - 3, `cup_${tierKey(wins - 1)}`).setOrigin(0.5, 1).setDepth(counter.y + 22);
    const glint = this.add.rectangle(cup.x - 2, cup.y - 9, 1, 1, 0xffffff).setDepth(cup.depth + 1).setAlpha(0);
    this.tweens.add({ targets: glint, alpha: { from: 0, to: 1 }, scale: { from: 1, to: 2.5 }, duration: 300, yoyo: true, repeat: -1, repeatDelay: 2600 });
  }

  /** Радио на автомате с напитками — подальше от кассы, чтобы не задеть, пока пробиваешь. Касание переключает волну. */
  private buildRadio(): void {
    this.radioTimer?.remove();
    this.radioTimer = undefined;
    music.setStation(null);
    if (!hasRadio(this.state)) return;
    const { w, wallH } = this.layout;
    const at = { x: w - 8, y: wallH + 41 };
    const radio = this.art(at.x, at.y, 'radio').setDepth(wallH + 67);
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
    if (this.order || this.courierBusy || this.parcel !== null) {
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
    // Менеджер на месте — он соберёт посылку и вынесет её курьеру к входу; иначе курьер едет сразу.
    if (this.managerOnFloor) {
      this.parcel = order.data.pay;
      this.popup(phone.x, phone.y - 14, t('popup.orderPack'), '#c8ffb0');
      return;
    }
    this.popup(phone.x, phone.y - 14, t('popup.orderGo'), '#c8ffb0');
    void this.rideCourier(order.data.pay);
  }

  /** Менеджер собирает посылку на складе, несёт к входу и отдаёт курьеру — тот уезжает с заказом. */
  private async packParcel(w: Worker, gen: number): Promise<void> {
    const pay = this.parcel;
    if (pay === null) return;
    const { warehouse, door } = this.layout;
    await this.workerWalk(w, warehouse.doorway.x, warehouse.doorway.y);
    await this.workerWait(w, 900);
    if (!this.alive(gen)) return;
    w.carried.setTexture('box').setPosition(0, 3).setVisible(true);
    this.popup(w.sprite.x, w.sprite.y - 18, t('popup.parcel'), '#fff3b0');
    // К входу; курьер подходит с улицы навстречу.
    const courier = this.courier;
    if (courier?.active) void this.walk(courier, door.x + 10, door.y + 8, 40);
    await this.workerWalk(w, door.x, door.y - 8);
    await this.workerWait(w, 500);
    if (!this.alive(gen)) return;
    w.carried.setVisible(false);
    this.parcel = null;
    this.popup(door.x, door.y - 22, t('popup.parcelGiven'), '#c8ffb0');
    if (courier?.active) await this.walk(courier, this.courierHome.x, this.courierHome.y, 40);
    void this.rideCourier(pay);
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
    // Столики (улучшение): ещё два столика у окна — за ними пьют кофе.
    if (hasUpgrade(this.state, 'coffeeTables')) for (const tx of [12, 30]) this.art(x + tx, y + 52, 'cafe_table').setDepth(y + 58);
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
  private startOven(product: ProductId = 'bread', forShops = false): void {
    const oven = this.oven;
    if (!oven || oven.state !== 'idle') return;
    // Хлеб для соседей уходит не на полки — место в зале ему не нужно, только деньги на муку.
    const next = forShops
      ? this.state.money >= ovenBatchCost(this.state) ? { ...this.state, money: this.state.money - ovenBatchCost(this.state) } : null
      : product === 'bread' ? startBatch(this.state) : startBrandBatch(this.state, product);
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
    oven.forShops = forShops;
    if (forShops) this.wholesaleBaked++;
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
    if (oven.fx) this.glowOn(oven.img, oven.fx, 0);
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
        const forShops = oven.forShops;
        this.resetOven();
        if (forShops) {
          // Противень для соседей — в ящик у двери пекарни, курьер заберёт; деньги сразу.
          await this.workerWalk(w, room.inside.x, room.inside.y);
          if (!this.alive(gen)) return;
          const sold = sellWholesale(this.state);
          this.state = sold.state;
          this.stats.revenue += sold.pay;
          sound.coin();
          this.popup(room.inside.x + 10, room.inside.y - 14, t('popup.wholesale', { n: ovenBatch(this.state), pay: sold.pay }), '#c8ffb0');
          this.hud.update(this.state, this.timeLeft);
          continue;
        }
        w.carried.setTexture('bread_tray').setPosition(0, 1).setVisible(true);
        const index = this.breadShelfIndex(product);
        const slot = index >= 0 ? this.spotOf(index) : null;
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
      // Сначала хлеб для зала (по режиму пекарни); когда хватает — своя выпечка; потом — заказ соседей.
      const dayLeft = this.timeLeft / DAY_SECONDS;
      const next = oven.state === 'idle' ? (bakerShouldBake(this.state, dayLeft) ? 'bread' : brandToBake(this.state, dayLeft)) : null;
      const forShops = oven.state === 'idle' && !next && wholesaleToBake(this.state, this.wholesaleBaked);
      if (next || forShops) {
        await this.workerWalk(w, atOven.x, atOven.y);
        if (!this.alive(gen)) return;
        this.startOven(next ?? 'bread', forShops);
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
      if (oven.fx) this.glowOn(oven.img, oven.fx, 2 + 2 * Math.sin(now / 120));
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
    // Ночная история с выбором (nightGuests.ts) — где-то в первой половине смены.
    this.busker = false;
    const story = nightStory(Math.random);
    if (story && (story !== 'studentDebt' || debtProduct(this.state))) {
      this.trickTimers.push(this.time.delayedCall(NIGHT_SECONDS * 1000 * Phaser.Math.FloatBetween(0.12, 0.45), () => this.running && this.night && void this.runNightStory(story)));
    }
  }

  /** Ночной гость с историей: встаёт у кассы с «!», нажми — выбор; не ответил — уходит. */
  private async runNightStory(story: NightStoryId): Promise<void> {
    const { door, sellerHome } = this.layout;
    const start = this.streetSpawn();
    const sprite = this.makePerson(start.x, start.y, nightGuestLook(STORY_GUEST[story]));
    await this.walk(sprite, door.x, this.streetY);
    await this.walk(sprite, door.x, door.y - 10);
    await this.walk(sprite, sellerHome.x - 30, sellerHome.y - 16);
    if (!sprite.active || !this.running) {
      sprite.destroy();
      return;
    }
    this.setFacing(sprite, 'right');
    const mark = this.add.text(0, -24, '!', { fontFamily: UI_FONT, fontSize: '10px', color: '#2ce8f5', stroke: '#181425', strokeThickness: 3 }).setOrigin(0.5).setResolution(4);
    sprite.add(mark);
    const blink = this.tweens.add({ targets: mark, y: -27, duration: 400, yoyo: true, repeat: -1 });
    // Уснувший врач сопит.
    const snore = story === 'sleepyDoctor' ? this.time.addEvent({ delay: 1400, loop: true, callback: () => sprite.active && this.popup(sprite.x + 6, sprite.y - 20, 'z z z', '#cfe8ff') }) : null;
    const product = debtProduct(this.state);
    let answered: boolean | null = null;
    let closeChoice: (() => void) | null = null;
    const hit = this.add.zone(sprite.x, sprite.y - 6, 22, 30).setInteractive({ useHandCursor: true }).setDepth(2000);
    await new Promise<void>((resolve) => {
      const finish = (yes: boolean) => {
        if (answered !== null) return;
        answered = yes;
        resolve();
      };
      hit.on('pointerup', () =>
        this.tap(() => {
          if (closeChoice) return;
          const item = product ? `${debtLabel(product)} ${t(PRODUCTS[product].nameKey)}` : '';
          closeChoice = showChoice({
            title: t(`nightStory.${story}.title` as TextKey),
            text: t(`nightStory.${story}.text` as TextKey, { item }),
            note: t(`nightStory.${story}.note` as TextKey),
            yes: t(`nightStory.${story}.yes` as TextKey),
            no: t(`nightStory.${story}.no` as TextKey),
            onYes: () => finish(true),
            onNo: () => finish(false),
          });
        }),
      );
      this.time.delayedCall(12000, () => {
        closeChoice?.();
        if (answered === null) answered = false;
        resolve();
      });
    });
    hit.destroy();
    blink.stop();
    mark.destroy();
    snore?.remove();
    if (!sprite.active) return;
    const yes = answered === true;
    // Студенту — товар с полок в долг.
    if (yes && story === 'studentDebt' && product) {
      for (let i = 0; i < DEBT_UNITS; i++) {
        const index = shelfFor(this.state, product);
        const taken = index >= 0 ? takeFromShelf(this.state, index, product) : null;
        if (taken) this.state = taken.state;
      }
      this.refreshShelves();
      sprite.add(this.art(5, 1, `item_${product}`).setScale(1 / ART));
    }
    const avgCheck = this.stats.served ? this.stats.revenue / this.stats.served : 100;
    const res = answerNightStory(this.state, story, yes, avgCheck);
    this.state = res.state;
    this.hud.update(this.state, this.timeLeft);
    this.emote(sprite, yes ? 'emo_heart' : 'emo_angry');
    if (yes) this.popup(sprite.x, sprite.y - 18, t('nightStory.thanks'), '#c8ffb0');
    if (res.money) {
      sound.coin();
      this.stats.revenue += res.money;
      this.stats.nightRevenue = (this.stats.nightRevenue ?? 0) + res.money;
      this.time.delayedCall(500, () => this.popup(sprite.x, sprite.y - 26, `+${res.money} 💰`, '#c8ffb0'));
    }
    if (res.rating > 0) this.time.delayedCall(900, () => this.popup(sprite.x, sprite.y - 34, `★ +${res.rating}`, '#fee761'));
    await this.wait(1100);
    // Музыкант остаётся играть у входа до конца смены — ночных гостей больше.
    if (yes && story === 'busker') {
      this.busker = true;
      await this.walk(sprite, door.x, door.y - 10);
      await this.walk(sprite, door.x - 24, this.streetY - 2);
      this.people.delete(sprite);
      this.trickObjs.push(sprite);
      this.trickTimers.push(this.time.addEvent({ delay: 1800, loop: true, callback: () => sprite.active && this.popup(sprite.x, sprite.y - 20, t('popup.busker'), '#fee761') }));
      return;
    }
    await this.walk(sprite, door.x, door.y - 10);
    await this.strollAway(sprite);
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
    // Иногда просыпается: потягивается или следит за мухой.
    this.critterTimers.push(this.time.addEvent({ delay: 9000, loop: true, callback: () => !this.catOut && cat.active && this.catWake(cat) }));
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

  private catWake(cat: Phaser.GameObjects.Image): void {
    if (Math.random() < 0.5) {
      this.tweens.add({ targets: cat, scaleX: 1.3 / ART, duration: 420, yoyo: true, hold: 300, ease: 'Sine.easeInOut' });
      return;
    }
    // Муха кружит над котом, кот поворачивается за ней и в конце подпрыгивает.
    this.petEmote(cat, 'emo_question');
    const fly = this.add.rectangle(cat.x, cat.y - 10, 1.2, 1.2, 0x181425).setDepth(cat.depth + 2);
    const t0 = this.time.now;
    const buzz = this.time.addEvent({
      delay: 50,
      repeat: 50,
      callback: () => {
        const k = (this.time.now - t0) / 260;
        fly.setPosition(cat.x + Math.cos(k) * 7, cat.y - 9 + Math.sin(k * 1.7) * 3);
        cat.setFlipX(fly.x < cat.x);
      },
    });
    this.time.delayedCall(2600, () => {
      buzz.remove();
      if (cat.active) this.tweens.add({ targets: cat, y: cat.y - 3, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
      this.tweens.add({ targets: fly, x: fly.x + 20, y: fly.y - 20, alpha: 0, duration: 500, onComplete: () => fly.destroy() });
    });
  }

  // ---------- Пёс Бобик ----------

  /** Будка у входа, Бобик спит рядом. Погладить — сядет и повиляет хвостом. */
  private buildBobik(x: number, y: number): void {
    this.bobik = undefined;
    this.bobikWag?.remove();
    if (!hasDog(this.state)) return;
    // Бобик лежит перед будкой — слева от неё мусорный контейнер, справа ходят к двери.
    this.art(x, y - 2, 'kennel').setOrigin(0.5, 1).setDepth(y + 4);
    const dog = this.art(x + 1, y + 4, 'bobik_lie').setOrigin(0.5, 1).setDepth(y + 6);
    this.bobik = dog;
    if (this.closed) this.bobikSit(900);
    else this.bobikRest();
    dog.setInteractive({ useHandCursor: true }).on('pointerup', () => this.tap(() => this.petBobik()));
    // Днём Бобик дремлет — иногда над ним «z-z-z».
    this.critterTimers.push(
      this.time.addEvent({ delay: 11000, loop: true, callback: () => !this.closed && dog.texture.key === 'bobik_lie' && Math.random() < 0.5 && this.petEmote(dog, 'emo_zzz') }),
    );
  }

  /** Бобик ложится: дышит во сне, иногда «z». */
  private bobikRest(): void {
    this.bobikWag?.remove();
    const dog = this.bobik;
    if (!dog?.active) return;
    this.tweens.killTweensOf(dog);
    dog.setTexture('bobik_lie').setScale(1 / ART);
    this.tweens.add({ targets: dog, scaleY: 1.07 / ART, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** Бобик сидит и виляет хвостом: pace — как часто машет. */
  private bobikSit(pace: number): void {
    const dog = this.bobik;
    if (!dog?.active) return;
    this.tweens.killTweensOf(dog);
    this.bobikWag?.remove();
    dog.setScale(1 / ART).setTexture('bobik_sit0');
    this.bobikWag = this.time.addEvent({ delay: pace, loop: true, callback: () => dog.active && dog.setTexture(dog.texture.key === 'bobik_sit0' ? 'bobik_sit1' : 'bobik_sit0') });
  }

  private petBobik(): void {
    const dog = this.bobik;
    if (!dog?.active) return;
    haptic.tap();
    this.bobikSit(150);
    this.heartAt(dog.x, dog.y - 12);
    this.petEmote(dog, 'emo_heart');
    this.popup(dog.x, dog.y - 18, t('popup.dogWag'), '#fff3b0');
    this.time.delayedCall(1800, () => !this.closed && this.bobikRest());
  }

  /** Гав! — на воришку. */
  private bobikBark(): void {
    const dog = this.bobik;
    if (!dog?.active) return;
    sound.bark();
    this.bobikWag?.remove();
    this.tweens.killTweensOf(dog);
    dog.setScale(1 / ART).setTexture('bobik_bark');
    this.petEmote(dog, 'emo_alert');
    this.tweens.add({ targets: dog, y: dog.y - 1.5, duration: 90, yoyo: true, repeat: 3 });
    this.time.delayedCall(1400, () => !this.closed && this.bobikRest());
  }

  /** Погладили кота: мурчит, сердечко. */
  private petCat(): void {
    const cat = this.catImg;
    if (!cat?.active || !this.state.cat) return;
    sound.purr();
    haptic.tap();
    this.heartAt(cat.x, cat.y - 10);
    this.rub(cat);
    this.popup(cat.x, cat.y - 16, t('popup.catPurr', { name: this.state.cat.name }), '#fff3b0');
  }

  /** Облачко с эмоцией над котом или Бобиком: всплывает и тает. */
  private petEmote(pet: Phaser.GameObjects.Image, key: EmoteKey): void {
    if (!pet.active) return;
    const icon = this.art(pet.x, pet.y - 12, key).setDepth(pet.depth + 2).setScale(0.8 / ART);
    this.tweens.add({
      targets: icon,
      y: icon.y - 4,
      scale: 1 / ART,
      duration: 450,
      ease: 'Back.easeOut',
      onComplete: () => this.tweens.add({ targets: icon, alpha: 0, delay: 900, duration: 300, onComplete: () => icon.destroy() }),
    });
  }

  /** Ласкается: покачивается из стороны в сторону. */
  private rub(pet: Phaser.GameObjects.Image): void {
    if (!pet.active) return;
    this.tweens.add({ targets: pet, angle: { from: -8, to: 8 }, duration: 160, yoyo: true, repeat: 2, onComplete: () => pet.setAngle(0) });
  }

  /** Гром: кот вздрагивает, Бобик настораживается. */
  private petsStartled(): void {
    const cat = this.catImg;
    if (cat?.active) {
      this.petEmote(cat, 'emo_alert');
      this.tweens.add({ targets: cat, y: cat.y - 3, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
    }
    if (this.bobik?.active) this.petEmote(this.bobik, 'emo_alert');
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
      // Кот трётся о ноги: поворачивается к покупателю и покачивается.
      cat.setFlipX(c.sprite.x > cat.x);
      this.rub(cat);
      if (Math.random() < 0.5) sound.purr();
    }
  }

  // ---------- Доска отзывов ----------

  private buildReviewBoard(x: number, y: number): void {
    // Доска у входа — просто украшение. Раньше нажатие на неё открывало отзывы, и они вылезали
    // посреди дня от случайного касания у двери; теперь отзывы — в итогах дня и утром на вкладке «Развитие».
    this.art(x, y, 'review_board').setOrigin(0.5, 1).setDepth(y);
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

  /** Друзья в гостях: до FRIEND_VISITS друзей за день, каждый в своё время. */
  private scheduleFriends(): void {
    const friends = Phaser.Utils.Array.Shuffle([...(visitsInfo()?.friends ?? [])]).slice(0, FRIEND_VISITS);
    for (const f of friends) {
      this.time.delayedCall(Phaser.Math.FloatBetween(0.15, 0.7) * DAY_SECONDS * 1000, () => this.running && this.timeLeft > 0 && this.spawnFriend(f));
    }
  }

  private spawnFriend(f: VisitFriend): void {
    const start = this.streetSpawn();
    const sprite = this.makePerson(start.x, start.y, customerLook(SHIRTS[f.id % SHIRTS.length], this.state.day));
    this.addUmbrella(sprite);
    const bubble = this.art(0, -14, 'bubble').setVisible(false);
    // Имя над головой — видно, что это друг.
    const tag = this.add
      .text(0, -24, `👋 ${f.name}`, { fontFamily: UI_FONT, fontSize: '6px', fontStyle: 'bold', color: '#fee761', backgroundColor: 'rgba(24, 20, 37, 0.75)', padding: { x: 2, y: 1 } })
      .setOrigin(0.5)
      .setResolution(5);
    sprite.add([bubble, tag]);
    const customer: Customer = { sprite, bubble, items: [], unhappy: false, waitStart: 0, gone: false, thief: false, friend: f, wants: this.wanted(2) };
    // Нажми на друга — угостить кофе: он получит монеты при следующем запуске.
    sprite.setSize(16, 22).setInteractive({ useHandCursor: true }).on('pointerup', () =>
      this.tap(() => {
        if (customer.friend!.treated) return this.popup(sprite.x, sprite.y - 30, t('visit.treated', { name: f.name }), '#fff3b0');
        customer.friend = { ...customer.friend!, treated: true };
        void treatFriend(f.id).then((ok) => ok && sprite.active && this.popup(sprite.x, sprite.y - 30, t('visit.treat', { name: f.name, n: FRIEND_GIFT }), '#c8ffb0'));
        this.emote(sprite, 'emo_heart');
      }),
    );
    this.customers.add(customer);
    void this.runCustomer(customer);
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
    // Что-то стряслось — покупатели оглядываются, продавец настораживается.
    this.everyoneLooks(w / 2, h / 2, kind === 'pigeon' || kind === 'mouse' ? 'emo_question' : 'emo_alert', 0.3);
    if (this.seller?.active) this.emote(this.seller, 'emo_alert');
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
    this.emote(this.seller, 'emo_alert');
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
    ambience.carPass(isWet(this.weather));
    await new Promise<void>((done) => this.tweens.add({ targets: van, x: vanX, duration: 2200, ease: 'Sine.easeOut', onComplete: () => done() }));
    if (!van.active) return;
    // Задние двери распахиваются: внутри темно и видны коробки.
    const hold = this.add.rectangle(-body.displayWidth / 2 + 1, 0, 0.1, 10, 0x262b44).setOrigin(0, 0.5);
    const cargo = this.art(-body.displayWidth / 2 + 5, 1, 'box').setScale(0.7 / ART).setAlpha(0);
    van.add([hold, cargo]);
    this.tweens.add({ targets: hold, width: 9, x: hold.x - 1, duration: 300, ease: 'Back.easeOut' });
    this.tweens.add({ targets: cargo, alpha: 1, delay: 200, duration: 200 });
    const driver = this.makePerson(vanX, this.streetY + 10, { ...randomLook(0x0099db), style: 'cap', hair: 0x0099db });
    // Водитель катит тележку с двумя коробками.
    const box = this.art(7, 1, 'hand_truck').setVisible(false);
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
    // Двери закрываются — и в путь.
    cargo.destroy();
    this.tweens.add({ targets: hold, width: 0.1, x: hold.x + 1, duration: 250 });
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
    const sheen = keep(this.add.rectangle(-400, top, this.next.w + 800, 88, 0xa8c0f0).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.06).setDepth(-8.9));
    if (this.rainFx) this.rainFx.sheen = sheen;
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
      const puddle = keep(this.art(x, y, 'puddle_wet').setDepth(-8.8));
      this.rainFx?.puddles.push(puddle);
    }
    if (!puddles.length) return;
    const source = {
      getRandomPoint: (point: Phaser.Types.Math.Vector2Like) => {
        const at = Phaser.Utils.Array.GetRandom(puddles);
        point.x = (at.x ?? 0) + Phaser.Math.FloatBetween(-6, 6);
        point.y = (at.y ?? 0) + Phaser.Math.FloatBetween(-1.5, 1.5);
      },
    };
    const ripple = keep(this.add.particles(0, 0, 'ripple', {
      emitZone: { type: 'random', source },
      scale: { start: 0.15 / ART, end: 0.9 / ART },
      alpha: { start: 0.8, end: 0 },
      lifespan: 650,
      frequency: 70,
    })).setDepth(-8.7);
    if (this.rainFx) this.rainFx.ripple = ripple;
  }

  /**
   * Дождь не включается рывком: первые секунды дня редкие капли, потом ливень. В обычный дождь
   * через день к вечеру он кончается: зонты закрываются, лужи сохнут.
   */
  private updateRain(): void {
    const fx = this.rainFx;
    if (!fx || this.rainStopped || !this.running || !fx.rain.active) return;
    const p = Phaser.Math.Clamp(1 - this.timeLeft / DAY_SECONDS, 0, 1);
    const strength = Phaser.Math.Clamp(p / 0.08, 0.12, 1);
    fx.rain.frequency = fx.base / strength;
    fx.splash.frequency = 30 / strength;
    if (this.weather !== 'rain' || this.state.day % 2 !== 0 || p < 0.72) return;
    this.rainStopped = true;
    this.time.delayedCall(2500, () => this.rainbow());
    fx.rain.stop();
    fx.splash.stop();
    fx.ripple?.stop();
    if (fx.sheen) this.tweens.add({ targets: fx.sheen, alpha: 0, duration: 20000 });
    for (const puddle of fx.puddles) {
      this.tweens.add({ targets: puddle, scaleX: puddle.scaleX * 0.4, scaleY: puddle.scaleY * 0.4, alpha: 0, delay: Phaser.Math.Between(2000, 9000), duration: 15000 });
    }
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
        this.time.delayedCall(Phaser.Math.Between(250, 1100), () => {
          sound.thunder();
          this.petsStartled();
        });
      }
      this.time.delayedCall(Phaser.Math.Between(7000, 15000), strike);
    };
    this.time.delayedCall(Phaser.Math.Between(2500, 5000), strike);
  }

  /** Зонт над головой: только в дождь и только на улице. */
  private addUmbrella(person: Phaser.GameObjects.Container): void {
    if (!isWet(this.weather) || this.rainStopped) return;
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
    const zoomTo = (z: number) => cam.setZoom(Phaser.Math.Clamp(z, this.baseZoom * 0.5, this.baseZoom * 2.2));
    // Колёсико на компьютере.
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (this.arranging) return;
      zoomTo(cam.zoom * (dy > 0 ? 0.9 : 1.1));
      this.scheduleHome();
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      // Пока переставляют полки, палец двигает полку, а не камеру.
      if (this.arranging) return;
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

  /**
   * Начало дня: камера сначала показывает весь квартал сверху-сбоку (улица, соседи), потом
   * плавно подлетает к магазину. Если игрок сам двигает камеру — не мешаем.
   */
  private flyIn(): void {
    const cam = this.cameras.main;
    if (this.input.pointer1.isDown || this.input.pointer2.isDown) return;
    this.homeTimer?.remove();
    const wide = this.baseZoom * 0.55;
    const x = Phaser.Math.Clamp(this.home.x + 70, -CAMERA_REACH, this.next.w + CAMERA_REACH);
    const y = Phaser.Math.Clamp(this.home.y + 30, -CAMERA_REACH / 2, this.next.h + CAMERA_REACH / 2);
    cam.setZoom(wide).centerOn(x, y);
    cam.pan(this.home.x, this.home.y, 1600, 'Sine.easeInOut', true);
    cam.zoomTo(this.baseZoom, 1600, 'Cubic.easeInOut', true);
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
    const look = eduardLook(this.state);
    this.builtEduard = look;
    // Босс района открывается за дорогой, на месте закрытого «Гиганта»; сбоку тогда — хозтовары.
    // Сбоку, когда босс за дорогой, — магазин друга по торговой неделе (или хозтовары).
    // Пустующее помещение тоже занимает друг.
    const free = this.rivalAcross || look === 'vacant';
    const friend = free ? duelInfo()?.rival?.name : undefined;
    this.builtFriend = friend;
    const side: Omit<Neighbor, 'x' | 'w'> = friend
      ? { h: 125, name: 'neighbor.friend', label: t('neighbor.friend', { name: friend }), sign: 0x3e8948, awning: 0xfee761, roof: 0xe8dcc0, neon: 0xfee761 }
      : this.rivalAcross
        ? { h: 120, name: 'neighbor.hardware', sign: 0x5a6988, awning: 0x8b9bb4, roof: 0xd6dce8, neon: 0x9cd8ff }
        : RIVAL_LOOKS[look];
    const neighbors: Neighbor[] = [
      { x: -136 - WING_OUTER, w: 112, h: 120, name: 'neighbor.cafe', sign: 0x733e39, awning: 0xb86f50, roof: 0xe8c8b0, neon: 0xffb860, back: VERANDA_D },
      { x: -268 - WING_OUTER, w: 116, h: 150, name: 'neighbor.pharmacy', sign: 0x3e8948, awning: 0x63c74d, roof: 0xd0e4d0, neon: 0x7cff8a },
      { x: next.w + 26, w: 128, ...side },
      { x: next.w + 170, w: 110, h: 120, name: 'neighbor.bakery', sign: 0xb55088, awning: 0xf6757a, roof: 0xf2d0dc, neon: 0xff8ad8 },
    ];
    const rnd = new Phaser.Math.RandomDataGenerator(['neighbors']);
    for (const n of neighbors) this.drawNeighbor(n, base - (n.back ?? 0), rnd);
    // Остановка на тротуаре слева.
    this.art(-70 - WING_OUTER, this.streetY - 4, 'bus_stop').setDepth(this.streetY);
    this.buildVeranda(neighbors[0].x, neighbors[0].w, base);
  }

  /**
   * Здание с крышей, витринами, дверью, навесом и вывеской. across — за дорогой: вывеска
   * на краю крыши у дороги, чтобы читалась с нашей стороны.
   */
  private drawNeighbor(n: Neighbor, bottom: number, rnd: Phaser.Math.RandomDataGenerator, across = false): void {
    const top = bottom - n.h;
    // За дорогой витрины смотрят на дорогу: фасад сверху, крыша за ним.
    const roofY = across ? top + FACADE_H : top;
    const front = across ? top + FACADE_H : bottom;
    this.add.tileSprite(n.x, roofY, n.w, n.h - FACADE_H, 'roof').setOrigin(0).setTileScale(1 / ART).setTint(n.roof).setDepth(-3);
    this.add.tileSprite(n.x - 2, (across ? bottom : top) - 3, n.w + 4, 3, 'wall_cap').setOrigin(0).setTileScale(1 / ART).setDepth(-3);
    this.add.tileSprite(n.x, front - FACADE_H, n.w, FACADE_H, 'facade').setOrigin(0).setTileScale(1 / ART).setDepth(front - 5);
    this.dressRoof(n, roofY, n.h - FACADE_H, across, rnd);
    // Витрины, дверь и навес.
    const doorX = across ? n.x + n.w / 2 : n.x + n.w * 0.62;
    this.art(doorX, front - 5, 'door').setDepth(front - 4);
    for (let x = n.x + 14; x < n.x + n.w - 10; x += 24) {
      if (Math.abs(x - doorX) < 22) continue;
      const win = this.art(x, front - 4.5, 'shopwin').setDepth(front - 4);
      // Пустующее помещение — тёмные витрины без света.
      if (n.dark) win.setTint(0x8b9bb4);
      else this.windowLight(x, front - 4.5, across ? top : front, across, rnd.frac() * 0.5);
    }
    this.art(doorX, front - 9, 'awning').setScale(1 / ART, 0.6 / ART).setTint(n.awning).setDepth(front + 40);
    // Вывеска на краю крыши (за дорогой — над витринами, у самой дороги).
    const signY = across ? top - 12 : bottom - FACADE_H - 8;
    const signDepth = across ? front + 41 : front - 3;
    this.art(n.x + n.w / 2, signY, 'sign').setTint(n.sign).setDepth(signDepth);
    this.add
      .text(n.x + n.w / 2, signY, n.label ?? t(n.name), { fontFamily: UI_FONT, fontSize: '6px', color: '#fee761' })
      .setOrigin(0.5)
      .setResolution(4)
      .setDepth(signDepth + 1);
    if (n.neon) this.neonSign(n.x + n.w / 2, signY, n.label ?? t(n.name), '6px', n.neon, 64);
  }

  /**
   * Крыша сверху: тень здания на газоне, парапет по краю (светлый к солнцу, тёмный в тень)
   * и что стоит на кровле — вытяжки, кондиционеры, люки, тарелки, баки, трубы. У зданий района
   * своё: вертолётная площадка, красный крест, бельё на верёвках, солнечные панели.
   */
  private dressRoof(n: Neighbor, y: number, h: number, across: boolean, rnd: Phaser.Math.RandomDataGenerator): void {
    const { x, w } = n;
    // Тень — вправо и (у зданий за дорогой) вниз, на газон.
    this.add.rectangle(x + w, y + 6, 6, h + (across ? FACADE_H - 6 : -6), 0x181425, 0.16).setOrigin(0).setDepth(-9.4);
    if (across) this.add.rectangle(x + 6, y + h, w, 6, 0x181425, 0.16).setOrigin(0).setDepth(-9.4);
    // Парапет.
    const tone = Phaser.Display.Color.ValueToColor(n.roof);
    const light = tone.clone().lighten(14).color;
    const dark = tone.clone().darken(26).color;
    const edge = (ex: number, ey: number, ew: number, eh: number, color: number) => this.add.rectangle(ex, ey, ew, eh, color).setOrigin(0).setDepth(-2.95);
    edge(x, y, w, 3, light);
    edge(x, y, 3, h, light);
    edge(x, y + h - 3, w, 3, dark);
    edge(x + w - 3, y, 3, h, dark);
    // Снег на кровле — виден только в снегопад (applyWeather).
    this.roofSnow.push(this.add.rectangle(x + 3, y + 3, w - 6, h - 6, 0xf4f8ff, 0.7).setOrigin(0).setDepth(-2.97).setVisible(this.weather === 'snow'));
    // Тень от парапета на кровле.
    this.add.rectangle(x + 3, y + 3, w - 6, 2, 0x181425, 0.12).setOrigin(0).setDepth(-2.94);
    this.add.rectangle(x + 3, y + 3, 2, h - 6, 0x181425, 0.12).setOrigin(0).setDepth(-2.94);
    // Особая крыша — в середине; остальное — по клеткам вокруг, без наложений.
    const cx = x + w / 2;
    const cy = y + h / 2;
    const busy: { x: number; y: number; r: number }[] = [];
    // Кровельные предметы крупнее обычного спрайта: крыши видно с высоты, мелочь там теряется.
    const put = (px: number, py: number, key: string, r: number, scale = 1.4) => {
      this.art(px, py, key).setScale(scale / ART).setDepth(-2);
      busy.push({ x: px, y: py, r });
      // Вечером в световых окнах кровли горит тёплый свет — внутри работают.
      if (key === 'skylight') this.nightGlow(this.art(px, py, 'glow').setDisplaySize(26, 20).setTint(0xffd890), 0.7);
    };
    if (n.roofKit === 'office' && w >= 70 && h >= 60) put(cx, cy, 'roof_helipad', 32, 2.6);
    if (n.roofKit === 'clinic') put(cx, cy, 'roof_cross', 26, 3);
    if (n.roofKit === 'dorm') {
      put(cx - 6, cy - 12, 'roof_laundry', 30, 1.8);
      put(x + w - 22, y + h - 24, 'roof_tank', 16, 1.6);
    }
    if (n.roofKit === 'school') {
      for (const dx of [-26, 0, 26]) put(cx + dx, cy - 8, 'roof_solar', 18, 1.6);
    }
    const kinds = ['roof_vent', 'ac_unit', 'roof_hatch', 'ac_unit', 'roof_dish', 'skylight', 'roof_vent', 'roof_pipe', 'roof_tank', 'ac_unit'];
    const count = Math.max(4, Math.round((w * h) / 1500));
    for (let i = 0, tries = 0; i < count && tries < count * 10; tries++) {
      const px = x + 14 + rnd.frac() * (w - 28);
      const py = y + 14 + rnd.frac() * (h - 28);
      if (busy.some((b) => Math.hypot(b.x - px, b.y - py) < b.r + 11)) continue;
      put(px, py, kinds[rnd.between(0, kinds.length - 1)], 10);
      i++;
    }
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
    // Газон с запасом за краями квартала: когда отдаляешь камеру, мир не обрывается в темноту.
    tile(left - 400, -800, width + 800, top + 1600, 'grass');
    this.streetY = top + 12;
    this.lawns = [
      { x: left, y: -400, w: width, h: top + 400 },
      { x: left, y: top + 88, w: width, h: 300 },
      // Газон за краями квартала (снег зимой — и там).
      { x: left - 400, y: -800, w: width + 800, h: 400 },
      { x: left - 400, y: top + 388, w: width + 800, h: 412 },
      { x: left - 400, y: -400, w: 400, h: top + 788 },
      { x: left + width, y: -400, w: 400, h: top + 788 },
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
    // Сквер за кварталом и за дорогой: деревья, кусты и клумбы — газон не пустует, когда отдаляешь камеру.
    const rnd = new Phaser.Math.RandomDataGenerator(['park']);
    // «Гигант» за дорогой: напротив входа, на месте сквера (giant.ts).
    const giant = giantLook(this.state);
    this.builtGiant = giant;
    const giantArea = { x: door.x - 82, y: top + 86, w: 164, h: 112 };
    // Босс района (eduard.ts) — за дорогой напротив входа, когда «Гиганта» там нет или он закрылся.
    const look = eduardLook(this.state);
    this.rivalAcross = look !== 'vacant' && look !== 'mega' && (giant === 'none' || giant === 'closed');
    if (this.rivalAcross) {
      const rival = RIVAL_LOOKS[look];
      const h = Math.min(rival.h, RIVAL_ACROSS_H);
      this.drawNeighbor({ ...rival, x: door.x - 64, w: 128, h }, top + 92 + h, new Phaser.Math.RandomDataGenerator(['rival']), true);
    } else if (giant !== 'none') {
      const key = giant === 'site' ? 'giant_site' : giant === 'store' ? 'giant_store' : 'giant_closed';
      this.art(door.x, top + 92, key).setOrigin(0.5, 0).setDepth(top + 92 + 88);
    }
    // Здания района (district.ts): стройки и готовые — на газоне за дорогой и за магазином.
    const districtAreas = [...this.buildDistrict(next, top), ...this.buildPark(next, top), this.buildParking(next)];
    const inArea = (px: number, py: number, a: { x: number; y: number; w: number; h: number }) => px > a.x - 6 && px < a.x + a.w + 6 && py > a.y - 6 && py < a.y + a.h + 14;
    const scatter = (y0: number, y1: number) => {
      for (let y = y0; y < y1; y += 40) {
        for (let x = left + 10; x < left + width - 10; x += 46) {
          const px = x + rnd.between(-14, 14);
          const py = y + rnd.between(-12, 12);
          if ((giant !== 'none' || this.rivalAcross) && px > giantArea.x && px < giantArea.x + giantArea.w && py > giantArea.y && py < giantArea.y + giantArea.h) continue;
          if (districtAreas.some((a) => inArea(px, py, a))) continue;
          const roll = rnd.frac();
          // За зданием глубина отрицательная — держим над газоном (-10), но под крышами соседей (-3).
          const depth = py < 0 ? -9.5 + (py + 400) / 1000 : py;
          // Сквер пёстрый: липы, берёзы, ели и цветущие кусты (art/flora.py).
          if (roll < 0.34) this.greenery.push(this.art(px, py, rnd.pick(PARK_TREES)).setOrigin(0.5, 0.9).setDepth(depth));
          else if (roll < 0.52) this.greenery.push(this.art(px, py, rnd.frac() < 0.3 ? 'bush_flower' : 'bush').setDepth(depth));
          else if (roll < 0.62) this.greenery.push(this.art(px, py, rnd.frac() < 0.5 ? 'flower' : 'tulips').setDepth(depth));
        }
      }
    };
    scatter(-380, Math.min(-40, top - 230));
    scatter(top + 104, top + 470);
    // Парк за аллеей гуще — второй проход (деревья не встают на пруд, клумбы и дорожку).
    scatter(top + 290, top + 470);
  }

  /**
   * Район растёт (district.ts): за дорогой — поликлиника, общежитие и школа слева от конкурента,
   * бизнес-центр и стадион справа. Пока строят — забор, кран и табличка «Скоро». Возвращает,
   * где стоят здания, чтобы сквер не сажал на них деревья.
   */
  private buildDistrict(next: Layout, top: number): { x: number; y: number; w: number; h: number }[] {
    this.builtDistrict = districtKey(this.state);
    const d = this.layout.door.x;
    const across = top + 92;
    // Слева от конкурента — три здания, справа — бизнес-центр и стадион; ширина — по месту.
    const leftEdge = -395;
    const w3 = Math.min(130, Math.floor((d - 88 - leftEdge - 20) / 3));
    const stadiumX = d + 222;
    const spots: Record<BuildingId, { x: number; y: number; w: number; h: number; across: boolean }> = {
      clinic: { x: leftEdge, y: across, w: w3, h: 116, across: true },
      dorm: { x: leftEdge + w3 + 10, y: across, w: w3, h: 124, across: true },
      school: { x: leftEdge + 2 * (w3 + 10), y: across, w: w3, h: 104, across: true },
      office: { x: d + 90, y: across, w: 120, h: 130, across: true },
      stadium: { x: stadiumX, y: across, w: Math.min(180, next.w + 395 - stadiumX), h: 128, across: true },
    };
    const looks: Record<Exclude<BuildingId, 'stadium'>, Omit<Neighbor, 'x' | 'w' | 'h' | 'name'>> = {
      school: { sign: 0x3b5dc9, awning: 0xfeae34, roof: 0xf2d8a0, neon: 0xffe080 },
      office: { sign: 0x262b44, awning: 0x5fcde4, roof: 0xb8c8d8, neon: 0x9cd8ff },
      dorm: { sign: 0x733e39, awning: 0xc28569, roof: 0xe0c0a8, neon: 0xffb860 },
      clinic: { sign: 0xe43b44, awning: 0xffffff, roof: 0xe8f0f0, neon: 0xff6070 },
    };
    const rnd = new Phaser.Math.RandomDataGenerator(['district']);
    const areas: { x: number; y: number; w: number; h: number }[] = [];
    for (const id of BUILDING_IDS) {
      const stage = buildingStage(this.state, id);
      if (stage === 'none') continue;
      const spot = spots[id];
      areas.push(spot);
      const name = t(`district.${id}` as TextKey);
      if (stage === 'site') {
        this.buildSite(spot, name);
        continue;
      }
      if (id === 'stadium') {
        this.buildStadium(spot, name);
        continue;
      }
      this.drawNeighbor({ ...looks[id], x: spot.x, w: spot.w, h: spot.h, name: 'district.school', label: `${BUILDINGS[id].icon} ${name}`, roofKit: id }, spot.y + spot.h, rnd, true);
      // У школы на тротуаре — флагшток.
      if (id === 'school') this.art(spot.x + 8, spot.y + 4, 'flagpole').setOrigin(0.5, 1).setDepth(spot.y + 44);
    }
    return areas;
  }

  /**
   * Парк за домами напротив: аллея с фонарями и скамейками, пруд с утками и камышом, клумбы.
   * Возвращает занятые места — сквер не сажает туда деревья.
   */
  private buildPark(next: Layout, top: number): { x: number; y: number; w: number; h: number }[] {
    const d = this.layout.door.x;
    const areas: { x: number; y: number; w: number; h: number }[] = [];
    // Аллея поперёк парка.
    const alley = top + 268;
    this.add.tileSprite(-560, alley, next.w + 1120, 12, 'paving').setOrigin(0).setTileScale(1 / ART).setDepth(-9.46);
    this.add.rectangle(-560, alley + 12, next.w + 1120, 1, 0x181425, 0.15).setOrigin(0).setDepth(-9.45);
    areas.push({ x: -560, y: alley - 4, w: next.w + 1120, h: 20 });
    for (let x = -520; x < next.w + 520; x += 96) {
      this.art(x, alley + 2, 'lamp').setOrigin(0.5, 0.95).setDepth(alley + 2);
      // Вечером фонари аллеи светят, как уличные.
      this.nightGlow(this.art(x, alley - 20, 'light_cone').setOrigin(0.5, 0).setTint(0xffd27a), 0.5);
      this.nightGlow(this.art(x, alley - 20, 'glow').setScale(16 / 64).setTint(0xfff0b0), 0.9);
      this.art(x + 40, alley + 1, 'bench').setDepth(alley + 1);
    }
    // Пруд: берег, вода, блики, камыш и утки. Всё — над снегом на газоне (-9.5).
    const px = d + 90;
    const py = alley + 70;
    // Ночью в пруду отражаются луна и звёзды (поверх воды, мерцают).
    this.nightGlow(this.add.ellipse(px + 34, py - 8, 16, 7, 0xf4f8ff), 0.55, undefined, { twinkle: 0.4 });
    for (let i = 0; i < 9; i++) {
      const sx = px + Phaser.Math.Between(-55, 55);
      const sy = py + Phaser.Math.Between(-18, 18);
      if (Math.hypot((sx - px) / 70, (sy - py) / 24) > 1) continue;
      this.nightGlow(this.add.rectangle(sx, sy, 1.2, 1.2, 0xffffff), 0.9, undefined, { twinkle: i * 1.7 });
    }
    this.parkPond = { x: px, y: py };
    this.add.ellipse(px, py, 172, 78, 0xd8b88a).setDepth(-9.46);
    // Зимой пруд замерзает: лёд с трещинками, уток нет.
    const frozen = this.weather === 'snow' || yearTime(this.state.day) === 'winter';
    this.add.ellipse(px, py, 160, 68, frozen ? 0xa8cce4 : 0x3b8fc8).setDepth(-9.45);
    this.add.ellipse(px - 6, py - 4, 136, 50, frozen ? 0xd8ecf8 : 0x4aa3df).setDepth(-9.44);
    for (const [bx, by, bw] of [
      [-40, -14, 22],
      [18, 6, 30],
      [-8, 14, 14],
    ] as const) {
      this.add.rectangle(px + bx, py + by, bw, 1.5, 0xbfe8ff, 0.8).setDepth(-9.43);
    }
    for (const [rx, ry] of [
      [-74, -6],
      [-70, 6],
      [72, -10],
      [76, 2],
    ] as const) {
      for (let i = 0; i < 4; i++) this.add.rectangle(px + rx + i * 2, py + ry - (i % 2) * 3, 1.2, 7 + (i % 2) * 3, 0x3e8948).setOrigin(0.5, 1).setDepth(py + ry);
    }
    for (const [ux, uy] of frozen ? [] : ([
      [-22, -6],
      [-12, 2],
      [30, -2],
    ] as const)) {
      const duck = this.add.container(px + ux, py + uy).setDepth(-9.42);
      duck.add([this.add.ellipse(0, 0, 7, 4, 0xffffff), this.add.circle(3, -2, 1.6, 0xffffff), this.add.rectangle(5, -2, 2, 1, 0xfeae34)]);
      this.tweens.add({ targets: duck, x: duck.x + Phaser.Math.Between(-14, 14), duration: Phaser.Math.Between(5000, 8000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    areas.push({ x: px - 92, y: py - 44, w: 184, h: 88 });
    // Клумбы вдоль аллеи.
    const flowers = [0xffffff, 0xf6757a, 0xfee761, 0xb55088, 0xe43b44];
    const rnd = new Phaser.Math.RandomDataGenerator(['park-beds']);
    for (const bx of [d - 260, d - 120, d + 250]) {
      const by = alley + 26;
      this.add.rectangle(bx, by, 64, 22, 0x8f563b).setOrigin(0).setDepth(-9.46);
      this.add.rectangle(bx + 2, by + 2, 60, 18, 0x733e39).setOrigin(0).setDepth(-9.45);
      // Зимой клумбы под снегом.
      if (frozen) this.add.rectangle(bx + 2, by + 2, 60, 18, 0xf4f8ff).setOrigin(0).setDepth(-9.44);
      for (let i = 0; i < (frozen ? 0 : 9); i++) {
        this.art(bx + 7 + (i % 5) * 12 + rnd.between(-2, 2), by + 7 + Math.floor(i / 5) * 9, rnd.frac() < 0.6 ? 'flower' : 'tulips')
          .setTint(rnd.pick(flowers))
          .setDepth(by + 10);
      }
      areas.push({ x: bx, y: by, w: 64, h: 22 });
    }
    return areas;
  }

  /** Парковка за магазином: разметка, машины соседей и наших покупателей. */
  private buildParking(next: Layout): { x: number; y: number; w: number; h: number } {
    const w = 210;
    const h = 96;
    const x = next.w / 2 - w / 2;
    const y = -160;
    this.add.tileSprite(x, y, w, h, 'asphalt').setOrigin(0).setTileScale(1 / ART).setDepth(-9.46);
    this.add.rectangle(x, y, w, 2, 0x8b9bb4).setOrigin(0).setDepth(-9.45);
    this.add.rectangle(x, y + h - 2, w, 2, 0x8b9bb4).setOrigin(0).setDepth(-9.45);
    const rnd = new Phaser.Math.RandomDataGenerator(['parking']);
    // Два ряда мест: машины стоят носом к проезду посередине.
    for (const row of [0, 1]) {
      const ry = row === 0 ? y + 4 : y + h - 30;
      for (let i = 0; i <= 5; i++) this.add.rectangle(x + 6 + i * 33, ry, 1.5, 26, 0xe6e1d6).setOrigin(0).setDepth(-9.45);
      for (let i = 0; i < 5; i++) {
        if (rnd.frac() < 0.3) continue;
        const [key, color] = rnd.pick(CAR_TYPES.filter(([k]) => k !== 'car_truck'));
        // За зданием глубина отрицательная: над асфальтом, но под крышами (как сквер).
        const car = this.art(x + 22 + i * 33, ry + 13, key).setAngle(90).setDepth(-9.41 + row * 0.001);
        if (color !== null) car.setTint(color || rnd.pick(CAR_COLORS));
      }
    }
    this.add.text(x + w / 2, y + h / 2, 'P', { fontFamily: UI_FONT, fontSize: '10px', color: '#e6e1d6', fontStyle: 'bold' }).setOrigin(0.5).setResolution(4).setDepth(-9.44).setAlpha(0.7);
    return { x: x - 8, y: y - 8, w: w + 16, h: h + 16 };
  }

  /** Стройка: забор, котлован, кран и табличка «Скоро: …». */
  private buildSite(a: { x: number; y: number; w: number; h: number; across: boolean }, name: string): void {
    const base = a.y + a.h;
    this.add.rectangle(a.x, a.y, a.w, a.h, 0x8f563b).setOrigin(0).setDepth(-8);
    for (let i = 0; i < 6; i++) this.add.rectangle(a.x + 10 + rnd(a.w - 30), a.y + 10 + rnd(a.h - 30), 14 + rnd(10), 8 + rnd(6), 0x733e39).setOrigin(0).setDepth(-7.9);
    // Забор по краю со стороны дороги и по бокам.
    const fenceY = a.across ? a.y : base - 6;
    for (let x = a.x; x < a.x + a.w; x += 6) this.add.rectangle(x, fenceY, 5, 6, (x / 6) % 2 ? 0xc0cbdc : 0x8b9bb4).setOrigin(0).setDepth(fenceY + 6);
    this.add.rectangle(a.x, a.y, 3, a.h, 0x8b9bb4).setOrigin(0).setDepth(a.y + a.h);
    this.add.rectangle(a.x + a.w - 3, a.y, 3, a.h, 0x8b9bb4).setOrigin(0).setDepth(a.y + a.h);
    // Кран: мачта, стрела и груз.
    const cx = a.x + a.w * 0.7;
    const cy = a.y + a.h * 0.75;
    this.add.rectangle(cx, cy - 70, 4, 70, 0xfeae34).setOrigin(0).setDepth(cy + 1);
    this.add.rectangle(cx - 46, cy - 72, 64, 4, 0xfeae34).setOrigin(0).setDepth(cy + 1);
    this.add.rectangle(cx - 40, cy - 68, 1, 22, 0x262b44).setOrigin(0).setDepth(cy + 1);
    this.add.rectangle(cx - 44, cy - 46, 9, 6, 0x5a6988).setOrigin(0).setDepth(cy + 1);
    // Каркас будущего здания.
    for (let i = 0; i < 3; i++) this.add.rectangle(a.x + 16 + i * 22, a.y + a.h * 0.35, 3, a.h * 0.45, 0xc0cbdc).setOrigin(0).setDepth(a.y + a.h * 0.8);
    this.add.rectangle(a.x + 14, a.y + a.h * 0.35, 50, 3, 0xc0cbdc).setOrigin(0).setDepth(a.y + a.h * 0.8);
    const signY = a.across ? a.y - 6 : base + 4;
    this.add.rectangle(a.x + a.w / 2, signY, 70, 11, 0xfee761).setDepth(signY + 20);
    this.add
      .text(a.x + a.w / 2, signY, t('district.soon', { name }), { fontFamily: UI_FONT, fontSize: '5px', color: '#262b44' })
      .setOrigin(0.5)
      .setResolution(4)
      .setDepth(signY + 21);
    function rnd(n: number): number {
      return Math.floor(Math.random() * Math.max(1, n));
    }
  }

  /** Стадион: трибуны, поле с разметкой, прожекторы; в день матча — болельщики на трибунах. */
  private buildStadium(a: { x: number; y: number; w: number; h: number }, name: string): void {
    const depth = -7.5;
    this.add.rectangle(a.x, a.y, a.w, a.h, 0x8b9bb4).setOrigin(0).setDepth(depth);
    const field = { x: a.x + 16, y: a.y + 18, w: a.w - 32, h: a.h - 36 };
    this.add.rectangle(field.x, field.y, field.w, field.h, 0x3e8948).setOrigin(0).setDepth(depth + 0.01);
    for (let x = field.x; x < field.x + field.w; x += 16) this.add.rectangle(x, field.y, 8, field.h, 0x4a9c52).setOrigin(0).setDepth(depth + 0.02);
    const line = (x: number, y: number, w: number, h: number) => this.add.rectangle(x, y, w, h, 0xffffff, 0.85).setOrigin(0).setDepth(depth + 0.03);
    line(field.x + 3, field.y + 3, field.w - 6, 1);
    line(field.x + 3, field.y + field.h - 4, field.w - 6, 1);
    line(field.x + 3, field.y + 3, 1, field.h - 6);
    line(field.x + field.w - 4, field.y + 3, 1, field.h - 6);
    line(field.x + field.w / 2, field.y + 3, 1, field.h - 6);
    this.add.circle(field.x + field.w / 2, field.y + field.h / 2, 10).setStrokeStyle(1, 0xffffff, 0.85).setDepth(depth + 0.03);
    // Трибуны рядами; в день матча на них болельщики.
    const match = isMatchDay(this.state);
    const colors = [0xe43b44, 0x0099db, 0xfee761, 0xffffff, 0x63c74d];
    for (const [sx, sy, sw] of [
      [a.x, a.y, a.w],
      [a.x, a.y + a.h - 16, a.w],
    ] as const) {
      for (let r = 0; r < 4; r++) this.add.rectangle(sx, sy + r * 4, sw, 3, r % 2 ? 0x5a6988 : 0x6a7898).setOrigin(0).setDepth(depth + 0.04);
      if (match) for (let i = 0; i < sw / 3; i++) this.add.rectangle(sx + 1 + i * 3, sy + 1 + (i % 4) * 4, 2, 2, colors[i % colors.length]).setOrigin(0).setDepth(depth + 0.05);
    }
    // Прожекторы по углам.
    for (const [px, py] of [
      [a.x + 4, a.y + 2],
      [a.x + a.w - 6, a.y + 2],
    ] as const) {
      this.add.rectangle(px, py - 26, 2, 28, 0x3a4466).setOrigin(0).setDepth(a.y + a.h);
      this.add.rectangle(px - 3, py - 30, 8, 5, 0xe6e1d6).setOrigin(0).setDepth(a.y + a.h);
    }
    this.art(a.x + a.w / 2, a.y - 10, 'sign').setTint(0x3e8948).setDepth(a.y + a.h + 1);
    this.add
      .text(a.x + a.w / 2, a.y - 10, `${BUILDINGS.stadium.icon} ${name}`, { fontFamily: UI_FONT, fontSize: '6px', color: '#fee761' })
      .setOrigin(0.5)
      .setResolution(4)
      .setDepth(a.y + a.h + 2);
  }

  // ---------- Козни конкурента (tricks.ts) ----------

  private clearTrick(): void {
    this.busker = false;
    this.trickTimers.forEach((e) => e.remove());
    this.trickTimers = [];
    this.trickObjs.forEach((o) => o.destroy());
    this.trickObjs = [];
  }

  /** Утром выбрали ответ — днём это видно на улице: промоутеры, перетяжки, «проверяющий». */
  private setupTrick(): void {
    this.clearTrick();
    const trick = activeTrick(this.state);
    if (!trick) return;
    const { door } = this.layout;
    const sidewalk = this.streetY - 2;
    const every = (ms: number, fn: () => void) => this.trickTimers.push(this.time.addEvent({ delay: ms, loop: true, callback: fn }));
    if (trick.kind === 'promoter') {
      const ours = trick.answer === 'counter';
      if (!ours && trick.stopped) return;
      const look: Look = ours
        ? { ...randomLook(0x63c74d), acc: 'apron', accTint: 0xffffff, prop: 'balloon', propTint: 0x63c74d }
        : { ...randomLook(0xe43b44), acc: 'vest', accTint: 0xfee761, hat: 'papercap', hatTint: 0xe43b44, prop: 'balloon', propTint: 0xe43b44 };
      const promoter = this.makePerson(door.x + 24, sidewalk, look);
      this.people.delete(promoter);
      this.trickObjs.push(promoter);
      every(5200, () => this.running && this.popup(promoter.x, promoter.y - 22, t(ours ? 'popup.ownPromoter' : 'popup.rivalPromoter'), ours ? '#c8ffb0' : '#ffd0d0'));
      // Чужой промоутер уводит прохожих через дорогу — видно, куда уходят гости.
      if (!ours) every(6500, () => this.running && void this.lureAway(promoter));
      return;
    }
    if (trick.kind === 'banner') {
      const ours = trick.answer === 'counter';
      const top = this.next.h + 4;
      // Чужая — над тротуаром за дорогой, своя — над нашим тротуаром.
      const y = ours ? this.streetY - 18 : top + 66;
      const color = ours ? 0x3e8948 : 0xe43b44;
      // Поверх вывески конкурента — её видно с нашей стороны улицы.
      const depth = top + 200;
      for (const dx of [-62, 62]) this.trickObjs.push(this.add.rectangle(door.x + dx, y + 6, 2, 20, 0x3a4466).setDepth(depth));
      this.trickObjs.push(this.add.rectangle(door.x, y, 128, 11, color).setStrokeStyle(1, 0xffffff).setDepth(depth + 1));
      this.trickObjs.push(
        this.add
          .text(door.x, y, t(ours ? 'trick.banner.own' : 'trick.banner.sign'), { fontFamily: UI_FONT, fontSize: '7px', color: '#ffffff', fontStyle: 'bold' })
          .setOrigin(0.5)
          .setResolution(4)
          .setDepth(depth + 2),
      );
      return;
    }
    // «Проверяющий» заходит, когда прошла треть дня.
    if (trick.kind === 'inspector' && trick.day === this.state.day) {
      this.trickTimers.push(this.time.delayedCall((DAY_SECONDS * 1000) / 3, () => this.running && void this.fakeInspector()));
    }
  }

  /** Прохожий идёт к промоутеру конкурента и уходит через дорогу к нему в магазин. */
  private async lureAway(promoter: Phaser.GameObjects.Container): Promise<void> {
    const start = this.streetSpawn();
    const person = this.makePerson(start.x, start.y, withCompanionItems(customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), this.state.day)));
    this.people.delete(person);
    this.trickObjs.push(person);
    await this.walk(person, promoter.x + 8, promoter.y + 2);
    if (!person.active) return;
    this.popup(person.x, person.y - 18, '🤔', '#ffffff');
    await this.wait(600);
    await this.walk(person, this.layout.door.x + Phaser.Math.Between(-30, 30), this.streetY + 74);
    if (person.active) this.tweens.add({ targets: person, alpha: 0, duration: 400, onComplete: () => person.destroy() });
  }

  /** Подставной «проверяющий»: проходит по залу с портфелем, цокает и уходит. */
  private async fakeInspector(): Promise<void> {
    const { door } = this.layout;
    const look: Look = { ...randomLook(0x262b44), outfit: 'suit', outfitTint: 0x3a4466, prop: 'briefcase', glasses: true, face: 'mustache' };
    const start = this.streetSpawn();
    const man = this.makePerson(start.x, start.y, look);
    this.people.delete(man);
    this.trickObjs.push(man);
    await this.walk(man, door.x, this.streetY);
    await this.walk(man, door.x, door.y - 10);
    for (let i = 0; i < 3 && man.active; i++) {
      const index = Phaser.Math.Between(0, Math.max(0, this.state.shelves.length - 1));
      const stand = this.standOf(index);
      await this.walk(man, stand.x, stand.y);
      if (!man.active) return;
      this.popup(man.x, man.y - 20, t('popup.fakeInspector'), '#fff3b0');
      await this.wait(900);
    }
    if (!man.active) return;
    await this.walk(man, door.x, this.layout.h + 16);
    void this.strollAway(man);
  }

  /** Фонарь не ставим на дорожку к двери и на подъезд к складу. */
  private lampAt(x: number): boolean {
    const { door, warehouse } = this.layout;
    return Math.abs(x - door.x) > 20 && Math.abs(x - (warehouse.x + warehouse.w / 2)) > 18;
  }

  /** Светящийся слой поверх темноты: виден только вечером. */
  private nightGlow<T extends NightLight['obj']>(obj: T, alpha: number, neon?: number, extra: { from?: number; twinkle?: number } = {}): T {
    obj.setBlendMode(Phaser.BlendModes.ADD).setDepth(LIGHT_DEPTH + 1).setAlpha(0);
    this.nightLights.push({ obj, alpha, neon, ...extra });
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
    this.buildBobik(door.x - 24, atStreet ? top + 8.5 : front + 10);
    // Подсолнухи, которые посадила Соня, — у самого входа.
    if (sunflowersPlanted(this.state)) {
      const y = atStreet ? top + 8.5 : front + 10;
      this.art(door.x - 11, y + 2, 'sunflowers').setOrigin(0.5, 1).setDepth(y + 3);
    }
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
  /** Объём зала: у стен пол чуть темнее — туда меньше света, и зал не выглядит плоской заливкой. */
  private floorLight(w: number, h: number, wallH: number): void {
    const g = this.add.graphics().setDepth(0.5);
    const ink = 0x181425;
    g.fillGradientStyle(ink, ink, ink, ink, 0.26, 0.26, 0, 0);
    g.fillRect(0, wallH, w, 14);
    g.fillGradientStyle(ink, ink, ink, ink, 0.16, 0, 0.16, 0);
    g.fillRect(0, wallH, 10, h - wallH);
    g.fillGradientStyle(ink, ink, ink, ink, 0, 0.16, 0, 0.16);
    g.fillRect(w - 10, wallH, 10, h - wallH);
  }

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
    const style = this.facadeStyle();
    this.add.tileSprite(-WALL, h, w + 2 * WALL, FACADE_H, style.texture).setOrigin(0).setTileScale(1 / ART).setDepth(h + 1);
    this.doorImg = this.art(door.x, h + 5, 'door').setDepth(h + 2);
    this.doorSign = this.art(door.x + 11, h + 8, this.running ? 'door_sign_open' : 'door_sign_closed').setDepth(h + 42);
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
        if (!style.canopy) this.art(x, h + 1.5, 'awning_small').setTint(style.awning ?? 0xffffff).setDepth(h + 40);
        this.windowLight(x, h + 5.5, h + 9);
      }
    }
    // Из дверей свет падает дорожкой на тротуар.
    this.nightGlow(this.art(door.x, h + 9, 'light_spill').setOrigin(0.5, 0).setScale(1.3 / ART, 1.4 / ART).setTint(0xffd890), 0.55);
    // Главный навес над входом: покупатели проходят под ним.
    this.art(door.x, h + 1, 'awning').setScale(1 / ART, 0.6 / ART).setTint(style.canopy ?? style.awning ?? 0xffffff).setDepth(h + 41);
    if (style.canopy) {
      // Сплошной козырёк над витринами; у супермаркета снизу светится полоса.
      this.add.rectangle(-WALL, h - 1, w + 2 * WALL, 3, style.canopy).setOrigin(0).setStrokeStyle(0.5, 0x181425).setDepth(h + 40);
      this.add.rectangle(-WALL, h + 2, w + 2 * WALL, 1, 0x181425, 0.25).setOrigin(0).setDepth(h + 40);
      if (style.led) {
        this.add.rectangle(-WALL, h + 1.5, w + 2 * WALL, 0.6, 0x9cd8ff).setOrigin(0).setDepth(h + 40.5);
        this.nightGlow(this.add.rectangle(-WALL, h + 1, w + 2 * WALL, 3, 0x9cd8ff).setOrigin(0), 0.6);
      }
    }
  }

  private facadeStyle(): (typeof FACADE_STYLES)[number] {
    return FACADE_STYLES[Math.min(this.state.level, FACADE_STYLES.length - 1)];
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
    // Место ларя обходят всегда, как и места под полки: его могут поставить утром.
    const ice = this.iceboxSpot();
    this.obstacles.push({ x: ice.x - 16, y: ice.y - 10, w: 32, h: 18 });
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
    this.dumpImg = this.art(dump.x, dump.y, 'dumpster').setDepth(dump.y + 8);
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
  private windowLight(x: number, glassY: number, groundY: number, up = false, from?: number): void {
    this.nightGlow(this.add.rectangle(x, glassY, 18, 5, 0xffc870), 0.5, undefined, { from });
    // У зданий за дорогой витрины смотрят вверх, на их тротуар.
    const spill = this.art(x, groundY, 'light_spill').setOrigin(0.5, up ? 1 : 0).setFlipY(up).setTint(0xffd08a);
    this.nightGlow(spill, 0.6, undefined, { from });
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
    this.sunPatches = [];
    for (let x = 30, i = 0; x < wc.x - 16; x += 64, i++) {
      this.art(x, 12, i % 2 ? 'window' : art).setDepth(1);
      // Из окна на пол ложится солнечное пятно (updateDaylight).
      if (i % 2) {
        const patch = this.art(x, wallH + 2, 'light_spill').setOrigin(0.5, 0).setScale(1 / ART, 1.5 / ART).setTint(0xffe9a8).setAlpha(0).setDepth(0.45);
        patch.setData('x', x);
        this.sunPatches.push(patch);
      }
    }
    if (62 < wc.x - 16) {
      if (activeDecor(this.state, 'neon')) {
        const glow = this.art(62, 14, 'glow').setScale(46 / 64, 24 / 64).setTint(0xf6757a).setBlendMode(Phaser.BlendModes.ADD).setDepth(1);
        this.tweens.add({ targets: glow, alpha: { from: 0.8, to: 0.4 }, duration: 900, yoyo: true, repeat: -1 });
        this.art(62, 13, 'neon').setDepth(2);
      } else {
        this.art(62, 11, 'clock_face').setDepth(1);
        this.clockHands = this.add.graphics({ x: 62, y: 11 }).setDepth(1.1);
      }
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
      // В нижнем углу у кассы — вёдра с цветами, растение туда не ставим.
      ...(this.state.shelves.some((s) => s.kind === 'florist') ? [] : [{ x: w - 9, y: h - 40 }]),
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
    const { warehouse, bakery, coffee, kitchen } = this.layout;
    return [warehouse, ...(this.bakeryOpen() ? [bakery] : []), ...(this.coffeeOpen() ? [coffee] : []), ...(kitchen && kitchenOpen(this.state) ? [kitchen] : [])];
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
    if (this.layout.kitchen) cap(left + WALL, this.layout.coffee.y - WALL, wing.w, WALL);
    this.add.tileSprite(left, h, WING_OUTER - WALL, FACADE_H, this.facadeStyle().texture).setOrigin(0).setTileScale(1 / ART).setDepth(h + 1);
    const gateX = warehouse.x + warehouse.w / 2;
    this.art(gateX, h + 5.5, 'shutter').setDepth(h + 2);
    // Подъезд от тротуара к воротам склада.
    const top = this.next.h + 4;
    if (top > h + FACADE_H) this.add.tileSprite(gateX - 12, h + FACADE_H, 24, top - h - FACADE_H, 'paving').setOrigin(0).setTileScale(1 / ART).setDepth(-9);
    this.buildRoom(bakery, 'bakery', this.bakeryOpen());
    this.buildRoom(coffee, 'coffee', this.coffeeOpen());
    if (this.layout.kitchen) this.buildRoom(this.layout.kitchen, 'kitchen', kitchenOpen(this.state));
    this.buildKitchen();
  }

  /** Кухня: плита, стол с готовыми блюдами и табличка, сколько порций осталось. */
  private buildKitchen(): void {
    this.kitchenLabel = undefined;
    const room = this.layout.kitchen;
    if (!room || !kitchenOpen(this.state)) return;
    this.art(room.x + 11, room.y + 26, 'oven1').setTint(0xd8dce8).setDepth(room.y + 35);
    this.art(room.x + 30, room.y + 40, 'baker_table').setDepth(room.y + 46);
    this.kitchenLabel = this.add
      .text(room.x + 30, room.y + 31, '', { fontFamily: UI_FONT, fontSize: '5px', fontStyle: 'bold', color: '#2b2233', backgroundColor: 'rgba(255, 246, 200, 0.9)', padding: { x: 1.5, y: 0.5 } })
      .setOrigin(0.5)
      .setResolution(5)
      .setDepth(room.y + 47);
    this.refreshKitchen();
  }

  /** Сколько каких порций на кухне — на табличке у стола. */
  private refreshKitchen(): void {
    if (!this.kitchenLabel?.active) return;
    const text = DISH_IDS.filter((id) => portionsOf(this.state, id) > 0)
      .map((id) => `${DISHES[id].icon}${portionsOf(this.state, id)}`)
      .join(' ');
    this.kitchenLabel.setText(text).setVisible(text !== '');
  }

  /**
   * Дверь из зала во флигель: порог, деревянные косяки, створка открыта внутрь комнаты,
   * коврик в зале. Куда ведёт дверь — видно по табличке внутри самой комнаты.
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
  }

  /** Комната флигеля: пол, кусок стены с табличкой; закрытая — тёмная, с замком. */
  private buildRoom(room: Room, kind: 'bakery' | 'coffee' | 'kitchen', open: boolean): void {
    const { x, y, w, h } = room;
    this.add.tileSprite(x, y, w, h, kind === 'coffee' ? 'floor_wood' : 'floor2').setOrigin(0).setTileScale(1 / ART);
    this.add
      .tileSprite(x, y, w, 14, 'wall')
      .setOrigin(0)
      .setTileScale(1 / ART)
      .setTint(kind === 'bakery' ? 0xffe2d2 : kind === 'kitchen' ? 0xd8f0d8 : 0xe6dcf6)
      .setDepth(1);
    this.add.rectangle(x, y + 14, w, 2, 0x181425, 0.18).setOrigin(0).setDepth(1);
    this.roomSign(x, y + 7, w, t(`wing.${kind}`));
    if (open) {
      this.nightGlow(this.art(x + w / 2, y + 26, 'glow').setScale(44 / 64).setTint(kind === 'bakery' ? 0xffd8a0 : 0xffe8c8), 0.5);
      // Мелочи: на стене слева от таблички — меню, банки или сковородки; у двери — коврик.
      this.art(x + 13, y + 7, kind === 'coffee' ? 'menu_chalk' : kind === 'bakery' ? 'jar_shelf' : 'pot_rack').setDepth(2);
      if (kind === 'bakery') this.art(x + w - 8, y + h - 8, 'flour_sacks').setDepth(y + h - 2);
      this.add.rectangle(x + w - 3, room.doorway.y, 4, 14, 0x9e5b33).setStrokeStyle(1, 0x5a3420).setDepth(1.5);
      return;
    }
    this.add.rectangle(x, y + 16, w, h - 16, 0x1d1a26, 0.62).setOrigin(0).setDepth(y + h);
    this.add
      .text(x + w / 2, y + h / 2 + 6, `🔒\n${t(`wing.${kind}Locked`)}`, { fontFamily: UI_FONT, fontSize: '5px', color: '#c0cbdc', align: 'center' })
      .setOrigin(0.5)
      .setResolution(4)
      .setDepth(y + h + 1);
  }

  /**
   * Табличка комнаты флигеля по ширине надписи — у двери в зал (справа): её видно,
   * даже когда флигель в кадре краем.
   */
  private roomSign(x: number, y: number, w: number, text: string): void {
    const label = this.add.text(0, y, text, { fontFamily: UI_FONT, fontSize: '6px', fontStyle: 'bold', color: '#fee761' }).setOrigin(0.5).setResolution(4);
    const plateW = Math.min(w - 4, label.width + 6);
    const cx = x + w - 2 - plateW / 2;
    label.setX(cx).setDepth(y + 61);
    this.add.rectangle(cx, y, plateW, 9, 0x3b2a35).setStrokeStyle(1, 0xb86f50).setDepth(y + 60);
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
    this.roomSign(x, y + 7, w, t('warehouse.label'));
  }

  /** Создаёт картинки для новых полок и обновляет товар на всех. */
  private refreshShelves(): void {
    this.layout.slots.forEach((slot, i) => {
      // Свободное место под полку — разметка на полу: полку покупают утром во вкладке «Зал».
      if (!this.slotDecor[i]) {
        const mark = this.art(slot.x, slot.y + 2, 'slot_empty').setDepth(1.5);
        mark.setInteractive({ useHandCursor: true }).on('pointerup', () =>
          this.tap(() => i >= this.regularShelves() && this.popup(slot.x, slot.y - 8, t('popup.slotEmpty'), '#fff3b0')),
        );
        this.slotDecor[i] = mark;
      }
      this.slotDecor[i].setVisible(i >= this.regularShelves());
    });
    // Полок стало меньше (продали) — лишние картинки убираем.
    for (const view of this.shelfViews.splice(this.state.shelves.length)) this.destroyShelfView(view);
    this.state.shelves.forEach((shelf, i) => {
      let view = this.shelfViews[i];
      const at = this.spotOf(i);
      // Полку пересобираем, если сменился тип или место (после продажи соседней).
      if (!view || view.kind !== shelf.kind || view.at.x !== at.x || view.at.y !== at.y) {
        if (view) this.destroyShelfView(view);
        view = this.buildShelf(i, shelf.kind);
        this.shelfViews[i] = view;
      }

      const capacity = shelfCapacity(shelf);
      const perRow = capacity / 2;
      const area = ITEM_AREA[shelf.kind] ?? { x: -17, w: 34, y: -5, row: 11 };
      const step = area.w / perRow;
      // Где на полке просторно, товар крупнее — его лучше видно; плотная полка — обычный размер.
      const size = (shelf.kind === 'florist' ? 1 : Phaser.Math.Clamp(step / 4, 1, 1.3)) / ART;
      const slot = at;
      const units = PRODUCT_IDS.flatMap((id) => (shelf.items[id] ?? []).map((unit) => ({ id, unit })));
      const covered = false;
      view.items.forEach((img, n) => {
        const entry = units[n];
        const florist = shelf.kind === 'florist';
        img.setVisible(!covered && n < (florist ? FLORIST_SPOTS.length : capacity) && Boolean(entry));
        if (florist) {
          const [dx, dy] = FLORIST_SPOTS[n % FLORIST_SPOTS.length];
          img.setPosition(slot.x + dx, slot.y + dy);
        } else img.setPosition(slot.x + area.x + step * ((n % perRow) + 0.5), slot.y + area.y + Math.floor(n / perRow) * area.row);
        if (entry) {
          // Три вида каждого товара (батон, багет, булка…) — полка выглядит живой.
          img.setTexture(`item_${entry.id}_${(n + PRODUCT_IDS.indexOf(entry.id)) % ITEM_VARIANTS}`).setScale(size);
          img.setTint(entry.unit.markdown ? 0xffe08a : entry.unit.bad ? 0x9a8a80 : 0xffffff);
        }
        // Позади — такой же товар чуть выше и в тени, между передними.
        const back = view.backItems[n];
        back.setVisible(img.visible && shelf.kind !== 'florist');
        if (entry) {
          back.setPosition(Math.min(img.x + step / 2, slot.x + area.x + area.w - 2), img.y - 2);
          back.setTexture(`item_${entry.id}_${(n + PRODUCT_IDS.indexOf(entry.id) + 1) % ITEM_VARIANTS}`).setScale(size);
        }
      });
      view.pips.forEach((pip, n) => pip.setVisible(n < shelf.level));
      view.promo.setVisible(PRODUCT_IDS.some((id) => canPlace(id, shelf) && promoKind(this.state, id)));
      const few = !shelf.broken && units.length > 0 && units.length <= LOW_STOCK;
      if (few) view.low.setText(t('shelf.low', { n: units.length }));
      view.low.setVisible(few);
      view.expire.setVisible(!shelf.broken && expiringIn(this.state, shelf.items) > 0);
      view.needsStock = !shelf.broken && units.length === 0 && PRODUCT_IDS.some((id) => canPlace(id, shelf) && (this.state.warehouse[id]?.length ?? 0) > 0);
      view.bg.setTint(shelf.broken ? BROKEN_TINT : SHELF_LOOK[shelf.kind].tint);
    });
  }

  private buildShelf(index: number, kind: Category): ShelfView {
    const slot = this.spotOf(index);
    const look = SHELF_LOOK[kind];
    const fixture = SHELF_KINDS[kind].fixture;
    // У ларя и вёдер тень нарисована в самой картинке.
    const shadow = this.art(slot.x, slot.y + 12, 'shadow_wide').setDepth(slot.y - 15).setVisible(!fixture);
    // Мебель в виде «три четверти»: над передней частью видна крышка высотой FURNITURE_TOP.
    const top = fixture ? 0 : FURNITURE_TOP / 2;
    const bg = this.art(slot.x, slot.y - top, look.texture).setTint(look.tint).setDepth(slot.y - 14);
    const front = this.art(slot.x, slot.y - top, `${look.texture}_front`).setDepth(slot.y - 12);
    // Глубина по нижнему краю: ларь ниже обычной полки, его край — на 10 точек ниже центра.
    const d = kind === 'icebox' ? slot.y + 10 : slot.y;
    bg.setDepth(d - 14);
    front.setDepth(d - 12);
    const cover = undefined;
    bg.setInteractive({ useHandCursor: true }).on('pointerup', () => this.tap(() => this.restockShelf(index)));
    const items = Array.from({ length: SHELF_LEVELS[SHELF_LEVELS.length - 1].capacity }, () => this.art(slot.x, slot.y, 'item').setDepth(d - 13));
    const backItems = items.map(() => this.art(slot.x, slot.y, 'item').setDepth(d - 13.5).setTint(0x8f8278).setVisible(false));
    // Уровень улучшения — жёлтые точки над полкой.
    const pips = [0, 1, 2].map((n) => this.art(slot.x + (fixture ? -6 : -17) + n * 4, slot.y - (kind === 'florist' ? 18 : 16), 'pip').setDepth(d - 12));
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
    const expire = this.add
      .text(slot.x, slot.y - 30, t('shelf.expiring'), { fontFamily: UI_FONT, fontSize: '5px', fontStyle: 'bold', color: '#2b2233', backgroundColor: '#fee761', padding: { x: 2, y: 1 } })
      .setOrigin(0.5)
      .setResolution(6)
      .setDepth(991)
      .setVisible(false);
    expire.setInteractive({ useHandCursor: true }).on('pointerup', () => this.tap(() => this.markdownNow(expire.x, expire.y)));
    const lights: Phaser.GameObjects.GameObject[] = [];
    // Цветная плитка отдела под полкой и перед ней: отделы видно издалека.
    if (!fixture) lights.push(this.add.rectangle(slot.x, slot.y + 4, 50, 30, DEPT_FLOOR[kind]).setAlpha(0.3).setStrokeStyle(1, DEPT_FLOOR[kind], 0.7).setDepth(0.3));
    // На мраморе низ полки отражается в полу — бледно и перевёрнуто.
    if (!fixture && this.glossyFloor) {
      const mirror = this.art(slot.x, slot.y - top + 32, look.texture).setTint(look.tint).setFlipY(true).setAlpha(0.13).setDepth(0.6);
      mirror.setCrop(0, 40, 80, 24);
      lights.push(mirror);
    }
    // Крупный значок отдела поверх таблички на шапке: молоко, мясо и заморозку не спутать.
    if (!fixture) lights.push(this.art(slot.x, slot.y - top - 13, `dept_${kind}`).setDepth(d - 11.9));
    if (look.texture === 'fridge') {
      // Новые холодильники — с наклейкой класса энергосбережения.
      if (gearTier(this.state, 'fridge')) lights.push(this.art(slot.x + 13, slot.y - 15, 'eco_label').setDepth(slot.y - 11));
      const cool = kind === 'meat' ? 0xffd8d8 : 0xc8f0ff;
      // Блик на стекле — лёгкий: товар за ним должен быть хорошо виден.
      const glass = this.add.rectangle(slot.x, slot.y - 1.5, 36, 19, cool).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.03).setDepth(slot.y - 12.5);
      // Изморозь в углу стекла; у морозильника — в двух углах.
      lights.push(this.art(slot.x - 17, slot.y - 10.5, 'frost').setOrigin(0).setScale(1.3 / ART).setDepth(slot.y - 12.4));
      if (kind === 'frozen') lights.push(this.art(slot.x + 17, slot.y + 7.5, 'frost').setOrigin(0).setScale(1.3 / ART).setAngle(180).setDepth(slot.y - 12.4));
      this.tweens.add({ targets: glass, alpha: 0.07, duration: 1800 + index * 130, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const spill = this.art(slot.x, slot.y + 13, 'light_spill').setOrigin(0.5, 0).setScale(1.4 / ART, 0.5 / ART).setTint(cool);
      spill.setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3).setDepth(0.4);
      lights.push(glass, spill);
    }
    return { kind, at: { x: slot.x, y: slot.y }, cover, bg, front, shadow, items, backItems, pips, lights, low, expire, promo, glow, needsStock: false };
  }

  /** Уценить всё, что испортится ночью (на полках и складе), прямо в зале — по ценнику «⏳». */
  private markdownNow(x: number, y: number): void {
    const { state, count } = markdownExpiring(this.state);
    if (!count) return;
    this.state = state;
    saveGame(state);
    sound.coin();
    this.popup(x, y - 6, t('popup.markdown', { n: count }), '#fff3b0');
    this.refreshShelves();
  }

  private destroyShelfView(view: ShelfView): void {
    for (const obj of [view.bg, view.front, view.shadow, view.low, view.expire, view.promo, view.cover, ...view.items, ...view.backItems, ...view.pips, ...view.lights]) obj?.destroy();
  }

  /** Сколько обычных полок стоит на местах в зале (ларь и вёдра — не в счёт). */
  private regularShelves(): number {
    return this.state.shelves.filter((s) => !SHELF_KINDS[s.kind].fixture).length;
  }

  /** Где стоит полка: на своём месте в зале, ларь — в зале слева от входа, вёдра с цветами — у кассы. */
  private spotOf(index: number): { x: number; y: number } {
    const kind = this.state.shelves[index]?.kind;
    if (kind === 'icebox') return this.iceboxSpot();
    if (kind === 'florist') return this.floristSpot();
    return this.layout.slots[Math.max(0, slotOf(this.state, index))];
  }

  /** Куда встать, чтобы взять с полки: к полке — снизу, к ларю — сверху (со стороны зала), к вёдрам — слева. */
  private standOf(index: number): { x: number; y: number } {
    const p = this.spotOf(index);
    const kind = this.state.shelves[index]?.kind;
    if (kind === 'icebox') return { x: p.x, y: p.y - 16 };
    if (kind === 'florist') return { x: p.x - 14, y: p.y + 6 };
    return { x: p.x, y: p.y + 22 };
  }

  /** Путь из зала к полке. */
  private routeTo(index: number): { x: number; y: number }[] {
    return [this.standOf(index)];
  }

  /**
   * Ларь с мороженым — у нижней стены рядом со входом или у левой стены, там, где он не задевает
   * места под полки (layout.ts, iceboxSpotFor).
   */
  private iceboxSpot(): { x: number; y: number } {
    return iceboxSpotFor(this.layout);
  }

  /** Вёдра с цветами — у кассы, в углу у правой стены. */
  private floristSpot(): { x: number; y: number } {
    const { w, h } = this.layout;
    return { x: w - 10, y: h - 40 };
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
    const parts: Phaser.GameObjects.Image[] = [shadow];
    // Вещь из гардероба: слой поворачивается вместе с человеком; большие холсты стоят чуть выше.
    const wear = (key: string, tint?: number, big = false): Phaser.GameObjects.Image => {
      const img = this.art(0, big ? BIG_LAYER_DY : 0, key).setTint(tint ?? 0xffffff);
      img.setData('dy', big ? BIG_LAYER_DY : 0);
      layers.push([img, key]);
      return img;
    };
    // На спине (веер, плащ, гитара): за телом, а когда человек отвернулся — поверх (setFacing).
    const back = look.back ? wear(`w_back_${look.back}`, look.backTint, true) : undefined;
    if (back) parts.push(back);
    parts.push(legs, shirt);
    if (look.coat !== undefined) {
      const coat = this.art(0, 0, 'p_coat').setTint(look.coat);
      layers.push([coat, 'p_coat']);
      parts.push(coat);
    } else if (look.pattern) {
      // Светлая рубашка — тёмный узор, тёмная — светлый.
      const c = Phaser.Display.Color.IntegerToColor(look.shirt);
      const light = (c.red * 299 + c.green * 587 + c.blue * 114) / 1000 > 150;
      const tint = look.pattern === 'print' ? (light ? 0xe43b44 : 0xfee761) : light ? 0x262b44 : 0xffffff;
      const pat = this.art(0, 0, `p_pat_${look.pattern}`).setTint(tint).setAlpha(look.pattern === 'print' ? 1 : 0.45);
      layers.push([pat, `p_pat_${look.pattern}`]);
      parts.push(pat);
    }
    if (look.outfit) parts.push(wear(`w_outfit_${look.outfit}`, look.outfitTint));
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
    if (look.scarf !== undefined) {
      const scarf = this.art(0, 0, 'p_scarf').setTint(look.scarf);
      layers.push([scarf, 'p_scarf']);
      parts.push(scarf);
    }
    if (look.face) {
      const hairy = look.face === 'beard' || look.face === 'mustache';
      parts.push(wear(`w_face_${look.face}`, look.faceTint ?? (hairy ? (look.hair ?? 0x4a2c1a) : undefined)));
    }
    if (look.glasses) {
      const glasses = this.art(0, 0, 'acc_glasses');
      layers.push([glasses, 'acc_glasses']);
      parts.push(glasses);
    }
    parts.push(hair);
    if (look.hat) parts.push(wear(`w_hat_${look.hat}`, look.hatTint, true));
    if (look.prop) parts.push(wear(`w_prop_${look.prop}`, look.propTint, true));
    const person = this.add.container(x, y, parts).setDepth(y);
    if (back) person.setData('back', back);
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
    const companion = this.makePerson(leader.x - 8, leader.y + 1, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), this.state.day));
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

  /** Тележки стоят у входа: в большом магазине всегда, в «Магазинчике» — если куплены. */
  private cartsAtDoor(): boolean {
    return this.state.level >= 2 || (this.state.level >= 1 && hasUpgrade(this.state, 'cart'));
  }

  /** Покупатель берёт тележку у входа и катит её перед собой (как коляску). */
  private giveTrolley(person: Phaser.GameObjects.Container): void {
    const trolley = this.art(0, 9, 'trolley');
    person.add(trolley);
    person.setData('stroller', trolley);
    person.setData('push', 'trolley');
  }

  /** У выхода тележку оставляют. */
  private dropTrolley(person: Phaser.GameObjects.Container): void {
    if (person.getData('push') !== 'trolley') return;
    (person.getData('stroller') as Phaser.GameObjects.Image | undefined)?.destroy();
    person.setData('stroller', undefined);
    person.setData('push', undefined);
  }

  /** Коляска (или тележка) всегда впереди: снизу, сверху (за человеком) или сбоку. */
  private placeStroller(person: Phaser.GameObjects.Container, facing: Facing): void {
    const stroller = person.getData('stroller') as Phaser.GameObjects.Image | undefined;
    if (!stroller) return;
    const tex = (person.getData('push') as string | undefined) ?? 'stroller';
    if (facing === 'down') {
      stroller.setTexture(tex).setPosition(0, 9).setFlipX(false);
      person.bringToTop(stroller);
    } else if (facing === 'up') {
      stroller.setTexture(tex).setPosition(0, -5).setFlipX(false);
      person.sendToBack(stroller);
    } else {
      stroller.setTexture(`${tex}_s`).setPosition(facing === 'right' ? 11 : -11, 3).setFlipX(facing === 'left');
      person.bringToTop(stroller);
    }
  }

  /** Поворот: спереди, со спины или боком (левый бок — зеркальный правый). Значок охранника виден только спереди. */
  /**
   * Настроение на лице: радуется найденному товару, хмурится в долгой очереди.
   * С ms — через столько вернётся обычное лицо (если за это время его не сменили).
   */
  private setMood(person: Phaser.GameObjects.Container, mood: 'happy' | 'frown' | null, ms?: number): void {
    const layers = person.getData('layers') as [Phaser.GameObjects.Image, string][] | undefined;
    const entry = layers?.find(([, base]) => base.startsWith('p_skin'));
    if (!entry || !person.active) return;
    const base = mood ? `p_skin_${mood}` : 'p_skin';
    const token = ((person.getData('moodToken') as number | undefined) ?? 0) + 1;
    person.setData('moodToken', token);
    person.setData('mood', mood);
    entry[1] = base;
    entry[0].setTexture(base + VIEW_SUFFIX[(person.getData('facing') as Facing | undefined) ?? 'down']);
    if (ms) this.time.delayedCall(ms, () => person.getData('moodToken') === token && this.setMood(person, null));
  }

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
    const back = person.getData('back') as Phaser.GameObjects.Image | undefined;
    if (back) {
      if (facing === 'up') person.bringToTop(back);
      else person.moveTo(back, 1);
    }
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

  /** Волна запаха выпечки: три тёплые точки змейкой плывут из двери пекарни в зал. */
  private aromaWisp(): void {
    const door = this.layout.bakery.doorway;
    const wisp = this.add.container(door.x + 2, door.y - 6).setDepth(LIGHT_DEPTH - 2);
    for (let i = 0; i < 3; i++) wisp.add(this.add.rectangle(i * 3, Math.sin(i * 2) * 1.5, 2, 1, 0xfeae34, 0.85));
    this.tweens.add({ targets: wisp, x: wisp.x + Phaser.Math.Between(30, 60), y: wisp.y - Phaser.Math.Between(10, 24), alpha: 0, duration: 2200, onComplete: () => wisp.destroy() });
    this.tweens.add({ targets: wisp.list, y: '+=2', duration: 300, yoyo: true, repeat: 3, ease: 'Sine.easeInOut' });
  }

  /** Сколько терпения осталось у ждущего покупателя (1 — только встал, 0 — уходит). */
  private patienceLeft(c: Customer): number {
    return 1 - (this.time.now - c.waitStart) / (c.patienceMs ?? PATIENCE_MS);
  }

  /**
   * Очередь не стоит столбом: один из ждущих переминается, оглядывается, а когда ждать
   * надоело — смотрит на часы и вздыхает. Дети подпрыгивают на месте.
   */
  private queueIdle(): void {
    const waiting = [...this.queue, ...this.registers.map((r) => r.customer).filter((c): c is Customer => Boolean(c))].filter(
      (c) => !c.serving && !c.gone && c.sprite.active && !c.sprite.getData('walking'),
    );
    if (!waiting.length) return;
    const c = Phaser.Utils.Array.GetRandom(waiting);
    const p = c.sprite;
    const left = this.patienceLeft(c);
    const base = (p.getData('baseScale') as number) ?? 1;
    if (base < 1) {
      this.tweens.add({ targets: p, y: p.y - 2, duration: 120, yoyo: true, repeat: 1, ease: 'Quad.easeOut' });
      return;
    }
    if (left < 0.6 && Math.random() < 0.6) {
      this.emote(p, Math.random() < 0.55 ? 'emo_clock' : 'emo_sigh');
      return;
    }
    if (Math.random() < 0.5) {
      // Переминается с ноги на ногу.
      this.tweens.add({ targets: p, x: p.x + 0.7, duration: 160, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' });
      return;
    }
    // Оглядывается по сторонам и снова смотрит вперёд.
    const facing = (p.getData('facing') as Facing | undefined) ?? 'up';
    this.setFacing(p, 'left');
    this.time.delayedCall(450, () => p.active && !p.getData('walking') && this.setFacing(p, 'right'));
    this.time.delayedCall(900, () => p.active && !p.getData('walking') && this.setFacing(p, facing));
  }

  /** Продавец без покупателей: протирает прилавок, к вечеру зевает. */
  private sellerIdle(): void {
    const s = this.seller;
    if (!s?.active || this.sellerBusy || this.ownerScanning() || s.getData('walking') || this.waiting() > 0) return;
    const { counter } = this.layout;
    if (Math.hypot(s.x - counter.x, s.y - counter.y) > 40) return;
    if (this.evening > 0.4 && Math.random() < 0.45) {
      this.emote(s, 'emo_zzz');
      this.setMood(s, 'frown', 1200);
      return;
    }
    // Тряпка ходит по прилавку, на чистом поблёскивает.
    const rag = this.add.rectangle(counter.x - 5, counter.y - 6, 4, 2, 0x9cd8ff).setStrokeStyle(0.5, 0x3a4466).setDepth(counter.y + 25);
    this.tweens.add({
      targets: rag,
      x: counter.x + 5,
      duration: 260,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        rag.destroy();
        const shine = this.art(counter.x + 3, counter.y - 8, 'spark').setScale(0.6 / ART).setDepth(counter.y + 26);
        this.tweens.add({ targets: shine, alpha: 0, scale: 1.2 / ART, angle: 90, duration: 500, onComplete: () => shine.destroy() });
      },
    });
    const base = (s.getData('baseScale') as number) ?? 1;
    this.tweens.add({ targets: s, scaleY: base * 1.04, duration: 130, yoyo: true, repeat: 2, onComplete: () => s.setScale(base) });
  }

  /** Все в зале оборачиваются на кассу: что-то случилось (серия, рекорд). */
  private everyoneLooks(x: number, y: number, key: EmoteKey, share = 0.35): void {
    for (const c of this.customers) {
      const p = c.sprite;
      if (!p.active || c.gone || p.getData('walking') || p.y > this.layout.h) continue;
      const dx = x - p.x;
      const dy = y - p.y;
      this.setFacing(p, Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down');
      if (Math.random() < share) this.time.delayedCall(Phaser.Math.Between(0, 300), () => this.emote(p, key));
    }
  }

  /** Эмоция над головой: всплывает и тает. */
  private emote(person: Phaser.GameObjects.Container, key: EmoteKey): void {
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
    const slot = this.spotOf(index);
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
    // К ларю на улице — через дверь и обратно.
    const route = this.routeTo(index);
    const stand = route[route.length - 1];
    const back = route.slice(0, -1).reverse();
    const trip: ChoreStep[] = [
      { ...doorway },
      { ...pickup, ms: PICKUP_MS, action: () => this.carried.setTexture('box').setPosition(0, 3).setVisible(true) },
      { ...doorway },
      ...route.slice(0, -1).map((p) => ({ ...p })),
      {
        x: stand.x,
        y: stand.y - (shelf.kind === 'icebox' ? 0 : 2),
        ms: PLACE_MS,
        action: () => {
          this.carried.setVisible(false);
          this.stockShelf(index, this.seller);
        },
      },
      ...back.map((p) => ({ ...p })),
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
          // Свежий товар поблёскивает; из коробки сыплется пыль.
          if (n === fresh.length - 1) this.freshShine(index);
        },
      });
    });
  }

  private freshShine(index: number): void {
    const view = this.shelfViews[index];
    if (!view) return;
    const { x, y } = view.at;
    for (let i = 0; i < 3; i++) {
      const spark = this.art(x + Phaser.Math.Between(-15, 15), y - Phaser.Math.Between(2, 12), 'spark').setScale(0.4 / ART).setDepth(y + 5);
      this.tweens.add({ targets: spark, scale: 1 / ART, angle: 90, alpha: 0, delay: i * 120, duration: 450, onComplete: () => spark.destroy() });
    }
    for (let i = 0; i < 3; i++) this.steamPuff(x + Phaser.Math.Between(-10, 10), y + 12, 0xc8b8a0);
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
    const fridges = this.state.shelves.map((s, i) => ({ s, i })).filter(({ s }) => SHELF_KINDS[s.kind].fridge && !SHELF_KINDS[s.kind].fixture);
    if (!fridges.length) return;
    const slot = this.spotOf(Phaser.Utils.Array.GetRandom(fridges).i);
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
    this.managerOnFloor = false;
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
    this.managerOnFloor = true;
    while (this.alive(gen)) {
      if (!this.running) {
        await this.wait(400);
        continue;
      }
      // Заказ на дом: звонит телефон — менеджер берёт трубку сам; принятый — собирает и несёт курьеру.
      if (this.parcel !== null && !this.courierBusy) {
        await this.packParcel(w, gen);
        continue;
      }
      if (this.order && this.phone && !this.courierBusy) {
        await this.workerWalk(w, this.phone.x - 10, this.phone.y + 14);
        if (!this.alive(gen)) return;
        if (this.order) this.acceptOrder();
        continue;
      }
      const pick = managerPick(this.state);
      if (pick && !this.urgentOrders.some((o) => o.id === pick)) {
        const qty = URGENT_QTYS[0];
        if (this.orderUrgentDelivery(pick, qty, true)) this.popup(w.sprite.x, w.sprite.y - 20, t('popup.managerOrder', { icon: PRODUCTS[pick].icon }), '#fff3b0');
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
  private orderUrgentDelivery(id: ProductId, qty: number, byManager = false): boolean {
    const next = orderUrgent(this.state, id, qty, this.urgentOnTheWay(), byManager);
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
    ambience.carPass(isWet(this.weather));
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
      const route = this.routeTo(index);
      await this.workerWalk(w, doorway.x, doorway.y);
      await this.workerWalk(w, pickup.x, pickup.y);
      await this.workerWait(w, PICKUP_MS);
      if (!this.alive(gen)) return;
      w.carried.setVisible(true);
      await this.workerWalk(w, doorway.x, doorway.y);
      for (const p of route) await this.workerWalk(w, p.x, p.y);
      await this.workerWait(w, PLACE_MS);
      if (!this.alive(gen)) return;
      w.carried.setVisible(false);
      this.stockShelf(index, w.sprite);
      // От ларя на улице — обратно в зал через дверь.
      for (const p of route.slice(0, -1).reverse()) await this.workerWalk(w, p.x, p.y);
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
      const score = (runningOut ? 100 : 0) + free;
      if (score > bestScore) [best, bestScore] = [i, score];
    });
    return best;
  }

  // ---------- Проверка ----------

  /** Инспектор обходит полки, туалет и кассу, потом выносит решение. */
  private async runInspector(): Promise<void> {
    this.inspector = 'here';
    const { door, wc, sellerHome } = this.layout;
    const start = this.streetSpawn();
    const sprite = this.makePerson(start.x, start.y, { shirt: INSPECTOR_SHIRT, skin: SKINS[0], pants: INSPECTOR_SHIRT, hair: 0x181425, style: 'short' });
    const look = (x: number, y: number) => this.walk(sprite, x, y, 35).then(() => this.wait(700));
    this.popup(door.x, door.y - 24, t('popup.inspector'), '#fff3b0');
    haptic.tap();
    sound.bell();
    await this.walk(sprite, door.x, this.streetY, 35);
    await this.walk(sprite, door.x, door.y - 10, 35);
    // Полки в зале и вёдра у кассы (ларь у входа он видел, когда заходил).
    for (const i of this.state.shelves.map((_, i) => i)) if (this.state.shelves[i].kind !== 'icebox') await look(this.standOf(i).x, this.standOf(i).y);
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

  /** Соня заходит после школы: стоит у прилавка рядом с папой, потом уходит. */
  private async runSonya(): Promise<void> {
    this.sonya = 'here';
    const { door, sellerHome } = this.layout;
    const start = this.streetSpawn();
    const sprite = this.makePerson(start.x, start.y, SONYA);
    await this.walk(sprite, door.x, this.streetY, 40);
    await this.walk(sprite, door.x, door.y - 10, 40);
    await this.walk(sprite, sellerHome.x - 18, sellerHome.y + 8, 40);
    if (!this.sys.isActive()) return;
    this.heartAt(sprite.x, sprite.y - 14);
    this.popup(sprite.x, sprite.y - 20, t('drama.visit'), '#fff3b0');
    await this.wait(9000);
    await this.walk(sprite, door.x, door.y - 10, 40);
    await this.walk(sprite, door.x, this.layout.h + 16, 40);
    void this.strollAway(sprite);
    this.sonya = 'done';
  }

  /** Жюри конкурса: трое заходят вместе, обходят полки, что-то записывают и уходят. */
  private async runJury(): Promise<void> {
    this.jury = 'here';
    const { door, slots, sellerHome } = this.layout;
    const start = this.streetSpawn();
    this.popup(door.x, door.y - 24, t('popup.jury'), '#fee761');
    haptic.tap();
    sound.bell();
    const walkOne = async (look: Look, i: number) => {
      await this.wait(i * 700);
      const sprite = this.makePerson(start.x + i * 6, start.y, look);
      const dx = (i - 1) * 9;
      await this.walk(sprite, door.x + dx, this.streetY, 32);
      await this.walk(sprite, door.x + dx, door.y - 10, 32);
      const order = slots.map((_, k) => k).filter((k) => k % 3 === i % 3 || slots.length < 4);
      for (const k of order.slice(0, 3)) {
        await this.walk(sprite, slots[k].x + dx / 2, slots[k].y + 22, 32);
        if (!this.sys.isActive()) return;
        this.popup(sprite.x, sprite.y - 16, t('popup.juryNote'), '#ffffff');
        await this.wait(900);
      }
      await this.walk(sprite, sellerHome.x - 24 + dx, sellerHome.y - 8, 32);
      await this.wait(600);
      await this.walk(sprite, door.x + dx, this.layout.h + 16, 32);
      void this.strollAway(sprite);
    };
    await Promise.all(JURY_LOOKS.map((look, i) => walkOne(look, i)));
    this.jury = 'done';
  }

  // ---------- Покупатели ----------

  private spawnCustomer(forced?: { look: Look; at: Phaser.Types.Math.Vector2Like }): void {
    const thief = !forced && Math.random() < thiefChance(this.state.level) * cameraTheft(this.state) * eyeTheft(this.state);
    const valya = !forced && !thief && !this.night && !this.valyaCame && this.state.day > 1 && Math.random() < 0.15;
    const shirt = thief ? THIEF_SHIRT : valya ? VALYA.shirt : Phaser.Utils.Array.GetRandom(SHIRTS);
    // Блогер сегодня снимает обзор — редкие гости заходят вдвое чаще.
    const rareChance = rareGuestChance(this.state.level) * (activeAd(this.state)?.id === 'blogger' ? 2 : 1);
    const rare = !forced && !thief && !valya && !this.night && Math.random() < rareChance ? pickRareGuest(this.state, Math.random) : null;
    let look: Look = forced
      ? forced.look
      : rare
      ? (rare.look as Look)
      : valya
        ? VALYA
        : thief
          ? { ...randomLook(shirt), style: 'long' as const, hair: THIEF_SHIRT }
          : this.night
            ? nightLook()
            : withCompanionItems(customerLook(shirt, this.state.day));
    // Ночью — гость с характером: свой образ, свой список и реплика у входа (nightGuests.ts).
    const nightGuest = this.night && !forced && !thief && !rare && !valya ? pickNightGuest(Math.random) : null;
    if (nightGuest) look = nightGuestLook(nightGuest);
    const big = bigDayFor(this.state.day);
    if (!rare && !thief && !valya) {
      // Ремонт дороги: рабочие в касках приходят за обедом. Болезнь: почти все в масках.
      if (big === 'roadworks' && !forced && !this.night && Math.random() < ROADWORKERS) look = { ...look, ...wearOf('builder', Math.random) };
      if (big && BIG_DAYS[big].masks && !look.face && Math.random() < MASKS) look = { ...look, face: 'medmask' };
    }
    // Гость из здания района: свой образ и свой список покупок (district.ts).
    let wants: ProductId[] | undefined;
    const fromDistrict = !forced && !rare && !thief && !valya && !this.night ? districtGuest(this.state, Math.random) : null;
    if (nightGuest) {
      const sellable = sellableProducts(this.state);
      const pool = NIGHT_GUEST_TYPES[nightGuest].wants.filter((id) => sellable.includes(id));
      if (pool.length) wants = Phaser.Utils.Array.Shuffle([...pool]).slice(0, Phaser.Math.Between(1, 2));
    }
    if (fromDistrict) {
      const sellable = sellableProducts(this.state);
      const pool = fromDistrict.wants.filter((id) => sellable.includes(id));
      if (pool.length) {
        look = { ...look, ...wearOf(fromDistrict.look, Math.random) };
        wants = Phaser.Utils.Array.Shuffle([...pool]).slice(0, Phaser.Math.Between(1, 2));
      }
    }
    const start = forced?.at ?? this.streetSpawn();
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
    if (nightGuest && Math.random() < 0.45) {
      const line = t(`nightGuest.${nightGuest}.${Phaser.Math.Between(0, NIGHT_GUEST_TYPES[nightGuest].lines - 1)}` as TextKey);
      this.time.delayedCall(1300, () => sprite.active && this.popup(sprite.x, sprite.y - 16, line, '#cfe8ff'));
    }
    if (valya) {
      this.valyaCame = true;
      this.time.delayedCall(1500, () => this.popup(sprite.x, sprite.y - 16, t('popup.valya'), '#fff3b0'));
    }
    const bubble = this.art(0, -14, 'bubble').setVisible(false);
    sprite.add(bubble);
    const customer: Customer = { sprite, bubble, items: [], unhappy: false, waitStart: 0, gone: false, thief, rare: rare?.id, wants };
    // Вора без охранника видно по красному контуру — его можно поймать касанием. Редкий гость — в золотом.
    if (thief && !this.workers.has('guard')) sprite.postFX?.addGlow(0xe43b44, 3, 0, false, 0.1, 6);
    if (rare) sprite.postFX?.addGlow(0xfee761, 3, 0, false, 0.1, 6);
    this.customers.add(customer);
    if (thief) {
      // Вора можно поймать касанием.
      sprite.setSize(16, 22).setInteractive({ useHandCursor: true }).on('pointerup', () => this.tap(() => this.catchThief(customer, 'owner')));
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
    const wanted = this.wanted(Phaser.Math.Between(1, 2) + bigDayExtraItems(this.state.day));
    for (const id of wanted) {
      const index = shelfFor(this.state, id);
      // Ларь у входа на виду — вор туда не идёт.
      if (index < 0 || c.gone || this.state.shelves[index].kind === 'icebox') continue;
      const stand = this.standOf(index);
      await this.walk(c.sprite, stand.x + Phaser.Math.Between(-8, 8), stand.y);
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
      this.catchThief(c, 'guard');
      return;
    }
    // Бобик у входа лает — воришка с перепугу бросает товар.
    if (this.bobik?.active && c.items.length && Math.random() < DOG_DAY_CATCH) {
      this.bobikBark();
      this.catchThief(c, 'dog');
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
  private catchThief(c: Customer, by: 'owner' | 'guard' | 'dog'): void {
    if (c.gone || !this.running) return;
    c.sprite.disableInteractive();
    this.state = returnToShelf(this.state, c.items);
    c.items = [];
    this.refreshShelves();
    this.refreshWarehouse();
    this.stats.caught++;
    haptic.success();
    sound.good();
    this.popup(c.sprite.x, c.sprite.y - 14, t(by === 'guard' ? 'popup.guardCaught' : by === 'dog' ? 'popup.dogCaught' : 'popup.thiefCaught'), '#c8ffb0');
    void this.leave(c);
  }

  private async runCustomer(c: Customer): Promise<void> {
    const { door } = this.layout;
    await this.walk(c.sprite, door.x, this.streetY);
    // Тележки у входа: часть покупателей берёт их — кому удобнее.
    if (this.cartsAtDoor() && Math.random() < CART_SHARE && !c.sprite.getData('stroller') && !c.thief) this.giveTrolley(c.sprite);
    const wanted = c.wants ?? this.wanted(Phaser.Math.Between(1, 2) + bigDayExtraItems(this.state.day));
    let disappointed = false;
    let why: { reason: LostReason; id: ProductId } | undefined;
    // Подойти, поискать глазами, взять: к полке в зале, к ларю у входа и к вёдрам у кассы — одинаково.
    const visit = async (id: ProductId, index: number) => {
      const stand = this.standOf(index);
      const fixture = SHELF_KINDS[this.state.shelves[index].kind].fixture;
      // Над головой облачко: что покупатель ищет.
      const thought = this.think(c.sprite, id);
      await this.walk(c.sprite, stand.x + Phaser.Math.Between(-8, 8) * (fixture ? 0.4 : 1), stand.y);
      await this.wait(500);
      // Пока шёл — магазин захватили (или ушёл по другой причине): к полке уже не тянется.
      if (c.gone) {
        this.endThought(thought, false);
        return;
      }
      const result = this.tryTake(c, id);
      this.reachShelf(c, this.spotOf(index), result === 'taken' ? id : null);
      if (result === 'taken' && c.sprite.y < this.layout.h && Math.random() < SPILL_CHANCE) this.spill(c.sprite.x, c.sprite.y + 2);
      const failed = result === 'empty' || result === 'expensive' || result === 'eduard';
      this.endThought(thought, failed);
      if (failed) {
        disappointed = true;
        // Первая неудача — причина ухода, если покупатель так ничего и не возьмёт.
        why ??= { reason: result, id };
      }
    };
    await this.walk(c.sprite, door.x, door.y - 10);
    if (c.gone) return;
    // В дождь и снег с улицы несут грязь.
    const muddy = isWet(this.weather) || this.weather === 'snow';
    const mud = [...this.trash].filter((piece) => piece.texture.key === 'mud').length;
    if (muddy && mud < MAX_MUD && Math.random() < MUD_CHANCE * entranceMud(this.state)) this.dropTrash(this.layout.door.x, this.layout.door.y - 30, 'mud');

    if (c.regular) this.popup(c.sprite.x, c.sprite.y - 20, t('regular.hello', { name: t(regularById(c.regular).nameKey) }), '#fff3b0');
    if (c.friend) this.popup(c.sprite.x, c.sprite.y - 20, t('visit.hello', { name: c.friend.name }), '#fee761');
    for (const id of wanted) {
      if (c.gone) return;
      const index = shelfFor(this.state, id);
      if (index < 0) continue;
      await visit(id, index);
    }
    if (c.gone) return;

    if (Math.random() < TRASH_CHANCE) this.dropTrash(c.sprite.x, c.sprite.y);
    if (c.regular) this.regularVerdict(c);
    // Друг оставляет чаевые — больше, если у него самого магазин побольше.
    if (c.friend && c.items.length) {
      const tip = FRIEND_TIP * (c.friend.level + 1);
      this.state = { ...this.state, money: this.state.money + tip };
      this.popup(c.sprite.x, c.sprite.y - 28, t('visit.tip', { name: c.friend.name, n: tip }), '#fee761');
    }

    if (c.items.length === 0) {
      // Не нашёл товар или всё слишком дорого — ушёл недовольным, это бьёт по рейтингу.
      // Ночью после рабочего дня полупустые полки — норма: ночные гости рейтинг не роняют.
      if (disappointed && !this.night) {
        this.stats.lost++;
        if (why) noteLost(this.stats, why.reason, why.id);
      }
      await this.leave(c);
      return;
    }

    if (Math.random() < TOILET_CHANCE) await this.visitToilet(c);
    if (c.gone) return;
    await this.buyCoffee(c);
    if (c.gone) return;

    if (await this.useKiosk(c)) return;
    if (c.gone) return;
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
    c.patienceMs =
      PATIENCE_MS *
      catPatience(this.state) *
      climatePatience(this.state, weatherFor(this.state.day)) *
      charmPatience(this.state) *
      radioPatience(this.state) *
      signagePatience(this.state) *
      cartPatience(this.state) *
      (isCrowdDay(this.state.day) ? CROWD_PATIENCE : 1);
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
      loyaltyTolerance(this.state) *
      radioTolerance(this.state);
    // «2 по цене 1»: за штуку выходит вдвое дешевле.
    const bogo = promoKind(this.state, id) === 'bogo';
    const perUnit = bogo ? price / 2 : price;
    // Постоянный покупатель решает не по случаю, а по своей границе цены.
    const regular = c.regular ? regularById(c.regular) : undefined;
    const declines = regular?.favorite === id ? !acceptsPrice(this.state, regular, perUnit) : Math.random() >= buyChance(perUnit, fair);
    if (declines) {
      if (price <= fair) return 'skipped';
      this.popup(c.sprite.x, c.sprite.y - 14, t('popup.expensive'), '#ffd0d0');
      this.emote(c.sprite, 'emo_pricey');
      note(this.stats, 'expensive');
      return 'expensive';
    }
    const taken = takeFromShelf(this.state, index, id);
    if (!taken) return 'empty';
    if (id === 'bread' && this.aroma()) note(this.stats, 'fresh');
    // Заметно дешевле, чем ждали, — запомнят и напишут в отзыве.
    if (perUnit <= fair * CHEAP_RATIO) {
      note(this.stats, 'cheap');
      if (Math.random() < 0.25) this.popup(c.sprite.x, c.sprite.y - 14, t('popup.cheap'), '#d6f5c4');
    }
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
    // В блэкаут на весь район касса считает вручную — медленнее.
    const manual = this.powerCut ? BLACKOUT_CHECKOUT : 1;
    r.scan = { start: this.time.now, total: checkoutSeconds(timing, c.items.length) * 1000 * manual, byOwner };
    const { counter } = r;
    const index = this.registers.indexOf(r);
    const clerk = byOwner ? this.seller : (this.operator(index) as Worker | null)?.sprite;
    for (const { id } of c.items) {
      await this.wait(timing.item * 1000 * manual);
      if (!this.sys.isActive()) return;
      // Товар — на ленту, под красный луч сканера (вспышка), и дальше к кассиру в пакет.
      const item = this.art(c.sprite.x, c.sprite.y - 2, `item_${id}`).setScale(2 / ART).setDepth(1000);
      this.tweens.chain({
        targets: item,
        tweens: [
          { x: counter.x, y: counter.y - 8, duration: 180, ease: 'Quad.easeOut' },
          { x: r.clerk.x, y: r.clerk.y - 8, scale: 1 / ART, alpha: 0.3, duration: 160, ease: 'Quad.easeIn' },
        ],
        onComplete: () => item.destroy(),
      });
      this.time.delayedCall(170, () => {
        const flash = this.add.rectangle(counter.x, counter.y - 8, 10, 3, 0xff4a4a).setBlendMode(Phaser.BlendModes.ADD).setDepth(1001);
        this.tweens.add({ targets: flash, alpha: 0, scaleX: 1.6, duration: 160, onComplete: () => flash.destroy() });
      });
      // Кассир берёт товар: короткий кивок-подпрыгивание.
      if (clerk?.active) {
        const base = (clerk.getData('baseScale') as number) ?? 1;
        this.tweens.add({ targets: clerk, scaleY: base * 1.06, duration: 90, yoyo: true, onComplete: () => clerk.setScale(base) });
      }
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
    // Кассир отдаёт пакет из рук в руки (с тележкой — товар уже в ней).
    if (c.items.length && c.sprite.getData('push') !== 'trolley' && c.sprite.active) {
      const bag = this.art(r.clerk.x, r.clerk.y - 6, 'paper_bag').setScale(0.85 / ART).setDepth(1000);
      await new Promise<void>((done) =>
        this.tweens.add({
          targets: bag,
          x: c.sprite.x + 6,
          y: c.sprite.y + 3,
          duration: 260,
          ease: 'Sine.easeInOut',
          onUpdate: (tw) => bag.setY(Phaser.Math.Linear(r.clerk.y - 6, c.sprite.y + 3, tw.progress) - Math.sin(tw.progress * Math.PI) * 8),
          onComplete: () => {
            bag.destroy();
            done();
          },
        }),
      );
      if (!this.sys.isActive()) return;
    }
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

    // С кухни на кассе докупают порцию готовой еды.
    const dish = c.thief || !c.items.length ? null : sellDish(this.state, Math.random);
    if (dish) {
      this.state = dish.state;
      const d = DISHES[dish.dish];
      c.extras = [...(c.extras ?? []), { kind: 'dish', price: d.price }];
      this.popup(c.sprite.x, c.sprite.y - 26, t('popup.dish', { icon: d.icon, name: t(`dish.${dish.dish}` as TextKey), n: d.price }), '#c8ffb0');
      this.refreshKitchen();
    }
    const { state, total: goods } = checkout(this.state, c.items, this.night ? NIGHT_MARKUP : 1);
    // Шоколадка и кофе — сверху к товару.
    const extras = (c.extras ?? []).reduce((sum, e) => sum + e.price, 0);
    const total = goods + extras;
    this.state = { ...state, money: state.money + extras };
    for (const e of c.extras ?? []) if (e.kind !== 'dish') note(this.stats, e.kind);
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
    // Пакет, который передал кассир, теперь в руке: с ним покупатель и уходит.
    if (c.items.length && c.sprite.getData('push') !== 'trolley') {
      c.sprite.add(this.art(6, 3, 'paper_bag').setScale(0.85 / ART));
    }
    const shown = where ?? (at ? { x: at.counter.x + (at === this.registers[0] ? 8 : -8), y: at.counter.y + 0 } : { x: this.layout.sellerHome.x - 8, y: this.layout.sellerHome.y - 18 });
    this.popup(shown.x, shown.y, `+${total} 💰`, '#c8ffb0');
    this.combo = this.time.now - this.lastSaleAt < COMBO_WINDOW_MS ? this.combo + 1 : 1;
    this.lastSaleAt = this.time.now;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
    // В серии монет летит больше.
    this.flyCoins(where?.x ?? at?.counter.x ?? this.layout.counter.x, where?.y ?? at?.counter.y ?? this.layout.counter.y, Math.min(6, 2 + Math.floor(total / 40)) + Math.min(this.combo - 1, 5));
    if (this.combo >= 2) this.celebrateCombo(this.combo);
    // Серия от пяти — весь зал оборачивается на кассу.
    if (this.combo === 5 || this.combo === 10) this.everyoneLooks(this.layout.counter.x, this.layout.counter.y, 'emo_star');

    const dirty = this.trash.size >= TRASH_COMPLAINT || this.binFull();
    const badGoods = hasUnmarkedBad(c.items) && Math.random() < BAD_COMPLAINT_CHANCE;
    if (c.unhappy || dirty || badGoods) {
      this.stats.complaints++;
      if (badGoods) note(this.stats, 'badGoods');
      else if (dirty) note(this.stats, 'dirty');
      const why = badGoods ? t('popup.badProduct') : dirty ? t('popup.dirty') : '😣';
      this.popup(c.sprite.x, c.sprite.y - 26, why, '#ffd0d0');
      this.emote(c.sprite, 'emo_angry');
      this.setMood(c.sprite, 'frown');
    } else {
      this.setMood(c.sprite, 'happy', 2500);
      if (Math.random() < 0.5) this.emote(c.sprite, 'emo_heart');
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
    if (!this.night) this.stats.lost++;
    note(this.stats, 'queue');
    noteLost(this.stats, 'queue');
    this.combo = 0;
    haptic.error();
    sound.bad();
    this.popup(c.sprite.x, c.sprite.y - 14, t('popup.leftAngry'), '#ffd0d0');
    this.emote(c.sprite, 'emo_angry');
    this.setMood(c.sprite, 'frown');
    this.layoutQueue();
    await this.leave(c);
  }

  private async leave(c: Customer, pastCounter = false): Promise<void> {
    c.gone = true;
    if (pastCounter) await this.walk(c.sprite, this.layout.queue.x, this.layout.counter.y + 40);
    await this.walk(c.sprite, this.layout.door.x, this.layout.h + 16);
    this.dropTrolley(c.sprite);
    this.customers.delete(c);
    void this.strollAway(c.sprite);
  }

  /** Прохожий идёт по тротуару, машина проезжает по дороге. */
  private streetLife(): void {
    const left = -60;
    const right = this.next.w + 60;
    // Наводнение: машины не ходят, людей на улице мало — зато по воде плавают лодки.
    const flood = this.bigObjs.length > 0 && bigDayFor(this.state.day) === 'flood';
    if (flood) {
      if (Math.random() < 0.12) this.rowBoat(left, right);
      if (Math.random() >= 0.12) return;
    }
    if (Math.random() < (flood ? 1 : 0.45)) {
      const fromLeft = Math.random() < 0.5;
      const y = this.streetY + Phaser.Math.Between(-5, 5);
      const person = this.makePerson(fromLeft ? left : right, y, withCompanionItems(customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), this.state.day)));
      this.addUmbrella(person);
      if (Math.random() < 0.1) this.addCompanion(person);
      void this.walk(person, fromLeft ? right : left, y, CUSTOMER_SPEED * Phaser.Math.FloatBetween(0.7, 1.1)).then(() => person.destroy());
    }
    if (flood) return;
    if (Math.random() < 0.14) this.passerby();
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
      ambience.carPass(isWet(this.weather));
      car.setScale(toRight ? 1 : -1, 1);
      this.tweens.add({ targets: car, x: toRight ? right : left, duration: Phaser.Math.Between(2600, 4200), onComplete: () => car.destroy() });
    }
  }

  /** Прохожие повеселее: велосипедист у края дороги, бегун, хозяин с собакой. */
  private passerby(): void {
    const left = -60;
    const right = this.next.w + 60;
    const fromLeft = Math.random() < 0.5;
    const roll = Math.random();
    const base = customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), this.state.day);
    if (roll < 0.4) {
      const y = this.streetY + 12;
      const rider = this.makePerson(fromLeft ? left : right, y, { ...base, hat: Math.random() < 0.5 ? 'bikehelmet' : base.hat, hatTint: 0xe43b44 });
      rider.addAt(this.art(0, 3, 'bike').setOrigin(0.5), 0);
      void this.walk(rider, fromLeft ? right : left, y, 70).then(() => rider.destroy());
      return;
    }
    const y = this.streetY + Phaser.Math.Between(-5, 5);
    if (roll < 0.7) {
      const runner = this.makePerson(fromLeft ? left : right, y, { ...base, outfit: 'runner', outfitTint: Phaser.Utils.Array.GetRandom(HAT_COLORS), hat: 'headband', hatTint: 0xffffff, coat: undefined, scarf: undefined });
      void this.walk(runner, fromLeft ? right : left, y, CUSTOMER_SPEED * 2.4).then(() => runner.destroy());
      return;
    }
    const walker = this.makePerson(fromLeft ? left : right, y, { ...base, dog: Phaser.Utils.Array.GetRandom(DOG_COLORS) });
    this.addUmbrella(walker);
    void this.walk(walker, fromLeft ? right : left, y, CUSTOMER_SPEED * 0.8).then(() => walker.destroy());
  }

  /** Наводнение: по затопленной дороге проплывает лодка с гребцом (иногда — с пассажиром). */
  private rowBoat(left: number, right: number): void {
    const toRight = Math.random() < 0.5;
    const y = this.streetY + Phaser.Math.Between(26, 40);
    const hull = this.art(0, 4, 'boat');
    const oar = this.art(4, 4, 'boat_oar').setOrigin(0.1, 0.2);
    const rower = this.makePerson(4, -4, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), this.state.day));
    this.people.delete(rower);
    rower.setScale(0.9);
    const parts: Phaser.GameObjects.GameObject[] = [rower, oar, hull];
    if (Math.random() < 0.4) {
      const guest = this.makePerson(-10, -4, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), this.state.day));
      this.people.delete(guest);
      guest.setScale(0.9);
      parts.unshift(guest);
    }
    const boat = this.add.container(toRight ? left : right, y, parts).setDepth(y);
    boat.setScale(toRight ? 1 : -1, 1);
    this.tweens.add({ targets: oar, angle: { from: -18, to: 22 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: boat, y: y + 1.2, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({
      targets: boat,
      x: toRight ? right : left,
      duration: Phaser.Math.Between(9000, 13000),
      onComplete: () => {
        this.tweens.killTweensOf(boat);
        this.tweens.killTweensOf(oar);
        boat.destroy();
      },
    });
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
      onComplete: () => {
        // На остановке выходят пассажиры и расходятся по тротуару.
        const out = Phaser.Math.Between(1, 3);
        for (let i = 0; i < out; i++) {
          this.time.delayedCall(300 + i * 350, () => {
            const y = this.streetY + Phaser.Math.Between(-4, 4);
            const p = this.makePerson(stopX + Phaser.Math.Between(-8, 8), this.streetY + 10, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), this.state.day));
            this.addUmbrella(p);
            const to = Math.random() < 0.5 ? -100 : this.next.w + 100;
            void this.walk(p, p.x, y).then(() => this.walk(p, to, y, CUSTOMER_SPEED * 0.9)).then(() => p.destroy());
          });
        }
        this.tweens.add({ targets: bus, x: this.next.w + 140, delay: 1800, duration: 3200, ease: 'Sine.easeIn', onComplete: () => bus.destroy() });
      },
    });
  }

  /**
   * Утро района: через день дворник метёт тротуар (за ним клубится пыль), раз в три дня
   * к мусорному контейнеру подъезжает мусоровоз.
   */
  private morningCrew(): void {
    const day = this.state.day;
    if (day % 2 === 0) {
      this.time.delayedCall(DAY_SECONDS * 30, () => {
        if (!this.running) return;
        const y = this.streetY + 2;
        const sweeper = this.makePerson(-60, y, { ...randomLook(0xf77622), acc: 'vest', accTint: 0xfee761, style: 'cap', hair: 0xf77622 });
        const broom = this.add.container(6, 2, [this.add.rectangle(0, -3, 1, 8, 0x8f563b), this.add.rectangle(0, 2, 4, 2, 0xfeae34)]);
        sweeper.add(broom);
        this.tweens.add({ targets: broom, angle: { from: -25, to: 25 }, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        const dust = this.time.addEvent({ delay: 420, loop: true, callback: () => sweeper.active && this.steamPuff(sweeper.x + 7, sweeper.y + 6, 0xc8b8a0) });
        void this.walk(sweeper, this.next.w + 60, y, CUSTOMER_SPEED * 0.45).then(() => {
          dust.remove();
          sweeper.destroy();
        });
      });
    }
    if (day % 3 === 0) {
      this.time.delayedCall(DAY_SECONDS * 60, () => {
        if (!this.running) return;
        const dump = this.dumpSpot();
        const y = this.streetY + 24;
        const truck = this.add.container(-140, y, [this.art(0, 0, 'car_truck').setTint(0x3e8948), this.art(0, 0, 'car_truck_lights')]).setDepth(y);
        ambience.carPass(isWet(this.weather));
        this.tweens.add({
          targets: truck,
          x: dump.x + 10,
          duration: 2600,
          ease: 'Sine.easeOut',
          onComplete: () => {
            if (this.dumpImg?.active) this.tweens.add({ targets: this.dumpImg, angle: { from: -6, to: 6 }, duration: 90, yoyo: true, repeat: 5, onComplete: () => this.dumpImg?.setAngle(0) });
            this.tweens.add({ targets: truck, x: this.next.w + 160, delay: 2200, duration: 3200, ease: 'Sine.easeIn', onComplete: () => truck.destroy() });
          },
        });
      });
    }
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
    await this.walk(sprite, w - 20, this.streetY);
    if (this.rivalAcross) {
      // Его магазин за дорогой, напротив входа: переходит по зебре.
      await this.walk(sprite, this.layout.door.x, this.streetY);
      await this.walk(sprite, this.layout.door.x, this.streetY + 82);
    } else {
      const eduardDoor = this.next.w + 26 + 128 * 0.62;
      await this.walk(sprite, eduardDoor, this.streetY);
      await this.walk(sprite, eduardDoor, this.next.h - 2);
    }
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
    // Терпение кончается — человек в очереди хмурится.
    if (left <= 0.3 && c.sprite.getData('mood') !== 'frown') this.setMood(c.sprite, 'frown');
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
    this.popups = this.popups.filter((p) => p.label.active);
    const hold = Math.min(1800, 500 + 40 * text.length);
    // Та же фраза ещё висит — не новая надпись, а счётчик: «Ушёл без покупки! ×3».
    const same = this.popups.find((p) => p.text === text);
    if (same) {
      same.count++;
      same.label.setText(`${text} ×${same.count}`).setAlpha(1);
      same.fade?.remove();
      this.tweens.add({ targets: same.label, scale: { from: 1.2, to: 1 }, duration: 180, ease: 'Back.easeOut' });
      this.fadePopup(same, hold);
      return;
    }
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
    // Не налезать на другие надписи: если место занято — встаём над ними.
    const box = (l: Phaser.GameObjects.Text) => new Phaser.Geom.Rectangle(l.x - l.width / 2, l.y - l.height / 2, l.width, l.height);
    for (let i = 0; i < 6; i++) {
      const hit = this.popups.find((p) => Phaser.Geom.Intersects.RectangleToRectangle(box(label), box(p.label)));
      if (!hit) break;
      label.y = hit.label.y - hit.label.height / 2 - label.height / 2 - 1;
    }
    const entry: Popup = { label, text, count: 1 };
    this.popups.push(entry);
    this.tweens.add({ targets: label, scale: 1, duration: 220, ease: 'Back.easeOut', onComplete: () => this.fadePopup(entry, hold) });
  }

  /** Надпись повисит и уплывёт вверх, растворяясь. */
  private fadePopup(entry: Popup, hold: number): void {
    const { label } = entry;
    entry.fade = this.tweens.add({
      targets: label,
      y: label.y - 12,
      alpha: 0,
      delay: hold,
      duration: 600,
      ease: 'Quad.easeIn',
      onComplete: () => {
        label.destroy();
        this.popups = this.popups.filter((p) => p !== entry);
      },
    });
  }

  // ---------- День ----------

  /** Подарок за ежедневный вход: деньги (и товар) сразу в состоянии, окно — поверх утра. */
  private offerGift(): void {
    const claimed = claimGift(this.state, localDate(new Date()), Math.random);
    if (!claimed) return;
    // Товар из гостинца сразу встаёт на полки, если есть место.
    this.state = shelveAll(claimed.state);
    saveGame(this.state);
    this.hud.update(this.state, DAY_SECONDS);
    this.refreshWarehouse();
    this.time.delayedCall(400, () => showGift(claimed.gift));
    // Со второго дня — один раз спросить, можно ли боту напоминать о магазине.
    if (this.state.day > 1) this.time.delayedCall(4000, askWriteAccessOnce);
  }

  private showMorning(): void {
    // За ночь склад доливает полки: утром всё, что влезает, уже стоит в зале (просрочку списали ночью).
    // По настоящим часам: новый сезон пропуска и выходные «Чёрной пятницы района».
    this.state = ensureRush(ensureSeason(shelveAll(this.state), trustedNow()), trustedNow());
    // Подарок за ежедневный вход — но не во время бабушкиного обучения: его вручат, когда оно закончится.
    if (this.state.tourDone !== false) this.offerGift();
    // Старые сохранения сразу получают значки за то, что уже сделано.
    this.checkAchievements(false);
    this.morningStock = warehouseCount(this.state);
    this.applyFair();
    this.awaitingBoxes = 0;
    this.hud.update(this.state, DAY_SECONDS);
    if (weatherFor(this.state.day) !== this.weather) this.applyWeather();
    // Примерка премиальной вещи кончилась вчера — убрать её из зала.
    const trial = this.state.decor.trial;
    const trialOver = Boolean(trial && trial.day < this.state.day);
    if (trialOver) this.state = { ...this.state, decor: { ...this.state.decor, trial: undefined } };
    // Эдуард за ночь открыл магазин побольше — перерисовать улицу.
    const cupChanged = (contestOf(this.state)?.wins ?? 0) !== this.builtCup;
    if (trialOver || cupChanged || eduardLook(this.state) !== this.builtEduard || giantLook(this.state) !== this.builtGiant || districtKey(this.state) !== this.builtDistrict) this.buildWorld();
    this.updateLighting(0);
    this.openShop();
    showMorning({
      onArrange: () => this.arrange(),
      onTourDone: () => this.offerGift(),
      getState: () => this.state,
      setState: (s) => {
        const staffChanged = s.staff !== this.state.staff;
        const decorChanged = s.decor !== this.state.decor;
        const adsChanged = s.ads !== this.state.ads;
        // Купили приёмник — его надо поставить на прилавок; сменили волну — только музыка.
        const upgradesChanged = s.upgrades !== this.state.upgrades || s.registers !== this.state.registers || s.gear !== this.state.gear || hasRadio(s) !== hasRadio(this.state);
        const radioChanged = s.radio !== this.state.radio;
        // Кота оставили, купили лежанку или он вернулся с прогулки — перерисовать вход.
        const was = this.state;
        // Убрали или продали полку — остальные остались на местах, но сами места переставлены.
        const placesChanged = s.slotPos !== was.slotPos;
        const catChanged = Boolean(s.cat) !== Boolean(was.cat) || s.cat?.bed !== was.cat?.bed || catHome(s) !== catHome(was) || hasDog(s) !== hasDog(was) || sunflowersPlanted(s) !== sunflowersPlanted(was);
        this.state = s;
        saveGame(s);
        if (s.level > this.builtLevel) void this.celebrateExpansion();
        else if (s.level !== this.builtLevel || placesChanged || decorChanged || upgradesChanged || catChanged || eduardLook(s) !== this.builtEduard || giantLook(s) !== this.builtGiant) this.buildWorld();
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

  /**
   * Сторож: магазин открыт, время не вышло, окон нет, а день стоит больше 3 секунд — значит,
   * что-то не сняло паузу (окно закрылось не своей кнопкой). Запускаем день дальше и сообщаем.
   */
  private watchStall(deltaMs: number): void {
    const stuck = this.dayOpen && !this.running && this.timeLeft > 0 && !document.querySelector('.ui-modal, .ui-dialog');
    this.stallMs = stuck ? this.stallMs + deltaMs : 0;
    if (this.stallMs < 3000) return;
    this.stallMs = 0;
    this.time.paused = false;
    this.running = true;
    reportError(new Error('day stalled, resumed'), 'watchdog');
  }

  private startDay(): void {
    this.dayOpen = true;
    this.flyIn();
    this.flipDoorSign(true);
    this.morningCrew();
    // Утром рассказали, чем кончился вчерашний «проверяющий» (tricks.ts) — больше не показываем.
    if (trickResult(this.state)) this.state = seeTrickResult(this.state);
    this.stallMs = 0;
    try {
      this.prepareDay();
    } catch (error) {
      // Что-то из утренних дел сломалось (редкое сочетание событий) — день всё равно начинается.
      reportError(error, 'startDay');
    }
    this.timeLeft = DAY_SECONDS;
    this.nextSpawn = 1;
    this.running = true;
    try {
      this.setupTrick();
    } catch (error) {
      reportError(error, 'trick');
    }
    try {
      this.startBigDayIfAny();
    } catch (error) {
      reportError(error, 'bigDay');
      this.time.paused = false;
      this.running = true;
    }
  }

  /** Утренние дела перед открытием: персонал, события дня, гости сюжета. */
  private prepareDay(): void {
    this.stats = emptyDayStats();
    for (const r of this.registers) {
      r.scan = null;
      r.customer = null;
    }
    this.night = false;
    this.nightAsked = false;
    this.aromaUntil = 0;
    this.wholesaleBaked = 0;
    this.parcel = null;
    this.resetOven();
    this.inspector = this.state.plan?.inspection ? 'pending' : 'none';
    this.jury = juryDay(this.state) ? 'pending' : 'none';
    this.sonya = sonyaVisits(this.state) ? 'pending' : 'none';
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
    this.scheduleFriends();
    this.refreshKitchen();
    // Старые холодильники иногда подтекают: лужа у одного из них посреди дня.
    if (Math.random() < fridgeLeak(this.state)) {
      this.time.delayedCall(Phaser.Math.FloatBetween(0.15, 0.7) * DAY_SECONDS * 1000, () => this.running && this.fridgeLeaks());
    }
    if (this.state.day >= LIVE_FROM_DAY && Math.random() < LIVE_CHANCE) {
      const kind = Phaser.Utils.Array.GetRandom([...LIVE_KINDS]);
      this.time.delayedCall(Phaser.Math.FloatBetween(0.2, 0.6) * DAY_SECONDS * 1000, () => this.running && this.startLiveEvent(kind));
    }
    this.eveningMarkdown = false;
    this.toiletDirt = 0;
    this.refreshToilet();
    for (const piece of this.trash) piece.destroy();
    this.trash.clear();
  }

  /** Особый день: второй и дальше день — сразу, первый — сначала новость (день стоит, пока её читают). */
  private startBigDayIfAny(): void {
    this.clearBigDay();
    const big = bigDayFor(this.state.day);
    const progress = bigDayProgress(this.state.day);
    if (big && progress && progress.n > 1) {
      // Второй и дальше день многодневного события: о нём уже знают — без новостей.
      this.startBigDay(big);
      const name = t(`bigday.${big}.title` as TextKey);
      this.time.delayedCall(600, () =>
        this.popup(this.layout.w / 2, this.layout.h / 2, t('bigday.dayOf', { icon: BIG_DAYS[big].icon, title: name, n: progress.n, of: progress.of }), '#fee761'),
      );
    } else if (big) this.announceBigDay(big);
  }

  /**
   * Особый день: о нём узнают только сейчас, по новостям. Пока ведущая говорит, день стоит.
   * Потом на улице начинается своё: жара, мороз, вода, толчки или шествие.
   */
  private announceBigDay(id: BigDayId): void {
    const big = BIG_DAYS[id];
    this.running = false;
    this.time.paused = true;
    sound.news();
    haptic.tap();
    if (id === 'wedding') this.wedding = weddingOrder(this.state);
    const params = { n: BIG_DAYS[id].days ?? TOURISTS, order: this.wedding ? weddingText(this.wedding) : '' };
    const { card, close } = openModal();
    // Заголовок одним куском: у h2 в окне flex по краям, иконка не должна уезжать влево.
    const title = el('h2');
    title.append(el('span', '', `${big.icon} ${t(`bigday.${id}.title` as TextKey)}`));
    card.append(
      title,
      dialogBox({
        caption: t('bigday.caption'),
        art: `assets/news_${id}.png`,
        portrait: big.crowd ? 'portrait_anchor_happy' : 'portrait_anchor_surprised',
        name: t('bigday.anchor'),
        text: t(`bigday.${id}.news` as TextKey, params),
        pitch: 520,
        after: [el('div', 'ui-note', t(`bigday.${id}.hint` as TextKey, params))],
        nextLabel: t('bigday.ok'),
        onNext: () => {
          close();
          this.time.paused = false;
          this.running = true;
          this.startBigDay(id);
        },
      }),
    );
  }

  private clearBigDay(): void {
    for (const obj of this.bigObjs) obj.destroy();
    // Мороз красил деревья в иней — возвращаем цвет по погоде.
    if (this.bigObjs.length) for (const g of this.greenery) g.setTint(this.weather === 'leaves' ? 0xffb868 : 0xffffff);
    this.bigObjs = [];
    if (this.time.paused) this.time.paused = false;
    if (this.powerCut) {
      this.powerCut = false;
      this.updateLighting();
    }
    this.applyRadio();
  }

  private startBigDay(id: BigDayId): void {
    this.clearBigDay();
    const keep = <T extends { destroy: () => void }>(obj: T): T => {
      this.bigObjs.push(obj);
      return obj;
    };
    const { h } = this.layout;
    const area = { x: -80, y: -140, w: this.next.w + 160, h: this.next.h + STREET_VIEW + 220 };
    const top = this.streetY - 12;
    // Заливки — с большим запасом: камеру можно отдалить и увести в сторону.
    const wide = { x: -1200, y: -1200, w: this.next.w + 2400, h: this.next.h + 2400 };
    const overlay = (color: number, alpha: number) =>
      keep(this.add.rectangle(wide.x, wide.y, wide.w, wide.h, color).setOrigin(0).setAlpha(alpha).setDepth(LIGHT_DEPTH - 1));
    if (id === 'heatwave') {
      const glow = overlay(0xff9a3c, 0.12);
      keep(this.tweens.add({ targets: glow, alpha: 0.2, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
      keep(this.add.particles(0, 0, 'glow', {
        x: { min: area.x, max: area.x + area.w },
        y: { min: h + 8, max: area.y + area.h },
        speedY: { min: -12, max: -5 },
        scale: { start: 0.06, end: 0.2 },
        alpha: { start: 0.2, end: 0 },
        tint: 0xffd27a,
        lifespan: 2400,
        frequency: 40,
        blendMode: Phaser.BlendModes.ADD,
      })).setDepth(-5);
    }
    if (id === 'frost') {
      overlay(0x9fd3ff, 0.13);
      for (const g of this.greenery) g.setTint(0xdce6f2);
      keep(this.add.particles(0, 0, 'snowflake', {
        x: { min: area.x, max: area.x + area.w },
        y: area.y,
        speedY: { min: 18, max: 36 },
        speedX: { min: -24, max: -6 },
        scale: { min: 1.2 / ART, max: 2 / ART },
        lifespan: (area.h / 20) * 1000,
        frequency: 22,
      })).setDepth(-5);
    }
    if (id === 'flood') {
      // Сразу по воде плывёт первая лодка: машины сегодня не ездят.
      keep(this.time.delayedCall(1500, () => this.running && this.rowBoat(-60, this.next.w + 60)));
      // Вода стоит от крыльца до сквера за дорогой; по ней расходятся круги.
      const water = keep(this.add.rectangle(wide.x, h + FACADE_H + 2, wide.w, top + 88 - h - FACADE_H - 2, 0x2f7fd8).setOrigin(0).setAlpha(0.5).setDepth(-5));
      keep(this.tweens.add({ targets: water, alpha: 0.58, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
      keep(this.add.particles(0, 0, 'splash', {
        x: { min: area.x, max: area.x + area.w },
        y: { min: h + FACADE_H + 4, max: top + 86 },
        scale: { start: 0.3 / ART, end: 1.4 / ART },
        alpha: { start: 0.8, end: 0 },
        tint: 0xc4f4ff,
        lifespan: 900,
        frequency: 45,
      })).setDepth(-4.9);
      keep(this.add.particles(0, 0, 'raindrop', {
        x: { min: area.x, max: area.x + area.w },
        y: area.y,
        speedY: { min: 240, max: 300 },
        speedX: -30,
        scale: 1 / ART,
        lifespan: (area.h / 260) * 1000,
        quantity: 2,
        frequency: 30,
      })).setDepth(-5);
    }
    if (id === 'quake') {
      for (const at of [0.12, 0.42, 0.72]) keep(this.time.delayedCall(at * DAY_SECONDS * 1000, () => this.running && !this.night && this.tremor()));
    }
    this.startBigDayScene(id, keep, top);
    if (BIG_DAYS[id].crowd) {
      music.setStation(id === 'carnival' ? 'samba' : id === 'marathon' ? 'hits' : 'march');
      const marchers = () => {
        if (!this.running || this.night) return;
        const n = Phaser.Math.Between(6, 8);
        for (let i = 0; i < n; i++) this.marcher(id, i, area.x - 12 - Math.floor(i / 2) * 15, top + 34 + (i % 2) * 14, area.x + area.w + 20, keep);
      };
      marchers();
      keep(this.time.addEvent({ delay: id === 'marathon' ? 5000 : 9000, loop: true, callback: marchers }));
      keep(this.add.particles(0, 0, 'confetti', {
        x: { min: area.x, max: area.x + area.w },
        y: { min: top - 20, max: top + 10 },
        speedY: { min: 8, max: 20 },
        speedX: { min: -8, max: 8 },
        rotate: { min: 0, max: 360 },
        tint: [0xe43b44, 0xfee761, 0x63c74d, 0x0099db, 0xb55088, 0x2ce8f5],
        scale: 1 / ART,
        lifespan: 3200,
        frequency: 90,
      })).setDepth(top + 70);
    }
  }

  /** Необычный день на улице и в зале: свет, съёмки, автобус, звездопад, голуби, ремонт, проверка, свадьба. */
  private startBigDayScene(
    id: BigDayId,
    keep: <T extends { destroy: () => void }>(obj: T) => T,
    top: number,
  ): void {
    const { w, h, door } = this.layout;
    const at = (share: number, fn: () => void) =>
      keep(this.time.delayedCall(share * DAY_SECONDS * 1000, () => this.running && !this.night && fn()));
    const road = top + 40;
    if (id === 'blackout') {
      this.powerCut = true;
      this.updateLighting();
      keep(
        this.time.delayedCall(BLACKOUT_UNTIL * DAY_SECONDS * 1000, () => {
          if (!this.powerCut) return;
          this.powerCut = false;
          this.updateLighting();
          this.state = blackoutWarm(this.state).state;
          this.refreshShelves();
          sound.good();
          this.popup(w / 2, h / 2 - 20, t('popup.lightOnDistrict'), '#c8ffb0');
        }),
      );
    }
    if (id === 'filming') {
      const sx = door.x + 50;
      keep(this.art(sx - 24, road, 'film_camera').setDepth(road + 8));
      keep(this.art(sx - 36, road - 6, 'film_light').setDepth(road + 4));
      keep(this.art(sx + 40, road - 6, 'film_light').setFlipX(true).setDepth(road + 4));
      keep(this.art(sx - 40, road + 10, 'director_chair').setDepth(road + 14));
      // Актёры в костюмах из альбома редких гостей, на тротуаре — зеваки.
      ['knight', 'queen', 'pirate'].forEach((rid, i) => {
        const guest = RARE_GUESTS.find((g) => g.id === rid);
        if (!guest) return;
        const actor = keep(this.makePerson(sx + 2 + i * 12, road + 2, guest.look as Look));
        this.setFacing(actor, 'left');
      });
      for (let i = 0; i < 5; i++) keep(this.makePerson(door.x + 14 + i * 16, top + 14 + (i % 2) * 3, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), this.state.day)));
      keep(
        this.time.addEvent({
          delay: 14000,
          loop: true,
          callback: () => {
            if (!this.running || this.night) return;
            sound.tap();
            this.popup(sx + 14, road - 18, t('popup.action'), '#fff3b0');
          },
        }),
      );
    }
    if (id === 'tourbus') at(0.3, () => this.tourBus(keep));
    if (id === 'starfall') {
      keep(
        this.time.addEvent({
          delay: 700,
          loop: true,
          callback: () => {
            if (!this.night && this.timeLeft > DAY_SECONDS * 0.35) return;
            const view = this.cameras.main.worldView;
            const x = Phaser.Math.Between(view.x, view.x + view.width * 0.7);
            const y = Phaser.Math.Between(view.y, view.y + view.height * 0.4);
            const star = this.add.rectangle(x, y, 10, 0.8, 0xffffff).setOrigin(1, 0.5).setRotation(0.45).setDepth(LIGHT_DEPTH + 2).setBlendMode(Phaser.BlendModes.ADD);
            this.tweens.add({ targets: star, x: x + 56, y: y + 27, alpha: 0, duration: 800, onComplete: () => star.destroy() });
          },
        }),
      );
    }
    if (id === 'pigeons') for (const share of [0.1, 0.3, 0.5, 0.7]) at(share, () => this.pigeonInside(keep));
    if (id === 'roadworks') {
      keep(this.art(door.x + 44, road, 'road_pit').setDepth(road - 4));
      keep(this.art(door.x + 100, road - 4, 'digger').setDepth(road + 8));
      for (let x = door.x + 14; x < door.x + 134; x += 20) keep(this.art(x, road + 14, 'road_barrier').setDepth(road + 18));
      for (const x of [door.x + 2, door.x + 140]) keep(this.art(x, road + 12, 'cone').setDepth(road + 16));
      // Рабочие у раскопа: один копает (качается), другой смотрит.
      [door.x + 30, door.x + 62].forEach((x, i) => {
        const worker = keep(this.makePerson(x, road - 8, { ...randomLook(0x8f563b), ...wearOf('builder', Math.random) }));
        if (i === 0) keep(this.tweens.add({ targets: worker, y: road - 7, duration: 400, yoyo: true, repeat: -1 }));
      });
    }
    if (id === 'sanitary' && this.inspector === 'none') this.inspector = 'pending';
    if (id === 'robbery') this.robbery(keep, at, road);
    if (id === 'wedding') {
      const car = keep(this.art(door.x - 90, road, 'car').setTint(0xffffff).setDepth(road + 6));
      keep(this.tweens.add({ targets: car, y: road - 0.5, duration: 900, yoyo: true, repeat: -1 }));
      at(0.8, () => {
        sound.bell();
        this.popup(w / 2, h / 2 - 20, t('popup.weddingSoon'), '#ffd0e0');
      });
    }
  }

  /**
   * Ограбление с заложниками. Утром — тревожная новость; к полудню в магазин заходят пятеро в масках,
   * всех — покупателей, персонал и хозяина — сгоняют в угол, торговля стоит. Снаружи — полиция и фургон
   * ОМОНа, переговоры через мегафон; троих отпускают, грабители требуют вертолёт и деньги. Под вечер —
   * штурм: вспышка, грабителей уводят в фургон, заложники свободны, работа продолжается.
   */
  private robbery(
    keep: <T extends { destroy: () => void }>(obj: T) => T,
    at: (share: number, fn: () => void) => void,
    road: number,
  ): void {
    const { w, h, door, wallH } = this.layout;
    const hostages: Phaser.GameObjects.Container[] = [];
    const robbers: Phaser.GameObjects.Container[] = [];
    const outside = h + FACADE_H + 12;
    const say = (x: number, y: number, key: TextKey, color: string) => this.popup(x, y, t(key), color);
    const corner = (i: number) => ({ x: 14 + (i % 5) * 10, y: wallH + 34 + Math.floor(i / 5) * 9 });
    at(ROBBERY_AT, () => {
      this.siege = true;
      sound.bad();
      haptic.error();
      // Покупатели бросают корзины и идут в угол; очередь и кассы пустеют.
      for (const c of [...this.customers]) {
        c.gone = true;
        c.patience?.remove();
        c.bubble.setVisible(false);
        this.customers.delete(c);
        hostages.push(c.sprite);
      }
      this.queue = [];
      for (const r of this.registers) {
        r.customer = null;
        r.scan = null;
      }
      // Персонал бросает работу (их циклы останавливаются) и тоже в угол; хозяин — с ними.
      this.staffGen++;
      this.managerOnFloor = false;
      for (const worker of this.workers.values()) if (!hostages.includes(worker.sprite)) hostages.push(worker.sprite);
      hostages.push(this.seller);
      hostages.forEach((p, i) => {
        this.tweens.killTweensOf(p);
        const spot = corner(i);
        void this.walk(p, spot.x, spot.y).then(() => {
          if (p.active) this.setFacing(p, 'down');
        });
      });
      // Пятеро в масках: двое у заложников, один у кассы, двое у входа.
      const posts = [
        { x: 66, y: wallH + 40 },
        { x: 70, y: wallH + 56 },
        { x: this.layout.counter.x - 14, y: this.layout.counter.y + 6 },
        { x: door.x - 12, y: h - 14 },
        { x: door.x + 12, y: h - 14 },
      ];
      posts.forEach((post, i) => {
        const robber = keep(this.makePerson(door.x + (i - 2) * 6, outside, { shirt: 0x181425, pants: 0x262b44, skin: 0xf2d3ab, hair: 0x181425, style: 'beanie' }));
        robbers.push(robber);
        void this.walk(robber, door.x, h - 8).then(() => this.walk(robber, post.x, post.y));
      });
      say(w / 2, h / 2 - 20, 'robbery.enter', '#ffd0d0');
    });
    // Полиция: машина с мигалкой и фургон ОМОНа у входа, офицеры за машинами.
    at(ROBBERY_AT + 0.03, () => {
      sound.news();
      const car = keep(this.add.container(door.x + 50, road, [this.art(0, 0, 'car_sedan').setTint(0xffffff), this.art(0, 0, 'car_sedan_lights')]).setDepth(road));
      const blue = keep(this.add.rectangle(door.x + 46, road - 9, 4, 2, 0x0099db).setDepth(road + 1));
      const red = keep(this.add.rectangle(door.x + 51, road - 9, 4, 2, 0xe43b44).setDepth(road + 1));
      keep(this.time.addEvent({ delay: 300, loop: true, callback: () => { blue.setVisible(!blue.visible); red.setVisible(!blue.visible); } }));
      keep(this.add.container(door.x - 60, road, [this.art(0, 0, 'car_van').setTint(0x3a4466), this.art(0, 0, 'car_van_lights')]).setDepth(road));
      void car;
      for (let i = 0; i < 4; i++) {
        const cop = keep(this.makePerson(door.x - 40 + i * 26, road - 16, { shirt: 0x124e89, pants: 0x262b44, skin: 0xeec39a, hair: 0x124e89, style: 'cap' }));
        this.setFacing(cop, 'up');
      }
    });
    at(ROBBERY_AT + 0.07, () => say(door.x, outside + 6, 'robbery.police', '#d0e0ff'));
    at(ROBBERY_AT + 0.13, () => robbers[0]?.active && say(robbers[0].x, robbers[0].y - 16, 'robbery.demand', '#ffd0d0'));
    at(ROBBERY_AT + 0.21, () => say(door.x, outside + 6, 'robbery.deal', '#d0e0ff'));
    // Троих покупателей отпускают: выходят и уходят по тротуару.
    at(ROBBERY_RELEASE, () => {
      const freed = hostages.filter((p) => p !== this.seller && ![...this.workers.values()].some((wk) => wk.sprite === p)).slice(0, 3);
      for (const p of freed) {
        hostages.splice(hostages.indexOf(p), 1);
        void this.walk(p, door.x, h + 16).then(() => {
          if (p.active) void this.strollAway(p);
        });
      }
      sound.good();
      say(door.x, h - 24, 'robbery.released', '#c8ffb0');
    });
    at(ROBBERY_RELEASE + 0.1, () => robbers[0]?.active && say(robbers[0].x, robbers[0].y - 16, 'robbery.where', '#ffd0d0'));
    at(ROBBERY_RELEASE + 0.2, () => say(door.x, outside + 6, 'robbery.stall', '#d0e0ff'));
    // ОМОН строится у входа.
    at(ROBBERY_STORM - 0.08, () => {
      for (let i = 0; i < 5; i++) {
        const trooper = keep(this.makePerson(door.x - 24 + i * 12, outside + 4, { shirt: 0x262b44, pants: 0x181425, skin: 0xeec39a, hair: 0x181425, style: 'cap', acc: 'vest', accTint: 0x3a4466 }));
        this.setFacing(trooper, 'up');
      }
      say(door.x, outside - 6, 'robbery.omon', '#d0e0ff');
    });
    // Штурм: вспышка и грохот, грабителей уводят, заложники свободны.
    at(ROBBERY_STORM, () => {
      const flash = this.add.rectangle(-1200, -1200, this.next.w + 2400, this.next.h + 2400, 0xffffff).setOrigin(0).setDepth(LIGHT_DEPTH + 5).setAlpha(0.9);
      this.tweens.add({ targets: flash, alpha: 0, duration: 900, onComplete: () => flash.destroy() });
      sound.rumble();
      haptic.error();
      this.cameras.main.shake(400, 0.006);
      say(w / 2, h / 2 - 20, 'robbery.storm', '#c8ffb0');
      for (const robber of robbers) void this.walk(robber, door.x, h + 16).then(() => {
        if (robber.active) robber.setVisible(false);
      });
      for (const p of hostages) {
        if (p === this.seller || [...this.workers.values()].some((wk) => wk.sprite === p)) continue;
        void this.walk(p, door.x, h + 16).then(() => {
          if (p.active) void this.strollAway(p);
        });
      }
      this.siege = false;
      this.state = { ...this.state, rating: Math.min(5, Math.round((this.state.rating + ROBBERY_RATING) * 100) / 100) };
      const home = this.ownerHome();
      void this.walk(this.seller, home.x, home.y);
      this.syncStaff();
      this.time.delayedCall(1500, () => this.popup(w / 2, h / 2 - 8, t('robbery.thanks', { r: ROBBERY_RATING }), '#fff3b0'));
    });
  }

  /** Автобус туристов: подъезжает к магазину, из него разом выходит толпа. */
  private tourBus(keep: <T extends { destroy: () => void }>(obj: T) => T): void {
    const { door } = this.layout;
    const y = this.streetY + 25;
    const body = this.art(0, 0, 'bus').setTint(0xfeae34);
    const lights = this.art(0, 0, 'bus_lights');
    const bus = keep(this.add.container(-140, y, [body, lights]).setDepth(y));
    this.tweens.add({
      targets: bus,
      x: door.x,
      duration: 3000,
      ease: 'Sine.easeOut',
      onComplete: () => {
        if (!bus.active) return;
        sound.bell();
        this.popup(door.x, this.streetY - 12, t('popup.tourists'), '#fee761');
        for (let i = 0; i < TOURISTS; i++) {
          this.time.delayedCall(i * 350, () => {
            if (!this.running) return;
            const look = { ...randomLook(Phaser.Utils.Array.GetRandom(SHIRTS)), ...wearOf('tourist', Math.random) };
            this.spawnCustomer({ look, at: { x: door.x + Phaser.Math.Between(-24, 24), y: this.streetY + 4 } });
          });
        }
        this.time.delayedCall(TOURISTS * 350 + 1500, () => bus.active && this.tweens.add({ targets: bus, x: this.next.w + 160, duration: 3200, ease: 'Sine.easeIn' }));
      },
    });
  }

  /** Участник шествия: идёт вдоль дороги слева направо и уходит за край. */
  private marcher(id: BigDayId, i: number, x: number, y: number, toX: number, keep: <T extends { destroy: () => void }>(obj: T) => T): void {
    const skin = Phaser.Utils.Array.GetRandom(SKINS);
    const costume = Phaser.Utils.Array.GetRandom([0xb55088, 0xe43b44, 0x0099db, 0x63c74d, 0xfeae34]);
    const shirtColor = Phaser.Utils.Array.GetRandom([0xe43b44, 0x0099db, 0x63c74d, 0xfeae34, 0xb55088, 0x2ce8f5]);
    const look: Look =
      id === 'marathon'
        ? { ...randomLook(WHITE_SHIRT), skin, outfit: 'runner', outfitTint: shirtColor, hat: 'headband', hatTint: WHITE_SHIRT, pants: 0x262b44 }
        : id === 'carnival'
        ? {
            ...randomLook(costume),
            skin,
            pants: costume,
            outfit: 'samba',
            hat: 'feathers',
            prop: i % 3 === 2 ? 'drum' : 'maracas',
            back: i % 3 === 0 ? 'fan' : undefined,
          }
        : i < 6
          ? { ...randomLook(0xe43b44), skin, pants: 0x262b44, outfit: 'band', hat: 'shako', prop: i % 2 ? 'drum' : 'trumpet' }
          : { ...customerLook(Phaser.Utils.Array.GetRandom(SHIRTS)), prop: i % 2 ? 'flag' : 'balloon', propTint: Phaser.Utils.Array.GetRandom(HAT_COLORS) };
    const person = keep(this.makePerson(x, y, look));
    this.setFacing(person, 'right');
    person.setData('walking', true);
    keep(this.tweens.add({ targets: person, x: toX, duration: ((toX - x) / (id === 'marathon' ? 34 : 16)) * 1000, onComplete: () => person.destroy() }));
    // Танцоры подпрыгивают в такт.
    if (id === 'carnival') keep(this.tweens.add({ targets: person, y: y - 1.5, duration: 260, yoyo: true, repeat: -1, delay: i * 90 }));
  }

  /** Подземный толчок: камера трясётся, с полок падает и бьётся часть товара. */
  private tremor(): void {
    this.cameras.main.shake(800, 0.008);
    sound.rumble();
    haptic.error();
    const { state, broken } = quakeBreak(this.state, Math.random);
    this.state = state;
    this.stats.spoiled += broken;
    this.refreshShelves();
    const { w, h } = this.layout;
    this.popup(w / 2, h / 2 - 10, t('popup.quake', { n: broken }), '#ffb0a0');
  }

  private finishDay(): void {
    this.dayOpen = false;
    // Захват не успел закончиться (день досрочно закрыт) — персонал возвращается к работе.
    if (this.siege) {
      this.siege = false;
      this.syncStaff();
    }
    this.running = false;
    this.clearBigDay();
    this.night = false;
    this.setSpeed(1);
    this.stallTimer?.remove();
    this.stallTimer = undefined;
    if (this.order) {
      this.order.timer.remove();
      this.order.bubble.destroy();
      this.order = null;
    }
    // Посылку, которую не успели вынести, курьер отвозит после закрытия.
    if (this.parcel !== null) {
      this.state = { ...this.state, money: this.state.money + this.parcel };
      this.stats.revenue += this.parcel;
      this.parcel = null;
    }
    // Хлеб, оставшийся в печи к закрытию, продавец вынимает сам.
    if (this.oven && this.oven.state !== 'idle') {
      const product = this.oven.product;
      const forShops = this.oven.forShops;
      this.resetOven();
      if (forShops) this.state = sellWholesale(this.state).state;
      else this.state = (product === 'bread' ? takeOutBread(this.state) : takeOutBread(this.state, BRAND_BATCH, product)).state;
    }
    // Особый день вечером: свадебный заказ забирают, после съёмок — реклама на завтра.
    const wedding = this.wedding ? fulfillWedding(this.state, this.wedding) : null;
    if (wedding) this.state = wedding.state;
    this.wedding = null;
    const filmed = bigDayFor(this.state.day) === 'filming';
    if (filmed) this.state = filmingReward(this.state);
    const finishedDay = this.state.day;
    const ratingBefore = this.state.rating;
    const rankBefore = rankOf(this.state.totalRevenue);
    const { state, spoiled, bill, shortfall, skimmed, order, quests, weekly } = nightCycle(this.state, this.stats);
    const cafe = this.cafeToday;
    this.cafeToday = null;
    const extra: [string, string][] = [];
    const big = bigDayFor(finishedDay);
    if (big) extra.push([t('bigday.summary'), `${BIG_DAYS[big].icon} ${t(`bigday.${big}.title` as TextKey)}`]);
    if (wedding) extra.push([t('summary.wedding'), t(wedding.complete ? 'summary.weddingFull' : 'summary.weddingPart', { n: wedding.earned })]);
    if (filmed) extra.push(['🎬', t('summary.filming')]);
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
    track('day_end', finishedDay, this.stats.revenue);
    const fps = fpsSummary(this.fpsSamples);
    if (fps) {
      track('fps', finishedDay, fps.median);
      track('fps_low', finishedDay, fps.low);
    }
    this.fpsSamples = [];
    if (this.state.bankrupt) track('bankrupt', finishedDay);
    void reportProgress(this.state);
    this.refreshShelves();
    this.refreshWarehouse();
    this.hud.update(this.state, 0);
    // Снимок зала до роллет — для карточки итогов (shareCard.ts).
    this.dayShot = null;
    this.game.renderer.snapshot((image) => {
      this.dayShot = image instanceof HTMLImageElement ? image : null;
    });
    this.clearTrick();
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
        () => this.nightPass(() => this.showMorning()),
        (button) => void this.shareDay(button, finishedDay),
      );
    });
  }

  /** «Поделиться итогами»: карточка в историю Telegram или в чат с ботом. */
  private async shareDay(button: HTMLButtonElement, day: number): Promise<void> {
    if (button.disabled) return;
    button.disabled = true;
    const label = button.textContent;
    button.textContent = t('share.wait');
    const history = this.state.history;
    const result = await shareDay(
      {
        day,
        shop: this.shopTitle(),
        revenue: this.stats.revenue,
        week: history.slice(-7).reduce((sum, n) => sum + n, 0),
        served: this.stats.served,
        rating: this.state.rating,
      },
      this.dayShot,
    );
    button.textContent = label;
    button.disabled = false;
    track('share', day, result === 'failed' ? 0 : 1);
    if (result === 'chat') toast('assets/ico_phone.png', t('share.chat.title'), t('share.chat.text'));
    if (result === 'failed') toast('assets/ico_phone.png', '📸', t('share.failed'));
  }

  /**
   * Вывеска растёт с магазином: с третьего уровня по краю бегут огоньки, у супермаркета под
   * буквами переливается светодиодная лента.
   */
  private signLights(x: number, y: number): void {
    const level = this.state.level;
    if (level < 2) return;
    const bulbs: Phaser.GameObjects.Rectangle[] = [];
    for (let i = 0; i < 16; i++) {
      bulbs.push(this.add.rectangle(x - 30 + i * 4, y - 6.5, 1.4, 1.4, 0xfee761).setDepth(4));
      bulbs.push(this.add.rectangle(x + 30 - i * 4, y + 6.5, 1.4, 1.4, 0xfee761).setDepth(4));
    }
    let step = 0;
    this.time.addEvent({
      delay: 160,
      loop: true,
      callback: () => {
        step++;
        bulbs.forEach((b, i) => b.active && b.setFillStyle(Math.floor(i / 2) % 3 === step % 3 ? 0xfff6c8 : 0xb8860b));
      },
    });
    if (level < 4) return;
    const led = this.add.rectangle(x, y + 8.5, 60, 1.6, 0x9cd8ff).setDepth(4);
    this.tweens.addCounter({
      from: 0,
      to: 360,
      duration: 3000,
      repeat: -1,
      onUpdate: (tw) => led.active && led.setFillStyle(Phaser.Display.Color.HSVToRGB(((tw.getValue() ?? 0) % 360) / 360, 0.45, 1).color),
    });
    this.nightGlow(this.art(x, y + 9, 'glow').setDisplaySize(80, 12).setTint(0x9cd8ff), 0.5);
  }

  /**
   * Ночь между днями (пока игрок не нажал «Дальше» в итогах — не начинается): становится темно,
   * по небу проходит луна, в домах по одному гаснут окна, проезжает ночное такси, потом
   * розовый рассвет — и утро. Касание экрана пропускает.
   */
  private nightPass(done: () => void): void {
    const cam = this.cameras.main;
    const v = cam.worldView;
    const objs: Phaser.GameObjects.GameObject[] = [];
    const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      objs.push(o);
      return o;
    };
    const pad = 300;
    // Небо поверх всего мира: умножение на цвет — ночью синее, на рассвете розовое.
    const sky = keep(this.add.rectangle(v.x - pad, v.y - pad, v.width + 2 * pad, v.height + 2 * pad, 0xffffff).setOrigin(0));
    sky.setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(LIGHT_DEPTH + 2);
    const moonGlow = keep(this.art(0, 0, 'glow').setScale(34 / 64).setTint(0xdfe8ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(LIGHT_DEPTH + 3));
    // Луна: светлый диск с парой «морей».
    const moon = keep(this.add.container(0, 0, [this.add.circle(0, 0, 5, 0xf6f0d6), this.add.circle(-1.5, -1, 1.3, 0xd8cfae), this.add.circle(1.8, 1.6, 1, 0xd8cfae)]));
    moon.setDepth(LIGHT_DEPTH + 4);
    const stars = Array.from({ length: 14 }, () =>
      keep(this.add.rectangle(v.x + Math.random() * v.width, v.y + Math.random() * v.height * 0.4, 0.9, 0.9, 0xfff6c8).setDepth(LIGHT_DEPTH + 3).setAlpha(0)),
    );
    // Ночное такси с фарами.
    const roadY = this.streetY + 24;
    const taxi = keep(this.add.container(v.x - 60, roadY, [this.art(0, 0, 'car_taxi').setTint(0xfee761), this.art(0, 0, 'car_taxi_lights')]).setDepth(roadY));
    const beam = keep(this.art(v.x - 30, roadY, 'glow').setScale(40 / 64, 14 / 64).setTint(0xfff3b0).setBlendMode(Phaser.BlendModes.ADD).setDepth(LIGHT_DEPTH + 3).setAlpha(0.8));
    const NIGHT = Phaser.Display.Color.ValueToColor(0x4a5aa0);
    const DAWN = Phaser.Display.Color.ValueToColor(0xffb8a8);
    const WHITE = Phaser.Display.Color.ValueToColor(0xffffff);
    const mix = (a: Phaser.Display.Color, b: Phaser.Display.Color, k: number) => {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 100, k * 100);
      return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
    };
    const DURATION = 3600;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      counter.remove();
      this.input.off('pointerdown', finish);
      objs.forEach((o) => o.destroy());
      this.lightsOut = 0;
      done();
    };
    this.input.once('pointerdown', finish);
    ambience.carPass(isWet(this.weather));
    const counter = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: DURATION,
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 0;
        // 0–0.2 темнеет, 0.2–0.7 ночь, 0.7–0.85 рассвет, 0.85–1 светлеет.
        const color =
          k < 0.2 ? mix(WHITE, NIGHT, k / 0.2) : k < 0.7 ? NIGHT.color : k < 0.85 ? mix(NIGHT, DAWN, (k - 0.7) / 0.15) : mix(DAWN, WHITE, (k - 0.85) / 0.15);
        sky.setFillStyle(color);
        const night = k < 0.7 ? Phaser.Math.Clamp(k / 0.2, 0, 1) : Phaser.Math.Clamp(1 - (k - 0.7) / 0.15, 0, 1);
        // Луна дугой слева направо по верху кадра.
        const m = Phaser.Math.Clamp((k - 0.05) / 0.75, 0, 1);
        moon.setPosition(v.x + v.width * (0.12 + 0.76 * m), v.y + v.height * (0.16 - 0.08 * Math.sin(m * Math.PI))).setAlpha(night);
        moonGlow.setPosition(moon.x, moon.y).setAlpha(0.7 * night);
        stars.forEach((st, i) => st.setAlpha(night * (0.5 + 0.5 * Math.sin(this.time.now / 300 + i * 1.7))));
        // Окна гаснут посреди ночи; к рассвету фонари и вывески выключаются (вечер идёт назад).
        this.lightsOut = Phaser.Math.Clamp((k - 0.2) / 0.4, 0, 1);
        this.updateLighting(k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
        const tx = v.x - 60 + (v.width + 120) * Phaser.Math.Clamp((k - 0.25) / 0.4, 0, 1);
        taxi.x = tx;
        beam.setPosition(tx + 30, roadY).setAlpha(k > 0.25 && k < 0.65 ? 0.8 : 0);
      },
      onComplete: finish,
    });
  }

  /**
   * Небо днём: по кварталу медленно ползёт тень облака (в ясную погоду), иногда пролетает
   * стайка птиц. Вечером и ночью — нет.
   */
  private skyLife(): void {
    if (this.lite || !this.running || this.night || this.evening > 0.5) return;
    const v = this.cameras.main.worldView;
    const sunny = this.weather === 'clear' || this.weather === 'heat' || this.weather === 'leaves';
    if (sunny && Math.random() < 0.45) {
      const y = v.y + Math.random() * v.height;
      const cloud = this.art(v.x - 120, y, 'glow').setScale(220 / 64, 120 / 64).setTint(0x1a1f3a).setAlpha(0.14).setDepth(LIGHT_DEPTH - 1);
      this.tweens.add({ targets: cloud, x: v.right + 120, y: y + 30, duration: 26000, onComplete: () => cloud.destroy() });
    }
    if (Math.random() < 0.25) {
      const fromLeft = Math.random() < 0.5;
      const y0 = v.y + v.height * (0.2 + Math.random() * 0.5);
      const flock = this.add.container(fromLeft ? v.x - 20 : v.right + 20, y0).setDepth(LIGHT_DEPTH - 0.5);
      const n = Phaser.Math.Between(3, 6);
      for (let i = 0; i < n; i++) {
        // Птица — галочка из двух крыльев; крылья машут вверх-вниз.
        const bird = this.add.graphics({ x: -i * 6 * (fromLeft ? 1 : -1) + Math.random() * 3, y: (i % 2 ? 4 : -3) * Math.ceil(i / 2) });
        bird.lineStyle(0.8, 0x262b44, 1);
        bird.lineBetween(-2, -1, 0, 0.6).lineBetween(0, 0.6, 2, -1);
        this.tweens.add({ targets: bird, scaleY: { from: 1, to: -0.6 }, duration: 160 + i * 13, yoyo: true, repeat: -1 });
        flock.add(bird);
      }
      this.tweens.add({
        targets: flock,
        x: fromLeft ? v.right + 40 : v.x - 40,
        y: y0 - 40 + Math.random() * 30,
        duration: 7000,
        onComplete: () => flock.destroy(true),
      });
    }
  }

  /** Табличку на двери переворачивают: «Открыто» утром, «Закрыто» вечером. */
  private flipDoorSign(open: boolean): void {
    const sign = this.doorSign;
    const key = open ? 'door_sign_open' : 'door_sign_closed';
    if (!sign?.active || sign.texture.key === key) return;
    const sx = sign.scaleX;
    this.tweens.add({
      targets: sign,
      scaleX: 0,
      duration: 160,
      yoyo: true,
      onYoyo: () => sign.setTexture(key),
      onComplete: () => sign.setScale(sx, sign.scaleY),
    });
    this.tweens.add({ targets: sign, angle: { from: -12, to: 0 }, delay: 320, duration: 700, ease: 'Elastic.easeOut' });
  }

  /** Вечером на витрины, дверь и склад опускаются роллеты. */
  private closeShop(): void {
    this.flipDoorSign(false);
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
    this.nightGuard();
  }

  /** Ночь: Бобик сидит настороже, к двери выходит сторож с фонариком. */
  private nightGuard(): void {
    this.closed = true;
    this.bobikSit(900);
    if (!hasWatchman(this.state)) return;
    const { door } = this.layout;
    const y = this.bobik?.y ?? this.layout.h + FACADE_H + 10;
    const watchman = this.makePerson(door.x + 18, y - 9, WATCHMAN).setDepth(y + 2);
    watchman.setAlpha(0);
    this.tweens.add({ targets: watchman, alpha: 1, duration: 600 });
    const beam = this.add.graphics({ x: door.x + 22, y: y - 6 }).setDepth(y + 1).setBlendMode(Phaser.BlendModes.ADD);
    beam.fillStyle(0xfff3b0, 0.22);
    beam.fillTriangle(0, 0, 22, 8, 16, 16);
    this.tweens.add({ targets: beam, rotation: { from: -0.25, to: 0.35 }, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.nightWatch.push(watchman, beam);
  }

  /** Утром роллеты поднимаются. */
  private openShop(): void {
    this.closed = false;
    this.bobikRest();
    this.nightWatch.forEach((o) => o.destroy());
    this.nightWatch = [];
    for (const shutter of this.shutters) {
      this.tweens.add({ targets: shutter, displayHeight: 0.1, duration: 600, ease: 'Quad.easeIn', onComplete: () => shutter.destroy() });
    }
    this.shutters = [];
  }
}
