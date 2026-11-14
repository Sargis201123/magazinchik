// Мечты соседей (13.11, автор: «вложиться в мечту соседа»). Знакомые лица района иногда приходят утром с мечтой:
// Костя — о кофейной тележке, Аня — о своей пекарне, Пётр Ильич — починить лодочную станцию в парке, Ахмед — о своём
// такси. Карточка: кто, о чём, сколько нужно; «Вложиться» или «Не сейчас». Через две-три недели — новость: дело пошло
// (тележка Кости у входа и доля с неё каждый день, хлеб от Ани дешевле, по выходным в парк едут кататься и заходят
// к нам, Ахмед возвращает вдвое) или прогорело — деньги пропали, но человек благодарен: доверие до предела, тёплое
// слово, иногда гостинец. Исход — от зерна магазина и дня вложения (как находка кота, cat.ts), без общего генератора.
// Только в Центре: это наш район. Карточки — ui/dreams.ts, тележка и указатель на улице — scenes/dreamsFx.ts.

import { MAX_LOYALTY, met, regularById, regularState, type RegularId } from './regulars';
import { homeLevel, inZar } from './zarshop';
import type { StoreState } from './economy';

export type DreamId = 'kostya' | 'anya' | 'petr' | 'akhmed';
/** Что даёт сбывшаяся мечта: доля с тележки, хлеб дешевле, гости по выходным, долг вдвое. */
export type DreamPerk = 'cart' | 'bread' | 'boat' | 'payback';

export interface Dream {
  icon: string;
  /** С какого дня приходит с мечтой (после своих событий жизни: Костя — после диплома, life.ts). */
  from: number;
  /** Сколько просит в «Минимаркете»; в других помещениях — по LEVEL_SCALE. */
  base: number;
  /** Шанс, что дело пойдёт. */
  chance: number;
  perk: DreamPerk;
  /** Постоянный покупатель (его доверие растёт); Аня — из историй (tales.ts), не постоянная. */
  regular?: RegularId;
}

export const DREAMS: Record<DreamId, Dream> = {
  kostya: { icon: '☕', from: 30, base: 800, chance: 0.7, perk: 'cart', regular: 'kostya' },
  anya: { icon: '🥖', from: 45, base: 1200, chance: 0.65, perk: 'bread' },
  petr: { icon: '⛵', from: 60, base: 1000, chance: 0.6, perk: 'boat', regular: 'petr' },
  akhmed: { icon: '🚕', from: 80, base: 1000, chance: 0.6, perk: 'payback', regular: 'akhmed' },
};
export const DREAM_IDS = Object.keys(DREAMS) as DreamId[];

/**
 * Сумма растёт с магазином (по помещению в Центре): к 30-му дню у игрока ~3 тыс. и «Минимаркет», к 60-му — ~15 тыс.
 * и универсам (docs/BALANCE.md). Просьба — заметная, но не разоряет: 15–25% кошелька в своё время.
 */
export const LEVEL_SCALE = [0.5, 0.75, 1, 1.5, 2, 3, 4];
/** Между карточками (мечта или ответ) — передышка; «Не сейчас» — та же мечта ещё раз через столько дней, один раз. */
export const DREAM_GAP = 12;
export const DREAM_ASK_AGAIN = 20;
/** Сколько ждать новостей после вложения: от и до (дней). */
export const DREAM_WAIT = [14, 21] as const;
/** Тележка Кости: доля в день от вложенного (окупается за ~3 недели и дальше капает). */
export const CART_SHARE = 0.05;
/** Хлеб от Ани: настолько дешевле у поставщиков. */
export const BREAD_CUT = 0.1;
/** Лодочная станция: по выходным (rush.ts) гостей больше на столько. */
export const BOAT_GUESTS = 0.12;
/** Ахмед возвращает вложенное с прибылью — во столько раз. */
export const PAYBACK = 2;
/** Прогорело — иногда (шанс) приносят гостинец: такую долю вложенного. */
export const GIFT_CHANCE = 0.5;
export const GIFT_SHARE = 0.2;

export interface DreamInvest {
  id: DreamId;
  /** День вложения: от него срок и исход. */
  day: number;
  sum: number;
  /** Чем кончилось (новость прочитана); нет — ждём. */
  end?: 'ok' | 'fail';
}

export interface DreamsState {
  inv?: DreamInvest[];
  /** «Не сейчас»: с какого дня мечта может вернуться (один раз). */
  later?: Partial<Record<DreamId, number>>;
  /** Отказали дважды — больше не просит. */
  gone?: DreamId[];
  /** День последней карточки (мечта или новость о ней): одна за утро, между мечтами — передышка. */
  last?: number;
}

const known = (id: unknown): id is DreamId => typeof id === 'string' && id in DREAMS;

/** Вложения из сохранения: неизвестных мечт не бывает (на случай правки списка). */
export const investsOf = (state: StoreState): DreamInvest[] => (state.dreams?.inv ?? []).filter((v) => known(v.id));
const investOf = (state: StoreState, id: DreamId): DreamInvest | undefined => investsOf(state).find((v) => v.id === id);

export const dreamSum = (state: StoreState, id: DreamId): number =>
  Math.round((DREAMS[id].base * LEVEL_SCALE[Math.min(homeLevel(state), LEVEL_SCALE.length - 1)]) / 50) * 50;

/** Детерминированное число 0…1 от зерна магазина, дня вложения и мечты (salt — какой вопрос). */
function roll(state: StoreState, v: Pick<DreamInvest, 'id' | 'day'>, salt: number): number {
  let h = ((state.seed ?? 1) * 2654435761 + v.day * 40503 + (DREAM_IDS.indexOf(v.id) + 1) * 97 + salt * 7919) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return (h % 10000) / 10000;
}

/** Через сколько дней после вложения придёт новость. */
export const waitOf = (state: StoreState, v: DreamInvest): number => DREAM_WAIT[0] + Math.floor(roll(state, v, 1) * (DREAM_WAIT[1] - DREAM_WAIT[0] + 1));
/** Пошло ли дело. */
export const dreamWorks = (state: StoreState, v: DreamInvest): boolean => roll(state, v, 2) < DREAMS[v.id].chance;
/** Гостинец, если прогорело (0 — без него). */
export const dreamGift = (state: StoreState, v: DreamInvest): number => (roll(state, v, 3) < GIFT_CHANCE ? Math.round((v.sum * GIFT_SHARE) / 10) * 10 : 0);

/** Вложение, по которому пора узнать новость (ещё не прочитанную). */
export function dreamDue(state: StoreState): DreamInvest | null {
  return investsOf(state).find((v) => !v.end && state.day >= v.day + waitOf(state, v)) ?? null;
}

/** Чья мечта может прийти сегодня: по порядку списка, знакомы и не в обиде, не вкладывались и не отказали дважды. */
export function dreamOffer(state: StoreState): DreamId | null {
  const d = state.dreams;
  if (inZar(state) || state.day < (d?.last ?? -Infinity) + DREAM_GAP) return null;
  return (
    DREAM_IDS.find((id) => {
      const dream = DREAMS[id];
      if (state.day < dream.from || investOf(state, id) || d?.gone?.includes(id) || state.day < (d?.later?.[id] ?? 0)) return false;
      if (!dream.regular) return true;
      const r = regularById(dream.regular);
      return met(state, r) && regularState(state, dream.regular).awayUntil < state.day;
    }) ?? null
  );
}

export type DreamNews = { kind: 'ask'; id: DreamId; sum: number } | { kind: 'result'; inv: DreamInvest; ok: boolean; gift: number };

/** Утренняя карточка (одна за утро, только в Центре): сначала новость о вложении, потом новая мечта. */
export function dreamNews(state: StoreState): DreamNews | null {
  if (inZar(state) || state.dreams?.last === state.day) return null;
  const due = dreamDue(state);
  if (due) {
    const ok = dreamWorks(state, due);
    return { kind: 'result', inv: due, ok, gift: ok ? 0 : dreamGift(state, due) };
  }
  const id = dreamOffer(state);
  return id ? { kind: 'ask', id, sum: dreamSum(state, id) } : null;
}

const withDreams = (state: StoreState, patch: Partial<DreamsState>): StoreState => ({ ...state, dreams: { ...state.dreams, ...patch, last: state.day } });

/** Вложиться в мечту, что пришла сегодня. null — не она, или денег не хватает. */
export function investDream(state: StoreState, id: DreamId): StoreState | null {
  const news = dreamNews(state);
  if (news?.kind !== 'ask' || news.id !== id || state.money < news.sum) return null;
  const s = { ...state, money: state.money - news.sum };
  return withDreams(s, { inv: [...investsOf(state), { id, day: state.day, sum: news.sum }] });
}

/** «Не сейчас»: первый раз — вернётся через DREAM_ASK_AGAIN дней, второй — больше не просит. */
export function skipDream(state: StoreState, id: DreamId): StoreState {
  const d = state.dreams;
  if (d?.later?.[id] !== undefined) return withDreams(state, { gone: [...(d.gone ?? []), id] });
  return withDreams(state, { later: { ...d?.later, [id]: state.day + DREAM_ASK_AGAIN } });
}

/**
 * Прочитали новость о вложении: исход записан, деньги — сразу (Ахмед возвращает, гостинец), постоянный — на полном
 * доверии (благодарен в любом случае). Дальше сбывшаяся мечта работает сама (cartIncome, breadCut, dreamGuests).
 */
export function seeDream(state: StoreState): StoreState | null {
  const news = dreamNews(state);
  if (news?.kind !== 'result') return null;
  const { inv, ok, gift } = news;
  const money = ok && DREAMS[inv.id].perk === 'payback' ? inv.sum * PAYBACK : gift;
  let s: StoreState = { ...state, money: state.money + money };
  const who = DREAMS[inv.id].regular;
  if (who) s = { ...s, regulars: { ...s.regulars, [who]: { ...regularState(s, who), loyalty: MAX_LOYALTY } } };
  const end: DreamInvest['end'] = ok ? 'ok' : 'fail';
  return withDreams(s, { inv: investsOf(state).map((v) => (v === inv ? { ...v, end } : v)) });
}

/** Сбылась ли мечта (и новость о ней прочитана). */
export const dreamCame = (state: StoreState, id: DreamId): DreamInvest | null => {
  const v = investOf(state, id);
  return v?.end === 'ok' ? v : null;
};

/** Доля с Костиной тележки у входа за день (0 — тележки нет). */
export const cartIncome = (state: StoreState): number => {
  const v = dreamCame(state, 'kostya');
  return v ? Math.round(v.sum * CART_SHARE) : 0;
};

/** Тележка Кости стоит у нашего входа (в Центре): днём он за ней, а не в очереди к кассе. */
export const cartHere = (state: StoreState): boolean => !inZar(state) && Boolean(dreamCame(state, 'kostya'));

/** Вечером доля с тележки — в кассу, до счетов (как аренда, tenants.ts). Тележка торгует и когда хозяин в Заречье. */
export function dreamsNight(state: StoreState): { state: StoreState; income: number } {
  const income = cartIncome(state);
  return income ? { state: { ...state, money: state.money + income }, income } : { state, income: 0 };
}

/** Скидка на хлеб у поставщиков от Аниной пекарни (только в Центре: Аня возит хлеб соседям). */
export const breadCut = (state: StoreState): number => (!inZar(state) && dreamCame(state, 'anya') ? BREAD_CUT : 0);

/** Гости от лодочной станции: по выходным в парк едут кататься и заходят к нам (только в Центре — day.ts homeOnly). */
export const dreamGuests = (state: StoreState): number => (state.rush && dreamCame(state, 'petr') ? 1 + BOAT_GUESTS : 1);
