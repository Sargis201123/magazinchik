// Подарки друзьям и недельный турнир района — правила без сервера и интерфейса. Тот же модуль
// читает сервер (api/_lib/presents.ts, api/_lib/league.ts), поэтому здесь только типы из игры.
//
// Подарок: в гостях у друга — цветы, пирог или открытка с готовой доброй фразой и, по желанию,
// «отзыв» звёздами. Своего текста нет — модерация не нужна. Друг откроет подарок утром: монеты,
// настроение магазина (чуть рейтинга) или открытка на полку памяти. Даритель получит «спасибо».
//
// Турнир района: каждую неделю — лига из LEAGUE_SIZE магазинов похожего размера (пустые места —
// соседи, которых придумывает сервер). Очки — выручка недели, которую считает сервер, с потолком
// на каждый день по размеру магазина. В конце недели — награда по месту, кубок за тройку лучших
// и переход между лигами Бронза → Серебро → Золото.

import { homeLevel } from './zarshop';
import type { StoreState } from './economy';

export const PRESENT_KINDS = ['flowers', 'pie', 'card'] as const;
export type PresentKind = (typeof PRESENT_KINDS)[number];
export const PRESENT_ICON: Record<PresentKind, string> = { flowers: '💐', pie: '🥧', card: '📨' };
/** Сколько готовых фраз (social.phrase.0 … 7 в i18n). */
export const PHRASES = 8;

/** Подарок, который пришёл от друга (сервер проверил, кто дарил). */
export interface Present {
  name: string;
  kind: PresentKind;
  phrase: number;
  /** «Отзыв» звёздами: 0 — без отзыва. */
  stars: number;
}

/** Что даёт подарок: пирог — монеты, цветы — настроение (рейтинг), открытка — на полку памяти. */
export function presentGift(level: number, kind: PresentKind): { money: number; rating: number; card: boolean } {
  if (kind === 'pie') return { money: 100 + 50 * level, rating: 0, card: false };
  if (kind === 'flowers') return { money: 40, rating: 0.05, card: false };
  return { money: 40, rating: 0, card: true };
}

/** «Спасибо» дарителю, когда друг открыл подарок. */
export const thankCoins = (level: number): number => 30 + 20 * level;

/** Памятная вещь: открытка от друга или кубок турнира. */
export type Keepsake =
  | { k: 'card'; from: string; kind: PresentKind; phrase: number; day: number }
  | { k: 'cup'; week: number; place: number; tier: number };

/** На полке памяти не больше стольких открыток (старые уходят) и кубков. */
export const KEEP_CARDS = 30;
export const KEEP_CUPS = 52;

export function addKeepsake(list: Keepsake[] | undefined, item: Keepsake): Keepsake[] {
  const all = [...(list ?? []), item];
  const keep = new Set<Keepsake>([...all.filter((x) => x.k === 'card').slice(-KEEP_CARDS), ...all.filter((x) => x.k === 'cup').slice(-KEEP_CUPS)]);
  return all.filter((x) => keep.has(x));
}

/** Открыть подарки друзей и «спасибо» за свои: всё сразу в магазин. */
export function openPresents(state: StoreState, presents: Present[], thanks: number): { state: StoreState; money: number; rating: number; cards: number } {
  let money = thanks * thankCoins(homeLevel(state));
  let rating = 0;
  let keep = state.keepsakes;
  let cards = 0;
  for (const p of presents) {
    if (!PRESENT_KINDS.includes(p.kind)) continue;
    const gift = presentGift(state.level, p.kind);
    money += gift.money;
    rating += gift.rating;
    if (gift.card) {
      keep = addKeepsake(keep, { k: 'card', from: p.name.slice(0, 20), kind: p.kind, phrase: Math.max(0, Math.min(PHRASES - 1, Math.floor(p.phrase) || 0)), day: state.day });
      cards++;
    }
  }
  // Настроение — не больше +0,2 за утро, чтобы толпа друзей не подняла рейтинг до небес.
  rating = Math.min(0.2, rating);
  const next: StoreState = { ...state, money: state.money + money, rating: Math.min(5, state.rating + rating), ...(keep ? { keepsakes: keep } : {}) };
  return { state: next, money, rating, cards };
}

// ——— Турнир района ———

export const LEAGUE_SIZE = 10;
export const TIERS = ['bronze', 'silver', 'gold'] as const;
export type Tier = 0 | 1 | 2;
export const TIER_ICON = ['🥉', '🥈', '🥇'] as const;
/** Сколько лучших поднимаются в лигу выше и сколько последних опускаются. */
export const PROMOTE = 3;
export const DEMOTE = 3;

/** Группа по размеру магазина: ларёк и минимаркет, супермаркет и универсам, универмаг и гипермаркет. */
export const bandOf = (level: number): number => (level <= 1 ? 0 : level <= 3 ? 1 : 2);

/**
 * Потолок выручки за один настоящий день (UTC) по помещению: лучший день магазина × ~15 дней игры.
 * Больше за сутки честно не заработать — лишнее в очки турнира не идёт.
 */
export const LEAGUE_DAY_CAP = [15_000, 30_000, 60_000, 120_000, 250_000, 400_000];
export const dayCap = (level: number): number => LEAGUE_DAY_CAP[Math.max(0, Math.min(LEAGUE_DAY_CAP.length - 1, Math.floor(level)))];

/**
 * Очки недели: прирост выручки (счёт сервера) по дням, каждый день — не больше потолка.
 * days — выручка на начало каждого дня, когда игрок играл; end — выручка сейчас (или на конец недели).
 */
export function leagueScore(days: { day: number; start: number }[], end: number, level: number): number {
  const sorted = [...days].sort((a, b) => a.day - b.day);
  const cap = dayCap(level);
  let sum = 0;
  sorted.forEach((d, i) => {
    const next = i + 1 < sorted.length ? sorted[i + 1].start : end;
    sum += Math.max(0, Math.min(cap, next - d.start));
  });
  return sum;
}

/** Лига на следующую неделю: тройка лучших — выше, тройка последних — ниже. Пустая неделя (0 очков) — без повышения. */
export function nextTier(tier: number, place: number, size: number, score: number): Tier {
  const t = Math.max(0, Math.min(2, Math.floor(tier)));
  if (place <= PROMOTE && score > 0) return Math.min(2, t + 1) as Tier;
  if (place > size - DEMOTE) return Math.max(0, t - 1) as Tier;
  return t as Tier;
}

/** Награда за место в конце недели (монеты; в старших лигах — больше). Без звёзд. */
export function leagueReward(level: number, place: number, tier: number): number {
  const base = place === 1 ? 600 : place === 2 ? 400 : place === 3 ? 250 : place <= 7 ? 100 : 50;
  return Math.round((base + base * level) * [1, 1.25, 1.5][Math.max(0, Math.min(2, tier))]);
}

/** Итог прошлой недели, который пришёл с сервера. */
export interface LeagueResult {
  week: number;
  place: number;
  size: number;
  tier: number;
  next: number;
  score: number;
}

/** Забрать награду недели: монеты, кубок за тройку лучших; второй раз за ту же неделю — нельзя. */
export function claimLeague(state: StoreState, last: LeagueResult): { state: StoreState; money: number; cup: boolean } | null {
  if (state.leagueClaimed !== undefined && state.leagueClaimed >= last.week) return null;
  const money = last.score > 0 ? leagueReward(homeLevel(state), last.place, last.tier) : 0;
  const cup = last.score > 0 && last.place <= 3;
  return {
    state: {
      ...state,
      money: state.money + money,
      leagueClaimed: last.week,
      ...(cup ? { keepsakes: addKeepsake(state.keepsakes, { k: 'cup', week: last.week, place: last.place, tier: last.tier }) } : {}),
    },
    money,
    cup,
  };
}

/** Строка таблицы турнира. */
export interface LeagueRow {
  name: string;
  score: number;
  level: number;
  me?: boolean;
}

/** Место игрока и сколько не хватает до места выше (0 — уже первый). */
export function myStanding(rows: LeagueRow[]): { place: number; gap: number } | null {
  const i = rows.findIndex((r) => r.me);
  if (i < 0) return null;
  const me = rows[i];
  const above = rows.filter((r) => r.score > me.score);
  const place = above.length + 1;
  if (!above.length) return { place, gap: 0 };
  return { place, gap: Math.min(...above.map((r) => r.score)) - me.score + 1 };
}
