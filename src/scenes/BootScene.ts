import Phaser from 'phaser';

/** Все спрайты нарисованы скриптом art/sprites.py и лежат в public/assets. */
const SPRITES = [
  'floor',
  'wall',
  'concrete',
  'asphalt',
  'lot',
  'shelf',
  'shelf_front',
  'stand',
  'stand_front',
  'fridge',
  'fridge_front',
  'shadow_wide',
  'window',
  'clock',
  'counter',
  'wc',
  'door',
  'box',
  'trash',
  'bubble',
  'pip',
  'bar',
  'item_bread',
  'item_apples',
  'item_potatoes',
  'item_milk',
  'item_meat',
  ...['bread', 'apples', 'potatoes', 'milk', 'meat'].flatMap((id) => [0, 1, 2].map((v) => `item_${id}_${v}`)),
  'p_skin',
  'p_shirt',
  'p_legs0',
  'p_legs1',
  'p_hair_short',
  'p_hair_long',
  'p_hair_bun',
  'p_hair_cap',
  'p_hair_bald',
  'shadow',
  'plant',
  'poster',
  'baskets',
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    for (const key of SPRITES) this.load.image(key, `assets/${key}.png`);
  }

  create(): void {
    this.scene.start('store');
  }
}
