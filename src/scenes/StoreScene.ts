import Phaser from 'phaser';
import {
  DAY_SECONDS,
  emptyDayStats,
  markdownSurplus,
  newGame,
  returnToShelf,
  STORE_LEVELS,
  HYPER_LEVEL,
  storeLevel,
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
import { toast } from '../ui/dom';
import { bigDayNightGuests, CROWD_EXTRA_GUESTS, isCrowdDay, setBigDaySeed, type WeddingOrder } from '../game/bigday';
import type { GiantLook } from '../game/giant';
import { Hud } from '../ui/hud';
import { showTitle } from '../ui/title';
import type { Weather } from '../game/weather';
import { yearTime } from '../game/calendar';
import { liveProgress, unlockAchievements, type AchievementId } from '../game/achievements';
import { announceAchievement } from '../ui/achievements';
import { ETAGS_EVENING, eveningSales, hasUpgrade } from '../game/upgrades';
import { noteSeen, stashAway } from '../game/returns';
import { decorFromPurchases, grantDecor } from '../game/decor';
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
import { BUSKER_GUESTS } from '../game/nightGuests';
import { setErrorContext } from '../platform/errors';
import { savedLayout, type Prop } from './placement';
import { layoutFor, WING_OUTER, type Layout } from './layout';
import { BASE_W, crispZoom } from './pixels';
import { LightMap } from './light';
import { ColorGrade } from './grade';
import { Halo } from './halo';
import { FloorShade, furnitureCasters, type WearLayer } from './floor';
import { decodeWear, wearGrid, type WearGrid } from '../game/wear';
import { dayDemand } from '../game/demand';
import { Rotting } from './rotting';
import type { EduardLook } from '../game/eduard';
import type { CafeDelivery } from '../game/cafe';
import { radioSpeed } from '../game/radio';
import type { LiveKind } from '../game/minievents';
import { noteMoment } from '../game/moments';
import { Moments } from './moments';
import { questRows } from '../ui/today';
import { RELIEF_ROLE, tillRole } from '../game/registers';
import { NIGHT_GUESTS } from '../game/night';
import { quality, type Quality } from '../platform/quality';
import { grannyStays } from '../game/firstday';
import type { HomeOrder } from '../game/delivery';
import { DeliveryUi } from '../ui/delivery';
import { mainGoal, type HallNudge } from '../game/nudge';
import {
  ART,
  TUTORIAL_DAYS,
  WALL,
  type Popup,
  LIGHT_DEPTH,
  CUSTOMER_SPEED,
  AUTO_CHECK_SECONDS,
  FLOOR_SHADE_DEPTH,
  WEAR_SAMPLE_MS,
  type Look,
  type ParkSpot,
  type ParkingLot,
  type RoadCar,
  INSPECTOR_AT,
  SONYA_AT,
  LIVE_GUEST_AT,
  JURY_AT,
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
  type Parcel,
} from './common';
import * as motion from './motion';
import * as effects from './effects';
import * as pets from './pets';
import * as lighting from './lighting';
import * as weatherFx from './weatherFx';
import * as decorations from './decorations';
import * as weeksFx from './weeks';
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
import * as shelves from './shelves';
import * as building from './building';
import * as collections from './collections';

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
  boxes: Phaser.GameObjects.Image[] = [];
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
  propDefaults: Record<string, { x: number; y: number }> = {};
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
  slotDecor: Phaser.GameObjects.Image[] = [];
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
  wcStink!: Phaser.GameObjects.Image;
  wcDoor!: Phaser.GameObjects.Image;
  wcBar!: Phaser.GameObjects.Image;
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
  bargainItems: Phaser.GameObjects.Image[] = [];
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
  /** Сезонная неделя (weeks.ts): украшения, люди у лотков, их повторы и баннер «−20%». */
  weekObjs: Phaser.GameObjects.GameObject[] = [];
  weekTimers: (() => void)[] = [];
  weekSign?: Phaser.GameObjects.Image;
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
  /** Витрина трофеев коллекций в зале (collections.ts): где стоит и какие трофеи уже на полках. */
  trophyCase?: { x: number; y: number; img: Phaser.GameObjects.Image; shown: import('../game/collections').SetId[] };

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
    // Альбом коллекций добирает заработанное и празднует собранный набор (collections.ts).
    this.time.addEvent({ delay: 1000, loop: true, callback: () => collections.tick(this) });
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
    // Титул на экране — подкачать утреннее окно, пока игрок на него смотрит (platform/lazy.ts).
    // У новичка в первый день утра нет: связь сейчас нужнее звукам дня — подкачка позже (startDay).
    if (save) morningFlow.prefetchMorning();
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
      building.sendToBargain(this);
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
    weeksFx.tick(this);

    if (this.timeLeft > 0) {
      this.nextSpawn -= dt;
      const maxCustomers = storeLevel(this.state).maxCustomers + (rush ? 3 : 0) + (isCrowdDay(this.state.day) && !this.night ? CROWD_EXTRA_GUESTS : 0) + weeksFx.crowdExtra(this);
      if (this.nextSpawn <= 0 && this.customers.size < maxCustomers && !this.siege) {
        // Очередной покупатель иногда приезжает на машине: сначала паркуется, потом идёт в магазин.
        // Этого гостя позвал к себе конкурент (game/rival.ts) — он не придёт.
        if (this.rivalLost > 0 && !this.night) this.rivalLost--;
        else if (!cars.carCustomer(this)) this.spawnCustomer();
        const interval =
          spawnIntervalToday(this.state) / (rush ? 2 : 1) / weeksFx.crowd(this) / (this.night ? NIGHT_GUESTS * bigDayNightGuests(this.state.day) * (this.busker ? BUSKER_GUESTS : 1) : 1);
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

    building.buildStore(this);
    lighting.buildLighting(this, next);
    lighting.buildDust(this);
    streets.applyAds(this);
    this.refreshShelves();
    building.refreshWarehouse(this);
    building.refreshToilet(this);
    this.workers.clear();
    staff.syncStaff(this);
    weatherFx.applyWeather(this);
    this.fairObjs = [];
    decorations.applyFair(this);
    this.weekObjs = [];
    this.weekTimers = [];
    weeksFx.applyWeek(this);
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
      ...building.openRooms(this).map((r) => ({ x: -WALL, y: r.doorway.y - 8, w: WALL, h: 16 })),
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

  /** Переходник к lighting.updateLighting: метод сцены вызывают и скрипты снаружи (scripts/e2e.ts, scripts/promo). */
  updateLighting(progress?: number): void {
    return lighting.updateLighting(this, progress);
  }

  /** Скорость покупателей: под бодрое радио ходят быстрее. */
  customerSpeed(): number {
    return CUSTOMER_SPEED * radioSpeed(this.state);
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

  /** Переходник к camera.onResize: на метод подписано событие RESIZE (scale.on/off по ссылке на метод). */
  onResize(size: Phaser.Structs.Size, _base: Phaser.Structs.Size, _display: Phaser.Structs.Size, prevW: number, prevH: number): void {
    return camera.onResize(this, size, _base, _display, prevW, prevH);
  }

  /** Переходник к shelves.refreshShelves: метод сцены вызывают и скрипты снаружи (scripts/e2e.ts, scripts/promo). */
  refreshShelves(slide = true): void {
    return shelves.refreshShelves(this, slide);
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
