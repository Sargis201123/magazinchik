import { describe, expect, it } from 'vitest';
import { newGame, type StoreState } from '../src/game/economy';
import { CHAPTERS } from '../src/game/story';
import { guestFactor } from '../src/game/day';
import {
  BOSS_DAYS,
  bossActive,
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

  it(`после сюжета через ${EDUARD_GROWTH_DAYS} дней напротив открывается первый босс — и стоит, пока его не победят`, () => {
    let s = growEduard(free());
    expect(s.eduard).toEqual({ stage: 0, since: 60, seen: 0 });
    expect(eduardLook(s)).toBe('vacant');
    expect(growEduard({ ...s, day: 60 + EDUARD_GROWTH_DAYS - 1, rating: 3 }).eduard!.stage).toBe(0);
    s = growEduard({ ...s, day: 60 + EDUARD_GROWTH_DAYS, rating: 3 });
    expect(s.eduard!.stage).toBe(1);
    expect(eduardLook(s)).toBe('kiosk');
    // С низким рейтингом босс не уходит, сколько ни жди.
    for (let i = 1; i <= 40; i++) s = growEduard({ ...s, day: s.day + 1 });
    expect(s.eduard!.stage).toBe(1);
    expect(bossActive(s)).toBe(true);
  });

  it(`рейтинг не ниже планки ${BOSS_DAYS} вечеров подряд — босс закрывается, премия; потом следующий`, () => {
    let s = free({ rating: EDUARD_STAGES[1].rating, eduard: { stage: 1, since: 60, seen: 1 } });
    const money = s.money;
    for (let i = 0; i < BOSS_DAYS - 1; i++) s = growEduard({ ...s, day: s.day + 1 });
    expect(bossActive(s)).toBe(true);
    // Провал рейтинга обнуляет серию.
    const dip = growEduard({ ...s, day: s.day + 1, rating: 3 });
    expect(dip.eduard!.streak).toBe(0);
    s = growEduard({ ...s, day: s.day + 1 });
    expect(bossActive(s)).toBe(false);
    expect(s.money - money).toBe(EDUARD_STAGES[1].reward);
    expect(eduardLook(s)).toBe('vacant');
    expect(eduardPull(s)).toBe(0);
    expect(eduardNews(s)).toEqual({ stage: 1, kind: 'beaten' });
    s = seeEduardNews(s);
    expect(eduardNews(s)).toBeNull();
    s = growEduard({ ...s, day: s.day + EDUARD_GROWTH_DAYS });
    expect(s.eduard!.stage).toBe(2);
    expect(eduardLook(s)).toBe('discount');
    expect(eduardNews(s)).toEqual({ stage: 2, kind: 'open' });
  });

  it('у каждого следующего босса хватка сильнее, а планка выше; последний — Эдуард с моллом', () => {
    for (let i = 2; i <= EDUARD_MAX; i++) {
      expect(EDUARD_STAGES[i].pull).toBeGreaterThan(EDUARD_STAGES[i - 1].pull);
      expect(EDUARD_STAGES[i].rating).toBeGreaterThan(EDUARD_STAGES[i - 1].rating);
    }
    expect(eduardLook(free({ eduard: { stage: EDUARD_MAX, since: 60, seen: EDUARD_MAX } }))).toBe('mall');
    // Последнего победили — больше никто не откроется.
    const done = free({ eduard: { stage: EDUARD_MAX, since: 60, seen: EDUARD_MAX, beaten: true, beatenSeen: EDUARD_MAX } });
    expect(growEduard({ ...done, day: 500 }).eduard!.stage).toBe(EDUARD_MAX);
    expect(eduardLook(done)).toBe('vacant');
  });

  it('новость об открытии показывается один раз', () => {
    const s = free({ eduard: { stage: 2, since: 60, seen: 1 } });
    expect(eduardNews(s)).toEqual({ stage: 2, kind: 'open' });
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
