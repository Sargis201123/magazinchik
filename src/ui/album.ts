// Альбом коллекций — книга в профиле (game/collections.ts): обложка, закладки наборов и по странице
// на набор. Собранное — цветное, пустые места — силуэтом с подсказкой «как получить», новое — с меткой.
// Когда собраны все наборы, обложка золотая. Трофей набора на странице — тот же, что в витрине зала.

import { t } from '../i18n';
import type { TextKey } from '../i18n/ru';
import type { StoreState } from '../game/economy';
import { ALBUM_REWARD } from '../game/endless';
import {
  albumGolden,
  COLLECTION_SETS,
  freshCount,
  gotIn,
  isFresh,
  seeAlbum,
  setCoins,
  setDone,
  setHint,
  setName,
  setsDone,
  SET_IDS,
  syncCollections,
  trophyKey,
  type CollectionItem,
  type CollectionSet,
} from '../game/collections';
import { liteMode } from '../platform/quality';
import { haptic } from '../platform/telegram';
import { sound } from '../platform/sound';
import { button, el, injectStyles, openModal } from './dom';
import { sheetPng } from './sheet';

const css = `
.ui-album-btn { position: relative; }
.ui-album-btn .ui-tab-dot { top: -6px; right: -4px; }
.ui-album-new { display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 8px; background: #e43b44; color: #fff;
  font-size: 11px; line-height: 16px; vertical-align: middle; }
.ui-album { padding: 0 !important; overflow: hidden; }
.ui-album-cover { margin: -2px -2px 0; padding: 10px 12px 8px; border-radius: 6px 6px 0 0; color: #fbe9c8; text-align: center;
  background: linear-gradient(180deg, #8a4a32, #6a3424); box-shadow: inset 0 0 0 2px #b86f50, inset 0 0 0 4px #5a2a1c; }
.ui-album-cover h2 { margin: 0; color: #fee761; text-shadow: 0 2px 0 #3b1d14; }
.ui-album-cover .ui-muted { color: #f1d7b0; margin-top: 4px; font-size: 12px; }
.ui-album.gold .ui-album-cover { color: #5a3a0c; background: linear-gradient(180deg, #fff1a8, #f2c14e 55%, #d99a2b);
  box-shadow: inset 0 0 0 2px #fff6c8, inset 0 0 0 4px #9a6a1c; }
.ui-album.gold .ui-album-cover h2 { color: #6a3a0a; text-shadow: 0 1px 0 #fff6c8; }
.ui-album.gold .ui-album-cover .ui-muted { color: #6a4a14; }
.ui-album-tabs { display: flex; gap: 4px; justify-content: center; flex-wrap: wrap; padding: 8px 6px 2px; }
.ui-album-tab { position: relative; width: 40px; height: 40px; border-radius: 8px; border: 2px solid #2b2233; background: #e6dcc4;
  font-size: 20px; line-height: 34px; padding: 0; text-align: center; cursor: pointer; }
.ui-album-tab.on { background: #fee761; transform: translateY(-2px); }
.ui-album-tab.done::after { content: '✓'; position: absolute; right: -4px; bottom: -6px; width: 16px; height: 16px; border-radius: 50%;
  background: #63c74d; color: #fff; font-size: 11px; line-height: 16px; border: 1px solid #2b2233; }
.ui-album-tab .ui-tab-dot { top: -6px; right: -6px; }
.ui-album-page { margin: 6px 8px 8px; padding: 10px; border-radius: 4px; background: #fbf3df;
  box-shadow: inset 6px 0 8px -6px rgba(90, 50, 30, .45), 0 2px 0 #d8c6a0; }
.ui-album-page.turn { animation: ui-album-turn .25s ease-out; }
@keyframes ui-album-turn { from { opacity: 0; transform: translateX(var(--from, 12px)); } to { opacity: 1; transform: none; } }
.ui-album-head { display: flex; align-items: center; gap: 8px; }
.ui-album-head img { width: 40px; height: 44px; image-rendering: pixelated; flex: none; }
.ui-album-head img.off { filter: grayscale(1) opacity(.35); }
.ui-album-head b { font-size: 16px; display: block; }
.ui-album-bar { height: 8px; border-radius: 4px; background: #e6dcc4; overflow: hidden; margin: 6px 0 4px; }
.ui-album-bar i { display: block; height: 100%; background: #feae34; }
.ui-album-bar.done i { background: #63c74d; }
.ui-album-reward { font-size: 12px; color: #6a5a4a; }
.ui-album-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 8px; align-items: start; }
.ui-album-count { margin-top: 4px; font-weight: bold; color: #fee761; }
.ui-album.gold .ui-album-count { color: #6a3a0a; }
.ui-album-slot { position: relative; padding: 6px 3px 5px; border-radius: 6px; background: #fff; border: 2px solid #e6dcc4; text-align: center;
  min-height: 64px; box-sizing: border-box; }
.ui-album-slot .pic { font-size: 24px; line-height: 30px; height: 30px; }
.ui-album-slot .pic .ui-ico { width: 24px; height: 24px; vertical-align: middle; }
.ui-album-slot .name { font-size: 11px; line-height: 13px; font-weight: bold; overflow-wrap: anywhere; }
.ui-album-slot.off { background: #f1e8d2; border-style: dashed; border-color: #d8c6a0; }
.ui-album-slot.off .pic { filter: brightness(0) opacity(.22); }
.ui-album-slot.off .name { color: #9a8a74; }
.ui-album-slot .how { font-size: 10px; line-height: 12px; color: #8a7a64; margin-top: 2px; overflow-wrap: anywhere; }
.ui-album-slot.fresh { border-color: #feae34; box-shadow: 0 0 0 2px #fee761; }
.ui-album-slot.fresh::before { content: attr(data-new); position: absolute; top: -7px; left: 50%; transform: translateX(-50%);
  padding: 0 5px; border-radius: 6px; background: #e43b44; color: #fff; font-size: 9px; line-height: 13px; white-space: nowrap; }
.ui-album-nav { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin: 0 8px 8px; }
.ui-album-nav .ui-chip { min-width: 52px; }
.ui-album-nav span { font-size: 12px; color: #6a5a4a; }
.ui-album-close { margin: 0 8px 10px; width: calc(100% - 16px); }
@media (max-width: 370px) { .ui-album-tab { width: 36px; height: 36px; font-size: 18px; line-height: 30px; } }
@media (prefers-reduced-motion: reduce) { .ui-album-page.turn { animation: none; } }
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

/** Кнопка альбома в профиле: сколько наборов собрано и метка «Новое», если есть что посмотреть. */
export function albumButton(state: StoreState, open: () => void): HTMLButtonElement {
  styles();
  const b = button(t('col.button', { n: setsDone(state), max: SET_IDS.length }), open, 'ui-btn secondary ui-album-btn');
  const n = freshCount(state);
  if (n) {
    const tag = el('span', 'ui-album-new', t('col.new'));
    tag.title = t('col.newMany', { n });
    b.append(tag);
  }
  return b;
}

/** С какой страницы открыть: где есть новое, иначе первый несобранный набор. */
function firstPage(state: StoreState): number {
  const fresh = COLLECTION_SETS.findIndex((s) => s.items.some((i) => isFresh(state, s.id, i.id)));
  if (fresh >= 0) return fresh;
  const open = COLLECTION_SETS.findIndex((s) => !setDone(state, s.id));
  return Math.max(0, open);
}

const itemHint = (set: CollectionSet, item: CollectionItem): string =>
  t(item.hintKey ?? setHint(set.id), { ...item.hintParams });

/**
 * Книга альбома. save — сохранить состояние без звука (сняли метки «новое», альбом добрал заработанное);
 * onClose — перерисовать то, что под окном.
 */
export function showAlbum(getState: () => StoreState, save: (next: StoreState) => void, onClose?: () => void): void {
  styles();
  // Заработанное, но ещё не отмеченное (например, сразу после обновления) — в альбом до показа.
  const synced = syncCollections(getState());
  if (synced !== getState()) save(synced);
  const { card, close } = openModal();
  const calm = liteMode();
  let page = firstPage(getState());
  /** Что было новым при открытии страницы: метка держится, пока страница на экране. */
  let shownFresh = new Set<string>();

  const render = (dir = 0) => {
    const state = getState();
    const golden = albumGolden(state);
    card.className = `ui-card ui-album${golden ? ' gold' : ''}`;
    card.replaceChildren();
    const set = COLLECTION_SETS[page];
    shownFresh = new Set(set.items.filter((i) => isFresh(state, set.id, i.id)).map((i) => i.id));
    // Страница открыта — её «новое» уже увидели (метка на ней остаётся до перелистывания).
    const seen = seeAlbum(state, set.id);
    if (seen !== state) save(seen);

    const cover = el('div', 'ui-album-cover');
    cover.append(
      el('h2', '', `📖 ${t(golden ? 'col.titleGolden' : 'col.title')}`),
      el('div', 'ui-muted', t(golden ? 'col.coverGolden' : 'col.cover')),
      el('div', 'ui-album-count', t('col.progress', { n: setsDone(state), max: SET_IDS.length })),
    );

    const tabs = el('div', 'ui-album-tabs');
    COLLECTION_SETS.forEach((s, i) => {
      const tab = button(s.icon, () => go(i), `ui-album-tab${i === page ? ' on' : ''}${setDone(state, s.id) ? ' done' : ''}`);
      tab.title = t(setName(s.id));
      const fresh = i === page ? 0 : s.items.filter((it) => isFresh(getState(), s.id, it.id)).length;
      if (fresh) tab.append(el('span', 'ui-tab-dot', String(fresh)));
      tabs.append(tab);
    });

    const got = gotIn(state, set.id);
    const have = set.items.filter((i) => got.includes(i.id)).length;
    const done = setDone(state, set.id);
    const sheet = el('div', `ui-album-page${dir && !calm ? ' turn' : ''}`);
    if (dir) sheet.style.setProperty('--from', `${dir * 14}px`);
    const head = el('div', 'ui-album-head');
    const pic = el('img', done ? '' : 'off');
    pic.src = sheetPng(trophyKey(set.id));
    pic.alt = '';
    const title = el('div');
    title.append(el('b', '', t(setName(set.id))), el('span', 'ui-muted', t('col.progress', { n: have, max: set.items.length })));
    head.append(pic, title);
    const bar = el('div', `ui-album-bar${done ? ' done' : ''}`);
    const fill = el('i');
    fill.style.width = `${Math.round((have / set.items.length) * 100)}%`;
    bar.append(fill);
    const trophy = t(`col.trophy.${set.id}` as TextKey);
    const reward = done
      ? t('col.doneLine', { name: trophy })
      : set.coins
        ? t('col.reward', { name: trophy, money: setCoins(state.level) })
        : t('col.rewardGuests', { name: trophy, money: ALBUM_REWARD.money, r: ALBUM_REWARD.rating });
    sheet.append(head, bar, el('div', 'ui-album-reward', reward));
    if (!done) sheet.append(el('div', 'ui-album-reward', t('col.how', { hint: t(setHint(set.id)) })));

    const grid = el('div', 'ui-album-grid');
    for (const item of set.items) {
      const own = got.includes(item.id);
      const slot = el('div', `ui-album-slot${own ? '' : ' off'}${shownFresh.has(item.id) ? ' fresh' : ''}`);
      slot.dataset.new = t('col.new');
      slot.append(el('div', 'pic', item.icon), el('div', 'name', own ? t(item.nameKey) : '???'));
      // Своя подсказка у предмета (день, цена, праздник) — под силуэтом; общая — одна над сеткой.
      if (!own && (item.hintKey || item.hintParams)) slot.append(el('div', 'how', itemHint(set, item)));
      grid.append(slot);
    }
    sheet.append(grid);

    const nav = el('div', 'ui-album-nav');
    nav.append(
      button(t('col.prev'), () => go(page - 1), 'ui-chip', page === 0),
      el('span', '', `${page + 1} / ${COLLECTION_SETS.length}`),
      button(t('col.next'), () => go(page + 1), 'ui-chip', page === COLLECTION_SETS.length - 1),
    );
    card.append(cover, tabs, sheet, nav, button(t('col.close'), finish, 'ui-btn ui-album-close'));
    swipe(sheet);
  };

  const go = (i: number) => {
    if (i < 0 || i >= COLLECTION_SETS.length || i === page) return;
    const dir = i > page ? 1 : -1;
    page = i;
    haptic.tap();
    sound.tap();
    render(dir);
  };

  /** Листать пальцем: смахнул страницу влево — следующая, вправо — предыдущая. */
  const swipe = (sheet: HTMLElement) => {
    let x0: number | null = null;
    let y0 = 0;
    sheet.addEventListener('pointerdown', (e) => {
      x0 = e.clientX;
      y0 = e.clientY;
    });
    sheet.addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      const dy = e.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(page + (dx < 0 ? 1 : -1));
    });
    sheet.addEventListener('pointercancel', () => (x0 = null));
  };

  const finish = () => {
    close();
    onClose?.();
  };

  render();
}
