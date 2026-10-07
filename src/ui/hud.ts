import { t } from '../i18n';
import { onShelves, PRODUCTS, sellableProducts, warehouseCount, type DayStats, type StoreState } from '../game/economy';
import { button, el, injectStyles, openModal } from './dom';

export class Hud {
  private readonly top = el('div', 'ui-hud');
  private readonly stock = el('div', 'ui-stock');
  private readonly hint = el('div', 'ui-hint');

  constructor() {
    injectStyles();
    document.body.append(this.top, this.stock, this.hint);
  }

  update(state: StoreState, secondsLeft: number, quests = ''): void {
    const stars = '★'.repeat(Math.round(state.rating)).padEnd(5, '☆');
    const clock = `${Math.floor(secondsLeft / 60)}:${String(Math.floor(secondsLeft % 60)).padStart(2, '0')}`;
    this.top.replaceChildren(
      el('span', '', `💰 ${state.money}`),
      el('span', '', `${t('hud.day', { n: state.day })} · ${clock}`),
      el('span', '', stars),
    );
    const shelves = sellableProducts(state).map((id) => `${PRODUCTS[id].icon}${onShelves(state, id)}`);
    this.stock.textContent = `${shelves.join('  ')}   📦${warehouseCount(state)}${quests ? `   ${quests}` : ''}`;
  }

  setHint(text: string): void {
    if (this.hint.textContent !== text) this.hint.textContent = text;
  }

  showSummary(
    day: number,
    stats: DayStats,
    rating: { before: number; after: number },
    money: { bill: number | null; shortfall: number; total: number },
    extra: [string, string][],
    onNext: () => void,
  ): void {
    const { card, close } = openModal();
    card.append(el('h2', '', t('summary.title', { n: day })));
    const row = (label: string, value: string | number) => {
      const r = el('div', 'ui-row');
      r.append(el('span', '', label), el('b', '', String(value)));
      card.append(r);
    };
    row(t('summary.revenue'), `💰 ${stats.revenue}`);
    row(t('summary.served'), stats.served);
    row(t('summary.lost'), stats.lost);
    row(t('summary.complaints'), stats.complaints);
    row(t('summary.spoiled'), stats.spoiled);
    if (stats.stolen) row(t('summary.stolen'), `−${stats.stolen} 💰`);
    if (stats.caught) row(t('summary.caught'), stats.caught);
    if (stats.skimmed) row(t('summary.skimmed'), `−${stats.skimmed} 💰`);
    for (const [label, value] of extra) row(label, value);
    if (money.bill !== null) row(t('summary.bills'), `−${money.bill} 💰`);
    row(t('summary.money'), `${money.total} 💰`);
    if (money.shortfall > 0) card.append(el('div', 'ui-note', t('summary.shortfall', { n: money.shortfall })));
    const arrow = rating.after > rating.before ? '▲' : rating.after < rating.before ? '▼' : '';
    row(t('summary.rating'), `${rating.before.toFixed(1)} → ${rating.after.toFixed(1)}★ ${arrow}`);
    card.append(
      button(t('summary.next'), () => {
        close();
        onNext();
      }),
    );
  }
}
