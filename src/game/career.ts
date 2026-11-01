// Карьера сотрудников: из строки расходов — в историю. Каждый сотрудник копит опыт (рабочие смены),
// у каждого своя короткая летопись: когда нанят, сколько раз был «сотрудником месяца», когда повышен.
//
// «Сотрудник месяца» — раз в четыре игровые недели: лучший по делу за этот срок (вышел на смены, пробил,
// убрал, разложил; прогулы — минус). Утром — маленькая церемония: портрет, итоги и награда на выбор —
// премия, выходной или подарок. Имя попадает на доску почёта на стене зала (последние несколько).
//
// Повышения: опыт растёт с каждой сменой, на пороге игрок может повысить — кассир → старший кассир
// (чуть быстрее и понемногу учит остальных) → администратор зала (ещё быстрее, весь зал чуть собраннее).
// Остальные должности дорастают до «старшего». Любой опытный может возглавить филиал (branch.ts): уходит
// из зала, а филиал под человеком, который знает магазин, приносит чуть больше. Повышение — с умеренной
// прибавкой; отказаться можно, без обид — через пару недель спросит снова.
//
// Давние сотрудники иногда уходят по своим причинам (своё дело, учёба, переезд) — без штрафов, с
// прощальным письмом (returns.ts). Всё необязательно: не больше одного предложения в день, и только
// если с утра нет другой истории с персоналом (staffEvents.ts). Случай — свой, по дню и зерну игры:
// общий генератор симулятора не сдвигается.

import { isAbsent, MONTH_DAYS, type StaffMember, type StaffRole, type StoreState } from './economy';
import { isCashierRole } from './registers';
import { rng } from './random';

export type Rank = 'senior' | 'admin';

export type CareerNoteKind = 'hired' | 'best' | 'senior' | 'admin' | 'branch';

export interface CareerNote {
  day: number;
  kind: CareerNoteKind;
}

export interface Career {
  /** В какой день нанят (у старых сохранений — оценка по стажу). */
  hired: number;
  /** Опыт — отработанные смены (наставник рядом добавляет понемногу). */
  xp: number;
  rank?: Rank;
  /** Сколько раз был «сотрудником месяца». */
  best?: number;
  /** Текущий срок «сотрудника месяца»: смены, очки за дело, неявки. */
  shifts?: number;
  work?: number;
  miss?: number;
  /** Отказался от повышения (или не ответили): снова спросим не раньше этого дня. */
  askAfter?: number;
  /** Короткая летопись (последние CAREER_LOG записей). */
  log?: CareerNote[];
}

/** Строчка на доске почёта. */
export interface Plaque {
  name: number;
  friend?: string;
  role: StaffRole;
  day: number;
}

/** Церемония «сотрудник месяца», ждущая выбора награды. */
export interface Ceremony {
  role: StaffRole;
  /** Кто именно (на ту же должность могли нанять другого). */
  name: number;
  day: number;
  shifts: number;
  work: number;
  miss: number;
}

export interface PromoOffer {
  role: StaffRole;
  name: number;
  to: Rank | 'branch';
  day: number;
}

/** Управляющий филиалом — свой человек из зала. */
export interface BranchHead {
  name: number;
  friend?: { id: number; name: string };
  role: StaffRole;
  skill: number;
  since: number;
  xp: number;
  best?: number;
}

/** Ушёл по своим причинам: утренняя записка и прощальное письмо. */
export interface Farewell {
  name: number;
  friend?: string;
  role: StaffRole;
  /** Сколько смен отработал и сколько раз был лучшим. */
  days: number;
  best: number;
  day: number;
  /** Почему уходит (career.leave.<why>). */
  why: number;
}

export interface CareerState {
  /** С какого дня считается текущий срок «сотрудника месяца». */
  since?: number;
  plaques?: Plaque[];
  ceremony?: Ceremony;
  offer?: PromoOffer;
  /** Отказались поставить человека на филиал — снова спросим не раньше. */
  branchAfter?: number;
  head?: BranchHead;
  /** Утренняя записка «ушёл по своим делам» — до «Понятно». */
  left?: Farewell;
  /** Прощальное письмо ждёт отправки (returns.ts planLetter). */
  letter?: Farewell;
  /** Последний день, когда было предложение, церемония или уход: не чаще раза в день. */
  asked?: number;
}

/** «Сотрудник месяца» — раз в столько дней (четыре игровые недели). */
export const BEST_EVERY = 4 * MONTH_DAYS;
/** Кто отработал меньше стольких смен за срок, на церемонию не попадает. */
export const BEST_MIN_SHIFTS = 7;
/** Сколько имён висит на доске почёта. */
export const PLAQUES = 3;
/** Сколько записей в летописи сотрудника. */
export const CAREER_LOG = 8;

/** Опыт (смены) для повышения: старший, администратор зала (из старших кассиров), управляющий филиалом. */
export const XP_SENIOR = 30;
export const XP_ADMIN = 75;
export const XP_BRANCH = 45;
/** Прибавка при повышении (к нынешней зарплате). */
export const PROMO_RAISE = 0.1;
/** Отказались — спросит снова через столько дней (не ответили утром — через неделю). */
export const ASK_AGAIN = 14;
export const NO_ANSWER_AGAIN = 7;
/** Наставник на смене: остальным за смену столько опыта сверху (старший, администратор). */
export const MENTOR_XP: Record<Rank, number> = { senior: 0.25, admin: 0.5 };

/** Давние сотрудники (столько смен) иногда уходят по своим делам: шанс в день, один на всех. */
export const LEAVE_XP = 120;
export const LEAVE_CHANCE = 0.006;
/** Лучший сотрудник недавно (столько дней) — не уходит: его ценят. */
export const LOYAL_DAYS = 2 * BEST_EVERY;
/** Сколько вариантов причины ухода (career.leave.<n>, letter.staff.<n>). */
export const LEAVE_REASONS = 4;

/** Награды «сотрудника месяца»: премия, выходной, подарок. */
export type BestReward = 'cash' | 'off' | 'gift';
export const BEST_REWARDS: BestReward[] = ['cash', 'off', 'gift'];
/** Премия: столько + столько за каждое помещение; подарок — вдвое дешевле. */
export const bestBonus = (state: StoreState): number => 150 + 50 * state.level;
export const bestGift = (state: StoreState): number => Math.round(bestBonus(state) / 20) * 10;
export const rewardCost = (state: StoreState, reward: BestReward): number => (reward === 'cash' ? bestBonus(state) : reward === 'gift' ? bestGift(state) : 0);
/** Сколько дней воодушевлён после награды. */
const REWARD_INSPIRED: Record<BestReward, number> = { cash: 5, off: 4, gift: 3 };

/** За что очки в срок «сотрудника месяца»: смена, дело дня (сколько за штуку, не больше DAY_WORK_CAP), неявка. */
export const SHIFT_POINTS = 10;
export const MISS_POINTS = 15;
export const DAY_WORK_CAP = 20;
const WORK_WEIGHT: Record<StaffRole, number> = {
  cashier: 0.25,
  cashier2: 0.25,
  cashier3: 0.25,
  cashier4: 0.25,
  cashier5: 0.25,
  cleaner: 2,
  loader: 3,
  guard: 6,
  manager: 2,
  baker: 1,
  barista: 0.5,
  cook: 1,
};
/** Охранник и менеджер полдня просто на посту — за это тоже очки. */
const POST_POINTS: Partial<Record<StaffRole, number>> = { guard: 10, manager: 8 };

const round2 = (n: number): number => Math.round(n * 100) / 100;

// ---------- Опыт и звания ----------

/** Летопись сотрудника; у старого сохранения без неё — оценка по стажу (месяцы зарплаты). */
export function careerOf(m: StaffMember, day: number): Career {
  if (m.career) return m.career;
  const worked = m.months * MONTH_DAYS;
  return { hired: Math.max(1, day - worked), xp: Math.round(worked * 0.85) };
}

/** Следующее звание: старший для всех, администратор зала — только из старших кассиров. */
export function nextRank(m: StaffMember): Rank | null {
  const rank = m.career?.rank;
  if (!rank) return 'senior';
  if (rank === 'senior' && isCashierRole(m.role)) return 'admin';
  return null;
}

export const rankXp = (rank: Rank): number => (rank === 'senior' ? XP_SENIOR : XP_ADMIN);

/** Опыт до следующего звания (null — расти некуда). */
export function xpToNext(m: StaffMember, day: number): number | null {
  const next = nextRank(m);
  return next ? Math.max(0, Math.ceil(rankXp(next) - careerOf(m, day).xp)) : null;
}

/** Ключ названия звания: у кассиров — «старший кассир», у остальных — «старший сотрудник». */
export const rankKey = (m: Pick<StaffMember, 'role'>, rank: Rank): 'career.rank.seniorCashier' | 'career.rank.senior' | 'career.rank.admin' =>
  rank === 'admin' ? 'career.rank.admin' : isCashierRole(m.role) ? 'career.rank.seniorCashier' : 'career.rank.senior';

/** Новый сотрудник: летопись с дня найма (economy.hire). */
export const freshCareer = (day: number): Career => ({ hired: day, xp: 0, log: [{ day, kind: 'hired' }] });

const note = (c: Career, day: number, kind: CareerNoteKind): CareerNote[] => [...(c.log ?? []), { day, kind }].slice(-CAREER_LOG);

/** Старые сохранения: летопись по оценке стажа, срок «сотрудника месяца» — с сегодняшнего дня. */
export function migrateCareer(state: StoreState): StoreState {
  if (!state.staff.some((m) => !m.career)) return state;
  return {
    ...state,
    staff: state.staff.map((m) => (m.career ? m : { ...m, career: careerOf(m, state.day) })),
    career: { ...state.career, since: state.career?.since ?? state.day },
  };
}

// ---------- Вечер: смены, дело, неявки ----------

/** Очки за дело одного дня: столько-то за штуку, не больше DAY_WORK_CAP; у охраны и менеджера — ещё пост. */
export const dayWorkPoints = (role: StaffRole, done = 0): number => Math.min(DAY_WORK_CAP, done * WORK_WEIGHT[role] + (POST_POINTS[role] ?? 0));

/**
 * Вечер (до restStaff, пока сегодняшние выходные видны): кто вышел — смена и опыт (с наставником рядом —
 * чуть больше), кто заболел — неявка. work — сделанное за день по должностям (сцена; в симуляторе нет).
 */
export function careerNight(state: StoreState, work: Partial<Record<StaffRole, number>> = {}): StoreState {
  if (!state.staff.length) return state.career?.since === undefined ? { ...state, career: { ...state.career, since: state.day } } : state;
  const mentors = state.staff.filter((m) => m.career?.rank && !isAbsent(state, m));
  const staff = state.staff.map((m) => {
    const c = careerOf(m, state.day);
    if (state.plan?.sick === m.role) return { ...m, career: { ...c, miss: (c.miss ?? 0) + 1 } };
    if (isAbsent(state, m)) return { ...m, career: c };
    const mentor = Math.max(0, ...mentors.filter((x) => x !== m).map((x) => MENTOR_XP[x.career!.rank!]));
    return {
      ...m,
      career: { ...c, xp: round2(c.xp + 1 + mentor), shifts: (c.shifts ?? 0) + 1, work: round2((c.work ?? 0) + dayWorkPoints(m.role, work[m.role])) },
    };
  });
  return { ...state, staff, career: { ...state.career, since: state.career?.since ?? state.day } };
}

// ---------- Утро: церемония, уход, повышение ----------

/** Очки за срок: смены, дело, неявки; обиженному — минус, мастерство — немного сверху. */
export function bestScore(m: StaffMember): number {
  const c = m.career;
  if (!c) return 0;
  return (c.shifts ?? 0) * SHIFT_POINTS + (c.work ?? 0) - (c.miss ?? 0) * MISS_POINTS - (m.upset ? 20 : 0) + m.skill * 2;
}

/** Лучший за срок (null — никто не отработал BEST_MIN_SHIFTS смен). */
export function bestOfPeriod(state: StoreState): StaffMember | null {
  const fit = state.staff.filter((m) => (m.career?.shifts ?? 0) >= BEST_MIN_SHIFTS);
  return fit.reduce<StaffMember | null>((best, m) => (!best || bestScore(m) > bestScore(best) ? m : best), null);
}

/** Новый срок: счётчики смен и дела у всех — с нуля. */
const resetPeriod = (staff: StaffMember[]): StaffMember[] =>
  staff.map((m) => (m.career ? { ...m, career: { ...m.career, shifts: 0, work: 0, miss: 0 } } : m));

/** Тот самый человек: должность и имя (уволился, ушёл, переманили — на его место мог прийти другой). */
export const holderOf = (state: StoreState, who: { role: StaffRole; name: number } | undefined): StaffMember | undefined =>
  who && state.staff.find((m) => m.role === who.role && m.name === who.name);

const plaqueOf = (m: StaffMember, day: number): Plaque => ({ name: m.name, ...(m.friend ? { friend: m.friend.name } : {}), role: m.role, day });

/** Кто может уйти по своим делам: давний, не друг, не на лето, не лучший недавно. */
const mayLeave = (state: StoreState, m: StaffMember): boolean =>
  !m.friend && !m.summer && careerOf(m, state.day).xp >= LEAVE_XP && !(careerOf(m, state.day).log ?? []).some((n) => n.kind === 'best' && state.day - n.day < LOYAL_DAYS);

/** Кого и куда можно повысить сегодня (null — некого). Сначала звания, потом филиал. */
export function promotionFor(state: StoreState): PromoOffer | null {
  const ready = state.staff
    .filter((m) => (m.career?.askAfter ?? 0) <= state.day)
    .sort((a, b) => careerOf(b, state.day).xp - careerOf(a, state.day).xp);
  for (const m of ready) {
    const next = nextRank(m);
    if (next && careerOf(m, state.day).xp >= rankXp(next)) return { role: m.role, name: m.name, to: next, day: state.day };
  }
  if (state.branch && !state.career?.head && (state.career?.branchAfter ?? 0) <= state.day) {
    const m = ready.find((x) => !x.summer && careerOf(x, state.day).xp >= XP_BRANCH);
    if (m) return { role: m.role, name: m.name, to: 'branch', day: state.day };
  }
  return null;
}

/**
 * Утро (после ночи, день уже новый): не ответили вчера на повышение — снимаем (спросим через неделю).
 * Дальше не больше одного события: церемония (раз в BEST_EVERY дней), уход давнего сотрудника (редко)
 * или предложение повысить. С утра уже есть история с персоналом — сегодня без карьеры.
 */
export function careerMorning(state: StoreState): StoreState {
  let s = state;
  const career: CareerState = { ...s.career };
  if (career.offer && career.offer.day < s.day) {
    const { role, name, to } = career.offer;
    delete career.offer;
    if (to === 'branch') career.branchAfter = s.day + NO_ANSWER_AGAIN;
    else s = { ...s, staff: s.staff.map((m) => (m.role === role && m.name === name && m.career ? { ...m, career: { ...m.career, askAfter: s.day + NO_ANSWER_AGAIN } } : m)) };
  }
  // Наградить так и не собрались — через неделю церемония тихо закрывается (имя на доске остаётся).
  // Наградить так и не собрались, или награждённый ушёл (уволился, переманили) — церемония закрывается.
  if (career.ceremony && (s.day - career.ceremony.day >= MONTH_DAYS || !holderOf(s, career.ceremony))) delete career.ceremony;
  s = { ...s, career };
  // Не больше одной карьерной карточки на утро и не рядом с историей персонала (staffEvents.ts).
  if (!s.staff.length || career.asked === s.day || s.staffEvent || s.bankrupt) return s;
  const random = rng(s.day * 48611 + (s.seed ?? 0) * 7 + 3);
  const since = career.since ?? s.day;
  // Церемония: срок вышел — лучший на доску почёта; некого (все новенькие) — срок начинается заново.
  if (s.day - since >= BEST_EVERY && !career.ceremony) {
    const best = bestOfPeriod(s);
    if (!best) return { ...s, career: { ...career, since: s.day } };
    const c = careerOf(best, s.day);
    const ceremony: Ceremony = { role: best.role, name: best.name, day: s.day, shifts: c.shifts ?? 0, work: Math.round(c.work ?? 0), miss: c.miss ?? 0 };
    const crowned = { ...best, career: { ...c, best: (c.best ?? 0) + 1, log: note(c, s.day, 'best') } };
    return {
      ...s,
      staff: resetPeriod(s.staff.map((m) => (m === best ? crowned : m))),
      career: { ...career, since: s.day, ceremony, asked: s.day, plaques: [...(career.plaques ?? []), plaqueOf(best, s.day)].slice(-PLAQUES) },
    };
  }
  if (career.ceremony || career.left) return s;
  // Давний сотрудник уходит по своим делам: редко, без штрафа, с запиской и письмом.
  const leaving = s.staff.filter((m) => mayLeave(s, m));
  if (leaving.length && random() < LEAVE_CHANCE) {
    const m = leaving[Math.floor(random() * leaving.length)];
    const c = careerOf(m, s.day);
    const farewell: Farewell = { name: m.name, role: m.role, days: Math.round(c.xp), best: c.best ?? 0, day: s.day, why: 1 + Math.floor(random() * LEAVE_REASONS) };
    return { ...s, staff: s.staff.filter((x) => x !== m), career: { ...career, left: farewell, letter: farewell, asked: s.day } };
  }
  if (career.offer) return s;
  const offer = promotionFor(s);
  return offer ? { ...s, career: { ...career, offer, asked: s.day } } : s;
}

// ---------- Ответы игрока ----------

const withMember = (state: StoreState, role: StaffRole, f: (m: StaffMember) => StaffMember): StoreState => ({
  ...state,
  staff: state.staff.map((m) => (m.role === role ? f(m) : m)),
});

/** Награда «сотруднику месяца». null — не хватает денег. Ушёл, пока ждали, — церемония просто закрывается. */
export function answerCeremony(state: StoreState, reward: BestReward): StoreState | null {
  const ceremony = state.career?.ceremony;
  if (!ceremony) return null;
  const career: CareerState = { ...state.career };
  delete career.ceremony;
  const m = holderOf(state, ceremony);
  if (!m) return { ...state, career };
  // Выходной на завтра нельзя, если он отдыхает сегодня: сегодняшний отгул пропал бы.
  if (reward === 'off' && m.offDay === state.day) return null;
  const cost = rewardCost(state, reward);
  if (state.money < cost) return null;
  const days = REWARD_INSPIRED[reward];
  return withMember({ ...state, money: state.money - cost, career }, m.role, (x) => ({
    ...x,
    upset: false,
    inspired: Math.max(x.inspired ?? 0, days),
    // Выходной — на завтра (если завтра он и так не отдыхает), усталость уходит.
    ...(reward === 'off' ? { offDay: state.day + 1, streak: 0 } : {}),
  }));
}

/** Сколько будет получать после повышения: +PROMO_RAISE к нынешней, кругло до десятков. */
export const promotedWage = (m: StaffMember): number => Math.round((m.wage * (1 + PROMO_RAISE)) / 10) * 10;

/**
 * Ответ на повышение. Согласие: звание и прибавка; филиал — человек уходит из зала управлять филиалом.
 * Отказ — без обид, спросит через ASK_AGAIN дней.
 */
export function answerOffer(state: StoreState, yes: boolean): StoreState {
  const offer = state.career?.offer;
  if (!offer) return state;
  const career: CareerState = { ...state.career };
  delete career.offer;
  const m = holderOf(state, offer);
  if (!m) return { ...state, career };
  const c = careerOf(m, state.day);
  if (!yes) {
    if (offer.to === 'branch') return { ...state, career: { ...career, branchAfter: state.day + ASK_AGAIN } };
    return withMember({ ...state, career }, m.role, (x) => ({ ...x, career: { ...c, askAfter: state.day + ASK_AGAIN } }));
  }
  if (offer.to === 'branch') {
    if (!state.branch || career.head) return { ...state, career };
    const head: BranchHead = { name: m.name, ...(m.friend ? { friend: m.friend } : {}), role: m.role, skill: m.skill, since: state.day, xp: Math.round(c.xp), best: c.best };
    return { ...state, staff: state.staff.filter((x) => x !== m), career: { ...career, head } };
  }
  const to = offer.to;
  return withMember({ ...state, career }, m.role, (x) => ({
    ...x,
    wage: promotedWage(x),
    raiseAsk: undefined,
    upset: false,
    career: { ...c, rank: to, askAfter: undefined, log: note(c, state.day, to) },
  }));
}

/** Утренняя записка об уходе прочитана. */
export function dismissLeft(state: StoreState): StoreState {
  if (!state.career?.left) return state;
  const career: CareerState = { ...state.career };
  delete career.left;
  return { ...state, career };
}

/** Прощальное письмо забрали в почту (returns.ts planLetter). */
export function takeFarewellLetter(state: StoreState): { state: StoreState; farewell: Farewell } | null {
  const farewell = state.career?.letter;
  if (!farewell) return null;
  const career: CareerState = { ...state.career };
  delete career.letter;
  return { state: { ...state, career }, farewell };
}

