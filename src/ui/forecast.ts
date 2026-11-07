// Строки прогноза погоды (game/forecast.ts): у закупки утром — что сегодня берут чаще, в итогах дня — прогноз
// на завтра. Множители — с одним знаком после запятой, как принято в языке игрока.

import { getLang, t, type TextKey } from '../i18n';
import { boostList, weatherBoosts, weatherOf } from '../game/forecast';
import type { StoreState } from '../game/economy';

const fmt = (k: number): string => {
  const n = Math.round(k * 10) / 10;
  return getLang() === 'en' ? String(n) : String(n).replace('.', ',');
};

/** «🥵 Сегодня жара — берут чаще: 🍦 ×2,5 · 💧 ×2,2 · 🧃 ×1,6» (when — сегодня или завтра). Пусто — погода спрос не поднимает. */
export function forecastLine(state: StoreState, day: number, when: 'today' | 'tomorrow'): string {
  const boosts = weatherBoosts(state, day);
  if (!boosts.length) return '';
  const { weather, icon } = weatherOf(day);
  return t(`weatherStock.${when}` as TextKey, { icon, name: t(`weather.name.${weather}` as TextKey), list: boostList(boosts, fmt) });
}
