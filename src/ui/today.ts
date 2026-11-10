// «Задания» в HUD: маленькая фишка «🎯 1/3» рядом с целью дня; по нажатию — список с полосками и наградой
// (выполненные — галочкой) на несколько секунд. С 10.11 список один на всё: задания дня (game/endless.ts —
// награда сразу, как выполнил), шаг сезонной недели (game/weeks.ts) и испытания недели (game/weekly.ts) —
// раньше это были три разных места (фишка, карточка утра, полоска цели), и игрок держал в голове три дорожки.
// Правила и награды у каждой прежние: изменилось только то, что смотреть теперь в одно место.

import { t } from '../i18n';
import { PRODUCTS, type DayStats } from '../game/economy';
import type { ProductId, StoreState } from '../game/economy';
import { QUEST_TEXT, questDone, questGoal, questProgress, type Quest } from '../game/endless';
import { allTasks } from '../game/tasks';
import { WEEKLY_TEXT, weeklyUntil } from '../game/weekly';
import { WEEKS } from '../game/weeks';
import { el, pixelize, UI_FONT } from './dom';
import { goalText } from './weeks';
import { sound } from '../platform/sound';
import { haptic } from '../platform/telegram';

export interface QuestRow {
  text: string;
  progress: number;
  goal: number;
  reward: number;
  done: boolean;
  /** Заголовок перед строкой: с неё начинается новый раздел списка («Испытания недели — до дня 14»). */
  head?: string;
  /** Не задание дня (испытание недели): в счёт фишки «🎯 1/3» не идёт — она про сегодня. */
  week?: boolean;
}

/** Строки списка: текст задания, сколько сделано из скольких, награда. */
export function questRows(quests: Quest[], stats: DayStats): QuestRow[] {
  return quests.map((q) => {
    const product = q.product ? `${PRODUCTS[q.product].icon} ${t(PRODUCTS[q.product].nameKey)}` : '';
    const goal = questGoal(q);
    const done = Boolean(q.paid) || questDone(q, stats);
    return { text: t(QUEST_TEXT[q.kind], { n: q.target, product }), progress: done ? goal : Math.min(goal, questProgress(q, stats)), goal, reward: q.reward, done };
  });
}

/** Весь список заданий (game/tasks.ts) словами: сегодня — задания дня и шаг сезонной недели, ниже — испытания недели. */
export function allRows(state: StoreState, quests: Quest[], stats: DayStats): QuestRow[] {
  const product = (id?: ProductId): string => (id ? `${PRODUCTS[id].icon} ${t(PRODUCTS[id].nameKey)}` : '');
  let weekHead = false;
  return allTasks(state, quests, stats).map((task): QuestRow => {
    const base = { progress: task.progress, goal: task.goal, reward: task.reward, done: task.done };
    if (task.kind === 'quest') return { ...base, text: t(QUEST_TEXT[task.quest.kind], { n: task.quest.target, product: product(task.quest.product) }) };
    if (task.kind === 'step') return { ...base, text: `${WEEKS[task.step.id].icon} ${goalText(task.step)}` };
    const c = task.challenge;
    const head = weekHead ? undefined : t('weekly.title', { day: weeklyUntil(state) });
    weekHead = true;
    return { ...base, text: t(WEEKLY_TEXT[c.kind], { n: c.target, product: product(c.product) }), week: true, head };
  });
}

const css = `
.ui-goal-row { display: flex; align-items: center; justify-content: center; gap: 4px; max-width: 100%; }
.ui-quest-chip { pointer-events: auto; flex: 0 0 auto; background: rgba(24, 20, 37, .78); border: 1.5px solid rgba(254, 231, 97, .55);
  border-radius: 8px; padding: 2px 7px; margin: 0; font: 700 12.5px/1.35 ${UI_FONT}; color: #fee761; text-shadow: 0 1px 0 #000;
  cursor: pointer; -webkit-tap-highlight-color: transparent; white-space: nowrap; }
.ui-quest-chip[hidden], .ui-quest-list[hidden] { display: none; }
.ui-quest-chip:active { transform: translateY(1px); }
.ui-quest-chip.all { color: #c8ffb0; border-color: rgba(99, 199, 77, .8); }
.ui-quest-chip.pop { animation: ui-quest-pop .5s ease-out; }
@keyframes ui-quest-pop { 40% { transform: scale(1.25); box-shadow: 0 0 10px 3px rgba(254, 231, 97, .8); } }
.ui-quest-list { pointer-events: auto; width: min(100%, 320px); box-sizing: border-box; background: rgba(24, 20, 37, .92); border: 2px solid #fee761;
  border-radius: 8px; padding: 5px 8px 6px; text-align: left; font: 600 12.5px/1.3 ${UI_FONT}; color: #fff; }
.ui-quest-list b { display: block; color: #fee761; margin-bottom: 3px; }
.ui-quest-list b.ui-quest-head { margin-top: 7px; padding-top: 5px; border-top: 1px solid rgba(254, 231, 97, .35); }
.ui-quest-item { display: grid; grid-template-columns: 1fr auto; gap: 1px 8px; margin-top: 3px; align-items: start; }
/* Список живёт в строке склада (.ui-stock): её плашки у span здесь не нужны. */
.ui-stock .ui-quest-list span { background: none; padding: 0; border-radius: 0; white-space: normal; }
.ui-stock .ui-quest-list .ui-quest-reward { white-space: nowrap; }
.ui-quest-item.done { color: #c8ffb0; }
.ui-quest-item i { grid-column: 1 / -1; height: 4px; border-radius: 2px; background: rgba(255, 255, 255, .18); overflow: hidden; }
.ui-quest-item i u { display: block; height: 100%; background: #63c74d; text-decoration: none; }
.ui-quest-reward { color: #fee761; white-space: nowrap; }
`;

let styled = false;
function injectTodayStyles(): void {
  if (styled) return;
  styled = true;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
}

/** Фишка с числом выполненных и выпадающий список. */
export class QuestChip {
  readonly chip = el('button', 'ui-quest-chip');
  readonly list = el('div', 'ui-quest-list');
  private rows: QuestRow[] = [];
  private key = '';
  private done = -1;
  private timer = 0;

  constructor() {
    injectTodayStyles();
    this.chip.hidden = true;
    this.list.hidden = true;
    // Касание фишки и списка — не касание улицы под ними (там хозяин пробивает покупки).
    for (const node of [this.chip, this.list])
      for (const type of ['pointerdown', 'touchstart', 'mousedown'] as const) node.addEventListener(type, (e) => e.stopPropagation(), { passive: true });
    this.chip.addEventListener('click', () => this.toggle());
    this.list.addEventListener('click', () => this.hide());
  }

  /** Подпись фишки ('' — спрятать) и строки списка. Перерисовка — только когда что-то поменялось. */
  set(label: string, rows: QuestRow[]): void {
    const key = `${label}|${rows.map((r) => `${r.progress}/${r.goal}`).join()}`;
    if (key === this.key) return;
    this.key = key;
    this.rows = rows;
    this.chip.hidden = !label;
    if (!label) {
      this.hide();
      this.done = -1;
      return;
    }
    // Фишка — про сегодня: испытания недели в её счёт не идут (они копятся днями).
    const today = rows.filter((r) => !r.week);
    const done = today.filter((r) => r.done).length;
    this.chip.textContent = label;
    this.chip.classList.toggle('all', today.length > 0 && done === today.length);
    // Задание выполнено — фишка вспыхивает (в первый показ дня — нет).
    if (this.done >= 0 && done > this.done) {
      this.chip.classList.remove('pop');
      void this.chip.offsetWidth;
      this.chip.classList.add('pop');
    }
    this.done = done;
    pixelize(this.chip);
    if (!this.list.hidden) this.render();
  }

  private toggle(): void {
    haptic.tap();
    sound.tap();
    if (!this.list.hidden) return this.hide();
    this.render();
    this.list.hidden = false;
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.hide(), this.rows.some((r) => r.week) ? 9000 : 6000);
  }

  private hide(): void {
    clearTimeout(this.timer);
    this.list.hidden = true;
  }

  private render(): void {
    const today = this.rows.filter((r) => !r.week);
    const all = today.length > 0 && today.every((r) => r.done);
    const items = this.rows.flatMap((r) => {
      const row = el('div', `ui-quest-item${r.done ? ' done' : ''}`);
      const bar = el('i');
      const fill = el('u');
      fill.style.width = `${Math.round((100 * r.progress) / Math.max(1, r.goal))}%`;
      bar.append(fill);
      row.append(el('span', '', `${r.done ? '✅' : '•'} ${r.text}`), el('span', 'ui-quest-reward', `+${r.reward} 💰`));
      if (!r.done && r.goal > 1) row.append(bar);
      return r.head ? [el('b', 'ui-quest-head', r.head), row] : [row];
    });
    this.list.replaceChildren(el('b', '', all ? t('quest.allDone') : t('quest.listTitle')), ...items);
    pixelize(this.list);
  }
}
