// Район подстраивается (13.11, автор: «что откроется на свободных местах — зависит от того, что магазин
// много продаёт»). Ночью накануне стройки на участке (district.ts PLOTS) район смотрит отчёт за неделю
// (reports.ts): какой товар у нас берут заметно чаще среднего — под того и строят. Много воды и сока —
// спортзал, цветов и медовика — свадебный салон, кофе и булочек — коворкинг. Новые соседи покупают
// как раз это: продажи растут там, где магазин и так силён.
//
// Решение детерминированное: по продажам, при равенстве — по seed и дню (как catFind в cat.ts).
// Решённое пишется в сохранение (state.district.plots) и потом не меняется.

import type { ProductId, StoreState } from './economy';
import { BUILDINGS, FIXED, PLOTS, type BuildingId, type PlotPick } from './district';

/** «Свой» товар здания: что продаётся — то и приводит. 'coffee' — стаканчики из кофейного уголка. */
export type Driver = ProductId | 'coffee';

/** Кандидаты на участки и их товары. Порядок — для равенства без seed (не бывает) и для текстов. */
export const DRIVERS: Partial<Record<BuildingId, Driver[]>> = {
  gym: ['water', 'juice', 'kvass'],
  wedding: ['flowers', 'honeycake'],
  cowork: ['coffee', 'buns', 'pies'],
  kids: ['icecream', 'jam', 'juice'],
  canteen: ['meat', 'potatoes', 'pickles'],
  dorm: ['dumplings', 'pelmeni', 'soap'],
  clinic: ['apples', 'milk', 'tangerines'],
};
export const CANDIDATES = Object.keys(DRIVERS) as BuildingId[];

/** Сколько дней до стройки утро предупреждает: «что будет — решат продажи». */
export const PLOT_HINT_DAYS = 7;

/** Продано за последние дни отчёта в Центре (дни в Заречье — не про наш район). */
export function weekSold(state: StoreState): { sold: Partial<Record<Driver, number>>; days: number } {
  const rows = (state.reports ?? []).filter((r) => !r.zar);
  const sold: Partial<Record<Driver, number>> = {};
  for (const r of rows) {
    for (const [id, n] of Object.entries(r.sold) as [ProductId, number][]) sold[id] = (sold[id] ?? 0) + n;
    if (r.coffees) sold.coffee = (sold.coffee ?? 0) + r.coffees;
  }
  return { sold, days: rows.length };
}

/** Хеш seed и дня для равенства очков: одинаковый у одного магазина, разный у разных. */
const tieBreak = (state: StoreState, n: number): number => {
  let h = ((state.seed ?? 1) * 2654435761 + state.day * 40503 + n * 9176) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
  return (h ^ (h >>> 13)) >>> 0;
};

/**
 * Очки кандидата: насколько его товары продаются чаще среднего товара магазина (среднее двух лучших
 * из «своих»). Средний — по товарам, что вообще продавались: свежий магазин с тремя товарами не
 * проигрывает из-за того, чего у него нет. Кофе меряем той же меркой, что и товар.
 */
export function plotScores(state: StoreState): { id: BuildingId; score: number }[] {
  const { sold } = weekSold(state);
  const products = Object.entries(sold).filter(([id, n]) => id !== 'coffee' && n > 0);
  const mean = products.length ? products.reduce((sum, [, n]) => sum + n, 0) / products.length : 0;
  // Занятые — по расписанию и уже решённые участки (не «старое здание по умолчанию»: этот участок и решаем).
  const taken = new Set<BuildingId>([...FIXED, ...(state.district?.plots ?? []).map((p) => p.id)]);
  return CANDIDATES.filter((id) => !taken.has(id) && state.day >= BUILDINGS[id].from).map((id) => {
    const idx = DRIVERS[id]!.map((d) => (mean ? (sold[d] ?? 0) / mean : 0)).sort((a, b) => b - a);
    const top = idx.slice(0, 2);
    return { id, score: Math.round((top.reduce((a, b) => a + b, 0) / top.length) * 1000) / 1000 };
  });
}

/** Что строить на участке сегодня: больше очков — тот; при равенстве решает seed. */
export function pickForPlot(state: StoreState): PlotPick | null {
  const scores = plotScores(state);
  if (!scores.length) return null;
  const order = (id: BuildingId) => tieBreak(state, CANDIDATES.indexOf(id));
  const best = [...scores].sort((a, b) => b.score - a.score || order(a.id) - order(b.id))[0].id;
  const { sold } = weekSold(state);
  const mine: Record<string, number> = {};
  for (const d of DRIVERS[best]!) mine[d] = sold[d] ?? 0;
  return { id: best, from: state.day, sold: mine };
}

/**
 * Ночью (state.day — уже завтрашний день): участок, на котором завтра начинают стройку, получает здание.
 * По продажам — одно за ночь. Старое сохранение, где по старому расписанию стройка шла раньше, — старое здание.
 */
export function districtNight(state: StoreState): StoreState {
  const district = state.district ?? { seen: [] };
  const plots = [...(district.plots ?? [])];
  let changed = false;
  for (let i = plots.length; i < PLOTS.length; i++) {
    const plot = PLOTS[i];
    if (state.day < plot.from) break;
    if (plot.legacy && state.day > plot.from) {
      plots.push({ id: plot.legacy, from: plot.from });
      changed = true;
      continue;
    }
    const pick = pickForPlot({ ...state, district: { ...district, plots } });
    if (!pick) break;
    plots.push(pick);
    changed = true;
    break;
  }
  return changed ? { ...state, district: { ...district, plots } } : state;
}

/** Утренняя новость: на участке начали стройку по нашим продажам, а о ней ещё не рассказали. */
export function plotNews(state: StoreState): { index: number; pick: PlotPick } | null {
  const plots = state.district?.plots ?? [];
  const index = plots.findIndex((p) => p.sold && !p.told && state.day >= p.from && state.day < p.from + BUILDINGS[p.id].build);
  return index >= 0 ? { index, pick: plots[index] } : null;
}

export function seePlotNews(state: StoreState): StoreState {
  const news = plotNews(state);
  if (!news) return state;
  const plots = state.district!.plots!.map((p, i) => (i === news.index ? { ...p, told: true } : p));
  return { ...state, district: { ...state.district!, plots } };
}

/** Чьё это здание по продажам (для карточки открытия): решение участка, если выбирали по продажам. */
export const plotPickOf = (state: StoreState, id: BuildingId): PlotPick | null => state.district?.plots?.find((p) => p.id === id && p.sold) ?? null;

/** Через сколько дней следующий участок: утро заранее говорит, что его застроят по продажам. */
export function plotSoon(state: StoreState): number | null {
  const next = PLOTS[state.district?.plots?.length ?? 0];
  if (!next || (next.legacy && state.day >= next.from)) return null;
  const days = next.from - state.day;
  return days > 0 && days <= PLOT_HINT_DAYS ? days : null;
}
