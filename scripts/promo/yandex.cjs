// Витрина для Яндекс Игр (promo/yandex/): иконка, обложки, скриншоты и ролики — из самой игры.
//
// Требования Яндекса (yandex.ru/dev/games/doc/ru/console/add-new-game/draft, проверено 2026-11):
//   иконка 512×512 PNG и обложка 800×470 PNG — не скриншоты (п. 5.6), без рамок и скруглений (8.3.3);
//   обложка на витрину 1560×520 (по желанию);
//   скриншоты 9:16 / 16:9, длинная сторона 1280–2560, не меньше 2 на платформу, у десктопа — только
//   горизонтальные, игровой процесс — не меньше 70% картинки (5.1.1.2);
//   ролик 16:9 (обязателен) и 9:16 (по желанию): MP4, до 28 с, до 100 МБ.
// Игра вертикальная, поэтому горизонтальные скриншоты и ролик — три вертикальных кадра рядом
// (геймплей занимает ~95% кадра).
//
// Нужны: собранная игра (npx vite build), `npx vite preview --port <порт>`, Playwright с Chromium и ffmpeg.
// Запуск: node scripts/promo/yandex.cjs [порт=4173] [all | art | shots | video] [ru | en | both]
// (art — иконка и обложки, без игры; shots — скриншоты; video — ролики).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'promo/yandex');
// Кадры и ролики capture.cjs — во временную папку, оттуда раскладываем под Яндекс.
const RAW = fs.mkdtempSync(path.join(process.env.PROMO_TMP || os.tmpdir(), 'yandex-'));
process.env.PROMO_STORE = RAW;
const cap = require('./capture.cjs');
const { chromium } = require('playwright');

const PORT = Number(process.argv[2] || 4173);
const WHAT = process.argv[3] || 'all';
const LANGS = (process.argv[4] || 'both') === 'both' ? ['ru', 'en'] : [process.argv[4]];
const BG = '#1d1a26';
const MAX_VIDEO = 27.9;

/** Подписи без Telegram и без «бесплатно» (п. 8.2.2): остальные — как в каталоге Telegram. */
const YANDEX_TEXT = {
  ru: { rain: 'Бабушкин магазинчик\nтеперь твой', call: 'От ларька — до гипермаркета' },
  en: { rain: "Grandma's little shop\nis yours now", call: 'From a kiosk to a hypermarket', title: 'Corner Shop' },
};
for (const lang of Object.keys(YANDEX_TEXT)) Object.assign(cap.TEXT[lang], YANDEX_TEXT[lang]);

const COVER = {
  ru: { title: 'Магазинчик', line: 'Вырасти бабушкин ларёк до гипермаркета!' },
  // Название — как на заставке игры (title.name): у Яндекса оно должно совпадать везде (п. 5.1.3).
  en: { title: 'Corner Shop', line: "Grow grandma's kiosk into a hypermarket!" },
};

const asset = (name) => `data:image/png;base64,${fs.readFileSync(path.join(ROOT, 'public/assets', name)).toString('base64')}`;
const file64 = (p) => `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;

function fontFaces() {
  const dir = path.join(ROOT, 'node_modules/@fontsource-variable/nunito/files');
  return ['cyrillic', 'latin']
    .map((set) => `@font-face { font-family: N; font-weight: 200 1000; src: url(data:font/woff2;base64,${fs.readFileSync(path.join(dir, `nunito-${set}-wght-normal.woff2`)).toString('base64')}) format('woff2'); }`)
    .join('\n');
}

const STARS = Array.from({ length: 40 }, (_, i) => {
  const x = (i * 197) % 1000;
  const y = (i * 131) % 520;
  return `radial-gradient(circle at ${x / 10}% ${y / 10}%, rgba(255,240,200,.${5 + (i % 4)}) 0 1.5px, transparent 2px)`;
}).join(',');

/** Рисунок ларька из иконки игры (public/icon-512.png) — без круглой рамки. */
function shopArt(page) {
  return page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement('canvas');
    // Внутри рамки: навес и стена — с 32 по 480 по ширине, с 64 по 448 по высоте.
    c.width = 448;
    c.height = 384;
    c.getContext('2d').drawImage(img, 32, 64, 448, 384, 0, 0, 448, 384);
    return c.toDataURL('image/png');
  }, file64(path.join(ROOT, 'public/icon-512.png')));
}

async function shoot(page, html, out, { width, height }) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><html><head><style>${fontFaces()}
    html, body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; background: ${BG}; }
    img { image-rendering: pixelated; position: absolute; }
  </style></head><body>${html}</body></html>`);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => i.decode()));
  });
  await page.screenshot({ path: out });
  console.log(out);
}

/** Иконка 512×512: ларёк с навесом во весь квадрат и кот у двери. */
async function icon(page, shop) {
  await shoot(
    page,
    `<div style="position:absolute;inset:0;background:${STARS},linear-gradient(#2b2440,#3d2f57)"></div>
     <div style="position:absolute;left:0;right:0;bottom:0;height:72px;background:#5a4a3c"></div>
     <div style="position:absolute;left:0;right:0;bottom:64px;height:8px;background:#7a6250"></div>
     <img src="${shop}" style="left:32px;top:40px;width:448px;height:384px">
     <img src="${asset('cat_sit.png')}" style="left:316px;top:312px;width:128px;height:144px">`,
    path.join(OUT, 'icon_512.png'),
    { width: 512, height: 512 },
  );
}

/** Обложка: ларёк → гипермаркет, кот, название и строка. Размер — 800×470 или 1560×520 (на витрину). */
async function cover(page, shop, lang, { width, height, name }) {
  const T = COVER[lang];
  const k = height / 470;
  const s = (n) => Math.round(n * k);
  const wide = width / height > 2;
  const titleSize = s(wide ? 76 : 84);
  const ground = s(70);
  // Ларёк слева, «ГИГАНТ» справа; между ними — стрелка роста.
  const giantW = s(wide ? 380 : 420);
  const giantH = Math.round((giantW * 176) / 300);
  const shopW = s(150);
  const shopH = Math.round((shopW * 384) / 448);
  const leftX = wide ? s(260) : s(40);
  const rightX = width - giantW - (wide ? s(260) : s(36));
  const baseY = height - ground;
  await shoot(
    page,
    `<div style="position:absolute;inset:0;background:${STARS},linear-gradient(#251f36,#4a3566 70%,#6b4a74)"></div>
     <div style="position:absolute;left:0;right:0;bottom:0;height:${ground}px;background:#5a4a3c"></div>
     <div style="position:absolute;left:0;right:0;bottom:${ground - s(10)}px;height:${s(10)}px;background:#7a6250"></div>
     <div style="position:absolute;left:0;right:0;top:${s(26)}px;text-align:center">
       <div style="font:900 ${titleSize}px/1 N;color:#feae34;letter-spacing:1px;
         text-shadow:0 ${s(6)}px 0 #2b2233,0 -${s(3)}px 0 #2b2233,${s(4)}px 0 0 #2b2233,-${s(4)}px 0 0 #2b2233">${T.title}</div>
       <div style="margin-top:${s(12)}px;font:800 ${s(28)}px/1.15 N;color:#f4efe0;text-shadow:0 ${s(3)}px 0 #2b2233">${T.line}</div>
     </div>
     <img src="${shop}" style="left:${leftX}px;top:${baseY - shopH}px;width:${shopW}px;height:${shopH}px">
     <img src="${asset('giant_store.png')}" style="left:${rightX}px;top:${baseY - giantH + s(4)}px;width:${giantW}px;height:${giantH}px">
     <div style="position:absolute;left:${leftX + shopW + s(14)}px;width:${rightX - leftX - shopW - s(28)}px;top:${baseY - s(110)}px;
       text-align:center;font:900 ${s(64)}px/1 N;color:#a8e05f;text-shadow:0 ${s(4)}px 0 #2b2233">➜</div>
     <img src="${asset('cat_sit.png')}" style="left:${leftX + shopW - s(18)}px;top:${baseY - s(54)}px;width:${s(48)}px;height:${s(54)}px">`,
    path.join(OUT, `${name}_${lang}.png`),
    { width, height },
  );
}

async function art(browser) {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const shop = await shopArt(page);
  await icon(page, shop);
  for (const lang of LANGS) {
    await cover(page, shop, lang, { width: 800, height: 470, name: 'cover_800x470' });
    await cover(page, shop, lang, { width: 1560, height: 520, name: 'hero_1560x520' });
  }
  await page.close();
}

/** Три вертикальных кадра рядом в 1920×1080 (для десктопа). */
async function desktop(browser, lang, shots) {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const sets = [
    [1, 2, 3],
    [4, 5, 1],
  ];
  for (const [n, set] of sets.entries()) {
    const w = 608;
    const gap = Math.floor((1920 - w * 3) / 4);
    await shoot(
      page,
      set.map((i, j) => `<img src="${file64(shots[i - 1])}" style="image-rendering:auto;left:${gap + j * (w + gap)}px;top:0;width:${w}px;height:1080px">`).join(''),
      path.join(OUT, `desktop/shot_${lang}_${n + 1}.png`),
      { width: 1920, height: 1080 },
    );
  }
  await page.close();
}

async function shotsFor(browser, lang) {
  fs.mkdirSync(path.join(OUT, 'mobile'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'desktop'), { recursive: true });
  const { errors } = await cap.shots(browser, lang);
  const list = [1, 2, 3, 4, 5].map((i) => {
    const out = path.join(OUT, `mobile/shot_${lang}_${i}.png`);
    fs.copyFileSync(path.join(RAW, `shot_${lang}_${i}.png`), out);
    return out;
  });
  console.log(`${OUT}/mobile/shot_${lang}_1…5.png`);
  await desktop(browser, lang, list);
  return errors;
}

const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
const X264 = ['-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an'];

async function videoFor(browser, lang) {
  const dir = path.join(RAW, `frames_${lang}`);
  const rec = new cap.Recorder(dir);
  // 360×640 × 3 = 1080×1920 — рекомендованный Яндексом размер.
  const errors = [...(await cap.rainScenes(browser, lang, rec, { dsf: 3 })), ...(await cap.snowScenes(browser, lang, rec, { dsf: 3 }))];
  const total = rec.n / 30;
  // Не длиннее 28 с: лишнее — из середины финальной заставки не режем, а ускоряем весь ролик чуть-чуть.
  const speed = total > MAX_VIDEO ? total / MAX_VIDEO : 1;
  const vertical = path.join(OUT, `video_vertical_${lang}.mp4`);
  ff(['-framerate', String(30 * speed), '-i', path.join(dir, '%05d.png'), '-r', '30', '-t', String(MAX_VIDEO), ...X264, vertical]);
  // Горизонтальный: три окна одного ролика со сдвигом на треть, на тёмном фоне.
  const horizontal = path.join(OUT, `video_horizontal_${lang}.mp4`);
  const third = MAX_VIDEO / 3;
  const input = (ss) => ['-stream_loop', '-1', '-ss', ss.toFixed(2), '-i', vertical];
  ff([
    ...input(0),
    ...input(third),
    ...input(third * 2),
    '-filter_complex',
    '[0:v]scale=608:1080:flags=lanczos[a];[1:v]scale=608:1080:flags=lanczos[b];[2:v]scale=608:1080:flags=lanczos[c];' +
      `[a][b][c]hstack=inputs=3,pad=1920:1080:(ow-iw)/2:0:color=${BG}[out]`,
    '-map',
    '[out]',
    '-t',
    String(MAX_VIDEO),
    ...X264,
    horizontal,
  ]);
  for (const f of [vertical, horizontal]) console.log(`${f}: ${(fs.statSync(f).size / 1024 / 1024).toFixed(1)} МБ`);
  return errors;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const errors = [];
  try {
    if (WHAT === 'all' || WHAT === 'art') await art(browser);
    for (const lang of LANGS) {
      if (WHAT === 'all' || WHAT === 'shots') errors.push(...(await shotsFor(browser, lang)));
      if (WHAT === 'all' || WHAT === 'video') errors.push(...(await videoFor(browser, lang)));
    }
  } finally {
    await browser.close();
    fs.rmSync(RAW, { recursive: true, force: true });
  }
  if (errors.length) console.log('Ошибки на странице:', errors.slice(0, 5));
})();
