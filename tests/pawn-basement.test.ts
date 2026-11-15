import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newGame, STORE_LEVELS, type StoreState } from '../src/game/economy';
import {
  PAWN_FROM_LEVEL,
  pawnMorning,
  pawnOf,
  pawnOffer,
  pawnPlace,
  pawnSlots,
  pawnWaiting,
  refusePawn,
  takePawn,
  type PawnLoan,
} from '../src/game/pawnshop';
import { buyFloor, FLOORS } from '../src/game/floors';
import { BACK_PAWN_SLOTS } from '../src/game/basement';
import { catchUpTips, pendingTip, seeTip, TIP_ICONS, tipTextKey, type TipId } from '../src/game/tips';
import { BACK_DOOR_HALF, PAWN_DOOR_HALF, layoutFor, pawnDoorX } from '../src/scenes/layout';
import { BACK_ROOM_FROM } from '../src/game/tenants';
import { ru } from '../src/i18n/ru';
import { en } from '../src/i18n/en';
import { es } from '../src/i18n/es';
import { pt } from '../src/i18n/pt';
import { tr } from '../src/i18n/tr';
import { kk } from '../src/i18n/kk';
import { uz } from '../src/i18n/uz';

// 15.11, автор: «Ломбард тоже мне непонятен — может убрать из меню и в подвале его держать как комнату в подвале
// со своей вывеской». Ломбард — место в мире: до подвала дверь «Подсобка» в зале, с подвалом — комната внизу.
// Правила и деньги те же; гость, которого утро не показало, ждёт весь день (pawnWaiting); старые сохранения —
// как были; тем, кто пользовался ломбардом в «Уголках», — одна карточка «Ломбард переехал».

const shop = (over: Partial<StoreState> = {}): StoreState => ({ ...newGame(), day: 40, seed: 7, level: PAWN_FROM_LEVEL, money: 20000, history: Array(7).fill(4000), ...over });
const used = (over: Partial<StoreState> = {}): StoreState => shop({ pawn: { loans: [], shelf: [], earned: 0, lost: 0 }, ...over });
const withBasement = (s: StoreState): StoreState => ({ ...s, floors: { basement: { since: s.day - 5, finish: 0 } } });
const loan = (over: Partial<PawnLoan> = {}): PawnLoan => ({ item: 'watch', lent: 1000, back: 1150, day: 38, due: 41, fate: 'repay', ...over });

/** Утро, когда к ломбарду пришёл гость (у «использованного» ломбарда — не каждое утро). */
const dayWithOffer = (base: (day: number) => StoreState): StoreState => {
  for (let day = 40; day < 140; day++) if (pawnOffer(base(day))) return base(day);
  throw new Error('за сто утр никто не пришёл');
};

describe('где ломбард', () => {
  it('закрыт до «Минимаркета»; до подвала — в зале, с подвалом — внизу', () => {
    expect(pawnPlace(shop({ level: PAWN_FROM_LEVEL - 1 }))).toBeNull();
    expect(pawnPlace(shop())).toBe('hall');
    expect(pawnPlace(withBasement(shop()))).toBe('basement');
    // Подвал покупают в меню — и ломбард сразу «переезжает» вниз, без своего поля в сохранении.
    const bought = buyFloor(shop({ money: 1e6 }), 'basement')!;
    expect(bought).not.toBeNull();
    expect(pawnPlace(bought)).toBe('basement');
    expect(bought.pawn).toBeUndefined();
  });

  it('в Заречье ломбарда нет вовсе — ни двери в зале, ни комнаты', () => {
    const zar = shop({ zar: { at: 'zar' } as StoreState['zar'] });
    expect(pawnPlace(zar)).toBeNull();
    expect(pawnPlace(withBasement(zar))).toBeNull();
    expect(pawnDoorX(layoutFor(PAWN_FROM_LEVEL), zar)).toBeNull();
    expect(pawnWaiting(zar)).toBe(false);
  });
});

describe('гость ждёт ответа весь день', () => {
  it('pawnWaiting — то же, что гость дня: от зерна и дня, без случайности', () => {
    const s = dayWithOffer((day) => used({ day }));
    expect(pawnWaiting(s)).toBe(true);
    expect(pawnWaiting({ ...s })).toBe(true);
    expect(pawnOffer(s)).toEqual(pawnOffer({ ...s }));
    for (let day = 40; day < 80; day++) expect(pawnWaiting(used({ day }))).toBe(pawnOffer(used({ day })) !== null);
  });

  it('взяли — деньги из кассы ушли гостю, вещь в залоге, метка гаснет', () => {
    const s = dayWithOffer((day) => used({ day }));
    const offer = pawnOffer(s)!;
    const took = takePawn(s)!;
    expect(took.money).toBe(s.money - offer.lent);
    expect(pawnOf(took).loans).toHaveLength(1);
    expect(pawnOf(took).loans[0]).toMatchObject({ item: offer.item, lent: offer.lent, back: offer.back, day: s.day, due: s.day + offer.days });
    expect(pawnWaiting(took)).toBe(false);
  });

  it('отказали — деньги на месте, метка гаснет, второго гостя за день нет', () => {
    const s = dayWithOffer((day) => used({ day }));
    const no = refusePawn(s);
    expect(no.money).toBe(s.money);
    expect(pawnWaiting(no)).toBe(false);
    expect(pawnOffer(no)).toBeNull();
  });

  it('денег в кассе мало — взять нельзя, гость всё ждёт', () => {
    const s = dayWithOffer((day) => used({ day }));
    const poor = { ...s, money: 0 };
    expect(takePawn(poor)).toBeNull();
    expect(pawnWaiting(poor)).toBe(true);
  });

  it('места в залоге кончились — гость не приходит и не ждёт', () => {
    const full = used({ pawn: { loans: [loan(), loan({ item: 'ring' })], shelf: [], earned: 0, lost: 0 } });
    expect(pawnSlots(full)).toBe(2);
    for (let day = 40; day < 60; day++) expect(pawnWaiting({ ...full, day })).toBe(false);
  });

  it('в подвале правила те же: тот же гость и те же деньги, что в зале', () => {
    for (let day = 40; day < 70; day++) {
      const hall = used({ day });
      const down = withBasement(hall);
      expect(pawnOffer(down)).toEqual(pawnOffer(hall));
      const a = takePawn(hall);
      const b = takePawn(down);
      expect(b?.money).toBe(a?.money);
      expect(b?.pawn).toEqual(a?.pawn);
    }
  });

  it('«серая» подсобка внизу — на две вещи больше, как раньше', () => {
    const down = withBasement(shop());
    const back = { ...down, basement: { slots: 0, parts: ['back' as const] } };
    expect(pawnSlots(back)).toBe(pawnSlots(down) + BACK_PAWN_SLOTS);
  });

  it('утро ломбарда не зависит от места: выкуп, полка и полиция дают те же деньги', () => {
    const loans = [loan({ due: 40 }), loan({ item: 'ring', fate: 'forfeit', due: 40 }), loan({ item: 'phone', fate: 'stolen', due: 42, police: 40 })];
    const hall = used({ pawn: { loans, shelf: [{ item: 'bike', price: 800, lent: 500, day: 35 }], earned: 0, lost: 0 } });
    const a = pawnMorning(hall);
    const b = pawnMorning(withBasement(hall));
    expect(b.money).toBe(a.money);
    expect(b.rating).toBe(a.rating);
    expect(b.pawn).toEqual(a.pawn);
    // Выкуп: +1150; полиция: −0 в кассу (деньги ушли раньше), рейтинг чуть ниже.
    expect(a.money).toBeGreaterThanOrEqual(hall.money + 1150);
    expect(a.rating).toBeLessThan(hall.rating);
  });
});

describe('карточка «Новое!»', () => {
  const seenAll = (s: StoreState, but: TipId[]): StoreState => ({ ...s, tipDay: undefined, seenTips: (Object.keys(TIP_ICONS) as TipId[]).filter((id) => !but.includes(id)) });

  it('новичку — одна карточка ломбарда: «Понятно» отмечает и «переехал»', () => {
    const s = seenAll(shop(), ['pawn', 'pawnMoved']);
    expect(pendingTip(s)).toBe('pawn');
    const seen = seeTip(s, 'pawn');
    expect(seen.seenTips).toContain('pawnMoved');
    expect(pendingTip({ ...seen, pawn: { loans: [], shelf: [], earned: 0, lost: 0 } })).toBeNull();
  });

  it('кто пользовался ломбардом в «Уголках» — «Ломбард переехал», один раз', () => {
    const old = seenAll(used(), ['pawnMoved']);
    expect(pendingTip(old)).toBe('pawnMoved');
    expect(pendingTip(seeTip(old, 'pawnMoved'))).toBeNull();
    // Ломбард ещё ни разу не приходил (state.pawn нет) — сказать нечего.
    expect(pendingTip(seenAll(shop(), ['pawnMoved']))).toBeNull();
  });

  it('текст — по месту: дверь в зале или окошко в подвале', () => {
    expect(tipTextKey(shop(), 'pawn')).toBe('tip.pawn.text');
    expect(tipTextKey(withBasement(shop()), 'pawn')).toBe('tip.pawn.down');
    expect(tipTextKey(withBasement(used()), 'pawnMoved')).toBe('tip.pawnMoved.down');
    expect(tipTextKey(withBasement(shop()), 'basement')).toBe('tip.basement.text');
    for (const dict of [ru, en, es, pt, tr, kk, uz] as Record<string, string>[]) {
      for (const key of ['tip.pawn.text', 'tip.pawn.down', 'tip.pawnMoved.title', 'tip.pawnMoved.text', 'tip.pawnMoved.down', 'pawn.door', 'pawn.sign']) expect(dict[key], key).toBeTruthy();
    }
  });

  it('вернувшийся игрок: догонялка отмечает ломбард, а «переехал» придёт, только если он им пользовался', () => {
    const OLD = ['broke', 'ownerTill', 'alone', 'weekly', 'fair', 'loyalty', 'delivery', 'register2', 'oven', 'coffee', 'nightShift'];
    const back = catchUpTips(shop({ day: 61, seenTips: OLD }));
    expect(back.seenTips).toContain('pawn');
    expect(back.seenTips).not.toContain('pawnMoved');
  });
});

describe('дверь «Подсобка» в зале', () => {
  const levels = STORE_LEVELS.map((_, i) => i).filter((i) => i >= PAWN_FROM_LEVEL);

  it('есть, пока нет подвала; с подвалом и до «Минимаркета» — нет', () => {
    for (const level of levels) {
      expect(pawnDoorX(layoutFor(level), shop({ level }))).not.toBeNull();
      expect(pawnDoorX(layoutFor(level), withBasement(shop({ level })))).toBeNull();
    }
  });

  it('между последней полкой у стены и туалетом, не на двери задней комнаты; у туалета ещё помещается щиток', () => {
    for (const level of levels) {
      const layout = layoutFor(level);
      const x = pawnDoorX(layout, shop({ level }))!;
      const wall = layout.slots.filter((p) => p.y === layout.slots[0].y);
      const lastShelf = Math.max(...wall.map((p) => p.x)) + 20;
      expect(x - PAWN_DOOR_HALF, `уровень ${level}`).toBeGreaterThanOrEqual(lastShelf);
      // Туалет — 16 точек по ширине; между ним и дверью — щиток (8 точек).
      expect(x + PAWN_DOOR_HALF + 8, `уровень ${level}`).toBeLessThanOrEqual(layout.wc.x - 8);
      const back = layout.tenants.find((r) => r.back);
      if (level >= BACK_ROOM_FROM && back) expect(x - PAWN_DOOR_HALF, `уровень ${level}`).toBeGreaterThanOrEqual(back.doorway.x + BACK_DOOR_HALF);
    }
  });

  it('подвал открывается только с «Минимаркета» — дверь «Подсобка» есть у всех, у кого ломбард ещё в зале', () => {
    expect(FLOORS.basement.minLevel).toBe(PAWN_FROM_LEVEL);
  });
});

describe('старое сохранение', () => {
  let local: Record<string, string> = {};
  beforeEach(() => {
    vi.resetModules();
    local = {};
    Object.assign(globalThis, {
      localStorage: { getItem: (k: string) => local[k] ?? null, setItem: (k: string, v: string) => (local[k] = v), removeItem: (k: string) => delete local[k] },
    });
  });
  afterEach(() => delete (globalThis as Record<string, unknown>).localStorage);

  it('ломбард из «Уголков» грузится как был: залоги, полка и итог на месте, ломбард — в зале', async () => {
    const { loadGame } = await import('../src/game/save');
    const pawn = { loans: [loan({ day: 58, due: 62 })], shelf: [{ item: 'camera' as const, price: 960, lent: 600, day: 57 }], earned: 300, lost: 100, answered: 59 };
    local['magazinchik.save'] = JSON.stringify({ version: 11, state: { ...shop({ day: 60 }), pawn } });
    const s = loadGame()!;
    expect(s.pawn).toEqual(pawn);
    expect(pawnPlace(s)).toBe('hall');
    expect(pawnOf(s).loans).toHaveLength(1);
  });

  it('без поля pawn и floors — ломбарда ещё не было, первый гость придёт как раньше', async () => {
    const { loadGame } = await import('../src/game/save');
    const old = shop({ day: 45 }) as unknown as Record<string, unknown>;
    delete old.pawn;
    delete old.floors;
    local['magazinchik.save'] = JSON.stringify({ version: 11, state: old });
    const s = loadGame()!;
    expect(s.pawn).toBeUndefined();
    expect(pawnPlace(s)).toBe('hall');
    expect(pawnWaiting(s)).toBe(true);
  });
});
