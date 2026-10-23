// Интерфейс поверх canvas делаем на DOM: текст остаётся чётким на любом экране,
// а переводы и вёрстка меню проще, чем внутри Phaser.

import { assetUrl, png } from '../platform/assets';

/**
 * Шрифт интерфейса и надписей в игре. Пиксельные шрифты пробовали: кириллица и цифры
 * в них читаются плохо («5» похожа на «S»). Системный шрифт на каждом телефоне свой
 * (SF, Roboto, Segoe) — вёрстка «плыла». Поэтому свой округлый Nunito с кириллицей,
 * он входит в сборку (main.ts); системный — только пока он грузится.
 */
export const UI_FONT = '"Nunito Variable", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const css = `
/* Один шрифт везде; цифры одной ширины — суммы и счётчики не «прыгают» и встают ровно в столбик. */
.ui-hud, .ui-stock, .ui-hint, .ui-card, .ui-toast, .ui-curtain { font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility; }
/* Панели HUD — по ширине игры (холст 9:16), а не всего окна: на компьютере не разъезжаются по краям. */
.ui-hud, .ui-stock, .ui-hint { max-width: var(--game-w, min(100vw, 56.25dvh)); margin: 0 auto; box-sizing: border-box; }
.ui-hud span { background: rgba(24, 20, 37, .72); padding: 4px 8px; border-radius: 6px; }
.ui-hud { position: fixed; top: 0; left: 0; right: 0; display: flex; justify-content: space-between;
  padding: calc(var(--safe-top, env(safe-area-inset-top)) + 8px) 12px 8px; font: 600 15px/1.2 ${UI_FONT};
  color: #fff; text-shadow: 0 1px 0 #000; pointer-events: none; }
.ui-stock { position: fixed; left: 0; right: 0; top: calc(var(--safe-top, env(safe-area-inset-top)) + 32px); padding: 0 10px;
  text-align: center; font: 13px/1.5 ${UI_FONT}; color: #e6e1d6; pointer-events: none; }
/* Склад и только кончающиеся на полках товары — плашками. */
.ui-stock { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; }
.ui-stock span { background: rgba(24, 20, 37, .72); padding: 1px 7px; border-radius: 6px; white-space: nowrap; }
.ui-stock .ui-stock-low { color: #fee761; }
.ui-stock .ui-stock-out { color: #fff; background: rgba(228, 59, 68, .85); }
.ui-hint { position: fixed; left: 0; right: 0; padding: 0 12px; bottom: calc(var(--safe-bottom, env(safe-area-inset-bottom)) + 12px);
  text-align: center; font: 13px ${UI_FONT}; color: #e6e1d6; pointer-events: none; }
.ui-modal { position: fixed; inset: 0; background: rgba(15, 12, 22, .78); display: flex; align-items: center;
  justify-content: center; padding: 16px; overflow-y: auto; }
/* Окно в пиксельной рамке (assets/ui_frame.png, 9 частей по 8 пикселей). */
.ui-card { color: #2b2233; border: 16px solid transparent; border-image: url(${png('ui_frame')}) 8 fill / 16px stretch;
  image-rendering: pixelated; padding: 2px 10px; max-width: 372px; width: 100%; max-height: calc(100dvh - 32px);
  overflow-y: auto; box-sizing: border-box; font: 15px/1.4 ${UI_FONT};
  filter: drop-shadow(0 4px 0 rgba(24, 20, 37, .6));
  /* Полоса прокрутки тонкая и в цвет рамки; поля по бокам — чтобы цифры справа не налезали на неё. */
  scrollbar-width: thin; scrollbar-color: #b9a47e transparent; }
/* Пиксельные иконки вместо эмодзи (монета, товары, коробка). */
.ui-ico { height: 1.15em; width: auto; vertical-align: -0.22em; image-rendering: pixelated; }
.ui-portrait { width: 48px; height: 48px; image-rendering: pixelated; border-radius: 6px; flex: none; }
.ui-who { display: flex; align-items: center; gap: 10px; margin: 6px 0; }
.ui-who b, .ui-who h3 { margin: 0; }
.ui-card h2 { margin: 0 0 10px; font-size: 18px; display: flex; justify-content: space-between; }
.ui-card h3 { margin: 14px 0 6px; font-size: 15px; }
.ui-box.ui-rush { background: #2b2233; color: #fee761; border-color: #fee761; }
.ui-rush .ui-muted, .ui-rush .ui-item-sub { color: #e6e1d6; }
.ui-rush .ui-note { color: #fee761; background: rgba(254, 231, 97, .12); }
.ui-box.ui-pass { background: #efe4ff; border-color: #9a6bd8; }
.ui-pass-row { display: grid; grid-template-columns: 48px 1fr 1.4fr; gap: 6px; align-items: center; padding: 4px 0; border-bottom: 1px dashed rgba(43, 34, 51, .15); opacity: .55; }
.ui-pass-row.open { opacity: 1; }
.ui-pass-row .ui-chip { font-size: 12px; padding: 6px 4px; white-space: normal; }
.ui-chip.premium { background: #e6d4ff; }
.ui-box.ui-duel { background: #ffe8e0; border-color: #e4606a; }
.ui-duel-bar { height: 8px; border-radius: 4px; background: #e4606a; overflow: hidden; margin: 4px 0; }
.ui-duel-bar > div { height: 100%; background: #3e8948; }
.ui-me { font-weight: 800; color: #2b2233; }
.ui-box.ui-tale { background: #e8f4ff; border-color: #5fb4f0; }
.ui-tale p { margin: 6px 0 8px; line-height: 1.35; }
.ui-box.ui-goals { background: #fff3b0; border-color: #f7c948; }
.ui-goals .ui-goals-week { display: block; margin-top: 8px; }
.ui-goal-reward { color: #3e8948; white-space: nowrap; }
.ui-goal-bar { height: 6px; border-radius: 3px; background: rgba(43, 34, 51, .12); overflow: hidden; margin: 2px 0 0; }
.ui-goal-bar > div { height: 100%; background: #63c74d; }
.ui-board { display: flex; flex-direction: column; gap: 4px; margin: 4px 0 8px; }
.ui-board-row { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 8px; background: rgba(43, 34, 51, .06); }
.ui-board-row.me { background: #fee761; }
.ui-board-place { width: 26px; text-align: center; font-weight: 800; }
.ui-board-who { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
.ui-board-who b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ui-board-sum { white-space: nowrap; }
.ui-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 4px 0; }
/* В строке «текст — значение» значение (награда, сумма, кнопка) не переносится, длинный текст слева
   спокойно уходит на вторую строку. */
.ui-row > :first-child:not(:last-child) { flex: 1 1 auto; min-width: 0; }
.ui-row > :last-child:not(:first-child) { flex: none; white-space: nowrap; text-align: right; }
/* Длинное текстовое значение (в счетах «платить некому») переносится и не сминает название строки. */
.ui-row > span:last-child:not(:first-child) { flex: 0 1 auto; max-width: 60%; white-space: normal; }
.ui-muted { color: #7a7066; font-size: 13px; }
.ui-quote { font-style: italic; font-size: 13px; margin: 2px 0 6px; }
.ui-box { border: 2px solid #2b2233; border-radius: 6px; padding: 8px; margin: 6px 0; background: #fbf6ea; }
.ui-btn { display: block; width: 100%; margin-top: 10px; padding: 12px; font: 600 15px ${UI_FONT};
  border: 3px solid #2b2233; border-radius: 6px; background: #8fd16a; color: #2b2233; box-shadow: 0 3px 0 #2b2233; }
.ui-btn, .ui-chip, .ui-tab { transition: transform .18s cubic-bezier(.3, 1.8, .5, 1), box-shadow .1s;
  -webkit-tap-highlight-color: transparent; }
.ui-btn:active, .ui-chip:active { transform: translateY(2px) scale(.97); box-shadow: 0 1px 0 #2b2233; transition-duration: .05s; }
.ui-tab:active { transform: scale(.94); transition-duration: .05s; }
/* Окна появляются с лёгким подпрыгиванием и тают при закрытии. */
.ui-modal { animation: ui-fade .18s ease-out; }
.ui-modal .ui-card { animation: ui-pop .3s cubic-bezier(.3, 1.45, .5, 1); }
.ui-modal.closing { animation: none; opacity: 0; transition: opacity .15s; pointer-events: none; }
@keyframes ui-fade { from { opacity: 0; } }
@keyframes ui-pop { from { transform: translateY(14px) scale(.92); opacity: 0; } }
/* Новая вкладка въезжает сбоку. */
.ui-enter { animation: ui-enter .22s ease-out; }
@keyframes ui-enter { from { transform: translateX(14px); opacity: 0; } }
/* Деньги в верхней панели: растут — зелёным, тратятся — красным. */
.ui-money-up { color: #b8f59a; }
.ui-money-down { color: #ff9a9a; }
/* Шторка между днями: роллет опускается, на нём номер дня, и поднимается уже утром. */
.ui-curtain { position: fixed; inset: 0; z-index: 50; transform: translateY(-101%);
  background: repeating-linear-gradient(#9aa8c0 0 11px, #6b7a99 11px 13px, #c0cadc 13px 14px);
  border-bottom: 10px solid #3a4466; box-shadow: 0 6px 0 rgba(24, 20, 37, .5);
  transition: transform .42s cubic-bezier(.55, 0, .35, 1.15); display: flex; align-items: center; justify-content: center; }
.ui-curtain.down { transform: translateY(0); }
.ui-curtain.up { transform: translateY(-101%); transition: transform .5s cubic-bezier(.6, -0.2, .7, 1); }
.ui-curtain-label { font: 800 30px ${UI_FONT}; color: #fee761; background: #2b2233; padding: 10px 22px;
  border: 3px solid #181425; border-radius: 8px; box-shadow: 0 4px 0 #181425; letter-spacing: 1px; }
.ui-btn.secondary { background: #f2c14e; }
.ui-btn.danger { background: #e43b44; color: #fff; }
.ui-closed { text-align: center; }
.ui-closed h2 { justify-content: center; }
.ui-btn[disabled], .ui-chip[disabled] { background: #c9c0ad; color: #7a7066; }
.ui-chip { padding: 5px 9px; font: 600 13px ${UI_FONT}; border: 2px solid #2b2233; border-radius: 6px;
  background: #f2c14e; color: #2b2233; box-shadow: 0 2px 0 #2b2233; min-width: 36px; min-height: 36px; }
.ui-chip.active { background: #2b2233; color: #f4ecd8; }
.ui-chip-off { background: #e6dcc4; color: #7a7066; box-shadow: none; }
.ui-chips { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
/* Шесть вкладок — в две строки по три, чтобы ни одна не обрезалась на узком телефоне. */
.ui-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; margin: 8px 0 6px; }
.ui-tab { flex: 1; padding: 8px 1px; font: 600 12px ${UI_FONT}; border: 2px solid #2b2233;
  border-radius: 6px; background: #e6dcc4; color: #2b2233; }
.ui-tab.active { background: #2b2233; color: #f4ecd8; }
/* На узком телефоне кнопки цены уходят на вторую строку — подпись спроса не сжимается. */
.ui-price { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 6px 8px; margin: 6px 0; border: 2px solid #2b2233;
  border-radius: 6px; background: #fbf6ea; }
.ui-price-icon { width: 30px; height: 36px; image-rendering: pixelated; flex: none; }
.ui-price-info { flex: 1 1 150px; min-width: 0; font-size: 14px; }
.ui-price > .ui-chips { margin-left: auto; }
.ui-price-value { min-width: 54px; text-align: center; }
.ui-price-locked { background: #e6dcc4; filter: grayscale(1); opacity: .7; }
.ui-bar { height: 6px; margin: 4px 0 2px; background: #e6dcc4; border: 1px solid #2b2233; border-radius: 3px; overflow: hidden; }
.ui-bar-fill { height: 100%; }
.ui-hint-tip { color: #2b2233; font-weight: 700; }
.ui-hint.ui-hint-tip { background: #fee761; border: 2px solid #2b2233; border-radius: 8px; padding: 6px 10px;
  width: fit-content; max-width: min(92vw, 52dvh); box-shadow: 0 3px 0 #2b2233; animation: ui-tip 1.2s ease-in-out infinite; }
@keyframes ui-tip { 50% { transform: translateY(-3px); } }
.ui-pulse { animation: ui-pulse 1s ease-in-out infinite; }
@keyframes ui-pulse { 50% { transform: scale(1.12); background: #fee761; } }
.ui-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 6px 0 8px; }
.ui-tile { border: 2px solid #2b2233; border-radius: 6px; background: #fbf6ea; padding: 6px 8px; display: flex;
  flex-direction: column; }
.ui-tile b { font-size: 20px; }
.ui-tile span { font-size: 12px; color: #7a7066; }
.ui-tile.good { background: #e3f5d6; }
.ui-tile.bad { background: #fbe0dc; }
.ui-chart { position: relative; display: flex; align-items: flex-end; gap: 6px; height: 96px; margin: 4px 0 10px; padding: 4px;
  border: 2px solid #2b2233; border-radius: 6px; background: #fbf6ea; }
/* Итоги «по-живому»: столбики вырастают по очереди, по их верхушкам рисуется линия. */
.ui-chart-bar { transform-origin: bottom; animation: ui-grow .5s cubic-bezier(.3, 1.4, .5, 1) both; }
@keyframes ui-grow { from { transform: scaleY(0); } }
.ui-chart-line { position: absolute; inset: 0; pointer-events: none; overflow: visible; }
.ui-chart-line polyline { fill: none; stroke: #b86f50; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round;
  animation: ui-draw .9s ease-in-out .6s both; }
.ui-chart-line circle { fill: #fbf6ea; stroke: #b86f50; stroke-width: 1.5; animation: ui-fade .2s ease-out both; }
@keyframes ui-draw { from { stroke-dashoffset: var(--len); } to { stroke-dashoffset: 0; } }
@keyframes ui-fade { from { opacity: 0; transform: scale(0); } }
.ui-granny { display: flex; align-items: center; gap: 8px; margin: 2px 0 8px; animation: ui-pop .35s cubic-bezier(.3, 1.45, .5, 1) .3s both; }
.ui-granny-face { width: 52px; height: 52px; flex: none; image-rendering: pixelated; border: 2px solid #2b2233; border-radius: 6px; }
.ui-granny p { position: relative; flex: 1; margin: 0; padding: 6px 9px; background: #fff; border: 2px solid #2b2233; border-radius: 8px;
  font-size: 13px; line-height: 1.35; }
.ui-chart-col { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; }
.ui-chart-bar { flex: none; min-height: 4px; width: 100%; background: #8fd16a; border: 2px solid #2b2233; border-bottom: 0; border-radius: 3px 3px 0 0; }
.ui-chart-bar.today { background: #fee761; }
.ui-chart-value { font-size: 10px; color: #5a5048; }
.ui-chart-day { font-size: 10px; color: #7a7066; }
/* Итоги дня: плитки выскакивают по очереди, числа в них докручиваются от нуля (rollNumber). */
.ui-card.ui-sum { overflow-x: hidden; }
.ui-sum-tiles .ui-tile { position: relative; animation: ui-pop .35s cubic-bezier(.3, 1.45, .5, 1) both; }
.ui-sum-tiles .ui-tile b { white-space: nowrap; }
.ui-tile .ui-tile-num { font: inherit; color: inherit; }
.ui-tile .ui-tile-delta { font-weight: 800; }
.ui-tile .ui-tile-delta.up { color: #3e8948; }
.ui-tile .ui-tile-delta.down { color: #c42f3c; }
/* Побитый рекорд — плитка золотая, на угол падает корона. */
.ui-tile.record { background: linear-gradient(#fff7cc, #fee761); box-shadow: 0 0 0 2px #feae34, 0 0 12px rgba(254, 174, 52, .6); }
.ui-tile-crown { position: absolute; top: -11px; right: -7px; width: 28px; height: 28px; image-rendering: pixelated;
  transform: rotate(14deg); animation: ui-crown .45s cubic-bezier(.3, 1.6, .5, 1) both; }
@keyframes ui-crown { from { opacity: 0; transform: translateY(-18px) rotate(-25deg) scale(1.6); } }
/* Звёзды рейтинга: серые снизу, золотые поверх заполняются до дробной части (4,3 — четыре и треть пятой). */
.ui-stars { position: relative; display: inline-flex; gap: 1px; vertical-align: -1px; margin-right: 2px; }
.ui-stars img { width: 14px; height: 14px; flex: none; image-rendering: pixelated; }
.ui-stars > img { filter: grayscale(1) brightness(.95); opacity: .45; }
.ui-stars.ui-shine { display: inline-flex; }
.ui-stars-fill { position: absolute; left: 0; top: 0; bottom: 0; display: flex; gap: 1px; overflow: hidden;
  transition: width .9s cubic-bezier(.3, .7, .4, 1); }
/* Новое звание и рекорды «шлёпаются» печатью: с размаху, с кольцом и искрами в миг удара. */
.ui-stamps { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 10px 12px; margin: 12px 0 12px; }
.ui-stamp-wrap { position: relative; --hit: calc(var(--at) + 270ms); }
.ui-stamp { display: flex; flex-direction: column; align-items: center; padding: 3px 10px 4px; border: 3px solid currentColor;
  border-radius: 8px; font: 800 10px/1.25 ${UI_FONT}; text-transform: uppercase; letter-spacing: 1px; text-align: center;
  transform: rotate(var(--rot)); animation: ui-stamp .45s cubic-bezier(.55, 0, .75, 1) var(--at) both; }
.ui-stamp small { font-size: inherit; }
.ui-stamp b { display: inline-block; font-size: 19px; line-height: 1.15; letter-spacing: .3px; animation: ui-shine 1.1s ease-out var(--hit); }
.ui-stamp span { font: 700 10.5px/1.2 ${UI_FONT}; text-transform: none; letter-spacing: 0; max-width: 112px; }
.ui-stamp.red { color: #c42f3c; background: #fbe6df; box-shadow: inset 0 0 0 2px #fbe6df, inset 0 0 0 3.5px #c42f3c; }
.ui-stamp.gold { color: #86490a; border-color: #e8962a; background: linear-gradient(#fff3b0, #fee761);
  box-shadow: inset 0 0 0 2px #fff3b0, inset 0 0 0 3.5px #e8962a, 0 0 12px rgba(254, 174, 52, .7); }
@keyframes ui-stamp {
  0% { opacity: 0; transform: scale(2.4) rotate(calc(var(--rot) - 10deg)); }
  60% { opacity: 1; transform: scale(.92) rotate(var(--rot)); }
  100% { opacity: 1; transform: scale(1) rotate(var(--rot)); } }
.ui-stamp-ring { position: absolute; left: 50%; top: 50%; width: 32px; height: 20px; margin: -10px -16px; border-radius: 50%;
  box-shadow: 0 0 0 2px #feae34; opacity: 0; pointer-events: none; animation: ui-medal-ring .6s ease-out var(--hit); }
.ui-spark { position: absolute; width: 6px; height: 6px; margin: -3px; background: #fee761; box-shadow: 0 0 0 1px #2b2233;
  opacity: 0; pointer-events: none; animation: ui-spark .7s cubic-bezier(.2, .8, .4, 1) var(--hit); }
.ui-spark:nth-of-type(3n) { background: #fff; }
.ui-spark:nth-of-type(3n + 1) { background: #feae34; }
.ui-stamp-wrap.red .ui-spark:nth-of-type(3n) { background: #e43b44; }
@keyframes ui-spark { from { opacity: 1; transform: none; } to { opacity: 0; transform: translate(var(--dx), var(--dy)) rotate(200deg) scale(.4); } }
/* Лучший день недели загорается золотом, на его столбик падает корона. */
.ui-chart { padding-top: 16px; }
.ui-chart-bar.today { --bar: #fee761; }
.ui-chart-bar.record { background: #feae34; box-shadow: 0 0 8px 1px rgba(254, 174, 52, .75);
  animation: ui-grow .5s cubic-bezier(.3, 1.4, .5, 1) both, ui-gold .9s ease-out both; }
@keyframes ui-gold { from { background-color: var(--bar, #8fd16a); box-shadow: none; }
  35% { background-color: #fee761; box-shadow: 0 0 0 2px #fff3b0, 0 0 16px 5px rgba(254, 174, 52, .95); } }
.ui-chart-value { position: relative; }
.ui-chart-crown { position: absolute; left: 50%; bottom: 100%; width: 14px; height: 14px; margin: 0 0 -1px -7px; image-rendering: pixelated;
  animation: ui-crown .45s cubic-bezier(.3, 1.6, .5, 1) both; }
/* Без лишнего движения: числа и печати сразу на месте, без искр. */
@media (prefers-reduced-motion: reduce) {
  .ui-sum-tiles .ui-tile, .ui-stamp, .ui-stamp b, .ui-tile-crown, .ui-chart-crown, .ui-chart-bar, .ui-chart-bar.record, .ui-chart-line polyline,
  .ui-chart-line circle { animation: none; }
  .ui-stars-fill { transition: none; }
  .ui-spark, .ui-stamp-ring { display: none; }
}
.ui-bump { display: inline-block; animation: ui-bump .35s ease-out; }
@keyframes ui-bump { 40% { transform: scale(1.25); background: rgba(143, 209, 106, .85); } }
.ui-note { font-size: 13px; color: #5a5048; margin: 4px 0 8px; }
.ui-chip { white-space: nowrap; }
.ui-ad-icon { font-size: 24px; text-align: center; }
.ui-hearts { color: #e43b44; font-size: 13px; letter-spacing: 1px; white-space: nowrap; }
/* Подарок за вход: семь коробочек серии, сегодняшняя подпрыгивает. */
.ui-gift-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin: 4px 0 8px; }
.ui-gift-day { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 0; border: 2px solid #2b2233;
  border-radius: 6px; background: #fbf6ea; font-size: 11px; color: #6a5f58; letter-spacing: -0.2px; }
.ui-gift-day.done { background: #e3f5d6; color: #3e8948; }
.ui-gift-day.today { background: #fee761; color: #2b2233; font-weight: 700; animation: ui-pulse 1s ease-in-out infinite; }
.ui-gift-day.big .ui-gift-box { font-size: 20px; }
.ui-gift-box { font-size: 16px; line-height: 1.2; }
.ui-gift-reward { margin: 8px 0 2px; padding: 8px; text-align: center; font: 800 17px ${UI_FONT}; background: #fee761;
  border: 2px solid #2b2233; border-radius: 8px; }
/* Сводка утра: каждая строка — отдельно, крупнее и темнее, без «простыни» серого текста. */
.ui-infos { border: 2px solid #2b2233; border-radius: 8px; background: #fbf6ea; padding: 2px 10px; margin: 4px 0 8px; }
.ui-infos > div { font-size: 13.5px; line-height: 1.3; color: #3a3046; padding: 5px 0; margin: 0; font-style: normal; }
.ui-infos > div + div { border-top: 1px dashed #d8ccb0; }
/* Вкладки прилипают к верху окна, пока листаешь длинный список. */
.ui-card .ui-tabs { position: sticky; top: -2px; z-index: 3; background: #f4ecd8; padding: 6px 0; margin: 4px 0 6px;
  box-shadow: 0 6px 6px -6px rgba(43, 34, 51, .35); }
.ui-tab { font-size: 12.5px; }
.ui-card .ui-tabs { grid-template-columns: repeat(5, 1fr); }
.ui-tab { position: relative; display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 5px 0 4px; }
.ui-tab-icon { font-size: 16px; line-height: 1; }
.ui-tab-icon .ui-ico { height: 18px; vertical-align: 0; }
.ui-tab-label { font-size: 10.5px; line-height: 1.1; white-space: nowrap; }
.ui-tab-dot { position: absolute; top: -6px; right: -4px; min-width: 16px; height: 16px; padding: 0 3px; box-sizing: border-box;
  border-radius: 8px; background: #e43b44; color: #fff; border: 2px solid #2b2233; font: 700 10px/12px ${UI_FONT}; }
.ui-profile-btn { margin-left: 6px; padding: 2px 6px; }
.ui-card h2 { align-items: center; }
.ui-card h2 > span:nth-child(2) { margin-left: auto; }
/* «Открыть магазин» прилипает к низу окна. */
.ui-open-bar { position: sticky; bottom: -2px; z-index: 3; background: #f4ecd8; padding: 8px 0 4px; margin-top: 8px;
  box-shadow: 0 -6px 6px -6px rgba(43, 34, 51, .35); }
.ui-open-bar .ui-btn { margin: 0; }
/* «Сегодня»: строка значков, по нажатию — подробности. */
.ui-today { padding: 6px 8px; }
.ui-today-head { all: unset; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; width: 100%; cursor: pointer; font: 700 14px ${UI_FONT}; }
.ui-today-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-left: auto; }
.ui-today-chip { font: 600 12px ${UI_FONT}; padding: 2px 6px; border: 1.5px solid #2b2233; border-radius: 10px; background: #fff; }
.ui-today-chip.hot { background: #fee761; }
.ui-today-more { margin-top: 6px; }
/* Пояснения за «❔». */
.ui-help { margin: 4px 0; }
.ui-help-head { display: flex; align-items: center; gap: 6px; justify-content: space-between; }
.ui-help-btn { all: unset; cursor: pointer; flex: none; width: 22px; height: 22px; text-align: center; border-radius: 50%; border: 1.5px solid #2b2233; background: #fff; font-size: 12px; line-height: 22px; }
.ui-help-btn.active { background: #fee761; }
.ui-help-text { font-size: 12.5px; color: #5a5048; background: #fff8e0; border-radius: 6px; padding: 6px 8px; margin-top: 4px; }
/* Закупка: большая кнопка «Закупить нужное», фильтры. */
.ui-restock .ui-btn { margin: 0 0 4px; }
.ui-filter { margin: 8px 0 2px; }
.ui-chip.active { background: #2b2233; color: #f4ecd8; }
/* Зал: склад строкой, полки сеткой. */
.ui-stock-line { font-size: 14px; margin: 4px 0 6px; line-height: 1.6; }
.ui-shelf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 6px 0; }
.ui-shelf-card { all: unset; box-sizing: border-box; cursor: pointer; display: flex; flex-direction: column; gap: 3px; padding: 6px 7px;
  border: 2px solid #2b2233; border-radius: 6px; background: #fbf6ea; font: 13px/1.25 ${UI_FONT}; min-width: 0; }
.ui-shelf-card b { font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ui-shelf-card.active { background: #fee761; }
.ui-shelf-card.broken { border-color: #b13e53; }
.ui-shelf-meta { font-size: 11.5px; color: #5a5048; }
.ui-shelf-span { grid-column: 1 / -1; margin: 0; }
.ui-arrange { position: fixed; z-index: 30; left: 50%; bottom: calc(env(safe-area-inset-bottom) + 10px); transform: translateX(-50%);
  width: min(94vw, 372px); box-sizing: border-box; background: #fbf6ea; border: 3px solid #2b2233; border-radius: 10px;
  box-shadow: 0 4px 0 #2b2233; padding: 8px 10px; font: 13px/1.35 ${UI_FONT}; color: #2b2233; }
.ui-arrange-row { display: grid; grid-template-columns: 1fr 1fr 1.3fr; gap: 6px; margin-top: 6px; }
.ui-arrange-row .ui-btn { margin: 0; padding: 9px 4px; font-size: 13px; }
.ui-arrange-queue { width: 100%; margin: 6px 0 0; padding: 7px 4px; font-size: 12px; }
.ui-arrange-intro { margin: 6px 0 10px; padding-left: 18px; text-align: left; font-size: 13px; line-height: 1.35; }
.ui-arrange-intro li { margin: 5px 0; }
.ui-help-inline { display: inline-block; width: 20px; height: 20px; line-height: 20px; margin-left: 6px; vertical-align: middle; font-size: 11px; }
/* Плитки «Уголков»: значок слева, название и состояние справа. */
.ui-tile-card { flex-direction: row; align-items: center; gap: 7px; }
.ui-tile-icon { font-size: 22px; line-height: 1; flex: none; }
.ui-tile-icon .ui-ico { height: 24px; vertical-align: 0; }
.ui-tile-img { width: 26px; height: 26px; object-fit: contain; image-rendering: pixelated; flex: none; }
.ui-tile-text { display: flex; flex-direction: column; min-width: 0; }
/* Персонал: строка сотрудника и навыки хозяина. */
.ui-staff { padding: 6px 8px; }
.ui-staff-head { all: unset; box-sizing: border-box; cursor: pointer; display: grid; grid-template-columns: 1fr 54px; gap: 2px 8px; align-items: center; width: 100%; font: 14px/1.3 ${UI_FONT}; }
.ui-staff-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ui-staff-bar { height: 7px; }
.ui-staff-tags { grid-column: 1 / -1; font-size: 12px; color: #b13e53; }
.ui-skill-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; margin-top: 6px; }
.ui-skill-chip { padding: 5px 2px; font-size: 11px; letter-spacing: -0.5px; }
.ui-skill-chip.hot { background: #fee761; }
.ui-skill-detail { margin-top: 6px; padding: 6px 8px; background: #fff8e0; border-radius: 6px; }
/* Итоги дня: «Подробнее» свёрнуто. */
.ui-more { border: 2px solid #2b2233; border-radius: 6px; background: #fbf6ea; padding: 6px 8px; margin: 6px 0; }
.ui-more summary { cursor: pointer; font-weight: 700; font-size: 14px; }
.ui-more[open] summary { margin-bottom: 4px; }
.ui-card h3 { font-size: 16px; border-bottom: 2px solid #2b2233; padding-bottom: 2px; }
/* Строка товара: крупная иконка, название с жёлтым ценником, подпись, кнопки справа — ничего не переносится. */
.ui-item { display: grid; grid-template-columns: 34px 1fr auto; gap: 8px; align-items: center; padding: 7px 0; }
.ui-item + .ui-item { border-top: 1px dashed #d8ccb0; }
.ui-item-icon { width: 30px; height: 36px; image-rendering: pixelated; justify-self: center; }
.ui-item-name { font-weight: 700; font-size: 15px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ui-item-sub { font-size: 12.5px; color: #6a5f58; margin-top: 1px; }
.ui-item-actions { display: flex; gap: 6px; align-items: center; }
.ui-item-actions .ui-chip { min-width: 46px; padding: 8px 6px; font-size: 14px; }
/* Заголовок сворачиваемого блока: вся строка — кнопка. */
.ui-fold { all: unset; display: block; width: 100%; box-sizing: border-box; cursor: pointer; font: 700 15px ${UI_FONT}; color: #2b2233; }
/* Несколько длинных кнопок — столбиком, чтобы не вылезали за рамку. */
.ui-item-actions.stack { flex-direction: column; align-items: stretch; }
.ui-tag { display: inline-flex; align-items: center; gap: 2px; background: #fee761; border: 2px solid #2b2233; border-radius: 6px;
  padding: 0 5px; font: 800 13px ${UI_FONT}; line-height: 1.5; }
.ui-haggle { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 8px; padding: 7px 8px 7px 10px; background: #f4ecd8;
  border: 2px dashed #d8ccb0; border-radius: 8px; }
.ui-haggle-label { display: flex; flex-direction: column; flex: none; line-height: 1.15; }
.ui-haggle-label b { font-size: 14px; white-space: nowrap; }
.ui-haggle-pips { font-size: 12px; color: #e43b44; letter-spacing: 2px; }
/* На узком телефоне кнопки торга уходят под подпись, а не сжимаются. */
.ui-haggle-asks { flex: 1 1 150px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.ui-haggle-asks .ui-chip { width: 100%; padding: 7px 0; }
.ui-haggle.done, .ui-haggle.angry { justify-content: center; text-align: center; font-size: 14px; padding: 9px 10px; }
.ui-haggle.done { background: #e3f5d6; border: 2px solid #8fd16a; color: #2f6b2a; }
.ui-haggle.angry { background: #fbe0dc; border: 2px solid #e8a9a2; color: #8a2a2a; }
/* Оформление: сетка карточек с превью. Поставленное — зелёное, премиум — с золотой рамкой. */
.ui-decor-kind { font: 700 14px ${UI_FONT}; margin: 12px 0 4px; }
.ui-decor-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.ui-decor { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 4px; border: 2px solid #2b2233;
  border-radius: 8px; background: #fbf6ea; color: #2b2233; box-shadow: 0 2px 0 #2b2233; font: 12px/1.2 ${UI_FONT}; }
.ui-decor.active { background: #e3f5d6; border-color: #3e8948; box-shadow: 0 2px 0 #3e8948; }
.ui-decor.premium { border-color: #feae34; }
.ui-decor[disabled] { opacity: .65; }
.ui-decor-preview { width: 52px; height: 36px; border: 2px solid #2b2233; border-radius: 4px; image-rendering: pixelated;
  background-size: 32px 32px; display: flex; align-items: center; justify-content: center; font-size: 20px; background-color: #fff; }
.ui-decor-preview img { max-width: 48px; max-height: 32px; image-rendering: pixelated; }
.ui-decor-preview.wide img { max-width: 52px; }
.ui-decor-preview.big { width: 100%; height: 120px; margin: 8px 0; background-color: #e9e1d2; border-radius: 8px; }
.ui-decor-preview.big img { max-width: 90%; max-height: 104px; width: auto; height: 100%; object-fit: contain; }
.ui-decor-preview.big.wide img { height: auto; width: 90%; }
.ui-btn.ui-btn-stars { background: linear-gradient(#ffd75e, #f5a623); box-shadow: 0 3px 0 #a86a12; }
.ui-decor-name { font-weight: 700; min-height: 2.4em; display: flex; align-items: center; text-align: center; }
.ui-decor-status { font-size: 11.5px; font-weight: 700; color: #6a5f58; }
.ui-decor.active .ui-decor-status { color: #3e8948; }
/* Всплывашка «Новое достижение!» сверху: выезжает, висит и уезжает. */
.ui-toast { position: fixed; z-index: 40; left: 50%; top: calc(var(--safe-top, env(safe-area-inset-top)) + 62px); display: flex; gap: 10px;
  align-items: center; padding: 8px 14px 8px 10px; background: #fbf6ea; color: #2b2233; border: 3px solid #2b2233;
  border-radius: 10px; box-shadow: 0 4px 0 #2b2233; font: 13px/1.3 ${UI_FONT}; pointer-events: none;
  transform: translate(-50%, -160%); transition: transform .45s cubic-bezier(.3, 1.4, .5, 1); max-width: 88vw; }
.ui-toast.shown { transform: translate(-50%, 0); }
.ui-toast-low { top: auto; bottom: calc(env(safe-area-inset-bottom) + 92px); transform: translate(-50%, 260%); }
.ui-toast-low.shown { transform: translate(-50%, 0); }
.ui-toast img { width: 36px; height: 42px; image-rendering: pixelated; animation: ui-badge 1.2s ease-in-out infinite; }
@keyframes ui-badge { 50% { transform: rotate(-8deg) scale(1.08); } }
.ui-toast-medal img { animation: ui-medal-drop .7s cubic-bezier(.3, 1.6, .5, 1) .25s both, ui-badge 1.2s ease-in-out 1s infinite; }
@keyframes ui-medal-drop { from { transform: translateY(-70px) rotate(-30deg); opacity: 0; } 60% { opacity: 1; } }
.ui-toast-medal::after { content: ''; position: absolute; left: 28px; top: 50%; width: 10px; height: 10px; margin: -5px;
  border-radius: 50%; box-shadow: 0 0 0 2px #fee761; opacity: 0; animation: ui-medal-ring .6s ease-out .75s; }
@keyframes ui-medal-ring { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(5); } }
/* Звёзды рейтинга блестят, когда рейтинг вырос. */
.ui-shine { display: inline-block; animation: ui-shine 1.1s ease-out; }
@keyframes ui-shine { 0% { filter: none; } 30% { transform: scale(1.3); filter: drop-shadow(0 0 6px #fee761) brightness(1.4); } 100% { filter: none; } }
.ui-toast b { display: block; font-size: 12px; color: #b86f50; text-transform: uppercase; letter-spacing: .5px; }
/* Книга достижений: сетка значков; закрытые — серые, с полоской прогресса. */
.ui-badges { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin: 8px 0; }
.ui-badge { border: 2px solid #2b2233; border-radius: 8px; background: #fbf6ea; padding: 6px 4px; text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 2px; }
.ui-badge img { width: 40px; height: 47px; image-rendering: pixelated; }
.ui-badge b { font-size: 12px; line-height: 1.2; }
.ui-badge span { font-size: 10.5px; color: #7a7066; line-height: 1.25; }
.ui-badge.locked img { filter: grayscale(1) brightness(.75); opacity: .55; }
.ui-badge.locked { background: #ece3cf; }
.ui-badge .ui-bar { width: 100%; }
/* Диалог как в RPG: крупный портрет, табличка с именем, облако реплики с хвостиком. */
.ui-dialog { margin: 4px 0; }
.ui-dialog-art { display: block; width: 100%; aspect-ratio: 16 / 9; image-rendering: pixelated; margin: 6px 0 10px;
  border: 3px solid #2b2233; border-radius: 8px; box-shadow: 0 3px 0 #2b2233; animation: ui-art .6s ease-out; }
@keyframes ui-art { from { opacity: 0; transform: scale(1.04); } }
.ui-dialog-row { display: flex; align-items: flex-end; gap: 10px; margin-top: 6px; }
.ui-dialog-face { width: 88px; height: 88px; flex: none; image-rendering: pixelated; border: 3px solid #2b2233;
  border-radius: 8px; box-shadow: 0 3px 0 #2b2233; background: #fbf6ea; animation: ui-pop .3s cubic-bezier(.3, 1.45, .5, 1); }
.ui-dialog-face.talking { animation: ui-talk .32s ease-in-out infinite; }
@keyframes ui-talk { 50% { transform: translateY(-2px) scale(1.02); } }
.ui-dialog-speech { position: relative; flex: 1; min-height: 88px; background: #fff; border: 3px solid #2b2233;
  border-radius: 10px; padding: 18px 10px 8px; box-shadow: 0 3px 0 #2b2233; cursor: pointer; }
.ui-dialog-speech::before { content: ''; position: absolute; left: -11px; bottom: 16px; border: 8px solid transparent;
  border-right-color: #2b2233; border-left: 0; }
.ui-dialog-speech::after { content: ''; position: absolute; left: -6px; bottom: 18px; border: 6px solid transparent;
  border-right-color: #fff; border-left: 0; }
.ui-dialog-name { position: absolute; top: -12px; left: 10px; background: #fee761; border: 2px solid #2b2233;
  border-radius: 6px; padding: 1px 8px; font: 700 13px ${UI_FONT};
  /* Длинное имя («Эдуард, директор «МегаМарта») — в одну строку, иначе ярлык закрывает реплику. */
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: calc(100% - 24px); box-sizing: border-box; }
.ui-dialog-text { margin: 0; font-size: 15px; line-height: 1.4; min-height: 3em; }
.ui-dialog-caret { display: inline-block; margin-left: 4px; font-size: 10px; color: #b86f50; animation: ui-tip .8s ease-in-out infinite; }
.ui-tour { position: fixed; left: 8px; right: 8px; bottom: 8px; max-width: 480px; margin: 0 auto; z-index: 50; color: #2b2233;
  font: 15px/1.4 ${UI_FONT}; background: #f4ecd8; border: 3px solid #2b2233; border-radius: 10px; padding: 8px 10px 10px; box-shadow: 0 6px 0 rgba(0,0,0,.35);
  animation: ui-pop .3s cubic-bezier(.3, 1.45, .5, 1); }
.ui-tour .ui-dialog { margin: 0; }
.ui-tour .ui-dialog-face { width: 64px; height: 64px; }
.ui-tour .ui-dialog-speech { min-height: 64px; }
.ui-tour .ui-dialog-text { font-size: 14px; min-height: 0; }
.ui-tour-head { font-size: 12px; color: #8b6d5c; margin-bottom: 10px; }
.ui-tour-skip { position: absolute; top: 0; right: 0; background: none; border: none; color: #8b6d5c; font-size: 13px;
  text-decoration: underline; padding: 10px 12px; min-height: 40px; cursor: pointer; }
.ui-card.touring { padding-bottom: 230px; }
/* Пока идёт обучение, низ окна закрыт репликой бабушки — кнопка «Открыть» стоит на своём месте в списке. */
.ui-card.touring .ui-open-bar { position: static; box-shadow: none; }
.ui-tour-focus { position: relative; z-index: 4; outline: 3px solid #fee761; outline-offset: 2px; border-radius: 6px;
  box-shadow: 0 0 0 6px #2b2233, 0 0 0 2000px rgba(15, 12, 22, .45); animation: ui-tour-pulse 1s ease-in-out infinite; }
@keyframes ui-tour-pulse { 50% { outline-color: #feae34; } }
.ui-tour-lit { position: relative; z-index: 5; background: #f4ecd8; border-radius: 6px; box-shadow: 0 0 0 4px #f4ecd8; }
.ui-dialog-after { opacity: 0; transform: translateY(4px); transition: opacity .25s, transform .25s; }
.ui-dialog-after.shown { opacity: 1; transform: none; }
/* Поле ввода (имя кота) и пиксельная картинка в строке. */
.ui-input { width: 100%; box-sizing: border-box; font: 700 16px ${UI_FONT}; padding: 9px 10px; margin: 6px 0;
  border: 2px solid #2b2233; border-radius: 8px; background: #fff; color: #2b2233; }
.ui-item-art { width: 32px; height: 32px; image-rendering: pixelated; object-fit: contain; justify-self: center; }
/* Карточка отзыва: звёзды, текст, подпись; плохие — розовые, хорошие — зелёные. */
.ui-review { border: 2px solid #2b2233; border-radius: 8px; padding: 6px 9px; margin: 6px 0; background: #fbf6ea; }
.ui-review.good { background: #e3f5d6; }
.ui-review.bad { background: #fbe0dc; }
.ui-review-stars { color: #f77622; font-size: 14px; letter-spacing: 1px; }
.ui-review-text { font-size: 14px; line-height: 1.3; color: #2b2233; margin: 2px 0; }
.ui-review-who { font-size: 12px; color: #6a5f58; text-align: right; }
.ui-speed { position: fixed; right: max(10px, calc((100vw - var(--game-w, min(100vw, 56.25dvh))) / 2 + 10px)); bottom: calc(var(--safe-bottom, env(safe-area-inset-bottom)) + 40px);
  font: 800 13px ${UI_FONT}; padding: 6px 9px; border: 2px solid rgba(254, 231, 97, .55); border-radius: 8px;
  background: rgba(24, 20, 37, .72); color: #fff; text-shadow: 0 1px 0 #000; box-shadow: 0 2px 0 rgba(0, 0, 0, .45); }
.ui-speed:active { transform: translateY(1px); box-shadow: none; }
.ui-speed.on { background: rgba(254, 231, 97, .92); color: #2b2233; text-shadow: none; border-color: #2b2233; }
.ui-urgent { bottom: calc(var(--safe-bottom, env(safe-area-inset-bottom)) + 84px); }
.ui-report-chart { display: flex; align-items: flex-end; gap: 6px; height: 110px; margin: 10px 0; padding: 0 2px; }
.ui-report-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; }
.ui-report-bar { width: 100%; background: #63c74d; border: 2px solid #2b2233; border-radius: 4px 4px 0 0; }
.ui-report-val { font-size: 10px; color: #6a5f58; margin-bottom: 2px; }
.ui-report-day { font-size: 11px; color: #2b2233; margin-top: 2px; }
.ui-skill-pips { color: #feae34; letter-spacing: 1px; }
.ui-tip { background: #fff3b0; }
.ui-tip > div { font-size: 14px; line-height: 1.35; margin: 4px 0 6px; color: #2b2233; }
.ui-todo { background: #fbf6ea; }
.ui-todo-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 5px 0; font-size: 13.5px; }
.ui-todo-row + .ui-todo-row { border-top: 1px dashed #d8ccb0; }
.ui-todo-row .ui-chip { flex: none; padding: 6px 8px; font-size: 13px; }
.ui-contract { margin-top: 8px; padding: 6px 8px; border: 2px dashed #b8a98a; border-radius: 8px; }
.ui-contract .ui-chips { margin-top: 4px; }
.ui-promo { margin-top: 4px; display: flex; flex-wrap: wrap; gap: 4px; }
.ui-promo .ui-chip { padding: 4px 8px; font-size: 12px; }
.ui-loss-bar { display: flex; height: 14px; border: 2px solid #2b2233; border-radius: 6px; overflow: hidden; margin: 6px 0 2px; }
.ui-loss-row { display: grid; grid-template-columns: 14px 1fr; gap: 6px; align-items: start; padding: 5px 0; }
.ui-loss-row + .ui-loss-row { border-top: 1px dashed #d8ccb0; }
.ui-loss-dot { width: 12px; height: 12px; border: 2px solid #2b2233; border-radius: 3px; margin-top: 3px; box-sizing: border-box; }
/* Объём как у «Играть»: блик сверху, тень снизу, кнопка «нажимается». Цвет — из основных правил выше. */
.ui-btn:not([disabled]):not(.ui-btn-stars) { font-weight: 700; background-image: linear-gradient(rgba(255,255,255,.28) 0 50%, rgba(255,255,255,0) 50%);
  box-shadow: inset 0 2px 0 rgba(255,255,255,.55), inset 0 -3px 0 rgba(43,34,51,.16), 0 3px 0 #2b2233; }
.ui-btn.danger:not([disabled]) { text-shadow: 0 1px 0 rgba(43,34,51,.6); }
.ui-btn:not([disabled]):active { box-shadow: inset 0 2px 0 rgba(255,255,255,.4), 0 1px 0 #2b2233; }
.ui-btn.ui-btn-stars { box-shadow: inset 0 2px 0 rgba(255,255,255,.6), 0 3px 0 #a86a12; text-shadow: 0 1px 0 rgba(255,255,255,.4); }
.ui-chip:not(.active):not([disabled]):not(.ui-chip-off) { box-shadow: inset 0 2px 0 rgba(255,255,255,.45), 0 2px 0 #2b2233; }
.ui-tab.active { box-shadow: inset 0 -3px 0 #fee761; }
/* Блоки в окнах — как карточки: светлый край сверху и мягкая тень снизу. */
.ui-box { box-shadow: inset 0 2px 0 rgba(255,255,255,.6), 0 2px 0 rgba(43,34,51,.18);
  /* Еле заметная фактура бумаги: блоки не плоские, текст читается как прежде. */
  background-image: radial-gradient(rgba(43,34,51,.045) 1px, transparent 1.2px); background-size: 5px 5px; }
/* Заголовок окна — с пиксельной полосой-подчёркиванием. */
.ui-card h2 { padding-bottom: 6px; background: linear-gradient(90deg, #2b2233 0 2px, transparent 2px) bottom left / 6px 2px repeat-x; }
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
  // Всё, что окно нарисует, получает пиксельные иконки вместо эмодзи.
  const observer = new MutationObserver(() => pixelize(card));
  observer.observe(card, { childList: true, subtree: true, characterData: true });
  return {
    card,
    close: () => {
      observer.disconnect();
      overlay.classList.add('closing');
      setTimeout(() => overlay.remove(), 160);
    },
  };
}

/**
 * Число «докручивается» от from до to за ms, как барабан кассы: быстро в начале, плавно к концу.
 * format — как показать число, done — когда докрутилось. Возвращает отмену.
 */
export function rollNumber(
  target: Node,
  from: number,
  to: number,
  ms: number,
  format: (n: number) => string = String,
  done?: () => void,
): () => void {
  const show = (n: number) => {
    const text = format(n);
    if (target.textContent !== text) target.textContent = text;
  };
  if (from === to || ms <= 0) {
    show(to);
    done?.();
    return () => {};
  }
  let frame = 0;
  const start = performance.now();
  const step = (now: number) => {
    // Время кадра бывает чуть раньше старта — без нижней границы число на миг ушло бы за from.
    const k = Math.min(1, Math.max(0, (now - start) / ms));
    show(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
    if (k < 1) frame = requestAnimationFrame(step);
    else done?.();
  };
  show(from);
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}

/** Перезапустить разовую CSS-анимацию (блеск, подскок) на элементе. */
export function replay(node: HTMLElement, className: string): void {
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
}

/** Шторка между экранами: опускается, в середине выполняется смена экрана, поднимается. */
export function curtain(label: string, middle: () => void): void {
  injectStyles();
  const shade = el('div', 'ui-curtain');
  shade.append(el('div', 'ui-curtain-label', label));
  document.body.append(shade);
  requestAnimationFrame(() => requestAnimationFrame(() => shade.classList.add('down')));
  setTimeout(() => {
    middle();
    setTimeout(() => shade.classList.add('up'), 350);
    setTimeout(() => shade.remove(), 950);
  }, 480);
}

/** Всплывашка сверху на пару секунд: картинка, заголовок, текст. */
/** Всплывашки идут по очереди, а не стопкой друг на друге. */
const toastQueue: (() => void)[] = [];
let toastBusy = false;

export function toast(image: string, title: string, text: string, medal = false): void {
  injectStyles();
  toastQueue.push(() => showToast(image, title, text, medal));
  if (!toastBusy) nextToast();
}

function nextToast(): void {
  const show = toastQueue.shift();
  toastBusy = Boolean(show);
  show?.();
}

function showToast(image: string, title: string, text: string, medal: boolean): void {
  // Медаль достижения падает сверху в рамку и звенит; вокруг — искры.
  const box = el('div', medal ? 'ui-toast ui-toast-medal' : 'ui-toast');
  // Открыто окно (утро, итоги) — всплывашка снизу, чтобы не закрывать заголовок и вкладки.
  if (document.querySelector('.ui-modal')) box.classList.add('ui-toast-low');
  const img = el('img');
  img.src = assetUrl(image);
  img.alt = '';
  const body = el('div');
  body.append(el('b', '', title), el('span', '', text));
  box.append(img, body);
  document.body.append(box);
  requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add('shown')));
  setTimeout(() => box.classList.remove('shown'), 3200);
  setTimeout(() => {
    box.remove();
    nextToast();
  }, 3700);
}

/** Эмодзи → пиксельная картинка из игры: в меню (pixelize) и во всплывающих надписях в зале (StoreScene.popup). */
export const ICONS: Record<string, string> = {
  '💰': 'coin',
  '🍞': 'item_bread',
  '🍎': 'item_apples',
  '🥔': 'item_potatoes',
  '🥛': 'item_milk',
  '🥩': 'item_meat',
  '📦': 'box',
  '🍦': 'item_icecream',
  '🍊': 'item_tangerines',
  '💐': 'item_flowers',
  '💧': 'item_water',
  '🧃': 'item_juice',
  '🥟': 'item_dumplings',
  '🐟': 'item_fish',
  '🧼': 'item_soap',
  '🧴': 'item_detergent',
  // Значки меню (art/icons.py).
  '☕': 'ico_coffee',
  '🏷': 'ico_tag',
  '👵': 'ico_granny',
  '⚠': 'ico_warn',
  '🥖': 'ico_baguette',
  '⭐': 'ico_star',
  '🌙': 'ico_moon',
  '🔒': 'ico_lock',
  '📋': 'ico_clipboard',
  '📃': 'ico_page',
  '📄': 'ico_page',
  '🧾': 'ico_receipt',
  '🏅': 'ico_medal',
  '🏆': 'ico_trophy',
  '🐱': 'ico_cat',
  '🐭': 'ico_mouse',
  '🎪': 'ico_tent',
  '🚲': 'ico_bike',
  '🤖': 'ico_robot',
  '🚚': 'ico_truck',
  '📖': 'ico_book',
  '⚔': 'ico_swords',
  '✅': 'ico_check',
  '🟩': 'ico_square',
  '💡': 'ico_bulb',
  '🔧': 'ico_wrench',
  '🛠': 'ico_wrench',
  '🔨': 'ico_hammer',
  '🏖': 'ico_beach',
  '🏦': 'ico_bank',
  '🔄': 'ico_cycle',
  '🔁': 'ico_cycle',
  '💳': 'ico_card',
  '🎁': 'ico_gift',
  '🎉': 'ico_party',
  '🛒': 'ico_cart',
  '❄': 'ico_snow',
  '🍫': 'ico_choc',
  '💸': 'ico_cash',
  '🗓': 'ico_calendar',
  '📊': 'ico_chart',
  '📻': 'ico_radio',
  '😤': 'ico_angry',
  '🤝': 'ico_handshake',
  '⏳': 'ico_hourglass',
  '💬': 'ico_speech',
  '📭': 'ico_mailbox',
  '📮': 'ico_mailbox',
  '📞': 'ico_phone',
  '📱': 'ico_phone',
  '📲': 'ico_phone',
  '📣': 'ico_megaphone',
  '🎯': 'ico_target',
  '🗑': 'ico_trash',
  '🎵': 'ico_note',
  '💚': 'ico_heart_green',
  '💔': 'ico_heart_broken',
  '🏠': 'ico_house',
  '🍰': 'ico_cake',
  '🥐': 'ico_croissant',
  '🥧': 'ico_pie',
  '🧑': 'ico_person',
  '🔊': 'ico_sound_on',
  '🔇': 'ico_sound_off',
  '☀': 'ico_sun',
  '🌧': 'ico_rain',
  '⛈': 'ico_storm',
  '🍂': 'ico_leaf',
  '🥵': 'ico_heat',
  '📌': 'ico_pin',
  '🪧': 'ico_sign',
  '🔥': 'ico_fire',
  '🙂': 'ico_smile',
  '❔': 'ico_question',
  '📅': 'ico_calendar',
  '🚶': 'ico_walk',
  '🌊': 'ico_wave',
  '🌋': 'ico_quake',
  '🎭': 'ico_mask',
  '🎺': 'ico_trumpet',
  '📺': 'ico_tv',
  // Особые дни.
  '🕯': 'ico_candle',
  '🎬': 'ico_clapper',
  '🏃': 'ico_runner',
  '🚌': 'ico_bus',
  '🌠': 'ico_shooting',
  '🐦': 'ico_bird',
  '🚧': 'ico_works',
  '🧪': 'ico_testtube',
  '💒': 'ico_wedding',
  '🦠': 'ico_virus',
  '🏗': 'ico_crane',
  '🏬': 'ico_mall',
  // Альбом редких гостей.
  '🎸': 'ico_guitar',
  '🎩': 'ico_tophat',
  '🚀': 'ico_rocket',
  '⚽': 'ico_ball',
  '🎨': 'ico_palette',
  '🕵': 'ico_magnifier',
  '🎅': 'ico_santa',
  '👑': 'ico_crown',
  '🦜': 'ico_parrot',
  '🤡': 'ico_clown',
  '🛡': 'ico_shield',
  '👽': 'ico_alien',
  '🪄': 'ico_wand',
  '🪓': 'ico_axe',
  '🦸': 'ico_hero',
  '🩰': 'ico_ballet',
  '🥷': 'ico_ninja',
  // Интерфейсные значки (art/icons2.py). Последовательность с ZWJ стоит раньше своей первой части.
  '😮‍💨': 'ico_dash',
  '😠': 'ico_angry',
  '😊': 'ico_smile',
  '📢': 'ico_megaphone',
  '🏛': 'ico_bank',
  '✍': 'ico_note',
  '🎷': 'ico_trumpet',
  '💍': 'ico_wedding',
  '🌀': 'ico_storm',
  '🧍': 'ico_person',
  '👨': 'ico_person',
  '🕴': 'ico_person',
  '✋': 'ico_hello',
  '👁': 'ico_eyes',
  '📹': 'ico_camera',
  '🏪': 'ico_shop',
  '🏘': 'ico_houses',
  '🏫': 'ico_school',
  '🏢': 'ico_office',
  '🏟': 'ico_stadium',
  '🏥': 'ico_clinic',
  '👮': 'ico_police',
  '👥': 'ico_people',
  '🧓': 'ico_elder',
  '👧': 'ico_girl',
  '🧒': 'ico_girl',
  '💼': 'ico_case',
  '🎫': 'ico_ticket',
  '📨': 'ico_mail',
  '🚕': 'ico_taxi',
  '🚨': 'ico_siren',
  '👀': 'ico_eyes',
  '🍳': 'ico_egg',
  '🍲': 'ico_stew',
  '🍽': 'ico_plate',
  '🥗': 'ico_salad',
  '🥞': 'ico_pancakes',
  '🍖': 'ico_drumstick',
  '💪': 'ico_muscle',
  '🌷': 'ico_tulip',
  '🌻': 'ico_sunflower',
  '🎃': 'ico_pumpkin',
  '👋': 'ico_hello',
  '💥': 'ico_boom',
  '💨': 'ico_dash',
  '🛍': 'ico_bags',
  '🌍': 'ico_globe',
  '🌅': 'ico_sunrise',
  '❤': 'ico_heart',
  '💛': 'ico_heart_yellow',
  '📸': 'ico_camera',
  '🧽': 'ico_sponge',
  '🧺': 'ico_basket',
  '🩺': 'ico_steth',
  '🤒': 'ico_sick',
  '😮': 'ico_wow',
  '😵': 'ico_dizzy',
  '🎓': 'ico_grad',
  '🥇': 'ico_gold',
  '🥈': 'ico_silver',
  '🥉': 'ico_bronze',
  '❌': 'ico_cross',
  '🐕': 'ico_dog',
  '🖥': 'ico_monitor',
  '🪑': 'ico_chair',
  '🎄': 'ico_tree',
  '🎒': 'ico_backpack',
  '🚪': 'ico_door',
  '🚽': 'ico_toilet',
};
// Эмодзи из таблицы; знак-вариант U+FE0F после него («⚠️») съедается вместе с ним.
export const ICON_RE = new RegExp(`(${Object.keys(ICONS).join('|')})\uFE0F?`, 'u');

/** Заменяет эмодзи денег и товаров на пиксельные картинки из игры. */
export function pixelize(root: Node): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const found: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (ICON_RE.test(node.nodeValue ?? '')) found.push(node as Text);
  }
  for (const node of found) {
    const frag = document.createDocumentFragment();
    for (const part of (node.nodeValue ?? '').split(ICON_RE)) {
      if (!part) continue;
      const key = ICONS[part];
      if (!key) {
        frag.append(part);
        continue;
      }
      const img = el('img', 'ui-ico');
      img.src = png(key);
      img.alt = part;
      frag.append(img);
    }
    node.replaceWith(frag);
  }
}

/** Пиксельный портрет персонажа или поставщика (assets/portrait_<id>.png) рядом с именем. */
export function who(portraitId: string, name: HTMLElement): HTMLDivElement {
  const row = el('div', 'ui-who');
  const img = el('img', 'ui-portrait');
  img.src = png(`portrait_${portraitId}`);
  img.alt = '';
  row.append(img, name);
  return row;
}
