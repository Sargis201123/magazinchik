import { describe, expect, it } from 'vitest';
import { emptyDayStats, newGame, type ProductId, type StoreState } from '../src/game/economy';
import { answerOpening, BUILDINGS, buildingStage, districtDemand, districtGuest, districtGuests, districtKey, districtNews, districtSite, PLOTS, placedBuildings } from '../src/game/district';
import { CANDIDATES, DRIVERS, districtNight, pickForPlot, plotNews, plotPickOf, plotScores, plotSoon, seePlotNews, weekSold } from '../src/game/districtPlots';
import { nightCycle } from '../src/game/day';
import { NEWS_IDS, NEWS_KIND } from '../src/game/headlines';
import { pendingTip, TIP_ICONS, type TipId } from '../src/game/tips';
import type { DayReport } from '../src/game/reports';

// Неделя отчёта: каждый день продано одно и то же (обычный фон плюс то, что «бьёт»).
const BASE: Partial<Record<ProductId, number>> = { bread: 10, milk: 10, apples: 10, potatoes: 10, water: 10, juice: 10, meat: 10, buns: 10, pies: 10, soap: 10, dumplings: 10 };
const week = (extra: Partial<Record<ProductId, number>> = {}, coffees = 0, patch: Partial<DayReport> = {}): DayReport[] =>
  Array.from({ length: 7 }, (_, i) => ({ day: 37 + i, revenue: 0, served: 0, lost: 0, sold: { ...BASE, ...extra }, spoiled: {}, pricey: {}, missing: {}, ...(coffees ? { coffees } : {}), ...patch }));
const shop = (day: number, patch: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day, money: 5000, seed: 7, ...patch });
/** Ночь накануне первого участка: state.day — уже день стройки. */
const night = (reports: DayReport[], patch: Partial<StoreState> = {}) => districtNight(shop(PLOTS[0].from, { reports, ...patch }));

describe('район подстраивается: что строить — решают продажи', () => {
  it('воду и сок берут больше всего — спортзал; цветы и медовик — свадебный салон; кофе — коворкинг', () => {
    expect(night(week({ water: 40, juice: 35 })).district?.plots?.[0].id).toBe('gym');
    expect(night(week({ meat: 40, potatoes: 40 })).district?.plots?.[0].id).toBe('canteen');
    expect(night(week({ buns: 30 }, 45)).district?.plots?.[0].id).toBe('cowork');
    expect(night(week({ icecream: 40, jam: 30 })).district?.plots?.[0].id).toBe('kids');
    // Свадебный салон — не раньше своего дня (второй участок).
    const second = districtNight(shop(PLOTS[1].from, { reports: week({ flowers: 40, honeycake: 30 }), district: { seen: [], plots: [{ id: 'gym', from: 45 }] } }));
    expect(second.district?.plots?.[1].id).toBe('wedding');
    expect(plotScores(shop(PLOTS[0].from, { reports: week({ flowers: 40 }) })).some((s) => s.id === 'wedding')).toBe(false);
  });

  it('кофе считают по стаканчикам из отчёта, дни в Заречье — не в счёт', () => {
    const coffee = week({}, 45);
    expect(weekSold(shop(45, { reports: coffee })).sold.coffee).toBe(45 * 7);
    const zar = week({ water: 90, juice: 90 }, 0, { zar: true });
    expect(weekSold(shop(45, { reports: zar })).days).toBe(0);
    expect(night([...zar, ...week({ meat: 40, potatoes: 40 })]).district?.plots?.[0].id).toBe('canteen');
  });

  it('детерминированно: те же продажи — то же здание; без продаж решает seed', () => {
    const reports = week({ water: 40, juice: 35 });
    expect(night(reports)).toEqual(night(reports));
    const empty = (seed: number) => night([], { seed }).district?.plots?.[0].id;
    expect(empty(3)).toBe(empty(3));
    const picks = new Set(Array.from({ length: 30 }, (_, i) => empty(i + 1)));
    expect(picks.size).toBeGreaterThan(1);
    for (const id of picks) expect(CANDIDATES).toContain(id);
  });

  it('решение с цифрами недели пишется в сохранение и потом не меняется', () => {
    const s = night(week({ water: 40, juice: 35 }));
    const pick = s.district!.plots![0];
    expect(pick).toMatchObject({ id: 'gym', from: PLOTS[0].from, sold: { water: 40 * 7, juice: 35 * 7, kvass: 0 } });
    // Продажи сменились — участок уже решён, следующий ещё не пришёл.
    const later = districtNight({ ...s, day: s.day + 3, reports: week({ flowers: 90 }) });
    expect(later.district!.plots).toEqual(s.district!.plots);
    expect(districtNight(later)).toBe(later);
  });

  it('каждое здание — один раз: следующий участок выбирает из оставшихся', () => {
    const one = night(week({ water: 40, juice: 35 }));
    const two = districtNight({ ...one, day: PLOTS[1].from });
    expect(two.district!.plots![1].id).not.toBe('gym');
    const three = districtNight({ ...two, day: PLOTS[2].from });
    const ids = three.district!.plots!.map((p) => p.id);
    expect(new Set(ids).size).toBe(3);
    expect(placedBuildings(three).filter((p) => p.spot.startsWith('plot'))).toHaveLength(3);
  });
});

describe('новое здание работает, как старые', () => {
  const built = (id: (typeof CANDIDATES)[number]) => shop(PLOTS[0].from + 10, { district: { seen: [], plots: [{ id, from: PLOTS[0].from, sold: { water: 300 } }] } });

  it('стройка, потом открытие; спрос на «свои» товары и гости из здания', () => {
    const open = built('gym');
    // Тот же день, но стройку начали только что: здание ещё за забором.
    const site = { ...open, district: { seen: [], plots: [{ id: 'gym' as const, from: open.day - 1, sold: { water: 300 } }] } };
    expect(buildingStage(site, 'gym')).toBe('site');
    expect(districtSite(site)?.id).toBe('gym');
    expect(buildingStage(open, 'gym')).toBe('open');
    expect(districtDemand(open, 'water') / districtDemand(site, 'water')).toBeCloseTo(BUILDINGS.gym.demand.water!);
    expect(districtDemand(open, 'bread')).toBeCloseTo(districtDemand(site, 'bread'));
    expect(districtGuests(open)).toBeGreaterThan(districtGuests(site));
    expect(districtKey(open)).not.toBe(districtKey(site));
    // Гость из спортзала: перебираем бросок кубика — какая-то доля гостей приходит из него.
    const guests = Array.from({ length: 100 }, (_, i) => districtGuest(open, (() => { let first = true; return () => (first ? ((first = false), i / 100) : 0); })()));
    const guest = guests.find((g) => g?.id === 'gym');
    expect(guest?.id).toBe('gym');
    expect(BUILDINGS.gym.looks).toContain(guest?.look);
  });

  it('открытие: новость, поздравить — деньги и рейтинг; без продаж общежитие на месте', () => {
    const open = built('wedding');
    expect(districtNews({ ...open, district: { ...open.district!, seen: ['school', 'office', 'stadium'] } })).toBe('wedding');
    const gifted = answerOpening(open, 'wedding', true)!;
    expect(gifted.money).toBe(5000 - BUILDINGS.wedding.gift);
    expect(gifted.district?.plots).toEqual(open.district?.plots);
    expect(plotPickOf(open, 'wedding')?.sold).toEqual({ water: 300 });
  });

  it('у всех кандидатов есть «свои» товары и спрос', () => {
    for (const id of CANDIDATES) {
      expect(DRIVERS[id]!.length).toBeGreaterThanOrEqual(2);
      expect(Object.keys(BUILDINGS[id].demand).length).toBeGreaterThan(0);
    }
  });
});

describe('старые сохранения', () => {
  it('где стройка по старому расписанию уже шла — общежитие и поликлиника остаются', () => {
    const old = shop(50);
    expect(old.district).toBeUndefined();
    expect(buildingStage(old, 'dorm')).toBe('site');
    const after = districtNight({ ...old, day: 51, reports: week({ water: 90 }) });
    expect(after.district!.plots).toEqual([{ id: 'dorm', from: 45 }]);
    expect(districtKey(after)).toBe(districtKey({ ...old, day: 51 }));
  });

  it('далеко за всеми участками: старые здания на месте, третий участок — по продажам, с завтрашнего дня', () => {
    const old = shop(111, { district: { seen: ['school', 'office', 'stadium', 'dorm', 'clinic'] }, reports: week({ water: 40, juice: 40 }) });
    const before = districtKey(old);
    const s = districtNight(old);
    expect(s.district!.plots!.map((p) => p.id)).toEqual(['dorm', 'clinic', 'gym']);
    expect(s.district!.plots![2].from).toBe(111);
    expect(s.district!.seen).toEqual(old.district!.seen);
    expect(districtKey(s).startsWith(before)).toBe(true);
    expect(buildingStage(s, 'dorm')).toBe('open');
    expect(buildingStage(s, 'gym')).toBe('site');
  });

  it('сохранение до первого участка: в день стройки выбирают по продажам', () => {
    const s = districtNight(shop(PLOTS[0].from, { reports: week({ water: 40, juice: 40 }) }));
    expect(s.district!.plots![0].id).toBe('gym');
    expect(buildingStage(s, 'dorm')).toBe('none');
  });

  it('ночь дня (nightCycle) решает участок по отчёту, где уже есть сегодняшняя строка', () => {
    const eve = shop(PLOTS[0].from - 1, { reports: week({ water: 40, juice: 40 }).slice(1) });
    const stats = { ...emptyDayStats(), sold: { ...BASE, water: 50, juice: 50 } };
    const next = nightCycle(eve, stats, () => 0.5).state;
    expect(next.day).toBe(PLOTS[0].from);
    expect(next.district?.plots?.[0].id).toBe('gym');
  });
});

describe('утро: новость, подсказка, строка заранее', () => {
  it('новость о стройке — один раз и в очереди утра', () => {
    const s = night(week({ water: 40, juice: 35 }));
    expect(plotNews(s)?.pick.id).toBe('gym');
    const seen = seePlotNews(s);
    expect(plotNews(seen)).toBeNull();
    expect(seePlotNews(seen)).toBe(seen);
    // Старое здание (не по продажам) новостью о стройке не приходит.
    expect(plotNews(districtNight(shop(51)))).toBeNull();
    expect(NEWS_IDS).toContain('plot');
    expect(NEWS_KIND.plot).toBe('flavour');
  });

  it('за неделю до участка утро предупреждает; после решения — нет', () => {
    expect(plotSoon(shop(PLOTS[0].from - 3))).toBe(3);
    expect(plotSoon(shop(PLOTS[0].from - 20))).toBeNull();
    expect(plotSoon(night(week()))).toBeNull();
    expect(plotSoon({ ...night(week()), day: PLOTS[1].from - 2 })).toBe(2);
  });

  it('подсказка «Новое!» — после первого участка по продажам, значок свой', () => {
    const others = (Object.keys(TIP_ICONS) as TipId[]).filter((id) => id !== 'plots');
    expect(pendingTip(shop(PLOTS[0].from, { seenTips: others }))).toBeNull();
    expect(pendingTip(night(week({ water: 40 }), { seenTips: others }))).toBe('plots');
    expect(pendingTip(districtNight(shop(51, { seenTips: others })))).toBeNull();
    expect(Object.values(TIP_ICONS).filter((icon) => icon === TIP_ICONS.plots)).toHaveLength(1);
  });

  it('pickForPlot без кандидатов — null (все уже построены)', () => {
    const plots = CANDIDATES.map((id) => ({ id, from: 45 }));
    expect(pickForPlot(shop(120, { district: { seen: [], plots } }))).toBeNull();
  });
});
