// Раздел «Питомцы» во вкладке «Развитие», рядом с оформлением за звёзды (game/pets.ts): шесть зверей с
// картинкой и характером. Чужого — посмотреть вживую (окно с живым превью) и купить за ⭐; своего — позвать
// в зал, убрать или дать имя. В зале одновременно один. Оплата — тем же счётом, что и премиальное
// оформление (platform/stars.ts); питомец сразу дома, сервер подтвердит покупку при следующем запуске.

import { t, type TextKey } from '../i18n';
import type { StoreState } from '../game/economy';
import { flushCloud } from '../game/save';
import { activePet, grantPets, ownsPet, PET_IDS, PET_NAME_MAX, petDefaultKey, petItem, petNameKey, PETS, renamePet, setActivePet, type PetId } from '../game/pets';
import { buyWithStars, starsAvailable } from '../platform/stars';
import { haptic } from '../platform/telegram';
import { button, el, openModal } from './dom';
import { sheetPng } from './sheet';

type Update = (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void;

/** Кадры живого превью: покой и радость по очереди. */
const PREVIEW: Record<PetId, string[]> = {
  parrot: ['pet_parrot_0', 'pet_parrot_1', 'pet_parrot_talk', 'pet_parrot_0', 'pet_parrot_happy'],
  hamster: ['pet_hamster_run0', 'pet_hamster_run1', 'pet_hamster_run2', 'pet_hamster_run0', 'pet_hamster_run1', 'pet_hamster_run2', 'pet_hamster_0', 'pet_hamster_0'],
  corgi: ['pet_corgi_0', 'pet_corgi_1', 'pet_corgi_up', 'pet_corgi_wag0', 'pet_corgi_wag1', 'pet_corgi_wag0', 'pet_corgi_wag1'],
  turtle: ['pet_turtle_0', 'pet_turtle_walk0', 'pet_turtle_walk1', 'pet_turtle_walk0', 'pet_turtle_walk1', 'pet_turtle_sleep'],
  bunny: ['pet_bunny_0', 'pet_bunny_1', 'pet_bunny_0', 'pet_bunny_hop', 'pet_bunny_0', 'pet_bunny_sleep'],
  raccoon: ['pet_raccoon_0', 'pet_raccoon_1', 'pet_raccoon_0', 'pet_raccoon_wave', 'pet_raccoon_0', 'pet_raccoon_sleep'],
};
const PREVIEW_MS = 380;

const petTitle = (id: PetId): string => `${PETS[id].icon} ${t(petNameKey(id))}`;
const shownName = (state: StoreState, id: PetId): string => state.pets?.names?.[id] ?? t(petDefaultKey(id));

/** Картинка питомца; big — крупно и с живыми кадрами (сама останавливается, когда окно закрыли). */
function petArt(id: PetId, big = false): HTMLImageElement {
  const img = el('img', big ? 'ui-pet-art big' : 'ui-item-art');
  img.src = sheetPng(`pet_${id}_0`);
  img.alt = '';
  img.style.imageRendering = 'pixelated';
  if (big) {
    img.style.cssText += ';display:block;margin:6px auto;height:96px;width:auto;object-fit:contain';
    let i = 0;
    const timer = setInterval(() => {
      if (!img.isConnected && i > 0) {
        clearInterval(timer);
        return;
      }
      i++;
      img.src = sheetPng(PREVIEW[id][i % PREVIEW[id].length]);
    }, PREVIEW_MS);
  } else img.style.objectFit = 'contain';
  return img;
}

/** Раздел «Питомцы»: список, кто в зале, купить / позвать / назвать. */
export function petsBox(state: StoreState, getState: () => StoreState, update: Update): HTMLElement[] {
  const box = el('div', 'ui-box');
  box.append(el('b', '', `🐾 ${t('pets.title')}`), el('div', 'ui-muted', t('pets.note')));
  const active = activePet(state)?.id;
  for (const id of PET_IDS) {
    const owned = ownsPet(state, id);
    const row = el('div', 'ui-item');
    const body = el('div');
    const name = el('div', 'ui-item-name', petTitle(id));
    if (owned && active === id) name.append(el('span', 'ui-tag', `✓ ${t('pets.here')}`));
    body.append(name, el('div', 'ui-item-sub', owned ? `«${shownName(state, id)}» · ${t(`pets.${id}.about` as TextKey)}` : t(`pets.${id}.about` as TextKey)));
    const actions = el('div', 'ui-item-actions');
    if (!owned) actions.append(button(`⭐ ${PETS[id].stars}`, () => buyModal(id, getState, update), 'ui-chip'));
    else if (active === id) {
      actions.append(
        button(t('pets.rename'), () => nameModal(id, getState, update), 'ui-chip'),
        button(t('pets.away'), () => update(setActivePet(getState(), null)), 'ui-chip'),
      );
    } else actions.append(button(t('pets.call'), () => update(setActivePet(getState(), id), 'success'), 'ui-chip'));
    const art = petArt(id);
    art.addEventListener('click', () => (owned ? nameModal(id, getState, update) : buyModal(id, getState, update)));
    row.append(art, body, actions);
    box.append(row);
  }
  return [box];
}

/** Чужой питомец: живое превью, характер, цена и «Купить» (оплата Telegram Stars). */
function buyModal(id: PetId, getState: () => StoreState, update: Update): void {
  const { card, close } = openModal();
  const note = el('div', 'ui-muted');
  const buy = button(t('decor.buyStars', { n: PETS[id].stars }), () => {
    buy.disabled = true;
    note.textContent = t('decor.paying');
    void buyWithStars(petItem(id)).then((result) => {
      if (result === 'paid') {
        // Оплата прошла — питомец сразу в зале; сервер подтвердит при следующем запуске.
        close();
        update(grantPets(getState(), [petItem(id)]), 'success');
        void flushCloud();
        nameModal(id, getState, update, true);
        return;
      }
      buy.disabled = false;
      note.textContent = t(result === 'unavailable' ? 'decor.starsOff' : result === 'cancelled' ? 'decor.payCancelled' : 'decor.payFailed');
      if (result === 'unavailable') haptic.error();
    });
  }, 'ui-btn ui-btn-stars');
  card.append(
    el('h2', '', t(petNameKey(id))),
    petArt(id, true),
    el('p', '', t(`pets.${id}.about` as TextKey)),
    el('div', 'ui-muted', t(`pets.${id}.life` as TextKey)),
    el('div', 'ui-muted', t('pets.cosmetic')),
    note,
    buy,
    button(t('decor.close'), close, 'ui-btn secondary'),
  );
  if (!starsAvailable()) note.textContent = t('decor.starsOff');
}

/** Имя питомца (как у кота): поле с именем, «Готово». fresh — сразу после покупки, с приветствием. */
function nameModal(id: PetId, getState: () => StoreState, update: Update, fresh = false): void {
  const { card, close } = openModal();
  const input = el('input', 'ui-input');
  // Имя по умолчанию — подсказкой: «Готово» без своего имени оставляет его переводимым (другой язык, друг в гостях).
  input.value = getState().pets?.names?.[id] ?? '';
  input.placeholder = t(petDefaultKey(id));
  input.maxLength = PET_NAME_MAX;
  const done = () => {
    close();
    update(renamePet(getState(), id, input.value));
  };
  input.addEventListener('keydown', (e) => e.key === 'Enter' && done());
  card.append(
    el('h2', '', t(petNameKey(id))),
    petArt(id, true),
    ...(fresh ? [el('p', '', t('pets.welcome'))] : []),
    el('b', '', t('pets.nameAsk')),
    input,
    button(t('pets.nameOk'), done),
    button(t('decor.close'), close, 'ui-btn secondary'),
  );
}
