// Новая игра с нуля: после банкротства или по кнопке «Начать заново».
// Магазин, деньги, персонал, сюжет и опыт хозяина начинаются сначала. Остаётся то, что
// принадлежит игроку, а не магазину:
// - всё купленное за Telegram Stars (премиальный декор; новые покупки за звёзды добавлять сюда)
//   и праздничные вещи за открытки (live.ts), а с ними — какие открытки уже открыты;
// - открытые достижения;
// - бабушкина экскурсия уже пройдена, серия ежедневных подарков не сбрасывается;
// - наследие проданных магазинов (legacy.ts): очки и бонусы, стартовые — сразу в новом магазине;
// - сезонный пропуск и отметки о забранных наградах недели и выходных.

import { isDecorId, isKeepsake, type DecorId, type DecorKind } from './decor';
import { newGame, type StoreState } from './economy';
import { applyLegacyStart } from './legacy';

/** Вещи оформления, которые принадлежат игроку: купленные за звёзды и праздничные (за открытки). */
export function premiumDecor(state: StoreState): DecorId[] {
  return state.decor.owned.filter((id) => isDecorId(id) && isKeepsake(id));
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
    // Турнир района и полка памяти (social.ts): награду недели второй раз не забрать, открытки друзей остаются.
    leagueClaimed: old.leagueClaimed,
    keepsakes: old.keepsakes,
    // Сезонный пропуск — тоже (за него могли заплатить звёздами): опыт и забранные награды остаются.
    pass: old.pass,
    // Открытки праздника по календарю: сегодняшнюю второй раз не открыть, гостя второй раз не встретить.
    live: old.live,
  });
}
