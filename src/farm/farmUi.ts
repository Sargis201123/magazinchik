// Окна и панели «Бабушкиной фермы» (DOM, как ui/* «Магазинчика»): верхняя панель (день, монеты, погода,
// ход дня), кнопка «Открыть лавку» утром, выбор семян для грядки и вечерние итоги. Сцена — FarmScene.ts.

import { t, type TextKey } from '../i18n';
import { png } from '../platform/assets';
import { sound } from '../platform/sound';
import { button, el, injectStyles, openModal, pixelize, UI_FONT } from '../ui/dom';
import { sheetPng } from '../ui/sheet';
import { CROPS, CROP_IDS, type CropId } from '../game/farm/crops';
import type { FarmDayStats } from '../game/farm/farm';

const css = `
/* Панели магазина, пока он спит за фермой (farm/enter.ts). */
.ui-on-farm .ui-hud, .ui-on-farm .ui-stock, .ui-on-farm .ui-hint { display: none !important; }
/* Кнопка звука магазина (ui/audio.ts) пригодится и на ферме — только выше большой кнопки внизу. */
.ui-on-farm .ui-mute { bottom: calc(var(--safe-bottom, env(safe-area-inset-bottom)) + 84px); }
.fm-hud { position: fixed; left: 50%; transform: translateX(-50%); top: calc(var(--safe-top, env(safe-area-inset-top)) + 8px);
  width: min(var(--game-w, 100vw), 100vw); box-sizing: border-box; padding: 0 10px; display: flex; gap: 6px; align-items: center;
  font: 700 14px/1.2 ${UI_FONT}; color: #2b2233; pointer-events: none; z-index: 5; }
.fm-pill { background: #fbf6ea; border: 3px solid #2b2233; border-radius: 8px; padding: 4px 8px; box-shadow: 0 3px 0 rgba(43,34,51,.8);
  white-space: nowrap; }
.fm-pill.money { margin-left: auto; }
.fm-clock { flex: 1; min-width: 40px; height: 12px; background: #fbf6ea; border: 3px solid #2b2233; border-radius: 8px; overflow: hidden;
  box-shadow: 0 3px 0 rgba(43,34,51,.8); }
.fm-clock i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #fee761, #f77622); }
.fm-note { position: fixed; left: 50%; transform: translateX(-50%); top: calc(var(--safe-top, env(safe-area-inset-top)) + 52px);
  font: 700 13px/1.2 ${UI_FONT}; color: #fff; background: rgba(38,43,68,.8); border-radius: 8px; padding: 4px 10px; pointer-events: none;
  white-space: nowrap; z-index: 5; transition: opacity .4s; }
.fm-bottom { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(var(--safe-bottom, env(safe-area-inset-bottom)) + 18px);
  width: min(300px, 86vw); z-index: 5; }
.fm-bottom .ui-btn { font-size: 19px; font-weight: 800; padding: 13px; color: #fff; text-shadow: 0 2px 0 #2b2233;
  background-color: #7fc659; border-width: 4px; border-radius: 8px;
  animation: fm-breathe 2.2s ease-in-out infinite; }
@keyframes fm-breathe { 50% { transform: scale(1.03); } }
@media (prefers-reduced-motion: reduce) { .fm-bottom .ui-btn { animation: none; } }
.fm-crops { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.fm-crop { display: flex; align-items: center; gap: 10px; text-align: left; width: 100%; padding: 8px 10px; margin: 0;
  font: 600 13px/1.3 ${UI_FONT}; background: #fbf6ea; color: #2b2233; border: 3px solid #2b2233; border-radius: 8px; cursor: pointer; }
.fm-crop:disabled { opacity: .45; cursor: default; }
.fm-crop > img { width: 36px; height: 36px; image-rendering: pixelated; flex: none; object-fit: contain; }
.fm-crop b { display: block; font-size: 16px; }
.fm-sum { font: 600 15px/1.6 ${UI_FONT}; margin: 6px 0; }
.fm-sum b { font-size: 18px; }
.fm-say { display: flex; gap: 8px; align-items: center; margin: 8px 0 4px; padding: 6px 10px 6px 6px; background: #fffbe8;
  border: 3px solid #2b2233; border-radius: 10px; font: 600 14px/1.3 ${UI_FONT}; color: #2b2233; }
.fm-say img { width: 40px; height: 40px; flex: none; image-rendering: pixelated; border: 2px solid #2b2233; border-radius: 6px; background: #fbf6ea; }
.fm-say p { margin: 0; }
.fm-title { margin: 0 0 4px; font: 800 20px/1.2 ${UI_FONT}; text-align: center; }
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

export const cropName = (id: CropId): string => t(`farm.crop.${id}` as TextKey);

/** Верхняя панель и кнопка внизу. */
export class FarmHud {
  private root: HTMLElement;
  private day: HTMLElement;
  private money: HTMLElement;
  private clock: HTMLElement;
  private note: HTMLElement;
  private bottom: HTMLElement;
  private shown = '';

  constructor() {
    styles();
    this.root = el('div', 'fm-hud');
    this.day = el('div', 'fm-pill');
    const clock = el('div', 'fm-clock');
    this.clock = el('i');
    clock.append(this.clock);
    this.money = el('div', 'fm-pill money');
    this.root.append(this.day, clock, this.money);
    this.note = el('div', 'fm-note');
    this.note.style.opacity = '0';
    this.bottom = el('div', 'fm-bottom');
    document.body.append(this.root, this.note, this.bottom);
  }

  update(day: number, money: number, progress: number): void {
    const key = `${day}/${money}`;
    if (key !== this.shown) {
      this.shown = key;
      this.day.textContent = `🌾 ${t('farm.day', { n: day })}`;
      this.money.textContent = `${money} 💰`;
      pixelize(this.root);
    }
    this.clock.style.width = `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`;
  }

  /** Строка под панелью (погода, «лавка закрывается»): ms — сколько висеть. */
  say(text: string, ms = 3500): void {
    this.note.textContent = text;
    pixelize(this.note);
    this.note.style.opacity = '1';
    clearTimeout(Number(this.note.dataset.timer));
    this.note.dataset.timer = String(setTimeout(() => (this.note.style.opacity = '0'), ms));
  }

  /** Большая кнопка внизу (null — убрать). */
  action(label: string | null, onClick?: () => void): void {
    this.bottom.replaceChildren();
    if (!label || !onClick) return;
    const b = button(label, () => {
      sound.coin();
      onClick();
    });
    this.bottom.append(b);
    pixelize(b);
  }

  destroy(): void {
    this.root.remove();
    this.note.remove();
    this.bottom.remove();
  }
}

/** Выбор семян для пустой грядки. */
export function pickCrop(money: number, onPick: (id: CropId) => void): () => void {
  styles();
  const { card, close } = openModal();
  card.append(el('h2', 'fm-title', t('farm.pick')));
  const list = el('div', 'fm-crops');
  for (const id of CROP_IDS) {
    const c = CROPS[id];
    const row = el('button', 'fm-crop') as HTMLButtonElement;
    const img = el('img');
    img.src = sheetPng(`farm_item_${id}`);
    img.alt = '';
    const text = el('div');
    text.append(el('b', '', cropName(id)), el('span', '', money >= c.seed ? t('farm.seedInfo', { seed: c.seed, sec: c.grow, yield: c.yield, price: c.price }) : t('farm.noMoney')));
    row.append(img, text);
    row.disabled = money < c.seed;
    row.addEventListener('click', () => {
      close();
      onPick(id);
    });
    list.append(row);
  }
  card.append(list, button(t('farm.cancel'), () => close(), 'ui-btn'));
  return close;
}

/** Вечерние итоги: «Следующий день» и «В Магазинчик». */
export function showSummary(o: { day: number; stats: FarmDayStats; growing: number; onNext: () => void; onStore: () => void }): void {
  styles();
  const { card, close } = openModal();
  const s = o.stats;
  card.append(el('h2', 'fm-title', t('farm.summary.title', { n: o.day })));
  const rows = el('div', 'fm-sum');
  const line = (text: string) => rows.append(el('div', '', text));
  line(t('farm.summary.harvested', { n: s.harvested }));
  line(t('farm.summary.sold', { n: s.sold }));
  rows.append(el('b', '', t('farm.summary.revenue', { n: s.revenue })));
  line(t('farm.summary.seeds', { n: s.seeds }));
  if (s.missed) line(t('farm.summary.missed', { n: s.missed }));
  if (o.growing) line(t('farm.summary.growing', { n: o.growing }));
  card.append(rows);
  // Бабушка — коротко, по итогам.
  const say = el('div', 'fm-say');
  const face = el('img') as HTMLImageElement;
  face.src = png('portrait_grandma_happy');
  face.alt = '';
  say.append(face, el('p', '', t(s.revenue > s.seeds ? 'farm.summary.good' : 'farm.summary.slow')));
  card.append(say);
  card.append(
    button(t('farm.next'), () => {
      close();
      o.onNext();
    }, 'ui-btn'),
    button(t('farm.toStore'), () => {
      close();
      o.onStore();
    }, 'ui-btn'),
  );
}
