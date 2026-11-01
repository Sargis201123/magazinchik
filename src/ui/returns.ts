// Ритуал возвращения (game/returns.ts) в карточке «Почта» (ui/mail.ts): монеты брызгами из сундучка,
// письмо голосом отправителя, лица соседей. Раньше это было отдельное окно по шагам — теперь всё в одной
// карточке утра, а здесь — то, из чего она собирает тёплые мелочи.

import { memberName, t } from '../i18n';
import type { TextKey } from '../i18n/ru';
import { PRODUCTS, STAFF_ROLES } from '../game/economy';
import { REGULARS, type RegularId } from '../game/regulars';
import { letterGroup, letterKey, type LetterGift } from '../game/returns';
import { png } from '../platform/assets';
import { sound } from '../platform/sound';
import { haptic } from '../platform/telegram';
import { dialogBox } from './dialog';
import { el, injectStyles, openModal, staffFace, UI_FONT } from './dom';

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
export function returnStyles(): void {
  injectStyles();
  if (styled) return;
  styled = true;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
}

/** Портреты постоянных покупателей — из тех, кто звонит с заказом на дом (art/delivery.py). */
export const FACES: Record<RegularId, string> = {
  petr: 'portrait_caller5',
  sveta: 'portrait_caller2',
  kostya: 'portrait_caller1',
  akhmed: 'portrait_caller3',
  olga: 'portrait_caller0',
  misha: 'portrait_caller1',
};

export const regularName = (id: RegularId): string => t(REGULARS.find((r) => r.id === id)!.nameKey);

/** Монеты брызгами из сундучка: в лёгкой графике и при «меньше движения» — без них. */
export function burst(host: HTMLElement, calm: boolean): void {
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

/** Кто написал письмо: имя, портрет и голос (бабушка — бабушкин, прощальное — от сотрудника). */
export function letterFrom(gift: LetterGift): { name: string; portrait: string; pitch: number } {
  const { from } = gift.letter;
  const regular = letterGroup(from) === 'regular' ? (from as RegularId) : null;
  // Прощальное письмо сотрудника (career.ts) — от его имени и с его портретом.
  const farewell = gift.letter.farewell;
  const name = regular ? regularName(regular) : farewell ? memberName({ name: farewell.name, friend: farewell.friend ? { name: farewell.friend } : undefined }) : t(`who.${from}` as TextKey);
  const portrait = regular ? FACES[regular] : from === 'grandma' ? 'portrait_grandma_happy' : farewell ? `portrait_${staffFace(farewell.name)}` : `portrait_${from}`;
  return { name, portrait, pitch: from === 'sonya' ? 900 : from === 'grandma' ? 620 : 700 };
}

/** Прочитать письмо: окно с голосом отправителя, вложенное (деньги, доверие) — строкой под ним. */
export function showLetter(gift: LetterGift): void {
  returnStyles();
  const { card, close } = openModal();
  const { from } = gift.letter;
  const regular = letterGroup(from) === 'regular' ? (from as RegularId) : null;
  const farewell = gift.letter.farewell;
  const who = letterFrom(gift);
  haptic.tap();
  sound.pop(0);
  const after: HTMLElement[] = [];
  if (gift.money) after.push(el('div', 'ui-ret-reward', t('ret.letter.money', { n: gift.money })));
  if (gift.loyalty) after.push(el('div', 'ui-ret-reward', t('ret.letter.loyal', { name: who.name })));
  after.push(el('div', 'ui-ret-hint', t('ret.letter.ps')));
  const fav = regular ? REGULARS.find((x) => x.id === regular)!.favorite : null;
  const text = t(letterKey(gift.letter), {
    item: fav ? t(PRODUCTS[fav].nameKey).toLowerCase() : '',
    ...(farewell ? { days: farewell.days, best: farewell.best, role: t(STAFF_ROLES[farewell.role].nameKey).toLowerCase() } : {}),
  });
  card.append(
    el('h2', '', `✉ ${who.name}`),
    dialogBox({ portrait: who.portrait, name: who.name, text: `«${text}»`, pitch: who.pitch, after, nextLabel: t('ret.done'), onNext: close }),
  );
}
