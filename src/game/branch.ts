// Филиал в здании «Гиганта». Когда гипермаркет побеждён и закрылся (giant.ts), а свой магазин уже
// стал универмагом, пустое здание за дорогой можно купить — это второй магазин, «Магазинчик №2».
// Им правит нанятый управляющий (или свой человек из зала — career.ts): каждый сыгранный день филиал приносит чистый доход (его аренда
// и зарплаты уже вычтены), строкой в итогах дня и в отчёте за неделю.
//
// Доход — доля обычной выручки своего магазина за последнюю неделю: управляющий работает по твоему
// образцу (те же товары, цены, поставщики), и филиал никогда не перерастает главный магазин. Доля
// растёт с улучшениями по четырём направлениям (ассортимент, управляющий, реклама, ремонт). День ото
// дня доход немного гуляет: погода, сезон, рейтинг и случай, — но в минус не уходит никогда.
// Пока игрока нет, филиал тоже работает, но понемногу (branchAway): не больше трети дня за раз.
//
// Переезд в гипермаркет (HYPER_LEVEL): главный магазин переезжает в здание «Гиганта», а филиалом
// становится старый магазин через дорогу. Управляющий со своей командой переходит туда же — все
// купленные ступени остаются. Старый магазин — универмаг, а не гипермаркет: образец выручки после
// переезда уменьшаем до размеров универмага (branchRef), и доход филиала не прыгает ни вверх, ни вниз.

import { HYPER_LEVEL, monthOf, type StoreState } from './economy';
import { WEATHER_EFFECTS, weatherFor } from './weather';
import { seasonFor } from './endless';
import { rng } from './random';
import type { TextKey } from '../i18n/ru';

export type BranchTrack = 'shelves' | 'manager' | 'ads' | 'repair';

export interface BranchState {
  /** В какой день куплен. */
  since: number;
  /** Ступени улучшений по направлениям (нет поля — 0). */
  tiers?: Partial<Record<BranchTrack, number>>;
  /** Доход последнего дня: какой день и сколько (для «Развития» и улицы). */
  last?: { day: number; income: number };
  /** Сколько принёс за всё время. */
  earned?: number;
  /** День переезда главного магазина в гипермаркет: с него филиал — в старом магазине. */
  moved?: number;
}

/** С какого помещения можно купить здание (универмаг). */
export const BRANCH_LEVEL = HYPER_LEVEL - 1;
/** Цена здания. */
export const BRANCH_PRICE = 30000;
/** Доля обычной выручки своего магазина, которую приносит филиал без улучшений. */
export const BRANCH_BASE_SHARE = 0.05;
/** Выручка своего магазина в день, от которой считается доход: не меньше и не больше. */
export const BRANCH_REF_MIN = 3000;
export const BRANCH_REF_MAX = 20000;
/** Сколько последних дней выручки берём для образца. */
export const BRANCH_REF_DAYS = 7;
/** День ото дня доход гуляет в пределах ± этой доли. */
export const BRANCH_SPREAD = 0.08;
/** Меньше этого филиал за день не приносит (уютно: всегда хоть что-то). */
export const BRANCH_MIN_INCOME = 50;
/** Пока игрока нет: за час — такая доля обычного дня, не больше BRANCH_AWAY_MAX_HOURS часов. */
export const BRANCH_AWAY_RATE = 0.03;
export const BRANCH_AWAY_MIN_HOURS = 1;
export const BRANCH_AWAY_MAX_HOURS = 8;

export interface BranchTier {
  /** Цена ступени и прибавка к доле выручки. */
  price: number;
  share: number;
  nameKey: TextKey;
}

export interface BranchTrackInfo {
  icon: string;
  nameKey: TextKey;
  tiers: BranchTier[];
}

/**
 * Направления улучшений. Первая ступень окупается примерно за 17 дней, вторая — за 25, последняя —
 * за 36–39 (у игрока с выручкой около 10 000 в день — универмаг после победы над «Гигантом»). Всего
 * вложений — около 28 тысяч. Со всеми ступенями филиал добавляет к чистому доходу дня примерно
 * половину, а не удваивает его (docs/BALANCE.md).
 */
export const BRANCH_TRACKS: Record<BranchTrack, BranchTrackInfo> = {
  shelves: {
    icon: '🛒',
    nameKey: 'branch.track.shelves',
    tiers: [
      { price: 1400, share: 0.008, nameKey: 'branch.shelves.1' },
      { price: 2500, share: 0.01, nameKey: 'branch.shelves.2' },
      { price: 3600, share: 0.01, nameKey: 'branch.shelves.3' },
    ],
  },
  manager: {
    icon: '💼',
    nameKey: 'branch.track.manager',
    tiers: [
      { price: 1500, share: 0.009, nameKey: 'branch.manager.1' },
      { price: 2600, share: 0.01, nameKey: 'branch.manager.2' },
      { price: 3500, share: 0.009, nameKey: 'branch.manager.3' },
    ],
  },
  ads: {
    icon: '🪧',
    nameKey: 'branch.track.ads',
    tiers: [
      { price: 1000, share: 0.006, nameKey: 'branch.ads.1' },
      { price: 2000, share: 0.008, nameKey: 'branch.ads.2' },
      { price: 3000, share: 0.008, nameKey: 'branch.ads.3' },
    ],
  },
  repair: {
    icon: '🔨',
    nameKey: 'branch.track.repair',
    tiers: [
      { price: 1400, share: 0.008, nameKey: 'branch.repair.1' },
      { price: 2500, share: 0.01, nameKey: 'branch.repair.2' },
      { price: 3400, share: 0.009, nameKey: 'branch.repair.3' },
    ],
  },
};

export const BRANCH_TRACK_IDS = Object.keys(BRANCH_TRACKS) as BranchTrack[];

export const branchOf = (state: StoreState): BranchState | undefined => state.branch;
export const hasBranch = (state: StoreState): boolean => Boolean(state.branch);

/** Почему здание пока нельзя купить: «Гигант» не побеждён, магазин ещё не универмаг. */
export type BranchLock = 'giant' | 'level' | null;

export function branchLock(state: StoreState): BranchLock {
  if (state.giant?.phase !== 'won') return 'giant';
  if (state.level < BRANCH_LEVEL) return 'level';
  return null;
}

/** Можно ли сейчас купить (и хватает ли денег — отдельно, в кнопке). */
export const branchOpen = (state: StoreState): boolean => !state.branch && branchLock(state) === null;

export function buyBranch(state: StoreState): StoreState | null {
  if (!branchOpen(state) || state.money < BRANCH_PRICE || state.debt > 0) return null;
  return { ...state, money: state.money - BRANCH_PRICE, branch: { since: state.day, tiers: {}, earned: 0 } };
}

export const branchTier = (state: StoreState, track: BranchTrack): number => Math.min(BRANCH_TRACKS[track].tiers.length, state.branch?.tiers?.[track] ?? 0);

/** Следующая ступень направления (null — всё куплено). */
export function nextBranchTier(state: StoreState, track: BranchTrack): BranchTier | null {
  return BRANCH_TRACKS[track].tiers[branchTier(state, track)] ?? null;
}

export function upgradeBranch(state: StoreState, track: BranchTrack): StoreState | null {
  const branch = state.branch;
  const next = nextBranchTier(state, track);
  if (!branch || !next || state.money < next.price) return null;
  return { ...state, money: state.money - next.price, branch: { ...branch, tiers: { ...branch.tiers, [track]: branchTier(state, track) + 1 } } };
}

/** Сколько ступеней куплено всего (для улицы: чем больше, тем наряднее филиал). */
export const branchUpgrades = (state: StoreState): number => BRANCH_TRACK_IDS.reduce((n, id) => n + branchTier(state, id), 0);

/** Все ступени куплены. */
export const branchMaxed = (state: StoreState): boolean => hasBranch(state) && BRANCH_TRACK_IDS.every((id) => !nextBranchTier(state, id));

/** Доля выручки своего магазина, которую приносит филиал. */
export function branchShare(state: StoreState): number {
  if (!state.branch) return 0;
  return BRANCH_TRACK_IDS.reduce((sum, id) => sum + BRANCH_TRACKS[id].tiers.slice(0, branchTier(state, id)).reduce((s, t) => s + t.share, 0), BRANCH_BASE_SHARE);
}

/** Филиал — в старом магазине: главный переехал в гипермаркет. */
export const branchInOldShop = (state: StoreState): boolean => hasBranch(state) && state.level >= HYPER_LEVEL;

/**
 * Во сколько раз старый магазин меньше гипермаркета по выручке: после переезда образец выручки
 * уменьшаем во столько же раз — филиал торгует как прежний универмаг, а не как новый гипермаркет.
 * Не отношение гостей (2,2 к 5): гостей в гипермаркете больше, чем успевают пробить пять касс, и
 * выручка вырастает примерно вдвое (симулятор, docs/BALANCE.md «Гипермаркет»).
 */
export const OLD_SHOP_SCALE = 0.5;

/** Обычная выручка своего магазина в день — средняя за последнюю неделю, в разумных пределах. */
export function branchRef(state: StoreState): number {
  const week = (state.history ?? []).slice(-BRANCH_REF_DAYS);
  // Выручка дня day−1 записана последней: уменьшаем только дни гипермаркета (с дня переезда), дни
  // универмага до него и так — образец старого магазина. Иначе в день переезда доход упал бы на четверть.
  const hyperDays = state.level < HYPER_LEVEL ? 0 : state.branch?.moved === undefined ? week.length : Math.max(0, state.day - state.branch.moved);
  const scaled = week.map((v, i) => (i >= week.length - hyperDays ? v * OLD_SHOP_SCALE : v));
  const avg = scaled.length ? scaled.reduce((a, b) => a + b, 0) / scaled.length : 0;
  return Math.min(BRANCH_REF_MAX, Math.max(BRANCH_REF_MIN, avg));
}

/**
 * Свой управляющий (career.ts): филиалом правит человек из зала, который знает магазин, — доход чуть
 * больше (его прибавка уже вычтена). Без него филиалом правит нанятый со стороны, как раньше.
 */
export const BRANCH_HEAD_BONUS = 0.08;
export const branchHeadBonus = (state: StoreState): number => (state.branch && state.career?.head ? BRANCH_HEAD_BONUS : 0);

/** Обычный доход филиала в день — без погоды и случая (для «Развития» и прогноза). */
export const branchUsual = (state: StoreState): number => (state.branch ? Math.round(branchRef(state) * branchShare(state) * (1 + branchHeadBonus(state))) : 0);

/** На сколько в день вырастет доход, если купить следующую ступень направления. */
export function branchGain(state: StoreState, track: BranchTrack): number {
  const next = nextBranchTier(state, track);
  return next ? Math.round(branchRef(state) * next.share * (1 + branchHeadBonus(state))) : 0;
}

/** Настроение дня: погода и сезон — вполовину слабее, чем у своего магазина, рейтинг — чуть-чуть. */
export function branchMood(state: StoreState, day: number): number {
  const weather = 1 + (WEATHER_EFFECTS[weatherFor(day)].guests - 1) * 0.5;
  const season = 1 + ((seasonFor(day)?.guests ?? 1) - 1) * 0.5;
  // Филиал носит твоё имя: от 3★ и ниже — −5%, на 5★ — +5%.
  const rating = 1 + Math.max(-0.05, Math.min(0.05, (state.rating - 4) * 0.05));
  return weather * season * rating;
}

/** Доход филиала за день day: обычный × настроение дня × случай (одинаков при повторном расчёте того же дня). */
export function branchIncome(state: StoreState, day: number): number {
  if (!state.branch) return 0;
  const random = rng(day * 92821 + (state.seed ?? 0) + monthOf(day));
  const luck = 1 + (random() * 2 - 1) * BRANCH_SPREAD;
  return Math.max(BRANCH_MIN_INCOME, Math.round(branchUsual(state) * branchMood(state, day) * luck));
}

/**
 * Вечером: филиал отдаёт доход за день day — до счетов, чтобы им можно было расплатиться.
 * Строку отчёта дня (reports.ts) дополняет branchReport, когда она уже записана.
 */
export function branchNight(state: StoreState, day: number): { state: StoreState; income: number } {
  const branch = state.branch;
  if (!branch || day < branch.since) return { state, income: 0 };
  const income = branchIncome(state, day);
  return { state: { ...state, money: state.money + income, branch: { ...branch, last: { day, income }, earned: (branch.earned ?? 0) + income } }, income };
}

/** Доход филиала — в строку отчёта дня day. */
export function branchReport(state: StoreState, day: number, income: number): StoreState {
  if (!income || !state.reports?.some((r) => r.day === day)) return state;
  return { ...state, reports: state.reports.map((r) => (r.day === day ? { ...r, branch: income } : r)) };
}

/** Пока игрока не было: филиал торговал понемногу. null — нечего начислять. */
export function branchAway(state: StoreState, awayMs: number): { state: StoreState; hours: number; income: number } | null {
  const branch = state.branch;
  const hours = Math.min(BRANCH_AWAY_MAX_HOURS, awayMs / 3_600_000);
  if (!branch || !(hours >= BRANCH_AWAY_MIN_HOURS) || state.bankrupt) return null;
  const income = Math.round(branchUsual(state) * BRANCH_AWAY_RATE * hours);
  if (income <= 0) return null;
  return { state: { ...state, money: state.money + income, branch: { ...branch, earned: (branch.earned ?? 0) + income } }, hours, income };
}

/** Доход филиала за дни из отчёта недели (reports.ts). */
export const branchWeek = (state: StoreState): number => (state.reports ?? []).reduce((sum, r) => sum + (r.branch ?? 0), 0);

/** Имя на вывеске: своё название магазина с «№2», иначе «Магазинчик №2». */
export const branchSignName = (state: StoreState, fallback: string): string => `${state.shopName?.trim() || fallback} №2`;

/** Как филиал выглядит на улице: ключ для перестройки мира (купили, сделали ремонт, повесили вывеску, переехали). */
export function branchLook(state: StoreState): string {
  if (!state.branch) return '';
  return `${branchInOldShop(state) ? 'o' : 'b'}${branchTier(state, 'repair')}${branchTier(state, 'ads')}${branchTier(state, 'shelves')}|${state.shopName ?? ''}`;
}

// ---------- Переезд в гипермаркет ----------

/** Почему переезд пока закрыт: магазин ещё не универмаг или в здании «Гиганта» нет своего филиала. */
export type HyperLock = 'level' | 'branch' | null;

export function hyperLock(state: StoreState): HyperLock {
  if (state.level < BRANCH_LEVEL) return 'level';
  if (state.level === BRANCH_LEVEL && !state.branch) return 'branch';
  return null;
}

/** Переезд уже был: главный магазин — гипермаркет. */
export const isHyper = (state: StoreState): boolean => state.level >= HYPER_LEVEL;
