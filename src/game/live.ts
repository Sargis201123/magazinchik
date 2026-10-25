// Мини-события дня: гаснет свет, течёт труба, в зал залетает голубь, курьер ошибся дверью, на складе
// мышь. Раньше случались в каждый второй день и наугад (бывало, голубь три дня подряд, а мыши месяц нет).
// Теперь — почти каждый день, иногда два, и по очереди: недавнее не повторяется. В особый день — реже
// (там своё событие), а в большие беды (ограбление, землетрясение, наводнение, блэкаут) — не бывают.

import type { StoreState } from './economy';
import { bigDayFor, type BigDayId } from './bigday';

export const LIVE_KINDS = ['blackout', 'leak', 'pigeon', 'courier', 'mouse'] as const;
export type LiveKind = (typeof LIVE_KINDS)[number];

/** С какого дня (обучение позади). */
export const LIVE_FROM_DAY = 4;
/** Шанс события в обычный день и второго — в тот же день. */
export const LIVE_CHANCE = 0.85;
export const LIVE_SECOND_CHANCE = 0.3;
/** В особый день (не беду) — только одно и реже. */
export const LIVE_BIG_DAY_CHANCE = 0.35;
/** Сколько последних событий не повторяется. */
export const LIVE_REPEAT = 3;
/** Особые дни, в которые мини-событий нет: и так хватает. */
const BIG_QUIET: BigDayId[] = ['robbery', 'quake', 'flood', 'blackout', 'epidemic'];
/** В особый день не повторяем его же маленькой копией. */
const SAME: Partial<Record<BigDayId, LiveKind>> = { pigeons: 'pigeon' };

/**
 * Какие мини-события будут сегодня (по порядку) и обновлённая очередь недавних (state.liveRecent).
 * random — от 0 до 1 (Math.random в игре, свой генератор в проверках).
 */
export function liveEventsFor(state: StoreState, random: () => number): { kinds: LiveKind[]; state: StoreState } {
  if (state.day < LIVE_FROM_DAY) return { kinds: [], state };
  const big = bigDayFor(state.day);
  if (big && BIG_QUIET.includes(big)) return { kinds: [], state };
  const count = big ? (random() < LIVE_BIG_DAY_CHANCE ? 1 : 0) : random() < LIVE_CHANCE ? (random() < LIVE_SECOND_CHANCE ? 2 : 1) : 0;
  const recent = [...(state.liveRecent ?? [])];
  const kinds: LiveKind[] = [];
  for (let i = 0; i < count; i++) {
    const free = LIVE_KINDS.filter((k) => !recent.slice(-LIVE_REPEAT).includes(k) && k !== (big && SAME[big]));
    const kind = free[Math.floor(random() * free.length)];
    if (!kind) break;
    kinds.push(kind);
    recent.push(kind);
  }
  return { kinds, state: kinds.length ? { ...state, liveRecent: recent.slice(-LIVE_REPEAT) } : state };
}
