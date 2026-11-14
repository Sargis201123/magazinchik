// Скупленная улица в мире (game/estate.ts, art/estate.py; 13.11). Помещения — первые этажи домов южной стороны задней
// улицы (streets.ts buildBackStreet), по два ближних к парковке с каждой стороны: так их видно, если отвести камеру
// вверх, и они смотрят через дорогу на дома жителей. Не купленное — тёмные окна и во дворике «Продаётся» с ценой;
// купленное и пустое — тёмные окна; въезжает арендатор — вывеска без света и козлы у входа; работает — витрины
// вечером светятся, над входом его вывеска. Выкупил всю улицу — у перехода напротив входа столб с табличкой «ул. <название>»:
// её видно в обычном кадре. Всё неподвижное — в лёгкой графике то же самое, лишних эффектов нет.

import type { StoreScene } from './StoreScene';
import { estateLook, LOT_PRICES, lotOf, shopIn, shopSign, shopWorks, streetNamed } from '../game/estate';
import { t } from '../i18n';
import { inZar } from '../game/zarshop';
import { UI_FONT } from '../ui/dom';
import { storeLevel } from '../game/economy';
import * as lighting from './lighting';

/** Какие дома — помещения: левые края домов по сторонам от парковки (ближние первыми) → номер помещения. */
export function lotHomes(leftXs: number[], rightXs: number[]): Map<number, number> {
  // Номера вдоль улицы слева направо: второй и первый слева, первый и второй справа (estate.ts LOT_PRICES).
  const order = [leftXs[1], leftXs[0], rightXs[0], rightXs[1]];
  const out = new Map<number, number>();
  order.forEach((x, i) => {
    if (x !== undefined && i < LOT_PRICES.length) out.set(x, i);
  });
  return out;
}

/** Окна первого этажа пустуют (не куплено, пустое помещение или ещё отделка) — дом рисует их тёмными. */
export const lotDark = (scene: StoreScene, i: number): boolean => !shopWorks(scene.state, i);

const label = (scene: StoreScene, x: number, y: number, text: string, size: number, color: string, depth: number, maxW: number) => {
  const txt = scene.add.text(x, y, text, { fontFamily: UI_FONT, fontSize: `${size}px`, fontStyle: 'bold', color, align: 'center' }).setOrigin(0.5).setResolution(scene.textRes(6)).setDepth(depth);
  if (txt.width > maxW) txt.setScale(maxW / txt.width);
  return txt;
};

/**
 * Помещение i на доме фасадом вверх (к задней улице): doorX — середина дома, front — верх фасада, yardY — верх
 * дворика между тротуаром и фасадом. Рисует поверх дома (он уже нарисован streets.ts home).
 */
export function dressLot(scene: StoreScene, i: number, doorX: number, front: number, yardY: number): void {
  const lot = lotOf(scene.state, i);
  const kind = shopIn(scene.state, i);
  const depth = -2.6;
  if (!lot) {
    // Во дворике у дорожки — «Продаётся» с ценой.
    const x = doorX + 22;
    const y = yardY + 5;
    scene.art(x, y, 'estate_sale').setDepth(depth);
    label(scene, x, y - 3.2, t('estate.sale'), 3.2, '#a22633', depth + 0.01, 18);
    label(scene, x, y + 0.6, `${LOT_PRICES[i]} 💰`, 3, '#262b44', depth + 0.01, 18);
    return;
  }
  if (!kind) return;
  // Вывеска над входом: на кромке фасада со стороны улицы.
  const signY = front - 1;
  scene.art(doorX, signY, `estate_sign_${kind}`).setDepth(depth);
  label(scene, doorX + 3.5, signY, t(shopSign(kind)), 4.2, '#fee761', depth + 0.01, 30);
  if (!shopWorks(scene.state, i)) {
    // Въезжает: у входа козлы, витрины ещё тёмные.
    scene.art(doorX + 22, yardY + 6, 'estate_works').setDepth(depth);
    return;
  }
  // Работает: витрины по сторонам от двери, вечером светятся и бросают свет во дворик.
  for (const dx of [-24, 24]) {
    scene.art(doorX + dx, front + 4.5, 'shopwin').setDepth(-2.7);
    lighting.windowLight(scene, doorX + dx, front + 4.5, front, true, 0.2 + i * 0.1);
  }
}

/** Название магазина для таблички (как на вывеске: своё имя или имя помещения). Сцена не тянет ui/estate.ts. */
const streetTitle = (scene: StoreScene): string => scene.state.shopName?.trim() || t(storeLevel(scene.state).nameKey);

/** Табличка «ул. <название магазина>» на столбе у перехода напротив входа — когда вся улица наша. */
export function buildPlate(scene: StoreScene, top: number): void {
  if (inZar(scene.state) || !streetNamed(scene.state)) return;
  // На том тротуаре, у перехода напротив двери: в обычном кадре его видно целиком, а на своём тротуаре высокий столб
  // заслонял бы витрину (сверху он ложится на фасад).
  const x = scene.layout.door.x + 30;
  const y = top + 72;
  scene.art(x, y, 'estate_plate').setOrigin(0.5, 0.95).setDepth(y);
  label(scene, x, y - 25.5, t('estate.plate', { name: streetTitle(scene) }), 4.5, '#ffffff', y + 0.01, 27);
}

/** Запомнить, с чем построена улица (morningFlow.ts сравнивает и перестраивает мир). */
export const markBuilt = (scene: StoreScene): void => {
  scene.builtEstate = estateLook(scene.state);
};
