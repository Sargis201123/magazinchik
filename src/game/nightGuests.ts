// Ночные гости с характером. Ночью заходят другие люди: таксисты, студенты, врачи после смены,
// охранники, музыканты, те, кому не спится, влюблённые за цветами и один странный тип в плаще,
// которому нужен «только томатный сок». У каждого свой список покупок и своя реплика.
// Иногда ночью случается история с выбором:
// - студент просит пельмени в долг до стипендии (вернёт вдвое — если вернёт);
// - таксист просит погреться — расскажет о нас пассажирам (завтра гостей больше);
// - врач после суток задремал у кассы — дать поспать, проснётся и накупит;
// - музыкант просит поиграть у входа — до утра гостей больше, и чаевые.

import { onShelves, PRODUCTS, type ProductId, type StoreState } from './economy';

export type NightGuestId = 'taxi' | 'student' | 'doctor' | 'guard' | 'musician' | 'insomniac' | 'lovers' | 'vampire';

export interface NightGuest {
  weight: number;
  wants: ProductId[];
  /** Сколько реплик у входа (nightGuest.<id>.<n> в словаре). */
  lines: number;
}

export const NIGHT_GUEST_TYPES: Record<NightGuestId, NightGuest> = {
  taxi: { weight: 4, wants: ['water', 'juice', 'pies', 'buns'], lines: 2 },
  student: { weight: 4, wants: ['dumplings', 'buns', 'juice', 'potatoes'], lines: 2 },
  doctor: { weight: 3, wants: ['apples', 'juice', 'milk', 'water'], lines: 2 },
  guard: { weight: 3, wants: ['bread', 'milk', 'dumplings', 'fish'], lines: 2 },
  musician: { weight: 2, wants: ['juice', 'water', 'honeycake', 'pies'], lines: 2 },
  insomniac: { weight: 2, wants: ['milk', 'bread', 'tangerines', 'apples'], lines: 2 },
  lovers: { weight: 1, wants: ['flowers', 'honeycake', 'juice', 'icecream'], lines: 2 },
  vampire: { weight: 1, wants: ['juice', 'meat'], lines: 2 },
};
export const NIGHT_GUEST_IDS = Object.keys(NIGHT_GUEST_TYPES) as NightGuestId[];

/** Кто зашёл ночью. */
export function pickNightGuest(random: () => number): NightGuestId {
  const total = NIGHT_GUEST_IDS.reduce((s, id) => s + NIGHT_GUEST_TYPES[id].weight, 0);
  let roll = random() * total;
  return NIGHT_GUEST_IDS.find((id) => (roll -= NIGHT_GUEST_TYPES[id].weight) < 0) ?? 'taxi';
}

// ---------- Ночные истории ----------

export type NightStoryId = 'studentDebt' | 'taxiTea' | 'sleepyDoctor' | 'busker';
export const NIGHT_STORY_IDS: NightStoryId[] = ['studentDebt', 'taxiTea', 'sleepyDoctor', 'busker'];
/** Кто приходит с историей. */
export const STORY_GUEST: Record<NightStoryId, NightGuestId> = { studentDebt: 'student', taxiTea: 'taxi', sleepyDoctor: 'doctor', busker: 'musician' };

/** Шанс, что за ночную смену случится история. */
export const NIGHT_STORY_CHANCE = 0.6;
/** Студент берёт столько штук и возвращает через столько дней вдвое (если вернёт). */
export const DEBT_UNITS = 2;
export const DEBT_DAYS = 3;
export const DEBT_RETURN_CHANCE = 0.8;
export const DEBT_RATING = 0.05;
/** Таксист рассказал пассажирам: завтра гостей больше. */
export const TAXI_GUESTS = 1.06;
/** Врач выспался — накупил на столько и поблагодарил. */
export const DOCTOR_PAY = 3;
export const DOCTOR_RATING = 0.05;
/** Музыкант у входа: ночных гостей больше и чаевые. */
export const BUSKER_GUESTS = 1.3;
export const BUSKER_TIP = 50;

export interface NightState {
  /** Студент должен: сколько и когда принесёт. */
  debt?: { amount: number; due: number };
  /** Завтра гостей больше (таксист рассказал о нас). */
  boost?: number;
  /** Утренняя новость: студент вернул долг или пропал. */
  news?: 'repaid' | 'vanished';
  newsAmount?: number;
}

/** Будет ли сегодня ночная история и какая. */
export function nightStory(random: () => number): NightStoryId | null {
  if (random() >= NIGHT_STORY_CHANCE) return null;
  return NIGHT_STORY_IDS[Math.floor(random() * NIGHT_STORY_IDS.length)];
}

/** Чем студент хочет поужинать: пельмени, а нет — картошка или хлеб (что есть на полках). */
export const debtProduct = (state: StoreState): ProductId | null =>
  (['dumplings', 'potatoes', 'bread'] as ProductId[]).find((id) => onShelves(state, id) >= DEBT_UNITS) ?? null;

export interface NightAnswer {
  state: StoreState;
  money: number;
  rating: number;
}

/**
 * Ответ на историю. Товар студенту сцена снимает с полок сама (takeFromShelf) — здесь
 * только долг. sold — сколько врач потратил бы обычно (для «накупил втрое»).
 */
export function answerNightStory(state: StoreState, story: NightStoryId, yes: boolean, sold = 0): NightAnswer {
  const night = state.nightGuests ?? {};
  if (!yes) return { state, money: 0, rating: 0 };
  switch (story) {
    case 'studentDebt': {
      const id = debtProduct(state);
      if (!id) return { state, money: 0, rating: 0 };
      const amount = state.prices[id] * DEBT_UNITS * 2;
      return { state: { ...state, nightGuests: { ...night, debt: { amount, due: state.day + DEBT_DAYS } } }, money: 0, rating: 0 };
    }
    case 'taxiTea':
      return { state: { ...state, nightGuests: { ...night, boost: state.day + 1 } }, money: 0, rating: 0 };
    case 'sleepyDoctor': {
      const pay = Math.max(60, Math.round(sold * DOCTOR_PAY));
      const rating = Math.round(Math.min(5, state.rating + DOCTOR_RATING) * 100) / 100;
      return { state: { ...state, money: state.money + pay, rating }, money: pay, rating: DOCTOR_RATING };
    }
    case 'busker':
      return { state: { ...state, money: state.money + BUSKER_TIP }, money: BUSKER_TIP, rating: 0 };
  }
}

/** Утро: студент приносит долг (или пропадает); новость — в утренние строки. */
export function nightMorning(state: StoreState, random: () => number): StoreState {
  const night = state.nightGuests;
  const debt = night?.debt;
  const cleared = night?.news ? { ...night, news: undefined, newsAmount: undefined } : night;
  if (!debt || state.day < debt.due) return cleared === night ? state : { ...state, nightGuests: cleared };
  if (random() < DEBT_RETURN_CHANCE) {
    const rating = Math.round(Math.min(5, state.rating + DEBT_RATING) * 100) / 100;
    return { ...state, money: state.money + debt.amount, rating, nightGuests: { ...cleared, debt: undefined, news: 'repaid', newsAmount: debt.amount } };
  }
  return { ...state, nightGuests: { ...cleared, debt: undefined, news: 'vanished' } };
}

/** Множитель гостей: таксист вчера рассказал о нас пассажирам. */
export const nightBoostGuests = (state: StoreState): number => (state.nightGuests?.boost === state.day ? TAXI_GUESTS : 1);

/** Стоимость товара для подписи: «2 × 🥟 Пельмени». */
export const debtLabel = (id: ProductId): string => `${DEBT_UNITS} × ${PRODUCTS[id].icon}`;
