// Подвал (13.11, задача автора #63 «Подвал со своей экосистемой»): тёмный кирпичный зал под магазином — первый
// из этажей здания (floors.ts). Внизу живёт своё, и всё оно связано с остальным магазином:
//  · игровые автоматы (1–4 шт.) — каждый вечер дают деньги, к ним спускаются свои завсегдатаи (лестница у входа).
//    Цена — видна сразу: мамы с детьми начинают обходить магазин (гостей меньше, и тем меньше, чем больше
//    автоматов); иногда облава — автоматы изымают, штраф, рейтинг и доброе имя района падают; «крыша»
//    (racket.ts), если ей платят, забирает долю и с автоматов. Подаём нейтрально: это доход с ясной ценой
//    для репутации, а не «азарт» — ни выигрышей, ни мигающих сумм;
//  · склад-холодильник — склад магазина больше (warehouseCapacity, economy.ts), но гудит и ест свет (счета);
//  · «серая» подсобка — полка «Разное» ломбарда (pawnshop.ts) переезжает вниз и вмещает больше вещей в залог.
//
// Сколько пришло к автоматам, сколько принесли и будет ли облава — только от зерна магазина и номера дня (как
// находки кота, cat.ts): перезапуск дня ничего не перекатывает, симулятор считает то же. Нет поля basement —
// в подвале пусто (или подвала нет): всё как раньше. В Заречье подвал Центра стоит закрытым.

import type { StoreState } from './economy';
import { floorOf } from './floors';
import { addGoodwill } from './goodwill';
import { inZar } from './zarshop';

export type BasementPart = 'cold' | 'back';
export const PART_IDS: BasementPart[] = ['cold', 'back'];

/** Вечер у автоматов: сколько было завсегдатаев, сколько денег, доля «крыши» и облава (если была). */
export interface SlotsDay {
  players: number;
  income: number;
  share: number;
  raid?: { fine: number; n: number };
}

export interface BasementState {
  /** Сколько автоматов стоит. */
  slots: number;
  /** С какого дня стоят автоматы: в первую неделю облав не бывает (участковый ещё не знает). */
  since?: number;
  /** Что ещё есть внизу: склад-холодильник, «серая» подсобка. */
  parts?: BasementPart[];
  /** Последняя облава: когда, штраф и сколько изъяли. Неделю после неё новых автоматов не поставить. */
  raid?: { day: number; fine: number; n: number };
  /** Прошлый вечер — для карточки в «Этажах». */
  last?: SlotsDay & { day: number };
  /** Сколько автоматы принесли за всё время (после доли «крыши», без штрафов). */
  earned?: number;
}

/** Автомат и сколько мест под них: в голом подвале — два, после ремонта (отделка floors.ts) — четыре. */
export const SLOT_COST = 1500;
export const SLOT_PLACES = [2, 4];
/** Убрать автомат: забирают за полцены. */
export const SLOT_RESALE = 0.5;
/**
 * Вечерний доход автомата (в среднем; ± 30% от зерна и дня): растёт с помещением — у большого магазина и людей
 * у входа больше. «Минимаркет» — 120, универмаг — 170.
 * 13.11, симулятор (npm run sim:features 120 12 подвал: холодильник, четыре автомата, ремонт): к 120-му дню денег
 * столько же, сколько без подвала (±0%, шум ±3%) — автоматы окупают себя ровно настолько, сколько уводят гостей и
 * съедают облавы. Выгода — у маленького магазина, у большого уход мам с детьми дороже вечерней выручки.
 */
export const slotIncome = (level: number): number => 70 + 25 * level;
/** Сколько гостей магазина каждый автомат отпугивает (мамы с детьми обходят): −3% за штуку, четыре — −12%. */
export const MOMS_PER_SLOT = 0.03;
/**
 * Облава: шанс за вечер растёт с числом автоматов (один — 0,9%, четыре — 2,4%: в среднем раз в полтора месяца),
 * первую неделю после установки — нет. Штраф растёт с числом автоматов; рейтинг и доброе имя района — вниз.
 */
export const RAID_BASE = 0.004;
export const RAID_PER_SLOT = 0.005;
export const RAID_GRACE = 7;
export const raidFine = (n: number): number => 200 + 300 * n;
export const RAID_RATING = 0.2;
export const RAID_GOODWILL = -6;
/** После облавы новых автоматов неделю не поставить: участковый заходит проверить. */
export const RAID_COOLDOWN = 7;
/** «Крыша» (racket.ts), которой платят, забирает и с автоматов: треть вечернего дохода. */
export const RACKET_SLOT_SHARE = 0.3;

/** Склад-холодильник: склад больше на 40% от склада помещения, свет — как ещё один холодильник в месяц. */
export const PARTS: Record<BasementPart, { cost: number }> = { cold: { cost: 2500 }, back: { cost: 2000 } };
export const COLD_ROOM = 0.4;
export const COLD_POWER = 100;
/** «Серая» подсобка: на столько больше вещей в залоге у ломбарда (pawnSlots). */
export const BACK_PAWN_SLOTS = 2;

/** Случайность подвала: зерно магазина, день и «соль» — у каждого броска своя (как у «крыши»). */
function roll(state: StoreState, salt: number): number {
  let h = ((state.seed ?? 1) * 2654435761 + state.day * 2246822519 + salt * 3266489917) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Подвал в сохранении (с поправкой на кривые поля); подвала нет или мы в Заречье — null. */
export function basementOf(state: StoreState): BasementState | null {
  if (!floorOf(state, 'basement')) return null;
  const b = state.basement;
  const slots = Math.max(0, Math.min(SLOT_PLACES[SLOT_PLACES.length - 1], Math.floor(Number(b?.slots) || 0)));
  const parts = (b?.parts ?? []).filter((p) => p in PARTS);
  if (b && slots === b.slots && parts.length === (b.parts ?? []).length) return b;
  return { ...b, slots, ...(parts.length ? { parts } : { parts: undefined }) };
}

const set = (state: StoreState, basement: BasementState): StoreState => ({ ...state, basement });

/** Сколько автоматов помещается: по отделке подвала. */
export const slotPlaces = (state: StoreState): number => SLOT_PLACES[Math.min(SLOT_PLACES.length - 1, floorOf(state, 'basement')?.finish ?? 0)];
export const slotCount = (state: StoreState): number => basementOf(state)?.slots ?? 0;
export const hasPart = (state: StoreState, part: BasementPart): boolean => Boolean(basementOf(state)?.parts?.includes(part));

/** До какого дня (включительно) автоматы не поставить после облавы; 0 — можно. */
export const raidLock = (state: StoreState): number => {
  const raid = basementOf(state)?.raid;
  return raid && state.day < raid.day + RAID_COOLDOWN ? raid.day + RAID_COOLDOWN - 1 : 0;
};

export function buySlot(state: StoreState): StoreState | null {
  const b = basementOf(state);
  if (!b || b.slots >= slotPlaces(state) || raidLock(state) || state.money < SLOT_COST) return null;
  return set({ ...state, money: state.money - SLOT_COST }, { ...b, slots: b.slots + 1, since: b.slots ? (b.since ?? state.day) : state.day });
}

/** Убрать автомат (за полцены): репутация дороже — так игрок может передумать. */
export function sellSlot(state: StoreState): StoreState | null {
  const b = basementOf(state);
  if (!b || !b.slots) return null;
  const slots = b.slots - 1;
  const { since: _since, ...rest } = b;
  return set({ ...state, money: state.money + Math.round(SLOT_COST * SLOT_RESALE) }, slots ? { ...b, slots } : { ...rest, slots });
}

export function buyPart(state: StoreState, part: BasementPart): StoreState | null {
  const b = basementOf(state);
  if (!b || !(part in PARTS) || b.parts?.includes(part) || state.money < PARTS[part].cost) return null;
  return set({ ...state, money: state.money - PARTS[part].cost }, { ...b, parts: [...(b.parts ?? []), part] });
}

/** Склад-холодильник: доля к складу помещения (warehouseCapacity) и свет за месяц (monthlyBill). */
export const coldRoom = (state: StoreState): number => (hasPart(state, 'cold') ? COLD_ROOM : 0);
export const coldPower = (state: StoreState): number => (hasPart(state, 'cold') ? COLD_POWER : 0);
/** «Серая» подсобка: лишние места под залоги ломбарда (pawnSlots) — и полка «Разное» внизу, а не на складе. */
export const backSlots = (state: StoreState): number => (hasPart(state, 'back') ? BACK_PAWN_SLOTS : 0);

/** Мамы с детьми обходят магазин с автоматами в подвале: гостей меньше. */
export const basementGuests = (state: StoreState): number => 1 - MOMS_PER_SLOT * slotCount(state);

/** Шанс облавы этим вечером (0 — автоматов нет или первая неделя). */
export function raidChance(state: StoreState): number {
  const b = basementOf(state);
  if (!b?.slots || state.day - (b.since ?? state.day) < RAID_GRACE) return 0;
  return RAID_BASE + RAID_PER_SLOT * b.slots;
}

/** Платят «крыше» (racket.ts): она берёт долю и с автоматов. */
const racketPays = (state: StoreState): boolean => state.racket?.mode === 'pay' && !state.racket.end;

/**
 * Вечер у автоматов, как он пройдёт: завсегдатаи и деньги (без облавы). Утром — тот же расчёт: прогноз в карточке
 * честный, а сцена показывает столько же людей на лестнице.
 */
export function slotsPlan(state: StoreState): { players: number; income: number; share: number } | null {
  const b = basementOf(state);
  if (!b?.slots || inZar(state)) return null;
  const r = roll(state, 1);
  const players = b.slots * 2 + Math.floor(r * (b.slots * 2 + 1));
  const income = Math.round((b.slots * slotIncome(state.level) * (0.7 + 0.6 * r)) / 10) * 10;
  return { players, income, share: racketPays(state) ? Math.round(income * RACKET_SLOT_SHARE) : 0 };
}

/**
 * Вечер (day.ts nightCycle, до счетов): доход автоматов в кассу, доля «крыше» — ей, иногда облава. Облава
 * приходит к закрытию: выручку автоматов изымают вместе с ними, штраф — из кассы, чего не хватит — в долг.
 */
export function basementNight(state: StoreState): { state: StoreState; day: SlotsDay | null } {
  const b = basementOf(state);
  const plan = slotsPlan(state);
  if (!b || !plan) return { state, day: null };
  if (roll(state, 2) < raidChance(state)) {
    const fine = raidFine(b.slots);
    const raid = { day: state.day, fine, n: b.slots };
    const { since: _since, ...rest } = b;
    const day: SlotsDay = { players: plan.players, income: 0, share: 0, raid: { fine, n: b.slots } };
    const s: StoreState = {
      ...state,
      money: Math.max(0, state.money - fine),
      debt: state.debt + Math.max(0, fine - Math.max(0, state.money)),
      rating: Math.max(0, Math.round((state.rating - RAID_RATING) * 100) / 100),
      basement: { ...rest, slots: 0, raid, last: { ...day, day: state.day } },
    };
    return { state: addGoodwill(s, RAID_GOODWILL), day };
  }
  const day: SlotsDay = { ...plan };
  const net = plan.income - plan.share;
  let s = set({ ...state, money: state.money + net }, { ...b, last: { ...day, day: state.day }, earned: (b.earned ?? 0) + net });
  if (plan.share && s.racket) s = { ...s, racket: { ...s.racket, paid: (s.racket.paid ?? 0) + plan.share } };
  return { state: s, day };
}
