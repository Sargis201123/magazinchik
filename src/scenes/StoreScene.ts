import Phaser from 'phaser';
import {
  buyChance,
  checkout,
  emptyDayStats,
  endDay,
  newGame,
  PRODUCT_IDS,
  PRODUCTS,
  returnToShelf,
  SHELF_CAPACITY,
  spawnInterval,
  stockCount,
  takeFromShelf,
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

const DAY_SECONDS = 90;
const PATIENCE_MS = 15_000;
const CUSTOMER_SPEED = 40; // пикселей мира в секунду
const SELLER_SPEED = 70;
const MAX_CUSTOMERS = 6;

const TRASH_CHANCE = 0.15;
const MAX_TRASH = 8;
/** Столько мусора на полу — и покупатели начинают жаловаться. */
const TRASH_COMPLAINT = 3;
const TOILET_CHANCE = 0.25;
const TOILET_DIRT_PER_VISIT = 20;
const TOILET_DIRTY = 60;
const TOILET_CLEAN_MS = 1500;
const TRASH_CLEAN_MS = 400;

const SHELF_Y = 86;
const SHELF_X: Record<ProductId, number> = { bread: 28, milk: 76, apples: 124 };
const WC = { x: 166, y: 60, spotY: 84 };
/** Касса стоит боком: очередь выстраивается вдоль ленты сверху вниз. */
const COUNTER = { x: 140, y: 214 };
const SELLER_HOME = { x: 156, y: 230 };
const QUEUE = { x: 124, y: 230, step: 13 };
const DOOR = { x: 90, y: 312 };

const SHIRTS = [0x5b6ee1, 0xd95763, 0x6abe30, 0xfbf236, 0x76428a, 0xdf7126, 0x37946e];
const SKINS = [0xf2d3ab, 0xd9a066, 0x8f563b, 0xeec39a];

interface Customer {
  sprite: Phaser.GameObjects.Container;
  bubble: Phaser.GameObjects.Image;
  items: ProductId[];
  /** Что-то испортило впечатление (грязный туалет) — при оплате будет жалоба. */
  unhappy: boolean;
  patience?: Phaser.Time.TimerEvent;
  waitStart: number;
  gone: boolean;
}

export class StoreScene extends Phaser.Scene {
  private state!: StoreState;
  private stats: DayStats = emptyDayStats();
  private hud!: Hud;
  private shelfItems = new Map<ProductId, Phaser.GameObjects.Image[]>();
  private customers = new Set<Customer>();
  private queue: Customer[] = [];
  private trash = new Set<Phaser.GameObjects.Image>();
  private toiletDirt = 0;
  private wcDoor!: Phaser.GameObjects.Image;
  private wcBar!: Phaser.GameObjects.Image;
  private seller!: Phaser.GameObjects.Container;
  private sellerBusy = false;
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
    this.hud.setHint(this.currentHint());
    this.hud.update(this.state, this.timeLeft);
  }

  private currentHint(): string {
    if (this.queue.length > 0 && this.state.day <= 2 && this.stats.served < 3) return t('hint.serve');
    if ((this.trash.size > 0 || this.toiletDirt >= TOILET_DIRTY) && this.state.day <= 4) return t('hint.clean');
    return '';
  }

  // ---------- Магазин ----------

  private buildStore(): void {
    this.add.tileSprite(0, 40, WORLD_W, WORLD_H - 40, 'floor').setOrigin(0);
    this.add.tileSprite(0, 40, WORLD_W, 32, 'wall').setOrigin(0);
    this.add.image(DOOR.x, DOOR.y + 3, 'door');

    for (const id of PRODUCT_IDS) {
      this.add.image(SHELF_X[id], SHELF_Y, 'shelf');
      const items: Phaser.GameObjects.Image[] = [];
      for (let i = 0; i < SHELF_CAPACITY; i++) {
        const row = Math.floor(i / 5);
        items.push(
          this.add.image(SHELF_X[id] - 14 + (i % 5) * 7, SHELF_Y - 6 + row * 12, 'item').setTint(PRODUCTS[id].color),
        );
      }
      this.shelfItems.set(id, items);
    }

    this.wcDoor = this.add.image(WC.x, WC.y, 'wc');
    this.add.image(WC.x, WC.y - 15, 'bar').setDisplaySize(14, 3).setTint(0x2b2233);
    this.wcBar = this.add.image(WC.x - 7, WC.y - 15, 'bar').setOrigin(0, 0.5).setDisplaySize(0, 2);
    this.add
      .zone(WC.x, WC.y + 4, 24, 36)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.cleanToilet());

    this.add.image(COUNTER.x, COUNTER.y, 'counter').setDepth(COUNTER.y + 20);
    this.seller = this.makePerson(SELLER_HOME.x, SELLER_HOME.y, 0x8fd16a, SKINS[0]);
    this.add
      .zone(COUNTER.x + 6, COUNTER.y + 6, 40, 64)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.serveNext());
  }

  private refreshShelves(): void {
    for (const id of PRODUCT_IDS) {
      const count = stockCount(this.state, id);
      this.shelfItems.get(id)!.forEach((img, i) => img.setVisible(i < count));
    }
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

  // ---------- Продавец: уборка ----------

  /** Продавец уходит от кассы на дело и возвращается. Пока его нет, касса пустует. */
  private async doChore(x: number, y: number, ms: number, done: () => void): Promise<void> {
    if (this.sellerBusy) return;
    this.sellerBusy = true;
    haptic.tap();
    await this.walk(this.seller, x, y, SELLER_SPEED);
    await this.wait(ms);
    done();
    await this.walk(this.seller, SELLER_HOME.x, SELLER_HOME.y, SELLER_SPEED);
    this.sellerBusy = false;
  }

  private cleanToilet(): void {
    if (this.toiletDirt === 0) return;
    void this.doChore(WC.x, WC.spotY, TOILET_CLEAN_MS, () => {
      this.toiletDirt = 0;
      this.refreshToilet();
    });
  }

  private dropTrash(x: number, y: number): void {
    if (this.trash.size >= MAX_TRASH) return;
    const piece = this.add
      .image(x + Phaser.Math.Between(-6, 6), y + Phaser.Math.Between(4, 8), 'trash')
      .setTint(Phaser.Utils.Array.GetRandom([0xe6e1d6, 0xd95763, 0x5b6ee1, 0xf2c14e]))
      .setDepth(1)
      .setInteractive(new Phaser.Geom.Rectangle(-5, -5, 16, 15), Phaser.Geom.Rectangle.Contains);
    piece.on('pointerdown', () => {
      void this.doChore(piece.x + 6, piece.y, TRASH_CLEAN_MS, () => {
        this.trash.delete(piece);
        piece.destroy();
      });
    });
    this.trash.add(piece);
  }

  // ---------- Покупатели ----------

  private spawnCustomer(): void {
    const sprite = this.makePerson(
      DOOR.x,
      WORLD_H + 10,
      Phaser.Utils.Array.GetRandom(SHIRTS),
      Phaser.Utils.Array.GetRandom(SKINS),
    );
    const bubble = this.add.image(0, -13, 'bubble').setVisible(false);
    sprite.add(bubble);
    const customer: Customer = { sprite, bubble, items: [], unhappy: false, waitStart: 0, gone: false };
    this.customers.add(customer);
    void this.runCustomer(customer);
  }

  private async runCustomer(c: Customer): Promise<void> {
    await this.walk(c.sprite, DOOR.x, DOOR.y - 10);

    const wanted = Phaser.Utils.Array.Shuffle([...PRODUCT_IDS]).slice(0, Phaser.Math.Between(1, 2));
    let sawEmptyShelf = false;
    for (const id of wanted) {
      await this.walk(c.sprite, SHELF_X[id] + Phaser.Math.Between(-8, 8), SHELF_Y + 22);
      await this.wait(500);
      if (stockCount(this.state, id) === 0) {
        sawEmptyShelf = true;
        this.popup(c.sprite.x, c.sprite.y - 14, t('popup.noStock'), '#ffd0d0');
        continue;
      }
      if (Math.random() < buyChance(this.state.prices[id], PRODUCTS[id].basePrice)) {
        const next = takeFromShelf(this.state, id);
        if (next) {
          this.state = next;
          c.items.push(id);
          this.refreshShelves();
        }
      }
    }

    if (Math.random() < TRASH_CHANCE) this.dropTrash(c.sprite.x, c.sprite.y);

    if (c.items.length === 0) {
      if (sawEmptyShelf) this.stats.lost++;
      await this.leave(c);
      return;
    }

    if (Math.random() < TOILET_CHANCE) await this.visitToilet(c);

    this.queue.push(c);
    c.waitStart = this.time.now;
    c.bubble.setVisible(true);
    c.patience = this.time.delayedCall(PATIENCE_MS, () => void this.giveUp(c));
    this.layoutQueue();
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
    const c = this.queue[0];
    if (!c || this.sellerBusy || !this.isAtRegister(c)) return;
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
    if (c.unhappy || dirty) {
      this.stats.complaints++;
      this.popup(c.sprite.x, c.sprite.y - 26, dirty ? t('popup.dirty') : '😣', '#ffd0d0');
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
    const { state, spoiled } = endDay(this.state, this.stats);
    this.state = state;
    this.stats.spoiled = spoiled;
    saveGame(this.state);
    this.refreshShelves();
    this.hud.update(this.state, 0);
    this.hud.showSummary(finishedDay, this.stats, () => this.showMorning());
  }
}
