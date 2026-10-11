// Проверка удобства: обходит новую игру (титул → обучение → вкладки утра → день → итоги) в браузере
// и на каждом экране ищет ошибки, горизонтальную прокрутку, вылезающий текст, мелкие кнопки и шрифт.
// Нужен запущенный `npx vite preview --port 4173` и Playwright.
// Запуск: node scripts/ux-audit.cjs <папка для скриншотов> 390x844 ru
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const out = process.argv[2];
const [w, h] = process.argv[3].split('x').map(Number);
const lang = process.argv[4] || 'ru';
const L = lang === 'ru'
  ? { play: 'Играть', next: 'Дальше', start: 'Начинаем!', open: 'Открыть магазин' }
  : { play: 'Play', next: 'Next', start: "Let's go!", open: 'Open the store' };

const AUDIT = () => {
  const issues = [];
  const vw = window.innerWidth;
  const de = document.scrollingElement;
  if (de.scrollWidth > vw + 1) issues.push(`горизонтальная прокрутка страницы: ${de.scrollWidth} > ${vw}`);
  const visible = (el) => { const r = el.getBoundingClientRect(); const st = getComputedStyle(el); return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none'; };
  const label = (el) => (el.innerText || el.getAttribute('aria-label') || el.className || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
  for (const el of document.querySelectorAll('.ui-card *, .ui-hud *, .ui-toast *, button')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 || r.left < -1) issues.push(`за краем экрана: «${label(el)}» (${Math.round(r.left)}…${Math.round(r.right)} из ${vw})`);
    const st = getComputedStyle(el);
    if (el.scrollWidth > el.clientWidth + 2 && st.overflowX !== 'auto' && st.overflowX !== 'scroll' && el.clientWidth > 0 && el.children.length === 0)
      issues.push(`текст не влезает: «${label(el)}» (${el.scrollWidth} > ${el.clientWidth})`);
  }
  for (const b of document.querySelectorAll('button, .ui-btn, .ui-chip, .ui-tab')) {
    if (!visible(b) || b.disabled) continue;
    const r = b.getBoundingClientRect();
    if (r.height < 32 || r.width < 32) issues.push(`маленькая кнопка ${Math.round(r.width)}×${Math.round(r.height)}: «${label(b)}»`);
  }
  for (const img of document.querySelectorAll('img')) if (visible(img) && img.complete && img.naturalWidth === 0) issues.push(`картинка не загрузилась: ${img.getAttribute('src')}`);
  const small = [...document.querySelectorAll('.ui-card *')].filter((el) => visible(el) && el.children.length === 0 && el.innerText?.trim() && parseFloat(getComputedStyle(el).fontSize) < 11);
  if (small.length) issues.push(`мелкий шрифт (<11px): ${small.length} шт., напр. «${label(small[0])}»`);
  return [...new Set(issues)];
};

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const errors = [];
  p.on('pageerror', (e) => errors.push('JS: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  const report = [];
  const check = async (name) => {
    await p.waitForTimeout(450);
    const issues = await p.evaluate(AUDIT);
    report.push({ name, issues });
    await p.screenshot({ path: `${out}/${lang}_${w}x${h}_${String(report.length).padStart(2, '0')}_${name}.png` });
  };
  await p.goto(`http://localhost:4173/?lang=${lang}&debug`);
  await p.waitForFunction(() => document.querySelector('.ui-btn'), null, { timeout: 30000 });
  await check('титул');
  await p.click(`text=${L.play}`);
  await p.waitForTimeout(1500);
  // Письмо/диалог бабушки и обучение: жмём «Дальше», пока не дойдём до вкладок.
  for (let i = 0; i < 25; i++) {
    await p.click('.ui-dialog', { timeout: 800 }).catch(() => {});
    const btn = await p.$(`.ui-card .ui-btn:has-text("${L.next}"), .ui-card .ui-btn:has-text("${L.start}"), .ui-tour .ui-btn:has-text("${L.next}"), .ui-tour .ui-btn:has-text("${L.start}")`);
    if (i === 1 || i === 4) await check(`обучение_${i}`);
    if (!btn) break;
    await btn.click().catch(() => {});
    await p.waitForTimeout(350);
  }
  // Поверх утра бывают окна (гостинец бабушки, новости) — проверить и закрыть.
  let overlays = 0;
  const closeOverlays = async () => {
    for (let i = 0; i < 6; i++) {
      const modals = await p.$$('.ui-modal');
      if (modals.length < 2) return;
      await check(`окно_поверх_${++overlays}`);
      await p.click('.ui-modal:last-of-type .ui-dialog', { timeout: 500 }).catch(() => {});
      const btns = await modals[modals.length - 1].$$('.ui-btn:not([disabled])');
      if (!btns.length) return;
      await btns[btns.length - 1].click().catch(() => {});
      await p.waitForTimeout(600);
    }
  };
  await p.waitForTimeout(1500);
  await closeOverlays();
  await check('утро');
  const tabs = await p.$$('.ui-tab');
  for (let i = 0; i < tabs.length; i++) {
    await closeOverlays();
    await (await p.$$('.ui-tab'))[i].click({ timeout: 8000 }).catch(async () => { await closeOverlays(); await (await p.$$('.ui-tab'))[i].click(); });
    await check(`вкладка_${i + 1}`);
    // Прокрутка вниз — смотрим нижнюю часть вкладки.
    await p.evaluate(() => { const c = document.querySelector('.ui-card'); if (c) c.scrollTop = c.scrollHeight; });
    await check(`вкладка_${i + 1}_низ`);
  }
  await closeOverlays();
  await p.click(`text=${L.open}`).catch(() => report.push({ name: 'открыть', issues: ['нет кнопки «Открыть магазин»'] }));
  await p.waitForTimeout(3000);
  await check('день');
  // Ускорить день и дождаться итогов.
  await p.evaluate(() => { const s = game.scene.getScene('store'); s.timeLeft = 0; for (const c of s.customers) c.sprite?.destroy(); s.customers.clear(); s.endOfDay(); });
  await p.waitForFunction(() => document.querySelector('.ui-card'), null, { timeout: 90000 }).catch(() => report.push({ name: 'итоги', issues: ['итоги дня не появились за 90 с'] }));
  await p.waitForTimeout(1500);
  await check('итоги');
  await p.evaluate(() => { const c = document.querySelector('.ui-card'); if (c) c.scrollTop = c.scrollHeight; });
  await check('итоги_низ');
  console.log(JSON.stringify({ size: `${w}x${h}`, lang, errors, report: report.filter((r) => r.issues.length) }, null, 1));
  await b.close();
})();
