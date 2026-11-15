// Моменты этажей в течение дня (правила — game/floorLife.ts, 15.11). Здесь — только расписание и «кто ждёт»: момент
// начинается в свою секунду дня и ждёт игрока FLOOR_MOMENT_WAIT секунд дня, где бы тот ни был. На этаже его рисует
// вид этажа (floors/momentFx.ts — грузится вместе с ним), в зале — светится кнопка этажа в переключателе слева
// (nav.syncSwitch), как кнопка «Зал», когда зовёт зал. Не успел — момент тихо проходит, без штрафа.
//
// Модуль — в первом файле игры (его зовёт переключатель каждый кадр): держим его маленьким.

import type { StoreScene } from '../StoreScene';
import { DAY_SECONDS } from '../../game/economy';
import { catchFloorMoment, FLOOR_MOMENT_WAIT, noteFloorMoment, type FloorMoment } from '../../game/floorLife';

let plan: FloorMoment[] = [];
/** Что ждёт игрока сейчас и до какой секунды дня. */
let live: { m: FloorMoment; until: number } | null = null;
/** Кто слушает смену момента (вид этажа): начался, пойман, прошёл. */
const listeners = new Set<() => void>();
const notify = (): void => listeners.forEach((fn) => fn());

/** Утро: расписание на день (уже урезанное бюджетом внимания). */
export function startFloorLife(list: FloorMoment[]): void {
  plan = [...list].sort((a, b) => a.at - b.at);
  live = null;
  notify();
}

/** Конец дня: ждущий момент не пойман, расписание прочь. */
export function stopFloorLife(scene: StoreScene): void {
  if (live) noteFloorMoment(scene.stats, false);
  plan = [];
  live = null;
  notify();
}

/** Каждый кадр (из переключателя этажей): пора — начать, прошло окно — тихо убрать. */
export function tickFloorLife(scene: StoreScene): void {
  // 15.11, ревью: ночью дневной момент не живёт — если вдруг дожил до ночной смены, гасим его как не пойманный
  // (иначе кнопка этажа светилась бы всю ночь, а касание платило бы ночью).
  if (scene.night && live) {
    noteFloorMoment(scene.stats, false);
    live = null;
    plan = [];
    notify();
  }
  if (!scene.running || scene.night) return;
  const elapsed = DAY_SECONDS - scene.timeLeft;
  if (live && elapsed > live.until) {
    noteFloorMoment(scene.stats, false);
    live = null;
    notify();
  }
  if (!live && plan[0] && elapsed >= plan[0].at) {
    const m = plan.shift()!;
    // Опоздали (день стоял на паузе дольше окна) — не начинаем.
    if (elapsed - m.at < FLOOR_MOMENT_WAIT) {
      // Окно не длиннее дня: момент в конце дня ждёт только до закрытия (кольцо-таймер честно короче).
      live = { m, until: Math.min(m.at + FLOOR_MOMENT_WAIT, DAY_SECONDS) };
      notify();
    }
  }
}

/** Какой момент ждёт сейчас (null — никакой). */
export const floorWaiting = (): FloorMoment | null => live?.m ?? null;

/** Сколько ещё ждёт: доля окна от 1 до 0 (для кольца-таймера на этаже). */
export function floorLeft(scene: StoreScene): number {
  if (!live) return 0;
  return Math.max(0, Math.min(1, (live.until - (DAY_SECONDS - scene.timeLeft)) / FLOOR_MOMENT_WAIT));
}

/** Игрок нажал: награда и учёт; вернуть деньги и искорку (null — момент уже прошёл). */
export function takeFloorMoment(scene: StoreScene): { money: number; star: boolean } | null {
  if (!live) return null;
  const caught = catchFloorMoment(scene.state, scene.stats, live.m.kind);
  scene.state = caught.state;
  live = null;
  notify();
  return caught.gain;
}

/** Подписаться на смену момента; вернуть отписку. */
export function onFloorLife(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
