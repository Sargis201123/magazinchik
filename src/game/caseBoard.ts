// «Дело недели»: доска, допрос, обвинение и утренняя новость (правила дела и улики по дням — cases.ts).
// Отдельный файл, потому что всё это зовёт только утреннее меню (ui/morning.ts, ui/cases.ts), а оно грузится
// своим куском кода: основному файлу эти правила ни к чему (13.11: предел веса кода, vite.config.ts).

import type { TextKey } from '../i18n/ru';
import type { StoreState } from './economy';
import {
  archive,
  casesOf,
  clueDay,
  openCaseOf,
  withCases,
  type CaseId,
  type CaseRecord,
  type CaseTone,
  type ClueSrc,
  type ExtraClue,
  type OpenCase,
} from './cases';

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

/** Сегодня пятница этого дела — можно обвинить. */
export const accuseToday = (state: StoreState): boolean => openCaseOf(state)?.due === state.day;

/** Последнее закрытое дело, если его закрыли сегодня (утром — строчка «ушло в архив»). */
export const closedToday = (state: StoreState): CaseRecord | null => {
  const last = casesOf(state).done?.at(-1);
  return last && last.day === state.day ? last : null;
};

/** Что даёт раскрытое дело: деньги растут с магазином; признание по улике — вдвое больше. */
export const caseMoney = (level: number): number => 250 + 150 * level;
export const CASE_RATING = { great: 0.1, good: 0.05, wrong: -0.05 } as const;
/** «Слава района»: гостей больше — на сколько и сколько дней. */
export const CASE_FAME: Record<'great' | 'good', [number, number]> = { great: [0.1, 4], good: [0.06, 3] };

/**
 * Улики других систем на доске идущего дела. Ломбард (pawnshop.ts) сам ничего не прикалывает: он пишет изъятое
 * полицией в state.pawn.seized, а доска читает оттуда то, что забрали за время дела (сохранение не растёт).
 */
export const extraClues = (state: StoreState): ExtraClue[] => {
  const open = openCaseOf(state);
  if (!open) return [];
  const pinned = (casesOf(state).extra ?? []).filter((c) => !c.case || c.case === open.id);
  const pawned: ExtraClue[] = (state.pawn?.seized ?? [])
    .filter((p) => p.day >= open.from)
    .map((p) => ({ key: 'case.pawn', vars: { item: `pawn.item.${p.item}` as TextKey }, icon: '🏷', day: p.day }));
  return [...pinned, ...pawned];
};

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

/** Отметить, что улики на доске посмотрели (и утреннюю новость о деле заодно). */
export function seeBoard(state: StoreState): StoreState {
  const open = openCaseOf(state);
  const n = open ? open.got.filter(Boolean).length : 0;
  if (!open || ((open.seen ?? 0) >= n && casesOf(state).told === state.day)) return state;
  return withCases(state, { ...casesOf(state), open: { ...open, seen: Math.max(n, open.seen ?? 0) }, told: state.day });
}

/**
 * Есть ли утром новость о деле (для очереди новостей, headlines.ts): дело открылось (рассказ пострадавшего ждёт,
 * пока его не прочтут: утро открытия могла занять новость поважнее), пятница — пора обвинять, или дело ушло в
 * архив. Новые улики новостью не считаются (иначе дело занимало бы каждое утро недели): о них — значок на
 * строчке дела в утре.
 */
export function caseNews(state: StoreState): boolean {
  const s = casesOf(state);
  if (s.told === state.day) return false;
  const open = s.open;
  if (open) return (s.told ?? 0) < open.from || accuseToday(state);
  return closedToday(state)?.tone === 'archived';
}

/** Новость о деле прочли («Потом» или «Понятно»): строчка дела останется, карточка — нет. */
export const tellCase = (state: StoreState): StoreState =>
  casesOf(state).told === state.day ? state : withCases(state, { ...casesOf(state), told: state.day });

/** Сколько улик на доске и сколько из них новых. */
export const clueCount = (open: OpenCase): { got: number; fresh: number } => {
  const got = open.got.filter(Boolean).length;
  return { got, fresh: Math.max(0, got - (open.seen ?? 0)) };
};

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

/** У каких портретов есть настроения (остальные — одно лицо). */
const MOODY = (base: string): boolean => /^(skit_|case_)/.test(base) || base === 'police' || base === 'eduard';

/** Портрет героя дела с настроением. */
export function casePortrait(base: string, mood: 'happy' | 'sad' | 'angry' | 'surprised' | null): string {
  const m = mood === 'angry' && base === 'police' ? null : mood;
  return `portrait_${base}${m && MOODY(base) ? `_${m}` : ''}`;
}

/** Приколоть улику из другой системы (дубли по тексту не множатся). Дело ещё не открыто — она подождёт его. */
export function pinClue(state: StoreState, clue: Omit<ExtraClue, 'day'>): StoreState {
  const s = casesOf(state);
  if ((s.extra ?? []).some((c) => c.key === clue.key && c.case === clue.case)) return state;
  return withCases(state, { ...s, extra: [...(s.extra ?? []), { ...clue, day: state.day }] });
}

/** Нажали значок в зале: улика чёткая. */
export function takeClue(state: StoreState, n: number): StoreState {
  const open = openCaseOf(state);
  if (!open || open.got[n] === undefined || open.got[n] === 2 || clueDay(open, n) > state.day) return state;
  const got = open.got.map((g, i) => (i === n ? 2 : g));
  return withCases(state, { ...casesOf(state), open: { ...open, got } });
}
