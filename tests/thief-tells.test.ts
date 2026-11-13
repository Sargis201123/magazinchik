import { describe, expect, it } from 'vitest';
import { emptyDayStats, endDay, newGame, satisfaction, type StoreState } from '../src/game/economy';
import {
  camTells,
  catchBounty,
  MAX_PICKS,
  offend,
  OWNER_BOUNTY,
  OWNER_CATCH,
  ownerCatch,
  thiefPicks,
  trainingThief,
} from '../src/game/thiefTells';
import { pendingTip, seeTip } from '../src/game/tips';
import { simulate } from '../src/game/simulate';

// Воришка по повадкам (13.11): вора не выдаёт одежда — только поведение. Касание вора — товар на место и награда,
// касание честного — обида: ушёл без покупки, рейтинг чуть ниже.

const fresh = (n: number) => Array.from({ length: n }, () => ({ age: 0 }));
const shop = (over: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  day: 20,
  money: 1000,
  seed: 7,
  shelves: [
    { kind: 'bakery', level: 0, items: { bread: fresh(3) } },
    { kind: 'produce', level: 0, items: { apples: fresh(3), potatoes: fresh(2) } },
    { kind: 'meat', level: 0, items: { meat: fresh(2) } },
    { kind: 'icebox', level: 0, items: { icecream: fresh(4) } },
  ],
  ...over,
});

describe('что берёт вор', () => {
  it('первым — самое дорогое на полках в зале, дальше — что хотел, без повторов и не больше двух', () => {
    const s = shop();
    const picks = thiefPicks(s, ['bread', 'meat', 'apples', 'bread']);
    expect(picks[0]).toBe('meat');
    expect(picks).toEqual(['meat', 'bread']);
    expect(picks.length).toBeLessThanOrEqual(MAX_PICKS);
  });

  it('ларь у кассы на виду — мороженое не берёт, даже самое дорогое', () => {
    const s = shop({ prices: { ...newGame().prices, icecream: 999 } });
    const picks = thiefPicks(s, ['icecream', 'apples']);
    expect(picks).not.toContain('icecream');
    expect(picks[0]).toBe('meat');
  });

  it('по цене магазина, а не по каталогу: подняли цену хлеба — вор идёт за хлебом', () => {
    const s = shop({ prices: { ...newGame().prices, bread: 400 } });
    expect(thiefPicks(s, [])[0]).toBe('bread');
  });

  it('пустых полок не трогает; красть нечего — пусто', () => {
    const empty = shop({ shelves: shop().shelves.map((sh) => ({ ...sh, items: {} })) });
    expect(thiefPicks(empty, ['bread', 'meat'])).toEqual([]);
    const onlyBread = shop({ shelves: [{ kind: 'bakery', level: 0, items: { bread: fresh(1) } }, { kind: 'meat', level: 0, items: {} }] });
    expect(thiefPicks(onlyBread, ['meat'])).toEqual(['bread']);
  });

  it('детерминированно: одно и то же состояние — один и тот же выбор', () => {
    expect(thiefPicks(shop(), ['apples', 'bread'])).toEqual(thiefPicks(shop(), ['apples', 'bread']));
  });
});

describe('поймал или обидел', () => {
  it('вор пойман хозяином — награда в кассу, ровно OWNER_BOUNTY', () => {
    const s = shop({ money: 123 });
    expect(catchBounty(s).money).toBe(123 + OWNER_BOUNTY);
    expect(OWNER_BOUNTY).toBeGreaterThan(0);
    expect(OWNER_BOUNTY).toBeLessThanOrEqual(50);
  });

  it('честный обижен: ушёл без покупки и с жалобой', () => {
    const stats = emptyDayStats();
    offend(stats);
    expect(stats.lost).toBe(1);
    expect(stats.complaints).toBe(1);
    offend(stats);
    expect(stats.lost).toBe(2);
  });

  it('минус к рейтингу — небольшой и всегда один и тот же', () => {
    const base = { ...emptyDayStats(), served: 30 };
    const hurt = { ...emptyDayStats(), served: 30 };
    offend(hurt);
    const drop = satisfaction(base) - satisfaction(hurt);
    expect(drop).toBeGreaterThan(0);
    expect(drop).toBeLessThan(0.06);
    const s = shop({ rating: 3.5 });
    const ok = endDay(s, base).state.rating;
    const bad = endDay(s, hurt).state.rating;
    expect(ok - bad).toBeGreaterThan(0);
    expect(ok - bad).toBeLessThanOrEqual(0.03);
    // Тот же день — тот же итог: никакого случая.
    expect(endDay(s, hurt).state.rating).toBe(bad);
  });
});

describe('помощники и учёба', () => {
  it('камеры: без них приметы как есть, с ними — заметнее; игрок ловит чаще', () => {
    expect(camTells(shop())).toBe(0);
    expect(camTells(shop({ gear: { cameras: 1 } }))).toBe(1);
    expect(camTells(shop({ gear: { cameras: 2 } }))).toBe(2);
    expect(ownerCatch(shop())).toBe(OWNER_CATCH[0]);
    expect(ownerCatch(shop({ gear: { cameras: 2 } }))).toBeGreaterThan(ownerCatch(shop({ gear: { cameras: 1 } })));
    expect(ownerCatch(shop({ gear: { cameras: 1 } }))).toBeGreaterThan(ownerCatch(shop()));
  });

  it('учебный воришка подсвечен, пока игрок не поймал ни одного — ни раньше, ни сегодня', () => {
    const s = shop();
    expect(trainingThief(s, 0)).toBe(true);
    expect(trainingThief(s, 1)).toBe(false);
    expect(trainingThief({ ...s, lifetime: { ...s.lifetime, caught: 3 } }, 0)).toBe(false);
  });

  it('старое сохранение без счётчиков — не падает и считается «ещё не ловил»', () => {
    const old = { ...shop() } as Partial<StoreState>;
    delete old.lifetime;
    delete old.gear;
    delete old.seenTips;
    expect(trainingThief(old as StoreState, 0)).toBe(true);
    expect(camTells(old as StoreState)).toBe(0);
    expect(ownerCatch(old as StoreState)).toBe(OWNER_CATCH[0]);
    expect(() => thiefPicks(old as StoreState, ['bread'])).not.toThrow();
  });
});

describe('карточка «Новое!»', () => {
  const seenAll = ['broke', 'ownerTill', 'alone', 'weekly', 'fair', 'loyalty', 'delivery', 'register2', 'oven', 'coffee', 'nightShift'];

  it('старому игроку — в первое же утро после обновления, один раз', () => {
    const s = shop({ day: 40, seenTips: seenAll });
    expect(pendingTip(s)).toBe('thief');
    expect(pendingTip(seeTip(s, 'thief'))).toBeNull();
  });

  it('новичку — не в тихие дни (воров нет), а в первый день, когда воры приходят', () => {
    const newbie = (day: number) => shop({ day, onboarding: 'play', seenTips: seenAll });
    expect(pendingTip(newbie(2))).toBeNull();
    expect(pendingTip(newbie(3))).toBeNull();
    expect(pendingTip(newbie(4))).toBe('thief');
  });
});

describe('симулятор', () => {
  it('идёт как прежде и повторяется: тот же сид — тот же итог; воров ловят', () => {
    const a = simulate({ days: 40, seed: 5 });
    const b = simulate({ days: 40, seed: 5 });
    expect(a.days.map((d) => d.money)).toEqual(b.days.map((d) => d.money));
    expect(a.days.at(-1)!.money).toBeGreaterThan(0);
    expect(a.final.lifetime.caught).toBeGreaterThan(0);
  });
});
