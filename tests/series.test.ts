import { describe, expect, it } from 'vitest';
import { SERIES_REACT_MS, SERIES_TIP_FROM, SERIES_TIP_MAX, SERIES_TIP_STEP, seriesAfter, seriesLost, seriesTip, seriesTipRate } from '../src/game/series';

describe('серия у кассы: чаевые за обслуживание без задержки', () => {
  it('пробил вовремя — серия растёт; заставил ждать — начинается заново с этой покупки', () => {
    expect(seriesAfter(0, 0)).toBe(1);
    expect(seriesAfter(4, SERIES_REACT_MS)).toBe(5);
    expect(seriesAfter(4, SERIES_REACT_MS + 1)).toBe(1);
    expect(seriesAfter(0, SERIES_REACT_MS + 1)).toBe(1);
  });

  it('чаевые — с третьей покупки подряд, растут по шагу и упираются в потолок', () => {
    expect(seriesTipRate(1)).toBe(0);
    expect(seriesTipRate(SERIES_TIP_FROM - 1)).toBe(0);
    expect(seriesTipRate(SERIES_TIP_FROM)).toBeCloseTo(SERIES_TIP_STEP);
    expect(seriesTipRate(SERIES_TIP_FROM + 1)).toBeCloseTo(SERIES_TIP_STEP * 2);
    // Потолок: дальше доля не растёт, сколько бы ни шла серия (сменщик под касаниями держит её весь день).
    expect(seriesTipRate(50)).toBe(SERIES_TIP_MAX);
    for (let n = 1; n < 60; n++) expect(seriesTipRate(n + 1)).toBeGreaterThanOrEqual(seriesTipRate(n));
  });

  it('чаевые — целые монеты; положены — не меньше одной, даже с маленькой корзины', () => {
    expect(seriesTip(2, 500)).toBe(0);
    expect(seriesTip(SERIES_TIP_FROM, 20)).toBe(1);
    expect(seriesTip(SERIES_TIP_FROM, 100)).toBe(2);
    expect(seriesTip(7, 100)).toBe(10);
    expect(seriesTip(30, 1234)).toBe(123);
    expect(seriesTip(7, 0)).toBe(0);
  });

  it('о потере серии говорим, только если уже шли чаевые', () => {
    expect(seriesLost(2, 1)).toBe(false);
    expect(seriesLost(SERIES_TIP_FROM, 1)).toBe(true);
    expect(seriesLost(8, 0)).toBe(true);
    expect(seriesLost(5, 6)).toBe(false);
  });

  it('оценка сверху: при идеальной игре чаевые не превышают потолок от выручки своей кассы', () => {
    // Сорок покупок по 100 монет подряд без единой задержки.
    let series = 0;
    let tips = 0;
    for (let i = 0; i < 40; i++) {
      series = seriesAfter(series, 0);
      tips += seriesTip(series, 100);
    }
    expect(tips / 4000).toBeLessThanOrEqual(SERIES_TIP_MAX);
    expect(tips / 4000).toBeGreaterThan(0.08);
  });
});
