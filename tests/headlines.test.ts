import { describe, expect, it, vi } from 'vitest';
import { lateBurglaryNews, lateContestAnnounce, lateContestResult, normalizeNews, NEWS_ANNOUNCE_DAYS, NEWS_KEEP_DAYS, pickNews, type NewsId } from '../src/game/headlines';
import { newGame, type StoreState } from '../src/game/economy';

// Одна новость за утро: очередь с приоритетом, остальные ждут следующего утра.

const at = (day: number, patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day, ...patch });

/** Пройти утро: показать новость, «ответить» на неё (её больше нет среди готовых), посмотреть, что дальше. */
function morning(state: StoreState, ready: NewsId[]): { shown: NewsId | null; after: NewsId | null; state: StoreState } {
  const first = pickNews(state, ready);
  const left = ready.filter((id) => id !== first.id);
  const second = pickNews(first.state, left);
  return { shown: first.id, after: second.id, state: second.state };
}

describe('очередь утренних новостей', () => {
  it('за утро — одна; ответил — следующая ждёт завтра', () => {
    const m = morning(at(10), ['tale', 'eduard', 'cat']);
    expect(m.shown).toBe('eduard');
    expect(m.after).toBeNull();
    const next = morning({ ...m.state, day: 11 }, ['tale', 'cat']);
    expect(next.shown).toBe('tale');
  });

  it('сюжет — всегда первым; решение дня — раньше остальных поворотов', () => {
    expect(pickNews(at(5), ['event', 'story', 'giant']).id).toBe('story');
    expect(pickNews(at(5), ['giant', 'event']).id).toBe('event');
    expect(pickNews(at(5), ['tale', 'contestResult']).id).toBe('contestResult');
  });

  it('глава сюжета утро не занимает: после неё — ещё одна новость (событие дня не пропадает)', () => {
    const first = pickNews(at(8), ['story', 'event', 'tale']);
    expect(first.id).toBe('story');
    const second = pickNews(first.state, ['event', 'tale']);
    expect(second.id).toBe('event');
    expect(pickNews(second.state, ['tale']).id).toBeNull();
  });

  it('начало конкурса ждёт первые дни недели', () => {
    const contest = { tier: 0, phase: 'run', since: 30, target: 1, revenue: 0, served: 0, unhappy: 0, empty: 0, wins: 0 } as NonNullable<StoreState['contest']>;
    expect(lateContestAnnounce(at(31, { contest }))).toBe(contest);
    expect(lateContestAnnounce(at(30 + NEWS_ANNOUNCE_DAYS, { contest }))).toBeNull();
    expect(lateContestAnnounce(at(31, { contest: { ...contest, announced: true } }))).toBeNull();
  });

  it('кто дольше ждал — тот раньше (при равной важности)', () => {
    let s = pickNews(at(3), ['life', 'tale']).state;
    // День 3: показали жизнь района (раньше в списке), история ждёт с 3-го.
    s = pickNews(s, ['tale']).state;
    s = { ...s, day: 4 };
    expect(pickNews(s, ['district', 'tale']).id).toBe('tale');
  });

  it('пока на показанную не ответили — она же (после «В гости» утро открывается заново)', () => {
    const first = pickNews(at(7), ['tale', 'life']);
    expect(pickNews(first.state, ['tale', 'life']).id).toBe(first.id);
    expect(pickNews(first.state, ['tale', 'life']).state).toBe(first.state);
  });

  it('ничего не готово — состояние не трогаем', () => {
    const s = at(2);
    expect(pickNews(s, []).state).toBe(s);
  });

  it('очередь переживает сохранение; кривая — выкидывается; старое сохранение — без неё', async () => {
    const local: Record<string, string> = {};
    vi.resetModules();
    Object.assign(globalThis, { localStorage: { getItem: (k: string) => local[k] ?? null, setItem: (k: string, v: string) => (local[k] = v), removeItem: (k: string) => delete local[k] } });
    try {
      const { loadGame, saveGame } = await import('../src/game/save');
      const s = pickNews(at(9), ['tale', 'cat']).state;
      saveGame(s);
      expect(loadGame()?.newsQ).toEqual(s.newsQ);
      local['magazinchik.save'] = JSON.stringify({ version: 10, state: at(4) });
      expect(loadGame()?.newsQ).toBeUndefined();
      local['magazinchik.save'] = JSON.stringify({ version: 10, state: { ...at(4), newsQ: { day: 'x' } } });
      expect(loadGame()?.newsQ).toBeUndefined();
    } finally {
      delete (globalThis as Record<string, unknown>).localStorage;
    }
    expect(normalizeNews({ day: 3, done: 1, shown: 'nope', wait: { tale: 2, bad: 1 } })).toEqual({ day: 3, done: 1, wait: { tale: 2 } });
  });

  it('итог конкурса и ночь со взломом ждут до недели, а не только свой день', () => {
    const last = { won: true, tier: 0, revenue: 1, target: 1, rating: 4, unhappy: 0, served: 1, empty: 0 } as unknown as NonNullable<StoreState['contest']>['last'];
    const contest = { tier: 1, phase: 'wait', since: 10, target: 1, revenue: 0, served: 0, unhappy: 0, empty: 0, wins: 1, last } as NonNullable<StoreState['contest']>;
    expect(lateContestResult(at(12, { contest }))).toBe(last);
    expect(lateContestResult(at(10 + NEWS_KEEP_DAYS + 1, { contest }))).toBeNull();
    const news = { day: 20, goods: [], cash: 10, repair: 0 } as unknown as NonNullable<NonNullable<StoreState['security']>['news']>;
    expect(lateBurglaryNews(at(21, { security: { news } }))).toBe(news);
    expect(lateBurglaryNews(at(21, { security: { news: { ...news, seen: true } } }))).toBeNull();
  });
});
