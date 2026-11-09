// Альбом коллекций в мире (game/collections.ts): праздник, когда набор собран. Раз в секунду альбом
// добирает заработанное и празднует собранное. Витрины трофеев в зале нет (08.11) — трофеи в альбоме.
// Сам альбом-книга — в ui/album.ts.

import type { StoreScene } from './StoreScene';
import { t } from '../i18n';
import type { TextKey } from '../i18n/ru';
import { saveGame, savingPaused } from '../game/save';
import {
  albumGolden,
  collect,
  collectionSet,
  setCoins,
  setName,
  syncCollections,
  takeParty,
  trophyKey,
  type SetId,
} from '../game/collections';
import { DAY_SECONDS } from '../game/economy';
import { sound } from '../platform/sound';
import { music } from '../platform/music';
import { haptic } from '../platform/telegram';
import { sheetPng } from '../ui/sheet';
import { toast } from '../ui/dom';

/**
 * Праздник собранного набора: всплывашка с трофеем и наградой, фанфары. Витрины трофеев в зале нет
 * (08.11, решение автора: в зале она мешала и была непонятна) — трофеи в альбоме (🏆 → «Трофеи»).
 */
function celebrate(scene: StoreScene, sets: SetId[]): void {
  sets.forEach((set, i) => {
    scene.time.delayedCall(i * 2200, () => {
      const def = collectionSet(set);
      const trophy = t(`col.trophy.${set}` as TextKey);
      const text = def.coins ? t('col.partyCoins', { trophy, money: setCoins(scene.state.level) }) : t('col.partyTrophy', { trophy });
      toast(sheetPng(trophyKey(set)), t('col.party', { name: t(setName(set)) }), text, true);
      if (!music.sting('coin')) sound.fanfare();
      haptic.success();
    });
  });
  if (albumGolden(scene.state)) {
    scene.time.delayedCall(sets.length * 2200, () => {
      toast(sheetPng('trophy_case_gold'), t('col.titleGolden'), t('col.partyAll'), true);
      sound.fanfare();
      scene.checkAchievements(scene.running);
    });
  }
}

/** Отметить предмет набора в момент события (письмо, блюдо, момент дня); остальное tick доберёт сам. */
export function note(scene: StoreScene, set: SetId, item: string): void {
  if (savingPaused()) return;
  scene.state = collect(scene.state, set, item);
}

/**
 * Раз в секунду: добрать заработанное и отпраздновать собранное. Новое в альбоме видно меткой
 * «Новое» на кнопке профиля и в самом альбоме — без надписей в зале.
 * В гостях у друга на экране чужой магазин — его альбом не трогаем.
 */
export function tick(scene: StoreScene): void {
  if (savingPaused() || scene.onTitle) return;
  const party = takeParty(syncCollections(scene.state));
  if (party.state === scene.state) return;
  scene.state = party.state;
  saveGame(party.state);
  // Утром часы дня ещё не идут: HUD показывает полный день, как утреннее окно.
  if (!scene.running) scene.hud.update(party.state, scene.dayOpen ? scene.timeLeft : DAY_SECONDS);
  if (party.sets.length) celebrate(scene, party.sets);
}
