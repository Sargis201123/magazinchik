// Бесконечная игра: задания дня, сезоны, альбом редких гостей и звание магазина.
// Всё случайное зависит от номера дня — перезапуск игры ничего не меняет.

import type { TextKey } from '../i18n/ru';
import {
  monthOf,
  PRODUCTS,
  sellableProducts,
  seasonalDemand,
  type DayStats,
  type ProductId,
  type StoreState,
} from './economy';
import { rng } from './random';

// ---------------------------------------------------------------- сезоны

export type SeasonId = 'newyear' | 'bbq' | 'school' | 'harvest';

export interface Season {
  id: SeasonId;
  nameKey: TextKey;
  descKey: TextKey;
  icon: string;
  /** Множитель потока гостей. */
  guests: number;
  /** Каких товаров хотят чаще (вес при выборе корзины). */
  demand: Partial<Record<ProductId, number>>;
  /** К ценам терпимее: базовая цена в глазах покупателя ×tolerance. */
  priceTolerance: number;
}

export const SEASONS: Record<SeasonId, Season> = {
  newyear: { id: 'newyear', nameKey: 'season.newyear', descKey: 'season.newyear.desc', icon: '🎄', guests: 1.25, demand: {}, priceTolerance: 1.1 },
  bbq: { id: 'bbq', nameKey: 'season.bbq', descKey: 'season.bbq.desc', icon: '🍖', guests: 1.1, demand: { meat: 2.5, bread: 1.8 }, priceTolerance: 1 },
  school: { id: 'school', nameKey: 'season.school', descKey: 'season.school.desc', icon: '🎒', guests: 1.1, demand: { milk: 2.5, apples: 1.8 }, priceTolerance: 1 },
  harvest: { id: 'harvest', nameKey: 'season.harvest', descKey: 'season.harvest.desc', icon: '🧺', guests: 1.15, demand: { potatoes: 2.2, apples: 1.6 }, priceTolerance: 1.05 },
};

const SEASON_ORDER: SeasonId[] = ['newyear', 'bbq', 'school', 'harvest'];
/** Каждый такой по счёту месяц — праздничный. */
export const SEASON_EVERY = 4;

export function seasonFor(day: number): Season | null {
  const month = monthOf(day);
  if (month % SEASON_EVERY !== 0) return null;
  return SEASONS[SEASON_ORDER[(month / SEASON_EVERY - 1) % SEASON_ORDER.length]];
}

/**
 * Корзина покупателя: 1–2 разных товара, в сезон любимые товары выбирают чаще.
 * demand — спрос дня сверх сезона (погода, ценовая война, запах хлеба; см. demand.ts).
 */
export function pickWanted(state: StoreState, random: () => number, count: number, demand: (id: ProductId) => number = () => 1): ProductId[] {
  const season = seasonFor(state.day);
  const pool = sellableProducts(state).map((id) => ({ id, w: (season?.demand[id] ?? 1) * seasonalDemand(id, state.day) * demand(id) }));
  const picked: ProductId[] = [];
  while (picked.length < count && pool.length) {
    const total = pool.reduce((s, p) => s + p.w, 0);
    let roll = random() * total;
    const index = pool.findIndex((p) => (roll -= p.w) < 0);
    picked.push(pool.splice(index < 0 ? pool.length - 1 : index, 1)[0].id);
  }
  return picked;
}

/** «Справедливая» цена в глазах покупателя сегодня (в праздник к ценам терпимее). */
export const perceivedBase = (state: StoreState, id: ProductId): number =>
  PRODUCTS[id].basePrice * (seasonFor(state.day)?.priceTolerance ?? 1);

// ---------------------------------------------------------------- задания дня

export type QuestKind = 'serve' | 'revenue' | 'sell' | 'noComplaints' | 'catchThief' | 'cleanTrash';

export interface Quest {
  kind: QuestKind;
  target: number;
  product?: ProductId;
  reward: number;
}

export const QUEST_TEXT: Record<QuestKind, TextKey> = {
  serve: 'quest.serve',
  revenue: 'quest.revenue',
  sell: 'quest.sell',
  noComplaints: 'quest.noComplaints',
  catchThief: 'quest.catchThief',
  cleanTrash: 'quest.cleanTrash',
};

export const questReward = (level: number): number => 10 + 15 * level;
/** Все три задания за день — бонус к рейтингу. */
export const ALL_QUESTS_RATING = 0.1;

/** С этого дня появляются задания: первые дни игрок только осваивается. */
export const QUESTS_FROM_DAY = 3;

/** Три задания на день; цели растут вместе с магазином и потоком гостей. */
export function questsFor(state: StoreState, guests: number): Quest[] {
  if (state.day < QUESTS_FROM_DAY) return [];
  const random = rng(state.day * 31337 + 11);
  const reward = questReward(state.level);
  const sellable = sellableProducts(state);
  const pool: Quest[] = [
    { kind: 'serve', target: Math.max(5, Math.round(guests * 0.55)), reward },
    { kind: 'revenue', target: Math.max(150, Math.round((guests * 22) / 10) * 10), reward },
    { kind: 'noComplaints', target: 0, reward },
    { kind: 'cleanTrash', target: 2 + state.level, reward },
  ];
  if (sellable.length) {
    const product = sellable[Math.floor(random() * sellable.length)];
    pool.push({ kind: 'sell', product, target: Math.max(3, Math.round((guests * 0.9) / sellable.length)), reward });
  }
  if (state.day > 3) pool.push({ kind: 'catchThief', target: 1, reward: reward + 20 });
  const quests: Quest[] = [];
  while (quests.length < 3 && pool.length) quests.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  return quests;
}

/** Текущий прогресс задания (для «без жалоб» — 1, пока жалоб нет и обслужено хотя бы 5). */
export function questProgress(q: Quest, stats: DayStats): number {
  switch (q.kind) {
    case 'serve':
      return stats.served;
    case 'revenue':
      return stats.revenue;
    case 'sell':
      return stats.sold[q.product!] ?? 0;
    case 'noComplaints':
      return stats.complaints === 0 && stats.served >= 5 ? 1 : 0;
    case 'catchThief':
      return stats.caught;
    case 'cleanTrash':
      return stats.trashCleaned;
  }
}

export const questGoal = (q: Quest): number => (q.kind === 'noComplaints' ? 1 : q.target);
export const questDone = (q: Quest, stats: DayStats): boolean => questProgress(q, stats) >= questGoal(q);

/** Награды за задания вечером. */
export function rewardQuests(state: StoreState, quests: Quest[], stats: DayStats): { state: StoreState; earned: number; done: number } {
  const done = quests.filter((q) => questDone(q, stats));
  const earned = done.reduce((s, q) => s + q.reward, 0);
  const allDone = quests.length > 0 && done.length === quests.length;
  return {
    state: { ...state, money: state.money + earned, rating: Math.min(5, state.rating + (allDone ? ALL_QUESTS_RATING : 0)) },
    earned,
    done: done.length,
  };
}

// ---------------------------------------------------------------- альбом редких гостей

export type RareGuestId = 'blogger' | 'rockstar' | 'mayor' | 'astronaut' | 'footballer' | 'artist' | 'detective' | 'santa';

export interface RareGuest {
  id: RareGuestId;
  nameKey: TextKey;
  icon: string;
  look: { shirt: number; pants: number; hair: number; style: 'short' | 'long' | 'bun' | 'cap' | 'bald'; skin: number };
}

export const RARE_GUESTS: RareGuest[] = [
  { id: 'blogger', nameKey: 'rare.blogger', icon: '📱', look: { shirt: 0xf6757a, pants: 0x262b44, hair: 0xb55088, style: 'long', skin: 0xf2d3ab } },
  { id: 'rockstar', nameKey: 'rare.rockstar', icon: '🎸', look: { shirt: 0x181425, pants: 0x181425, hair: 0xe43b44, style: 'long', skin: 0xeec39a } },
  { id: 'mayor', nameKey: 'rare.mayor', icon: '🎩', look: { shirt: 0x262b44, pants: 0x262b44, hair: 0x8b9bb4, style: 'bald', skin: 0xf2d3ab } },
  { id: 'astronaut', nameKey: 'rare.astronaut', icon: '🚀', look: { shirt: 0xffffff, pants: 0xc0cbdc, hair: 0xffffff, style: 'cap', skin: 0xd9a066 } },
  { id: 'footballer', nameKey: 'rare.footballer', icon: '⚽', look: { shirt: 0x63c74d, pants: 0xffffff, hair: 0x181425, style: 'short', skin: 0x8f563b } },
  { id: 'artist', nameKey: 'rare.artist', icon: '🎨', look: { shirt: 0xfeae34, pants: 0x124e89, hair: 0x733e39, style: 'bun', skin: 0xeec39a } },
  { id: 'detective', nameKey: 'rare.detective', icon: '🕵️', look: { shirt: 0xb86f50, pants: 0x3a4466, hair: 0x4a2c1a, style: 'cap', skin: 0xf2d3ab } },
  { id: 'santa', nameKey: 'rare.santa', icon: '🎅', look: { shirt: 0xe43b44, pants: 0xe43b44, hair: 0xffffff, style: 'cap', skin: 0xf2d3ab } },
];

/** Шанс, что зашёл редкий гость: в большом магазине чаще. */
export const rareGuestChance = (level: number): number => 0.02 + 0.006 * level;
/** Редкий гость оставляет чаевые: столько же, сколько стоит корзина. */
export const RARE_TIP = 1;
export const ALBUM_REWARD = { money: 3000, rating: 0.5 };

/** Кто зайдёт: скорее тот, кого ещё нет в альбоме. */
export function pickRareGuest(state: StoreState, random: () => number): RareGuest {
  const missing = RARE_GUESTS.filter((g) => !state.album.includes(g.id));
  const pool = missing.length && random() < 0.7 ? missing : RARE_GUESTS;
  return pool[Math.floor(random() * pool.length)];
}

/** Обслужили редкого гостя: новый — в альбом; полный альбом — большая награда один раз. */
export function collectRareGuest(state: StoreState, id: RareGuestId): { state: StoreState; isNew: boolean; completed: boolean } {
  if (state.album.includes(id)) return { state, isNew: false, completed: false };
  const album = [...state.album, id];
  const completed = album.length === RARE_GUESTS.length;
  return {
    state: {
      ...state,
      album,
      money: state.money + (completed ? ALBUM_REWARD.money : 0),
      rating: Math.min(5, state.rating + (completed ? ALBUM_REWARD.rating : 0)),
    },
    isNew: true,
    completed,
  };
}

// ---------------------------------------------------------------- звание магазина

const RANK_KEYS: TextKey[] = ['rank.0', 'rank.1', 'rank.2', 'rank.3', 'rank.4', 'rank.5', 'rank.6'];
const RANK_THRESHOLDS = [0, 3_000, 10_000, 30_000, 80_000, 200_000, 500_000];
/** Каждое звание — навсегда +3% гостей. */
export const RANK_GUESTS = 0.03;

/** Порог звания n: после «Легенды» каждое следующее — вдвое больше выручки, без конца. */
export function rankThreshold(n: number): number {
  if (n < RANK_THRESHOLDS.length) return RANK_THRESHOLDS[n];
  return RANK_THRESHOLDS[RANK_THRESHOLDS.length - 1] * 2 ** (n - RANK_THRESHOLDS.length + 1);
}

export function rankOf(totalRevenue: number): number {
  let n = 0;
  while (totalRevenue >= rankThreshold(n + 1)) n++;
  return n;
}

/** Название звания: после «Легенды» — «Легенда II», «Легенда III»… */
export function rankName(n: number, t: (key: TextKey) => string): string {
  if (n < RANK_KEYS.length) return t(RANK_KEYS[n]);
  return `${t(RANK_KEYS[RANK_KEYS.length - 1])} ${toRoman(n - RANK_KEYS.length + 2)}`;
}

function toRoman(n: number): string {
  const map: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, r] of map) while (n >= v) [n, out] = [n - v, out + r];
  return out;
}

export const rankGuests = (state: StoreState): number => 1 + RANK_GUESTS * rankOf(state.totalRevenue);
