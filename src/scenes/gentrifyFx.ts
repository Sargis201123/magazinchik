// Район дорожает на улице (game/gentrify.ts, art/gentrify.py; 13.11). Чем выше престиж, тем больше прохожих в пальто
// и длинных чёрных машин у магазина; с GENT_LOOK1 цветочный по соседству становится кофейней третьей волны (штендер
// с чашкой у двери), с GENT_LOOK2 аптека — барбершопом. Ответ на выбор тоже видно у вывески на крыше: «для новых» —
// золотая табличка, «для своих» — дощечка с сердечком. Всё это — только картинки (Math.random можно); перестройка мира
// утром, когда сменился gentLook (morningFlow.ts). В лёгкой графике — без штендера, витрины соседей меняются.

import type { StoreScene } from './StoreScene';
import { GENT_LOOK1, GENT_LOOK2, gentChoice, poshShare, prestigeOf } from '../game/gentrify';
import { inZar } from '../game/zarshop';
import { HYPER_LEVEL } from '../game/economy';
import type { Look } from './common';
import type { TextKey } from '../i18n';

/** Пальто «новых»: чёрное, тёмно-синее, верблюжье, графит; шарф — яркий. */
const POSH_COATS = [0x181425, 0x262b44, 0xb86f50, 0x5a6988];
const POSH_SCARVES = [0xe43b44, 0xfee761, 0xc0cbdc, 0xb55088];
/** Дорогая машина на улице — реже, чем прохожий в пальто: половина доли «новых». */
const LUX_CAR_SHARE = 0.5;
/** Дорогая машина: всегда своего цвета (не под тинт), вес — как у обычных (common.ts CAR_TYPES). */
export const LUX_CAR: [string, number | null, number] = ['car_lux', null, 0];

const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

/** Прохожий из «новых»: в пальто с ярким шарфом, иногда в тёмных очках. Остальные — как были. */
export function poshLook(scene: StoreScene, look: Look): Look {
  if (Math.random() >= poshShare(scene.state)) return look;
  return { ...look, coat: pick(POSH_COATS), scarf: pick(POSH_SCARVES), bag: 'bag', bagTint: 0xfeae34, ...(Math.random() < 0.3 && !look.face ? { face: 'sunglasses' as const } : {}) };
}

/** Сегодня эта машина — дорогая (на дороге и на парковке). */
export const luxCar = (scene: StoreScene): boolean => Math.random() < poshShare(scene.state) * LUX_CAR_SHARE;

/** Соседи по улице, которые сменились: имя вывески → новая вывеска и цвета (streets.ts buildNeighbors). */
export function neighborSwap(scene: StoreScene, name: TextKey): { name: TextKey; sign: number; awning: number; roof: number; neon: number } | null {
  if (inZar(scene.state)) return null;
  const p = prestigeOf(scene.state);
  if (name === 'neighbor.bakery' && p >= GENT_LOOK1) return { name: 'neighbor.coffee3', sign: 0x181425, awning: 0x262b44, roof: 0xe8e8e8, neon: 0xffffff };
  if (name === 'neighbor.pharmacy' && p >= GENT_LOOK2) return { name: 'neighbor.barber', sign: 0x262b44, awning: 0xa22633, roof: 0xdcdce4, neon: 0xff6070 };
  return null;
}

/**
 * У двери и на вывеске: штендер кофейни (coffeeDoor — дверь соседа-кофейни, нет — её нет); у нас слева от
 * вывески на крыше — золотая табличка («для новых») или дощечка с сердечком («для своих»): вывеску видно в обычном
 * кадре. У входа места нет (прокат, будка, меню) — туда не ставим. w — ширина зала.
 */
export function dressStreet(scene: StoreScene, w: number, coffeeDoor: number | null, coffeeBase: number): void {
  if (inZar(scene.state)) return;
  if (coffeeDoor !== null && !scene.lite) scene.art(coffeeDoor + 15, coffeeBase + 5, 'gent_board').setDepth(coffeeBase + 8);
  const c = gentChoice(scene.state);
  // Вывеска на крыше (building.ts): у гипермаркета вдвое шире.
  const half = scene.state.level >= HYPER_LEVEL ? 48 : 32;
  if (c === 'rich') {
    // Слева от вывески: справа у неё свои огоньки и щиток (nightShift.signLights).
    scene.art(w / 2 - half - 9, -9, 'gent_plaque').setDepth(3);
  } else if (c === 'own') scene.art(w / 2 - half - 8, -8, 'gent_own').setDepth(3);
}
