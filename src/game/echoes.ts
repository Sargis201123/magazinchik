// «Эхо решений» (13.11, автор: «выборы в сценках возвращаются через недели»). Сценка дня (skits.ts) теперь
// помнит, каким финалом и какими ключевыми выборами кончилась (skitsOf(state).memo), и сажает «эхо»: через
// одну–четыре недели герой возвращается. Выманил щенка колбасой — хозяйка питомника приводит клуб собачников;
// отпустил парня в капюшоне — он сам просится грузчиком за полцены; нагрубил блогерше в эфире — разгромный ролик,
// гостей меньше. Хорошие финалы отзываются добром, плохие — обидой, чтобы выбор правда ощущался.
//
// Эхо приходит одной новостью утра (headlines.ts, вид 'echo') или лично — гостем с «!» у кассы
// (scenes/echoesFx.ts): тогда он занимает место особого гостя дня в бюджете внимания (attention.ts), и день
// не перегружен. Гость, который три дня так и не дошёл до зала (Заречье, сценка, кончился день), приходит
// новостью. Когда и какое — от зерна магазина и дня: перезапуск ничего не перекатывает.
//
// Общий вход для других историй — plantEcho(state, id, dueDay, data): серая схема, кризис района и прочее
// сажают свои эхо в тот же список (state.echoes), а эхо из ECHOES само знает, что принести.

import { hire, roleOpen, staffLimit, staffOf, wageFor, type StaffMember, type StoreState } from './economy';
import type { SkitId, SkitMood } from './skits';
import { rng } from './random';

export interface EchoEffect {
  money?: number;
  rating?: number;
  /** Гостей больше (или меньше, если доля отрицательная): доля и сколько дней, считая сегодня. */
  boost?: [number, number];
  /** Денис из «Меня ограбили!» встаёт грузчиком (ECHO_HIRE). */
  hire?: boolean;
}

export interface EchoChoice {
  effect: EchoEffect;
  /** Только когда место грузчика свободно (взять Дениса) — или только когда нет. */
  slot?: 'free' | 'none';
}

export interface EchoDef {
  icon: string;
  /**
   * Из какой сценки (заголовок «Эхо: …» и портрет) и кто говорит — ключ героя в её cast. Эхо других историй
   * (серая схема, кризис района) сценки не имеют: заголовок — echo.<id>.title, имя — echo.<id>.name,
   * портрет — portrait_<who>, а в зал такие приходят случайным прохожим.
   */
  skit?: SkitId;
  who: string;
  mood: SkitMood;
  /** Ответы: у большинства один — просто кнопка; текст — echo.<id>, ответы — echo.<id>.<i>. */
  choices: EchoChoice[];
  /** Приходит лично в зал гостем с «!» (иначе — новостью утра). */
  visit?: boolean;
  /** Что гость держит в руках (картинка art/echoes.py). */
  item?: string;
}

const once = (effect: EchoEffect): EchoChoice[] => [{ effect }];

const ECHO_DEFS = {
  // «Меня ограбили!»: вора прижали уликой или угадали — Галина Петровна заходит с пирожками.
  galina: { icon: '👜', skit: 'robbery', who: 'galina', mood: 'happy', visit: true, choices: once({ rating: 0.03, boost: [0.05, 3] }) },
  // Отпустили Дениса — он сам просится грузчиком за полцены; места нет — чинит крыльцо.
  denis: {
    icon: '🧢',
    skit: 'robbery',
    who: 'hoodie',
    mood: 'sad',
    choices: [{ effect: { hire: true }, slot: 'free' }, { effect: { rating: 0.01 }, slot: 'free' }, { effect: { rating: 0.03 }, slot: 'none' }],
  },
  // Указали не на того: курьер или маляр обиделся — и рассказал своим.
  wrongCourier: { icon: '🛵', skit: 'robbery', who: 'ruslan', mood: 'angry', choices: once({ boost: [-0.05, 4] }) },
  wrongPainter: { icon: '🖌', skit: 'robbery', who: 'painter', mood: 'angry', choices: once({ rating: -0.02, boost: [-0.04, 3] }) },
  // «Где Бублик?»: выманили колбасой — клуб собачников; нашли по голосу — Тёма заходит с подросшим Бубликом.
  dogClub: { icon: '🐕', skit: 'puppy', who: 'tyoma', mood: 'happy', choices: once({ boost: [0.1, 4] }) },
  bublik: { icon: '🐶', skit: 'puppy', who: 'tyoma', mood: 'happy', visit: true, choices: once({ rating: 0.02, boost: [0.04, 4] }) },
  tyomaCold: { icon: '🐾', skit: 'puppy', who: 'tyoma', mood: 'sad', choices: once({ rating: -0.02, boost: [-0.03, 4] }) },
  // «Крупная купюра»: взяли фальшивомонетчика — сержант с грамотой; отдали сдачу — часть вернули.
  sergeant: { icon: '🎖', skit: 'counterfeit', who: 'police', mood: 'happy', visit: true, item: 'echo_diploma', choices: once({ money: 200, rating: 0.04 }) },
  viktor: { icon: '💵', skit: 'counterfeit', who: 'police', mood: null, choices: once({ money: 150 }) },
  // «Пирожки Лёши»: успех — у Лёши своя пекарня и первая партия в подарок; провал — над чёрствыми пирожками шутят.
  bakery: { icon: '🥧', skit: 'pies', who: 'lyosha', mood: 'happy', visit: true, item: 'echo_pies', choices: once({ money: 250, boost: [0.05, 4] }) },
  stale: { icon: '🥟', skit: 'pies', who: 'lyosha', mood: 'sad', choices: once({ boost: [-0.03, 3] }) },
  // «Подарок учительнице»: угадали — класс идёт на экскурсию к нам; розы — родительский чат помнит.
  classTrip: { icon: '🎒', skit: 'gift', who: 'masha', mood: 'happy', visit: true, item: 'echo_card', choices: once({ rating: 0.03, boost: [0.06, 3] }) },
  roses: { icon: '🌹', skit: 'gift', who: 'masha', mood: 'sad', choices: once({ boost: [-0.03, 3] }) },
  // «Прямой эфир»: вирусный — Карина снимает продолжение; нагрубили в эфире — разгромный ролик.
  sequel: { icon: '🎥', skit: 'blogger', who: 'karina', mood: 'happy', visit: true, choices: once({ boost: [0.1, 4] }) },
  roast: { icon: '📉', skit: 'blogger', who: 'karina', mood: 'angry', choices: once({ rating: -0.03, boost: [-0.07, 4] }) },
  // «Курьер в ливень»: точка курьеров — смена обедает у нас; лекарства отнесли сами — шарф от бабушки;
  // опоздали — диспетчер шлёт курьеров в другие места; «сами разбирайтесь» — Руслана уволили.
  couriers: { icon: '🛵', skit: 'rain', who: 'ruslan', mood: 'happy', visit: true, choices: once({ money: 150, boost: [0.06, 5] }) },
  scarf: { icon: '🧣', skit: 'rain', who: 'ruslan', mood: 'happy', choices: once({ rating: 0.04 }) },
  dispatcher: { icon: '📞', skit: 'rain', who: 'boss', mood: null, choices: once({ boost: [-0.04, 4] }) },
  fired: { icon: '🌧', skit: 'rain', who: 'ruslan', mood: 'sad', choices: once({ rating: -0.02 }) },
} satisfies Record<string, EchoDef>;

export type EchoId = keyof typeof ECHO_DEFS;
export const ECHOES: Record<EchoId, EchoDef> = ECHO_DEFS;
export const ECHO_IDS = Object.keys(ECHOES) as EchoId[];
const def = (id: EchoId): EchoDef => ECHOES[id];

/**
 * Какое эхо у сценки: первое совпадение по финалу (узел) или ключевому выбору (skits.ts, keys). Порядок важен:
 * вирусный эфир важнее грубости в чате, точка курьеров — важнее лекарств. Обычные финалы эха не оставляют.
 */
export const SKIT_ECHO: Record<SkitId, [string, EchoId][]> = {
  robbery: [['right', 'galina'], ['rightGuess', 'galina'], ['forgive', 'denis'], ['courier', 'wrongCourier'], ['painter', 'wrongPainter']],
  puppy: [['foundShop', 'dogClub'], ['found', 'bublik'], ['cold', 'tyomaCold']],
  counterfeit: [['arrest', 'sergeant'], ['caught', 'sergeant'], ['lost', 'viktor']],
  pies: [['hit', 'bakery'], ['flop', 'stale']],
  gift: [['best', 'classTrip'], ['seedling', 'classTrip'], ['rosesEnd', 'roses']],
  blogger: [['viral', 'sequel'], ['rude', 'roast']],
  rain: [['deal', 'couriers'], ['meds', 'scarf'], ['late', 'dispatcher'], ['meh', 'fired']],
};

/** Через сколько дней возвращается эхо сценки: одна–четыре недели. */
export const ECHO_DELAY: [number, number] = [7, 28];
/** Гость-эхо ждёт своего дня в зале столько дней, потом приходит новостью утра. */
export const ECHO_VISIT_DAYS = 3;
/** Денис-грузчик: опыта мало, но старается (трудяга), а просит меньше обычного. */
export const ECHO_HIRE = { role: 'loader' as const, skill: 1, trait: 'hardworker' as const, wage: 0.6, name: 2, alias: 'skit.robbery.cast.hoodie' };

export interface EchoEntry {
  id: EchoId;
  /** С какого дня эхо может прийти. */
  due: number;
  /** Подстановки в текст ({name}, {n}…) — для эхо из других историй. */
  data?: Record<string, string | number>;
}

export interface EchoesState {
  /** Посаженные эхо: какое и с какого дня. */
  list: EchoEntry[];
  /** Прибавка или убыль гостей от эха: доля (может быть меньше нуля) и до какого дня включительно. */
  boost?: { pct: number; until: number };
  /** Сколько эхо уже вернулось. */
  heard?: number;
}

/** Состояние эха; эхо, которого в игре больше нет (сохранение из будущей версии), пропускаем. */
export const echoesOf = (state: StoreState): EchoesState => {
  const e = state.echoes;
  const list = (e?.list ?? []).filter((x) => x && x.id in ECHOES && Number.isFinite(x.due));
  return { ...e, list };
};

/** Посадить эхо: придёт не раньше dueDay. Общий вход для всех историй. */
export function plantEcho(state: StoreState, id: EchoId, dueDay: number, data?: Record<string, string | number>): StoreState {
  const e = echoesOf(state);
  const entry: EchoEntry = data ? { id, due: Math.round(dueDay), data } : { id, due: Math.round(dueDay) };
  return { ...state, echoes: { ...e, list: [...e.list, entry] } };
}

/** Через сколько дней (ECHO_DELAY) — от зерна магазина, дня и соли: тот же магазин в тот же день — то же число. */
export function echoDelay(state: StoreState, salt: number): number {
  const r = rng(((state.seed ?? 1) ^ Math.imul(state.day * 977 + salt * 131 + 17, 0x85ebca6b)) >>> 0)();
  return ECHO_DELAY[0] + Math.floor(r * (ECHO_DELAY[1] - ECHO_DELAY[0] + 1));
}

/** Эхо сценки по её финалу и ключевым выборам (или null — финал обычный). */
export function skitEcho(skit: SkitId, end: string, keys: readonly string[] = []): EchoId | null {
  return SKIT_ECHO[skit].find(([match]) => match === end || keys.includes(match))?.[1] ?? null;
}

/** Сценка кончилась: посадить её эхо (если финал его оставляет). */
export function plantSkitEcho(state: StoreState, skit: SkitId, end: string, keys: readonly string[] = []): { state: StoreState; echo: EchoId | null } {
  const echo = skitEcho(skit, end, keys);
  if (!echo) return { state, echo };
  return { state: plantEcho(state, echo, state.day + echoDelay(state, Object.keys(SKIT_ECHO).indexOf(skit) + 1)), echo };
}

/** Пришедшие эхо, кто дольше ждёт — первым. */
const dueNow = (state: StoreState): EchoEntry[] =>
  echoesOf(state)
    .list.filter((x) => x.due <= state.day)
    .sort((a, b) => a.due - b.due);

/** Кто сегодня может прийти лично (гость с «!» у кассы): только в свои первые ECHO_VISIT_DAYS дня. */
export function echoVisitToday(state: StoreState): EchoEntry | null {
  return dueNow(state).find((x) => def(x.id).visit && state.day < x.due + ECHO_VISIT_DAYS) ?? null;
}

/** Эхо для новости утра: обычное или гость, который так и не дошёл до зала. */
export function echoNews(state: StoreState): EchoEntry | null {
  return dueNow(state).find((x) => !def(x.id).visit || state.day >= x.due + ECHO_VISIT_DAYS) ?? null;
}

/** Есть ли свободное место грузчика для Дениса. */
export const canHireEcho = (state: StoreState): boolean =>
  roleOpen(state, ECHO_HIRE.role) && !staffOf(state, ECHO_HIRE.role) && state.staff.length < staffLimit(state);

/** Сколько просит Денис в месяц и сколько попросил бы обычный грузчик того же опыта. */
export const echoWage = (): { wage: number; full: number } => {
  const full = wageFor(ECHO_HIRE.role, ECHO_HIRE.skill, ECHO_HIRE.trait);
  return { wage: Math.round((full * ECHO_HIRE.wage) / 10) * 10, full };
};

/** Какие ответы сейчас можно дать (номер — как в ECHOES, по нему и текст ответа). */
export function echoChoices(state: StoreState, id: EchoId): { i: number; effect: EchoEffect }[] {
  const free = canHireEcho(state);
  return def(id)
    .choices.map((c, i) => ({ i, c }))
    .filter(({ c }) => !c.slot || (c.slot === 'free') === free)
    .map(({ i, c }) => ({ i, effect: c.effect }));
}

/** Эхо с убылью — для тона кнопки и реплики гостя. */
export const echoBad = (e: EchoEffect): boolean => (e.money ?? 0) < 0 || (e.rating ?? 0) < 0 || (e.boost?.[0] ?? 0) < 0;

function applyEcho(state: StoreState, e: EchoEffect): StoreState {
  let s = state;
  if (e.money) s = { ...s, money: Math.max(0, s.money + e.money) };
  if (e.rating) s = { ...s, rating: Math.round(Math.min(5, Math.max(0, s.rating + e.rating)) * 100) / 100 };
  if (e.boost) {
    const [pct, days] = e.boost;
    const ech = echoesOf(s);
    // Новое эхо сильнее прежнего (по модулю) или прежнее уже кончилось — берём новое.
    const still = ech.boost && ech.boost.until >= s.day ? ech.boost : undefined;
    const boost = still && Math.abs(still.pct) > Math.abs(pct) ? still : { pct, until: s.day + days - 1 };
    s = { ...s, echoes: { ...ech, boost } };
  }
  if (e.hire && canHireEcho(s)) {
    const { wage } = echoWage();
    const member: StaffMember = { role: ECHO_HIRE.role, name: ECHO_HIRE.name, skill: ECHO_HIRE.skill, trait: ECHO_HIRE.trait, wage, months: 0, alias: ECHO_HIRE.alias };
    s = hire(s, member) ?? s;
  }
  return s;
}

/**
 * Эхо вернулось: ответ (номер из echoChoices) применяется, эхо уходит из списка. null — такого эхо сейчас
 * нет или ответ недоступен.
 */
export function answerEcho(state: StoreState, id: EchoId, choice = 0): StoreState | null {
  const e = echoesOf(state);
  const at = e.list.findIndex((x) => x.id === id && x.due <= state.day);
  const pick = echoChoices(state, id).find((c) => c.i === choice);
  if (at < 0 || !pick) return null;
  const list = e.list.filter((_, i) => i !== at);
  const s = applyEcho({ ...state, echoes: { ...e, list, heard: (e.heard ?? 0) + 1 } }, pick.effect);
  return s;
}

/** Множитель гостей от эха (клуб собачников, ролик Карины — или разгромный ролик). */
export const echoGuests = (state: StoreState): number => {
  const boost = state.echoes?.boost;
  return boost && state.day <= boost.until ? Math.max(0.5, 1 + boost.pct) : 1;
};
