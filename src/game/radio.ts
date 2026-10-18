// Радио в магазине: покупаешь приёмник и выбираешь волну. Музыка меняется вместе с волной,
// и покупатели ведут себя по-разному: под спокойное ретро не спешат — дольше ждут в очереди
// и иногда берут что-то сверх списка; под бодрые хиты быстрее ходят по залу и чаще хватают
// сладкое у кассы, но терпения меньше.

import type { TextKey } from '../i18n/ru';
import type { StoreState } from './economy';

export type Station = 'off' | 'retro' | 'hits';
export const STATIONS: Station[] = ['off', 'retro', 'hits'];

export const STATION_INFO: Record<Station, { icon: string; nameKey: TextKey; descKey: TextKey }> = {
  off: { icon: '🔇', nameKey: 'radio.off', descKey: 'radio.off.desc' },
  retro: { icon: '🎷', nameKey: 'radio.retro', descKey: 'radio.retro.desc' },
  hits: { icon: '🎸', nameKey: 'radio.hits', descKey: 'radio.hits.desc' },
};

export const RADIO_PRICE = 350;

export const hasRadio = (state: StoreState): boolean => state.radio !== undefined;
export const stationOf = (state: StoreState): Station => state.radio ?? 'off';

/** Купить приёмник: сразу играет ретро. */
export function buyRadio(state: StoreState): StoreState | null {
  if (hasRadio(state) || state.money < RADIO_PRICE) return null;
  return { ...state, money: state.money - RADIO_PRICE, radio: 'retro' };
}

export function setStation(state: StoreState, station: Station): StoreState | null {
  if (!hasRadio(state) || state.radio === station) return null;
  return { ...state, radio: station };
}

/** Следующая волна по кругу — для касания по приёмнику в зале. */
export const nextStation = (station: Station): Station => STATIONS[(STATIONS.indexOf(station) + 1) % STATIONS.length];

/** Ретро: в очереди ждут на 12% дольше; хиты: на 5% меньше. */
export const radioPatience = (state: StoreState): number => ({ off: 1, retro: 1.12, hits: 0.95 })[stationOf(state)];
/** Ретро: под спокойную музыку к ценам терпимее — готовы платить на 5% дороже. */
export const RETRO_TOLERANCE = 1.05;
export const radioTolerance = (state: StoreState): number => (stationOf(state) === 'retro' ? RETRO_TOLERANCE : 1);
/** Хиты: покупатели ходят по залу на 20% быстрее. */
export const radioSpeed = (state: StoreState): number => (stationOf(state) === 'hits' ? 1.2 : 1);
/** Хиты: шанс схватить сладкое у кассы +5%. */
export const radioImpulse = (state: StoreState): number => (stationOf(state) === 'hits' ? 0.05 : 0);
