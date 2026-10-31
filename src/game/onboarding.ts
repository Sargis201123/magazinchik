// Первые минуты новичка. Было два начала, чтобы сравнить их на живых игроках (A/B); сравнение закрыто —
// теперь каждому новичку «play»: сразу в зале, бабушка говорит облачком, первый покупатель входит через
// пару секунд, вкладки утра открываются по одной, а первые дни ведёт бабушкино обучение (tutorial.ts).
// «tour» — прежнее начало: утро, глава 1 и бабушкин обход вкладок. Его больше не выдают, но сохранения,
// где оно уже есть (и старые, без поля), идут как раньше. ?onb=tour — посмотреть его самому.
// События и как их читать — docs/ONBOARDING.md.

import { buyStock, PRODUCTS, type ProductId, type StoreState } from './economy';

export type Cohort = 'tour' | 'play';

/**
 * Доля новичков с новым началом (0…1). Сравнение закрыто: всем новое.
 * Номер в Telegram делит игроков всегда одинаково: переустановил игру — попал туда же.
 */
export const PLAY_SHARE = 1;

/** Какое начало у новичка: по номеру в Telegram (вне Telegram — случайно). */
export function pickCohort(userId: number | undefined, random: () => number, share = PLAY_SHARE): Cohort {
  const bucket = userId !== undefined && Number.isFinite(userId) ? Math.abs(Math.floor(userId)) % 100 : Math.floor(random() * 100);
  return bucket < share * 100 ? 'play' : 'tour';
}

/** Шаги первых минут: каждый отмечается один раз и уходит в аналитику (onb_<шаг>). */
/**
 * stock — новичок сам разложил полку (до этого в первый день её раскладывает бабушка, firstday.ts);
 * gift — бабушкин подарок за первый день вручён.
 */
export type OnbStep = 'open' | 'cust' | 'sale' | 'day1' | 'day2' | 'hello' | 'bye' | 'stock' | 'gift';

export interface OnbState {
  /** Пройденные шаги. */
  done: OnbStep[];
  /** Вкладки утра (новое начало): false — только что открылась, бабушка о ней ещё не сказала; true — знакома. */
  tabs?: Record<string, boolean>;
  /** Первая неделя: о каком дне бабушка уже сказала, что нового (tutorial.ts, weekNote). */
  week?: number;
}

/**
 * Запас, который бабушка оставила на складе в новом начале: первый день проходит без закупки.
 * Примерно столько же новичок прежнего начала докупает в первое утро по подсказке обхода;
 * хлеба немного — он живёт два дня и к вечеру второго испортился бы.
 */
export const PLAY_STOCK: Partial<Record<ProductId, number>> = { potatoes: 6, apples: 2, bread: 2 };

/**
 * Новая игра новичка: запомнить его начало. В новом — запас на складе, без обхода вкладок и с первого
 * шага бабушкиного обучения (tutorial.ts: tutStart — здесь тот же шаг, без взаимного импорта).
 */
export function startCohort(state: StoreState, cohort: Cohort): StoreState {
  const base: StoreState = { ...state, onboarding: cohort, onb: { done: [] } };
  if (cohort === 'tour') return base;
  base.tut = { step: 'serve' };
  let next = base;
  for (const [id, qty] of Object.entries(PLAY_STOCK) as [ProductId, number][]) next = buyStock(next, id, qty, 0) ?? next;
  return { ...next, tourDone: true };
}

export const onbDone = (state: StoreState, step: OnbStep): boolean => Boolean(state.onb?.done.includes(step));

/** Отметить шаг (у старых сохранений — ничего: их первые минуты давно прошли). */
export function markOnb(state: StoreState, step: OnbStep): StoreState {
  if (!state.onboarding || onbDone(state, step)) return state;
  return { ...state, onb: { ...state.onb, done: [...(state.onb?.done ?? []), step] } };
}

/** Первый день нового начала: утра нет, сразу торговля с бабушкой. */
export const playDayOne = (state: StoreState): boolean => state.onboarding === 'play' && state.day === 1;

/** Вкладки утра в том порядке, в каком они открываются новичку. */
export const MORNING_TABS = ['buy', 'hall', 'staff', 'grow', 'extras'] as const;
export type MorningTab = (typeof MORNING_TABS)[number];

/**
 * Когда вкладке пора открыться: по одной в утро (со 2-го дня), а раньше — если она уже нужна
 * (началась вторая глава, магазин подрос, завёлся кот). Сломанную полку и товар, который
 * испортится, утро и так предлагает починить и уценить одной кнопкой в «Главном на сегодня».
 */
const OPENS: Record<MorningTab, (s: StoreState) => boolean> = {
  buy: (s) => s.day >= 2,
  hall: (s) => s.day >= 3 || s.level >= 1,
  staff: (s) => s.day >= 4 || s.story.chapter >= 1 || s.level >= 1,
  grow: (s) => s.day >= 5 || s.story.chapter >= 1 || s.level >= 1,
  extras: (s) => s.day >= 6 || s.level >= 1 || Boolean(s.cat),
};

/** Видна ли вкладка утра. В прежнем начале и у старых сохранений — все. */
export const tabOpen = (state: StoreState, tab: string): boolean => state.onboarding !== 'play' || tab in (state.onb?.tabs ?? {});

/** Вкладка только что открылась: на ней метка «Новое», бабушка о ней подсказывает. */
export const tabNew = (state: StoreState, tab: string): boolean => state.onboarding === 'play' && state.onb?.tabs?.[tab] === false;

/** Открыть вкладки, которым пора. Возвращает то же состояние, если ничего не открылось. */
export function openTabs(state: StoreState): { state: StoreState; opened: MorningTab[] } {
  if (state.onboarding !== 'play') return { state, opened: [] };
  const tabs = { ...(state.onb?.tabs ?? {}) };
  const opened = MORNING_TABS.filter((id) => !(id in tabs) && OPENS[id](state));
  if (!opened.length) return { state, opened };
  for (const id of opened) tabs[id] = false;
  return { state: { ...state, onb: { ...state.onb, done: state.onb?.done ?? [], tabs } }, opened };
}

/** Открыть вкладку сразу: в неё ведёт кнопка («Закупить» в «Главном на сегодня»). */
export function unlockTab(state: StoreState, tab: string): StoreState {
  if (tabOpen(state, tab)) return state;
  return { ...state, onb: { ...state.onb, done: state.onb?.done ?? [], tabs: { ...state.onb?.tabs, [tab]: false } } };
}

/** Новичок заглянул во вкладку (или прочёл подсказку) — метка «Новое» гаснет. */
export function seeTab(state: StoreState, tab: string): StoreState {
  if (!tabNew(state, tab)) return state;
  return { ...state, onb: { ...state.onb, done: state.onb?.done ?? [], tabs: { ...state.onb?.tabs, [tab]: true } } };
}

/** Прошёл бабушкин обход из профиля — все вкладки открыты и знакомы. */
export function openAllTabs(state: StoreState): StoreState {
  if (state.onboarding !== 'play' || MORNING_TABS.every((id) => state.onb?.tabs?.[id] === true)) return state;
  return { ...state, onb: { ...state.onb, done: state.onb?.done ?? [], tabs: Object.fromEntries(MORNING_TABS.map((id) => [id, true])) } };
}

/**
 * Что возьмёт первый покупатель: товар с той полки, от которой ближе всего пройти от двери
 * до кассы, — чтобы первая продажа случилась как можно скорее.
 */
export function firstWant(state: StoreState, stand: (index: number) => { x: number; y: number }, door: { x: number; y: number }, till: { x: number; y: number }): ProductId | null {
  let best: ProductId | null = null;
  let bestD = Infinity;
  for (let i = 0; i < state.shelves.length; i++) {
    const p = stand(i);
    const d = Math.hypot(p.x - door.x, p.y - door.y) + Math.hypot(p.x - till.x, p.y - till.y);
    if (d >= bestD) continue;
    const id = (Object.keys(state.shelves[i].items) as ProductId[]).find((pid) => PRODUCTS[pid] && (state.shelves[i].items[pid]?.length ?? 0) > 0);
    if (!id) continue;
    best = id;
    bestD = d;
  }
  return best;
}
