// Ученик в утреннем меню (game/apprentice.ts, 13.11): предложение взять подростка в ученики, его карточка во
// вкладке «Персонал» (где сегодня, доверие, полоски навыков и живые факты, стипендия, похвала) и история утра,
// когда он отучился и открыл свою лавку — другом или конкурентом. Строчки утра — что его тревожит и как
// поживают лавки выпускников.

import { t, type TextKey } from '../i18n';
import type { StoreState } from '../game/economy';
import {
  APPR_NAMES,
  APPR_POSTS,
  APPR_SKILLS,
  apprDay,
  apprNews,
  apprScan,
  apprPatience,
  apprWorry,
  canPraise,
  declineAppr,
  FRIEND_FROM,
  FRIEND_GUESTS,
  FRIEND_SUPPLIES,
  gradsOf,
  gradToday,
  nextApprName,
  praiseAppr,
  RIVAL_GUESTS,
  SEASON,
  seeApprNews,
  setApprPay,
  setApprPost,
  SKILL_CAP,
  skillOf,
  specOf,
  STIPEND,
  takeAppr,
  type ApprGrad,
} from '../game/apprentice';
import { button, el, who } from './dom';

type Update = (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void;

/** Имя ученика по номеру (список appr.names переводится). */
export const apprName = (n: number): string => t('appr.names').split(',')[n % APPR_NAMES]?.trim() || '…';
/** Портрет: чётные имена — мальчик (appr0), нечётные — девочка (appr1). */
const face = (n: number, mood?: 'happy' | 'angry'): string => `appr${n % 2}${mood ? `_${mood}` : ''}`;
const pct = (k: number): number => Math.round(k * 100);

/** Чем лавка выпускника отзывается магазину. */
const gainText = (g: ApprGrad): string =>
  !g.friend ? t('appr.gain.rival', { p: pct(RIVAL_GUESTS) }) : g.spec === 'stock' ? t('appr.gain.supplies', { p: pct(FRIEND_SUPPLIES) }) : t('appr.gain.guests', { p: pct(FRIEND_GUESTS) });

/** Утро: подросток просится в ученики. */
export function apprOfferBox(state: StoreState, getState: () => StoreState, update: Update): HTMLElement[] {
  const n = nextApprName(state);
  const name = apprName(n);
  const box = el('div', 'ui-box ui-tale');
  box.append(
    el('h3', '', t('appr.offer.title')),
    who(face(n), el('b', '', name)),
    el('p', '', t('appr.offer.text', { name })),
    el('div', 'ui-note', t('appr.offer.note', { n: STIPEND })),
    button(t('appr.offer.yes'), () => update(takeAppr(getState()), 'success')),
    button(t('appr.offer.no'), () => update(declineAppr(getState())), 'ui-btn secondary'),
  );
  return [box];
}

/** Утро после выпуска: своя лавка — друг или конкурент. */
export function apprOutBox(state: StoreState, getState: () => StoreState, update: Update): HTMLElement[] {
  const g = apprNews(state);
  if (!g) return [];
  const name = apprName(g.name);
  const box = el('div', 'ui-box ui-tale');
  box.append(
    el('h3', '', t('appr.out.title', { name })),
    who(face(g.name, g.friend ? 'happy' : 'angry'), el('b', '', name)),
    el('p', '', t(g.friend ? 'appr.out.friend' : 'appr.out.rival', { name })),
    el('div', 'ui-muted', t('appr.out.spec', { what: t(`appr.spec.${g.spec}` as TextKey) })),
    el('div', 'ui-note', gainText(g)),
    button(t(g.friend ? 'appr.out.okFriend' : 'appr.out.okRival'), () => update(seeApprNews(getState()), g.friend ? 'success' : 'tap')),
  );
  return [box];
}

/** Полоска 0…1 своим цветом. */
function bar(part: number, color: string): HTMLElement {
  const b = el('div', 'ui-bar');
  const fill = el('div', 'ui-bar-fill');
  fill.style.width = `${Math.round(Math.max(0, Math.min(1, part)) * 100)}%`;
  fill.style.background = color;
  b.append(fill);
  return b;
}

/** Карточка ученика во вкладке «Персонал» (null — ученика нет). */
export function apprCard(state: StoreState, getState: () => StoreState, update: Update): HTMLElement | null {
  const a = state.appr;
  if (!a) return null;
  const name = apprName(a.name);
  const box = el('div', 'ui-box ui-staff');
  const head = el('div');
  head.append(el('b', '', t('appr.title', { name })), el('div', 'ui-item-sub', t('appr.day', { n: apprDay(state), total: SEASON })));
  box.append(who(face(a.name), head, true), el('b', '', t('appr.where')));
  // Где сегодня: касса, склад, зал или выходной — выбор держится, пока его не сменят.
  const posts = el('div', 'ui-chips');
  for (const p of APPR_POSTS) posts.append(button(t(`appr.post.${p}` as TextKey), () => update(setApprPost(getState(), p)), `ui-chip${a.post === p ? ' active' : ''}`));
  const now =
    a.post === 'till'
      ? t('appr.now.till', { p: pct(apprScan(state) - 1) })
      : a.post === 'floor'
        ? t('appr.now.floor', { p: pct(apprPatience(state) - 1) })
        : t(`appr.now.${a.post}` as TextKey);
  box.append(posts, el('div', 'ui-item-sub', now));
  // Доверие и что его сегодня тревожит (прогноз на вечер по сегодняшнему выбору).
  const worry = apprWorry(state);
  const trustColor = a.trust >= FRIEND_FROM ? '#63c74d' : a.trust >= 35 ? '#feae34' : '#e43b44';
  // Как растёт доверие и чем кончится учёба — за «❔» (не ui-muted: иначе вкладка спрячет ещё раз, tuckNotes).
  const note = el('div', 'ui-help-text', t('appr.trustNote', { n: FRIEND_FROM }));
  note.hidden = true;
  const help = button('❔', () => {
    note.hidden = !note.hidden;
    help.classList.toggle('active', !note.hidden);
  }, 'ui-help-btn ui-help-inline');
  const trust = el('div', 'ui-item-sub', t('appr.trust', { n: Math.round(a.trust) }));
  trust.append(help);
  box.append(trust, note, bar(a.trust / 100, trustColor), el('div', 'ui-item-sub', t(`appr.worry.${worry ?? 'ok'}` as TextKey)));
  // Чему научился: дни на каждом месте полосками; сильнее всего — то, кем он станет.
  const growth = el('div', 'ui-career-log');
  const top = specOf(a);
  for (const s of APPR_SKILLS) {
    const label = `${t(`appr.skill.${s}` as TextKey)}${(a.skill[top] ?? 0) > 0 && s === top ? ' ★' : ''}`;
    growth.append(el('div', 'ui-item-sub', label), bar(skillOf(a, s) / SKILL_CAP, '#5fcde4'));
  }
  // Живые факты: что он уже сделал у тебя.
  for (const s of APPR_SKILLS) if (a.deeds?.[s]) growth.append(el('div', 'ui-item-sub', t(`appr.fact.${s}` as TextKey, { n: a.deeds[s]! })));
  if (a.paid) growth.append(el('div', 'ui-item-sub', t('appr.fact.paid', { n: a.paid })));
  if (a.tips) growth.append(el('div', 'ui-item-sub', t('appr.fact.tips', { n: a.tips })));
  box.append(growth);
  // Стипендия и похвала.
  const pay = el('div', 'ui-chips');
  pay.append(
    el('span', 'ui-item-sub', t('appr.pay', { n: STIPEND })),
    button(t('appr.payOn'), () => update(setApprPay(getState(), true)), `ui-chip${a.unpaid ? '' : ' active'}`),
    button(t('appr.payOff'), () => update(setApprPay(getState(), false)), `ui-chip${a.unpaid ? ' active' : ''}`),
  );
  const praise = canPraise(state);
  box.append(pay, button(t(praise ? 'appr.praise' : 'appr.praised'), () => update(praiseAppr(getState()), 'success'), 'ui-btn secondary', !praise));
  return box;
}

/** Лавки выпускников — строчками под персоналом. */
export function gradLines(state: StoreState): HTMLElement[] {
  return gradsOf(state).map((g) => el('div', 'ui-muted', t('appr.grad', { name: apprName(g.name), gain: gainText(g) })));
}

/** Строчки «Сегодня»: что тревожит ученика при сегодняшнем выборе; раз в неделю — весточка от выпускника. */
export function apprLines(state: StoreState): HTMLElement[] {
  const out: HTMLElement[] = [];
  const worry = apprWorry(state);
  if (state.appr && worry) out.push(el('div', 'ui-muted', t('appr.line.worry', { name: apprName(state.appr.name), text: t(`appr.worry.${worry}` as TextKey) })));
  const g = gradToday(state);
  if (g) out.push(el('div', 'ui-muted', t(g.friend ? 'appr.line.friend' : 'appr.line.rival', { name: apprName(g.name) })));
  return out;
}
