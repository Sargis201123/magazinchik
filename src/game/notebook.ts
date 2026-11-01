// «Бабушкина тетрадь» — одна история через всю игру. Главный вопрос: почему бабушка на самом деле
// отдала ларёк и что значит вырванная последняя страница — «Лавка у моста. Вернуть…».
//
// У тетради две половины. Слева — её собственные долги (долг первой главы). Справа — сорок лет того,
// кому она давала в долг (полрайона), и каждая строчка зачёркнута: «не брать». Страницы открываются
// по ходу глав (story.ts): Валентина, Марат, «Эдик, 9 лет», долг Эдуарда, лавка у моста (Заречье),
// чистая страница Сони на церемонии (contest.ts). Почти всё выводится из уже существующего состояния —
// своего у тетради только: пришла ли она письмом, что игрок ответил Эдуарду и записала ли Соня свою строчку.

import type { TextKey } from '../i18n/ru';
import type { StoreState } from './economy';
import { contestOf, juryDay } from './contest';
import { hasZar } from './zarechye';

export interface NotebookState {
  /** Тетрадь пришла письмом (returns.ts) — с этого утра её можно открыть. */
  got?: boolean;
  /** Начало пятой главы: Эдуард принёс долг «за батоны, с процентами» — взяли или «не брать». */
  eduard?: 'took' | 'kept';
  /** Церемония: Соня записала на чистой странице «Соня. Первая смена». */
  sonya?: boolean;
}

/** Строчка тетради: о ком (что открылось), какая половина, зачёркнута ли. */
export type PageId = 'debts' | 'valya' | 'marat' | 'edik' | 'many' | 'eduard' | 'torn' | 'sonya';

export interface NotebookLine {
  id: PageId;
  key: TextKey;
  /** Левая половина — её долги; правая — кому давала сама; «страница» — вырванная и чистая в конце. */
  side: 'left' | 'right' | 'page';
  /** Зачёркнута и подписана «не брать» (или «вернули»). */
  crossed: boolean;
  /** Подпись сбоку: «не брать», «вернули», «не записывать». */
  note?: TextKey;
}

/** Письмо с тетрадью уходит вечером первого дня — приходит утром второго (до этого игроку не до неё). */
export const NOTEBOOK_FROM_DAY = 1;
/** Сколько принёс Эдуард «за батоны и молоко, тридцать лет, с процентами» и сколько звёзд за «не брать». */
export const EDUARD_DEBT = 400;
export const EDUARD_KEPT_RATING = 0.1;

export const hasNotebook = (s: StoreState): boolean => Boolean(s.nb?.got);

/** Пора отправить тетрадь письмом (вечером, через returns.ts planLetter). Старые сохранения — тоже. */
export const notebookDue = (s: StoreState): boolean => !s.nb?.got && !s.bankrupt && s.day >= NOTEBOOK_FROM_DAY;

/** Тетрадь пришла: открыть её можно с этого утра. */
export const receiveNotebook = (s: StoreState): StoreState => (s.nb?.got ? s : { ...s, nb: { ...s.nb, got: true } });

/** Ответ Эдуарду в начале пятой главы. «Взять» — деньги; «не брать» — район узнаёт, рейтинг чуть выше. */
export function answerEduard(s: StoreState, answer: 'took' | 'kept'): StoreState {
  if (s.nb?.eduard) return s;
  const nb: NotebookState = { ...s.nb, eduard: answer };
  return answer === 'took'
    ? { ...s, nb, money: s.money + EDUARD_DEBT }
    : { ...s, nb, rating: Math.min(5, s.rating + EDUARD_KEPT_RATING) };
}

/** Соня записала свою строчку (конец церемонии). */
export const writeSonya = (s: StoreState): StoreState => (s.nb?.sonya ? s : { ...s, nb: { ...s.nb, sonya: true } });

/** Что уже открыто в тетради — по порядку страниц. Глава — из сюжета (story.ts): прошли главу — открылась строчка. */
export function notebookLines(s: StoreState): NotebookLine[] {
  const ch = s.story.chapter;
  const out: NotebookLine[] = [];
  // Слева: её долги — соседям на ремонт ларька. Вернули (первая глава) — зачёркнуто.
  const paid = ch >= 1 || (s.debt === 0 && hasNotebook(s));
  out.push({ id: 'debts', key: 'nb.line.debts', side: 'left', crossed: paid, note: paid ? 'nb.note.paid' : undefined });
  // Справа: кому давала сама. Открывается по главам.
  if (ch >= 1) out.push({ id: 'valya', key: 'nb.line.valya', side: 'right', crossed: true, note: 'nb.note.no' });
  if (ch >= 2) out.push({ id: 'marat', key: 'nb.line.marat', side: 'right', crossed: true, note: 'nb.note.no' });
  if (ch >= 3) out.push({ id: 'edik', key: 'nb.line.edik', side: 'right', crossed: false, note: 'nb.note.skip' });
  out.push({ id: 'many', key: 'nb.line.many', side: 'right', crossed: true, note: 'nb.note.no' });
  // Пятая глава: долг Эдуарда. Старое сохранение, прошедшее главу без выбора, — «не брать», как написано.
  const eduard = s.nb?.eduard ?? (ch >= 5 ? 'kept' : undefined);
  if (eduard) out.push({ id: 'eduard', key: eduard === 'took' ? 'nb.line.eduardTook' : 'nb.line.eduardKept', side: 'right', crossed: true });
  // Вырванная страница: в Заречье бабушка дописывает её до конца.
  out.push({ id: 'torn', key: hasZar(s) ? 'nb.line.tornDone' : 'nb.line.torn', side: 'page', crossed: false });
  if (s.nb?.sonya) out.push({ id: 'sonya', key: 'nb.line.sonya', side: 'page', crossed: false });
  return out;
}

/**
 * Кульминация: день жюри первого конкурса (он совпадает с последним днём битвы с «Гигантом», contest.ts) —
 * люди из тетради приходят «вернуть долги»: нарядные гости и знакомые лица у кассы.
 */
export function repayDay(s: StoreState): boolean {
  const c = contestOf(s);
  return Boolean(c && c.tier === 0 && c.wins === 0 && juryDay(s));
}
