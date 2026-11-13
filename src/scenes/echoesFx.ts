// «Эхо решений» в зале (game/echoes.ts): иногда герой давней сценки приходит сам. Тёма — с подросшим Бубликом
// на поводке, сержант — с грамотой, Лёша — с подносом пирожков, Маша — с открыткой от класса. Встаёт у кассы,
// над ним «!» — нажми, и он скажет своё (магазин на паузе, пока окно открыто). Не нажал — он всё равно
// оставит, с чем пришёл, и уйдёт: эхо не теряется. Такой гость занимает место особого гостя дня в бюджете
// внимания (game/attention.ts) — день не перегружен. Карточка утра и строка сводки — ui/echoes.ts.

import type { StoreScene } from './StoreScene';
import { t } from '../i18n';
import { answerEcho, ECHOES, echoChoices, echoVisitToday, type EchoEntry, type EchoId } from '../game/echoes';
import { SKITS } from '../game/skits';
import { sound } from '../platform/sound';
import { haptic } from '../platform/telegram';
import { dialogBox } from '../ui/dialog';
import { el, openModal, UI_FONT } from '../ui/dom';
import { echoTexts } from '../ui/echoes';
import { gainLine, PITCH } from '../ui/skits';
import { randomLook, type Look } from './common';
import { hold, LOOK } from './skitsFx';
import * as camera from './camera';
import * as effects from './effects';
import * as persons from './persons';
import * as visitors from './visitors';

/** Сколько гость ждёт касания (мс), потом говорит своё сам. */
const ECHO_WAIT = 16000;

/** Как одет гость-эхо: как в своей сценке, и с тем, что принёс. */
const VISIT_LOOK: Partial<Record<EchoId, () => Look>> = {
  galina: () => ({ ...LOOK.robbery(), prop: 'basket' }),
  // Бублик подрос: рыжий, на поводке; пока Тёма в зале — сидит привязанный у входа.
  bublik: () => ({ ...LOOK.puppy(), dog: 0xe4a672 }),
  sergeant: () => ({ ...randomLook(0x262b44), outfit: 'police', hat: 'policecap', pants: 0x262b44, hair: 0x4a2c1a, style: 'short', skin: 0xeec39a }),
  bakery: () => LOOK.pies(),
  classTrip: () => LOOK.gift(),
  sequel: () => LOOK.blogger(),
  couriers: () => LOOK.rain(),
};

/** Утро: придёт ли сегодня эхо лично (тогда — вместо особого гостя). В день сценки — нет: хватит одного разговора. */
export function echoToday(scene: StoreScene): EchoEntry | null {
  return scene.skit ? null : echoVisitToday(scene.state);
}

/** Гость-эхо: заходит к кассе, ждёт касания, говорит своё и уходит. */
export async function runEchoVisit(scene: StoreScene, entry: EchoEntry): Promise<void> {
  const d = ECHOES[entry.id];
  const { door, sellerHome } = scene.layout;
  const world = scene.worldGen;
  const start = visitors.streetSpawn(scene);
  const guest = persons.makePerson(scene, start.x, start.y, (VISIT_LOOK[entry.id] ?? (() => (d.skit ? LOOK[d.skit]() : randomLook(0x5a6988))))());
  // Что принёс — в руках (art/echoes.py).
  if (d.item) guest.add(scene.art(5, 2, d.item));
  const alive = () => guest.active && scene.worldGen === world;
  await persons.walkVia(scene, guest, [
    { x: door.x, y: scene.streetY },
    { x: door.x, y: door.y - 10 },
    { x: sellerHome.x - 30, y: sellerHome.y - 16 },
  ]);
  if (!alive() || !scene.running) {
    if (guest.active) guest.destroy();
    return;
  }
  persons.setFacing(guest, 'right');
  scene.speak(guest, 20, t('echo.hello'));
  // «!» над головой — как у особого гостя; в лёгкой графике не прыгает.
  const mark = scene.add.text(0, -24, '!', { fontFamily: UI_FONT, fontSize: '10px', color: '#fee761', stroke: '#181425', strokeThickness: 3 }).setOrigin(0.5).setResolution(scene.textRes(4));
  guest.add(mark);
  const blink = scene.lite ? null : scene.tweens.add({ targets: mark, y: -27, duration: 400, yoyo: true, repeat: -1 });
  const effect = echoChoices(scene.state, entry.id)[0]?.effect ?? {};
  const hit = scene.add.zone(guest.x, guest.y - 6, 22, 30).setInteractive({ useHandCursor: true }).setDepth(2000);
  await new Promise<void>((done) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      done();
    };
    hit.on('pointerup', () =>
      camera.tap(scene, () => {
        if (settled || !scene.running) return;
        settled = true;
        haptic.tap();
        talk(scene, entry, gainLine(effect), done);
      }),
    );
    scene.time.delayedCall(ECHO_WAIT, finish);
  });
  hit.destroy();
  blink?.stop();
  mark.destroy();
  if (!alive()) return;
  // День уже кончился, пока гость ждал, — эхо придёт в другой раз (или новостью утра).
  if (scene.dayOpen) {
    const next = answerEcho(scene.state, entry.id, 0);
    if (next) {
      scene.state = next;
      scene.hud.update(scene.state, scene.timeLeft);
      if (effect.money) {
        sound.coin(guest.x);
        scene.popup(guest.x, guest.y - 18, `+${effect.money} 💰`, '#c8ffb0');
      }
      const rest = gainLine({ rating: effect.rating, boost: effect.boost });
      if (rest) scene.time.delayedCall(500, () => guest.active && scene.popup(guest.x, guest.y - 26, rest, '#fee761'));
    }
  }
  effects.emote(scene, guest, 'emo_heart');
  await scene.wait(1200);
  if (!alive()) return;
  await persons.walk(scene, guest, door.x, door.y - 10);
  await visitors.strollAway(scene, guest);
}

/** Разговор с гостем-эхом: портрет, его слова и что это принесло; магазин стоит, пока окно открыто. */
function talk(scene: StoreScene, entry: EchoEntry, gain: string, done: () => void): void {
  const d = ECHOES[entry.id];
  const { head, name, text, portrait } = echoTexts(entry);
  hold(scene, true);
  const { card, close } = openModal();
  card.append(
    dialogBox({
      caption: head,
      portrait,
      name,
      text: `«${text}»`,
      pitch: PITCH[(d.skit && SKITS[d.skit].cast[d.who]) || d.who] ?? 500,
      after: gain ? [el('div', 'ui-gift-reward', gain)] : [],
      nextLabel: t('skit.back'),
      onNext: () => {
        close();
        hold(scene, false);
        done();
      },
    }),
  );
}
