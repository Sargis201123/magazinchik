// Вход в «Лавку «Своё»» (вторая игра) с титульного экрана. Код лавки — отдельным куском сборки: игроку
// «Магазинчика» он не грузится вовсе. Магазин за титулом не останавливается, а засыпает (scene.sleep): его мир, таймеры
// и сохранение стоят как были, панели магазина спрятаны (ui-on-farm), а ферма идёт своей сценой поверх.
// Обратно в магазин — перезапуск игры с выбором «Магазинчик» (итоги дня: «В Магазинчик»), в прототипе так проще
// и надёжнее, чем будить магазин с середины титула.

import type Phaser from 'phaser';

const FARM_KEY = 'farm';

export function enterFarm(store: Phaser.Scene): void {
  document.body.classList.add('ui-on-farm');
  void import('./LavkaScene').then(({ LavkaScene }) => {
    const scenes = store.scene;
    if (!store.game.scene.keys[FARM_KEY]) scenes.add(FARM_KEY, LavkaScene, false);
    scenes.launch(FARM_KEY);
    scenes.bringToTop(FARM_KEY);
    scenes.sleep();
  });
}
