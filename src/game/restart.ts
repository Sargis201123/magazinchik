// Новая игра с нуля: после банкротства или по кнопке «Начать заново».
// Магазин, деньги, персонал, сюжет и опыт хозяина начинаются сначала. Остаётся то, что
// принадлежит игроку, а не магазину:
// - всё купленное за Telegram Stars (премиальный декор; новые покупки за звёзды добавлять сюда);
// - открытые достижения;
// - бабушкина экскурсия уже пройдена, серия ежедневных подарков не сбрасывается.

import { DECOR, type DecorId, type DecorKind } from './decor';
import { newGame, type StoreState } from './economy';

/** Премиальные (за Stars) вещи оформления, которые игрок уже купил. */
export function premiumDecor(state: StoreState): DecorId[] {
  return state.decor.owned.filter((id) => DECOR.find((d) => d.id === id)?.stars !== undefined);
}

export function restartGame(old: StoreState): StoreState {
  const fresh = newGame();
  const owned = premiumDecor(old);
  // Премиальное, что стояло в магазине, остаётся стоять.
  const active = Object.fromEntries(
    Object.entries(old.decor.active).filter(([, id]) => id && owned.includes(id)),
  ) as Partial<Record<DecorKind, DecorId>>;
  return {
    ...fresh,
    decor: { owned, active },
    achievements: [...old.achievements],
    gift: old.gift,
    records: old.records,
    tourDone: true,
    // Прошлые игры — для экрана «магазин закрыт» и будущих рекордов.
    runs: (old.runs ?? 0) + 1,
  };
}
