// Покупатели в зале: приход, путь по полкам (что взять, ждать ли раскладки, запах свежего хлеба), туалет,
// очередь и пробивка на кассе, оплата и уход (довольный, с пустыми руками или недождавшийся); особые гости —
// постоянные, друзья, инспектор, Соня, жюри, гости праздников, воришка. Кто придёт — game/customers.ts и др.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import {
  BAD_COMPLAINT_CHANCE,
  buyChance,
  CHEAP_RATIO,
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
import { isWet } from '../game/weather';
import { adExtraItems, adRareBoost, adTrust } from '../game/ads';
import { saleExtraItems } from '../game/weeks';
import { companionOf, livedRegular } from '../game/life';
import { acceptsPrice, recordVisit, regularById, regularsToday, regularState, tipFor, type Regular } from '../game/regulars';
import { CART_SHARE, loyaltyTolerance, withUpgrades } from '../game/upgrades';
import { dogCatch } from '../game/watch';
import { guestCoins, seeGuest, type GuestId } from '../game/live';
import { onbDone } from '../game/onboarding';
import { treatFriend, visitsInfo, type VisitFriend } from '../platform/multiplayer';
import { servePortions } from '../game/kitchen';
import { NIGHT_GUEST_TYPES, pickNightGuest } from '../game/nightGuests';
import { districtGuest } from '../game/district';
import { crisisExtraItems, crisisTolerance } from '../game/crisis';
import { goodwillTips } from '../game/goodwill';
import * as crisisFx from './crisisFx';
import { slotSide, standFor } from './placement';
import type { Point } from './layout';
import { personGlow } from './halo';
import { CLASH_FACTOR } from '../game/neighbors';
import { smellChance } from '../game/rot';
import { seriesAfter, seriesLost } from '../game/series';
import { beltPlan, beltRest, rhythmOn, RHYTHM_PACE, tillTip } from '../game/tillRhythm';
import { CANDY_PRICE, impulseChance, returnCandy, takeCandy } from '../game/impulse';
import { eyeTheft, ownerTiming } from '../game/owner';
import { radioPatience, radioTolerance } from '../game/radio';
import { cameraTheft, entranceMud, gearTier, REGISTER_JAM_SECONDS, registerJam, wcDirt } from '../game/gear';
import { AROMA_TOLERANCE } from '../game/bakery';
import { NIGHT_MARKUP, NIGHT_TOLERANCE } from '../game/night';
import { CAT_TIP, catBrought, catHome, catPatience, catTipChance } from '../game/cat';
import { note } from '../game/reviews';
import { warLeaves } from '../game/war';
import { noteLost } from '../game/losses';
import { fairTodayTolerance } from '../game/fair';
import { FIRST_REGULAR, firstRegularVisit, gentleDay, noThieves, GUEST_OF_DAY_AT, guestOfDay, grannyServesAfter, grannyStays, quietDays, shelfWaits } from '../game/firstday';
import { catchBounty, GLANCES, HONEST_GLANCE, LINGER_MS, OWNER_BOUNTY, PICK_MS, thiefPicks, trainingThief } from '../game/thiefTells';
import {
  ART,
  LIGHT_DEPTH,
  PATIENCE_MS,
  SELLER_SPEED,
  TOILET_DIRTY,
  SHIRTS,
  type Look,
  customerLook,
  nightLook,
  nightGuestLook,
  withCompanionItems,
  type ParkSpot,
  STAFF_SPEED,
  VALYA,
  SKINS,
  type Customer,
  type Register,
  type Worker,
} from './common';
import * as skitsFx from './skitsFx';
import * as motion from './motion';
import * as effects from './effects';
import * as pixelFx from './pixelFx';
import * as pets from './pets';
import * as weatherFx from './weatherFx';
import * as food from './food';
import * as cars from './cars';
import * as staff from './staff';
import * as persons from './persons';
import * as visitors from './visitors';
import * as arcsFx from './arcsFx';
import * as newcomer from './newcomer';
import * as camera from './camera';
import * as shelves from './shelves';
import * as building from './building';
import * as thiefFx from './thiefTells';
import * as tillBelt from './tillBelt';

/** Друзья в гостях: сколько за день, чаевые за уровень их магазина, подарок за угощение (как на сервере). */
const FRIEND_VISITS = 2;
const FRIEND_TIP = 40;
const FRIEND_GIFT = 300;
/** Первый покупатель нового начала ждёт у кассы вчетверо дольше: новичок мог засмотреться. */
const FIRST_PATIENCE = 4;
/** Первый день: покупатель в очереди, которого держит бабушка, ждёт ещё столько, а потом снова решает. */
const GRANNY_PATIENCE_MS = 5000;
/** Первый день: сколько покупатель подождёт у пустой полки, пока бабушка несёт товар. */
const GRANNY_SHELF_WAIT_MS = 12_000;
/** Касание кассы, за которой сменщик, срезает столько мс пробивки; про запас — не больше стольких. */
const RELIEF_TAP_MS = 250;
const RELIEF_HURRY_MAX_MS = 1200;
/** Какую долю пробивки сменщика можно срезать касаниями (в симуляторе — RELIEF_TAPS). */
const RELIEF_HURRY_SHARE = 0.3;
const TRASH_CHANCE = 0.15;
/** Столько мусора на полу — и покупатели начинают жаловаться. */
const TRASH_COMPLAINT = 3;
/** В дождь, грозу и снег столько покупателей приносят грязь на ногах. */
const MUD_CHANCE = 0.15;
/** Больше двух грязных пятен разом не бывает — иначе гроза засыпает жалобами. */
const MAX_MUD = 2;
/** Покупатель иногда роняет покупку и разливает: молоко, сок, газировка. */
const SPILL_CHANCE = 0.035;
const TOILET_CHANCE = 0.25;
const TOILET_DIRT_PER_VISIT = 20;
/** За сколько точек до двери покупатель сворачивает с тротуара ко входу (дуга поворота — половина). */
const DOOR_TURN = 16;
/** Насколько в сторону от середины двери можно пройти проём (дверь — около 24 точек шириной). */
const DOOR_EDGE = 8;
/** К выходу вор торопится — и это тоже примета (thiefTells.ts). */
const THIEF_SPEED = 52;
/** Сколько кассир пробивает одного покупателя при обычной скорости. */
const INSPECTOR_SHIRT = 0x222034;
/** Соня: каштановые волосы, сиреневая толстовка, жёлтый рюкзак (как на портрете, art/family.py). */
const SONYA: Look = { shirt: 0xffffff, skin: 0xf2d3ab, pants: 0x3a4466, hair: 0x8f563b, style: 'long', outfit: 'hoodie', outfitTint: 0x68386c, bag: 'backpack', bagTint: 0xfee761 };
/**
 * Праздничные гости: Дед Мороз — весь в красном, с белой бородой, меховым воротником и посохом;
 * Снегурочка — в голубом, с белым воротником, в диадеме и с косой. Шуба из гардероба (furcoat)
 * нарисована коричневой и в красный не красится — поэтому пуховик с оттенком (coat) и шарф-воротник.
 */
const LIVE_GUEST_LOOKS: Record<GuestId, Look> = {
  moroz: { shirt: 0xe43b44, pants: 0xe43b44, coat: 0xe43b44, scarf: 0xffffff, hair: 0xffffff, style: 'bald', skin: 0xf2d3ab, hat: 'ushanka', hatTint: 0xe43b44, face: 'beard', faceTint: 0xffffff, prop: 'cane' },
  snegurochka: { shirt: 0x9cd8ff, pants: 0x9cd8ff, coat: 0x9cd8ff, scarf: 0xffffff, hair: 0xead4aa, style: 'long', skin: 0xf2d3ab, hat: 'tiara' },
};
/** Жюри: строгие костюмы, у одного портфель, у другого блокнот (как у инспектора). */
const JURY_LOOKS: Look[] = [
  { shirt: 0xffffff, skin: 0xf2d3ab, pants: 0x262b44, hair: 0xc0cbdc, outfit: 'suit', outfitTint: 0x3a4466, prop: 'briefcase', propTint: 0x733e39 },
  { shirt: 0xf6757a, skin: 0xeec39a, pants: 0x262b44, hair: 0x4a2c1a, style: 'long', outfit: 'suit', outfitTint: 0x68386c, face: 'sunglasses' },
  { shirt: 0xffffff, skin: 0xd9a066, pants: 0x181425, hair: 0x181425, outfit: 'suit', outfitTint: 0x265c42, prop: 'newspaper' },
];

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
  // Первые дни новичка (firstday.ts): Пётр Ильич знакомится в своё время, и редкий «гость дня».
  const first = firstRegularVisit(scene.state);
  if (first) {
    const petr = regularById(FIRST_REGULAR);
    scene.time.delayedCall(first.at * DAY_SECONDS * 1000, () => scene.running && scene.timeLeft > 0 && spawnRegular(scene, petr, first.line));
  }
  scene.guestOfDayDue = false;
  if (guestOfDay(scene.state)) scene.time.delayedCall(GUEST_OF_DAY_AT * DAY_SECONDS * 1000, () => (scene.guestOfDayDue = true));
  const coming = regularsToday(scene.state).filter((r) => (!first || r.id !== FIRST_REGULAR) && Math.random() < livedRegular(scene.state, r).every);
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
    camera.tap(scene, () => {
      if (customer.friend!.treated) return scene.popup(sprite.x, sprite.y - 30, t('visit.treated', { name: f.name }), '#fff3b0');
      customer.friend = { ...customer.friend!, treated: true };
      void treatFriend(f.id).then((ok) => ok && sprite.active && scene.popup(sprite.x, sprite.y - 30, t('visit.treat', { name: f.name, n: FRIEND_GIFT }), '#c8ffb0'));
      effects.emote(scene, sprite, 'emo_heart');
    }),
  );
  scene.customers.add(customer);
  void runCustomer(scene, customer);
}

export function spawnRegular(scene: StoreScene, r: Regular, hello?: 'meet' | 'back'): void {
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
  const customer: Customer = { sprite, bubble, items: [], unhappy: false, waitStart: 0, gone: false, thief: false, regular: r.id, wants: [r.favorite, ...extra], hello };
  scene.customers.add(customer);
  void runCustomer(scene, customer);
}

/** Постоянный покупатель нашёл любимое по своей цене — доверие растёт (и чаевые), нет — падает. */
export function regularVerdict(scene: StoreScene, c: Customer): void {
  const r = regularById(c.regular!);
  const happy = c.items.some((item) => item.id === r.favorite);
  // Знакомство в первый день: не нашёл хлеба — не беда, завтра придёт снова (доверие не падает).
  if (c.hello === 'meet' && !happy) return;
  const { state, result } = recordVisit(scene.state, r.id, happy);
  scene.state = state;
  const name = t(r.nameKey);
  const y = c.sprite.y - 24;
  if (result === 'up') {
    effects.emote(scene, c.sprite, 'emo_heart');
    // Облачко сердечек pixelfx вокруг него — привязался к магазину сильнее.
    pixelFx.burst(scene, 'hearts', c.sprite.x, c.sprite.y, { fade: 1100, zoom: 1 });
    scene.popup(c.sprite.x, y, t('regular.up', { name }), '#c8ffb0');
    const total = c.items.reduce((sum, item) => sum + unitSalePrice(scene.state, item.id, item.unit), 0);
    // Благоустроенный район (hood.ts) и доброе имя магазина (goodwill.ts): постоянные щедрее.
    const tip = Math.round(tipFor(regularState(scene.state, r.id).loyalty, total) * hoodTips(scene.state) * goodwillTips(scene.state));
    if (tip > 0) {
      scene.state = { ...scene.state, money: scene.state.money + tip };
      scene.time.delayedCall(900, () => {
        scene.popup(c.sprite.x, y - 8, t('regular.tip', { n: tip }), '#fee761');
        effects.tipCoins(scene, c.sprite);
      });
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
  for (const i of scene.state.shelves.map((_, i) => i)) if (scene.state.shelves[i].kind !== 'icebox') await look(shelves.standOf(scene, i).x, shelves.standOf(scene, i).y);
  await look(wc.x - 6, wc.spotY + 4);
  await look(sellerHome.x - 30, sellerHome.y - 10);
  if (!scene.sys.isActive()) return;

  // Переполненное ведро инспектор считает как две кучки мусора.
  const result = inspect(scene.state, { trash: scene.trash.size + (building.binFull(scene) ? 2 : 0) + ([...scene.trash].some((piece) => piece.getData('rot')) ? 1 : 0), toiletDirt: scene.toiletDirt });
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

/** Сколько реплик у Сони при визите (sonya.visit.N). */
const SONYA_LINES = 4;

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
  scene.speak(sprite, 20, t('drama.visit'));
  // 11.11 (автор: «во время спец сюжета магазин на паузе»): Соня говорит с папой — магазин ждёт.
  skitsFx.talkPause(scene, { portrait: 'portrait_sonya_happy', name: t('who.sonya'), text: `«${t(`sonya.visit.${(scene.state.day % SONYA_LINES) + 1}` as TextKey)}»`, pitch: 760 });
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
  scene.speak(sprite, 20, `«${t(`live.guest.${guest.who}.line` as TextKey)}»`);
  // Праздничный гость поздравляет — магазин ждёт, пока он говорит (как в сценках дня).
  skitsFx.talkPause(scene, {
    portrait: `portrait_${guest.who}_happy`,
    name: t(`who.${guest.who}` as TextKey),
    text: `«${t(`live.guest.${guest.who}.line` as TextKey)}»`,
    pitch: guest.who === 'moroz' ? 240 : 700,
  });
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
  const thief = !forced && !arrived && !noThieves(scene.state) && Math.random() < thiefChance(scene.state.level) * cameraTheft(scene.state) * eyeTheft(scene.state);
  const valya = !forced && !arrived && !thief && !scene.night && !scene.valyaCame && scene.state.day > 1 && Math.random() < 0.15;
  // Воришка по повадкам (13.11): одет как все — ни тёмной кофты, ни красного контура; выдаёт его поведение.
  const shirt = valya ? VALYA.shirt : Phaser.Utils.Array.GetRandom(SHIRTS);
  // Блогер сегодня снимает обзор — редкие гости заходят вдвое чаще. В тихие дни новичка (firstday.ts) случайных нет:
  // редкий гость там один — «гость дня», с объявлением; второй, нечаянный, — лишний шум посреди обучения.
  const rareChance = quietDays(scene.state) ? 0 : rareGuestChance(scene.state.level) * adRareBoost(scene.state);
  const dayGuest = scene.guestOfDayDue && !forced && !arrived && !thief && !valya && !scene.night;
  if (dayGuest) scene.guestOfDayDue = false;
  const rare = dayGuest || (!forced && !arrived && !thief && !valya && !scene.night && Math.random() < rareChance) ? pickRareGuest(scene.state, Math.random) : null;
  let look: Look = forced
    ? forced.look
    : arrived
      ? arrived.look
      : rare
        ? (rare.look as Look)
        : valya
          ? VALYA
          : scene.night
            ? nightLook()
            : thief
              ? customerLook(shirt, scene.state.day) // одет как все, но без коляски и собаки: с ними на дело не ходят
              : withCompanionItems(customerLook(shirt, scene.state.day));
  // Ночью — гость с характером: свой образ, свой список и реплика у входа (nightGuests.ts).
  // 13.11: вор ночью тоже в образе ночного гостя (и, бывает, с его репликой у входа) — иначе «тот, кто без образа»
  // выдавал бы его. Список покупок ночного гостя ему ни к чему: берёт своё (thiefPicks).
  const nightGuest = scene.night && !forced && !arrived && !rare && !valya ? pickNightGuest(Math.random) : null;
  if (nightGuest) look = nightGuestLook(nightGuest);
  const big = bigDayFor(scene.state.day);
  // Приехавший на машине уже одет (маска в эпидемию — ещё у машины, carCustomer).
  if (!rare && !valya && !arrived) {
    // Ремонт дороги: рабочие в касках приходят за обедом. Болезнь: почти все в масках.
    if (big === 'roadworks' && !forced && !scene.night && Math.random() < ROADWORKERS) look = { ...look, ...wearOf('builder', Math.random) };
    if (big && BIG_DAYS[big].masks && !look.face && Math.random() < MASKS) look = { ...look, face: 'medmask' };
  }
  // Гость из здания района: свой образ и свой список покупок (district.ts).
  let wants: ProductId[] | undefined = forced?.wants;
  const fromDistrict = !forced && !arrived && !rare && !thief && !valya && !scene.night ? districtGuest(scene.state, Math.random) : null;
  if (nightGuest && !thief) {
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
  // Беда района: первые гости дня — за водой и хлебом (crisisFx.ts).
  const rush = !forced && !arrived && !rare && !thief && !valya && !nightGuest ? crisisFx.rushWants(scene) : null;
  if (rush) wants = rush;
  // Хроники района: в праздник часть гостей нарядные, в день детей — дети с шарами (arcsFx.ts).
  if (!forced && !arrived && !rare && !valya && !nightGuest && !fromDistrict) look = arcsFx.dressUp(scene, look);
  const start = forced?.at ?? visitors.streetSpawn(scene);
  const sprite = arrived?.sprite ?? persons.makePerson(scene, start.x, start.y, look);
  if (!arrived) weatherFx.addUmbrella(scene, sprite);
  // Иногда приходят парой.
  if (!arrived && !thief && !rare && !valya && !forced?.first && look.stroller === undefined && Math.random() < 0.08) persons.addCompanion(scene, sprite);
  if (rare) {
    sound.bell();
    // Гость дня первых дней новичка — с объявлением, чтобы его заметили.
    if (dayGuest) scene.popup(sprite.x, sprite.y - 22, t('first.guestOfDay', { name: t(rare.nameKey) }), '#fee761');
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
    scene.time.delayedCall(1300, () => sprite.active && scene.speak(sprite, 16, line));
  }
  if (rush) crisisFx.rushSay(scene, sprite);
  if (valya) {
    scene.valyaCame = true;
    scene.time.delayedCall(1500, () => scene.speak(sprite, 16, t('popup.valya')));
  }
  const bubble = scene.art(0, -14, 'bubble').setVisible(false);
  sprite.add(bubble);
  const customer: Customer = { sprite, bubble, items: [], unhappy: false, waitStart: 0, gone: false, thief, rare: rare?.id, wants, first: forced?.first, car: arrived?.car };
  // Редкий гость — в золотом контуре. Вор — без контура (13.11): только самый первый, учебный, подсвечен красным,
  // пока игрок не поймал ни одного, — видно, как ведёт себя воришка (thiefTells.ts trainingThief).
  if (thief && !scene.workers.has('guard') && trainingThief(scene.state, scene.stats.caught)) {
    customer.training = true;
    personGlow(scene, sprite, 0xe43b44, 3);
  }
  if (rare) personGlow(scene, sprite, 0xfee761, 3);
  scene.customers.add(customer);
  // Любого незнакомого покупателя в зале можно заподозрить касанием (друзья, постоянные и редкие гости — свои).
  if (!rare && !forced?.first) thiefFx.suspectable(scene, customer);
  void (thief ? runThief(scene, customer) : runCustomer(scene, customer));
}

// ---------- Воры ----------

/**
 * Воришка по повадкам (13.11, game/thiefTells.ts): у входа на него рычит Бобик; у полки он, как все, «думает» о
 * товаре, но оглядывается, у самого дорогого стоит подолгу и прячет взятое в карман; потом — мимо кассы к выходу.
 * Камеры берут его в рамку. Касание, пока он ходит по полкам, — пойман (thiefTells.ts suspect).
 */
export async function runThief(scene: StoreScene, c: Customer): Promise<void> {
  const { door } = scene.layout;
  await persons.walkVia(scene, c.sprite, [
    { x: door.x, y: scene.streetY },
    { x: door.x, y: door.y - 10 },
  ]);
  if (c.gone) return;
  thiefFx.growl(scene, c);
  if (c.training) thiefFx.teach(scene, c);
  // Касанием его можно заподозрить ровно тогда же, когда и честного: с порога и пока ходит по полкам (13.11).
  c.browsing = true;
  const picks = thiefPicks(scene.state, scene.wanted(Phaser.Math.Between(1, 2)));
  for (const [n, id] of picks.entries()) {
    const index = shelfFor(scene.state, id);
    if (index < 0 || c.gone) continue;
    const stand = shelves.standOf(scene, index);
    await persons.walk(scene, c.sprite, stand.x + Phaser.Math.Between(-8, 8), stand.y);
    if (c.gone) return;
    // Взялся за своё у полки — теперь о нём можно сказать подсказкой (thiefTells.ts sneakingThief).
    c.sneaking = true;
    // Облачко с товаром — как у всех: вора выдаёт не оно, а то, что он делает.
    const thought = motion.think(scene, c.sprite, id);
    thiefFx.camFlash(scene, c, 2);
    await thiefFx.glance(scene, c, GLANCES);
    // Первым идёт самое дорогое — у него стоит подолгу, ждёт, пока никто не смотрит.
    if (!c.gone) await scene.wait(n === 0 ? LINGER_MS : PICK_MS);
    motion.endThought(scene, thought, false);
    if (c.gone) return;
    const from = thiefFx.spotOnShelf(scene, index, id);
    const taken = takeFromShelf(scene.state, index, id);
    if (!taken) continue;
    scene.state = taken.state;
    c.items.push({ id, unit: taken.unit });
    scene.refreshShelves();
    thiefFx.pocket(scene, c, from);
    await scene.wait(450);
    if (c.gone) return;
  }
  if (c.gone) return;
  // Мимо кассы — сразу к выходу. Полки позади: касанием его уже не взять, как и честного по пути к кассе, —
  // иначе «кто идёт к двери и нажимается, тот и вор». Дальше ловят охранник и Бобик.
  c.browsing = false;
  c.sneaking = false;
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
  if (scene.bobik?.active && c.items.length && Math.random() < dogCatch(scene.state)) {
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
  // Награда — только с поличным (thiefTells.ts catchBounty): у порога, с пустыми руками, вор просто уходит.
  const bounty = by === 'owner' && c.items.length > 0;
  scene.state = returnToShelf(scene.state, c.items);
  c.items = [];
  scene.refreshShelves();
  building.refreshWarehouse(scene);
  scene.stats.caught++;
  if (by === 'guard') staff.credit(scene, 'guard');
  haptic.success();
  sound.good();
  // Сам хозяин заметил по повадкам — награда (thiefTells.ts): ловить теперь труднее, а ошибка стоит обиды.
  if (bounty) {
    scene.state = catchBounty(scene.state, 1);
    effects.tipCoins(scene, c.sprite);
  }
  const text = bounty ? `${t('popup.thiefCaught')} +${OWNER_BOUNTY} 💰` : t(by === 'owner' ? 'popup.thiefCaught' : by === 'guard' ? 'popup.guardCaught' : 'popup.dogCaught');
  scene.popup(c.sprite.x, c.sprite.y - 14, text, '#c8ffb0');
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
  const wanted = c.wants ?? scene.wanted(Phaser.Math.Between(1, 2) + bigDayExtraItems(scene.state.day) + crisisExtraItems(scene.state) + adExtraItems(scene.state, Math.random) + saleExtraItems(scene.state, Math.random));
  let disappointed = false;
  let why: { reason: LostReason; id: ProductId } | undefined;
  // Подойти, поискать глазами, взять: к полке в зале, к ларю и к вёдрам у кассы — одинаково.
  const visit = async (id: ProductId, index: number): Promise<ReturnType<typeof tryTake> | null> => {
    const stand = shelves.standOf(scene, index);
    const fixture = SHELF_KINDS[scene.state.shelves[index].kind].fixture;
    // Над головой облачко: что покупатель ищет.
    const thought = motion.think(scene, c.sprite, id);
    // У боковой полки встают вдоль неё (по вертикали), у обычной — вдоль по горизонтали.
    const along = !fixture && slotSide(scene.layout, shelves.spotOf(scene, index)) ? 'y' : 'x';
    const jitter = Phaser.Math.Between(-8, 8) * (fixture ? 0.4 : 1);
    await persons.walk(scene, c.sprite, stand.x + (along === 'x' ? jitter : 0), stand.y + (along === 'y' ? jitter : 0));
    // Иной честный тоже разок оглянется (thiefTells.ts HONEST_GLANCE): вора выдаёт не одна примета, а все вместе.
    if (!c.gone && !noThieves(scene.state) && Math.random() < HONEST_GLANCE) void thiefFx.glance(scene, c, 1);
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
    motion.reachShelf(scene, c, shelves.spotOf(scene, index), result === 'taken' ? id : null, result === 'taken' ? scene.takenFrom : []);
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
  // 11.11 (автор: «после таймера магазин ещё долго не закрывается»): время вышло, пока шёл к двери, — не заходит.
  if (closing(scene) && !c.thief) {
    await leave(scene, c);
    return;
  }
  await persons.walkVia(scene, c.sprite, c.first ? [{ x: door.x, y: door.y - 10 }] : [{ x: door.x, y: scene.streetY }, { x: door.x, y: door.y - 10 }]);
  if (c.gone) return;
  // В дождь и снег с улицы несут грязь.
  const muddy = isWet(scene.weather) || scene.weather === 'snow';
  const mud = [...scene.trash].filter((piece) => piece.texture.key === 'mud').length;
  if (muddy && mud < MAX_MUD && Math.random() < MUD_CHANCE * entranceMud(scene.state)) staff.dropTrash(scene, scene.layout.door.x, scene.layout.door.y - 30, 'mud');

  if (c.hello) {
    // Первый постоянный новичка: знакомится или вернулся, как обещал, — реплика подольше и с сердечком.
    effects.emote(scene, c.sprite, 'emo_heart');
    scene.speak(c.sprite, 20, t(c.hello === 'meet' ? 'first.regularMeet' : 'first.regularBack', { name: t(regularById(c.regular!).nameKey), shop: scene.shopTitle() }));
  } else if (c.regular) scene.popup(c.sprite.x, c.sprite.y - 20, t('regular.hello', { name: t(regularById(c.regular).nameKey) }), '#fff3b0');
  if (c.friend) scene.popup(c.sprite.x, c.sprite.y - 20, t('visit.hello', { name: c.friend.name }), '#fee761');
  // Пока ходит по полкам — его можно заподозрить касанием (thiefTells.ts); у кассы, кофе, в туалете — нет.
  c.browsing = true;
  await building.visitBargain(scene, c);
  if (c.gone) return;
  // Соседняя полка-пара: взяв хлеб, заодно берут и молоко (один раз за покупку).
  let extra: { id: ProductId; index: number } | null = null;
  for (const id of wanted) {
    if (c.gone) return;
    // Закрываемся: с тем, что уже в корзине, — сразу к кассе; с пустыми руками — к выходу (не в обиде).
    if (closing(scene) && !c.thief) break;
    const index = shelfFor(scene.state, id);
    if (index < 0) continue;
    const result = await visit(id, index);
    if (result === 'taken' && !extra && !c.thief && !c.first) extra = shelves.pairPick(scene, index, wanted);
  }
  if (c.gone) return;
  if (extra && !closing(scene)) {
    scene.popup(c.sprite.x, c.sprite.y - 20, t('popup.pair', { name: t(PRODUCTS[extra.id].nameKey) }), '#d6f5c4');
    await visit(extra.id, extra.index);
    if (c.gone) return;
  }
  c.browsing = false;

  if (!c.first && Math.random() < TRASH_CHANCE) staff.dropTrash(scene, c.sprite.x, c.sprite.y);
  if (c.regular) regularVerdict(scene, c);
  // Друг оставляет чаевые — больше, если у него самого магазин побольше.
  if (c.friend && c.items.length) {
    const tip = FRIEND_TIP * (c.friend.level + 1);
    scene.state = { ...scene.state, money: scene.state.money + tip };
    scene.popup(c.sprite.x, c.sprite.y - 28, t('visit.tip', { name: c.friend.name, n: tip }), '#fee761');
    effects.tipCoins(scene, c.sprite);
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

  // По пути к кассе — к полке «Еда» за порцией готового (если кухня открыта). Закрываемся — сразу к кассе.
  if (!closing(scene)) {
    await food.visitFood(scene, c);
    if (c.gone) return;
    if (!c.first && Math.random() < TOILET_CHANCE) await visitToilet(scene, c);
    if (c.gone) return;
    await food.buyCoffee(scene, c);
    if (c.gone) return;
  }

  if (await building.useKiosk(scene, c)) return;
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
  // С котом рядом и под радио ждут дольше (климат, указатели, тележки и обаяние убраны 02.11 — gear.ts).
  c.patienceMs =
    PATIENCE_MS *
    catPatience(scene.state) *
    radioPatience(scene.state) *
    (isCrowdDay(scene.state.day) ? CROWD_PATIENCE : 1) *
    (c.first ? FIRST_PATIENCE : 1);
  c.patience = scene.time.delayedCall(c.patienceMs, () => void giveUp(scene, c));
  persons.layoutQueue(scene);
}

/** Рабочее время вышло: зал доживает последних покупателей (днём; ночная смена закрывается по-своему). */
const closing = (scene: StoreScene): boolean => scene.timeLeft <= 0;

/**
 * Тихие дни новичка (firstday.ts shelfWaits): на полке товар кончился, а на складе он есть — покупатель
 * говорит «сейчас поднесут» и ждёт. В первый день разложат бабушка или игрок, во 2-й и 3-й — сам игрок.
 */
export function shelfWaitNeeded(scene: StoreScene, c: Customer, index: number, id: ProductId): boolean {
  if (!shelfWaits(scene.state, Boolean(scene.granny?.active)) || scene.night || c.thief) return false;
  return (scene.state.shelves[index]?.items[id]?.length ?? 0) === 0 && (scene.state.warehouse[id] ?? []).some((u) => !u.pending);
}

export async function waitForShelf(scene: StoreScene, c: Customer, index: number, id: ProductId): Promise<boolean> {
  const has = () => (scene.state.shelves[index]?.items[id]?.length ?? 0) > 0;
  scene.speak(c.sprite, 14, t('first.wait'));
  for (let waited = 0; waited < GRANNY_SHELF_WAIT_MS && !has(); waited += 300) {
    await scene.wait(300);
    if (c.gone) return true;
  }
  return c.gone;
}

/** Покупатель у полки: берёт товар, если он есть и цена устраивает. */
export function tryTake(scene: StoreScene, c: Customer, id: ProductId): 'taken' | 'empty' | 'expensive' | 'eduard' | 'skipped' {
  const index = shelfFor(scene.state, id);
  const oldest = scene.state.shelves[index]?.items[id]?.[0];
  if (!oldest) {
    scene.speak(c.sprite, 14, t('popup.noStock'));
    note(scene.stats, 'noStock');
    return 'empty';
  }
  // Ценовая война: у Эдуарда дешевле — часть покупателей уходит к нему.
  if (Math.random() < warLeaves(scene.state, id)) {
    scene.speak(c.sprite, 14, t('popup.toEduard'));
    note(scene.stats, 'expensive');
    return 'eduard';
  }
  // Ночью — наценка, зато к ценам не придираются; пока пахнет свежим хлебом, за него готовы платить больше.
  const price = Math.ceil(unitSalePrice(scene.state, id, oldest) * (scene.night ? NIGHT_MARKUP : 1));
  const fair =
    perceivedBase(scene.state, id) *
    (scene.night ? NIGHT_TOLERANCE : 1) *
    (id === 'bread' && scene.aroma() ? AROMA_TOLERANCE : 1) *
    fairTodayTolerance(scene.state) *
    loyaltyTolerance(scene.state) *
    radioTolerance(scene.state) *
    adTrust(scene.state) *
    // В беду района за воду и хлеб готовы платить больше (crisis.ts).
    crisisTolerance(scene.state, id) *
    // Химия рядом с едой — к еде с этой полки придираются сильнее.
    (shelves.clashes(scene, index) ? CLASH_FACTOR : 1);
  const perUnit = price;
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
  const count = 1;
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
  building.refreshToilet(scene);
}

/** Касание кассы (или улицы внизу): хозяин пробивает того, кто ждёт у его кассы, или возвращается с дела. */
export async function serveNext(scene: StoreScene, from = 0): Promise<void> {
  // Касание чужой кассы, за которой сейчас пробивает кассир, торопит его — как сменщика за своей.
  if (from > 0 && hurryRegister(scene, from)) return;
  // За кассой хозяина сменщик: касание его кассы (или улицы) торопит пробивку.
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
  hurry(scene, r);
  return true;
}

/**
 * Касание кассы, за которой пробивает кассир (не первой — та хозяина): торопит его так же, как сменщика.
 * С 10.11: раньше касание чужой кассы ничего не делало, и в большом магазине с кассирами игроку днём было
 * нечего нажимать. true — касса с кассиром за работой, касание ушло ему.
 */
export function hurryRegister(scene: StoreScene, index: number): boolean {
  const r = scene.registers[index];
  if (!r || index === 0 || !r.scan || r.scan.byOwner) return false;
  hurry(scene, r);
  return true;
}

/** Поторопить пробивку на кассе r: срезать ещё RELIEF_TAP_MS (не больше RELIEF_HURRY_SHARE от всей пробивки). */
function hurry(scene: StoreScene, r: Register): void {
  if (!r.scan || r.scan.byOwner || (r.scan.cut ?? 0) >= r.scan.total * RELIEF_HURRY_SHARE) return;
  r.hurry = Math.min(RELIEF_HURRY_MAX_MS, r.hurry + RELIEF_TAP_MS);
  haptic.tap();
  if (r.img) motion.squash(scene, r.img, 1.04, 0.94, 70);
  if (scene.time.now - scene.lastHurry > 1500) {
    scene.lastHurry = scene.time.now;
    scene.popup(r.counter.x, r.counter.y - 36, t('popup.hurry'), '#fff3b0');
  }
}

/** Пауза пробивки. Пока пробивает кассир (сменщик за кассой хозяина или кассир своей кассы), её срезают касания (r.hurry). */
export async function scanWait(scene: StoreScene, r: Register, ms: number): Promise<void> {
  if (r.scan?.byOwner) return scene.wait(ms);
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
  // Серия у кассы: сколько покупатель простоял у кассы, прежде чем его начали пробивать.
  c.reactMs = c.readyAt === undefined ? 0 : scene.time.now - c.readyAt;
  // Без света касса не работает — ждём.
  while (scene.blackout && scene.sys.isActive()) await scene.wait(250);
  // В блэкаут на весь район касса считает вручную — медленнее.
  const manual = scene.powerCut ? BLACKOUT_CHECKOUT : 1;
  // Касса в ритме (game/tillRhythm.ts, 13.11): пробивает сам игрок — первые товары едут по ленте под касание.
  // Не за бабушку и не в блэкаут (сканер стоит, считают вручную); не на ×2 и не в спешке закрытия — там зал
  // бежит быстрее, и такт стал бы неловимым. Лента — только после карточки «Новое» (rhythmOn).
  // Совсем быстрому хозяину ленты нет (taps 0): товар не успел бы доехать до луча быстрее, чем он пробивает сам.
  const belt = byOwner && !by && !scene.powerCut && scene.speed === 1 && scene.timeLeft > 0 && c.items.length && rhythmOn(scene.state) ? beltPlan(timing, c.items.length) : null;
  const plan = belt?.taps ? belt : null;
  r.scan = { start: scene.time.now, total: checkoutSeconds(timing, c.items.length) * 1000 * manual, byOwner, rhythm: Boolean(plan) };
  const { counter } = r;
  const index = scene.registers.indexOf(r);
  // by — кто пробивает вместо хозяина у его кассы (бабушка в первый день, firstday.ts).
  const clerk = by ?? (byOwner ? scene.seller : (scene.operator(index) as Worker | null)?.sprite);
  // Товар и пакет — к тому, кто пробивает: сменщик стоит у стойки чуть выше хозяина.
  const hand = clerk?.active ? { x: clerk.x, y: clerk.y } : r.clerk;
  let itemMs = timing.item * 1000 * manual;
  let payMs = timing.pay * 1000;
  if (plan) {
    const ran = await tillBelt.runBelt(scene, r, c, plan, clerk, hand);
    if (!ran) return;
    c.rhythm = scene.rhythm;
    // Что сверх ленты (больше RHYTHM_TAPS товаров) хозяин пробивает сам, как раньше, — в общем времени ленты:
    // в такт — быстрее прежнего, иначе — не дольше прежнего (beltRest).
    const rest = beltRest(plan, timing, c.items.length, ran.state, ran.clock);
    const extra = c.items.length - plan.taps;
    itemMs = extra ? Math.min(timing.item * 1000 * RHYTHM_PACE, rest / extra) : 0;
    payMs = rest - extra * itemMs;
  }
  for (const [n, { id }] of c.items.entries()) {
    if (plan && n < plan.taps) continue;
    await scanWait(scene, r, itemMs);
    if (!scene.sys.isActive()) return;
    // Товар — на ленту, под красный луч сканера (вспышка), и дальше к кассиру в пакет.
    const item = scene.art(c.sprite.x, c.sprite.y - 2, `item_${id}`).setScale(2 / ART).setDepth(1000);
    const fly = scene.tweens.chain({
      targets: item,
      tweens: [
        { x: counter.x, y: counter.y - 8, duration: 180, ease: 'Quad.easeOut' },
        { x: hand.x, y: hand.y - 8, scale: 1 / ART, alpha: 0.3, duration: 160, ease: 'Quad.easeIn' },
      ],
      onComplete: () => item.destroy(),
    });
    // Кассир замахивается товаром — и на «пик» рывком вытягивается (motion.beat): касание — под лучом.
    scene.time.delayedCall(100, () => motion.beat(scene, clerk));
    scene.time.delayedCall(170, () => {
      const flash = scene.add.rectangle(counter.x, counter.y - 8, 10, 3, 0xff4a4a).setBlendMode(Phaser.BlendModes.ADD).setDepth(1001);
      scene.tweens.add({ targets: flash, alpha: 0, scaleX: 1.6, duration: 160, onComplete: () => flash.destroy() });
      // Касса чуть вздрагивает на «пик»; товар на миг белеет и замирает под лучом.
      if (r.img) motion.squash(scene, r.img, 1.04, 0.94, 70);
      motion.flashWhite(scene, item, 40);
      motion.hold(scene, fly, 50);
      // Без вибрации на каждый товар: на телефоне она щёлкает громче самого сканера. «Пик» — пачкой:
      // первый товар ясно, дальше через один и тише (sound.ts). Звук — в миг касания, а не вылета.
      sound.scan(counter.x, n);
    });
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
  await scanWait(scene, r, payMs);
  // Пробил сам игрок: стоял за кассой (не бабушка вместо него) или торопил сменщика касаниями.
  c.byPlayer = (byOwner && !by) || (r.scan.cut ?? 0) > 0;
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
  if (byOwner && grannyStays(scene.state)) newcomer.grannyPraise(scene);
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
    // В ритме полоску заменяет сама лента: сколько ехать — решают касания, а не часы.
    r.bar.setVisible(Boolean(scan) && !scan?.rhythm);
    r.fill.setVisible(Boolean(scan) && !scan?.rhythm);
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

/**
 * Покупатель дошёл до своей кассы: с этого мига считается, сколько его заставили ждать до пробивки
 * (серия у кассы, game/series.ts). Зовётся каждый кадр идущего дня.
 */
export function markReady(scene: StoreScene): void {
  for (const r of scene.registers) {
    const c = r.customer;
    if (c && c.readyAt === undefined && !c.serving && scene.atSpot(r)) c.readyAt = scene.time.now;
  }
}

/** Серия прервалась (кто-то ушёл, не дождавшись): если уже шли чаевые — сказать об этом у кассы. */
export function breakSeries(scene: StoreScene): void {
  const lost = seriesLost(scene.combo, 0);
  scene.combo = 0;
  if (!lost) return;
  const { counter } = scene.layout;
  scene.popup(counter.x - 14, counter.y - 40, t('popup.comboLost'), '#ffd0d0');
}

/** Покупатель расплатился; own — пробивал хозяин (полный звук кассы — награда игроку). */
export function finishCheckout(scene: StoreScene, c: Customer, where?: { x: number; y: number }, own = false): void {
  // Шаг обучения «Пробей покупку» — пробил сам, касанием кассы или улицы.
  if (own) newcomer.passTut(scene, 'serve');
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
    scene.state = catBrought(scene.state, CAT_TIP);
    scene.stats.revenue += CAT_TIP;
    note(scene.stats, 'cat');
    scene.time.delayedCall(500, () => {
      scene.popup(c.sprite.x, c.sprite.y - 30, t('popup.catTip', { n: CAT_TIP }), '#fff3b0');
      effects.tipCoins(scene, c.sprite);
    });
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
  // Серия у кассы (game/series.ts): в неё идёт только то, что пробил сам игрок. Не заставил ждать — растёт,
  // и с третьей покупки подряд покупатель оставляет чаевые; заставил — начинается заново. С 13.11 к ним
  // прибавляются чаевые за ритм (tillRhythm.ts): «Идеально» подряд на ленте, в час пик — вдвое.
  let series = 0;
  let tip = 0;
  if (c.byPlayer) {
    const before = scene.combo;
    series = scene.combo = seriesAfter(before, c.reactMs ?? 0);
    scene.stats.bestCombo = Math.max(scene.stats.bestCombo, series);
    tip = tillTip(series, c.rhythm ?? 0, total, scene.rushNow);
    if (tip) {
      scene.state = { ...scene.state, money: scene.state.money + tip };
      scene.stats.revenue += tip;
      scene.stats.seriesTips = (scene.stats.seriesTips ?? 0) + tip;
      effects.tipCoins(scene, c.sprite);
    }
    if (seriesLost(before, series)) scene.popup(scene.layout.counter.x - 14, scene.layout.counter.y - 54, t('popup.comboLost'), '#ffd0d0');
  }
  // Оплата — событие: искры у кассы, монеты фонтаном к счётчику, крупная сумма (в серии — больше монет и «×N»).
  effects.payBurst(scene, shown.x, shown.y, total, series);
  if (series >= 2) scene.celebrateCombo(series, tip);
  // Серии ещё нет, а чаевые за ритм уже есть — сказать о них отдельно.
  else if (tip) scene.popup(c.sprite.x, c.sprite.y - 26, t('popup.tip', { tip }), '#fee761');
  // Серия от пяти — весь зал оборачивается на кассу.
  if (series === 5 || series === 10) persons.everyoneLooks(scene, scene.layout.counter.x, scene.layout.counter.y, 'emo_star');

  const dirty = scene.trash.size >= TRASH_COMPLAINT || building.binFull(scene);
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
  if (scene.state.onboarding && !onbDone(scene.state, 'sale')) newcomer.firstSale(scene, total);
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
  // Закрываемся: зал идёт быстрее (StoreScene, CLOSING_HURRY) — и терпение тает быстрее. Последним в очереди
  // даём ещё столько же времени: пробить их до закрытия — нормальное дело, не повод уйти обиженным.
  if (closing(scene) && !c.closingGrace) {
    c.closingGrace = true;
    c.patience = scene.time.delayedCall(c.patienceMs ?? PATIENCE_MS, () => void giveUp(scene, c));
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
  building.refreshWarehouse(scene);
  if (!scene.night) scene.stats.lost++;
  note(scene.stats, 'queue');
  noteLost(scene.stats, 'queue');
  breakSeries(scene);
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
