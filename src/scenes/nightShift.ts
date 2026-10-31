// Конец дня и ночь: вечер (спросить про ночную смену или закрыться), ночная смена с ночными гостями и их
// историями, итоги дня («Завтра:», «Позвать на помощь», «Поделиться»), роллеты и табличка на двери, сторож
// и Бобик настороже, ночь между днями (луна, гаснут окна, такси, рассвет) и утреннее открытие.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { PRODUCTS, billTotal, shelfFor, takeFromShelf } from '../game/economy';
import { nightCycle } from '../game/day';
import { rankName, rankOf } from '../game/endless';
import { saveGame } from '../game/save';
import { t, type TextKey } from '../i18n';
import { sound } from '../platform/sound';
import { music } from '../platform/music';
import { haptic } from '../platform/telegram';
import { button, el, openModal, toast, UI_FONT } from '../ui/dom';
import { BIG_DAYS, bigDayFor, filmingReward, fulfillWedding } from '../game/bigday';
import type { SummaryStamp } from '../ui/hud';
import { recordDay } from '../game/achievements';
import { giftTomorrow } from '../game/gift';
import { adGuests } from '../game/ads';
import { regularById } from '../game/regulars';
import { collectOrder, dropOrder, orderTeaser, planLetter, planOrder } from '../game/returns';
import { hasWatchman } from '../game/watch';
import { dramaHeld } from '../game/drama';
import { todayLocal } from '../platform/live';
import { askForHelp, claimHelp, sendHelp, socialInfo } from '../platform/social';
import { HELP_REWARD, HELP_THANKS, helpAsked, helpGiven, markHelpAsked, takeHelp } from '../game/help';
import { reportProgress, track } from '../platform/analytics';
import { onbDone } from '../game/onboarding';
import { firstGiftCard } from '../ui/onboarding';
import { tutDayEnd, tutPass, tutStep } from '../game/tutorial';
import { shareDay as shareDayCard } from '../platform/shareCard';
import { treatFriend } from '../platform/multiplayer';
import { friendsAtWork } from '../game/staff';
import { kitchenOpen } from '../game/kitchen';
import { answerNightStory, DEBT_UNITS, debtLabel, debtProduct, nightStory, STORY_GUEST, type NightStoryId } from '../game/nightGuests';
import { updateRecords } from '../game/records';
import { showChoice } from '../ui/choice';
import { BRAND_BATCH } from '../game/brand';
import { sellWholesale, takeOutBread } from '../game/bakery';
import { canWorkNight, NIGHT_MARKUP, NIGHT_POWER, NIGHT_SECONDS, startNight } from '../game/night';
import { reviewsFor } from '../game/reviews';
import { lossAdvice } from '../game/losses';
import { fpsSummary } from '../platform/quality';
import { firstDayGift, firstDayRating, gentleDay, grannyStays } from '../game/firstday';
import { tomorrowTeaser } from '../game/nudge';
import { teaserText } from '../ui/nudge';
import { ART, TUTORIAL_DAYS, FACADE_H, LIGHT_DEPTH, WATCHMAN, nightGuestLook } from './common';
import * as motion from './motion';
import * as effects from './effects';
import * as pets from './pets';
import * as lighting from './lighting';
import * as deliveries from './deliveries';
import * as food from './food';
import * as staff from './staff';
import * as persons from './persons';
import * as visitors from './visitors';
import * as bigDays from './bigDays';
import * as morningFlow from './morningFlow';
import * as newcomer from './newcomer';
import * as rivals from './rivals';
import * as camera from './camera';

// ---------- Ночная смена ----------

/** Вечер: если куплена ночная смена — спросить, работать ли ещё; иначе закрываемся. */
export function endOfDay(scene: StoreScene): void {
  // Момент, не дождавшийся нажатия к закрытию, уходит вместе с днём (и в ночную смену не остаётся).
  scene.moments.stop();
  // Срочный заказ не успел доехать до закрытия — водитель всё равно выгрузил.
  deliveries.receiveUrgentOrders(scene);
  if (scene.night || scene.nightAsked || !canWorkNight(scene.state)) {
    finishDay(scene);
    return;
  }
  scene.nightAsked = true;
  scene.running = false;
  motion.straightenPeople(scene);
  scene.setSpeed(1);
  const { card, close } = openModal();
  card.append(
    el('h2', '', t('night.title')),
    el('p', '', t('night.text', { n: NIGHT_SECONDS, p: Math.round((NIGHT_MARKUP - 1) * 100) })),
    el('div', 'ui-muted', t('night.cost', { n: NIGHT_POWER })),
    button(
      t('night.yes'),
      () => {
        close();
        startNightShift(scene);
      },
      'ui-btn',
      scene.state.money < NIGHT_POWER,
    ),
    button(
      t('night.no'),
      () => {
        close();
        finishDay(scene);
      },
      'ui-btn secondary',
    ),
  );
}

export function startNightShift(scene: StoreScene): void {
  const next = startNight(scene.state);
  if (!next) {
    finishDay(scene);
    return;
  }
  scene.state = next;
  scene.night = true;
  scene.stats.nightRevenue ??= 0;
  scene.timeLeft = NIGHT_SECONDS;
  scene.nextSpawn = 1;
  scene.running = true;
  // Ночная смена — ночной трек (плавной сменой, music.ts); он доиграет и в итогах этой ночи.
  scene.nightMusic = true;
  sound.bell();
  scene.popup(scene.layout.door.x, scene.layout.door.y - 30, t('popup.night'), '#2ce8f5');
  // Ночная история с выбором (nightGuests.ts) — где-то в первой половине смены.
  scene.busker = false;
  const story = nightStory(Math.random);
  if (story && (story !== 'studentDebt' || debtProduct(scene.state))) {
    scene.trickTimers.push(scene.time.delayedCall(NIGHT_SECONDS * 1000 * Phaser.Math.FloatBetween(0.12, 0.45), () => scene.running && scene.night && void runNightStory(scene, story)));
  }
}

/** Ночной гость с историей: встаёт у кассы с «!», нажми — выбор; не ответил — уходит. */
export async function runNightStory(scene: StoreScene, story: NightStoryId): Promise<void> {
  const { door, sellerHome } = scene.layout;
  const start = visitors.streetSpawn(scene);
  const sprite = persons.makePerson(scene, start.x, start.y, nightGuestLook(STORY_GUEST[story]));
  await persons.walkVia(scene, sprite, [
    { x: door.x, y: scene.streetY },
    { x: door.x, y: door.y - 10 },
    { x: sellerHome.x - 30, y: sellerHome.y - 16 },
  ]);
  if (!sprite.active || !scene.running) {
    sprite.destroy();
    return;
  }
  persons.setFacing(sprite, 'right');
  const mark = scene.add.text(0, -24, '!', { fontFamily: UI_FONT, fontSize: '10px', color: '#2ce8f5', stroke: '#181425', strokeThickness: 3 }).setOrigin(0.5).setResolution(scene.textRes(4));
  sprite.add(mark);
  const blink = scene.tweens.add({ targets: mark, y: -27, duration: 400, yoyo: true, repeat: -1 });
  // Уснувший врач сопит.
  const snore = story === 'sleepyDoctor' ? scene.time.addEvent({ delay: 1400, loop: true, callback: () => sprite.active && scene.popup(sprite.x + 6, sprite.y - 20, 'z z z', '#cfe8ff') }) : null;
  const product = debtProduct(scene.state);
  let answered: boolean | null = null;
  let closeChoice: (() => void) | null = null;
  const hit = scene.add.zone(sprite.x, sprite.y - 6, 22, 30).setInteractive({ useHandCursor: true }).setDepth(2000);
  await new Promise<void>((resolve) => {
    const finish = (yes: boolean) => {
      if (answered !== null) return;
      answered = yes;
      resolve();
    };
    hit.on('pointerup', () =>
      camera.tap(scene, () => {
        if (closeChoice) return;
        const item = product ? `${debtLabel(product)} ${t(PRODUCTS[product].nameKey)}` : '';
        closeChoice = showChoice({
          title: t(`nightStory.${story}.title` as TextKey),
          text: t(`nightStory.${story}.text` as TextKey, { item }),
          note: t(`nightStory.${story}.note` as TextKey),
          yes: t(`nightStory.${story}.yes` as TextKey),
          no: t(`nightStory.${story}.no` as TextKey),
          onYes: () => finish(true),
          onNo: () => finish(false),
        });
      }),
    );
    scene.time.delayedCall(12000, () => {
      closeChoice?.();
      if (answered === null) answered = false;
      resolve();
    });
  });
  hit.destroy();
  blink.stop();
  mark.destroy();
  snore?.remove();
  if (!sprite.active) return;
  const yes = answered === true;
  // Студенту — товар с полок в долг.
  if (yes && story === 'studentDebt' && product) {
    for (let i = 0; i < DEBT_UNITS; i++) {
      const index = shelfFor(scene.state, product);
      const taken = index >= 0 ? takeFromShelf(scene.state, index, product) : null;
      if (taken) scene.state = taken.state;
    }
    scene.refreshShelves();
    sprite.add(scene.art(5, 1, `item_${product}`).setScale(1 / ART));
  }
  const avgCheck = scene.stats.served ? scene.stats.revenue / scene.stats.served : 100;
  const res = answerNightStory(scene.state, story, yes, avgCheck);
  scene.state = res.state;
  scene.hud.update(scene.state, scene.timeLeft);
  effects.emote(scene, sprite, yes ? 'emo_heart' : 'emo_angry');
  if (yes) scene.popup(sprite.x, sprite.y - 18, t('nightStory.thanks'), '#c8ffb0');
  if (res.money) {
    sound.coin(sprite.x);
    scene.stats.revenue += res.money;
    scene.stats.nightRevenue = (scene.stats.nightRevenue ?? 0) + res.money;
    scene.time.delayedCall(500, () => scene.popup(sprite.x, sprite.y - 26, `+${res.money} 💰`, '#c8ffb0'));
  }
  if (res.rating > 0) scene.time.delayedCall(900, () => scene.popup(sprite.x, sprite.y - 34, `★ +${res.rating}`, '#fee761'));
  await scene.wait(1100);
  // Музыкант остаётся играть у входа до конца смены — ночных гостей больше.
  if (yes && story === 'busker') {
    scene.busker = true;
    await persons.walkVia(scene, sprite, [
      { x: door.x, y: door.y - 10 },
      { x: door.x - 24, y: scene.streetY - 2 },
    ]);
    scene.people.delete(sprite);
    scene.trickObjs.push(sprite);
    scene.trickTimers.push(scene.time.addEvent({ delay: 1800, loop: true, callback: () => sprite.active && scene.popup(sprite.x, sprite.y - 20, t('popup.busker'), '#fee761') }));
    return;
  }
  await persons.walk(scene, sprite, door.x, door.y - 10);
  await visitors.strollAway(scene, sprite);
}

export function finishDay(scene: StoreScene): void {
  scene.moments.stop();
  scene.dayOpen = false;
  // Захват не успел закончиться (день досрочно закрыт) — персонал возвращается к работе.
  if (scene.siege) {
    scene.siege = false;
    staff.syncStaff(scene);
  }
  scene.running = false;
  motion.straightenPeople(scene);
  bigDays.clearBigDay(scene);
  scene.night = false;
  scene.setSpeed(1);
  scene.stallTimer?.remove();
  scene.stallTimer = undefined;
  // Заказы на дом, которые не успели отвезти, курьер развозит после закрытия.
  const delivery = deliveries.closeDelivery(scene);
  // Что повар не успел снять с плиты к закрытию, — в витрину: ночью спишется вместе с остальным (в отчёт).
  food.flushCooking(scene);
  // Хлеб, оставшийся в печи к закрытию, продавец вынимает сам.
  if (scene.oven && scene.oven.state !== 'idle') {
    const product = scene.oven.product;
    const forShops = scene.oven.forShops;
    food.resetOven(scene);
    if (forShops) scene.state = sellWholesale(scene.state).state;
    else scene.state = (product === 'bread' ? takeOutBread(scene.state) : takeOutBread(scene.state, BRAND_BATCH, product)).state;
  }
  // Особый день вечером: свадебный заказ забирают, после съёмок — реклама на завтра.
  const wedding = scene.wedding ? fulfillWedding(scene.state, scene.wedding) : null;
  if (wedding) scene.state = wedding.state;
  scene.wedding = null;
  const filmed = bigDayFor(scene.state.day) === 'filming';
  if (filmed) scene.state = filmingReward(scene.state);
  // Пол за день: шаги покупателей — в потёртость (видна с утра, швабра и уборщик её стирают).
  staff.settleFloorWear(scene);
  // Сосед утром не дождался товара (returns.ts) — заходит к закрытию: есть — забирает, нет — без обид.
  const neighbour = scene.state.ret?.order?.day === scene.state.day ? collectOrder(scene.state) : null;
  if (neighbour) scene.state = neighbour.paid ? neighbour.state : dropOrder(neighbour.state);
  if (neighbour) track(neighbour.paid ? 'ret_order_eve' : 'ret_order_miss', scene.state.day, neighbour.paid);
  const finishedDay = scene.state.day;
  // Сколько гостей сверх обычного привела реклама — строкой в итогах дня.
  scene.stats.adGuests = adGuests(scene.state, scene.stats.served + scene.stats.lost);
  const ratingBefore = scene.state.rating;
  const rankBefore = rankOf(scene.state.totalRevenue);
  // Первый день новичка (firstday.ts): итоги праздничные, рейтинг не падает, бабушка вечером уезжает на дачу.
  const firstDay = gentleDay(scene.state);
  const grannyHome = grannyStays(scene.state);
  if (grannyHome) newcomer.onbStep(scene, 'bye');
  const night = nightCycle(scene.state, scene.stats);
  const { spoiled, bill, shortfall, skimmed, order, quests, weekly, branch } = night;
  const state = firstDay ? { ...night.state, rating: firstDayRating(scene.state, ratingBefore, night.state.rating) } : night.state;
  const cafe = scene.cafeToday;
  scene.cafeToday = null;
  const extra: [string, string][] = [];
  // Новое звание и побитые рекорды — печатями в итогах, а не строкой в «Подробнее».
  const stamps: SummaryStamp[] = [];
  const big = bigDayFor(finishedDay);
  if (big) extra.push([t('bigday.summary'), `${BIG_DAYS[big].icon} ${t(`bigday.${big}.title` as TextKey)}`]);
  if (wedding) extra.push([t('summary.wedding'), t(wedding.complete ? 'summary.weddingFull' : 'summary.weddingPart', { n: wedding.earned })]);
  if (filmed) extra.push(['🎬', t('summary.filming')]);
  if (quests.total) extra.push([t('summary.quests'), t('summary.questsValue', { done: quests.done, total: quests.total, n: quests.earned })]);
  if (scene.stats.momentsShown) extra.push([t('summary.moments'), t('summary.momentsValue', { n: scene.stats.moments ?? 0, total: scene.stats.momentsShown })]);
  if (weekly.completed.length) extra.push([t('summary.weekly'), t('summary.weeklyDone', { n: weekly.completed.length, money: weekly.earned })]);
  // Филиал за дорогой (branch.ts): чистый доход за день одной строкой.
  if (branch) extra.push([t('branch.summary'), t('branch.summaryValue', { n: branch })]);
  const rankAfter = rankOf(state.totalRevenue);
  if (rankAfter > rankBefore) stamps.push({ kind: 'rank', name: rankName(rankAfter, t) });
  if (order) extra.push([t('summary.order'), order.delivered ? t('summary.orderDone', { n: order.earned }) : t('summary.orderFailed')]);
  if (neighbour) {
    const name = t(regularById(neighbour.order.who).nameKey);
    extra.push([t('ret.order.summary'), neighbour.paid ? t('ret.order.summaryDone', { name, pay: neighbour.paid }) : t('ret.order.summaryMissed', { name })]);
  }
  if (delivery) extra.push(delivery);
  if (cafe) {
    const end = cafe.ended === 'done' ? ` · ${t('summary.cafeDone')}` : cafe.ended === 'canceled' ? ` · ${t('summary.cafeCanceled')}` : '';
    extra.push([t('summary.cafe'), `${cafe.delivered ? t('summary.cafePaid', { n: cafe.pay }) : t('summary.cafeMissed')}${end}`]);
  }
  // Кухня: сколько порций продали, на сколько закупила продуктов и сколько списали ночью (строка отчёта дня; кому не хватило — утром у кухни).
  const kitchenDay = kitchenOpen(state) ? state.reports?.at(-1)?.kitchen : undefined;
  if (kitchenDay && (kitchenDay.wanted || kitchenDay.spoiled || kitchenDay.spent)) {
    const parts = [t('summary.kitchenSold', { n: kitchenDay.sold })];
    if (kitchenDay.spent) parts.push(t('summary.kitchenSpent', { n: kitchenDay.spent }));
    if (kitchenDay.spoiled) parts.push(t('summary.kitchenSpoiled', { n: kitchenDay.spoiled }));
    extra.push([t('summary.kitchen'), parts.join(' · ')]);
  }
  if (scene.inspection) {
    const r = scene.inspection;
    extra.push([
      t('summary.inspection'),
      r.passed ? t('summary.inspectionPassed') : t('summary.inspectionFailed', { n: r.fine, problems: r.problems.map((p) => t(p)).join(', ') }),
    ]);
  }
  const promoted = state.staff !== scene.state.staff;
  // Вечером посетители пишут отзывы: они висят на доске у входа и видны в итогах дня.
  const reviews = reviewsFor(scene.stats, finishedDay);
  const best = updateRecords({ ...recordDay(state, scene.stats), reviews }, scene.stats, finishedDay);
  scene.state = best.state;
  // Повод вернуться (returns.ts): сосед просит отложить на завтра, письмо придёт на следующий настоящий день.
  scene.state = planLetter(planOrder(scene.state, Math.random), todayLocal(), Math.random);
  for (const id of best.broken) stamps.push({ kind: 'record', id });
  scene.stats.spoiled = spoiled;
  scene.stats.skimmed = skimmed;
  // Непроданное с кухни списано — тарелки из витрины убираем.
  food.refreshKitchen(scene);
  if (promoted) staff.syncStaff(scene);
  const unlocked = scene.checkAchievements(false);
  if (unlocked.length) extra.push([t('ach.summary'), unlocked.map((id) => t(`ach.${id}` as TextKey)).join(', ')]);
  // Новичок доиграл первый день: сколько секунд прошло от «Играть».
  if (finishedDay === 1) newcomer.onbStep(scene, 'day1', 1);
  // «Приходи завтра»: сцена Сони готова, но сегодня их уже было довольно — намёк в итогах дня.
  const teaser = dramaHeld(scene.state, todayLocal()) ? t('drama.teaser') : undefined;
  if (teaser) track('drama_held', finishedDay);
  scene.say.hide();
  scene.tillRing?.destroy();
  scene.tillRing = undefined;
  // Шаги зала, до которых за день не дошло, закрываются вместе с ним; дальше — итог дня.
  scene.state = tutDayEnd(scene.state);
  // Бабушкин подарок за первый день (ваза на прилавок): карточка — после итогов, в зале — с утра.
  const gifted = firstDayGift(scene.state);
  if (gifted) {
    scene.state = gifted;
    scene.giftRebuild = true;
    track('onb_gift', 1, scene.sincePlay());
  }
  newcomer.hallCoachOff(scene);
  saveGame(scene.state);
  track('day_end', finishedDay, scene.stats.revenue);
  // Вовлечённость: сколько моментов дня поймали из показанных и сколько заданий дня выполнили.
  if (scene.stats.momentsShown) {
    track('moments_seen', finishedDay, scene.stats.momentsShown);
    track('moments', finishedDay, scene.stats.moments ?? 0);
  }
  if (quests.total) track('quests', finishedDay, quests.done);
  // Сколько процентов своих покупателей хозяин пробил касанием улицы, а не кассы.
  if (scene.serves.owner) track('serve_street', finishedDay, (100 * Math.min(scene.serves.street, scene.serves.owner)) / scene.serves.owner);
  // Друзья на работе раз в неделю получают свою долю — монеты в своей игре (через «угощение»).
  if (finishedDay % 7 === 0) for (const m of friendsAtWork(state)) void treatFriend(m.friend!.id);
  const fps = fpsSummary(scene.fpsSamples);
  if (fps) {
    track('fps', finishedDay, fps.median);
    track('fps_low', finishedDay, fps.low);
    // Уровень графики рядом с FPS: 0 — лёгкая, 1 — обычная, 2 — высокая.
    track('gfx', finishedDay, ['lite', 'normal', 'high'].indexOf(scene.gfx));
  }
  scene.fpsSamples = [];
  scene.fpsSince = 0;
  if (scene.state.bankrupt) track('bankrupt', finishedDay);
  void reportProgress(scene.state);
  scene.refreshShelves();
  scene.refreshWarehouse();
  scene.hud.update(scene.state, 0);
  // Снимок зала до роллет — для карточки итогов (shareCard.ts).
  scene.dayShot = null;
  scene.game.renderer.snapshot((image) => {
    scene.dayShot = image instanceof HTMLImageElement ? image : null;
  });
  rivals.clearTrick(scene);
  // Магазин закрывается: опускаются роллеты, потом — итоги дня.
  closeShop(scene);
  scene.time.delayedCall(1500, () => {
    // Первый день кончился раньше, чем бабушка попрощалась (не продали или продали под самое
    // закрытие): она уходит домой, пока на экране итоги, — во второй день в зале её нет.
    if (grannyHome || !onbDone(scene.state, 'bye')) scene.granny?.destroy();
    // Итоги дня — своя заставка, а с новым званием — фанфара звания (две подряд звучали бы кашей).
    if (!music.sting(stamps.some((s) => s.kind === 'rank') ? 'rank_up' : 'day_close')) sound.fanfare();
    scene.hud.showSummary(
      finishedDay,
      scene.stats,
      { before: ratingBefore, after: state.rating },
      { bill: bill && billTotal(bill), shortfall, total: state.money, housewarming: Boolean(bill?.housewarming) },
      extra,
      stamps,
      scene.state.history,
      lossAdvice(scene.stats, scene.state),
      reviews,
      () => {
        // Итог дня прочитан — шаг обучения о нём пройден.
        if (tutStep(scene.state) === 'summary') {
          scene.coach.hide();
          scene.coach.skipButton(false);
          scene.state = tutPass(scene.state, 'summary');
          saveGame(scene.state);
        }
        // Первая сессия кончается на подъёме: бабушкин подарок карточкой, потом — ночь.
        if (gifted) firstGiftCard(() => nightPass(scene, () => morningFlow.showMorning(scene)));
        else nightPass(scene, () => morningFlow.showMorning(scene));
      },
      (button) => void shareDay(scene, button, finishedDay),
      teaser,
      scene.state.bankrupt ? undefined : tomorrowLines(scene),
      firstDay,
    );
    morningFlow.summaryLesson(scene, firstDay);
  });
}

/**
 * «Завтра:» в итогах дня: зацепка (nudge.ts), кто из соседей придёт за отложенным и что пришлёт
 * бабушка, если зайти завтра (серия гостинцев, gift.ts).
 */
export function tomorrowLines(scene: StoreScene): string[] {
  const lines = [teaserText(tomorrowTeaser(scene.state))];
  const order = orderTeaser(scene.state);
  if (order) lines.push(teaserText(order));
  const gift = giftTomorrow(scene.state, todayLocal());
  if (gift) {
    const treat = t(`gift.treat.${gift.day}` as TextKey);
    const more = (gift.goods ? t('streak.goods') : '') + (gift.rating ? t('streak.star') : '');
    lines.push(gift.day === 1 ? t('streak.restart', { treat, sum: gift.money }) : t('streak.tomorrow', { n: gift.day, treat, sum: gift.money, more }));
  }
  return lines;
}

/** Кнопку «Позвать на помощь» можно показать: игра в Telegram с сервером, после обучения, сегодня ещё не звали. */
export function canCallForHelp(scene: StoreScene): boolean {
  return scene.state.day > TUTORIAL_DAYS && !helpAsked(scene.state) && socialInfo() !== null;
}

/**
 * «Позвать на помощь»: окно «Поделиться» Telegram с карточкой «Помогите!». Отправил (или открылось
 * старое окно со ссылкой) — сегодня больше не зовём; закрыл окно — кнопка остаётся.
 */
export async function callForHelp(scene: StoreScene): Promise<void> {
  if (scene.helpBusy || !canCallForHelp(scene)) return;
  scene.helpBusy = true;
  haptic.tap();
  // Окно «Поделиться» может висеть, пока день не сменится: просьба — от того дня, когда позвали.
  const day = scene.state.day;
  const result = await askForHelp(t('help.share'));
  scene.helpBusy = false;
  if (result === 'cancelled' || result === 'failed') return;
  scene.state = markHelpAsked(scene.state, day);
  track('help_ask', day);
  const { sellerHome } = scene.layout;
  if (scene.running) scene.popup(sellerHome.x - 20, sellerHome.y - 46, t('popup.helpAsked'), '#a8f0c8');
}

/** Игру открыли по ссылке «Помоги!» друга: подмога уходит сама, за помощь — монеты. */
export async function sendFriendHelp(scene: StoreScene): Promise<void> {
  const res = await sendHelp();
  if (!res) return;
  if (!res.ok) {
    // Своя просьба или сервер недоступен — молчим; остальное объясняем, почему подмога не ушла.
    if (res.error === 'expired' || res.error === 'already' || res.error === 'limit' || res.error === 'full')
      toast('assets/ico_handshake.png', t('help.err.title'), t(`help.err.${res.error}` as TextKey));
    return;
  }
  scene.state = helpGiven(scene.state);
  saveGame(scene.state);
  scene.hud.update(scene.state, scene.timeLeft);
  track('help_sent', scene.state.day);
  toast('assets/ico_handshake.png', t('help.sent.title'), t('help.sent.text', { name: res.name || t('help.friend'), n: HELP_REWARD }));
}

/** Друзья откликнулись на «Помоги!»: монеты за каждого и быстрая касса на день, который сейчас начнётся. */
export async function takeFriendHelp(scene: StoreScene): Promise<void> {
  const names = await claimHelp();
  if (!names.length) return;
  scene.state = takeHelp(scene.state, names.length);
  saveGame(scene.state);
  scene.hud.update(scene.state, scene.timeLeft);
  track('help_came', scene.state.day, names.length);
  const shown = names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3}` : '');
  toast('assets/ico_handshake.png', t('help.came.title'), t('help.came.text', { names: shown, sum: names.length * HELP_THANKS }));
}

/** «Поделиться итогами»: карточка в историю Telegram, в окно «Поделиться» или в чат с ботом. */
export async function shareDay(scene: StoreScene, button: HTMLButtonElement, day: number): Promise<void> {
  if (button.disabled) return;
  button.disabled = true;
  const label = button.textContent;
  button.textContent = t('share.wait');
  const history = scene.state.history;
  const result = await shareDayCard(
    {
      day,
      shop: scene.shopTitle(),
      revenue: scene.stats.revenue,
      week: history.slice(-7).reduce((sum, n) => sum + n, 0),
      served: scene.stats.served,
      rating: scene.state.rating,
    },
    scene.dayShot,
  );
  button.textContent = label;
  button.disabled = false;
  track('share', day, result === 'failed' || result === 'cancelled' ? 0 : 1);
  if (result === 'chat') toast('assets/ico_phone.png', t('share.chat.title'), t('share.chat.text'));
  if (result === 'failed') toast('assets/ico_phone.png', '📸', t('share.failed'));
}

/**
 * Вывеска растёт с магазином: с третьего уровня по краю бегут огоньки, у супермаркета под
 * буквами переливается светодиодная лента.
 */
export function signLights(scene: StoreScene, x: number, y: number, half = 30): void {
  const level = scene.state.level;
  if (level < 2) return;
  const bulbs: Phaser.GameObjects.Rectangle[] = [];
  // Вывеска гипермаркета выше и шире: лампочки — по её краю.
  const dy = half > 30 ? 7.5 : 6.5;
  for (let i = 0; i <= (half * 2) / 4; i++) {
    bulbs.push(scene.add.rectangle(x - half + i * 4, y - dy, 1.4, 1.4, 0xfee761).setDepth(4));
    bulbs.push(scene.add.rectangle(x + half - i * 4, y + dy, 1.4, 1.4, 0xfee761).setDepth(4));
  }
  let step = 0;
  scene.worldTimer(160, () => {
    step++;
    bulbs.forEach((b, i) => b.active && b.setFillStyle(Math.floor(i / 2) % 3 === step % 3 ? 0xfff6c8 : 0xb8860b));
  });
  if (level < 4) return;
  const led = scene.add.rectangle(x, y + dy + 2, half * 2, 1.6, 0x9cd8ff).setDepth(4);
  scene.tweens.addCounter({
    from: 0,
    to: 360,
    duration: 3000,
    repeat: -1,
    onUpdate: (tw) => led.active && led.setFillStyle(Phaser.Display.Color.HSVToRGB(((tw.getValue() ?? 0) % 360) / 360, 0.45, 1).color),
  });
  lighting.nightGlow(scene, scene.art(x, y + dy + 2.5, 'glow').setDisplaySize(half * 2.7, 12).setTint(0x9cd8ff), 0.5, undefined, { map: { scale: 1.3, gain: 1.2, haze: 0.4 } });
}

/**
 * Ночь между днями (пока игрок не нажал «Дальше» в итогах — не начинается): становится темно,
 * по небу проходит луна, в домах по одному гаснут окна, проезжает ночное такси, потом
 * розовый рассвет — и утро. Касание экрана пропускает.
 */
export function nightPass(scene: StoreScene, done: () => void): void {
  const cam = scene.cameras.main;
  const v = cam.worldView;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
    objs.push(o);
    return o;
  };
  const pad = 300;
  // Небо поверх мира и его карты освещения: умножение на цвет — ночью синее, на рассвете розовое. Окна,
  // лампочки и вывески светятся поверх неба (они выше), луна и звёзды — тоже.
  const sky = keep(scene.add.rectangle(v.x - pad, v.y - pad, v.width + 2 * pad, v.height + 2 * pad, 0xffffff).setOrigin(0));
  sky.setBlendMode(Phaser.BlendModes.MULTIPLY).setDepth(LIGHT_DEPTH + 0.5);
  const moonGlow = keep(scene.art(0, 0, 'glow').setScale(34 / 64).setTint(0xdfe8ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(LIGHT_DEPTH + 3));
  // Луна: светлый диск с парой «морей».
  const moon = keep(scene.add.container(0, 0, [scene.add.circle(0, 0, 5, 0xf6f0d6), scene.add.circle(-1.5, -1, 1.3, 0xd8cfae), scene.add.circle(1.8, 1.6, 1, 0xd8cfae)]));
  moon.setDepth(LIGHT_DEPTH + 4);
  const stars = Array.from({ length: 14 }, () =>
    keep(scene.add.rectangle(v.x + Math.random() * v.width, v.y + Math.random() * v.height * 0.4, 0.9, 0.9, 0xfff6c8).setDepth(LIGHT_DEPTH + 3).setAlpha(0)),
  );
  // Ночное такси с фарами.
  const roadY = scene.streetY + 24;
  const taxi = keep(scene.add.container(v.x - 60, roadY, [scene.art(0, 0, 'car_taxi').setTint(0xfee761), scene.art(0, 0, 'car_taxi_lights')]).setDepth(roadY));
  const beam = keep(scene.art(v.x - 30, roadY, 'glow').setScale(40 / 64, 14 / 64).setTint(0xfff3b0).setBlendMode(Phaser.BlendModes.ADD).setDepth(LIGHT_DEPTH + 3).setAlpha(0.8));
  const NIGHT = Phaser.Display.Color.ValueToColor(0x4a5aa0);
  const DAWN = Phaser.Display.Color.ValueToColor(0xffb8a8);
  const WHITE = Phaser.Display.Color.ValueToColor(0xffffff);
  const mix = (a: Phaser.Display.Color, b: Phaser.Display.Color, k: number) => {
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(a, b, 100, k * 100);
    return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
  };
  const DURATION = 3600;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    counter.remove();
    scene.input.off('pointerdown', finish);
    objs.forEach((o) => o.destroy());
    scene.lightsOut = 0;
    done();
  };
  scene.input.once('pointerdown', finish);
  const counter = scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: DURATION,
    onUpdate: (tw) => {
      const k = tw.getValue() ?? 0;
      // 0–0.2 темнеет, 0.2–0.7 ночь, 0.7–0.85 рассвет, 0.85–1 светлеет.
      const color =
        k < 0.2 ? mix(WHITE, NIGHT, k / 0.2) : k < 0.7 ? NIGHT.color : k < 0.85 ? mix(NIGHT, DAWN, (k - 0.7) / 0.15) : mix(DAWN, WHITE, (k - 0.85) / 0.15);
      sky.setFillStyle(color);
      const night = k < 0.7 ? Phaser.Math.Clamp(k / 0.2, 0, 1) : Phaser.Math.Clamp(1 - (k - 0.7) / 0.15, 0, 1);
      // Луна дугой слева направо по верху кадра.
      const m = Phaser.Math.Clamp((k - 0.05) / 0.75, 0, 1);
      moon.setPosition(v.x + v.width * (0.12 + 0.76 * m), v.y + v.height * (0.16 - 0.08 * Math.sin(m * Math.PI))).setAlpha(night);
      moonGlow.setPosition(moon.x, moon.y).setAlpha(0.7 * night);
      stars.forEach((st, i) => st.setAlpha(night * (0.5 + 0.5 * Math.sin(scene.time.now / 300 + i * 1.7))));
      // Окна гаснут посреди ночи; к рассвету фонари и вывески выключаются (вечер идёт назад).
      scene.lightsOut = Phaser.Math.Clamp((k - 0.2) / 0.4, 0, 1);
      scene.updateLighting(k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
      const tx = v.x - 60 + (v.width + 120) * Phaser.Math.Clamp((k - 0.25) / 0.4, 0, 1);
      taxi.x = tx;
      beam.setPosition(tx + 30, roadY).setAlpha(k > 0.25 && k < 0.65 ? 0.8 : 0);
    },
    onComplete: finish,
  });
}

/**
 * Небо днём: по кварталу медленно ползёт тень облака (в ясную погоду), иногда пролетает
 * стайка птиц. Вечером и ночью — нет.
 */
export function skyLife(scene: StoreScene): void {
  if (scene.lite || !scene.running || scene.night || scene.evening > 0.5) return;
  const v = scene.cameras.main.worldView;
  const sunny = scene.weather === 'clear' || scene.weather === 'heat' || scene.weather === 'leaves';
  if (sunny && Math.random() < 0.45) {
    const y = v.y + Math.random() * v.height;
    const cloud = scene.art(v.x - 120, y, 'glow').setScale(220 / 64, 120 / 64).setTint(0x1a1f3a).setAlpha(0.14).setDepth(LIGHT_DEPTH - 1);
    scene.tweens.add({ targets: cloud, x: v.right + 120, y: y + 30, duration: 26000, onComplete: () => cloud.destroy() });
  }
  if (Math.random() < 0.25) {
    const fromLeft = Math.random() < 0.5;
    const y0 = v.y + v.height * (0.2 + Math.random() * 0.5);
    const flock = scene.add.container(fromLeft ? v.x - 20 : v.right + 20, y0).setDepth(LIGHT_DEPTH - 0.5);
    const n = Phaser.Math.Between(3, 6);
    for (let i = 0; i < n; i++) {
      // Птица — галочка из двух крыльев; крылья машут вверх-вниз.
      const bird = scene.add.graphics({ x: -i * 6 * (fromLeft ? 1 : -1) + Math.random() * 3, y: (i % 2 ? 4 : -3) * Math.ceil(i / 2) });
      bird.lineStyle(0.8, 0x262b44, 1);
      bird.lineBetween(-2, -1, 0, 0.6).lineBetween(0, 0.6, 2, -1);
      scene.tweens.add({ targets: bird, scaleY: { from: 1, to: -0.6 }, duration: 160 + i * 13, yoyo: true, repeat: -1 });
      flock.add(bird);
    }
    scene.tweens.add({
      targets: flock,
      x: fromLeft ? v.right + 40 : v.x - 40,
      y: y0 - 40 + Math.random() * 30,
      duration: 7000,
      onComplete: () => flock.destroy(true),
    });
  }
}

/** Табличку на двери переворачивают: «Открыто» утром, «Закрыто» вечером. */
export function flipDoorSign(scene: StoreScene, open: boolean): void {
  const sign = scene.doorSign;
  const key = open ? 'door_sign_open' : 'door_sign_closed';
  if (!sign?.active || sign.texture.key === key) return;
  const sx = sign.scaleX;
  scene.tweens.add({
    targets: sign,
    scaleX: 0,
    duration: 160,
    yoyo: true,
    onYoyo: () => sign.setTexture(key),
    onComplete: () => sign.setScale(sx, sign.scaleY),
  });
  scene.tweens.add({ targets: sign, angle: { from: -12, to: 0 }, delay: 320, duration: 700, ease: 'Elastic.easeOut' });
}

/** Вечером на витрины, дверь и склад опускаются роллеты. */
export function closeShop(scene: StoreScene): void {
  flipDoorSign(scene, false);
  const { h, door, w, warehouse } = scene.layout;
  const spots = [{ x: door.x, w: 32 }, { x: warehouse.x + warehouse.w / 2, w: 24 }];
  for (let x = 18; x < w - 10; x += 24) {
    if (Math.abs(x - door.x) > 24) spots.push({ x, w: 20 });
  }
  for (const spot of spots) {
    const shutter = scene.art(spot.x, h + 0.5, 'shutter').setOrigin(0.5, 0).setDepth(h + 3);
    shutter.setDisplaySize(spot.w, 0.1);
    scene.tweens.add({ targets: shutter, displayHeight: FACADE_H - 1, duration: 900, ease: 'Bounce.easeOut', delay: Math.random() * 200 });
    scene.shutters.push(shutter);
  }
  nightGuard(scene);
}

/** Ночь: Бобик сидит настороже, к двери выходит сторож с фонариком. */
export function nightGuard(scene: StoreScene): void {
  scene.closed = true;
  pets.bobikSit(scene, 900);
  if (!hasWatchman(scene.state)) return;
  const { door } = scene.layout;
  const y = scene.bobik?.y ?? scene.layout.h + FACADE_H + 10;
  const watchman = persons.makePerson(scene, door.x + 18, y - 9, WATCHMAN).setDepth(y + 2);
  watchman.setAlpha(0);
  scene.tweens.add({ targets: watchman, alpha: 1, duration: 600 });
  const beam = scene.add.graphics({ x: door.x + 22, y: y - 6 }).setDepth(y + 1).setBlendMode(Phaser.BlendModes.ADD);
  beam.fillStyle(0xfff3b0, 0.22);
  beam.fillTriangle(0, 0, 22, 8, 16, 16);
  scene.tweens.add({ targets: beam, rotation: { from: -0.25, to: 0.35 }, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  // Луч фонарика в карте освещения: ходит по тротуару вместе с рукой сторожа — ступеньками по 1/8 радиана
  // (свет мягкий, шагов не видно), а не каждый кадр: карту всю ночь перерисовывали бы непрерывно.
  const torch = scene.light.add('light_cone', beam.x, beam.y, 16, 28, 0xfff3c8, 0.7).attach(beam);
  torch.originY = 0;
  torch.sync = () => (torch.rotation = Math.round(beam.rotation * 8) / 8 + Math.atan2(12, 19) - Math.PI / 2);
  scene.nightWatch.push(watchman, beam);
}

/** Утром роллеты поднимаются. */
export function openShop(scene: StoreScene): void {
  scene.closed = false;
  pets.bobikRest(scene);
  scene.nightWatch.forEach((o) => o.destroy());
  scene.nightWatch = [];
  for (const shutter of scene.shutters) {
    scene.tweens.add({ targets: shutter, displayHeight: 0.1, duration: 600, ease: 'Quad.easeIn', onComplete: () => shutter.destroy() });
  }
  scene.shutters = [];
}
