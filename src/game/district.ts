// Район растёт: напротив магазина по ходу игры строятся школа, бизнес-центр, стадион,
// общежитие и поликлиника. Сначала — стройка за забором, потом здание открывается и приводит
// своих покупателей со своим спросом: школьники берут булочки и сок, офис — воду и пирожки,
// болельщики в день матча — воду и мороженое. В день открытия можно поздравить соседей:
// рейтинг и несколько дней их гостей вдвое больше.
//
// 13.11, автор: «район подстраивается». Школа, бизнес-центр и стадион строятся по расписанию (матчи,
// задания), а свободные участки (PLOTS) застраивает то, что магазин много продаёт: берут воду — спортзал,
// цветы — свадебный салон, кофе — коворкинг. Выбор по продажам — в districtPlots.ts; здесь — где что
// стоит и как работает. Старые сохранения: на участке, где стройка по старому расписанию уже шла,
// остаётся общежитие или поликлиника.

import type { ProductId, StoreState } from './economy';
import { yearTime } from './calendar';

export type BuildingId = 'school' | 'office' | 'stadium' | 'dorm' | 'clinic' | 'gym' | 'wedding' | 'cowork' | 'kids' | 'canteen';

export interface Building {
  icon: string;
  /**
   * С какого дня стройка (у школы, бизнес-центра и стадиона — по расписанию); у зданий участков —
   * с какого дня их вообще могут выбрать. И сколько дней идёт стройка.
   */
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
  // Здания участков (13.11): строятся там, что магазин много продаёт, — и спрашивают как раз это.
  gym: {
    icon: '💪',
    from: 45,
    build: 6,
    demand: { water: 1.3, juice: 1.2, kvass: 1.2, apples: 1.1, milk: 1.1 },
    guests: 1.03,
    share: 0.1,
    looks: ['jogger', 'yogi'],
    wants: ['water', 'juice', 'kvass', 'apples', 'milk'],
    gift: 500,
  },
  wedding: {
    icon: '💒',
    from: 60,
    build: 7,
    demand: { flowers: 1.4, honeycake: 1.3, tangerines: 1.1, juice: 1.1 },
    guests: 1.02,
    share: 0.08,
    looks: ['florist', 'fur_lady'],
    wants: ['flowers', 'honeycake', 'juice', 'tangerines', 'jam'],
    gift: 700,
  },
  cowork: {
    icon: '🖥',
    from: 45,
    build: 6,
    demand: { buns: 1.25, pies: 1.2, water: 1.15, juice: 1.1 },
    guests: 1.03,
    share: 0.1,
    looks: ['hipster', 'artist'],
    wants: ['buns', 'pies', 'water', 'juice', 'honeycake'],
    gift: 500,
  },
  kids: {
    icon: '🧒',
    from: 45,
    build: 6,
    demand: { icecream: 1.3, juice: 1.2, jam: 1.2, buns: 1.1 },
    guests: 1.03,
    share: 0.1,
    looks: ['schoolgirl', 'babushka'],
    wants: ['icecream', 'juice', 'jam', 'milk', 'buns', 'apples'],
    gift: 500,
  },
  canteen: {
    icon: '🍲',
    from: 45,
    build: 6,
    // Спрос на само мясо столовая не поднимает: дорогое мясо разгоняло симулятор (+23% денег к 90-му дню
    // у «крыши», сезонная неделя уходила в минус). Мясо берут её рабочие-гости (wants), остальное — повара.
    demand: { potatoes: 1.2, bread: 1.1, pickles: 1.2, dumplings: 1.15 },
    guests: 1.03,
    share: 0.1,
    looks: ['builder', 'chef'],
    wants: ['meat', 'potatoes', 'bread', 'pickles', 'dumplings'],
    gift: 600,
  },
};
export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];

/** Строятся по расписанию всегда: стадион нужен матчам, школа и офис — заданиям и началу игры. */
export const FIXED: readonly BuildingId[] = ['school', 'office', 'stadium'];

/**
 * Свободные участки: с какого дня на них начинают стройку. Что строить — решают продажи (districtPlots.ts).
 * legacy — что стояло здесь по старому расписанию: у старого сохранения, где стройка уже шла, оно и остаётся.
 */
export const PLOTS: readonly { from: number; legacy?: BuildingId }[] = [{ from: 45, legacy: 'dorm' }, { from: 60, legacy: 'clinic' }, { from: 78 }];

/** Что решили построить на участке. */
export interface PlotPick {
  id: BuildingId;
  /** С какого дня стройка. */
  from: number;
  /** Выбрали по продажам: сколько за неделю взяли «его» товаров (товар или 'coffee' — стаканчики). Нет — старое расписание. */
  sold?: Record<string, number>;
  /** Утром уже рассказали, что начали стройку. */
  told?: boolean;
}

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
  /** Участки по порядку PLOTS: что на них строят (решается ночью накануне стройки, districtPlots.ts). */
  plots?: PlotPick[];
}

export type BuildingStage = 'none' | 'site' | 'open';

export const opensOn = (id: BuildingId): number => BUILDINGS[id].from + BUILDINGS[id].build;

/** Здание на своём месте: какое, с какого дня стройка и где стоит ('school'… или 'plot0'…). */
export interface Placed {
  id: BuildingId;
  from: number;
  spot: string;
}

/**
 * Что стоит (или строится, или будет строиться) в районе: три здания по расписанию и решённые участки.
 * Участок без решения, где по старому расписанию стройка уже началась, — старое здание (сохранения до 13.11).
 */
export function placedBuildings(state: StoreState): Placed[] {
  const out: Placed[] = FIXED.map((id) => ({ id, from: BUILDINGS[id].from, spot: id }));
  const picks = state.district?.plots ?? [];
  PLOTS.forEach((plot, i) => {
    const pick = picks[i] ?? (plot.legacy && state.day >= plot.from ? { id: plot.legacy, from: plot.from } : null);
    if (pick) out.push({ id: pick.id, from: pick.from, spot: `plot${i}` });
  });
  return out;
}

const stageOf = (state: StoreState, p: Placed): BuildingStage => (state.day < p.from ? 'none' : state.day < p.from + BUILDINGS[p.id].build ? 'site' : 'open');

export function buildingStage(state: StoreState, id: BuildingId): BuildingStage {
  const p = placedBuildings(state).find((b) => b.id === id);
  return p ? stageOf(state, p) : 'none';
}

/** Здания, что сегодня видны в районе (стройка или готовое), со стадией. */
export const districtBuildings = (state: StoreState): (Placed & { stage: BuildingStage })[] =>
  placedBuildings(state)
    .map((p) => ({ ...p, stage: stageOf(state, p) }))
    .filter((p) => p.stage !== 'none');

/** Работает ли здание сегодня: у школы летом каникулы. */
export function buildingWorks(state: StoreState, id: BuildingId): boolean {
  if (buildingStage(state, id) !== 'open') return false;
  return !(id === 'school' && yearTime(state.day) === 'summer');
}

export const isMatchDay = (state: StoreState): boolean => buildingWorks(state, 'stadium') && state.day % MATCH_EVERY === 4;

/** Строка для перерисовки улицы: меняется, когда начинается стройка или открывается здание. */
export const districtKey = (state: StoreState): string => districtBuildings(state).map((p) => `${p.id}${p.stage[0]}`).join('');

/**
 * Работающие сегодня здания. Спрос и гостей спрашивают на каждого покупателя — помним последний ответ
 * (тот же день и тот же район — те же здания).
 */
let workCache: { day: number; district: DistrictState | undefined; ids: BuildingId[] } | null = null;
const working = (state: StoreState): BuildingId[] => {
  if (workCache && workCache.day === state.day && workCache.district === state.district) return workCache.ids;
  const summer = yearTime(state.day) === 'summer';
  const ids = districtBuildings(state)
    .filter((p) => p.stage === 'open' && !(p.id === 'school' && summer))
    .map((p) => p.id);
  workCache = { day: state.day, district: state.district, ids };
  return ids;
};

/** Множитель спроса на товар от зданий района. */
export function districtDemand(state: StoreState, id: ProductId): number {
  let k = 1;
  for (const b of working(state)) k *= BUILDINGS[b].demand[id] ?? 1;
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
  for (const id of working(state)) k *= boosted(state, id) ? 1 + (BUILDINGS[id].guests - 1) * 2 : BUILDINGS[id].guests;
  if (isMatchDay(state)) k *= MATCH_GUESTS;
  return k;
}

/** Покупатель пришёл из здания района? Тогда — его образ и что он хочет. */
export function districtGuest(state: StoreState, random: () => number): { id: BuildingId; look: string; wants: ProductId[] } | null {
  let roll = random();
  for (const id of working(state)) {
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
  return districtBuildings(state).find((p) => p.stage === 'open' && !seen.includes(p.id))?.id ?? null;
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
    district: { ...district, seen, boost: { id, until: state.day + OPENING_DAYS - 1 } },
  };
}

/** Ближайшая стройка: что строят и сколько дней до открытия (для утренней строки). */
export function districtSite(state: StoreState): { id: BuildingId; days: number } | null {
  const p = districtBuildings(state).find((b) => b.stage === 'site');
  return p ? { id: p.id, days: p.from + BUILDINGS[p.id].build - state.day } : null;
}
