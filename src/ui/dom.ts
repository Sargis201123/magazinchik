// Интерфейс поверх canvas делаем на DOM: текст остаётся чётким на любом экране,
// а переводы и вёрстка меню проще, чем внутри Phaser.

/**
 * Шрифт интерфейса и надписей в игре. Пиксельные шрифты пробовали: кириллица и цифры
 * в них читаются плохо («5» похожа на «S»), поэтому — чёткий системный.
 */
export const UI_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const css = `
/* Панели HUD — по ширине игры (холст 9:16), а не всего окна: на компьютере не разъезжаются по краям. */
.ui-hud, .ui-stock, .ui-hint { max-width: min(100vw, 56.25dvh); margin: 0 auto; box-sizing: border-box; }
.ui-hud span { background: rgba(24, 20, 37, .72); padding: 4px 8px; border-radius: 6px; }
.ui-hud { position: fixed; top: 0; left: 0; right: 0; display: flex; justify-content: space-between;
  padding: calc(env(safe-area-inset-top) + 8px) 12px 8px; font: 600 15px/1.2 system-ui, sans-serif;
  color: #fff; text-shadow: 0 1px 0 #000; pointer-events: none; }
.ui-stock { position: fixed; left: 0; right: 0; top: calc(env(safe-area-inset-top) + 32px); display: flex;
  gap: 10px; justify-content: center; font: 13px system-ui, sans-serif; color: #e6e1d6; pointer-events: none; }
.ui-hint { position: fixed; left: 0; right: 0; padding: 0 12px; bottom: calc(env(safe-area-inset-bottom) + 12px);
  text-align: center; font: 13px system-ui, sans-serif; color: #e6e1d6; pointer-events: none; }
.ui-modal { position: fixed; inset: 0; background: rgba(15, 12, 22, .78); display: flex; align-items: center;
  justify-content: center; padding: 16px; overflow-y: auto; }
/* Окно в пиксельной рамке (assets/ui_frame.png, 9 частей по 8 пикселей). */
.ui-card { color: #2b2233; border: 16px solid transparent; border-image: url(assets/ui_frame.png) 8 fill / 16px stretch;
  image-rendering: pixelated; padding: 2px 4px; max-width: 372px; width: 100%; max-height: calc(100dvh - 32px);
  overflow-y: auto; box-sizing: border-box; font: 15px/1.4 system-ui, sans-serif;
  filter: drop-shadow(0 4px 0 rgba(24, 20, 37, .6)); }
/* Пиксельные иконки вместо эмодзи (монета, товары, коробка). */
.ui-ico { height: 1.15em; width: auto; vertical-align: -0.22em; image-rendering: pixelated; }
.ui-portrait { width: 48px; height: 48px; image-rendering: pixelated; border-radius: 6px; flex: none; }
.ui-who { display: flex; align-items: center; gap: 10px; margin: 6px 0; }
.ui-who b, .ui-who h3 { margin: 0; }
.ui-card h2 { margin: 0 0 10px; font-size: 18px; display: flex; justify-content: space-between; }
.ui-card h3 { margin: 14px 0 6px; font-size: 15px; }
.ui-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 4px 0; }
.ui-muted { color: #7a7066; font-size: 13px; }
.ui-quote { font-style: italic; font-size: 13px; margin: 2px 0 6px; }
.ui-box { border: 2px solid #2b2233; border-radius: 6px; padding: 8px; margin: 6px 0; background: #fbf6ea; }
.ui-btn { display: block; width: 100%; margin-top: 10px; padding: 12px; font: 600 15px system-ui, sans-serif;
  border: 3px solid #2b2233; border-radius: 6px; background: #8fd16a; color: #2b2233; box-shadow: 0 3px 0 #2b2233; }
.ui-btn, .ui-chip, .ui-tab { transition: transform .18s cubic-bezier(.3, 1.8, .5, 1), box-shadow .1s;
  -webkit-tap-highlight-color: transparent; }
.ui-btn:active, .ui-chip:active { transform: translateY(2px) scale(.97); box-shadow: 0 1px 0 #2b2233; transition-duration: .05s; }
.ui-tab:active { transform: scale(.94); transition-duration: .05s; }
/* Окна появляются с лёгким подпрыгиванием и тают при закрытии. */
.ui-modal { animation: ui-fade .18s ease-out; }
.ui-modal .ui-card { animation: ui-pop .3s cubic-bezier(.3, 1.45, .5, 1); }
.ui-modal.closing { animation: none; opacity: 0; transition: opacity .15s; pointer-events: none; }
@keyframes ui-fade { from { opacity: 0; } }
@keyframes ui-pop { from { transform: translateY(14px) scale(.92); opacity: 0; } }
/* Новая вкладка въезжает сбоку. */
.ui-enter { animation: ui-enter .22s ease-out; }
@keyframes ui-enter { from { transform: translateX(14px); opacity: 0; } }
/* Деньги в верхней панели: растут — зелёным, тратятся — красным. */
.ui-money-up { color: #b8f59a; }
.ui-money-down { color: #ff9a9a; }
/* Шторка между днями: роллет опускается, на нём номер дня, и поднимается уже утром. */
.ui-curtain { position: fixed; inset: 0; z-index: 50; transform: translateY(-101%);
  background: repeating-linear-gradient(#9aa8c0 0 11px, #6b7a99 11px 13px, #c0cadc 13px 14px);
  border-bottom: 10px solid #3a4466; box-shadow: 0 6px 0 rgba(24, 20, 37, .5);
  transition: transform .42s cubic-bezier(.55, 0, .35, 1.15); display: flex; align-items: center; justify-content: center; }
.ui-curtain.down { transform: translateY(0); }
.ui-curtain.up { transform: translateY(-101%); transition: transform .5s cubic-bezier(.6, -0.2, .7, 1); }
.ui-curtain-label { font: 800 30px system-ui, sans-serif; color: #fee761; background: #2b2233; padding: 10px 22px;
  border: 3px solid #181425; border-radius: 8px; box-shadow: 0 4px 0 #181425; letter-spacing: 1px; }
.ui-btn.secondary { background: #f2c14e; }
.ui-btn[disabled], .ui-chip[disabled] { background: #c9c0ad; color: #7a7066; }
.ui-chip { padding: 5px 9px; font: 600 13px system-ui, sans-serif; border: 2px solid #2b2233; border-radius: 6px;
  background: #f2c14e; color: #2b2233; box-shadow: 0 2px 0 #2b2233; min-width: 34px; }
.ui-chip.active { background: #2b2233; color: #f4ecd8; }
.ui-chip-off { background: #e6dcc4; color: #7a7066; box-shadow: none; }
.ui-chips { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.ui-tabs { display: flex; gap: 4px; margin: 8px 0 6px; }
.ui-tab { flex: 1; padding: 8px 1px; font: 600 12px system-ui, sans-serif; border: 2px solid #2b2233;
  border-radius: 6px; background: #e6dcc4; color: #2b2233; }
.ui-tab.active { background: #2b2233; color: #f4ecd8; }
.ui-price { display: flex; align-items: center; gap: 8px; padding: 6px 8px; margin: 6px 0; border: 2px solid #2b2233;
  border-radius: 6px; background: #fbf6ea; }
.ui-price-icon { width: 30px; height: 36px; image-rendering: pixelated; flex: none; }
.ui-price-info { flex: 1; min-width: 0; font-size: 14px; }
.ui-price-value { min-width: 54px; text-align: center; }
.ui-price-locked { background: #e6dcc4; filter: grayscale(1); opacity: .7; }
.ui-bar { height: 6px; margin: 4px 0 2px; background: #e6dcc4; border: 1px solid #2b2233; border-radius: 3px; overflow: hidden; }
.ui-bar-fill { height: 100%; }
.ui-hint-tip { color: #2b2233; font-weight: 700; }
.ui-hint.ui-hint-tip { background: #fee761; border: 2px solid #2b2233; border-radius: 8px; padding: 6px 10px;
  width: fit-content; max-width: min(92vw, 52dvh); box-shadow: 0 3px 0 #2b2233; animation: ui-tip 1.2s ease-in-out infinite; }
@keyframes ui-tip { 50% { transform: translateY(-3px); } }
.ui-pulse { animation: ui-pulse 1s ease-in-out infinite; }
@keyframes ui-pulse { 50% { transform: scale(1.12); background: #fee761; } }
.ui-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 6px 0 8px; }
.ui-tile { border: 2px solid #2b2233; border-radius: 6px; background: #fbf6ea; padding: 6px 8px; display: flex;
  flex-direction: column; }
.ui-tile b { font-size: 20px; }
.ui-tile span { font-size: 12px; color: #7a7066; }
.ui-tile.good { background: #e3f5d6; }
.ui-tile.bad { background: #fbe0dc; }
.ui-chart { display: flex; align-items: flex-end; gap: 6px; height: 96px; margin: 4px 0 10px; padding: 4px;
  border: 2px solid #2b2233; border-radius: 6px; background: #fbf6ea; }
.ui-chart-col { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; }
.ui-chart-bar { width: 100%; background: #8fd16a; border: 2px solid #2b2233; border-bottom: 0; border-radius: 3px 3px 0 0; }
.ui-chart-bar.today { background: #fee761; }
.ui-chart-value { font-size: 10px; color: #5a5048; }
.ui-chart-day { font-size: 10px; color: #7a7066; }
.ui-bump { display: inline-block; animation: ui-bump .35s ease-out; }
@keyframes ui-bump { 40% { transform: scale(1.25); background: rgba(143, 209, 106, .85); } }
.ui-note { font-size: 13px; color: #5a5048; margin: 4px 0 8px; }
.ui-chip { white-space: nowrap; }
.ui-ad-icon { font-size: 24px; text-align: center; }
.ui-hearts { color: #e43b44; font-size: 13px; letter-spacing: 1px; white-space: nowrap; }
/* Подарок за вход: семь коробочек серии, сегодняшняя подпрыгивает. */
.ui-gift-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin: 4px 0 8px; }
.ui-gift-day { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 0; border: 2px solid #2b2233;
  border-radius: 6px; background: #fbf6ea; font-size: 10px; color: #6a5f58; }
.ui-gift-day.done { background: #e3f5d6; color: #3e8948; }
.ui-gift-day.today { background: #fee761; color: #2b2233; font-weight: 700; animation: ui-pulse 1s ease-in-out infinite; }
.ui-gift-day.big .ui-gift-box { font-size: 20px; }
.ui-gift-box { font-size: 16px; line-height: 1.2; }
.ui-gift-reward { margin: 8px 0 2px; padding: 8px; text-align: center; font: 800 17px system-ui, sans-serif; background: #fee761;
  border: 2px solid #2b2233; border-radius: 8px; }
/* Сводка утра: каждая строка — отдельно, крупнее и темнее, без «простыни» серого текста. */
.ui-infos { border: 2px solid #2b2233; border-radius: 8px; background: #fbf6ea; padding: 2px 10px; margin: 4px 0 8px; }
.ui-infos > div { font-size: 13.5px; line-height: 1.3; color: #3a3046; padding: 5px 0; margin: 0; font-style: normal; }
.ui-infos > div + div { border-top: 1px dashed #d8ccb0; }
/* Вкладки прилипают к верху окна, пока листаешь длинный список. */
.ui-card .ui-tabs { position: sticky; top: -2px; z-index: 3; background: #f4ecd8; padding: 6px 0; margin: 4px 0 6px;
  box-shadow: 0 6px 6px -6px rgba(43, 34, 51, .35); }
.ui-tab { font-size: 12.5px; }
.ui-card h3 { font-size: 16px; border-bottom: 2px solid #2b2233; padding-bottom: 2px; }
/* Строка товара: крупная иконка, название с жёлтым ценником, подпись, кнопки справа — ничего не переносится. */
.ui-item { display: grid; grid-template-columns: 34px 1fr auto; gap: 8px; align-items: center; padding: 7px 0; }
.ui-item + .ui-item { border-top: 1px dashed #d8ccb0; }
.ui-item-icon { width: 30px; height: 36px; image-rendering: pixelated; justify-self: center; }
.ui-item-name { font-weight: 700; font-size: 15px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ui-item-sub { font-size: 12.5px; color: #6a5f58; margin-top: 1px; }
.ui-item-actions { display: flex; gap: 6px; align-items: center; }
.ui-item-actions .ui-chip { min-width: 46px; padding: 8px 6px; font-size: 14px; }
.ui-tag { display: inline-flex; align-items: center; gap: 2px; background: #fee761; border: 2px solid #2b2233; border-radius: 6px;
  padding: 0 5px; font: 800 13px system-ui, sans-serif; line-height: 1.5; }
.ui-haggle { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; padding: 6px 8px;
  background: #f4ecd8; border-radius: 6px; }
.ui-haggle b { font-size: 13px; }
.ui-haggle .ui-muted { margin-left: auto; }
/* Оформление: сетка карточек с превью. Поставленное — зелёное, премиум — с золотой рамкой. */
.ui-decor-kind { font: 700 14px system-ui, sans-serif; margin: 12px 0 4px; }
.ui-decor-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.ui-decor { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 4px; border: 2px solid #2b2233;
  border-radius: 8px; background: #fbf6ea; color: #2b2233; box-shadow: 0 2px 0 #2b2233; font: 12px/1.2 system-ui, sans-serif; }
.ui-decor.active { background: #e3f5d6; border-color: #3e8948; box-shadow: 0 2px 0 #3e8948; }
.ui-decor.premium { border-color: #feae34; }
.ui-decor[disabled] { opacity: .65; }
.ui-decor-preview { width: 52px; height: 36px; border: 2px solid #2b2233; border-radius: 4px; image-rendering: pixelated;
  background-size: 32px 32px; display: flex; align-items: center; justify-content: center; font-size: 20px; background-color: #fff; }
.ui-decor-preview img { max-width: 48px; max-height: 32px; image-rendering: pixelated; }
.ui-decor-name { font-weight: 700; min-height: 2.4em; display: flex; align-items: center; text-align: center; }
.ui-decor-status { font-size: 11.5px; font-weight: 700; color: #6a5f58; }
.ui-decor.active .ui-decor-status { color: #3e8948; }
/* Всплывашка «Новое достижение!» сверху: выезжает, висит и уезжает. */
.ui-toast { position: fixed; z-index: 40; left: 50%; top: calc(env(safe-area-inset-top) + 62px); display: flex; gap: 10px;
  align-items: center; padding: 8px 14px 8px 10px; background: #fbf6ea; color: #2b2233; border: 3px solid #2b2233;
  border-radius: 10px; box-shadow: 0 4px 0 #2b2233; font: 13px/1.3 system-ui, sans-serif; pointer-events: none;
  transform: translate(-50%, -160%); transition: transform .45s cubic-bezier(.3, 1.4, .5, 1); max-width: 88vw; }
.ui-toast.shown { transform: translate(-50%, 0); }
.ui-toast img { width: 36px; height: 42px; image-rendering: pixelated; animation: ui-badge 1.2s ease-in-out infinite; }
@keyframes ui-badge { 50% { transform: rotate(-8deg) scale(1.08); } }
.ui-toast b { display: block; font-size: 12px; color: #b86f50; text-transform: uppercase; letter-spacing: .5px; }
/* Книга достижений: сетка значков; закрытые — серые, с полоской прогресса. */
.ui-badges { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin: 8px 0; }
.ui-badge { border: 2px solid #2b2233; border-radius: 8px; background: #fbf6ea; padding: 6px 4px; text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 2px; }
.ui-badge img { width: 40px; height: 47px; image-rendering: pixelated; }
.ui-badge b { font-size: 12px; line-height: 1.2; }
.ui-badge span { font-size: 10.5px; color: #7a7066; line-height: 1.25; }
.ui-badge.locked img { filter: grayscale(1) brightness(.75); opacity: .55; }
.ui-badge.locked { background: #ece3cf; }
.ui-badge .ui-bar { width: 100%; }
/* Диалог как в RPG: крупный портрет, табличка с именем, облако реплики с хвостиком. */
.ui-dialog { margin: 4px 0; }
.ui-dialog-art { display: block; width: 100%; aspect-ratio: 16 / 9; image-rendering: pixelated; margin: 6px 0 10px;
  border: 3px solid #2b2233; border-radius: 8px; box-shadow: 0 3px 0 #2b2233; animation: ui-art .6s ease-out; }
@keyframes ui-art { from { opacity: 0; transform: scale(1.04); } }
.ui-dialog-row { display: flex; align-items: flex-end; gap: 10px; margin-top: 6px; }
.ui-dialog-face { width: 88px; height: 88px; flex: none; image-rendering: pixelated; border: 3px solid #2b2233;
  border-radius: 8px; box-shadow: 0 3px 0 #2b2233; background: #fbf6ea; animation: ui-pop .3s cubic-bezier(.3, 1.45, .5, 1); }
.ui-dialog-face.talking { animation: ui-talk .32s ease-in-out infinite; }
@keyframes ui-talk { 50% { transform: translateY(-2px) scale(1.02); } }
.ui-dialog-speech { position: relative; flex: 1; min-height: 88px; background: #fff; border: 3px solid #2b2233;
  border-radius: 10px; padding: 18px 10px 8px; box-shadow: 0 3px 0 #2b2233; cursor: pointer; }
.ui-dialog-speech::before { content: ''; position: absolute; left: -11px; bottom: 16px; border: 8px solid transparent;
  border-right-color: #2b2233; border-left: 0; }
.ui-dialog-speech::after { content: ''; position: absolute; left: -6px; bottom: 18px; border: 6px solid transparent;
  border-right-color: #fff; border-left: 0; }
.ui-dialog-name { position: absolute; top: -12px; left: 10px; background: #fee761; border: 2px solid #2b2233;
  border-radius: 6px; padding: 1px 8px; font: 700 13px system-ui, sans-serif; }
.ui-dialog-text { margin: 0; font-size: 15px; line-height: 1.4; min-height: 3em; }
.ui-dialog-caret { display: inline-block; margin-left: 4px; font-size: 10px; color: #b86f50; animation: ui-tip .8s ease-in-out infinite; }
.ui-dialog-after { opacity: 0; transform: translateY(4px); transition: opacity .25s, transform .25s; }
.ui-dialog-after.shown { opacity: 1; transform: none; }
`;

let styled = false;
export function injectStyles(): void {
  if (styled) return;
  styled = true;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function button(
  label: string,
  onClick: () => void,
  className = 'ui-btn',
  disabled = false,
): HTMLButtonElement {
  const btn = el('button', className, label);
  btn.disabled = disabled;
  btn.addEventListener('click', onClick);
  return btn;
}

/** Открывает модальное окно. Возвращает карточку и функцию закрытия. */
export function openModal(): { card: HTMLDivElement; close: () => void } {
  injectStyles();
  const overlay = el('div', 'ui-modal');
  const card = el('div', 'ui-card');
  overlay.append(card);
  document.body.append(overlay);
  // Всё, что окно нарисует, получает пиксельные иконки вместо эмодзи.
  const observer = new MutationObserver(() => pixelize(card));
  observer.observe(card, { childList: true, subtree: true, characterData: true });
  return {
    card,
    close: () => {
      observer.disconnect();
      overlay.classList.add('closing');
      setTimeout(() => overlay.remove(), 160);
    },
  };
}

/** Шторка между экранами: опускается, в середине выполняется смена экрана, поднимается. */
export function curtain(label: string, middle: () => void): void {
  injectStyles();
  const shade = el('div', 'ui-curtain');
  shade.append(el('div', 'ui-curtain-label', label));
  document.body.append(shade);
  requestAnimationFrame(() => requestAnimationFrame(() => shade.classList.add('down')));
  setTimeout(() => {
    middle();
    setTimeout(() => shade.classList.add('up'), 350);
    setTimeout(() => shade.remove(), 950);
  }, 480);
}

/** Всплывашка сверху на пару секунд: картинка, заголовок, текст. */
export function toast(image: string, title: string, text: string): void {
  injectStyles();
  const box = el('div', 'ui-toast');
  const img = el('img');
  img.src = image;
  img.alt = '';
  const body = el('div');
  body.append(el('b', '', title), el('span', '', text));
  box.append(img, body);
  document.body.append(box);
  requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add('shown')));
  setTimeout(() => box.classList.remove('shown'), 3200);
  setTimeout(() => box.remove(), 3800);
}

const ICONS: Record<string, string> = {
  '💰': 'coin',
  '🍞': 'item_bread',
  '🍎': 'item_apples',
  '🥔': 'item_potatoes',
  '🥛': 'item_milk',
  '🥩': 'item_meat',
  '📦': 'box',
  '🍦': 'item_icecream',
  '🍊': 'item_tangerines',
  '💐': 'item_flowers',
};
const ICON_RE = /(💰|🍞|🍎|🥔|🥛|🥩|📦|🍦|🍊|💐)/u;

/** Заменяет эмодзи денег и товаров на пиксельные картинки из игры. */
export function pixelize(root: Node): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const found: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (ICON_RE.test(node.nodeValue ?? '')) found.push(node as Text);
  }
  for (const node of found) {
    const frag = document.createDocumentFragment();
    for (const part of (node.nodeValue ?? '').split(ICON_RE)) {
      if (!part) continue;
      const key = ICONS[part];
      if (!key) {
        frag.append(part);
        continue;
      }
      const img = el('img', 'ui-ico');
      img.src = `assets/${key}.png`;
      img.alt = part;
      frag.append(img);
    }
    node.replaceWith(frag);
  }
}

/** Пиксельный портрет персонажа или поставщика (assets/portrait_<id>.png) рядом с именем. */
export function who(portraitId: string, name: HTMLElement): HTMLDivElement {
  const row = el('div', 'ui-who');
  const img = el('img', 'ui-portrait');
  img.src = `assets/portrait_${portraitId}.png`;
  img.alt = '';
  row.append(img, name);
  return row;
}
