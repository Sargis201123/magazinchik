import { t, type TextKey } from '../i18n';
import { onShelves, PRODUCTS, sellableProducts, warehouseCapacity, warehouseCount, type DayStats, type StoreState } from '../game/economy';
import { button, curtain, el, injectStyles, openModal, pixelize } from './dom';
import type { Review } from '../game/reviews';
import { reviewCards } from './reviews';
import { liveFace } from './dialog';
import type { LossAdvice } from '../game/losses';

/** Сколько штук на полках считается «мало» и сколько таких товаров показывать в панели. */
const LOW_ON_SHELF = 3;
const LOW_SHOWN = 6;

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
    if (this.stars.textContent !== stars) {
      // Звезда прибавилась — строка звёзд вспыхивает.
      const count = (text: string) => [...text].filter((c) => c === '★').length;
      const up = this.stars.textContent !== '' && count(stars) > count(this.stars.textContent);
      this.stars.textContent = stars;
      if (up) {
        this.stars.classList.remove('ui-shine');
        void this.stars.offsetWidth;
        this.stars.classList.add('ui-shine');
      }
    }
    // Только то, что на полках кончается: пусто — красным, мало — жёлтым. Остальное — в закупке.
    const low = sellableProducts(state)
      .map((id) => ({ id, n: onShelves(state, id) }))
      .filter((p) => p.n <= LOW_ON_SHELF)
      .sort((a, b) => a.n - b.n);
    const shown = low.slice(0, LOW_SHOWN);
    const key = `${shown.map((p) => `${p.id}${p.n}`).join()}|${low.length}|${warehouseCount(state)}/${warehouseCapacity(state)}|${quests}`;
    // Перерисовываем только когда что-то изменилось: update зовётся каждый кадр.
    if (key === this.lastStock) return;
    this.lastStock = key;
    const parts: HTMLElement[] = [el('span', 'ui-stock-wh', `📦 ${warehouseCount(state)}/${warehouseCapacity(state)}`)];
    for (const p of shown) parts.push(el('span', p.n === 0 ? 'ui-stock-out' : 'ui-stock-low', `${PRODUCTS[p.id].icon}${p.n}`));
    if (low.length > shown.length) parts.push(el('span', 'ui-stock-low', `+${low.length - shown.length}`));
    if (quests) parts.push(el('span', 'ui-stock-wh', quests));
    this.stock.replaceChildren(...parts);
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
    onShare?: (button: HTMLButtonElement) => void,
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
    card.append(tiles, grannySays(day, stats, rating, history));
    // Карточка итогов для сторис или чата (platform/shareCard.ts).
    if (onShare) {
      const share: HTMLButtonElement = button(t('share.button'), () => onShare(share), 'ui-btn secondary');
      card.append(share);
    }
    // Выручка за последние 7 дней: сегодня — жёлтым.
    const week = history.slice(-7);
    if (week.length > 1) {
      const chart = el('div', 'ui-chart');
      const max = Math.max(...week, 1);
      week.forEach((value, i) => {
        const col = el('div', 'ui-chart-col');
        const bar = el('div', `ui-chart-bar${i === week.length - 1 ? ' today' : ''}`);
        bar.style.height = `${Math.max(4, Math.round((value / max) * 100))}%`;
        bar.style.animationDelay = `${i * 70}ms`;
        col.append(el('span', 'ui-chart-value', String(value)), bar, el('span', 'ui-chart-day', String(day - week.length + 1 + i)));
        chart.append(col);
      });
      card.append(el('div', 'ui-muted', t('summary.week')), chart);
      requestAnimationFrame(() => drawChartLine(chart));
    }
    // Главное — плитки, бабушка, график и деньги; остальное — под «Подробнее».
    const more = el('details', 'ui-more');
    more.append(el('summary', '', t('summary.more')));
    const row = (label: string, value: string | number, target: HTMLElement = more) => {
      const r = el('div', 'ui-row');
      r.append(el('span', '', label), el('b', '', String(value)));
      target.append(r);
    };
    row(t('summary.money'), `${money.total} 💰`, card);
    if (money.shortfall > 0) card.append(el('div', 'ui-note', t('summary.shortfall', { n: money.shortfall })));
    // Почему уходили покупатели — подсказка на завтра, её видно сразу.
    if (losses.length) card.append(lossBox(stats.served, losses));
    card.append(more);
    row(t('summary.complaints'), stats.complaints);
    row(t('summary.spoiled'), stats.spoiled);
    if (stats.nightRevenue) row(t('summary.night'), `+${stats.nightRevenue} 💰`);
    if (stats.stolen) row(t('summary.stolen'), `−${stats.stolen} 💰`);
    if (stats.caught) row(t('summary.caught'), stats.caught);
    if (stats.skimmed) row(t('summary.skimmed'), `−${stats.skimmed} 💰`);
    for (const [label, value] of extra) row(label, value);
    if (money.bill !== null) row(t('summary.bills'), `−${money.bill} 💰`);
    row(t('summary.rating'), `${rating.before.toFixed(1)} → ${rating.after.toFixed(1)}★ ${arrowRating}`);
    // Что написали посетители — сразу видно, что исправить завтра.
    if (reviews.length) more.append(el('h3', '', t('summary.reviews')), ...reviewCards(reviews));
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

type GrannyMood = 'great' | 'good' | 'slow' | 'lost' | 'down';
const GRANNY_FACE: Record<GrannyMood, string> = { great: '_happy', good: '', slow: '_sad', lost: '_surprised', down: '_sad' };

/** Бабушка одной фразой оценивает день: по выручке против недели, ушедшим и рейтингу. */
function grannySays(day: number, stats: DayStats, rating: { before: number; after: number }, history: number[]): HTMLElement {
  const earlier = history.slice(-8, -1);
  const avg = earlier.length ? earlier.reduce((a, b) => a + b, 0) / earlier.length : stats.revenue;
  const mood: GrannyMood =
    stats.lost > Math.max(3, stats.served / 3)
      ? 'lost'
      : rating.after < rating.before - 0.05
        ? 'down'
        : stats.revenue >= avg * 1.15 && earlier.length
          ? 'great'
          : stats.revenue < avg * 0.8
            ? 'slow'
            : 'good';
  const box = el('div', 'ui-granny');
  const started = performance.now();
  box.append(
    liveFace(`assets/portrait_grandma${GRANNY_FACE[mood]}.png`, () => performance.now() - started < 1600, 'ui-granny-face'),
    el('p', '', t(`summary.granny.${mood}.${day % 2}` as TextKey)),
  );
  return box;
}

/** Линия по верхушкам столбиков недели: рисуется слева направо, на каждом дне — точка. */
function drawChartLine(chart: HTMLElement): void {
  const bars = [...chart.querySelectorAll<HTMLElement>('.ui-chart-bar')];
  if (bars.length < 2 || !chart.isConnected) return;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.classList.add('ui-chart-line');
  svg.setAttribute('width', String(chart.clientWidth));
  svg.setAttribute('height', String(chart.clientHeight));
  // offsetTop/offsetHeight не зависят от анимации scaleY — берём уже итоговые верхушки.
  const points = bars.map((bar) => {
    const col = bar.parentElement as HTMLElement;
    return { x: col.offsetLeft + col.offsetWidth / 2, y: bar.offsetTop };
  });
  const line = document.createElementNS(NS, 'polyline');
  line.setAttribute('points', points.map((p) => `${p.x},${p.y}`).join(' '));
  let len = 0;
  for (let i = 1; i < points.length; i++) len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  line.style.strokeDasharray = String(len);
  line.style.setProperty('--len', String(len));
  svg.append(line);
  points.forEach((p, i) => {
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('cx', String(p.x));
    dot.setAttribute('cy', String(p.y));
    dot.setAttribute('r', '2.5');
    dot.style.transformOrigin = `${p.x}px ${p.y}px`;
    dot.style.animationDelay = `${600 + (900 * i) / (points.length - 1)}ms`;
    svg.append(dot);
  });
  chart.append(svg);
}
