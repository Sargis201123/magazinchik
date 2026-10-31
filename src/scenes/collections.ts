// Альбом коллекций в мире (game/collections.ts): витрина трофеев в зале — по трофею за каждый
// собранный набор, золотая, когда собраны все, — и праздник, когда набор собран. Раз в секунду
// альбом добирает заработанное, показывает «📖 В альбом: …» над кассой и празднует собранное.
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
  setDone,
  setName,
  SET_IDS,
  syncCollections,
  takeParty,
  trophyKey,
  type SetId,
} from '../game/collections';
import { sound } from '../platform/sound';
import { music } from '../platform/music';
import { haptic } from '../platform/telegram';
import { sheetPng } from '../ui/sheet';
import { toast } from '../ui/dom';
import { propFootprint, propIssues, propRect } from './placement';
import { registerCount } from '../game/registers';
import { kioskCount } from '../game/lanes';
import { ART, LIGHT_DEPTH } from './common';
import * as building from './building';

/** Где стоят трофеи: левый верхний угол картинки трофея на витрине (art/album.py, SLOTS), в точках картинки. */
const SLOTS: [number, number][] = [
  [3, 6],
  [14, 6],
  [25, 6],
  [8, 18],
  [20, 18],
  [8, 30],
  [20, 30],
];
/** Размер витрины в точках картинки (38×50) — в мире вдвое меньше. */
const CASE_W = 38;
const CASE_H = 50;

/**
 * Витрина трофеев: появляется с первым собранным набором. Стоит у стены зала, её можно передвинуть
 * при перестановке (как праздничную вещь); все места заняты — сегодня витрины нет.
 */
export function buildTrophyCase(scene: StoreScene): void {
  scene.trophyCase = undefined;
  const sets = SET_IDS.filter((s) => setDone(scene.state, s));
  if (!sets.length) return;
  const { w, h, door, wallH } = scene.layout;
  const props = scene.propList.map(propRect);
  const fp = propFootprint(scene.layout, 'trophies', 0);
  const registers = registerCount(scene.state);
  const kiosks = kioskCount(scene.state);
  // Свободно: не на пути (обход мебели), не на других вещах, полках, у касс и в дверях комнат (как при перестановке).
  const free = (x: number, y: number) =>
    scene.obstacles.every((o) => x + fp.x + fp.w < o.x - 4 || x + fp.x > o.x + o.w + 4 || y + fp.y + fp.h < o.y - 4 || y + fp.y > o.y + o.h + 4) &&
    props.every((r) => x + fp.x + fp.w < r.x || x + fp.x > r.x + r.w || y + fp.y + fp.h < r.y || y + fp.y > r.y + r.h) &&
    !propIssues(scene.layout, scene.layout.slots, [...scene.propList, { id: 'trophies', x, y, fp, tex: '' }], registers, kiosks).has('trophies');
  // Не у самой нижней стены: туда заходят фонари тротуара. По обе стороны от входа, потом в углах и у боковых стен.
  const spots = [
    { x: door.x - 60, y: h - 30 },
    { x: door.x + 64, y: h - 30 },
    { x: 16, y: h - 30 },
    { x: w - 16, y: h - 30 },
    { x: 16, y: wallH + 44 },
    { x: w - 16, y: wallH + 90 },
  ].filter((p) => p.x > 10 && p.x < w - 10);
  const def = spots.find((p) => free(p.x, p.y)) ?? spots[0];
  const p = building.propAt(scene, 'trophies', def);
  if (p === def && !free(p.x, p.y)) return;
  const golden = albumGolden(scene.state);
  const tex = golden ? 'trophy_case_gold' : 'trophy_case';
  const img = scene.art(p.x, p.y, tex).setDepth(p.y + 10);
  scene.obstacles.push({ x: p.x + fp.x, y: p.y + fp.y, w: fp.w, h: fp.h });
  building.registerProp(scene, 'trophies', p, tex, fp);
  scene.trophyCase = { x: p.x, y: p.y, img, shown: [] };
  for (const set of sets) addTrophy(scene, set);
  if (golden) shine(scene);
}

/** Поставить трофей набора на его место в витрине. */
function addTrophy(scene: StoreScene, set: SetId): Phaser.GameObjects.Image | null {
  const box = scene.trophyCase;
  if (!box?.img.active || box.shown.includes(set)) return null;
  const [sx, sy] = SLOTS[SET_IDS.indexOf(set)] ?? SLOTS[0];
  const left = box.x - CASE_W / ART / 2;
  const top = box.y - CASE_H / ART / 2;
  box.shown.push(set);
  return scene.art(left + sx / ART, top + sy / ART, trophyKey(set)).setOrigin(0, 0).setDepth(box.y + 10.1);
}

/** Золотая витрина поблёскивает: искорка то в одном углу, то в другом (в лёгкой графике — без неё). */
function shine(scene: StoreScene): void {
  const box = scene.trophyCase;
  if (!box || scene.lite) return;
  const spark = scene.art(box.x, box.y, 'spark').setDepth(box.y + 10.2).setAlpha(0).setScale(0.35 / ART);
  const corners: [number, number][] = [
    [-8, -10],
    [8, -3],
    [-8, 5],
    [7, 9],
  ];
  let i = 0;
  const stop = scene.worldTimer(2600, () => {
    if (!spark.active) {
      stop();
      return;
    }
    const [dx, dy] = corners[i++ % corners.length];
    spark.setPosition(box.x + dx, box.y + dy).setAlpha(1);
    scene.tweens.add({ targets: spark, alpha: 0, duration: 700, ease: 'Sine.easeIn' });
  });
}

/** Набор собран днём или утром: трофей встаёт в витрину (витрины не было — она появляется). */
function placeTrophy(scene: StoreScene, set: SetId): { x: number; y: number } | null {
  const box = scene.trophyCase;
  if (box?.img.active) {
    const img = addTrophy(scene, set);
    if (albumGolden(scene.state)) {
      box.img.setTexture('trophy_case_gold');
      shine(scene);
    }
    if (img && !scene.lite) {
      // Трофей опускается на полку.
      const y = img.y;
      img.setY(y - 6).setAlpha(0);
      scene.tweens.add({ targets: img, y, alpha: 1, duration: 500, ease: 'Back.easeOut' });
    }
    return { x: box.x, y: box.y };
  }
  buildTrophyCase(scene);
  const made = scene.trophyCase as { x: number; y: number } | undefined;
  return made ? { x: made.x, y: made.y } : null;
}

/** Праздник собранного набора: трофей в витрину, фанфары, всплывашка с наградой, конфетти у витрины. */
function celebrate(scene: StoreScene, sets: SetId[]): void {
  sets.forEach((set, i) => {
    scene.time.delayedCall(i * 2200, () => {
      const at = placeTrophy(scene, set);
      const def = collectionSet(set);
      const trophy = t(`col.trophy.${set}` as TextKey);
      const text = def.coins ? t('col.partyCoins', { trophy, money: setCoins(scene.state.level) }) : t('col.partyTrophy', { trophy });
      toast(sheetPng(trophyKey(set)), t('col.party', { name: t(setName(set)) }), text, true);
      if (!music.sting('coin')) sound.fanfare();
      haptic.success();
      if (at) {
        scene.popup(at.x, at.y - 16, `📖 ${t(setName(set))} ✓`, '#fee761');
        if (!scene.lite) burst(scene, at.x, at.y - 10);
      }
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

/** Горсть конфетти над витриной — без вспышки и тряски. */
function burst(scene: StoreScene, x: number, y: number): void {
  const confetti = scene.add.particles(x, y, 'confetti', {
    speed: { min: 30, max: 80 },
    angle: { min: 220, max: 320 },
    gravityY: 120,
    rotate: { min: 0, max: 360 },
    scale: 0.7 / ART,
    lifespan: 1100,
    tint: [0xe43b44, 0xfee761, 0x63c74d, 0x0099db, 0xb55088],
    emitting: false,
  });
  confetti.setDepth(LIGHT_DEPTH + 10).explode(18);
  scene.time.delayedCall(1300, () => confetti.destroy());
}

/** Отметить предмет набора в момент события (письмо, блюдо, момент дня); остальное tick доберёт сам. */
export function note(scene: StoreScene, set: SetId, item: string): void {
  if (savingPaused()) return;
  scene.state = collect(scene.state, set, item);
}

/**
 * Раз в секунду: добрать заработанное, сказать о новом над кассой и отпраздновать собранное.
 * В гостях у друга на экране чужой магазин — его альбом не трогаем.
 */
export function tick(scene: StoreScene): void {
  if (savingPaused() || scene.onTitle) return;
  let next = syncCollections(scene.state);
  const fresh = next.collections?.fresh ?? [];
  // Первый взгляд после загрузки: то, что уже было, — не новость.
  if (!scene.collectSeen) scene.collectSeen = new Set(fresh);
  const news = fresh.filter((f) => !scene.collectSeen!.has(f));
  for (const f of news) scene.collectSeen.add(f);
  const party = takeParty(next);
  next = party.state;
  if (next === scene.state && !news.length) return;
  scene.state = next;
  saveGame(next);
  if (!scene.running) scene.hud.update(next, scene.timeLeft);
  // У редкого гостя своя надпись (shoppers.rareGuestServed).
  const { sellerHome } = scene.layout;
  news
    .filter((f) => !f.startsWith('guests:'))
    .forEach((f, i) => {
      const [set, id] = f.split(':') as [SetId, string];
      const item = collectionSet(set)?.items.find((x) => x.id === id);
      if (!item) return;
      scene.time.delayedCall(i * 900, () => scene.popup(sellerHome.x - 24, sellerHome.y - 46, t('col.popupNew', { icon: item.icon, name: t(item.nameKey) }), '#c8e6ff'));
    });
  if (party.sets.length) celebrate(scene, party.sets);
}
