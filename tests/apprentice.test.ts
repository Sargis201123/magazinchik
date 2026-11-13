import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cashierScan, newGame, type StaffMember, type StoreState } from '../src/game/economy';
import {
  APPR_ASK_AGAIN,
  APPR_FROM_DAY,
  APPR_MAX,
  APPR_NAMES,
  APPR_NEXT,
  apprDay,
  apprGuests,
  apprNews,
  apprNight,
  apprOffer,
  apprPatience,
  apprScan,
  apprStockPace,
  apprSupplies,
  apprTipChance,
  apprTipped,
  apprWorry,
  canPraise,
  declineAppr,
  FRIEND_GUESTS,
  FRIEND_SUPPLIES,
  gradToday,
  nextApprName,
  praiseAppr,
  RIVAL_GUESTS,
  SEASON,
  seeApprNews,
  setApprPay,
  setApprPost,
  STIPEND,
  takeAppr,
  TRUST_BORED,
  TRUST_NEW,
  TRUST_PAID,
  TRUST_PRAISE,
  TRUST_REST,
  TRUST_START,
  TRUST_TIRED,
  TRUST_UNPAID,
  type ApprGrad,
  type ApprPost,
} from '../src/game/apprentice';
import { withUpgrades } from '../src/game/upgrades';
import { supplierDiscount } from '../src/game/suppliers';
import { guestFactor, nightCycle } from '../src/game/day';
import { emptyDayStats } from '../src/game/economy';
import { pendingTip } from '../src/game/tips';
import { pickNews } from '../src/game/headlines';
import { simulate } from '../src/game/simulate';

// Ученик (13.11, задача #51): берут подростка, ставят на кассу, склад или в зал — растёт то, чему учат;
// стипендия, похвала и выходные копят доверие; через сезон — своя лавка, друг или конкурент.

const cashier: StaffMember = { role: 'cashier', name: 0, skill: 2, wage: 420, months: 0 };
const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 30, level: 1, money: 5000, seed: 7, staff: [cashier], ...over });
const taken = (over: Partial<StoreState> = {}): StoreState => takeAppr(shop(over));

/** Прожить n дней учёбы: утром — где сегодня (post(день)), ночью — apprNight; день идёт дальше. */
function live(state: StoreState, days: number, post: (i: number, s: StoreState) => ApprPost, morning?: (s: StoreState) => StoreState): StoreState {
  let s = state;
  for (let i = 0; i < days && s.appr; i++) {
    s = setApprPost(s, post(i, s))!;
    if (morning) s = morning(s);
    s = { ...apprNight(s, 3), day: s.day + 1 };
  }
  return s;
}

describe('предложение', () => {
  it('просится, когда магазин подрос, персонал есть и уже не первые дни', () => {
    expect(apprOffer(shop())).toBe(true);
    expect(apprOffer(shop({ level: 0 }))).toBe(false);
    expect(apprOffer(shop({ staff: [] }))).toBe(false);
    expect(apprOffer(shop({ day: APPR_FROM_DAY - 1 }))).toBe(false);
    expect(apprOffer(shop({ zar: { at: 'zar' } as StoreState['zar'] }))).toBe(false);
    expect(apprOffer(taken())).toBe(false);
  });

  it('«Не сейчас» — спросит снова через APPR_ASK_AGAIN дней', () => {
    const s = declineAppr(shop());
    expect(apprOffer(s)).toBe(false);
    expect(apprOffer({ ...s, day: s.day + APPR_ASK_AGAIN - 1 })).toBe(false);
    expect(apprOffer({ ...s, day: s.day + APPR_ASK_AGAIN })).toBe(true);
  });

  it('взяли: имя от зерна магазина, на кассе, доверие с середины; отказ забыт', () => {
    const s = takeAppr(declineAppr(shop()));
    expect(s.appr).toMatchObject({ post: 'till', trust: TRUST_START, since: 30, skill: {} });
    expect(s.apprAsk).toBeUndefined();
    expect(s.appr!.name).toBe(nextApprName(shop()));
    expect(takeAppr(shop()).appr!.name).toBe(takeAppr(shop()).appr!.name);
    expect(s.appr!.name).toBeGreaterThanOrEqual(0);
    expect(s.appr!.name).toBeLessThan(APPR_NAMES);
    // Уже есть ученик — второй раз не берём.
    expect(takeAppr(s)).toBe(s);
  });

  it('у каждого следующего ученика — другое имя', () => {
    const names = new Set<number>();
    let s = shop();
    for (let i = 0; i < APPR_MAX; i++) {
      names.add(nextApprName(s));
      s = { ...s, apprGrads: [...(s.apprGrads ?? []), { name: nextApprName(s), spec: 'till', friend: true, day: 1, seen: true }] };
    }
    expect(names.size).toBe(APPR_MAX);
  });
});

describe('ночь: стипендия, доверие, навык', () => {
  it('рабочий день: стипендия из кассы, доверие растёт, навык места +1, дела копятся', () => {
    const s = taken();
    const n = apprNight(s, 12);
    expect(n.money).toBe(s.money - STIPEND);
    expect(n.appr!.trust).toBe(TRUST_START + TRUST_PAID);
    expect(n.appr!.skill.till).toBe(1);
    expect(n.appr!.deeds?.till).toBe(12);
    expect(n.appr!.paid).toBe(STIPEND);
    expect(n.appr!.worked).toBe(1);
  });

  it('не платить (или нечем) — денег не берёт, но доверие падает', () => {
    const off = setApprPay(taken(), false)!;
    expect(off.appr!.unpaid).toBe(true);
    expect(apprWorry(off)).toBe('unpaid');
    const n = apprNight(off);
    expect(n.money).toBe(off.money);
    expect(n.appr!.trust).toBe(TRUST_START - TRUST_UNPAID);
    const broke = apprNight(taken({ money: STIPEND - 1 }));
    expect(broke.money).toBe(STIPEND - 1);
    expect(broke.appr!.trust).toBe(TRUST_START - TRUST_UNPAID);
    expect(setApprPay(off, true)!.appr!.unpaid).toBeUndefined();
  });

  it('одно и то же место изо дня в день — скучно; подсказка предупреждает заранее', () => {
    let s = live(taken(), 3, () => 'till');
    expect(s.appr!.trust).toBe(TRUST_START + 3 * TRUST_PAID);
    expect(apprWorry(s)).toBe('bored');
    // Сменил место — уже не скучно, и новое место в радость.
    expect(apprWorry(setApprPost(s, 'floor')!)).toBeNull();
    expect(live(s, 1, () => 'floor').appr!.trust).toBe(TRUST_START + 4 * TRUST_PAID + TRUST_NEW);
    s = live(s, 1, () => 'till');
    expect(s.appr!.trust).toBe(TRUST_START + 4 * TRUST_PAID - TRUST_BORED);
  });

  it('неделя без выходного — устаёт; выходной после работы радует и всё сбрасывает', () => {
    const order: ApprPost[] = ['till', 'stock', 'floor'];
    // Каждое новое место после вчерашнего — ещё и +TRUST_NEW (первый день не в счёт: вчера его не было).
    let s = live(taken(), 6, (i) => order[i % 3]);
    expect(s.appr!.trust).toBe(TRUST_START + 6 * TRUST_PAID + 5 * TRUST_NEW);
    expect(apprWorry(s)).toBe('tired');
    const tired = live(s, 1, () => 'till');
    expect(tired.appr!.trust).toBe(TRUST_START + 7 * TRUST_PAID + 6 * TRUST_NEW - TRUST_TIRED);
    s = live(s, 1, () => 'rest');
    expect(s.appr!.trust).toBe(TRUST_START + 6 * TRUST_PAID + 5 * TRUST_NEW + TRUST_REST);
    expect(s.appr!.worked).toBeUndefined();
    expect(s.appr!.same).toBeUndefined();
    // Выходной денег не стоит и ничему не учит.
    expect(s.appr!.paid).toBe(6 * STIPEND);
  });

  it('выходной без работы — скучает без дела', () => {
    const s = setApprPost(taken(), 'rest')!;
    expect(apprWorry(s)).toBe('idle');
    expect(apprNight(s).appr!.trust).toBeLessThan(TRUST_START);
  });

  it('похвала — не чаще раза в три дня', () => {
    const s = praiseAppr(taken())!;
    expect(s.appr!.trust).toBe(TRUST_START + TRUST_PRAISE);
    expect(canPraise(s)).toBe(false);
    expect(praiseAppr(s)).toBeNull();
    expect(praiseAppr({ ...s, day: s.day + 2 })).toBeNull();
    expect(praiseAppr({ ...s, day: s.day + 3 })).not.toBeNull();
    expect(praiseAppr(shop())).toBeNull();
  });

  it('доверие не выходит за 0…100', () => {
    const neglected = live(setApprPay(taken(), false)!, 20, () => 'till');
    expect(neglected.appr!.trust).toBe(0);
    const loved = live(taken(), 20, (i) => (i % 4 === 3 ? 'rest' : (['till', 'stock', 'floor'] as const)[i % 3]), (s) => praiseAppr(s) ?? s);
    expect(loved.appr!.trust).toBe(100);
  });

  it('без ученика ночь ничего не меняет', () => {
    const s = shop();
    expect(apprNight(s, 10)).toBe(s);
  });
});

describe('польза на месте', () => {
  it('касса: пробивка быстрее и растёт с навыком; на других местах и в Заречье — нет', () => {
    const s = taken();
    expect(apprScan(s)).toBeGreaterThan(1);
    const seasoned = { ...s, appr: { ...s.appr!, skill: { till: 20 } } };
    expect(apprScan(seasoned)).toBeGreaterThan(apprScan(s));
    expect(apprScan(seasoned)).toBeLessThanOrEqual(1.12);
    expect(withUpgrades(s, cashierScan(cashier)).item).toBeLessThan(withUpgrades(shop(), cashierScan(cashier)).item);
    expect(apprScan(setApprPost(s, 'floor')!)).toBe(1);
    expect(apprScan({ ...s, zar: { at: 'zar' } as StoreState['zar'] })).toBe(1);
  });

  it('зал: гости терпеливее, бывают чаевые «за помощь» — в кассу и в копилку ученика', () => {
    const s = setApprPost(taken(), 'floor')!;
    expect(apprPatience(s)).toBeGreaterThan(1);
    expect(apprTipChance(s)).toBeGreaterThan(0);
    expect(apprTipChance(taken())).toBe(0);
    expect(apprPatience(taken())).toBe(1);
    const tipped = apprTipped(s, 5);
    expect(tipped.money).toBe(s.money + 5);
    expect(tipped.appr!.tips).toBe(5);
    expect(apprTipped(shop(), 5)).toEqual(shop());
  });

  it('склад: сам носит коробки — медленнее грузчика, к концу учёбы быстрее', () => {
    const s = setApprPost(taken(), 'stock')!;
    expect(apprStockPace(taken())).toBe(0);
    expect(apprStockPace(s)).toBeLessThan(1);
    expect(apprStockPace({ ...s, appr: { ...s.appr!, skill: { stock: 20 } } })).toBeGreaterThan(1);
  });
});

describe('выпуск через сезон', () => {
  const rotate = (i: number): ApprPost => (i % 7 === 6 ? 'rest' : (['till', 'stock', 'till', 'floor', 'till', 'stock'] as const)[i % 6]);

  it('учили по-доброму — друг; кем вырос — чему учили больше всего', () => {
    const s = live(taken(), SEASON, rotate);
    expect(s.appr).toBeUndefined();
    const g = s.apprGrads![0];
    expect(g).toMatchObject({ friend: true, spec: 'till', day: 30 + SEASON - 1 });
    expect(apprNews(s)).toEqual(g);
    // Следующий ученик — не сразу.
    expect(apprOffer(s)).toBe(false);
    expect(apprOffer({ ...s, day: g.day + APPR_NEXT })).toBe(true);
    // Друг с кассы шлёт гостей.
    expect(apprGuests(s)).toBeCloseTo(1 + FRIEND_GUESTS);
    expect(apprSupplies(s)).toBe(0);
  });

  it('держали на одном месте без денег и выходных — конкурент, гостей меньше', () => {
    const s = live(setApprPay(taken(), false)!, SEASON, () => 'floor');
    const g = s.apprGrads![0];
    expect(g).toMatchObject({ friend: false, spec: 'floor' });
    expect(apprGuests(s)).toBeCloseTo(1 - RIVAL_GUESTS);
    expect(guestFactor(s)).toBeLessThan(guestFactor({ ...s, apprGrads: undefined }));
  });

  it('друг со склада берёт товар вскладчину: поставки дешевле', () => {
    const grads: ApprGrad[] = [{ name: 1, spec: 'stock', friend: true, day: 10, seen: true }];
    const s = shop({ apprGrads: grads });
    expect(apprSupplies(s)).toBe(FRIEND_SUPPLIES);
    expect(supplierDiscount(s)).toBeCloseTo(supplierDiscount(shop()) + FRIEND_SUPPLIES);
    expect(apprGuests(s)).toBe(1);
  });

  it('утренняя история — один раз; потом раз в неделю весточка', () => {
    const s = live(taken(), SEASON, rotate);
    const seen = seeApprNews(s);
    expect(apprNews(seen)).toBeNull();
    const g = seen.apprGrads![0];
    expect(gradToday({ ...seen, day: g.day + 1 })).toBeNull();
    expect(gradToday({ ...seen, day: g.day + 7 })).toEqual(g);
    expect(gradToday({ ...seen, day: g.day + 8 })).toBeNull();
  });

  it('больше APPR_MAX лавок на улице не открыть', () => {
    const grads: ApprGrad[] = Array.from({ length: APPR_MAX }, (_, i) => ({ name: i, spec: 'till', friend: true, day: 1, seen: true }));
    expect(apprOffer(shop({ apprGrads: grads }))).toBe(false);
  });

  it('всё детерминировано: одинаковые решения — одинаковый итог', () => {
    const a = live(taken(), SEASON, rotate);
    const b = live(taken(), SEASON, rotate);
    expect(a).toEqual(b);
  });

  it('день учёбы считается с первого', () => {
    const s = taken();
    expect(apprDay(s)).toBe(1);
    expect(apprDay({ ...s, day: s.day + 5 })).toBe(6);
    expect(apprDay(shop())).toBe(0);
  });
});

describe('вместе с игрой', () => {
  it('ночь дня: стипендия и навык проходят через nightCycle, дела дня — из статистики', () => {
    const s = taken({ day: 40 });
    const stats = { ...emptyDayStats(), appr: 9 };
    const n = nightCycle(s, stats, () => 0.5).state;
    expect(n.appr!.skill.till).toBe(1);
    expect(n.appr!.deeds?.till).toBe(9);
    expect(n.appr!.paid).toBe(STIPEND);
  });

  it('карточка «Новое!» — когда ученик появился; история утра встаёт в общую очередь', () => {
    const s = taken();
    expect(pendingTip({ ...s, seenTips: ['broke', 'ownerTill', 'alone', 'weekly', 'fair', 'loyalty', 'delivery', 'register2', 'oven', 'coffee', 'nightShift', 'pawn', 'case', 'rhythm', 'echo', 'thief'] })).toBe('appr');
    expect(pickNews(shop(), ['appr', 'apprOut']).id).toBe('apprOut');
  });

  it('симулятор с учеником идёт и баланс не ломает', () => {
    for (const seed of [1, 2]) {
      const base = simulate({ days: 100, seed });
      const r = simulate({ days: 100, seed, features: { apprentice: true } });
      expect(r.final.apprGrads?.length ?? 0).toBeGreaterThan(0);
      expect(r.final.apprGrads!.every((g) => g.friend)).toBe(true);
      const m = r.days[r.days.length - 1].money;
      const b = base.days[base.days.length - 1].money;
      expect(m).toBeGreaterThan(b * 0.85);
      expect(m).toBeLessThan(b * 1.4);
    }
  }, 60_000);
});

describe('старые сохранения', () => {
  let local: Record<string, string> = {};
  beforeEach(() => {
    vi.resetModules();
    local = {};
    Object.assign(globalThis, {
      localStorage: { getItem: (k: string) => local[k] ?? null, setItem: (k: string, v: string) => (local[k] = v), removeItem: (k: string) => delete local[k] },
    });
  });
  afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

  it('сохранение без ученика грузится как было: ученика нет, предложение придёт', async () => {
    const { loadGame } = await import('../src/game/save');
    const old = shop() as unknown as Record<string, unknown>;
    delete old.appr;
    delete old.apprGrads;
    delete old.apprAsk;
    local['magazinchik.save'] = JSON.stringify({ version: 11, state: old });
    const s = loadGame()!;
    expect(s.appr).toBeUndefined();
    expect(s.apprGrads).toBeUndefined();
    expect(apprGuests(s)).toBe(1);
    expect(apprScan(s)).toBe(1);
    expect(apprOffer(s)).toBe(true);
  });

  it('ученик и выпускники переживают сохранение', async () => {
    const { loadGame, saveGame } = await import('../src/game/save');
    const s = { ...live(taken(), 5, () => 'stock'), apprGrads: [{ name: 2, spec: 'floor', friend: false, day: 3, seen: true }] as ApprGrad[] };
    saveGame(s);
    const back = loadGame()!;
    expect(back.appr).toEqual(s.appr);
    expect(back.apprGrads).toEqual(s.apprGrads);
  });
});
