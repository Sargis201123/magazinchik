import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { CHAPTERS } from '../src/game/story';
import { guestFactor } from '../src/game/day';
import {
  EDUARD_GROWTH_DAYS,
  EDUARD_LOYAL_RATING,
  EDUARD_MAX,
  EDUARD_STAGES,
  eduardGuests,
  eduardLook,
  eduardNews,
  eduardPull,
  eduardWar,
  growEduard,
  seeEduardNews,
} from '../src/game/eduard';
import { buyRadio, nextStation, RADIO_PRICE, radioExtra, radioPatience, radioSpeed, setStation, stationOf } from '../src/game/radio';
import { impulseChance } from '../src/game/impulse';

const free = (patch: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  day: 60,
  rating: 4,
  story: { chapter: CHAPTERS.length, introSeen: true, ordersDone: 0, inspectionsPassed: 0 },
  ...patch,
});
const chapter = (n: number): StoreState => ({ ...newGame(), story: { chapter: n, introSeen: true, ordersDone: 0, inspectionsPassed: 0 } });

describe('Эдуард растёт', () => {
  it('по сюжету: помещение пустует, потом «МегаМарт», в пятой главе закрыт', () => {
    expect(eduardLook(chapter(0))).toBe('vacant');
    expect(eduardLook(chapter(2))).toBe('mega');
    expect(eduardLook(chapter(4))).toBe('vacant');
    // Во время сюжета Эдуард не растёт и гостей сверх сюжета не уводит.
    expect(growEduard(chapter(2))).toEqual(chapter(2));
    expect(eduardPull(chapter(2))).toBe(0);
  });

  it(`после сюжета каждые ${EDUARD_GROWTH_DAYS} дней открывает магазин больше`, () => {
    let s = growEduard(free());
    expect(s.eduard).toEqual({ stage: 0, since: 60, seen: 0 });
    expect(eduardLook(s)).toBe('vacant');
    expect(growEduard({ ...s, day: 60 + EDUARD_GROWTH_DAYS - 1 }).eduard!.stage).toBe(0);
    for (let i = 1; i <= EDUARD_MAX + 2; i++) s = growEduard({ ...s, day: 60 + EDUARD_GROWTH_DAYS * i });
    expect(s.eduard!.stage).toBe(EDUARD_MAX);
    expect(eduardLook(s)).toBe('mall');
  });

  it('новость показывается один раз на стадию', () => {
    const s = free({ eduard: { stage: 2, since: 60, seen: 1 } });
    expect(eduardNews(s)).toBe(2);
    expect(eduardNews(seeEduardNews(s))).toBeNull();
    expect(eduardNews(free({ eduard: { stage: 0, since: 60, seen: 0 } }))).toBeNull();
  });

  it('уводит гостей; рейтинг и реклама — вдвое меньше; войны чаще', () => {
    const s = free({ eduard: { stage: 3, since: 60, seen: 3 } });
    expect(eduardPull(s)).toBe(EDUARD_STAGES[3].pull);
    expect(eduardGuests(s)).toBeCloseTo(1 - EDUARD_STAGES[3].pull);
    expect(eduardPull({ ...s, rating: EDUARD_LOYAL_RATING })).toBeCloseTo(EDUARD_STAGES[3].pull / 2);
    expect(guestFactor(s)).toBeLessThan(guestFactor({ ...s, eduard: { stage: 0, since: 60, seen: 0 } }));
    expect(eduardWar(s)).toBeGreaterThan(eduardWar(chapter(2)));
  });
});

describe('радио', () => {
  it('покупка и волны по кругу', () => {
    const s = { ...newGame(), money: 1000 };
    expect(setStation(s, 'hits')).toBeNull();
    const bought = buyRadio(s)!;
    expect(bought.money).toBe(1000 - RADIO_PRICE);
    expect(stationOf(bought)).toBe('retro');
    expect(buyRadio(bought)).toBeNull();
    expect(buyRadio({ ...s, money: RADIO_PRICE - 1 })).toBeNull();
    expect(nextStation('off')).toBe('retro');
    expect(nextStation('hits')).toBe('off');
  });

  it('ретро — терпение и лишний товар, хиты — быстрее и сладкое у кассы', () => {
    const base = { ...newGame(), money: 1000 };
    const retro = buyRadio(base)!;
    const hits = setStation(retro, 'hits')!;
    const off = setStation(retro, 'off')!;
    expect(radioPatience(retro)).toBeGreaterThan(1);
    expect(radioPatience(hits)).toBeLessThan(1);
    expect(radioPatience(off)).toBe(1);
    expect(radioSpeed(hits)).toBeGreaterThan(1);
    expect(radioSpeed(retro)).toBe(1);
    expect(radioExtra(retro, () => 0)).toBe(1);
    expect(radioExtra(hits, () => 0)).toBe(0);
    expect(impulseChance(hits, 0)).toBeGreaterThan(impulseChance(off, 0));
  });
});
