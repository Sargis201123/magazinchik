// Покупатели в зале: приход, путь по полкам (что взять, ждать ли раскладки, запах свежего хлеба), туалет,
// очередь и пробивка на кассе, оплата и уход (довольный, с пустыми руками или недождавшийся); особые гости —
// постоянные, друзья, инспектор, Соня, жюри, гости праздников, воришка. Кто придёт — game/customers.ts и др.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import {
  BAD_COMPLAINT_CHANCE,
  buyChance,
  CHEAP_RATIO,
  promoKind,
  PRODUCTS,
  checkout,
  DAY_SECONDS,
  guardCatchChance,
  SHELF_KINDS,
  thiefChance,
  hasUnmarkedBad,
  returnToShelf,
  shelfFor,
  sellableProducts,
  takeFromShelf,
  recordSale,
  unitSalePrice,
  checkoutSeconds,
  ownerLevel,
  type ScanTiming,
  type LostReason,
  type ProductId,
} from '../game/economy';
import { inspectionDone } from '../game/day';
import { inspect } from '../game/events';
import { ALBUM_REWARD, collectRareGuest, perceivedBase, pickRareGuest, RARE_GUESTS, RARE_TIP, rareGuestChance } from '../game/endless';
import { saveGame } from '../game/save';
import { hoodTips } from '../game/hood';
import { t, type TextKey } from '../i18n';
import { sound } from '../platform/sound';
import { music } from '../platform/music';
import { haptic } from '../platform/telegram';
import { UI_FONT } from '../ui/dom';
import { BIG_DAYS, BLACKOUT_CHECKOUT, bigDayExtraItems, bigDayFor, CROWD_PATIENCE, isCrowdDay, MASKS, ROADWORKERS } from '../game/bigday';
import { wearOf } from './archetypes';
import { isWet, weatherFor } from '../game/weather';
import { adExtraItems, adRareBoost, adTrust } from '../game/ads';
import { companionOf, livedRegular } from '../game/life';
import { acceptsPrice, recordVisit, regularById, regularsToday, regularState, tipFor, type Regular } from '../game/regulars';
import { CART_SHARE, cartPatience, loyaltyTolerance, withUpgrades } from '../game/upgrades';
import { DOG_DAY_CATCH } from '../game/watch';
import { guestCoins, seeGuest } from '../game/live';
import { onbDone } from '../game/onboarding';
import { treatFriend, visitsInfo, type VisitFriend } from '../platform/multiplayer';
import { servePortions } from '../game/kitchen';
import { NIGHT_GUEST_TYPES, pickNightGuest } from '../game/nightGuests';
import { districtGuest } from '../game/district';
import { slotSide, standFor } from './placement';
import type { Point } from './layout';
import { personGlow } from './halo';
import { CLASH_FACTOR } from '../game/neighbors';
import { smellChance } from '../game/rot';
import { CANDY_PRICE, impulseChance, returnCandy, takeCandy } from '../game/impulse';
import { charmPatience, eyeTheft, ownerTiming } from '../game/owner';
import { radioPatience, radioTolerance } from '../game/radio';
import { cameraTheft, climatePatience, entranceMud, gearTier, signagePatience, REGISTER_JAM_SECONDS, registerJam, wcDirt } from '../game/gear';
import { AROMA_TOLERANCE } from '../game/bakery';
import { NIGHT_MARKUP, NIGHT_TOLERANCE } from '../game/night';
import { CAT_TIP, catHome, catPatience, catTipChance } from '../game/cat';
import { note } from '../game/reviews';
import { warLeaves } from '../game/war';
import { noteLost } from '../game/losses';
import { fairTolerance } from '../game/fair';
import { gentleDay, grannyServesAfter, grannyStays } from '../game/firstday';
import {
  ART,
  FRIEND_VISITS,
  FRIEND_TIP,
  FRIEND_GIFT,
  LIGHT_DEPTH,
  PATIENCE_MS,
  FIRST_PATIENCE,
  GRANNY_PATIENCE_MS,
  GRANNY_SHELF_WAIT_MS,
  SELLER_SPEED,
  RELIEF_TAP_MS,
  RELIEF_HURRY_MAX_MS,
  RELIEF_HURRY_SHARE,
  TRASH_CHANCE,
  TRASH_COMPLAINT,
  MUD_CHANCE,
  MAX_MUD,
  SPILL_CHANCE,
  COMBO_WINDOW_MS,
  TOILET_CHANCE,
  TOILET_DIRT_PER_VISIT,
  TOILET_DIRTY,
  SHIRTS,
  type Look,
  DOOR_TURN,
  DOOR_EDGE,
  randomLook,
  customerLook,
  nightLook,
  nightGuestLook,
  withCompanionItems,
  THIEF_SHIRT,
  type ParkSpot,
  THIEF_SPEED,
  STAFF_SPEED,
  INSPECTOR_SHIRT,
  VALYA,
  SONYA,
  LIVE_GUEST_LOOKS,
  JURY_LOOKS,
  SKINS,
  type Customer,
  type Register,
  type Worker,
} from './common';
import * as motion from './motion';
import * as effects from './effects';
import * as pets from './pets';
import * as weatherFx from './weatherFx';
import * as food from './food';
import * as cars from './cars';
import * as staff from './staff';
import * as persons from './persons';
import * as visitors from './visitors';

/** Шоколадка со стойки у кассы летит в руки стоящему в очереди. */
export function grabCandy(scene: StoreScene, c: Customer): void {
  const next = takeCandy(scene.state);
  if (!next) return;
  scene.state = next;
  c.extras = [...(c.extras ?? []), { kind: 'candy', price: CANDY_PRICE }];
  const { counter } = scene.layout;
  const candy = scene.art(counter.x, counter.y + 36, 'candy').setDepth(1000);
  scene.tweens.add({
    targets: candy,
    x: c.sprite.x + 4,
    y: c.sprite.y - 2,
    duration: 420,
    ease: 'Quad.easeOut',
    onComplete: () => {
      candy.destroy();
      // Конфета в шуршащей обёртке.
      sound.place('paper', 3, c.sprite.x);
      if (c.sprite.active && !c.gone) scene.popup(c.sprite.x, c.sprite.y - 18, t('popup.candy', { n: CANDY_PRICE }), '#fff3b0');
    },
  });
}

/** Постоянные покупатели на сегодня: каждый заходит в своё случайное время. */
export function scheduleRegulars(scene: StoreScene): void {
  const coming = regularsToday(scene.state).filter((r) => Math.random() < livedRegular(scene.state, r).every);
  for (const r of coming) {
    // Пара (life.ts) приходит вместе: второй — спутником первого, отдельно не приходит.
    const partner = companionOf(scene.state, r.id)?.regular;
    if (partner && coming.indexOf(regularById(partner)) < coming.indexOf(r)) continue;
    scene.time.delayedCall(Phaser.Math.FloatBetween(0.1, 0.75) * DAY_SECONDS * 1000, () => scene.running && scene.timeLeft > 0 && spawnRegular(scene, r));
  }
}

/** Друзья в гостях: до FRIEND_VISITS друзей за день, каждый в своё время. */
export function scheduleFriends(scene: StoreScene): void {
  const friends = Phaser.Utils.Array.Shuffle([...(visitsInfo()?.friends ?? [])]).slice(0, FRIEND_VISITS);
  for (const f of friends) {
    scene.time.delayedCall(Phaser.Math.FloatBetween(0.15, 0.7) * DAY_SECONDS * 1000, () => scene.running && scene.timeLeft > 0 && spawnFriend(scene, f));
  }
}

export function spawnFriend(scene: StoreScene, f: VisitFriend): void {
  const start = visitors.streetSpawn(scene);
  const sprite = persons.makePerson(scene, start.x, start.y, customerLook(SHIRTS[f.id % SHIRTS.length], scene.state.day));
  weatherFx.addUmbrella(scene, sprite);
  const bubble = scene.art(0, -14, 'bubble').setVisible(false);
  // Имя над головой — видно, что это друг.
  const tag = scene.add
    .text(0, -24, `👋 ${f.name}`, { fontFamily: UI_FONT, fontSize: '6px', fontStyle: 'bold', color: '#fee761', backgroundColor: 'rgba(24, 20, 37, 0.75)', padding: { x: 2, y: 1 } })
    .setOrigin(0.5)
    .setResolution(scene.textRes(5));
  sprite.add([bubble, tag]);
  const customer: Customer = { sprite, bubble, items: [], unhappy: false, waitStart: 0, gone: false, thief: false, friend: f, wants: scene.wanted(2) };
  // Нажми на друга — угостить кофе: он получит монеты при следующем запуске.
  sprite.setSize(16, 22).setInteractive({ useHandCursor: true }).on('pointerup', () =>
    scene.tap(() => {
      if (customer.friend!.treated) return scene.popup(sprite.x, sprite.y - 30, t('visit.treated', { name: f.name }), '#fff3b0');
      customer.friend = { ...customer.friend!, treated: true };
      void treatFriend(f.id).then((ok) => ok && sprite.active && scene.popup(sprite.x, sprite.y - 30, t('visit.treat', { name: f.name, n: FRIEND_GIFT }), '#c8ffb0'));
      effects.emote(scene, sprite, 'emo_heart');
    }),
  );
  scene.customers.add(customer);
  void runCustomer(scene, customer);
}

export function spawnRegular(scene: StoreScene, r: Regular): void {
  const start = visitors.streetSpawn(scene);
  const sprite = persons.makePerson(scene, start.x, start.y, { ...livedRegular(scene.state, r).look });
  weatherFx.addUmbrella(scene, sprite);
  const bubble = scene.art(0, -14, 'bubble').setVisible(false);
  sprite.add(bubble);
  // Жизнь района: Пётр Ильич с Ольгой Николаевной, Костя с женой — вдвоём.
  const companion = companionOf(scene.state, r.id);
  if (companion) persons.addCompanion(scene, sprite, companion.look);
  // Любимый товар — всегда; иногда ещё что-нибудь.
  const extra = Math.random() < 0.4 ? scene.wanted(1).filter((id) => id !== r.favorite) : [];
  const customer: Customer = { sprite, bubble, items: [], unhappy: false, waitStart: 0, gone: false, thief: false, regular: r.id, wants: [r.favorite, ...extra] };
  scene.customers.add(customer);
  void runCustomer(scene, customer);
}

/** Постоянный покупатель нашёл любимое по своей цене — доверие растёт (и чаевые), нет — падает. */
export function regularVerdict(scene: StoreScene, c: Customer): void {
  const r = regularById(c.regular!);
  const happy = c.items.some((item) => item.id === r.favorite);
  const { state, result } = recordVisit(scene.state, r.id, happy);
  scene.state = state;
  const name = t(r.nameKey);
  const y = c.sprite.y - 24;
  if (result === 'up') {
    effects.emote(scene, c.sprite, 'emo_heart');
    scene.popup(c.sprite.x, y, t('regular.up', { name }), '#c8ffb0');
    const total = c.items.reduce((sum, item) => sum + unitSalePrice(scene.state, item.id, item.unit), 0);
    // Благоустроенный район (hood.ts): постоянные щедрее.
    const tip = Math.round(tipFor(regularState(scene.state, r.id).loyalty, total) * hoodTips(scene.state));
    if (tip > 0) {
      scene.state = { ...scene.state, money: scene.state.money + tip };
      scene.time.delayedCall(900, () => scene.popup(c.sprite.x, y - 8, t('regular.tip', { n: tip }), '#fee761'));
    }
  } else {
    effects.emote(scene, c.sprite, 'emo_angry');
    scene.popup(c.sprite.x, y, t(result === 'left' ? 'regular.left' : 'regular.down', { name }), '#ffd0d0');
    sound.bad();
  }
  saveGame(scene.state);
}

// ---------- Проверка ----------

/** Инспектор обходит полки, туалет и кассу, потом выносит решение. */
export async function runInspector(scene: StoreScene): Promise<void> {
  scene.inspector = 'here';
  const { door, wc, sellerHome } = scene.layout;
  const start = visitors.streetSpawn(scene);
  const sprite = persons.makePerson(scene, start.x, start.y, { shirt: INSPECTOR_SHIRT, skin: SKINS[0], pants: INSPECTOR_SHIRT, hair: 0x181425, style: 'short' });
  const look = (x: number, y: number) => persons.walk(scene, sprite, x, y, 35).then(() => scene.wait(700));
  scene.popup(door.x, door.y - 24, t('popup.inspector'), '#fff3b0');
  haptic.tap();
  sound.bell();
  await persons.walkVia(scene, 
    sprite,
    [
      { x: door.x, y: scene.streetY },
      { x: door.x, y: door.y - 10 },
    ],
    35,
  );
  // Полки в зале и вёдра у кассы (ларь у входа он видел, когда заходил).
  for (const i of scene.state.shelves.map((_, i) => i)) if (scene.state.shelves[i].kind !== 'icebox') await look(scene.standOf(i).x, scene.standOf(i).y);
  await look(wc.x - 6, wc.spotY + 4);
  await look(sellerHome.x - 30, sellerHome.y - 10);
  if (!scene.sys.isActive()) return;

  // Переполненное ведро инспектор считает как две кучки мусора.
  const result = inspect(scene.state, { trash: scene.trash.size + (scene.binFull() ? 2 : 0) + ([...scene.trash].some((piece) => piece.getData('rot')) ? 1 : 0), toiletDirt: scene.toiletDirt });
  scene.inspection = result;
  scene.state = inspectionDone(scene.state, result);
  if (result.passed) {
    haptic.success();
    sound.good();
    scene.popup(sprite.x, sprite.y - 16, t('popup.inspectionPassed'), '#c8ffb0');
  } else {
    haptic.error();
    sound.bad();
    scene.popup(sprite.x, sprite.y - 16, t('popup.inspectionFailed', { n: result.fine }), '#ffd0d0');
  }
  await persons.walk(scene, sprite, door.x, scene.layout.h + 16, 35);
  void visitors.strollAway(scene, sprite);
  scene.inspector = 'done';
}

/** Соня заходит после школы: стоит у прилавка рядом с папой, потом уходит. */
export async function runSonya(scene: StoreScene): Promise<void> {
  scene.sonya = 'here';
  const { door, sellerHome } = scene.layout;
  const start = visitors.streetSpawn(scene);
  const sprite = persons.makePerson(scene, start.x, start.y, SONYA);
  await persons.walkVia(scene, 
    sprite,
    [
      { x: door.x, y: scene.streetY },
      { x: door.x, y: door.y - 10 },
      { x: sellerHome.x - 18, y: sellerHome.y + 8 },
    ],
    40,
  );
  if (!scene.sys.isActive()) return;
  pets.heartAt(scene, sprite.x, sprite.y - 14);
  music.sting('story');
  scene.popup(sprite.x, sprite.y - 20, t('drama.visit'), '#fff3b0');
  await scene.wait(9000);
  await persons.walkVia(scene, 
    sprite,
    [
      { x: door.x, y: door.y - 10 },
      { x: door.x, y: scene.layout.h + 16 },
    ],
    40,
  );
  void visitors.strollAway(scene, sprite);
  scene.sonya = 'done';
}

/**
 * Праздничный гость (game/live.ts): Дед Мороз или Снегурочка заходит, поздравляет у прилавка,
 * оставляет подарок монетами и уходит. Подарок — сразу, как дошёл: ушёл ли гость, уже неважно.
 */
export async function runLiveGuest(scene: StoreScene): Promise<void> {
  const guest = scene.liveGuest;
  if (!guest) return;
  guest.phase = 'here';
  const { door, sellerHome, queue } = scene.layout;
  const start = visitors.streetSpawn(scene);
  const sprite = persons.makePerson(scene, start.x, start.y, LIVE_GUEST_LOOKS[guest.who]);
  if (!scene.lite) personGlow(scene, sprite, 0xcfe8ff, 3);
  sound.bell(door.x);
  await persons.walkVia(scene, 
    sprite,
    [
      { x: door.x, y: scene.streetY },
      { x: door.x, y: door.y - 10 },
      // Рядом с тем, кто платит, — а не на самом прилавке и не в очереди.
      { x: queue.x - 14, y: queue.y + 10 },
    ],
    34,
  );
  if (!scene.sys.isActive()) return;
  const coins = guestCoins(scene.state);
  scene.state = seeGuest(scene.state, guest.date);
  saveGame(scene.state);
  pets.heartAt(scene, sprite.x, sprite.y - 14);
  if (!music.sting('coin')) sound.coin(sellerHome.x);
  haptic.success();
  scene.popup(sprite.x, sprite.y - 20, `«${t(`live.guest.${guest.who}.line` as TextKey)}»`, '#cfe8ff');
  scene.time.delayedCall(1400, () => scene.popup(sellerHome.x - 20, sellerHome.y - 40, t('live.guest.gift', { n: coins }), '#fee761'));
  await scene.wait(7000);
  await persons.walkVia(scene, 
    sprite,
    [
      { x: door.x, y: door.y - 10 },
      { x: door.x, y: scene.layout.h + 16 },
    ],
    34,
  );
  void visitors.strollAway(scene, sprite);
  guest.phase = 'done';
}

/** Жюри конкурса: трое заходят вместе, обходят полки, что-то записывают и уходят. */
export async function runJury(scene: StoreScene): Promise<void> {
  scene.jury = 'here';
  const { door, slots, sellerHome } = scene.layout;
  const start = visitors.streetSpawn(scene);
  scene.popup(door.x, door.y - 24, t('popup.jury'), '#fee761');
  haptic.tap();
  sound.bell();
  const walkOne = async (look: Look, i: number) => {
    await scene.wait(i * 700);
    const sprite = persons.makePerson(scene, start.x + i * 6, start.y, look);
    const dx = (i - 1) * 9;
    await persons.walkVia(scene, 
      sprite,
      [
        { x: door.x + dx, y: scene.streetY },
        { x: door.x + dx, y: door.y - 10 },
      ],
      32,
    );
    const order = slots.map((_, k) => k).filter((k) => k % 3 === i % 3 || slots.length < 4);
    for (const k of order.slice(0, 3)) {
      const stand = standFor(scene.layout, slots[k]);
      await persons.walk(scene, sprite, stand.x + dx / 2, stand.y, 32);
      if (!scene.sys.isActive()) return;
      scene.popup(sprite.x, sprite.y - 16, t('popup.juryNote'), '#ffffff');
      await scene.wait(900);
    }
    await persons.walk(scene, sprite, sellerHome.x - 24 + dx, sellerHome.y - 8, 32);
    await scene.wait(600);
    await persons.walk(scene, sprite, door.x + dx, scene.layout.h + 16, 32);
    void visitors.strollAway(scene, sprite);
  };
  await Promise.all(JURY_LOOKS.map((look, i) => walkOne(look, i)));
  scene.jury = 'done';
}

// ---------- Покупатели ----------

/**
 * Новый покупатель с улицы. forced — заданный (друг, первый покупатель); arrived — уже идёт по
 * тротуару от парковки (carCustomer): человечек готов, после покупок он вернётся к своей машине.
 */
export function spawnCustomer(
  scene: StoreScene,
  forced?: { look: Look; at: Phaser.Types.Math.Vector2Like; wants?: ProductId[]; first?: boolean },
  arrived?: { sprite: Phaser.GameObjects.Container; look: Look; car: ParkSpot },
): void {
  const thief = !forced && !arrived && Math.random() < thiefChance(scene.state.level) * cameraTheft(scene.state) * eyeTheft(scene.state);
  const valya = !forced && !arrived && !thief && !scene.night && !scene.valyaCame && scene.state.day > 1 && Math.random() < 0.15;
  const shirt = thief ? THIEF_SHIRT : valya ? VALYA.shirt : Phaser.Utils.Array.GetRandom(SHIRTS);
  // Блогер сегодня снимает обзор — редкие гости заходят вдвое чаще.
  const rareChance = rareGuestChance(scene.state.level) * adRareBoost(scene.state);
  const rare = !forced && !arrived && !thief && !valya && !scene.night && Math.random() < rareChance ? pickRareGuest(scene.state, Math.random) : null;
  let look: Look = forced
    ? forced.look
    : arrived
      ? arrived.look
      : rare
        ? (rare.look as Look)
        : valya
          ? VALYA
          : thief
            ? { ...randomLook(shirt), style: 'long' as const, hair: THIEF_SHIRT }
            : scene.night
              ? nightLook()
              : withCompanionItems(customerLook(shirt, scene.state.day));
  // Ночью — гость с характером: свой образ, свой список и реплика у входа (nightGuests.ts).
  const nightGuest = scene.night && !forced && !arrived && !thief && !rare && !valya ? pickNightGuest(Math.random) : null;
  if (nightGuest) look = nightGuestLook(nightGuest);
  const big = bigDayFor(scene.state.day);
  // Приехавший на машине уже одет (маска в эпидемию — ещё у машины, carCustomer).
  if (!rare && !thief && !valya && !arrived) {
    // Ремонт дороги: рабочие в касках приходят за обедом. Болезнь: почти все в масках.
    if (big === 'roadworks' && !forced && !scene.night && Math.random() < ROADWORKERS) look = { ...look, ...wearOf('builder', Math.random) };
    if (big && BIG_DAYS[big].masks && !look.face && Math.random() < MASKS) look = { ...look, face: 'medmask' };
  }
  // Гость из здания района: свой образ и свой список покупок (district.ts).
  let wants: ProductId[] | undefined = forced?.wants;
  const fromDistrict = !forced && !arrived && !rare && !thief && !valya && !scene.night ? districtGuest(scene.state, Math.random) : null;
  if (nightGuest) {
    const sellable = sellableProducts(scene.state);
    const pool = NIGHT_GUEST_TYPES[nightGuest].wants.filter((id) => sellable.includes(id));
    if (pool.length) wants = Phaser.Utils.Array.Shuffle([...pool]).slice(0, Phaser.Math.Between(1, 2));
  }
  if (fromDistrict) {
    const sellable = sellableProducts(scene.state);
    const pool = fromDistrict.wants.filter((id) => sellable.includes(id));
    if (pool.length) {
      look = { ...look, ...wearOf(fromDistrict.look, Math.random) };
      wants = Phaser.Utils.Array.Shuffle([...pool]).slice(0, Phaser.Math.Between(1, 2));
    }
  }
  const start = forced?.at ?? visitors.streetSpawn(scene);
  const sprite = arrived?.sprite ?? persons.makePerson(scene, start.x, start.y, look);
  if (!arrived) weatherFx.addUmbrella(scene, sprite);
  // Иногда приходят парой.
  if (!arrived && !thief && !rare && !valya && !forced?.first && look.stroller === undefined && Math.random() < 0.08) persons.addCompanion(scene, sprite);
  if (rare) {
    sound.bell();
    // Редкий гость сверкает, пока он в магазине.
    const sparkles = scene.add.particles(0, 0, 'spark', {
      lifespan: 700,
      speed: { min: 4, max: 14 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 1, end: 0 },
      frequency: 160,
      x: { min: -7, max: 7 },
      y: { min: -16, max: 4 },
    });
    sparkles.startFollow(sprite).setDepth(LIGHT_DEPTH - 1);
    sprite.once('destroy', () => sparkles.destroy());
    scene.time.delayedCall(1500, () => scene.popup(sprite.x, sprite.y - 16, t('popup.rareGuest', { name: `${rare.icon} ${t(rare.nameKey)}` }), '#fee761'));
  }
  if (nightGuest && Math.random() < 0.45) {
    const line = t(`nightGuest.${nightGuest}.${Phaser.Math.Between(0, NIGHT_GUEST_TYPES[nightGuest].lines - 1)}` as TextKey);
    scene.time.delayedCall(1300, () => sprite.active && scene.popup(sprite.x, sprite.y - 16, line, '#cfe8ff'));
  }
  if (valya) {
    scene.valyaCame = true;
    scene.time.delayedCall(1500, () => scene.popup(sprite.x, sprite.y - 16, t('popup.valya'), '#fff3b0'));
  }
  const bubble = scene.art(0, -14, 'bubble').setVisible(false);
  sprite.add(bubble);
  const customer: Customer = { sprite, bubble, items: [], unhappy: false, waitStart: 0, gone: false, thief, rare: rare?.id, wants, first: forced?.first, car: arrived?.car };
  // Вора без охранника видно по красному контуру — его можно поймать касанием. Редкий гость — в золотом.
  if (thief && !scene.workers.has('guard')) personGlow(scene, sprite, 0xe43b44, 3);
  if (rare) personGlow(scene, sprite, 0xfee761, 3);
  scene.customers.add(customer);
  if (thief) {
    // Вора можно поймать касанием.
    sprite.setSize(16, 22).setInteractive({ useHandCursor: true }).on('pointerup', () => scene.tap(() => catchThief(scene, customer, 'owner')));
    void runThief(scene, customer);
  } else {
    void runCustomer(scene, customer);
  }
}

// ---------- Воры ----------

export async function runThief(scene: StoreScene, c: Customer): Promise<void> {
  const { door } = scene.layout;
  await persons.walkVia(scene, c.sprite, [
    { x: door.x, y: scene.streetY },
    { x: door.x, y: door.y - 10 },
  ]);
  // С тележкой у входа покупатель иногда берёт что-то сверх списка.
  const wanted = scene.wanted(Phaser.Math.Between(1, 2) + bigDayExtraItems(scene.state.day) + adExtraItems(scene.state, Math.random));
  for (const id of wanted) {
    const index = shelfFor(scene.state, id);
    // Ларь у кассы на виду — вор туда не идёт.
    if (index < 0 || c.gone || scene.state.shelves[index].kind === 'icebox') continue;
    const stand = scene.standOf(index);
    await persons.walk(scene, c.sprite, stand.x + Phaser.Math.Between(-8, 8), stand.y);
    if (c.gone) return;
    await scene.wait(400);
    const taken = takeFromShelf(scene.state, index, id);
    if (taken && !c.gone) {
      scene.state = taken.state;
      c.items.push({ id, unit: taken.unit });
      scene.refreshShelves();
    }
  }
  if (c.gone) return;
  // Мимо кассы — сразу к выходу.
  await persons.walk(scene, c.sprite, door.x, door.y - 10, THIEF_SPEED);
  if (c.gone) return;
  const guard = scene.workers.get('guard');
  if (guard && c.items.length && Math.random() < guardCatchChance(guard.member)) {
    void persons.walk(scene, guard.sprite, c.sprite.x + 10, c.sprite.y, STAFF_SPEED * 1.5).then(() =>
      persons.walk(scene, guard.sprite, guard.home.x, guard.home.y, STAFF_SPEED),
    );
    catchThief(scene, c, 'guard');
    return;
  }
  // Бобик у входа лает — воришка с перепугу бросает товар.
  if (scene.bobik?.active && c.items.length && Math.random() < DOG_DAY_CATCH) {
    pets.bobikBark(scene);
    catchThief(scene, c, 'dog');
    return;
  }
  if (c.items.length) {
    const value = c.items.reduce((sum, { id, unit }) => sum + unitSalePrice(scene.state, id, unit), 0);
    scene.stats.stolen += value;
    note(scene.stats, 'thief');
    haptic.error();
    sound.bad();
    scene.popup(c.sprite.x, c.sprite.y - 14, `${t('popup.stolen')} −${value} 💰`, '#ffd0d0');
  }
  await leave(scene, c);
}

/** Вора поймали: товар возвращается на полки, вор уходит ни с чем. */
export function catchThief(scene: StoreScene, c: Customer, by: 'owner' | 'guard' | 'dog'): void {
  if (c.gone || !scene.running) return;
  c.sprite.disableInteractive();
  scene.state = returnToShelf(scene.state, c.items);
  c.items = [];
  scene.refreshShelves();
  scene.refreshWarehouse();
  scene.stats.caught++;
  haptic.success();
  sound.good();
  scene.popup(c.sprite.x, c.sprite.y - 14, t(by === 'guard' ? 'popup.guardCaught' : by === 'dog' ? 'popup.dogCaught' : 'popup.thiefCaught'), '#c8ffb0');
  void leave(scene, c);
}

export async function runCustomer(scene: StoreScene, c: Customer): Promise<void> {
  const { door } = scene.layout;
  // Первый покупатель нового начала появляется уже на дорожке у двери — с улицы не идёт.
  // Остальные идут по тротуару почти до двери: тележку берут здесь, а к двери заворачивают дугой.
  const gap = c.sprite.x - door.x;
  if (!c.first) await persons.walk(scene, c.sprite, door.x + Math.sign(gap) * Math.min(Math.abs(gap), DOOR_TURN), scene.streetY);
  // Тележки у входа: часть покупателей берёт их — кому удобнее.
  if (persons.cartsAtDoor(scene) && Math.random() < CART_SHARE && !c.sprite.getData('stroller') && !c.thief) persons.giveTrolley(scene, c.sprite);
  const wanted = c.wants ?? scene.wanted(Phaser.Math.Between(1, 2) + bigDayExtraItems(scene.state.day) + adExtraItems(scene.state, Math.random));
  let disappointed = false;
  let why: { reason: LostReason; id: ProductId } | undefined;
  // Подойти, поискать глазами, взять: к полке в зале, к ларю и к вёдрам у кассы — одинаково.
  const visit = async (id: ProductId, index: number): Promise<ReturnType<typeof tryTake> | null> => {
    const stand = scene.standOf(index);
    const fixture = SHELF_KINDS[scene.state.shelves[index].kind].fixture;
    // Над головой облачко: что покупатель ищет.
    const thought = motion.think(scene, c.sprite, id);
    // У боковой полки встают вдоль неё (по вертикали), у обычной — вдоль по горизонтали.
    const along = !fixture && slotSide(scene.layout, scene.spotOf(index)) ? 'y' : 'x';
    const jitter = Phaser.Math.Between(-8, 8) * (fixture ? 0.4 : 1);
    await persons.walk(scene, c.sprite, stand.x + (along === 'x' ? jitter : 0), stand.y + (along === 'y' ? jitter : 0));
    await scene.wait(500);
    // Пока шёл — магазин захватили (или ушёл по другой причине): к полке уже не тянется.
    if (c.gone) {
      motion.endThought(scene, thought, false);
      return null;
    }
    // Первый день новичка: товар кончился на полке, а на складе есть — покупатель ждёт, пока его поднесут.
    // Проверка — без await: у всех остальных путь к полке не сдвигается ни на микрозадачу (порядок случайных чисел — как был).
    if (shelfWaitNeeded(scene, c, index, id) && (await waitForShelf(scene, c, index, id))) {
      motion.endThought(scene, thought, false);
      return null;
    }
    const result = tryTake(scene, c, id);
    motion.reachShelf(scene, c, scene.spotOf(index), result === 'taken' ? id : null, result === 'taken' ? scene.takenFrom : []);
    if (result === 'taken' && c.sprite.y < scene.layout.h && Math.random() < SPILL_CHANCE) staff.spill(scene, c.sprite.x, c.sprite.y + 2);
    const failed = result === 'empty' || result === 'expensive' || result === 'eduard';
    motion.endThought(scene, thought, failed);
    if (failed) {
      disappointed = true;
      // Первая неудача — причина ухода, если покупатель так ничего и не возьмёт.
      why ??= { reason: result, id };
    }
    return result;
  };
  await persons.walkVia(scene, c.sprite, c.first ? [{ x: door.x, y: door.y - 10 }] : [{ x: door.x, y: scene.streetY }, { x: door.x, y: door.y - 10 }]);
  if (c.gone) return;
  // В дождь и снег с улицы несут грязь.
  const muddy = isWet(scene.weather) || scene.weather === 'snow';
  const mud = [...scene.trash].filter((piece) => piece.texture.key === 'mud').length;
  if (muddy && mud < MAX_MUD && Math.random() < MUD_CHANCE * entranceMud(scene.state)) staff.dropTrash(scene, scene.layout.door.x, scene.layout.door.y - 30, 'mud');

  if (c.regular) scene.popup(c.sprite.x, c.sprite.y - 20, t('regular.hello', { name: t(regularById(c.regular).nameKey) }), '#fff3b0');
  if (c.friend) scene.popup(c.sprite.x, c.sprite.y - 20, t('visit.hello', { name: c.friend.name }), '#fee761');
  await scene.visitBargain(c);
  if (c.gone) return;
  // Соседняя полка-пара: взяв хлеб, заодно берут и молоко (один раз за покупку).
  let extra: { id: ProductId; index: number } | null = null;
  for (const id of wanted) {
    if (c.gone) return;
    const index = shelfFor(scene.state, id);
    if (index < 0) continue;
    const result = await visit(id, index);
    if (result === 'taken' && !extra && !c.thief && !c.first) extra = scene.pairPick(index, wanted);
  }
  if (c.gone) return;
  if (extra) {
    scene.popup(c.sprite.x, c.sprite.y - 20, t('popup.pair', { name: t(PRODUCTS[extra.id].nameKey) }), '#d6f5c4');
    await visit(extra.id, extra.index);
    if (c.gone) return;
  }

  if (!c.first && Math.random() < TRASH_CHANCE) staff.dropTrash(scene, c.sprite.x, c.sprite.y);
  if (c.regular) regularVerdict(scene, c);
  // Друг оставляет чаевые — больше, если у него самого магазин побольше.
  if (c.friend && c.items.length) {
    const tip = FRIEND_TIP * (c.friend.level + 1);
    scene.state = { ...scene.state, money: scene.state.money + tip };
    scene.popup(c.sprite.x, c.sprite.y - 28, t('visit.tip', { name: c.friend.name, n: tip }), '#fee761');
  }

  if (c.items.length === 0) {
    // Не нашёл товар или всё слишком дорого — ушёл недовольным, это бьёт по рейтингу.
    // Ночью после рабочего дня полупустые полки — норма: ночные гости рейтинг не роняют.
    // Первый день новичка: «всё раскупили» — не провал, ушедшим без покупки не считается (firstday.ts).
    if (disappointed && !scene.night && !(gentleDay(scene.state) && why?.reason === 'empty')) {
      scene.stats.lost++;
      if (why) noteLost(scene.stats, why.reason, why.id);
    }
    await leave(scene, c);
    return;
  }

  // По пути к кассе — к полке «Еда» за порцией готового (если кухня открыта).
  await food.visitFood(scene, c);
  if (c.gone) return;
  if (!c.first && Math.random() < TOILET_CHANCE) await visitToilet(scene, c);
  if (c.gone) return;
  await food.buyCoffee(scene, c);
  if (c.gone) return;

  if (await scene.useKiosk(c)) return;
  if (c.gone) return;
  // Через одного, по порядку прихода: в тесной очереди встают ёлочкой, и сторона у каждого своя —
  // очередь подвинулась, а люди не перескакивают из ряда в ряд.
  c.queueSide = scene.queueTurn++ % 2;
  scene.queue.push(c);
  persons.layoutQueue(scene);
  const spot = scene.registerOf(c)?.spot ?? persons.queueSpot(scene, c, scene.queue.indexOf(c));
  await persons.walk(scene, c.sprite, spot.x, spot.y);
  if (c.gone) return;
  // Заскучал в очереди — тянется к стойке со сладостями.
  if (!c.serving && Math.random() < impulseChance(scene.state, scene.queue.indexOf(c) + 1)) grabCandy(scene, c);
  c.waitStart = scene.time.now;
  c.bubble.setVisible(true);
  // С котом рядом ждут дольше.
  c.patienceMs =
    PATIENCE_MS *
    catPatience(scene.state) *
    climatePatience(scene.state, weatherFor(scene.state.day)) *
    charmPatience(scene.state) *
    radioPatience(scene.state) *
    signagePatience(scene.state) *
    cartPatience(scene.state) *
    (isCrowdDay(scene.state.day) ? CROWD_PATIENCE : 1) *
    (c.first ? FIRST_PATIENCE : 1);
  c.patience = scene.time.delayedCall(c.patienceMs, () => void giveUp(scene, c));
  persons.layoutQueue(scene);
}

/**
 * Первый день новичка, пока бабушка за прилавком: на полке товар кончился, а на складе он есть —
 * покупатель говорит «сейчас поднесут» и ждёт (бабушка или игрок разложат). true — ушёл, пока ждал.
 */
export function shelfWaitNeeded(scene: StoreScene, c: Customer, index: number, id: ProductId): boolean {
  if (!gentleDay(scene.state) || scene.night || !scene.granny?.active || c.thief) return false;
  return (scene.state.shelves[index]?.items[id]?.length ?? 0) === 0 && (scene.state.warehouse[id] ?? []).some((u) => !u.pending);
}

export async function waitForShelf(scene: StoreScene, c: Customer, index: number, id: ProductId): Promise<boolean> {
  const has = () => (scene.state.shelves[index]?.items[id]?.length ?? 0) > 0;
  scene.popup(c.sprite.x, c.sprite.y - 14, t('first.wait'), '#fff3b0');
  for (let waited = 0; waited < GRANNY_SHELF_WAIT_MS && !has(); waited += 300) {
    await scene.wait(300);
    if (c.gone) return true;
  }
  return c.gone;
}

/** Покупатель у полки: берёт товар, если он есть и цена устраивает. */
export function tryTake(scene: StoreScene, c: Customer, id: ProductId): 'taken' | 'empty' | 'expensive' | 'eduard' | 'skipped' {
  const index = shelfFor(scene.state, id);
  if (scene.state.shelves[index]?.broken) {
    scene.popup(c.sprite.x, c.sprite.y - 14, t('popup.broken'), '#ffd0d0');
    return 'empty';
  }
  const oldest = scene.state.shelves[index]?.items[id]?.[0];
  if (!oldest) {
    scene.popup(c.sprite.x, c.sprite.y - 14, t('popup.noStock'), '#ffd0d0');
    note(scene.stats, 'noStock');
    return 'empty';
  }
  // Ценовая война: у Эдуарда дешевле — часть покупателей уходит к нему.
  if (Math.random() < warLeaves(scene.state, id)) {
    scene.popup(c.sprite.x, c.sprite.y - 14, t('popup.toEduard'), '#ffd0d0');
    note(scene.stats, 'expensive');
    return 'eduard';
  }
  // Ночью — наценка, зато к ценам не придираются; пока пахнет свежим хлебом, за него готовы платить больше.
  const price = Math.ceil(unitSalePrice(scene.state, id, oldest) * (scene.night ? NIGHT_MARKUP : 1));
  const fair =
    perceivedBase(scene.state, id) *
    (scene.night ? NIGHT_TOLERANCE : 1) *
    (id === 'bread' && scene.aroma() ? AROMA_TOLERANCE : 1) *
    fairTolerance(scene.state.day) *
    loyaltyTolerance(scene.state) *
    radioTolerance(scene.state) *
    adTrust(scene.state) *
    // Химия рядом с едой — к еде с этой полки придираются сильнее.
    (scene.clashes(index) ? CLASH_FACTOR : 1);
  // «2 по цене 1»: за штуку выходит вдвое дешевле.
  const bogo = promoKind(scene.state, id) === 'bogo';
  const perUnit = bogo ? price / 2 : price;
  // Постоянный покупатель решает не по случаю, а по своей границе цены.
  const regular = c.regular ? regularById(c.regular) : undefined;
  // Первый покупатель нового начала берёт без раздумий: первая продажа не должна сорваться.
  const declines =
    !c.first && (regular?.favorite === id ? !acceptsPrice(scene.state, livedRegular(scene.state, regular), perUnit) : Math.random() >= buyChance(perUnit, fair));
  if (declines) {
    if (price <= fair) return 'skipped';
    scene.popup(c.sprite.x, c.sprite.y - 14, t('popup.expensive'), '#ffd0d0');
    effects.emote(scene, c.sprite, 'emo_pricey');
    note(scene.stats, 'expensive');
    return 'expensive';
  }
  const taken = takeFromShelf(scene.state, index, id);
  if (!taken) return 'empty';
  if (id === 'bread' && scene.aroma()) note(scene.stats, 'fresh');
  // Заметно дешевле, чем ждали, — запомнят и напишут в отзыве.
  if (perUnit <= fair * CHEAP_RATIO) {
    note(scene.stats, 'cheap');
    if (Math.random() < 0.25) scene.popup(c.sprite.x, c.sprite.y - 14, t('popup.cheap'), '#d6f5c4');
  }
  scene.state = taken.state;
  c.items.push({ id, unit: taken.unit });
  let count = 1;
  // По акции «2 по цене 1» берут вторую штуку бесплатно.
  if (bogo) {
    const second = takeFromShelf(scene.state, index, id);
    if (second) {
      scene.state = second.state;
      c.items.push({ id, unit: second.unit, free: true });
      scene.popup(c.sprite.x, c.sprite.y - 22, t('popup.bogo'), '#fee761');
      count++;
    }
  }
  // С полки пропадают последние штуки этого товара (остальное съедет на их место) — запоминаем,
  // где и какими они были: оттуда товар и полетит в руки (reachShelf), там качнутся соседи.
  const view = scene.shelfViews[index];
  // Разбитое толчком — не товар: оно уже падает с полки, а не летит в руки.
  scene.quakeFlush?.();
  const mine = view?.items.filter((img) => img.visible && (img.getData('stock') as string | null | undefined)?.startsWith(`${id}:`)) ?? [];
  scene.takenFrom = mine
    .slice(-count)
    .reverse()
    .map((img) => ({ x: img.x, y: img.y, texture: img.texture.key, scale: img.scaleX, tint: img.tintTopLeft }));
  scene.refreshShelves();
  if (view && scene.takenFrom.length) motion.jostleShelf(scene, view, scene.takenFrom[0]);
  return 'taken';
}

export async function visitToilet(scene: StoreScene, c: Customer): Promise<void> {
  await persons.walk(scene, c.sprite, scene.layout.wc.x, scene.layout.wc.spotY);
  if (scene.toiletDirt >= 100) {
    c.unhappy = true;
    note(scene.stats, 'toilet');
    scene.popup(c.sprite.x - 10, c.sprite.y - 14, t('popup.toiletAwful'), '#ffd0d0');
    return;
  }
  if (scene.toiletDirt >= TOILET_DIRTY) {
    c.unhappy = true;
    note(scene.stats, 'toilet');
  }
  c.sprite.setVisible(false);
  await scene.wait(1200);
  c.sprite.setVisible(true);
  scene.toiletDirt = Math.min(100, scene.toiletDirt + TOILET_DIRT_PER_VISIT * wcDirt(scene.state));
  scene.refreshToilet();
}

/** Касание кассы (или улицы внизу): хозяин пробивает того, кто ждёт у его кассы, или возвращается с дела. */
export async function serveNext(scene: StoreScene, from = 0): Promise<void> {
  // За кассой хозяина сменщик: касание его кассы (или улицы) торопит пробивку, касание чужой — ничего.
  if (scene.operator(0) !== 'owner') {
    if (from === 0) hurryRelief(scene);
    return;
  }
  if (scene.ownerScanning()) return;
  const r = scene.ownerRegister();
  if (scene.sellerBusy) {
    if (r) staff.recallSeller(scene);
    return;
  }
  const c = r?.customer;
  if (!r || !c || c.serving || !scene.atSpot(r)) return;
  haptic.tap();
  // Хозяин не у кассы (его отвели в сторону — ограбление, перестройка) — сначала к ней.
  if (Phaser.Math.Distance.Between(scene.seller.x, scene.seller.y, r.clerk.x, r.clerk.y) > 2) {
    const id = ++scene.choreId;
    scene.sellerBusy = true;
    await persons.walk(scene, scene.seller, r.clerk.x, r.clerk.y, SELLER_SPEED);
    if (id !== scene.choreId) return;
    scene.sellerBusy = false;
    if (r.customer !== c || c.serving || c.gone) return;
  }
  void scanCustomer(scene, r, c, withUpgrades(scene.state, ownerTiming(scene.state)), true);
}

/**
 * За кассой хозяина сменщик: касание торопит его пробивку (срезает RELIEF_TAP_MS), а сам хозяин
 * за кассу не встаёт. true — касание ушло сменщику.
 */
export function hurryRelief(scene: StoreScene): boolean {
  const r = scene.registers[0];
  if (!r || scene.operator(0) === 'owner') return false;
  if (!r.scan || r.scan.byOwner || (r.scan.cut ?? 0) >= r.scan.total * RELIEF_HURRY_SHARE) return true;
  r.hurry = Math.min(RELIEF_HURRY_MAX_MS, r.hurry + RELIEF_TAP_MS);
  haptic.tap();
  if (r.img) motion.squash(scene, r.img, 1.04, 0.94, 70);
  if (scene.time.now - scene.lastHurry > 1500) {
    scene.lastHurry = scene.time.now;
    scene.popup(r.counter.x, r.counter.y - 36, t('popup.hurry'), '#fff3b0');
  }
  return true;
}

/** Пауза пробивки. У кассы хозяина её срезают касания (r.hurry), пока за кассой сменщик. */
export async function scanWait(scene: StoreScene, r: Register, ms: number): Promise<void> {
  if (scene.registers.indexOf(r) !== 0 || r.scan?.byOwner) return scene.wait(ms);
  let left = ms;
  while (left > 0) {
    // Касаниями пробивку не сделать мгновенной: срезать можно не больше RELIEF_HURRY_SHARE от неё.
    const room = r.scan ? r.scan.total * RELIEF_HURRY_SHARE - (r.scan.cut ?? 0) : 0;
    const cut = Math.min(left, r.hurry, Math.max(0, room));
    if (cut > 0) {
      r.hurry -= cut;
      left -= cut;
      r.scan!.start -= cut;
      r.scan!.cut = (r.scan!.cut ?? 0) + cut;
      continue;
    }
    const step = Math.min(left, 100);
    await scene.wait(step);
    if (!scene.sys.isActive()) return;
    left -= step;
  }
}

/**
 * Пробивка: товары по одному уезжают по ленте, потом оплата. Время зависит от навыка
 * того, кто стоит за кассой (хозяин или кассир) и от размера корзины.
 */
export async function scanCustomer(scene: StoreScene, r: Register, c: Customer, timing: ScanTiming, byOwner: boolean, by?: Phaser.GameObjects.Container): Promise<void> {
  c.serving = true;
  c.patience?.remove();
  c.bubble.setVisible(false);
  // Без света касса не работает — ждём.
  while (scene.blackout && scene.sys.isActive()) await scene.wait(250);
  // В блэкаут на весь район касса считает вручную — медленнее.
  const manual = scene.powerCut ? BLACKOUT_CHECKOUT : 1;
  r.scan = { start: scene.time.now, total: checkoutSeconds(timing, c.items.length) * 1000 * manual, byOwner };
  const { counter } = r;
  const index = scene.registers.indexOf(r);
  // by — кто пробивает вместо хозяина у его кассы (бабушка в первый день, firstday.ts).
  const clerk = by ?? (byOwner ? scene.seller : (scene.operator(index) as Worker | null)?.sprite);
  // Товар и пакет — к тому, кто пробивает: сменщик стоит у стойки чуть выше хозяина.
  const hand = clerk?.active ? { x: clerk.x, y: clerk.y } : r.clerk;
  for (const [n, { id }] of c.items.entries()) {
    await scanWait(scene, r, timing.item * 1000 * manual);
    if (!scene.sys.isActive()) return;
    // Товар — на ленту, под красный луч сканера (вспышка), и дальше к кассиру в пакет.
    const item = scene.art(c.sprite.x, c.sprite.y - 2, `item_${id}`).setScale(2 / ART).setDepth(1000);
    scene.tweens.chain({
      targets: item,
      tweens: [
        { x: counter.x, y: counter.y - 8, duration: 180, ease: 'Quad.easeOut' },
        { x: hand.x, y: hand.y - 8, scale: 1 / ART, alpha: 0.3, duration: 160, ease: 'Quad.easeIn' },
      ],
      onComplete: () => item.destroy(),
    });
    scene.time.delayedCall(170, () => {
      const flash = scene.add.rectangle(counter.x, counter.y - 8, 10, 3, 0xff4a4a).setBlendMode(Phaser.BlendModes.ADD).setDepth(1001);
      scene.tweens.add({ targets: flash, alpha: 0, scaleX: 1.6, duration: 160, onComplete: () => flash.destroy() });
      // Касса чуть вздрагивает на «пик».
      if (r.img) motion.squash(scene, r.img, 1.04, 0.94, 70);
    });
    // Кассир берёт товар: короткий кивок-подпрыгивание.
    if (clerk?.active) {
      const base = (clerk.getData('baseScale') as number) ?? 1;
      scene.tweens.add({ targets: clerk, scaleY: base * 1.06, duration: 90, yoyo: true, onComplete: () => clerk.setScale(base) });
    }
    // Без вибрации на каждый товар: на телефоне она щёлкает громче самого сканера. «Пик» — пачкой:
    // первый товар ясно, дальше через один и тише (sound.ts).
    sound.scan(counter.x, n);
  }
  // Старая касса иногда заедает: пока продавец стучит по ней, очередь ждёт.
  if (Math.random() < registerJam(scene.state)) {
    r.scan.total += REGISTER_JAM_SECONDS * 1000;
    scene.popup(counter.x, counter.y - 22, t('popup.jam'), '#ffd0d0');
    haptic.error();
    scene.tweens.add({ targets: r.screen, alpha: 0, duration: 120, yoyo: true, repeat: 4 });
    await scene.wait(REGISTER_JAM_SECONDS * 1000);
    if (!scene.sys.isActive()) return;
  }
  await scanWait(scene, r, timing.pay * 1000);
  r.scan = null;
  r.hurry = 0;
  if (!scene.sys.isActive()) return;
  // Кассир отдаёт пакет из рук в руки (с тележкой — товар уже в ней).
  if (c.items.length && c.sprite.getData('push') !== 'trolley' && c.sprite.active) {
    const bag = scene.art(hand.x, hand.y - 6, 'paper_bag').setScale(0.85 / ART).setDepth(1000);
    await new Promise<void>((done) =>
      scene.tweens.add({
        targets: bag,
        x: c.sprite.x + 6,
        y: c.sprite.y + 3,
        duration: 260,
        ease: 'Sine.easeInOut',
        onUpdate: (tw) => bag.setY(Phaser.Math.Linear(hand.y - 6, c.sprite.y + 3, tw.progress) - Math.sin(tw.progress * Math.PI) * 8),
        onComplete: () => {
          bag.destroy();
          done();
        },
      }),
    );
    if (!scene.sys.isActive()) return;
  }
  finishCheckout(scene, c, undefined, byOwner);
  if (byOwner) ownerServedOne(scene);
  // Хвалит бабушка только за то, что пробил сам новичок, — уже с этой покупкой в счёте.
  if (byOwner && grannyStays(scene.state)) scene.grannyPraise();
}

/** Редкий гость оставляет чаевые; первый раз — попадает в альбом. */
export function rareGuestServed(scene: StoreScene, c: Customer, total: number): void {
  const tip = Math.round(total * RARE_TIP);
  scene.state = { ...scene.state, money: scene.state.money + tip };
  scene.stats.revenue += tip;
  const guest = RARE_GUESTS.find((g) => g.id === c.rare)!;
  const result = collectRareGuest(scene.state, guest.id);
  scene.state = result.state;
  const { sellerHome } = scene.layout;
  const text = result.isNew
    ? t('popup.albumNew', { name: `${guest.icon} ${t(guest.nameKey)}`, tip })
    : t('popup.tip', { tip });
  scene.popup(sellerHome.x - 24, sellerHome.y - 40, text, '#fee761');
  if (result.isNew && !music.sting('coin')) sound.fanfare();
  if (result.completed) {
    haptic.success();
    scene.time.delayedCall(1200, () => scene.popup(sellerHome.x - 24, sellerHome.y - 52, t('popup.albumDone', { money: ALBUM_REWARD.money }), '#fee761'));
  }
}

/** Хозяин обслужил покупателя: растёт навык кассы. */
export function ownerServedOne(scene: StoreScene): void {
  scene.serves.owner++;
  const before = ownerLevel(scene.state.ownerServed);
  scene.state = { ...scene.state, ownerServed: scene.state.ownerServed + 1 };
  const after = ownerLevel(scene.state.ownerServed);
  if (after > before) {
    haptic.success();
    sound.good();
    const { sellerHome } = scene.layout;
    scene.popup(sellerHome.x - 20, sellerHome.y - 34, t('popup.skillUp', { stars: '★'.repeat(after) }), '#fee761');
  }
}

export function updateScanBar(scene: StoreScene): void {
  for (const r of scene.registers) {
    const scan = r.scan;
    r.bar.setVisible(Boolean(scan));
    r.fill.setVisible(Boolean(scan));
    if (scan) r.fill.width = 16 * Math.min(1, (scene.time.now - scan.start) / scan.total);
    r.screen.setVisible(Boolean(scan));
    // У кассового аппарата нет сканера — луча нет.
    r.beam.setVisible(Boolean(scan) && gearTier(scene.state, 'register') > 0);
    if (scan) {
      const blink = Math.floor(scene.time.now / 140) % 2;
      r.screen.setAlpha(blink ? 0.95 : 0.45);
      r.beam.setAlpha(blink ? 0.15 : 0.6);
    }
  }
}

/** Покупатель расплатился; own — пробивал хозяин (полный звук кассы — награда игроку). */
export function finishCheckout(scene: StoreScene, c: Customer, where?: { x: number; y: number }, own = false): void {
  // Шаг обучения «Пробей покупку» — пробил сам, касанием кассы или улицы.
  if (own) scene.passTut('serve');
  scene.queue = scene.queue.filter((q) => q !== c);
  const at = scene.registerOf(c);
  if (at) at.customer = null;

  // Порцию с полки «Еда» покупатель взял сам по пути (visitFood) — платит за неё здесь, вместе с покупками.
  const { state, total: goods } = checkout(scene.state, c.items, scene.night ? NIGHT_MARKUP : 1);
  // Шоколадка и кофе — сверху к товару.
  const extras = (c.extras ?? []).reduce((sum, e) => sum + e.price, 0);
  const total = goods + extras;
  scene.state = { ...state, money: state.money + extras };
  for (const e of c.extras ?? []) {
    if (e.kind === 'dish') scene.stats.dishes = (scene.stats.dishes ?? 0) + 1;
    else note(scene.stats, e.kind);
  }
  // Чаевые «за котика».
  if (catHome(scene.state) && Math.random() < catTipChance(scene.state)) {
    scene.state = { ...scene.state, money: scene.state.money + CAT_TIP };
    scene.stats.revenue += CAT_TIP;
    note(scene.stats, 'cat');
    scene.time.delayedCall(500, () => scene.popup(c.sprite.x, c.sprite.y - 30, t('popup.catTip', { n: CAT_TIP }), '#fff3b0'));
  }
  if (scene.night) {
    scene.stats.nightRevenue = (scene.stats.nightRevenue ?? 0) + total;
    note(scene.stats, 'night');
  }
  scene.stats.revenue += total;
  scene.stats.served++;
  recordSale(scene.stats, c.items);
  if (c.rare) rareGuestServed(scene, c, total);
  haptic.success();
  // Касса: рычаг, «дзынь», ящик выезжает; мелочь или купюры — смотря по сумме; большая корзина — «спасибо».
  sound.till(c.sprite.x, total, { own, items: c.items.length });
  const base = (c.sprite.getData('baseScale') as number) ?? 1;
  scene.tweens.add({ targets: c.sprite, scaleY: base * 1.12, duration: 110, yoyo: true, onComplete: () => c.sprite.setScale(base) });
  // Пакет, который передал кассир, теперь в руке: с ним покупатель и уходит.
  if (c.items.length && c.sprite.getData('push') !== 'trolley') {
    c.sprite.add(scene.art(6, 3, 'paper_bag').setScale(0.85 / ART));
  }
  const shown = where ?? (at ? { x: at.counter.x + (at === scene.registers[0] ? 8 : -8), y: at.counter.y + 0 } : { x: scene.layout.sellerHome.x - 8, y: scene.layout.sellerHome.y - 18 });
  scene.popup(shown.x, shown.y, `+${total} 💰`, '#c8ffb0');
  scene.combo = scene.time.now - scene.lastSaleAt < COMBO_WINDOW_MS ? scene.combo + 1 : 1;
  scene.lastSaleAt = scene.time.now;
  scene.stats.bestCombo = Math.max(scene.stats.bestCombo, scene.combo);
  // В серии монет летит больше.
  effects.flyCoins(scene, where?.x ?? at?.counter.x ?? scene.layout.counter.x, where?.y ?? at?.counter.y ?? scene.layout.counter.y, Math.min(6, 2 + Math.floor(total / 40)) + Math.min(scene.combo - 1, 5));
  if (scene.combo >= 2) scene.celebrateCombo(scene.combo);
  // Серия от пяти — весь зал оборачивается на кассу.
  if (scene.combo === 5 || scene.combo === 10) persons.everyoneLooks(scene, scene.layout.counter.x, scene.layout.counter.y, 'emo_star');

  const dirty = scene.trash.size >= TRASH_COMPLAINT || scene.binFull();
  const badGoods = hasUnmarkedBad(c.items) && Math.random() < BAD_COMPLAINT_CHANCE;
  // Гнилой мусор и давно полное ведро пахнут: чем сильнее, тем чаще морщатся (rot.ts).
  // (Полное ведро и так «грязно» — его запах здесь не добавляется второй раз.)
  const smelly = !c.unhappy && !dirty && Math.random() < smellChance(staff.smell(scene));
  if (c.unhappy || dirty || badGoods || smelly) {
    scene.stats.complaints++;
    if (badGoods) note(scene.stats, 'badGoods');
    else if (dirty) note(scene.stats, 'dirty');
    else if (smelly) note(scene.stats, 'smell');
    const why = badGoods ? t('popup.badProduct') : dirty ? t('popup.dirty') : smelly ? t('popup.smell') : '😣';
    scene.popup(c.sprite.x, c.sprite.y - 26, why, '#ffd0d0');
    effects.emote(scene, c.sprite, 'emo_angry');
    persons.setMood(scene, c.sprite, 'frown');
  } else {
    persons.setMood(scene, c.sprite, 'happy', 2500);
    if (Math.random() < 0.5) effects.emote(scene, c.sprite, 'emo_heart');
  }
  persons.layoutQueue(scene);
  if (scene.state.onboarding && !onbDone(scene.state, 'sale')) scene.firstSale(total);
  void leave(scene, c, true);
}

/** Ушёл, не заплатив: шоколадка — обратно на стойку, порция — обратно на полку «Еда». */
export function returnExtras(scene: StoreScene, c: Customer): void {
  for (const extra of c.extras ?? []) {
    if (extra.kind === 'candy') scene.state = returnCandy(scene.state);
    if (extra.dish) scene.state = servePortions(scene.state, extra.dish, 1);
  }
  if (c.extras?.some((e) => e.dish)) food.refreshFood(scene);
}

export async function giveUp(scene: StoreScene, c: Customer): Promise<void> {
  if (c.gone || c.serving) return;
  // Первый день новичка после первой продажи: очередь держит бабушка — покупатель ещё подождёт,
  // а у кассы его пробьёт она (firstday.ts grannyServesAfter).
  if (scene.running && !scene.night && scene.granny?.active && grannyServesAfter(scene.state, false) !== null) {
    c.patience = scene.time.delayedCall(GRANNY_PATIENCE_MS, () => void giveUp(scene, c));
    return;
  }
  scene.queue = scene.queue.filter((q) => q !== c);
  const at = scene.registerOf(c);
  if (at) at.customer = null;
  c.bubble.setVisible(false);
  scene.state = returnToShelf(scene.state, c.items);
  c.items = [];
  returnExtras(scene, c);
  c.extras = [];
  scene.refreshShelves();
  scene.refreshWarehouse();
  if (!scene.night) scene.stats.lost++;
  note(scene.stats, 'queue');
  noteLost(scene.stats, 'queue');
  scene.combo = 0;
  haptic.error();
  sound.bad();
  scene.popup(c.sprite.x, c.sprite.y - 14, t('popup.leftAngry'), '#ffd0d0');
  effects.emote(scene, c.sprite, 'emo_angry');
  persons.setMood(scene, c.sprite, 'frown');
  persons.layoutQueue(scene);
  await leave(scene, c);
}

export async function leave(scene: StoreScene, c: Customer, pastCounter = false): Promise<void> {
  c.gone = true;
  const { door, h, queue, counter } = scene.layout;
  const route: Point[] = pastCounter ? [{ x: queue.x, y: counter.y + 40 }] : [];
  // Из зала — в обход полок и в дверной проём (с ближнего к себе края), а не наискосок сквозь мебель
  // и стену у входа. Крюк выходит в пару шагов: на поток покупателей не влияет.
  if (c.sprite.y < h - 2) {
    const from = route[0] ?? c.sprite;
    route.push({ x: door.x + Phaser.Math.Clamp(from.x - door.x, -DOOR_EDGE, DOOR_EDGE), y: door.y - 4 });
  }
  route.push({ x: door.x, y: h + 16 });
  await persons.walkVia(scene, c.sprite, route);
  persons.dropTrolley(c.sprite);
  scene.customers.delete(c);
  // Приехавший на машине идёт к ней на парковку, остальные — по тротуару за край кадра.
  if (c.car) void cars.driveHome(scene, c.sprite, c.car);
  else void visitors.strollAway(scene, c.sprite);
}
