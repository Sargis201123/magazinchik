// Ученик (13.11, автор: задача #51). Подросток из района просится в ученики, когда в магазине уже есть
// персонал. Каждое утро игрок ставит его на кассу, на склад или в зал (или даёт выходной) — чему учишь, таким
// он и вырастает: касса — быстрые руки (касса пробивает быстрее), склад — сильные руки (сам носит коробки на
// полки), зал — обаяние (покупатели терпеливее, бывают чаевые «за помощь»). Навык — это просто сколько дней
// он простоял на месте: так рост виден в карточке полосками и понятен без формул.
//
// Отношение — «доверие» 0…100: стипендия каждый рабочий вечер и похвала копят его; одно и то же место
// изо дня в день (скучно), неделя без выходного (устал) и пустая стипендия — роняют. Через сезон (SEASON
// дней) он уходит открывать свою лавку: с доверием от FRIEND_FROM — друг на твоей улице (касса и зал —
// шлёт покупателей, склад — берёт товар вскладчину, поставки дешевле), ниже — ещё один конкурент.
//
// Всё детерминировано: никаких случайностей, кроме имени (от зерна магазина). Старые сохранения без полей
// appr/apprGrads/apprAsk работают как раньше: учеников просто ещё не было.

import type { StoreState } from './economy';
import { inZar } from './zarshop';

/** Где ученик сегодня. */
export type ApprPost = 'till' | 'stock' | 'floor' | 'rest';
/** Чему учится (места работы). */
export type ApprSkill = Exclude<ApprPost, 'rest'>;
export const APPR_SKILLS: readonly ApprSkill[] = ['till', 'stock', 'floor'];
export const APPR_POSTS: readonly ApprPost[] = ['till', 'stock', 'floor', 'rest'];

export interface Apprentice {
  /** Номер имени в списке appr.names: чётные — мальчики, нечётные — девочки (как портреты appr0/appr1). */
  name: number;
  /** С какого дня учится. */
  since: number;
  /** Где сегодня; выбор держится, пока его не сменят. */
  post: ApprPost;
  /** Доверие 0…100. */
  trust: number;
  /** Сколько дней отработал на каждом месте — это и есть навык. */
  skill: Partial<Record<ApprSkill, number>>;
  /** Дел за всё время на каждом месте: упакованные покупки, коробки, подсказки гостям (живые факты карточки). */
  deeds?: Partial<Record<ApprSkill, number>>;
  /** Последнее рабочее место и сколько дней подряд на нём; рабочих дней подряд без выходного. */
  last?: ApprSkill;
  same?: number;
  worked?: number;
  /** Стипендию не платить (по умолчанию платим). */
  unpaid?: boolean;
  /** Когда хвалили последний раз. */
  praised?: number;
  /** Сколько выплачено стипендии и сколько чаевых «за помощь» принёс. */
  paid?: number;
  tips?: number;
}

/** Выпускник: своя лавка на улице — друг или конкурент. */
export interface ApprGrad {
  name: number;
  /** Кем вырос: чему учился больше всего. */
  spec: ApprSkill;
  friend: boolean;
  /** Ночь выпуска. */
  day: number;
  /** Утреннюю историю об открытии уже показали. */
  seen?: boolean;
}

/** Ученики — когда магазин уже не ларёк и в нём кто-то работает. */
export const APPR_FROM_LEVEL = 1;
/** Не раньше этого дня: первые недели новичку и так хватает нового. */
export const APPR_FROM_DAY = 15;
/** Отказался — подросток спросит снова через столько дней. */
export const APPR_ASK_AGAIN = 10;
/** После выпуска следующий ученик просится через столько дней. */
export const APPR_NEXT = 14;
/** Лавок учеников на улице — не больше стольких (дальше свободных помещений нет). */
export const APPR_MAX = 3;
/** Сколько длится учёба: сезон, четыре игровых недели. */
export const SEASON = 28;
/** Стипендия за рабочий день. */
export const STIPEND = 15;
/** Сколько имён в appr.names. */
export const APPR_NAMES = 6;

/** Доверие: с чего начинается и с какого выпускник остаётся другом. */
export const TRUST_START = 50;
export const FRIEND_FROM = 60;
export const TRUST_PAID = 2;
export const TRUST_UNPAID = 4;
/** Столько дней подряд на одном месте — и дальше каждый такой день скучен. */
export const BORED_FROM = 4;
export const TRUST_BORED = 3;
/** Столько рабочих дней подряд — и дальше без выходного он устаёт. */
export const TIRED_FROM = 7;
export const TRUST_TIRED = 3;
/** Выходной после стольких рабочих дней — в радость; раньше — скучно без дела. */
export const REST_EARNED = 3;
export const TRUST_REST = 3;
export const TRUST_IDLE = 1;
/** Похвала: раз в столько дней (чаще — уже не работает). */
export const PRAISE_EVERY = 3;
export const TRUST_PRAISE = 3;

/** Навык считается до стольких дней на месте (дальше полоска полная). */
export const SKILL_CAP = 20;
/** Касса с учеником: пакует покупки — пробивка быстрее на 3% и ещё на 0,4% за каждый день на кассе. */
export const SCAN_BASE = 0.03;
export const SCAN_STEP = 0.004;
/** Зал с учеником: гости терпеливее (5% и 0,5% за день) и иногда оставляют чаевые «за помощь». */
export const PATIENCE_BASE = 0.05;
export const PATIENCE_STEP = 0.005;
export const TIP_BASE = 0.03;
export const TIP_STEP = 0.002;
export const APPR_TIP = 5;
/** Склад с учеником: сам носит коробки на полки — с 70% скорости грузчика до 110% к концу учёбы. */
export const STOCK_PACE_BASE = 0.7;
export const STOCK_PACE_STEP = 0.02;

/** Лавка друга: касса и зал — шлёт покупателей, склад — закупка вскладчину. Конкурент уводит гостей. */
export const FRIEND_GUESTS = 0.03;
export const FRIEND_SUPPLIES = 0.02;
export const RIVAL_GUESTS = 0.02;

const clamp = (n: number): number => Math.max(0, Math.min(100, n));
export const gradsOf = (state: StoreState): ApprGrad[] => (Array.isArray(state.apprGrads) ? state.apprGrads : []);

/** Имя следующего ученика: от зерна магазина, у каждого следующего — другое. */
export function nextApprName(state: StoreState): number {
  const h = (((state.seed ?? 1) * 2654435761) >>> 0) % APPR_NAMES;
  return (h + 5 * gradsOf(state).length) % APPR_NAMES;
}

/** Утром просится подросток: магазин подрос, персонал есть, ученика нет и на улице ещё есть место. */
export const apprOffer = (state: StoreState): boolean =>
  !state.appr &&
  !inZar(state) &&
  state.level >= APPR_FROM_LEVEL &&
  state.staff.length > 0 &&
  state.day >= APPR_FROM_DAY &&
  (state.apprAsk ?? 0) <= state.day &&
  gradsOf(state).length < APPR_MAX;

export function takeAppr(state: StoreState): StoreState {
  if (state.appr) return state;
  const appr: Apprentice = { name: nextApprName(state), since: state.day, post: 'till', trust: TRUST_START, skill: {} };
  const { apprAsk: _ask, ...rest } = state;
  return { ...rest, appr };
}

export const declineAppr = (state: StoreState): StoreState => ({ ...state, apprAsk: state.day + APPR_ASK_AGAIN });

/** Какой сегодня день учёбы (1…SEASON). */
export const apprDay = (state: StoreState): number => (state.appr ? Math.max(1, state.day - state.appr.since + 1) : 0);

export function setApprPost(state: StoreState, post: ApprPost): StoreState | null {
  const a = state.appr;
  if (!a || !APPR_POSTS.includes(post)) return null;
  return a.post === post ? state : { ...state, appr: { ...a, post } };
}

export function setApprPay(state: StoreState, pay: boolean): StoreState | null {
  const a = state.appr;
  if (!a) return null;
  const next: Apprentice = { ...a, unpaid: !pay || undefined };
  if (!next.unpaid) delete next.unpaid;
  return { ...state, appr: next };
}

/** Похвалить можно, если давно не хвалили. */
export const canPraise = (state: StoreState): boolean => {
  const a = state.appr;
  return Boolean(a) && (a!.praised === undefined || state.day - a!.praised >= PRAISE_EVERY);
};

export function praiseAppr(state: StoreState): StoreState | null {
  if (!canPraise(state)) return null;
  const a = state.appr!;
  return { ...state, appr: { ...a, trust: clamp(a.trust + TRUST_PRAISE), praised: state.day } };
}

/** Чем грозит сегодняшний выбор этой ночью (подсказка в карточке): null — всё хорошо. */
export type ApprWorry = 'unpaid' | 'tired' | 'bored' | 'idle';
export function apprWorry(state: StoreState): ApprWorry | null {
  const a = state.appr;
  if (!a) return null;
  if (a.post === 'rest') return (a.worked ?? 0) >= REST_EARNED ? null : 'idle';
  if (a.unpaid) return 'unpaid';
  if ((a.worked ?? 0) + 1 >= TIRED_FROM) return 'tired';
  if (a.last === a.post && (a.same ?? 0) + 1 >= BORED_FROM) return 'bored';
  return null;
}

/** Навык на месте (дней, не больше SKILL_CAP). */
export const skillOf = (a: Apprentice, s: ApprSkill): number => Math.min(SKILL_CAP, Math.max(0, a.skill[s] ?? 0));

/** Кем вырастет, если выпуск сегодня: чему учился больше всего (поровну — что раньше в списке). */
export function specOf(a: Apprentice): ApprSkill {
  return APPR_SKILLS.reduce((best, s) => ((a.skill[s] ?? 0) > (a.skill[best] ?? 0) ? s : best), APPR_SKILLS[0]);
}

/** Ученик сегодня работает на этом месте в нашем магазине (в Заречье он — в Центре): навык или null. */
function onPost(state: StoreState, post: ApprSkill): number | null {
  const a = state.appr;
  return a && a.post === post && !inZar(state) ? skillOf(a, post) : null;
}

/** Во сколько раз быстрее касса: ученик пакует покупки. */
export const apprScan = (state: StoreState): number => {
  const n = onPost(state, 'till');
  return n === null ? 1 : 1 + SCAN_BASE + SCAN_STEP * n;
};

/** Во сколько раз дольше ждут покупатели: ученик в зале подсказывает и развлекает. */
export const apprPatience = (state: StoreState): number => {
  const n = onPost(state, 'floor');
  return n === null ? 1 : 1 + PATIENCE_BASE + PATIENCE_STEP * n;
};

/** Шанс чаевых «за помощь» с каждого покупателя. */
export const apprTipChance = (state: StoreState): number => {
  const n = onPost(state, 'floor');
  return n === null ? 0 : TIP_BASE + TIP_STEP * n;
};

/** Скорость ученика на складе (доля скорости грузчика); 0 — сегодня не на складе. */
export const apprStockPace = (state: StoreState): number => {
  const n = onPost(state, 'stock');
  return n === null ? 0 : STOCK_PACE_BASE + STOCK_PACE_STEP * n;
};

/** Лавки выпускников: друзья с кассы и зала шлют гостей, конкуренты уводят. */
export function apprGuests(state: StoreState): number {
  let k = 1;
  for (const g of gradsOf(state)) k += g.friend ? (g.spec === 'stock' ? 0 : FRIEND_GUESTS) : -RIVAL_GUESTS;
  return k;
}

/** Скидка поставщиков от друзей со склада: берут товар вскладчину. */
export const apprSupplies = (state: StoreState): number =>
  gradsOf(state).reduce((sum, g) => sum + (g.friend && g.spec === 'stock' ? FRIEND_SUPPLIES : 0), 0);

/** Чаевые «за помощь» — в кассу и в копилку ученика (для карточки). */
export function apprTipped(state: StoreState, n: number): StoreState {
  if (!state.appr) return state;
  return { ...state, money: state.money + n, appr: { ...state.appr, tips: (state.appr.tips ?? 0) + n } };
}

/**
 * Ночь: стипендия, доверие, рост навыка и дела за день (deeds — сколько он сегодня сделал в зале, считает сцена).
 * Отучился сезон — выпуск: своя лавка, друг или конкурент.
 */
export function apprNight(state: StoreState, deeds = 0): StoreState {
  const a = state.appr;
  if (!a) return state;
  let money = state.money;
  const next: Apprentice = { ...a, skill: { ...a.skill } };
  let trust = a.trust;
  if (a.post === 'rest') {
    trust += (a.worked ?? 0) >= REST_EARNED ? TRUST_REST : -TRUST_IDLE;
    delete next.last;
    delete next.same;
    delete next.worked;
  } else {
    const post = a.post;
    next.skill[post] = (a.skill[post] ?? 0) + 1;
    if (deeds > 0) next.deeds = { ...a.deeds, [post]: (a.deeds?.[post] ?? 0) + Math.round(deeds) };
    next.same = a.last === post ? (a.same ?? 0) + 1 : 1;
    next.last = post;
    next.worked = (a.worked ?? 0) + 1;
    if (!a.unpaid && money >= STIPEND) {
      money -= STIPEND;
      next.paid = (a.paid ?? 0) + STIPEND;
      trust += TRUST_PAID;
    } else trust -= TRUST_UNPAID;
    if (next.same >= BORED_FROM) trust -= TRUST_BORED;
    if (next.worked >= TIRED_FROM) trust -= TRUST_TIRED;
  }
  next.trust = clamp(trust);
  const after = { ...state, money, appr: next };
  return state.day - a.since + 1 >= SEASON ? graduate(after) : after;
}

/** Выпуск: ученик уходит открывать свою лавку. */
export function graduate(state: StoreState): StoreState {
  const a = state.appr;
  if (!a) return state;
  const grad: ApprGrad = { name: a.name, spec: specOf(a), friend: a.trust >= FRIEND_FROM, day: state.day };
  const { appr: _a, ...rest } = state;
  return { ...rest, apprGrads: [...gradsOf(state), grad], apprAsk: state.day + APPR_NEXT };
}

/** Выпуск, о котором утром ещё не рассказали. */
export const apprNews = (state: StoreState): ApprGrad | null => gradsOf(state).find((g) => !g.seen) ?? null;

export const seeApprNews = (state: StoreState): StoreState => ({ ...state, apprGrads: gradsOf(state).map((g) => (g.seen ? g : { ...g, seen: true })) });

/** Раз в неделю выпускник напоминает о себе утренней строчкой: друг передаёт привет, конкурент ворчит. */
export const gradToday = (state: StoreState): ApprGrad | null =>
  gradsOf(state).find((g) => g.seen && state.day > g.day + 1 && (state.day - g.day) % 7 === 0) ?? null;
