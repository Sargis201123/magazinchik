// Сколько нажатий от «Продолжить» до «Открыть магазин»: npm run build && npx vite preview --port 4173,
// потом vite-node scripts/morning-taps.ts [--url http://localhost:4173/] [--shots папка]
//
// Игрок «как все»: окна и сюжет пролистывает главной кнопкой, в меню забирает всё, что предлагают
// забрать, и отвечает первой кнопкой на карточки «человек, абзац, две кнопки», потом открывает магазин.
// Два утра: обычное (e2e/save.json, середина игры) и худший понедельник (всё сразу: сундучок, письмо,
// сосед, гостинец, пропуск, история, пакость, кот, уход сотрудника, кража, событие дня…).
// Награды с сервера (лига, гильдия, торговая неделя, угощения) без сервера не приходят — их в счёте нет.

import { readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { Page } from 'playwright';
import { seasonOf } from '../src/game/pass';
import { TALE_IDS } from '../src/game/tales';
import type { StoreState } from '../src/game/economy';

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const BASE = arg('url') ?? 'http://localhost:4173/';
const SHOTS = arg('shots');

const local = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = local(new Date());
const yesterday = local(new Date(Date.now() - 86_400_000));

const save = JSON.parse(readFileSync(new URL('../e2e/save.json', import.meta.url), 'utf8')) as { version: number; state: StoreState };
const base: StoreState = { ...save.state, gift: { lastDate: today, streak: 1 } };

/** Худший понедельник: всё, что может прийти утром, пришло разом. */
function worst(s: StoreState): StoreState {
  const day = s.day;
  return {
    ...s,
    gift: { lastDate: yesterday, streak: 3 },
    ret: {
      chest: { sum: 1260, cashier: 900, branch: 360, hours: 11, units: 42 },
      letter: { from: 'grandma', n: 2, date: yesterday },
      order: { who: 'petr', pid: 'bread', qty: 4, day },
    },
    pass: { season: seasonOf(Date.now()), xp: 260, free: [], premium: [], paid: false } as unknown as StoreState['pass'],
    tales: { done: [], current: { id: TALE_IDS[0], ep: 0, due: day } },
    trick: { kind: 'promoter', day, until: day + 1 },
    staffEvent: { kind: 'idea', roles: ['baker'], day },
    cat: undefined,
    catAsk: undefined,
    quitNotice: [s.staff.find((m) => m.role === 'cleaner')!],
    security: { ...s.security, news: { day, outcome: 'stolen', goods: [{ id: 'bread', n: 3 }], cash: 200, repair: 60, bounty: 0 } },
  };
}

const MORNINGS: [string, StoreState][] = [
  ['обычное утро (e2e/save.json)', base],
  ['худший понедельник', worst(base)],
];

/** Одно утро: нажатия до открытия магазина и что нажимали. */
async function morning(page: Page, name: string, state: StoreState): Promise<{ taps: number; log: string[] }> {
  await page.addInitScript((data) => {
    localStorage.clear();
    localStorage.setItem('magazinchik.save', data);
  }, JSON.stringify({ version: save.version, state }));
  await page.goto(`${BASE}?lang=ru&debug`);
  await page.waitForSelector('.ui-title .ui-btn', { timeout: 60_000 });
  // Кнопка на титуле дышит (анимация) — нажимаем из страницы, а не ждём, пока замрёт.
  await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.ui-title .ui-btn')].find((b) => b.innerText.includes('Продолжить'))?.click());
  const log: string[] = [];
  for (let i = 0; i < 120; i++) {
    await page.waitForTimeout(600);
    const step = await page.evaluate(() => {
      const visible = (b: HTMLElement) => !(b as HTMLButtonElement).disabled && b.offsetParent !== null;
      const top = [...document.querySelectorAll<HTMLElement>('.ui-dialog, .ui-modal:not(.closing)')].pop();
      if (!top) return null;
      const menu = top.classList.contains('ui-full') || !!top.querySelector('.ui-full');
      const click = (b: HTMLElement) => {
        const text = b.innerText.replace(/\s+/g, ' ').trim();
        b.click();
        return text;
      };
      if (!menu) {
        // Окно или сюжет: главная (последняя) кнопка.
        const buttons = [...top.querySelectorAll<HTMLElement>('.ui-btn')].filter(visible);
        const b = buttons.pop();
        return b ? `окно: ${click(b)}` : null;
      }
      // Меню: забрать и ответить на всё над сводкой «Сегодня» (почта, подарки, награды, истории).
      for (const box of top.querySelectorAll<HTMLElement>('.ui-mail, .ui-duel, .ui-rush, .ui-tale, .ui-career')) {
        if (box.closest('.ui-today')) continue;
        const b = [...box.querySelectorAll<HTMLElement>('.ui-btn')].filter(visible)[0];
        if (b && !b.dataset.tapped) {
          b.dataset.tapped = '1';
          return `меню: ${click(b)}`;
        }
      }
      const open = [...top.querySelectorAll<HTMLElement>('.ui-open-bar .ui-btn')].filter(visible)[0];
      return open ? `ОТКРЫТЬ: ${click(open)}` : null;
    });
    if (!step) continue;
    log.push(step);
    if (step.startsWith('ОТКРЫТЬ')) break;
  }
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name.replace(/\W+/g, '_')}.png` });
  return { taps: log.length, log };
}

async function main(): Promise<void> {
  const playwright = createRequire(import.meta.url)('playwright') as typeof import('playwright');
  const browser = await playwright.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  for (const [name, state] of MORNINGS) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const { taps, log } = await morning(page, name, state);
    console.log(`${name}: ${taps} нажатий до открытия магазина`);
    for (const line of log) console.log(`  · ${line}`);
    if (errors.length) console.log(`  ошибки страницы: ${errors.join(' | ')}`);
    await context.close();
  }
  await browser.close();
}

void main();
