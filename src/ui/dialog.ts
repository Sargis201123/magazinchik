// Диалог как в RPG: большой портрет с эмоцией, табличка с именем, речевое облако.
// Текст печатается по буквам с «голосом» героя; касание — дописать сразу.

import { sound } from '../platform/sound';
import { button, el } from './dom';

export interface DialogOptions {
  /** Над диалогом: глава и её название. */
  caption?: string;
  /** Имя картинки портрета без assets/ и .png (portrait_grandma_happy). */
  portrait: string;
  name: string;
  text: string;
  /** Высота «голоса» в герцах: у бабушки выше, у Эдуарда ниже. */
  pitch: number;
  /** Что появится, когда текст допечатан (цель главы, награда). */
  after?: HTMLElement[];
  nextLabel: string;
  onNext: () => void;
}

const CHAR_MS = 26;

export function dialogBox(o: DialogOptions): HTMLElement {
  const box = el('div', 'ui-dialog');
  if (o.caption) box.append(el('div', 'ui-muted', o.caption));
  const row = el('div', 'ui-dialog-row');
  const face = el('img', 'ui-dialog-face talking');
  face.src = `assets/${o.portrait}.png`;
  face.alt = '';
  const speech = el('div', 'ui-dialog-speech');
  const name = el('div', 'ui-dialog-name', o.name);
  const text = el('p', 'ui-dialog-text');
  const caret = el('span', 'ui-dialog-caret', '▼');
  speech.append(name, text);
  row.append(face, speech);
  const after = el('div', 'ui-dialog-after');
  after.append(...(o.after ?? []));
  const next = button(o.nextLabel, () => {
    if (!done) {
      finish();
      return;
    }
    o.onNext();
  });
  box.append(row, after, next);

  const chars = [...o.text];
  let shown = 0;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearInterval(timer);
    text.textContent = o.text;
    text.append(caret);
    face.classList.remove('talking');
    after.classList.add('shown');
  };
  const timer = setInterval(() => {
    if (!box.isConnected && shown > 0) {
      clearInterval(timer);
      return;
    }
    shown++;
    text.textContent = chars.slice(0, shown).join('');
    // Пищит каждая вторая буква, на пробелах и знаках — тишина.
    if (shown % 2 === 0 && /[\p{L}\p{N}]/u.test(chars[shown - 1] ?? '')) sound.voice(o.pitch);
    if (shown >= chars.length) finish();
  }, CHAR_MS);
  speech.addEventListener('click', finish);
  face.addEventListener('click', finish);
  return box;
}
