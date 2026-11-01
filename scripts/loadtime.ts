// Замер загрузки (npm run loadtime): как быстро новичок на медленном телефоне по 3G/4G видит игру.
// Собранная игра (dist/) открывается в Chromium с телефонным экраном, сеть урезана до 1,6 Мбит/с
// с задержкой 150 мс, процессор замедлен в 4 раза, кэша нет, сохранения нет (новая игра, ?onb=play).
// Считаем: первую отрисовку (заставка), титул на экране, «Играть» можно нажать, магазин открыт (день
// пошёл после «Играть»), первого покупателя; и сколько файлов и байтов пришло к титулу и к покупателю.
// Итог — медиана прогонов. Первый покупатель новичка приходит по сценарию дня (через несколько секунд
// игрового времени после открытия), так что его время от загрузки зависит мало — смотрите на «открыт».
// telegram.org проверке не нужен: его скрипт отдаём пустым сразу (в Telegram он уже в кэше).
//
// Ключи:
//   --runs <n>      сколько прогонов (по умолчанию 3)
//   --dir <папка>   какую сборку отдавать (по умолчанию dist; сборку сделайте сами: npx vite build)
//   --port <номер>  порт сервера (по умолчанию 4180)
//   --fast          без замедления (проверить, что всё работает)
//   --cpu           замедлить только процессор, сеть как есть
//   --list          перечислить файлы (звёздочка — пришёл до титула)

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { Page } from 'playwright';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const option = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name: string): boolean => args.includes(`--${name}`);

const PHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'ru-RU',
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
};

interface Result {
  paint: number;
  title: number;
  play: number;
  open: number;
  customer: number;
  titleFiles: number;
  titleBytes: number;
  files: number;
  bytes: number;
  errors: string[];
  list: string[];
}

async function measure(page: Page, url: string, fast: boolean, cpuOnly: boolean): Promise<Result> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (!fast && !cpuOnly) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8 });
  if (!fast) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const own = new URL(url).origin;
  const sizes = new Map<string, number>();
  const urls = new Map<string, string>();
  // Когда файл запрошен и когда пришёл (секунды CDP) — для --list.
  const times = new Map<string, [number, number]>();
  let zero = 0;
  cdp.on('Network.requestWillBeSent', (e) => {
    zero ||= e.timestamp;
    urls.set(e.requestId, e.request.url);
    times.set(e.requestId, [e.timestamp, 0]);
  });
  cdp.on('Network.loadingFinished', (e) => {
    const at = urls.get(e.requestId) ?? '';
    if (!at.startsWith(own)) return;
    sizes.set(e.requestId, e.encodedDataLength);
    const span = times.get(e.requestId);
    if (span) span[1] = e.timestamp;
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.stack ?? e.message));
  await page.route(/telegram\.org/, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await page.route(/\/api\//, (route) => route.fulfill({ status: 404, body: '' }));

  const born = Date.now();
  const since = () => Date.now() - born;
  await page.goto(`${url}?lang=ru&debug&onb=play`, { waitUntil: 'commit' });
  const until = async (check: string, what: string, ms = 180_000): Promise<number> => {
    for (const end = Date.now() + ms; !(await page.evaluate(check).catch(() => false)); ) {
      if (Date.now() > end) throw new Error(`не дождались: ${what}`);
      await new Promise((done) => setTimeout(done, 40));
    }
    return since();
  };
  const title = await until("!!document.querySelector('.ui-title')", 'титула');
  const titleFiles = sizes.size;
  const titleBytes = [...sizes.values()].reduce((a, b) => a + b, 0);
  const early = new Set(sizes.keys());
  const ms = (at = 0) => String(Math.round((at - zero) * 1000)).padStart(6);
  const listAll = () =>
    [...sizes.entries()].map(([id, n]) => `${early.has(id) ? '*' : ' '}${String(Math.round(n / 1024)).padStart(5)} КБ ${ms(times.get(id)?.[0])} → ${ms(times.get(id)?.[1])} мс  ${new URL(urls.get(id) ?? '').pathname}`);
  const play = await until("!!document.querySelector('.ui-title .ui-play:not([disabled])')", '«Играть»');
  const paint = (await page.evaluate(() => performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0)) as number;
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('.ui-title .ui-play')?.click());
  // Первый день новичка: окна и реплики прокликиваем сразу, как появятся, — ждём первого покупателя.
  const customerCheck = `(() => {
    const scene = window.game?.scene.getScene('store');
    if (scene?.customers?.size > 0) return true;
    const scope = [...document.querySelectorAll('.ui-dialog, .ui-modal:not(.closing)')].pop();
    const buttons = scope ? [...scope.querySelectorAll('.ui-btn:not([disabled])')] : [];
    buttons.pop()?.click();
    return false;
  })()`;
  const open = await until(`${customerCheck} || !!window.game?.scene.getScene('store')?.running`, 'открытия магазина');
  const customer = await until(customerCheck, 'первого покупателя');
  return {
    paint: Math.round(paint),
    title,
    play,
    open,
    customer,
    titleFiles,
    titleBytes,
    files: sizes.size,
    bytes: [...sizes.values()].reduce((a, b) => a + b, 0),
    errors: errors.filter((e) => !/ERR_TUNNEL|Failed to load resource/.test(e)),
    list: listAll(),
  };
}

async function main(): Promise<void> {
  const require = createRequire(import.meta.url);
  let playwright: typeof import('playwright');
  try {
    playwright = require('playwright');
  } catch {
    console.error('Нужен Playwright: npm i -D playwright && npx playwright install chromium');
    process.exit(1);
  }
  const vite = await import('vite');
  const dir = option('dir') ?? 'dist';
  const server = await vite.preview({ root: ROOT, logLevel: 'warn', build: { outDir: dir }, preview: { port: Number(option('port') ?? 4180), host: '127.0.0.1', strictPort: false } });
  const url = server.resolvedUrls?.local[0] ?? 'http://127.0.0.1:4180/';
  const browser = await playwright.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const runs = Number(option('runs') ?? 3);
  const results: Result[] = [];
  for (let i = 0; i < runs; i++) {
    const context = await browser.newContext(PHONE);
    const page = await context.newPage();
    const r = await measure(page, url, flag('fast'), flag('cpu'));
    await context.close();
    results.push(r);
    console.log(
      `прогон ${i + 1}: заставка ${r.paint} мс, титул ${r.title} мс, «Играть» ${r.play} мс, открыт ${r.open} мс, покупатель ${r.customer} мс; ` +
        `до титула ${r.titleFiles} файлов / ${Math.round(r.titleBytes / 1024)} КБ, всего ${r.files} / ${Math.round(r.bytes / 1024)} КБ`,
    );
    for (const e of r.errors) console.log(`  ОШИБКА: ${e}`);
    if (flag('list') && i === 0) for (const line of r.list) console.log(`  ${line}`);
  }
  const median = (pick: (r: Result) => number) => {
    const sorted = results.map(pick).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  };
  console.log(
    `\nМедиана (${dir}): заставка ${median((r) => r.paint)} мс | титул ${median((r) => r.title)} мс | «Играть» ${median((r) => r.play)} мс | открыт ${median((r) => r.open)} мс | ` +
      `покупатель ${median((r) => r.customer)} мс | до титула ${median((r) => r.titleFiles)} файлов, ${Math.round(median((r) => r.titleBytes) / 1024)} КБ | ` +
      `всего ${median((r) => r.files)} файлов, ${Math.round(median((r) => r.bytes) / 1024)} КБ`,
  );
  await browser.close();
  await new Promise<void>((done) => server.httpServer.close(() => done()));
  process.exit(results.some((r) => r.errors.length) ? 1 : 0);
}

void main();
