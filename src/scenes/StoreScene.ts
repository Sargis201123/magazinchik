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
  PRODUCTS,
  returnToShelf,
  sellableProducts,
  shelfCapacity,
  shelfFor,
  shelfFree,
  STORE_LEVELS,
  storeLevel,
  takeFromShelf,
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
import { loadGame, saveGame } from '../game/save';
import { t } from '../i18n';
import { haptic } from '../platform/telegram';
import { UI_FONT } from '../ui/dom';
import { Hud } from '../ui/hud';
import { showMorning } from '../ui/morning';
import { layoutFor, type Layout } from './layout';

// Холст 360×640. Камера подбирает масштаб под размер магазина: ларёк крупно, универмаг мельче.
export const CANVAS_W = 360;
export const CANVAS_H = 640;
/** Сверху интерфейс (деньги, товар), снизу подсказки — магазин рисуем между ними. */
const HUD_TOP = 100;
const HUD_BOTTOM = 40;

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
const UNITS_PER_BOX = 3;

const SHELF_LOOK: Record<Category, { texture: string; tint: number }> = {
  bakery: { texture: 'shelf', tint: 0xffffff },
  produce: { texture: 'stand', tint: 0xffffff },
  dairy: { texture: 'fridge', tint: 0xd8ecff },
  meat: { texture: 'fridge', tint: 0xffd6d6 },
};
const SHIRTS = [0x5b6ee1, 0xd95763, 0x6abe30, 0xfbf236, 0x76428a, 0xdf7126, 0x37946e, 0xf6757a, 0x2ce8f5];
const PANTS = [0x3a4466, 0x262b44, 0x5a6988, 0x733e39, 0x265c42];
const HAIR_COLORS = [0x4a2c1a, 0x181425, 0x733e39, 0xfeae34, 0xb86f50, 0x8b9bb4];
const HAIR_STYLES = ['short', 'short', 'long', 'long', 'bald'] as const;
type HairStyle = 'short' | 'long' | 'bun' | 'cap' | 'bald';

interface Look {
  shirt: number;
  skin: number;
  pants?: number;
  hair?: number;
  style?: HairStyle;
}

const randomLook = (shirt: number): Look => ({
  shirt,
  skin: Phaser.Utils.Array.GetRandom(SKINS),
  pants: Phaser.Utils.Array.GetRandom(PANTS),
  hair: Phaser.Utils.Array.GetRandom(HAIR_COLORS),
  style: Phaser.Utils.Array.GetRandom([...HAIR_STYLES]),
});
/** Тёмная кофта — так игрок может заметить вора. */
const THIEF_SHIRT = 0x45444f;
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
    this.state = ensurePlan(loadGame() ?? newGame());
    this.hud = new Hud();

    this.buildWorld();
    this.hud.update(this.state, this.timeLeft);
    // Первая встреча с сюжетом (письмо бабушки) показывается на утреннем экране.
    this.showMorning();
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
    this.hud.update(this.state, this.timeLeft);
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
    this.trash.clear();
    this.layout = layoutFor(this.state.level);
    this.builtLevel = this.state.level;

    // Камера показывает и соседнюю площадь, куда магазин вырастет: ларёк выглядит маленьким.
    const next = STORE_LEVELS[this.state.level + 1] ? layoutFor(this.state.level + 1) : this.layout;
    const zoom = Math.min(CANVAS_W / (next.w + 16), (CANVAS_H - HUD_TOP - HUD_BOTTOM) / (next.h + 24));
    const midY = HUD_TOP + (CANVAS_H - HUD_TOP - HUD_BOTTOM) / 2;
    this.cameras.main.setZoom(zoom).centerOn(next.w / 2, next.h / 2 + (CANVAS_H / 2 - midY) / zoom);
    // Улица под зданием.
    this.add.tileSprite(-208, next.h, next.w + 416, 208, 'asphalt').setOrigin(0);
    if (next !== this.layout) this.buildForRent(next);

    this.buildStore();
    this.refreshShelves();
    this.refreshWarehouse();
    this.refreshToilet();
    this.workers.clear();
    this.scanning = null;
    this.syncStaff();
  }

  private buildStore(): void {
    const { w, h, wallH, door, wc, counter, sellerHome } = this.layout;
    this.add.tileSprite(0, wallH, w, h - wallH, 'floor').setOrigin(0);
    this.add.tileSprite(0, 0, w, wallH, 'wall').setOrigin(0);
    const wallColor = 0x4a3b52;
    this.add.rectangle(-3, 0, 3, h, wallColor).setOrigin(0);
    this.add.rectangle(w, 0, 3, h, wallColor).setOrigin(0);
    this.add.rectangle(-3, h, door.x - 16 + 3, 3, wallColor).setOrigin(0);
    this.add.rectangle(door.x + 16, h, w - door.x - 16 + 3, 3, wallColor).setOrigin(0);
    this.add.image(door.x, h + 1, 'door');
    this.add
      .text(w / 2, -6, t(storeLevel(this.state).nameKey), { fontFamily: UI_FONT, fontSize: '8px', color: '#f2c14e' })
      .setOrigin(0.5)
      .setResolution(4);
    this.buildWarehouse();
    this.buildDecor();

    this.wcDoor = this.add.image(wc.x, wc.y, 'wc');
    this.add.image(wc.x, wc.y - 15, 'bar').setDisplaySize(14, 3).setTint(0x2b2233);
    this.wcBar = this.add.image(wc.x - 7, wc.y - 15, 'bar').setOrigin(0, 0.5).setDisplaySize(0, 2);
    this.add
      .zone(wc.x, wc.y + 4, 24, 36)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.cleanToilet());

    this.add.image(counter.x, counter.y, 'counter').setDepth(counter.y + 20);
    // Полоска пробивки над кассой.
    this.scanBar = this.add.rectangle(counter.x - 9, counter.y - 31, 18, 4, 0x181425).setOrigin(0, 0.5).setDepth(1000).setVisible(false);
    this.scanFill = this.add.rectangle(counter.x - 8, counter.y - 31, 0, 2, 0x63c74d).setOrigin(0, 0.5).setDepth(1001).setVisible(false);
    void sellerHome;
    const home = this.ownerHome();
    this.seller = this.makePerson(home.x, home.y, OWNER);
    this.carried = this.add.image(0, 3, 'box').setVisible(false);
    this.seller.add(this.carried);
    this.add
      .zone(counter.x + 6, counter.y + 6, 40, 64)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.serveNext());
  }

  /** Пустая соседняя площадь «Сдаётся» — туда магазин вырастет при расширении. */
  private buildForRent(next: Layout): void {
    const { w, h } = this.layout;
    const cost = STORE_LEVELS[this.state.level + 1].cost;
    if (next.w > w) this.add.tileSprite(w + 3, 0, next.w - w - 3, next.h, 'lot').setOrigin(0);
    if (next.h > h) this.add.tileSprite(0, h + 3, w + 3, next.h - h - 3, 'lot').setOrigin(0);
    this.add.rectangle(0, 0, next.w, next.h).setOrigin(0).setStrokeStyle(1, 0x8a8494);
    const signX = next.w > w ? w + (next.w - w) / 2 : w / 2;
    const signY = next.w > w ? next.h / 2 : h + (next.h - h) / 2;
    this.add
      .text(signX, signY, `${t('store.forRent')}\n${cost} 💰`, {
        fontFamily: UI_FONT,
        fontSize: '7px',
        color: '#c9c0ad',
        align: 'center',
      })
      .setOrigin(0.5)
      .setResolution(4);
  }

  /** Плакаты на стене, растения и корзинки у входа — чтобы зал не выглядел пустым. */
  private buildDecor(): void {
    const { w, h, wallH, wc, door, warehouse, slots } = this.layout;
    for (let x = 30; x < wc.x - 16; x += 64) this.add.image(x, 12, 'poster').setDepth(1);
    this.add.image(door.x + 26, h - 8, 'baskets').setDepth(h - 8);
    // Растения в свободных углах: у правой стены и в левом углу над складом — не на пути покупателей.
    const spots = [
      { x: w - 9, y: wallH + 14 },
      { x: 9, y: warehouse.y - 14 },
    ];
    for (const p of spots) {
      const busy = slots.some((s) => Math.abs(s.x - p.x) < 28 && Math.abs(s.y - p.y) < 24);
      if (!busy) this.add.image(p.x, p.y, 'plant').setDepth(p.y + 6);
    }
  }

  private buildWarehouse(): void {
    const { x, y, w, h, doorway } = this.layout.warehouse;
    const wallColor = 0x4a3b52;
    this.add.tileSprite(x, y, w, h, 'concrete').setOrigin(0);
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
    this.state.shelves.forEach((shelf, i) => {
      let view = this.shelfViews[i];
      if (!view || view.kind !== shelf.kind) {
        view?.bg.destroy();
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
        img.setPosition(slot.x - 17 + step * ((n % perRow) + 0.5), slot.y - 6 + Math.floor(n / perRow) * 12);
        if (entry) {
          img.setTexture(`item_${entry.id}`);
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
    const bg = this.add.image(slot.x, slot.y, look.texture).setTint(look.tint).setDepth(slot.y - 14);
    bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.restockShelf(index));
    const items = Array.from({ length: 16 }, () => this.add.image(slot.x, slot.y, 'item').setDepth(slot.y - 13));
    // Уровень улучшения — жёлтые точки над полкой.
    const pips = [0, 1].map((n) => this.add.image(slot.x - 17 + n * 4, slot.y - 15, 'pip').setDepth(slot.y - 13));
    return { kind, bg, items, pips };
  }

  private refreshWarehouse(): void {
    // На складе помещается ~30 коробок: в большом складе одна коробка изображает больше штук.
    const perBox = Math.max(UNITS_PER_BOX, Math.ceil(warehouseCapacity(this.state) / 30));
    const boxes = PRODUCT_IDS.flatMap((id) =>
      Array.from({ length: Math.ceil((this.state.warehouse[id]?.length ?? 0) / perBox) }, () => id),
    ).slice(0, 36);
    while (this.boxes.length < boxes.length) this.boxes.push(this.add.image(0, 0, 'box').setDepth(this.layout.warehouse.y + 1));
    this.boxes.forEach((img, n) => {
      const id = boxes[n];
      img.setVisible(Boolean(id));
      if (!id) return;
      img.setPosition(this.layout.warehouse.x + 8 + (n % 6) * 9, this.layout.warehouse.y + 16 + Math.floor(n / 6) * 8).setTint(PRODUCTS[id].color);
    });
  }

  private refreshToilet(): void {
    const dirt = this.toiletDirt;
    this.wcBar.setDisplaySize((14 * dirt) / 100, 2);
    this.wcBar.setTint(dirt < 30 ? 0x8fd16a : dirt < TOILET_DIRTY ? 0xf2c14e : 0xd95763);
    this.wcDoor.setTint(dirt >= TOILET_DIRTY ? 0xc8a878 : 0xffffff);
  }

  /** Человечек из слоёв: штаны, рубашка, кожа, волосы — каждый перекрашивается тинтом. */
  private makePerson(x: number, y: number, look: Look): Phaser.GameObjects.Container {
    const legs = this.add.image(0, 0, 'p_legs0').setTint(look.pants ?? 0x3a4466);
    const shirt = this.add.image(0, 0, 'p_shirt').setTint(look.shirt);
    const skin = this.add.image(0, 0, 'p_skin').setTint(look.skin);
    const hair = this.add.image(0, 0, `p_hair_${look.style ?? 'short'}`).setTint(look.hair ?? 0x4a2c1a);
    const person = this.add.container(x, y, [legs, shirt, skin, hair]).setDepth(y);
    person.setData('legs', legs);
    return person;
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
    const piece = this.add
      .image(x + Phaser.Math.Between(-6, 6), y + Phaser.Math.Between(4, 8), 'trash')
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
        hair: member.role === 'guard' ? UNIFORMS.guard : Phaser.Utils.Array.GetRandom(HAIR_COLORS),
      });
      const carried = this.add.image(0, 3, 'box').setVisible(false);
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
    const sprite = this.makePerson(door.x, this.layout.h + 16, { shirt: INSPECTOR_SHIRT, skin: SKINS[0], pants: INSPECTOR_SHIRT, hair: 0x181425, style: 'short' });
    const look = (x: number, y: number) => this.walk(sprite, x, y, 35).then(() => this.wait(700));
    this.popup(door.x, door.y - 24, t('popup.inspector'), '#fff3b0');
    haptic.tap();
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
      this.popup(sprite.x, sprite.y - 16, t('popup.inspectionPassed'), '#c8ffb0');
    } else {
      haptic.error();
      this.popup(sprite.x, sprite.y - 16, t('popup.inspectionFailed', { n: result.fine }), '#ffd0d0');
    }
    await this.walk(sprite, door.x, this.layout.h + 16, 35);
    sprite.destroy();
    this.inspector = 'done';
  }

  // ---------- Покупатели ----------

  private spawnCustomer(): void {
    const thief = Math.random() < thiefChance(this.state.level);
    const valya = !thief && !this.valyaCame && this.state.day > 1 && Math.random() < 0.15;
    const shirt = thief ? THIEF_SHIRT : valya ? VALYA.shirt : Phaser.Utils.Array.GetRandom(SHIRTS);
    const look = valya ? VALYA : thief ? { ...randomLook(shirt), style: 'long' as const, hair: THIEF_SHIRT } : randomLook(shirt);
    const sprite = this.makePerson(this.layout.door.x, this.layout.h + 16, look);
    if (valya) {
      this.valyaCame = true;
      this.time.delayedCall(1500, () => this.popup(sprite.x, sprite.y - 16, t('popup.valya'), '#fff3b0'));
    }
    const bubble = this.add.image(0, -14, 'bubble').setVisible(false);
    sprite.add(bubble);
    const customer: Customer = { sprite, bubble, items: [], unhappy: false, waitStart: 0, gone: false, thief };
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
    await this.walk(c.sprite, door.x, door.y - 10);
    const wanted = Phaser.Utils.Array.Shuffle(sellableProducts(this.state)).slice(0, Phaser.Math.Between(1, 2));
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
    this.popup(c.sprite.x, c.sprite.y - 14, byGuard ? t('popup.guardCaught') : t('popup.thiefCaught'), '#c8ffb0');
    void this.leave(c);
  }

  private async runCustomer(c: Customer): Promise<void> {
    await this.walk(c.sprite, this.layout.door.x, this.layout.door.y - 10);

    const wanted = Phaser.Utils.Array.Shuffle(sellableProducts(this.state)).slice(0, Phaser.Math.Between(1, 2));
    let disappointed = false;
    for (const id of wanted) {
      const index = shelfFor(this.state, id);
      if (index < 0) continue;
      const slot = this.layout.slots[index];
      await this.walk(c.sprite, slot.x + Phaser.Math.Between(-8, 8), slot.y + 22);
      await this.wait(500);
      const result = this.tryTake(c, id);
      if (result === 'empty' || result === 'expensive') disappointed = true;
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
    await this.walk(c.sprite, this.layout.queue.x, this.layout.queue.y - (this.queue.length - 1) * this.layout.queue.step);
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
    if (Math.random() >= buyChance(price, PRODUCTS[id].basePrice)) {
      if (price <= PRODUCTS[id].basePrice) return 'skipped';
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
      const item = this.add.image(c.sprite.x, c.sprite.y - 2, `item_${id}`).setScale(2).setDepth(1000);
      this.tweens.add({ targets: item, x: counter.x, y: counter.y - 14, alpha: 0.2, duration: 220, onComplete: () => item.destroy() });
      haptic.tap();
    }
    await this.wait(timing.pay * 1000);
    this.scanning = null;
    if (!this.sys.isActive()) return;
    this.finishCheckout(c);
    if (byOwner) this.ownerServedOne();
  }

  /** Хозяин обслужил покупателя: растёт навык кассы. */
  private ownerServedOne(): void {
    const before = ownerLevel(this.state.ownerServed);
    this.state = { ...this.state, ownerServed: this.state.ownerServed + 1 };
    const after = ownerLevel(this.state.ownerServed);
    if (after > before) {
      haptic.success();
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
    haptic.success();
    this.popup(this.layout.sellerHome.x - 8, this.layout.sellerHome.y - 18, `+${total} 💰`, '#c8ffb0');

    const dirty = this.trash.size >= TRASH_COMPLAINT;
    const badGoods = hasUnmarkedBad(c.items) && Math.random() < BAD_COMPLAINT_CHANCE;
    if (c.unhappy || dirty || badGoods) {
      this.stats.complaints++;
      const why = badGoods ? t('popup.badProduct') : dirty ? t('popup.dirty') : '😣';
      this.popup(c.sprite.x, c.sprite.y - 26, why, '#ffd0d0');
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
    this.popup(c.sprite.x, c.sprite.y - 14, t('popup.leftAngry'), '#ffd0d0');
    this.layoutQueue();
    await this.leave(c);
  }

  private async leave(c: Customer, pastCounter = false): Promise<void> {
    c.gone = true;
    if (pastCounter) await this.walk(c.sprite, this.layout.queue.x, this.layout.counter.y + 40);
    await this.walk(c.sprite, this.layout.door.x, this.layout.h + 16);
    c.sprite.destroy();
    this.customers.delete(c);
  }

  private layoutQueue(): void {
    this.queue.forEach((c, i) => void this.walk(c.sprite, this.layout.queue.x, this.layout.queue.y - i * this.layout.queue.step));
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

  private walk(target: Phaser.GameObjects.Container, x: number, y: number, speed = CUSTOMER_SPEED): Promise<void> {
    this.tweens.killTweensOf(target);
    const legs = target.getData('legs') as Phaser.GameObjects.Image | undefined;
    const distance = Phaser.Math.Distance.Between(target.x, target.y, x, y);
    return new Promise((resolve) => {
      this.tweens.add({
        targets: target,
        x,
        y,
        duration: (distance / speed) * 1000,
        onUpdate: () => {
          target.setDepth(target.y);
          // Шаги: ноги переставляются каждые 150 мс.
          legs?.setTexture(Math.floor(this.time.now / 150) % 2 ? 'p_legs1' : 'p_legs0');
        },
        onComplete: () => {
          legs?.setTexture('p_legs0');
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
    this.tweens.add({ targets: label, y: y - 14, alpha: 0, duration: 1100, onComplete: () => label.destroy() });
  }

  // ---------- День ----------

  private showMorning(): void {
    this.hud.update(this.state, DAY_SECONDS);
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
    this.valyaCame = false;
    this.syncStaff();
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
    const { state, spoiled, bill, shortfall, skimmed, order } = nightCycle(this.state, this.stats);
    const extra: [string, string][] = [];
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
