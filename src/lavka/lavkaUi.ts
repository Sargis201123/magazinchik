// Окна и панели «Лавки «Своё»» (DOM, как ui/* «Магазинчика»): верхняя панель (монеты, часы, склад лавки по
// товарам), карточки заказов дня, утреннее окно с планом и заказами, подсказка строкой и вечерние итоги.
// Сцена — LavkaScene.ts.

import { t, type TextKey } from '../i18n';
import { png } from '../platform/assets';
import { sound } from '../platform/sound';
import { el, injectStyles, pixelize, UI_FONT } from '../ui/dom';
import { sheetPng } from '../ui/sheet';
import { GOODS, SEED, SEEDS, clock, type Good, type Order, type Plan, type Seed, type Summary } from '../game/lavka/day';

/** Картинка товара: молоко и овощи — из атласа магазина, остальное — свои (art/lavka.py). */
export const GOOD_ICON: Record<Good, string> = { milk: 'item_milk', eggs: 'lavka_egg', veg: 'item_apples', honey: 'lavka_ico_honey' };
const iconUrl = (key: string): string => (key.startsWith('lavka_') ? png(key) : sheetPng(key));

const css = `
.ui-on-farm .ui-hud, .ui-on-farm .ui-stock, .ui-on-farm .ui-hint { display: none !important; }
.ui-on-farm .ui-mute { bottom: calc(var(--safe-bottom, env(safe-area-inset-bottom)) + 12px); }
.lv-hud { position: fixed; left: 50%; transform: translateX(-50%); top: calc(var(--safe-top, env(safe-area-inset-top)) + 8px);
  width: min(var(--game-w, 100vw), 100vw); box-sizing: border-box; padding: 0 10px; display: grid; gap: 6px;
  font: 800 15px/1.15 ${UI_FONT}; color: #fff; pointer-events: none; z-index: 5; }
.lv-row { display: grid; grid-template-columns: 1fr auto 1fr; gap: 6px; align-items: center; }
.lv-pill { background: rgba(24, 20, 37, .84); border-radius: 10px; padding: 5px 10px; white-space: nowrap; display: inline-flex; gap: 6px;
  align-items: center; font-variant-numeric: tabular-nums; }
.lv-pill .ui-ico, .lv-pill img { width: 16px; height: 16px; image-rendering: pixelated; }
.lv-row .left { justify-self: start; }
.lv-row .mid { justify-self: center; display: grid; justify-items: center; gap: 3px; }
.lv-clock-bar { width: 86px; height: 5px; border-radius: 3px; background: #3a4466; overflow: hidden; }
.lv-clock-bar i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #fee761, #f77622); }
.lv-stock { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-bottom, env(safe-area-inset-bottom)) + 12px);
  display: flex; gap: 4px; justify-content: center; z-index: 5; pointer-events: none; font: 800 15px/1.15 ${UI_FONT}; color: #fff; }
.lv-good { background: rgba(24, 20, 37, .84); border-radius: 8px; padding: 3px 7px; display: inline-flex; gap: 4px; align-items: center;
  font-size: 13px; transition: transform .15s; }
.lv-good img { width: 14px; height: 14px; image-rendering: pixelated; object-fit: contain; }
.lv-good.bump { transform: scale(1.25); }
.lv-pill.left { transition: transform .12s; }
.lv-pill.left.bump { transform: scale(1.18); }
.lv-good.empty { color: #f6757a; }
.lv-good.want { background: #a22633; animation: lv-breathe .8s ease-in-out 3; }
.lv-orders { position: fixed; right: calc(10px + max(0px, (100vw - var(--game-w, 100vw)) / 2)); bottom: calc(var(--safe-bottom, env(safe-area-inset-bottom)) + 48px);
  display: flex; gap: 5px; z-index: 5; pointer-events: none; }
.lv-order { background: #fbf6ea; color: #2b2233; border: 3px solid #2b2233; border-radius: 9px; padding: 3px 7px; font: 800 12px/1.2 ${UI_FONT};
  display: grid; grid-template-columns: auto auto; gap: 1px 6px; align-items: center; box-shadow: 0 3px 0 rgba(43,34,51,.6); min-width: 88px; }
.lv-order img.who { width: 24px; height: 24px; grid-row: span 2; image-rendering: pixelated; border-radius: 4px; border: 2px solid #2b2233; }
.lv-order .need { display: inline-flex; gap: 3px; align-items: center; font-size: 13px; }
.lv-order .need img { width: 13px; height: 13px; image-rendering: pixelated; object-fit: contain; }
.lv-order .by { font-size: 11px; color: #5a4a5e; }
.lv-order.done { background: #c9eda4; }
.lv-order.failed { opacity: .45; text-decoration: line-through; }
.lv-note { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-bottom, env(safe-area-inset-bottom)) + 104px);
  font: 800 13px/1.25 ${UI_FONT}; color: #2b2233; background: #fffbe8; border: 3px solid #2b2233; border-radius: 10px; padding: 6px 10px;
  pointer-events: none; z-index: 5; transition: opacity .3s; max-width: min(320px, 80vw); text-align: center; box-shadow: 0 3px 0 rgba(43,34,51,.6); }
@keyframes lv-breathe { 50% { transform: scale(1.08); } }
@media (prefers-reduced-motion: reduce) { .lv-good.want { animation: none !important; } }

@keyframes lv-up { from { transform: translate(-50%, 30px); opacity: 0; } }
.lv-stars { font-size: 26px; letter-spacing: 3px; text-align: center; color: #feae34; text-shadow: 0 2px 0 #2b2233; }

.lv-home { justify-self: end; pointer-events: auto; cursor: pointer; border: 0; }
.lv-day { position: fixed; left: 50%; top: calc(var(--safe-top, env(safe-area-inset-top)) + 64px); transform: translateX(-50%);
  width: min(330px, 90vw); box-sizing: border-box; z-index: 6; background: #fbf6ea; color: #2b2233; border: 4px solid #2b2233;
  border-radius: 12px; box-shadow: 0 5px 0 rgba(24,20,37,.6); padding: 8px 12px; font: 700 14px/1.35 ${UI_FONT}; text-align: center;
  pointer-events: none; animation: lv-drop .4s cubic-bezier(.3,1.4,.5,1); transition: opacity .5s, transform .5s; }
.lv-day.gone { opacity: 0; transform: translate(-50%, -20px); }
@keyframes lv-drop { from { transform: translate(-50%, -30px); opacity: 0; } }
.lv-day h3 { margin: 0; font: 900 17px/1.2 ${UI_FONT}; }
.lv-day .lv-stars { font-size: 22px; }
.lv-day p { margin: 2px 0 0; }
.lv-seeds { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-bottom, env(safe-area-inset-bottom)) + 10px);
  width: min(380px, 94vw); box-sizing: border-box; z-index: 7; background: #fbf6ea; color: #2b2233; border: 4px solid #2b2233;
  border-radius: 12px; box-shadow: 0 6px 0 rgba(24,20,37,.65); padding: 10px; font: 700 13px/1.2 ${UI_FONT};
  animation: lv-up .28s cubic-bezier(.3,1.4,.5,1); }
.lv-seeds h2 { margin: 0 0 8px; font: 900 17px/1.1 ${UI_FONT}; display: flex; justify-content: space-between; align-items: center; }
.lv-seeds .x { border: 0; background: none; font: 900 22px/1 ${UI_FONT}; color: #2b2233; padding: 0 4px; cursor: pointer; }
.lv-seed-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.lv-seed { display: grid; justify-items: center; gap: 2px; padding: 8px 2px 6px; background: #f1e2c2; border: 3px solid #2b2233;
  border-radius: 10px; cursor: pointer; font: 800 13px/1.15 ${UI_FONT}; color: #2b2233; box-shadow: 0 3px 0 #2b2233; }
.lv-seed:active { transform: translateY(3px); box-shadow: none; }
.lv-seed img { width: 36px; height: 36px; image-rendering: pixelated; }
.lv-seed small { font-weight: 700; color: #6b5a4e; }
.lv-seed b { color: #3e8948; }
`;

let styled = false;
function styles(): void {
  injectStyles();
  if (styled) return;
  styled = true;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
}

export const dowName = (p: Plan): string => t(`lavka.dow.${p.dow}` as TextKey);
export const goodName = (g: Good): string => t(`lavka.good.${g}` as TextKey);
const WHO: Record<Order['id'], string> = { marat: 'portrait_marat', cafe: 'portrait_valya', tourists: 'portrait_sonya', school: 'portrait_inspector', fair: 'portrait_grandma' };

export function orderLine(o: Pick<Order, 'id' | 'good' | 'need' | 'by' | 'bonus'>): string {
  return t(`lavka.order.${o.id}` as TextKey, { need: o.need, good: goodName(o.good), time: clock(o.by), bonus: o.bonus });
}

export interface HudState {
  dow: string;
  coins: number;
  t: number;
  progress: number;
  stock: Record<Good, number>;
  orders: Order[];
}

/** Наверху — монеты, день и часы (ферма под ними главная); внизу, над дорогой, — склад лавки и заказы дня. */
export class LavkaHud {
  private root: HTMLElement;
  private coins: HTMLElement;
  private clock: HTMLElement;
  private bar: HTMLElement;
  private goods = new Map<Good, { box: HTMLElement; n: HTMLElement; last: number }>();
  private orders: HTMLElement;
  private stock: HTMLElement;
  private note: HTMLElement;
  private shownOrders = '';
  private shown = '';
  private lastCoins = -1;
  /** Кнопка справа наверху — обратно в «Магазинчик». */
  onHome?: () => void;

  constructor() {
    styles();
    this.root = el('div', 'lv-hud');
    const row = el('div', 'lv-row');
    this.coins = el('span', 'lv-pill left');
    const mid = el('span', 'mid');
    this.clock = el('span', 'lv-pill');
    const bar = el('span', 'lv-clock-bar');
    this.bar = el('i');
    bar.append(this.bar);
    mid.append(this.clock, bar);
    const home = el('button', 'lv-pill lv-home', '🏪');
    home.title = t('lavka.toStore');
    home.addEventListener('click', () => this.onHome?.());
    row.append(this.coins, mid, home);
    const stock = el('div', 'lv-stock');
    for (const g of GOODS) {
      const box = el('span', 'lv-good');
      const img = el('img');
      img.src = iconUrl(GOOD_ICON[g]);
      img.alt = '';
      const n = el('span', '', '0');
      box.append(img, n);
      stock.append(box);
      this.goods.set(g, { box, n, last: -1 });
    }
    this.root.append(row);
    this.stock = stock;
    this.orders = el('div', 'lv-orders');
    this.note = el('div', 'lv-note');
    this.note.style.opacity = '0';
    document.body.append(this.root, this.stock, this.orders, this.note);
  }

  update(s: HudState): void {
    this.bar.style.width = `${Math.round(Math.min(1, Math.max(0, s.progress)) * 100)}%`;
    const key = `${s.coins}/${s.dow}/${clock(s.t)}`;
    if (key !== this.shown) {
      this.shown = key;
      this.coins.textContent = `💰 ${s.coins}`;
      // деньги пришли — счётчик подпрыгивает
      if (this.lastCoins >= 0 && s.coins > this.lastCoins) {
        this.coins.classList.add('bump');
        setTimeout(() => this.coins.classList.remove('bump'), 140);
      }
      this.lastCoins = s.coins;
      this.clock.textContent = `${s.dow} · ${clock(s.t)}`;
      pixelize(this.coins);
    }
    for (const g of GOODS) {
      const v = this.goods.get(g)!;
      const n = s.stock[g];
      if (n === v.last) continue;
      if (v.last >= 0 && n > v.last) {
        v.box.classList.add('bump');
        setTimeout(() => v.box.classList.remove('bump'), 160);
      }
      v.last = n;
      v.n.textContent = String(n);
      v.box.classList.toggle('empty', n === 0);
    }
    const ok = s.orders.map((o) => `${o.id}${o.have}${o.done}${o.failed}`).join();
    if (ok !== this.shownOrders) {
      this.shownOrders = ok;
      this.orders.replaceChildren(
        ...s.orders.map((o) => {
          const card = el('div', `lv-order${o.done ? ' done' : o.failed ? ' failed' : ''}`);
          const who = el('img', 'who');
          who.src = png(WHO[o.id]);
          who.alt = '';
          const need = el('span', 'need');
          const ico = el('img');
          ico.src = iconUrl(GOOD_ICON[o.good]);
          ico.alt = '';
          need.append(ico, o.done ? '✓' : `${o.have}/${o.need}`);
          card.append(who, need, el('span', 'by', clock(o.by)));
          return card;
        }),
      );
    }
  }

  /** Покупателю не хватило товара — его значок мигает красным. */
  want(g: Good): void {
    const v = this.goods.get(g);
    if (!v) return;
    v.box.classList.remove('want');
    void v.box.offsetWidth;
    v.box.classList.add('want');
  }

  say(text: string, ms = 3500): void {
    this.note.textContent = text;
    pixelize(this.note);
    this.note.style.opacity = '1';
    clearTimeout(Number(this.note.dataset.timer));
    this.note.dataset.timer = String(setTimeout(() => (this.note.style.opacity = '0'), ms));
  }

  destroy(): void {
    this.root.remove();
    this.stock.remove();
    this.orders.remove();
    this.note.remove();
  }
}

/** Конец дня — коротко сверху, без кнопок (дни идут подряд): звёзды, выручка, заказы и совет бабушки. */
export function dayToast(title: string, s: Summary, ms = 5200): void {
  styles();
  const box = el('div', 'lv-day');
  box.append(el('h3', '', title), el('div', 'lv-stars', '★'.repeat(s.stars) + '☆'.repeat(5 - s.stars)));
  box.append(el('p', '', `${t('lavka.sum.coins', { n: s.coins })} · ${t('lavka.sum.orders', { done: s.ordersDone, total: s.ordersTotal })}`));
  box.append(el('p', '', t(`lavka.tip.${s.tip}` as TextKey)));
  pixelize(box);
  document.body.append(box);
  setTimeout(() => box.classList.add('gone'), ms);
  setTimeout(() => box.remove(), ms + 600);
}

/** Что посадить на эту грядку: четыре семени — время роста в часах дня и урожай. Ответ — onPick(семя);
 *  закрыть — крестик. Вернёт функцию «закрыть». */
export function seedPicker(onPick: (seed: Seed) => void, onClose: () => void): () => void {
  styles();
  const box = el('div', 'lv-seeds');
  const head = el('h2', '', t('lavka.seed.title'));
  const x = el('button', 'x', '×');
  head.append(x);
  const row = el('div', 'lv-seed-row');
  const hour = 20; // секунд в часе дня (day.ts: DAY_SECONDS / 12)
  for (const seed of SEEDS) {
    const card = el('button', 'lv-seed');
    const img = el('img');
    img.src = png(`lavka_ico_${seed}`);
    img.alt = '';
    const h = Math.round((SEED[seed].grow / hour) * 2) / 2;
    card.append(img, el('span', '', t(`lavka.seed.${seed}` as TextKey)), el('small', '', `⏱ ${t('lavka.seed.hours', { h: String(h).replace('.', ',') })}`), el('b', '', `×${SEED[seed].yield}`));
    card.addEventListener('click', () => {
      sound.pop(1);
      close();
      onPick(seed);
    });
    row.append(card);
  }
  box.append(head, row);
  pixelize(box);
  document.body.append(box);
  const close = (): void => box.remove();
  x.addEventListener('click', () => {
    close();
    onClose();
  });
  return close;
}
