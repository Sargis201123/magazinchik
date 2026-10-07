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
  expensesTotal,
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
  STORE_LEVELS,
  storeLevel,
  takeFromShelf,
  unitSalePrice,
  warehouseCapacity,
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

    this.buildWorld();
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
      if (this.nextSpawn <= 0 && this.customers.size < storeLevel(this.state).maxCustomers) {
        this.spawnCustomer();
        this.nextSpawn = spawnInterval(this.state.rating, this.state.level) * Phaser.Math.FloatBetween(0.7, 1.3);
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
    this.add.rectangle(-200, next.h, next.w + 400, 200, 0x3a3a44).setOrigin(0);
    if (next !== this.layout) this.buildForRent(next);

    this.buildStore();
    this.refreshShelves();
    this.refreshWarehouse();
    this.refreshToilet();
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
      .text(w / 2, -6, t(storeLevel(this.state).nameKey), { fontFamily: 'system-ui, sans-serif', fontSize: '8px', color: '#f2c14e' })
      .setOrigin(0.5)
      .setResolution(4);
    this.buildWarehouse();

    this.wcDoor = this.add.image(wc.x, wc.y, 'wc');
    this.add.image(wc.x, wc.y - 15, 'bar').setDisplaySize(14, 3).setTint(0x2b2233);
    this.wcBar = this.add.image(wc.x - 7, wc.y - 15, 'bar').setOrigin(0, 0.5).setDisplaySize(0, 2);
    this.add
      .zone(wc.x, wc.y + 4, 24, 36)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.cleanToilet());

    this.add.image(counter.x, counter.y, 'counter').setDepth(counter.y + 20);
    this.seller = this.makePerson(sellerHome.x, sellerHome.y, 0x8fd16a, SKINS[0]);
    this.carried = this.add.image(0, -12, 'box').setVisible(false);
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
    const lot = 0x4b4654;
    if (next.w > w) this.add.rectangle(w + 3, 0, next.w - w - 3, next.h, lot).setOrigin(0);
    if (next.h > h) this.add.rectangle(0, h + 3, w + 3, next.h - h - 3, lot).setOrigin(0);
    this.add.rectangle(0, 0, next.w, next.h).setOrigin(0).setStrokeStyle(1, 0x8a8494);
    const signX = next.w > w ? w + (next.w - w) / 2 : w / 2;
    const signY = next.w > w ? next.h / 2 : h + (next.h - h) / 2;
    this.add
      .text(signX, signY, `${t('store.forRent')}\n${cost} 💰`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '7px',
        color: '#c9c0ad',
        align: 'center',
      })
      .setOrigin(0.5)
      .setResolution(4);
  }

  private buildWarehouse(): void {
    const { x, y, w, h, doorway } = this.layout.warehouse;
    const wallColor = 0x4a3b52;
    this.add.tileSprite(x, y, w, h, 'floor').setOrigin(0).setTint(0x9a8a70);
    this.add.rectangle(x, y - 3, w + 4, 3, wallColor).setOrigin(0);
    // Правая стена с проёмом.
    this.add.rectangle(x + w, y, 4, doorway.y - 10 - y, wallColor).setOrigin(0);
    this.add.rectangle(x + w, doorway.y + 10, 4, y + h - doorway.y - 10, wallColor).setOrigin(0);
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
      const slot = this.layout.slots[i];
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
    await this.walk(this.seller, this.layout.sellerHome.x, this.layout.sellerHome.y, SELLER_SPEED);
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
    const slot = this.layout.slots[index];
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
    const sprite = this.makePerson(this.layout.door.x, this.layout.h + 16, Phaser.Utils.Array.GetRandom(SHIRTS), Phaser.Utils.Array.GetRandom(SKINS));
    const bubble = this.add.image(0, -13, 'bubble').setVisible(false);
    sprite.add(bubble);
    const customer: Customer = { sprite, bubble, items: [], unhappy: false, waitStart: 0, gone: false };
    this.customers.add(customer);
    void this.runCustomer(customer);
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
        if (s.level !== this.builtLevel) this.buildWorld();
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
    const { state, spoiled, expenses } = endDay(this.state, this.stats);
    this.state = state;
    this.stats.spoiled = spoiled;
    saveGame(this.state);
    this.refreshShelves();
    this.refreshWarehouse();
    this.hud.update(this.state, 0);
    this.hud.showSummary(
      finishedDay,
      this.stats,
      { before: ratingBefore, after: state.rating },
      { expenses: expensesTotal(expenses), total: state.money },
      () => this.showMorning(),
    );
  }
}
