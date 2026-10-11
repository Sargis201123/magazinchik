import { describe, expect, it } from 'vitest';
import {
  buyShelf,
  buyStock,
  checkout,
  expandStore,
  MARKDOWN,
  newGame,
  nextStoreLevel,
  PRODUCT_IDS,
  PRODUCTS,
  PROMO_DISCOUNT,
  resolveBadBatch,
  sellShelf,
  setPrice,
  SHELF_KINDS,
  STORE_LEVELS,
  upgradeCost,
  upgradeShelf,
  payBill,
  type StoreState,
} from '../src/game/economy';
import { AD_IDS, adPrice, buyAd } from '../src/game/ads';
import { buyUpgrade, UPGRADE_IDS, UPGRADES } from '../src/game/upgrades';
import { GEAR_IDS, nextGear, upgradeGear, COFFEE_PRICES } from '../src/game/gear';
import { buyDecor, DECOR } from '../src/game/decor';
import { adoptDog, DOG_PRICE } from '../src/game/watch';
import { buyRadio, RADIO_PRICE } from '../src/game/radio';
import { JOB_AD_COST, startJobSearch } from '../src/game/staff';
import { orderUrgent, urgentCost } from '../src/game/urgent';
import { NIGHT_POWER, startNight } from '../src/game/night';
import { nextRack, upgradeRack, CANDY_COST, CANDY_PRICE } from '../src/game/impulse';
import { CUP_COST } from '../src/game/coffee';
import { loanOptions, repayLoan, takeLoan } from '../src/game/bank';
import { stallPrice, STALL_MARKUP } from '../src/game/fair';
import { ANGRY_MARKUP, SUPPLIERS, unitPrice, newDeal } from '../src/game/suppliers';
import { cafePay } from '../src/game/cafe';
import { simulate } from '../src/game/simulate';

// Экономика единицы: откуда приходят монеты и куда уходят. Каждая трата списывает ровно ту
// цену, что показана игроку; без денег — не проходит (в минус не уйти); купить-и-продать
// никогда не выгодно; любой товар от поставщика можно продать по обычной цене с прибылью.

const rich = (patch: Partial<StoreState> = {}): StoreState => ({
  ...newGame(),
  day: 60,
  level: STORE_LEVELS.length - 1,
  money: 1_000_000,
  rating: 4.5,
  upgrades: [...UPGRADE_IDS],
  ...patch,
});

/** Трата: сколько должна стоить и что сделать. */
const SPENDS: [string, (s: StoreState) => number | null, (s: StoreState) => StoreState | null][] = [
  ['закупка 5 хлеба по 25', () => 125, (s) => buyStock(s, 'bread', 5, 25)],
  ['новая полка', () => SHELF_KINDS.bakery.price, (s) => buyShelf(s, 'bakery')],
  ['улучшение полки', (s) => upgradeCost(s.shelves[0]), (s) => upgradeShelf(s, 0)],
  ['расширение помещения', (s) => nextStoreLevel(s)?.cost ?? null, (s) => expandStore(s)],
  ...AD_IDS.map((id) => [`реклама ${id}`, (s: StoreState) => adPrice(s, id), (s: StoreState) => buyAd(s, id)] as [string, (s: StoreState) => number, (s: StoreState) => StoreState | null]),
  ...UPGRADE_IDS.map((id) => [`улучшение ${id}`, () => UPGRADES[id].price, (s: StoreState) => buyUpgrade({ ...s, upgrades: [] }, id)] as [string, () => number, (s: StoreState) => StoreState | null]),
  ...GEAR_IDS.map((id) => [`оборудование ${id}`, (s: StoreState) => nextGear(s, id)?.price ?? null, (s: StoreState) => upgradeGear(s, id)] as [string, (s: StoreState) => number | null, (s: StoreState) => StoreState | null]),
  ...DECOR.filter((d) => d.price !== undefined).map((d) => [`декор ${d.id}`, () => d.price!, (s: StoreState) => buyDecor(s, d.id)] as [string, () => number, (s: StoreState) => StoreState | null]),
  ['пёс Бобик', () => DOG_PRICE, (s) => adoptDog(s)],
  ['радио', () => RADIO_PRICE, (s) => buyRadio({ ...s, upgrades: s.upgrades?.filter((u) => u !== 'radio') })],
  ['объявление о вакансии', () => JOB_AD_COST, (s) => startJobSearch(s, 'cashier')],
  ['срочный подвоз', (s) => urgentCost(s, 'milk', 3), (s) => orderUrgent(s, 'milk', 3)],
  ['ночная смена', () => NIGHT_POWER, (s) => startNight(s)],
  ['стойка сладостей', (s) => nextRack(s)?.cost ?? null, (s) => upgradeRack(s)],
];

describe('экономика единицы: траты', () => {
  for (const [name, price, act] of SPENDS) {
    it(`${name}: списывается ровно цена, без денег — нельзя`, () => {
      const base = name === 'расширение помещения' ? rich({ level: 0, debt: 0 }) : rich();
      const cost = price(base);
      if (cost === null) return; // эта трата в этом состоянии недоступна (например, всё уже куплено)
      const done = act(base);
      if (!done) return; // требует условий, которых тут нет (другая проверка, не деньги)
      expect(cost).toBeGreaterThan(0);
      expect(base.money - done.money).toBe(cost);
      const poor = { ...base, money: cost - 1 };
      expect(act(poor)).toBeNull();
    });
  }

  it('большинство трат реально проверено (а не пропущено по условиям)', () => {
    let checked = 0;
    for (const [name, price, act] of SPENDS) {
      const base = name === 'расширение помещения' ? rich({ level: 0, debt: 0 }) : rich();
      if (price(base) !== null && act(base)) checked++;
    }
    expect(checked).toBeGreaterThan(SPENDS.length * 0.7);
  });
});

describe('экономика единицы: купить и продать — не выгодно', () => {
  it('полка: купить и продать — минус половина цены; с улучшениями тоже минус', () => {
    const s = rich({ shelves: [] });
    const bought = buyShelf(s, 'meat')!;
    expect(sellShelf(bought, 0)!.money).toBeLessThan(s.money);
    const upgraded = upgradeShelf(upgradeShelf(bought, 0)!, 0)!;
    expect(sellShelf(upgraded, 0)!.money).toBeLessThan(s.money);
  });

  it('кредит: взять и сразу вернуть — переплата процентов', () => {
    const s = rich({ money: 0 });
    const amount = loanOptions(s)[1];
    const taken = takeLoan(s, amount)!;
    const repaid = repayLoan({ ...taken, money: 1_000_000 }, 1_000_000)!;
    expect(repaid.loan).toBeUndefined();
    expect(1_000_000 - repaid.money).toBeGreaterThan(amount);
  });

  it('брак: вернуть поставщику — получаешь меньше, чем заплатил', () => {
    const s = rich({ warehouse: {} });
    const bought = buyStock(s, 'milk', 10, 36, true)!;
    const back = resolveBadBatch(bought, 'milk', 'return', 36);
    expect(back.money).toBeLessThan(s.money);
    expect(back.warehouse.milk ?? []).toHaveLength(0);
  });

  it('ярмарка: задранный ценник не печатает деньги — лоток продаёт не дороже обычной цены с наценкой', () => {
    for (const id of PRODUCT_IDS) {
      const greedy = setPrice(rich(), id, PRODUCTS[id].basePrice * 10);
      expect(stallPrice(greedy, id)).toBe(Math.round(PRODUCTS[id].basePrice * STALL_MARKUP));
      const cheap = setPrice(rich(), id, Math.round(PRODUCTS[id].basePrice / 2));
      expect(stallPrice(cheap, id)).toBe(Math.round(cheap.prices[id] * STALL_MARKUP));
    }
  });
});

describe('экономика единицы: маржа', () => {
  it('любой товар от любого поставщика продаётся по обычной цене с прибылью — даже у злого поставщика', () => {
    for (const s of Object.values(SUPPLIERS)) {
      for (const id of Object.keys(s.products) as (keyof typeof PRODUCTS)[]) {
        const normal = unitPrice(s, newDeal(s), id)!;
        const angry = unitPrice(s, { ...newDeal(s), angry: true }, id)!;
        const haggled = unitPrice(s, { ...newDeal(s), discount: 0.2 }, id)!;
        expect(angry).toBeLessThan(PRODUCTS[id].basePrice);
        expect(angry).toBeGreaterThanOrEqual(Math.round(normal * (1 + ANGRY_MARKUP)) - 1);
        expect(haggled).toBeGreaterThan(0);
        expect(haggled).toBeLessThan(normal);
      }
    }
  });

  it('акция −20% всё ещё в плюс к закупке; уценка — это продажа в убыток, чтобы не выкинуть', () => {
    for (const s of Object.values(SUPPLIERS)) {
      for (const id of Object.keys(s.products) as (keyof typeof PRODUCTS)[]) {
        expect(Math.round(PRODUCTS[id].basePrice * PROMO_DISCOUNT)).toBeGreaterThan(unitPrice(s, newDeal(s), id)!);
      }
    }
    expect(MARKDOWN).toBeLessThan(1);
  });

  it('кофе, сладости, своя выпечка и кафе — в плюс', () => {
    for (const price of COFFEE_PRICES) expect(price).toBeGreaterThan(CUP_COST);
    expect(CANDY_PRICE).toBeGreaterThan(CANDY_COST);
    for (const id of ['pies', 'buns', 'honeycake'] as const) expect(PRODUCTS[id].basePrice).toBeGreaterThan(PRODUCTS[id].cost * 2);
    expect(cafePay(rich(), { bread: 5 })).toBeGreaterThanOrEqual(5 * PRODUCTS.bread.cost);
  });
});

describe('экономика единицы: касса и счета', () => {
  it('касса: цена с полки, акция −20%, уценка, «2=1», ночная наценка', () => {
    const s = setPrice(rich(), 'bread', 40);
    const unit = { age: 0 };
    expect(checkout(s, [{ id: 'bread', unit }]).total).toBe(40);
    expect(checkout(s, [{ id: 'bread', unit: { age: 0, markdown: true } }]).total).toBe(Math.round(40 * MARKDOWN));
    expect(checkout(s, [{ id: 'bread', unit }, { id: 'bread', unit, free: true }]).total).toBe(40);
    expect(checkout(s, [{ id: 'bread', unit }], 1.25).total).toBe(50);
    const promo = { ...s, promo: { product: 'bread' as const, kind: 'discount' as const, day: s.day } };
    expect(checkout(promo, [{ id: 'bread', unit }]).total).toBe(Math.round(40 * PROMO_DISCOUNT));
    const { state, total } = checkout(s, [{ id: 'bread', unit }, { id: 'bread', unit }]);
    expect(state.money - s.money).toBe(total);
  });

  it('счета: денег не хватило — не уходим в минус, недостача с пени — в долг', () => {
    const s = rich({ money: 100, debt: 0, staff: [] });
    const { state, shortfall } = payBill(s);
    expect(state.money).toBe(0);
    expect(shortfall).toBeGreaterThan(0);
    expect(state.debt).toBeGreaterThan(shortfall);
  });

  it('за полгода игры у «разумного игрока» деньги ни разу не уходят в минус', () => {
    for (let seed = 1; seed <= 6; seed++) {
      for (const opts of [{}, { queueLoss: 0.12, priceMult: 1.1 }, { hireStaff: false }]) {
        const run = simulate({ days: 120, seed, ...opts });
        expect(Math.min(...run.days.map((d) => d.money))).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
