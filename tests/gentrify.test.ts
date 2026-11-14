import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emptyDayStats, monthlyBill, newGame, PRODUCTS, STORE_LEVELS, type ProductId, type StoreState } from '../src/game/economy';
import {
  chooseGent,
  GENT_ASK,
  GENT_FROM,
  GENT_GOODWILL,
  GENT_MAX_LEFT,
  GENT_RENT,
  GENT_SEEN,
  GENT_SLACK,
  gentAsk,
  gentBill,
  gentDemand,
  gentGuests,
  gentLook,
  gentMorning,
  gentRises,
  gentSupply,
  gentTenantRent,
  gentTolerance,
  isPosh,
  OLD_FOLKS,
  poshShare,
  prestigeOf,
  prestigeTarget,
  type GentState,
} from '../src/game/gentrify';
import { residents, residentsNews } from '../src/game/residents';
import { met, regularById, regularState } from '../src/game/regulars';
import { goodwillOf } from '../src/game/goodwill';
import { priceFor, SUPPLIER_IDS, SUPPLIERS } from '../src/game/suppliers';
import { perceivedBase } from '../src/game/endless';
import { dayDemand } from '../src/game/demand';
import { guestFactor, nightCycle } from '../src/game/day';
import { pickNews } from '../src/game/headlines';
import { pendingTip, TIP_ICONS, type TipId } from '../src/game/tips';
import { simulate } from '../src/game/simulate';
import { zarAwayBill } from '../src/game/zarshop';
import type { HoodState } from '../src/game/hood';

// Район дорожает (gentrify.ts, 13.11): престиж района от жителей, доброго имени, рейтинга, мечт и благоустройства;
// растёт по шагу в утро и без случая; дорожают счета и прайс, новые берут дорогое; выбор «для кого магазин»,
// старые постоянные уезжают от цен; новость, подсказка, старые сохранения, симулятор.

const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 60, level: 2, money: 5000, debt: 0, rating: 4, seed: 7, ...over });
const HOOD4: HoodState = { lamps: 1, beds: 1, bikes: 1, bus: 1 };
/** Район цветёт: 18 семей, доброе имя 60, 5★, четыре улучшения, «Супермаркет» — заслужил больше 60. */
const rich = (over: Partial<StoreState> = {}): StoreState => shop({ level: 3, rating: 5, goodwill: 60, hood: HOOD4, residents: { n: 18 }, ...over });
const gent = (g: GentState, over: Partial<StoreState> = {}): StoreState => rich({ gentrify: g, ...over });
const zar = (s: StoreState): StoreState => ({ ...s, zar: { at: 'zar' } as StoreState['zar'] });

describe('престиж: старое сохранение и сколько заслужил район', () => {
  it('поля нет — престиж 0, всё как раньше', () => {
    const s = shop();
    expect(s.gentrify).toBeUndefined();
    expect(prestigeOf(s)).toBe(0);
    expect(gentBill(s)).toBe(1);
    expect(gentSupply(s)).toBe(1);
    expect(gentTenantRent(s)).toBe(1);
    expect(gentGuests(s)).toBe(1);
    expect(gentTolerance(s)).toBe(1);
    for (const id of Object.keys(PRODUCTS) as ProductId[]) expect(gentDemand(s, id)).toBe(1);
    expect(gentAsk(s)).toBe(false);
    expect(gentLook(s)).toBe('0');
  });

  it('новый магазин заслуживает немного: ни подсказки, ни выбора', () => {
    expect(prestigeTarget({ ...newGame(), day: 30 })).toBeLessThan(GENT_SEEN);
  });

  it('цветущий район заслуживает выбора; сумма не больше 100', () => {
    expect(prestigeTarget(rich())).toBeGreaterThanOrEqual(GENT_ASK);
    const all: HoodState = { lamps: 1, beds: 1, bikes: 1, bus: 1, mural: 1, benches: 1, fir: 1, fountain: 1, playground: 1, facades: 1, fair: 1, statue: 1 };
    expect(prestigeTarget(rich({ level: 5, goodwill: 100, residents: { n: 20 }, hood: all }))).toBe(100);
  });

  it('дурное имя и плохой рейтинг престижа не отнимают ниже нуля', () => {
    expect(prestigeTarget(shop({ goodwill: -100, rating: 1, level: 0, residents: { n: 4 } }))).toBe(0);
  });
});

describe('престиж: утро', () => {
  it('до GENT_FROM — тот же объект', () => {
    const s = rich({ day: GENT_FROM - 1 });
    expect(gentMorning(s)).toBe(s);
  });

  it('шаг в утро к заслуженному, детерминированно', () => {
    let s = rich();
    const target = prestigeTarget(s);
    for (let i = 0; i < 10; i++) s = gentMorning({ ...s, day: s.day + 1 });
    expect(prestigeOf(s)).toBe(10);
    // Тот же путь — тот же результат.
    let again = rich();
    for (let i = 0; i < 10; i++) again = gentMorning({ ...again, day: again.day + 1 });
    expect(again.gentrify).toEqual(s.gentrify);
    // Упёрлись в заслуженное — стоим.
    s = gent({ p: target });
    expect(prestigeOf(gentMorning(s))).toBe(target);
  });

  it('вниз — только когда район заметно отстал', () => {
    const target = prestigeTarget(rich());
    expect(prestigeOf(gentMorning(gent({ p: target + GENT_SLACK })))).toBe(target + GENT_SLACK);
    expect(prestigeOf(gentMorning(gent({ p: target + GENT_SLACK + 3 })))).toBe(target + GENT_SLACK + 2);
  });

  it('в Заречье район не меняется и ничего не дорожает', () => {
    const s = zar(gent({ p: 80 }));
    expect(gentMorning(s)).toBe(s);
    expect(gentBill(s)).toBe(1);
    expect(gentGuests(s)).toBe(1);
    expect(gentAsk(s)).toBe(false);
    expect(gentLook(s)).toBe('');
  });
});

describe('что дорожает', () => {
  it('счета: аренда и коммуналка на 100 престижа +8%', () => {
    const s = gent({ p: 100 });
    const plain = monthlyBill({ ...s, gentrify: undefined });
    const bill = monthlyBill(s);
    expect(plain.rent).toBe(STORE_LEVELS[s.level].rent);
    expect(bill.rent).toBe(Math.round(STORE_LEVELS[s.level].rent * (1 + GENT_RENT)));
    expect(bill.utilities).toBe(Math.round(STORE_LEVELS[s.level].utilities * (1 + GENT_RENT)));
    expect(bill.salaries).toBe(plain.salaries);
    expect(gentRises(gent({ p: 50 }))).toEqual({ rent: 4, supply: 2 });
  });

  it('Заречье: его доля счёта от престижа Центра не дорожает, доля Центра — дорожает', () => {
    const days = { home: 10, zar: 10 };
    // Сегодня в Центре: второй магазин — Заречье (ларёк), его счёт тот же при любом престиже.
    const home = (p: number) => gent({ p }, { zar: { at: 'home', since: 1, days, away: { level: 1, shelves: [], staff: [] } } as unknown as StoreState['zar'] });
    expect(zarAwayBill(home(100))).toEqual(zarAwayBill(home(0)));
    // Сегодня в Заречье: свой счёт без надбавки, а вот доля Центра (away) — с ней.
    const there = (p: number) => gent({ p }, { level: 1, shelves: [], staff: [], zar: { at: 'zar', since: 1, days, away: { level: 3 } } as unknown as StoreState['zar'] });
    const hot = zarAwayBill(there(100));
    const cold = zarAwayBill(there(0));
    expect(hot.rent).toBeGreaterThan(cold.rent);
    expect(monthlyBill(there(100)).rent - hot.rent).toBe(monthlyBill(there(0)).rent - cold.rent);
  });

  it('поставщики: прайс на 100 престижа +4%', () => {
    const s = gent({ p: 100 });
    const sid = SUPPLIER_IDS.find((id) => SUPPLIERS[id].products.meat !== undefined)!;
    const before = priceFor({ ...s, gentrify: undefined })(sid, 'meat')!;
    const after = priceFor(s)(sid, 'meat')!;
    expect(after).toBe(Math.max(1, Math.round(before * 1.04)));
    expect(after).toBeGreaterThan(before);
  });

  it('арендаторы флигеля платят больше — и когда хозяин в Заречье', () => {
    expect(gentTenantRent(gent({ p: 100 }))).toBeCloseTo(1.1);
    expect(gentTenantRent(zar(gent({ p: 100 })))).toBeCloseTo(1.1);
  });

  it('новые берут дорогое: мясо и своя марка — охотнее; «для новых» дешёвое — реже; «для своих» — слабее', () => {
    expect(isPosh('meat')).toBe(true);
    expect(isPosh('jam')).toBe(true);
    expect(isPosh('bread')).toBe(false);
    expect(isPosh('cigarettes')).toBe(false);
    const none = gent({ p: 100 });
    const r = gent({ p: 100, choice: 'rich' });
    const own = gent({ p: 100, choice: 'own' });
    expect(gentDemand(r, 'meat')).toBeGreaterThan(gentDemand(none, 'meat'));
    expect(gentDemand(none, 'meat')).toBeGreaterThan(gentDemand(own, 'meat'));
    expect(gentDemand(own, 'meat')).toBeGreaterThan(1);
    expect(gentDemand(r, 'potatoes')).toBeLessThan(1);
    expect(gentDemand(own, 'potatoes')).toBe(1);
    expect(gentDemand(none, 'potatoes')).toBe(1);
    // Через общий спрос дня (demand.ts).
    expect(dayDemand(r, 'meat') / dayDemand({ ...r, gentrify: undefined }, 'meat')).toBeCloseTo(gentDemand(r, 'meat'));
  });

  it('гости и терпимость к ценам: «для новых» — больше, «для своих» — меньше гостей', () => {
    const none = gent({ p: 100 });
    const r = gent({ p: 100, choice: 'rich' });
    const own = gent({ p: 100, choice: 'own' });
    expect(guestFactor(r) / guestFactor(none)).toBeCloseTo(gentGuests(r));
    expect(gentGuests(r)).toBeGreaterThan(1);
    expect(gentGuests(own)).toBeLessThan(1);
    expect(perceivedBase(r, 'meat')).toBeGreaterThan(perceivedBase(none, 'meat'));
    expect(perceivedBase(own, 'meat')).toBe(perceivedBase(none, 'meat'));
  });

  it('на улице: доля «новых» растёт с престижем, витрины соседей меняются ступенями', () => {
    expect(poshShare(shop())).toBe(0);
    expect(poshShare(gent({ p: 100 }))).toBeCloseTo(0.45);
    expect(gentLook(gent({ p: 39 }))).toBe('0');
    expect(gentLook(gent({ p: 40 }))).toBe('1');
    expect(gentLook(gent({ p: 70, choice: 'own' }))).toBe('2own');
  });
});

describe('выбор «для кого магазин»', () => {
  it('приходит, когда престиж дорос, — новостью утра впереди историй', () => {
    expect(gentAsk(gent({ p: GENT_ASK - 1 }))).toBe(false);
    const s = gent({ p: GENT_ASK });
    expect(gentAsk(s)).toBe(true);
    expect(pickNews(s, ['tale', 'residents', 'gentrify']).id).toBe('gentrify');
  });

  it('«для новых»: свои обижаются — доверие −2, доброе имя −10; второй раз не ответить', () => {
    const s = gent({ p: 50 });
    const next = chooseGent(s, 'rich')!;
    expect(next.gentrify).toEqual({ p: 50, choice: 'rich', day: s.day });
    expect(goodwillOf(next)).toBe(goodwillOf(s) - GENT_GOODWILL);
    for (const id of OLD_FOLKS) if (met(s, regularById(id))) expect(regularState(next, id).loyalty).toBe(regularState(s, id).loyalty - 2);
    expect(gentAsk(next)).toBe(false);
    expect(chooseGent(next, 'own')).toBeNull();
  });

  it('«для своих»: доверие +1, доброе имя +10', () => {
    const s = gent({ p: 50 });
    const next = chooseGent(s, 'own')!;
    expect(next.gentrify?.choice).toBe('own');
    expect(goodwillOf(next)).toBe(goodwillOf(s) + GENT_GOODWILL);
    expect(regularState(next, 'petr').loyalty).toBe(regularState(s, 'petr').loyalty + 1);
  });

  it('рано — нельзя', () => {
    expect(chooseGent(gent({ p: 10 }), 'rich')).toBeNull();
  });
});

describe('старые постоянные уезжают от цен', () => {
  /** Прожить утра (только престиж), не меняя остального. */
  function live(state: StoreState, days: number): StoreState[] {
    const out: StoreState[] = [];
    let s = state;
    for (let i = 0; i < days; i++) {
      s = gentMorning({ ...s, day: s.day + 1 });
      out.push(s);
    }
    return out;
  }

  it('«для новых»: кто-то уезжает, с прощальной историей; семей столько же; не больше двух', () => {
    const start = gent({ p: 80, choice: 'rich' });
    const days = live(start, 200);
    const end = days[days.length - 1];
    const left = end.gentrify?.left ?? [];
    expect(left.length).toBe(GENT_MAX_LEFT);
    expect(left[0]).toBe('petr');
    // Первый отъезд — новость утра от жителей: «уехал от цен», квартира не пустеет.
    const first = days.find((s) => s.gentrify?.left?.length)!;
    const news = residentsNews(first)!;
    expect(news).toMatchObject({ dir: -1, who: 'petr', why: 'rent', day: first.day });
    expect(residents(first)).toBe(residents(start));
    expect(first.residents?.gone).toContain('petr');
    expect(met(first, regularById('petr'))).toBe(false);
    // Детерминированно: тот же путь — тот же день отъезда.
    expect(live(start, 200).find((s) => s.gentrify?.left?.length)!.day).toBe(first.day);
  });

  it('«для своих» — никто не уезжает от цен', () => {
    const days = live(gent({ p: 80, choice: 'own' }), 200);
    expect(days.some((s) => s.gentrify?.left?.length)).toBe(false);
  });

  it('пока престиж невысок — никто не уезжает', () => {
    const days = live(gent({ p: 30 }, { goodwill: 0, rating: 3.5, hood: undefined, residents: { n: 12 } }), 100);
    expect(days.some((s) => s.gentrify?.left?.length)).toBe(false);
  });

  it('в день, когда в районе уже был переезд, второго нет', () => {
    let found = false;
    for (const s of live(gent({ p: 80, choice: 'rich' }), 200)) {
      if (!s.gentrify?.left?.length) continue;
      const prev = { ...s, day: s.day - 1, gentrify: { ...s.gentrify, left: [] }, residents: { n: residents(s) } };
      const moved = { ...prev, day: prev.day + 1, residents: { n: residents(s), move: { day: prev.day + 1, dir: 1 as const, tale: 0 } } };
      expect(gentMorning(moved).gentrify?.left ?? []).toEqual([]);
      found = true;
      break;
    }
    expect(found).toBe(true);
  });
});

describe('связки: ночь, подсказка, сохранение, симулятор', () => {
  it('ночь дня поднимает престиж на шаг', () => {
    const s = rich({ day: 40 });
    const night = nightCycle(s, emptyDayStats(), () => 0.5);
    expect(prestigeOf(night.state)).toBe(1);
  });

  it('первая подсказка — когда престиж стало видно; своя иконка', () => {
    const seenAll = (Object.keys(TIP_ICONS) as TipId[]).filter((id) => id !== 'gentrify');
    expect(pendingTip(gent({ p: GENT_SEEN }, { seenTips: seenAll }))).toBe('gentrify');
    expect(pendingTip(gent({ p: GENT_SEEN - 1 }, { seenTips: seenAll }))).toBeNull();
    const icons = Object.values(TIP_ICONS);
    expect(new Set(icons).size).toBe(icons.length);
  });

  describe('сохранение', () => {
    let local: Record<string, string> = {};
    beforeEach(() => {
      local = {};
      Object.assign(globalThis, {
        localStorage: { getItem: (k: string) => local[k] ?? null, setItem: (k: string, v: string) => (local[k] = v), removeItem: (k: string) => delete local[k] },
      });
    });
    afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

    it('старое сохранение грузится без поля; престиж переживает сохранение', async () => {
      const { loadGame, saveGame } = await import('../src/game/save');
      const old = { ...newGame(), day: 40 } as Record<string, unknown>;
      delete old.gentrify;
      local['magazinchik.save'] = JSON.stringify({ version: 11, state: old });
      const loaded = loadGame()!;
      expect(loaded.gentrify).toBeUndefined();
      expect(prestigeOf(loaded)).toBe(0);
      const g: GentState = { p: 55, choice: 'rich', day: 38, left: ['petr'] };
      saveGame({ ...loaded, gentrify: g });
      expect(loadGame()!.gentrify).toEqual(g);
    });
  });

  it('симулятор: без механики престиж не копится; с ней — банкротства нет, прибыль в пределах', () => {
    const off = simulate({ days: 120, seed: 2, features: { hood: true } });
    expect(off.final.gentrify).toBeUndefined();
    const on = simulate({ days: 120, seed: 2, features: { hood: true, gentrify: true }, gentrify: 'rich' });
    expect(on.bankruptDay).toBeNull();
    expect(prestigeOf(on.final)).toBeGreaterThan(0);
    const profit = (r: typeof on) => r.days.reduce((s, d) => s + d.profit, 0);
    expect(profit(on) / profit(off)).toBeGreaterThan(0.85);
    expect(profit(on) / profit(off)).toBeLessThan(1.25);
  });
});
