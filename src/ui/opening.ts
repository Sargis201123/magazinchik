// Открытие магазина в начале новой игры (scenes/newcomer.ts grandOpening): бабушка спрашивает, как назовём
// магазин, — поле и четыре подсказки одним касанием. Название сразу горит на вывеске; дальше — ленточка у входа.

import { t, type TextKey } from '../i18n';
import { png } from '../platform/assets';
import { sound } from '../platform/sound';
import { button, el, injectStyles, openModal } from './dom';

/** Сколько букв влезает на вывеску (как в «Названии магазина» в профиле). */
export const OPENING_NAME_MAX = 16;
const IDEAS: TextKey[] = ['opening.idea1', 'opening.idea2', 'opening.idea3', 'opening.idea4'];

const css = `
.ui-opening { text-align: center; }
.ui-opening .face { width: 72px; height: 72px; image-rendering: pixelated; border: 3px solid #2b2233; border-radius: 10px; background: #f6e7c8; }
.ui-opening h2 { margin: 6px 0 4px; }
.ui-opening p { margin: 0 0 10px; }
.ui-opening input { width: 100%; box-sizing: border-box; font: 800 20px/1.2 inherit; text-align: center; padding: 10px; border: 3px solid #2b2233;
  border-radius: 10px; background: #fffbe8; color: #2b2233; }
.ui-opening .ideas { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin: 10px 0 12px; }
`;
let styled = false;

/** Окно «Как назовём магазин?». onDone(name) — пустое имя: оставить название по помещению. */
export function askShopName(onDone: (name: string) => void): void {
  injectStyles();
  if (!styled) {
    styled = true;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);
  }
  const { card, close } = openModal();
  card.classList.add('ui-opening');
  const face = el('img', 'face');
  face.src = png('portrait_grandma_happy');
  face.alt = '';
  const input = document.createElement('input');
  input.maxLength = OPENING_NAME_MAX;
  input.placeholder = t('opening.placeholder');
  input.autocomplete = 'off';
  const ideas = el('div', 'ideas');
  for (const key of IDEAS) {
    const name = t(key);
    ideas.append(button(name, () => {
      input.value = name.slice(0, OPENING_NAME_MAX);
      sound.pop(1);
    }, 'ui-chip'));
  }
  const go = button(t('opening.go'), () => {
    close();
    onDone(input.value.trim().slice(0, OPENING_NAME_MAX));
  }, 'ui-btn ui-pulse');
  card.append(face, el('h2', '', t('opening.title')), el('p', '', t('opening.ask')), input, ideas, go);
}
