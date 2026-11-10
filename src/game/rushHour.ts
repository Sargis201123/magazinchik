// Час пик без потерь: двадцать секунд гостей вдвое больше (events.ts, RUSH_SECONDS) — и если за это время никто
// не ушёл из очереди, не дождавшись, магазин получает маленькую премию. До 10.11 час пик был только толпой:
// в большом магазине с кассирами он проходил сам, игроку в нём нечего было делать. Теперь в час пик (и не только)
// касание любой кассы торопит её кассира (scenes/shoppers.ts, hurryRegister) — есть за чем следить и что нажимать.

import { questReward } from './endless';

/** Сколько покупателей надо обслужить за час пик, чтобы премия считалась (пустой час пик — не заслуга). */
export const RUSH_MIN_SERVED = 4;

/** Премия за час пик без потерь: половина награды задания дня, не меньше 5 монет. */
export const rushBonus = (level: number): number => Math.max(5, Math.round(questReward(level) / 2 / 5) * 5);

export type RushOutcome = { kind: 'clean'; bonus: number } | { kind: 'lost'; lost: number } | { kind: 'quiet' };

/** Чем кончился час пик: served — сколько обслужили за него, lost — сколько ушло из очереди, не дождавшись. */
export function rushOutcome(served: number, lost: number, level: number): RushOutcome {
  if (lost > 0) return { kind: 'lost', lost };
  if (served < RUSH_MIN_SERVED) return { kind: 'quiet' };
  return { kind: 'clean', bonus: rushBonus(level) };
}
