// Новое начало (game/onboarding.ts): бабушка говорит облачком прямо в зале, рядом с собой, а не
// большим окном; первая продажа — маленький праздник с печатью; во вкладках утра — короткая
// подсказка к той, что только что открылась.

import { t } from '../i18n';
import { CHARACTERS } from '../game/story';
import { liteMode } from '../platform/quality';
import { Babbler, voiceOf } from '../platform/babble';
import { sound } from '../platform/sound';
import { liveFace } from './dialog';
import { png } from '../platform/assets';
import { haptic } from '../platform/telegram';
import { button, el, injectStyles, openModal, pixelize, UI_FONT } from './dom';
import { stamp } from './hud';

const css = `
/* Облачко бабушки в зале: портрет, имя и реплика; хвостик показывает на неё саму. Бабушка стоит
   у входа, внизу зала, — облачко под ней, над улицей: не закрывает ни кассу, ни покупателей. */
/* Без z-index: окно, открытое позже (выбор гостя, итоги), ложится поверх облачка, а не под него. */
.ui-say { position: fixed; left: 0; top: 0; display: flex; align-items: center; gap: 8px; box-sizing: border-box;
  max-width: min(290px, calc(100vw - 20px)); padding: 6px 10px 6px 6px; background: #fff; color: #2b2233;
  border: 3px solid #2b2233; border-radius: 10px; box-shadow: 0 3px 0 rgba(43, 34, 51, .85); font: 600 15px/1.3 ${UI_FONT};
  cursor: pointer; -webkit-tap-highlight-color: transparent; transform-origin: var(--tail, 50%) calc(100% + 10px);
  animation: ui-say-in .28s cubic-bezier(.3, 1.45, .5, 1); }
.ui-say.below { transform-origin: var(--tail, 50%) -10px; }
.ui-say.out { opacity: 0; transform: scale(.85); transition: opacity .18s, transform .18s; pointer-events: none; }
@keyframes ui-say-in { from { opacity: 0; transform: scale(.4); } }
.ui-say::before, .ui-say::after { content: ''; position: absolute; border-style: solid; border-color: transparent; }
.ui-say::before { left: calc(var(--tail, 50%) - 9px); bottom: -12px; border-width: 10px 9px 0; border-top-color: #2b2233; }
.ui-say::after { left: calc(var(--tail, 50%) - 6px); bottom: -6px; border-width: 7px 6px 0; border-top-color: #fff; }
.ui-say.below::before { bottom: auto; top: -12px; border-width: 0 9px 10px; border-color: transparent transparent #2b2233; }
.ui-say.below::after { bottom: auto; top: -6px; border-width: 0 6px 7px; border-color: transparent transparent #fff; }
.ui-say-face { width: 40px; height: 40px; flex: none; image-rendering: pixelated; border: 2px solid #2b2233; border-radius: 6px;
  background: #fbf6ea; }
.ui-say-face.talking { animation: ui-talk .32s ease-in-out infinite; }
.ui-say-body { min-width: 0; }
.ui-say-name { font: 800 11px/1.2 ${UI_FONT}; color: #b86f50; text-transform: uppercase; letter-spacing: .5px; }
.ui-say-text { margin: 1px 0 0; }
/* В окне утра — то же облачко, но на месте: над вкладками, с кнопкой «Понятно». */
.ui-say.inline { position: relative; left: auto; top: auto; max-width: none; width: 100%; margin: 8px 0 12px;
  align-items: flex-start; cursor: default; animation: ui-pop .3s cubic-bezier(.3, 1.45, .5, 1); background: #fffbe8; }
.ui-say.inline::before { left: 34px; bottom: -12px; }
.ui-say.inline::after { left: 37px; bottom: -6px; border-top-color: #fffbe8; }
.ui-say.inline .ui-say-body { flex: 1; }
.ui-say-ok { display: flex; justify-content: flex-end; margin-top: 4px; }
.ui-say-ok .ui-chip { padding: 5px 14px; }
/* Вкладка только что открылась: мягко светится, с ярлыком «Новое». */
.ui-tab.ui-tab-new { box-shadow: 0 0 0 2px #fee761; animation: ui-tab-new 1.2s ease-in-out infinite; }
@keyframes ui-tab-new { 50% { box-shadow: 0 0 0 4px #feae34; } }
.ui-tab-new-tag { position: absolute; top: -8px; left: 50%; transform: translateX(-50%); padding: 1px 4px; border: 2px solid #2b2233;
  border-radius: 4px; background: #fee761; color: #2b2233; font: 800 8.5px/1.1 ${UI_FONT}; text-transform: uppercase; white-space: nowrap; }
/* Печать «Первая выручка!» над залом — не окно: сквозь неё можно нажимать. */
.ui-onb-stamp { position: fixed; left: 0; right: 0; top: calc(var(--safe-top, env(safe-area-inset-top)) + 17vh); z-index: 30;
  display: flex; justify-content: center; pointer-events: none; transition: opacity .45s, transform .45s; }
.ui-onb-stamp.gone { opacity: 0; transform: translateY(-14px); }
.ui-onb-stamp .ui-stamp { padding: 5px 16px 6px; font-size: 11px; }
.ui-onb-stamp .ui-stamp b { font-size: 26px; }
.ui-onb-stamp .ui-stamp span { font-size: 15px; max-width: none; }
@media (prefers-reduced-motion: reduce) { .ui-say, .ui-say.inline, .ui-tab.ui-tab-new { animation: none; } }
/* Бабушкин подарок после первого дня: вещь крупно, под ней — её слова. */
.ui-first-gift { text-align: center; }
.ui-first-gift img.ui-first-item { display: block; width: 96px; height: 96px; margin: 6px auto 4px; image-rendering: pixelated;
  animation: ui-pop .45s cubic-bezier(.3, 1.45, .5, 1) both; }
.ui-first-gift .ui-say.inline { text-align: left; }
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

/** Голос бабушки в диалогах (как в утре). */
const GRANDMA_PITCH = 620;
/** Скорость печати по буквам — как в диалогах. */
const CHAR_MS = 26;

export interface SayLine {
  /** Что за реплика: та же — не начинается заново. */
  id: string;
  text: string;
  mood?: 'happy' | 'sad' | 'surprised';
  /** Сколько висеть после того, как допечатана (мс); 0 — пока не сменят или не нажмут. */
  hold: number;
}

/**
 * Облачко бабушки в зале. Печатается по буквам с её голосом; касание — сначала дописать, потом
 * убрать. Сцена каждый кадр говорит, где бабушка на экране (place).
 */
export class SayBubble {
  private root: HTMLElement | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private hideAt = 0;
  private holdMs = 0;
  /** Какая реплика на экране. */
  line: string | null = null;

  get visible(): boolean {
    return Boolean(this.root);
  }

  show(o: SayLine): void {
    if (this.line === o.id && this.root) return;
    styles();
    this.drop();
    this.line = o.id;
    const root = el('div', 'ui-say');
    const text = el('p', 'ui-say-text');
    const body = el('div', 'ui-say-body');
    let typing = true;
    const face = liveFace(`assets/portrait_grandma${o.mood ? `_${o.mood}` : ''}.png`, () => typing, 'ui-say-face');
    face.classList.add('talking');
    body.append(el('div', 'ui-say-name', t(CHARACTERS.grandma.nameKey)), text);
    root.append(face, body);
    // Пока облачко не встало над бабушкой — не видно (место считается в первом же кадре сцены).
    root.style.visibility = 'hidden';
    document.body.append(root);
    this.root = root;
    this.holdMs = o.hold;
    this.hideAt = 0;
    const chars = [...o.text];
    // Голос — тот же, что у бабушки в диалогах (бормотание слогами); писк или бормотание решает
    // первый слог, и так до конца реплики.
    const talk = new Babbler(voiceOf(`portrait_grandma${o.mood ? `_${o.mood}` : ''}`, GRANDMA_PITCH), chars);
    let babble: boolean | undefined;
    let shown = 0;
    const finish = () => {
      if (!typing) return;
      typing = false;
      this.stopTyping();
      text.textContent = o.text;
      pixelize(text);
      face.classList.remove('talking');
      if (this.holdMs) this.hideAt = performance.now() + this.holdMs;
    };
    const start = performance.now();
    this.timer = setInterval(() => {
      const target = Math.min(chars.length, Math.max(shown + 1, Math.floor((performance.now() - start) / CHAR_MS)));
      const syllable = talk.next(target, performance.now() / 1000);
      if (syllable) sound.syllable(talk.voice, syllable, (babble ??= sound.babbleReady()));
      shown = target;
      text.textContent = chars.slice(0, shown).join('');
      if (shown >= chars.length) finish();
    }, CHAR_MS);
    root.addEventListener('click', () => {
      if (typing) finish();
      else this.hide();
    });
  }

  /**
   * Куда показывает хвостик (точка на экране, CSS-пиксели): облачко — под ней (below) или над ней,
   * целиком на экране; не влезает снизу — встаёт сверху. Заодно убирает реплику, которой пора.
   */
  place(x: number, y: number, below = false): void {
    const root = this.root;
    if (!root) return;
    if (this.hideAt && performance.now() > this.hideAt) {
      this.hide();
      return;
    }
    const w = root.offsetWidth;
    const h = root.offsetHeight;
    const margin = 10;
    const left = Math.round(Math.min(Math.max(margin, x - w / 2), window.innerWidth - w - margin));
    // Снизу место под подсказкой и кнопками (~90 пикселей); сверху — под панелью с деньгами и днём.
    const under = below && y + 12 + h < window.innerHeight - 90;
    const top = Math.round(under ? y + 12 : Math.max(76, y - h - 12));
    root.classList.toggle('below', under);
    root.style.left = `${left}px`;
    root.style.top = `${top}px`;
    root.style.setProperty('--tail', `${Math.round(Math.min(Math.max(16, x - left), w - 16))}px`);
    root.style.visibility = '';
  }

  hide(): void {
    const root = this.root;
    if (!root) return;
    this.stopTyping();
    this.root = null;
    this.line = null;
    // Уходит не мгновенно: сжимается к бабушке и тает.
    root.classList.add('out');
    setTimeout(() => root.remove(), 200);
  }

  /** Убрать сразу, без таяния (новая реплика встаёт на место прежней). */
  private drop(): void {
    this.stopTyping();
    this.root?.remove();
    this.root = null;
    this.line = null;
  }

  private stopTyping(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

/** «Первая выручка!» — печать над залом: с размаху, с искрами, через пару секунд тает. */
export function firstSaleStamp(total: number): void {
  styles();
  const calm = liteMode() || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wrap = el('div', 'ui-onb-stamp');
  wrap.append(stamp('gold', t('onb.stampTop'), t('onb.stamp'), `+${total} 💰`, 0, 0, !calm));
  pixelize(wrap);
  document.body.append(wrap);
  setTimeout(() => wrap.classList.add('gone'), 2600);
  setTimeout(() => wrap.remove(), 3200);
}

/**
 * Подарок от бабушки после первого дня новичка (game/firstday.ts): короткая праздничная карточка —
 * сама вещь крупно и её слова. Закрыли — дальше ночь и утро.
 */
export function firstGiftCard(onClose: () => void): void {
  styles();
  const { card, close } = openModal();
  card.classList.add('ui-first-gift');
  const item = el('img', 'ui-first-item');
  item.src = png('counter_vase');
  item.alt = '';
  const say = el('div', 'ui-say inline');
  const body = el('div', 'ui-say-body');
  body.append(el('div', 'ui-say-name', t(CHARACTERS.grandma.nameKey)), el('p', 'ui-say-text', t('first.giftText')));
  say.append(liveFace('assets/portrait_grandma_happy.png', () => false, 'ui-say-face'), body);
  card.append(
    el('h2', '', `🎁 ${t('first.giftTitle')}`),
    item,
    say,
    button(t('first.giftOk'), () => {
      haptic.tap();
      close();
      onClose();
    }, 'ui-btn'),
  );
  pixelize(card);
  sound.fanfare();
  haptic.success();
}

/** Подсказка бабушки к только что открытой вкладке утра: одна строчка и «Понятно». */
export function tabHint(text: string, onOk: () => void): HTMLElement {
  styles();
  const box = el('div', 'ui-say inline');
  const body = el('div', 'ui-say-body');
  const row = el('div', 'ui-say-ok');
  row.append(button(t('onb.ok'), onOk, 'ui-chip'));
  body.append(el('div', 'ui-say-name', t(CHARACTERS.grandma.nameKey)), el('p', 'ui-say-text', text), row);
  box.append(liveFace('assets/portrait_grandma_happy.png', () => false, 'ui-say-face'), body);
  return box;
}

/** Ярлык «Новое» на вкладке. */
export function newTag(): HTMLElement {
  styles();
  return el('span', 'ui-tab-new-tag', t('onb.new'));
}
