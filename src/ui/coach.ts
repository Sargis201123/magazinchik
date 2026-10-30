// Бабушкино обучение (game/tutorial.ts) на экране: всё вокруг чуть темнеет, то, что нажать, — в светлом
// окошке с золотой пульсирующей рамкой, над ним прыгает стрелка, рядом — бабушка одной строчкой.
// Слой не ловит касания (кроме «Пропустить обучение»): нажимают прямо сквозь него — в зал или в утро.
// Цель закрыта другим окном (гостинец, глава) или ушла за край — подсветка гаснет и ждёт.

import { t } from '../i18n';
import { CHARACTERS } from '../game/story';
import { liteMode } from '../platform/quality';
import { haptic } from '../platform/telegram';
import { liveFace } from './dialog';
import { button, el, injectStyles, pixelize, UI_FONT } from './dom';

const css = `
/* Над окнами утра и итогов (у них нет z-index), под шторкой дня (50). */
.ui-coach-hole { position: fixed; left: 0; top: 0; z-index: 45; pointer-events: none; border-radius: 12px;
  outline: 3px solid #fee761; outline-offset: 0; }
/* Затемнение — во весь экран, с прямоугольным вырезом под цель (clip-path, правило evenodd). */
.ui-coach-dim { position: fixed; inset: 0; z-index: 45; pointer-events: none; background: rgba(15, 12, 22, .42); }
.ui-coach-hole::after { content: ''; position: absolute; inset: -3px; border-radius: 14px; border: 3px solid #feae34;
  animation: ui-coach-ring 1.1s ease-out infinite; }
@keyframes ui-coach-ring { from { opacity: .9; transform: scale(1); } to { opacity: 0; transform: scale(1.25); } }
.ui-coach-arrow { position: fixed; left: 0; top: 0; z-index: 45; width: 26px; height: 28px; pointer-events: none;
  image-rendering: pixelated; filter: drop-shadow(0 2px 0 rgba(43, 34, 51, .8)); }
.ui-coach-arrow svg { display: block; width: 100%; height: 100%; animation: ui-coach-bob .55s ease-in-out infinite alternate; }
.ui-coach-arrow.up svg { transform: rotate(180deg); animation-name: ui-coach-bob-up; }
@keyframes ui-coach-bob { to { transform: translateY(6px); } }
@keyframes ui-coach-bob-up { from { transform: rotate(180deg); } to { transform: rotate(180deg) translateY(6px); } }
.ui-coach-say { position: fixed; left: 0; top: 0; z-index: 45; display: flex; align-items: center; gap: 8px; box-sizing: border-box;
  width: max-content; max-width: min(300px, calc(100vw - 20px)); padding: 6px 10px 6px 6px; background: #fffbe8; color: #2b2233;
  border: 3px solid #2b2233; border-radius: 10px; box-shadow: 0 3px 0 rgba(43, 34, 51, .85); font: 600 14px/1.3 ${UI_FONT};
  pointer-events: none; animation: ui-coach-in .25s cubic-bezier(.3, 1.45, .5, 1); }
@keyframes ui-coach-in { from { opacity: 0; transform: scale(.6); } }
.ui-coach-face { width: 36px; height: 36px; flex: none; image-rendering: pixelated; border: 2px solid #2b2233; border-radius: 6px; background: #fbf6ea; }
.ui-coach-name { font: 800 10.5px/1.2 ${UI_FONT}; color: #b86f50; text-transform: uppercase; letter-spacing: .5px; }
.ui-coach-text { margin: 1px 0 0; }
/* «Пропустить обучение» — маленькая, всегда в одном месте: слева сверху, под деньгами, складом и полоской цели. */
.ui-coach-skip { position: fixed; z-index: 46; left: 8px; top: calc(var(--safe-top, env(safe-area-inset-top)) + 86px);
  display: flex; gap: 4px; align-items: center; padding: 3px; border-radius: 8px; background: rgba(24, 20, 37, .72); color: #fff;
  font: 700 11px/1.2 ${UI_FONT}; }
.ui-coach-skip .ui-chip { padding: 3px 7px; font-size: 11px; background: transparent; color: #fff; border-color: rgba(255, 255, 255, .55); box-shadow: none; }
.ui-coach-skip .ui-chip:last-child:not(:first-child) { opacity: .8; }
.ui-coach-skip span { padding: 0 4px; }
/* Поверх окна (утро, итоги): у самого верхнего края, над заголовком окна. */
.ui-coach-skip.edge { top: calc(var(--safe-top, env(safe-area-inset-top)) + 1px); left: 50%; transform: translateX(-50%); padding: 1px; white-space: nowrap; }
.ui-coach-skip.edge .ui-chip { padding: 1px 7px; }
/* Лёгкая графика: без пульса и прыжков. */
.ui-coach-hole.ui-coach-calm::after { animation: none; opacity: 0; }
.ui-coach-arrow.ui-coach-calm svg, .ui-coach-say.ui-coach-calm { animation: none; }
@media (prefers-reduced-motion: reduce) { .ui-coach-hole::after, .ui-coach-arrow svg, .ui-coach-say { animation: none; } }
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

/** Пиксельная стрелка вниз: жёлтая, с тёмным контуром (как стрелка в зале). */
const ARROW_SVG =
  '<svg viewBox="0 0 13 14" shape-rendering="crispEdges"><path fill="#2b2233" d="M3 0h7v6h3v2h-1v1h-1v1h-1v1H9v1H8v1H5v-1H4v-1H3v-1H2V9H1V8H0V6h3z"/>' +
  '<path fill="#fee761" d="M4 1h5v6h3v1h-1v1h-1v1H9v1H8v1H5v-1H4v-1H3V9H2V8H1V7h3z"/><path fill="#feae34" d="M7 1h2v6h3v1h-1v1h-1v1H9v1H8v1H7z"/></svg>';

/** Прямоугольник на экране, CSS-пиксели. */
export interface Spot {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CoachStep {
  /** Тот же шаг — облачко не появляется заново, меняется только место. */
  id: string;
  /** Реплика бабушки; пусто — без облачка (бабушка сама говорит в зале). */
  text: string;
  /** Где цель сейчас; null — нет на экране: облачко без стрелки внизу. */
  target: () => Spot | null;
  /**
   * Что должно лежать под серединой цели (холст зала, кнопка утра). Сверху что-то другое — цель закрыта
   * окном: подсветка гаснет и ждёт.
   */
  under?: () => Element | null;
}

/** Отступ светлого окошка от цели. */
const PAD = 6;

export class Coach {
  /** «Пропустить обучение» подтвердили. */
  onSkip: (() => void) | null = null;
  private step: CoachStep | null = null;
  private hole: HTMLElement | null = null;
  private dim: HTMLElement | null = null;
  private arrow: HTMLElement | null = null;
  private say: HTMLElement | null = null;
  private skip: HTMLElement | null = null;
  private raf = 0;
  private placed = '';
  private noteTimer: ReturnType<typeof setTimeout> | null = null;
  private askTimer: ReturnType<typeof setTimeout> | null = null;
  /** Цель видна и подсвечена (для сроков шага). */
  pointing = false;

  /** Показать шаг (или обновить, где его цель). */
  show(step: CoachStep): void {
    styles();
    const same = this.step?.id === step.id;
    this.step = step;
    if (this.noteTimer) clearTimeout(this.noteTimer);
    this.noteTimer = null;
    if (!same || !this.say !== !step.text) this.makeSay(step.text);
    if (!this.raf) this.raf = requestAnimationFrame(this.frame);
  }

  /** Реплика без цели: повисит ms и погаснет (последнее слово бабушки). */
  note(text: string, ms: number): void {
    this.show({ id: `note:${text}`, text, target: () => null });
    this.noteTimer = setTimeout(() => this.hide(), ms);
  }

  /** Убрать подсветку и облачко (кнопка пропуска — отдельно, skipButton). */
  hide(): void {
    this.step = null;
    this.pointing = false;
    this.placed = '';
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.noteTimer) clearTimeout(this.noteTimer);
    this.noteTimer = null;
    this.hole?.remove();
    this.dim?.remove();
    this.arrow?.remove();
    this.say?.remove();
    this.hole = this.dim = this.arrow = this.say = null;
  }

  get active(): boolean {
    return Boolean(this.step);
  }

  /**
   * «Пропустить обучение»: видна, пока обучение идёт. Первое нажатие спрашивает «Точно?».
   * edge — поверх окна: у самого верхнего края, а не под деньгами и днём.
   */
  skipButton(on: boolean, edge = false): void {
    if (!on) {
      this.skip?.remove();
      this.skip = null;
      if (this.askTimer) clearTimeout(this.askTimer);
      return;
    }
    this.skip?.classList.toggle('edge', edge);
    if (this.skip) return;
    styles();
    const box = el('div', `ui-coach-skip${edge ? ' edge' : ''}`);
    const ask = () => {
      haptic.tap();
      box.replaceChildren(
        el('span', '', t('tut.skipAsk')),
        button(t('tut.skipYes'), () => {
          haptic.tap();
          this.skipButton(false);
          this.hide();
          this.onSkip?.();
        }, 'ui-chip'),
        button(t('tut.skipNo'), reset, 'ui-chip'),
      );
      // Передумал и не ответил — через несколько секунд снова просто кнопка.
      if (this.askTimer) clearTimeout(this.askTimer);
      this.askTimer = setTimeout(reset, 5000);
    };
    const reset = () => {
      if (this.askTimer) clearTimeout(this.askTimer);
      box.replaceChildren(button(`⏭ ${t('tut.skip')}`, ask, 'ui-chip'));
      pixelize(box);
    };
    reset();
    document.body.append(box);
    this.skip = box;
  }

  private makeSay(text: string): void {
    this.say?.remove();
    this.say = null;
    this.placed = '';
    if (!text) return;
    const say = el('div', `ui-coach-say${liteMode() ? ' ui-coach-calm' : ''}`);
    const body = el('div');
    const line = el('p', 'ui-coach-text', text);
    body.append(el('div', 'ui-coach-name', t(CHARACTERS.grandma.nameKey)), line);
    say.append(liveFace('assets/portrait_grandma_happy.png', () => false, 'ui-coach-face'), body);
    pixelize(line);
    say.style.visibility = 'hidden';
    document.body.append(say);
    this.say = say;
  }

  private frame = (): void => {
    this.raf = 0;
    const step = this.step;
    if (!step) return;
    // Окно с целью закрыли не кнопкой шага (зашли к другу, перестановка) — подсветка и «Пропустить» уходят.
    const host = step.under?.();
    if (host && !host.isConnected) {
      this.hide();
      this.skipButton(false);
      return;
    }
    this.raf = requestAnimationFrame(this.frame);
    let spot = step.target();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (spot && (spot.y + spot.h < 0 || spot.y > vh || spot.x + spot.w < 0 || spot.x > vw)) spot = null;
    let covered = false;
    if (spot && step.under) {
      const hit = document.elementFromPoint(spot.x + spot.w / 2, spot.y + spot.h / 2);
      const owner = step.under();
      covered = !hit || !owner || !(owner === hit || owner.contains(hit));
    } else if (!spot && step.under) {
      // Цели нет, а поверх того, где она бывает, — другое окно: облачко тоже ждёт.
      const owner = step.under();
      const hit = document.elementFromPoint(vw / 2, vh / 2);
      covered = !owner || !hit || !(owner === hit || owner.contains(hit) || hit.contains(owner));
    }
    this.pointing = Boolean(spot) && !covered;
    // Место не изменилось — ничего не трогаем: большая тень не перерисовывается каждый кадр.
    const key = covered ? 'covered' : spot ? `${Math.round(spot.x)},${Math.round(spot.y)},${Math.round(spot.w)},${Math.round(spot.h)},${vw},${vh}` : `none,${vw},${vh}`;
    if (key === this.placed) return;
    this.placed = key;
    if (covered || !spot) {
      this.hole?.remove();
      this.dim?.remove();
      this.arrow?.remove();
      this.hole = this.dim = this.arrow = null;
    }
    if (covered) {
      if (this.say) this.say.style.visibility = 'hidden';
      return;
    }
    if (!spot) {
      // Цели не видно: бабушка говорит внизу, без стрелки.
      if (this.say) this.placeSay(vw / 2, vh - 110, false);
      return;
    }
    const calm = liteMode();
    if (!this.hole) {
      this.dim = el('div', 'ui-coach-dim');
      this.hole = el('div', `ui-coach-hole${calm ? ' ui-coach-calm' : ''}`);
      document.body.append(this.dim, this.hole);
    }
    if (!this.arrow) {
      this.arrow = el('div', `ui-coach-arrow${calm ? ' ui-coach-calm' : ''}`);
      this.arrow.innerHTML = ARROW_SVG;
      document.body.append(this.arrow);
    }
    const box = { x: spot.x - PAD, y: spot.y - PAD, w: spot.w + PAD * 2, h: spot.h + PAD * 2 };
    Object.assign(this.hole.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px` });
    const [l, tp, r, b] = [box.x, box.y, box.x + box.w, box.y + box.h].map((n) => `${Math.round(n)}px`);
    if (this.dim) this.dim.style.clipPath = `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${l} ${tp}, ${r} ${tp}, ${r} ${b}, ${l} ${b}, ${l} ${tp})`;
    // Цель внизу экрана — стрелка и облачко над ней; вверху — под ней.
    const above = box.y + box.h / 2 > vh * 0.42;
    const cx = Math.min(Math.max(16, box.x + box.w / 2), vw - 16);
    const ay = above ? box.y - 32 : box.y + box.h + 4;
    this.arrow.classList.toggle('up', !above);
    this.arrow.style.transform = `translate(${Math.round(cx - 13)}px, ${Math.round(ay)}px)`;
    if (this.say) this.placeSay(cx, above ? ay - 4 : ay + 32, above);
  };

  /** Облачко над точкой (above) или под ней, целиком на экране. */
  private placeSay(x: number, y: number, above: boolean): void {
    const say = this.say;
    if (!say) return;
    const w = say.offsetWidth;
    const h = say.offsetHeight;
    const left = Math.round(Math.min(Math.max(10, x - w / 2), window.innerWidth - w - 10));
    const top = Math.round(Math.min(Math.max(70, above ? y - h : y), window.innerHeight - h - 10));
    say.style.left = `${left}px`;
    say.style.top = `${top}px`;
    say.style.visibility = '';
  }
}
