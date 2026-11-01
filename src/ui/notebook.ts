// «Бабушкина тетрадь» (game/notebook.ts): маленькая страница в клетку — над репликой сюжета
// (одна строчка, которая сейчас открылась) и целиком по кнопке из профиля или из письма.
// Слева её долги, справа — кому давала сама, зачёркнуто «не брать»; в конце вырванная страница
// и чистая — для Сони. Бумага рисуется CSS (клетка, поля, рваный край), рукописный шрифт не нужен.

import { t } from '../i18n';
import type { StoreState } from '../game/economy';
import { hasNotebook, notebookLines, type NotebookLine, type PageId } from '../game/notebook';
import { button, el, injectStyles, openModal, UI_FONT } from './dom';
import { sound } from '../platform/sound';
import { haptic } from '../platform/telegram';
import { track } from '../platform/analytics';

const css = `
.ui-nb-page { position: relative; margin: 4px auto 8px; max-width: 300px; padding: 10px 12px 12px 30px; text-align: left;
  background-color: #fbf3dc; background-image: linear-gradient(#e3d6b4 1px, transparent 1px), linear-gradient(90deg, #e3d6b4 1px, transparent 1px);
  background-size: 8px 8px; border: 2px solid #2b2233; border-radius: 3px; box-shadow: 0 3px 0 rgba(43, 34, 51, .3);
  font: 700 14px/1.45 ${UI_FONT}; color: #3a4466; image-rendering: pixelated; }
.ui-nb-page::before { content: ''; position: absolute; left: 20px; top: 0; bottom: 0; width: 2px; background: #e4a6a0; }
.ui-nb-page.torn { border-top-style: dashed; clip-path: polygon(0 6px, 6% 0, 12% 6px, 19% 1px, 26% 6px, 33% 0, 40% 5px, 47% 1px, 54% 6px, 61% 0, 68% 5px,
  75% 1px, 82% 6px, 89% 0, 95% 5px, 100% 1px, 100% 100%, 0 100%); padding-top: 16px; }
.ui-nb-head { font: 800 11px/1.2 ${UI_FONT}; color: #b86f50; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }
.ui-nb-line { position: relative; padding: 1px 0; }
.ui-nb-line.crossed span { text-decoration: line-through; text-decoration-color: #b86f50; text-decoration-thickness: 2px; }
.ui-nb-line i { display: inline-block; margin-left: 6px; padding: 0 4px; font: italic 800 11px/1.4 ${UI_FONT}; color: #e43b44;
  border: 1px solid #e43b44; border-radius: 3px; transform: rotate(-4deg); }
.ui-nb-line.fresh { animation: ui-nb-ink .9s ease-out; }
@keyframes ui-nb-ink { from { opacity: 0; transform: translateY(3px); } }
.ui-nb-sides { display: grid; grid-template-columns: 1fr; gap: 8px; }
.ui-nb-modal .ui-nb-page { max-width: none; }
@media (prefers-reduced-motion: reduce) { .ui-nb-line.fresh { animation: none; } }
`;

let styled = false;
function styles(): void {
  injectStyles();
  if (styled) return;
  styled = true;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
}

function lineEl(line: NotebookLine, fresh = false): HTMLElement {
  const row = el('div', `ui-nb-line${line.crossed ? ' crossed' : ''}${fresh ? ' fresh' : ''}`);
  row.append(el('span', '', t(line.key)));
  if (line.note) row.append(el('i', '', t(line.note)));
  return row;
}

/** Страница с одной строчкой — над репликой сюжета, когда она открылась. Строчки ещё нет — null. */
export function notebookPage(state: StoreState, id: PageId): HTMLElement | null {
  styles();
  const line = notebookLines(state).find((l) => l.id === id);
  if (!line) return null;
  const page = el('div', `ui-nb-page${id === 'torn' ? ' torn' : ''}`);
  page.append(el('div', 'ui-nb-head', t(id === 'debts' ? 'nb.left' : line.side === 'right' ? 'nb.right' : 'nb.title')), lineEl(line, true));
  return page;
}

/**
 * Страница сюжетной реплики, которая только что открылась: в сцене главы она открывается в момент,
 * когда игрок её читает, а state — ещё до награды главы. Показываем строчку как будет после.
 */
export function storyPage(state: StoreState, id: PageId): HTMLElement | null {
  const ahead: StoreState = { ...state, story: { ...state.story, chapter: state.story.chapter + 1 } };
  return notebookPage(notebookLines(state).some((l) => l.id === id) ? state : ahead, id);
}

/** Тетрадь целиком: две половины, вырванная страница и чистая. */
export function openNotebook(state: StoreState): void {
  styles();
  haptic.tap();
  sound.pop(0);
  track('notebook_open', state.day);
  const { card, close } = openModal();
  card.classList.add('ui-nb-modal');
  const lines = notebookLines(state);
  const half = (side: NotebookLine['side'], head: Parameters<typeof t>[0]) => {
    const page = el('div', 'ui-nb-page');
    page.append(el('div', 'ui-nb-head', t(head)), ...lines.filter((l) => l.side === side).map((l) => lineEl(l)));
    return page;
  };
  const sides = el('div', 'ui-nb-sides');
  sides.append(half('left', 'nb.left'), half('right', 'nb.right'));
  for (const l of lines.filter((x) => x.side === 'page')) {
    const page = el('div', `ui-nb-page${l.id === 'torn' ? ' torn' : ''}`);
    page.append(lineEl(l));
    sides.append(page);
  }
  card.append(el('h2', '', `📓 ${t('nb.title')}`), el('div', 'ui-muted', t('nb.sub')), sides, button(t('nb.close'), close));
}

/** Вход в тетрадь (сейчас — в профиле рядом с достижениями; его легко перенести в «Трофеи»). */
export function notebookButton(state: StoreState): HTMLButtonElement[] {
  if (!hasNotebook(state)) return [];
  return [button(`📓 ${t('nb.title')}`, () => openNotebook(state), 'ui-btn secondary')];
}
