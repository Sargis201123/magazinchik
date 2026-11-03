// Съёмка промо-ролика: настоящая игра в браузере без экрана, кадр за кадром.
//
// Как и витрина каталога (scripts/promo/capture.cjs), игра здесь идёт не в реальном времени: цикл
// Phaser остановлен, скрипт двигает его ровно на 1/30 секунды и снимает кадр. Поэтому видео плавное,
// как бы медленно ни рисовал браузер без видеокарты. Каждая сцена ролика (promo/lines.json, поле
// scene) — свой короткий клип promo/footage/<номер>_<сцена>.mp4, снятый с запасом (CLIP_S секунд):
// длину под настоящий голос подрезает уже сборка (promo/build.py), переснимать под голос не нужно.
//
// Камера двигается только плавно (подъезд, проезд) — никакой тряски. Окна и подсказки игры прячем,
// кроме тех, что нужны сцене (облачко бабушки, тетрадь). Сохранения для поздних этапов (зима, улица
// друзей, Заречье, гипермаркет) собираются здесь же из e2e/save.json функциями самой игры.
//
// Запуск (из корня репозитория):
//   npx vite build && (npx vite preview --port 4173 --strictPort &)
//   npx vite-node promo/record.ts [-- --port 4173] [--lang ru|en] [--only cat,zar] [--explore]
// --lang — язык игры в кадре (окна, облачка, письмо); клипы ложатся в promo/footage/<язык>/.
// --explore — вместо клипов по три кадра каждой сцены в promo/.explore (посмотреть, что в кадре).
// Нужны Playwright с Chromium (глобальный тоже годится: NODE_PATH=$(npm root -g)) и ffmpeg.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, Page } from 'playwright';
import { buyZar, switchToday } from '../src/game/zarechye';
import type { StoreState } from '../src/game/economy';
import { ru } from '../src/i18n/ru';
import { en } from '../src/i18n/en';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const option = (name: string): string | undefined => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);
const LANG = (option('lang') ?? 'ru') as 'ru' | 'en';
const DICT: Record<string, string> = LANG === 'en' ? en : ru;
const FOOTAGE = join(ROOT, 'promo/footage', LANG);
const EXPLORE = join(ROOT, 'promo/.explore', LANG);
const FPS = 30;
/** Сколько секунд снимать на сцену: реплика голоса ~2–4 с плюс воздух; лишнее срежет сборка. */
const CLIP_S = 7;
/** Телефон 360×640 при плотности 3 — ровно 1080×1920 (9:16). */
const PHONE = { viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: LANG === 'en' ? 'en-US' : 'ru-RU' };
const PORT = Number(option('port') ?? 4173);
const ONLY = option('only')?.split(',');
const EXPLORING = args.includes('--explore');

type Script = { langs: Record<string, { lines: { id: string; scene: string }[] }> };
const SCRIPT = JSON.parse(readFileSync(join(ROOT, 'promo/lines.json'), 'utf8')).langs[LANG] as Script['langs'][string];
const SAVE = JSON.parse(readFileSync(join(ROOT, 'e2e/save.json'), 'utf8')) as { version: number; state: StoreState };

// ---------- Сохранения для сцен ----------

/** Середина игры (e2e/save.json, «Универмаг»): утро без окон, склад полон, Соня и истории не мешают. */
function midGame(day: number, patch: Partial<StoreState> = {}): StoreState {
  const base = SAVE.state as StoreState & Record<string, unknown>;
  const full = Object.fromEntries(Object.keys(base.warehouse).map((id) => [id, Array.from({ length: 10 }, () => ({ age: 0 }))]));
  const today = new Date().toISOString().slice(0, 10);
  const st = {
    ...base,
    day,
    plan: undefined,
    tourDone: true,
    whatsNew: 99,
    arrangeIntro: true,
    story: { ...base.story, introSeen: true },
    gift: { lastDate: today, streak: 1 },
    drama: { upTo: 999 },
    warehouse: full,
    cat: base.cat && { ...(base.cat as object), fedDay: day },
    // Тетрадь уже у игрока — утром не придёт письмо бабушки (кроме сцены тетради).
    nb: { got: true },
    // Кухня с поваром (game/kitchen.ts): в сохранении её ещё нет, а в ролике она нужна.
    upgrades: [...(base.upgrades as string[]), 'kitchen'],
    staff: [...(base.staff as { role: string }[]), { ...(base.staff as { role: string }[]).find((m) => m.role === 'baker'), role: 'cook', name: 30, offDay: 0 }],
    kitchen: { pelmeni: 5, syrniki: 6 },
    ...patch,
  } as unknown as StoreState;
  return st;
}

/** Гипермаркет (как e2e l6): пять касс, филиал напротив. */
function hyper(day: number): StoreState {
  const s = midGame(day) as StoreState & Record<string, unknown>;
  const staff = s.staff as { role: string; name?: number }[];
  const cashier = staff.find((m) => m.role === 'cashier2');
  return {
    ...s,
    level: 5,
    zarCard: day,
    branch: { since: day - 30, tiers: { repair: 3, ads: 2, shelves: 1 }, earned: 40000 },
    registers: 5,
    kiosks: { n: 4, tier: 1 },
    staff: [...staff, ...['cashier4', 'cashier5'].map((role, i) => ({ ...cashier, role, name: 20 + i }))],
  } as unknown as StoreState;
}

/** Заречье: лавка куплена, сегодня работаем там (game/zarechye.ts). */
function zarechye(day: number): StoreState {
  const bought = buyZar({ ...hyper(day), money: 200_000, debt: 0 }, true);
  if (!bought) throw new Error('Заречье не купилось (buyZar)');
  return switchToday(bought, 'zar');
}

/** Друзья на «Улице друзей» (ответ сервера api/_lib/visits.ts, action 'street'). */
const FRIENDS =
  LANG === 'en'
    ? [
        { id: 11, name: 'Anna', level: 2, day: 60, rating: 4.6, ago: 0, shop: "Anna's" },
        { id: 12, name: 'Tim', level: 4, day: 140, rating: 4.8, ago: 0, shop: 'Tim & Co' },
        { id: 13, name: 'Olivia', level: 1, day: 21, rating: 4.2, ago: 1, shop: 'Corner Shop' },
        { id: 14, name: 'Dan', level: 3, day: 95, rating: 4.5, ago: 0 },
        { id: 15, name: 'Leila', level: 2, day: 48, rating: 4.7, ago: 2, shop: 'Sweet Spot' },
      ]
    : [
        { id: 11, name: 'Аня', level: 2, day: 60, rating: 4.6, ago: 0, shop: 'У Ани' },
        { id: 12, name: 'Тимур', level: 4, day: 140, rating: 4.8, ago: 0, shop: 'Тимур и К°' },
        { id: 13, name: 'Оля', level: 1, day: 21, rating: 4.2, ago: 1, shop: 'Олина лавка' },
        { id: 14, name: 'Дима', level: 3, day: 95, rating: 4.5, ago: 0 },
        { id: 15, name: 'Лейла', level: 2, day: 48, rating: 4.7, ago: 2, shop: 'Сладкий угол' },
      ];

// ---------- Страница ----------

interface Session {
  /** null — новая игра с нуля (?onb=play): бабушка первого дня. */
  state: StoreState | null;
  seed: number;
  /** Подменить Telegram и ответы сервера: для «Улицы друзей». */
  telegram?: boolean;
  /** Не открывать магазин: остаться на утреннем экране (письмо бабушки). */
  morning?: boolean;
}

/** До скриптов игры: сохранение, полная графика, случайности от одного зерна, Telegram по желанию. */
function initScript({ save, seed, telegram }: { save: string | null; seed: number; telegram: boolean }): void {
  let s = seed >>> 0;
  Math.random = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  // Часы страницы: пока игра грузится — настоящие, а с остановкой цикла — время съёмки (кадр за кадром).
  // Так и то, что игра отсчитывает по performance.now (облачко бабушки, мигания), идёт в темпе кадров.
  const realNow = performance.now.bind(performance);
  let shot: number | null = null;
  performance.now = () => shot ?? realNow();
  (window as unknown as { __clock: (t: number) => void }).__clock = (t: number) => {
    shot = t;
  };
  try {
    localStorage.clear();
    if (save) localStorage.setItem('magazinchik.save', save);
    localStorage.setItem('magazinchik.gfx', 'full');
  } catch {
    // Без хранилища игра начнётся с нуля — по кадрам это будет видно.
  }
  if (telegram) {
    const noop = () => {};
    const button = { show: noop, hide: noop, onClick: noop, offClick: noop, setText: noop, setParams: noop, enable: noop, disable: noop };
    const hub = { impactOccurred: noop, notificationOccurred: noop, selectionChanged: noop };
    (window as unknown as { Telegram: unknown }).Telegram = {
      WebApp: {
        initData: `auth_date=${Math.floor(Date.now() / 1000)}&user=%7B%22id%22%3A1%7D&hash=promo`,
        initDataUnsafe: { user: { id: 1, first_name: 'Promo' } },
        platform: 'android',
        version: '8.0',
        colorScheme: 'dark',
        themeParams: {},
        isVersionAtLeast: () => true,
        ready: noop,
        expand: noop,
        onEvent: noop,
        offEvent: noop,
        setHeaderColor: noop,
        setBackgroundColor: noop,
        disableVerticalSwipes: noop,
        enableClosingConfirmation: noop,
        HapticFeedback: hub,
        MainButton: button,
        BackButton: button,
        CloudStorage: { getItem: (_k: string, cb: (e: null, v: string) => void) => cb(null, ''), setItem: (_k: string, _v: string, cb?: () => void) => cb?.(), getKeys: (cb: (e: null, v: string[]) => void) => cb(null, []) },
      },
    };
  }
}

/** Что прятать: всё DOM-поверх игры, кроме нужного сцене (keep — селекторы, что оставить; :not(#…) — чтобы перебить правило скрытия). */
const hideCss = (keep: string[]) => `
body > *:not(#game):not(.promo-keep) { visibility: hidden !important; }
${keep.map((k) => `body > ${k}:not(#promo-none), ${k}:not(#promo-none) *`).join(', ')}${keep.length ? ' { visibility: visible !important; }' : ''}
`;

async function boot(browser: Browser, session: Session): Promise<{ page: Page; errors: string[]; close: () => Promise<void> }> {
  const context = await browser.newContext(PHONE);
  await context.addInitScript(initScript, { save: session.state ? JSON.stringify({ version: SAVE.version, state: session.state }) : null, seed: session.seed, telegram: !!session.telegram });
  // Сеть наружу не нужна: скрипт Telegram и сервер игры — заглушки.
  await context.route(/telegram\.org/, (r) => r.abort());
  await context.route(/\/api\//, (r) => {
    const body = r.request().postData() ?? '';
    if (session.telegram && body.includes('"street"')) return r.fulfill({ json: { enabled: true, friends: FRIENDS } });
    return r.fulfill({ status: 503, body: '' });
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${PORT}/?lang=${LANG}&debug${session.state ? '' : '&onb=play'}`);
  await page.waitForSelector('.ui-play', { timeout: 90_000 });
  await page.click('.ui-play', { force: true });
  if (session.state && !session.morning) {
    // Утро: окна поверх закрываем, пока не останется «Открыть магазин».
    for (let i = 0; i < 80; i++) {
      const ready = await page.evaluate(() => {
        const modals = [...document.querySelectorAll('.ui-modal')];
        const top = modals[modals.length - 1];
        const dialog = document.querySelector<HTMLElement>('.ui-dialog');
        if (top?.querySelector('.ui-open-bar') && !dialog) return true;
        dialog?.click();
        if (top && !top.querySelector('.ui-open-bar')) [...top.querySelectorAll<HTMLElement>('.ui-btn:not([disabled])')].pop()?.click();
        return false;
      });
      if (ready) break;
      await page.waitForTimeout(400);
    }
    await page.click('.ui-open-bar .ui-btn', { force: true });
    await page.waitForTimeout(1500);
  }
  // Новая игра: останавливаем время, как только бабушка заговорила («Внучек, ларёк теперь твой!»).
  if (!session.state) await page.waitForSelector('.ui-say', { timeout: 90_000 });
  await page.evaluate(() => {
    const w = window as any;
    const g = w.game;
    const scene = g.scene.getScene('store');
    g.loop.sleep();
    let t = g.loop.lastTime || performance.now();
    w.__clock(t);
    w.__scene = scene;
    // Свет: null — как в игре (по времени дня), число — доля дня (1 — ночь).
    w.__light = null;
    const light = scene.updateLighting;
    scene.updateLighting = function (p?: number) {
      return light.call(this, w.__light ?? p);
    };
    // Жалобы («Фу, грязно!», «Дорого!») и служебные надписи (задания, рекорды) в ролике не нужны.
    const popup = scene.popup;
    scene.popup = function (x: number, y: number, text: string, color?: string) {
      if (color === '#ffd0d0' || /Задани|Испытани|Рекорд|провер|штраф|долг|Task|Challenge|Record|inspect|fine|debt/i.test(text)) return;
      return popup.call(this, x, y, text, color);
    };
    if (scene.sonya === 'pending') scene.sonya = 'none';
    // Полки сами доливаются до утреннего — без табличек «пусто» (как витрина каталога, scripts/promo/capture.cjs).
    const full = (scene.state.shelves as { items: Record<string, unknown[]> }[]).map((sh) =>
      Object.fromEntries(Object.entries(sh.items).map(([id, list]) => [id, list.length])),
    );
    const topUp = () => {
      if (!w.__topUp) return;
      const shelves = (scene.state.shelves as { items: Record<string, unknown[]> }[]).map((sh, i) => ({
        ...sh,
        items: Object.fromEntries(
          Object.entries({ ...(full[i] ?? {}), ...sh.items }).map(([id, list]) => {
            const have = Array.isArray(list) ? list : [];
            const want = Math.max((full[i] as Record<string, number>)?.[id] ?? 0, have.length);
            return [id, [...have, ...Array.from({ length: want - have.length }, () => ({ age: 0 }))]];
          }),
        ),
      }));
      scene.state = { ...scene.state, shelves };
      scene.refreshShelves();
    };
    let count = 0;
    w.__step = (n = 1) => {
      for (let i = 0; i < n; i++) {
        if (count++ % 20 === 0) topUp();
        // Окна посреди дня (особые гости, истории) закрываем, если сцена не просит их оставить.
        if (!w.__keepModals) {
          document.querySelector<HTMLElement>('.ui-dialog')?.click();
          for (const m of document.querySelectorAll('.ui-modal')) [...m.querySelectorAll<HTMLElement>('.ui-btn:not([disabled])')].pop()?.click();
        }
        const cam = scene.cameras.main;
        // Никакой тряски: эффекты камеры игры сбрасываем, кадр ставит съёмка.
        cam.shakeEffect?.reset();
        if (w.__camera) w.__camera(cam);
        t += 1000 / 30;
        w.__clock(t);
        g.loop.step(t);
      }
    };
  });
  return { page, errors, close: () => context.close() };
}

type View = { x: number; y: number; zoom: number };

/** Камера: от from к to за frames кадров (плавно, без рывков); zoom — доля обычного приближения игры. */
async function camera(page: Page, from: View, to: View, frames: number, follow?: 'cat'): Promise<void> {
  await page.evaluate(
    ([from, to, frames, follow]) => {
      const w = window as any;
      const scene = w.__scene;
      let i = 0;
      let at = { x: from.x, y: from.y };
      const ease = (k: number) => k * k * (3 - 2 * k);
      w.__camera = (cam: any) => {
        const k = ease(Math.min(1, i++ / Math.max(1, frames - 1)));
        cam.panEffect.reset();
        cam.zoomEffect.reset();
        cam.stopFollow();
        cam.setZoom(scene.baseZoom * (from.zoom + (to.zoom - from.zoom) * k));
        const cat = follow === 'cat' ? scene.catImg : null;
        if (cat?.active) at = { x: at.x + (cat.x - at.x) * 0.08, y: at.y + (cat.y - 12 - at.y) * 0.08 };
        else at = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
        cam.centerOn(at.x, at.y);
      };
    },
    [from, to, frames, follow] as const,
  );
}

/** Где что в мире: дверь, касса хозяина, зал, пристройки, кот. */
const where = (page: Page) =>
  page.evaluate(() => {
    const s = (window as any).__scene;
    const r = s.registers[0];
    const L = s.layout;
    return {
      door: L.door as { x: number; y: number },
      seller: L.sellerHome as { x: number; y: number },
      counter: (r ? { x: r.counter.x, y: r.counter.y } : L.sellerHome) as { x: number; y: number },
      w: L.w as number,
      h: L.h as number,
      wallH: L.wallH as number,
      bakery: L.bakery as { x: number; y: number; w: number; h: number },
      coffee: L.coffee as { x: number; y: number; w: number; h: number },
      kitchen: (L.kitchen ?? null) as { x: number; y: number; w: number; h: number } | null,
      cat: s.catImg ? { x: s.catImg.x, y: s.catImg.y } : null,
    };
  });

/** Найти в мире картинки по началу ключа текстуры: их рамка (для «Улицы друзей», реки). */
const findArt = (page: Page, prefix: string) =>
  page.evaluate((prefix) => {
    const s = (window as any).__scene;
    const hits = s.children.list.filter((o: any) => o.texture && (o.texture.key.startsWith(prefix) || String(o.frame?.name ?? '').startsWith(prefix)));
    if (!hits.length) return null;
    const xs = hits.map((o: any) => o.x);
    const ys = hits.map((o: any) => o.y);
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2, n: hits.length };
  }, prefix);

/** Точка мира → точка экрана (CSS-пиксели страницы): для настоящих касаний. */
const toScreen = (page: Page, p: { x: number; y: number }) =>
  page.evaluate((p) => {
    const s = (window as any).__scene;
    const cam = s.cameras.main;
    const canvas = s.game.canvas as HTMLCanvasElement;
    const k = canvas.clientWidth / canvas.width;
    return { x: (p.x - cam.worldView.x) * cam.zoom * k, y: (p.y - cam.worldView.y) * cam.zoom * k };
  }, p);

const steps = (page: Page, n: number) => page.evaluate((n) => (window as any).__step(n), n);
const sec = (s: number) => Math.round(s * FPS);

/** Позвать сразу n покупателей (по одному через несколько кадров). */
const crowd = (page: Page, n: number) =>
  page.evaluate((n) => {
    const w = window as any;
    for (let i = 0; i < n; i++) {
      w.__scene.spawnCustomer();
      w.__step(4);
    }
  }, n);

/** Спрятать всё DOM поверх игры, кроме keep. */
async function ui(page: Page, keep: string[] = []): Promise<void> {
  await page.evaluate((css) => {
    let tag = document.getElementById('promo-hide');
    if (!tag) {
      tag = document.createElement('style');
      tag.id = 'promo-hide';
      document.head.append(tag);
    }
    tag.textContent = css;
  }, hideCss(keep));
}

// ---------- Съёмка ----------

class Clip {
  private n = 0;
  private dir: string;
  constructor(readonly name: string) {
    this.dir = mkdtempSync(join(process.env.PROMO_TMP || tmpdir(), `promo-${name}-`));
  }
  /** Снять frames кадров; before(i) — перед каждым (касание, событие). */
  async record(page: Page, frames: number, before?: (i: number) => Promise<void>): Promise<void> {
    if (EXPLORING) {
      // Разведка: первый, средний и последний кадры, без видео.
      mkdirSync(EXPLORE, { recursive: true });
      for (let i = 0; i < frames; i++) {
        if (before) await before(i);
        await steps(page, 1);
        if (i === 0 || i === frames >> 1 || i === frames - 1)
          await page.screenshot({ path: join(EXPLORE, `${this.name}_${String(i).padStart(3, '0')}.jpg`), type: 'jpeg', quality: 80 });
      }
      return;
    }
    for (let i = 0; i < frames; i++) {
      if (before) await before(i);
      await steps(page, 1);
      await page.screenshot({ path: join(this.dir, `${String(this.n++).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 94 });
    }
  }
  /** Кадры → promo/footage/<name>.mp4 (H.264, 30 к/с, без звука). */
  encode(): void {
    if (!EXPLORING) {
      mkdirSync(FOOTAGE, { recursive: true });
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', join(this.dir, '%05d.jpg'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(FOOTAGE, `${this.name}.mp4`)]);
    }
    rmSync(this.dir, { recursive: true, force: true });
  }
}

type SceneFn = (browser: Browser, clips: Record<string, Clip>) => Promise<string[]>;

/** Новая игра: бабушка в ларьке, первые покупатели, касание кассы. Три сцены одной сменой. */
const firstDay: SceneFn = async (browser, clips) => {
  const { page, errors, close } = await boot(browser, { state: null, seed: 7 });
  const at = await where(page);
  const kiosk = { x: at.w / 2, y: at.h / 2 + 10, zoom: 1 };
  // 1. Бабушка: «Внучек, ларёк теперь твой! Гляди — уже идут.» Своё облачко у игры живёт пару секунд
  // по её часам и к остановке цикла может уже уйти — для ролика ставим такое же (те же классы и текст
  // из словаря, ui/onboarding.ts) над бабушкой у кассы, пока звучит первая реплика голоса.
  if (clips.granny) {
    await ui(page, []);
    const view = { ...kiosk, zoom: 1.0 };
    await camera(page, view, view, 1);
    await steps(page, 1);
    const tail = await toScreen(page, { x: at.counter.x + 4, y: at.counter.y - 26 });
    await page.evaluate(
      ({ tail, name, text }) => {
        const root = document.createElement('div');
        root.className = 'ui-say promo-keep';
        root.id = 'promo-say';
        root.style.animation = 'none';
        const face = document.createElement('img');
        face.className = 'ui-say-face';
        face.src = 'assets/portrait_grandma_happy.png';
        const body = document.createElement('div');
        body.className = 'ui-say-body';
        const who = document.createElement('div');
        who.className = 'ui-say-name';
        who.textContent = name;
        const line = document.createElement('p');
        line.className = 'ui-say-text';
        line.textContent = text;
        body.append(who, line);
        root.append(face, body);
        document.body.append(root);
        const left = Math.round(Math.min(Math.max(10, tail.x - root.offsetWidth / 2), innerWidth - root.offsetWidth - 10));
        Object.assign(root.style, { left: `${left}px`, top: `${Math.round(tail.y - root.offsetHeight - 12)}px` });
        root.style.setProperty('--tail', `${Math.round(Math.min(Math.max(16, tail.x - left), root.offsetWidth - 16))}px`);
      },
      { tail, name: DICT['who.grandma'], text: DICT['onb.hello'] },
    );
    await page.waitForTimeout(500);
    await clips.granny.record(page, sec(CLIP_S), async (i) => {
      if (i === sec(4.6)) await page.evaluate(() => document.getElementById('promo-say')?.remove());
    });
  }
  // 2. Первые покупатели входят с улицы: камера у двери.
  if (clips.morning) {
    await ui(page, []);
    await crowd(page, 3);
    const door = { x: at.door.x + 6, y: at.door.y - 6, zoom: 1.35 };
    await camera(page, { ...door, y: door.y + 26 }, door, sec(CLIP_S));
    await clips.morning.record(page, sec(CLIP_S));
  }
  // 3. Касание кассы: настоящие касания пальцем по кассе — круги, монетки, покупатель уходит довольный.
  if (clips.tap) {
    await ui(page, ['.ui-hud']);
    await crowd(page, 4);
    await steps(page, sec(3));
    const till = { x: at.counter.x - 10, y: at.counter.y - 10, zoom: 1.7 };
    await camera(page, till, { ...till, zoom: 1.85 }, sec(CLIP_S));
    await clips.tap.record(page, sec(CLIP_S), async (i) => {
      // Касания — раз в 0,8 с с 0,9 с (под них сборка кладёт звон монет, promo/build.py ACCENTS).
      if (i < 27 || (i - 27) % 24 !== 0) return;
      const p = await toScreen(page, at.counter);
      await page.touchscreen.tap(p.x, p.y);
    });
  }
  await close();
  return errors;
};

/** Большой магазин днём: общий план, пекарня и кофейня, кот. */
const bigShop: SceneFn = async (browser, clips) => {
  const { page, errors, close } = await boot(browser, { state: midGame(123), seed: 123 });
  await page.evaluate(() => Object.assign(window, { __light: 0.25, __topUp: true }));
  const at = await where(page);
  await crowd(page, 8);
  await steps(page, sec(3));
  await crowd(page, 6);
  // 4. Ларёк вырос: камера отъезжает от кассы до всего здания с улицей.
  if (clips.grow) {
    await ui(page);
    await camera(page, { x: at.counter.x - 30, y: at.counter.y - 30, zoom: 1.5 }, { x: at.w / 2 - 20, y: at.h / 2 + 20, zoom: 0.75 }, sec(CLIP_S));
    await clips.grow.record(page, sec(CLIP_S));
  }
  // 5. Пекарня и кофейня во флигеле (кухня — если есть).
  if (clips.food) {
    const a = at.bakery;
    const b = at.kitchen ?? at.coffee;
    const from = { x: b.x + b.w / 2, y: b.y + b.h / 2, zoom: 2.1 };
    const to = { x: a.x + a.w / 2, y: a.y + a.h / 2, zoom: 2.1 };
    await camera(page, from, to, sec(CLIP_S));
    await clips.food.record(page, sec(CLIP_S));
  }
  // 6. Кот выходит в зал, камера мягко следит за ним.
  if (clips.cat) {
    await page.evaluate(() => {
      const s = (window as any).__scene;
      if (!s.catOut) void s.catVisit();
    });
    await steps(page, sec(1.5));
    const cat = (await where(page)).cat ?? at.door;
    await camera(page, { x: cat.x, y: cat.y - 12, zoom: 2.5 }, { x: cat.x, y: cat.y - 12, zoom: 2.7 }, sec(CLIP_S), 'cat');
    await clips.cat.record(page, sec(CLIP_S), async (i) => {
      // Погладить: касание по коту пару раз за сцену.
      if (i !== sec(2) && i !== sec(4.2)) return;
      const c = (await where(page)).cat;
      if (!c) return;
      const p = await toScreen(page, { x: c.x, y: c.y - 4 });
      await page.touchscreen.tap(p.x, p.y);
    });
  }
  await close();
  return errors;
};

/**
 * Погода. День выбран так, чтобы игра сама дала нужную погоду (game/weather.ts weatherFor):
 * 116 — дождь, 121 — гроза, 130 — листопад. В грозу молнии бьют по съёмке, в известные секунды
 * (под них сборка кладёт гром, promo/build.py THUNDER_AT).
 */
const STORM_FLASHES = [1.1, 4.4];
const weatherScene =
  (scene: 'rain' | 'storm' | 'leaves'): SceneFn =>
  async (browser, clips) => {
    const day = { rain: 116, storm: 121, leaves: 130 }[scene];
    const { page, errors, close } = await boot(browser, { state: midGame(day), seed: day });
    const light = { rain: 0.35, storm: 0.9, leaves: 0.3 }[scene];
    await page.evaluate((light) => Object.assign(window, { __light: light, __topUp: true }), light);
    const at = await where(page);
    await crowd(page, 8);
    await steps(page, sec(3));
    await crowd(page, 4);
    await ui(page);
    if (scene === 'storm') {
      // Свои молнии вместо случайных игры: вспышка тем же светом, что в weatherFx.lightning.
      await page.evaluate(() => {
        const s = (window as any).__scene;
        const flash = s.weatherObjs.find((o: any) => o.fillColor === 0xdde6ff);
        (window as any).__flash = () =>
          flash &&
          s.tweens.chain({
            targets: flash,
            tweens: [
              { alpha: 0.3, duration: 50 },
              { alpha: 0.06, duration: 90 },
              { alpha: 0.22, duration: 45 },
              { alpha: 0, duration: 600 },
            ],
          });
      });
    }
    const views: Record<string, [View, View]> = {
      rain: [{ x: at.door.x - 50, y: at.h + 18, zoom: 1.3 }, { x: at.door.x + 30, y: at.h + 6, zoom: 1.45 }],
      storm: [{ x: at.w / 2, y: at.h - 30, zoom: 0.95 }, { x: at.w / 2, y: at.h - 20, zoom: 1.08 }],
      leaves: [{ x: at.door.x + 70, y: at.h + 30, zoom: 1.35 }, { x: at.door.x - 30, y: at.h + 20, zoom: 1.35 }],
    };
    const [from, to] = views[scene];
    await camera(page, from, to, sec(CLIP_S));
    await clips[scene].record(page, sec(CLIP_S), async (i) => {
      if (scene === 'storm' && STORM_FLASHES.some((t) => i === sec(t))) await page.evaluate(() => (window as any).__flash?.());
    });
    await close();
    return errors;
  };

/** Зима и Новый год вечером: снег, гирлянды, окна светятся. */
const winter: SceneFn = async (browser, clips) => {
  const { page, errors, close } = await boot(browser, { state: midGame(135), seed: 135 });
  await page.evaluate(() => Object.assign(window, { __light: 0.97, __topUp: true }));
  const at = await where(page);
  await crowd(page, 6);
  await steps(page, sec(3));
  await ui(page);
  await camera(page, { x: at.door.x + 20, y: at.h - 5, zoom: 1.5 }, { x: at.door.x + 10, y: at.h - 25, zoom: 1.75 }, sec(CLIP_S));
  await clips.winter.record(page, sec(CLIP_S));
  await close();
  return errors;
};

/** «Улица друзей»: домики друзей вдоль аллеи за дорогой. */
const street: SceneFn = async (browser, clips) => {
  const { page, errors, close } = await boot(browser, { state: midGame(126), seed: 126, telegram: true });
  await page.evaluate(() => ((window as any).__light = 0.55));
  // Ответ сервера приходит после запуска — мир перестраивается с домиками.
  for (let i = 0; i < 40 && !(await findArt(page, 'fshop_')); i++) {
    await steps(page, 15);
    await page.waitForTimeout(150);
  }
  const shops = (await findArt(page, 'fshop_')) ?? { x: 100, y: 400 };
  await ui(page);
  await camera(page, { x: shops.x - 60, y: shops.y - 30, zoom: 2.2 }, { x: shops.x + 60, y: shops.y - 30, zoom: 2.2 }, sec(CLIP_S));
  await clips.street.record(page, sec(CLIP_S));
  await close();
  return errors;
};

/**
 * «Бабушкина тетрадь»: утром в «Почте» письмо бабушки с тетрадью — «последнюю страницу я вырвала»,
 * сверху обрывок «Лавка у моста. Вернуть…» (мостик к Заречью). Письмо — окно игры (DOM): его время
 * идёт по настоящим часам, поэтому ждём, пока текст допечатается, а в кадре окно медленно приближаем.
 */
const notebook: SceneFn = async (browser, clips) => {
  // Письмо бабушки с тетрадью ждёт утром (game/returns.ts planLetter → takeLetter).
  const state = midGame(127, { nb: undefined, ret: { letter: { from: 'grandma', n: 0, date: '', story: 'notebook' } } } as unknown as Partial<StoreState>);
  const { page, errors, close } = await boot(browser, { state, seed: 127, morning: true });
  await page.evaluate(() => ((window as any).__keepModals = true));
  const press = (text: string) =>
    page.evaluate((text) => {
      const b = [...document.querySelectorAll<HTMLButtonElement>('button')].find((e) => e.innerText.includes(text));
      b?.click();
      return !!b;
    }, text);
  // Утренние карточки поверх «Почты» (проверка и т. п.) — «Понятно», потом «Читать» у письма.
  for (let i = 0; i < 20 && !(await press(DICT['mail.read'])); i++) {
    await press(DICT['event.ok']);
    await page.waitForTimeout(500);
  }
  // Текст письма печатается — касание дописывает его сразу.
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.querySelector<HTMLElement>('.ui-modal:last-of-type .ui-say-text, .ui-modal:last-of-type p')?.click());
  await page.waitForTimeout(2500);
  await ui(page, ['.ui-modal']);
  const at = await where(page);
  await camera(page, { x: at.w / 2, y: at.h / 2, zoom: 0.9 }, { x: at.w / 2, y: at.h / 2, zoom: 0.9 }, 1);
  const frames = sec(CLIP_S);
  await clips.notebook.record(page, frames, async (i) => {
    const k = i / (frames - 1);
    const z = 1 + 0.06 * k * k * (3 - 2 * k);
    await page.evaluate((z) => {
      const top = [...document.querySelectorAll<HTMLElement>('.ui-modal')].pop();
      if (top) Object.assign(top.style, { transform: `scale(${z})`, transformOrigin: '50% 35%', transition: 'none' });
    }, z);
  });
  await close();
  return errors;
};

/** Заречье: река, мост, пристань. */
const zar: SceneFn = async (browser, clips) => {
  const { page, errors, close } = await boot(browser, { state: zarechye(128), seed: 128 });
  // Вечереет: фонари набережной горят, свет дрожит на воде.
  await page.evaluate(() => ((window as any).__light = 0.82));
  const at = await where(page);
  await crowd(page, 5);
  await steps(page, sec(2));
  await ui(page);
  // От лавки через дорогу — к мосту на тот берег (scenes/zarechye.ts, zar_bridge).
  const bridge = (await findArt(page, 'zar_bridge')) ?? { x: at.door.x, y: at.h + 120 };
  await camera(page, { x: at.door.x, y: at.h + 10, zoom: 1.25 }, { x: bridge.x, y: bridge.y + 45, zoom: 1.1 }, sec(CLIP_S));
  await clips.zar.record(page, sec(CLIP_S));
  await close();
  return errors;
};

/** Финал: гипермаркет вечером, огни; камера медленно отъезжает — под название и призыв. */
const finale: SceneFn = async (browser, clips) => {
  const { page, errors, close } = await boot(browser, { state: hyper(131), seed: 131 });
  await page.evaluate(() => Object.assign(window, { __light: 0.95, __topUp: true }));
  const at = await where(page);
  await crowd(page, 10);
  await steps(page, sec(3));
  await ui(page);
  await camera(page, { x: at.w / 2, y: at.h / 2, zoom: 0.9 }, { x: at.w / 2, y: at.h / 2 + 20, zoom: 0.62 }, sec(CLIP_S + 1));
  await clips.cta.record(page, sec(CLIP_S + 1));
  await close();
  return errors;
};

/** Сцена ролика → кто её снимает. */
const SHOOTERS: { scenes: string[]; run: SceneFn }[] = [
  { scenes: ['granny', 'morning', 'tap'], run: firstDay },
  { scenes: ['grow', 'food', 'cat'], run: bigShop },
  { scenes: ['rain'], run: weatherScene('rain') },
  { scenes: ['storm'], run: weatherScene('storm') },
  { scenes: ['leaves'], run: weatherScene('leaves') },
  { scenes: ['winter'], run: winter },
  { scenes: ['street'], run: street },
  { scenes: ['notebook'], run: notebook },
  { scenes: ['zar'], run: zar },
  { scenes: ['cta'], run: finale },
];

async function main(): Promise<void> {
  let playwright: typeof import('playwright');
  try {
    playwright = createRequire(import.meta.url)('playwright');
  } catch {
    const global = execFileSync('npm', ['root', '-g']).toString().trim();
    playwright = createRequire(join(global, 'x.js'))('playwright');
  }
  const path = process.env.CHROMIUM_PATH;
  const browser = await playwright.chromium.launch(path && existsSync(path) ? { executablePath: path } : {});
  const name = (scene: string) => {
    const line = SCRIPT.lines.find((l) => l.scene === scene);
    return line ? `${line.id}_${scene}` : scene;
  };
  const failed: string[] = [];
  for (const shooter of SHOOTERS) {
    const wanted = shooter.scenes.filter((s) => !ONLY || ONLY.includes(s));
    if (!wanted.length) continue;
    const clips = Object.fromEntries(wanted.map((s) => [s, new Clip(name(s))]));
    const started = Date.now();
    try {
      const errors = await shooter.run(browser, clips);
      for (const c of Object.values(clips)) c.encode();
      console.log(`${wanted.join(', ')}: готово за ${Math.round((Date.now() - started) / 1000)} с${errors.length ? `; ошибки страницы: ${errors.slice(0, 3).join(' | ')}` : ''}`);
      if (errors.length) failed.push(...wanted);
    } catch (e) {
      console.error(`${wanted.join(', ')}: ${e instanceof Error ? e.stack : e}`);
      failed.push(...wanted);
    }
  }
  await browser.close();
  if (failed.length) {
    console.error(`Не снялось чисто: ${failed.join(', ')}`);
    process.exit(1);
  }
}

void main();
