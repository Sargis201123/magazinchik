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
  isFixture,
  slotOf,
  STORE_LEVELS,
  HYPER_LEVEL,
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
  warehouseOf,
  type Category,
  type DayStats,
  type LostReason,
  type ProductId,
  type StaffRole,
  type StoreState,
} from '../game/economy';
import { ensurePlan, inspectionDone, nightCycle, spawnIntervalToday } from '../game/day';
import { inspect, RUSH_SECONDS, type InspectionResult } from '../game/events';
import {
  ALBUM_REWARD,
  collectRareGuest,
  perceivedBase,
  pickRareGuest,
  pickWanted,
  questDone,
  questProgress,
  payQuests,
  rankName,
  rankOf,
  RARE_GUESTS,
  RARE_TIP,
  rareGuestChance,
  seasonFor,
} from '../game/endless';
import { lastSavedAt, loadGame, pauseSaving, saveGame, savingPaused } from '../game/save';
import { friendState } from '../game/friendShop';
import { presentGiven, presentsOn, showGiftPicker } from '../ui/presents';
import { applyPranks, bonusGuests, bossLeft, bossShop, messToday, PRANK_COINS, takeRivalDay, takeThanks, THANK_COINS, usePrank, type PrankIn, type PrankKind } from '../game/rival';
import { fetchRivalShop, rivalAct, rivalInbox, thankRival } from '../platform/rival';
import { rivalBar, showRivalNews } from '../ui/rival';
import { awayTrade } from '../game/away';
import { branchAway, branchInOldShop, branchLook, branchSignName, branchTier, branchUpgrades } from '../game/branch';
import { hasHood, HOOD_SQUARE, hoodLook, hoodTips, type HoodId } from '../game/hood';
import { getLang, t, type TextKey } from '../i18n';
import { sound } from '../platform/sound';
import { music } from '../platform/music';
import { findPath, type Rect } from './paths';
import {
  facingAlong,
  makeRoute,
  paceAt,
  planPace,
  polylineLength,
  roundCorners,
  sampleRoute,
  sidestep,
  turnVia,
  type Facing,
  type Passer,
} from './stride';
import { ambience, type AmbLife } from '../platform/ambience';
import { setListener } from '../platform/mixer';
import { haptic, telegramUserId, trustedNow } from '../platform/telegram';
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
import { wearOf } from './archetypes';
import { BIG_LAYER_DY } from './wardrobe';
import { Hud, type SummaryStamp } from '../ui/hud';
import { showMorning } from '../ui/morning';
import { showTitle } from '../ui/title';
import { isWet, weatherFor, type Weather } from '../game/weather';
import { yearTime } from '../game/calendar';
import { liveProgress, recordDay, unlockAchievements, type AchievementId } from '../game/achievements';
import { announceAchievement } from '../ui/achievements';
import { claimGift, giftTomorrow } from '../game/gift';
import { activeAds, adExtraItems, adGuests, adRareBoost, adTrust } from '../game/ads';
import { companionOf, livedRegular } from '../game/life';
import { acceptsPrice, recordVisit, regularById, regularsToday, regularState, tipFor, type Regular } from '../game/regulars';
import { carryOf, CART_SHARE, cartPatience, ETAGS_EVENING, eveningSales, hasUpgrade, loyaltyTolerance, withUpgrades } from '../game/upgrades';
import { KIOSK_ERROR_SECONDS, KIOSK_PREFER, kioskCount, kioskSlots, kioskTier } from '../game/lanes';
import { showGift } from '../ui/gift';
import { collectOrder, dropOrder, noteSeen, openChest, orderTeaser, planLetter, planOrder, stashAway, takeLetter } from '../game/returns';
import { showReturn } from '../ui/returns';
import { activeDecor, decorFromPurchases, grantDecor } from '../game/decor';
import { restorePurchases } from '../platform/stars';
import { DOG_DAY_CATCH, hasDog, hasWatchman } from '../game/watch';
import { contestOf, juryDay } from '../game/contest';
import { dramaHeld, sonyaVisits, sunflowersPlanted } from '../game/drama';
import { activeEvent, guestCoins, guestDue, liveLook, seeGuest, type GuestId } from '../game/live';
import { liveEvents, loadLiveEvents, todayLocal } from '../platform/live';
import { comebackHooks } from '../game/comeback';
import { askForHelp, askWriteAccessOnce, claimHelp, sendHelp, socialInfo, socialPing, WELCOME_GIFT } from '../platform/social';
import { HELP_HOLD, HELP_QUEUE, HELP_REWARD, HELP_THANKS, helpAsked, helpGiven, helpScan, markHelpAsked, takeHelp } from '../game/help';
import { flushSoon, reportProgress, setProgressSource, track } from '../platform/analytics';
import { firstWant, markOnb, onbDone, pickCohort, playDayOne, startCohort, type Cohort, type OnbStep } from '../game/onboarding';
import { pendingStory } from '../game/story';
import { firstGiftCard, firstSaleStamp, SayBubble, type SayLine } from '../ui/onboarding';
import { TUT_IGNORE_MS, TUT_WAIT_MS, tutAt, tutDayEnd, tutIndex, tutMorning, tutNext, tutPass, tutPatient, tutSkip, tutStep, tutTell, type TutStep } from '../game/tutorial';
import { Coach, type Spot } from '../ui/coach';
import { shareDay } from '../platform/shareCard';
import { duelInfo, fetchFriendShop, loadMultiplayer, treatFriend, visitsInfo, type VisitFriend } from '../platform/multiplayer';
import { friendsAtWork } from '../game/staff';
import { ensureSeason, grantPass } from '../game/pass';
import { grantSupport } from '../game/support';
import { ensureRush } from '../game/rush';
import { cookBatch, DISHES, DISH_IDS, dishPortions, foodSlots, foodSprite, kitchenOpen, kitchenWorking, pantryOf, portionsOf, servePortions, stockKitchen, stoveSeconds, stoveSprite, takeDish, takeIngredients, topUpKitchen, wantsDish, type DishId } from '../game/kitchen';
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
  type NightStoryId,
} from '../game/nightGuests';
import { BUILDINGS, BUILDING_IDS, buildingStage, districtGuest, districtKey, isMatchDay, type BuildingId } from '../game/district';
import { reportError, setErrorContext } from '../platform/errors';
import { blockedZones, canShortenQueue, slotRect, slotSide, standFor, wallSnap, SIDE_X, clampTill, iceboxFits, overlapsRect, propFootprint, propIssues, propPosFor, propRect, savedLayout, slotIssues, slotPosFor, snap, tillZones, vendingFootprint, vendingSide, withTill, type Prop } from './placement';
import { COURIER_SPAN, freeStreetX, ICE_CART_SPAN, type StreetSpan } from './placement';
import {
  buildingSpan,
  iceboxRect,
  iceboxSpotFor,
  kioskZones,
  layoutFor,
  REGISTER_ROW,
  registerSpot,
  unitsPerBox,
  WALL_ROW_Y,
  WAREHOUSE_COLS,
  WING_OUTER,
  type Layout,
  type Point,
  type Room,
} from './layout';
import { BASE_W, crispZoom, homeFrame } from './pixels';
import { LightMap, type Light } from './light';
import { ColorGrade } from './grade';
import { Halo, personGlow } from './halo';
import { castsShadow, FloorShade, furnitureCasters, lawnShade, lawnTexture, type WearLayer } from './floor';
import { addStep, decodeWear, encodeWear, mopWear, MOP_RADIUS, settleWear, WEAR_CELL, wearGrid, wornSpot, type WearGrid } from '../game/wear';
import { dayDemand } from '../game/demand';
import { CLASH_FACTOR, PAIR_CHANCE, shelfLinks, type Link } from '../game/neighbors';
import { BARGAIN_CHANCE, BARGAIN_PER_ROW, bargainCapacity, bargainCount, fillBargain, hasBargain, takeBargain } from '../game/bargain';
import { binSmell, ROTS, rotStage, smellChance, smellLevel, type RotStage } from '../game/rot';
import { Rotting } from './rotting';
import { TRASH_KEYS } from './textures';
import { CANDY_PRICE, impulseChance, returnCandy, takeCandy } from '../game/impulse';
import { coffeeChance, cupsOf, useCup } from '../game/coffee';
import { carryBonus, charmPatience, eyeTheft, ownerTiming } from '../game/owner';
import { EDUARD_STAGES, eduardLook, eduardStage, type EduardLook } from '../game/eduard';
import { updateRecords } from '../game/records';
import { cafeDeliver, type CafeDelivery } from '../game/cafe';
import { answerSpecial, grannyRepays, makeSpecial, type SpecialKind, type SpecialVisit } from '../game/special';
import { showChoice } from '../ui/choice';
import { BRAND_BATCH, brandBatchCost, brandToBake, startBrandBatch } from '../game/brand';
import { hasRadio, radioPatience, radioTolerance, radioSpeed } from '../game/radio';
import { managerPick, orderUrgent, receiveUrgent, URGENT_QTYS, URGENT_SECONDS } from '../game/urgent';
import { autoArrived, autoTopUp } from '../game/autoorder';
import { liveEventsFor, type LiveKind } from '../game/minievents';
import { momentGain, momentsFor, noteMoment, type MomentKind } from '../game/moments';
import { Moments } from './moments';
import { questRows } from '../ui/today';
import { showUrgent } from '../ui/urgent';
import {
  bargainRows,
  bargainSprite,
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
import {
  idleRegisters,
  nextRegisterCount,
  nextRegisterPrice,
  registerOfRole,
  registerSlots,
  RELIEF_ROLE,
  TILL_ROLES,
  tillRole,
} from '../game/registers';
import { seeTip } from '../game/tips';
import { AROMA_SECONDS, AROMA_TOLERANCE, bakerShouldBake, bakeryWorking, OVEN_BURN_SECONDS, sellWholesale, startBatch, takeOutBread, wholesaleToBake } from '../game/bakery';
import { canWorkNight, NIGHT_GUESTS, NIGHT_MARKUP, NIGHT_POWER, NIGHT_SECONDS, NIGHT_TOLERANCE, startNight } from '../game/night';
import { CAT_TIP, catHome, catPatience, catTipChance } from '../game/cat';
import { note, reviewsFor } from '../game/reviews';
import { warLeaves } from '../game/war';
import { lossAdvice, noteLost } from '../game/losses';
import { fairTolerance, isFairDay } from '../game/fair';
import { deferLiteNote, fpsSummary, fpsVerdict, lowerQuality, quality, qualityChosen, takeLiteNote, type Quality } from '../platform/quality';
import { cleanHall, dreamShelf, firstDayGift, firstDayRating, gentleDay, GRANNY_SCAN_SLOW, grannyServesAfter, grannyStays, grannyStocksNow, praiseAt, quietDays } from '../game/firstday';
import { framesThrottled, modalOpen } from '../platform/frameCap';
import {
  deliveryRating,
  deliveryTip,
  makeHomeOrder,
  nextCallIn,
  ORDER_TIMEOUT,
  orderUnits,
  outcomeFor,
  packHomeOrder,
  rateDelivery,
  vehicleOf,
  type HomeOrder,
  type Vehicle,
} from '../game/delivery';
import { clock, DeliveryUi } from '../ui/delivery';
import { hallNudge, mainGoal, NUDGE_IDLE_MS, tomorrowTeaser, type HallNudge } from '../game/nudge';
import { teaserText, tryNudge } from '../ui/nudge';
import {
  HUD_TOP,
  HUD_BOTTOM,
  FRAME_PAD,
  SIGN_TOP,
  ART,
  STREET_VIEW,
  TUTORIAL_DAYS,
  NUDGE_SHOW_MS,
  LOW_STOCK,
  FURNITURE_TOP,
  CAMERA_REACH,
  WALL,
  FACADE_H,
  FACADE_STYLES,
  FLOORS,
  HEADLIGHT,
  HEADLIGHT_POWER,
  CAR_TYPES,
  type Popup,
  type Neighbor,
  RIVAL_LOOKS,
  FRIEND_VISITS,
  FRIEND_TIP,
  FRIEND_GIFT,
  PARK_TREES,
  RIVAL_ACROSS_H,
  LIGHT_DEPTH,
  QUAKE_WAVE_MS,
  QUAKE_SHAKE_PX,
  QUAKE_SETTLE_MS,
  QUAKE_SHATTER_MAX,
  QUAKE_DUST,
  QUAKE_GRIT,
  UNBOX,
  UNBOX_STEP,
  NEW_TAG_MS,
  ITEM_VARIANTS,
  PATIENCE_MS,
  FIRST_PATIENCE,
  ONB_FIRST_AT,
  ONB_HELLO_AT,
  ONB_NEXT_GUEST,
  ONB_BYE_AFTER,
  ONB_ROAD_MS,
  GRANNY_SPEED,
  GRANNY_PATIENCE_MS,
  GRANNY_SHELF_WAIT_MS,
  STREET_TAP_MS,
  CUSTOMER_SPEED,
  SELLER_SPEED,
  RUN_PACE,
  CALL_EVERY_MS,
  KIOSK_GLOW,
  KIOSK_ALARM,
  RELIEF_TAP_MS,
  RELIEF_HURRY_MAX_MS,
  RELIEF_HURRY_SHARE,
  BARGAIN_BOTTOM,
  BARGAIN_BASE,
  BARGAIN_STEP,
  TRASH_CHANCE,
  MAX_TRASH,
  TRASH_COMPLAINT,
  MUD_CHANCE,
  MAX_MUD,
  MOP_MS,
  BIN_DROP_MS,
  MAX_RESTOCK_TRIPS,
  BAG_MS,
  DUMP_MS,
  SPILL_CHANCE,
  SPILL_TINTS,
  SPILL_MOP_MS,
  LIVE_WINDOW,
  LIVE_WINDOWS,
  LIVE_RETRY_MS,
  LIVE_LATEST,
  AUTO_CHECK_SECONDS,
  FIX_MS,
  LEAK_FIX_MS,
  COMBO_WINDOW_MS,
  TOILET_CHANCE,
  TOILET_DIRT_PER_VISIT,
  TOILET_DIRTY,
  TOILET_CLEAN_MS,
  TRASH_CLEAN_MS,
  PICKUP_MS,
  PLACE_MS,
  COOK_LATE,
  SHELF_LOOK,
  DEPT_INLAY_DEPTH,
  FLOOR_SHADE_DEPTH,
  WEAR_SAMPLE_MS,
  POLISH_EVERY_MS,
  POLISH_MIN_WEAR,
  TV_SPOTS,
  TV_SPAN,
  STAR_SPOTS,
  BLOGGER_SPAN,
  COLLAB_SPAN,
  ITEM_AREA,
  FLORIST_SPOTS,
  WHITE_SHIRT,
  SHIRTS,
  HAIR_COLORS,
  type EmoteKey,
  VIEW_SUFFIX,
  type Look,
  GAIT,
  OWN_SPEED,
  QUEUE_SNUG,
  QUEUE_STAGGER,
  DOOR_TURN,
  DOOR_EDGE,
  TURN_MS,
  LANE_SPEED,
  LANE_EVERY,
  STEP_GRACE,
  type Stride,
  gaitOf,
  WATCHMAN,
  randomLook,
  HAT_COLORS,
  DOG_COLORS,
  customerLook,
  nightLook,
  nightGuestLook,
  withCompanionItems,
  STAFF_ACC,
  THIEF_SHIRT,
  type ParkSpot,
  type LotCar,
  type ParkingLot,
  type RoadCar,
  straight,
  bend,
  cruise,
  type CarLeg,
  LOT,
  LOT_CARS,
  LOT_FOOT,
  LOT_DRIVE,
  LOT_DRIVE_END,
  LOT_MOUTH,
  SIDE_SHOP_X,
  SIDE_SHOP_W,
  LOT_DEPTH,
  CAR_ROAD,
  CAR_DRIVE,
  CAR_LOT,
  CAR_CREEP,
  LOT_NEIGHBORS,
  LOT_NEIGHBORS_LITE,
  CAR_CUSTOMERS,
  CAR_LAST_SECONDS,
  LOT_ROAD_DAYS,
  CAR_COLORS,
  THIEF_SPEED,
  UNIFORMS,
  STAFF_SPEED,
  VERANDA_D,
  COFFEE_WAITING,
  COFFEE_ORDERS,
  INSPECTOR_SHIRT,
  VALYA,
  GRANDMA,
  EDUARD,
  FRONT_ONLY,
  GRANDMA_LINES_KEYS,
  ORDER_GUESTS,
  ownerLook,
  STAFF_HAIR,
  INSPECTOR_AT,
  SONYA_AT,
  SONYA,
  LIVE_GUEST_AT,
  LIVE_GUEST_LOOKS,
  JURY_AT,
  JURY_LOOKS,
  BROKEN_TINT,
  SKINS,
  type Customer,
  type Register,
  type Kiosk,
  type Oven,
  type KitchenView,
  type TrashKind,
  type Worker,
  type Kin,
  discard,
  staffKey,
  type ShelfView,
  type QuakeFall,
  type TakenSpot,
  type NightLight,
  type Lamp,
  type Pigeon,
  type ChoreStep,
  type Parcel,
  RETRY_CALL,
  packMs,
  VAN_TINT,
  CALL_CARD_TIP,
  ROT_TIP,
} from './common';
import * as motion from './motion';
import * as effects from './effects';
import * as pets from './pets';
import * as lighting from './lighting';
import * as weatherFx from './weatherFx';
import * as decorations from './decorations';

export class StoreScene extends Phaser.Scene {
  state!: StoreState;
  layout!: Layout;
  /** Для какого уровня помещения построен зал (при расширении перестраиваем). */
  builtLevel = -1;
  /** Каким было помещение Эдуарда, когда рисовали улицу. */
  private builtEduard: EduardLook | null = null;
  /** Всплывающие надписи на экране: чтобы не налезали друг на друга и склеивались. */
  popups: Popup[] = [];
  /** Кухня во флигеле: плита, стол повара, витрина с тарелками (кухни нет — пусто). */
  private kitchenView?: KitchenView;
  /** Полка «Еда» у входа (kitchen.ts): где стоит, картинка и тарелки на ней. */
  private foodView?: { at: { x: number; y: number }; img: Phaser.GameObjects.Image; plates: Phaser.GameObjects.Image[] };
  /** В какой день повар уже пожаловался, что не из чего готовить (раз в день, не чаще). */
  private cookNoFoodDay = 0;
  /** Чей магазин друга нарисован сбоку (торговая неделя). */
  private builtFriend?: string;
  /** Магазин босса района стоит за дорогой (на месте «Гиганта»), а не сбоку. */
  private rivalAcross = false;
  /** Каким построен «Гигант» за дорогой (giant.ts): стройка, магазин, закрытый. */
  private builtGiant: GiantLook = 'none';
  /** Каким построен свой филиал в здании «Гиганта» (branch.ts); '' — его нет. */
  private builtBranch = '';
  /** Какие здания района стояли, когда рисовали улицу (district.ts). */
  private builtDistrict = '';
  /** Что из благоустройства района стояло на улице (hood.ts). */
  private builtHood = '';
  /** Где на тротуаре за дорогой висят вывески зданий (середины): новые фонари района их обходят. */
  private signsAcross: number[] = [];
  /** Снежные покрывала на крышах соседей: видны в снегопад. */
  roofSnow: Phaser.GameObjects.Rectangle[] = [];
  /** Козни конкурента на улице сегодня (tricks.ts): промоутеры, перетяжки, их таймеры. */
  private trickObjs: Phaser.GameObjects.GameObject[] = [];
  private trickTimers: Phaser.Time.TimerEvent[] = [];
  /** Ночью у входа играет музыкант — ночных гостей больше (nightGuests.ts). */
  private busker = false;
  stats: DayStats = emptyDayStats();
  hud!: Hud;
  shelfViews: ShelfView[] = [];
  /** Сколько раз перерисовывали полки: толчок по нему узнаёт, что товар на картинках уже другой. */
  /** Толчок: уронить разбитое, до чего волна ещё не дошла, — сразу, пока полки не перерисовали. */
  private quakeFlush?: () => void;
  private boxes: Phaser.GameObjects.Image[] = [];
  private shutters: Phaser.GameObjects.Image[] = [];
  private arrow?: Phaser.GameObjects.Image;
  /** Новое начало (game/onboarding.ts): облачко бабушки, она сама у входа и кольцо у кассы до первой продажи. */
  private readonly say = new SayBubble();
  /** Бабушкино обучение (game/tutorial.ts): подсветка и стрелка у того, что нажать. */
  private readonly coach = new Coach();
  /** Подсветку сейчас показывает зал (а не утро или итоги). */
  private hallCoach = false;
  /** Какой шаг обучения уже ушёл в аналитику, и сколько он ждёт без цели и с целью (мс дня). */
  private tutTracked: TutStep | null = null;
  private tutIdleMs = 0;
  private tutShownMs = 0;
  private granny?: Phaser.GameObjects.Container;
  /** Коробка в руках бабушки (раскладывает полку в первый день, firstday.ts). */
  private grannyBox?: Phaser.GameObjects.Image;
  /** Бабушка занята делом (полка, касса) в этой постройке зала: worldGen, при котором дело начато. */
  private grannyJob = -1;
  /** С какого момента (time.now) в зале пустует полка, которую есть чем пополнить; -1 — не пустует. */
  private shelfEmptySince = -1;
  private tillRing?: Phaser.GameObjects.Ellipse;
  /** Когда нажали «Играть» (мс, performance.now): шаги первых минут считаются от него. */
  private playAt = 0;
  /** Какие реплики бабушка уже сказала в этот запуск (убранная касанием не возвращается). */
  private readonly onbSaid = new Set<string>();
  /** Сколько раз бабушка уже похвалила в этот запуск (реплики идут по кругу). */
  private praised = 0;
  private praisedAt = '';
  /** Как построен зал первой недели (firstday.ts cleanHall): поменялось — утром перестроить. */
  private builtClean = '';
  /** Бабушка подарила вещь на прилавок — утром зал перестроить, чтобы она появилась. */
  private giftRebuild = false;
  /** Палец двигал камеру — это не нажатие. */
  dragged = false;
  /** Сколько звёзд рейтинга уже отпраздновали волной искр (-1 — ещё не знаем). */
  starsCheered = -1;
  /** Рекорд выручки сегодня уже отметили конфетти. */
  recordCheered = false;
  /** Куда камера возвращается после осмотра квартала. */
  private home = { x: 0, y: 0 };
  private homeTimer?: Phaser.Time.TimerEvent;
  /** Колёсико затихло — масштаб доходит до ровного. */
  private wheelTimer?: Phaser.Time.TimerEvent;
  private baseZoom = 1;
  /** Щипок двумя пальцами: расстояние и зум в начале. */
  private pinch: { dist: number; zoom: number } | null = null;
  /** Все люди на экране: для шагов и дыхания. */
  people = new Set<Phaser.GameObjects.Container>();
  /** Нарисованное один раз в RenderTexture (bakeSpots) и как нарисовать снова после потери WebGL контекста. */
  baked = new Map<Phaser.GameObjects.RenderTexture, () => void>();
  /** Номер постройки мира (buildWorld): дела, начатые в прежнем мире, по нему понимают, что мира уже нет. */
  private worldGen = 0;
  /** Повторы вещей мира (worldTimer): останавливаются при перестройке. */
  private worldTimers: Phaser.Time.TimerEvent[] = [];
  /** Чья швабра сейчас звучит (продавца, уборщика) и как её оборвать: дело бросили — стихает и звук. */
  private mops = new Map<Phaser.GameObjects.Container, () => void>();
  /** Насколько открыты двери: 0 — закрыты, 1 — открыты. */
  doorOpen = 0;
  /** Погода дня и всё, что её рисует (частицы, снег на газоне, гирлянда, ёлка). */
  weather: Weather = 'clear';
  weatherObjs: Phaser.GameObjects.GameObject[] = [];
  /** Дождь дня: капли, брызги, круги и лужи — разгоняется утром и в иные дни к вечеру кончается. */
  rainFx?: { rain: Phaser.GameObjects.Particles.ParticleEmitter; splash: Phaser.GameObjects.Particles.ParticleEmitter; base: number; puddles: Phaser.GameObjects.Image[]; ripple?: Phaser.GameObjects.Particles.ParticleEmitter; sheen?: Phaser.GameObjects.Rectangle };
  /** Дождь сегодня уже кончился: зонты закрыты, лужи сохнут. */
  rainStopped = false;
  /** Доля прошедшего дня (0 — утро, 1 — конец смены): солнце, туман, тени. */
  dayProgress = 0;
  /** Мусорный контейнер на улице (его трясёт мусоровоз). */
  private dumpImg?: Phaser.GameObjects.Image;
  /** Пол блестит (мрамор): в нём отражаются полки. */
  glossyFloor = false;
  /** Мороз: на улице изо рта идёт пар. */
  coldAir = false;
  /** Облачка пыли и брызги из-под ног бегущих, что сейчас в воздухе (у брызг — первая капля). */
  footDust = new Set<Phaser.GameObjects.GameObject>();
  /** Влажный блеск после мытья: пока пол сохнет, бегущий поднимает брызги. */
  wetSheens = new Set<Phaser.GameObjects.Ellipse>();
  /** Пятна света от потолочных ламп с номером ряда: утром включаются ряд за рядом. */
  lampPools: { img: Phaser.GameObjects.Image; row: number }[] = [];
  /** Живой пол (floor.ts): мягкие тени у стен и под мебелью и потёртость — одна картинка поверх плитки. */
  private floor = new FloorShade(this);
  /**
   * Потёртость пола зала (game/wear.ts): клетки 0…1 из сохранения и шаги за сегодня по той же сетке
   * (кто где прошёл — sampleSteps). level — для какого помещения сетка.
   */
  private wear: { level: number; grid: WearGrid; cells: Float32Array; steps: Float32Array } | null = null;
  /** Когда уборщик в последний раз натирал потёртый пол (мс времени сцены): не весь день подряд. */
  private polishedAt = -Infinity;
  /** Подвесные лампы (декор «Свет») с пятном света под ними: от подземного толчка качаются. */
  hangingLamps: { lamp: Phaser.GameObjects.Image; bulb: Phaser.GameObjects.Image }[] = [];
  /** Цвета осколков разбитого товара по картинке — чтобы не читать пиксели каждый раз. */
  private shardColors = new Map<string, number[]>();
  /** Пруд в парке: рядом летают светлячки. */
  parkPond?: { x: number; y: number };
  /** Солнечные пятна от окон на полу зала. */
  sunPatches: Phaser.GameObjects.Image[] = [];
  /** Вечернее солнце из окон правой стены (updateDaylight). */
  sideSun: Phaser.GameObjects.Image[] = [];
  /** Утренние столбы света от окон задней стены к солнечным пятнам (поворачиваются за пятном). */
  sunRays: { ray: Phaser.GameObjects.Image; patch: Phaser.GameObjects.Image }[] = [];
  /** Вечерние оранжевые лучи из окон правой стены. */
  sideRays: Phaser.GameObjects.Image[] = [];
  /** Золотые пылинки в лучах; rayLight — насколько лучи сейчас светят (0 — их нет). */
  rayDust?: Phaser.GameObjects.Particles.ParticleEmitter;
  /** Тёплая пыль в воздухе зала. */
  hallDust?: Phaser.GameObjects.Particles.ParticleEmitter;
  rayLight = 0;
  /** Фонари на улице, в парке и на парковке: зажигаются по очереди. */
  lamps: Lamp[] = [];
  /** Мотыльки у горящих фонарей (весной и летом в сухой вечер). */
  moths: { img: Phaser.GameObjects.Image; lamp: Lamp; phase: number }[] = [];
  /** Вечерний свет мебели: бра на задней стене (и полумрак стены с тенью под карнизом), полоски над товаром, стекло автомата. */
  wallCones: Phaser.GameObjects.Image[] = [];
  wallDusk?: Phaser.GameObjects.Graphics;
  shelfStrips: Phaser.GameObjects.Image[] = [];
  vendingGlow?: { glass: Phaser.GameObjects.Rectangle; spill: Phaser.GameObjects.Image };
  /** Выключатели мебели: утром (lightsOn) бра загораются с дальним рядом ламп, автомат моргает дважды. */
  furnitureOn = { wall: 1, vending: 1 };
  /** Утренний туман над улицей и газонами. */
  fogs: Phaser.GameObjects.Image[] = [];
  /** Табличка «Открыто / Закрыто» на двери. */
  private doorSign?: Phaser.GameObjects.Image;
  lawns: { x: number; y: number; w: number; h: number }[] = [];
  greenery: Phaser.GameObjects.Image[] = [];
  /** Снимок зала перед закрытием — для карточки итогов дня. */
  private dayShot: HTMLImageElement | null = null;
  doorImg!: Phaser.GameObjects.Image;
  /** Карта освещения (scenes/light.ts): темнота и свет ламп, витрин, фонарей, фар и холодильников. */
  light!: LightMap;
  /** Цветокоррекция по часу и погоде (scenes/grade.ts): один проход вместо тёплого тона и виньетки. */
  grade!: ColorGrade;
  /** Насколько вечер (0 — день, 1 — сумерки): фары машин горят сильнее. */
  evening = 0;
  /** Ночные огни (витрины, лужи света, конусы фонарей, неон): сила растёт к вечеру. */
  nightLights: NightLight[] = [];
  /** Неподвижные картинки мира (деревья, дома, клумбы) с их рамками — для отсечения за краем экрана. */
  private cullables: { obj: Phaser.GameObjects.GameObject & { cameraFilter: number }; box: Phaser.Geom.Rectangle }[] = [];
  /** Мир перестроен — список для отсечения собрать заново (на следующем кадре, когда всё уже на месте). */
  cullDirty = true;
  /** Идёт перестановка полок: камера не ездит, полки — «призраки», которые тянут пальцем. */
  arranging = false;
  /** Парковка за магазином и проезд к ней: места, машины на них и кто сейчас едет (живая днём). */
  private parking: ParkingLot | null = null;
  private parkingTimer?: Phaser.Time.TimerEvent;
  /** Машины на улице и их полоса: с парковки выезжают в просвет. */
  private roadTraffic = new Set<RoadCar>();
  /** Стаи птиц над кварталом (buildAmbient). */
  private flockTimer?: Phaser.Time.TimerEvent;
  /** Порывы ветра (windGust): таймер, деревья с кронами и навесы соседей с зонтиками веранды. */
  private windTimer?: Phaser.Time.TimerEvent;
  windTrees: Phaser.GameObjects.Image[] = [];
  awnings: Phaser.GameObjects.Image[] = [];
  /** Часы грозового качания (мс, идут с ускорением игры). */
  windClock = 0;
  /**
   * Последний порыв: сколько мс прошло (по часам твинов — чтобы деревья гнулись в такт с кустами
   * и листьями), от какого края кадра пошла волна и дует ли ещё.
   */
  gust = { t: 0, x: 0, on: false };
  /** Сила грозового качания (0…1): нарастает и стихает плавно — гроза кончилась, деревья не замирают рывком. */
  windSway = 0;
  /** Деревья стоят ровно — каждый кадр их не трогаем. */
  windStill = true;
  /** Дневная живность и тени облаков: к вечеру исчезают (updateLighting). */
  dayLife: { obj: Phaser.GameObjects.Image; alpha: number }[] = [];
  /** Вещи зала, которые двигают при перестановке (автомат, ведро, растения): место и «след» на полу. */
  propList: (Prop & { tex: string; oy?: number })[] = [];
  /** Стандартные места вещей зала (для «Как было» и чтобы не хранить несдвинутое). */
  private propDefaults: Record<string, { x: number; y: number }> = {};
  /** Оборудование и украшения зала при прошлой постройке: «текстура@x,y» (по ним видно, что куплено). */
  private builtProps = new Set<string>();
  /** Купленное с утра: при открытии его распакуют из коробки. Ключ — «текстура@x,y», картинка — из последней постройки. */
  private freshProps = new Map<string, Phaser.GameObjects.Image | undefined>();
  /** Отложенное запекание пола после распаковки новинок (bakeFloorSoon). */
  private floorBakeTimer?: Phaser.Time.TimerEvent;
  /** Наняли утром: при открытии новенький войдёт с улицы в дверь, а не появится сразу на месте. */
  private newHires = new Set<string>();
  /** Новенькие, которые сейчас идут с улицы: перед ними разъезжаются двери. */
  newcomers = new Set<Phaser.GameObjects.Container>();
  /** Где сейчас стоит автомат с напитками (на нём радио). */
  vendingAt = { x: 0, y: 0 };
  /** Уровень графики этого запуска (platform/quality.ts): если игра тормозит, он понижается на время. */
  private gfx: Quality = quality();
  /** Лёгкая графика: без виньетки и облаков (холст поменьше — со следующего запуска). */
  lite = this.gfx === 'lite';
  /** Покупатель только что взял товар (tryTake): с каких мест полки — reachShelf пускает его оттуда. */
  private takenFrom: TakenSpot[] = [];
  /** Посекундные замеры FPS за день: медиана уходит в аналитику, при тормозах — лёгкая графика. */
  private fpsSamples: number[] = [];
  private fpsFrames = 0;
  private fpsMs = 0;
  /** Сколько посекундных замеров с прошлого понижения графики. */
  private fpsSince = 0;
  private cullAt = '';
  /** Ночь между днями: какая доля окон в домах уже погасла (0 — все горят). */
  lightsOut = 0;
  /** Стрелки настенных часов: идут по ходу смены с 8:00 до 20:00. */
  clockHands?: Phaser.GameObjects.Graphics;
  /** Неоновая вывеска в зале (декор), если висит, — по x: жужжит. */
  neonDecorX?: number;
  /** Мебель в зале (в координатах центра человека): люди обходят её. */
  obstacles: Rect[] = [];
  /** Люди этого кадра для обхода встречных (passers): считаем раз за кадр, а не на каждого идущего. */
  private crowd: { frame: number; list: Passer[] } = { frame: -1, list: [] };
  /** Кассы самообслуживания (сколько куплено) — у правой стены над кассами. */
  kiosks: Kiosk[] = [];
  /** Когда последний раз всплывало «быстрее» над кассой (касания сменщику). */
  private lastHurry = 0;
  /** Сменщик дошёл до кассы хозяина и пробивает (новенький — с той минуты, как встал за неё). */
  private reliefReady = false;
  /** Мини-событие дня: что сейчас происходит и всё, что его рисует. */
  private liveEvent: LiveKind | null = null;
  private liveObjs: { destroy: () => void }[] = [];
  blackout = false;
  private fuseBox?: Phaser.GameObjects.Image;
  fuseGlow?: Halo;
  /** Утренняя закупка: сколько было на складе в начале утра и сколько коробок ещё ждут доставки. */
  private morningStock = 0;
  private awaitingBoxes = 0;
  /** Реклама на улице: промоутер с листовками, баннер на фасаде, блогер у входа. */
  private adObjs: { destroy: () => void }[] = [];
  /** Летучие мыши на Хэллоуин: видны только вечером. */
  bats: Phaser.GameObjects.Image[] = [];
  /** Где стоят фонари: от них падают тени прохожих. */
  lampXs: number[] = [];
  /** Поддон с водой или стойка «Акция» на местах, где полки ещё нет. */
  private slotDecor: Phaser.GameObjects.Image[] = [];
  /** Планировка следующего уровня: камера и улица рассчитаны на неё. */
  next!: Layout;
  /** Линия тротуара, по которой ходят прохожие и приходят покупатели. */
  streetY = 0;
  /** За сегодня: сколько покупателей пробил сам хозяин и скольких из них — касанием улицы (аналитика). */
  private serves = { owner: 0, street: 0 };
  customers = new Set<Customer>();
  private queue: Customer[] = [];
  /** Сколько встало в очередь за всё время: чётный — ровно, нечётный — чуть левее (queueSpot). */
  private queueTurn = 0;
  trash = new Set<Phaser.GameObjects.Image>();
  /** Мусор, за которым уже кто-то пошёл. */
  private claimedTrash = new Set<Phaser.GameObjects.Image>();
  private workers = new Map<StaffRole, Worker>();
  /** Смена номера останавливает циклы работы старых сотрудников. */
  private staffGen = 0;
  private toiletDirt = 0;
  /** Срочный подвоз: что едет и занят ли фургон. */
  /** auto — подвоз автозаказа (по приезде вычёркивается из autoOrder.today.inbound). */
  private urgentOrders: { id: ProductId; qty: number; auto?: boolean }[] = [];
  private urgentVanBusy = false;
  /** Через сколько секунд дня автозаказ снова проверит, не кончился ли товар. */
  private autoCheck = 0;
  /** Электронные ценники сегодня уже уценили старое. */
  private eveningMarkdown = false;
  private wcStink!: Phaser.GameObjects.Image;
  private wcDoor!: Phaser.GameObjects.Image;
  private wcBar!: Phaser.GameObjects.Image;
  seller!: Phaser.GameObjects.Container;
  private carried!: Phaser.GameObjects.Image;
  private sellerBusy = false;
  /** Номер текущего дела продавца: смена номера отменяет дело (продавца позвали к кассе). */
  private choreId = 0;
  private lastCall = 0;
  timeLeft = DAY_SECONDS;
  /** Инспектор: 'pending' — ещё не пришёл, 'here' — ходит по залу, 'done' — ушёл. */
  private inspector: 'none' | 'pending' | 'here' | 'done' = 'none';
  private inspection: InspectionResult | null = null;
  private rushAnnounced = false;
  /** «Позвать на помощь»: до какого момента видна кнопка и ждём ли окно «Поделиться» (help.ts). */
  private helpUntil = 0;
  private helpBusy = false;
  /** Сколько заданий дня уже отпраздновали всплывашкой. */
  private questsSeen = 0;
  /** Прогресс заданий, по которому в последний раз строился список в HUD. */
  private questRowsKey = '';
  /** Активные моменты дня (game/moments.ts, scenes/moments.ts): монетка, чаевые, гость машет… */
  private readonly moments = new Moments({
    scene: this,
    lite: () => this.lite,
    blocked: () => this.momentBlocked(),
    hallGuest: () => this.momentGuest(),
    queueGuest: () => this.queue.find((c) => !c.gone && !c.thief && !c.serving && c.sprite.active)?.sprite ?? null,
    till: () => this.registers[0]?.counter ?? this.layout.counter,
    floor: () => this.freeFloorPoint(),
    popup: (x, y, text, color) => this.popup(x, y, text, color),
    emote: (person, key) => effects.emote(this, person, key),
    coins: (x, y, n) => effects.flyCoins(this, x, y, n),
    puff: (x, y) => effects.puff(this, x, y),
    tap: (action) => this.tap(action),
    caught: (kind) => this.momentCaught(kind),
    missed: () => noteMoment(this.stats, false),
  });
  /** Кассы: основная и (если куплена) вторая слева от очереди. Очередь одна — идёт к свободной. */
  registers: Register[] = [];
  /** Ведро с мусором в зале: сколько в нём, картинка, выносят ли его сейчас и сколько несут в мешке. */
  private binFill = 0;
  binImg?: Phaser.GameObjects.Image;
  /** Полка «Уценка» (bargain.ts): где стоит и картинки товара на ней (по местам горки). */
  private bargainAt: { x: number; y: number } | null = null;
  private bargainItems: Phaser.GameObjects.Image[] = [];
  /** Гниющий мусор (rot.ts): мухи и вонь над ним и над переполненным ведром. */
  private rotting = new Rotting(this, () => this.lite);
  /** Сколько секунд ведро стоит переполненным (тогда оно тоже пахнет). */
  private binFullFor = 0;
  /** Всплывашка «Мусор гниёт» уже была в этом запуске (пока игрок не убрал гнилое — подсказка внизу). */
  private rotWarned = false;
  binGlow?: Halo;
  private binStink?: Phaser.GameObjects.Image;
  binBusy = false;
  /** Кто сейчас выносит мусор: продавец (его могут позвать к кассе) или уборщица. */
  private binBy: 'seller' | 'cleaner' | null = null;
  private bagCarried = 0;
  /** Продавец несёт мусор к ведру (если позовут к кассе — мусор упадёт обратно на пол). */
  private carryingTrash = false;
  /** Голуби на тротуаре: разлетаются, когда рядом проходит человек. */
  private pigeons: Pigeon[] = [];
  /** Таймеры кота и голубей: при перестройке мира старые останавливаются. */
  critterTimers: Phaser.Time.TimerEvent[] = [];
  /** Как кафе забрало утром заказ по договору — для итогов дня. */
  private cafeToday: CafeDelivery | null = null;
  /** Ноты над радио, пока оно играет. */
  radioTimer?: Phaser.Time.TimerEvent;
  /** Где стоит приёмник (по x) — оттуда слышно радио. */
  radioX?: number;
  /** Музыка: открыт титул; после ночной смены (итоги, ночь) ещё звучит ночная; зимняя ли сегодня. */
  onTitle = true;
  nightMusic = false;
  private winterTune = false;
  /** Новый год для звуков (салют вечером): новогодняя неделя в игре или 31.12–1.01 по календарю. */
  newYearSound = false;
  /** Что вокруг — для атмосферы (ambience.ts): один объект на все кадры, без мусора в памяти. */
  ambLife: AmbLife = { customers: 0, morning: 0, newYear: false, lateAutumn: false, night: false, lite: false, neon: null };
  /** Для какого состояния посчитаны работающие кассы (звук зала). */
  tillsFor: StoreState | null = null;
  private valyaCame = false;
  /** Серия обслуживания: сколько подряд и когда была последняя продажа. */
  private combo = 0;
  private lastSaleAt = -Infinity;
  private nextSpawn = 1;
  running = false;
  /** Подсказка «что дальше» в зале (game/nudge.ts): когда игрок последний раз касался экрана, какая подсказка и до каких пор. */
  private lastTouch = 0;
  private nudge: HallNudge | null = null;
  private nudgeUntil = 0;
  /** Для какого состояния нарисована цель в HUD (состояние меняется целиком — сравниваем ссылку). */
  private goalFor: StoreState | null = null;
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
  night = false;
  private nightAsked = false;
  /** Кот у входа: картинка, где его лежанка и гуляет ли он сейчас по залу. */
  catImg?: Phaser.GameObjects.Image;
  /** Пёс Бобик у будки и таймер, который машет его хвостом. */
  bobik?: Phaser.GameObjects.Image;
  bobikWag?: Phaser.Time.TimerEvent;
  /** Магазин закрыт на ночь (роллеты опущены): Бобик сидит настороже, у двери — сторож. */
  closed = false;
  /** Рабочий день идёт (от «Открыть магазин» до итогов) — для сторожа зависаний. */
  dayOpen = false;
  /** «Заглянуть к конкуренту» (game/rival.ts): сейчас в чужом магазине; сколько гостей сегодня увели. */
  private rivalVisit = false;
  /** На экране утро своего магазина (до «Открыть магазин»): только тогда — новости о проделках и ответный визит. */
  private inMorning = false;
  private rivalLost = 0;
  /** Когда спрашивали сервер, что натворили у нас; что пришло, пока мы были в гостях. */
  private rivalCheckedAt = 0;
  private rivalPending: { pranks: PrankIn[]; thanks: string[] } | null = null;
  /** Сколько мс день стоит без открытых окон — сторож запускает его дальше. */
  private stallMs = 0;
  private nightWatch: Phaser.GameObjects.GameObject[] = [];
  /** Сколько кубков стоит на прилавке; жюри конкурса сегодня: ждём, пришло, ушло. */
  builtCup = 0;
  private jury: 'none' | 'pending' | 'here' | 'done' = 'none';
  /** Соня сегодня заглянет в магазин (сюжет «Папа и Соня»). */
  private sonya: 'none' | 'pending' | 'here' | 'done' = 'none';
  /** Праздничный гость сегодня (game/live.ts): кто, ждём / пришёл / ушёл и настоящая дата визита. */
  private liveGuest: { who: GuestId; phase: 'pending' | 'here' | 'done'; date: string } | null = null;
  catHome = { x: 0, y: 0 };
  catOut = false;
  /** Кот сидит посреди зала: таймер, который водит его хвостом, моргает и умывает (есть, пока сидит). */
  catSitTimer?: Phaser.Time.TimerEvent;
  /** Сколько ещё тиков кот жмурится (погладили — медленно моргает). */
  catBlink = 0;
  /** Флажки, шарики и лоток ярмарки; лоток продаёт со склада по таймеру. */
  fairObjs: Phaser.GameObjects.GameObject[] = [];
  /** Особый день (bigday.ts): что на улице — марево, вода, шествие; убирается к вечеру. */
  private bigObjs: { destroy: () => void }[] = [];
  /** Блэкаут на весь район: темно, касса считает вручную (щиток не поможет). */
  powerCut = false;
  /** Свадебный заказ: заберут вечером. */
  private wedding: WeddingOrder | null = null;
  stall?: Phaser.GameObjects.Image;
  stallTimer?: Phaser.Time.TimerEvent;
  /** Доставка на дом (delivery.ts): телефон у кассы, звонок, принятые заказы, курьер со своим транспортом. */
  private phone?: Phaser.GameObjects.Image;
  /** Кольца вокруг звонящего телефона и его подсветка. */
  private phoneHalo?: Phaser.GameObjects.Arc;
  phoneGlow?: Halo;
  /**
   * Звонок, на который ещё не ответили: заказ, когда позвонили (playTime), таймеры ответа, трели и дрожи
   * трубки; covered — поверх открыто окно, звонок ждёт.
   */
  call: { order: HomeOrder; at: number; timer: Phaser.Time.TimerEvent; ringer: Phaser.Time.TimerEvent; shake: Phaser.Time.TimerEvent; covered?: boolean } | null = null;
  /** Когда позвонят в следующий раз. */
  private callTimer?: Phaser.Time.TimerEvent;
  /** Принятые заказы: ждут сборки, собираются, стоят коробкой у двери или едут с курьером. */
  private parcels: Parcel[] = [];
  /** Хозяин сам соберёт ждущий заказ, как только освободится (принял звонок или нажал «Собрать»). */
  private packRequested = false;
  private courier?: Phaser.GameObjects.Container;
  /** Велосипед или мопед у входа (фургончик подъезжает только за заказами). */
  private courierRide?: Phaser.GameObjects.Image;
  private courierHome = { x: 0, y: 0 };
  private courierBusy = false;
  /** Поездка курьера — для плашки «🚲 в пути 0:06»: когда выехал (playTime), сколько ехать, на чём. */
  private courierTrip: { start: number; seconds: number; icon: string } | null = null;
  /** Карточка звонка внизу экрана и плашка-статус доставки (ui/delivery.ts). */
  private readonly deliveryUi = new DeliveryUi();
  /** Менеджер сейчас ходит по залу (а не стоит за кассой вместо кассира) — ему можно поручить посылку. */
  private managerOnFloor = false;
  /** Ускорение дня (×1 или ×2). */
  private speed = 1;
  /** Сколько игровых секунд магазин проработал (с ускорением, без пауз): часы доставки — чаевые и «в пути 0:06». */
  private playTime = 0;
  /** В какой игровой день уже был ритуал возвращения (offerReturn): утро открывается не раз за день. */
  private ritualDay = -1;

  constructor() {
    super('store');
  }

  create(): void {
    setErrorContext(() => ({ day: this.state?.day, level: this.state?.level, running: this.running, ua: navigator.userAgent.slice(0, 120) }));
    // Звук мира слышен с той стороны экрана, где он случился (касса слева — слева).
    setListener(() => {
      const v = this.cameras.main.worldView;
      return { left: v.x, width: v.width };
    });
    const savedAt = lastSavedAt();
    const save = loadGame();
    this.state = ensureRush(ensureSeason(ensurePlan(save ?? newGame()), trustedNow()), trustedNow());
    if (!save) track('new_game', 1);
    // Новичок: какое начало ему достанется (A/B, game/onboarding.ts) — прежний обход вкладок или сразу
    // в зале. ?onb=play или ?onb=tour в адресе — выбрать самому (для проверки).
    if (!save) {
      const asked = new URLSearchParams(location.search).get('onb');
      const cohort: Cohort = asked === 'play' || asked === 'tour' ? asked : pickCohort(telegramUserId(), Math.random);
      this.state = startCohort(this.state, cohort);
      track('onb_ab', 1, cohort === 'play' ? 1 : 0);
    }
    // Шаги первых минут уходят на сервер сразу, не дожидаясь конца дня (platform/analytics.ts).
    // В гостях у друга на экране его магазин — свой прогресс тогда не шлём.
    setProgressSource(() => (savingPaused() ? undefined : this.state));
    // Пока игрока не было, кассир торговал: деньги — в кассу, полки чуть пустеют.
    const away = save && savedAt ? awayTrade(this.state, trustedNow() - savedAt) : null;
    if (away) {
      this.state = away.state;
      track('away', this.state.day, away.revenue);
    }
    // Филиал (branch.ts) тоже работал — понемногу, без кассира: им правит управляющий.
    const branchAwayTrade = save && savedAt ? branchAway(this.state, trustedNow() - savedAt) : null;
    if (branchAwayTrade) this.state = branchAwayTrade.state;
    // Всё заработанное без игрока — не сразу в кассу, а в сундучок выручки (returns.ts): утром его
    // открывают касанием. Не открыл — копится дальше.
    if (away || branchAwayTrade) {
      this.state = stashAway(this.state, {
        cashier: away?.revenue ?? 0,
        branch: branchAwayTrade?.income ?? 0,
        hours: Math.max(away?.hours ?? 0, branchAwayTrade?.hours ?? 0),
        units: away?.units ?? 0,
      });
      saveGame(this.state);
    }
    // Вернулся через день (или позже) — для сводки удержания по событиям (docs/ONBOARDING.md).
    if (save) {
      const seen = noteSeen(this.state, todayLocal());
      this.state = seen.state;
      if (seen.gap === 1) track('returned_d1', this.state.day);
      if (seen.gap !== null && seen.gap > 0) track('returned', this.state.day, seen.gap);
    }
    // Игра открылась — прогресс и накопленные события на сервер (рейтинг и аналитика).
    void reportProgress(this.state);
    // Своё расписание особых дней: зерно появляется у новой игры и у старых сохранений при первом запуске.
    if (!this.state.seed) this.state = { ...this.state, seed: 1 + Math.floor(Math.random() * 1e9) };
    setBigDaySeed(this.state.seed!);
    // Покупки за звёзды — по данным Telegram: вернутся и на новом телефоне.
    void restorePurchases().then((ids) => {
      // Наборы за звёзды (новогодний) раскрываются в свои вещи.
      const owned = decorFromPurchases(ids ?? []);
      // Поддержка автора (support.ts): табличка и кот, ступень — для меню «Поддержать автора».
      const next = grantSupport(grantPass(grantDecor(this.state, owned, !save), ids ?? []), ids ?? [], !save);
      if (next === this.state) return;
      this.state = next;
      saveGame(next);
      if (!save) this.buildWorld();
    });
    // Игрок на месте — бот не будет напоминать. Пришёл по приглашению друга — подарок новичку.
    // Календарь праздников с сервера (game/live.ts): пришёл другой — переукрасить улицу, пока магазин закрыт.
    const lookBefore = liveLook(liveEvents(), todayLocal());
    void loadLiveEvents().then((events) => {
      if (!this.running && this.sys.isActive() && liveLook(events, todayLocal()) !== lookBefore) this.buildWorld();
    });
    void socialPing(getLang(), comebackHooks(this.state)).then((info) => {
      // Торговая неделя и гильдия: магазин друга появится на улице, если соперник есть.
      void loadMultiplayer().then(() => {
        if (!this.running && (this.rivalAcross || this.builtEduard === 'vacant') && duelInfo()?.rival?.name !== this.builtFriend) this.buildWorld();
      });
      // Открыли по ссылке «Помоги!» друга — подмога уходит сама; друзья откликнулись на нашу — забрать.
      void this.sendFriendHelp();
      if (info?.helped) void this.takeFriendHelp();
      if (!info?.welcome) return;
      this.state = { ...this.state, money: this.state.money + WELCOME_GIFT };
      saveGame(this.state);
      this.hud.update(this.state, this.timeLeft);
      toast('assets/ico_gift.png', t('social.welcome'), t('social.welcomeText', { n: WELCOME_GIFT }));
    });
    this.hud = new Hud();
    this.hud.onSpeed = () => this.running && this.setSpeed(this.speed > 1 ? 1 : 2);
    this.hud.onUrgent = () => this.openUrgent();
    this.hud.onHelp = () => void this.callForHelp();
    // Карточка звонка и плашка доставки живут в DOM — уходят вместе со сценой.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.deliveryUi.destroy());

    this.light = new LightMap(this, this.gfx);
    this.grade = new ColorGrade(this, this.gfx);
    // Карта освещения — после всех дел кадра: фары уже доехали, лампы уже мигнули.
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, () => {
      this.light.update(this.time.now);
      this.grade.update();
    });
    this.buildWorld();
    this.hud.update(this.state, this.timeLeft);
    this.setupCameraDrag();
    this.setupStreetTap();
    // Свернули Telegram — телефон мог отобрать у WebGL контекст; когда он вернётся, Phaser сам
    // восстановит текстуры и шейдеры, а нарисованное в RenderTexture дорисуем мы.
    if (this.game.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) this.game.renderer.on(Phaser.Renderer.Events.RESTORE_WEBGL, () => lighting.rebake(this));
    // Улица живёт своей жизнью: прохожие и машины.
    this.time.addEvent({ delay: 1800, loop: true, callback: () => this.streetLife() });
    // Над кварталом плывут тени облаков, иногда пролетает стайка птиц.
    this.time.addEvent({ delay: 6000, loop: true, callback: () => this.skyLife() });
    // Потёртость пола: кто где идёт по залу — по таймеру времени игры, а не каждый кадр.
    this.time.addEvent({ delay: WEAR_SAMPLE_MS, loop: true, callback: () => this.running && this.sampleSteps() });
    // Живая очередь и продавец без дела: кто-то вздыхает, смотрит на часы, продавец протирает прилавок.
    this.time.addEvent({ delay: 1300, loop: true, callback: () => this.running && this.queueIdle() });
    this.time.addEvent({ delay: 4200, loop: true, callback: () => this.running && this.sellerIdle() });
    // Пока пахнет свежей выпечкой, из пекарни в зал тянутся волны запаха.
    this.time.addEvent({ delay: 650, loop: true, callback: () => this.running && this.time.now < this.aromaUntil && effects.aromaWisp(this) });
    // Достижения проверяются и посреди дня: серия, сотый покупатель — сразу всплывашка.
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.running && this.checkAchievements(true) });
    // Сначала вывеска, потом утро. Первая встреча с сюжетом (письмо бабушки) — на утреннем экране.
    // Музыка заиграет с первым касанием: на титуле — тема «Магазинчика».
    this.winterTune = decorations.isWinterMusic(this);
    this.newYearSound = decorations.isNewYearSound(this);
    music.start();
    const stopShow = this.titleShow();
    const titleAt = performance.now();
    showTitle({
      save,
      onPlay: () => {
        this.onTitle = false;
        stopShow();
        this.playAt = performance.now();
        // Сколько секунд новичок смотрел на вывеску до «Играть».
        if (!save) track('onb_play', 1, (this.playAt - titleAt) / 1000);
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
    // На ×2 событий вдвое больше — звуков мира за секунду столько же, сколько на ×1 (mix.ts, SoundBudget).
    sound.pace(speed);
  }

  private titleShow(): () => void {
    const cam = this.cameras.main;
    this.updateLighting(0.88);
    // Чуть дальше обычного кадра, если ровный (или хотя бы целый) масштаб это позволяет; нет — обычный кадр.
    cam.setZoom(crispZoom(this.baseZoom * 0.8, ART, 0, this.baseZoom) || this.baseZoom).centerOn(this.layout.door.x - 110, this.next.h - 20);
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
    ambience.update(this.rainStopped ? 'clear' : this.weather, this.evening, this.running, yearTime(this.state.day), decorations.ambienceLife(this));
    weatherFx.updateRain(this);
    weatherFx.windTick(this, deltaMs);
    this.hud.showSpeed(this.running && this.state.day > TUTORIAL_DAYS, this.speed);
    this.hud.showUrgent(this.running && !this.night && this.state.day > TUTORIAL_DAYS);
    this.hud.showHelp(this.running && !this.night && this.time.now < this.helpUntil && this.canCallForHelp(), this.helpBusy);
    music.setMood(decorations.musicMood(this), this.winterTune);
    // Дверь двигается только в рабочие часы: день кончился — стекло снова закрывает улицу.
    if (!this.running) {
      // День стоит (итоги, ночь, окно) — подсветка зала гаснет; утро и итоги показывают свою.
      this.hallCoachOff();
      // Мухи над неубранным не замирают и между сменами.
      this.rotting.tick(this.time.now);
      ambience.door(0);
      return;
    }
    const dt = (deltaMs / 1000) * this.speed;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    this.playTime += dt;

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
      // Уценённое — на полку «Уценка», пока есть место.
      this.sendToBargain();
    }
    // Автозаказ: товар разобрали, а на складе пусто — сам вызывает фургон (autoorder.ts).
    this.autoCheck -= dt;
    if (!this.night && this.autoCheck <= 0) {
      this.autoCheck = AUTO_CHECK_SECONDS;
      this.autoTopUpIfNeeded();
    }
    const rushAt = this.state.plan?.rushAt;
    const rush = !this.night && rushAt !== undefined && elapsed >= rushAt && elapsed < rushAt + RUSH_SECONDS;
    if (rush && !this.rushAnnounced) {
      this.rushAnnounced = true;
      haptic.tap();
      sound.bell(this.layout.door.x);
      this.popup(this.layout.door.x, this.layout.door.y - 30, t('popup.rush'), '#fff3b0');
    }
    // Час пик или очередь до двери — можно позвать друзей на помощь (кнопка держится ещё пару секунд).
    if (!this.night && (rush || this.queue.length >= HELP_QUEUE)) this.helpUntil = this.time.now + HELP_HOLD;
    if (!this.night && this.inspector === 'pending' && elapsed >= INSPECTOR_AT) void this.runInspector();
    if (!this.night && this.jury === 'pending' && elapsed >= JURY_AT) void this.runJury();
    if (!this.night && this.sonya === 'pending' && elapsed >= SONYA_AT) void this.runSonya();
    if (!this.night && this.liveGuest?.phase === 'pending' && elapsed >= LIVE_GUEST_AT) void this.runLiveGuest();
    if (!this.night) this.moments.tick(elapsed, deltaMs);

    if (this.timeLeft > 0) {
      this.nextSpawn -= dt;
      const maxCustomers = storeLevel(this.state).maxCustomers + (rush ? 3 : 0) + (isCrowdDay(this.state.day) && !this.night ? CROWD_EXTRA_GUESTS : 0);
      if (this.nextSpawn <= 0 && this.customers.size < maxCustomers && !this.siege) {
        // Очередной покупатель иногда приезжает на машине: сначала паркуется, потом идёт в магазин.
        // Этого гостя позвал к себе конкурент (game/rival.ts) — он не придёт.
        if (this.rivalLost > 0 && !this.night) this.rivalLost--;
        else if (!this.carCustomer()) this.spawnCustomer();
        const interval =
          spawnIntervalToday(this.state) / (rush ? 2 : 1) / (this.night ? NIGHT_GUESTS * bigDayNightGuests(this.state.day) * (this.busker ? BUSKER_GUESTS : 1) : 1);
        this.nextSpawn = interval * Phaser.Math.FloatBetween(0.7, 1.3);
      }
    } else if (this.customers.size === 0 && this.inspector !== 'here' && this.jury !== 'here' && this.sonya !== 'here' && this.liveGuest?.phase !== 'here') {
      this.endOfDay();
    }

    for (const c of this.queue) this.updateBubble(c);
    for (const r of this.registers) if (r.customer) this.updateBubble(r.customer);
    this.checkSlips();
    this.updateRot(dt);
    this.updateScanBar();
    this.callSellerIfNeeded();
    // Пока говорит бабушка (облачком или у подсветки обучения), та же подсказка снизу не повторяется.
    const raw = this.currentHint();
    // Та же подсказка, что у подсветки обучения (касса, полка), снизу не повторяется; другие (вор, мусор) — да.
    const coached = this.hallCoach && this.coach.pointing && (raw === t('hint.serve') || raw === t('hint.restock'));
    let hint = this.say.visible || coached ? '' : raw || this.nudgeHint();
    // Одна подсказка в одном месте: пока о кассе и полках говорят бабушка или подсветка обучения,
    // снизу о том же молчим (firstday.ts).
    if ((grannyStays(this.state) || (this.hallCoach && this.coach.active)) && (hint === t('hint.serve') || hint === t('hint.restock'))) hint = '';
    this.hud.setHint(hint, this.state.day <= TUTORIAL_DAYS || this.nudgeUntil > this.time.now);
    if (this.goalFor !== this.state) {
      this.goalFor = this.state;
      this.hud.setGoal(mainGoal(this.state));
    }
    this.updateTutorialArrow();
    if (this.state.onboarding && this.state.day === 1) this.onboardingTick();
    this.tutorialTick(deltaMs);
    this.updateLighting(this.night ? 1 : undefined);
    motion.updateDoor(this);
    motion.pulseHighlights(this);
    motion.animatePeople(this);
    this.updateOven();
    pets.petCatNearby(this);
    effects.cheerProgress(this);
    this.updateDelivery();
    this.hud.update(this.state, this.timeLeft, this.questsLine(), this.night);
  }

  /** «🎯 1/3» рядом с целью дня: сколько заданий дня уже выполнено (по нажатию — список, ui/today.ts). */
  private questsLine(): string {
    const quests = this.state.plan?.quests ?? [];
    if (!quests.length) return '';
    const done = quests.filter((q) => q.paid || questDone(q, this.stats)).length;
    // Выполнено — награда сразу (вечером второй раз не платим: endless.ts payQuests). Только в идущий день
    // и по его же плану: статистика вчерашнего дня сегодняшние задания не закрывает.
    const pay = this.running && this.state.plan?.day === this.state.day ? payQuests(this.state, this.stats) : { state: this.state, paid: [] };
    if (pay.paid.length) {
      this.state = pay.state;
      const { sellerHome } = this.layout;
      const n = pay.paid.reduce((sum, q) => sum + q.reward, 0);
      this.time.delayedCall(700, () => this.popup(sellerHome.x - 20, sellerHome.y - 30, t('popup.questPaid', { n }), '#c8ffb0'));
      effects.flyCoins(this, sellerHome.x - 20, sellerHome.y - 30, Math.min(6, 2 + pay.paid.length * 2));
      haptic.success();
    }
    if (done > this.questsSeen) {
      this.questsSeen = done;
      sound.good();
      const { sellerHome } = this.layout;
      this.popup(sellerHome.x - 20, sellerHome.y - 46, t('popup.questDone', { done, total: quests.length }), '#fee761');
    }
    // Список для HUD — только когда прогресс сдвинулся (questsLine зовётся каждый кадр).
    const key = `${this.state.day}|${quests.map((q) => `${q.paid ? 'p' : ''}${questProgress(q, this.stats)}`).join()}`;
    if (key !== this.questRowsKey) {
      this.questRowsKey = key;
      this.hud.setQuests(questRows(quests, this.stats));
    }
    return t('quest.chip', { done, total: quests.length });
  }

  private currentHint(): string {
    if (this.liveEvent) return t(`hint.${this.liveEvent}` as TextKey);
    if (this.moments.showing) return t('hint.moment');
    if (this.oven?.state === 'ready') return t('hint.ovenReady');
    // Первый звонок с карточкой — подсказка подробнее: куда нажать (и тем, у кого доставка была и раньше).
    if (this.call) return t((this.state.seenTips ?? []).includes(CALL_CARD_TIP) ? 'hint.order' : 'hint.orderFirst');
    if (!this.staffPacks() && !this.packRequested && this.parcels.some((p) => p.stage === 'wait')) return t('hint.orderPack');
    if (this.inspector === 'here') return t('hint.inspector');
    if (!this.workers.has('guard') && [...this.customers].some((c) => c.thief && !c.gone)) return t('hint.thief');
    if (this.sellerBusy && this.ownerRegister()) return t('hint.recall');
    if (this.ownerRegister() && this.state.day <= 2 && this.stats.served < 3) return t('hint.serve');
    // Очередь растёт — подсказать, что поможет. За первой кассой и так хозяин: кассир за свободную
    // кассу, ещё одна касса или помещение, где под неё есть место.
    if (this.queue.length >= 4 && this.state.day > TUTORIAL_DAYS) {
      if (idleRegisters(this.state) > 0) return t('hint.queueHire');
      if (nextRegisterPrice(this.state) !== null) return t('hint.queueBuy');
      if ((nextRegisterCount(this.state) ?? 0) > registerSlots(this.state)) return t('hint.queueRegister');
    }
    if (this.state.day <= 4 && this.shelfNeedsRestock()) return t('hint.restock');
    if (!this.state.seenTips?.includes(ROT_TIP) && [...this.trash].some((piece) => piece.getData('rot')))
      return t(this.state.staff.some((m) => m.role === 'cleaner') ? 'hint.rot' : 'hint.rotSolo');
    if (this.binFull() && !this.binBusy) return t('hint.bin');
    if ((this.trash.size > 0 || this.toiletDirt >= TOILET_DIRTY) && this.state.day <= 4) return t('hint.clean');
    return '';
  }

  /**
   * Игрок застыл на NUDGE_IDLE_MS, а в зале ждёт дело: покупатель у кассы хозяина или пустая полка при
   * товаре на складе. Одна строка снизу и стрелка на несколько секунд; каждая — раз в день, всего не
   * больше трёх в день и только в первые две недели (game/nudge.ts). Касание экрана — гаснет.
   */
  private nudgeHint(): string {
    const now = this.time.now;
    if (!this.running || this.night || !this.dayOpen) {
      this.lastTouch = now;
      this.nudge = null;
      return '';
    }
    if (this.nudge && this.nudgeUntil > now) return t(this.nudge === 'serve' ? 'hint.serve' : 'hint.restock');
    this.nudge = null;
    if (now - this.lastTouch < NUDGE_IDLE_MS) return '';
    const kind = hallNudge({ waiting: Boolean(this.ownerRegister()) && !this.sellerBusy, emptyShelf: this.shelfNeedsRestock() });
    if (!kind || !tryNudge(this.state.day, kind, now - this.lastTouch)) return '';
    this.nudge = kind;
    this.nudgeUntil = now + NUDGE_SHOW_MS;
    return t(kind === 'serve' ? 'hint.serve' : 'hint.restock');
  }

  /**
   * Обучение первых дней: над тем, что нужно нажать сейчас, прыгает стрелка —
   * касса, пустая полка, мусор или грязный туалет, вор.
   */
  private updateTutorialArrow(): void {
    const target = this.state.day <= TUTORIAL_DAYS || this.inspector === 'here' || this.nudgeUntil > this.time.now ? this.tutorialTarget() : null;
    // Ту же цель бабушкино обучение показывает своей стрелкой (ui/coach.ts) — вторая не нужна.
    const own = this.hallCoach && this.coach.pointing && this.tutTracked ? this.tutWorldSpot(this.tutTracked) : null;
    if (!target || (own && Math.abs(own.x - target.x) < 24 && Math.abs(own.y - target.y) < 40)) {
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
    if (waitingAt && (this.sellerBusy || this.stats.served < 3 || this.nudge === 'serve')) return { x: waitingAt.counter.x, y: waitingAt.counter.y - 28 };
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

  /**
   * Разметка свободного места под полку. Новичку первой недели — только когда на новую полку хватает
   * денег: до этого пустое место в киоске — просто пол.
   */
  private slotShown(): boolean {
    if (!cleanHall(this.state)) return true;
    const kind = dreamShelf(this.state);
    return Boolean(kind && this.state.money >= SHELF_KINDS[kind].price);
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

  /** Во сколько раз холст плотнее базовых 720 точек по ширине: от этого — размеры на холсте под интерфейсом. */
  get res(): number {
    return this.scale.width / BASE_W;
  }

  /**
   * Плотность надписи в мире: n — пикселей её текстуры на точку мира при обычном масштабе 4 (так их
   * и подбирали). Камера в покое стоит на ровном масштабе — надпись рисуется под него: на крупном кадре
   * (6) точка текстуры не растягивается в полтора пикселя, и буквы не выходят ступеньками разной ширины.
   */
  textRes(n: number): number {
    return Math.max(1, Math.round((n * this.baseZoom) / 4));
  }

  /**
   * Обычный кадр — масштаб и середина (baseZoom, home) под нынешний холст: при постройке зала и когда
   * холст меняется (полный экран Telegram, поворот планшета).
   * Внизу кадра видна улица: тротуар и дорога с машинами. Камера показывает весь магазин: по ширине —
   * от наружной стены флигеля до правой стены зала, по высоте — от вывески до фасада; участок под
   * расширение и улицу видно краем, а весь квартал — свайпом или отдалив двумя пальцами.
   */
  private frameCamera(): void {
    const { width, height } = this.scale;
    const top = HUD_TOP * this.res;
    const bottom = HUD_BOTTOM * this.res;
    const { h } = this.layout;
    // В кадре целиком и флигель слева (склад, пекарня, кофейня, кухня — с табличками), и правая стена зала:
    // на узком телефоне камера раньше подходила ближе ради ровного масштаба, и флигель уходил за край.
    // Масштаб ровный (пиксель рисунка — целое число пикселей экрана), но не крупнее «впритык» и не намного
    // мельче; иначе дробный — весь магазин в кадре важнее ровных пикселей (scenes/pixels.ts).
    const span = buildingSpan(this.layout);
    const { zoom, x } = homeFrame(width, height - top - bottom, { left: span.left - FRAME_PAD, right: span.right + FRAME_PAD }, h + 40, ART);
    const midY = top + (height - top - bottom) / 2;
    this.baseZoom = zoom;
    // Если по высоте есть запас, вывеска прижимается под верхнюю панель — снизу видно больше улицы.
    const centered = (h + 4) / 2 + (height / 2 - midY) / zoom;
    const signUnderHud = SIGN_TOP + (height / 2 - top) / zoom;
    // Середина — на целой точке мира: камера в покое не сдвинута на полпикселя рисунка.
    this.home = { x, y: Math.round(Math.max(centered, signUnderHud)) };
  }

  /**
   * Строит зал под текущий уровень помещения. При расширении зал строится заново.
   * bought — перестроили из-за покупки оборудования или украшения: новое утром распакуют из коробки.
   */
  buildWorld(bought = false): void {
    this.disposeWorld();
    this.choreId++;
    this.sellerBusy = false;
    // Кто ждал кофе — уже не дождётся: отпускаем, чтобы никто не застрял.
    for (const o of this.coffeeOrders.splice(0)) o.done();
    this.coffeeCounter = false;
    this.carryingTrash = false;
    this.urgentVanBusy = false;
    this.shelfViews = [];
    this.propList = [];
    this.propDefaults = {};
    this.boxes = [];
    this.slotDecor = [];
    this.shutters = [];
    this.clockHands = undefined;
    this.neonDecorX = undefined;
    this.nightLights = [];
    this.lamps = [];
    this.shelfStrips = [];
    this.trash.clear();
    // Пыль и мокрый блеск старого зала уничтожены вместе с ним (disposeWorld) — забываем.
    this.footDust.clear();
    this.wetSheens.clear();
    // Своя расстановка мест под полки (placement.ts) — если игрок переставлял в этом помещении.
    this.layout = savedLayout(this.state);
    this.builtLevel = this.state.level;

    // Камера показывает и соседнюю площадь, куда магазин вырастет: ларёк выглядит маленьким.
    // Гипермаркет — не пристройка, а здание «Гиганта» за дорогой: участка «Сдаётся» рядом нет.
    const next = STORE_LEVELS[this.state.level + 1] && this.state.level + 1 < HYPER_LEVEL ? layoutFor(this.state.level + 1) : this.layout;
    this.next = next;
    this.frameCamera();
    this.cameras.main.setZoom(this.baseZoom).centerOn(this.home.x, this.home.y);
    // Цветокоррекция часа и погоды — один проход по экрану (в лёгкой графике — без него), виньетка — картинкой.
    this.grade.attach(LIGHT_DEPTH + 30);
    // Карта освещения — до всего остального: улица, зал и погода сразу вписывают в неё свои огни.
    lighting.resetLight(this, next);
    this.buildStreet(next);
    this.buildCritters(next);
    this.buildNeighbors(next);
    if (next !== this.layout) this.buildForRent(next);

    this.buildStore();
    lighting.buildLighting(this, next);
    lighting.buildDust(this);
    this.applyAds();
    this.refreshShelves();
    this.refreshWarehouse();
    this.refreshToilet();
    this.workers.clear();
    this.syncStaff();
    weatherFx.applyWeather(this);
    this.fairObjs = [];
    decorations.applyFair(this);
    this.noteNewProps(bought);
    // Пол — последним: тени ложатся от всей мебели, что уже стоит в зале и во флигеле.
    this.loadWear();
    this.bakeFloor();
  }

  /** Потёртость пола этого зала — из сохранения; шаги сегодняшнего дня остаются, если сетка та же. */
  private loadWear(): void {
    const { w, h, wallH } = this.layout;
    const grid = wearGrid(w, h - wallH);
    const level = this.state.level;
    const was = this.wear;
    const same = was && was.level === level && was.grid.cols === grid.cols && was.grid.rows === grid.rows;
    this.wear = { level, grid, cells: decodeWear(this.state.floorWear, level, grid), steps: same ? was.steps : new Float32Array(grid.cols * grid.rows) };
  }

  /** Потёртость для картинки пола: сетка лежит от левого верхнего угла пола зала (под задней стеной). */
  private wearLayer(): WearLayer | null {
    const wear = this.wear;
    return wear ? { cells: wear.cells, cols: wear.grid.cols, rows: wear.grid.rows, x: 0, y: this.layout.wallH } : null;
  }

  /**
   * Живой пол (floor.ts): тени у стен и под мебелью — заново, если мебель переставили (та же расстановка —
   * готовые), и потёртость. Пол — зал, комнаты флигеля (под куском стены с табличкой) и проёмы их дверей;
   * входная дверь — проём наружу: у неё пол не темнеет.
   */
  private bakeFloor(): void {
    const { w, h, wallH, door, wing, warehouse, bakery, coffee, kitchen } = this.layout;
    const top = Math.min(wallH, wing.y);
    const floors: Rect[] = [
      { x: 0, y: wallH, w, h: h - wallH },
      { x: warehouse.x, y: warehouse.y, w: warehouse.w, h: warehouse.h },
      ...[bakery, coffee, ...(kitchen ? [kitchen] : [])].map((r) => ({ x: r.x, y: r.y + 14, w: r.w, h: r.h - 14 })),
      ...this.openRooms().map((r) => ({ x: -WALL, y: r.doorway.y - 8, w: WALL, h: 16 })),
    ];
    const plan = {
      area: { x: -WING_OUTER, y: top, w: w + WING_OUTER, h: h - top },
      floors,
      openings: [{ x: door.x - 14, y: h, w: 28, h: 12 }],
      casters: furnitureCasters(this.children.list),
    };
    this.floor.bake(plan, this.lite ? 1 : ART, FLOOR_SHADE_DEPTH, this.wearLayer());
  }

  /**
   * Запечь пол чуть позже — одним разом после последней из нескольких распакованных новинок. Каждое
   * запекание — заметная пауза на слабом телефоне, а новинки встают одна за другой через UNBOX_STEP.
   */
  private bakeFloorSoon(): void {
    this.floorBakeTimer?.remove();
    this.floorBakeTimer = this.time.delayedCall(500, () => {
      this.floorBakeTimer = undefined;
      if (this.floor.ready() && !this.arranging) this.bakeFloor();
    });
  }

  /**
   * Старый мир — в утиль целиком. Раньше children.removeAll(true) только снимал объекты со сцены:
   * они оставались в списках касаний и обновления, надписи и плитки — со своими холстами и текстурами.
   * С каждой перестройкой магазин тяжелел (на среднем уровне — ~20 МБ за раз), а невидимые старые
   * полки и зоны продолжали ловить нажатия. Теперь всё уничтожается, а дела старого мира — ожидания
   * (wait), шаги (walk) и повторы вещей (worldTimer) — на этом обрываются. Таймеры, которые ещё держат
   * старые картинки, проверяют active: у уничтоженного он false.
   */
  private disposeWorld(): void {
    this.worldGen++;
    this.moments.clear();
    // killAll не вызывает onStop: незаконченный шаг продавца никогда не завершится, и он
    // навсегда остался бы «занят» (не убирал бы мусор и не носил товар). Начинаем его дела заново.
    this.tweens.killAll();
    for (const timer of this.worldTimers.splice(0)) timer.remove();
    this.stopMop();
    this.dropVisitors();
    for (const obj of [...this.children.list]) obj.destroy();
    this.rotting.clear();
    // Снятое со сцены, но живое (в списке обновления) — тоже: иначе обновлялось бы невидимкой вечно.
    for (const obj of [...this.sys.updateList.getActive()]) if (!obj.displayList && !obj.parentContainer) obj.destroy();
    this.people.clear();
    this.popups = [];
    this.cullDirty = true;
  }

  /**
   * Зал перестроили посреди дня: покупатели старого зала уходят вместе с ним (их дела оборваны —
   * иначе день вечно ждал бы, пока они выйдут), инспектор, жюри и Соня заходят заново, а утренний
   * грузовик считается разгруженным — его коробки уже на складе.
   */
  private dropVisitors(): void {
    for (const c of this.customers) {
      // Ещё не заплатил — взятое возвращается на полки, как у ушедшего из очереди (заплативший уже уходит: gone).
      if (!c.gone) {
        this.state = returnToShelf(this.state, c.items);
        this.returnExtras(c);
      }
      c.gone = true;
      c.patience?.remove();
    }
    this.customers.clear();
    this.queue = [];
    // Инспектор, уже выписавший итог проверки, второй раз не приходит.
    if (this.inspector === 'here') this.inspector = this.inspection ? 'done' : 'pending';
    if (this.jury === 'here') this.jury = 'pending';
    if (this.sonya === 'here') this.sonya = 'pending';
    if (this.running) this.awaitingBoxes = 0;
  }

  /**
   * Повтор у вещи мира (экран на фасаде, лампочки вывески, взмахи голубя): при перестройке останавливается
   * вместе с ней. Возвращает «остановить раньше»: снимает повтор и вычёркивает его из списка — иначе
   * отработавшие взмахи голубей и пыль дворника копились бы там до перестройки (а она бывает редко).
   */
  worldTimer(delay: number, callback: () => void): () => void {
    const timer = this.time.addEvent({ delay, loop: true, callback });
    this.worldTimers.push(timer);
    return () => {
      timer.remove();
      Phaser.Utils.Array.Remove(this.worldTimers, timer);
    };
  }

  private buildStore(): void {
    const { w, h, wallH, wc, counter, sellerHome } = this.layout;
    // Пол богаче с каждым уровнем: тёплая плитка, прохладная плитка, мрамор.
    // Пол и цвет стен можно сменить в «Оформлении».
    const floor = activeDecor(this.state, 'floor')?.texture ?? FLOORS[Math.min(this.state.level, FLOORS.length - 1)];
    this.add.tileSprite(0, wallH, w, h - wallH, floor).setOrigin(0).setTileScale(1 / ART);
    this.glossyFloor = ['floor3', 'floor_gold', 'floor_noir'].includes(floor);
    this.coldAir = yearTime(this.state.day) === 'winter' || weatherFor(this.state.day) === 'snow';
    lighting.floorLight(this, w, h, wallH);
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
    // У гипермаркета своя вывеска — вдвое шире, буквы крупнее (премиальная доска из «Оформления» — главнее).
    const grand = !sign && this.state.level >= HYPER_LEVEL;
    const signFont = grand ? '9px' : '7px';
    this.art(w / 2, -9, sign?.texture ?? (grand ? 'sign_hyper' : 'sign')).setDepth(2);
    if (sign?.id === 'sign_marquee') {
      // Лампочки «Бродвея» перемигиваются.
      const lit = this.art(w / 2, -9, 'sign_marquee_lit').setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: lit, alpha: { from: 1, to: 0.25 }, duration: 520, yoyo: true, repeat: -1, ease: 'Stepped' });
    }
    if (sign?.id === 'sign_s2' && !this.lite) {
      // «Северное сияние» медленно дышит.
      const lit = this.art(w / 2, -9, 'sign_s2_lit').setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: lit, alpha: { from: 0.9, to: 0.2 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.add
      .text(w / 2, -9, this.shopTitle(), {
        fontFamily: UI_FONT,
        fontSize: signFont,
        color: `#${signColor.toString(16).padStart(6, '0')}`,
      })
      .setOrigin(0.5)
      .setResolution(this.textRes(4))
      .setDepth(3);
    lighting.neonSign(this, w / 2, -9, this.shopTitle(), signFont, signColor, grand ? 92 : 64, true);
    if (!sign) this.signLights(w / 2, -9, grand ? 46 : 30);
    this.buildWing();
    this.buildWarehouse();
    decorations.buildDecor(this);

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
    const registerImg = this.art(counter.x, counter.y + FURNITURE_TOP / 2, registerSprite(this.state)).setDepth(counter.y + 20);
    this.buildShowcases();
    this.buildBin();
    this.buildBargain();
    this.buildFood();
    // Электрощиток на стене: нужен, когда отключат свет. Перестановка не даёт закрыть его полкой
    // (placement.ts), а если в старом сохранении полка уже стоит там — щиток висит левее, на открытой стене.
    const fuseX = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => wc.x - 24 - k * 12).find((x) => x > 10 && !this.behindShelf(x, 6)) ?? wc.x - 24;
    this.fuseBox = this.art(fuseX, 18, 'fusebox').setDepth(3);
    this.fuseBox.setInteractive({ useHandCursor: true }).on('pointerup', () => this.tap(() => this.fixFuse()));
    this.fuseGlow = new Halo(this, this.fuseBox, 0xfee761);
    // Свет отключили — у щитка мигает аварийная лампочка: в тёмном зале видно, куда нажать. Мигает
    // ступеньками (ярко — тускло), а не плавно: карту перерисовывать дважды за мигание, а не каждый кадр.
    const fuse = this.fuseBox;
    const emergency = this.light.add('light_pool', fuse.x, fuse.y + 6, 34, 30, 0xffe08a, 0).attach(fuse);
    emergency.sync = () => emergency.set(this.blackout ? (Math.floor(this.time.now / 400) % 2 ? 0.8 : 0.35) : 0);
    this.registers = [];
    this.registers.push({ ...this.makeRegister(counter, false, this.layout.queue, this.layout.sellerHome), img: registerImg });
    decorations.buildUpgrades(this);
    void sellerHome;
    const home = this.ownerHome();
    this.seller = this.makePerson(home.x, home.y, ownerLook(this.state));
    // Кибер-продавец светится неоном.
    if (activeDecor(this.state, 'outfit')?.id === 'outfit_cyber') personGlow(this, this.seller, 0x2ce8f5, 2);
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
    // Экран кассы светит зеленоватым на прилавок и кассира: тлеет всегда, ярче — пока пробивает. Ровно, не по
    // мерцанию экрана (оно 7 раз в секунду, при заедании — каждый кадр): карту ради него не перерисовывать.
    const till = this.light.add('glow', sx, counter.y + 9, 22, 16, 0xb6f58a).attach(screen);
    till.sync = () => till.set(lighting.powerOn(this) * (screen.visible ? 0.5 : 0.2));
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
      hurry: 0,
    };
  }

  /**
   * Кто работает за кассой. Первая — хозяина, но если нанят сменщик и он вышел на смену, за ней весь
   * день он (новенький — с той минуты, как дошёл до кассы, reliefLoop). За остальными — их кассиры, а без кассира касса закрыта (null).
   */
  private operator(index: number): Worker | 'owner' | null {
    if (index === 0) {
      const relief = this.workers.get(RELIEF_ROLE);
      return relief && relief.member.role === RELIEF_ROLE && this.reliefReady ? relief : 'owner';
    }
    const role = tillRole(index);
    return (role && this.workers.get(role)) || null;
  }

  /**
   * Касса номер index (с 1): нечётные — зеркально слева от очереди, чётные — справа;
   * каждая следующая пара — выше по залу. Покупатель встаёт в колонку очереди рядом со столом.
   */
  buildRegister(index: number): void {
    const { queue } = this.layout;
    const { left, ...at } = registerSpot(this.layout, index);
    const row = Math.floor(index / 2);
    const shadowX = left ? at.x - 2 : at.x + 2;
    this.art(shadowX, at.y + 3, 'shadow_wide').setScale(0.62, 0.7).setAngle(90).setDepth(at.y + 19);
    const img = this.art(at.x, at.y + FURNITURE_TOP / 2, registerSprite(this.state)).setFlipX(left).setDepth(at.y + 20);
    if (hasUpgrade(this.state, 'terminal')) this.art(at.x + (left ? -3 : 3), at.y - 4, 'card_terminal').setDepth(at.y + 22);
    this.obstacles.push({ x: at.x - 13, y: at.y - 30, w: 26, h: 54 });
    const spot = { x: queue.x, y: queue.y - REGISTER_ROW * row - (left ? queue.step : 0) };
    const clerk = { x: at.x + (left ? -16 : 16), y: at.y + 16 };
    this.registers.push({ ...this.makeRegister(at, left, spot, clerk), img });
    this.add
      .zone(at.x + (left ? -6 : 6), at.y + 6, 40, 64)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.tap(() => this.serveNext(index)));
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

  /** Название на вывеске: своё, если игрок назвал магазин, иначе — по помещению. */
  private shopTitle(): string {
    return this.state.shopName?.trim() || t(storeLevel(this.state).nameKey);
  }

  /**
   * В гостях у друга: на экране его магазин по снимку с сервера (только смотреть). Свой магазин
   * не сохраняется, пока мы в гостях; «Домой» — вернуть свой и утро.
   */
  private async visitFriend(id: number, name: string): Promise<void> {
    const res = await fetchFriendShop(id);
    const home = this.state;
    const guest = res && friendState(res.shop, home);
    if (!guest) {
      toast('assets/ico_cross.png', t('visitShop.title'), t('visitShop.none', { name }));
      this.showMorning();
      return;
    }
    pauseSaving(true);
    this.state = guest;
    this.buildWorld();
    track('visit_shop', home.day);
    const bar = el('div', 'ui-arrange');
    const shop = guest.shopName?.trim() || t(storeLevel(guest).nameKey);
    // Подарок другу (ui/presents.ts): один в день, кнопка гаснет, когда подарен.
    const gift = presentsOn()
      ? button(presentGiven(id) ? t('social.give.done') : t('social.give.btn'), () => {
          // Полоса внизу не перекрывает окно подарка.
          bar.style.visibility = 'hidden';
          showGiftPicker({ id, name: res!.name || name }, home.day, home.level, (ok) => {
            bar.style.visibility = '';
            if (!ok) return;
            gift!.textContent = t('social.give.done');
            gift!.disabled = true;
          });
        }, 'ui-btn secondary', presentGiven(id))
      : null;
    bar.append(
      el('div', 'ui-arrange-hint', t('visitShop.bar', { name: res!.name || name, shop, rating: guest.rating.toFixed(1), day: guest.day })),
      ...(gift ? [gift] : []),
      button(`🏠 ${t('visitShop.home')}`, () => {
        bar.remove();
        this.state = home;
        pauseSaving(false);
        this.buildWorld();
        this.showMorning();
      }, 'ui-btn'),
    );
    document.body.append(bar);
  }

  /**
   * «Заглянуть к конкуренту» (game/rival.ts): чужой магазин по снимку с сервера (ключ из рейтинга)
   * или босс через дорогу (key — null, сервер не нужен). По залу бродят покупатели; внизу — проделки,
   * их число считает сервер (у босса — мы сами). Награда — в свой магазин; он не сохраняется, пока
   * мы в гостях, «Домой» — вернуть свой и утро.
   */
  private async visitRival(key: string | null, name: string): Promise<void> {
    this.inMorning = false;
    const res = key ? await fetchRivalShop(key) : null;
    // Свой магазин — после ответа сервера: пока ждали, в него могли прийти монеты или новости.
    let home = this.state;
    const look = eduardLook(home);
    const stage = EDUARD_STAGES[eduardStage(home) ?? 0];
    const bossName = look === 'mega' ? t('eduard.mega') : t(stage.nameKey);
    const guest = key ? res && friendState(res.shop, home) : friendState(bossShop(home, bossName, stage.rating || 4.2), home);
    if (!guest) {
      toast('assets/ico_cross.png', t('visitShop.title'), t('rival.none', { name }));
      this.showMorning();
      return;
    }
    pauseSaving(true);
    this.rivalVisit = true;
    this.state = guest;
    this.buildWorld();
    track('visit_rival', home.day);
    const owner = key ? res!.name || name : bossName;
    const browsers: Phaser.GameObjects.Container[] = [];
    // Покупатели бродят от полки к полке; позванный к нам уходит на улицу.
    const wander = this.time.addEvent({
      delay: 2400,
      loop: true,
      callback: () => {
        for (const b of browsers) {
          if (!b.active || b.getData('lured') || b.getData('walking') || Math.random() < 0.5) continue;
          const p = this.rivalSpot();
          void this.walk(b, p.x, p.y, this.customerSpeed() * 0.7);
        }
      },
    });
    for (let i = 0; i < (this.lite ? 2 : 3); i++) {
      const p = this.rivalSpot();
      const b = this.makePerson(p.x, p.y, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), guest.day));
      this.setFacing(b, Math.random() < 0.5 ? 'left' : 'right');
      browsers.push(b);
    }
    let left = key ? res!.left : bossLeft(home);
    const prank = async (kind: PrankKind): Promise<void> => {
      bar.setBusy(true);
      const done = key ? await rivalAct(key, kind) : { ok: bossLeft(home) > 0, left: 0, error: 'limit' };
      bar.setBusy(false);
      // Пока ждали сервер, ушли домой — проделка засчитана: награда сразу в свой магазин.
      if (this.state !== guest) {
        if (done.ok && !savingPaused()) {
          this.state = usePrank(this.state, kind, !key);
          saveGame(this.state);
        }
        return;
      }
      const { sellerHome } = this.layout;
      if (!done.ok) {
        if (done.error !== 'too_often' && done.error !== 'offline') bar.setLeft((left = 0));
        // Неизвестная ошибка (не лимит) — тоже без кнопок, но с понятной надписью.
        if (done.error === 'bad_kind') done.error = 'gone';
        this.popup(sellerHome.x - 20, sellerHome.y - 40, t(`rival.err.${done.error === 'pair' || done.error === 'victim' || done.error === 'too_often' || done.error === 'offline' || done.error === 'gone' ? done.error : 'limit'}`), '#ffd0d0');
        sound.bad();
        return;
      }
      home = usePrank(home, kind, !key);
      left = key ? done.left : bossLeft(home);
      bar.setLeft(left);
      this.hud.update({ ...guest, money: home.money }, DAY_SECONDS);
      this.rivalPrank(kind, browsers);
      this.time.delayedCall(900, () => {
        if (this.state !== guest) return;
        this.popup(sellerHome.x - 20, sellerHome.y - 52, t(kind === 'lure' ? 'rival.reward.guest' : 'rival.reward', { n: PRANK_COINS[kind] }), '#c8ffb0');
        sound.coin();
      });
    };
    const bar = rivalBar(t('rival.bar', { name: owner, rating: guest.rating.toFixed(1) }), left, (kind) => void prank(kind), () => {
      bar.remove();
      wander.remove();
      this.rivalVisit = false;
      this.state = home;
      pauseSaving(false);
      saveGame(this.state);
      this.buildWorld();
      this.showMorning();
    });
  }

  /** Место в чужом зале, куда встать: перед случайной полкой, чуть вразброс. */
  private rivalSpot(): { x: number; y: number } {
    const n = this.state.shelves.length;
    const p = n ? this.standOf(Phaser.Math.Between(0, n - 1)) : { x: this.layout.door.x, y: this.layout.door.y - 20 };
    return { x: p.x + Phaser.Math.Between(-6, 6), y: p.y + Phaser.Math.Between(0, 4) };
  }

  /** Проделка в чужом зале: лужа или мусор на полу (хозяин удивляется), а позванный покупатель уходит к нам. */
  private rivalPrank(kind: PrankKind, browsers: Phaser.GameObjects.Container[]): void {
    if (kind === 'lure') {
      const b = browsers.find((p) => p.active && !p.getData('lured'));
      if (!b) return;
      b.setData('lured', true);
      this.haltWalk(b);
      this.popup(b.x, b.y - 22, t('rival.say.lure'), '#fff3b0');
      this.time.delayedCall(1100, () => {
        if (!b.active) return;
        effects.emote(this, b, 'emo_heart');
        this.popup(b.x, b.y - 34, t('rival.say.yes'), '#c8ffb0');
        void this.strollAway(b);
      });
      return;
    }
    const p = this.rivalSpot();
    const piece = this.dropTrash(p.x, p.y, kind);
    if (piece) {
      // Убирать чужое не наше дело: лужа и мусор только для вида.
      piece.removeAllListeners('pointerup').disableInteractive();
      if (kind === 'spill') {
        piece.setTint(Phaser.Utils.Array.GetRandom(SPILL_TINTS));
        const pack = this.art(piece.x + 9, piece.y - 3, 'spill_pack').setAngle(70).setDepth(0.6);
        piece.once('destroy', () => pack.destroy());
      }
    }
    if (kind === 'spill') sound.bad();
    else sound.pop();
    this.popup(p.x, p.y - 16, t(kind === 'spill' ? 'rival.popup.spill' : 'rival.popup.trash'), '#ffd0d0');
    // Хозяин чужого магазина замечает.
    if (this.seller?.active) {
      effects.emote(this, this.seller, 'emo_question');
      this.popup(this.seller.x, this.seller.y - 30, t('rival.say.owner'), '#ffffff');
    }
  }

  /**
   * Утром — что натворили у нас конкуренты и кто поблагодарил за наш визит (не чаще раза в 10 минут:
   * сервер отдаёт это один раз). Пришло, пока мы в гостях, — покажем, когда вернёмся.
   */
  private async checkRivals(): Promise<void> {
    // Вернулись из гостей — показать то, что пришло, пока гуляли.
    if (this.rivalPending) return void (this.inMorning && !savingPaused() && this.applyRivalInbox());
    const now = Date.now();
    if (now - this.rivalCheckedAt < 10 * 60_000) return;
    this.rivalCheckedAt = now;
    const inbox = await rivalInbox();
    if (!inbox || (!inbox.pranks.length && !inbox.thanks.length)) return;
    this.rivalPending = inbox;
    // Последствия — только к утру этого дня: иначе подождут следующего утра.
    if (this.inMorning && !this.rivalVisit && !savingPaused()) this.applyRivalInbox();
  }

  private applyRivalInbox(): void {
    const inbox = this.rivalPending;
    if (!inbox) return;
    this.rivalPending = null;
    if (inbox.thanks.length) {
      this.state = takeThanks(this.state, inbox.thanks);
      toast('assets/ico_coffee.png', t('rival.thanks.title'), t('rival.thanks', { names: inbox.thanks.slice(0, 3).join(', '), n: THANK_COINS * Math.min(5, inbox.thanks.length) }));
    }
    // Магазин уже открыт — беспорядок подождёт завтрашнего утра.
    const { state, news } = applyPranks(this.state, inbox.pranks, this.dayOpen ? this.state.day + 1 : this.state.day);
    this.state = state;
    saveGame(this.state);
    this.hud.update(this.state, DAY_SECONDS);
    if (!news) return;
    track('rival_news', this.state.day, inbox.pranks.length);
    // Окно — когда закроются другие (гостинец бабушки, сюжет): поверх утра, но не поверх них.
    const show = this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        if (document.querySelector('.ui-dialog') || document.querySelectorAll('.ui-modal').length > 1 || this.rivalVisit || savingPaused()) return;
        show.remove();
        // Ответный визит — только с утра: утреннее окно закрываем.
        const morning = this.inMorning && !this.dayOpen;
        showRivalNews(
          news,
          morning
            ? (key, name) => {
                for (const m of document.querySelectorAll('.ui-modal')) m.remove();
                void this.visitRival(key, name);
              }
            : null,
          thankRival,
        );
      },
    });
  }

  /** Открытие: беспорядок от конкурентов — в зал, увели гостей — столько не придёт, позванные нами — придут. */
  private openRivalDay(): void {
    const mess = messToday(this.state);
    const guests = bonusGuests(this.state);
    this.rivalLost = mess?.lost ?? 0;
    this.state = takeRivalDay(this.state);
    const { door } = this.layout;
    if (mess && mess.spill + mess.trash) {
      for (let i = 0; i < mess.spill + mess.trash; i++) {
        const p = this.rivalSpot();
        const piece = this.dropTrash(p.x, p.y, i < mess.spill ? 'spill' : 'trash');
        if (piece && i < mess.spill) piece.setTint(Phaser.Utils.Array.GetRandom(SPILL_TINTS));
      }
      this.time.delayedCall(2600, () => this.running && this.popup(door.x, door.y - 30, t('rival.mess'), '#ffd0d0'));
    }
    for (let i = 0; i < guests; i++) {
      this.time.delayedCall(6000 + i * 7000, () => {
        if (!this.running || this.night || this.timeLeft <= 0) return;
        this.spawnCustomer();
        this.popup(door.x, door.y - 24, t('rival.guest'), '#c8ffb0');
      });
    }
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
    const level = this.state.level;
    const plain = layoutFor(level);
    const defaults = plain.slots;
    const registers = registerSlots(this.state);
    let at = this.layout.slots.map((p) => ({ ...p }));
    // Касса переезжает целиком вдоль нижней стены: сдвиг от стандартного места.
    let tillDx = this.state.tillPos?.level === level ? this.state.tillPos.dx : 0;
    // Короткая очередь освобождает верх зала у правой стены.
    let shortQueue = this.state.tillPos?.level === level && Boolean(this.state.tillPos.short);
    const placed = () => withTill(plain, { level, dx: tillDx, short: shortQueue }, level);
    // Настоящие полки и разметку прячем — вместо них «призраки»; тени мебели на полу — тоже.
    for (const view of this.shelfViews.splice(0)) this.destroyShelfView(view);
    for (const mark of this.slotDecor) mark?.setVisible(false);
    this.floor.hide();
    const cam = this.cameras.main;
    // Весь зал целиком; масштаб ровный (или хотя бы целый) — чуть дальше, если ровно не влезает.
    const fit = Math.min(this.scale.width / (w + 24), (this.scale.height - (HUD_TOP + 120) * this.res) / (h + 24));
    cam.setZoom(crispZoom(fit, ART, 0, fit) || fit).centerOn(w / 2, h / 2 + 10);
    const grid = this.add.graphics().setDepth(LIGHT_DEPTH + 10);
    grid.lineStyle(0.4, 0x2b2233, 0.18);
    for (let x = 0; x <= w; x += 8) grid.lineBetween(x, this.layout.wallH, x, h);
    for (let y = this.layout.wallH; y <= h; y += 8) grid.lineBetween(0, y, w, y);
    // Где полку не поставить (вход, двери флигеля, щиток) — видно сразу, а не только когда полка краснеет.
    for (const z of blockedZones(this.layout, defaults)) {
      const r = { x: Math.max(0, z.x), y: Math.max(this.layout.wallH, z.y), w: 0, h: 0 };
      r.w = Math.min(w, z.x + z.w) - r.x;
      r.h = Math.min(h, z.y + z.h) - r.y;
      if (r.w <= 0 || r.h <= 0) continue;
      grid.fillStyle(0xe43b44, 0.12).fillRect(r.x, r.y, r.w, r.h);
      grid.lineStyle(0.6, 0xe43b44, 0.45).strokeRect(r.x, r.y, r.w, r.h);
    }
    // Соседство отделов: зелёная связь — пара (берут вместе), красная — химия рядом с едой.
    const linkG = this.add.graphics().setDepth(LIGHT_DEPTH + 13);
    // Какая полка в каком месте: обычные полки занимают места по порядку покупки.
    const kinds = this.state.shelves.filter((sh) => !SHELF_KINDS[sh.kind].fixture).map((sh) => sh.kind);
    // Полка у боковой стены — боком: картинка и место на полу другие.
    const styleGhost = (ghost: Phaser.GameObjects.Container, i: number) => {
      const kind = kinds[i];
      const look = kind ? SHELF_LOOK[kind] : null;
      const side = slotSide(this.layout, at[i]);
      const img = ghost.getData('img') as Phaser.GameObjects.Image;
      if (side) img.setTexture(look ? `${look.texture}_side` : 'slot_empty').setPosition(0, 0).setAngle(look ? 0 : 90).setFlipX(side === 'right');
      else img.setTexture(look ? look.texture : 'slot_empty').setPosition(0, look ? -FURNITURE_TOP / 2 : 2).setAngle(0).setFlipX(false);
      if (look) img.setTint(look.tint);
      const r = slotRect(this.layout, at[i]);
      ghost.setSize(Math.max(20, r.w + 4), Math.max(30, r.h + 6));
      ghost.input?.hitArea.setTo(0, 0, ghost.width, ghost.height);
    };
    const ghosts = at.map((p, i) => {
      const img = this.art(0, 0, 'slot_empty');
      const frame = this.add.graphics();
      const ghost = this.add.container(p.x, p.y, [img, frame]).setDepth(LIGHT_DEPTH + 11);
      ghost.setData('frame', frame).setData('img', img);
      ghost.setSize(44, 30);
      ghost.setInteractive({ draggable: true, useHandCursor: true });
      styleGhost(ghost, i);
      return ghost;
    });
    // Касса — тоже «призрак»: тянется только влево-вправо, вместе с очередью и всем, что при ней.
    const tillFrame = this.add.graphics();
    const tillImg = this.art(0, FURNITURE_TOP / 2, registerSprite(this.state));
    const till = this.add.container(this.layout.counter.x, this.layout.counter.y, [tillFrame, tillImg]).setDepth(LIGHT_DEPTH + 11);
    till.setSize(32, 62).setInteractive({ draggable: true, useHandCursor: true });
    const drawTill = (bad: boolean) => {
      const lay = placed();
      tillFrame.clear();
      for (const z of tillZones(lay, registers, kioskCount(this.state))) {
        const r = { x: z.x - lay.counter.x, y: z.y - lay.counter.y, w: z.w, h: z.h };
        tillFrame.fillStyle(bad ? 0xe43b44 : 0x2ce8f5, 0.18).fillRect(r.x, r.y, r.w, r.h);
        tillFrame.lineStyle(1, bad ? 0xe43b44 : 0x0099db, 0.9).strokeRect(r.x, r.y, r.w, r.h);
      }
    };
    // Вещи зала (автомат, ведро, растения) — тоже «призраки», их тянут свободно.
    const props: (Prop & { tex: string; oy?: number })[] = this.propList.map((p) => ({ ...p, fp: { ...p.fp } }));
    const propGhosts = props.map((p) => {
      const img = this.art(0, p.oy ?? 0, p.tex);
      const frame = this.add.graphics();
      const ghost = this.add.container(p.x, p.y, [frame, img]).setDepth(LIGHT_DEPTH + 11);
      ghost.setSize(Math.max(16, p.fp.w), Math.max(16, p.fp.h)).setInteractive({ draggable: true, useHandCursor: true });
      ghost.setData('frame', frame).setData('img', img);
      return ghost;
    });
    const propDefault = (id: string) => this.propDefaults[id];
    const bar = el('div', 'ui-arrange');
    const hint = el('div', 'ui-arrange-hint', t('arrange.hint'));
    const done = button(t('arrange.done'), () => finish(true), 'ui-btn');
    const reset = button(t('arrange.reset'), () => {
      at = defaults.map((p) => ({ ...p }));
      ghosts.forEach((g, i) => {
        g.setPosition(at[i].x, at[i].y);
        styleGhost(g, i);
      });
      tillDx = 0;
      shortQueue = false;
      queueBtn.textContent = t('arrange.queueShort');
      till.setPosition(plain.counter.x, plain.counter.y);
      props.forEach((p, i) => {
        const d = propDefault(p.id);
        if (d) movePropTo(i, d.x, d.y);
      });
      check();
    }, 'ui-btn secondary');
    const cancel = button(t('arrange.cancel'), () => finish(false), 'ui-btn secondary');
    const row = el('div', 'ui-arrange-row');
    row.append(cancel, reset, done);
    // Длинная очередь тянется до задней стены, короткая — стоит плотнее и освобождает верх зала.
    const queueBtn = button(t(shortQueue ? 'arrange.queueLong' : 'arrange.queueShort'), () => {
      shortQueue = !shortQueue;
      queueBtn.textContent = t(shortQueue ? 'arrange.queueLong' : 'arrange.queueShort');
      check();
    }, 'ui-btn secondary ui-arrange-queue');
    if (canShortenQueue(plain)) bar.append(hint, queueBtn, row);
    else bar.append(hint, row);
    document.body.append(bar);
    // Автомат у боковой стены разворачивается боком.
    const movePropTo = (i: number, x: number, y: number) => {
      const p = props[i];
      p.x = x;
      p.y = y;
      if (p.id === 'vending') {
        const side = vendingSide(plain, x);
        p.tex = side ? 'vending_side' : 'vending';
        p.fp = vendingFootprint(side);
        (propGhosts[i].getData('img') as Phaser.GameObjects.Image).setTexture(p.tex).setFlipX(side && x < w / 2);
      }
      propGhosts[i].setPosition(x, y);
    };
    const check = () => {
      const lay = placed();
      const bad = slotIssues(lay, at, defaults, registers, props.map(propRect), kioskCount(this.state));
      const badProps = propIssues(lay, at, props, registers, kioskCount(this.state));
      // След праздничной вещи вырос книзу (чтобы гости обходили кадку), но проверять её место — по
      // прежнему: ёлка, переставленная игроком раньше, не должна вдруг стать красной.
      if (badProps.has('holiday')) {
        const legacy = props.map((p) => (p.id === 'holiday' ? { ...p, fp: { x: -7, y: -8, w: 14, h: 12 } } : p));
        if (!propIssues(lay, at, legacy, registers, kioskCount(this.state)).has('holiday')) badProps.delete('holiday');
      }
      // Вещь на своём стандартном месте игра поставила сама так, чтобы не мешать (растение у будущей
      // кассы, у двери склада) — красной она становится, только если на неё поставили полку.
      for (const p of props) {
        const d = propDefault(p.id);
        if (d && d.x === p.x && d.y === p.y && !at.some((s) => overlapsRect(slotRect(lay, s), propRect(p)))) badProps.delete(p.id);
      }
      // Ларь ищет место сам — вещь не должна занять его место.
      if (this.state.shelves.some((sh) => sh.kind === 'icebox')) {
        const ice = iceboxRect(iceboxSpotFor({ ...lay, slots: at }, registers, props.map(propRect), kioskCount(this.state)));
        for (const p of props) if (overlapsRect(propRect(p), ice)) badProps.add(p.id);
      }
      propGhosts.forEach((g, i) => {
        const frame = g.getData('frame') as Phaser.GameObjects.Graphics;
        const { fp, id } = props[i];
        const red = badProps.has(id);
        frame.clear();
        frame.fillStyle(red ? 0xe43b44 : 0xfee761, 0.3).fillRect(fp.x, fp.y, fp.w, fp.h);
        frame.lineStyle(1, red ? 0xe43b44 : 0xb86f50, 1).strokeRect(fp.x, fp.y, fp.w, fp.h);
      });
      // Кассу подсвечиваем красным, если на её месте или в очереди стоит красная полка.
      drawTill(tillZones(lay, registers, kioskCount(this.state)).some((z) => at.some((p, i) => bad.has(i) && overlapsRect(slotRect(lay, p), z))));
      ghosts.forEach((g, i) => {
        const frame = g.getData('frame') as Phaser.GameObjects.Graphics;
        const abs = slotRect(lay, at[i]);
        const r = { x: abs.x - at[i].x, y: abs.y - at[i].y, w: abs.w, h: abs.h };
        frame.clear();
        frame.fillStyle(bad.has(i) ? 0xe43b44 : 0x63c74d, 0.28).fillRect(r.x, r.y, r.w, r.h);
        frame.lineStyle(1, bad.has(i) ? 0xe43b44 : 0x3e8948, 1).strokeRect(r.x, r.y, r.w, r.h);
      });
      linkG.clear();
      for (const link of shelfLinks(at.map((p) => slotRect(lay, p)), at.map((_, i) => kinds[i]))) {
        const [a, b] = [at[link.a], at[link.b]];
        const color = link.kind === 'pair' ? 0x63c74d : 0xe43b44;
        linkG.lineStyle(1.5, color, 0.95).lineBetween(a.x, a.y - 4, b.x, b.y - 4);
        linkG.fillStyle(0xffffff, 1).fillCircle((a.x + b.x) / 2, (a.y + b.y) / 2 - 4, 2.6);
        linkG.fillStyle(color, 1).fillCircle((a.x + b.x) / 2, (a.y + b.y) / 2 - 4, 1.8);
      }
      // Ларь ищет место сам — после перестановки ему должно найтись место у стены.
      const iceless = this.state.shelves.some((sh) => sh.kind === 'icebox') && !iceboxFits(lay, at, registers, props.map(propRect), kioskCount(this.state));
      done.disabled = bad.size > 0 || badProps.size > 0 || iceless;
      hint.textContent = bad.size || badProps.size ? t('arrange.bad', { n: bad.size + badProps.size }) : iceless ? t('arrange.icebox') : t('arrange.hint');
      return iceless || badProps.size ? new Set([...bad, -1]) : bad;
    };
    const onDrag = (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject, x: number, y: number) => {
      if (obj === till) {
        tillDx = clampTill(plain, registers, x - plain.counter.x);
        till.setPosition(plain.counter.x + tillDx, plain.counter.y);
        check();
        return;
      }
      const k = propGhosts.indexOf(obj as Phaser.GameObjects.Container);
      if (k >= 0) {
        movePropTo(k, Phaser.Math.Clamp(snap(x), 6, w - 6), Phaser.Math.Clamp(snap(y), this.layout.wallH + 8, h - 8));
        propGhosts[k].setDepth(LIGHT_DEPTH + 12);
        check();
        return;
      }
      const i = ghosts.indexOf(obj as Phaser.GameObjects.Container);
      if (i < 0) return;
      // У боковой стены полка «прилипает» к ней и разворачивается боком.
      let gx = snap(x);
      gx = gx < 20 ? SIDE_X : gx > w - 20 ? w - SIDE_X : gx;
      const sideNow = gx === SIDE_X || gx === w - SIDE_X;
      // У задней стены — «прилипает» к ней вплотную.
      const gy = Phaser.Math.Clamp(snap(y), this.layout.wallH + (sideNow ? 22 : 4), h - (sideNow ? 24 : 28));
      at[i] = { x: gx, y: wallSnap(this.layout, { x: gx, y: gy }) };
      ghosts[i].setPosition(at[i].x, at[i].y).setDepth(LIGHT_DEPTH + 12);
      styleGhost(ghosts[i], i);
      check();
    };
    // Откуда взяли полку: если бросить её на другую полку или на пустое место, они меняются местами.
    let dragFrom: { x: number; y: number } | null = null;
    const onDragStart = (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
      const i = ghosts.indexOf(obj as Phaser.GameObjects.Container);
      dragFrom = i >= 0 ? { ...at[i] } : null;
    };
    const onDragEnd = (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
      (obj as Phaser.GameObjects.Container).setDepth?.(LIGHT_DEPTH + 11);
      haptic.tap();
      const i = ghosts.indexOf(obj as Phaser.GameObjects.Container);
      if (i < 0 || !dragFrom) return;
      const mine = slotRect(this.layout, at[i]);
      const area = (j: number) => {
        const o = slotRect(this.layout, at[j]);
        return Math.max(0, Math.min(mine.x + mine.w, o.x + o.w) - Math.max(mine.x, o.x)) * Math.max(0, Math.min(mine.y + mine.h, o.y + o.h) - Math.max(mine.y, o.y));
      };
      const others = at.map((_, j) => j).filter((j) => j !== i && area(j) > 0);
      if (!others.length) return;
      const j = others.reduce((a, b) => (area(b) > area(a) ? b : a));
      at[i] = { ...at[j] };
      at[j] = dragFrom;
      for (const k of [i, j]) {
        ghosts[k].setPosition(at[k].x, at[k].y);
        styleGhost(ghosts[k], k);
      }
      check();
    };
    // В первый раз — коротко, что можно делать в перестановке.
    if (!this.state.arrangeIntro) {
      this.state = { ...this.state, arrangeIntro: true };
      saveGame(this.state);
      const { card, close } = openModal();
      const list = el('ul', 'ui-arrange-intro');
      for (const key of ['arrange.intro.drag', 'arrange.intro.side', 'arrange.intro.swap', 'arrange.intro.red', 'arrange.intro.links', 'arrange.intro.queue'] as const) {
        if (key === 'arrange.intro.queue' && !canShortenQueue(plain)) continue;
        list.append(el('li', '', t(key)));
      }
      card.append(el('h2', '', t('arrange.intro.title')), list, button(t('arrange.intro.ok'), close, 'ui-btn'));
    }
    this.input.on('dragstart', onDragStart);
    this.input.on('drag', onDrag);
    this.input.on('dragend', onDragEnd);
    check();
    const finish = (save: boolean) => {
      if (save && check().size) return;
      this.input.off('dragstart', onDragStart);
      this.input.off('drag', onDrag);
      this.input.off('dragend', onDragEnd);
      bar.remove();
      grid.destroy();
      linkG.destroy();
      ghosts.forEach((g) => g.destroy());
      propGhosts.forEach((g) => g.destroy());
      till.destroy();
      this.arranging = false;
      if (save) {
        this.state = {
          ...this.state,
          slotPos: slotPosFor(level, at),
          tillPos: tillDx || shortQueue ? { level, dx: tillDx, ...(shortQueue ? { short: true } : {}) } : undefined,
          propPos: propPosFor(level, props, this.propDefaults),
        };
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
        // Прибитое к экрану (виньетка) не отсекается по месту в мире.
        if ((obj as unknown as Phaser.GameObjects.Components.ScrollFactor).scrollFactorX === 0) continue;
        const shape = obj as unknown as Phaser.GameObjects.Components.GetBounds & { cameraFilter: number };
        if (typeof shape.getBounds !== 'function') continue;
        this.cullables.push({ obj: obj as Phaser.GameObjects.GameObject & { cameraFilter: number }, box: shape.getBounds() });
      }
    }
    // Пересчитываем, только когда видимая область сдвинулась или приблизилась. Ключ — по самой
    // видимой области (worldView), а не по scroll: после прыжка камеры worldView обновляется лишь
    // к следующему кадру, и по scroll отсечение застряло бы со старым видом — пропадали дома и деревья.
    const v = cam.worldView;
    const key = `${Math.round(v.x)}|${Math.round(v.y)}|${Math.round(v.width)}|${this.cullables.length}`;
    if (key === this.cullAt) return;
    this.cullAt = key;
    const margin = 24;
    const view = new Phaser.Geom.Rectangle(v.x - margin, v.y - margin, v.width + margin * 2, v.height + margin * 2);
    for (const c of this.cullables) {
      if (!c.obj.active) continue;
      c.obj.cameraFilter = Phaser.Geom.Rectangle.Overlaps(view, c.box) ? 0 : cam.id;
    }
  }

  /**
   * FPS по секундам, пока идёт день и вкладка на экране. Если игра заметно тормозит (медиана за
   * полминуты, quality.ts) — графика на несколько дней проще: с высокой на обычную, а совсем медленно —
   * лёгкая (о ней говорим). Ровные 30 кадров (энергосбережение iPhone) — не тормоза.
   */
  private measureFps(deltaMs: number): void {
    // Свернули вкладку, окно поверх зала (там кадров нарочно меньше) — такие кадры не в счёт.
    if (!this.running || document.hidden || framesThrottled() || deltaMs > 250) {
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
    // Судим по полминуте замеров после прошлого понижения: сначала видно, помогло ли оно.
    if (++this.fpsSince < 30) return;
    const recent = this.fpsSamples.slice(-30);
    const verdict = fpsVerdict(recent, this.gfx);
    // Игрок сам выбрал графику в профиле — её не трогаем.
    if (!verdict || qualityChosen()) return;
    this.fpsSince = 0;
    this.gfx = verdict;
    lowerQuality(verdict);
    // Виньетки больше нет, в лёгкой — и цветокоррекции; карта освещения грубее — с ближайшей перестройки.
    this.grade.setTier(verdict);
    this.light.setTier(verdict);
    const median = fpsSummary(recent)?.median ?? 0;
    if (verdict !== 'lite') {
      track('gfx_auto', this.state.day, median);
      return;
    }
    this.lite = true;
    track('lite_auto', this.state.day, median);
    // Первые тихие дни новичка: лёгкая включается молча, а записка о ней — утром 4-го дня (firstday.ts).
    if (quietDays(this.state)) deferLiteNote();
    else toast('assets/ico_phone.png', t('lite.autoTitle'), t('lite.autoText'));
  }

  /** Переходник к lighting.updateLighting: метод сцены вызывают и скрипты снаружи (scripts/e2e.ts, scripts/promo). */
  updateLighting(progress?: number): void {
    return lighting.updateLighting(this, progress);
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
  buildGearProps(): void {
    const { w, h, door, warehouse, wc } = this.layout;
    const tier = (id: GearId) => gearTier(this.state, id);
    const store = tier('warehouse');
    if (store === 3) this.art(warehouse.x + warehouse.w - 13, warehouse.y + 12, 'autostore').setDepth(warehouse.y + 60);
    else if (store) this.art(warehouse.x + 11, h - 11, store === 1 ? 'pallet_jack' : 'forklift').setDepth(h - 4);
    const climate = tier('climate');
    // На стене между постером, часами и окном (они висят через 32 от x = 30) — свободные места.
    if (climate === 1) {
      for (const x of [46, 78].filter((fx) => !this.behindShelf(fx))) {
        this.art(x, 10, 'fan_base').setDepth(4);
        const blades = this.art(x, 10, 'fan_blades').setDepth(5);
        this.tweens.add({ targets: blades, angle: 360, duration: 700, repeat: -1 });
      }
    } else if (climate === 2) {
      // Кондиционер — между картинами и окнами, на куске стены, не закрытом полкой.
      const acX = [126, 190].find((x) => x < wc.x - 16 && !this.behindShelf(x, 10));
      const ac = acX === undefined ? null : this.art(acX, 7, 'ac_wall').setDepth(4);
      // Струйки холодного воздуха из кондиционера.
      for (let i = 0; ac && i < 3; i++) {
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
      this.worldTimer(1400, () => screen.active && screen.setTexture(screen.texture.key === 'facade_screen0' ? 'facade_screen1' : 'facade_screen0'));
    }
    if (tier('wc')) {
      const sensor = this.add.rectangle(wc.x + 9, wc.y - 13, 2, 2, tier('wc') === 2 ? 0x2ce8f5 : 0x63c74d).setDepth(wc.y + 2);
      this.tweens.add({ targets: sensor, alpha: 0.3, duration: 900, yoyo: true, repeat: -1 });
    }
  }

  // ---------- Доставка на дом ----------

  /** Телефон на кассе и курьер у входа со своим транспортом (если доставка куплена). */
  buildDelivery(): void {
    // Мир перестраивают только между днями; что осталось от прошлого зала — отпускаем.
    this.callTimer?.remove();
    this.callTimer = undefined;
    this.endCall();
    this.parcels = [];
    this.packRequested = false;
    this.deliveryUi.setPill(null);
    this.phone = undefined;
    this.phoneGlow = undefined;
    this.courier = undefined;
    this.courierRide = undefined;
    this.courierBusy = false;
    this.courierTrip = null;
    if (!hasUpgrade(this.state, 'delivery')) return;
    const { counter, door, h } = this.layout;
    this.phone = this.art(counter.x - 5, counter.y - 9, 'phone').setDepth(counter.y + 22);
    // Звонит — светится ореолом (а не эффектом со своим проходом отрисовки).
    this.phoneGlow = new Halo(this, this.phone, 0xfee761);
    // Касание телефона тоже принимает заказ, но главное «Принять» — в карточке внизу (ui/delivery.ts):
    // телефон в пару точек пальцем почти не попасть, а рядом — касса со своей зоной касания. Поэтому
    // телефон ловит касания, только пока звонит, — в остальное время они достаются кассе.
    this.phone.setInteractive(new Phaser.Geom.Rectangle(-6, -6, 24, 23), Phaser.Geom.Rectangle.Contains).on('pointerup', () => this.tap(() => this.acceptOrder()));
    this.phone.disableInteractive();
    // Курьер ждёт у входа рядом со своим велосипедом или мопедом; фургончик подъезжает, когда есть что везти.
    const at = { x: door.x - 36, y: h + FACADE_H + 9 };
    this.courierHome = at;
    const vehicle = vehicleOf(this.state);
    if (vehicle.id !== 'van') this.courierRide = this.art(at.x + 9, at.y + 2, vehicle.id).setDepth(at.y + 1);
    this.courier = this.makePerson(at.x, at.y, { ...randomLook(0xf77622), style: 'cap', hair: 0xf77622, bag: 'backpack', bagTint: 0xe43b44 });
  }

  /** Игровые секунды: идут с ускорением и стоят, пока магазин закрыт или на паузе (time.now — нет). */
  private dayClock(): number {
    return this.playTime;
  }

  /**
   * Следующий звонок: через случайное время, с хорошим транспортом и рейтингом доставки — чаще.
   * Без доставки случайное число не тратим: остальной день идёт по тем же случайностям, что и раньше.
   */
  private scheduleOrder(seconds?: number): void {
    this.callTimer?.remove();
    this.callTimer = undefined;
    if (!this.phone) return;
    this.callTimer = this.time.delayedCall((seconds ?? nextCallIn(this.state, Math.random)) * 1000, () => this.ringPhone());
  }

  /** Сколько принятых заказов ещё не уехало (собираются или ждут курьера у двери). */
  private parcelsWaiting(): number {
    return this.parcels.filter((p) => p.stage !== 'riding').length;
  }

  /** Звонок: телефон трезвонит и светится, внизу экрана — карточка заказа с кнопками. */
  private ringPhone(): void {
    this.callTimer = undefined;
    const phone = this.phone;
    if (!phone?.active || !this.running || this.night || this.timeLeft < ORDER_TIMEOUT + 3) return;
    // Курьеру уже некуда брать или игрок в окне (срочный подвоз, особый гость) — перезвонят чуть позже,
    // заказ не пропадает.
    if (this.call || this.parcelsWaiting() >= vehicleOf(this.state).queue || modalOpen()) {
      this.scheduleOrder(RETRY_CALL);
      return;
    }
    const order = makeHomeOrder(this.state, Math.random);
    if (!order) {
      this.scheduleOrder();
      return;
    }
    this.call = {
      order,
      at: this.dayClock(),
      timer: this.time.delayedCall(ORDER_TIMEOUT * 1000, () => this.missCall()),
      // Трель — раз в полторы секунды, пока не ответили; трубка подпрыгивает чаще.
      ringer: this.time.addEvent({ delay: 1500, loop: true, callback: () => this.ringOnce() }),
      shake: this.time.addEvent({ delay: 110, loop: true, callback: () => phone.active && phone.setTexture(phone.texture.key === 'phone' ? 'phone_ring' : 'phone') }),
    };
    this.ringOnce();
    phone.setInteractive();
    haptic.tap();
    this.popup(phone.x, phone.y - 14, t('popup.order'), '#fff3b0');
    // Телефон крупнее, светится, от него расходятся кольца — видно, где звонит.
    this.tweens.add({ targets: phone, scale: 1.6 / ART, duration: 180, ease: 'Back.easeOut' });
    this.phoneHalo = this.add.circle(phone.x, phone.y, 5).setStrokeStyle(1.2, 0xfee761, 1).setDepth(LIGHT_DEPTH + 12);
    this.tweens.add({ targets: this.phoneHalo, scale: 2.6, alpha: { from: 0.95, to: 0 }, duration: 750, repeat: -1, ease: 'Quad.easeOut' });
    this.deliveryUi.showCall({
      order,
      waiting: this.parcelsWaiting(),
      top: this.registerLow(),
      onAccept: () => this.acceptOrder(),
      onDecline: () => this.declineOrder(),
    });
  }

  /** Одна трель: звонок и трубка покачивается. */
  private ringOnce(): void {
    const phone = this.phone;
    if (!phone?.active) return;
    sound.phone(phone.x);
    this.tweens.add({ targets: phone, angle: { from: -14, to: 14 }, duration: 60, yoyo: true, repeat: 5, onComplete: () => phone.active && phone.setAngle(0) });
  }

  /** Касса в нижней части экрана: карточку звонка ставим сверху, чтобы не закрыть её. */
  private registerLow(): boolean {
    const view = this.cameras.main.worldView;
    return (this.layout.counter.y - view.y) / view.height > 0.55;
  }

  /** Звонок кончился (ответили, отказали, не дождались, день кончился): телефон стихает, карточка уезжает. */
  private endCall(): { order: HomeOrder; at: number } | null {
    const call = this.call;
    this.call = null;
    this.deliveryUi.hideCall(!call);
    if (this.phoneHalo) {
      this.tweens.killTweensOf(this.phoneHalo);
      this.phoneHalo.destroy();
    }
    this.phoneHalo = undefined;
    if (!call) return null;
    call.timer.remove();
    call.ringer.remove();
    call.shake.remove();
    // Карточку звонка игрок увидел — подробная подсказка больше не нужна.
    if (!(this.state.seenTips ?? []).includes(CALL_CARD_TIP)) this.state = { ...this.state, seenTips: [...(this.state.seenTips ?? []), CALL_CARD_TIP] };
    const phone = this.phone;
    if (phone?.active) {
      this.tweens.killTweensOf(phone);
      phone.setTexture('phone').setAngle(0).setScale(1 / ART).disableInteractive();
    }
    this.phoneGlow?.set(0);
    return call;
  }

  /** Не ответили вовремя: заказ ушёл, рейтинг доставки падает — звонить будут реже. */
  private missCall(): void {
    if (!this.endCall()) return;
    sound.bad();
    if (this.phone) this.popup(this.phone.x, this.phone.y - 14, t('popup.orderMissed'), '#ffd0d0');
    this.state = rateDelivery(this.state, 'missed');
    this.stats.deliveryMissed = (this.stats.deliveryMissed ?? 0) + 1;
    this.scheduleOrder();
  }

  /** Отказали: вежливо — рейтинг падает меньше, чем за пропущенный звонок. */
  private declineOrder(): void {
    if (!this.endCall()) return;
    haptic.tap();
    if (this.phone) this.popup(this.phone.x, this.phone.y - 14, t('popup.orderDeclined'), '#fff3b0');
    this.state = rateDelivery(this.state, 'declined');
    this.stats.deliveryMissed = (this.stats.deliveryMissed ?? 0) + 1;
    this.scheduleOrder();
  }

  /** Приняли (кнопкой, касанием телефона или трубку снял менеджер): товар откладываем, заказ — собирать. */
  private acceptOrder(): void {
    const phone = this.phone;
    const call = this.endCall();
    if (!call || !phone) return;
    const packed = packHomeOrder(this.state, call.order);
    if (!packed) {
      // Пока звонили, последнее раскупили.
      sound.bad();
      this.popup(phone.x, phone.y - 14, t('popup.orderNoStock'), '#ffd0d0');
      this.state = rateDelivery(this.state, 'noStock');
      this.stats.deliveryMissed = (this.stats.deliveryMissed ?? 0) + 1;
      this.scheduleOrder();
      return;
    }
    this.state = packed;
    this.refreshShelves();
    this.refreshWarehouse();
    haptic.success();
    sound.good();
    this.parcels.push({ order: call.order, calledAt: call.at, stage: 'wait', packed: 0 });
    this.popup(phone.x, phone.y - 14, t('popup.orderPack'), '#c8ffb0');
    // Собирают менеджер или грузчик (их циклы сами берут заказ), а без них — хозяин, как только освободится.
    if (!this.staffPacks()) this.packRequested = true;
    this.scheduleOrder();
  }

  /** Кто собирает заказы: менеджер в зале или грузчик на смене; иначе — сам хозяин. */
  private staffPacks(): boolean {
    return this.managerOnFloor || this.workers.has('loader');
  }

  private nextParcel(): Parcel | undefined {
    return this.parcels.find((p) => p.stage === 'wait');
  }

  /**
   * Укладка заказа: рядом с упаковщиком открытая коробка, товар по штуке прыгает в неё с «чпок»,
   * над головой — полоска. Возвращает «бросить»: позвали к кассе — коробка и полоска пропадают.
   */
  private packFx(who: Phaser.GameObjects.Container, parcel: Parcel, ms: number): () => void {
    const x = who.x + 9;
    const y = who.y + 5;
    const units = parcel.order.items.flatMap(({ id, qty }) => Array.from({ length: qty }, () => id));
    const box = this.art(x, y, 'parcel').setDepth(y + 1);
    // Светлая каёмка: полоска не теряется на тёмных стеллажах склада.
    const bar = this.add.rectangle(who.x - 9, who.y - 22, 18, 4, 0x181425).setStrokeStyle(0.6, 0xfee761).setOrigin(0, 0.5).setDepth(1000);
    const fill = this.add.rectangle(who.x - 8, who.y - 22, 0, 2, 0x63c74d).setOrigin(0, 0.5).setDepth(1001);
    const parts: Phaser.GameObjects.GameObject[] = [box, bar, fill];
    this.tweens.add({ targets: fill, width: 16, duration: ms });
    // Штуки ложатся за первые 4/5 времени, остальное — закрыть и заклеить коробку.
    const step = (ms * 0.8) / Math.max(1, units.length);
    const timers = units.map((id, i) =>
      this.time.delayedCall(step * (i + 0.5), () => {
        if (!box.active) return;
        parcel.packed = i + 1;
        sound.shelf(PRODUCTS[id].category, i, x);
        if (this.lite) return;
        const item = this.art(who.x, who.y - 12, `item_${id}`).setScale(0.8 / ART).setDepth(1002);
        parts.push(item);
        this.tweens.add({
          targets: item,
          x,
          y: y - 2,
          duration: 240,
          ease: 'Quad.easeIn',
          onComplete: () => {
            item.destroy();
            if (box.active) motion.squash(this, box, 1.15, 0.85, 70);
          },
        });
      }),
    );
    const clear = () => {
      for (const timer of timers) timer.remove();
      for (const part of parts) part.destroy();
    };
    const done = this.time.delayedCall(ms, clear);
    return () => {
      done.remove();
      clear();
    };
  }

  /** Хозяин собирает заказ сам: идёт на склад, укладывает коробку и выносит её к двери. */
  private async ownerPack(): Promise<void> {
    const parcel = this.nextParcel();
    if (!parcel || !this.running || this.sellerBusy || this.ownerScanning()) return;
    const { warehouse, door } = this.layout;
    const ms = packMs(parcel.order);
    let cancel = () => {};
    parcel.stage = 'packing';
    this.popup(this.seller.x, this.seller.y - 18, t('popup.packOwner'), '#fff3b0');
    await this.doChore([
      { ...warehouse.doorway },
      {
        ...warehouse.pickup,
        ms,
        arrive: () => (cancel = this.packFx(this.seller, parcel, ms)),
        action: () => this.carried.setTexture('parcel').setPosition(0, 3).setVisible(true),
      },
      { ...warehouse.doorway },
      {
        x: door.x - 6,
        y: door.y - 10,
        ms: 250,
        action: () => {
          this.carried.setVisible(false).setTexture('box');
          this.parcelAtDoor(parcel);
        },
      },
    ]);
    // Позвали к кассе на полпути: заказ ждёт, собирать — заново, когда скажут (плашка «📦 Собрать заказ»).
    if (parcel.stage === 'packing') {
      cancel();
      parcel.stage = 'wait';
      parcel.packed = 0;
      this.packRequested = false;
      return;
    }
    // Вынес — и, если ждут ещё принятые заказы, как освободится, соберёт следующий.
    this.packRequested = Boolean(this.nextParcel());
  }

  /** Менеджер или грузчик собирает заказ на складе и выносит коробку к двери. */
  private async packParcel(w: Worker, gen: number, parcel: Parcel): Promise<void> {
    const { warehouse, door } = this.layout;
    parcel.stage = 'packing';
    // Смена кончилась или человек ушёл на полпути — заказ снова ждёт сборки.
    const drop = (cancel = () => {}) => {
      cancel();
      w.carried.setVisible(false).setTexture('box');
      if (parcel.stage === 'packing') {
        parcel.stage = 'wait';
        parcel.packed = 0;
      }
    };
    await this.workerWalk(w, warehouse.doorway.x, warehouse.doorway.y);
    await this.workerWalk(w, warehouse.pickup.x, warehouse.pickup.y);
    if (!this.alive(gen)) return drop();
    const ms = packMs(parcel.order) / this.workerPace(w);
    const cancel = this.packFx(w.sprite, parcel, ms);
    await this.wait(ms);
    if (!this.alive(gen)) return drop(cancel);
    w.carried.setTexture('parcel').setPosition(0, 3).setVisible(true);
    this.popup(w.sprite.x, w.sprite.y - 18, t('popup.parcel'), '#fff3b0');
    await this.workerWalk(w, warehouse.doorway.x, warehouse.doorway.y);
    await this.workerWalk(w, door.x - 6, door.y - 10);
    await this.workerWait(w, 250);
    if (!this.alive(gen)) return drop();
    w.carried.setVisible(false).setTexture('box');
    this.parcelAtDoor(parcel);
  }

  /** Коробка у двери ждёт курьера; свободный курьер сразу идёт за ней. */
  private parcelAtDoor(parcel: Parcel): void {
    // День кончился, пока несли: заказ уже развезли после закрытия.
    if (!this.parcels.includes(parcel)) return;
    parcel.stage = 'ready';
    const { door } = this.layout;
    const n = this.parcels.filter((p) => p.box?.active).length;
    parcel.box = this.art(door.x - 14 - n * 7, door.y - 3, 'parcel').setDepth(door.y - 2);
    sound.boxLand(parcel.box.x);
    // Курьер ещё в пути — коробка постоит у двери, он заберёт её, когда вернётся.
    if (this.courierBusy) this.popup(parcel.box.x, parcel.box.y - 12, t('popup.parcelWaits'), '#fff3b0');
    void this.dispatchCourier();
  }

  /** Свободный курьер забирает коробки у двери (сколько увезёт его транспорт) и едет к клиентам. */
  private async dispatchCourier(): Promise<void> {
    const courier = this.courier;
    if (!courier?.active || this.courierBusy) return;
    const vehicle = vehicleOf(this.state);
    const batch = this.parcels.filter((p) => p.stage === 'ready').slice(0, vehicle.carry);
    if (!batch.length) return;
    this.courierBusy = true;
    for (const p of batch) p.stage = 'riding';
    const { door, h } = this.layout;
    // Подходит к порогу (снаружи, у двери), коробки перелетают к нему в руки.
    await this.walk(courier, door.x - 4, h + FACADE_H + 5, 45);
    if (!courier.active) return;
    batch.forEach((p, i) => {
      const box = p.box;
      p.box = undefined;
      if (box?.active) this.tweens.add({ targets: box, x: courier.x, y: courier.y - 3, delay: i * 120, duration: 220, ease: 'Quad.easeOut', onComplete: () => box.destroy() });
    });
    const held = this.art(0, 2, 'parcel');
    courier.add(held);
    this.popup(courier.x, courier.y - 18, t('popup.parcelGiven', { icon: vehicle.icon }), '#c8ffb0');
    await this.wait(300);
    await this.walk(courier, this.courierHome.x, this.courierHome.y, 45);
    held.destroy();
    if (!courier.active) return;
    await this.rideCourier(batch, vehicle);
  }

  /**
   * Курьер уезжает по улице (на велосипеде или мопеде — сам, фургончик подъезжает за ним), у клиента
   * получает деньги и чаевые за скорость, возвращается — монетки летят в кассу. Потом — следующие коробки.
   */
  private async rideCourier(batch: Parcel[], vehicle: Vehicle): Promise<void> {
    const courier = this.courier;
    if (!courier?.active) return;
    const home = this.courierHome;
    const away = -80;
    // Сколько ехать — для плашки: до края улицы, у клиентов и обратно.
    this.courierTrip = { start: this.dayClock(), seconds: (2 * (home.x - away + 24)) / vehicle.speed + vehicle.away, icon: vehicle.icon };
    sound.courier(vehicle.id, courier.x);
    this.popup(courier.x, courier.y - 18, t('popup.orderGo', { icon: vehicle.icon }), '#c8ffb0');
    // У клиента: чаевые — по тому, сколько прошло от звонка до двери.
    const arrive = () => {
      for (const p of batch) p.tip = deliveryTip(this.dayClock() - p.calledAt + vehicle.away / 2);
    };
    if (vehicle.id === 'van') {
      if (!(await this.vanTrip(courier, vehicle, arrive))) return;
    } else {
      const road = this.streetY + 2;
      const ride = this.art(0, 3, vehicle.id).setOrigin(0.5);
      courier.addAt(ride, 0);
      // На велосипеде крутит педали, а не бежит (animatePeople): без подскока и пыли.
      courier.setData('wheels', true);
      this.courierRide?.setVisible(false);
      await this.walk(courier, home.x, road, vehicle.speed);
      ride.setFlipX(true);
      await this.walk(courier, away, road, vehicle.speed);
      if (!courier.active) return;
      arrive();
      await this.wait(vehicle.away * 1000);
      ride.setFlipX(false);
      await this.walk(courier, home.x, road, vehicle.speed);
      await this.walk(courier, home.x, home.y, vehicle.speed);
      if (!courier.active) return;
      ride.destroy();
      courier.setData('wheels', false);
      this.courierRide?.setVisible(true);
    }
    this.setFacing(courier, 'down');
    this.courierBusy = false;
    this.courierTrip = null;
    sound.courier(vehicle.id, courier.x);
    this.payParcels(batch, vehicle, courier);
    void this.dispatchCourier();
  }

  /**
   * Фургончик: подъезжает к тротуару, курьер садится, уезжает по ближней полосе. Машины на ней едут
   * только вправо (налево — по дальней), поэтому обратно он не пятится, а объезжает квартал: снова
   * появляется слева, высаживает курьера и едет дальше вправо. false — не доехал.
   */
  private async vanTrip(courier: Phaser.GameObjects.Container, vehicle: Vehicle, arrive: () => void): Promise<boolean> {
    const home = this.courierHome;
    const roadY = this.streetY + 24;
    const van = this.add.container(-70, roadY, [this.art(0, 0, 'car_van').setTint(VAN_TINT), this.art(0, 0, 'car_van_lights')]).setDepth(roadY);
    const drive = (x: number, ease: string) =>
      new Promise<void>((done) => {
        const ms = (Math.abs(van.x - x) / vehicle.speed) * 1000;
        this.tweens.add({ targets: van, x, duration: ms, ease, onComplete: () => done(), onStop: () => done() });
      });
    await drive(home.x + 6, 'Sine.easeOut');
    await this.walk(courier, home.x, roadY - 9, 45);
    if (!courier.active || !van.active) return false;
    courier.setVisible(false);
    await drive(this.next.w + 70, 'Sine.easeIn');
    arrive();
    await this.wait(vehicle.away * 1000);
    if (!van.active) return false;
    van.x = -70;
    await drive(home.x + 6, 'Sine.easeOut');
    courier.setVisible(true);
    await this.walk(courier, home.x, home.y, 45);
    if (van.active) void drive(this.next.w + 70, 'Sine.easeIn').then(() => van.destroy());
    return courier.active;
  }

  /** Курьер вернулся с деньгами: за заказы и чаевые; рейтинг доставки растёт (за скорость — сильнее). */
  private payParcels(batch: Parcel[], vehicle: Vehicle, courier: Phaser.GameObjects.Container): void {
    let pay = 0;
    let tips = 0;
    for (const p of batch) {
      const i = this.parcels.indexOf(p);
      // День кончился, пока ехал: эти заказы уже посчитаны в итогах.
      if (i < 0) continue;
      this.parcels.splice(i, 1);
      const tip = p.tip ?? 0;
      pay += p.order.pay;
      tips += tip;
      this.state = rateDelivery(this.state, outcomeFor(tip));
      this.stats.deliveries = (this.stats.deliveries ?? 0) + 1;
    }
    if (!pay) return;
    this.state = { ...this.state, money: this.state.money + pay + tips };
    this.stats.revenue += pay + tips;
    this.stats.deliveryPay = (this.stats.deliveryPay ?? 0) + pay + tips;
    this.stats.deliveryTips = (this.stats.deliveryTips ?? 0) + tips;
    sound.coin(courier.x);
    haptic.success();
    this.popup(courier.x, courier.y - 16, t('popup.orderPaid', { icon: vehicle.icon, n: pay }), '#c8ffb0');
    if (tips) this.time.delayedCall(450, () => courier.active && this.popup(courier.x, courier.y - 16, t('popup.orderTip', { n: tips }), '#fee761'));
    effects.flyCoins(this, courier.x, courier.y, Math.min(6, 2 + batch.length * 2));
  }

  /** Каждый кадр: кольцо на карточке звонка, хозяин идёт собирать заказ, плашка-статус доставки. */
  private updateDelivery(): void {
    if (!this.phone) return;
    const call = this.call;
    if (call) {
      // Поверх открыли окно (срочный подвоз, особый гость): карточка его не закрывает и сама под ним не
      // теряется — прячется, а звонок ждёт: время на ответ стоит, трель молчит, трубку не нажать сквозь окно.
      const covered = modalOpen();
      if (covered !== Boolean(call.covered)) {
        call.covered = covered;
        call.timer.paused = covered;
        call.ringer.paused = covered;
        this.deliveryUi.coverCall(covered);
        if (covered) this.phone.disableInteractive();
        else this.phone.setInteractive();
      }
      this.deliveryUi.setCountdown(1 - call.timer.getProgress(), call.timer.getRemainingSeconds());
    }
    if (this.packRequested && !this.sellerBusy && !this.ownerScanning()) {
      this.packRequested = false;
      void this.ownerPack();
    }
    const waiting = this.parcels.filter((p) => p.stage === 'wait' || p.stage === 'packing');
    const ready = this.parcels.filter((p) => p.stage === 'ready');
    // Собрать некому: менеджера и грузчика нет, хозяина позвали к кассе — кнопка «📦 Собрать заказ».
    if (!this.staffPacks() && !this.packRequested && this.parcels.some((p) => p.stage === 'wait')) {
      this.deliveryUi.setPill(t('delivery.pill.wait'), () => {
        this.packRequested = true;
        haptic.tap();
      });
      return;
    }
    const trip = this.courierTrip;
    if (trip) {
      const more = waiting.length + ready.length;
      const time = clock(trip.seconds - (this.dayClock() - trip.start));
      this.deliveryUi.setPill(t('delivery.pill.ride', { icon: trip.icon, time }) + (more ? ` · ${t('delivery.pill.more', { n: more })}` : ''));
    } else if (waiting.length) {
      const p = waiting[0];
      this.deliveryUi.setPill(t('delivery.pill.pack', { done: p.packed, total: orderUnits(p.order) }));
    } else if (this.courierBusy) this.deliveryUi.setPill(t('delivery.pill.pickup', { icon: vehicleOf(this.state).icon }));
    else if (ready.length) this.deliveryUi.setPill(t('delivery.pill.ready'));
    else this.deliveryUi.setPill(null);
  }

  /**
   * День закрылся: звонок без ответа стихает, а принятые заказы курьер развозит после закрытия — деньги
   * сразу, без чаевых. Возвращает строку для итогов дня (или null, если доставки сегодня не было).
   */
  private closeDelivery(): [string, string] | null {
    this.callTimer?.remove();
    this.callTimer = undefined;
    this.endCall();
    this.packRequested = false;
    for (const p of this.parcels) {
      p.box?.destroy();
      this.state = rateDelivery({ ...this.state, money: this.state.money + p.order.pay }, 'delivered');
      this.stats.revenue += p.order.pay;
      this.stats.deliveryPay = (this.stats.deliveryPay ?? 0) + p.order.pay;
      this.stats.deliveries = (this.stats.deliveries ?? 0) + 1;
    }
    this.parcels = [];
    this.courierTrip = null;
    this.deliveryUi.setPill(null);
    const n = this.stats.deliveries ?? 0;
    const missed = this.stats.deliveryMissed ?? 0;
    if (!this.phone || n + missed === 0) return null;
    const tips = this.stats.deliveryTips ?? 0;
    const value =
      t('summary.deliveryValue', { n, money: this.stats.deliveryPay ?? 0, rating: deliveryRating(this.state).toFixed(1) }) +
      (tips ? t('summary.deliveryTips', { n: tips }) : '') +
      (missed ? t('summary.deliveryMissed', { n: missed }) : '');
    return [t('summary.delivery'), value];
  }

  /** Кофейня во флигеле: кофемашина у стены, стойка, за ней бариста; в углу столик. */
  buildCoffee(): void {
    this.coffeeImg = undefined;
    if (!this.coffeeOpen()) return;
    const { x, y } = this.layout.coffee;
    this.coffeeImg = this.art(x + 10, y + 19, coffeeSprite(this.state)).setDepth(y + 20);
    this.art(x + 22, y + 28, 'coffee_bar').setDepth(y + 34);
    this.art(x + 47, y + 49, 'cafe_table').setDepth(y + 55);
    // Уют: фикус в углу и пар над кофемашиной.
    this.art(x + 6, y + 52, 'plant').setDepth(y + 57);
    if (!this.lite) {
      for (let k = 0; k < 3; k++) {
        const steam = this.add.image(x + 8 + k * 1.5, y + 9, 'glow').setDisplaySize(6, 6).setTint(0xffffff).setAlpha(0).setDepth(y + 22);
        this.tweens.add({ targets: steam, y: y + 1, alpha: { from: 0.5, to: 0 }, scale: steam.scale * 1.8, duration: 1700, delay: k * 600, repeat: -1, repeatDelay: 900, ease: 'Sine.easeOut' });
      }
    }
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
    await this.walkVia(c.sprite, [room.doorway, room.inside]);
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
    // Чашку ставят на блюдце — тонкий звон.
    sound.place('glass', 2, c.sprite.x);
    this.popup(c.sprite.x, c.sprite.y - 18, t('popup.coffee', { n: coffeePrice(this.state) }), '#fff3b0');
    if (cupsOf(this.state) === 0) this.time.delayedCall(900, () => this.popup(machine.x + 10, machine.y - 16, t('popup.noCups'), '#ffd0d0'));
    await this.walkVia(c.sprite, [room.inside, room.doorway]);
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
      sound.hiss(brewSeconds(this.state) * 0.8, 2600, 0.035, machine.x);
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
        // Конфета в шуршащей обёртке.
        sound.place('paper', 3, c.sprite.x);
        if (c.sprite.active && !c.gone) this.popup(c.sprite.x, c.sprite.y - 18, t('popup.candy', { n: CANDY_PRICE }), '#fff3b0');
      },
    });
  }

  // ---------- Печь ----------

  /** Печь в пекарне во флигеле: окошко светится, пока печётся; рядом стеллаж с хлебом и стол пекаря. */
  buildOven(): void {
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
    const halo = new Halo(this, img, 0xfee761);
    // Тёплый отсвет печи на полу и мука, взлетающая со стола пекаря.
    const warm = this.add.image(at.x + 2, at.y + 13, 'glow').setDisplaySize(34, 14).setTint(0xffb060).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.14).setDepth(room.y + 26);
    this.tweens.add({ targets: warm, alpha: 0.22, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (!this.lite) {
      for (let k = 0; k < 4; k++) {
        const dust = this.add.rectangle(room.x + 20 + k * 4, room.y + 41, 1, 1, 0xffffff, 0.8).setDepth(room.y + 52);
        this.tweens.add({ targets: dust, y: room.y + 33, x: dust.x + (k % 2 ? 2 : -2), alpha: { from: 0.8, to: 0 }, duration: 1300, delay: k * 450, repeat: -1, repeatDelay: 2600 });
      }
    }
    // Печь светит в карте освещения: ровный тёплый отсвет на полу, а пока печёт — огонь за дверцей (его
    // дрожь — ступеньками по четверти: карту не перерисовывать каждый кадр ради едва заметного мерцания).
    this.light.follow(warm, { key: 'light_pool', w: 46, h: 30, power: () => 0.45 * lighting.powerOn(this) });
    this.light.follow(glow, { key: 'glow', w: 22, h: 16, color: 0xff9a40, power: () => Math.round(glow.alpha * 4) / 4 });
    this.oven = { img, glow, bread, bar, fill, halo, state: 'idle', start: 0, product: 'bread' };
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
    sound.hiss(0.5, 900, 0.04, oven.img.x);
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
    // Таймер печи: «дзинь».
    sound.ding(oven.img.x);
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
    oven.halo?.set(0);
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
          sound.coin(room.inside.x);
          this.popup(room.inside.x + 10, room.inside.y - 14, t('popup.wholesale', { n: ovenBatch(this.state), pay: sold.pay }), '#c8ffb0');
          this.hud.update(this.state, this.timeLeft);
          continue;
        }
        w.carried.setTexture('bread_tray').setPosition(0, 1).setVisible(true);
        const index = this.breadShelfIndex(product);
        const slot = index >= 0 ? this.spotOf(index) : null;
        // Из пекарни через дверь к полке — одним ходом, без остановки в дверях.
        const stand = slot && standFor(this.layout, slot);
        await this.workerWalkVia(w, [room.inside, room.doorway, ...(stand ? [{ x: stand.x, y: stand.y - 2 }] : [])]);
        await this.workerWait(w, PLACE_MS);
        if (!this.alive(gen)) return;
        w.carried.setVisible(false).setTexture('box').setPosition(0, 3);
        this.freshBread(slot ? { x: slot.x, y: slot.y - 18 } : room.doorway, product);
        await this.workerWalkVia(w, [room.doorway, room.inside]);
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
    sound.hiss(0.6, 1400, 0.04, at.x);
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
      oven.halo?.set(2 + 2 * Math.sin(now / 120));
      if (Math.random() < 0.06) this.steamPuff(oven.img.x, oven.img.y - 6);
    }
  }

  // ---------- Ночная смена ----------

  /** Вечер: если куплена ночная смена — спросить, работать ли ещё; иначе закрываемся. */
  private endOfDay(): void {
    // Момент, не дождавшийся нажатия к закрытию, уходит вместе с днём (и в ночную смену не остаётся).
    this.moments.stop();
    // Срочный заказ не успел доехать до закрытия — водитель всё равно выгрузил.
    this.receiveUrgentOrders();
    if (this.night || this.nightAsked || !canWorkNight(this.state)) {
      this.finishDay();
      return;
    }
    this.nightAsked = true;
    this.running = false;
    motion.straightenPeople(this);
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
    // Ночная смена — ночной трек (плавной сменой, music.ts); он доиграет и в итогах этой ночи.
    this.nightMusic = true;
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
    await this.walkVia(sprite, [
      { x: door.x, y: this.streetY },
      { x: door.x, y: door.y - 10 },
      { x: sellerHome.x - 30, y: sellerHome.y - 16 },
    ]);
    if (!sprite.active || !this.running) {
      sprite.destroy();
      return;
    }
    this.setFacing(sprite, 'right');
    const mark = this.add.text(0, -24, '!', { fontFamily: UI_FONT, fontSize: '10px', color: '#2ce8f5', stroke: '#181425', strokeThickness: 3 }).setOrigin(0.5).setResolution(this.textRes(4));
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
    effects.emote(this, sprite, yes ? 'emo_heart' : 'emo_angry');
    if (yes) this.popup(sprite.x, sprite.y - 18, t('nightStory.thanks'), '#c8ffb0');
    if (res.money) {
      sound.coin(sprite.x);
      this.stats.revenue += res.money;
      this.stats.nightRevenue = (this.stats.nightRevenue ?? 0) + res.money;
      this.time.delayedCall(500, () => this.popup(sprite.x, sprite.y - 26, `+${res.money} 💰`, '#c8ffb0'));
    }
    if (res.rating > 0) this.time.delayedCall(900, () => this.popup(sprite.x, sprite.y - 34, `★ +${res.rating}`, '#fee761'));
    await this.wait(1100);
    // Музыкант остаётся играть у входа до конца смены — ночных гостей больше.
    if (yes && story === 'busker') {
      this.busker = true;
      await this.walkVia(sprite, [
        { x: door.x, y: door.y - 10 },
        { x: door.x - 24, y: this.streetY - 2 },
      ]);
      this.people.delete(sprite);
      this.trickObjs.push(sprite);
      this.trickTimers.push(this.time.addEvent({ delay: 1800, loop: true, callback: () => sprite.active && this.popup(sprite.x, sprite.y - 20, t('popup.busker'), '#fee761') }));
      return;
    }
    await this.walk(sprite, door.x, door.y - 10);
    await this.strollAway(sprite);
  }

  /** Переходник к pets.catVisit: метод сцены вызывают и скрипты снаружи (scripts/e2e.ts, scripts/promo). */
  catVisit(): Promise<void> {
    return pets.catVisit(this);
  }

  // ---------- Доска отзывов ----------

  private buildReviewBoard(x: number, y: number): void {
    // Доска у входа — просто украшение. Раньше нажатие на неё открывало отзывы, и они вылезали
    // посреди дня от случайного касания у двери; теперь отзывы — в итогах дня и утром на вкладке «Развитие».
    this.art(x, y, 'review_board').setOrigin(0.5, 1).setDepth(y);
  }

  /**
   * Покупатель с небольшой корзиной пробивает себя сам на свободной кассе самообслуживания: когда у
   * касс очередь, а без очереди — каждый третий (KIOSK_PREFER). Сколько штук, как быстро, как часто
   * «ошибка» и непробитый товар — по модели киосков (lanes.ts).
   */
  private async useKiosk(c: Customer): Promise<boolean> {
    const tier = kioskTier(this.state);
    if (!this.kiosks.length || c.thief || !c.items.length || c.items.length > tier.maxItems) return false;
    if (this.waiting() === 0 && Math.random() >= KIOSK_PREFER) return false;
    const kiosk = this.kiosks.find((k) => !k.busy && k.img.active);
    if (!kiosk) return false;
    kiosk.busy = true;
    const { img, screen } = kiosk;
    await this.walk(c.sprite, img.x - 14, img.y + 4);
    if (c.gone || !c.sprite.active) {
      kiosk.busy = false;
      return true;
    }
    this.setFacing(c.sprite, 'right');
    c.serving = true;
    // «Забыл» пробить один товар (только из нескольких — с пустым чеком не уходят): уйдёт с ним, не заплатив.
    const skipped = c.items.length > 1 && Math.random() < tier.skip ? c.items[c.items.length - 1] : undefined;
    for (const [n, it] of c.items.entries()) {
      await this.wait(tier.item * 1000);
      if (!this.sys.isActive()) return true;
      if (it === skipped) continue;
      const item = this.art(c.sprite.x, c.sprite.y - 2, `item_${it.id}`).setScale(1.5 / ART).setDepth(1000);
      this.tweens.add({ targets: item, x: img.x, y: img.y - 6, alpha: 0.2, duration: 220, onComplete: () => item.destroy() });
      sound.scan(img.x, n);
      screen.setAlpha(0.9);
      this.time.delayedCall(150, () => screen.setAlpha(0.3));
    }
    // «Неизвестный товар в зоне упаковки»: экран краснеет, покупатель ждёт, пока он сбросится.
    if (Math.random() < tier.error) {
      screen.setFillStyle(KIOSK_ALARM).setAlpha(0.9);
      this.popup(img.x - 6, img.y - 20, t('popup.kioskError'), '#ffd0d0');
      await this.wait(KIOSK_ERROR_SECONDS * 1000);
      if (!this.sys.isActive()) return true;
      screen.setFillStyle(KIOSK_GLOW).setAlpha(0.3);
    }
    await this.wait(tier.pay * 1000);
    kiosk.busy = false;
    if (!this.sys.isActive()) return true;
    if (skipped) {
      c.items = c.items.filter((it) => it !== skipped);
      const value = unitSalePrice(this.state, skipped.id, skipped.unit);
      this.stats.stolen += value;
      this.popup(c.sprite.x, c.sprite.y - 14, t('popup.kioskSkip', { n: value }), '#ffd0d0');
    }
    this.finishCheckout(c, { x: img.x - 10, y: img.y - 12 });
    return true;
  }

  /** Постоянные покупатели на сегодня: каждый заходит в своё случайное время. */
  private scheduleRegulars(): void {
    const coming = regularsToday(this.state).filter((r) => Math.random() < livedRegular(this.state, r).every);
    for (const r of coming) {
      // Пара (life.ts) приходит вместе: второй — спутником первого, отдельно не приходит.
      const partner = companionOf(this.state, r.id)?.regular;
      if (partner && coming.indexOf(regularById(partner)) < coming.indexOf(r)) continue;
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
    weatherFx.addUmbrella(this, sprite);
    const bubble = this.art(0, -14, 'bubble').setVisible(false);
    // Имя над головой — видно, что это друг.
    const tag = this.add
      .text(0, -24, `👋 ${f.name}`, { fontFamily: UI_FONT, fontSize: '6px', fontStyle: 'bold', color: '#fee761', backgroundColor: 'rgba(24, 20, 37, 0.75)', padding: { x: 2, y: 1 } })
      .setOrigin(0.5)
      .setResolution(this.textRes(5));
    sprite.add([bubble, tag]);
    const customer: Customer = { sprite, bubble, items: [], unhappy: false, waitStart: 0, gone: false, thief: false, friend: f, wants: this.wanted(2) };
    // Нажми на друга — угостить кофе: он получит монеты при следующем запуске.
    sprite.setSize(16, 22).setInteractive({ useHandCursor: true }).on('pointerup', () =>
      this.tap(() => {
        if (customer.friend!.treated) return this.popup(sprite.x, sprite.y - 30, t('visit.treated', { name: f.name }), '#fff3b0');
        customer.friend = { ...customer.friend!, treated: true };
        void treatFriend(f.id).then((ok) => ok && sprite.active && this.popup(sprite.x, sprite.y - 30, t('visit.treat', { name: f.name, n: FRIEND_GIFT }), '#c8ffb0'));
        effects.emote(this, sprite, 'emo_heart');
      }),
    );
    this.customers.add(customer);
    void this.runCustomer(customer);
  }

  private spawnRegular(r: Regular): void {
    const start = this.streetSpawn();
    const sprite = this.makePerson(start.x, start.y, { ...livedRegular(this.state, r).look });
    weatherFx.addUmbrella(this, sprite);
    const bubble = this.art(0, -14, 'bubble').setVisible(false);
    sprite.add(bubble);
    // Жизнь района: Пётр Ильич с Ольгой Николаевной, Костя с женой — вдвоём.
    const companion = companionOf(this.state, r.id);
    if (companion) this.addCompanion(sprite, companion.look);
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
      effects.emote(this, c.sprite, 'emo_heart');
      this.popup(c.sprite.x, y, t('regular.up', { name }), '#c8ffb0');
      const total = c.items.reduce((sum, item) => sum + unitSalePrice(this.state, item.id, item.unit), 0);
      // Благоустроенный район (hood.ts): постоянные щедрее.
      const tip = Math.round(tipFor(regularState(this.state, r.id).loyalty, total) * hoodTips(this.state));
      if (tip > 0) {
        this.state = { ...this.state, money: this.state.money + tip };
        this.time.delayedCall(900, () => this.popup(c.sprite.x, y - 8, t('regular.tip', { n: tip }), '#fee761'));
      }
    } else {
      effects.emote(this, c.sprite, 'emo_angry');
      this.popup(c.sprite.x, y, t(result === 'left' ? 'regular.left' : 'regular.down', { name }), '#ffd0d0');
      sound.bad();
    }
    saveGame(this.state);
  }

  // ---------- Активные моменты дня (game/moments.ts, scenes/moments.ts) ----------

  /**
   * Момент не начинается (и начатый ждёт), пока игроку не до него: окно поверх зала, карточка звонка
   * доставки, бабушкина стрелка или реплика, мини-событие, перестановка, вечер.
   */
  private momentBlocked(): boolean {
    return (
      !this.running ||
      this.night ||
      this.arranging ||
      Boolean(this.call) ||
      Boolean(this.liveEvent) ||
      (this.hallCoach && this.coach.pointing) ||
      this.say.visible ||
      modalOpen()
    );
  }

  /** Гость в зале, не в очереди и не у кассы (постоянный — первым): ему махать и за ним звёздочка. */
  private momentGuest(): Phaser.GameObjects.Container | null {
    const { wallH, h, w } = this.layout;
    const busy = new Set<Customer>([...this.queue, ...this.registers.map((r) => r.customer).filter((c): c is Customer => Boolean(c))]);
    const free = [...this.customers].filter(
      (c) => !c.gone && !c.thief && !busy.has(c) && c.sprite.active && c.sprite.visible && c.sprite.x > 12 && c.sprite.x < w - 12 && c.sprite.y > wallH + 12 && c.sprite.y < h - 8,
    );
    return (free.find((c) => c.regular) ?? free[0])?.sprite ?? null;
  }

  /** Поймали момент: чаевые в кассу сразу, искорка к рейтингу — вечером (day.ts), лёгкая вибрация. */
  private momentCaught(kind: MomentKind): string {
    const gain = momentGain(kind, this.state.level);
    noteMoment(this.stats, true, gain.star);
    if (gain.money) this.state = { ...this.state, money: Math.max(0, this.state.money + gain.money) };
    if (gain.money > 0) sound.coin();
    else sound.good();
    haptic.tap();
    return t(`moment.${kind}Got` as TextKey, { n: Math.abs(gain.money) });
  }

  /** Начало мини-события дня. */
  /** Прошлое мини-событие ещё не кончилось — подождать; к вечеру уже не начинать. */
  private tryLiveEvent(kind: LiveKind): void {
    if (!this.running || this.night || this.timeLeft < DAY_SECONDS * LIVE_LATEST) return;
    if (this.liveEvent) this.time.delayedCall(LIVE_RETRY_MS, () => this.tryLiveEvent(kind));
    else this.startLiveEvent(kind);
  }

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
    if (this.seller?.active) effects.emote(this, this.seller, 'emo_alert');
    if (kind === 'leak') this.startLeak(keep);
    if (kind === 'pigeon') this.pigeonInside(keep);
    if (kind === 'courier') void this.courierVisit(keep);
    if (kind === 'mouse') pets.mouseInWarehouse(this, keep);
  }

  endLiveEvent(): void {
    for (const obj of this.liveObjs) discard(obj);
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
    effects.emote(this, this.seller, 'emo_alert');
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
  freeFloorPoint(): { x: number; y: number } {
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
            effects.emote(this, c.sprite, 'emo_angry');
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
    await this.walkVia(courier, [
      { x: door.x, y: this.streetY },
      { x: door.x - 10, y: door.y - 14 },
    ]);
    if (!courier.active) return;
    let taken = false;
    const leave = async (left: boolean) => {
      if (!courier.active) return;
      this.liveEvent = null;
      courier.disableInteractive();
      if (left) this.popup(courier.x, courier.y - 18, t('live.courierLeft'), '#ffd0d0');
      await this.walkVia(courier, [
        { x: door.x, y: this.streetY },
        { x: door.x - 80, y: this.streetY },
      ]);
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
              sound.coin(courier.x);
              this.popup(courier.x, courier.y - 18, t('live.courierGift', { n: gift }), '#c8ffb0');
              effects.flyCoins(this, courier.x, courier.y, 3);
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
    const road = this.onRoad(van, 'up', true);
    await this.yieldToLot(road);
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
    // Катит тележку быстрым шагом, но не вприпрыжку: тележка не скачет по асфальту.
    driver.setData('wheels', true);
    // С тротуара по подъезду к воротам склада во флигеле.
    const route = [
      { x: shutterX, y: this.streetY + 4 },
      { x: shutterX, y: back },
    ];
    const trips = Math.min(this.awaitingBoxes, 4);
    for (let trip = 0; trip < trips && driver.active; trip++) {
      box.setVisible(true);
      await this.walkVia(driver, route, SELLER_SPEED);
      if (!driver.active) return;
      await this.wait(300);
      box.setVisible(false);
      // Каждый рейс открывает свою долю коробок (на последнем — все оставшиеся).
      this.awaitingBoxes = trip === trips - 1 ? 0 : Math.max(0, this.awaitingBoxes - Math.ceil(this.awaitingBoxes / (trips - trip)));
      this.refreshWarehouse();
      // Коробка легла на склад — картонный стук, каждая следующая чуть выше.
      sound.place('box', trip, driver.x);
      if (trip < trips - 1) await this.walkVia(driver, [...route].reverse(), SELLER_SPEED);
    }
    await this.walkVia(driver, [...[...route].reverse(), { x: vanX, y: this.streetY + 10 }], SELLER_SPEED);
    driver.destroy();
    if (!van.active) return;
    // Двери закрываются — и в путь.
    cargo.destroy();
    this.tweens.add({ targets: hold, width: 0.1, x: hold.x + 1, duration: 250 });
    await this.wait(300);
    if (!van.active) return;
    await this.yieldToLot(road, true);
    this.tweens.add({ targets: van, x: this.next.w + 300, duration: 2600, ease: 'Sine.easeIn', onComplete: () => van.destroy() });
  }

  /**
   * Реклама видна на улице, пока работает: баннер на фасаде, промоутер с листовками, блогер у входа,
   * билборд за дорогой, съёмочная группа ТВ, блогер-звезда с фанатами, флажки городской кампании.
   * Радио в эфире — его не видно. Работает несколько реклам — видны все.
   */
  private applyAds(): void {
    for (const obj of this.adObjs) discard(obj);
    this.adObjs = [];
    const ads = new Set(activeAds(this.state).map((a) => a.id));
    if (!ads.size) return;
    const { door, h, w } = this.layout;
    const top = this.streetY - 12;
    const keep = <T extends { destroy: () => void }>(obj: T): T => {
      this.adObjs.push(obj);
      return obj;
    };
    /** Бесконечный твин рекламы: при смене реклам без пересборки мира его надо остановить (stop снимает его с менеджера). */
    const keepTween = (tween: Phaser.Tweens.Tween) => keep({ destroy: () => void tween.stop() });
    /** Стоит у входа и не участвует в жизни покупателей. */
    const extra = (x: number, y: number, look: Look, facing: Facing) => {
      const person = keep(this.makePerson(x, y, look));
      this.people.delete(person);
      this.setFacing(person, facing);
      return person;
    };
    /** Блёстки вокруг человека (не в лёгком режиме). */
    const sparkle = (target: Phaser.GameObjects.Container, frequency: number) => {
      if (this.lite) return;
      const sparkles = keep(
        this.add.particles(0, 0, 'spark', {
          lifespan: 700,
          speed: { min: 4, max: 14 },
          scale: { start: 0.5, end: 0 },
          alpha: { start: 1, end: 0 },
          frequency,
          x: { min: -8, max: 8 },
          y: { min: -16, max: 2 },
        }),
      );
      sparkles.startFollow(target).setDepth(LIGHT_DEPTH - 1);
    };
    if (ads.has('banner')) {
      const banner = keep(this.art(door.x - 44, h + 4, 'ad_banner').setDepth(h + 44));
      keepTween(this.tweens.add({ targets: banner, angle: { from: -1.5, to: 1.5 }, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    }
    if (ads.has('city')) {
      // Городская кампания: флажки во всю ширину фасада.
      keep(this.add.tileSprite(0, h + 1, w, 5, 'ad_flags').setOrigin(0).setTileScale(1 / ART).setDepth(h + 43));
    }
    if (ads.has('billboard') || ads.has('city')) {
      // Билборд за дорогой, на дальнем тротуаре справа от перехода: его видно из магазина.
      const base = top + 87;
      keep(this.art(door.x + 70, base, 'ad_billboard').setOrigin(0.5, 1).setDepth(base));
    }
    if (ads.has('flyers') || ads.has('city')) {
      // Промоутер в жёлтом жилете раздаёт листовки прохожим.
      const spot = { x: door.x + 24, y: this.streetY - 3 };
      extra(spot.x, spot.y, { ...randomLook(0xfee761), acc: 'vest', accTint: 0xfee761 }, 'down');
      keep(
        this.time.addEvent({
          delay: 2200,
          loop: true,
          callback: () => {
            // Только на своём тротуаре: покупатели филиала за дорогой листовку не ловят.
            const target = [...this.people].find((p) => p.active && Math.abs(p.x - spot.x) < 50 && p.y > this.layout.h + FACADE_H && p.y < this.streetY + 40);
            if (!target) return;
            const flyer = this.art(spot.x, spot.y - 4, 'flyer').setDepth(spot.y + 20);
            this.tweens.add({ targets: flyer, x: target.x, y: target.y - 4, angle: 180, duration: 450, onComplete: () => flyer.destroy() });
          },
        }),
      );
    }
    // У входа свои места: курьер с велосипедом (доставка) и летом тележка с мороженым — реклама их
    // обходит; съёмочная группа и блогер с фанатами друг на друга тоже не встают.
    const taken: StreetSpan[] = [
      ...(hasUpgrade(this.state, 'delivery') ? [COURIER_SPAN] : []),
      ...(yearTime(this.state.day) === 'summer' ? [ICE_CART_SPAN] : []),
    ];
    const tvX = freeStreetX(TV_SPOTS, TV_SPAN, taken);
    if (ads.has('tv')) taken.push([tvX + TV_SPAN[0], tvX + TV_SPAN[1]]);
    const starSpan: StreetSpan = ads.has('collab') ? COLLAB_SPAN : BLOGGER_SPAN;
    const star = { x: door.x + freeStreetX(STAR_SPOTS, starSpan, taken), y: h + FACADE_H + 8 };
    if (ads.has('collab')) {
      // Звезда соцсетей снимает обзор у входа, вокруг — фанаты с телефонами.
      const blogger = extra(star.x, star.y, { shirt: 0xb55088, pants: 0x262b44, hair: 0xfee761, style: 'long', skin: 0xf2d3ab }, 'up');
      sparkle(blogger, 140);
      [-14, 12, -4].forEach((dx, i) => {
        const fan = extra(star.x + dx, star.y + 8 + (i % 2) * 3, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), this.state.day), dx < 0 ? 'right' : 'left');
        if (this.lite) return;
        // Фанаты подпрыгивают от восторга.
        keepTween(this.tweens.add({ targets: fan, y: fan.y - 2, duration: 260, yoyo: true, repeat: -1, repeatDelay: 900 + i * 370, ease: 'Sine.easeOut' }));
      });
    } else if (ads.has('blogger')) {
      // Блогер снимает обзор у входа: блёстки вокруг.
      const blogger = extra(star.x, star.y, { shirt: 0xf6757a, pants: 0x262b44, hair: 0xb55088, style: 'long', skin: 0xf2d3ab }, 'up');
      sparkle(blogger, 220);
    }
    if (ads.has('tv')) {
      // Съёмочная группа ТВ: камера на штативе и ведущая с микрофоном у витрины.
      const x = door.x + tvX;
      const y = h + FACADE_H + 12;
      keep(this.art(x + 12, y, 'film_camera').setDepth(y + 6));
      extra(x + 20, y + 1, { shirt: 0x3a4466, pants: 0x262b44, hair: 0x3b2a35, style: 'short', skin: 0xe4a672 }, 'left');
      extra(x, y - 2, { shirt: 0xe43b44, pants: 0x262b44, hair: 0x733e39, style: 'long', skin: 0xf2d3ab }, 'right');
    }
  }

  /** Нажатие засчитывается, только если палец не двигал камеру. */
  tap(action: () => void): void {
    if (!this.dragged) action();
  }

  /** Квартал можно рассмотреть, проведя пальцем; через несколько секунд камера возвращается к магазину. */
  private setupCameraDrag(): void {
    const cam = this.cameras.main;
    this.input.on('gameobjectup', (p: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => motion.tapFx(this, p, obj));
    // Новый жест — с первым пальцем. Второй палец (щипок, касания внахлёст, ладонь у края экрана)
    // жест не сбрасывает и сам его сдвигом не делает: сдвигом считается только движение пальцев.
    this.input.on('pointerdown', () => {
      if (!(this.input.pointer1.isDown && this.input.pointer2.isDown)) this.dragged = false;
      // Игрок здесь — подсказка «что дальше» гаснет.
      this.lastTouch = this.time.now;
      this.nudgeUntil = 0;
    });
    this.input.addPointer(1);
    // Пока пальцы двигаются, масштаб любой — плавно; отпустили — доходит до ближайшего ровного
    // (пиксель рисунка — целое число пикселей экрана), иначе картинка так и останется в ряби.
    let zoomed = false;
    const zoomTo = (z: number) => {
      cam.zoomEffect.reset();
      cam.setZoom(Phaser.Math.Clamp(z, this.baseZoom * 0.5, this.baseZoom * 2.2));
      zoomed = true;
    };
    const settle = () => {
      if (!zoomed) return;
      zoomed = false;
      const target = crispZoom(cam.zoom, ART, this.baseZoom * 0.5, this.baseZoom * 2.2);
      if (target && target !== cam.zoom) cam.zoomTo(target, 160, 'Sine.easeOut', true);
    };
    // Середина кадра под пальцем — без округления: камера рисуется с шагом в целую точку мира
    // (roundPixels), и медленный палец иначе терял бы сдвиг меньше точки — в одну сторону.
    let drag: { x: number; y: number } | null = null;
    // Колёсико на компьютере: ровный масштаб — когда колёсико затихло.
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (this.arranging) return;
      zoomTo(cam.zoom * (dy > 0 ? 0.9 : 1.1));
      this.wheelTimer?.remove();
      this.wheelTimer = this.time.delayedCall(200, settle);
      this.scheduleHome();
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      // Пока переставляют полки, палец двигает полку, а не камеру.
      if (this.arranging) return;
      const a = this.input.pointer1;
      const b = this.input.pointer2;
      // Палец сдвинулся — каждый считается от того места, где коснулся.
      const slop = 12 * this.res;
      if (a.isDown && b.isDown) {
        // Оба пальца почти на месте — это ещё не щипок (два касания внахлёст), касание засчитается.
        if (!this.dragged && a.getDistance() < slop && b.getDistance() < slop) return;
        // Два пальца: приближаем или отдаляем.
        const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        this.pinch ??= { dist, zoom: cam.zoom };
        zoomTo(this.pinch.zoom * (dist / this.pinch.dist));
        this.dragged = true;
        this.homeTimer?.remove();
        drag = null;
        return;
      }
      this.pinch = null;
      if (!p.isDown) return;
      if (!this.dragged && p.getDistance() < slop) return;
      this.dragged = true;
      this.homeTimer?.remove();
      // Камера могла лететь домой — палец её перехватывает.
      if (!drag || cam.panEffect.isRunning) {
        cam.panEffect.reset();
        drag = { x: cam.midPoint.x, y: cam.midPoint.y };
      }
      drag.x = Phaser.Math.Clamp(drag.x - (p.x - p.prevPosition.x) / cam.zoom, -CAMERA_REACH, this.next.w + CAMERA_REACH);
      drag.y = Phaser.Math.Clamp(drag.y - (p.y - p.prevPosition.y) / cam.zoom, -CAMERA_REACH / 2, this.next.h + CAMERA_REACH / 2);
      cam.centerOn(drag.x, drag.y);
    });
    this.input.on('pointerup', () => {
      this.pinch = null;
      drag = null;
      settle();
      if (this.dragged) this.scheduleHome();
    });
    // Холст сменил размер (полный экран Telegram, поворот, окно на компьютере) — кадр под новый холст.
    // Масштабом холста ведает игра, а не сцена: подписка снимается вместе со сценой.
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this));
  }

  /**
   * Касание улицы под магазином (участок перед входом, тротуары, дорога и дальше — туда, куда
   * достаёт большой палец) — то же, что касание кассы: пробить того, кто ждёт у кассы хозяина, или
   * позвать хозяина с дела. Считается только короткое касание без сдвига камеры и мимо всего, что
   * нажимается само (вор, курьер, Бобик, голуби, мусор), — у тех своё. Отклик — круг под пальцем,
   * кивок кассы и лёгкая вибрация.
   */
  private setupStreetTap(): void {
    this.input.on('pointerup', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length || this.dragged || this.arranging || !this.running || p.upTime - p.downTime > STREET_TAP_MS) return;
      const at = this.cameras.main.getWorldPoint(p.x, p.y);
      if (at.y < this.layout.h + FACADE_H) return;
      // За кассой хозяина сменщик: касание улицы торопит его, пока он пробивает.
      const first = this.registers[0];
      if (this.operator(0) !== 'owner') {
        if (!first?.scan || first.scan.byOwner) return;
        motion.ripple(this, at.x, at.y);
        void this.serveNext();
        return;
      }
      // Касание ничего не изменит (у кассы никого, хозяин уже пробивает) — и отклика нет.
      const r = this.ownerRegister();
      if (!r || this.ownerScanning() || (!this.sellerBusy && !this.atSpot(r))) return;
      motion.ripple(this, at.x, at.y);
      if (r.img) motion.squash(this, r.img, 1.06, 0.9, 80);
      if (!this.sellerBusy) this.serves.street++;
      void this.serveNext();
    });
  }

  /**
   * Бабушка показывает касание улицы: на дороге под её словами прыгает стрелка и расходятся круги,
   * как от пальца. Точка — в кадре, даже если дорога ниже края экрана (тогда — на участке у входа).
   */
  private showStreetTap(): void {
    const view = this.cameras.main.worldView;
    const x = Phaser.Math.Clamp(this.layout.door.x + 34, view.x + 24, view.right - 24);
    const y = Phaser.Math.Clamp(this.streetY + 32, this.layout.h + FACADE_H + 14, view.bottom - 28);
    const arrow = this.art(x, y - 12, 'arrow').setScale(1.3 / ART).setDepth(LIGHT_DEPTH + 20);
    if (!this.lite) this.tweens.add({ targets: arrow, y: y - 16, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.time.delayedCall(ONB_ROAD_MS - 400, () => arrow.destroy());
    const rings = this.lite ? 1 : 3;
    for (let i = 0; i < rings; i++)
      this.time.delayedCall(300 + i * 800, () => {
        if (!this.running) return;
        const ring = this.add.circle(x, y, 5).setStrokeStyle(1.5, 0xffffff, 0.95).setDepth(LIGHT_DEPTH + 50);
        this.tweens.add({ targets: ring, scale: 3.6, alpha: 0, duration: 650, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
      });
  }

  /**
   * Холст сменил размер. Камера стояла в обычном кадре или летела к нему — ставим новый обычный кадр
   * (масштаб ровный под новый холст); показывала своё (заставку, перестановку, осмотр) — та же середина.
   */
  private onResize(size: Phaser.Structs.Size, _base: Phaser.Structs.Size, _display: Phaser.Structs.Size, prevW: number, prevH: number): void {
    if (size.width === prevW && size.height === prevH) return;
    const cam = this.cameras.main;
    const mid = { x: cam.midPoint.x, y: cam.midPoint.y };
    const atHome = cam.zoom === this.baseZoom && Math.abs(mid.x - this.home.x) <= 1 && Math.abs(mid.y - this.home.y) <= 1;
    const flying = cam.panEffect.isRunning || cam.zoomEffect.isRunning;
    this.frameCamera();
    if (this.arranging || !(atHome || flying)) {
      cam.centerOn(mid.x, mid.y);
      return;
    }
    cam.panEffect.reset();
    cam.zoomEffect.reset();
    cam.setZoom(this.baseZoom).centerOn(this.home.x, this.home.y);
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
    this.builtClean = this.cleanKey();
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
      { x: next.w + SIDE_SHOP_X, w: SIDE_SHOP_W, ...side },
      { x: next.w + 170, w: 110, h: 120, name: 'neighbor.bakery', sign: 0xb55088, awning: 0xf6757a, roof: 0xf2d0dc, neon: 0xff8ad8 },
    ];
    const rnd = new Phaser.Math.RandomDataGenerator(['neighbors']);
    for (const n of neighbors) this.drawNeighbor(n, base - (n.back ?? 0), rnd);
    // Остановка на тротуаре слева.
    // Купили остановку с навесом (hood.ts) — вместо столбика со скамейкой.
    if (hasHood(this.state, 'bus')) this.art(-70 - WING_OUTER, this.streetY - 2, 'hood_bus').setOrigin(0.5, 0.75).setDepth(this.streetY);
    else this.art(-70 - WING_OUTER, this.streetY - 4, 'bus_stop').setDepth(this.streetY);
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
    this.add.tileSprite(n.x, front - FACADE_H, n.w, FACADE_H, this.potTile('facade')).setOrigin(0).setTileScale(1 / ART).setDepth(front - 5);
    this.dressRoof(n, roofY, n.h - FACADE_H, across, rnd);
    // Витрины, дверь и навес.
    const doorX = across ? n.x + n.w / 2 : n.x + n.w * 0.62;
    this.art(doorX, front - 5, 'door').setDepth(front - 4);
    for (let x = n.x + 14; x < n.x + n.w - 10; x += 24) {
      if (Math.abs(x - doorX) < 22) continue;
      const win = this.art(x, front - 4.5, 'shopwin').setDepth(front - 4);
      // Пустующее помещение — тёмные витрины без света.
      if (n.dark) win.setTint(0x8b9bb4);
      else lighting.windowLight(this, x, front - 4.5, across ? top : front, across, rnd.frac() * 0.5);
    }
    // Новые фасады (hood.ts): под окнами — ящики с цветами, вдоль фасада — флажки. Пустующему — нет.
    if (!n.dark && hasHood(this.state, 'facades')) {
      for (let x = n.x + 14; x < n.x + n.w - 10; x += 24) if (Math.abs(x - doorX) >= 22) this.art(x, front - 0.5, 'hood_flowerbox').setDepth(front - 3.9);
      const colors = [0xfee761, 0xe43b44, 0x63c74d, 0x0099db];
      // Флажки одной фигурой на дом — не десятки отдельных треугольников.
      const flags = this.add.graphics().setDepth(front - 3.8);
      for (let i = 0, fx = n.x + 2; fx <= n.x + n.w - 6; fx += 7, i++) flags.fillStyle(colors[i % colors.length], 1).fillTriangle(fx, front - FACADE_H, fx + 4, front - FACADE_H, fx + 2, front - FACADE_H + 3.5);
    }
    this.awnings.push(this.art(doorX, front - 9, 'awning').setScale(1 / ART, 0.6 / ART).setTint(n.awning).setDepth(front + 40));
    // Вывеска на краю крыши (за дорогой — над витринами, у самой дороги).
    const signY = across ? top - 12 : bottom - FACADE_H - 8;
    if (across) this.signsAcross.push(n.x + n.w / 2);
    const signDepth = across ? front + 41 : front - 3;
    this.art(n.x + n.w / 2, signY, 'sign').setTint(n.sign).setDepth(signDepth);
    this.add
      .text(n.x + n.w / 2, signY, n.label ?? t(n.name), { fontFamily: UI_FONT, fontSize: '6px', color: '#fee761' })
      .setOrigin(0.5)
      .setResolution(this.textRes(4))
      .setDepth(signDepth + 1);
    if (n.neon) lighting.neonSign(this, n.x + n.w / 2, signY, n.label ?? t(n.name), '6px', n.neon, 64);
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
      if (key === 'skylight') lighting.nightGlow(this, this.art(px, py, 'glow').setDisplaySize(26, 20).setTint(0xffd890), 0.7);
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
      this.awnings.push(this.art(tx, ty - 3, 'umbrella').setDepth(ty + 30));
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
    this.signsAcross = [];
    const tile = (x: number, y: number, w: number, hh: number, key: string) =>
      this.add.tileSprite(x, y, w, hh, key).setOrigin(0).setTileScale(1 / ART).setDepth(-10);
    const left = -400;
    const width = next.w + 800;
    const top = next.h + 4;
    // Газон с запасом за краями квартала: когда отдаляешь камеру, мир не обрывается в темноту.
    // Плитки травы вразнобой и с отражениями (floor.ts) — повтора не видно, поверх — большие мягкие
    // пятна светлой и тёмной травы. Один газон на всё: дорожки и дома ложатся сверху. В лёгкой
    // графике — прежний газон одной плиткой, без пятен.
    const lawn = { x: left - 400, y: -800, w: width + 800, h: top + 1600 };
    tile(lawn.x, lawn.y, lawn.w, lawn.h, this.lite ? 'grass' : lawnTexture(this));
    if (!this.lite) lawnShade(this, lawn, -10);
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
    tile(left, top, width, 22, 'paving');
    this.add.rectangle(left, top + 22, width, 2, 0x8b9bb4).setOrigin(0).setDepth(-9);
    tile(left, top + 24, width, 40, 'asphalt');
    for (let x = left; x < left + width; x += 24) this.add.rectangle(x, top + 43.5, 12, 1.5, 0xe6e1d6).setOrigin(0).setDepth(-9);
    // Дорога живая: люки, заплаты и трещины (не на переходе).
    const road = this.add.graphics().setDepth(-9.05);
    const roadRnd = new Phaser.Math.RandomDataGenerator(['road']);
    for (let x = left + 30; x < left + width - 30; x += roadRnd.between(60, 110)) {
      if (Math.abs(x - door.x) < 22) continue;
      const ry = top + 24 + roadRnd.between(6, 34);
      const roll = roadRnd.frac();
      if (roll < 0.3) {
        road.fillStyle(0x5a6988, 1).fillCircle(x, ry, 3.2);
        road.lineStyle(0.7, 0x8b9bb4, 1).strokeCircle(x, ry, 3.2);
        road.lineStyle(0.5, 0x3a4466, 1).lineBetween(x - 2, ry, x + 2, ry).lineBetween(x, ry - 2, x, ry + 2);
      } else if (roll < 0.6) {
        road.fillStyle(0x4a4f66, 0.55).fillRect(x, ry - 3, roadRnd.between(8, 16), roadRnd.between(4, 7));
      } else {
        road.lineStyle(0.7, 0x0b0c16, 1);
        let cx = x;
        let cy = ry;
        for (let k = 0; k < 4; k++) {
          const nx = cx + roadRnd.between(2, 5);
          const ny = cy + roadRnd.between(-2, 2);
          road.lineBetween(cx, cy, nx, ny);
          cx = nx;
          cy = ny;
        }
      }
    }
    this.add.rectangle(left, top + 64, width, 2, 0x8b9bb4).setOrigin(0).setDepth(-9);
    tile(left, top + 66, width, 22, 'paving');
    // Дорожка от двери до тротуара через пустой участок.
    if (top > h + FACADE_H) tile(door.x - 12, h + FACADE_H, 24, top - h - FACADE_H, 'paving');
    // Пешеходный переход напротив входа.
    for (let y = top + 26; y < top + 62; y += 5) this.add.rectangle(door.x - 9, y, 18, 2.5, 0xe6e1d6).setOrigin(0).setDepth(-9);

    // Фонари вдоль тротуара (не на дорожке), скамейка и урна у входа.
    for (let x = -100; x < next.w + 40; x += 72) {
      if (lighting.lampAt(this, x)) this.art(x, top + 3, 'lamp').setOrigin(0.5, 0.95).setDepth(top + 3);
    }
    this.art(door.x + 44, top + 7, 'bench').setDepth(top + 7);
    this.art(door.x - 32, top + 6, 'bin').setDepth(top + 6);
    // Деревья и кусты на газоне вокруг здания.
    // Справа от зала — проезд к парковке и дорожка вдоль стены (buildParking): деревьев там нет.
    const trees: [number, number][] = [
      [-14 - WING_OUTER, next.h * 0.35],
      [-16 - WING_OUTER, next.h * 0.8],
      [next.w * 0.25, -12],
      [next.w * 0.75, -16],
    ];
    this.greenery = [];
    // Что качает ветер (windGust): деревья отсюда и с парковки, навесы соседей (drawNeighbor) и зонтики веранды.
    this.windTrees = [];
    this.awnings = [];
    // Пересборка убила твин порыва (killAll не зовёт onComplete) — новые деревья не должны застыть в наклоне.
    this.gust = { t: 0, x: 0, on: false };
    // Дерево с тенью на газоне: свет сверху слева — тень ложится вправо-вниз от ствола.
    // Летом в ясный день тень кроны пятнистая и чуть колышется на ветру.
    const dapple = !this.lite && yearTime(this.state.day) === 'summer' && !isWet(weatherFor(this.state.day));
    const plant = (key: string, x: number, y: number, depth: number) => {
      this.add.image(x + 5, y + 1, 'shadow').setScale(2.1 / ART, 1.5 / ART).setAlpha(0.75).setDepth(depth - 0.01);
      const tree = this.art(x, y, key).setOrigin(0.5, 0.9).setDepth(depth);
      this.greenery.push(tree);
      this.windTrees.push(tree);
      if (!dapple || key !== 'tree') return;
      const spots = [-7, -2, 4, 9].map((dx, i) =>
        this.add.image(dx, (i % 2 ? 3 : -2) + Phaser.Math.Between(-1, 1), 'glow').setDisplaySize(Phaser.Math.Between(6, 9), 4).setTint(0x181425).setAlpha(0.22),
      );
      const leaves = this.add.container(x + 5, y + 1, spots).setDepth(depth - 0.009);
      this.tweens.add({ targets: leaves, x: x + 6.5, duration: Phaser.Math.Between(1700, 2600), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    };
    for (const [x, y] of trees) plant('tree', x, y, y);
    for (let x = 10; x < next.w; x += 34) this.greenery.push(this.art(x, -6, 'bush').setDepth(-6));
    // Сквер за кварталом и за дорогой: деревья, кусты и клумбы — газон не пустует, когда отдаляешь камеру.
    const rnd = new Phaser.Math.RandomDataGenerator(['park']);
    // «Гигант» за дорогой: напротив входа, на месте сквера (giant.ts).
    const giant = giantLook(this.state);
    this.builtGiant = giant;
    const giantArea = { x: door.x - 82, y: top + 86, w: 164, h: 112 };
    // Босс района (eduard.ts) — за дорогой напротив входа, когда «Гиганта» там нет или он закрылся.
    const look = eduardLook(this.state);
    // Купили здание под филиал (branch.ts) — босс района возвращается на своё место сбоку, рядом с магазином.
    this.builtBranch = branchLook(this.state);
    this.rivalAcross = !this.builtBranch && look !== 'vacant' && look !== 'mega' && (giant === 'none' || giant === 'closed');
    if (this.builtBranch && branchInOldShop(this.state)) {
      this.buildOldBranch(door.x, top + 92);
    } else if (this.builtBranch) {
      this.buildBranch(door.x, top + 92);
    } else if (this.rivalAcross) {
      const rival = RIVAL_LOOKS[look];
      const h = Math.min(rival.h, RIVAL_ACROSS_H);
      this.drawNeighbor({ ...rival, x: door.x - 64, w: 128, h }, top + 92 + h, new Phaser.Math.RandomDataGenerator(['rival']), true);
    } else if (giant !== 'none') {
      const key = giant === 'site' ? 'giant_site' : giant === 'store' ? 'giant_store' : 'giant_closed';
      this.art(door.x, top + 92, key).setOrigin(0.5, 0).setDepth(top + 92 + 88);
    }
    // Здания района (district.ts): стройки и готовые — на газоне за дорогой и за магазином.
    const districtAreas = [...this.buildDistrict(next, top), ...this.buildPark(next, top), ...this.buildParking(next, top), ...this.buildHood(next, top)];
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
          if (roll < 0.34) plant(rnd.pick(PARK_TREES), px, py, depth);
          else if (roll < 0.52) this.greenery.push(this.art(px, py, rnd.frac() < 0.3 ? 'bush_flower' : 'bush').setDepth(depth));
          else if (roll < 0.62) this.greenery.push(this.art(px, py, rnd.frac() < 0.5 ? 'flower' : 'tulips').setDepth(depth));
        }
      }
    };
    scatter(-380, Math.min(-40, top - 230));
    scatter(top + 104, top + 470);
    this.buildAmbient(next, top, left, width);
    // Газон слева и справа от магазина: полосы стриженой травы, кусты и клумбы — не пустое поле.
    const sides = [
      { x0: left + 10, x1: -WING_OUTER - 28 },
      { x0: next.w + SIDE_SHOP_X, x1: left + width - 10 },
    ];
    for (const { x0, x1 } of sides) {
      if (x1 - x0 < 20) continue;
      for (let y = -36; y < top - 160 - VERANDA_D; y += 16) {
        if ((y / 16) % 2) this.add.rectangle(x0 - 10, y, x1 - x0 + 20, 8, 0x3e8948, 0.07).setOrigin(0).setDepth(-9.6);
      }
      // Ниже — соседние дома вдоль улицы (buildNeighbors): самый высокий с верандой — до 150 + VERANDA_D.
      for (let y = 6; y < top - 162 - VERANDA_D; y += 34) {
        for (let x = x0; x < x1; x += 38) {
          const px = x + rnd.between(-10, 10);
          const py = y + rnd.between(-8, 8);
          if (districtAreas.some((a) => inArea(px, py, a)) || trees.some(([tx, ty]) => Math.abs(tx - px) < 22 && Math.abs(ty - py) < 26)) continue;
          const roll = rnd.frac();
          if (roll < 0.22) plant(rnd.pick(PARK_TREES), px, py, py);
          else if (roll < 0.45) this.greenery.push(this.art(px, py, rnd.frac() < 0.4 ? 'bush_flower' : 'bush').setDepth(py));
          else if (roll < 0.62) this.greenery.push(this.art(px, py, rnd.frac() < 0.5 ? 'flower' : 'tulips').setDepth(py));
        }
      }
    }
    // Парк за аллеей гуще — второй проход (деревья не встают на пруд, клумбы и дорожку).
    scatter(top + 290, top + 470);
  }

  /**
   * Свой филиал в здании «Гиганта» (branch.ts): здание после ремонта, на вывесках — название магазина
   * с «№2» и «Филиал». Вечером горят витрины и неон (и в карте освещения), днём заходят и выходят
   * покупатели (пока магазин открыт) — по одному-два, без лишней нагрузки; в лёгкой графике двое просто стоят у входа.
   * Чем больше улучшений, тем наряднее: ремонт — цветы и фонари у входа, реклама — флажки на крыше.
   */
  private buildBranch(x: number, y: number): void {
    const depth = y + 88;
    this.art(x, y, 'giant_branch').setOrigin(0.5, 0).setDepth(depth);
    // Вывеска на крыше: своё название с «№2» — во всю доску, длинное сжимаем.
    const name = branchSignName(this.state, t('branch.defaultName'));
    const signY = y + 11.5;
    const sign = this.add.text(x, signY, name, { fontFamily: UI_FONT, fontSize: '9px', color: '#fee761' }).setOrigin(0.5).setResolution(this.textRes(4)).setDepth(depth + 1);
    const fit = Math.min(1, 86 / Math.max(1, sign.width));
    sign.setScale(fit);
    lighting.neonSign(this, x, signY, name, `${Math.max(4, Math.floor(9 * fit))}px`, 0xfee761, 90);
    const label = t('branch.label');
    this.add.text(x, y + 42.5, label, { fontFamily: UI_FONT, fontSize: '6px', color: '#ffffff' }).setOrigin(0.5).setResolution(this.textRes(4)).setDepth(depth + 1);
    lighting.neonSign(this, x, y + 42.5, label, '6px', 0x7cff8a, 46);
    // Витрины вечером светятся тёплым, свет ложится на тротуар перед зданием.
    const glassY = y + 67.5;
    for (const dx of [-63, -50, -37, -24, 23, 36, 49, 62]) {
      lighting.nightGlow(this, this.add.rectangle(x + dx, glassY, 10, 15, 0xffd890), 0.45, undefined, { from: Math.random() * 0.4 });
      const spill = this.art(x + dx, y + 84, 'light_spill').setOrigin(0.5, 0).setTint(0xffd08a).setScale(0.7 / ART);
      lighting.nightGlow(this, spill, 0.5, undefined, { map: { scale: 0.9, gain: 1.2, haze: 0.1 } });
    }
    // Стеклянный вход — самый яркий: свет из зала на крыльцо.
    const entry = this.art(x, y + 86, 'glow').setDisplaySize(40, 18).setTint(0xffe6b0);
    lighting.nightGlow(this, entry, 0.5, undefined, { map: { key: 'light_pool', scale: 1.6, gain: 1.4, haze: 0.15 } });
    // Ремонт: цветы в кадках у входа, потом фонари по бокам.
    const repair = branchTier(this.state, 'repair');
    if (repair >= 1) for (const dx of [-30, 30]) this.art(x + dx, y + 88, 'tulips').setOrigin(0.5, 1).setDepth(depth + 0.5);
    if (repair >= 3) {
      for (const dx of [-44, 44]) {
        this.add.rectangle(x + dx, y + 80, 1, 8, 0x262b44).setDepth(depth + 1);
        this.add.circle(x + dx, y + 75, 1.6, 0xfff0c0).setDepth(depth + 1);
        lighting.nightGlow(this, this.art(x + dx, y + 75, 'glow').setDisplaySize(14, 12).setTint(0xffd890), 0.8, undefined, { map: { key: 'light_pool', scale: 1.4, gain: 1.2 } });
      }
    }
    // Реклама: флажки вдоль края крыши.
    if (branchTier(this.state, 'ads') >= 2) {
      const colors = [0xfee761, 0xe43b44, 0x63c74d, 0xffffff];
      for (let i = 0, fx = x - 68; fx <= x + 68; fx += 8, i++) this.add.triangle(fx, y + 2, 0, 0, 4, 0, 2, 4, colors[i % colors.length]).setOrigin(0).setDepth(depth + 1);
    }
    this.branchShoppers(x, y + 88, depth);
  }

  /**
   * Филиал после переезда в гипермаркет: за дорогой — старый магазин, маленький кирпичный дом. На доске
   * своё название с «№2», над дверью — «Филиал». Вечером светятся витрины и окошко двери, днём заходят
   * покупатели (в лёгкой графике двое стоят у входа). Ремонт — цветы и фонари, реклама — флажки, как у
   * филиала в здании «Гиганта»: купленные ступени видны и здесь.
   */
  private buildOldBranch(x: number, y: number): void {
    const depth = y + 72;
    this.art(x, y, 'branch_old').setOrigin(0.5, 0).setDepth(depth);
    const name = branchSignName(this.state, t('branch.defaultName'));
    const signY = y + 12;
    const sign = this.add.text(x, signY, name, { fontFamily: UI_FONT, fontSize: '8px', color: '#fee761' }).setOrigin(0.5).setResolution(this.textRes(4)).setDepth(depth + 1);
    const fit = Math.min(1, 64 / Math.max(1, sign.width));
    sign.setScale(fit);
    lighting.neonSign(this, x, signY, name, `${Math.max(4, Math.floor(8 * fit))}px`, 0xfee761, 68);
    const label = t('branch.label');
    this.add.text(x, y + 37, label, { fontFamily: UI_FONT, fontSize: '4px', color: '#3b2a35' }).setOrigin(0.5).setResolution(this.textRes(6)).setDepth(depth + 1);
    // Витрины и окошко двери вечером светятся, свет ложится на тротуар.
    for (const dx of [-29.5, 29.5]) {
      lighting.nightGlow(this, this.add.rectangle(x + dx, y + 52, 31, 22, 0xffd890), 0.4, undefined, { from: Math.random() * 0.4 });
      const spill = this.art(x + dx, y + 68, 'light_spill').setOrigin(0.5, 0).setTint(0xffd08a).setScale(0.9 / ART);
      lighting.nightGlow(this, spill, 0.5, undefined, { map: { scale: 0.9, gain: 1.2, haze: 0.1 } });
    }
    lighting.nightGlow(this, this.add.rectangle(x, y + 50, 10, 8, 0xffd890), 0.45);
    const entry = this.art(x, y + 70, 'glow').setDisplaySize(26, 14).setTint(0xffe6b0);
    lighting.nightGlow(this, entry, 0.5, undefined, { map: { key: 'light_pool', scale: 1.2, gain: 1.3, haze: 0.15 } });
    const repair = branchTier(this.state, 'repair');
    if (repair >= 1) for (const dx of [-24, 24]) this.art(x + dx, y + 72, 'tulips').setOrigin(0.5, 1).setDepth(depth + 0.5);
    if (repair >= 3) {
      for (const dx of [-34, 34]) {
        this.add.rectangle(x + dx, y + 64, 1, 8, 0x262b44).setDepth(depth + 1);
        this.add.circle(x + dx, y + 59, 1.6, 0xfff0c0).setDepth(depth + 1);
        lighting.nightGlow(this, this.art(x + dx, y + 59, 'glow').setDisplaySize(14, 12).setTint(0xffd890), 0.8, undefined, { map: { key: 'light_pool', scale: 1.4, gain: 1.2 } });
      }
    }
    if (branchTier(this.state, 'ads') >= 2) {
      const colors = [0xfee761, 0xe43b44, 0x63c74d, 0xffffff];
      for (let i = 0, fx = x - 48; fx <= x + 48; fx += 8, i++) this.add.triangle(fx, y + 3, 0, 0, 4, 0, 2, 4, colors[i % colors.length]).setOrigin(0).setDepth(depth + 1);
    }
    this.branchShoppers(x, y + 72, depth, 60);
  }

  /** Покупатели филиала: подходят к стеклянному входу и заходят, другие выходят и уходят по тротуару. */
  private branchShoppers(x: number, ground: number, depth: number, reach = 70): void {
    const walkY = ground + 6;
    const look = () => customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), this.state.day);
    if (this.lite) {
      // Лёгкая графика: двое стоят у входа — улица не пустая, а кадр не тратится.
      for (const dx of [-14, 12]) this.makePerson(x + dx, walkY, look()).setDepth(depth + 2);
      return;
    }
    const busy = { n: 0 };
    // Чем больше ступеней куплено, тем чаще заходят (но не больше трёх человек разом).
    const every = 7000 - Math.min(3000, branchUpgrades(this.state) * 250);
    this.worldTimer(every, () => {
      if (!this.running || this.night || busy.n >= 3 || !this.sys.isActive()) return;
      busy.n++;
      const side = Math.random() < 0.5 ? -1 : 1;
      const far = { x: x + side * Phaser.Math.Between(reach, reach + 25), y: walkY + Phaser.Math.Between(-1, 3) };
      const door = { x: x + Phaser.Math.Between(-4, 4), y: walkY - 3 };
      const coming = Math.random() < 0.55;
      const from = coming ? far : door;
      const to = coming ? door : far;
      const person = this.makePerson(from.x, from.y, look()).setDepth(depth + 2);
      if (!coming) person.setAlpha(0);
      if (!coming) this.tweens.add({ targets: person, alpha: 1, duration: 300 });
      void this.walk(person, to.x, to.y, this.ownPace(person, CUSTOMER_SPEED * 0.7)).then(() => {
        busy.n--;
        if (!coming) return person.destroy();
        // Зашёл внутрь: тает в дверях.
        this.tweens.add({ targets: person, alpha: 0, duration: 300, onComplete: () => person.destroy() });
      });
    });
  }

  /**
   * Живой воздух над кварталом: бабочки над газоном, тени облаков ползут по крышам и траве,
   * время от времени пролетает стая птиц. Всё дневное — к вечеру гаснет (updateLighting).
   * В лёгком режиме — ничего из этого.
   */
  private buildAmbient(next: Layout, top: number, left: number, width: number): void {
    this.dayLife = [];
    this.flockTimer?.remove();
    this.windTimer?.remove();
    this.windTimer = undefined;
    if (this.lite) return;
    // Погоду берём по дню: при сборке квартала this.weather ещё вчерашняя (applyWeather — позже).
    const weather = weatherFor(this.state.day);
    const sunny = weather === 'clear' || weather === 'heat' || weather === 'leaves';
    // Тени облаков: мягкие тёмные пятна медленно плывут через квартал.
    if (sunny) {
      for (let k = 0; k < 3; k++) {
        const y = -260 + k * 230;
        const cloud = this.add.image(left + k * 260, y, 'glow').setDisplaySize(240, 120).setTint(0x181425).setDepth(LIGHT_DEPTH - 3);
        this.dayLife.push({ obj: cloud, alpha: 0.16 });
        this.tweens.add({ targets: cloud, x: left + width + 200, duration: 110000 + k * 23000, repeat: -1, onRepeat: () => cloud.setX(left - 200) });
      }
    }
    // Бабочки над газоном у магазина: порхают и перелетают с места на место.
    if (weather === 'clear' || weather === 'heat') {
      const spots = [
        { x: -WING_OUTER - 40, y: 40 },
        { x: next.w + 40, y: 60 },
        { x: next.w + 70, y: -60 },
        { x: next.w / 2 - 70, y: -40 },
      ];
      const tints = [0xfee761, 0xf6757a, 0xffffff, 0x8fd3ff];
      spots.forEach((p, k) => {
        const fly = this.art(p.x, p.y, 'butterfly0').setTint(tints[k % tints.length]).setDepth(top + 5);
        this.dayLife.push({ obj: fly, alpha: 1 });
        // Взмахи крыльями — твином (его убирает пересборка мира, таймер бы копился).
        this.tweens.add({ targets: fly, scaleX: 0.35 / ART, duration: 130 + k * 15, yoyo: true, repeat: -1 });
        const hop = () => {
          if (!fly.active) return;
          this.tweens.add({
            targets: fly,
            x: p.x + Phaser.Math.Between(-28, 28),
            y: p.y + Phaser.Math.Between(-20, 20),
            duration: Phaser.Math.Between(1400, 2600),
            ease: 'Sine.easeInOut',
            onComplete: hop,
          });
        };
        hop();
      });
    }
    // Стая птиц клином пролетает над кварталом раз в полминуты-минуту.
    this.flockTimer = this.time.addEvent({
      delay: 38000,
      loop: true,
      callback: () => {
        if (this.night || !this.sys.isActive()) return;
        const y0 = Phaser.Math.Between(-300, top);
        const dir = Math.random() < 0.5 ? 1 : -1;
        const x0 = dir > 0 ? left - 60 : left + width + 60;
        for (let k = 0; k < 5; k++) {
          const bird = this.art(x0 - dir * Math.abs(k - 2) * 9, y0 + (k - 2) * 7, 'pigeon_fly').setScale(0.9 / ART).setTint(0x3a4466).setFlipX(dir < 0).setDepth(LIGHT_DEPTH - 2);
          this.tweens.add({ targets: bird, x: bird.x + dir * (width + 120), y: bird.y - 60, duration: 16000, onComplete: () => bird.destroy() });
          this.tweens.add({ targets: bird, scaleY: 0.6 / ART, duration: 220, yoyo: true, repeat: -1 });
        }
      },
    });
    // Ветер: раз в полминуты через квартал проходит порыв, в грозу — вдвое чаще. Погоду смотрим
    // в момент порыва: она меняется и без пересборки мира (утром, когда кончилась гроза).
    let ticks = 0;
    this.windTimer = this.time.addEvent({
      delay: 6000,
      loop: true,
      callback: () => {
        ticks++;
        if (ticks % (this.weather === 'storm' && !this.rainStopped ? 2 : 5) === 0) weatherFx.windGust(this);
      },
    });
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
    for (let x = -520, i = 0; x < next.w + 520; x += 96, i++) {
      this.art(x, alley + 2, 'lamp').setOrigin(0.5, 0.95).setDepth(alley + 2);
      // Вечером фонари аллеи светят, как уличные, и зажигаются так же — по одному.
      lighting.addLamp(this, x, alley - 20, 0.1 + i * 0.02, 0.5);
      this.art(x + 40, alley + 1, 'bench').setDepth(alley + 1);
    }
    // Пруд: берег, вода, блики, камыш и утки. Всё — над снегом на газоне (-9.5).
    const px = d + 90;
    const py = alley + 70;
    // Ночью в пруду отражаются луна и звёзды (поверх воды, мерцают).
    lighting.nightGlow(this, this.add.ellipse(px + 34, py - 8, 16, 7, 0xf4f8ff), 0.55, undefined, { twinkle: 0.4 });
    for (let i = 0; i < 9; i++) {
      const sx = px + Phaser.Math.Between(-55, 55);
      const sy = py + Phaser.Math.Between(-18, 18);
      if (Math.hypot((sx - px) / 70, (sy - py) / 24) > 1) continue;
      lighting.nightGlow(this, this.add.rectangle(sx, sy, 1.2, 1.2, 0xffffff), 0.9, undefined, { twinkle: i * 1.7 });
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

  /**
   * Благоустройство района (hood.ts): купленное стоит на улице. На том тротуаре — чугунные фонари и
   * вазоны, у остановки — велопарковка, в парке слева от пруда — площадь с лавочками, елью, ярмарочными
   * лавками, росписью и памятником бабушке, у пруда — фонтан и детская площадка. Остановка с навесом и
   * ящики с цветами у соседей — в buildNeighbors и drawNeighbor. Вечером горят фонари, гирлянда ели и
   * подсветка памятника. В лёгкой графике фонтан без брызг. Возвращает занятые места — сквер не сажает
   * туда деревья.
   */
  private buildHood(next: Layout, top: number): { x: number; y: number; w: number; h: number }[] {
    this.builtHood = hoodLook(this.state);
    const areas: { x: number; y: number; w: number; h: number }[] = [];
    if (!this.builtHood) return areas;
    const d = this.layout.door.x;
    const has = (id: HoodId) => hasHood(this.state, id);
    const winter = yearTime(this.state.day) === 'winter';
    // Нижний край тротуара за дорогой: фонари стоят на нём, не мешая пешеходам.
    const far = top + 85;
    if (has('lamps')) {
      // Свои фонари — через 72 от −100; эти — между ними, за дорогой. Не на переходе, не за вывесками
      // зданий и не в рекламном щите (он у тротуара справа от входа, ads).
      for (let x = -352, i = 0; x < next.w + 340; x += 72, i++) {
        if (Math.abs(x - d) < 40 || Math.abs(x - d - 70) < 30 || this.signsAcross.some((c) => Math.abs(x - c) < 40)) continue;
        this.art(x, far, 'hood_lamp').setOrigin(0.5, 0.95).setDepth(far);
        const lamp = lighting.addLamp(this, x, far - 20, 0.06 + i * 0.015, 0.4);
        for (const dx of [-3.75, 4.25]) lighting.lampGlow(this, lamp, this.art(x + dx, far - 20.5, 'glow').setScale(10 / 64).setTint(0xfff0b0), 0.9);
      }
    }
    if (has('beds')) {
      for (let x = -316; x < next.w + 340; x += 144) {
        if (Math.abs(x - d) < 30) continue;
        // У бордюра: ниже по тротуару висят вывески зданий района.
        this.art(x, top + 76, winter ? 'hood_planter_winter' : 'hood_planter').setOrigin(0.5, 0.9).setDepth(top + 76);
      }
    }
    // Велопарковка — на нашем тротуаре у остановки, ближе к углу.
    if (has('bikes')) this.art(-70 - WING_OUTER - 36, this.streetY + 3, 'hood_bikes').setOrigin(0.5, 0.9).setDepth(this.streetY + 3);

    // Площадь в парке слева от пруда: плитка с бордюром, по краям — кусты.
    const alley = top + 268;
    // Между клумбами аллеи (d−260 и d−120) к площади ведёт дорожка.
    const sq = { x: d - 258, y: alley + 56, w: 200, h: 100 };
    const plaza = HOOD_SQUARE.some(has);
    if (plaza) {
      this.add.rectangle(sq.x - 2, sq.y - 2, sq.w + 4, sq.h + 4, 0xc0cbdc).setOrigin(0).setDepth(-9.47);
      this.add.tileSprite(sq.x, sq.y, sq.w, sq.h, 'paving').setOrigin(0).setTileScale(1 / ART).setDepth(-9.46);
      // Дорожка от аллеи к площади.
      this.add.tileSprite(sq.x + sq.w / 2 - 8, alley + 12, 16, sq.y - alley - 12, 'paving').setOrigin(0).setTileScale(1 / ART).setDepth(-9.46);
      areas.push({ x: sq.x - 8, y: alley, w: sq.w + 16, h: sq.y + sq.h - alley + 8 });
      for (const [bx, by] of [[sq.x + 6, sq.y + 8], [sq.x + sq.w - 6, sq.y + 8], [sq.x + 6, sq.y + sq.h - 2], [sq.x + sq.w - 6, sq.y + sq.h - 2]] as const) {
        this.greenery.push(this.art(bx, by, 'bush_flower').setDepth(by));
      }
    }
    const cx = sq.x + sq.w / 2;
    if (has('mural')) {
      // Расписанная стена у дальнего края площади: на двух столбиках.
      const my = sq.y + 26;
      for (const dx of [-17, 17]) this.add.rectangle(cx - 60 + dx, my + 2, 2, 5, 0x3b2a35).setDepth(my);
      this.art(cx - 60, my, 'hood_mural').setOrigin(0.5, 1).setDepth(my + 0.1);
    }
    if (has('benches')) {
      for (const bx of [cx + 22, cx + 58]) this.art(bx, sq.y + 20, 'bench').setDepth(sq.y + 20);
      // Вечером над лавочками — два фонаря площади.
      for (const [lx, i] of [[cx + 4, 0], [cx + 82, 1]] as const) {
        this.art(lx, sq.y + 22, 'lamp').setOrigin(0.5, 0.95).setDepth(sq.y + 22);
        lighting.addLamp(this, lx, sq.y, 0.12 + i * 0.03, 0.45);
      }
    }
    if (has('statue')) {
      const sy = sq.y + sq.h / 2 + 22;
      this.art(cx, sy, 'hood_statue').setOrigin(0.5, 0.97).setDepth(sy);
      this.add
        .text(cx, sy - 11.5, t('hood.statue.plaque'), { fontFamily: UI_FONT, fontSize: '4px', color: '#3b2a35' })
        .setOrigin(0.5)
        .setResolution(this.textRes(6))
        .setDepth(sy + 0.1);
      // Подсветка снизу: вечером бронза светится тёплым.
      lighting.nightGlow(this, this.art(cx, sy - 6, 'glow').setDisplaySize(34, 30).setTint(0xffd890), 0.5, undefined, { map: { key: 'light_pool', scale: 1.1, gain: 1.3, haze: 0.2 } });
    }
    if (has('fir')) {
      const fx = cx + 70;
      const fy = sq.y + sq.h - 10;
      this.art(fx, fy, winter ? 'hood_fir_xmas' : 'hood_fir').setOrigin(0.5, 0.95).setDepth(fy);
      // Зимой ёлка наряжена: вечером мигают огоньки.
      if (winter) {
        const colors = [0xfee761, 0xe43b44, 0x2ce8f5, 0x63c74d, 0xffffff];
        for (let i = 0; i < 14; i++) {
          const k = (i + 0.5) / 14;
          const ly = fy - 36 + k * 30;
          const lx = fx + (((i * 7) % 11) / 10 - 0.5) * (6 + k * 18);
          lighting.nightGlow(this, this.add.rectangle(lx, ly, 1.2, 1.2, colors[i % colors.length]), 0.95, undefined, { twinkle: i * 1.3 });
        }
        lighting.nightGlow(this, this.art(fx, fy - 41, 'glow').setScale(12 / 64).setTint(0xfee761), 0.9, undefined, { twinkle: 0.7 });
        lighting.nightGlow(this, this.art(fx, fy - 18, 'glow').setDisplaySize(44, 50).setTint(0xffd890), 0.3, undefined, { map: { scale: 1, gain: 1.1, haze: 0.2 } });
      }
    }
    if (has('fair')) {
      // Три лавки у края площади и гирлянда лампочек над ними.
      const fy = sq.y + sq.h - 6;
      const xs = [cx - 78, cx - 54, cx - 30];
      xs.forEach((x, i) => this.art(x, fy, `hood_stall_${'RUE'[i]}`).setOrigin(0.5, 0.95).setDepth(fy));
      for (let x = xs[0] - 10, i = 0; x <= xs[2] + 10; x += 5, i++) {
        const ly = fy - 23 + Math.sin(((x - xs[0] + 10) / 26) * Math.PI) * 1.5;
        lighting.nightGlow(this, this.add.rectangle(x, ly, 1.2, 1.2, i % 2 ? 0xfee761 : 0xffb860), 0.9, undefined, { twinkle: i * 0.9 });
      }
    }

    // Фонтан на берегу пруда, детская площадка — правее.
    const pond = this.parkPond;
    if (has('fountain') && pond) {
      const fx = pond.x + 132;
      const fy = pond.y + 4;
      this.art(fx, fy, 'hood_fountain').setOrigin(0.5, 0.88).setDepth(fy);
      areas.push({ x: fx - 20, y: fy - 24, w: 40, h: 28 });
      // Летом струя играет: капли разлетаются и падают в чашу. Зимой фонтан выключен, в лёгкой графике — без брызг.
      if (!this.lite && !winter) {
        for (let i = 0; i < 4; i++) {
          const drop = this.add.rectangle(fx, fy - 19, 1, 1, 0xbfe8ff).setDepth(fy + 0.1);
          const dir = i % 2 ? 1 : -1;
          this.tweens.add({ targets: drop, x: fx + dir * (5 + (i >> 1) * 3), y: fy - 8, duration: 700, delay: i * 180, repeat: -1, ease: 'Quad.easeIn' });
        }
      }
      lighting.nightGlow(this, this.art(fx, fy - 8, 'glow').setDisplaySize(40, 18).setTint(0x9cd8ff), 0.35, undefined, { twinkle: 0.3 });
    }
    if (has('playground') && pond) {
      const px = pond.x + 210;
      const py = pond.y + 46;
      this.art(px, py, 'hood_playground').setOrigin(0.5, 1).setDepth(py);
      areas.push({ x: px - 26, y: py - 32, w: 52, h: 34 });
    }
    return areas;
  }

  /**
   * Парковка за магазином и проезд к ней с улицы вдоль правой стены: площадка с бордюром и разметкой
   * мест, островки с кустами, деревом и фонарём, у стены — дорожка для пешеходов, у въезда — знак «P».
   * Утром на местах стоят машины соседей; днём на машинах приезжают наши покупатели (carCustomer).
   * Возвращает занятые места — сквер не сажает туда деревья.
   */
  private buildParking(next: Layout, street: number): { x: number; y: number; w: number; h: number }[] {
    const right = next.w + LOT_DRIVE_END;
    const left = right - LOT.w;
    const top = LOT.top;
    const bottom = top + LOT.h;
    const aisleY = top + LOT.h / 2;
    const driveX = next.w + LOT_DRIVE;
    const footX = next.w + LOT_FOOT;
    const tile = (x: number, y: number, w: number, h: number, key: string, depth: number) =>
      this.add.tileSprite(x, y, w, h, key).setOrigin(0).setTileScale(1 / ART).setDepth(depth);
    // Бордюр вокруг площадки и тень от него на асфальт.
    this.add.rectangle(left - 3, top - 3, LOT.w + 6, LOT.h + 6, 0xc0cbdc).setOrigin(0).setDepth(-9.47);
    this.add.rectangle(left - 3, top - 3, LOT.w + 6, 1, 0xe8edf4).setOrigin(0).setDepth(-9.47);
    tile(left, top, LOT.w, LOT.h, 'asphalt', -9.46);
    this.add.rectangle(left, top, LOT.w, 2, 0x181425, 0.25).setOrigin(0).setDepth(-9.45);
    this.add.rectangle(left, top, 2, LOT.h, 0x181425, 0.2).setOrigin(0).setDepth(-9.45);
    // Проезд с улицы: асфальт от площадки до тротуара (бордюр площадки тут разобран), справа — бордюр,
    // слева за поребриком — дорожка, по которой водители ходят в магазин и обратно.
    tile(driveX, bottom, right - driveX, street - bottom, 'asphalt', -9.46);
    this.add.rectangle(right, bottom, 2, street - bottom, 0xc0cbdc).setOrigin(0).setDepth(-9.45);
    tile(footX, bottom - 30, driveX - footX, street - bottom + 30, 'paving', -9.455);
    this.add.rectangle(driveX - 1, bottom - 30, 1, street - bottom + 30, 0xc0cbdc).setOrigin(0).setDepth(-9.45);
    // На тротуаре — края въезда, у дороги — пониженный бордюр.
    for (const x of [driveX, right]) this.add.rectangle(x, street, 1, 22, 0x8b9bb4, 0.8).setOrigin(0).setDepth(-9.4);
    this.add.rectangle(driveX, street + 22, right - driveX, 2, 0x5a6988).setOrigin(0).setDepth(-8.99);
    // Знак «P» у въезда: видно, куда сворачивают машины.
    const signX = right + 3;
    this.add.rectangle(signX, street + 4, 1, 9, 0x5a6988).setOrigin(0.5, 1).setDepth(street + 4);
    this.add.rectangle(signX, street - 8, 7, 7, 0x0099db).setStrokeStyle(0.6, 0xffffff).setDepth(street + 4.1);
    this.add
      .text(signX, street - 8, 'P', { fontFamily: UI_FONT, fontSize: '6px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setResolution(this.textRes(4))
      .setDepth(street + 4.2);
    // Островки с газоном: по краям рядов — кусты, справа сверху — дерево (въезд под ним свободен),
    // справа снизу, у дорожки, — фонарь.
    const isle = (x: number, y: number, w: number, h: number) => {
      this.add.rectangle(x - 1, y, w + 2, h, 0xc0cbdc).setOrigin(0).setDepth(-9.44);
      tile(x + 1, y + 2, w - 2, h - 4, 'grass', -9.435);
    };
    isle(left + 3, top + 4, 10, 24);
    isle(left + 3, bottom - 28, 10, 24);
    isle(right - 40, top + 4, 36, 22);
    isle(right - 42, bottom - 28, 10, 24);
    this.art(left + 8, top + 18, 'bush').setDepth(-9.42);
    this.art(left + 8, bottom - 12, 'bush').setDepth(-9.42);
    this.add.image(right - 18, top + 24, 'shadow').setScale(2.1 / ART, 1.5 / ART).setAlpha(0.75).setDepth(-9.43);
    // Дерево — как в сквере: в снегу в шапке, осенью рыжее, на ветру качается.
    const tree = this.art(right - 23, top + 24, 'tree_round').setOrigin(0.5, 0.9).setDepth(-9.42);
    this.greenery.push(tree);
    this.windTrees.push(tree);
    this.art(right - 9, top + 20, 'bush_flower').setDepth(-9.42);
    // Фонарь парковки загорается первым — у него датчик сумерек; под ним на асфальте — пятно света.
    const lampX = right - 37;
    this.art(lampX, bottom - 8, 'lamp').setOrigin(0.5, 0.95).setDepth(-9.42);
    const parkLamp = lighting.addLamp(this, lampX, bottom - 30, 0.02, 0.5);
    lighting.lampGlow(this, parkLamp, this.art(lampX, bottom - 8, 'glow').setScale(40 / 64).setTint(0xffc860), 0.5, { key: 'light_pool', w: 70, h: 38, gain: 1.6 });
    // Разметка мест, стрелки проезда (въезд справа) и упоры для колёс у дальнего края каждого места.
    const bayX = left + 16;
    const marks = this.add.graphics().setDepth(-9.45);
    marks.fillStyle(0xe6e1d6, 1);
    for (const ry of [top + 4, bottom - 30]) for (let i = 0; i <= LOT.bays; i++) marks.fillRect(bayX + i * LOT.bay, ry, 1.5, 26);
    marks.fillStyle(0xe6e1d6, 0.75);
    for (const [ax, dir] of [[bayX + 40, 1], [right - 66, -1]] as const) {
      marks.fillRect(ax - 7 * dir, aisleY - 0.75, 10 * dir, 1.5);
      marks.fillTriangle(ax + 3 * dir, aisleY - 3, ax + 3 * dir, aisleY + 3, ax + 7 * dir, aisleY);
    }
    this.add
      .text(bayX + 92, aisleY, 'P', { fontFamily: UI_FONT, fontSize: '10px', color: '#e6e1d6', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setResolution(this.textRes(4))
      .setDepth(-9.44)
      .setAlpha(0.7);
    const stops = this.add.graphics().setDepth(-9.445);
    // Два ряда мест носом к проезду посередине. Утром часть занята соседями — остальные ждут наших покупателей.
    const rnd = new Phaser.Math.RandomDataGenerator(['parking']);
    const full = this.lite ? LOT_NEIGHBORS_LITE : LOT_NEIGHBORS;
    const spots: ParkSpot[] = [];
    for (const up of [true, false]) {
      for (let i = 0; i < LOT.bays; i++) {
        const spot: ParkSpot = { x: bayX + i * LOT.bay + LOT.bay / 2, y: up ? top + 18 : bottom - 18, up, car: null };
        spots.push(spot);
        stops.fillStyle(0xa8a8a8, 1).fillRect(spot.x - 6, up ? top + 6 : bottom - 8, 12, 2);
        stops.lineStyle(0.5, 0x5a6988, 1).strokeRect(spot.x - 6, up ? top + 6 : bottom - 8, 12, 2);
        if (rnd.frac() < full) spot.car = this.lotCar(this.lotCarType(() => rnd.frac()), spot.x, spot.y, up ? -90 : 90, 'neighbor');
      }
    }
    this.parking = {
      spots,
      left,
      right,
      top,
      bottom,
      aisleY,
      laneX: right - 12,
      footX: (footX + driveX) / 2,
      mouthY: street,
      busy: { drive: false, aisle: false },
      waiting: 0,
      onRoad: false,
      mouth: false,
    };
    this.parkingTimer?.remove();
    this.parkingTimer = this.time.addEvent({ delay: 4000, loop: true, callback: () => this.parkingTick() });
    return [
      { x: left - 8, y: top - 8, w: LOT.w + 16, h: LOT.h + 16 },
      { x: footX - 4, y: bottom, w: right - footX + 8, h: street - bottom },
    ];
  }

  /** Глубина на улице: перед зданием и сбоку — по высоте, как у людей; за ним (y < 0) — над асфальтом парковки. */
  private outsideDepth(y: number): number {
    return y >= 0 ? y : LOT_DEPTH + (y + 400) / 100000;
  }

  /** Машина у магазина: стоит на месте носом по heading (или сейчас поедет). */
  private lotCar([key, color]: [string, number | null, number], x: number, y: number, heading: number, owner: LotCar['owner']): LotCar {
    const body = this.art(0, 0, key);
    if (color !== null) body.setTint(color || Phaser.Utils.Array.GetRandom(CAR_COLORS));
    const lights = this.art(0, 0, `${key}_lights`);
    const blink = [0, 1].map(() => this.add.rectangle(0, 0, 1.5, 1.5, 0xfeae34).setVisible(false));
    const box = this.add.container(x, y, [body, lights, ...blink]);
    // Свет фар и вспышка поворотника — поверх вечерней темноты (как у ночного такси), едут вместе с машиной.
    // Они в своём контейнере (в координатах мира): отсечение за краем кадра (cullView) не трогает то, что ездит.
    const glow = (w: number, h: number, tint: number) => this.art(x, y, 'glow').setScale(w / 64, h / 64).setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    // Свет фар ложится в карту освещения конусом (на тёмном асфальте его видно слабо — поверх темноты
    // остаётся и лёгкое пятно); в лёгкой графике карта без движущихся огней — там пятно по-старому яркое.
    const beam = glow(30, 14, 0xfff0b0);
    const flash = glow(7, 7, 0xffa030);
    const lamps = this.add.container(0, 0, [beam, flash]).setDepth(LIGHT_DEPTH + 1);
    box.once(Phaser.GameObjects.Events.DESTROY, () => lamps.destroy());
    const headlights = this.headlights(box);
    const car: LotCar = { box, body, lights, key, half: key === 'car_hatch' ? 13 : 16, heading, frame: 'side', blink, turn: null, beam, flash, headlights, moving: false, owner, leaving: false };
    this.placeCar(car, x, y, heading);
    return car;
  }

  /** Какая машина: седан, хэтчбек, такси или фургон — по весам, как на улице. */
  private lotCarType(random: () => number = Math.random): [string, number | null, number] {
    const total = LOT_CARS.reduce((sum, [, , weight]) => sum + weight, 0);
    let roll = random() * total;
    return LOT_CARS.find(([, , weight]) => (roll -= weight) < 0) ?? LOT_CARS[0];
  }

  /**
   * Машина в точке (x, y) носом по heading: кадр — ближайший из четырёх (вбок, вверх, вниз; влево —
   * зеркально), остаток поворота — наклоном. Поворотник мигает у носа и у багажника со своей стороны,
   * фары светят вперёд — пока едет и только вечером.
   */
  private placeCar(car: LotCar, x: number, y: number, heading: number): void {
    const h = Phaser.Math.Angle.WrapDegrees(heading);
    car.heading = h;
    const west = Math.abs(h) > 135;
    const frame: LotCar['frame'] = Math.abs(h) <= 45 || west ? 'side' : h > 0 ? 'down' : 'up';
    if (frame !== car.frame) {
      car.frame = frame;
      const key = frame === 'side' ? car.key : `${car.key}_${frame}`;
      car.body.setTexture(key);
      car.lights.setTexture(`${key}_lights`);
    }
    car.body.setFlipX(west);
    car.lights.setFlipX(west);
    const tilt = Phaser.Math.Angle.WrapDegrees(h - (frame === 'side' ? (west ? 180 : 0) : frame === 'down' ? 90 : -90));
    car.box.setPosition(x, y).setAngle(tilt).setDepth(this.outsideDepth(y));
    // Нос в кадре (до наклона) и левый бок: поворотник — у носа и багажника со своей стороны.
    const fwd = frame === 'side' ? { x: west ? -1 : 1, y: 0 } : { x: 0, y: frame === 'down' ? 1 : -1 };
    const side = car.turn === 'right' ? -5 : 5;
    const on = car.turn !== null && Math.floor(this.time.now / 300) % 2 === 0;
    car.blink.forEach((dot, i) => {
      const along = (i === 0 ? 1 : -1) * (car.half - 1);
      dot.setPosition(fwd.x * along + fwd.y * side, fwd.y * along - fwd.x * side).setVisible(on);
    });
    const t = Phaser.Math.DegToRad(tilt);
    const [dot] = car.blink;
    car.flash
      .setPosition(x + dot.x * Math.cos(t) - dot.y * Math.sin(t), y + dot.x * Math.sin(t) + dot.y * Math.cos(t))
      .setAlpha(on ? 0.2 + 0.7 * this.evening : 0);
    const a = Phaser.Math.DegToRad(h);
    const reach = car.half + 12;
    car.beam
      .setPosition(x + Math.cos(a) * reach, y + Math.sin(a) * reach)
      .setRotation(a)
      .setAlpha(car.moving ? 0.75 * this.evening * this.beamHaze() : 0);
    // Конус фар — от носа вперёд по ходу.
    const lit = car.headlights;
    lit.x = x + Math.cos(a) * (car.half - 3);
    lit.y = y + Math.sin(a) * (car.half - 3);
    lit.rotation = a - Math.PI / 2;
    lit.set(car.moving ? HEADLIGHT_POWER * this.evening : 0);
  }

  /** Пятно фар поверх темноты: в карте освещения фары и так светят — пятно лишь дымка; в лёгкой — как раньше. */
  private beamHaze(): number {
    return this.lite ? 1 : 0.45;
  }

  /**
   * Фары в карте освещения: конус света (узким концом у носа машины) на асфальте впереди. Движется — его
   * нет в лёгкой графике. Машина уехала — свет гаснет вместе с ней.
   */
  private headlights(car: Phaser.GameObjects.GameObject): Light {
    const lit = this.light.add('light_cone', 0, 0, HEADLIGHT.w, HEADLIGHT.h, 0xfff0c8, 0).attach(car);
    lit.originY = 0;
    lit.moving = true;
    return lit;
  }

  /** Машина едет по отрезкам пути: место и направление — по прямой или дуге, скорость меняется плавно. */
  private async drive(car: LotCar, legs: CarLeg[]): Promise<void> {
    for (const leg of legs) {
      if (!car.box.active) return;
      const length = leg.path.getLength();
      if (length < 0.5) continue;
      car.turn = leg.turn ?? null;
      const seconds = (2 * length) / Math.max(1, leg.v0 + leg.v1);
      const place = (u: number) => {
        const p = leg.path.getPoint(u);
        const d = leg.path.getTangent(u);
        this.placeCar(car, p.x, p.y, Phaser.Math.RadToDeg(Math.atan2(d.y, d.x)) + (leg.back ? 180 : 0));
      };
      await new Promise<void>((done) =>
        this.tweens.addCounter({
          from: 0,
          to: seconds,
          duration: seconds * 1000,
          onUpdate: (tween) => {
            const time = tween.getValue() ?? 0;
            place(Phaser.Math.Clamp((leg.v0 * time + ((leg.v1 - leg.v0) * time * time) / (2 * seconds)) / length, 0, 1));
          },
          onComplete: () => {
            if (car.box.active) place(1);
            done();
          },
        }),
      );
    }
    car.turn = null;
    if (car.box.active) this.placeCar(car, car.box.x, car.box.y, car.heading);
  }

  /** Машина стоит с работающим мотором (фары горят, поворотник мигает), пока ready() не скажет «можно». */
  private carWait(car: LotCar, ready: () => boolean, turn: LotCar['turn']): Promise<void> {
    car.turn = turn;
    return new Promise((done) => {
      const tick = this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 1000,
        repeat: -1,
        onUpdate: () => {
          if (!car.box.active) {
            tick.stop();
            return;
          }
          if (!ready()) {
            this.placeCar(car, car.box.x, car.box.y, car.heading);
            return;
          }
          tick.stop();
          done();
        },
      });
    });
  }

  /** Ждёт, пока ready() не станет истинным (проверяет несколько раз в секунду); перестройка мира обрывает ожидание. */
  private until(ready: () => boolean): Promise<void> {
    if (ready()) return Promise.resolve();
    return new Promise((done) => {
      const stop = this.worldTimer(150, () => {
        if (!ready()) return;
        stop();
        done();
      });
    });
  }

  /** Человек идёт по точкам на улице напрямик (без обхода полок); перестройка мира обрывает путь. */
  private async stroll(sprite: Phaser.GameObjects.Container, points: { x: number; y: number }[]): Promise<void> {
    if (!sprite.active || !points.length) return;
    await this.walkVia(sprite, points, undefined, { depth: (y) => this.outsideDepth(y), direct: true });
  }

  /** Занять проезд (drive) и/или парковку (aisle), если они свободны. */
  private lotTake(lot: ParkingLot, need: ('drive' | 'aisle')[]): boolean {
    if (this.parking !== lot || need.some((key) => lot.busy[key])) return false;
    for (const key of need) lot.busy[key] = true;
    return true;
  }

  /** Машина появилась на улице: с парковки выезжают, только когда в её полосе слева никого нет. */
  private onRoad(obj: Phaser.GameObjects.Container, lane: 'up' | 'down', slow = false): RoadCar {
    const entry: RoadCar = { obj, lane, slow };
    this.roadTraffic.add(entry);
    obj.once(Phaser.GameObjects.Events.DESTROY, () => this.roadTraffic.delete(entry));
    return entry;
  }

  /**
   * Фургон (автобус, мусоровоз) трогается с места: сначала пропускает машину с парковки, если она сейчас
   * на дороге (сворачивает к парковке или уже выехала), — не въезжает ей в багажник и не проезжает сквозь
   * неё; та, что ещё ждёт у тротуара, сама его пропустит. away — уезжает насовсем и разгоняется, как все:
   * он больше не медленный — с парковки при нём не выезжают и справа через его полосу не сворачивают.
   */
  private async yieldToLot(car: RoadCar, away = false): Promise<void> {
    await this.until(() => !this.parking?.onRoad || this.parking.mouth);
    if (away) car.slow = false;
  }

  /** Можно ли ехать по улице к парковке: в особые дни, когда улица занята, машины стоят, где стоят. */
  private lotRoadOpen(): boolean {
    const big = this.bigObjs.length ? bigDayFor(this.state.day) : null;
    return !big || LOT_ROAD_DAYS.includes(big);
  }

  /**
   * Откуда можно подъехать к парковке (пока машина с парковки на дороге, новые на улице не появляются).
   * Слева — по ближней к магазину полосе, если в ней нет автобуса или фургона, которые стоят или тащатся
   * впереди (или ждут за краем, чтобы поехать к складу), а быстрая машина уже отъехала от края (сзади
   * эта её не догонит — медленнее). Справа — по дальней полосе с поворотом направо через ближнюю: если
   * справа только что никто не въехал, а в ближней полосе до въезда пусто (её переезжать). null — пока никак.
   */
  private arrivalSide(lot: ParkingLot): 'left' | 'right' | null {
    let left = true;
    let right = true;
    for (const v of this.roadTraffic) {
      if (!v.obj.active) continue;
      const { x } = v.obj;
      if (v.lane === 'up' && (v.slow ? x > -300 && x < this.next.w + 80 : x < 0)) left = false;
      if (v.lane === 'down' && x > this.next.w + 20) right = false;
      if (v.lane === 'up' && x < lot.laneX + 40 && (!v.slow || x > lot.laneX - 160)) right = false;
    }
    return left && right ? (Math.random() < 0.5 ? 'left' : 'right') : left ? 'left' : right ? 'right' : null;
  }

  /** Можно ли выехать с проезда на улицу: в своей полосе слева никого, перед въездом нет прохожих. */
  private mouthClear(lot: ParkingLot): boolean {
    for (const v of this.roadTraffic) {
      if (v.lane === 'up' && v.obj.active && v.obj.x < lot.laneX + 40 && (!v.slow || v.obj.x > -220)) return false;
    }
    return this.sidewalkClear(lot);
  }

  /** На тротуаре перед въездом никого: машина переедет его, ни в кого не упершись. */
  private sidewalkClear(lot: ParkingLot): boolean {
    for (const p of this.people) if (Math.abs(p.x - lot.laneX) < LOT_MOUTH && Math.abs(p.y - this.streetY) < 9) return false;
    return true;
  }

  /**
   * Машина переезжает тротуар у въезда: прохожие, что подходят к въезду, останавливаются перед ним
   * и ждут, пока она проедет, — никто не проходит сквозь машину. Возвращает «проехала»: идут дальше.
   */
  private holdWalkers(lot: ParkingLot): () => void {
    const held = new Set<Phaser.GameObjects.Container>();
    // Смотрим каждый кадр, как машина ждёт просвета (carWait): шаг прохожих — тоже твин, в одном с ним времени.
    const tick = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 1000,
      repeat: -1,
      onUpdate: () => {
        for (const p of this.people) {
          if (held.has(p) || !p.getData('walking') || Math.abs(p.y - this.streetY) >= 9) continue;
          const dx = p.x - lot.laneX;
          const pace = (p.getData('pace') as number | undefined) ?? CUSTOMER_SPEED;
          // Подходит к въезду и вот-вот на него ступит (за шаг-другой), а не уходит от него.
          if (Math.abs(dx) < LOT_MOUTH || Math.abs(dx) > LOT_MOUTH + 2 + pace * 0.5 || p.getData('facing') !== (dx < 0 ? 'right' : 'left')) continue;
          const move = p.getData('move') as Phaser.Tweens.Tween | undefined;
          if (!move?.isPlaying()) continue;
          move.pause();
          p.setData('walking', false);
          held.add(p);
        }
      },
    });
    return () => {
      tick.stop();
      for (const p of held) {
        const move = p.getData('move') as Phaser.Tweens.Tween | undefined;
        if (!p.active || !move?.isPaused()) continue;
        p.setData('walking', true);
        move.resume();
      }
    };
  }

  /**
   * Очередной покупатель приезжает на машине — если на парковке есть место и проезд к ней свободен.
   * Поток гостей тот же: этот просто придёт с парковки, а не с тротуара (arriveByCar). true — поехал.
   * Под вечер и в короткую ночную смену не приезжают (пока доедет и дойдёт — магазин закроется),
   * в обучение — тоже.
   */
  private carCustomer(): boolean {
    const lot = this.parking;
    if (!lot || this.night || this.state.day <= TUTORIAL_DAYS || this.timeLeft < CAR_LAST_SECONDS || !this.lotRoadOpen()) return false;
    if (lot.busy.drive || lot.waiting > 0 || lot.onRoad) return false;
    const side = this.arrivalSide(lot);
    if (!side || Math.random() >= CAR_CUSTOMERS * (this.lite ? 0.5 : 1)) return false;
    const free = lot.spots.filter((s) => !s.car);
    if (!free.length) return false;
    void this.arriveByCar(lot, Phaser.Utils.Array.GetRandom(free), side);
    return true;
  }

  /**
   * Покупатель на машине: едет по улице в своей полосе, у въезда сбрасывает скорость, мигает и сворачивает
   * в проезд вдоль магазина (слева — налево из ближней полосы, справа — направо через неё); если по
   * тротуару перед въездом кто-то идёт — останавливается и пропускает его. В конце проезда —
   * на парковку (если там кто-то паркуется — ждёт), по ней — к своему месту, заезжает носом по дуге
   * и глохнет. Водитель выходит и по дорожке вдоль стены идёт на тротуар — там он уже обычный
   * покупатель (spawnCustomer), а после покупок вернётся к машине (driveHome).
   */
  private async arriveByCar(lot: ParkingLot, spot: ParkSpot, side: 'left' | 'right'): Promise<void> {
    const { laneX, aisleY } = lot;
    const road = this.streetY + 24;
    const far = this.streetY + 42;
    const r = 12;
    lot.busy.drive = true;
    lot.onRoad = true;
    const from = side === 'left' ? -70 : this.next.w + 90;
    const car = this.lotCar(this.lotCarType(), from, side === 'left' ? road : far, side === 'left' ? 0 : 180, 'customer');
    car.moving = true;
    spot.car = car;
    // Перед самым поворотом смотрит на тротуар: кто уже на въезде — пропускает (тормозит до конца и ждёт),
    // кто только подходит — сам подождёт, пока машина проедет (holdWalkers).
    const lane = side === 'left' ? road : far;
    const turnAt = side === 'left' ? laneX - r : laneX + r;
    const before = side === 'left' ? turnAt - 8 : turnAt + 8;
    const slow = side === 'left' ? 16 : 14;
    await this.drive(
      car,
      side === 'left'
        ? cruise(from, road, before, road, CAR_ROAD, CAR_ROAD, slow, 0, 110, 'left')
        : cruise(from, far, before, far, CAR_ROAD * 0.8, CAR_ROAD * 0.8, slow, 0, 50, 'right'),
    );
    const clear = this.sidewalkClear(lot);
    await this.drive(car, [{ path: straight(before, lane, turnAt, lane), v0: slow, v1: clear ? slow : 0, turn: side }]);
    if (!clear) await this.carWait(car, () => this.sidewalkClear(lot), side);
    const release = this.holdWalkers(lot);
    const v0 = clear ? slow : 0;
    await this.drive(
      car,
      side === 'left'
        ? [{ path: bend(laneX - r, road, laneX, road, laneX, road - r), v0, v1: 18, turn: 'left' }]
        : [
            { path: bend(laneX + r, far, laneX, far, laneX, far - r), v0, v1: 16, turn: 'right' },
            { path: straight(laneX, far - r, laneX, road - r), v0: 16, v1: 18, turn: 'right' },
          ],
    );
    lot.onRoad = false;
    // По проезду вдоль магазина: разгон, ровно, перед поворотом на парковку — тормозит. Разогнался —
    // уже за тротуаром: прохожие идут дальше.
    const corner = aisleY + r;
    const legs = cruise(laneX, road - r, laneX, corner, 18, CAR_DRIVE, 14, 50, 60, 'left');
    const brake = legs.pop()!;
    await this.drive(car, legs.splice(0, 1));
    release();
    await this.drive(car, legs);
    const free = this.lotTake(lot, ['aisle']);
    if (!free) brake.v1 = 0;
    await this.drive(car, [brake]);
    if (!free) await this.carWait(car, () => this.lotTake(lot, ['aisle']), 'left');
    await this.drive(car, [{ path: bend(laneX, corner, laneX, aisleY, laneX - r, aisleY), v0: free ? 14 : 0, v1: 14, turn: 'left' }]);
    // Свернул на парковку — проезд свободен для следующей машины.
    lot.busy.drive = false;
    const bay = 14;
    const into = spot.x + bay;
    const dir = spot.up ? -1 : 1;
    const turn = spot.up ? 'right' : 'left';
    await this.drive(car, [
      ...cruise(laneX - r, aisleY, into, aisleY, 14, CAR_LOT, CAR_CREEP, 20, 30, turn),
      { path: bend(into, aisleY, spot.x, aisleY, spot.x, aisleY + dir * bay), v0: CAR_CREEP, v1: CAR_CREEP, turn },
      { path: straight(spot.x, aisleY + dir * bay, spot.x, spot.y), v0: CAR_CREEP, v1: 0 },
    ]);
    if (!car.box.active) {
      lot.busy.aisle = false;
      return;
    }
    car.moving = false;
    this.placeCar(car, spot.x, spot.y, spot.up ? -90 : 90);
    // Водитель выходит (дверь слева по ходу) и идёт по парковке к дорожке вдоль стены, по ней — на тротуар.
    let look = this.night ? nightLook() : customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), this.state.day);
    const big = bigDayFor(this.state.day);
    if (big && BIG_DAYS[big].masks && !look.face && Math.random() < MASKS) look = { ...look, face: 'medmask' };
    const door = this.carDoor(spot);
    const driver = this.makePerson(door.x, door.y, look);
    driver.setDepth(this.outsideDepth(door.y)).setAlpha(0);
    weatherFx.addUmbrella(this, driver);
    this.tweens.add({ targets: driver, alpha: 1, duration: 250 });
    await this.stroll(driver, [{ x: door.x, y: aisleY + 3 }, { x: lot.footX, y: aisleY + 3 }, { x: lot.footX, y: lot.bottom }]);
    lot.busy.aisle = false;
    await this.stroll(driver, [{ x: lot.footX, y: this.streetY }]);
    if (!driver.active) return;
    // Пока шёл, магазин закрылся — возвращается к машине.
    if (this.running && this.timeLeft > 0 && !this.siege) this.spawnCustomer(undefined, { sprite: driver, look, car: spot });
    else void this.driveHome(driver, spot);
  }

  /** Где у машины на месте дверь водителя (слева по ходу): там он выходит и садится. */
  private carDoor(spot: ParkSpot): { x: number; y: number } {
    return { x: spot.x + (spot.up ? -9 : 9), y: spot.y + (spot.up ? 6 : -6) };
  }

  /**
   * Покупатель с покупками возвращается к машине: по тротуару к дорожке вдоль стены, по ней на парковку —
   * и уезжает (boardCar). Парковку за это время перестроили — просто уходит по тротуару.
   */
  private async driveHome(sprite: Phaser.GameObjects.Container, spot: ParkSpot): Promise<void> {
    const lot = this.parking;
    if (!lot || !lot.spots.includes(spot) || !spot.car?.box.active) {
      void this.strollAway(sprite);
      return;
    }
    await this.stroll(sprite, [
      { x: sprite.x, y: this.streetY },
      { x: lot.footX, y: this.streetY },
    ]);
    await this.boardCar(lot, spot, sprite);
  }

  /** Водитель по дорожке поднимается на парковку, ждёт, пока проезд свободен, садится — и машина уезжает. */
  private async boardCar(lot: ParkingLot, spot: ParkSpot, sprite: Phaser.GameObjects.Container): Promise<void> {
    const car = spot.car;
    if (!car) return;
    car.leaving = true;
    // Ждёт у края парковки, пока по ней и по проезду никто не едет (если ждут несколько — друг за другом).
    await this.stroll(sprite, [{ x: lot.footX, y: lot.bottom + 4 + 7 * Math.min(lot.waiting, 3) }]);
    lot.waiting++;
    await this.until(() => this.lotTake(lot, ['drive', 'aisle']));
    lot.waiting--;
    const door = this.carDoor(spot);
    await this.stroll(sprite, [{ x: lot.footX, y: lot.aisleY + 3 }, { x: door.x, y: lot.aisleY + 3 }, door]);
    if (!sprite.active || !car.box.active) {
      lot.busy.drive = false;
      lot.busy.aisle = false;
      return;
    }
    // Сел в машину.
    await new Promise<void>((done) => this.tweens.add({ targets: sprite, alpha: 0, duration: 200, onComplete: () => done() }));
    sprite.destroy();
    await this.lotDepart(lot, spot, car);
  }

  /**
   * Машина уезжает с парковки (проезд и парковка уже заняты для неё): задним ходом с места и по дуге —
   * носом к выезду, по парковке и проезду к улице; у тротуара пропускает машины в своей полосе
   * и прохожих, мигает — и уезжает направо, за край.
   */
  private async lotDepart(lot: ParkingLot, spot: ParkSpot, car: LotCar): Promise<void> {
    const { laneX, aisleY } = lot;
    const r = 12;
    const back = 14;
    const dir = spot.up ? -1 : 1;
    // Завёлся: зажглись фары.
    car.moving = true;
    this.placeCar(car, spot.x, spot.y, car.heading);
    await this.wait(400);
    await this.drive(car, [
      { path: straight(spot.x, spot.y, spot.x, aisleY + dir * back), v0: 0, v1: CAR_CREEP, back: true },
      { path: bend(spot.x, aisleY + dir * back, spot.x, aisleY, spot.x - back, aisleY), v0: CAR_CREEP, v1: 0, back: true },
    ]);
    spot.car = null;
    await this.drive(car, [
      ...cruise(spot.x - back, aisleY, laneX - r, aisleY, 0, CAR_LOT, 14, 20, 30, 'right'),
      { path: bend(laneX - r, aisleY, laneX, aisleY, laneX, aisleY + r), v0: 14, v1: 16, turn: 'right' },
    ]);
    lot.busy.aisle = false;
    const stop = lot.mouthY - 17;
    await this.drive(car, cruise(laneX, aisleY + r, laneX, stop, 16, CAR_DRIVE, 0, 50, 60, 'left'));
    // У тротуара (нос — у его края) ждёт просвета: в её полосе новые машины не появляются, пока она
    // не уехала. Пока она переезжает тротуар, подошедшие прохожие ждут.
    lot.onRoad = true;
    lot.mouth = true;
    await this.carWait(car, () => this.mouthClear(lot), 'left');
    lot.mouth = false;
    const release = this.holdWalkers(lot);
    const road = this.streetY + 24;
    await this.drive(car, [
      { path: straight(laneX, stop, laneX, road - r), v0: 0, v1: 24, turn: 'left' },
      { path: bend(laneX, road - r, laneX, road, laneX + r, road), v0: 24, v1: 28, turn: 'left' },
    ]);
    release();
    lot.busy.drive = false;
    await this.drive(car, [{ path: straight(laneX + r, road, this.next.w + 100, road), v0: 28, v1: CAR_ROAD * 1.3 }]);
    lot.onRoad = false;
    car.box.destroy();
  }

  /**
   * Соседские машины разъезжаются во второй половине дня (к вечеру парковка пустеет), а утром — только
   * если мест почти не осталось: проезд узкий, пусть сначала заезжают наши покупатели (carCustomer).
   * За машиной приходит водитель по дорожке вдоль стены.
   */
  private parkingTick(): void {
    const lot = this.parking;
    if (!lot || !this.running || this.arranging || !this.lotRoadOpen()) return;
    if (lot.busy.drive || lot.busy.aisle || lot.waiting > 0 || lot.onRoad) return;
    const taken = lot.spots.filter((s) => s.car).length;
    if (!this.night && this.timeLeft > CAR_LAST_SECONDS && taken < lot.spots.length - 2) return;
    const target = Math.round(lot.spots.length * (0.5 - 0.3 * this.evening) * (this.lite ? 0.7 : 1));
    // Те, за кем уже идут, не в счёт: уедут и так.
    const staying = lot.spots.filter((s) => s.car && !s.car.leaving).length;
    const parked = lot.spots.filter((s) => s.car?.owner === 'neighbor' && !s.car.leaving);
    if (staying <= target || !parked.length || Math.random() >= 0.3) return;
    // Сосед приходит из-за угла по тротуару и по дорожке вдоль стены поднимается к машине — как наши покупатели.
    const spot = Phaser.Utils.Array.GetRandom(parked);
    spot.car!.leaving = true;
    const driver = this.makePerson(this.next.w + 60, this.streetY + Phaser.Math.Between(-3, 3), customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), this.state.day));
    driver.setAlpha(0);
    this.tweens.add({ targets: driver, alpha: 1, duration: 250 });
    weatherFx.addUmbrella(this, driver);
    void this.driveHome(driver, spot);
  }

  /**
   * Утро: за ночь соседи вернулись — на свободных местах снова стоят их машины (сразу, без заезда: магазин
   * был закрыт). Днём они понемногу разъезжаются (parkingTick), а места занимают наши покупатели.
   */
  private refillParking(): void {
    const lot = this.parking;
    if (!lot) return;
    const want = Math.round(lot.spots.length * (this.lite ? LOT_NEIGHBORS_LITE : LOT_NEIGHBORS));
    let have = lot.spots.filter((s) => s.car?.owner === 'neighbor' && !s.car.leaving).length;
    for (const spot of Phaser.Utils.Array.Shuffle(lot.spots.filter((s) => !s.car))) {
      if (have >= want) break;
      spot.car = this.lotCar(this.lotCarType(), spot.x, spot.y, spot.up ? -90 : 90, 'neighbor');
      have++;
    }
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
    if (a.across) this.signsAcross.push(a.x + a.w / 2);
    this.add.rectangle(a.x + a.w / 2, signY, 70, 11, 0xfee761).setDepth(signY + 20);
    this.add
      .text(a.x + a.w / 2, signY, t('district.soon', { name }), { fontFamily: UI_FONT, fontSize: '5px', color: '#262b44' })
      .setOrigin(0.5)
      .setResolution(this.textRes(4))
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
    this.signsAcross.push(a.x + a.w / 2);
    this.add
      .text(a.x + a.w / 2, a.y - 10, `${BUILDINGS.stadium.icon} ${name}`, { fontFamily: UI_FONT, fontSize: '6px', color: '#fee761' })
      .setOrigin(0.5)
      .setResolution(this.textRes(4))
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
          .setResolution(this.textRes(4))
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
    effects.emote(this, person, 'emo_question');
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
    await this.walkVia(man, [
      { x: door.x, y: this.streetY },
      { x: door.x, y: door.y - 10 },
    ]);
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
    pets.buildCat(this, door.x + 47, atStreet ? top + 8.5 : front + 10);
    pets.buildBobik(this, door.x - 24, atStreet ? top + 8.5 : front + 10);
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
      // Голуби взлетают молча: хлопанье крыльев на каждого прохожего звучало то и дело (просьба автора — убрать).
      const dir = Math.random() < 0.5 ? -1 : 1;
      img.setTexture('pigeon_fly').setFlipX(dir < 0).setDepth(LIGHT_DEPTH - 1);
      // Взмахи — повтор мира: перестроили зал посреди полёта (твин погашен) — перестают махать и они.
      const stopFlap = this.worldTimer(110, () => img.active && img.setTexture(img.texture.key === 'pigeon_fly' ? 'pigeon0' : 'pigeon_fly'));
      this.tweens.add({
        targets: img,
        x: home.x + dir * Phaser.Math.Between(60, 90),
        y: home.y - Phaser.Math.Between(70, 100),
        alpha: 0,
        duration: 1400,
        ease: 'Sine.easeIn',
        onComplete: () => {
          stopFlap();
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
    // Окна в правой стене: стекло в толще стены, вечером через них на пол падает солнце.
    this.sideSun = [];
    for (let y = this.layout.wallH + 50; y < h - 70; y += 72) {
      this.add.rectangle(w + 1, y, WALL - 2, 22, 0x9fd8f0).setOrigin(0).setStrokeStyle(0.6, 0x3a4466).setDepth(2.1);
      this.add.rectangle(w + 2, y + 2, 1, 18, 0xe8f8ff).setOrigin(0).setDepth(2.11);
      const sun = this.art(w - 2, y + 11, 'light_spill').setOrigin(0.5, 0).setAngle(90).setScale(1 / ART, 1.3 / ART).setTint(0xffd6a0).setAlpha(0).setDepth(0.45);
      this.sideSun.push(sun);
    }
    // Тень здания на газон справа: магазин стоит на земле, а не наклеен на траву.
    const ink = 0x181425;
    const shade = this.add.graphics().setDepth(-9.4);
    shade.fillGradientStyle(ink, ink, ink, ink, 0.22, 0, 0.22, 0);
    shade.fillRect(w + WALL, 2, 12, h + FACADE_H - 4);
    const style = this.facadeStyle();
    this.add.tileSprite(-WALL, h, w + 2 * WALL, FACADE_H, this.potTile(style.texture)).setOrigin(0).setTileScale(1 / ART).setDepth(h + 1);
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
        lighting.windowLight(this, x, h + 5.5, h + 9, false, undefined, true);
      }
    }
    // Из дверей свет падает дорожкой на тротуар.
    lighting.nightGlow(this, this.art(door.x, h + 9, 'light_spill').setOrigin(0.5, 0).setScale(1.3 / ART, 1.4 / ART).setTint(0xffd890), 0.55, undefined, { store: true, map: { scale: 1.1, gain: 1.5, haze: 0.12 } });
    // Главный навес над входом: покупатели проходят под ним.
    this.art(door.x, h + 1, 'awning').setScale(1 / ART, 0.6 / ART).setTint(style.canopy ?? style.awning ?? 0xffffff).setDepth(h + 41);
    if (style.canopy) {
      // Сплошной козырёк над витринами; у супермаркета снизу светится полоса.
      this.add.rectangle(-WALL, h - 1, w + 2 * WALL, 3, style.canopy).setOrigin(0).setStrokeStyle(0.5, 0x181425).setDepth(h + 40);
      this.add.rectangle(-WALL, h + 2, w + 2 * WALL, 1, 0x181425, 0.25).setOrigin(0).setDepth(h + 40);
      if (style.led) {
        this.add.rectangle(-WALL, h + 1.5, w + 2 * WALL, 0.6, 0x9cd8ff).setOrigin(0).setDepth(h + 40.5);
        lighting.nightGlow(this, this.add.rectangle(-WALL, h + 1, w + 2 * WALL, 3, 0x9cd8ff).setOrigin(0), 0.6, undefined, { store: true });
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
    this.obstacles = slots.map((p) => (slotSide(this.layout, p) ? { x: p.x - 10, y: p.y - 24, w: 20, h: 48 } : furniture(p.x, p.y)));
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
    // Вещи, поставленные раньше (автомат, растения), — тоже препятствия.
    for (const prop of this.propList) this.obstacles.push(propRect(prop));
  }

  /** Место вещи зала: своё (перестановка в этом помещении) или стандартное. */
  propAt(id: string, def: { x: number; y: number }): { x: number; y: number } {
    this.propDefaults[id] = def;
    const custom = this.state.propPos?.level === this.state.level ? this.state.propPos.at[id] : undefined;
    return custom ? { x: custom.x, y: custom.y } : def;
  }

  /** Вещь зала, которую можно двигать при перестановке; её «след» — препятствие для обхода (oy — сдвиг картинки по высоте). */
  registerProp(id: string, at: { x: number; y: number }, tex: string, fp: Rect, oy = 0): void {
    this.propList.push({ id, x: at.x, y: at.y, fp, tex, oy });
  }

  /** Стандартное место ведра: правый нижний угол зала (двигается отдельно от кассы). */
  private binDefault(): { x: number; y: number } {
    return { x: this.layout.w - 10, y: this.layout.h - 12 };
  }

  /** Где стоит ведро и уличный контейнер (у роллета склада). */
  private binSpot(): { x: number; y: number } {
    return this.propAt('bin', this.binDefault());
  }

  /** Куда встать, чтобы завязать мешок: со стороны зала. */
  private binStand(): { x: number; y: number } {
    const bin = this.binSpot();
    return { x: bin.x + (bin.x < this.layout.w / 2 ? 16 : -16), y: bin.y + 2 };
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
    this.binGlow = new Halo(this, this.binImg, 0xe43b44);
    this.binStink = this.art(bin.x, bin.y - 14, 'stink').setDepth(bin.y + 30).setVisible(false);
    this.tweens.add({ targets: this.binStink, y: bin.y - 19, alpha: { from: 1, to: 0.35 }, duration: 900, yoyo: true, repeat: -1 });
    this.obstacles.push({ x: bin.x - 8, y: bin.y - 12, w: 16, h: 14 });
    this.registerProp('bin', bin, binSprite(this.state, 0), propFootprint(this.layout, 'bin', bin.x));
    this.refreshBin();
  }

  /**
   * Полка «Уценка»: горка у входа, на свободном месте у нижней стены (или где поставили при перестановке).
   * Модель (gear 'bargain') — сколько на ней рядов по BARGAIN_PER_ROW мест; товар лежит на полках горки.
   * Нажать — снести на неё то, что испортится ночью.
   */
  private buildBargain(): void {
    this.bargainAt = null;
    this.bargainItems = [];
    if (!hasBargain(this.state)) return;
    const { door, h, w } = this.layout;
    const fp = propFootprint(this.layout, 'bargain', 0);
    const zones = [...tillZones(this.layout, registerSlots(this.state), kioskCount(this.state)), ...blockedZones(this.layout)];
    const free = (p: { x: number; y: number }) => {
      const r = { x: p.x + fp.x - 3, y: p.y + fp.y - 16, w: fp.w + 6, h: fp.h + 19 };
      return r.x > 2 && r.x + r.w < w - 2 && ![...this.obstacles, ...zones].some((o) => overlapsRect(r, o));
    };
    const candidates = [-46, -76, 46, 76, -106, 106, -136, 136].map((dx) => ({ x: door.x + dx, y: h - 12 }));
    const def = candidates.find(free) ?? { x: door.x - 46, y: h - 12 };
    const at = this.propAt('bargain', def);
    this.bargainAt = at;
    const rows = bargainRows(this.state);
    const tex = bargainSprite(this.state);
    // Низом — на пол у точки at: у моделей побольше горка растёт вверх.
    const img = this.art(at.x, at.y + BARGAIN_BOTTOM, tex).setOrigin(0.5, 1).setDepth(at.y + 4);
    img.setInteractive({ useHandCursor: true }).on('pointerup', () => this.tap(() => this.sendToBargain(true)));
    this.bargainItems = Array.from({ length: rows * BARGAIN_PER_ROW }, (_, n) => {
      const spot = this.bargainSlot(at, n);
      // Передний ряд — поверх задних.
      return this.art(spot.x, spot.y, 'item').setDepth(at.y + 5 - Math.floor(n / BARGAIN_PER_ROW) * 0.1).setVisible(false);
    });
    this.obstacles.push({ x: at.x + fp.x, y: at.y + fp.y, w: fp.w, h: fp.h });
    this.registerProp('bargain', at, tex, fp, BARGAIN_BOTTOM - img.displayHeight / 2);
    this.refreshBargain();
  }

  /** Место n на горке уценки: ряды по BARGAIN_PER_ROW, первый — передний нижний (art/bargain_shelf.py). */
  private bargainSlot(at: { x: number; y: number }, n: number): { x: number; y: number } {
    const row = Math.floor(n / BARGAIN_PER_ROW);
    const col = n % BARGAIN_PER_ROW;
    // Полка ряда — на BARGAIN_BASE + row × BARGAIN_STEP точек выше низа горки; товар стоит на ней.
    return { x: at.x - 11.25 + col * 4.5, y: at.y + BARGAIN_BOTTOM - BARGAIN_BASE - row * BARGAIN_STEP - 2 };
  }

  /** Где встать покупателю: за горкой, тянется к товару через неё (горка повыше — встаёт дальше). */
  private bargainStand(at: { x: number; y: number }): number {
    return at.y + BARGAIN_BOTTOM - BARGAIN_BASE - bargainRows(this.state) * BARGAIN_STEP - 9;
  }

  /** Товар на полке уценки: по картинке на каждую штуку, передний ряд заполняется первым. */
  private refreshBargain(): void {
    const units = PRODUCT_IDS.flatMap((id) => (this.state.bargain?.[id] ?? []).map(() => id));
    this.bargainItems.forEach((img, n) => {
      if (!img.active) return;
      const id = units[n];
      img.setVisible(Boolean(id));
      if (id) img.setTexture(`item_${id}_${n % ITEM_VARIANTS}`).setScale(0.7 / ART);
    });
  }

  /** Снести на полку уценки то, что испортится ночью (по нажатию — с подсказкой, если нечего). */
  private sendToBargain(byTap = false): void {
    if (!this.bargainAt) return;
    const moved = fillBargain(this.state);
    if (moved.count) {
      this.state = moved.state;
      saveGame(this.state);
      sound.tap();
      this.popup(this.bargainAt.x, this.bargainAt.y - 18, t('popup.bargain', { n: moved.count }), '#ffd0d0');
      this.refreshShelves();
      this.refreshWarehouse();
    } else if (byTap) {
      const full = bargainCount(this.state) >= bargainCapacity(this.state);
      this.popup(this.bargainAt.x, this.bargainAt.y - 18, t(full ? 'popup.bargainFull' : 'popup.bargainNone'), '#fff3b0');
    }
    this.refreshBargain();
  }

  /** Покупатель по пути заглядывает на полку уценки и берёт одну штуку сверх списка — прямо с её места на горке. */
  private async visitBargain(c: Customer): Promise<void> {
    const at = this.bargainAt;
    if (!at || c.thief || !bargainCount(this.state) || Math.random() >= BARGAIN_CHANCE) return;
    await this.walk(c.sprite, at.x + Phaser.Math.Between(-8, 8), this.bargainStand(at));
    await this.wait(400);
    if (c.gone) return;
    const units = PRODUCT_IDS.flatMap((id) => (this.state.bargain?.[id] ?? []).map(() => id));
    const taken = takeBargain(this.state);
    if (!taken) return;
    this.state = taken.state;
    c.items.push({ id: taken.id, unit: taken.unit });
    // Штука улетает в руки с того места, где лежала (берут самую старую — первую этого товара).
    const n = units.indexOf(taken.id);
    const img = this.bargainItems[n];
    const from = img?.active && img.visible ? [{ x: img.x, y: img.y, texture: img.texture.key, scale: img.scaleX, tint: 0xffffff }] : [];
    motion.reachShelf(this, c, { x: at.x, y: at.y - 6 }, taken.id, from);
    if (Math.random() < 0.5) this.popup(c.sprite.x, c.sprite.y - 18, t('popup.bargainTake'), '#ffd0d0');
    this.refreshBargain();
  }

  binFull(): boolean {
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
    effects.puff(this, dump.x, dump.y - 6);
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
      this.add.tileSprite(x, y, ww, hh, this.potTile(key)).setOrigin(0).setTileScale(1 / ART).setDepth(depth);
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
    // Табличка «Сдаётся» с ценой. Новичку первой недели — только когда денег на переезд уже хватает.
    if (cleanHall(this.state) && this.state.money < cost) return;
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
      .setResolution(this.textRes(8))
      .setDepth(signY + 9);
  }

  /** Плакаты на стене, растения и корзинки у входа — чтобы зал не выглядел пустым. */
  /** Первое место, где вещь 26×20 не мешает полкам, кассе, складу и автомату. */
  freeSpot(candidates: { x: number; y: number }[]): { x: number; y: number } | null {
    const { slots, counter } = this.layout;
    const blocked = [
      ...slots.map((s) => ({ x: s.x - 22, y: s.y - 14, w: 44, h: 30 })),
      { x: counter.x - 10, y: counter.y - 28, w: 20, h: 64 },
      ...this.propList.map(propRect),
      // Купленные киоски у правой стены (их ставит buildUpgrades — позже украшений).
      ...(kioskCount(this.state) ? kioskZones(this.layout, kioskCount(this.state)) : []),
    ];
    return (
      candidates.find((c) =>
        blocked.every((b) => c.x + 13 < b.x || c.x - 13 > b.x + b.w || c.y + 10 < b.y || c.y - 10 > b.y + b.h),
      ) ?? null
    );
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
  openRooms(): Room[] {
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
    this.add.tileSprite(left, h, WING_OUTER - WALL, FACADE_H, this.potTile(this.facadeStyle().texture)).setOrigin(0).setTileScale(1 / ART).setDepth(h + 1);
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

  /**
   * Кухня: кафельный фартук, плита (модель — оборудование «Плита»), стол повара с доской и ножом,
   * ящик с овощами и витрина-раздача, где стоят тарелки с готовым. Касание плиты — кто готовит,
   * касание витрины — сколько чего осталось.
   */
  private buildKitchen(): void {
    // Что варилось до перестройки, уже куплено и снято со склада: сразу в витрину.
    this.flushCooking();
    this.kitchenView = undefined;
    const room = this.layout.kitchen;
    if (!room || !kitchenOpen(this.state)) return;
    const { x, y } = room;
    this.add.tileSprite(x + 1, y + 6, 40, 8, 'ktiles').setOrigin(0).setTileScale(1 / ART).setDepth(1.5);
    const stove = this.art(x + 10, y + 23, stoveSprite(this.state)).setDepth(y + 31);
    const table = this.art(x + 33, y + 23, 'ktable').setDepth(y + 29);
    const knife = this.art(table.x - 3, table.y - 2.5, 'kknife').setDepth(y + 30);
    knife.setData('y', knife.y);
    // Ящик с овощами — кладовая кухни: сюда кухня складывает закупленное у поставщиков.
    const crate = this.art(x + 52, y + 24, 'kcrate').setDepth(y + 28);
    const showcase = this.art(x + 16, y + 46.5, 'kshowcase').setDepth(y + 50);
    this.art(showcase.x, showcase.y, 'kshowcase_glass').setDepth(y + 50.6);
    // Кастрюли на конфорках: у электроплитки одна посередине, у газовой и плиты шефа — две спереди.
    const burners = gearTier(this.state, 'stove') ? [-3, 3].map((dx) => ({ x: stove.x + dx, y: stove.y - 3.5 })) : [{ x: stove.x, y: stove.y - 4 }];
    const gas = gearTier(this.state, 'stove') > 0;
    const flames = burners.map((b) =>
      this.add
        .rectangle(b.x, b.y + 0.5, 4, 1, gas ? 0x5fcde4 : 0xf77622)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setVisible(false)
        .setDepth(y + 31.5),
    );
    const pots = burners.map((b) => this.art(b.x, b.y + 1, 'kpot').setOrigin(0.5, 1).setVisible(false).setDepth(y + 32));
    // Огонь плиты отсвечивает на стену и повара: газ — голубым, электроплитка — оранжевым. Сам огонёк
    // дрожит часто (твин в startPots), а отсвет — ступеньками раз в 300 мс и у всех конфорок разом: иначе
    // карту перерисовывали бы каждый кадр, пока варится.
    for (const flame of flames) this.light.follow(flame, { key: 'glow', w: 26, h: 20, dy: -2, power: () => (flame.visible ? (Math.floor(this.time.now / 300) % 2 ? 0.55 : 0.4) * lighting.powerOn(this) : 0) });
    this.kitchenView = { stove, pots, flames, knife, crate, showcase, plates: [], cooking: [], onPass: false };
    stove.setInteractive({ useHandCursor: true }).on('pointerup', () => this.tap(() => this.tapStove()));
    showcase.setInteractive({ useHandCursor: true }).on('pointerup', () => this.tap(() => this.tapShowcase()));
    this.refreshKitchen();
  }

  /**
   * Тарелки на раздаче кухни — только что сваренное, пока повар не переложил на поднос (по тарелке на каждые
   * три порции, восемь в ряд); и тарелки на полке «Еда».
   */
  private refreshKitchen(): void {
    this.refreshFood();
    const k = this.kitchenView;
    if (!k?.showcase.active) return;
    for (const plate of k.plates) plate.destroy();
    k.plates = [];
    const dishes = k.onPass ? k.cooking.flatMap((id) => Array.from({ length: Math.ceil(dishPortions(this.state, id) / 3) }, () => id)).slice(0, 8) : [];
    dishes.forEach((id, i) => {
      // Низ тарелки — на полке за стеклом, на полточки ниже середины витрины (art/kitchen.py).
      const px = k.showcase.x + (7 + i * 6.5 - 28) / 2;
      k.plates.push(this.art(px, k.showcase.y + 0.5, `kdish_${id}`).setOrigin(0.5, 1).setDepth(k.showcase.depth + 0.3 + i * 0.01));
    });
  }

  /** Плита: кто готовит — повар или никто (тогда подсказка: нанять или готовить самому утром). */
  private tapStove(): void {
    const k = this.kitchenView;
    if (!k || !this.running) return;
    const works = kitchenWorking(this.state);
    this.popup(k.stove.x + 8, k.stove.y - 14, works ? t('popup.cookWorks') : t('popup.needCook'), works ? '#fff3b0' : '#ffd0d0');
  }

  /** Раздача и полка «Еда»: сколько каких порций на полке — значками блюд. */
  private tapShowcase(at?: { x: number; y: number }): void {
    const k = this.kitchenView;
    const where = at ?? (k ? { x: k.showcase.x, y: k.showcase.y } : null);
    if (!where) return;
    const text = DISH_IDS.filter((id) => portionsOf(this.state, id) > 0)
      .map((id) => `${DISHES[id].icon}${portionsOf(this.state, id)}`)
      .join(' ');
    this.popup(where.x, where.y - 10, text || t('popup.kitchenEmpty'), '#fff3b0');
  }

  /** Что варилось или несут — сразу на полку «Еда» (зал перестраивают, повара переставляют); кастрюли с плиты. */
  private flushCooking(): void {
    const k = this.kitchenView;
    if (!k) return;
    for (const id of k.cooking.splice(0)) this.state = servePortions(this.state, id);
    k.onPass = false;
    this.stopPots();
    this.refreshKitchen();
  }

  /**
   * Полка «Еда» у входа (модель — оборудование «Полка «Еда»»): у нижней стены рядом с дверью, где свободно
   * (или где поставили при перестановке). Сверху табличка «Еда», в нише — тарелки с готовым. Нажать —
   * сколько чего осталось.
   */
  private buildFood(): void {
    this.foodView = undefined;
    if (!this.layout.kitchen || !kitchenOpen(this.state)) return;
    const { door, h, w } = this.layout;
    const fp = propFootprint(this.layout, 'food', 0);
    // Места под все киоски помещения (и ещё не купленные): полку не ставим туда, где встанет киоск.
    const zones = [...tillZones(this.layout, registerSlots(this.state), kioskSlots(this.state)), ...blockedZones(this.layout)];
    const ice = this.state.shelves.some((sh) => sh.kind === 'icebox') ? [iceboxRect(this.iceboxSpot())] : [];
    // Горка уценки целиком (она выше своего следа) и место её покупателя; где стоят менеджер и охранник.
    const bargain = this.bargainAt;
    const stand = bargain ? [{ x: bargain.x - 15, y: this.bargainStand(bargain) - 4, w: 30, h: bargain.y + 8 - (this.bargainStand(bargain) - 4) }] : [];
    const homes = (['manager', 'guard'] as const).map((role) => this.workerHome(role)).map((p) => ({ x: p.x - 6, y: p.y - 10, w: 12, h: 14 }));
    // Вещи, переставленные игроком в этом помещении (ёлку ставят позже — по своему месту), полка тоже обходит.
    const moved = this.state.propPos?.level === this.state.level ? Object.entries(this.state.propPos.at).filter(([id]) => id !== 'food') : [];
    const placed = moved.map(([id, p]) => propRect({ id, x: p.x, y: p.y, fp: propFootprint(this.layout, id, p.x) }));
    // Тележки и корзинки у входа (buildDecor ставит их по обе стороны двери) — не загораживаем.
    const byDoor = [-46, -26, -24, 26, 46].map((dx) => ({ x: door.x + dx - 11, y: h - 22, w: 22, h: 22 }));
    // Свободно и место покупателя над полкой (там он стоит, когда берёт порцию).
    const free = (p: { x: number; y: number }) => {
      const r = { x: p.x + fp.x - 3, y: p.y + fp.y - 16, w: fp.w + 6, h: fp.h + 19 };
      return r.x > 2 && r.x + r.w < w - 2 && r.y > this.layout.wallH + 4 && ![...this.obstacles, ...zones, ...ice, ...byDoor, ...stand, ...homes, ...placed].some((o) => overlapsRect(r, o));
    };
    // У нижней стены как можно ближе к двери, а если там тесно — в зале повыше, тоже поближе к входу.
    const candidates: { x: number; y: number }[] = [];
    for (let y = h - 12; y > this.layout.wallH + 40; y -= 8) for (let x = 20; x <= w - 20; x += 4) candidates.push({ x, y });
    candidates.sort((a, b) => Math.hypot(a.x - door.x, (a.y - h) * 1.5) - Math.hypot(b.x - door.x, (b.y - h) * 1.5));
    const def = candidates.find(free) ?? { x: door.x + 76, y: h - 12 };
    const at = this.propAt('food', def);
    const tex = foodSprite(this.state);
    const img = this.art(at.x, at.y - 4, tex).setDepth(at.y + 4);
    img.setInteractive({ useHandCursor: true }).on('pointerup', () => this.tap(() => this.tapShowcase({ x: at.x, y: at.y - 14 })));
    // Табличка «Еда» — надпись по центру таблички над нишей (art/kitchen.py).
    this.add
      .text(at.x, at.y - 13.5, t('food.sign'), { fontFamily: UI_FONT, fontSize: '4.5px', fontStyle: 'bold', color: '#fee761' })
      .setOrigin(0.5)
      .setResolution(this.textRes(8))
      .setDepth(at.y + 4.2);
    if (gearTier(this.state, 'foodShelf') === 2) this.art(at.x, at.y - 4, 'food_glass2').setDepth(at.y + 4.6);
    this.foodView = { at, img, plates: [] };
    this.obstacles.push({ x: at.x + fp.x, y: at.y + fp.y, w: fp.w, h: fp.h });
    this.registerProp('food', at, tex, fp);
    this.refreshFood();
  }

  /** Тарелки на полке «Еда»: до десяти в два ряда — сколько их, по заполненности полки; блюда — по порядку меню. */
  private refreshFood(): void {
    const f = this.foodView;
    if (!f?.img.active) return;
    for (const plate of f.plates) plate.destroy();
    f.plates = [];
    const slots = foodSlots(this.state);
    const dishes = DISH_IDS.flatMap((id) => Array.from({ length: Math.ceil((portionsOf(this.state, id) * 10) / slots) }, () => id)).slice(0, 10);
    // Сначала задний ряд, потом передний (в точках картинки полки: низ тарелок — 19 и 23, по x — от 12 через 9).
    dishes.forEach((id, i) => {
      const px = f.at.x + (12 + (i % 5) * 9 - 30) / 2;
      const py = f.at.y - 16 + (i < 5 ? 19 : 23) / 2;
      f.plates.push(this.art(px, py, `kdish_${id}`).setOrigin(0.5, 1).setDepth(f.img.depth + 0.2 + i * 0.01));
    });
  }

  /** Где стоит покупатель (и повар), когда берёт с полки «Еда» или ставит на неё: над полкой. */
  private foodStand(): { x: number; y: number } | null {
    const f = this.foodView;
    return f ? { x: f.at.x, y: f.at.y - 17 } : null;
  }

  /**
   * Покупатель с покупками по пути к кассе заглядывает на полку «Еда» и берёт порцию — платит за неё на
   * кассе. Хотел, а полка пуста, — в отчёт (повар учтёт спрос завтра).
   */
  private async visitFood(c: Customer): Promise<void> {
    const stand = this.foodStand();
    if (!stand || c.thief || this.night || !c.items.length || !wantsDish(this.state, Math.random)) return;
    this.stats.dishWanted = (this.stats.dishWanted ?? 0) + 1;
    await this.walk(c.sprite, stand.x + Phaser.Math.Between(-7, 7), stand.y);
    if (c.gone) return;
    this.setFacing(c.sprite, 'down');
    await this.wait(450);
    if (c.gone) return;
    const took = takeDish(this.state, Math.random);
    if (!took) {
      if (Math.random() < 0.6) this.popup(c.sprite.x, c.sprite.y - 22, t('popup.foodEmpty'), '#ffd0d0');
      return;
    }
    this.state = took.state;
    const d = DISHES[took.dish];
    c.extras = [...(c.extras ?? []), { kind: 'dish', price: d.price, dish: took.dish }];
    // Тарелка с полки перелетает дугой в руки, над полкой — цена порции.
    const from = { x: c.sprite.x, y: c.sprite.y + 10 };
    this.setMood(c.sprite, 'happy', 1400);
    const plate = this.art(from.x, from.y, `kdish_${took.dish}`).setDepth(c.sprite.y + 1);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 360,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const k = tween.getValue() ?? 0;
        plate.setPosition(from.x + (c.sprite.x - from.x) * k, from.y + (c.sprite.y - 3 - from.y) * k - Math.sin(k * Math.PI) * 7).setAlpha(1 - 0.6 * k * k);
      },
      onComplete: () => plate.destroy(),
    });
    motion.priceFlash(this, from.x, from.y - 12, d.price);
    if (Math.random() < 0.5) this.popup(c.sprite.x, c.sprite.y - 24, t('popup.foodTake', { icon: d.icon, name: t(`dish.${took.dish}` as TextKey) }), '#c8ffb0');
    sound.place('glass', 0, c.sprite.x);
    this.refreshFood();
  }

  /** На плиту: кастрюли (блины и сырники — на сковороде), огонь под ними, пар и шкворчание. */
  private startPots(dishes: DishId[]): void {
    const k = this.kitchenView;
    if (!k) return;
    k.pots.forEach((pot, i) => {
      const id = dishes[i];
      const pan = id === 'pancakes' || id === 'syrniki';
      pot.setTexture(pan ? 'kpan' : 'kpot').setOrigin(pan ? 0.4 : 0.5, 1).setVisible(Boolean(id));
      k.flames[i].setVisible(Boolean(id)).setAlpha(0.8);
      if (id) this.tweens.add({ targets: k.flames[i], alpha: 0.35, duration: 180, yoyo: true, repeat: -1 });
    });
    sound.hiss(Math.min(2.5, stoveSeconds(this.state) * 0.4), 1200, 0.03, k.stove.x);
    // Пар — облачками над каждой кастрюлей (сероватый: на белом кафеле белый не видно); в лёгкой графике реже.
    k.stopSteam?.();
    k.stopSteam = this.worldTimer(this.lite ? 700 : 320, () => {
      for (const pot of k.pots) if (pot.visible && pot.active) this.steamPuff(pot.x + Phaser.Math.FloatBetween(-1.5, 1.5), pot.y - 5, 0xc0cbdc);
    });
  }

  private stopPots(): void {
    const k = this.kitchenView;
    if (!k) return;
    k.stopSteam?.();
    k.stopSteam = undefined;
    for (const pot of k.pots) if (pot.active) pot.setVisible(false);
    for (const flame of k.flames) {
      if (!flame.active) continue;
      this.tweens.killTweensOf(flame);
      flame.setVisible(false);
    }
  }

  /**
   * Повар: по меню дня решает, что поставить (kitchen.ts, cookBatch). Не хватает продуктов — кухня докупает
   * их в кладовую (из кассы). Берёт из ящика-кладовой (нет денег — со склада и с полок зала), режет на доске,
   * варит на плите — над кастрюлями пар, — ставит тарелки на раздачу, перекладывает на поднос и несёт
   * на полку «Еда» у входа. Под вечер и ночью новое не начинает: не успеет продаться — спишется.
   */
  private async cookLoop(w: Worker, gen: number): Promise<void> {
    while (this.alive(gen)) {
      const k = this.kitchenView;
      // Через сколько закладка будет на полке: варка — по плите, нарезка и дорога — по шагу повара.
      const ready = stoveSeconds(this.state) + COOK_LATE / this.workerPace(w);
      const open = this.running && !this.night && Boolean(k?.stove.active) && Boolean(this.foodView) && this.timeLeft > ready;
      const left = this.timeLeft / DAY_SECONDS;
      // Что поставил бы, будь всё в кладовой, — на это кухня и докупает.
      const wish = open ? cookBatch(this.state, left, ready / DAY_SECONDS, undefined, true) : [];
      if (k && wish.length) this.topUpPantry(k, wish);
      const plan = wish.length ? cookBatch(this.state, left, ready / DAY_SECONDS) : [];
      if (!k || !plan.length) {
        // Надо готовить, а продуктов не купить (денег нет) — раз в день повар об этом говорит.
        if (wish.length && this.cookNoFoodDay !== this.state.day) {
          this.cookNoFoodDay = this.state.day;
          this.popup(w.sprite.x, w.sprite.y - 18, t('popup.cookNoFood'), '#ffd0d0');
        }
        await this.cookIdle(w);
        continue;
      }
      const taken = await this.fetchIngredients(w, gen, k, plan);
      if (!this.alive(gen)) return;
      if (!taken.length) continue;
      // Режет на доске: корзинку — на стол, сам — у края стола боком к доске, чтобы нож было видно.
      await this.workerWalk(w, w.home.x, w.home.y);
      if (!this.alive(gen)) return;
      w.carried.setVisible(false);
      this.setFacing(w.sprite, 'left');
      await this.chop(w, gen, k, taken);
      if (!this.alive(gen)) return;
      // К плите: встаёт сбоку (кастрюли и пар не загораживает) и, пока варится, помешивает.
      await this.workerWalk(w, k.stove.x + 11, w.home.y);
      if (!this.alive(gen)) return;
      this.setFacing(w.sprite, 'left');
      this.startPots(taken);
      const stir = Math.max(1, Math.round(stoveSeconds(this.state) / 1.5));
      for (let i = 0; i < stir; i++) {
        motion.squash(this, w.sprite, 1.04, 0.96, 140);
        await this.wait((stoveSeconds(this.state) * 1000) / stir);
        if (!this.alive(gen)) return;
      }
      this.stopPots();
      // Магазин закрылся, пока варилось: сваренное уже на полке (flushCooking) — нести нечего.
      if (!k.cooking.length) continue;
      sound.ding(k.stove.x);
      // Готовое — по тарелкам на раздачу, оттуда — на поднос.
      await this.workerWalk(w, k.showcase.x + 4, k.showcase.y - 8);
      if (!this.alive(gen)) return;
      this.setFacing(w.sprite, 'down');
      k.onPass = true;
      this.refreshKitchen();
      sound.place('glass', 1, k.showcase.x);
      await this.workerWait(w, PLACE_MS * 2);
      if (!this.alive(gen)) return;
      k.onPass = false;
      this.refreshKitchen();
      w.carried.setTexture('kplates').setPosition(0, 1).setVisible(true);
      // С подносом — через дверь кухни в зал, к полке «Еда» у входа.
      await this.carryToFood(w, gen, k);
      if (!this.alive(gen)) return;
    }
  }

  /** Кухня докупает в кладовую то, чего не хватает на закладки plan, — из кассы; у ящика — коробка и надпись. */
  private topUpPantry(k: KitchenView, plan: DishId[]): void {
    const top = topUpKitchen(this.state, plan);
    if (!top.spent) return;
    this.state = top.state;
    this.stats.kitchenSpent = (this.stats.kitchenSpent ?? 0) + top.spent;
    this.popup(k.crate.x, k.crate.y - 12, t('popup.kitchenBought', { n: top.spent }), '#fff3b0');
    motion.squash(this, k.crate, 1.08, 0.92, 120);
    sound.place('bump', 1, k.crate.x);
  }

  /**
   * Повар несёт поднос на полку «Еда»: из кухни через дверь в зал, ставит тарелки (порции — на полку)
   * и возвращается на кухню. Полки нет (зал перестроили) — сваренное и так уже на ней (flushCooking).
   */
  private async carryToFood(w: Worker, gen: number, k: KitchenView): Promise<void> {
    const room = this.layout.kitchen!;
    await this.workerWalkVia(w, [room.inside, room.doorway]);
    if (!this.alive(gen)) return;
    const stand = this.foodStand();
    if (stand) {
      await this.workerWalk(w, stand.x + 4, stand.y);
      if (!this.alive(gen)) return;
      this.setFacing(w.sprite, 'down');
      await this.workerWait(w, PLACE_MS);
      if (!this.alive(gen)) return;
    }
    w.carried.setVisible(false).setTexture('box').setPosition(0, 3);
    const at = this.foodStand() ?? { x: w.sprite.x, y: w.sprite.y };
    k.cooking.splice(0).forEach((id, i) => {
      const before = portionsOf(this.state, id);
      this.state = servePortions(this.state, id);
      const text = t('popup.cooked', { icon: DISHES[id].icon, name: t(`dish.${id}` as TextKey), n: portionsOf(this.state, id) - before });
      this.time.delayedCall(i * 450, () => this.popup(at.x, at.y - 8, text, '#c8ffb0'));
    });
    this.refreshKitchen();
    sound.place('glass', 1, at.x);
    await this.workerWalkVia(w, [room.doorway, room.inside, w.home]);
  }

  /** Готовить нечего — стоит у стола. */
  private async cookIdle(w: Worker): Promise<void> {
    if (Phaser.Math.Distance.Between(w.sprite.x, w.sprite.y, w.home.x, w.home.y) > 2) await this.workerWalk(w, w.home.x, w.home.y);
    this.setFacing(w.sprite, 'up');
    await this.wait(600);
  }

  /**
   * За продуктами на всю закладку: всё есть в кладовой — к ящику на кухне; нет (денег на закупку не было) —
   * на склад, а чего там не хватает — к полке в зале. Снимает их в последней точке пути; чего уже нет
   * (разобрали, пока шёл) — того блюда не будет. Возвращает, что взял в работу.
   */
  private async fetchIngredients(w: Worker, gen: number, k: KitchenView, plan: DishId[]): Promise<DishId[]> {
    const room = this.layout.kitchen!;
    const store = this.layout.warehouse;
    const need = new Map<ProductId, number>();
    for (const id of plan) for (const [p, n] of Object.entries(DISHES[id].needs)) need.set(p as ProductId, (need.get(p as ProductId) ?? 0) + (n ?? 0));
    // Кладовой хватает на всю закладку сразу (два блюда могут делить продукт).
    const pantry = [...need].every(([p, n]) => pantryOf(this.state, p) >= n);
    const fromStore = !pantry && [...need.keys()].some((p) => warehouseOf(this.state, p) > 0);
    const short = pantry ? undefined : [...need].find(([p, n]) => warehouseOf(this.state, p) < n)?.[0];
    const shelf = short ? this.state.shelves.findIndex((sh) => !sh.broken && (sh.items[short]?.length ?? 0) > 0) : -1;
    if (pantry) {
      // Ящик-кладовая в углу кухни: встаёт перед ним и набирает корзинку.
      await this.workerWalk(w, k.crate.x - 2, w.home.y);
      this.setFacing(w.sprite, 'up');
      await this.workerWait(w, 450);
    } else {
      await this.workerWalk(w, room.inside.x, room.inside.y);
      await this.workerWalk(w, room.doorway.x, room.doorway.y);
    }
    if (fromStore) {
      await this.workerWalk(w, store.doorway.x, store.doorway.y);
      await this.workerWalk(w, store.inside.x, store.inside.y);
      await this.workerWait(w, 450);
    }
    if (shelf >= 0) {
      // Со склада в зал — обратно через дверь, а не наискосок сквозь стену флигеля.
      if (fromStore) await this.workerWalk(w, store.doorway.x, store.doorway.y);
      const stand = standFor(this.layout, this.spotOf(shelf));
      await this.workerWalk(w, stand.x, stand.y - 2);
      await this.workerWait(w, PLACE_MS);
    }
    // Пока ходил, магазин закрылся: варить уже нечего — к ночи всё равно спишется.
    if (!this.alive(gen) || !this.running || this.night) return [];
    const taken: DishId[] = [];
    for (const id of plan) {
      const next = takeIngredients(this.state, id);
      if (!next) continue;
      this.state = next;
      taken.push(id);
    }
    if (taken.length) {
      // Уже снято из кладовой (со склада): если зал перестроят, пока варится, — сразу на полку (flushCooking).
      k.cooking.push(...taken);
      if (!pantry) {
        this.refreshWarehouse();
        this.refreshShelves();
      }
      w.carried.setTexture('kbasket').setPosition(0, 1).setVisible(true);
      sound.place('bump', 0, w.sprite.x);
    }
    if (pantry) return taken;
    if (fromStore && shelf < 0) await this.workerWalk(w, store.doorway.x, store.doorway.y);
    await this.workerWalk(w, room.doorway.x, room.doorway.y);
    await this.workerWalk(w, room.inside.x, room.inside.y);
    return taken;
  }

  /** Нарезка: нож стучит по доске, кусочки подпрыгивают — цвета продуктов закладки. */
  private async chop(w: Worker, gen: number, k: KitchenView, dishes: DishId[]): Promise<void> {
    const knife = k.knife;
    if (!knife.active) return;
    const base = knife.getData('y') as number;
    const colors = dishes.flatMap((id) => Object.keys(DISHES[id].needs).map((p) => PRODUCTS[p as ProductId].color));
    for (let i = 0; i < 5 * dishes.length && this.alive(gen); i++) {
      this.tweens.add({ targets: knife, y: base - 1.5, duration: 80, yoyo: true, ease: 'Quad.easeOut', onComplete: () => void (knife.active && knife.setY(base)) });
      if (i % 2 === 0) {
        sound.place('bump', i % 4, knife.x);
        motion.squash(this, w.sprite, 1.03, 0.97, 90);
      }
      if (!this.lite) {
        const bit = this.add.rectangle(knife.x - 2 + Math.random() * 3, knife.y, 1, 1, colors[i % colors.length]).setDepth(knife.depth + 1);
        this.tweens.add({ targets: bit, y: bit.y - 2.5, x: bit.x + Phaser.Math.FloatBetween(-2, 2), alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => bit.destroy() });
      }
      await this.workerWait(w, 240);
    }
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
    if (open || !cleanHall(this.state)) this.roomSign(x, y + 7, w, t(`wing.${kind}`));
    if (open) {
      lighting.nightGlow(this, this.art(x + w / 2, y + 26, 'glow').setScale(44 / 64).setTint(kind === 'bakery' ? 0xffd8a0 : 0xffe8c8), 0.5, undefined, { store: true, map: { scale: 1.3, gain: 0.8, haze: 0.12 } });
      // Мелочи: на стене слева от таблички — меню, банки или сковородки; у двери — коврик.
      this.art(x + 13, y + 7, kind === 'coffee' ? 'menu_chalk' : kind === 'bakery' ? 'jar_shelf' : 'pot_rack').setDepth(2);
      if (kind === 'bakery') this.art(x + w - 8, y + h - 8, 'flour_sacks').setDepth(y + h - 2);
      this.add.rectangle(x + w - 3, room.doorway.y, 4, 14, 0x9e5b33).setStrokeStyle(1, 0x5a3420).setDepth(1.5);
      return;
    }
    this.add.rectangle(x, y + 16, w, h - 16, 0x1d1a26, 0.62).setOrigin(0).setDepth(y + h);
    // Первая неделя новичка в киоске: закрытая комната — тихий силуэт, без замка и «закрыта» (firstday.ts).
    if (cleanHall(this.state)) return;
    this.add
      .text(x + w / 2, y + h / 2 + 6, `🔒\n${t(`wing.${kind}Locked`)}`, { fontFamily: UI_FONT, fontSize: '5px', color: '#c0cbdc', align: 'center' })
      .setOrigin(0.5)
      .setResolution(this.textRes(4))
      .setDepth(y + h + 1);
  }

  /**
   * Табличка комнаты флигеля по ширине надписи — у двери в зал (справа): её видно,
   * даже когда флигель в кадре краем.
   */
  private roomSign(x: number, y: number, w: number, text: string): void {
    const label = this.add.text(0, y, text, { fontFamily: UI_FONT, fontSize: '6px', fontStyle: 'bold', color: '#fee761' }).setOrigin(0.5).setResolution(this.textRes(4));
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
    lighting.nightGlow(this, this.art(x + w / 2, y + 10, 'glow').setScale(40 / 64).setTint(0xfff0c8), 0.5, undefined, { store: true, map: { scale: 1.3, gain: 0.8, haze: 0.12 } });
    this.roomSign(x, y + 7, w, t('warehouse.label'));
  }

  /**
   * Создаёт картинки для новых полок и обновляет товар на всех. Штука товара узнаётся по месту в своём
   * товаре (третий батон — всегда третий батон): взяли одну — остальные съезжают на освободившееся
   * место (slide). При выкладке (stockShelf) не съезжают — там штуки сами летят из рук.
   */
  refreshShelves(slide = true): void {
    // Разбитое толчком падает раньше, чем полку перерисуют: иначе его картинку займёт уцелевшая штука.
    this.quakeFlush?.();
    this.layout.slots.forEach((slot, i) => {
      // Свободное место под полку — разметка на полу: полку покупают утром во вкладке «Зал».
      if (!this.slotDecor[i]) {
        const mark = this.art(slot.x, slot.y + 2, 'slot_empty').setDepth(1.5).setAngle(slotSide(this.layout, slot) ? 90 : 0);
        mark.setInteractive({ useHandCursor: true }).on('pointerup', () =>
          this.tap(() => i >= this.regularShelves() && this.popup(slot.x, slot.y - 8, t('popup.slotEmpty'), '#fff3b0')),
        );
        this.slotDecor[i] = mark;
      }
      this.slotDecor[i].setVisible(i >= this.regularShelves() && this.slotShown());
    });
    // Полок стало меньше (продали) — лишние картинки убираем.
    const sold = this.shelfViews.splice(this.state.shelves.length);
    for (const view of sold) this.destroyShelfView(view);
    // Мебель в зале поменялась — тени на полу запечь заново (в пересборке зала — потом, разом).
    let moved = sold.length > 0;
    this.state.shelves.forEach((shelf, i) => {
      let view = this.shelfViews[i];
      const at = this.spotOf(i);
      // Полку пересобираем, если сменился тип или место (после продажи соседней).
      if (!view || view.kind !== shelf.kind || view.at.x !== at.x || view.at.y !== at.y) {
        if (view) this.destroyShelfView(view);
        view = this.buildShelf(i, shelf.kind);
        this.shelfViews[i] = view;
        moved = true;
      }

      const capacity = shelfCapacity(shelf);
      const perRow = capacity / 2;
      const area = ITEM_AREA[shelf.kind] ?? { x: -17, w: 34, y: -5, row: 11 };
      const step = area.w / perRow;
      // Где на полке просторно, товар крупнее — его лучше видно; плотная полка — обычный размер.
      const size = (shelf.kind === 'florist' ? 1 : Phaser.Math.Clamp(step / 4, 1, 1.3)) / ART;
      const slot = at;
      const side = shelf.kind !== 'florist' && shelf.kind !== 'icebox' && slotSide(this.layout, slot) !== null;
      const units = PRODUCT_IDS.flatMap((id) => (shelf.items[id] ?? []).map((unit, k) => ({ id, unit, k })));
      const covered = false;
      // Где какая штука стояла до обновления (там, где видна сейчас — даже на полпути съезда).
      const was = new Map<string, { x: number; y: number; bx: number; by: number }>();
      if (slide && !this.lite) {
        view.items.forEach((img, n) => {
          const key = img.getData('stock') as string | null | undefined;
          if (key && img.visible && !img.getData('flying')) was.set(key, { x: img.x, y: img.y, bx: view.backItems[n].x, by: view.backItems[n].y });
        });
      }
      view.items.forEach((img, n) => {
        const entry = units[n];
        const florist = shelf.kind === 'florist';
        img.setVisible(!covered && n < (florist ? FLORIST_SPOTS.length : capacity) && Boolean(entry));
        if (florist) {
          const [dx, dy] = FLORIST_SPOTS[n % FLORIST_SPOTS.length];
          img.setPosition(slot.x + dx, slot.y + dy);
        } else if (side) {
          // Боковая полка: товар двумя столбиками вдоль полки, сверху вниз.
          const rows = Math.ceil(capacity / 2);
          img.setPosition(slot.x + (n % 2 ? 3 : -3), slot.y - 18 + (32 / rows) * (Math.floor(n / 2) + 0.5));
        } else img.setPosition(slot.x + area.x + step * ((n % perRow) + 0.5), slot.y + area.y + Math.floor(n / perRow) * area.row);
        // Вид штуки — по её месту в своём товаре, а не на полке: съезжая, батон остаётся тем же батоном.
        const variant = entry ? entry.k + PRODUCT_IDS.indexOf(entry.id) : 0;
        if (entry) {
          // Три вида каждого товара (батон, багет, булка…) — полка выглядит живой.
          img.setTexture(`item_${entry.id}_${variant % ITEM_VARIANTS}`).setScale(side ? 0.85 / ART : size);
          img.setTint(entry.unit.markdown ? 0xffe08a : entry.unit.bad ? 0x9a8a80 : 0xffffff);
        }
        // Позади — такой же товар чуть выше и в тени, между передними.
        const back = view.backItems[n];
        back.setVisible(img.visible && shelf.kind !== 'florist' && !side);
        if (entry) {
          back.setPosition(Math.min(img.x + step / 2, slot.x + area.x + area.w - 2), img.y - 2);
          back.setTexture(`item_${entry.id}_${(variant + 1) % ITEM_VARIANTS}`).setScale(size);
        }
        const key = img.visible && entry ? `${entry.id}:${entry.k}` : null;
        img.setData('stock', key);
        const from = key ? was.get(key) : undefined;
        // Подпрыгивает с полкой — по высоте не сравниваем: прыжок сам вернёт её на место.
        // Дрожь от толчка (до QUAKE_SHAKE_PX вбок) — не переезд: штука и так стоит на своём месте.
        if (from && (Math.abs(from.x - img.x) > QUAKE_SHAKE_PX || (from.y !== img.y && !img.getData('hopping')))) {
          motion.slideItem(this, img, from);
          if (back.visible) motion.slideItem(this, back, { x: from.bx, y: from.by });
        }
      });
      view.pips.forEach((pip, n) => pip.setVisible(n < shelf.level));
      view.promo.setVisible(PRODUCT_IDS.some((id) => canPlace(id, shelf) && promoKind(this.state, id)));
      const few = !shelf.broken && units.length > 0 && units.length <= LOW_STOCK;
      // Пустая полка — серая табличка «пусто»: видно, что кончился товар, а не что полка сломана.
      const empty = !shelf.broken && units.length === 0 && shelf.kind !== 'florist';
      if (few) view.low.setText(t('shelf.low', { n: units.length })).setBackgroundColor('#d95763');
      else if (empty) view.low.setText(t('shelf.empty')).setBackgroundColor('#5a6988');
      view.low.setVisible(few || empty);
      if (view.meter) this.drawMeter(view.meter, units.length, capacity, Boolean(shelf.broken));
      view.expire.setVisible(!shelf.broken && expiringIn(this.state, shelf.items) > 0);
      view.needsStock = !shelf.broken && units.length === 0 && PRODUCT_IDS.some((id) => canPlace(id, shelf) && (this.state.warehouse[id]?.length ?? 0) > 0);
      view.bg.setTint(shelf.broken ? BROKEN_TINT : SHELF_LOOK[shelf.kind].tint);
    });
    // В перестановке тени спрятаны (там «призраки») — запечём, когда расстановку примут.
    if (moved && this.floor.ready() && !this.arranging) this.bakeFloor();
  }

  private buildShelf(index: number, kind: Category): ShelfView {
    const slot = this.spotOf(index);
    const look = SHELF_LOOK[kind];
    const fixture = SHELF_KINDS[kind].fixture;
    if (!fixture && slotSide(this.layout, slot)) return this.buildSideShelf(index, kind, slot);
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
      .setResolution(this.textRes(6))
      .setDepth(990)
      .setAngle(-8)
      .setVisible(false);
    this.tweens.add({ targets: promo, angle: 8, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const glow = new Halo(this, bg, 0xfee761);
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
      .setResolution(this.textRes(6))
      .setDepth(990)
      .setVisible(false);
    this.tweens.add({ targets: low, y: low.y - 1.5, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const expire = this.add
      .text(slot.x, slot.y - 30, t('shelf.expiring'), { fontFamily: UI_FONT, fontSize: '5px', fontStyle: 'bold', color: '#2b2233', backgroundColor: '#fee761', padding: { x: 2, y: 1 } })
      .setOrigin(0.5)
      .setResolution(this.textRes(6))
      .setDepth(991)
      .setVisible(false);
    expire.setInteractive({ useHandCursor: true }).on('pointerup', () => this.tap(() => this.markdownNow(expire.x, expire.y)));
    const lights: Phaser.GameObjects.GameObject[] = [];
    // Плиточная вставка отдела в полу под полкой и перед ней, шириной с полку (art/livefloor.py): узор
    // и кайма в тон отдела. У задней стены вставка начинается от плинтуса — на стену не заходит.
    const tileTop = Math.max(slot.y - 11, this.layout.wallH);
    if (!fixture) lights.push(this.deptInlay(`deptfloor_${kind}`, slot.x, slot.y + 19, 30, slot.y + 19 - tileTop));
    // На мраморе низ полки отражается в полу — бледно и перевёрнуто.
    if (!fixture && this.glossyFloor) {
      // Только самый низ полки и коротко: блик у основания, а не призрачная копия полки.
      const mirror = this.art(slot.x, slot.y - top + 32, look.texture).setTint(look.tint).setFlipY(true).setAlpha(0.1).setDepth(0.6);
      mirror.setCrop(0, 50, 80, 14);
      lights.push(mirror);
    }
    // Крупный значок отдела поверх таблички на шапке: молоко, мясо и заморозку не спутать.
    if (!fixture) lights.push(this.art(slot.x, slot.y - top - 13, `dept_${kind}`).setDepth(d - 11.9));
    // Вечером над рядами товара на обычном стеллаже тлеют тёплые полоски подсветки — под каждой
    // полкой, над верхушками товара (furnitureLight). Ряды товара — на slot.y − 5 и slot.y + 6.
    if (!fixture && look.texture !== 'fridge' && !this.lite) {
      this.shelfStrips = this.shelfStrips.filter((strip) => strip.active);
      for (const dy of [-9.5, 1.5]) {
        const strip = this.art(slot.x, slot.y + dy, 'glow').setDisplaySize(34, 3).setTint(0xffd890).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(d - 12.5);
        this.shelfStrips.push(strip);
        lights.push(strip);
      }
      lighting.furnitureLight(this);
    }
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
      // Время от времени по стеклу пробегает блик — холодильник выглядит стеклянным, а не нарисованным.
      if (!this.lite) {
        const glint = this.add.rectangle(slot.x - 15, slot.y - 2, 2, 17, 0xffffff, 0.5).setAngle(18).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(slot.y - 12.3);
        this.tweens.add({
          targets: glint,
          x: slot.x + 15,
          alpha: { from: 0.55, to: 0 },
          duration: 900,
          delay: 2500 + ((index * 1700) % 5000),
          repeatDelay: 7000 + ((index * 911) % 5000),
          repeat: -1,
          ease: 'Sine.easeIn',
        });
        lights.push(glint);
      }
    }
    // Тень от полки на пол запекается вместе с полом (bakeFloor): свет сверху слева — вниз и вправо.
    if (fixture) lighting.shelfLight(this, bg, kind, 50, 40, 4);
    else lighting.shelfLight(this, bg, kind, 58, 50, look.texture === 'fridge' ? 10 : 6);
    return { kind, at: { x: slot.x, y: slot.y }, cover, bg, front, shadow, items, backItems, pips, lights, low, expire, promo, glow, needsStock: false };
  }

  /**
   * Плиточная вставка отдела в полу (art/livefloor.py) нижним краем на bottom; full — её высота
   * в мире, visible — сколько видно (у задней стены верх срезан плинтусом). Лежит на плитке под
   * тенями пола (bakeFloor) — и мебель отбрасывает тень на вставку, как на пол.
   */
  private deptInlay(key: string, x: number, bottom: number, full: number, visible: number): Phaser.GameObjects.Image {
    const img = this.art(x, bottom, key).setOrigin(0.5, 1).setDepth(DEPT_INLAY_DEPTH);
    if (visible < full) img.setCrop(0, (full - visible) * ART, img.width, visible * ART);
    return img;
  }

  /**
   * Полка боком у боковой стены: сверху видна длинная полка с отсеками, к нам — торец; товар
   * раскладывается столбиками, покупатель подходит сбоку. У правой стены — зеркально.
   */
  private buildSideShelf(index: number, kind: Category, slot: { x: number; y: number }): ShelfView {
    const look = SHELF_LOOK[kind];
    const right = slotSide(this.layout, slot) === 'right';
    const d = slot.y + 18;
    const shadow = this.art(slot.x, slot.y + 2, 'shadow_wide').setScale(0.5 / ART, 1.2 / ART).setAngle(90).setDepth(slot.y - 30);
    const bg = this.art(slot.x, slot.y, `${look.texture}_side`).setTint(look.tint).setFlipX(right).setDepth(d - 14);
    const front = this.art(slot.x, slot.y, 'item').setVisible(false);
    bg.setInteractive({ useHandCursor: true }).on('pointerup', () => this.tap(() => this.restockShelf(index)));
    const items = Array.from({ length: SHELF_LEVELS[SHELF_LEVELS.length - 1].capacity }, () => this.art(slot.x, slot.y, 'item').setDepth(d - 13));
    const backItems = items.map(() => this.art(slot.x, slot.y, 'item').setVisible(false));
    const pips = [0, 1, 2].map((n) => this.art(slot.x - 4 + n * 4, slot.y - 26, 'pip').setDepth(d - 12));
    const label = (text: string, dy: number, bgColor: string, color = '#ffffff') =>
      this.add
        .text(slot.x + (right ? -10 : 10), slot.y + dy, text, { fontFamily: UI_FONT, fontSize: '5px', fontStyle: 'bold', color, backgroundColor: bgColor, padding: { x: 2, y: 1 } })
        .setOrigin(0.5)
        .setResolution(this.textRes(6))
        .setDepth(990)
        .setVisible(false);
    const promo = label(t('shelf.promo'), -26, '#e43b44');
    const low = label('', -18, '#d95763');
    const expire = label(t('shelf.expiring'), -34, '#fee761', '#2b2233');
    expire.setInteractive({ useHandCursor: true }).on('pointerup', () => this.tap(() => this.markdownNow(expire.x, expire.y)));
    const glow = new Halo(this, bg, 0xfee761);
    const lights: Phaser.GameObjects.GameObject[] = [
      this.deptInlay(`deptfloor_${kind}_side`, slot.x + (right ? -6 : 6), slot.y + 25, 50, 50),
      this.art(slot.x, slot.y - 24, `dept_${kind}`).setScale(0.7 / ART).setDepth(d - 11.9),
    ];
    const meter = this.add.graphics({ x: slot.x + (right ? -12 : 12), y: slot.y }).setDepth(d - 11);
    lighting.shelfLight(this, bg, kind, 40, 70, 0);
    return { kind, at: { x: slot.x, y: slot.y }, cover: undefined, bg, front, shadow, items, backItems, pips, lights, low, expire, promo, glow, needsStock: false, meter };
  }

  /** Шкала запаса боковой полки: зелёная — полно, жёлтая — половина, красная — пора нести товар. */
  private drawMeter(meter: Phaser.GameObjects.Graphics, units: number, capacity: number, broken: boolean): void {
    const H = 36;
    const share = capacity > 0 ? Math.min(1, units / capacity) : 0;
    const color = broken ? 0x8b9bb4 : share > 0.5 ? 0x63c74d : share > 0.2 ? 0xfee761 : 0xe43b44;
    const fill = Math.round(H * share);
    meter.clear();
    meter.fillStyle(0x2b2233, 0.75).fillRect(-1.5, -H / 2 - 1, 3, H + 2);
    if (fill > 0) meter.fillStyle(color, 1).fillRect(-0.5, H / 2 - fill, 1, fill);
    // Пустая полка — красная точка внизу шкалы, чтобы было видно издалека.
    else if (!broken) meter.fillStyle(0xe43b44, 1).fillRect(-1, H / 2 - 2, 2, 2);
  }

  /** Уценить всё, что испортится ночью (на полках и складе), прямо в зале — по ценнику «⏳». */
  private markdownNow(x: number, y: number): void {
    // Есть полка уценки — старое уходит туда, под табличку «АКЦИЯ».
    if (this.bargainAt && fillBargain(this.state).count) {
      this.sendToBargain();
      return;
    }
    const { state, count } = markdownExpiring(this.state);
    if (!count) return;
    this.state = state;
    saveGame(state);
    sound.coin();
    this.popup(x, y - 6, t('popup.markdown', { n: count }), '#fff3b0');
    this.refreshShelves();
  }

  private destroyShelfView(view: ShelfView): void {
    for (const obj of [view.bg, view.front, view.shadow, view.low, view.expire, view.promo, view.cover, view.meter, ...view.items, ...view.backItems, ...view.pips, ...view.lights]) obj?.destroy();
  }

  /** Сколько обычных полок стоит на местах в зале (ларь и вёдра — не в счёт). */
  private regularShelves(): number {
    return this.state.shelves.filter((s) => !SHELF_KINDS[s.kind].fixture).length;
  }

  /** Где стоит полка: на своём месте в зале, ларь — в зале слева от входа, вёдра с цветами — у кассы. */
  /** Связи соседних полок (пары и неудачное соседство) — по номерам мест. */
  private links(): Link[] {
    const kinds = this.state.shelves.filter((sh) => !isFixture(sh)).map((sh) => sh.kind);
    return shelfLinks(this.layout.slots.slice(0, kinds.length).map((p) => slotRect(this.layout, p)), kinds);
  }

  /** Номер полки (в state.shelves) на месте slot. */
  private shelfAtSlot(slot: number): number {
    return this.state.shelves.findIndex((_, i) => slotOf(this.state, i) === slot);
  }

  /** Рядом с этой полкой еды стоит химия. */
  private clashes(index: number): boolean {
    const slot = slotOf(this.state, index);
    if (slot < 0 || this.state.shelves[index].kind === 'household') return false;
    return this.links().some((l) => l.kind === 'clash' && (l.a === slot || l.b === slot));
  }

  /** Что прихватить заодно с соседней полки-пары (или ничего). */
  private pairPick(index: number, wanted: ProductId[]): { id: ProductId; index: number } | null {
    const slot = slotOf(this.state, index);
    if (slot < 0 || Math.random() >= PAIR_CHANCE) return null;
    const partners = this.links()
      .filter((l) => l.kind === 'pair' && (l.a === slot || l.b === slot))
      .map((l) => this.shelfAtSlot(l.a === slot ? l.b : l.a))
      .filter((i) => i >= 0 && !this.state.shelves[i].broken);
    const options = partners.flatMap((i) =>
      PRODUCT_IDS.filter((id) => !wanted.includes(id) && (this.state.shelves[i].items[id]?.length ?? 0) > 0).map((id) => ({ id, index: i })),
    );
    return options.length ? options[Math.floor(Math.random() * options.length)] : null;
  }

  /** Вещь на стене (центр x, полуширина half) целиком за полкой у задней стены — её не вешаем, чтобы не торчал краешек. */
  behindShelf(x: number, half = 6): boolean {
    const n = this.state.shelves.filter((sh) => !isFixture(sh)).length;
    return this.layout.slots.slice(0, n).some((p) => p.y === WALL_ROW_Y && Math.abs(p.x - x) < 20 + half);
  }

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
    // Обычная полка — снизу, боковая у стены — сбоку (placement.ts).
    return standFor(this.layout, p);
  }

  /** Путь из зала к полке. */
  private routeTo(index: number): { x: number; y: number }[] {
    return [this.standOf(index)];
  }

  /**
   * Ларь с мороженым — у кассы: у правой стены рядом с очередью, в тесном зале — у нижней стены
   * поближе к кассе; там, где он не задевает места под полки и кассы (layout.ts, iceboxSpotFor).
   */
  iceboxSpot(): { x: number; y: number } {
    // Вещи, переставленные игроком в этом помещении, ларь обходит (как и при перестановке).
    const moved = this.state.propPos?.level === this.state.level ? Object.entries(this.state.propPos.at) : [];
    const avoid = moved.map(([id, p]) => propRect({ id, x: p.x, y: p.y, fp: propFootprint(this.layout, id, p.x) }));
    return iceboxSpotFor(this.layout, registerSlots(this.state), avoid, kioskCount(this.state));
  }

  /** Вёдра с цветами — у кассы, в углу у правой стены. */
  private floristSpot(): { x: number; y: number } {
    const { counter, h } = this.layout;
    return { x: counter.x + 20, y: h - 40 };
  }

  refreshWarehouse(): void {
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

  /**
   * Картинка для полосы-плитки (фасад, забор, гирлянда). Phaser растягивает плитку до степени двойки
   * (32×20 → 32×32), и ряды пикселей выходят разной высоты при любом масштабе камеры. Плитке с высотой
   * не в степень двойки — копия, дополненная до неё той же картинкой ниже: полоса в одну плитку высотой
   * показывает те же ряды, только без растяжки.
   */
  potTile(key: string): string {
    const frame = this.textures.getFrame(key);
    if (!frame) return key;
    const { cutWidth: w, cutHeight: h } = frame;
    const pot = Phaser.Math.Pow2.GetNext(h);
    if (pot === h || !Phaser.Math.Pow2.IsValue(w)) return key;
    const padded = `${key}@pot`;
    if (!this.textures.exists(padded)) {
      const canvas = this.textures.createCanvas(padded, w, pot);
      for (let y = 0; canvas && y < pot; y += h) canvas.context.drawImage(frame.source.image as CanvasImageSource, frame.cutX, frame.cutY, w, h, 0, y, w, h);
      canvas?.refresh();
    }
    return padded;
  }

  /** Картинка из public/assets в мировом масштабе. */
  art(x: number, y: number, key: string): Phaser.GameObjects.Image {
    return this.add.image(x, y, key).setScale(1 / ART);
  }

  /** Человечек из слоёв: тень, штаны, рубашка, форма, кожа, волосы — каждый слой перекрашивается тинтом. */
  makePerson(x: number, y: number, look: Look): Phaser.GameObjects.Container {
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
    let satchel: Phaser.GameObjects.Image | undefined;
    if (look.bag) {
      const bag = this.art(0, 0, look.bag).setTint(look.bagTint ?? 0xffffff);
      layers.push([bag, look.bag]);
      parts.push(bag);
      if (look.bag === 'bag') satchel = bag;
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
    const prop = look.prop ? wear(`w_prop_${look.prop}`, look.propTint, true) : undefined;
    if (prop) parts.push(prop);
    const person = this.add.container(x, y, parts).setDepth(y);
    if (back) person.setData('back', back);
    // Вещь в руке и сумка через плечо покачиваются в такт шагу (animatePeople).
    if (prop) person.setData('prop', prop);
    if (satchel) person.setData('satchel', satchel);
    const gait = gaitOf(look);
    person.setData('gait', gait);
    // Свой шаг: и скорость, и ширина шага у каждого чуть свои — толпа не марширует в ногу.
    const own = gait ? GAIT[gait] : { speed: 1, stride: 1 };
    person.setData('stride', this.newStride(x, y, own.speed * Phaser.Math.FloatBetween(...OWN_SPEED), own.stride * Phaser.Math.FloatBetween(0.94, 1.06)));
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

  private newStride(x: number, y: number, speed = 1, stride = 1): Stride {
    return { phase: 0, lastX: x, lastY: y, speed, stride, foot: Math.random() < 0.5 ? 0 : 2, endAt: -Infinity, vel: 0, ratio: 1, frame: 0, seg: 0, t: 0, lane: 0, laneGoal: 0, laneAt: 0, dirX: 0, dirY: 0 };
  }

  /** Шаг человека (makePerson заводит его сразу; у собранных иначе — заводится тут). */
  strideOf(person: Phaser.GameObjects.Container): Stride {
    let st = person.getData('stride') as Stride | undefined;
    if (!st) {
      st = this.newStride(person.x, person.y);
      person.setData('stride', st);
    }
    return st;
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
  private addCompanion(leader: Phaser.GameObjects.Container, look?: Look): void {
    const companion = this.makePerson(leader.x - 8, leader.y + 1, look ?? customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), this.state.day));
    weatherFx.addUmbrella(this, companion);
    companion.setData('leader', leader);
    leader.setData('trail', [] as { x: number; y: number }[]);
    leader.once('destroy', () => companion.destroy());
    // Парочка иногда обменивается сердечками.
    const hearts = this.time.addEvent({
      delay: 5000,
      loop: true,
      callback: () => companion.active && Math.random() < 0.35 && effects.emote(this, companion, 'emo_heart'),
    });
    companion.once('destroy', () => hearts.remove());
  }

  /** Спутник идёт по следу ведущего: берёт точку следа не ближе 9 к нему. */
  followLeader(person: Phaser.GameObjects.Container, leader: Phaser.GameObjects.Container): void {
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
      this.setFacing(person, facingAlong(dx, dy, person.getData('facing') as Facing | undefined));
    }
    person.setData('walking', moving);
    person.setData('pace', leader.getData('pace'));
  }

  /** Собака идёт рядом с хозяином; пока он в магазине — сидит привязанная у входа и виляет хвостом. */
  updateDog(person: Phaser.GameObjects.Container, dog: Phaser.GameObjects.Image): void {
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
  cartsAtDoor(): boolean {
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
  setMood(person: Phaser.GameObjects.Container, mood: 'happy' | 'frown' | null, ms?: number): void {
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

  setFacing(person: Phaser.GameObjects.Container, facing: Facing): void {
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
      // Сразу над тенью (а у светящегося человека тень — над свечением, personGlow).
      else person.moveTo(back, person.getData('glow') ? 2 : 1);
    }
    this.placeStroller(person, facing);
  }

  /** Переходник к effects.celebrateCombo: метод сцены вызывают и скрипты снаружи (scripts/e2e.ts, scripts/promo). */
  private celebrateCombo(n: number): void {
    return effects.celebrateCombo(this, n);
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
      effects.emote(this, p, Math.random() < 0.55 ? 'emo_clock' : 'emo_sigh');
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
      effects.emote(this, s, 'emo_zzz');
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
      if (Math.random() < share) this.time.delayedCall(Phaser.Math.Between(0, 300), () => effects.emote(this, p, key));
    }
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
      step.arrive?.();
      if (step.ms) await this.wait(step.ms);
      if (id !== this.choreId) return;
      step.action?.();
    }
    await this.returnSeller();
  }

  /** Продавца позвали к кассе: бросает дело на полпути и идёт обратно. Несённый товар остаётся на складе. */
  private recallSeller(): void {
    if (!this.sellerBusy) return;
    this.dropChore();
    haptic.tap();
    void this.returnSeller();
  }

  /** Хозяин бросает дело на полпути (позвали к кассе, взяли в заложники): дальше оно не идёт. */
  private dropChore(): void {
    this.choreId++;
    this.stopMop(this.seller);
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
  }

  private async returnSeller(): Promise<void> {
    const id = this.choreId;
    const home = this.ownerHome();
    // С улицы — через дверь, а не сквозь стену.
    if (this.seller.y > this.layout.h - 2) {
      await this.walkVia(
        this.seller,
        [
          { x: this.layout.door.x, y: this.layout.h + FACADE_H + 6 },
          { x: this.layout.door.x, y: this.layout.door.y - 8 },
        ],
        SELLER_SPEED,
      );
      if (id !== this.choreId) return;
    }
    // После дела — всегда к своей кассе, даже если наняты кассиры: первая касса — его.
    await this.walk(this.seller, home.x, home.y, SELLER_SPEED);
    if (id === this.choreId) this.sellerBusy = false;
  }

  /** Где стоит хозяин (игрок): за первой кассой, а когда за ней сменщик — рядом, у той же стойки. */
  private ownerHome(): { x: number; y: number } {
    if (this.reliefOnDuty()) return this.reliefSpot();
    return this.registers[0]?.clerk ?? this.layout.sellerHome;
  }

  /** Сменщик нанят и сегодня на смене: тогда касса хозяина — его на весь день. */
  private reliefOnDuty(): boolean {
    const m = staffOf(this.state, RELIEF_ROLE);
    return Boolean(m && !isAbsent(this.state, m));
  }

  /** Место рядом с кассой хозяина, у той же стойки: тут стоит хозяин, когда за его кассой сменщик. */
  private reliefSpot(): { x: number; y: number } {
    const { sellerHome } = this.layout;
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
    // Шаг обучения «Разложи товар»: полку нажали — хозяин уже несёт коробку.
    this.passTut('restock');
    // Новичок разложил полку сам (до этого в первый день её раскладывала бабушка).
    if (playDayOne(this.state)) this.onbStep('stock');
  }

  /** Товар из коробки на полку: штуки вылетают по одной и встают на место с «чпок». */
  private stockShelf(index: number, by: Phaser.GameObjects.Container): void {
    const view = this.shelfViews[index];
    const before = view ? view.items.filter((img) => img.visible).length : 0;
    // Хозяин-силач носит больше (навык «Силач»), сотрудники — как обычно.
    this.state = moveToShelf(this.state, index, undefined, carryOf(this.state) + (by === this.seller ? carryBonus(this.state) : 0)).state;
    // Без съезда: новые штуки сами летят на свои места, а сдвинутые соседи просто встают рядом.
    this.refreshShelves(false);
    this.refreshWarehouse();
    const items = this.shelfViews[index]?.items ?? [];
    const backs = this.shelfViews[index]?.backItems ?? [];
    const kind = this.state.shelves[index]?.kind;
    const fresh = items.filter((img, n) => img.visible && n >= before);
    // Задний ряд проявляется, когда штука долетела до полки.
    backs.forEach((back, n) => n >= before && back.visible && back.setAlpha(0));
    this.time.delayedCall(fresh.length * 90 + 300, () => backs.forEach((back) => back.active && back.alpha < 1 && this.tweens.add({ targets: back, alpha: 1, duration: 200 })));
    fresh.forEach((img, n) => {
      const { x, y } = img;
      const scale = img.scaleX;
      const from = { x: by.x, y: by.y - 4 };
      // Пока летит, место ведёт полёт: если в это время с полки возьмут товар, эта штука не съезжает.
      img.setPosition(from.x, from.y).setScale(scale * 0.6).setAlpha(0).setData('flying', true);
      // Летит дугой вверх из рук на своё место и подпрыгивает.
      this.tweens.addCounter({
        from: 0,
        to: 1,
        delay: n * 90,
        duration: 280,
        onStart: () => {
          img.setAlpha(1);
          // Звук материала отдела (бутылки звенят, хлеб ложится мягко…), через штуку — без «пулемёта».
          if (n % 2 === 0 && kind) sound.shelf(kind, n, x);
        },
        onUpdate: (tween) => {
          const k = tween.getValue() ?? 0;
          img.setPosition(from.x + (x - from.x) * k, from.y + (y - from.y) * k - Math.sin(k * Math.PI) * 10);
          img.setScale(scale * (0.6 + 0.4 * k));
        },
        onComplete: () => {
          img.setPosition(x, y).setData('flying', false);
          this.tweens.add({ targets: img, scale: { from: scale * 1.35, to: scale }, duration: 140, ease: 'Back.easeOut' });
          // Свежий товар поблёскивает; из коробки сыплется пыль.
          if (n === fresh.length - 1) {
            this.freshShine(index);
            const shelfView = this.shelfViews[index];
            if (shelfView) this.time.delayedCall(60, () => motion.hopShelf(this, shelfView, 2.5));
          }
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
          effects.bubbles(this, this.layout.wc.x, this.layout.wc.y);
          effects.cleanSparkle(this, this.layout.wc.x, this.layout.wc.spotY - 4, 20);
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
    // Чаще всего — бумажка, остальное вразнобой (art/litter.py).
    const key = kind === 'trash' ? Phaser.Utils.Array.GetRandom(['trash', ...TRASH_KEYS]) : kind;
    const area =
      kind === 'mud' ? new Phaser.Geom.Rectangle(-2, -2, 30, 26) : kind === 'spill' ? new Phaser.Geom.Rectangle(-2, -4, 32, 20) : new Phaser.Geom.Rectangle(-5, -5, 16, 15);
    const piece = this
      .art(x + Phaser.Math.Between(-6, 6), y + Phaser.Math.Between(4, 8), key)
      .setDepth(kind === 'trash' ? 1 : 0.5)
      .setInteractive(area, Phaser.Geom.Rectangle.Contains);
    piece.setData('kind', kind);
    // Сколько секунд лежит на полу и стадия гниения (rot.ts), base — картинка без «_rot».
    piece.setData('age', 0).setData('rot', 0).setData('base', key);
    piece.setData('glow', new Halo(this, piece, 0xffffff));
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
      const mopMs = kind === 'spill' ? SPILL_MOP_MS : MOP_MS;
      void this.doChore([
        {
          x: piece.x + 7,
          y: piece.y,
          action: () => {
            scrub = this.tweens.add({ targets: this.carried, x: 1, duration: 160, yoyo: true, repeat: -1 });
            this.mopSound(this.seller, piece.x, mopMs);
          },
        },
        {
          x: piece.x + 7,
          y: piece.y,
          ms: mopMs,
          action: () => {
            scrub?.remove();
            this.stopMop(this.seller);
            this.carried.setVisible(false).setTexture('box').setPosition(0, 3);
            if (kind === 'spill') this.wetSign(piece.x, piece.y);
            effects.cleanSparkle(this, piece.x, piece.y, 16);
            this.removeTrash(piece);
          },
        },
      ]);
    });
    this.trash.add(piece);
    return piece;
  }

  /** После мытья — табличка «Мокрый пол» и влажный блеск, пока пол сохнет. */
  private wetSign(x: number, y: number): void {
    const sheen = this.add.ellipse(x, y + 1, 18, 7, 0xc8f0ff, 0.35).setDepth(0.55);
    this.wetSheens.add(sheen);
    sheen.once('destroy', () => this.wetSheens.delete(sheen));
    const sign = this.art(x + 7, y - 5, 'wet_sign').setDepth(y + 3);
    this.time.delayedCall(7000, () => {
      if (!sign.active) return;
      this.tweens.add({ targets: [sign, sheen], alpha: 0, duration: 600, onComplete: () => [sign, sheen].forEach((o) => o.destroy()) });
    });
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
    const front = standFor(this.layout, slot);
    const piece = this.dropTrash(front.x + Phaser.Math.Between(-6, 6), front.y + 2, 'spill');
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
      effects.emote(this, c.sprite, 'emo_angry');
      this.popup(c.sprite.x, c.sprite.y - 18, t('popup.slip'), '#ffd0d0');
    }
  }

  /**
   * Мусор на полу стареет и гниёт (rot.ts): темнеет, над ним мухи и вонь. Переполненное ведро,
   * которое долго не выносят, тоже пахнет. В первый раз — всплывашка над гнилым мусором.
   */
  private updateRot(dt: number): void {
    for (const piece of this.trash) {
      if (!(ROTS as readonly string[]).includes(piece.getData('kind') as string)) continue;
      const age = ((piece.getData('age') as number) ?? 0) + dt;
      piece.setData('age', age);
      const stage = rotStage(age);
      if (stage <= ((piece.getData('rot') as RotStage) ?? 0)) continue;
      piece.setData('rot', stage);
      this.rotting.apply(piece, stage, piece.y);
      if (stage === 1 && !this.state.seenTips?.includes(ROT_TIP) && !this.rotWarned) {
        this.rotWarned = true;
        sound.bad();
        this.popup(piece.x, piece.y - 14, t('popup.rotFirst'), '#d8f0a0');
      }
    }
    this.binFullFor = this.binFull() && !this.binBusy ? this.binFullFor + dt : 0;
    const bin = binSmell(this.binFullFor) && this.binImg?.active ? this.binSpot() : null;
    this.rotting.bin(bin && { x: bin.x, y: bin.y - 12 }, (bin?.y ?? 0) + 31);
    // Чем дольше стоит полное, тем гуще вонь над ним.
    this.binStink?.setScale((binSmell(this.binFullFor) === 2 ? 1.35 : 1) / ART);
    this.rotting.tick(this.time.now);
  }

  /** Сколько пахнет в зале: гнилой мусор и давно полное ведро (rot.ts). */
  private smell(): number {
    return smellLevel([...this.trash].map((piece) => (piece.getData('age') as number) ?? 0), this.binFullFor);
  }

  private removeTrash(piece: Phaser.GameObjects.Image): void {
    if (this.trash.has(piece)) this.stats.trashCleaned++;
    // Убрали первый гнилой мусор — подсказка про запах больше не нужна.
    if (piece.getData('rot') && !this.state.seenTips?.includes(ROT_TIP)) this.state = { ...this.state, seenTips: [...(this.state.seenTips ?? []), ROT_TIP] };
    this.trash.delete(piece);
    this.claimedTrash.delete(piece);
    if (piece.getData('kind') === 'trash') effects.puff(this, piece.x, piece.y);
    else {
      effects.bubbles(this, piece.x, piece.y);
      // Мыли шваброй — заодно стёрли и потёртость пола вокруг.
      this.polishFloor(piece.x, piece.y);
    }
    piece.destroy();
  }

  /**
   * Шаги для потёртости пола (game/wear.ts): кто сейчас идёт по залу — в клетку под его ногами.
   * Смотрим по таймеру времени игры, а не каждый кадр: на ×2 таймер тикает вдвое чаще вместе с игрой.
   */
  private sampleSteps(): void {
    const wear = this.wear;
    if (!wear || wear.level !== this.state.level) return;
    const { w, h, wallH } = this.layout;
    for (const person of this.people) {
      if (!person.active || !person.visible || !person.getData('walking') || person.displayList !== this.children) continue;
      const feet = person.y + 8 * person.scaleY;
      if (person.x <= 0 || person.x >= w || feet <= wallH || feet >= h) continue;
      addStep(wear.steps, wear.grid, person.x, feet - wallH);
    }
  }

  /** Конец дня: шаги дня — в потёртость пола; с уборщиком и решёткой у входа пол стирается медленнее. */
  private settleFloorWear(): void {
    const wear = this.wear;
    if (!wear || wear.level !== this.state.level) return;
    wear.cells = settleWear(wear.cells, wear.steps, wear.grid, { cleaner: this.workers.has('cleaner'), entrance: gearTier(this.state, 'entrance') });
    wear.steps.fill(0);
    this.state = { ...this.state, floorWear: encodeWear(wear.cells, wear.level, wear.grid) };
    this.floor.setWear(this.wearLayer());
  }

  /** Помыли пол в точке (x, y) зала: потёртость вокруг уходит — в сохранении и на картинке пола (только там). */
  private polishFloor(x: number, y: number): void {
    const wear = this.wear;
    const { wallH } = this.layout;
    if (!wear || wear.level !== this.state.level || !mopWear(wear.cells, wear.grid, x, y - wallH)) return;
    this.state = { ...this.state, floorWear: encodeWear(wear.cells, wear.level, wear.grid) };
    const r = MOP_RADIUS + WEAR_CELL;
    this.floor.setWear(this.wearLayer(), { x: x - r, y: y - r, w: 2 * r, h: 2 * r });
  }

  // ---------- Сотрудники ----------

  /** Расставляет нанятых сотрудников по местам и запускает их работу. */
  private syncStaff(): void {
    const gen = ++this.staffGen;
    // Повара переставляют посреди варки — сваренное не пропадает, а встаёт в витрину.
    this.flushCooking();
    for (const w of this.workers.values()) {
      this.stopMop(w.sprite);
      this.haltWalk(w.sprite);
      this.tweens.killTweensOf(w.sprite);
      w.sprite.destroy();
    }
    this.workers.clear();
    this.newcomers.clear();
    this.reliefReady = false;
    this.managerOnFloor = false;
    this.claimedTrash.clear();
    if (this.binBy === 'cleaner') {
      this.binFill = Math.min(binCapacity(this.state), this.binFill + this.bagCarried);
      this.bagCarried = 0;
      this.binBusy = false;
      this.binBy = null;
      this.refreshBin();
    }
    // Кассир не вышел, а менеджер на месте — менеджер встаёт за его кассу. Сменщика не подменяет:
    // за первой кассой и так хозяин, а у менеджера свои дела.
    const manager = this.state.staff.find((m) => m.role === 'manager' && !isAbsent(this.state, m));
    const cover = manager
      ? TILL_ROLES.slice(0, this.registers.length - 1).find((role) => {
          const m = staffOf(this.state, role);
          return m && isAbsent(this.state, m);
        })
      : undefined;
    for (const member of this.state.staff) {
      if (isAbsent(this.state, member)) continue;
      const covering = member.role === 'manager' && cover ? cover : undefined;
      const home = covering ? this.workerHome(covering) : this.workerHome(member.role);
      // Новенький в первый день не стоит сразу на месте, а входит с улицы.
      const fresh = this.dayOpen && this.newHires.has(staffKey(member));
      const at = fresh ? this.streetSpawn() : home;
      const sprite = this.makePerson(at.x ?? home.x, at.y ?? home.y, {
        ...randomLook(UNIFORMS[member.role]),
        style: STAFF_HAIR[member.role],
        acc: STAFF_ACC[member.role].acc,
        accTint: STAFF_ACC[member.role].tint,
        // У охранника форменная кепка, у пекаря — белый колпак.
        hair: member.role === 'guard' ? UNIFORMS.guard : member.role === 'baker' ? 0xffffff : Phaser.Utils.Array.GetRandom(HAIR_COLORS),
        // Повар — в поварском колпаке и белом кителе.
        ...(member.role === 'cook' ? { hat: 'toque' as const, outfit: 'chefcoat' as const } : {}),
      });
      const carried = this.art(0, 3, 'box').setVisible(false);
      sprite.add(carried);
      const worker: Worker = { member, sprite, carried, home };
      this.workers.set(member.role, worker);
      if (covering) {
        this.workers.set(covering, worker);
        const serve = () => void this.cashierLoop(worker, gen, registerOfRole(covering));
        if (fresh) void this.walkIn(worker, gen).then(serve);
        else serve();
        continue;
      }
      const loop = {
        cashier: this.reliefLoop,
        cashier2: this.cashierLoop,
        cashier3: this.cashierLoop,
        cashier4: this.cashierLoop,
        cashier5: this.cashierLoop,
        cleaner: this.cleanerLoop,
        loader: this.loaderLoop,
        guard: null,
        manager: this.managerLoop,
        baker: this.bakerLoop,
        barista: this.baristaLoop,
        cook: this.cookLoop,
      }[member.role];
      const work = () => {
        if (loop) void loop.call(this, worker, gen);
      };
      if (fresh) void this.walkIn(worker, gen).then(work);
      else work();
    }
    // Новеньких встретили — в следующий раз они уже свои.
    if (this.dayOpen) this.newHires.clear();
    // Хозяин — за своей кассой (если не занят делом).
    const home = this.ownerHome();
    if (!this.sellerBusy) this.seller.setPosition(home.x, home.y).setDepth(home.y);
  }

  /**
   * Первый рабочий день: новенький идёт по тротуару к двери, на пороге радуется (сердечко) и проходит
   * на своё место — работать начинает, когда дошёл.
   */
  private async walkIn(w: Worker, gen: number): Promise<void> {
    const { door } = this.layout;
    this.newcomers.add(w.sprite);
    await this.workerWalk(w, door.x, this.streetY);
    await this.workerWalk(w, door.x, door.y - 10);
    this.newcomers.delete(w.sprite);
    if (!this.alive(gen)) return;
    effects.emote(this, w.sprite, 'emo_heart');
    motion.squash(this, w.sprite, 1.1, 0.9, 120);
    await this.workerWalk(w, w.home.x, w.home.y);
  }

  private workerHome(role: StaffRole): { x: number; y: number } {
    const { wc, warehouse, door } = this.layout;
    switch (role) {
      case 'cashier':
        // Сменщик — за кассой хозяина (хозяин встаёт рядом, у той же стойки).
        return this.registers[0]?.clerk ?? this.reliefSpot();
      case 'cashier2':
      case 'cashier3':
      case 'cashier4':
      case 'cashier5':
        return this.registers[registerOfRole(role)]?.clerk ?? this.reliefSpot();
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
      case 'cook': {
        // Повар — у правого края стола (доска с ножом слева от него); кухни в помещении нет (так не бывает) — у входа.
        const k = this.layout.kitchen;
        return k ? { x: k.x + 40, y: k.y + 33 } : { x: door.x - 24, y: door.y - 30 };
      }
    }
  }

  private alive(gen: number): boolean {
    return gen === this.staffGen && this.scene.isActive();
  }

  /** Шаг сотрудника с учётом его скорости. */
  private workerWalk(w: Worker, x: number, y: number): Promise<void> {
    return this.walk(w.sprite, x, y, STAFF_SPEED * this.workerPace(w));
  }

  /** Сотрудник идёт через несколько точек одним ходом (дверь склада, пекарни) — не встаёт в каждой. */
  private workerWalkVia(w: Worker, points: Point[]): Promise<void> {
    return this.walkVia(w.sprite, points, STAFF_SPEED * this.workerPace(w));
  }

  private workerWait(w: Worker, ms: number): Promise<void> {
    return this.wait(ms / this.workerPace(w));
  }

  /** Скорость сотрудника: его навык, менеджер на смене, а у грузчика — ещё и оборудование склада. */
  private workerPace(w: Worker): number {
    return workSpeed(w.member) * managerBoost(this.state) * (w.member.role === 'loader' ? warehouseSpeed(this.state) : 1);
  }

  /**
   * Швабра в руках у who трёт пол ms игрового времени. Звук идёт в настоящих секундах: на ×2 дело вдвое
   * короче (wait идёт по времени сцены), у шустрого уборщика — ещё в pace раз (как в workerWait).
   */
  private mopSound(who: Phaser.GameObjects.Container, x: number, ms: number, pace = 1): void {
    this.stopMop(who);
    this.mops.set(who, sound.mop(x, ms / pace / this.speed / 1000));
  }

  /** Швабра who стихает: дело закончили, бросили или его некому доделать; без who — все (зал перестроили). */
  private stopMop(who?: Phaser.GameObjects.Container): void {
    for (const [owner, stop] of this.mops) {
      if (who && owner !== who) continue;
      stop();
      this.mops.delete(owner);
    }
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
      // Заказ на дом: принятый — собирает и выносит к двери курьеру; звонит телефон — берёт трубку сам.
      const parcel = this.nextParcel();
      if (parcel) {
        await this.packParcel(w, gen, parcel);
        continue;
      }
      if (this.call && this.phone) {
        await this.workerWalk(w, this.phone.x - 10, this.phone.y + 14);
        if (!this.alive(gen)) return;
        if (this.call) this.acceptOrder();
        continue;
      }
      const pick = managerPick(this.state);
      if (pick && !this.urgentOrders.some((o) => o.id === pick)) {
        const qty = URGENT_QTYS[0];
        if (this.orderUrgentDelivery(pick, qty, true)) this.popup(w.sprite.x, w.sprite.y - 20, t('popup.managerOrder', { icon: PRODUCTS[pick].icon }), '#fff3b0');
      }
      const slot = Phaser.Utils.Array.GetRandom(this.layout.slots.slice(0, Math.max(1, this.state.shelves.length)));
      if (slot) {
        const stand = standFor(this.layout, slot);
        await this.workerWalk(w, stand.x + (slotSide(this.layout, slot) ? 0 : Phaser.Math.Between(-12, 12)), stand.y);
      }
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

  /** Автозаказ подвозит кончившийся товар: оплачено из лимита дня, едет тем же фургоном, что и срочный заказ. */
  private autoTopUpIfNeeded(): void {
    const order = autoTopUp(this.state, (id) => this.stats.sold[id] ?? 0, this.urgentOrders.map((o) => o.id), this.urgentOnTheWay());
    if (!order) return;
    this.state = order.state;
    this.urgentOrders.push({ id: order.pid, qty: order.qty, auto: true });
    this.hud.update(this.state, this.timeLeft);
    const { warehouse } = this.layout;
    this.popup(warehouse.x + warehouse.w / 2, warehouse.y - 4, t('popup.autoTopUp', { icon: PRODUCTS[order.pid].icon, n: order.qty }), '#c8ffb0');
    if (!this.urgentVanBusy) void this.urgentVan();
  }

  /** Фургон срочного подвоза: подъезжает к складу, товар — на стеллаж, уезжает. */
  private async urgentVan(): Promise<void> {
    this.urgentVanBusy = true;
    const { warehouse } = this.layout;
    const vanX = warehouse.x + warehouse.w / 2 + 14;
    const roadY = this.streetY + 24;
    const van = this.add.container(-260, roadY, [this.art(0, 0, 'car_van').setTint(0xffd27a), this.art(0, 0, 'car_van_lights')]).setDepth(roadY);
    const road = this.onRoad(van, 'up', true);
    await this.wait((URGENT_SECONDS * 1000) / Math.max(1, this.speed) - 1800);
    await this.yieldToLot(road);
    await new Promise<void>((done) => this.tweens.add({ targets: van, x: vanX, duration: 1800, ease: 'Sine.easeOut', onComplete: () => done(), onStop: () => done() }));
    this.receiveUrgentOrders();
    this.urgentVanBusy = false;
    if (this.urgentOrders.length) void this.urgentVan();
    // Пустой — в путь.
    await this.wait(600);
    if (!van.active) return;
    await this.yieldToLot(road, true);
    this.tweens.add({ targets: van, x: this.next.w + 300, duration: 2400, ease: 'Sine.easeIn', onComplete: () => van.destroy() });
  }

  /** Всё, что едет, — на склад (и в конце дня, если фургон не успел). */
  private receiveUrgentOrders(): void {
    if (!this.urgentOrders.length) return;
    const list = this.urgentOrders.map((o) => `${PRODUCTS[o.id].icon}×${o.qty}`).join(' ');
    for (const o of this.urgentOrders) this.state = o.auto ? autoArrived(this.state, o.id, o.qty) : receiveUrgent(this.state, o.id, o.qty);
    this.urgentOrders = [];
    this.refreshWarehouse();
    this.refreshShelves();
    sound.place('box', 0);
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

  /**
   * Сменщик: весь день за кассой хозяина и пробивает сам всех, кто к ней подошёл. Хозяин свободен
   * для дел, а его касания кассы торопят пробивку (hurryRelief).
   */
  private async reliefLoop(w: Worker, gen: number): Promise<void> {
    this.reliefReady = true;
    // Хозяин, пока сменщик шёл, сам встал за кассу — уступает место и отходит к стойке.
    const clerk = this.registers[0]?.clerk;
    if (clerk && !this.sellerBusy && !this.ownerScanning() && Phaser.Math.Distance.Between(this.seller.x, this.seller.y, clerk.x, clerk.y) <= 2) void this.returnSeller();
    while (this.alive(gen)) {
      const r = this.registers[0];
      const front = r?.customer;
      if (!this.running || !r || !front || !this.atSpot(r) || front.serving || r.scan) {
        // Отводили в сторону (ограбление, новенький) — назад к стойке.
        if (Phaser.Math.Distance.Between(w.sprite.x, w.sprite.y, w.home.x, w.home.y) > 2) await this.workerWalk(w, w.home.x, w.home.y);
        await this.wait(150);
        continue;
      }
      await this.scanCustomer(r, front, withUpgrades(this.state, cashierScan(w.member)), false);
    }
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
          // Пока завязывал мешок или бросал его в контейнер, состав мог смениться (syncStaff) — спрайта уже нет.
          if (!this.alive(gen)) return;
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
        const ms = kind === 'trash' ? TRASH_CLEAN_MS : kind === 'spill' ? SPILL_MOP_MS : MOP_MS;
        if (kind !== 'trash') this.mopSound(w.sprite, piece.x, ms, this.workerPace(w));
        await this.workerWait(w, ms);
        this.stopMop(w.sprite);
        if (!this.alive(gen)) return;
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
        if (!this.alive(gen)) return;
        w.carried.setVisible(false).setTexture('box');
        this.putInBin();
        continue;
      }
      if (this.running && this.toiletDirt >= 40) {
        await this.workerWalk(w, this.layout.wc.x, this.layout.wc.spotY);
        if (!this.alive(gen)) return;
        await this.workerWait(w, TOILET_CLEAN_MS);
        if (!this.alive(gen)) return;
        this.toiletDirt = 0;
        this.refreshToilet();
        effects.bubbles(this, this.layout.wc.x, this.layout.wc.y);
        continue;
      }
      // Делать нечего — натирает шваброй самое потёртое место пола (не чаще раза в POLISH_EVERY_MS).
      const worn = this.running && this.time.now - this.polishedAt > POLISH_EVERY_MS ? this.wornFloorSpot() : null;
      if (worn) {
        this.polishedAt = this.time.now;
        await this.workerWalk(w, worn.x + 6, worn.y);
        if (!this.alive(gen)) return;
        this.mopSound(w.sprite, worn.x, MOP_MS, this.workerPace(w));
        await this.workerWait(w, MOP_MS);
        this.stopMop(w.sprite);
        if (!this.alive(gen)) return;
        effects.bubbles(this, worn.x, worn.y);
        this.polishFloor(worn.x, worn.y);
        continue;
      }
      if (Phaser.Math.Distance.Between(w.sprite.x, w.sprite.y, w.home.x, w.home.y) > 2) await this.workerWalk(w, w.home.x, w.home.y);
      await this.wait(300);
    }
  }

  /**
   * Самое потёртое место зала (точки мира), куда можно подойти со шваброй: не под мебелью. Потёрто
   * меньше POLISH_MIN_WEAR — натирать нечего (null).
   */
  private wornFloorSpot(): { x: number; y: number } | null {
    const wear = this.wear;
    if (!wear || wear.level !== this.state.level) return null;
    const { wallH } = this.layout;
    const free = (x: number, y: number) => this.obstacles.every((o) => x < o.x - 2 || x > o.x + o.w + 2 || y < o.y - 2 || y > o.y + o.h + 2);
    // Уборщик встаёт правее пятна (как у лужи): свободно должно быть и там, где он стоит.
    const spot = wornSpot(wear.cells, wear.grid, POLISH_MIN_WEAR, (x, y) => free(x, y + wallH) && free(x + 6, y + wallH));
    return spot && { x: spot.x, y: spot.y + wallH };
  }

  private nearestTrash(x: number, y: number): Phaser.GameObjects.Image | undefined {
    let best: Phaser.GameObjects.Image | undefined;
    let bestDist = Infinity;
    for (const piece of this.trash) {
      if (this.claimedTrash.has(piece)) continue;
      // Гнилое пахнет — его уборщик убирает в первую очередь.
      const d = Phaser.Math.Distance.Between(x, y, piece.x, piece.y) - 60 * ((piece.getData('rot') as number) ?? 0);
      if (d < bestDist) [best, bestDist] = [piece, d];
    }
    return best;
  }

  /** Грузчик носит товар со склада на полки, где он кончается. */
  private async loaderLoop(w: Worker, gen: number): Promise<void> {
    while (this.alive(gen)) {
      // Заказ на дом без менеджера в зале собирает грузчик: склад и так его.
      const parcel = this.running && !this.managerOnFloor ? this.nextParcel() : undefined;
      if (parcel) {
        await this.packParcel(w, gen, parcel);
        continue;
      }
      const index = this.running ? this.shelfToRestock() : -1;
      if (index < 0) {
        if (Phaser.Math.Distance.Between(w.sprite.x, w.sprite.y, w.home.x, w.home.y) > 2) await this.workerWalk(w, w.home.x, w.home.y);
        await this.wait(400);
        continue;
      }
      const { doorway, pickup } = this.layout.warehouse;
      const route = this.routeTo(index);
      await this.workerWalkVia(w, [doorway, pickup]);
      await this.workerWait(w, PICKUP_MS);
      if (!this.alive(gen)) return;
      w.carried.setVisible(true);
      await this.workerWalkVia(w, [doorway, ...route]);
      await this.workerWait(w, PLACE_MS);
      if (!this.alive(gen)) return;
      w.carried.setVisible(false);
      this.stockShelf(index, w.sprite);
      // От ларя на улице — обратно в зал через дверь.
      await this.workerWalkVia(w, route.slice(0, -1).reverse());
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
    await this.walkVia(
      sprite,
      [
        { x: door.x, y: this.streetY },
        { x: door.x, y: door.y - 10 },
      ],
      35,
    );
    // Полки в зале и вёдра у кассы (ларь у входа он видел, когда заходил).
    for (const i of this.state.shelves.map((_, i) => i)) if (this.state.shelves[i].kind !== 'icebox') await look(this.standOf(i).x, this.standOf(i).y);
    await look(wc.x - 6, wc.spotY + 4);
    await look(sellerHome.x - 30, sellerHome.y - 10);
    if (!this.sys.isActive()) return;

    // Переполненное ведро инспектор считает как две кучки мусора.
    const result = inspect(this.state, { trash: this.trash.size + (this.binFull() ? 2 : 0) + ([...this.trash].some((piece) => piece.getData('rot')) ? 1 : 0), toiletDirt: this.toiletDirt });
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
    await this.walkVia(
      sprite,
      [
        { x: door.x, y: this.streetY },
        { x: door.x, y: door.y - 10 },
        { x: sellerHome.x - 18, y: sellerHome.y + 8 },
      ],
      40,
    );
    if (!this.sys.isActive()) return;
    pets.heartAt(this, sprite.x, sprite.y - 14);
    music.sting('story');
    this.popup(sprite.x, sprite.y - 20, t('drama.visit'), '#fff3b0');
    await this.wait(9000);
    await this.walkVia(
      sprite,
      [
        { x: door.x, y: door.y - 10 },
        { x: door.x, y: this.layout.h + 16 },
      ],
      40,
    );
    void this.strollAway(sprite);
    this.sonya = 'done';
  }

  /**
   * Праздничный гость (game/live.ts): Дед Мороз или Снегурочка заходит, поздравляет у прилавка,
   * оставляет подарок монетами и уходит. Подарок — сразу, как дошёл: ушёл ли гость, уже неважно.
   */
  private async runLiveGuest(): Promise<void> {
    const guest = this.liveGuest;
    if (!guest) return;
    guest.phase = 'here';
    const { door, sellerHome, queue } = this.layout;
    const start = this.streetSpawn();
    const sprite = this.makePerson(start.x, start.y, LIVE_GUEST_LOOKS[guest.who]);
    if (!this.lite) personGlow(this, sprite, 0xcfe8ff, 3);
    sound.bell(door.x);
    await this.walkVia(
      sprite,
      [
        { x: door.x, y: this.streetY },
        { x: door.x, y: door.y - 10 },
        // Рядом с тем, кто платит, — а не на самом прилавке и не в очереди.
        { x: queue.x - 14, y: queue.y + 10 },
      ],
      34,
    );
    if (!this.sys.isActive()) return;
    const coins = guestCoins(this.state);
    this.state = seeGuest(this.state, guest.date);
    saveGame(this.state);
    pets.heartAt(this, sprite.x, sprite.y - 14);
    if (!music.sting('coin')) sound.coin(sellerHome.x);
    haptic.success();
    this.popup(sprite.x, sprite.y - 20, `«${t(`live.guest.${guest.who}.line` as TextKey)}»`, '#cfe8ff');
    this.time.delayedCall(1400, () => this.popup(sellerHome.x - 20, sellerHome.y - 40, t('live.guest.gift', { n: coins }), '#fee761'));
    await this.wait(7000);
    await this.walkVia(
      sprite,
      [
        { x: door.x, y: door.y - 10 },
        { x: door.x, y: this.layout.h + 16 },
      ],
      34,
    );
    void this.strollAway(sprite);
    guest.phase = 'done';
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
      await this.walkVia(
        sprite,
        [
          { x: door.x + dx, y: this.streetY },
          { x: door.x + dx, y: door.y - 10 },
        ],
        32,
      );
      const order = slots.map((_, k) => k).filter((k) => k % 3 === i % 3 || slots.length < 4);
      for (const k of order.slice(0, 3)) {
        const stand = standFor(this.layout, slots[k]);
        await this.walk(sprite, stand.x + dx / 2, stand.y, 32);
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

  /**
   * Новый покупатель с улицы. forced — заданный (друг, первый покупатель); arrived — уже идёт по
   * тротуару от парковки (carCustomer): человечек готов, после покупок он вернётся к своей машине.
   */
  private spawnCustomer(
    forced?: { look: Look; at: Phaser.Types.Math.Vector2Like; wants?: ProductId[]; first?: boolean },
    arrived?: { sprite: Phaser.GameObjects.Container; look: Look; car: ParkSpot },
  ): void {
    const thief = !forced && !arrived && Math.random() < thiefChance(this.state.level) * cameraTheft(this.state) * eyeTheft(this.state);
    const valya = !forced && !arrived && !thief && !this.night && !this.valyaCame && this.state.day > 1 && Math.random() < 0.15;
    const shirt = thief ? THIEF_SHIRT : valya ? VALYA.shirt : Phaser.Utils.Array.GetRandom(SHIRTS);
    // Блогер сегодня снимает обзор — редкие гости заходят вдвое чаще.
    const rareChance = rareGuestChance(this.state.level) * adRareBoost(this.state);
    const rare = !forced && !arrived && !thief && !valya && !this.night && Math.random() < rareChance ? pickRareGuest(this.state, Math.random) : null;
    let look: Look = forced
      ? forced.look
      : arrived
        ? arrived.look
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
    const nightGuest = this.night && !forced && !arrived && !thief && !rare && !valya ? pickNightGuest(Math.random) : null;
    if (nightGuest) look = nightGuestLook(nightGuest);
    const big = bigDayFor(this.state.day);
    // Приехавший на машине уже одет (маска в эпидемию — ещё у машины, carCustomer).
    if (!rare && !thief && !valya && !arrived) {
      // Ремонт дороги: рабочие в касках приходят за обедом. Болезнь: почти все в масках.
      if (big === 'roadworks' && !forced && !this.night && Math.random() < ROADWORKERS) look = { ...look, ...wearOf('builder', Math.random) };
      if (big && BIG_DAYS[big].masks && !look.face && Math.random() < MASKS) look = { ...look, face: 'medmask' };
    }
    // Гость из здания района: свой образ и свой список покупок (district.ts).
    let wants: ProductId[] | undefined = forced?.wants;
    const fromDistrict = !forced && !arrived && !rare && !thief && !valya && !this.night ? districtGuest(this.state, Math.random) : null;
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
    const sprite = arrived?.sprite ?? this.makePerson(start.x, start.y, look);
    if (!arrived) weatherFx.addUmbrella(this, sprite);
    // Иногда приходят парой.
    if (!arrived && !thief && !rare && !valya && !forced?.first && look.stroller === undefined && Math.random() < 0.08) this.addCompanion(sprite);
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
    const customer: Customer = { sprite, bubble, items: [], unhappy: false, waitStart: 0, gone: false, thief, rare: rare?.id, wants, first: forced?.first, car: arrived?.car };
    // Вора без охранника видно по красному контуру — его можно поймать касанием. Редкий гость — в золотом.
    if (thief && !this.workers.has('guard')) personGlow(this, sprite, 0xe43b44, 3);
    if (rare) personGlow(this, sprite, 0xfee761, 3);
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
    await this.walkVia(c.sprite, [
      { x: door.x, y: this.streetY },
      { x: door.x, y: door.y - 10 },
    ]);
    // С тележкой у входа покупатель иногда берёт что-то сверх списка.
    const wanted = this.wanted(Phaser.Math.Between(1, 2) + bigDayExtraItems(this.state.day) + adExtraItems(this.state, Math.random));
    for (const id of wanted) {
      const index = shelfFor(this.state, id);
      // Ларь у кассы на виду — вор туда не идёт.
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
      pets.bobikBark(this);
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
    // Первый покупатель нового начала появляется уже на дорожке у двери — с улицы не идёт.
    // Остальные идут по тротуару почти до двери: тележку берут здесь, а к двери заворачивают дугой.
    const gap = c.sprite.x - door.x;
    if (!c.first) await this.walk(c.sprite, door.x + Math.sign(gap) * Math.min(Math.abs(gap), DOOR_TURN), this.streetY);
    // Тележки у входа: часть покупателей берёт их — кому удобнее.
    if (this.cartsAtDoor() && Math.random() < CART_SHARE && !c.sprite.getData('stroller') && !c.thief) this.giveTrolley(c.sprite);
    const wanted = c.wants ?? this.wanted(Phaser.Math.Between(1, 2) + bigDayExtraItems(this.state.day) + adExtraItems(this.state, Math.random));
    let disappointed = false;
    let why: { reason: LostReason; id: ProductId } | undefined;
    // Подойти, поискать глазами, взять: к полке в зале, к ларю и к вёдрам у кассы — одинаково.
    const visit = async (id: ProductId, index: number): Promise<ReturnType<StoreScene['tryTake']> | null> => {
      const stand = this.standOf(index);
      const fixture = SHELF_KINDS[this.state.shelves[index].kind].fixture;
      // Над головой облачко: что покупатель ищет.
      const thought = motion.think(this, c.sprite, id);
      // У боковой полки встают вдоль неё (по вертикали), у обычной — вдоль по горизонтали.
      const along = !fixture && slotSide(this.layout, this.spotOf(index)) ? 'y' : 'x';
      const jitter = Phaser.Math.Between(-8, 8) * (fixture ? 0.4 : 1);
      await this.walk(c.sprite, stand.x + (along === 'x' ? jitter : 0), stand.y + (along === 'y' ? jitter : 0));
      await this.wait(500);
      // Пока шёл — магазин захватили (или ушёл по другой причине): к полке уже не тянется.
      if (c.gone) {
        motion.endThought(this, thought, false);
        return null;
      }
      // Первый день новичка: товар кончился на полке, а на складе есть — покупатель ждёт, пока его поднесут.
      // Проверка — без await: у всех остальных путь к полке не сдвигается ни на микрозадачу (порядок случайных чисел — как был).
      if (this.shelfWaitNeeded(c, index, id) && (await this.waitForShelf(c, index, id))) {
        motion.endThought(this, thought, false);
        return null;
      }
      const result = this.tryTake(c, id);
      motion.reachShelf(this, c, this.spotOf(index), result === 'taken' ? id : null, result === 'taken' ? this.takenFrom : []);
      if (result === 'taken' && c.sprite.y < this.layout.h && Math.random() < SPILL_CHANCE) this.spill(c.sprite.x, c.sprite.y + 2);
      const failed = result === 'empty' || result === 'expensive' || result === 'eduard';
      motion.endThought(this, thought, failed);
      if (failed) {
        disappointed = true;
        // Первая неудача — причина ухода, если покупатель так ничего и не возьмёт.
        why ??= { reason: result, id };
      }
      return result;
    };
    await this.walkVia(c.sprite, c.first ? [{ x: door.x, y: door.y - 10 }] : [{ x: door.x, y: this.streetY }, { x: door.x, y: door.y - 10 }]);
    if (c.gone) return;
    // В дождь и снег с улицы несут грязь.
    const muddy = isWet(this.weather) || this.weather === 'snow';
    const mud = [...this.trash].filter((piece) => piece.texture.key === 'mud').length;
    if (muddy && mud < MAX_MUD && Math.random() < MUD_CHANCE * entranceMud(this.state)) this.dropTrash(this.layout.door.x, this.layout.door.y - 30, 'mud');

    if (c.regular) this.popup(c.sprite.x, c.sprite.y - 20, t('regular.hello', { name: t(regularById(c.regular).nameKey) }), '#fff3b0');
    if (c.friend) this.popup(c.sprite.x, c.sprite.y - 20, t('visit.hello', { name: c.friend.name }), '#fee761');
    await this.visitBargain(c);
    if (c.gone) return;
    // Соседняя полка-пара: взяв хлеб, заодно берут и молоко (один раз за покупку).
    let extra: { id: ProductId; index: number } | null = null;
    for (const id of wanted) {
      if (c.gone) return;
      const index = shelfFor(this.state, id);
      if (index < 0) continue;
      const result = await visit(id, index);
      if (result === 'taken' && !extra && !c.thief && !c.first) extra = this.pairPick(index, wanted);
    }
    if (c.gone) return;
    if (extra) {
      this.popup(c.sprite.x, c.sprite.y - 20, t('popup.pair', { name: t(PRODUCTS[extra.id].nameKey) }), '#d6f5c4');
      await visit(extra.id, extra.index);
      if (c.gone) return;
    }

    if (!c.first && Math.random() < TRASH_CHANCE) this.dropTrash(c.sprite.x, c.sprite.y);
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
      // Первый день новичка: «всё раскупили» — не провал, ушедшим без покупки не считается (firstday.ts).
      if (disappointed && !this.night && !(gentleDay(this.state) && why?.reason === 'empty')) {
        this.stats.lost++;
        if (why) noteLost(this.stats, why.reason, why.id);
      }
      await this.leave(c);
      return;
    }

    // По пути к кассе — к полке «Еда» за порцией готового (если кухня открыта).
    await this.visitFood(c);
    if (c.gone) return;
    if (!c.first && Math.random() < TOILET_CHANCE) await this.visitToilet(c);
    if (c.gone) return;
    await this.buyCoffee(c);
    if (c.gone) return;

    if (await this.useKiosk(c)) return;
    if (c.gone) return;
    // Через одного, по порядку прихода: в тесной очереди встают ёлочкой, и сторона у каждого своя —
    // очередь подвинулась, а люди не перескакивают из ряда в ряд.
    c.queueSide = this.queueTurn++ % 2;
    this.queue.push(c);
    this.layoutQueue();
    const spot = this.registerOf(c)?.spot ?? this.queueSpot(c, this.queue.indexOf(c));
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
      (isCrowdDay(this.state.day) ? CROWD_PATIENCE : 1) *
      (c.first ? FIRST_PATIENCE : 1);
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

  /**
   * Первый день новичка, пока бабушка за прилавком: на полке товар кончился, а на складе он есть —
   * покупатель говорит «сейчас поднесут» и ждёт (бабушка или игрок разложат). true — ушёл, пока ждал.
   */
  private shelfWaitNeeded(c: Customer, index: number, id: ProductId): boolean {
    if (!gentleDay(this.state) || this.night || !this.granny?.active || c.thief) return false;
    return (this.state.shelves[index]?.items[id]?.length ?? 0) === 0 && (this.state.warehouse[id] ?? []).some((u) => !u.pending);
  }

  private async waitForShelf(c: Customer, index: number, id: ProductId): Promise<boolean> {
    const has = () => (this.state.shelves[index]?.items[id]?.length ?? 0) > 0;
    this.popup(c.sprite.x, c.sprite.y - 14, t('first.wait'), '#fff3b0');
    for (let waited = 0; waited < GRANNY_SHELF_WAIT_MS && !has(); waited += 300) {
      await this.wait(300);
      if (c.gone) return true;
    }
    return c.gone;
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
      radioTolerance(this.state) *
      adTrust(this.state) *
      // Химия рядом с едой — к еде с этой полки придираются сильнее.
      (this.clashes(index) ? CLASH_FACTOR : 1);
    // «2 по цене 1»: за штуку выходит вдвое дешевле.
    const bogo = promoKind(this.state, id) === 'bogo';
    const perUnit = bogo ? price / 2 : price;
    // Постоянный покупатель решает не по случаю, а по своей границе цены.
    const regular = c.regular ? regularById(c.regular) : undefined;
    // Первый покупатель нового начала берёт без раздумий: первая продажа не должна сорваться.
    const declines =
      !c.first && (regular?.favorite === id ? !acceptsPrice(this.state, livedRegular(this.state, regular), perUnit) : Math.random() >= buyChance(perUnit, fair));
    if (declines) {
      if (price <= fair) return 'skipped';
      this.popup(c.sprite.x, c.sprite.y - 14, t('popup.expensive'), '#ffd0d0');
      effects.emote(this, c.sprite, 'emo_pricey');
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
    let count = 1;
    // По акции «2 по цене 1» берут вторую штуку бесплатно.
    if (bogo) {
      const second = takeFromShelf(this.state, index, id);
      if (second) {
        this.state = second.state;
        c.items.push({ id, unit: second.unit, free: true });
        this.popup(c.sprite.x, c.sprite.y - 22, t('popup.bogo'), '#fee761');
        count++;
      }
    }
    // С полки пропадают последние штуки этого товара (остальное съедет на их место) — запоминаем,
    // где и какими они были: оттуда товар и полетит в руки (reachShelf), там качнутся соседи.
    const view = this.shelfViews[index];
    // Разбитое толчком — не товар: оно уже падает с полки, а не летит в руки.
    this.quakeFlush?.();
    const mine = view?.items.filter((img) => img.visible && (img.getData('stock') as string | null | undefined)?.startsWith(`${id}:`)) ?? [];
    this.takenFrom = mine
      .slice(-count)
      .reverse()
      .map((img) => ({ x: img.x, y: img.y, texture: img.texture.key, scale: img.scaleX, tint: img.tintTopLeft }));
    this.refreshShelves();
    if (view && this.takenFrom.length) motion.jostleShelf(this, view, this.takenFrom[0]);
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

  /** Касание кассы (или улицы внизу): хозяин пробивает того, кто ждёт у его кассы, или возвращается с дела. */
  private async serveNext(from = 0): Promise<void> {
    // За кассой хозяина сменщик: касание его кассы (или улицы) торопит пробивку, касание чужой — ничего.
    if (this.operator(0) !== 'owner') {
      if (from === 0) this.hurryRelief();
      return;
    }
    if (this.ownerScanning()) return;
    const r = this.ownerRegister();
    if (this.sellerBusy) {
      if (r) this.recallSeller();
      return;
    }
    const c = r?.customer;
    if (!r || !c || c.serving || !this.atSpot(r)) return;
    haptic.tap();
    // Хозяин не у кассы (его отвели в сторону — ограбление, перестройка) — сначала к ней.
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

  /**
   * За кассой хозяина сменщик: касание торопит его пробивку (срезает RELIEF_TAP_MS), а сам хозяин
   * за кассу не встаёт. true — касание ушло сменщику.
   */
  private hurryRelief(): boolean {
    const r = this.registers[0];
    if (!r || this.operator(0) === 'owner') return false;
    if (!r.scan || r.scan.byOwner || (r.scan.cut ?? 0) >= r.scan.total * RELIEF_HURRY_SHARE) return true;
    r.hurry = Math.min(RELIEF_HURRY_MAX_MS, r.hurry + RELIEF_TAP_MS);
    haptic.tap();
    if (r.img) motion.squash(this, r.img, 1.04, 0.94, 70);
    if (this.time.now - this.lastHurry > 1500) {
      this.lastHurry = this.time.now;
      this.popup(r.counter.x, r.counter.y - 36, t('popup.hurry'), '#fff3b0');
    }
    return true;
  }

  /** Пауза пробивки. У кассы хозяина её срезают касания (r.hurry), пока за кассой сменщик. */
  private async scanWait(r: Register, ms: number): Promise<void> {
    if (this.registers.indexOf(r) !== 0 || r.scan?.byOwner) return this.wait(ms);
    let left = ms;
    while (left > 0) {
      // Касаниями пробивку не сделать мгновенной: срезать можно не больше RELIEF_HURRY_SHARE от неё.
      const room = r.scan ? r.scan.total * RELIEF_HURRY_SHARE - (r.scan.cut ?? 0) : 0;
      const cut = Math.min(left, r.hurry, Math.max(0, room));
      if (cut > 0) {
        r.hurry -= cut;
        left -= cut;
        r.scan!.start -= cut;
        r.scan!.cut = (r.scan!.cut ?? 0) + cut;
        continue;
      }
      const step = Math.min(left, 100);
      await this.wait(step);
      if (!this.sys.isActive()) return;
      left -= step;
    }
  }

  /**
   * Пробивка: товары по одному уезжают по ленте, потом оплата. Время зависит от навыка
   * того, кто стоит за кассой (хозяин или кассир) и от размера корзины.
   */
  private async scanCustomer(r: Register, c: Customer, timing: ScanTiming, byOwner: boolean, by?: Phaser.GameObjects.Container): Promise<void> {
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
    // by — кто пробивает вместо хозяина у его кассы (бабушка в первый день, firstday.ts).
    const clerk = by ?? (byOwner ? this.seller : (this.operator(index) as Worker | null)?.sprite);
    // Товар и пакет — к тому, кто пробивает: сменщик стоит у стойки чуть выше хозяина.
    const hand = clerk?.active ? { x: clerk.x, y: clerk.y } : r.clerk;
    for (const [n, { id }] of c.items.entries()) {
      await this.scanWait(r, timing.item * 1000 * manual);
      if (!this.sys.isActive()) return;
      // Товар — на ленту, под красный луч сканера (вспышка), и дальше к кассиру в пакет.
      const item = this.art(c.sprite.x, c.sprite.y - 2, `item_${id}`).setScale(2 / ART).setDepth(1000);
      this.tweens.chain({
        targets: item,
        tweens: [
          { x: counter.x, y: counter.y - 8, duration: 180, ease: 'Quad.easeOut' },
          { x: hand.x, y: hand.y - 8, scale: 1 / ART, alpha: 0.3, duration: 160, ease: 'Quad.easeIn' },
        ],
        onComplete: () => item.destroy(),
      });
      this.time.delayedCall(170, () => {
        const flash = this.add.rectangle(counter.x, counter.y - 8, 10, 3, 0xff4a4a).setBlendMode(Phaser.BlendModes.ADD).setDepth(1001);
        this.tweens.add({ targets: flash, alpha: 0, scaleX: 1.6, duration: 160, onComplete: () => flash.destroy() });
        // Касса чуть вздрагивает на «пик».
        if (r.img) motion.squash(this, r.img, 1.04, 0.94, 70);
      });
      // Кассир берёт товар: короткий кивок-подпрыгивание.
      if (clerk?.active) {
        const base = (clerk.getData('baseScale') as number) ?? 1;
        this.tweens.add({ targets: clerk, scaleY: base * 1.06, duration: 90, yoyo: true, onComplete: () => clerk.setScale(base) });
      }
      // Без вибрации на каждый товар: на телефоне она щёлкает громче самого сканера. «Пик» — пачкой:
      // первый товар ясно, дальше через один и тише (sound.ts).
      sound.scan(counter.x, n);
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
    await this.scanWait(r, timing.pay * 1000);
    r.scan = null;
    r.hurry = 0;
    if (!this.sys.isActive()) return;
    // Кассир отдаёт пакет из рук в руки (с тележкой — товар уже в ней).
    if (c.items.length && c.sprite.getData('push') !== 'trolley' && c.sprite.active) {
      const bag = this.art(hand.x, hand.y - 6, 'paper_bag').setScale(0.85 / ART).setDepth(1000);
      await new Promise<void>((done) =>
        this.tweens.add({
          targets: bag,
          x: c.sprite.x + 6,
          y: c.sprite.y + 3,
          duration: 260,
          ease: 'Sine.easeInOut',
          onUpdate: (tw) => bag.setY(Phaser.Math.Linear(hand.y - 6, c.sprite.y + 3, tw.progress) - Math.sin(tw.progress * Math.PI) * 8),
          onComplete: () => {
            bag.destroy();
            done();
          },
        }),
      );
      if (!this.sys.isActive()) return;
    }
    this.finishCheckout(c, undefined, byOwner);
    if (byOwner) this.ownerServedOne();
    // Хвалит бабушка только за то, что пробил сам новичок, — уже с этой покупкой в счёте.
    if (byOwner && grannyStays(this.state)) this.grannyPraise();
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
    if (result.isNew && !music.sting('coin')) sound.fanfare();
    if (result.completed) {
      haptic.success();
      this.time.delayedCall(1200, () => this.popup(sellerHome.x - 24, sellerHome.y - 52, t('popup.albumDone', { money: ALBUM_REWARD.money }), '#fee761'));
    }
  }

  /** Хозяин обслужил покупателя: растёт навык кассы. */
  private ownerServedOne(): void {
    this.serves.owner++;
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

  /** Покупатель расплатился; own — пробивал хозяин (полный звук кассы — награда игроку). */
  private finishCheckout(c: Customer, where?: { x: number; y: number }, own = false): void {
    // Шаг обучения «Пробей покупку» — пробил сам, касанием кассы или улицы.
    if (own) this.passTut('serve');
    this.queue = this.queue.filter((q) => q !== c);
    const at = this.registerOf(c);
    if (at) at.customer = null;

    // Порцию с полки «Еда» покупатель взял сам по пути (visitFood) — платит за неё здесь, вместе с покупками.
    const { state, total: goods } = checkout(this.state, c.items, this.night ? NIGHT_MARKUP : 1);
    // Шоколадка и кофе — сверху к товару.
    const extras = (c.extras ?? []).reduce((sum, e) => sum + e.price, 0);
    const total = goods + extras;
    this.state = { ...state, money: state.money + extras };
    for (const e of c.extras ?? []) {
      if (e.kind === 'dish') this.stats.dishes = (this.stats.dishes ?? 0) + 1;
      else note(this.stats, e.kind);
    }
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
    // Касса: рычаг, «дзынь», ящик выезжает; мелочь или купюры — смотря по сумме; большая корзина — «спасибо».
    sound.till(c.sprite.x, total, { own, items: c.items.length });
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
    effects.flyCoins(this, where?.x ?? at?.counter.x ?? this.layout.counter.x, where?.y ?? at?.counter.y ?? this.layout.counter.y, Math.min(6, 2 + Math.floor(total / 40)) + Math.min(this.combo - 1, 5));
    if (this.combo >= 2) this.celebrateCombo(this.combo);
    // Серия от пяти — весь зал оборачивается на кассу.
    if (this.combo === 5 || this.combo === 10) this.everyoneLooks(this.layout.counter.x, this.layout.counter.y, 'emo_star');

    const dirty = this.trash.size >= TRASH_COMPLAINT || this.binFull();
    const badGoods = hasUnmarkedBad(c.items) && Math.random() < BAD_COMPLAINT_CHANCE;
    // Гнилой мусор и давно полное ведро пахнут: чем сильнее, тем чаще морщатся (rot.ts).
    // (Полное ведро и так «грязно» — его запах здесь не добавляется второй раз.)
    const smelly = !c.unhappy && !dirty && Math.random() < smellChance(this.smell());
    if (c.unhappy || dirty || badGoods || smelly) {
      this.stats.complaints++;
      if (badGoods) note(this.stats, 'badGoods');
      else if (dirty) note(this.stats, 'dirty');
      else if (smelly) note(this.stats, 'smell');
      const why = badGoods ? t('popup.badProduct') : dirty ? t('popup.dirty') : smelly ? t('popup.smell') : '😣';
      this.popup(c.sprite.x, c.sprite.y - 26, why, '#ffd0d0');
      effects.emote(this, c.sprite, 'emo_angry');
      this.setMood(c.sprite, 'frown');
    } else {
      this.setMood(c.sprite, 'happy', 2500);
      if (Math.random() < 0.5) effects.emote(this, c.sprite, 'emo_heart');
    }
    this.layoutQueue();
    if (this.state.onboarding && !onbDone(this.state, 'sale')) this.firstSale(total);
    void this.leave(c, true);
  }

  /** Ушёл, не заплатив: шоколадка — обратно на стойку, порция — обратно на полку «Еда». */
  private returnExtras(c: Customer): void {
    for (const extra of c.extras ?? []) {
      if (extra.kind === 'candy') this.state = returnCandy(this.state);
      if (extra.dish) this.state = servePortions(this.state, extra.dish, 1);
    }
    if (c.extras?.some((e) => e.dish)) this.refreshFood();
  }

  private async giveUp(c: Customer): Promise<void> {
    if (c.gone || c.serving) return;
    // Первый день новичка после первой продажи: очередь держит бабушка — покупатель ещё подождёт,
    // а у кассы его пробьёт она (firstday.ts grannyServesAfter).
    if (this.running && !this.night && this.granny?.active && grannyServesAfter(this.state, false) !== null) {
      c.patience = this.time.delayedCall(GRANNY_PATIENCE_MS, () => void this.giveUp(c));
      return;
    }
    this.queue = this.queue.filter((q) => q !== c);
    const at = this.registerOf(c);
    if (at) at.customer = null;
    c.bubble.setVisible(false);
    this.state = returnToShelf(this.state, c.items);
    c.items = [];
    this.returnExtras(c);
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
    effects.emote(this, c.sprite, 'emo_angry');
    this.setMood(c.sprite, 'frown');
    this.layoutQueue();
    await this.leave(c);
  }

  private async leave(c: Customer, pastCounter = false): Promise<void> {
    c.gone = true;
    const { door, h, queue, counter } = this.layout;
    const route: Point[] = pastCounter ? [{ x: queue.x, y: counter.y + 40 }] : [];
    // Из зала — в обход полок и в дверной проём (с ближнего к себе края), а не наискосок сквозь мебель
    // и стену у входа. Крюк выходит в пару шагов: на поток покупателей не влияет.
    if (c.sprite.y < h - 2) {
      const from = route[0] ?? c.sprite;
      route.push({ x: door.x + Phaser.Math.Clamp(from.x - door.x, -DOOR_EDGE, DOOR_EDGE), y: door.y - 4 });
    }
    route.push({ x: door.x, y: h + 16 });
    await this.walkVia(c.sprite, route);
    this.dropTrolley(c.sprite);
    this.customers.delete(c);
    // Приехавший на машине идёт к ней на парковку, остальные — по тротуару за край кадра.
    if (c.car) void this.driveHome(c.sprite, c.car);
    else void this.strollAway(c.sprite);
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
      weatherFx.addUmbrella(this, person);
      if (Math.random() < 0.1) this.addCompanion(person);
      void this.walk(person, fromLeft ? right : left, y, this.ownPace(person, CUSTOMER_SPEED * Phaser.Math.FloatBetween(0.75, 1.1))).then(() => person.destroy());
    }
    if (flood) return;
    if (Math.random() < 0.14) this.passerby();
    // Автобус тоже не выезжает следом за машиной с парковки.
    if (Math.random() < 0.04 && !this.parking?.onRoad) this.driveBus();
    if (Math.random() < 0.3) {
      const toRight = Math.random() < 0.5;
      // Машина с парковки сейчас на дороге (сворачивает к ней или выезжает) — новые не въезжают ей в бок и в багажник.
      if (this.parking?.onRoad) return;
      const y = this.streetY + (toRight ? 24 : 42);
      const total = CAR_TYPES.reduce((sum, [, , weight]) => sum + weight, 0);
      let roll = Math.random() * total;
      const [key, color] = CAR_TYPES.find(([, , weight]) => (roll -= weight) < 0) ?? CAR_TYPES[0];
      const body = this.art(0, 0, key);
      if (color !== null) body.setTint(color || Phaser.Utils.Array.GetRandom(CAR_COLORS));
      const lights = this.art(0, 0, `${key}_lights`);
      // Вечером фары светят вперёд: конусом в карте освещения, а в лёгкой графике — пятном поверх темноты.
      const beam = this.art(body.displayWidth / 2 + 8, 0, 'glow')
        .setScale(30 / 64, 16 / 64)
        .setTint(0xfff0b0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.8 * this.evening * this.beamHaze());
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
      car.setScale(toRight ? 1 : -1, 1);
      const lit = this.headlights(car);
      const dir = toRight ? 1 : -1;
      lit.rotation = -dir * (Math.PI / 2);
      lit.sync = () => {
        lit.x = car.x + dir * (body.displayWidth / 2 - 2);
        lit.y = car.y;
        lit.set(HEADLIGHT_POWER * this.evening);
      };
      this.onRoad(car, toRight ? 'up' : 'down');
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
      // Крутит педали, а не бежит: без подскока, наклона и пыли.
      rider.setData('wheels', true);
      void this.walk(rider, fromLeft ? right : left, y, 70).then(() => rider.destroy());
      // Иногда звонит в звонок — когда проезжает мимо магазина.
      if (Math.random() < 0.35) {
        const ms = (Math.abs(this.layout.door.x - rider.x) / 70) * 1000 * Phaser.Math.FloatBetween(0.6, 1);
        this.time.delayedCall(ms, () => rider.active && ambience.street('bike', rider.x));
      }
      return;
    }
    const y = this.streetY + Phaser.Math.Between(-5, 5);
    if (roll < 0.7) {
      const runner = this.makePerson(fromLeft ? left : right, y, { ...base, outfit: 'runner', outfitTint: Phaser.Utils.Array.GetRandom(HAT_COLORS), hat: 'headband', hatTint: 0xffffff, coat: undefined, scarf: undefined });
      void this.walk(runner, fromLeft ? right : left, y, CUSTOMER_SPEED * 2.4).then(() => runner.destroy());
      return;
    }
    const walker = this.makePerson(fromLeft ? left : right, y, { ...base, dog: Phaser.Utils.Array.GetRandom(DOG_COLORS) });
    weatherFx.addUmbrella(this, walker);
    void this.walk(walker, fromLeft ? right : left, y, this.ownPace(walker, CUSTOMER_SPEED * 0.8)).then(() => walker.destroy());
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
    const road = this.onRoad(bus, 'up', true);
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
            weatherFx.addUmbrella(this, p);
            const to = Math.random() < 0.5 ? -100 : this.next.w + 100;
            void this.walk(p, p.x, y).then(() => this.walk(p, to, y, CUSTOMER_SPEED * 0.9)).then(() => p.destroy());
          });
        }
        void this.wait(1800)
          .then(() => this.yieldToLot(road, true))
          .then(() => bus.active && this.tweens.add({ targets: bus, x: this.next.w + 140, duration: 3200, ease: 'Sine.easeIn', onComplete: () => bus.destroy() }));
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
        const stopDust = this.worldTimer(420, () => sweeper.active && this.steamPuff(sweeper.x + 7, sweeper.y + 6, 0xc8b8a0));
        void this.walk(sweeper, this.next.w + 60, y, CUSTOMER_SPEED * 0.45).then(() => {
          stopDust();
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
        const road = this.onRoad(truck, 'up', true);
        this.tweens.add({
          targets: truck,
          x: dump.x + 10,
          duration: 2600,
          ease: 'Sine.easeOut',
          onComplete: () => {
            if (this.dumpImg?.active) this.tweens.add({ targets: this.dumpImg, angle: { from: -6, to: 6 }, duration: 90, yoyo: true, repeat: 5, onComplete: () => this.dumpImg?.setAngle(0) });
            void this.wait(2200)
              .then(() => this.yieldToLot(road, true))
              .then(() => truck.active && this.tweens.add({ targets: truck, x: this.next.w + 160, duration: 3200, ease: 'Sine.easeIn', onComplete: () => truck.destroy() }));
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
    await this.walkVia(sprite, [
      { x: door.x, y: this.streetY },
      { x: door.x, y: door.y - 10 },
      { x: sellerHome.x - 30, y: sellerHome.y - 16 },
    ]);
    if (!sprite.active || !this.running) {
      sprite.destroy();
      return;
    }
    this.setFacing(sprite, 'right');
    const item = PRODUCTS[visit.product];
    this.popup(sprite.x, sprite.y - 18, t(`special.${visit.kind}.hello` as TextKey), '#fff3b0');
    // «!» над головой мигает, пока не ответишь.
    const mark = this.add.text(0, -24, '!', { fontFamily: UI_FONT, fontSize: '10px', color: '#fee761', stroke: '#181425', strokeThickness: 3 }).setOrigin(0.5).setResolution(this.textRes(4));
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
      sound.coin(sprite.x);
      this.popup(sprite.x, sprite.y - 18, `+${res.money} 💰`, '#c8ffb0');
    }
    if (res.rating > 0) this.time.delayedCall(500, () => this.popup(sprite.x, sprite.y - 26, `★ +${res.rating}`, '#fee761'));
    if (res.rating < 0) this.time.delayedCall(500, () => this.popup(sprite.x, sprite.y - 26, `★ ${res.rating}`, '#ffd0d0'));
    effects.emote(this, sprite, yes ? 'emo_heart' : 'emo_angry');
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
    weatherFx.addUmbrella(this, sprite);
    await this.walkVia(sprite, [
      { x: door.x, y: this.streetY },
      { x: door.x, y: door.y - 10 },
      { x: sellerHome.x - 28, y: sellerHome.y - 12 },
    ]);
    if (!sprite.active) return;
    this.setFacing(sprite, 'right');
    this.popup(sprite.x, sprite.y - 18, line, '#fff3b0');
    effects.emote(this, sprite, 'emo_heart');
    onArrive?.();
    await this.wait(2200);
    if (carriesBox && sprite.active) sprite.add(this.art(0, 3, 'box'));
    await this.walkVia(sprite, [
      { x: door.x, y: door.y - 10 },
      { x: door.x, y: this.layout.h + 16 },
    ]);
    void this.strollAway(sprite);
  }

  /** Эдуард подходит к витрине, присматривается и уходит в свой магазин по соседству. */
  private async runEduard(): Promise<void> {
    const { w, h } = this.layout;
    const sprite = this.makePerson(this.next.w + 60, this.streetY, EDUARD);
    await this.walkVia(sprite, [
      { x: w - 20, y: this.streetY },
      { x: w - 20, y: h + 15 },
    ]);
    if (!sprite.active) return;
    this.setFacing(sprite, 'up');
    effects.emote(this, sprite, 'emo_question');
    this.popup(sprite.x, sprite.y - 18, t('popup.eduard'), '#d0e0ff');
    await this.wait(2500);
    // Его магазин за дорогой, напротив входа — переходит по зебре; иначе — по соседству справа.
    const home = this.rivalAcross ? { x: this.layout.door.x, y: this.streetY + 82 } : { x: this.next.w + SIDE_SHOP_X + SIDE_SHOP_W * 0.62, y: this.next.h - 2 };
    await this.walkVia(sprite, [
      { x: w - 20, y: this.streetY },
      { x: home.x, y: this.streetY },
      home,
    ]);
    sprite.destroy();
  }

  /** Официант кафе «Пончик» приходит к магазину за заказом по договору и уносит коробку. */
  private async runCafeWaiter(): Promise<void> {
    const { door, h } = this.layout;
    const cafeDoor = -136 - WING_OUTER + 112 * 0.62;
    const sprite = this.makePerson(cafeDoor, this.next.h - 2, { ...randomLook(0x733e39), acc: 'apron', accTint: 0xffffff });
    await this.walkVia(sprite, [
      { x: cafeDoor, y: this.streetY },
      { x: door.x, y: this.streetY },
      { x: door.x, y: h + 15 },
    ]);
    if (!sprite.active) return;
    this.setFacing(sprite, 'up');
    this.popup(sprite.x, sprite.y - 18, t('popup.cafeWaiter'), '#fff3b0');
    await this.wait(1500);
    const result = this.cafeToday;
    if (!sprite.active) return;
    if (result?.delivered) {
      sound.coin(sprite.x);
      this.popup(sprite.x, sprite.y - 18, t('popup.cafePaid', { n: result.pay }), '#c8ffb0');
      sprite.add(this.art(0, 3, 'box'));
    } else this.popup(sprite.x, sprite.y - 18, t('popup.cafeShort'), '#ffd0d0');
    await this.wait(900);
    await this.walkVia(sprite, [
      { x: door.x, y: this.streetY },
      { x: cafeDoor, y: this.streetY },
      { x: cafeDoor, y: this.next.h - 2 },
    ]);
    sprite.destroy();
  }

  /** Откуда приходят с улицы: с тротуара слева или справа от входа. */
  private streetSpawn(): Phaser.Types.Math.Vector2Like {
    const side = Math.random() < 0.5 ? -1 : 1;
    return { x: this.layout.door.x + side * Phaser.Math.Between(50, 90), y: this.streetY + Phaser.Math.Between(-3, 3) };
  }

  /** Вышел из магазина — уходит по тротуару за край кадра. */
  private async strollAway(sprite: Phaser.GameObjects.Container): Promise<void> {
    const y = this.streetY + Phaser.Math.Between(-3, 3);
    const side = Math.random() < 0.5 ? -1 : 1;
    // С крыльца на тротуар и в сторону — одним ходом, заворачивая, а не по команде «налево».
    await this.walkVia(sprite, [
      { x: this.layout.door.x, y },
      { x: side < 0 ? -60 : this.next.w + 60, y },
    ]);
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
    this.queue.forEach((c, i) => {
      const spot = this.queueSpot(c, i);
      void this.walk(c.sprite, spot.x, spot.y);
    });
  }

  private updateBubble(c: Customer): void {
    if (!c.bubble.visible) return;
    const left = 1 - (this.time.now - c.waitStart) / (c.patienceMs ?? PATIENCE_MS);
    c.bubble.setTint(left > 0.6 ? 0x8fd16a : left > 0.3 ? 0xf2c14e : 0xd95763);
    // Терпение кончается — человек в очереди хмурится.
    if (left <= 0.3 && c.sprite.getData('mood') !== 'frown') this.setMood(c.sprite, 'frown');
  }

  // ---------- Утилиты ----------

  /**
   * Место в линии: сразу за кассами (выше их мест), длинная очередь сжимается до стены (в тесном
   * ларьке стоит плотнее, чтобы не упираться в полки). Сжалась теснее роста человека — встают
   * «ёлочкой», через одного чуть левее: видно каждого, а не стопку голов друг в друге.
   */
  private queueSpot(c: Customer, index: number): Point {
    const { x, y, step, minY } = this.layout.queue;
    const top = (this.registers.length ? Math.min(...this.registers.map((r) => r.spot.y)) : y + step) - step;
    const fit = this.queue.length > 1 ? (top - minY) / (this.queue.length - 1) : step;
    const gap = Math.min(step, fit);
    return { x: x - (gap < QUEUE_SNUG ? (c.queueSide ?? 0) * QUEUE_STAGGER : 0), y: top - index * gap };
  }

  /**
   * Идёт к точке; в зале — в обход мебели, по нескольким отрезкам. Новый walk отменяет прежний.
   * Мир перестроили, пока шёл, — дело дальше не идёт: обещание так и не исполнится (как и у wait).
   * Без скорости — своим шагом (покупатели): старик с тростью медленнее, спортсмен бодрее, с коляской ровнее.
   */
  private walk(target: Phaser.GameObjects.Container, x: number, y: number, speed?: number): Promise<void> {
    return this.walkVia(target, [{ x, y }], speed);
  }

  /**
   * Идёт через несколько точек одним ходом: у дверей и полок не встаёт на каждом повороте, а заворачивает
   * дугой (stride.ts). С места разгоняется, к концу притормаживает, но в пути ровно столько, сколько шёл бы
   * ровным шагом по ломаной, — ход игры от походки не зависит. Встречного и стоящего на пути обходит
   * чуть сбоку (на слабом телефоне — нет). Шаг — твин-счётчик: ×2 и пауза действуют на него, как на всё,
   * а killTweensOf(человек) его не гасит — для этого haltWalk.
   */
  private walkVia(target: Phaser.GameObjects.Container, points: Point[], speed?: number, opts: { depth?: (y: number) => number; direct?: boolean } = {}): Promise<void> {
    const world = this.worldGen;
    const st = this.strideOf(target);
    const pace = speed ?? this.ownPace(target);
    const from = { x: target.x, y: target.y };
    const legs: Point[] = [];
    let at = from;
    for (const p of points) {
      // В зале — в обход мебели; на улице и через дверь — напрямик.
      const indoor = !opts.direct && at.y < this.layout.h - 2 && p.y < this.layout.h - 2;
      legs.push(...(indoor ? findPath(at, p, this.obstacles) : [p]));
      at = p;
    }
    const route = makeRoute([from, ...roundCorners(from, legs, this.obstacles)]);
    const duration = (polylineLength(from, legs) / pace) * 1000;
    // Останавливаем только прошлый шаг: прыжок от радости и прочие анимации доигрывают.
    (target.getData('move') as Phaser.Tweens.Tween | undefined)?.stop();
    // Уже шёл (новый путь посреди прежнего или сразу следом) — продолжает с той же скоростью, без разгона.
    const going = Boolean(target.getData('walking')) || this.time.now - st.endAt < STEP_GRACE;
    Object.assign(st, { route, pace: planPace(route.length, duration, going ? st.vel : 0), seg: 0, t: 0, lane: 0, laneGoal: 0, laneAt: 0, turn: undefined, depthOf: opts.depth });
    // Уже на месте (очередь пересчитали, а он и так стоит где надо) — не «трогается» на кадр.
    if (route.length >= 0.3) target.setData('walking', true);
    // Темп шага (animatePeople): чем быстрее идёт, тем шире и чаще шаг.
    target.setData('pace', pace);
    const end = route.pts[route.pts.length - 1];
    return new Promise<void>((resolve) => {
      const stop = () => {
        target.setData('walking', false);
        st.endAt = this.time.now;
        resolve();
      };
      const move = this.tweens.addCounter({
        from: 0,
        to: duration,
        duration,
        onUpdate: (tween) => this.stepAlong(target, st, tween.getValue() ?? 0),
        onComplete: () => {
          if (target.active) {
            target.setPosition(end.x, end.y).setDepth(st.depthOf ? st.depthOf(end.y) : end.y);
            // Не успел довернуться кругом — встаёт той стороной, куда шёл.
            if (st.turn) this.setFacing(target, st.turn.to);
          }
          st.turn = undefined;
          stop();
        },
        onStop: stop,
      });
      target.setData('move', move);
    }).then(() => (world === this.worldGen ? undefined : new Promise<void>(() => undefined)));
  }

  /** Своим ходом: скорость base с поправкой на походку человека (старик медленнее, спортсмен бодрее). */
  private ownPace(person: Phaser.GameObjects.Container, base = this.customerSpeed()): number {
    return base * this.strideOf(person).speed;
  }

  /** Остановить шаг на месте, не исполняя обещание walk (как прежде killTweensOf гасил твин шага). */
  private haltWalk(person: Phaser.GameObjects.Container): void {
    (person.getData('move') as Phaser.Tweens.Tween | undefined)?.destroy();
    person.setData('walking', false);
  }

  /** Шаг по пути: где человек через t мс (времени игры), куда смотрит, насколько отошёл вбок от встречного. */
  private stepAlong(target: Phaser.GameObjects.Container, st: Stride, t: number): void {
    const { route, pace } = st;
    if (!target.active || !route || !pace) return;
    const dt = Math.max(0, t - st.t);
    st.t = t;
    const { s, v } = paceAt(pace, t);
    const p = sampleRoute(route, s, st.seg);
    st.seg = p.seg;
    if (p.dx || p.dy) {
      st.dirX = p.dx;
      st.dirY = p.dy;
    }
    st.vel = v;
    st.ratio = pace.vc > 0 ? v / pace.vc : 1;
    // Разойтись со встречным: раз в LANE_EVERY смотрит вперёд, а вбок отходит плавно.
    if (!this.lite) {
      if (t >= st.laneAt) {
        st.laneAt = t + LANE_EVERY;
        st.laneGoal = this.laneGoal(target, st, p.x, p.y, route.length - s);
      }
      const step = (LANE_SPEED * dt) / 1000;
      st.lane += Phaser.Math.Clamp(st.laneGoal - st.lane, -step, step);
    }
    // У начала и конца пути сдвиг сходит на нет: приходит ровно туда, куда шёл.
    const off = st.lane * Phaser.Math.Clamp(Math.min(s, route.length - s) / 10, 0, 1);
    target.x = p.x - st.dirY * off;
    target.y = p.y + st.dirX * off;
    // Глубину трогаем, только если она правда сменилась: каждая смена — пересортировка всей сцены.
    const depth = st.depthOf ? st.depthOf(target.y) : target.y;
    if (target.depth !== depth) target.setDepth(depth);
    if (route.length > 0.5) this.faceAlong(target, st, t);
  }

  /** Смотрит туда, куда идёт; кругом поворачивается не мгновенно — на миг встаёт вполоборота. */
  private faceAlong(target: Phaser.GameObjects.Container, st: Stride, t: number): void {
    if (st.turn) {
      if (t < st.turn.at) return;
      this.setFacing(target, st.turn.to);
      st.turn = undefined;
    }
    if (!st.dirX && !st.dirY) return;
    const current = target.getData('facing') as Facing | undefined;
    const want = facingAlong(st.dirX, st.dirY, current);
    if (want === current) return;
    const via = current && turnVia(current, want, st.dirX);
    if (via) {
      this.setFacing(target, via);
      st.turn = { to: want, at: t + TURN_MS };
    } else this.setFacing(target, want);
  }

  /** Люди на сцене в этом кадре: где стоят и куда идут (для обхода встречных; считаем раз за кадр). */
  private passers(): Passer[] {
    const frame = this.game.loop.frame;
    if (this.crowd.frame === frame) return this.crowd.list;
    const list: Passer[] = [];
    for (const p of this.people) {
      // Только те, кто стоит прямо на сцене и виден: сидящий в чужом контейнере (лодка) — не помеха.
      if (!p.active || !p.visible || p.displayList !== this.children) continue;
      const st = p.getData('stride') as Stride | undefined;
      list.push({ x: p.x, y: p.y, dx: st?.dirX ?? 0, dy: st?.dirY ?? 0, moving: Boolean(p.getData('walking')), shift: st ? st.laneGoal - st.lane : 0 });
    }
    this.crowd = { frame, list };
    return list;
  }

  /**
   * Насколько отойти вбок, чтобы не пройти сквозь людей впереди (stride.ts: sidestep). Сдвиг не
   * заводит в мебель: там, где окажется сейчас и через полшага, должно быть свободно; негде разойтись —
   * протиснутся по своему пути, как раньше.
   */
  private laneGoal(target: Phaser.GameObjects.Container, st: Stride, x: number, y: number, left: number): number {
    const free = (lane: number) =>
      [0, 8].every((ahead) => {
        const qx = x + st.dirX * ahead - st.dirY * lane;
        const qy = y + st.dirY * ahead + st.dirX * lane;
        return this.obstacles.every((r) => qx <= r.x + 1 || qx >= r.x + r.w - 1 || qy <= r.y + 1 || qy >= r.y + r.h - 1);
      });
    return sidestep({ x: target.x, y: target.y }, st.dirX, st.dirY, st.lane, this.passers(), left, free);
  }

  /**
   * Пауза в деле. Если за это время мир перестроили, дело старого мира на ней и обрывается: его люди
   * и вещи уже уничтожены (так же обрывается шаг walk — killAll гасит его твин без onStop).
   */
  wait(ms: number): Promise<void> {
    const world = this.worldGen;
    return new Promise((resolve) => this.time.delayedCall(ms, () => world === this.worldGen && resolve()));
  }

  /** Пауза, которая переживает перестройку мира: для сцен, что перестраивают его сами (расширение). */
  delay(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  /** Переходник к effects.popup: метод сцены вызывают и скрипты снаружи (scripts/e2e.ts, scripts/promo). */
  popup(x: number, y: number, text: string, color: string): void {
    return effects.popup(this, x, y, text, color);
  }

  // ---------- День ----------

  /** Подарок за ежедневный вход: деньги (и товар) сразу в состоянии, окно — поверх утра. */
  private offerGift(): void {
    const claimed = claimGift(this.state, todayLocal(), Math.random);
    if (!claimed) return;
    // Товар из гостинца сразу встаёт на полки, если есть место.
    this.state = shelveAll(claimed.state);
    saveGame(this.state);
    this.hud.update(this.state, DAY_SECONDS);
    this.refreshWarehouse();
    this.time.delayedCall(400, () => showGift(claimed.gift, giftTomorrow(this.state, todayLocal())));
    // Со второго дня — один раз спросить, можно ли боту напоминать о магазине.
    if (this.state.day > 1) this.time.delayedCall(4000, askWriteAccessOnce);
  }

  /**
   * Ритуал возвращения (returns.ts): сундучок выручки, письмо, сосед за отложенным — одним окном
   * поверх утра; после него — then (гостинец). Нечего показать — сразу then.
   */
  private offerReturn(then: () => void): void {
    // Утро открывают заново (расстановка, возврат из гостей) — ритуал второй раз не показываем.
    if (this.ritualDay === this.state.day) {
      then();
      return;
    }
    this.ritualDay = this.state.day;
    const chest = this.state.ret?.chest;
    const letter = takeLetter(this.state, todayLocal());
    if (letter) this.state = letter.state;
    const order = collectOrder(this.state);
    // Заказ не на сегодня (устарел) — сосед просто не пришёл, окно о нём не нужно.
    const fresh = order && order.order.day === this.state.day ? order : null;
    if (order) this.state = order.state;
    if (letter || order) {
      saveGame(this.state);
      this.hud.update(this.state, DAY_SECONDS);
      if (order?.paid) this.refreshShelves();
    }
    if (letter) track('ret_letter', this.state.day);
    if (fresh) track(fresh.paid ? 'ret_order' : 'ret_order_wait', this.state.day, fresh.paid);
    if (!chest && !letter && !fresh) {
      then();
      return;
    }
    this.time.delayedCall(400, () =>
      showReturn({
        chest,
        letter: letter?.gift,
        order: fresh ?? undefined,
        onChest: () => {
          const opened = openChest(this.state);
          if (!opened) return;
          this.state = opened.state;
          saveGame(this.state);
          this.hud.update(this.state, DAY_SECONDS);
          track('ret_chest', this.state.day, opened.chest.sum);
        },
        onDone: then,
      }),
    );
  }

  private showMorning(): void {
    // За ночь склад доливает полки: утром всё, что влезает, уже стоит в зале (просрочку списали ночью).
    // По настоящим часам: новый сезон пропуска и выходные «Чёрной пятницы района».
    this.state = ensureRush(ensureSeason(shelveAll(this.state), trustedNow()), trustedNow());
    // Подарок за ежедневный вход — но не во время бабушкиного обучения: его вручат, когда оно закончится.
    // В новом начале в первый день утра нет, а потом гостинец ждёт конца вступления главы.
    const noMorning = playDayOne(this.state);
    // Игру закрыли на итогах дня — утром о них уже не говорим.
    this.state = tutMorning(this.state);
    const afterStory = this.state.onboarding === 'play' && pendingStory(this.state)?.kind === 'intro';
    // Сначала то, что накопилось без игрока (сундучок, письмо, сосед за заказом), потом гостинец.
    if (this.state.tourDone !== false && !noMorning && !afterStory) this.offerReturn(() => this.offerGift());
    // Старые сохранения сразу получают значки за то, что уже сделано.
    this.checkAchievements(false);
    // Лёгкую графику включили молча в тихие дни новичка — теперь можно и сказать.
    if (!quietDays(this.state) && takeLiteNote()) toast('assets/ico_phone.png', t('lite.autoTitle'), t('lite.autoText'));
    this.morningStock = warehouseCount(this.state);
    decorations.applyFair(this);
    this.awaitingBoxes = 0;
    this.hud.update(this.state, DAY_SECONDS);
    if (weatherFor(this.state.day) !== this.weather) weatherFx.applyWeather(this);
    // Примерка премиальной вещи кончилась вчера — убрать её из зала.
    const trial = this.state.decor.trial;
    const trialOver = Boolean(trial && trial.day < this.state.day);
    if (trialOver) this.state = { ...this.state, decor: { ...this.state.decor, trial: undefined } };
    // Эдуард за ночь открыл магазин побольше — перерисовать улицу.
    const cupChanged = (contestOf(this.state)?.wins ?? 0) !== this.builtCup;
    const gift = this.giftRebuild;
    this.giftRebuild = false;
    if (gift || this.cleanKey() !== this.builtClean || trialOver || cupChanged || eduardLook(this.state) !== this.builtEduard || giantLook(this.state) !== this.builtGiant || branchLook(this.state) !== this.builtBranch || districtKey(this.state) !== this.builtDistrict || hoodLook(this.state) !== this.builtHood) this.buildWorld();
    this.refillParking();
    this.updateLighting(0);
    this.openShop();
    // Новый день: после ночной смены — снова дневная музыка; зима могла начаться или кончиться.
    this.nightMusic = false;
    this.winterTune = decorations.isWinterMusic(this);
    this.newYearSound = decorations.isNewYearSound(this);
    music.prefetch('day_open');
    // Новое начало: первый день — сразу торговля, без утреннего окна.
    if (noMorning) {
      this.startDay();
      return;
    }
    showMorning({
      onArrange: () => this.arrange(),
      onVisit: (id, name) => void this.visitFriend(id, name),
      onRival: (key, name) => void this.visitRival(key, name),
      onBoss: eduardLook(this.state) !== 'vacant' ? () => void this.visitRival(null, '') : undefined,
      onTourDone: () => this.offerReturn(() => this.offerGift()),
      onStoryDone: afterStory ? () => this.offerReturn(() => this.offerGift()) : undefined,
      coach: this.coach,
      getState: () => this.state,
      setState: (s) => {
        const staffChanged = s.staff !== this.state.staff;
        const decorChanged = s.decor !== this.state.decor;
        const adsChanged = s.ads !== this.state.ads || s.adRuns !== this.state.adRuns;
        // Купили приёмник — его надо поставить на прилавок; сменили волну — только музыка.
        const upgradesChanged = s.upgrades !== this.state.upgrades || s.registers !== this.state.registers || s.kiosks?.n !== this.state.kiosks?.n || s.kiosks?.tier !== this.state.kiosks?.tier || s.gear !== this.state.gear || hasRadio(s) !== hasRadio(this.state);
        const radioChanged = s.radio !== this.state.radio;
        // Кота оставили, купили лежанку или он вернулся с прогулки — перерисовать вход.
        const was = this.state;
        // Убрали или продали полку — остальные остались на местах, но сами места переставлены.
        const placesChanged = s.slotPos !== was.slotPos || s.tillPos !== was.tillPos || s.propPos !== was.propPos;
        const catChanged = Boolean(s.cat) !== Boolean(was.cat) || s.cat?.bed !== was.cat?.bed || catHome(s) !== catHome(was) || hasDog(s) !== hasDog(was) || sunflowersPlanted(s) !== sunflowersPlanted(was);
        // Купили оборудование или украшение — при открытии его распакуют. Перестановка — не покупка.
        const bought = (decorChanged || upgradesChanged) && !placesChanged && s.level === this.builtLevel;
        // Наняли — новенький при открытии войдёт в дверь.
        if (staffChanged) for (const m of s.staff) if (!was.staff.some((o) => staffKey(o) === staffKey(m))) this.newHires.add(staffKey(m));
        this.state = s;
        saveGame(s);
        if (s.level > this.builtLevel) void effects.celebrateExpansion(this);
        else if (s.level !== this.builtLevel || placesChanged || decorChanged || upgradesChanged || catChanged || eduardLook(s) !== this.builtEduard || giantLook(s) !== this.builtGiant || branchLook(s) !== this.builtBranch || hoodLook(s) !== this.builtHood) this.buildWorld(bought);
        else if (staffChanged) this.syncStaff();
        if (adsChanged) this.applyAds();
        if (radioChanged) decorations.applyRadio(this, true);
        this.awaitingBoxes = this.boxesToDeliver();
        this.refreshShelves();
        this.refreshWarehouse();
        this.hud.update(s, DAY_SECONDS);
      },
      onOpen: () => this.startDay(),
    });
    this.inMorning = true;
    void this.checkRivals();
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
    this.inMorning = false;
    // Магазин открылся: колокольчик двери и мотив «Магазинчика».
    music.sting('day_open');
    // Купленное с утра ждёт в коробках: камера подлетит к магазину — и его распакуют.
    this.packFresh();
    this.flyIn();
    lighting.lightsOn(this);
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
    // Утром то, что испортится к ночи, само уходит на полку уценки.
    this.sendToBargain();
    try {
      this.openRivalDay();
    } catch (error) {
      reportError(error, 'rivalDay');
    }
    this.timeLeft = DAY_SECONDS;
    this.nextSpawn = 1;
    this.running = true;
    // Друзья откликнулись на «Помоги!» — весь день касса пробивает быстрее (help.ts).
    if (helpScan(this.state) > 1) {
      const { sellerHome } = this.layout;
      this.time.delayedCall(2400, () => this.running && this.popup(sellerHome.x - 20, sellerHome.y - 46, t('popup.helpDay'), '#a8f0c8'));
    }
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
    if (this.state.onboarding && this.state.day <= 2) this.onboardingDay();
  }

  // ---------- Первые минуты новичка (game/onboarding.ts) ----------

  /** Секунды от «Играть» — по ним видно, как быстро новичок дошёл до шага. */
  private sincePlay(): number {
    return this.playAt ? (performance.now() - this.playAt) / 1000 : 0;
  }

  /** Шаг первых минут: отмечается один раз, уходит в аналитику (onb_<шаг>) и на сервер — поскорее. */
  private onbStep(step: OnbStep, day = this.state.day): void {
    if (!this.state.onboarding || onbDone(this.state, step)) return;
    this.state = markOnb(this.state, step);
    track(`onb_${step}`, day, this.sincePlay());
    flushSoon();
  }

  /**
   * Открытие в первые два дня новичка: шаг в аналитику. В новом начале в первый день бабушка
   * встречает у входа, первый покупатель входит почти сразу, а следующий — чуть погодя.
   */
  private onboardingDay(): void {
    this.onbStep(this.state.day === 1 ? 'open' : 'day2');
    if (!playDayOne(this.state)) return;
    if (!onbDone(this.state, 'bye')) this.placeGranny();
    // Игру закрыли после первой продажи: бабушка так и стоит у кассы до вечера (firstday.ts).
    if (onbDone(this.state, 'sale')) return;
    this.nextSpawn = ONB_NEXT_GUEST;
    this.time.delayedCall(ONB_FIRST_AT * 1000, () => this.spawnFirst());
    if (onbDone(this.state, 'hello')) return;
    this.time.delayedCall(ONB_HELLO_AT * 1000, () => {
      if (!this.running || onbDone(this.state, 'sale')) return;
      this.onbStep('hello');
      this.grannySays({ id: 'hello', text: t('onb.hello'), mood: 'happy', hold: 2800 });
      // Пока покупатель выбирает — как тут всё устроено.
      this.time.delayedCall(4800, () => {
        if (this.running && !onbDone(this.state, 'sale') && !this.onbSaid.has('serve')) this.grannySays({ id: 'shop', text: t('onb.shop'), hold: 2600 });
      });
    });
  }

  /** Первый покупатель нового начала: входит от самой двери и берёт то, что по пути к кассе. */
  private spawnFirst(): void {
    if (!this.running || onbDone(this.state, 'sale')) return;
    const { door } = this.layout;
    const till = this.registers[0]?.spot ?? this.layout.counter;
    const want = firstWant(this.state, (i) => this.standOf(i), door, till);
    const look = customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), this.state.day);
    // Уже на дорожке у двери: камера ещё подлетает, а он входит.
    this.spawnCustomer({ look, at: { x: door.x, y: door.y + 24 }, wants: want ? [want] : undefined, first: true });
  }

  /**
   * Бабушка в первый день нового начала: весь день за прилавком, рядом с кассой хозяина (там, где
   * встаёт хозяин при сменщике), — смотрит в зал. Вечером, с итогами дня, уезжает на дачу.
   */
  private placeGranny(): void {
    if (this.granny?.active) return;
    const home = this.grannyHome();
    this.granny = this.makePerson(home.x, home.y, GRANDMA);
    this.grannyBox = this.art(0, 3, 'box').setVisible(false);
    this.granny.add(this.grannyBox);
    this.setFacing(this.granny, 'down');
  }

  /**
   * Что в зале первой недели скрыто (firstday.ts): надписи закрытых пристроек и «Сдаётся» (пока на переезд
   * не хватает). Сменилось — утром зал перестраивается, и они появляются.
   */
  private cleanKey(): string {
    const next = STORE_LEVELS[this.state.level + 1];
    return cleanHall(this.state) ? `clean:${next ? this.state.money >= next.cost : ''}` : '';
  }

  private grannyHome(): { x: number; y: number } {
    return this.reliefSpot();
  }

  /** Бабушка сейчас занята делом (полка, касса). Дело прошлой постройки зала не считается. */
  private grannyBusy(): boolean {
    return this.grannyJob === this.worldGen;
  }

  /** Полка, на которой кончился товар, а на складе он есть (как shelfNeedsRestock); -1 — нет такой. */
  private emptyShelfIndex(): number {
    return this.state.shelves.findIndex(
      (shelf) =>
        !shelf.broken &&
        shelfFree(shelf) > 0 &&
        PRODUCT_IDS.some((id) => canPlace(id, shelf) && (shelf.items[id]?.length ?? 0) === 0 && (this.state.warehouse[id] ?? []).some((u) => !u.pending)),
    );
  }

  /**
   * Первый день новичка, каждый кадр: бабушка раскладывает опустевшую полку (в первый раз — сразу,
   * показывая как; потом — если новичок не нажал её сам) и пробивает покупателя, который заждался
   * у кассы хозяина (после первой продажи: её делает сам игрок). Всё — game/firstday.ts.
   */
  private grannyHelps(): void {
    const granny = this.granny;
    if (!granny?.active || !this.running || this.night || this.grannyBusy() || !grannyStays(this.state)) return;
    const r = this.registers[0];
    const c = r?.customer;
    const after = grannyServesAfter(this.state, this.sellerBusy);
    if (r && c && after !== null && this.operator(0) === 'owner' && !c.serving && !r.scan && this.atSpot(r) && c.waitStart && this.time.now - c.waitStart > after) {
      void this.grannyServe(r, c);
      return;
    }
    const index = this.emptyShelfIndex();
    if (index < 0) {
      this.shelfEmptySince = -1;
      return;
    }
    if (this.shelfEmptySince < 0) this.shelfEmptySince = this.time.now;
    // Хозяин уже несёт товар — бабушка не мешает.
    if (this.sellerBusy) return;
    if (grannyStocksNow(this.state, this.time.now - this.shelfEmptySince, this.onbSaid.has('stockDemo'))) void this.grannyRestock(index);
  }

  /** Бабушка идёт на склад, берёт коробку и раскладывает полку (как грузчик); в первый раз — с присказкой. */
  private async grannyRestock(index: number): Promise<void> {
    const granny = this.granny;
    if (!granny?.active) return;
    const gen = this.worldGen;
    this.grannyJob = gen;
    const ok = () => gen === this.worldGen && granny.active && this.running;
    const done = () => {
      if (this.grannyJob === gen) this.grannyJob = -1;
      this.shelfEmptySince = -1;
    };
    if (!this.onbSaid.has('stockDemo')) {
      this.grannySays({ id: 'stockDemo', text: t('first.stockDemo'), mood: 'happy', hold: 2600 });
      track('first_granny_stock', this.state.day, this.sincePlay());
    }
    const { doorway, pickup } = this.layout.warehouse;
    const route = this.routeTo(index);
    await this.walkVia(granny, [doorway, pickup], GRANNY_SPEED);
    if (!ok()) return done();
    await this.wait(PICKUP_MS);
    if (!ok()) return done();
    this.grannyBox?.setVisible(true);
    await this.walkVia(granny, [doorway, ...route], GRANNY_SPEED);
    if (!ok()) return done();
    await this.wait(PLACE_MS);
    if (!ok()) return done();
    this.grannyBox?.setVisible(false);
    // Пока шла, полку мог разложить сам игрок — тогда коробка просто возвращается на склад.
    if (shelfFree(this.state.shelves[index]) > 0) this.stockShelf(index, granny);
    const home = this.grannyHome();
    await this.walkVia(granny, [...route.slice(0, -1).reverse(), doorway, home], GRANNY_SPEED);
    if (granny.active) this.setFacing(granny, 'down');
    done();
  }

  /** Покупатель заждался у кассы хозяина — бабушка пробивает его сама, не спеша. */
  private async grannyServe(r: Register, c: Customer): Promise<void> {
    const granny = this.granny;
    if (!granny?.active) return;
    const gen = this.worldGen;
    this.grannyJob = gen;
    if (!this.onbSaid.has('help')) this.grannySays({ id: 'help', text: t('first.help'), mood: 'happy', hold: 2200 });
    const timing = withUpgrades(this.state, ownerTiming(this.state));
    await this.scanCustomer(r, c, { item: timing.item * GRANNY_SCAN_SLOW, pay: timing.pay * GRANNY_SCAN_SLOW }, false, granny);
    if (this.grannyJob === gen) this.grannyJob = -1;
  }

  /** Бабушка хвалит новичка за серию покупок (firstday.ts praiseAt) — когда больше никто не говорит. */
  private grannyPraise(): void {
    const granny = this.granny;
    if (!granny?.active || !praiseAt(this.state, this.combo, this.serves.owner) || this.say.visible || this.coach.active) return;
    // Каждый порог — один раз: пока счёт стоит, бабушкины же пробивки похвалу не повторяют.
    const mark = `${this.combo}:${this.serves.owner}`;
    if (mark === this.praisedAt) return;
    this.praisedAt = mark;
    const n = this.praised++ % 3;
    effects.emote(this, granny, 'emo_heart');
    this.setMood(granny, 'happy', 2500);
    this.grannySays({ id: `praise${this.praised}`, text: t(`first.praise.${n}` as TextKey), mood: 'happy', hold: 2200 });
  }

  /** Реплика бабушки облачком под ней — она стоит у входа (её уже нет в зале — у двери). */
  private grannySays(line: SayLine): void {
    this.onbSaid.add(line.id);
    this.say.show(line);
    this.placeSay();
  }

  private placeSay(): void {
    if (!this.say.visible) return;
    const granny = this.granny?.active ? this.granny : null;
    const { door } = this.layout;
    const p = this.screenPoint(granny ? granny.x : door.x, granny ? granny.y + 10 : door.y + 4);
    this.say.place(p.x, p.y, true);
  }

  /** Точка мира → точка на экране в CSS-пикселях (холст вписан в окно и бывает уже его). */
  private screenPoint(x: number, y: number): { x: number; y: number } {
    const cam = this.cameras.main;
    const rect = this.game.canvas.getBoundingClientRect();
    const k = rect.width / this.scale.width;
    return { x: rect.left + (x - cam.worldView.x) * cam.zoom * k, y: rect.top + (y - cam.worldView.y) * cam.zoom * k };
  }

  /**
   * Первый день новичка, каждый кадр: покупатель встал у кассы — шаг «cust». В новом начале
   * бабушка зовёт нажать на кассу, вокруг кассы — мягкое кольцо; облачко держится у бабушки.
   */
  private onboardingTick(): void {
    const r = onbDone(this.state, 'sale') ? undefined : this.ownerRegister();
    const waiting = r && this.atSpot(r) ? r : null;
    if (waiting) this.onbStep('cust');
    if (this.state.onboarding === 'play') {
      // Зал перестроили — бабушка снова у кассы (пока не уехала на дачу).
      if (!onbDone(this.state, 'bye') && !this.granny?.active) this.placeGranny();
      this.grannyHelps();
      if (waiting) {
        if (!this.onbSaid.has('serve')) this.grannySays({ id: 'serve', text: t('onb.serve'), hold: 0 });
        this.ringTill(waiting);
      } else if (!this.registers.some((r, i) => this.operator(i) === 'owner' && r.customer)) {
        // Покупатель не дождался и ушёл — звать к кассе некого: облачко и кольцо гаснут, подсказки
        // внизу возвращаются, а к следующему покупателю бабушка позовёт снова.
        if (this.say.line === 'serve') this.say.hide();
        this.onbSaid.delete('serve');
        this.tillRing?.destroy();
        this.tillRing = undefined;
      }
    }
    this.placeSay();
  }

  /** Мягкое золотое кольцо вокруг кассы: «сюда нажать». На слабом телефоне — без пульса. */
  private ringTill(r: Register): void {
    if (this.tillRing?.active) return;
    const ring = this.add.ellipse(r.counter.x, r.counter.y + 2, 30, 14).setStrokeStyle(1.5, 0xfee761, 0.95).setDepth(LIGHT_DEPTH + 19);
    this.tillRing = ring;
    if (!this.lite) this.tweens.add({ targets: ring, scale: 1.25, alpha: 0.35, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** Первая продажа новичка. В новом начале — маленький праздник: печать, фанфары, конфетти, бабушка радуется. */
  private firstSale(total: number): void {
    this.onbStep('sale');
    saveGame(this.state);
    if (this.state.onboarding !== 'play') return;
    this.tillRing?.destroy();
    this.tillRing = undefined;
    sound.fanfare();
    firstSaleStamp(total);
    if (!this.lite) {
      const { counter } = this.layout;
      const confetti = this.add.particles(counter.x, counter.y - 24, 'confetti', {
        speed: { min: 40, max: 120 },
        angle: { min: 200, max: 340 },
        gravityY: 150,
        rotate: { min: 0, max: 360 },
        scale: 1 / ART,
        lifespan: 1500,
        tint: [0xe43b44, 0xfee761, 0x63c74d, 0x0099db, 0xb55088],
        emitting: false,
      });
      confetti.setDepth(LIGHT_DEPTH + 10).explode(36);
      this.time.delayedCall(1700, () => confetti.destroy());
    }
    // Первый день прошёл без продажи — бабушка уже на даче: праздник есть, а её реплики нет.
    if (!playDayOne(this.state)) return;
    const granny = this.granny;
    if (granny?.active) {
      effects.emote(this, granny, 'emo_heart');
      this.setMood(granny, 'happy', 3000);
      if (!this.lite) this.tweens.add({ targets: granny, y: granny.y - 4, duration: 140, yoyo: true, repeat: 1, ease: 'Quad.easeOut' });
    }
    this.grannySays({ id: 'sold', text: t('onb.sold'), mood: 'happy', hold: 2400 });
    this.time.delayedCall(ONB_BYE_AFTER * 1000, () => this.grannyRoad());
  }

  /**
   * После первой продажи бабушка показывает, как пробивать, не дотягиваясь до кассы: касанием улицы
   * внизу (утренняя карточка об этом тогда уже не нужна). Сама остаётся за прилавком до вечера: на дачу
   * уезжает с итогами дня (finishDay), прощание — строчкой в итогах. Таймер, а не wait: переживёт перестройку зала.
   */
  private grannyRoad(): void {
    if (!this.running || !grannyStays(this.state) || this.onbSaid.has('road')) return;
    this.grannySays({ id: 'road', text: t('onb.road'), mood: 'happy', hold: 2800 });
    if (!this.state.seenTips?.includes('ownerTill')) this.state = seeTip(this.state, 'ownerTill');
    this.showStreetTap();
  }

  // ---------- Бабушкино обучение (game/tutorial.ts) ----------

  /**
   * Каждый кадр дня: шаг обучения в зале — светлое окошко и стрелка у кассы с покупателем или у пустой
   * полки, строчка бабушки рядом. Цели нет — ждём (в первый день — сколько надо, иначе TUT_WAIT_MS);
   * цель есть, а её не трогают — через TUT_IGNORE_MS шаг идёт дальше сам: обучение игру не держит.
   * Состояние шага — в сохранении, а цель ищется заново каждый кадр: перестройка зала ему не мешает.
   */
  private tutorialTick(deltaMs: number): void {
    const step = tutAt(this.state, 'hall');
    if (!step || this.night || this.arranging || savingPaused()) {
      this.hallCoachOff();
      return;
    }
    this.coach.onSkip = () => this.skipTutorial();
    this.coach.skipButton(true);
    this.hallCoach = true;
    // В первый день, пока бабушка в зале, она сама говорит облачком (onboardingTick): подсветка — без строчки,
    // а до полок дело дойдёт, когда она попрощается.
    // Полку первой раскладывает бабушка (показывает как, firstday.ts); пока она занята — тоже без подсветки.
    const granny = playDayOne(this.state) && !onbDone(this.state, 'bye');
    if (granny && step === 'restock' && (!this.onbSaid.has('stockDemo') || this.grannyBusy())) {
      this.coach.hide();
      return;
    }
    if (this.tutTracked !== step) {
      this.tutTracked = step;
      this.tutIdleMs = 0;
      this.tutShownMs = 0;
      // В аналитику — один раз на шаг, и после перезапуска тоже (отметка в сохранении).
      const told = tutTell(this.state);
      if (told) {
        track('tut_step', this.state.day, tutIndex(this.state));
        flushSoon();
        this.state = told;
      }
    }
    const spot = this.tutWorldSpot(step);
    const ms = deltaMs * this.speed;
    if (spot) this.tutShownMs += ms;
    // Хозяин уже несёт товар или пробивает — это не «цели нет».
    else if (!this.sellerBusy && !this.ownerScanning()) this.tutIdleMs += ms;
    const patient = tutPatient(this.state, step);
    if ((!patient && this.tutIdleMs > TUT_WAIT_MS) || (!(patient && step === 'serve') && this.tutShownMs > TUT_IGNORE_MS)) {
      track('tut_auto', this.state.day, tutIndex(this.state));
      this.advanceTut(tutNext(this.state));
      return;
    }
    const text = step === 'serve' ? (granny ? '' : t('tut.serve')) : t('tut.restock');
    this.coach.show({ id: `hall:${step}`, text, target: () => this.tutScreenSpot(step), under: () => this.game.canvas });
  }

  /** Цель шага в мире: касса, у которой ждёт покупатель хозяина, или полка, которую пора пополнить. */
  private tutWorldSpot(step: TutStep): { x: number; y: number; w: number; h: number } | null {
    if (step === 'serve') {
      const r = this.ownerRegister();
      return r && this.atSpot(r) ? { x: r.counter.x, y: r.counter.y - 8, w: 30, h: 26 } : null;
    }
    if (step !== 'restock' || this.sellerBusy || this.grannyBusy()) return null;
    // Полка, которую можно пополнить прямо сейчас: товар уже на складе, а не в пути.
    const index = this.shelfViews.findIndex(
      (v, i) => v.needsStock && PRODUCT_IDS.some((id) => canPlace(id, this.state.shelves[i]) && (this.state.warehouse[id] ?? []).some((u) => !u.pending)),
    );
    if (index < 0) return null;
    const at = this.spotOf(index);
    return { x: at.x, y: at.y - 12, w: 30, h: 30 };
  }

  /** То же на экране, CSS-пиксели (камера могла сдвинуться). */
  private tutScreenSpot(step: TutStep): Spot | null {
    if (!this.hallCoach || !this.running) return null;
    const box = this.tutWorldSpot(step);
    if (!box) return null;
    const a = this.screenPoint(box.x - box.w / 2, box.y - box.h / 2);
    const b = this.screenPoint(box.x + box.w / 2, box.y + box.h / 2);
    return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
  }

  /** Игрок сделал то, чего ждал шаг зала. */
  private passTut(step: TutStep): void {
    if (tutStep(this.state) !== step || !this.running) return;
    this.advanceTut(tutPass(this.state, step));
  }

  private advanceTut(next: StoreState): void {
    const was = tutIndex(this.state);
    this.state = next;
    this.tutTracked = null;
    this.coach.hide();
    saveGame(this.state);
    if (!tutStep(next)) {
      track('tut_done', next.day, was);
      flushSoon();
      this.hallCoachOff();
      this.coach.note(t('tut.done'), 4500);
    }
  }

  /** Подсветка зала гаснет (день встал, шаг ушёл в утро или обучение кончилось). */
  private hallCoachOff(): void {
    if (!this.hallCoach) return;
    this.hallCoach = false;
    this.coach.hide();
    this.coach.skipButton(false);
  }

  /** «Пропустить обучение» подтвердили: шаги кончаются, все вкладки утра открыты. */
  private skipTutorial(): void {
    if (!tutStep(this.state)) return;
    track('tut_skip', this.state.day, tutIndex(this.state));
    flushSoon();
    this.state = tutSkip(this.state);
    this.hallCoachOff();
    saveGame(this.state);
  }

  /**
   * Итог первого дня: бабушка в одну строчку объясняет плитки сверху. У новичка нового начала в итогах
   * первого дня бабушка и так прощается своей строчкой (firstday.ts) — второе облачко закрыло бы печать
   * и прощание: шаг идёт без подсветки и ждёт «Следующий день».
   */
  private summaryLesson(firstDay = false): void {
    if (!tutAt(this.state, 'summary')) return;
    const told = tutTell(this.state);
    if (told) {
      track('tut_step', this.state.day, tutIndex(this.state));
      flushSoon();
      this.state = told;
    }
    if (firstDay) return;
    const tiles = () => document.querySelector<HTMLElement>('.ui-sum .ui-sum-tiles');
    this.coach.onSkip = () => this.skipTutorial();
    this.coach.skipButton(true, true);
    this.coach.show({
      id: 'summary',
      text: t('tut.summary'),
      target: () => {
        const node = tiles();
        const r = node?.getBoundingClientRect();
        return r && r.width ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
      },
      under: tiles,
    });
  }

  // ---------- Новинки: распаковка купленного ----------

  /**
   * Что появилось в зале с прошлой постройки. bought — зал перестроили из-за покупки оборудования
   * или украшения: новое запоминаем, при открытии его распакуют. Перестановка, расширение, гости
   * у друга и загрузка сохранения — не покупки: там только запоминаем, что стоит. Картинки новинок
   * берём из последней постройки (старые уничтожены вместе с залом).
   */
  private noteNewProps(bought: boolean): void {
    const now = this.unboxables();
    for (const key of this.freshProps.keys()) this.freshProps.set(key, now.get(key));
    if (bought) for (const [key, img] of now) if (!this.builtProps.has(key)) this.freshProps.set(key, img);
    this.builtProps = new Set(now.keys());
  }

  /** Оборудование и украшения магазина (зал и флигель): «текстура@x,y» → картинка. */
  private unboxables(): Map<string, Phaser.GameObjects.Image> {
    const { w, h } = this.layout;
    const found = new Map<string, Phaser.GameObjects.Image>();
    for (const obj of this.children.list) {
      if (!(obj instanceof Phaser.GameObjects.Image) || !UNBOX.test(obj.texture.key)) continue;
      if (obj.x < -WING_OUTER - 4 || obj.x > w + 4 || obj.y < -20 || obj.y > h + FACADE_H) continue;
      found.set(`${obj.texture.key}@${Math.round(obj.x)},${Math.round(obj.y)}`, obj);
    }
    return found;
  }

  /**
   * Открытие: новинки прячутся вместе со своими мелочами (лопасти, огоньки, экраны), а когда камера
   * подлетит к магазину (flyIn, 1,6 с), их распакуют по одной — сверху вниз по залу.
   */
  private packFresh(): void {
    const fresh = [...this.freshProps.values()].filter((img): img is Phaser.GameObjects.Image => Boolean(img?.active));
    this.freshProps.clear();
    if (!fresh.length) return;
    // Крупное — первым: терминал на новой кассе — её мелочь, а не отдельная новинка в воздухе.
    fresh.sort((a, b) => b.displayWidth * b.displayHeight - a.displayWidth * a.displayHeight);
    const taken = new Set<Phaser.GameObjects.GameObject>();
    const items: Phaser.GameObjects.Image[] = [];
    for (const img of fresh) {
      if (taken.has(img)) continue;
      taken.add(img);
      const kin = this.kinOf(img, taken);
      kin.forEach((o) => taken.add(o.setVisible(false)));
      img.setData('unbox', { kin, sx: img.scaleX, sy: img.scaleY, y: img.y }).setVisible(false);
      items.push(img);
    }
    items.sort((a, b) => a.y - b.y || a.x - b.x);
    // Тень на полу — от того, что уже стоит: новинка в коробке её ещё не отбрасывает.
    if (items.some((img) => castsShadow(img.texture.key)) && this.floor.ready()) this.bakeFloor();
    this.time.delayedCall(1700, () => items.forEach((img, i) => this.time.delayedCall(i * UNBOX_STEP, () => this.unbox(img))));
  }

  /**
   * Мелочи вещи: лопасти вентилятора, огонёк камеры, экран кассы, блик, тень. Стоят на ней (центр —
   * в её рамке), чуть выше по глубине и не огромные (пол и стены не в счёт). Люди и зоны касаний — не мелочи.
   */
  private kinOf(img: Phaser.GameObjects.Image, taken: Set<Phaser.GameObjects.GameObject>): Kin[] {
    const frame = img.getBounds();
    const area = frame.width * frame.height;
    Phaser.Geom.Rectangle.Inflate(frame, 3, 3);
    const kin: Kin[] = [];
    for (const obj of this.children.list) {
      if (taken.has(obj) || obj.type === 'Container' || obj.type === 'Zone' || obj.type === 'ParticleEmitter') continue;
      const o = obj as Kin & Phaser.GameObjects.Components.Depth & Partial<Phaser.GameObjects.Components.GetBounds>;
      // Плитки отделов, отражения и пятна света на полу (глубина до 0,62) — пол, а не мелочи вещи.
      if (!o.visible || typeof o.getBounds !== 'function' || o.depth <= 0.62 || o.depth < img.depth - 1.5 || o.depth > img.depth + 3) continue;
      const box = o.getBounds();
      if (box.width * box.height <= area * 6 && frame.contains(box.centerX, box.centerY)) kin.push(o);
    }
    return kin;
  }

  /**
   * Новинка из коробки: сверху падает картонная коробка, клапаны разлетаются, вещь вырастает из неё
   * в золотом кольце с искрами — и два часа носит флажок «НОВОЕ». На слабом телефоне — только рост и флажок.
   */
  private unbox(img: Phaser.GameObjects.Image): void {
    // Зал успели перестроить — картинка уничтожена вместе со старым залом, новая стоит как обычно.
    if (!img.active) return;
    const saved = img.getData('unbox') as { kin: Kin[]; sx: number; sy: number; y: number } | undefined;
    if (!saved) return;
    img.setData('unbox', undefined);
    const { kin, sx, sy, y } = saved;
    const fullH = img.displayHeight;
    const bottom = y + fullH * (1 - img.originY);
    const midY = bottom - fullH / 2;
    // Вещь растёт снизу вверх — низ стоит на месте, как будто поднимается из коробки.
    const grow = () => {
      if (!img.active) return;
      img.setVisible(true).setScale(sx * 0.2, sy * 0.2).setY(bottom - fullH * 0.2 * (1 - img.originY));
      // Пока растёт, пружинка от касания (касса) не трогает её: иначе запомнила бы недоросший размер.
      img.setData({ sqX: undefined, sqY: undefined, sqPy: undefined, growing: true });
      this.tweens.add({
        targets: img,
        scaleX: sx,
        scaleY: sy,
        y,
        duration: 460,
        ease: 'Back.easeOut',
        easeParams: [2.2],
        onComplete: () => {
          for (const o of kin) if (o.active) o.setVisible(true);
          img.setData('growing', false).setScale(sx, sy).setY(y);
          motion.squash(this, img, 1.08, 0.9, 110);
          this.newTag(img);
          // Вещь встала — теперь и тень от неё на полу.
          if (castsShadow(img.texture.key)) this.bakeFloorSoon();
        },
      });
    };
    if (this.lite) {
      if (!sound.unbox(img.x)) sound.pop(2, img.x);
      grow();
      return;
    }
    // Коробка по размеру вещи: падает, приседает, клапаны крышки разлетаются, сама она сплющивается.
    // Стоит на полу там же, где низ вещи: полки впереди её закрывают, позади — нет.
    const s = Phaser.Math.Clamp((img.displayWidth / 14) * 1.1, 0.75, 1.9);
    const depth = Math.max(img.depth, bottom) + 4;
    const flaps = [-1, 1].map((side) => this.art(side * 3.5, -9.5, 'unbox_flap').setFlipX(side > 0));
    const box = this.add.container(img.x, bottom - 30, [this.art(0, 0, 'unbox').setOrigin(0.5, 1), ...flaps]).setScale(s).setAngle(8).setDepth(depth);
    // Тень растёт под падающей коробкой — только на полу (у вещей на стене её нет).
    const shadow = bottom > this.layout.wallH ? this.art(img.x, bottom, 'shadow').setScale((0.4 * s) / ART).setAlpha(0).setDepth(bottom - 1) : undefined;
    if (shadow) this.tweens.add({ targets: shadow, alpha: 0.5, scale: (0.9 * s) / ART, duration: 300, ease: 'Quad.easeIn' });
    // Скотч рвут, пока коробка приседает, — клапаны хлопают, когда разлетаются (sound.unbox).
    let ripped = false;
    // Всё по цепочке твинов (а не таймером): клапаны не откроются, пока коробка не долетела.
    const open = () => {
      if (!box.active) return;
      if (!ripped) sound.pop(3, img.x);
      flaps.forEach((flap, i) => {
        const side = i ? 1 : -1;
        this.tweens.add({ targets: flap, x: side * 15, y: -26, angle: side * 200, alpha: 0, duration: 480, ease: 'Quad.easeOut' });
      });
      this.tweens.add({ targets: box, scaleY: s * 0.15, alpha: 0, delay: 120, duration: 260, ease: 'Quad.easeIn', onComplete: () => box.destroy() });
      if (shadow) this.tweens.add({ targets: shadow, alpha: 0, delay: 120, duration: 260, onComplete: () => shadow.destroy() });
      grow();
      this.unboxShine(img.x, midY, Math.max((img.displayWidth + fullH) / 2, 10));
    };
    this.tweens.add({
      targets: box,
      y: bottom,
      angle: 0,
      duration: 300,
      ease: 'Quad.easeIn',
      onComplete: () => {
        sound.boxLand(img.x);
        ripped = sound.unbox(img.x, 0.06);
        effects.puff(this, img.x - 7 * s, bottom);
        effects.puff(this, img.x + 7 * s, bottom);
        this.tweens.add({ targets: box, scaleX: s * 1.18, scaleY: s * 0.8, duration: 90, yoyo: true, completeDelay: 80, ease: 'Quad.easeOut', onComplete: open });
      },
    });
  }

  /** Золотое кольцо, мягкая вспышка и искры вокруг распакованной вещи. */
  private unboxShine(x: number, y: number, size: number): void {
    // Первая распакованная вещь — заставка «покупка» (коробка и колокольчик), следующие — звон медали.
    if (!music.sting('purchase', 4)) sound.medal();
    const ring = this.add.circle(x, y, size / 2).setStrokeStyle(1.5, 0xfee761, 1).setDepth(LIGHT_DEPTH + 12).setScale(0.5);
    this.tweens.add({ targets: ring, scale: 1.6, alpha: 0, duration: 560, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    const flash = this.art(x, y, 'glow').setDisplaySize(size * 1.6, size * 1.6).setTint(0xfee761).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(LIGHT_DEPTH + 11);
    this.tweens.add({ targets: flash, alpha: 0.6, duration: 160, yoyo: true, hold: 120, onComplete: () => flash.destroy() });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.3, 0.3);
      const r = size / 2 + Phaser.Math.Between(5, 10);
      const spark = this.art(x, y, 'spark').setTint(0xfee761).setScale(0.3 / ART).setBlendMode(Phaser.BlendModes.ADD).setDepth(LIGHT_DEPTH + 12);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(a) * r,
        y: y + Math.sin(a) * r * 0.8,
        scale: 0.9 / ART,
        angle: 120,
        alpha: { from: 1, to: 0 },
        delay: i * 25,
        duration: 560,
        ease: 'Quad.easeOut',
        onComplete: () => spark.destroy(),
      });
    }
  }

  /**
   * Красный флажок «НОВОЕ» воткнут в новинку сверху: выскакивает, полощется на ветру и через два часа
   * по часам зала прячется. У правой стены полотнище смотрит влево, чтобы не вылезать за магазин.
   */
  private newTag(img: Phaser.GameObjects.Image): void {
    if (!img.active) return;
    const top = img.y - img.displayHeight * img.originY;
    const left = img.x - img.displayWidth * 0.2 + 25 > this.layout.w + WALL;
    const x = img.x + (left ? 1 : -1) * img.displayWidth * 0.2;
    // Древко — в 1,5 точки от края картинки 48×18 (24×9 в мире), надпись — по центру полотнища.
    const flag = this.art(0, 0, 'tag_new').setOrigin(left ? 1 - 1.5 / 48 : 1.5 / 48, 1).setFlipX(left);
    const label = this.add
      .text((left ? -1 : 1) * 10.25, -5.25, t('store.newTag'), { fontFamily: UI_FONT, fontSize: '4.5px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5)
      .setResolution(this.textRes(8));
    const tag = this.add.container(x, top + 2, [flag, label]).setDepth(990).setScale(0);
    this.tweens.add({ targets: tag, scale: 1, duration: 260, ease: 'Back.easeOut', easeParams: [2.5] });
    if (!this.lite) {
      // Полощется: чуть качается на древке и морщится по ширине.
      tag.setAngle(left ? 3 : -3);
      this.tweens.add({ targets: tag, angle: left ? -3 : 3, delay: 260, duration: 720, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: flag, scaleX: 0.93 / ART, delay: 260, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.time.delayedCall(NEW_TAG_MS, () => {
      if (!tag.active) return;
      this.tweens.killTweensOf([tag, flag]);
      this.tweens.add({ targets: tag, scale: 0, alpha: 0, duration: 220, ease: 'Back.easeIn', onComplete: () => tag.destroy() });
    });
  }

  /** Утренние дела перед открытием: персонал, события дня, гости сюжета. */
  private prepareDay(): void {
    this.stats = emptyDayStats();
    this.serves = { owner: 0, street: 0 };
    this.recordCheered = false;
    for (const r of this.registers) {
      r.scan = null;
      r.customer = null;
    }
    this.night = false;
    this.nightAsked = false;
    this.aromaUntil = 0;
    this.wholesaleBaked = 0;
    this.parcels = [];
    this.packRequested = false;
    this.resetOven();
    this.inspector = this.state.plan?.inspection ? 'pending' : 'none';
    this.jury = juryDay(this.state) ? 'pending' : 'none';
    this.sonya = sonyaVisits(this.state) ? 'pending' : 'none';
    // Праздничный гость — раз за настоящий день, сколько игровых дней ни сыграй. В первый день
    // (бабушка показывает магазин) не заходит: новичку и так есть на что смотреть.
    const today = todayLocal();
    const guest = this.state.day > 1 ? guestDue(this.state, activeEvent(liveEvents(), today), today) : null;
    this.liveGuest = guest ? { who: guest, phase: 'pending', date: today } : null;
    this.inspection = null;
    this.rushAnnounced = false;
    this.helpUntil = 0;
    // После перезапуска посреди дня оплаченное уже празднование не повторяет.
    this.questsSeen = (this.state.plan?.day === this.state.day ? this.state.plan.quests ?? [] : []).filter((q) => q.paid).length;
    // Активные моменты дня: расписание по секундам дня (game/moments.ts).
    this.moments.start(momentsFor(this.state, Math.random));
    this.valyaCame = false;
    this.syncStaff();
    // Повар на смене — кухня сама закупает у поставщиков продукты на день (из кассы; видно утром у кухни и в итогах).
    const pantry = stockKitchen(this.state);
    if (pantry.spent) {
      this.state = pantry.state;
      this.stats.kitchenSpent = pantry.spent;
      const crate = this.kitchenView?.crate;
      if (crate) this.time.delayedCall(900, () => crate.active && this.popup(crate.x, crate.y - 12, t('popup.kitchenBought', { n: pantry.spent }), '#fff3b0'));
    }
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
    decorations.startStall(this);
    this.setSpeed(1);
    this.scheduleOrder();
    // Вечером мусор выносят — утром ведро пустое.
    this.binFill = 0;
    this.binFullFor = 0;
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
    // Мини-события (свет, труба, голубь, курьер, мышь): почти каждый день, по очереди (live.ts).
    // Два за день — первое до обеда, второе ближе к вечеру, чтобы не наложились.
    const live = liveEventsFor(this.state, Math.random);
    this.state = live.state;
    live.kinds.forEach((kind, i) => {
      const [from, to] = live.kinds.length > 1 ? LIVE_WINDOWS[i] : LIVE_WINDOW;
      this.time.delayedCall(Phaser.Math.FloatBetween(from, to) * DAY_SECONDS * 1000, () => this.tryLiveEvent(kind));
    });
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
    for (const obj of this.bigObjs) discard(obj);
    // Мороз красил деревья в иней — возвращаем цвет по погоде.
    if (this.bigObjs.length) for (const g of this.greenery) g.setTint(this.weather === 'leaves' ? 0xffb868 : 0xffffff);
    this.bigObjs = [];
    if (this.time.paused) this.time.paused = false;
    if (this.powerCut) {
      this.powerCut = false;
      this.updateLighting();
    }
    music.setParade(null);
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
      // Оркестр идёт по улице весь день: самба, марш или бодрые хиты марафона — вместо своей музыки и радио.
      music.setParade(id === 'carnival' ? 'samba' : id === 'marathon' ? 'hits' : 'march');
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
      // Хозяин бросает дело: его шаг гасится без onStop, и само дело уже не кончится — без этого он
      // так и числился бы занятым, а за его кассой до конца дня стоял бы сменщик.
      if (this.sellerBusy) this.dropChore();
      this.sellerBusy = false;
      hostages.push(this.seller);
      hostages.forEach((p, i) => {
        this.stopMop(p);
        this.haltWalk(p);
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
      // Вместо тряски — дым от светошумовой: у двери расползается облако.
      this.smokeCloud(door.x, door.y + 2);
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
    // Шаг считается по пройденному пути: трусцой бегут мелко и часто, иначе ноги мелькали бы вдвое реже.
    if (id === 'marathon') this.strideOf(person).stride = 0.5;
    // Марафонцы бегут трусцой (ноги часто, с подскоком), шествие идёт мерным шагом.
    person.setData('pace', id === 'marathon' ? RUN_PACE : 16);
    keep(this.tweens.add({ targets: person, x: toX, duration: ((toX - x) / (id === 'marathon' ? 34 : 16)) * 1000, onComplete: () => person.destroy() }));
    // Танцоры подпрыгивают в такт.
    if (id === 'carnival') keep(this.tweens.add({ targets: person, y: y - 1.5, duration: 260, yoyo: true, repeat: -1, delay: i * 90 }));
  }

  /**
   * Подземный толчок: экран не трясётся — дрожит сам магазин. По полкам слева направо бежит дрожь,
   * разбитый товар падает с полки на пол, с потолка сыплется пыль, подвесные лампы качаются.
   */
  private tremor(): void {
    sound.rumble();
    haptic.error();
    const before = this.state.shelves;
    const { state, broken } = quakeBreak(this.state, Math.random);
    this.state = state;
    this.stats.spoiled += broken;
    // Прошлый толчок ещё не долетел до дальних полок — роняем его остатки сейчас.
    this.quakeFlush?.();
    // Что упадёт — запоминаем по картинкам сейчас: они ещё показывают полки до толчка.
    const falls = this.shelfViews.map((view, i) => this.brokenOnShelf(view, before[i], state.shelves[i]));
    this.rekeyAfterQuake(before, state.shelves);
    // Осколки — не больше чем у ~20 штук: в большом магазине разбивается и по 40.
    const every = Math.max(1, Math.ceil(falls.flat().length / QUAKE_SHATTER_MAX));
    let n = 0;
    // Разбитая штука прячется, вместо неё падает копия. Список опустошается: каждая падает один раз.
    const fallAll = (view: ShelfView, list: QuakeFall[]) => {
      for (const fall of list.splice(0)) {
        if (!fall.img.active) continue;
        fall.img.setVisible(false);
        this.dropItem(view, fall, n++ % every === 0);
      }
    };
    // Покупатель взял товар или продавец выложил до прихода волны — полки перерисуют: роняем всё сразу.
    const flush = () => {
      if (this.quakeFlush === flush) this.quakeFlush = undefined;
      falls.forEach((list, i) => this.shelfViews[i] && fallAll(this.shelfViews[i], list));
    };
    this.quakeFlush = flush;
    const end = motion.quakeWave(this, (view, i) => fallAll(view, falls[i] ?? []));
    // Волна прошла, осколки улеглись — уцелевший товар съезжает в дыры, таблички «пусто» обновляются.
    this.time.delayedCall(end + QUAKE_SETTLE_MS, () => {
      if (this.quakeFlush === flush) this.quakeFlush = undefined;
      this.refreshShelves();
    });
    if (!this.lite) {
      this.ceilingDust();
      this.swingLamps();
    }
    const { w, h } = this.layout;
    this.popup(w / 2, h / 2 - 10, t('popup.quake', { n: broken }), '#ffb0a0');
  }

  /**
   * Уцелевшие штуки получают метку своего нового места в товаре (как в refreshShelves): тогда при
   * перерисовке они съезжают в дыры от разбитого, а не появляется «новый» товар на месте разбитого.
   */
  private rekeyAfterQuake(before: StoreState['shelves'], after: StoreState['shelves']): void {
    this.shelfViews.forEach((view, i) => {
      let n = 0;
      for (const id of PRODUCT_IDS) {
        const kept = after[i]?.items[id] ?? [];
        for (const unit of before[i]?.items[id] ?? []) {
          const k = kept.indexOf(unit);
          view.items[n++]?.setData('stock', k >= 0 ? `${id}:${k}` : null);
        }
      }
    });
  }

  /** Какие картинки на полке показывают товар, который толчок разбил (сравнение полки до и после). */
  private brokenOnShelf(view: ShelfView, before?: StoreState['shelves'][number], after?: StoreState['shelves'][number]): QuakeFall[] {
    if (!before || !after) return [];
    // Порядок — как в refreshShelves: картинка n показывает n-ю штуку по списку товаров.
    const units = PRODUCT_IDS.flatMap((id) => before.items[id] ?? []);
    const kept = new Set(PRODUCT_IDS.flatMap((id) => after.items[id] ?? []));
    const falls: QuakeFall[] = [];
    units.forEach((unit, n) => {
      const img = view.items[n];
      if (kept.has(unit) || !img?.visible) return;
      falls.push({ img, key: img.texture.key, x: img.x, y: img.y, scale: img.scaleX, tint: img.tintTopLeft });
    });
    return falls;
  }

  /**
   * Штука срывается с полки: подскок, дуга с кувырком на пол перед полкой, там — облачко пыли
   * и осколки цвета самого товара; разбитое тускнеет и исчезает.
   */
  private dropItem(view: ShelfView, fall: QuakeFall, shards: boolean): void {
    const side = view.meter ? slotSide(this.layout, view.at) : null;
    const dir = side === 'right' ? -1 : side === 'left' ? 1 : Phaser.Math.RND.sign();
    // С боковой полки — в проход рядом с ней, с обычной — на пол перед полкой.
    const to = side
      ? { x: view.at.x + dir * Phaser.Math.Between(11, 16), y: fall.y + Phaser.Math.Between(2, 6) }
      : { x: fall.x + dir * Phaser.Math.Between(2, 7), y: view.at.y + Phaser.Math.Between(17, 22) };
    // Летит перед полкой: с боковой — поверх её торца, а не за ним.
    const piece = this.add.image(fall.x, fall.y, fall.key).setScale(fall.scale).setTint(fall.tint).setDepth(Math.max(to.y, view.at.y + 20) + 2);
    const spin = dir * Phaser.Math.Between(100, 200);
    const hop = Phaser.Math.Between(4, 7);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      delay: Phaser.Math.Between(0, 140),
      duration: Phaser.Math.Between(340, 420),
      onUpdate: (tween) => {
        const k = tween.getValue() ?? 0;
        // Сначала вверх с полки, потом всё быстрее вниз — как брошенное.
        piece.setPosition(fall.x + (to.x - fall.x) * k, fall.y + (to.y - fall.y) * k * k - hop * Math.sin(k * Math.PI));
        piece.setAngle(spin * k);
      },
      onComplete: () => {
        if (!piece.active) return;
        piece.setPosition(to.x, to.y).setTint(0xc8b4a8);
        // Удар о пол: штука сминается (но узнаётся), тускнеет и пропадает.
        this.tweens.add({ targets: piece, scaleY: fall.scale * 0.7, scaleX: fall.scale * 1.15, duration: 70, ease: 'Quad.easeOut' });
        this.tweens.add({ targets: piece, alpha: 0, delay: 650, duration: 450, onComplete: () => piece.destroy() });
        if (shards && !this.lite) this.shatter(to.x, to.y, fall.key);
      },
    });
  }

  /** Осколки и пыль от разбитой штуки: облачко и кусочки её цвета разлетаются по полу. */
  private shatter(x: number, y: number, key: string): void {
    const dust = this.art(x, y - 1, 'puff').setTint(QUAKE_DUST).setScale(0.6 / ART).setAlpha(0.9).setDepth(y + 3);
    this.tweens.add({ targets: dust, y: y - 6, scale: 1.1 / ART, alpha: 0, duration: 600, ease: 'Quad.easeOut', onComplete: () => dust.destroy() });
    // Цвет осколков — с самой картинки товара (середина и чуть ниже), иначе светлое стекло. Один раз на картинку.
    let colors = this.shardColors.get(key);
    if (!colors) {
      const frame = this.textures.getFrame(key);
      const colorAt = (fy: number) => {
        const c = frame ? this.textures.getPixel(Math.floor(frame.width / 2), Math.floor(frame.height * fy), key) : null;
        return c && c.alpha > 0 ? c.color : 0xe8f4ff;
      };
      colors = [colorAt(0.5), colorAt(0.7), 0xffffff];
      this.shardColors.set(key, colors);
    }
    for (let i = 0; i < 4; i++) {
      const bit = this.add.rectangle(x, y, i % 2 ? 1 : 1.5, 1, colors[i % colors.length]).setDepth(y + 3);
      const dx = Phaser.Math.Between(-9, 9);
      this.tweens.add({ targets: bit, x: x + dx, angle: dx * 20, duration: 320, ease: 'Quad.easeOut' });
      this.tweens.chain({
        targets: bit,
        tweens: [
          { y: y - Phaser.Math.Between(2, 5), duration: 140, ease: 'Quad.easeOut' },
          { y: y + Phaser.Math.Between(0, 3), duration: 180, ease: 'Quad.easeIn' },
          { alpha: 0, delay: 500, duration: 400, onComplete: () => bit.destroy() },
        ],
      });
    }
  }

  /** С потолка от толчка сыплется пыль: комки штукатурки и крошки вдоль задней стены, крошки над залом — вслед за волной. */
  private ceilingDust(): void {
    const { w, h, wallH } = this.layout;
    // Пыль сыплется перед полками у задней стены, а не за ними.
    const front = wallH + 24;
    for (let x = 5; x < w - 3; x += Phaser.Math.Between(8, 13)) {
      const delay = x * QUAKE_WAVE_MS + Phaser.Math.Between(0, 150);
      // Комок у самого потолка: срывается, раздувается и тает, опускаясь.
      const size = Phaser.Math.FloatBetween(0.6, 1);
      const clump = this.art(x, 2, 'puff').setTint(QUAKE_DUST).setScale((0.5 * size) / ART).setFlipX(Math.random() < 0.5).setAlpha(0).setDepth(front);
      this.tweens.chain({
        targets: clump,
        tweens: [
          { alpha: 0.95, scale: (0.8 * size) / ART, delay, duration: 120, ease: 'Quad.easeOut' },
          { alpha: 0, y: Phaser.Math.Between(8, 12), scale: (1.2 * size) / ART, duration: 900, ease: 'Sine.easeOut', onComplete: () => clump.destroy() },
        ],
      });
      // Крошки струйкой вниз, до пола перед полками.
      for (let i = 0; i < 3; i++) {
        const size = i % 2 ? 1 : 1.5;
        const speck = this.add.rectangle(x + Phaser.Math.FloatBetween(-2.5, 2.5), 3, size, size, i % 2 ? QUAKE_DUST : QUAKE_GRIT).setAlpha(0).setDepth(front);
        this.tweens.chain({
          targets: speck,
          tweens: [
            { alpha: 1, delay: delay + 40 + i * 90, duration: 60 },
            { y: wallH + Phaser.Math.Between(-8, 10), x: speck.x + Phaser.Math.FloatBetween(-1.5, 1.5), duration: Phaser.Math.Between(600, 850), ease: 'Quad.easeIn' },
            { alpha: 0, duration: 250, onComplete: () => speck.destroy() },
          ],
        });
      }
    }
    // Над залом сверху, из-под потолка, падают редкие крошки.
    for (let i = 0; i < 22; i++) {
      const x = Phaser.Math.Between(6, w - 6);
      const y = Phaser.Math.Between(wallH + 4, h - 30);
      const mote = this.add.rectangle(x, y, 1, 1, i % 3 ? QUAKE_GRIT : QUAKE_DUST).setAlpha(0).setDepth(LIGHT_DEPTH - 2);
      this.tweens.chain({
        targets: mote,
        tweens: [
          { alpha: 0.9, delay: x * QUAKE_WAVE_MS + Phaser.Math.Between(0, 400), duration: 120 },
          { y: y + Phaser.Math.Between(14, 22), x: x + Phaser.Math.FloatBetween(-2, 2), duration: Phaser.Math.Between(700, 1000), ease: 'Quad.easeIn' },
          { alpha: 0, duration: 300, onComplete: () => mote.destroy() },
        ],
      });
    }
  }

  /** Толчок раскачивает подвесные лампы, а пятна света от потолочных ламп ходят по полу. */
  private swingLamps(): void {
    for (const { lamp, bulb } of this.hangingLamps) {
      if (!lamp.active) continue;
      // Свет висит под лампой: при качании он описывает дугу вокруг точки подвеса.
      const pivot = { x: lamp.x, y: lamp.y };
      const arm = { x: bulb.x - pivot.x, y: bulb.y - pivot.y };
      const swing = Phaser.Math.FloatBetween(9, 13) * Phaser.Math.RND.sign();
      this.tweens.addCounter({
        from: 0,
        to: 1,
        delay: pivot.x * QUAKE_WAVE_MS,
        duration: 2600,
        onUpdate: (tween) => {
          const k = tween.getValue() ?? 0;
          const a = Phaser.Math.DegToRad(swing * Math.sin(k * Math.PI * 7) * (1 - k) ** 1.5);
          lamp.setRotation(a);
          bulb.setPosition(pivot.x + arm.x * Math.cos(a) - arm.y * Math.sin(a), pivot.y + arm.x * Math.sin(a) + arm.y * Math.cos(a));
        },
        onComplete: () => {
          lamp.setRotation(0);
          bulb.setPosition(pivot.x + arm.x, pivot.y + arm.y);
        },
      });
    }
    for (const { img } of this.lampPools) {
      const x = img.x;
      const sway = Phaser.Math.FloatBetween(2.5, 4) * Phaser.Math.RND.sign();
      this.tweens.addCounter({
        from: 0,
        to: 1,
        delay: x * QUAKE_WAVE_MS,
        duration: 2400,
        onUpdate: (tween) => {
          const k = tween.getValue() ?? 0;
          img.x = x + sway * Math.sin(k * Math.PI * 6) * (1 - k);
        },
        onComplete: () => (img.x = x),
      });
    }
  }

  /** Дым после штурма: от двери в обе стороны расползается серое облако и медленно тает. */
  private smokeCloud(x: number, y: number): void {
    const n = this.lite ? 6 : 16;
    for (let i = 0; i < n; i++) {
      const dir = i % 2 ? 1 : -1;
      const reach = Phaser.Math.FloatBetween(0.1, 1);
      const blob = this.art(x + Phaser.Math.Between(-4, 4), y + Phaser.Math.Between(-3, 3), 'glow')
        .setScale(0.15)
        .setTint(Phaser.Utils.Array.GetRandom([0xa8acb8, 0xc4c6ce, 0x8e92a0]))
        .setAlpha(0)
        .setDepth(LIGHT_DEPTH - 3);
      // Клубы расходятся вдоль фасада шире, чем вглубь, растут и поднимаются.
      this.tweens.add({
        targets: blob,
        x: x + dir * reach * 58 + Phaser.Math.Between(-5, 5),
        y: y + Phaser.Math.Between(-32, 16),
        scale: Phaser.Math.FloatBetween(0.55, 0.85),
        duration: Phaser.Math.Between(2600, 3400),
        ease: 'Cubic.easeOut',
      });
      this.tweens.chain({
        targets: blob,
        tweens: [
          { alpha: Phaser.Math.FloatBetween(0.7, 0.85), delay: i * 25, duration: 180 },
          { alpha: 0, delay: Phaser.Math.Between(1200, 2000), duration: Phaser.Math.Between(2200, 3000), ease: 'Sine.easeIn', onComplete: () => blob.destroy() },
        ],
      });
    }
    if (this.lite) return;
    // Поверх мягких клубов — пиксельные облачка: дым читается как дым, а не как туман.
    for (let i = 0; i < 14; i++) {
      const dir = i % 2 ? 1 : -1;
      // Часть клубов вываливается наружу, на тротуар.
      const clump = this.art(x + dir * Phaser.Math.Between(2, 12), y + Phaser.Math.Between(-8, 10), 'puff')
        .setTint(Phaser.Utils.Array.GetRandom([0xb0b4bc, 0xd0d2d8]))
        .setFlipX(Math.random() < 0.5)
        .setAlpha(0)
        .setDepth(LIGHT_DEPTH - 2);
      this.tweens.add({ targets: clump, x: clump.x + dir * Phaser.Math.Between(12, 50), y: clump.y - Phaser.Math.Between(6, 26), scale: Phaser.Math.FloatBetween(1.8, 2.8) / ART, duration: 2800, ease: 'Cubic.easeOut' });
      this.tweens.chain({
        targets: clump,
        tweens: [
          { alpha: 0.95, delay: 80 + i * 50, duration: 160 },
          { alpha: 0, delay: Phaser.Math.Between(800, 1400), duration: 1800, onComplete: () => clump.destroy() },
        ],
      });
    }
  }

  private finishDay(): void {
    this.moments.stop();
    this.dayOpen = false;
    // Захват не успел закончиться (день досрочно закрыт) — персонал возвращается к работе.
    if (this.siege) {
      this.siege = false;
      this.syncStaff();
    }
    this.running = false;
    motion.straightenPeople(this);
    this.clearBigDay();
    this.night = false;
    this.setSpeed(1);
    this.stallTimer?.remove();
    this.stallTimer = undefined;
    // Заказы на дом, которые не успели отвезти, курьер развозит после закрытия.
    const delivery = this.closeDelivery();
    // Что повар не успел снять с плиты к закрытию, — в витрину: ночью спишется вместе с остальным (в отчёт).
    this.flushCooking();
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
    // Пол за день: шаги покупателей — в потёртость (видна с утра, швабра и уборщик её стирают).
    this.settleFloorWear();
    // Сосед утром не дождался товара (returns.ts) — заходит к закрытию: есть — забирает, нет — без обид.
    const neighbour = this.state.ret?.order?.day === this.state.day ? collectOrder(this.state) : null;
    if (neighbour) this.state = neighbour.paid ? neighbour.state : dropOrder(neighbour.state);
    if (neighbour) track(neighbour.paid ? 'ret_order_eve' : 'ret_order_miss', this.state.day, neighbour.paid);
    const finishedDay = this.state.day;
    // Сколько гостей сверх обычного привела реклама — строкой в итогах дня.
    this.stats.adGuests = adGuests(this.state, this.stats.served + this.stats.lost);
    const ratingBefore = this.state.rating;
    const rankBefore = rankOf(this.state.totalRevenue);
    // Первый день новичка (firstday.ts): итоги праздничные, рейтинг не падает, бабушка вечером уезжает на дачу.
    const firstDay = gentleDay(this.state);
    const grannyHome = grannyStays(this.state);
    if (grannyHome) this.onbStep('bye');
    const night = nightCycle(this.state, this.stats);
    const { spoiled, bill, shortfall, skimmed, order, quests, weekly, branch } = night;
    const state = firstDay ? { ...night.state, rating: firstDayRating(this.state, ratingBefore, night.state.rating) } : night.state;
    const cafe = this.cafeToday;
    this.cafeToday = null;
    const extra: [string, string][] = [];
    // Новое звание и побитые рекорды — печатями в итогах, а не строкой в «Подробнее».
    const stamps: SummaryStamp[] = [];
    const big = bigDayFor(finishedDay);
    if (big) extra.push([t('bigday.summary'), `${BIG_DAYS[big].icon} ${t(`bigday.${big}.title` as TextKey)}`]);
    if (wedding) extra.push([t('summary.wedding'), t(wedding.complete ? 'summary.weddingFull' : 'summary.weddingPart', { n: wedding.earned })]);
    if (filmed) extra.push(['🎬', t('summary.filming')]);
    if (quests.total) extra.push([t('summary.quests'), t('summary.questsValue', { done: quests.done, total: quests.total, n: quests.earned })]);
    if (this.stats.momentsShown) extra.push([t('summary.moments'), t('summary.momentsValue', { n: this.stats.moments ?? 0, total: this.stats.momentsShown })]);
    if (weekly.completed.length) extra.push([t('summary.weekly'), t('summary.weeklyDone', { n: weekly.completed.length, money: weekly.earned })]);
    // Филиал за дорогой (branch.ts): чистый доход за день одной строкой.
    if (branch) extra.push([t('branch.summary'), t('branch.summaryValue', { n: branch })]);
    const rankAfter = rankOf(state.totalRevenue);
    if (rankAfter > rankBefore) stamps.push({ kind: 'rank', name: rankName(rankAfter, t) });
    if (order) extra.push([t('summary.order'), order.delivered ? t('summary.orderDone', { n: order.earned }) : t('summary.orderFailed')]);
    if (neighbour) {
      const name = t(regularById(neighbour.order.who).nameKey);
      extra.push([t('ret.order.summary'), neighbour.paid ? t('ret.order.summaryDone', { name, pay: neighbour.paid }) : t('ret.order.summaryMissed', { name })]);
    }
    if (delivery) extra.push(delivery);
    if (cafe) {
      const end = cafe.ended === 'done' ? ` · ${t('summary.cafeDone')}` : cafe.ended === 'canceled' ? ` · ${t('summary.cafeCanceled')}` : '';
      extra.push([t('summary.cafe'), `${cafe.delivered ? t('summary.cafePaid', { n: cafe.pay }) : t('summary.cafeMissed')}${end}`]);
    }
    // Кухня: сколько порций продали, на сколько закупила продуктов и сколько списали ночью (строка отчёта дня; кому не хватило — утром у кухни).
    const kitchenDay = kitchenOpen(state) ? state.reports?.at(-1)?.kitchen : undefined;
    if (kitchenDay && (kitchenDay.wanted || kitchenDay.spoiled || kitchenDay.spent)) {
      const parts = [t('summary.kitchenSold', { n: kitchenDay.sold })];
      if (kitchenDay.spent) parts.push(t('summary.kitchenSpent', { n: kitchenDay.spent }));
      if (kitchenDay.spoiled) parts.push(t('summary.kitchenSpoiled', { n: kitchenDay.spoiled }));
      extra.push([t('summary.kitchen'), parts.join(' · ')]);
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
    // Повод вернуться (returns.ts): сосед просит отложить на завтра, письмо придёт на следующий настоящий день.
    this.state = planLetter(planOrder(this.state, Math.random), todayLocal(), Math.random);
    for (const id of best.broken) stamps.push({ kind: 'record', id });
    this.stats.spoiled = spoiled;
    this.stats.skimmed = skimmed;
    // Непроданное с кухни списано — тарелки из витрины убираем.
    this.refreshKitchen();
    if (promoted) this.syncStaff();
    const unlocked = this.checkAchievements(false);
    if (unlocked.length) extra.push([t('ach.summary'), unlocked.map((id) => t(`ach.${id}` as TextKey)).join(', ')]);
    // Новичок доиграл первый день: сколько секунд прошло от «Играть».
    if (finishedDay === 1) this.onbStep('day1', 1);
    // «Приходи завтра»: сцена Сони готова, но сегодня их уже было довольно — намёк в итогах дня.
    const teaser = dramaHeld(this.state, todayLocal()) ? t('drama.teaser') : undefined;
    if (teaser) track('drama_held', finishedDay);
    this.say.hide();
    this.tillRing?.destroy();
    this.tillRing = undefined;
    // Шаги зала, до которых за день не дошло, закрываются вместе с ним; дальше — итог дня.
    this.state = tutDayEnd(this.state);
    // Бабушкин подарок за первый день (ваза на прилавок): карточка — после итогов, в зале — с утра.
    const gifted = firstDayGift(this.state);
    if (gifted) {
      this.state = gifted;
      this.giftRebuild = true;
      track('onb_gift', 1, this.sincePlay());
    }
    this.hallCoachOff();
    saveGame(this.state);
    track('day_end', finishedDay, this.stats.revenue);
    // Вовлечённость: сколько моментов дня поймали из показанных и сколько заданий дня выполнили.
    if (this.stats.momentsShown) {
      track('moments_seen', finishedDay, this.stats.momentsShown);
      track('moments', finishedDay, this.stats.moments ?? 0);
    }
    if (quests.total) track('quests', finishedDay, quests.done);
    // Сколько процентов своих покупателей хозяин пробил касанием улицы, а не кассы.
    if (this.serves.owner) track('serve_street', finishedDay, (100 * Math.min(this.serves.street, this.serves.owner)) / this.serves.owner);
    // Друзья на работе раз в неделю получают свою долю — монеты в своей игре (через «угощение»).
    if (finishedDay % 7 === 0) for (const m of friendsAtWork(state)) void treatFriend(m.friend!.id);
    const fps = fpsSummary(this.fpsSamples);
    if (fps) {
      track('fps', finishedDay, fps.median);
      track('fps_low', finishedDay, fps.low);
      // Уровень графики рядом с FPS: 0 — лёгкая, 1 — обычная, 2 — высокая.
      track('gfx', finishedDay, ['lite', 'normal', 'high'].indexOf(this.gfx));
    }
    this.fpsSamples = [];
    this.fpsSince = 0;
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
      // Первый день кончился раньше, чем бабушка попрощалась (не продали или продали под самое
      // закрытие): она уходит домой, пока на экране итоги, — во второй день в зале её нет.
      if (grannyHome || !onbDone(this.state, 'bye')) this.granny?.destroy();
      // Итоги дня — своя заставка, а с новым званием — фанфара звания (две подряд звучали бы кашей).
      if (!music.sting(stamps.some((s) => s.kind === 'rank') ? 'rank_up' : 'day_close')) sound.fanfare();
      this.hud.showSummary(
        finishedDay,
        this.stats,
        { before: ratingBefore, after: state.rating },
        { bill: bill && billTotal(bill), shortfall, total: state.money, housewarming: Boolean(bill?.housewarming) },
        extra,
        stamps,
        this.state.history,
        lossAdvice(this.stats, this.state),
        reviews,
        () => {
          // Итог дня прочитан — шаг обучения о нём пройден.
          if (tutStep(this.state) === 'summary') {
            this.coach.hide();
            this.coach.skipButton(false);
            this.state = tutPass(this.state, 'summary');
            saveGame(this.state);
          }
          // Первая сессия кончается на подъёме: бабушкин подарок карточкой, потом — ночь.
          if (gifted) firstGiftCard(() => this.nightPass(() => this.showMorning()));
          else this.nightPass(() => this.showMorning());
        },
        (button) => void this.shareDay(button, finishedDay),
        teaser,
        this.state.bankrupt ? undefined : this.tomorrowLines(),
        firstDay,
      );
      this.summaryLesson(firstDay);
    });
  }

  /**
   * «Завтра:» в итогах дня: зацепка (nudge.ts), кто из соседей придёт за отложенным и что пришлёт
   * бабушка, если зайти завтра (серия гостинцев, gift.ts).
   */
  private tomorrowLines(): string[] {
    const lines = [teaserText(tomorrowTeaser(this.state))];
    const order = orderTeaser(this.state);
    if (order) lines.push(teaserText(order));
    const gift = giftTomorrow(this.state, todayLocal());
    if (gift) {
      const treat = t(`gift.treat.${gift.day}` as TextKey);
      const more = (gift.goods ? t('streak.goods') : '') + (gift.rating ? t('streak.star') : '');
      lines.push(gift.day === 1 ? t('streak.restart', { treat, sum: gift.money }) : t('streak.tomorrow', { n: gift.day, treat, sum: gift.money, more }));
    }
    return lines;
  }

  /** Кнопку «Позвать на помощь» можно показать: игра в Telegram с сервером, после обучения, сегодня ещё не звали. */
  private canCallForHelp(): boolean {
    return this.state.day > TUTORIAL_DAYS && !helpAsked(this.state) && socialInfo() !== null;
  }

  /**
   * «Позвать на помощь»: окно «Поделиться» Telegram с карточкой «Помогите!». Отправил (или открылось
   * старое окно со ссылкой) — сегодня больше не зовём; закрыл окно — кнопка остаётся.
   */
  private async callForHelp(): Promise<void> {
    if (this.helpBusy || !this.canCallForHelp()) return;
    this.helpBusy = true;
    haptic.tap();
    // Окно «Поделиться» может висеть, пока день не сменится: просьба — от того дня, когда позвали.
    const day = this.state.day;
    const result = await askForHelp(t('help.share'));
    this.helpBusy = false;
    if (result === 'cancelled' || result === 'failed') return;
    this.state = markHelpAsked(this.state, day);
    track('help_ask', day);
    const { sellerHome } = this.layout;
    if (this.running) this.popup(sellerHome.x - 20, sellerHome.y - 46, t('popup.helpAsked'), '#a8f0c8');
  }

  /** Игру открыли по ссылке «Помоги!» друга: подмога уходит сама, за помощь — монеты. */
  private async sendFriendHelp(): Promise<void> {
    const res = await sendHelp();
    if (!res) return;
    if (!res.ok) {
      // Своя просьба или сервер недоступен — молчим; остальное объясняем, почему подмога не ушла.
      if (res.error === 'expired' || res.error === 'already' || res.error === 'limit' || res.error === 'full')
        toast('assets/ico_handshake.png', t('help.err.title'), t(`help.err.${res.error}` as TextKey));
      return;
    }
    this.state = helpGiven(this.state);
    saveGame(this.state);
    this.hud.update(this.state, this.timeLeft);
    track('help_sent', this.state.day);
    toast('assets/ico_handshake.png', t('help.sent.title'), t('help.sent.text', { name: res.name || t('help.friend'), n: HELP_REWARD }));
  }

  /** Друзья откликнулись на «Помоги!»: монеты за каждого и быстрая касса на день, который сейчас начнётся. */
  private async takeFriendHelp(): Promise<void> {
    const names = await claimHelp();
    if (!names.length) return;
    this.state = takeHelp(this.state, names.length);
    saveGame(this.state);
    this.hud.update(this.state, this.timeLeft);
    track('help_came', this.state.day, names.length);
    const shown = names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3}` : '');
    toast('assets/ico_handshake.png', t('help.came.title'), t('help.came.text', { names: shown, sum: names.length * HELP_THANKS }));
  }

  /** «Поделиться итогами»: карточка в историю Telegram, в окно «Поделиться» или в чат с ботом. */
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
    track('share', day, result === 'failed' || result === 'cancelled' ? 0 : 1);
    if (result === 'chat') toast('assets/ico_phone.png', t('share.chat.title'), t('share.chat.text'));
    if (result === 'failed') toast('assets/ico_phone.png', '📸', t('share.failed'));
  }

  /**
   * Вывеска растёт с магазином: с третьего уровня по краю бегут огоньки, у супермаркета под
   * буквами переливается светодиодная лента.
   */
  private signLights(x: number, y: number, half = 30): void {
    const level = this.state.level;
    if (level < 2) return;
    const bulbs: Phaser.GameObjects.Rectangle[] = [];
    // Вывеска гипермаркета выше и шире: лампочки — по её краю.
    const dy = half > 30 ? 7.5 : 6.5;
    for (let i = 0; i <= (half * 2) / 4; i++) {
      bulbs.push(this.add.rectangle(x - half + i * 4, y - dy, 1.4, 1.4, 0xfee761).setDepth(4));
      bulbs.push(this.add.rectangle(x + half - i * 4, y + dy, 1.4, 1.4, 0xfee761).setDepth(4));
    }
    let step = 0;
    this.worldTimer(160, () => {
      step++;
      bulbs.forEach((b, i) => b.active && b.setFillStyle(Math.floor(i / 2) % 3 === step % 3 ? 0xfff6c8 : 0xb8860b));
    });
    if (level < 4) return;
    const led = this.add.rectangle(x, y + dy + 2, half * 2, 1.6, 0x9cd8ff).setDepth(4);
    this.tweens.addCounter({
      from: 0,
      to: 360,
      duration: 3000,
      repeat: -1,
      onUpdate: (tw) => led.active && led.setFillStyle(Phaser.Display.Color.HSVToRGB(((tw.getValue() ?? 0) % 360) / 360, 0.45, 1).color),
    });
    lighting.nightGlow(this, this.art(x, y + dy + 2.5, 'glow').setDisplaySize(half * 2.7, 12).setTint(0x9cd8ff), 0.5, undefined, { map: { scale: 1.3, gain: 1.2, haze: 0.4 } });
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
    // Небо поверх мира и его карты освещения: умножение на цвет — ночью синее, на рассвете розовое. Окна,
    // лампочки и вывески светятся поверх неба (они выше), луна и звёзды — тоже.
    const sky = keep(this.add.rectangle(v.x - pad, v.y - pad, v.width + 2 * pad, v.height + 2 * pad, 0xffffff).setOrigin(0));
    sky.setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(LIGHT_DEPTH + 0.5);
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
    pets.bobikSit(this, 900);
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
    // Луч фонарика в карте освещения: ходит по тротуару вместе с рукой сторожа — ступеньками по 1/8 радиана
    // (свет мягкий, шагов не видно), а не каждый кадр: карту всю ночь перерисовывали бы непрерывно.
    const torch = this.light.add('light_cone', beam.x, beam.y, 16, 28, 0xfff3c8, 0.7).attach(beam);
    torch.originY = 0;
    torch.sync = () => (torch.rotation = Math.round(beam.rotation * 8) / 8 + Math.atan2(12, 19) - Math.PI / 2);
    this.nightWatch.push(watchman, beam);
  }

  /** Утром роллеты поднимаются. */
  private openShop(): void {
    this.closed = false;
    pets.bobikRest(this);
    this.nightWatch.forEach((o) => o.destroy());
    this.nightWatch = [];
    for (const shutter of this.shutters) {
      this.tweens.add({ targets: shutter, displayHeight: 0.1, duration: 600, ease: 'Quad.easeIn', onComplete: () => shutter.destroy() });
    }
    this.shutters = [];
  }
}
