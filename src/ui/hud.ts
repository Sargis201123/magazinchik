import { t } from '../i18n';
import { onShelves, PRODUCTS, sellableProducts, warehouseCount, type DayStats, type StoreState } from '../game/economy';
import { button, curtain, el, injectStyles, openModal, pixelize } from './dom';

export class Hud {
  private readonly top = el('div', 'ui-hud');
  private readonly stock = el('div', 'ui-stock');
  private readonly hint = el('div', 'ui-hint');
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
    document.body.append(this.top, this.stock, this.hint);
  }

  update(state: StoreState, secondsLeft: number, quests = ''): void {
    this.setMoney(state.money);
    const clock = `${t('hud.day', { n: state.day })} · ${Math.floor(secondsLeft / 60)}:${String(Math.floor(secondsLeft % 60)).padStart(2, '0')}`;
    if (this.clock.textContent !== clock) this.clock.textContent = clock;
    const stars = '★'.repeat(Math.round(state.rating)).padEnd(5, '☆');
    if (this.stars.textContent !== stars) this.stars.textContent = stars;
    const shelves = sellableProducts(state).map((id) => `${PRODUCTS[id].icon}${onShelves(state, id)}`);
    const stock = `${shelves.join('  ')}   📦${warehouseCount(state)}${quests ? `   ${quests}` : ''}`;
    // Перерисовываем только когда что-то изменилось: update зовётся каждый кадр.
    if (stock === this.lastStock) return;
    this.lastStock = stock;
    this.stock.textContent = stock;
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
    row(t('summary.complaints'), stats.complaints);
    row(t('summary.spoiled'), stats.spoiled);
    if (stats.stolen) row(t('summary.stolen'), `−${stats.stolen} 💰`);
    if (stats.caught) row(t('summary.caught'), stats.caught);
    if (stats.skimmed) row(t('summary.skimmed'), `−${stats.skimmed} 💰`);
    for (const [label, value] of extra) row(label, value);
    if (money.bill !== null) row(t('summary.bills'), `−${money.bill} 💰`);
    row(t('summary.money'), `${money.total} 💰`);
    if (money.shortfall > 0) card.append(el('div', 'ui-note', t('summary.shortfall', { n: money.shortfall })));
    row(t('summary.rating'), `${rating.before.toFixed(1)} → ${rating.after.toFixed(1)}★ ${arrowRating}`);
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
