// Окно «Сценки дня» (game/skits.ts): разговор по узлам — реплика героя с живым портретом и ответы кнопками (2–4),
// по ответам — следующая реплика, пока не придёт финал. Под ответом — что он стоит (деньги, товар); финал —
// заголовок («Лучший финал», «Не повезло»), последняя реплика и что принёс разговор. Пока окно открыто, магазин
// стоит (scenes/skitsFx.ts). Закрыть окно, не дойдя до конца, нельзя: у разговора всегда есть конец.

import { t, type TextKey } from '../i18n';
import { PRODUCTS } from '../game/economy';
import type { StoreState } from '../game/economy';
import { askedOnce, canPick, SKITS, skitPortrait, walkSkit, type SkitEffect, type SkitId, type SkitOption, type SkitTone } from '../game/skits';
import { haptic } from '../platform/telegram';
import { sound } from '../platform/sound';
import { dialogBox } from './dialog';
import { button, el, openModal } from './dom';

/** Голос героя (высота «пика», если банк слогов ещё не скачан). Его же — у эха сценки (ui/echoes.ts, scenes/echoesFx.ts). */
export const PITCH: Record<string, number> = {
  skit_tyoma: 760, skit_masha: 720, skit_karina: 640, skit_lyosha: 420, skit_ruslan: 380, skit_fyodor: 260,
  skit_galina: 600, skit_hoodie: 400, skit_painter: 300, skit_viktor: 340, police: 320, caller2: 620, caller4: 360,
};

/** Что стоит ответ: «нужно: 50 💰 · 🥛×1». */
function costLine(option: SkitOption): string | null {
  const e = option.effect;
  if (!e) return null;
  const parts: string[] = [];
  if (e.money && e.money < 0) parts.push(`${-e.money} 💰`);
  if (e.take) parts.push(`${PRODUCTS[e.take[0]].icon}×${e.take[1]}`);
  return parts.length ? t('skit.cost', { list: parts.join(' · ') }) : null;
}

/** Итог строчкой: «+300 💰 · ★ +0.10 · гостей +8% на 5 дн.» (и у эха — «гостей −5%…», ui/echoes.ts). */
export function gainLine(e: Pick<SkitEffect, 'money' | 'rating' | 'boost'>): string {
  const out: string[] = [];
  if (e.money) out.push(`${e.money > 0 ? '+' : '−'}${Math.abs(e.money)} 💰`);
  if (e.rating) out.push(`★ ${e.rating > 0 ? '+' : '−'}${Math.abs(e.rating).toFixed(2)}`);
  if (e.boost) out.push(t(e.boost[0] < 0 ? 'echo.drop' : 'skit.boost', { p: Math.round(Math.abs(e.boost[0]) * 100), d: e.boost[1] }));
  return out.join(' · ');
}

const TONE_CLASS: Record<SkitTone, string> = { great: 'ui-gift-reward', good: 'ui-gift-reward', ok: 'ui-note', bad: 'ui-note' };

/**
 * Показать сценку. finish(path) — разговор дошёл до финала: применить итог (вернуть его или null), done() — окно
 * закрыто, магазин можно отпускать; tone — каким вышел финал (для реакции гостя в зале).
 */
export function showSkit(
  id: SkitId,
  getState: () => StoreState,
  finish: (path: number[]) => { tone: SkitTone; effect: SkitEffect; echo?: unknown } | null,
  done: (tone: SkitTone | null) => void,
): void {
  const { card, close } = openModal();
  const skit = SKITS[id];
  const caption = t('skit.caption', { title: t(`skit.${id}.title` as TextKey) });
  const path: number[] = [];

  const show = () => {
    const walk = walkSkit(id, path);
    if (!walk) {
      close();
      done(null);
      return;
    }
    const node = skit.nodes[walk.node];
    const base = skit.cast[node.who] ?? skit.cast[skit.guest];
    const say = (rest: Partial<Parameters<typeof dialogBox>[0]>) =>
      dialogBox({
        caption,
        portrait: skitPortrait(id, node.who, node.mood),
        name: t(`skit.${id}.cast.${node.who}` as TextKey),
        text: `«${t(`skit.${id}.${walk.node}` as TextKey)}»`,
        pitch: PITCH[base] ?? 500,
        nextLabel: t('skit.next'),
        onNext: () => {},
        ...rest,
      });
    if (node.end) {
      const result = finish(path);
      const tone = result?.tone ?? node.end.tone;
      const gain = result ? gainLine(result.effect) : '';
      if (tone === 'great' || tone === 'good') haptic.success();
      card.replaceChildren(
        el('h2', '', t(`skit.tone.${tone}` as TextKey)),
        say({
          // Финал оставил эхо (game/echoes.ts) — намёк, что история ещё вернётся.
          after: [...(gain ? [el('div', TONE_CLASS[tone], gain)] : []), ...(result?.echo ? [el('div', 'ui-muted', t('echo.later'))] : [])],
          nextLabel: t('skit.back'),
          onNext: () => {
            close();
            done(tone);
          },
        }),
      );
      return;
    }
    const state = getState();
    const options = (node.options ?? []).map((option, i) => {
      const box = el('div', 'ui-skit-choice');
      const cost = costLine(option);
      // Уже выбирали — серая кнопка с галочкой: видно, кого допросил и что спросил. Заданный вопрос
      // («Где вы были?») второй раз не нажать; к подозреваемому вернуться можно — спросить другое.
      const seen = walk.picked.has(`${walk.node}:${i}`);
      const label = t(`skit.${id}.${walk.node}.${i}` as TextKey);
      box.append(
        button(
          seen ? `✓ ${label}` : label,
          () => {
            sound.tap();
            path.push(i);
            show();
          },
          seen ? 'ui-btn secondary ui-skit-seen' : 'ui-btn',
          !canPick(state, option) || (seen && askedOnce(id, walk.node, option)),
        ),
      );
      if (cost) box.append(el('div', 'ui-muted', cost));
      return box;
    });
    card.replaceChildren(say({ noNext: true, after: options }));
  };
  show();
}
