import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newGame, staffOf, wageFor, type StoreState } from '../src/game/economy';
import { finishSkit, SKIT_IDS, SKITS, skitsOf, skitToday, type SkitId } from '../src/game/skits';
import {
  answerEcho,
  answerEchoNews,
  canHireEcho,
  ECHO_DELAY,
  ECHO_HIRE,
  ECHO_IDS,
  ECHO_VISIT_DAYS,
  ECHOES,
  echoBad,
  echoChoices,
  echoDelay,
  echoesOf,
  echoGuests,
  echoNews,
  echoVisitToday,
  echoWage,
  plantEcho,
  SKIT_ECHO,
  skitEcho,
  type EchoId,
} from '../src/game/echoes';
import { guestsToday } from '../src/game/day';
import { pendingTip } from '../src/game/tips';
import { pickNews } from '../src/game/headlines';
import { ru } from '../src/i18n/ru';

// «Эхо решений» (echoes.ts): сценка помнит, чем кончилась, и через 1–4 недели её герой возвращается —
// с благодарностью или с обидой. Всё — от зерна магазина и дня, старые сохранения без эха не ломаются.

const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 20, money: 5000, seed: 7, ...over });
const onlyLeft = (id: SkitId) => ({ done: SKIT_IDS.filter((x) => x !== id) });

/** Первый день, когда сегодня — эта сценка (остальные уже сыграны). */
function dayOf(id: SkitId, over: Partial<StoreState> = {}): StoreState {
  for (let day = SKITS[id].from; day < SKITS[id].from + 300; day++) {
    const s = shop({ day, skits: onlyLeft(id), ...over });
    if (skitToday(s) === id) return s;
  }
  throw new Error(`нет дня для ${id}`);
}

/** Сыграть сценку по пути и вернуть состояние после неё. */
function play(id: SkitId, path: number[], over: Partial<StoreState> = {}): ReturnType<typeof finishSkit> & object {
  const res = finishSkit(dayOf(id, over), id, path);
  if (!res) throw new Error(`путь ${path} не ведёт к финалу ${id}`);
  return res;
}

/** Перемотать на день, когда эхо пришло. */
const at = (s: StoreState, day: number): StoreState => ({ ...s, day });
const dueOf = (s: StoreState, id: EchoId): number => echoesOf(s).list.find((x) => x.id === id)!.due;

describe('эхо: сценка помнит финал и ключевые выборы', () => {
  it('финал и ключи — в памяти сценки; эхо посажено на 7–28 дней вперёд', () => {
    const res = play('blogger', [0, 1, 1, 2, 2, 2]);
    const memo = skitsOf(res.state).memo!.blogger!;
    expect(memo.end).toBe('flop');
    expect(memo.keys).toEqual(['rude']);
    expect(res.echo).toBe('roast');
    const due = dueOf(res.state, 'roast');
    expect(due - res.state.day).toBeGreaterThanOrEqual(ECHO_DELAY[0]);
    expect(due - res.state.day).toBeLessThanOrEqual(ECHO_DELAY[1]);
  });

  it('детерминированно: тот же магазин и день — тот же срок; разные магазины расходятся', () => {
    const a = play('puppy', [0, 0, 3, 1]);
    const b = play('puppy', [0, 0, 3, 1]);
    expect(dueOf(a.state, 'bublik')).toBe(dueOf(b.state, 'bublik'));
    const delays = new Set(Array.from({ length: 40 }, (_, seed) => echoDelay(shop({ seed }), 2)));
    expect(delays.size).toBeGreaterThan(5);
    for (const d of delays) expect(d).toBeGreaterThanOrEqual(ECHO_DELAY[0]);
    for (const d of delays) expect(d).toBeLessThanOrEqual(ECHO_DELAY[1]);
  });

  it('хороший и плохой финал каждой сценки возвращаются по-разному', () => {
    for (const id of SKIT_IDS) {
      const ends = Object.entries(SKITS[id].nodes).filter(([, n]) => n.end);
      const good = ends.filter(([, n]) => n.end!.tone === 'great' || n.end!.tone === 'good').map(([name]) => skitEcho(id, name));
      // Неудачный — «не повезло» или «обычный» (отмахнулся от Тёмы).
      const bad = ends.filter(([, n]) => n.end!.tone === 'bad' || n.end!.tone === 'ok').map(([name]) => skitEcho(id, name, Object.values(SKITS[id].keys ?? {})));
      expect(good.some(Boolean), `${id}: хороший финал без эха`).toBe(true);
      expect(bad.some(Boolean), `${id}: неудачный финал без эха`).toBe(true);
      for (const g of good) for (const b of bad) if (g && b) expect(g, id).not.toBe(b);
    }
  });

  it('ключевые выборы: на кого указали, нагрубили ли, кто отнёс лекарства', () => {
    expect(play('robbery', [1, 3, 0]).echo).toBe('wrongCourier');
    expect(play('robbery', [1, 3, 1]).echo).toBe('wrongPainter');
    // Вирусный эфир важнее грубости в чате; грубость без вирусного — разгромный ролик.
    expect(play('blogger', [1, 0, 0, 0, 2, 0]).echo).toBe('sequel');
    expect(play('blogger', [0, 0, 0, 0, 0, 0]).echo).toBe('sequel');
    // Отнёс лекарства сам и разошлись по-хорошему — шарф; точка курьеров — смена обедает у нас.
    expect(play('rain', [0, 3, 0, 1]).echo).toBe('scarf');
    expect(play('rain', [0, 3, 0, 0]).echo).toBe('couriers');
    expect(play('rain', [0, 3, 2]).echo).toBe('dispatcher');
    // Обычный финал эха не оставляет.
    const plain = play('rain', [1]);
    expect(plain.echo).toBeNull();
    expect(echoesOf(plain.state).list).toEqual([]);
    expect(skitsOf(plain.state).memo!.rain).toEqual({ end: 'door', day: plain.state.day });
  });

  it('детектив: признавшегося можно отпустить — премии нет, зато потом придёт Денис', () => {
    const s = dayOf('robbery');
    const caught = finishSkit(s, 'robbery', [0, 1, 0, 0, 0, 0, 3, 2, 2, 0, 0])!;
    const forgiven = finishSkit(s, 'robbery', [0, 1, 0, 0, 0, 0, 3, 2, 2, 0, 1])!;
    expect(caught.echo).toBe('galina');
    expect(forgiven.echo).toBe('denis');
    expect(forgiven.tone).toBe('good');
    expect(forgiven.state.money).toBe(s.money);
    expect(caught.state.money).toBeGreaterThan(forgiven.state.money);
  });
});

describe('эхо: когда и как приходит', () => {
  it('до срока — тишина; в срок — новостью утра или гостем в зале, гость ждёт три дня', () => {
    const res = play('puppy', [0, 0, 3, 1]);
    const due = dueOf(res.state, 'bublik');
    expect(ECHOES.bublik.visit).toBe(true);
    expect(echoVisitToday(at(res.state, due - 1))).toBeNull();
    expect(echoNews(at(res.state, due - 1))).toBeNull();
    for (let d = due; d < due + ECHO_VISIT_DAYS; d++) {
      expect(echoVisitToday(at(res.state, d))?.id).toBe('bublik');
      expect(echoNews(at(res.state, d))).toBeNull();
    }
    // Так и не дошёл до зала — приходит новостью.
    expect(echoVisitToday(at(res.state, due + ECHO_VISIT_DAYS))).toBeNull();
    expect(echoNews(at(res.state, due + ECHO_VISIT_DAYS))?.id).toBe('bublik');
  });

  it('новость утра встаёт в общую очередь (одна за утро)', () => {
    const res = play('puppy', [2]);
    const s = at(res.state, dueOf(res.state, 'tyomaCold'));
    expect(echoNews(s)?.id).toBe('tyomaCold');
    expect(pickNews(s, ['echo']).id).toBe('echo');
    expect(pickNews(s, ['story', 'echo']).id).toBe('story');
  });

  it('два эхо в одно утро: после ответа второе ждёт завтра', () => {
    let s = plantEcho(plantEcho(shop(), 'stale', 15), 'roses', 18);
    const ready = (x: typeof s) => (echoNews(x) ? (['echo'] as const) : []);
    let r = pickNews(s, ready(s));
    expect(r.id).toBe('echo');
    s = answerEchoNews(r.state, 'stale')!;
    expect(echoNews(s)).toBeNull();
    r = pickNews(s, ready(s));
    expect(r.id).toBeNull();
    expect(r.state.newsQ?.done).toBe(1);
    const next = at(s, s.day + 1);
    expect(echoNews(next)?.id).toBe('roses');
    // Гость в зале (не новость) отметку не ставит.
    expect(echoesOf(answerEcho(plantEcho(shop(), 'stale', 15), 'stale')!).newsDay).toBeUndefined();
  });

  it('несколько эхо — кто дольше ждёт, тот первым', () => {
    let s = shop();
    s = plantEcho(s, 'roses', 18);
    s = plantEcho(s, 'stale', 15);
    s = plantEcho(s, 'scarf', 25);
    expect(echoNews(s)?.id).toBe('stale');
    s = answerEcho(s, 'stale')!;
    expect(echoNews(s)?.id).toBe('roses');
    s = answerEcho(s, 'roses')!;
    expect(echoNews(s)).toBeNull();
    expect(echoesOf(s).list.map((x) => x.id)).toEqual(['scarf']);
    expect(echoesOf(s).heard).toBe(2);
  });
});

describe('эхо: последствия', () => {
  it('деньги и рейтинг — сразу, эхо уходит из списка; второй раз не ответить', () => {
    const s = plantEcho(shop({ rating: 3 }), 'sergeant', 20);
    const after = answerEcho(s, 'sergeant')!;
    expect(after.money).toBe(s.money + 200);
    expect(after.rating).toBeCloseTo(3.04);
    expect(answerEcho(after, 'sergeant')).toBeNull();
    // Не в срок — нельзя.
    expect(answerEcho(plantEcho(shop(), 'sergeant', 30), 'sergeant')).toBeNull();
  });

  it('клуб собачников — гостей больше на 4 дня; разгромный ролик — меньше', () => {
    const base = shop({ rating: 3.5, level: 1 });
    const club = answerEcho(plantEcho(base, 'dogClub', 20), 'dogClub')!;
    expect(echoGuests(club)).toBeCloseTo(1.1);
    expect(guestsToday(club)).toBeGreaterThan(guestsToday(base));
    expect(echoGuests(at(club, 23))).toBeCloseTo(1.1);
    expect(echoGuests(at(club, 24))).toBe(1);
    const roast = answerEcho(plantEcho(base, 'roast', 20), 'roast')!;
    expect(echoGuests(roast)).toBeCloseTo(0.93);
    expect(guestsToday(roast)).toBeLessThan(guestsToday(base));
    expect(roast.rating).toBeLessThan(base.rating);
    expect(echoBad(ECHOES.roast.choices[0].effect)).toBe(true);
    expect(echoBad(ECHOES.dogClub.choices[0].effect)).toBe(false);
  });

  it('новое эхо не перебивает более сильное, которое ещё идёт', () => {
    let s = answerEcho(plantEcho(shop(), 'sequel', 20), 'sequel')!;
    s = answerEcho(plantEcho(s, 'stale', 20), 'stale')!;
    expect(echoGuests(s)).toBeCloseTo(1.1);
  });

  it('Денис: есть место — грузчиком за 60% ставки, под своим именем; места нет — чинит крыльцо', () => {
    const s = plantEcho(shop({ level: 2, staff: [] }), 'denis', 20);
    expect(canHireEcho(s)).toBe(true);
    expect(echoChoices(s, 'denis').map((c) => c.i)).toEqual([0, 1]);
    const { wage, full } = echoWage();
    expect(full).toBe(wageFor('loader', ECHO_HIRE.skill, ECHO_HIRE.trait));
    expect(wage).toBeLessThan(full);
    const hired = answerEcho(s, 'denis', 0)!;
    const denis = staffOf(hired, 'loader')!;
    expect(denis.wage).toBe(wage);
    expect(denis.alias).toBe('skit.robbery.cast.hoodie');
    expect(ru[denis.alias as keyof typeof ru]).toBe('Денис');
    // Отказать — можно; ответа «помочь с крыльцом» при свободном месте нет.
    expect(staffOf(answerEcho(s, 'denis', 1)!, 'loader')).toBeUndefined();
    expect(answerEcho(s, 'denis', 2)).toBeNull();
    // Грузчик уже есть — только помощь, рейтинг чуть выше.
    const busy = plantEcho(hired, 'denis', 20);
    expect(canHireEcho(busy)).toBe(false);
    expect(echoChoices(busy, 'denis').map((c) => c.i)).toEqual([2]);
    expect(answerEcho(busy, 'denis', 0)).toBeNull();
    const helped = answerEcho(busy, 'denis', 2)!;
    expect(helped.staff).toHaveLength(busy.staff.length);
    expect(helped.rating).toBeGreaterThan(busy.rating);
  });

  it('деньги не уходят в минус', () => {
    const s = answerEcho(plantEcho(shop({ money: 0 }), 'viktor', 20), 'viktor')!;
    expect(s.money).toBe(150);
  });
});

describe('эхо: общий вход и старые сохранения', () => {
  it('plantEcho — для любых историй: срок и подстановки в текст', () => {
    const s = plantEcho(shop(), 'scarf', 33.4, { name: 'Зоя' });
    expect(echoesOf(s).list).toEqual([{ id: 'scarf', due: 33, data: { name: 'Зоя' } }]);
  });

  it('старое сохранение без эха и памяти сценок: пусто, гости как были, подсказки нет', () => {
    const old = shop({ skits: { done: ['puppy', 'gift'] } });
    delete old.echoes;
    expect(echoesOf(old).list).toEqual([]);
    expect(echoGuests(old)).toBe(1);
    expect(echoNews(old)).toBeNull();
    expect(echoVisitToday(old)).toBeNull();
    expect(skitsOf(old).memo).toBeUndefined();
    expect(pendingTip({ ...old, seenTips: ['broke', 'ownerTill', 'alone', 'weekly', 'fair', 'loyalty', 'delivery', 'register2', 'oven', 'coffee', 'nightShift', 'pawn', 'case', 'rhythm'] })).toBeNull();
  });

  it('эхо, которого в игре больше нет, из сохранения пропускается', () => {
    const s = shop({ echoes: { list: [{ id: 'gone' as EchoId, due: 3 }, { id: 'roses', due: 5 }] } });
    expect(echoesOf(s).list.map((x) => x.id)).toEqual(['roses']);
    expect(echoNews(s)?.id).toBe('roses');
  });

  it('первая подсказка — утро после первой сценки с эхом', () => {
    const seen = ['broke', 'ownerTill', 'alone', 'weekly', 'fair', 'loyalty', 'delivery', 'register2', 'oven', 'coffee', 'nightShift', 'pawn', 'case', 'rhythm'];
    const res = play('gift', [0, 3, 3], { seenTips: seen });
    expect(pendingTip(res.state)).toBe('echo');
  });
});

describe('эхо: сохранение', () => {
  let local: Record<string, string> = {};
  beforeEach(() => {
    vi.resetModules();
    local = {};
    Object.assign(globalThis, {
      localStorage: { getItem: (k: string) => local[k] ?? null, setItem: (k: string, v: string) => (local[k] = v), removeItem: (k: string) => delete local[k] },
    });
  });
  afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

  it('посаженное эхо и память сценки переживают сохранение; старое сохранение грузится без них', async () => {
    const { loadGame, saveGame } = await import('../src/game/save');
    const res = play('pies', [0, 0, 0, 0, 0]);
    saveGame(res.state);
    const back = loadGame()!;
    expect(back.echoes).toEqual(res.state.echoes);
    expect(skitsOf(back).memo).toEqual(skitsOf(res.state).memo);
    const old = newGame();
    local['magazinchik.save'] = JSON.stringify({ version: 11, state: { ...old, skits: { done: ['pies'] } } });
    const loaded = loadGame()!;
    expect(loaded.echoes).toBeUndefined();
    expect(echoesOf(loaded).list).toEqual([]);
  });
});

describe('эхо: тексты и герои', () => {
  it('у каждого эхо есть текст, у ответов — подписи, у героя — имя и портрет в сценке', () => {
    const keys = ru as Record<string, string>;
    for (const id of ECHO_IDS) {
      const d = ECHOES[id];
      expect(keys[`echo.${id}`], id).toBeTruthy();
      if (d.skit) {
        expect(SKITS[d.skit].cast[d.who], `${id}: ${d.who}`).toBeTruthy();
        expect(keys[`skit.${d.skit}.cast.${d.who}`], `${id}: имя`).toBeTruthy();
      } else {
        // Эхо других историй (plantEcho): свои заголовок и имя.
        expect(keys[`echo.${id}.title`] && keys[`echo.${id}.name`], `${id}: заголовок и имя`).toBeTruthy();
      }
      if (d.choices.length > 1) d.choices.forEach((_, i) => expect(keys[`echo.${id}.${i}`], `${id}.${i}`).toBeTruthy());
    }
  });

  it('у каждой сценки есть эхо, и все эхо из таблицы существуют', () => {
    for (const id of SKIT_IDS) {
      expect(SKIT_ECHO[id].length).toBeGreaterThanOrEqual(2);
      for (const [match, echo] of SKIT_ECHO[id]) {
        expect(ECHOES[echo], echo).toBeTruthy();
        const isEnd = Boolean(SKITS[id].nodes[match]?.end);
        const isKey = Object.values(SKITS[id].keys ?? {}).includes(match);
        expect(isEnd || isKey, `${id}: ${match}`).toBe(true);
      }
    }
  });
});
