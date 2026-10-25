// Проверка нажатий (npm run taps): кубок 🏆 в правом верхнем углу утра нажимается настоящим касанием
// пальца — и в обычном браузере, и в полном экране Telegram, где поверх игры лежат кнопки «Закрыть» и «⋯»
// (их высоту Telegram сообщает как safeAreaInset + contentSafeAreaInset). Кубок раньше оказывался как раз
// под ними: Telegram забирал касание себе, и до игры оно не доходило.
//
// Магазин середины игры (e2e/save.json), телефоны 390×844, 360×800 и 320×568. Провал — код выхода 1.
// Ключи: --no-build (взять готовую dist/), --url <адрес> (уже запущенная игра).
// Нужен Playwright с Chromium (свой Chromium — переменная CHROMIUM_PATH).

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { Browser, Page } from 'playwright';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const option = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const SCREENS = [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
  { width: 320, height: 568 },
];
/** Полный экран Telegram на iPhone: вырез 47 px и полоса с кнопками «Закрыть» / «⋯» ещё 46 px. */
const TELEGRAM = { top: 47, content: 46, bottom: 34 };

/** Подменить Telegram WebApp до загрузки игры: полный экран с отступами, остальное — пустышки. */
function fakeTelegram(insets: typeof TELEGRAM): void {
  const noop = () => {};
  (window as unknown as { Telegram: unknown }).Telegram = {
    WebApp: {
      initData: '',
      initDataUnsafe: {},
      isFullscreen: true,
      safeAreaInset: { top: insets.top, bottom: insets.bottom, left: 0, right: 0 },
      contentSafeAreaInset: { top: insets.content, bottom: 0, left: 0, right: 0 },
      ready: noop,
      expand: noop,
      onEvent: noop,
    },
  };
}

/** Дойти до утра: «Продолжить», затем закрывать новости и диалоги, пока не появится кубок. */
async function toMorning(page: Page): Promise<void> {
  await page.locator('button.ui-play').first().click({ force: true, timeout: 20000 });
  for (let i = 0; i < 30; i++) {
    if (await page.locator('.ui-profile-btn').count()) return;
    const buttons = page.locator('.ui-modal:not(.closing) button.ui-btn');
    if (await buttons.count()) await buttons.last().click({ force: true }).catch(() => {});
    else await page.locator('.ui-dialog').first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
  }
  throw new Error('утро так и не открылось');
}

/** Одна проверка: кубок не под кнопками Telegram, касание попадает в него и открывает профиль. */
async function check(browser: Browser, url: string, save: string, screen: (typeof SCREENS)[number], telegram: boolean): Promise<string[]> {
  const context = await browser.newContext({ viewport: screen, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ru-RU' });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((s) => localStorage.setItem('magazinchik.save', s), save);
  if (telegram) await page.addInitScript(fakeTelegram, TELEGRAM);
  await page.goto(`${url}?lang=ru`);
  const name = `${screen.width}×${screen.height}${telegram ? ' Telegram' : ''}`;
  const fail = (why: string) => [`${name}: ${why}`];
  try {
    await toMorning(page);
    await page.waitForTimeout(400);
    const box = await page.locator('.ui-profile-btn').first().boundingBox();
    if (!box) return fail('кубка нет на экране');
    const covered = telegram ? TELEGRAM.top + TELEGRAM.content : 0;
    if (box.y < covered) return fail(`кубок под кнопками Telegram (верх ${Math.round(box.y)} px, а кнопки до ${covered} px)`);
    if (box.x + box.width > screen.width || box.y + box.height > screen.height) return fail('кубок за краем экрана');
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const hit = await page.evaluate(([px, py]) => Boolean(document.elementFromPoint(px, py)?.closest('.ui-profile-btn')), [x, y]);
    if (!hit) return fail('в середине кубка лежит что-то другое');
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(400);
    if (!(await page.locator('.ui-profile-btn.active').count())) return fail('касание не открыло профиль');
    return errors.map((e) => `${name}: ошибка в странице: ${e}`);
  } catch (error) {
    return fail(String(error));
  } finally {
    await context.close();
  }
}

async function main(): Promise<void> {
  const playwright = createRequire(import.meta.url)('playwright') as typeof import('playwright');
  let url = option('url');
  let close = async () => {};
  if (!url) {
    const vite = await import('vite');
    if (!args.includes('--no-build')) await vite.build({ root: ROOT, logLevel: 'warn' });
    const server = await vite.preview({ root: ROOT, logLevel: 'warn', preview: { port: 4174, host: '127.0.0.1' } });
    url = server.resolvedUrls?.local[0] ?? 'http://127.0.0.1:4174/';
    close = () => new Promise((done) => server.httpServer.close(() => done()));
  }
  const save = readFileSync(`${ROOT}e2e/save.json`, 'utf8');
  const browser = await playwright.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const problems: string[] = [];
  for (const screen of SCREENS) for (const telegram of [false, true]) problems.push(...(await check(browser, url, save, screen, telegram)));
  await browser.close();
  await close();
  for (const p of problems) console.log(`✗ ${p}`);
  console.log(problems.length ? 'ПРОВАЛ' : 'Кубок нажимается везде');
  process.exit(problems.length ? 1 : 0);
}

void main();
