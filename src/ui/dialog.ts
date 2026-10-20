// Диалог как в RPG: большой портрет с эмоцией, табличка с именем, речевое облако.
// Текст печатается по буквам с «голосом» героя; касание — дописать сразу.

import { sound } from '../platform/sound';
import { button, el } from './dom';

export interface DialogOptions {
  /** Над диалогом: глава и её название. */
  caption?: string;
  /** Иллюстрация сцены над диалогом (если файла нет — просто не показывается). */
  art?: string;
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

/** Глаза портрета (art/sprites.py, face): левый край, верх и низ в сетке 64×64. */
const EYES = [24, 38];
const EYE_TOP = 28;

/**
 * Живой портрет на холсте 64×64: моргает раз в несколько секунд, а пока печатается текст —
 * открывает и закрывает рот. Лицо у всех портретов в одной сетке, цвет век — кожа под глазом.
 */
export function liveFace(src: string, talking: () => boolean, className = 'ui-dialog-face'): HTMLCanvasElement {
  const canvas = el('canvas', className);
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.src = src;
  // Улыбка и удивление — глаза-дужки или широко открытые, рот уже открыт: не трогаем.
  const mood = /_(happy|sad|angry|surprised)$/.exec(src.replace(/\.png$/, ''))?.[1];
  let lids: string[] = [];
  let blinkUntil = 0;
  let nextBlink = performance.now() + 1200 + Math.random() * 1500;
  const draw = (now: number) => {
    if (!ctx || !img.complete || !img.naturalWidth) return;
    ctx.clearRect(0, 0, 64, 64);
    ctx.drawImage(img, 0, 0, 64, 64);
    if (mood !== 'happy' && now < blinkUntil) {
      EYES.forEach((x, i) => {
        ctx.fillStyle = lids[i] ?? '#f2d3ab';
        ctx.fillRect(x, EYE_TOP - 1, 4, 5);
        ctx.fillStyle = '#181425';
        ctx.fillRect(x, 31, 4, 1);
      });
    }
    // Рот: каждые 120 мс то открыт, то закрыт.
    if (talking() && mood !== 'happy' && mood !== 'surprised' && Math.floor(now / 120) % 2 === 0) {
      ctx.fillStyle = '#181425';
      ctx.fillRect(30, 38, 5, 3);
      ctx.fillStyle = '#7a2a35';
      ctx.fillRect(31, 39, 3, 1);
    }
  };
  img.addEventListener('load', () => {
    if (!ctx) return;
    // Цвет кожи у каждого глаза: под глазом, над бровью или сбоку (борода, очки — пропускаем).
    const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (probe) {
      probe.canvas.width = 64;
      probe.canvas.height = 64;
      probe.drawImage(img, 0, 0);
      lids = EYES.map((x) => {
        for (const [px, py] of [[x + 1, 34], [x + 1, 26], [x - 2, 30]]) {
          const [r, g, b] = probe.getImageData(px, py, 1, 1).data;
          if (r - b > 40) return `rgb(${r},${g},${b})`;
        }
        return '#f2d3ab';
      });
    }
    draw(performance.now());
  });
  // Крутится, пока портрет на экране; окно закрыли (или так и не показали) — останавливается.
  const born = performance.now();
  let shown = false;
  const tick = (now: number) => {
    if (canvas.isConnected) shown = true;
    else if (shown || now - born > 5000) return;
    if (now > nextBlink) {
      blinkUntil = now + 130;
      // Иногда моргает дважды подряд.
      nextBlink = now + (Math.random() < 0.2 ? 260 : 2200 + Math.random() * 2600);
    }
    draw(now);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return canvas;
}

export function dialogBox(o: DialogOptions): HTMLElement {
  const box = el('div', 'ui-dialog');
  if (o.caption) box.append(el('div', 'ui-muted', o.caption));
  if (o.art) {
    const art = el('img', 'ui-dialog-art');
    art.src = o.art;
    art.alt = '';
    art.addEventListener('error', () => art.remove());
    box.append(art);
  }
  const row = el('div', 'ui-dialog-row');
  const face = liveFace(`assets/${o.portrait}.png`, () => !done);
  face.classList.add('talking');
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
  // Сколько букв показать — по прошедшему времени: на загруженном телефоне таймер тикает реже,
  // а текст всё равно печатается с той же скоростью.
  const start = performance.now();
  const timer = setInterval(() => {
    if (!box.isConnected && shown > 0) {
      clearInterval(timer);
      return;
    }
    const target = Math.min(chars.length, Math.max(shown + 1, Math.floor((performance.now() - start) / CHAR_MS)));
    // Пищит не чаще раза за тик и только на букве (на пробелах и знаках — тишина).
    if (target - shown >= 1 && /[\p{L}\p{N}]/u.test(chars[target - 1] ?? '') && target % 2 === 0) sound.voice(o.pitch);
    shown = target;
    text.textContent = chars.slice(0, shown).join('');
    if (shown >= chars.length) finish();
  }, CHAR_MS);
  speech.addEventListener('click', finish);
  face.addEventListener('click', finish);
  return box;
}
