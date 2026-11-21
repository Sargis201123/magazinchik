// Поток гостей сверх зала. 21.11, автор: «Большие проблемы с рекламой — нет трафика от людей. Скажем, 35 в день
// посещало, так и дальше посещает. И это на всех уровнях».
//
// Замер в настоящей сцене (тот же день, что у симулятора): на «Супермаркете» утром ждали ~136 гостей, кассы
// успевают ~185, а зашло 43 и купили 38. Гостей держала не экономика, а предел покупателей в зале (maxCustomers):
// каждый ходит по залу ~20 с, и больше ~45 за 90 с через зал не проходит, сколько ни зови рекламой, арендаторами и
// жителями — они только укорачивали промежуток между гостями, а тот уже ничего не решал.
//
// Теперь так: зал полон, а гость пришёл — он не ждёт за дверью, а берёт своё «на бегу» (1–2 товара с полок, как все)
// и встаёт к кассам, которые работают без хозяина: сменщик, кассиры, киоски. Пробивают его в свободное от зала
// время касс (credit), так что всего за день пробьют не больше, чем кассы успевают, — как в симуляторе
// (serveCapacity). Пустая полка — он уходит ни с чем (empty), дорого — уходит (expensive), очередь к кассам длиннее,
// чем они пробьют за терпение покупателя, — лишние уходят (queue). Без кассиров и киосков (ларёк, хозяин один за
// кассой) такого потока нет: гостей пробивает сам игрок касаниями, и предел зала — это предел его рук.
// Сцена — scenes/crowdFx.ts, итог дня — строкой в итогах (ui/hud.ts).

import {
  buyChance,
  cashierScan,
  checkoutSeconds,
  DAY_SECONDS,
  shelfFor,
  staffOf,
  takeFromShelf,
  unitSalePrice,
  type CartItem,
  type LostReason,
  type ProductId,
  type StaffMember,
  type StoreState,
} from './economy';
import { perceivedBase } from './endless';
import { loyaltyTolerance, withUpgrades } from './upgrades';
import { fairTodayTolerance } from './fair';
import { registerCount, RELIEF_ROLE, TILL_ROLES } from './registers';
import { REGISTER_JAM_SECONDS, registerJam } from './gear';
import { warLeaves } from './war';
import { crisisTolerance } from './crisis';
import { radioTolerance } from './radio';
import { kioskCount, kioskTier } from './lanes';
import { ownerTiming } from './owner';
import { rhythmSeconds } from './tillRhythm';
import { adTrust } from './ads';

// ---------- Сколько успевают кассы (было в simulate.ts; теперь его считают и сцена, и симулятор) ----------

/** Средняя корзина в штуках. */
export const AVG_BASKET = 1.4;
/** Один игрок стоит за кассой не весь день: ещё бегает на склад и убирает — в большом магазине дел больше. */
const ownerAtRegister = (level: number): number => 0.65 - 0.07 * level;
/** Подойти к кассе и отойти — секунды на каждого покупателя. */
const QUEUE_STEP_SECONDS = 0.3;
/** Сменщик за кассой хозяина весь день, а хозяин между делами касается кассы — пробивка чуть быстрее (в игре касаниями срезают до 30%). */
const RELIEF_TAPS = 1.1;
/** Киоск занят не весь день (к нему идут с небольшой корзиной), дойти и уложить покупки — секунды. */
const KIOSK_BUSY = 0.5;
const KIOSK_WALK_SECONDS = 2;
/** Какая доля гостей с корзиной не больше maxItems штук (корзина в среднем AVG_BASKET). */
export const smallBasket = (maxItems: number): number => (maxItems >= 3 ? 0.9 : 0.75);

/**
 * Сколько покупателей реально пробить за день (total) и сколько из них — сам хозяин (owner):
 * пробивка занимает время и зависит от навыка.
 */
export function serveCapacity(state: StoreState): { total: number; owner: number; kiosk: number } {
  // Старая касса иногда заедает — в среднем столько секунд на покупателя.
  const jam = registerJam(state) * REGISTER_JAM_SECONDS;
  // Хозяин пробивает в ритме (tillRhythm.ts, 13.11): средний игрок — то в такт (быстрее), то как прежде.
  const owner = rhythmSeconds(withUpgrades(state, ownerTiming(state)), AVG_BASKET) + QUEUE_STEP_SECONDS + jam;
  const share = ownerAtRegister(state.level);
  const ownerCap = Math.floor((DAY_SECONDS * share) / owner);
  const cashierCap = (m: StaffMember, part: number) =>
    Math.floor((DAY_SECONDS * part) / (checkoutSeconds(withUpgrades(state, cashierScan(m)), AVG_BASKET) + QUEUE_STEP_SECONDS + jam));
  // Первая касса — хозяина: он за ней между другими делами. Нанят сменщик — за ней весь день он,
  // а хозяин свободен и только торопит его касаниями.
  const relief = staffOf(state, RELIEF_ROLE);
  let total = relief ? Math.floor(cashierCap(relief, 1) * RELIEF_TAPS) : ownerCap;
  // Остальные кассы — у каждой свой кассир; без кассира касса стоит закрытой.
  for (const role of TILL_ROLES.slice(0, registerCount(state) - 1)) {
    const m = staffOf(state, role);
    if (m) total += cashierCap(m, 1);
  }
  return { total, owner: relief ? 0 : ownerCap, kiosk: kioskCapacity(state) };
}

/** Сколько покупателей за день пробьют себя сами на киосках (lanes.ts). */
export function kioskCapacity(state: StoreState): number {
  const n = kioskCount(state);
  if (!n) return 0;
  const tier = kioskTier(state);
  const items = Math.min(tier.maxItems, AVG_BASKET);
  return Math.floor((n * DAY_SECONDS * KIOSK_BUSY) / (items * tier.item + tier.pay + KIOSK_WALK_SECONDS));
}

/**
 * Сколько гостей за день пробивают кассы без касаний хозяина: сменщик, кассиры, киоски (с небольшой корзиной).
 * Хозяйская доля сюда не входит: её пробивает сам игрок — гостей в зале.
 */
export function autoCapacity(state: StoreState): number {
  const cap = serveCapacity(state);
  return cap.total - cap.owner + Math.round(cap.kiosk * smallBasket(kioskTier(state).maxItems));
}

// ---------- Поток сверх зала ----------

/** Свободная касса копит время впрок не больше чем на столько гостей: простой утром днём не догнать. */
export const CREDIT_MAX = 2;
/** Гости зала у автоматических касс могут «занять» время вперёд не больше чем на столько. */
export const CREDIT_DEBT = 2;
/** Сколько секунд гость сверх зала ждёт кассу — как терпение в зале (scenes/common.ts PATIENCE_MS). */
export const QUICK_PATIENCE = 20;

export interface Flow {
  /** Гостей в секунду пробивают кассы без хозяина (autoCapacity / DAY_SECONDS); 0 — потока сверх зала нет. */
  rate: number;
  /** Стоят у касс сверх зала — у каждого своя корзина (товар уже снят с полок). */
  carts: CartItem[][];
  /** Свободное время касс, в гостях. */
  credit: number;
  /** За день: пришли сверх зала, купили, ушли ни с чем (из них не дождались кассы — queue), принесли денег. */
  came: number;
  served: number;
  lost: number;
  queue: number;
  revenue: number;
}

export const newFlow = (state: StoreState): Flow => ({
  rate: autoCapacity(state) / DAY_SECONDS,
  carts: [],
  credit: 0,
  came: 0,
  served: 0,
  lost: 0,
  queue: 0,
  revenue: 0,
});

/** Зал полон, а гость пришёл: если кассы без хозяина есть — он идёт «на бегу» (true), иначе ждёт места в зале. */
export function flowArrive(f: Flow): boolean {
  if (f.rate <= 0) return false;
  f.came++;
  return true;
}

/** Набрал корзину (quickPick) — встаёт к кассам; ничего не взял — ушёл (lost — с причиной, как в зале). */
export function flowJoin(f: Flow, pick: QuickPick): void {
  if (pick.cart.length) f.carts.push(pick.cart);
  else if (pick.why) f.lost++;
}

/** Гостя зала пробил кассир, сменщик или киоск: это время касс уже занято. */
export function flowUsed(f: Flow): void {
  if (f.rate > 0) f.credit = Math.max(-CREDIT_DEBT, f.credit - 1);
}

/**
 * Прошло dt секунд: кассы освобождаются. Очередь длиннее, чем кассы пробьют за терпение покупателя, —
 * дольше всех ждавшие уходят, оставив корзины (возвращает их: товар — обратно на полки).
 */
export function flowTick(f: Flow, dt: number): CartItem[][] {
  if (f.rate <= 0) return [];
  f.credit = Math.min(CREDIT_MAX, f.credit + f.rate * dt);
  const room = Math.max(1, Math.ceil(f.rate * QUICK_PATIENCE));
  const gone = f.carts.length > room ? f.carts.splice(0, f.carts.length - room) : [];
  f.lost += gone.length;
  f.queue += gone.length;
  return gone;
}

/** Касса свободна и кто-то ждёт — его корзину пробивают (время кассы списано); null — некого или некому. */
export function flowNext(f: Flow): CartItem[] | null {
  if (!f.carts.length || f.credit < 1) return null;
  f.credit--;
  return f.carts.shift() ?? null;
}

export interface QuickPick {
  state: StoreState;
  cart: CartItem[];
  /** Ушёл ни с чем — почему (как у гостей зала, losses.ts); undefined — просто ничего не приглянулось. */
  why?: LostReason;
  id?: ProductId;
}

/**
 * Покупка «на бегу»: что хотел (wanted — как у гостей зала, StoreScene.wanted) — с полок, по тем же ценам и тому же
 * шансу «взять», что у гостя в зале (shoppers.ts tryTake). Полки пустеют по-настоящему; платит у кассы (checkout).
 */
export function quickPick(state: StoreState, wanted: ProductId[], random: () => number): QuickPick {
  let s = state;
  const cart: CartItem[] = [];
  let why: LostReason | undefined;
  let id: ProductId | undefined;
  for (const want of new Set(wanted)) {
    const index = shelfFor(s, want);
    if (index < 0) continue;
    const oldest = s.shelves[index]?.items[want]?.[0];
    if (!oldest) {
      if (!why) {
        why = 'empty';
        id = want;
      }
      continue;
    }
    if (random() < warLeaves(s, want)) {
      why ??= 'eduard';
      continue;
    }
    const price = Math.ceil(unitSalePrice(s, want, oldest));
    const fair = perceivedBase(s, want) * fairTodayTolerance(s) * loyaltyTolerance(s) * radioTolerance(s) * adTrust(s) * crisisTolerance(s, want);
    if (random() < buyChance(price, fair)) {
      const taken = takeFromShelf(s, index, want);
      if (!taken) continue;
      s = taken.state;
      cart.push({ id: want, unit: taken.unit });
    } else if (price > fair && !why) {
      why = 'expensive';
      id = want;
    }
  }
  return cart.length ? { state: s, cart } : { state: s, cart, why, id };
}
