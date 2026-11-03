import Phaser from 'phaser';
// Свой шрифт с кириллицей (лежит в сборке): текст одинаково ровный на iPhone, Android и компьютере.
import '@fontsource-variable/nunito';
import { BootScene } from './scenes/BootScene';
import { StoreScene } from './scenes/StoreScene';

import { initTelegram } from './platform/telegram';
import { installErrorReporting } from './platform/errors';
import { loadLang, usePlatformLang } from './i18n';
import { IS_YANDEX } from './platform/target';
import { initYandex, setFreeze, yandexLang } from './platform/yandex';
import { holdSound } from './platform/mixer';
import { startSync } from './game/save';
import { installFrameCap } from './platform/frameCap';
import { measureCanvas, watchScreen } from './platform/screen';
import { installClickSounds } from './ui/audio';
import { lazyIdle } from './platform/lazy';

const BG = '#1d1a26';

installErrorReporting();
if (IS_YANDEX) {
  // Яндекс Игры: сначала SDK (язык площадки и облако игрока), потом — как в Telegram.
  void initYandex()
    .catch(() => undefined)
    .then(() => {
      usePlatformLang(yandexLang());
      void startSync();
      return loadLang().catch(() => undefined);
    })
    .then(start);
} else {
  initTelegram(BG);
  // Сохранение сверяется с облаком Telegram сразу, пока грузятся словарь и картинки (BootScene ждёт итог).
  void startSync();

  // Словарь языка — до запуска: сцены строят надписи сразу.
  void loadLang().catch(() => undefined).then(start);
}

function start(): void {
  // Не больше 60 кадров на быстрых экранах и 30 — под окнами во весь экран (platform/frameCap.ts).
  installFrameCap();
  // Кнопки и вкладки меню щёлкают деревом и бумагой (ui/audio.ts).
  installClickSounds();
  // Холст ровно по пикселям экрана (platform/screen.ts): браузер его не растягивает, Phaser — тоже.
  const fit = measureCanvas();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: BG,
    pixelArt: true,
    roundPixels: true,
    // Phaser на Android качает по 6 файлов разом. Картинки мира теперь — один лист атласа, но не
    // влезшие в него грузятся по одной; сервер отдаёт по HTTP/2 — можно смело 32 параллельно.
    loader: { maxParallelDownloads: 32 },
    // Звуки и музыка — свои (platform/mixer.ts); звуковой модуль Phaser не нужен, а он создавал
    // второй, лишний аудиоконтекст.
    audio: { noAudio: true },
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.NO_CENTER,
      width: fit.width,
      height: fit.height,
    },
    scene: [BootScene, StoreScene],
  });
  // Размер на странице, отступы и новые размеры, когда окно меняется (полный экран Telegram, поворот).
  watchScreen(game);
  // Яндекс Игры: на рекламе и паузе площадки цикл игры спит — время в магазине стоит (п. 4.7).
  if (IS_YANDEX) setFreeze((on) => (on ? game.loop.sleep() : game.loop.wake()), holdSound);
  // Отладка: ?debug открывает доступ к игре из консоли браузера.
  // lazyIdle — дождаться частей игры, что подкачиваются отдельно (platform/lazy.ts; ждёт scripts/e2e.ts).
  if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { game, lazyIdle });
}
