// Окно выбора для особого гостя: кто пришёл, чего хочет и две кнопки.

import { button, el, openModal } from './dom';

export interface ChoiceOptions {
  title: string;
  text: string;
  note?: string;
  yes: string;
  no: string;
  onYes: () => void;
  onNo: () => void;
}

/** Показывает выбор; возвращает функцию, которая закроет окно без ответа. */
export function showChoice(o: ChoiceOptions): () => void {
  const { card, close } = openModal();
  let done = false;
  const answer = (fn: () => void) => () => {
    if (done) return;
    done = true;
    close();
    fn();
  };
  card.append(
    el('h2', '', o.title),
    el('p', '', o.text),
    ...(o.note ? [el('div', 'ui-muted', o.note)] : []),
    button(o.yes, answer(o.onYes)),
    button(o.no, answer(o.onNo), 'ui-btn secondary'),
  );
  return () => {
    if (done) return;
    done = true;
    close();
  };
}
