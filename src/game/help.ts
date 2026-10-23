// «Позвать на помощь» (сервер — api/_lib/share.ts). В час пик или когда очередь растёт, хозяин зовёт
// друзей через Telegram. Друг открывает игру по ссылке — и подмога уходит сама, одним касанием.
// Хозяину при следующем запуске — монеты за каждого друга и быстрая касса на весь день (друзья
// пакуют покупки), другу — монеты за помощь. Сколько раз и кому можно помочь, решает сервер.

import type { StoreState } from './economy';

/** Кнопка «Позвать на помощь» появляется в час пик или когда в очереди столько человек. */
export const HELP_QUEUE = 5;
/** После часа пик (или когда очередь рассосалась) кнопка ещё столько миллисекунд не пропадает. */
export const HELP_HOLD = 8000;
/** В день подмоги касса пробивает быстрее. */
export const HELP_SCAN = 1.25;
/** Хозяину — за каждого друга, пришедшего на помощь. */
export const HELP_THANKS = 150;
/** Другу — за помощь. */
export const HELP_REWARD = 100;

/** Сегодня друзья на подмоге: касса быстрее. */
export const helpScan = (state: StoreState): number => (state.helpDay === state.day ? HELP_SCAN : 1);

/** Сегодня уже звал на помощь — второй раз кнопку не показываем. */
export const helpAsked = (state: StoreState): boolean => state.helpAsked === state.day;

export const markHelpAsked = (state: StoreState, day = state.day): StoreState => ({ ...state, helpAsked: day });

/**
 * Друзья откликнулись: монеты за каждого и быстрая касса. Забирают подмогу при запуске игры — до
 * утра, поэтому она достаётся дню, который сейчас начнётся.
 */
export function takeHelp(state: StoreState, friends: number): StoreState {
  if (friends <= 0) return state;
  return { ...state, money: state.money + friends * HELP_THANKS, helpDay: state.day };
}

/** Помог другу — монеты за помощь. */
export const helpGiven = (state: StoreState): StoreState => ({ ...state, money: state.money + HELP_REWARD });
