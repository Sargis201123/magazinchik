// Район растёт: напротив магазина по ходу игры строятся школа, бизнес-центр, стадион,
// общежитие и поликлиника. Сначала — стройка за забором, потом здание открывается и приводит
// своих покупателей со своим спросом: школьники берут булочки и сок, офис — воду и пирожки,
// болельщики в день матча — воду и мороженое. В день открытия можно поздравить соседей:
// рейтинг и несколько дней их гостей вдвое больше.

import type { ProductId, StoreState } from './economy';
import { yearTime } from './calendar';

export type BuildingId = 'school' | 'office' | 'stadium' | 'dorm' | 'clinic';

export interface Building {
  icon: string;
  /** С какого дня стройка и сколько дней она идёт. */
  from: number;
  build: number;
  /** Спрос по товарам, пока здание работает. */
  demand: Partial<Record<ProductId, number>>;
  /** Сколько гостей района прибавляется. */
  guests: number;
  /** Доля гостей магазина, которые приходят из этого здания (свой образ и свой список). */
  share: number;
  /** Образы из archetypes.ts. */
  looks: string[];
  /** Что они берут. */
  wants: ProductId[];
  /** Поздравить с открытием. */
  gift: number;
}

export const BUILDINGS: Record<BuildingId, Building> = {
  school: {
    icon: '🏫',
    from: 10,
    build: 5,
    demand: { buns: 1.3, pies: 1.3, juice: 1.3, icecream: 1.2, apples: 1.15 },
    guests: 1.02,
    share: 0.12,
    looks: ['schoolgirl', 'teacher'],
    wants: ['buns', 'pies', 'juice', 'icecream', 'apples', 'milk'],
    gift: 300,
  },
  office: {
    icon: '🏢',
    from: 20,
    build: 6,
    demand: { water: 1.3, juice: 1.2, pies: 1.25, dumplings: 1.15, honeycake: 1.2 },
    guests: 1.03,
    share: 0.12,
    looks: ['office', 'businessman'],
    wants: ['water', 'juice', 'pies', 'buns', 'dumplings', 'honeycake'],
    gift: 500,
  },
  stadium: {
    icon: '🏟',
    from: 32,
    build: 8,
    demand: { water: 1.1 },
    guests: 1,
    share: 0.05,
    looks: ['jogger', 'biker'],
    wants: ['water', 'juice', 'icecream', 'pies'],
    gift: 800,
  },
  dorm: {
    icon: '🏘',
    from: 45,
    build: 6,
    demand: { dumplings: 1.3, potatoes: 1.2, bread: 1.1, detergent: 1.2, soap: 1.15 },
    guests: 1.03,
    share: 0.12,
    looks: ['student', 'gamer'],
    wants: ['dumplings', 'potatoes', 'bread', 'juice', 'soap'],
    gift: 500,
  },
  clinic: {
    icon: '🏥',
    from: 60,
    build: 7,
    demand: { apples: 1.2, juice: 1.2, flowers: 1.3, milk: 1.1 },
    guests: 1.02,
    share: 0.1,
    looks: ['nurse', 'pensioner'],
    wants: ['apples', 'juice', 'flowers', 'milk', 'tangerines'],
    gift: 600,
  },
};
export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];

/** Матч на стадионе — раз в неделю: болельщиков полно, вода и мороженое нарасхват. */
export const MATCH_EVERY = 7;
export const MATCH_GUESTS = 1.2;
export const MATCH_SHARE = 0.3;
export const MATCH_DEMAND: Partial<Record<ProductId, number>> = { water: 1.8, juice: 1.5, icecream: 1.6, pies: 1.2 };
/** Поздравили с открытием: столько дней гостей из здания вдвое больше, и +рейтинг. */
export const OPENING_DAYS = 5;
export const OPENING_RATING = 0.1;

export interface DistrictState {
  /** Открытия, о которых уже рассказали утром. */
  seen: BuildingId[];
  /** Поздравили — гостей из здания вдвое больше до этого дня. */
  boost?: { id: BuildingId; until: number };
}

export type BuildingStage = 'none' | 'site' | 'open';

export const opensOn = (id: BuildingId): number => BUILDINGS[id].from + BUILDINGS[id].build;

export function buildingStage(state: StoreState, id: BuildingId): BuildingStage {
  const b = BUILDINGS[id];
  if (state.day < b.from) return 'none';
  return state.day < opensOn(id) ? 'site' : 'open';
}

/** Работает ли здание сегодня: у школы летом каникулы. */
export function buildingWorks(state: StoreState, id: BuildingId): boolean {
  if (buildingStage(state, id) !== 'open') return false;
  return !(id === 'school' && yearTime(state.day) === 'summer');
}

export const isMatchDay = (state: StoreState): boolean => buildingWorks(state, 'stadium') && state.day % MATCH_EVERY === 4;

/** Строка для перерисовки улицы: меняется, когда начинается стройка или открывается здание. */
export const districtKey = (state: StoreState): string => BUILDING_IDS.map((id) => buildingStage(state, id)[0]).join('');

/** Множитель спроса на товар от зданий района. */
export function districtDemand(state: StoreState, id: ProductId): number {
  let k = 1;
  for (const b of BUILDING_IDS) if (buildingWorks(state, b)) k *= BUILDINGS[b].demand[id] ?? 1;
  if (isMatchDay(state)) k *= MATCH_DEMAND[id] ?? 1;
  return k;
}

const boosted = (state: StoreState, id: BuildingId): boolean => {
  const boost = state.district?.boost;
  return boost?.id === id && state.day <= boost.until;
};

/** Множитель гостей от зданий района. */
export function districtGuests(state: StoreState): number {
  let k = 1;
  for (const id of BUILDING_IDS) if (buildingWorks(state, id)) k *= boosted(state, id) ? 1 + (BUILDINGS[id].guests - 1) * 2 : BUILDINGS[id].guests;
  if (isMatchDay(state)) k *= MATCH_GUESTS;
  return k;
}

/** Покупатель пришёл из здания района? Тогда — его образ и что он хочет. */
export function districtGuest(state: StoreState, random: () => number): { id: BuildingId; look: string; wants: ProductId[] } | null {
  let roll = random();
  for (const id of BUILDING_IDS) {
    if (!buildingWorks(state, id)) continue;
    const b = BUILDINGS[id];
    const share = (id === 'stadium' && isMatchDay(state) ? MATCH_SHARE : b.share) * (boosted(state, id) ? 2 : 1);
    if (roll >= share) {
      roll -= share;
      continue;
    }
    return { id, look: b.looks[Math.floor(random() * b.looks.length)], wants: b.wants };
  }
  return null;
}

/** Здание открылось, а утром о нём ещё не рассказали. */
export function districtNews(state: StoreState): BuildingId | null {
  const seen = state.district?.seen ?? [];
  return BUILDING_IDS.find((id) => buildingStage(state, id) === 'open' && !seen.includes(id)) ?? null;
}

/** Ответ на открытие: поздравить (деньги → рейтинг и гости) или просто принять к сведению. */
export function answerOpening(state: StoreState, id: BuildingId, gift: boolean): StoreState | null {
  const district = state.district ?? { seen: [] };
  if (district.seen.includes(id)) return null;
  const cost = BUILDINGS[id].gift;
  if (gift && state.money < cost) return null;
  const seen = [...district.seen, id];
  if (!gift) return { ...state, district: { ...district, seen } };
  return {
    ...state,
    money: state.money - cost,
    rating: Math.round(Math.min(5, state.rating + OPENING_RATING) * 100) / 100,
    district: { seen, boost: { id, until: state.day + OPENING_DAYS - 1 } },
  };
}

/** Ближайшая стройка: что строят и сколько дней до открытия (для утренней строки). */
export function districtSite(state: StoreState): { id: BuildingId; days: number } | null {
  const id = BUILDING_IDS.find((b) => buildingStage(state, b) === 'site');
  return id ? { id, days: opensOn(id) - state.day } : null;
}
