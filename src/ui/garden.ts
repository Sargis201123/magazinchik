// «Бабушкин двор» в меню (game/garden.ts): раздел «Развития» — поставить теплицу, грядки (что растёт, сколько осталось,
// сменить культуру, вскопать ещё одну), собрать; и общий сбор урожая с тостом — его же зовёт строка в «Главном на сегодня».

import { t, type TextKey } from '../i18n';
import { PRODUCTS, type StoreState } from '../game/economy';
import { addBed, bedLeft, bedRipe, bedsOf, buildGarden, CROP_IDS, cropQty, CROPS, GARDEN_PRICE, gardenRipe, gardenVisible, harvest, hasGarden, nextBedCost, ownJam, plant, type CropId } from '../game/garden';
import { track } from '../platform/analytics';
import { button, el, toast } from './dom';

type Update = (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void;

const cropName = (crop: CropId): string => t(`garden.crop.${crop}` as TextKey);
/** Что даст грядка: «🍎×12 🥔×12». */
const gives = (state: StoreState, crop: CropId): string => CROPS[crop].gives.map((id) => `${PRODUCTS[id].icon}×${cropQty(state, crop)}`).join(' ');

/** Собрать урожай из меню: тост со списком; прилавок полон — тост об этом. */
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
  if (gardenRipe(state, now)) box.append(button(t('garden.harvest'), () => harvestNow(getState, update), 'ui-btn secondary'));
  // Грядки: что растёт и сколько осталось; под строкой — на что пересадить (рассада сажается заново).
  bedsOf(state).forEach((bed, i) => {
    const row = el('div', 'ui-item');
    const icon = el('div', '', CROPS[bed.crop].icon);
    icon.style.cssText = 'width: 34px; font-size: 24px; text-align: center;';
    const body = el('div');
    const minutes = Math.ceil(bedLeft(bed, now) / 60_000);
    body.append(
      el('div', 'ui-item-name', `${t('garden.bed', { n: i + 1 })} · ${cropName(bed.crop)}`),
      el('div', 'ui-item-sub', bedRipe(bed, now) ? t('garden.bedRipe', { list: gives(state, bed.crop) }) : `${t('garden.left', { h: Math.floor(minutes / 60), m: minutes % 60 })} · ${gives(state, bed.crop)}`),
    );
    const chips = el('div', 'ui-chips');
    chips.style.marginTop = '4px';
    for (const crop of CROP_IDS) {
      const chip = button(
        `${CROPS[crop].icon} ${t('garden.hours', { n: CROPS[crop].hours })}`,
        () => {
          const next = plant(getState(), i, crop, Date.now());
          if (!next) return;
          track('garden_plant', next.day, CROP_IDS.indexOf(crop));
          toast('assets/ico_shop.png', t('garden.title'), t('garden.planted', { name: cropName(crop) }));
          update(next, 'tap');
        },
        `ui-chip${crop === bed.crop ? ' active' : ''}`,
        crop === bed.crop,
      );
      chip.title = `${cropName(crop)} — ${gives(state, crop)}`;
      chips.append(chip);
    }
    body.append(chips);
    row.append(icon, body, el('div'));
    box.append(row);
  });
  const cost = nextBedCost(state);
  if (cost !== null)
    box.append(
      button(
        t('garden.addBed', { n: `${cost} 💰` }),
        () => {
          const next = addBed(getState(), Date.now());
          if (!next) return;
          track('garden_bed', next.day, cost);
          toast('assets/ico_shop.png', t('garden.bedAdded'), t('garden.bedAddedText'));
          update(next, 'success');
        },
        'ui-btn secondary',
        state.money < cost,
      ),
    );
  if (ownJam(state)) box.append(el('div', 'ui-note', t('garden.ownJam')));
  const notes: string[] = [];
  if (state.garden?.harvests) notes.push(t('garden.count', { n: state.garden.harvests }));
  if (state.garden?.watered) notes.push(t('garden.watered', { n: state.garden.watered }));
  if (notes.length) box.append(el('div', 'ui-muted', notes.join(' · ')));
  return [box];
}
