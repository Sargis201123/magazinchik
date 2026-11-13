// Лотерея у кассы в зале (game/lottery.ts, 13.11): стойка «ЛОТО» слева от стойки со сладостями, билет летит
// с неё в руки стоящему в очереди, проигравшие ворчат, в «счастливые» дни — надеются; на следующий день после
// крупного выигрыша заходит счастливчик с букетом и оставляет на прилавке торт. Кто возьмёт билет и кто
// заворчит — живые случайности зала (как шоколадка у кассы); тираж и запреты решает game/lottery.ts.

import type { StoreScene } from './StoreScene';
import Phaser from 'phaser';
import { t, type TextKey } from '../i18n';
import { sound } from '../platform/sound';
import { DAY_SECONDS } from '../game/economy';
import { inZar } from '../game/zarshop';
import { note } from '../game/reviews';
import { GRUMBLE_CHANCE, hasLottery, lotteryLook, luckyLeft, luckyOn, ticketChance, TICKET_CUT, winnerVisitToday, type LotteryLook } from '../game/lottery';
import { ART, randomLook, type Customer } from './common';
import * as effects from './effects';
import * as persons from './persons';
import * as camera from './camera';
import { runVisitor } from './visitors';

const TEXTURE: Record<Exclude<LotteryLook, 'none'>, string> = { open: 'lottery_stand', closed: 'lottery_stand_closed', lucky: 'lottery_stand_lucky' };
/** Сколько реплик у ворчащих (lottery.grumble.N). */
const GRUMBLES = 3;

/** Стойка этого зала (перестройка зала ставит новую) и торт счастливчика на прилавке. */
let stand: Phaser.GameObjects.Image | undefined;
let cake: Phaser.GameObjects.Image | undefined;
/** Сколько билетов было продано к открытию — для подсказки при касании стойки. */
let soldAtOpen = 0;

/**
 * Где стойка: слева от сладостей под кассой, низом на полу (сладости — counter.y + 39 серединой). Чуть ниже
 * сладостей: вывеска не упирается в ноги того, кого сейчас пробивают (он стоит на counter.y + 16).
 */
const standAt = (scene: StoreScene) => ({ x: scene.layout.counter.x - 14, y: scene.layout.counter.y + 48 });

/** Поставить стойку при постройке зала (decorations.buildUpgrades). В Заречье её нет — она в Центре. */
export function buildStand(scene: StoreScene): void {
  stand = undefined;
  const look = lotteryLook(scene.state);
  if (look === 'none' || inZar(scene.state)) return;
  const at = standAt(scene);
  stand = scene.art(at.x, at.y, TEXTURE[look]).setOrigin(0.5, 1).setDepth(at.y);
  // Уходящие от кассы к двери обходят её.
  scene.obstacles.push({ x: at.x - 7, y: at.y - 9, w: 14, h: 10 });
  const img = stand;
  img.setInteractive({ useHandCursor: true }).on('pointerup', () =>
    camera.tap(scene, () => {
      sound.tap();
      scene.tweens.add({ targets: img, scaleY: img.scaleY * 1.06, duration: 90, yoyo: true });
      scene.popup(img.x, img.y - 28, standLine(scene), '#fee761');
    }),
  );
  // «Счастливая» стойка поблёскивает звездой (в лёгкой графике — нет).
  if (look === 'lucky' && !scene.lite) {
    const glint = scene.add.rectangle(at.x, at.y - 22.5, 1, 1, 0xffffff).setDepth(at.y + 1).setAlpha(0);
    scene.tweens.add({ targets: glint, alpha: { from: 0, to: 1 }, scale: { from: 1, to: 2.5 }, duration: 320, yoyo: true, repeat: -1, repeatDelay: 1800 });
  }
}

/** Что сказать при касании стойки: запрет, «счастливые» дни или сколько билетов взяли сегодня. */
function standLine(scene: StoreScene): string {
  const look = lotteryLook(scene.state);
  if (look === 'closed') return t('lottery.popup.closed', { d: scene.state.lottery?.ban?.until ?? scene.state.day });
  const today = Math.max(0, (scene.state.lottery?.sold ?? 0) - soldAtOpen);
  return look === 'lucky' ? t('lottery.popup.lucky', { n: luckyLeft(scene.state) }) : t('lottery.popup.today', { n: today });
}

/**
 * Утро перед открытием (morningFlow.prepareDay): стойка — по сегодняшнему виду (за ночь мог начаться запрет
 * или «счастливые» дни), вчерашний торт убирают, счастливчик придёт в первой трети дня.
 */
export function morning(scene: StoreScene): void {
  cake?.destroy();
  cake = undefined;
  soldAtOpen = scene.state.lottery?.sold ?? 0;
  if (!hasLottery(scene.state) || inZar(scene.state)) return;
  const look = lotteryLook(scene.state);
  if (stand?.active && look !== 'none') stand.setTexture(TEXTURE[look]);
  if (stand?.active && look !== 'open') {
    const img = stand;
    scene.time.delayedCall(1800, () => scene.running && img.active && scene.popup(img.x, img.y - 28, standLine(scene), look === 'closed' ? '#ffd0d0' : '#fee761'));
  }
  if (winnerVisitToday(scene.state)) {
    scene.time.delayedCall(Phaser.Math.FloatBetween(0.15, 0.3) * DAY_SECONDS * 1000, () => scene.running && void runWinner(scene));
  }
}

/**
 * Встал в очередь — может взять билет со стойки (shoppers.ts, рядом со шоколадкой). Билет оплачивается на кассе
 * вместе с покупками; ушёл не заплатив — билет остаётся на стойке (доля магазина только с оплаченных).
 */
export function maybeTicket(scene: StoreScene, c: Customer): void {
  if (!stand?.active || Math.random() >= ticketChance(scene.state)) return;
  c.extras = [...(c.extras ?? []), { kind: 'ticket', price: TICKET_CUT }];
  const from = { x: stand.x, y: stand.y - 16 };
  const ticket = scene.art(from.x, from.y, 'lottery_ticket').setDepth(1000);
  scene.tweens.add({
    targets: ticket,
    x: c.sprite.x + 4,
    y: c.sprite.y - 3,
    angle: Phaser.Math.Between(-30, 30),
    duration: 460,
    ease: 'Quad.easeOut',
    onComplete: () => {
      ticket.destroy();
      sound.place('paper', 2, c.sprite.x);
      if (!c.sprite.active || c.gone) return;
      scene.popup(c.sprite.x, c.sprite.y - 18, t('lottery.popup.ticket', { n: TICKET_CUT }), '#fff3b0');
      react(scene, c);
    },
  });
}

/** Взял билет и вспомнил вчерашний тираж: в «счастливые» дни надеется, в обычные иногда ворчит (в отзывы — тоже). */
function react(scene: StoreScene, c: Customer): void {
  const lucky = luckyOn(scene.state);
  if (Math.random() >= (lucky ? 0.35 : GRUMBLE_CHANCE)) return;
  scene.time.delayedCall(700, () => {
    if (!c.sprite.active || c.gone) return;
    if (lucky) {
      scene.speak(c.sprite, 18, t('lottery.hope'));
      effects.emote(scene, c.sprite, 'emo_star');
      return;
    }
    note(scene.stats, 'lottery');
    scene.speak(c.sprite, 18, t(`lottery.grumble.${Phaser.Math.Between(0, GRUMBLES - 1)}` as TextKey));
    effects.emote(scene, c.sprite, 'emo_sigh');
    persons.setMood(scene, c.sprite, 'frown', 2500);
  });
}

/** Счастливчик: заходит с букетом, благодарит у кассы и оставляет торт на прилавке до вечера. */
async function runWinner(scene: StoreScene): Promise<void> {
  const look = { ...randomLook(Phaser.Utils.Array.GetRandom([0xe43b44, 0x0099db, 0xfeae34])), prop: 'bouquet' as const, propTint: 0xf6757a };
  await runVisitor(scene, look, t('lottery.winner'), false, () => {
    const { counter } = scene.layout;
    cake?.destroy();
    cake = scene.art(counter.x - 1, counter.y + 13, 'lottery_cake').setOrigin(0.5, 1).setDepth(counter.y + 23);
    sound.coin(counter.x);
    if (!scene.lite) {
      const img = cake;
      img.setScale(0);
      scene.tweens.add({ targets: img, scale: 1 / ART, duration: 280, ease: 'Back.easeOut' });
      persons.everyoneLooks(scene, counter.x, counter.y, 'emo_heart', 0.3);
    }
  });
}
