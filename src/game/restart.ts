// Новая игра с нуля: после банкротства или по кнопке «Начать заново».
// Магазин, деньги, персонал, сюжет и опыт хозяина начинаются сначала. Остаётся то, что
// принадлежит игроку, а не магазину:
// - всё купленное за Telegram Stars (премиальный декор; новые покупки за звёзды добавлять сюда);
// - открытые достижения;
// - бабушкина экскурсия уже пройдена, серия ежедневных подарков не сбрасывается;
// - наследие проданных магазинов (legacy.ts): очки и бонусы, стартовые — сразу в новом магазине;
// - сезонный пропуск и отметки о забранных наградах недели и выходных.

import { DECOR, type DecorId, type DecorKind } from './decor';
import { newGame, type StoreState } from './economy';
import { applyLegacyStart } from './legacy';

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
  return applyLegacyStart({
    ...fresh,
    decor: { owned, active },
    achievements: [...old.achievements],
    gift: old.gift,
    records: old.records,
    tourDone: true,
    // Прошлые игры — для экрана «магазин закрыт» и будущих рекордов.
    runs: (old.runs ?? 0) + 1,
    legacy: old.legacy,
    // Награды недели и выходных принадлежат игроку: после нового магазина их не забрать второй раз.
    duelClaimed: old.duelClaimed,
    guildClaimed: old.guildClaimed,
    rushClaimed: old.rushClaimed,
    // Сезонный пропуск — тоже (за него могли заплатить звёздами): опыт и забранные награды остаются.
    pass: old.pass,
  });
}
