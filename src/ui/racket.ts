// «Крыша» в утреннем окне (game/racket.ts): ребята в кожанках у входа и три ответа — платить, отказать или в
// полицию; потом строка «Сегодня» (доля недели, пакость этого утра, сколько ещё злятся) и новость об исходе.
// Файл — в сборке утреннего окна, не в основном коде.

import { t, type TextKey } from '../i18n';
import type { StoreState } from '../game/economy';
import { JAILED_GOODWILL, RACKET_MODES, RACKET_RATE, racketHit, racketShare, type RacketMode, type RacketState } from '../game/racket';
import { openCaseOf } from '../game/cases';
import { button, el, who } from './dom';

/** Первый визит (morning.ts — вместо меню, как беда района): решить сразу, меню подождёт. */
export function racketChoiceBox(state: StoreState, choose: (mode: RacketMode) => void): HTMLElement {
  const box = el('div', 'ui-box');
  const n = RACKET_RATE;
  box.append(el('h3', '', t('racket.title')), who('racket_tolik', el('b', '', t('racket.who'))), el('p', '', t('racket.text', { n })));
  for (const mode of RACKET_MODES) {
    box.append(
      // Платить — не «правильная» зелёная кнопка: спокойствие за деньги, выбор взрослого.
      button(t(`racket.mode.${mode}` as TextKey, { n }), () => choose(mode), mode === 'pay' ? 'ui-btn secondary' : 'ui-btn'),
      el('div', 'ui-muted', t(`racket.mode.${mode}.hint` as TextKey, { sum: racketShare(state, n) })),
    );
  }
  return box;
}

/** Строки «Сегодня»: что стряслось утром и что дальше (доля через сколько дней, сколько ещё пакостят, дело ждёт). */
export function racketLines(state: StoreState, stop: (mode: 'refuse' | 'police') => void): HTMLElement[] {
  const r = state.racket;
  if (!r?.mode || r.end) return [];
  const out: HTMLElement[] = [];
  const hit = racketHit(state);
  if (hit) out.push(el('div', 'ui-note', t(`racket.hit.${hit.kind}` as TextKey, { sum: hit.cost })));
  const since = r.since ?? r.from;
  if (r.mode === 'pay') {
    // 14.11: выход из «крыши» всегда под рукой — на потолке ставки эхо больше не спрашивает (racket.ts stopPaying).
    const line = el('div', 'ui-muted', t('racket.line.pay', { n: r.rate ?? RACKET_RATE, d: 7 - ((state.day - since) % 7) }));
    line.append(el('br'), button(t('racket.stop.refuse'), () => stop('refuse'), 'ui-chip secondary'), ' ', button(t('racket.stop.police'), () => stop('police'), 'ui-chip secondary'));
    out.push(line);
  }
  else if (r.mode === 'refuse') out.push(el('div', 'ui-muted', t('racket.line.refuse', { d: Math.max(1, (r.until ?? state.day) - state.day + (state.day > since ? 1 : 0)) })));
  // Дело о «крыше» ещё не открылось: идёт другое (его строчку видно выше) — заявление ждёт.
  else if (openCaseOf(state)?.id !== 'racket') out.push(el('div', 'ui-muted', t('racket.line.police')));
  return out;
}

/** Исход — новостью утра: взяли (портрет сержанта, доброе имя), дело развалилось или ребята отстали сами. */
export function racketNewsBox(news: NonNullable<RacketState['news']>, ok: () => void): HTMLElement[] {
  const box = el('div', 'ui-box ui-tale');
  const jailed = news.kind === 'jailed';
  box.append(
    el('b', '', t('racket.news.title')),
    who(jailed ? 'police_happy' : news.kind === 'free' ? 'racket_tolik_angry' : 'valya_happy', el('b', '', t(jailed ? 'case.racket.victim' : news.kind === 'free' ? 'racket.who' : 'echo.racketThanks.name')), true),
    el('p', '', t(`racket.news.${news.kind}` as TextKey)),
  );
  if (jailed) box.append(el('div', 'ui-gift-reward', t('racket.news.up', { n: JAILED_GOODWILL })));
  box.append(button(t('racket.ok'), ok, 'ui-chip'));
  return [box];
}
