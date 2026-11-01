// Раздел «Своя марка на полках» во вкладке «Развитие» (game/lines.ts): варенье, соленья, пельмени
// ручной лепки и квас. У каждой линейки — картинка её уголка, ступень, из чего делают, сколько держат
// на полках и кнопка «Открыть» / «Улучшить». Закрытая — с замком и причиной. Сверху — «слава марки».

import { t } from '../i18n';
import { canPlace, onShift, PRODUCTS, SHELF_KINDS, STORE_LEVELS, type StoreState } from '../game/economy';
import { brandFame, buyLineTier, FAME_STEP, LINE_IDS, LINE_MAX, LINES, lineExtra, lineLock, lineSeason, lineStock, lineTier, lineUnitCost, lineWorking, nextLineCost, type LineId } from '../game/lines';
import { track } from '../platform/analytics';
import { button, el, toast } from './dom';
import { sheetPng } from './sheet';

/** Почему открытая линейка сегодня ночью ничего не сделает (или пусто — всё хорошо). */
function idle(state: StoreState, id: LineId): string {
  const line = LINES[id];
  if (lineWorking(state, id)) return '';
  if (!state.shelves.some((s) => canPlace(line.product, s))) return t('lines.noShelf', { shelf: t(SHELF_KINDS[PRODUCTS[line.product].category].nameKey) });
  if (!lineSeason(id, state.day + 1)) return t('lines.offSeason');
  if (line.needs === 'kitchen' && !onShift(state, 'cook')) return t('lines.noCook');
  return '';
}

/** Из чего делают: «1 🍎 со склада + 12 💰 на банку». */
function recipe(state: StoreState, id: LineId): string {
  const line = LINES[id];
  const extra = lineExtra(state, id);
  if (!line.input) return t('lines.recipeBuy', { n: extra });
  const per = line.input.per;
  return t('lines.recipe', { what: `${per >= 1 ? per : `1/${Math.round(1 / per)}`} ${PRODUCTS[line.input.id].icon}`, n: extra });
}

export function linesBox(state: StoreState, getState: () => StoreState, update: (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void): HTMLElement[] {
  // Пока ни одна линейка не открывается (ларёк и «Магазинчик»), раздел не показываем — меньше шума в меню.
  if (state.level < Math.min(...LINE_IDS.map((id) => LINES[id].minLevel)) && !brandFame(state)) return [];
  const box = el('div', 'ui-box');
  box.append(el('b', '', `🏷 ${t('lines.title')}`), el('div', 'ui-muted', t('lines.note')));
  const fame = brandFame(state);
  if (fame) box.append(el('div', 'ui-note', t('lines.fame', { n: fame, p: Math.round(fame * FAME_STEP * 100) })));
  for (const id of LINE_IDS) {
    const line = LINES[id];
    const tier = lineTier(state, id);
    const lock = lineLock(state, id);
    const cost = nextLineCost(state, id);
    const row = el('div', 'ui-item');
    const img = el('img');
    img.src = sheetPng(`line_${id}`);
    img.alt = '';
    img.style.cssText = `width: 34px; height: 40px; object-fit: contain; image-rendering: pixelated;${lock && !tier ? ' filter: grayscale(0.8) opacity(0.6);' : ''}`;
    const body = el('div');
    const name = el('div', 'ui-item-name', `${line.icon} ${t(line.nameKey)}`);
    if (tier) name.append(el('span', 'ui-tag', t('lines.tier', { n: tier, max: LINE_MAX })));
    body.append(name, el('div', 'ui-item-sub', t(`lines.${id}.desc`)));
    if (lock && !tier) {
      body.append(el('div', 'ui-item-sub', `🔒 ${lock === 'level' ? t('lines.lock.level', { name: t(STORE_LEVELS[line.minLevel].nameKey) }) : t('lines.lock.kitchen')}`));
    } else {
      const price = PRODUCTS[line.product].basePrice;
      body.append(el('div', 'ui-item-sub', `${recipe(state, id)} · ${t('lines.price', { cost: lineUnitCost(id), price })}`));
      if (tier) body.append(el('div', 'ui-item-sub', t('lines.stock', { n: lineStock(state, id) })));
      const why = tier ? idle(state, id) : '';
      if (why) {
        const note = el('div', 'ui-item-sub', `⚠️ ${why}`);
        note.style.color = '#b13e53';
        body.append(note);
      }
    }
    // Кнопка — под текстом, а не столбиком справа: описание тогда во всю ширину строки.
    const actions = el('div', 'ui-chips');
    if (cost === null) actions.append(el('span', 'ui-tag', t('lines.max')));
    else if (!lock) {
      actions.append(
        button(
          t(tier ? 'lines.up' : 'lines.open', { cost }),
          () => {
            const bought = buyLineTier(getState(), id);
            if (!bought) return;
            track('line', bought.day, LINE_IDS.indexOf(id) * 10 + lineTier(bought, id));
            toast('assets/ico_shop.png', t('lines.bought'), t(tier ? 'lines.upText' : 'lines.boughtText', { name: t(line.nameKey), n: lineTier(bought, id) }));
            update(bought, 'success');
          },
          'ui-chip',
          state.money < cost,
        ),
      );
    }
    body.append(actions);
    row.append(img, body);
    box.append(row);
  }
  return [box];
}
