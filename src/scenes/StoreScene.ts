import Phaser from 'phaser';
import {
  BAD_COMPLAINT_CHANCE,
  buyChance,
  CARRY,
  canPlace,
  checkout,
  DAY_SECONDS,
  emptyDayStats,
  billTotal,
  guardCatchChance,
  staffOf,
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
  ownerScan,
  type ScanTiming,
  warehouseCapacity,
  type CartItem,
  type Category,
  type DayStats,
  type ProductId,
  type StaffMember,
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
  rankName,
  rankOf,
  RARE_GUESTS,
  RARE_TIP,
  rareGuestChance,
  seasonFor,
  type RareGuestId,
} from '../game/endless';
import { loadGame, saveGame } from '../game/save';
import { t } from '../i18n';
import { sound } from '../platform/sound';
import { haptic } from '../platform/telegram';
import { UI_FONT } from '../ui/dom';
import { Hud } from '../ui/hud';
import { showMorning } from '../ui/morning';
import { showTitle } from '../ui/title';
import { layoutFor, unitsPerBox, WAREHOUSE_COLS, type Layout } from './layout';

// Холст 720×1280 (9:16): на телефоне хватает пикселей для детальных спрайтов.
// Камера подбирает масштаб под размер магазина: ларёк крупно, универмаг мельче.
export const CANVAS_W = 720;
export const CANVAS_H = 1280;
/** Сверху интерфейс (деньги, товар), снизу подсказки — магазин рисуем между ними. */
const HUD_TOP = 200;
const HUD_BOTTOM = 80;
/** Спрайты нарисованы с двойной детализацией (DETAIL в art/sprites.py): в мире они вдвое меньше своих пикселей. */
const ART = 2;
/** Сколько улицы видно под зданием (в точках мира). */
const STREET_VIEW = 40;
/** Слой света: выше людей и мебели, ниже всплывающих надписей (1000). */
const LIGHT_DEPTH = 900;
/** Цвет света на улице и в зале по ходу дня: [доля дня, цвет]. Умножается на картинку. */
const OUTDOOR_LIGHT: [number, number][] = [
  [0, 0xffeccc],
  [0.3, 0xffffff],
  [0.65, 0xffe2b8],
  [0.85, 0xf2a878],
  [1, 0x7a80b8],
];
const INDOOR_LIGHT: [number, number][] = [
  [0, 0xfff6e6],
  [0.5, 0xffffff],
  [0.85, 0xfff0dc],
  [1, 0xe4d8ec],
];

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
};
const SHIRTS = [0x5b6ee1, 0xd95763, 0x6abe30, 0xfbf236, 0x76428a, 0xdf7126, 0x37946e, 0xf6757a, 0x2ce8f5];
const PANTS = [0x3a4466, 0x262b44, 0x5a6988, 0x733e39, 0x265c42];
const HAIR_COLORS = [0x4a2c1a, 0x181425, 0x733e39, 0xfeae34, 0xb86f50, 0x8b9bb4];
const HAIR_STYLES = ['short', 'short', 'long', 'long', 'bald', 'ponytail', 'curly'] as const;
type HairStyle = 'short' | 'long' | 'bun' | 'cap' | 'bald' | 'ponytail' | 'curly';
/** Поверх одежды: фартук (красится), жилет грузчика, значок охранника. */
type Accessory = 'apron' | 'vest' | 'badge';
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
}

const randomLook = (shirt: number): Look => ({
  shirt,
  skin: Phaser.Utils.Array.GetRandom(SKINS),
  pants: Phaser.Utils.Array.GetRandom(PANTS),
  hair: Phaser.Utils.Array.GetRandom(HAIR_COLORS),
  style: Phaser.Utils.Array.GetRandom([...HAIR_STYLES]),
});

/** Покупатели бывают разные: дети, пожилые, рабочие в касках и жилетах. */
function customerLook(shirt: number): Look {
  const look = randomLook(shirt);
  const roll = Math.random();
  if (roll < 0.14) return { ...look, kid: true, style: Phaser.Utils.Array.GetRandom(['short', 'ponytail', 'curly'] as const) };
  if (roll < 0.26) return { ...look, hair: Phaser.Utils.Array.GetRandom([0xd8d8e0, 0xc0cbdc]), style: Phaser.Utils.Array.GetRandom(['bun', 'bald', 'short'] as const) };
  if (roll < 0.33) return { ...look, style: 'cap', hair: 0xfeae34, acc: 'vest' };
  return look;
}

/** Форма персонала. */
const STAFF_ACC: Record<StaffRole, { acc: Accessory; tint: number }> = {
  cashier: { acc: 'apron', tint: 0xffffff },
  cleaner: { acc: 'apron', tint: 0x5fcde4 },
  loader: { acc: 'vest', tint: 0xffffff },
  guard: { acc: 'badge', tint: 0xffffff },
};
/** Тёмная кофта — так игрок может заметить вора. */
const THIEF_SHIRT = 0x45444f;
const CAR_COLORS = [0xe43b44, 0x0099db, 0x3e8948, 0xfeae34, 0xc0cbdc, 0x68386c, 0x262b44];
const THIEF_SPEED = 52;
/** Форма сотрудников. */
const UNIFORMS: Record<StaffRole, number> = { cashier: 0x5fcde4, cleaner: 0xfbf236, loader: 0xdf7126, guard: 0x306082 };
const STAFF_SPEED = 60;
/** Сколько кассир пробивает одного покупателя при обычной скорости. */
const INSPECTOR_SHIRT = 0x222034;
/** Соседка Валентина заходит раз в день — в вишнёвой кофте и с седыми волосами. */
const VALYA: Look = { shirt: 0xb13e53, skin: 0xf2d3ab, pants: 0x68386c, hair: 0xd8d8e0, style: 'bun' };
const OWNER: Look = { shirt: 0x8fd16a, skin: 0xf2d3ab, pants: 0x3a4466, hair: 0x4a2c1a, style: 'short' };
const STAFF_HAIR: Record<StaffRole, HairStyle> = { cashier: 'long', cleaner: 'short', loader: 'short', guard: 'cap' };
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
}

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
  pips: Phaser.GameObjects.Image[];
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
  private stats: DayStats = emptyDayStats();
  private hud!: Hud;
  private shelfViews: ShelfView[] = [];
  private boxes: Phaser.GameObjects.Image[] = [];
  private outdoorShades: Phaser.GameObjects.Rectangle[] = [];
  private indoorShade?: Phaser.GameObjects.Rectangle;
  private lampGlows: Phaser.GameObjects.Image[] = [];
  private ceilingGlows: Phaser.GameObjects.Image[] = [];
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
  /** Идёт пробивка: кто пробивает и когда закончит — для полоски над кассой. */
  private scanning: { start: number; total: number; byOwner: boolean } | null = null;
  private scanBar!: Phaser.GameObjects.Rectangle;
  private scanFill!: Phaser.GameObjects.Rectangle;
  private valyaCame = false;
  private nextSpawn = 1;
  private running = false;

  constructor() {
    super('store');
  }

  create(): void {
    const save = loadGame();
    this.state = ensurePlan(save ?? newGame());
    this.hud = new Hud();

    this.buildWorld();
    this.hud.update(this.state, this.timeLeft);
    // Улица живёт своей жизнью: прохожие и машины.
    this.time.addEvent({ delay: 1800, loop: true, callback: () => this.streetLife() });
    // Сначала вывеска, потом утро. Первая встреча с сюжетом (письмо бабушки) — на утреннем экране.
    showTitle({ save, onPlay: () => this.showMorning() });
  }

  update(_time: number, deltaMs: number): void {
    if (!this.running) return;
    const dt = deltaMs / 1000;
    this.timeLeft = Math.max(0, this.timeLeft - dt);

    const elapsed = DAY_SECONDS - this.timeLeft;
    const rushAt = this.state.plan?.rushAt;
    const rush = rushAt !== undefined && elapsed >= rushAt && elapsed < rushAt + RUSH_SECONDS;
    if (rush && !this.rushAnnounced) {
      this.rushAnnounced = true;
      haptic.tap();
      sound.bell();
      this.popup(this.layout.door.x, this.layout.door.y - 30, t('popup.rush'), '#fff3b0');
    }
    if (this.inspector === 'pending' && elapsed >= INSPECTOR_AT) void this.runInspector();

    if (this.timeLeft > 0) {
      this.nextSpawn -= dt;
      const maxCustomers = storeLevel(this.state).maxCustomers + (rush ? 3 : 0);
      if (this.nextSpawn <= 0 && this.customers.size < maxCustomers) {
        this.spawnCustomer();
        this.nextSpawn = (spawnIntervalToday(this.state) / (rush ? 2 : 1)) * Phaser.Math.FloatBetween(0.7, 1.3);
      }
    } else if (this.customers.size === 0 && this.inspector !== 'here') {
      this.finishDay();
    }

    for (const c of this.queue) this.updateBubble(c);
    this.updateScanBar();
    this.callSellerIfNeeded();
    this.hud.setHint(this.currentHint());
    this.updateLighting();
    this.hud.update(this.state, this.timeLeft, this.questsLine());
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
    if (this.inspector === 'here') return t('hint.inspector');
    if (!this.workers.has('guard') && [...this.customers].some((c) => c.thief && !c.gone)) return t('hint.thief');
    if (this.sellerBusy && !this.workers.has('cashier') && this.queue.length > 0) return t('hint.recall');
    if (!this.workers.has('cashier') && this.queue.length > 0 && this.state.day <= 2 && this.stats.served < 3) return t('hint.serve');
    if (this.state.day <= 4 && this.shelfNeedsRestock()) return t('hint.restock');
    if ((this.trash.size > 0 || this.toiletDirt >= TOILET_DIRTY) && this.state.day <= 4) return t('hint.clean');
    return '';
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
    this.tweens.killAll();
    this.shelfViews = [];
    this.boxes = [];
    this.slotDecor = [];
    this.trash.clear();
    this.layout = layoutFor(this.state.level);
    this.builtLevel = this.state.level;

    // Камера показывает и соседнюю площадь, куда магазин вырастет: ларёк выглядит маленьким.
    const next = STORE_LEVELS[this.state.level + 1] ? layoutFor(this.state.level + 1) : this.layout;
    this.next = next;
    // Внизу кадра видна улица: тротуар и дорога с машинами.
    const viewH = next.h + 24 + STREET_VIEW;
    const zoom = Math.min(CANVAS_W / (next.w + 16), (CANVAS_H - HUD_TOP - HUD_BOTTOM) / viewH);
    const midY = HUD_TOP + (CANVAS_H - HUD_TOP - HUD_BOTTOM) / 2;
    this.cameras.main.setZoom(zoom).centerOn(next.w / 2, viewH / 2 - 12 + (CANVAS_H / 2 - midY) / zoom);
    this.buildStreet(next);
    if (next !== this.layout) this.buildForRent(next);

    this.buildStore();
    this.buildLighting(next);
    this.refreshShelves();
    this.refreshWarehouse();
    this.refreshToilet();
    this.workers.clear();
    this.scanning = null;
    this.syncStaff();
  }

  private buildStore(): void {
    const { w, h, wallH, door, wc, counter, sellerHome } = this.layout;
    this.add.tileSprite(0, wallH, w, h - wallH, 'floor').setOrigin(0).setTileScale(1 / ART);
    this.add.tileSprite(0, 0, w, wallH, 'wall').setOrigin(0).setTileScale(1 / ART);
    const wallColor = 0x4a3b52;
    this.add.rectangle(-3, 0, 3, h, wallColor).setOrigin(0);
    this.add.rectangle(w, 0, 3, h, wallColor).setOrigin(0);
    this.add.rectangle(-3, h, door.x - 16 + 3, 3, wallColor).setOrigin(0);
    this.add.rectangle(door.x + 16, h, w - door.x - 16 + 3, 3, wallColor).setOrigin(0);
    this.art(door.x, h + 1, 'door');
    // Навес над входом: покупатели проходят под ним.
    this.art(door.x, h + 5, 'awning').setDepth(h + 40);
    // Вывеска с названием на крыше.
    this.art(w / 2, -9, 'sign').setDepth(2);
    this.add
      .text(w / 2, -9, t(storeLevel(this.state).nameKey), { fontFamily: UI_FONT, fontSize: '7px', color: '#fee761' })
      .setOrigin(0.5)
      .setResolution(4)
      .setDepth(3);
    this.buildWarehouse();
    this.buildDecor();

    this.wcDoor = this.art(wc.x, wc.y, 'wc');
    this.art(wc.x, wc.y - 15, 'bar').setDisplaySize(14, 3).setTint(0x2b2233);
    this.wcBar = this.art(wc.x - 7, wc.y - 15, 'bar').setOrigin(0, 0.5).setDisplaySize(0, 2);
    this.add
      .zone(wc.x, wc.y + 4, 24, 36)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.cleanToilet());

    this.art(counter.x + 2, counter.y + 3, 'shadow_wide').setScale(0.62, 0.7).setAngle(90).setDepth(counter.y + 19);
    this.art(counter.x, counter.y, 'counter').setDepth(counter.y + 20);
    // Полоска пробивки над кассой.
    this.scanBar = this.add.rectangle(counter.x - 9, counter.y - 31, 18, 4, 0x181425).setOrigin(0, 0.5).setDepth(1000).setVisible(false);
    this.scanFill = this.add.rectangle(counter.x - 8, counter.y - 31, 0, 2, 0x63c74d).setOrigin(0, 0.5).setDepth(1001).setVisible(false);
    void sellerHome;
    const home = this.ownerHome();
    this.seller = this.makePerson(home.x, home.y, OWNER);
    this.carried = this.art(0, 3, 'box').setVisible(false);
    this.seller.add(this.carried);
    this.add
      .zone(counter.x + 6, counter.y + 6, 40, 64)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.serveNext());
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
    this.outdoorShades = [
      shade(-far, -far, next.w + 2 * far, far - 3),
      shade(-far, h + 3, next.w + 2 * far, far + next.h),
      shade(-far, -3, far - 3, h + 6),
      shade(w + 3, -3, next.w + far, h + 6),
    ];
    this.indoorShade = shade(-3, -3, w + 6, h + 6);
    const glow = (x: number, y: number, size: number, color: number) =>
      this.art(x, y, 'glow').setScale(size / 64).setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(LIGHT_DEPTH + 1).setAlpha(0);
    this.lampGlows = [];
    for (let x = -28; x < next.w + 40; x += 72) {
      if (Math.abs(x - this.layout.door.x) > 20) this.lampGlows.push(glow(x, this.streetY - 2, 44, 0xffc860));
    }
    this.lampGlows.push(glow(this.layout.door.x, h + 8, 40, 0xffd890));
    this.ceilingGlows = [];
    for (let y = this.layout.wallH + 40; y < h - 10; y += 64) {
      for (let x = 34; x < w; x += 68) this.ceilingGlows.push(glow(x, y, 70, 0xfff0c8));
    }
    this.updateLighting(this.running ? undefined : 0);
  }

  /** Оттенок по ходу дня: тёплое утро, белый день, закат, сумерки. */
  private updateLighting(progress?: number): void {
    if (!this.indoorShade) return;
    const p = progress ?? Phaser.Math.Clamp(1 - this.timeLeft / DAY_SECONDS, 0, 1);
    const outdoor = lerpKeys(OUTDOOR_LIGHT, p);
    const indoor = lerpKeys(INDOOR_LIGHT, p);
    for (const r of this.outdoorShades) r.setFillStyle(outdoor);
    this.indoorShade.setFillStyle(indoor);
    const evening = Phaser.Math.Clamp((p - 0.6) / 0.4, 0, 1);
    for (const g of this.lampGlows) g.setAlpha(0.7 * evening);
    for (const g of this.ceilingGlows) g.setAlpha(0.06 + 0.16 * evening);
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
    tile(left, -400, width, top + 400, 'grass');
    tile(left, top, width, 22, 'paving');
    this.add.rectangle(left, top + 22, width, 2, 0x8b9bb4).setOrigin(0).setDepth(-9);
    tile(left, top + 24, width, 40, 'asphalt');
    for (let x = left; x < left + width; x += 24) this.add.rectangle(x, top + 43.5, 12, 1.5, 0xe6e1d6).setOrigin(0).setDepth(-9);
    this.add.rectangle(left, top + 64, width, 2, 0x8b9bb4).setOrigin(0).setDepth(-9);
    tile(left, top + 66, width, 22, 'paving');
    tile(left, top + 88, width, 300, 'grass');
    // Дорожка от двери до тротуара через пустой участок.
    if (top > h + 3) tile(door.x - 12, h + 3, 24, top - h - 3, 'paving');

    // Фонари вдоль тротуара (не на дорожке), скамейка и урна у входа.
    for (let x = -28; x < next.w + 40; x += 72) {
      if (Math.abs(x - door.x) > 20) this.art(x, top + 3, 'lamp').setOrigin(0.5, 0.95).setDepth(top + 3);
    }
    this.art(door.x + 44, top + 7, 'bench').setDepth(top + 7);
    this.art(door.x - 32, top + 6, 'bin').setDepth(top + 6);
    // Деревья и кусты на газоне вокруг здания.
    const trees: [number, number][] = [
      [-14, next.h * 0.35],
      [-16, next.h * 0.8],
      [next.w + 14, next.h * 0.3],
      [next.w + 16, next.h * 0.75],
      [next.w * 0.25, -12],
      [next.w * 0.75, -16],
    ];
    for (const [x, y] of trees) this.art(x, y, 'tree').setOrigin(0.5, 0.9).setDepth(y);
    for (let x = 10; x < next.w; x += 34) this.art(x, -6, 'bush').setDepth(-6);
  }

  /** Пустая соседняя площадь «Сдаётся» за забором — туда магазин вырастет при расширении. */
  private buildForRent(next: Layout): void {
    const { w, h, door } = this.layout;
    const cost = STORE_LEVELS[this.state.level + 1].cost;
    const tile = (x: number, y: number, ww: number, hh: number, key: string, depth = -5) =>
      this.add.tileSprite(x, y, ww, hh, key).setOrigin(0).setTileScale(1 / ART).setDepth(depth);
    if (next.w > w) tile(w + 3, 0, next.w - w - 3, next.h, 'lot', -8);
    if (next.h > h) tile(0, h + 3, w + 3, next.h - h - 3, 'lot', -8);
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
    const signX = next.w - w > 40 ? w + (next.w - w) / 2 : door.x + 44;
    const signY = next.w - w > 40 ? next.h / 2 : h + (next.h - h) / 2;
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
  private buildDecor(): void {
    const { w, h, wallH, wc, door, warehouse, slots } = this.layout;
    // На стене по очереди плакаты и окна, между ними часы.
    for (let x = 30, i = 0; x < wc.x - 16; x += 64, i++) this.art(x, 12, i % 2 ? 'window' : 'poster').setDepth(1);
    if (62 < wc.x - 16) this.art(62, 11, 'clock').setDepth(1);
    // Коврик у входа и автомат с напитками у правой стены.
    this.art(door.x, h - 7, 'mat').setDepth(1);
    this.art(w - 8, wallH + 56, 'vending').setDepth(wallH + 66);
    // Мягкая тень вдоль стены — пол уходит под неё.
    this.add.rectangle(0, wallH, w, 3, 0x181425, 0.18).setOrigin(0).setDepth(1);
    this.art(door.x + 26, h - 8, 'baskets').setDepth(h - 8);
    // Растения в свободных углах: у правой стены и в левом углу над складом — не на пути покупателей.
    const spots = [
      { x: w - 9, y: wallH + 14 },
      { x: 9, y: warehouse.y - 14 },
    ];
    for (const p of spots) {
      const busy = slots.some((s) => Math.abs(s.x - p.x) < 28 && Math.abs(s.y - p.y) < 24);
      if (!busy) this.art(p.x, p.y, 'plant').setDepth(p.y + 6);
    }
  }

  /** Центр ряда тары на складе: ряды стоят на балках стеллажа. */
  private warehouseRowY(row: number): number {
    return this.layout.warehouse.y + 16 + row * 8;
  }

  private buildWarehouse(): void {
    const { x, y, w, h, doorway } = this.layout.warehouse;
    const wallColor = 0x4a3b52;
    this.add.tileSprite(x, y, w, h, 'concrete').setOrigin(0).setTileScale(1 / ART);
    // Складской стеллаж: на каждой балке — ряд тары.
    for (let row = 0; row < this.layout.warehouse.rows; row++) {
      const rowY = this.warehouseRowY(row);
      this.art(x, rowY - 4, 'rack').setOrigin(0).setDepth(rowY - 101);
    }
    this.add.rectangle(x, y - 3, w + 4, 3, wallColor).setOrigin(0);
    // Правая стена с проёмом.
    this.add.rectangle(x + w, y, 4, doorway.y - 10 - y, wallColor).setOrigin(0);
    this.add.rectangle(x + w, doorway.y + 10, 4, y + h - doorway.y - 10, wallColor).setOrigin(0);
    this.add
      .text(x + w / 2, y + 6, t('warehouse.label'), { fontFamily: UI_FONT, fontSize: '6px', color: '#e6e1d6' })
      .setOrigin(0.5)
      .setResolution(4);
  }

  /** Создаёт картинки для новых полок и обновляет товар на всех. */
  private refreshShelves(): void {
    this.layout.slots.forEach((slot, i) => {
      this.slotDecor[i] ??= this.art(slot.x, slot.y, i % 2 ? 'promo' : 'pallet_water').setDepth(slot.y - 14);
      this.slotDecor[i].setVisible(i >= this.state.shelves.length);
    });
    this.state.shelves.forEach((shelf, i) => {
      let view = this.shelfViews[i];
      if (!view || view.kind !== shelf.kind) {
        view?.bg.destroy();
        view?.front.destroy();
        view?.shadow.destroy();
        view?.items.forEach((img) => img.destroy());
        view?.pips.forEach((img) => img.destroy());
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
      });
      view.pips.forEach((pip, n) => pip.setVisible(n < shelf.level));
      view.bg.setTint(shelf.broken ? BROKEN_TINT : SHELF_LOOK[shelf.kind].tint);
    });
  }

  private buildShelf(index: number, kind: Category): ShelfView {
    const slot = this.layout.slots[index];
    const look = SHELF_LOOK[kind];
    const shadow = this.art(slot.x, slot.y + 12, 'shadow_wide').setDepth(slot.y - 15);
    const bg = this.art(slot.x, slot.y, look.texture).setTint(look.tint).setDepth(slot.y - 14);
    const front = this.art(slot.x, slot.y, `${look.texture}_front`).setDepth(slot.y - 12);
    bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.restockShelf(index));
    const items = Array.from({ length: 16 }, () => this.art(slot.x, slot.y, 'item').setDepth(slot.y - 13));
    // Уровень улучшения — жёлтые точки над полкой.
    const pips = [0, 1].map((n) => this.art(slot.x - 17 + n * 4, slot.y - 15, 'pip').setDepth(slot.y - 12));
    return { kind, bg, front, shadow, items, pips };
  }

  private refreshWarehouse(): void {
    // На складе помещается ~30 коробок: в большом складе одна коробка изображает больше штук.
    const perBox = unitsPerBox(warehouseCapacity(this.state));
    const boxes = PRODUCT_IDS.flatMap((id) =>
      Array.from({ length: Math.ceil((this.state.warehouse[id]?.length ?? 0) / perBox) }, () => id),
    ).slice(0, WAREHOUSE_COLS * this.layout.warehouse.rows);
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
    parts.push(skin, hair);
    const person = this.add.container(x, y, parts).setDepth(y);
    if (look.kid) person.setScale(0.8);
    person.setData('legs', legs);
    person.setData('layers', layers);
    person.setData('facing', 'down');
    return person;
  }

  /** Поворот: спереди, со спины или боком (левый бок — зеркальный правый). Значок охранника виден только спереди. */
  private setFacing(person: Phaser.GameObjects.Container, facing: Facing): void {
    if (person.getData('facing') === facing) return;
    person.setData('facing', facing);
    const suffix = VIEW_SUFFIX[facing];
    const layers = person.getData('layers') as [Phaser.GameObjects.Image, string][] | undefined;
    for (const [img, base] of layers ?? []) {
      if (base === 'acc_badge') {
        img.setVisible(facing === 'down');
        continue;
      }
      img.setTexture(base + suffix).setFlipX(facing === 'left');
    }
    const legs = person.getData('legs') as Phaser.GameObjects.Image | undefined;
    legs?.setTexture(`p_legs0${suffix}`).setFlipX(facing === 'left');
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
    if (this.sellerBusy || this.scanning?.byOwner) return;
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
    this.carried.setVisible(false);
    haptic.tap();
    void this.returnSeller();
  }

  private async returnSeller(): Promise<void> {
    const id = this.choreId;
    const home = this.ownerHome();
    await this.walk(this.seller, home.x, home.y, SELLER_SPEED);
    if (id === this.choreId) this.sellerBusy = false;
  }

  /** Где стоит хозяин (игрок): за кассой, а если нанят кассир — рядом с ним. */
  private ownerHome(): { x: number; y: number } {
    const { sellerHome } = this.layout;
    return staffOf(this.state, 'cashier') ? { x: sellerHome.x, y: sellerHome.y - 24 } : sellerHome;
  }

  private callSellerIfNeeded(): void {
    const front = this.queue[0];
    if (this.workers.has('cashier') || !this.sellerBusy || !front || !this.isAtRegister(front)) return;
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
    const { doorway, pickup } = this.layout.warehouse;
    void this.doChore([
      { ...doorway },
      { ...pickup, ms: PICKUP_MS, action: () => this.carried.setVisible(true) },
      { ...doorway },
      {
        x: slot.x,
        y: slot.y + 20,
        ms: PLACE_MS,
        action: () => {
          this.carried.setVisible(false);
          this.state = moveToShelf(this.state, index, undefined, CARRY).state;
          this.refreshShelves();
          this.refreshWarehouse();
        },
      },
    ]);
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
        },
      },
    ]);
  }

  private dropTrash(x: number, y: number): void {
    if (this.trash.size >= MAX_TRASH) return;
    const piece = this
      .art(x + Phaser.Math.Between(-6, 6), y + Phaser.Math.Between(4, 8), 'trash')
      .setTint(Phaser.Utils.Array.GetRandom([0xe6e1d6, 0xd95763, 0x5b6ee1, 0xf2c14e]))
      .setDepth(1)
      .setInteractive(new Phaser.Geom.Rectangle(-5, -5, 16, 15), Phaser.Geom.Rectangle.Contains);
    piece.on('pointerdown', () => {
      if (this.claimedTrash.has(piece) || this.sellerBusy) return;
      this.claimedTrash.add(piece);
      void this.doChore([
        {
          x: piece.x + 6,
          y: piece.y,
          ms: TRASH_CLEAN_MS,
          action: () => this.removeTrash(piece),
        },
      ]);
    });
    this.trash.add(piece);
  }

  private removeTrash(piece: Phaser.GameObjects.Image): void {
    if (this.trash.has(piece)) this.stats.trashCleaned++;
    this.trash.delete(piece);
    this.claimedTrash.delete(piece);
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
    for (const member of this.state.staff) {
      if (this.state.plan?.sick === member.role) continue;
      const home = this.workerHome(member.role);
      const sprite = this.makePerson(home.x, home.y, {
        ...randomLook(UNIFORMS[member.role]),
        style: STAFF_HAIR[member.role],
        acc: STAFF_ACC[member.role].acc,
        accTint: STAFF_ACC[member.role].tint,
        hair: member.role === 'guard' ? UNIFORMS.guard : Phaser.Utils.Array.GetRandom(HAIR_COLORS),
      });
      const carried = this.art(0, 3, 'box').setVisible(false);
      sprite.add(carried);
      const worker: Worker = { member, sprite, carried, home };
      this.workers.set(member.role, worker);
      const loop = { cashier: this.cashierLoop, cleaner: this.cleanerLoop, loader: this.loaderLoop, guard: null }[member.role];
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
        return sellerHome;
      case 'cleaner':
        return { x: wc.x - 18, y: wc.spotY + 8 };
      case 'loader':
        return { x: warehouse.doorway.x + 6, y: warehouse.doorway.y - 18 };
      case 'guard':
        return { x: door.x + 22, y: door.y - 14 };
    }
  }

  private alive(gen: number): boolean {
    return gen === this.staffGen && this.scene.isActive();
  }

  /** Шаг сотрудника с учётом его скорости. */
  private workerWalk(w: Worker, x: number, y: number): Promise<void> {
    return this.walk(w.sprite, x, y, STAFF_SPEED * workSpeed(w.member));
  }

  private workerWait(w: Worker, ms: number): Promise<void> {
    return this.wait(ms / workSpeed(w.member));
  }

  /** Кассир сам пробивает очередь. */
  private async cashierLoop(w: Worker, gen: number): Promise<void> {
    while (this.alive(gen)) {
      const front = this.queue[0];
      if (!this.running || !front || !this.isAtRegister(front)) {
        await this.wait(200);
        continue;
      }
      if (front.serving || this.scanning) {
        await this.wait(100);
        continue;
      }
      await this.scanCustomer(front, cashierScan(w.member), false);
    }
  }

  /** Уборщик подбирает мусор, а когда его нет — моет туалет. */
  private async cleanerLoop(w: Worker, gen: number): Promise<void> {
    while (this.alive(gen)) {
      const piece = this.running ? this.nearestTrash(w.sprite.x, w.sprite.y) : undefined;
      if (piece) {
        this.claimedTrash.add(piece);
        await this.workerWalk(w, piece.x + 6, piece.y);
        if (!this.alive(gen)) return;
        await this.workerWait(w, TRASH_CLEAN_MS);
        if (piece.active) this.removeTrash(piece);
        continue;
      }
      if (this.running && this.toiletDirt >= 40) {
        await this.workerWalk(w, this.layout.wc.x, this.layout.wc.spotY);
        if (!this.alive(gen)) return;
        await this.workerWait(w, TOILET_CLEAN_MS);
        this.toiletDirt = 0;
        this.refreshToilet();
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
      this.state = moveToShelf(this.state, index, undefined, CARRY).state;
      this.refreshShelves();
      this.refreshWarehouse();
    }
  }

  /** Полка, которую стоит пополнить: место есть, а на складе есть подходящий товар. */
  private shelfToRestock(): number {
    let best = -1;
    let bestFree = 0;
    this.state.shelves.forEach((shelf, i) => {
      if (shelf.broken) return;
      const free = shelfFree(shelf);
      const hasGoods = PRODUCT_IDS.some((id) => canPlace(id, shelf) && (this.state.warehouse[id] ?? []).some((u) => !u.pending));
      const runningOut = PRODUCT_IDS.some(
        (id) => canPlace(id, shelf) && (shelf.items[id]?.length ?? 0) === 0 && (this.state.warehouse[id]?.length ?? 0) > 0,
      );
      if (hasGoods && (free >= 3 || (runningOut && free > 0)) && free > bestFree) [best, bestFree] = [i, free];
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

    const result = inspect(this.state, { trash: this.trash.size, toiletDirt: this.toiletDirt });
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
    const thief = Math.random() < thiefChance(this.state.level);
    const valya = !thief && !this.valyaCame && this.state.day > 1 && Math.random() < 0.15;
    const shirt = thief ? THIEF_SHIRT : valya ? VALYA.shirt : Phaser.Utils.Array.GetRandom(SHIRTS);
    const rare = !thief && !valya && Math.random() < rareGuestChance(this.state.level) ? pickRareGuest(this.state, Math.random) : null;
    const look = rare
      ? rare.look
      : valya
        ? VALYA
        : thief
          ? { ...randomLook(shirt), style: 'long' as const, hair: THIEF_SHIRT }
          : customerLook(shirt);
    const start = this.streetSpawn();
    const sprite = this.makePerson(start.x, start.y, look);
    if (rare) {
      sound.bell();
      this.time.delayedCall(1500, () => this.popup(sprite.x, sprite.y - 16, t('popup.rareGuest', { name: `${rare.icon} ${t(rare.nameKey)}` }), '#fee761'));
    }
    if (valya) {
      this.valyaCame = true;
      this.time.delayedCall(1500, () => this.popup(sprite.x, sprite.y - 16, t('popup.valya'), '#fff3b0'));
    }
    const bubble = this.art(0, -14, 'bubble').setVisible(false);
    sprite.add(bubble);
    const customer: Customer = { sprite, bubble, items: [], unhappy: false, waitStart: 0, gone: false, thief, rare: rare?.id };
    this.customers.add(customer);
    if (thief) {
      // Вора можно поймать касанием.
      sprite.setSize(16, 22).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.catchThief(customer, false));
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
    const wanted = pickWanted(this.state, Math.random, Phaser.Math.Between(1, 2));
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

    const wanted = pickWanted(this.state, Math.random, Phaser.Math.Between(1, 2));
    let disappointed = false;
    for (const id of wanted) {
      const index = shelfFor(this.state, id);
      if (index < 0) continue;
      const slot = this.layout.slots[index];
      await this.walk(c.sprite, slot.x + Phaser.Math.Between(-8, 8), slot.y + 22);
      await this.wait(500);
      const result = this.tryTake(c, id);
      if (result === 'empty' || result === 'expensive') {
        disappointed = true;
        this.emote(c.sprite, 'emo_question');
      }
    }

    if (Math.random() < TRASH_CHANCE) this.dropTrash(c.sprite.x, c.sprite.y);

    if (c.items.length === 0) {
      // Не нашёл товар или всё слишком дорого — ушёл недовольным, это бьёт по рейтингу.
      if (disappointed) this.stats.lost++;
      await this.leave(c);
      return;
    }

    if (Math.random() < TOILET_CHANCE) await this.visitToilet(c);

    this.queue.push(c);
    await this.walk(c.sprite, this.layout.queue.x, this.queueSpotY(this.queue.length - 1));
    if (c.gone) return;
    c.waitStart = this.time.now;
    c.bubble.setVisible(true);
    c.patience = this.time.delayedCall(PATIENCE_MS, () => void this.giveUp(c));
    this.layoutQueue();
  }

  /** Покупатель у полки: берёт товар, если он есть и цена устраивает. */
  private tryTake(c: Customer, id: ProductId): 'taken' | 'empty' | 'expensive' | 'skipped' {
    const index = shelfFor(this.state, id);
    if (this.state.shelves[index]?.broken) {
      this.popup(c.sprite.x, c.sprite.y - 14, t('popup.broken'), '#ffd0d0');
      return 'empty';
    }
    const oldest = this.state.shelves[index]?.items[id]?.[0];
    if (!oldest) {
      this.popup(c.sprite.x, c.sprite.y - 14, t('popup.noStock'), '#ffd0d0');
      return 'empty';
    }
    const price = unitSalePrice(this.state, id, oldest);
    const fair = perceivedBase(this.state, id);
    if (Math.random() >= buyChance(price, fair)) {
      if (price <= fair) return 'skipped';
      this.popup(c.sprite.x, c.sprite.y - 14, t('popup.expensive'), '#ffd0d0');
      return 'expensive';
    }
    const taken = takeFromShelf(this.state, index, id);
    if (!taken) return 'empty';
    this.state = taken.state;
    c.items.push({ id, unit: taken.unit });
    this.refreshShelves();
    return 'taken';
  }

  private async visitToilet(c: Customer): Promise<void> {
    await this.walk(c.sprite, this.layout.wc.x, this.layout.wc.spotY);
    if (this.toiletDirt >= 100) {
      c.unhappy = true;
      this.popup(c.sprite.x - 10, c.sprite.y - 14, t('popup.toiletAwful'), '#ffd0d0');
      return;
    }
    if (this.toiletDirt >= TOILET_DIRTY) c.unhappy = true;
    c.sprite.setVisible(false);
    await this.wait(1200);
    c.sprite.setVisible(true);
    this.toiletDirt = Math.min(100, this.toiletDirt + TOILET_DIRT_PER_VISIT);
    this.refreshToilet();
  }

  /** Касание кассы: начать пробивать первого в очереди или позвать продавца обратно. */
  private serveNext(): void {
    // Касса одна: если нанят кассир, пробивает он.
    if (this.workers.has('cashier') || this.scanning) return;
    if (this.sellerBusy) {
      this.recallSeller();
      return;
    }
    const c = this.queue[0];
    if (!c || c.serving || !this.isAtRegister(c)) return;
    haptic.tap();
    void this.scanCustomer(c, ownerScan(this.state.ownerServed), true);
  }

  /**
   * Пробивка: товары по одному уезжают по ленте, потом оплата. Время зависит от навыка
   * того, кто стоит за кассой (хозяин или кассир) и от размера корзины.
   */
  private async scanCustomer(c: Customer, timing: ScanTiming, byOwner: boolean): Promise<void> {
    c.serving = true;
    c.patience?.remove();
    c.bubble.setVisible(false);
    this.scanning = { start: this.time.now, total: checkoutSeconds(timing, c.items.length) * 1000, byOwner };
    const { counter } = this.layout;
    for (const { id } of c.items) {
      await this.wait(timing.item * 1000);
      if (!this.sys.isActive()) return;
      const item = this.art(c.sprite.x, c.sprite.y - 2, `item_${id}`).setScale(2 / ART).setDepth(1000);
      this.tweens.add({ targets: item, x: counter.x, y: counter.y - 14, alpha: 0.2, duration: 220, onComplete: () => item.destroy() });
      haptic.tap();
      sound.scan();
    }
    await this.wait(timing.pay * 1000);
    this.scanning = null;
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
    const scan = this.scanning;
    this.scanBar.setVisible(Boolean(scan));
    this.scanFill.setVisible(Boolean(scan));
    if (scan) this.scanFill.width = 16 * Math.min(1, (this.time.now - scan.start) / scan.total);
  }

  private finishCheckout(c: Customer): void {
    this.queue = this.queue.filter((q) => q !== c);

    const { state, total } = checkout(this.state, c.items);
    this.state = state;
    this.stats.revenue += total;
    this.stats.served++;
    recordSale(this.stats, c.items);
    if (c.rare) this.rareGuestServed(c, total);
    haptic.success();
    sound.coin();
    this.popup(this.layout.sellerHome.x - 8, this.layout.sellerHome.y - 18, `+${total} 💰`, '#c8ffb0');

    const dirty = this.trash.size >= TRASH_COMPLAINT;
    const badGoods = hasUnmarkedBad(c.items) && Math.random() < BAD_COMPLAINT_CHANCE;
    if (c.unhappy || dirty || badGoods) {
      this.stats.complaints++;
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
    c.bubble.setVisible(false);
    this.state = returnToShelf(this.state, c.items);
    c.items = [];
    this.refreshShelves();
    this.refreshWarehouse();
    this.stats.lost++;
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
      const person = this.makePerson(fromLeft ? left : right, y, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS)));
      void this.walk(person, fromLeft ? right : left, y, CUSTOMER_SPEED * Phaser.Math.FloatBetween(0.7, 1.1)).then(() => person.destroy());
    }
    if (Math.random() < 0.3) {
      const toRight = Math.random() < 0.5;
      const y = this.streetY + (toRight ? 24 : 42);
      const car = this.art(toRight ? left : right, y, 'car')
        .setTint(Phaser.Utils.Array.GetRandom(CAR_COLORS))
        .setFlipX(!toRight)
        .setDepth(y);
      this.tweens.add({ targets: car, x: toRight ? right : left, duration: Phaser.Math.Between(2600, 4000), onComplete: () => car.destroy() });
    }
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

  private layoutQueue(): void {
    this.queue.forEach((c, i) => void this.walk(c.sprite, this.layout.queue.x, this.queueSpotY(i)));
  }

  private isAtRegister(c: Customer): boolean {
    return Phaser.Math.Distance.Between(c.sprite.x, c.sprite.y, this.layout.queue.x, this.layout.queue.y) < 2;
  }

  private updateBubble(c: Customer): void {
    if (!c.bubble.visible) return;
    const left = 1 - (this.time.now - c.waitStart) / PATIENCE_MS;
    c.bubble.setTint(left > 0.6 ? 0x8fd16a : left > 0.3 ? 0xf2c14e : 0xd95763);
  }

  // ---------- Утилиты ----------

  /** Место в очереди: в тесном ларьке длинная очередь стоит плотнее, чтобы не упираться в полки. */
  private queueSpotY(index: number): number {
    const { y, step, minY } = this.layout.queue;
    const fit = this.queue.length > 1 ? (y - minY) / (this.queue.length - 1) : step;
    return y - index * Math.min(step, fit);
  }

  private walk(target: Phaser.GameObjects.Container, x: number, y: number, speed = CUSTOMER_SPEED): Promise<void> {
    this.tweens.killTweensOf(target);
    const legs = target.getData('legs') as Phaser.GameObjects.Image | undefined;
    const distance = Phaser.Math.Distance.Between(target.x, target.y, x, y);
    // Поворачивается туда, куда идёт.
    const dx = x - target.x;
    const dy = y - target.y;
    if (distance > 0.5) this.setFacing(target, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy < 0 ? 'up' : 'down');
    const suffix = VIEW_SUFFIX[(target.getData('facing') as Facing | undefined) ?? 'down'];
    return new Promise((resolve) => {
      this.tweens.add({
        targets: target,
        x,
        y,
        duration: (distance / speed) * 1000,
        onUpdate: () => {
          target.setDepth(target.y);
          // Шаги: ноги переставляются каждые 150 мс.
          legs?.setTexture(Math.floor(this.time.now / 150) % 2 ? `p_legs1${suffix}` : `p_legs0${suffix}`);
        },
        onComplete: () => {
          legs?.setTexture(`p_legs0${suffix}`);
          resolve();
        },
        onStop: () => resolve(),
      });
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  private popup(x: number, y: number, text: string, color: string): void {
    const label = this.add
      .text(x, y, text, { fontFamily: UI_FONT, fontSize: '8px', color, stroke: '#2b2233', strokeThickness: 2 })
      .setOrigin(0.5)
      .setResolution(4)
      .setDepth(1000);
    // Длинная надпись не должна вылезать за край магазина; и висит дольше, чтобы успеть прочитать.
    const half = label.width / 2 + 2;
    label.x = Phaser.Math.Clamp(x, half, Math.max(half, this.layout.w - half));
    const duration = Math.min(2600, 900 + 45 * text.length);
    this.tweens.add({ targets: label, y: y - 14, alpha: { from: 1, to: 0 }, ease: 'Quad.easeIn', duration, onComplete: () => label.destroy() });
  }

  // ---------- День ----------

  private showMorning(): void {
    this.hud.update(this.state, DAY_SECONDS);
    this.updateLighting(0);
    showMorning({
      getState: () => this.state,
      setState: (s) => {
        const staffChanged = s.staff !== this.state.staff;
        this.state = s;
        saveGame(s);
        if (s.level !== this.builtLevel) this.buildWorld();
        else if (staffChanged) this.syncStaff();
        this.refreshShelves();
        this.refreshWarehouse();
        this.hud.update(s, DAY_SECONDS);
      },
      onOpen: () => this.startDay(),
    });
  }

  private startDay(): void {
    this.scanning = null;
    this.inspector = this.state.plan?.inspection ? 'pending' : 'none';
    this.inspection = null;
    this.rushAnnounced = false;
    this.questsSeen = 0;
    this.valyaCame = false;
    this.syncStaff();
    const season = seasonFor(this.state.day);
    if (season) this.time.delayedCall(600, () => this.popup(this.layout.w / 2, this.layout.h / 2, `${season.icon} ${t(season.nameKey)}!`, '#fee761'));
    this.stats = emptyDayStats();
    this.timeLeft = DAY_SECONDS;
    this.nextSpawn = 1;
    this.toiletDirt = 0;
    this.refreshToilet();
    for (const piece of this.trash) piece.destroy();
    this.trash.clear();
    this.running = true;
  }

  private finishDay(): void {
    this.running = false;
    const finishedDay = this.state.day;
    const ratingBefore = this.state.rating;
    const rankBefore = rankOf(this.state.totalRevenue);
    const { state, spoiled, bill, shortfall, skimmed, order, quests } = nightCycle(this.state, this.stats);
    const extra: [string, string][] = [];
    if (quests.total) extra.push([t('summary.quests'), t('summary.questsValue', { done: quests.done, total: quests.total, n: quests.earned })]);
    const rankAfter = rankOf(state.totalRevenue);
    if (rankAfter > rankBefore) extra.push(['🏅', t('summary.rankUp', { name: rankName(rankAfter, t) })]);
    if (order) extra.push([t('summary.order'), order.delivered ? t('summary.orderDone', { n: order.earned }) : t('summary.orderFailed')]);
    if (this.inspection) {
      const r = this.inspection;
      extra.push([
        t('summary.inspection'),
        r.passed ? t('summary.inspectionPassed') : t('summary.inspectionFailed', { n: r.fine, problems: r.problems.map((p) => t(p)).join(', ') }),
      ]);
    }
    const promoted = state.staff !== this.state.staff;
    this.state = state;
    this.stats.spoiled = spoiled;
    this.stats.skimmed = skimmed;
    if (promoted) this.syncStaff();
    saveGame(this.state);
    this.refreshShelves();
    this.refreshWarehouse();
    this.hud.update(this.state, 0);
    sound.fanfare();
    this.hud.showSummary(
      finishedDay,
      this.stats,
      { before: ratingBefore, after: state.rating },
      { bill: bill && billTotal(bill), shortfall, total: state.money },
      extra,
      () => this.showMorning(),
    );
  }
}
