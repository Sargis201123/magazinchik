import { describe, expect, it } from 'vitest';
import {
  activeAd,
  activeAds,
  AD_IDS,
  adBlock,
  adBoost,
  adExtraItems,
  adGain,
  adGuests,
  adPrice,
  adRareBoost,
  adTrust,
  ADS,
  buyAd,
  grantAd,
  MAX_ADS,
} from '../src/game/ads';
import { filmingReward } from '../src/game/bigday';
import { emptyDayStats, newGame, satisfaction, type StoreState } from '../src/game/economy';
import { en } from '../src/i18n/en';
import { ru } from '../src/i18n/ru';

describe('ads', () => {
  const rich: StoreState = { ...newGame(), money: 100000 };
  const big: StoreState = { ...rich, level: 4 };

  it('реклама работает свои дни и добавляет гостей', () => {
    const s = buyAd(rich, 'banner')!;
    expect(s.money).toBe(rich.money - adPrice(rich, 'banner'));
    expect(adBoost(s)).toBeCloseTo(1.12);
    expect(activeAd({ ...s, day: s.day + 2 })?.id).toBe('banner');
    expect(activeAd({ ...s, day: s.day + 3 })).toBeUndefined();
  });

  it('несколько реклам сразу, но каждая следующая слабее; одну и ту же дважды — нельзя', () => {
    const one = buyAd(rich, 'blogger')!;
    expect(adGain(one, 'flyers')).toBeCloseTo(ADS.flyers.boost * 0.5);
    const two = buyAd(one, 'flyers')!;
    expect(adBoost(two)).toBeCloseTo(1 + 0.4 + 0.2 * 0.5);
    expect(buyAd(two, 'flyers')).toBeNull();
    expect(adBlock(two, 'flyers')).toBe('running');
    const three = buyAd(two, 'banner')!;
    expect(activeAds(three)).toHaveLength(MAX_ADS);
    expect(adBlock({ ...three, level: 4 }, 'radio')).toBe('full');
    // Сильная первой: по ней улица и Эдуард.
    expect(activeAd(three)?.id).toBe('blogger');
  });

  it('без денег — нельзя; дорогая реклама открывается с большим магазином', () => {
    expect(buyAd({ ...newGame(), money: 0 }, 'flyers')).toBeNull();
    expect(adBlock(rich, 'tv')).toBe('level');
    expect(buyAd(rich, 'city')).toBeNull();
    for (const id of AD_IDS) expect(adBlock(big, id)).toBeNull();
  });

  it('чем больше магазин, тем дороже реклама; дорогая дороже дешёвой', () => {
    expect(adPrice({ ...rich, level: 3 }, 'flyers')).toBeGreaterThan(adPrice(rich, 'flyers'));
    expect(adPrice(rich, 'blogger')).toBeGreaterThan(adPrice(rich, 'flyers'));
    expect(adPrice(big, 'city')).toBeGreaterThan(adPrice(big, 'billboard'));
    expect(adPrice(big, 'billboard')).toBeGreaterThan(adPrice(big, 'radio'));
    // Кампания по городу у звёздного большого магазина — заметные деньги.
    expect(adPrice({ ...big, rating: 5 }, 'city')).toBeGreaterThanOrEqual(1500);
  });

  it('звёздная реклама зовёт редких гостей, громкая — прибавляет доверия и полнит корзины', () => {
    expect(adRareBoost(rich)).toBe(1);
    expect(adRareBoost(grantAd(big, 'collab'))).toBe(3);
    const tv = grantAd(big, 'tv');
    expect(adTrust(tv)).toBeGreaterThan(1);
    expect(adExtraItems(tv, () => 0)).toBe(1);
    expect(adExtraItems(tv, () => 0.99)).toBe(0);
    // Без такой рекламы случайное число не тратится (пары прогонов симулятора идут по одним событиям).
    let draws = 0;
    expect(adExtraItems(grantAd(big, 'flyers'), () => (draws++, 0))).toBe(0);
    expect(draws).toBe(0);
  });

  it('старое сохранение: реклама в поле ads работает, новая — рядом с ней', () => {
    const old: StoreState = { ...rich, ads: { id: 'banner', from: rich.day, until: rich.day + 2 } };
    expect(activeAd(old)?.id).toBe('banner');
    const both = buyAd(old, 'flyers')!;
    expect(activeAds(both).map((a) => a.id).sort()).toEqual(['banner', 'flyers']);
    expect(both.ads).toBeUndefined();
  });

  it('съёмки кино дарят блогера на завтра, если своя реклама на завтра не заказана', () => {
    const s = filmingReward(rich);
    expect(activeAd({ ...s, day: rich.day + 1 })?.id).toBe('blogger');
    const busy = buyAd(rich, 'banner')!;
    expect(filmingReward(busy)).toBe(busy);
  });

  it('итоги: сколько гостей привела реклама', () => {
    expect(adGuests(rich, 100)).toBe(0);
    // +40%: из 140 зашедших 40 — по рекламе.
    expect(adGuests(grantAd(rich, 'blogger'), 140)).toBe(40);
  });

  it('ушедшие ни с чем гости по рекламе роняют рейтинг меньше', () => {
    const stats = { ...emptyDayStats(), served: 60, lost: 40 };
    expect(satisfaction({ ...stats, adGuests: 30 })).toBeGreaterThan(satisfaction(stats));
  });

  it('у каждой рекламы есть название и описание на обоих языках', () => {
    for (const id of AD_IDS) {
      for (const key of [ADS[id].nameKey, ADS[id].descKey]) {
        expect(ru[key]).toBeTruthy();
        expect(en[key]).toBeTruthy();
      }
    }
  });
});
