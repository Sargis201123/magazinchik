// Окно «Сценки дня» (game/skits.ts): две реплики гостя с живым портретом, выбор ответа и его реплика в ответ.
// Пока окно открыто, магазин стоит (scenes/skitsFx.ts). Под вариантами — что нужно отдать (деньги, товар);
// что принесёт выбор — видно уже после: монетки, звёзды, гости на несколько дней, «продолжение следует».

import { t, type TextKey } from '../i18n';
import { PRODUCTS } from '../game/economy';
import type { StoreState } from '../game/economy';
import { canAnswer, SKITS, skitPortrait, type SkitChoice, type SkitId } from '../game/skits';
import { haptic } from '../platform/telegram';
import { sound } from '../platform/sound';
import { dialogBox } from './dialog';
import { button, el, openModal } from './dom';

/** Голос героя сценки (высота «пика», если банк слогов ещё не скачан). */
const PITCH: Record<SkitId, number> = { puppy: 760, wallet: 260, pies: 420, gift: 720, blogger: 640, rain: 380 };

const key = (id: SkitId, ep: number, rest: string): TextKey => `skit.${id}.${ep}.${rest}` as TextKey;

/** Что нужно отдать за вариант: «−150 💰», «🥛×1». */
function costLine(choice: SkitChoice): string | null {
  const parts: string[] = [];
  if (choice.effect.money && choice.effect.money < 0) parts.push(`${-choice.effect.money} 💰`);
  if (choice.effect.take) parts.push(`${PRODUCTS[choice.effect.take[0]].icon}×${choice.effect.take[1]}`);
  return parts.length ? t('skit.cost', { list: parts.join(' · ') }) : null;
}

/** Что принёс выбор — строчками под ответом гостя. */
function gainLines(choice: SkitChoice): HTMLElement[] {
  const e = choice.effect;
  const out: string[] = [];
  if (e.money && e.money > 0) out.push(`+${e.money} 💰`);
  if (e.rating) out.push(`★ +${e.rating.toFixed(2)}`);
  if (e.boost) out.push(t('skit.boost', { p: Math.round(e.boost[0] * 100), d: e.boost[1] }));
  const lines = out.length ? [el('div', 'ui-gift-reward', out.join(' · '))] : [];
  if (choice.next) lines.push(el('div', 'ui-note', t('skit.more')));
  return lines;
}

/**
 * Показать сценку. answer(i) применяет выбор и возвращает новое состояние (null — нельзя); done() — окно закрыто,
 * магазин можно отпускать. Закрыть окно, не ответив, нельзя: у разговора всегда есть конец.
 */
export function showSkit(id: SkitId, ep: number, getState: () => StoreState, answer: (index: number) => StoreState | null, done: (index: number | null) => void): void {
  const { card, close } = openModal();
  const skit = SKITS[id];
  const episode = skit.episodes[ep];
  const name = t(`skit.${id}.name` as TextKey);
  const say = (mood: (typeof episode.moods)[number], text: string, rest: Partial<Parameters<typeof dialogBox>[0]>) =>
    dialogBox({ caption: t('skit.caption'), portrait: skitPortrait(id, mood), name, text: `«${text}»`, pitch: PITCH[id], nextLabel: t('skit.next'), onNext: () => {}, ...rest });

  const finish = (index: number) => {
    const choice = episode.choices[index];
    card.replaceChildren(
      say(choice.mood, t(key(id, ep, `${index === 0 ? 'a' : 'b'}.reply`)), {
        after: gainLines(choice),
        nextLabel: t('skit.back'),
        onNext: () => {
          close();
          done(index);
        },
      }),
    );
  };

  const ask = () => {
    const state = getState();
    const options = episode.choices.map((choice, i) => {
      const box = el('div', 'ui-skit-choice');
      const cost = costLine(choice);
      box.append(
        button(
          t(key(id, ep, i === 0 ? 'a' : 'b')),
          () => {
            if (!answer(i)) return;
            haptic.success();
            sound.tap();
            finish(i);
          },
          'ui-btn',
          !canAnswer(state, choice),
        ),
      );
      if (cost) box.append(el('div', 'ui-muted', cost));
      return box;
    });
    card.replaceChildren(say(episode.moods[1], t(key(id, ep, 'line2')), { noNext: true, after: options }));
  };

  card.append(say(episode.moods[0], t(key(id, ep, 'line1')), { onNext: ask }));
}
