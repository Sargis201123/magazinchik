// Утро и начало дня: ритуал возвращения и подарок за вход, утреннее окно (ui/morning.ts) и что меняется
// после него (персонал, украшения, реклама), сторож зависшей паузы, утренние дела перед открытием, урок
// итогов первого дня, распаковка новинок в зале (коробка, кольцо с искрами, флажок «НОВОЕ»).

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { DAY_SECONDS, emptyDayStats, shelveAll, warehouseCount } from '../game/economy';
import { zarLook } from '../game/zarechye';
import { seasonFor } from '../game/endless';
import { saveGame } from '../game/save';
import { branchLook } from '../game/branch';
import { hoodLook } from '../game/hood';
import { streetKey } from '../game/street';
import { fetchStreet, streetInfo } from '../platform/multiplayer';
import { t } from '../i18n';
import { sound } from '../platform/sound';
import { music } from '../platform/music';
import { trustedNow } from '../platform/telegram';
import { toast, UI_FONT } from '../ui/dom';
import { giantLook } from '../game/giant';
import { lazy, prefetch, withLazy } from '../platform/lazy';
import { weatherFor } from '../game/weather';
import { claimGift, giftTomorrow } from '../game/gift';
import { showGift } from '../ui/gift';
import { collectOrder, openChest, takeLetter } from '../game/returns';
import { showReturn } from '../ui/returns';
import { hasDog } from '../game/watch';
import { contestOf, juryDay } from '../game/contest';
import { sonyaVisits, sunflowersPlanted } from '../game/drama';
import { activeEvent, guestDue } from '../game/live';
import { liveEvents, todayLocal } from '../platform/live';
import { askWriteAccessOnce } from '../platform/social';
import { helpScan } from '../game/help';
import { flushSoon, track } from '../platform/analytics';
import { playDayOne } from '../game/onboarding';
import { pendingStory } from '../game/story';
import { tutAt, tutIndex, tutMorning, tutTell } from '../game/tutorial';
import { ensureSeason } from '../game/pass';
import { ensureRush } from '../game/rush';
import { stockKitchen } from '../game/kitchen';
import { seeTrickResult, trickResult } from '../game/tricks';
import { districtKey } from '../game/district';
import { reportError } from '../platform/errors';
import { WING_OUTER } from './layout';
import { castsShadow } from './floor';
import { eduardLook } from '../game/eduard';
import { cafeDeliver } from '../game/cafe';
import { hasRadio } from '../game/radio';
import { liveEventsFor } from '../game/minievents';
import { momentsFor } from '../game/moments';
import { fridgeLeak } from '../game/gear';
import { catHome } from '../game/cat';
import { fairToday } from '../game/fair';
import { takeLiteNote } from '../platform/quality';
import { quietDays } from '../game/firstday';
import { ART, WALL, FACADE_H, LIGHT_DEPTH, staffKey } from './common';
import * as starPets from './starPets';
import * as motion from './motion';
import * as effects from './effects';
import * as lighting from './lighting';
import * as weatherFx from './weatherFx';
import * as decorations from './decorations';
import * as weeksFx from './weeks';
import * as linesFx from './brandLines';
import { endSale } from '../game/weeks';
import * as deliveries from './deliveries';
import * as food from './food';
import * as streets from './streets';
import * as cars from './cars';
import * as staff from './staff';
import * as shoppers from './shoppers';
import * as visitors from './visitors';
import * as arcsFx from './arcsFx';
import * as bigDays from './bigDays';
import * as liveFx from './liveFx';
import * as nightShift from './nightShift';
import * as newcomer from './newcomer';
import * as rivals from './rivals';
import * as camera from './camera';
import * as shelves from './shelves';
import * as building from './building';
import * as collections from './collections';

/**
 * Утреннее окно (ui/morning.ts и всё, что открывается только из него) — отдельным файлом сборки:
 * у новичка в первый день утра нет, а титул без него приходит быстрее. Подкачивается, пока виден
 * титул (prefetchMorning), так что к «Играть» / «Продолжить» обычно уже на месте.
 */
const morningUi = lazy('morning', () => import('../ui/morning'));
/** Через сколько после открытия дня подкачивать утреннее окно (у новичка его до завтра не будет). */
const MORNING_PREFETCH_MS = 20_000;
export const prefetchMorning = (): void => prefetch(morningUi);

/**
 * Что распаковывают из коробки, когда оно впервые появилось в зале: оборудование (терминал, касса
 * самообслуживания, радио, кассы, климат, камеры, склад, кофемашина, печь) и украшения.
 */
const UNBOX =
  /^(card_terminal|kiosk\d?|radio|phone|counter\d|bin_t\d_0|fan_base|ac_wall|cam|air_curtain|mat_grate|autostore|pallet_jack|forklift|carts|coffee_machine\d?|cafe_table|oven\d?|rug|neon|plant_big|art_[a-z]+|light_(sconce|pendant|lantern|chandelier)|gumball|aquarium|lucky_cat|fountain|jukebox)$/;
/** Новинки распаковывают по очереди, с таким шагом. */
const UNBOX_STEP = 350;
/** Флажок «НОВОЕ» висит над новинкой два часа по часам зала (смена идёт с 8:00 до 20:00). */
const NEW_TAG_MS = (DAY_SECONDS * 1000 * 2) / 12;
/** Когда (доли дня) случается мини-событие; если их два — первое до обеда, второе к вечеру. */
const LIVE_WINDOW: [number, number] = [0.2, 0.6];
const LIVE_WINDOWS: [number, number][] = [
  [0.15, 0.4],
  [0.55, 0.8],
];
/** Мелочь вещи (лопасти, огонёк, экран): прячется и появляется вместе с ней при распаковке. */
type Kin = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible;

// ---------- День ----------

/** Подарок за ежедневный вход: деньги (и товар) сразу в состоянии, окно — поверх утра. */
export function offerGift(scene: StoreScene): void {
  const claimed = claimGift(scene.state, todayLocal(), Math.random);
  if (!claimed) return;
  // Товар из гостинца сразу встаёт на полки, если есть место.
  scene.state = shelveAll(claimed.state);
  saveGame(scene.state);
  scene.hud.update(scene.state, DAY_SECONDS);
  building.refreshWarehouse(scene);
  scene.time.delayedCall(400, () => showGift(claimed.gift, giftTomorrow(scene.state, todayLocal())));
  // Со второго дня — один раз спросить, можно ли боту напоминать о магазине.
  if (scene.state.day > 1) scene.time.delayedCall(4000, askWriteAccessOnce);
}

/**
 * Ритуал возвращения (returns.ts): сундучок выручки, письмо, сосед за отложенным — одним окном
 * поверх утра; после него — then (гостинец). Нечего показать — сразу then.
 */
export function offerReturn(scene: StoreScene, then: () => void): void {
  // Утро открывают заново (расстановка, возврат из гостей) — ритуал второй раз не показываем.
  if (scene.ritualDay === scene.state.day) {
    then();
    return;
  }
  scene.ritualDay = scene.state.day;
  const chest = scene.state.ret?.chest;
  const letter = takeLetter(scene.state, todayLocal());
  if (letter) {
    scene.state = letter.state;
    collections.note(scene, 'cards', letter.gift.letter.from);
  }
  const order = collectOrder(scene.state);
  // Заказ не на сегодня (устарел) — сосед просто не пришёл, окно о нём не нужно.
  const fresh = order && order.order.day === scene.state.day ? order : null;
  if (order) scene.state = order.state;
  if (letter || order) {
    saveGame(scene.state);
    scene.hud.update(scene.state, DAY_SECONDS);
    if (order?.paid) scene.refreshShelves();
  }
  if (letter) track('ret_letter', scene.state.day);
  if (fresh) track(fresh.paid ? 'ret_order' : 'ret_order_wait', scene.state.day, fresh.paid);
  if (!chest && !letter && !fresh) {
    then();
    return;
  }
  scene.time.delayedCall(400, () =>
    showReturn({
      chest,
      letter: letter?.gift,
      order: fresh ?? undefined,
      state: scene.state,
      onChest: () => {
        const opened = openChest(scene.state);
        if (!opened) return;
        scene.state = opened.state;
        saveGame(scene.state);
        scene.hud.update(scene.state, DAY_SECONDS);
        track('ret_chest', scene.state.day, opened.chest.sum);
      },
      onDone: then,
    }),
  );
}

export function showMorning(scene: StoreScene): void {
  // Утреннее окно ещё в пути (медленная связь) — дождаться его и только потом всё утро целиком:
  // гостинец, письма и новости соперника открываются поверх окна, как и без разбивки (окно — первым).
  // У новичка в первый день окна нет — ждать нечего.
  if (!morningUi.get() && !playDayOne(scene.state)) {
    withLazy(morningUi, () => showMorning(scene));
    return;
  }
  // За ночь склад доливает полки: утром всё, что влезает, уже стоит в зале (просрочку списали ночью).
  // По настоящим часам: новый сезон пропуска и выходные «Чёрной пятницы района».
  scene.state = ensureRush(ensureSeason(shelveAll(scene.state), trustedNow()), trustedNow());
  // Подарок за ежедневный вход — но не во время бабушкиного обучения: его вручат, когда оно закончится.
  // В новом начале в первый день утра нет, а потом гостинец ждёт конца вступления главы.
  const noMorning = playDayOne(scene.state);
  // Игру закрыли на итогах дня — утром о них уже не говорим.
  scene.state = tutMorning(scene.state);
  const afterStory = scene.state.onboarding === 'play' && pendingStory(scene.state)?.kind === 'intro';
  // Сначала то, что накопилось без игрока (сундучок, письмо, сосед за заказом), потом гостинец.
  if (scene.state.tourDone !== false && !noMorning && !afterStory) offerReturn(scene, () => offerGift(scene));
  // Улица друзей — свежая к следующему утру (чаще раза в 10 минут не спрашиваем).
  void fetchStreet();
  // Старые сохранения сразу получают значки за то, что уже сделано.
  scene.checkAchievements(false);
  // Лёгкую графику включили молча в тихие дни новичка — теперь можно и сказать.
  if (!quietDays(scene.state) && takeLiteNote()) toast('assets/ico_phone.png', t('lite.autoTitle'), t('lite.autoText'));
  scene.morningStock = warehouseCount(scene.state);
  decorations.applyFair(scene);
  // Отметка вечерней распродажи из сохранения посреди дня — утром не действует (weeks.ts).
  scene.state = endSale(scene.state);
  weeksFx.applyWeek(scene);
  linesFx.applyLines(scene);
  scene.awaitingBoxes = 0;
  scene.hud.update(scene.state, DAY_SECONDS);
  if (weatherFor(scene.state.day) !== scene.weather) weatherFx.applyWeather(scene);
  // Примерка премиальной вещи кончилась вчера — убрать её из зала.
  const trial = scene.state.decor.trial;
  const trialOver = Boolean(trial && trial.day < scene.state.day);
  if (trialOver) scene.state = { ...scene.state, decor: { ...scene.state.decor, trial: undefined } };
  // Эдуард за ночь открыл магазин побольше — перерисовать улицу.
  const cupChanged = (contestOf(scene.state)?.wins ?? 0) !== scene.builtCup;
  const gift = scene.giftRebuild;
  scene.giftRebuild = false;
  if (gift || newcomer.cleanKey(scene) !== scene.builtClean || trialOver || cupChanged || eduardLook(scene.state) !== scene.builtEduard || giantLook(scene.state) !== scene.builtGiant || branchLook(scene.state) !== scene.builtBranch || districtKey(scene.state) !== scene.builtDistrict || hoodLook(scene.state) !== scene.builtHood || zarLook(scene.state) !== scene.builtZar || decorations.honorLook(scene.state) !== scene.builtHonor || streetKey(streetInfo()) !== scene.builtStreet) scene.buildWorld();
  cars.refillParking(scene);
  scene.updateLighting(0);
  nightShift.openShop(scene);
  // Новый день: после ночной смены — снова дневная музыка; зима могла начаться или кончиться.
  scene.nightMusic = false;
  scene.winterTune = decorations.isWinterMusic(scene);
  scene.newYearSound = decorations.isNewYearSound(scene);
  music.prefetch('day_open');
  // Новое начало: первый день — сразу торговля, без утреннего окна.
  if (noMorning) {
    startDay(scene);
    return;
  }
  withLazy(morningUi, ({ showMorning: showMorningMenu }) => showMorningMenu({
    onArrange: () => shelves.arrange(scene),
    onVisit: (id, name) => {
      scene.pendingVisit = undefined;
      void rivals.visitFriend(scene, id, name);
    },
    // Днём собрались в гости с «Улицы друзей» (friendStreet.ts) — окно предложит зайти первым делом.
    visit: scene.pendingVisit,
    onRival: (key, name) => void rivals.visitRival(scene, key, name),
    onBoss: eduardLook(scene.state) !== 'vacant' ? () => void rivals.visitRival(scene, null, '') : undefined,
    onTourDone: () => offerReturn(scene, () => offerGift(scene)),
    onStoryDone: afterStory ? () => offerReturn(scene, () => offerGift(scene)) : undefined,
    coach: scene.coach,
    getState: () => scene.state,
    setState: (s) => {
      const staffChanged = s.staff !== scene.state.staff;
      const decorChanged = s.decor !== scene.state.decor;
      const adsChanged = s.ads !== scene.state.ads || s.adRuns !== scene.state.adRuns;
      // Купили приёмник — его надо поставить на прилавок; сменили волну — только музыка.
      const upgradesChanged = s.upgrades !== scene.state.upgrades || s.registers !== scene.state.registers || s.kiosks?.n !== scene.state.kiosks?.n || s.kiosks?.tier !== scene.state.kiosks?.tier || s.gear !== scene.state.gear || hasRadio(s) !== hasRadio(scene.state);
      const radioChanged = s.radio !== scene.state.radio;
      // Кота оставили, купили лежанку или он вернулся с прогулки — перерисовать вход.
      const was = scene.state;
      // Убрали или продали полку — остальные остались на местах, но сами места переставлены.
      const placesChanged = s.slotPos !== was.slotPos || s.tillPos !== was.tillPos || s.propPos !== was.propPos;
      const catChanged = Boolean(s.cat) !== Boolean(was.cat) || s.cat?.bed !== was.cat?.bed || catHome(s) !== catHome(was) || hasDog(s) !== hasDog(was) || sunflowersPlanted(s) !== sunflowersPlanted(was);
      // Купили оборудование или украшение — при открытии его распакуют. Перестановка — не покупка.
      const bought = (decorChanged || upgradesChanged) && !placesChanged && s.level === scene.builtLevel;
      // Наняли — новенький при открытии войдёт в дверь.
      if (staffChanged) for (const m of s.staff) if (!was.staff.some((o) => staffKey(o) === staffKey(m))) scene.newHires.add(staffKey(m));
      scene.state = s;
      saveGame(s);
      // Переехали на сегодня в другой район (game/zarechye.ts) — другой магазин целиком, а не расширение.
      if (zarLook(s) !== scene.builtZar) scene.buildWorld();
      else if (s.level > scene.builtLevel) void effects.celebrateExpansion(scene);
      else if (s.level !== scene.builtLevel || placesChanged || decorChanged || upgradesChanged || catChanged || eduardLook(s) !== scene.builtEduard || giantLook(s) !== scene.builtGiant || branchLook(s) !== scene.builtBranch || hoodLook(s) !== scene.builtHood || zarLook(s) !== scene.builtZar) scene.buildWorld(bought);
      else {
        if (staffChanged) staff.syncStaff(scene);
        // Купили, позвали другого или отправили домой питомца за звёзды — только он, без перестройки зала.
        if (s.pets?.active !== was.pets?.active || s.pets?.owned !== was.pets?.owned) starPets.buildStarPet(scene);
      }
      if (adsChanged) streets.applyAds(scene);
      if (radioChanged) decorations.applyRadio(scene, true);
      // Открыли линейку своей марки — её уголок сразу на тротуаре или на кухне.
      if (s.lines !== was.lines) linesFx.applyLines(scene);
      scene.awaitingBoxes = deliveries.boxesToDeliver(scene);
      scene.refreshShelves();
      building.refreshWarehouse(scene);
      scene.hud.update(s, DAY_SECONDS);
    },
    onOpen: () => startDay(scene),
  }));
  scene.inMorning = true;
  void rivals.checkRivals(scene);
}

/**
 * Сторож: магазин открыт, время не вышло, окон нет, а день стоит больше 3 секунд — значит,
 * что-то не сняло паузу (окно закрылось не своей кнопкой). Запускаем день дальше и сообщаем.
 */
export function watchStall(scene: StoreScene, deltaMs: number): void {
  const stuck = scene.dayOpen && !scene.running && scene.timeLeft > 0 && !document.querySelector('.ui-modal, .ui-dialog');
  scene.stallMs = stuck ? scene.stallMs + deltaMs : 0;
  if (scene.stallMs < 3000) return;
  scene.stallMs = 0;
  scene.time.paused = false;
  scene.running = true;
  reportError(new Error('day stalled, resumed'), 'watchdog');
}

export function startDay(scene: StoreScene): void {
  // Утреннее окно понадобится завтра — подкачать, когда первые звуки дня уже пришли (platform/lazy.ts).
  setTimeout(prefetchMorning, MORNING_PREFETCH_MS);
  scene.dayOpen = true;
  scene.inMorning = false;
  // Утром в гости не пошли — приглашение с улицы на сегодня отпадает.
  scene.pendingVisit = undefined;
  // Магазин открылся: колокольчик двери и мотив «Магазинчика».
  music.sting('day_open');
  // Купленное с утра ждёт в коробках: камера подлетит к магазину — и его распакуют.
  scene.packFresh();
  camera.flyIn(scene);
  lighting.lightsOn(scene);
  nightShift.flipDoorSign(scene, true);
  visitors.morningCrew(scene);
  // Утром рассказали, чем кончился вчерашний «проверяющий» (tricks.ts) — больше не показываем.
  if (trickResult(scene.state)) scene.state = seeTrickResult(scene.state);
  scene.stallMs = 0;
  try {
    prepareDay(scene);
  } catch (error) {
    // Что-то из утренних дел сломалось (редкое сочетание событий) — день всё равно начинается.
    reportError(error, 'startDay');
  }
  // Утром то, что испортится к ночи, само уходит на полку уценки.
  building.sendToBargain(scene);
  try {
    rivals.openRivalDay(scene);
  } catch (error) {
    reportError(error, 'rivalDay');
  }
  scene.timeLeft = DAY_SECONDS;
  scene.nextSpawn = 1;
  scene.running = true;
  // Друзья откликнулись на «Помоги!» — весь день касса пробивает быстрее (help.ts).
  if (helpScan(scene.state) > 1) {
    const { sellerHome } = scene.layout;
    scene.time.delayedCall(2400, () => scene.running && scene.popup(sellerHome.x - 20, sellerHome.y - 46, t('popup.helpDay'), '#a8f0c8'));
  }
  try {
    rivals.setupTrick(scene);
  } catch (error) {
    reportError(error, 'trick');
  }
  try {
    bigDays.startBigDayIfAny(scene);
  } catch (error) {
    reportError(error, 'bigDay');
    scene.time.paused = false;
    scene.running = true;
  }
  if (scene.state.onboarding && scene.state.day <= 2) newcomer.onboardingDay(scene);
  // Питомец за звёзды здоровается с хозяином (starPets.ts).
  starPets.greetStarPet(scene);
}

/**
 * Итог первого дня: бабушка в одну строчку объясняет плитки сверху. У новичка нового начала в итогах
 * первого дня бабушка и так прощается своей строчкой (firstday.ts) — второе облачко закрыло бы печать
 * и прощание: шаг идёт без подсветки и ждёт «Следующий день».
 */
export function summaryLesson(scene: StoreScene, firstDay = false): void {
  if (!tutAt(scene.state, 'summary')) return;
  const told = tutTell(scene.state);
  if (told) {
    track('tut_step', scene.state.day, tutIndex(scene.state));
    flushSoon();
    scene.state = told;
  }
  if (firstDay) return;
  const tiles = () => document.querySelector<HTMLElement>('.ui-sum .ui-sum-tiles');
  scene.coach.onSkip = () => newcomer.skipTutorial(scene);
  scene.coach.skipButton(true, true);
  scene.coach.show({
    id: 'summary',
    text: t('tut.summary'),
    target: () => {
      const node = tiles();
      const r = node?.getBoundingClientRect();
      return r && r.width ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
    },
    under: tiles,
  });
}

// ---------- Новинки: распаковка купленного ----------

/**
 * Что появилось в зале с прошлой постройки. bought — зал перестроили из-за покупки оборудования
 * или украшения: новое запоминаем, при открытии его распакуют. Перестановка, расширение, гости
 * у друга и загрузка сохранения — не покупки: там только запоминаем, что стоит. Картинки новинок
 * берём из последней постройки (старые уничтожены вместе с залом).
 */
export function noteNewProps(scene: StoreScene, bought: boolean): void {
  const now = scene.unboxables();
  for (const key of scene.freshProps.keys()) scene.freshProps.set(key, now.get(key));
  if (bought) for (const [key, img] of now) if (!scene.builtProps.has(key)) scene.freshProps.set(key, img);
  scene.builtProps = new Set(now.keys());
}

/** Оборудование и украшения магазина (зал и флигель): «текстура@x,y» → картинка. */
export function unboxables(scene: StoreScene): Map<string, Phaser.GameObjects.Image> {
  const { w, h } = scene.layout;
  const found = new Map<string, Phaser.GameObjects.Image>();
  for (const obj of scene.children.list) {
    if (!(obj instanceof Phaser.GameObjects.Image) || !UNBOX.test(obj.texture.key)) continue;
    if (obj.x < -WING_OUTER - 4 || obj.x > w + 4 || obj.y < -20 || obj.y > h + FACADE_H) continue;
    found.set(`${obj.texture.key}@${Math.round(obj.x)},${Math.round(obj.y)}`, obj);
  }
  return found;
}

/**
 * Открытие: новинки прячутся вместе со своими мелочами (лопасти, огоньки, экраны), а когда камера
 * подлетит к магазину (flyIn, 1,6 с), их распакуют по одной — сверху вниз по залу.
 */
export function packFresh(scene: StoreScene): void {
  const fresh = [...scene.freshProps.values()].filter((img): img is Phaser.GameObjects.Image => Boolean(img?.active));
  scene.freshProps.clear();
  if (!fresh.length) return;
  // Крупное — первым: терминал на новой кассе — её мелочь, а не отдельная новинка в воздухе.
  fresh.sort((a, b) => b.displayWidth * b.displayHeight - a.displayWidth * a.displayHeight);
  const taken = new Set<Phaser.GameObjects.GameObject>();
  const items: Phaser.GameObjects.Image[] = [];
  for (const img of fresh) {
    if (taken.has(img)) continue;
    taken.add(img);
    const kin = kinOf(scene, img, taken);
    kin.forEach((o) => taken.add(o.setVisible(false)));
    img.setData('unbox', { kin, sx: img.scaleX, sy: img.scaleY, y: img.y }).setVisible(false);
    items.push(img);
  }
  items.sort((a, b) => a.y - b.y || a.x - b.x);
  // Тень на полу — от того, что уже стоит: новинка в коробке её ещё не отбрасывает.
  if (items.some((img) => castsShadow(img.texture.key)) && scene.floor.ready()) scene.bakeFloor();
  scene.time.delayedCall(1700, () => items.forEach((img, i) => scene.time.delayedCall(i * UNBOX_STEP, () => unbox(scene, img))));
}

/**
 * Мелочи вещи: лопасти вентилятора, огонёк камеры, экран кассы, блик, тень. Стоят на ней (центр —
 * в её рамке), чуть выше по глубине и не огромные (пол и стены не в счёт). Люди и зоны касаний — не мелочи.
 */
export function kinOf(scene: StoreScene, img: Phaser.GameObjects.Image, taken: Set<Phaser.GameObjects.GameObject>): Kin[] {
  const frame = img.getBounds();
  const area = frame.width * frame.height;
  Phaser.Geom.Rectangle.Inflate(frame, 3, 3);
  const kin: Kin[] = [];
  for (const obj of scene.children.list) {
    if (taken.has(obj) || obj.type === 'Container' || obj.type === 'Zone' || obj.type === 'ParticleEmitter') continue;
    const o = obj as Kin & Phaser.GameObjects.Components.Depth & Partial<Phaser.GameObjects.Components.GetBounds>;
    // Плитки отделов, отражения и пятна света на полу (глубина до 0,62) — пол, а не мелочи вещи.
    if (!o.visible || typeof o.getBounds !== 'function' || o.depth <= 0.62 || o.depth < img.depth - 1.5 || o.depth > img.depth + 3) continue;
    const box = o.getBounds();
    if (box.width * box.height <= area * 6 && frame.contains(box.centerX, box.centerY)) kin.push(o);
  }
  return kin;
}

/**
 * Новинка из коробки: сверху падает картонная коробка, клапаны разлетаются, вещь вырастает из неё
 * в золотом кольце с искрами — и два часа носит флажок «НОВОЕ». На слабом телефоне — только рост и флажок.
 */
export function unbox(scene: StoreScene, img: Phaser.GameObjects.Image): void {
  // Зал успели перестроить — картинка уничтожена вместе со старым залом, новая стоит как обычно.
  if (!img.active) return;
  const saved = img.getData('unbox') as { kin: Kin[]; sx: number; sy: number; y: number } | undefined;
  if (!saved) return;
  img.setData('unbox', undefined);
  const { kin, sx, sy, y } = saved;
  const fullH = img.displayHeight;
  const bottom = y + fullH * (1 - img.originY);
  const midY = bottom - fullH / 2;
  // Вещь растёт снизу вверх — низ стоит на месте, как будто поднимается из коробки.
  const grow = () => {
    if (!img.active) return;
    img.setVisible(true).setScale(sx * 0.2, sy * 0.2).setY(bottom - fullH * 0.2 * (1 - img.originY));
    // Пока растёт, пружинка от касания (касса) не трогает её: иначе запомнила бы недоросший размер.
    img.setData({ sqX: undefined, sqY: undefined, sqPy: undefined, growing: true });
    scene.tweens.add({
      targets: img,
      scaleX: sx,
      scaleY: sy,
      y,
      duration: 460,
      ease: 'Back.easeOut',
      easeParams: [2.2],
      onComplete: () => {
        for (const o of kin) if (o.active) o.setVisible(true);
        img.setData('growing', false).setScale(sx, sy).setY(y);
        motion.squash(scene, img, 1.08, 0.9, 110);
        newTag(scene, img);
        // Вещь встала — теперь и тень от неё на полу.
        if (castsShadow(img.texture.key)) scene.bakeFloorSoon();
      },
    });
  };
  if (scene.lite) {
    if (!sound.unbox(img.x)) sound.pop(2, img.x);
    grow();
    return;
  }
  // Коробка по размеру вещи: падает, приседает, клапаны крышки разлетаются, сама она сплющивается.
  // Стоит на полу там же, где низ вещи: полки впереди её закрывают, позади — нет.
  const s = Phaser.Math.Clamp((img.displayWidth / 14) * 1.1, 0.75, 1.9);
  const depth = Math.max(img.depth, bottom) + 4;
  const flaps = [-1, 1].map((side) => scene.art(side * 3.5, -9.5, 'unbox_flap').setFlipX(side > 0));
  const box = scene.add.container(img.x, bottom - 30, [scene.art(0, 0, 'unbox').setOrigin(0.5, 1), ...flaps]).setScale(s).setAngle(8).setDepth(depth);
  // Тень растёт под падающей коробкой — только на полу (у вещей на стене её нет).
  const shadow = bottom > scene.layout.wallH ? scene.art(img.x, bottom, 'shadow').setScale((0.4 * s) / ART).setAlpha(0).setDepth(bottom - 1) : undefined;
  if (shadow) scene.tweens.add({ targets: shadow, alpha: 0.5, scale: (0.9 * s) / ART, duration: 300, ease: 'Quad.easeIn' });
  // Скотч рвут, пока коробка приседает, — клапаны хлопают, когда разлетаются (sound.unbox).
  let ripped = false;
  // Всё по цепочке твинов (а не таймером): клапаны не откроются, пока коробка не долетела.
  const open = () => {
    if (!box.active) return;
    if (!ripped) sound.pop(3, img.x);
    flaps.forEach((flap, i) => {
      const side = i ? 1 : -1;
      scene.tweens.add({ targets: flap, x: side * 15, y: -26, angle: side * 200, alpha: 0, duration: 480, ease: 'Quad.easeOut' });
    });
    scene.tweens.add({ targets: box, scaleY: s * 0.15, alpha: 0, delay: 120, duration: 260, ease: 'Quad.easeIn', onComplete: () => box.destroy() });
    if (shadow) scene.tweens.add({ targets: shadow, alpha: 0, delay: 120, duration: 260, onComplete: () => shadow.destroy() });
    grow();
    unboxShine(scene, img.x, midY, Math.max((img.displayWidth + fullH) / 2, 10));
  };
  scene.tweens.add({
    targets: box,
    y: bottom,
    angle: 0,
    duration: 300,
    ease: 'Quad.easeIn',
    onComplete: () => {
      sound.boxLand(img.x);
      ripped = sound.unbox(img.x, 0.06);
      effects.puff(scene, img.x - 7 * s, bottom);
      effects.puff(scene, img.x + 7 * s, bottom);
      scene.tweens.add({ targets: box, scaleX: s * 1.18, scaleY: s * 0.8, duration: 90, yoyo: true, completeDelay: 80, ease: 'Quad.easeOut', onComplete: open });
    },
  });
}

/** Золотое кольцо, мягкая вспышка и искры вокруг распакованной вещи. */
export function unboxShine(scene: StoreScene, x: number, y: number, size: number): void {
  // Первая распакованная вещь — заставка «покупка» (коробка и колокольчик), следующие — звон медали.
  if (!music.sting('purchase', 4)) sound.medal();
  const ring = scene.add.circle(x, y, size / 2).setStrokeStyle(1.5, 0xfee761, 1).setDepth(LIGHT_DEPTH + 12).setScale(0.5);
  scene.tweens.add({ targets: ring, scale: 1.6, alpha: 0, duration: 560, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
  const flash = scene.art(x, y, 'glow').setDisplaySize(size * 1.6, size * 1.6).setTint(0xfee761).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(LIGHT_DEPTH + 11);
  scene.tweens.add({ targets: flash, alpha: 0.6, duration: 160, yoyo: true, hold: 120, onComplete: () => flash.destroy() });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.3, 0.3);
    const r = size / 2 + Phaser.Math.Between(5, 10);
    const spark = scene.art(x, y, 'spark').setTint(0xfee761).setScale(0.3 / ART).setBlendMode(Phaser.BlendModes.ADD).setDepth(LIGHT_DEPTH + 12);
    scene.tweens.add({
      targets: spark,
      x: x + Math.cos(a) * r,
      y: y + Math.sin(a) * r * 0.8,
      scale: 0.9 / ART,
      angle: 120,
      alpha: { from: 1, to: 0 },
      delay: i * 25,
      duration: 560,
      ease: 'Quad.easeOut',
      onComplete: () => spark.destroy(),
    });
  }
}

/**
 * Красный флажок «НОВОЕ» воткнут в новинку сверху: выскакивает, полощется на ветру и через два часа
 * по часам зала прячется. У правой стены полотнище смотрит влево, чтобы не вылезать за магазин.
 */
export function newTag(scene: StoreScene, img: Phaser.GameObjects.Image): void {
  if (!img.active) return;
  const top = img.y - img.displayHeight * img.originY;
  const left = img.x - img.displayWidth * 0.2 + 25 > scene.layout.w + WALL;
  const x = img.x + (left ? 1 : -1) * img.displayWidth * 0.2;
  // Древко — в 1,5 точки от края картинки 48×18 (24×9 в мире), надпись — по центру полотнища.
  const flag = scene.art(0, 0, 'tag_new').setOrigin(left ? 1 - 1.5 / 48 : 1.5 / 48, 1).setFlipX(left);
  const label = scene.add
    .text((left ? -1 : 1) * 10.25, -5.25, t('store.newTag'), { fontFamily: UI_FONT, fontSize: '4.5px', fontStyle: 'bold', color: '#ffffff' })
    .setOrigin(0.5)
    .setResolution(scene.textRes(8));
  const tag = scene.add.container(x, top + 2, [flag, label]).setDepth(990).setScale(0);
  scene.tweens.add({ targets: tag, scale: 1, duration: 260, ease: 'Back.easeOut', easeParams: [2.5] });
  if (!scene.lite) {
    // Полощется: чуть качается на древке и морщится по ширине.
    tag.setAngle(left ? 3 : -3);
    scene.tweens.add({ targets: tag, angle: left ? -3 : 3, delay: 260, duration: 720, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    scene.tweens.add({ targets: flag, scaleX: 0.93 / ART, delay: 260, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  scene.time.delayedCall(NEW_TAG_MS, () => {
    if (!tag.active) return;
    scene.tweens.killTweensOf([tag, flag]);
    scene.tweens.add({ targets: tag, scale: 0, alpha: 0, duration: 220, ease: 'Back.easeIn', onComplete: () => tag.destroy() });
  });
}

/** Утренние дела перед открытием: персонал, события дня, гости сюжета. */
export function prepareDay(scene: StoreScene): void {
  scene.stats = emptyDayStats();
  scene.serves = { owner: 0, street: 0 };
  scene.recordCheered = false;
  for (const r of scene.registers) {
    r.scan = null;
    r.customer = null;
  }
  scene.night = false;
  scene.nightAsked = false;
  scene.aromaUntil = 0;
  scene.wholesaleBaked = 0;
  scene.parcels = [];
  scene.packRequested = false;
  food.resetOven(scene);
  scene.inspector = scene.state.plan?.inspection ? 'pending' : 'none';
  scene.jury = juryDay(scene.state) ? 'pending' : 'none';
  scene.sonya = sonyaVisits(scene.state) ? 'pending' : 'none';
  // Праздничный гость — раз за настоящий день, сколько игровых дней ни сыграй. В первый день
  // (бабушка показывает магазин) не заходит: новичку и так есть на что смотреть.
  const today = todayLocal();
  const guest = scene.state.day > 1 ? guestDue(scene.state, activeEvent(liveEvents(), today), today) : null;
  scene.liveGuest = guest ? { who: guest, phase: 'pending', date: today } : null;
  scene.inspection = null;
  scene.rushAnnounced = false;
  scene.helpUntil = 0;
  // После перезапуска посреди дня оплаченное уже празднование не повторяет.
  scene.questsSeen = (scene.state.plan?.day === scene.state.day ? scene.state.plan.quests ?? [] : []).filter((q) => q.paid).length;
  // Активные моменты дня: расписание по секундам дня (game/moments.ts).
  scene.moments.start(momentsFor(scene.state, Math.random));
  scene.valyaCame = false;
  staff.syncStaff(scene);
  // Повар на смене — кухня сама закупает у поставщиков продукты на день (из кассы; видно утром у кухни и в итогах).
  const pantry = stockKitchen(scene.state);
  if (pantry.spent) {
    scene.state = pantry.state;
    scene.stats.kitchenSpent = pantry.spent;
    const crate = scene.kitchenView?.crate;
    if (crate) scene.time.delayedCall(900, () => crate.active && scene.popup(crate.x, crate.y - 12, t('popup.kitchenBought', { n: pantry.spent }), '#fff3b0'));
  }
  // Кафе по соседству забирает свой заказ по договору — сразу, как открылись.
  const cafe = cafeDeliver(scene.state);
  scene.state = cafe.state;
  scene.cafeToday = cafe.result;
  if (cafe.result) {
    scene.refreshShelves();
    building.refreshWarehouse(scene);
  }
  // Кафе Ахмеда (хроники района) забирает хлеб в день поставки.
  arcsFx.dealAtOpening(scene);
  visitors.scheduleStoryGuests(scene);
  const season = seasonFor(scene.state.day);
  if (season) scene.time.delayedCall(600, () => scene.popup(scene.layout.w / 2, scene.layout.h / 2, `${season.icon} ${t(season.nameKey)}!`, '#fee761'));
  else if (fairToday(scene.state)) scene.time.delayedCall(600, () => scene.popup(scene.layout.w / 2, scene.layout.h / 2, t('popup.fair'), '#fee761'));
  if (fairToday(scene.state)) scene.stats.fair = true;
  weeksFx.morning(scene);
  decorations.startStall(scene);
  scene.setSpeed(1);
  deliveries.scheduleOrder(scene);
  // Вечером мусор выносят — утром ведро пустое.
  scene.binFill = 0;
  scene.binFullFor = 0;
  building.refreshBin(scene);
  scene.combo = 0;
  scene.lastSaleAt = -Infinity;
  if (scene.awaitingBoxes > 0) void deliveries.deliver(scene);
  liveFx.endLiveEvent(scene);
  shoppers.scheduleRegulars(scene);
  shoppers.scheduleFriends(scene);
  food.refreshKitchen(scene);
  // Старые холодильники иногда подтекают: лужа у одного из них посреди дня.
  if (Math.random() < fridgeLeak(scene.state)) {
    scene.time.delayedCall(Phaser.Math.FloatBetween(0.15, 0.7) * DAY_SECONDS * 1000, () => scene.running && staff.fridgeLeaks(scene));
  }
  // Мини-события (свет, труба, голубь, курьер, мышь): почти каждый день, по очереди (live.ts).
  // Два за день — первое до обеда, второе ближе к вечеру, чтобы не наложились.
  const live = liveEventsFor(scene.state, Math.random);
  scene.state = live.state;
  live.kinds.forEach((kind, i) => {
    const [from, to] = live.kinds.length > 1 ? LIVE_WINDOWS[i] : LIVE_WINDOW;
    scene.time.delayedCall(Phaser.Math.FloatBetween(from, to) * DAY_SECONDS * 1000, () => liveFx.tryLiveEvent(scene, kind));
  });
  scene.eveningMarkdown = false;
  scene.toiletDirt = 0;
  building.refreshToilet(scene);
  for (const piece of scene.trash) piece.destroy();
  scene.trash.clear();
}
