import { t, type TextKey } from '../i18n';
import { onShelves, PRODUCTS, sellableProducts, warehouseCount, type DayStats, type StoreState } from '../game/economy';
import { button, curtain, el, injectStyles, openModal, pixelize } from './dom';
import type { Review } from '../game/reviews';
import { reviewCards } from './reviews';
import type { LossAdvice } from '../game/losses';

/** Цвета причин ухода — те же, что в полоске. */
const LOSS_COLORS = { queue: '#f77622', empty: '#8b9bb4', expensive: '#e43b44', eduard: '#68386c' } as const;

/** «Куда ушли покупатели»: полоска купили/ушли по причинам и совет к каждой причине. */
function lossBox(served: number, losses: LossAdvice[]): HTMLElement {
  const box = el('div', 'ui-box');
  box.append(el('b', '', t('loss.title')));
  const total = served + losses.reduce((sum, l) => sum + l.count, 0);
  const bar = el('div', 'ui-loss-bar');
  const part = (n: number, color: string) => {
    const seg = el('div');
    seg.style.flex = String(n);
    seg.style.background = color;
    bar.append(seg);
  };
  part(served, '#63c74d');
  for (const l of losses) part(l.count, LOSS_COLORS[l.reason]);
  box.append(bar, el('div', 'ui-muted', `🟩 ${t('loss.bought')}: ${served} / ${total}`));
  for (const l of losses) {
    const row = el('div', 'ui-loss-row');
    const dot = el('span', 'ui-loss-dot');
    dot.style.background = LOSS_COLORS[l.reason];
    const text = el('div');
    text.append(el('b', '', `${t(`loss.r.${l.reason}` as TextKey)} — ${l.count}`), el('div', 'ui-item-sub', t(l.key, l.params)));
    row.append(dot, text);
    box.append(row);
  }
  return box;
}

export class Hud {
  private readonly top = el('div', 'ui-hud');
  private readonly stock = el('div', 'ui-stock');
  private readonly hint = el('div', 'ui-hint');
  /** Ускорение дня ×2 — когда магазин работает сам. */
  private readonly speed = el('button', 'ui-speed');
  onSpeed: () => void = () => {};
  /** Срочный подвоз: кнопка над ускорением. */
  private readonly urgent = el('button', 'ui-speed ui-urgent', '🚚');
  onUrgent: () => void = () => {};
  private readonly money = el('span');
  private readonly moneyText = document.createTextNode('');
  private readonly clock = el('span');
  private readonly stars = el('span');
  /** Сколько денег сейчас показано — число «докручивается» до настоящего. */
  private shownMoney: number | null = null;
  private targetMoney = 0;
  private roll = 0;

  constructor() {
    injectStyles();
    const coin = el('img', 'ui-ico');
    coin.src = 'assets/coin.png';
    coin.alt = '💰';
    this.money.append(coin, this.moneyText);
    this.top.append(this.money, this.clock, this.stars);
    this.speed.addEventListener('click', () => this.onSpeed());
    this.speed.style.display = 'none';
    this.urgent.addEventListener('click', () => this.onUrgent());
    this.urgent.style.display = 'none';
    document.body.append(this.top, this.stock, this.hint, this.speed, this.urgent);
  }

  update(state: StoreState, secondsLeft: number, quests = '', night = false): void {
    this.setMoney(state.money);
    const clock = `${night ? t('hud.night') : t('hud.day', { n: state.day })} · ${Math.floor(secondsLeft / 60)}:${String(Math.floor(secondsLeft % 60)).padStart(2, '0')}`;
    if (this.clock.textContent !== clock) this.clock.textContent = clock;
    const stars = '★'.repeat(Math.round(state.rating)).padEnd(5, '☆');
    if (this.stars.textContent !== stars) this.stars.textContent = stars;
    const shelves = sellableProducts(state).map((id) => `${PRODUCTS[id].icon}${onShelves(state, id)}`);
    const stock = `${shelves.join('  ')}   📦${warehouseCount(state)}${quests ? `   ${quests}` : ''}`;
    // Перерисовываем только когда что-то изменилось: update зовётся каждый кадр.
    if (stock === this.lastStock) return;
    this.lastStock = stock;
    this.stock.textContent = stock;
    this.stock.classList.toggle('dense', shelves.length > 7);
    pixelize(this.stock);
  }

  private lastStock = '';

  /** Деньги не прыгают, а быстро докручиваются, как барабан кассы. */
  private setMoney(value: number): void {
    if (this.shownMoney !== null && value === this.targetMoney) return;
    const from = this.shownMoney ?? value;
    this.targetMoney = value;
    cancelAnimationFrame(this.roll);
    if (from === value) {
      this.renderMoney(value);
      return;
    }
    this.money.classList.toggle('ui-money-up', value > from);
    this.money.classList.toggle('ui-money-down', value < from);
    const start = performance.now();
    const duration = Math.min(800, 250 + Math.abs(value - from) * 3);
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / duration);
      this.renderMoney(Math.round(from + (value - from) * (1 - (1 - k) ** 3)));
      if (k < 1) this.roll = requestAnimationFrame(step);
      else this.money.classList.remove('ui-money-up', 'ui-money-down');
    };
    this.roll = requestAnimationFrame(step);
  }

  private renderMoney(value: number): void {
    this.shownMoney = value;
    this.moneyText.nodeValue = ` ${value}`;
  }

  /** Кнопка ускорения: видна только днём; ×1 или ×2. */
  showUrgent(visible: boolean): void {
    const display = visible ? '' : 'none';
    if (this.urgent.style.display !== display) {
      this.urgent.style.display = display;
      if (visible) pixelize(this.urgent);
    }
  }

  showSpeed(visible: boolean, speed: number): void {
    const text = speed > 1 ? '⏩ ×2' : '▶ ×1';
    if (this.speed.textContent !== text) this.speed.textContent = text;
    this.speed.style.display = visible ? '' : 'none';
    this.speed.classList.toggle('on', speed > 1);
  }

  /** Счётчик денег подпрыгивает, когда в него «долетели» монетки. */
  bumpMoney(): void {
    const money = this.top.firstElementChild;
    if (!money) return;
    money.classList.remove('ui-bump');
    void (money as HTMLElement).offsetWidth;
    money.classList.add('ui-bump');
  }

  /** Подсказка внизу; в первые дни — яркая плашка, чтобы новичок точно заметил. */
  setHint(text: string, tutorial = false): void {
    if (this.hint.textContent !== text) this.hint.textContent = text;
    this.hint.classList.toggle('ui-hint-tip', tutorial && text !== '');
  }

  showSummary(
    day: number,
    stats: DayStats,
    rating: { before: number; after: number },
    money: { bill: number | null; shortfall: number; total: number },
    extra: [string, string][],
    history: number[],
    losses: LossAdvice[],
    reviews: Review[],
    onNext: () => void,
  ): void {
    const { card, close } = openModal();
    card.append(el('h2', '', t('summary.title', { n: day })));
    // Главное — крупными плитками.
    const arrowRating = rating.after > rating.before ? '▲' : rating.after < rating.before ? '▼' : '';
    const tiles = el('div', 'ui-tiles');
    const tile = (value: string, label: string, tone = '') => {
      const box = el('div', `ui-tile ${tone}`);
      box.append(el('b', '', value), el('span', '', label));
      tiles.append(box);
    };
    tile(`💰 ${stats.revenue}`, t('summary.revenue'), 'good');
    tile(`🙂 ${stats.served}`, t('summary.served'));
    tile(`🚶 ${stats.lost}`, t('summary.lost'), stats.lost > stats.served / 3 ? 'bad' : '');
    tile(`★ ${rating.after.toFixed(1)} ${arrowRating}`, t('summary.rating'), arrowRating === '▼' ? 'bad' : arrowRating ? 'good' : '');
    card.append(tiles);
    // Выручка за последние 7 дней: сегодня — жёлтым.
    const week = history.slice(-7);
    if (week.length > 1) {
      const chart = el('div', 'ui-chart');
      const max = Math.max(...week, 1);
      week.forEach((value, i) => {
        const col = el('div', 'ui-chart-col');
        const bar = el('div', `ui-chart-bar${i === week.length - 1 ? ' today' : ''}`);
        bar.style.height = `${Math.max(4, Math.round((value / max) * 100))}%`;
        col.append(el('span', 'ui-chart-value', String(value)), bar, el('span', 'ui-chart-day', String(day - week.length + 1 + i)));
        chart.append(col);
      });
      card.append(el('div', 'ui-muted', t('summary.week')), chart);
    }
    const row = (label: string, value: string | number) => {
      const r = el('div', 'ui-row');
      r.append(el('span', '', label), el('b', '', String(value)));
      card.append(r);
    };
    if (losses.length) card.append(lossBox(stats.served, losses));
    row(t('summary.complaints'), stats.complaints);
    row(t('summary.spoiled'), stats.spoiled);
    if (stats.nightRevenue) row(t('summary.night'), `+${stats.nightRevenue} 💰`);
    if (stats.stolen) row(t('summary.stolen'), `−${stats.stolen} 💰`);
    if (stats.caught) row(t('summary.caught'), stats.caught);
    if (stats.skimmed) row(t('summary.skimmed'), `−${stats.skimmed} 💰`);
    for (const [label, value] of extra) row(label, value);
    if (money.bill !== null) row(t('summary.bills'), `−${money.bill} 💰`);
    row(t('summary.money'), `${money.total} 💰`);
    if (money.shortfall > 0) card.append(el('div', 'ui-note', t('summary.shortfall', { n: money.shortfall })));
    row(t('summary.rating'), `${rating.before.toFixed(1)} → ${rating.after.toFixed(1)}★ ${arrowRating}`);
    // Что написали посетители — сразу видно, что исправить завтра.
    if (reviews.length) card.append(el('h3', '', t('summary.reviews')), ...reviewCards(reviews));
    card.append(
      button(t('summary.next'), () => {
        // Роллет опускается с номером нового дня — и поднимается уже утром.
        curtain(t('hud.day', { n: day + 1 }), () => {
          close();
          onNext();
        });
      }),
    );
  }
}
