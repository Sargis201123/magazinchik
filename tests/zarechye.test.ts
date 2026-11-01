import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { billTotal, emptyDayStats, HYPER_LEVEL, monthlyBill, newGame, nextStoreLevel, STORE_LEVELS, type StoreState } from '../src/game/economy';
import {
  buyZar,
  homeShop,
  inZar,
  normalizeZar,
  seeZarBoss,
  seeZarTale,
  SHOP_KEYS,
  switchDistrict,
  switchToday,
  zarBillShare,
  zarBossMorning,
  zarBossNews,
  zarCardDue,
  zarDemand,
  zarDuelNight,
  zarDuelToday,
  zarLater,
  zarLock,
  ZAR_BOSS,
  ZAR_DUEL_FISH,
  ZAR_DUEL_STAGE,
  ZAR_LEVEL_COST,
  ZAR_MAX_LEVEL,
  ZAR_MEET,
  ZAR_PRICE,
  zarShop,
  zarTaleToday,
} from '../src/game/zarechye';
import { regularsToday, ZAR_REGULARS, REGULARS } from '../src/game/regulars';
import { nightCycle } from '../src/game/day';
import { branchRef, branchIncome } from '../src/game/branch';

// «Заречье» (zarechye.ts): второй магазин за рекой после финала и гипермаркета. Два магазина в одном
// состоянии — срез второго в zar.away; переключение туда и обратно ничего не теряет; старые сохранения
// не меняются; счета — по дням; Центр без игрока торгует как филиал.

/** Поздняя игра: финал пройден, Центр — гипермаркет с неделей выручки, филиал есть, денег много. */
function lateGame(): StoreState {
  const g = newGame();
  return {
    ...g,
    day: 200,
    money: 200000,
    debt: 0,
    level: HYPER_LEVEL,
    rating: 4.8,
    history: [20000, 21000, 19000, 22000, 20000, 18000, 20500],
    contest: { wins: 1 } as StoreState['contest'],
    branch: { since: 150, tiers: { shelves: 1 }, earned: 0, moved: 160 },
    story: { ...g.story, chapter: 5, introSeen: true },
  };
}

describe('открытие Заречья', () => {
  it('закрыто до финала и до гипермаркета; потом — карточка от города', () => {
    const before = { ...lateGame(), contest: undefined };
    expect(zarLock(before)).toBe('finale');
    expect(zarLock({ ...lateGame(), level: HYPER_LEVEL - 1 })).toBe('hyper');
    expect(zarCardDue(lateGame())).toBe(true);
    // «Потом» — карточка уходит на две недели, Заречье остаётся в «Развитии».
    const later = zarLater(lateGame());
    expect(zarCardDue(later)).toBe(false);
    expect(zarCardDue({ ...later, day: later.day + 14 })).toBe(true);
  });

  it('открытие стоит денег, ничего не сбрасывает и оставляет игрока в Центре', () => {
    const s = lateGame();
    const opened = buyZar(s)!;
    expect(opened.money).toBe(s.money - ZAR_PRICE);
    expect(opened.level).toBe(HYPER_LEVEL);
    expect(opened.history).toEqual(s.history);
    expect(inZar(opened)).toBe(false);
    expect(zarShop(opened)!.level).toBe(0);
    expect(buyZar({ ...s, money: ZAR_PRICE - 1 })).toBeNull();
    expect(buyZar({ ...s, debt: 100 })).toBeNull();
    expect(buyZar(opened)).toBeNull();
  });
});

describe('два магазина в одном состоянии', () => {
  it('переключение туда и обратно возвращает состояние как было', () => {
    const opened = buyZar(lateGame())!;
    const there = switchDistrict(opened, 'zar');
    expect(inZar(there)).toBe(true);
    expect(there.level).toBe(0);
    expect(homeShop(there).level).toBe(HYPER_LEVEL);
    expect(homeShop(there).history).toEqual(opened.history);
    // Деньги общие.
    expect(there.money).toBe(opened.money);
    const back = switchDistrict(there, 'home');
    expect(JSON.parse(JSON.stringify(back))).toEqual(JSON.parse(JSON.stringify(opened)));
  });

  it('поля, которых нет у одного магазина, не перетекают в другой', () => {
    const opened = buyZar({ ...lateGame(), upgrades: ['oven', 'coffee'], kiosks: { n: 2, tier: 1 } })!;
    const there = switchToday(opened, 'zar');
    expect(there.upgrades).toBeUndefined();
    expect(there.kiosks).toBeUndefined();
    expect(homeShop(there).upgrades).toEqual(['oven', 'coffee']);
    // У каждого магазина — свой план дня.
    expect(there.plan?.day).toBe(there.day);
    expect(switchToday(there, 'home').upgrades).toEqual(['oven', 'coffee']);
  });

  it('все поля магазина есть в состоянии', () => {
    const keys = new Set(Object.keys(newGame()));
    for (const k of ['level', 'staff', 'rating', 'warehouse', 'shelves', 'prices', 'history']) expect(keys.has(k)).toBe(true);
    expect(SHOP_KEYS).not.toContain('money');
    expect(SHOP_KEYS).not.toContain('zar');
  });

  it('лестница помещений в Заречье короче и своя по цене', () => {
    const there = switchDistrict(buyZar(lateGame())!, 'zar');
    expect(nextStoreLevel(there)!.cost).toBe(ZAR_LEVEL_COST[1]);
    expect(nextStoreLevel({ ...there, level: ZAR_MAX_LEVEL })).toBeUndefined();
    // В Центре — как раньше.
    expect(nextStoreLevel({ ...newGame(), level: 1 })!.cost).toBe(STORE_LEVELS[2].cost);
  });
});

describe('деньги двух магазинов', () => {
  it('без Заречья счёт не меняется', () => {
    const s = lateGame();
    expect(zarBillShare(s, 'home')).toBe(1);
    const bill = monthlyBill(s);
    expect(bill.rent).toBe(STORE_LEVELS[HYPER_LEVEL].rent);
  });

  it('каждый магазин платит за свои дни месяца', () => {
    const opened = buyZar({ ...lateGame(), day: 197 })!; // начало месяца: 196 = 7×28
    const s: StoreState = { ...switchDistrict(opened, 'zar'), day: 203, zar: { ...switchDistrict(opened, 'zar').zar!, days: { home: 3, zar: 3 } } };
    // Сегодня (7-й день) — в Заречье: 3 дня Центра и 4 дня Заречья.
    expect(zarBillShare(s, 'home')).toBeCloseTo(3 / 7);
    expect(zarBillShare(s, 'zar')).toBeCloseTo(4 / 7);
    const bill = monthlyBill(s);
    const full = STORE_LEVELS[HYPER_LEVEL].rent * (3 / 7) + STORE_LEVELS[0].rent * (4 / 7);
    expect(Math.abs(bill.rent - full)).toBeLessThanOrEqual(2);
    expect(billTotal(bill)).toBeLessThan(billTotal(monthlyBill(lateGame())));
  });

  it('пока игрок в Заречье, Центр приносит не меньше филиала, а филиал считает по Центру', () => {
    const there = switchToday(buyZar(lateGame())!, 'zar');
    expect(branchRef(there)).toBe(branchRef(lateGame()));
    const night = nightCycle(there, emptyDayStats(), () => 0.5);
    expect(night.home).toBeGreaterThanOrEqual(branchIncome(there, there.day));
    expect(night.state.zar!.homeEarned).toBe(night.home);
    expect(night.state.zar!.played).toBe(1);
    // В Центре дохода «без игрока» нет.
    expect(nightCycle(switchToday(there, 'home'), emptyDayStats(), () => 0.5).home).toBe(0);
  });
});

describe('свой район', () => {
  it('жители — свои, знакомятся по дням в Заречье; в Центре — прежние', () => {
    for (const r of ZAR_REGULARS) expect(ZAR_MEET[r.id as keyof typeof ZAR_MEET]).toBe(r.from);
    const there = switchToday(buyZar(lateGame())!, 'zar');
    const ids = regularsToday(there).map((r) => r.id);
    expect(ids.every((id) => ZAR_REGULARS.some((z) => z.id === id))).toBe(true);
    expect(ids).toContain('nina');
    expect(regularsToday(lateGame()).every((r) => REGULARS.some((z) => z.id === r.id))).toBe(true);
  });

  it('история жителя показывается по шагу, с наградой и паузой', () => {
    const there = switchToday(buyZar(lateGame())!, 'zar');
    const first = zarTaleToday(there)!;
    expect(first.tale.id).toBe('nina');
    const seen = seeZarTale(there, 'nina');
    expect(seen.zar!.tales!.nina).toBe(1);
    expect(zarTaleToday(seen)).toBeNull();
  });

  it('у реки рыба нужнее, в Центре спрос прежний', () => {
    const there = switchToday(buyZar(lateGame())!, 'zar');
    expect(zarDemand(there, 'fish')).toBeGreaterThan(1);
    expect(zarDemand(lateGame(), 'fish')).toBe(1);
  });

  it('Сом: знакомство, спор в субботу, мир — без наказаний за проигранный спор', () => {
    let s = switchToday(buyZar(lateGame())!, 'zar');
    s = { ...s, zar: { ...s.zar!, played: 2 } };
    s = zarBossMorning(s);
    expect(zarBossNews(s)!.stage).toBe(1);
    s = seeZarBoss(s);
    // Дошли до вызова: нужен минимаркет.
    s = { ...s, level: 1, zar: { ...s.zar!, played: 30, boss: { stage: ZAR_DUEL_STAGE - 1, since: 0, seen: ZAR_DUEL_STAGE - 1 } } };
    s = zarBossMorning(s);
    expect(s.zar!.boss!.stage).toBe(ZAR_DUEL_STAGE);
    const duelDay = s.zar!.boss!.duel!.at;
    expect(((duelDay - 1) % 7) + 1).toBe(6);
    // Субботу пропустили — спор переносится, деньги и рейтинг на месте.
    const money = s.money;
    const missed = zarBossMorning({ ...s, day: duelDay + 1 });
    expect(((missed.zar!.boss!.duel!.at - 1) % 7) + 1).toBe(6);
    expect(missed.zar!.boss!.duel!.at).toBeGreaterThan(duelDay);
    expect(missed.money).toBe(money);
    // Выиграли спор — наутро мир и награда.
    const duel = { ...s, day: duelDay };
    expect(zarDuelToday(duel)).toBe(true);
    const won = zarDuelNight(duel, ZAR_DUEL_FISH);
    const peace = zarBossMorning({ ...won, day: duelDay + 1 });
    expect(peace.zar!.boss!.stage).toBe(ZAR_DUEL_STAGE + 1);
    expect(peace.money).toBe(money + (ZAR_BOSS[ZAR_DUEL_STAGE].reward?.money ?? 0));
    expect(zarDemand({ ...peace, day: 210 }, 'fish')).toBeGreaterThan(zarDemand({ ...s, day: 210 }, 'fish'));
  });
});

describe('сохранения', () => {
  let local: Record<string, string> = {};
  beforeEach(() => {
    vi.resetModules();
    local = {};
    Object.assign(globalThis, { localStorage: { getItem: (k: string) => local[k] ?? null, setItem: (k: string, v: string) => (local[k] = v), removeItem: (k: string) => delete local[k] } });
  });
  afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

  it('старое сохранение без Заречья грузится как раньше', () => {
    const s = lateGame();
    expect(normalizeZar(s)).toBe(s);
  });

  it('оба магазина переживают сохранение, загрузку и переключение', async () => {
    const { loadGame, saveGame } = await import('../src/game/save');
    const mid = lateGame();
    const late = mid;
    const there = switchToday(buyZar(late)!, 'zar');
    saveGame(there);
    const loaded = loadGame()!;
    expect(inZar(loaded)).toBe(true);
    expect(homeShop(loaded).level).toBe(HYPER_LEVEL);
    expect(homeShop(loaded).shelves.length).toBe(mid.shelves.length);
    const home = switchToday(loaded, 'home');
    saveGame(home);
    const again = loadGame()!;
    expect(again.level).toBe(HYPER_LEVEL);
    expect(zarShop(again)!.level).toBe(0);
    // Два магазина — всё ещё в пределах облака Telegram с большим запасом (1024 ключа × 4000 знаков).
    expect(local['magazinchik.save'].length).toBeLessThan(60_000);
  });

  it('битый срез второго магазина дополняется', () => {
    const opened = buyZar(lateGame())!;
    const broken = { ...opened, zar: { ...opened.zar!, away: { level: 9 } } } as StoreState;
    const fixed = normalizeZar(broken);
    expect(fixed.zar!.away.level).toBe(ZAR_MAX_LEVEL);
    expect(fixed.zar!.away.shelves!.length).toBeGreaterThan(0);
    expect(fixed.zar!.away.prices!.bread).toBeGreaterThan(0);
  });
});

describe('после ревью', () => {
  it('прогноз счёта в начале месяца не занижен: оставшиеся дни — сегодняшнему магазину', () => {
    const opened = buyZar({ ...lateGame(), day: 197 })!;
    const there = switchDistrict(opened, 'zar');
    // Первый день месяца в Заречье: Центру — ни дня, Заречью — весь месяц вперёд.
    expect(zarBillShare(there, 'zar')).toBe(1);
    expect(zarBillShare(there, 'home')).toBe(0);
  });

  it('«новоселье» второго магазина кончается со счётом', async () => {
    const { payBill } = await import('../src/game/economy');
    const opened = buyZar(lateGame())!;
    const s = { ...opened, zar: { ...opened.zar!, away: { ...opened.zar!.away, level: 1, movedFrom: 0 } } };
    expect(payBill(s).state.zar!.away.movedFrom).toBeUndefined();
  });

  it('награды недели и письма считаются по Центру', async () => {
    const { letterCoins } = await import('../src/game/returns');
    const there = switchToday(buyZar(lateGame())!, 'zar');
    expect(letterCoins(there)).toBe(letterCoins(lateGame()));
  });

  it('спрос дня каждый магазин считает по своим дням', async () => {
    const { usualSales } = await import('../src/game/bakery');
    const row = (day: number, bread: number, zar?: boolean) => ({ day, revenue: 0, served: 0, lost: 0, sold: { bread }, spoiled: {}, pricey: {}, missing: {}, ...(zar ? { zar } : {}) });
    const there = switchToday(buyZar(lateGame())!, 'zar');
    const s = { ...there, reports: [row(1, 100), row(2, 4, true), row(3, 100), row(4, 6, true)] };
    expect(usualSales(s, 'bread')).toBe(5);
    expect(usualSales(switchToday(s, 'home'), 'bread')).toBe(100);
  });
});
