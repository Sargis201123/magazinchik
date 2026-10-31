// Общее для сцены магазина (StoreScene.ts) и её модулей: размеры и глубины мира, цвета, внешность людей,
// типы покупателя, полки и машины, мелкие помощники без состояния. Здесь нет ничего, что знает о сцене:
// всё, чему нужна сцена, — в её модулях (карта — docs/ARCHITECTURE.md).

import Phaser from 'phaser';
import { DAY_SECONDS, type CartItem, type Category, type ProductId, type StaffMember, type StaffRole, type StoreState } from '../game/economy';
import type { ClientId } from '../game/events';
import type { RareGuestId } from '../game/endless';
import type { TextKey } from '../i18n';
import type { Facing, Pace, Route } from './stride';
import { UI_FONT } from '../ui/dom';
import type { BigDayId } from '../game/bigday';
import { pickWear } from './archetypes';
import type { BackId, FaceId, HatId, OutfitId, PropId } from './wardrobe';
import { yearTime } from '../game/calendar';
import type { RegularId } from '../game/regulars';
import { activeDecor, type DecorId } from '../game/decor';
import type { GuestId } from '../game/live';
import type { VisitFriend } from '../platform/multiplayer';
import type { DishId } from '../game/kitchen';
import type { NightGuestId } from '../game/nightGuests';
import type { StreetSpan } from './placement';
import type { Light } from './light';
import { Halo } from './halo';
import type { EduardLook } from '../game/eduard';
import { orderUnits, type HomeOrder } from '../game/delivery';

// Холст — ровно по пикселям экрана, высотой от 9:16 до 9:20 ширины (platform/screen.ts, scenes/pixels.ts):
// на вытянутых телефонах картинка во весь экран, без пустых полос. Камера подбирает масштаб под магазин
// с флигелем, и в покое — по возможности ровный: пиксель рисунка — целое число пикселей экрана.
/** Сверху интерфейс (деньги, товар), снизу подсказки — магазин рисуем между ними (в базовых точках, × res). */
export const HUD_TOP = 140;
export const HUD_BOTTOM = 80;
/** Запас по бокам обычного кадра (в точках мира): наружная стена флигеля и правая стена не впритык к краю экрана. */
export const FRAME_PAD = 1;
/** Верх вывески над стеной магазина: под верхнюю панель — без полосы пустого газона. */
export const SIGN_TOP = -16;
/** Спрайты нарисованы с двойной детализацией (DETAIL в art/sprites.py): в мире они вдвое меньше своих пикселей. */
export const ART = 2;
/** Сколько улицы видно под зданием (в точках мира). */
export const STREET_VIEW = 40;
/** Сколько первых дней показывать обучение: стрелки и яркую подсказку. */
export const TUTORIAL_DAYS = 3;
/** Сколько мс видна подсказка «что дальше» в зале (если игрок так и не коснулся экрана). */
export const NUDGE_SHOW_MS = 7000;
/** Сколько штук на полке считается «почти пусто» — табличка «Осталось N». */
export const LOW_STOCK = 2;
/** Высота видимой крышки мебели (TOP в art/sprites.py, в точках мира). */
export const FURNITURE_TOP = 6;
/** На сколько выше по залу стоит следующая пара касс. */
/** Насколько далеко можно отвести камеру от магазина пальцем. */
export const CAMERA_REACH = 200;
/** Толщина наружных стен и высота фасада (в точках мира). */
export const WALL = 6;
export const FACADE_H = 10;
/**
 * Вид фасада по уровню магазина: ларёк в досках, кирпич, светлая плитка и стеклянный
 * супермаркет. У двух старших вместо навесиков над окнами — сплошной козырёк фирменного
 * цвета (у супермаркета — с подсветкой), главный навес над входом того же цвета.
 */
export const FACADE_STYLES: { texture: string; awning?: number; canopy?: number; led?: boolean }[] = [
  { texture: 'facade_wood', awning: 0x8fd16a },
  { texture: 'facade' },
  { texture: 'facade', awning: 0xfee761 },
  { texture: 'facade_tile', canopy: 0x3e8948 },
  { texture: 'facade_glass', canopy: 0x262b44, led: true },
  // Гипермаркет: светлые колонны, тёмное стекло, красный козырёк с подсветкой.
  { texture: 'facade_hyper', canopy: 0xa22633, led: true },
];
/** Пол по уровням помещения. */
export const FLOORS = ['floor', 'floor', 'floor2', 'floor2', 'floor3', 'floor3'];
/** Яркость пятен света от потолочных ламп на полу. */
export const LAMP_POOL_ALPHA = 0.09;
/** На сколько точек мира в стороны от магазина тянется карта освещения (дальше — ровный фон улицы). */
export const LIGHT_REACH = 560;
/** Фары в карте освещения: конус (ширина у дальнего края и длина, точки мира) и сила к ночи. */
export const HEADLIGHT = { w: 24, h: 50 };
export const HEADLIGHT_POWER = 1;
/** Потолочная лампа зала в карте освещения: размер пятна света (точки мира) и сила. */
export const HALL_LAMP = { w: 94, h: 74, power: 0.58 };
/** Цвет потолочных ламп: накаливания — тёплый, светодиодные (оборудование «Свет») — белее, но не синий. */
export const HALL_WARM = 0xff9c48;
export const HALL_LED = 0xffc88c;
/** Свет полок в карте освещения: тёплая подсветка товара и холодное свечение холодильников. */
export const SHELF_WARM = 0xffd8a0;
export const SHELF_COLD = 0x8cd0ff;
export const SHELF_MEAT = 0xffb4bc;
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
/** Плашка всплывающей надписи (в точках мира): поля, скругление, хвостик, высота значка вместо эмодзи. */
export const POPUP = { padX: 3, padY: 1.5, radius: 3, tail: 3, icon: 9, gap: 0.5, font: '8.5px' };

/** Здание по соседству; back — отступ от тротуара (у кафе перед ним веранда). */
/** Особая крыша: вертолётная площадка, красный крест, бельё, солнечные панели (art/rooftops.py). */
export type RoofKit = 'office' | 'clinic' | 'dorm' | 'school';
export type Neighbor = { x: number; w: number; h: number; name: TextKey; label?: string; sign: number; awning: number; roof: number; neon: number; dark?: boolean; back?: number; roofKit?: RoofKit };

/** Помещение конкурента: пустует, «МегаМарт» по сюжету, а после сюжета — боссы района по очереди. */
export const RIVAL_LOOKS: Record<EduardLook, Omit<Neighbor, 'x' | 'w'>> = {
  vacant: { h: 130, name: 'eduard.stage0', sign: 0x5a6988, awning: 0x8b9bb4, roof: 0xc0cbdc, neon: 0, dark: true },
  mega: { h: 140, name: 'eduard.mega', sign: 0x124e89, awning: 0x0099db, roof: 0xc4d0ec, neon: 0x6cd8ff },
  kiosk: { h: 110, name: 'eduard.stage1', sign: 0x68386c, awning: 0xb55088, roof: 0xe0c8dc, neon: 0xff8ad8 },
  discount: { h: 145, name: 'eduard.stage2', sign: 0xb13e53, awning: 0xfee761, roof: 0xf2e6c8, neon: 0xffd040 },
  farm: { h: 135, name: 'eduard.stage3', sign: 0x3e8948, awning: 0x63c74d, roof: 0xd8e4c0, neon: 0x9cff7a },
  mall: { h: 190, name: 'eduard.stage4', sign: 0xa22633, awning: 0xe43b44, roof: 0xf2e6c8, neon: 0xffd040, roofKit: 'office' },
};

/** Друзья в гостях: сколько за день, чаевые за уровень их магазина, подарок за угощение (как на сервере). */
export const FRIEND_VISITS = 2;
export const FRIEND_TIP = 40;
export const FRIEND_GIFT = 300;

/** Деревья сквера: обычное чаще, остальные для разнообразия. */
/** Слои, у которых есть кадры взмаха рук при ходьбе (art/walk.py). */
export const SWING_LAYERS = new Set(['p_shirt', 'p_skin', 'p_skin_happy', 'p_skin_frown']);
export const PARK_TREES = ['tree', 'tree', 'tree_round', 'tree_birch', 'tree_pine'];

/** Высота здания босса за дорогой: умещается на месте «Гиганта». */
export const RIVAL_ACROSS_H = 106;

/** Порыв ветра: как быстро волна идёт по кварталу (px/с), сколько длится наклон дерева и на сколько градусов. */
export const GUST_SPEED = 140;
export const GUST_MS = 1400;
export const GUST_TILT = 4;

/** Слой света: выше людей и мебели, ниже всплывающих надписей (1000). */
export const LIGHT_DEPTH = 900;
/** Толчок: дрожь доходит до полки через x·QUAKE_WAVE_MS мс (слева направо), полка дрожит QUAKE_SHAKE_MS мс на ±QUAKE_SHAKE_PX. */
export const QUAKE_WAVE_MS = 1.5;
export const QUAKE_SHAKE_MS = 560;
export const QUAKE_SHAKE_PX = 0.8;
/** После волны: осколки улеглись — полки перерисовываются. */
export const QUAKE_SETTLE_MS = 700;
/** У скольких упавших штук самое большее разлетаются осколки (остальные просто бьются). */
export const QUAKE_SHATTER_MAX = 20;
/** Цвет пыли и штукатурки; крошки потемнее — их видно и на светлом полу. */
export const QUAKE_DUST = 0xc8b8a0;
export const QUAKE_GRIT = 0x8f7f6a;
/**
 * Что распаковывают из коробки, когда оно впервые появилось в зале: оборудование (терминал, касса
 * самообслуживания, радио, кассы, климат, камеры, склад, кофемашина, печь) и украшения.
 */
export const UNBOX =
  /^(card_terminal|kiosk\d?|radio|phone|counter\d|bin_t\d_0|fan_base|ac_wall|cam|air_curtain|mat_grate|autostore|pallet_jack|forklift|carts|coffee_machine\d?|cafe_table|oven\d?|rug|neon|plant_big|art_[a-z]+|light_(sconce|pendant|lantern|chandelier)|gumball|aquarium|lucky_cat|fountain|jukebox)$/;
/** Новинки распаковывают по очереди, с таким шагом. */
export const UNBOX_STEP = 350;
/** Флажок «НОВОЕ» висит над новинкой два часа по часам зала (смена идёт с 8:00 до 20:00). */
export const NEW_TAG_MS = (DAY_SECONDS * 1000 * 2) / 12;
/** С какой доли дня начинается вечер. */
export const EVENING_FROM = 0.72;
/** До какой доли дня музыка выбирает утренний трек (дальше — дневной, с вечера — вечерний). */
export const MUSIC_MORNING = 0.3;
/** Фонарь зажигается не сразу: яркость по шагам в 70 мс — вспыхнул, погас, ещё раз — и горит. */
export const LAMP_BLINK = [0.9, 0.9, 0.15, 0, 0, 0.75, 0.2, 0, 0, 0, 0.45, 0.85];
/** За сколько мс свет фонаря из оранжевого становится тёплым жёлтым. */
export const LAMP_WARMUP = 2500;
/** Стекло автомата утром: вспыхнуло, погасло, ещё раз — и разгорается (ease для твина 0→1). */
export const VENDING_BLINK = (k: number): number => (k < 0.12 ? 1 : k < 0.3 ? 0.08 : k < 0.42 ? 1 : k < 0.6 ? 0.15 : Math.min(1, (k - 0.6) / 0.25));


/** Холст для замеров: по ширине слов надпись со значками переносится по строкам. */
export let measureCtx: CanvasRenderingContext2D | null = null;

/** Ширина строки шрифтом всплывающих надписей (в точках мира). */
export function popupTextWidth(text: string): number {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * 4.5;
  measureCtx.font = `bold ${POPUP.font} ${UI_FONT}`;
  return measureCtx.measureText(text).width;
}
/** Сколько видов у каждого товара (item_bread_0…2 в art/sprites.py). */
export const ITEM_VARIANTS = 3;

/** Терпение в очереди. Отсчёт начинается, когда покупатель дошёл до очереди. */
export const PATIENCE_MS = 20_000;
/** Первый покупатель нового начала ждёт у кассы вчетверо дольше: новичок мог засмотреться. */
export const FIRST_PATIENCE = 4;
/**
 * Новое начало, первый день (секунды игры): когда входит первый покупатель, когда бабушка
 * здоровается, когда за ним придёт следующий и когда после первой продажи бабушка уходит на дачу.
 */
export const ONB_FIRST_AT = 0.6;
export const ONB_HELLO_AT = 0.9;
export const ONB_NEXT_GUEST = 8;
export const ONB_BYE_AFTER = 5.5;
/** Перед уходом бабушка показывает, что пробивать можно и касанием улицы: столько мс до прощания. */
export const ONB_ROAD_MS = 4500;
/** Бабушка ходит не спеша — медленнее сотрудников. */
export const GRANNY_SPEED = 42;
/** Первый день: покупатель в очереди, которого держит бабушка, ждёт ещё столько, а потом снова решает. */
export const GRANNY_PATIENCE_MS = 5000;
/** Первый день: сколько покупатель подождёт у пустой полки, пока бабушка несёт товар. */
export const GRANNY_SHELF_WAIT_MS = 12_000;
/** Касание улицы короче этого (мс) — нажатие; дольше — палец лежал или начинал жест. */
export const STREET_TAP_MS = 450;
export const CUSTOMER_SPEED = 40; // пикселей мира в секунду
export const SELLER_SPEED = 90;
/** С такой скорости человек уже бежит: подпрыгивает, наклоняется вперёд, из-под ног летит пыль. */
export const RUN_PACE = 65;
/** Пыли и брызг из-под ног одновременно не больше стольких (марафон — это толпа бегунов). */
export const MAX_DUST = 24;
/** Как часто покупатель у пустой кассы зовёт продавца. */
export const CALL_EVERY_MS = 3000;
/** Картинки киосков по модели (lanes.ts, KIOSK_TIERS), где у них экран (от центра) и чем он светится. */
export const KIOSK_SPRITES = ['kiosk', 'kiosk1', 'kiosk2'];
export const KIOSK_SCREEN = { x: 0, y: -5.5, w: 8, h: 5 };
export const KIOSK_GLOW = 0x2ce8f5;
export const KIOSK_ALARM = 0xe43b44;
/** Касание кассы, за которой сменщик, срезает столько мс пробивки; про запас — не больше стольких. */
export const RELIEF_TAP_MS = 250;
export const RELIEF_HURRY_MAX_MS = 1200;
/** Какую долю пробивки сменщика можно срезать касаниями (в симуляторе — RELIEF_TAPS). */
export const RELIEF_HURRY_SHARE = 0.3;

/** Полка «Уценка» (art/bargain_shelf.py, в точках мира): низ горки ниже точки места, высота цоколя и шаг рядов. */
export const BARGAIN_BOTTOM = 8;
export const BARGAIN_BASE = 6;
export const BARGAIN_STEP = 4;

export const TRASH_CHANCE = 0.15;
export const MAX_TRASH = 8;
/** Столько мусора на полу — и покупатели начинают жаловаться. */
export const TRASH_COMPLAINT = 3;
/** В дождь, грозу и снег столько покупателей приносят грязь на ногах. */
export const MUD_CHANCE = 0.15;
/** Больше двух грязных пятен разом не бывает — иначе гроза засыпает жалобами. */
export const MAX_MUD = 2;
export const MOP_MS = 1300;
/** Сколько мусора влезает в ведро. Полное ведро пахнет — покупатели жалуются, проверка снимает баллы. */
export const BIN_DROP_MS = 250;
/** Больше стольких ходок за одно касание полки продавец не делает (дальше — новое касание). */
export const MAX_RESTOCK_TRIPS = 4;
/** Завязать мешок и бросить его в контейнер на улице. */
export const BAG_MS = 600;
export const DUMP_MS = 450;
/** Покупатель иногда роняет покупку и разливает: молоко, сок, газировка. */
export const SPILL_CHANCE = 0.035;
export const SPILL_TINTS = [0xf4f8ff, 0xffb347, 0xb86f50];
export const SPILL_MOP_MS = 1700;
/** Когда (доли дня) случается мини-событие; если их два — первое до обеда, второе к вечеру. */
export const LIVE_WINDOW: [number, number] = [0.2, 0.6];
export const LIVE_WINDOWS: [number, number][] = [
  [0.15, 0.4],
  [0.55, 0.8],
];
/** Мини-событие ждёт, пока кончится прошлое, и не начинается, если до закрытия меньше этой доли дня. */
export const LIVE_RETRY_MS = 5000;
export const LIVE_LATEST = 0.1;
/** Автозаказ проверяет склад раз в столько секунд дня. */
export const AUTO_CHECK_SECONDS = 2;
/** Мышь грызёт товар раз в столько секунд; сама уходит через столько. */
export const MOUSE_BITE_MS = 4000;
export const MOUSE_STAY_MS = 25_000;
export const FIX_MS = 1600;
export const LEAK_FIX_MS = 2200;
/** Следующий покупатель обслужен за столько после предыдущего — серия продолжается. */
export const COMBO_WINDOW_MS = 7000;
export const COMBO_COLORS = ['#fee761', '#feae34', '#f77622', '#e43b44', '#b55088', '#2ce8f5'];
export const TOILET_CHANCE = 0.25;
export const TOILET_DIRT_PER_VISIT = 20;
export const TOILET_DIRTY = 60;
export const TOILET_CLEAN_MS = 1000;
export const TRASH_CLEAN_MS = 400;
export const PICKUP_MS = 500;
export const PLACE_MS = 400;
/**
 * Дорога за продуктами, нарезка и раздача — столько секунд на закладку сверх варки у повара обычной скорости
 * (у медленного — дольше). До закрытия меньше — новое не ставит; сколько ставить — по спросу после того, как сварится.
 */
export const COOK_LATE = 14;
/** Одна коробка на складе изображает минимум столько штук товара. */


export const SHELF_LOOK: Record<Category, { texture: string; tint: number }> = {
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
/** Плиточная вставка отдела под полкой — на плитке пола, под тенями живого пола (FLOOR_SHADE_DEPTH). */
export const DEPT_INLAY_DEPTH = 0.2;
/** Тени и потёртость пола (floor.ts): над плиткой и вставками, под пятнами света ламп (0.45). */
export const FLOOR_SHADE_DEPTH = 0.25;
/** Как часто смотрим, кто идёт по залу (мс времени игры): шаги для потёртости пола. */
export const WEAR_SAMPLE_MS = 250;
/** Уборщик без дела натирает самое потёртое место — не чаще, чем раз в столько мс, и если потёрто не меньше. */
export const POLISH_EVERY_MS = 9000;
export const POLISH_MIN_WEAR = 0.25;
/**
 * Реклама у входа (x от двери): съёмочная группа ТВ (оператор, камера, ведущая) и блогер — один или
 * звезда с фанатами. Первое место — обычное, следующие — если оно занято курьером или тележкой (freeStreetX).
 */
export const TV_SPOTS = [-48, 84, -100];
export const TV_SPAN: StreetSpan = [-5, 25];
export const STAR_SPOTS = [-20, 104, 136];
export const BLOGGER_SPAN: StreetSpan = [-5, 5];
export const COLLAB_SPAN: StreetSpan = [-19, 17];
/** Где на картинке лежит товар (относительно центра места): x, ширина, верхний ряд, шаг рядов. */
export const ITEM_AREA: Partial<Record<Category, { x: number; w: number; y: number; row: number }>> = {
  icebox: { x: -13, w: 26, y: -6, row: 4 },
};
/** Вёдра с цветами: в каждом ведре по три букета (заднее ведро выше). */
export const FLORIST_SPOTS = [
  [0, -9], [-2, -9.5], [2, -9.5],
  [-6.5, -3], [-8.5, -3.5], [-4.5, -3.5],
  [6.5, -3], [4.5, -3.5], [8.5, -3.5],
];
/** Белая рубашка под майкой бегуна: номер на груди — прорезь, в ней видна рубашка. */
export const WHITE_SHIRT = 0xffffff;
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
 * Свой шаг у походки: speed — во сколько раз быстрее обычного идёт своим ходом (когда не спешит
 * по делу), stride — во сколько раз шире шаг. Старик идёт медленно и мелко (ноги перебирают реже),
 * ребёнок — чуть быстрее и короче (семенит), спортсмен — бодро и широко.
 */
export const GAIT: Record<Gait, { speed: number; stride: number }> = {
  cane: { speed: 0.8, stride: 0.85 },
  elder: { speed: 0.92, stride: 0.9 },
  kid: { speed: 1.05, stride: 0.95 },
  sporty: { speed: 1.12, stride: 1.06 },
  bouncy: { speed: 1.05, stride: 1 },
};
/**
 * Разброс шага у каждого (от и до). Середина чуть выше единицы: медленных стариков уравновешивают
 * остальные, и в среднем покупатели ходят столько же, сколько прежде, — поток через кассу не меняется.
 */
export const OWN_SPEED: [number, number] = [0.93, 1.09];
/** Седые волосы (у пенсионеров, бабушек, Деда Мороза): по ним видно, что человек в годах. */
export const GREY_HAIR = new Set([0xd8d8e0, 0xc0cbdc, 0xffffff]);
/** Очередь теснее этого (точки мира) — встают ёлочкой, через одного на столько левее. */
export const QUEUE_SNUG = 12;
export const QUEUE_STAGGER = 5;
/** За сколько точек до двери покупатель сворачивает с тротуара ко входу (дуга поворота — половина). */
export const DOOR_TURN = 16;
/** Насколько в сторону от середины двери можно пройти проём (дверь — около 24 точек шириной). */
export const DOOR_EDGE = 8;
/** Поворот кругом (мс времени игры): на миг — промежуточная сторона, а не мгновенный разворот. */
export const TURN_MS = 90;
/** Как быстро отходит вбок, чтобы разойтись со встречным (точек мира в секунду). */
export const LANE_SPEED = 16;
/** Как часто заново смотрит, нет ли кого впереди (мс времени игры). */
export const LANE_EVERY = 110;
/**
 * Дошёл, а следующий путь начнётся тут же (обещание walk исполняется после кадра): столько мс
 * он ещё «идёт» — не приседает на каждом повороте и не сбивает шаг.
 */
export const STEP_GRACE = 40;

/**
 * Шаг человека — всё, что меняется каждый кадр, в одном объекте (а не в setData: тот на каждую
 * запись рассылает события). Кадр шага растёт с пройденным путём, а не по часам.
 */
export interface Stride {
  /** Кадр шага (дробный): 0…4 — два шага, растёт на пройденный путь. */
  phase: number;
  /** Где был в прошлом кадре: сколько прошёл. */
  lastX: number;
  lastY: number;
  /** Свой шаг: множители скорости (своим ходом) и ширины шага — у каждого чуть свои. */
  speed: number;
  stride: number;
  /** Каким по счёту шагом трогается: то с левой ноги, то с правой. */
  foot: number;
  /** Когда (время сцены) закончил прошлый путь и с какой скоростью шёл (точек в мс времени игры). */
  endAt: number;
  vel: number;
  /** Доля крейсерской скорости сейчас (разгон и торможение): наклон на бегу растёт с ней. */
  ratio: number;
  /** Кадр шага в прошлый раз: пыль и звук — один раз на шаг. */
  frame: number;
  /** Текущий путь: точки, скорость по нему, на каком отрезке и сколько прошло времени (мс игры). */
  route?: Route;
  pace?: Pace;
  seg: number;
  t: number;
  /** Сдвиг вбок от пути (разойтись со встречным): сейчас и куда тянется, когда снова посмотреть вперёд. */
  lane: number;
  laneGoal: number;
  laneAt: number;
  /** Направление пути сейчас: по нему другие решают, встречный это или попутчик. */
  dirX: number;
  dirY: number;
  /** Поворот кругом: какой стороной встать и когда (время пути). */
  turn?: { to: Facing; at: number };
  /** Глубина по высоте не как в зале (за зданием, на парковке, — своя); нет — глубина = y. */
  depthOf?: (y: number) => number;
}

export const gaitOf = (look: Look): Gait | undefined =>
  look.prop === 'cane'
    ? 'cane'
    : look.kid
      ? 'kid'
      : look.outfit === 'tracksuit' || look.outfit === 'runner'
        ? 'sporty'
        : look.hat === 'headphones'
          ? 'bouncy'
          : look.hair !== undefined && GREY_HAIR.has(look.hair)
            ? 'elder'
            : undefined;

/** Ночной сторож Михалыч: ушанка, ватник цвета хаки, седые усы, фонарик (как в art/security.py). */
export const WATCHMAN: Look = {
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

/** Форма персонала. */
export const STAFF_ACC: Record<StaffRole, { acc: Accessory; tint: number }> = {
  cashier: { acc: 'apron', tint: 0xffffff },
  cashier2: { acc: 'apron', tint: 0xffffff },
  cashier3: { acc: 'apron', tint: 0xffffff },
  cashier4: { acc: 'apron', tint: 0xffffff },
  cashier5: { acc: 'apron', tint: 0xffffff },
  cleaner: { acc: 'apron', tint: 0x5fcde4 },
  loader: { acc: 'vest', tint: 0xffffff },
  guard: { acc: 'badge', tint: 0xffffff },
  manager: { acc: 'tie', tint: 0xffffff },
  baker: { acc: 'apron', tint: 0xffffff },
  barista: { acc: 'apron', tint: 0x8f563b },
  cook: { acc: 'apron', tint: 0xffffff },
};
/** Тёмная кофта — так игрок может заметить вора. */
export const THIEF_SHIRT = 0x45444f;
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

/** Путь машины по прямой. */
export const straight = (x0: number, y0: number, x1: number, y1: number): Phaser.Curves.Path => new Phaser.Curves.Path(x0, y0).lineTo(x1, y1);
/** Поворот: плавная дуга от (x0, y0) к (x1, y1) через угол (cx, cy). */
export const bend = (x0: number, y0: number, cx: number, cy: number, x1: number, y1: number): Phaser.Curves.Path =>
  new Phaser.Curves.Path(x0, y0).quadraticBezierTo(x1, y1, cx, cy);
/**
 * Прямой участок: разгон от v0 до v на первых up точках, дальше ровно, на последних down — торможение
 * до v1 (поворотник turn мигает, пока тормозит). На коротком участке ровного куска нет.
 */
export function cruise(x0: number, y0: number, x1: number, y1: number, v0: number, v: number, v1: number, up: number, down: number, turn?: CarLeg['turn']): CarLeg[] {
  const length = Math.hypot(x1 - x0, y1 - y0);
  const speedUp = Math.min(up, length / 2);
  const slowDown = Math.min(down, length / 2);
  const at = (d: number): [number, number] => [x0 + ((x1 - x0) * d) / length, y0 + ((y1 - y0) * d) / length];
  const legs: CarLeg[] = [{ path: straight(x0, y0, ...at(speedUp)), v0, v1: v }];
  if (length - speedUp - slowDown > 0.5) legs.push({ path: straight(...at(speedUp), ...at(length - slowDown)), v0: v, v1: v });
  legs.push({ path: straight(...at(length - slowDown), x1, y1), v0: v, v1, turn });
  return legs;
}

/**
 * Отрезок пути машины: по прямой или дугой поворота (path), скорость равномерно меняется от v0 до v1
 * (точек мира в секунду), back — задним ходом, turn — какой поворотник мигает.
 */
export interface CarLeg {
  path: Phaser.Curves.Path;
  v0: number;
  v1: number;
  back?: boolean;
  turn?: 'left' | 'right';
}

/** Парковка за магазином: 5 мест в два ряда (по краям — островки), справа — въезд с проезда вдоль правой стены. */
export const LOT = { w: 226, h: 96, top: -160, bay: 33, bays: 5 };
/** Кто паркуется: легковые и фургоны (грузовики — только по улице). */
export const LOT_CARS = CAR_TYPES.filter(([key]) => key !== 'car_truck');
/**
 * Проезд к парковке — справа от зала (от его правого края, точки мира): дорожка для пешеходов вдоль
 * стены (FOOT…DRIVE), за ней асфальт шириной в машину с запасом (DRIVE…DRIVE_END), дальше — соседний дом.
 */
export const LOT_FOOT = 7;
export const LOT_DRIVE = 14;
export const LOT_DRIVE_END = 36;
/** Полоса тротуара перед въездом, которую переезжает машина: полкузова и шаг прохожего от середины въезда. */
export const LOT_MOUTH = 12;
/** Сколько у левой стены держим свободным у дверей флигеля (как iceboxSpotFor и roomZones). */
export const WING_DOOR_CLEAR = 32;
/** Соседний магазин справа: отступ от зала (за проездом к парковке) и ширина. */
export const SIDE_SHOP_X = 40;
export const SIDE_SHOP_W = 126;
/** Глубина машин и людей на парковке (за зданием глубина отрицательная): над асфальтом, под кронами. */
export const LOT_DEPTH = -9.41;
/** Скорости машины у парковки (точек мира в секунду): по улице, в проезде, по парковке, на месте. */
export const CAR_ROAD = 85;
export const CAR_DRIVE = 80;
export const CAR_LOT = 30;
export const CAR_CREEP = 12;
/** Сколько мест утром заняты машинами соседей (в лёгкой графике машин меньше). */
export const LOT_NEIGHBORS = 0.4;
export const LOT_NEIGHBORS_LITE = 0.25;
/** Сколько покупателей приезжает на машине, если на парковке есть место (в лёгкой графике — реже). */
export const CAR_CUSTOMERS = 0.5;
/** Позже этого (секунд до закрытия) на машине уже не приезжают: пока доедет и дойдёт — магазин закроется. */
export const CAR_LAST_SECONDS = 50;
/**
 * В какие особые дни к парковке можно проехать по улице: в наводнение, ремонт дороги, шествия,
 * съёмки, свадьбу, автобус туристов и ограбление улица занята — машины стоят, где стоят.
 */
export const LOT_ROAD_DAYS: BigDayId[] = ['heatwave', 'frost', 'quake', 'blackout', 'starfall', 'pigeons', 'sanitary', 'epidemic'];

export const CAR_COLORS = [0xe43b44, 0x0099db, 0x3e8948, 0xfeae34, 0xc0cbdc, 0x68386c, 0x262b44];
export const THIEF_SPEED = 52;
/** Форма сотрудников. */
export const UNIFORMS: Record<StaffRole, number> = { cashier: 0x5fcde4, cashier2: 0x5fcde4, cashier3: 0x5fcde4, cashier4: 0x5fcde4, cashier5: 0x5fcde4, cleaner: 0xfbf236, loader: 0xdf7126, guard: 0x306082, manager: 0xf4f4f4, baker: 0xf4f4f4, barista: 0x3e8948, cook: 0xf4f4f4 };
export const STAFF_SPEED = 60;
/** Глубина веранды перед кафе «Пончик». */
export const VERANDA_D = 28;
/** Сколько человек может ждать кофе сразу и что заказывают у стойки. */
export const COFFEE_WAITING = 3;
export const COFFEE_ORDERS: TextKey[] = ['popup.order1', 'popup.order2', 'popup.order3', 'popup.order4'];
/** Сколько кассир пробивает одного покупателя при обычной скорости. */
export const INSPECTOR_SHIRT = 0x222034;
/** Соседка Валентина заходит раз в день — в вишнёвой кофте и с седыми волосами. */
export const VALYA: Look = { shirt: 0xa22633, skin: 0xeec39a, pants: 0x68386c, hair: 0xc0cbdc, style: 'curly' };
/** Персонажи сюжета — как на портретах. */
export const GRANDMA: Look = { shirt: 0x68386c, skin: 0xf2d3ab, pants: 0x3a4466, hair: 0xd8d8e0, style: 'bun', glasses: true };
export const MARAT: Look = { shirt: 0xffffff, skin: 0xd9a066, pants: 0x262b44, hair: 0xffffff, style: 'cap' };
export const SCHOOL_COOK: Look = { shirt: 0x5fcde4, skin: 0xf2d3ab, pants: 0x3a4466, hair: 0xc0cbdc, style: 'cap', acc: 'apron' };
export const EDUARD: Look = { shirt: 0x3a4466, skin: 0xf2d3ab, pants: 0x262b44, hair: 0x181425, style: 'short', acc: 'tie' };
/** Аксессуары, которые видны только спереди. */
export const FRONT_ONLY = new Set(['acc_badge', 'acc_tie', 'acc_glasses', 'p_pat_print']);
export const GRANDMA_LINES_KEYS: TextKey[] = ['visit.grandma1', 'visit.grandma2', 'visit.grandma3'];
export const ORDER_GUESTS: Record<ClientId, [Look, TextKey]> = {
  chef: [MARAT, 'who.marat'],
  school: [SCHOOL_COOK, 'client.school'],
  valya: [VALYA, 'who.valya'],
};
export const OWNER: Look = { shirt: 0x8fd16a, skin: 0xf2d3ab, pants: 0x3a4466, hair: 0x4a2c1a, style: 'short' };
/** Наряды хозяина за звёзды (decor.ts, раздел «Наряд»). Должно совпадать с art/costumes.py. */
export const COSTUMES: Partial<Record<DecorId, Partial<Look>>> = {
  outfit_farmer: { hat: 'straw', outfit: 'overalls', pants: 0x3b5a9a },
  outfit_retro: { hat: 'papercap', outfit: 'soda', face: 'mustache', pants: 0x262b44 },
  outfit_tuxedo: { hat: 'silkhat', outfit: 'tuxedo', face: 'monocle', back: 'tails', pants: 0x181425 },
  outfit_cyber: { hat: 'cyberhelmet', outfit: 'cyber', back: 'jetpack', pants: 0x262b44 },
  // Эксклюзив звёздного пропуска (pass.ts, art/season.py).
  outfit_s1: { hat: 'leafcap', outfit: 'trench', pants: 0x4f2c17 },
  outfit_s2: { hat: 'pompom', outfit: 'nordic', pants: 0x262b44 },
};
export const ownerLook = (state: StoreState): Look => {
  const outfit = activeDecor(state, 'outfit');
  return { ...OWNER, ...(outfit ? COSTUMES[outfit.id] : {}) };
};
export const STAFF_HAIR: Record<StaffRole, HairStyle> = { cashier: 'long', cashier2: 'ponytail', cashier3: 'bun', cashier4: 'short', cashier5: 'curly', cleaner: 'short', loader: 'short', guard: 'cap', manager: 'short', baker: 'cap', barista: 'ponytail', cook: 'short' };
/** На какой секунде дня приходит инспектор. */
export const INSPECTOR_AT = 25;
/** Соня заходит после школы — на этой секунде дня. */
export const SONYA_AT = 18;
/** Соня: каштановые волосы, сиреневая толстовка, жёлтый рюкзак (как на портрете, art/family.py). */
export const SONYA: Look = { shirt: 0xffffff, skin: 0xf2d3ab, pants: 0x3a4466, hair: 0x8f563b, style: 'long', outfit: 'hoodie', outfitTint: 0x68386c, bag: 'backpack', bagTint: 0xfee761 };
/** Праздничный гость по настоящему календарю (game/live.ts) заходит на этой секунде дня. */
export const LIVE_GUEST_AT = 30;
/**
 * Праздничные гости: Дед Мороз — весь в красном, с белой бородой, меховым воротником и посохом;
 * Снегурочка — в голубом, с белым воротником, в диадеме и с косой. Шуба из гардероба (furcoat)
 * нарисована коричневой и в красный не красится — поэтому пуховик с оттенком (coat) и шарф-воротник.
 */
export const LIVE_GUEST_LOOKS: Record<GuestId, Look> = {
  moroz: { shirt: 0xe43b44, pants: 0xe43b44, coat: 0xe43b44, scarf: 0xffffff, hair: 0xffffff, style: 'bald', skin: 0xf2d3ab, hat: 'ushanka', hatTint: 0xe43b44, face: 'beard', faceTint: 0xffffff, prop: 'cane' },
  snegurochka: { shirt: 0x9cd8ff, pants: 0x9cd8ff, coat: 0x9cd8ff, scarf: 0xffffff, hair: 0xead4aa, style: 'long', skin: 0xf2d3ab, hat: 'tiara' },
};
/** Жюри конкурса приходит на этой секунде дня. */
export const JURY_AT = 40;
/** Жюри: строгие костюмы, у одного портфель, у другого блокнот (как у инспектора). */
export const JURY_LOOKS: Look[] = [
  { shirt: 0xffffff, skin: 0xf2d3ab, pants: 0x262b44, hair: 0xc0cbdc, outfit: 'suit', outfitTint: 0x3a4466, prop: 'briefcase', propTint: 0x733e39 },
  { shirt: 0xf6757a, skin: 0xeec39a, pants: 0x262b44, hair: 0x4a2c1a, style: 'long', outfit: 'suit', outfitTint: 0x68386c, face: 'sunglasses' },
  { shirt: 0xffffff, skin: 0xd9a066, pants: 0x181425, hair: 0x181425, outfit: 'suit', outfitTint: 0x265c42, prop: 'newspaper' },
];
export const BROKEN_TINT = 0x8a8a8a;
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
  regular?: RegularId;
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
/** Кот гуляет по залу раз в столько секунд (если захочет). */
export const CAT_WALK_EVERY = 18_000;
export const CAT_SPEED = 26;
/** Кот в зале живёт тиками по 130 мс: хвост, моргание, умывание. */
export const CAT_TICK = 130;
/** Кадры походки кота: лапы врозь, проходят мимо, врозь наоборот, снова мимо. */
export const CAT_WALK = ['cat_walk0', 'cat_walk2', 'cat_walk1', 'cat_walk3'];

export type TrashKind = 'trash' | 'mud' | 'spill';

export interface Worker {
  member: StaffMember;
  sprite: Phaser.GameObjects.Container;
  carried: Phaser.GameObjects.Image;
  home: { x: number; y: number };
}

/** Мелочь вещи (лопасти, огонёк, экран): прячется и появляется вместе с ней при распаковке. */
export type Kin = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible;

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

/** Штука, которую разбил толчок: какая картинка на полке и как она выглядела. */
export interface QuakeFall {
  img: Phaser.GameObjects.Image;
  key: string;
  x: number;
  y: number;
  scale: number;
  tint: number;
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

/** Как вечерний огонь ложится в карту освещения (nightGlow): своя картинка и размер, сила и дымка. */
export interface GlowMap {
  key?: string;
  w?: number;
  h?: number;
  /** Без своей картинки — во сколько раз свет больше самой картинки огня. */
  scale?: number;
  dy?: number;
  /** Сила света в карте относительно яркости огня. */
  gain?: number;
  /** Насколько видна сама картинка (дымка в воздухе): 0 — только свет в карте. */
  haze?: number;
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

/** Если позвонить некуда (курьеру некуда брать или телефон занят) — перезвонят через столько секунд. */
export const RETRY_CALL = 4;
/** Сколько мс укладывают одну штуку заказа в коробку (и ещё немного — закрыть и заклеить). */
export const PACK_UNIT_MS = 380;
export const PACK_CLOSE_MS = 450;
export const packMs = (order: HomeOrder): number => orderUnits(order) * PACK_UNIT_MS + PACK_CLOSE_MS;
/** Фургончик курьера — оранжевый, как его кепка. */
export const VAN_TINT = 0xf9a25c;
/** Метка в seenTips: первый звонок с карточкой уже был (до него подсказка внизу — подробнее). */
export const CALL_CARD_TIP = 'deliveryCard';
/** Метка в seenTips: первый сгнивший мусор уже убрали (до этого внизу подсказка про запах). */
export const ROT_TIP = 'rot';
