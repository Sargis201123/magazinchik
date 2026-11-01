// Подарки друзьям (game/social.ts, api/_lib/presents.ts): окно «Оставить подарок» в гостях у друга,
// утренняя карточка «Подарки от друзей» и полка памяти в профиле — открытки друзей и кубки турнира.

import { t, type TextKey } from '../i18n';
import { track } from '../platform/analytics';
import { haptic } from '../platform/telegram';
import { givePresent, openPresentsBox, presentsInfo } from '../platform/presents';
import { openPresents, PHRASES, PRESENT_ICON, PRESENT_KINDS, presentGift, TIER_ICON, type Keepsake, type Present, type PresentKind } from '../game/social';
import type { StoreState } from '../game/economy';
import { button, el, openModal, toast } from './dom';

const STYLE = `
.ui-gift-kinds { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 6px 0; }
.ui-gift-kinds .ui-chip { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 2px; white-space: normal; line-height: 1.15; }
.ui-gift-phrases { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0; }
.ui-gift-phrases .ui-chip { flex: 1 1 auto; text-align: left; white-space: normal; font-size: 12px; min-height: 32px; padding: 4px 7px; }
.ui-gift-stars { display: flex; gap: 4px; margin: 4px 0 8px; }
.ui-gift-stars .ui-chip { flex: 1; min-width: 0; padding: 5px 0; }
.ui-gift-stars .ui-chip.ui-chip-off { opacity: .55; }
.ui-gift-card { border: 2px dashed #b86f50; border-radius: 8px; background: #fff8ec; padding: 8px 10px; margin: 6px 0; }
.ui-gift-card i { display: block; color: #5d3a2a; margin: 2px 0; }
.ui-keep { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0; }
.ui-keep span { border: 2px solid #2b2233; border-radius: 6px; background: #fff8ec; padding: 3px 6px; font-size: 12px; }
`;
let styled = false;
export function socialStyles(): void {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const style = el('style');
  style.textContent = STYLE;
  document.head.append(style);
}

const phrase = (n: number): string => t(`social.phrase.${Math.max(0, Math.min(PHRASES - 1, n))}` as TextKey);
const kindName = (kind: PresentKind): string => t(`social.kind.${kind}` as TextKey);
const starLine = (n: number): string => (n > 0 ? '⭐'.repeat(n) : '');

/** Сегодня этому другу уже подарено. */
export const presentGiven = (id: number): boolean => Boolean(presentsInfo()?.given.includes(id));
/** Подарки вообще работают (игра в Telegram, у сервера есть база). */
export const presentsOn = (): boolean => presentsInfo() !== null;

/**
 * Окно «Оставить подарок» в гостях: что подарить, добрая фраза и, по желанию, отзыв звёздами.
 * done(true) — подарок ушёл.
 */
export function showGiftPicker(friend: { id: number; name: string }, day: number, level: number, done: (ok: boolean) => void): void {
  socialStyles();
  const { card, close } = openModal();
  let kind: PresentKind = 'pie';
  let line = Math.floor(Math.random() * PHRASES);
  let stars = 0;
  let busy = false;
  const render = (error = '') => {
    card.replaceChildren(el('h2', '', `🎁 ${t('social.give.title', { name: friend.name })}`), el('div', 'ui-muted', t('social.give.note')));
    const kinds = el('div', 'ui-gift-kinds');
    for (const k of PRESENT_KINDS) {
      const gift = presentGift(level, k);
      const what = gift.card ? t('social.give.forCard') : gift.rating ? t('social.give.forMood') : t('social.give.forCoins', { n: gift.money });
      const chip = button('', () => {
        kind = k;
        haptic.tap();
        render();
      }, `ui-chip${k === kind ? ' active' : ''}`);
      chip.append(el('b', '', `${PRESENT_ICON[k]} ${kindName(k)}`), el('span', 'ui-item-sub', what));
      kinds.append(chip);
    }
    const phrases = el('div', 'ui-gift-phrases');
    for (let i = 0; i < PHRASES; i++) {
      phrases.append(button(`«${phrase(i)}»`, () => {
        line = i;
        haptic.tap();
        render();
      }, `ui-chip${i === line ? ' active' : ''}`));
    }
    const rate = el('div', 'ui-gift-stars');
    for (let n = 1; n <= 5; n++) {
      const chip = button('⭐', () => {
        stars = stars === n ? 0 : n;
        haptic.tap();
        render();
      }, `ui-chip${n <= stars ? '' : ' ui-chip-off'}`);
      chip.ariaLabel = String(n);
      rate.append(chip);
    }
    const send = button(t('social.give.send', { icon: PRESENT_ICON[kind] }), () => {
      if (busy) return;
      busy = true;
      send.disabled = true;
      void givePresent(friend.id, kind, line, stars).then((res) => {
        busy = false;
        if (!res.ok) {
          haptic.error();
          render(t(`social.give.err.${['already', 'limit', 'full', 'friend', 'offline'].includes(res.error ?? '') ? res.error : 'offline'}` as TextKey));
          return;
        }
        track('present_give', day, PRESENT_KINDS.indexOf(kind));
        haptic.success();
        close();
        toast('assets/ico_gift.png', t('social.give.sentTitle'), t('social.give.sent', { name: friend.name }));
        done(true);
      });
    });
    card.append(
      el('b', '', t('social.give.what')),
      kinds,
      el('b', '', t('social.give.phrase')),
      phrases,
      el('b', '', t('social.give.stars')),
      rate,
      ...(error ? [el('div', 'ui-note', error)] : []),
      send,
      button(t('board.close'), () => {
        close();
        done(false);
      }, 'ui-btn secondary'),
    );
  };
  render();
}

/** Окно с открытыми подарками: кто заходил, что оставил, добрая фраза, отзыв и что получили. */
export function showOpened(presents: Present[], thanks: string[], got: { money: number; rating: number; cards: number }, level: number): void {
  socialStyles();
  const { card, close } = openModal();
  card.append(el('h2', '', `🎁 ${t('social.open.title')}`));
  for (const p of presents) {
    const gift = presentGift(level, p.kind);
    const box = el('div', 'ui-gift-card');
    const reward = gift.card ? t('social.open.card.got') : gift.rating ? t('social.open.mood') : t('social.open.coins', { n: gift.money });
    box.append(
      el('b', '', `${PRESENT_ICON[p.kind]} ${t(`social.open.${p.kind}` as TextKey, { name: p.name })}`),
      el('i', '', `«${phrase(p.phrase)}»`),
      ...(p.stars ? [el('div', '', t('social.open.review', { stars: starLine(p.stars) }))] : []),
      el('div', 'ui-item-sub', reward),
    );
    card.append(box);
  }
  if (thanks.length) card.append(el('div', 'ui-note', t('social.open.thanks', { names: [...new Set(thanks)].slice(0, 5).join(', ') })));
  card.append(el('div', 'ui-note', t('social.open.total', { n: got.money })));
  card.append(button(t('social.open.ok'), close, 'ui-btn'));
}

/** Утренняя карточка: подарки от друзей и «спасибо» за мои ждут — открыть. */
export function presentsBox(getState: () => StoreState, update: (next: StoreState, feedback: 'tap' | 'success' | 'error') => void): HTMLElement[] {
  const info = presentsInfo();
  if (!info || (!info.waiting && !info.thanks)) return [];
  socialStyles();
  const box = el('div', 'ui-box ui-duel');
  const text = info.waiting ? t('social.waiting', { n: info.waiting }) : t('social.thanksWaiting', { n: info.thanks });
  const open = button(`🎁 ${t('social.open.btn')}`, () => {
    open.disabled = true;
    void openPresentsBox().then((res) => {
      if (!res) {
        open.disabled = false;
        return;
      }
      const opened = openPresents(getState(), res.presents, res.thanks.length);
      track('present_open', getState().day, res.presents.length);
      update(opened.state, 'success');
      if (res.presents.length || res.thanks.length) showOpened(res.presents, res.thanks, opened, getState().level);
    });
  });
  box.append(el('b', '', `🎁 ${t('social.open.title')}`), el('div', 'ui-note', text), open);
  return [box];
}

/** Полка памяти: открытки от друзей и кубки турнира (в профиле). */
export function keepsakeBox(state: StoreState): HTMLElement[] {
  const list: Keepsake[] = state.keepsakes ?? [];
  if (!list.length) return [];
  socialStyles();
  const box = el('div', 'ui-box');
  box.append(el('b', '', `📨 ${t('social.shelf.title')}`));
  const shelf = el('div', 'ui-keep');
  for (const k of [...list].reverse()) {
    const item = k.k === 'card' ? el('span', '', `📨 ${k.from}`) : el('span', '', `${TIER_ICON[Math.max(0, Math.min(2, k.tier))]} ${t('social.shelf.cup', { place: k.place })}`);
    item.title = k.k === 'card' ? `«${phrase(k.phrase)}»` : t(`league.tier.${k.tier}` as TextKey);
    shelf.append(item);
  }
  box.append(shelf);
  return [box];
}
