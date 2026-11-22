// Поток гостей сверх зала (game/traffic.ts, 21.11): зал полон — пришедший берёт своё «на бегу» и идёт к кассам,
// которые работают без хозяина. Человечка на каждого не рисуем (вызовов отрисовки и так много): касса вздрагивает
// на каждом, один-два «бегущих» гостя ходят от двери к кассе и обратно, а раз в несколько секунд над кассой
// всплывает «+N 🛍» — сколько пробили сверх зала; кассы не успевают — «ушли N» красным.

import Phaser from 'phaser';
import type { StoreScene } from './StoreScene';
import { t } from '../i18n';
import { flowArrive, flowJoin, flowNext, flowTick, flowUsed, newFlow, quickPick, type Flow } from '../game/traffic';
import { noteLost } from '../game/losses';
import { checkout, recordSale, returnToShelf } from '../game/economy';
import { bigDayExtraItems } from '../game/bigday';
import { crisisExtraItems } from '../game/crisis';
import { adExtraItems } from '../game/ads';
import { saleExtraItems } from '../game/weeks';
import { CLOSING_HURRY, customerLook, SHIRTS } from './common';
import * as effects from './effects';
import * as motion from './motion';
import * as persons from './persons';

/** Как часто всплывает «+N 🛍» над кассой (мс); в лёгкой графике — реже. */
const POP_MS = 3000;
const LITE_POP_MS = 5000;
/**
 * Полки после гостей «на бегу» перерисовываем не чаще этого (мс). 21.11, по разбору: раньше — на каждого, до 4 раз
 * за кадр, а полная перерисовка обходит все полки и все штуки на них. Гости зала берут по состоянию, не по картинке,
 * так что четверть секунды запоздания никому не мешает.
 */
const SHELVES_MS = 250;
/** Сколько «бегущих» гостей одновременно ходят к кассам и как часто выходит новый (мс). В лёгкой графике — ни одного. */
const WALKERS = 2;
const WALKER_GAP_MS = 1400;
/** Сколько бегущий стоит у кассы (мс). */
const WALKER_PAY_MS = 600;

interface Walker {
  sprite: Phaser.GameObjects.Container;
  /** Постройка зала, в которой вышел: зал пересобрали — его путь уже не исполнится, убираем. */
  gen: number;
}

/** Что сцена показывает про поток сегодня: сколько уже показали над кассой, когда снова, кто ходит. */
interface Fx {
  shown: number;
  lostShown: number;
  popAt: number;
  turn: number;
  dirty: boolean;
  shelvesAt: number;
  walkers: Walker[];
  walkAt: number;
}

const fxs = new WeakMap<StoreScene, Fx>();
function fxOf(scene: StoreScene): Fx {
  let fx = fxs.get(scene);
  if (!fx) {
    fx = { shown: 0, lostShown: 0, popAt: 0, turn: 0, dirty: false, shelvesAt: 0, walkers: [], walkAt: 0 };
    fxs.set(scene, fx);
  }
  return fx;
}

/** Поток сегодняшнего дня: создаётся с открытием (персонал и кассы уже выбраны утром). */
function flowOf(scene: StoreScene): Flow {
  if (!scene.flow) scene.flow = newFlow(scene.state);
  return scene.flow;
}

/** Утро: поток и всё, что его показывало, — заново. */
export function reset(scene: StoreScene): void {
  scene.flow = null;
  for (const w of fxs.get(scene)?.walkers ?? []) w.sprite.destroy();
  fxs.delete(scene);
}

/**
 * Зал полон, а гость пришёл: true — он пошёл «на бегу» (кассы без хозяина есть), false — ждёт места в зале.
 * Сразу берёт своё с полок (как гость зала у полки) и встаёт к кассам; ничего не нашёл — уходит, как из зала.
 */
export function arrive(scene: StoreScene): boolean {
  if (scene.night || scene.timeLeft <= 0 || scene.blackout) return false;
  const f = flowOf(scene);
  if (!flowArrive(f)) return false;
  scene.stats.came = (scene.stats.came ?? 0) + 1;
  const s = scene.state;
  const wanted = scene.wanted(Phaser.Math.Between(1, 2) + bigDayExtraItems(s.day) + crisisExtraItems(s) + adExtraItems(s, Math.random) + saleExtraItems(s, Math.random));
  const pick = quickPick(s, wanted, Math.random);
  scene.state = pick.state;
  flowJoin(f, pick);
  if (pick.cart.length) fxOf(scene).dirty = true;
  else if (pick.why) {
    scene.stats.lost++;
    noteLost(scene.stats, pick.why, pick.id);
  }
  return true;
}

/**
 * Зал полон, а за кассой хозяин один (потока «на бегу» нет): один гость ждёт у двери — войдёт, как освободится
 * место, — а остальные заглядывают и проходят мимо. 21.11, по разбору: раньше их просто не было, и реклама в ларьке
 * «приводила ≈N гостей», которые не заходили. Теперь их видно в итогах (stats.passed) с советом, а реклама считает
 * честно (ads.ts adGuests). В обиде они не уходят — рейтинг не трогают: это предел рук, а не плохой сервис.
 */
export function passBy(scene: StoreScene, interval: number): void {
  if (scene.night || scene.blackout || !(interval > 0) || !Number.isFinite(interval)) return;
  if (scene.flow && scene.flow.rate > 0) return;
  while (scene.nextSpawn < -interval) {
    scene.nextSpawn += interval;
    scene.stats.passed = (scene.stats.passed ?? 0) + 1;
  }
}

/** Гостя зала пробил кассир, сменщик или киоск: время касс занято и для потока. */
export function used(scene: StoreScene): void {
  if (scene.flow && !scene.night) flowUsed(scene.flow);
}

/** Каждый кадр идущего дня: кассы пробивают ждущих, кто не дождался — оставляет корзину и уходит. */
export function tick(scene: StoreScene, dt: number): void {
  const f = scene.flow;
  if (!f || scene.night || f.rate <= 0) return;
  const fx = fxOf(scene);
  if (!scene.blackout) {
    // Закрываемся: зал идёт быстрее (CLOSING_HURRY) — и кассы потока тоже, чтобы стоящих у касс успели пробить.
    const gone = flowTick(f, scene.timeLeft <= 0 ? dt * CLOSING_HURRY : dt);
    for (const cart of gone) {
      scene.state = returnToShelf(scene.state, cart);
      scene.stats.lost++;
      noteLost(scene.stats, 'queue');
      // Совет в итогах — тот же, что у очереди зала (кассир, киоск), а час пик и испытание «без очереди» их не считают.
      scene.stats.quickQueue = (scene.stats.quickQueue ?? 0) + 1;
    }
    if (gone.length) fx.dirty = true;
    for (let cart = flowNext(f); cart; cart = flowNext(f)) {
      const paid = checkout(scene.state, cart);
      scene.state = paid.state;
      f.served++;
      f.revenue += paid.total;
      scene.stats.served++;
      scene.stats.quick = (scene.stats.quick ?? 0) + 1;
      scene.stats.revenue += paid.total;
      recordSale(scene.stats, cart);
      blip(scene, fx);
    }
  }
  if (fx.dirty && scene.time.now >= fx.shelvesAt) {
    fx.dirty = false;
    fx.shelvesAt = scene.time.now + SHELVES_MS;
    scene.refreshShelves();
  }
  pop(scene, f, fx);
}

/**
 * День закрылся, а у касс ещё стоят: товар из их корзин — обратно на полки (как у тех, кто не успел зайти).
 * 22.11: и в итогах они — «ушли из-за очереди», иначе «Зашло N» не сходилось с «купили / ушли» на 10-15 гостей.
 */
export function close(scene: StoreScene): void {
  const fx = fxOf(scene);
  for (const w of fx.walkers.splice(0)) w.sprite.destroy();
  const f = scene.flow;
  if (f?.carts.length) {
    for (const cart of f.carts.splice(0)) {
      scene.state = returnToShelf(scene.state, cart);
      f.lost++;
      f.queue++;
      scene.stats.lost++;
      noteLost(scene.stats, 'queue');
      scene.stats.quickQueue = (scene.stats.quickQueue ?? 0) + 1;
    }
  }
  fx.dirty = false;
  scene.refreshShelves();
}

interface Till {
  x: number;
  y: number;
  img?: Phaser.GameObjects.Image;
  /** Где встаёт покупатель. */
  spot: { x: number; y: number };
}

/**
 * Касса без хозяина, которая пробила гостя потока (по очереди): за которой кассир или сменщик, а без них — киоск.
 * tillsFirst — для «+N 🛍»: всплывает над кассами у выхода, а не над киоском у дальней стены.
 */
function autoTill(scene: StoreScene, fx: Fx, tillsFirst = false): Till | null {
  const tills: Till[] = scene.registers
    .filter((_, i) => {
      const op = scene.operator(i);
      return op !== null && op !== 'owner';
    })
    .map((r) => ({ x: r.counter.x, y: r.counter.y, img: r.img, spot: r.spot }));
  const kiosks: Till[] = scene.kiosks.map((k) => ({ x: k.img.x, y: k.img.y, img: k.img, spot: { x: k.img.x - 14, y: k.img.y + 4 } }));
  const all = tillsFirst && tills.length ? tills : [...tills, ...kiosks];
  if (!all.length) return null;
  fx.turn = (fx.turn + 1) % all.length;
  return all[fx.turn % all.length];
}

function blip(scene: StoreScene, fx: Fx): void {
  const till = autoTill(scene, fx);
  if (!till || scene.lite) return;
  if (till.img) motion.squash(scene, till.img, 1.04, 0.94, 70);
  walker(scene, fx, till);
}

/**
 * Бегущий гость: от двери к кассе, постоял — и обратно на улицу (21.11, по разбору: «в зале людей не прибавилось»).
 * Не больше WALKERS сразу и не чаще WALKER_GAP_MS — поток виден, а отрисовка не растёт с рекламой.
 */
function walker(scene: StoreScene, fx: Fx, till: Till): void {
  fx.walkers = fx.walkers.filter((w) => {
    if (w.sprite.active && w.gen === scene.worldGen) return true;
    w.sprite.destroy();
    return false;
  });
  if (fx.walkers.length >= WALKERS || scene.time.now < fx.walkAt || scene.timeLeft <= 0) return;
  fx.walkAt = scene.time.now + WALKER_GAP_MS;
  const { door, h } = scene.layout;
  const out = { x: door.x + Phaser.Math.Between(-6, 6), y: h + 16 };
  const sprite = persons.makePerson(scene, out.x, out.y, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), scene.state.day));
  sprite.setAlpha(0);
  scene.tweens.add({ targets: sprite, alpha: 1, duration: 200 });
  const w: Walker = { sprite, gen: scene.worldGen };
  fx.walkers.push(w);
  const inside = { x: door.x, y: door.y - 4 };
  const spot = { x: till.spot.x + Phaser.Math.Between(-5, 5), y: till.spot.y + 6 };
  void (async () => {
    await persons.walkVia(scene, sprite, [inside, spot], persons.ownPace(scene, sprite) * 1.3);
    if (!sprite.active) return;
    await scene.wait(WALKER_PAY_MS);
    if (!sprite.active) return;
    await persons.walkVia(scene, sprite, [inside, out], persons.ownPace(scene, sprite) * 1.3);
    if (!sprite.active) return;
    scene.tweens.add({ targets: sprite, alpha: 0, duration: 200, onComplete: () => sprite.destroy() });
    fx.walkers = fx.walkers.filter((x) => x !== w);
  })();
}

/**
 * «+N 🛍» над кассой: сколько пробили сверх зала с прошлого раза. Ушли из очереди «на бегу» — красным «ушли N»:
 * рейтинг за них падает, и пусть это видно днём, а не только в итогах.
 */
function pop(scene: StoreScene, f: Flow, fx: Fx): void {
  const fresh = f.served - fx.shown;
  const lost = f.queue - fx.lostShown;
  if ((fresh <= 0 && lost <= 0) || scene.time.now < fx.popAt) return;
  fx.shown = f.served;
  fx.lostShown = f.queue;
  fx.popAt = scene.time.now + (scene.lite ? LITE_POP_MS : POP_MS);
  const till = autoTill(scene, fx, true) ?? { x: scene.layout.door.x, y: scene.layout.door.y };
  // Выше «⚡ быстрее» (shoppers.ts, −36): не встаёт с ней стопкой, когда игрок торопит кассира.
  if (lost > 0) scene.popup(till.x, till.y - 46, t('flow.busy', { n: lost }), '#ffb0b0');
  else scene.popup(till.x, till.y - 46, t('flow.pop', { n: fresh }), '#c8ffb0');
  if (fresh > 0 && !scene.lite) effects.flyCoins(scene, till.x, till.y - 16, Math.min(3, fresh));
}
