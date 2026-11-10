// Район (api/_lib/town.ts): «Магазин дня», отметки «Был тут», полив теплицы другу и общая цель недели.
// Данные приходят при запуске игры (loadMultiplayer) и лежат здесь; утро берёт их отсюда. Без Telegram или базы — null.

import { telegramInitData } from './telegram';
import { post } from './social';

export interface DayShop {
  id: number;
  name: string;
  level: number;
  day: number;
  rating: number;
  shop?: string;
}

export interface TownGoal {
  week: number;
  total: number;
  target: number;
  left: number;
  mine: boolean;
}

export interface TownInfo {
  shop: DayShop | null;
  /** Я уже оставил отметку в магазине дня. */
  liked: boolean;
  /** Сколько новых отметок оставили у меня (сервер уже отметил их показанными) и сколько раз полили теплицу. */
  likes: number;
  waters: number;
  goal: TownGoal;
  /** Прошлая неделя: цель набрали, а я торговал — награду можно забрать. */
  last?: { week: number };
}

let cache: TownInfo | null = null;
export const townInfo = (): TownInfo | null => cache;
/** Отметки и поливы забираются один раз: после этого в памяти — ноль. */
export function takeTownGifts(): { likes: number; waters: number } {
  const out = { likes: cache?.likes ?? 0, waters: cache?.waters ?? 0 };
  if (cache) cache = { ...cache, likes: 0, waters: 0 };
  return out;
}

const int = (v: unknown, max: number): number => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));

/** garden — у игрока есть теплица: тогда сервер отдаёт (и списывает) поливы друзей. */
export async function fetchTown(garden: boolean): Promise<TownInfo | null> {
  const initData = telegramInitData();
  if (!initData) return null;
  const res = await post<Partial<TownInfo> & { enabled?: boolean }>('/api/town', { initData, action: 'day', garden });
  if (!res?.enabled || !res.goal) {
    cache = null;
    return null;
  }
  const s = res.shop;
  cache = {
    shop: s && Number.isFinite(Number(s.id)) ? { id: Number(s.id), name: String(s.name ?? '').slice(0, 20), level: int(s.level, 10), day: int(s.day, 100000), rating: Math.max(0, Math.min(5, Number(s.rating) || 0)), ...(s.shop ? { shop: String(s.shop).slice(0, 32) } : {}) } : null,
    liked: Boolean(res.liked),
    // Не забранное с прошлого ответа не теряем: сервер уже списал, а игра могла ещё не показать.
    likes: int(res.likes, 99) + (cache?.likes ?? 0),
    waters: int(res.waters, 5) + (cache?.waters ?? 0),
    goal: { week: int(res.goal.week, 1e6), total: int(res.goal.total, 1e12), target: Math.max(1, int(res.goal.target, 1e12)), left: int(res.goal.left, 7), mine: Boolean(res.goal.mine) },
    ...(res.last && Number.isFinite(Number(res.last.week)) ? { last: { week: int(res.last.week, 1e6) } } : {}),
  };
  return cache;
}

/** Снимок магазина дня (ещё не проверенный) и имя хозяина. null — недоступно. */
export async function fetchDayShop(): Promise<{ shop: unknown; name: string } | null> {
  const initData = telegramInitData();
  if (!initData) return null;
  const res = await post<{ shop?: unknown; name?: string }>('/api/town', { initData, action: 'shop' });
  return res?.shop ? { shop: res.shop, name: String(res.name ?? '') } : null;
}

/** Оставить отметку «Был тут» в магазине дня (одна в день). */
export async function likeDayShop(): Promise<boolean> {
  const initData = telegramInitData();
  if (!initData) return false;
  const res = await post<{ ok?: boolean }>('/api/town', { initData, action: 'like' });
  if (cache) cache = { ...cache, liked: true };
  return Boolean(res?.ok);
}

const watered = new Set<number>();
/** Сегодня этому другу уже поливали (в этом запуске игры). */
export const wateredToday = (id: number): boolean => watered.has(id);
/** Полить теплицу другу: раз в день каждому. false — уже поливал или нет связи. */
export async function waterFriend(id: number): Promise<boolean> {
  const initData = telegramInitData();
  if (!initData) return false;
  const res = await post<{ ok?: boolean }>('/api/town', { initData, action: 'water', to: id });
  watered.add(id);
  return Boolean(res?.ok);
}
