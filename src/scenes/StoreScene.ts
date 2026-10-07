import Phaser from 'phaser';
import {
  BAD_COMPLAINT_CHANCE,
  buyChance,
  CARRY,
  canPlace,
  checkout,
  DAY_SECONDS,
  emptyDayStats,
  endDay,
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
  spawnInterval,
  takeFromShelf,
  unitSalePrice,
  type CartItem,
  type Category,
  type DayStats,
  type ProductId,
  type StoreState,
} from '../game/economy';
import { loadGame, saveGame } from '../game/save';
import { t } from '../i18n';
import { haptic } from '../platform/telegram';
import { Hud } from '../ui/hud';
import { showMorning } from '../ui/morning';

// Мир рисуем в координатах 180×320 («пиксели» игры), камера увеличивает его в 2 раза.
export const WORLD_W = 180;
export const WORLD_H = 320;

/** Терпение в очереди. Отсчёт начинается, когда покупатель дошёл до очереди. */
const PATIENCE_MS = 20_000;
const CUSTOMER_SPEED = 40; // пикселей мира в секунду
const SELLER_SPEED = 90;
/** Как часто покупатель у пустой кассы зовёт продавца. */
const CALL_EVERY_MS = 3000;
const MAX_CUSTOMERS = 6;

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
/** Одна коробка на складе изображает столько штук товара. */
const UNITS_PER_BOX = 3;

/** Места под полки: три вдоль стены и одно в зале. */
const SHELF_SLOTS = [
  { x: 28, y: 86 },
  { x: 76, y: 86 },
  { x: 124, y: 86 },
  { x: 48, y: 164 },
];
const SHELF_LOOK: Record<Category, { texture: string; tint: number }> = {
  bakery: { texture: 'shelf', tint: 0xffffff },
  produce: { texture: 'stand', tint: 0xffffff },
  dairy: { texture: 'fridge', tint: 0xd8ecff },
  meat: { texture: 'fridge', tint: 0xffd6d6 },
};
const WC = { x: 166, y: 60, spotY: 84 };
/** Касса стоит боком: очередь выстраивается вдоль ленты сверху вниз. */
const COUNTER = { x: 140, y: 214 };
const SELLER_HOME = { x: 156, y: 230 };
const QUEUE = { x: 124, y: 230, step: 13 };
const DOOR = { x: 90, y: 312 };
/** Склад — отдельная комната в углу, вход сбоку. */
const WAREHOUSE = { x: 0, y: 246, w: 62, h: WORLD_H - 246, doorway: { x: 70, y: 274 }, pickup: { x: 34, y: 284 } };

const SHIRTS = [0x5b6ee1, 0xd95763, 0x6abe30, 0xfbf236, 0x76428a, 0xdf7126, 0x37946e];
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
  private stats: DayStats = emptyDayStats();
  private hud!: Hud;
  private shelfViews: ShelfView[] = [];
  private boxes: Phaser.GameObjects.Image[] = [];
  private customers = new Set<Customer>();
  private queue: Customer[] = [];
  private trash = new Set<Phaser.GameObjects.Image>();
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
  private nextSpawn = 1;
  private running = false;

  constructor() {
    super('store');
  }

  create(): void {
    const saved = loadGame();
    this.state = saved ?? newGame();
    this.hud = new Hud();

    this.cameras.main.setZoom(2).centerOn(WORLD_W / 2, WORLD_H / 2);
    this.buildStore();
    this.refreshShelves();
    this.refreshWarehouse();
    this.refreshToilet();
    this.hud.update(this.state, this.timeLeft);

    if (saved) this.showMorning();
    else this.hud.showIntro(() => this.showMorning());
  }

  update(_time: number, deltaMs: number): void {
    if (!this.running) return;
    const dt = deltaMs / 1000;
    this.timeLeft = Math.max(0, this.timeLeft - dt);

    if (this.timeLeft > 0) {
      this.nextSpawn -= dt;
      if (this.nextSpawn <= 0 && this.customers.size < MAX_CUSTOMERS) {
        this.spawnCustomer();
        this.nextSpawn = spawnInterval(this.state.rating) * Phaser.Math.FloatBetween(0.7, 1.3);
      }
    } else if (this.customers.size === 0) {
      this.finishDay();
    }

    for (const c of this.queue) this.updateBubble(c);
    this.callSellerIfNeeded();
    this.hud.setHint(this.currentHint());
    this.hud.update(this.state, this.timeLeft);
  }

  private currentHint(): string {
    if (this.sellerBusy && this.queue.length > 0) return t('hint.recall');
    if (this.queue.length > 0 && this.state.day <= 2 && this.stats.served < 3) return t('hint.serve');
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

  private buildStore(): void {
    this.add.tileSprite(0, 40, WORLD_W, WORLD_H - 40, 'floor').setOrigin(0);
    this.add.tileSprite(0, 40, WORLD_W, 32, 'wall').setOrigin(0);
    this.add.image(DOOR.x, DOOR.y + 3, 'door');
    this.buildWarehouse();

    this.wcDoor = this.add.image(WC.x, WC.y, 'wc');
    this.add.image(WC.x, WC.y - 15, 'bar').setDisplaySize(14, 3).setTint(0x2b2233);
    this.wcBar = this.add.image(WC.x - 7, WC.y - 15, 'bar').setOrigin(0, 0.5).setDisplaySize(0, 2);
    this.add
      .zone(WC.x, WC.y + 4, 24, 36)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.cleanToilet());

    this.add.image(COUNTER.x, COUNTER.y, 'counter').setDepth(COUNTER.y + 20);
    this.seller = this.makePerson(SELLER_HOME.x, SELLER_HOME.y, 0x8fd16a, SKINS[0]);
    this.carried = this.add.image(0, -12, 'box').setVisible(false);
    this.seller.add(this.carried);
    this.add
      .zone(COUNTER.x + 6, COUNTER.y + 6, 40, 64)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.serveNext());
  }

  private buildWarehouse(): void {
    const { x, y, w, h, doorway } = WAREHOUSE;
    this.add.tileSprite(x, y, w, h, 'floor').setOrigin(0).setTint(0x9a8a70);
    this.add.image(x, y - 3, 'bar').setOrigin(0).setDisplaySize(w + 4, 4).setTint(0x4a3b52);
    // Правая стена с проёмом напротив двери.
    this.add.image(x + w, y, 'bar').setOrigin(0).setDisplaySize(4, doorway.y - 10 - y).setTint(0x4a3b52);
    this.add.image(x + w, doorway.y + 10, 'bar').setOrigin(0).setDisplaySize(4, WORLD_H - doorway.y - 10).setTint(0x4a3b52);
    this.add
      .text(x + w / 2, y + 6, t('warehouse.label'), { fontFamily: 'system-ui, sans-serif', fontSize: '6px', color: '#e6e1d6' })
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
      const slot = SHELF_SLOTS[i];
      const units = PRODUCT_IDS.flatMap((id) => (shelf.items[id] ?? []).map((unit) => ({ id, unit })));
      view.items.forEach((img, n) => {
        const entry = units[n];
        img.setVisible(n < capacity && Boolean(entry));
        img.setPosition(slot.x - 17 + step * ((n % perRow) + 0.5), slot.y - 6 + Math.floor(n / perRow) * 12);
        if (entry) {
          const base = PRODUCTS[entry.id].color;
          const bad = Phaser.Display.Color.IntegerToColor(base).darken(35).color;
          img.setTint(entry.unit.markdown ? 0xf2c14e : entry.unit.bad ? bad : base);
        }
      });
      view.pips.forEach((pip, n) => pip.setVisible(n < shelf.level));
    });
  }

  private buildShelf(index: number, kind: Category): ShelfView {
    const slot = SHELF_SLOTS[index];
    const look = SHELF_LOOK[kind];
    const bg = this.add.image(slot.x, slot.y, look.texture).setTint(look.tint).setDepth(slot.y - 14);
    bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.restockShelf(index));
    const items = Array.from({ length: 16 }, () => this.add.image(slot.x, slot.y, 'item').setDepth(slot.y - 13));
    // Уровень улучшения — жёлтые точки над полкой.
    const pips = [0, 1].map((n) => this.add.image(slot.x - 17 + n * 4, slot.y - 15, 'pip').setDepth(slot.y - 13));
    return { kind, bg, items, pips };
  }

  private refreshWarehouse(): void {
    const boxes = PRODUCT_IDS.flatMap((id) =>
      Array.from({ length: Math.ceil((this.state.warehouse[id]?.length ?? 0) / UNITS_PER_BOX) }, () => id),
    );
    while (this.boxes.length < boxes.length) this.boxes.push(this.add.image(0, 0, 'box').setDepth(WAREHOUSE.y + 1));
    this.boxes.forEach((img, n) => {
      const id = boxes[n];
      img.setVisible(Boolean(id));
      if (!id) return;
      img.setPosition(WAREHOUSE.x + 8 + (n % 6) * 9, WAREHOUSE.y + 16 + Math.floor(n / 6) * 8).setTint(PRODUCTS[id].color);
    });
  }

  private refreshToilet(): void {
    const dirt = this.toiletDirt;
    this.wcBar.setDisplaySize((14 * dirt) / 100, 2);
    this.wcBar.setTint(dirt < 30 ? 0x8fd16a : dirt < TOILET_DIRTY ? 0xf2c14e : 0xd95763);
    this.wcDoor.setTint(dirt >= TOILET_DIRTY ? 0xc8a878 : 0xffffff);
  }

  private makePerson(x: number, y: number, shirt: number, skin: number): Phaser.GameObjects.Container {
    const body = this.add.image(0, 4, 'cust_body').setTint(shirt);
    const head = this.add.image(0, -4, 'cust_head').setTint(skin);
    return this.add.container(x, y, [body, head]).setDepth(y);
  }

  // ---------- Продавец: уборка и выкладка ----------

  /** Продавец уходит от кассы по шагам и возвращается. Пока его нет, касса пустует. */
  private async doChore(steps: ChoreStep[]): Promise<void> {
    if (this.sellerBusy) return;
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
    await this.walk(this.seller, SELLER_HOME.x, SELLER_HOME.y, SELLER_SPEED);
    if (id === this.choreId) this.sellerBusy = false;
  }

  private callSellerIfNeeded(): void {
    const front = this.queue[0];
    if (!this.sellerBusy || !front || !this.isAtRegister(front)) return;
    if (this.time.now - this.lastCall < CALL_EVERY_MS) return;
    this.lastCall = this.time.now;
    this.popup(front.sprite.x, front.sprite.y - 22, t('popup.callRegister'), '#fff3b0');
  }

  /** Касание полки: продавец идёт на склад, берёт коробку подходящего товара и раскладывает. */
  private restockShelf(index: number): void {
    if (!this.running || this.sellerBusy) return;
    const shelf = this.state.shelves[index];
    const slot = SHELF_SLOTS[index];
    if (shelfFree(shelf) === 0) {
      this.popup(slot.x, slot.y - 18, t('popup.shelfFull'), '#fff3b0');
      return;
    }
    const available = PRODUCT_IDS.some((id) => canPlace(id, shelf) && (this.state.warehouse[id] ?? []).some((u) => !u.pending));
    if (!available) {
      this.popup(slot.x, slot.y - 18, t('popup.warehouseEmpty'), '#ffd0d0');
      return;
    }
    const { doorway, pickup } = WAREHOUSE;
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
        x: WC.x,
        y: WC.spotY,
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
      void this.doChore([
        {
          x: piece.x + 6,
          y: piece.y,
          ms: TRASH_CLEAN_MS,
          action: () => {
            this.trash.delete(piece);
            piece.destroy();
          },
        },
      ]);
    });
    this.trash.add(piece);
  }

  // ---------- Покупатели ----------

  private spawnCustomer(): void {
    const sprite = this.makePerson(DOOR.x, WORLD_H + 10, Phaser.Utils.Array.GetRandom(SHIRTS), Phaser.Utils.Array.GetRandom(SKINS));
    const bubble = this.add.image(0, -13, 'bubble').setVisible(false);
    sprite.add(bubble);
    const customer: Customer = { sprite, bubble, items: [], unhappy: false, waitStart: 0, gone: false };
    this.customers.add(customer);
    void this.runCustomer(customer);
  }

  private async runCustomer(c: Customer): Promise<void> {
    await this.walk(c.sprite, DOOR.x, DOOR.y - 10);

    const wanted = Phaser.Utils.Array.Shuffle(sellableProducts(this.state)).slice(0, Phaser.Math.Between(1, 2));
    let sawEmptyShelf = false;
    for (const id of wanted) {
      const index = shelfFor(this.state, id);
      if (index < 0) continue;
      const slot = SHELF_SLOTS[index];
      await this.walk(c.sprite, slot.x + Phaser.Math.Between(-8, 8), slot.y + 22);
      await this.wait(500);
      if (!this.tryTake(c, id)) sawEmptyShelf = true;
    }

    if (Math.random() < TRASH_CHANCE) this.dropTrash(c.sprite.x, c.sprite.y);

    if (c.items.length === 0) {
      if (sawEmptyShelf) this.stats.lost++;
      await this.leave(c);
      return;
    }

    if (Math.random() < TOILET_CHANCE) await this.visitToilet(c);

    this.queue.push(c);
    await this.walk(c.sprite, QUEUE.x, QUEUE.y - (this.queue.length - 1) * QUEUE.step);
    if (c.gone) return;
    c.waitStart = this.time.now;
    c.bubble.setVisible(true);
    c.patience = this.time.delayedCall(PATIENCE_MS, () => void this.giveUp(c));
    this.layoutQueue();
  }

  /** Покупатель у полки: берёт товар, если он есть и цена устраивает. false — товара нет. */
  private tryTake(c: Customer, id: ProductId): boolean {
    const index = shelfFor(this.state, id);
    const oldest = this.state.shelves[index]?.items[id]?.[0];
    if (!oldest) {
      this.popup(c.sprite.x, c.sprite.y - 14, t('popup.noStock'), '#ffd0d0');
      return false;
    }
    if (Math.random() < buyChance(unitSalePrice(this.state, id, oldest), PRODUCTS[id].basePrice)) {
      const taken = takeFromShelf(this.state, index, id);
      if (taken) {
        this.state = taken.state;
        c.items.push({ id, unit: taken.unit });
        this.refreshShelves();
      }
    }
    return true;
  }

  private async visitToilet(c: Customer): Promise<void> {
    await this.walk(c.sprite, WC.x, WC.spotY);
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

  private serveNext(): void {
    if (this.sellerBusy) {
      this.recallSeller();
      return;
    }
    const c = this.queue[0];
    if (!c || !this.isAtRegister(c)) return;
    c.patience?.remove();
    this.queue.shift();
    c.bubble.setVisible(false);

    const { state, total } = checkout(this.state, c.items);
    this.state = state;
    this.stats.revenue += total;
    this.stats.served++;
    haptic.success();
    this.popup(SELLER_HOME.x - 8, SELLER_HOME.y - 18, `+${total} 💰`, '#c8ffb0');

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
    if (c.gone) return;
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
    if (pastCounter) await this.walk(c.sprite, QUEUE.x, COUNTER.y + 40);
    await this.walk(c.sprite, DOOR.x, WORLD_H + 12);
    c.sprite.destroy();
    this.customers.delete(c);
  }

  private layoutQueue(): void {
    this.queue.forEach((c, i) => void this.walk(c.sprite, QUEUE.x, QUEUE.y - i * QUEUE.step));
  }

  private isAtRegister(c: Customer): boolean {
    return Phaser.Math.Distance.Between(c.sprite.x, c.sprite.y, QUEUE.x, QUEUE.y) < 2;
  }

  private updateBubble(c: Customer): void {
    if (!c.bubble.visible) return;
    const left = 1 - (this.time.now - c.waitStart) / PATIENCE_MS;
    c.bubble.setTint(left > 0.6 ? 0x8fd16a : left > 0.3 ? 0xf2c14e : 0xd95763);
  }

  // ---------- Утилиты ----------

  private walk(target: Phaser.GameObjects.Container, x: number, y: number, speed = CUSTOMER_SPEED): Promise<void> {
    this.tweens.killTweensOf(target);
    const distance = Phaser.Math.Distance.Between(target.x, target.y, x, y);
    return new Promise((resolve) => {
      this.tweens.add({
        targets: target,
        x,
        y,
        duration: (distance / speed) * 1000,
        onUpdate: () => target.setDepth(target.y),
        onComplete: () => resolve(),
        onStop: () => resolve(),
      });
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  private popup(x: number, y: number, text: string, color: string): void {
    const label = this.add
      .text(x, y, text, { fontFamily: 'system-ui, sans-serif', fontSize: '8px', color, stroke: '#2b2233', strokeThickness: 2 })
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
        this.state = s;
        saveGame(s);
        this.refreshShelves();
        this.refreshWarehouse();
        this.hud.update(s, DAY_SECONDS);
      },
      onOpen: () => this.startDay(),
    });
  }

  private startDay(): void {
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
    const { state, spoiled } = endDay(this.state, this.stats);
    this.state = state;
    this.stats.spoiled = spoiled;
    saveGame(this.state);
    this.refreshShelves();
    this.refreshWarehouse();
    this.hud.update(this.state, 0);
    this.hud.showSummary(finishedDay, this.stats, { before: ratingBefore, after: state.rating }, () => this.showMorning());
  }
}
