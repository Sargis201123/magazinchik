// «Бабушкина теплица» в меню (game/garden.ts): раздел «Развития» — поставить, сколько осталось расти, собрать;
// и общий сбор урожая с тостом — его же зовёт строка в «Главном на сегодня».

import { t } from '../i18n';
import { PRODUCTS, type StoreState } from '../game/economy';
import { buildGarden, GARDEN_PRICE, gardenLeft, gardenRipe, gardenVisible, harvest, hasGarden } from '../game/garden';
import { track } from '../platform/analytics';
import { button, el, toast } from './dom';

type Update = (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void;

/** Собрать урожай из меню: тост со списком; склад полон — тост об этом. */
export function harvestNow(getState: () => StoreState, update: Update): void {
  const done = harvest(getState(), Date.now());
  if (!done) {
    toast('assets/ico_shop.png', t('garden.title'), t('garden.noRoom'));
    return;
  }
  track('garden', done.state.day, done.state.garden?.harvests);
  toast('assets/ico_shop.png', t('garden.title'), t('garden.got', { list: done.got.map(({ id, qty }) => `${PRODUCTS[id].icon}×${qty}`).join(' ') }));
  update(done.state, 'success');
}

export function gardenBox(state: StoreState, getState: () => StoreState, update: Update): HTMLElement[] {
  if (!gardenVisible(state)) return [];
  const box = el('div', 'ui-box');
  box.append(el('b', '', `🌱 ${t('garden.title')}`), el('div', 'ui-muted', t('garden.note')));
  const now = Date.now();
  if (!hasGarden(state)) {
    box.append(
      button(
        t('garden.build', { n: `${GARDEN_PRICE} 💰` }),
        () => {
          const next = buildGarden(getState(), Date.now());
          if (!next) return;
          track('garden_build', next.day, GARDEN_PRICE);
          toast('assets/ico_shop.png', t('garden.built'), t('garden.builtText'));
          update(next, 'success');
        },
        'ui-btn secondary',
        state.money < GARDEN_PRICE,
      ),
    );
    return [box];
  }
  if (gardenRipe(state, now)) box.append(el('div', '', t('garden.ripe')), button(t('garden.harvest'), () => harvestNow(getState, update), 'ui-btn secondary'));
  else {
    const minutes = Math.ceil(gardenLeft(state, now) / 60_000);
    box.append(el('div', '', t('garden.left', { h: Math.floor(minutes / 60), m: minutes % 60 })));
  }
  if (state.garden?.harvests) box.append(el('div', 'ui-muted', t('garden.count', { n: state.garden.harvests })));
  return [box];
}
