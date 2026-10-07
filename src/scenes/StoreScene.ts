import Phaser from 'phaser';
import {
  buyChance,
  checkout,
  emptyDayStats,
  endDay,
  newGame,
  PRODUCT_IDS,
  PRODUCTS,
  restock,
  restockCost,
  SHELF_CAPACITY,
  spawnInterval,
  takeFromShelf,
  type DayStats,
  type ProductId,
  type StoreState,
} from '../game/economy';
import { loadGame, saveGame } from '../game/save';
import { t } from '../i18n';
import { haptic } from '../platform/telegram';
import { Hud } from '../ui/hud';

// Мир рисуем в координатах 180×320 («пиксели» игры), камера увеличивает его в 2 раза.
export const WORLD_W = 180;
export const WORLD_H = 320;

const DAY_SECONDS = 90;
const PATIENCE_MS = 15_000;
const WALK_SPEED = 40; // пикселей мира в секунду
const MAX_CUSTOMERS = 6;

const SHELF_Y = 86;
const SHELF_X: Record<ProductId, number> = { bread: 34, milk: 90, apples: 146 };
const REGISTER = { x: 140, y: 222 };
const DOOR = { x: 90, y: 312 };

const SHIRTS = [0x5b6ee1, 0xd95763, 0x6abe30, 0xfbf236, 0x76428a, 0xdf7126, 0x37946e];
const SKINS = [0xf2d3ab, 0xd9a066, 0x8f563b, 0xeec39a];

interface Customer {
  sprite: Phaser.GameObjects.Container;
  bubble: Phaser.GameObjects.Image;
  items: ProductId[];
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
    this.hud.update(this.state, this.timeLeft);

    if (saved) this.startDay();
    else this.hud.showIntro(() => this.startDay());
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
    this.hud.setHint(this.queue.length > 0 && this.state.day <= 2 ? t('hint.serve') : '');
    this.hud.update(this.state, this.timeLeft);
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
        const item = this.add
          .image(SHELF_X[id] - 14 + (i % 5) * 7, SHELF_Y - 6 + row * 12, 'item')
          .setTint(PRODUCTS[id].color);
        items.push(item);
      }
      this.shelfItems.set(id, items);
    }

    this.add.image(REGISTER.x, REGISTER.y, 'register');
    // Продавец (это мы) стоит за кассой.
    this.makePerson(REGISTER.x + 22, REGISTER.y - 4, 0x8fd16a, SKINS[0]);

    const hit = this.add.zone(REGISTER.x + 6, REGISTER.y, 56, 44).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.serveNext());
  }

  private refreshShelves(): void {
    for (const id of PRODUCT_IDS) {
      this.shelfItems.get(id)!.forEach((img, i) => img.setVisible(i < this.state.stock[id]));
    }
  }

  private makePerson(x: number, y: number, shirt: number, skin: number): Phaser.GameObjects.Container {
    const body = this.add.image(0, 4, 'cust_body').setTint(shirt);
    const head = this.add.image(0, -4, 'cust_head').setTint(skin);
    return this.add.container(x, y, [body, head]).setDepth(y);
  }

  // ---------- Покупатели ----------

  private spawnCustomer(): void {
    const sprite = this.makePerson(DOOR.x, WORLD_H + 10, Phaser.Utils.Array.GetRandom(SHIRTS), Phaser.Utils.Array.GetRandom(SKINS));
    const bubble = this.add.image(0, -13, 'bubble').setVisible(false);
    sprite.add(bubble);
    const customer: Customer = { sprite, bubble, items: [], waitStart: 0, gone: false };
    this.customers.add(customer);
    void this.runCustomer(customer);
  }

  private async runCustomer(c: Customer): Promise<void> {
    await this.walk(c, DOOR.x, DOOR.y - 10);

    const wanted = Phaser.Utils.Array.Shuffle([...PRODUCT_IDS]).slice(0, Phaser.Math.Between(1, 2));
    let sawEmptyShelf = false;
    for (const id of wanted) {
      await this.walk(c, SHELF_X[id] + Phaser.Math.Between(-8, 8), SHELF_Y + 22);
      await this.wait(500);
      if (this.state.stock[id] === 0) {
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

    if (c.items.length === 0) {
      if (sawEmptyShelf) this.stats.lost++;
      await this.leave(c);
      return;
    }

    this.queue.push(c);
    c.waitStart = this.time.now;
    c.bubble.setVisible(true);
    c.patience = this.time.delayedCall(PATIENCE_MS, () => void this.giveUp(c));
    this.layoutQueue();
  }

  private serveNext(): void {
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
    this.popup(REGISTER.x, REGISTER.y - 18, `+${total} 💰`, '#c8ffb0');
    this.layoutQueue();
    void this.leave(c);
  }

  private async giveUp(c: Customer): Promise<void> {
    if (c.gone) return;
    this.queue = this.queue.filter((q) => q !== c);
    c.bubble.setVisible(false);
    // Товар, который он нёс, возвращается на полки.
    const stock = { ...this.state.stock };
    for (const id of c.items) stock[id] = Math.min(SHELF_CAPACITY, stock[id] + 1);
    this.state = { ...this.state, stock };
    c.items = [];
    this.refreshShelves();
    this.stats.lost++;
    haptic.error();
    this.popup(c.sprite.x, c.sprite.y - 14, t('popup.leftAngry'), '#ffd0d0');
    this.layoutQueue();
    await this.leave(c);
  }

  private async leave(c: Customer): Promise<void> {
    c.gone = true;
    await this.walk(c, DOOR.x, WORLD_H + 12);
    c.sprite.destroy();
    this.customers.delete(c);
  }

  private layoutQueue(): void {
    this.queue.forEach((c, i) => {
      void this.walk(c, REGISTER.x - 22 - i * 13, REGISTER.y + 6);
    });
  }

  private isAtRegister(c: Customer): boolean {
    return Phaser.Math.Distance.Between(c.sprite.x, c.sprite.y, REGISTER.x - 22, REGISTER.y + 6) < 2;
  }

  private updateBubble(c: Customer): void {
    const left = 1 - (this.time.now - c.waitStart) / PATIENCE_MS;
    c.bubble.setTint(left > 0.6 ? 0x8fd16a : left > 0.3 ? 0xf2c14e : 0xd95763);
  }

  private walk(c: Customer, x: number, y: number): Promise<void> {
    this.tweens.killTweensOf(c.sprite);
    const distance = Phaser.Math.Distance.Between(c.sprite.x, c.sprite.y, x, y);
    return new Promise((resolve) => {
      this.tweens.add({
        targets: c.sprite,
        x,
        y,
        duration: (distance / WALK_SPEED) * 1000,
        onUpdate: () => c.sprite.setDepth(c.sprite.y),
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

  private startDay(): void {
    this.stats = emptyDayStats();
    this.timeLeft = DAY_SECONDS;
    this.nextSpawn = 1;
    this.running = true;
  }

  private finishDay(): void {
    this.running = false;
    const finishedDay = this.state.day;
    this.state = endDay(this.state, this.stats);
    saveGame(this.state);
    this.hud.update(this.state, 0);
    this.hud.showSummary(
      finishedDay,
      this.stats,
      {
        cost: restockCost(this.state),
        affordable: restockCost(this.state) <= this.state.money,
        run: () => {
          this.state = restock(this.state) ?? this.state;
          saveGame(this.state);
          this.refreshShelves();
          this.hud.update(this.state, 0);
        },
      },
      () => this.startDay(),
    );
  }
}
