// Альбом коллекций: семь тематических наборов, которые сами собираются в обычной игре, — редкие гости,
// письма, рецепты кухни, праздники, друзья района, помещения магазина и моменты дня. Собрал набор —
// сразу трофей в витрину зала (scenes/collections.ts) и немного монет; собрал все — золотая обложка
// альбома и достижение. Монеты — не больше дня прибыли за набор, трофеи — только красота, без силы.
//
// Что видно по самому магазину (альбом гостей, помещение, знакомые постоянные, кот, прожитые праздники),
// альбом добирает сам (syncCollections) — так старые сохранения получают уже заработанное. Что прошло
// и следа не оставило (письмо, блюдо с плиты, пойманный момент), отмечают в момент события (collect).
// Альбом принадлежит игроку: после «Начать заново» он остаётся (restart.ts), награду второй раз не дают.

import type { TextKey } from '../i18n/ru';
import { HYPER_LEVEL, MONTH_DAYS, STORE_LEVELS, type StoreState } from './economy';
import { RARE_GUESTS, seasonFor, SEASON_EVERY } from './endless';
import { holidayFor } from './calendar';
import { DISH_IDS, DISHES } from './kitchen';
import { LIVE_THEMES } from './live';
import { MOMENT_ICONS, MOMENT_KINDS } from './moments';
import { REGULARS } from './regulars';
import { hasDog } from './watch';

export type SetId = 'guests' | 'cards' | 'recipes' | 'holidays' | 'friends' | 'shops' | 'moments';

export interface CollectionItem {
  id: string;
  icon: string;
  nameKey: TextKey;
  /** Как получить — своя подсказка у предмета (иначе — общая подсказка набора). */
  hintKey?: TextKey;
  hintParams?: Record<string, string | number>;
}

export interface CollectionSet {
  id: SetId;
  icon: string;
  /** Набор приносит монеты (у редких гостей своя награда за весь альбом — endless.ts, ALBUM_REWARD). */
  coins: boolean;
  items: CollectionItem[];
}

/** Что сохраняется: собранное по наборам, закрытые наборы, новое в альбоме и ещё не отпразднованное. */
export interface CollectionState {
  got: Partial<Record<SetId, string[]>>;
  /** Собранные наборы — награда выдана. */
  done?: SetId[];
  /** «Новое в альбоме»: «набор:предмет», которые игрок ещё не видел в альбоме. */
  fresh?: string[];
  /** Собранные наборы, праздник которых ещё не показан в зале. */
  party?: SetId[];
}

// ---------------------------------------------------------------- наборы

/** Первый день каждого праздника игрового года (calendar.ts, endless.ts — сезоны). */
const YEAR_DAYS = SEASON_EVERY * 4 * MONTH_DAYS;
const GAME_HOLIDAYS = ['newyear', 'march8', 'bbq', 'school', 'halloween', 'harvest'] as const;
type GameHoliday = (typeof GAME_HOLIDAYS)[number];
const holidayOn = (day: number, h: GameHoliday): boolean =>
  h === 'march8' || h === 'halloween' || h === 'newyear' ? holidayFor(day) === h : seasonFor(day)?.id === h;
/** С какого дня игры праздник уже прожит. */
export const HOLIDAY_DAY: Record<GameHoliday, number> = Object.fromEntries(
  GAME_HOLIDAYS.map((h) => {
    // Первый год может начаться посреди года (calendar.ts считает от первого дня) — ищем в двух годах.
    for (let d = 1; d <= YEAR_DAYS * 2; d++) if (holidayOn(d, h)) return [h, d];
    return [h, Number.POSITIVE_INFINITY];
  }),
) as Record<GameHoliday, number>;

const HOLIDAY_ICONS: Record<GameHoliday | `live_${(typeof LIVE_THEMES)[number]}`, string> = {
  newyear: '🎄',
  march8: '🌷',
  bbq: '🍖',
  school: '🎒',
  halloween: '🎃',
  harvest: '🧺',
  live_newyear: '🎅',
  live_feb23: '⚓',
  live_march8: '💐',
};

const SENDERS = ['grandma', 'valya', 'sonya', ...REGULARS.map((r) => r.id)] as const;
const SENDER_ICONS: Record<string, string> = { grandma: '👵', valya: '🌸', sonya: '👧', petr: '🧓', sveta: '👩', kostya: '🧑', akhmed: '🧔', olga: '👓', misha: '🎒' };
const FRIEND_ICONS: Record<string, string> = { petr: '🧓', sveta: '👩', kostya: '🧑', akhmed: '🧔', olga: '👓', misha: '🎒', cat: '🐱', bobik: '🐶' };
const SHOP_ICONS = ['🏚', '🏠', '🏪', '🏬', '🏢', '🏙', '🏛'];

export const COLLECTION_SETS: CollectionSet[] = [
  {
    id: 'guests',
    icon: '📸',
    coins: false,
    items: RARE_GUESTS.map((g) => ({ id: g.id, icon: g.icon, nameKey: g.nameKey })),
  },
  {
    id: 'cards',
    icon: '💌',
    coins: true,
    items: SENDERS.map((id) => {
      const regular = REGULARS.find((r) => r.id === id);
      return {
        id,
        icon: SENDER_ICONS[id] ?? '✉️',
        nameKey: regular ? regular.nameKey : (`col.from.${id}` as TextKey),
        ...(regular ? { hintKey: 'col.hint.cardsRegular' as TextKey, hintParams: { day: regular.from } } : id === 'sonya' ? { hintKey: 'col.hint.cardsSonya' as TextKey } : {}),
      };
    }),
  },
  {
    id: 'recipes',
    icon: '🍳',
    coins: true,
    items: DISH_IDS.map((id) => ({ id, icon: DISHES[id].icon, nameKey: `dish.${id}` as TextKey })),
  },
  {
    id: 'holidays',
    icon: '🎉',
    coins: true,
    items: [
      ...GAME_HOLIDAYS.map((h) => ({ id: h, icon: HOLIDAY_ICONS[h], nameKey: `col.h.${h}` as TextKey, hintKey: 'col.hint.holidayDay' as TextKey, hintParams: { day: HOLIDAY_DAY[h] } })),
      ...LIVE_THEMES.map((th) => ({ id: `live_${th}`, icon: HOLIDAY_ICONS[`live_${th}`], nameKey: `col.h.live_${th}` as TextKey, hintKey: `col.hint.live_${th}` as TextKey })),
    ],
  },
  {
    id: 'friends',
    icon: '🤝',
    coins: true,
    items: [
      ...REGULARS.map((r) => ({ id: r.id, icon: FRIEND_ICONS[r.id] ?? '🙂', nameKey: r.nameKey, hintKey: 'col.hint.friendDay' as TextKey, hintParams: { day: r.from } })),
      { id: 'cat', icon: FRIEND_ICONS.cat, nameKey: 'col.friend.cat', hintKey: 'col.hint.cat' },
      { id: 'bobik', icon: FRIEND_ICONS.bobik, nameKey: 'col.friend.bobik', hintKey: 'col.hint.bobik' },
    ],
  },
  {
    id: 'shops',
    icon: '🏪',
    coins: true,
    items: [
      ...STORE_LEVELS.map((l, i) => ({
        id: `l${i}`,
        icon: SHOP_ICONS[i],
        nameKey: l.nameKey,
        ...(i === HYPER_LEVEL ? { hintKey: 'col.hint.hyper' as TextKey } : { hintKey: 'col.hint.shopCost' as TextKey, hintParams: { cost: l.cost } }),
      })),
      { id: 'branch', icon: SHOP_ICONS[6], nameKey: 'col.shop.branch', hintKey: 'col.hint.branch' },
    ],
  },
  {
    id: 'moments',
    icon: '✨',
    coins: true,
    items: MOMENT_KINDS.map((k) => ({ id: k, icon: MOMENT_ICONS[k], nameKey: `col.m.${k}` as TextKey, hintKey: `col.hint.m.${k}` as TextKey })),
  },
];

export const SET_IDS: SetId[] = COLLECTION_SETS.map((s) => s.id);
export const collectionSet = (id: SetId): CollectionSet => COLLECTION_SETS.find((s) => s.id === id)!;
export const setName = (id: SetId): TextKey => `col.set.${id}` as TextKey;
export const setHint = (id: SetId): TextKey => `col.hint.${id}` as TextKey;
/** Текстура трофея набора в витрине зала (art/collections.py). */
export const trophyKey = (id: SetId): string => `trophy_${id}`;

/**
 * Монеты за собранный набор — по размеру магазина: в ларьке 100, в универмаге 900, в гипермаркете 1100.
 * Это заметно меньше дня прибыли на любом помещении (docs/BALANCE.md «Коллекции»).
 */
export const setCoins = (level: number): number => 100 + 200 * level;

// ---------------------------------------------------------------- что собрано

const colOf = (state: StoreState): CollectionState => state.collections ?? { got: {} };
export const gotIn = (state: StoreState, set: SetId): string[] => colOf(state).got[set] ?? [];
export const hasItem = (state: StoreState, set: SetId, item: string): boolean => gotIn(state, set).includes(item);
export const setDone = (state: StoreState, set: SetId): boolean => (colOf(state).done ?? []).includes(set);
export const setsDone = (state: StoreState): number => SET_IDS.filter((s) => setDone(state, s)).length;
/** Все наборы собраны — золотая обложка. */
export const albumGolden = (state: StoreState): boolean => setsDone(state) === SET_IDS.length;
/** Сколько нового в альбоме игрок ещё не видел. */
export const freshCount = (state: StoreState): number => (colOf(state).fresh ?? []).length;
export const isFresh = (state: StoreState, set: SetId, item: string): boolean => (colOf(state).fresh ?? []).includes(`${set}:${item}`);

/**
 * Отметить предмет набора. Новый — в альбом с пометкой «новое»; набор собран — монеты сразу и праздник
 * в очередь (его покажет зал). Неизвестный предмет или уже собранный — состояние то же самое.
 */
export function collect(state: StoreState, set: SetId, item: string): StoreState {
  const def = COLLECTION_SETS.find((s) => s.id === set);
  if (!def || !def.items.some((i) => i.id === item) || hasItem(state, set, item)) return state;
  const col = colOf(state);
  const got = [...gotIn(state, set), item];
  // Ларёк есть у каждого с первого дня — это не новость для значка «Новое в альбоме».
  const news = set === 'shops' && item === 'l0' ? [] : [`${set}:${item}`];
  let next: CollectionState = { ...col, got: { ...col.got, [set]: got }, fresh: [...(col.fresh ?? []), ...news] };
  let money = state.money;
  const full = def.items.every((i) => got.includes(i.id));
  if (full && !(col.done ?? []).includes(set)) {
    next = { ...next, done: [...(col.done ?? []), set], party: [...(col.party ?? []), set] };
    if (def.coins) money += setCoins(state.level);
  }
  return { ...state, money, collections: next };
}

/** Что видно по самому магазину: эти предметы альбом добирает сам. */
export function earned(state: StoreState): [SetId, string][] {
  const out: [SetId, string][] = [];
  for (const id of state.album ?? []) out.push(['guests', id]);
  for (let i = 0; i <= Math.min(state.level, STORE_LEVELS.length - 1); i++) out.push(['shops', `l${i}`]);
  if (state.branch) out.push(['shops', 'branch']);
  for (const r of REGULARS) if (state.regulars?.[r.id]) out.push(['friends', r.id]);
  if (state.cat) out.push(['friends', 'cat']);
  if (hasDog(state)) out.push(['friends', 'bobik']);
  for (const h of GAME_HOLIDAYS) if (state.day >= HOLIDAY_DAY[h]) out.push(['holidays', h]);
  // Открытки праздников по настоящему календарю: ключ «id:год», у встроенных праздников id — сама тема.
  for (const key of Object.keys(state.live?.cards ?? {})) {
    const id = key.split(':')[0];
    const theme = LIVE_THEMES.find((th) => id === th || id.startsWith(th));
    if (theme) out.push(['holidays', `live_${theme}`]);
  }
  // Готовые порции на полке «Еда» — значит, это блюдо уже готовили.
  for (const id of DISH_IDS) if ((state.kitchen?.[id] ?? 0) > 0) out.push(['recipes', id]);
  return out;
}

/** Добрать в альбом всё, что уже заработано. Ничего нового — то же самое состояние (по ссылке). */
export function syncCollections(state: StoreState): StoreState {
  let next = state;
  for (const [set, item] of earned(state)) if (!hasItem(next, set, item)) next = collect(next, set, item);
  return next;
}

/** Открыли альбом: пометки «новое» в этом наборе (или во всех) сняты. */
export function seeAlbum(state: StoreState, set?: SetId): StoreState {
  const col = state.collections;
  if (!col?.fresh?.length) return state;
  const fresh = set ? col.fresh.filter((f) => !f.startsWith(`${set}:`)) : [];
  return fresh.length === col.fresh.length ? state : { ...state, collections: { ...col, fresh } };
}

/** Забрать собранные наборы, которые ещё не отпраздновали. */
export function takeParty(state: StoreState): { state: StoreState; sets: SetId[] } {
  const party = state.collections?.party ?? [];
  if (!party.length) return { state, sets: [] };
  return { state: { ...state, collections: { ...state.collections!, party: [] } }, sets: party };
}

/**
 * Старое сохранение (до альбома коллекций): сразу добрать то, что игрок уже заработал. Собранные так
 * наборы тоже приносят награду и праздник в зале — игрок увидит, что альбом уже не пустой.
 */
export const migrateCollections = (state: StoreState): StoreState => syncCollections(state);
