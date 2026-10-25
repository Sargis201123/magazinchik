// «Заглянуть к конкуренту»: из рейтинга (или к боссу через дорогу) — в чужой магазин, где можно
// немного похулиганить: пролить сок, разбросать мусор, позвать покупателя к себе. Проделок —
// RIVAL_ACTIONS в день; за них — немного монет и гости назавтра. Хозяин чужого магазина при
// следующем запуске видит последствия (api/_lib/rival.ts): пару луж и мусор к открытию, пару
// ушедших гостей. Охранник, камеры и уборщица это смягчают; денег у него не убывает.

import type { StoreState } from './economy';
import { gearTier } from './gear';
import { shopSnapshot, type ShopSnapshot } from './friendShop';

export type PrankKind = 'spill' | 'trash' | 'lure';
export const PRANKS: PrankKind[] = ['spill', 'trash', 'lure'];
/** Проделок за день (у босса считаем сами, у игроков — сервер, столько же). */
export const RIVAL_ACTIONS = 3;
/** Монеты за проделку; позванный покупатель придёт к нам назавтра. */
export const PRANK_COINS: Record<PrankKind, number> = { spill: 15, trash: 10, lure: 5 };
export const MAX_BONUS_GUESTS = 3;
/** Кофе от того, кто поблагодарил за визит. */
export const THANK_COINS = 30;
/** Больше стольких луж, мусора и ушедших гостей за день от чужих проделок не бывает. */
export const MAX_SPILLS = 2;
export const MAX_TRASH = 3;
export const MAX_LOST = 2;

/** Кто что натворил у нас (с сервера): ключ — ответить визитом или поблагодарить. */
export interface PrankIn {
  key: string;
  name: string;
  spill: number;
  trash: number;
  lure: number;
}

export interface RivalState {
  /** Проделки у босса через дорогу: в какой день и сколько. */
  boss?: { day: number; used: number };
  /** Позванные к нам гости: в какой день придут и сколько. */
  guests?: { day: number; n: number };
  /** Последствия чужих проделок к открытию этого дня. */
  mess?: { day: number; spill: number; trash: number; lost: number };
}

export type Protection = 'guard' | 'cameras' | 'cleaner';

/** Что показать хозяину утром. */
export interface RivalNews {
  visitors: { key: string; name: string }[];
  spill: number;
  trash: number;
  lost: number;
  /** Что помогло: охранник не пустил, камеры спугнули, уборщица прибрала. */
  helped: Protection[];
  /** Ни охранника, ни уборщицы — подсказать, что они бы помогли. */
  hint: boolean;
}

/** Сколько проделок у босса осталось сегодня. */
export const bossLeft = (state: StoreState): number => Math.max(0, RIVAL_ACTIONS - (state.rival?.boss?.day === state.day ? state.rival.boss.used : 0));

/** Проделка удалась: монеты, а позванный покупатель — к нам назавтра. boss — у босса (счёт свой). */
export function usePrank(state: StoreState, kind: PrankKind, boss: boolean): StoreState {
  const rival = state.rival ?? {};
  const tomorrow = state.day + 1;
  const had = rival.guests?.day === tomorrow ? rival.guests.n : 0;
  return {
    ...state,
    money: state.money + PRANK_COINS[kind],
    rival: {
      ...rival,
      ...(boss ? { boss: { day: state.day, used: (rival.boss?.day === state.day ? rival.boss.used : 0) + 1 } } : {}),
      ...(kind === 'lure' ? { guests: { day: tomorrow, n: Math.min(MAX_BONUS_GUESTS, had + 1) } } : {}),
    },
  };
}

/** Позванные гости и последствия чужих проделок — на сегодня (забираются при открытии). */
export const bonusGuests = (state: StoreState): number => (state.rival?.guests?.day === state.day ? Math.min(MAX_BONUS_GUESTS, state.rival.guests.n) : 0);
export const messToday = (state: StoreState): RivalState['mess'] | null => (state.rival?.mess?.day === state.day ? state.rival.mess : null);

/** Магазин открылся: гости и беспорядок сегодняшнего дня ушли в зал — больше их не применять. */
export function takeRivalDay(state: StoreState): StoreState {
  if (!state.rival || (!bonusGuests(state) && !messToday(state))) return state;
  const { guests, mess, ...rest } = state.rival;
  return {
    ...state,
    rival: { ...rest, ...(guests && guests.day > state.day ? { guests } : {}), ...(mess && mess.day > state.day ? { mess } : {}) },
  };
}

const sum = (pranks: PrankIn[], kind: PrankKind): number => pranks.reduce((n, p) => n + Math.max(0, Math.floor(p[kind] || 0)), 0);

/**
 * Чужие проделки пришли: сколько луж и мусора будет к открытию и сколько гостей уйдёт. Охранник не
 * пускает мусорить, камеры и уборщица — каждый вдвое меньше; позванных гостей — не больше MAX_LOST.
 * day — к открытию какого дня (магазин уже открыт — к завтрашнему).
 */
export function applyPranks(state: StoreState, pranks: PrankIn[], day = state.day): { state: StoreState; news: RivalNews | null } {
  if (!pranks.length) return { state, news: null };
  const guard = state.staff.some((m) => m.role === 'guard');
  const cleaner = state.staff.some((m) => m.role === 'cleaner');
  const cameras = gearTier(state, 'cameras') > 0;
  let spill = sum(pranks, 'spill');
  let trash = sum(pranks, 'trash');
  const messy = spill + trash > 0;
  const helped: Protection[] = [];
  if (guard && messy) {
    spill = trash = 0;
    helped.push('guard');
  } else {
    if (cameras && messy) {
      spill = Math.floor(spill / 2);
      trash = Math.floor(trash / 2);
      helped.push('cameras');
    }
    if (cleaner && spill + trash > 0) {
      spill = Math.floor(spill / 2);
      trash = Math.floor(trash / 2);
      helped.push('cleaner');
    }
  }
  const was = state.rival?.mess?.day === day ? state.rival.mess : { day, spill: 0, trash: 0, lost: 0 };
  const mess = {
    day,
    spill: Math.min(MAX_SPILLS, was.spill + spill),
    trash: Math.min(MAX_TRASH, was.trash + trash),
    lost: Math.min(MAX_LOST, was.lost + sum(pranks, 'lure')),
  };
  const visitors = pranks.filter((p) => p.key).slice(0, 3).map((p) => ({ key: p.key, name: p.name }));
  return {
    state: { ...state, rival: { ...state.rival, mess } },
    news: { visitors, spill: mess.spill - was.spill, trash: mess.trash - was.trash, lost: mess.lost - was.lost, helped, hint: messy && !guard && !cleaner },
  };
}

/** Кофе от тех, кто поблагодарил за наш визит. */
export const takeThanks = (state: StoreState, names: string[]): StoreState =>
  names.length ? { ...state, money: state.money + THANK_COINS * Math.min(5, names.length) } : state;

/**
 * Магазин босса через дорогу — по образцу нашего зала (он всё подсмотрел у нас): те же полки,
 * товара поменьше, своя вывеска и рейтинг. Сервер не нужен.
 */
export function bossShop(home: StoreState, name: string, rating: number): ShopSnapshot {
  const snap = shopSnapshot(home);
  return {
    ...snap,
    shopName: name.slice(0, 16),
    rating,
    shelves: snap.shelves.map((sh) => ({ ...sh, items: Object.fromEntries(Object.entries(sh.items).map(([id, n]) => [id, Math.ceil(n * 0.6)])), broken: false })),
    decor: { owned: [], active: {} },
  };
}
