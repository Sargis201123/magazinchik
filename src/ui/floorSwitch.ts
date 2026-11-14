// Переключатель этажей слева (14.11, автор: «в левой части экрана должно появиться переключение между этажами —
// подвал, второй и третий этаж. Нажимать в углу магазина на подвал не очень удобно»). Столбик кнопок, как в лифте:
// сверху вниз — третий (фудкорт), второй (одежда), зал, подвал. Открытые этажи и зал — кнопки; следующий этаж, до
// которого можно дорасти, — серый с замком: касание — короткая подсказка рядом (с какого помещения, почём, где
// открыть). Где игрок сейчас — кнопка жёлтая. Пока игрок на этаже, а в зале что-то зовёт (вор, «момент», печь),
// кнопка «Зал» светится и рядом строка.
//
// Что показывать — решают game/floors.floorStops и scenes/floors/nav.syncSwitch; здесь — только кнопки. Стоит слева
// над кнопками двора, вида и звука, оформлен как они (тёмная плашка с золотой рамкой); перерисовывается, только когда
// что-то поменялось. Касание не проходит в игру под ним (там хозяин пробивает покупки).

import type { FloorStop } from '../game/floors';
import { t } from '../i18n';
import { sound } from '../platform/sound';
import { haptic } from '../platform/telegram';
import { el, pixelize, UI_FONT } from './dom';
import { sheetPng } from './sheet';

/** Кнопка: куда, открыта ли, картинка (кадр атласа или assets/), подпись и подсказка у серой. */
export interface SwitchStop {
  id: FloorStop;
  open: boolean;
  icon: string;
  label: string;
  hint: string;
}

/** Сколько держится подсказка у серой кнопки (мс). */
const TIP_MS = 3200;

const css = `
/* Слева, над кнопками двора, вида и звука (bottom 128 + её высота): не закрывает кассы — они у правой стены зала. */
.ui-floors { position: fixed; left: max(6px, calc((100vw - var(--game-w, min(100vw, 56.25dvh))) / 2 + 6px));
  bottom: calc(var(--safe-bottom, env(safe-area-inset-bottom)) + 176px); width: 56px; box-sizing: border-box;
  display: flex; flex-direction: column; gap: 2px; padding: 4px 3px;
  background: rgba(24, 20, 37, .72); border: 2px solid rgba(254, 231, 97, .55); border-radius: 10px; box-shadow: 0 2px 0 rgba(0, 0, 0, .45);
  font: 800 10px/1.1 ${UI_FONT}; color: #fff; text-shadow: 0 1px 0 #000; user-select: none; -webkit-user-select: none;
  touch-action: manipulation; animation: ui-floors-in .22s ease-out; }
.ui-floors[hidden] { display: none; }
@keyframes ui-floors-in { from { opacity: 0; transform: translateX(-10px); } }
.ui-floor-btn { all: unset; position: relative; box-sizing: border-box; display: flex; flex-direction: column; align-items: center;
  gap: 1px; padding: 3px 1px 3px; border-radius: 7px; cursor: pointer; text-align: center; -webkit-tap-highlight-color: transparent; }
.ui-floor-btn + .ui-floor-btn::before { content: ''; position: absolute; left: 6px; right: 6px; top: -2px; height: 1px; background: rgba(255, 255, 255, .14); }
.ui-floor-btn.cur::before, .ui-floor-btn.cur + .ui-floor-btn::before { display: none; }
.ui-floor-btn .ui-floor-ico { width: 28px; height: 28px; image-rendering: pixelated; }
.ui-floor-btn span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ui-floor-btn.cur { background: rgba(254, 231, 97, .92); color: #2b2233; text-shadow: none; box-shadow: inset 0 -2px 0 rgba(0, 0, 0, .22); }
.ui-floor-btn:active { transform: translateY(1px); }
.ui-floor-btn.locked .ui-floor-ico { filter: grayscale(1) brightness(.8); opacity: .55; }
.ui-floor-btn.locked span { opacity: .6; }
.ui-floor-lock { position: absolute; top: 1px; right: 4px; width: 14px; height: 14px; image-rendering: pixelated; }
.ui-floor-btn.ui-nudge { border-radius: 7px; }
/* Подсказка у кнопки: жёлтая плашка, как строка «что делать» у цели, хвостиком к кнопке. */
.ui-floor-tip { position: fixed; z-index: 30; max-width: min(240px, calc(100vw - 90px)); box-sizing: border-box; transform: translateY(-50%);
  font: 700 12.5px/1.3 ${UI_FONT}; color: #2b2233; background: #fee761; border: 2px solid #2b2233; border-radius: 8px; padding: 5px 8px;
  box-shadow: 0 2px 0 rgba(0, 0, 0, .35); pointer-events: none; animation: ui-floors-in .15s ease-out; }
.ui-floor-tip::before { content: ''; position: absolute; left: -7px; top: 50%; margin-top: -6px; border: 6px solid transparent;
  border-left: 0; border-right-color: #2b2233; }
.ui-floor-tip .ui-ico { height: 14px; vertical-align: -2px; }
@media (prefers-reduced-motion: reduce) { .ui-floors, .ui-floor-tip { animation: none; } }
`;

let styled = false;
function injectFloorStyles(): void {
  if (styled) return;
  styled = true;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
}

export class FloorSwitch {
  readonly root = el('div', 'ui-floors');
  /** Касание открытой кнопки (зал или этаж): куда ехать. */
  onPick: (id: FloorStop) => void = () => {};
  private key = '';
  private stops: SwitchStop[] = [];
  private tip?: HTMLElement;
  private tipFor: FloorStop | null = null;
  private tipTimer = 0;

  constructor() {
    injectFloorStyles();
    this.root.hidden = true;
    this.root.setAttribute('role', 'group');
    // Касание кнопок — не касание улицы и зала под ними.
    for (const type of ['pointerdown', 'touchstart', 'mousedown'] as const) this.root.addEventListener(type, (e) => e.stopPropagation(), { passive: true });
  }

  /** Кнопки сверху вниз; пусто — спрятать. at — где игрок; call — зал зовёт (кнопка «Зал» светится, рядом строка). */
  show(stops: SwitchStop[], at: FloorStop, call: boolean): void {
    const key = `${stops.map((s) => `${s.id}${s.open ? '+' : '-'}${s.label}|${s.hint}`).join(';')}@${at}${call ? '!' : ''}`;
    if (key === this.key) return;
    this.key = key;
    this.stops = stops;
    if (!stops.length) {
      this.root.hidden = true;
      this.hideTip();
      return;
    }
    this.root.setAttribute('aria-label', t('floor.sw.title'));
    this.root.replaceChildren(...stops.map((s) => this.button(s, s.id === at, call && s.id === 'hall')));
    const shown = this.root.hidden;
    this.root.hidden = false;
    // Только что появился — анимация въезда (CSS); подсказку пересчитать к новым кнопкам.
    if (shown) this.hideTip();
    if (call) this.showTip('hall', `👀 ${t('floor.sw.call')}`, 0);
    else if (this.tipFor === 'hall') this.hideTip();
    else if (this.tipFor) {
      const s = stops.find((x) => x.id === this.tipFor);
      if (!s || s.open) this.hideTip();
    }
  }

  private button(s: SwitchStop, cur: boolean, call: boolean): HTMLButtonElement {
    const b = el('button', `ui-floor-btn${cur ? ' cur' : ''}${s.open ? '' : ' locked'}${call ? ' ui-nudge' : ''}`);
    b.type = 'button';
    b.dataset.floor = s.id;
    b.setAttribute('aria-label', s.open ? s.label : `${s.label} — ${s.hint}`);
    if (cur) b.setAttribute('aria-current', 'true');
    const img = el('img', 'ui-floor-ico');
    img.src = sheetPng(s.icon);
    img.alt = '';
    b.append(img, el('span', '', s.label));
    if (!s.open) {
      const lock = el('img', 'ui-floor-lock');
      lock.src = sheetPng('ico_lock');
      lock.alt = '';
      b.append(lock);
    }
    b.addEventListener('click', () => {
      const stop = this.stops.find((x) => x.id === s.id);
      if (!stop) return;
      if (!stop.open) {
        haptic.tap();
        sound.tap();
        if (this.tipFor === stop.id) this.hideTip();
        else this.showTip(stop.id, stop.hint, TIP_MS);
        return;
      }
      if (this.tipFor && this.tipFor !== 'hall') this.hideTip();
      this.onPick(stop.id);
    });
    return b;
  }

  /** Подсказка справа от кнопки; ms — через сколько спрятать (0 — пока не спрячут). */
  private showTip(id: FloorStop, text: string, ms: number): void {
    const b = this.root.querySelector<HTMLElement>(`[data-floor="${id}"]`);
    if (!b) return;
    clearTimeout(this.tipTimer);
    this.tip?.remove();
    const tip = el('div', 'ui-floor-tip', text);
    pixelize(tip);
    const box = this.root.getBoundingClientRect();
    const r = b.getBoundingClientRect();
    tip.style.left = `${Math.round(box.right + 8)}px`;
    tip.style.top = `${Math.round(r.top + r.height / 2)}px`;
    document.body.append(tip);
    this.tip = tip;
    this.tipFor = id;
    if (ms) this.tipTimer = window.setTimeout(() => this.hideTip(), ms);
  }

  private hideTip(): void {
    clearTimeout(this.tipTimer);
    this.tip?.remove();
    this.tip = undefined;
    this.tipFor = null;
  }
}
