import { describe, expect, it } from 'vitest';
import { emptyDayStats, newGame, onShelves, warehouseOf, type StoreState, type Unit } from '../src/game/economy';
import { ensurePlan, guestsToday, inspectionDone, nightCycle } from '../src/game/day';
import {
  answerEvent,
  breakShelf,
  fridgeRepairCost,
  fulfillOrder,
  inspect,
  ORDER_DONE_RATING,
  ORDER_FAILED_RATING,
  planDay,
  repairShelf,
  warmBrokenFridges,
  type DayPlan,
  type MorningEvent,
} from '../src/game/events';
import { CHAPTERS, finishChapter, finishIntro, pendingStory, storyGuests } from '../src/game/story';

const units = (n: number, extra: Partial<Unit> = {}) => Array.from({ length: n }, () => ({ age: 0, ...extra }));

/** Магазинчик с молочным холодильником, без долга, с планом дня и событием. */
const shop = (event?: MorningEvent, plan: Partial<DayPlan> = {}): StoreState => ({
  ...newGame(),
  day: 10,
  level: 1,
  debt: 0,
  money: 1000,
  warehouse: { milk: units(5) },
  shelves: [
    { kind: 'bakery', level: 0, items: { bread: units(4) } },
    { kind: 'dairy', level: 0, items: { milk: units(3) } },
  ],
  plan: { day: 10, decided: false, inspection: false, quests: [], event, ...plan },
});

describe('план дня', () => {
  it('одинаковый для одного дня, первые дни спокойные', () => {
    const s = { ...newGame(), day: 20, shelves: shop().shelves };
    expect(planDay(s)).toEqual(planDay(s));
    expect(planDay(newGame()).event).toBeUndefined();
  });

  it('за много дней случаются все виды событий', () => {
    const kinds = new Set<string>();
    const base = { ...shop(), staff: [{ role: 'cashier' as const, name: 0, skill: 1, wage: 300, months: 0 }] };
    for (let day = 4; day < 400; day++) {
      const e = planDay({ ...base, day }).event;
      if (e) kinds.add(e.kind);
    }
    expect([...kinds].sort()).toEqual(['bill', 'dayOff', 'deal', 'fridgeBroken', 'goHome', 'inspection', 'order', 'poach', 'priceWar', 'sick', 'snitch']);
  });
});

describe('заказ', () => {
  const order: MorningEvent = { kind: 'order', client: 'school', product: 'milk', qty: 7, pay: 78 };

  it('принятый заказ забирают вечером: склад, потом полки, деньги и рейтинг', () => {
    const s = answerEvent(shop(order), true)!;
    const r = fulfillOrder(s)!;
    expect(r.delivered).toBe(true);
    expect(r.earned).toBe(7 * 78);
    expect(warehouseOf(r.state, 'milk')).toBe(0);
    expect(onShelves(r.state, 'milk')).toBe(1);
    expect(r.state.rating).toBeCloseTo(s.rating + ORDER_DONE_RATING);
  });

  it('не хватило товара — рейтинг падает, товар не трогаем', () => {
    const s = answerEvent(shop({ ...order, qty: 20 }), true)!;
    const r = fulfillOrder(s)!;
    expect(r.delivered).toBe(false);
    expect(r.state.rating).toBeCloseTo(s.rating - ORDER_FAILED_RATING);
    expect(warehouseOf(r.state, 'milk')).toBe(5);
  });

  it('отказ — заказа нет', () => {
    expect(fulfillOrder(answerEvent(shop(order), false)!)).toBeNull();
  });

  it('выполненный заказ засчитывается в сюжет', () => {
    const night = nightCycle(answerEvent(shop(order), true)!, emptyDayStats());
    expect(night.order?.delivered).toBe(true);
    expect(night.state.story.ordersDone).toBe(1);
  });
});

describe('выгодная партия', () => {
  it('покупается на склад по сниженной цене, не больше места', () => {
    const s = answerEvent(shop({ kind: 'deal', supplier: 'dairy', product: 'milk', qty: 100, price: 18 }), true)!;
    expect(warehouseOf(s, 'milk')).toBe(35); // склад магазинчика — 35 мест
    expect(s.money).toBe(1000 - 30 * 18);
  });
});

describe('сломанный холодильник', () => {
  const broke: MorningEvent = { kind: 'fridgeBroken', shelf: 1, cost: fridgeRepairCost(1) };

  it('починить сразу — платим и всё работает', () => {
    const s = answerEvent(shop(broke), true)!;
    expect(s.shelves[1].broken).toBe(false);
    expect(s.money).toBe(1000 - fridgeRepairCost(1));
  });

  it('потом — полка не продаёт, товар греется и портится быстрее; чинится во вкладке', () => {
    const s = answerEvent(shop(broke), false)!;
    expect(s.shelves[1].broken).toBe(true);
    expect(warmBrokenFridges(s).shelves[1].items.milk![0].age).toBe(1);
    expect(repairShelf(s, 1)!.shelves[1].broken).toBe(false);
    expect(repairShelf({ ...s, money: 0 }, 1)).toBeNull();
  });
});

describe('проверка', () => {
  it('чисто — пройдена, плюс к рейтингу и к сюжету', () => {
    const s = shop();
    const r = inspect(s, { trash: 0, toiletDirt: 10 });
    expect(r.passed).toBe(true);
    const after = inspectionDone(s, r);
    expect(after.rating).toBeGreaterThan(s.rating);
    expect(after.story.inspectionsPassed).toBe(1);
  });

  it('мусор, туалет, брак и тёплый холодильник — штраф', () => {
    const s = breakShelf(
      { ...shop(), shelves: [{ kind: 'bakery', level: 0, items: { bread: units(2, { bad: true }) } }, shop().shelves[1]] },
      1,
    );
    const r = inspect(s, { trash: 3, toiletDirt: 80 });
    expect(r.problems).toEqual(['inspection.trash', 'inspection.toilet', 'inspection.badGoods', 'inspection.warmFridge']);
    const after = inspectionDone(s, r);
    expect(after.money).toBe(1000 - r.fine);
    expect(after.rating).toBeLessThan(s.rating);
  });
});

describe('сюжет', () => {
  it('новая игра начинается с письма бабушки', () => {
    const story = pendingStory(newGame());
    expect(story?.kind).toBe('intro');
    expect(story?.chapter.intro[0].who).toBe('grandma');
  });

  it('глава 1: погасил долг — концовка, награда, следующая глава', () => {
    let s = finishIntro(newGame());
    expect(pendingStory(s)).toBeNull();
    s = { ...s, debt: 0 };
    expect(pendingStory(s)?.kind).toBe('outro');
    const next = finishChapter(s);
    expect(next.story.chapter).toBe(1);
    expect(next.rating).toBeCloseTo(s.rating + (CHAPTERS[0].reward.rating ?? 0));
    expect(pendingStory(next)?.kind).toBe('intro');
  });

  it('глава «Конкурент»: «МегаМарт» уводит гостей, после финала гостей больше', () => {
    const s = { ...newGame(), story: { chapter: 2, introSeen: true, ordersDone: 0, inspectionsPassed: 0 } };
    expect(storyGuests(s)).toBeLessThan(1);
    expect(guestsToday(s)).toBeLessThan(guestsToday(newGame()));
    expect(storyGuests({ ...s, story: { ...s.story, chapter: CHAPTERS.length } })).toBeGreaterThan(1);
  });

  it('план дня появляется у новой игры', () => {
    expect(ensurePlan(newGame()).plan?.day).toBe(1);
  });
});
