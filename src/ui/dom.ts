// Интерфейс поверх canvas делаем на DOM: текст остаётся чётким на любом экране,
// а переводы и вёрстка меню проще, чем внутри Phaser.

/**
 * Шрифт интерфейса и надписей в игре. Пиксельные шрифты пробовали: кириллица и цифры
 * в них читаются плохо («5» похожа на «S»), поэтому — чёткий системный.
 */
export const UI_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const css = `
/* Панели HUD — по ширине игры (холст 9:16), а не всего окна: на компьютере не разъезжаются по краям. */
.ui-hud, .ui-stock, .ui-hint { max-width: min(100vw, 56.25dvh); margin: 0 auto; box-sizing: border-box; }
.ui-hud span { background: rgba(24, 20, 37, .72); padding: 4px 8px; border-radius: 6px; }
.ui-hud { position: fixed; top: 0; left: 0; right: 0; display: flex; justify-content: space-between;
  padding: calc(env(safe-area-inset-top) + 8px) 12px 8px; font: 600 15px/1.2 system-ui, sans-serif;
  color: #fff; text-shadow: 0 1px 0 #000; pointer-events: none; }
.ui-stock { position: fixed; left: 0; right: 0; top: calc(env(safe-area-inset-top) + 32px); display: flex;
  gap: 10px; justify-content: center; font: 13px system-ui, sans-serif; color: #e6e1d6; pointer-events: none; }
.ui-hint { position: fixed; left: 0; right: 0; padding: 0 12px; bottom: calc(env(safe-area-inset-bottom) + 12px);
  text-align: center; font: 13px system-ui, sans-serif; color: #e6e1d6; pointer-events: none; }
.ui-modal { position: fixed; inset: 0; background: rgba(15, 12, 22, .78); display: flex; align-items: center;
  justify-content: center; padding: 16px; overflow-y: auto; }
.ui-card { background: #f4ecd8; color: #2b2233; border: 3px solid #2b2233; border-radius: 6px; padding: 14px;
  max-width: 360px; width: 100%; max-height: calc(100dvh - 32px); overflow-y: auto; box-sizing: border-box;
  font: 15px/1.4 system-ui, sans-serif; box-shadow: 0 4px 0 #2b2233; }
.ui-card h2 { margin: 0 0 10px; font-size: 18px; display: flex; justify-content: space-between; }
.ui-card h3 { margin: 14px 0 6px; font-size: 15px; }
.ui-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 4px 0; }
.ui-muted { color: #7a7066; font-size: 13px; }
.ui-quote { font-style: italic; font-size: 13px; margin: 2px 0 6px; }
.ui-box { border: 2px solid #2b2233; border-radius: 6px; padding: 8px; margin: 6px 0; background: #fbf6ea; }
.ui-btn { display: block; width: 100%; margin-top: 10px; padding: 12px; font: 600 15px system-ui, sans-serif;
  border: 3px solid #2b2233; border-radius: 6px; background: #8fd16a; color: #2b2233; box-shadow: 0 3px 0 #2b2233; }
.ui-btn:active, .ui-chip:active { transform: translateY(2px); box-shadow: 0 1px 0 #2b2233; }
.ui-btn.secondary { background: #f2c14e; }
.ui-btn[disabled], .ui-chip[disabled] { background: #c9c0ad; color: #7a7066; }
.ui-chip { padding: 5px 9px; font: 600 13px system-ui, sans-serif; border: 2px solid #2b2233; border-radius: 6px;
  background: #f2c14e; color: #2b2233; box-shadow: 0 2px 0 #2b2233; min-width: 34px; }
.ui-chip.active { background: #2b2233; color: #f4ecd8; }
.ui-chips { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.ui-tabs { display: flex; gap: 4px; margin: 8px 0 6px; }
.ui-tab { flex: 1; padding: 8px 1px; font: 600 12px system-ui, sans-serif; border: 2px solid #2b2233;
  border-radius: 6px; background: #e6dcc4; color: #2b2233; }
.ui-tab.active { background: #2b2233; color: #f4ecd8; }
.ui-note { font-size: 13px; color: #5a5048; margin: 4px 0 8px; }
`;

let styled = false;
export function injectStyles(): void {
  if (styled) return;
  styled = true;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function button(
  label: string,
  onClick: () => void,
  className = 'ui-btn',
  disabled = false,
): HTMLButtonElement {
  const btn = el('button', className, label);
  btn.disabled = disabled;
  btn.addEventListener('click', onClick);
  return btn;
}

/** Открывает модальное окно. Возвращает карточку и функцию закрытия. */
export function openModal(): { card: HTMLDivElement; close: () => void } {
  injectStyles();
  const overlay = el('div', 'ui-modal');
  const card = el('div', 'ui-card');
  overlay.append(card);
  document.body.append(overlay);
  return { card, close: () => overlay.remove() };
}
