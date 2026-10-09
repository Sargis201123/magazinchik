// Окно «Отчёт за неделю»: выручка по дням столбиками, товары по прибыли и советы.

import { t } from '../i18n';
import { PRODUCTS, type StoreState } from '../game/economy';
import { weekReport } from '../game/reports';
import { button, el, openModal } from './dom';

export function showReport(state: StoreState): void {
  const { card, close } = openModal();
  const report = weekReport(state);
  if (!report.days.length) {
    card.append(el('h2', '', t('report.button')), el('p', '', t('report.empty')), button(t('report.close'), close));
    return;
  }
  // Выручка по дням — столбики.
  const max = Math.max(1, ...report.days.map((d) => d.revenue));
  const chart = el('div', 'ui-report-chart');
  for (const d of report.days) {
    const col = el('div', 'ui-report-col');
    const bar = el('div', 'ui-report-bar');
    bar.style.height = `${Math.max(4, Math.round((d.revenue / max) * 70))}px`;
    col.append(el('div', 'ui-report-val', String(d.revenue)), bar, el('div', 'ui-report-day', String(d.day)));
    chart.append(col);
  }
  const lines = report.lines.map((l) => {
    const row = el('div', 'ui-item');
    const img = el('img', 'ui-item-art');
    img.src = `assets/item_${l.id}.png`;
    img.alt = '';
    const body = el('div');
    const sub = [t('report.line', { sold: l.sold, profit: l.profit })];
    if (l.spoiled) sub.push(t('report.spoiled', { n: l.spoiled }));
    body.append(el('div', 'ui-item-name', t(PRODUCTS[l.id].nameKey)), el('div', 'ui-item-sub', sub.join(' · ')));
    if (l.advice) body.append(el('div', 'ui-note', `💡 ${t(l.advice)}`));
    row.append(img, body);
    return row;
  });
  card.append(
    el('h2', '', t('report.title', { n: report.days.length })),
    el('div', 'ui-muted', t('report.total', { rev: report.revenue, served: report.served, lost: report.lost })),
    chart,
    el('h3', '', t('report.products')),
    ...lines,
    button(t('report.close'), close, 'ui-btn secondary'),
  );
}
