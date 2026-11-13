// Ломбард в подсобке (game/pawnshop.ts) в мире: полка «Разное» на стене склада, слева от таблички.
// На ней сначала невыкупленные вещи — с жёлтым ценником, их покупают (pawnMorning), — потом вещи в залоге.
// Картинки — art/pawnshop.py. Полка статичная (без анимации): в лёгкой графике ничего не меняется.

import type { StoreScene } from './StoreScene';
import { pawnOf, pawnOpen } from '../game/pawnshop';

/** Мест на полке и шаг между ними (точки мира); первое место — от левого края комнаты. */
const SLOTS = 3;
const STEP = 7;
const FIRST = 5;

interface Slot {
  item: Phaser.GameObjects.Image;
  tag: Phaser.GameObjects.Image;
}

/** Места полки по сценам: при перестройке мира картинки пересоздаются (buildWarehouse). */
const shelves = new WeakMap<StoreScene, Slot[]>();

/** Повесить полку в подсобку (из building.buildWarehouse). Ломбард ещё закрыт — полки нет. */
export function buildPawnShelf(scene: StoreScene): void {
  shelves.delete(scene);
  if (!pawnOpen(scene.state)) return;
  const { x, y } = scene.layout.warehouse;
  // Ниже стеллажа и таблички по глубине — они к стене ближе не бывают: полка висит над первым ярусом.
  const depth = y - 90;
  scene.art(x + 12, y + 6, 'pawn_shelf').setDepth(depth);
  shelves.set(
    scene,
    Array.from({ length: SLOTS }, (_, n) => ({
      item: scene.art(x + FIRST + n * STEP, y + 5, 'pawn_watch').setDepth(depth + 0.1).setVisible(false),
      tag: scene.art(x + FIRST + n * STEP + 2.5, y + 3, 'pawn_tag').setDepth(depth + 0.2).setVisible(false),
    })),
  );
  refreshPawnShelf(scene);
}

/** Что сейчас на полке: на продажу — первыми, потом залоги (из building.refreshWarehouse). */
export function refreshPawnShelf(scene: StoreScene): void {
  const slots = shelves.get(scene);
  if (!slots) return;
  const p = pawnOf(scene.state);
  const things = [...p.shelf.map((s) => ({ id: s.item, sale: true })), ...p.loans.map((l) => ({ id: l.item, sale: false }))];
  slots.forEach(({ item, tag }, n) => {
    if (!item.active || !tag.active) return;
    const thing = things[n];
    item.setVisible(Boolean(thing));
    tag.setVisible(Boolean(thing?.sale));
    if (thing) item.setTexture(`pawn_${thing.id}`);
  });
}
