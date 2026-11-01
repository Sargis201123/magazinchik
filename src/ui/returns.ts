// Окно «Пока тебя не было» (game/returns.ts): маленький ритуал возвращения по шагам — сундучок
// выручки (касание — крышка откидывается, монеты сыплются, сумма докручивается), конверт с письмом
// (касание — письмо читается голосом отправителя) и сосед, пришедший за отложенным заказом.

import { memberName, t } from '../i18n';
import type { TextKey } from '../i18n/ru';
import { PRODUCTS, STAFF_ROLES } from '../game/economy';
import { REGULARS, type RegularId } from '../game/regulars';
import { letterGroup, letterKey, type Chest, type LetterGift, type OrderResult } from '../game/returns';
import { png } from '../platform/assets';
import { liteMode } from '../platform/quality';
import { sound } from '../platform/sound';
import { music } from '../platform/music';
import { haptic } from '../platform/telegram';
import { dialogBox } from './dialog';
import type { StoreState } from '../game/economy';
import { notebookPage, openNotebook } from './notebook';
import { button, el, injectStyles, openModal, rollNumber, staffFace, UI_FONT } from './dom';

const css = `
.ui-ret-stage { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; }
.ui-ret-name { font: 800 12px/1.2 ${UI_FONT}; color: #b86f50; text-transform: uppercase; letter-spacing: .5px; }
.ui-ret-pic { position: relative; display: grid; place-items: center; width: 168px; height: 150px; border: 0; padding: 0;
  background: none; cursor: pointer; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
.ui-ret-pic img { image-rendering: pixelated; filter: drop-shadow(0 4px 0 rgba(43, 34, 51, .35)); }
.ui-ret-chest { width: 144px; }
.ui-ret-env { width: 132px; }
.ui-ret-pic.wait img { animation: ui-ret-hop 1.1s ease-in-out infinite; }
@keyframes ui-ret-hop { 0%, 60%, 100% { transform: translateY(0) rotate(0); } 70% { transform: translateY(-8px) rotate(-3deg); } 80% { transform: translateY(0) rotate(3deg); } 90% { transform: translateY(-3px) rotate(0); } }
.ui-ret-coin { position: absolute; left: 50%; top: 45%; width: 20px; height: 20px; margin: -10px 0 0 -10px; image-rendering: pixelated;
  pointer-events: none; animation: ui-ret-burst .9s cubic-bezier(.2, .7, .4, 1) forwards; }
@keyframes ui-ret-burst { 0% { transform: translate(0, 0) scale(.6); opacity: 1; }
  60% { transform: translate(var(--dx), var(--dy)) scale(1.1); opacity: 1; }
  100% { transform: translate(var(--dx), calc(var(--dy) + 40px)) scale(1); opacity: 0; } }
.ui-ret-sum { font: 800 24px/1.2 ${UI_FONT}; color: #2b2233; min-height: 30px; }
.ui-ret-sum.got { color: #3e8948; animation: ui-ret-pop .35s cubic-bezier(.3, 1.6, .5, 1); }
@keyframes ui-ret-pop { from { transform: scale(.6); } }
.ui-ret-line { font: 600 13px/1.35 ${UI_FONT}; color: #5a4a5e; }
.ui-ret-hint { font: 600 12px/1.3 ${UI_FONT}; color: #8b7a8e; }
.ui-ret-reward { margin: 6px 0 2px; padding: 6px 8px; text-align: center; font: 800 15px ${UI_FONT}; background: #fee761;
  border: 2px solid #2b2233; border-radius: 8px; }
.ui-ret-dots { display: flex; gap: 6px; justify-content: center; margin-top: 2px; }
.ui-ret-dots i { width: 7px; height: 7px; border-radius: 50%; background: #c0cbdc; }
.ui-ret-dots i.on { background: #b86f50; }
.ui-ret-calm .ui-ret-pic.wait img, .ui-ret-calm .ui-ret-sum.got { animation: none; }
@media (prefers-reduced-motion: reduce) { .ui-ret-pic.wait img, .ui-ret-sum.got { animation: none; } }
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

/** Портреты постоянных покупателей — из тех, кто звонит с заказом на дом (art/delivery.py). */
const FACES: Record<RegularId, string> = {
  petr: 'portrait_caller5',
  sveta: 'portrait_caller2',
  kostya: 'portrait_caller1',
  akhmed: 'portrait_caller3',
  olga: 'portrait_caller0',
  misha: 'portrait_caller1',
};

const regularName = (id: RegularId): string => t(REGULARS.find((r) => r.id === id)!.nameKey);

export interface ReturnRitual {
  chest?: Chest;
  letter?: LetterGift;
  order?: OrderResult;
  /** Состояние после письма: сюжетное письмо с тетрадью показывает её страницу (ui/notebook.ts). */
  state?: StoreState;
  /** Сундучок открыт — деньги в кассу (сцена сохраняет). */
  onChest: () => void;
  /** Ритуал закончен — дальше утро (гостинец и прочее). */
  onDone: () => void;
}

/** Монеты брызгами из сундучка: в лёгкой графике и при «меньше движения» — без них. */
function burst(host: HTMLElement, calm: boolean): void {
  if (calm) return;
  const n = 14;
  for (let i = 0; i < n; i++) {
    const coin = el('img', 'ui-ret-coin');
    coin.src = png('coin');
    coin.alt = '';
    const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * Math.PI * 1.1;
    const r = 55 + Math.random() * 30;
    coin.style.setProperty('--dx', `${Math.round(Math.cos(a) * r)}px`);
    coin.style.setProperty('--dy', `${Math.round(Math.sin(a) * r)}px`);
    coin.style.animationDelay = `${i * 25}ms`;
    host.append(coin);
    setTimeout(() => coin.remove(), 1300);
  }
}

export function showReturn(r: ReturnRitual): void {
  styles();
  const { card, close } = openModal();
  const calm = liteMode() || matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (calm) card.classList.add('ui-ret-calm');
  const steps: ((last: boolean, next: () => void) => HTMLElement)[] = [];
  if (r.chest) steps.push((last, next) => chestStep(r.chest!, calm, r.onChest, last, next));
  if (r.letter) steps.push((last, next) => letterStep(r.letter!, last, next, r.state));
  if (r.order) steps.push((last, next) => orderStep(r.order!, last, next));
  const title = el('h2', '', `✉ ${t('ret.title')}`);
  const stage = el('div');
  const dots = el('div', 'ui-ret-dots');
  card.append(title, stage, dots);
  let at = 0;
  const show = () => {
    if (at >= steps.length) {
      close();
      r.onDone();
      return;
    }
    stage.replaceChildren(steps[at](at === steps.length - 1, () => {
      at++;
      show();
    }));
    dots.replaceChildren(...(steps.length > 1 ? steps.map((_, i) => el('i', i === at ? 'on' : '')) : []));
  };
  show();
}

function chestStep(chest: Chest, calm: boolean, onOpen: () => void, last: boolean, next: () => void): HTMLElement {
  const box = el('div', 'ui-ret-stage');
  const pic = el('button', 'ui-ret-pic wait');
  pic.type = 'button';
  const img = el('img', 'ui-ret-chest');
  img.src = png('chest_closed');
  img.alt = t('ret.chest.title');
  pic.append(img);
  const sum = el('div', 'ui-ret-sum', '?');
  const lines = el('div');
  if (chest.cashier) lines.append(el('div', 'ui-ret-line', t('ret.chest.cashier', { n: chest.units, sum: chest.cashier })));
  if (chest.branch) lines.append(el('div', 'ui-ret-line', t('ret.chest.branch', { sum: chest.branch })));
  lines.append(el('div', 'ui-ret-hint', t('ret.chest.hours', { h: Math.max(1, Math.floor(chest.hours)) })));
  const hint = el('div', 'ui-ret-hint', t('ret.chest.tap'));
  let opened = false;
  const go: HTMLButtonElement = button(t('ret.chest.open'), () => (opened ? next() : open()));
  const open = () => {
    if (opened) return;
    opened = true;
    pic.classList.remove('wait');
    img.src = png('chest_open');
    burst(pic, calm);
    if (!music.sting('coin')) sound.coin();
    haptic.success();
    onOpen();
    rollNumber(sum, 0, chest.sum, calm ? 0 : 700, (n) => t('ret.chest.got', { sum: n }), () => sum.classList.add('got'));
    hint.textContent = '';
    go.textContent = t(last ? 'ret.done' : 'ret.next');
  };
  pic.addEventListener('click', open);
  box.append(el('div', 'ui-ret-name', t('ret.chest.title')), pic, sum, lines, hint, go);
  return box;
}

function letterStep(gift: LetterGift, last: boolean, next: () => void, state?: StoreState): HTMLElement {
  const box = el('div', 'ui-ret-stage');
  const pic = el('button', 'ui-ret-pic wait');
  pic.type = 'button';
  const img = el('img', 'ui-ret-env');
  img.src = png('envelope');
  img.alt = '';
  pic.append(img);
  const { from } = gift.letter;
  const group = letterGroup(from);
  const regular = group === 'regular' ? (from as RegularId) : null;
  // Прощальное письмо сотрудника (career.ts) — от его имени и с его портретом.
  const farewell = gift.letter.farewell;
  const name = regular ? regularName(regular) : farewell ? memberName({ name: farewell.name, friend: farewell.friend ? { name: farewell.friend } : undefined }) : t(`who.${from}` as TextKey);
  const read = () => {
    haptic.tap();
    sound.pop(0);
    const after: HTMLElement[] = [];
    if (gift.money) after.push(el('div', 'ui-ret-reward', t('ret.letter.money', { n: gift.money })));
    if (gift.loyalty) after.push(el('div', 'ui-ret-reward', t('ret.letter.loyal', { name })));
    // «Бабушкина тетрадь»: в конверте — сама тетрадь, последняя страница вырвана.
    const notebook = gift.letter.story === 'notebook' && state ? state : null;
    if (notebook) after.push(button(`📓 ${t('nb.open')}`, () => openNotebook(notebook), 'ui-btn secondary'));
    else after.push(el('div', 'ui-ret-hint', t('ret.letter.ps')));
    const fav = regular ? REGULARS.find((x) => x.id === regular)!.favorite : null;
    const text = t(letterKey(gift.letter), {
      item: fav ? t(PRODUCTS[fav].nameKey).toLowerCase() : '',
      ...(farewell ? { days: farewell.days, best: farewell.best, role: t(STAFF_ROLES[farewell.role].nameKey).toLowerCase() } : {}),
    });
    box.replaceChildren(
      dialogBox({
        figure: notebook ? notebookPage(notebook, 'torn') : null,
        portrait: regular ? FACES[regular] : from === 'grandma' ? 'portrait_grandma_happy' : farewell ? `portrait_${staffFace(farewell.name)}` : `portrait_${from}`,
        name,
        text: `«${text}»`,
        pitch: from === 'sonya' ? 900 : from === 'grandma' ? 620 : 700,
        after,
        nextLabel: t(last ? 'ret.done' : 'ret.next'),
        onNext: next,
      }),
    );
  };
  pic.addEventListener('click', read);
  box.append(el('div', 'ui-ret-name', name), pic, el('div', 'ui-ret-hint', t('ret.letter.tap')), button(t('ret.letter.open'), read));
  return box;
}

function orderStep(res: OrderResult, last: boolean, next: () => void): HTMLElement {
  const { order } = res;
  const icon = PRODUCTS[order.pid].icon;
  const after = res.paid ? [el('div', 'ui-ret-reward', `+${res.paid} 💰`)] : [];
  if (res.paid) haptic.success();
  const box = el('div', 'ui-ret-stage');
  box.append(
    el('div', 'ui-ret-name', t('ret.order.title')),
    dialogBox({
      portrait: FACES[order.who],
      name: regularName(order.who),
      text: `«${t(res.paid ? 'ret.order.done' : 'ret.order.wait', { qty: order.qty, icon, pay: res.paid })}»`,
      pitch: 700,
      after,
      nextLabel: t(last ? 'ret.done' : 'ret.next'),
      onNext: () => {
        if (res.paid && !music.sting('coin')) sound.coin();
        next();
      },
    }),
  );
  return box;
}
