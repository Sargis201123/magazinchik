// Ломбард в подсобке (game/pawnshop.ts) в меню утра.
// Гость с вещью — одна из новостей утра (game/headlines.ts, не больше одной за утро): кто, что, сколько просит, на
// сколько дней и сколько вернёт; «Взять» или «Отказать». Что случилось с залогами (выкупили, не пришли, продали
// с полки, полиция) — одной строкой в «Почте» (ui/mail.ts), без своей карточки и «Понятно» (13.11, по ревью).
// В «Уголках» — плитка ломбарда: что в залоге, что на полке «Разное», итог.
// Вещи везде — те же пиксельные картинки, что на полке в подсобке (art/pawnshop.py), а не эмодзи: эмодзи часов
// и фотоаппарата в пиксельный набор окна не входят и выглядели бы чужими.

import { t, type TextKey } from '../i18n';
import type { StoreState } from '../game/economy';
import { pawnNews, pawnOf, pawnOffer, pawnSlots, refusePawn, seePawnNews, takePawn, type PawnItemId } from '../game/pawnshop';
import { track } from '../platform/analytics';
import { button, el } from './dom';
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

/** Гость с вещью — новость утра (очередь game/headlines.ts выбрала его сегодня). */
export function pawnOfferBox(state: StoreState, getState: () => StoreState, update: Update): HTMLElement[] {
  const offer = pawnOffer(state);
  if (!offer) return [];
  const box = el('div', 'ui-box ui-pawn');
  box.append(el('b', '', `🏷 ${t('pawn.title')}`));
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
        const next = takePawn(getState());
        if (!next) return;
        track('pawn', next.day, offer.lent);
        update(next, 'success');
      },
      'ui-chip hood-buy',
      short,
    ),
    button(t('pawn.refuse'), () => update(refusePawn(getState())), 'ui-chip'),
  );
  body.append(actions);
  const big = itemImg(offer.item, 36);
  big.style.alignSelf = 'center';
  row.append(big, body);
  box.append(row);
  return [box];
}

/** Плитка «Ломбард» в «Уголках»: залоги, полка «Разное», итог. */
export function pawnBox(state: StoreState): HTMLElement[] {
  const p = pawnOf(state);
  const box = el('div', 'ui-box');
  box.append(el('b', '', `🏷 ${t('pawn.title')}`), el('div', 'ui-muted', t('pawn.note')), el('div', '', t('pawn.loans', { n: p.loans.length, max: pawnSlots(state) })));
  for (const loan of p.loans) box.append(itemLine(loan.item, t('pawn.loan', { item: itemName(loan.item), back: loan.back, d: Math.max(1, loan.due - state.day) })));
  box.append(el('b', '', t('pawn.shelf')));
  if (!p.shelf.length) box.append(el('div', 'ui-muted', t('pawn.empty')));
  for (const s of p.shelf) box.append(itemLine(s.item, t('pawn.forSale', { item: itemName(s.item), n: s.price })));
  if (state.pawn) box.append(el('div', 'ui-muted', t('pawn.stats', { n: p.earned, k: p.seized?.length ?? 0 })));
  return [box];
}
