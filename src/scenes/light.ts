// Свет — карта освещения. Раньше ночь была затемнением (прямоугольники умножением поверх мира), а лампы,
// витрины и фонари — белыми пятнами сложением поверх него: выходила молочная дымка, а не свет, и ночной
// зал был ровно-серым, без пятен света. Теперь сцена сначала темнеет, а потом в темноту «вписывается» свет.
// В небольшую картинку — карту — заливается фон (сколько света сейчас на улице и в зале), сверху
// сложением рисуются источники: лампы под потолком, подсветка полок, свет витрин на тротуаре, конусы
// фонарей, фары, холодильники, неон, экран кассы, огонь плиты. Готовая карта ложится на мир умножением:
// под лампой пол виден в своём (тёплом) цвете, в углах — темнее, у холодильников — голубое свечение.
// Сами лампочки, неоновые буквы и стёкла витрин светятся поверх карты (сцена рисует их сложением выше неё).
//
// Модуль сам по себе: сцена (StoreScene) задаёт фон и регистрирует источники, а карта перерисовывается,
// только когда что-то в ней изменилось — свет почти всё время стоит. Ясным днём фон белый, и карту не
// рисуем вовсе (в дождь, без электричества и в лёгкой графике с оттенком часа — рисуем). Всё — обычными
// средствами (динамическая текстура, спрайты, наложение ADD и MULTIPLY), без своих шейдеров: переезд на
// Phaser 4 затронет только этот файл.

import Phaser from 'phaser';
import { darkness, mulColor } from './daylight';

export type LightTier = 'lite' | 'normal' | 'high';

/** Прямоугольник мира (в точках мира). */
export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Сколько точек мира в одной точке карты: свет мягкий, мельче не нужно; в лёгкой графике — грубее. */
const TEXEL: Record<LightTier, number> = { lite: 4, normal: 2.5, high: 2 };
/** Больше этого карта по стороне не бывает: шире мир — точка карты крупнее. */
const MAX_SIDE = 1024;
/**
 * Как часто карту можно перерисовывать (мс). В высокой графике — не чаще 60 раз в секунду, в обычной —
 * 30 (фары едут плавно и так), в лёгкой — четырёх и без движущихся источников: карта почти неподвижна,
 * как запечённая.
 */
const REDRAW_MS: Record<LightTier, number> = { lite: 250, normal: 33, high: 16 };
/** Изменение яркости источника меньше этого не стоит перерисовки (плавное угасание — не больше 64 шагов). */
const EPS = 1 / 64;
/** Сдвиг источника меньше этого (точки мира) — тоже. */
const MOVE_EPS = 0.25;
/** Ключ текстуры карты: одна на всю игру, при перестройке мира только меняет размер. */
const KEY = 'lightmap';
/** Рамки вокруг карты: камеру можно отвести далеко, за краем карты — фон улицы. */
const FAR = 3000;

/** Как источник нарисован в карте — чтобы понять, нужна ли перерисовка. */
interface Shot {
  key: string;
  frame: string | number | undefined;
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
  ox: number;
  oy: number;
  fx: boolean;
  fy: boolean;
  color: number;
  power: number;
}

const blank = (): Shot => ({ key: '', frame: undefined, x: NaN, y: NaN, w: NaN, h: NaN, r: NaN, ox: 0.5, oy: 0.5, fx: false, fy: false, color: -1, power: NaN });

/**
 * Источник света в карте: картинка key (из атласа — light_pool, light_cone, light_spill, glow…) с серединой
 * (точкой origin) в x, y, размером w × h, цветом и силой 0…1. Сцена двигает его сама или задаёт sync —
 * перед каждым кадром он сам берёт место у того, за кем следует (фара — у машины, пятно — у лампы).
 */
export class Light {
  key = 'light_pool';
  frame?: string | number;
  x = 0;
  y = 0;
  w = 0;
  h = 0;
  originX = 0.5;
  originY = 0.5;
  rotation = 0;
  flipX = false;
  flipY = false;
  color = 0xffffff;
  /** Сила 0…1 (умножается на цвет и на прозрачность картинки света). */
  power = 1;
  /** Двигается (фары): в лёгкой графике его нет. */
  moving = false;
  /** Перед каждым кадром: свет сам обновляет место и силу. */
  sync?: () => void;
  dead = false;
  /** Как нарисован в прошлый раз. */
  readonly drawn: Shot = blank();

  /** Сила света (0 — не горит). */
  set(power: number): this {
    this.power = power;
    return this;
  }

  /** Свет живёт, пока жив предмет: машина уехала — фары гаснут вместе с ней. */
  attach(obj: Phaser.GameObjects.GameObject): this {
    obj.once(Phaser.GameObjects.Events.DESTROY, () => (this.dead = true));
    return this;
  }
}

/** Как свет следует за картинкой мира (follow). */
export interface FollowSpec {
  /** Своя картинка света; нет — сама картинка предмета (её кадр, размер, поворот и отражение). */
  key?: string;
  /** Размер своей картинки (точки мира); без key — множитель размера картинки предмета. */
  w?: number;
  h?: number;
  scale?: number;
  /** Сдвиг от предмета. */
  dx?: number;
  dy?: number;
  /** Цвет; нет — тинт предмета. */
  color?: number;
  /** Сила: каждый кадр (скажем, по прозрачности предмета); нет — её задаёт сцена (Light.set). */
  power?: () => number;
}

/** Карта освещения сцены. */
export class LightMap {
  private texture?: Phaser.Textures.DynamicTexture;
  private image?: Phaser.GameObjects.Image;
  private frames: Phaser.GameObjects.Rectangle[] = [];
  private stamp?: Phaser.GameObjects.Image;
  private lights: Light[] = [];
  private area: Area = { x: 0, y: 0, w: 1, h: 1 };
  private rooms: Area[] = [];
  private texel = 2;
  private outdoor = 0xffffff;
  private inside = 0xffffff;
  private tint = 0xffffff;
  private drawnAmbient = '';
  private dirty = true;
  private drawnAt = -Infinity;
  private shown = true;
  private readonly matrix = new Phaser.GameObjects.Components.TransformMatrix();
  private readonly parent = new Phaser.GameObjects.Components.TransformMatrix();
  /** Место предмета (place): один объект на все вызовы — каждый кадр без мусора в памяти. */
  private readonly where = { x: 0, y: 0, r: 0, sx: 1, sy: 1 };
  /** Сколько раз карту перерисовали (для замеров). */
  redraws = 0;

  constructor(
    private scene: Phaser.Scene,
    private tier: LightTier,
  ) {}

  /** Игра сама перешла на лёгкую графику: карта грубее и реже — с ближайшей перестройки мира. */
  setTier(tier: LightTier): void {
    this.tier = tier;
    this.dirty = true;
  }

  /**
   * Новый мир (перестройка зала): карта под его размер, источники — заново. Старые картинки карты
   * уничтожены вместе со старым миром; сама текстура карты — одна на всю игру.
   * area — где есть свет (за её краем — фон улицы), rooms — зал и флигель (там свой фон), depth — слой.
   */
  reset(area: Area, rooms: Area[], depth: number): void {
    this.lights = [];
    this.area = area;
    this.rooms = rooms;
    this.texel = Math.max(TEXEL[this.tier], area.w / MAX_SIDE, area.h / MAX_SIDE);
    // Стороны — чётные: динамическую текстуру Phaser сам округляет вверх до чётной, и при нечётной она
    // вышла бы на точку больше, чем считают рамки, — край карты лёг бы под рамку и умножился дважды
    // (тёмная полоса через весь мир).
    const even = (n: number) => n + (n & 1);
    const w = even(Math.max(2, Math.ceil(area.w / this.texel)));
    const h = even(Math.max(2, Math.ceil(area.h / this.texel)));
    const textures = this.scene.textures;
    let texture = textures.exists(KEY) ? (textures.get(KEY) as Phaser.Textures.DynamicTexture) : undefined;
    if (!texture) texture = textures.addDynamicTexture(KEY, w, h) ?? undefined;
    else if (texture.width !== w || texture.height !== h) {
      // Буфер карты в видеокарте сам размер не меняет (autoResize у динамической текстуры выключен): без
      // этого после расширения магазина рисовали бы в старый размер, а растягивали на новый — свет съезжал.
      texture.renderTarget?.setAutoResize(true);
      texture.setSize(w, h);
      texture.renderTarget?.setAutoResize(false);
    }
    this.texture = texture;
    // Свет мягкий: карту растягиваем сглаженно (весь остальной мир — по пикселям).
    texture?.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.image = texture ? this.scene.add.image(area.x, area.y, KEY).setOrigin(0).setScale(this.texel).setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(depth) : undefined;
    const frame = (x: number, y: number, fw: number, fh: number) =>
      this.scene.add.rectangle(x, y, fw, fh, 0xffffff).setOrigin(0).setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(depth);
    const right = area.x + w * this.texel;
    const bottom = area.y + h * this.texel;
    this.frames = [
      frame(area.x - FAR, area.y - FAR, right - area.x + 2 * FAR, FAR),
      frame(area.x - FAR, bottom, right - area.x + 2 * FAR, FAR),
      frame(area.x - FAR, area.y, FAR, bottom - area.y),
      frame(right, area.y, FAR, bottom - area.y),
    ];
    // Печать для рисования в карту: в мире её нет.
    this.stamp ??= this.scene.make.image({ key: '__WHITE', add: false });
    this.drawnAmbient = '';
    this.dirty = true;
    this.drawnAt = -Infinity;
    this.shown = true;
    this.show(false);
  }

  /**
   * Фон: улица и зал; tint — оттенок часа поверх всего, и фона, и огней (в лёгкой графике, где нет
   * цветокоррекции). Всё белое — карта не нужна (день).
   */
  ambient(outdoor: number, indoor: number, tint = 0xffffff): void {
    this.outdoor = outdoor;
    this.inside = indoor;
    this.tint = tint;
  }

  /** Свой источник: картинка key с серединой в x, y размером w × h. */
  add(key: string, x: number, y: number, w: number, h: number, color: number, power = 1): Light {
    const light = new Light();
    Object.assign(light, { key, x, y, w, h, color, power });
    this.lights.push(light);
    return light;
  }

  /**
   * Свет следует за предметом мира (и в контейнере — за самим контейнером): его место, а у картинки без
   * своей картинки света (spec.key) — и её кадр, размер, поворот, отражение и тинт. Цвет фигуры —
   * её заливка. Предмет уничтожен — света нет.
   */
  follow(source: Phaser.GameObjects.Image | Phaser.GameObjects.Shape, spec: FollowSpec = {}): Light {
    const light = new Light();
    const { dx = 0, dy = 0, color, power } = spec;
    const key = spec.key ?? (source instanceof Phaser.GameObjects.Image ? undefined : 'glow');
    light.sync = () => {
      const t = this.place(source);
      if (key || !(source instanceof Phaser.GameObjects.Image)) {
        light.key = key ?? 'glow';
        light.x = t.x + dx;
        light.y = t.y + dy;
        light.w = spec.w ?? 16;
        light.h = spec.h ?? 16;
      } else {
        const scale = spec.scale ?? 1;
        light.key = source.texture.key;
        light.frame = source.frame.name;
        light.x = t.x + dx;
        light.y = t.y + dy;
        light.w = source.frame.realWidth * t.sx * scale;
        light.h = source.frame.realHeight * t.sy * scale;
        light.originX = source.originX;
        light.originY = source.originY;
        light.rotation = t.r;
        light.flipX = source.flipX;
        light.flipY = source.flipY;
      }
      light.color = color ?? (source instanceof Phaser.GameObjects.Image ? source.tintTopLeft : source.fillColor);
      if (power) light.power = source.active ? power() : 0;
    };
    light.attach(source);
    this.lights.push(light);
    return light;
  }

  /** WebGL вернул контекст: нарисованное в текстуре пропало — нарисовать заново. */
  invalidate(): void {
    this.dirty = true;
    this.drawnAt = -Infinity;
  }

  /** Каждый кадр: если свет изменился — перерисовать карту. */
  update(now: number): void {
    if (!this.image?.active || !this.texture) return;
    // Погасшие насовсем (машина уехала, полку перерисовали) — из списка, и днём тоже: иначе копились бы весь день.
    for (let i = this.lights.length - 1; i >= 0; i--) {
      const light = this.lights[i];
      if (!light.dead) continue;
      this.lights.splice(i, 1);
      if (light.drawn.power > EPS) this.dirty = true;
    }
    // Днём фон белый: карта ничего не меняет — не рисуем ни её, ни рамки.
    const needed = darkness(this.outdoor) > 0.002 || darkness(this.inside) > 0.002 || darkness(this.tint) > 0.002;
    this.show(needed);
    if (!needed) return;
    const ambient = `${this.outdoor}/${this.inside}/${this.tint}`;
    if (ambient !== this.drawnAmbient) {
      this.dirty = true;
      for (const frame of this.frames) frame.setFillStyle(mulColor(this.outdoor, this.tint));
    }
    const lite = this.tier === 'lite';
    for (const light of this.lights) {
      if (lite && light.moving) continue;
      light.sync?.();
      if (!this.dirty && this.changed(light)) this.dirty = true;
    }
    if (!this.dirty || now - this.drawnAt < REDRAW_MS[this.tier]) return;
    this.redraw();
    this.drawnAt = now;
  }

  /** Место предмета в мире: у картинки в контейнере (машина, человек) — с поправкой на контейнер. */
  private place(obj: Phaser.GameObjects.Image | Phaser.GameObjects.Shape): { x: number; y: number; r: number; sx: number; sy: number } {
    const at = this.where;
    if (!obj.parentContainer) return Object.assign(at, { x: obj.x, y: obj.y, r: obj.rotation, sx: Math.abs(obj.scaleX), sy: Math.abs(obj.scaleY) });
    const d = obj.getWorldTransformMatrix(this.matrix, this.parent).decomposeMatrix();
    return Object.assign(at, { x: d.translateX, y: d.translateY, r: d.rotation, sx: Math.abs(d.scaleX), sy: Math.abs(d.scaleY) });
  }

  /** Отличается ли источник от того, как нарисован. */
  private changed(light: Light): boolean {
    const d = light.drawn;
    if (Math.abs(light.power - d.power) > EPS) return true;
    if (light.power <= EPS) return false;
    return (
      Math.abs(light.x - d.x) > MOVE_EPS ||
      Math.abs(light.y - d.y) > MOVE_EPS ||
      Math.abs(light.w - d.w) > MOVE_EPS ||
      Math.abs(light.h - d.h) > MOVE_EPS ||
      Math.abs(light.rotation - d.r) > 0.01 ||
      light.color !== d.color ||
      light.key !== d.key ||
      light.frame !== d.frame ||
      light.flipX !== d.fx ||
      light.flipY !== d.fy ||
      light.originX !== d.ox ||
      light.originY !== d.oy
    );
  }

  private show(on: boolean): void {
    if (this.shown === on) return;
    this.shown = on;
    this.image?.setVisible(on);
    for (const frame of this.frames) frame.setVisible(on);
  }

  /** Перерисовать карту: фон улицы, фон зала, сверху сложением — источники. */
  private redraw(): void {
    const texture = this.texture;
    const stamp = this.stamp;
    if (!texture || !stamp) return;
    this.redraws++;
    const { area, texel } = this;
    const cam = texture.camera;
    cam.setZoom(1 / texel);
    cam.centerOn(area.x + (texture.width * texel) / 2, area.y + (texture.height * texel) / 2);
    texture.beginDraw();
    // Фон — обычным наложением: заливает всё, прозрачного не остаётся (иначе сложение не с чем складывать).
    const fill = (x: number, y: number, w: number, h: number, color: number) => {
      stamp.setTexture('__WHITE').setOrigin(0).setDisplaySize(w, h).setRotation(0).setFlip(false, false).setTint(color).setAlpha(1).setBlendMode(Phaser.BlendModes.NORMAL);
      texture.batchDraw(stamp, x, y);
    };
    fill(area.x - texel, area.y - texel, texture.width * texel + 2 * texel, texture.height * texel + 2 * texel, this.outdoor);
    for (const room of this.rooms) fill(room.x, room.y, room.w, room.h, this.inside);
    const lite = this.tier === 'lite';
    for (const light of this.lights) {
      const d = light.drawn;
      if (lite && light.moving) {
        d.power = 0;
        continue;
      }
      d.power = light.power;
      if (light.power <= EPS || light.dead) continue;
      Object.assign(d, {
        key: light.key,
        frame: light.frame,
        x: light.x,
        y: light.y,
        w: light.w,
        h: light.h,
        r: light.rotation,
        ox: light.originX,
        oy: light.originY,
        fx: light.flipX,
        fy: light.flipY,
        color: light.color,
      });
      stamp
        .setTexture(light.key, light.frame)
        .setOrigin(light.originX, light.originY)
        .setDisplaySize(light.w, light.h)
        .setFlip(light.flipX, light.flipY)
        .setRotation(light.rotation)
        .setTint(light.color)
        .setAlpha(Math.min(1, light.power))
        .setBlendMode(Phaser.BlendModes.ADD);
      texture.batchDraw(stamp, light.x, light.y);
    }
    // Оттенок часа — умножением поверх фона и огней.
    if (this.tint !== 0xffffff) {
      stamp.setTexture('__WHITE').setOrigin(0).setDisplaySize(texture.width * texel + 2 * texel, texture.height * texel + 2 * texel).setRotation(0).setFlip(false, false);
      stamp.setTint(this.tint).setAlpha(1).setBlendMode(Phaser.BlendModes.MULTIPLY);
      texture.batchDraw(stamp, area.x - texel, area.y - texel);
    }
    // Последним — пустая печать обычным наложением: готовая карта переносится из буфера в текстуру тем
    // наложением, что осталось от последней печати, и сложением она сложилась бы со своим прошлым видом.
    stamp.setTexture('__WHITE').setOrigin(0).setDisplaySize(1, 1).setAlpha(0).setBlendMode(Phaser.BlendModes.NORMAL);
    texture.batchDraw(stamp, area.x, area.y);
    texture.endDraw();
    this.drawnAmbient = `${this.outdoor}/${this.inside}/${this.tint}`;
    this.dirty = false;
  }
}
