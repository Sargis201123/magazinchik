// Особые дни (game/bigday.ts): новость утром и день на улице — жара, мороз, наводнение, подземный толчок
// (дрожит магазин, а не экран: волна по полкам, разбитый товар, пыль с потолка, качаются лампы), шествие,
// автобус туристов, съёмки, звездопад; ограбление с заложниками и полицией. Обычные события дня — liveFx.ts.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { DAY_SECONDS, PRODUCT_IDS, type StoreState } from '../game/economy';
import { RARE_GUESTS } from '../game/endless';
import { t, type TextKey } from '../i18n';
import { sound } from '../platform/sound';
import { music } from '../platform/music';
import { haptic } from '../platform/telegram';
import { el, openModal } from '../ui/dom';
import {
  BIG_DAYS,
  BLACKOUT_UNTIL,
  ROBBERY_AT,
  ROBBERY_RATING,
  ROBBERY_RELEASE,
  ROBBERY_STORM,
  bigDayFor,
  bigDayProgress,
  blackoutWarm,
  quakeBreak,
  TOURISTS,
  weddingOrder,
  weddingText,
  type BigDayId,
} from '../game/bigday';
import { dialogBox } from '../ui/dialog';
import { wearOf } from './archetypes';
import { slotSide } from './placement';
import {
  ART,
  STREET_VIEW,
  FACADE_H,
  LIGHT_DEPTH,
  QUAKE_WAVE_MS,
  QUAKE_SETTLE_MS,
  QUAKE_SHATTER_MAX,
  QUAKE_DUST,
  QUAKE_GRIT,
  RUN_PACE,
  WHITE_SHIRT,
  SHIRTS,
  type Look,
  randomLook,
  HAT_COLORS,
  customerLook,
  SKINS,
  discard,
  type ShelfView,
  type QuakeFall,
} from './common';
import * as motion from './motion';
import * as staff from './staff';
import * as persons from './persons';
import * as visitors from './visitors';

/** Особый день: второй и дальше день — сразу, первый — сначала новость (день стоит, пока её читают). */
export function startBigDayIfAny(scene: StoreScene): void {
  clearBigDay(scene);
  const big = bigDayFor(scene.state.day);
  const progress = bigDayProgress(scene.state.day);
  if (big && progress && progress.n > 1) {
    // Второй и дальше день многодневного события: о нём уже знают — без новостей.
    startBigDay(scene, big);
    const name = t(`bigday.${big}.title` as TextKey);
    scene.time.delayedCall(600, () =>
      scene.popup(scene.layout.w / 2, scene.layout.h / 2, t('bigday.dayOf', { icon: BIG_DAYS[big].icon, title: name, n: progress.n, of: progress.of }), '#fee761'),
    );
  } else if (big) announceBigDay(scene, big);
}

/**
 * Особый день: о нём узнают только сейчас, по новостям. Пока ведущая говорит, день стоит.
 * Потом на улице начинается своё: жара, мороз, вода, толчки или шествие.
 */
export function announceBigDay(scene: StoreScene, id: BigDayId): void {
  const big = BIG_DAYS[id];
  scene.running = false;
  scene.time.paused = true;
  sound.news();
  haptic.tap();
  if (id === 'wedding') scene.wedding = weddingOrder(scene.state);
  const params = { n: BIG_DAYS[id].days ?? TOURISTS, order: scene.wedding ? weddingText(scene.wedding) : '' };
  const { card, close } = openModal();
  // Заголовок одним куском: у h2 в окне flex по краям, иконка не должна уезжать влево.
  const title = el('h2');
  title.append(el('span', '', `${big.icon} ${t(`bigday.${id}.title` as TextKey)}`));
  card.append(
    title,
    dialogBox({
      caption: t('bigday.caption'),
      art: `assets/news_${id}.png`,
      portrait: big.crowd ? 'portrait_anchor_happy' : 'portrait_anchor_surprised',
      name: t('bigday.anchor'),
      text: t(`bigday.${id}.news` as TextKey, params),
      pitch: 520,
      after: [el('div', 'ui-note', t(`bigday.${id}.hint` as TextKey, params))],
      nextLabel: t('bigday.ok'),
      onNext: () => {
        close();
        scene.time.paused = false;
        scene.running = true;
        startBigDay(scene, id);
      },
    }),
  );
}

export function clearBigDay(scene: StoreScene): void {
  for (const obj of scene.bigObjs) discard(obj);
  // Мороз красил деревья в иней — возвращаем цвет по погоде.
  if (scene.bigObjs.length) for (const g of scene.greenery) g.setTint(scene.weather === 'leaves' ? 0xffb868 : 0xffffff);
  scene.bigObjs = [];
  if (scene.time.paused) scene.time.paused = false;
  if (scene.powerCut) {
    scene.powerCut = false;
    scene.updateLighting();
  }
  music.setParade(null);
}

export function startBigDay(scene: StoreScene, id: BigDayId): void {
  clearBigDay(scene);
  const keep = <T extends { destroy: () => void }>(obj: T): T => {
    scene.bigObjs.push(obj);
    return obj;
  };
  const { h } = scene.layout;
  const area = { x: -80, y: -140, w: scene.next.w + 160, h: scene.next.h + STREET_VIEW + 220 };
  const top = scene.streetY - 12;
  // Заливки — с большим запасом: камеру можно отдалить и увести в сторону.
  const wide = { x: -1200, y: -1200, w: scene.next.w + 2400, h: scene.next.h + 2400 };
  const overlay = (color: number, alpha: number) =>
    keep(scene.add.rectangle(wide.x, wide.y, wide.w, wide.h, color).setOrigin(0).setAlpha(alpha).setDepth(LIGHT_DEPTH - 1));
  if (id === 'heatwave') {
    const glow = overlay(0xff9a3c, 0.12);
    keep(scene.tweens.add({ targets: glow, alpha: 0.2, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    keep(scene.add.particles(0, 0, 'glow', {
      x: { min: area.x, max: area.x + area.w },
      y: { min: h + 8, max: area.y + area.h },
      speedY: { min: -12, max: -5 },
      scale: { start: 0.06, end: 0.2 },
      alpha: { start: 0.2, end: 0 },
      tint: 0xffd27a,
      lifespan: 2400,
      frequency: 40,
      blendMode: Phaser.BlendModes.ADD,
    })).setDepth(-5);
  }
  if (id === 'frost') {
    overlay(0x9fd3ff, 0.13);
    for (const g of scene.greenery) g.setTint(0xdce6f2);
    keep(scene.add.particles(0, 0, 'snowflake', {
      x: { min: area.x, max: area.x + area.w },
      y: area.y,
      speedY: { min: 18, max: 36 },
      speedX: { min: -24, max: -6 },
      scale: { min: 1.2 / ART, max: 2 / ART },
      lifespan: (area.h / 20) * 1000,
      frequency: 22,
    })).setDepth(-5);
  }
  if (id === 'flood') {
    // Сразу по воде плывёт первая лодка: машины сегодня не ездят.
    keep(scene.time.delayedCall(1500, () => scene.running && visitors.rowBoat(scene, -60, scene.next.w + 60)));
    // Вода стоит от крыльца до сквера за дорогой; по ней расходятся круги.
    const water = keep(scene.add.rectangle(wide.x, h + FACADE_H + 2, wide.w, top + 88 - h - FACADE_H - 2, 0x2f7fd8).setOrigin(0).setAlpha(0.5).setDepth(-5));
    keep(scene.tweens.add({ targets: water, alpha: 0.58, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    keep(scene.add.particles(0, 0, 'splash', {
      x: { min: area.x, max: area.x + area.w },
      y: { min: h + FACADE_H + 4, max: top + 86 },
      scale: { start: 0.3 / ART, end: 1.4 / ART },
      alpha: { start: 0.8, end: 0 },
      tint: 0xc4f4ff,
      lifespan: 900,
      frequency: 45,
    })).setDepth(-4.9);
    keep(scene.add.particles(0, 0, 'raindrop', {
      x: { min: area.x, max: area.x + area.w },
      y: area.y,
      speedY: { min: 240, max: 300 },
      speedX: -30,
      scale: 1 / ART,
      lifespan: (area.h / 260) * 1000,
      quantity: 2,
      frequency: 30,
    })).setDepth(-5);
  }
  if (id === 'quake') {
    for (const at of [0.12, 0.42, 0.72]) keep(scene.time.delayedCall(at * DAY_SECONDS * 1000, () => scene.running && !scene.night && tremor(scene)));
  }
  startBigDayScene(scene, id, keep, top);
  if (BIG_DAYS[id].crowd) {
    // Оркестр идёт по улице весь день: самба, марш или бодрые хиты марафона — вместо своей музыки и радио.
    music.setParade(id === 'carnival' ? 'samba' : id === 'marathon' ? 'hits' : 'march');
    const marchers = () => {
      if (!scene.running || scene.night) return;
      const n = Phaser.Math.Between(6, 8);
      for (let i = 0; i < n; i++) marcher(scene, id, i, area.x - 12 - Math.floor(i / 2) * 15, top + 34 + (i % 2) * 14, area.x + area.w + 20, keep);
    };
    marchers();
    keep(scene.time.addEvent({ delay: id === 'marathon' ? 5000 : 9000, loop: true, callback: marchers }));
    keep(scene.add.particles(0, 0, 'confetti', {
      x: { min: area.x, max: area.x + area.w },
      y: { min: top - 20, max: top + 10 },
      speedY: { min: 8, max: 20 },
      speedX: { min: -8, max: 8 },
      rotate: { min: 0, max: 360 },
      tint: [0xe43b44, 0xfee761, 0x63c74d, 0x0099db, 0xb55088, 0x2ce8f5],
      scale: 1 / ART,
      lifespan: 3200,
      frequency: 90,
    })).setDepth(top + 70);
  }
}

/** Необычный день на улице и в зале: свет, съёмки, автобус, звездопад, голуби, ремонт, проверка, свадьба. */
export function startBigDayScene(
  scene: StoreScene,
  id: BigDayId,
  keep: <T extends { destroy: () => void }>(obj: T) => T,
  top: number,
): void {
  const { w, h, door } = scene.layout;
  const at = (share: number, fn: () => void) =>
    keep(scene.time.delayedCall(share * DAY_SECONDS * 1000, () => scene.running && !scene.night && fn()));
  const road = top + 40;
  if (id === 'blackout') {
    scene.powerCut = true;
    scene.updateLighting();
    keep(
      scene.time.delayedCall(BLACKOUT_UNTIL * DAY_SECONDS * 1000, () => {
        if (!scene.powerCut) return;
        scene.powerCut = false;
        scene.updateLighting();
        scene.state = blackoutWarm(scene.state).state;
        scene.refreshShelves();
        sound.good();
        scene.popup(w / 2, h / 2 - 20, t('popup.lightOnDistrict'), '#c8ffb0');
      }),
    );
  }
  if (id === 'filming') {
    const sx = door.x + 50;
    keep(scene.art(sx - 24, road, 'film_camera').setDepth(road + 8));
    keep(scene.art(sx - 36, road - 6, 'film_light').setDepth(road + 4));
    keep(scene.art(sx + 40, road - 6, 'film_light').setFlipX(true).setDepth(road + 4));
    keep(scene.art(sx - 40, road + 10, 'director_chair').setDepth(road + 14));
    // Актёры в костюмах из альбома редких гостей, на тротуаре — зеваки.
    ['knight', 'queen', 'pirate'].forEach((rid, i) => {
      const guest = RARE_GUESTS.find((g) => g.id === rid);
      if (!guest) return;
      const actor = keep(persons.makePerson(scene, sx + 2 + i * 12, road + 2, guest.look as Look));
      persons.setFacing(actor, 'left');
    });
    for (let i = 0; i < 5; i++) keep(persons.makePerson(scene, door.x + 14 + i * 16, top + 14 + (i % 2) * 3, customerLook(Phaser.Utils.Array.GetRandom(SHIRTS), scene.state.day)));
    keep(
      scene.time.addEvent({
        delay: 14000,
        loop: true,
        callback: () => {
          if (!scene.running || scene.night) return;
          sound.tap();
          scene.popup(sx + 14, road - 18, t('popup.action'), '#fff3b0');
        },
      }),
    );
  }
  if (id === 'tourbus') at(0.3, () => tourBus(scene, keep));
  if (id === 'starfall') {
    keep(
      scene.time.addEvent({
        delay: 700,
        loop: true,
        callback: () => {
          if (!scene.night && scene.timeLeft > DAY_SECONDS * 0.35) return;
          const view = scene.cameras.main.worldView;
          const x = Phaser.Math.Between(view.x, view.x + view.width * 0.7);
          const y = Phaser.Math.Between(view.y, view.y + view.height * 0.4);
          const star = scene.add.rectangle(x, y, 10, 0.8, 0xffffff).setOrigin(1, 0.5).setRotation(0.45).setDepth(LIGHT_DEPTH + 2).setBlendMode(Phaser.BlendModes.ADD);
          scene.tweens.add({ targets: star, x: x + 56, y: y + 27, alpha: 0, duration: 800, onComplete: () => star.destroy() });
        },
      }),
    );
  }
  if (id === 'pigeons') for (const share of [0.1, 0.3, 0.5, 0.7]) at(share, () => scene.pigeonInside(keep));
  if (id === 'roadworks') {
    keep(scene.art(door.x + 44, road, 'road_pit').setDepth(road - 4));
    keep(scene.art(door.x + 100, road - 4, 'digger').setDepth(road + 8));
    for (let x = door.x + 14; x < door.x + 134; x += 20) keep(scene.art(x, road + 14, 'road_barrier').setDepth(road + 18));
    for (const x of [door.x + 2, door.x + 140]) keep(scene.art(x, road + 12, 'cone').setDepth(road + 16));
    // Рабочие у раскопа: один копает (качается), другой смотрит.
    [door.x + 30, door.x + 62].forEach((x, i) => {
      const worker = keep(persons.makePerson(scene, x, road - 8, { ...randomLook(0x8f563b), ...wearOf('builder', Math.random) }));
      if (i === 0) keep(scene.tweens.add({ targets: worker, y: road - 7, duration: 400, yoyo: true, repeat: -1 }));
    });
  }
  if (id === 'sanitary' && scene.inspector === 'none') scene.inspector = 'pending';
  if (id === 'robbery') robbery(scene, keep, at, road);
  if (id === 'wedding') {
    const car = keep(scene.art(door.x - 90, road, 'car').setTint(0xffffff).setDepth(road + 6));
    keep(scene.tweens.add({ targets: car, y: road - 0.5, duration: 900, yoyo: true, repeat: -1 }));
    at(0.8, () => {
      sound.bell();
      scene.popup(w / 2, h / 2 - 20, t('popup.weddingSoon'), '#ffd0e0');
    });
  }
}

/**
 * Ограбление с заложниками. Утром — тревожная новость; к полудню в магазин заходят пятеро в масках,
 * всех — покупателей, персонал и хозяина — сгоняют в угол, торговля стоит. Снаружи — полиция и фургон
 * ОМОНа, переговоры через мегафон; троих отпускают, грабители требуют вертолёт и деньги. Под вечер —
 * штурм: вспышка, грабителей уводят в фургон, заложники свободны, работа продолжается.
 */
export function robbery(
  scene: StoreScene,
  keep: <T extends { destroy: () => void }>(obj: T) => T,
  at: (share: number, fn: () => void) => void,
  road: number,
): void {
  const { w, h, door, wallH } = scene.layout;
  const hostages: Phaser.GameObjects.Container[] = [];
  const robbers: Phaser.GameObjects.Container[] = [];
  const outside = h + FACADE_H + 12;
  const say = (x: number, y: number, key: TextKey, color: string) => scene.popup(x, y, t(key), color);
  const corner = (i: number) => ({ x: 14 + (i % 5) * 10, y: wallH + 34 + Math.floor(i / 5) * 9 });
  at(ROBBERY_AT, () => {
    scene.siege = true;
    sound.bad();
    haptic.error();
    // Покупатели бросают корзины и идут в угол; очередь и кассы пустеют.
    for (const c of [...scene.customers]) {
      c.gone = true;
      c.patience?.remove();
      c.bubble.setVisible(false);
      scene.customers.delete(c);
      hostages.push(c.sprite);
    }
    scene.queue = [];
    for (const r of scene.registers) {
      r.customer = null;
      r.scan = null;
    }
    // Персонал бросает работу (их циклы останавливаются) и тоже в угол; хозяин — с ними.
    scene.staffGen++;
    scene.managerOnFloor = false;
    for (const worker of scene.workers.values()) if (!hostages.includes(worker.sprite)) hostages.push(worker.sprite);
    // Хозяин бросает дело: его шаг гасится без onStop, и само дело уже не кончится — без этого он
    // так и числился бы занятым, а за его кассой до конца дня стоял бы сменщик.
    if (scene.sellerBusy) staff.dropChore(scene);
    scene.sellerBusy = false;
    hostages.push(scene.seller);
    hostages.forEach((p, i) => {
      staff.stopMop(scene, p);
      persons.haltWalk(p);
      scene.tweens.killTweensOf(p);
      const spot = corner(i);
      void persons.walk(scene, p, spot.x, spot.y).then(() => {
        if (p.active) persons.setFacing(p, 'down');
      });
    });
    // Пятеро в масках: двое у заложников, один у кассы, двое у входа.
    const posts = [
      { x: 66, y: wallH + 40 },
      { x: 70, y: wallH + 56 },
      { x: scene.layout.counter.x - 14, y: scene.layout.counter.y + 6 },
      { x: door.x - 12, y: h - 14 },
      { x: door.x + 12, y: h - 14 },
    ];
    posts.forEach((post, i) => {
      const robber = keep(persons.makePerson(scene, door.x + (i - 2) * 6, outside, { shirt: 0x181425, pants: 0x262b44, skin: 0xf2d3ab, hair: 0x181425, style: 'beanie' }));
      robbers.push(robber);
      void persons.walk(scene, robber, door.x, h - 8).then(() => persons.walk(scene, robber, post.x, post.y));
    });
    say(w / 2, h / 2 - 20, 'robbery.enter', '#ffd0d0');
  });
  // Полиция: машина с мигалкой и фургон ОМОНа у входа, офицеры за машинами.
  at(ROBBERY_AT + 0.03, () => {
    sound.news();
    const car = keep(scene.add.container(door.x + 50, road, [scene.art(0, 0, 'car_sedan').setTint(0xffffff), scene.art(0, 0, 'car_sedan_lights')]).setDepth(road));
    const blue = keep(scene.add.rectangle(door.x + 46, road - 9, 4, 2, 0x0099db).setDepth(road + 1));
    const red = keep(scene.add.rectangle(door.x + 51, road - 9, 4, 2, 0xe43b44).setDepth(road + 1));
    keep(scene.time.addEvent({ delay: 300, loop: true, callback: () => { blue.setVisible(!blue.visible); red.setVisible(!blue.visible); } }));
    keep(scene.add.container(door.x - 60, road, [scene.art(0, 0, 'car_van').setTint(0x3a4466), scene.art(0, 0, 'car_van_lights')]).setDepth(road));
    void car;
    for (let i = 0; i < 4; i++) {
      const cop = keep(persons.makePerson(scene, door.x - 40 + i * 26, road - 16, { shirt: 0x124e89, pants: 0x262b44, skin: 0xeec39a, hair: 0x124e89, style: 'cap' }));
      persons.setFacing(cop, 'up');
    }
  });
  at(ROBBERY_AT + 0.07, () => say(door.x, outside + 6, 'robbery.police', '#d0e0ff'));
  at(ROBBERY_AT + 0.13, () => robbers[0]?.active && say(robbers[0].x, robbers[0].y - 16, 'robbery.demand', '#ffd0d0'));
  at(ROBBERY_AT + 0.21, () => say(door.x, outside + 6, 'robbery.deal', '#d0e0ff'));
  // Троих покупателей отпускают: выходят и уходят по тротуару.
  at(ROBBERY_RELEASE, () => {
    const freed = hostages.filter((p) => p !== scene.seller && ![...scene.workers.values()].some((wk) => wk.sprite === p)).slice(0, 3);
    for (const p of freed) {
      hostages.splice(hostages.indexOf(p), 1);
      void persons.walk(scene, p, door.x, h + 16).then(() => {
        if (p.active) void visitors.strollAway(scene, p);
      });
    }
    sound.good();
    say(door.x, h - 24, 'robbery.released', '#c8ffb0');
  });
  at(ROBBERY_RELEASE + 0.1, () => robbers[0]?.active && say(robbers[0].x, robbers[0].y - 16, 'robbery.where', '#ffd0d0'));
  at(ROBBERY_RELEASE + 0.2, () => say(door.x, outside + 6, 'robbery.stall', '#d0e0ff'));
  // ОМОН строится у входа.
  at(ROBBERY_STORM - 0.08, () => {
    for (let i = 0; i < 5; i++) {
      const trooper = keep(persons.makePerson(scene, door.x - 24 + i * 12, outside + 4, { shirt: 0x262b44, pants: 0x181425, skin: 0xeec39a, hair: 0x181425, style: 'cap', acc: 'vest', accTint: 0x3a4466 }));
      persons.setFacing(trooper, 'up');
    }
    say(door.x, outside - 6, 'robbery.omon', '#d0e0ff');
  });
  // Штурм: вспышка и грохот, грабителей уводят, заложники свободны.
  at(ROBBERY_STORM, () => {
    const flash = scene.add.rectangle(-1200, -1200, scene.next.w + 2400, scene.next.h + 2400, 0xffffff).setOrigin(0).setDepth(LIGHT_DEPTH + 5).setAlpha(0.9);
    scene.tweens.add({ targets: flash, alpha: 0, duration: 900, onComplete: () => flash.destroy() });
    sound.rumble();
    haptic.error();
    // Вместо тряски — дым от светошумовой: у двери расползается облако.
    smokeCloud(scene, door.x, door.y + 2);
    say(w / 2, h / 2 - 20, 'robbery.storm', '#c8ffb0');
    for (const robber of robbers) void persons.walk(scene, robber, door.x, h + 16).then(() => {
      if (robber.active) robber.setVisible(false);
    });
    for (const p of hostages) {
      if (p === scene.seller || [...scene.workers.values()].some((wk) => wk.sprite === p)) continue;
      void persons.walk(scene, p, door.x, h + 16).then(() => {
        if (p.active) void visitors.strollAway(scene, p);
      });
    }
    scene.siege = false;
    scene.state = { ...scene.state, rating: Math.min(5, Math.round((scene.state.rating + ROBBERY_RATING) * 100) / 100) };
    const home = staff.ownerHome(scene);
    void persons.walk(scene, scene.seller, home.x, home.y);
    staff.syncStaff(scene);
    scene.time.delayedCall(1500, () => scene.popup(w / 2, h / 2 - 8, t('robbery.thanks', { r: ROBBERY_RATING }), '#fff3b0'));
  });
}

/** Автобус туристов: подъезжает к магазину, из него разом выходит толпа. */
export function tourBus(scene: StoreScene, keep: <T extends { destroy: () => void }>(obj: T) => T): void {
  const { door } = scene.layout;
  const y = scene.streetY + 25;
  const body = scene.art(0, 0, 'bus').setTint(0xfeae34);
  const lights = scene.art(0, 0, 'bus_lights');
  const bus = keep(scene.add.container(-140, y, [body, lights]).setDepth(y));
  scene.tweens.add({
    targets: bus,
    x: door.x,
    duration: 3000,
    ease: 'Sine.easeOut',
    onComplete: () => {
      if (!bus.active) return;
      sound.bell();
      scene.popup(door.x, scene.streetY - 12, t('popup.tourists'), '#fee761');
      for (let i = 0; i < TOURISTS; i++) {
        scene.time.delayedCall(i * 350, () => {
          if (!scene.running) return;
          const look = { ...randomLook(Phaser.Utils.Array.GetRandom(SHIRTS)), ...wearOf('tourist', Math.random) };
          scene.spawnCustomer({ look, at: { x: door.x + Phaser.Math.Between(-24, 24), y: scene.streetY + 4 } });
        });
      }
      scene.time.delayedCall(TOURISTS * 350 + 1500, () => bus.active && scene.tweens.add({ targets: bus, x: scene.next.w + 160, duration: 3200, ease: 'Sine.easeIn' }));
    },
  });
}

/** Участник шествия: идёт вдоль дороги слева направо и уходит за край. */
export function marcher(scene: StoreScene, id: BigDayId, i: number, x: number, y: number, toX: number, keep: <T extends { destroy: () => void }>(obj: T) => T): void {
  const skin = Phaser.Utils.Array.GetRandom(SKINS);
  const costume = Phaser.Utils.Array.GetRandom([0xb55088, 0xe43b44, 0x0099db, 0x63c74d, 0xfeae34]);
  const shirtColor = Phaser.Utils.Array.GetRandom([0xe43b44, 0x0099db, 0x63c74d, 0xfeae34, 0xb55088, 0x2ce8f5]);
  const look: Look =
    id === 'marathon'
      ? { ...randomLook(WHITE_SHIRT), skin, outfit: 'runner', outfitTint: shirtColor, hat: 'headband', hatTint: WHITE_SHIRT, pants: 0x262b44 }
      : id === 'carnival'
      ? {
          ...randomLook(costume),
          skin,
          pants: costume,
          outfit: 'samba',
          hat: 'feathers',
          prop: i % 3 === 2 ? 'drum' : 'maracas',
          back: i % 3 === 0 ? 'fan' : undefined,
        }
      : i < 6
        ? { ...randomLook(0xe43b44), skin, pants: 0x262b44, outfit: 'band', hat: 'shako', prop: i % 2 ? 'drum' : 'trumpet' }
        : { ...customerLook(Phaser.Utils.Array.GetRandom(SHIRTS)), prop: i % 2 ? 'flag' : 'balloon', propTint: Phaser.Utils.Array.GetRandom(HAT_COLORS) };
  const person = keep(persons.makePerson(scene, x, y, look));
  persons.setFacing(person, 'right');
  person.setData('walking', true);
  // Шаг считается по пройденному пути: трусцой бегут мелко и часто, иначе ноги мелькали бы вдвое реже.
  if (id === 'marathon') persons.strideOf(person).stride = 0.5;
  // Марафонцы бегут трусцой (ноги часто, с подскоком), шествие идёт мерным шагом.
  person.setData('pace', id === 'marathon' ? RUN_PACE : 16);
  keep(scene.tweens.add({ targets: person, x: toX, duration: ((toX - x) / (id === 'marathon' ? 34 : 16)) * 1000, onComplete: () => person.destroy() }));
  // Танцоры подпрыгивают в такт.
  if (id === 'carnival') keep(scene.tweens.add({ targets: person, y: y - 1.5, duration: 260, yoyo: true, repeat: -1, delay: i * 90 }));
}

/**
 * Подземный толчок: экран не трясётся — дрожит сам магазин. По полкам слева направо бежит дрожь,
 * разбитый товар падает с полки на пол, с потолка сыплется пыль, подвесные лампы качаются.
 */
export function tremor(scene: StoreScene): void {
  sound.rumble();
  haptic.error();
  const before = scene.state.shelves;
  const { state, broken } = quakeBreak(scene.state, Math.random);
  scene.state = state;
  scene.stats.spoiled += broken;
  // Прошлый толчок ещё не долетел до дальних полок — роняем его остатки сейчас.
  scene.quakeFlush?.();
  // Что упадёт — запоминаем по картинкам сейчас: они ещё показывают полки до толчка.
  const falls = scene.shelfViews.map((view, i) => brokenOnShelf(view, before[i], state.shelves[i]));
  rekeyAfterQuake(scene, before, state.shelves);
  // Осколки — не больше чем у ~20 штук: в большом магазине разбивается и по 40.
  const every = Math.max(1, Math.ceil(falls.flat().length / QUAKE_SHATTER_MAX));
  let n = 0;
  // Разбитая штука прячется, вместо неё падает копия. Список опустошается: каждая падает один раз.
  const fallAll = (view: ShelfView, list: QuakeFall[]) => {
    for (const fall of list.splice(0)) {
      if (!fall.img.active) continue;
      fall.img.setVisible(false);
      dropItem(scene, view, fall, n++ % every === 0);
    }
  };
  // Покупатель взял товар или продавец выложил до прихода волны — полки перерисуют: роняем всё сразу.
  const flush = () => {
    if (scene.quakeFlush === flush) scene.quakeFlush = undefined;
    falls.forEach((list, i) => scene.shelfViews[i] && fallAll(scene.shelfViews[i], list));
  };
  scene.quakeFlush = flush;
  const end = motion.quakeWave(scene, (view, i) => fallAll(view, falls[i] ?? []));
  // Волна прошла, осколки улеглись — уцелевший товар съезжает в дыры, таблички «пусто» обновляются.
  scene.time.delayedCall(end + QUAKE_SETTLE_MS, () => {
    if (scene.quakeFlush === flush) scene.quakeFlush = undefined;
    scene.refreshShelves();
  });
  if (!scene.lite) {
    ceilingDust(scene);
    swingLamps(scene);
  }
  const { w, h } = scene.layout;
  scene.popup(w / 2, h / 2 - 10, t('popup.quake', { n: broken }), '#ffb0a0');
}

/**
 * Уцелевшие штуки получают метку своего нового места в товаре (как в refreshShelves): тогда при
 * перерисовке они съезжают в дыры от разбитого, а не появляется «новый» товар на месте разбитого.
 */
export function rekeyAfterQuake(scene: StoreScene, before: StoreState['shelves'], after: StoreState['shelves']): void {
  scene.shelfViews.forEach((view, i) => {
    let n = 0;
    for (const id of PRODUCT_IDS) {
      const kept = after[i]?.items[id] ?? [];
      for (const unit of before[i]?.items[id] ?? []) {
        const k = kept.indexOf(unit);
        view.items[n++]?.setData('stock', k >= 0 ? `${id}:${k}` : null);
      }
    }
  });
}

/** Какие картинки на полке показывают товар, который толчок разбил (сравнение полки до и после). */
export function brokenOnShelf(view: ShelfView, before?: StoreState['shelves'][number], after?: StoreState['shelves'][number]): QuakeFall[] {
  if (!before || !after) return [];
  // Порядок — как в refreshShelves: картинка n показывает n-ю штуку по списку товаров.
  const units = PRODUCT_IDS.flatMap((id) => before.items[id] ?? []);
  const kept = new Set(PRODUCT_IDS.flatMap((id) => after.items[id] ?? []));
  const falls: QuakeFall[] = [];
  units.forEach((unit, n) => {
    const img = view.items[n];
    if (kept.has(unit) || !img?.visible) return;
    falls.push({ img, key: img.texture.key, x: img.x, y: img.y, scale: img.scaleX, tint: img.tintTopLeft });
  });
  return falls;
}

/**
 * Штука срывается с полки: подскок, дуга с кувырком на пол перед полкой, там — облачко пыли
 * и осколки цвета самого товара; разбитое тускнеет и исчезает.
 */
export function dropItem(scene: StoreScene, view: ShelfView, fall: QuakeFall, shards: boolean): void {
  const side = view.meter ? slotSide(scene.layout, view.at) : null;
  const dir = side === 'right' ? -1 : side === 'left' ? 1 : Phaser.Math.RND.sign();
  // С боковой полки — в проход рядом с ней, с обычной — на пол перед полкой.
  const to = side
    ? { x: view.at.x + dir * Phaser.Math.Between(11, 16), y: fall.y + Phaser.Math.Between(2, 6) }
    : { x: fall.x + dir * Phaser.Math.Between(2, 7), y: view.at.y + Phaser.Math.Between(17, 22) };
  // Летит перед полкой: с боковой — поверх её торца, а не за ним.
  const piece = scene.add.image(fall.x, fall.y, fall.key).setScale(fall.scale).setTint(fall.tint).setDepth(Math.max(to.y, view.at.y + 20) + 2);
  const spin = dir * Phaser.Math.Between(100, 200);
  const hop = Phaser.Math.Between(4, 7);
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    delay: Phaser.Math.Between(0, 140),
    duration: Phaser.Math.Between(340, 420),
    onUpdate: (tween) => {
      const k = tween.getValue() ?? 0;
      // Сначала вверх с полки, потом всё быстрее вниз — как брошенное.
      piece.setPosition(fall.x + (to.x - fall.x) * k, fall.y + (to.y - fall.y) * k * k - hop * Math.sin(k * Math.PI));
      piece.setAngle(spin * k);
    },
    onComplete: () => {
      if (!piece.active) return;
      piece.setPosition(to.x, to.y).setTint(0xc8b4a8);
      // Удар о пол: штука сминается (но узнаётся), тускнеет и пропадает.
      scene.tweens.add({ targets: piece, scaleY: fall.scale * 0.7, scaleX: fall.scale * 1.15, duration: 70, ease: 'Quad.easeOut' });
      scene.tweens.add({ targets: piece, alpha: 0, delay: 650, duration: 450, onComplete: () => piece.destroy() });
      if (shards && !scene.lite) shatter(scene, to.x, to.y, fall.key);
    },
  });
}

/** Осколки и пыль от разбитой штуки: облачко и кусочки её цвета разлетаются по полу. */
export function shatter(scene: StoreScene, x: number, y: number, key: string): void {
  const dust = scene.art(x, y - 1, 'puff').setTint(QUAKE_DUST).setScale(0.6 / ART).setAlpha(0.9).setDepth(y + 3);
  scene.tweens.add({ targets: dust, y: y - 6, scale: 1.1 / ART, alpha: 0, duration: 600, ease: 'Quad.easeOut', onComplete: () => dust.destroy() });
  // Цвет осколков — с самой картинки товара (середина и чуть ниже), иначе светлое стекло. Один раз на картинку.
  let colors = scene.shardColors.get(key);
  if (!colors) {
    const frame = scene.textures.getFrame(key);
    const colorAt = (fy: number) => {
      const c = frame ? scene.textures.getPixel(Math.floor(frame.width / 2), Math.floor(frame.height * fy), key) : null;
      return c && c.alpha > 0 ? c.color : 0xe8f4ff;
    };
    colors = [colorAt(0.5), colorAt(0.7), 0xffffff];
    scene.shardColors.set(key, colors);
  }
  for (let i = 0; i < 4; i++) {
    const bit = scene.add.rectangle(x, y, i % 2 ? 1 : 1.5, 1, colors[i % colors.length]).setDepth(y + 3);
    const dx = Phaser.Math.Between(-9, 9);
    scene.tweens.add({ targets: bit, x: x + dx, angle: dx * 20, duration: 320, ease: 'Quad.easeOut' });
    scene.tweens.chain({
      targets: bit,
      tweens: [
        { y: y - Phaser.Math.Between(2, 5), duration: 140, ease: 'Quad.easeOut' },
        { y: y + Phaser.Math.Between(0, 3), duration: 180, ease: 'Quad.easeIn' },
        { alpha: 0, delay: 500, duration: 400, onComplete: () => bit.destroy() },
      ],
    });
  }
}

/** С потолка от толчка сыплется пыль: комки штукатурки и крошки вдоль задней стены, крошки над залом — вслед за волной. */
export function ceilingDust(scene: StoreScene): void {
  const { w, h, wallH } = scene.layout;
  // Пыль сыплется перед полками у задней стены, а не за ними.
  const front = wallH + 24;
  for (let x = 5; x < w - 3; x += Phaser.Math.Between(8, 13)) {
    const delay = x * QUAKE_WAVE_MS + Phaser.Math.Between(0, 150);
    // Комок у самого потолка: срывается, раздувается и тает, опускаясь.
    const size = Phaser.Math.FloatBetween(0.6, 1);
    const clump = scene.art(x, 2, 'puff').setTint(QUAKE_DUST).setScale((0.5 * size) / ART).setFlipX(Math.random() < 0.5).setAlpha(0).setDepth(front);
    scene.tweens.chain({
      targets: clump,
      tweens: [
        { alpha: 0.95, scale: (0.8 * size) / ART, delay, duration: 120, ease: 'Quad.easeOut' },
        { alpha: 0, y: Phaser.Math.Between(8, 12), scale: (1.2 * size) / ART, duration: 900, ease: 'Sine.easeOut', onComplete: () => clump.destroy() },
      ],
    });
    // Крошки струйкой вниз, до пола перед полками.
    for (let i = 0; i < 3; i++) {
      const size = i % 2 ? 1 : 1.5;
      const speck = scene.add.rectangle(x + Phaser.Math.FloatBetween(-2.5, 2.5), 3, size, size, i % 2 ? QUAKE_DUST : QUAKE_GRIT).setAlpha(0).setDepth(front);
      scene.tweens.chain({
        targets: speck,
        tweens: [
          { alpha: 1, delay: delay + 40 + i * 90, duration: 60 },
          { y: wallH + Phaser.Math.Between(-8, 10), x: speck.x + Phaser.Math.FloatBetween(-1.5, 1.5), duration: Phaser.Math.Between(600, 850), ease: 'Quad.easeIn' },
          { alpha: 0, duration: 250, onComplete: () => speck.destroy() },
        ],
      });
    }
  }
  // Над залом сверху, из-под потолка, падают редкие крошки.
  for (let i = 0; i < 22; i++) {
    const x = Phaser.Math.Between(6, w - 6);
    const y = Phaser.Math.Between(wallH + 4, h - 30);
    const mote = scene.add.rectangle(x, y, 1, 1, i % 3 ? QUAKE_GRIT : QUAKE_DUST).setAlpha(0).setDepth(LIGHT_DEPTH - 2);
    scene.tweens.chain({
      targets: mote,
      tweens: [
        { alpha: 0.9, delay: x * QUAKE_WAVE_MS + Phaser.Math.Between(0, 400), duration: 120 },
        { y: y + Phaser.Math.Between(14, 22), x: x + Phaser.Math.FloatBetween(-2, 2), duration: Phaser.Math.Between(700, 1000), ease: 'Quad.easeIn' },
        { alpha: 0, duration: 300, onComplete: () => mote.destroy() },
      ],
    });
  }
}

/** Толчок раскачивает подвесные лампы, а пятна света от потолочных ламп ходят по полу. */
export function swingLamps(scene: StoreScene): void {
  for (const { lamp, bulb } of scene.hangingLamps) {
    if (!lamp.active) continue;
    // Свет висит под лампой: при качании он описывает дугу вокруг точки подвеса.
    const pivot = { x: lamp.x, y: lamp.y };
    const arm = { x: bulb.x - pivot.x, y: bulb.y - pivot.y };
    const swing = Phaser.Math.FloatBetween(9, 13) * Phaser.Math.RND.sign();
    scene.tweens.addCounter({
      from: 0,
      to: 1,
      delay: pivot.x * QUAKE_WAVE_MS,
      duration: 2600,
      onUpdate: (tween) => {
        const k = tween.getValue() ?? 0;
        const a = Phaser.Math.DegToRad(swing * Math.sin(k * Math.PI * 7) * (1 - k) ** 1.5);
        lamp.setRotation(a);
        bulb.setPosition(pivot.x + arm.x * Math.cos(a) - arm.y * Math.sin(a), pivot.y + arm.x * Math.sin(a) + arm.y * Math.cos(a));
      },
      onComplete: () => {
        lamp.setRotation(0);
        bulb.setPosition(pivot.x + arm.x, pivot.y + arm.y);
      },
    });
  }
  for (const { img } of scene.lampPools) {
    const x = img.x;
    const sway = Phaser.Math.FloatBetween(2.5, 4) * Phaser.Math.RND.sign();
    scene.tweens.addCounter({
      from: 0,
      to: 1,
      delay: x * QUAKE_WAVE_MS,
      duration: 2400,
      onUpdate: (tween) => {
        const k = tween.getValue() ?? 0;
        img.x = x + sway * Math.sin(k * Math.PI * 6) * (1 - k);
      },
      onComplete: () => (img.x = x),
    });
  }
}

/** Дым после штурма: от двери в обе стороны расползается серое облако и медленно тает. */
export function smokeCloud(scene: StoreScene, x: number, y: number): void {
  const n = scene.lite ? 6 : 16;
  for (let i = 0; i < n; i++) {
    const dir = i % 2 ? 1 : -1;
    const reach = Phaser.Math.FloatBetween(0.1, 1);
    const blob = scene.art(x + Phaser.Math.Between(-4, 4), y + Phaser.Math.Between(-3, 3), 'glow')
      .setScale(0.15)
      .setTint(Phaser.Utils.Array.GetRandom([0xa8acb8, 0xc4c6ce, 0x8e92a0]))
      .setAlpha(0)
      .setDepth(LIGHT_DEPTH - 3);
    // Клубы расходятся вдоль фасада шире, чем вглубь, растут и поднимаются.
    scene.tweens.add({
      targets: blob,
      x: x + dir * reach * 58 + Phaser.Math.Between(-5, 5),
      y: y + Phaser.Math.Between(-32, 16),
      scale: Phaser.Math.FloatBetween(0.55, 0.85),
      duration: Phaser.Math.Between(2600, 3400),
      ease: 'Cubic.easeOut',
    });
    scene.tweens.chain({
      targets: blob,
      tweens: [
        { alpha: Phaser.Math.FloatBetween(0.7, 0.85), delay: i * 25, duration: 180 },
        { alpha: 0, delay: Phaser.Math.Between(1200, 2000), duration: Phaser.Math.Between(2200, 3000), ease: 'Sine.easeIn', onComplete: () => blob.destroy() },
      ],
    });
  }
  if (scene.lite) return;
  // Поверх мягких клубов — пиксельные облачка: дым читается как дым, а не как туман.
  for (let i = 0; i < 14; i++) {
    const dir = i % 2 ? 1 : -1;
    // Часть клубов вываливается наружу, на тротуар.
    const clump = scene.art(x + dir * Phaser.Math.Between(2, 12), y + Phaser.Math.Between(-8, 10), 'puff')
      .setTint(Phaser.Utils.Array.GetRandom([0xb0b4bc, 0xd0d2d8]))
      .setFlipX(Math.random() < 0.5)
      .setAlpha(0)
      .setDepth(LIGHT_DEPTH - 2);
    scene.tweens.add({ targets: clump, x: clump.x + dir * Phaser.Math.Between(12, 50), y: clump.y - Phaser.Math.Between(6, 26), scale: Phaser.Math.FloatBetween(1.8, 2.8) / ART, duration: 2800, ease: 'Cubic.easeOut' });
    scene.tweens.chain({
      targets: clump,
      tweens: [
        { alpha: 0.95, delay: 80 + i * 50, duration: 160 },
        { alpha: 0, delay: Phaser.Math.Between(800, 1400), duration: 1800, onComplete: () => clump.destroy() },
      ],
    });
  }
}
