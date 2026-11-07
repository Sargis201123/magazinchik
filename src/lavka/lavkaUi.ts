// Окна и панели «Лавки «Своё»» (DOM, как ui/* «Магазинчика»): верхняя панель (монеты, часы, молоко и сыр),
// утреннее решение «сколько молока на сыр» с планом дня, подсказка строкой и вечерние итоги. Сцена — LavkaScene.ts.

import { t, type TextKey } from '../i18n';
import { png } from '../platform/assets';
import { sound } from '../platform/sound';
import { button, el, injectStyles, openModal, pixelize, UI_FONT } from '../ui/dom';
import { CANS, CANS_PER_HEAD, BOTTLES_PER_CAN, cheeseReadyAt, clock, type Plan, type Summary } from '../game/lavka/day';

const css = `
/* Панели магазина, пока он спит за лавкой (lavka/enter.ts). */
.ui-on-farm .ui-hud, .ui-on-farm .ui-stock, .ui-on-farm .ui-hint { display: none !important; }
.ui-on-farm .ui-mute { bottom: calc(var(--safe-bottom, env(safe-area-inset-bottom)) + 12px); }
.lv-hud { position: fixed; left: 50%; transform: translateX(-50%); top: calc(var(--safe-top, env(safe-area-inset-top)) + 8px);
  width: min(var(--game-w, 100vw), 100vw); box-sizing: border-box; padding: 0 10px; display: grid; grid-template-columns: 1fr auto 1fr;
  gap: 6px; align-items: start; font: 800 15px/1.15 ${UI_FONT}; color: #fff; pointer-events: none; z-index: 5; }
.lv-pill { background: rgba(24, 20, 37, .84); border-radius: 10px; padding: 5px 10px; white-space: nowrap; display: inline-flex; gap: 6px;
  align-items: center; font-variant-numeric: tabular-nums; }
.lv-pill .ui-ico, .lv-pill img { width: 16px; height: 16px; image-rendering: pixelated; }
.lv-hud .left { justify-self: start; }
.lv-hud .mid { justify-self: center; display: grid; justify-items: center; gap: 4px; }
.lv-hud .right { justify-self: end; display: grid; justify-items: end; gap: 4px; }
.lv-chip { background: rgba(24, 20, 37, .78); border-radius: 8px; padding: 3px 8px; font-size: 12px; white-space: nowrap; display: inline-flex;
  gap: 5px; align-items: center; }
.lv-chip img, .lv-chip .ui-ico { width: 13px; height: 13px; image-rendering: pixelated; }
.lv-chip.call { background: #feae34; color: #2b2233; animation: lv-breathe 1.1s ease-in-out infinite; }
.lv-clock-bar { width: 86px; height: 5px; border-radius: 3px; background: #3a4466; overflow: hidden; }
.lv-clock-bar i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #fee761, #f77622); }
.lv-note { position: fixed; left: 50%; transform: translateX(-50%); top: calc(var(--safe-top, env(safe-area-inset-top)) + 88px);
  font: 800 13px/1.25 ${UI_FONT}; color: #2b2233; background: #fffbe8; border: 3px solid #2b2233; border-radius: 10px; padding: 6px 10px;
  pointer-events: none; z-index: 5; transition: opacity .3s; max-width: min(340px, 90vw); text-align: center; box-shadow: 0 3px 0 rgba(43,34,51,.6); }
@keyframes lv-breathe { 50% { transform: scale(1.06); } }
@media (prefers-reduced-motion: reduce) { .lv-chip.call, .lv-open { animation: none !important; } }

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
.lv-split { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center; margin-bottom: 6px; }
.lv-step { width: 40px; height: 40px; border: 3px solid #2b2233; border-radius: 8px; background: #fff; font: 900 22px/1 ${UI_FONT};
  color: #2b2233; cursor: pointer; padding: 0; }
.lv-step:disabled { opacity: .35; cursor: default; }
.lv-cans { display: flex; gap: 2px; justify-content: center; flex-wrap: wrap; }
.lv-can { width: 15px; height: 24px; border: 2px solid #2b2233; border-radius: 4px 4px 3px 3px; background: #fff; box-sizing: border-box; }
.lv-can.cheese { background: #fee761; }
.lv-result { display: grid; gap: 2px; font-size: 13px; margin: 2px 0 10px; }
.lv-result b { font-weight: 900; }
.lv-result .ui-ico { width: 14px; height: 14px; vertical-align: -2px; }
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

export interface HudState {
  dow: string;
  coins: number;
  t: number;
  progress: number;
  milkShelf: number;
  milkIce: number;
  cheeseMaking: number;
  cheeseReady: number;
  cheeseCase: number;
  readyAt: number;
  open: boolean;
}

/** Верхняя панель: монеты, день и часы, молоко и сыр. */
export class LavkaHud {
  private root: HTMLElement;
  private coins: HTMLElement;
  private clock: HTMLElement;
  private bar: HTMLElement;
  private milk: HTMLElement;
  private cheese: HTMLElement;
  private note: HTMLElement;
  private shown = '';

  constructor() {
    styles();
    this.root = el('div', 'lv-hud');
    this.coins = el('span', 'lv-pill left');
    const mid = el('span', 'mid');
    this.clock = el('span', 'lv-pill');
    const bar = el('span', 'lv-clock-bar');
    this.bar = el('i');
    bar.append(this.bar);
    mid.append(this.clock, bar);
    const right = el('span', 'right');
    this.milk = el('span', 'lv-chip');
    this.cheese = el('span', 'lv-chip');
    right.append(this.milk, this.cheese);
    this.root.append(this.coins, mid, right);
    this.note = el('div', 'lv-note');
    this.note.style.opacity = '0';
    document.body.append(this.root, this.note);
  }

  update(s: HudState): void {
    this.bar.style.width = `${Math.round(Math.min(1, Math.max(0, s.progress)) * 100)}%`;
    const cheese = s.cheeseReady
      ? t('lavka.hud.cheeseReady', { n: s.cheeseReady })
      : s.cheeseMaking
        ? t('lavka.hud.cheeseMaking', { time: clock(s.readyAt) })
        : s.cheeseCase
          ? t('lavka.hud.cheeseCase', { n: s.cheeseCase })
          : t('lavka.hud.noCheese');
    const key = `${s.coins}/${s.dow}/${clock(s.t)}/${s.milkShelf}/${s.milkIce}/${cheese}`;
    if (key === this.shown) return;
    this.shown = key;
    this.coins.textContent = `💰 ${s.coins}`;
    this.clock.textContent = `${s.dow} · ${clock(s.t)}`;
    this.milk.textContent = t('lavka.hud.milk', { shelf: s.milkShelf, ice: s.milkIce });
    this.milk.classList.toggle('call', s.open && s.milkShelf <= 1 && s.milkIce > 0);
    this.cheese.replaceChildren();
    const wheel = el('img');
    wheel.src = png('lavka_wheel');
    wheel.alt = '';
    this.cheese.append(wheel, cheese);
    this.cheese.classList.toggle('call', s.cheeseReady > 0);
    pixelize(this.root);
  }

  /** Строка-подсказка под панелью: ms — сколько висеть. */
  say(text: string, ms = 3500): void {
    this.note.textContent = text;
    pixelize(this.note);
    this.note.style.opacity = '1';
    clearTimeout(Number(this.note.dataset.timer));
    this.note.dataset.timer = String(setTimeout(() => (this.note.style.opacity = '0'), ms));
  }

  destroy(): void {
    this.root.remove();
    this.note.remove();
  }
}

/** Утро: план дня и сколько бидонов на сыр. Решение — onOpen(бидонов на сыр). Возвращает «закрыть». */
export function morningSheet(plan: Plan, initial: number, onOpen: (cheeseCans: number) => void): () => void {
  styles();
  const sheet = el('div', 'lv-sheet');
  sheet.append(el('h2', '', t('lavka.morning.title', { dow: dowName(plan) })));
  const say = el('div', 'lv-say');
  const face = el('img');
  face.src = png('portrait_grandma');
  face.alt = '';
  say.append(face, el('p', '', t('lavka.morning.say', { n: CANS })));
  const list = el('ul', 'lv-plan');
  list.append(el('li', '', plan.bus ? t('lavka.plan.bus', { time: clock(plan.bus.at), n: plan.bus.people }) : t('lavka.plan.noBus')));
  for (const tr of plan.trains) list.append(el('li', '', `🚆 ${t('lavka.plan.train', { time: clock(tr.at), n: tr.people })}`));
  list.append(el('li', '', `🚗 ${t('lavka.plan.road')}`));

  let cheese = initial;
  const minus = el('button', 'lv-step', '−') as HTMLButtonElement;
  const plus = el('button', 'lv-step', '+') as HTMLButtonElement;
  const cans = el('div', 'lv-cans');
  const result = el('div', 'lv-result');
  const render = (): void => {
    minus.disabled = cheese <= 0;
    plus.disabled = cheese >= CANS;
    cans.replaceChildren();
    for (let i = 0; i < CANS; i++) cans.append(el('span', `lv-can${i < cheese ? ' cheese' : ''}`));
    const heads = cheese / CANS_PER_HEAD;
    const bottles = (CANS - cheese) * BOTTLES_PER_CAN;
    result.replaceChildren();
    const row = (label: string, text: string): void => {
      const line = el('div');
      line.append(el('b', '', `${label}: `), text);
      result.append(line);
    };
    row(t('lavka.split.cheese'), heads ? t('lavka.heads', { n: heads, time: clock(cheeseReadyAt(heads)) }) : t('lavka.noCheese'));
    row(t('lavka.split.milk'), bottles ? t('lavka.bottles', { n: bottles }) : t('lavka.noMilk'));
    pixelize(result);
  };
  const step = (d: number) => () => {
    cheese = Math.max(0, Math.min(CANS, cheese + d));
    sound.click('tab');
    render();
  };
  minus.addEventListener('click', step(-CANS_PER_HEAD));
  plus.addEventListener('click', step(CANS_PER_HEAD));
  const split = el('div', 'lv-split');
  split.append(minus, cans, plus);
  const open = button(t('lavka.open'), () => {
    sound.coin();
    close();
    onOpen(cheese);
  }, 'ui-btn lv-open');
  sheet.append(say, list, split, result, open);
  render();
  pixelize(sheet);
  document.body.append(sheet);
  const close = (): void => sheet.remove();
  return close;
}

/** Вечерние итоги: звёзды, выручка, что продали и что пропало, совет бабушки; дальше — следующий день, этот ещё раз или в магазин. */
export function showSummary(o: { title: string; s: Summary; nextDow: string; onNext: () => void; onAgain: () => void; onStore: () => void }): void {
  styles();
  const { card, close } = openModal();
  const s = o.s;
  card.append(el('h2', 'lv-title', o.title));
  card.append(el('div', 'lv-stars', '★'.repeat(s.stars) + '☆'.repeat(5 - s.stars)));
  const rows = el('div', 'lv-sum');
  const line = (text: string) => rows.append(el('div', '', text));
  rows.append(el('b', '', t('lavka.sum.coins', { n: s.coins })));
  line(t('lavka.sum.sold', s.sold));
  line(t('lavka.sum.happy', { n: Math.round(s.happy * 100) }));
  if (s.sour) line(t('lavka.sum.sour', { n: s.sour }));
  if (s.cheeseLeft) line(t('lavka.sum.cheeseLeft', { n: s.cheeseLeft }));
  if (s.missedTotal) line(t('lavka.sum.missed', { n: s.missedTotal }));
  if (s.tired) line(t('lavka.sum.tired', { n: s.tired }));
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
