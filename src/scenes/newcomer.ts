// Новичок: подсказка «что дальше» и стрелка обучения первых дней, первые минуты нового начала (бабушка весь
// первый день за прилавком: раскладывает полку, пробивает заждавшегося, хвалит, говорит облачком; первый
// покупатель, первая продажа) и пошаговое обучение (game/tutorial.ts, ui/coach.ts) с его точками в зале.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { canPlace, PRODUCT_IDS, shelfFree, STORE_LEVELS, type StoreState } from '../game/economy';
import { saveGame, savingPaused } from '../game/save';
import { t, type TextKey } from '../i18n';
import { sound } from '../platform/sound';
import { withUpgrades } from '../game/upgrades';
import { flushSoon, track } from '../platform/analytics';
import { firstWant, markOnb, onbDone, playDayOne, type OnbStep } from '../game/onboarding';
import { firstSaleStamp, type SayLine } from '../ui/onboarding';
import { TUT_IGNORE_MS, TUT_WAIT_MS, tutAt, tutIndex, tutNext, tutPass, tutPatient, tutSkip, tutStep, tutTell, type TutStep } from '../game/tutorial';
import type { Spot } from '../ui/coach';
import { ownerTiming } from '../game/owner';
import { idleRegisters, nextRegisterCount, nextRegisterPrice, registerSlots } from '../game/registers';
import { seeTip } from '../game/tips';
import { cleanHall, GRANNY_SCAN_SLOW, grannyServesAfter, grannyStays, grannyStocksNow, praiseAt } from '../game/firstday';
import { hallNudge, NUDGE_IDLE_MS } from '../game/nudge';
import { tryNudge } from '../ui/nudge';
import {
  ART,
  TUTORIAL_DAYS,
  NUDGE_SHOW_MS,
  LIGHT_DEPTH,
  ONB_FIRST_AT,
  ONB_HELLO_AT,
  ONB_NEXT_GUEST,
  ONB_BYE_AFTER,
  GRANNY_SPEED,
  TOILET_DIRTY,
  PICKUP_MS,
  PLACE_MS,
  SHIRTS,
  customerLook,
  GRANDMA,
  type Customer,
  type Register,
  CALL_CARD_TIP,
  ROT_TIP,
} from './common';
import * as effects from './effects';
import * as deliveries from './deliveries';
import * as staff from './staff';
import * as shoppers from './shoppers';
import * as persons from './persons';
import * as camera from './camera';
import * as shelves from './shelves';

export function currentHint(scene: StoreScene): string {
  if (scene.liveEvent) return t(`hint.${scene.liveEvent}` as TextKey);
  if (scene.moments.showing) return t('hint.moment');
  if (scene.oven?.state === 'ready') return t('hint.ovenReady');
  // Первый звонок с карточкой — подсказка подробнее: куда нажать (и тем, у кого доставка была и раньше).
  if (scene.call) return t((scene.state.seenTips ?? []).includes(CALL_CARD_TIP) ? 'hint.order' : 'hint.orderFirst');
  if (!deliveries.staffPacks(scene) && !scene.packRequested && scene.parcels.some((p) => p.stage === 'wait')) return t('hint.orderPack');
  if (scene.inspector === 'here') return t('hint.inspector');
  if (!scene.workers.has('guard') && [...scene.customers].some((c) => c.thief && !c.gone)) return t('hint.thief');
  if (scene.sellerBusy && scene.ownerRegister()) return t('hint.recall');
  if (scene.ownerRegister() && scene.state.day <= 2 && scene.stats.served < 3) return t('hint.serve');
  // Очередь растёт — подсказать, что поможет. За первой кассой и так хозяин: кассир за свободную
  // кассу, ещё одна касса или помещение, где под неё есть место.
  if (scene.queue.length >= 4 && scene.state.day > TUTORIAL_DAYS) {
    if (idleRegisters(scene.state) > 0) return t('hint.queueHire');
    if (nextRegisterPrice(scene.state) !== null) return t('hint.queueBuy');
    if ((nextRegisterCount(scene.state) ?? 0) > registerSlots(scene.state)) return t('hint.queueRegister');
  }
  if (scene.state.day <= 4 && shelves.shelfNeedsRestock(scene)) return t('hint.restock');
  if (!scene.state.seenTips?.includes(ROT_TIP) && [...scene.trash].some((piece) => piece.getData('rot')))
    return t(scene.state.staff.some((m) => m.role === 'cleaner') ? 'hint.rot' : 'hint.rotSolo');
  if (scene.binFull() && !scene.binBusy) return t('hint.bin');
  if ((scene.trash.size > 0 || scene.toiletDirt >= TOILET_DIRTY) && scene.state.day <= 4) return t('hint.clean');
  return '';
}

/**
 * Игрок застыл на NUDGE_IDLE_MS, а в зале ждёт дело: покупатель у кассы хозяина или пустая полка при
 * товаре на складе. Одна строка снизу и стрелка на несколько секунд; каждая — раз в день, всего не
 * больше трёх в день и только в первые две недели (game/nudge.ts). Касание экрана — гаснет.
 */
export function nudgeHint(scene: StoreScene): string {
  const now = scene.time.now;
  if (!scene.running || scene.night || !scene.dayOpen) {
    scene.lastTouch = now;
    scene.nudge = null;
    return '';
  }
  if (scene.nudge && scene.nudgeUntil > now) return t(scene.nudge === 'serve' ? 'hint.serve' : 'hint.restock');
  scene.nudge = null;
  if (now - scene.lastTouch < NUDGE_IDLE_MS) return '';
  const kind = hallNudge({ waiting: Boolean(scene.ownerRegister()) && !scene.sellerBusy, emptyShelf: shelves.shelfNeedsRestock(scene) });
  if (!kind || !tryNudge(scene.state.day, kind, now - scene.lastTouch)) return '';
  scene.nudge = kind;
  scene.nudgeUntil = now + NUDGE_SHOW_MS;
  return t(kind === 'serve' ? 'hint.serve' : 'hint.restock');
}

/**
 * Обучение первых дней: над тем, что нужно нажать сейчас, прыгает стрелка —
 * касса, пустая полка, мусор или грязный туалет, вор.
 */
export function updateTutorialArrow(scene: StoreScene): void {
  const target = scene.state.day <= TUTORIAL_DAYS || scene.inspector === 'here' || scene.nudgeUntil > scene.time.now ? tutorialTarget(scene) : null;
  // Ту же цель бабушкино обучение показывает своей стрелкой (ui/coach.ts) — вторая не нужна.
  const own = scene.hallCoach && scene.coach.pointing && scene.tutTracked ? tutWorldSpot(scene, scene.tutTracked) : null;
  if (!target || (own && Math.abs(own.x - target.x) < 24 && Math.abs(own.y - target.y) < 40)) {
    scene.arrow?.setVisible(false);
    return;
  }
  if (!scene.arrow?.active) {
    scene.arrow = scene.art(0, 0, 'arrow').setScale(1.3 / ART).setDepth(LIGHT_DEPTH + 20);
  }
  const bob = Math.sin(scene.time.now / 160) * 2;
  scene.arrow.setVisible(true).setPosition(target.x, target.y - 12 + bob);
}

export function tutorialTarget(scene: StoreScene): { x: number; y: number } | null {
  const { counter, wc } = scene.layout;
  const thief = !scene.workers.has('guard') ? [...scene.customers].find((c) => c.thief && !c.gone) : undefined;
  if (thief) return { x: thief.sprite.x, y: thief.sprite.y - 12 };
  const waitingAt = scene.ownerRegister();
  if (waitingAt && (scene.sellerBusy || scene.stats.served < 3 || scene.nudge === 'serve')) return { x: waitingAt.counter.x, y: waitingAt.counter.y - 28 };
  void counter;
  if (shelves.shelfNeedsRestock(scene)) {
    const index = scene.shelfViews.findIndex((v) => v.needsStock);
    if (index >= 0) return { x: shelves.spotOf(scene, index).x, y: shelves.spotOf(scene, index).y - 18 };
  }
  const trash = [...scene.trash].find((piece) => !scene.claimedTrash.has(piece));
  if (trash) return { x: trash.x, y: trash.y - 2 };
  if (scene.toiletDirt >= TOILET_DIRTY) return { x: wc.x, y: wc.y - 14 };
  return null;
}

/** Шаг первых минут: отмечается один раз, уходит в аналитику (onb_<шаг>) и на сервер — поскорее. */
export function onbStep(scene: StoreScene, step: OnbStep, day = scene.state.day): void {
  if (!scene.state.onboarding || onbDone(scene.state, step)) return;
  scene.state = markOnb(scene.state, step);
  track(`onb_${step}`, day, scene.sincePlay());
  flushSoon();
}

/**
 * Открытие в первые два дня новичка: шаг в аналитику. В новом начале в первый день бабушка
 * встречает у входа, первый покупатель входит почти сразу, а следующий — чуть погодя.
 */
export function onboardingDay(scene: StoreScene): void {
  onbStep(scene, scene.state.day === 1 ? 'open' : 'day2');
  if (!playDayOne(scene.state)) return;
  if (!onbDone(scene.state, 'bye')) placeGranny(scene);
  // Игру закрыли после первой продажи: бабушка так и стоит у кассы до вечера (firstday.ts).
  if (onbDone(scene.state, 'sale')) return;
  scene.nextSpawn = ONB_NEXT_GUEST;
  scene.time.delayedCall(ONB_FIRST_AT * 1000, () => spawnFirst(scene));
  if (onbDone(scene.state, 'hello')) return;
  scene.time.delayedCall(ONB_HELLO_AT * 1000, () => {
    if (!scene.running || onbDone(scene.state, 'sale')) return;
    onbStep(scene, 'hello');
    grannySays(scene, { id: 'hello', text: t('onb.hello'), mood: 'happy', hold: 2800 });
    // Пока покупатель выбирает — как тут всё устроено.
    scene.time.delayedCall(4800, () => {
      if (scene.running && !onbDone(scene.state, 'sale') && !scene.onbSaid.has('serve')) grannySays(scene, { id: 'shop', text: t('onb.shop'), hold: 2600 });
    });
  });
}

/** Первый покупатель нового начала: входит от самой двери и берёт то, что по пути к кассе. */
export function spawnFirst(scene: StoreScene): void {
  if (!scene.running || onbDone(scene.state, 'sale')) return;
  const { door } = scene.layout;
  const till = scene.registers[0]?.spot ?? scene.layout.counter;
  const want = firstWant(scene.state, (i) => shelves.standOf(scene, i), door, till);
  const look = customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), scene.state.day);
  // Уже на дорожке у двери: камера ещё подлетает, а он входит.
  scene.spawnCustomer({ look, at: { x: door.x, y: door.y + 24 }, wants: want ? [want] : undefined, first: true });
}

/**
 * Бабушка в первый день нового начала: весь день за прилавком, рядом с кассой хозяина (там, где
 * встаёт хозяин при сменщике), — смотрит в зал. Вечером, с итогами дня, уезжает на дачу.
 */
export function placeGranny(scene: StoreScene): void {
  if (scene.granny?.active) return;
  const home = grannyHome(scene);
  scene.granny = persons.makePerson(scene, home.x, home.y, GRANDMA);
  scene.grannyBox = scene.art(0, 3, 'box').setVisible(false);
  scene.granny.add(scene.grannyBox);
  persons.setFacing(scene.granny, 'down');
}

/**
 * Что в зале первой недели скрыто (firstday.ts): надписи закрытых пристроек и «Сдаётся» (пока на переезд
 * не хватает). Сменилось — утром зал перестраивается, и они появляются.
 */
export function cleanKey(scene: StoreScene): string {
  const next = STORE_LEVELS[scene.state.level + 1];
  return cleanHall(scene.state) ? `clean:${next ? scene.state.money >= next.cost : ''}` : '';
}

export function grannyHome(scene: StoreScene): { x: number; y: number } {
  return staff.reliefSpot(scene);
}

/** Бабушка сейчас занята делом (полка, касса). Дело прошлой постройки зала не считается. */
export function grannyBusy(scene: StoreScene): boolean {
  return scene.grannyJob === scene.worldGen;
}

/** Полка, на которой кончился товар, а на складе он есть (как shelfNeedsRestock); -1 — нет такой. */
export function emptyShelfIndex(scene: StoreScene): number {
  return scene.state.shelves.findIndex(
    (shelf) =>
      !shelf.broken &&
      shelfFree(shelf) > 0 &&
      PRODUCT_IDS.some((id) => canPlace(id, shelf) && (shelf.items[id]?.length ?? 0) === 0 && (scene.state.warehouse[id] ?? []).some((u) => !u.pending)),
  );
}

/**
 * Первый день новичка, каждый кадр: бабушка раскладывает опустевшую полку (в первый раз — сразу,
 * показывая как; потом — если новичок не нажал её сам) и пробивает покупателя, который заждался
 * у кассы хозяина (после первой продажи: её делает сам игрок). Всё — game/firstday.ts.
 */
export function grannyHelps(scene: StoreScene): void {
  const granny = scene.granny;
  if (!granny?.active || !scene.running || scene.night || grannyBusy(scene) || !grannyStays(scene.state)) return;
  const r = scene.registers[0];
  const c = r?.customer;
  const after = grannyServesAfter(scene.state, scene.sellerBusy);
  if (r && c && after !== null && scene.operator(0) === 'owner' && !c.serving && !r.scan && scene.atSpot(r) && c.waitStart && scene.time.now - c.waitStart > after) {
    void grannyServe(scene, r, c);
    return;
  }
  const index = emptyShelfIndex(scene);
  if (index < 0) {
    scene.shelfEmptySince = -1;
    return;
  }
  if (scene.shelfEmptySince < 0) scene.shelfEmptySince = scene.time.now;
  // Хозяин уже несёт товар — бабушка не мешает.
  if (scene.sellerBusy) return;
  if (grannyStocksNow(scene.state, scene.time.now - scene.shelfEmptySince, scene.onbSaid.has('stockDemo'))) void grannyRestock(scene, index);
}

/** Бабушка идёт на склад, берёт коробку и раскладывает полку (как грузчик); в первый раз — с присказкой. */
export async function grannyRestock(scene: StoreScene, index: number): Promise<void> {
  const granny = scene.granny;
  if (!granny?.active) return;
  const gen = scene.worldGen;
  scene.grannyJob = gen;
  const ok = () => gen === scene.worldGen && granny.active && scene.running;
  const done = () => {
    if (scene.grannyJob === gen) scene.grannyJob = -1;
    scene.shelfEmptySince = -1;
  };
  if (!scene.onbSaid.has('stockDemo')) {
    grannySays(scene, { id: 'stockDemo', text: t('first.stockDemo'), mood: 'happy', hold: 2600 });
    track('first_granny_stock', scene.state.day, scene.sincePlay());
  }
  const { doorway, pickup } = scene.layout.warehouse;
  const route = shelves.routeTo(scene, index);
  await persons.walkVia(scene, granny, [doorway, pickup], GRANNY_SPEED);
  if (!ok()) return done();
  await scene.wait(PICKUP_MS);
  if (!ok()) return done();
  scene.grannyBox?.setVisible(true);
  await persons.walkVia(scene, granny, [doorway, ...route], GRANNY_SPEED);
  if (!ok()) return done();
  await scene.wait(PLACE_MS);
  if (!ok()) return done();
  scene.grannyBox?.setVisible(false);
  // Пока шла, полку мог разложить сам игрок — тогда коробка просто возвращается на склад.
  if (shelfFree(scene.state.shelves[index]) > 0) staff.stockShelf(scene, index, granny);
  const home = grannyHome(scene);
  await persons.walkVia(scene, granny, [...route.slice(0, -1).reverse(), doorway, home], GRANNY_SPEED);
  if (granny.active) persons.setFacing(granny, 'down');
  done();
}

/** Покупатель заждался у кассы хозяина — бабушка пробивает его сама, не спеша. */
export async function grannyServe(scene: StoreScene, r: Register, c: Customer): Promise<void> {
  const granny = scene.granny;
  if (!granny?.active) return;
  const gen = scene.worldGen;
  scene.grannyJob = gen;
  if (!scene.onbSaid.has('help')) grannySays(scene, { id: 'help', text: t('first.help'), mood: 'happy', hold: 2200 });
  const timing = withUpgrades(scene.state, ownerTiming(scene.state));
  await shoppers.scanCustomer(scene, r, c, { item: timing.item * GRANNY_SCAN_SLOW, pay: timing.pay * GRANNY_SCAN_SLOW }, false, granny);
  if (scene.grannyJob === gen) scene.grannyJob = -1;
}

/** Бабушка хвалит новичка за серию покупок (firstday.ts praiseAt) — когда больше никто не говорит. */
export function grannyPraise(scene: StoreScene): void {
  const granny = scene.granny;
  if (!granny?.active || !praiseAt(scene.state, scene.combo, scene.serves.owner) || scene.say.visible || scene.coach.active) return;
  // Каждый порог — один раз: пока счёт стоит, бабушкины же пробивки похвалу не повторяют.
  const mark = `${scene.combo}:${scene.serves.owner}`;
  if (mark === scene.praisedAt) return;
  scene.praisedAt = mark;
  const n = scene.praised++ % 3;
  effects.emote(scene, granny, 'emo_heart');
  persons.setMood(scene, granny, 'happy', 2500);
  grannySays(scene, { id: `praise${scene.praised}`, text: t(`first.praise.${n}` as TextKey), mood: 'happy', hold: 2200 });
}

/** Реплика бабушки облачком под ней — она стоит у входа (её уже нет в зале — у двери). */
export function grannySays(scene: StoreScene, line: SayLine): void {
  scene.onbSaid.add(line.id);
  scene.say.show(line);
  placeSay(scene);
}

export function placeSay(scene: StoreScene): void {
  if (!scene.say.visible) return;
  const granny = scene.granny?.active ? scene.granny : null;
  const { door } = scene.layout;
  const p = screenPoint(scene, granny ? granny.x : door.x, granny ? granny.y + 10 : door.y + 4);
  scene.say.place(p.x, p.y, true);
}

/** Точка мира → точка на экране в CSS-пикселях (холст вписан в окно и бывает уже его). */
export function screenPoint(scene: StoreScene, x: number, y: number): { x: number; y: number } {
  const cam = scene.cameras.main;
  const rect = scene.game.canvas.getBoundingClientRect();
  const k = rect.width / scene.scale.width;
  return { x: rect.left + (x - cam.worldView.x) * cam.zoom * k, y: rect.top + (y - cam.worldView.y) * cam.zoom * k };
}

/**
 * Первый день новичка, каждый кадр: покупатель встал у кассы — шаг «cust». В новом начале
 * бабушка зовёт нажать на кассу, вокруг кассы — мягкое кольцо; облачко держится у бабушки.
 */
export function onboardingTick(scene: StoreScene): void {
  const r = onbDone(scene.state, 'sale') ? undefined : scene.ownerRegister();
  const waiting = r && scene.atSpot(r) ? r : null;
  if (waiting) onbStep(scene, 'cust');
  if (scene.state.onboarding === 'play') {
    // Зал перестроили — бабушка снова у кассы (пока не уехала на дачу).
    if (!onbDone(scene.state, 'bye') && !scene.granny?.active) placeGranny(scene);
    grannyHelps(scene);
    if (waiting) {
      if (!scene.onbSaid.has('serve')) grannySays(scene, { id: 'serve', text: t('onb.serve'), hold: 0 });
      ringTill(scene, waiting);
    } else if (!scene.registers.some((r, i) => scene.operator(i) === 'owner' && r.customer)) {
      // Покупатель не дождался и ушёл — звать к кассе некого: облачко и кольцо гаснут, подсказки
      // внизу возвращаются, а к следующему покупателю бабушка позовёт снова.
      if (scene.say.line === 'serve') scene.say.hide();
      scene.onbSaid.delete('serve');
      scene.tillRing?.destroy();
      scene.tillRing = undefined;
    }
  }
  placeSay(scene);
}

/** Мягкое золотое кольцо вокруг кассы: «сюда нажать». На слабом телефоне — без пульса. */
export function ringTill(scene: StoreScene, r: Register): void {
  if (scene.tillRing?.active) return;
  const ring = scene.add.ellipse(r.counter.x, r.counter.y + 2, 30, 14).setStrokeStyle(1.5, 0xfee761, 0.95).setDepth(LIGHT_DEPTH + 19);
  scene.tillRing = ring;
  if (!scene.lite) scene.tweens.add({ targets: ring, scale: 1.25, alpha: 0.35, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
}

/** Первая продажа новичка. В новом начале — маленький праздник: печать, фанфары, конфетти, бабушка радуется. */
export function firstSale(scene: StoreScene, total: number): void {
  onbStep(scene, 'sale');
  saveGame(scene.state);
  if (scene.state.onboarding !== 'play') return;
  scene.tillRing?.destroy();
  scene.tillRing = undefined;
  sound.fanfare();
  firstSaleStamp(total);
  if (!scene.lite) {
    const { counter } = scene.layout;
    const confetti = scene.add.particles(counter.x, counter.y - 24, 'confetti', {
      speed: { min: 40, max: 120 },
      angle: { min: 200, max: 340 },
      gravityY: 150,
      rotate: { min: 0, max: 360 },
      scale: 1 / ART,
      lifespan: 1500,
      tint: [0xe43b44, 0xfee761, 0x63c74d, 0x0099db, 0xb55088],
      emitting: false,
    });
    confetti.setDepth(LIGHT_DEPTH + 10).explode(36);
    scene.time.delayedCall(1700, () => confetti.destroy());
  }
  // Первый день прошёл без продажи — бабушка уже на даче: праздник есть, а её реплики нет.
  if (!playDayOne(scene.state)) return;
  const granny = scene.granny;
  if (granny?.active) {
    effects.emote(scene, granny, 'emo_heart');
    persons.setMood(scene, granny, 'happy', 3000);
    if (!scene.lite) scene.tweens.add({ targets: granny, y: granny.y - 4, duration: 140, yoyo: true, repeat: 1, ease: 'Quad.easeOut' });
  }
  grannySays(scene, { id: 'sold', text: t('onb.sold'), mood: 'happy', hold: 2400 });
  scene.time.delayedCall(ONB_BYE_AFTER * 1000, () => grannyRoad(scene));
}

/**
 * После первой продажи бабушка показывает, как пробивать, не дотягиваясь до кассы: касанием улицы
 * внизу (утренняя карточка об этом тогда уже не нужна). Сама остаётся за прилавком до вечера: на дачу
 * уезжает с итогами дня (finishDay), прощание — строчкой в итогах. Таймер, а не wait: переживёт перестройку зала.
 */
export function grannyRoad(scene: StoreScene): void {
  if (!scene.running || !grannyStays(scene.state) || scene.onbSaid.has('road')) return;
  grannySays(scene, { id: 'road', text: t('onb.road'), mood: 'happy', hold: 2800 });
  if (!scene.state.seenTips?.includes('ownerTill')) scene.state = seeTip(scene.state, 'ownerTill');
  camera.showStreetTap(scene);
}

// ---------- Бабушкино обучение (game/tutorial.ts) ----------

/**
 * Каждый кадр дня: шаг обучения в зале — светлое окошко и стрелка у кассы с покупателем или у пустой
 * полки, строчка бабушки рядом. Цели нет — ждём (в первый день — сколько надо, иначе TUT_WAIT_MS);
 * цель есть, а её не трогают — через TUT_IGNORE_MS шаг идёт дальше сам: обучение игру не держит.
 * Состояние шага — в сохранении, а цель ищется заново каждый кадр: перестройка зала ему не мешает.
 */
export function tutorialTick(scene: StoreScene, deltaMs: number): void {
  const step = tutAt(scene.state, 'hall');
  if (!step || scene.night || scene.arranging || savingPaused()) {
    hallCoachOff(scene);
    return;
  }
  scene.coach.onSkip = () => skipTutorial(scene);
  scene.coach.skipButton(true);
  scene.hallCoach = true;
  // В первый день, пока бабушка в зале, она сама говорит облачком (onboardingTick): подсветка — без строчки,
  // а до полок дело дойдёт, когда она попрощается.
  // Полку первой раскладывает бабушка (показывает как, firstday.ts); пока она занята — тоже без подсветки.
  const granny = playDayOne(scene.state) && !onbDone(scene.state, 'bye');
  if (granny && step === 'restock' && (!scene.onbSaid.has('stockDemo') || grannyBusy(scene))) {
    scene.coach.hide();
    return;
  }
  if (scene.tutTracked !== step) {
    scene.tutTracked = step;
    scene.tutIdleMs = 0;
    scene.tutShownMs = 0;
    // В аналитику — один раз на шаг, и после перезапуска тоже (отметка в сохранении).
    const told = tutTell(scene.state);
    if (told) {
      track('tut_step', scene.state.day, tutIndex(scene.state));
      flushSoon();
      scene.state = told;
    }
  }
  const spot = tutWorldSpot(scene, step);
  const ms = deltaMs * scene.speed;
  if (spot) scene.tutShownMs += ms;
  // Хозяин уже несёт товар или пробивает — это не «цели нет».
  else if (!scene.sellerBusy && !scene.ownerScanning()) scene.tutIdleMs += ms;
  const patient = tutPatient(scene.state, step);
  if ((!patient && scene.tutIdleMs > TUT_WAIT_MS) || (!(patient && step === 'serve') && scene.tutShownMs > TUT_IGNORE_MS)) {
    track('tut_auto', scene.state.day, tutIndex(scene.state));
    advanceTut(scene, tutNext(scene.state));
    return;
  }
  const text = step === 'serve' ? (granny ? '' : t('tut.serve')) : t('tut.restock');
  scene.coach.show({ id: `hall:${step}`, text, target: () => tutScreenSpot(scene, step), under: () => scene.game.canvas });
}

/** Цель шага в мире: касса, у которой ждёт покупатель хозяина, или полка, которую пора пополнить. */
export function tutWorldSpot(scene: StoreScene, step: TutStep): { x: number; y: number; w: number; h: number } | null {
  if (step === 'serve') {
    const r = scene.ownerRegister();
    return r && scene.atSpot(r) ? { x: r.counter.x, y: r.counter.y - 8, w: 30, h: 26 } : null;
  }
  if (step !== 'restock' || scene.sellerBusy || grannyBusy(scene)) return null;
  // Полка, которую можно пополнить прямо сейчас: товар уже на складе, а не в пути.
  const index = scene.shelfViews.findIndex(
    (v, i) => v.needsStock && PRODUCT_IDS.some((id) => canPlace(id, scene.state.shelves[i]) && (scene.state.warehouse[id] ?? []).some((u) => !u.pending)),
  );
  if (index < 0) return null;
  const at = shelves.spotOf(scene, index);
  return { x: at.x, y: at.y - 12, w: 30, h: 30 };
}

/** То же на экране, CSS-пиксели (камера могла сдвинуться). */
export function tutScreenSpot(scene: StoreScene, step: TutStep): Spot | null {
  if (!scene.hallCoach || !scene.running) return null;
  const box = tutWorldSpot(scene, step);
  if (!box) return null;
  const a = screenPoint(scene, box.x - box.w / 2, box.y - box.h / 2);
  const b = screenPoint(scene, box.x + box.w / 2, box.y + box.h / 2);
  return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
}

/** Игрок сделал то, чего ждал шаг зала. */
export function passTut(scene: StoreScene, step: TutStep): void {
  if (tutStep(scene.state) !== step || !scene.running) return;
  advanceTut(scene, tutPass(scene.state, step));
}

export function advanceTut(scene: StoreScene, next: StoreState): void {
  const was = tutIndex(scene.state);
  scene.state = next;
  scene.tutTracked = null;
  scene.coach.hide();
  saveGame(scene.state);
  if (!tutStep(next)) {
    track('tut_done', next.day, was);
    flushSoon();
    hallCoachOff(scene);
    scene.coach.note(t('tut.done'), 4500);
  }
}

/** Подсветка зала гаснет (день встал, шаг ушёл в утро или обучение кончилось). */
export function hallCoachOff(scene: StoreScene): void {
  if (!scene.hallCoach) return;
  scene.hallCoach = false;
  scene.coach.hide();
  scene.coach.skipButton(false);
}

/** «Пропустить обучение» подтвердили: шаги кончаются, все вкладки утра открыты. */
export function skipTutorial(scene: StoreScene): void {
  if (!tutStep(scene.state)) return;
  track('tut_skip', scene.state.day, tutIndex(scene.state));
  flushSoon();
  scene.state = tutSkip(scene.state);
  hallCoachOff(scene);
  saveGame(scene.state);
}
