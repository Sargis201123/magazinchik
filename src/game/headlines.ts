// Одна новость за утро. Игра росла фича за фичей, и утро середины игры могло выложить подряд главу
// сюжета, сцену «Папа и Соня», новость про Эдуарда, итог конкурса, кражу, кота, событие дня и ещё
// пять карточек «человек, абзац, две кнопки» в меню. Теперь все они встают в одну очередь, и перед
// меню — не больше одной: сначала сюжет и главные повороты, потом то, что сегодня кончится, потом
// истории для души. Остальное ждёт следующего утра (очередь — в сохранении, state.newsQ): главное
// не теряется, а мелочь, которая долго ждала, может и пройти сама (у неё свои сроки: life.ts и др.).
//
// Сами карточки и их условия остались у своих модулей — здесь только кто первый и сколько за утро.

import type { StoreState } from './economy';
import { contestOf, type ContestResult, type ContestState } from './contest';
import type { BurglaryNews } from './watch';

/** Что может прийти утром. Порядок — внутри одного вида, при равном ожидании. */
export const NEWS_IDS = [
  // Сюжет и главные повороты.
  'story',
  'drama',
  'eduard',
  'giant',
  'zarCard',
  'zarBoss',
  // Сегодня кончится: итог и начало конкурса, ночь со взломом, решение дня, сотрудники.
  'contestResult',
  'contestAnnounce',
  'burglary',
  'event',
  'quit',
  'raise',
  'career',
  'trick',
  // Для души: истории района и постоянных.
  'tale',
  'life',
  'staffEvent',
  'district',
  'cat',
  'zarTale',
  'careerLeft',
  'arc',
] as const;
export type NewsId = (typeof NEWS_IDS)[number];

export type NewsKind = 'main' | 'timed' | 'flavour';

export const NEWS_KIND: Record<NewsId, NewsKind> = {
  story: 'main',
  drama: 'main',
  eduard: 'main',
  giant: 'main',
  zarCard: 'main',
  zarBoss: 'main',
  contestResult: 'timed',
  contestAnnounce: 'timed',
  burglary: 'timed',
  event: 'timed',
  quit: 'timed',
  raise: 'timed',
  career: 'timed',
  trick: 'timed',
  tale: 'flavour',
  life: 'flavour',
  staffEvent: 'flavour',
  district: 'flavour',
  cat: 'flavour',
  zarTale: 'flavour',
  careerLeft: 'flavour',
  arc: 'flavour',
};

/**
 * Что пропадёт, если не показать сегодня: решение дня (событие, пакость конкурента) — завтра у дня
 * своё. Такое идёт раньше главных поворотов (кроме главы сюжета): поворот подождёт до завтра, а это — нет.
 */
export const TODAY_ONLY: ReadonlySet<NewsId> = new Set<NewsId>(['event', 'trick']);

/** Сколько новостей за утро (глава сюжета не в счёт). */
export const NEWS_PER_MORNING = 1;
/**
 * Итог конкурса и ночь со взломом в своих модулях — «только в тот же день». Очередь держит их столько
 * дней (game/contest.ts contestResult, game/watch.ts burglaryNews), чтобы главное не пропадало молча.
 */
export const NEWS_KEEP_DAYS = 7;
/** Начало конкурса объявляем в первые дни недели конкурса, позже — уже незачем (идёт в «Сегодня»). */
export const NEWS_ANNOUNCE_DAYS = 3;

/** Итог конкурса, который отложили (contestResult — только в день итога): ждёт, пока идёт перерыв. */
export function lateContestResult(state: StoreState): ContestResult | null {
  const c = contestOf(state);
  return c?.phase === 'wait' && c.last && !c.last.seen && state.day >= c.since && state.day - c.since <= NEWS_KEEP_DAYS ? c.last : null;
}

/** Начало конкурса, которое отложили (contestAnnounce — только в первый день недели): ждёт, пока неделя идёт. */
export function lateContestAnnounce(state: StoreState): ContestState | null {
  const c = contestOf(state);
  return c?.phase === 'run' && !c.announced && state.day >= c.since && state.day - c.since < NEWS_ANNOUNCE_DAYS ? c : null;
}

/** Новость о ночи со взломом, которую отложили (burglaryNews — только в тот же день). */
export function lateBurglaryNews(state: StoreState): BurglaryNews | null {
  const news = state.security?.news;
  return news && !news.seen && state.day >= news.day && state.day - news.day <= NEWS_KEEP_DAYS ? news : null;
}

/** Очередь утра в сохранении. */
export interface NewsQueue {
  /** Игровой день, к которому относится счёт. */
  day: number;
  /** Сколько новостей уже показано и закрыто этим утром. */
  done: number;
  /** Какая сейчас на экране (ждёт ответа — и после «Зайти в гости» вернётся она же). */
  shown?: NewsId;
  /** С какого дня ждёт каждая отложенная — кто дольше ждал, тот раньше. */
  wait?: Partial<Record<NewsId, number>>;
}

const rank = (id: NewsId): number => (id === 'story' ? 0 : TODAY_ONLY.has(id) ? 1 : { main: 2, timed: 3, flavour: 4 }[NEWS_KIND[id]]);

/**
 * Какую новость показать этим утром. ready — что готово сейчас (условия своих модулей). Возвращает
 * выбранную (или null — сегодняшняя уже была) и состояние с обновлённой очередью (тот же объект,
 * если ничего не поменялось: утро перерисовывается часто).
 */
export function pickNews(state: StoreState, ready: readonly NewsId[]): { id: NewsId | null; state: StoreState } {
  const old = state.newsQ;
  let q: NewsQueue = old && old.day === state.day ? old : { day: state.day, done: 0, wait: old?.wait };
  // Показанная закрыта (на неё ответили, её условия больше не выполняются) — засчитать.
  // Глава сюжета утро не занимает: после неё ещё одна новость (иначе событие дня в утро главы пропало бы).
  if (q.shown && !ready.includes(q.shown)) q = { ...q, done: q.done + (q.shown === 'story' ? 0 : 1), shown: undefined };
  let id: NewsId | null = q.shown ?? null;
  if (!id && q.done < NEWS_PER_MORNING && ready.length) {
    const wait = q.wait ?? {};
    id = [...ready].sort((a, b) => rank(a) - rank(b) || (wait[a] ?? state.day) - (wait[b] ?? state.day) || NEWS_IDS.indexOf(a) - NEWS_IDS.indexOf(b))[0];
    q = { ...q, shown: id };
  }
  // Каждая готовая помнит, с какого дня ждёт (и показанная — вдруг сегодня её не дочитают); ушедшие — из очереди.
  const wait: Partial<Record<NewsId, number>> = {};
  for (const r of ready) wait[r] = q.wait?.[r] ?? state.day;
  q = { ...q, wait: Object.keys(wait).length ? wait : undefined };
  if (!q.wait) delete q.wait;
  if (!q.shown) delete q.shown;
  // Пустая очередь (ничего не ждёт и не было) — то же, что её отсутствие: поле не заводим.
  if (!q.done && !q.shown && !q.wait) {
    if (!old) return { id, state };
    const next = { ...state };
    delete next.newsQ;
    return { id, state: next };
  }
  return { id, state: same(old, q) ? state : { ...state, newsQ: q } };
}

const same = (a: NewsQueue | undefined, b: NewsQueue): boolean => JSON.stringify(a ?? null) === JSON.stringify(b);

/** Из сохранения: неизвестные новости выкидываем, кривое — как будто очереди не было. */
export function normalizeNews(raw: unknown): NewsQueue | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Partial<NewsQueue>;
  if (typeof r.day !== 'number' || !Number.isFinite(r.day)) return undefined;
  const known = (id: unknown): id is NewsId => typeof id === 'string' && (NEWS_IDS as readonly string[]).includes(id);
  const out: NewsQueue = { day: r.day, done: typeof r.done === 'number' && r.done >= 0 ? Math.floor(r.done) : 0 };
  if (known(r.shown)) out.shown = r.shown;
  if (r.wait && typeof r.wait === 'object') {
    const wait: Partial<Record<NewsId, number>> = {};
    for (const [k, v] of Object.entries(r.wait)) if (known(k) && typeof v === 'number' && Number.isFinite(v)) wait[k] = v;
    if (Object.keys(wait).length) out.wait = wait;
  }
  return out;
}
