// Реклама: листовки, баннер, блогер — и дорогая: радио, билборд на улице, ролик на ТВ,
// коллаборация с известным блогером, кампания по всему городу. Платишь утром — сегодня
// (и дальше) больше гостей. Цена считается от сегодняшнего потока гостей: дорогая реклама
// выгоднее в пересчёте на гостя и ещё прибавляет доверия — о магазине говорят по радио и ТВ,
// к ценам меньше придираются. Окупается, только если полки полные и кассы успевают.
// Можно запустить несколько реклам сразу, но каждая следующая работает слабее (AD_STACK).

import type { TextKey } from '../i18n/ru';
import { expectedGuests, type StoreState } from './economy';

export type AdId = 'flyers' | 'banner' | 'blogger' | 'radio' | 'billboard' | 'tv' | 'collab' | 'city';

export interface Ad {
  id: AdId;
  icon: string;
  nameKey: TextKey;
  descKey: TextKey;
  /** На сколько больше гостей, пока работает (одна, без других реклам). */
  boost: number;
  days: number;
  /** Цена: монет за каждого гостя обычного потока за каждый день рекламы (adPrice). */
  cost: number;
  /** С какого помещения доступна (индекс STORE_LEVELS). */
  minLevel: number;
  /** Нижняя граница цены: дорогая реклама не бывает дешёвой и в маленьком магазине. */
  minPrice: number;
  /** Во сколько раз чаще заходят редкие гости. */
  rare?: number;
  /** Доверие: во сколько раз «нормальная» цена в глазах покупателя выше (как у радио и карты лояльности). */
  trust?: number;
  /** Шанс, что покупатель возьмёт на товар больше: видел рекламу и пришёл за покупками. */
  basket?: number;
}

const ad = (id: AdId, icon: string, boost: number, days: number, cost: number, minLevel: number, minPrice: number, extra: Partial<Ad> = {}): Ad => ({
  id,
  icon,
  nameKey: `ads.${id}` as TextKey,
  descKey: `ads.${id}.desc` as TextKey,
  boost,
  days,
  cost,
  minLevel,
  minPrice,
  ...extra,
});

/**
 * Цены подобраны по симулятору (scripts/sim-features.ts): в магазине, который успевает обслужить
 * гостей, реклама возвращает примерно в 1,3 раза больше, чем стоит. Дорогая — радио, билборд, ТВ,
 * кампания по городу — берёт не только числом гостей (касса всё равно не пробьёт всех), а чеком:
 * покупатели доверяют и берут больше.
 */
export const ADS: Record<AdId, Ad> = {
  flyers: ad('flyers', '📄', 0.2, 1, 1.6, 0, 30),
  banner: ad('banner', '🪧', 0.12, 3, 1, 0, 60),
  blogger: ad('blogger', '📱', 0.4, 1, 2.5, 0, 80, { rare: 2 }),
  radio: ad('radio', '📻', 0.2, 3, 2.4, 1, 250, { trust: 1.04, basket: 0.15 }),
  billboard: ad('billboard', '🏙️', 0.3, 5, 2.8, 2, 600, { trust: 1.05, basket: 0.25 }),
  tv: ad('tv', '📺', 0.6, 3, 4.2, 3, 800, { trust: 1.1, basket: 0.5 }),
  collab: ad('collab', '🤳', 1, 1, 4.2, 3, 600, { rare: 3, trust: 1.05, basket: 0.35 }),
  city: ad('city', '🎪', 0.5, 7, 2.6, 4, 1500, { trust: 1.08, basket: 0.4 }),
};

export const AD_IDS = Object.keys(ADS) as AdId[];

/** Больше трёх реклам сразу не запустить. */
export const MAX_ADS = 3;

/** Вторая реклама работает вполовину, третья — на четверть: город уже и так знает о магазине. */
export const AD_STACK = [1, 0.5, 0.25];

export interface AdRun {
  id: AdId;
  from: number;
  until: number;
}

/** Все кампании из сохранения: старые хранили одну рекламу в поле ads. */
const allRuns = (state: StoreState): AdRun[] => [...(state.adRuns ?? []), ...(state.ads ? [state.ads] : [])];

/** Какие рекламы работают сегодня — сильные первыми. */
export function activeAds(state: StoreState): Ad[] {
  const ids = new Set(allRuns(state).filter((r) => state.day >= r.from && state.day <= r.until && r.id in ADS).map((r) => r.id));
  return [...ids].map((id) => ADS[id]).sort((a, b) => b.boost - a.boost);
}

/** Самая сильная реклама сегодня (для улицы, Эдуарда и великана). */
export const activeAd = (state: StoreState): Ad | undefined => activeAds(state)[0];

/** До какого дня работает эта реклама (или undefined). */
export const adUntil = (state: StoreState, id: AdId): number | undefined =>
  allRuns(state)
    .filter((r) => r.id === id && state.day >= r.from && state.day <= r.until)
    .reduce<number | undefined>((max, r) => Math.max(max ?? 0, r.until), undefined);

/** Сложить прибавки: самая сильная целиком, следующие — слабее (AD_STACK). */
export const stackBoost = (boosts: number[]): number =>
  [...boosts].sort((a, b) => b - a).reduce((sum, b, i) => sum + b * (AD_STACK[i] ?? 0), 0);

export const adBoost = (state: StoreState): number => 1 + stackBoost(activeAds(state).map((a) => a.boost));

/** Насколько вырастет поток, если добавить эту рекламу к уже работающим (для подсказки в меню). */
export const adGain = (state: StoreState, id: AdId): number => {
  const running = activeAds(state);
  if (running.some((a) => a.id === id)) return 0;
  return stackBoost([...running.map((a) => a.boost), ADS[id].boost]) - stackBoost(running.map((a) => a.boost));
};

/** Во сколько раз чаще заходят редкие гости — по самой «звёздной» рекламе. */
export const adRareBoost = (state: StoreState): number => Math.max(1, ...activeAds(state).map((a) => a.rare ?? 1));

/** Доверие к магазину от рекламы — по самой «громкой» (не складывается). */
export const adTrust = (state: StoreState): number => Math.max(1, ...activeAds(state).map((a) => a.trust ?? 1));

/** Шанс лишнего товара в корзине — по самой сильной в этом рекламе (не складывается). */
export const adBasket = (state: StoreState): number => Math.max(0, ...activeAds(state).map((a) => a.basket ?? 0));

/** Сколько товаров покупатель возьмёт сверх обычного из-за рекламы: 0 или 1. */
export const adExtraItems = (state: StoreState, random: () => number): number => {
  const chance = adBasket(state);
  return chance > 0 && random() < chance ? 1 : 0;
};

export const adUnlocked = (state: StoreState, id: AdId): boolean => state.level >= ADS[id].minLevel;

/** Цена: обычный поток гостей × дни × цена гостя-дня, округлено до 10. Больше магазин — дороже реклама. */
export function adPrice(state: StoreState, id: AdId): number {
  const a = ADS[id];
  return Math.max(a.minPrice, Math.round((expectedGuests(state.rating, state.level) * a.days * a.cost) / 10) * 10);
}

/** Почему нельзя заказать (или null — можно). */
export function adBlock(state: StoreState, id: AdId): 'level' | 'running' | 'full' | 'money' | null {
  if (!adUnlocked(state, id)) return 'level';
  const running = activeAds(state);
  if (running.some((a) => a.id === id)) return 'running';
  if (running.length >= MAX_ADS) return 'full';
  if (state.money < adPrice(state, id)) return 'money';
  return null;
}

/** Запустить рекламу с дня from (без оплаты): заказ утром или подарок. Сначала чистим закончившиеся. */
export function grantAd(state: StoreState, id: AdId, from = state.day): StoreState {
  const runs = allRuns(state).filter((r) => r.until >= state.day);
  return { ...state, ads: undefined, adRuns: [...runs, { id, from, until: from + ADS[id].days - 1 }] };
}

export function buyAd(state: StoreState, id: AdId): StoreState | null {
  if (adBlock(state, id)) return null;
  const s = grantAd(state, id);
  return { ...s, money: state.money - adPrice(state, id) };
}

/** Есть ли реклама на этот день (уже работает или начнётся). */
export const adPlanned = (state: StoreState, day: number): boolean => allRuns(state).some((r) => day >= r.from && day <= r.until);

/**
 * Сколько гостей за день привела реклама: из всех, кто зашёл, это доля сверх обычного потока.
 * visitors — обслуженные и ушедшие без покупки.
 */
export const adGuests = (state: StoreState, visitors: number): number => {
  const boost = adBoost(state);
  return boost > 1 ? Math.round(visitors * (1 - 1 / boost)) : 0;
};
