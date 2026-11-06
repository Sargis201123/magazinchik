// Съёмка прототипа «Бабушкиной фермы» на телефоне 360×640: титул с двумя вывесками → утро и посадка →
// полив и рост → сбор → продажа у кассы → итоги дня. Кадры и ролик — для описания PR и для автора.
//
// Игра идёт в настоящем времени (а не по кадрам, как capture.cjs): ферма коротка, и так проще. Касания
// грядок и кассы — через сцену (?debug открывает window.farm), окна — настоящими нажатиями. Чтобы рост
// не ждать по минуте, на время роста день идёт быстрее (farm.speed).
//
// Нужны: игра на локальном сервере (npx vite --port <порт> или npx vite preview --port <порт>),
// Playwright с Chromium и ffmpeg. Запуск: node scripts/promo/farm.cjs [порт=5173] [папка=docs/farm]
// Что получается: <папка>/farm_1…6.png (720×1280) и <папка>/farm.mp4, <папка>/farm.gif (короткий, для PR).

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
const PORT = Number(process.argv[2] || 5173);
const OUT = path.resolve(ROOT, process.argv[3] || 'docs/farm');

const wait = (page, ms) => page.waitForTimeout(ms);
const tapBed = (page, i) => page.evaluate((i) => window.farm.tapBed(i), i);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'farm-'));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'ru-RU',
    recordVideo: { dir: tmp, size: { width: 360, height: 640 } },
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const shot = (n) => page.screenshot({ path: path.join(OUT, `farm_${n}.png`) });
  const started = Date.now();
  const marks = [];
  const mark = (name) => marks.push([name, (Date.now() - started) / 1000]);

  await page.goto(`http://localhost:${PORT}/?debug`);
  await page.waitForSelector('.ui-title .ui-play', { timeout: 60000 });
  await wait(page, 2200);
  mark('title');
  await page.click('.ui-sign.farm', { force: true });
  await wait(page, 1200);
  await shot(1);
  await page.click('.ui-play', { force: true });
  await page.waitForFunction(() => window.farm, null, { timeout: 20000 });
  await wait(page, 2500);
  mark('morning');
  // Утро: бабушка подсказывает; сажаем тыкву, клубнику и морковь (24 монеты — ровно на пять грядок).
  const plan = [2, 1, 0, 0, 0];
  for (let i = 0; i < plan.length; i++) {
    await tapBed(page, i);
    await wait(page, 450);
    if (i === 2) await shot(2);
    await page.click(`.fm-crop >> nth=${plan[i]}`, { force: true });
    await wait(page, 500);
  }
  await wait(page, 600);
  await page.click('.fm-bottom .ui-btn', { force: true });
  mark('day');
  await wait(page, 2500);
  // Земля сухая — поливаем; день — быстрее, чтобы рост был виден.
  for (let i = 0; i < plan.length; i++) {
    await tapBed(page, i);
    await wait(page, 250);
  }
  await page.evaluate(() => (window.farm.speed = 3));
  await wait(page, 4500);
  await shot(3);
  // Дальше — как игрок: созрело — собрать, пересохло — полить, у кассы — рассчитать.
  for (let k = 0; k < 26; k++) {
    for (let i = 0; i < 6; i++) {
      await page.evaluate((i) => {
        const f = window.farm;
        const b = f.state.beds[i];
        if (f.phase !== 'day' || !b.crop) return;
        if (b.grow >= 1 || b.water <= 0) f.tapBed(i);
      }, i);
    }
    await page.evaluate(() => window.farm.serve());
    if (k === 6) await shot(4);
    if (k === 14) await shot(5);
    // Пустую грядку — снова под морковь, пока день.
    await page.evaluate(() => {
      const f = window.farm;
      if (f.phase !== 'day' || document.querySelector('.ui-modal')) return;
      const i = f.state.beds.findIndex((b) => !b.crop);
      if (i >= 0 && f.state.money >= 2) f.tapBed(i);
    });
    await wait(page, 300);
    if (await page.$('.fm-crop')) await page.click('.fm-crop >> nth=0', { force: true });
    await wait(page, 900);
    if (await page.evaluate(() => window.farm.phase !== 'day')) break;
  }
  await page.waitForSelector('.fm-sum', { timeout: 60000 });
  mark('summary');
  await wait(page, 1500);
  await shot(6);
  await wait(page, 1000);
  await ctx.close();
  await browser.close();
  const video = fs.readdirSync(tmp).find((f) => f.endsWith('.webm'));
  const mp4 = path.join(OUT, 'farm.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(tmp, video), '-vf', 'fps=30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '28', '-movflags', '+faststart', mp4]);
  // Короткая гифка для описания PR: ускоренно ×2,5, 6 кадров в секунду, 240 точек в ширину.
  const gif = path.join(OUT, 'farm.gif');
  const pal = path.join(tmp, 'pal.png');
  const vf = 'setpts=0.4*PTS,fps=6,scale=240:-1:flags=neighbor';
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp4, '-vf', `${vf},palettegen=max_colors=64`, pal]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp4, '-i', pal, '-lavfi', `${vf}[x];[x][1:v]paletteuse=dither=none`, gif]);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('метки (с):', marks.map(([n, s]) => `${n} ${s.toFixed(1)}`).join(', '));
  console.log('ошибки страницы:', errors.length ? errors : 'нет');
  console.log('готово:', OUT);
})();
