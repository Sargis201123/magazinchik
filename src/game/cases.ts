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
// Другие системы могут открыть дело сами (openCase: «Крыша» — о рэкете) и приколоть свою улику (pinClue в caseBoard.ts).
//
// Здесь — только то, что нужно смене дня (основной файл кода). Доска, допрос, обвинение, новость утра, нажатая
// улика (takeClue) и чужие улики (pinClue) — в caseBoard.ts: их зовут только утреннее меню и значок улики, а они
// грузятся отдельно (13.11: предел веса кода).

import type { TextKey } from '../i18n/ru';
import type { StoreState } from './economy';
import { quietDays } from './firstday';
import { tutStep } from './tutorial';
import { rng } from './random';
import { SKIT_FROM } from './skits';

export type CaseId = 'dog' | 'windows' | 'till' | 'crates' | 'racket';
/** Откуда улика: обронённый чек, запись камеры, находка (Бобик принёс или у порога), разговор у кассы. */
export type ClueSrc = 'receipt' | 'camera' | 'find' | 'talk';
/** Кто открыл дело: неделя сама или другая система (ломбард, «Крыша» — racket.ts). */
export type CaseOrigin = 'week' | 'pawn' | 'racket';
export type CaseTone = 'great' | 'good' | 'wrong' | 'archived';

/**
 * Дела недели по порядку; кто пострадал, подозреваемые и улики — CASES в caseBoard.ts. Дела «racket» тут нет:
 * его открывает только «Крыша» (racket.ts), когда хозяин идёт в полицию, — неделя его сама не берёт.
 */
export const CASE_IDS: CaseId[] = ['dog', 'windows', 'till', 'crates'];
/** Улик в каждом деле: по одной на день с понедельника по четверг (проверяет тест). */
export const CLUES = 4;

/**
 * С какого дня дела: когда открыты сценки (автор, 13.11: «начало — когда сценки открыты»). Дело всё равно
 * открывается в понедельник, так что первое — в первый понедельник после SKIT_FROM (8-й день). Новость о нём
 * идёт через общую очередь утра (headlines.ts) и не толкается с другими карточками.
 */
export const CASE_FROM = SKIT_FROM;
/** День недели по игровому календарю (неделя — игровой месяц, 7 дней): 1 — понедельник, 5 — пятница. */
export const weekDay = (day: number): number => ((day - 1) % 7) + 1;
export const FRIDAY = 5;
/** Сколько самое малое дней от открытия до пятницы-обвинения (чтобы улики успели прийти). */
export const CASE_MIN_DAYS = 4;
/** Улика из другой системы: текст (ключ словаря), значок и к какому делу (нет — к идущему). */
export interface ExtraClue {
  key: TextKey;
  /** Подстановки в текст: имя → ключ словаря (переводится на доске, напр. item → pawn.item.watch). */
  vars?: Record<string, TextKey>;
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
  /** В какое утро новость о деле уже прочли (карточка в очереди новостей, headlines.ts) — второй раз не зовёт. */
  told?: number;
}

export const casesOf = (state: StoreState): CasesState => state.cases ?? {};
export const openCaseOf = (state: StoreState): OpenCase | null => state.cases?.open ?? null;

export const withCases = (state: StoreState, next: CasesState): StoreState => ({ ...state, cases: next });

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
  const open: OpenCase = { id, origin, from: state.day, due: dueFrom(state.day), got: Array<number>(CLUES).fill(0) };
  return withCases(state, { ...s, open });
}

/** В какой день приходит улика n: от открытия до пятницы поровну (неделя — с понедельника по четверг). */
export const clueDay = (open: OpenCase, n: number): number => open.from + Math.floor((n * (open.due - open.from)) / open.got.length);

/** Какая улика сегодня ждёт в зале (номер) — или null. */
export function clueToday(state: StoreState): number | null {
  const open = openCaseOf(state);
  if (!open || state.day >= open.due) return null;
  const n = open.got.findIndex((g, i) => !g && clueDay(open, i) === state.day);
  return n < 0 ? null : n;
}

export const archive = (s: CasesState, rec: CaseRecord): CasesState => {
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

/** Множитель гостей от «славы района». */
export const caseGuests = (state: StoreState): number => {
  const fame = state.cases?.fame;
  return fame && state.day <= fame.until ? 1 + fame.pct : 1;
};

