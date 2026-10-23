// Витрина для каталога Telegram и картинки для окна «Поделиться» — снятые в самой игре.
//
// Игра идёт не в реальном времени, а по кадрам: цикл Phaser остановлен, скрипт двигает его ровно на
// 1/30 секунды и снимает кадр. Поэтому ролик плавный, как бы медленно ни работал браузер, а не рваный,
// как запись экрана. Случайности идут от одного зерна, сцены и погода заданы — от запуска к запуску
// ролик почти не меняется (прохожие могут чуть отличаться: загрузка игры идёт в реальном времени).
// Кадры склеивает ffmpeg (H.264).
//
// Нужны: собранная игра (npx vite build) и `npx vite preview --port <порт>`, Playwright с Chromium
// (путь к браузеру — переменная CHROMIUM, если он не там, где ждёт Playwright) и ffmpeg.
// Запуск: node scripts/promo/capture.cjs [порт=4173] [all | video | shots] [ru | en | both]
// (video — ролики и клип к /start, shots — кадры и картинки карточек, all — всё).
//
// Что получается:
//   docs/store/trailer_<язык>.mp4 — вертикальный ролик 720×1280 для каталога (без звука);
//   docs/store/shot_<язык>_1…5.png — кадры 1080×1920 для превью в каталоге;
//   public/promo/start.mp4 — короткий клип, который бот присылает на /start (api/_lib/handlers.ts);
//   public/promo/invite_<язык>.jpg, help_<язык>.jpg — картинки карточек «Поделиться» (api/_lib/share.ts).

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    return require(path.join(execFileSync('npm', ['root', '-g']).toString().trim(), 'playwright'));
  }
}
const { chromium } = loadPlaywright();

const ROOT = path.resolve(__dirname, '../..');
const PORT = Number(process.argv[2] || 4173);
const WHAT = process.argv[3] || 'all';
const LANGS = (process.argv[4] || 'both') === 'both' ? ['ru', 'en'] : [process.argv[4]];
const STORE = path.join(ROOT, 'docs/store');
const PROMO = path.join(ROOT, 'public/promo');
/** Кадры до склейки — во временной папке (удаляется в конце). */
let tmp = '';
const TMP = () => (tmp ||= fs.mkdtempSync(path.join(process.env.PROMO_TMP || require('os').tmpdir(), 'promo-')));
const FPS = 30;
const SAVE = JSON.parse(fs.readFileSync(path.join(__dirname, 'save.json'), 'utf8'));

/**
 * Дни для съёмки (зерно особых дней 777 — в эти дни их нет): 125 — дождь и Соня заходит к папе
 * (суббота после примирения), 135 — снег в новогодний сезон.
 */
const SEED = 777;
const RAIN_DAY = 125;
const SNOW_DAY = 135;

const TEXT = {
  ru: {
    rain: 'Уютный магазинчик\nпрямо в Telegram',
    queue: 'Очередь у кассы —\nуспевай обслужить!',
    sonya: 'Дочка Соня\nзаходит к папе',
    cat: 'Кот магазина\nждёт, когда погладят',
    snow: 'Снег, гирлянды\nи Новый год',
    unbox: 'Новинки —\nпрямо из коробки',
    title: 'Магазинчик',
    call: 'Играй бесплатно в Telegram',
    invite: 'Заходи в мой магазин!',
    help: 'Помогите! Час пик!',
  },
  en: {
    rain: 'A cozy little shop\nright inside Telegram',
    queue: 'A queue at the till —\nkeep up with it!',
    sonya: 'Your daughter Sonya\ndrops by',
    cat: 'The shop cat\nwants a pat',
    snow: 'Snow, string lights\nand New Year',
    unbox: 'New things —\nstraight from the box',
    title: 'Magazinchik',
    call: 'Play free in Telegram',
    invite: 'Come visit my shop!',
    help: 'Help! Rush hour!',
  },
};

/** Перед загрузкой страницы: сохранение, обычная графика, случайности от одного зерна. */
function initScript({ state, seed }) {
  let s = seed >>> 0;
  Math.random = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  try {
    localStorage.clear();
    localStorage.setItem('magazinchik.save', JSON.stringify({ version: 11, state }));
    localStorage.setItem('magazinchik.gfx', 'full');
    localStorage.setItem('magazinchik.writeAccess', '1');
  } catch {
    // Без хранилища игра начнётся с нуля — съёмка это заметит.
  }
}

/** Сохранение для съёмки: день, погода и всё, чтобы утро не показывало окон. */
function stateFor(day, patch = {}) {
  const d = new Date();
  const q = (n) => String(n).padStart(2, '0');
  const st = {
    ...SAVE,
    day,
    seed: SEED,
    tourDone: true,
    whatsNew: 99,
    arrangeIntro: true,
    story: { ...SAVE.story, introSeen: true },
    gift: { lastDate: `${d.getFullYear()}-${q(d.getMonth() + 1)}-${q(d.getDate())}`, streak: 1 },
    drama: { upTo: 999 },
    seenTips: ['promo', 'contract', 'markdown', 'weekly', 'fair', 'cart', 'loyalty', 'delivery', 'register2', 'oven', 'coffee', 'nightShift', 'dog', 'watchman'],
    plan: undefined,
    // Кот сыт — сидит у входа, а не ушёл гулять.
    cat: SAVE.cat && { ...SAVE.cat, fedDay: day },
    ...patch,
  };
  st.security = { ...(st.security ?? {}), news: undefined };
  if (st.contest) st.contest = { ...st.contest, announced: true, last: st.contest.last && { ...st.contest.last, seen: true } };
  return st;
}

const HIDE_UI = `
.ui-hud, .ui-stock, .ui-hint, .ui-speed, .ui-toast, .ui-help { display: none !important; }
#promo-caption { position: fixed; left: 0; right: 0; top: 7%; text-align: center; pointer-events: none; z-index: 99;
  font: 900 30px/1.12 "Nunito Variable", "Nunito", sans-serif; color: #fff; white-space: pre-line; letter-spacing: .2px;
  text-shadow: 0 3px 0 #2b2233, 0 -2px 0 #2b2233, 2px 0 0 #2b2233, -2px 0 0 #2b2233, 0 0 18px rgba(0,0,0,.55); }
#promo-fade { position: fixed; inset: 0; background: #1d1a26; pointer-events: none; z-index: 98; opacity: 0; }
#promo-end { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
  pointer-events: none; z-index: 100; opacity: 0; background: radial-gradient(circle at 50% 48%, rgba(29,26,38,.55), rgba(29,26,38,.92) 70%); }
#promo-end b { font: 900 54px/1 "Nunito Variable", "Nunito", sans-serif; color: #feae34;
  text-shadow: 0 4px 0 #2b2233, 0 -2px 0 #2b2233, 3px 0 0 #2b2233, -3px 0 0 #2b2233; }
#promo-end span { font: 800 22px/1.2 "Nunito Variable", "Nunito", sans-serif; color: #f4efe0; text-shadow: 0 2px 0 #2b2233; }
`;

/** Открыть игру с сохранением и дойти до открытого магазина; цикл Phaser — на ручном управлении. */
async function boot(browser, { lang, day, dsf, patch, size = { width: 360, height: 640 } }) {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: dsf });
  await context.addInitScript(initScript, { state: stateFor(day, patch), seed: SEED + day });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${PORT}/?lang=${lang}&debug`);
  await page.waitForSelector('.ui-play', { timeout: 60000 });
  await page.click('.ui-play', { force: true });
  // Утро: окна поверх (подарки, новости) закрываем, пока не останется кнопка «Открыть магазин».
  for (let i = 0; i < 60; i++) {
    const ready = await page.evaluate(() => {
      const modals = [...document.querySelectorAll('.ui-modal')];
      const top = modals[modals.length - 1];
      const dialog = document.querySelector('.ui-dialog');
      if (top?.querySelector('.ui-open-bar') && !dialog) return true;
      // Реплика печатается — касание дописывает её; потом — последняя кнопка окна поверх утра.
      dialog?.click();
      if (top && !top.querySelector('.ui-open-bar')) [...top.querySelectorAll('.ui-btn:not([disabled])')].pop()?.click();
      return false;
    });
    if (ready) break;
    await page.waitForTimeout(400);
  }
  await page.click('.ui-open-bar .ui-btn', { force: true });
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content: HIDE_UI });
  await page.evaluate(() => {
    const g = window.game;
    const scene = g.scene.getScene('store');
    g.loop.sleep();
    let t = g.loop.lastTime || performance.now();
    window.__scene = scene;
    // Свет: null — как в игре (по времени дня), число — заданная доля дня (1 — ночь).
    window.__light = null;
    const light = scene.updateLighting;
    scene.updateLighting = function (p) {
      return light.call(this, window.__light ?? p);
    };
    // Для витрины: жалобы («Фу, грязно!», «Дорого!») не показываем, а полки сами доливаются до утреннего —
    // без табличек «пусто».
    // __quiet — в этой сцене только надписи, подходящие под образец (у Сони — её «зашла в магазин»).
    const popup = scene.popup;
    scene.popup = function (x, y, text, color) {
      if (color === '#ffd0d0' || (window.__quiet && !window.__quiet.test(text))) return;
      return popup.call(this, x, y, text, color);
    };
    const combo = scene.celebrateCombo;
    scene.celebrateCombo = function (n) {
      if (!window.__quiet) combo.call(this, n);
    };
    // Соня зайдёт, когда её позовёт съёмка, а не сама посреди другой сцены.
    if (scene.sonya === 'pending') scene.sonya = 'none';
    const full = scene.state.shelves.map((sh) => Object.fromEntries(Object.entries(sh.items).map(([id, list]) => [id, list.length])));
    const topUp = () => {
      const shelves = scene.state.shelves.map((sh, i) => ({
        ...sh,
        items: Object.fromEntries(
          Object.entries({ ...(full[i] ?? {}), ...sh.items }).map(([id, list]) => {
            const have = Array.isArray(list) ? list : [];
            const want = Math.max(full[i]?.[id] ?? 0, have.length);
            return [id, [...have, ...Array.from({ length: want - have.length }, () => ({ age: 0 }))]];
          }),
        ),
      }));
      scene.state = { ...scene.state, shelves };
      scene.refreshShelves();
    };
    let steps = 0;
    window.__step = (n = 1) => {
      for (let i = 0; i < n; i++) {
        if (steps++ % 20 === 0) topUp();
        // Окна посреди дня (особые гости, ночные истории) — закрыть, чтобы день шёл дальше.
        document.querySelector('.ui-dialog')?.click();
        for (const m of document.querySelectorAll('.ui-modal')) [...m.querySelectorAll('.ui-btn:not([disabled])')].pop()?.click();
        if (window.__camera) window.__camera(scene.cameras.main);
        t += 1000 / 30;
        g.loop.step(t);
      }
    };
    for (const id of ['promo-caption', 'promo-fade', 'promo-end']) {
      const el = document.createElement('div');
      el.id = id;
      document.body.append(el);
    }
    document.getElementById('promo-end').append(document.createElement('b'), document.createElement('span'));
  });
  return { page, context, errors };
}

/**
 * Камера: центр (x, y) в точках мира и приближение к обычному (zoom × baseZoom), плавно от from к to
 * за frames кадров. follow — следить за котом (центр мягко тянется к нему).
 */
async function camera(page, from, to, frames, follow = null) {
  await page.evaluate(
    ([from, to, frames, follow]) => {
      const scene = window.__scene;
      let i = 0;
      let at = { x: from.x, y: from.y };
      const ease = (k) => k * k * (3 - 2 * k);
      window.__camera = (cam) => {
        const k = ease(Math.min(1, i++ / Math.max(1, frames - 1)));
        cam.panEffect.reset();
        cam.zoomEffect.reset();
        cam.setZoom(scene.baseZoom * (from.zoom + (to.zoom - from.zoom) * k));
        const cat = follow === 'cat' ? scene.catImg : null;
        if (cat?.active) at = { x: at.x + (cat.x - at.x) * 0.12, y: at.y + (cat.y - 12 - at.y) * 0.12 };
        else at = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
        cam.centerOn(at.x, at.y);
      };
    },
    [from, to, frames, follow],
  );
}

/** Где что: дверь, касса, прилавок хозяина, кот, размеры зала. */
const where = (page) =>
  page.evaluate(() => {
    const s = window.__scene;
    const r = s.registers[0];
    return {
      door: s.layout.door,
      seller: s.layout.sellerHome,
      counter: r ? { x: r.counter.x, y: r.counter.y } : s.layout.sellerHome,
      w: s.layout.w,
      h: s.layout.h,
      cat: s.catImg ? { x: s.catImg.x, y: s.catImg.y } : null,
    };
  });

/** Подпись сверху и затемнение (0 — нет, 1 — чёрный кадр). */
const overlay = (page, { caption, fade = 0, end = 0, title, call }) =>
  page.evaluate(
    ([caption, fade, end, title, call]) => {
      const cap = document.getElementById('promo-caption');
      if (cap.textContent !== caption) cap.textContent = caption;
      document.getElementById('promo-fade').style.opacity = String(fade);
      const e = document.getElementById('promo-end');
      e.style.opacity = String(end);
      e.querySelector('b').textContent = title ?? '';
      e.querySelector('span').textContent = call ?? '';
    },
    [caption ?? '', fade, end, title, call],
  );

class Recorder {
  constructor(dir) {
    this.dir = dir;
    this.n = 0;
    fs.mkdirSync(dir, { recursive: true });
  }
  /** Снять frames кадров; look(i) перед каждым — подпись и затемнение. */
  async record(page, frames, look) {
    for (let i = 0; i < frames; i++) {
      if (look) await overlay(page, look(i, frames));
      await page.evaluate(() => window.__step(1));
      await page.screenshot({ path: path.join(this.dir, `${String(this.n++).padStart(5, '0')}.png`) });
    }
  }
}

/** Затемнение на краях отрезка: из чёрного и в чёрный за edge кадров. */
const edges = (i, frames, edge = 8, open = true, close = true) =>
  Math.max(open ? 1 - i / edge : 0, close ? 1 - (frames - 1 - i) / edge : 0, 0);

const seconds = (s) => Math.round(s * FPS);

/** Склад полон: полки весь день стоят с товаром, без табличек «пусто». */
const fullStock = () => Object.fromEntries(Object.keys(SAVE.warehouse).map((id) => [id, Array.from({ length: 10 }, () => ({ age: 0 }))]));

/** Позвать в магазин сразу n покупателей (по одному через несколько кадров). */
const crowd = (page, n) =>
  page.evaluate(async (n) => {
    for (let i = 0; i < n; i++) {
      window.__scene.spawnCustomer();
      window.__step(4);
    }
  }, n);

/**
 * Ночной дождь у магазина, Соня, очередь у кассы и кот — одна смена (день 125, ночной свет).
 * clip — короткий вариант для бота: без подписей, только дождь и очередь (между ними — затемнение).
 */
async function rainScenes(browser, lang, rec, { dsf = 2, clip = false } = {}) {
  const T = TEXT[lang];
  const caption = (text) => (clip ? '' : text);
  // Один кассир и без менеджера — у кассы собирается очередь.
  const staff = SAVE.staff.filter((m) => !['cashier2', 'cashier3', 'manager'].includes(m.role));
  const { page, context, errors } = await boot(browser, { lang, day: RAIN_DAY, dsf, patch: { staff, warehouse: fullStock() } });
  await page.evaluate(() => {
    window.__light = 1;
    const s = window.__scene;
    s.state = { ...s.state, plan: { ...s.state.plan, rushAt: 0 } };
  });
  const at = await where(page);
  const street = { x: at.door.x + 4, y: at.door.y + 14, zoom: 1.8 };
  await camera(page, street, street, 1);
  // Разогрев: на улице и в зале люди. Вторая волна входит уже в кадре; покупатели набирают корзины
  // секунд десять — к сцене у кассы (после Сони) там длинная очередь.
  await page.evaluate((n) => window.__step(n), seconds(4));
  await crowd(page, 8);
  await page.evaluate((n) => window.__step(n), seconds(2));
  await crowd(page, 8);

  // 1. Дождь, фонари, люди под зонтами — камера медленно подъезжает к двери.
  let frames = seconds(4.8);
  await camera(page, street, { x: at.door.x + 10, y: at.door.y - 2, zoom: 2.2 }, frames);
  await rec.record(page, frames, (i, n) => ({ caption: caption(T.rain), fade: edges(i, n, 10, true, clip) }));

  // 2. Соня заходит к папе: пока она идёт — не снимаем; дошла до прилавка — сердечко и надпись.
  // Монеты и серии в этой сцене не показываем — только её. В клипе для бота Сони нет — просто ждём.
  await page.evaluate((clip) => {
    window.__quiet = /Соня|Sonya/;
    if (!clip) void window.__scene.runSonya();
  }, clip);
  for (let k = 0; k < 60; k++) {
    const near = await page.evaluate(() => window.__scene.popups.some((p) => /Соня|Sonya/.test(p.text)));
    // В клипе — секунд восемь, пока покупатели с корзинами выстроятся у кассы.
    if (near || (clip && k >= 40)) break;
    await page.evaluate(() => window.__step(6));
  }
  if (!clip) {
    const sonya = { x: at.seller.x - 16, y: at.seller.y - 16, zoom: 3.3 };
    frames = seconds(3.6);
    await camera(page, sonya, { ...sonya, zoom: 3.5 }, frames);
    await rec.record(page, frames, () => ({ caption: T.sonya }));
  }
  await page.evaluate(() => {
    window.__quiet = null;
  });

  // 3. Очередь у кассы, монеты и «Серия ×N».
  const till = { x: at.counter.x - 14, y: at.counter.y - 34, zoom: 2.5 };
  frames = seconds(clip ? 4 : 4.4);
  await camera(page, { ...till, y: till.y + 12, zoom: 2.35 }, till, frames);
  await rec.record(page, frames, (i, n) => ({ caption: caption(T.queue), fade: edges(i, n, 10, clip, clip) }));
  if (clip) {
    await context.close();
    return errors;
  }

  // 4. Кот выходит в зал и садится посреди, покупатели гладят; камера следит за котом.
  await page.evaluate(() => {
    const s = window.__scene;
    if (!s.catOut) void s.catVisit();
  });
  await crowd(page, 3);
  await page.evaluate((n) => window.__step(n), seconds(1.5));
  const cat = await page.evaluate(() => ({ x: window.__scene.catImg.x, y: window.__scene.catImg.y }));
  frames = seconds(4);
  await camera(page, { x: cat.x, y: cat.y - 12, zoom: 4 }, { x: cat.x, y: cat.y - 12, zoom: 4.3 }, frames, 'cat');
  await rec.record(page, frames, (i, n) => ({ caption: T.cat, fade: edges(i, n, 8, false, true) }));
  await context.close();
  return errors;
}

/** Снег в новогодний сезон (день 135, сумерки), распаковка новинки и последний кадр с названием. */
async function snowScenes(browser, lang, rec, { dsf = 2 } = {}) {
  const T = TEXT[lang];
  const { page, context, errors } = await boot(browser, { lang, day: SNOW_DAY, dsf, patch: { warehouse: fullStock() } });
  await page.evaluate(() => {
    window.__light = 0.9;
  });
  const at = await where(page);
  // Снег видно на газонах, деревьях и стоянке за магазином: камера опускается от неё к вывеске.
  const parking = { x: at.door.x, y: -30, zoom: 1.05 };
  await camera(page, parking, parking, 1);
  await page.evaluate((n) => window.__step(n), seconds(4));
  await crowd(page, 5);
  await page.evaluate((n) => window.__step(n), seconds(2));

  // 5. Снег над стоянкой и деревьями в снежных шапках, белые газоны вокруг магазина.
  let frames = seconds(4.6);
  await camera(page, parking, { x: at.door.x, y: 110, zoom: 1.2 }, frames);
  await rec.record(page, frames, (i, n) => ({ caption: T.snow, fade: edges(i, n, 8, true, false) }));

  // 6. Распаковка: новинка падает в коробке и раскрывается в золотом кольце с искрами (без монет вокруг).
  const target = await page.evaluate(() => {
    window.__quiet = /^$/;
    const s = window.__scene;
    const all = [...s.unboxables().entries()].map(([key, img]) => ({ key, img }));
    // Что-нибудь заметное посреди зала: крупная вещь не у стены и не во флигеле.
    const inHall = all.filter((e) => e.img.x > 20 && e.img.x < s.layout.w - 20 && e.img.y > 90 && e.img.y < s.layout.h - 30);
    inHall.sort((a, b) => b.img.displayWidth * b.img.displayHeight - a.img.displayWidth * a.img.displayHeight);
    const pick = inHall[0] ?? all[0];
    s.freshProps.set(pick.key, pick.img);
    s.packFresh();
    return { x: pick.img.x, y: pick.img.y - pick.img.displayHeight / 2, key: pick.key };
  });
  // packFresh распаковывает через 1,7 с — начинаем снимать за полсекунды до этого.
  await page.evaluate((n) => window.__step(n), seconds(1.2));
  frames = seconds(4.2);
  const box = { x: target.x, y: target.y - 6, zoom: 3.2 };
  await camera(page, box, { ...box, zoom: 3.45 }, frames);
  await rec.record(page, frames, () => ({ caption: T.unbox }));
  await page.evaluate(() => {
    window.__quiet = null;
  });

  // 7. Конец: название и «Играй бесплатно в Telegram» поверх магазина в снегу.
  frames = seconds(3);
  const end = { x: at.door.x, y: 250, zoom: 0.84 };
  await camera(page, end, { ...end, zoom: 0.78 }, frames);
  await rec.record(page, frames, (i, n) => ({ caption: '', end: Math.min(1, i / 9), title: T.title, call: T.call, fade: Math.max(0, 1 - (n - 1 - i) / 6) * 0.85 }));
  await context.close();
  return errors;
}

/** Склеить кадры в mp4 (H.264, без звука, быстрый старт). */
function encode(dir, out, { scale, crf, from = 0, frames } = {}) {
  const args = ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-start_number', String(from), '-i', path.join(dir, '%05d.png')];
  if (frames) args.push('-frames:v', String(frames));
  const filters = scale ? [`scale=${scale}:flags=lanczos`] : [];
  if (filters.length) args.push('-vf', filters.join(','));
  // tune animation — для пиксель-арта с ровными заливками: при том же качестве файл заметно меньше.
  args.push('-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', String(crf ?? 28), '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart', '-an', out);
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
  return fs.statSync(out).size;
}

async function video(browser, lang) {
  const dir = path.join(TMP(), `video_${lang}`);
  const rec = new Recorder(dir);
  const errors = [...(await rainScenes(browser, lang, rec)), ...(await snowScenes(browser, lang, rec))];
  const out = path.join(STORE, `trailer_${lang}.mp4`);
  const size = encode(dir, out, { crf: 28 });
  console.log(`${out}: ${rec.n} кадров (${(rec.n / FPS).toFixed(1)} с), ${(size / 1024 / 1024).toFixed(2)} МБ`);
  return errors;
}

/** Клип к /start: дождь и очередь без подписей (подпись — в сообщении бота), меньше и легче. */
async function startClip(browser) {
  const dir = path.join(TMP(), 'clip');
  const rec = new Recorder(dir);
  const errors = await rainScenes(browser, 'ru', rec, { clip: true });
  const out = path.join(PROMO, 'start.mp4');
  const size = encode(dir, out, { scale: '480:854', crf: 28 });
  console.log(`${out}: ${(rec.n / FPS).toFixed(1)} с, ${(size / 1024).toFixed(0)} КБ`);
  return errors;
}

/**
 * Кадры для каталога: те же сцены в 1080×1920, из каждой — один кадр с подписью и такой же без подписи
 * (из него — картинки карточек). Сонин кадр и финальный с названием — только в ролике.
 */
class StillRecorder {
  constructor(lang) {
    this.lang = lang;
    this.scene = 0;
    this.plain = [];
  }
  async record(page, frames, look) {
    const k = this.scene++;
    const keep = [0, 2, 3, 4, 5].indexOf(k);
    // Распаковку снимаем, пока коробка раскрывается (в начале сцены), очередь — когда она длиннее
    // всего (в конце), остальное — ближе к концу. Сцену досматриваем до конца: время идёт как в ролике.
    const at = Math.floor(frames * (k === 5 ? 0.33 : k === 2 ? 0.85 : 0.7));
    for (let i = 0; i < frames; i++) {
      if (i === at && keep >= 0) {
        const view = look ? look(i, frames) : {};
        await overlay(page, { ...view, fade: 0, end: 0 });
        await page.screenshot({ path: path.join(STORE, `shot_${this.lang}_${keep + 1}.png`) });
        const plain = path.join(TMP(), `plain_${this.lang}_${k}.png`);
        await overlay(page, { caption: '' });
        await page.screenshot({ path: plain });
        this.plain[k] = plain;
      }
      await page.evaluate(() => window.__step(1));
    }
  }
}

async function shots(browser, lang) {
  const rec = new StillRecorder(lang);
  const errors = [...(await rainScenes(browser, lang, rec, { dsf: 3 })), ...(await snowScenes(browser, lang, rec, { dsf: 3 }))];
  console.log(`${STORE}/shot_${lang}_1…5.png`);
  return { errors, plain: rec.plain };
}

/** Шрифт игры (Nunito) — прямо в страницу карточки. */
function fontFaces() {
  const dir = path.join(ROOT, 'node_modules/@fontsource-variable/nunito/files');
  return ['cyrillic', 'latin']
    .map((set) => `@font-face { font-family: N; font-weight: 200 1000; src: url(data:font/woff2;base64,${fs.readFileSync(path.join(dir, `nunito-${set}-wght-normal.woff2`)).toString('base64')}) format('woff2'); }`)
    .join('\n');
}

/**
 * Картинки карточек «Поделиться» 1080×1080: кадр игры без подписи и надпись сверху. invite — ночной
 * дождь у магазина, help — очередь у кассы.
 */
async function cards(browser, lang, plain) {
  const T = TEXT[lang];
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
  const faces = fontFaces();
  for (const [kind, src, focus, line, color] of [
    ['invite', plain[0], 36, T.invite, '#f4efe0'],
    ['help', plain[2], 52, T.help, '#ffd36b'],
  ]) {
    if (!src) continue;
    const img = fs.readFileSync(src).toString('base64');
    await page.setContent(`<!doctype html><html><head><style>${faces}
      html, body { margin: 0; width: 1080px; height: 1080px; overflow: hidden; background: #1d1a26; }
      .shot { position: absolute; inset: 0; background: url(data:image/png;base64,${img}) 50% ${focus}% / 1080px auto no-repeat; image-rendering: pixelated; }
      .band { position: absolute; left: 0; right: 0; top: 0; padding: 46px 0 70px; text-align: center;
        background: linear-gradient(rgba(29,26,38,.92) 55%, rgba(29,26,38,0)); }
      .awning { position: absolute; left: 0; right: 0; top: 0; height: 26px;
        background: repeating-linear-gradient(90deg, #e43b44 0 60px, #f4efe0 60px 120px); }
      b { display: block; font: 900 104px/1 N; color: #feae34; margin-top: 18px;
        text-shadow: 0 6px 0 #2b2233, 0 -3px 0 #2b2233, 4px 0 0 #2b2233, -4px 0 0 #2b2233; }
      span { display: block; margin-top: 18px; font: 800 54px/1.1 N; color: ${color}; text-shadow: 0 4px 0 #2b2233; }
    </style></head><body><div class="shot"></div><div class="band"><b>${T.title}</b><span>${line}</span></div><div class="awning"></div></body></html>`);
    await page.evaluate(() => document.fonts.ready);
    const out = path.join(PROMO, `${kind}_${lang}.jpg`);
    await page.screenshot({ path: out, type: 'jpeg', quality: 86 });
    console.log(`${out}: ${(fs.statSync(out).size / 1024).toFixed(0)} КБ`);
  }
  await page.close();
}

module.exports = { boot, camera, where, overlay, Recorder, StillRecorder, edges, seconds, encode, rainScenes, snowScenes, video, startClip, shots, cards, TEXT, RAIN_DAY, SNOW_DAY, SAVE, STORE, PROMO, TMP };

if (require.main === module) {
  (async () => {
    fs.mkdirSync(STORE, { recursive: true });
    fs.mkdirSync(PROMO, { recursive: true });
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
    const errors = [];
    try {
      for (const lang of LANGS) {
        if (WHAT === 'all' || WHAT === 'video') errors.push(...(await video(browser, lang)));
      }
      if (WHAT === 'all' || WHAT === 'video') errors.push(...(await startClip(browser)));
      for (const lang of LANGS) {
        if (WHAT !== 'all' && WHAT !== 'shots') continue;
        const still = await shots(browser, lang);
        errors.push(...still.errors);
        await cards(browser, lang, still.plain);
      }
    } finally {
      await browser.close();
      if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
    }
    if (errors.length) console.log('Ошибки на странице:', errors.slice(0, 5));
  })();
}
