import { describe, expect, it } from 'vitest';
import { activeAd, adBoost, adPrice, buyAd } from '../src/game/ads';
import { newGame } from '../src/game/economy';

describe('ads', () => {
  const rich = { ...newGame(), money: 10000 };

  it('реклама работает свои дни и добавляет гостей', () => {
    const s = buyAd(rich, 'banner')!;
    expect(s.money).toBe(rich.money - adPrice(rich, 'banner'));
    expect(adBoost(s)).toBeCloseTo(1.1);
    expect(activeAd({ ...s, day: s.day + 2 })?.id).toBe('banner');
    expect(activeAd({ ...s, day: s.day + 3 })).toBeUndefined();
  });

  it('одновременно только одна реклама; без денег — нельзя', () => {
    const s = buyAd(rich, 'flyers')!;
    expect(buyAd(s, 'blogger')).toBeNull();
    expect(buyAd({ ...newGame(), money: 0 }, 'flyers')).toBeNull();
  });

  it('чем больше магазин, тем дороже реклама; блогер дороже листовок', () => {
    expect(adPrice({ ...rich, level: 3 }, 'flyers')).toBeGreaterThan(adPrice(rich, 'flyers'));
    expect(adPrice(rich, 'blogger')).toBeGreaterThan(adPrice(rich, 'flyers'));
  });
});
