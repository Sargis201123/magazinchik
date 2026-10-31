// Активные моменты дня в зале (правила — src/game/moments.ts): монетка на полу, банка чаевых у кассы,
// гость машет, просит уступить, разбилась банка варенья, довольный гость оставил звёздочку. Над моментом —
// золотое кольцо-таймер: сжимается, пока ждёт нажатия (MOMENT_WINDOW_MS настоящего времени — на ×2 окно
// не короче). Нажал — награда и «дзынь», не успел — момент тихо тает, без штрафа. Пока поверх зала окно,
// звонок доставки или бабушкина стрелка — новый не начинается, а начатый ждёт. Расписание — по секундам
// дня из update (а не таймерами): перестройка зала момент убирает, следующие придут в своё время.
// На слабом телефоне (lite) кольцо не пульсирует и нет искр.

import Phaser from 'phaser';
import { MOMENT_PATIENCE, MOMENT_WINDOW_MS, momentNow, type MomentKind, type MomentPlan } from '../game/moments';
import { t, type TextKey } from '../i18n';

/** Во сколько раз пиксели спрайта мельче точек мира (как ART в StoreScene). */
const ART = 2;
/** Поверх людей и полок, но под надписями (как живые события дня). */
const DEPTH = 899;
const GOLD = 0xfee761;
/** Палец — не мышь: зона нажатия не меньше стольких точек экрана (CSS) и не меньше HIT точек мира. */
const HIT_CSS = 52;
const HIT = 30;
/** Значок и кольцо на дальнем плане (большой магазин целиком) крупнее: не мельче стольких точек экрана на точку мира. */
const LOOK_CSS = 1.8;

type Point = { x: number; y: number };

/** Что моменту нужно от сцены. */
export interface MomentHost {
  scene: Phaser.Scene;
  lite(): boolean;
  /** Нельзя начинать (и начатый ждёт): окно поверх зала, звонок, обучение, ночь, перестановка. */
  blocked(): boolean;
  /** Гость, который бродит по залу (постоянный — первым), и первый в очереди; null — некого. */
  hallGuest(): Phaser.GameObjects.Container | null;
  queueGuest(): Phaser.GameObjects.Container | null;
  /** Касса хозяина и свободное место на полу. */
  till(): Point;
  floor(): Point;
  popup(x: number, y: number, text: string, color: string): void;
  emote(person: Phaser.GameObjects.Container, key: 'emo_heart' | 'emo_star' | 'emo_pricey'): void;
  coins(x: number, y: number, n: number): void;
  puff(x: number, y: number): void;
  /** Нажатие засчитывается, если палец не двигал камеру. */
  tap(action: () => void): void;
  /** Поймали: награда (деньги, искорка) и учёт; вернуть подпись над моментом. */
  caught(kind: MomentKind): string;
  /** Показан и не пойман (растаял или убран перестройкой). */
  missed(kind: MomentKind): void;
}

interface Active {
  kind: MomentKind;
  /** Сколько мс настоящего времени ещё ждёт нажатия. */
  left: number;
  objs: Phaser.GameObjects.GameObject[];
  ring: Phaser.GameObjects.Graphics;
  /**
   * Картинка момента (монетка, банка, лужа) или значок над гостем. Нажимается она сама, с областью больше
   * картинки: невидимая Zone проигрывала бы касание любой нарисованной вещи под ней (Phaser выбирает
   * верхний объект по списку отрисовки, а зоны в нём нет).
   */
  icon: Phaser.GameObjects.Image;
  /** За кем следует (гость) — значок и кольцо держатся над головой. */
  follow?: Phaser.GameObjects.Container;
  at: Point;
  /** Во сколько раз крупнее обычного (дальний план камеры). */
  size: number;
}

export class Moments {
  private plan: MomentPlan[] = [];
  private active: Active | null = null;

  constructor(private readonly host: MomentHost) {}

  /** Утро: расписание на день (game/moments.ts momentsFor). */
  start(plan: MomentPlan[]): void {
    this.clear();
    this.plan = [...plan];
  }

  /** Идёт ли момент сейчас (для подсказки внизу). */
  get showing(): boolean {
    return Boolean(this.active);
  }

  /**
   * Каждый кадр: elapsed — секунды дня, realMs — настоящее время кадра. Пришло время — начать
   * (или подождать, если зал занят; опоздал больше чем на MOMENT_PATIENCE — пропустить), идущий — отсчитать.
   */
  tick(elapsed: number, realMs: number): void {
    const blocked = this.host.blocked();
    if (this.active) {
      this.follow(this.active);
      if (!blocked) this.active.left -= realMs;
      this.drawRing(this.active);
      if (this.active.left <= 0 || !this.active.icon.active) this.fade(this.active);
      return;
    }
    const next = this.plan[0];
    if (!next || elapsed < next.at) return;
    if (elapsed > next.at + MOMENT_PATIENCE) {
      this.plan.shift();
      return;
    }
    if (blocked) return;
    this.plan.shift();
    this.show(next.kind);
  }

  /** Перестройка зала или конец дня: идущий момент убрать (он не пойман), расписание — оставить. */
  clear(): void {
    const a = this.active;
    if (!a) return;
    this.active = null;
    for (const obj of a.objs) obj.destroy();
    this.host.missed(a.kind);
  }

  /** Конец дня: и расписание прочь. */
  stop(): void {
    this.clear();
    this.plan = [];
  }

  private show(planned: MomentKind): void {
    const { host } = this;
    const hall = host.hallGuest();
    const queue = host.queueGuest();
    const kind = momentNow(planned, { hall: Boolean(hall), queue: Boolean(queue) });
    const scene = host.scene;
    let at: Point;
    let follow: Phaser.GameObjects.Container | undefined;
    let key: string;
    switch (kind) {
      case 'coin': {
        // Малыш уронил монетку: падает у ног гостя (или посреди зала), подпрыгивает и блестит.
        const p = hall ?? host.floor();
        at = { x: p.x + Phaser.Math.Between(-10, 10), y: p.y + 10 };
        key = 'coin';
        break;
      }
      case 'tipjar': {
        const till = host.till();
        at = { x: till.x - 12, y: till.y - 10 };
        key = 'tip_jar';
        break;
      }
      case 'spill':
        at = host.floor();
        key = 'jam_splat';
        break;
      default:
        follow = (kind === 'haggle' ? queue : hall) ?? undefined;
        at = { x: follow!.x, y: follow!.y - 22 };
        key = kind === 'haggle' ? 'emo_pricey' : kind === 'wave' ? 'emo_heart' : 'emo_star';
    }
    // Сколько точек экрана (CSS) на точку мира: на дальнем плане момент крупнее, а палец попадает всегда.
    const cam = scene.cameras.main;
    const canvas = scene.game.canvas;
    const css = (cam.zoom * (canvas.clientWidth || canvas.width)) / canvas.width;
    const size = Phaser.Math.Clamp(LOOK_CSS / css, 1, 3);
    const hit = Math.max(HIT, HIT_CSS / css);
    const scale = ((kind === 'coin' ? 1.4 : 1) * size) / ART;
    const icon = scene.add.image(at.x, at.y, key).setScale(scale).setDepth(DEPTH);
    const ring = scene.add.graphics().setDepth(DEPTH - 1);
    // Область касания — в точках картинки (у неё свой масштаб); над гостем — вниз, до его ног.
    const local = hit / scale;
    const down = follow ? 10 / scale : 0;
    icon.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(icon.width / 2 - local / 2, icon.height / 2 - local / 2 + down, local, local),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    const a: Active = { kind, left: MOMENT_WINDOW_MS, objs: [icon, ring], ring, icon, follow, at, size };
    this.active = a;
    icon.on('pointerup', () => host.tap(() => this.catch(a)));
    // Появление: монетка падает и подпрыгивает, остальное выпрыгивает; дальше — мягкая пульсация.
    if (kind === 'coin') {
      icon.setY(at.y - 16 * size);
      scene.tweens.add({ targets: icon, y: at.y, duration: 380, ease: 'Bounce.easeOut' });
    } else {
      icon.setScale(scale * 0.3);
      scene.tweens.add({ targets: icon, scale, duration: 220, ease: 'Back.easeOut' });
    }
    if (!host.lite()) scene.tweens.add({ targets: icon, angle: { from: -8, to: 8 }, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 400 });
    if (follow && kind !== 'star') host.emote(follow, kind === 'haggle' ? 'emo_pricey' : 'emo_heart');
    host.popup(at.x, at.y - 12 * size, t(`moment.${kind}` as TextKey), '#fee761');
    this.drawRing(a);
  }

  /** Значок над гостем идёт вместе с ним; гость ушёл совсем — момент тает. */
  private follow(a: Active): void {
    if (!a.follow) return;
    if (!a.follow.active || !a.follow.visible) {
      a.left = 0;
      return;
    }
    a.at = { x: a.follow.x, y: a.follow.y - 22 };
    a.icon.setPosition(a.at.x, a.at.y);
  }

  /** Кольцо-таймер: золотая дуга, которая убывает, пока момент ждёт. */
  private drawRing(a: Active): void {
    const share = Math.max(0, a.left / MOMENT_WINDOW_MS);
    const r = (9 + (this.host.lite() ? 0 : Math.sin(this.host.scene.time.now / 160) * 0.8)) * a.size;
    a.ring.clear();
    a.ring.lineStyle(2.5 * a.size, 0x181425, 0.55).strokeCircle(a.at.x, a.at.y, r);
    a.ring.lineStyle(1.5 * a.size, GOLD, 1).beginPath();
    a.ring.arc(a.at.x, a.at.y, r, -Math.PI / 2, -Math.PI / 2 + share * Math.PI * 2, false).strokePath();
  }

  private catch(a: Active): void {
    if (this.active !== a) return;
    this.active = null;
    const { host } = this;
    const scene = host.scene;
    a.icon.disableInteractive();
    a.ring.destroy();
    const label = host.caught(a.kind);
    if (a.follow?.active) host.emote(a.follow, a.kind === 'haggle' ? 'emo_heart' : 'emo_star');
    if (a.kind === 'spill') host.puff(a.at.x, a.at.y);
    if (a.kind === 'coin' || a.kind === 'tipjar' || a.kind === 'wave') host.coins(a.at.x, a.at.y, a.kind === 'tipjar' ? 6 : 3);
    host.popup(a.at.x, a.at.y - 14 * a.size, label, a.kind === 'spill' || a.kind === 'star' || a.kind === 'haggle' ? '#c8f0ff' : '#c8ffb0');
    if (!host.lite()) this.sparks(a.at, a.size);
    scene.tweens.killTweensOf(a.icon);
    scene.tweens.add({
      targets: a.icon,
      y: a.at.y - 10 * a.size,
      scale: (1.4 * a.size) / ART,
      alpha: 0,
      duration: 360,
      ease: 'Cubic.easeOut',
      onComplete: () => a.icon.destroy(),
    });
  }

  /** Не успел: тает без звука и надписей. */
  private fade(a: Active): void {
    this.active = null;
    this.host.missed(a.kind);
    a.icon.disableInteractive();
    a.ring.destroy();
    const scene = this.host.scene;
    scene.tweens.killTweensOf(a.icon);
    if (!a.icon.active) return;
    scene.tweens.add({ targets: a.icon, alpha: 0, duration: 400, onComplete: () => a.icon.destroy() });
  }

  /** Четыре золотые искры врассыпную. */
  private sparks(at: Point, size: number): void {
    const scene = this.host.scene;
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI / 2) * i + Math.PI / 4;
      const dot = scene.add.rectangle(at.x, at.y, 2 * size, 2 * size, GOLD).setDepth(DEPTH + 2);
      scene.tweens.add({ targets: dot, x: at.x + Math.cos(angle) * 12 * size, y: at.y + Math.sin(angle) * 12 * size, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => dot.destroy() });
    }
  }
}

