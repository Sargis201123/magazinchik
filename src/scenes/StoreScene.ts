import Phaser from 'phaser';
import {
  canPlace,
  promoKind,
  SHELF_LEVELS,
  DAY_SECONDS,
  emptyDayStats,
  markdownSurplus,
  markdownExpiring,
  expiringIn,
  SHELF_KINDS,
  newGame,
  PRODUCT_IDS,
  returnToShelf,
  shelfCapacity,
  shelfFree,
  isFixture,
  slotOf,
  STORE_LEVELS,
  HYPER_LEVEL,
  storeLevel,
  unitSalePrice,
  warehouseCapacity,
  type Category,
  type DayStats,
  type ProductId,
  type StaffRole,
  type StoreState,
} from '../game/economy';
import { ensurePlan, spawnIntervalToday } from '../game/day';
import { RUSH_SECONDS, type InspectionResult } from '../game/events';
import { pickWanted, questDone, questProgress, payQuests } from '../game/endless';
import { lastSavedAt, loadGame, saveGame, savingPaused } from '../game/save';
import type { PrankIn } from '../game/rival';
import { awayTrade } from '../game/away';
import { branchAway } from '../game/branch';
import { getLang, t } from '../i18n';
import { sound } from '../platform/sound';
import { music } from '../platform/music';
import type { Rect } from './paths';
import type { Passer } from './stride';
import { ambience, type AmbLife } from '../platform/ambience';
import { setListener } from '../platform/mixer';
import { haptic, telegramUserId, trustedNow } from '../platform/telegram';
import { button, el, openModal, toast, UI_FONT } from '../ui/dom';
import { bigDayNightGuests, CROWD_EXTRA_GUESTS, isCrowdDay, setBigDaySeed, type WeddingOrder } from '../game/bigday';
import type { GiantLook } from '../game/giant';
import { Hud } from '../ui/hud';
import { showTitle } from '../ui/title';
import { weatherFor, type Weather } from '../game/weather';
import { yearTime } from '../game/calendar';
import { liveProgress, unlockAchievements, type AchievementId } from '../game/achievements';
import { announceAchievement } from '../ui/achievements';
import { ETAGS_EVENING, eveningSales, hasUpgrade } from '../game/upgrades';
import { KIOSK_ERROR_SECONDS, KIOSK_PREFER, kioskCount, kioskTier } from '../game/lanes';
import { noteSeen, stashAway } from '../game/returns';
import { activeDecor, decorFromPurchases, grantDecor } from '../game/decor';
import { restorePurchases } from '../platform/stars';
import { liveLook, type GuestId } from '../game/live';
import { liveEvents, loadLiveEvents, todayLocal } from '../platform/live';
import { comebackHooks } from '../game/comeback';
import { socialPing, WELCOME_GIFT } from '../platform/social';
import { HELP_HOLD, HELP_QUEUE } from '../game/help';
import { reportProgress, setProgressSource, track } from '../platform/analytics';
import { pickCohort, startCohort, type Cohort } from '../game/onboarding';
import { SayBubble } from '../ui/onboarding';
import type { TutStep } from '../game/tutorial';
import { Coach } from '../ui/coach';
import { duelInfo, loadMultiplayer } from '../platform/multiplayer';
import { ensureSeason, grantPass } from '../game/pass';
import { grantSupport } from '../game/support';
import { ensureRush } from '../game/rush';
import { kitchenOpen } from '../game/kitchen';
import { BUSKER_GUESTS } from '../game/nightGuests';
import { setErrorContext } from '../platform/errors';
import { blockedZones, canShortenQueue, slotRect, slotSide, standFor, wallSnap, SIDE_X, clampTill, iceboxFits, overlapsRect, propFootprint, propIssues, propPosFor, propRect, savedLayout, slotIssues, slotPosFor, snap, tillZones, vendingFootprint, vendingSide, withTill, type Prop } from './placement';
import {
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
  type Room,
} from './layout';
import { BASE_W, crispZoom } from './pixels';
import { LightMap } from './light';
import { ColorGrade } from './grade';
import { Halo, personGlow } from './halo';
import { FloorShade, furnitureCasters, type WearLayer } from './floor';
import { decodeWear, wearGrid, type WearGrid } from '../game/wear';
import { dayDemand } from '../game/demand';
import { PAIR_CHANCE, shelfLinks, type Link } from '../game/neighbors';
import { BARGAIN_CHANCE, BARGAIN_PER_ROW, bargainCapacity, bargainCount, fillBargain, hasBargain, takeBargain } from '../game/bargain';
import { Rotting } from './rotting';
import type { EduardLook } from '../game/eduard';
import type { CafeDelivery } from '../game/cafe';
import { radioSpeed } from '../game/radio';
import type { LiveKind } from '../game/minievents';
import { noteMoment } from '../game/moments';
import { Moments } from './moments';
import { questRows } from '../ui/today';
import { bargainRows, bargainSprite, binCapacity, binSprite, gearTier, type GearId, registerSprite } from '../game/gear';
import { registerSlots, RELIEF_ROLE, tillRole } from '../game/registers';
import { NIGHT_GUESTS } from '../game/night';
import { quality, type Quality } from '../platform/quality';
import { cleanHall, dreamShelf, grannyStays } from '../game/firstday';
import type { HomeOrder } from '../game/delivery';
import { DeliveryUi } from '../ui/delivery';
import { mainGoal, type HallNudge } from '../game/nudge';
import {
  HUD_TOP,
  ART,
  TUTORIAL_DAYS,
  LOW_STOCK,
  FURNITURE_TOP,
  WALL,
  FACADE_H,
  FACADE_STYLES,
  FLOORS,
  type Popup,
  LIGHT_DEPTH,
  QUAKE_SHAKE_PX,
  ITEM_VARIANTS,
  CUSTOMER_SPEED,
  KIOSK_GLOW,
  KIOSK_ALARM,
  BARGAIN_BOTTOM,
  BARGAIN_BASE,
  BARGAIN_STEP,
  BAG_MS,
  DUMP_MS,
  AUTO_CHECK_SECONDS,
  TOILET_DIRTY,
  SHELF_LOOK,
  DEPT_INLAY_DEPTH,
  FLOOR_SHADE_DEPTH,
  WEAR_SAMPLE_MS,
  ITEM_AREA,
  FLORIST_SPOTS,
  type Look,
  type ParkSpot,
  type ParkingLot,
  type RoadCar,
  ownerLook,
  INSPECTOR_AT,
  SONYA_AT,
  LIVE_GUEST_AT,
  JURY_AT,
  BROKEN_TINT,
  type Customer,
  type Register,
  type Kiosk,
  type Oven,
  type KitchenView,
  type Worker,
  type ShelfView,
  type TakenSpot,
  type NightLight,
  type Lamp,
  type Pigeon,
  type ChoreStep,
  type Parcel,
} from './common';
import * as motion from './motion';
import * as effects from './effects';
import * as pets from './pets';
import * as lighting from './lighting';
import * as weatherFx from './weatherFx';
import * as decorations from './decorations';
import * as deliveries from './deliveries';
import * as food from './food';
import * as streets from './streets';
import * as cars from './cars';
import * as staff from './staff';
import * as shoppers from './shoppers';
import * as persons from './persons';
import * as visitors from './visitors';
import * as liveFx from './liveFx';
import * as nightShift from './nightShift';
import * as morningFlow from './morningFlow';
import * as newcomer from './newcomer';
import * as camera from './camera';

export class StoreScene extends Phaser.Scene {
  state!: StoreState;
  layout!: Layout;
  /** Для какого уровня помещения построен зал (при расширении перестраиваем). */
  builtLevel = -1;
  /** Каким было помещение Эдуарда, когда рисовали улицу. */
  builtEduard: EduardLook | null = null;
  /** Всплывающие надписи на экране: чтобы не налезали друг на друга и склеивались. */
  popups: Popup[] = [];
  /** Кухня во флигеле: плита, стол повара, витрина с тарелками (кухни нет — пусто). */
  kitchenView?: KitchenView;
  /** Полка «Еда» у входа (kitchen.ts): где стоит, картинка и тарелки на ней. */
  foodView?: { at: { x: number; y: number }; img: Phaser.GameObjects.Image; plates: Phaser.GameObjects.Image[] };
  /** В какой день повар уже пожаловался, что не из чего готовить (раз в день, не чаще). */
  cookNoFoodDay = 0;
  /** Чей магазин друга нарисован сбоку (торговая неделя). */
  builtFriend?: string;
  /** Магазин босса района стоит за дорогой (на месте «Гиганта»), а не сбоку. */
  rivalAcross = false;
  /** Каким построен «Гигант» за дорогой (giant.ts): стройка, магазин, закрытый. */
  builtGiant: GiantLook = 'none';
  /** Каким построен свой филиал в здании «Гиганта» (branch.ts); '' — его нет. */
  builtBranch = '';
  /** Какие здания района стояли, когда рисовали улицу (district.ts). */
  builtDistrict = '';
  /** Что из благоустройства района стояло на улице (hood.ts). */
  builtHood = '';
  /** Где на тротуаре за дорогой висят вывески зданий (середины): новые фонари района их обходят. */
  signsAcross: number[] = [];
  /** Снежные покрывала на крышах соседей: видны в снегопад. */
  roofSnow: Phaser.GameObjects.Rectangle[] = [];
  /** Козни конкурента на улице сегодня (tricks.ts): промоутеры, перетяжки, их таймеры. */
  trickObjs: Phaser.GameObjects.GameObject[] = [];
  trickTimers: Phaser.Time.TimerEvent[] = [];
  /** Ночью у входа играет музыкант — ночных гостей больше (nightGuests.ts). */
  busker = false;
  stats: DayStats = emptyDayStats();
  hud!: Hud;
  shelfViews: ShelfView[] = [];
  /** Сколько раз перерисовывали полки: толчок по нему узнаёт, что товар на картинках уже другой. */
  /** Толчок: уронить разбитое, до чего волна ещё не дошла, — сразу, пока полки не перерисовали. */
  quakeFlush?: () => void;
  private boxes: Phaser.GameObjects.Image[] = [];
  shutters: Phaser.GameObjects.Image[] = [];
  arrow?: Phaser.GameObjects.Image;
  /** Новое начало (game/onboarding.ts): облачко бабушки, она сама у входа и кольцо у кассы до первой продажи. */
  readonly say = new SayBubble();
  /** Бабушкино обучение (game/tutorial.ts): подсветка и стрелка у того, что нажать. */
  readonly coach = new Coach();
  /** Подсветку сейчас показывает зал (а не утро или итоги). */
  hallCoach = false;
  /** Какой шаг обучения уже ушёл в аналитику, и сколько он ждёт без цели и с целью (мс дня). */
  tutTracked: TutStep | null = null;
  tutIdleMs = 0;
  tutShownMs = 0;
  granny?: Phaser.GameObjects.Container;
  /** Коробка в руках бабушки (раскладывает полку в первый день, firstday.ts). */
  grannyBox?: Phaser.GameObjects.Image;
  /** Бабушка занята делом (полка, касса) в этой постройке зала: worldGen, при котором дело начато. */
  grannyJob = -1;
  /** С какого момента (time.now) в зале пустует полка, которую есть чем пополнить; -1 — не пустует. */
  shelfEmptySince = -1;
  tillRing?: Phaser.GameObjects.Ellipse;
  /** Когда нажали «Играть» (мс, performance.now): шаги первых минут считаются от него. */
  private playAt = 0;
  /** Какие реплики бабушка уже сказала в этот запуск (убранная касанием не возвращается). */
  readonly onbSaid = new Set<string>();
  /** Сколько раз бабушка уже похвалила в этот запуск (реплики идут по кругу). */
  praised = 0;
  praisedAt = '';
  /** Как построен зал первой недели (firstday.ts cleanHall): поменялось — утром перестроить. */
  builtClean = '';
  /** Бабушка подарила вещь на прилавок — утром зал перестроить, чтобы она появилась. */
  giftRebuild = false;
  /** Палец двигал камеру — это не нажатие. */
  dragged = false;
  /** Сколько звёзд рейтинга уже отпраздновали волной искр (-1 — ещё не знаем). */
  starsCheered = -1;
  /** Рекорд выручки сегодня уже отметили конфетти. */
  recordCheered = false;
  /** Куда камера возвращается после осмотра квартала. */
  home = { x: 0, y: 0 };
  homeTimer?: Phaser.Time.TimerEvent;
  /** Колёсико затихло — масштаб доходит до ровного. */
  wheelTimer?: Phaser.Time.TimerEvent;
  baseZoom = 1;
  /** Щипок двумя пальцами: расстояние и зум в начале. */
  pinch: { dist: number; zoom: number } | null = null;
  /** Все люди на экране: для шагов и дыхания. */
  people = new Set<Phaser.GameObjects.Container>();
  /** Нарисованное один раз в RenderTexture (bakeSpots) и как нарисовать снова после потери WebGL контекста. */
  baked = new Map<Phaser.GameObjects.RenderTexture, () => void>();
  /** Номер постройки мира (buildWorld): дела, начатые в прежнем мире, по нему понимают, что мира уже нет. */
  worldGen = 0;
  /** Повторы вещей мира (worldTimer): останавливаются при перестройке. */
  private worldTimers: Phaser.Time.TimerEvent[] = [];
  /** Чья швабра сейчас звучит (продавца, уборщика) и как её оборвать: дело бросили — стихает и звук. */
  mops = new Map<Phaser.GameObjects.Container, () => void>();
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
  dumpImg?: Phaser.GameObjects.Image;
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
  floor = new FloorShade(this);
  /**
   * Потёртость пола зала (game/wear.ts): клетки 0…1 из сохранения и шаги за сегодня по той же сетке
   * (кто где прошёл — sampleSteps). level — для какого помещения сетка.
   */
  wear: { level: number; grid: WearGrid; cells: Float32Array; steps: Float32Array } | null = null;
  /** Когда уборщик в последний раз натирал потёртый пол (мс времени сцены): не весь день подряд. */
  polishedAt = -Infinity;
  /** Подвесные лампы (декор «Свет») с пятном света под ними: от подземного толчка качаются. */
  hangingLamps: { lamp: Phaser.GameObjects.Image; bulb: Phaser.GameObjects.Image }[] = [];
  /** Цвета осколков разбитого товара по картинке — чтобы не читать пиксели каждый раз. */
  shardColors = new Map<string, number[]>();
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
  doorSign?: Phaser.GameObjects.Image;
  lawns: { x: number; y: number; w: number; h: number }[] = [];
  greenery: Phaser.GameObjects.Image[] = [];
  /** Снимок зала перед закрытием — для карточки итогов дня. */
  dayShot: HTMLImageElement | null = null;
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
  cullables: { obj: Phaser.GameObjects.GameObject & { cameraFilter: number }; box: Phaser.Geom.Rectangle }[] = [];
  /** Мир перестроен — список для отсечения собрать заново (на следующем кадре, когда всё уже на месте). */
  cullDirty = true;
  /** Идёт перестановка полок: камера не ездит, полки — «призраки», которые тянут пальцем. */
  arranging = false;
  /** Парковка за магазином и проезд к ней: места, машины на них и кто сейчас едет (живая днём). */
  parking: ParkingLot | null = null;
  parkingTimer?: Phaser.Time.TimerEvent;
  /** Машины на улице и их полоса: с парковки выезжают в просвет. */
  roadTraffic = new Set<RoadCar>();
  /** Стаи птиц над кварталом (buildAmbient). */
  flockTimer?: Phaser.Time.TimerEvent;
  /** Порывы ветра (windGust): таймер, деревья с кронами и навесы соседей с зонтиками веранды. */
  windTimer?: Phaser.Time.TimerEvent;
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
  builtProps = new Set<string>();
  /** Купленное с утра: при открытии его распакуют из коробки. Ключ — «текстура@x,y», картинка — из последней постройки. */
  freshProps = new Map<string, Phaser.GameObjects.Image | undefined>();
  /** Отложенное запекание пола после распаковки новинок (bakeFloorSoon). */
  private floorBakeTimer?: Phaser.Time.TimerEvent;
  /** Наняли утром: при открытии новенький войдёт с улицы в дверь, а не появится сразу на месте. */
  newHires = new Set<string>();
  /** Новенькие, которые сейчас идут с улицы: перед ними разъезжаются двери. */
  newcomers = new Set<Phaser.GameObjects.Container>();
  /** Где сейчас стоит автомат с напитками (на нём радио). */
  vendingAt = { x: 0, y: 0 };
  /** Уровень графики этого запуска (platform/quality.ts): если игра тормозит, он понижается на время. */
  gfx: Quality = quality();
  /** Лёгкая графика: без виньетки и облаков (холст поменьше — со следующего запуска). */
  lite = this.gfx === 'lite';
  /** Покупатель только что взял товар (tryTake): с каких мест полки — reachShelf пускает его оттуда. */
  takenFrom: TakenSpot[] = [];
  /** Посекундные замеры FPS за день: медиана уходит в аналитику, при тормозах — лёгкая графика. */
  fpsSamples: number[] = [];
  fpsFrames = 0;
  fpsMs = 0;
  /** Сколько посекундных замеров с прошлого понижения графики. */
  fpsSince = 0;
  cullAt = '';
  /** Ночь между днями: какая доля окон в домах уже погасла (0 — все горят). */
  lightsOut = 0;
  /** Стрелки настенных часов: идут по ходу смены с 8:00 до 20:00. */
  clockHands?: Phaser.GameObjects.Graphics;
  /** Неоновая вывеска в зале (декор), если висит, — по x: жужжит. */
  neonDecorX?: number;
  /** Мебель в зале (в координатах центра человека): люди обходят её. */
  obstacles: Rect[] = [];
  /** Люди этого кадра для обхода встречных (passers): считаем раз за кадр, а не на каждого идущего. */
  crowd: { frame: number; list: Passer[] } = { frame: -1, list: [] };
  /** Кассы самообслуживания (сколько куплено) — у правой стены над кассами. */
  kiosks: Kiosk[] = [];
  /** Когда последний раз всплывало «быстрее» над кассой (касания сменщику). */
  lastHurry = 0;
  /** Сменщик дошёл до кассы хозяина и пробивает (новенький — с той минуты, как встал за неё). */
  reliefReady = false;
  /** Мини-событие дня: что сейчас происходит и всё, что его рисует. */
  liveEvent: LiveKind | null = null;
  liveObjs: { destroy: () => void }[] = [];
  blackout = false;
  fuseBox?: Phaser.GameObjects.Image;
  fuseGlow?: Halo;
  /** Утренняя закупка: сколько было на складе в начале утра и сколько коробок ещё ждут доставки. */
  morningStock = 0;
  awaitingBoxes = 0;
  /** Реклама на улице: промоутер с листовками, баннер на фасаде, блогер у входа. */
  adObjs: { destroy: () => void }[] = [];
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
  serves = { owner: 0, street: 0 };
  customers = new Set<Customer>();
  queue: Customer[] = [];
  /** Сколько встало в очередь за всё время: чётный — ровно, нечётный — чуть левее (queueSpot). */
  queueTurn = 0;
  trash = new Set<Phaser.GameObjects.Image>();
  /** Мусор, за которым уже кто-то пошёл. */
  claimedTrash = new Set<Phaser.GameObjects.Image>();
  workers = new Map<StaffRole, Worker>();
  /** Смена номера останавливает циклы работы старых сотрудников. */
  staffGen = 0;
  toiletDirt = 0;
  /** Срочный подвоз: что едет и занят ли фургон. */
  /** auto — подвоз автозаказа (по приезде вычёркивается из autoOrder.today.inbound). */
  urgentOrders: { id: ProductId; qty: number; auto?: boolean }[] = [];
  urgentVanBusy = false;
  /** Через сколько секунд дня автозаказ снова проверит, не кончился ли товар. */
  private autoCheck = 0;
  /** Электронные ценники сегодня уже уценили старое. */
  eveningMarkdown = false;
  private wcStink!: Phaser.GameObjects.Image;
  private wcDoor!: Phaser.GameObjects.Image;
  private wcBar!: Phaser.GameObjects.Image;
  seller!: Phaser.GameObjects.Container;
  carried!: Phaser.GameObjects.Image;
  sellerBusy = false;
  /** Номер текущего дела продавца: смена номера отменяет дело (продавца позвали к кассе). */
  choreId = 0;
  lastCall = 0;
  timeLeft = DAY_SECONDS;
  /** Инспектор: 'pending' — ещё не пришёл, 'here' — ходит по залу, 'done' — ушёл. */
  inspector: 'none' | 'pending' | 'here' | 'done' = 'none';
  inspection: InspectionResult | null = null;
  rushAnnounced = false;
  /** «Позвать на помощь»: до какого момента видна кнопка и ждём ли окно «Поделиться» (help.ts). */
  helpUntil = 0;
  helpBusy = false;
  /** Сколько заданий дня уже отпраздновали всплывашкой. */
  questsSeen = 0;
  /** Прогресс заданий, по которому в последний раз строился список в HUD. */
  private questRowsKey = '';
  /** Активные моменты дня (game/moments.ts, scenes/moments.ts): монетка, чаевые, гость машет… */
  readonly moments = new Moments({
    scene: this,
    lite: () => this.lite,
    blocked: () => liveFx.momentBlocked(this),
    hallGuest: () => liveFx.momentGuest(this),
    queueGuest: () => this.queue.find((c) => !c.gone && !c.thief && !c.serving && c.sprite.active)?.sprite ?? null,
    till: () => this.registers[0]?.counter ?? this.layout.counter,
    floor: () => liveFx.freeFloorPoint(this),
    popup: (x, y, text, color) => this.popup(x, y, text, color),
    emote: (person, key) => effects.emote(this, person, key),
    coins: (x, y, n) => effects.flyCoins(this, x, y, n),
    puff: (x, y) => effects.puff(this, x, y),
    tap: (action) => camera.tap(this, action),
    caught: (kind) => liveFx.momentCaught(this, kind),
    missed: () => noteMoment(this.stats, false),
  });
  /** Кассы: основная и (если куплена) вторая слева от очереди. Очередь одна — идёт к свободной. */
  registers: Register[] = [];
  /** Ведро с мусором в зале: сколько в нём, картинка, выносят ли его сейчас и сколько несут в мешке. */
  binFill = 0;
  binImg?: Phaser.GameObjects.Image;
  /** Полка «Уценка» (bargain.ts): где стоит и картинки товара на ней (по местам горки). */
  bargainAt: { x: number; y: number } | null = null;
  private bargainItems: Phaser.GameObjects.Image[] = [];
  /** Гниющий мусор (rot.ts): мухи и вонь над ним и над переполненным ведром. */
  rotting = new Rotting(this, () => this.lite);
  /** Сколько секунд ведро стоит переполненным (тогда оно тоже пахнет). */
  binFullFor = 0;
  /** Всплывашка «Мусор гниёт» уже была в этом запуске (пока игрок не убрал гнилое — подсказка внизу). */
  rotWarned = false;
  binGlow?: Halo;
  binStink?: Phaser.GameObjects.Image;
  binBusy = false;
  /** Кто сейчас выносит мусор: продавец (его могут позвать к кассе) или уборщица. */
  binBy: 'seller' | 'cleaner' | null = null;
  bagCarried = 0;
  /** Продавец несёт мусор к ведру (если позовут к кассе — мусор упадёт обратно на пол). */
  carryingTrash = false;
  /** Голуби на тротуаре: разлетаются, когда рядом проходит человек. */
  pigeons: Pigeon[] = [];
  /** Таймеры кота и голубей: при перестройке мира старые останавливаются. */
  critterTimers: Phaser.Time.TimerEvent[] = [];
  /** Как кафе забрало утром заказ по договору — для итогов дня. */
  cafeToday: CafeDelivery | null = null;
  /** Ноты над радио, пока оно играет. */
  radioTimer?: Phaser.Time.TimerEvent;
  /** Где стоит приёмник (по x) — оттуда слышно радио. */
  radioX?: number;
  /** Музыка: открыт титул; после ночной смены (итоги, ночь) ещё звучит ночная; зимняя ли сегодня. */
  onTitle = true;
  nightMusic = false;
  winterTune = false;
  /** Новый год для звуков (салют вечером): новогодняя неделя в игре или 31.12–1.01 по календарю. */
  newYearSound = false;
  /** Что вокруг — для атмосферы (ambience.ts): один объект на все кадры, без мусора в памяти. */
  ambLife: AmbLife = { customers: 0, morning: 0, newYear: false, lateAutumn: false, night: false, lite: false, neon: null };
  /** Для какого состояния посчитаны работающие кассы (звук зала). */
  tillsFor: StoreState | null = null;
  valyaCame = false;
  /** Серия обслуживания: сколько подряд и когда была последняя продажа. */
  combo = 0;
  lastSaleAt = -Infinity;
  nextSpawn = 1;
  running = false;
  /** Подсказка «что дальше» в зале (game/nudge.ts): когда игрок последний раз касался экрана, какая подсказка и до каких пор. */
  lastTouch = 0;
  nudge: HallNudge | null = null;
  nudgeUntil = 0;
  /** Для какого состояния нарисована цель в HUD (состояние меняется целиком — сравниваем ссылку). */
  private goalFor: StoreState | null = null;
  /** Кофемашина (если куплена) и занята ли она. */
  coffeeImg?: Phaser.GameObjects.Image;
  /** Кто сейчас у стойки кофейни делает заказ или забирает. */
  coffeeCounter = false;
  /** Заказы кофе по очереди: бариста варит и отдаёт (done). */
  coffeeOrders: { c: Customer; done: () => void }[] = [];
  oven?: Oven;
  /** До какого времени в зале пахнет свежим хлебом. */
  aromaUntil = 0;
  /** Идёт захват магазина (особый день «ограбление»): новые покупатели не заходят. */
  siege = false;
  /** Сколько противней сегодня испекли для соседних магазинов. */
  wholesaleBaked = 0;
  /** Идёт ночная смена; уже спрашивали про неё сегодня. */
  night = false;
  nightAsked = false;
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
  rivalVisit = false;
  /** На экране утро своего магазина (до «Открыть магазин»): только тогда — новости о проделках и ответный визит. */
  inMorning = false;
  rivalLost = 0;
  /** Когда спрашивали сервер, что натворили у нас; что пришло, пока мы были в гостях. */
  rivalCheckedAt = 0;
  rivalPending: { pranks: PrankIn[]; thanks: string[] } | null = null;
  /** Сколько мс день стоит без открытых окон — сторож запускает его дальше. */
  stallMs = 0;
  nightWatch: Phaser.GameObjects.GameObject[] = [];
  /** Сколько кубков стоит на прилавке; жюри конкурса сегодня: ждём, пришло, ушло. */
  builtCup = 0;
  jury: 'none' | 'pending' | 'here' | 'done' = 'none';
  /** Соня сегодня заглянет в магазин (сюжет «Папа и Соня»). */
  sonya: 'none' | 'pending' | 'here' | 'done' = 'none';
  /** Праздничный гость сегодня (game/live.ts): кто, ждём / пришёл / ушёл и настоящая дата визита. */
  liveGuest: { who: GuestId; phase: 'pending' | 'here' | 'done'; date: string } | null = null;
  catHome = { x: 0, y: 0 };
  catOut = false;
  /** Кот сидит посреди зала: таймер, который водит его хвостом, моргает и умывает (есть, пока сидит). */
  catSitTimer?: Phaser.Time.TimerEvent;
  /** Сколько ещё тиков кот жмурится (погладили — медленно моргает). */
  catBlink = 0;
  /** Флажки, шарики и лоток ярмарки; лоток продаёт со склада по таймеру. */
  fairObjs: Phaser.GameObjects.GameObject[] = [];
  /** Особый день (bigday.ts): что на улице — марево, вода, шествие; убирается к вечеру. */
  bigObjs: { destroy: () => void }[] = [];
  /** Блэкаут на весь район: темно, касса считает вручную (щиток не поможет). */
  powerCut = false;
  /** Свадебный заказ: заберут вечером. */
  wedding: WeddingOrder | null = null;
  stall?: Phaser.GameObjects.Image;
  stallTimer?: Phaser.Time.TimerEvent;
  /** Доставка на дом (delivery.ts): телефон у кассы, звонок, принятые заказы, курьер со своим транспортом. */
  phone?: Phaser.GameObjects.Image;
  /** Кольца вокруг звонящего телефона и его подсветка. */
  phoneHalo?: Phaser.GameObjects.Arc;
  phoneGlow?: Halo;
  /**
   * Звонок, на который ещё не ответили: заказ, когда позвонили (playTime), таймеры ответа, трели и дрожи
   * трубки; covered — поверх открыто окно, звонок ждёт.
   */
  call: { order: HomeOrder; at: number; timer: Phaser.Time.TimerEvent; ringer: Phaser.Time.TimerEvent; shake: Phaser.Time.TimerEvent; covered?: boolean } | null = null;
  /** Когда позвонят в следующий раз. */
  callTimer?: Phaser.Time.TimerEvent;
  /** Принятые заказы: ждут сборки, собираются, стоят коробкой у двери или едут с курьером. */
  parcels: Parcel[] = [];
  /** Хозяин сам соберёт ждущий заказ, как только освободится (принял звонок или нажал «Собрать»). */
  packRequested = false;
  courier?: Phaser.GameObjects.Container;
  /** Велосипед или мопед у входа (фургончик подъезжает только за заказами). */
  courierRide?: Phaser.GameObjects.Image;
  courierHome = { x: 0, y: 0 };
  courierBusy = false;
  /** Поездка курьера — для плашки «🚲 в пути 0:06»: когда выехал (playTime), сколько ехать, на чём. */
  courierTrip: { start: number; seconds: number; icon: string } | null = null;
  /** Карточка звонка внизу экрана и плашка-статус доставки (ui/delivery.ts). */
  readonly deliveryUi = new DeliveryUi();
  /** Менеджер сейчас ходит по залу (а не стоит за кассой вместо кассира) — ему можно поручить посылку. */
  managerOnFloor = false;
  /** Ускорение дня (×1 или ×2). */
  speed = 1;
  /** Сколько игровых секунд магазин проработал (с ускорением, без пауз): часы доставки — чаевые и «в пути 0:06». */
  private playTime = 0;
  /** В какой игровой день уже был ритуал возвращения (offerReturn): утро открывается не раз за день. */
  ritualDay = -1;

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
      void nightShift.sendFriendHelp(this);
      if (info?.helped) void nightShift.takeFriendHelp(this);
      if (!info?.welcome) return;
      this.state = { ...this.state, money: this.state.money + WELCOME_GIFT };
      saveGame(this.state);
      this.hud.update(this.state, this.timeLeft);
      toast('assets/ico_gift.png', t('social.welcome'), t('social.welcomeText', { n: WELCOME_GIFT }));
    });
    this.hud = new Hud();
    this.hud.onSpeed = () => this.running && this.setSpeed(this.speed > 1 ? 1 : 2);
    this.hud.onUrgent = () => deliveries.openUrgent(this);
    this.hud.onHelp = () => void nightShift.callForHelp(this);
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
    camera.setupCameraDrag(this);
    camera.setupStreetTap(this);
    // Свернули Telegram — телефон мог отобрать у WebGL контекст; когда он вернётся, Phaser сам
    // восстановит текстуры и шейдеры, а нарисованное в RenderTexture дорисуем мы.
    if (this.game.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) this.game.renderer.on(Phaser.Renderer.Events.RESTORE_WEBGL, () => lighting.rebake(this));
    // Улица живёт своей жизнью: прохожие и машины.
    this.time.addEvent({ delay: 1800, loop: true, callback: () => visitors.streetLife(this) });
    // Над кварталом плывут тени облаков, иногда пролетает стайка птиц.
    this.time.addEvent({ delay: 6000, loop: true, callback: () => nightShift.skyLife(this) });
    // Потёртость пола: кто где идёт по залу — по таймеру времени игры, а не каждый кадр.
    this.time.addEvent({ delay: WEAR_SAMPLE_MS, loop: true, callback: () => this.running && staff.sampleSteps(this) });
    // Живая очередь и продавец без дела: кто-то вздыхает, смотрит на часы, продавец протирает прилавок.
    this.time.addEvent({ delay: 1300, loop: true, callback: () => this.running && persons.queueIdle(this) });
    this.time.addEvent({ delay: 4200, loop: true, callback: () => this.running && persons.sellerIdle(this) });
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
        morningFlow.showMorning(this);
      },
    });
  }

  /**
   * За титулом — живая улица на закате: горят фонари и неон, едут машины, идут люди,
   * камера медленно плывёт вдоль квартала. Возвращает функцию, которая вернёт камеру к магазину.
   */
  /** Ускорение дня: время, движения и таймеры идут вдвое быстрее. */
  setSpeed(speed: number): void {
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
    camera.cullView(this);
    camera.measureFps(this, deltaMs);
    morningFlow.watchStall(this, deltaMs);
    streets.scarePigeons(this);
    ambience.update(this.rainStopped ? 'clear' : this.weather, this.evening, this.running, yearTime(this.state.day), decorations.ambienceLife(this));
    weatherFx.updateRain(this);
    weatherFx.windTick(this, deltaMs);
    this.hud.showSpeed(this.running && this.state.day > TUTORIAL_DAYS, this.speed);
    this.hud.showUrgent(this.running && !this.night && this.state.day > TUTORIAL_DAYS);
    this.hud.showHelp(this.running && !this.night && this.time.now < this.helpUntil && nightShift.canCallForHelp(this), this.helpBusy);
    music.setMood(decorations.musicMood(this), this.winterTune);
    // Дверь двигается только в рабочие часы: день кончился — стекло снова закрывает улицу.
    if (!this.running) {
      // День стоит (итоги, ночь, окно) — подсветка зала гаснет; утро и итоги показывают свою.
      newcomer.hallCoachOff(this);
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
      deliveries.autoTopUpIfNeeded(this);
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
    if (!this.night && this.inspector === 'pending' && elapsed >= INSPECTOR_AT) void shoppers.runInspector(this);
    if (!this.night && this.jury === 'pending' && elapsed >= JURY_AT) void shoppers.runJury(this);
    if (!this.night && this.sonya === 'pending' && elapsed >= SONYA_AT) void this.runSonya();
    if (!this.night && this.liveGuest?.phase === 'pending' && elapsed >= LIVE_GUEST_AT) void shoppers.runLiveGuest(this);
    if (!this.night) this.moments.tick(elapsed, deltaMs);

    if (this.timeLeft > 0) {
      this.nextSpawn -= dt;
      const maxCustomers = storeLevel(this.state).maxCustomers + (rush ? 3 : 0) + (isCrowdDay(this.state.day) && !this.night ? CROWD_EXTRA_GUESTS : 0);
      if (this.nextSpawn <= 0 && this.customers.size < maxCustomers && !this.siege) {
        // Очередной покупатель иногда приезжает на машине: сначала паркуется, потом идёт в магазин.
        // Этого гостя позвал к себе конкурент (game/rival.ts) — он не придёт.
        if (this.rivalLost > 0 && !this.night) this.rivalLost--;
        else if (!cars.carCustomer(this)) this.spawnCustomer();
        const interval =
          spawnIntervalToday(this.state) / (rush ? 2 : 1) / (this.night ? NIGHT_GUESTS * bigDayNightGuests(this.state.day) * (this.busker ? BUSKER_GUESTS : 1) : 1);
        this.nextSpawn = interval * Phaser.Math.FloatBetween(0.7, 1.3);
      }
    } else if (this.customers.size === 0 && this.inspector !== 'here' && this.jury !== 'here' && this.sonya !== 'here' && this.liveGuest?.phase !== 'here') {
      this.endOfDay();
    }

    for (const c of this.queue) persons.updateBubble(this, c);
    for (const r of this.registers) if (r.customer) persons.updateBubble(this, r.customer);
    staff.checkSlips(this);
    staff.updateRot(this, dt);
    shoppers.updateScanBar(this);
    staff.callSellerIfNeeded(this);
    // Пока говорит бабушка (облачком или у подсветки обучения), та же подсказка снизу не повторяется.
    const raw = newcomer.currentHint(this);
    // Та же подсказка, что у подсветки обучения (касса, полка), снизу не повторяется; другие (вор, мусор) — да.
    const coached = this.hallCoach && this.coach.pointing && (raw === t('hint.serve') || raw === t('hint.restock'));
    let hint = this.say.visible || coached ? '' : raw || newcomer.nudgeHint(this);
    // Одна подсказка в одном месте: пока о кассе и полках говорят бабушка или подсветка обучения,
    // снизу о том же молчим (firstday.ts).
    if ((grannyStays(this.state) || (this.hallCoach && this.coach.active)) && (hint === t('hint.serve') || hint === t('hint.restock'))) hint = '';
    this.hud.setHint(hint, this.state.day <= TUTORIAL_DAYS || this.nudgeUntil > this.time.now);
    if (this.goalFor !== this.state) {
      this.goalFor = this.state;
      this.hud.setGoal(mainGoal(this.state));
    }
    newcomer.updateTutorialArrow(this);
    if (this.state.onboarding && this.state.day === 1) newcomer.onboardingTick(this);
    newcomer.tutorialTick(this, deltaMs);
    this.updateLighting(this.night ? 1 : undefined);
    motion.updateDoor(this);
    motion.pulseHighlights(this);
    motion.animatePeople(this);
    food.updateOven(this);
    pets.petCatNearby(this);
    effects.cheerProgress(this);
    deliveries.updateDelivery(this);
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
  shelfNeedsRestock(): boolean {
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
    camera.frameCamera(this);
    this.cameras.main.setZoom(this.baseZoom).centerOn(this.home.x, this.home.y);
    // Цветокоррекция часа и погоды — один проход по экрану (в лёгкой графике — без него), виньетка — картинкой.
    this.grade.attach(LIGHT_DEPTH + 30);
    // Карта освещения — до всего остального: улица, зал и погода сразу вписывают в неё свои огни.
    lighting.resetLight(this, next);
    streets.buildStreet(this, next);
    streets.buildCritters(this, next);
    streets.buildNeighbors(this, next);
    if (next !== this.layout) streets.buildForRent(this, next);

    this.buildStore();
    lighting.buildLighting(this, next);
    lighting.buildDust(this);
    streets.applyAds(this);
    this.refreshShelves();
    this.refreshWarehouse();
    this.refreshToilet();
    this.workers.clear();
    staff.syncStaff(this);
    weatherFx.applyWeather(this);
    this.fairObjs = [];
    decorations.applyFair(this);
    morningFlow.noteNewProps(this, bought);
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
  wearLayer(): WearLayer | null {
    const wear = this.wear;
    return wear ? { cells: wear.cells, cols: wear.grid.cols, rows: wear.grid.rows, x: 0, y: this.layout.wallH } : null;
  }

  /**
   * Живой пол (floor.ts): тени у стен и под мебелью — заново, если мебель переставили (та же расстановка —
   * готовые), и потёртость. Пол — зал, комнаты флигеля (под куском стены с табличкой) и проёмы их дверей;
   * входная дверь — проём наружу: у неё пол не темнеет.
   */
  bakeFloor(): void {
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
  bakeFloorSoon(): void {
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
    staff.stopMop(this);
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
        shoppers.returnExtras(this, c);
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
    if (!sign) nightShift.signLights(this, w / 2, -9, grand ? 46 : 30);
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
      .on('pointerup', () => camera.tap(this, () => staff.cleanToilet(this)));

    this.art(counter.x + 2, counter.y + 3, 'shadow_wide').setScale(0.62, 0.7).setAngle(90).setDepth(counter.y + 19);
    const registerImg = this.art(counter.x, counter.y + FURNITURE_TOP / 2, registerSprite(this.state)).setDepth(counter.y + 20);
    this.buildShowcases();
    this.buildBin();
    this.buildBargain();
    food.buildFood(this);
    // Электрощиток на стене: нужен, когда отключат свет. Перестановка не даёт закрыть его полкой
    // (placement.ts), а если в старом сохранении полка уже стоит там — щиток висит левее, на открытой стене.
    const fuseX = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => wc.x - 24 - k * 12).find((x) => x > 10 && !this.behindShelf(x, 6)) ?? wc.x - 24;
    this.fuseBox = this.art(fuseX, 18, 'fusebox').setDepth(3);
    this.fuseBox.setInteractive({ useHandCursor: true }).on('pointerup', () => camera.tap(this, () => liveFx.fixFuse(this)));
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
    const home = staff.ownerHome(this);
    this.seller = persons.makePerson(this, home.x, home.y, ownerLook(this.state));
    // Кибер-продавец светится неоном.
    if (activeDecor(this.state, 'outfit')?.id === 'outfit_cyber') personGlow(this, this.seller, 0x2ce8f5, 2);
    this.carried = this.art(0, 3, 'box').setVisible(false);
    this.seller.add(this.carried);
    this.add
      .zone(counter.x + 6, counter.y + 6, 40, 64)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => camera.tap(this, () => this.serveNext()));
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
  operator(index: number): Worker | 'owner' | null {
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
      .on('pointerup', () => camera.tap(this, () => this.serveNext(index)));
  }

  /** Хозяин сейчас пробивает кого-то. */
  ownerScanning(): boolean {
    return this.registers.some((r) => r.scan?.byOwner);
  }

  /** Касса, у которой ждёт покупатель, а за кассой — хозяин (нужно нажать). */
  ownerRegister(): Register | undefined {
    return this.registers.find((r, i) => this.operator(i) === 'owner' && r.customer && !r.customer.serving);
  }

  registerOf(c: Customer): Register | undefined {
    return this.registers.find((r) => r.customer === c);
  }

  /** Покупатель уже стоит у своей кассы. */
  atSpot(r: Register): boolean {
    const c = r.customer;
    return Boolean(c) && Phaser.Math.Distance.Between(c!.sprite.x, c!.sprite.y, r.spot.x, r.spot.y) < 2;
  }

  /** Сколько человек ждут: в очереди и у касс (кого ещё не пробивают). */
  waiting(): number {
    return this.queue.length + this.registers.filter((r) => r.customer && !r.customer.serving).length;
  }

  /** Название на вывеске: своё, если игрок назвал магазин, иначе — по помещению. */
  shopTitle(): string {
    return this.state.shopName?.trim() || t(storeLevel(this.state).nameKey);
  }

  /**
   * Перестановка полок утром: зал целиком в кадре, каждое место под полку — «призрак», который тянут
   * пальцем по сетке. Место, куда ставить нельзя (вплотную к проходу, на кассе, у двери, так, что к
   * полке не подойти), — красное; «Готово» — только когда красных нет.
   */
  arrange(): void {
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
      morningFlow.showMorning(this);
    };
  }

  /** Переходник к lighting.updateLighting: метод сцены вызывают и скрипты снаружи (scripts/e2e.ts, scripts/promo). */
  updateLighting(progress?: number): void {
    return lighting.updateLighting(this, progress);
  }

  /** Скорость покупателей: под бодрое радио ходят быстрее. */
  customerSpeed(): number {
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

  /** Игровые секунды: идут с ускорением и стоят, пока магазин закрыт или на паузе (time.now — нет). */
  dayClock(): number {
    return this.playTime;
  }

  /** Переходник к nightShift.endOfDay: метод сцены вызывают и скрипты снаружи (scripts/e2e.ts, scripts/promo). */
  private endOfDay(): void {
    return nightShift.endOfDay(this);
  }

  /** Переходник к pets.catVisit: метод сцены вызывают и скрипты снаружи (scripts/e2e.ts, scripts/promo). */
  catVisit(): Promise<void> {
    return pets.catVisit(this);
  }

  // ---------- Доска отзывов ----------

  buildReviewBoard(x: number, y: number): void {
    // Доска у входа — просто украшение. Раньше нажатие на неё открывало отзывы, и они вылезали
    // посреди дня от случайного касания у двери; теперь отзывы — в итогах дня и утром на вкладке «Развитие».
    this.art(x, y, 'review_board').setOrigin(0.5, 1).setDepth(y);
  }

  /**
   * Покупатель с небольшой корзиной пробивает себя сам на свободной кассе самообслуживания: когда у
   * касс очередь, а без очереди — каждый третий (KIOSK_PREFER). Сколько штук, как быстро, как часто
   * «ошибка» и непробитый товар — по модели киосков (lanes.ts).
   */
  async useKiosk(c: Customer): Promise<boolean> {
    const tier = kioskTier(this.state);
    if (!this.kiosks.length || c.thief || !c.items.length || c.items.length > tier.maxItems) return false;
    if (this.waiting() === 0 && Math.random() >= KIOSK_PREFER) return false;
    const kiosk = this.kiosks.find((k) => !k.busy && k.img.active);
    if (!kiosk) return false;
    kiosk.busy = true;
    const { img, screen } = kiosk;
    await persons.walk(this, c.sprite, img.x - 14, img.y + 4);
    if (c.gone || !c.sprite.active) {
      kiosk.busy = false;
      return true;
    }
    persons.setFacing(c.sprite, 'right');
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
    shoppers.finishCheckout(this, c, { x: img.x - 10, y: img.y - 12 });
    return true;
  }

  /** Переходник к camera.onResize: на метод подписано событие RESIZE (scale.on/off по ссылке на метод). */
  onResize(size: Phaser.Structs.Size, _base: Phaser.Structs.Size, _display: Phaser.Structs.Size, prevW: number, prevH: number): void {
    return camera.onResize(this, size, _base, _display, prevW, prevH);
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
  binSpot(): { x: number; y: number } {
    return this.propAt('bin', this.binDefault());
  }

  /** Куда встать, чтобы завязать мешок: со стороны зала. */
  binStand(): { x: number; y: number } {
    const bin = this.binSpot();
    return { x: bin.x + (bin.x < this.layout.w / 2 ? 16 : -16), y: bin.y + 2 };
  }

  /** Контейнер у фасада слева от двери, на пути от двери не стоит. */
  dumpSpot(): { x: number; y: number } {
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
    this.binImg.setInteractive({ useHandCursor: true }).on('pointerup', () => camera.tap(this, () => this.takeOutTrash()));
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
    img.setInteractive({ useHandCursor: true }).on('pointerup', () => camera.tap(this, () => this.sendToBargain(true)));
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
  bargainStand(at: { x: number; y: number }): number {
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
  sendToBargain(byTap = false): void {
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
  async visitBargain(c: Customer): Promise<void> {
    const at = this.bargainAt;
    if (!at || c.thief || !bargainCount(this.state) || Math.random() >= BARGAIN_CHANCE) return;
    await persons.walk(this, c.sprite, at.x + Phaser.Math.Between(-8, 8), this.bargainStand(at));
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

  refreshBin(): void {
    if (!this.binImg?.active) return;
    const level = this.binFill === 0 ? 0 : this.binFull() ? 3 : this.binFill >= binCapacity(this.state) / 2 ? 2 : 1;
    this.binImg.setTexture(binSprite(this.state, level));
    this.binStink?.setVisible(this.binFull());
  }

  /** Мусор в ведро: оно подпрыгивает. */
  putInBin(): void {
    this.binFill = Math.min(binCapacity(this.state), this.binFill + 1);
    this.refreshBin();
    sound.tap();
    if (this.binImg) this.tweens.add({ targets: this.binImg, scaleY: 1.15 / ART, duration: 90, yoyo: true });
    if (this.binFull()) this.popup(this.binSpot().x, this.binSpot().y - 18, t('popup.binFull'), '#ffd0d0');
  }

  /** Шаги «вынести мусор»: к ведру, завязать мешок, через дверь к контейнеру, бросить и вернуться. */
  takeOutSteps(onBag: () => void, onDump: () => void): ChoreStep[] {
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

  bagFromBin(): void {
    this.bagCarried = this.binFill;
    this.binFill = 0;
    this.refreshBin();
  }

  bagToDumpster(): void {
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
    void staff.doChore(this, 
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

  /** Комнаты флигеля, в которые есть дверь из зала. */
  openRooms(): Room[] {
    const { warehouse, bakery, coffee, kitchen } = this.layout;
    return [warehouse, ...(food.bakeryOpen(this) ? [bakery] : []), ...(food.coffeeOpen(this) ? [coffee] : []), ...(kitchen && kitchenOpen(this.state) ? [kitchen] : [])];
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
    this.buildRoom(bakery, 'bakery', food.bakeryOpen(this));
    this.buildRoom(coffee, 'coffee', food.coffeeOpen(this));
    if (this.layout.kitchen) this.buildRoom(this.layout.kitchen, 'kitchen', kitchenOpen(this.state));
    food.buildKitchen(this);
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
          camera.tap(this, () => i >= this.regularShelves() && this.popup(slot.x, slot.y - 8, t('popup.slotEmpty'), '#fff3b0')),
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
    bg.setInteractive({ useHandCursor: true }).on('pointerup', () => camera.tap(this, () => staff.restockShelf(this, index)));
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
    expire.setInteractive({ useHandCursor: true }).on('pointerup', () => camera.tap(this, () => this.markdownNow(expire.x, expire.y)));
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
    bg.setInteractive({ useHandCursor: true }).on('pointerup', () => camera.tap(this, () => staff.restockShelf(this, index)));
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
    expire.setInteractive({ useHandCursor: true }).on('pointerup', () => camera.tap(this, () => this.markdownNow(expire.x, expire.y)));
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
  clashes(index: number): boolean {
    const slot = slotOf(this.state, index);
    if (slot < 0 || this.state.shelves[index].kind === 'household') return false;
    return this.links().some((l) => l.kind === 'clash' && (l.a === slot || l.b === slot));
  }

  /** Что прихватить заодно с соседней полки-пары (или ничего). */
  pairPick(index: number, wanted: ProductId[]): { id: ProductId; index: number } | null {
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

  spotOf(index: number): { x: number; y: number } {
    const kind = this.state.shelves[index]?.kind;
    if (kind === 'icebox') return this.iceboxSpot();
    if (kind === 'florist') return this.floristSpot();
    return this.layout.slots[Math.max(0, slotOf(this.state, index))];
  }

  /** Куда встать, чтобы взять с полки: к полке — снизу, к ларю — сверху (со стороны зала), к вёдрам — слева. */
  standOf(index: number): { x: number; y: number } {
    const p = this.spotOf(index);
    const kind = this.state.shelves[index]?.kind;
    if (kind === 'icebox') return { x: p.x, y: p.y - 16 };
    if (kind === 'florist') return { x: p.x - 14, y: p.y + 6 };
    // Обычная полка — снизу, боковая у стены — сбоку (placement.ts).
    return standFor(this.layout, p);
  }

  /** Путь из зала к полке. */
  routeTo(index: number): { x: number; y: number }[] {
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

  refreshToilet(): void {
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

  /** Открывает выполненные достижения; новые — всплывашкой по очереди. Возвращает, что открылось. */
  checkAchievements(live: boolean): AchievementId[] {
    const { state, unlocked } = unlockAchievements(liveProgress(this.state, live ? this.stats : undefined));
    if (!unlocked.length) return unlocked;
    this.state = state;
    saveGame(state);
    unlocked.forEach((id, i) => this.time.delayedCall(i * 3800, () => announceAchievement(id)));
    return unlocked;
  }

  /** Переходник к effects.celebrateCombo: метод сцены вызывают и скрипты снаружи (scripts/e2e.ts, scripts/promo). */
  celebrateCombo(n: number): void {
    return effects.celebrateCombo(this, n);
  }

  alive(gen: number): boolean {
    return gen === this.staffGen && this.scene.isActive();
  }

  /** Переходник к shoppers.runSonya: метод сцены вызывают и скрипты снаружи (scripts/e2e.ts, scripts/promo). */
  private runSonya(): Promise<void> {
    return shoppers.runSonya(this);
  }

  /** Переходник к shoppers.spawnCustomer: метод сцены вызывают и скрипты снаружи (scripts/e2e.ts, scripts/promo). */
  spawnCustomer(
    forced?: { look: Look; at: Phaser.Types.Math.Vector2Like; wants?: ProductId[]; first?: boolean },
    arrived?: { sprite: Phaser.GameObjects.Container; look: Look; car: ParkSpot },
  ): void {
    return shoppers.spawnCustomer(this, forced, arrived);
  }

  /** Корзина покупателя с учётом спроса дня: погода, ценовая война, запах хлеба. */
  wanted(count: number): ProductId[] {
    const aroma = this.aroma();
    return pickWanted(this.state, Math.random, count, (id) => dayDemand(this.state, id, aroma));
  }

  /** В зале пахнет свежим хлебом из печи. */
  aroma(): boolean {
    return this.time.now < this.aromaUntil;
  }

  /** Переходник к shoppers.serveNext: метод сцены вызывают и скрипты снаружи (scripts/e2e.ts, scripts/promo). */
  serveNext(from = 0): Promise<void> {
    return shoppers.serveNext(this, from);
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

  // ---------- Первые минуты новичка (game/onboarding.ts) ----------

  /** Секунды от «Играть» — по ним видно, как быстро новичок дошёл до шага. */
  sincePlay(): number {
    return this.playAt ? (performance.now() - this.playAt) / 1000 : 0;
  }

  /** Переходник к morningFlow.unboxables: метод сцены вызывают и скрипты снаружи (scripts/e2e.ts, scripts/promo). */
  unboxables(): Map<string, Phaser.GameObjects.Image> {
    return morningFlow.unboxables(this);
  }

  /** Переходник к morningFlow.packFresh: метод сцены вызывают и скрипты снаружи (scripts/e2e.ts, scripts/promo). */
  packFresh(): void {
    return morningFlow.packFresh(this);
  }
}
