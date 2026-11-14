// «Крыша» в зале и на улице (game/racket.ts; 13.11). Что решил хозяин, видно утром у входа: разбитая витрина
// (трещины и осколки на тротуаре), мусорные мешки у двери, «Фургон опаздывает…» — когда фургону прокололи шины
// (сам фургон morningFlow пускает позже). В день визита и в дни доли к магазину подъезжает чёрная «девятка»:
// Толик в кожанке заходит, выходит и уезжает. Ни драк, ни угроз на экране, камера не трясётся. Кусок кода
// грузится, только когда «крыше» сегодня есть что показать (morningFlow.prepareDay).

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { t } from '../i18n';
import { inZar } from '../game/zarshop';
import { racketHit } from '../game/racket';
import { FACADE_H } from './common';
import * as persons from './persons';
import * as cars from './cars';

/** Что положили у входа сегодня — убрать завтра утром. */
let props: Phaser.GameObjects.GameObject[] = [];

export function clear(): void {
  for (const p of props) p.destroy();
  props = [];
}

/** Ближайшая к двери витрина слева (building.ts: витрины по 24 px между краем и дверью). */
function windowX(scene: StoreScene): number {
  const { door } = scene.layout;
  const from = 8;
  const to = door.x - 18;
  const n = Math.floor((to - from) / 24);
  return n > 0 ? (from + to) / 2 + ((n - 1) * 24) / 2 : door.x + 30;
}

/** Утро перед открытием: что натворили ночью и приедет ли «девятка». */
export function morning(scene: StoreScene): void {
  clear();
  const r = scene.state.racket;
  if (!r || inZar(scene.state)) return;
  const { door, h } = scene.layout;
  const front = h + FACADE_H;
  const hit = racketHit(scene.state);
  const later = (ms: number, fn: () => void) => scene.time.delayedCall(ms, () => scene.running && fn());
  if (hit?.kind === 'glass') {
    const x = windowX(scene);
    props.push(scene.art(x, h + 5.5, 'racket_crack').setDepth(h + 2.3), scene.art(x, front + 6, 'racket_shards').setDepth(front + 1));
    later(900, () => scene.popup(x, h - 6, t('racket.hit.glass', { sum: hit.cost }), '#ffb0b0'));
  } else if (hit?.kind === 'trash') {
    const x = door.x + 22;
    // У бордюра, а не на крыльце: дверь и доска с меню остаются свободны, гости обходят мешки.
    props.push(scene.art(x, front + 19, 'racket_trash').setOrigin(0.5, 1).setDepth(front + 19));
    later(900, () => scene.popup(x, front - 4, t('racket.trash'), '#fee761'));
  } else if (hit?.kind === 'tires') {
    later(1200, () => scene.popup(scene.layout.warehouse.x + scene.layout.warehouse.w / 2, h - 6, t('racket.van'), '#fee761'));
  }
  // «Девятка»: в день визита (ребята пришли сегодня) и в дни доли — сразу после открытия, пока гостей мало.
  // В лёгкой графике без машины и прохожего — только реплика у двери в день доли.
  if (scene.lite) {
    if (hit?.kind === 'pay') later(2500, () => scene.popup(door.x, h - 6, t('racket.collect'), '#c0cbdc'));
  } else if (r.from === scene.state.day || hit?.kind === 'pay') void visit(scene, hit?.kind === 'pay');
}

/** Чёрная «девятка» подъезжает к двери, Толик заходит и выходит; с долей — бросает «до следующей недели». */
async function visit(scene: StoreScene, pay: boolean): Promise<void> {
  await scene.wait(2500);
  if (!scene.running) return;
  const world = scene.worldGen;
  const { door } = scene.layout;
  const roadY = scene.streetY + 24;
  const stopX = door.x - 34;
  const body = scene.art(0, 0, 'car_sedan').setTint(0x262b44);
  const car = scene.add.container(-260, roadY, [body, scene.art(0, 0, 'car_sedan_lights')]).setDepth(roadY);
  const road = cars.onRoad(scene, car, 'up', true);
  const alive = () => car.active && scene.worldGen === world;
  await cars.yieldToLot(scene, road);
  await new Promise<void>((done) => scene.tweens.add({ targets: car, x: stopX, duration: 2400, ease: 'Sine.easeOut', onComplete: () => done() }));
  if (!alive()) return;
  // Кожанка поверх тёмной рубашки, короткая стрижка, тёмные очки — девяностые, и только.
  const tolik = persons.makePerson(scene, stopX + 6, scene.streetY + 10, {
    shirt: 0x181425,
    coat: 0x3e2731,
    skin: 0xe4a672,
    pants: 0x262b44,
    hair: 0x181425,
    style: 'short',
    face: 'sunglasses',
  });
  const inside = { x: door.x, y: door.y - 10 };
  await persons.walkVia(scene, tolik, [{ x: door.x, y: scene.streetY + 4 }, inside], 30);
  if (!tolik.active || !alive()) return tolik.destroy();
  tolik.setVisible(false);
  await scene.wait(2600);
  if (!tolik.active || !alive()) return tolik.destroy();
  tolik.setVisible(true);
  if (pay) scene.speak(tolik, 16, t('racket.collect'));
  await persons.walkVia(scene, tolik, [{ x: door.x, y: scene.streetY + 4 }, { x: stopX + 6, y: scene.streetY + 10 }], 30);
  tolik.destroy();
  if (!alive()) return;
  await scene.wait(400);
  await cars.yieldToLot(scene, road, true);
  scene.tweens.add({ targets: car, x: scene.next.w + 300, duration: 2600, ease: 'Sine.easeIn', onComplete: () => car.destroy() });
}
