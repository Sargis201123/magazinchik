// «Дело недели» (13.11, автор: «очень понравилась детективная сценка „ограбление“ — продолжай этот стиль»).
// Раз в неделю в районе загадка: пропала собака аптекарши, кто-то бьёт витрины, у Эдуарда украли выручку,
// с соседнего склада исчезли ящики. Дело открывается в понедельник, улики приходят САМИ в обычные дни: с
// понедельника по четверг по одной — покупатель обронил чек, камера что-то сняла, Бобик принёс находку,
// постоянный проговорился у кассы. В зале это короткий момент со значком (scenes/caseFx.ts): нажал — улика
// чёткая, её можно показать подозреваемому на допросе; не нажал — она всё равно придёт утром, но размытая.
// Утром «доска дела» (ui/cases.ts): приколотые улики, трое подозреваемых, допрос как в сценках (заданные
// вопросы серые с галочкой). В пятницу — обвинить одного: угадал — деньги, рейтинг и «слава района» (гостей
// больше на несколько дней), признание по улике — лучший итог; ошибся — обида невиновного и минус к рейтингу;
// не обвинил — в субботу дело уходит в архив без награды.
//
// Всё — от дня и зерна магазина (как сценки): перезапуск дня ничего не перекатывает, симулятор не сдвигается.
// Другие системы могут открыть дело сами (openCase: «Крыша» — о рэкете) и приколоть свою улику (pinClue:
// ломбард — «краденая вещь»).

import type { TextKey } from '../i18n/ru';
import type { StoreState } from './economy';
import { quietDays } from './firstday';
import { tutStep } from './tutorial';
import { rng } from './random';

export type CaseId = 'dog' | 'windows' | 'till' | 'crates';
/** Откуда улика: обронённый чек, запись камеры, находка (Бобик принёс или у порога), разговор у кассы. */
export type ClueSrc = 'receipt' | 'camera' | 'find' | 'talk';
/** Кто открыл дело: неделя сама или другая система (ломбард, «Крыша» — позже). */
export type CaseOrigin = 'week' | 'pawn' | 'racket';
export type CaseTone = 'great' | 'good' | 'wrong' | 'archived';

export interface CaseDef {
  /** Кто пострадал: портрет без portrait_ и настроения. Имя — case.<id>.victim, рассказ — case.<id>.intro. */
  victim: string;
  /** Подозреваемые: ключ → портрет. Имя — case.<id>.s.<ключ>, ответы — .hi, .where, .seen. */
  suspects: Record<string, string>;
  culprit: string;
  /**
   * Улики по дням: откуда и о ком. Текст — case.<id>.c<n> (чёткая) и case.<id>.c<n>.weak (размытая). Чёткую улику
   * «о ком-то» можно показать ему на допросе (ответ — case.<id>.c<n>.ans): невиновный объяснится, виновный признается.
   * Улика без about — общая: её не покажешь, но она ловит кого-то на вранье.
   */
  clues: { src: ClueSrc; about?: string }[];
}

export const CASES: Record<CaseId, CaseDef> = {
  // Пудель Жужа пропал с крыльца аптеки. Виктор украл её, чтобы «найти» за награду: перчатка в белой шерсти.
  dog: {
    victim: 'case_rosa',
    suspects: { ruslan: 'skit_ruslan', fyodor: 'skit_fyodor', viktor: 'skit_viktor' },
    culprit: 'viktor',
    clues: [{ src: 'camera', about: 'ruslan' }, { src: 'talk', about: 'fyodor' }, { src: 'receipt' }, { src: 'find', about: 'viktor' }],
  },
  // Кто-то по ночам бьёт витрины. Маляр Стёпа — «мастер на все руки»: купил стекло ещё до первой разбитой.
  windows: {
    victim: 'police',
    suspects: { hoodie: 'skit_hoodie', lyosha: 'skit_lyosha', painter: 'skit_painter' },
    culprit: 'painter',
    clues: [{ src: 'camera', about: 'hoodie' }, { src: 'receipt', about: 'painter' }, { src: 'talk', about: 'lyosha' }, { src: 'find' }],
  },
  // У Эдуарда из сейфа пропала выручка: охранник Гоша проигрался в карты и сам вызвался закрывать.
  till: {
    victim: 'eduard',
    suspects: { karina: 'skit_karina', zina: 'case_zina', gosha: 'case_gosha' },
    culprit: 'gosha',
    clues: [{ src: 'camera', about: 'karina' }, { src: 'find', about: 'zina' }, { src: 'talk', about: 'gosha' }, { src: 'receipt' }],
  },
  // С соседнего склада пропали шесть ящиков яблок: грузчик Валера продал их на рынке в семь утра.
  crates: {
    victim: 'case_semyon',
    suspects: { ruslan: 'skit_ruslan', farmer: 'farmer', valera: 'case_valera' },
    culprit: 'valera',
    clues: [{ src: 'talk', about: 'ruslan' }, { src: 'camera', about: 'valera' }, { src: 'find', about: 'farmer' }, { src: 'receipt' }],
  },
};

export const CASE_IDS = Object.keys(CASES) as CaseId[];

/**
 * С какого дня дела. Сценки (SKIT_FROM) открыты уже с 6-го, но 8–11-й дни и так каждый приносят новое
 * (мини-события, кот, особые гости, кафе) — первое дело ждёт третьего понедельника.
 */
export const CASE_FROM = 15;
/** День недели по игровому календарю (неделя — игровой месяц, 7 дней): 1 — понедельник, 5 — пятница. */
export const weekDay = (day: number): number => ((day - 1) % 7) + 1;
export const FRIDAY = 5;
/** Сколько самое малое дней от открытия до пятницы-обвинения (чтобы улики успели прийти). */
export const CASE_MIN_DAYS = 4;
/** Что даёт раскрытое дело: деньги растут с магазином; признание по улике — вдвое больше. */
export const caseMoney = (level: number): number => 250 + 150 * level;
export const CASE_RATING = { great: 0.1, good: 0.05, wrong: -0.05 } as const;
/** «Слава района»: гостей больше — на сколько и сколько дней. */
export const CASE_FAME: Record<'great' | 'good', [number, number]> = { great: [0.1, 4], good: [0.06, 3] };

/** Улика из другой системы: текст (ключ словаря), значок и к какому делу (нет — к идущему). */
export interface ExtraClue {
  key: TextKey;
  icon: string;
  case?: CaseId;
  day: number;
}

export interface OpenCase {
  id: CaseId;
  origin: CaseOrigin;
  /** День открытия и день обвинения (пятница). */
  from: number;
  due: number;
  /** Улики по порядку: 0 — ещё нет, 1 — пришла утром (размытая), 2 — найдена в зале (чёткая). */
  got: number[];
  /** Заданные вопросы: «подозреваемый:where|seen|c<n>». */
  asked?: string[];
  /** Сколько улик уже видели на доске (значок «новая улика» в утре). */
  seen?: number;
  /** Виновного прижали уликой — он признался. */
  confessed?: boolean;
}

export interface CaseRecord {
  id: CaseId;
  tone: CaseTone;
  day: number;
  /** Кого обвинили (и обидели, если ошиблись). */
  who?: string;
}

export interface CasesState {
  open?: OpenCase;
  /** Закрытые дела по порядку. */
  done?: CaseRecord[];
  /** «Слава района» после раскрытого дела. */
  fame?: { pct: number; until: number };
  /** Улики из других систем (ломбард и др.). */
  extra?: ExtraClue[];
}

export const casesOf = (state: StoreState): CasesState => state.cases ?? {};
export const openCaseOf = (state: StoreState): OpenCase | null => state.cases?.open ?? null;

const withCases = (state: StoreState, next: CasesState): StoreState => ({ ...state, cases: next });

/** Порядок дел этого магазина: от зерна (Фишер — Йетс на своём генераторе). */
export function caseOrder(seed: number): CaseId[] {
  const random = rng(((seed ?? 1) ^ 0x5eedca5e) >>> 0);
  const out = [...CASE_IDS];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const solved = (s: CasesState, id: CaseId): boolean => (s.done ?? []).some((r) => r.id === id && (r.tone === 'great' || r.tone === 'good'));

/**
 * Следующее дело недели: по порядку магазина, раскрытые — не повторяются. Нераскрытые (ошибка, архив)
 * через круг поднимают из архива — сначала те, за которые брались реже. Все раскрыты — дел недели больше нет.
 */
export function nextWeekly(state: StoreState): CaseId | null {
  const s = casesOf(state);
  const tries = (id: CaseId) => (s.done ?? []).filter((r) => r.id === id).length;
  const left = caseOrder(state.seed ?? 1).filter((id) => !solved(s, id));
  return left.sort((a, b) => tries(a) - tries(b))[0] ?? null;
}

/** Ближайшая пятница, до которой не меньше CASE_MIN_DAYS. */
export const dueFrom = (day: number): number => {
  let d = day + CASE_MIN_DAYS;
  while (weekDay(d) !== FRIDAY) d++;
  return d;
};

/**
 * Открыть дело (API для других систем: «Крыша», ломбард). null — уже идёт другое или такое дело уже раскрыто.
 * Улики придут по дням до пятницы-обвинения.
 */
export function openCase(state: StoreState, id: CaseId, origin: CaseOrigin): StoreState | null {
  const s = casesOf(state);
  if (s.open || solved(s, id)) return null;
  const open: OpenCase = { id, origin, from: state.day, due: dueFrom(state.day), got: CASES[id].clues.map(() => 0) };
  return withCases(state, { ...s, open });
}

/** Приколоть улику из другой системы (дубли по тексту не множатся). Дело ещё не открыто — она подождёт его. */
export function pinClue(state: StoreState, clue: Omit<ExtraClue, 'day'>): StoreState {
  const s = casesOf(state);
  if ((s.extra ?? []).some((c) => c.key === clue.key && c.case === clue.case)) return state;
  return withCases(state, { ...s, extra: [...(s.extra ?? []), { ...clue, day: state.day }] });
}

/** Улики других систем на доске идущего дела. */
export const extraClues = (state: StoreState): ExtraClue[] => {
  const open = openCaseOf(state);
  return open ? (casesOf(state).extra ?? []).filter((c) => !c.case || c.case === open.id) : [];
};

/** В какой день приходит улика n: от открытия до пятницы поровну (неделя — с понедельника по четверг). */
export const clueDay = (open: OpenCase, n: number): number => open.from + Math.floor((n * (open.due - open.from)) / open.got.length);

/** Какая улика сегодня ждёт в зале (номер) — или null. */
export function clueToday(state: StoreState): number | null {
  const open = openCaseOf(state);
  if (!open || state.day >= open.due) return null;
  const n = open.got.findIndex((g, i) => !g && clueDay(open, i) === state.day);
  return n < 0 ? null : n;
}

/** Нажали значок в зале: улика чёткая. */
export function takeClue(state: StoreState, n: number): StoreState {
  const open = openCaseOf(state);
  if (!open || open.got[n] === undefined || open.got[n] === 2 || clueDay(open, n) > state.day) return state;
  const got = open.got.map((g, i) => (i === n ? 2 : g));
  return withCases(state, { ...casesOf(state), open: { ...open, got } });
}

const archive = (s: CasesState, rec: CaseRecord): CasesState => {
  const id = s.open?.id;
  const extra = (s.extra ?? []).filter((c) => c.case && c.case !== id);
  const next: CasesState = { ...s, done: [...(s.done ?? []), rec], extra: extra.length ? extra : undefined };
  delete next.open;
  if (!next.extra) delete next.extra;
  return next;
};

/** Можно ли сегодня открыть дело недели: понедельник, не в обучении и не в тихие дни новичка. */
export const weeklyDue = (state: StoreState): boolean =>
  weekDay(state.day) === 1 && state.day >= CASE_FROM && !tutStep(state) && !quietDays(state) && !casesOf(state).open;

/**
 * Утро (смена дня, day.ts — и в игре, и в симуляторе): несданное после пятницы — в архив; пропущенные в
 * зале улики приходят размытыми; в понедельник — новое дело недели. Ничего не поменялось — тот же объект.
 */
export function caseMorning(state: StoreState): StoreState {
  let s = state;
  const cases = casesOf(s);
  const open = cases.open;
  if (open && s.day > open.due) {
    s = withCases(s, archive(cases, { id: open.id, tone: 'archived', day: s.day }));
  } else if (open && open.got.some((g, i) => !g && clueDay(open, i) < s.day)) {
    const got = open.got.map((g, i) => (!g && clueDay(open, i) < s.day ? 1 : g));
    s = withCases(s, { ...cases, open: { ...open, got } });
  }
  if (weeklyDue(s)) {
    const id = nextWeekly(s);
    if (id) s = openCase(s, id, 'week') ?? s;
  }
  return s;
}

/** Вопросы допроса: где был, что видел — и чёткие улики о нём (номера). */
export const confrontable = (open: OpenCase, who: string): number[] =>
  CASES[open.id].clues.flatMap((c, i) => (c.about === who && open.got[i] === 2 ? [i] : []));

/** Задать вопрос (q — where, seen или c<n> — показать улику n). Признание — если показали виновному его улику. */
export function askCase(state: StoreState, who: string, q: string): StoreState {
  const open = openCaseOf(state);
  if (!open || !(who in CASES[open.id].suspects)) return state;
  const clue = /^c(\d)$/.exec(q);
  if (clue && !confrontable(open, who).includes(Number(clue[1]))) return state;
  if (!clue && q !== 'where' && q !== 'seen') return state;
  const key = `${who}:${q}`;
  const confessed = open.confessed || (clue !== null && who === CASES[open.id].culprit);
  if (open.asked?.includes(key) && confessed === Boolean(open.confessed)) return state;
  const next: OpenCase = { ...open, asked: [...new Set([...(open.asked ?? []), key])] };
  if (confessed) next.confessed = true;
  return withCases(state, { ...casesOf(state), open: next });
}

/** Отметить, что улики на доске посмотрели. */
export function seeBoard(state: StoreState): StoreState {
  const open = openCaseOf(state);
  const n = open ? open.got.filter(Boolean).length : 0;
  if (!open || (open.seen ?? 0) >= n) return state;
  return withCases(state, { ...casesOf(state), open: { ...open, seen: n } });
}

/** Сколько улик на доске и сколько из них новых. */
export const clueCount = (open: OpenCase): { got: number; fresh: number } => {
  const got = open.got.filter(Boolean).length;
  return { got, fresh: Math.max(0, got - (open.seen ?? 0)) };
};

/** Сегодня пятница этого дела — можно обвинить. */
export const accuseToday = (state: StoreState): boolean => openCaseOf(state)?.due === state.day;

export interface CaseGain {
  money: number;
  rating: number;
  fame?: [number, number];
}

/** Итог обвинения (без применения): кто виноват, признался ли. */
export function caseGain(level: number, tone: Exclude<CaseTone, 'archived'>): CaseGain {
  if (tone === 'wrong') return { money: 0, rating: CASE_RATING.wrong };
  const money = tone === 'great' ? caseMoney(level) : Math.round(caseMoney(level) / 2);
  return { money, rating: CASE_RATING[tone], fame: CASE_FAME[tone] };
}

/** Обвинить: только в пятницу дела. Дело закрывается; null — не сегодня или нет такого подозреваемого. */
export function accuse(state: StoreState, who: string): { state: StoreState; tone: Exclude<CaseTone, 'archived'>; gain: CaseGain } | null {
  const open = openCaseOf(state);
  if (!open || !accuseToday(state) || !(who in CASES[open.id].suspects)) return null;
  const tone = who !== CASES[open.id].culprit ? 'wrong' : open.confessed ? 'great' : 'good';
  const gain = caseGain(state.level, tone);
  const rating = Math.round(Math.min(5, Math.max(0, state.rating + gain.rating)) * 100) / 100;
  let cases = archive(casesOf(state), { id: open.id, tone, day: state.day, who });
  if (gain.fame) {
    const [pct, days] = gain.fame;
    const still = cases.fame && cases.fame.until >= state.day && cases.fame.pct > pct ? cases.fame : undefined;
    cases = { ...cases, fame: still ?? { pct, until: state.day + days - 1 } };
  }
  return { state: { ...state, money: state.money + gain.money, rating, cases }, tone, gain };
}

/** Множитель гостей от «славы района». */
export const caseGuests = (state: StoreState): number => {
  const fame = state.cases?.fame;
  return fame && state.day <= fame.until ? 1 + fame.pct : 1;
};

/** Последнее закрытое дело, если его закрыли сегодня (утром — строчка «ушло в архив»). */
export const closedToday = (state: StoreState): CaseRecord | null => {
  const last = casesOf(state).done?.at(-1);
  return last && last.day === state.day ? last : null;
};

/** У каких портретов есть настроения (остальные — одно лицо). */
const MOODY = (base: string): boolean => /^(skit_|case_)/.test(base) || base === 'police' || base === 'eduard';

/** Портрет героя дела с настроением. */
export function casePortrait(base: string, mood: 'happy' | 'sad' | 'angry' | 'surprised' | null): string {
  const m = mood === 'angry' && base === 'police' ? null : mood;
  return `portrait_${base}${m && MOODY(base) ? `_${m}` : ''}`;
}
