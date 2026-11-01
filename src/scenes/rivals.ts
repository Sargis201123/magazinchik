// В гостях и соперничество: магазин друга по снимку с сервера, визит к конкуренту (или к боссу через дорогу)
// с проделками в его зале, утренние вести о том, что натворили у нас (game/rival.ts), и ответный ход днём —
// промоутер конкурента уводит прохожих, перетяжки, подставной «проверяющий».

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { DAY_SECONDS, storeLevel } from '../game/economy';
import { pauseSaving, saveGame, savingPaused } from '../game/save';
import { friendState } from '../game/friendShop';
import { presentGiven, presentsOn, showGiftPicker } from '../ui/presents';
import {
  applyPranks,
  bonusGuests,
  bossLeft,
  bossShop,
  messToday,
  PRANK_COINS,
  takeRivalDay,
  usePrank,
  type PrankKind,
} from '../game/rival';
import { fetchRivalShop, rivalAct, rivalInbox, thankRival } from '../platform/rival';
import { rivalBar, showRivalNews } from '../ui/rival';
import { postMail } from '../ui/mailbag';
import { t } from '../i18n';
import { sound } from '../platform/sound';
import { button, el, toast, UI_FONT } from '../ui/dom';
import { track } from '../platform/analytics';
import { fetchFriendShop } from '../platform/multiplayer';
import { activeTrick } from '../game/tricks';
import { EDUARD_STAGES, eduardLook, eduardStage } from '../game/eduard';
import { SPILL_TINTS, SHIRTS, type Look, randomLook, customerLook, withCompanionItems } from './common';
import * as effects from './effects';
import * as staff from './staff';
import * as persons from './persons';
import * as visitors from './visitors';
import * as morningFlow from './morningFlow';
import * as shelves from './shelves';

/**
 * В гостях у друга: на экране его магазин по снимку с сервера (только смотреть). Свой магазин
 * не сохраняется, пока мы в гостях; «Домой» — вернуть свой и утро.
 */
export async function visitFriend(scene: StoreScene, id: number, name: string): Promise<void> {
  const res = await fetchFriendShop(id);
  const home = scene.state;
  const guest = res && friendState(res.shop, home);
  if (!guest) {
    toast('assets/ico_cross.png', t('visitShop.title'), t('visitShop.none', { name }));
    morningFlow.showMorning(scene);
    return;
  }
  pauseSaving(true);
  scene.state = guest;
  scene.buildWorld();
  track('visit_shop', home.day);
  const bar = el('div', 'ui-arrange');
  const shop = guest.shopName?.trim() || t(storeLevel(guest).nameKey);
  // Подарок другу (ui/presents.ts): один в день, кнопка гаснет, когда подарен.
  const gift = presentsOn()
    ? button(presentGiven(id) ? t('social.give.done') : t('social.give.btn'), () => {
        // Полоса внизу не перекрывает окно подарка.
        bar.style.visibility = 'hidden';
        showGiftPicker({ id, name: res!.name || name }, home.day, home.level, (ok) => {
          bar.style.visibility = '';
          if (!ok) return;
          gift!.textContent = t('social.give.done');
          gift!.disabled = true;
        });
      }, 'ui-btn secondary', presentGiven(id))
    : null;
  bar.append(
    el('div', 'ui-arrange-hint', t('visitShop.bar', { name: res!.name || name, shop, rating: guest.rating.toFixed(1), day: guest.day })),
    ...(gift ? [gift] : []),
    button(`🏠 ${t('visitShop.home')}`, () => {
      bar.remove();
      scene.state = home;
      pauseSaving(false);
      scene.buildWorld();
      morningFlow.showMorning(scene);
    }, 'ui-btn'),
  );
  document.body.append(bar);
}

/**
 * «Заглянуть к конкуренту» (game/rival.ts): чужой магазин по снимку с сервера (ключ из рейтинга)
 * или босс через дорогу (key — null, сервер не нужен). По залу бродят покупатели; внизу — проделки,
 * их число считает сервер (у босса — мы сами). Награда — в свой магазин; он не сохраняется, пока
 * мы в гостях, «Домой» — вернуть свой и утро.
 */
export async function visitRival(scene: StoreScene, key: string | null, name: string): Promise<void> {
  scene.inMorning = false;
  const res = key ? await fetchRivalShop(key) : null;
  // Свой магазин — после ответа сервера: пока ждали, в него могли прийти монеты или новости.
  let home = scene.state;
  const look = eduardLook(home);
  const stage = EDUARD_STAGES[eduardStage(home) ?? 0];
  const bossName = look === 'mega' ? t('eduard.mega') : t(stage.nameKey);
  const guest = key ? res && friendState(res.shop, home) : friendState(bossShop(home, bossName, stage.rating || 4.2), home);
  if (!guest) {
    toast('assets/ico_cross.png', t('visitShop.title'), t('rival.none', { name }));
    morningFlow.showMorning(scene);
    return;
  }
  pauseSaving(true);
  scene.rivalVisit = true;
  scene.state = guest;
  scene.buildWorld();
  track('visit_rival', home.day);
  const owner = key ? res!.name || name : bossName;
  const browsers: Phaser.GameObjects.Container[] = [];
  // Покупатели бродят от полки к полке; позванный к нам уходит на улицу.
  const wander = scene.time.addEvent({
    delay: 2400,
    loop: true,
    callback: () => {
      for (const b of browsers) {
        if (!b.active || b.getData('lured') || b.getData('walking') || Math.random() < 0.5) continue;
        const p = rivalSpot(scene);
        void persons.walk(scene, b, p.x, p.y, scene.customerSpeed() * 0.7);
      }
    },
  });
  for (let i = 0; i < (scene.lite ? 2 : 3); i++) {
    const p = rivalSpot(scene);
    const b = persons.makePerson(scene, p.x, p.y, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), guest.day));
    persons.setFacing(b, Math.random() < 0.5 ? 'left' : 'right');
    browsers.push(b);
  }
  let left = key ? res!.left : bossLeft(home);
  const prank = async (kind: PrankKind): Promise<void> => {
    bar.setBusy(true);
    const done = key ? await rivalAct(key, kind) : { ok: bossLeft(home) > 0, left: 0, error: 'limit' };
    bar.setBusy(false);
    // Пока ждали сервер, ушли домой — проделка засчитана: награда сразу в свой магазин.
    if (scene.state !== guest) {
      if (done.ok && !savingPaused()) {
        scene.state = usePrank(scene.state, kind, !key);
        saveGame(scene.state);
      }
      return;
    }
    const { sellerHome } = scene.layout;
    if (!done.ok) {
      if (done.error !== 'too_often' && done.error !== 'offline') bar.setLeft((left = 0));
      // Неизвестная ошибка (не лимит) — тоже без кнопок, но с понятной надписью.
      if (done.error === 'bad_kind') done.error = 'gone';
      scene.popup(sellerHome.x - 20, sellerHome.y - 40, t(`rival.err.${done.error === 'pair' || done.error === 'victim' || done.error === 'too_often' || done.error === 'offline' || done.error === 'gone' ? done.error : 'limit'}`), '#ffd0d0');
      sound.bad();
      return;
    }
    home = usePrank(home, kind, !key);
    left = key ? done.left : bossLeft(home);
    bar.setLeft(left);
    scene.hud.update({ ...guest, money: home.money }, DAY_SECONDS);
    rivalPrank(scene, kind, browsers);
    scene.time.delayedCall(900, () => {
      if (scene.state !== guest) return;
      scene.popup(sellerHome.x - 20, sellerHome.y - 52, t(kind === 'lure' ? 'rival.reward.guest' : 'rival.reward', { n: PRANK_COINS[kind] }), '#c8ffb0');
      sound.coin();
    });
  };
  const bar = rivalBar(t('rival.bar', { name: owner, rating: guest.rating.toFixed(1) }), left, (kind) => void prank(kind), () => {
    bar.remove();
    wander.remove();
    scene.rivalVisit = false;
    scene.state = home;
    pauseSaving(false);
    saveGame(scene.state);
    scene.buildWorld();
    morningFlow.showMorning(scene);
  });
}

/** Место в чужом зале, куда встать: перед случайной полкой, чуть вразброс. */
export function rivalSpot(scene: StoreScene): { x: number; y: number } {
  const n = scene.state.shelves.length;
  const p = n ? shelves.standOf(scene, Phaser.Math.Between(0, n - 1)) : { x: scene.layout.door.x, y: scene.layout.door.y - 20 };
  return { x: p.x + Phaser.Math.Between(-6, 6), y: p.y + Phaser.Math.Between(0, 4) };
}

/** Проделка в чужом зале: лужа или мусор на полу (хозяин удивляется), а позванный покупатель уходит к нам. */
export function rivalPrank(scene: StoreScene, kind: PrankKind, browsers: Phaser.GameObjects.Container[]): void {
  if (kind === 'lure') {
    const b = browsers.find((p) => p.active && !p.getData('lured'));
    if (!b) return;
    b.setData('lured', true);
    persons.haltWalk(b);
    scene.popup(b.x, b.y - 22, t('rival.say.lure'), '#fff3b0');
    scene.time.delayedCall(1100, () => {
      if (!b.active) return;
      effects.emote(scene, b, 'emo_heart');
      scene.popup(b.x, b.y - 34, t('rival.say.yes'), '#c8ffb0');
      void visitors.strollAway(scene, b);
    });
    return;
  }
  const p = rivalSpot(scene);
  const piece = staff.dropTrash(scene, p.x, p.y, kind);
  if (piece) {
    // Убирать чужое не наше дело: лужа и мусор только для вида.
    piece.removeAllListeners('pointerup').disableInteractive();
    if (kind === 'spill') {
      piece.setTint(Phaser.Utils.Array.GetRandom(SPILL_TINTS));
      const pack = scene.art(piece.x + 9, piece.y - 3, 'spill_pack').setAngle(70).setDepth(0.6);
      piece.once('destroy', () => pack.destroy());
    }
  }
  if (kind === 'spill') sound.bad();
  else sound.pop();
  scene.popup(p.x, p.y - 16, t(kind === 'spill' ? 'rival.popup.spill' : 'rival.popup.trash'), '#ffd0d0');
  // Хозяин чужого магазина замечает.
  if (scene.seller?.active) {
    effects.emote(scene, scene.seller, 'emo_question');
    scene.popup(scene.seller.x, scene.seller.y - 30, t('rival.say.owner'), '#ffffff');
  }
}

/**
 * Утром — что натворили у нас конкуренты и кто поблагодарил за наш визит (не чаще раза в 10 минут:
 * сервер отдаёт это один раз). Пришло, пока мы в гостях, — покажем, когда вернёмся.
 */
export async function checkRivals(scene: StoreScene): Promise<void> {
  // Вернулись из гостей — показать то, что пришло, пока гуляли.
  if (scene.rivalPending) return void (scene.inMorning && !savingPaused() && applyRivalInbox(scene));
  const now = Date.now();
  if (now - scene.rivalCheckedAt < 10 * 60_000) return;
  scene.rivalCheckedAt = now;
  const inbox = await rivalInbox();
  if (!inbox || (!inbox.pranks.length && !inbox.thanks.length)) return;
  scene.rivalPending = inbox;
  // Последствия — только к утру этого дня: иначе подождут следующего утра.
  if (scene.inMorning && !scene.rivalVisit && !savingPaused()) applyRivalInbox(scene);
}

export function applyRivalInbox(scene: StoreScene): void {
  const inbox = scene.rivalPending;
  if (!inbox) return;
  scene.rivalPending = null;
  // «Спасибо за визит» — только тёплая строчка, без монет (подарки друзьям — presents.ts, решено 01.11).
  // Утром, пока открыто утреннее окно, — строкой «Почты» (ui/mail.ts), без окон поверх.
  const mail = scene.inMorning && !scene.dayOpen;
  if (inbox.thanks.length) {
    const names = inbox.thanks.slice(0, 3);
    if (mail) postMail(scene.state.day, { thanks: { names, n: 0 } });
    else toast('assets/ico_coffee.png', t('rival.thanks.title'), t('rival.thanks', { names: names.join(', ') }));
  }
  // Магазин уже открыт — беспорядок подождёт завтрашнего утра.
  const { state, news } = applyPranks(scene.state, inbox.pranks, scene.dayOpen ? scene.state.day + 1 : scene.state.day);
  scene.state = state;
  saveGame(scene.state);
  scene.hud.update(scene.state, DAY_SECONDS);
  if (!news) return;
  track('rival_news', scene.state.day, inbox.pranks.length);
  if (mail) {
    // Прочитать — то же окно, что и раньше; ответный визит — только пока магазин не открыт.
    postMail(scene.state.day, {
      rival: {
        news,
        read: () =>
          showRivalNews(
            news,
            scene.inMorning && !scene.dayOpen
              ? (key, name) => {
                  for (const m of document.querySelectorAll('.ui-modal')) m.remove();
                  void visitRival(scene, key, name);
                }
              : null,
            thankRival,
          ),
      },
    });
    return;
  }
  // Окно — когда закроются другие (гостинец бабушки, сюжет): поверх утра, но не поверх них.
  const show = scene.time.addEvent({
    delay: 500,
    loop: true,
    callback: () => {
      if (document.querySelector('.ui-dialog') || document.querySelectorAll('.ui-modal').length > 1 || scene.rivalVisit || savingPaused()) return;
      show.remove();
      // Ответный визит — только с утра: утреннее окно закрываем.
      const morning = scene.inMorning && !scene.dayOpen;
      showRivalNews(
        news,
        morning
          ? (key, name) => {
              for (const m of document.querySelectorAll('.ui-modal')) m.remove();
              void visitRival(scene, key, name);
            }
          : null,
        thankRival,
      );
    },
  });
}

/** Открытие: беспорядок от конкурентов — в зал, увели гостей — столько не придёт, позванные нами — придут. */
export function openRivalDay(scene: StoreScene): void {
  const mess = messToday(scene.state);
  const guests = bonusGuests(scene.state);
  scene.rivalLost = mess?.lost ?? 0;
  scene.state = takeRivalDay(scene.state);
  const { door } = scene.layout;
  if (mess && mess.spill + mess.trash) {
    for (let i = 0; i < mess.spill + mess.trash; i++) {
      const p = rivalSpot(scene);
      const piece = staff.dropTrash(scene, p.x, p.y, i < mess.spill ? 'spill' : 'trash');
      if (piece && i < mess.spill) piece.setTint(Phaser.Utils.Array.GetRandom(SPILL_TINTS));
    }
    scene.time.delayedCall(2600, () => scene.running && scene.popup(door.x, door.y - 30, t('rival.mess'), '#ffd0d0'));
  }
  for (let i = 0; i < guests; i++) {
    scene.time.delayedCall(6000 + i * 7000, () => {
      if (!scene.running || scene.night || scene.timeLeft <= 0) return;
      scene.spawnCustomer();
      scene.popup(door.x, door.y - 24, t('rival.guest'), '#c8ffb0');
    });
  }
}

// ---------- Козни конкурента (tricks.ts) ----------

export function clearTrick(scene: StoreScene): void {
  scene.busker = false;
  scene.trickTimers.forEach((e) => e.remove());
  scene.trickTimers = [];
  scene.trickObjs.forEach((o) => o.destroy());
  scene.trickObjs = [];
}

/** Утром выбрали ответ — днём это видно на улице: промоутеры, перетяжки, «проверяющий». */
export function setupTrick(scene: StoreScene): void {
  clearTrick(scene);
  const trick = activeTrick(scene.state);
  if (!trick) return;
  const { door } = scene.layout;
  const sidewalk = scene.streetY - 2;
  const every = (ms: number, fn: () => void) => scene.trickTimers.push(scene.time.addEvent({ delay: ms, loop: true, callback: fn }));
  if (trick.kind === 'promoter') {
    const ours = trick.answer === 'counter';
    if (!ours && trick.stopped) return;
    const look: Look = ours
      ? { ...randomLook(0x63c74d), acc: 'apron', accTint: 0xffffff, prop: 'balloon', propTint: 0x63c74d }
      : { ...randomLook(0xe43b44), acc: 'vest', accTint: 0xfee761, hat: 'papercap', hatTint: 0xe43b44, prop: 'balloon', propTint: 0xe43b44 };
    const promoter = persons.makePerson(scene, door.x + 24, sidewalk, look);
    scene.people.delete(promoter);
    scene.trickObjs.push(promoter);
    every(5200, () => scene.running && scene.popup(promoter.x, promoter.y - 22, t(ours ? 'popup.ownPromoter' : 'popup.rivalPromoter'), ours ? '#c8ffb0' : '#ffd0d0'));
    // Чужой промоутер уводит прохожих через дорогу — видно, куда уходят гости.
    if (!ours) every(6500, () => scene.running && void lureAway(scene, promoter));
    return;
  }
  if (trick.kind === 'banner') {
    const ours = trick.answer === 'counter';
    const top = scene.next.h + 4;
    // Чужая — над тротуаром за дорогой, своя — над нашим тротуаром.
    const y = ours ? scene.streetY - 18 : top + 66;
    const color = ours ? 0x3e8948 : 0xe43b44;
    // Поверх вывески конкурента — её видно с нашей стороны улицы.
    const depth = top + 200;
    for (const dx of [-62, 62]) scene.trickObjs.push(scene.add.rectangle(door.x + dx, y + 6, 2, 20, 0x3a4466).setDepth(depth));
    scene.trickObjs.push(scene.add.rectangle(door.x, y, 128, 11, color).setStrokeStyle(1, 0xffffff).setDepth(depth + 1));
    scene.trickObjs.push(
      scene.add
        .text(door.x, y, t(ours ? 'trick.banner.own' : 'trick.banner.sign'), { fontFamily: UI_FONT, fontSize: '7px', color: '#ffffff', fontStyle: 'bold' })
        .setOrigin(0.5)
        .setResolution(scene.textRes(4))
        .setDepth(depth + 2),
    );
    return;
  }
  // «Проверяющий» заходит, когда прошла треть дня.
  if (trick.kind === 'inspector' && trick.day === scene.state.day) {
    scene.trickTimers.push(scene.time.delayedCall((DAY_SECONDS * 1000) / 3, () => scene.running && void fakeInspector(scene)));
  }
}

/** Прохожий идёт к промоутеру конкурента и уходит через дорогу к нему в магазин. */
export async function lureAway(scene: StoreScene, promoter: Phaser.GameObjects.Container): Promise<void> {
  const start = visitors.streetSpawn(scene);
  const person = persons.makePerson(scene, start.x, start.y, withCompanionItems(customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), scene.state.day)));
  scene.people.delete(person);
  scene.trickObjs.push(person);
  await persons.walk(scene, person, promoter.x + 8, promoter.y + 2);
  if (!person.active) return;
  effects.emote(scene, person, 'emo_question');
  await scene.wait(600);
  await persons.walk(scene, person, scene.layout.door.x + Phaser.Math.Between(-30, 30), scene.streetY + 74);
  if (person.active) scene.tweens.add({ targets: person, alpha: 0, duration: 400, onComplete: () => person.destroy() });
}

/** Подставной «проверяющий»: проходит по залу с портфелем, цокает и уходит. */
export async function fakeInspector(scene: StoreScene): Promise<void> {
  const { door } = scene.layout;
  const look: Look = { ...randomLook(0x262b44), outfit: 'suit', outfitTint: 0x3a4466, prop: 'briefcase', glasses: true, face: 'mustache' };
  const start = visitors.streetSpawn(scene);
  const man = persons.makePerson(scene, start.x, start.y, look);
  scene.people.delete(man);
  scene.trickObjs.push(man);
  await persons.walkVia(scene, man, [
    { x: door.x, y: scene.streetY },
    { x: door.x, y: door.y - 10 },
  ]);
  for (let i = 0; i < 3 && man.active; i++) {
    const index = Phaser.Math.Between(0, Math.max(0, scene.state.shelves.length - 1));
    const stand = shelves.standOf(scene, index);
    await persons.walk(scene, man, stand.x, stand.y);
    if (!man.active) return;
    scene.popup(man.x, man.y - 20, t('popup.fakeInspector'), '#fff3b0');
    await scene.wait(900);
  }
  if (!man.active) return;
  await persons.walk(scene, man, door.x, scene.layout.h + 16);
  void visitors.strollAway(scene, man);
}
