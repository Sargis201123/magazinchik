// Ритуал закрытия (13.11, автор: «после таймера — несколько секунд уютного вечера»): табличка на двери
// переворачивается на «Закрыто», свет в зале гаснет ряд за рядом от задней стены к двери, выручка дня
// со звоном ссыпается в ящик кассы, рубильник, кот потягивается, Бобик уходит в будку, роллеты — итоги.
// Что и когда — чистый план (game/closing.ts); здесь — как это выглядит и звучит.
//
// Всё на таймерах сцены (scene.time.delayedCall): перестройка мира их не обрывает (disposeWorld убивает
// твины и worldTimers). Касание сразу играет следующий шаг, а первое ещё и ускоряет время так, что остаток
// доигрывается за CLOSING_CASCADE_MS — ничего не обрывается, просто бегом. Камера не двигается вовсе.

import type { StoreScene } from './StoreScene';
import type Phaser from 'phaser';
import { t } from '../i18n';
import { sound } from '../platform/sound';
import { haptic } from '../platform/telegram';
import { track } from '../platform/analytics';
import { UI_FONT } from '../ui/dom';
import { CLOSING_ARM_MS, CLOSING_CASCADE_MS, CLOSING_HINT_DAYS, closingCoinTiming, closingPlan, type ClosingStep } from '../game/closing';
import { ART, LIGHT_DEPTH } from './common';
import { look } from './look';
import * as lighting from './lighting';
import * as building from './building';
import * as nightShift from './nightShift';
import * as pets from './pets';
import * as pixelFx from './pixelFx';
import * as motion from './motion';
import * as effects from './effects';
import * as camera from './camera';

export interface ClosingOpts {
  revenue: number;
  /** Закрываемся после ночной смены: зал уже в ночном сумраке — сразу закрытый тон, без скачка яркости. */
  wasNight: boolean;
  finishedDay: number;
}

interface Queued {
  step: ClosingStep;
  fired: boolean;
  timer: Phaser.Time.TimerEvent;
}

/** Ритуал закрытия; done — когда пора показать итоги дня (ровно один раз). */
export function closingRitual(scene: StoreScene, o: ClosingOpts, done: () => void): void {
  // Лёгкую графику читаем один раз: замер FPS может переключить её посреди ритуала.
  const lite = scene.lite;
  const calm = pixelFx.calm(scene);
  const rows = scene.lampPools.reduce((m, p) => Math.max(m, p.row + 1), 0);
  const dark = !lighting.powerOn(scene);
  const revenue = Math.max(0, Math.round(o.revenue));
  const cat = scene.catImg;
  const plan = closingPlan({ rows, revenue, lite, dark, cat: Boolean(cat?.active && !scene.catOut), dog: Boolean(scene.bobik?.active && scene.bobikHome) });
  const gen = scene.worldGen;
  /** Временные картинки ритуала (ящик, монеты, счётчик): конец ритуала убирает недолетевшее. */
  const objs: Phaser.GameObjects.GameObject[] = [];
  const coinTimers: Phaser.Time.TimerEvent[] = [];
  /** Лампы, которые ритуал уже погасил (повторно не гасим). */
  const off = new Set<Phaser.GameObjects.Image>();
  let finished = false;
  let armed = false;
  let taps = 0;
  let firstRow = true;
  /** Выручку уже показали у кассы — в итогах её плитка не докручивается заново. */
  let counted = false;

  const fire = (q: Queued, instant = false): void => {
    if (q.fired) return;
    // Мир перестроили (пришёл гость с соседней улицы, расширили зал): доигрываем сразу, без анимации.
    if (!instant && scene.worldGen !== gen) return finish();
    q.fired = true;
    q.timer.remove(false);
    BEAT[q.step.kind](q.step, instant);
  };

  const finish = (): void => {
    if (finished) return;
    finished = true;
    scene.input.off('pointerup', onUp);
    for (const q of queue) q.timer.remove(false);
    for (const timer of [watchdog, arm, ...coinTimers]) timer.remove(false);
    scene.setSpeed(1);
    for (const q of queue) if (q.step.kind !== 'end') fire(q, true);
    for (const obj of objs) {
      if (!obj.active) continue;
      scene.tweens.killTweensOf(obj);
      obj.destroy();
    }
    scene.hud.setHint('');
    scene.hud.revenueShown = counted;
    done();
  };

  const tapped = (): void => {
    if (finished || !armed) return;
    haptic.tap();
    if (!taps++) {
      scene.hud.setHint('');
      track('closing_tap', o.finishedDay, plan.total - endTimer.getRemaining());
    }
    const next = queue.find((q) => !q.fired && q.step.kind !== 'end');
    if (!next) return finish();
    fire(next);
    // Остаток — бегом, за CLOSING_CASCADE_MS (таймеры и твины сцены в одном темпе — ничего не разъезжается).
    const pace = Math.max(scene.time.timeScale, 1, endTimer.getRemaining() / CLOSING_CASCADE_MS);
    scene.time.timeScale = pace;
    scene.tweens.timeScale = pace;
  };
  const onUp = (): void => camera.tap(scene, tapped);

  /** Погасить лампу на полу: snap — сразу, иначе — короткая вспышка и угасание (calm — просто угасание). */
  const lampOff = (img: Phaser.GameObjects.Image, snap: boolean, ms = 200): void => {
    off.add(img);
    scene.tweens.killTweensOf(img);
    if (snap) img.setAlpha(0);
    else if (calm) scene.tweens.add({ targets: img, alpha: 0, duration: ms });
    else
      scene.tweens.chain({
        targets: img,
        tweens: [
          { alpha: img.alpha * 2, duration: 60 },
          { alpha: 0, duration: ms, ease: 'Sine.easeIn' },
        ],
      });
  };

  const BEAT: Record<ClosingStep['kind'], (step: ClosingStep, instant: boolean) => void> = {
    sign: (_step, instant) => {
      scene.closed = true;
      scene.doorOpen = 0;
      if (scene.doorImg?.active) scene.doorImg.setTexture(building.doorKey(scene.state.level, 0));
      if (o.wasNight) {
        lighting.hallOff(scene, -Infinity, Infinity);
        scene.updateLighting(1);
      }
      const sign = scene.doorSign;
      if (instant) {
        if (sign?.active) {
          scene.tweens.killTweensOf(sign);
          sign.setTexture('door_sign_closed').setScale(1 / ART).setAngle(0);
        }
        return;
      }
      nightShift.flipDoorSign(scene, false);
      sound.tap();
      sound.doorbell(scene.layout.door.x);
      haptic.tap();
      if (sign?.active) scene.popup(sign.x, sign.y - 6, t('closing.sign'), '#f6757a');
      if (o.finishedDay <= CLOSING_HINT_DAYS && !taps) scene.hud.setHint(t('closing.skip'));
    },
    row: (step, instant) => {
      const r = step.row ?? 0;
      for (const p of scene.lampPools) if (p.img.active && p.row <= r && !off.has(p.img)) lampOff(p.img, instant || lite);
      const edge = lighting.lampRowBottom(scene, r);
      lighting.hallOff(scene, edge, o.wasNight ? Infinity : edge);
      if (firstRow) {
        firstRow = false;
        scene.hallDust?.stop();
        // Бра на задней стене гаснут вместе с дальним рядом.
        if (instant || lite) {
          scene.furnitureOn.wall = 0;
          lighting.furnitureLight(scene);
        } else
          scene.tweens.addCounter({
            from: scene.furnitureOn.wall,
            to: 0,
            duration: 220,
            onUpdate: (tw) => {
              scene.furnitureOn.wall = tw.getValue() ?? 0;
              lighting.furnitureLight(scene);
            },
          });
      }
      scene.updateLighting(1);
      if (!instant) sound.switchOff(scene.layout.w / 2, r);
    },
    till: (_step, instant) => {
      const reg = scene.registers[0];
      const till = reg?.img;
      if (instant || !reg || !till?.active) return;
      const c = reg.counter;
      const dx = c.x + (till.flipX ? -0.5 : 0.5);
      const dy = c.y + 15;
      const coins = plan.coins;
      const { from, step, fly } = closingCoinTiming(lite);
      counted = true;
      sound.till(c.x, revenue, { own: true });
      haptic.tap();
      // Ящик кассы выезжает, над кассой — золотой счётчик выручки (то же число, что в итогах).
      let drawer: Phaser.GameObjects.Rectangle | undefined;
      let label: Phaser.GameObjects.Text | undefined;
      if (!calm) {
        drawer = scene.add.rectangle(dx, dy, 7, 1.5, 0x262b44).setDepth(c.y + 20.5);
        scene.tweens.add({ targets: drawer, y: dy + 1.5, duration: 120, ease: 'Quad.easeOut' });
        label = scene.add
          .text(dx, c.y - 18, '+0', { fontFamily: UI_FONT, fontSize: '40px', fontStyle: '900', color: '#fee761', stroke: '#181425', strokeThickness: 12 })
          .setOrigin(0.5, 1)
          .setScale(0.08)
          .setDepth(LIGHT_DEPTH + 9);
        scene.tweens.add({ targets: label, scale: 0.22, duration: 220, ease: 'Back.easeOut' });
        objs.push(drawer, label);
      }
      let landed = 0;
      for (let i = 0; i < coins; i++) {
        coinTimers.push(
          scene.time.delayedCall(from + i * step, () => {
            if (finished || !till.active) return;
            const sx = lite ? dx : c.x + look.between(-10, 6);
            const sy = c.y - (lite ? 12 : 30);
            const coin = calm ? scene.art(sx, sy, 'coin').setDepth(LIGHT_DEPTH + 5) : pixelFx.play(scene, 'coin', sx, sy, { random: true });
            objs.push(coin);
            // Монетка вспыхивает белым — блестит над темнеющим залом.
            if (!calm) {
              coin.setTintFill(0xffffff);
              scene.time.delayedCall(50, () => coin.active && coin.clearTint());
            }
            const arc = lite || calm ? 0 : 10;
            scene.tweens.add({
              targets: coin,
              duration: fly,
              ease: 'Cubic.easeIn',
              scale: calm ? 1 / ART : 0.6 / ART,
              onUpdate: (tw) => {
                const p = tw.progress;
                coin.x = sx + (dx - sx) * p;
                coin.y = sy + (dy - sy) * p - Math.sin(p * Math.PI) * arc;
              },
              onComplete: () => {
                coin.destroy();
                landed++;
                motion.squash(scene, till, 1.04, 0.94, 70);
                if (landed % 3 === 1) sound.coin(dx);
                label?.setText(`+${Math.round((revenue * landed) / coins)}`);
                if (landed < coins) return;
                if (calm) {
                  effects.popup(scene, dx, c.y - 20, `+${revenue} 💰`, '#fee761');
                  return;
                }
                pixelFx.play(scene, 'coinpop', dx, dy, { depth: LIGHT_DEPTH + 6 });
                if (label) scene.tweens.add({ targets: label, y: label.y - 10, alpha: 0, delay: 350, duration: 400, onComplete: () => label?.destroy() });
                if (drawer) scene.tweens.add({ targets: drawer, y: dy, delay: 150, duration: 120, onComplete: () => drawer?.destroy() });
              },
            });
          }),
        );
      }
    },
    main: (_step, instant) => {
      // Рубильник: гаснет ряд у двери, касса, витрины и свет у входа. Неон на крыше, фонари и холодильники горят.
      for (const p of scene.lampPools) if (p.img.active && p.img.alpha > 0 && !off.has(p.img)) lampOff(p.img, instant || lite, 180);
      lighting.hallOff(scene, Infinity, Infinity);
      scene.furnitureOn.wall = 0;
      scene.hallDust?.stop();
      scene.updateLighting(1);
      if (instant) return;
      if (!dark) sound.switchOff(scene.registers[0]?.counter.x ?? scene.layout.w / 2, 0, true);
      // Кот гуляет по залу — из темноты слышно «мяу».
      if (scene.catOut && cat?.active) sound.meow(cat.x);
    },
    cat: (_step, instant) => {
      if (instant || !cat?.active || scene.catOut || !['cat', 'cat_flick'].includes(cat.texture.key)) return;
      pets.catStretch(scene, cat);
      sound.purr(cat.x);
      if (!lite) pets.petEmote(scene, cat, 'emo_zzz');
    },
    dog: (_step, instant) => void pets.bobikKennel(scene, instant),
    shutters: () => nightShift.closeShop(scene, lite || calm ? 500 : 700),
    end: () => finish(),
  };

  const queue: Queued[] = plan.steps.map((step) => {
    const q = { step, fired: false } as Queued;
    q.timer = scene.time.delayedCall(step.at, () => fire(q));
    return q;
  });
  const endTimer = queue[queue.length - 1].timer;
  // Сторож: что бы ни случилось с таймерами, итоги откроются.
  const watchdog = scene.time.delayedCall(plan.total + 1500, finish);
  const arm = scene.time.delayedCall(CLOSING_ARM_MS, () => (armed = true));
  scene.input.on('pointerup', onUp);
}
