import { describe, expect, it } from 'vitest';
import { emptyDayStats, newGame, PRODUCTS, type StoreState } from '../src/game/economy';
import { CANDY_COST, impulseChance, rackOf, refillRack, returnCandy, takeCandy, upgradeRack, RACK_LEVELS } from '../src/game/impulse';
import { buyCups, coffeeChance, CUP_COST, CUPS_MAX, useCup } from '../src/game/coffee';
import { startBatch, takeOutBread } from '../src/game/bakery';
import { OVEN_BATCHES, FLOUR_PER_LOAF } from '../src/game/gear';
const OVEN_BATCH = OVEN_BATCHES[0];
const OVEN_BATCH_COST = OVEN_BATCH * FLOUR_PER_LOAF;
import { activeWar, answerWar, endWar, makeWar, warDemand, warLeaves, WAR_LEAVE, WAR_WIN } from '../src/game/war';
import { adoptCat, buyBed, CAT_AWAY_DAYS, catAway, catLuck, catOffer, catPatience, catTipChance, CAT_FROM_DAY, declineCat, feedCat, FEED_COST } from '../src/game/cat';
import { note, reviewsFor, isGood } from '../src/game/reviews';
import { WEATHER_EFFECTS, weatherDemand, weatherFor } from '../src/game/weather';
import { yearTime } from '../src/game/calendar';
import { startNight, NIGHT_POWER } from '../src/game/night';
import { pickWanted } from '../src/game/endless';
import { nightCycle } from '../src/game/day';
import { planDay } from '../src/game/events';

const rich = (patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), money: 10000, level: 3, ...patch });

describe('сладости у кассы', () => {
  it('стойку пополняют до вместимости, шанс растёт с очередью', () => {
    const s = refillRack(rich(), 100)!;
    expect(rackOf(s).stock).toBe(RACK_LEVELS[0].capacity);
    expect(s.money).toBe(10000 - (RACK_LEVELS[0].capacity - 6) * CANDY_COST);
    expect(impulseChance(s, 3)).toBeGreaterThan(impulseChance(s, 0));
    expect(refillRack(s, 5)).toBeNull();
  });

  it('пустая стойка — никто не берёт; взяли и вернули', () => {
    const empty = rich({ rack: { level: 0, stock: 0 } });
    expect(impulseChance(empty, 5)).toBe(0);
    expect(takeCandy(empty)).toBeNull();
    const s = takeCandy(rich())!;
    expect(rackOf(s).stock).toBe(5);
    expect(rackOf(returnCandy(s)).stock).toBe(6);
  });

  it('стойка улучшается за деньги до максимума', () => {
    let s = upgradeRack(rich())!;
    s = upgradeRack(s)!;
    expect(rackOf(s).level).toBe(2);
    expect(upgradeRack(s)).toBeNull();
  });
});

describe('кофе', () => {
  it('без кофейни, бариста и стаканчиков кофе не берут', () => {
    const barista = [{ role: 'barista' as const, name: 0, skill: 2, wage: 360, months: 0 }];
    expect(coffeeChance(rich({ cups: 10, staff: barista }))).toBe(0);
    expect(coffeeChance(rich({ upgrades: ['coffee'], cups: 0, staff: barista }))).toBe(0);
    expect(coffeeChance(rich({ upgrades: ['coffee'], cups: 5 }))).toBe(0);
    expect(coffeeChance(rich({ upgrades: ['coffee'], cups: 5, staff: barista }))).toBeGreaterThan(0);
  });

  it('стаканчики докупают до предела', () => {
    const s = buyCups(rich(), 1000)!;
    expect(s.cups).toBe(CUPS_MAX);
    expect(s.money).toBe(10000 - CUPS_MAX * CUP_COST);
    expect(useCup(s)!.cups).toBe(CUPS_MAX - 1);
    expect(useCup(rich())).toBeNull();
  });
});

describe('печь', () => {
  it('закладка стоит денег, хлеб идёт на полки, излишек — на склад', () => {
    expect(startBatch(rich({ money: 10 }))).toBeNull();
    const s = startBatch(rich())!;
    expect(s.money).toBe(10000 - OVEN_BATCH_COST);
    const out = takeOutBread(s);
    // На хлебной полке новой игры 4 из 8 — 4 места.
    expect(out.onShelves).toBe(4);
    expect(out.state.shelves[0].items.bread).toHaveLength(8);
    expect(out.state.warehouse.bread).toHaveLength((s.warehouse.bread?.length ?? 0) + OVEN_BATCH - 4);
  });

  it('нельзя печь, если хлеб некуда положить', () => {
    const full = rich({ warehouse: { potatoes: Array.from({ length: 80 }, () => ({ age: 0 })) } });
    const shelves = full.shelves.map((sh) => (sh.kind === 'bakery' ? { ...sh, items: { bread: Array.from({ length: 8 }, () => ({ age: 0 })) } } : sh));
    expect(startBatch({ ...full, shelves })).toBeNull();
  });
});

describe('ценовая война', () => {
  const at = rich({ day: 20 });
  const war = makeWar(at, () => 0)!;

  it('Эдуард продаёт дешевле базовой цены', () => {
    expect(war.price).toBeLessThan(PRODUCTS[war.product].basePrice);
  });

  it('переждать — покупатели уходят к Эдуарду; сравнять — берут чаще, а цена потом возвращается', () => {
    const waited = answerWar(at, war, 'wait')!;
    expect(warLeaves(waited, war.product)).toBe(WAR_LEAVE);
    expect(warDemand(waited, war.product)).toBe(1);
    const matched = answerWar(at, war, 'match')!;
    expect(matched.prices[war.product]).toBe(war.price);
    expect(warDemand(matched, war.product)).toBe(WAR_WIN);
    expect(warLeaves(matched, war.product)).toBe(0);
    const after = endWar({ ...matched, day: matched.war!.until + 1 });
    expect(after.war).toBeUndefined();
    expect(after.prices[war.product]).toBe(at.prices[war.product]);
    expect(activeWar({ ...matched, day: matched.war!.until + 1 })).toBeUndefined();
  });

  it('реклама стоит денег и смягчает войну', () => {
    const ad = answerWar(at, war, 'ad')!;
    expect(ad.money).toBeLessThan(at.money);
    expect(warLeaves(ad, war.product)).toBeLessThan(WAR_LEAVE);
    expect(answerWar({ ...at, money: 0 }, war, 'ad')).toBeNull();
  });

  it('война бывает в планах дня и не раньше нужного дня', () => {
    const days = Array.from({ length: 400 }, (_, i) => i + 1);
    const wars = days.filter((day) => planDay(rich({ day })).event?.kind === 'priceWar');
    expect(wars.length).toBeGreaterThan(0);
    expect(Math.min(...wars)).toBeGreaterThanOrEqual(12);
  });

  it('pickWanted учитывает спрос дня', () => {
    const s = rich({ day: 20 });
    const picks = Array.from({ length: 200 }, (_, i) => pickWanted(s, () => (i % 100) / 100, 1, (id) => (id === 'milk' ? 0 : 1))[0]);
    expect(picks).not.toContain('milk');
  });
});

describe('кот', () => {
  it('предлагают с нужного дня, отказ откладывает на неделю', () => {
    expect(catOffer(rich({ day: CAT_FROM_DAY - 1 }))).toBe(false);
    const s = rich({ day: CAT_FROM_DAY });
    expect(catOffer(s)).toBe(true);
    expect(catOffer(declineCat(s))).toBe(false);
    expect(catOffer({ ...declineCat(s), day: CAT_FROM_DAY + 7 })).toBe(true);
  });

  it('сытый кот приносит удачу, голодный — меньше, ушедший — нет', () => {
    const s = adoptCat(rich({ day: 10 }), '  Барсик  ');
    expect(s.cat!.name).toBe('Барсик');
    expect(catLuck(s)).toBeGreaterThan(0);
    expect(catPatience(s)).toBeGreaterThan(1);
    expect(catTipChance(s)).toBeGreaterThan(0);
    const tomorrow = { ...s, day: 11 };
    expect(catLuck(tomorrow)).toBeLessThan(catLuck(s));
    expect(catLuck(tomorrow)).toBeGreaterThan(0);
    const away = { ...s, day: 10 + CAT_AWAY_DAYS };
    expect(catAway(away)).toBe(true);
    expect(catLuck(away)).toBe(0);
    expect(catPatience(away)).toBe(1);
    const fed = feedCat(away)!;
    expect(fed.money).toBe(away.money - FEED_COST);
    expect(catAway(fed)).toBe(false);
    expect(feedCat(fed)).toBeNull();
  });

  it('лежанка добавляет удачи', () => {
    const s = adoptCat(rich({ day: 10 }), 'Мурзик');
    const bed = buyBed(s, 'house')!;
    expect(catLuck(bed)).toBeGreaterThan(catLuck(s));
    expect(buyBed(bed, 'house')).toBeNull();
  });
});

describe('отзывы', () => {
  it('тихий день — один нейтральный отзыв', () => {
    expect(reviewsFor(emptyDayStats(), 5).map((r) => r.topic)).toEqual(['quiet']);
  });

  it('плохое и хорошее вперемешку, не больше трёх, звёзды по смыслу', () => {
    const stats = { ...emptyDayStats(), served: 20, bestCombo: 6 };
    note(stats, 'queue', 3);
    note(stats, 'noStock', 4);
    note(stats, 'cat');
    const reviews = reviewsFor(stats, 7);
    expect(reviews).toHaveLength(3);
    // Очередь (3 ухода) заметнее пустых полок (4 раза при пороге 2).
    expect(reviews.map((r) => r.topic)).toEqual(['queue', 'fast', 'noStock']);
    for (const r of reviews) expect(isGood(r.topic) ? r.stars >= 4 : r.stars <= 2).toBe(true);
    expect(new Set(reviews.map((r) => r.author)).size).toBe(3);
  });

  it('вечером отзывы сохраняются в состоянии игры не ломая ночь', () => {
    const night = nightCycle(rich({ day: 5 }), emptyDayStats(), () => 0.5);
    expect(night.state.day).toBe(6);
  });
});

describe('погода и спрос', () => {
  const days = Array.from({ length: 800 }, (_, i) => i + 1);

  it('жара бывает только летом', () => {
    const hot = days.filter((d) => weatherFor(d) === 'heat');
    expect(hot.length).toBeGreaterThan(0);
    for (const d of hot) expect(yearTime(d)).toBe('summer');
  });

  it('в дождь хлеб берут чаще, в жару — мороженое', () => {
    expect(weatherDemand('rain', 'bread')).toBeGreaterThan(1);
    expect(weatherDemand('heat', 'icecream')).toBeGreaterThan(1);
    expect(weatherDemand('clear', 'meat')).toBe(1);
    expect(WEATHER_EFFECTS.storm.guests).toBeLessThan(1);
  });
});

describe('ночная смена', () => {
  it('только с улучшением и за свет', () => {
    expect(startNight(rich())).toBeNull();
    const s = startNight(rich({ upgrades: ['nightShift'] }))!;
    expect(s.money).toBe(10000 - NIGHT_POWER);
  });
});
