// Ломбард (game/pawnshop.ts): карточка и утренние строки.
// Гость с вещью — одна из новостей утра (game/headlines.ts, не больше одной за утро): кто, что, сколько просит, на
// сколько дней и сколько вернёт; «Взять» или «Отказать». Что случилось с залогами (выкупили, не пришли, продали
// с полки, полиция) — одной строкой в «Почте» (ui/mail.ts), без своей карточки и «Понятно» (13.11, по ревью).
// Вещи везде — те же пиксельные картинки, что в мире (art/pawnshop.py), а не эмодзи: эмодзи часов
// и фотоаппарата в пиксельный набор окна не входят и выглядели бы чужими.
//
// 15.11, автор: «Ломбард тоже мне непонятен — может убрать из меню и в подвале его держать как комнату». Плитки
// в «Уголках» больше нет. Карточку открывает касание двери «Подсобка» в зале или окошка ломбарда в подвале
// (scenes/pawnFx.ts, floors/basementFloor.ts), а с подвалом — ещё строка «Ломбард в подвале» в «Развитии → Этажи».
// В карточке по порядку: как это работает (одна строка), «Сегодня» (гость, который ждёт ответа, или что стало
// с залогами этим утром), что в залоге, полка «Разное», итог. Гость, которого утро не показало (очередь новостей
// выбрала другую), ждёт весь день — здесь, в «Сегодня».

import { t, type TextKey } from '../i18n';
import type { StoreState } from '../game/economy';
import { pawnNews, pawnOf, pawnOffer, pawnPlace, pawnSlots, refusePawn, seePawnNews, takePawn, type PawnItemId } from '../game/pawnshop';
import type { NewsId } from '../game/headlines';
import { track } from '../platform/analytics';
import { button, el, openModal } from './dom';
import { sheetPng } from './sheet';

type Update = (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void;

const itemName = (id: PawnItemId): string => t(`pawn.item.${id}` as TextKey);

/** Картинка вещи: 12×12 пикселей, увеличенная ровно (без сглаживания). */
function itemImg(id: PawnItemId, size: number): HTMLElement {
  const img = el('img');
  img.src = sheetPng(`pawn_${id}`);
  img.alt = '';
  img.style.cssText = `width: ${size}px; height: ${size}px; image-rendering: pixelated; flex: none;`;
  return img;
}

/** Строка с картинкой вещи слева. */
function itemLine(id: PawnItemId, text: string, cls = 'ui-item-sub'): HTMLElement {
  const row = el('div', cls);
  row.style.cssText = 'display: flex; align-items: center; gap: 6px;';
  row.append(itemImg(id, 24), el('span', '', text));
  return row;
}

/** Где ломбард: дверь «Подсобка» в зале или окошко в подвале — одной строкой (утро, карточка гостя). */
const whereLine = (state: StoreState): string => t(pawnPlace(state) === 'basement' ? 'pawn.where.down' : 'pawn.where.hall');

/**
 * Строка «Почты»: что этим утром стало с залогами — все события одной строкой (деньги уже в кассе с ночи). Забрать —
 * только отметить прочитанным. taken — строку уже забрали (после «Забрать всё» она остаётся бледной).
 */
export function pawnMail(state: StoreState, taken: boolean, getState: () => StoreState, update: (next: StoreState) => void): { icon: string; text: string; take: () => boolean } | null {
  const events = pawnNews(state, taken);
  if (!events.length) return null;
  return {
    icon: events.some((e) => e.kind === 'police') ? '👮' : '🏷',
    text: events.map((e) => t(`pawn.ev.${e.kind}`, { item: itemName(e.item), n: e.n })).join(' · '),
    take: () => {
      update(seePawnNews(getState()));
      return true;
    },
  };
}

/** Гость с вещью: кто, что просит, примета и «Взять» / «Отказать». В новости утра — ещё и где ломбард (where). */
function offerBody(state: StoreState, getState: () => StoreState | null, update: Update, where: boolean): HTMLElement | null {
  const offer = pawnOffer(state);
  if (!offer) return null;
  const row = el('div', 'ui-item');
  const body = el('div');
  const short = state.money < offer.lent;
  body.append(
    el('div', 'ui-item-name', `${t(`pawn.who.${offer.item}` as TextKey)} · ${itemName(offer.item)}`),
    el('div', 'ui-item-sub', `«${t(`pawn.say.${offer.item}` as TextKey)}»`),
    el('div', '', t('pawn.ask', { lent: offer.lent, days: offer.days })),
    el('div', '', t('pawn.back', { back: offer.back, p: Math.round(offer.rate * 100) })),
    el('div', 'ui-item-sub', `👀 ${t(`pawn.tell.${offer.tell}${offer.tellN}` as TextKey)}`),
  );
  if (short) {
    const note = el('div', 'ui-note', t('pawn.noMoney'));
    note.style.color = '#b13e53';
    body.append(note);
  }
  const actions = el('div', 'ui-chips');
  actions.style.marginTop = '6px';
  actions.append(
    button(
      t('pawn.take'),
      () => {
        // null — день уже другой (карточка закрывается): гость не тот, что на экране.
        const cur = getState();
        const next = cur && takePawn(cur);
        if (!next) return;
        track('pawn', next.day, offer.lent);
        update(next, 'success');
      },
      'ui-chip hood-buy',
      short,
    ),
    button(
      t('pawn.refuse'),
      () => {
        const cur = getState();
        if (cur) update(refusePawn(cur));
      },
      'ui-chip',
    ),
  );
  body.append(actions);
  if (where) body.append(el('div', 'ui-muted', whereLine(state)));
  const big = itemImg(offer.item, 36);
  big.style.alignSelf = 'center';
  row.append(big, body);
  return row;
}

/** Гость с вещью — новость утра (очередь game/headlines.ts выбрала его сегодня). */
export function pawnOfferBox(state: StoreState, getState: () => StoreState, update: Update): HTMLElement[] {
  const body = offerBody(state, getState, update, true);
  if (!body) return [];
  const box = el('div', 'ui-box ui-pawn');
  box.append(el('b', '', `🏷 ${t('pawn.title')}`), body);
  return [box];
}

/**
 * Строка сводки утра: гость с вещью пришёл, а новостью утра стал не он (picked — какую выбрала очередь). Ответить
 * можно днём — у двери «Подсобка» или окошка в подвале (там светится метка).
 */
export function pawnLines(state: StoreState, picked: NewsId | null): HTMLElement[] {
  if (picked === 'pawn' || !pawnOffer(state)) return [];
  return [el('div', '', t(pawnPlace(state) === 'basement' ? 'pawn.wait.down' : 'pawn.wait.hall'))];
}

/** Тело карточки: как это работает, «Сегодня», залоги, полка «Разное», итог. */
function cardBody(state: StoreState, getState: () => StoreState | null, update: Update): HTMLElement[] {
  const p = pawnOf(state);
  const how = el('div', 'ui-muted', t('pawn.how'));
  const today = el('div', 'ui-box');
  today.append(el('b', '', t('pawn.today')));
  const offer = offerBody(state, getState, update, false);
  const events = pawnNews(state, true);
  if (offer) today.append(offer);
  for (const e of events) today.append(itemLine(e.item, t(`pawn.ev.${e.kind}`, { item: itemName(e.item), n: e.n })));
  // Сегодняшнему гостю уже ответили: взяли вещь (она в залоге с сегодняшнего дня) или отказали.
  const took = p.loans.filter((l) => l.day === state.day);
  for (const l of took) today.append(itemLine(l.item, t('pawn.tookToday', { item: itemName(l.item), back: l.back, d: l.due - state.day })));
  const refused = !took.length && p.answered === state.day;
  if (refused) today.append(el('div', 'ui-muted', t('pawn.refusedToday')));
  if (!offer && !events.length && !took.length && !refused) today.append(el('div', 'ui-muted', t('pawn.quiet')));
  const stock = el('div', 'ui-box');
  stock.append(el('b', '', t('pawn.loans', { n: p.loans.length, max: pawnSlots(state) })));
  for (const loan of p.loans) stock.append(itemLine(loan.item, t('pawn.loan', { item: itemName(loan.item), back: loan.back, d: Math.max(1, loan.due - state.day) })));
  stock.append(el('b', '', t('pawn.shelf')));
  if (!p.shelf.length) stock.append(el('div', 'ui-muted', t('pawn.empty')));
  for (const s of p.shelf) stock.append(itemLine(s.item, t('pawn.forSale', { item: itemName(s.item), n: s.price })));
  if (state.pawn) stock.append(el('div', 'ui-muted', t('pawn.stats', { n: p.earned, k: p.seized?.length ?? 0 })));
  return [how, today, stock];
}

/**
 * Карточка ломбарда окном поверх игры (касание двери, окошка или строки в «Этажах»). Взяли или отказали — окно
 * перерисовывается на месте: гость ушёл, вещь уже в залоге. update — как у утра: новое состояние и отклик.
 */
export function openPawnCard(getState: () => StoreState, update: Update): void {
  const { card, close } = openModal();
  // 15.11, ревью: день идёт и при открытой карточке. Кончился — на экране вчерашний гость, а «Взять» взяло бы
  // сегодняшнего (другая вещь, другая сумма). Поэтому карточка живёт один день: сменился день — закрываем, кнопки
  // ничего не делают.
  const day = getState().day;
  let open = true;
  const shut = (): void => {
    if (!open) return;
    open = false;
    clearInterval(watch);
    close();
  };
  const watch = setInterval(() => {
    if (!card.isConnected || getState().day !== day) shut();
  }, 1000);
  const live = (): StoreState | null => {
    const s = getState();
    if (s.day === day) return s;
    shut();
    return null;
  };
  const draw = (): void => {
    const state = live();
    if (!state) return;
    const head = el('h3', '', `🏷 ${t('pawn.title')}`);
    card.replaceChildren(
      head,
      ...cardBody(state, live, (next, feedback) => {
        update(next, feedback);
        draw();
      }),
      button(t('pawn.close'), shut, 'ui-btn secondary'),
    );
  };
  draw();
}
