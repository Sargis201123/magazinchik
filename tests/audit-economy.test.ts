import { describe, expect, it } from 'vitest';
import { HYPER_LEVEL, newGame, type StoreState } from '../src/game/economy';
import { simulate, type Feature } from '../src/game/simulate';
import { RACKET_RATE, RACKET_RATE_MAX, racketGuard, racketMorning, racketShare, troubleCost, TROUBLE_CASH } from '../src/game/racket';
import { raidChance, slotsPlan } from '../src/game/basement';
import { tricksMorning } from '../src/game/tricks';
import { answerGrey, greyGoodsGain, greyFine, greyOffer, greyRisk, type GreyOffer } from '../src/game/grey';
import { echoesOf } from '../src/game/echoes';
import { lotteryNight } from '../src/game/lottery';
import { zarAwayBill } from '../src/game/zarshop';
import { buyZar, switchDistrict } from '../src/game/zarechye';
import { ownedLots, openShops } from '../src/game/estate';
import { ru } from '../src/i18n/ru';

// Исправления по аудиту экономики 14.11: зерно магазина в симуляторе, улица в симуляторе и сторож «все механики
// против прежнего набора», серая схема (осторожная сделка — в плюс), «крыша» (2–5% и защита, доля — от Центра),
// утечки Заречья (лотерея, холодильник подвала Центра в счёте Заречья).

const paying = (over: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  level: 3,
  day: 80,
  money: 20000,
  seed: 77,
  racket: { from: 50, mode: 'pay', since: 50, rate: RACKET_RATE },
  ...over,
});

describe('симулятор', () => {
  it('у каждого прогона своё зерно магазина — события новых механик не одни и те же', () => {
    const seeds = [1, 2, 3].map((seed) => simulate({ days: 1, seed }).final.seed);
    expect(seeds.every((s) => typeof s === 'number' && s > 0)).toBe(true);
    expect(new Set(seeds).size).toBe(3);
    // «Крыша» приходит не в один и тот же день у всех (до 14.11 — на 40-й во всех сидах).
    const from = [1, 2, 3, 4, 5, 6].map((seed) => simulate({ days: 70, seed }).final.racket?.from);
    expect(new Set(from).size).toBeGreaterThan(1);
  });

  it('платящий «крыше» соглашается и на подъём ставки', () => {
    const r = simulate({ days: 200, seed: 2, racket: 'pay' }).final.racket;
    expect(r?.mode).toBe('pay');
    expect(r?.rate).toBeGreaterThan(RACKET_RATE);
    expect(r?.rate).toBeLessThanOrEqual(RACKET_RATE_MAX);
  });

  it('улица: покупает помещение из лишних денег и пускает арендатора', () => {
    const s = simulate({ days: 150, seed: 1, features: { estate: true } }).final;
    expect(ownedLots(s)).toBeGreaterThan(0);
    expect(openShops(s).length).toBe(ownedLots(s));
  });

  // Сторож: новые механики 13.11 не должны снова разогнать деньги конца игры. До 14.11: все механики 2,63 млн
  // против 1,73 млн у прежнего набора (×1,52) к 200-му дню; теперь, с улицей в симуляторе, — ×1,48 (2,52 млн против 1,70 млн).
  it('все механики к 200-му дню — не больше ×1,7 к набору до 13.11 (медиана 4 сидов)', () => {
    const NEW: Feature[] = ['license', 'pawn', 'rental', 'lottery', 'van', 'apprentice', 'grey', 'basement', 'clothes', 'gentrify', 'foodcourt', 'estate'];
    const OLD: Feature[] = ['candy', 'coffee', 'oven', 'night', 'cat', 'loyalty', 'gear', 'departments', 'radio', 'brand', 'lines', 'cafe', 'kitchen', 'rush', 'delivery', 'ads', 'kiosks', 'branch', 'hyper', 'hood', 'career', 'tenants', 'garden'];
    const median = (features: Feature[]) => {
      const money = [1, 2, 3, 4].map((seed) => simulate({ days: 200, seed, features: Object.fromEntries(features.map((f) => [f, true])) }).final.money);
      money.sort((a, b) => a - b);
      return (money[1] + money[2]) / 2;
    };
    const old = median(OLD);
    const all = median([...OLD, ...NEW]);
    expect(old).toBeGreaterThan(0);
    expect(all / old).toBeLessThanOrEqual(1.7);
  }, 300_000);
});

describe('серая схема: осторожному — в плюс, жадному — в минус', () => {
  /** Первая партия «без накладных» в магазине этого уровня. */
  function goods(level: number): { state: StoreState; offer: GreyOffer } {
    for (let seed = 1; seed < 60; seed++)
      for (let day = 30; day < 130; day++) {
        const state: StoreState = { ...newGame(), level, money: 50000, seed, day };
        const offer = greyOffer(state);
        if (offer?.kind === 'goods') return { state, offer };
      }
    throw new Error('нет партии');
  }
  /** Ожидание сделки: выгода против риска (штраф и полдня выручки, пока опечатано). */
  const ev = (state: StoreState, offer: GreyOffer, deals: number, halfDay: number) => offer.gain - greyRisk(deals) * (greyFine(state, offer.gain) + halfDay);

  it('партия заметная (не меньше greyGoodsGain), первая сделка в плюс, третья — в минус', () => {
    for (const [level, halfDay] of [
      [2, 3500],
      [3, 5000],
    ] as const) {
      const { state, offer } = goods(level);
      expect(offer.gain).toBeGreaterThanOrEqual(greyGoodsGain(level));
      expect(ev(state, offer, 0, halfDay)).toBeGreaterThan(0);
      expect(ev(state, offer, 2, halfDay)).toBeLessThan(0);
    }
  });

  // Один сид на 150-м дне шумит (сроки покупок), поэтому — в сумме по четырём сидам к 200-му дню.
  it('«на всё согласен» к 200-му дню беднее, чем без Жоры', () => {
    let base = 0;
    let grey = 0;
    for (const seed of [1, 2, 3, 4]) {
      const b = simulate({ days: 200, seed }).final;
      const g = simulate({ days: 200, seed, features: { grey: true } }).final;
      base += b.money - b.debt;
      grey += g.money - g.debt;
    }
    expect(grey).toBeLessThan(base);
  }, 120_000);
});

describe('«крыша»: дешевле, но с защитой; доля — от Центра', () => {
  it('платящему: облав нет, автоматы делятся с «крышей»', () => {
    const base = { floors: { basement: { since: 1, finish: 1 } }, basement: { slots: 4, since: 10 } } as Partial<StoreState>;
    const free = paying({ ...base, racket: undefined });
    expect(raidChance(free)).toBeGreaterThan(0);
    const s = paying(base);
    expect(racketGuard(s)).toBe(true);
    expect(raidChance(s)).toBe(0);
    expect(slotsPlan(s)!.share).toBeGreaterThan(0);
    // Отказался платить — защита кончилась.
    expect(racketGuard(paying({ racket: { from: 50, mode: 'refuse', since: 60, until: 74 } }))).toBe(false);
  });

  it('платящему конкурент не пакостит (броски дня — те же)', () => {
    const roll = () => 0; // каждый бросок — «пакость будет»
    expect(tricksMorning(paying({ racket: undefined }), roll).trick).toBeTruthy();
    const s = paying();
    expect(tricksMorning(s, roll)).toBe(s);
  });

  it('платящему Жора не мстит за отказ', () => {
    let revenge = 0;
    let guarded = 0;
    for (let day = 30; day < 400; day++) {
      const free = { ...paying({ racket: undefined }), day };
      if (!greyOffer(free)) continue;
      const a = answerGrey(free, false)!;
      const b = answerGrey({ ...free, racket: paying().racket }, false)!;
      revenge += echoesOf(a).list.filter((e) => e.id === 'greyRevenge').length;
      guarded += echoesOf(b).list.filter((e) => e.id === 'greyRevenge').length;
    }
    expect(revenge).toBeGreaterThan(0);
    expect(guarded).toBe(0);
  });

  it('пакость — от выручки дня, но не больше половины кассы', () => {
    expect(troubleCost('glass', 3, 10000)).toBeGreaterThan(troubleCost('glass', 3));
    expect(troubleCost('tires', 3, 10000)).toBeLessThan(troubleCost('glass', 3, 10000));
    const s: StoreState = { ...paying(), money: 1000, history: Array(7).fill(20000), racket: { from: 50, mode: 'refuse', since: 79, until: 93 } };
    const out = racketMorning(s);
    expect(out.racket?.hit?.kind).toBe('glass');
    expect(s.money - out.money).toBe(Math.floor(1000 * TROUBLE_CASH));
  });

  it('доля недели — с выручки Центра, даже если хозяин сегодня в Заречье', () => {
    const centre = Array(7).fill(20000);
    const atHome = paying({ history: centre });
    const inZar = { ...atHome, history: Array(7).fill(5000), zar: { at: 'zar', since: 1, played: 0, away: { history: centre } } } as unknown as StoreState;
    expect(racketShare(inZar)).toBe(racketShare(atHome));
    expect(racketShare(atHome)).toBe(Math.round((7 * 20000 * RACKET_RATE) / 100));
  });

  it('в окне выбора видно, что покупает доля', () => {
    expect(ru['racket.guard']).toContain('🛡');
  });
});

describe('Заречье: что закрыто в Центре, то не работает и не платит', () => {
  const zarState = (): StoreState => {
    const bought = buyZar({ ...newGame(), level: HYPER_LEVEL, money: 1e6, debt: 0, day: 200, seed: 5 }, true)!;
    return { ...bought, lottery: { since: 1 } };
  };

  it('лотерея: в Заречье тиража (и премии) нет', () => {
    const home = zarState();
    const zar = switchDistrict(home, 'zar');
    let homeWins = 0;
    for (let day = 200; day < 600; day++) {
      if (lotteryNight({ ...home, day }).money > home.money) homeWins++;
      const z = { ...zar, day };
      expect(lotteryNight(z)).toBe(z);
    }
    // В Центре за то же время выигрыши бывают (до 14.11 столько же выпадало и в Заречье).
    expect(homeWins).toBeGreaterThan(0);
  });

  it('холодильник в подвале Центра — не в счёте Заречья', () => {
    const home: StoreState = { ...zarState(), floors: { basement: { since: 1, finish: 0 } }, basement: { slots: 0, parts: ['cold'] } };
    const withDays = { ...home, zar: { ...home.zar!, days: { home: 3, zar: 3 } } };
    const noCold = { ...withDays, basement: { slots: 0, parts: [] } };
    expect(zarAwayBill(withDays).power).toBe(zarAwayBill(noCold).power);
  });
});
