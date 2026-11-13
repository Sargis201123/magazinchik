// «Эхо решений» в утреннем окне (game/echoes.ts): герой давней сценки вернулся — карточка новости утра
// с его портретом, что случилось и чем отозвалось, и строка в сводке, пока длится прибавка (или убыль) гостей.
// Лично в зале (гость с «!») — scenes/echoesFx.ts.

import { t, type TextKey } from '../i18n';
import type { StoreState } from '../game/economy';
import { ECHOES, echoBad, echoChoices, echoesOf, echoNews, echoWage, answerEchoNews, type EchoEntry } from '../game/echoes';
import { skitPortrait } from '../game/skits';
import { gainLine } from './skits';
import { button, el, who } from './dom';

type Update = (next: StoreState | null, feedback?: 'tap' | 'success' | 'error') => void;

/** Заголовок, имя и текст эха — общие для карточки утра и разговора в зале. */
export function echoTexts(entry: EchoEntry): { head: string; name: string; text: string; portrait: string } {
  const d = ECHOES[entry.id];
  // Эхо не из сценки (plantEcho других историй) — свои заголовок и имя, портрет по ключу героя.
  const from = d.skit ? `skit.${d.skit}` : `echo.${entry.id}`;
  return {
    head: t('echo.head', { icon: d.icon, title: t(`${from}.title` as TextKey) }),
    name: t((d.skit ? `${from}.cast.${d.who}` : `${from}.name`) as TextKey),
    text: t(`echo.${entry.id}` as TextKey, entry.data),
    portrait: d.skit ? skitPortrait(d.skit, d.who, d.mood) : `portrait_${d.who}`,
  };
}

/** Карточка утра: эхо вернулось — портрет, рассказ, итог и ответ. */
export function echoBox(state: StoreState, getState: () => StoreState, update: Update): HTMLElement[] {
  const entry = echoNews(state);
  if (!entry) return [];
  const d = ECHOES[entry.id];
  const { head, name, text, portrait } = echoTexts(entry);
  const box = el('div', 'ui-box ui-tale');
  // Гость, который не дошёл до зала, говорит сам — в кавычках.
  box.append(el('b', '', head), who(portrait.replace(/^portrait_/, ''), el('b', '', name), true), el('p', '', d.visit ? `«${text}»` : text));
  const choices = echoChoices(state, entry.id);
  const { wage, full } = echoWage();
  for (const [k, { i, effect }] of choices.entries()) {
    const bad = echoBad(effect);
    // Один ответ — итог над кнопкой; у нескольких — у каждого свой текст.
    if (choices.length === 1) {
      const gain = gainLine(effect);
      if (gain) box.append(el('div', bad ? 'ui-note' : 'ui-gift-reward', gain));
    }
    const label = d.choices.length > 1 ? t(`echo.${entry.id}.${i}` as TextKey, { n: wage, full }) : t(bad ? 'echo.ok.bad' : 'echo.ok.good');
    // Плохая новость — спокойная кнопка «принять к сведению», не зелёная «ура».
    box.append(button(label, () => update(answerEchoNews(getState(), entry.id, i), bad ? 'tap' : 'success'), k === 0 && !bad ? 'ui-btn' : 'ui-btn secondary'));
  }
  return [box];
}

/** Строка сводки утра: эхо ещё прибавляет (или отнимает) гостей. */
export function echoLines(state: StoreState): HTMLElement[] {
  const boost = echoesOf(state).boost;
  if (!boost || boost.until < state.day) return [];
  const p = Math.round(Math.abs(boost.pct) * 100);
  return [el('div', boost.pct < 0 ? 'ui-note' : 'ui-muted', t(boost.pct < 0 ? 'echo.dropLine' : 'echo.boostLine', { p, n: boost.until - state.day + 1 }))];
}
