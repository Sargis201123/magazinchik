// Интерфейс поверх canvas делаем на DOM: текст остаётся чётким на любом экране,
// а переводы и вёрстка меню проще, чем внутри Phaser.

import { t } from '../i18n';
import { PRODUCTS, PRODUCT_IDS, type DayStats, type StoreState } from '../game/economy';

const css = `
.ui-hud { position: fixed; top: 0; left: 0; right: 0; display: flex; justify-content: space-between;
  padding: calc(env(safe-area-inset-top) + 8px) 12px 8px; font: 600 15px/1.2 system-ui, sans-serif;
  color: #fff; text-shadow: 0 1px 0 #000; pointer-events: none; }
.ui-stock { position: fixed; left: 0; right: 0; top: calc(env(safe-area-inset-top) + 32px); display: flex;
  gap: 10px; justify-content: center; font: 13px system-ui, sans-serif; color: #e6e1d6; pointer-events: none; }
.ui-hint { position: fixed; left: 12px; right: 12px; bottom: calc(env(safe-area-inset-bottom) + 12px);
  text-align: center; font: 13px system-ui, sans-serif; color: #e6e1d6; pointer-events: none; }
.ui-modal { position: fixed; inset: 0; background: rgba(15, 12, 22, .78); display: flex; align-items: center;
  justify-content: center; padding: 16px; }
.ui-card { background: #f4ecd8; color: #2b2233; border: 3px solid #2b2233; border-radius: 6px; padding: 16px;
  max-width: 320px; width: 100%; font: 15px/1.4 system-ui, sans-serif; box-shadow: 0 4px 0 #2b2233; }
.ui-card h2 { margin: 0 0 10px; font-size: 18px; }
.ui-row { display: flex; justify-content: space-between; margin: 4px 0; }
.ui-btn { display: block; width: 100%; margin-top: 10px; padding: 12px; font: 600 15px system-ui, sans-serif;
  border: 3px solid #2b2233; border-radius: 6px; background: #8fd16a; color: #2b2233; box-shadow: 0 3px 0 #2b2233; }
.ui-btn:active { transform: translateY(2px); box-shadow: 0 1px 0 #2b2233; }
.ui-btn[disabled] { background: #c9c0ad; color: #7a7066; }
.ui-btn.secondary { background: #f2c14e; }
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

export class Hud {
  private readonly top = el('div', 'ui-hud');
  private readonly stock = el('div', 'ui-stock');
  private readonly hint = el('div', 'ui-hint');

  constructor() {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);
    document.body.append(this.top, this.stock, this.hint);
  }

  update(state: StoreState, secondsLeft: number): void {
    const stars = '★'.repeat(Math.round(state.rating)).padEnd(5, '☆');
    const clock = `${Math.floor(secondsLeft / 60)}:${String(Math.floor(secondsLeft % 60)).padStart(2, '0')}`;
    this.top.textContent = '';
    this.top.append(
      el('span', '', `💰 ${state.money}`),
      el('span', '', `${t('hud.day', { n: state.day })} · ${clock}`),
      el('span', '', stars),
    );
    this.stock.textContent = PRODUCT_IDS.map((id) => `${t(PRODUCTS[id].nameKey)}: ${state.stock[id]}`).join(' · ');
  }

  setHint(text: string): void {
    this.hint.textContent = text;
  }

  showIntro(onStart: () => void): void {
    const card = this.modal();
    card.append(el('h2', '', t('title')), el('p', '', t('story.intro')));
    this.button(card, t('story.start'), onStart);
  }

  showSummary(
    day: number,
    stats: DayStats,
    restock: { cost: number; affordable: boolean; run: () => void },
    onNext: () => void,
  ): void {
    const card = this.modal();
    card.append(el('h2', '', t('summary.title', { n: day })));
    const row = (label: string, value: string | number) => {
      const r = el('div', 'ui-row');
      r.append(el('span', '', label), el('b', '', String(value)));
      card.append(r);
    };
    row(t('summary.revenue'), `💰 ${stats.revenue}`);
    row(t('summary.served'), stats.served);
    row(t('summary.lost'), stats.lost);

    const restockBtn = this.button(
      card,
      restock.affordable ? t('summary.restock', { cost: restock.cost }) : t('summary.notEnough'),
      () => {
        restock.run();
        restockBtn.disabled = true;
      },
      'secondary',
      false,
    );
    restockBtn.disabled = !restock.affordable || restock.cost === 0;
    this.button(card, t('summary.next'), onNext);
  }

  private modal(): HTMLDivElement {
    const overlay = el('div', 'ui-modal');
    const card = el('div', 'ui-card');
    overlay.append(card);
    document.body.append(overlay);
    return card;
  }

  private button(card: HTMLElement, label: string, onClick: () => void, variant = '', closes = true): HTMLButtonElement {
    const btn = el('button', `ui-btn ${variant}`, label);
    btn.addEventListener('click', () => {
      if (closes) card.parentElement?.remove();
      onClick();
    });
    card.append(btn);
    return btn;
  }
}
