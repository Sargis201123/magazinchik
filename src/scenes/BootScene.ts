import Phaser from 'phaser';
import atlas from 'virtual:atlas';
import { startSync } from '../game/save';
import { t } from '../i18n';
import { assetUrl, png } from '../platform/assets';
import { DOM_TEXTURES, TEXTURES } from './textures';

/**
 * Текстура-кадр общего листа атласа под старым именем ('shelf', 'p_legs1_s'…). Своей картинки
 * у неё нет: источник — лист, поэтому и в видеокарте это одна текстура на всех, и соседние спрайты
 * рисуются одной пачкой, а this.art(), setTexture() и texture.key работают как с отдельной картинкой.
 */
class SheetFrame extends Phaser.Textures.Texture {
  constructor(manager: Phaser.Textures.TextureManager, key: string, sheet: Phaser.Textures.Texture, frame: Phaser.Textures.Frame) {
    super(manager, key, []);
    this.source.push(sheet.source[0]);
    this.add('__BASE', 0, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight);
  }

  /** Лист общий: убрать одну текстуру — не повод освобождать его в видеокарте. */
  destroy(): void {
    this.source = [];
    super.destroy();
  }
}

/** Разложить лист атласа обратно по именам: каждая картинка мира — текстура со своим ключом. */
function spreadSheet(textures: Phaser.Textures.TextureManager, name: string): void {
  const sheet = textures.get(name);
  const list = textures.list as Record<string, Phaser.Textures.Texture>;
  for (const key of sheet.getFrameNames()) {
    if (!textures.exists(key)) list[key] = new SheetFrame(textures, key, sheet, sheet.get(key));
  }
}

/**
 * Меню берут картинки мира не из листа атласа, а отдельными файлами (DOM_TEXTURES). Пока ждём сверку
 * с облаком, сеть свободна — прогреваем ими кэш браузера по тому же адресу с отпечатком (png), иначе у
 * новенького на медленной связи монетка в HUD и товары в первом утреннем окне проявлялись бы по одной.
 * Игру это не держит; вернувшемуся игроку файлы отдаёт кэш (assets/ кэшируются на год).
 */
function warmMenuImages(): void {
  for (const key of DOM_TEXTURES) new Image().src = png(key);
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  /** Шрифт надписей на холсте: качается вместе с картинками, а не после них. */
  private font: Promise<unknown> = Promise.resolve();

  preload(): void {
    // Надписи на холсте рисуются один раз — магазин ждёт шрифт (create), иначе останутся системным.
    this.font = document.fonts?.load(`600 16px "Nunito Variable"`).catch(() => []) ?? Promise.resolve([]);
    const splash = document.getElementById('splash');
    const bar = splash?.querySelector<HTMLElement>('.bar');
    const txt = splash?.querySelector('.txt');
    if (txt) txt.textContent = t('boot.loading');
    // Картинки мира — листами атласа (собирает сборка, scripts/atlas.ts), а не восемью сотнями файлов.
    // Адреса — с отпечатком содержимого (platform/assets.ts): перерисованная картинка не застрянет в кэше.
    for (const page of atlas.pages) this.load.atlas(page.name, png(page.name), assetUrl(`assets/${page.name}.json`));
    for (const key of atlas.loose) this.load.image(key, png(key));
    // Значки меню (ico_*) одним атласом — для всплывающих надписей в зале (art/icons.py → atlas).
    this.load.atlas('ico', png('ico_atlas'), assetUrl('assets/ico_atlas.json'));
    // Полоска — по байтам, а не по числу готовых файлов: файлов теперь несколько, и почти всё время
    // качается лист атласа — по файлам полоска стояла бы, а потом прыгала.
    const bytes = new Map(atlas.pages.map((p) => [p.name, p.bytes]));
    const files = this.load.list.getArray();
    const weight = (f: Phaser.Loader.File): number => (f.type === 'image' && bytes.get(f.key)) || 20_000;
    const total = files.reduce((sum, f) => sum + weight(f), 0);
    const got = new Map<Phaser.Loader.File, number>();
    const show = (file: Phaser.Loader.File, part: number): void => {
      got.set(file, part);
      let sum = 0;
      for (const [f, p] of got) sum += weight(f) * p;
      bar?.style.setProperty('--p', Math.min(1, sum / total).toFixed(3));
    };
    this.load.on('fileprogress', (file: Phaser.Loader.File, part: number) => show(file, part));
    this.load.on('load', (file: Phaser.Loader.File) => show(file, 1));
    this.load.on('loaderror', (file: Phaser.Loader.File) => show(file, 1));
  }

  create(): void {
    for (const page of atlas.pages) spreadSheet(this.textures, page.name);
    // Лист не догрузился (оборвалась связь) — недостающие картинки по одной, как до атласа.
    const missing = TEXTURES.filter((key) => !this.textures.exists(key));
    if (!missing.length) return this.ready();
    for (const key of missing) this.load.image(key, png(key));
    this.load.once('complete', () => this.ready());
    this.load.start();
  }

  /** Картинки на месте: дождаться сверки с облаком — и в магазин. */
  private ready(): void {
    warmMenuImages();
    // Сохранение сверяется с облаком Telegram с самого запуска (main.ts), параллельно с картинками;
    // здесь только дождаться конца (не дольше пары секунд) — и в магазин.
    const splash = document.getElementById('splash');
    const txt = splash?.querySelector('.txt');
    if (txt) txt.textContent = t('boot.sync');
    const start = () => {
      if (!this.scene.isActive('boot')) return;
      this.scene.start('store');
      // Заставка тает, когда магазин уже нарисован.
      splash?.classList.add('gone');
      setTimeout(() => splash?.remove(), 500);
    };
    const timer = setTimeout(start, 4000);
    void Promise.all([startSync(), this.font]).finally(() => {
      clearTimeout(timer);
      start();
    });
  }
}
