// Окна и панели «Лавки «Своё»» (DOM, как ui/* «Магазинчика»): верхняя панель (монеты, часы, склад лавки по
// товарам), карточки заказов дня, утреннее окно с планом и заказами, подсказка строкой и вечерние итоги.
// Сцена — LavkaScene.ts.

import { t, type TextKey } from '../i18n';
import { png } from '../platform/assets';
import { sound } from '../platform/sound';
import { button, el, injectStyles, openModal, pixelize, UI_FONT } from '../ui/dom';
import { sheetPng } from '../ui/sheet';
import { GOODS, clock, type Good, type Order, type Plan, type Summary } from '../game/lavka/day';

/** Картинка товара: молоко и овощи — из атласа магазина, остальное — свои (art/lavka.py). */
export const GOOD_ICON: Record<Good, string> = { milk: 'item_milk', eggs: 'lavka_egg', veg: 'item_apples', honey: 'lavka_ico_honey', cheese: 'lavka_wheel' };
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
.lv-stock { display: flex; gap: 4px; justify-content: center; }
.lv-good { background: rgba(24, 20, 37, .84); border-radius: 8px; padding: 3px 7px; display: inline-flex; gap: 4px; align-items: center;
  font-size: 13px; transition: transform .15s; }
.lv-good img { width: 14px; height: 14px; image-rendering: pixelated; object-fit: contain; }
.lv-good.bump { transform: scale(1.25); }
.lv-good.empty { color: #f6757a; }
.lv-good.want { background: #a22633; animation: lv-breathe .8s ease-in-out 3; }
.lv-orders { position: fixed; right: calc(10px + max(0px, (100vw - var(--game-w, 100vw)) / 2)); top: calc(var(--safe-top, env(safe-area-inset-top)) + 84px);
  display: grid; gap: 5px; z-index: 5; pointer-events: none; }
.lv-order { background: #fbf6ea; color: #2b2233; border: 3px solid #2b2233; border-radius: 9px; padding: 3px 7px; font: 800 12px/1.2 ${UI_FONT};
  display: grid; grid-template-columns: auto auto; gap: 1px 6px; align-items: center; box-shadow: 0 3px 0 rgba(43,34,51,.6); min-width: 88px; }
.lv-order img.who { width: 24px; height: 24px; grid-row: span 2; image-rendering: pixelated; border-radius: 4px; border: 2px solid #2b2233; }
.lv-order .need { display: inline-flex; gap: 3px; align-items: center; font-size: 13px; }
.lv-order .need img { width: 13px; height: 13px; image-rendering: pixelated; object-fit: contain; }
.lv-order .by { font-size: 11px; color: #5a4a5e; }
.lv-order.done { background: #c9eda4; }
.lv-order.failed { opacity: .45; text-decoration: line-through; }
.lv-note { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-bottom, env(safe-area-inset-bottom)) + 16px);
  font: 800 13px/1.25 ${UI_FONT}; color: #2b2233; background: #fffbe8; border: 3px solid #2b2233; border-radius: 10px; padding: 6px 10px;
  pointer-events: none; z-index: 5; transition: opacity .3s; max-width: min(320px, 80vw); text-align: center; box-shadow: 0 3px 0 rgba(43,34,51,.6); }
@keyframes lv-breathe { 50% { transform: scale(1.08); } }
@media (prefers-reduced-motion: reduce) { .lv-good.want, .lv-open { animation: none !important; } }

.lv-sheet { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-bottom, env(safe-area-inset-bottom)) + 10px);
  width: min(380px, 94vw); box-sizing: border-box; z-index: 6; background: #fbf6ea; color: #2b2233; border: 4px solid #2b2233;
  border-radius: 12px; box-shadow: 0 6px 0 rgba(24,20,37,.65); padding: 12px 12px 10px; font: 600 14px/1.3 ${UI_FONT};
  animation: lv-up .35s cubic-bezier(.3,1.4,.5,1); }
@keyframes lv-up { from { transform: translate(-50%, 30px); opacity: 0; } }
.lv-sheet h2 { margin: 0 0 6px; font: 900 18px/1.1 ${UI_FONT}; }
.lv-say { display: flex; gap: 8px; align-items: center; margin: 0 0 8px; }
.lv-say img { width: 44px; height: 44px; flex: none; image-rendering: pixelated; border: 2px solid #2b2233; border-radius: 6px; background: #f6e7c8; }
.lv-say p { margin: 0; font-weight: 700; }
.lv-plan { list-style: none; margin: 0 0 10px; padding: 8px 10px; background: #f1e2c2; border-radius: 8px; display: grid; gap: 3px; font-size: 13px; }
.lv-plan .ui-ico { width: 14px; height: 14px; vertical-align: -2px; image-rendering: pixelated; }
.lv-plan b { font-weight: 900; }
.lv-open { width: 100%; font-size: 19px !important; font-weight: 900; padding: 12px !important; color: #fff; text-shadow: 0 2px 0 #2b2233;
  background-color: #7fc659 !important; border-width: 4px !important; border-radius: 10px !important; animation: lv-breathe 2.2s ease-in-out infinite; }
.lv-sum { font: 600 15px/1.55 ${UI_FONT}; margin: 6px 0; }
.lv-sum b { font-size: 19px; }
.lv-stars { font-size: 26px; letter-spacing: 3px; text-align: center; color: #feae34; text-shadow: 0 2px 0 #2b2233; }
.lv-title { margin: 0 0 4px; font: 900 20px/1.2 ${UI_FONT}; text-align: center; }
.lv-tip { display: flex; gap: 8px; align-items: center; margin: 8px 0 6px; padding: 6px 10px 6px 6px; background: #fffbe8;
  border: 3px solid #2b2233; border-radius: 10px; font: 700 14px/1.3 ${UI_FONT}; }
.lv-tip img { width: 44px; height: 44px; flex: none; image-rendering: pixelated; border: 2px solid #2b2233; border-radius: 6px; background: #f6e7c8; }
.lv-tip p { margin: 0; }
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

/** Верхняя панель: монеты, день и часы, склад лавки по товарам; справа — заказы дня. */
export class LavkaHud {
  private root: HTMLElement;
  private coins: HTMLElement;
  private clock: HTMLElement;
  private bar: HTMLElement;
  private goods = new Map<Good, { box: HTMLElement; n: HTMLElement; last: number }>();
  private orders: HTMLElement;
  private note: HTMLElement;
  private shownOrders = '';
  private shown = '';

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
    row.append(this.coins, mid, el('span'));
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
    this.root.append(row, stock);
    this.orders = el('div', 'lv-orders');
    this.note = el('div', 'lv-note');
    this.note.style.opacity = '0';
    document.body.append(this.root, this.orders, this.note);
  }

  update(s: HudState): void {
    this.bar.style.width = `${Math.round(Math.min(1, Math.max(0, s.progress)) * 100)}%`;
    const key = `${s.coins}/${s.dow}/${clock(s.t)}`;
    if (key !== this.shown) {
      this.shown = key;
      this.coins.textContent = `💰 ${s.coins}`;
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
    this.orders.remove();
    this.note.remove();
  }
}

/** Утро: план дня и заказы. Возвращает «закрыть». */
export function morningSheet(plan: Plan, onStart: () => void): () => void {
  styles();
  const sheet = el('div', 'lv-sheet');
  sheet.append(el('h2', '', t('lavka.morning.title', { dow: dowName(plan) })));
  const say = el('div', 'lv-say');
  const face = el('img');
  face.src = png('portrait_grandma_happy');
  face.alt = '';
  say.append(face, el('p', '', t('lavka.morning.say')));
  const list = el('ul', 'lv-plan');
  list.append(el('li', '', plan.bus ? t('lavka.plan.bus', { time: clock(plan.bus.at), n: plan.bus.people }) : t('lavka.plan.noBus')));
  for (const tr of plan.trains) list.append(el('li', '', `🚆 ${t('lavka.plan.train', { time: clock(tr.at), n: tr.people })}`));
  const orders = el('ul', 'lv-plan');
  orders.append(el('b', '', t('lavka.morning.orders')));
  for (const o of plan.orders) orders.append(el('li', '', orderLine(o)));
  const open = button(t('lavka.start'), () => {
    sound.coin();
    close();
    onStart();
  }, 'ui-btn lv-open');
  sheet.append(say, list, orders, open);
  pixelize(sheet);
  document.body.append(sheet);
  const close = (): void => sheet.remove();
  return close;
}

/** Вечерние итоги: звёзды, выручка, собрано, заказы, совет бабушки; дальше — следующий день, этот ещё раз или в магазин. */
export function showSummary(o: { title: string; s: Summary; nextDow: string; onNext: () => void; onAgain: () => void; onStore: () => void }): void {
  styles();
  const { card, close } = openModal();
  const s = o.s;
  card.append(el('h2', 'lv-title', o.title));
  card.append(el('div', 'lv-stars', '★'.repeat(s.stars) + '☆'.repeat(5 - s.stars)));
  const rows = el('div', 'lv-sum');
  const line = (text: string) => rows.append(el('div', '', text));
  rows.append(el('b', '', t('lavka.sum.coins', { n: s.coins })));
  line(t('lavka.sum.collected', s.collected));
  line(t('lavka.sum.orders', { done: s.ordersDone, total: s.ordersTotal }));
  line(t('lavka.sum.happy', { n: Math.round(s.happy * 100) }));
  if (s.missedTotal) line(t('lavka.sum.missed', { n: s.missedTotal }));
  card.append(rows);
  const tip = el('div', 'lv-tip');
  const face = el('img');
  face.src = png(s.tip === 'good' ? 'portrait_grandma_happy' : 'portrait_grandma');
  face.alt = '';
  tip.append(face, el('p', '', t(`lavka.tip.${s.tip}` as TextKey)));
  card.append(tip);
  card.append(
    button(t('lavka.next', { dow: o.nextDow }), () => {
      close();
      o.onNext();
    }),
    button(t('lavka.again'), () => {
      close();
      o.onAgain();
    }),
    button(t('lavka.toStore'), () => {
      close();
      o.onStore();
    }),
  );
}
