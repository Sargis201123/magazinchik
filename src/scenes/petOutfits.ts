// Одежда питомцев в зале (game/cat.ts CAT_OUTFITS, game/watch.ts DOG_OUTFITS): наряд — отдельная картинка того же
// размера, что кадр питомца (ovl_<кадр>_<наряд>, рисует art/pet_outfits.py). Каждый кадр слой повторяет питомца:
// кадр, место, отражение, масштаб, прозрачность — вся прежняя анимация кота и Бобика остаётся нетронутой.
// Кадра без наряда (например, кот в шляпе на кассе — это отдельная вещь за звёзды) слой просто прячет.

import type Phaser from 'phaser';
import type { StoreScene } from './StoreScene';
import { CAT_OUTFIT_IDS } from '../game/cat';
import { DOG_OUTFIT_IDS } from '../game/watch';

/** Кадры, на которые нарисованы наряды (art/pet_outfits.py: CAT, DOG). */
const CAT_FRAMES = ['cat_walk0', 'cat_walk1', 'cat_walk2', 'cat_walk3', 'cat_sit', 'cat_sit0', 'cat_sit1', 'cat_sit2', 'cat_sit_blink', 'cat_groom0', 'cat_groom1', 'cat', 'cat_flick'];
const DOG_FRAMES = ['bobik_sit0', 'bobik_sit1', 'bobik_bark', 'bobik_walk0', 'bobik_walk1', 'bobik_lie'];

/** Все картинки нарядов — для атласа (worldTextures.ts). */
export const OUTFIT_TEXTURES: string[] = [
  ...CAT_FRAMES.flatMap((f) => CAT_OUTFIT_IDS.map((o) => `ovl_${f}_${o}`)),
  ...DOG_FRAMES.flatMap((f) => DOG_OUTFIT_IDS.map((o) => `ovl_${f}_${o}`)),
];

const worn = new WeakMap<Phaser.GameObjects.Image, Phaser.GameObjects.Image>();

function dress(scene: StoreScene, pet: Phaser.GameObjects.Image | undefined, outfit: string | undefined): void {
  if (!pet) return;
  let top = worn.get(pet);
  if (!pet.active || !outfit) {
    if (top) {
      top.destroy();
      worn.delete(pet);
    }
    return;
  }
  const key = `ovl_${pet.texture.key}_${outfit}`;
  const has = scene.textures.exists(key);
  if (!top) {
    if (!has) return;
    top = scene.add.image(pet.x, pet.y, key);
    worn.set(pet, top);
    // Питомец ушёл со сцены (новый день, перестройка зала) — наряд вместе с ним.
    pet.once('destroy', () => {
      top?.destroy();
      worn.delete(pet);
    });
  }
  if (!has) {
    top.setVisible(false);
    return;
  }
  if (top.texture.key !== key) top.setTexture(key);
  top
    .setPosition(pet.x, pet.y)
    .setOrigin(pet.originX, pet.originY)
    .setScale(pet.scaleX, pet.scaleY)
    .setFlipX(pet.flipX)
    .setAngle(pet.angle)
    .setAlpha(pet.alpha)
    .setVisible(pet.visible)
    .setDepth(pet.depth + 0.01)
    .setTint(pet.tintTopLeft);
}

/** Каждый кадр: наряды на коте и Бобике повторяют их движение. */
export function syncOutfits(scene: StoreScene): void {
  dress(scene, scene.catImg, scene.state.cat?.outfit);
  dress(scene, scene.bobik, scene.state.security?.dog?.outfit);
}
