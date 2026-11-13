// Окно выбора: заголовок, пояснение и две кнопки (особые гости, напоминания перед открытием).

import { button, el, openModal } from './dom';

export interface ChoiceOptions {
  title: string;
  text: string;
  note?: string;
  yes: string;
  no: string;
  /** Верный ответ — «нет» (подросток за пивом): тогда отказ — главной кнопкой и первым. */
  primaryNo?: boolean;
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
  const yes = button(o.yes, answer(o.onYes), o.primaryNo ? 'ui-btn secondary' : undefined);
  const no = button(o.no, answer(o.onNo), o.primaryNo ? undefined : 'ui-btn secondary');
  card.append(el('h2', '', o.title), el('p', '', o.text), ...(o.note ? [el('div', 'ui-muted', o.note)] : []), ...(o.primaryNo ? [no, yes] : [yes, no]));
  return () => {
    if (done) return;
    done = true;
    close();
  };
}
