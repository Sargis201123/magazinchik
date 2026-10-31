// Сезонный пропуск: сезон длится PASS_DAYS настоящих дней (у всех игроков одни и те же даты).
// За игру копятся очки сезона: каждый закрытый день, задания дня и испытания недели. Очки
// открывают уровни; на каждом — награда бесплатной дорожки (монеты), а со звёздным пропуском —
// ещё и премиальной (монеты вдвое и звёздный декор на 10, 20 и 30-м уровнях).
// Новый сезон — очки и награды с нуля; купленный декор остаётся навсегда.
// У сезона есть и свой эксклюзив (decor.ts, поле season): наряд хозяина на EXCLUSIVE_LEVELS.outfit
// и вывеска на EXCLUSIVE_LEVELS.sign. Их нельзя купить — только забрать со звёздной дорожки,
// и их видят друзья в гостях (снимок магазина несёт то, что стоит, friendShop.ts).

import { DECOR, type DecorId, type DecorKind } from './decor';
import type { StoreState } from './economy';

export const PASS_DAYS = 28;
/** Цена звёздного пропуска (та же — на сервере, api/_lib/telegram.ts). */
export const PASS_STARS = 100;
export const PASS_LEVELS = 30;
export const XP_PER_LEVEL = 50;
/** Очки сезона: за закрытый день, за задание дня, за испытание недели. */
export const XP_DAY = 10;
export const XP_QUEST = 5;
export const XP_WEEKLY = 20;
/** Первый сезон начался 19 октября 2026 (понедельник). */
const EPOCH = Date.UTC(2026, 9, 19);
const DAY = 24 * 3600_000;
/** Уровни с наградой-декором на премиальной дорожке. */
export const DECOR_LEVELS = [10, 20, 30];
/** Уровни с эксклюзивом сезона: наряд — пораньше (сразу видно, за что платил), вывеска — к середине. */
export const EXCLUSIVE_LEVELS: Partial<Record<DecorKind, number>> = { outfit: 5, sign: 15 };

export interface PassState {
  season: number;
  xp: number;
  /** Забранные награды: бесплатная и премиальная дорожки. */
  free: number[];
  premium: number[];
  /** Куплен звёздный пропуск этого сезона. */
  paid?: boolean;
}

export const seasonOf = (now: number): number => Math.max(1, Math.floor((now - EPOCH) / (PASS_DAYS * DAY)) + 1);
/** Сколько дней сезона осталось (включая сегодня). */
export const seasonDaysLeft = (now: number): number => PASS_DAYS - Math.floor(((now - EPOCH) / DAY) % PASS_DAYS);
/** Товар за звёзды для этого сезона (api/_lib/telegram.ts → catalogItem). */
export const passItem = (season: number): string => `pass_${season}`;

export const passOf = (state: StoreState, season: number): PassState =>
  state.pass && state.pass.season === season ? state.pass : { season, xp: 0, free: [], premium: [] };

/** Новый сезон — пропуск с нуля. Заодно — эксклюзив за уже забранные уровни (claimedExclusives). */
export const ensureSeason = (state: StoreState, now: number): StoreState => {
  const season = seasonOf(now);
  return claimedExclusives(state.pass?.season === season ? state : { ...state, pass: passOf(state, season) });
};

/**
 * Премиальный уровень с эксклюзивом забрали ещё до того, как эксклюзив появился в игре
 * (сезон 1 шёл уже две недели): выдать его и поставить. Повторно ничего не делает.
 */
export function claimedExclusives(state: StoreState): StoreState {
  const pass = state.pass;
  if (!pass?.paid) return state;
  let s = state;
  for (const level of pass.premium) {
    const id = passExclusive(pass.season, level);
    if (!id || s.decor.owned.includes(id)) continue;
    const kind = DECOR.find((d) => d.id === id)!.kind;
    s = { ...s, decor: { ...s.decor, owned: [...s.decor.owned, id], active: { ...s.decor.active, [kind]: id } } };
  }
  return s;
}

export const passLevel = (pass: PassState): number => Math.min(PASS_LEVELS, Math.floor(pass.xp / XP_PER_LEVEL));

/** Очки сезона за ночь: день, задания дня, испытания недели. */
export function addPassXp(state: StoreState, quests: number, weekly: number): StoreState {
  if (!state.pass) return state;
  return { ...state, pass: { ...state.pass, xp: state.pass.xp + XP_DAY + XP_QUEST * quests + XP_WEEKLY * weekly } };
}

/** Монеты за уровень: растут с уровнем пропуска и с магазином. */
export const passCoins = (state: StoreState, level: number): number => Math.round(((150 + 120 * state.level) * (1 + level / 10)) / 10) * 10;

/** Декор премиальной дорожки на уровне: звёздные вещи по порядку, которых у игрока нет. */
export function passDecor(state: StoreState, level: number): DecorId | null {
  const i = DECOR_LEVELS.indexOf(level);
  if (i < 0) return null;
  const starred = DECOR.filter((d) => d.stars !== undefined).map((d) => d.id);
  // Каждый сезон — свои вещи: сдвиг по номеру сезона.
  const season = state.pass?.season ?? 1;
  return starred[((season - 1) * DECOR_LEVELS.length + i) % starred.length];
}

/** Эксклюзивные вещи сезона (вывеска, наряд); у сезона без своего эксклюзива — пусто. */
export const seasonExclusives = (season: number): DecorId[] => DECOR.filter((d) => d.season === season).map((d) => d.id);

/** Эксклюзив сезона на этом уровне премиальной дорожки (или null). */
export function passExclusive(season: number, level: number): DecorId | null {
  return DECOR.find((d) => d.season === season && EXCLUSIVE_LEVELS[d.kind] === level)?.id ?? null;
}

export type Track = 'free' | 'premium';

/** Забрать награду уровня. null — уровень не открыт, уже забрано или нет пропуска. */
export function claimPass(state: StoreState, level: number, track: Track): StoreState | null {
  const pass = state.pass;
  if (!pass || level < 1 || level > passLevel(pass) || pass[track].includes(level)) return null;
  if (track === 'premium' && !pass.paid) return null;
  let s: StoreState = { ...state, pass: { ...pass, [track]: [...pass[track], level] } };
  if (track === 'free') return { ...s, money: s.money + passCoins(state, level) };
  s = { ...s, money: s.money + passCoins(state, level) * 2 };
  const decor = passDecor(state, level);
  if (decor && !s.decor.owned.includes(decor)) s = { ...s, decor: { ...s.decor, owned: [...s.decor.owned, decor] } };
  // Эксклюзив сезона сразу надевается и вешается — ради него и брали пропуск.
  const exclusive = passExclusive(pass.season, level);
  if (exclusive && !s.decor.owned.includes(exclusive)) {
    const kind = DECOR.find((d) => d.id === exclusive)!.kind;
    s = { ...s, decor: { ...s.decor, owned: [...s.decor.owned, exclusive], active: { ...s.decor.active, [kind]: exclusive } } };
  }
  return s;
}

/** Звёздный пропуск куплен (после оплаты или восстановления покупок). */
export const grantPass = (state: StoreState, owned: string[]): StoreState =>
  state.pass && !state.pass.paid && owned.includes(passItem(state.pass.season)) ? { ...state, pass: { ...state.pass, paid: true } } : state;

/** Сколько наград можно забрать прямо сейчас. */
export function passReady(state: StoreState): number {
  const pass = state.pass;
  if (!pass) return 0;
  let n = 0;
  for (let l = 1; l <= passLevel(pass); l++) {
    if (!pass.free.includes(l)) n++;
    if (pass.paid && !pass.premium.includes(l)) n++;
  }
  return n;
}
