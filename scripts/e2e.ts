// Страховка перед переделками (npm run e2e): игра собирается, запускается в браузере без экрана,
// магазин середины игры (e2e/save.json) проживает целый день до итогов, а по дороге снимаются одни
// и те же кадры — утро, день, вечер, ночная смена, дождь, на трёх уровнях магазина. Снимки — в
// e2e/shots; если есть эталон (e2e/baseline, его кладёт npm run e2e -- --update), каждый кадр
// сравнивается с ним по точкам, отличия — красным в e2e/diff. Ошибка в странице, файл игры, который
// не загрузился (404 и обрывы со своего адреса), атлас, не дошедший до сцены, зависший день или
// отличие от эталона — провал (код выхода 1).
//
// Кадры совпадают от запуска к запуску до точки: часы в странице свои (время стоит, пока проверка
// не скажет «прошла секунда», и кадры идут ровно через 16 мс), случайные числа — с одним зерном,
// а звука нет — его расписание идёт по настоящим часам и тратило бы случайные числа как попало.
// Эталон сравним только с тем же компьютером и браузером — снимайте его там же, где проверяете.
//
// Ключи:
//   --update            снимки этого прогона сделать эталоном
//   --no-build          не собирать, взять готовую dist/
//   --url <адрес>       проверять уже запущенную игру (без сборки и своего сервера)
//   --only <имя>        только один прогон: l5, rain, l3, l2
//   --threshold <доля>  какая доля точек кадра может отличаться от эталона (по умолчанию 0)
//   --port <номер>      порт своего сервера (по умолчанию 4173, занят — возьмёт следующий)
// Нужен Playwright с Chromium: npm i -D playwright && npx playwright install chromium
// (свой Chromium — переменная CHROMIUM_PATH).

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { Page } from 'playwright';
import { DAY_SECONDS, STORE_LEVELS } from '../src/game/economy';
import { NIGHT_SECONDS } from '../src/game/night';
import { weatherFor } from '../src/game/weather';
import { ru } from '../src/i18n/ru';
import { decodePng, encodePng } from './png';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIR = `${ROOT}e2e/`;
const SHOTS = `${DIR}shots/`;
const BASELINE = `${DIR}baseline/`;
const DIFF = `${DIR}diff/`;

const args = process.argv.slice(2);
const flag = (name: string): boolean => args.includes(`--${name}`);
const option = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

/** «Сейчас» в странице: от него считаются дата подарка и всё, что смотрит на календарь. */
const NOW = Date.UTC(2026, 5, 15, 9, 0, 0);
/** Зерно случайных чисел: и при загрузке страницы, и в момент запуска сцены магазина. */
const SEED = 20261015;
/** Телефон на Android: Phaser рисует так же, как у игроков (по одной текстуре за раз, MobilePipeline). */
const PHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'ru-RU',
  timezoneId: 'Europe/Moscow',
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
};
/** На сколько двигать часы за шаг при перемотке дня. */
const STEP_MS = 1000;

type SaveFile = { version: number; state: Record<string, unknown> & { day: number; shelves: unknown[] } };

interface Run {
  name: string;
  /** Что поменять в сохранении. */
  patch: (state: SaveFile['state']) => Record<string, unknown>;
  /** Кадры дня: имя и доля прошедшего дня. */
  shots: [string, number][];
  /** Дожить до итогов: ночная смена (кадр «ночь») и окно итогов дня. */
  fullDay?: boolean;
}

/** Ближайший к дню сохранения дождливый день (погода зависит от дня, а не от случая). */
const rainDay = (from: number): number => {
  for (let d = from; ; d++) if (weatherFor(d) === 'rain') return d;
};

/** Другой уровень помещения: полок не больше, чем мест под них. */
const level = (n: number) => (state: SaveFile['state']) => ({ level: n, shelves: state.shelves.slice(0, STORE_LEVELS[n].slots) });

const RUNS: Run[] = [
  {
    name: 'l5',
    patch: () => ({}),
    shots: [
      ['morning', 0.06],
      ['day', 0.45],
      ['evening', 0.9],
    ],
    fullDay: true,
  },
  // План дня в сохранении — на день 111; на другой день игра составит свой.
  { name: 'rain', patch: (s) => ({ day: rainDay(s.day), plan: undefined }), shots: [['rain', 0.3]] },
  { name: 'l3', patch: level(2), shots: [['day', 0.3]] },
  { name: 'l2', patch: level(1), shots: [['day', 0.3]] },
  // Гипермаркет: переехали в здание «Гиганта», за дорогой — старый магазин-филиал с ремонтом и флажками.
  // Все пять касс с кассирами и четыре киоска — проверяем, что ряд касс с очередью помещается в зале.
  {
    name: 'l6',
    patch: (s) => ({
      level: 5,
      branch: { since: s.day - 30, tiers: { repair: 3, ads: 2, shelves: 1 }, earned: 40000 },
      registers: 5,
      kiosks: { n: 4, tier: 1 },
      staff: [...(s.staff as { role: string }[]), ...['cashier4', 'cashier5'].map((role, i) => ({ ...(s.staff as { role: string }[]).find((m) => m.role === 'cashier2'), role, name: 20 + i }))],
    }),
    shots: [
      ['day', 0.3],
      ['evening', 0.9],
    ],
  },
];

// ---------- Что делается внутри страницы ----------

/** Снимок состояния: сцена магазина и окна поверх неё — по нему проверка решает, что нажать. */
interface Look {
  running: boolean;
  night: boolean;
  dayOpen: boolean;
  timeLeft: number;
  title: boolean;
  open: boolean;
  nightAsk: boolean;
  modals: number;
  dialog: boolean;
  summary: boolean;
}

/** До всех скриптов игры: свои часы, зерно случайных чисел, без звука, счёт вызовов отрисовки, сохранение. */
function prepare({ save, seed, start, labels }: { save: string; seed: number; start: number; labels: { open: string; night: string } }): void {
  // Часы. Время стоит, пока проверка не позовёт run(ms): тогда таймеры и кадры (ровно через 16 мс)
  // срабатывают по порядку, а между ними страница доделывает обещания (await в коде игры).
  let now = 0;
  let seq = 0;
  let nextId = 1;
  type Timer = { at: number; seq: number; fn: (...a: unknown[]) => void; args: unknown[]; every: number };
  const timers = new Map<number, Timer>();
  const add = (fn: unknown, delay: unknown, args: unknown[], every = 0): number => {
    if (typeof fn !== 'function') return 0;
    const id = nextId++;
    timers.set(id, { at: now + Math.max(0, Number(delay) || 0), seq: seq++, fn: fn as Timer['fn'], args, every });
    return id;
  };
  const clear = (id?: number) => void (id && timers.delete(id));
  // Настоящие события (картинка догрузилась, ответ сервера) ждут конца шага — так и они приходят
  // в одно и то же место от запуска к запуску.
  const settle = async () => {
    for (let i = 0; i < 16; i++) await undefined;
  };
  const run = async (ms: number) => {
    const end = now + ms;
    for (;;) {
      let id = 0;
      let next: Timer | undefined;
      for (const [k, t] of timers) if (t.at <= end && (!next || t.at < next.at || (t.at === next.at && t.seq < next.seq))) [id, next] = [k, t];
      if (!next) break;
      now = Math.max(now, next.at);
      if (next.every) Object.assign(next, { at: now + next.every, seq: seq++ });
      else timers.delete(id);
      try {
        next.fn(...next.args);
      } catch (error) {
        // Как в браузере: ошибка в таймере — непойманная ошибка страницы, остальные таймеры идут дальше.
        queueMicrotask(() => {
          throw error;
        });
      }
      await settle();
    }
    now = end;
  };
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a: unknown[]) {
      if (a.length) super(...(a as [number]));
      else super(start + now);
    }
    static now(): number {
      return start + now;
    }
  }
  Object.assign(window, {
    Date: FakeDate,
    setTimeout: (fn: unknown, delay?: unknown, ...a: unknown[]) => add(fn, delay, a),
    setInterval: (fn: unknown, delay?: unknown, ...a: unknown[]) => add(fn, delay, a, Math.max(1, Number(delay) || 0)),
    clearTimeout: clear,
    clearInterval: clear,
    requestAnimationFrame: (cb: FrameRequestCallback) => add(() => cb(now), 16, []),
    cancelAnimationFrame: clear,
    requestIdleCallback: (cb: IdleRequestCallback) => add(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 1, []),
    cancelIdleCallback: clear,
  });
  Object.defineProperty(performance, 'now', { value: () => now, configurable: true });

  // Случайные числа: mulberry32 — короткий и честный генератор.
  let s = seed >>> 0;
  Math.random = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Вызовы отрисовки и смены текстуры — для отчёта (сколько пачек рисует видеокарта за кадр).
  const count = { draws: 0, binds: 0 };
  for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    const { drawArrays, drawElements, bindTexture } = proto;
    proto.drawArrays = function (...a: Parameters<typeof drawArrays>) {
      count.draws++;
      return drawArrays.apply(this, a);
    };
    proto.drawElements = function (...a: Parameters<typeof drawElements>) {
      count.draws++;
      return drawElements.apply(this, a);
    };
    proto.bindTexture = function (...a: Parameters<typeof bindTexture>) {
      count.binds++;
      return bindTexture.apply(this, a);
    };
  }

  const store = () => (window as any).game?.scene.getScene('store');
  const look = (): Look => {
    const scene = store() ?? {};
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('.ui-btn')].map((b) => b.innerText);
    return {
      running: !!scene.running,
      night: !!scene.night,
      dayOpen: !!scene.dayOpen,
      timeLeft: scene.timeLeft ?? 0,
      title: !!document.querySelector('.ui-title'),
      open: buttons.some((b) => b.includes(labels.open)),
      nightAsk: buttons.some((b) => b.includes(labels.night)),
      modals: document.querySelectorAll('.ui-modal:not(.closing)').length,
      dialog: !!document.querySelector('.ui-dialog'),
      summary: !!document.querySelector('.ui-sum'),
    };
  };
  Object.assign(window, {
    AudioContext: undefined,
    webkitAudioContext: undefined,
    __e2e: {
      count,
      run,
      look,
      /**
       * Перемотка: день вдвое быстрее (как по кнопке ×2), время вперёд, что на экране. Игрок — за
       * своей кассой (первая касса всегда хозяина): раз в шаг касается её, как живой игрок.
       */
      fast: async (ms: number) => {
        const scene = store();
        if (scene?.running && scene.speed === 1) scene.setSpeed(2);
        if (scene?.running) void scene.serveNext();
        await run(ms);
        return look();
      },
      /** Магазин запускается с тем же зерном, сколько бы ни шла загрузка; зал рисуем только для снимков. */
      reseed: () => {
        s = seed >>> 0;
        (window as any).Phaser.Math.RND.sow([String(seed)]);
        store().sys.settings.visible = false;
      },
    },
  });
  localStorage.clear();
  localStorage.setItem('magazinchik.save', save);
}

// ---------- Прогон ----------

const errors: string[] = [];
const report: { shot: string; drawCalls: number; textureBinds: number }[] = [];

/** Подождать (по настоящим часам) условия в странице: её собственные часы стоят. */
async function until(page: Page, check: string, what: string, ms = 60_000): Promise<void> {
  for (const end = Date.now() + ms; !(await page.evaluate(check)); ) {
    if (Date.now() > end) throw new Error(`не дождались: ${what}`);
    await new Promise((done) => setTimeout(done, 50));
  }
}

async function play(page: Page, url: string, run: Run, save: SaveFile): Promise<void> {
  const born = Date.now();
  const say = (text: string) => console.log(`  ${run.name} ${String(Math.round((Date.now() - born) / 1000)).padStart(3)} с: ${text}`);
  const tick = (ms: number) => page.evaluate((ms) => (window as any).__e2e.run(ms), ms);
  const look = () => page.evaluate(() => (window as any).__e2e.look()) as Promise<Look>;
  /** Нажать кнопку: с этим текстом или последнюю доступную — в последнем окне или диалоге. */
  const press = (text?: string) =>
    page.evaluate((text) => {
      const scope = [...document.querySelectorAll('.ui-dialog, .ui-modal:not(.closing)')].pop() ?? document;
      const buttons = [...scope.querySelectorAll<HTMLButtonElement>('.ui-btn:not([disabled])')];
      (text ? buttons.find((b) => b.innerText.includes(text)) : buttons.pop())?.click();
    }, text);
  const scene = (visible: boolean) => page.evaluate((v) => (window as any).game.scene.getScene('store').sys.setVisible(v), visible);

  const day = new Date(NOW).toISOString().slice(0, 10);
  const state = { ...save.state, gift: { lastDate: day, streak: 1 }, ...run.patch(save.state) };
  await page.addInitScript(prepare, {
    save: JSON.stringify({ ...save, state }),
    seed: SEED,
    start: NOW,
    labels: { open: ru['morning.open'], night: ru['night.yes'] },
  });
  await page.goto(`${url}?lang=ru&debug`);
  await until(page, 'window.game?.isRunning === true', 'запуска Phaser');
  await page.evaluate(() => {
    const game = (window as any).game;
    // Сборки без атласа грузили сотни картинок по 32 разом, добирая очередь в кадрах, — пусть берут все
    // сразу: загрузка не должна зависеть от того, сколько кадров прошло.
    const load = game.scene.getScene('boot').load;
    load.maxParallelDownloads = 4096;
    if (load.isLoading()) load.checkLoadQueue();
    game.scene.getScene('store').sys.events.once('start', () => (window as any).__e2e.reseed());
  });
  // Ждём загрузку, не двигая часы: магазин запустится на первом же кадре — в любой сборке в один момент.
  await until(page, "!!document.querySelector('#splash.gone')", 'загрузки картинок');
  await tick(16);
  // Картинки мира должны прийти листом атласа: не дошёл лист — игра тихо грузит их по одной (BootScene),
  // и проверка этого бы не заметила.
  const sheet = await page.evaluate(() => {
    const textures = (window as any).game.textures;
    if (!textures.exists('atlas0')) return 'нет текстуры atlas0';
    const frames = textures.get('atlas0').getFrameNames().length;
    if (frames < 100) return `в листе atlas0 всего ${frames} кадров`;
    // Лист может быть и не один (atlas1…): спрайт должен лежать в каком-нибудь из них.
    const sheets = Object.keys(textures.list).filter((key) => /^atlas\d+$/.test(key)).map((key) => textures.get(key).source[0]);
    const own = ['shelf', 'coin', 'floor'].filter((key) => !sheets.includes(textures.get(key).source[0]));
    return own.length ? `не из листа атласа: ${own.join(', ')}` : '';
  });
  if (sheet) throw new Error(`атлас: ${sheet}`);

  // Титул → утро → «Открыть магазин»: прокликиваем окна, пока не откроется день.
  for (let i = 0; ; i++) {
    if (i > 80) throw new Error('не дошли до открытия магазина');
    await tick(250);
    const s = await look();
    if (s.title) await press(ru['title.continue']);
    else if (s.dialog) await press();
    else if (s.open && s.modals <= 1) {
      await press(ru['morning.open']);
      break;
    } else if (s.modals) await press();
  }
  // Сюжетные сцены после открытия.
  for (let i = 0; ; i++) {
    await tick(250);
    const s = await look();
    if (s.running && !s.dialog && !s.modals) break;
    if (i > 40) throw new Error('день не начался');
    await press();
  }
  say('магазин открыт');

  /** Перемотка до условия: окна и диалоги прокликиваем, на ночную смену соглашаемся, итоги не трогаем. */
  const forward = async (done: (s: Look) => boolean, what: string, limitMs: number) => {
    for (let t = 0; ; t += STEP_MS) {
      const s = (await page.evaluate((ms) => (window as any).__e2e.fast(ms), STEP_MS)) as Look;
      if (done(s)) return s;
      if (t > limitMs) throw new Error(`не дождались: ${what}`);
      if ((s.dialog || s.modals) && !s.summary) await press(s.nightAsk ? ru['night.yes'] : undefined);
    }
  };
  /**
   * Кадр: зал рисуем ровно один кадр (в браузере без видеокарты кадр стоит секунды), считаем в нём
   * вызовы отрисовки и снимаем страницу целиком. Камеру пересчитываем заранее: невидимой сцене
   * она не обновлялась, и отсечение лишнего (cullView) смотрело бы на старый вид.
   */
  const shot = async (name: string) => {
    const counters = () => page.evaluate(() => ({ ...(window as any).__e2e.count, frame: (window as any).game.loop.frame })) as Promise<{ draws: number; binds: number; frame: number }>;
    await page.evaluate(() => {
      const scene = (window as any).game.scene.getScene('store');
      scene.sys.setVisible(true);
      scene.cameras.main.preRender();
    });
    const before = await counters();
    let after = before;
    // Под окном во весь экран игра рисует 30 кадров в секунду — шаг в 16 мс может пройти без кадра.
    for (let i = 0; i < 4 && after.frame === before.frame; i++) after = (await tick(16), await counters());
    const file = `${run.name}-${name}.png`;
    await page.screenshot({ path: SHOTS + file, animations: 'disabled' });
    await scene(false);
    const row = { shot: file, drawCalls: after.draws - before.draws, textureBinds: after.binds - before.binds };
    report.push(row);
    say(`${file}: ${row.drawCalls} вызовов отрисовки и ${row.textureBinds} смен текстуры за кадр`);
  };

  for (const [name, p] of run.shots) {
    const s = await forward((s) => !s.dayOpen || s.night || DAY_SECONDS - s.timeLeft >= p * DAY_SECONDS, `${Math.round(p * 100)}% дня`, DAY_SECONDS * 1000);
    if (!s.dayOpen || s.night) throw new Error(`день кончился раньше кадра «${name}»`);
    await shot(name);
  }
  if (!run.fullDay) return;
  // Вечер: ночная смена (она куплена в сохранении) — кадр на её середине, потом итоги дня.
  const limit = (DAY_SECONDS + NIGHT_SECONDS) * 1000;
  const s = await forward((s) => s.summary || (s.night && NIGHT_SECONDS - s.timeLeft >= NIGHT_SECONDS / 2), 'ночной смены', limit);
  if (s.night) await shot('night');
  else errors.push(`${run.name}: ночной смены не было`);
  await forward((s) => s.summary, 'итогов дня', limit);
  // Плитки итогов выезжают по очереди, цифры докручиваются.
  await tick(4000);
  await shot('summary');
}

/** Сравнить снимки с эталоном: доля отличающихся точек и картинка с ними (красным по серому). */
function compare(threshold: number): boolean {
  if (!existsSync(BASELINE)) {
    console.log('Эталона нет (e2e/baseline) — сравнивать не с чем. Сделать: npm run e2e -- --update');
    return true;
  }
  rmSync(DIFF, { recursive: true, force: true });
  mkdirSync(DIFF, { recursive: true });
  let ok = true;
  for (const file of readdirSync(SHOTS).filter((f) => f.endsWith('.png')).sort()) {
    if (!existsSync(BASELINE + file)) {
      console.log(`  ${file}: нет в эталоне`);
      continue;
    }
    const a = decodePng(readFileSync(BASELINE + file), file);
    const b = decodePng(readFileSync(SHOTS + file), file);
    if (a.width !== b.width || a.height !== b.height) {
      console.log(`  ${file}: другой размер ${b.width}×${b.height} (в эталоне ${a.width}×${a.height}) — ПРОВАЛ`);
      ok = false;
      continue;
    }
    const out = new Uint8Array(a.data.length);
    let differ = 0;
    for (let i = 0; i < a.data.length; i += 4) {
      const same = a.data[i] === b.data[i] && a.data[i + 1] === b.data[i + 1] && a.data[i + 2] === b.data[i + 2] && a.data[i + 3] === b.data[i + 3];
      const g = Math.round((b.data[i] + b.data[i + 1] + b.data[i + 2]) / 9) + 40;
      out.set(same ? [g, g, g, 255] : [255, 0, 0, 255], i);
      if (!same) differ++;
    }
    const share = differ / (a.width * a.height);
    if (differ) writeFileSync(DIFF + file, encodePng({ width: a.width, height: a.height, data: out }));
    const bad = share > threshold;
    if (bad) ok = false;
    console.log(`  ${file}: ${differ ? `отличаются ${differ} точек (${(share * 100).toFixed(3)}%)${bad ? ' — ПРОВАЛ' : ''}` : 'совпадает'}`);
  }
  return ok;
}

/**
 * Отчёт эталона после --update: полный прогон пишет свой целиком, прогон с --only меняет только свои
 * строки, а строки остальных прогонов остаются (иначе отчёт эталона сжимался до одного прогона).
 */
function mergeReport(only: string | undefined): string {
  const file = `${BASELINE}report.json`;
  if (!only || !existsSync(file)) return JSON.stringify(report, null, 2) + '\n';
  const rows = new Map((JSON.parse(readFileSync(file, 'utf8')) as typeof report).map((r) => [r.shot, r]));
  for (const r of report) rows.set(r.shot, r);
  return JSON.stringify([...rows.values()], null, 2) + '\n';
}

/** Вызовы отрисовки за кадр против эталона: картинка та же, а видеокарте работы прибавилось — тоже повод взглянуть. */
function drawCalls(): void {
  if (!existsSync(`${BASELINE}report.json`)) return;
  const before = new Map((JSON.parse(readFileSync(`${BASELINE}report.json`, 'utf8')) as typeof report).map((r) => [r.shot, r.drawCalls]));
  const rows = report.filter((r) => before.has(r.shot) && before.get(r.shot) !== r.drawCalls);
  if (!rows.length) return;
  console.log('Вызовы отрисовки за кадр (эталон → сейчас):');
  for (const r of rows) console.log(`  ${r.shot}: ${before.get(r.shot)} → ${r.drawCalls}`);
}

async function main(): Promise<void> {
  const started = Date.now();
  let playwright: typeof import('playwright');
  try {
    // Через require: так находится и Playwright, поставленный глобально (NODE_PATH).
    playwright = createRequire(import.meta.url)('playwright');
  } catch {
    console.error('Нужен Playwright: npm i -D playwright && npx playwright install chromium');
    process.exit(1);
  }
  const only = option('only');
  const runs = RUNS.filter((r) => !only || r.name === only);
  if (!runs.length) {
    console.error(`Нет прогона «${only}». Есть: ${RUNS.map((r) => r.name).join(', ')}`);
    process.exit(1);
  }
  let url = option('url');
  let close = async () => {};
  if (!url) {
    const vite = await import('vite');
    if (!flag('no-build')) {
      console.log('Сборка…');
      await vite.build({ root: ROOT, logLevel: 'warn' });
    }
    const server = await vite.preview({ root: ROOT, logLevel: 'warn', preview: { port: Number(option('port') ?? 4173), host: '127.0.0.1' } });
    url = server.resolvedUrls?.local[0] ?? 'http://127.0.0.1:4173/';
    close = () => new Promise((done) => server.httpServer.close(() => done()));
  }
  const origin = new URL(url).origin;
  const save = JSON.parse(readFileSync(`${DIR}save.json`, 'utf8')) as SaveFile;
  rmSync(SHOTS, { recursive: true, force: true });
  mkdirSync(SHOTS, { recursive: true });
  const browser = await playwright.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  for (const run of runs) {
    console.log(`Прогон ${run.name}…`);
    const context = await browser.newContext(PHONE);
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(`${run.name}: ${e.stack ?? e.message}`));
    page.on('console', (m) => {
      // Незагрузившиеся файлы ловит failed() ниже — по адресу, а не по тексту в консоли.
      if (m.type() === 'error' && !/Failed to load resource|ERR_TUNNEL|net::ERR_/.test(m.text())) errors.push(`${run.name}: ${m.text()}`);
    });
    // Файл со своего адреса не загрузился (404, оборвалось) — провал: потерянная картинка или звук иначе
    // проходили молча. Сервера (api/) и чужих адресов (telegram.org) у проверки нет — их не считаем.
    const failed = (address: string, why: string) => {
      const at = new URL(address);
      if (at.origin === origin && !at.pathname.includes('/api/')) errors.push(`${run.name}: не загрузился ${at.pathname}${at.search} (${why})`);
    };
    page.on('response', (r) => {
      if (r.status() >= 400) return failed(r.url(), `${r.status()}`);
      // Сервер проверки (vite preview) на несуществующий файл отвечает страницей игры с кодом 200 —
      // картинка или звук, пришедшие как HTML, тоже не загрузились.
      const html = /text\/html/.test(r.headers()['content-type'] ?? '');
      if (html && r.request().resourceType() !== 'document' && /\.(?!html?$)\w+$/.test(new URL(r.url()).pathname)) failed(r.url(), 'нет файла');
    });
    page.on('requestfailed', (r) => failed(r.url(), r.failure()?.errorText ?? 'обрыв'));
    try {
      await play(page, url, run, save);
    } catch (error) {
      errors.push(`${run.name}: ${(error as Error).message}`);
      await page.screenshot({ path: `${SHOTS}${run.name}-error.png` }).catch(() => {});
    }
    await context.close();
  }
  await browser.close();
  await close();
  writeFileSync(`${SHOTS}report.json`, JSON.stringify(report, null, 2) + '\n');

  let ok = errors.length === 0;
  for (const e of errors) console.error(`ОШИБКА ${e}`);
  if (flag('update') && !ok) {
    console.log('С ошибками эталон не обновляем.');
  } else if (flag('update')) {
    // Полный прогон заменяет эталон целиком, прогон с --only — только свои кадры.
    if (!only) rmSync(BASELINE, { recursive: true, force: true });
    const merged = mergeReport(only);
    mkdirSync(BASELINE, { recursive: true });
    for (const file of readdirSync(SHOTS)) writeFileSync(BASELINE + file, readFileSync(SHOTS + file));
    writeFileSync(`${BASELINE}report.json`, merged);
    console.log('Снимки сохранены эталоном: e2e/baseline');
  } else {
    console.log('Сравнение с эталоном:');
    ok = compare(Number(option('threshold') ?? 0)) && ok;
    drawCalls();
  }
  console.log(`${ok ? 'Всё в порядке' : 'ПРОВАЛ'} за ${Math.round((Date.now() - started) / 1000)} с. Снимки: e2e/shots`);
  process.exit(ok ? 0 : 1);
}

void main();
