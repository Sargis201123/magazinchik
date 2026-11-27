// «Бабушкин двор» в меню (game/garden.ts): раздел «Развития» - поставить теплицу, грядки и сколько каждая приносит
// за вечер, вскопать ещё одну, вчера и всего. Собирать ничего не надо (27.11): деньги приходят сами каждый вечер.

import { t, type TextKey } from '../i18n';
import type { StoreState } from '../game/economy';
import { addBed, BED_CROPS, bedCount, bedIncome, buildGarden, CROP_ICON, GARDEN_PRICE, gardenVisible, hasGarden, nextBedCost, ownJam, yardIncome, yardLog } from '../game/garden';
import { track } from '../platform/analytics';
import { button, el, toast } from './dom';

type Update = (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void;

/** Строка свёрнутого раздела в «Развитии»: сколько грядок и сколько двор приносит за вечер. */
export const gardenSummary = (state: StoreState): string => t('garden.fold', { n: bedCount(state), sum: yardIncome(state) });

export function gardenBox(state: StoreState, getState: () => StoreState, update: Update): HTMLElement[] {
  if (!gardenVisible(state)) return [];
  const box = el('div', 'ui-box');
  box.append(el('b', '', `🌱 ${t('garden.title')}`), el('div', 'ui-muted', t('garden.note')));
  const perBed = t('garden.perBed', { n: bedIncome(state) });
  if (!hasGarden(state)) {
    box.append(
      button(
        t('garden.build', { n: `${GARDEN_PRICE} 💰` }),
        () => {
          const next = buildGarden(getState());
          if (!next) return;
          track('garden_build', next.day, GARDEN_PRICE);
          toast('assets/ico_shop.png', t('garden.built'), t('garden.builtText', { n: bedIncome(next) }));
          update(next, 'success');
        },
        'ui-btn secondary',
        state.money < GARDEN_PRICE,
      ),
      el('div', 'ui-item-sub', perBed),
    );
    return [box];
  }
  // Грядки: что растёт и сколько приносит каждая за вечер.
  for (let i = 0; i < bedCount(state); i++) {
    const crop = BED_CROPS[i];
    const row = el('div', 'ui-item');
    const icon = el('div', '', CROP_ICON[crop]);
    icon.style.cssText = 'width: 34px; font-size: 24px; text-align: center;';
    const body = el('div');
    body.append(el('div', 'ui-item-name', `${t('garden.bed', { n: i + 1 })} · ${t(`garden.crop.${crop}` as TextKey)}`), el('div', 'ui-item-sub', perBed));
    row.append(icon, body, el('div'));
    box.append(row);
  }
  const cost = nextBedCost(state);
  if (cost !== null)
    box.append(
      button(
        t('garden.addBed', { n: `${cost} 💰` }),
        () => {
          const next = addBed(getState());
          if (!next) return;
          track('garden_bed', next.day, cost);
          toast('assets/ico_shop.png', t('garden.bedAdded'), t('garden.bedAddedText', { n: bedIncome(next) }));
          update(next, 'success');
        },
        'ui-btn secondary',
        state.money < cost,
      ),
    );
  if (ownJam(state)) box.append(el('div', 'ui-note', t('garden.ownJam')));
  const log = yardLog(state);
  if (log) box.append(el('div', 'ui-muted', t('garden.income', log)));
  return [box];
}
