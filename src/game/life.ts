// Живой район: постоянные покупатели живут своей жизнью. Костя защищает диплом и начинает
// зарабатывать, Пётр Ильич и Ольга Николаевна находят друг друга, у Светы рождается малыш (она
// приходит с коляской), Костя женится и сам становится папой, Ахмед седеет, старший сын Светы
// подрастает и ходит за соком сам. Новость приходит утром: можно сделать подарок (доверие растёт
// сильнее) или просто поздравить. События по дням игры; кто начал давно — видит уже прожитое.

import { MAX_LOYALTY, regularById, regularState, type Regular, type RegularId, type RegularLook } from './regulars';
import type { StoreState } from './economy';
import type { TextKey } from '../i18n/ru';

export type LifeKind = 'graduate' | 'couple' | 'baby' | 'wedding' | 'gray' | 'retire' | 'grown';

export interface LifeEvent {
  id: string;
  day: number;
  kind: LifeKind;
  /** Чья это новость (первый — главный). */
  who: RegularId[];
  textKey: TextKey;
}

export const LIFE: LifeEvent[] = [
  { id: 'kostya_diploma', day: 25, kind: 'graduate', who: ['kostya'], textKey: 'life.kostya_diploma' },
  { id: 'petr_olga', day: 40, kind: 'couple', who: ['petr', 'olga'], textKey: 'life.petr_olga' },
  { id: 'sveta_baby', day: 55, kind: 'baby', who: ['sveta'], textKey: 'life.sveta_baby' },
  { id: 'kostya_wedding', day: 70, kind: 'wedding', who: ['kostya'], textKey: 'life.kostya_wedding' },
  { id: 'akhmed_gray', day: 90, kind: 'gray', who: ['akhmed'], textKey: 'life.akhmed_gray' },
  { id: 'olga_retire', day: 110, kind: 'retire', who: ['olga'], textKey: 'life.olga_retire' },
  { id: 'kostya_baby', day: 130, kind: 'baby', who: ['kostya'], textKey: 'life.kostya_baby' },
  { id: 'misha_grown', day: 180, kind: 'grown', who: ['misha'], textKey: 'life.misha_grown' },
];

/** Подарок на радостное событие: столько монет, доверие +2 (поздравить — +1). */
export const LIFE_GIFT = 150;
/** Новость показываем, если событие было не больше стольких дней назад. */
export const LIFE_NEWS_DAYS = 7;

/** Жена Кости — не постоянная покупательница, ходит с ним. */
const KOSTYA_WIFE: RegularLook = { shirt: 0xb55088, skin: 0xf2d3ab, pants: 0x262b44, hair: 0x181425, style: 'long', bag: 'bag', bagTint: 0xfee761 };
const GRAY = 0xc0c0c8;
const STROLLER = 0x5b6ee1;

const happened = (state: StoreState, id: string): boolean => state.day >= LIFE.find((e) => e.id === id)!.day;

/** Новость утра: недавнее событие, которое ещё не видели (давние — уже прожиты, без новости). */
export function lifeNews(state: StoreState): LifeEvent | null {
  const seen = state.lifeSeen ?? [];
  return LIFE.find((e) => e.day <= state.day && state.day - e.day <= LIFE_NEWS_DAYS && !seen.includes(e.id)) ?? null;
}

/** Ответ на новость: подарок (дороже, доверие +2) или поздравить (+1). */
export function answerLife(state: StoreState, event: LifeEvent, gift: boolean): StoreState | null {
  if (gift && state.money < LIFE_GIFT) return null;
  const regulars = { ...state.regulars };
  for (const id of event.who) {
    const cur = regularState(state, id);
    regulars[id] = { ...cur, loyalty: Math.min(MAX_LOYALTY, cur.loyalty + (gift ? 2 : 1)) };
  }
  return { ...state, money: state.money - (gift ? LIFE_GIFT : 0), regulars, lifeSeen: [...(state.lifeSeen ?? []), event.id] };
}

/** Постоянный покупатель сегодня — с тем, что с ним уже случилось: внешность, привычки. */
export function livedRegular(state: StoreState, r: Regular): Regular {
  const look: RegularLook = { ...r.look };
  let { every, tolerance } = r;
  if (r.id === 'kostya' && happened(state, 'kostya_diploma')) tolerance = Math.max(tolerance, 1.1);
  if (r.id === 'akhmed' && happened(state, 'akhmed_gray')) look.hair = GRAY;
  if (r.id === 'olga' && happened(state, 'olga_retire')) every = Math.max(every, 0.9);
  // Малыш в коляске: у Светы — пока старший не подрос, у Кости — дальше всегда.
  if (r.id === 'sveta' && happened(state, 'sveta_baby') && !happened(state, 'misha_grown')) look.stroller = STROLLER;
  if (r.id === 'kostya' && happened(state, 'kostya_baby')) look.stroller = 0xf6757a;
  return { ...r, look, every, tolerance };
}

/** С кем приходит: Пётр Ильич с Ольгой Николаевной, Костя с женой. null — один. */
export function companionOf(state: StoreState, id: RegularId): { look: RegularLook; regular?: RegularId } | null {
  if (happened(state, 'petr_olga') && (id === 'petr' || id === 'olga')) {
    const other: RegularId = id === 'petr' ? 'olga' : 'petr';
    return { look: livedRegular(state, regularById(other)).look, regular: other };
  }
  if (id === 'kostya' && happened(state, 'kostya_wedding')) return { look: KOSTYA_WIFE };
  return null;
}
