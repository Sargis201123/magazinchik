// Доставка на дом в интерфейсе: карточка звонка внизу экрана (кто звонит, что просит, сколько
// заплатят, кольцо обратного отсчёта и две большие кнопки) и плашка-статус внизу над подсказкой:
// «📦 Собираем 2/5», «🚲 в пути 0:06». Телефон на кассе крошечный — принимать заказ пальцем
// по нему было почти невозможно, поэтому главное действие — здесь, в DOM, а не в мире.

import { t, type TextKey } from '../i18n';
import { PRODUCTS } from '../game/economy';
import { DELIVERY_FEE, TIPS, type HomeOrder } from '../game/delivery';
import { png } from '../platform/assets';
import { sheetPng } from './sheet';
import { liteMode } from '../platform/quality';
import { button, el, injectStyles, pixelize, UI_FONT } from './dom';

/** Окружность кольца обратного отсчёта (r = 17 в SVG 40×40). */
const RING = 2 * Math.PI * 17;

const css = `
.ui-call { position: fixed; left: max(10px, calc((100vw - var(--game-w, min(100vw, 56.25dvh))) / 2 + 10px));
  right: max(64px, calc((100vw - var(--game-w, min(100vw, 56.25dvh))) / 2 + 64px)); bottom: calc(var(--safe-bottom, env(safe-area-inset-bottom)) + 80px);
  max-width: 360px; box-sizing: border-box; padding: 10px 10px 10px; border: 3px solid #2b2233; border-radius: 12px;
  background: #fbf6ea; color: #2b2233; box-shadow: 0 4px 0 #2b2233, 0 0 0 3px rgba(254, 231, 97, .55);
  font: 14px/1.3 ${UI_FONT}; font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased;
  transform: translateY(calc(100% + 140px)); transition: transform .38s cubic-bezier(.3, 1.4, .5, 1); touch-action: manipulation; }
.ui-call.top { bottom: auto; top: calc(var(--safe-top, env(safe-area-inset-top)) + 62px); transform: translateY(calc(-100% - 140px)); }
.ui-call.shown { transform: none; }
.ui-call.gone { transition-duration: .22s; transition-timing-function: ease-in; }
/* Поверх открыто окно — карточка прячется под него и ждёт; закрыли окно — выезжает снова. */
.ui-call.covered { visibility: hidden; transition: none; }
.ui-call-head { display: flex; align-items: center; gap: 9px; }
.ui-call-face { width: 44px; height: 44px; image-rendering: pixelated; border-radius: 8px; border: 2px solid #2b2233; flex: none; }
.ui-call-who { flex: 1; min-width: 0; }
.ui-call-title { font-weight: 800; font-size: 15px; display: flex; align-items: center; gap: 4px; white-space: nowrap; }
.ui-call-title .ui-ico { animation: ui-call-ring .5s ease-in-out infinite; transform-origin: 50% 80%; }
@keyframes ui-call-ring { 0%, 50%, 100% { transform: rotate(0); } 10%, 30% { transform: rotate(-16deg); } 20%, 40% { transform: rotate(16deg); } }
.ui-call-name { font-size: 13px; color: #5a5048; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ui-call-timer { position: relative; width: 40px; height: 40px; flex: none; }
.ui-call-timer svg { width: 40px; height: 40px; transform: rotate(-90deg); }
.ui-call-timer circle { fill: none; stroke-width: 5; }
.ui-call-timer .bg { stroke: #e6dcc4; }
.ui-call-timer .fg { stroke: #63c74d; stroke-linecap: round; stroke-dasharray: ${RING.toFixed(2)}; }
.ui-call-timer.warn .fg { stroke: #feae34; }
.ui-call-timer.late .fg { stroke: #e43b44; }
.ui-call-timer b { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font: 800 14px ${UI_FONT}; }
.ui-call-items { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 4px; }
.ui-call-item { display: flex; align-items: center; gap: 3px; padding: 2px 8px 2px 4px; background: #fff; border: 2px solid #2b2233;
  border-radius: 8px; font-weight: 800; font-size: 15px; }
.ui-call-item img { width: 26px; height: 26px; image-rendering: pixelated; object-fit: contain; }
.ui-call-pay { font-weight: 800; font-size: 15px; }
.ui-call-pay span { font-weight: 600; font-size: 12.5px; color: #3e8948; margin-left: 4px; }
.ui-call-note { font-size: 12px; color: #6a5f58; }
.ui-call-actions { display: grid; grid-template-columns: 1fr 1.6fr; gap: 8px; margin-top: 8px; }
.ui-call-actions .ui-btn { margin: 0; min-height: 48px; padding: 8px 6px; font-size: 16px; }
.ui-call-actions .ui-btn.no { background: #e6dcc4; }
.ui-call-more { margin-left: auto; align-self: center; font-size: 12px; font-weight: 700; color: #6a5f58; white-space: nowrap; }
/* Низкий экран (iPhone SE и т. п.): карточка компактнее, без строки про чаевые. */
@media (max-height: 640px) {
  .ui-call { padding: 7px 8px; }
  .ui-call-face { width: 36px; height: 36px; }
  .ui-call-items { margin: 5px 0 2px; }
  .ui-call-item img { width: 22px; height: 22px; }
  .ui-call-note { display: none; }
  .ui-call-actions { margin-top: 6px; }
  .ui-call-actions .ui-btn { min-height: 44px; }
}
/* Плашка — внизу посередине, над подсказкой: между кнопкой звука слева и ускорением справа. */
.ui-deliv-pill { position: fixed; left: 0; right: 0; margin: 0 auto; width: fit-content; max-width: calc(100vw - 150px);
  bottom: calc(var(--safe-bottom, env(safe-area-inset-bottom)) + 46px); padding: 4px 10px; border-radius: 8px; box-sizing: border-box;
  border: 2px solid rgba(254, 231, 97, .55); background: rgba(24, 20, 37, .78); color: #fff; text-shadow: 0 1px 0 #000;
  font: 800 13px/1.2 ${UI_FONT}; font-variant-numeric: tabular-nums; pointer-events: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ui-deliv-pill .ui-ico { height: 1.2em; }
button.ui-deliv-pill { pointer-events: auto; background: #fee761; color: #2b2233; text-shadow: none; border-color: #2b2233;
  box-shadow: 0 2px 0 #2b2233; padding: 8px 12px; font-size: 14px; animation: ui-pill-call 1s ease-in-out infinite; }
button.ui-deliv-pill:active { transform: translateY(1px); box-shadow: none; }
@keyframes ui-pill-call { 50% { transform: scale(1.06); } }
.ui-calm .ui-call-title .ui-ico, button.ui-deliv-pill.ui-calm { animation: none; }
@media (prefers-reduced-motion: reduce) { .ui-call-title .ui-ico, button.ui-deliv-pill { animation: none; } .ui-call { transition: none; } }
`;

let styled = false;
function injectDeliveryStyles(): void {
  if (styled) return;
  styled = true;
  injectStyles();
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
}

/**
 * Касание карточки или плашки не должно дойти до мира под ней. Phaser слушает касания и мышь на всём
 * окне (input.windowEvents) и всё, что пришло не с холста, проверяет по точке экрана: без этого
 * «Принять» заодно нажимало бы на дорогу, мусор или полку под карточкой. Гасим всплытие до окна;
 * разблокировка звука и щелчки кнопок слушают в фазе захвата — их это не задевает. preventDefault
 * на touchend нельзя: пропал бы сам щелчок по кнопке.
 */
function keepTouches(node: HTMLElement): void {
  for (const type of ['touchstart', 'touchend', 'touchcancel', 'mousedown', 'mouseup']) node.addEventListener(type, (e) => e.stopPropagation());
}

export interface CallView {
  order: HomeOrder;
  /** Сколько принятых заказов уже ждёт (для «ещё ждут: N»). */
  waiting: number;
  /** Касса в нижней части экрана — карточку ставим сверху, чтобы она её не закрывала. */
  top: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

/** Карточка звонка и плашка-статус. Один экземпляр на сцену; всё убирает destroy(). */
export class DeliveryUi {
  private card: HTMLDivElement | null = null;
  private ring: SVGCircleElement | null = null;
  private timer: HTMLDivElement | null = null;
  private seconds: HTMLElement | null = null;
  private pill: HTMLElement | null = null;
  private pillKey = '';

  /** Звонок: карточка выезжает снизу (или сверху, если касса внизу экрана). */
  showCall(view: CallView): void {
    injectDeliveryStyles();
    this.hideCall(true);
    const card = el('div', `ui-call${view.top ? ' top' : ''}${liteMode() ? ' ui-calm' : ''}`);
    card.setAttribute('role', 'alertdialog');
    card.setAttribute('aria-label', t('delivery.title'));
    const caller = view.order.caller ?? 0;
    const face = el('img', 'ui-call-face');
    face.src = png(`portrait_caller${caller}`);
    face.alt = '';
    const who = el('div', 'ui-call-who');
    const title = el('div', 'ui-call-title', t('delivery.title'));
    who.append(title, el('div', 'ui-call-name', t(`delivery.caller${caller}` as TextKey)));
    const timer = el('div', 'ui-call-timer');
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('viewBox', '0 0 40 40');
    for (const cls of ['bg', 'fg']) {
      const c = document.createElementNS(svgNs, 'circle');
      c.setAttribute('cx', '20');
      c.setAttribute('cy', '20');
      c.setAttribute('r', '17');
      c.setAttribute('class', cls);
      svg.append(c);
      if (cls === 'fg') this.ring = c;
    }
    this.seconds = el('b');
    timer.append(svg, this.seconds);
    this.timer = timer;
    const head = el('div', 'ui-call-head');
    head.append(face, who, timer);
    const items = el('div', 'ui-call-items');
    for (const { id, qty } of view.order.items) {
      const chip = el('div', 'ui-call-item');
      const img = el('img');
      img.src = sheetPng(`item_${id}`);
      img.alt = PRODUCTS[id].icon;
      chip.append(img, `×${qty}`);
      chip.title = t(PRODUCTS[id].nameKey);
      items.append(chip);
    }
    // Принятые раньше заказы ещё не уехали — видно, сколько их ждёт курьера.
    if (view.waiting > 0) items.append(el('span', 'ui-call-more', t('delivery.queue', { n: view.waiting })));
    const pay = el('div', 'ui-call-pay', t('delivery.pay', { n: view.order.pay }));
    pay.append(el('span', '', t('delivery.fee', { n: DELIVERY_FEE })));
    const note = el('div', 'ui-call-note', t('delivery.tipNote', { n: TIPS[0][1] }));
    const actions = el('div', 'ui-call-actions');
    actions.append(button(t('delivery.decline'), view.onDecline, 'ui-btn no'), button(`📞 ${t('delivery.accept')}`, view.onAccept, 'ui-btn'));
    card.append(head, items, pay, note, actions);
    keepTouches(card);
    pixelize(card);
    document.body.append(card);
    this.card = card;
    // Выезжает на следующем кадре — иначе переход не сработает.
    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('shown')));
  }

  /** Сколько осталось ответить: доля 1..0 и секунды. */
  setCountdown(left: number, seconds: number): void {
    if (!this.ring || !this.seconds || !this.timer) return;
    this.ring.style.strokeDashoffset = String((RING * (1 - Math.max(0, Math.min(1, left)))).toFixed(2));
    const text = String(Math.max(0, Math.ceil(seconds)));
    if (this.seconds.textContent !== text) this.seconds.textContent = text;
    this.timer.classList.toggle('warn', left <= 0.5 && left > 0.25);
    this.timer.classList.toggle('late', left <= 0.25);
  }

  /** Открыто окно поверх зала (срочный подвоз, особый гость): карточка не закрывает его, а ждёт под ним. */
  coverCall(covered: boolean): void {
    const card = this.card;
    if (!card || card.classList.contains('covered') === covered) return;
    card.classList.toggle('covered', covered);
    card.classList.toggle('shown', !covered);
  }

  /** Карточка уезжает (now — сразу, без анимации: перестройка сцены, конец дня). */
  hideCall(now = false): void {
    const card = this.card;
    this.card = null;
    this.ring = null;
    this.seconds = null;
    this.timer = null;
    if (!card) return;
    if (now || liteMode()) {
      card.remove();
      return;
    }
    card.classList.add('gone');
    card.classList.remove('shown');
    card.querySelectorAll('button').forEach((b) => (b.disabled = true));
    setTimeout(() => card.remove(), 260);
  }

  /** Плашка-статус: текст или null (спрятать); с onTap — это кнопка («📦 Собрать заказ»). */
  setPill(text: string | null, onTap?: () => void): void {
    const key = `${text}|${onTap ? 1 : 0}`;
    if (key === this.pillKey) return;
    this.pillKey = key;
    const wasButton = this.pill instanceof HTMLButtonElement;
    if (text === null) {
      this.pill?.remove();
      this.pill = null;
      return;
    }
    injectDeliveryStyles();
    if (!this.pill || wasButton !== Boolean(onTap)) {
      this.pill?.remove();
      this.pill = onTap ? el('button', 'ui-deliv-pill') : el('div', 'ui-deliv-pill');
      if (onTap) this.pill.addEventListener('click', () => this.onPill());
      keepTouches(this.pill);
      this.pill.classList.toggle('ui-calm', liteMode());
      document.body.append(this.pill);
    }
    this.onPill = onTap ?? (() => {});
    this.pill.textContent = text;
    pixelize(this.pill);
  }

  private onPill: () => void = () => {};

  destroy(): void {
    this.hideCall(true);
    this.setPill(null);
  }
}

/** «0:06» — сколько ещё ехать. */
export const clock = (seconds: number): string => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
