// Пилот pixelfx: «до» и «после» для пяти эффектов (рябь на лужах, светлячки, монетки, конфетти, салют),
// снятые в самой игре кадр за кадром (как scripts/promo/capture.cjs) на телефоне 360×640 @3x.
//
// Нужны две собранные игры и их preview: «до» (main) и «после» (эта ветка), обе — с ?debug.
//   node scripts/promo/pixelfx-pilot.cjs <порт до> <порт после> [сцена…]
// Пишет в promo/pixelfx-pilot/: <сцена>_compare.mp4 и .gif (рядом: слева до, справа после) и
// <сцена>_contact.jpg (верхний ряд — до, нижний — после).

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const { boot, camera, where, Recorder, encode, RAIN_DAY } = require('./capture.cjs');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'promo/pixelfx-pilot');
const [BEFORE, AFTER] = [Number(process.argv[2] || 4174), Number(process.argv[3] || 4175)];
const ONLY = process.argv.slice(4);
const DSF = 3;
/** Летний ясный день (game/weather.ts, calendar.ts): светлячки, салют, монетки, конфетти. */
const SUMMER_DAY = 164;

/** Сцены: день, что подкрутить в сохранении, камера, что сделать и сколько кадров снять. */
const SCENES = [
  {
    name: 'rain',
    day: RAIN_DAY,
    frames: 75,
    async setup(page) {
      const at = await where(page);
      await page.evaluate(() => (window.__light = 0.55));
      const top = await page.evaluate(() => window.__scene.next.h + 4);
      await camera(page, { x: at.door.x + 30, y: top + 50, zoom: 3 }, { x: at.door.x + 30, y: top + 50, zoom: 3 }, 1);
    },
  },
  {
    name: 'fireflies',
    day: SUMMER_DAY,
    frames: 120,
    async setup(page) {
      await page.evaluate(() => (window.__light = 1));
      const c = await page.evaluate(() => {
        const s = window.__scene;
        const pond = s.parkPond;
        const park = s.lawns[1];
        return pond ? { x: pond.x - 40, y: pond.y - 30 } : { x: park.x + park.w / 2, y: park.y + 80 };
      });
      await camera(page, { ...c, zoom: 2.2 }, { ...c, zoom: 2.2 }, 1);
    },
  },
  {
    name: 'coins',
    day: SUMMER_DAY,
    frames: 120,
    async setup(page) {
      const at = await where(page);
      // Счётчик денег на месте (съёмка прячет HUD — здесь он нужен: туда летят монетки).
      await page.addStyleTag({ content: '.ui-hud { display: flex !important; }' });
      await camera(page, { x: at.counter.x - 50, y: at.counter.y - 70, zoom: 2.6 }, { x: at.counter.x - 50, y: at.counter.y - 70, zoom: 2.6 }, 1);
      await page.evaluate(() => window.__step(2));
      // Полёт монеток — доли секунды: снимаем замедленно в 3 раза (и до, и после одинаково).
      await page.evaluate(() => {
        const s = window.__scene;
        s.tweens.timeScale = 1 / 3;
        s.anims.globalTimeScale = 1 / 3;
      });
      return async (page, i) => {
        if (i === 2 || i === 60) await page.evaluate(([x, y]) => window.effects.flyCoins(window.__scene, x, y, 6), [at.counter.x, at.counter.y]);
      };
    },
  },
  {
    name: 'confetti',
    day: SUMMER_DAY,
    frames: 150,
    async setup(page) {
      // Праздник расширения (зал тот же — стройка без лесов): 2,4 с молотков, вспышка, конфетти.
      return async (page, i) => {
        if (i === 0)
          await page.evaluate(() => {
            const s = window.__scene;
            void window.effects.celebrateExpansion(s);
          });
      };
    },
    skip: 60,
  },
  {
    name: 'move',
    day: SUMMER_DAY,
    frames: 90,
    async setup(page) {
      // Переезд в гипермаркет: конфетти над вывеской и у двери, где гости.
      return async (page, i) => {
        if (i === 0)
          await page.evaluate(() => {
            const s = window.__scene;
            s.state = { ...s.state, level: 5 };
            void window.effects.celebrateExpansion(s);
          });
      };
    },
    skip: 26,
  },
  {
    name: 'fireworks',
    day: SUMMER_DAY,
    frames: 150,
    async setup(page) {
      await page.evaluate(() => {
        window.__light = 1;
        // Последний вечер летнего фестиваля (weeks.ts fireworksToday) или Новый год — как в игре.
        window.__scene.newYearSound = true;
      });
      const c = await page.evaluate(() => ({ x: window.__scene.layout.door.x, y: window.__scene.next.h + 150 }));
      await camera(page, { ...c, zoom: 1.4 }, { ...c, zoom: 1.4 }, 1);
      await page.evaluate(() => window.__step(30));
    },
  },
];

async function shoot(browser, port, sc, dir) {
  const { page, context, errors } = await boot(browser, { lang: 'ru', day: sc.day, dsf: DSF, patch: sc.patch ?? {}, port });
  // Твины Phaser считают время по настоящим часам (TweenManager.getDelta — Date.now), а съёмка двигает цикл
  // по кадрам: пусть и твины идут по кадру цикла, иначе затухания и полёты обгоняют анимации.
  await page.evaluate(() => {
    const s = window.__scene;
    s.tweens.getDelta = () => window.game.loop.delta;
  });
  const each = await sc.setup(page);
  // До съёмки — пропустить начало (стройку): кадры всё равно идут, просто без снимков.
  const rec = new Recorder(dir);
  for (let i = 0; i < (sc.skip ?? 0) + sc.frames; i++) {
    if (each) await each(page, i);
    if (i < (sc.skip ?? 0)) await page.evaluate(() => window.__step(1));
    else await rec.record(page, 1);
  }
  await context.close();
  if (errors.length) console.log(`  ${sc.name}@${port}: ошибки страницы: ${errors.join(' | ')}`);
}

/** Склейка рядом (слева до, справа после) и лист кадров. */
function compare(sc, dirs) {
  const out = (s) => path.join(OUT, `${sc.name}_${s}`);
  const half = (s) => path.join(dirs[s], '..', `${s}.mp4`);
  encode(dirs.before, half('before'), { scale: '540:-2', crf: 24 });
  encode(dirs.after, half('after'), { scale: '540:-2', crf: 24 });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', half('before'), '-i', half('after'), '-filter_complex', '[0:v][1:v]hstack=inputs=2', '-c:v', 'libx264', '-crf', '24', '-preset', 'slow', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-an', out('compare.mp4')]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', out('compare.mp4'), '-vf', 'fps=15,scale=540:-1:flags=neighbor,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=none', out('compare.gif')]);
  // Лист: 6 кадров через равные промежутки, до — сверху, после — снизу.
  const pick = Array.from({ length: 6 }, (_, k) => Math.round((k * (sc.frames - 1)) / 5));
  const inputs = [];
  for (const which of ['before', 'after']) for (const n of pick) inputs.push('-i', path.join(dirs[which], `${String(n).padStart(5, '0')}.png`));
  const tiles = pick.length * 2;
  const scaled = Array.from({ length: tiles }, (_, k) => `[${k}:v]scale=270:-2[s${k}]`).join(';');
  const stack = `${Array.from({ length: tiles }, (_, k) => `[s${k}]`).join('')}xstack=inputs=${tiles}:layout=${Array.from({ length: tiles }, (_, k) => `${(k % 6) * 270}_${k < 6 ? 0 : 'h0'}`).join('|')}`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', `${scaled};${stack}`, '-frames:v', '1', '-q:v', '4', out('contact.jpg')]);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const tmp = fs.mkdtempSync(path.join(process.env.PROMO_TMP || os.tmpdir(), 'pixelfx-'));
  for (const sc of SCENES.filter((s) => !ONLY.length || ONLY.includes(s.name))) {
    const dirs = { before: path.join(tmp, sc.name, 'before'), after: path.join(tmp, sc.name, 'after') };
    console.log(`${sc.name}: до…`);
    await shoot(browser, BEFORE, sc, dirs.before);
    console.log(`${sc.name}: после…`);
    await shoot(browser, AFTER, sc, dirs.after);
    compare(sc, dirs);
  }
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
})();
