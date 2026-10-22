// «В гости к другу»: игра отправляет на сервер снимок своего магазина (как он выглядит: помещение,
// расстановка, полки с товаром, оформление, название), а друг открывает его у себя — только смотреть.
// Снимок приходит от другого игрока, поэтому при чтении всё проверяем и обрезаем.

import { newGame, PRODUCT_IDS, SHELF_KINDS, STORE_LEVELS, type Category, type ProductId, type Shelf, type StoreState } from './economy';
import { isDecorId, normalizeDecor, type DecorId } from './decor';

export interface ShopSnapshot {
  day: number;
  level: number;
  rating: number;
  shopName?: string;
  shelves: { kind: string; level: number; items: Record<string, number>; broken?: boolean }[];
  slotPos?: { level: number; at: { x: number; y: number }[] };
  tillPos?: { level: number; dx: number; short?: boolean };
  decor?: { owned: string[]; active: Record<string, string> };
  registers?: number;
}

/** Снимок своего магазина: сколько чего на полках, без складов и денег. */
export function shopSnapshot(state: StoreState): ShopSnapshot {
  return {
    day: state.day,
    level: state.level,
    rating: Math.round(state.rating * 10) / 10,
    ...(state.shopName ? { shopName: state.shopName } : {}),
    shelves: state.shelves.map((sh) => ({
      kind: sh.kind,
      level: sh.level,
      items: Object.fromEntries(PRODUCT_IDS.filter((id) => sh.items[id]?.length).map((id) => [id, sh.items[id]!.length])),
      ...(sh.broken ? { broken: true } : {}),
    })),
    ...(state.slotPos ? { slotPos: state.slotPos } : {}),
    ...(state.tillPos ? { tillPos: state.tillPos } : {}),
    decor: { owned: Object.values(state.decor.active).filter(Boolean) as string[], active: state.decor.active as Record<string, string> },
    ...(state.registers ? { registers: state.registers } : {}),
  };
}

const num = (v: unknown, min: number, max: number, fallback = min): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};
const int = (v: unknown, min: number, max: number, fallback = min): number => Math.round(num(v, min, max, fallback));

/**
 * Магазин друга как состояние для показа: новая игра + то, что видно в зале. Всё неизвестное
 * отбрасываем, числа ограничиваем. null — снимок негодный.
 */
export function friendState(raw: unknown, home: StoreState): StoreState | null {
  if (!raw || typeof raw !== 'object') return null;
  const snap = raw as Partial<ShopSnapshot>;
  const fresh = newGame();
  const level = int(snap.level, 0, STORE_LEVELS.length - 1);
  const shelves: Shelf[] = (Array.isArray(snap.shelves) ? snap.shelves : []).slice(0, 40).flatMap((sh) => {
    if (!sh || typeof sh !== 'object' || typeof sh.kind !== 'string' || !Object.hasOwn(SHELF_KINDS, sh.kind)) return [];
    const items: Shelf['items'] = {};
    for (const [id, n] of Object.entries(sh.items && typeof sh.items === 'object' ? sh.items : {})) {
      if (PRODUCT_IDS.includes(id as ProductId)) items[id as ProductId] = Array.from({ length: int(n, 0, 60) }, () => ({ age: 0 }));
    }
    return [{ kind: sh.kind as Category, level: int(sh.level, 0, 4), items, ...(sh.broken ? { broken: true } : {}) }];
  });
  const slotAt = snap.slotPos && Array.isArray(snap.slotPos.at) ? snap.slotPos.at.slice(0, 40).map((p) => ({ x: int(p?.x, 0, 400), y: int(p?.y, 0, 500) })) : null;
  const shopName = typeof snap.shopName === 'string' ? snap.shopName.slice(0, 16) : undefined;
  return {
    ...fresh,
    // Свои деньги и день остаются на виду — в гостях ничего не меняется.
    money: home.money,
    seed: home.seed,
    tourDone: true,
    story: home.story,
    level,
    day: int(snap.day, 1, 100000, 1),
    rating: num(snap.rating, 0, 5, 3),
    shelves,
    ...(shopName ? { shopName } : {}),
    ...(slotAt ? { slotPos: { level: int(snap.slotPos!.level, 0, 9), at: slotAt } } : {}),
    ...(snap.tillPos ? { tillPos: { level: int(snap.tillPos.level, 0, 9), dx: int(snap.tillPos.dx, -200, 0, 0), ...(snap.tillPos.short === true ? { short: true } : {}) } } : {}),
    decor: normalizeDecor({
      owned: Array.isArray(snap.decor?.owned) ? snap.decor.owned.filter((id): id is DecorId => typeof id === 'string' && isDecorId(id)) : [],
      active: snap.decor?.active && typeof snap.decor.active === 'object' ? (Object.fromEntries(Object.entries(snap.decor.active).filter(([, id]) => typeof id === 'string' && isDecorId(id))) as StoreState['decor']['active']) : {},
    }),
    ...(snap.registers ? { registers: int(snap.registers, 1, 4, 1) } : {}),
  };
}
