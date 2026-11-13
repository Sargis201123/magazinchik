// Касса в ритме (game/tillRhythm.ts): товары покупателя, которого пробивает сам игрок, едут по ленте кассы к
// сканеру, и игрок «пикает» каждый касанием в такт. Здесь — только как это выглядит и где ловится касание.
// 13.11, автор: «Час пик глубже». Камера не трясётся. Касание считается по нажатию пальца (не по отпусканию —
// так точнее) по кассе или в любом пустом месте кадра: зона большая, палец не ищет цель. К сканеру товар
// ведёт сжимающийся круг — в миг, когда он сойдётся с рамкой, и надо жать. В лёгкой графике — без искр,
// вспышек и прыжков: товар, рамка, круг и надпись.

import Phaser from 'phaser';
import type { StoreScene } from './StoreScene';
import { ART, LIGHT_DEPTH, type Customer, type Register } from './common';
import { beltDone, beltTap, beltTick, GOOD_MS, nextItem, PERFECT_MS, RETURN_MS, rhythmAfter, startBelt, type Belt, type BeltEvent, type BeltPlan } from '../game/tillRhythm';
import { sound } from '../platform/sound';
import { haptic } from '../platform/telegram';
import { t } from '../i18n';
import { UI_FONT } from '../ui/dom';
import { popupScale } from './effects';
import * as motion from './motion';

/** Лента в мире: верх (валик у покупателя) и луч сканера — от середины кассы по высоте (art/sprites.py counter). */
const TOP_DY = -21;
const SCAN_DY = 3;
/** Сколько шагов товар виден на ленте до луча: видно и того, кто едет следующим. */
const LANE_BEATS = 2;
/** Товар на ленте чуть крупнее, чем в руках: на телефоне его должно быть видно. */
const ITEM_SCALE = 1.5 / ART;
/** Круг-подсказка сжимается к рамке за последний шаг до луча: с какого радиуса и до какого. */
const RING_FROM = 15;
const RING_TO = 6;

/** Лента, пока едет: правила (state) и её часы — для касаний и для проверок снаружи (scripts, e2e). */
export interface TillBelt {
  state: Belt;
  /**
   * Часы ленты, мс. Идут, только пока магазин не на паузе, и всегда в настоящем темпе: ×2 и спешка закрытия
   * их не торопят (ленту и не запускают на ×2 — shoppers.ts), иначе такт стал бы неловимым.
   */
  clock: number;
}

/**
 * Пробивка в ритме: первые plan.taps товаров корзины едут по ленте к сканеру. Обещание — когда все пробиты
 * (касанием или самим хозяином после второго промаха); false — мир перестроили, пробивка оборвалась.
 */
export function runBelt(scene: StoreScene, r: Register, c: Customer, plan: BeltPlan, clerk: Phaser.GameObjects.Container | undefined, hand: { x: number; y: number }): Promise<boolean> {
  return new Promise((done) => {
    const gen = scene.worldGen;
    const x = r.counter.x + 0.5;
    const top = r.counter.y + TOP_DY;
    const scanY = r.counter.y + SCAN_DY;
    const speed = (scanY - top) / (LANE_BEATS * plan.beat);
    const sprites = c.items.slice(0, plan.taps).map(({ id }) => scene.art(x, top, `item_${id}`).setScale(ITEM_SCALE).setDepth(r.counter.y + 22).setVisible(false));
    const frame = scene.art(x, scanY, 'belt_window').setDepth(LIGHT_DEPTH + 4);
    const ring = scene.add.circle(x, scanY, RING_FROM).setStrokeStyle(1, 0xfee761).setDepth(LIGHT_DEPTH + 5).setVisible(false);
    // Промахнувшийся товар летит назад к началу ленты — пока летит, его место считает не лента, а прыжок.
    const hopping = new Set<number>();
    const belt: TillBelt = { state: startBelt(sprites.length, plan.beat, 0), clock: 0 };
    let label: Phaser.GameObjects.Text | undefined;
    let hot = false;
    scene.belt = belt;

    // Надпись — над кассой, по центру: не закрывает ни ленту с товаром, ни голову покупателя; гаснет раньше,
    // чем над кассой встанет «Серия ×N» (effects.celebrateCombo — ещё выше).
    const say = (text: string, color: string, big = false) => {
      label?.destroy();
      const k = popupScale(scene);
      const y = r.counter.y + TOP_DY - 10;
      const l = scene.add
        .text(x, y, text, { fontFamily: UI_FONT, fontSize: big ? '10px' : '8px', fontStyle: 'bold', color, stroke: '#181425', strokeThickness: 3 })
        .setOrigin(0.5)
        .setResolution(scene.textRes(5))
        .setDepth(LIGHT_DEPTH + 7)
        .setScale(0.75 * k);
      label = l;
      scene.tweens.add({ targets: l, scale: k, duration: 140, ease: 'Back.easeOut' });
      scene.tweens.add({ targets: l, y: y - 6, alpha: 0, delay: 380, duration: 250, onComplete: () => l.destroy() });
    };

    /** Товар пробит: вспышка луча, «пик», товар — в руки тому, кто пробивает. */
    const scanned = (s: Phaser.GameObjects.Image, grade: 'perfect' | 'good' | 'auto') => {
      scene.tweens.killTweensOf(s);
      s.setVisible(true).setAlpha(1).setPosition(x, scanY);
      const flash = scene.add.rectangle(x, scanY + 1, 10, 3, 0xff4a4a).setBlendMode(Phaser.BlendModes.ADD).setDepth(1001);
      scene.tweens.add({ targets: flash, alpha: 0, scaleX: 1.6, duration: 160, onComplete: () => flash.destroy() });
      if (r.img) motion.squash(scene, r.img, 1.04, 0.94, 70);
      motion.beat(scene, clerk);
      motion.flashWhite(scene, s, grade === 'perfect' ? 80 : 40);
      scene.tweens.add({ targets: s, x: hand.x, y: hand.y - 8, scale: 1 / ART, alpha: 0.3, delay: 60, duration: 160, ease: 'Quad.easeIn', onComplete: () => s.destroy() });
      if (grade === 'auto') return sound.scan(x, 0);
      sound.beat(grade);
      if (grade === 'good') return haptic.tap();
      haptic.beat();
      const n = scene.rhythm;
      say(n >= 2 ? t('rhythm.perfectN', { n }) : t('rhythm.perfect'), '#fee761', true);
      if (scene.lite) return;
      const sparks = scene.add.particles(x, scanY, 'spark', {
        speed: { min: 14, max: 30 },
        lifespan: 380,
        scale: { start: 0.5, end: 0 },
        tint: [0xfee761, 0xffffff],
        emitting: false,
      });
      sparks.setDepth(LIGHT_DEPTH + 6).explode(6);
      scene.time.delayedCall(450, () => sparks.destroy());
    };

    /** Промах: товар отлетает к началу ленты и поедет ещё раз. */
    const again = (s: Phaser.GameObjects.Image, index: number) => {
      sound.beat('miss');
      say(t('rhythm.again'), '#c0cbdc');
      scene.tweens.killTweensOf(s);
      s.setVisible(true).setAlpha(1);
      if (scene.lite) {
        s.setPosition(x, top);
        return;
      }
      hopping.add(index);
      const fromY = s.y;
      scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: RETURN_MS,
        ease: 'Sine.easeInOut',
        onUpdate: (tw) => {
          const p = tw.getValue() ?? 0;
          if (s.active) s.setPosition(x - Math.sin(p * Math.PI) * 5, Phaser.Math.Linear(fromY, top, p) - Math.sin(p * Math.PI) * 4);
        },
        onComplete: () => hopping.delete(index),
      });
    };

    const apply = (ev: BeltEvent) => {
      const s = sprites[ev.index];
      scene.rhythm = rhythmAfter(scene.rhythm, ev.grade);
      if (ev.grade === 'miss') return s?.active && again(s, ev.index);
      // В счёт дня — каждый товар ленты один раз, когда он пробит (сколько бы раз ни проезжал).
      scene.stats.beats = (scene.stats.beats ?? 0) + 1;
      if (ev.grade === 'perfect') scene.stats.perfects = (scene.stats.perfects ?? 0) + 1;
      if (s?.active) scanned(s, ev.grade);
    };

    const finish = (ok: boolean) => {
      scene.events.off('update', onUpdate);
      scene.input.off('pointerdown', onDown);
      if (scene.belt === belt) scene.belt = undefined;
      frame.destroy();
      ring.destroy();
      // Пробитые товары долетают до рук сами; оборвалась пробивка (мир перестроили) — убрать всё.
      if (!ok) for (const s of sprites) s.destroy();
      done(ok);
    };

    function onDown(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
      if (!scene.running || scene.time.paused) return;
      const at = scene.cameras.main.getWorldPoint(p.x, p.y);
      // Нажали что-то своё (вора, мусор, полку) — это не касса. Сама касса — всегда касса.
      const onTill = Math.abs(at.x - (r.counter.x + 6)) <= 20 && Math.abs(at.y - (r.counter.y + 6)) <= 32;
      if (over.length && !onTill) return;
      const res = beltTap(belt.state, belt.clock);
      if (!res.event) return;
      belt.state = res.belt;
      // Круг под пальцем; по кассе его нарисует сам отклик касания (motion.tapFx).
      if (!over.length) motion.ripple(scene, at.x, at.y);
      apply(res.event);
      if (beltDone(belt.state)) finish(true);
    }

    function onUpdate(_time: number, delta: number): void {
      if (scene.worldGen !== gen || !scene.sys.isActive()) return finish(false);
      if (!scene.time.paused) belt.clock += Math.min(delta, 100);
      const tick = beltTick(belt.state, belt.clock);
      belt.state = tick.belt;
      tick.events.forEach(apply);
      if (beltDone(belt.state)) return finish(true);
      for (const item of belt.state.items) {
        const s = sprites[item.index];
        if (item.scanned || hopping.has(item.index) || !s?.active) continue;
        const y = scanY - (item.arrive - belt.clock) * speed;
        // Ещё в корзине (выше ленты) — не видно; вернувшийся после промаха ждёт у начала ленты.
        if (y < top && item.passes === 1) {
          s.setVisible(false);
          continue;
        }
        if (!s.visible) {
          s.setVisible(true).setAlpha(0);
          scene.tweens.add({ targets: s, alpha: 1, duration: 120 });
        }
        // Проехал окно — ещё чуть-чуть под лучом, пока лента не засчитает промах.
        s.setPosition(x, Phaser.Math.Clamp(y, top, scanY + 4));
      }
      const next = nextItem(belt.state);
      const dt = next ? next.arrive - belt.clock : Infinity;
      const show = next !== undefined && !hopping.has(next.index) && dt <= plan.beat && dt >= -GOOD_MS;
      ring.setVisible(show);
      if (show) {
        const k = Phaser.Math.Clamp(dt / plan.beat, 0, 1);
        ring.setRadius(RING_TO + (RING_FROM - RING_TO) * k).setStrokeStyle(1, Math.abs(dt) <= PERFECT_MS ? 0xffffff : 0xfee761, 0.4 + 0.6 * (1 - k));
      }
      const inWindow = show && Math.abs(dt) <= GOOD_MS;
      if (inWindow !== hot) {
        hot = inWindow;
        frame.setTexture(hot ? 'belt_window_hot' : 'belt_window');
      }
    }

    scene.events.on('update', onUpdate);
    scene.input.on('pointerdown', onDown);
  });
}
