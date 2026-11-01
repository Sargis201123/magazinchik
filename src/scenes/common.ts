// Общее для сцены магазина (StoreScene.ts) и её модулей: размеры и глубины мира, цвета, внешность людей,
// типы покупателя, полки и машины, мелкие помощники без состояния. Здесь нет ничего, что знает о сцене:
// всё, чему нужна сцена, — в её модулях (карта — docs/ARCHITECTURE.md).

import Phaser from 'phaser';
import type { CartItem, Category, ProductId, StaffMember } from '../game/economy';
import type { RareGuestId } from '../game/endless';
import type { Facing } from './stride';
import { pickWear } from './archetypes';
import type { BackId, FaceId, HatId, OutfitId, PropId } from './wardrobe';
import { yearTime } from '../game/calendar';
import type { RegularId, ZarRegularId } from '../game/regulars';
import type { VisitFriend } from '../platform/multiplayer';
import type { DishId } from '../game/kitchen';
import type { NightGuestId } from '../game/nightGuests';
import type { Light } from './light';
import { Halo } from './halo';
import type { HomeOrder } from '../game/delivery';

// Холст — ровно по пикселям экрана, высотой от 9:16 до 9:20 ширины (platform/screen.ts, scenes/pixels.ts):
// на вытянутых телефонах картинка во весь экран, без пустых полос. Камера подбирает масштаб под магазин
// с флигелем, и в покое — по возможности ровный: пиксель рисунка — целое число пикселей экрана.
/** Сверху интерфейс (деньги, товар), снизу подсказки — магазин рисуем между ними (в базовых точках, × res). */
export const HUD_TOP = 140;
/** Спрайты нарисованы с двойной детализацией (DETAIL в art/sprites.py): в мире они вдвое меньше своих пикселей. */
export const ART = 2;
/** Сколько улицы видно под зданием (в точках мира). */
export const STREET_VIEW = 40;
/** Сколько первых дней показывать обучение: стрелки и яркую подсказку. */
export const TUTORIAL_DAYS = 3;
/** Высота видимой крышки мебели (TOP в art/sprites.py, в точках мира). */
export const FURNITURE_TOP = 6;
/** Толщина наружных стен и высота фасада (в точках мира). */
export const WALL = 6;
export const FACADE_H = 10;
export const HEADLIGHT_POWER = 1;
/** Машины на дороге: вид, цвет (null — свой, без перекраски), вес при выборе. */
export const CAR_TYPES: [string, number | null, number][] = [
  ['car_sedan', 0, 35],
  ['car_hatch', 0, 25],
  ['car_taxi', 0xfee761, 10],
  ['car_van', 0, 16],
  ['car_truck', null, 14],
];
/**
 * Всплывающая надпись и сколько раз подряд она повторилась. box — контейнер с фоном (bg), текстом и значками;
 * его точка 0, 0 — кончик хвостика, x — куда он указывает, y — где надпись висит. Плашка w × h сдвинута
 * от хвостика на dx, если прижата к краю магазина. text — исходная фраза (по ней склеиваются повторы «×N»).
 */
export type Popup = {
  box: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  text: string;
  color: string;
  count: number;
  x: number;
  y: number;
  w: number;
  h: number;
  dx: number;
  tail: boolean;
};

/** Слой света: выше людей и мебели, ниже всплывающих надписей (1000). */
export const LIGHT_DEPTH = 900;
/** Касание улицы короче этого (мс) — нажатие; дольше — палец лежал или начинал жест (camera.ts, friendStreet.ts). */
export const STREET_TAP_MS = 450;
/** Толчок: дрожь доходит до полки через x·QUAKE_WAVE_MS мс (слева направо), полка дрожит QUAKE_SHAKE_MS мс на ±QUAKE_SHAKE_PX. */
export const QUAKE_WAVE_MS = 1.5;
export const QUAKE_SHAKE_MS = 560;
export const QUAKE_SHAKE_PX = 0.8;
/** С какой доли дня начинается вечер. */
export const EVENING_FROM = 0.72;
/** Сколько видов у каждого товара (item_bread_0…2 в art/sprites.py). */
export const ITEM_VARIANTS = 3;

/** Терпение в очереди. Отсчёт начинается, когда покупатель дошёл до очереди. */
export const PATIENCE_MS = 20_000;
export const CUSTOMER_SPEED = 40; // пикселей мира в секунду
export const SELLER_SPEED = 90;
/** С такой скорости человек уже бежит: подпрыгивает, наклоняется вперёд, из-под ног летит пыль. */
export const RUN_PACE = 65;
export const KIOSK_GLOW = 0x2ce8f5;
export const SPILL_TINTS = [0xf4f8ff, 0xffb347, 0xb86f50];
/** Автозаказ проверяет склад раз в столько секунд дня. */
export const AUTO_CHECK_SECONDS = 2;
export const TOILET_DIRTY = 60;
export const PICKUP_MS = 500;
export const PLACE_MS = 400;
/** Тени и потёртость пола (floor.ts): над плиткой и вставками, под пятнами света ламп (0.45). */
export const FLOOR_SHADE_DEPTH = 0.25;
/** Как часто смотрим, кто идёт по залу (мс времени игры): шаги для потёртости пола. */
export const WEAR_SAMPLE_MS = 250;
export const SHIRTS = [0x5b6ee1, 0xd95763, 0x6abe30, 0xfbf236, 0x76428a, 0xdf7126, 0x37946e, 0xf6757a, 0x2ce8f5];
export const PANTS = [0x3a4466, 0x262b44, 0x5a6988, 0x733e39, 0x265c42];
export const HAIR_COLORS = [0x4a2c1a, 0x181425, 0x733e39, 0xfeae34, 0xb86f50, 0x8b9bb4];
export const HAIR_STYLES = ['short', 'short', 'long', 'long', 'bald', 'ponytail', 'curly'] as const;
export type HairStyle = 'short' | 'long' | 'bun' | 'cap' | 'bald' | 'ponytail' | 'curly' | 'beanie';
/** Поверх одежды: фартук (красится), жилет грузчика, значок охранника. */
export type Accessory = 'apron' | 'vest' | 'badge' | 'tie';
export type EmoteKey = 'emo_angry' | 'emo_heart' | 'emo_question' | 'emo_clock' | 'emo_sigh' | 'emo_pricey' | 'emo_alert' | 'emo_zzz' | 'emo_star';

export const VIEW_SUFFIX: Record<Facing, string> = { down: '', up: '_b', left: '_s', right: '_s' };

export interface Look {
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

/**
 * Походка по образу: старик с тростью идёт медленно и сутулясь, седые — неспешно и ровно, ребёнок
 * скачет вприпрыжку, в спортивном костюме шагает бодро, в наушниках пружинит в такт музыке.
 */
export type Gait = 'cane' | 'elder' | 'kid' | 'sporty' | 'bouncy';
/**
 * Дошёл, а следующий путь начнётся тут же (обещание walk исполняется после кадра): столько мс
 * он ещё «идёт» — не приседает на каждом повороте и не сбивает шаг.
 */
export const STEP_GRACE = 40;

export const randomLook = (shirt: number): Look => ({
  shirt,
  skin: Phaser.Utils.Array.GetRandom(SKINS),
  pants: Phaser.Utils.Array.GetRandom(PANTS),
  hair: Phaser.Utils.Array.GetRandom(HAIR_COLORS),
  style: Phaser.Utils.Array.GetRandom([...HAIR_STYLES]),
});

/** Покупатели бывают разные: дети, пожилые, рабочие в касках и жилетах. */
export const HAT_COLORS = [0xe43b44, 0x0099db, 0x63c74d, 0xfeae34, 0xb55088, 0x2ce8f5, 0xf6757a];
export const BAG_COLORS = [0x8f563b, 0x262b44, 0xe43b44, 0xc28569, 0x68386c];
export const DOG_COLORS = [0xc28569, 0xead4aa, 0x4a3b52, 0xffffff, 0xe4a672];

/** Доля покупателей в узнаваемом образе (archetypes.ts): пенсионер с тростью, повар, турист… */
export const ARCHETYPE_SHARE = 0.5;

export function customerLook(shirt: number, day = 0): Look {
  // Каждый пятый — в полоску, каждый восьмой — с сердечком на груди.
  const roll = Math.random();
  const pattern: Partial<Look> = roll < 0.2 ? { pattern: 'stripes' } : roll < 0.32 ? { pattern: 'print' } : {};
  return seasonalLook({ ...plainLook(shirt, day), ...pattern }, day);
}

export const COAT_COLORS = [0x262b44, 0xe43b44, 0x3e8948, 0x5a6988, 0xb86f50, 0x68386c, 0x0099db, 0xc0cbdc];

/** Одежда по погоде: зимой пуховики, шарфы и шапки, летом панамы и тёмные очки. */
export function seasonalLook(look: Look, day: number): Look {
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

export function plainLook(shirt: number, day: number): Look {
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
export function nightLook(): Look {
  const look = randomLook(Phaser.Utils.Array.GetRandom(NIGHT_SHIRTS));
  const roll = Math.random();
  if (roll < 0.35) return { ...look, style: 'cap', hair: Phaser.Utils.Array.GetRandom([0x181425, 0xfeae34, 0x262b44]) };
  if (roll < 0.6) return { ...look, style: 'beanie', hair: Phaser.Utils.Array.GetRandom(HAT_COLORS), bag: 'backpack', bagTint: Phaser.Utils.Array.GetRandom(BAG_COLORS) };
  return look;
}

/** Ночной гость с характером (nightGuests.ts): таксист, студент, врач, охранник… */
export function nightGuestLook(id: NightGuestId): Look {
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
export function withCompanionItems(look: Look): Look {
  if (look.kid) return look;
  const roll = Math.random();
  if (roll < 0.05) return { ...look, stroller: Phaser.Utils.Array.GetRandom(HAT_COLORS), style: Phaser.Utils.Array.GetRandom(['long', 'ponytail', 'bun'] as const) };
  if (roll < 0.11) return { ...look, dog: Phaser.Utils.Array.GetRandom(DOG_COLORS) };
  return look;
}
/** Место на парковке: где стоит машина и куда смотрит носом (верхний ряд — вверх, нижний — вниз). */
export interface ParkSpot {
  x: number;
  y: number;
  up: boolean;
  /** Чья машина здесь стоит или уже едет сюда (место занято с той минуты, как она свернула к парковке). */
  car: LotCar | null;
}

/**
 * Машина у магазина: кузов и фары (кадр по направлению — вбок, носом вверх или вниз, в повороте
 * доворачивается), два мигающих огонька поворотника, свет фар (вечером) — поверх темноты, как у такси.
 */
export interface LotCar {
  box: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  lights: Phaser.GameObjects.Image;
  key: string;
  /** Половина длины кузова: где у него нос и багажник. */
  half: number;
  /** Куда смотрит нос, в градусах: 0 — вправо, 90 — вниз, −90 — вверх. */
  heading: number;
  frame: 'side' | 'up' | 'down';
  blink: Phaser.GameObjects.Rectangle[];
  /** Мигает левым или правым поворотником (null — не мигает). */
  turn: 'left' | 'right' | null;
  beam: Phaser.GameObjects.Image;
  flash: Phaser.GameObjects.Image;
  /** Свет фар в карте освещения: конус на асфальте впереди машины. */
  headlights: Light;
  /** Едет (фары горят) или стоит заглушённая. */
  moving: boolean;
  /** Чья: покупателя (уедет, когда он вернётся из магазина) или соседей (уезжают сами, parkingTick). */
  owner: 'customer' | 'neighbor';
  /** За ней уже идёт водитель. */
  leaving: boolean;
}

/**
 * Парковка за магазином и проезд к ней с улицы вдоль правой стены (buildParking). left/right/top/bottom —
 * площадка, aisleY — проезд между рядами, laneX — середина въезда, footX — дорожка для пешеходов вдоль
 * стены, mouthY — где въезд выходит на тротуар. Проезд узкий: по нему (drive) и по парковке (aisle) за раз
 * едет одна машина; waiting — сколько водителей ждут у парковки, чтобы уехать (новые тогда не заезжают).
 * onRoad — машина с парковки сейчас на улице: в её полосе новые не появляются, чтобы не въехать в багажник;
 * mouth — она пока стоит у тротуара и ждёт просвета (это она пропускает тех, кто на дороге, а не они её).
 */
export interface ParkingLot {
  spots: ParkSpot[];
  left: number;
  right: number;
  top: number;
  bottom: number;
  aisleY: number;
  laneX: number;
  footX: number;
  mouthY: number;
  busy: { drive: boolean; aisle: boolean };
  waiting: number;
  onRoad: boolean;
  mouth: boolean;
}

/**
 * Машина на улице и её полоса (верхняя — к магазину, едут вправо). slow — тащится или встанет у магазина
 * (автобус, фургон, мусоровоз): сзади её не догонят, но и она не разгонится, пока снова не тронется.
 */
export interface RoadCar {
  obj: Phaser.GameObjects.Container;
  lane: 'up' | 'down';
  slow: boolean;
}

/** Парковка за магазином: 5 мест в два ряда (по краям — островки), справа — въезд с проезда вдоль правой стены. */
export const LOT = { w: 226, h: 96, top: -160, bay: 33, bays: 5 };
export const LOT_DRIVE_END = 36;
/** Соседний магазин справа: отступ от зала (за проездом к парковке) и ширина. */
export const SIDE_SHOP_X = 40;
export const SIDE_SHOP_W = 126;

export const CAR_COLORS = [0xe43b44, 0x0099db, 0x3e8948, 0xfeae34, 0xc0cbdc, 0x68386c, 0x262b44];
export const STAFF_SPEED = 60;
/** Соседка Валентина заходит раз в день — в вишнёвой кофте и с седыми волосами. */
export const VALYA: Look = { shirt: 0xa22633, skin: 0xeec39a, pants: 0x68386c, hair: 0xc0cbdc, style: 'curly' };
/** Персонажи сюжета — как на портретах. */
export const GRANDMA: Look = { shirt: 0x68386c, skin: 0xf2d3ab, pants: 0x3a4466, hair: 0xd8d8e0, style: 'bun', glasses: true };
/** На какой секунде дня приходит инспектор. */
export const INSPECTOR_AT = 25;
/** Соня заходит после школы — на этой секунде дня. */
export const SONYA_AT = 18;
/** Праздничный гость по настоящему календарю (game/live.ts) заходит на этой секунде дня. */
export const LIVE_GUEST_AT = 30;
/** Жюри конкурса приходит на этой секунде дня. */
export const JURY_AT = 40;
export const SKINS = [0xf2d3ab, 0xd9a066, 0x8f563b, 0xeec39a];

export interface Customer {
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
  regular?: RegularId | ZarRegularId;
  /** Друг из Telegram зашёл в гости (platform/multiplayer.ts → visits). */
  friend?: VisitFriend;
  wants?: ProductId[];
  /** Первый покупатель нового начала: берёт одно, без туалета и мусора — и сразу к кассе. */
  first?: boolean;
  /** Шоколадка со стойки и кофе — оплачиваются на кассе вместе с товаром. */
  extras?: { kind: 'candy' | 'coffee' | 'dish'; price: number; dish?: DishId }[];
  /** Уже погладил кота. */
  petted?: boolean;
  /** Сколько готов ждать в очереди. */
  patienceMs?: number;
  /** В длинной очереди стоит чуть левее (1) или ровно (0): через одного, по порядку прихода. */
  queueSide?: number;
  /** Приехал на машине: после покупок идёт к ней на парковку и уезжает. */
  car?: ParkSpot;
}

/** Касса: где стоит стол, покупатель и кассир, кого пробивают и полоска пробивки. */
export interface Register {
  counter: { x: number; y: number };
  spot: { x: number; y: number };
  clerk: { x: number; y: number };
  /** Кто подошёл к этой кассе (идёт к ней, ждёт или уже пробивается). */
  customer: Customer | null;
  scan: { start: number; total: number; byOwner: boolean; cut?: number } | null;
  bar: Phaser.GameObjects.Rectangle;
  fill: Phaser.GameObjects.Rectangle;
  screen: Phaser.GameObjects.Rectangle;
  beam: Phaser.GameObjects.Rectangle;
  /** Сам аппарат: вздрагивает на каждом пробитом товаре. */
  img?: Phaser.GameObjects.Image;
  /** Сколько мс пробивки срезали касания хозяина (у кассы хозяина, когда за ней сменщик). */
  hurry: number;
}

/** Касса самообслуживания: картинка, экран и занята ли она. */
export interface Kiosk {
  img: Phaser.GameObjects.Image;
  screen: Phaser.GameObjects.Rectangle;
  busy: boolean;
}

/** Печь: что в ней и всё, что её рисует. */
export interface Oven {
  img: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Rectangle;
  bread: Phaser.GameObjects.Image;
  bar: Phaser.GameObjects.Rectangle;
  fill: Phaser.GameObjects.Rectangle;
  /** Ореол «хлеб готов». */
  halo?: Halo;
  state: 'idle' | 'baking' | 'ready';
  start: number;
  timer?: Phaser.Time.TimerEvent;
  /** Противень для соседних магазинов (договор «Хлеб соседям»): не в зал, а на продажу. */
  forShops?: boolean;
  /** Что в печи: хлеб или своя выпечка «От бабушки». */
  product: ProductId;
}

/**
 * Кухня во флигеле: плита с кастрюлями, стол повара с ножом, витрина-раздача, ящик-кладовая.
 * Что сейчас варится (и несут на полку), уже взято из кладовой: при перестройке зала оно сразу встаёт
 * на полку «Еда» (flushCooking).
 */
export interface KitchenView {
  stove: Phaser.GameObjects.Image;
  /** Кастрюли (сковороды) на конфорках и огонь под ними — видны, пока варится. */
  pots: Phaser.GameObjects.Image[];
  flames: Phaser.GameObjects.Rectangle[];
  knife: Phaser.GameObjects.Image;
  crate: Phaser.GameObjects.Image;
  showcase: Phaser.GameObjects.Image;
  plates: Phaser.GameObjects.Image[];
  cooking: DishId[];
  /** Сваренное стоит на раздаче, пока повар не переложит его на поднос. */
  onPass: boolean;
  /** Пар над кастрюлями: снять, когда сварилось. */
  stopSteam?: () => void;
}

/** Ночью заходят таксисты, студенты и полуночники — в тёмном. */
export const NIGHT_SHIRTS = [0x262b44, 0x3a4466, 0x45444f, 0x68386c, 0x124e89, 0x5a6988];

export interface Worker {
  member: StaffMember;
  sprite: Phaser.GameObjects.Container;
  carried: Phaser.GameObjects.Image;
  home: { x: number; y: number };
}

/**
 * Убрать вещь события или рекламы: картинку — уничтожить, таймер — снять с часов. Сам destroy()
 * у таймера только обнуляет колбэк, а таймер остаётся в часах сцены навсегда (повторяющийся — крутится
 * впустую, разовый так и не «срабатывает»): с каждой перестройкой (applyAds) их копилось бы больше.
 */
export const discard = (obj: { destroy: () => void }): void => (obj instanceof Phaser.Time.TimerEvent ? obj.remove() : obj.destroy());

/** Кто из персонала: роль и имя (друг из Telegram — по id). Новый человек на ту же роль — другой ключ. */
export const staffKey = (m: StaffMember): string => `${m.role}:${m.friend ? `f${m.friend.id}` : m.name}`;

export interface ShelfView {
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
  glow?: Halo;
  needsStock: boolean;
  /** Шкала запаса у боковой полки: товар на ней сбоку не разглядеть, а шкалу видно сразу. */
  meter?: Phaser.GameObjects.Graphics;
}

/** Штука на полке, которую только что сняли: откуда и какой она была — из неё товар и летит в руки. */
export interface TakenSpot {
  x: number;
  y: number;
  texture: string;
  scale: number;
  tint: number;
}

/** Украшение кроны дерева и где оно относительно основания дерева. */
export interface CrownPart {
  obj: Phaser.GameObjects.RenderTexture | Phaser.GameObjects.Rectangle;
  dx: number;
  dy: number;
}

export interface NightLight {
  obj: Phaser.GameObjects.Image | Phaser.GameObjects.Text | Phaser.GameObjects.Rectangle | Phaser.GameObjects.Ellipse;
  /** Яркость к ночи. */
  alpha: number;
  /** Неон зажигается с мерцанием; у одной вывески общее число — мигает вся разом. */
  neon?: number;
  /** С какой «вечерности» зажигается (окна домов загораются не разом). */
  from?: number;
  /** Мерцает (звёзды в пруду, светлячки): своя фаза. */
  twinkle?: number;
  /** Свет фонаря (конус, ореол, пятно на земле): горит и мигает вместе с ним. */
  lamp?: Lamp;
  /** Свой цвет света фонаря: только что зажёгшись, он оранжевый и теплеет до этого цвета. */
  tint?: number;
  /** Огонь самого магазина (витрины, вывеска, свет из двери): отключили электричество — гаснет. */
  store?: boolean;
  /** Свет в карте освещения (nightGlow с map): его сила — яркость × gain, а сама картинка видна только дымкой (× haze). */
  light?: Light;
  gain?: number;
  haze?: number;
}

/**
 * Фонарь: загорается, когда вечер дошёл до его очереди (вдоль улицы — по одному, будто идёт
 * фонарщик), пару раз мигнув и с искрой над плафоном.
 */
export interface Lamp {
  /** Где плафон. */
  x: number;
  y: number;
  /** С какой «вечерности» горит. */
  from: number;
  /** Фонарь у тротуара магазина: вокруг него летают мотыльки, в мокром асфальте — отражение. */
  street: boolean;
  /** Когда зажёгся (time.now); не горит — undefined. */
  litAt?: number;
  /** Свет уже из оранжевого стал жёлтым — тинт больше не трогаем. */
  warm?: boolean;
}

export interface Pigeon {
  img: Phaser.GameObjects.Image;
  home: { x: number; y: number };
  away: boolean;
}

/** Шаг дела продавца: дойти до точки, подождать, сделать действие. */
export interface ChoreStep {
  x: number;
  y: number;
  ms?: number;
  /** Дошёл до точки (до паузы ms): например, начать укладывать заказ в коробку. */
  arrive?: () => void;
  action?: () => void;
}

/** Принятый заказ на дом: что везти, когда позвонили (игровые секунды, playTime) и где он сейчас. */
export interface Parcel {
  order: HomeOrder;
  calledAt: number;
  /** wait — ждёт сборки, packing — собирают, ready — коробка у двери, riding — едет с курьером. */
  stage: 'wait' | 'packing' | 'ready' | 'riding';
  /** Сколько штук уже в коробке (плашка «📦 Собираем 2/5»). */
  packed: number;
  /** Коробка у двери, пока ждёт курьера. */
  box?: Phaser.GameObjects.Image;
  /** Чаевые: считаются, когда курьер у клиента. */
  tip?: number;
}
/** Метка в seenTips: первый звонок с карточкой уже был (до него подсказка внизу — подробнее). */
export const CALL_CARD_TIP = 'deliveryCard';
/** Метка в seenTips: первый сгнивший мусор уже убрали (до этого внизу подсказка про запах). */
export const ROT_TIP = 'rot';
